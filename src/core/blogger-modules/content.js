/**
 * Blogger Publisher - Content Module
 * 콘텐츠 검증, 처리, CTA 추가 등을 담당하는 모듈
 */

const { 
  BLOGGER_TEXT_LIMIT, 
  BLOGGER_HTML_LIMIT,
  MAX_TITLE_LENGTH 
} = require('./constants');
const { calculateTextLength } = require('./utils');

/**
 * 임시 CTA 추가 함수 (content-generators 모듈이 없을 경우 대체)
 * @param {string} content - HTML 콘텐츠
 * @param {number} maxCount - 최대 CTA 개수
 * @returns {string} - CTA가 추가된 콘텐츠
 */
function addAutoCTAs(content, maxCount) {
  console.log(`[CONTENT] 임시 CTA 추가: 최대 ${maxCount}개`);
  return content; // 원본 콘텐츠 그대로 반환
}

/**
 * 제목 검증
 * @param {string} title - 제목
 * @returns {Object} - {ok, error?}
 */
function validateTitle(title) {
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return {
      ok: false,
      error: '제목이 비어있습니다. 제목을 입력해주세요.'
    };
  }
  
  if (title.length > MAX_TITLE_LENGTH) {
    return {
      ok: false,
      error: `제목이 너무 깁니다. (${title.length}자 / 최대 ${MAX_TITLE_LENGTH}자)`
    };
  }
  
  return { ok: true };
}

/**
 * HTML 콘텐츠 검증
 * @param {string} html - HTML 콘텐츠
 * @returns {Object} - {ok, error?}
 */
function validateHtml(html) {
  if (!html || typeof html !== 'string' || html.trim().length === 0) {
    return {
      ok: false,
      error: '콘텐츠가 비어있습니다. 콘텐츠를 입력해주세요.'
    };
  }
  
  return { ok: true };
}

/**
 * 콘텐츠 크기 분석
 * @param {string} html - HTML 콘텐츠
 * @returns {Object} - {textLength, htmlLength, cssLength, textUsagePercent, htmlUsagePercent}
 */
function analyzeContentSize(html) {
  const textLength = calculateTextLength(html).length;
  const htmlLength = html?.length || 0;
  const cssMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const cssLength = cssMatch && cssMatch[1] ? cssMatch[1].length : 0;
  
  const textUsagePercent = ((textLength / BLOGGER_TEXT_LIMIT) * 100).toFixed(1);
  const htmlUsagePercent = ((htmlLength / BLOGGER_HTML_LIMIT) * 100).toFixed(1);
  
  return {
    textLength,
    htmlLength,
    cssLength,
    textUsagePercent,
    htmlUsagePercent
  };
}

/**
 * 콘텐츠 크기 검증 및 경고
 * @param {string} html - HTML 콘텐츠
 * @param {Function} onLog - 로그 콜백 함수
 * @returns {Object} - {ok, warnings[]}
 */
function validateContentSize(html, onLog) {
  const { 
    textLength, 
    htmlLength, 
    cssLength, 
    textUsagePercent, 
    htmlUsagePercent 
  } = analyzeContentSize(html);
  
  const warnings = [];
  
  // 로그 출력
  console.log(`[CONTENT] 텍스트 길이: ${textLength}자 (CSS 제외)`);
  console.log(`[CONTENT] HTML 길이: ${htmlLength}자 (전체)`);
  console.log(`[CONTENT] CSS 길이: ${cssLength}자`);
  onLog?.(`[CONTENT] 텍스트 길이: ${textLength.toLocaleString()}자 (CSS 제외, API 제한 체크용)`);
  onLog?.(`[CONTENT] HTML 전체 길이: ${htmlLength.toLocaleString()}자 (CSS 포함)`);
  
  // 1. 순수 텍스트 체크
  if (textLength > BLOGGER_TEXT_LIMIT) {
    const warning = `⚠️ 순수 텍스트 초과: ${textLength.toLocaleString()}자 (제한: ${BLOGGER_TEXT_LIMIT.toLocaleString()}자). 본문을 줄여주세요.`;
    warnings.push(warning);
    onLog?.(warning);
    console.warn(`[CONTENT] ${warning}`);
  }
  
  // 2. 전체 HTML 크기 체크
  if (htmlLength > BLOGGER_HTML_LIMIT) {
    const warning = `⚠️ 전체 HTML 크기 초과: ${htmlLength.toLocaleString()}자 (제한: ${BLOGGER_HTML_LIMIT.toLocaleString()}자). CSS 압축 또는 본문 축소가 필요합니다.`;
    warnings.push(warning);
    onLog?.(warning);
    console.warn(`[CONTENT] ${warning}`);
    onLog?.(`[CONTENT] CSS 크기: ${cssLength.toLocaleString()}자 (${((cssLength / htmlLength) * 100).toFixed(1)}%)`);
  }
  
  // 3. 경고 레벨 체크 (80% 이상 사용 시)
  if (htmlLength > BLOGGER_HTML_LIMIT * 0.8) {
    const warning = `⚠️ 전체 HTML 크기가 제한의 80% 이상입니다. (${htmlUsagePercent}% 사용)`;
    warnings.push(warning);
    onLog?.(warning);
    onLog?.(`⚠️ 현재: 텍스트 ${textLength.toLocaleString()}자, CSS ${cssLength.toLocaleString()}자, 전체 ${htmlLength.toLocaleString()}자`);
  }
  
  // 4. 쇼핑몰 크롤링 주의사항 경고
  if (html.includes('쇼핑') || html.includes('커넥트') || html.includes('크롤링')) {
    const warning = '⚠️ 주의사항: 다른 쇼핑몰부터 완성 수동크롤링에 주의하세요. 쇼핑커넥트는 보안이 강하여 실패할 수 있습니다.';
    warnings.push(warning);
    onLog?.(warning);
  }
  
  // 5. 안전 정보 표시
  onLog?.(`[CONTENT] 크기 정보: 텍스트 ${textUsagePercent}% 사용, 전체 HTML ${htmlUsagePercent}% 사용`);
  
  return {
    ok: warnings.length === 0 || htmlLength <= BLOGGER_HTML_LIMIT,
    warnings,
    sizeInfo: { textLength, htmlLength, cssLength, textUsagePercent, htmlUsagePercent }
  };
}

/**
 * 콘텐츠 전처리 (이스케이프, 정리 등)
 * @param {string} html - HTML 콘텐츠
 * @returns {string} - 전처리된 HTML
 */
function preprocessContent(html) {
  if (!html) return html;
  
  let processed = html;
  
  // 불필요한 공백 제거
  processed = processed.trim();
  
  // 연속된 빈 줄 제거
  processed = processed.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  return processed;
}

/**
 * 포스팅 상태 결정 (publish, draft, scheduled)
 * @param {string} postingStatus - 요청된 상태
 * @param {Date} scheduleDate - 예약 날짜
 * @returns {Object} - {status, isDraftMode, isScheduleMode}
 */
function determinePostingStatus(postingStatus, scheduleDate) {
  const isDraftMode = postingStatus === 'draft';
  const isScheduleMode = postingStatus === 'scheduled' && scheduleDate;
  
  let status = 'live'; // 기본값
  if (isDraftMode) {
    status = 'draft';
  } else if (isScheduleMode) {
    status = 'scheduled';
  }
  
  return { status, isDraftMode, isScheduleMode };
}

/**
 * 레이블 처리 (라벨 배열을 문자열로 변환)
 * @param {Array|string} labels - 레이블 배열 또는 문자열
 * @returns {Array} - 처리된 레이블 배열
 */
function processLabels(labels) {
  if (!labels) return [];
  
  if (typeof labels === 'string') {
    return labels.split(',').map(label => label.trim()).filter(Boolean);
  }
  
  if (Array.isArray(labels)) {
    return labels.map(label => String(label).trim()).filter(Boolean);
  }
  
  return [];
}

module.exports = {
  addAutoCTAs,
  validateTitle,
  validateHtml,
  analyzeContentSize,
  validateContentSize,
  preprocessContent,
  determinePostingStatus,
  processLabels
};





