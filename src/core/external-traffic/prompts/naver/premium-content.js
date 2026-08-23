// naver/premium-content.js — 네이버 프리미엄콘텐츠 (v3.8.544)
//
// 사장님 지시: "네이버 프리미엄 콘텐츠를 외부유입글 생성에 추가해주세요"
//
// ## 이 채널이 다른 네이버 채널과 다른 점
// 블로그·카페·밴드는 "정보를 다 주고 링크로 유도"가 통한다. 프리미엄콘텐츠는 반대다.
// 구독(유료) 전환을 전제로 만든 판이라, 무료 공개분은 **판단 근거를 다 주되 실행 절차는
// 남겨두는** 구조로 써야 채널 성격과 충돌하지 않는다.
//   · 채널 개설 → 창작자 심사 통과가 선행 조건 (아무나 바로 못 쓴다)
//   · 글은 무료/유료를 글 단위로 정한다 → 여기서 만드는 건 **무료 공개글**이 기본
//   · 네이버 통합검색·프리미엄콘텐츠 홈 노출을 노리므로 제목이 검색형이어야 한다
//
// ## confidence: inferred 인 이유
// 외부 링크 허용 범위·무료글 최소 분량 같은 운영 기준을 공식 문서 1차 출처로 확인하지 못했다.
// 그래서 링크는 본문 끝 1개로 보수적으로 잡고, 그 사실을 userWarning 으로 화면에 남긴다.
// 추측을 규칙처럼 박아두면 나중에 "왜 이렇게 쓰지"를 아무도 설명 못 한다.

'use strict';

const { makeChannel } = require('../_shared/channel-factory');
const { appendUserNoteSafely } = require('../../_shared/sanitize');

module.exports = makeChannel({
  id: 'naver-premium-content',
  name: '네이버 프리미엄콘텐츠',
  category: 'naver',
  riskTier: 'low',
  confidence: 'inferred',
  icon: '💎',
  color: '#03c75a',
  openUrl: 'https://contents.premium.naver.com/',

  killerHookPatterns: [
    '~ 판단 기준부터 정리했습니다',
    '~ 하기 전에 확인해야 할 것',
    '~ 이 경우엔 신청하면 안 됩니다',
  ],
  bannedPhrases: ['구독 부탁드립니다', '좋아요 눌러주세요', '많은 관심 부탁', '무료 나눔'],
  popularityTriggers: ['판단 기준표', '해당/비해당 구분', '실제 수치', '예외 케이스'],
  toneSignature: { formality: 'polite', emoji: 'minimal', slang: [], pronouns: ['저', '독자분'] },
  transformationAxes: {
    titleRule: '검색형 + 판단형. "총정리/완벽가이드" 같은 장식어 금지, 독자가 무엇을 결정하게 되는지 제목에 담는다.',
    bodyRule: '본문 1,500~2,500자. 소제목 3~4개. 표 또는 기준 목록 1개 필수. 외부 링크는 본문 끝 1개.',
    ctaPlacement: 'end-of-body',
    linkBait: ['원문에 정리한 절차', '서류 양식과 예외 항목'],
  },
  paragraphRule: {
    maxLineChars: 40,
    paragraphBreak: 'double',
    emptyLineMaxConsecutive: 1,
    ctaSection: 'end-of-body',
  },
  bandThresholds: { low: 50, medium: 75, high: 92, critical: 100 },
  maxOutputTokens: 4000,

  buildSystemPrompt: (subChannel, userCustomRule) => {
    const base = `당신은 네이버 프리미엄콘텐츠 채널을 운영하는 한국 전문 창작자입니다.

[이 판의 성격 — 다른 SNS와 다르다]
- 독자는 "돈 낼 만한 글인가"를 보고 있습니다. 홍보문 어조는 즉시 이탈입니다.
- 그래서 무료 공개글은 **판단에 필요한 근거를 실제로 다 줍니다.**
  남겨둘 것은 정보가 아니라 '실행 절차와 양식'입니다.

[글 형식]
- 제목 1개 (검색형 + 무엇을 결정하게 되는지 명시, 25~40자)
- 본문 1,500~2,500자
- 소제목 3~4개
- 판단 기준표 또는 "해당 / 비해당" 구분 목록 1개 필수
- 본문 끝 외부 링크 1개만 ("절차와 서류는 원문에 정리해뒀습니다: [URL]")

[금지]
- "총정리", "완벽 가이드", "A to Z" 같은 장식어 제목
- 구독·좋아요 구걸 문구
- 원문에 없는 금액·기한·대상자·비율을 지어내는 것 (모르면 그 문장을 빼세요)
- 결론을 미루고 "자세한 내용은 링크에서" 로 때우는 것 — 이 채널에서는 환불 사유입니다

[유료/무료]
- 여기서 만드는 글은 **무료 공개글**입니다. 유료 전환 문구를 넣지 마세요.`;
    return appendUserNoteSafely(base, userCustomRule);
  },

  buildUserPrompt: ({ sourceSummary, sourceUrl, sourceTitle }) => `원본 글: "${sourceTitle}"
URL: ${sourceUrl}

[원본 요약]
- 핵심 가치: ${sourceSummary.coreValue}
- 핵심 포인트: ${(sourceSummary.keyPoints || []).join(' / ')}
- 확인된 수치·사실: ${(sourceSummary.dataPoints || []).join(' / ') || '(없음 — 수치를 새로 만들지 마세요)'}

네이버 프리미엄콘텐츠 무료 공개글 1편을 작성하세요.

출력 형식:
[제목] 검색형 + 판단형 제목 1개
[본문] 1,500~2,500자, 소제목 3~4개
[판단 기준] 표 또는 "해당 / 비해당" 목록 1개
[원문 유도] 마지막 한 줄 — "절차와 서류는 원문에 정리해뒀습니다: ${sourceUrl}"

규칙: 원본 요약에 있는 사실만 씁니다. 위 [확인된 수치·사실] 밖의 숫자를 만들면 실격입니다.`,

  userWarning: '프리미엄콘텐츠는 채널 개설·창작자 심사를 통과한 계정만 발행할 수 있습니다. 외부 링크 허용 범위와 무료글 최소 분량은 공식 1차 출처를 확인하지 못해 보수적으로(본문 끝 1개) 잡았습니다 — confidence: inferred.',
  operationalNotes: [
    '채널 개설/심사 통과가 선행 조건 — 미승인 계정은 발행 자체가 불가',
    '무료/유료는 글 단위 설정. 이 채널 프롬프트는 무료 공개글 기준',
    '외부 링크 정책 공식 문서 1차 출처 회수 필요',
  ],
});
