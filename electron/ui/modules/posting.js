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

function ensureAgentProgressModal(provider = 'codex') {
  const overlay = document.getElementById('premiumProgressBar');
  if (!overlay) return;

  const providerLabel = provider === 'claude' ? 'Claude Code' : 'Codex';
  overlay.classList.add('agent-progress-mode');
  overlay.innerHTML = `
    <div id="agentProgressPanel" style="width:min(920px, calc(100vw - 48px)); max-height:calc(100vh - 48px); overflow:auto; background:linear-gradient(135deg,#0f172a 0%,#172033 100%); border:1px solid rgba(125,211,252,.28); border-radius:22px; box-shadow:0 30px 90px rgba(0,0,0,.48); padding:28px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:22px;">
        <div>
          <div style="display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;background:rgba(34,211,238,.12);border:1px solid rgba(34,211,238,.24);color:#a5f3fc;font-size:12px;font-weight:800;">${providerLabel} Agent Mode</div>
          <h2 style="margin:14px 0 6px;color:#f8fafc;font-size:28px;line-height:1.2;">글 생성부터 이미지 생성, 발행까지 진행 중</h2>
          <p id="agentProgressStatus" style="margin:0;color:#cbd5e1;font-size:14px;line-height:1.6;">Agent 작업을 준비하고 있습니다.</p>
        </div>
        <div id="agentProgressPercent" style="min-width:84px;text-align:right;color:#67e8f9;font-size:34px;font-weight:900;line-height:1;">0%</div>
      </div>

      <div style="height:12px;background:rgba(15,23,42,.95);border:1px solid rgba(148,163,184,.18);border-radius:999px;overflow:hidden;margin-bottom:18px;">
        <div id="agentProgressFill" style="height:100%;width:0%;background:linear-gradient(90deg,#22d3ee,#a78bfa,#34d399);border-radius:999px;transition:width .45s ease;"></div>
      </div>

      <div id="agentProgressStages" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:18px;">
        ${AGENT_PROGRESS_STAGES.map((stage) => `
          <div data-agent-stage="${stage.id}" style="padding:13px 12px;border-radius:12px;border:1px solid rgba(148,163,184,.18);background:rgba(15,23,42,.62);color:#94a3b8;font-size:13px;font-weight:800;text-align:center;transition:all .25s ease;">${stage.label}</div>
        `).join('')}
      </div>

      <div style="display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:14px;">
        <div style="background:rgba(2,6,23,.55);border:1px solid rgba(148,163,184,.16);border-radius:14px;padding:15px;">
          <div style="color:#e2e8f0;font-size:13px;font-weight:900;margin-bottom:10px;">실시간 작업 로그</div>
          <div id="agentProgressInlineLog" style="height:190px;overflow:auto;font-family:Consolas,Monaco,monospace;font-size:12px;line-height:1.7;color:#cbd5e1;"></div>
        </div>
        <div style="background:rgba(8,47,73,.25);border:1px solid rgba(56,189,248,.18);border-radius:14px;padding:15px;color:#cbd5e1;font-size:12px;line-height:1.7;">
          <strong style="display:block;color:#f8fafc;font-size:13px;margin-bottom:8px;">Codex 모드 동작</strong>
          <span>Codex는 글 본문과 이미지 작업까지 한 번에 처리한 뒤, 완성된 HTML을 기존 발행 흐름으로 넘깁니다.</span>
        </div>
      </div>

      <div id="agentGeneratedImagePreviewWrap" style="display:none;margin-top:14px;background:rgba(2,6,23,.52);border:1px solid rgba(52,211,153,.2);border-radius:14px;padding:15px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;">
          <strong style="color:#f8fafc;font-size:13px;">생성 이미지 미리보기</strong>
          <span id="agentGeneratedImageCount" style="color:#86efac;font-size:12px;font-weight:800;">0장</span>
        </div>
        <div id="agentGeneratedImageGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;"></div>
      </div>
    </div>
  `;

  window.__agentProgressActive = true;
  window.updateAgentProgressUI = updateAgentProgressModal;
  window.appendAgentGeneratedImageUI = appendAgentGeneratedImagePreview;
  updateAgentProgressModal(4, `${providerLabel} 전용 작업 모달을 열었습니다.`, 'info', 'prepare');
}

function appendAgentGeneratedImagePreview(image = {}) {
  try {
    const url = String(image.url || image.imageUrl || image.thumbnailUrl || '').trim();
    if (!url) return;
    const wrap = document.getElementById('agentGeneratedImagePreviewWrap');
    const grid = document.getElementById('agentGeneratedImageGrid');
    const countEl = document.getElementById('agentGeneratedImageCount');
    if (!wrap || !grid) return;

    wrap.style.display = 'block';
    const item = document.createElement('a');
    item.href = url;
    item.target = '_blank';
    item.rel = 'noopener noreferrer';
    item.style.cssText = 'display:block;text-decoration:none;background:rgba(15,23,42,.8);border:1px solid rgba(148,163,184,.16);border-radius:12px;overflow:hidden;color:#e2e8f0;';

    const img = document.createElement('img');
    img.src = url;
    img.alt = String(image.label || 'Agent generated image');
    img.loading = 'lazy';
    img.style.cssText = 'display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:#0f172a;';

    const label = document.createElement('div');
    label.textContent = String(image.label || '이미지');
    label.style.cssText = 'padding:8px 9px;font-size:11px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

    item.appendChild(img);
    item.appendChild(label);
    grid.appendChild(item);

    if (countEl) countEl.textContent = `${grid.children.length}장`;
  } catch (error) {
    console.warn('[AGENT-PROGRESS] image preview append failed:', error);
  }
}

function updateAgentProgressModal(percent, message = '', type = 'info', explicitStage = '') {
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  const activeStage = getAgentProgressStage(safePercent, explicitStage);
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
              <span>🌊 Flow (Google Labs)</span>
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
    finalResult = {
      ...finalResult,
      ...next,
      ts: Date.now(),
    };
    try { window.__lastPublishResult = finalResult; } catch {}
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
  const referenceUrlEl = document.getElementById('referenceUrl');
  const referenceUrlValue = referenceUrlEl?.value?.trim() || '';
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
  const shouldUseAgentGeneration = !isQueueRun
    && executionMode === 'agent'
    && !appState.generatedContent?.content?.trim();
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
      if (shouldUseAgentGeneration) {
        let activeAgentProvider = 'codex';
        try { activeAgentProvider = localStorage.getItem('leadernamActiveAgentProvider') === 'claude' ? 'claude' : 'codex'; } catch {}
        ensureAgentProgressModal(activeAgentProvider);
        updateAgentProgressModal(8, 'Agent 모드: 글 생성, 이미지 생성, 발행 작업을 준비합니다.', 'info', 'prepare');
      }
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

    // ── Guard: 백엔드 연결 확인 ──
    if (shouldUseAgentGeneration) {
      if (typeof window.runAgentJobFromPosting !== 'function') {
        throw new Error('Agent 실행 모듈을 아직 준비하지 못했습니다. 앱을 다시 실행한 뒤 시도해주세요.');
      }
      addLog('Agent 모드: 현재 상세설정으로 글 생성을 시작합니다.', 'info');
      updateAgentProgressModal(18, 'Agent 모드: 현재 상세설정으로 글과 이미지 작업을 시작합니다.', 'info', 'article');
      addLog('Agent 모드: 현재 상세설정으로 글과 이미지 생성을 시작합니다.', 'info');
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
      updateAgentProgressModal(84, 'Agent 글/이미지 산출물을 적용했습니다. 플랫폼 발행을 시작합니다.', 'success', 'publish');
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
export async function publishToPlatform() {
  const appState = getAppState();
  const isQueueRun = !!(window.__queueRunning || window.__queueProgressActive);
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

      if (result?.ok || result?.success) {
        publishSucceeded = true;
        if (agentFlowActive) updateAgentProgressModal(100, '글 생성, 이미지 생성, 발행이 모두 완료되었습니다.', 'success', 'publish');
        addLog('✅ 콘텐츠 발행 완료!', 'success');
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
        return result;
      } else {
        const publishError = result?.error || '알 수 없는 오류';
        addLog('❌ 발행 실패: ' + publishError, 'error');
        if (agentFlowActive) updateAgentProgressModal(94, `발행 실패: ${publishError}`, 'error', 'publish');
        return result || { ok: false, error: publishError };
      }
    } catch (error) {
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

/** 기본값 상수 */
const PAYLOAD_DEFAULTS = {
  provider: 'gemini',
  titleMode: 'auto',
  contentMode: 'external',
  toneStyle: 'professional',
  thumbnailMode: 'nanobanana2',
  ctaMode: 'auto',
  h2ImageSource: 'nanobanana2',
  sectionCount: 5,
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

/** 섹션 수 계산 (DOM 기반) */
function getSectionCount() {
  const sectionCountSelect = document.getElementById('sectionCount');
  let count = PAYLOAD_DEFAULTS.sectionCount;
  if (sectionCountSelect) {
    if (sectionCountSelect.value === 'custom') {
      const customInput = document.getElementById('customSectionCount');
      count = customInput && customInput.value ? parseInt(customInput.value) : PAYLOAD_DEFAULTS.sectionCount;
    } else {
      count = parseInt(sectionCountSelect.value);
    }
  }
  return Math.max(PAYLOAD_DEFAULTS.minSectionCount, Math.min(PAYLOAD_DEFAULTS.maxSectionCount, count || PAYLOAD_DEFAULTS.sectionCount));
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
  const codexImageManaged = !!agentImageMode?.codexImageManaged;
  const selectedPolicy = normalizeImagePolicy(
    agentImageMode?.imagePolicy
    || agentImageMode?.policy
    || document.querySelector('input[name="swImagePolicy"]:checked')?.value
    || document.getElementById('h2ImageMode')?.value
    || 'all'
  );
  const legacyH2ImageMode = toLegacyH2ImageMode(selectedPolicy);
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
      h2ImageSource: settings.source || PAYLOAD_DEFAULTS.h2ImageSource,
      h2ImageSections: settings.sections || [],
      h2ImageMode: legacyH2ImageMode,
      imagePolicy: selectedPolicy,
      h2Images: { ...settings, leonardoModel, mode: legacyH2ImageMode, imagePolicy: selectedPolicy, h2TextIncluded: false },
      leonardoModel,
      thumbnailTextIncluded,
      thumbnailIncludeText: thumbnailTextIncluded,
      h2TextIncluded: false,
      agentImageManaged: codexImageManaged || undefined,
      imageManagedBy: codexImageManaged ? 'codex-agent' : undefined,
    };
  }

  // DOM에서 직접 읽기
  const h2ImageSourceSelect = document.getElementById('h2ImageSource') || document.getElementById('h2ImageSourceSelect');
  const h2ImageSourceRadio = document.querySelector('input[name="h2ImageSource"]:checked');
  const h2ImageSourceValue = h2ImageSourceSelect?.value || h2ImageSourceRadio?.value || PAYLOAD_DEFAULTS.h2ImageSource;
  const leonardoModel = document.getElementById('h2LeonardoModel')?.value
    || document.getElementById('thumbnailTypeLeonardoModel')?.value
    || document.getElementById('thumbnailLeonardoModel')?.value
    || 'seedream-4.5';

  const h2ImageSectionCheckboxes = document.querySelectorAll('input[name="h2Sections"]:checked');
  const h2ImageSections = Array.from(h2ImageSectionCheckboxes)
    .map(cb => parseInt(cb.value))
    .filter(n => Number.isFinite(n) && n > 0);

  return {
    h2ImageSource: h2ImageSourceValue,
    h2ImageSections: h2ImageSections,
    h2ImageMode: legacyH2ImageMode,
    imagePolicy: selectedPolicy,
    h2Images: { source: h2ImageSourceValue, sections: h2ImageSections, leonardoModel, mode: legacyH2ImageMode, imagePolicy: selectedPolicy, h2TextIncluded: false },
    leonardoModel,
    thumbnailTextIncluded,
    thumbnailIncludeText: thumbnailTextIncluded,
    h2TextIncluded: false,
    agentImageManaged: codexImageManaged || undefined,
    imageManagedBy: codexImageManaged ? 'codex-agent' : undefined,
  };
}

/** 플랫폼 정규화 */
function normalizePlatform(platform) {
  if (platform === 'blogger') return 'blogspot';
  return platform;
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
    if (v.startsWith('openai-')) return 'openai';
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
  const keywordValue = keywordInput ? keywordInput.value.trim() : '';
  if (DOMCache.get('keywordInput') && DOMCache.get('keywordInput') !== document.getElementById('keywordInput')) {
    console.warn('[PAYLOAD] ⚠️ DOMCache keywordInput stale 감지 — 직접 DOM 사용');
  }

  const titleModeSelect = document.getElementById('titleMode');
  const titleModeValue = titleModeSelect?.value || PAYLOAD_DEFAULTS.titleMode;

  let titleValue = null;
  if (titleModeValue === 'custom') {
    const customTitleInput = document.getElementById('customTitle');
    titleValue = customTitleInput?.value?.trim() || null;
  }
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
  const singleInputMode = (() => {
    try { return localStorage.getItem('singleInputMode') || 'keyword'; }
    catch { return 'keyword'; }
  })();
  const isUrlInputMode = singleInputMode === 'url' && referenceUrls.length > 0;

  // ── 초안 (페러프레이징 모드) ──
  const draftInputEl = document.getElementById('draftInput');
  const draftContentValue = draftInputEl?.value?.trim() || '';

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
  const tistoryDefaultCategoryValue = (
    document.getElementById('tistoryDefaultCategory')?.value
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
    (provider === 'openai' && radioValue.startsWith('openai-')) ||
    (provider === 'claude' && radioValue.startsWith('claude-')) ||
    (provider === 'perplexity' && radioValue.startsWith('perplexity-'));
  const primaryGeminiTextModelValue = radioMatchesProvider
    ? radioValue
    : (PROVIDER_DEFAULT_MODEL[provider] || 'gemini-2.5-flash');

  // ── 미리보기 전용 필드 ──
  const authorNickname = document.getElementById('authorNickname')?.value?.trim() || '';
  const useGoogleSearch = document.getElementById('useGoogleSearch')?.checked || false;
  const dynamicMinChars = sectionCount * 1200;
  const dynamicMaxChars = sectionCount * 1500;

  const payload = {
    // 핵심 필드
    provider,
    primaryGeminiTextModel: primaryGeminiTextModelValue,
    titleAI: provider,
    summaryAI: provider,
    topic: keywordValue,
    title: titleValue,
    keywords: [{ keyword: keywordValue, title: titleValue }],

    // 제목 옵션
    titleMode: titleModeValue,
    useKeywordAsTitle: document.getElementById('useKeywordAsTitle')?.checked || false,
    keywordFront: document.getElementById('keywordFront')?.checked || false,

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
    thumbnailMode: thumbnailModeValue,
    thumbnailType: savedThumbnail ? 'custom' : thumbnailModeValue,
    customThumbnail: savedThumbnail || undefined,
    customThumbnailText: thumbnailTextValue || undefined,
    thumbnailTextIncluded,
    thumbnailIncludeText: thumbnailTextIncluded,
    h2TextIncluded: false,
    ...h2ImageSettings,

    // v3.6.5: 이미지 생성 탭에서 미리 만든 이미지 자동 배치 (H2 #1, #2... 순서대로)
    //   각 원소: { h2Index, dataUrl, prompt }
    //   orchestration이 받으면 dispatchH2ImageGeneration 스킵하고 해당 dataUrl 사용
    preGeneratedImages: (window.__preGeneratedImagesForArticle || []).length > 0
      ? window.__preGeneratedImagesForArticle.map(img => ({ h2Index: img.h2Index, dataUrl: img.dataUrl }))
      : undefined,

    // 초안 (페러프레이징)
    draftContent: contentModeValue === 'paraphrasing' && draftContentValue ? draftContentValue : undefined,

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
