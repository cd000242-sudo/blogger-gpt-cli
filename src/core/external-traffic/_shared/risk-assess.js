// src/core/external-traffic/_shared/risk-assess.js
// v2.2 핵심: bannedPhrases 단순 매칭이 아닌 다축 위험 평가.
// 6축: bannedKeyword(30) + structure(20) + vocabulary(15) + ctaPattern(15) + toneMismatch(10) + selfPromotion(10) = 100.

'use strict';

/** @typedef {import('./types').ChannelPrompt} ChannelPrompt */
/** @typedef {import('./types').RiskAssessment} RiskAssessment */
/** @typedef {import('./types').RiskAxes} RiskAxes */

const SELF_PROMO_PATTERNS = [
  /제\s*블로그/,
  /제가\s*쓴/,
  /내\s*블로그/,
  /내가\s*쓴/,
  /방문해\s*주세요/,
  /방문\s*부탁/,
  /구독\s*부탁/,
  /글쓴이입니다/,
  /제가\s*운영/,
  /저희\s*블로그/,
];

const GENERIC_CTA_FLAGS = [
  /더\s*자세한\s*내용은/,
  /자세히\s*보러\s*가기/,
  /클릭\s*해\s*주세요/,
];

const URL_RE = /https?:\/\/[^\s)]+/gi;
const HASHTAG_RE = /#[\p{L}\p{N}_]+/gu;

/**
 * 채널 객체로부터 다축 위험 평가.
 *
 * @param {string} response   LLM 생성 결과 (또는 postFormat 후 body)
 * @param {ChannelPrompt} channel
 * @param {Object} [ctx]      추가 컨텍스트 (sourceUrl 등)
 * @returns {RiskAssessment}
 */
function assessRiskMultiAxis(response, channel, ctx) {
  const text = String(response || '');
  const lower = text.toLowerCase();
  const banned = Array.isArray(channel.bannedPhrases) ? channel.bannedPhrases : [];
  const tone = channel.toneSignature || {};
  const rule = channel.paragraphRule || {};

  /** @type {RiskAxes} */
  const axes = {
    bannedKeyword: 0,
    structure: 0,
    vocabulary: 0,
    ctaPattern: 0,
    toneMismatch: 0,
    selfPromotion: 0,
  };
  const violations = [];
  const warnings = [];

  // ─── 1. bannedKeyword (max 30) ──────────────────────────────
  for (const ph of banned) {
    if (!ph) continue;
    if (lower.includes(String(ph).toLowerCase())) {
      axes.bannedKeyword += 10;
      violations.push(`금기어: "${ph}"`);
      if (axes.bannedKeyword >= 30) break;
    }
  }
  axes.bannedKeyword = Math.min(30, axes.bannedKeyword);

  // ─── 2. structure (max 20) ──────────────────────────────────
  // 글 길이 비정상, 문단 분포 비정상
  const len = text.length;
  if (typeof rule.maxLineChars === 'number' && rule.maxLineChars > 0) {
    const overLong = text.split('\n').filter((l) => l.length > rule.maxLineChars * 1.5).length;
    if (overLong > 0) {
      axes.structure += Math.min(10, overLong * 3);
      warnings.push(`줄당 글자수 초과 ${overLong}줄`);
    }
  }
  if (typeof rule.maxLines === 'number' && rule.maxLines > 0) {
    const totalLines = text.split('\n').filter((l) => l.trim().length > 0).length;
    if (totalLines > rule.maxLines) {
      axes.structure += 10;
      warnings.push(`줄 수 상한 초과 (${totalLines}/${rule.maxLines})`);
    }
  }
  if (len < 30) {
    axes.structure += 10;
    warnings.push('본문이 너무 짧음');
  }
  axes.structure = Math.min(20, axes.structure);

  // ─── 3. vocabulary (max 15) ─────────────────────────────────
  // 단어 다양성 (TTR — Type-Token Ratio)
  const words = text.split(/[\s,.!?\n]+/).filter((w) => w.length >= 2);
  if (words.length >= 20) {
    const unique = new Set(words).size;
    const ttr = unique / words.length;
    if (ttr < 0.35) {
      axes.vocabulary += 10;
      warnings.push(`단어 다양성 낮음 (TTR ${ttr.toFixed(2)})`);
    }
    if (ttr < 0.25) {
      axes.vocabulary += 5;
    }
  }
  axes.vocabulary = Math.min(15, axes.vocabulary);

  // ─── 4. ctaPattern (max 15) ─────────────────────────────────
  const urls = text.match(URL_RE) || [];
  const urlCount = urls.length;

  switch (rule.ctaSection) {
    case 'first-comment':
      // 본문에 URL 있으면 위험
      if (urlCount > 0) {
        axes.ctaPattern += 15;
        violations.push('본문 트윗에 URL 포함 (도달 30~50% 감소)');
      }
      break;
    case 'natural-citation':
      // 출처 1줄만 허용
      if (urlCount > 1) {
        axes.ctaPattern += 10;
        warnings.push(`URL ${urlCount}회 노출 (1회 권장)`);
      }
      break;
    case 'separate-block':
      if (urlCount === 0) {
        axes.ctaPattern += 5;
        warnings.push('CTA 영역에 URL 누락');
      }
      break;
    case 'end-of-body':
      if (urlCount === 0 && !/(프로필|링크|클릭)/.test(text)) {
        axes.ctaPattern += 5;
        warnings.push('CTA 카피 누락');
      }
      break;
    default:
      break;
  }

  for (const re of GENERIC_CTA_FLAGS) {
    if (re.test(text)) {
      axes.ctaPattern += 3;
      warnings.push(`흔한 마케팅 카피: "${re.source}"`);
    }
  }
  axes.ctaPattern = Math.min(15, axes.ctaPattern);

  // ─── 5. toneMismatch (max 10) ───────────────────────────────
  // 어조 시그니처와의 거리
  if (tone.formality === 'casual') {
    // 존댓말 ("습니다", "요" 어미)이 과도하면 mismatch
    const politeMatches = (text.match(/습니다|입니다|요\.|드립니다/g) || []).length;
    const sentences = Math.max(1, text.split(/[.!?\n]/).filter((s) => s.trim().length > 0).length);
    const politeRatio = politeMatches / sentences;
    if (politeRatio > 0.5) {
      axes.toneMismatch += 8;
      warnings.push(`반말 채널인데 존댓말 비율 ${Math.round(politeRatio * 100)}%`);
    }
  } else if (tone.formality === 'polite') {
    const casualMarkers = (text.match(/(ㅋ{2,}|ㅎ{2,}|ㄹㅇ|ㅁㅊ|ㅇㅈ)/g) || []).length;
    if (casualMarkers > 2) {
      axes.toneMismatch += 6;
      warnings.push('존댓말 채널인데 자음 약어 다수');
    }
  }
  axes.toneMismatch = Math.min(10, axes.toneMismatch);

  // ─── 6. selfPromotion (max 10) ──────────────────────────────
  for (const re of SELF_PROMO_PATTERNS) {
    if (re.test(text)) {
      axes.selfPromotion += 5;
      violations.push(`자기 홍보 표현: "${re.source}"`);
      if (axes.selfPromotion >= 10) break;
    }
  }
  axes.selfPromotion = Math.min(10, axes.selfPromotion);

  // ─── 합산 + band ────────────────────────────────────────────
  const score = Math.min(
    100,
    axes.bannedKeyword +
      axes.structure +
      axes.vocabulary +
      axes.ctaPattern +
      axes.toneMismatch +
      axes.selfPromotion
  );

  const thresholds = channel.bandThresholds || { low: 30, medium: 60, high: 85, critical: 100 };
  let band;
  if (score < thresholds.low) band = 'low';
  else if (score < thresholds.medium) band = 'medium';
  else if (score < thresholds.high) band = 'high';
  else band = 'critical';

  return {
    score,
    band,
    axes,
    violations,
    warnings,
    disclaimer:
      '본 추정은 패턴 기반. 실제 안전은 채널 운영진 재량 + 사용자 운영 노하우에 의존.',
  };
}

module.exports = {
  assessRiskMultiAxis,
  SELF_PROMO_PATTERNS,
  GENERIC_CTA_FLAGS,
};
