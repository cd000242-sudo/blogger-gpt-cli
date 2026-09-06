// 📋 v3.8.683 — 붙여넣기로 편집기 열기.
// 사장님: "수동으로 LLM 으로 생성한 글이나 HTML 변환한 코드를 넣고 미리보기로 보면서 수정도 가능하며
//          그대로 이미지도 추가해서 넣고 발행이 가능하게."
// 마크다운·일반 텍스트·HTML 아무거나 붙여 넣으면 앱 서식으로 바꿔(normalize-editor-paste) 편집기에 싣는다.

let overlay = null;

function ensurePasteModal() {
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'vePasteOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(2,6,23,0.72);display:none;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="width:min(900px,94vw);background:#0f172a;border:1px solid #334155;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,0.5);display:flex;flex-direction:column;gap:10px;padding:16px 18px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <div style="color:#e2e8f0;font-weight:800;font-size:15px;">📋 글 붙여넣기 → 편집기</div>
        <button id="vePasteClose" style="background:transparent;border:1px solid #475569;color:#94a3b8;border-radius:8px;padding:6px 10px;cursor:pointer;">✕ 닫기</button>
      </div>
      <div style="color:#94a3b8;font-size:12px;line-height:1.6;">
        ChatGPT·클로드·제미나이 등에서 만든 글을 그대로 붙여 넣으세요. <b>마크다운(# 제목, - 목록, | 표 |)</b>, 일반 텍스트, HTML 전부 됩니다.
        첫 줄의 <code># 제목</code> 이나 <code>&lt;h1&gt;</code> 은 글 제목이 됩니다. 편집기에서 고치고, 이미지를 넣고, 발행할 곳을 골라 발행하세요.
      </div>
      <input id="vePasteTitle" type="text" placeholder="제목 (비우면 붙여 넣은 글의 첫 제목을 씁니다)" style="padding:9px 12px;border:1px solid #475569;border-radius:9px;background:#020617;color:#e2e8f0;font-size:14px;" />
      <textarea id="vePasteText" placeholder="여기에 붙여 넣기…" style="min-height:44vh;padding:12px;border:1px solid #475569;border-radius:9px;background:#020617;color:#e2e8f0;font-size:13px;line-height:1.6;font-family:ui-monospace,Consolas,monospace;resize:vertical;"></textarea>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <span id="vePasteStatus" style="color:#94a3b8;font-size:12px;"></span>
        <button id="vePasteOpen" style="padding:10px 18px;border:none;border-radius:9px;font-weight:800;cursor:pointer;background:linear-gradient(135deg,#10b981,#059669);color:#fff;">✏️ 편집기로 열기</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#vePasteClose').addEventListener('click', () => { overlay.style.display = 'none'; });
  overlay.querySelector('#vePasteOpen').addEventListener('click', async () => {
    const text = overlay.querySelector('#vePasteText').value || '';
    const status = overlay.querySelector('#vePasteStatus');
    if (text.trim().length < 50) { status.textContent = '내용이 너무 짧습니다 (50자 이상).'; return; }
    status.textContent = '서식으로 바꾸는 중…';
    try {
      const res = await window.electronAPI.invoke('normalize-editor-paste', { text });
      if (!res?.ok) throw new Error(res?.error || '알 수 없는 오류');
      const title = (overlay.querySelector('#vePasteTitle').value || '').trim() || res.title || '';
      overlay.style.display = 'none';
      await window.openVisualEditor({ kind: 'paste', html: res.html, title });
    } catch (err) {
      status.textContent = '❌ ' + (err?.message || err);
    }
  });
  return overlay;
}

export function openPasteEditor() {
  const el = ensurePasteModal();
  el.querySelector('#vePasteStatus').textContent = '';
  el.style.display = 'flex';
  setTimeout(() => el.querySelector('#vePasteText')?.focus(), 50);
}
