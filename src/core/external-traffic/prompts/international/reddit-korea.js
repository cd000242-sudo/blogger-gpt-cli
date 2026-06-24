'use strict';
// R4 deep-research (2026-06-01) verified — Reddit 자기홍보 3단계 처벌 + karma/연차 임계값.

const { makeChannel } = require('../_shared/channel-factory');
const { appendUserNoteSafely } = require('../../_shared/sanitize');

module.exports = makeChannel({
  id: 'reddit-korea',
  name: 'Reddit (r/korea·r/seoul)',
  category: 'international',
  riskTier: 'medium',
  confidence: 'verified',
  icon: '👽',
  color: '#ff4500',
  openUrl: 'https://www.reddit.com/r/korea/',

  bannedPhrases: [
    'My blog',
    'check my blog',
    'subscribe',
    'follow me',
    'visit my',
    'check out my',
  ],
  popularityTriggers: [
    'authentic Korean perspective (lived experience)',
    'comparison data',
    'detailed personal account',
    'on-topic content (subreddit rules)',
    'Redditor with a website (not website with Reddit account)',
  ],
  toneSignature: { formality: 'mixed', emoji: 'minimal', slang: [], pronouns: ['I', 'we'] },
  paragraphRule: {
    maxLineChars: 'no-limit',
    paragraphBreak: 'double',
    emptyLineMaxConsecutive: 1,
    ctaSection: 'natural-citation',
  },
  bandThresholds: { low: 40, medium: 65, high: 85, critical: 100 },
  maxOutputTokens: 3000,

  buildSystemPrompt: (subChannel, userCustomRule) => appendUserNoteSafely(`You are a 3-year+ Reddit user posting on r/korea or r/seoul (2025~2026 verified).

[Format]
- 300~800 English words
- Authentic Korean perspective (lived experience)
- Information 80%, source citation only 1 line at the end
- Follow subreddit AutoModerator rules — minimum karma (50~500) + account age (7~30 days)

[R4 verified Reddit philosophy]
- "It's perfectly fine to be a Redditor with a website, it's not okay to be a website with a Reddit account"
- 자기홍보 위반 = 3단계 처벌: shadow ban → subreddit ban → site-wide suspension
- Site-wide policy: 10일/100 karma 추가 적용 가능

[Banned — instant ban triggers]
- "Check my blog", "my website", "subscribe"
- Excessive self-promotion language
- Generic marketing copy
- 트래픽 유도 전용 계정 패턴`, userCustomRule),

  buildUserPrompt: ({ sourceSummary, sourceUrl, sourceTitle }) => `Original post: "${sourceTitle}"
URL (use only as source citation at the end): ${sourceUrl}

[Source summary]
- Core value: ${sourceSummary.coreValue}
- Key points: ${sourceSummary.keyPoints.join(' / ')}

Write a Reddit post (300~800 words) in English. End with "Source: ${sourceUrl}" only. Authentic Korean voice — not marketing copy.`,
  userWarning: 'Reddit 자기홍보 위반 = shadow ban → subreddit ban → site-wide 3단계 처벌. karma 50~500 / 계정 연차 7~30일 임계값. "Redditor with a website" 철학 — 트래픽 유도 전용 계정 즉시 ban.',
  operationalNotes: [
    '3단계 처벌: shadow ban → subreddit ban → site-wide',
    'AutoModerator karma 50~500 / 계정 연차 7~30일',
    'site-wide policy: 10일/100 karma 추가',
    '"Redditor with a website, not website with Reddit account"',
  ],
  researchSources: [
    'https://www.replyagent.ai/blog/reddit-self-promotion-rules-naturally-mention-product',
    'https://www.conbersa.ai/learn/reddit-self-promotion-rules',
    'https://postiz.com/blog/reddit-karma-requirements',
    'https://ithy.com/article/reddit-account-age-minimums',
    'https://support.reddithelp.com/hc/en-us/articles/360045734911',
  ],
});
