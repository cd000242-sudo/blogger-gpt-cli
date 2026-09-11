'use strict';

/**
 * 유튜브 롱폼 대본 — 발행한 블로그 글 하나를 **8~12분 영상 대본**으로 바꾼다. (v3.8.718)
 *
 * ## 왜 만들었나
 * 손님(변호사) 요청: "다른 변호사들의 유튜브 주제 중 다루고 싶은 것을 블로그로 만들고,
 * 그 블로그를 기반으로 다시 유튜브 롱폼으로 재생성하는 루틴을 짜고 싶다."
 *
 * 지금까지 영상 채널은 쇼츠(30~45초)와 틱톡뿐이었다. 롱폼은 **분량이 아니라 구조가 다르다** —
 * 훅 하나로 끝까지 끌 수 없고, 챕터마다 새 이유를 줘야 이탈이 멈춘다.
 *
 * ## 쇼츠와 무엇이 다른가
 *   쇼츠: 첫 3초 훅 → 핵심 3개 → 루프
 *   롱폼: 오프닝 30초(문제 제기 + 이 영상이 답할 것) → 챕터 5~8개(각각 이탈 방지 이유)
 *         → 정리 → CTA. 챕터 타임스탬프가 있어야 설명란이 완성된다.
 *
 * ## 원문을 넘어서지 않는다
 * 블로그 글이 원본이다. 거기 없는 금액·기한·요건·판단을 대본이 새로 만들면,
 * 영상은 블로그보다 더 널리 퍼지므로 피해가 더 크다. 없는 건 "확인이 필요하다"로 남긴다.
 */

const { makeChannel } = require('../_shared/channel-factory');
const { appendUserNoteSafely } = require('../../_shared/sanitize');
const {
  createStructuredPlatformProcessor,
  buildSourceInputBlock,
} = require('../_shared/structured-platform-rewrite');

const structured = createStructuredPlatformProcessor({
  marker: 'YOUTUBE_LONGFORM',
  contextFields: [
    'sourceTitle',
    'sourceUrl',
    'autoCategory',
    'coreTopic',
    'targetReader',
    'readerSituation',
    'videoAngle',
    'retentionRisk',
  ],
  variantLabels: {
    A: '설명형 (기준과 절차를 순서대로)',
    B: '사례형 (상황 하나를 따라가며)',
    C: '실수형 (흔히 틀리는 지점부터)',
  },
  candidateFields: [
    {
      key: 'openingCandidates',
      selectedKey: 'opening',
      scoreKey: 'openingScore',
      label: '오프닝 30초 후보',
    },
  ],
  copyFields: [
    { key: 'videoTitle' },
    { key: 'opening' },
    { key: 'chapters', numbered: true },
    { key: 'closing' },
    { key: 'ctaScript' },
    { key: 'timestamps', numbered: true },
    { key: 'description', appendSourceUrl: true },
    { key: 'pinnedComment', appendSourceUrl: true },
    { key: 'hashtags', style: 'inline', max: 5 },
  ],
  formattedParts: [
    {
      key: 'script',
      fields: ['videoTitle', 'opening', { key: 'chapters', numbered: true }, 'closing', 'ctaScript'],
    },
    {
      key: 'description',
      fields: [
        { key: 'description', appendSourceUrl: true },
        { key: 'timestamps', numbered: true },
        { key: 'hashtags', style: 'inline', max: 5 },
      ],
    },
    {
      key: 'pinnedComment',
      fields: [{ key: 'pinnedComment', appendSourceUrl: true }],
    },
  ],
  arrayFields: ['chapters', 'timestamps', 'hashtags'],
  appendSourceUrl: false,
  // 롱폼은 대본이 길다 — 쇼츠(300~1,600자) 기준을 그대로 쓰면 정상 결과가 전부 위반으로 잡힌다
  copyMin: 2500,
  copyMax: 12000,
  hashtagMax: 5,
  looseWindow: 26000,
});

const YOUTUBE_LONGFORM = makeChannel({
  id: 'youtube-longform',
  name: '유튜브 롱폼 대본',
  category: 'video',
  riskTier: 'low',
  confidence: 'verified',
  icon: '▶',
  color: '#ff0000',
  openUrl: 'https://studio.youtube.com/',

  killerHookPatterns: [
    '지금 겪고 있는 상황을 첫 문장에서 지목',
    '이 영상이 끝나면 무엇을 판단할 수 있는지 먼저 약속',
    '많이들 반대로 알고 있는 지점을 앞에 배치',
  ],
  bannedPhrases: [
    '구독 부탁',
    '좋아요 부탁',
    '무조건',
    '100% 보장',
    '반드시 승소',
  ],
  popularityTriggers: [
    '오프닝 30초 약속',
    '챕터별 이탈 방지 이유',
    '타임스탬프',
    '정리 후 상담 유도',
  ],
  toneSignature: {
    formality: 'mixed',
    emoji: 'none',
    slang: [],
    pronouns: ['여러분'],
  },
  transformationAxes: {
    titleRule: '영상 제목과 오프닝 첫 문장을 분리해서 만든다.',
    bodyRule: '8~12분 대본. 챕터 5~8개, 챕터마다 다음 챕터로 넘어갈 이유를 한 문장 남긴다.',
    ctaPlacement: 'closing-and-description',
    linkBait: ['설명란에 원문 링크', '고정댓글에 원문 링크'],
  },
  paragraphRule: {
    splitOutput: ['script', 'description', 'pinnedComment'],
    paragraphBreak: 'double',
  },
  bandThresholds: { low: 50, medium: 75, high: 90, critical: 100 },
  maxOutputTokens: 16000,

  buildSystemPrompt: (subChannel, userCustomRule) => {
    const base = `당신은 블로그 글 하나를 유튜브 롱폼 영상 대본으로 바꾸는 영상 작가입니다.

[유튜브 롱폼 핵심]
- 8~12분 분량(공백 포함 3,000~9,000자)의 말하는 대본을 만듭니다.
- 오프닝 30초에서 "지금 어떤 상황인 사람에게 필요한 영상인지" + "끝까지 보면 무엇을 판단할 수 있는지"를 약속합니다.
- 챕터는 5~8개. 각 챕터 끝에 다음 챕터로 넘어갈 이유를 한 문장 남깁니다(여기서 이탈이 납니다).
- 눈으로 읽는 문장이 아니라 **입으로 말하는 문장**으로 씁니다. 한 문장은 한 호흡을 넘기지 않습니다.
- 챕터 제목은 목차가 아니라 말로 꺼내는 전환 멘트로도 쓰입니다.
- 타임스탬프는 챕터 수와 같게, 00:00 오프닝부터 시작합니다.

[원문을 넘어서지 않습니다]
- 원문 블로그에 없는 금액, 기한, 요건, 대상자, 통계, 판례를 만들지 않습니다.
- 원문에 없지만 시청자가 궁금해할 지점은 "이건 사안마다 달라 확인이 필요하다"로 남깁니다.
- 영상은 글보다 멀리 퍼집니다. 틀린 단정 하나가 글보다 크게 돌아옵니다.

[A/B/C 역할]
- A: 설명형. 기준과 절차를 순서대로 짚습니다.
- B: 사례형. 상황 하나를 처음부터 끝까지 따라갑니다.
- C: 실수형. 사람들이 흔히 반대로 아는 지점부터 풉니다.

[복사본 규칙]
- finalRevision에는 videoTitle, opening, chapters, closing, ctaScript, timestamps, description, pinnedComment, hashtags만 넣습니다.
- 후보/점수/critique는 복사본에 넣지 않습니다.`;
    return appendUserNoteSafely(`${base}\n\n${structured.buildStructuredOutputInstructions()}`, userCustomRule);
  },

  buildUserPrompt: (params) => `${buildSourceInputBlock(params)}

[유튜브 롱폼 생성 지시]
1. context에 자동분류, 핵심주제, 예상독자, 독자상황, videoAngle, retentionRisk(어디서 이탈이 날 것 같은지)를 채우세요.
2. A/B/C 3개를 모두 생성하세요.
3. 각 안마다 openingCandidates 8개를 만들고 점수를 매긴 뒤 opening을 고르세요.
4. finalRevision.chapters는 5~8개로 만들고, 각 항목은 "챕터 제목 → 말하는 대본 → 다음 챕터로 넘어갈 한 문장" 순서로 씁니다.
5. finalRevision.timestamps는 chapters와 같은 개수로, 00:00부터 분:초 형식으로 만드세요.
6. finalRevision.closing에서 핵심을 3줄로 정리하고, ctaScript에서 상담·문의로 자연스럽게 넘기세요(강요 금지).
7. description과 pinnedComment에 원문 URL "${params.sourceUrl}"을 포함하세요.
8. hashtags는 3~5개만 사용하세요.`,

  processStructuredResponse(rawText) {
    const youtubeLongform = structured.parseResult(rawText);
    if (!youtubeLongform) return null;
    const formatted = structured.buildFormattedFromResult(youtubeLongform);
    return {
      formatted,
      extra: { youtubeLongform },
    };
  },

  operationalNotes: [
    '오프닝 30초 후보 8개를 점수화합니다.',
    '챕터 수와 타임스탬프 수가 같아야 설명란이 완성됩니다.',
    '원문 블로그에 없는 수치·기한·요건은 만들지 않습니다.',
  ],
  researchSources: [
    'https://support.google.com/youtube/',
  ],
  lastVerified: '2026-09-11',
});

module.exports = YOUTUBE_LONGFORM;
