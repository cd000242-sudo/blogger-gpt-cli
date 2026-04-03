/**
 * Blogger Publisher - Authentication Module
 * Blogger OAuth2 인증 및 토큰 관리를 담당하는 모듈
 */

const fs = require('fs');
const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');
const { 
  AUTH_CACHE_TTL, 
  TOKEN_FILE_NAME,
  OAUTH_CONFIG 
} = require('./constants');
const { 
  getTokenFilePath, 
  getEnvFilePath,
  safeJsonParse,
  parseEnvFile,
  loadEnvironmentVariables
} = require('./utils');

// 인증 상태 캐시 (성능 최적화)
let authCache = {
  data: null,
  timestamp: 0,
  ttl: AUTH_CACHE_TTL
};

/**
 * 인증 캐시 무효화 함수 (토큰 갱신 시 사용)
 */
function clearAuthCache() {
  authCache.data = null;
  authCache.timestamp = 0;
  console.log('[AUTH] 캐시 무효화됨');
}

/**
 * 블로거 인증 상태 확인 함수 (캐싱 최적화)
 * @returns {Promise<Object>} - {authenticated, error?, tokenData?, needsRefresh?}
 */
async function checkBloggerAuthStatus() {
  try {
    const now = Date.now();
    
    // 캐시된 인증 상태 사용
    if (authCache.data && (now - authCache.timestamp) < authCache.ttl) {
      console.log('[AUTH] 캐시된 인증 상태 사용');
      return authCache.data;
    }

    // 브라우저 환경에서 window.blogger API 사용
    if (typeof window !== 'undefined' && window.blogger) {
      const checkAuth = window.blogger.checkBloggerAuthStatus || window.blogger.checkBloggerAuth;
      if (checkAuth) {
        const result = await checkAuth();
        authCache.data = result;
        authCache.timestamp = now;
        return result;
      }
    }
    
    const tokenPath = getTokenFilePath();
    console.log('[AUTH] 토큰 파일 경로:', tokenPath);
    
    // 토큰 파일 존재 확인
    if (!fs.existsSync(tokenPath)) {
      console.log('[AUTH] 토큰 파일이 존재하지 않습니다:', tokenPath);
      const result = { 
        authenticated: false, 
        error: '토큰 파일이 없습니다. 환경설정에서 Blogger OAuth2 인증을 진행해주세요.' 
      };
      authCache.data = result;
      authCache.timestamp = now;
      return result;
    }
    
    // 토큰 파일 읽기 및 파싱
    let tokenData;
    try {
      const tokenFileContent = fs.readFileSync(tokenPath, 'utf8');
      tokenData = safeJsonParse(tokenFileContent, '토큰 파일');
      
      if (!tokenData) {
        const result = { 
          authenticated: false, 
          error: '토큰 파일이 손상되었습니다. 환경설정에서 인증을 다시 진행해주세요.' 
        };
        authCache.data = result;
        authCache.timestamp = now;
        return result;
      }
    } catch (parseError) {
      const result = { 
        authenticated: false, 
        error: `토큰 파일 파싱 실패: ${parseError?.message || parseError}` 
      };
      authCache.data = result;
      authCache.timestamp = now;
      return result;
    }
    
    // 액세스 토큰 확인
    if (!tokenData.access_token) {
      const result = { authenticated: false, error: '액세스 토큰이 없습니다.' };
      authCache.data = result;
      authCache.timestamp = now;
      return result;
    }
    
    // 토큰 만료 시간 확인 (expires_at 필드)
    if (tokenData.expires_at && Date.now() > tokenData.expires_at) {
      if (tokenData.refresh_token) {
        console.log('[AUTH] 토큰 만료되었지만 refresh_token이 있어 갱신 가능');
        const result = { authenticated: true, tokenData, needsRefresh: true };
        authCache.data = result;
        authCache.timestamp = now;
        return result;
      } else {
        const result = { authenticated: false, error: '토큰이 만료되었습니다. 재인증이 필요합니다.' };
        authCache.data = result;
        authCache.timestamp = now;
        return result;
      }
    }
    
    // 토큰 수정 시간 기준 빠른 체크 (성능 최적화)
    const tokenModifiedTime = fs.statSync(tokenPath).mtimeMs;
    const tokenAge = now - tokenModifiedTime;
    
    // 1시간 이내에 생성/갱신된 토큰은 유효하다고 가정 (API 호출 생략)
    if (tokenAge < 3600000) {
      const result = { authenticated: true, tokenData };
      authCache.data = result;
      authCache.timestamp = now;
      return result;
    }
    
    // 오래된 토큰은 실제 검증 수행
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3초 타임아웃
      
      const response = await fetch(OAUTH_CONFIG.USER_INFO_URL, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const result = { authenticated: true, tokenData };
        authCache.data = result;
        authCache.timestamp = now;
        return result;
      } else if (response.status === 401) {
        const result = { authenticated: false, error: '토큰이 만료되었습니다.' };
        authCache.data = result;
        authCache.timestamp = now;
        return result;
      } else {
        const result = { authenticated: false, error: `API 호출 실패 (${response.status})` };
        authCache.data = result;
        authCache.timestamp = now;
        return result;
      }
    } catch (apiError) {
      // 네트워크 오류나 타임아웃 시 기존 토큰 사용
      if (apiError.name === 'AbortError') {
        console.log('[AUTH] 토큰 검증 타임아웃, 캐시된 상태 사용');
        return authCache.data || { authenticated: true, tokenData };
      }
      console.error('[AUTH] 토큰 유효성 검증 실패:', apiError);
      const result = { authenticated: false, error: '토큰 유효성 검증 실패' };
      authCache.data = result;
      authCache.timestamp = now;
      return result;
    }
    
  } catch (error) {
    console.error('[AUTH] checkBloggerAuthStatus 오류:', error);
    const result = { 
      authenticated: false, 
      error: error?.message || '인증 상태 확인 실패' 
    };
    authCache.data = result;
    authCache.timestamp = Date.now();
    return result;
  }
}

/**
 * Blogger OAuth2 인증 URL 생성
 * @param {Object} payload - {googleClientId}
 * @returns {string|null} - 인증 URL 또는 null
 */
function getBloggerAuthUrl(payload) {
  try {
    if (!payload) {
      console.error('[AUTH] payload가 제공되지 않았습니다.');
      return null;
    }
    
    const envVars = loadEnvironmentVariables();
    const clientId = String(
      payload.googleClientId || 
      envVars.GOOGLE_CLIENT_ID || 
      process.env.GOOGLE_CLIENT_ID || 
      ''
    ).trim();
    
    if (!clientId) {
      console.error('[AUTH] Google Client ID가 설정되지 않았습니다.');
      return null;
    }
    
    // OAuth2 v2 엔드포인트 사용
    const authUrl = `${OAUTH_CONFIG.AUTH_URL_BASE}?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(OAUTH_CONFIG.REDIRECT_URI)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(OAUTH_CONFIG.SCOPE)}&` +
      `access_type=offline&` +
      `prompt=consent`;
    
    return authUrl;
  } catch (error) {
    console.error('[AUTH] 인증 URL 생성 오류:', error);
    return null;
  }
}

/**
 * Blogger 블로그 정보 가져오기
 * @param {Object} payload - {blogId, googleClientId, googleClientSecret, googleRefreshToken}
 * @param {Function} onLog - 로그 콜백 함수
 * @returns {Promise<Object>} - {ok, blog?, error?}
 */
async function getBloggerInfo(payload, onLog) {
  try {
    if (!payload) {
      return {
        ok: false,
        error: 'payload가 제공되지 않았습니다.'
      };
    }
    
    const blogId = String(payload.blogId || '').trim();
    const clientId = String(payload.googleClientId || '').trim();
    const clientSecret = String(payload.googleClientSecret || '').trim();
    
    if (!blogId) {
      return {
        ok: false,
        error: 'Blog ID가 설정되지 않았습니다.'
      };
    }
    
    if (!clientId || !clientSecret) {
      return {
        ok: false,
        error: 'Google OAuth2 Client ID/Secret이 설정되지 않았습니다.'
      };
    }
    
    const auth = new GoogleAuth({
      credentials: {
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: payload.googleRefreshToken || null
      },
      scopes: [OAUTH_CONFIG.SCOPE]
    });

    const blogger = google.blogger({ version: 'v3', auth });
    
    onLog?.('📋 Blogger 블로그 정보 조회 중...');
    
    const response = await blogger.blogs.get({
      blogId: blogId
    });
    
    if (response.data) {
      return {
        ok: true,
        blog: {
          id: response.data.id,
          name: response.data.name,
          url: response.data.url,
          description: response.data.description
        }
      };
    } else {
      throw new Error('블로그 정보를 가져올 수 없습니다');
    }
  } catch (error) {
    const errorMessage = error?.message || String(error);
    onLog?.(`❌ Blogger 정보 조회 실패: ${errorMessage}`);
    return {
      ok: false,
      error: errorMessage
    };
  }
}

/**
 * 토큰 갱신 (Refresh Token 사용)
 * @param {string} refreshToken - Refresh Token
 * @param {string} clientId - Google Client ID
 * @param {string} clientSecret - Google Client Secret
 * @returns {Promise<Object>} - {ok, tokenData?, error?}
 */
async function refreshAccessToken(refreshToken, clientId, clientSecret) {
  try {
    const response = await fetch(OAUTH_CONFIG.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });
    
    if (response.ok) {
      const responseText = await response.text();
      const newTokenData = safeJsonParse(responseText, '토큰 갱신 응답');
      
      if (!newTokenData) {
        return {
          ok: false,
          error: '토큰 갱신 응답 파싱 실패'
        };
      }
      
      if (newTokenData.error) {
        return {
          ok: false,
          error: `토큰 갱신 실패: ${newTokenData.error_description || newTokenData.error}`
        };
      }
      
      // expires_at 계산
      if (newTokenData.expires_in) {
        newTokenData.expires_at = Date.now() + (newTokenData.expires_in * 1000);
      }
      
      // refresh_token 유지 (새 응답에 없을 수 있음)
      if (!newTokenData.refresh_token) {
        newTokenData.refresh_token = refreshToken;
      }
      
      console.log('[AUTH] ✅ 토큰 갱신 성공');
      
      return {
        ok: true,
        tokenData: newTokenData
      };
    } else {
      const errorText = await response.text();
      return {
        ok: false,
        error: `토큰 갱신 실패 (HTTP ${response.status}): ${errorText}`
      };
    }
  } catch (error) {
    console.error('[AUTH] 토큰 갱신 오류:', error);
    return {
      ok: false,
      error: error?.message || '토큰 갱신 중 오류 발생'
    };
  }
}

/**
 * 토큰 저장
 * @param {Object} tokenData - 토큰 데이터
 * @returns {boolean} - 성공 여부
 */
function saveTokenData(tokenData) {
  try {
    const tokenPath = getTokenFilePath();
    fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2), 'utf8');
    console.log('[AUTH] 토큰 파일 저장 완료:', tokenPath);
    clearAuthCache(); // 캐시 무효화
    return true;
  } catch (error) {
    console.error('[AUTH] 토큰 파일 저장 실패:', error);
    return false;
  }
}

module.exports = {
  checkBloggerAuthStatus,
  clearAuthCache,
  getBloggerAuthUrl,
  getBloggerInfo,
  refreshAccessToken,
  saveTokenData
};





