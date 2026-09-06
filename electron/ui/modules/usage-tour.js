// 🧭 사용법 안내 — 첫 실행 화살표 + 완전자동발행 따라하기 투어 (v3.8.552 → v3.8.686)
//
// 사장님 지시:
//   · "처음 뜨면 상단에 화살표가 생기면서 먼저 플랫폼과 엔진을 선택하세요라고 뜨게" → A안 확정
//   · "버튼 한번 누르면 그대로 초보자가 따라가면 되게끔"
//   · 표시 조건: 첫 실행 딱 한 번
//   · v3.8.686: "설명카드는 맨앞으로 와야지", "다음 누르면 부드럽고 빠르게", "지금 이 사용법은 완전자동발행"
//
// ## 왜 popover 인가
// 헤더는 overflow 로 자르고, .app-header·.header-badge 는 backdrop-filter 가 걸려 있어
// fixed 자손의 컨테이닝 블록이 된다. 배지 드롭다운이 v3.8.534/535/544 세 번 실패한 이유다.
// popover 는 브라우저 top layer 에 그려서 조상 규칙을 전부 무시한다 — 같은 방식을 쓴다.
//
// ## 카드가 어두워지던 이유 (v3.8.686)
// 카드(.ut-pop)와 스포트라이트(.ut-spot)를 **popover 두 개**로 띄웠다. top layer 는 z-index 를
// 무시하고 **나중에 showPopover 한 것이 위**에 온다. 단계마다 스포트라이트를 닫았다 다시 여니
// 매번 스포트라이트가 카드 위로 올라와 9999px 그림자가 카드를 덮었다 — z-index 2147483000 을
// 줘도 소용없는 자리였다. 이제 popover 는 **하나**다. 그 안에서 그림자 → 카드 순서로 그리므로
// 카드는 항상 맨 앞이다.
//
// ## 느리던 이유 (v3.8.686)
//   ① 화면 이동 뒤 고정 대기(220·140·160·260·200ms) — 이미 그려졌는데도 기다렸다.
//   ② "어두워졌다 밝아지는" 연출을 9999px box-shadow 색으로 돌려서 0.42초 동안 매 프레임
//      화면 전체를 다시 칠했다. 느린 PC 에서 이게 "뚝 끊기는" 정체다.
//   ③ scrollIntoView 가 쏘는 scroll 이벤트마다 좌표를 다시 재고 그림자를 다시 썼다.
// 이제 ① 대상이 그려져 자리를 잡을 때까지만 프레임 단위로 기다리고(settle),
//     ② 연출은 별도 막(.ut-veil)의 **opacity** 로만 돌리며(합성기 처리 · 재도색 없음),
//     ③ 좌표 갱신은 한 프레임에 한 번으로 묶는다. 카드는 transform 으로 미끄러진다(레이아웃 없음).
//
// ## 없는 대상은 조용히 넘기지 않는다
// 단계는 화면 곳곳의 id 를 가리킨다. id 가 바뀌면 그 단계만 조용히 빈 화면이 되기 쉽다.
// 그래서 대상을 못 찾거나 **그려지지 않으면 경고를 남기고 그 단계를 건너뛴다** (투어 자체는 계속된다).

import { addLog } from './core.js';

const COACH_SEEN_KEY = 'leadernam_platform_coach_seen';

// ─── 공용: 스타일 ────────────────────────────────────────────

function ensureStyles() {
  if (document.getElementById('utStyles')) return;
  const st = document.createElement('style');
  st.id = 'utStyles';
  st.textContent = `
    .ut-pop { position:fixed; left:0; top:0; width:0; height:0; z-index:2147483000; margin:0; inset:auto; padding:0;
      border:0; background:transparent; overflow:visible; display:none; }
    .ut-pop:popover-open { display:block; }
    .ut-pop.open { display:block; }

    /* ── 스포트라이트 ──────────────────────────────────────────
       주변을 어둡게 덮고 대상만 뚫어서, 볼 곳을 하나로 만든다.
       카드와 **같은 popover 안**에 있어야 한다 — 따로 띄우면 top layer 순서에 밀려 카드를 덮는다. */
    .ut-hole { position:fixed; border-radius:10px; pointer-events:none; display:none;
      box-shadow:0 0 0 9999px rgba(2,6,23,.62);
      outline:2px solid rgba(129,140,248,.95); outline-offset:0; }
    .ut-hole.on { display:block; }
    /* 구멍은 전환 없이 바로 옮긴다. 9999px 그림자는 width/height 가 바뀔 때마다 다시 칠하므로
       매 프레임 움직이게 두면 느린 PC 에서 끊긴다. "여기를 보라"는 신호는 아래 .ut-ring(transform 만)이 맡는다. */
    .ut-ring { position:fixed; border-radius:12px; pointer-events:none; display:none;
      border:2px solid rgba(129,140,248,.75);
      animation:ut-ring 1.6s ease-out infinite; }
    .ut-ring.on { display:block; }
    @keyframes ut-ring {
      0%   { transform:scale(1);    opacity:.85; }
      100% { transform:scale(1.09); opacity:0; }
    }

    /* ── 단계가 바뀔 때 한 번: 어두워졌다가 다시 밝아진다 (v3.8.617 → v3.8.686) ──
       사장님: "어두워졋다가 자연스럽게 다시 밝아져야됩니다"
       예전엔 구멍의 box-shadow 색을 애니메이션했다 — 매 프레임 화면 전체를 다시 칠한다.
       이제 화면 전체를 덮는 막 하나를 두고 **opacity 만** 1→0 으로 내린다. 합성기가 처리하므로
       CPU 재도색이 없다. 한 번(0.42s)만 돈다. */
    .ut-veil { position:fixed; inset:0; background:rgba(2,6,23,.45); opacity:0; pointer-events:none;
      will-change:opacity; display:none; }
    .ut-veil.on { display:block; }
    .ut-veil.ut-reveal { animation:ut-reveal .42s cubic-bezier(.22,.61,.36,1) 1; }
    @keyframes ut-reveal {
      0%   { opacity:1; }
      100% { opacity:0; }
    }

    /* 대상 자체도 같이 밝아진다 — 구멍만 밝아지면 "무엇"이 아니라 "어디"만 보인다 */
    .ut-lit { outline:2px solid rgba(129,140,248,.95) !important;
      outline-offset:3px; border-radius:8px;
      box-shadow:0 0 0 6px rgba(99,102,241,.22) !important; }
    .ut-lit.ut-reveal { animation:ut-lit-reveal .42s cubic-bezier(.22,.61,.36,1) 1; }
    @keyframes ut-lit-reveal {
      0%   { box-shadow:0 0 0 0 rgba(99,102,241,0) !important; }
      55%  { box-shadow:0 0 0 12px rgba(99,102,241,.34) !important; }
      100% { box-shadow:0 0 0 6px rgba(99,102,241,.22) !important; }
    }

    /* ── 카드 앵커: transform 으로만 움직인다 (레이아웃·재도색 없이 미끄러진다) ── */
    .ut-anchor { position:fixed; left:0; top:0; will-change:transform; z-index:2; }
    .ut-anchor.ut-glide { transition:transform .24s cubic-bezier(.22,.61,.36,1); }
    .ut-card { position:relative; width:23rem; max-width:calc(100vw - 2.5rem);
      background:#1b2440; border:1px solid rgba(148,163,184,.35); border-radius:12px;
      padding:15px 17px 13px; box-shadow:0 18px 44px rgba(2,6,23,.6); text-align:left;
      font-family:'Pretendard',-apple-system,'Segoe UI',sans-serif; }
    .ut-card.ut-in { animation:ut-card-in .18s ease-out 1; }
    @keyframes ut-card-in { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }
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

    /* 눌렀는데 반응이 없어 보이면 또 누른다 — 그래서 1→3→5 로 건너뛰었다.
       누른 즉시 눌린 티를 내고, 준비되는 동안 못 누르게 막는다. */
    .ut-card.is-busy .ut-btn { opacity:.55; cursor:progress; }
    .ut-btn:active { transform:translateY(1px); }
    .ut-btn[disabled] { pointer-events:none; }

    @media (prefers-reduced-motion: reduce) {
      .ut-tip-arrow, .ut-ring { animation:none; }
      /* 밝아지는 연출도 끈다 — 다만 최종 상태는 CSS 기본값이라 그대로 보인다 */
      .ut-veil.ut-reveal, .ut-lit.ut-reveal, .ut-card.ut-in { animation:none; }
      .ut-anchor.ut-glide { transition:none; }
    }
  `;
  document.head.appendChild(st);
}

// ─── 공용: 팝오버 한 개 (막 · 구멍 · 링 · 카드 앵커가 전부 이 안에 있다) ──────

let popEl = null;
/** 앵커가 한 번이라도 놓였는가 — 처음엔 (0,0) 에서 미끄러져 오면 안 되므로 첫 배치는 즉시 놓는다 */
let anchorPlaced = false;

function getPop() {
  if (popEl && popEl.isConnected) return popEl;
  ensureStyles();
  popEl = document.createElement('div');
  popEl.className = 'ut-pop';
  // 그리는 순서가 곧 앞뒤다: 막 → 구멍 → 링 → 카드. 카드가 마지막이라 항상 맨 앞이다.
  popEl.innerHTML = '<div class="ut-veil"></div><div class="ut-hole"></div><div class="ut-ring"></div><div class="ut-anchor"></div>';
  document.body.appendChild(popEl);
  try { popEl.setAttribute('popover', 'manual'); } catch { /* 미지원이면 클래스 폴백 */ }
  return popEl;
}

/** 카드 내용을 갈아 끼운다. 앵커(.ut-anchor)는 그대로 두어 다음 자리로 미끄러진다. */
function setCard(inner, arrowCount) {
  const pop = getPop();
  const anchor = pop.querySelector('.ut-anchor');
  anchor.innerHTML = `${'<span class="ut-tip-arrow"></span>'.repeat(arrowCount)}<div class="ut-card ut-in">${inner}</div>`;
  return pop;
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
  anchorPlaced = false;
  if (!popEl) return;
  popEl.classList.remove('open');
  try { if (typeof popEl.hidePopover === 'function' && popEl.matches(':popover-open')) popEl.hidePopover(); } catch { /* 이미 닫힘 */ }
}

/** 여백 — 화면 가장자리에서 이만큼은 떨어뜨린다 */
const EDGE = 14;

/**
 * 대상 옆에 카드를 놓는다.
 *
 * v3.8.563 — 예전엔 **무조건 아래**에 놓고 `top` 을 `innerHeight - 40` 으로만 잘랐다.
 * 카드 높이는 200px 안팎인데 40px 만 남기고 자르니, 아래쪽 대상(예: 왼쪽 맨 아래 [설정])
 * 에서는 카드가 통째로 화면 밖으로 나가 "1 / 18" 이 작업표시줄에 가렸다.
 * 이제 **아래에 안 들어가면 위로 뒤집고**, 위아래 다 좁으면 옆으로 비킨다.
 * 자를 때도 카드의 실제 높이를 쓴다.
 *
 * v3.8.686 — left/top 대신 transform 으로 놓는다. 단계가 바뀌면 이전 자리에서 미끄러진다.
 * instant=true(스크롤·리사이즈 추적)면 미끄러지지 않고 바로 놓는다 — 스크롤 중에 전환이 걸리면 뒤처진다.
 */
function placeNear(targets, instant = false) {
  const pop = getPop();
  const anchor = pop.querySelector('.ut-anchor');
  const card = anchor?.querySelector('.ut-card');
  if (!anchor || !card) return;
  const arrows = [...anchor.querySelectorAll('.ut-tip-arrow')];
  const rects = targets.map((t) => t.getBoundingClientRect()).filter((r) => r.width || r.height);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = card.offsetWidth || 368;
  const h = card.offsetHeight || 190;

  if (!rects.length) {
    // 대상이 화면에 없으면 한가운데 (마지막 인사 단계 등)
    moveAnchor(anchor, Math.max(EDGE, (vw - w) / 2), Math.max(EDGE, (vh - h) / 2), instant);
    arrows.forEach((a) => { a.style.display = 'none'; });
    placeSpotlight([]);
    return;
  }

  const top = Math.min(...rects.map((r) => r.top));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  const centers = rects.map((r) => r.left + r.width / 2);
  const mid = centers.reduce((a, b) => a + b, 0) / centers.length;

  const GAP = 12;
  const roomBelow = vh - bottom - GAP - EDGE;
  const roomAbove = top - GAP - EDGE;

  let y;
  let below;
  if (roomBelow >= h) { y = bottom + GAP; below = true; }
  else if (roomAbove >= h) { y = top - GAP - h; below = false; }
  else {
    // 위아래 다 좁다 — 더 넓은 쪽에 붙이고 화면 안으로 밀어 넣는다
    below = roomBelow >= roomAbove;
    y = below ? bottom + GAP : top - GAP - h;
  }
  y = Math.max(EDGE, Math.min(y, vh - h - EDGE));

  const left = Math.max(EDGE, Math.min(mid - w / 2, vw - w - EDGE));
  moveAnchor(anchor, left, y, instant);

  // 화살표는 "카드가 대상 아래에 있을 때"만 위를 가리킨다.
  // 위로 뒤집혔거나 카드가 대상을 덮으면 화살표가 엉뚱한 곳을 찌르므로 감춘다.
  const pointing = below && Math.abs(y - (bottom + GAP)) < 1;
  arrows.forEach((arrow, i) => {
    const c = centers[i];
    if (!pointing || c === undefined) { arrow.style.display = 'none'; return; }
    arrow.style.display = 'block';
    arrow.style.left = `${Math.round(Math.max(10, Math.min(c - left - 9, w - 28)))}px`;
  });

  placeSpotlight(rects);
}

function moveAnchor(anchor, left, top, instant) {
  anchor.classList.toggle('ut-glide', anchorPlaced && !instant);
  anchor.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
  anchorPlaced = true;
}

// ─── 스포트라이트 ────────────────────────────────────────────

/** 대상들을 감싸는 구멍 하나를 뚫는다. 대상이 없으면 스포트라이트를 끈다. */
function placeSpotlight(rects) {
  const pop = getPop();
  if (!rects.length) { hideSpot(); return; }
  const PAD = 6;
  const x1 = Math.min(...rects.map((r) => r.left)) - PAD;
  const y1 = Math.min(...rects.map((r) => r.top)) - PAD;
  const x2 = Math.max(...rects.map((r) => r.right)) + PAD;
  const y2 = Math.max(...rects.map((r) => r.bottom)) + PAD;
  // 그림자·테두리는 CSS 에 두고 여기서는 **자리만** 쓴다 — cssText 통째 갱신보다 싸다
  pop.querySelectorAll('.ut-hole, .ut-ring').forEach((el) => {
    el.style.top = `${Math.round(y1)}px`;
    el.style.left = `${Math.round(x1)}px`;
    el.style.width = `${Math.round(x2 - x1)}px`;
    el.style.height = `${Math.round(y2 - y1)}px`;
    el.classList.add('on');
  });
  pop.querySelector('.ut-veil')?.classList.add('on');
}

function hideSpot() {
  if (!popEl) return;
  popEl.querySelectorAll('.ut-veil, .ut-hole, .ut-ring').forEach((el) => el.classList.remove('on', 'ut-reveal'));
}

function runAutoNextCleanups() {
  autoNextCleanups.forEach((off) => { try { off(); } catch { /* 이미 떨어짐 */ } });
  autoNextCleanups = [];
}

function clearHighlights() {
  runAutoNextCleanups();
  document.querySelectorAll('.ut-lit').forEach((el) => el.classList.remove('ut-lit', 'ut-reveal'));
  hideSpot();
}

/**
 * "어두워졌다 밝아지는" 연출을 **다시** 돌린다. (v3.8.617)
 *
 * CSS 애니메이션은 클래스가 이미 붙어 있으면 다시 재생되지 않는다.
 * 그래서 떼고 → 강제로 레이아웃을 한 번 읽고(리플로) → 다시 붙인다.
 * `void el.offsetWidth` 가 그 리플로다 — 이게 없으면 브라우저가 두 변경을
 * 한 프레임에 합쳐 버려서 아무 일도 안 일어난다.
 */
function replayReveal(elements) {
  elements.filter(Boolean).forEach((el) => {
    el.classList.remove('ut-reveal');
    void el.offsetWidth;
    el.classList.add('ut-reveal');
  });
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

  const pop = setCard(`
      <h4 class="ut-title">먼저 플랫폼과 엔진을 선택하세요</h4>
      <p class="ut-body">글 생성 전에 이 두 배지를 눌러 바로 바꿀 수 있습니다. <b>지금 보이는 값 그대로 발행</b>됩니다.</p>
      <div class="ut-row">
        <button class="ut-skip" data-ut-tour>📖 사용법 처음부터 보기</button>
        <span class="ut-spacer"></span>
        <button class="ut-btn ut-next" data-ut-ok>확인했어요</button>
      </div>`, 2);

  plat.classList.add('ut-lit');
  eng.classList.add('ut-lit');
  openPop();
  placeNear([plat, eng], true);

  const finish = () => {
    try { localStorage.setItem(COACH_SEEN_KEY, '1'); } catch { /* 저장 실패해도 닫기는 된다 */ }
    clearHighlights();
    closePop();
    document.removeEventListener('keydown', onKey);
    plat.removeEventListener('click', finish);
    eng.removeEventListener('click', finish);
    window.removeEventListener('resize', reposition);
    document.removeEventListener('scroll', reposition, true);
  };
  const onKey = (e) => { if (e.key === 'Escape') finish(); };

  pop.querySelector('[data-ut-ok]')?.addEventListener('click', finish);
  pop.querySelector('[data-ut-tour]')?.addEventListener('click', () => { finish(); showUsageTour(); });
  // 배지를 직접 누르는 것도 "봤다"로 친다 — 시킨 일을 한 것이다
  plat.addEventListener('click', finish);
  eng.addEventListener('click', finish);
  document.addEventListener('keydown', onKey);

  const reposition = () => placeNear([plat, eng], true);
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
// ② 완전자동발행 따라하기 (사장님이 주신 순서 그대로)
// ══════════════════════════════════════════════════════════

/**
 * 설정 모달로 간다. **이미 그 자리면 아무것도 하지 않는다.** (v3.8.617)
 *
 * 사장님: "다음 누르면 너무 느리고"
 *
 * v3.8.686 — 고정 대기(220·140·160ms)를 전부 걷어냈다. openSettingsModal 은 준비 작업을
 * 끝까지 await 하고, 탭 전환과 섹션 그리기는 동기다. 그려진 뒤 자리를 잡는 것은
 * renderStep 의 settle() 이 프레임 단위로 확인한다.
 */
async function goSettingsModal() {
  const modal = document.getElementById('settingsModal');
  const modalOpen = !!modal && modal.style.display !== 'none';

  // openSettingsModal 은 async 다 — 기다리지 않으면 아직 안 그려진 칸을 가리키게 된다
  if (!modalOpen && typeof window.openSettingsModal === 'function') {
    await window.openSettingsModal();
  }

  // API 키 탭이 기본이지만, 사용자가 다른 탭을 보고 있었을 수 있다
  const apiTab = document.getElementById('tab-api-keys');
  const apiTabShown = !!apiTab && apiTab.style.display !== 'none' && !apiTab.hidden;
  if (!apiTabShown && typeof window.switchSettingsTab === 'function') {
    try { window.switchSettingsTab('api-keys'); } catch { /* 탭 전환 실패는 치명 아님 */ }
  }

  /**
   * API/Agent 선택 버튼(#executionModeApiBtn)은 index.html 에 없다 —
   * codex-workshop 이 #tab-api-keys 안에 **런타임으로** 그린다.
   * 이걸 안 부르면 그 단계가 "대상 없음"으로 건너뛰어진다 (조용한 미배선).
   * 이미 그려져 있으면 다시 부르지 않는다.
   */
  if (!document.getElementById('executionModeApiBtn')
    && typeof window.ensureAgentModeSettingsReady === 'function') {
    try { await window.ensureAgentModeSettingsReady(); }
    catch (err) { console.warn('[USAGE-TOUR] 실행 방식 섹션 준비 실패:', err); }
  }
}
async function closeSettingsModal() {
  const m = document.getElementById('settingsModal');
  if (m && m.style.display !== 'none') m.style.display = 'none';
}
async function goPostingTab() {
  await closeSettingsModal();
  if (typeof window.showTab === 'function') window.showTab('settings');
}
async function openDetailPanel() {
  await goPostingTab();
  const acc = document.getElementById('postingSettingsAccordion');
  if (acc && acc.style.display === 'none' && typeof window.togglePostingSettingsPanel === 'function') {
    window.togglePostingSettingsPanel();
  }
}
async function goDetailTab(tab) {
  await openDetailPanel();
  if (typeof window.switchPostingSettingsTab === 'function') window.switchPostingSettingsTab(tab);
}

/**
 * 단계 정의 — 완전자동발행 순서 (v3.8.686 사장님 지시로 재배열).
 * sel: 가리킬 대상(여러 개면 화살표도 여러 개). before: 그 화면으로 데려가는 동작.
 *
 * 설정 안 순서: 모드 → 모델(테라 카드) → 키(OpenAI 칸) → 네이버 API HUB(맨 아래 칸) →
 *              [API 키 발급받기] → (원하면) Agent 모드 → [저장]
 * 글포스팅 순서: 탭 → 키워드 → [상세설정] → 이미지 엔진(값) → 배치 → 엔진 고정 →
 *              콘텐츠 모드 → 말투 → 제목 옵션 → 팩트체크 → 발행 방식 → [블로그 글 작성 시작]
 */
const STEPS = [
  {
    before: null, sel: ['#nav-settings'], autoNext: true,
    title: '왼쪽 맨 아래 [설정]으로 들어갑니다',
    body: '모든 준비는 여기서 합니다. 한 번만 해두면 다음부터는 바로 글만 쓰면 됩니다.',
  },
  {
    before: goSettingsModal, sel: ['#executionModeApiBtn', '#executionModeAgentBtn'], autoNext: true,
    title: 'API 키 모드와 Agent 모드 중 하나를 고릅니다',
    body: '처음이라면 <b>API 키 모드</b>가 간단합니다. 쓰는 만큼 충전해서 쓰는 방식입니다. '
      + '<b>Agent 모드</b>는 코덱스·제미나이 CLI 구독으로 씁니다(뒤에서 다시 안내합니다).',
  },
  {
    before: goSettingsModal, sel: ['#tierCardTerra'],
    title: '글 쓰는 AI 모델을 고릅니다',
    body: '처음에는 <b>지피티 5.6 테라</b>를 추천합니다. 품질과 값의 균형이 가장 좋습니다. '
      + '대량 발행이면 값이 훨씬 싼 <b>루나</b>도 됩니다. 값은 카드에 적힌 금액을 보세요.',
  },
  {
    before: goSettingsModal, sel: ['#openaiKey'],
    title: 'API 키를 넣습니다',
    body: '고른 모델에 맞는 키를 넣습니다. 테라·루나는 <b>OpenAI API Key</b> 칸입니다. 키는 이 컴퓨터에만 저장됩니다.',
  },
  {
    before: goSettingsModal, sel: ['#naverApiHubKeyId', '#naverApiHubKey'],
    title: '네이버 API HUB 키를 발급받아 넣습니다',
    body: '설정 맨 아래 칸입니다. 네이버클라우드 콘솔 → AI·NAVER API 에서 발급합니다. 검색 자료를 모아 글의 근거로 씁니다. '
      + '개발자센터 옛 키는 2027-06-30 에 끝나니, HUB 키를 넣어 두면 그대로 이어집니다.',
    tip: '⚠️ Application 등록할 때 <b>서비스 선택</b>에서 <b>검색</b>과 <b>Search Trend</b>를 꼭 체크하세요. 안 하면 키가 맞아도 429로 거절됩니다.',
  },
  {
    before: goSettingsModal, sel: ['#apiKeyGuideBtn'],
    title: '키 발급이 처음이면 [API 키 발급받기]를 누릅니다',
    body: '발급 방법 <b>영상 안내</b>가 열립니다. 영상을 보면서 원하는 키를 발급받아 위 칸에 넣으세요. 이미 넣었으면 [다음].',
  },
  {
    before: goSettingsModal, sel: ['#executionModeAgentBtn'],
    title: '에이전트로 쓰고 싶다면',
    body: '코덱스·제미나이 CLI <b>구독</b>이 있으면 <b>Agent 모드</b>를 누르고 안내대로 로그인합니다. API 요금이 따로 들지 않습니다. '
      + 'API 키로 쓸 거면 그냥 [다음].',
  },
  {
    before: goSettingsModal, sel: ['#settingsSaveBtn'], autoNext: true,
    title: '[저장]을 누릅니다',
    body: '여기까지 넣은 키와 모델이 저장됩니다. <b>저장하지 않으면 전부 사라집니다.</b>',
  },
  {
    before: goPostingTab, sel: ['#nav-auto'], autoNext: true,
    title: '이제 왼쪽 [글포스팅] 탭으로 갑니다',
    body: '준비가 끝났습니다. 여기서부터가 실제로 글을 만드는 자리입니다.',
  },
  {
    before: goPostingTab, sel: ['#keywordInput'],
    title: '키워드를 넣습니다',
    body: '쓰고 싶은 주제를 넣습니다. <b>줄바꿈으로 여러 개</b> 넣으면 연속발행이 됩니다.',
  },
  {
    before: goPostingTab, sel: ['#postingSettingsToggleBtn'], autoNext: true,
    title: '오른쪽 아래 [상세설정]을 누릅니다',
    body: '누르면 설정 페이지가 펼쳐집니다. 아래 단계는 전부 이 안에 있습니다.',
  },
  {
    before: () => goDetailTab('tab-image'), sel: ['#thumbnailType'],
    title: '이미지 엔진은 값을 보고 고릅니다',
    body: '<b>나노바나나2</b>는 품질이 좋지만 <b>장당 90원 정도</b>(6장이면 540원쯤) 듭니다.',
    tip: '💡 싼 걸 원하시면 <b>프로디아</b>(1글 8원쯤)를 추천합니다. 지피티 키만 있다면 <b>지피티 이미지2(덕테이프)</b>.',
  },
  {
    before: () => goDetailTab('tab-image'), sel: ['#h2ImageSource'],
    title: '소제목 이미지 배치를 정합니다',
    body: '전체 / 홀수 / 짝수 중에 고르고, 썸네일만 만들 거면 썸네일만 고르면 됩니다. '
      + '<b>내 폴더 이미지</b>를 고르면 엔진은 쓰지 않습니다.',
    tip: '💡 이미지 수가 곧 비용입니다. 값을 보면서 정하세요.',
  },
  {
    before: () => goDetailTab('tab-image'), sel: ['#strictH2ImageEngine'],
    title: '엔진 고정 모드',
    body: '평소에는 글 생성이 실패하면 다른 모델로 자동으로 넘어갑니다. 이걸 켜면 <b>고른 모델 하나만</b> 씁니다.',
    tip: '⚠️ 켜둔 상태에서 실패하면 다른 모델로 안 넘어가고 <b>작업이 멈춥니다</b>.',
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
    before: goPostingTab, sel: ['#publishBtn'],
    title: '완전자동발행 — [블로그 글 작성 시작]을 누릅니다',
    body: '확인 없이 <b>생성부터 발행까지 한 번에</b> 갑니다. '
      + '먼저 보고 고치고 싶으면 옆의 <b>반자동 발행</b>을 누르면 미리보기에서 고친 뒤 발행합니다.',
  },
  {
    before: null, sel: [],
    title: '준비 끝났습니다',
    body: '충분히 숙지하시고 <b>돈 많이 버시길 바랍니다</b>. 이 안내는 언제든 헤더의 [📖 사용법]으로 다시 보실 수 있습니다.',
  },
];

let tourIndex = 0;
let tourActive = false;
/** 대상 클릭으로 자동 진행할 때 걸어 둔 리스너들 — 단계가 바뀌면 반드시 뗀다 */
let autoNextCleanups = [];

export async function showUsageTour(startAt = 0) {
  if (stepping) return;   // 헤더 버튼 연타로 두 번 시작되지 않게
  ensureStyles();
  tourActive = true;
  tourIndex = Math.max(0, Math.min(startAt, STEPS.length - 1));
  addLog('📖 완전자동발행 사용법 따라하기를 시작합니다', 'info');
  stepping = true;
  try { await renderStep(); }
  finally { stepping = false; }
}

function endTour(reason = 'done') {
  tourActive = false;
  runAutoNextCleanups();
  stepping = false;
  stopTracking();
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

/**
 * 🔒 v3.8.563 — 한 번에 한 걸음만.
 *
 * 사장님 보고: "F11 눌러서 버튼 누르니까 인식이 엄청 느려" +
 *              "순차적으로 넘어가야 되는데 1번 3번 5번 이런식으로 넘어가거든"
 *
 * **두 증상은 같은 원인이다.** renderStep() 은 s.before() 로 화면을 옮기는데
 * 그 동안 화면에는 **이전 단계 카드가 그대로** 떠 있고 [다음] 버튼도 살아 있다.
 * 반응이 없어 보이니 한 번 더 누르고, 그러면 step(+1) 이 두 번 돌아 한 칸을 건너뛴다.
 *
 * 그래서 두 가지를 같이 한다.
 *   ① 진행 중에는 다음 요청을 **무시한다**(쌓아 두지 않는다 — 쌓으면 결국 또 건너뛴다)
 *   ② 누른 즉시 버튼을 잠그고 눌린 티를 낸다(아래 markBusy) — 기다리는 줄 알게
 */
let stepping = false;

/** 누른 즉시 반응을 보여 준다. 실제 이동은 그다음이다. */
function markBusy() {
  const card = popEl?.querySelector('.ut-card');
  if (!card) return;
  card.classList.add('is-busy');
  card.querySelectorAll('.ut-btn').forEach((b) => { b.disabled = true; });
}

async function step(delta) {
  if (stepping) return;               // ← 1→3→5 를 막는 자리
  const next = tourIndex + delta;
  if (next < 0) return;
  if (next >= STEPS.length) { endTour('done'); return; }
  stepping = true;
  markBusy();
  tourIndex = next;
  try { await renderStep(); }
  finally { stepping = false; }
}

/** 화면에 그려져 있는가(크기가 0 이 아닌가) */
function isDrawn(el) {
  const r = el.getBoundingClientRect();
  return !!(r.width || r.height);
}

/**
 * 대상이 그려져 자리를 잡을 때까지 **프레임 단위로** 기다린다. (v3.8.686)
 *
 * 고정 ms 대기의 대체다. 모달이 열리고 탭이 바뀐 직후엔 한두 프레임 뒤에야 좌표가
 * 확정된다. 같은 좌표가 두 프레임 이어지면 잡힌 것으로 본다. 상한(maxMs)을 넘기면
 * 그냥 진행한다 — 안 그려지는 대상은 renderStep 이 "대상 없음"으로 건너뛴다.
 */
async function settle(targets, maxMs = 480) {
  const t0 = performance.now();
  let prev = '';
  do {
    await new Promise((r) => requestAnimationFrame(r));
    const first = targets.find(isDrawn);
    if (first) {
      const r = first.getBoundingClientRect();
      const key = `${Math.round(r.top)}:${Math.round(r.left)}:${Math.round(r.height)}`;
      if (key === prev) return true;
      prev = key;
    }
  } while (performance.now() - t0 < maxMs);
  return false;
}

async function renderStep() {
  const s = STEPS[tourIndex];
  clearHighlights();

  if (typeof s.before === 'function') {
    try { await s.before(); } catch (err) { console.warn('[USAGE-TOUR] 화면 이동 실패:', err); }
  }

  // 대상을 못 찾으면 조용히 빈 화면을 보여주지 않는다 — 남기고 넘어간다
  const found = [];
  s.sel.forEach((sel) => {
    const el = document.querySelector(sel);
    if (el) found.push(el);
    else console.warn(`[USAGE-TOUR] ⚠️ ${tourIndex + 1}단계 대상을 찾지 못했습니다: ${sel}`);
  });
  if (found.length) await settle(found);
  /**
   * 있어도 **안 그려진** 대상은 없는 것과 같다 — Agent 모드면 모델 카드·키 칸이 숨겨진다.
   * 숨겨진 칸을 가리키며 "여기에 넣으세요" 하면 사용자는 빈 화면만 본다.
   */
  const targets = found.filter(isDrawn);
  found.filter((el) => !targets.includes(el))
    .forEach((el) => console.warn(`[USAGE-TOUR] ⚠️ ${tourIndex + 1}단계 대상이 화면에 그려지지 않았습니다: #${el.id || el.tagName}`));
  if (s.sel.length && !targets.length) {
    console.warn(`[USAGE-TOUR] ${tourIndex + 1}단계를 건너뜁니다 (대상 없음)`);
    /**
     * ⚠️ step(+1) 을 부르면 안 된다 — renderStep 은 step() 안에서 실행되므로
     * stepping 가드에 **자기가 막힌다**(대상 없는 단계에서 투어가 멎는다).
     * 여기서는 커서만 직접 옮기고 다시 그린다.
     */
    if (tourIndex + 1 >= STEPS.length) { endTour('done'); return; }
    tourIndex += 1;
    await renderStep();
    return;
  }

  const pop = getPop();
  setCard(`
      <div class="ut-step">${tourIndex + 1} / ${STEPS.length}</div>
      <h4 class="ut-title">${s.title}</h4>
      <p class="ut-body">${s.body}</p>
      ${s.tip ? `<div class="ut-tip">${s.tip}</div>` : ''}
      <div class="ut-row">
        <button class="ut-skip" data-ut-skip>건너뛰기</button>
        <span class="ut-spacer"></span>
        ${tourIndex > 0 ? '<button class="ut-btn ut-prev" data-ut-prev>이전</button>' : ''}
        <button class="ut-btn ut-next" data-ut-next>${tourIndex === STEPS.length - 1 ? '시작하기' : '다음'}</button>
      </div>`, targets.length);

  targets.forEach((t) => t.classList.add('ut-lit'));

  /**
   * 대상을 누르면 **알아서 다음으로 넘어간다.** (v3.8.617)
   *
   * 사장님: "설정 유도하고 들어갔으면 밝아지면서 다음으로 자동으로 넘어가야죠"
   *
   * ⚠️ 입력칸에는 걸지 않는다. API 키 칸은 **눌러서 타이핑하는 자리**라
   *    누르자마자 넘어가면 키를 넣을 새가 없다. 그 단계는 [다음]으로 넘어간다.
   *    그래서 단계마다 `autoNext` 를 명시한 것만 이 배선을 받는다.
   */
  if (s.autoNext) {
    targets.forEach((t) => {
      const onHit = () => {
        t.removeEventListener('click', onHit);
        // 누른 화면이 그려질 틈을 준 뒤 넘어간다 — 즉시 넘기면 눌린 티가 안 난다
        setTimeout(() => { if (tourActive) step(+1); }, 200);
      };
      t.addEventListener('click', onHit, { once: true });
      autoNextCleanups.push(() => t.removeEventListener('click', onHit));
    });
  }
  /**
   * v3.8.563 — behavior:'smooth' 를 걷어냈다.
   * 부드러운 스크롤은 끝날 때까지 좌표가 계속 움직여서, 그 사이 잡은 위치가 틀어진다.
   * 즉시 스크롤하면 좌표가 그 자리에서 확정되므로 기다릴 이유가 없다.
   * 부드러움은 카드가 transform 으로 미끄러지는 것(.ut-glide)이 맡는다.
   */
  try { targets[0]?.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch { /* 스크롤 실패는 치명 아님 */ }

  openPop();
  // 레이아웃이 확정된 다음 프레임에 좌표를 잡는다 (고정 대기 대신)
  await nextFrame();
  placeNear(targets);

  /**
   * 좌표가 확정된 **뒤**에 연출을 돌린다.
   * 먼저 돌리면 막이 옛 자리에서 밝아졌다가 툭 옮겨 간다.
   */
  replayReveal([targets.length ? pop.querySelector('.ut-veil') : null, ...targets]);

  pop.querySelector('[data-ut-next]')?.addEventListener('click', () => step(+1));
  pop.querySelector('[data-ut-prev]')?.addEventListener('click', () => step(-1));
  pop.querySelector('[data-ut-skip]')?.addEventListener('click', () => endTour('skip'));
  document.addEventListener('keydown', onTourKey);

  /**
   * 대상이 움직이면 스포트라이트도 따라가야 한다.
   * 스크롤·리사이즈를 투어가 끝날 때까지 계속 따라간다(끝날 때 endTour 가 뗀다).
   */
  trackTargets(targets);
}

/** 다음 페인트까지 — 고정 ms 대기보다 정확하고 빠르다 */
function nextFrame() {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

// ─── 대상 추적 ───────────────────────────────────────────────

let untrack = null;

function trackTargets(targets) {
  stopTracking();
  /**
   * v3.8.686 — 한 프레임에 한 번만. scrollIntoView 하나가 scroll 이벤트를 여러 번 쏘고,
   * 휠 스크롤은 초당 수십 번이다. 그때마다 좌표를 재고 그림자를 다시 쓰면 느린 PC 가 끊긴다.
   */
  let raf = 0;
  const reposition = () => {
    if (!tourActive || raf) return;
    raf = requestAnimationFrame(() => { raf = 0; if (tourActive) placeNear(targets, true); });
  };
  window.addEventListener('resize', reposition);
  document.addEventListener('scroll', reposition, true);
  untrack = () => {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    window.removeEventListener('resize', reposition);
    document.removeEventListener('scroll', reposition, true);
  };
}

function stopTracking() {
  if (untrack) { untrack(); untrack = null; }
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
  btn.title = '완전자동발행 처음부터 따라하기';
  btn.textContent = '📖 사용법';
  btn.style.cssText = 'flex:0 0 auto;padding:8px 14px;background:rgba(99,102,241,.18);'
    + 'border:1px solid rgba(129,140,248,.45);color:#c7d2fe;border-radius:10px;'
    + 'font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap;font-family:inherit;';
  btn.addEventListener('click', () => showUsageTour(0));
  actions.insertBefore(btn, actions.firstChild);
}
