// 🔧 포스팅 관련 함수들
import { DOMCache, getAppState, getErrorHandler, getStorageManager, ButtonStateManager, getProgressManager, addLog, debugLog, errorLog, successLog } from './core.js';
import { showProgressModal, hideProgressModal, setRunning } from './ui.js';
import { loadSettings } from './settings.js';
import { addTodayWorkRecord } from './calendar.js';
import { getAllKeywords, getH2ImageSections } from './utils.js';

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

      modal.remove();
      resolve({
        source: selectedSource,
        contentUrl: contentUrl,  // 🔥 콘텐츠 소스 URL
        shoppingUrl: shoppingUrl,
        aiSource: aiSource
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

  // ── Guard: 중복 실행 방지 ──
  if (appState.isRunning) {
    addLog('작업이 실행 중입니다. 잠시 후 다시 시도해주세요.', 'warning');
    return;
  }

  // ── Guard: 키워드 필수 ──
  const keywordInput = DOMCache.get('keywordInput');
  const keywordValue = keywordInput?.value?.trim();
  if (!keywordValue) {
    getErrorHandler().showToast('키워드를 입력해주세요.', 'error');
    return;
  }

  try {
    debugLog('POSTING', '포스팅 실행 시작');

    // 이미지 소스: 기본값 자동 수집 (모달 없이 즉시 발행)
    const imageSettings = { source: 'auto', contentUrl: '', shoppingUrl: '', aiSource: 'pollinations' };

    // ── 상태 전환 ──
    appState.isRunning = true;
    appState.isCanceled = false;
    setRunning(true);
    showProgressModal();

    // ── Payload 생성 (통합 함수 사용) ──
    const payload = createPayload({ previewOnly: false });

    // 이미지 설정 오버라이드
    payload.imageSettings = imageSettings;
    if (imageSettings.source === 'ai' && imageSettings.aiSource) {
      payload.h2ImageSource = imageSettings.aiSource;
      debugLog('POSTING', `AI 이미지 소스 설정: ${imageSettings.aiSource}`);
    }
    if (imageSettings.contentUrl) {
      payload.sourceUrl = imageSettings.contentUrl;
      payload.manualCrawlUrls = [imageSettings.contentUrl];
      payload.contentMode = 'external';
      debugLog('POSTING', `URL 기반 발행: ${imageSettings.contentUrl}`);
    }

    // ── Guard: 백엔드 연결 확인 ──
    if (!window.blogger?.runPost) {
      throw new Error('백엔드 연결 실패: window.blogger.runPost를 찾을 수 없습니다.');
    }

    successLog('POSTING', '백엔드 연결 확인 완료');

    // ── 백엔드 호출 (async/await) ──
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
      addLog('🎉 블로그 포스트가 성공적으로 완성되었습니다!', 'success');

      if (result.html && result.title) {
        updatePreview(result.title, result.html, result.url);
        addLog('미리보기가 업데이트되었습니다.', 'info');
      }

      // 작업 기록
      const keywords = getAllKeywords();
      const platform = document.querySelector('input[name="platform"]:checked')?.value || 'wordpress';
      const platformName = platform === 'blogger' || platform === 'blogspot' ? '블로거' : '워드프레스';
      keywords.forEach(() => {
        const generatedTitle = getStorageManager().getSync('lastGeneratedTitle') || keywordValue;
        addTodayWorkRecord('포스트 작성 완료', `${platformName}에 "${generatedTitle}" 게시`);
      });
    } else {
      const errorMessage = result?.error || '알 수 없는 오류';

      if (/인증|auth|token|OAuth|Blogger/i.test(errorMessage)) {
        addLog('❌ 블로그스팟 인증이 필요합니다. 환경설정에서 인증을 완료해주세요.', 'error');
      } else {
        addLog('포스트 생성 실패: ' + errorMessage, 'error');
      }

      const statusEl = document.getElementById('workStatusTitle');
      const subtitleEl = document.getElementById('workStatusSubtitle');
      if (statusEl) statusEl.textContent = '작업 완료 (오류 발생)';
      if (subtitleEl) subtitleEl.textContent = errorMessage;
    }

  } catch (error) {
    errorLog('POSTING', error, { function: 'runPosting' });
    addLog('포스팅 오류: ' + error.message, 'error');
    hideProgressModal();
  } finally {
    // ── 상태 복구 (항상 실행) ──
    appState.isRunning = false;
    setRunning(false);
    ButtonStateManager.setEnabled('runBtn', true);
    ButtonStateManager.restore('publishBtn');
    debugLog('POSTING', '상태 복구 완료');
  }
}

// 발행 함수 (원클릭 발행) — runPosting의 래퍼
export async function publishToPlatform() {
  const appState = getAppState();
  debugLog('PUBLISH', 'publishToPlatform 호출', {
    hasContent: !!appState.generatedContent?.content?.trim(),
    isRunning: appState.isRunning,
  });

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
      showProgressModal();

      const publishPayload = {
        ...appState.generatedContent.payload,
        previewOnly: false,
      };

      addLog('블로그 발행 시작...', 'info');
      const result = await window.blogger.runPost(publishPayload);

      if (result?.ok || result?.success) {
        addLog('✅ 콘텐츠 발행 완료!', 'success');
        if (result.title || result.html || result.content) {
          appState.generatedContent = {
            title: result.title || '',
            content: result.html || result.content || '',
            thumbnail: result.thumbnail || '',
            payload: publishPayload,
          };
        }
      } else {
        addLog('❌ 발행 실패: ' + (result?.error || '알 수 없는 오류'), 'error');
      }
    } catch (error) {
      getErrorHandler().handle(error, { function: 'publishToPlatform' });
    } finally {
      appState.isRunning = false;
      setRunning(false);
      ButtonStateManager.restore('publishBtn');
      hideProgressModal();
    }
  } else {
    // 콘텐츠가 없으면 전체 생성+발행 흐름
    await runPosting();
  }
}

// ─────────────────────────────────────────────────────
// 🔧 Payload 생성 — 단일 진입점 (모든 발행/미리보기 공용)
// ─────────────────────────────────────────────────────

/** 기본값 상수 */
const PAYLOAD_DEFAULTS = {
  provider: 'openai',
  titleMode: 'auto',
  contentMode: 'external',
  toneStyle: 'professional',
  thumbnailMode: 'text',
  ctaMode: 'auto',
  h2ImageSource: 'pollinations',
  sectionCount: 5,
  minSectionCount: 1,
  maxSectionCount: 20,
  promptMode: 'max-mode',
  factCheckMode: 'grounding',
  redirectUri: 'http://localhost:8080',
};

/** API 키를 저장된 설정에서 한 번에 수집 */
function getApiKeys(savedSettings) {
  return {
    geminiKey: savedSettings.geminiKey || '',
    pexelsApiKey: savedSettings.pexelsApiKey || '',
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
function getH2ImageSettingsFromDOM() {
  // window.getH2ImageSections가 있으면 우선 사용
  if (window.getH2ImageSections) {
    const settings = window.getH2ImageSections();
    return {
      h2ImageSource: settings.source || PAYLOAD_DEFAULTS.h2ImageSource,
      h2ImageSections: settings.sections || [],
      h2Images: settings,
    };
  }

  // DOM에서 직접 읽기
  const h2ImageSourceSelect = document.getElementById('h2ImageSource') || document.getElementById('h2ImageSourceSelect');
  const h2ImageSourceRadio = document.querySelector('input[name="h2ImageSource"]:checked');
  const h2ImageSourceValue = h2ImageSourceSelect?.value || h2ImageSourceRadio?.value || PAYLOAD_DEFAULTS.h2ImageSource;

  const h2ImageSectionCheckboxes = document.querySelectorAll('input[name="h2Sections"]:checked');
  const h2ImageSections = Array.from(h2ImageSectionCheckboxes)
    .map(cb => parseInt(cb.value))
    .filter(n => Number.isFinite(n) && n > 0);

  return {
    h2ImageSource: h2ImageSourceValue,
    h2ImageSections: h2ImageSections,
    h2Images: { source: h2ImageSourceValue, sections: h2ImageSections },
  };
}

/** 플랫폼 정규화 */
function normalizePlatform(platform) {
  if (platform === 'blogger') return 'blogspot';
  return platform;
}

/**
 * 통합 Payload 생성 함수 — 모든 발행/미리보기 경로의 단일 진입점
 * @param {Object} options
 * @param {boolean} [options.previewOnly=false] - 미리보기 모드
 * @param {string}  [options.platformOverride]  - 플랫폼 강제 지정 ('preview' 등)
 * @param {Object}  [options.overrides={}]      - 개별 필드 오버라이드
 */
export function createPayload(options = {}) {
  const { previewOnly = false, platformOverride, overrides = {} } = options;

  const savedSettings = loadSettings();
  const provider = savedSettings.generationEngine || PAYLOAD_DEFAULTS.provider;

  // ── 키워드 / 제목 ──
  const keywordInput = DOMCache.get('keywordInput');
  const keywordValue = keywordInput ? keywordInput.value.trim() : '';

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
  const scheduleContentMode = document.getElementById('scheduleContentMode');
  const contentModeSelect = DOMCache.get('contentMode');
  const contentModeValue = scheduleContentMode?.value || contentModeSelect?.value || PAYLOAD_DEFAULTS.contentMode;

  const postingModeRadio = document.querySelector('input[name="postingMode"]:checked');
  const postingModeRaw = postingModeRadio?.value || 'immediate';
  const publishTypeValue = postingModeRaw === 'immediate' ? 'publish' : postingModeRaw;

  const scheduleDateTimeEl = document.getElementById('scheduleDateTime');
  const scheduleDateTime = scheduleDateTimeEl?.value ? String(scheduleDateTimeEl.value).trim() : '';

  // ── 썸네일 ──
  const scheduleThumbnailMode = document.getElementById('scheduleThumbnailMode');
  const thumbnailTypeSelect = DOMCache.get('thumbnailType');
  const thumbnailModeValue = scheduleThumbnailMode?.value || thumbnailTypeSelect?.value || PAYLOAD_DEFAULTS.thumbnailMode;
  const savedThumbnail = getStorageManager().getSync('generatedThumbnail');
  const savedThumbnailText = getStorageManager().getSync('thumbnailText');

  // ── CTA ──
  const scheduleCtaMode = document.getElementById('scheduleCtaMode');
  const ctaModeValue = scheduleCtaMode?.value || PAYLOAD_DEFAULTS.ctaMode;

  // ── 기타 설정 ──
  const toneStyleValue = document.getElementById('toneStyle')?.value || PAYLOAD_DEFAULTS.toneStyle;
  const sectionCount = getSectionCount();
  const h2ImageSettings = getH2ImageSettingsFromDOM();

  // ── 플랫폼 ──
  let selectedPlatform;
  if (platformOverride) {
    selectedPlatform = platformOverride;
  } else {
    const platformRadio = document.querySelector('input[name="platform"]:checked');
    selectedPlatform = normalizePlatform(platformRadio?.value || savedSettings.platform || 'wordpress');
  }

  // ── E-E-A-T 저자 정보 ──
  const adsenseAuthorName = document.getElementById('adsenseAuthorName')?.value?.trim() || '';
  const adsenseAuthorTitle = document.getElementById('adsenseAuthorTitle')?.value?.trim() || '';
  const adsenseAuthorCredentials = document.getElementById('adsenseAuthorCredentials')?.value?.trim() || '';

  // ── 미리보기 전용 필드 ──
  const authorNickname = document.getElementById('authorNickname')?.value?.trim() || '';
  const useGoogleSearch = document.getElementById('useGoogleSearch')?.checked || false;
  const dynamicMinChars = sectionCount * 1200;
  const dynamicMaxChars = sectionCount * 1500;

  const payload = {
    // 핵심 필드
    provider,
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
    customThumbnailText: savedThumbnailText || undefined,
    ...h2ImageSettings,

    // CTA
    ctaMode: ctaModeValue,
    manualCtas: getManualCtas(ctaModeValue),

    // 발행
    platform: selectedPlatform,
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
export function createPayloadFromForm() {
  return createPayload({ previewOnly: false });
}

/** @deprecated createPayload({ previewOnly: true }) 사용 권장 */
export function createPreviewPayload() {
  return createPayload({ previewOnly: true, platformOverride: 'preview' });
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
