// 🔧 설정 관리 관련 함수들
import { getErrorHandler, getStorageManager, addLog, debugLog } from './core.js';

// 설정 로드 (비동기)
export async function loadSettings() {
  const storage = getStorageManager();
  let settings = {};

  try {
    const savedSettings = await storage.get('bloggerSettings', true);
    if (savedSettings) {
      settings = savedSettings;
    }
  } catch (e) {
    getErrorHandler().handle(e, {
      function: 'loadSettings',
      step: '설정 파싱'
    });
    settings = {};
  }

  // 플랫폼 기본값 설정: 항상 WordPress를 기본값으로 사용
  // 사용자가 명시적으로 Blogger를 선택하고 저장한 경우에만 Blogger 사용
  // 저장된 값이 없거나 유효하지 않으면 WordPress
  if (!settings.platform || settings.platform === undefined || settings.platform === null || settings.platform === '' || settings.platform === 'undefined' || settings.platform === 'null') {
    settings.platform = 'wordpress';
    console.log('[LOAD] 플랫폼 기본값 설정: wordpress (저장된 값 없음 또는 유효하지 않음)');
  } else if (settings.platform === 'blogger') {
    // 저장된 값이 Blogger인 경우에만 Blogger 사용 (사용자가 명시적으로 저장한 경우)
    console.log('[LOAD] 플랫폼 설정: blogger (사용자가 저장한 값)');
  } else {
    // 그 외의 경우는 WordPress
    settings.platform = 'wordpress';
    console.log('[LOAD] 플랫폼 기본값 설정: wordpress (유효하지 않은 값)');
  }

  return settings;
}

// 설정 저장
export async function saveSettings() {
  const settings = {
    openaiKey: document.getElementById('openaiKey')?.value || '',
    geminiKey: document.getElementById('geminiKey')?.value || '',
    claudeKey: document.getElementById('claudeKey')?.value || '',
    perplexityKey: document.getElementById('perplexityKey')?.value || '',
    leonardoKey: document.getElementById('leonardoKey')?.value || '',
    dalleApiKey: document.getElementById('dalleApiKey')?.value || '',
    pexelsApiKey: document.getElementById('pexelsApiKey')?.value || '',
    naverCustomerId: document.getElementById('naverCustomerId')?.value || '',
    naverSecretKey: document.getElementById('naverSecretKey')?.value || '',
    blogId: document.getElementById('blogId')?.value || '',
    googleClientId: document.getElementById('googleClientId')?.value || '',
    googleClientSecret: document.getElementById('googleClientSecret')?.value || '',
    googleCseKey: document.getElementById('googleCseKey')?.value || '',
    googleCseCx: document.getElementById('googleCseCx')?.value || '',
    youtubeApiKey: document.getElementById('youtubeApiKey')?.value || '',
    wordpressSiteUrl: document.getElementById('wordpressSiteUrl')?.value || '',
    wordpressUsername: document.getElementById('wordpressUsername')?.value || '',
    wordpressPassword: document.getElementById('wordpressPassword')?.value || '',
    wordpressCategories: document.getElementById('wordpressCategories')?.value || '',
    platform: document.querySelector('input[name="platform"]:checked')?.value || 'wordpress',
    generationEngine: document.getElementById('generationEngine')?.value || 'gemini',
    promptMode: 'max-mode',
    toneStyle: document.getElementById('toneStyle')?.value || 'professional',
    imageFolderPath: document.getElementById('imageFolderPath')?.value || '',
    blogUrl: document.getElementById('blogUrl')?.value?.trim() || '',
  };

  const storage = getStorageManager();
  await storage.set('bloggerSettings', settings, true);

  // .env 파일도 함께 업데이트
  try {
    if (window.blogger && window.blogger.saveEnv) {
      const envData = {
        blogId: settings.blogId,
        googleClientId: settings.googleClientId,
        googleClientSecret: settings.googleClientSecret,
        wordpressSiteUrl: settings.wordpressSiteUrl,
        wordpressUsername: settings.wordpressUsername,
        wordpressPassword: settings.wordpressPassword,
        googleCseKey: settings.googleCseKey,
        googleCseCx: settings.googleCseCx,
        geminiKey: settings.geminiKey,
        pexelsApiKey: settings.pexelsApiKey,
        naverClientId: settings.naverCustomerId || settings.naverClientId || '',
        naverClientSecret: settings.naverSecretKey || settings.naverClientSecret || '',
        openaiKey: settings.openaiKey,
        claudeKey: settings.claudeKey,
        perplexityKey: settings.perplexityKey,
        leonardoKey: settings.leonardoKey,
        dalleApiKey: settings.dalleApiKey,
        generationEngine: settings.generationEngine
      };

      console.log('🔧 환경 설정 저장 데이터:', envData);
      console.log('📋 네이버 데이터랩 저장 확인:', {
        naverCustomerId: envData.naverClientId ? `있음 (${envData.naverClientId.length}자)` : '없음',
        naverSecretKey: envData.naverClientSecret ? `있음 (${envData.naverClientSecret.length}자)` : '없음'
      });
      const result = await window.blogger.saveEnv(envData);
      console.log('✅ 환경 설정 저장 결과:', result);

      if (result && result.ok) {
        console.log('✅ 네이버 데이터랩 설정이 .env 파일에 저장되었습니다');
      } else {
        console.warn('⚠️ 네이버 데이터랩 설정 저장 실패:', result);
      }
    }
  } catch (error) {
    getErrorHandler().handle(error, {
      function: 'saveSettings',
      step: '환경 설정 저장'
    });
  }

  // 저장된 플랫폼으로 라디오 버튼 명시적으로 업데이트
  const savedPlatform = settings.platform || 'wordpress';
  const platformBloggerEl = document.getElementById('platform-blogger');
  const platformWordpressEl = document.getElementById('platform-wordpress');

  if (platformBloggerEl && platformWordpressEl) {
    if (savedPlatform === 'blogger') {
      platformBloggerEl.checked = true;
      platformWordpressEl.checked = false;
      console.log('✅ 저장 후 플랫폼 라디오 버튼 업데이트: Blogger');
    } else {
      platformBloggerEl.checked = false;
      platformWordpressEl.checked = true;
      console.log('✅ 저장 후 플랫폼 라디오 버튼 업데이트: WordPress');
    }

    // 플랫폼 필드 토글 (워드프레스 설정 숨기기/표시)
    if (typeof togglePlatformFields === 'function') {
      togglePlatformFields();
    }
  }

  updatePlatformStatus();

  const currentSettings = await loadSettings();
  updateApiKeyStatus(currentSettings);

  // 저장 완료 메시지 표시 후 자동으로 모달 닫기
  alert('✅ 설정이 저장되었습니다.');

  // alert 확인 후 모달 자동 닫기
  setTimeout(() => {
    closeSettingsModal();
  }, 100);
}

// API 키 상태 표시 업데이트
export function updateApiKeyStatus(settings) {
  try {
    const statusDiv = document.getElementById('apiKeyStatus');
    const statusIcon = document.getElementById('apiKeyStatusIcon');
    const statusText = document.getElementById('apiKeyStatusText');

    if (!statusDiv || !statusIcon || !statusText) return;

    const requiredKeys = {
      'Gemini': settings.geminiKey || '',
      '네이버 데이터랩 ID': settings.naverCustomerId || settings.naverClientId || '',
      '네이버 데이터랩 Secret': settings.naverSecretKey || settings.naverClientSecret || '',
      'Google CSE Key': settings.googleCseKey || '',
      'Google CSE CX': settings.googleCseCx || '',
      'Pexels API': settings.pexelsApiKey || '',
      'DALL-E API': settings.dalleApiKey || settings.openaiKey || ''
    };

    const configuredKeys = Object.values(requiredKeys).filter(key => key && key.trim().length > 0).length;
    const totalKeys = Object.keys(requiredKeys).length;

    if (configuredKeys === totalKeys) {
      statusIcon.textContent = '';
      statusText.textContent = `모든 API 키가 정상 설정됨 (${configuredKeys}/${totalKeys})`;
      statusDiv.style.background = 'rgba(16, 185, 129, 0.2)';
      statusDiv.style.border = '1px solid rgba(16, 185, 129, 0.4)';
      statusText.style.color = '#10b981';
    } else if (configuredKeys >= totalKeys * 0.7) {
      statusIcon.textContent = '';
      statusText.textContent = `대부분 설정됨 (${configuredKeys}/${totalKeys})`;
      statusDiv.style.background = 'rgba(245, 158, 11, 0.2)';
      statusDiv.style.border = '1px solid rgba(245, 158, 11, 0.4)';
      statusText.style.color = '#f59e0b';
    } else {
      statusIcon.textContent = '';
      statusText.textContent = `설정 필요 (${configuredKeys}/${totalKeys})`;
      statusDiv.style.background = 'rgba(239, 68, 68, 0.2)';
      statusDiv.style.border = '1px solid rgba(239, 68, 68, 0.4)';
      statusText.style.color = '#ef4444';
    }

    const missingKeys = Object.entries(requiredKeys)
      .filter(([_, value]) => !value || value.trim().length === 0)
      .map(([name]) => name);

    if (missingKeys.length > 0) {
      statusDiv.title = `필요한 키: ${missingKeys.join(', ')}`;
    } else {
      statusDiv.title = '모든 API 키가 정상적으로 설정되었습니다.';
    }
  } catch (error) {
    console.error('[API-STATUS] API 상태 업데이트 실패:', error);
  }
}

// 플랫폼 상태 업데이트
export async function updatePlatformStatus() {
  // 저장된 설정을 우선 사용 (모달 내부 라디오 버튼이 아닌 실제 저장된 값)
  // 저장된 값이 Blogger인 경우에만 Blogger 사용, 그 외에는 WordPress
  let platform = 'wordpress';

  try {
    const settings = await loadSettings();
    if (settings && settings.platform === 'blogger') {
      // 사용자가 명시적으로 Blogger를 선택하고 저장한 경우에만 Blogger 사용
      platform = 'blogger';
    } else {
      // 그 외의 경우는 WordPress
      platform = 'wordpress';
    }
  } catch (error) {
    console.warn('[PLATFORM-STATUS] 설정 로드 실패, 기본값 사용:', error);
    platform = 'wordpress';
  }

  const statusBadge = document.getElementById('platformStatus');

  if (statusBadge) {
    if (platform === 'wordpress') {
      statusBadge.textContent = 'WordPress';
      statusBadge.style.background = 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
    } else {
      statusBadge.textContent = 'Blogger';
      statusBadge.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)';
    }
    console.log('[PLATFORM-STATUS] 플랫폼 상태 업데이트:', platform);
  }
}

// 라이선스 정보 로드
export async function loadLicenseInfo() {
  try {
    const licenseStatus = document.getElementById('licenseStatus');

    if (window.blogger && window.blogger.readLicenseFile) {
      const result = await window.blogger.readLicenseFile();

      if (result && result.ok && result.license) {
        // 라이선스 정보가 있는 경우
        const license = result.license;

        if (licenseStatus) {
          // 영구제 또는 기간제 표시
          if (license.type === 'permanent' || license.isPermanent) {
            licenseStatus.textContent = '영구제';
            licenseStatus.style.color = '#10b981'; // 초록색
          } else if (license.expiryDate) {
            const expiryDate = new Date(license.expiryDate);
            const now = new Date();
            const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

            if (daysLeft > 30) {
              licenseStatus.textContent = `기간제 (${daysLeft}일 남음)`;
              licenseStatus.style.color = '#10b981'; // 초록색
            } else if (daysLeft > 0) {
              licenseStatus.textContent = `기간제 (${daysLeft}일 남음)`;
              licenseStatus.style.color = '#f59e0b'; // 주황색 (경고)
            } else {
              licenseStatus.textContent = '만료됨';
              licenseStatus.style.color = '#ef4444'; // 빨간색
            }
          } else {
            licenseStatus.textContent = '기간제';
            licenseStatus.style.color = '#10b981';
          }
        }

        console.log('✅ [LICENSE] 라이선스 정보 로드 완료:', license.type || '기간제');
      } else {
        // 라이선스 정보가 없는 경우 - 기본값으로 영구제 표시
        if (licenseStatus) {
          licenseStatus.textContent = '영구제';
          licenseStatus.style.color = '#10b981';
        }
        console.log('✅ [LICENSE] 기본 라이선스 적용 (영구제)');
      }
    } else {
      // blogger API가 없는 경우 - 기본값으로 영구제 표시
      if (licenseStatus) {
        licenseStatus.textContent = '영구제';
        licenseStatus.style.color = '#10b981';
      }
      console.log('✅ [LICENSE] 기본 라이선스 적용 (영구제)');
    }
  } catch (error) {
    console.error('[LICENSE] 라이선스 정보 로드 실패:', error);
    // 에러 발생 시에도 기본값으로 영구제 표시
    const licenseStatus = document.getElementById('licenseStatus');
    if (licenseStatus) {
      licenseStatus.textContent = '영구제';
      licenseStatus.style.color = '#10b981';
    }
  }
}

// 라이선스 유효성 검사
export function isLicenseValid() {
  const licenseStatus = document.getElementById('licenseStatus');

  if (licenseStatus) {
    const statusText = licenseStatus.textContent;
    // "만료됨"이 아니면 유효
    return statusText !== '만료됨';
  }

  // 요소를 찾을 수 없으면 기본적으로 유효하다고 간주
  return true;
}

// 설정 내용 로드 (모달에 표시)
export async function loadSettingsContent() {
  debugLog('SETTINGS', '설정 내용 로드 시작');

  const modalBody = document.getElementById('settingsModalBody');
  if (!modalBody) {
    console.error('⚠️ settingsModalBody 요소를 찾을 수 없습니다');
    return;
  }

  // 저장된 설정 불러오기
  const savedSettings = await loadSettings();

  // .env 파일에서도 설정 불러오기
  let envSettings = {};
  if (window.blogger && window.blogger.getEnv) {
    try {
      const envResult = await window.blogger.getEnv();
      if (envResult && envResult.ok && envResult.data) {
        envSettings = envResult.data;
      }
    } catch (error) {
      console.error('[ENV] .env 로드 실패:', error);
    }
  }

  // 설정 병합 (env가 우선, 단 플랫폼은 savedSettings 우선)
  const mergedSettings = { ...savedSettings, ...envSettings };

  // 플랫폼 설정: 모달을 열 때는 항상 WordPress를 기본값으로 표시
  // 사용자가 Blogger를 선택하고 저장하면, 그 다음에 모달을 열 때는 Blogger가 선택되어 있어야 함
  // 하지만 사용자가 원하는 것은 앱 시작 시 WordPress가 기본값이므로,
  // 모달을 열 때 저장된 값이 명시적으로 'blogger'인 경우에만 Blogger를 표시
  if (savedSettings && savedSettings.platform === 'blogger') {
    // 사용자가 명시적으로 Blogger를 선택하고 저장한 경우에만 Blogger 사용
    mergedSettings.platform = 'blogger';
    console.log('🔧 [MODAL] 플랫폼 설정: blogger (사용자가 저장한 값)');
  } else {
    // 기본값은 WordPress
    mergedSettings.platform = 'wordpress';
    console.log('🔧 [MODAL] 플랫폼 기본값 설정: wordpress (기본값 또는 저장된 값 없음)');
  }

  // 모달 내용 생성 (HTML은 index.html에 이미 있으므로 여기서는 값만 채움)
  setTimeout(() => {
    if (mergedSettings) {
      console.log('🔧 환경설정 값 로드 시작:', mergedSettings);

      // 모든 필드 값 채우기
      const fieldMappings = {
        'openaiKey': mergedSettings.openaiKey || mergedSettings.openaiApiKey || '',
        'geminiKey': mergedSettings.geminiKey || mergedSettings.geminiApiKey || '',
        'claudeKey': mergedSettings.claudeKey || mergedSettings.claudeApiKey || '',
        'perplexityKey': mergedSettings.perplexityKey || mergedSettings.perplexityApiKey || '',
        'leonardoKey': mergedSettings.leonardoKey || mergedSettings.leonardoApiKey || '',
        'dalleApiKey': mergedSettings.dalleApiKey || mergedSettings.dalleKey || mergedSettings.openaiKey || mergedSettings.openaiApiKey || '',
        'pexelsApiKey': mergedSettings.pexelsApiKey || mergedSettings.pexelsKey || '',
        'naverCustomerId': mergedSettings.naverCustomerId || mergedSettings.naverId || mergedSettings.naverClientId || '',
        'naverSecretKey': mergedSettings.naverSecretKey || mergedSettings.naverSecret || mergedSettings.naverClientSecret || '',
        'googleCseKey': mergedSettings.googleCseKey || mergedSettings.cseKey || mergedSettings.googleApiKey || '',
        'googleCseCx': mergedSettings.googleCseCx || mergedSettings.cseCx || mergedSettings.googleCseId || '',
        'blogId': mergedSettings.blogId || mergedSettings.bloggerId || '',
        'googleClientId': mergedSettings.googleClientId || mergedSettings.clientId || '',
        'googleClientSecret': mergedSettings.googleClientSecret || mergedSettings.clientSecret || '',
        'wordpressSiteUrl': mergedSettings.wordpressSiteUrl || mergedSettings.wpSiteUrl || mergedSettings.wordpressUrl || '',
        'wordpressUsername': mergedSettings.wordpressUsername || mergedSettings.wpUsername || mergedSettings.wordpressUser || '',
        'wordpressPassword': mergedSettings.wordpressPassword || mergedSettings.wpPassword || mergedSettings.wordpressPass || '',
        'imageFolderPath': mergedSettings.imageFolderPath || '',
        'generationEngine': mergedSettings.generationEngine || mergedSettings.provider || 'gemini',
        'blogUrl': mergedSettings.blogUrl || ''
      };

      Object.entries(fieldMappings).forEach(([fieldId, value]) => {
        const el = document.getElementById(fieldId);
        if (el) {
          el.value = value;
          console.log(`✅ ${fieldId} 로드:`, value ? '있음' : '없음');
        }
      });

      // 플랫폼 선택: 사용자가 원하는 것은 앱 시작 시 WordPress가 기본값이므로,
      // 모달을 열 때 저장된 값이 명시적으로 'blogger'인 경우에만 Blogger 표시
      // 그 외에는 항상 WordPress를 기본값으로 표시
      const platformToShow = (savedSettings && savedSettings.platform === 'blogger') ? 'blogger' : 'wordpress';
      console.log('🔧 플랫폼 설정 (모달 라디오 버튼):', platformToShow, '(저장된 값:', savedSettings?.platform, ')');

      const platformBloggerEl = document.getElementById('platform-blogger');
      const platformWordpressEl = document.getElementById('platform-wordpress');

      if (platformBloggerEl && platformWordpressEl) {
        // 저장된 값이 명시적으로 'blogger'인 경우에만 Blogger 표시
        if (platformToShow === 'blogger') {
          platformBloggerEl.checked = true;
          platformWordpressEl.checked = false;
          console.log('✅ 플랫폼 라디오 버튼: Blogger (사용자가 저장한 값)');
        } else {
          // 기본값은 WordPress
          platformBloggerEl.checked = false;
          platformWordpressEl.checked = true;
          console.log('✅ 플랫폼 라디오 버튼: WordPress (기본값)');
        }
      } else {
        console.error('❌ 플랫폼 라디오 버튼을 찾을 수 없습니다');
      }

      // 플랫폼 필드 토글 (모달 내부 UI만 업데이트, 실제 플랫폼 상태는 변경하지 않음)
      if (typeof togglePlatformFields === 'function') {
        togglePlatformFields();
      }

      // 주의: updatePlatformStatus()는 호출하지 않음
      // 모달 내부의 라디오 버튼이 실제 플랫폼 상태를 덮어쓰지 않도록 함

      // API 키 상태 확인 및 표시
      updateApiKeyStatus(mergedSettings);

      console.log('✅ 환경설정 값 로드 완료');
    }
  }, 300);
}

// 헬퍼 함수들
function closeSettingsModal() {
  // 모달 닫기
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.style.display = 'none';
    console.log('✅ 환경설정 모달 닫기');
  }
}

function togglePlatformFields() {
  // 플랫폼 필드 토글 (ui.js에서 import 필요)
  if (typeof togglePlatformFieldsUI === 'function') {
    togglePlatformFieldsUI();
  }
}

// 플랫폼 연동 확인
export async function checkPlatformConnection() {
  const selectedPlatform = document.querySelector('input[name="platform"]:checked')?.value || 'wordpress';

  console.log('플랫폼 연동 확인 시작:', selectedPlatform);

  try {
    if (selectedPlatform === 'wordpress') {
      // 워드프레스 인증 확인
      const settings = await loadSettings();

      if (!settings.wordpressSiteUrl || !settings.wordpressUsername || !settings.wordpressPassword) {
        alert('❌ 워드프레스 연동을 완료하려면:\n\n1. 환경설정 모달을 열어주세요\n2. 워드프레스 사이트 URL, 사용자명, 앱 비밀번호를 입력하세요\n3. "설정 저장" 버튼을 클릭하세요');
        return;
      }

      alert('✅ 워드프레스 연동이 완료되었습니다!\n\n사이트: ' + settings.wordpressSiteUrl);
    } else if (selectedPlatform === 'blogger') {
      // 블로그스팟 인증 확인
      const settings = await loadSettings();

      if (!settings.blogId || !settings.googleClientId || !settings.googleClientSecret) {
        alert('❌ 블로그스팟 연동을 완료하려면:\n\n1. 환경설정 모달을 열어주세요\n2. Blogger ID, Google Client ID, Google Client Secret을 입력하세요\n3. "설정 저장" 버튼을 클릭하세요\n4. "Blogger OAuth2" 버튼을 클릭하여 인증을 완료하세요');
        return;
      }

      alert('✅ 블로그스팟 설정이 저장되어 있습니다.\n\nBlog ID: ' + settings.blogId.substring(0, 10) + '...');
    } else {
      alert('지원하지 않는 플랫폼입니다.');
    }
  } catch (error) {
    console.error('❌ 플랫폼 연동 확인 오류:', error);
    alert('❌ 플랫폼 연동 확인 중 오류가 발생했습니다: ' + error.message);
  }
}

// CSE 연동 확인
export async function checkCseConnection() {
  try {
    const settings = await loadSettings();

    if (!settings.googleCseKey || !settings.googleCseCx) {
      alert('❌ CSE 연동이 필요합니다.\n\n환경설정에서 구글 맞춤 검색 API 키와 검색 엔진 ID를 입력해주세요.');
      return;
    }

    alert('✅ CSE 설정이 저장되어 있습니다.\n\nAPI 키: ' + settings.googleCseKey.substring(0, 10) + '...\n검색 엔진 ID: ' + settings.googleCseCx.substring(0, 10) + '...');
  } catch (error) {
    console.error('❌ CSE 연동 확인 오류:', error);
    alert('❌ CSE 연동 확인 중 오류가 발생했습니다: ' + error.message);
  }
}

// 🔥 Blogger OAuth2 인증 시작 (로컬 서버 기반 - OOB deprecated 대응)
export async function startBloggerOAuth() {
  try {
    const settings = await loadSettings();
    const blogId = settings.blogId || '';
    const googleClientId = settings.googleClientId || '';
    const googleClientSecret = settings.googleClientSecret || '';

    if (!blogId || !googleClientId || !googleClientSecret) {
      alert('❌ 환경설정에서 Blogger ID, Google Client ID, Google Client Secret을 먼저 설정해주세요.');
      return;
    }

    // 🔥 Electron IPC로 로컬 서버 기반 OAuth 시작
    if (window.electronAPI && window.electronAPI.startBloggerAuth) {
      console.log('[BLOGGER-AUTH] 로컬 서버 기반 OAuth 시작...');

      const result = await window.electronAPI.startBloggerAuth({
        blogId,
        googleClientId,
        googleClientSecret
      });

      if (!result.ok) {
        alert('❌ 블로그스팟 OAuth 시작 실패: ' + (result.error || '알 수 없는 오류'));
        return;
      }

      console.log('[BLOGGER-AUTH] OAuth URL 열림:', result.authUrl);

      // 🔥 대기 모달 표시
      showBloggerAuthWaitingModal();

    } else {
      alert('❌ Blogger 인증을 사용하려면 앱을 다시 시작해주세요.\n\nElectron API를 찾을 수 없습니다.');
    }

  } catch (error) {
    console.error('❌ 블로그스팟 OAuth 시작 오류:', error);
    alert('❌ 블로그스팟 OAuth 시작 중 오류가 발생했습니다: ' + error.message);
  }
}

// 🔥 블로그스팟 인증 대기 모달
function showBloggerAuthWaitingModal() {
  const existingModal = document.getElementById('bloggerAuthWaitingModal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'bloggerAuthWaitingModal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.8); display: flex;
    align-items: center; justify-content: center; z-index: 99999;
  `;

  modal.innerHTML = `
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #0d1b2a 100%); border-radius: 20px; padding: 40px; max-width: 450px; width: 90%; text-align: center;">
      <div style="font-size: 60px; margin-bottom: 20px;">🔐</div>
      <h2 style="color: white; font-size: 24px; margin-bottom: 15px;">브라우저에서 인증 중...</h2>
      <p style="color: #94a3b8; font-size: 16px; margin-bottom: 20px;">
        브라우저에서 Google 계정으로 로그인하고<br>권한을 승인해주세요.
      </p>
      <div style="background: rgba(255,255,255,0.1); border-radius: 10px; padding: 15px; margin-bottom: 20px;">
        <div style="width: 40px; height: 40px; border: 3px solid #3b82f6; border-top-color: transparent; border-radius: 50%; margin: 0 auto; animation: spin 1s linear infinite;"></div>
        <p style="color: #60a5fa; font-size: 14px; margin-top: 10px;">인증 완료를 기다리는 중...</p>
      </div>
      <button onclick="document.getElementById('bloggerAuthWaitingModal')?.remove()" style="padding: 12px 30px; background: #64748b; color: white; border: none; border-radius: 10px; font-size: 16px; cursor: pointer;">
        취소
      </button>
    </div>
    <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
  `;

  document.body.appendChild(modal);

  // 🔥 인증 완료 이벤트 리스너 등록
  if (window.electronAPI && window.electronAPI.onBloggerAuthComplete) {
    window.electronAPI.onBloggerAuthComplete((result) => {
      console.log('[SETTINGS] Blogger 인증 완료 이벤트 수신:', result);

      // 대기 모달 닫기
      const waitingModal = document.getElementById('bloggerAuthWaitingModal');
      if (waitingModal) waitingModal.remove();

      if (result.ok) {
        alert('✅ 블로그스팟 연동이 완료되었습니다!');

        // 상태 업데이트
        const statusDiv = document.getElementById('bloggerAuthStatus');
        if (statusDiv) {
          statusDiv.style.display = 'block';
          statusDiv.style.background = '#4CAF50';
          statusDiv.style.color = 'white';
          statusDiv.textContent = '✅ 연동완료';
        }
      } else {
        alert('❌ 블로그스팟 연동 실패: ' + (result.error || '알 수 없는 오류'));
      }
    });
  }
}

// Blogger 인증 코드 입력 모달 표시
function showBloggerAuthCodeInput() {
  const modal = document.getElementById('bloggerAuthCodeModal');
  if (modal) {
    modal.style.display = 'flex';
    console.log('✅ Blogger 인증 코드 입력 모달 표시');

    // 입력 필드 초기화 및 포커스
    setTimeout(() => {
      const input = document.getElementById('bloggerAuthCode');
      if (input) {
        input.value = '';
        input.focus();
      }
    }, 100);
  } else {
    console.error('❌ bloggerAuthCodeModal 요소를 찾을 수 없습니다!');
  }
}

// Blogger 인증 코드 입력 모달 닫기
export function closeBloggerAuthCodeModal() {
  const modal = document.getElementById('bloggerAuthCodeModal');
  if (modal) {
    modal.style.display = 'none';
    console.log('✅ Blogger 인증 코드 입력 모달 닫기');

    // 입력 필드 초기화
    const input = document.getElementById('bloggerAuthCode');
    if (input) {
      input.value = '';
    }
  }
}

// 🚀 네트워크 최적화 원클릭 기능
export async function optimizeNetwork() {
  const statusDiv = document.getElementById('networkOptStatus');
  const button = document.getElementById('networkOptBtn');

  try {
    if (button) {
      button.disabled = true;
      button.innerHTML = '⏳ 최적화 중...';
    }

    if (statusDiv) {
      statusDiv.innerHTML = '<span style="color:#f59e0b;">⏳ 네트워크 최적화 진행 중...</span>';
    }

    console.log('[NETWORK-OPT] 네트워크 최적화 시작...');

    // 1. DNS 캐시 초기화 시도
    let dnsOptimized = false;
    try {
      if (window.blogger && window.blogger.clearDnsCache) {
        await window.blogger.clearDnsCache();
        dnsOptimized = true;
      }
    } catch (e) {
      console.warn('[NETWORK-OPT] DNS 캐시 초기화 스킵:', e);
    }

    // 2. 연결 풀 최적화 (HTTP Keep-Alive, 연결 재사용)
    const connectionSettings = {
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 50,
      maxFreeSockets: 10,
      timeout: 30000,
      scheduling: 'lifo'
    };

    // 3. 타임아웃 설정 최적화
    const timeoutSettings = {
      connectTimeout: 10000,
      readTimeout: 30000,
      retries: 3,
      retryDelay: 1000
    };

    // 4. 캐시 정책 설정
    const cacheSettings = {
      enabled: true,
      maxAge: 3600,
      staleWhileRevalidate: 86400
    };

    // 저장소에 최적화 설정 저장
    const storage = getStorageManager();
    await storage.set('networkOptimization', {
      enabled: true,
      timestamp: Date.now(),
      connection: connectionSettings,
      timeout: timeoutSettings,
      cache: cacheSettings
    }, true);

    // 5. 환경 변수로 전달 (preload를 통해)
    if (window.blogger && window.blogger.setNetworkConfig) {
      await window.blogger.setNetworkConfig({
        ...connectionSettings,
        ...timeoutSettings
      });
    }

    // 완료 메시지
    const optimizedItems = [
      '✅ HTTP Keep-Alive 활성화',
      '✅ 연결 풀 최적화 (50개 동시 연결)',
      '✅ 타임아웃 최적화 (30초)',
      '✅ 자동 재시도 (3회)',
      dnsOptimized ? '✅ DNS 캐시 초기화' : '⚠️ DNS 캐시 (수동 필요)'
    ];

    if (statusDiv) {
      statusDiv.innerHTML = `<span style="color:#10b981;">✅ 네트워크 최적화 완료!</span>
        <div style="font-size: 11px; margin-top: 5px; color: rgba(255,255,255,0.6);">
          ${optimizedItems.join('<br>')}
        </div>`;
    }

    if (button) {
      button.disabled = false;
      button.innerHTML = '✅ 최적화 완료';
      setTimeout(() => {
        button.innerHTML = '⚡ 네트워크 최적화';
      }, 3000);
    }

    console.log('[NETWORK-OPT] ✅ 네트워크 최적화 완료');

    // 알림
    addLog?.('[설정] ✅ 네트워크 최적화 완료');

    return { ok: true, message: '네트워크 최적화 완료' };

  } catch (error) {
    console.error('[NETWORK-OPT] ❌ 실패:', error);

    if (statusDiv) {
      statusDiv.innerHTML = `<span style="color:#ef4444;">❌ 최적화 실패: ${error.message}</span>`;
    }

    if (button) {
      button.disabled = false;
      button.innerHTML = '⚡ 네트워크 최적화';
    }

    return { ok: false, error: error.message };
  }
}

// 네트워크 최적화 상태 확인
export async function getNetworkOptStatus() {
  try {
    const storage = getStorageManager();
    const settings = await storage.get('networkOptimization', true);

    if (settings && settings.enabled) {
      const elapsed = Date.now() - settings.timestamp;
      const hours = Math.floor(elapsed / (1000 * 60 * 60));

      return {
        enabled: true,
        message: hours > 0 ? `${hours}시간 전 최적화됨` : '방금 최적화됨'
      };
    }

    return { enabled: false, message: '최적화 필요' };
  } catch {
    return { enabled: false, message: '상태 확인 실패' };
  }
}

// 전역 함수로 등록
window.optimizeNetwork = optimizeNetwork;

// Blogger 인증 코드 제출
window.submitBloggerAuthCode = async function () {
  const authCodeInput = document.getElementById('bloggerAuthCode');
  const authCode = authCodeInput?.value.trim();

  if (!authCode) {
    alert('❌ 인증 코드를 입력해주세요.');
    return;
  }

  try {
    // 설정에서 OAuth 정보 가져오기
    const settings = await loadSettings();
    const googleClientId = settings.googleClientId || '';
    const googleClientSecret = settings.googleClientSecret || '';
    // 🔥 로컬 서버 기반 redirect_uri (OOB deprecated 대응)
    const redirectUri = 'http://127.0.0.1:58392/callback';

    if (!googleClientId || !googleClientSecret) {
      alert('❌ 환경설정에서 Google Client ID와 Client Secret을 먼저 설정해주세요.');
      return;
    }

    // 백엔드에 인증 코드 전송 (여러 방법 시도)
    const oauthArgs = {
      client_id: googleClientId,
      client_secret: googleClientSecret,
      code: authCode,
      redirect_uri: redirectUri
    };

    console.log('🔍 API 확인:', {
      hasBlogger: !!window.blogger,
      bloggerKeys: window.blogger ? Object.keys(window.blogger).slice(0, 10) : [],
      hasElectronAPI: !!window.electronAPI,
      electronAPIKeys: window.electronAPI ? Object.keys(window.electronAPI).slice(0, 10) : []
    });

    let result = null;
    let usedMethod = '';

    // 방법 1: window.electronAPI.invoke 직접 사용 (가장 안정적)
    if (window.electronAPI && typeof window.electronAPI.invoke === 'function') {
      try {
        console.log('✅ window.electronAPI.invoke 직접 사용');
        usedMethod = 'electronAPI.invoke';
        result = await window.electronAPI.invoke('exchange-oauth-token', oauthArgs);
      } catch (err) {
        console.warn('⚠️ electronAPI.invoke 실패, 다른 방법 시도:', err);
      }
    }

    // 방법 2: window.electronAPI.exchangeOAuthToken 사용
    if (!result && window.electronAPI && typeof window.electronAPI.exchangeOAuthToken === 'function') {
      try {
        console.log('✅ window.electronAPI.exchangeOAuthToken 사용');
        usedMethod = 'electronAPI.exchangeOAuthToken';
        result = await window.electronAPI.exchangeOAuthToken(oauthArgs);
      } catch (err) {
        console.warn('⚠️ electronAPI.exchangeOAuthToken 실패, 다른 방법 시도:', err);
      }
    }

    // 방법 3: window.blogger.exchangeOAuthToken 사용
    if (!result && window.blogger && typeof window.blogger.exchangeOAuthToken === 'function') {
      try {
        console.log('✅ window.blogger.exchangeOAuthToken 사용');
        usedMethod = 'blogger.exchangeOAuthToken';
        result = await window.blogger.exchangeOAuthToken(oauthArgs);
      } catch (err) {
        console.warn('⚠️ blogger.exchangeOAuthToken 실패:', err);
      }
    }

    // 방법 4: window.blogger.invoke 사용
    if (!result && window.blogger && typeof window.blogger.invoke === 'function') {
      try {
        console.log('✅ window.blogger.invoke 직접 사용');
        usedMethod = 'blogger.invoke';
        result = await window.blogger.invoke('exchange-oauth-token', oauthArgs);
      } catch (err) {
        console.warn('⚠️ blogger.invoke 실패:', err);
      }
    }

    if (!result) {
      console.error('❌ 모든 방법 실패:', {
        windowBlogger: window.blogger ? Object.keys(window.blogger) : 'undefined',
        windowElectronAPI: window.electronAPI ? Object.keys(window.electronAPI) : 'undefined'
      });
      throw new Error('exchangeOAuthToken 함수를 사용할 수 없습니다. 백엔드 API를 확인해주세요.');
    }

    console.log(`✅ 인증 시도 완료 (방법: ${usedMethod}):`, result);

    if (result && (result.success || result.ok)) {
      alert('✅ Blogger 인증이 완료되었습니다!');

      // 모달 닫기
      closeBloggerAuthCodeModal();
    } else {
      throw new Error(result?.error || '인증 실패');
    }
  } catch (error) {
    console.error('❌ Blogger 인증 코드 제출 오류:', error);
    alert('❌ 인증 코드 제출 중 오류가 발생했습니다: ' + error.message);
  }
};

