'use strict';
// R4 deep-research (2026-06-01) verified — 동일 R4 Reddit 정책 적용.

const { makeChannel } = require('../_shared/channel-factory');
const { appendUserNoteSafely } = require('../../_shared/sanitize');

module.exports = makeChannel({
  id: 'reddit-generic',
  name: 'Reddit (일반)',
  category: 'international',
  riskTier: 'medium',
  confidence: 'verified',
  icon: '👽',
  color: '#ff4500',
  openUrl: 'https://www.reddit.com/',

  bannedPhrases: ['my blog', 'check my', 'subscribe', 'follow me', 'visit my', 'check out my'],
  popularityTriggers: [
    '9:1 룰 (Reddit 공식 권장 비율 — 단 90/10 공식성은 refuted)',
    'detailed evidence',
    'lived experience',
    'subreddit-specific tone',
    'on-topic only',
  ],
  toneSignature: { formality: 'mixed', emoji: 'minimal', slang: [], pronouns: ['I', 'we'] },
  paragraphRule: {
    maxLineChars: 'no-limit',
    paragraphBreak: 'double',
    emptyLineMaxConsecutive: 1,
    ctaSection: 'natural-citation',
  },
  bandThresholds: { low: 35, medium: 60, high: 80, critical: 95 },
  maxOutputTokens: 1500,

  buildSystemPrompt: (subChannel, userCustomRule) => appendUserNoteSafely(`You are a multi-year Reddit user (2025~2026 verified).

[Format]
- 300~800 words English
- Information 90%+, source citation 1 line at end
- Check subreddit sidebar/wiki BEFORE posting

[R4 verified — Reddit 3단계 처벌]
- shadow ban → subreddit ban → site-wide suspension
- AutoModerator karma 50~500 + 계정 연차 7~30일
- 일부 subreddit은 site-wide 10일/100 karma 추가

[Banned]
- "Check my blog", "my website", "subscribe", "follow me"
- Marketing copy
- 트래픽 유도 전용 계정 패턴

[Reddit 운영 철학]
- "Redditor with a website, not website with Reddit account"
- 9:1 룰은 unofficial guideline (90/10 공식성 refuted) — 대신 진성 활동 비율이 핵심`, userCustomRule),

  buildUserPrompt: ({ sourceSummary, sourceUrl, sourceTitle, userCustomRule }) => `Original post: "${sourceTitle}"
URL: ${sourceUrl}

[Source summary]
- Core value: ${sourceSummary.coreValue}

${userCustomRule ? `[Target subreddit]\n${userCustomRule}\n` : ''}
Write a Reddit post (300~800 words). End with "Source: ${sourceUrl}" only. Match subreddit tone.`,
  userWarning: 'Reddit 자기홍보 위반 = 3단계 처벌 (shadow ban → subreddit ban → site-wide). 대부분 subreddit이 자기 홍보 즉시 ban. karma·계정 연차 임계값 필수.',
  operationalNotes: [
    '3단계 처벌: shadow ban → subreddit ban → site-wide',
    'AutoModerator karma 50~500 / 계정 연차 7~30일',
    '9:1 룰은 unofficial — 90/10 공식성은 refuted',
  ],
  researchSources: [
    'https://www.replyagent.ai/blog/reddit-self-promotion-rules-naturally-mention-product',
    'https://www.conbersa.ai/learn/reddit-self-promotion-rules',
    'https://postiz.com/blog/reddit-karma-requirements',
    'https://ithy.com/article/reddit-account-age-minimums',
    'https://support.reddithelp.com/hc/en-us/articles/360045734911',
  ],
});
