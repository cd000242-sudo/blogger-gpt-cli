// 🔧 cta-audit-modal.js — 발행된 글의 CTA 를 한 번에 점검하고, 고를 것만 교체한다. (v3.8.696)
//
// 사장님: "일괄 점검 교체 도구 만들고"
//
// v3.8.688~695 에서 고친 것은 전부 **앞으로 만들어질 CTA** 다. 이미 나가 있는 글은 그대로다.
// 실측(2026-09-07, 183편 · CTA 113개): 죽은 링크 14개 · 기관 홈/문서파일 48개.
// 글마다 편집기를 열면 100편이 넘는다.
//
// 점검은 AI 를 부르지 않는다(페이지를 열어 분류만 — 비용 0).
// 교체는 **고른 것만**, 그리고 **주소만** 바꾼다. 버튼 문구·본문은 건드리지 않는다.
//
// ⚠️ 점검 채널(cta-audit-run)은 v3.8.572 에 이미 있었는데 **버튼이 없어 아무도 못 썼다.**

const VERDICT = {
  dead: { text: '죽은 링크', color: '#fca5a5', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)' },
  document: { text: '문서 파일', color: '#fcd34d', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.32)' },
  home: { text: '기관 홈', color: '#93c5fd', bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.30)' },
};

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * 고칠 값어치가 있는 것만 추린다.
 * `action` 은 이미 제 일을 하고 있으므로 건드리지 않는다 — 멀쩡한 것을 바꾸면 나빠질 위험만 있다.
 * `unknown` 도 뺀다: 페이지를 못 읽었을 뿐 죽었다는 뜻이 아니다
 * (기관 사이트는 인증서 문제로 node 에서만 실패하는 곳이 많다 — 실측: efine.go.kr).
 */
export function pickRepairTargets(reports) {
  const out = [];
  for (const report of reports || []) {
    for (const check of report.checks || []) {
      if (!VERDICT[check.verdict]) continue;
      out.push({
        postId: report.postId, title: report.title, link: report.link,
        url: check.url, verdict: check.verdict, reason: check.reason,
      });
    }
  }
  const order = { dead: 0, document: 1, home: 2 };
  return out.sort((a, b) => (order[a.verdict] ?? 9) - (order[b.verdict] ?? 9));
}

function targetRow(target, index) {
  const tone = VERDICT[target.verdict];
  // 죽은 링크만 미리 켜 둔다 — 전부 켜 두면 사장님이 하나씩 끄게 된다
  const checked = target.verdict === 'dead' ? 'checked' : '';
  return `
    <label style="display:flex;gap:11px;align-items:flex-start;padding:12px 13px;background:${tone.bg};border:1px solid ${tone.border};border-radius:10px;margin-bottom:8px;cursor:pointer;">
      <input type="checkbox" class="ppCtaPick" data-index="${index}" ${checked}
        style="margin-top:3px;width:16px;height:16px;accent-color:#6366f1;cursor:pointer;flex-shrink:0;">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-bottom:4px;">
          <span style="padding:2px 8px;border-radius:999px;background:rgba(15,23,42,0.55);color:${tone.color};font-size:10.5px;font-weight:800;">${tone.text}</span>
          <span style="color:#94a3b8;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:420px;">${esc(target.title)}</span>
        </div>
        <div style="color:#7c8aa5;font-size:11px;word-break:break-all;line-height:1.5;">${esc(target.url)}</div>
        ${target.reason ? `<div style="color:#64748b;font-size:11px;margin-top:3px;">${esc(target.reason)}</div>` : ''}
      </div>
    </label>`;
}

/** 결과를 모달에 그대로 보여준다 — 닫고 한 줄만 남기면 무엇이 바뀌었는지 알 수 없다 */
function renderResult(overlay, res, onDone) {
  const ok = (res.results || []).filter((r) => r.ok);
  const failed = (res.results || []).filter((r) => !r.ok);

  const okRows = ok.map((r) => `
    <div style="padding:12px 13px;background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.28);border-radius:10px;margin-bottom:8px;">
      <div style="font-weight:800;color:#e2e8f0;font-size:13px;">${esc(r.title)}</div>
      ${(r.swaps || []).map((s) => `
        <div style="color:#7c8aa5;font-size:11px;margin-top:5px;word-break:break-all;line-height:1.55;">
          <span style="color:#fca5a5;">${esc(s.from)}</span><br>→ <span style="color:#86efac;">${esc(s.to)}</span>
        </div>`).join('')}
    </div>`).join('');

  const failRows = failed.length ? `
    <div style="margin-top:14px;color:#94a3b8;font-size:12px;font-weight:700;">그대로 둔 글 ${failed.length}편</div>
    <div style="color:#7c8aa5;font-size:11.5px;line-height:1.7;margin-top:5px;">
      ${failed.map((r) => `· ${esc(r.title)} — ${esc(r.reason || '')}`).join('<br>')}
    </div>
    <div style="margin-top:7px;color:#7c8aa5;font-size:11px;line-height:1.55;">
      대체 목적지가 게이트를 통과하지 못하면 <b style="color:#cbd5f5;">기존 버튼을 그대로 둡니다.</b>
      나쁜 주소를 다른 나쁜 주소로 바꾸지 않습니다.
    </div>` : '';

  const body = overlay.querySelector('#ppCtaBody');
  const footer = overlay.querySelector('#ppCtaFooter');
  if (body) {
    body.innerHTML = `
      <div style="padding:15px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.3);border-radius:12px;margin-bottom:16px;">
        <div style="color:#bbf7d0;font-weight:800;font-size:14px;">
          ${res.dryRun
            ? '🧪 시험 실행 — 발행하지 않았습니다'
            : `✅ ${res.fixed}/${res.posts}편의 CTA 주소를 바꿨습니다`}
        </div>
        <div style="color:#94a3b8;font-size:12px;margin-top:6px;line-height:1.6;">
          ${res.dryRun
            ? '아래가 실제로 바뀔 내용입니다. 맞으면 [고치기] 를 누르세요.'
            : '주소만 바꿨으므로 제목·본문·검색 색인은 그대로입니다.'}
        </div>
      </div>
      ${okRows}${failRows}`;
  }
  if (footer) {
    footer.innerHTML = '<div style="flex:1;"></div>'
      + '<button id="ppCtaDone" style="padding:10px 20px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;border-radius:9px;font-weight:900;font-size:13px;cursor:pointer;">닫기</button>';
    footer.querySelector('#ppCtaDone').addEventListener('click', () => {
      overlay.remove();
      if (!res.dryRun) onDone?.();
    });
  }
}

/**
 * 점검 결과 모달.
 * @param {object} audit - cta-audit-run 응답
 * @param {{platform: string, onRepaired?: () => void}} opts
 */
export function showCtaAuditModal(audit, opts = {}) {
  const prev = document.getElementById('ppCtaAuditModal');
  if (prev) prev.remove();

  const targets = pickRepairTargets(audit.reports || []);
  const s = audit.summary || {};

  const overlay = document.createElement('div');
  overlay.id = 'ppCtaAuditModal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99990;background:rgba(2,6,23,.78);'
    + 'display:flex;align-items:center;justify-content:center;padding:24px;';
  overlay.innerHTML = `
    <div style="width:min(96vw,860px);max-height:88vh;display:flex;flex-direction:column;background:#0f172a;border:1px solid #1e293b;border-radius:16px;overflow:hidden;">
      <div style="padding:18px 24px;border-bottom:1px solid #1e293b;">
        <div style="font-size:17px;font-weight:900;color:#f1f5f9;">🔧 CTA 일괄 점검 결과</div>
        <div style="color:#94a3b8;font-size:12.5px;margin-top:6px;line-height:1.6;">
          글 ${s.posts || 0}편 · CTA ${s.links || 0}개 —
          <b style="color:#fca5a5;">죽은 링크 ${s.dead || 0}</b> ·
          <b style="color:#fcd34d;">문서 ${s.document || 0}</b> ·
          <b style="color:#93c5fd;">기관 홈 ${s.home || 0}</b> ·
          <b style="color:#86efac;">정상 ${s.action || 0}</b> ·
          판정불가 ${s.unknown || 0} · CTA 없음 ${s.noCta || 0}
        </div>
      </div>
      <div id="ppCtaBody" style="flex:1;overflow-y:auto;padding:18px 24px;">
        ${targets.length
          ? `<div style="color:#cbd5e1;font-size:12px;margin-bottom:12px;line-height:1.6;">
               고칠 것을 고르세요. <b style="color:#f1f5f9;">주소만</b> 새로 찾아 갈아끼웁니다 —
               버튼 문구·본문은 건드리지 않습니다.
               대체 목적지를 못 찾으면 그 글은 <b style="color:#f1f5f9;">건너뜁니다</b>(기존 버튼 유지).
             </div>${targets.map(targetRow).join('')}`
          : '<div style="color:#86efac;font-size:14px;font-weight:800;padding:24px 0;text-align:center;">고칠 CTA 가 없습니다 — 전부 제 일을 하고 있습니다.</div>'}
      </div>
      <div id="ppCtaFooter" style="padding:15px 24px;border-top:1px solid #1e293b;display:flex;gap:10px;align-items:center;">
        <div id="ppCtaHint" style="flex:1;color:#64748b;font-size:11.5px;line-height:1.5;">주소만 바꾸므로 검색 색인과 본문은 그대로입니다.</div>
        <button id="ppCtaClose" style="padding:10px 18px;background:#1e293b;color:#cbd5f5;border:1px solid #334155;border-radius:9px;font-weight:700;font-size:13px;cursor:pointer;">닫기</button>
        ${targets.length ? '<button id="ppCtaDry" style="padding:10px 16px;background:#334155;color:#e2e8f0;border:none;border-radius:9px;font-weight:800;font-size:13px;cursor:pointer;" title="발행하지 않고 무엇으로 바뀔지만 봅니다">🧪 시험 실행</button>' : ''}
        ${targets.length ? '<button id="ppCtaFix" style="padding:10px 20px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;border-radius:9px;font-weight:900;font-size:13px;cursor:pointer;">🔧 고르기</button>' : ''}
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('#ppCtaClose').addEventListener('click', close);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });

  const selected = () => [...overlay.querySelectorAll('.ppCtaPick')]
    .filter((box) => box.checked)
    .map((box) => targets[Number(box.getAttribute('data-index'))])
    .filter(Boolean);

  const fixBtn = overlay.querySelector('#ppCtaFix');
  const dryBtn = overlay.querySelector('#ppCtaDry');
  const hint = overlay.querySelector('#ppCtaHint');
  const sync = () => {
    const n = selected().length;
    if (fixBtn) fixBtn.textContent = n ? `🔧 ${n}개 고치기` : '🔧 항목을 골라주세요';
  };
  overlay.querySelectorAll('.ppCtaPick').forEach((box) => box.addEventListener('change', sync));
  sync();

  const run = async (dryRun) => {
    const picked = selected();
    if (!picked.length) return;
    [fixBtn, dryBtn].forEach((b) => { if (b) { b.disabled = true; b.style.opacity = '0.6'; } });
    if (fixBtn) fixBtn.textContent = dryRun ? '🧪 확인 중…' : '🔧 고치는 중… (몇 분)';
    if (hint) hint.textContent = '글마다 새 목적지를 찾아 게이트로 검산합니다. 창을 닫지 마세요.';
    try {
      const res = await window.electronAPI.invoke('cta-bulk-repair', {
        targets: picked, platform: opts.platform || 'wordpress', dryRun,
      });
      if (!res?.ok) throw new Error(res?.error || '알 수 없는 오류');
      renderResult(overlay, res, opts.onRepaired);
    } catch (err) {
      if (hint) hint.innerHTML = `<span style="color:#fca5a5;">❌ ${esc(err?.message || err)}</span>`;
      [fixBtn, dryBtn].forEach((b) => { if (b) { b.disabled = false; b.style.opacity = '1'; } });
      sync();
    }
  };
  fixBtn?.addEventListener('click', () => run(false));
  dryBtn?.addEventListener('click', () => run(true));
}
