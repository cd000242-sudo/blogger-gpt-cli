'use strict';
// R4 deep-research (2026-06-01) verified — GitHub AUP 1차 출처 명문 정책.

const { makeChannel } = require('../_shared/channel-factory');
const { appendUserNoteSafely } = require('../../_shared/sanitize');

module.exports = makeChannel({
  id: 'github-discussions',
  name: 'GitHub Discussions',
  category: 'international',
  riskTier: 'low',
  confidence: 'verified',
  icon: '🐙',
  color: '#181717',
  openUrl: 'https://github.com/discussions',

  bannedPhrases: [
    'my product',
    'check my',
    'visit my site',
    'subscribe',
    'check out my blog',
    'follow me on',
  ],
  popularityTriggers: [
    'on-topic (관련 프로젝트 한정)',
    'detailed technical context',
    'reproducible example',
    'CONTRIBUTING.md 준수',
    'README/프로젝트 설명 한정 자기홍보 허용',
  ],
  toneSignature: { formality: 'mixed', emoji: 'minimal', slang: [], pronouns: ['I', 'we'] },
  paragraphRule: {
    maxLineChars: 'no-limit',
    paragraphBreak: 'double',
    emptyLineMaxConsecutive: 1,
    ctaSection: 'natural-citation',
    headingStyle: 'h2-prefix',
  },
  bandThresholds: { low: 50, medium: 75, high: 90, critical: 100 },
  maxOutputTokens: 2500,

  buildSystemPrompt: (subChannel, userCustomRule) => appendUserNoteSafely(`You are a developer posting on a project's GitHub Discussions (2025~2026 verified).

[Format]
- Markdown with code blocks where relevant
- Technical context: problem, attempted approach, question or insight
- On-topic only — discussions must directly relate to the repo

[GitHub AUP 1차 출처 검증 — 금지 행위]
- off-topic 또는 반복적 방해 행위 = 집행 사유
- bulk distribution of unsolicited promotions and advertising
- automated excessive bulk activity and coordinated inauthentic activity
- "The primary focus of the Content posted... should not be advertising or promotional marketing"
- 타인 저장소 Issues/Discussions에 monetized/excessive bulk content 금지
- 위반 시 case-by-case 재량 집행 (계정 정지·콘텐츠 삭제)

[허용되는 자기 홍보]
- 본인 hosting 프로젝트 README/Description에는 promotional text·링크 OK
- Discussions에서는 "관련 프로젝트 문맥" 인용만 자연스럽게

[CTA]
- Cite source as "Reference: [URL]" at end
- Do not link unrelated marketing content`, userCustomRule),

  buildUserPrompt: ({ sourceSummary, sourceUrl, sourceTitle, userCustomRule }) => `Original: "${sourceTitle}"
URL: ${sourceUrl}

[Source summary]
- Core value: ${sourceSummary.coreValue}

${userCustomRule ? `[Target repo / topic]\n${userCustomRule}\n` : ''}
Write a GitHub Discussion post that is on-topic for the target repo. End with "Reference: ${sourceUrl}".`,
  userWarning: 'GitHub AUP 명문 금지: off-topic·반복적 방해·bulk promotion·monetized content 게재. 위반 시 GitHub 재량 계정 정지·콘텐츠 삭제. Discussions은 반드시 해당 프로젝트와 on-topic이어야 함.',
  operationalNotes: [
    'GitHub AUP: case-by-case 재량 집행 (Reddit과 달리 karma/연차 룰 X)',
    'README/Description 한정 자기홍보 OK',
    'Discussions에서는 "관련 프로젝트 문맥"만 자연 인용',
    '실제 community 사례: github/community discussions #191078, #191301, #107248 집행 확인',
  ],
  researchSources: [
    'https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies',
    'https://docs.github.com/en/communities/maintaining-your-safety-on-github/reporting-abuse-or-spam',
  ],
});
