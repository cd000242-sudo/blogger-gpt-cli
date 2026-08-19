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
import { addLog } from './core.js';

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
      .hb-pop { position:absolute; top:calc(100% + 8px); right:0; z-index:300; min-width:250px; max-height:340px; overflow-y:auto;
        background:#111a30; border:1px solid rgba(148,163,184,.3); border-radius:12px; padding:11px;
        box-shadow:0 16px 40px rgba(2,6,23,.6); display:none; text-align:left; }
      .hb-pop.open { display:block; }
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
    if (!e.target.closest('.header-badge.hb-click')) {
      document.querySelectorAll('.hb-pop.open').forEach((p) => p.classList.remove('open'));
    }
  });
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
  badge.appendChild(pop);

  badge.addEventListener('click', (e) => {
    if (e.target.closest('.hb-opt')) return;
    const was = pop.classList.contains('open');
    document.querySelectorAll('.hb-pop.open').forEach((p) => p.classList.remove('open'));
    if (!was) { build(pop); pop.classList.add('open'); }
    e.stopPropagation();
  });
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
      // ② 재시작 이후를 위해 부분 저장 (병합·빈값 스킵이라 다른 키 안전)
      try { await window.blogger?.saveEnv?.({ platform: value }); } catch (err) { console.warn('[HEADER-BADGE] 플랫폼 저장 실패:', err); }
      // ③ 배지 라벨 갱신 — 저장값을 읽는 기존 함수 그대로
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
      try {
        await window.blogger?.saveEnv?.({
          primaryGeminiTextModel: value,
          generationEngine: engine,
          defaultAiProvider: engine,
        });
      } catch (err) { console.warn('[HEADER-BADGE] 모델 저장 실패:', err); }
      closeAllPops();
      addLog(`🎫 글 생성 모델 변경: ${value} (${engine})`, 'info');
    });
  });
}

function closeAllPops() {
  document.querySelectorAll('.hb-pop.open').forEach((p) => p.classList.remove('open'));
}
