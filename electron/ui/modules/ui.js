// 🔧 UI 모듈 - 모달, 알림, 탭 관리
import { DOMCache, getAppState, getErrorHandler, getStorageManager, ButtonStateManager, getProgressManager, addLog, debugLog, errorLog, successLog, sanitizeHTML, getTextLength } from './core.js';

// 탭 전환 함수

const FREE_TRIAL_ALLOWED_TABS = new Set(['main', 'settings']);

const TOP_LEVEL_TAB_IDS = [
  'schedule-tab',
  'adsense-tools-tab',
  'main-tab',
  'thumbnail-tab',
  'settings-tab',
  'content-tab',
  'semi-auto-tab',
  'internal-links-tab',
  'external-traffic-tab',
  'image-batch-tab',
];

function getTopLevelTabElements() {
  const tabs = TOP_LEVEL_TAB_IDS
    .map(id => document.getElementById(id))
    .filter(Boolean);
  return tabs.length ? tabs : Array.from(document.querySelectorAll('.tab-content'));
}
const FREE_TRIAL_TAB_LABELS = {
  main: '메인',
  thumbnail: '썸네일',
  'image-batch': '이미지 생성',
  settings: '글포스팅',
  'semi-auto': '반자동',
  schedule: '스케줄',
  preview: '미리보기',
  'internal-links': '거미줄포스팅',
  'external-traffic': '외부유입 글 생성',
  'keyword-discover': '키워드 발굴',
  content: '콘텐츠 변환',
  'adsense-tools': '애드센스 도구',
};

function getLicenseAccessState() {
  return window.__licenseAccessState || {};
}

export function isFreeTrialMode() {
  return getLicenseAccessState().isFreeTrial === true;
}

function getFreeTrialFeatureLabel(featureName) {
  if (!featureName) return '프리미엄 기능';
  return FREE_TRIAL_TAB_LABELS[featureName] || String(featureName);
}

function ensureFreeTrialUpgradeStyles() {
  if (document.getElementById('freeTrialUpgradeStyles')) return;

  const style = document.createElement('style');
  style.id = 'freeTrialUpgradeStyles';
  style.textContent = `
    body.free-trial-upgrade-open #appSidebar,
    body.free-trial-upgrade-open .app-header,
    body.free-trial-upgrade-open #tab-content-container {
      filter: blur(10px) saturate(0.7) contrast(0.82);
      transform: scale(0.996);
      transform-origin: center center;
      pointer-events: none;
      user-select: none;
    }

    #freeTrialUpgradeOverlay {
      position: fixed;
      inset: 0;
      z-index: 2147483600;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 28px;
      background:
        linear-gradient(45deg, rgba(255,255,255,0.12) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.12) 75%),
        linear-gradient(45deg, rgba(255,255,255,0.12) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.12) 75%),
        rgba(2, 6, 23, 0.66);
      background-position: 0 0, 9px 9px, 0 0;
      background-size: 18px 18px, 18px 18px, auto;
      backdrop-filter: blur(14px) saturate(0.72);
    }

    #freeTrialUpgradeOverlay.is-open {
      display: flex;
    }

    .free-trial-upgrade-modal {
      position: relative;
      width: min(560px, 94vw);
      border: 1px solid rgba(125, 211, 252, 0.32);
      border-radius: 22px;
      background:
        radial-gradient(circle at top left, rgba(34, 211, 238, 0.18), transparent 38%),
        linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(17, 24, 39, 0.96));
      color: #f8fafc;
      box-shadow: 0 32px 100px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.06) inset;
      padding: 30px;
      overflow: hidden;
    }

    .free-trial-upgrade-modal::before {
      content: "";
      position: absolute;
      inset: 0;
      background-image: linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px);
      background-size: 26px 26px;
      pointer-events: none;
    }

    .free-trial-upgrade-inner {
      position: relative;
      z-index: 1;
    }

    .free-trial-upgrade-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(14, 165, 233, 0.16);
      border: 1px solid rgba(56, 189, 248, 0.34);
      color: #bae6fd;
      font-size: 13px;
      font-weight: 800;
      margin-bottom: 16px;
    }

    .free-trial-upgrade-title {
      margin: 0;
      font-size: clamp(24px, 4vw, 34px);
      line-height: 1.18;
      letter-spacing: 0;
      font-weight: 900;
    }

    .free-trial-upgrade-copy {
      margin: 14px 0 22px;
      color: #cbd5e1;
      font-size: 15px;
      line-height: 1.7;
      font-weight: 650;
    }

    .free-trial-upgrade-list {
      display: grid;
      gap: 10px;
      margin: 0 0 24px;
      padding: 0;
      list-style: none;
    }

    .free-trial-upgrade-list li {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 38px;
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.72);
      border: 1px solid rgba(148, 163, 184, 0.16);
      color: #e2e8f0;
      font-size: 14px;
      font-weight: 700;
    }

    .free-trial-upgrade-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .free-trial-upgrade-actions button {
      min-height: 48px;
      border: 0;
      border-radius: 13px;
      font-size: 15px;
      font-weight: 900;
      cursor: pointer;
    }

    .free-trial-upgrade-buy {
      color: #05131b;
      background: linear-gradient(135deg, #67e8f9, #22d3ee 48%, #38bdf8);
      box-shadow: 0 14px 35px rgba(34, 211, 238, 0.28);
    }

    .free-trial-upgrade-cancel {
      color: #e2e8f0;
      background: rgba(30, 41, 59, 0.92);
      border: 1px solid rgba(148, 163, 184, 0.22) !important;
    }

    @media (max-width: 560px) {
      .free-trial-upgrade-modal { padding: 24px; }
      .free-trial-upgrade-actions { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);
}

export function closeFreeTrialUpgradeModal(options = {}) {
  const overlay = document.getElementById('freeTrialUpgradeOverlay');
  if (overlay) overlay.classList.remove('is-open');
  document.body.classList.remove('free-trial-upgrade-open');

  if (options.redirectToPosting !== false) {
    setTimeout(() => {
      if (typeof showTab === 'function') showTab('settings');
    }, 0);
  }
}

export function openLicenseModalFromFreeTrialUpgrade() {
  closeFreeTrialUpgradeModal({ redirectToPosting: true });

  setTimeout(() => {
    const purchaseUrl = 'https://leaderspro.kr';
    try {
      if (window.blogger && typeof window.blogger.openExternal === 'function') {
        window.blogger.openExternal(purchaseUrl);
      } else if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
        window.electronAPI.openExternal(purchaseUrl);
      } else if (window.electronAPI && typeof window.electronAPI.openLink === 'function') {
        window.electronAPI.openLink(purchaseUrl);
      } else {
        window.open(purchaseUrl, '_blank');
      }
    } catch {
      window.open(purchaseUrl, '_blank');
    }
  }, 80);
}

export function showFreeTrialUpgradeModal(featureName = '프리미엄 기능') {
  ensureFreeTrialUpgradeStyles();

  let overlay = document.getElementById('freeTrialUpgradeOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'freeTrialUpgradeOverlay';
    document.body.appendChild(overlay);
  }

  const label = getFreeTrialFeatureLabel(featureName);
  overlay.innerHTML = `
    <div class="free-trial-upgrade-modal" role="dialog" aria-modal="true" aria-labelledby="freeTrialUpgradeTitle">
      <div class="free-trial-upgrade-inner">
        <div class="free-trial-upgrade-badge">무료체험 제한 기능</div>
        <h2 class="free-trial-upgrade-title" id="freeTrialUpgradeTitle">${sanitizeHTML(label)}은 유료 플랜에서 사용할 수 있습니다.</h2>
        <p class="free-trial-upgrade-copy">
          무료체험에서는 메인 화면과 글포스팅만 열어둘 수 있습니다. 썸네일, 이미지 생성, 거미줄포스팅, 외부유입 글 생성 등 자동화 기능은 유료 플랜에서 잠금 해제됩니다.
        </p>
        <ul class="free-trial-upgrade-list">
          <li>글포스팅 외 자동화 탭 잠금</li>
          <li>유료 전환 후 전체 기능 즉시 사용</li>
          <li>구매 또는 취소 후 글포스팅 화면으로 자동 이동</li>
        </ul>
        <div class="free-trial-upgrade-actions">
          <button type="button" class="free-trial-upgrade-buy" onclick="window.openLicenseModalFromFreeTrialUpgrade?.()">구매하러 가기</button>
          <button type="button" class="free-trial-upgrade-cancel" onclick="window.closeFreeTrialUpgradeModal?.()">취소하고 글포스팅으로</button>
        </div>
      </div>
    </div>
  `;

  document.body.classList.add('free-trial-upgrade-open');
  overlay.classList.add('is-open');
}

export function blockFreeTrialFeatureAccess(featureName, options = {}) {
  if (!isFreeTrialMode()) return false;
  showFreeTrialUpgradeModal(featureName);

  if (options.redirectToPosting !== false) {
    setTimeout(() => {
      try {
        if (getAppState().currentTab !== 'settings') showTab('settings');
      } catch {
        showTab('settings');
      }
    }, 0);
  }

  return true;
}

export function applyFreeTrialAccessGate() {
  if (!isFreeTrialMode()) return;
  try {
    const currentTab = getAppState().currentTab;
    if (currentTab && !FREE_TRIAL_ALLOWED_TABS.has(currentTab)) {
      showTab('settings');
    }
  } catch {
    // ignore
  }
}

export function showTab(tabName) {
  if (isFreeTrialMode() && !FREE_TRIAL_ALLOWED_TABS.has(tabName)) {
    showFreeTrialUpgradeModal(tabName);
    setTimeout(() => {
      try {
        if (getAppState().currentTab !== 'settings') showTab('settings');
      } catch {
        showTab('settings');
      }
    }, 0);
    return false;
  }

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

  // 모든 최상위 탭 콘텐츠 숨기기
  // 내부 설정 탭/외부유입 서브탭까지 [id$="-tab"]로 같이 숨기면 레이아웃이 깨질 수 있다.
  const allTabs = getTopLevelTabElements();
  allTabs.forEach(tab => {
    tab.style.display = 'none';
    tab.classList.remove('active');
    tab.hidden = true;
    tab.setAttribute('aria-hidden', 'true');
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
    case 'external-traffic':
      // v3.7.23: 외부유입 글 생성 신규 탭
      targetTab = document.getElementById('external-traffic-tab');
      try {
        window.hideManualCtaUiForExternalTraffic?.();
        window.closeManualCtaModal?.();
        const manualCtaSection = document.getElementById('manualCtaSection');
        const manualCtaSettings = document.getElementById('manualCtaSettings');
        if (manualCtaSection) manualCtaSection.style.display = 'none';
        if (manualCtaSettings) manualCtaSettings.style.display = 'none';
      } catch (e) {
        console.warn('[EXT-TRAFFIC] manual CTA cleanup failed:', e);
      }
      if (targetTab && window.initExternalTrafficTab) {
        try { window.initExternalTrafficTab(); } catch (e) { console.warn('[EXT-TRAFFIC] init 실패:', e); }
      }
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
    case 'image-batch':
      // v3.6.4: 대량 이미지 생성 탭 (사이드바 nav-image-batch 클릭 시)
      targetTab = document.getElementById('image-batch-tab');
      if (targetTab && !targetTab.dataset.initialized) {
        targetTab.dataset.initialized = 'true';
        // 초기 비용 미리보기만 갱신한다.
        // v3.8.120: 탭 진입만으로 Dropshot 브라우저 로그인 체크를 실행하지 않는다.
        try { window.updateBatchImageCost?.(); } catch { /* ignore */ }
      }
      break;
    default:
      console.warn('⚠️ 알 수 없는 탭:', tabName);
  }

  if (targetTab) {
    targetTab.hidden = false;
    targetTab.setAttribute('aria-hidden', 'false');
    targetTab.style.display = 'block';
    targetTab.classList.add('active');
    try {
      getAppState().currentTab = tabName;
    } catch {
      // ignore
    }
    console.log('✅ 탭 표시:', tabName, targetTab.id);
  } else {
    console.error('❌ 탭을 찾을 수 없습니다:', tabName);
  }

  // v3.8.120: 상단 상태바는 모든 탭에서 고정 노출.
  // 라이선스/플랫폼/AI 모델 상태를 보려고 메인 탭으로 돌아갈 필요가 없도록 유지한다.
  const appHeader = document.querySelector('.app-header');
  if (appHeader) {
    appHeader.style.display = '';
  }

  // 사이드바 active 상태 동기화
  const tabToNavMap = {
    'main': 'nav-main',
    'thumbnail': 'nav-thumbnail',
    'settings': 'nav-auto',
    'semi-auto': 'nav-semiauto',
    'schedule': 'nav-schedule',
    'internal-links': 'nav-intlinks-page',
    'external-traffic': 'nav-external-traffic',
    'keyword-discover': 'nav-keyword-discover',
    'content': 'nav-convert',
    'adsense-tools': 'nav-adsense-tools',
    'image-batch': 'nav-image-batch', // v3.6.4
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
  // v3.5.98: 모달 닫힐 때 하단 floating bar도 함께 숨김
  const minBar = document.getElementById('minimizedProgressBar');

  if (progressBar) {
    // v3.8.101: Agent 진행 모달이 활성화된 상태면 자동으로 닫지 않음 (success 모달 뒤에서 유지)
    if (window.__agentProgressActive === true) {
      console.log('⏸️ hideProgressModal skipped — Agent 진행 모달 유지 (사용자가 닫기 클릭 시 닫힘)');
    } else {
      console.log('✅ 프리미엄 진행 바 숨기기 시작');
      progressBar.style.display = 'none';
      progressBar.style.visibility = 'hidden';
      progressBar.style.opacity = '0';
      console.log('✅ 프리미엄 진행 바 완전히 숨김');
    }
  } else {
    console.warn('⚠️ 진행 바 요소를 찾을 수 없습니다');
  }

  if (minBar) minBar.style.display = 'none';

  ButtonStateManager.restore('publishBtn');

  if (cancelBtn) {
    cancelBtn.disabled = true;
    cancelBtn.style.opacity = '0.6';
    cancelBtn.style.pointerEvents = 'none';
  }
}

// v3.5.98 — 모달 최소화 (작업은 계속 진행, UI만 하단 floating bar로 축소)
export function minimizeProgressModal() {
  console.log('🟡 minimizeProgressModal 호출됨');
  const progressBar = document.getElementById('premiumProgressBar');
  const minBar = document.getElementById('minimizedProgressBar');
  if (progressBar) {
    progressBar.style.display = 'none';
  }
  if (minBar) {
    minBar.style.display = 'block';
    // 현재 진행률 즉시 sync
    syncMinimizedProgress();
  }
}

// v3.5.98 — 최소화된 bar 클릭 시 모달 복원
export function restoreProgressModal() {
  console.log('🔵 restoreProgressModal 호출됨');
  const progressBar = document.getElementById('premiumProgressBar');
  const minBar = document.getElementById('minimizedProgressBar');
  if (minBar) minBar.style.display = 'none';
  if (progressBar) {
    progressBar.style.display = 'flex';
    progressBar.style.visibility = 'visible';
    progressBar.style.opacity = '1';
  }
}

// v3.5.98 — 모달의 진행률을 하단 bar로 sync (updateProgress 시 자동 호출)
export function syncMinimizedProgress() {
  const minBar = document.getElementById('minimizedProgressBar');
  if (!minBar || minBar.style.display === 'none') return;

  // 모달의 진행률 정보를 그대로 읽어와 sync
  const pct = parseInt(document.getElementById('progressPercentage')?.textContent || '0', 10);
  const label = document.getElementById('progressLabel')?.textContent
    || document.getElementById('progressStatus')?.textContent
    || '진행 중...';
  // 제목 (현재 단계)
  const titleEl = document.getElementById('progressStageTitle')
    || document.getElementById('progressStatus');
  const titleText = titleEl?.textContent?.substring(0, 50) || '작업 진행 중';

  const fill = document.getElementById('minimizedProgressFill');
  const pctEl = document.getElementById('minimizedProgressPct');
  const labelEl = document.getElementById('minimizedProgressLabel');
  const titleElMin = document.getElementById('minimizedProgressTitle');

  if (fill) fill.style.width = `${pct}%`;
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (labelEl) labelEl.textContent = label.substring(0, 60);
  if (titleElMin) titleElMin.textContent = titleText;
}

// v3.5.98 — cancel-task IPC 전송 (모달의 🛑 버튼이 호출)
export function cancelRunningTask() {
  const confirmed = confirm('진행 중인 작업을 중지하시겠습니까?\n생성 중인 글은 저장되지 않습니다.');
  if (!confirmed) return;

  try {
    if (window.electronAPI?.cancelTask) {
      window.electronAPI.cancelTask();
      console.log('[PROGRESS_MODAL] 🛑 cancel-task IPC 전송됨');
    } else if (window.blogger?.cancelTask) {
      window.blogger.cancelTask();
    }
  } catch (e) {
    console.error('[PROGRESS_MODAL] cancel IPC 오류:', e);
  }

  // 모달 + 하단 bar 모두 종료
  hideProgressModal();
  setTimeout(() => { try { alert('🛑 작업 중지 요청을 보냈습니다.'); } catch {} }, 200);
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
    try {
      if (typeof window.ensureAgentModeSettingsReady === 'function') {
        await window.ensureAgentModeSettingsReady();
      }
    } catch (error) {
      console.error('❌ 에이전트 모드 설정 UI 준비 실패:', error);
    }
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
window.isFreeTrialMode = isFreeTrialMode;
window.showFreeTrialUpgradeModal = showFreeTrialUpgradeModal;
window.closeFreeTrialUpgradeModal = closeFreeTrialUpgradeModal;
window.openLicenseModalFromFreeTrialUpgrade = openLicenseModalFromFreeTrialUpgrade;
window.blockFreeTrialFeatureAccess = blockFreeTrialFeatureAccess;
window.applyFreeTrialAccessGate = applyFreeTrialAccessGate;
window.addEventListener('license-access-updated', () => applyFreeTrialAccessGate());
setTimeout(() => applyFreeTrialAccessGate(), 600);
if (!window.showProgressModal) window.showProgressModal = showProgressModal;
if (!window.createFallbackProgressModal) window.createFallbackProgressModal = createFallbackProgressModal;
if (!window.hideProgressModal) window.hideProgressModal = hideProgressModal;
if (!window.cancelProgress) window.cancelProgress = cancelProgress;
// v3.5.98 — 최소화/복원/중지 함수 전역 노출
if (!window.minimizeProgressModal) window.minimizeProgressModal = minimizeProgressModal;
if (!window.restoreProgressModal) window.restoreProgressModal = restoreProgressModal;
if (!window.cancelRunningTask) window.cancelRunningTask = cancelRunningTask;
if (!window.syncMinimizedProgress) window.syncMinimizedProgress = syncMinimizedProgress;
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
    const tistoryEl = document.getElementById('platform-tistory');
    if (bloggerEl?.checked) selectedPlatform = 'blogger';
    else if (tistoryEl?.checked) selectedPlatform = 'tistory';
    else if (wpEl?.checked) selectedPlatform = 'wordpress';
    else selectedPlatform = 'wordpress'; // 최종 기본값
  }
  const bloggerOAuthBtn = document.getElementById('bloggerOAuthBtn');
  const wordpressSettings = document.getElementById('wordpressSettings');
  const bloggerSettings = document.getElementById('bloggerSettings');
  const tistorySettings = document.getElementById('tistorySettings') || document.getElementById('tistory-fields');

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

  if (tistorySettings) {
    if (selectedPlatform === 'tistory') {
      tistorySettings.style.display = 'block';
      console.log('티스토리 설정: 표시');
    } else {
      tistorySettings.style.display = 'none';
      console.log('티스토리 설정: 숨김');
    }
  }
}
