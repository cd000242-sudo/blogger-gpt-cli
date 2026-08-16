// 🔧 포스팅 관련 함수들
import { DOMCache, getAppState, getErrorHandler, getStorageManager, ButtonStateManager, getProgressManager, addLog, debugLog, errorLog, successLog } from './core.js';
import { showProgressModal, hideProgressModal, setRunning, showTab, showNotification } from './ui.js';
import { loadSettings } from './settings.js';
import { addTodayWorkRecord } from './calendar.js';
import { getAllKeywords, getH2ImageSections } from './utils.js';
import { showQualityReportModal, accumulateQualityReport } from './quality-report-modal.js';

const AGENT_PROGRESS_STAGES = [
  { id: 'prepare', label: '작업 준비', range: [0, 20] },
  { id: 'article', label: '글 생성', range: [21, 55] },
  { id: 'image', label: '이미지 생성', range: [56, 84] },
  { id: 'publish', label: '발행', range: [85, 100] },
];

function getAgentProgressStage(percent, explicitStage = '') {
  if (explicitStage && AGENT_PROGRESS_STAGES.some((stage) => stage.id === explicitStage)) {
    return explicitStage;
  }
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  return AGENT_PROGRESS_STAGES.find((stage) => value >= stage.range[0] && value <= stage.range[1])?.id || 'prepare';
}

function restoreKeywordInputInteractivity() {
  try {
    const keywordInput = document.getElementById('keywordInput') || DOMCache.get('keywordInput');
    if (keywordInput) {
      keywordInput.disabled = false;
      keywordInput.readOnly = false;
      keywordInput.removeAttribute('disabled');
      keywordInput.removeAttribute('readonly');
      keywordInput.style.pointerEvents = '';
      keywordInput.style.userSelect = '';
      keywordInput.style.opacity = '';
      keywordInput.style.filter = '';
    }

    const keywordInputBlock = document.getElementById('keywordInputBlock');
    if (keywordInputBlock) {
      keywordInputBlock.style.pointerEvents = '';
      keywordInputBlock.style.userSelect = '';
      keywordInputBlock.style.opacity = '';
      keywordInputBlock.style.filter = '';
    }
  } catch (error) {
    console.warn('[POSTING] keyword input restore failed:', error?.message || error);
  }
}

// v3.8.101: Codex 진행 모달 전면 리뉴얼 (사용자 요청 6건)
//   1. 이미지 클릭 → lightbox 크게 보기
//   2. 발행 완료 후 진행 모달 유지 (success 모달 뒤에서 보이게)
//   3. 최소화 버튼 → 하단 mini progress bar
//   4. 발행 중지 버튼
//   5. 레이아웃 재구성 (좌상 큰 이미지 / 우상 그리드 / 하 로그)
//   6. 초반부터 이미지 영역 보이게 (틀 유지)
function ensureAgentProgressModal(provider = 'codex') {
  const overlay = document.getElementById('premiumProgressBar');
  if (!overlay) return;

  const providerLabel = provider === 'claude' ? 'Claude Code' : 'Codex';
  overlay.classList.add('agent-progress-mode');
  // 풀스크린 dim
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(6px);';
  overlay.innerHTML = `
    <div id="agentProgressPanel" style="width:min(1100px, calc(100vw - 48px)); max-height:calc(100vh - 48px); overflow:auto; background:linear-gradient(135deg,#0f172a 0%,#172033 100%); border:1px solid rgba(125,211,252,.28); border-radius:22px; box-shadow:0 30px 90px rgba(0,0,0,.48); padding:24px;">

      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px;">
        <div style="min-width:0;flex:1;">
          <div style="display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;background:rgba(34,211,238,.12);border:1px solid rgba(34,211,238,.24);color:#a5f3fc;font-size:12px;font-weight:800;">${providerLabel} Agent Mode</div>
          <h2 style="margin:12px 0 4px;color:#f8fafc;font-size:24px;line-height:1.2;">Agent 글 생성부터 API 이미지 생성, 발행까지 진행 중</h2>
          <p id="agentProgressStatus" style="margin:0;color:#cbd5e1;font-size:13px;line-height:1.6;">Agent 작업을 준비하고 있습니다.</p>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
          <div id="agentProgressPercent" style="color:#67e8f9;font-size:30px;font-weight:900;line-height:1;">0%</div>
          <button id="agentMinimizeBtn" title="최소화" style="background:rgba(15,23,42,.8);color:#cbd5e1;border:1px solid rgba(148,163,184,.3);border-radius:8px;width:34px;height:34px;cursor:pointer;font-size:16px;font-weight:700;">▾</button>
          <button id="agentStopBtn" title="발행 중지" style="background:rgba(239,68,68,.15);color:#fca5a5;border:1px solid rgba(239,68,68,.5);border-radius:8px;width:34px;height:34px;cursor:pointer;font-size:16px;font-weight:700;">✕</button>
        </div>
      </div>

      <!-- v3.8.108: ChatGPT/Claude 등급별 한도 가이드 -->
      ${provider === 'codex' ? `
      <div style="margin-bottom:14px;padding:10px 14px;background:rgba(125,211,252,.08);border:1px solid rgba(125,211,252,.25);border-radius:10px;color:#a5f3fc;font-size:12px;line-height:1.6;">
        💡 <strong>ChatGPT/Codex 구독 한도는 글 생성에 사용됩니다. 이미지는 선택한 Orbit 이미지 엔진/API 한도를 따릅니다.</strong><br/>
        • <strong>Plus</strong> → 글 생성 한도 도달 시 chatgpt.com/codex에서 리셋 시각 확인<br/>
        • <strong>Pro</strong> → 더 긴 글 생성 작업에 유리<br/>
        • <strong>Team/Enterprise</strong> → Pro와 유사 또는 더 큼<br/>
        한도 도달 메시지: <code style="background:rgba(0,0,0,.3);padding:1px 4px;border-radius:3px;">workspace out of credits</code>
      </div>` : `
      <div style="margin-bottom:14px;padding:10px 14px;background:rgba(168,85,247,.08);border:1px solid rgba(168,85,247,.25);border-radius:10px;color:#e9d5ff;font-size:12px;line-height:1.6;">
        💡 <strong>Claude Code 등급별 5시간 한도 (글 1편 ≈ 10~15% 소비)</strong><br/>
        • <strong>Pro</strong> ($20/월) → 5h당 <strong>6~10편</strong> · 이미지는 우리 앱 dispatcher (사용자 API 키)<br/>
        • <strong>Max 5x</strong> ($100/월) → 5h당 <strong>30~50편</strong><br/>
        • <strong>Max 20x</strong> ($200/월) → 5h당 <strong>100편+</strong> · 사실상 무제한<br/>
        이미지: 선택한 Orbit 이미지 엔진/API 설정을 사용합니다.
      </div>`}

      <div style="height:10px;background:rgba(15,23,42,.95);border:1px solid rgba(148,163,184,.18);border-radius:999px;overflow:hidden;margin-bottom:14px;">
        <div id="agentProgressFill" style="height:100%;width:0%;background:linear-gradient(90deg,#22d3ee,#a78bfa,#34d399);border-radius:999px;transition:width .45s ease;"></div>
      </div>

      <div id="agentProgressStages" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:16px;">
        ${AGENT_PROGRESS_STAGES.map((stage) => `
          <div data-agent-stage="${stage.id}" style="padding:11px 10px;border-radius:10px;border:1px solid rgba(148,163,184,.18);background:rgba(15,23,42,.62);color:#94a3b8;font-size:12px;font-weight:800;text-align:center;transition:all .25s ease;">${stage.label}</div>
        `).join('')}
      </div>

      <!-- 좌측: 큰 미리보기 / 우측: 그리드 미리보기 -->
      <div style="display:grid;grid-template-columns:minmax(0,1.4fr) minmax(280px,1fr);gap:14px;margin-bottom:14px;">
        <div style="background:rgba(2,6,23,.55);border:1px solid rgba(148,163,184,.16);border-radius:14px;padding:14px;display:flex;flex-direction:column;">
          <div style="color:#e2e8f0;font-size:12px;font-weight:900;margin-bottom:10px;">선택한 이미지</div>
          <div id="agentBigPreview" style="flex:1;display:flex;align-items:center;justify-content:center;min-height:260px;background:rgba(15,23,42,.7);border-radius:10px;color:#475569;font-size:13px;text-align:center;padding:12px;">이미지가 생성되면<br/>여기에 크게 표시됩니다</div>
          <div id="agentBigPreviewLabel" style="margin-top:8px;color:#cbd5e1;font-size:12px;font-weight:700;text-align:center;"></div>
        </div>
        <div id="agentGeneratedImagePreviewWrap" style="background:rgba(2,6,23,.52);border:1px solid rgba(52,211,153,.2);border-radius:14px;padding:14px;display:flex;flex-direction:column;min-height:300px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;">
            <strong style="color:#f8fafc;font-size:12px;">생성 이미지 미리보기</strong>
            <span id="agentGeneratedImageCount" style="color:#86efac;font-size:11px;font-weight:800;">0장</span>
          </div>
          <div id="agentGeneratedImageGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;flex:1;align-content:start;overflow-y:auto;max-height:300px;"></div>
        </div>
      </div>

      <!-- 하단: 로그 -->
      <div style="background:rgba(2,6,23,.55);border:1px solid rgba(148,163,184,.16);border-radius:14px;padding:14px;">
        <div style="color:#e2e8f0;font-size:12px;font-weight:900;margin-bottom:10px;">실시간 작업 로그</div>
        <div id="agentProgressInlineLog" style="height:180px;overflow:auto;font-family:Consolas,Monaco,monospace;font-size:12px;line-height:1.7;color:#cbd5e1;"></div>
      </div>
    </div>
  `;

  // 최소화 mini bar (별도 DOM)
  let miniBar = document.getElementById('agentMiniBar');
  if (!miniBar) {
    miniBar = document.createElement('div');
    miniBar.id = 'agentMiniBar';
    miniBar.style.cssText = 'position:fixed;bottom:20px;right:20px;width:340px;background:linear-gradient(135deg,#0f172a,#172033);border:1px solid rgba(125,211,252,.4);border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.5);padding:14px 16px;color:#f8fafc;cursor:pointer;z-index:10000;display:none;transition:transform 0.2s;';
    miniBar.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
        <strong style="font-size:13px;color:#a5f3fc;">${providerLabel} Agent Mode</strong>
        <span id="agentMiniPercent" style="color:#67e8f9;font-size:18px;font-weight:900;">0%</span>
      </div>
      <div style="height:6px;background:rgba(15,23,42,.95);border-radius:999px;overflow:hidden;margin-bottom:6px;">
        <div id="agentMiniFill" style="height:100%;width:0%;background:linear-gradient(90deg,#22d3ee,#a78bfa,#34d399);border-radius:999px;transition:width .35s ease;"></div>
      </div>
      <p id="agentMiniStatus" style="margin:0;color:#cbd5e1;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">진행 중…</p>
      <p style="margin:6px 0 0 0;color:#94a3b8;font-size:10px;text-align:center;">클릭하여 펼치기</p>
    `;
    document.body.appendChild(miniBar);
    miniBar.addEventListener('click', () => {
      miniBar.style.display = 'none';
      overlay.style.display = 'flex';
    });
  } else {
    // 라벨 갱신
    const lblEl = miniBar.querySelector('strong');
    if (lblEl) lblEl.textContent = `${providerLabel} Agent Mode`;
  }

  // 최소화 버튼
  const minBtn = overlay.querySelector('#agentMinimizeBtn');
  if (minBtn) minBtn.addEventListener('click', () => {
    overlay.style.display = 'none';
    miniBar.style.display = 'block';
  });

  // 발행 중지 버튼
  const stopBtn = overlay.querySelector('#agentStopBtn');
  if (stopBtn) stopBtn.addEventListener('click', async () => {
    if (!confirm('진행 중인 Agent 작업을 중지하시겠습니까?\n생성된 글/이미지는 사라집니다.')) return;
    try {
      const api = window.api || null;
      if (api?.cancelTask) api.cancelTask();
      else if (api?.invoke) await api.invoke('cancel-task').catch(() => {});
    } catch {}
    overlay.style.display = 'none';
    if (miniBar) miniBar.style.display = 'none';
    window.__agentProgressActive = false;
  });

  window.__agentProgressActive = true;
  window.__agentProgressOverlay = overlay;
  window.__agentMiniBar = miniBar;
  window.updateAgentProgressUI = updateAgentProgressModal;
  window.appendAgentGeneratedImageUI = appendAgentGeneratedImagePreview;
  updateAgentProgressModal(4, `${providerLabel} 전용 작업 모달을 열었습니다.`, 'info', 'prepare');
}

// v3.8.101: lightbox로 이미지 크게 보기
function openImageLightbox(url, label = '') {
  const existing = document.getElementById('agentImageLightbox');
  if (existing) existing.remove();
  const box = document.createElement('div');
  box.id = 'agentImageLightbox';
  box.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.95);display:flex;align-items:center;justify-content:center;z-index:99998;cursor:zoom-out;padding:30px;box-sizing:border-box;flex-direction:column;gap:12px;';
  const safeLabel = String(label || '').replace(/[<>&]/g, '');
  box.innerHTML = `
    <img src="${url}" style="max-width:95%;max-height:85%;object-fit:contain;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,.6);" />
    ${safeLabel ? `<div style="color:#fff;font-size:14px;font-weight:700;">${safeLabel}</div>` : ''}
    <div style="color:rgba(255,255,255,0.6);font-size:11px;">화면 클릭 시 닫기</div>
  `;
  box.addEventListener('click', () => box.remove());
  document.body.appendChild(box);
}
window.openImageLightbox = openImageLightbox;

function appendAgentGeneratedImagePreview(image = {}) {
  try {
    const url = String(image.url || image.imageUrl || image.thumbnailUrl || '').trim();
    if (!url) return;
    const wrap = document.getElementById('agentGeneratedImagePreviewWrap');
    const grid = document.getElementById('agentGeneratedImageGrid');
    const countEl = document.getElementById('agentGeneratedImageCount');
    const bigPreview = document.getElementById('agentBigPreview');
    const bigLabel = document.getElementById('agentBigPreviewLabel');
    if (!wrap || !grid) return;

    const labelText = String(image.label || '이미지');

    // v3.8.101: 그리드 카드 — div + 클릭 시 큰 미리보기 + lightbox
    const item = document.createElement('div');
    item.style.cssText = 'background:rgba(15,23,42,.8);border:1px solid rgba(148,163,184,.16);border-radius:10px;overflow:hidden;color:#e2e8f0;cursor:pointer;transition:transform 0.15s, border-color 0.15s;';
    item.title = '클릭: 위에 크게 표시 / 더블클릭: 전체 화면';

    const img = document.createElement('img');
    img.src = url;
    img.alt = labelText;
    img.loading = 'lazy';
    img.style.cssText = 'display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:#0f172a;';

    const label = document.createElement('div');
    label.textContent = labelText;
    label.style.cssText = 'padding:6px 8px;font-size:10px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

    item.appendChild(img);
    item.appendChild(label);

    // 큰 미리보기에 표시
    const setBig = () => {
      if (bigPreview) {
        bigPreview.innerHTML = `<img src="${url}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:8px;cursor:zoom-in;" />`;
        const bigImg = bigPreview.querySelector('img');
        if (bigImg) bigImg.addEventListener('click', () => window.openImageLightbox?.(url, labelText));
      }
      if (bigLabel) bigLabel.textContent = labelText;
    };
    item.addEventListener('click', setBig);
    item.addEventListener('dblclick', () => window.openImageLightbox?.(url, labelText));

    grid.appendChild(item);
    if (countEl) countEl.textContent = `${grid.children.length}장`;
    // 가장 최근 이미지를 큰 미리보기에 자동 표시
    setBig();
  } catch (error) {
    console.warn('[AGENT-PROGRESS] image preview append failed:', error);
  }
}

// v3.8.101: mini bar sync
function syncAgentMiniBar(percent, status) {
  try {
    const miniFill = document.getElementById('agentMiniFill');
    const miniPct = document.getElementById('agentMiniPercent');
    const miniStatus = document.getElementById('agentMiniStatus');
    if (miniFill) miniFill.style.width = `${Math.round(percent)}%`;
    if (miniPct) miniPct.textContent = `${Math.round(percent)}%`;
    if (miniStatus && status) miniStatus.textContent = status;
  } catch {}
}

function updateAgentProgressModal(percent, message = '', type = 'info', explicitStage = '') {
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  const activeStage = getAgentProgressStage(safePercent, explicitStage);
  // v3.8.101: mini bar 동시 sync
  try { syncAgentMiniBar(safePercent, message); } catch {}
  try {
    const fill = document.getElementById('agentProgressFill');
    const percentEl = document.getElementById('agentProgressPercent');
    const statusEl = document.getElementById('agentProgressStatus');
    if (fill) fill.style.width = `${safePercent}%`;
    if (percentEl) percentEl.textContent = `${Math.round(safePercent)}%`;
    if (statusEl && message) statusEl.textContent = message;
    document.querySelectorAll('[data-agent-stage]').forEach((card) => {
      const id = card.getAttribute('data-agent-stage');
      const stageIndex = AGENT_PROGRESS_STAGES.findIndex((stage) => stage.id === id);
      const activeIndex = AGENT_PROGRESS_STAGES.findIndex((stage) => stage.id === activeStage);
      card.style.background = stageIndex < activeIndex
        ? 'linear-gradient(135deg, rgba(16,185,129,.95), rgba(5,150,105,.95))'
        : stageIndex === activeIndex
          ? 'linear-gradient(135deg, rgba(14,165,233,.95), rgba(124,58,237,.95))'
          : 'rgba(15,23,42,.62)';
      card.style.color = stageIndex <= activeIndex ? '#fff' : '#94a3b8';
      card.style.borderColor = stageIndex <= activeIndex ? 'rgba(255,255,255,.22)' : 'rgba(148,163,184,.18)';
      card.style.boxShadow = stageIndex === activeIndex ? '0 10px 28px rgba(14,165,233,.24)' : 'none';
    });

    const logEl = document.getElementById('agentProgressInlineLog');
    if (logEl && message) {
      const color = type === 'error' ? '#fecaca' : type === 'success' ? '#bbf7d0' : '#cbd5e1';
      const row = document.createElement('div');
      row.style.color = color;
      row.textContent = `[${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}] ${message}`;
      logEl.appendChild(row);
      logEl.scrollTop = logEl.scrollHeight;
    }
  } catch (error) {
    console.warn('[AGENT-PROGRESS] update failed:', error);
  }
}

// 🔥 완전자동 이미지 소스 설정 모달
export function showAutoImageSourceModal() {
  return new Promise((resolve) => {
    // 기존 모달 제거
    const existingModal = document.getElementById('autoImageSourceModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'autoImageSourceModal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      backdrop-filter: blur(20px);
      z-index: 100000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.3s ease;
    `;

    modal.innerHTML = `
      <style>
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .image-source-option { 
          padding: 16px; 
          border: 3px solid rgba(102, 126, 234, 0.3); 
          border-radius: 14px; 
          cursor: pointer; 
          background: rgba(255, 255, 255, 0.05);
          transition: all 0.3s ease;
          text-align: center;
        }
        .image-source-option:hover {
          border-color: rgba(102, 126, 234, 0.6);
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
        }
        .image-source-option.selected {
          border-color: #fbbf24;
          background: rgba(251, 191, 36, 0.2);
          box-shadow: 0 0 20px rgba(251, 191, 36, 0.3);
        }
      </style>
      
      <div style="width: 90%; max-width: 700px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 24px; padding: 36px; border: 3px solid rgba(251, 191, 36, 0.5); box-shadow: 0 40px 100px rgba(0, 0, 0, 0.6);">
        
        <!-- 헤더 -->
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="font-size: 48px; margin-bottom: 12px;">🖼️</div>
          <h2 style="font-size: 26px; font-weight: 800; color: #fbbf24; margin: 0;">완전자동 이미지 설정</h2>
          <p style="color: #94a3b8; margin-top: 8px; font-size: 14px;">이미지 소스를 선택하고 설정하세요</p>
        </div>
        
        <!-- 이미지 소스 선택 -->
        <div style="margin-bottom: 28px;">
          <label style="display: block; font-size: 14px; font-weight: 700; color: white; margin-bottom: 14px;">📸 이미지 소스 선택</label>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
            <div class="image-source-option selected" data-source="auto" onclick="selectImageSource('auto')">
              <div style="font-size: 28px; margin-bottom: 8px;">🤖</div>
              <div style="font-weight: 700; color: white;">자동 수집</div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">AI가 최적 이미지 자동 선택</div>
            </div>
            <div class="image-source-option" data-source="shopping" onclick="selectImageSource('shopping')">
              <div style="font-size: 28px; margin-bottom: 8px;">🛍️</div>
              <div style="font-weight: 700; color: white;">쇼핑몰 URL</div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">상품 이미지 자동 추출</div>
            </div>
            <div class="image-source-option" data-source="ai" onclick="selectImageSource('ai')">
              <div style="font-size: 28px; margin-bottom: 8px;">🎨</div>
              <div style="font-weight: 700; color: white;">AI 생성</div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">DALL-E, Pollinations 등</div>
            </div>
            <div class="image-source-option" data-source="none" onclick="selectImageSource('none')">
              <div style="font-size: 28px; margin-bottom: 8px;">📝</div>
              <div style="font-weight: 700; color: white;">이미지 없음</div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">텍스트만 발행</div>
            </div>
          </div>
        </div>
        
        <!-- 🔥 콘텐츠 소스 URL 입력 -->
        <div id="contentUrlSection" style="margin-bottom: 28px;">
          <label style="display: block; font-size: 14px; font-weight: 700; color: white; margin-bottom: 10px;">🔗 콘텐츠 소스 URL (선택)</label>
          <input type="url" id="autoContentUrl" placeholder="https://news.zum.com/articles/..."
                 style="width: 100%; padding: 14px 16px; background: rgba(255, 255, 255, 0.1); border: 2px solid rgba(102, 126, 234, 0.3); border-radius: 12px; font-size: 14px; color: white; outline: none; margin-bottom: 8px;"
                 onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='rgba(102, 126, 234, 0.3)'">
          <p style="font-size: 11px; color: #94a3b8;">
            💡 뉴스, 블로그 URL을 입력하면 해당 내용을 기반으로 글을 생성합니다. 비워두면 키워드 기반 생성
          </p>
        </div>
        
        <!-- 쇼핑몰 URL 입력 (조건부 표시) -->
        <div id="shoppingUrlSection" style="display: none; margin-bottom: 28px;">
          <label style="display: block; font-size: 14px; font-weight: 700; color: white; margin-bottom: 10px;">🛍️ 쇼핑몰 상품 URL</label>
          <input type="url" id="autoShoppingUrl" placeholder="https://www.coupang.com/vp/products/..."
                 style="width: 100%; padding: 14px 16px; background: rgba(255, 255, 255, 0.1); border: 2px solid rgba(251, 191, 36, 0.3); border-radius: 12px; font-size: 14px; color: white; outline: none;"
                 onfocus="this.style.borderColor='#fbbf24'" onblur="this.style.borderColor='rgba(251, 191, 36, 0.3)'">
          <p style="font-size: 11px; color: #94a3b8; margin-top: 8px;">
            💡 쿠팡, G마켓, 11번가, 네이버 쇼핑 등 대부분의 쇼핑몰 지원
          </p>
        </div>
        
        <!-- AI 소스 선택 (조건부 표시) -->
        <div id="aiSourceSection" style="display: none; margin-bottom: 28px;">
          <label style="display: block; font-size: 14px; font-weight: 700; color: white; margin-bottom: 10px;">🎨 AI 이미지 생성 소스</label>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
            <label style="padding: 12px; background: rgba(255,255,255,0.05); border: 2px solid rgba(251, 191, 36, 0.5); border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 10px; color: white;">
              <input type="radio" name="autoAiSource" value="nanobananapro" checked>
              <span>🍌 Nano Banana Pro (추천)</span>
            </label>
            <label style="padding: 12px; background: rgba(255,255,255,0.05); border: 2px solid rgba(102, 126, 234, 0.3); border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 10px; color: white;">
              <input type="radio" name="autoAiSource" value="pollinations">
              <span>🌸 Pollinations (무료)</span>
            </label>
            <label style="padding: 12px; background: rgba(255,255,255,0.05); border: 2px solid rgba(102, 126, 234, 0.3); border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 10px; color: white;">
              <input type="radio" name="autoAiSource" value="dalle">
              <span>🎨 DALL-E</span>
            </label>
            <label style="padding: 12px; background: rgba(255,255,255,0.05); border: 2px solid rgba(102, 126, 234, 0.3); border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 10px; color: white;">
              <input type="radio" name="autoAiSource" value="stability">
              <span>🚀 Stability AI</span>
            </label>
            <label style="padding: 12px; background: rgba(255,255,255,0.05); border: 2px solid rgba(102, 126, 234, 0.3); border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 10px; color: white;">
              <input type="radio" name="autoAiSource" value="pexels">
              <span>📷 Pexels (스톡)</span>
            </label>
            <label style="padding: 12px; background: rgba(234,179,8,0.08); border: 2px solid rgba(234, 179, 8, 0.45); border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 10px; color: white;">
              <input type="radio" name="autoAiSource" value="leonardo">
              <span>🦁 Leonardo AI</span>
            </label>
            <label style="padding: 12px; background: rgba(96,165,250,0.08); border: 2px solid rgba(96, 165, 250, 0.45); border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 10px; color: white;">
              <input type="radio" name="autoAiSource" value="flow">
              <span>🌊 Flow (Google AI Plus/Pro 구독 시 무료)</span>
            </label>
          </div>
          <div id="autoLeonardoModelSection" style="display:none; margin-top:12px; padding:14px; background:rgba(234,179,8,0.08); border:1px solid rgba(234,179,8,0.35); border-radius:12px;">
            <label style="display:block; font-size:13px; font-weight:800; color:#fde68a; margin-bottom:8px;">🦁 Leonardo AI 모델 선택</label>
            <select id="autoLeonardoModel" style="width:100%; padding:12px; border:2px solid rgba(250,204,21,0.75); border-radius:10px; background:#111827; color:#facc15; font-size:14px; font-weight:700;">
              <option value="seedream-4.5">☀️ SeeDream 4.5 ($0.04/장, 가성비 최강 추천)</option>
              <option value="phoenix-1.0">🔥 Phoenix 1.0 (토큰 차감, 구독 토큰 활용)</option>
              <option value="ideogram-3.0">✍️ Ideogram 3.0 ($0.11/장, 텍스트 렌더링 특화)</option>
              <option value="gemini-image-2">🌟 Nano Banana Pro ($0.21/장, 한글 텍스트 최강)</option>
            </select>
          </div>
        </div>
        
        <!-- 버튼 -->
        <div style="display: flex; gap: 12px;">
          <button id="autoImageStartBtn" style="flex: 1; padding: 16px 24px; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #1e293b; border: none; border-radius: 14px; font-size: 17px; font-weight: 800; cursor: pointer; box-shadow: 0 8px 30px rgba(251, 191, 36, 0.4);">
            🚀 발행 시작
          </button>
          <button id="autoImageCancelBtn" style="padding: 16px 24px; background: rgba(255, 255, 255, 0.1); color: white; border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 14px; font-size: 15px; font-weight: 600; cursor: pointer;">
            취소
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const syncAutoLeonardoModelSection = () => {
      const section = document.getElementById('autoLeonardoModelSection');
      const aiSource = document.querySelector('input[name="autoAiSource"]:checked')?.value || '';
      if (section) section.style.display = aiSource === 'leonardo' ? 'block' : 'none';
    };
    document.querySelectorAll('input[name="autoAiSource"]').forEach(input => {
      input.addEventListener('change', syncAutoLeonardoModelSection);
    });
    syncAutoLeonardoModelSection();

    // 이미지 소스 선택 함수
    window.selectImageSource = function (source) {
      document.querySelectorAll('.image-source-option').forEach(opt => {
        opt.classList.remove('selected');
      });
      document.querySelector(`.image-source-option[data-source="${source}"]`)?.classList.add('selected');

      // 조건부 섹션 표시
      document.getElementById('shoppingUrlSection').style.display = source === 'shopping' ? 'block' : 'none';
      document.getElementById('aiSourceSection').style.display = source === 'ai' ? 'block' : 'none';
    };

    // 버튼 이벤트
    document.getElementById('autoImageStartBtn').onclick = () => {
      const selectedSource = document.querySelector('.image-source-option.selected')?.dataset.source || 'auto';
      const contentUrl = document.getElementById('autoContentUrl')?.value?.trim() || '';
      const shoppingUrl = document.getElementById('autoShoppingUrl')?.value?.trim() || '';
      const aiSource = document.querySelector('input[name="autoAiSource"]:checked')?.value || 'pollinations';
      const leonardoModel = document.getElementById('autoLeonardoModel')?.value || 'seedream-4.5';

      modal.remove();
      resolve({
        source: selectedSource,
        contentUrl: contentUrl,  // 🔥 콘텐츠 소스 URL
        shoppingUrl: shoppingUrl,
        aiSource: aiSource,
        leonardoModel: leonardoModel
      });
    };

    document.getElementById('autoImageCancelBtn').onclick = () => {
      modal.remove();
      resolve(null);
    };
  });
}

// ─────────────────────────────────────────────────────
// 🚀 발행 실행 함수 — 단일 진입점
// ─────────────────────────────────────────────────────

/**
 * 발행이 끝나면 '이 글'에 딸린 상태를 전부 비운다. (v3.8.414)
 *
 * 사용자 요구(2026-08-02):
 *   "한번 발행완료 되고나면 완벽하게 초기화되어서 다음글이 작성가능할 수 있는 환경이 마련되어야 합니다"
 *
 * 왜 필요한가 — 실측으로 확인한 누수:
 *   · appState.generatedContent.payload 가 다음 발행 payload 에 통째로 스프레드된다
 *     (publishToPlatform: `...(appState.generatedContent.payload || {})`)
 *   · window.__preGeneratedImagesForArticle / __preGeneratedThumbnailForArticle 은
 *     payload 를 만들 때마다 읽힌다(internal-links.js 여러 곳).
 *   지우지 않으면 **다음 글에 지난 글의 이미지와 설정이 그대로 실린다.**
 *   지금까지는 이미지 생성이 '실패'했을 때만 지웠다(v3.8.360) — 성공하면 그대로 남았다.
 *
 * ⚠️ 사용자가 입력한 값(키워드·링크·엔진 선택)은 건드리지 않는다.
 *    그건 다음 글에도 쓸 설정이지 '이 글'의 상태가 아니다.
 */
export function resetArticleStateAfterPublish(reason = 'publish') {
  const cleared = [];
  try {
    const appState = getAppState();
    if (appState?.generatedContent) { appState.generatedContent = null; cleared.push('생성된 글'); }
    if (appState) appState.isCanceled = false;
  } catch { /* 상태 접근 실패가 다음 발행을 막지 않는다 */ }

  try {
    if ((window.__preGeneratedImagesForArticle || []).length) {
      window.__preGeneratedImagesForArticle = [];
      cleared.push('미리 생성 이미지');
    }
    if (window.__preGeneratedThumbnailForArticle) {
      window.__preGeneratedThumbnailForArticle = null;
      cleared.push('미리 생성 썸네일');
    }
    if (window.__shoppingCollectedImageCount !== undefined) {
      window.__shoppingCollectedImageCount = undefined;
      cleared.push('수집 이미지 수');
    }
    // 강제 옵션은 '이번 발행'에만 쓰는 값이라 반드시 비운다
    if (window.__publishForceOptions) {
      window.__publishForceOptions = null;
      cleared.push('강제 옵션');
    }
  } catch { /* noop */ }

  /**
   * v3.8.506 — 발행이 "완료"됐을 때만 1회성 입력칸을 비운다.
   * 키워드·직접 제목은 글마다 다른 값이라 남아 있으면 다음 발행에 그대로 실린다
   * (사용자 보고). 중지(취소)일 땐 건드리지 않는다 — 같은 키워드로 다시 시도할 테니.
   * 세팅(모드·체크박스·플랫폼)은 어느 경우에도 유지한다.
   */
  if (/완료/.test(String(reason))) {
    try {
      const kw = document.getElementById('keywordInput');
      if (kw && kw.value) { kw.value = ''; cleared.push('키워드 칸'); }
      const ct = document.getElementById('customTitle');
      if (ct && ct.value) { ct.value = ''; cleared.push('직접 제목 칸'); }
    } catch { /* noop */ }
  }

  debugLog('POSTING', `발행 후 초기화 (${reason})`, { cleared });
  if (cleared.length) addLog(`🧹 다음 글을 위해 초기화했습니다 (${cleared.join(' · ')})`, 'info');
  return cleared;
}

export async function runPosting() {
  const appState = getAppState();
  let finalResult = {
    ok: false,
    source: 'runPosting',
    published: false,
    error: 'not_started',
    ts: Date.now(),
  };
  const setFinalResult = (next = {}) => {
    const wasPublished = finalResult?.published === true;
    finalResult = {
      ...finalResult,
      ...next,
      ts: Date.now(),
    };
    try { window.__lastPublishResult = finalResult; } catch {}
    /**
     * v3.8.485 - 발행하면 글목록 탭을 새로고침한다.
     *
     * 글목록은 로컬 기록이 아니라 플랫폼 API 에서 그때그때 가져온다. 그런데 새로고침
     * 호출이 "수정발행" 한 곳에만 있어서, 새로 발행한 글은 탭에 안 떴다. 글은 블로그에
     * 정상적으로 올라가 있는데 앱에서만 안 보이는 상태였다 (사장님: "반자동 발행한건
     * 왜 생성된 글목록에 안뜰까요"). 발행 성공으로 막 바뀐 순간에만 한 번 부른다.
     */
    if (!wasPublished && finalResult?.published === true) {
      try { window.__refreshPublishedPosts?.(); } catch { /* 목록 갱신 실패가 발행을 망치면 안 된다 */ }
    }
    return finalResult;
  };
  setFinalResult();
  restoreKeywordInputInteractivity();
  const isQueueRun = !!(window.__queueRunning || window.__queueProgressActive);

  // ── Guard: 중복 실행 방지 ──
  if (appState.isRunning) {
    addLog('작업이 실행 중입니다. 잠시 후 다시 시도해주세요.', 'warning');
    return setFinalResult({ error: 'already_running' });
  }
  if (window.__runPostingInFlight) {
    addLog('이미 발행 요청이 처리 중입니다. 중복 발행을 막기 위해 이번 요청은 건너뜁니다.', 'warning');
    return setFinalResult({ error: 'already_running', duplicateBlocked: true });
  }
  const runPostingLockToken = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  window.__runPostingInFlight = runPostingLockToken;
  const clearRunPostingLock = () => {
    if (window.__runPostingInFlight === runPostingLockToken) {
      window.__runPostingInFlight = null;
    }
  };

  // v3.8.80: API 한도 보호 — 직전 발행 후 90초 미만이면 자동 대기 또는 중단
  if (typeof window._enforcePublishGap === 'function') {
    let okGap = false;
    try {
      okGap = await window._enforcePublishGap(90);
    } catch (gapErr) {
      clearRunPostingLock();
      throw gapErr;
    }
    if (!okGap) {
      addLog('발행 취소 (API 한도 보호 안내)', 'warning');
      clearRunPostingLock();
      return setFinalResult({ error: 'publish_gap_rejected' });
    }
  }

  // ── Guard: 키워드 필수 (v3.5.91 — URL 모드는 키워드 대신 URL이 있으면 통과) ──
  const keywordInput = DOMCache.get('keywordInput');
  const keywordValue = keywordInput?.value?.trim();
  // 단일 입력 모드 확인: 'url' 모드면 referenceUrl이 키워드 역할
  const singleInputMode = (() => {
    try { return localStorage.getItem('singleInputMode') || 'keyword'; }
    catch { return 'keyword'; }
  })();
  // v3.8.410 — 보이는 링크 칸이 곧 '원본 URL' 이다.
  //   v3.8.405 에서 쇼핑모드의 '원본 URL' 칸을 감추고 '제휴 링크' 칸 하나로 합쳤는데,
  //   검증은 referenceUrl 만 봐서 링크를 넣고도 "원본 URL을 입력해주세요"로 막혔다(실측 2026-08-02).
  //   칸을 합쳤으면 검증도 합쳐야 한다.
  const referenceUrlEl = document.getElementById('referenceUrl');
  const referenceUrlValue = [
    referenceUrlEl?.value || '',
    document.getElementById('affiliateLinks')?.value || '',
  ].join('\n').trim();
  const hasValidUrl = referenceUrlValue.split('\n')
    .map(u => u.trim())
    .some(u => u.startsWith('http://') || u.startsWith('https://'));

  if (!keywordValue) {
    if (singleInputMode === 'url' && hasValidUrl) {
      // URL 모드 + 유효 URL 존재 → 통과 (백엔드가 URL 본문에서 키워드 자동 추출)
      console.log('[POSTING] 🔗 URL 모드 — 키워드 생략, URL 본문에서 자동 추출');
    } else if (singleInputMode === 'url' && !hasValidUrl) {
      getErrorHandler().showToast('URL 모드: 원본 URL을 입력해주세요.', 'error');
      clearRunPostingLock();
      return setFinalResult({ error: 'missing_reference_url' });
    } else {
      getErrorHandler().showToast('키워드를 입력해주세요.', 'error');
      clearRunPostingLock();
      return setFinalResult({ error: 'missing_keyword' });
    }
  }

  const executionMode = (() => {
    try { return JSON.parse(localStorage.getItem('leadernamExecutionMode') || '"api"'); }
    catch { return localStorage.getItem('leadernamExecutionMode') || 'api'; }
  })();
  // v3.8.168: 큐 모드(연속발행)에서도 에이전트 모드 인식
  //   사용자 보고: 에이전트로 연속발행하는데 API 키 쓰는 것 같음
  //   원인: shouldUseAgentGeneration이 !isQueueRun 조건 → 큐에서는 무조건 API 모드
  //   해결: 큐 모드여도 executionMode='agent'면 에이전트 사용
  //         (단 generatedContent가 이미 있으면 그것 사용 — 재발행 케이스)
  const wantsAgentGeneration = executionMode === 'agent'
    && (!appState.generatedContent?.content?.trim() || isQueueRun);
  const shouldUseAgentGeneration = wantsAgentGeneration;
  if (isQueueRun && wantsAgentGeneration) {
    console.log('[POSTING] 🤖 큐 모드 + 에이전트 모드 인식 — 에이전트로 생성·발행 진행');
  }
  try {
    debugLog('POSTING', '포스팅 실행 시작');

    // 🛡️ AdSense 모드 + 저자 프로필 미입력 시 사전 경고
    const _contentMode = document.getElementById('contentMode')?.value || 'external';
    const _adsenseAuthorName = document.getElementById('adsenseAuthorName')?.value?.trim() || '';
    if (_contentMode === 'adsense' && !_adsenseAuthorName) {
      const proceed = confirm(
        '⚠️ AdSense 모드 + 저자 프로필 미입력\n\n' +
        '저자 정보가 없으면 1인칭 경험담 섹션이 자동 제외되고, ' +
        '객관적 3인칭 서술로만 작성됩니다.\n\n' +
        '이대로 진행하시겠습니까?\n' +
        '(권장: 취소 → 저자 프로필 입력 후 재시도)'
      );
      if (!proceed) {
        debugLog('POSTING', '사용자 취소: AdSense 저자 프로필 미입력');
        return setFinalResult({ error: 'user_cancelled_adsense_author_warning' });
      }
    }

    // 이미지 소스: 기본값 자동 수집 (모달 없이 즉시 발행)
    // v3.7.15: contentUrl을 큐 force option 또는 main form `#contentUrl` input에서 자동 픽업.
    //   이전엔 하드코딩 빈 값이라 모달 안 통과한 단일/연속발행에서 URL 모드가 동작 안 했음.
    //   force가 set되어 있으면(=큐 실행 중) main form 무시 — 큐 항목이 키워드 모드(빈 contentUrl)
    //   임을 명시했는데 이전 단일 발행의 main form URL을 잘못 끌어오는 오염 방지.
    const __forceActive = typeof window !== 'undefined'
      && window.__publishForceOptions != null
      && typeof window.__publishForceOptions === 'object';
    const __force = __forceActive ? window.__publishForceOptions : {};
    const __mainContentUrl = (typeof document !== 'undefined'
      ? (document.getElementById('contentUrl')?.value || '').trim()
      : '');
    const imageSettings = {
      source: 'auto',
      contentUrl: (__forceActive
        ? (__force.contentUrl || '')
        : __mainContentUrl).trim(),
      shoppingUrl: '',
      aiSource: 'pollinations',
      leonardoModel: 'seedream-4.5',
    };

    // ── 상태 전환 ──
    appState.isRunning = true;
    appState.isCanceled = false;
    setRunning(true);
    if (!isQueueRun) {
      showProgressModal();
    }
    // v3.8.168: 큐 모드에서도 에이전트 progress modal 표시 (큐 모달은 별도로 운영되지만 에이전트 진행 상황 추적용)
    if (shouldUseAgentGeneration) {
      let activeAgentProvider = 'codex';
      try { activeAgentProvider = localStorage.getItem('leadernamActiveAgentProvider') === 'claude' ? 'claude' : 'codex'; } catch {}
      ensureAgentProgressModal(activeAgentProvider);
      updateAgentProgressModal(8, 'Agent 모드: 글 생성과 API 이미지 생성, 발행 작업을 준비합니다.', 'info', 'prepare');
    }

    // ── Payload 생성 (통합 함수 사용) ──
    const queueOverrides = (window.__publishQueuePayloadOverrides && typeof window.__publishQueuePayloadOverrides === 'object')
      ? window.__publishQueuePayloadOverrides
      : {};
    const payload = await createPayload({ previewOnly: false, overrides: queueOverrides });

    // 이미지 설정 오버라이드
    payload.imageSettings = imageSettings;
    if (imageSettings.source === 'ai' && imageSettings.aiSource) {
      payload.h2ImageSource = imageSettings.aiSource;
      debugLog('POSTING', `AI 이미지 소스 설정: ${imageSettings.aiSource}`);
    }
    const selectedLeonardoModel = payload.leonardoModel
      || payload.leonardoModelPreference
      || payload.imageSettings?.leonardoModel
      || document.getElementById('h2LeonardoModel')?.value
      || document.getElementById('thumbnailTypeLeonardoModel')?.value
      || document.getElementById('thumbnailLeonardoModel')?.value
      || document.getElementById('autoLeonardoModel')?.value
      || imageSettings.leonardoModel
      || 'seedream-4.5';
    payload.leonardoModel = selectedLeonardoModel;
    if (payload.imageSettings) payload.imageSettings.leonardoModel = selectedLeonardoModel;
    if (imageSettings.contentUrl) {
      payload.sourceUrl = imageSettings.contentUrl;
      payload.manualCrawlUrls = [imageSettings.contentUrl];
      debugLog('POSTING', `URL 기반 발행: ${imageSettings.contentUrl} (모드: ${payload.contentMode})`);
    }
    if (imageSettings.shoppingUrl) {
      payload.manualCrawlUrls = [...(payload.manualCrawlUrls || []), imageSettings.shoppingUrl];
      debugLog('POSTING', `쇼핑 상품 URL 크롤링 대상 추가: ${imageSettings.shoppingUrl}`);
    }

    // Agent 모드는 텍스트 CLI, 이미지 엔진, 발행 플랫폼이 각각 다른 연결을 사용한다.
    // 단발 발행에서는 시작 전에 모두 실제 확인하고, 연속발행은 큐가 한 번만 같은 검사를 수행한다.
    if (shouldUseAgentGeneration && !isQueueRun && typeof window.verifyAgentExecutionReadiness === 'function') {
      const agentImageEngines = [payload.thumbnailType || payload.thumbnailMode];
      if (payload.imagePolicy !== 'thumbnail-only' && payload.h2ImageMode !== 'none') {
        agentImageEngines.push(payload.h2ImageSource);
      }
      const readiness = await window.verifyAgentExecutionReadiness({
        showStatus: true,
        imageEngines: agentImageEngines.filter(Boolean),
        platforms: [payload.targetPlatform || payload.platform].filter(Boolean),
      });
      if (!readiness?.ready) {
        const blocked = Array.isArray(readiness?.checks)
          ? readiness.checks.filter((check) => !check.ready).map((check) => `${check.label}: ${check.detail}`).join(' / ')
          : '';
        throw new Error(`Agent 실행 준비 확인 실패: ${blocked || readiness?.message || '환경설정에서 바로 연동하기를 진행해주세요.'}`);
      }
    }

    // ── Guard: 백엔드 연결 확인 ──
    if (shouldUseAgentGeneration) {
      if (typeof window.runAgentJobFromPosting !== 'function') {
        throw new Error('Agent 실행 모듈을 아직 준비하지 못했습니다. 앱을 다시 실행한 뒤 시도해주세요.');
      }
      addLog('Agent 모드: 현재 상세설정으로 글 생성을 시작합니다.', 'info');
      updateAgentProgressModal(18, 'Agent 모드: 글은 Agent가 만들고 이미지는 앱 API 엔진으로 생성합니다.', 'info', 'article');
      addLog('Agent 모드: 글 생성 후 앱 이미지 엔진/API로 이미지를 생성합니다.', 'info');
      const agentResult = await window.runAgentJobFromPosting(payload);
      setFinalResult({
        ok: true,
        published: false,
        title: agentResult?.title || payload.title || payload.topic || keywordValue || '',
        url: '',
        error: '',
        agentMode: true,
      });
      appState.isRunning = false;
      setRunning(false);
      ButtonStateManager.restore('publishBtn');
      try {
        const previewModal = document.getElementById('previewModal');
        if (previewModal?.style) previewModal.style.display = 'none';
      } catch {}
      addLog('Agent 생성 완료: 기존 발행 흐름으로 이어서 진행합니다.', 'info');
      updateAgentProgressModal(84, 'Agent 글과 API 이미지를 적용했습니다. 플랫폼 발행을 시작합니다.', 'success', 'publish');
      window.__agentPublishFlowActive = true;
      addLog('Agent 생성 완료: 플랫폼 발행 흐름으로 이어서 진행합니다.', 'info');
      const publishResult = await publishToPlatform();
      const publishedOk = !!(publishResult?.ok || publishResult?.success);
      updateAgentProgressModal(
        publishedOk ? 100 : 94,
        publishedOk ? '발행까지 완료했습니다.' : `발행에 실패했습니다: ${publishResult?.error || 'agent_publish_failed'}`,
        publishedOk ? 'success' : 'error',
        'publish'
      );
      setFinalResult({
        ok: publishedOk,
        published: publishedOk,
        title: publishResult?.title || agentResult?.title || payload.title || payload.topic || keywordValue || '',
        url: publishResult?.url || '',
        error: publishedOk ? '' : (publishResult?.error || 'agent_publish_failed'),
        agentMode: true,
      });
      return finalResult;
    }

    if (!window.blogger?.runPost) {
      throw new Error('백엔드 연결 실패: window.blogger.runPost를 찾을 수 없습니다.');
    }

    // Pre-flight API 키 체크 제거됨 (.env에만 저장된 키는 프론트에서 안 보이므로 false positive 위험)
    // watchdog 타이머 제거됨: 긴 AI 생성/이미지 생성 구간에서 false positive 발생
    // 백엔드가 에러 반환 시 alert로 사용자에게 알림 (line ~310 이후)

    successLog('POSTING', '백엔드 연결 확인 완료');

    // ── 백엔드 호출 (async/await) ──
    // 백엔드는 어떻게든 결과(성공/실패)를 반환하므로 무한 대기는 발생하지 않음
    const result = await window.blogger.runPost(payload);

    successLog('POSTING', '백엔드 응답 수신', {
      hasResult: !!result,
      ok: result?.ok,
      hasTitle: !!result?.title,
      hasContent: !!(result?.html || result?.content),
    });

    if (result?.code === 'PAYWALL') {
      const paywallMessage = result?.message || '무료 체험 발행 횟수를 모두 사용했습니다.';
      setFinalResult({ ok: false, published: false, error: paywallMessage });
      addLog(paywallMessage, 'warning');
      try { window.updateFreeQuotaCounter?.(); } catch {}
      try {
        window._paywallShown = true;
        window.showPaywallModal?.();
      } catch {}
      return finalResult;
    }

    // ── 결과 저장 ──
    if (result && (result.title || result.html || result.content)) {
      appState.generatedContent = {
        title: result.title || '',
        content: result.html || result.content || '',
        thumbnail: result.thumbnail || '',
        payload,
      };
    }

    // ── 성공/실패 처리 ──
    if (result?.ok || result?.success) {
      setFinalResult({
        ok: result.published !== false,
        published: result.published !== false,
        title: result.title || '',
        url: result.url || '',
        error: result.published === false
          ? (result.publishError || result.error || 'publish_failed_after_generation')
          : '',
        needsAuth: !!result.needsAuth,
      });
      // 발행 실패 (콘텐츠는 생성됨) 체크
      if (result.published === false) {
        const publishErrorMessage = result.publishError || result.error || 'publish_failed_after_generation';
        setFinalResult({
          ok: false,
          published: false,
          title: result.title || '',
          url: result.url || '',
          error: publishErrorMessage,
          needsAuth: !!result.needsAuth,
        });
        addLog('⚠️ 콘텐츠는 생성되었지만 발행에 실패했습니다.', 'error');
        addLog('발행 오류: ' + result.publishError, 'error');

        // v3.8.326: 생성된 콘텐츠 자동 저장 → 재발행 큐 (사용자 보고: "생성된 글 날아가는 게 아까움")
        try {
          const republishItem = {
            id: `rp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            savedAt: new Date().toISOString(),
            platform: payload?.platform || payload?.targetPlatform || 'blogger',
            title: result.title || payload?.title || '',
            html: result.html || result.content || '',
            thumbnailUrl: result.thumbnailUrl || result.thumbnail || payload?.thumbnailUrl || '',
            payload: payload || {},
            lastError: publishErrorMessage,
            keyword: payload?.keyword || payload?.title || '',
          };
          const queue = JSON.parse(localStorage.getItem('pendingRepublishQueue') || '[]');
          queue.push(republishItem);
          if (queue.length > 20) queue.splice(0, queue.length - 20); // 최대 20개 유지
          localStorage.setItem('pendingRepublishQueue', JSON.stringify(queue));
          addLog(`💾 콘텐츠 자동 저장됨 (재발행 대기열: ${queue.length}개) — 미리보기 탭에서 [🚀 재발행] 클릭`, 'info');
        } catch (saveErr) {
          console.warn('[REPUBLISH-QUEUE] 저장 실패:', saveErr);
        }

        // 인증 오류 → 설정 탭으로 자동 이동
        if (result.needsAuth || /인증|auth|token|OAuth|invalid_grant/i.test(String(result.publishError))) {
          addLog('🔐 인증이 필요합니다. 환경설정 탭으로 이동합니다...', 'error');
          setTimeout(() => {
            try { showTab('settings'); } catch {}
          }, 1500);
        } else {
          addLog('💡 미리보기에서 콘텐츠를 확인하고, 설정을 점검한 후 다시 발행해주세요.', 'info');
        }
      } else {
        addLog('🎉 블로그 포스트가 성공적으로 발행되었습니다!', 'success');
        try { window.updateFreeQuotaCounter?.(); } catch {}
      }

      // 미리보기 업데이트
      if (result.title || result.html) {
        updatePreview(result.title || '', result.html || result.content || '', result.url);
      }

      // 발행 URL 클릭 가능한 링크로 표시
      if (result.url && result.published !== false) {
        addLog(`🔗 발행된 글: [LINK:${result.url}]`, 'success');
      }

      // v3.7.5: 발행 완료 자동 트래킹 — 달력 일기장에 일별 발행 포스팅 표시
      if (result.published !== false && result.url) {
        try {
          const stored = JSON.parse(localStorage.getItem('publishedPosts') || '{}');
          const d = new Date();
          const dateKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          if (!Array.isArray(stored[dateKey])) stored[dateKey] = [];
          const platform = document.querySelector('input[name="platform"]:checked')?.value || 'wordpress';
          const platformName = (platform === 'blogger' || platform === 'blogspot') ? '블로거' : '워드프레스';
          // v3.7.21: 썸네일 URL 보존 — 거미줄 모달의 발행글 카드에 미리보기 표시용.
          //   orchestration이 반환하는 result.thumbnail은 보통 공개 https URL이라
          //   localStorage 용량 부담이 거의 없음. data: URL이면 길이가 크니까 잘라낸다.
          let thumbForStore = '';
          if (typeof result.thumbnail === 'string' && result.thumbnail) {
            if (/^https?:/i.test(result.thumbnail)) thumbForStore = result.thumbnail;
            else if (/^data:/i.test(result.thumbnail) && result.thumbnail.length < 200000) thumbForStore = result.thumbnail;
          }
          let savedSettingsForPost = {};
          try {
            savedSettingsForPost = JSON.parse(localStorage.getItem('bloggerSettings') || '{}') || {};
          } catch {}
          const postId = result.postId || result.id || result.post_id || '';
          const blogIdForStore =
            result.blogId ||
            savedSettingsForPost.blogId ||
            document.getElementById('blogId')?.value ||
            '';
          const wpSiteUrlForStore =
            result.wordpressSiteUrl ||
            result.siteUrl ||
            savedSettingsForPost.wordpressSiteUrl ||
            document.getElementById('wordpressSiteUrl')?.value ||
            '';
          stored[dateKey].push({
            title: result.title || keywordValue || '제목없음',
            url: result.url,
            platform: platformName,
            time: d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            timestamp: d.getTime(),
            thumbnail: thumbForStore,
            postId: postId ? String(postId) : '',
            id: postId ? String(postId) : '',
            blogId: blogIdForStore ? String(blogIdForStore) : '',
            siteUrl: wpSiteUrlForStore ? String(wpSiteUrlForStore) : '',
            wordpressSiteUrl: wpSiteUrlForStore ? String(wpSiteUrlForStore) : '',
          });
          localStorage.setItem('publishedPosts', JSON.stringify(stored));
          // 달력이 열려 있으면 갱신
          if (typeof window.renderCalendar === 'function') {
            try { window.renderCalendar(); } catch {}
          }
        } catch (e) {
          console.warn('[PUBLISH-TRACK] 발행 트래킹 저장 실패:', e?.message);
        }
      }

      // 작업 기록 (실제 발행 성공 시만)
      if (result.published !== false) {
        const keywords = getAllKeywords();
        const platform = document.querySelector('input[name="platform"]:checked')?.value || 'wordpress';
        const platformName = platform === 'blogger' || platform === 'blogspot' ? '블로거' : '워드프레스';
        keywords.forEach(() => {
          const generatedTitle = getStorageManager().getSync('lastGeneratedTitle') || keywordValue;
          addTodayWorkRecord('포스트 작성 완료', `${platformName}에 "${generatedTitle}" 게시`);
        });

        // v3.8.414: 발행이 끝났으니 이 글에 딸린 상태를 비운다 — 다음 글이 깨끗하게 시작하도록
        resetArticleStateAfterPublish('발행 완료');

        // 🔥 발행 완료 시 모달 닫기
        hideProgressModal();
        const suppressSingleSuccessUi = !!(window.__queueRunning || window.__queueProgressActive);
        if (!suppressSingleSuccessUi) {
          // v3.8.93: 통합 모달 사용 (window.showPublishSuccessModal). 인라인 successOverlay 제거 →
          //   중복 표시 / 분기 충돌 차단. URL이 비어도 모달은 띄우고, main IPC가 지연 신호 줄 수 있도록 짧은 대기.
          //   사용자 보고 (v3.8.146): "콘텐츠 발행완료" 메시지는 뜨지만 새 모달이 안 보임.
          //   원인 추정: 인라인 overlay가 잠깐 떴다 result.url 빈 분기를 타고 4초 자동 닫힘.
          console.log('[POSTING] 발행 완료 — 통합 success 모달 호출', { url: result?.url || '(빈값)', postId: result?.postId || result?.id || '(없음)' });
          try {
            if (typeof window.showPublishSuccessModal === 'function') {
              window.showPublishSuccessModal({
                url: result?.url || '',
                platform: String(platform || '').toLowerCase(),
                platformLabel: platformName || '블로그',
                title: result?.title || '',
                postId: result?.postId || result?.id || '',
              });
            } else {
              // 모달 헬퍼 누락 폴백
              try { showNotification('🎉 블로그 포스트 발행 완료!', 4000); } catch {}
            }
          } catch (overlayErr) {
            console.warn('[SUCCESS-MODAL] 표시 실패(무시):', overlayErr);
            try { showNotification('🎉 블로그 포스트 발행 완료!', 4000); } catch {}
          }
        }

        // 🛡️ v3.5.84: AdSense 품질 리포트 모달 — 단발은 즉시 표시, 큐 모드는 누적
        if (result.qualityReport) {
          try {
            if (window.__queueRunning) {
              accumulateQualityReport(result.qualityReport, { title: result.title });
            } else {
              setTimeout(() => showQualityReportModal(result.qualityReport), 600);
            }
          } catch (modalErr) {
            console.warn('[QUALITY-MODAL] 표시 실패(무시):', modalErr);
          }
        }
      }
    } else if (result?.canceled) {
      // v3.8.415: run-post 가 사용자 중지로 { ok:false, canceled:true } 를 돌려준 경우.
      //   여기로 오는 이유: main.ts 의 checkCanceled() 는 예외를 throw 하지만,
      //   run-post 핸들러가 그 예외를 잡아 canceled:true 결과로 '반환'하기 때문에
      //   여기서는 throw 가 아니라 result.ok===false 분기로 들어온다.
      //   "❌ 블로그 발행 실패"로 보이면 사용자가 다시 시도해야 하는 줄 안다 — 그게 아니다.
      addLog('🛑 작업을 중지했습니다.', 'info');
      hideProgressModal();
      resetArticleStateAfterPublish('중지');
    } else {
      const errorMessage = result?.error || '알 수 없는 오류';

      // v3.7.11: PAYMENT_REQUIRED → 결제 유도 모달 (다른 에러 처리 우회)
      if (typeof errorMessage === 'string' && errorMessage.startsWith('PAYMENT_REQUIRED:')) {
        const parts = errorMessage.split(':');
        const reason = parts[1] || 'none';
        const tail = parts.slice(2).join(':');
        addLog('🛡️ AI 이미지 생성은 1개월 이상 유료 라이선스가 필요합니다.', 'error');
        hideProgressModal();
        if (window.showPaymentModal) {
          window.showPaymentModal({
            message: tail || '1개월 이상 유료 라이선스 결제 후 이용 가능합니다.',
            reason,
            paymentUrl: result?.paymentUrl,
            kakaoUrl: result?.kakaoUrl,
          });
        }
        return;
      }

      if (result?.needsAuth || /인증|auth|token|OAuth|Blogger/i.test(errorMessage)) {
        addLog('❌ 블로그 인증이 필요합니다. 환경설정 탭으로 이동합니다...', 'error');
        setTimeout(() => {
          try { showTab('settings'); } catch {}
        }, 1500);
      } else {
        addLog('포스트 생성 실패: ' + errorMessage, 'error');
      }

      const statusEl = document.getElementById('workStatusTitle');
      const subtitleEl = document.getElementById('workStatusSubtitle');
      if (statusEl) statusEl.textContent = '작업 완료 (오류 발생)';
      if (subtitleEl) subtitleEl.textContent = errorMessage;

      // 🔥 사용자에게 프로미넌트한 에러 알림 (프로그레스 모달 + 토스트 + 알림창)
      hideProgressModal();
      const friendlyMsg = /API 키|api key/i.test(errorMessage)
        ? `${errorMessage}\n\n👉 환경설정 탭에서 해당 API 키를 확인해 주세요.`
        : errorMessage;
      try { getErrorHandler().showToast?.('❌ 발행 실패: ' + errorMessage.slice(0, 120), 'error'); } catch {}
      if (isQueueRun) {
        addLog('연속발행 큐 실패 처리: ' + friendlyMsg, 'error');
      } else {
        setTimeout(() => {
          try { alert('❌ 블로그 발행 실패\n\n' + friendlyMsg); } catch {}
        }, 100);
      }
    }

  } catch (error) {
    // v3.8.415: Agent 모드는 취소를 throw 로 알린다(codex-workshop.js 의 canceledErr).
    //   여기서 못 걸러내면 "❌ 발행 오류: 작업을 중지했습니다" 라는 앞뒤가 안 맞는 토스트가 뜬다.
    if (error?.canceled) {
      setFinalResult({ ok: false, published: false, canceled: true, error: '작업을 중지했습니다.' });
      addLog('🛑 작업을 중지했습니다.', 'info');
      hideProgressModal();
      resetArticleStateAfterPublish('중지');
      return finalResult;
    }

    setFinalResult({
      ok: false,
      published: false,
      error: error?.message || String(error || 'publish_error'),
    });
    errorLog('POSTING', error, { function: 'runPosting' });
    // v3.7.11: PAYMENT_REQUIRED → 결제 유도 모달
    if (typeof error?.message === 'string' && error.message.startsWith('PAYMENT_REQUIRED:')) {
      const parts = error.message.split(':');
      const reason = parts[1] || 'none';
      const tail = parts.slice(2).join(':');
      addLog('🛡️ AI 이미지 생성은 1개월 이상 유료 라이선스가 필요합니다.', 'error');
      hideProgressModal();
      if (window.showPaymentModal) {
        window.showPaymentModal({
          message: tail || '1개월 이상 유료 라이선스 결제 후 이용 가능합니다.',
          reason,
          paymentUrl: error?.paymentUrl,
          kakaoUrl: error?.kakaoUrl,
        });
      }
      return;
    }
    addLog('포스팅 오류: ' + error.message, 'error');
    hideProgressModal();
    // 🔥 예외 발생 시에도 사용자에게 명확히 알림
    try { getErrorHandler().showToast?.('❌ 발행 오류: ' + error.message.slice(0, 120), 'error'); } catch {}
    // v3.8.360: STRICT_ENGINE_FAILED 등 이미지·엔진 실패 시 상태 초기화
    //   과거: 실패해도 window.__preGeneratedImages 등이 남아 다음 발행에서 재사용되며 이전 payload 오염 위험
    //   현재: 실패 시 명시적으로 초기화해 다음 발행이 완전히 새 컨텍스트에서 시작
    try {
      const errMsg = String(error?.message || '');
      if (/STRICT_ENGINE_FAILED|OPENAI_HTTP_5\d\d|이미지 생성 실패/i.test(errMsg)) {
        appState.generatedContent = null;
        window.__preGeneratedImagesForArticle = [];
        window.__preGeneratedThumbnailForArticle = null;
        debugLog('POSTING', '이미지 실패로 상태 초기화 (다음 발행 시 새 컨텍스트)');
      }
    } catch {}
    if (isQueueRun) {
      addLog('연속발행 큐 오류 처리: ' + (error?.message || error), 'error');
    } else {
      setTimeout(() => {
        try { alert('❌ 발행 중 오류 발생\n\n' + error.message); } catch {}
      }, 100);
    }
  } finally {
    // ── 상태 복구 (항상 실행) ──
    appState.isRunning = false;
    setRunning(false);
    restoreKeywordInputInteractivity();
    ButtonStateManager.setEnabled('runBtn', true);
    ButtonStateManager.restore('publishBtn');
    clearRunPostingLock();
    debugLog('POSTING', '상태 복구 완료');

    // v3.8.95: finally 안전망 — success/catch 어느 분기든 결과에 URL이 있으면 모달 무조건 표시.
    //   사용자 보고: "발행 완료 모달이 뜨지 않는다" (반복).
    //   원인 추정: result.success 판정 분기에서 일부 케이스가 빠짐 / 큐 모드 오판정 / catch 우회.
    //   해결: finally는 무조건 실행되므로 여기서 finalResult 보고 한 번 더 시도.
    try {
      const url = String(finalResult?.url || '').trim();
      const postId = String(finalResult?.postId || finalResult?.id || '').trim();
      const ok = finalResult?.ok || finalResult?.success || (!!url || !!postId);
      console.log('[POSTING] finally fallback check', { ok, hasUrl: !!url, hasPostId: !!postId, queue: !!window.__queueRunning });
      if (ok && (url || postId) && !window.__queueRunning && typeof window.showPublishSuccessModal === 'function') {
        // 중복 방지 (success 분기가 이미 띄웠을 수 있음)
        if (!document.getElementById('publishSuccessOverlay')) {
          console.log('[POSTING] finally fallback → showPublishSuccessModal');
          hideProgressModal();
          window.showPublishSuccessModal({
            url,
            platform: String(finalResult?.platform || '').toLowerCase(),
            platformLabel: String(finalResult?.platformLabel || finalResult?.platform || '블로그'),
            title: finalResult?.title || '',
            postId,
          });
        }
      }
    } catch (fallbackErr) { console.warn('[POSTING] finally fallback failed:', fallbackErr); }
    // 🔥 큐 연동 — 연속발행 모드가 다음 항목으로 진행하도록 완료 이벤트 발사
    try {
      window.dispatchEvent(new CustomEvent('bgpt:publish-complete', {
        detail: { source: 'runPosting', ts: Date.now(), result: finalResult, ok: finalResult.ok }
      }));
    } catch {}
  }
  return finalResult;
}

// 발행 함수 (원클릭 발행) — runPosting의 래퍼
/**
 * 왜 기다려야 하는지 설명하는 모달 (v3.8.400)
 *
 * 사용자 지시: "이유는 초보자도 이해할 수 있게 쉽게 풀어서 명확히 설명시켜서 모달을 띄워주고"
 * 토스트 한 줄로는 이유가 전달되지 않는다. 기다리라고만 하면 사용자는 도구가 고장난 줄 안다.
 * 그래서 **무엇을 잃게 되는지**(후기 없는 밋밋한 글)를 먼저 말한다.
 */
function showShoppingCooldownModal(remainingMs) {
  document.getElementById('shoppingCooldownModal')?.remove();

  const mins = Math.max(1, Math.ceil(remainingMs / 60000));
  const wrap = document.createElement('div');
  wrap.id = 'shoppingCooldownModal';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);'
    + 'display:flex;align-items:center;justify-content:center;padding:20px;';
  wrap.innerHTML = `
    <div style="background:#0f172a;color:#e2e8f0;max-width:560px;width:100%;border-radius:16px;
                border:1px solid #334155;box-shadow:0 20px 60px rgba(0,0,0,.5);overflow:hidden;">
      <div style="padding:22px 26px 14px;border-bottom:1px solid #1e293b;">
        <div style="font-size:19px;font-weight:800;color:#fbbf24;">잠깐만요 — 쿠팡 상품 정보를 못 가져올 수 있습니다</div>
      </div>
      <div style="padding:20px 26px;font-size:14.5px;line-height:1.75;">
        <p style="margin:0 0 14px;">
          쇼핑 글이 팔리는 이유는 <b style="color:#fff;">실제로 써본 사람의 후기</b> 때문입니다.
          "3주 써보니 전기요금이 3천원 늘었다" 같은 문장이 있어야 독자가 사고 싶어집니다.
        </p>
        <p style="margin:0 0 14px;">
          그 후기는 쿠팡 상품 페이지에서 가져옵니다. 그런데 쿠팡은
          <b style="color:#fff;">짧은 시간에 여러 번 조회하면 접속을 막습니다.</b>
          (저희가 직접 확인했습니다 — 15번쯤 연속으로 열자 차단됐습니다.)
        </p>
        <p style="margin:0 0 14px;padding:12px 14px;background:#1e293b;border-radius:10px;border-left:3px solid #ef4444;">
          막히면 후기도 상품 스펙도 못 가져옵니다. 그러면 상품명과 가격만 남아서
          <b style="color:#fca5a5;">누구나 쓸 수 있는 뻔한 글</b>이 됩니다.
          클릭은 받아도 구매로 이어지지 않습니다.
        </p>
        <p style="margin:0 0 6px;">
          <b style="color:#34d399;">${mins}분만 쉬었다 쓰시면</b> 후기를 정상적으로 가져옵니다.
          기다리기 아까우시면 <b style="color:#60a5fa;">예약 발행</b>을 걸어두세요 — 예약은 지금 바로 됩니다.
        </p>
        <p style="margin:10px 0 0;font-size:12.5px;color:#94a3b8;">
          <b>쿠팡 링크를 쓸 때만</b> 해당됩니다. 토스·네이버 링크나 일반 글은 쿠팡을 조회하지 않으니 언제든 발행하실 수 있습니다.
        </p>
      </div>
      <div style="padding:14px 26px 22px;display:flex;gap:10px;justify-content:flex-end;">
        <button id="cooldownGoSchedule" style="padding:11px 18px;border-radius:10px;border:1px solid #3b82f6;
                background:transparent;color:#93c5fd;font-weight:700;cursor:pointer;">예약 발행하러 가기</button>
        <button id="cooldownOk" style="padding:11px 20px;border-radius:10px;border:none;
                background:#3b82f6;color:#fff;font-weight:700;cursor:pointer;">알겠습니다</button>
      </div>
    </div>`;

  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.querySelector('#cooldownOk')?.addEventListener('click', close);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  wrap.querySelector('#cooldownGoSchedule')?.addEventListener('click', () => {
    close();
    // 예약 입력칸으로 데려간다 (없으면 조용히 넘어간다 — 모달 때문에 발행이 막히면 안 된다)
    const el = document.getElementById('scheduleDateTime') || document.getElementById('scheduleKeywords');
    try { el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); el?.focus(); } catch {}
  });
}

/**
 * 쇼핑모드 연속 발행 잠금 (v3.8.400)
 *
 * 왜: 쿠팡 상품 페이지를 짧은 시간에 반복 조회하면 실제 Chrome 도 403 이 된다(실측).
 *   막히면 후기·스펙을 못 가져와 글의 재료가 사라진다. 그래서 잠깐 말린다.
 *   시간이 지나면 **자동으로 풀린다** — 사람이 해제할 일이 없다.
 *   ⚠️ 쇼핑모드에만 적용한다. 일반 글은 쿠팡을 두드리지 않는다.
 *
 * @returns 발행을 진행해도 되면 true
 */
async function passesShoppingCooldown() {
  try {
    const mode = document.getElementById('contentMode')?.value || '';
    if (mode !== 'shopping') return true;                     // 쇼핑모드에만 해당

    // v3.8.404 — **쿠팡 링크를 쓸 때만** 쿨다운을 건다.
    //   사용자 보고(2026-08-02): "쿠팡하고 나서 토스로 링크 넣고 발행하려니까 5분 후 발행하라고 막혔다."
    //   맞는 지적이다. 이 쿨다운은 쿠팡이 반복 조회를 403 으로 막기 때문에 만든 것이다.
    //   토스는 정적 요청, 네이버는 헤드리스로 가져오고 둘 다 차단 이력이 없다.
    //   쿠팡을 안 건드리는 발행까지 막을 이유가 없다.
    const linkText = [
      document.getElementById('affiliateLinks')?.value || '',
      document.getElementById('referenceUrl')?.value || '',
      document.getElementById('manualCoupangUrls')?.value || '',
    ].join('\n');
    if (!/coupang\.com|coupa\.ng/i.test(linkText)) return true;

    const res = await window.electronAPI?.invoke?.('shopping:cooldown-status');
    if (!res || res.canPublish !== false) return true;        // 못 읽으면 막지 않는다

    const btn = document.getElementById('publishBtn');
    const original = btn ? btn.innerHTML : '';
    let left = Math.max(0, Number(res.remainingMs) || 0);

    showShoppingCooldownModal(left);

    if (btn) {
      btn.disabled = true;
      btn.dataset.cooldownLocked = '1';
      const tick = () => {
        left -= 1000;
        if (left <= 0) {
          clearInterval(timer);
          btn.disabled = false;
          delete btn.dataset.cooldownLocked;
          btn.innerHTML = original;
          if (window.showToast) window.showToast('✅ 이제 발행하실 수 있습니다', 'success', 5000);
          return;
        }
        const m = Math.floor(left / 60000);
        const s = Math.floor((left % 60000) / 1000);
        btn.innerHTML = `⏳ ${m}:${String(s).padStart(2, '0')} 후 발행 가능 (예약 발행은 지금 가능)`;
      };
      tick();
      const timer = setInterval(tick, 1000);
    }
    return false;
  } catch (e) {
    // 잠금 판정 실패가 발행을 막으면 안 된다
    debugLog?.('PUBLISH', '쇼핑 쿨다운 확인 실패(무시하고 진행)', String(e?.message || e));
    return true;
  }
}

export async function publishToPlatform() {
  const appState = getAppState();
  const isQueueRun = !!(window.__queueRunning || window.__queueProgressActive);
  // 쇼핑모드 연속 발행이면 잠그고 카운트다운 — 시간이 되면 자동으로 풀린다
  if (!isQueueRun && !(await passesShoppingCooldown())) return;
  const agentFlowActive = !!window.__agentPublishFlowActive;
  let publishSucceeded = false;
  debugLog('PUBLISH', 'publishToPlatform 호출', {
    hasContent: !!appState.generatedContent?.content?.trim(),
    isRunning: appState.isRunning,
    isQueueRun,
  });

  if (isQueueRun) {
    return await runPosting();
  }

  // v3.8.353: 키워드 변경 감지 → 이전 콘텐츠 폐기 (무한루프 방지)
  // 사용자가 새 키워드를 입력하고 발행 버튼을 눌러도 이전 생성물이 재발행되던 버그 fix.
  if (appState.generatedContent?.content?.trim()) {
    const currentKeyword = (document.getElementById('keywordInput')?.value || '').trim();
    const savedKeyword = String(
      appState.generatedContent.payload?.topic
      || appState.generatedContent.payload?.title
      || appState.generatedContent.title
      || ''
    ).trim();
    if (currentKeyword && savedKeyword && currentKeyword !== savedKeyword) {
      debugLog('PUBLISH', '키워드 변경 감지 → 이전 콘텐츠 폐기 (새 글 생성)', {
        current: currentKeyword,
        saved: savedKeyword,
      });
      appState.generatedContent = null;
    }
  }

  // 이미 생성된 콘텐츠가 있으면 재발행 경로
  if (appState.generatedContent?.content?.trim()) {
    try {
      if (appState.isRunning) {
        addLog('작업이 실행 중입니다.', 'warning');
        return;
      }

      if (!window.blogger?.runPost) {
        throw new Error('백엔드 연결 실패');
      }

      appState.isRunning = true;
      appState.isCanceled = false;
      setRunning(true);
      ButtonStateManager.setLoading('publishBtn');
      if (agentFlowActive) {
        updateAgentProgressModal(88, '플랫폼 발행 준비 중입니다.', 'info', 'publish');
      } else {
        showProgressModal();
      }

      const currentPayload = await createPayload({ previewOnly: false });
      const publishPayload = {
        ...(appState.generatedContent.payload || {}),
        ...currentPayload,
        previewOnly: false,
      };
      const titleToPublish = appState.generatedContent.title || currentPayload.title || currentPayload.topic || '';
      const htmlToPublish = appState.generatedContent.content || '';
      const thumbnailToPublish = appState.generatedContent.thumbnailUrl || appState.generatedContent.thumbnail || '';
      // v3.8.102: 자동 진단 트래커 시작 — 사용자가 캡처할 필요 없이 자동 결론 출력
      window.__bodyTrace = [];
      const trace = (stage, htmlText) => {
        const len = String(htmlText || '').length;
        const plain = String(htmlText || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length;
        const h2 = (String(htmlText || '').match(/<h2[^>]*>/gi) || []).length;
        const imgs = (String(htmlText || '').match(/<img[^>]+src=["'][^"']+["']/gi) || []).length;
        const brokenImgs = (String(htmlText || '').match(/<img[^>]+src=["'](?:\s*|javascript:|data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]{0,200})["']/gi) || []).length;
        const entry = { stage, htmlLen: len, plainLen: plain, h2, imgs, brokenImgs, ts: Date.now() };
        window.__bodyTrace.push(entry);
        console.log(`[BODY-TRACE] ${stage}:`, entry);
        return entry;
      };
      trace('publishToPlatform 발행 직전', htmlToPublish);

      addLog('블로그 발행 시작...', 'info');
      if (agentFlowActive) updateAgentProgressModal(92, '블로그 플랫폼으로 발행 요청을 보냈습니다.', 'info', 'publish');
      let result;
      if (window.electronAPI?.invoke) {
        result = await window.electronAPI.invoke('publish-content', {
          payload: publishPayload,
          title: titleToPublish,
          content: htmlToPublish,
          thumbnailUrl: thumbnailToPublish,
        });
      } else if (window.blogger?.publishContent) {
        result = await window.blogger.publishContent(
          publishPayload,
          titleToPublish,
          htmlToPublish,
          thumbnailToPublish
        );
      } else {
        throw new Error('발행 API를 찾을 수 없습니다.');
      }

      if (result?.code === 'PAYWALL') {
        const paywallMessage = result?.message || '무료 체험 발행 횟수를 모두 사용했습니다.';
        addLog(paywallMessage, 'warning');
        try { window.updateFreeQuotaCounter?.(); } catch {}
        try {
          window._paywallShown = true;
          window.showPaywallModal?.();
        } catch {}
        return result;
      }

      if (result?.ok || result?.success) {
        publishSucceeded = true;
        // v3.8.400: 쇼핑모드 발행 시각을 남긴다 — 다음 연속 발행 간격 계산에 쓰인다
        //   v3.8.404: **쿠팡을 쓴 발행만** 기록한다. 토스·네이버 발행이 쿠팡 쿨다운을
        //   시작시키면, 쿠팡을 한 번도 안 건드렸는데 다음 쿠팡 글이 막힌다.
        try {
          const usedCoupang = /coupang\.com|coupa\.ng/i.test([
            document.getElementById('affiliateLinks')?.value || '',
            document.getElementById('referenceUrl')?.value || '',
            document.getElementById('manualCoupangUrls')?.value || '',
          ].join('\n'));
          if ((document.getElementById('contentMode')?.value || '') === 'shopping' && usedCoupang) {
            window.electronAPI?.invoke?.('shopping:cooldown-record');
          }
        } catch {}
        if (agentFlowActive) updateAgentProgressModal(100, '글 생성, 이미지 생성, 발행이 모두 완료되었습니다.', 'success', 'publish');
        addLog('✅ 콘텐츠 발행 완료!', 'success');
        resetArticleStateAfterPublish('콘텐츠 발행 완료');   // v3.8.414
        try { window.updateFreeQuotaCounter?.(); } catch {}

        // v3.8.102: 자동 진단 결론 출력 — 사용자가 캡처할 필요 없이 콘솔에 직접 표시
        try {
          if (result.diagnostics?.bodyTrace) {
            window.__bodyTrace.push(...result.diagnostics.bodyTrace);
          }
          const traces = window.__bodyTrace || [];
          if (traces.length >= 2) {
            const first = traces[0];
            const last = traces[traces.length - 1];
            const startLen = first.plainLen || first.htmlLen;
            const endLen = last.plainLen || last.htmlLen;
            const totalReduction = startLen > 0 ? (1 - endLen / startLen) * 100 : 0;
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`%c📊 본문 트래킹 결론 (${traces.length}단계)`, 'background:#1e293b;color:#67e8f9;font-size:14px;font-weight:900;padding:4px 8px;border-radius:4px;');
            console.log(`%c시작 ${startLen.toLocaleString()}자 → 종료 ${endLen.toLocaleString()}자 (총 감소율 ${totalReduction.toFixed(1)}%)`,
              `color:${totalReduction > 30 ? '#f97316' : '#10b981'};font-weight:700;`);
            // 단계별 최대 감소 찾기
            let biggestDrop = { stage: '', reduction: 0, from: 0, to: 0 };
            for (let i = 1; i < traces.length; i++) {
              const prev = traces[i - 1].plainLen || traces[i - 1].htmlLen;
              const curr = traces[i].plainLen || traces[i].htmlLen;
              if (prev > 0) {
                const r = (1 - curr / prev) * 100;
                if (r > biggestDrop.reduction) biggestDrop = { stage: traces[i].stage, reduction: r, from: prev, to: curr };
              }
            }
            if (biggestDrop.reduction > 15) {
              console.log(`%c🔍 원인: '${biggestDrop.stage}' 단계에서 ${biggestDrop.reduction.toFixed(1)}% 감소 (${biggestDrop.from.toLocaleString()}자 → ${biggestDrop.to.toLocaleString()}자)`,
                'color:#f97316;font-weight:800;font-size:13px;');
            } else {
              console.log(`%c✅ 단계별 감소 모두 정상 (최대 ${biggestDrop.reduction.toFixed(1)}%)`, 'color:#10b981;font-weight:700;');
            }
            console.log('단계별 추적:', traces);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          }
        } catch (traceErr) { console.warn('[BODY-TRACE] 결론 출력 실패:', traceErr); }

        if (result.title || result.html || result.content) {
          appState.generatedContent = {
            title: result.title || '',
            content: result.html || result.content || '',
            thumbnail: result.thumbnail || '',
            payload: publishPayload,
          };
        }
        if (result.url) {
          try {
            const stored = JSON.parse(localStorage.getItem('publishedPosts') || '{}');
            const d = new Date();
            const dateKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            if (!Array.isArray(stored[dateKey])) stored[dateKey] = [];
            const platform = publishPayload.platform || document.querySelector('input[name="platform"]:checked')?.value || 'wordpress';
            const platformName = (platform === 'blogger' || platform === 'blogspot') ? '블로거' : '워드프레스';
            const postId = result.postId || result.id || result.post_id || '';
            stored[dateKey].push({
              title: result.title || titleToPublish || '제목없음',
              url: result.url,
              platform: platformName,
              time: d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
              timestamp: d.getTime(),
              thumbnail: result.thumbnail || thumbnailToPublish || '',
              postId: postId ? String(postId) : '',
              id: postId ? String(postId) : '',
              blogId: publishPayload.blogId || '',
              siteUrl: publishPayload.wordpressSiteUrl || publishPayload.siteUrl || '',
              wordpressSiteUrl: publishPayload.wordpressSiteUrl || publishPayload.siteUrl || '',
            });
            localStorage.setItem('publishedPosts', JSON.stringify(stored));
          } catch (e) {
            console.warn('[PUBLISH-TRACK] 재발행 경로 저장 실패:', e?.message);
          }
        }
        // 🔥 발행 완료 알림 (모달은 finally에서 닫힘)
        try { showNotification('🎉 블로그 포스트 발행 완료!', 4000); } catch {}
        // v3.8.415: resetArticleStateAfterPublish() 가 몇 줄 위에서 이미 이 일을 했다.
        //   (v3.8.353 에 만들어진 이 자리 인라인 버전은 이제 그 함수의 부분집합이라 지웠다 —
        //    두 벌로 남겨두면 다음에 하나만 고치고 잊어버리는 사고가 난다.)
        return result;
      } else if (result?.canceled) {
        // v3.8.415: publish-content 가 사용자 중지로 { ok:false, canceled:true } 를 돌려준 경우.
        //   "❌ 발행 실패"로 보이면 사용자가 뭔가 잘못됐다고 오해한다.
        addLog('🛑 작업을 중지했습니다.', 'info');
        if (agentFlowActive) updateAgentProgressModal(94, '작업을 중지했습니다.', 'warning', 'publish');
        resetArticleStateAfterPublish('중지');
        return result;
      } else {
        const publishError = result?.error || '알 수 없는 오류';
        addLog('❌ 발행 실패: ' + publishError, 'error');
        if (agentFlowActive) updateAgentProgressModal(94, `발행 실패: ${publishError}`, 'error', 'publish');
        return result || { ok: false, error: publishError };
      }
    } catch (error) {
      // v3.8.415: 이 경로로 취소 예외가 오는 경우는 드물지만(주로 result.canceled 로 옴),
      //   방어적으로 같은 규칙을 적용한다 — 한쪽만 처리하면 다른 쪽에서 또 헷갈린다.
      if (error?.canceled) {
        addLog('🛑 작업을 중지했습니다.', 'info');
        resetArticleStateAfterPublish('중지');
        return { ok: false, canceled: true, error: '작업을 중지했습니다.' };
      }
      getErrorHandler().handle(error, { function: 'publishToPlatform' });
      return { ok: false, error: error?.message || String(error || 'publish_error') };
    } finally {
      appState.isRunning = false;
      setRunning(false);
      restoreKeywordInputInteractivity();
      ButtonStateManager.restore('publishBtn');
      if (agentFlowActive) {
        window.__agentPublishFlowActive = false;
        if (publishSucceeded) {
          setTimeout(() => {
            try { hideProgressModal(); } catch {}
          }, 1200);
        } else {
          hideProgressModal();
        }
      } else {
        hideProgressModal();
      }
      // 🔥 큐 연동
      try {
        window.dispatchEvent(new CustomEvent('bgpt:publish-complete', {
          detail: { source: 'publishToPlatform', ts: Date.now() }
        }));
      } catch {}
    }
  } else {
    // 콘텐츠가 없으면 전체 생성+발행 흐름 (runPosting의 finally가 이벤트 발사)
    return await runPosting();
  }
}

// ─────────────────────────────────────────────────────
// 🔧 Payload 생성 — 단일 진입점 (모든 발행/미리보기 공용)
// ─────────────────────────────────────────────────────

/**
 * v3.8.506 — 제목 옵션 단일 소스.
 * 아무것도 안 켜면 자동 생성. "키워드를 제목으로"는 키워드(필수) 칸을 그대로 쓴다.
 * "직접 입력"은 체크가 켜져 있고 칸이 비어있지 않을 때만 유효 — 꺼진 칸의 낡은
 * 글자는 어떤 경로로도 읽히지 않는다 (직접입력→자동 전환 후 낡은 제목 발행 사고의 수리).
 */
function getTitleOptions() {
  const kwChecked = !!document.getElementById('useKeywordAsTitle')?.checked;
  const cuChecked = !!document.getElementById('useCustomTitle')?.checked;
  const customValue = cuChecked
    ? String(document.getElementById('customTitle')?.value || '').trim()
    : '';
  const isCustom = cuChecked && customValue.length > 0;
  return {
    titleMode: isCustom ? 'custom' : 'auto',
    title: isCustom ? customValue : null,
    useKeywordAsTitle: !isCustom && kwChecked,
    keywordFront: !isCustom && !kwChecked
      && !!document.getElementById('keywordFront')?.checked,
  };
}
// 큐·스케줄도 같은 소스를 쓴다 — 경로마다 따로 조립하면 또 샌다
window.__getTitleOptions = getTitleOptions;

/** 기본값 상수 */
const PAYLOAD_DEFAULTS = {
  provider: 'gemini',
  titleMode: 'auto',
  contentMode: 'external',
  toneStyle: 'professional',
  thumbnailMode: 'nanobanana2',
  ctaMode: 'auto',
  h2ImageSource: 'nanobanana2',
  /**
   * v3.8.442 — 'auto' = 백엔드가 **확보한 사진 장수로** 정한다.
   *   3장 이상이면 실제 상품 사진, 그 미만이면 AI 생성.
   * 예전엔 여기가 'product-i2i' 로 고정이라 토스처럼 사진이 15장 있어도
   * AI 생성컷이 나갔다. 구글 2026-03 업데이트 이후 실사용 사진이 랭킹 요소가
   * 됐고 네이버는 스톡 이미지에 감점을 준다 — 사진이 있으면 쓰는 게 맞다.
   * 사용자가 UI 에서 직접 고르면 그 값이 그대로 실린다.
   */
  shoppingImageStrategy: 'auto',
  /**
   * v3.8.447 — 0 = 자동. 소제목 수를 **재료가 정하게** 둔다.
   * 예전 값 5 는 고르는 UI 도 없이 payload 에 실려 백엔드 상한으로 작동했고,
   * 재료가 더 있어도 5개로 잘라냈다(위 getSectionCount 주석 참고).
   */
  sectionCount: 0,
  minSectionCount: 1,
  maxSectionCount: 20,
  promptMode: 'max-mode',
  factCheckMode: 'auto',
  redirectUri: 'http://localhost:8080',
};

/** API 키를 저장된 설정에서 한 번에 수집 */
function getApiKeys(savedSettings) {
  return {
    geminiKey: savedSettings.geminiKey || '',
    pexelsApiKey: savedSettings.pexelsApiKey || '',
    coupangAccessKey: savedSettings.coupangAccessKey || '',
    coupangSecretKey: savedSettings.coupangSecretKey || '',
    googleCseKey: savedSettings.googleCseKey || '',
    googleCseCx: savedSettings.googleCseCx || '',
    naverCustomerId: savedSettings.naverCustomerId || '',
    naverSecretKey: savedSettings.naverSecretKey || '',
    blogId: savedSettings.blogId || '',
    googleClientId: savedSettings.googleClientId || '',
    googleClientSecret: savedSettings.googleClientSecret || '',
    redirectUri: savedSettings.redirectUri || PAYLOAD_DEFAULTS.redirectUri,
    wordpressSiteUrl: savedSettings.wordpressSiteUrl || '',
    wordpressUsername: savedSettings.wordpressUsername || '',
    wordpressPassword: savedSettings.wordpressPassword || '',
  };
}

/**
 * 섹션 수 계산 (DOM 기반).
 *
 * 🔢 v3.8.447 — **고르는 UI 가 없으면 0(자동)을 돌려준다.**
 *
 * 사용자 지적: "5개로만 되어있다면 글이 억지로 5개를 만들거나 정보가 더있는데도
 *   5개만 만들수도있는 경우의수가 존재하자나 그럼안되지"
 *
 * 맞는 지적이었다. `sectionCount` 엘리먼트는 index.html 에 **존재하지 않는데**
 * 여기서 기본값 5 를 채워 payload 에 실었다. 백엔드는 그 값을 상한으로 쓰므로
 *   generation.ts: targetCount = Math.min(targetCount, 5)
 * 재료가 10개어치여도 5개로 잘렸다. 소제목 수를 재료에 맞춰 5~10 으로 늘리는
 * 로직이 이미 있는데, 유령 5 가 그걸 통째로 무력화하고 있었다.
 *
 * 0 을 보내면 백엔드가 상한을 걸지 않고 재료가 정하게 둔다.
 * 나중에 고르는 UI 가 생기면 그 값이 그대로 상한으로 쓰인다(기존 배선 유지).
 */
function getSectionCount() {
  const sectionCountSelect = document.getElementById('sectionCount');
  if (!sectionCountSelect) return 0;          // 자동 — 재료가 정한다
  let count;
  if (sectionCountSelect.value === 'custom') {
    const customInput = document.getElementById('customSectionCount');
    count = customInput && customInput.value ? parseInt(customInput.value) : 0;
  } else {
    count = parseInt(sectionCountSelect.value);
  }
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.max(PAYLOAD_DEFAULTS.minSectionCount, Math.min(PAYLOAD_DEFAULTS.maxSectionCount, count));
}

/** 수동 CTA 수집 */
function getManualCtas(ctaMode) {
  if (ctaMode !== 'manual') return undefined;
  const appState = getAppState();
  if (!appState.manualCtasData || appState.manualCtasData.length === 0) return undefined;

  const manualCtas = {};
  appState.manualCtasData.forEach((cta, index) => {
    if (cta && cta.url && cta.url.trim()) {
      manualCtas[index] = {
        url: cta.url,
        text: cta.title || '자세히 보기',
        hook: cta.hook || '',
      };
    }
  });
  return Object.keys(manualCtas).length > 0 ? manualCtas : undefined;
}

/** H2 이미지 설정 수집 */
function normalizeImagePolicy(value) {
  const raw = String(value || '').toLowerCase().trim();
  if (raw === 'odd') return 'odd-only';
  if (raw === 'even') return 'even-only';
  return ['all', 'thumbnail-only', 'odd-only', 'even-only', 'none'].includes(raw) ? raw : 'all';
}

function toLegacyH2ImageMode(policy) {
  const normalized = normalizeImagePolicy(policy);
  if (normalized === 'odd-only') return 'odd';
  if (normalized === 'even-only') return 'even';
  return normalized;
}

function getH2ImageSettingsFromDOM() {
  const agentImageMode = typeof window !== 'undefined' && typeof window.getAgentImageSettingsMode === 'function'
    ? window.getAgentImageSettingsMode()
    : null;
  /**
   * 🖼️ v3.8.465 — **에이전트 모드일 때만 에이전트 설정이 이긴다.**
   *
   * 사용자 지적: "이미지 홀수 짝수 선택해도 홀수면 짝수 스킵, 짝수면 홀수 스킵이
   * 이뤄지지 않네요".
   *
   * 원인: getAgentImageSettingsMode() 는 에이전트 모드가 **아니어도** 항상
   *   `imagePolicy: 'all'`(저장값이 없을 때의 기본값)을 돌려준다. 그 값이 늘
   *   truthy 라서 `||` 사슬이 여기서 끊겼고, 아래의 `h2ImageMode` 드롭다운
   *   (사용자가 실제로 고른 값)까지 **한 번도 도달하지 못했다.**
   *   그래서 홀수/짝수를 골라도 언제나 'all' 로 발행됐다.
   *
   * 에이전트 모드가 아니면 그 설정은 없는 것으로 본다 — 화면에 보이는 선택이 답이다.
   */
  const agentPolicy = agentImageMode?.isAgentMode
    ? (agentImageMode.imagePolicy || agentImageMode.policy || '')
    : '';
  const selectedPolicy = normalizeImagePolicy(
    agentPolicy
    || document.querySelector('input[name="swImagePolicy"]:checked')?.value
    || document.getElementById('h2ImageMode')?.value
    || 'all'
  );
  const legacyH2ImageMode = toLegacyH2ImageMode(selectedPolicy);
  const forceH2None = selectedPolicy === 'thumbnail-only' || selectedPolicy === 'none';
  const thumbnailTextIncluded = agentImageMode?.thumbnailTextIncluded !== false;
  // window.getH2ImageSections가 있으면 우선 사용
  if (window.getH2ImageSections) {
    const settings = window.getH2ImageSections();
    const leonardoModel = document.getElementById('h2LeonardoModel')?.value
      || document.getElementById('thumbnailTypeLeonardoModel')?.value
      || document.getElementById('thumbnailLeonardoModel')?.value
      || settings.leonardoModel
      || 'seedream-4.5';
    return {
      h2ImageSource: forceH2None ? 'none' : (settings.source || PAYLOAD_DEFAULTS.h2ImageSource),
      h2ImageSections: forceH2None ? [] : (settings.sections || []),
      // v3.8.385: 쇼핑모드 본문 이미지 전략 (썸네일은 항상 실제 상품 사진)
      // v3.8.442: 사용자가 직접 고른 경우에만 값을 싣는다. 아니면 'auto' 로
      //   보내 백엔드가 확보한 사진 장수로 정하게 한다(위 PAYLOAD_DEFAULTS 주석 참고).
      shoppingImageStrategy: settings.shoppingImageStrategy
        || (window.__strategyUserPicked ? document.getElementById('shoppingImageStrategy')?.value : '')
        || PAYLOAD_DEFAULTS.shoppingImageStrategy,
      h2ImageMode: legacyH2ImageMode,
      imagePolicy: selectedPolicy,
      h2Images: { ...settings, source: forceH2None ? 'none' : (settings.source || PAYLOAD_DEFAULTS.h2ImageSource), sections: forceH2None ? [] : (settings.sections || []), leonardoModel, mode: legacyH2ImageMode, imagePolicy: selectedPolicy, h2TextIncluded: false },
      leonardoModel,
      thumbnailTextIncluded,
      thumbnailIncludeText: thumbnailTextIncluded,
      h2TextIncluded: false,
    };
  }

  // DOM에서 직접 읽기
  const h2ImageSourceSelect = document.getElementById('h2ImageSource') || document.getElementById('h2ImageSourceSelect');
  const h2ImageSourceRadio = document.querySelector('input[name="h2ImageSource"]:checked');
  const h2ImageSourceValue = forceH2None
    ? 'none'
    : (h2ImageSourceSelect?.value || h2ImageSourceRadio?.value || PAYLOAD_DEFAULTS.h2ImageSource);
  const leonardoModel = document.getElementById('h2LeonardoModel')?.value
    || document.getElementById('thumbnailTypeLeonardoModel')?.value
    || document.getElementById('thumbnailLeonardoModel')?.value
    || 'seedream-4.5';

  const h2ImageSectionCheckboxes = document.querySelectorAll('input[name="h2Sections"]:checked');
  const h2ImageSections = forceH2None ? [] : Array.from(h2ImageSectionCheckboxes)
    .map(cb => parseInt(cb.value))
    .filter(n => Number.isFinite(n) && n > 0);

  // v3.8.442: 여기도 같은 규칙 — 직접 고른 값만 싣고, 아니면 'auto'
  const shoppingImageStrategy = (window.__strategyUserPicked
    ? document.getElementById('shoppingImageStrategy')?.value : '')
    || PAYLOAD_DEFAULTS.shoppingImageStrategy;

  return {
    h2ImageSource: h2ImageSourceValue,
    h2ImageSections: h2ImageSections,
    shoppingImageStrategy,
    h2ImageMode: legacyH2ImageMode,
    imagePolicy: selectedPolicy,
    h2Images: { source: h2ImageSourceValue, sections: h2ImageSections, leonardoModel, mode: legacyH2ImageMode, imagePolicy: selectedPolicy, h2TextIncluded: false },
    leonardoModel,
    thumbnailTextIncluded,
    thumbnailIncludeText: thumbnailTextIncluded,
    h2TextIncluded: false,
  };
}

/** 플랫폼 정규화 */
function normalizePlatform(platform) {
  if (platform === 'blogger') return 'blogspot';
  return platform;
}

/** 현재 단일 발행 입력 소스가 'URL로 생성'인지 — 키워드/URL 판별의 단일 진실 소스 */
function isUrlInputModeActive() {
  let mode = 'keyword';
  try { mode = localStorage.getItem('singleInputMode') || 'keyword'; }
  catch { /* localStorage 접근 불가 시 키워드 모드로 간주 */ }
  if (mode !== 'url') return false;
  // v3.8.410: 쇼핑모드는 제휴 링크 칸이 원본 URL 칸을 대신한다
  const referenceUrlValue = [
    document.getElementById('referenceUrl')?.value || '',
    document.getElementById('affiliateLinks')?.value || '',
  ].join('\n').trim();
  return referenceUrlValue.split('\n').some((line) => /^https?:\/\//i.test(line.trim()));
}

/**
 * 통합 Payload 생성 함수 — 모든 발행/미리보기 경로의 단일 진입점
 * 🔥 async: loadSettings()는 Promise를 반환하므로 반드시 await 필요
 * @param {Object} options
 * @param {boolean} [options.previewOnly=false] - 미리보기 모드
 * @param {string}  [options.platformOverride]  - 플랫폼 강제 지정 ('preview' 등)
 * @param {Object}  [options.overrides={}]      - 개별 필드 오버라이드
 */
export async function createPayload(options = {}) {
  const { previewOnly = false, platformOverride, overrides = {} } = options;

  // 🔥 await 추가: savedSettings가 Promise가 아닌 실제 객체가 되도록
  const savedSettings = await loadSettings();

  // 🔥 환경설정의 primaryGeminiTextModel 라디오를 단일 진실 소스로 사용
  const tierRadioForProvider = document.querySelector('input[name="primaryGeminiTextModel"]:checked');
  const deriveProviderFromModel = (v) => {
    if (!v) return '';
    if (v.startsWith('gemini-')) return 'gemini';
    if (v.startsWith('openai-') || v.startsWith('gpt-') || /^o\d/i.test(v)) return 'openai';
    if (v.startsWith('claude-')) return 'claude';
    if (v === 'perplexity-sonar') return 'perplexity';
    return '';
  };
  const provider = deriveProviderFromModel(tierRadioForProvider?.value)
    || deriveProviderFromModel(savedSettings.primaryGeminiTextModel)
    || savedSettings.generationEngine
    || savedSettings.provider
    || PAYLOAD_DEFAULTS.provider;

  // ── 키워드 / 제목 ──
  // 🛡️ T-3 (v3.5.84): DOMCache stale 방지 — 큐 모드에서 직전 글 keyword가 살아 들어가는 회귀 차단
  //   기존: DOMCache.get('keywordInput')만 사용 → 큐 항목 간 캐시된 노드가 stale 가능
  //   변경: document.getElementById 직접 호출을 우선, fallback으로 DOMCache
  const keywordInput = document.getElementById('keywordInput') || DOMCache.get('keywordInput');
  const rawKeywordValue = keywordInput ? keywordInput.value.trim() : '';
  if (DOMCache.get('keywordInput') && DOMCache.get('keywordInput') !== document.getElementById('keywordInput')) {
    console.warn('[PAYLOAD] ⚠️ DOMCache keywordInput stale 감지 — 직접 DOM 사용');
  }
  // 🔗 URL 모드에서는 키워드 입력란이 화면에서 숨겨질 뿐 이전 발행 때 쓴 값이 그대로 남아 있다.
  //   그 값을 payload.topic으로 보내면 백엔드가 URL 본문이 아니라 직전 키워드를 주제로 글을 써버린다.
  //   (증상: URL로 생성했는데 이전에 키워드로 발행했던 글이 다시 나옴)
  const keywordValue = isUrlInputModeActive() ? '' : rawKeywordValue;
  if (rawKeywordValue && !keywordValue) {
    console.log('[PAYLOAD] 🔗 URL 모드 — 숨겨진 키워드 입력란의 이전 값 무시:', rawKeywordValue.slice(0, 40));
  }

  /**
   * v3.8.506 — 제목은 체크박스 상태에서만 파생한다 (셀렉트 삭제).
   * 예전엔 셀렉트가 auto 로 돌아와도 직접입력 칸의 낡은 글자가 남아
   * 다른 경로로 새 나갈 수 있었다. 이제 직접입력 체크가 꺼져 있으면
   * 칸에 뭐가 남아 있든 절대 읽지 않는다.
   * 단일·큐·스케줄이 같은 함수를 쓰라고 window 에도 노출한다 (payload 3경로 함정).
   */
  const titleOptions = getTitleOptions();
  const titleModeValue = titleOptions.titleMode;
  let titleValue = titleOptions.title;
  // 미리보기: 제목 없으면 키워드로 대체
  if (previewOnly && !titleValue && keywordValue) {
    titleValue = keywordValue;
  }

  // ── 콘텐츠/발행 모드 ──
  // 🛡️ T-3 (v3.5.84): localStorage 우선순위 강등 — DOM 최신값을 1순위로 변경
  //   기존 우선순위: localStorage → contentModeFresh → DOMCache → schedule → default
  //     문제: 큐 모드에서 직전 글의 contentMode가 localStorage에 저장됨 → 둘째 글 DOM 변경해도 무시
  //   신규 우선순위: contentModeFresh(현재 DOM) → DOMCache → localStorage → schedule → default
  //     큐가 cmSel.value=it.mode + change 이벤트 발사하면 DOM이 최신 → 정상 반영
  const contentModeSelect = DOMCache.get('contentMode');
  const contentModeFresh = document.getElementById('contentMode');
  const scheduleContentMode = document.getElementById('scheduleContentMode');
  let contentModeLS = '';
  try { contentModeLS = localStorage.getItem('contentMode') || ''; } catch {}
  const contentModeValue = contentModeFresh?.value
    || contentModeSelect?.value
    || contentModeLS
    || scheduleContentMode?.value
    || PAYLOAD_DEFAULTS.contentMode;
  console.log('[PAYLOAD] contentMode 선택:', {
    localStorage: contentModeLS,
    freshDOM: contentModeFresh?.value,
    domCache: contentModeSelect?.value,
    scheduleModal: scheduleContentMode?.value,
    final: contentModeValue,
  });

  const postingModeRadio = document.querySelector('input[name="postingMode"]:checked');
  const postingModeRaw = postingModeRadio?.value || 'immediate';
  const publishTypeValue = postingModeRaw === 'immediate' ? 'publish' : postingModeRaw;

  const scheduleDateTimeEl = document.getElementById('scheduleDateTime');
  const scheduleDateTime = scheduleDateTimeEl?.value ? String(scheduleDateTimeEl.value).trim() : '';

  // ── 썸네일 ──
  // 🔥 우선순위 수정: #thumbnailType(사용자가 명시 선택한 엔진)을 #scheduleThumbnailMode(스케줄 모달, 기본 'auto')보다 먼저 사용.
  // #scheduleThumbnailMode는 스케줄 모달에서만 의미 있으며 기본값 'auto'가 사용자 선택(imagefx 등)을 덮어쓰는 회귀 원인이었음.
  // scheduleThumbnailMode가 명시적 비-auto 값일 때만 우선권을 가진다.
  const scheduleThumbnailMode = document.getElementById('scheduleThumbnailMode');
  const thumbnailTypeSelect = DOMCache.get('thumbnailType');
  const scheduleThumbRaw = scheduleThumbnailMode?.value || '';
  const scheduleThumbExplicit = scheduleThumbRaw && scheduleThumbRaw !== 'auto' ? scheduleThumbRaw : '';
  const thumbnailModeValue = thumbnailTypeSelect?.value
    || scheduleThumbExplicit
    || scheduleThumbRaw
    || PAYLOAD_DEFAULTS.thumbnailMode;
  const savedThumbnail = getStorageManager().getSync('generatedThumbnail');
  const savedThumbnailText = getStorageManager().getSync('thumbnailText');

  // ── CTA ──
  const scheduleCtaMode = document.getElementById('scheduleCtaMode');
  const mainCtaModeValue = document.querySelector('input[name="ctaMode"]:checked')?.value || '';
  const scheduleCtaRaw = scheduleCtaMode?.value || '';
  const ctaModeValue = mainCtaModeValue || scheduleCtaRaw || PAYLOAD_DEFAULTS.ctaMode;

  // ── 기타 설정 ──
  const toneStyleValue = document.getElementById('toneStyle')?.value || PAYLOAD_DEFAULTS.toneStyle;
  const sectionCount = getSectionCount();
  const h2ImageSettings = getH2ImageSettingsFromDOM();
  const effectiveThumbnailModeValue = h2ImageSettings.imagePolicy === 'none' ? 'none' : thumbnailModeValue;
  const thumbnailTextIncluded = h2ImageSettings.thumbnailTextIncluded !== false;
  const thumbnailTextValue = thumbnailTextIncluded
    ? (savedThumbnailText || document.getElementById('thumbnailText')?.value?.trim() || '')
    : '';

  // ── 플랫폼 ──
  // 현재 화면에서 사용자가 고른 플랫폼을 1순위로 사용한다.
  // loadSettings()는 값이 비어 있어도 platform을 wordpress로 정규화하므로
  // 저장값을 먼저 쓰면 Blogger/Blogspot 선택이 WordPress로 덮이는 회귀가 생긴다.
  const platformRadio = document.querySelector('input[name="platform"]:checked');
  const platformRadioValue = platformRadio?.value || '';
  const savedPlatformValue = savedSettings.platform || '';
  const resolvedPlatformValue = platformRadioValue || savedPlatformValue || 'blogspot';
  const publishTargetPlatform = normalizePlatform(resolvedPlatformValue);
  let selectedPlatform;
  if (platformOverride) {
    selectedPlatform = platformOverride;
  } else {
    // 1순위: 현재 라디오 체크 상태
    // 2순위: 저장된 설정
    // 3순위: Blogspot 기본값
    const platformRadio = document.querySelector('input[name="platform"]:checked');
    const radioValue = platformRadio?.value || '';
    const savedValue = savedSettings.platform || '';
    selectedPlatform = normalizePlatform(radioValue || savedValue || 'blogspot');
    console.log('[PAYLOAD] 플랫폼 선택:', { radio: radioValue, saved: savedValue, final: selectedPlatform });
  }

  // ── E-E-A-T 저자 정보 ──
  const adsenseAuthorName = document.getElementById('adsenseAuthorName')?.value?.trim() || '';
  const adsenseAuthorTitle = document.getElementById('adsenseAuthorTitle')?.value?.trim() || '';
  const adsenseAuthorCredentials = document.getElementById('adsenseAuthorCredentials')?.value?.trim() || '';

  // ── 수동 크롤링 URL ── (manualCrawlUrl1/2/3 + referenceUrl 통합)
  const manualUrls = [
    document.getElementById('manualCrawlUrl1')?.value?.trim(),
    document.getElementById('manualCrawlUrl2')?.value?.trim(),
    document.getElementById('manualCrawlUrl3')?.value?.trim(),
  ].filter(Boolean);

  // 상단 참고 URL 텍스트영역 (줄바꿈으로 여러 개 입력)
  const referenceUrlEl = document.getElementById('referenceUrl');
  let referenceUrls = [];
  if (referenceUrlEl?.value?.trim()) {
    referenceUrls = referenceUrlEl.value.split('\n').map(u => u.trim()).filter(u => /^https?:\/\//i.test(u));
    manualUrls.push(...referenceUrls);
  }
  const isUrlInputMode = isUrlInputModeActive();

  // ── 초안 (페러프레이징 모드) ──
  const draftInputEl = document.getElementById('draftInput');
  const draftContentValue = draftInputEl?.value?.trim() || '';

  // ── 🧑 v3.8.392: 작성자 경험 메모 (자유칸 + 접이식 육하원칙) ──
  //   아무것도 안 채우면 undefined 를 넘겨 이전과 동일하게 동작시킨다.
  function collectExperienceInput() {
    const val = (id) => document.getElementById(id)?.value?.trim() || '';
    const exp = {
      note: val('experienceNote'),
      who: val('expWho'),
      when: val('expWhen'),
      where: val('expWhere'),
      what: val('expWhat'),
      how: val('expHow'),
      why: val('expWhy'),
      result: val('expResult'),
      tip: val('expTip'),
    };
    return Object.values(exp).some(Boolean) ? exp : undefined;
  }

  // ── 워드프레스 카테고리 선택 ──
  const wpCategorySelectEl = document.getElementById('wpCategory');
  const wpCategoryValue = wpCategorySelectEl?.value || '';
  const tistoryBlogNameValue = (
    document.getElementById('tistoryBlogName')?.value
    || savedSettings.tistoryBlogName
    || savedSettings.TISTORY_BLOG_NAME
    || savedSettings.tistoryBlogUrl
    || ''
  ).trim();
  // 🏷️ v3.8.453: 발행 화면(카테고리 탭)에서 고른 값이 1순위 —
  //   설정 모달의 묵은 값이 그대로 실려 블로그에 없는 카테고리로 발행 실패하던 문제.
  const tistoryDefaultCategoryValue = (
    document.getElementById('tistoryCategoryPosting')?.value
    || document.getElementById('tistoryDefaultCategory')?.value
    || savedSettings.tistoryDefaultCategory
    || savedSettings.TISTORY_DEFAULT_CATEGORY
    || ''
  ).trim();
  const tistoryDefaultVisibilityValue = (
    document.getElementById('tistoryDefaultVisibility')?.value
    || savedSettings.tistoryDefaultVisibility
    || savedSettings.TISTORY_DEFAULT_VISIBILITY
    || 'private'
  ).trim();

  // ── 포스팅 엔진 (단일 진실 소스) ──
  // 🔥 provider(드롭다운)가 선택되면 그에 맞는 기본 모델 사용.
  //    라디오 버튼(primaryGeminiTextModel)은 provider와 일치할 때만 사용.
  const primaryGeminiTextModelRadio = document.querySelector('input[name="primaryGeminiTextModel"]:checked');
  const radioValue = primaryGeminiTextModelRadio?.value || savedSettings.primaryGeminiTextModel || '';
  const PROVIDER_DEFAULT_MODEL = {
    gemini: 'gemini-2.5-flash',
    openai: 'openai-gpt41',
    claude: 'claude-sonnet',
    perplexity: 'perplexity-sonar',
  };
  // 라디오 모델이 현재 provider와 같은 계열이면 유지, 아니면 provider 기본 모델
  const radioMatchesProvider =
    (provider === 'gemini' && radioValue.startsWith('gemini-')) ||
    (provider === 'openai' && (radioValue.startsWith('openai-') || radioValue.startsWith('gpt-') || /^o\d/i.test(radioValue))) ||
    (provider === 'claude' && radioValue.startsWith('claude-')) ||
    (provider === 'perplexity' && radioValue.startsWith('perplexity-'));
  const primaryGeminiTextModelValue = radioMatchesProvider
    ? radioValue
    : (PROVIDER_DEFAULT_MODEL[provider] || 'gemini-2.5-flash');

  // ── 미리보기 전용 필드 ──
  const authorNickname = document.getElementById('authorNickname')?.value?.trim() || '';
  const useGoogleSearch = document.getElementById('useGoogleSearch')?.checked || false;
  /**
   * v3.8.447 — sectionCount 가 0(자동)이면 분량 하한이 0 이 되어 **길이 게이트가
   * 통째로 사라진다.** 자동일 때는 백엔드가 실제로 만드는 범위(5~10섹션)의
   * 아래쪽인 5섹션을 기준으로 잡는다 — 하한이지 상한이 아니므로 재료가 많아
   * 섹션이 늘어나도 글이 잘리지 않는다.
   */
  const charBasisSections = sectionCount > 0 ? sectionCount : 5;
  const dynamicMinChars = charBasisSections * 1200;
  const dynamicMaxChars = charBasisSections * 1500;

  const payload = {
    // 핵심 필드
    provider,
    primaryGeminiTextModel: primaryGeminiTextModelValue,
    titleAI: provider,
    summaryAI: provider,
    topic: keywordValue,
    title: titleValue,
    keywords: [{ keyword: keywordValue, title: titleValue }],

    // 제목 옵션 — v3.8.506: 체크박스 상태가 곧 진실 (getTitleOptions 단일 소스)
    titleMode: titleModeValue,
    useKeywordAsTitle: titleOptions.useKeywordAsTitle,
    keywordFront: titleOptions.keywordFront,

    // 콘텐츠
    contentMode: contentModeValue,
    promptMode: PAYLOAD_DEFAULTS.promptMode,
    toneStyle: toneStyleValue,
    sectionCount,
    factCheckMode: document.getElementById('factCheckMode')?.value || PAYLOAD_DEFAULTS.factCheckMode,

    // E-E-A-T 저자 정보
    adsenseAuthorInfo: contentModeValue === 'adsense' && adsenseAuthorName ? {
      name: adsenseAuthorName,
      title: adsenseAuthorTitle,
      credentials: adsenseAuthorCredentials,
    } : undefined,

    // 이미지
    thumbnailMode: effectiveThumbnailModeValue,
    thumbnailType: h2ImageSettings.imagePolicy === 'none' ? 'none' : (savedThumbnail ? 'custom' : effectiveThumbnailModeValue),
    customThumbnail: h2ImageSettings.imagePolicy === 'none' ? undefined : (savedThumbnail || undefined),
    customThumbnailText: thumbnailTextValue || undefined,
    thumbnailTextIncluded,
    thumbnailIncludeText: thumbnailTextIncluded,
    h2TextIncluded: false,
    ...h2ImageSettings,

    // v3.6.5: 이미지 생성 탭에서 미리 만든 이미지 자동 배치 (H2 #1, #2... 순서대로)
    //   각 원소: { h2Index, dataUrl, prompt }
    //   orchestration이 받으면 dispatchH2ImageGeneration 스킵하고 해당 dataUrl 사용
    preGeneratedImages: (window.__preGeneratedImagesForArticle || []).length > 0
      ? window.__preGeneratedImagesForArticle.map(img => ({ h2Index: img.h2Index, h2Title: img.h2Title, dataUrl: img.dataUrl }))
      : undefined,
    preGeneratedThumbnail: window.__preGeneratedThumbnailForArticle?.dataUrl
      ? { dataUrl: window.__preGeneratedThumbnailForArticle.dataUrl, prompt: window.__preGeneratedThumbnailForArticle.prompt || '' }
      : undefined,
    folderImageH2Titles: Array.isArray(window.__folderImageH2Titles) ? window.__folderImageH2Titles.slice(0, 12) : undefined,
    folderImageMissingPolicy: window.__folderImageMissingPolicy || 'ai',

    // 초안 (페러프레이징)
    draftContent: contentModeValue === 'paraphrasing' && draftContentValue ? draftContentValue : undefined,

    // 🧑 v3.8.392: 작성자 경험 메모 — AI 요약이 대체할 수 없는 유일한 차별점.
    //   비우면 undefined → 백엔드가 "겪은 척 하지 말라" 안전장치를 대신 넣는다.
    experience: collectExperienceInput(),

    // 🔗 v3.8.396: 제휴 링크 (쇼핑모드 전용). 비우면 undefined → 이전과 동일 동작.
    //   ⚠️ 원본 그대로 넘긴다 — 링크 변조는 제휴 계약 위반이다.
    affiliateLinks: (() => {
      const raw = document.getElementById('affiliateLinks')?.value?.trim() || '';
      if (!raw) return undefined;
      const list = raw.split(/[\n,]+/).map(s => s.trim()).filter(s => /^https?:\/\//i.test(s));
      return list.length > 0 ? list : undefined;
    })(),

    // 🏷️ v3.8.430: 사용자가 고른 제휴사를 그대로 넘긴다.
    //   백엔드는 이 값이 있으면 링크 정규식으로 제휴사를 추측하지 않는다.
    //   비어 있으면(구버전 UI로 만든 대기열 payload 등) 기존 자동판별로 폴백한다.
    affiliateProvider: (() => {
      const picked = document.querySelector('input[name="affiliateProvider"]:checked')?.value || '';
      return picked || undefined;
    })(),

    // 수동 크롤링 URL
    manualCrawlUrls: manualUrls.length > 0 ? manualUrls : undefined,
    sourceUrl: isUrlInputMode ? referenceUrls[0] : undefined,
    urlBasedGeneration: isUrlInputMode ? true : undefined,

    // 🆕 URL 이미지 자동 수집 + AI 검증 (cd000242-sudo/naver v2.7.77 이식)
    //   _publishForceOptions 전역 패턴 — 큐/세미오토/멀티계정이 덮어쓸 수 있음
    urlImageSource: (() => {
      const force = (window).__publishForceOptions || {};
      // 1순위: force (큐가 항목별로 주입)
      if (force.urlImageSource && /^https?:\/\//i.test(force.urlImageSource)) {
        return {
          url: force.urlImageSource,
          aiCheckEnabled: !!force.urlImageAiCheck,
          aiFillEnabled: !!force.urlImageAiFill,
          threshold: Number(force.urlImageThreshold) || 60,
        };
      }
      // 2순위: 단일 발행 UI 입력란
      const url = (document.getElementById('urlImageSource')?.value || '').trim();
      if (!/^https?:\/\//i.test(url)) return undefined;
      return {
        url,
        aiCheckEnabled: !!document.getElementById('urlImageAiCheck')?.checked,
        aiFillEnabled: !!document.getElementById('urlImageAiFill')?.checked,
        threshold: 60,
      };
    })(),

    // 🛒 쿠팡 파트너스 수동 제휴 링크 (shopping 모드, API 키 없어도 사용 가능)
    manualCoupangUrls: (() => {
      const raw = document.getElementById('manualCoupangUrls')?.value || '';
      const urls = raw
        .split(/[\r\n]+/)
        .map(u => u.trim())
        .filter(u => /^https?:\/\//i.test(u));
      return urls.length > 0 ? urls.slice(0, 10) : undefined;  // 최대 10개
    })(),

    // 🔥 워드프레스 카테고리 (UI에서 선택한 카테고리 ID/이름)
    wordpressCategory: wpCategoryValue || undefined,
    // 🔥 티스토리 설정 (저장값 또는 현재 UI 선택값을 발행 payload에 직접 전달)
    tistoryBlogName: tistoryBlogNameValue || undefined,
    tistoryDefaultCategory: tistoryDefaultCategoryValue || undefined,
    tistoryDefaultVisibility: tistoryDefaultVisibilityValue || undefined,

    // CTA
    ctaMode: ctaModeValue,
    ctaAiStrictMode: !!document.getElementById('ctaAiStrictMode')?.checked,
    strictThumbnailEngine: !!document.getElementById('strictThumbnailEngine')?.checked,
    // 🚫 v3.8.336: 썸네일 텍스트 미포함 — 제목 오버레이 대신 텍스트 금지 지시를 건다
    thumbnailNoText: !!document.getElementById('thumbnailNoText')?.checked,
    // 🛡️ S-1 (v3.5.84): H2 섹션 이미지 엔진 strict 모드 — 폴백 차단
    strictH2ImageEngine: !!document.getElementById('strictH2ImageEngine')?.checked,
    // v3.7.8: 빠른 모드 — 본문 품질 보강 스킵 (~3~4분 절약, 단 품질 다소 떨어질 수 있음)
    skipQualityBoost: !!document.getElementById('skipQualityBoost')?.checked,
    // 🏆 AdSense 강화 — adsense 모드일 때만 의미 있음
    llmRotation: !!document.getElementById('llmRotation')?.checked,
    adsenseScoreGate: contentModeValue === 'adsense' ? true : !!document.getElementById('adsenseScoreGate')?.checked,
    adsenseMinScore: contentModeValue === 'adsense'
      ? Math.max(Number(document.getElementById('adsenseMinScore')?.value || 78), 78)
      : Number(document.getElementById('adsenseMinScore')?.value || 78),
    adsenseGateMode: document.getElementById('adsenseGateMode')?.value || 'warn',
    adsensePolicyScan: contentModeValue === 'adsense',
    adsenseHardeningScan: contentModeValue === 'adsense',
    manualCtas: getManualCtas(ctaModeValue),

    // 발행
    platform: selectedPlatform,
    targetPlatform: platformOverride === 'preview' ? publishTargetPlatform : selectedPlatform,
    publishType: previewOnly ? 'single' : publishTypeValue,
    postingMode: previewOnly ? 'single' : publishTypeValue,
    previewOnly,
    // v3.8.425 — 사용자 보고: "반자동 발행이라고 로그에 인지했는데 왜 이미지까지 생성하는건데
    //   이미지 비용이 얼만데 당장 수정해". 반자동(previewOnly)은 "이미지 없이 글만 먼저"가
    //   설계 의도인데(preview.js 로그: "🎨 반자동 발행 시작 — 이미지 없이 글만 먼저
    //   생성합니다..."), orchestration.ts 는 이미 skipImages 플래그로 이미지 생성 전체를
    //   건너뛸 수 있음에도(486행: `payload.skipImages === true || h2ImageMode === 'none'`)
    //   createPayload()가 이 플래그를 한 번도 세팅하지 않아서 이미지 8장이 매번 그대로
    //   유료 생성됐다. previewOnly인 요청은 skipImages도 함께 켠다 — createPreviewPayload()
    //   (반자동 전용, previewOnly: true의 유일한 호출자)만 영향을 받는다.
    skipImages: previewOnly,
    scheduleDate: publishTypeValue === 'schedule' && scheduleDateTime ? scheduleDateTime : undefined,

    // 글자수 (미리보기/저장 설정 겸용)
    minChars: savedSettings.minChars || dynamicMinChars,
    maxChars: savedSettings.maxChars || dynamicMaxChars,

    // 미리보기 전용
    authorNickname,
    useGoogleSearch,

    // API 키들 (중앙 수집)
    ...getApiKeys(savedSettings),
  };

  // undefined 필드 정리
  Object.keys(payload).forEach(key => {
    if (payload[key] === undefined) delete payload[key];
  });

  // 오버라이드 적용
  Object.assign(payload, overrides);

  debugLog('PAYLOAD', '통합 Payload 생성 완료', {
    topic: payload.topic,
    platform: payload.platform,
    publishType: payload.publishType,
    contentMode: payload.contentMode,
    previewOnly: payload.previewOnly,
    provider: payload.provider,
  });

  return payload;
}

// ─── 하위호환 래퍼 ───

/** @deprecated createPayload() 사용 권장 */
export async function createPayloadFromForm() {
  return await createPayload({ previewOnly: false });
}

/** @deprecated createPayload({ previewOnly: true }) 사용 권장 */
export async function createPreviewPayload() {
  return await createPayload({ previewOnly: true, platformOverride: 'preview' });
}

// ─── 헬퍼 ───

function updatePreview(title, content, url) {
  const appState = getAppState();
  appState.generatedContent.title = title;
  appState.generatedContent.content = content;
  if (url) {
    appState.generatedContent.url = url;
  }
}
