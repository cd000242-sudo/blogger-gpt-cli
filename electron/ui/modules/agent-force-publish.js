/**
 * 🛑 v3.8.778 — 에이전트 글 발행 보류(PUBLISH_HELD) 때만 "검토 후 강제 발행" 을 보여 준다.
 *
 * 발행 창구(publishGeneratedContent)가 에이전트 글을 작성자 요구로 막으면 { blockedReason:'MANUAL_REVIEW', hold } 를 돌려준다.
 * 이 모듈은 그 hold 로 확인창 문구만 만든다 — 사유 구분(누락 MUST·위반 EXCLUDE·잘못된 CTA·사실 충돌)은 main 이 공통 함수로 이미 나눴다.
 *
 * 규칙:
 *   · 보류가 아니면 아무것도 그리지 않는다(평상시 버튼 없음)
 *   · 버튼만 눌러서는 발행하지 않는다 — 확인창에서 사람이 승인해야 한다
 *   · 사실 충돌·현재 상태 모순이 있으면 두 번째 확인을 더 강한 문구로 한 번 더 묻는다
 *   · 승인하면 onApprove() 를 부른다 — 부르는 쪽이 forcePublish: true(불리언)를 싣는다. 취소하면 보류가 그대로다
 *   · 자동 강제 발행은 없다
 *
 * import 없이 쓴다(테스트가 소스를 그대로 실행한다).
 */

export const HOLD_CATEGORY_LABELS = {
  USER_REQUIREMENT_MISSING: '빠진 필수 요구',
  EXCLUDE_VIOLATED: '제외 요청 위반',
  CTA_CONTRADICTED: '잘못된 CTA',
  FACT_CONFLICT: '사실 충돌',
  CRITICAL_STATE_CONTRADICTION: '현재 상태와 모순',
};

const OFFER_ID = 'agentForcePublishOffer';

/** 에이전트 작성자 요구 보류인가 — 다른 실패(네트워크·인증·일반 글 보류)에는 버튼을 내지 않는다 */
export function isAgentPublishHeld(result) {
  return !!(result && result.ok === false && result.blockedReason === 'MANUAL_REVIEW' && result.hold && result.hold.source === 'agent-requirement');
}

/** 사실 충돌·현재 상태 모순 — 두 번째 확인이 필요한 보류 */
export function needsStrongConfirm(hold) {
  const categories = Array.isArray(hold?.categories) ? hold.categories : [];
  return categories.includes('FACT_CONFLICT') || categories.includes('CRITICAL_STATE_CONTRADICTION');
}

const itemLines = (list) => (Array.isArray(list) && list.length
  ? list.map((b) => `  · ${b.id} "${String(b.sourceText || '').slice(0, 60)}" — ${String(b.reason || b.status || '').slice(0, 120)}`)
  : ['  · 없음']);

/** 첫 번째 확인창 문구 — 보류 사유 · 빠진 MUST · 위반한 EXCLUDE · 잘못된 CTA · 사실 충돌 여부 */
export function buildForcePublishConfirmText(hold) {
  const groups = hold?.groups || {};
  const categories = (Array.isArray(hold?.categories) ? hold.categories : []).map((c) => HOLD_CATEGORY_LABELS[c] || c);
  return [
    '이 에이전트 글은 작성자 요구를 지키지 않아 자동 발행을 보류했습니다.',
    '',
    `보류 구분: ${categories.join(' · ') || '(구분 없음)'}`,
    `보류 사유: ${String(hold?.reason || '').slice(0, 400)}`,
    '',
    '빠진 필수(MUST) 요구:', ...itemLines(groups.missingMust),
    '위반한 제외(EXCLUDE) 요구:', ...itemLines(groups.excludeViolations),
    '잘못된 CTA:', ...itemLines(groups.ctaProblems),
    `사실 충돌: ${Array.isArray(groups.factConflicts) && groups.factConflicts.length ? `있음 (${groups.factConflicts.map((b) => b.id).join(', ')})` : '없음'}`,
    '',
    '내용을 직접 검토했고, 이 상태 그대로 발행하시겠습니까?',
    '(확인을 누르면 강제 발행 기록이 발행 장부에 남습니다)',
  ].join('\n');
}

/** 두 번째 확인창 문구 — 사실 충돌·현재 상태 모순이 있을 때만 */
export function buildStrongConfirmText(hold) {
  const facts = Array.isArray(hold?.groups?.factConflicts) ? hold.groups.factConflicts : [];
  return [
    '⚠️ 한 번 더 확인합니다 — 사실 근거와 맞지 않는 내용이 있습니다.',
    '',
    ...facts.map((b) => `· ${b.id}: ${String(b.reason || '').slice(0, 160)}`),
    ...(Array.isArray(hold?.categories) && hold.categories.includes('CRITICAL_STATE_CONTRADICTION') ? ['· 글이 현재 상태(마감·중단 등)와 반대로 안내합니다.'] : []),
    '',
    '독자에게 틀린 정보가 그대로 발행될 수 있습니다. 공식 근거를 직접 확인하셨습니까?',
    '정말로 강제 발행하려면 확인을 누르세요.',
  ].join('\n');
}

/** 사람의 승인 — 확인창이 명시적으로 true 를 돌려줄 때만. 강한 확인이 필요하면 두 번 */
export async function approveForcePublish(hold, confirmFn) {
  if (typeof confirmFn !== 'function') return false;
  if ((await confirmFn(buildForcePublishConfirmText(hold))) !== true) return false;
  if (needsStrongConfirm(hold) && (await confirmFn(buildStrongConfirmText(hold))) !== true) return false;
  return true;
}

export function clearForcePublishOffer(doc) {
  try { doc?.getElementById?.(OFFER_ID)?.remove?.(); } catch { /* noop */ }
}

/**
 * 보류면 화면 오른쪽 아래에 안내 + "검토 후 강제 발행" 버튼을 띄운다(body 직속 — 진행 모달은 실패 때 닫힌다).
 * 보류가 아니면 남아 있던 안내를 지우고 null.
 */
export function renderForcePublishOffer(doc, result, { onApprove, confirmFn } = {}) {
  clearForcePublishOffer(doc);
  if (!doc || !isAgentPublishHeld(result)) return null;
  const hold = result.hold;
  const panel = doc.createElement('div');
  panel.id = OFFER_ID;
  panel.setAttribute('role', 'alertdialog');
  panel.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:100001;max-width:420px;padding:16px 18px;border-radius:12px;background:#1f2937;color:#f9fafb;border:1px solid #f59e0b;font-size:13px;line-height:1.6;';

  const title = doc.createElement('div');
  title.style.cssText = 'font-weight:800;margin-bottom:6px;';
  title.textContent = '🛑 발행 보류 — 에이전트 글이 작성자 요구를 지키지 않았습니다';
  const body = doc.createElement('div');
  body.style.cssText = 'margin-bottom:10px;white-space:pre-line;';
  body.textContent = (Array.isArray(hold.categories) ? hold.categories : []).map((c) => `· ${HOLD_CATEGORY_LABELS[c] || c}`).join('\n') || String(hold.reason || '');
  const status = doc.createElement('div');
  status.style.cssText = 'margin-bottom:8px;color:#fcd34d;';

  const force = doc.createElement('button');
  force.type = 'button';
  force.textContent = '검토 후 강제 발행';
  force.style.cssText = 'margin-right:8px;padding:8px 14px;border-radius:8px;border:0;background:#b45309;color:#fff;font-weight:700;cursor:pointer;';
  const close = doc.createElement('button');
  close.type = 'button';
  close.textContent = '닫기(보류 유지)';
  close.style.cssText = 'padding:8px 14px;border-radius:8px;border:1px solid #6b7280;background:transparent;color:#e5e7eb;cursor:pointer;';

  force.addEventListener('click', async () => {
    const approved = await approveForcePublish(hold, confirmFn);
    if (!approved) { status.textContent = '취소했습니다 — 보류가 그대로 유지됩니다.'; return; }
    clearForcePublishOffer(doc);
    if (typeof onApprove === 'function') await onApprove();
  });
  close.addEventListener('click', () => clearForcePublishOffer(doc));

  panel.appendChild(title);
  panel.appendChild(body);
  panel.appendChild(status);
  panel.appendChild(force);
  panel.appendChild(close);
  doc.body.appendChild(panel);
  return panel;
}
