/**
 * Blogger Publisher - Utilities Module
 * 공통 유틸리티 함수들을 관리하는 모듈
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

/**
 * 환경변수 로드 헬퍼 함수
 * @returns {Object} - 환경변수 객체
 */
function loadEnvironmentVariables() {
  try {
    try {
      const { app } = require('electron');
      const envPath = path.join(app.getPath('userData'), '.env');
      if (fs.existsSync(envPath)) {
        return dotenv.parse(fs.readFileSync(envPath, 'utf8'));
      }
    } catch (e) {
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        return dotenv.parse(fs.readFileSync(envPath, 'utf8'));
      }
    }
  } catch (e) {
    console.warn('[ENV] 환경변수 파일 로드 실패:', e.message);
  }
  return {};
}

/**
 * 텍스트 길이 계산 헬퍼 함수 (HTML 태그 제외)
 * @param {string} htmlStr - HTML 문자열
 * @returns {string} - 순수 텍스트
 */
function calculateTextLength(htmlStr) {
  let text = htmlStr.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<[^>]*>/g, '');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

/**
 * HTML 특수 문자 이스케이프 함수 (이모지 포함)
 * @param {string} htmlStr - HTML 문자열
 * @returns {string} - 이스케이프된 HTML 문자열
 */
function escapeHtmlSpecialChars(htmlStr) {
  const emojiMap = {
    '📊': '&#128202;', '📈': '&#128200;', '📉': '&#128201;', '🥧': '&#129383;',
    '📖': '&#128214;', '💬': '&#128172;', '🔗': '&#128279;', '✅': '&#9989;',
    '🔄': '&#128257;', '🎯': '&#127919;', '🚀': '&#128640;', '📱': '&#128241;',
    '🎨': '&#127912;', '📐': '&#128208;', '🔧': '&#128295;', '⚙️': '&#9881;',
    '💡': '&#128161;', '⭐': '&#11088;', '🎉': '&#127881;', '📝': '&#128221;',
    '🖼️': '&#128444;', '📅': '&#128197;', '🆔': '&#127358;', '📄': '&#128196;',
    '📏': '&#128207;', '⏱️': '&#9203;', '🔑': '&#128273;', '🔐': '&#128274;',
    '📤': '&#128228;', '🏷️': '&#127991;', '⚠️': '&#9888;', '❌': '&#10060;',
    '💾': '&#128190;'
  };

  let result = htmlStr.replace(/&(?![a-zA-Z0-9#]{1,7};)/g, '&amp;');
  
  // 이모지 변환
  Object.entries(emojiMap).forEach(([emoji, entity]) => {
    result = result.replace(new RegExp(emoji, 'g'), entity);
  });
  
  return result;
}

/**
 * 플랫폼별 사용자 데이터 경로 가져오기
 * @returns {string} - 사용자 데이터 경로
 */
function getUserDataPath() {
  try {
    const { app } = require('electron');
    return app.getPath('userData');
  } catch (e) {
    // Electron이 없으면 직접 경로 계산
    if (process.platform === 'win32') {
      return path.join(process.env.APPDATA || process.env.USERPROFILE || '', 'blogger-gpt-cli');
    } else if (process.platform === 'darwin') {
      return path.join(process.env.HOME || '', 'Library', 'Application Support', 'blogger-gpt-cli');
    } else {
      return path.join(process.env.HOME || process.env.XDG_CONFIG_HOME || '', '.config', 'blogger-gpt-cli');
    }
  }
}

/**
 * 토큰 파일 경로 가져오기
 * @returns {string} - 토큰 파일 경로
 */
function getTokenFilePath() {
  return path.join(getUserDataPath(), 'blogger-token.json');
}

/**
 * .env 파일 경로 가져오기
 * @returns {string} - .env 파일 경로
 */
function getEnvFilePath() {
  return path.join(getUserDataPath(), '.env');
}

/**
 * 안전한 JSON 파싱
 * @param {string} jsonString - JSON 문자열
 * @param {string} context - 컨텍스트 (에러 메시지용)
 * @returns {Object|null} - 파싱된 객체 또는 null
 */
function safeJsonParse(jsonString, context = 'JSON') {
  try {
    if (!jsonString || jsonString.trim().length === 0) {
      throw new Error(`${context} 파일이 비어있습니다.`);
    }
    
    const trimmed = jsonString.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      throw new Error(`${context}가 유효한 JSON 형식이 아닙니다. 시작 문자: "${trimmed.substring(0, 10)}"`);
    }
    
    return JSON.parse(jsonString);
  } catch (error) {
    console.error(`[PARSE] ${context} 파싱 오류:`, error.message);
    return null;
  }
}

/**
 * .env 파일 파싱
 * @param {string} envContent - .env 파일 내용
 * @returns {Object} - 환경변수 객체
 */
function parseEnvFile(envContent) {
  const envVars = {};
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.+)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      envVars[key] = value;
    }
  });
  return envVars;
}

/**
 * .env 파일에서 환경변수 로드
 * @returns {Object} - 환경변수 객체
 */
function loadEnvFromFile() {
  try {
    const envPath = getEnvFilePath();
    
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const envVars = parseEnvFile(envContent);
      console.log('[ENV] .env 파일에서 환경변수 로드 완료');
      return envVars;
    }
  } catch (error) {
    console.warn('[ENV] .env 파일 로드 실패:', error?.message || error);
  }
  return {};
}

/**
 * 크기 정보 포맷팅 (바이트 -> KB/MB)
 * @param {number} bytes - 바이트 크기
 * @returns {string} - 포맷된 크기 문자열
 */
function formatSize(bytes) {
  if (bytes < 1024) {
    return `${bytes}B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)}KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  }
}

/**
 * 시간 차이 포맷팅 (밀리초 -> 분/시간)
 * @param {number} ms - 밀리초
 * @returns {string} - 포맷된 시간 문자열
 */
function formatTimeDiff(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}시간 ${minutes % 60}분`;
  } else if (minutes > 0) {
    return `${minutes}분`;
  } else {
    return `${seconds}초`;
  }
}

module.exports = {
  loadEnvironmentVariables,
  calculateTextLength,
  escapeHtmlSpecialChars,
  getUserDataPath,
  getTokenFilePath,
  getEnvFilePath,
  safeJsonParse,
  parseEnvFile,
  loadEnvFromFile,
  formatSize,
  formatTimeDiff
};





