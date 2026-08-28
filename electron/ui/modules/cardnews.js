// 🃏 카드뉴스 — 발행 글을 인스타(4:5)·카카오채널(1:1) 카드로 (v3.8.495)
//
// 리서치(2026-08-13) 반영: 웹스토리는 뺐다(구글이 디스커버 캐러셀에서 제거).
// 인스타 캐러셀이 저장·공유 1위 형식 — 훅 첫 장·저장 유도 마지막 장·Alt 텍스트에 집중.
// 인스타·카카오는 자동 업로드 API 가 승인제라 v1 은 "업로드 직전 상태"(PNG+캡션+Alt)까지 만든다.
import { addLog } from './core.js';

// v3.8.569: 플랫폼별 목록 API 는 더 쓰지 않는다 — 발행글 모달이 플랫폼 구분 없이 한 곳에 모아준다.

// 이미지 소스 — main 의 card-image.ts CARD_IMAGE_ENGINES 와 값이 같아야 한다
const ENGINES = [
  { value: 'gptimage2', label: 'GPT 이미지 2 (덕테이프)', note: '글자 렌더링 최상 · 장당 과금' },
  { value: 'dropshot-nanobanana-pro', label: 'dropshot 나노바나나 프로 무제한', note: '비용 0 · 장당 30~60초 · 보드 무제한 토글 ON 필요' },
  { value: 'nanobanana2', label: '나노바나나2', note: 'Gemini 3.1 Flash · 빠름 · 장당 과금' },
  { value: 'nanobananapro', label: '나노바나나 프로', note: 'Gemini 3 Pro · 품질 최상 · 비용 높음' },
  { value: 'gptimage1', label: 'GPT 이미지 1', note: '구형 · 장당 과금' },
  { value: 'none', label: '이미지 없이 (그라데이션)', note: '비용 0 · 즉시' },
];
/** full 모드가 의미 있는 엔진 — 나머지는 골라도 배경 모드로 내려간다 */
const TEXT_CAPABLE = new Set(['gptimage2', 'dropshot-nanobanana-pro']);

const MODES = [
  { value: 'backdrop', label: '배경만 AI + 글자는 앱이 얹기', note: '숫자가 안 틀리고 7장 톤이 통일됩니다 (권장)' },
  { value: 'full', label: '카드 전체를 AI 가 그리기', note: '글자까지 AI · 규격마다 따로 뽑아 이미지 수가 2배 · 숫자·날짜가 틀릴 수 있어 눈으로 검수 필수' },
  // v3.8.521 — 상품 글 전용. 상품 사진을 참고로 "그 상품을 쓰는 장면"을 만든다.
  //   사진만 그대로 쓰는 모드는 없앴다: 상품이 아니라 상품으로 달라지는 모습이 구매를 만든다.
  { value: 'product', label: '🛒 상품 카드 (사용 장면 생성)', note: '장당 과금 · 상품 실물(형태·라벨)은 그대로 두고 쓰는 장면·달라진 결과를 만듭니다 · 참고 이미지 가능한 엔진으로 자동 전환 · 실패하면 실물 사진 그대로' },
];

let state = {
  selected: null, busy: false, lastDir: '',
  plan: [], backdrops: [], engine: 'gptimage2', mode: 'backdrop', keyword: '',
};

export function initCardnews() {
  // v3.8.500: 외부유입 서브탭에서 사이드탭으로 승격 (#cardnews-tab)
  const panel = document.getElementById('cardnews-tab');
  if (!panel || panel.dataset.ready) return;
  panel.dataset.ready = '1';

  // v3.8.532: 카드뉴스 전용 스타일 — #cardnews-tab 밖으로 새지 않는다.
  //   inline 으로 못 쓰는 것(hover·focus·keyframes·스크롤바)만 여기 둔다.
  if (!document.getElementById('cnStyles')) {
    const st = document.createElement('style');
    st.id = 'cnStyles';
    st.textContent = `
      @keyframes cnCardIn { from { opacity:0; transform:translateY(14px) scale(.96); } to { opacity:1; transform:none; } }
      @keyframes cnSheen  { from { transform:translateX(-130%); } to { transform:translateX(330%); } }
      @keyframes cnPulse  { 0%,100% { opacity:1; } 50% { opacity:.35; } }
      #cnBar { position:relative; overflow:hidden; }
      #cnBar.cn-active::after { content:''; position:absolute; top:0; bottom:0; left:0; width:38%;
        background:linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.30), rgba(255,255,255,0));
        animation:cnSheen 1.8s linear infinite; }
      #cnBar.cn-done { background:linear-gradient(90deg,#10b981,#059669) !important; }
      #cnSteps span { font-size:10.5px; font-weight:800; padding:4px 10px; border-radius:999px;
        color:#94a3b8; background:rgba(148,163,184,.08); border:1px solid rgba(148,163,184,.14);
        transition:color .25s, background-color .25s, border-color .25s; }
      #cnSteps span.on { color:#c7d2fe; background:rgba(99,102,241,.16); border-color:rgba(99,102,241,.35); }
      #cnSteps span.ok { color:#6ee7b7; background:rgba(16,185,129,.12); border-color:rgba(16,185,129,.28); }
      #cnLiveDot { width:8px; height:8px; border-radius:50%; background:#6366f1;
        box-shadow:0 0 0 4px rgba(99,102,241,.18); animation:cnPulse 1.6s ease-in-out infinite; flex-shrink:0; }
      #cnLiveWrap[data-state="done"] #cnLiveDot { background:#10b981; box-shadow:0 0 0 4px rgba(16,185,129,.16); animation:none; }
      .cn-live-cell { width:150px; animation:cnCardIn .5s cubic-bezier(0.16,1,0.3,1) both; }
      .cn-live-img { width:150px; aspect-ratio:4/5; object-fit:cover; display:block; border-radius:10px;
        border:1px solid rgba(148,163,184,.22); background:#0f172a; cursor:pointer;
        box-shadow:0 10px 24px rgba(2,6,23,.45);
        transition:transform .18s cubic-bezier(0.16,1,0.3,1), border-color .18s, box-shadow .18s; }
      .cn-live-img:hover { transform:translateY(-3px); border-color:rgba(129,140,248,.55); box-shadow:0 16px 32px rgba(2,6,23,.55); }
      .cn-live-num { margin-top:6px; text-align:center; font-size:11px; font-weight:700; color:#94a3b8; font-variant-numeric:tabular-nums; }
      .cn-kind { display:inline-block; padding:3px 9px; border:1px solid; border-radius:999px; font-size:10.5px; font-weight:800; }
      #cnCards > [data-card] { transition:border-color .18s, background-color .18s; }
      #cnCards > [data-card]:hover { border-color:rgba(148,163,184,.30) !important; background:rgba(15,23,42,.78) !important; }
      #cardnews-tab input:focus, #cardnews-tab textarea:focus, #cardnews-tab select:focus {
        outline:none; border-color:#6366f1 !important; box-shadow:0 0 0 3px rgba(99,102,241,.18); }
      .cn-btn { transition:filter .15s, transform .15s; }
      .cn-btn:hover:not(:disabled) { filter:brightness(1.12); }
      .cn-btn:active:not(:disabled) { transform:translateY(1px); }
      .cn-post { transition:background-color .15s; }
      .cn-post:hover { background:rgba(148,163,184,.06); }
      /* v3.8.569: 라이트박스 좌우 넘김 — 화살표는 사진 위에 떠 있어야 손이 안 움직인다 */
      .cn-lb-nav { position:fixed; top:50%; transform:translateY(-50%); width:52px; height:52px;
        border-radius:50%; border:1px solid rgba(148,163,184,.28); background:rgba(15,23,42,.72);
        color:#e2e8f0; font-size:22px; font-weight:800; cursor:pointer; display:flex;
        align-items:center; justify-content:center; transition:background .15s, transform .15s; }
      .cn-lb-nav:hover { background:rgba(99,102,241,.55); transform:translateY(-50%) scale(1.08); }
      .cn-lb-nav[disabled] { opacity:.25; cursor:default; }
      .cn-lb-nav[disabled]:hover { background:rgba(15,23,42,.72); transform:translateY(-50%); }
    `;
    document.head.appendChild(st);
  }

  panel.innerHTML = `
    <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(148,163,184,0.15); border-radius: 14px; padding: 18px;">
      <div style="font-size: 15px; font-weight: 800; color: #e2e8f0; margin-bottom: 4px;">🃏 발행 글 → 카드뉴스</div>
      <div style="font-size: 12px; color: #94a3b8; margin-bottom: 14px;">
        인스타 4:5 + 카카오채널 1:1 카드와 캡션·Alt 텍스트를 만들어 폴더로 저장합니다.
        훅 첫 장·저장 유도 마지막 장·Alt 는 2026 인스타 알고리즘(리서브·저장·Alt 분석) 대응입니다.
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
        <!-- v3.8.569: 인라인 목록 대신 거미줄·외부유입과 같은 발행글 모달을 쓴다 (사장님 지적).
             플랫폼 고르는 칸도 없앴다 — 모달은 어느 플랫폼 글이든 한 곳에 모아 보여준다. -->
        <button id="cnLoadBtn" class="cn-btn" style="padding: 10px 16px; background: #334155; color: #e2e8f0; border: none; border-radius: 8px; font-size: 13px; font-weight: 800; cursor: pointer;">📚 발행한 글 선택</button>
        <button id="cnMakeBtn" disabled class="cn-btn" style="padding: 10px 16px; background: linear-gradient(135deg,#6366f1,#8b5cf6); color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 800; cursor: pointer; opacity: 0.5;">🃏 카드뉴스 만들기</button>
        <button id="cnOpenBtn" class="cn-btn" style="display:none; padding: 10px 16px; background: #10b981; color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 800; cursor: pointer;">📁 폴더 열기</button>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 6px;">
        <span style="font-size: 12px; font-weight: 800; color: #cbd5e1;">이미지 소스</span>
        <select id="cnEngine" style="padding: 9px 12px; background: #0f172a; color: #e2e8f0; border: 1px solid #334155; border-radius: 8px; font-size: 12.5px; font-weight: 700; min-width: 250px;">
          ${ENGINES.map((e) => `<option value="${e.value}">${e.label}</option>`).join('')}
        </select>
        <select id="cnMode" style="padding: 9px 12px; background: #0f172a; color: #e2e8f0; border: 1px solid #334155; border-radius: 8px; font-size: 12.5px; font-weight: 700; min-width: 250px;">
          ${MODES.map((m) => `<option value="${m.value}">${m.label}</option>`).join('')}
        </select>
      </div>
      <div id="cnEngineNote" style="font-size: 11.5px; color: #64748b; margin-bottom: 12px;"></div>
      <div id="cnStatus" style="font-size: 12px; color: #94a3b8; margin-bottom: 10px;"></div>
      <!-- v3.8.502: 이미지가 붙으면 몇 분 걸린다. 아무 말도 안 하면 멈춘 걸로 보인다 -->
      <!-- v3.8.532: 어디까지 왔는지 단계로 보여준다 — 막대 하나로는 "좋은 걸 쓰는 느낌"이 없다 -->
      <div id="cnProgress" style="display:none; margin-bottom:12px; padding:14px; background:rgba(15,23,42,0.55); border:1px solid rgba(148,163,184,0.14); border-radius:12px;">
        <div id="cnSteps" style="display:flex; gap:6px; margin-bottom:10px;">
          <span data-step="plan">✍️ 문안 설계</span>
          <span data-step="image">🎨 이미지 생성</span>
          <span data-step="render">🃏 카드 조립</span>
        </div>
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
          <div style="flex:1; height:10px; border-radius:5px; background:rgba(148,163,184,0.16); overflow:hidden;">
            <!-- v3.8.532: width 가 아니라 scaleX — 레이아웃 재계산 없이 GPU 합성으로 움직인다.
                 모서리는 부모의 overflow:hidden 이 잘라주므로 시각 차이가 없다. -->
            <div id="cnBar" style="height:100%; width:100%; transform:scaleX(0); transform-origin:left; background:linear-gradient(90deg,#6366f1,#8b5cf6); transition:transform .45s cubic-bezier(0.16,1,0.3,1);"></div>
          </div>
          <span id="cnPct" style="font-size:12px; font-weight:800; color:#a5b4fc; min-width:42px; text-align:right; font-variant-numeric:tabular-nums;">0%</span>
        </div>
        <div id="cnPhase" style="font-size:11.5px; color:#94a3b8;"></div>
      </div>
      <!-- v3.8.569: 고른 글이 무엇인지 남겨둔다 — 모달은 닫히므로 여기 안 보이면 뭘 고른지 알 수 없다 -->
      <div id="cnSource" style="display: none; margin-bottom: 12px;"></div>
      <div id="cnResult" style="display: none;"></div>
    </div>`;

  panel.querySelector('#cnLoadBtn').addEventListener('click', openPostPicker);
  panel.querySelector('#cnMakeBtn').addEventListener('click', createCards);
  panel.querySelector('#cnOpenBtn').addEventListener('click', () => {
    if (state.lastDir) window.blogger?.cardnewsOpenDir?.({ dir: state.lastDir });
  });
  panel.querySelector('#cnEngine').addEventListener('change', syncEngineNote);
  panel.querySelector('#cnMode').addEventListener('change', syncEngineNote);
  syncEngineNote();

  // 진행 상황 구독 — 만드는 동안 어디까지 왔는지 보여준다
  window.blogger?.onCardnewsProgress?.((p) => renderProgress(p));
  window.cnOpenLightbox = openLightbox; // 순차 미리보기 onclick 에서 재사용 (v3.8.517)
  // v3.8.569: 발행글 모달이 고른 글을 여기로 돌려준다. 배선이 없으면 모달이 조용히 아무것도 안 한다.
  window.cardnewsSetSource = cardnewsSetSource;
}

/**
 * 진행률. 이미지 단계가 가장 오래 걸리므로 전체의 70% 를 여기에 준다.
 * 정확한 비율보다 "멈춘 게 아니다"를 보여주는 게 목적이다.
 */
function renderProgress(p) {
  const box = document.getElementById('cnProgress');
  const bar = document.getElementById('cnBar');
  const pct = document.getElementById('cnPct');
  const phase = document.getElementById('cnPhase');
  if (!box || !bar) return;
  box.style.display = '';

  const total = Number(p?.total) || 1;
  const done = Number(p?.index) || 0;
  let value = 0;
  if (p?.phase === 'plan') { value = 5; _clearLivePreview(); }
  else if (p?.phase === 'image') value = 10 + Math.round((done / total) * 60);
  else if (p?.phase === 'render') value = 75 + Math.round((done / total) * 20);
  else if (p?.phase === 'card-done') value = 75 + Math.round(((done + 1) / total) * 20);
  else if (p?.phase === 'done') value = 100;

  bar.style.transform = `scaleX(${value / 100})`;
  if (pct) pct.textContent = value + '%';
  if (phase && p?.label) phase.textContent = p.label;

  // v3.8.532: 단계 칩 — 지금 어느 단계인지, 지나온 단계는 무엇인지 한눈에.
  //   phase 문자열은 main 의 sendCardnewsProgress 계약 그대로 쓴다 (새 배선 없음).
  const STEP_ORDER = ['plan', 'image', 'render'];
  const current = p?.phase === 'card-done' ? 'render' : p?.phase;
  const isDone = current === 'done';
  const curIdx = isDone ? STEP_ORDER.length : STEP_ORDER.indexOf(current);
  box.querySelectorAll('#cnSteps [data-step]').forEach((chip) => {
    const idx = STEP_ORDER.indexOf(chip.dataset.step);
    chip.classList.toggle('ok', idx < curIdx);
    chip.classList.toggle('on', !isDone && idx === curIdx);
  });
  // 진행 중엔 막대에 흐르는 광, 완료엔 에메랄드(앱 공통 "완료" 색)로 정착
  bar.classList.toggle('cn-active', !isDone && value > 0);
  bar.classList.toggle('cn-done', isDone);
  const liveWrap = document.getElementById('cnLiveWrap');
  if (liveWrap) {
    if (isDone) liveWrap.setAttribute('data-state', 'done');
    else if (p?.phase === 'plan') liveWrap.removeAttribute('data-state');
  }

  // v3.8.517: 카드가 완성되는 대로 그 자리에서 순차 미리보기 (첫 규격 기준 1장씩)
  if (p?.phase === 'card-done' && p.file && p.format === 'instagram') {
    _appendLivePreview(p.file, done, total);
  }
}

/** 순차 미리보기 스트립 — 진행 바 아래에 카드가 하나씩 나타난다 */
function _ensureLiveStrip() {
  let strip = document.getElementById('cnLive');
  if (strip) return strip;
  const box = document.getElementById('cnProgress');
  if (!box || !box.parentElement) return null;
  // v3.8.532: 라이브닷 헤더 — "지금 만들어지고 있다"가 눈에 보여야 기다림이 견딜 만하다
  const wrap = document.createElement('div');
  wrap.id = 'cnLiveWrap';
  wrap.style.cssText = 'margin:12px 0;';
  wrap.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
      <span id="cnLiveDot"></span>
      <span style="font-size:12px; font-weight:800; color:#cbd5e1;">라이브 미리보기</span>
      <span style="font-size:11px; color:#94a3b8;">카드가 완성되는 대로 나타납니다 — 누르면 크게 봅니다</span>
    </div>`;
  strip = document.createElement('div');
  strip.id = 'cnLive';
  strip.style.cssText = 'display:flex; gap:12px; flex-wrap:wrap; align-items:flex-start;';
  wrap.appendChild(strip);
  box.parentElement.insertBefore(wrap, box.nextSibling);
  return strip;
}

function _clearLivePreview() {
  const strip = document.getElementById('cnLive');
  if (strip) strip.innerHTML = '';
}

function _appendLivePreview(file, index, total) {
  const strip = _ensureLiveStrip();
  if (!strip) return;
  if (strip.querySelector(`[data-card="${index}"]`)) return; // 중복 방지
  const cell = document.createElement('div');
  cell.setAttribute('data-card', String(index));
  cell.className = 'cn-live-cell';
  cell.innerHTML = `
    <img src="file:///${String(file).replace(/\\/g, '/')}" alt="카드 ${index + 1}" class="cn-live-img"
      onclick="window.cnOpenLightbox && window.cnOpenLightbox(this.src)" />
    <div class="cn-live-num">${index + 1} / ${total}</div>`;
  strip.appendChild(cell);
}

/** 고른 조합이 실제로 어떻게 동작하는지 그 자리에서 알려준다 — 조용히 다르게 동작하면 안 된다 */
function syncEngineNote() {
  const engineSel = document.getElementById('cnEngine');
  const modeSel = document.getElementById('cnMode');
  const note = document.getElementById('cnEngineNote');
  if (!engineSel || !modeSel || !note) return;
  state.engine = engineSel.value;
  state.mode = modeSel.value;

  const engine = ENGINES.find((e) => e.value === state.engine);
  const mode = MODES.find((m) => m.value === state.mode);
  const lines = [];
  /**
   * 상품 모드는 상품 사진을 참고 이미지로 넣어야 성립한다 (v3.8.521).
   * 참고 이미지가 안 되는 엔진을 고르면 상품이 통째로 무시된 AI 생성컷이 나오므로 미리 알린다.
   */
  if (state.mode === 'product') {
    const I2I_CAPABLE = /^(nanobanana|nanobanana2|nanobananapro|gptimage1|gptimage2|dropshot)/i;
    const engineLabel = engine ? engine.label : state.engine;
    let warn = '';
    if (state.engine === 'none') {
      warn = '  ·  ⚠️ 이미지 엔진이 꺼져 있어 장면을 만들지 않고 상품 사진을 그대로 씁니다';
    } else if (!I2I_CAPABLE.test(state.engine)) {
      warn = `  ·  ⚠️ ${engineLabel} 은 참고 이미지를 못 넣습니다 — 가능한 엔진으로 자동 전환됩니다`;
    }
    note.textContent = `${mode.note}${warn}`;
    return;
  }
  if (engine) lines.push(engine.note);
  if (state.engine === 'none') {
    lines.push('이미지를 만들지 않습니다 — 모드 설정은 무시됩니다.');
  } else if (state.mode === 'full' && !TEXT_CAPABLE.has(state.engine)) {
    lines.push('⚠️ 이 엔진은 이미지 안 글자를 제대로 못 그립니다 — 자동으로 “배경만 AI”로 동작합니다.');
  } else if (mode) {
    lines.push(mode.note);
  }
  note.textContent = lines.join('  ·  ');
}

function setStatus(msg) {
  const el = document.getElementById('cnStatus');
  if (el) el.textContent = msg || '';
}

/**
 * v3.8.569 — 발행한 글 선택. 거미줄·외부유입이 쓰는 그 모달을 그대로 연다.
 * 예전엔 플랫폼을 고르고 API 를 따로 때려 인라인 목록을 뿌렸다. 같은 일을 두 벌로 하던 셈이다.
 */
function openPostPicker() {
  if (state.busy) return;
  if (typeof window.openPublishedPostsModal !== 'function') {
    setStatus('❌ 발행글 목록을 열 수 없습니다 — 앱을 다시 켠 뒤 시도해주세요.');
    return;
  }
  window.openPublishedPostsModal({ mode: 'cardnews' });
}

/** 단축링크 탭과 같은 규칙 — 대표이미지가 없으면 본문 첫 이미지를 쓴다 */
function extractThumb(post) {
  const direct = String(post?.imageUrl || post?.thumbnail || '').trim();
  if (direct) return direct;
  const m = String(post?.content || post?.html || '').match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : '';
}

/**
 * 모달이 돌려준 글을 받는다.
 *
 * ⚠️ 필드 이름이 다르다. 발행글 목록은 본문을 `html` 로 들고 있고(외부유입도 같은 객체를 쓴다),
 *    카드뉴스의 createCards 는 `content` 를 읽는다. 여기서 맞춰주지 않으면
 *    "본문을 불러오지 못했습니다" 로 조용히 막힌다.
 */
function cardnewsSetSource(post) {
  if (!post) return;
  const body = String(post.content || post.html || post.summary || post.excerpt || '').trim();
  state.selected = { ...post, content: body };
  renderSource();
  const makeBtn = document.getElementById('cnMakeBtn');
  if (makeBtn) { makeBtn.disabled = !body; makeBtn.style.opacity = body ? '1' : '0.5'; }
  setStatus(body
    ? `선택됨: ${post.title || '제목 없음'}`
    : '❌ 이 글은 본문이 저장돼 있지 않습니다 — 글목록 탭에서 한 번 연 뒤 다시 선택해주세요.');
}

/** 고른 글을 카드로 남긴다 — 모달이 닫히면 뭘 골랐는지 알 방법이 없다 */
function renderSource() {
  const box = document.getElementById('cnSource');
  if (!box) return;
  const post = state.selected;
  if (!post) { box.style.display = 'none'; box.innerHTML = ''; return; }
  const thumb = extractThumb(post);
  box.style.display = '';
  box.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; padding: 11px 13px; background: rgba(99,102,241,0.10); border: 1px solid rgba(99,102,241,0.28); border-radius: 11px;">
      <div style="width: 68px; height: 46px; flex-shrink: 0; border-radius: 8px; overflow: hidden; background: #0f172a; display: flex; align-items: center; justify-content: center;">
        ${thumb
          ? `<img src="${escapeText(thumb)}" alt="" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'">`
          : '<span style="font-size: 18px;">📝</span>'}
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-size: 10.5px; font-weight: 800; color: #a5b4fc; letter-spacing: .3px; margin-bottom: 3px;">카드로 만들 글</div>
        <div style="font-size: 13px; font-weight: 800; color: #e2e8f0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeText(post.title || '제목 없음')}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeText(post.url || '')}</div>
      </div>
      <button id="cnChangeBtn" class="cn-btn" style="flex-shrink: 0; padding: 7px 13px; background: #334155; color: #e2e8f0; border: none; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer;">글 바꾸기</button>
    </div>`;
  box.querySelector('#cnChangeBtn')?.addEventListener('click', openPostPicker);
}

async function createCards() {
  if (state.busy || !state.selected) return;
  const post = state.selected;
  if (!String(post.content || '').trim()) {
    setStatus('❌ 이 글은 본문을 함께 불러오지 못했습니다 — 다른 글을 선택하거나 다시 불러와 주세요.');
    return;
  }
  syncEngineNote();
  state.busy = true;
  const slow = state.engine === 'dropshot-nanobanana-pro';
  setStatus(state.engine === 'none'
    ? '🃏 카드 문안을 설계하는 중… (30초 안팎)'
    : `🃏 카드 문안 설계 + 이미지 생성 중… ${slow ? '(dropshot 은 장당 30~60초라 5분 넘게 걸릴 수 있습니다)' : '(1~3분)'}`);
  addLog(`🃏 카드뉴스 생성 시작: ${post.title} (${state.engine} / ${state.mode})`, 'info');
  try {
    const res = await window.blogger.cardnewsCreate({
      title: post.title, html: post.content, keyword: post.title, url: post.url || '',
      engine: state.engine, mode: state.mode,
    });
    if (!res?.ok) throw new Error(res?.error || '생성 실패');
    state.lastDir = res.dir || '';
    state.plan = Array.isArray(res.plan) ? res.plan : [];
    state.backdrops = new Array(state.plan.length).fill('');
    state.keyword = post.title;
    // v3.8.514: 카카오 채널 자동 발행이 이 결과(카카오 1:1 카드)를 재사용한다 — 재생성 없음
    window.__cardnewsLastResult = {
      dir: res.dir || '',
      files: Array.isArray(res.files) ? res.files : [],
      plan: state.plan,
      caption: res.caption || '',
      postTitle: post.title || '',
      postUrl: post.url || '',
      at: Date.now(),
    };
    if (res.engine) state.engine = res.engine;
    if (res.mode) state.mode = res.mode;
    document.getElementById('cnOpenBtn').style.display = '';
    renderResult(res);
    // 이미지를 원했는데 일부가 빠졌으면 조용히 넘기지 않는다 (그라데이션으로 대체된 장)
    const wanted = Number(res.imagesWanted || 0);
    const made = Number(res.imagesMade || 0);
    const miss = wanted > made ? ` · 이미지 ${wanted - made}장 실패(그라데이션으로 대체)` : '';
    setStatus(`✅ 카드 ${res.cards}장 × 인스타/카카오 저장 완료${wanted ? ` · 이미지 ${made}/${wanted}` : ''}${miss}`);
    addLog(`✅ 카드뉴스 저장: ${res.dir}`, miss ? 'warning' : 'success');
    renderProgress({ phase: 'done', label: '완료' });
  } catch (err) {
    setStatus(`❌ ${err?.message || err}`);
    addLog('❌ 카드뉴스 생성 실패: ' + (err?.message || err), 'error');
    const pb = document.getElementById('cnProgress'); if (pb) pb.style.display = 'none';
  } finally {
    state.busy = false;
  }
}

/**
 * 카드마다 [미리보기 + 문안 수정 + 다시 만들기]를 나란히 둔다.
 * 7장을 통째로 다시 뽑으면 마음에 들던 장까지 바뀌고 비용도 7배다 — 장 단위가 맞다.
 */
function renderResult(res) {
  const box = document.getElementById('cnResult');
  if (!box) return;
  const instaFiles = (res.files || []).filter((f) => f.format === 'instagram');
  const plan = state.plan.length ? state.plan : instaFiles.map(() => ({ kind: 'body', title: '', body: '', alt: '' }));
  box.style.display = '';
  box.innerHTML = `
    <div style="font-size: 12px; color: #94a3b8; margin-bottom: 10px;">
      미리보기 (인스타 4:5) — 장마다 문안을 고치거나 이미지를 다시 뽑을 수 있습니다. 고치면 파일이 바로 덮어써집니다.
    </div>
    <div id="cnCards" style="display: grid; gap: 12px;">
      ${plan.map((card, i) => cardRow(card, i, instaFiles[i], plan.length)).join('')}
    </div>
    <div style="margin-top: 14px; font-size: 12px; color: #cbd5e1;">
      <div style="font-weight: 800; margin-bottom: 4px;">캡션 (복사해서 업로드 시 붙여넣기)</div>
      <textarea readonly style="width: 100%; min-height: 70px; background: #0f172a; color: #e2e8f0; border: 1px solid #334155; border-radius: 8px; padding: 10px; font-size: 12px;">${escapeText(res.caption || '')}</textarea>
    </div>`;

  box.querySelectorAll('[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => regenCard(Number(btn.dataset.idx), btn.dataset.act));
  });
  // v3.8.503: 미리보기가 132px 로는 글자 검수가 안 된다 — 누르면 크게 본다
  box.querySelectorAll('[data-img]').forEach((img) => {
    img.style.cursor = 'zoom-in';
    img.title = '클릭하면 크게 봅니다';
    img.addEventListener('click', () => openLightbox(img.src));
  });
}

/**
 * 지금 화면에 떠 있는 카드 이미지 전부 — 라이트박스에서 좌우로 넘길 목록이다.
 * 결과 카드가 있으면 그걸 쓰고, 만드는 중이면 라이브 스트립을 쓴다.
 */
function galleryImages() {
  const done = document.querySelectorAll('#cnResult [data-img]');
  const live = document.querySelectorAll('#cnLive .cn-live-img');
  const nodes = done.length ? done : live;
  return Array.from(nodes).map((n) => n.src).filter(Boolean);
}

/**
 * 미리보기 확대 — 카드 글자·숫자를 눈으로 검수하려면 실물 크기가 필요하다.
 * v3.8.569: 한 장씩 닫았다 여는 게 아니라 ←/→ 로 넘긴다 (사장님 요청).
 *   인자는 예전대로 src 하나 — 호출부(카드 클릭·라이브 미리보기)를 안 고쳐도 된다.
 */
function openLightbox(src) {
  const prev = document.getElementById('cnLightbox');
  if (prev) prev.remove();

  const images = galleryImages();
  // 목록에 없으면(스트립이 갱신 중이라거나) 그 한 장만 보여준다 — 빈 화면보다 낫다
  let idx = images.indexOf(src);
  const list = idx >= 0 ? images : [src];
  if (idx < 0) idx = 0;

  const overlay = document.createElement('div');
  overlay.id = 'cnLightbox';
  overlay.style.cssText = 'position:fixed; inset:0; z-index:99999; background:rgba(2,6,23,0.9);'
    + ' display:flex; align-items:center; justify-content:center; padding:28px;';
  overlay.innerHTML = `
    <img id="cnLbImg" src="${list[idx]}" style="max-width:min(92vw,760px); max-height:92vh; border-radius:12px;
      box-shadow:0 20px 60px rgba(0,0,0,0.6); cursor:zoom-out;" />
    <button id="cnLbPrev" class="cn-lb-nav" style="left:22px;" aria-label="이전 카드">‹</button>
    <button id="cnLbNext" class="cn-lb-nav" style="right:22px;" aria-label="다음 카드">›</button>
    <div id="cnLbCount" style="position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
      padding:6px 14px; border-radius:999px; background:rgba(15,23,42,.78); border:1px solid rgba(148,163,184,.22);
      color:#e2e8f0; font-size:12.5px; font-weight:800; font-variant-numeric:tabular-nums;"></div>
    <div style="position:fixed; top:16px; right:22px; color:#94a3b8; font-size:13px; font-weight:700;">← → 로 넘기기 · ESC 로 닫기</div>`;

  const imgEl = overlay.querySelector('#cnLbImg');
  const prevBtn = overlay.querySelector('#cnLbPrev');
  const nextBtn = overlay.querySelector('#cnLbNext');
  const countEl = overlay.querySelector('#cnLbCount');

  const show = (next) => {
    idx = Math.max(0, Math.min(list.length - 1, next));
    imgEl.src = list[idx];
    countEl.textContent = `${idx + 1} / ${list.length}`;
    prevBtn.disabled = idx === 0;
    nextBtn.disabled = idx === list.length - 1;
    // 한 장뿐이면 화살표는 자리만 차지한다
    const solo = list.length < 2 ? 'none' : '';
    prevBtn.style.display = solo;
    nextBtn.style.display = solo;
  };

  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(idx - 1);
    else if (e.key === 'ArrowRight') show(idx + 1);
  };

  prevBtn.addEventListener('click', (e) => { e.stopPropagation(); show(idx - 1); });
  nextBtn.addEventListener('click', (e) => { e.stopPropagation(); show(idx + 1); });
  imgEl.addEventListener('click', close);
  // 배경(빈 곳)을 눌렀을 때만 닫는다 — 화살표를 눌러 닫히면 넘길 수가 없다
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
  show(idx);
}

const KIND_LABEL = { hook: '훅 (첫 장)', body: '본문', save: '저장 유도', cta: '클릭 유도' };

// v3.8.532: 역할이 다른 카드는 다르게 보여야 한다 — 앱 공통 시맨틱 색으로.
//   훅=브랜드 인디고(시작), 저장=에메랄드(성과), 클릭=앰버(행동), 본문=슬레이트(바탕).
const KIND_CHIP = {
  hook: 'color:#c7d2fe; background:rgba(99,102,241,.16); border-color:rgba(99,102,241,.32);',
  body: 'color:#cbd5e1; background:rgba(148,163,184,.10); border-color:rgba(148,163,184,.18);',
  save: 'color:#6ee7b7; background:rgba(16,185,129,.14); border-color:rgba(16,185,129,.30);',
  cta:  'color:#fde68a; background:rgba(251,191,36,.13); border-color:rgba(251,191,36,.30);',
};

function cardRow(card, i, file, total) {
  const src = file ? `file:///${String(file.file).replace(/\\/g, '/')}` : '';
  return `
    <div data-card="${i}" style="display: grid; grid-template-columns: 132px 1fr; gap: 12px; padding: 12px; background: rgba(15,23,42,0.6); border: 1px solid rgba(148,163,184,0.15); border-radius: 12px;">
      <div>
        ${src ? `<img data-img="${i}" src="${src}" style="width: 132px; border-radius: 8px; border: 1px solid rgba(148,163,184,0.2); display: block;" />` : ''}
        <div style="margin-top: 7px; display:flex; flex-direction:column; align-items:center; gap:5px;">
          <span class="cn-kind" style="${KIND_CHIP[card.kind] || KIND_CHIP.body}">${KIND_LABEL[card.kind] || '본문'}</span>
          <span style="font-size: 11px; color: #94a3b8; font-variant-numeric:tabular-nums;">${i + 1} / ${total}</span>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <input data-title="${i}" value="${escapeText(card.title || '')}" placeholder="제목 (14자 이내가 잘 읽힙니다)"
          style="padding: 8px 10px; background: #0f172a; color: #e2e8f0; border: 1px solid #334155; border-radius: 7px; font-size: 13px; font-weight: 800;" />
        <textarea data-body="${i}" placeholder="본문 (2줄·60자 이내)"
          style="padding: 8px 10px; min-height: 54px; background: #0f172a; color: #cbd5e1; border: 1px solid #334155; border-radius: 7px; font-size: 12.5px; resize: vertical;">${escapeText(card.body || '')}</textarea>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button data-act="text" data-idx="${i}" class="cn-btn" style="padding: 7px 12px; background: #334155; color: #e2e8f0; border: none; border-radius: 7px; font-size: 12px; font-weight: 800; cursor: pointer;">${state.mode === 'full' ? '✏️ 문안 고쳐 다시 그리기' : '✏️ 문안만 반영 (이미지 유지 · 무료)'}</button>
          <button data-act="image" data-idx="${i}" class="cn-btn" style="padding: 7px 12px; background: linear-gradient(135deg,#6366f1,#8b5cf6); color: #fff; border: none; border-radius: 7px; font-size: 12px; font-weight: 800; cursor: pointer;">🖼️ 이미지 다시 뽑기</button>
          <span data-msg="${i}" style="font-size: 11.5px; color: #94a3b8; align-self: center;"></span>
        </div>
      </div>
    </div>`;
}

/**
 * act='text'  — 이미지는 그대로 두고 글자만 다시 얹는다 (비용 0)
 * act='image' — 이미지를 새로 뽑는다 (엔진에 따라 과금)
 */
async function regenCard(index, act) {
  if (state.busy || !state.lastDir) return;
  const box = document.getElementById('cnResult');
  const msg = box?.querySelector(`[data-msg="${index}"]`);
  const titleEl = box?.querySelector(`[data-title="${index}"]`);
  const bodyEl = box?.querySelector(`[data-body="${index}"]`);
  if (!titleEl || !String(titleEl.value).trim()) {
    if (msg) msg.textContent = '❌ 제목이 비어 있습니다';
    return;
  }
  const prev = state.plan[index] || { kind: 'body', alt: '' };
  const card = {
    kind: prev.kind || 'body',
    title: String(titleEl.value),
    body: String(bodyEl?.value || ''),
    alt: prev.alt || '',
  };
  // 이미지를 유지하려면 직전에 만든 배경이 있어야 한다. 없으면 새로 뽑을 수밖에 없다.
  const reuse = act === 'text' ? (state.backdrops[index] || '') : '';
  if (act === 'text' && !reuse && state.mode !== 'none' && state.engine !== 'none') {
    if (msg) msg.textContent = '이 장의 배경이 아직 손에 없어 새로 뽑습니다…';
  }

  state.busy = true;
  if (msg) msg.textContent = act === 'image' ? '🖼️ 이미지 다시 뽑는 중…' : '✏️ 반영 중…';
  try {
    const res = await window.blogger.cardnewsRegenCard({
      dir: state.lastDir, index, total: state.plan.length || 1, keyword: state.keyword,
      card, engine: state.engine, mode: state.mode, reuseBackdrop: reuse,
    });
    if (!res?.ok) throw new Error(res?.error || '재생성 실패');
    state.plan[index] = card;
    if (res.backdrop) state.backdrops[index] = res.backdrop;
    // 파일명이 같아 브라우저가 옛 그림을 계속 보여준다 — 쿼리를 붙여 강제로 다시 읽힌다
    const img = box?.querySelector(`[data-img="${index}"]`);
    const f = (res.files || []).find((x) => x.format === 'instagram');
    if (img && f) img.src = `file:///${String(f.file).replace(/\\/g, '/')}?t=${Date.now()}`;
    if (msg) msg.textContent = res.reused ? '✅ 문안만 반영 (이미지 유지)' : (res.imageMade ? '✅ 이미지·문안 갱신' : '✅ 반영 (이미지 없음 — 그라데이션)');
    addLog(`🃏 카드 ${index + 1}번 갱신 (${act === 'image' ? '이미지 재생성' : '문안'})`, 'success');
  } catch (err) {
    if (msg) msg.textContent = `❌ ${err?.message || err}`;
    addLog('❌ 카드 재생성 실패: ' + (err?.message || err), 'error');
  } finally {
    state.busy = false;
  }
}

function escapeText(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
