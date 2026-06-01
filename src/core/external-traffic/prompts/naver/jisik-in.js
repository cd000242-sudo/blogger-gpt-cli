// naver/jisik-in.js — 네이버 지식인 답변.

'use strict';

const { makeChannel } = require('../_shared/channel-factory');
const { appendUserNoteSafely } = require('../../_shared/sanitize');

module.exports = makeChannel({
  id: 'naver-jisik-in',
  name: '네이버 지식인',
  category: 'naver',
  riskTier: 'low',
  confidence: 'inferred',
  icon: '❓',
  color: '#03c75a',
  openUrl: 'https://kin.naver.com/',

  killerHookPatterns: ['질문하신 ~ 답변드립니다', '정리해서 답변드립니다'],
  bannedPhrases: ['제 블로그 보세요', '구독 부탁'],
  popularityTriggers: ['단계별 설명', '근거 자료', '경험 공유'],
  toneSignature: { formality: 'polite', emoji: 'minimal', slang: [], pronouns: ['답변자', '저'] },
  transformationAxes: {
    titleRule: '없음 — 답변만.',
    bodyRule: '단계별 답변 400~1,200자. 외부 출처 자연 인용.',
    ctaPlacement: 'natural-citation',
    linkBait: ['참고 자료', '관련 정보'],
  },
  paragraphRule: {
    maxLineChars: 40,
    paragraphBreak: 'double',
    emptyLineMaxConsecutive: 1,
    ctaSection: 'natural-citation',
  },
  bandThresholds: { low: 55, medium: 80, high: 95, critical: 100 },
  maxOutputTokens: 1600,

  buildSystemPrompt: (subChannel, userCustomRule) => {
    const base = `당신은 한국 네이버 지식인 답변 자원봉사자입니다.

[글 형식]
- 답변 400~1,200자
- 단계별·근거 기반 설명
- 본문 끝 자연스러운 출처 1줄 "참고: [URL]"
- 줄당 35~40자

[원칙]
- 질문에 직접 답변. 자기 홍보 X.
- 채택률을 높이려면 단계 + 근거 + 본인 경험.`;
    return appendUserNoteSafely(base, userCustomRule);
  },

  buildUserPrompt: ({ sourceSummary, sourceUrl, sourceTitle }) => `원본 글: "${sourceTitle}"
URL: ${sourceUrl}

[원본 요약]
- 핵심 가치: ${sourceSummary.coreValue}
- 핵심 포인트: ${sourceSummary.keyPoints.join(' / ')}

위 정보를 바탕으로 지식인 답변 1편(400~1,200자)을 작성하세요. 본문 끝에 "참고: ${sourceUrl}".`,
  userWarning: 'R3 deep-research에서 답변 채택률 sweet-spot·외부 출처 인용 자연 패턴 1차 출처 미확보 — confidence: inferred.',
  operationalNotes: ['R3 공식 정책 페이지 회수 필요'],
});
