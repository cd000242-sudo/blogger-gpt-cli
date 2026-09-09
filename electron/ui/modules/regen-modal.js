/**
 * 🔄 재생성 모달 (v3.8.710)
 *
 * 사장님: "글 다시생성하기버튼누르면 재생성 모달이뜨면좋겠는데"
 *
 * 그동안 [🔄 글 다시 생성]은 브라우저 confirm() 한 줄이었다 — 무엇이 다시
 * 만들어지는지, 어떤 엔진으로 만드는지 고를 자리가 없었다. 이 모달이 그 자리다.
 *
 * 발행글 목록 카드와 비주얼 편집기 **두 곳이 같은 모달을 쓴다** — 확인 문구를
 * 두 벌로 적으면 한쪽만 고쳐지고 어긋난다(v3.8.603 때 같은 이유로 채널을 합쳤다).
 *
 * 엔진 선택지는 본 화면 셀렉트(generationEngine·h2ImageSource)를 복제한다.
 * 목록을 여기 다시 적으면 본 화면에 엔진이 추가될 때마다 이쪽만 뒤처진다.
 * 원본이 아직 없으면 칸을 숨긴다 — 유령 기본값을 payload 에 싣지 않는다.
 */

function cloneOptionsFrom(sourceId, target) {
  const source = document.getElementById(sourceId);
  if (!source || !target || source.options.length === 0) return false;
  target.innerHTML = '';
  for (const opt of source.options) {
    const copy = document.createElement('option');
    copy.value = opt.value;
    copy.textContent = opt.textContent;
    copy.disabled = opt.disabled;
    target.appendChild(copy);
  }
  target.value = source.value;   // 본 화면에서 고른 것으로 시작한다
  return true;
}

const FIELD = 'width:100%;padding:9px 10px;border:1px solid #475569;border-radius:8px;background:#0f172a;color:#e2e8f0;font-size:13px;';

/**
 * 재생성 모달을 띄운다.
 *
 * @param {object} opts
 * @param {string} opts.title            다시 만들 글의 제목 (표시용)
 * @param {'article'|'images'} opts.mode 열 때 선택돼 있을 모드
 * @param {string} [opts.extraNote]      호출한 화면만의 주의 문구 (편집기: "편집 중이던 내용은 저장되지 않습니다")
 * @param {{textEngine?: string, imageEngine?: string}} [opts.defaults] 엔진 초기값 (편집기 툴바에서 이미 고른 것)
 * @returns {Promise<{mode: 'article'|'images', textEngine: string, imageEngine: string} | null>} 취소하면 null
 */
export function openRegenModal(opts = {}) {
  return new Promise((resolve) => {
    document.getElementById('regenModalOverlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'regenModalOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(2,6,23,.72);display:flex;align-items:center;justify-content:center;padding:20px;';

    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
    ));

    overlay.innerHTML = `
      <div id="regenModalCard" style="width:min(520px,94vw);background:#1e293b;border:1px solid #334155;border-radius:14px;padding:22px 24px;box-shadow:0 20px 60px rgba(0,0,0,.5);">
        <div style="color:#f1f5f9;font-size:16px;font-weight:800;">🔄 글 다시 생성</div>
        <div style="margin-top:6px;color:#94a3b8;font-size:12px;line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(opts.title)}">
          "${esc(opts.title || '(제목 없음)')}"
        </div>

        <div style="margin-top:16px;display:flex;flex-direction:column;gap:8px;">
          <label style="display:flex;align-items:flex-start;gap:10px;padding:11px 12px;border:1px solid #334155;border-radius:10px;cursor:pointer;background:#0f172a;">
            <input type="radio" name="regenModalMode" value="article" style="accent-color:#10b981;margin-top:2px;">
            <span>
              <span style="display:block;color:#e2e8f0;font-size:13px;font-weight:800;">🔄 본문 전체 다시 생성</span>
              <span style="display:block;color:#94a3b8;font-size:11px;margin-top:2px;">본문을 통째로 새로 만들어 덮어씁니다. 지금 본문은 사라집니다.</span>
            </span>
          </label>
          <label style="display:flex;align-items:flex-start;gap:10px;padding:11px 12px;border:1px solid #334155;border-radius:10px;cursor:pointer;background:#0f172a;">
            <input type="radio" name="regenModalMode" value="images" style="accent-color:#fbbf24;margin-top:2px;">
            <span>
              <span style="display:block;color:#e2e8f0;font-size:13px;font-weight:800;">🖼️ 이미지만 다시 생성</span>
              <span style="display:block;color:#94a3b8;font-size:11px;margin-top:2px;">글자는 그대로 두고 이 글의 AI 이미지를 모두 다시 만듭니다.</span>
            </span>
          </label>
        </div>

        <div id="regenModalEngines" style="display:none;margin-top:14px;gap:10px;">
          <div id="regenModalTextWrap" style="flex:1;display:none;">
            <div style="color:#94a3b8;font-size:11px;font-weight:700;margin-bottom:4px;">글 엔진</div>
            <select id="regenModalTextEngine" style="${FIELD}"></select>
          </div>
          <div id="regenModalImageWrap" style="flex:1;display:none;">
            <div style="color:#94a3b8;font-size:11px;font-weight:700;margin-bottom:4px;">이미지 엔진</div>
            <select id="regenModalImageEngine" style="${FIELD}"></select>
          </div>
        </div>

        <div style="margin-top:14px;padding:11px 13px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);border-radius:10px;color:#a7f3d0;font-size:11.5px;line-height:1.7;">
          · 주소(URL)와 제목은 그대로라 검색 색인이 유지됩니다.<br>
          · 새로 만든 것이 지금보다 나쁘면 덮지 않고 멈춥니다.<br>
          · 몇 분 걸립니다.${opts.extraNote ? `<br>· ${esc(opts.extraNote)}` : ''}
        </div>

        <div style="margin-top:18px;display:flex;justify-content:flex-end;gap:8px;">
          <button id="regenModalCancel" style="padding:9px 16px;border:1px solid #475569;border-radius:9px;background:transparent;color:#94a3b8;font-size:13px;cursor:pointer;">취소</button>
          <button id="regenModalStart" style="padding:9px 18px;border:0;border-radius:9px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 2px 8px rgba(16,185,129,.4);">다시 생성 시작</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const radios = overlay.querySelectorAll('input[name="regenModalMode"]');
    const initial = opts.mode === 'images' ? 'images' : 'article';
    radios.forEach((r) => { r.checked = r.value === initial; });

    // 엔진 셀렉트 — 본 화면에서 복제. 못 베끼면 칸째 숨긴다 (유령 기본값 방지)
    const textSel = overlay.querySelector('#regenModalTextEngine');
    const imageSel = overlay.querySelector('#regenModalImageEngine');
    const okText = cloneOptionsFrom('generationEngine', textSel);
    const okImage = cloneOptionsFrom('h2ImageSource', imageSel);
    if (okText && opts.defaults?.textEngine) textSel.value = opts.defaults.textEngine;
    if (okImage && opts.defaults?.imageEngine) imageSel.value = opts.defaults.imageEngine;
    overlay.querySelector('#regenModalTextWrap').style.display = okText ? 'block' : 'none';
    overlay.querySelector('#regenModalImageWrap').style.display = okImage ? 'block' : 'none';
    overlay.querySelector('#regenModalEngines').style.display = (okText || okImage) ? 'flex' : 'none';

    // 이미지만 모드에서 글 엔진은 쓰이지 않는다 — 잠가서 헛기대를 막는다
    const syncEngineLock = () => {
      const mode = overlay.querySelector('input[name="regenModalMode"]:checked')?.value || 'article';
      if (textSel) {
        textSel.disabled = mode === 'images';
        textSel.style.opacity = mode === 'images' ? '.4' : '1';
      }
    };
    radios.forEach((r) => r.addEventListener('change', syncEngineLock));
    syncEngineLock();

    const close = (result) => {
      try { document.removeEventListener('keydown', onKey, true); } catch { /* 이미 없다 */ }
      overlay.remove();
      resolve(result);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(null); }
    };
    document.addEventListener('keydown', onKey, true);

    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(null); });
    overlay.querySelector('#regenModalCancel').addEventListener('click', () => close(null));
    overlay.querySelector('#regenModalStart').addEventListener('click', () => {
      const mode = overlay.querySelector('input[name="regenModalMode"]:checked')?.value === 'images' ? 'images' : 'article';
      close({
        mode,
        textEngine: (okText && mode !== 'images' && textSel.value) || '',
        imageEngine: (okImage && imageSel.value) || '',
      });
    });
  });
}

/** 모달에서 고른 엔진을 재생성 payload 에 실을 꼴로 바꾼다 — 비우면 아무것도 덮지 않는다 */
export function engineOverrides(choice) {
  return {
    ...(choice?.textEngine ? { generationEngine: choice.textEngine, provider: choice.textEngine } : {}),
    ...(choice?.imageEngine ? { h2ImageSource: choice.imageEngine, imageSource: choice.imageEngine } : {}),
  };
}

/* ────────────────────────────────────────────────────────────────
 * 🧾 재생성 진행 카드 (v3.8.711)
 *
 * 사장님: "다른작업도 가능하게 모달이 프로세서로 깔끔하게 뜨게해주세요"
 *
 * 다시 생성은 몇 분 걸린다. 그동안 화면을 붙들고 있으면 앱이 멈춘 것과 같다.
 * 그래서 시작하면 **오른쪽 아래에 작은 진행 카드**가 뜨고, 사장님은 다른 탭에서
 * 다른 일을 계속한다. 진행률은 메인이 보내는 [PROGRESS] N% 로그를 그대로 읽는다.
 *
 * 동시에 하나만 돈다 — 재생성 둘이 겹치면 로그 스트림이 섞여 어느 글의 진행률인지
 * 알 수 없고, 같은 글을 두 번 덮는 사고도 막아야 한다. 두 번째 클릭은 정중히 거절한다.
 * ──────────────────────────────────────────────────────────────── */

let activeRegenTask = null;

/** 지금 재생성이 돌고 있나 — 호출부가 버튼을 잠글지 판단할 때 쓴다 */
export function isRegenRunning() {
  return !!activeRegenTask;
}

function ensureTaskStack() {
  let stack = document.getElementById('regenTaskStack');
  if (stack) return stack;
  stack = document.createElement('div');
  stack.id = 'regenTaskStack';
  stack.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:100002;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
  document.body.appendChild(stack);
  if (!document.getElementById('regenTaskStyle')) {
    const style = document.createElement('style');
    style.id = 'regenTaskStyle';
    style.textContent = '@keyframes regenSpin{to{transform:rotate(360deg)}}'
      + '@keyframes regenSlideIn{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}';
    document.head.appendChild(style);
  }
  return stack;
}

/**
 * 진행 카드를 띄우고 조작 손잡이를 돌려준다.
 * 이미 하나가 돌고 있으면 null — 호출부는 시작하지 말아야 한다.
 *
 * @returns {{ done(msg: string): void, fail(msg: string): void } | null}
 */
export function startRegenTask({ title, mode } = {}) {
  if (activeRegenTask) return null;

  const stack = ensureTaskStack();
  const card = document.createElement('div');
  card.style.cssText = 'pointer-events:auto;width:320px;background:#1e293b;border:1px solid #334155;border-radius:12px;padding:13px 15px;box-shadow:0 10px 34px rgba(0,0,0,.45);animation:regenSlideIn .25s ease;';

  const icon = mode === 'images' ? '🖼️' : '🔄';
  const head = mode === 'images' ? '이미지 다시 생성 중' : '글 다시 생성 중';
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;">
      <span class="regenTaskSpinner" style="width:14px;height:14px;border:2px solid #334155;border-top-color:#10b981;border-radius:50%;animation:regenSpin .8s linear infinite;flex-shrink:0;"></span>
      <span class="regenTaskHead" style="color:#f1f5f9;font-size:13px;font-weight:800;">${icon} ${head}</span>
      <span class="regenTaskPct" style="margin-left:auto;color:#94a3b8;font-size:11px;font-weight:700;"></span>
      <button class="regenTaskStop" title="지금 진행 중인 다시 생성을 중지합니다 — 기존 글은 그대로 남습니다"
        style="padding:4px 10px;border:1px solid #7f1d1d;border-radius:7px;background:#450a0a;color:#fca5a5;font-size:11px;font-weight:800;cursor:pointer;flex-shrink:0;">⏹ 중지</button>
    </div>
    <div style="margin-top:5px;color:#94a3b8;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${String(title || '').replace(/"/g, '&quot;')}">"${String(title || '(제목 없음)').replace(/</g, '&lt;')}"</div>
    <div style="margin-top:9px;height:6px;background:#0f172a;border-radius:99px;overflow:hidden;">
      <!-- width 가 아니라 transform 으로 움직인다 — 레이아웃 재계산 없이 GPU 만 쓴다 (느린 PC 원칙) -->
      <div class="regenTaskBar" style="height:100%;width:100%;transform:scaleX(.04);transform-origin:left;background:linear-gradient(90deg,#10b981,#34d399);border-radius:99px;transition:transform .4s ease;"></div>
    </div>
    <div class="regenTaskLabel" style="margin-top:7px;color:#64748b;font-size:11px;min-height:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">준비하는 중… 다른 작업을 계속하셔도 됩니다.</div>
  `;
  stack.appendChild(card);

  const bar = card.querySelector('.regenTaskBar');
  const pct = card.querySelector('.regenTaskPct');
  const label = card.querySelector('.regenTaskLabel');
  let lastPercent = 0;

  /**
   * ⏹ v3.8.711 — 중지 버튼.
   * 사장님: "추론중인데 중지가안되냐" — 카드에 중지 손잡이가 없었고,
   * 백엔드도 beginRun() 미등록이라 cancel-task 가 무시됐다(main.ts 쪽 수리와 한 쌍).
   */
  const stopBtn = card.querySelector('.regenTaskStop');
  stopBtn?.addEventListener('click', async () => {
    stopBtn.disabled = true;
    stopBtn.style.opacity = '.5';
    stopBtn.textContent = '중지 요청…';
    if (label) label.textContent = '중지 요청을 보냈습니다 — 진행 중인 호출에서 빠져나오는 중…';
    try { await window.electronAPI?.invoke?.('cancel-task'); } catch { /* 실패해도 아래 결과 경로가 말해 준다 */ }
  });

  // 메인이 보내는 [PROGRESS] N% - 설명 줄을 그대로 읽는다 (재생성은 한 번에 하나라 섞이지 않는다)
  const unsub = window.electronAPI?.onLog?.((line) => {
    const m = String(line || '').match(/\[PROGRESS\]\s*(\d{1,3})%\s*-?\s*(.*)/);
    if (!m) return;
    const p = Math.min(99, Math.max(lastPercent, Number(m[1]) || 0));   // 역행·성급한 100% 방지
    lastPercent = p;
    if (bar) bar.style.transform = `scaleX(${Math.max(4, p) / 100})`;
    if (pct) pct.textContent = `${p}%`;
    if (label && m[2]) label.textContent = m[2].trim();
  }) || null;

  // kind: 'ok' 완료 · 'fail' 실패 · 'stopped' 사용자 중지 — 중지를 실패라고 하면 사람이 놀란다
  const finish = (kind, msg, autoCloseMs) => {
    try { unsub?.(); } catch { /* 이미 끊겼다 */ }
    activeRegenTask = null;
    const spinner = card.querySelector('.regenTaskSpinner');
    const headEl = card.querySelector('.regenTaskHead');
    if (spinner) spinner.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'none';
    const palette = {
      ok: { bar: '#10b981', head: '✅ 다시 생성 완료', color: '#a7f3d0', text: '#94a3b8' },
      fail: { bar: '#ef4444', head: '❌ 다시 생성 실패', color: '#fca5a5', text: '#fca5a5' },
      stopped: { bar: '#64748b', head: '⏹ 중지됨', color: '#cbd5e1', text: '#94a3b8' },
    }[kind];
    if (bar) { bar.style.transform = 'scaleX(1)'; bar.style.background = palette.bar; }
    if (pct) pct.textContent = kind === 'ok' ? '100%' : '';
    if (headEl) { headEl.textContent = palette.head; headEl.style.color = palette.color; }
    if (label) { label.textContent = msg || ''; label.title = msg || ''; label.style.color = palette.text; }
    card.style.cursor = 'pointer';
    card.title = '클릭하면 닫힙니다';
    card.addEventListener('click', () => card.remove());
    // 실패는 눈으로 볼 때까지 남긴다 — 완료·중지만 알아서 사라진다
    if (autoCloseMs) setTimeout(() => card.remove(), autoCloseMs);
  };

  activeRegenTask = {
    done: (msg) => finish('ok', msg, 8000),
    fail: (msg) => finish('fail', msg, 0),
    stop: (msg) => finish('stopped', msg, 8000),
  };
  return activeRegenTask;
}
