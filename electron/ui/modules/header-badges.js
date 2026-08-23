// 🎫 헤더 배지 드롭다운 — 플랫폼·AI 모델을 배지에서 바로 바꾼다 (v3.8.534)
//
// 사장님 요구: "배찌에서 플랫폼이나 모델 변경가능하게. 배선도 정확하게 —
// 고쳤다고 들어가서 선택하고 발행했는데 변경 안 되어 있으면 곤란합니다."
//
// ## 배선의 진실 (실측 근거 — 이 파일을 고치기 전에 반드시 다시 확인할 것)
//   · 발행 payload 의 플랫폼: posting.js / publish-queue.js 가
//     input[name="platform"]:checked 를 **발행 순간에 직접** 읽는다.
//   · 발행 payload 의 모델: posting.js 가 input[name="primaryGeminiTextModel"]:checked 를
//     읽어 payload 에 싣고, main.ts(4610 부근)는 payload 값을 env 보다 우선한다.
//   → 따라서 **라디오에 쓰면 발행에 즉시 반영**된다. 배지는 그 라디오의 뷰다.
//   · 재시작 이후를 위해 save-env 로 부분 저장한다 — main 의 save-env 는
//     기존 .env 를 읽어 병합하고 빈 값은 건너뛰므로(실측) 다른 키를 못 지운다.
//     ⚠️ settings.js 의 전체 saveSettings() 는 여기서 절대 부르지 않는다 —
//     모달을 안 연 상태에선 다른 필드가 비어 있어 위험하다.
import { updatePlatformStatus } from './settings.js';
import { addLog, getStorageManager } from './core.js';

/**
 * v3.8.544 — .env 저장만으로는 화면도 재시작도 안 따라온다.
 *
 * settings.js 의 resolvePlatformValue(48~58줄) 실측: 저장된 bloggerSettings 값이 있으면
 * **.env 를 보지도 않고** 그걸 쓴다. 배지에서 .env 만 고치면
 *   · 방금 부른 updatePlatformStatus() 가 옛 값을 읽어 배지가 곧바로 되돌아가고
 *   · 재시작하면 선택 자체가 사라진다.
 * 그래서 저장 경로 두 곳(.env + bloggerSettings)에 같이 쓴다. 넘긴 키만 병합한다.
 */
async function mergeIntoLocalSettings(patch) {
  try {
    const storage = getStorageManager();
    const current = (await storage.get('bloggerSettings', true)) || {};
    await storage.set('bloggerSettings', { ...current, ...patch }, true);
  } catch (err) {
    console.warn('[HEADER-BADGE] bloggerSettings 병합 실패:', err);
  }
}

const PLATFORMS = [
  { value: 'blogger', label: 'Blogger', color: '#f97316' },
  { value: 'wordpress', label: 'WordPress', color: '#3b82f6' },
  { value: 'tistory', label: 'Tistory', color: '#14b8a6' },
];

/** saveSettings 와 같은 파생 규칙 — 모델 값에서 엔진을 얻는다 (여기만 다르면 오배선) */
function deriveEngine(m) {
  if (!m) return 'gemini';
  if (m.startsWith('gemini-')) return 'gemini';
  if (m.startsWith('openai-') || m.startsWith('gpt-') || /^o\d/i.test(m)) return 'openai';
  if (m.startsWith('claude-')) return 'claude';
  if (m === 'perplexity-sonar') return 'perplexity';
  return 'gemini';
}

function modelRadios() {
  return Array.from(document.querySelectorAll('input[name="primaryGeminiTextModel"]'));
}

/** 설정 모달 카드의 첫 번째 굵은 span 이 모델 이름이다 (마크업 실측) */
function modelLabel(radio) {
  const name = radio.closest('label')?.querySelector('span')?.textContent;
  return String(name || radio.value).replace(/\s+/g, ' ').trim();
}

export function initHeaderBadges() {
  const platformBadge = document.getElementById('platformStatus');
  const modelBadge = document.getElementById('aiModelStatus');
  if (!platformBadge || !modelBadge) {
    // 없는 자리에 조용히 붙지 않는다 (조용한 미배선 교훈)
    console.warn('[HEADER-BADGE] ⚠️ platformStatus / aiModelStatus 배지를 찾지 못했습니다');
    return;
  }
  if (platformBadge.dataset.hbReady) return;
  platformBadge.dataset.hbReady = '1';

  if (!document.getElementById('hbStyles')) {
    const st = document.createElement('style');
    st.id = 'hbStyles';
    st.textContent = `
      .header-badge.hb-click { cursor:pointer; position:relative; transition:filter .15s; }
      .header-badge.hb-click:hover { filter:brightness(1.18); }
      .header-badge.hb-click .hb-caret { font-size:9px; color:rgba(255,255,255,.55); margin-left:2px; }
      /* v3.8.535: absolute → fixed. .app-header 가 overflow-y:hidden 이라(배지 가로 스크롤용)
         상자 안 absolute 팝오버는 아래로 열리는 순간 잘려서 안 보였다 (사장님 실보고).
         fixed + 열 때 좌표 계산으로 상자 밖으로 탈출한다. 헤더는 sticky top 이라 좌표가 안정적이다.

         ⚠️ v3.8.544 — 그런데 fixed 만으로는 못 나간다. styles.css 실측:
           .app-header  { backdrop-filter: blur(10px) }   (753~768줄)
           .header-badge{ backdrop-filter: blur(10px) }   (802~808줄)
         backdrop-filter 가 none 이 아닌 요소는 **fixed 자손의 컨테이닝 블록**이 된다(CSS 규격).
         즉 팝오버를 배지 안에 두는 한 좌표 기준이 배지이고, 헤더 overflow:hidden 에 그대로 잘린다.
         v3.8.535 가 안 통한 이유가 이것 — 그래서 팝오버를 document.body 로 옮긴다(아래 wireBadge).
         body 에는 filter/transform 이 없으므로 그제서야 fixed 가 뷰포트 기준이 된다.

         ⚠️ v3.8.547 — body 로 옮긴 뒤에도 안 보였다(사장님 3번째 보고: "드래그바만 뜨고").
         fixed 는 조상 사슬 중 하나만 컨테이닝 블록을 만들어도 그 안에 갇히는 규칙이라,
         "어느 조상이 범인인지" 를 계속 쫓는 방식으론 또 샌다. 그래서 추측을 끝낸다 —
         popover(top layer)로 띄우면 브라우저가 문서 트리 밖 최상위 레이어에 그리므로
         조상의 overflow·filter·stacking context·z-index 가 **전부 무효**가 된다.
         (Electron 42 = Chromium 140, popover 정식 지원. 미지원 환경은 .open 클래스로 폴백.)
         UA 가 [popover] 에 inset:0; margin:auto 를 걸므로 여기서 되돌려야 좌표가 먹는다. */
      .hb-pop { position:fixed; z-index:2147483000; min-width:250px; max-height:340px; overflow-y:auto;
        background:#111a30; border:1px solid rgba(148,163,184,.3); border-radius:12px; padding:11px;
        box-shadow:0 16px 40px rgba(2,6,23,.6); display:none; text-align:left;
        margin:0; inset:auto; color:#cbd5e1; }
      .hb-pop.open { display:block; }
      .hb-pop:popover-open { display:block; }
      .hb-pop .hb-t { font-size:11px; font-weight:800; color:#94a3b8; margin-bottom:7px; }
      .hb-pop .hb-note { font-size:10.5px; color:#fbbf24; margin-bottom:7px; line-height:1.45; }
      .hb-opt { display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:8px; cursor:pointer;
        font-size:12.5px; font-weight:700; color:#cbd5e1; }
      .hb-opt:hover { background:rgba(99,102,241,.14); }
      .hb-opt.sel { background:rgba(99,102,241,.2); color:#c7d2fe; }
      .hb-opt .hb-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; background:rgba(148,163,184,.35); }
      .hb-opt.sel .hb-dot { background:#6366f1; }
      .hb-saved { font-size:10.5px; color:#6ee7b7; padding:6px 10px 2px; }
    `;
    document.head.appendChild(st);
  }

  wireBadge(platformBadge, buildPlatformPop);
  wireBadge(modelBadge, buildModelPop);

  document.addEventListener('click', (e) => {
    // v3.8.544: 팝오버가 body 로 나갔으므로 배지 밖 클릭 판정에 .hb-pop 도 포함해야 한다.
    // 안 그러면 팝오버 제목줄만 눌러도 닫힌다.
    if (!e.target.closest('.header-badge.hb-click') && !e.target.closest('.hb-pop')) {
      closeAllPops();
    }
  });
  /**
   * v3.8.547 — 스크롤·리사이즈에 '닫지' 않고 '따라가게' 바꾼다.
   * 이전 코드는 capture 로 문서 전체의 scroll 을 듣고 닫았다. 이 앱은 로그 패널이
   * 알아서 바닥으로 스크롤하므로, 배지를 누른 직후 로그 한 줄만 찍혀도 팝오버가
   * 그 자리에서 닫혔다 — "열리지도 않는다" 로 보이는 경로다.
   */
  window.addEventListener('resize', repositionOpenPops);
  document.addEventListener('scroll', repositionOpenPops, true);

  addLog('🎫 헤더 배지 드롭다운 준비 완료 (플랫폼·AI 모델 클릭으로 변경)', 'info');
}

function wireBadge(valueEl, build) {
  const badge = valueEl.closest('.header-badge') || valueEl.parentElement;
  if (!badge) return;
  badge.classList.add('hb-click');
  badge.title = '클릭해서 변경';
  if (!badge.querySelector('.hb-caret')) {
    const caret = document.createElement('span');
    caret.className = 'hb-caret';
    caret.textContent = '▾';
    badge.appendChild(caret);
  }
  const pop = document.createElement('div');
  pop.className = 'hb-pop';
  /**
   * v3.8.544 — 배지 안이 아니라 body 에 붙인다.
   * 배지·헤더가 backdrop-filter 를 갖고 있어서 배지 안에 두면 fixed 가 뷰포트 기준이 되지 않고
   * 배지 기준으로 잡힌 뒤 헤더 overflow 에 잘린다(v3.8.534/535 가 화면에 안 보였던 원인).
   */
  document.body.appendChild(pop);
  // v3.8.547: top layer 로 띄운다. manual 이라 바깥 클릭 판정은 기존 document 리스너가 그대로 한다.
  try { pop.setAttribute('popover', 'manual'); } catch { /* 미지원이면 .open 클래스 폴백 */ }
  pop.__hbBadge = badge;   // 스크롤 시 다시 좌표를 잡으려면 어느 배지의 팝오버인지 알아야 한다

  badge.addEventListener('click', (e) => {
    if (e.target.closest('.hb-opt')) return;
    const was = isPopOpen(pop);
    closeAllPops();
    if (!was) {
      build(pop);
      placePop(pop);
      openPop(pop);
    }
    e.stopPropagation();
  });
}

/** 팝오버 좌표: 배지 바로 아래, 오른쪽이 화면을 넘으면 안쪽으로 끌어온다 */
function placePop(pop) {
  const badge = pop.__hbBadge;
  if (!badge) return;
  const r = badge.getBoundingClientRect();
  pop.style.top = `${Math.round(r.bottom + 8)}px`;
  pop.style.left = `${Math.round(Math.max(8, Math.min(r.left, window.innerWidth - 270)))}px`;
}

function isPopOpen(pop) {
  if (pop.classList.contains('open')) return true;
  try { return pop.matches(':popover-open'); } catch { return false; }
}

function openPop(pop) {
  pop.classList.add('open');   // 폴백 경로(구형 렌더러)에서도 보이게
  try {
    if (typeof pop.showPopover === 'function' && !pop.matches(':popover-open')) pop.showPopover();
  } catch (err) {
    // top layer 승격 실패해도 .open 클래스로는 그려진다 — 조용히 죽이지 않고 남긴다
    console.warn('[HEADER-BADGE] showPopover 실패 — 클래스 폴백으로 표시합니다:', err);
  }
}

function repositionOpenPops() {
  document.querySelectorAll('.hb-pop').forEach((p) => { if (isPopOpen(p)) placePop(p); });
}

// ─── 플랫폼 ──────────────────────────────────────────────────

function currentPlatform() {
  const v = document.querySelector('input[name="platform"]:checked')?.value || 'blogger';
  return v === 'blogspot' ? 'blogger' : v;
}

function buildPlatformPop(pop) {
  const cur = currentPlatform();
  pop.innerHTML = `<div class="hb-t">발행 플랫폼 — 발행 화면의 선택과 같은 자리입니다</div>`
    + PLATFORMS.map((p) => `
      <div class="hb-opt${p.value === cur ? ' sel' : ''}" data-hb-platform="${p.value}">
        <span class="hb-dot"></span><span style="color:${p.value === cur ? '' : p.color}">${p.label}</span>
      </div>`).join('');

  pop.querySelectorAll('[data-hb-platform]').forEach((opt) => {
    opt.addEventListener('click', async (e) => {
      e.stopPropagation();
      const value = opt.dataset.hbPlatform;
      // ① 발행이 실제로 읽는 라디오에 쓴다 — 이게 진실이다
      const radio = document.querySelector(`input[name="platform"][value="${value}"]`);
      if (!radio) { console.warn('[HEADER-BADGE] ⚠️ 플랫폼 라디오 없음:', value); return; }
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true })); // 기존 리스너(카드 UI 등)가 그대로 돈다
      // ② 저장 경로 둘 다 — bloggerSettings 가 .env 보다 우선이라 하나만 쓰면 되돌아간다
      await mergeIntoLocalSettings({ platform: value });
      try { await window.blogger?.saveEnv?.({ platform: value }); } catch (err) { console.warn('[HEADER-BADGE] 플랫폼 저장 실패:', err); }
      /**
       * ③ 화면 갱신은 기존 selectPlatform 에 맡긴다 — 카드 강조·필드 토글·배지까지
       *    한 함수가 다 한다(index.html 7602). 배지만 따로 칠하면 카드가 안 따라와서
       *    "안 바뀐 것처럼" 보인다(v3.8.440 과 같은 체감).
       */
      if (typeof window.selectPlatform === 'function') {
        try { window.selectPlatform(value); } catch (err) { console.warn('[HEADER-BADGE] selectPlatform 실패:', err); }
      }
      try { await updatePlatformStatus(); } catch { /* 배지 갱신 실패는 발행과 무관 */ }
      closeAllPops();
      addLog(`🎫 발행 플랫폼 변경: ${value}`, 'info');
    });
  });
}

// ─── AI 모델 ─────────────────────────────────────────────────

function buildModelPop(pop) {
  const radios = modelRadios();
  if (!radios.length) {
    pop.innerHTML = '<div class="hb-t">모델 선택지를 찾지 못했습니다 — 환경설정에서 변경해 주세요</div>';
    console.warn('[HEADER-BADGE] ⚠️ primaryGeminiTextModel 라디오가 없습니다');
    return;
  }
  let agentMode = false;
  try { agentMode = JSON.parse(localStorage.getItem('leadernamExecutionMode') || '"api"') === 'agent'; } catch { agentMode = localStorage.getItem('leadernamExecutionMode') === 'agent'; }

  const cur = document.querySelector('input[name="primaryGeminiTextModel"]:checked')?.value || '';
  pop.innerHTML = `<div class="hb-t">글 생성 AI 모델 — 환경설정의 선택과 같은 자리입니다</div>`
    + (agentMode ? '<div class="hb-note">⚠️ 지금은 에이전트 모드로 실행 중이라, 여기서 고른 API 모델은 에이전트 모드를 끈 뒤 적용됩니다.</div>' : '')
    + radios.map((r) => `
      <div class="hb-opt${r.value === cur ? ' sel' : ''}" data-hb-model="${r.value}">
        <span class="hb-dot"></span>${modelLabel(r)}
      </div>`).join('');

  pop.querySelectorAll('[data-hb-model]').forEach((opt) => {
    opt.addEventListener('click', async (e) => {
      e.stopPropagation();
      const value = opt.dataset.hbModel;
      // ① 발행 payload 가 읽는 라디오에 쓴다 — payload 가 env 보다 우선하므로 즉시 반영
      const radio = document.querySelector(`input[name="primaryGeminiTextModel"][value="${value}"]`);
      if (!radio) { console.warn('[HEADER-BADGE] ⚠️ 모델 라디오 없음:', value); return; }
      radio.checked = true;
      // change 를 bubbles 로 — script.js 의 문서 리스너가 배지를 갱신한다
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      // ② 재시작·env 폴백 경로를 위해 부분 저장 — 엔진 파생은 saveSettings 와 같은 규칙
      const engine = deriveEngine(value);
      // bloggerSettings 가 우선 소스라 여기도 같이 써야 재시작 후에도 남는다
      await mergeIntoLocalSettings({
        primaryGeminiTextModel: value,
        generationEngine: engine,
        defaultAiProvider: engine,
      });
      try {
        await window.blogger?.saveEnv?.({
          primaryGeminiTextModel: value,
          generationEngine: engine,
          defaultAiProvider: engine,
        });
      } catch (err) { console.warn('[HEADER-BADGE] 모델 저장 실패:', err); }
      // ③ 배지·엔진 칩 갱신 (라디오 change 리스너가 없을 때를 위한 직접 호출)
      try { await window.updateAiModelStatus?.(); } catch { /* 배지 갱신 실패는 발행과 무관 */ }
      closeAllPops();
      addLog(`🎫 글 생성 모델 변경: ${value} (${engine})`, 'info');
    });
  });
}

function closeAllPops() {
  document.querySelectorAll('.hb-pop').forEach((p) => {
    p.classList.remove('open');
    try { if (typeof p.hidePopover === 'function' && p.matches(':popover-open')) p.hidePopover(); } catch { /* 이미 닫힘 */ }
  });
}
