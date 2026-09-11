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
import { addLog, getStorageManager, notifyUser } from './core.js';

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

/**
 * 🤖 v3.8.716 — 에이전트 모델 목록을 **메인에서 받아 온다.**
 *
 * v3.8.714 가 이 자리에서 선언한 적 없는 전역 이름(대문자 카탈로그 상수)을 읽었는데, 그 이름은
 * 렌더러 어디에도 선언된 적이 없다. 선언 없는 이름은 `?.` 로도 못 막는다 —
 * 접근하는 순간 ReferenceError 다. 그래서 **에이전트 모드에서 AI 모델 배지를 누르면**
 * 드롭다운이 통째로 안 열렸다(실측 로그: header-badges.js:400 Uncaught ReferenceError).
 *
 * 목록의 정본은 메인(dist/core/agent-models)이고 `agent:models` 로 준다.
 * 팝오버를 만드는 함수는 동기라, 한 번 받아 두고 캐시를 읽는다.
 * 아직 못 받았으면 모델 줄만 비우고(에이전트 선택은 그대로 된다) 받은 뒤 다시 그린다.
 */
let agentModelCatalog = null;
let agentModelCatalogLoading = null;

function loadAgentModelCatalog() {
  if (agentModelCatalog || agentModelCatalogLoading) return agentModelCatalogLoading;
  agentModelCatalogLoading = Promise.resolve(window.electronAPI?.invoke?.('agent:models'))
    .then((res) => {
      if (res?.ok && res.models && typeof res.models === 'object') {
        agentModelCatalog = res.models;
      } else {
        console.warn('[HEADER-BADGE] 에이전트 모델 목록을 받지 못했습니다:', res?.error || '응답 없음');
      }
      return agentModelCatalog;
    })
    .catch((err) => {
      console.warn('[HEADER-BADGE] 에이전트 모델 목록 조회 실패:', err);
      return null;
    })
    .finally(() => { agentModelCatalogLoading = null; });
  return agentModelCatalogLoading;
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

  /**
   * ⚙️ v3.8.613 — 실행 모드 배지 (에이전트 / API).
   * 사장님: "배찌를 하나더 만들어서 에이전트모드랑 API모드 둘중하나 선택할수있게"
   * 이 배지가 고른 모드에 따라 위 'AI 모델' 배지가 보여주는 목록이 달라진다.
   */
  const execBadge = document.getElementById('executionModeStatus');
  if (execBadge) {
    wireBadge(execBadge, buildExecutionModePop);
    renderExecutionModeBadge();
  } else {
    console.warn('[HEADER-BADGE] ⚠️ executionModeStatus 배지를 찾지 못했습니다');
  }

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

/** 지금 실행 모드 — 저장소가 진실이고, 없으면 API */
function currentExecutionMode() {
  try { return JSON.parse(localStorage.getItem('leadernamExecutionMode') || '"api"') === 'agent' ? 'agent' : 'api'; }
  catch { return localStorage.getItem('leadernamExecutionMode') === 'agent' ? 'agent' : 'api'; }
}

function currentAgentProvider() {
  let raw = 'codex';
  try { raw = JSON.parse(localStorage.getItem('leadernamActiveAgentProvider') || '"codex"'); }
  catch { raw = localStorage.getItem('leadernamActiveAgentProvider') || 'codex'; }
  return ['codex', 'claude', 'gemini'].includes(raw) ? raw : 'codex';
}

const AGENT_LABELS = { claude: 'Claude Code', codex: 'Codex', gemini: 'Gemini CLI' };

/** 실행 배지 글자를 지금 상태에 맞춘다 */
export function renderExecutionModeBadge() {
  const el = document.getElementById('executionModeStatus');
  if (!el) return;
  const agent = currentExecutionMode() === 'agent';
  el.textContent = agent ? `에이전트 · ${AGENT_LABELS[currentAgentProvider()]}` : 'API 키';
  el.style.color = agent ? '#a7f3d0' : '#bfdbfe';
}

/**
 * ⚙️ v3.8.613 — 실행 모드 고르기.
 *
 * 에이전트를 고르면 **연결부터 확인한다.** 사장님 요구:
 *   "에이전트는 연결됫는지 확인먼저하고 연동이안되어있다면 환경설정을 열어줘"
 * 로그인이 안 된 채로 모드만 바뀌면 발행을 눌러야 실패를 알게 된다 — 그전에 잡는다.
 */
function buildExecutionModePop(pop) {
  const mode = currentExecutionMode();
  pop.innerHTML = `<div class="hb-t">글을 무엇으로 쓸지 고릅니다</div>
    <div class="hb-opt${mode === 'api' ? ' sel' : ''}" data-hb-exec="api"><span class="hb-dot"></span>🔑 API 키 모드</div>
    <div class="hb-opt${mode === 'agent' ? ' sel' : ''}" data-hb-exec="agent"><span class="hb-dot"></span>🤖 에이전트 모드 (구독)</div>
    <div class="hb-note">고른 쪽만 'AI 모델' 목록에 나옵니다.</div>`;

  pop.querySelectorAll('[data-hb-exec]').forEach((opt) => {
    opt.addEventListener('click', async (e) => {
      e.stopPropagation();
      const next = opt.dataset.hbExec;
      closeAllPops();

      if (next === 'api') {
        if (typeof window.setAgentExecutionMode === 'function') window.setAgentExecutionMode('api');
        renderExecutionModeBadge();
        try { await window.updateAiModelStatus?.(); } catch { /* 표시 갱신 실패는 발행과 무관 */ }
        addLog('🔑 글 생성을 API 키 모드로 바꿨습니다', 'info');
        return;
      }

      if (typeof window.setAgentExecutionMode !== 'function') {
        notifyUser('에이전트 설정을 아직 불러오지 못했습니다. 설정 → Agent 계정을 한 번 연 뒤 다시 시도해주세요.', 'warning');
        return;
      }

      // 🔌 연결 확인이 먼저다
      addLog('🔌 에이전트 연결 상태를 확인하는 중...', 'info');
      let ready = false;
      try {
        const result = await window.verifyAgentExecutionReadiness?.({ showStatus: false });
        ready = !!(result?.ok ?? result?.ready);
      } catch (err) {
        console.warn('[HEADER-BADGE] 에이전트 연결 확인 실패:', err);
      }

      if (!ready) {
        addLog('⚠️ 에이전트가 연결되지 않았습니다 — 환경설정을 엽니다', 'warning');
        try { window.openSettingsModal?.(); } catch { /* 못 열면 아래 안내로 */ }
        try { await window.refreshAgentModeSettings?.(); } catch { /* 설정 갱신 실패는 무시 */ }
        // 여러 줄 안내는 백틱으로 — 작은따옴표는 줄바꿈을 품지 못한다(앱 전체가 안 뜬다)
        notifyUser(`에이전트가 아직 연결되지 않았습니다.
환경설정 → Agent 계정에서 로그인한 뒤 다시 선택해주세요.`, 'warning');
        return;
      }

      window.setAgentExecutionMode('agent');
      renderExecutionModeBadge();
      try { await window.updateAiModelStatus?.(); } catch { /* 표시 갱신 실패는 발행과 무관 */ }
      addLog(`🤖 글 생성을 에이전트 모드(${AGENT_LABELS[currentAgentProvider()]})로 바꿨습니다`, 'success');
    });
  });
}

function buildModelPop(pop) {
  const radios = modelRadios();
  if (!radios.length) {
    pop.innerHTML = '<div class="hb-t">모델 선택지를 찾지 못했습니다 — 환경설정에서 변경해 주세요</div>';
    console.warn('[HEADER-BADGE] ⚠️ primaryGeminiTextModel 라디오가 없습니다');
    return;
  }
  let agentMode = false;
  try { agentMode = JSON.parse(localStorage.getItem('leadernamExecutionMode') || '"api"') === 'agent'; } catch { agentMode = localStorage.getItem('leadernamExecutionMode') === 'agent'; }

  // v3.8.716: 목록이 아직 없으면 받아 오고, 도착하면 열려 있는 팝오버를 다시 그린다
  if (agentMode && !agentModelCatalog) {
    loadAgentModelCatalog()?.then((catalog) => {
      if (catalog && isPopOpen(pop)) buildModelPop(pop);
    });
  }

  /**
   * 🤖 v3.8.604 — 에이전트를 **이 목록에** 넣는다.
   *
   * 사장님: "배찌에 AI 모델에는 에이전트가 왜없냐고 선택할수있게 드롭다운을 추가해주고 배선해줘야할꺼아냐"
   *
   * 배지는 에이전트일 때 "Claude Code Agent" 라고 **표시는** 했는데, 정작 이 드롭다운에는
   * API 모델만 있어서 고를 수가 없었다. 표시와 선택이 어긋나 있었다.
   * 실행 모드는 codex-workshop 이 들고 있으므로 localStorage 를 직접 쓰지 않고 그쪽 함수를 부른다
   * — 거기에 라이선스 게이트가 들어 있어 우회하면 검사가 통째로 빠진다.
   */
  let agentProvider = 'codex';
  try { agentProvider = JSON.parse(localStorage.getItem('leadernamActiveAgentProvider') || '"codex"'); }
  catch { agentProvider = localStorage.getItem('leadernamActiveAgentProvider') || 'codex'; }
  agentProvider = ['codex','claude','gemini'].includes(agentProvider) ? agentProvider : 'codex';

  // v3.8.608: Gemini CLI 추가. 안티그래비티는 IDE 창을 여는 런처라 헤드리스가 안 된다(실측).
  const AGENTS = [
    { id: 'claude', label: '🟠 Claude Code Agent', note: '구독' },
    { id: 'codex', label: '🧠 Codex Agent', note: '구독' },
    { id: 'gemini', label: '💎 Gemini CLI Agent', note: '구독' },
  ];

  const cur = document.querySelector('input[name="primaryGeminiTextModel"]:checked')?.value || '';

  /**
   * ⚙️ v3.8.613 — **고른 실행 모드의 목록만** 보여준다.
   * 사장님: "에이전트를 선택하면 에이전트만 보여주고 API면 API만보여줘"
   * 예전엔 둘을 한 목록에 섞어 놔서, 지금 무엇으로 쓰는지가 흐릿했다.
   */
  /**
   * 🤖 v3.8.714 — 에이전트를 고른 다음, **그 안에서 모델까지** 고른다.
   *
   * 사장님: "에이전트 내에 모델선택이 가능하자나 페이블이나 오푸스 소넷 등등 …
   *          코덱스도 이번에 아스트라나온것처럼"
   *
   * 목록은 메인이 준다(dist/core/agent-models) — 화면이 따로 적으면 한쪽만 늙는다.
   * 고른 에이전트 밑에만 펼친다. 셋 다 펼치면 목록이 길어 무엇을 쓰는지 흐려진다.
   */
  const curModel = (() => {
    try { return String(window.getAgentModel?.(agentProvider) || ''); } catch { return ''; }
  })();
  const modelRows = (provider) => {
    const list = agentModelCatalog?.[provider];
    if (!list || !list.length) return '';
    return list.map((m) => `
        <div class="hb-opt hb-sub${(m.value || '') === curModel ? ' sel' : ''}" data-hb-agent-model="${m.value}"
             style="padding-left:26px; font-size:12px;" title="${(m.note || '').replace(/"/g, '&quot;')}">
          <span class="hb-dot"></span>${m.label}
        </div>`).join('');
  };

  pop.innerHTML = agentMode
    ? `<div class="hb-t">에이전트 — 구독으로 실행 (API 요금 없음)</div>`
      + AGENTS.map((a) => `
        <div class="hb-opt${a.id === agentProvider ? ' sel' : ''}" data-hb-agent="${a.id}">
          <span class="hb-dot"></span>${a.label}
        </div>` + (a.id === agentProvider ? modelRows(a.id) : '')).join('')
      + `<div class="hb-note">API 모델로 바꾸려면 왼쪽 '실행' 배지에서 API 키 모드를 고르세요.</div>`
    : `<div class="hb-t">글 생성 AI 모델 — 환경설정의 선택과 같은 자리입니다</div>`
      + radios.map((r) => `
        <div class="hb-opt${r.value === cur ? ' sel' : ''}" data-hb-model="${r.value}">
          <span class="hb-dot"></span>${modelLabel(r)}
        </div>`).join('')
      + `<div class="hb-note">에이전트로 쓰려면 왼쪽 '실행' 배지에서 에이전트 모드를 고르세요.</div>`;

  // v3.8.714: 에이전트 안의 모델 선택
  pop.querySelectorAll('[data-hb-agent-model]').forEach((opt) => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof window.setAgentModel !== 'function') {
        notifyUser('에이전트 설정을 아직 불러오지 못했습니다. 설정 → Agent 계정을 한 번 연 뒤 다시 시도해주세요.', 'warning');
        return;
      }
      window.setAgentModel(agentProvider, opt.dataset.hbAgentModel || '');
      try { window.updateAiModelStatus?.(); } catch { /* 배지 갱신 실패는 발행과 무관 */ }
      closeAllPops();
    });
  });

  pop.querySelectorAll('[data-hb-agent]').forEach((opt) => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      const provider = opt.dataset.hbAgent;
      if (typeof window.setAgentProvider !== 'function' || typeof window.setAgentExecutionMode !== 'function') {
        // 조용히 삼키면 "눌렀는데 아무 일도 안 남" 이 된다
        notifyUser('에이전트 설정을 아직 불러오지 못했습니다. 설정 → Agent 계정을 한 번 연 뒤 다시 시도해주세요.', 'warning');
        return;
      }
      window.setAgentProvider(provider);
      window.setAgentExecutionMode('agent');   // 라이선스 게이트가 여기 들어 있다
      renderExecutionModeBadge();   // v3.8.613: 실행 배지도 같이 따라온다
      try { window.updateAiModelStatus?.(); } catch { /* 배지 갱신 실패는 발행과 무관 */ }
      closeAllPops();
      addLog(`🤖 글 생성을 ${({ claude: 'Claude Code', codex: 'Codex', gemini: 'Gemini CLI' })[provider] || provider} 에이전트로 바꿨습니다 (구독 사용량)`, 'info');
    });
  });

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
      /**
       * v3.8.604: API 모델을 골랐으면 에이전트 모드는 끈다 — 둘은 배타적이다.
       * 예전엔 "에이전트를 끈 뒤 적용됩니다" 라는 안내만 띄웠는데, 그러면 사용자는
       * 골라 놓고도 왜 안 바뀌는지 모른 채 에이전트로 계속 발행한다.
       */
      if (agentMode && typeof window.setAgentExecutionMode === 'function') {
        window.setAgentExecutionMode('api');
        renderExecutionModeBadge();   // v3.8.613
      }
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
