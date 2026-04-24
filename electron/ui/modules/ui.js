// 🔧 UI 모듈 - 모달, 알림, 탭 관리
import { DOMCache, getAppState, getErrorHandler, getStorageManager, ButtonStateManager, getProgressManager, addLog, debugLog, errorLog, successLog, sanitizeHTML, getTextLength } from './core.js';

// 탭 전환 함수
export function showTab(tabName) {
  console.log('🔄 탭 전환:', tabName);

  // 모든 탭 버튼에서 active 클래스 제거
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.classList.remove('active');
  });

  // 클릭된 탭 버튼에 active 클래스 추가
  const activeButton = Array.from(tabButtons).find(btn =>
    btn.getAttribute('onclick')?.includes(`'${tabName}'`)
  );
  if (activeButton) {
    activeButton.classList.add('active');
  }

  // 모든 탭 콘텐츠 숨기기
  const allTabs = document.querySelectorAll('.tab-content, [id$="-tab"]');
  allTabs.forEach(tab => {
    tab.style.display = 'none';
  });

  // 선택된 탭 표시
  let targetTab = null;

  switch (tabName) {
    case 'main':
      targetTab = document.getElementById('main-tab') || document.querySelector('[class*="main"]');
      break;
    case 'thumbnail':
      targetTab = document.getElementById('thumbnail-tab') || document.getElementById('thumbnail');
      break;
    case 'settings':
      targetTab = document.getElementById('settings-tab') || document.getElementById('posting-tab');
      break;
    case 'semi-auto':
      targetTab = document.getElementById('semi-auto-tab') || document.getElementById('semi-auto-image-management-tab');
      break;
    case 'schedule':
      targetTab = document.getElementById('schedule-tab') || document.getElementById('calendar-tab');
      break;
    case 'preview':
      targetTab = document.getElementById('preview-tab') || document.getElementById('preview');
      break;
    case 'internal-links':
      targetTab = document.getElementById('internal-links-tab');
      break;
    case 'keyword-discover':
      targetTab = document.getElementById('keyword-discover-tab');
      break;
    case 'content':
      targetTab = document.getElementById('content-tab');
      break;
    case 'adsense-tools':
      targetTab = document.getElementById('adsense-tools-tab');
      // 최초 진입 시 초기화
      if (targetTab && !targetTab.dataset.initialized) {
        targetTab.dataset.initialized = 'true';
        if (window.__initAdsenseTools) window.__initAdsenseTools();
      }
      break;
    default:
      console.warn('⚠️ 알 수 없는 탭:', tabName);
  }

  if (targetTab) {
    targetTab.style.display = 'block';
    console.log('✅ 탭 표시:', tabName, targetTab.id);
  } else {
    console.error('❌ 탭을 찾을 수 없습니다:', tabName);
  }

  // 메인 탭이 아닌 경우 app-header 숨기기 (겹침 방지)
  const appHeader = document.querySelector('.app-header');
  if (appHeader) {
    appHeader.style.display = tabName === 'main' ? '' : 'none';
  }

  // 사이드바 active 상태 동기화
  const tabToNavMap = {
    'main': 'nav-main',
    'thumbnail': 'nav-thumbnail',
    'settings': 'nav-auto',
    'semi-auto': 'nav-semiauto',
    'schedule': 'nav-schedule',
    'internal-links': 'nav-intlinks-page',
    'keyword-discover': 'nav-keyword-discover',
    'content': 'nav-convert',
    'adsense-tools': 'nav-adsense-tools',
  };
  window.__sidebarSetActive?.(tabToNavMap[tabName]);
}

// 라이센스 관련 함수는 제거됨 (로그인 형식으로 변경)

// 진행 상태 모달 표시
export function showProgressModal() {
  console.log('🚀 showProgressModal 호출됨');

  const progressBar = document.getElementById('premiumProgressBar');
  const publishBtn = DOMCache.get('publishBtn');
  const cancelBtn = document.getElementById('cancelProgressBtn');

  if (progressBar) {
    console.log('✅ 프리미엄 진행 바 표시 시작');

    // 🔥 stacking context 문제 방지: body 최상위로 이동
    if (progressBar.parentElement !== document.body) {
      document.body.appendChild(progressBar);
      console.log('[PROGRESS] ✅ body로 이동 완료');
    }

    const progressManager = getProgressManager();
    progressManager.reset();
    window.progressStartTime = progressManager.progressStartTime;

    // 🔥 viewport 전체 오버레이로 강제 설정
    progressBar.style.position = 'fixed';
    progressBar.style.top = '0';
    progressBar.style.left = '0';
    progressBar.style.width = '100vw';
    progressBar.style.height = '100vh';
    progressBar.style.zIndex = '2147483647';
    progressBar.style.transform = 'none';

    // 모달 강제 표시 (중앙 정렬)
    progressBar.style.display = 'flex';
    progressBar.style.visibility = 'visible';
    progressBar.style.opacity = '1';
    progressBar.style.alignItems = 'center';
    progressBar.style.justifyContent = 'center';
    progressBar.style.background = 'rgba(0, 0, 0, 0.85)';
    progressBar.style.backdropFilter = 'blur(10px)';

    progressManager.reset();
    progressManager.updateProgress(0, 0, '작업 준비 중...');

    // 진행률 바 초기화
    const progressFill = document.getElementById('progressFill');
    if (progressFill) {
      progressFill.style.width = '0%';
    }
    const progressPercentage = document.getElementById('progressPercentage');
    if (progressPercentage) {
      progressPercentage.textContent = '0%';
    }
    const progressStep = document.getElementById('progressStep');
    if (progressStep) {
      progressStep.textContent = '작업 준비 중...';
    }

    const elapsedEl = document.getElementById('progressElapsed') || document.getElementById('progressTime');
    if (elapsedEl) {
      elapsedEl.textContent = '⏱️ 경과: 00:00';
    }
    const etaEl = document.getElementById('progressEta') || document.getElementById('estimatedTime');
    if (etaEl) {
      etaEl.textContent = '⏳ 예상: 00:00';
    }

    if (cancelBtn) {
      cancelBtn.disabled = false;
      cancelBtn.style.opacity = '1';
      cancelBtn.style.pointerEvents = 'auto';
    }

    if (window.initializeProgressSteps) {
      window.initializeProgressSteps();
    }
    if (window.resetProgressSteps) {
      window.resetProgressSteps();
    }

    console.log('✅ 모달 표시 완료');
  } else {
    console.error('❌ 모달 요소를 찾을 수 없음');

    if (window.createFallbackProgressModal) {
      window.createFallbackProgressModal();
    }
  }

  ButtonStateManager.setLoading('publishBtn', `
      <span style="display: flex; align-items: center; justify-content: center; gap: 10px; font-weight: 700;">
        <span style="animation: pulse 1.5s infinite;">✍️</span>
        <span>글 작성중...</span>
      </span>
    `);
}

// 대체 진행상황 모달 생성 함수
export function createFallbackProgressModal() {
  console.log('🔄 대체 진행상황 모달 생성 시작');

  const existingOverlay = document.getElementById('fallbackProgressOverlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'fallbackProgressOverlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 1;
    visibility: visible;
  `;

  const container = document.createElement('div');
  container.style.cssText = `
    background: white;
    border-radius: 16px;
    padding: 24px;
    max-width: 380px;
    width: 90%;
    text-align: center;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.08);
  `;

  container.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 20px;">🚀</div>
    <h2 style="margin: 0 0 20px 0; color: #333;">포스팅 생성 중...</h2>
    <div style="background: #f0f0f0; border-radius: 10px; height: 20px; margin: 20px 0; overflow: hidden;">
      <div id="fallbackProgressBar" style="background: linear-gradient(90deg, #667eea, #764ba2); height: 100%; width: 0%; transition: width 0.3s ease;"></div>
    </div>
    <div id="fallbackProgressText" style="color: #666; font-size: 14px;">0%</div>
    <div id="fallbackProgressStatus" style="color: #999; font-size: 12px; margin-top: 10px;">초기화 중...</div>
  `;

  overlay.appendChild(container);
  document.body.appendChild(overlay);

  console.log('✅ 대체 진행상황 모달 생성 완료');

  window.fallbackProgressModal = {
    overlay: overlay,
    container: container,
    progressBar: container.querySelector('#fallbackProgressBar'),
    progressText: container.querySelector('#fallbackProgressText'),
    progressStatus: container.querySelector('#fallbackProgressStatus')
  };
}

// 진행 상태 모달 숨기기
export function hideProgressModal() {
  console.log('🚀 hideProgressModal 호출됨');

  const progressBar = document.getElementById('premiumProgressBar');
  const publishBtn = DOMCache.get('publishBtn');
  const cancelBtn = document.getElementById('cancelProgressBtn');

  if (progressBar) {
    console.log('✅ 프리미엄 진행 바 숨기기 시작');

    progressBar.style.display = 'none';
    progressBar.style.visibility = 'hidden';
    progressBar.style.opacity = '0';

    console.log('✅ 프리미엄 진행 바 완전히 숨김');
  } else {
    console.warn('⚠️ 진행 바 요소를 찾을 수 없습니다');
  }

  ButtonStateManager.restore('publishBtn');

  if (cancelBtn) {
    cancelBtn.disabled = true;
    cancelBtn.style.opacity = '0.6';
    cancelBtn.style.pointerEvents = 'none';
  }
}

// 실행 상태 설정
export function setRunning(running) {
  getAppState().isRunning = running;
  if (running) {
    ButtonStateManager.setLoading('runBtn', '실행 중...');
  } else {
    ButtonStateManager.restore('runBtn');
  }
}

// 진행 취소
export function cancelProgress() {
  getAppState().isCanceled = true;
  addLog('사용자가 작업을 취소했습니다.', 'warning');
  hideProgressModal();
  setRunning(false);
}

// 자동 백업 시스템 시작
export function startAutoBackup() {
  // 자동 백업 로직은 나중에 구현
  debugLog('AUTO-BACKUP', '자동 백업 시스템 시작');
}

// 환경설정 모달 열기
export async function openSettingsModal() {
  console.log('🔧 환경설정 모달 열기 시도...');
  const modal = document.getElementById('settingsModal');
  console.log('🔍 모달 요소:', modal);

  if (modal) {
    console.log('✅ 모달 요소 찾음, 표시 중...');
    modal.style.display = 'flex';
    try {
      if (window.loadSettingsContent) {
        await window.loadSettingsContent();
      }
      console.log('✅ 환경설정 내용 로드 완료');
    } catch (error) {
      console.error('❌ 환경설정 내용 로드 실패:', error);
    }
  } else {
    console.error('❌ settingsModal 요소를 찾을 수 없습니다!');
  }
}

// 환경설정 모달 닫기
export function closeSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// 미리보기 모달 닫기
export function closePreviewModal() {
  const overlay = document.getElementById('previewOverlay');
  const modal = document.getElementById('previewModal');

  if (overlay) overlay.style.display = 'none';
  if (modal) modal.style.display = 'none';

  if (window.previewData) {
    window.previewData = null;
  }
}

// API 페이지 열기 함수들
export function openPexelsApiPage() {
  try {
    console.log('📸 [PEXELS] Pexels API 페이지 열기');

    if (window.blogger && window.blogger.openExternal) {
      window.blogger.openExternal('https://www.pexels.com/api/');
    } else {
      window.open('https://www.pexels.com/api/', '_blank');
    }

    console.log('✅ [PEXELS] Pexels API 페이지 열기 완료');
  } catch (error) {
    console.error('❌ [PEXELS] Pexels API 페이지 열기 실패:', error);
    alert('Pexels API 페이지 열기에 실패했습니다: ' + error.message);
  }
}

export function openDalleApiPage() {
  try {
    console.log('🎨 [DALLE] DALL-E API 페이지 열기');

    if (window.blogger && window.blogger.openExternal) {
      window.blogger.openExternal('https://platform.openai.com/api-keys');
    } else {
      window.open('https://platform.openai.com/api-keys', '_blank');
    }

    console.log('✅ [DALLE] DALL-E API 페이지 열기 완료');
  } catch (error) {
    console.error('❌ [DALLE] DALL-E API 페이지 열기 실패:', error);
    alert('DALL-E API 페이지 열기에 실패했습니다: ' + error.message);
  }
}

export function openNaverApiPage() {
  try {
    console.log('🟢 [NAVER] 네이버 API 페이지 열기');

    if (window.blogger && window.blogger.openExternal) {
      window.blogger.openExternal('https://developers.naver.com/apps/#/myapps');
    } else {
      window.open('https://developers.naver.com/apps/#/myapps', '_blank');
    }

    console.log('✅ [NAVER] 네이버 API 페이지 열기 완료');
  } catch (error) {
    console.error('❌ [NAVER] 네이버 API 페이지 열기 실패:', error);
    alert('네이버 API 페이지 열기에 실패했습니다: ' + error.message);
  }
}

export function openGoogleOAuthPage() {
  try {
    console.log('🔐 [GOOGLE OAUTH] Google OAuth 페이지 열기');

    if (window.blogger && window.blogger.openExternal) {
      window.blogger.openExternal('https://console.developers.google.com/apis/credentials');
    } else {
      window.open('https://console.developers.google.com/apis/credentials', '_blank');
    }

    console.log('✅ [GOOGLE OAUTH] Google OAuth 페이지 열기 완료');
  } catch (error) {
    console.error('❌ [GOOGLE OAUTH] Google OAuth 페이지 열기 실패:', error);
    alert('Google OAuth 페이지 열기에 실패했습니다: ' + error.message);
  }
}

export function openGoogleTrends() {
  try {
    console.log('📊 [TRENDS] 구글 트렌드 열기');

    // Electron 환경에서 외부 브라우저로 열기
    if (window.blogger && window.blogger.openExternal) {
      window.blogger.openExternal('https://trends.google.com/trends/');
    } else {
      // 웹 환경에서 새 창으로 열기
      window.open('https://trends.google.com/trends/', '_blank');
    }

    console.log('✅ [TRENDS] 구글 트렌드 열기 완료');

  } catch (error) {
    console.error('❌ [TRENDS] 구글 트렌드 열기 실패:', error);
    alert('구글 트렌드 열기에 실패했습니다: ' + error.message);
  }
}

export function openGeminiApiPage() {
  try {
    console.log('🤖 [GEMINI] Gemini API 페이지 열기');

    if (window.blogger && window.blogger.openExternal) {
      window.blogger.openExternal('https://makersuite.google.com/app/apikey');
    } else {
      window.open('https://makersuite.google.com/app/apikey', '_blank');
    }

    console.log('✅ [GEMINI] Gemini API 페이지 열기 완료');
  } catch (error) {
    console.error('❌ [GEMINI] Gemini API 페이지 열기 실패:', error);
    alert('Gemini API 페이지 열기에 실패했습니다: ' + error.message);
  }
}

export function openGoogleCseApiPage() {
  try {
    console.log('🔍 [GOOGLE CSE] Google CSE API 페이지 열기');

    if (window.blogger && window.blogger.openExternal) {
      window.blogger.openExternal('https://console.developers.google.com/apis/credentials');
    } else {
      window.open('https://console.developers.google.com/apis/credentials', '_blank');
    }

    console.log('✅ [GOOGLE CSE] Google CSE API 페이지 열기 완료');
  } catch (error) {
    console.error('❌ [GOOGLE CSE] Google CSE API 페이지 열기 실패:', error);
    alert('Google CSE API 페이지 열기에 실패했습니다: ' + error.message);
  }
}

// YouTube API 페이지 함수는 제거됨

export function openKeywordMasterModal() {
  try {
    console.log('🔑 [키워드 마스터] 모달 열기');
    const modal = document.getElementById('keywordMasterModal');
    if (modal) {
      modal.style.display = 'flex';
      console.log('✅ [키워드 마스터] 모달 열기 완료');
    } else {
      console.error('❌ [키워드 마스터] 모달 요소를 찾을 수 없습니다');
    }
  } catch (error) {
    console.error('❌ [키워드 마스터] 모달 열기 실패:', error);
  }
}

export function closeKeywordMasterModal() {
  try {
    console.log('🔑 [키워드 마스터] 모달 닫기');
    const modal = document.getElementById('keywordMasterModal');
    if (modal) {
      modal.style.display = 'none';
      console.log('✅ [키워드 마스터] 모달 닫기 완료');
    }
  } catch (error) {
    console.error('❌ [키워드 마스터] 모달 닫기 실패:', error);
  }
}

// 키워드 마스터 창 열기
export async function openKeywordMaster() {
  try {
    console.log('🔑 [키워드 마스터] 창 열기');

    // Electron API를 통해 키워드 마스터 창 열기
    if (window.electronAPI && window.electronAPI.openKeywordMasterWindow) {
      await window.electronAPI.openKeywordMasterWindow();
      console.log('✅ [키워드 마스터] 창 열기 완료');
    } else if (window.blogger && window.blogger.openKeywordMasterWindow) {
      await window.blogger.openKeywordMasterWindow();
      console.log('✅ [키워드 마스터] 창 열기 완료 (blogger API)');
    } else {
      console.warn('⚠️ [키워드 마스터] API를 찾을 수 없습니다.');
      alert('키워드 마스터 기능을 사용할 수 없습니다. Electron 환경에서만 동작합니다.');
    }
  } catch (error) {
    console.error('❌ [키워드 마스터] 열기 실패:', error);
    alert('키워드 마스터 열기에 실패했습니다: ' + (error.message || String(error)));
  }
}

// 전역 함수로 노출 (하위 호환성)
// 주의: main.js에서도 등록하므로 중복이지만, 모듈 로딩 순서를 고려하여 여기서도 등록
// main.js가 로드되기 전에 ui.js가 먼저 로드될 수 있으므로 여기서도 등록
// 알림 시스템 (중앙, 초록색)
export function showNotification(message, duration = 3000) {
  const container = document.getElementById('notificationContainer');
  const messageEl = document.getElementById('notificationMessage');

  if (!container || !messageEl) {
    // 폴백: 기존 alert 사용
    alert(message);
    return;
  }

  messageEl.textContent = message;
  container.style.display = 'block';
  messageEl.style.animation = 'notificationSlideIn 0.3s ease-out';

  // 자동 숨김
  setTimeout(() => {
    messageEl.style.animation = 'notificationSlideOut 0.3s ease-out';
    setTimeout(() => {
      container.style.display = 'none';
    }, 300);
  }, duration);
}

if (!window.showTab) window.showTab = showTab;
if (!window.showProgressModal) window.showProgressModal = showProgressModal;
if (!window.createFallbackProgressModal) window.createFallbackProgressModal = createFallbackProgressModal;
if (!window.hideProgressModal) window.hideProgressModal = hideProgressModal;
if (!window.cancelProgress) window.cancelProgress = cancelProgress;
if (!window.openSettingsModal) window.openSettingsModal = openSettingsModal;
if (!window.closeSettingsModal) window.closeSettingsModal = closeSettingsModal;
if (!window.closePreviewModal) window.closePreviewModal = closePreviewModal;
if (!window.openPexelsApiPage) window.openPexelsApiPage = openPexelsApiPage;
if (!window.openDalleApiPage) window.openDalleApiPage = openDalleApiPage;
if (!window.openNaverApiPage) window.openNaverApiPage = openNaverApiPage;
if (!window.openGoogleOAuthPage) window.openGoogleOAuthPage = openGoogleOAuthPage;
if (!window.openGoogleTrends) window.openGoogleTrends = openGoogleTrends;
if (!window.openGeminiApiPage) window.openGeminiApiPage = openGeminiApiPage;
if (!window.openGoogleCseApiPage) window.openGoogleCseApiPage = openGoogleCseApiPage;
if (!window.openKeywordMasterModal) window.openKeywordMasterModal = openKeywordMasterModal;
if (!window.closeKeywordMasterModal) window.closeKeywordMasterModal = closeKeywordMasterModal;
if (!window.openKeywordMaster) window.openKeywordMaster = openKeywordMaster;

// 플랫폼 필드 토글
export function togglePlatformFields() {
  // 🔥 라디오 값을 먼저 읽고, 없으면 DOM의 checked 상태를 이중 확인
  let selectedPlatform = document.querySelector('input[name="platform"]:checked')?.value || '';
  if (!selectedPlatform) {
    // 직접 ID로 확인 (race condition 대비)
    const bloggerEl = document.getElementById('platform-blogger');
    const wpEl = document.getElementById('platform-wordpress');
    if (bloggerEl?.checked) selectedPlatform = 'blogger';
    else if (wpEl?.checked) selectedPlatform = 'wordpress';
    else selectedPlatform = 'wordpress'; // 최종 기본값
  }
  const bloggerOAuthBtn = document.getElementById('bloggerOAuthBtn');
  const wordpressSettings = document.getElementById('wordpressSettings');
  const bloggerSettings = document.getElementById('bloggerSettings');

  console.log('togglePlatformFields 실행:', selectedPlatform);

  // Blogger OAuth2 버튼 상태 변경
  if (bloggerOAuthBtn) {
    if (selectedPlatform === 'blogger') {
      bloggerOAuthBtn.style.display = 'flex';
      bloggerOAuthBtn.style.opacity = '1';
      bloggerOAuthBtn.style.pointerEvents = 'auto';
      bloggerOAuthBtn.style.cursor = 'pointer';
    } else {
      bloggerOAuthBtn.style.display = 'flex';
      bloggerOAuthBtn.style.opacity = '0.3';
      bloggerOAuthBtn.style.pointerEvents = 'none';
      bloggerOAuthBtn.style.cursor = 'not-allowed';
    }
    console.log('Blogger OAuth2 버튼 상태:', selectedPlatform === 'blogger' ? '활성' : '비활성');
  }

  // 워드프레스 설정 표시/숨김
  if (wordpressSettings) {
    if (selectedPlatform === 'wordpress') {
      wordpressSettings.style.display = 'block';
      console.log('워드프레스 설정: 표시');
    } else {
      wordpressSettings.style.display = 'none';
      console.log('워드프레스 설정: 숨김');
    }
  }

  // 워드프레스 카테고리 탭 표시/숨김
  const wpCategoryTab = document.getElementById('settingsTabCategory');
  const wpCategoryPanel = document.getElementById('tab-category');
  if (wpCategoryTab) {
    if (selectedPlatform === 'wordpress') {
      wpCategoryTab.style.display = 'flex';
      console.log('워드프레스 카테고리 탭: 표시');
    } else {
      wpCategoryTab.style.display = 'none';
      if (wpCategoryPanel && wpCategoryPanel.classList.contains('active')) {
        if (window.switchPostingSettingsTab) window.switchPostingSettingsTab('tab-content');
      }
      console.log('워드프레스 카테고리 탭: 숨김');
    }
  }

  // 블로거 설정 표시/숨김 (있는 경우)
  if (bloggerSettings) {
    if (selectedPlatform === 'blogger') {
      bloggerSettings.style.display = 'block';
      console.log('블로거 설정: 표시');
    } else {
      bloggerSettings.style.display = 'none';
      console.log('블로거 설정: 숨김');
    }
  }
}
