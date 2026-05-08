// leword-launcher.js — 황금키워드(LEWORD) 외부 앱 런처 UI
//
// 사이드바 "황금키워드" 클릭 시 호출됨.
// 진행률 다이얼로그를 띄우고 메인 프로세스의 leword:launch IPC 결과를 받아 표시.

const PHASE_LABEL = {
  license: '라이선스 확인',
  release: '버전 확인',
  cache: '로컬 캐시 확인',
  download: '다운로드',
  verify: '무결성 검증',
  install: '설치',
  locate: '경로 추적',
  launch: '실행'
};

let dialogEl = null;

function ensureDialog() {
  if (dialogEl && document.body.contains(dialogEl)) return dialogEl;

  const overlay = document.createElement('div');
  overlay.id = 'lewordLauncherOverlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 2147483600;
    background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center;
  `;

  const box = document.createElement('div');
  box.style.cssText = `
    width: 460px; max-width: 92vw; padding: 28px;
    background: linear-gradient(160deg, #1e293b, #0f172a);
    border: 1px solid rgba(148, 163, 184, 0.25);
    border-radius: 16px; color: #f1f5f9;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
    font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
  `;

  box.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
      <div style="font-size:28px;">💎</div>
      <div>
        <div style="font-size:18px;font-weight:700;">LEWORD 황금키워드</div>
        <div id="lewordPhase" style="font-size:12px;color:#94a3b8;margin-top:2px;">준비 중...</div>
      </div>
    </div>
    <div style="background:rgba(15,23,42,0.6);border-radius:10px;height:14px;overflow:hidden;border:1px solid rgba(148,163,184,0.15);">
      <div id="lewordProgressFill" style="height:100%;width:0%;background:linear-gradient(90deg,#6366f1,#8b5cf6);transition:width 0.25s ease;"></div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px;color:#cbd5f5;">
      <span id="lewordMessage">초기화 중...</span>
      <span id="lewordPercent">0%</span>
    </div>
    <div id="lewordError" style="display:none;margin-top:14px;padding:10px 12px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.4);border-radius:8px;font-size:13px;color:#fecaca;"></div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px;">
      <button id="lewordCloseBtn" style="display:none;padding:8px 16px;background:rgba(148,163,184,0.15);color:#e2e8f0;border:1px solid rgba(148,163,184,0.3);border-radius:8px;cursor:pointer;font-weight:600;">닫기</button>
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  box.querySelector('#lewordCloseBtn').addEventListener('click', () => {
    overlay.remove();
    dialogEl = null;
  });

  dialogEl = overlay;
  return overlay;
}

function setProgress({ phase, percent, message }) {
  if (!dialogEl) return;
  const phaseEl = dialogEl.querySelector('#lewordPhase');
  const fillEl = dialogEl.querySelector('#lewordProgressFill');
  const pctEl = dialogEl.querySelector('#lewordPercent');
  const msgEl = dialogEl.querySelector('#lewordMessage');

  if (phaseEl) phaseEl.textContent = PHASE_LABEL[phase] || phase || '진행 중';
  if (fillEl) fillEl.style.width = `${Math.max(0, Math.min(100, Number(percent) || 0))}%`;
  if (pctEl) pctEl.textContent = `${Math.round(Number(percent) || 0)}%`;
  if (msgEl) msgEl.textContent = message || '';
}

function showError(text) {
  if (!dialogEl) return;
  const errEl = dialogEl.querySelector('#lewordError');
  const closeBtn = dialogEl.querySelector('#lewordCloseBtn');
  if (errEl) {
    errEl.textContent = text;
    errEl.style.display = 'block';
  }
  if (closeBtn) closeBtn.style.display = 'inline-block';
}

function showSuccess(version) {
  if (!dialogEl) return;
  setProgress({ phase: 'launch', percent: 100, message: `LEWORD ${version || ''} 실행됨` });
  const closeBtn = dialogEl.querySelector('#lewordCloseBtn');
  if (closeBtn) closeBtn.style.display = 'inline-block';
  setTimeout(() => {
    if (dialogEl && document.body.contains(dialogEl)) {
      dialogEl.remove();
      dialogEl = null;
    }
  }, 1200);
}

export async function runLewordLauncher() {
  const api = window.blogger || window.electronAPI;
  if (!api || !api.leword) {
    alert('LEWORD 런처 API를 찾을 수 없습니다. 앱을 재시작해주세요.');
    return;
  }

  ensureDialog();
  setProgress({ phase: 'license', percent: 0, message: '시작 중...' });

  const unsubscribe = api.leword.onProgress((payload) => setProgress(payload));

  try {
    const result = await api.leword.launch();
    if (result?.ok) {
      showSuccess(result.version);
    } else {
      showError(result?.error || 'LEWORD 실행에 실패했습니다.');
    }
  } catch (e) {
    showError(e?.message || String(e));
  } finally {
    if (typeof unsubscribe === 'function') unsubscribe();
  }
}

if (typeof window !== 'undefined') {
  window.runLewordLauncher = runLewordLauncher;
}
