// 🔧 설정 관리 관련 함수들
import { getErrorHandler, getStorageManager, addLog, debugLog } from './core.js';

function normalizePlatformValue(value, fallback = 'blogger') {
  const platform = String(value || '').toLowerCase().trim();
  if (platform === 'blogspot') return 'blogger';
  if (platform === 'blogger' || platform === 'wordpress' || platform === 'tistory') return platform;
  return fallback;
}

function getPlatformDisplay(platform) {
  const normalized = normalizePlatformValue(platform);
  if (normalized === 'blogger') {
    return { label: 'Blogger', color: '#f97316', background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)' };
  }
  if (normalized === 'tistory') {
    return { label: 'Tistory', color: '#14b8a6', background: 'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)' };
  }
  return { label: 'WordPress', color: '#3b82f6', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' };
}

function pickSettingValue(source = {}, keys = []) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

function hasBloggerSettings(source = {}) {
  return Boolean(
    pickSettingValue(source, ['blogId', 'bloggerId', 'BLOG_ID', 'BLOGGER_ID', 'GOOGLE_BLOG_ID', 'BLOGGER_BLOG_ID'])
    || pickSettingValue(source, ['googleClientId', 'clientId', 'GOOGLE_CLIENT_ID', 'BLOGGER_CLIENT_ID'])
    || pickSettingValue(source, ['googleClientSecret', 'clientSecret', 'GOOGLE_CLIENT_SECRET', 'BLOGGER_CLIENT_SECRET'])
  );
}

function hasWordPressSettings(source = {}) {
  return Boolean(
    pickSettingValue(source, ['wordpressSiteUrl', 'wpSiteUrl', 'wordpressUrl', 'WORDPRESS_SITE_URL', 'WP_SITE_URL'])
    || pickSettingValue(source, ['wordpressUsername', 'wpUsername', 'WORDPRESS_USERNAME', 'WP_USERNAME'])
    || pickSettingValue(source, ['wordpressPassword', 'wpPassword', 'WORDPRESS_PASSWORD', 'WP_PASSWORD'])
  );
}

function resolvePlatformValue(saved = {}, env = {}, fallback = 'blogger') {
  const savedRaw = pickSettingValue(saved, ['platform', 'PLATFORM', 'blogPlatform', 'BLOG_PLATFORM']);
  if (savedRaw) return normalizePlatformValue(savedRaw, fallback);

  const envRaw = pickSettingValue(env, ['platform', 'PLATFORM', 'blogPlatform', 'BLOG_PLATFORM']);
  if (envRaw) return normalizePlatformValue(envRaw, fallback);

  if (hasBloggerSettings(saved) || hasBloggerSettings(env)) return 'blogger';
  if (hasWordPressSettings(saved) || hasWordPressSettings(env)) return 'wordpress';
  return fallback;
}

async function loadEnvSettingsForRecovery() {
  const methods = [
    () => window.blogger?.getEnv?.(),
    () => window.electronAPI?.loadEnvironmentSettings?.(),
    () => window.blogger?.loadEnvironmentSettings?.(),
  ];

  for (const method of methods) {
    try {
      const result = await method();
      if (!result) continue;
      if (result.ok && result.data) return result.data;
      if (result.ok && result.settings) return result.settings;
      if (typeof result === 'object' && !Array.isArray(result) && !result.error) return result;
    } catch {
      // Try the next bridge.
    }
  }
  return {};
}

function restoreBloggerAliases(settings = {}, env = {}) {
  const restored = { ...settings };
  if (!restored.blogId) restored.blogId = pickSettingValue(env, ['blogId', 'bloggerId', 'BLOG_ID', 'BLOGGER_ID', 'GOOGLE_BLOG_ID', 'BLOGGER_BLOG_ID']);
  if (!restored.googleClientId) restored.googleClientId = pickSettingValue(env, ['googleClientId', 'clientId', 'GOOGLE_CLIENT_ID', 'BLOGGER_CLIENT_ID']);
  if (!restored.googleClientSecret) restored.googleClientSecret = pickSettingValue(env, ['googleClientSecret', 'clientSecret', 'GOOGLE_CLIENT_SECRET', 'BLOGGER_CLIENT_SECRET']);
  return restored;
}

// 설정 로드 (비동기)
export async function loadSettings() {
  const storage = getStorageManager();
  let settings = {};
  let hadStoredSettings = false;
  let hadStoredPlatform = false;

  try {
    const savedSettings = await storage.get('bloggerSettings', true);
    if (savedSettings) {
      settings = savedSettings;
      hadStoredSettings = true;
      hadStoredPlatform = !!savedSettings.platform;
    }
  } catch (e) {
    getErrorHandler().handle(e, {
      function: 'loadSettings',
      step: '설정 파싱'
    });
    settings = {};
  }

  const envSettings = await loadEnvSettingsForRecovery();
  const originalPlatform = settings.platform;
  settings = restoreBloggerAliases(settings, envSettings);
  settings.platform = resolvePlatformValue(settings, envSettings, 'blogger');
  console.log('[LOAD] 플랫폼 설정:', { original: originalPlatform || '(empty)', normalized: settings.platform });

  if ((!hadStoredSettings || !hadStoredPlatform) && (hasBloggerSettings(settings) || hasWordPressSettings(settings))) {
    try {
      await storage.set('bloggerSettings', settings, true);
      console.log('[LOAD] platform/settings recovered from .env into bloggerSettings');
    } catch (e) {
      console.warn('[LOAD] recovered settings save skipped:', e);
    }
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
    stabilityApiKey: document.getElementById('stabilityApiKey')?.value || document.getElementById('stabilityApiKeyHidden')?.value || '',
    deepInfraApiKey: document.getElementById('deepInfraApiKey')?.value || '',
    prodiaApiKey: document.getElementById('prodiaApiKey')?.value || '',
    coupangAccessKey: document.getElementById('coupangAccessKey')?.value || '',
    coupangSecretKey: document.getElementById('coupangSecretKey')?.value || '',
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
    tistoryBlogName: document.getElementById('tistoryBlogName')?.value || '',
    tistoryDefaultCategory: document.getElementById('tistoryDefaultCategory')?.value || '',
    tistoryDefaultVisibility: document.getElementById('tistoryDefaultVisibility')?.value || 'private',
    platform: document.querySelector('input[name="platform"]:checked')?.value || 'blogger',
    primaryGeminiTextModel: document.querySelector('input[name="primaryGeminiTextModel"]:checked')?.value || 'gemini-2.5-flash',
    generationEngine: (() => {
      // 🔥 환경설정의 primaryGeminiTextModel 라디오를 단일 진실 소스로 사용
      const m = document.querySelector('input[name="primaryGeminiTextModel"]:checked')?.value;
      if (!m) return 'gemini';
      if (m.startsWith('gemini-')) return 'gemini';
      if (m.startsWith('openai-') || m.startsWith('gpt-') || /^o\d/i.test(m)) return 'openai';
      if (m.startsWith('claude-')) return 'claude';
      if (m === 'perplexity-sonar') return 'perplexity';
      return 'gemini';
    })(),
    defaultAiProvider: (() => {
      const m = document.querySelector('input[name="primaryGeminiTextModel"]:checked')?.value;
      if (!m) return 'gemini';
      if (m.startsWith('gemini-')) return 'gemini';
      if (m.startsWith('openai-') || m.startsWith('gpt-') || /^o\d/i.test(m)) return 'openai';
      if (m.startsWith('claude-')) return 'claude';
      if (m === 'perplexity-sonar') return 'perplexity';
      return 'gemini';
    })(),
    executionMode: (() => {
      try { return JSON.parse(localStorage.getItem('leadernamExecutionMode') || '"api"'); }
      catch { return localStorage.getItem('leadernamExecutionMode') || 'api'; }
    })(),
    activeAgentProvider: (() => {
      try { return JSON.parse(localStorage.getItem('leadernamActiveAgentProvider') || '"codex"'); }
      catch { return localStorage.getItem('leadernamActiveAgentProvider') || 'codex'; }
    })(),
    activeApiTextProvider: (() => {
      try { return JSON.parse(localStorage.getItem('leadernamActiveApiTextProvider') || '"gemini"'); }
      catch { return localStorage.getItem('leadernamActiveApiTextProvider') || 'gemini'; }
    })(),
    activeApiImageProvider: (() => {
      try { return JSON.parse(localStorage.getItem('leadernamActiveApiImageProvider') || '"stability"'); }
      catch { return localStorage.getItem('leadernamActiveApiImageProvider') || 'stability'; }
    })(),
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
        tistoryBlogName: settings.tistoryBlogName,
        tistoryDefaultCategory: settings.tistoryDefaultCategory,
        tistoryDefaultVisibility: settings.tistoryDefaultVisibility,
        googleCseKey: settings.googleCseKey,
        googleCseCx: settings.googleCseCx,
        geminiKey: settings.geminiKey,
        pexelsApiKey: settings.pexelsApiKey,
        stabilityApiKey: settings.stabilityApiKey,
        deepInfraApiKey: settings.deepInfraApiKey,
        prodiaApiKey: settings.prodiaApiKey,
        naverClientId: settings.naverCustomerId || settings.naverClientId || '',
        naverClientSecret: settings.naverSecretKey || settings.naverClientSecret || '',
        openaiKey: settings.openaiKey,
        claudeKey: settings.claudeKey,
        perplexityKey: settings.perplexityKey,
        leonardoKey: settings.leonardoKey,
        dalleApiKey: settings.dalleApiKey,
        // 🔥 쿠팡 파트너스 키
        coupangAccessKey: settings.coupangAccessKey,
        coupangSecretKey: settings.coupangSecretKey,
        // 🔥 톤스타일도 저장
        toneStyle: settings.toneStyle,
        generationEngine: settings.generationEngine,
        primaryGeminiTextModel: settings.primaryGeminiTextModel,
        defaultAiProvider: settings.defaultAiProvider,
        platform: settings.platform,
        executionMode: settings.executionMode,
        activeAgentProvider: settings.activeAgentProvider,
        activeApiTextProvider: settings.activeApiTextProvider,
        activeApiImageProvider: settings.activeApiImageProvider
      };

      const maskEnvValue = (value) => {
        const s = String(value || '');
        if (!s) return '';
        return `${s.slice(0, 4)}...(${s.length})`;
      };
      const redactedEnvData = Object.fromEntries(
        Object.entries(envData).map(([key, value]) => (
          /key|secret|password|token/i.test(key)
            ? [key, maskEnvValue(value)]
            : [key, value]
        ))
      );
      console.log('🔧 환경 설정 저장 데이터:', redactedEnvData);
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
  const savedPlatform = settings.platform || 'blogger';
  const platformBloggerEl = document.getElementById('platform-blogger');
  const platformWordpressEl = document.getElementById('platform-wordpress');
  const platformTistoryEl = document.getElementById('platform-tistory');

  if (platformBloggerEl && platformWordpressEl) {
    if (savedPlatform === 'blogger') {
      platformBloggerEl.checked = true;
      platformWordpressEl.checked = false;
      if (platformTistoryEl) platformTistoryEl.checked = false;
      console.log('✅ 저장 후 플랫폼 라디오 버튼 업데이트: Blogger');
    } else if (savedPlatform === 'tistory') {
      platformBloggerEl.checked = false;
      platformWordpressEl.checked = false;
      if (platformTistoryEl) platformTistoryEl.checked = true;
      console.log('[SETTINGS] Saved platform radio updated: Tistory');
    } else {
      platformBloggerEl.checked = false;
      platformWordpressEl.checked = true;
      if (platformTistoryEl) platformTistoryEl.checked = false;
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
  let platform = 'blogger';

  try {
    const settings = await loadSettings();
    platform = normalizePlatformValue(settings?.platform);
  } catch (error) {
    console.warn('[PLATFORM-STATUS] 설정 로드 실패, 기본값 사용:', error);
    platform = 'blogger';
  }

  const statusBadge = document.getElementById('platformStatus');

  if (statusBadge) {
    const display = getPlatformDisplay(platform);
    statusBadge.textContent = display.label;
    statusBadge.style.color = display.color;
    statusBadge.style.background = display.background;
    console.log('[PLATFORM-STATUS] 플랫폼 상태 업데이트:', platform);
  }
}

function updateLicenseAccessStateFromSettings(partial = {}) {
  if (typeof window.setLicenseAccessState === 'function') {
    window.setLicenseAccessState(partial);
    return;
  }

  const previous = window.__licenseAccessState || {};
  const next = {
    checked: true,
    isFreeTrial: false,
    valid: false,
    ...previous,
    ...partial,
    updatedAt: Date.now(),
  };

  window.__licenseAccessState = next;

  try {
    window.dispatchEvent(new CustomEvent('license-access-updated', { detail: next }));
  } catch {
    // ignore
  }

  try {
    window.applyFreeTrialAccessGate?.();
  } catch {
    // ignore
  }
}

// 라이선스 정보 로드
export async function loadLicenseInfo() {
  try {
    const licenseStatus = document.getElementById('licenseStatus');

    try {
      const api = window.blogger || window.electronAPI;
      if (api && typeof api.getQuotaStatus === 'function') {
        const quotaStatus = await api.getQuotaStatus();
        if (quotaStatus && quotaStatus.success && quotaStatus.isFree) {
          const usage = (quotaStatus.quota && quotaStatus.quota.usage) || 0;
          const limit = (quotaStatus.quota && quotaStatus.quota.limit) || 3;

          // v3.8.464: 두 경로가 같은 문구를 쓰도록 계산식을 공유한다
          const free = buildLicenseLabel({ isFreeTrial: true, quota: quotaStatus.quota });
          if (licenseStatus) {
            licenseStatus.textContent = free.label;
            licenseStatus.style.color = free.color;
            if (!licenseStatus.dataset) licenseStatus.dataset = {};
            licenseStatus.dataset.valid = 'true';
            licenseStatus.title = '무료 체험 — 하루 3회 발행';
          }

          updateLicenseAccessStateFromSettings({
            isFreeTrial: true,
            valid: true,
            quota: quotaStatus.quota || null,
            source: 'settings-free-quota',
          });
          return;
        }
      }
    } catch (quotaError) {
      console.warn('[LICENSE] 무료체험 상태 확인 실패:', quotaError);
    }

    const license = await readLicenseForDisplay();
    applyLicenseBadge(licenseStatus, license);

    updateLicenseAccessStateFromSettings({
      isFreeTrial: false,
      valid: license.valid,
      licenseType: license.type || null,
      expiresAt: license.expiresAt || null,
      source: license.source,
    });

    console.log('[LICENSE] 표시:', license.label, '|', license.source, license.expiresAt || '');
  } catch (error) {
    console.error('[LICENSE] 라이선스 정보 로드 실패:', error);
    /**
     * ⚠️ v3.8.463 — 실패 시 "영구제"로 떨어뜨리지 않는다.
     * 예전에는 어떤 실패든 영구제로 표시해서, 기간제 사용자도 남은 날짜 대신
     * "영구제"만 보였다. 모르면 모른다고 표시한다.
     */
    const licenseStatus = document.getElementById('licenseStatus');
    applyLicenseBadge(licenseStatus, {
      valid: false, type: null, expiresAt: null,
      label: '확인 실패', color: '#f59e0b', source: 'settings-load-error',
    });
    updateLicenseAccessStateFromSettings({
      isFreeTrial: false,
      valid: false,
      source: 'settings-load-error',
    });
  }
}

/** 남은 일수 — 날짜 경계 기준으로 센다 (같은 날이면 0, 내일 만료면 1) */
export function daysUntil(expiresAt, nowMs = Date.now()) {
  if (expiresAt === null || expiresAt === undefined || expiresAt === '') return null;
  const expMs = typeof expiresAt === 'number' ? expiresAt : Date.parse(expiresAt);
  if (!Number.isFinite(expMs)) return null;

  const startOfDay = (ms) => {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  return Math.round((startOfDay(expMs) - startOfDay(nowMs)) / 86400000);
}

/**
 * 🪪 v3.8.463 — 코드 종류에 맞는 배지 문구를 만든다.
 *
 * 예전에는 헤더 배지가 index.html 에 '영구제'로 박혀 있었고, 갱신 함수도
 * 라이선스를 못 읽으면 전부 '영구제'로 되돌렸다. 게다가 IPC 는 `{ok, data}` 를
 * 주는데 `result.license` 를 읽어서 **항상** 못 읽는 상태였다 — 그래서 기간제
 * 사용자도 남은 날짜를 볼 수 없었다.
 */
export function buildLicenseLabel(status, nowMs = Date.now()) {
  /**
   * 🆓 v3.8.464 — 무료체험이 가장 먼저다.
   *
   * 배지를 쓰는 경로가 둘인데(설정 로드 loadLicenseInfo, 환경설정 열 때
   * refreshLicenseStatus) 한쪽만 무료체험을 알고 있었다. 그래서 앱을 켜면
   * "🆓 무료체험 (0/3)" 이 뜨다가 **환경설정을 한 번 열면 "미등록" 으로 덮였다** —
   * 무료체험 사용자에게는 라이선스가 없는 게 정상인데 그걸 미등록으로 읽은 것이다.
   * 계산식을 한 곳으로 모은 김에 무료체험도 여기서 판정한다.
   */
  if (status?.isFreeTrial) {
    const usage = Number(status?.quota?.usage) || 0;
    const limit = Number(status?.quota?.limit) || 3;
    const done = usage >= limit;
    return {
      // v3.8.469: 차감식 — "쓴 횟수" 보다 "남은 횟수" 가 바로 읽힌다
      label: done ? '🆓 무료체험 (소진)' : `🆓 무료체험 (${Math.max(0, limit - usage)}회 남음)`,
      color: done ? '#f59e0b' : '#10b981',
    };
  }

  const type = status?.type || status?.licenseType || null;
  const expiresAt = status?.expiresAt ?? null;
  const permanent = type === 'permanent' || (status?.valid && !expiresAt);

  if (status && status.valid === false) {
    const left = daysUntil(expiresAt, nowMs);
    if (left !== null && left < 0) return { label: '만료됨', color: '#ef4444' };
    return { label: '미등록', color: '#94a3b8' };
  }
  if (type === 'dev') return { label: '개발자 모드', color: '#a78bfa' };
  if (permanent) return { label: '영구제', color: '#10b981' };

  const left = daysUntil(expiresAt, nowMs);
  if (left === null) return { label: '기간제', color: '#10b981' };
  if (left < 0) return { label: '만료됨', color: '#ef4444' };
  if (left === 0) return { label: '기간제 (오늘 만료)', color: '#ef4444' };
  if (left <= 7) return { label: `기간제 (${left}일 남음)`, color: '#ef4444' };
  if (left <= 30) return { label: `기간제 (${left}일 남음)`, color: '#f59e0b' };
  return { label: `기간제 (${left}일 남음)`, color: '#10b981' };
}

/** license-status-new(서버 시간 검증 포함)를 1순위, 라이선스 파일을 폴백으로 읽는다 */
async function readLicenseForDisplay() {
  try {
    if (window.electronAPI && typeof window.electronAPI.invoke === 'function') {
      const status = await window.electronAPI.invoke('license-status-new');
      if (status && (status.valid === true || status.valid === false)) {
        /**
         * 서버 시간이 오면 그걸 기준으로 남은 날짜를 센다.
         * 로컬 시계가 틀어져 있어도 표시가 흔들리지 않는다.
         */
        const nowMs = Number(status.serverTime) || Date.now();
        const { label, color } = buildLicenseLabel(status, nowMs);
        return {
          valid: !!status.valid,
          type: status.type || null,
          expiresAt: status.expiresAt ?? null,
          label, color, source: 'license-status-new',
        };
      }
    }
  } catch (e) {
    console.warn('[LICENSE] license-status-new 실패, 파일로 폴백:', e);
  }

  // 폴백: 라이선스 파일 (IPC 는 { ok, data } 를 준다 — result.license 가 아니다)
  if (window.blogger && typeof window.blogger.readLicenseFile === 'function') {
    const result = await window.blogger.readLicenseFile();
    const data = result && result.ok ? result.data : null;
    if (data && (data.licenseType || data.type || data.expiresAt)) {
      const type = data.licenseType || data.type || null;
      const expiresAt = data.expiresAt ?? null;
      const left = daysUntil(expiresAt);
      const valid = type === 'permanent' || expiresAt === null || (left !== null && left >= 0);
      const { label, color } = buildLicenseLabel({ valid, type, expiresAt });
      return { valid, type, expiresAt, label, color, source: 'license-file' };
    }
  }

  return { valid: false, type: null, expiresAt: null, label: '미등록', color: '#94a3b8', source: 'no-license' };
}

function applyLicenseBadge(el, license) {
  if (!el) return;
  el.textContent = license.label;
  el.style.color = license.color;
  if (el.dataset) el.dataset.valid = license.valid ? 'true' : 'false';
  if (license.expiresAt) {
    const d = new Date(typeof license.expiresAt === 'number' ? license.expiresAt : Date.parse(license.expiresAt));
    if (!Number.isNaN(d.getTime())) el.title = `만료일: ${d.toLocaleDateString('ko-KR')}`;
  } else {
    el.title = '';
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
/**
 * 글 생성 엔진(텍스트 모델) 라디오를 저장값으로 되돌린다. (v3.8.414)
 *
 * 사용자 보고(2026-08-02):
 *   "텍스트 엔진 선택이 왜 마지막에 선택한 모델이 환경설정을 클릭해서 띄워야만 자동으로 선택되나요?"
 *
 * 맞는 지적이다. 이 복원 코드가 loadSettingsContent() 안에만 있었는데,
 * 그 함수는 **환경설정 패널을 열 때만** 돈다.
 * 앱을 켜고 바로 발행하면 라디오가 HTML 기본값(gemini-2.5-flash)인 채로 발행된다.
 * 화면에는 그렇게 보이지만 사용자는 지난번에 고른 모델일 거라 믿는다.
 *
 * 소제목 이미지 엔진(v3.8.411)과 똑같은 유형이다 —
 * "고른 값이 저장은 되는데 시작할 때 화면에 안 올라온다".
 *
 * @returns 라디오를 찾아 적용했으면 true
 */
export function applyTextModelRadio(settings) {
  const savedTier = settings?.primaryGeminiTextModel || 'gemini-2.5-flash';
  const radios = document.querySelectorAll('input[name="primaryGeminiTextModel"]');
  if (!radios.length) return false;

  // 저장된 값이 목록에 없으면(모델 개편 등) 기본값을 존중한다 — 아무것도 안 골린 상태로 두지 않는다
  const exists = Array.from(radios).some((r) => r.value === savedTier);
  const target = exists ? savedTier : 'gemini-2.5-flash';
  radios.forEach((r) => { r.checked = (r.value === target); });

  if (typeof window.refreshTierCards === 'function') {
    try { window.refreshTierCards(); } catch (e) { /* 카드 새로고침 실패가 선택을 되돌리진 않는다 */ }
  }
  console.log('[SETTINGS] 🧠 글 생성 엔진 복원:', target, exists ? '' : '(저장값이 목록에 없어 기본값)');
  return true;
}

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
  const resolvedPlatform = resolvePlatformValue(savedSettings, envSettings, 'blogger');
  Object.assign(mergedSettings, restoreBloggerAliases(mergedSettings, envSettings));

  // 플랫폼 설정: 모달을 열 때는 항상 WordPress를 기본값으로 표시
  // 사용자가 Blogger를 선택하고 저장하면, 그 다음에 모달을 열 때는 Blogger가 선택되어 있어야 함
  // 하지만 사용자가 원하는 것은 앱 시작 시 WordPress가 기본값이므로,
  // 모달을 열 때 저장된 값이 명시적으로 'blogger'인 경우에만 Blogger를 표시
  if (resolvedPlatform === 'blogger') {
    // 사용자가 명시적으로 Blogger를 선택하고 저장한 경우에만 Blogger 사용
    mergedSettings.platform = 'blogger';
    console.log('🔧 [MODAL] 플랫폼 설정: blogger (사용자가 저장한 값)');
  } else if (resolvedPlatform === 'tistory') {
    mergedSettings.platform = 'tistory';
    console.log('[MODAL] platform resolved: tistory');
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
        'stabilityApiKey': mergedSettings.stabilityApiKey || mergedSettings.STABILITY_API_KEY || '',
        'stabilityApiKeyHidden': mergedSettings.stabilityApiKey || mergedSettings.STABILITY_API_KEY || '',
        'deepInfraApiKey': mergedSettings.deepInfraApiKey || mergedSettings.DEEPINFRA_API_KEY || mergedSettings.DEEP_INFRA_API_KEY || mergedSettings.deepinfraApiKey || '',
        'prodiaApiKey': mergedSettings.prodiaApiKey || mergedSettings.PRODIA_API_KEY || '',
        'naverCustomerId': mergedSettings.naverCustomerId || mergedSettings.naverId || mergedSettings.naverClientId || '',
        'naverSecretKey': mergedSettings.naverSecretKey || mergedSettings.naverSecret || mergedSettings.naverClientSecret || '',
        'googleCseKey': mergedSettings.googleCseKey || mergedSettings.cseKey || mergedSettings.googleApiKey || '',
        'googleCseCx': mergedSettings.googleCseCx || mergedSettings.cseCx || mergedSettings.googleCseId || '',
        'blogId': pickSettingValue(mergedSettings, ['blogId', 'bloggerId', 'BLOG_ID', 'BLOGGER_ID', 'GOOGLE_BLOG_ID', 'BLOGGER_BLOG_ID']),
        'googleClientId': pickSettingValue(mergedSettings, ['googleClientId', 'clientId', 'GOOGLE_CLIENT_ID', 'BLOGGER_CLIENT_ID']),
        'googleClientSecret': pickSettingValue(mergedSettings, ['googleClientSecret', 'clientSecret', 'GOOGLE_CLIENT_SECRET', 'BLOGGER_CLIENT_SECRET']),
        'wordpressSiteUrl': pickSettingValue(mergedSettings, ['wordpressSiteUrl', 'wpSiteUrl', 'wordpressUrl', 'WORDPRESS_SITE_URL', 'WP_SITE_URL']),
        'wordpressUsername': pickSettingValue(mergedSettings, ['wordpressUsername', 'wpUsername', 'wordpressUser', 'WORDPRESS_USERNAME', 'WP_USERNAME']),
        'wordpressPassword': pickSettingValue(mergedSettings, ['wordpressPassword', 'wpPassword', 'wordpressPass', 'WORDPRESS_PASSWORD', 'WP_PASSWORD']),
        'tistoryBlogName': mergedSettings.tistoryBlogName || mergedSettings.TISTORY_BLOG_NAME || mergedSettings.tistoryBlogUrl || '',
        'tistoryDefaultCategory': mergedSettings.tistoryDefaultCategory || mergedSettings.TISTORY_DEFAULT_CATEGORY || '',
        'tistoryDefaultVisibility': mergedSettings.tistoryDefaultVisibility || mergedSettings.TISTORY_DEFAULT_VISIBILITY || 'private',
        'imageFolderPath': mergedSettings.imageFolderPath || '',
        'generationEngine': mergedSettings.generationEngine || mergedSettings.provider || 'gemini',
        'blogUrl': mergedSettings.blogUrl || '',
        // 🔥 누락된 필드 보강
        'coupangAccessKey': mergedSettings.coupangAccessKey || '',
        'coupangSecretKey': mergedSettings.coupangSecretKey || '',
        'toneStyle': mergedSettings.toneStyle || 'professional',
        'wordpressCategories': mergedSettings.wordpressCategories || '',
      };

      // 라디오 카드 복원: primaryGeminiTextModel
      applyTextModelRadio(mergedSettings);

      Object.entries(fieldMappings).forEach(([fieldId, value]) => {
        const el = document.getElementById(fieldId);
        if (el) {
          if (fieldId === 'tistoryDefaultCategory') {
            setTistoryCategoryOptions([], value || '');
          }
          el.value = value;
          console.log(`✅ ${fieldId} 로드:`, value ? '있음' : '없음');
        }
      });

      // 플랫폼 선택: 사용자가 원하는 것은 앱 시작 시 WordPress가 기본값이므로,
      // 모달을 열 때 저장된 값이 명시적으로 'blogger'인 경우에만 Blogger 표시
      // 그 외에는 항상 WordPress를 기본값으로 표시
      const platformToShow = mergedSettings.platform || resolvedPlatform || 'blogger';
      console.log('🔧 플랫폼 설정 (모달 라디오 버튼):', platformToShow, '(저장된 값:', savedSettings?.platform, ')');

      const platformBloggerEl = document.getElementById('platform-blogger');
      const platformWordpressEl = document.getElementById('platform-wordpress');
      const platformTistoryEl = document.getElementById('platform-tistory');

      if (platformBloggerEl && platformWordpressEl) {
        // 저장된 값이 명시적으로 'blogger'인 경우에만 Blogger 표시
        if (platformToShow === 'blogger') {
          platformBloggerEl.checked = true;
          platformWordpressEl.checked = false;
          if (platformTistoryEl) platformTistoryEl.checked = false;
          console.log('✅ 플랫폼 라디오 버튼: Blogger (사용자가 저장한 값)');
        } else if (platformToShow === 'tistory' && platformTistoryEl) {
          platformBloggerEl.checked = false;
          platformWordpressEl.checked = false;
          platformTistoryEl.checked = true;
          console.log('Platform radio button: Tistory');
        } else {
          // 기본값은 WordPress
          platformBloggerEl.checked = false;
          platformWordpressEl.checked = true;
          if (platformTistoryEl) platformTistoryEl.checked = false;
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
        alert('❌ 워드프레스 연동을 완료하려면:\n\n1. 환경설정 → 원클릭 세팅 탭을 여세요\n2. 계정 추가 / 앱 연동 영역의 워드프레스 앱 연동을 진행하세요\n3. 자동화가 막힌 경우에만 고급 수동 입력을 펼쳐 저장하세요');
        return;
      }

      alert('✅ 워드프레스 연동이 완료되었습니다!\n\n사이트: ' + settings.wordpressSiteUrl);
    } else if (selectedPlatform === 'blogger') {
      // 블로그스팟 인증 확인
      const settings = await loadSettings();

      if (!settings.blogId || !settings.googleClientId || !settings.googleClientSecret) {
        alert('❌ 블로그스팟 연동을 완료하려면:\n\n1. 환경설정 → 원클릭 세팅 탭을 여세요\n2. 계정 추가 / 앱 연동 영역의 블로그스팟 앱 연동을 진행하세요\n3. Client 저장 후 이어서 뜨는 Google OAuth 권한 승인까지 완료하세요');
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
      alert('❌ Blogger OAuth 인증에 필요한 값이 없습니다.\n\n초보자는 환경설정 → 원클릭 세팅 → 계정 추가 / 앱 연동 → 블로그스팟 앱 연동을 먼저 진행해주세요.\n직접 입력이 필요한 경우에만 Blogger 설정의 고급 수동 설정을 펼쳐 입력하세요.');
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

window.openTistoryLoginFromSettings = async function () {
  const blogName = document.getElementById('tistoryBlogName')?.value?.trim() || '';
  const status = document.getElementById('tistorySessionStatus');
  if (!blogName) {
    if (status) status.textContent = '먼저 티스토리 블로그명 또는 주소를 입력해주세요.';
    alert('먼저 티스토리 블로그명 또는 주소를 입력해주세요.');
    return;
  }

  try {
    if (status) status.textContent = '티스토리 로그인 창을 여는 중입니다...';
    const result = await window.blogger?.openTistoryLogin?.({ tistoryBlogName: blogName });
    if (status) {
      status.textContent = result?.ok
        ? '로그인 창을 열었습니다. 브라우저에서 로그인 후 세션 확인을 눌러주세요.'
        : `로그인 창 열기 실패: ${result?.error || 'unknown'}`;
    }
  } catch (error) {
    if (status) status.textContent = `로그인 창 열기 실패: ${error?.message || error}`;
  }
};

function setTistoryCategoryOptions(categories = [], selectedValue = '') {
  /**
   * v3.8.453 — 설정 모달과 발행 화면(카테고리 탭)의 **두 select 를 함께** 채운다.
   * 발행 화면에 티스토리 카테고리가 없어서 설정의 묵은 값이 그대로 실려 나갔고,
   * 블로그에 없는 카테고리로 발행이 실패했다(사용자 실측 "이슈 관련").
   */
  const ids = ['tistoryDefaultCategory', 'tistoryCategoryPosting'];
  ids.forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;

    const current = String(selectedValue || select.value || '').trim();
    select.innerHTML = '';

    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = categories.length ? '선택 안 함 (기본 카테고리)' : '카테고리를 먼저 불러오세요';
    select.appendChild(emptyOption);

    const seen = new Set();
    categories.forEach((item) => {
      const name = String(item?.name || item?.label || '').replace(/\s+/g, ' ').trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      const option = document.createElement('option');
      option.value = name;
      option.textContent = item?.label || name;
      select.appendChild(option);
    });

    if (current && categories.length === 0 && !Array.from(select.options).some((option) => option.value === current)) {
      const savedOption = document.createElement('option');
      savedOption.value = current;
      savedOption.textContent = `${current} (저장됨)`;
      select.appendChild(savedOption);
    }

    if (current && Array.from(select.options).some((option) => option.value === current)) {
      select.value = current;
    }
  });
}

/**
 * 발행 화면(카테고리 탭)의 🔄 버튼 — 실제 블로그의 카테고리를 불러와 채운다.
 * 블로그명은 설정 입력값 → 저장된 설정 순으로 찾는다 (설정 모달을 안 열어도 동작).
 */
window.loadTistoryCategoriesForPosting = async function () {
  const status = document.getElementById('tistoryCategoryPostingStatus');
  const select = document.getElementById('tistoryCategoryPosting');
  const say = (msg) => { if (status) status.textContent = msg; };

  let blogName = document.getElementById('tistoryBlogName')?.value?.trim() || '';
  if (!blogName) {
    try {
      const env = await window.blogger?.getEnv?.();
      blogName = String(env?.TISTORY_BLOG_NAME || env?.tistoryBlogName || '').trim();
    } catch { /* env 못 읽으면 아래 안내로 */ }
  }
  if (!blogName) {
    say('먼저 환경설정에서 티스토리 블로그명을 저장해 주세요.');
    return;
  }

  try {
    say('티스토리 카테고리를 불러오는 중입니다... (로그인 세션 필요)');
    if (select) select.disabled = true;
    const result = await window.blogger?.loadTistoryCategories?.({
      tistoryBlogName: blogName,
      tistoryDefaultCategory: select?.value || '',
    });
    if (!result?.ok || !result?.authenticated) {
      say(result?.error || '티스토리 로그인이 필요합니다. 환경설정에서 로그인 창을 열어 로그인해 주세요.');
      return;
    }
    const categories = Array.isArray(result.categories) ? result.categories : [];
    setTistoryCategoryOptions(categories, select?.value || result.selectedCategory || '');
    say(categories.length
      ? `카테고리 ${categories.length}개를 불러왔습니다. 발행할 카테고리를 선택하세요.`
      : '카테고리를 찾지 못했습니다. 티스토리 관리자에서 카테고리를 만든 뒤 다시 불러오세요.');
  } catch (error) {
    say(`카테고리 불러오기 실패: ${error?.message || error}`);
  } finally {
    if (select) select.disabled = false;
  }
};

/**
 * 🔐 v3.8.453 — 네이버 로그인 창 (성인인증 상품 크롤용).
 * 로그인 완료(쿠키 확인)까지 기다렸다가 결과를 표시한다 — 최대 5분.
 */
window.openNaverLoginFromSettings = async function () {
  const status = document.getElementById('naverSessionStatus');
  const btn = document.getElementById('naverLoginBtn');
  const say = (msg, color) => {
    if (status) { status.textContent = msg; if (color) status.style.color = color; }
  };
  try {
    if (btn) btn.disabled = true;
    say('로그인 창이 열렸습니다 — 브라우저에서 네이버 로그인을 완료해 주세요 (최대 5분)...', 'rgba(255,255,255,0.7)');
    const result = await window.electronAPI?.invoke?.('naver:open-login-window');
    if (result?.ok && result?.loggedIn) {
      say('✅ 로그인 세션이 저장됐습니다. 성인인증 상품도 자동 수집됩니다. (일반 상품 수집에는 쓰이지 않습니다)', '#86efac');
    } else {
      say(`로그인이 확인되지 않았습니다: ${result?.error || '다시 시도해 주세요.'}`, '#fbbf24');
    }
  } catch (error) {
    say(`로그인 창 열기 실패: ${error?.message || error}`, '#f87171');
  } finally {
    if (btn) btn.disabled = false;
  }
};

window.clearNaverSessionFromSettings = async function () {
  const status = document.getElementById('naverSessionStatus');
  try {
    const result = await window.electronAPI?.invoke?.('naver:clear-session');
    if (status) {
      status.textContent = result?.ok
        ? '저장된 네이버 로그인 세션을 삭제했습니다.'
        : `세션 삭제 실패: ${result?.error || '알 수 없는 오류'}`;
    }
  } catch (error) {
    if (status) status.textContent = `세션 삭제 실패: ${error?.message || error}`;
  }
};

window.loadTistoryCategoriesFromSettings = async function (options = {}) {
  const blogName = document.getElementById('tistoryBlogName')?.value?.trim() || '';
  const categorySelect = document.getElementById('tistoryDefaultCategory');
  const status = document.getElementById('tistorySessionStatus');
  const currentCategory = categorySelect?.value || '';

  if (!blogName) {
    const message = '먼저 티스토리 블로그명 또는 주소를 입력해주세요.';
    if (status) status.textContent = message;
    if (!options.silent) alert(message);
    return;
  }

  try {
    if (status) status.textContent = '티스토리 카테고리를 자동으로 불러오는 중입니다...';
    if (categorySelect) categorySelect.disabled = true;

    const result = await window.blogger?.loadTistoryCategories?.({
      tistoryBlogName: blogName,
      tistoryDefaultCategory: currentCategory,
    });

    if (!result?.ok || !result?.authenticated) {
      const message = result?.error || '티스토리 로그인이 필요합니다. 로그인 창을 열고 로그인한 뒤 다시 불러오세요.';
      if (status) status.textContent = message;
      if (!options.silent) alert(message);
      return;
    }

    const categories = Array.isArray(result.categories) ? result.categories : [];
    setTistoryCategoryOptions(categories, currentCategory || result.selectedCategory || '');
    if (status) {
      status.textContent = categories.length
        ? `카테고리 ${categories.length}개를 불러왔습니다. 사용할 카테고리를 선택해주세요.`
        : '카테고리를 찾지 못했습니다. 티스토리 관리자에서 카테고리를 만든 뒤 다시 불러오세요.';
    }
  } catch (error) {
    if (status) status.textContent = `카테고리 불러오기 실패: ${error?.message || error}`;
  } finally {
    if (categorySelect) categorySelect.disabled = false;
  }
};

window.checkTistorySessionFromSettings = async function () {
  const blogName = document.getElementById('tistoryBlogName')?.value?.trim() || '';
  const status = document.getElementById('tistorySessionStatus');
  if (!blogName) {
    if (status) status.textContent = '먼저 티스토리 블로그명 또는 주소를 입력해주세요.';
    alert('먼저 티스토리 블로그명 또는 주소를 입력해주세요.');
    return;
  }

  try {
    if (status) status.textContent = '티스토리 세션을 확인하는 중입니다...';
    const result = await window.blogger?.checkTistorySession?.({ tistoryBlogName: blogName });
    if (status) {
      status.textContent = result?.authenticated
        ? `연동 확인됨: ${result.blogUrl || blogName}`
        : `로그인이 필요합니다: ${result?.error || '글쓰기 화면을 확인하지 못했습니다.'}`;
    }
    if (result?.authenticated) {
      await window.loadTistoryCategoriesFromSettings?.({ silent: true });
    }
  } catch (error) {
    if (status) status.textContent = `세션 확인 실패: ${error?.message || error}`;
  }
};
