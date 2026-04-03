// 🔧 메인 모듈 - 모든 모듈 통합 및 초기화

import { DOMCache, getAppState, getStorageManager, ButtonStateManager, getProgressManager, addLog, debugLog } from './core.js';
import { showTab, openSettingsModal, closeSettingsModal, showProgressModal, hideProgressModal, setRunning, cancelProgress, startAutoBackup, openPexelsApiPage, openDalleApiPage, openNaverApiPage, openGoogleOAuthPage, openGoogleTrends, openGeminiApiPage, openGoogleCseApiPage, openKeywordMasterModal, closeKeywordMasterModal, openKeywordMaster, togglePlatformFields, showNotification } from './ui.js';
import { openExternalLinksModal, closeExternalLinksModal } from './external-links.js';
import { showGuide, closeGuide } from './guide.js';
import './semi-auto.js'; // 반자동 이미지 관리 모듈
import './internal-links.js'; // 내부링크 관리 모듈
import { runPosting, publishToPlatform, createPayload, createPayloadFromForm, createPreviewPayload } from './posting.js';
import { generatePreview, displayPreviewInModal, showPreviewModal, closePreviewModal } from './preview.js';
import { loadSettings, saveSettings, loadSettingsContent, updateApiKeyStatus, updatePlatformStatus, loadLicenseInfo, isLicenseValid, checkPlatformConnection, checkCseConnection, startBloggerOAuth, closeBloggerAuthCodeModal } from './settings.js';
import { updateKeywordCount, addKeyword, removeKeyword, getAllKeywords, getH2ImageSections, updateRealtimeClock, updateRealtimeDate, initializeProgressSteps, resetProgressSteps, updateProgressStep, onCalendarDateClick, toggleCalendarMemoComplete } from './utils.js';
import { onLog, onProgress } from './api.js';
import { renderCalendar, showWorkDiary, saveWorkRecord, getWorkRecords, formatDateKey, toggleWorkRecordCompletion, deleteWorkRecord, addTodayWorkRecord, addQuickWorkRecord, addWorkRecordTemplate, saveWorkRecordFromModal, addScheduleFromModal, editScheduleFromModal, cancelScheduleEdit, saveScheduleEdit, initWorkDiary } from './calendar.js';
import { downloadExcelTemplate, runExcelBatch, downloadExcelResults, clearExcelResults } from './excel.js';
import { generateTextThumbnail, generateTextThumbnailWithBackground, downloadThumbnail, applyPreset, updateThumbnailPreview } from './thumbnail.js';
import { initTutorialModule } from './tutorial.js';
import { initSidebar } from './sidebar.js';
import { initKeywordDiscover } from './keyword-discover.js';
import { initContentStubs } from './content-stubs.js';
import './adsense-tools.js'; // 애드센스 도구 탭 모듈 (window.__initAdsenseTools 등록)
import { renderOneclickSetupTab, initOneclickSetup } from './oneclick-setup.js'; // 🚀 원클릭 세팅 모듈
import { initFirstRunWizard } from './first-run-wizard.js';

// 🔐 세션 만료 모달 (중복 로그인 방지)
function showSessionExpiredModal(reason) {
  // 기존 모달 제거
  const existingModal = document.getElementById('sessionExpiredModal');
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'sessionExpiredModal';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.9); display: flex; align-items: center; justify-content: center; z-index: 999999; backdrop-filter: blur(10px);';

  modal.innerHTML = `
    <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 24px; padding: 48px; max-width: 500px; width: 90%; text-align: center; box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5); border: 2px solid rgba(239, 68, 68, 0.3);">
      <div style="font-size: 64px; margin-bottom: 24px;">⚠️</div>
      <h2 style="color: #fca5a5; font-size: 24px; font-weight: 700; margin-bottom: 16px;">
        세션이 종료되었습니다
      </h2>
      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
        ${reason || '다른 기기에서 로그인되어 현재 세션이 종료되었습니다.'}
      </p>
      <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 12px; padding: 16px; margin-bottom: 32px;">
        <p style="color: #fca5a5; font-size: 14px; margin: 0;">
          🔒 하나의 계정으로 동시에 여러 기기에서 사용할 수 없습니다.<br>
          다시 로그인하면 다른 기기의 세션이 종료됩니다.
        </p>
      </div>
      <button id="sessionExpiredLoginBtn" style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; padding: 16px 48px; font-size: 16px; font-weight: 600; border-radius: 12px; cursor: pointer; transition: all 0.3s ease;">
        다시 로그인
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  // 로그인 버튼 클릭 이벤트
  document.getElementById('sessionExpiredLoginBtn').addEventListener('click', async () => {
    try {
      // 로그아웃 처리
      if (window.electronAPI && typeof window.electronAPI.invoke === 'function') {
        await window.electronAPI.invoke('license-logout');
      }
      // 앱 재시작 또는 로그인 화면으로 이동
      window.location.reload();
    } catch (error) {
      console.error('[SESSION] 로그아웃 오류:', error);
      window.location.reload();
    }
  });
}

// 전역 함수로 노출
window.showSessionExpiredModal = showSessionExpiredModal;

// 내부링크 관리 모달 함수 정의 (fallback)
function openInternalLinksManagerModalFallback() {
  console.log('[INTERNAL-LINKS] 버튼 클릭됨 - 내부링크 탭으로 전환');

  // 탭 전환 함수가 있으면 사용
  if (typeof showTab === 'function') {
    showTab('internal-links');
  } else {
    // showTab 함수가 없으면 직접 탭 표시
    const allTabs = document.querySelectorAll('.tab-content, [id$="-tab"]');
    allTabs.forEach(tab => {
      tab.style.display = 'none';
    });

    const internalLinksTab = document.getElementById('internal-links-tab');
    if (internalLinksTab) {
      internalLinksTab.style.display = 'block';

      // 탭 버튼 활성화
      const tabButtons = document.querySelectorAll('.tab-btn');
      tabButtons.forEach(btn => btn.classList.remove('active'));

      const internalLinksBtn = Array.from(tabButtons).find(btn =>
        btn.getAttribute('onclick')?.includes("'internal-links'")
      );
      if (internalLinksBtn) {
        internalLinksBtn.classList.add('active');
      }

      console.log('[INTERNAL-LINKS] ✅ 내부링크 탭 열기 성공');
    } else {
      console.error('[INTERNAL-LINKS] ❌ 내부링크 탭을 찾을 수 없습니다');
      alert('❌ 내부링크 관리 탭을 찾을 수 없습니다. 앱을 재시작해주세요.');
    }
  }
}

// 🔥 워드프레스 관련 함수들 즉시 정의
window.showWordPressAppPasswordGuide = function () {
  console.log('[WP 가이드] 함수 호출됨');
  const modal = document.createElement('div');
  modal.id = 'wpAppPasswordGuideModal';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.85); display: flex; align-items: center; justify-content: center; z-index: 100000; backdrop-filter: blur(10px);';

  modal.innerHTML = `
    <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 24px; padding: 40px; max-width: 700px; width: 90%; max-height: 85vh; overflow-y: auto; box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5); border: 2px solid rgba(255, 255, 255, 0.1);">
      <h2 style="color: #fff; font-size: 26px; font-weight: 700; margin-bottom: 24px; text-align: center;">
        🔐 워드프레스 애플리케이션 비밀번호 발급 가이드
      </h2>
      
      <div style="background: rgba(239, 68, 68, 0.15); border: 2px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #fca5a5; font-size: 14px; margin: 0; font-weight: 600;">
          ⚠️ <strong>중요!</strong> 일반 계정 비밀번호로는 워드프레스 REST API에 연결할 수 없습니다.<br>
          반드시 <strong>애플리케이션 비밀번호</strong>를 발급받아 사용해야 합니다.
        </p>
      </div>

      <div style="color: #e2e8f0; font-size: 15px; line-height: 1.8;">
        <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
          <h3 style="color: #10b981; font-size: 18px; margin-bottom: 12px;">📍 Step 1. 워드프레스 관리자 로그인</h3>
          <p style="margin: 0; color: #94a3b8;">
            <code style="background: rgba(16, 185, 129, 0.2); padding: 4px 8px; border-radius: 4px; color: #10b981;">https://내사이트.com/wp-admin/</code> 에 접속하여 관리자 계정으로 로그인합니다.
          </p>
        </div>

        <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
          <h3 style="color: #3b82f6; font-size: 18px; margin-bottom: 12px;">📍 Step 2. 프로필 페이지 이동</h3>
          <p style="margin: 0; color: #94a3b8;">
            좌측 메뉴에서 <strong style="color: #3b82f6;">사용자</strong> → <strong style="color: #3b82f6;">프로필</strong> 클릭<br>
            또는 우측 상단 프로필 아이콘 클릭 → <strong style="color: #3b82f6;">프로필 편집</strong>
          </p>
        </div>

        <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
          <h3 style="color: #f59e0b; font-size: 18px; margin-bottom: 12px;">📍 Step 3. 애플리케이션 비밀번호 생성</h3>
          <p style="margin: 0; color: #94a3b8;">
            프로필 페이지 하단에서 <strong style="color: #f59e0b;">"애플리케이션 비밀번호"</strong> 섹션을 찾습니다.<br>
            "새 애플리케이션 비밀번호 이름"에 <strong style="color: #f59e0b;">blogger-gpt</strong> 입력 후 <strong style="color: #f59e0b;">"새 애플리케이션 비밀번호 추가"</strong> 버튼 클릭
          </p>
        </div>

        <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
          <h3 style="color: #8b5cf6; font-size: 18px; margin-bottom: 12px;">📍 Step 4. 비밀번호 복사</h3>
          <p style="margin: 0; color: #94a3b8;">
            생성된 비밀번호 (예: <code style="background: rgba(139, 92, 246, 0.2); padding: 4px 8px; border-radius: 4px; color: #8b5cf6;">l3rq pnAO QTfU 8RjE mwVc j9kQ</code>)를<br>
            <strong style="color: #8b5cf6;">공백 포함 그대로</strong> 복사하여 이 앱의 Application Password 필드에 붙여넣기
          </p>
        </div>

        <div style="background: rgba(16, 185, 129, 0.15); border: 2px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 16px; margin-top: 24px;">
          <p style="color: #6ee7b7; font-size: 14px; margin: 0; font-weight: 600;">
            💡 <strong>팁:</strong> 애플리케이션 비밀번호는 한 번만 표시되므로, 반드시 안전한 곳에 저장해두세요!
          </p>
        </div>
      </div>

      <button onclick="document.getElementById('wpAppPasswordGuideModal').remove();" style="display: block; width: 100%; margin-top: 24px; padding: 16px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; transition: all 0.3s ease;">
        ✅ 확인
      </button>
    </div>
  `;

  document.body.appendChild(modal);
  console.log('[WP 가이드] 모달 표시됨');
};

window.loadWpCategories = async function () {
  console.log('[WP 카테고리] 로드 함수 호출됨');

  const wpUrlElement = document.getElementById('wordpressSiteUrl');
  const wpUsernameElement = document.getElementById('wordpressUsername');
  const wpPasswordElement = document.getElementById('wordpressPassword');

  if (!wpUrlElement || !wpUsernameElement || !wpPasswordElement) {
    alert('워드프레스 연결 정보 입력 필드를 찾을 수 없습니다. 환경 설정 모달이 열려 있는지 확인하세요.');
    return;
  }

  const wpUrl = wpUrlElement.value?.trim();
  const wpUsername = wpUsernameElement.value?.trim();
  const wpPassword = wpPasswordElement.value?.trim();

  console.log('[WP 카테고리] 연결 정보:', { wpUrl, wpUsername, hasPassword: !!wpPassword });

  if (!wpUrl || !wpUsername || !wpPassword) {
    alert('워드프레스 URL, 사용자명, 애플리케이션 비밀번호를 모두 입력해주세요.');
    return;
  }

  try {
    const categorySelect = document.getElementById('wpCategory');
    if (categorySelect) {
      categorySelect.innerHTML = '<option value="">카테고리 로딩 중...</option>';
    }

    console.log('[WP 카테고리] API 호출 시작...');
    const result = await window.electronAPI.loadWpCategories({ wpUrl, wpUsername, wpPassword });
    console.log('[WP 카테고리] API 응답:', result);

    if (result.ok && result.categories) {
      if (categorySelect) {
        categorySelect.innerHTML = '<option value="">카테고리 선택</option>';
        result.categories.forEach(cat => {
          const option = document.createElement('option');
          option.value = cat.id;
          option.textContent = cat.name;
          categorySelect.appendChild(option);
        });
      }
      alert(`✅ ${result.categories.length}개의 카테고리를 불러왔습니다.`);
    } else {
      alert('카테고리 로드 실패: ' + (result.error || '알 수 없는 오류'));
      if (categorySelect) {
        categorySelect.innerHTML = '<option value="">카테고리를 먼저 로드하세요</option>';
      }
    }
  } catch (error) {
    console.error('[WP 카테고리] 오류:', error);
    alert('카테고리 로드 중 오류 발생: ' + error.message);
  }
};

window.loadWordPressCategories = window.loadWpCategories;
console.log('[MAIN] 워드프레스 함수 즉시 정의 완료');

// 전역 함수로 export (HTML에서 호출 가능하도록)
// 모듈이 로드되자마자 즉시 전역 함수 등록 (onclick 핸들러가 실행되기 전에)
(function registerGlobalFunctions() {
  // UI 함수들
  window.showTab = showTab;
  window.openSettingsModal = openSettingsModal;
  window.closeSettingsModal = closeSettingsModal;
  window.openExternalLinksModal = openExternalLinksModal;
  window.closeExternalLinksModal = closeExternalLinksModal;
  window.openPexelsApiPage = openPexelsApiPage;
  window.openDalleApiPage = openDalleApiPage;
  window.openNaverApiPage = openNaverApiPage;
  window.openGoogleOAuthPage = openGoogleOAuthPage;
  window.openGoogleTrends = openGoogleTrends;
  window.openGeminiApiPage = openGeminiApiPage;
  window.openGoogleCseApiPage = openGoogleCseApiPage;
  window.openKeywordMasterModal = openKeywordMasterModal;
  window.closeKeywordMasterModal = closeKeywordMasterModal;
  window.openKeywordMaster = openKeywordMaster;
  window.showProgressModal = showProgressModal;
  window.togglePlatformFields = togglePlatformFields;
  window.hideProgressModal = hideProgressModal;
  window.showNotification = showNotification;
  window.setRunning = setRunning;
  window.cancelProgress = cancelProgress;

  // 포스팅 함수들
  window.runPosting = runPosting;
  window.publishToPlatform = publishToPlatform;
  window.createPayload = createPayload;
  window.createPayloadFromForm = createPayloadFromForm;
  window.createPreviewPayload = createPreviewPayload;

  // 미리보기 함수들
  window.generatePreview = generatePreview;
  window.displayPreviewInModal = displayPreviewInModal;
  window.showPreviewModal = showPreviewModal;
  window.closePreviewModal = closePreviewModal;

  // 설정 함수들
  window.loadSettings = loadSettings;
  window.saveSettings = saveSettings;
  window.loadSettingsContent = loadSettingsContent;
  window.updateApiKeyStatus = updateApiKeyStatus;
  window.updatePlatformStatus = updatePlatformStatus;
  window.loadLicenseInfo = loadLicenseInfo;
  window.isLicenseValid = isLicenseValid;
  window.checkPlatformConnection = checkPlatformConnection;
  window.checkCseConnection = checkCseConnection;
  window.startBloggerOAuth = startBloggerOAuth;
  window.closeBloggerAuthCodeModal = closeBloggerAuthCodeModal;

  // 유틸리티 함수들
  window.updateKeywordCount = updateKeywordCount;
  window.addKeyword = addKeyword;
  window.removeKeyword = removeKeyword;
  window.getAllKeywords = getAllKeywords;
  window.getH2ImageSections = getH2ImageSections;
  window.updateRealtimeClock = updateRealtimeClock;
  window.updateRealtimeDate = updateRealtimeDate;
  window.initializeProgressSteps = initializeProgressSteps;
  window.resetProgressSteps = resetProgressSteps;
  window.updateProgressStep = updateProgressStep;
  window.onCalendarDateClick = onCalendarDateClick;
  window.toggleCalendarMemoComplete = toggleCalendarMemoComplete;

  // 캘린더 함수들
  window.renderCalendar = renderCalendar;
  window.showWorkDiary = showWorkDiary;
  window.saveWorkRecord = saveWorkRecord;
  window.getWorkRecords = getWorkRecords;
  window.formatDateKey = formatDateKey;
  window.toggleWorkRecordCompletion = toggleWorkRecordCompletion;
  window.deleteWorkRecord = deleteWorkRecord;
  window.addTodayWorkRecord = addTodayWorkRecord;
  window.addQuickWorkRecord = addQuickWorkRecord;
  window.addWorkRecordTemplate = addWorkRecordTemplate;
  window.saveWorkRecordFromModal = saveWorkRecordFromModal;
  window.addScheduleFromModal = addScheduleFromModal;
  window.editScheduleFromModal = editScheduleFromModal;
  window.cancelScheduleEdit = cancelScheduleEdit;
  window.saveScheduleEdit = saveScheduleEdit;

  // 엑셀 함수들
  window.downloadExcelTemplate = downloadExcelTemplate;
  window.runExcelBatch = runExcelBatch;
  window.downloadExcelResults = downloadExcelResults;
  window.clearExcelResults = clearExcelResults;

  // 썸네일 함수들
  window.generateTextThumbnail = generateTextThumbnail;
  window.generateThumbnailWithBackground = generateTextThumbnailWithBackground;
  window.downloadThumbnail = downloadThumbnail;
  window.applyPreset = applyPreset;
  window.updateThumbnailPreview = updateThumbnailPreview;

  // 내부링크 관리 모달 함수 (이미 정의되어 있지 않으면 fallback 사용)
  if (typeof window.openInternalLinksManagerModal !== 'function') {
    window.openInternalLinksManagerModal = openInternalLinksManagerModalFallback;
    console.log('[MAIN] ✅ openInternalLinksManagerModal fallback 등록');
  }

  // 전역 함수 등록 확인 로그
  console.log('✅ [MAIN] 전역 함수 등록 완료:', {
    showTab: typeof window.showTab === 'function',
    openKeywordMaster: typeof window.openKeywordMaster === 'function',
    openKeywordMasterModal: typeof window.openKeywordMasterModal === 'function',
    closeKeywordMasterModal: typeof window.closeKeywordMasterModal === 'function',
    runPosting: typeof window.runPosting === 'function',
    openSettingsModal: typeof window.openSettingsModal === 'function',
    openExternalLinksModal: typeof window.openExternalLinksModal === 'function',
    openInternalLinksManagerModal: typeof window.openInternalLinksManagerModal === 'function',
    downloadExcelTemplate: typeof window.downloadExcelTemplate === 'function',
    runExcelBatch: typeof window.runExcelBatch === 'function',
    generateTextThumbnail: typeof window.generateTextThumbnail === 'function'
  });
})();

// 모듈 로딩 확인
console.log('✅ [MAIN] 모듈 로딩 확인:', {
  DOMCache: typeof DOMCache !== 'undefined',
  getAppState: typeof getAppState !== 'undefined',
  ButtonStateManager: typeof ButtonStateManager !== 'undefined',
  getProgressManager: typeof getProgressManager !== 'undefined',
  addLog: typeof addLog !== 'undefined',
  debugLog: typeof debugLog !== 'undefined'
});

// 초기화 완료 플래그
let isInitialized = false;

// 애플리케이션 초기화 함수
async function initializeApp() {
  // 이미 초기화되었으면 중복 실행 방지
  if (isInitialized) {
    console.log('⚠️ [MAIN] 이미 초기화되었습니다. 중복 실행 방지');
    return;
  }

  console.log('✅ [MAIN] 애플리케이션 초기화 시작');
  debugLog('MAIN', '애플리케이션 초기화 시작');

  try {
    // 1. DOMCache 초기화
    DOMCache.init();
    debugLog('MAIN', 'DOMCache 초기화 완료');

    // 2. AppState 초기화 (이미 싱글톤으로 생성됨)
    const appState = getAppState();
    debugLog('MAIN', 'AppState 초기화 완료');

    // 3. ButtonStateManager 초기화
    ButtonStateManager.init();
    debugLog('MAIN', 'ButtonStateManager 초기화 완료');

    // 4. ProgressManager 초기화
    const progressManager = getProgressManager();
    progressManager.init();
    debugLog('MAIN', 'ProgressManager 초기화 완료');

    // 5. 작업 일기 초기화
    initWorkDiary();
    debugLog('MAIN', '작업 일기 초기화 완료');

    // 5.5. 튜토리얼 모듈 초기화 (관리자 모드: Shift+X+C)
    initTutorialModule();
    debugLog('MAIN', '튜토리얼 모듈 초기화 완료');

    // 5.6. 사이드바 초기화
    initSidebar();
    debugLog('MAIN', '사이드바 초기화 완료');

    // 5.7. 황금키워드 탐색기 초기화
    initKeywordDiscover();
    debugLog('MAIN', '황금키워드 탐색기 초기화 완료');

    // 5.8. 콘텐츠변환 stub 함수 등록
    initContentStubs();
    debugLog('MAIN', '콘텐츠변환 stub 등록 완료');

    // 5.9. 원클릭 세팅 초기화
    initOneclickSetup();
    // 원클릭 세팅 탭 콘텐츠 렌더링
    const oneclickContainer = document.getElementById('oneclick-setup-container');
    if (oneclickContainer) {
      oneclickContainer.innerHTML = renderOneclickSetupTab();
    }
    debugLog('MAIN', '원클릭 세팅 모듈 초기화 완료');

    // 5.10. 첫 실행 마법사 초기화 (3분 세팅)
    try { initFirstRunWizard(); } catch (e) { console.warn('[WIZARD] 초기화 실패:', e); }

    // 6. 설정 로드
    const settings = await loadSettings();
    debugLog('MAIN', '설정 로드 완료', { platform: settings.platform });

    // 7. 플랫폼 상태 업데이트
    updatePlatformStatus();

    // 8. 플랫폼 필드 토글 (초기 상태 설정)
    if (typeof togglePlatformFields === 'function') {
      togglePlatformFields();
      debugLog('MAIN', 'togglePlatformFields 호출 완료');
    }

    // 9. API 키 상태 업데이트
    updateApiKeyStatus(settings);

    // 10. 라이선스 정보 로드
    await loadLicenseInfo();

    // 11. 실시간 시계 및 날짜 초기화
    updateRealtimeClock();
    updateRealtimeDate();
    setInterval(updateRealtimeClock, 1000);

    // 12. 달력 렌더링
    renderCalendar();

    // 13. 자동 백업 시스템 시작
    startAutoBackup();

    // 14. 백엔드 로그 리스너 등록
    onLog((line) => {
      const currentProgress = progressManager.overallProgress || 0;
      if (line.includes('[PROGRESS]') || line.includes('진행률') || line.includes('%')) {
        addLog(line, 'progress');
      } else {
        const enhancedLine = `[${currentProgress}%] ${line}`;
        addLog(enhancedLine);
      }
    });

    // 14. 백엔드 진행 상황 리스너 등록
    onProgress((data) => {
      const { p, label } = data;
      console.log(`[PROGRESS] ${p}% - ${label || ''}`);

      const actualProgress = Math.min(100, Math.max(0, p));
      progressManager.updateProgress(actualProgress, actualProgress, label || '');
    });

    debugLog('MAIN', '애플리케이션 초기화 완료');
    addLog('✅ 애플리케이션이 준비되었습니다.', 'success');

    // 15. 세션 만료 이벤트 리스너 (중복 로그인 방지)
    if (window.blogger && typeof window.blogger.onSessionExpired === 'function') {
      window.blogger.onSessionExpired((data) => {
        console.log('[SESSION] ⚠️ 세션 만료 감지:', data.reason);

        // 모달 표시
        showSessionExpiredModal(data.reason);
      });
      debugLog('MAIN', '세션 만료 이벤트 리스너 등록됨');
    }

    // 초기화 완료 플래그 설정
    isInitialized = true;

  } catch (error) {
    console.error('❌ 애플리케이션 초기화 실패:', error);
    console.error('❌ 에러 상세:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      error: error
    });
    if (typeof addLog !== 'undefined') {
      addLog('❌ 애플리케이션 초기화 중 오류가 발생했습니다: ' + (error?.message || String(error)), 'error');
    } else {
      console.error('❌ addLog 함수를 사용할 수 없습니다.');
    }
  }
}

// 초기화 실행 함수 (여러 방법으로 시도)
function tryInitialize() {
  console.log('🔍 [MAIN] 초기화 시도 - readyState:', document.readyState);

  // DOM 요소가 준비되었는지 확인
  const testElement = document.getElementById('realtime-clock') || document.body;
  if (!testElement) {
    console.warn('⚠️ [MAIN] DOM 요소가 아직 준비되지 않음, 200ms 후 재시도');
    setTimeout(tryInitialize, 200);
    return;
  }

  console.log('✅ [MAIN] DOM 준비 확인됨, 초기화 실행');
  initializeApp();
}

// DOMContentLoaded 이벤트 리스너 (타이밍 문제 해결)
// 모듈이 로드될 때 이미 DOMContentLoaded가 발생했을 수 있으므로 체크
console.log('🔍 [MAIN] DOM readyState 확인:', document.readyState);

// 여러 방법으로 초기화 시도
if (document.readyState === 'loading') {
  // DOM이 아직 로딩 중이면 이벤트 리스너 등록
  document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ [MAIN] DOMContentLoaded 이벤트 발생 - 초기화 시작');
    tryInitialize();
  });
  console.log('✅ [MAIN] DOMContentLoaded 이벤트 리스너 등록됨 (readyState: loading)');
} else {
  // DOM이 이미 로드되었으면 즉시 실행
  console.log('✅ [MAIN] DOM이 이미 로드됨 (readyState: ' + document.readyState + ')');

  // 즉시 시도
  tryInitialize();

  // 추가 보험: 약간의 지연 후에도 시도 (초기화가 안 된 경우만)
  setTimeout(() => {
    if (!isInitialized) {
      console.log('🔄 [MAIN] 지연 후 재시도 (보험)');
      tryInitialize();
    }
  }, 500);

  // 최종 보험: 1초 후에도 시도 (초기화가 안 된 경우만)
  setTimeout(() => {
    if (!isInitialized) {
      console.log('🔄 [MAIN] 최종 재시도 (1초 후)');
      tryInitialize();
    }
  }, 1000);
}

// ============================================================================
// 콘솔 무한 재귀 방지 시스템
// ============================================================================
// console 오버라이드로 인한 무한 재귀를 방지합니다.
(function preventConsoleRecursion() {
  // 원본 console 메서드들을 안전하게 보관
  const originalConsole = {
    log: console.log.bind(console),
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console)
  };

  // console이 오버라이드되었는지 확인하고 복원
  if (console.error.toString().includes('console.error')) {
    console.log('⚠️ [MAIN] console.error 무한 재귀 감지, 원본으로 복원');
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
  }

  // 전역 window 객체에 원본 console 백업
  window.__originalConsole = originalConsole;

  console.log('✅ [MAIN] 콘솔 무한 재귀 방지 시스템 초기화 완료');
})();

// ============================================================================
// 오류 캡처 시스템 제거 - 브라우저 기본 동작만 사용
// ============================================================================
// 전역 에러 핸들러를 제거하여 무한 재귀 문제를 완전히 해결합니다.
// 브라우저가 기본적으로 모든 오류를 개발자 콘솔에 표시하므로 별도 처리가 불필요합니다.

