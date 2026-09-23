// 🩺 post-critique-modal.js — 발행된 글의 비평 리포트를 보여주고, 고칠 항목을 고르게 한다. (v3.8.619)
//
// 사장님: "그냥 다시 발행하는 게 아니라 글을 비평해보고 개선점을 확인해서 다시 발행하도록"
//
// 이 화면이 있는 이유는 하나다 — **무엇을 고칠지 사람이 보고 정한다.**
// AI 가 알아서 다 바꿔버리면, 잘 쓴 문단이 지워져도 알아챌 수가 없다(과거 실수).
// 그래서 체크한 항목만 고치고, 체크를 안 하면 그 구간은 손대지 않는다.

const SEVERITY = {
  high: { label: '반드시', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.35)', fg: '#fca5a5' },
  medium: { label: '권장', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.30)', fg: '#fcd34d' },
  low: { label: '참고', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.25)', fg: '#cbd5f5' },
};

/**
 * 🕰️ v3.8.622 — 이 지적이 **왜 지금 나왔는가**.
 *
 * 사장님: "새롭게 나온 것들은 왜 나왔는지 수긍이 될 거 아냐"
 * 전에는 회차마다 백지에서 시작해 같은 문제가 이름만 바꿔 다시 나왔고,
 * 화면에는 그게 처음인지 되풀이인지 표시할 방법이 없었다.
 */
const STATUS = {
  new: { label: '새 지적', bg: 'rgba(99,102,241,0.18)', fg: '#c7d2fe' },
  again: { label: '지난번에도', bg: 'rgba(245,158,11,0.16)', fg: '#fcd34d' },
  regressed: { label: '고쳤는데 또', bg: 'rgba(239,68,68,0.18)', fg: '#fca5a5' },
  'side-effect': { label: '개선이 남긴 것', bg: 'rgba(168,85,247,0.18)', fg: '#e9d5ff' },
};

/**
 * 🧭 v3.8.750 — 수렴. 지적마다 blocking(발행을 막는가)이 붙어 온다. 심각도와 별개다.
 * 「반드시」는 발행을 막는 결함에만 붙는다 — 선택 개선이 「반드시」로 떠서 끝없이 고치던 것을 끊는다.
 */
const EVIDENCE_TONE = { label: '근거 필요', bg: 'rgba(56,189,248,0.07)', border: 'rgba(56,189,248,0.28)', fg: '#7dd3fc' };
const LIFECYCLE = {
  OPEN: { label: '남음', bg: 'rgba(239,68,68,0.16)', fg: '#fca5a5' },
  REGRESSED: { label: '수정 뒤 다시 생김', bg: 'rgba(168,85,247,0.2)', fg: '#e9d5ff' },
  RESOLVED: { label: '해결됨', bg: 'rgba(34,197,94,0.16)', fg: '#86efac' },
};

const AREA_LABEL = {
  substance: '알맹이',
  answer: '검색 의도',
  quality: '품질 기준',
  cta: '전환',
  competitor: '경쟁글 대비',
  structure: '구성',
  // v3.8.714: 읽는 맛 — 문장 중간 줄바꿈·표 서술형·훈계조처럼 사람이 30초면 보는 것들
  style: '문장·표기',
};

const esc = (value) => String(value == null ? '' : value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function scoreColor(score) {
  if (score >= 80) return '#22c55e';
  if (score >= 55) return '#f59e0b';
  return '#ef4444';
}

/** 이 지적이 어느 구간의 것인지 사람이 읽을 수 있게 */
function sectionLabel(issue, sections) {
  if (!Number.isInteger(issue.sectionIndex) || issue.sectionIndex < 0) return '글 전체';
  const found = (sections || []).find((s) => s.index === issue.sectionIndex);
  if (!found) return '글 전체';
  return found.index === 0 ? '도입부' : `${found.index}. ${found.heading}`;
}

function issueCard(issue, index, sections) {
  // v3.8.750 — 수렴 비평이면 「반드시」는 blocking 에만. 선택 개선은 심각도가 high 여도 '권장' 이하로 보인다.
  const graded = typeof issue.blocking === 'boolean';
  const tone = !graded ? (SEVERITY[issue.severity] || SEVERITY.low)
    : issue.blocking ? SEVERITY.high
      : issue.issueClass === 'NEEDS_NEW_EVIDENCE' ? EVIDENCE_TONE
        : issue.severity === 'low' ? SEVERITY.low : SEVERITY.medium;
  const status = graded ? null : STATUS[issue.status];
  const lifecycle = graded && issue.blocking ? LIFECYCLE[issue.state] : null;
  const note = graded ? issue.lifecycleNote : issue.statusNote;
  /**
   * 🚫 v3.8.729 — **수정 버튼으로 못 고치는 지적은 잠근다.**
   * 사장님: "수정을 시켰는데도 똑같은 지적이 또 나와 … API 비용이 들기 때문에 이러면 절대 안 되는데"
   * "이미지가 0장"은 글을 다시 써서는 절대 안 풀린다(규칙이 "새 이미지 넣지 마세요"). 고르게 두면 비용만 나가고
   * 다음 비평에 또 나온다. 체크박스를 잠그고 **어느 버튼으로 고치는지**를 그 자리에 적는다.
   */
  const locked = issue.fixable === false;
  // 반드시 고칠 것만 미리 체크해 둔다 — 참고 항목까지 켜두면 사장님이 다 끄게 된다.
  // v3.8.750: 수렴 비평이면 autoSelect(발행을 막고 수정 버튼으로 고칠 수 있는 것)만. 선택 개선은 미리 고르지 않는다.
  const checked = !locked && (graded ? issue.autoSelect === true : issue.severity === 'high') ? 'checked' : '';
  return `
    <label style="display:flex;gap:12px;align-items:flex-start;padding:13px 14px;background:${tone.bg};border:1px solid ${tone.border};border-radius:11px;margin-bottom:9px;cursor:${locked ? 'default' : 'pointer'};${locked ? 'opacity:0.72;' : ''}">
      <input type="checkbox" class="pcIssue" data-index="${index}" ${checked} ${locked ? 'disabled' : ''}
        style="margin-top:3px;width:17px;height:17px;accent-color:#6366f1;cursor:${locked ? 'not-allowed' : 'pointer'};flex-shrink:0;">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-bottom:5px;">
          <span style="padding:2px 8px;border-radius:999px;background:rgba(15,23,42,0.55);color:${tone.fg};font-size:10.5px;font-weight:800;">${tone.label}</span>
          <span style="padding:2px 8px;border-radius:999px;background:rgba(99,102,241,0.15);color:#a5b4fc;font-size:10.5px;font-weight:700;">${esc(AREA_LABEL[issue.area] || '구성')}</span>
          <span style="color:#64748b;font-size:11px;">${esc(sectionLabel(issue, sections))}</span>
          ${issue.origin === 'ai' ? '<span style="color:#64748b;font-size:11px;">· AI 비평</span>' : ''}
          ${status ? `<span style="padding:2px 8px;border-radius:999px;background:${status.bg};color:${status.fg};font-size:10.5px;font-weight:800;">${status.label}</span>` : ''}
          ${lifecycle ? `<span style="padding:2px 8px;border-radius:999px;background:${lifecycle.bg};color:${lifecycle.fg};font-size:10.5px;font-weight:800;">${lifecycle.label}</span>` : ''}
        </div>
        ${note ? `<div style="color:#7c8aa5;font-size:11px;line-height:1.5;margin-bottom:5px;">🕰️ ${esc(note)}</div>` : ''}
        <div style="font-weight:800;color:#f1f5f9;font-size:13.5px;line-height:1.45;">${esc(issue.title)}</div>
        ${issue.detail ? `<div style="color:#cbd5f5;font-size:12px;line-height:1.6;margin-top:5px;">${esc(issue.detail)}</div>` : ''}
        ${issue.evidence ? `<div style="margin-top:7px;padding:8px 11px;background:rgba(15,23,42,0.5);border-radius:6px;color:#94a3b8;font-size:11.5px;line-height:1.55;">"${esc(issue.evidence)}"</div>` : ''}
        ${issue.fix ? `<div style="margin-top:7px;color:#86efac;font-size:12px;line-height:1.55;">→ ${esc(issue.fix)}</div>` : ''}
        ${locked ? `<div class="pcFixHint" style="margin-top:7px;padding:7px 10px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);border-radius:6px;color:#fcd34d;font-size:11.5px;line-height:1.55;">🚫 수정 버튼으로는 못 고칩니다 — ${esc(issue.fixHint || '다른 도구로 고치세요.')}</div>` : ''}
      </div>
    </label>
  `;
}

/**
 * 🧭 v3.8.750 — 끝났는가. 반드시 고칠 것이 0 이면 "발행 가능" 이라고 **먼저** 말한다.
 * 이어서 확인(AI 호출 0회)이었는지, 새로 보였지만 올리지 않은 선택 항목이 몇 건인지도 숨기지 않는다.
 */
function convergenceBanner(conv) {
  if (!conv) return '';
  const ok = conv.converged === true;
  const tone = ok
    ? 'background:rgba(34,197,94,0.10);border:1px solid rgba(34,197,94,0.35);color:#bbf7d0;'
    : 'background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.32);color:#fecaca;';
  const how = conv.fullCritique
    ? '전체 비평(코드 진단 + AI 비평)'
    : `이어서 확인 — 지난 반드시 고칠 것이 풀렸는지만 다시 쟀습니다 (AI 호출 0회)${conv.newOptionalIgnored ? ` · 새로 보인 선택 항목 ${conv.newOptionalIgnored}건은 목록에 올리지 않았습니다` : ''}`;
  return `
    <div style="padding:14px 16px;border-radius:12px;margin-bottom:14px;${tone}">
      <div style="font-weight:900;font-size:14px;">${ok ? '✅' : '🔴'} ${esc(conv.headline || '')}</div>
      <div style="color:#cbd5e1;font-size:12px;line-height:1.6;margin-top:6px;">${esc(conv.message || '')}</div>
      <div style="color:#7c8aa5;font-size:11px;line-height:1.5;margin-top:6px;">${esc(how)}${conv.revisionCycle ? ` · 버튼 수정 ${conv.revisionCycle}회` : ''}</div>
    </div>`;
}

function resolvedList(resolved) {
  if (!Array.isArray(resolved) || resolved.length === 0) return '';
  return `
    <div style="margin:4px 0 14px;padding:11px 14px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.25);border-radius:10px;">
      <div style="color:#86efac;font-size:12.5px;font-weight:800;">✅ 해결된 반드시 고칠 것 ${resolved.length}건</div>
      <div style="color:#94a3b8;font-size:11.5px;line-height:1.7;margin-top:5px;">${resolved.map((r) => `· ${esc(r.title)}`).join('<br>')}</div>
    </div>`;
}

/** 반드시 / 선택 / 근거 필요 — 섞어 두면 선택 개선까지 「반드시」처럼 읽힌다 */
function groupedIssues(critique, issues, sections) {
  const indexed = issues.map((issue, i) => ({ issue, i }));
  const group = (title, hint, list) => (list.length ? `
    <div style="margin:4px 0 14px;">
      <div style="color:#e2e8f0;font-size:13px;font-weight:900;margin-bottom:4px;">${title} ${list.length}건</div>
      <div style="color:#7c8aa5;font-size:11.5px;line-height:1.55;margin-bottom:9px;">${hint}</div>
      ${list.map(({ issue, i }) => issueCard(issue, i, sections)).join('')}
    </div>` : '');
  return `
    ${convergenceBanner(critique?.convergence)}
    ${group('🔴 반드시 고칠 것', '발행 전에 고쳐야 하는 결함입니다. 고르면 <b style="color:#cbd5f5;">지적된 문단만</b> 고칩니다.', indexed.filter((x) => x.issue.blocking))}
    ${resolvedList(critique?.resolvedIssues)}
    ${group('🟡 선택 개선', '발행을 막지 않습니다. 원하는 것만 직접 골라 고칠 수 있습니다 — 미리 고르지 않았습니다.', indexed.filter((x) => !x.issue.blocking && x.issue.issueClass !== 'NEEDS_NEW_EVIDENCE'))}
    ${group('📚 근거가 필요한 항목', '근거를 추가해 다시 생성해야 하는 항목입니다. 문장만 고치면 지어내게 되므로 수정 버튼으로 보내지 않습니다.', indexed.filter((x) => x.issue.issueClass === 'NEEDS_NEW_EVIDENCE'))}`;
}

/**
 * 🎯 v3.8.750 — 지적된 문단만 고친 결과: 몇 문단을 고쳤고 나머지는 그대로인가, 새 결함 때문에 되돌린 구간은 어디인가.
 */
function targetedSummary(res) {
  const p = res?.preservation;
  const regressions = Array.isArray(res?.regressions) ? res.regressions : [];
  const kept = p ? `지적된 문단 ${p.blocksChanged}개만 고쳤습니다 · 나머지 문단 ${p.untouchedKept}/${p.untouchedTotal}개 그대로` : '';
  const back = regressions.length ? `
    <div style="margin-top:10px;padding:11px 14px;background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.3);border-radius:10px;">
      <div style="color:#e9d5ff;font-size:12.5px;font-weight:800;">↩️ 새 결함을 만들어 되돌린 구간 ${regressions.length}곳</div>
      <div style="color:#cbd5e1;font-size:11.5px;line-height:1.7;margin-top:5px;">${regressions.map((r) => `· ${esc(r.heading)} — ${esc((r.titles || []).join(' · '))}`).join('<br>')}</div>
      <div style="color:#94a3b8;font-size:11px;margin-top:5px;">고친 결과가 새 「반드시 고칠 것」을 만들어 그 구간은 원문을 그대로 뒀습니다.</div>
    </div>` : '';
  return `${convergenceBanner(res?.convergence)}${kept ? `<div style="color:#94a3b8;font-size:12px;margin:-4px 0 12px;">🎯 ${kept}</div>` : ''}${back}`;
}

/**
 * ✅ v3.8.622 — 수정발행이 끝나면 **모달을 닫지 않고 결과를 보여준다.**
 *
 * 사장님: "고쳤으면 결과도 모달에 보여줘야"
 * 전에는 성공하자마자 모달을 닫고 상태줄에 한 줄만 남겼다. 그래서 무슨 구간이
 * 얼마나 바뀌었는지, 어떤 구간이 왜 그대로 남았는지 알 수가 없었고,
 * 다음 비평에서 새 지적이 나와도 이어 붙일 근거가 없었다.
 */
function resultView(res, picked, editorMode = false) {
  const revised = Array.isArray(res?.revisedDetail) ? res.revisedDetail : [];
  const skipped = Array.isArray(res?.skipped) ? res.skipped : [];
  const before = Number(res?.before || 0);
  const after = Number(res?.length || 0);
  const delta = after - before;

  const rows = revised.map((r) => `
    <div style="padding:12px 14px;background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.28);border-radius:10px;margin-bottom:9px;">
      <div style="font-weight:800;color:#e2e8f0;font-size:13px;">${r.index === 0 ? '도입부' : `${r.index}. ${esc(r.heading)}`}</div>
      <div style="color:#86efac;font-size:11.5px;margin-top:4px;">${r.before}자 → ${r.after}자 (${r.after - r.before >= 0 ? '+' : ''}${r.after - r.before})</div>
      ${r.issues?.length ? `<div style="color:#94a3b8;font-size:11.5px;line-height:1.55;margin-top:5px;">반영: ${esc(r.issues.join(' · '))}</div>` : ''}
    </div>`).join('');

  /**
   * ⚠️ v3.8.700 — **두 번 고쳐도 남은 지적은 숨기지 않는다.**
   *
   * 사장님: "지적한걸 수정하고 다시비평을했는데 또 똑같은 지적이 나오면 어쩌란거냐고"
   * 되풀이의 절반은 "고쳤다"고 말해 놓고 실제로는 안 고쳐진 것이었다.
   * 이제 고친 뒤 다시 재서, 남은 것은 **여기서 미리 말한다** — 다음 비평에서 처음 보는 것처럼
   * 나오면 사장님은 같은 실망을 두 번 한다.
   */
  const stillPresent = Array.isArray(res?.stillPresent) ? res.stillPresent : [];
  const stillRows = stillPresent.length ? `
    <div style="margin-top:14px;padding:12px 14px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.30);border-radius:10px;">
      <div style="color:#fca5a5;font-size:12.5px;font-weight:800;">두 번 고쳤는데도 남은 지적 ${stillPresent.length}건</div>
      <div style="color:#cbd5e1;font-size:11.5px;line-height:1.7;margin-top:6px;">
        ${stillPresent.map((t) => `· ${esc(t)}`).join('<br>')}
      </div>
      <div style="margin-top:7px;color:#94a3b8;font-size:11px;line-height:1.55;">
        글자를 바꾸는 것으로는 풀리지 않는 것들입니다 — 근거 조항처럼 <b style="color:#cbd5f5;">없는 사실을 지어낼 수 없거나</b>,
        구조를 손봐야 하는 지적입니다. 직접 고치시거나, 그 주장을 빼는 편이 낫습니다.
        <b style="color:#cbd5f5;">다음 비평에도 그대로 나옵니다.</b>
      </div>
    </div>` : '';

  const skippedRows = skipped.length ? `
    <div style="margin-top:14px;color:#94a3b8;font-size:12px;font-weight:700;">손대지 않은 것 ${skipped.length}건 (이유는 각 줄에)</div>
    <div style="color:#7c8aa5;font-size:11.5px;line-height:1.7;margin-top:5px;">
      ${skipped.map((line) => `· ${esc(line)}`).join('<br>')}
    </div>
    <div style="margin-top:7px;color:#7c8aa5;font-size:11px;line-height:1.55;">
      "2회 시도"는 규칙(이미지·링크·소제목·분량 유지)을 지키게 두 번 시켰는데도 어겨서 원본을 지킨 것입니다.
      버튼을 가리키는 줄은 <b style="color:#cbd5f5;">API 를 부르지 않고</b> 그 버튼으로 고치라는 안내입니다.
    </div>` : '';

  return `
    <div style="padding:16px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);border-radius:12px;margin-bottom:16px;">
      <div style="color:#bbf7d0;font-weight:800;font-size:14px;">${editorMode
        ? `✅ ${revised.length}개 구간을 고쳐 편집기에 실었습니다`
        : `✅ ${revised.length}개 구간을 고쳐 같은 주소에 반영했습니다`}</div>
      <div style="color:#94a3b8;font-size:12px;margin-top:6px;line-height:1.6;">
        고른 지적 ${picked.length}건 · 본문 ${before}자 → ${after}자 (${delta >= 0 ? '+' : ''}${delta})<br>
        ${editorMode
          ? '<b style="color:#cbd5f5;">아직 발행되지 않았습니다.</b> 확인 뒤 저장 버튼을 눌러야 블로그에 올라갑니다.'
          : '주소와 제목은 그대로라 검색 색인이 유지됩니다.'}
      </div>
    </div>
    ${res?.convergence ? targetedSummary(res) : ''}
    ${rows}
    ${stillRows}
    ${skippedRows}
    <div style="margin-top:16px;padding:12px 14px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.25);border-radius:10px;color:#a5b4fc;font-size:11.5px;line-height:1.65;">
      ${res?.convergence
        ? '🕰️ 「다시 확인」은 AI 를 부르지 않고 <b>반드시 고칠 것만</b> 다시 잽니다 — 새 선택 항목을 찾지 않습니다. 글 전체를 다시 보려면 「전체 다시 비평」을 누르세요.'
        : `🕰️ 이번에 고친 항목은 기록해 뒀습니다. 다시 비평하면 각 지적 옆에
      <b>새 지적 / 지난번에도 / 고쳤는데 또 / 개선이 남긴 것</b> 중 하나가 붙어,
      그게 왜 지금 나왔는지 알 수 있습니다.`}
    </div>
  `;
}

/**
 * 비평 리포트를 띄운다.
 *
 * @param {object} critique - critique-published-post 핸들러 응답
 * @param {(issues:any[]) => Promise<any>} onApply - 고른 항목을 반영. **결과 객체를 돌려줘야 한다.**
 * @param {() => Promise<void>} [onRecritique] - 결과 화면에서 '다시 비평' 을 눌렀을 때
 * @param {{mode?: 'publish'|'editor'}} [opts]
 *   ✍️ v3.8.693 — **이 모달은 두 곳에서 쓰인다. 하는 일이 다르다.**
 *
 *   사장님: "수정발행이아니라 수정만하게하라니까?? 수정발행하기는 전부다 고치고나서
 *            내가 마지막에 누를꺼야"
 *
 *   publish(글목록 탭) : 고치고 **바로 그 글에 반영 발행**한다.
 *   editor(미리보기·수정): 편집기에 다시 실을 뿐이다. **발행은 저장 버튼이 한다.**
 *
 *   그런데 문구는 두 경우 모두 "수정발행" 이었고, 끝나면 "이미 블로그에 반영됐습니다"
 *   라고까지 말했다 — 편집기에서는 **사실이 아니다.** 모드에 따라 말을 바꾼다.
 */
export function showCritiqueModal(critique, onApply, onRecritique, opts = {}) {
  const editorMode = opts?.mode === 'editor';
  const applyVerb = editorMode ? '수정' : '수정발행';
  const existing = document.getElementById('postCritiqueModal');
  if (existing) existing.remove();

  const issues = Array.isArray(critique?.issues) ? critique.issues : [];
  const sections = Array.isArray(critique?.sections) ? critique.sections : [];
  const score = Number(critique?.score ?? 0);
  const round = Number(critique?.roundCount || 1);
  const resolvedCount = Number(critique?.resolvedCount || 0);

  const overlay = document.createElement('div');
  overlay.id = 'postCritiqueModal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483630;background:rgba(2,6,23,0.78);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:24px;';

  const clean = issues.length === 0;
  /**
   * 🩺 v3.8.750 — 「전체 다시 비평」은 **사람이 눌렀을 때만** AI 비평을 다시 돈다.
   * 그냥 다시 비평(다시 확인)은 반드시 고칠 것만 코드로 다시 잰다 — 새 선택 항목을 찾지 않는다.
   */
  const canFull = !!critique?.convergence && (typeof opts?.onFullRecritique === 'function' || typeof onRecritique === 'function');
  const fullButton = canFull
    ? '<button id="pcFull" title="AI 비평을 처음부터 다시 돌립니다 (API 호출)" style="padding:10px 14px;background:transparent;color:#94a3b8;border:1px solid #334155;border-radius:9px;font-weight:700;font-size:12px;cursor:pointer;">🔄 전체 다시 비평</button>'
    : '';
  const runFull = async () => {
    overlay.remove();
    try {
      await (typeof opts?.onFullRecritique === 'function' ? opts.onFullRecritique() : onRecritique({ full: true }));
    } catch { /* 실패는 호출한 쪽이 알린다 */ }
  };
  overlay.innerHTML = `
    <div style="width:min(760px,100%);max-height:88vh;display:flex;flex-direction:column;background:#0f172a;border:1px solid #334155;border-radius:18px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,0.55);">
      <div style="padding:20px 24px;border-bottom:1px solid #1e293b;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="font-size:22px;">🩺</div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:900;color:#f1f5f9;font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(critique?.title || '비평 결과')}</div>
            <div style="color:#94a3b8;font-size:12px;margin-top:3px;">${esc(critique?.summary || '')}${critique?.competitorCount ? ` · 경쟁글 ${critique.competitorCount}편 대조` : ' · 경쟁글 대조 없음'}${round > 1 ? ` · ${round}번째 비평` : ''}${resolvedCount ? ` · 이미 고친 ${resolvedCount}건 제외` : ''}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-size:26px;font-weight:900;color:${scoreColor(score)};line-height:1;">${score}</div>
            <div style="font-size:10.5px;color:#64748b;margin-top:2px;">점</div>
          </div>
        </div>
      </div>

      <div id="pcBody" style="flex:1;overflow-y:auto;padding:18px 24px;">
        ${clean
          ? (critique?.convergence
            ? `${convergenceBanner(critique.convergence)}${resolvedList(critique?.resolvedIssues)}`
            : `<div style="padding:26px;text-align:center;color:#bbf7d0;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);border-radius:12px;">✅ 고칠 점을 찾지 못했습니다.<div style="color:#94a3b8;font-size:12px;margin-top:8px;">${critique?.aiSkipped
              ? '게이트 진단을 전부 통과해 AI 비평은 부르지 않았습니다 — API 호출 0회.'
              : '게이트 진단과 AI 비평 모두 통과했습니다.'}</div></div>`)
          : critique?.convergence
            ? groupedIssues(critique, issues, sections)
            : `<div style="color:#94a3b8;font-size:12px;margin-bottom:12px;">고칠 항목만 체크하세요. <b style="color:#e2e8f0;">체크한 지적이 붙은 구간만</b> 다시 씁니다 — 나머지 구간·이미지·링크는 그대로 둡니다.</div>
             ${issues.map((issue, i) => issueCard(issue, i, sections)).join('')}`}
      </div>

      <div id="pcFooter" style="padding:16px 24px;border-top:1px solid #1e293b;display:flex;gap:10px;align-items:center;">
        <div id="pcHint" style="flex:1;color:#64748b;font-size:11.5px;line-height:1.5;">${editorMode ? '고른 항목만 고쳐 편집기에 다시 싣습니다. 발행은 저장 버튼으로 직접 하세요.' : '주소(URL)와 제목은 그대로라 검색 색인이 유지됩니다.'}</div>
        ${fullButton}
        <button id="pcCancel" style="padding:10px 18px;background:#1e293b;color:#cbd5f5;border:1px solid #334155;border-radius:9px;font-weight:700;font-size:13px;cursor:pointer;">닫기</button>
        ${clean ? '' : `<button id="pcApply" style="padding:10px 20px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;border-radius:9px;font-weight:800;font-size:13px;cursor:pointer;">✍️ 선택한 항목 ${applyVerb}</button>`}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('#pcCancel')?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('#pcFull')?.addEventListener('click', runFull);

  const applyBtn = overlay.querySelector('#pcApply');
  const hint = overlay.querySelector('#pcHint');
  const selected = () => [...overlay.querySelectorAll('.pcIssue')]
    .filter((box) => box.checked)
    .map((box) => issues[Number(box.getAttribute('data-index'))])
    .filter(Boolean);

  const syncButton = () => {
    if (!applyBtn) return;
    const n = selected().length;
    applyBtn.textContent = n ? `✍️ ${n}건 ${applyVerb}` : '✍️ 항목을 골라주세요';
    applyBtn.disabled = n === 0;
    applyBtn.style.opacity = n === 0 ? '0.5' : '1';
    applyBtn.style.cursor = n === 0 ? 'not-allowed' : 'pointer';
  };
  overlay.querySelectorAll('.pcIssue').forEach((box) => box.addEventListener('change', syncButton));
  syncButton();

  applyBtn?.addEventListener('click', async () => {
    const picked = selected();
    if (picked.length === 0) return;

    applyBtn.disabled = true;
    applyBtn.style.opacity = '0.6';
    applyBtn.textContent = '✍️ 고쳐 쓰는 중… (몇 분 걸립니다)';
    if (hint) {
      hint.textContent = critique?.convergence
        ? '지적된 문단만 고칩니다. 규칙을 어기거나 새 결함을 만든 문단은 원문을 그대로 둡니다.'
        : '문제 구간만 다시 씁니다. 규칙을 어긴 구간은 원본을 그대로 둡니다.';
    }

    try {
      const res = await onApply(picked);

      // 결과 화면으로 갈아끼운다 — 닫지 않는다. 무엇이 바뀌었는지 보고 나가셔야 한다.
      const body = overlay.querySelector('#pcBody');
      const footer = overlay.querySelector('#pcFooter');
      if (body) body.innerHTML = resultView(res || {}, picked, editorMode);
      if (footer) {
        footer.innerHTML = `
          <div style="flex:1;color:#64748b;font-size:11.5px;line-height:1.5;">${editorMode ? '편집기에 반영했습니다. 확인 뒤 저장 버튼으로 발행하세요.' : '고친 내용은 이미 블로그에 반영됐습니다.'}</div>
          ${canFull ? fullButton : ''}
          ${onRecritique ? `<button id="pcAgain" style="padding:10px 18px;background:#1e293b;color:#cbd5f5;border:1px solid #334155;border-radius:9px;font-weight:700;font-size:13px;cursor:pointer;">${res?.convergence ? '🩺 다시 확인 (AI 0회)' : '🩺 다시 비평'}</button>` : ''}
          <button id="pcDone" style="padding:10px 20px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;border-radius:9px;font-weight:800;font-size:13px;cursor:pointer;">닫기</button>`;
        footer.querySelector('#pcDone')?.addEventListener('click', close);
        footer.querySelector('#pcFull')?.addEventListener('click', runFull);
        footer.querySelector('#pcAgain')?.addEventListener('click', async () => {
          close();
          try { await onRecritique(); } catch { /* 실패는 호출한 쪽이 알린다 */ }
        });
      }
    } catch (err) {
      if (hint) hint.innerHTML = `<span style="color:#fca5a5;">❌ ${esc(err?.message || err)}</span>`;
      applyBtn.disabled = false;
      applyBtn.style.opacity = '1';
      syncButton();
    }
  });
}

window.showCritiqueModal = showCritiqueModal;
