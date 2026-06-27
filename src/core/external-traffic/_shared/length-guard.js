// src/core/external-traffic/_shared/length-guard.js
// v2.3 보강: 채널별 maxOutputTokens + 길이 초과 검증·재시도.

'use strict';

/** @typedef {import('./types').ChannelPrompt} ChannelPrompt */
/** @typedef {import('./types').FormattedOutput} FormattedOutput */

const HASHTAG_RE = /#[\p{L}\p{N}_]+/gu;

/**
 * 채널별 길이 제한 정의 (글자수 기준).
 * 토큰이 아닌 글자수로 통일 — 사용자에게 노출할 단위.
 */
const CHANNEL_LENGTH_LIMITS = {
  instagram: { body: { max: 2200 }, hashtags: { min: 8, max: 12 } },
  threads: { body: { max: 500 } },
  x: {
    parts: {
      tweet1: { max: 280 },
      tweet2: { max: 280 },
    },
  },
  facebook: {
    parts: {
      personal: { max: 1500 },
      'group-comment': { max: 500 },
    },
  },
  pinterest: {
    parts: {
      pinTitle: { max: 100 },
      description: { max: 500 },
      boardSuggestion: { max: 200 },
      imagePrompt: { max: 500 },
    },
  },
  'youtube-shorts': {
    parts: {
      script: { max: 1200 },
      description: { max: 700 },
      pinnedComment: { max: 280 },
    },
  },
  tiktok: {
    parts: {
      script: { max: 900 },
      caption: { max: 450 },
      hashtags: { max: 200 },
    },
  },
  'kakao-openchat': { body: { max: 450, min: 60 } },
  'naver-blog': { body: { max: 1200, min: 700 }, hashtags: { min: 5, max: 8 } },
  'naver-cafe': { body: { max: 900, min: 400 } },
};

/**
 * formatted output에 대해 채널별 길이 검증.
 * 위반 항목 배열 반환 (재시도 프롬프트에 합성).
 *
 * @param {FormattedOutput} formatted
 * @param {ChannelPrompt} channel
 * @returns {string[]}
 */
function validateLength(formatted, channel) {
  const limits = CHANNEL_LENGTH_LIMITS[channel.id];
  if (!limits) return [];
  const violations = [];

  if (limits.body && typeof formatted.body === 'string') {
    if (limits.body.max && formatted.body.length > limits.body.max) {
      violations.push(`본문 ${formatted.body.length}자 (상한 ${limits.body.max})`);
    }
    if (limits.body.min && formatted.body.length < limits.body.min) {
      violations.push(`본문 ${formatted.body.length}자 (하한 ${limits.body.min})`);
    }
  }

  if (limits.hashtags && Array.isArray(formatted.hashtags)) {
    const n = formatted.hashtags.length;
    if (limits.hashtags.max && n > limits.hashtags.max) {
      violations.push(`해시태그 ${n}개 (상한 ${limits.hashtags.max})`);
    }
    if (limits.hashtags.min && n < limits.hashtags.min) {
      violations.push(`해시태그 ${n}개 (하한 ${limits.hashtags.min})`);
    }
  }

  if (limits.parts && formatted.parts) {
    for (const [k, range] of Object.entries(limits.parts)) {
      const v = formatted.parts[k];
      if (typeof v !== 'string') continue;
      if (range.max && v.length > range.max) {
        violations.push(`${k} ${v.length}자 (상한 ${range.max})`);
      }
      if (range.min && v.length < range.min) {
        violations.push(`${k} ${v.length}자 (하한 ${range.min})`);
      }
    }
  }

  return violations;
}

/**
 * 길이 초과 시 재시도 프롬프트에 추가할 보강 문장.
 *
 * @param {string[]} violations
 * @returns {string}
 */
function buildRetryHint(violations) {
  if (!violations.length) return '';
  // v3.8.253: truncation 케이스는 별도 hint (길이 초과 아니라 미완성)
  const isTruncation = violations.some((v) => /생성 중단|finalRevision을 마무리/.test(v));
  if (isTruncation) {
    return (
      '\n\n⚠️ 이전 응답이 중간에 끊겼습니다. 다음을 엄격히 지켜 다시 작성해주세요:\n\n' +
      '1. **context 분석 섹션 생략** — 바로 variants 3개와 finalRevision만 출력\n' +
      '2. variants 각 항목은 핵심 필드(firstLine, body, commentPrompt)만 작성, 부가 설명 금지\n' +
      '3. finalRevision은 variants[0]을 그대로 복사해도 됨 (정밀 보정 생략 가능)\n' +
      '4. JSON 태그를 반드시 마무리(JSON_END)까지 출력\n' +
      '5. 본문은 짧고 간결하게 (channel 길이 제약 준수)\n\n' +
      '핵심: 분량을 줄여서 token 한도 안에 완전한 JSON을 출력하는 것이 최우선.'
    );
  }
  return (
    '\n\n앞서 출력이 길이 제약을 초과했습니다. 다음 항목을 더 짧게 다시 작성하세요:\n- ' +
    violations.join('\n- ')
  );
}

module.exports = {
  CHANNEL_LENGTH_LIMITS,
  validateLength,
  buildRetryHint,
  HASHTAG_RE,
};
