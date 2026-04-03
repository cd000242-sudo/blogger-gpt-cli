/**
 * Blogger Publisher - Error Handler Module
 * 에러 진단, 분류, 해결 방법 제시를 담당하는 모듈
 */

const { BLOGGER_ERROR_TYPES } = require('./constants');

/**
 * Blogger 에러 진단 및 해결 방법 제시
 * @param {Error} error - 발생한 에러 객체
 * @param {Function} onLog - 로그 콜백 함수
 * @returns {Object} - {errorType, solution, urgent}
 */
function diagnoseBloggerError(error, onLog) {
  const errorMessage = error.message || error.toString();
  const lowerMessage = errorMessage.toLowerCase();

  let errorType = BLOGGER_ERROR_TYPES.UNKNOWN_ERROR;
  let solution = '';
  let urgent = false;

  // 토큰 만료 에러
  if (lowerMessage.includes('token expired') ||
      lowerMessage.includes('invalid token') ||
      lowerMessage.includes('token has expired')) {
    errorType = BLOGGER_ERROR_TYPES.TOKEN_EXPIRED;
    solution = 'Blogger 설정에서 재인증을 진행해주세요.';
    urgent = true;
  }
  // 할당량 초과 에러
  else if (lowerMessage.includes('quota exceeded') ||
           lowerMessage.includes('rate limit') ||
           lowerMessage.includes('too many requests')) {
    errorType = BLOGGER_ERROR_TYPES.QUOTA_EXCEEDED;
    solution = '잠시 후 다시 시도하거나, Blogger API 할당량을 확인해주세요.';
    urgent = false;
  }
  // 네트워크 에러
  else if (lowerMessage.includes('network') ||
           lowerMessage.includes('timeout') ||
           lowerMessage.includes('connection')) {
    errorType = BLOGGER_ERROR_TYPES.NETWORK_ERROR;
    solution = '인터넷 연결을 확인하고 잠시 후 다시 시도해주세요.';
    urgent = false;
  }
  // 블로그 없음 에러
  else if (lowerMessage.includes('blog not found') ||
           lowerMessage.includes('invalid blog id')) {
    errorType = BLOGGER_ERROR_TYPES.BLOG_NOT_FOUND;
    solution = 'Blogger 설정에서 올바른 블로그 ID를 확인해주세요.';
    urgent = true;
  }
  // 권한 부족 에러
  else if (lowerMessage.includes('permission denied') ||
           lowerMessage.includes('forbidden') ||
           lowerMessage.includes('unauthorized')) {
    errorType = BLOGGER_ERROR_TYPES.PERMISSION_DENIED;
    solution = 'Blogger API 권한을 다시 확인해주세요.';
    urgent = true;
  }
  // 잘못된 요청 에러
  else if (lowerMessage.includes('bad request') ||
           lowerMessage.includes('invalid request')) {
    errorType = BLOGGER_ERROR_TYPES.INVALID_REQUEST;
    solution = '요청 데이터를 확인해주세요.';
    urgent = false;
  }

  const logMessage = `❌ Blogger 에러 감지: ${errorType.replace('_', ' ').toUpperCase()}\n💡 해결 방법: ${solution}`;

  if (urgent) {
    onLog?.(`${logMessage}\n🚨 긴급: 즉시 조치가 필요합니다!`);
  } else {
    onLog?.(logMessage);
  }

  return { errorType, solution, urgent };
}

/**
 * 에러 메시지 포맷팅
 * @param {Error} error - 에러 객체
 * @returns {Object} - {errorMessage, errorCode, errorResponse}
 */
function formatErrorDetails(error) {
  const errorMessage = error?.message || String(error);
  const errorCode = error?.code || error?.status || 'N/A';
  const errorResponse = error?.response?.data 
    ? JSON.stringify(error.response.data).substring(0, 300) 
    : '없음';
  
  return { errorMessage, errorCode, errorResponse };
}

/**
 * 상세 에러 로깅
 * @param {string} context - 에러 발생 컨텍스트
 * @param {Error} error - 에러 객체
 * @param {Object} additionalInfo - 추가 정보
 */
function logDetailedError(context, error, additionalInfo = {}) {
  const { errorMessage, errorCode, errorResponse } = formatErrorDetails(error);
  
  console.error(`[${context}] ❌ 오류 발생:`);
  console.error(`[${context}]    - 오류 메시지: ${errorMessage}`);
  console.error(`[${context}]    - 오류 코드: ${errorCode}`);
  console.error(`[${context}]    - 응답 데이터: ${errorResponse}`);
  
  // 추가 정보 로깅
  Object.entries(additionalInfo).forEach(([key, value]) => {
    console.error(`[${context}]    - ${key}: ${value}`);
  });
}

module.exports = {
  diagnoseBloggerError,
  formatErrorDetails,
  logDetailedError
};





