// src/core/external-traffic/prompts/_shared/channel-factory.js
// 공통 패턴(naver/community/specialized) 재사용 — 채널별 파일을 짧게 유지.

'use strict';

const { assessRiskMultiAxis } = require('../../_shared/risk-assess');
const { appendUserNoteSafely } = require('../../_shared/sanitize');

/**
 * 채널 객체 생성 헬퍼.
 * 필수 필드만 받고 나머지는 기본값으로 채워 반환.
 *
 * @param {Partial<import('../../_shared/types').ChannelPrompt>} spec
 * @returns {import('../../_shared/types').ChannelPrompt}
 */
function makeChannel(spec) {
  const channel = {
    id: spec.id,
    name: spec.name,
    category: spec.category,
    riskTier: spec.riskTier || 'medium',
    confidence: spec.confidence || 'inferred',
    icon: spec.icon,
    color: spec.color,
    openUrl: spec.openUrl,

    killerHookPatterns: spec.killerHookPatterns || [],
    bannedPhrases: spec.bannedPhrases || [],
    popularityTriggers: spec.popularityTriggers || [],
    toneSignature: spec.toneSignature || { formality: 'mixed', emoji: 'minimal', slang: [], pronouns: [] },
    transformationAxes: spec.transformationAxes || {
      titleRule: '',
      bodyRule: '',
      ctaPlacement: 'inline',
      linkBait: [],
    },
    paragraphRule: spec.paragraphRule || {
      maxLineChars: 40,
      paragraphBreak: 'double',
      emptyLineMaxConsecutive: 1,
    },
    bandThresholds: spec.bandThresholds || { low: 40, medium: 65, high: 85, critical: 100 },
    maxOutputTokens: spec.maxOutputTokens || 2000,
    subChannels: spec.subChannels,

    userWarning: spec.userWarning || null,
    operationalNotes: spec.operationalNotes || [],
    researchSources: spec.researchSources || [],
    lastVerified: spec.lastVerified || '2026-06-01',

    buildSystemPrompt: spec.buildSystemPrompt
      || ((subChannel, userCustomRule) => appendUserNoteSafely(spec.systemPrompt || '', userCustomRule)),
    buildUserPrompt: spec.buildUserPrompt
      || ((params) => spec.userPromptBuilder ? spec.userPromptBuilder(params) : ''),
    assessRisk: spec.assessRisk
      || ((response) => assessRiskMultiAxis(response, channel)),
  };
  if (typeof spec.processStructuredResponse === 'function') {
    channel.processStructuredResponse = spec.processStructuredResponse;
  }
  return channel;
}

module.exports = {
  makeChannel,
};
