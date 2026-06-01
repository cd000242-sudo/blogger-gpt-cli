'use strict';
const { makeChannel } = require('../_shared/channel-factory');
const { appendUserNoteSafely } = require('../../_shared/sanitize');

module.exports = makeChannel({
  id: 'medium',
  name: 'Medium',
  category: 'international',
  riskTier: 'low',
  confidence: 'inferred',
  icon: '📰',
  color: '#000000',
  openUrl: 'https://medium.com/new-story',

  bannedPhrases: [],
  popularityTriggers: ['English SEO keywords', 'data-backed claims', 'narrative structure'],
  toneSignature: { formality: 'polite', emoji: 'minimal', slang: [], pronouns: ['I', 'we'] },
  paragraphRule: {
    maxLineChars: 'no-limit',
    paragraphBreak: 'double',
    emptyLineMaxConsecutive: 1,
    ctaSection: 'separate-block',
    headingStyle: 'h2-prefix',
  },
  bandThresholds: { low: 55, medium: 80, high: 95, critical: 100 },
  maxOutputTokens: 3000,

  buildSystemPrompt: (subChannel, userCustomRule) => appendUserNoteSafely(`You are a Medium writer publishing for an international audience.

[Format]
- 800~2,000 English words
- Markdown with H2 subheadings (3~5)
- Data-backed claims, narrative + insight balance
- End with a "References" section linking the original Korean source

[Notes]
- Medium Partner Program excludes Members-only paywall for promotional content
- Avoid keyword stuffing; natural English SEO`, userCustomRule),

  buildUserPrompt: ({ sourceSummary, sourceUrl, sourceTitle }) => `Original (Korean): "${sourceTitle}"
URL: ${sourceUrl}

[Source summary]
- Core value: ${sourceSummary.coreValue}
- Key points: ${sourceSummary.keyPoints.join(' / ')}
- Keywords: ${sourceSummary.keywords.join(', ')}

Write a Medium article (800~2,000 English words). End with "## References" linking ${sourceUrl}.`,
  userWarning: 'R4 deep-research에서 Medium Partner Program 자기 글 인용 정책·paywall 도달 차이 1차 출처 미확보 — confidence: inferred.',
  operationalNotes: ['R4 공식 Partner Program 정책 1차 페이지 회수 필요 — Korean 작가 성공 사례 미확보'],
});
