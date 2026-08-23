// 🧭 사용법 안내 — 첫 실행 화살표 + 18단계 따라하기 투어 (v3.8.552)
//
// 사장님 지시:
//   · "처음 뜨면 상단에 화살표가 생기면서 먼저 플랫폼과 엔진을 선택하세요라고 뜨게" → A안 확정
//   · "버튼 한번 누르면 그대로 초보자가 따라가면 되게끔"
//   · 표시 조건: 첫 실행 딱 한 번
//
// ## 왜 popover 인가
// 헤더는 overflow 로 자르고, .app-header·.header-badge 는 backdrop-filter 가 걸려 있어
// fixed 자손의 컨테이닝 블록이 된다. 배지 드롭다운이 v3.8.534/535/544 세 번 실패한 이유다.
// popover 는 브라우저 top layer 에 그려서 조상 규칙을 전부 무시한다 — 같은 방식을 쓴다.
//
// ## 없는 대상은 조용히 넘기지 않는다
// 18단계는 화면 곳곳의 id 를 가리킨다. id 가 바뀌면 그 단계만 조용히 빈 화면이 되기 쉽다.
// 그래서 대상을 못 찾으면 **경고를 남기고 그 단계를 건너뛴다** (투어 자체는 계속된다).

import { addLog } from './core.js';

const COACH_SEEN_KEY = 'leadernam_platform_coach_seen';

// ─── 공용: 스타일 ────────────────────────────────────────────

function ensureStyles() {
  if (document.getElementById('utStyles')) return;
  const st = document.createElement('style');
  st.id = 'utStyles';
  st.textContent = `
    .ut-pop { position:fixed; z-index:2147483000; margin:0; inset:auto; padding:0;
      border:0; background:transparent; overflow:visible; display:none; }
    .ut-pop:popover-open { display:block; }
    .ut-pop.open { display:block; }
    .ut-card { width:23rem; max-width:calc(100vw - 2.5rem);
      background:#1b2440; border:1px solid rgba(148,163,184,.35); border-radius:12px;
      padding:15px 17px 13px; box-shadow:0 18px 44px rgba(2,6,23,.6); text-align:left;
      font-family:'Pretendard',-apple-system,'Segoe UI',sans-serif; }
    .ut-step { font-size:10.5px; font-weight:800; color:#818cf8; letter-spacing:.06em; margin-bottom:5px; }
    .ut-title { margin:0 0 5px; font-size:15px; font-weight:800; color:#f8fafc; line-height:1.35; }
    .ut-body { margin:0; font-size:12.5px; line-height:1.68; color:#b6c0d4; }
    .ut-body b { color:#e2e8f0; }
    .ut-tip { margin:8px 0 0; padding:8px 10px; background:rgba(251,191,36,.1);
      border:1px solid rgba(251,191,36,.28); border-radius:8px;
      font-size:11.5px; line-height:1.6; color:#fde68a; }
    .ut-row { display:flex; align-items:center; gap:8px; margin-top:12px; }
    .ut-skip { font-size:11px; color:#78849c; background:none; border:0; cursor:pointer;
      font-family:inherit; padding:4px 2px; }
    .ut-skip:hover { color:#cbd5e1; text-decoration:underline; }
    .ut-spacer { flex:1; }
    .ut-btn { font-family:inherit; font-size:12.5px; font-weight:800; border-radius:8px;
      padding:7px 14px; cursor:pointer; white-space:nowrap; }
    .ut-prev { background:rgba(148,163,184,.14); border:1px solid rgba(148,163,184,.3); color:#cbd5e1; }
    .ut-prev:hover { background:rgba(148,163,184,.24); }
    .ut-next { background:rgba(99,102,241,.26); border:1px solid rgba(129,140,248,.55); color:#c7d2fe; }
    .ut-next:hover { background:rgba(99,102,241,.4); }
    .ut-tip-arrow { position:absolute; top:-9px; width:0; height:0;
      border-left:9px solid transparent; border-right:9px solid transparent;
      border-bottom:9px solid #1b2440;
      filter:drop-shadow(0 -1px 0 rgba(148,163,184,.4));
      animation:ut-nudge 1.9s ease-in-out infinite; }
    @keyframes ut-nudge { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-4px);} }
    .ut-lit { outline:2px solid rgba(129,140,248,.9) !important;
      outline-offset:3px; border-radius:8px;
      box-shadow:0 0 0 6px rgba(99,102,241,.18) !important; }
    @media (prefers-reduced-motion: reduce) { .ut-tip-arrow { animation:none; } }
  `;
  document.head.appendChild(st);
}

// ─── 공용: 팝오버 한 개 ──────────────────────────────────────

let popEl = null;

function getPop() {
  if (popEl && popEl.isConnected) return popEl;
  ensureStyles();
  popEl = document.createElement('div');
  popEl.className = 'ut-pop';
  document.body.appendChild(popEl);
  try { popEl.setAttribute('popover', 'manual'); } catch { /* 미지원이면 클래스 폴백 */ }
  return popEl;
}

function openPop() {
  const pop = getPop();
  pop.classList.add('open');
  try {
    if (typeof pop.showPopover === 'function' && !pop.matches(':popover-open')) pop.showPopover();
  } catch (err) {
    console.warn('[USAGE-TOUR] showPopover 실패 — 클래스 폴백:', err);
  }
}

function closePop() {
  if (!popEl) return;
  popEl.classList.remove('open');
  try { if (typeof popEl.hidePopover === 'function' && popEl.matches(':popover-open')) popEl.hidePopover(); } catch { /* 이미 닫힘 */ }
}

/** 대상 아래에 배치하고, 화살표를 대상 중앙에 맞춘다 */
function placeUnder(targets) {
  const pop = getPop();
  const card = pop.querySelector('.ut-card');
  if (!card) return;
  const rects = targets.map((t) => t.getBoundingClientRect()).filter((r) => r.width || r.height);
  if (!rects.length) {
    // 대상이 화면에 없으면 가운데 위쪽에 띄운다 (마지막 인사 단계 등)
    pop.style.top = '84px';
    pop.style.left = `${Math.max(12, Math.round((window.innerWidth - card.offsetWidth) / 2))}px`;
    pop.querySelectorAll('.ut-tip-arrow').forEach((a) => { a.style.display = 'none'; });
    return;
  }
  const bottom = Math.max(...rects.map((r) => r.bottom));
  const centers = rects.map((r) => r.left + r.width / 2);
  const mid = centers.reduce((a, b) => a + b, 0) / centers.length;
  const w = card.offsetWidth || 368;
  const left = Math.max(12, Math.min(mid - w / 2, window.innerWidth - w - 12));
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(Math.min(bottom + 12, window.innerHeight - 40))}px`;
  pop.querySelectorAll('.ut-tip-arrow').forEach((arrow, i) => {
    const c = centers[i];
    if (c === undefined) { arrow.style.display = 'none'; return; }
    arrow.style.display = 'block';
    arrow.style.left = `${Math.round(Math.max(10, Math.min(c - left - 9, w - 28)))}px`;
  });
}

function clearHighlights() {
  document.querySelectorAll('.ut-lit').forEach((el) => el.classList.remove('ut-lit'));
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ══════════════════════════════════════════════════════════
// ① 첫 실행 안내 화살표 (A안)
// ══════════════════════════════════════════════════════════

export function showPlatformCoach() {
  const plat = document.getElementById('platformStatus')?.closest('.header-badge');
  const eng = document.getElementById('aiModelStatus')?.closest('.header-badge');
  if (!plat || !eng) {
    console.warn('[USAGE-TOUR] ⚠️ 헤더 배지를 찾지 못해 첫 실행 안내를 띄우지 않습니다');
    return false;
  }

  const pop = getPop();
  pop.innerHTML = `
    <span class="ut-tip-arrow"></span><span class="ut-tip-arrow"></span>
    <div class="ut-card">
      <h4 class="ut-title">먼저 플랫폼과 엔진을 선택하세요</h4>
      <p class="ut-body">글 생성 전에 이 두 배지를 눌러 바로 바꿀 수 있습니다. <b>지금 보이는 값 그대로 발행</b>됩니다.</p>
      <div class="ut-row">
        <button class="ut-skip" data-ut-tour>📖 사용법 처음부터 보기</button>
        <span class="ut-spacer"></span>
        <button class="ut-btn ut-next" data-ut-ok>확인했어요</button>
      </div>
    </div>`;

  plat.classList.add('ut-lit');
  eng.classList.add('ut-lit');
  openPop();
  placeUnder([plat, eng]);

  const finish = () => {
    try { localStorage.setItem(COACH_SEEN_KEY, '1'); } catch { /* 저장 실패해도 닫기는 된다 */ }
    clearHighlights();
    closePop();
    document.removeEventListener('keydown', onKey);
    plat.removeEventListener('click', finish);
    eng.removeEventListener('click', finish);
  };
  const onKey = (e) => { if (e.key === 'Escape') finish(); };

  pop.querySelector('[data-ut-ok]')?.addEventListener('click', finish);
  pop.querySelector('[data-ut-tour]')?.addEventListener('click', () => { finish(); showUsageTour(); });
  // 배지를 직접 누르는 것도 "봤다"로 친다 — 시킨 일을 한 것이다
  plat.addEventListener('click', finish);
  eng.addEventListener('click', finish);
  document.addEventListener('keydown', onKey);

  const reposition = () => placeUnder([plat, eng]);
  window.addEventListener('resize', reposition);
  document.addEventListener('scroll', reposition, true);
  return true;
}

/** 첫 실행에만 부른다. 이미 봤거나 환경설정이 자동으로 열려 있으면 띄우지 않는다. */
export function maybeShowPlatformCoach() {
  try {
    if (localStorage.getItem(COACH_SEEN_KEY) === '1') return false;
  } catch { /* 저장소를 못 읽으면 그냥 띄운다 */ }
  // ⚠️ 환경설정 모달은 display:'flex' 로 열린다(ui.js openSettingsModal). 'block' 으로 보면 못 잡는다.
  const modalDisplay = document.getElementById('settingsModal')?.style?.display || 'none';
  const settingsOpen = modalDisplay !== 'none' && modalDisplay !== '';
  if (settingsOpen) {
    // 첫 실행 마법사가 환경설정을 열었다 — 창 두 개가 겹치면 오히려 헷갈린다
    console.log('[USAGE-TOUR] 환경설정이 열려 있어 첫 실행 안내를 건너뜁니다');
    return false;
  }
  return showPlatformCoach();
}

// ══════════════════════════════════════════════════════════
// ② 사용법 따라하기 (사장님이 주신 순서 그대로)
// ══════════════════════════════════════════════════════════

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function goSettingsModal() {
  // openSettingsModal 은 async 다 — 기다리지 않으면 아직 안 그려진 칸을 가리키게 된다
  if (typeof window.openSettingsModal === 'function') { await window.openSettingsModal(); await wait(220); }
  // API 키 탭이 기본이지만, 사용자가 다른 탭을 보고 있었을 수 있다
  if (typeof window.switchSettingsTab === 'function') {
    try { window.switchSettingsTab('api-keys'); await wait(140); } catch { /* 탭 전환 실패는 치명 아님 */ }
  }
  /**
   * API/Agent 선택 버튼(#executionModeApiBtn)은 index.html 에 없다 —
   * codex-workshop 이 #tab-api-keys 안에 **런타임으로** 그린다.
   * 이걸 안 부르면 그 단계가 "대상 없음"으로 건너뛰어진다 (조용한 미배선).
   */
  if (typeof window.ensureAgentModeSettingsReady === 'function') {
    try { await window.ensureAgentModeSettingsReady(); await wait(160); }
    catch (err) { console.warn('[USAGE-TOUR] 실행 방식 섹션 준비 실패:', err); }
  }
}
async function closeSettingsModal() {
  const m = document.getElementById('settingsModal');
  if (m && m.style.display !== 'none') { m.style.display = 'none'; await wait(120); }
}
async function goPostingTab() {
  await closeSettingsModal();
  if (typeof window.showTab === 'function') { window.showTab('settings'); await wait(220); }
}
async function openDetailPanel() {
  await goPostingTab();
  const acc = document.getElementById('postingSettingsAccordion');
  if (acc && acc.style.display === 'none' && typeof window.togglePostingSettingsPanel === 'function') {
    window.togglePostingSettingsPanel();
    await wait(260);
  }
}
async function goDetailTab(tab) {
  await openDetailPanel();
  if (typeof window.switchPostingSettingsTab === 'function') { window.switchPostingSettingsTab(tab); await wait(200); }
}

/**
 * 단계 정의 — 사장님이 주신 설명서 그대로.
 * sel: 가리킬 대상(여러 개면 화살표도 여러 개). before: 그 화면으로 데려가는 동작.
 */
const STEPS = [
  {
    before: null, sel: ['#nav-settings'],
    title: '왼쪽 맨 아래 [설정]으로 들어갑니다',
    body: '모든 준비는 여기서 합니다. 한 번만 해두면 다음부터는 바로 글만 쓰면 됩니다.',
  },
  {
    before: goSettingsModal, sel: ['#executionModeApiBtn', '#executionModeAgentBtn'],
    title: 'API 키 모드와 Agent 모드 중 하나를 고릅니다',
    body: '처음이라면 <b>API 키 모드</b>가 간단합니다. 제미나이를 충전해서 쓰는 방식입니다.',
  },
  {
    before: goSettingsModal, sel: ['input[name="primaryGeminiTextModel"]'],
    title: '글 쓰는 AI 모델을 고릅니다',
    body: '처음에는 <b>제미나이 3.6 플래시</b>를 추천합니다. 값이 싸고 속도가 빠릅니다.',
  },
  {
    before: goSettingsModal, sel: ['#geminiKey'],
    title: 'API 키를 넣습니다',
    body: '고른 모델에 맞는 키를 넣습니다. 키는 이 컴퓨터에만 저장됩니다.',
  },
  {
    before: goSettingsModal, sel: ['#naverApiHubKeyId', '#naverApiHubKey'],
    title: '네이버 API HUB 키를 발급받아 넣습니다',
    body: '네이버클라우드 콘솔 → AI·NAVER API 에서 발급합니다. 검색 자료를 모아 글의 근거로 씁니다.',
    tip: '⚠️ Application 등록할 때 <b>서비스 선택</b>에서 <b>검색</b>과 <b>Search Trend</b>를 꼭 체크하세요. 안 하면 키가 맞아도 429로 거절됩니다.',
  },
  {
    before: goSettingsModal, sel: ['#thumbnailType'],
    title: '이미지 엔진은 값을 보고 고릅니다',
    body: '제미나이는 <b>나노바나나2</b>를 쓸 수 있지만 <b>장당 90원 정도</b> 듭니다.',
    tip: '💡 싼 걸 원하시면 <b>프로디아</b>를 추천합니다.',
  },
  {
    before: goPostingTab, sel: ['#nav-auto'],
    title: '이제 왼쪽 [글포스팅] 탭으로 갑니다',
    body: '준비가 끝났습니다. 여기서부터가 실제로 글을 만드는 자리입니다.',
  },
  {
    before: goPostingTab, sel: ['#keywordInput', '#contentUrl'],
    title: '키워드 또는 URL을 넣습니다',
    body: '쓰고 싶은 주제를 넣습니다. <b>줄바꿈으로 여러 개</b> 넣으면 연속발행이 됩니다.',
  },
  {
    before: goPostingTab, sel: ['#postingSettingsToggleBtn'],
    title: '오른쪽 아래 [상세설정]을 누릅니다',
    body: '누르면 설정 페이지가 펼쳐집니다. 아래 단계는 전부 이 안에 있습니다.',
  },
  {
    before: () => goDetailTab('tab-content'), sel: ['#contentMode'],
    title: '콘텐츠 모드는 보통 SEO 모드로 둡니다',
    body: '거미줄 모드로 발행할 때만 <b>단일 일관 모드</b>를 고릅니다.',
  },
  {
    before: () => goDetailTab('tab-content'), sel: ['#toneStyle', '#experienceNote'],
    title: '말투를 고르고, 겪은 경험이 있으면 적습니다',
    body: '키워드와 관련해 <b>직접 겪은 일</b>이 있으면 내 경험 메모에 적어주세요. 글의 신뢰도가 확 올라갑니다.',
  },
  {
    before: () => goDetailTab('tab-content'), sel: ['#useKeywordAsTitle'],
    title: '제목 옵션',
    body: '<b>키워드를 제목으로</b> — 키워드 입력창에 넣은 문장이 그대로 제목이 됩니다. 즉, 제목을 입력창에 넣고 체크하시면 됩니다.<br>'
      + '<b>키워드 맨 앞 배치</b> — 키워드만 앞으로 두고 제목은 AI가 알아서 만듭니다.',
  },
  {
    before: () => goDetailTab('tab-image'), sel: ['#thumbnailType', '#h2ImageSource'],
    title: '이미지 엔진과 배치를 정합니다',
    body: '제미나이로 하셨다면 <b>나노바나나2</b>, 지피티라면 <b>지피티 이미지2(덕테이프)</b>를 추천합니다.<br>'
      + '배치는 전체 / 홀수 / 짝수 중에 고르고, 썸네일만 만들 거면 썸네일만 고르면 됩니다.',
    tip: '💡 이미지 수가 곧 비용입니다. 값을 보면서 정하세요.',
  },
  {
    before: () => goDetailTab('tab-image'), sel: ['#strictH2ImageEngine'],
    title: '엔진 고정 모드',
    body: '평소에는 글 생성이 실패하면 다른 모델로 자동으로 넘어갑니다. 이걸 켜면 <b>고른 모델 하나만</b> 씁니다.',
    tip: '⚠️ 켜둔 상태에서 실패하면 다른 모델로 안 넘어가고 <b>작업이 멈춥니다</b>.',
  },
  {
    before: () => goDetailTab('tab-content'), sel: ['#factCheckMode'],
    title: '팩트체크는 자동으로 두세요',
    body: 'AI의 거짓말을 막아줍니다. 견고하게 적용되어 있으니 <b>자동</b>이면 충분합니다.',
  },
  {
    before: () => goDetailTab('tab-publish'), sel: ['input[name="postingMode"]'],
    title: '발행 방식을 고릅니다',
    body: '즉시 / 임시 / 예약 중에 고릅니다. <b>예약 발행</b>이면 아래 [📅 달력 열기]로 날짜와 시간을 잡으시면 됩니다.',
    tip: '📂 카테고리가 있는 블로그라면 [카테고리] 탭에서 불러와 고르시면 됩니다.',
  },
  {
    before: goPostingTab, sel: ['#editGeneratedBtn', '#publishBtn'],
    title: '이제 발행입니다 — 두 가지 길이 있습니다',
    body: '<b>반자동 발행</b> — 글과 이미지를 먼저 미리보기로 보고, 고칠 데를 고친 뒤 발행합니다.<br>'
      + '<b>블로그 글 작성 시작</b> — 확인 없이 한 번에 발행까지 갑니다.',
  },
  {
    before: null, sel: [],
    title: '준비 끝났습니다',
    body: '충분히 숙지하시고 <b>돈 많이 버시길 바랍니다</b>. 이 안내는 언제든 헤더의 [📖 사용법]으로 다시 보실 수 있습니다.',
  },
];

let tourIndex = 0;
let tourActive = false;

export async function showUsageTour(startAt = 0) {
  ensureStyles();
  tourActive = true;
  tourIndex = Math.max(0, Math.min(startAt, STEPS.length - 1));
  addLog('📖 사용법 따라하기를 시작합니다', 'info');
  await renderStep();
}

function endTour(reason = 'done') {
  tourActive = false;
  clearHighlights();
  closePop();
  document.removeEventListener('keydown', onTourKey);
  if (reason === 'skip') addLog('📖 사용법 따라하기를 건너뛰었습니다', 'info');
}

function onTourKey(e) {
  if (!tourActive) return;
  if (e.key === 'Escape') endTour('skip');
  else if (e.key === 'ArrowRight') step(+1);
  else if (e.key === 'ArrowLeft') step(-1);
}

async function step(delta) {
  const next = tourIndex + delta;
  if (next < 0) return;
  if (next >= STEPS.length) { endTour('done'); return; }
  tourIndex = next;
  await renderStep();
}

async function renderStep() {
  const s = STEPS[tourIndex];
  clearHighlights();

  if (typeof s.before === 'function') {
    try { await s.before(); } catch (err) { console.warn('[USAGE-TOUR] 화면 이동 실패:', err); }
  }

  // 대상을 못 찾으면 조용히 빈 화면을 보여주지 않는다 — 남기고 넘어간다
  const targets = [];
  s.sel.forEach((sel) => {
    const el = document.querySelector(sel);
    if (el) targets.push(el);
    else console.warn(`[USAGE-TOUR] ⚠️ ${tourIndex + 1}단계 대상을 찾지 못했습니다: ${sel}`);
  });
  if (s.sel.length && !targets.length) {
    console.warn(`[USAGE-TOUR] ${tourIndex + 1}단계를 건너뜁니다 (대상 없음)`);
    await step(+1);
    return;
  }

  const pop = getPop();
  pop.innerHTML = `
    ${targets.map(() => '<span class="ut-tip-arrow"></span>').join('')}
    <div class="ut-card">
      <div class="ut-step">${tourIndex + 1} / ${STEPS.length}</div>
      <h4 class="ut-title">${s.title}</h4>
      <p class="ut-body">${s.body}</p>
      ${s.tip ? `<div class="ut-tip">${s.tip}</div>` : ''}
      <div class="ut-row">
        <button class="ut-skip" data-ut-skip>건너뛰기</button>
        <span class="ut-spacer"></span>
        ${tourIndex > 0 ? '<button class="ut-btn ut-prev" data-ut-prev>이전</button>' : ''}
        <button class="ut-btn ut-next" data-ut-next>${tourIndex === STEPS.length - 1 ? '시작하기' : '다음'}</button>
      </div>
    </div>`;

  targets.forEach((t) => t.classList.add('ut-lit'));
  try { targets[0]?.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch { /* 스크롤 실패는 치명 아님 */ }

  openPop();
  // 스크롤이 끝난 뒤 좌표를 잡아야 화살표가 제자리에 온다
  await wait(180);
  placeUnder(targets);

  pop.querySelector('[data-ut-next]')?.addEventListener('click', () => step(+1));
  pop.querySelector('[data-ut-prev]')?.addEventListener('click', () => step(-1));
  pop.querySelector('[data-ut-skip]')?.addEventListener('click', () => endTour('skip'));
  document.addEventListener('keydown', onTourKey);

  const reposition = () => { if (tourActive) placeUnder(targets); };
  window.addEventListener('resize', reposition, { once: true });
}

// ─── 전역 등록 + 헤더 버튼 ──────────────────────────────────

export function initUsageTour() {
  ensureStyles();
  window.showUsageTour = showUsageTour;
  window.showPlatformCoach = showPlatformCoach;

  // 헤더에 [📖 사용법] 버튼 — 언제든 다시 볼 수 있어야 한다
  const actions = document.querySelector('.header-actions');
  if (!actions) {
    console.warn('[USAGE-TOUR] ⚠️ .header-actions 를 찾지 못해 [사용법] 버튼을 붙이지 못했습니다');
    return;
  }
  if (document.getElementById('usageTourBtn')) return;
  const btn = document.createElement('button');
  btn.id = 'usageTourBtn';
  btn.type = 'button';
  btn.title = '처음부터 따라하기';
  btn.textContent = '📖 사용법';
  btn.style.cssText = 'flex:0 0 auto;padding:8px 14px;background:rgba(99,102,241,.18);'
    + 'border:1px solid rgba(129,140,248,.45);color:#c7d2fe;border-radius:10px;'
    + 'font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap;font-family:inherit;';
  btn.addEventListener('click', () => showUsageTour(0));
  actions.insertBefore(btn, actions.firstChild);
}
