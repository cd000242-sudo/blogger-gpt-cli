'use strict';
const { makeChannel } = require('../_shared/channel-factory');
const { appendUserNoteSafely } = require('../../_shared/sanitize');

// v3.8.129: specialized 채널 베이스 강화
// - maxOutputTokens 1600 → 3500 (본문 잘림 방지)
// - 본문 길이 통일: 400~700자 (커뮤니티 평균에 맞춤, 미끼 강도↑)
// - 심층 분석 + 미끼 전략 + 첫 줄 강한 후크 기본 적용

function makeSpecialized(spec) {
  return makeChannel({
    category: 'community',
    riskTier: spec.riskTier || 'high',
    confidence: 'inferred',
    icon: spec.icon,
    color: spec.color,
    openUrl: spec.openUrl,
    bannedPhrases: [
      '제 블로그', '방문해주세요', '구독 부탁', '홍보',
      '여러분', '안녕하세요 이웃님들',
      '바로 클릭', '지금 신청', '100% 보장', '무조건',
    ].concat(spec.bannedPhrases || []),
    popularityTriggers: spec.popularityTriggers || ['도메인 전문성', '실측 데이터', '실제 경험담'],
    toneSignature: spec.toneSignature || { formality: 'casual', emoji: 'minimal', slang: [], pronouns: [] },
    paragraphRule: {
      maxLineChars: 'no-limit',
      paragraphBreak: 'double',
      emptyLineMaxConsecutive: 1,
      ctaSection: 'natural-citation',
    },
    bandThresholds: { low: 30, medium: 55, high: 80, critical: 95 },
    maxOutputTokens: 3500,
    operationalNotes: spec.operationalNotes || ['R4 deep-research 약관·정지 사례 1차 출처 미확보 — 운영자 재량에 의존'],
    userWarning: spec.userWarning || 'R4 deep-research에서 약관·정지 사례 1차 출처 미확보 — confidence: inferred. 도메인 전문성·진성 어조 필수.',

    buildSystemPrompt: (subChannel, userCustomRule) => {
      const base = `당신은 ${spec.name} 회원입니다 (${spec.domainNote || '전문 도메인'}).

[1단계: 원문 심층 분석 (글 작성 전 머리에서만 수행)]
1. 원문이 던지는 진짜 문제 1개를 식별 (제목·요약·데이터 종합)
2. ${spec.name} 독자가 이 문제와 어떻게 연결되는지 1줄로 정리
3. 본문에 풀 정보(미끼) vs 링크에서만 확인할 정보(gated) 분리
4. 가장 강한 한 줄(첫 줄)로 어떤 후크를 쓸지 결정 — 충격 수치 / 자기의심+FOMO / 통념 반박 / 비밀 / 손실회피 / 모순·반전 중 택1

[2단계: 글 형식 — 반드시 지키세요]
- 본문 400~700자 (짧을수록 미끼 강도↑, 길면 광고 의심)
- 어조: ${spec.toneNote || '반말 + 도메인 전문 용어'}
- ${spec.domainNote || '도메인 전문성'} 노출 필수 (전문 용어 1~2개 자연스럽게)
- 첫 줄(20~35자): 위에서 결정한 강한 후크 1개 (질문/진술 X)
- 본문에서 핵심 답을 다 풀지 말 것 — "그래서 얼마인데?", "나도 해당되나?" 같은 미해결 질문을 끝에 남길 것
- 마지막 1~2줄: cliffhanger + "출처: ${'$'}{URL}" 자연스러운 형태
- 자기 홍보 어투 절대 금지

[3단계: 미끼·티저 (필수 — 클릭은 찝찝함에서 나옴)]
✅ 본문에 풀: 누가 대략, 충격 수치 1개, 왜 지금, 글쓴이 한 줄 반응
❌ 본문 금지(링크에서만): 정확한 자격/조건, 단계별 신청법, 정확한 금액 계산, "내 케이스 해당 여부" 판단 기준
✅ 본문 끝 cliffhanger 1개 필수:
- "조건이 까다로워서 본인 케이스가 해당되는지는 직접 확인해야 함"
- "신청 방법 정리된 글 참고했음 — 링크"
- "정확한 금액은 케이스마다 다르니까 한번 확인해보길"

[금지]
- "여러분", "안녕하세요 이웃님들" 같은 단체 인사
- "100% 보장", "무조건", "바로 클릭" 같은 광고 어휘
- 누구나 검색하면 나오는 평범한 정보를 그대로 옮기기
- 원문에 없는 금액·조건·기간·대상자 만들어내기
- 첫 줄에 링크`;
      return appendUserNoteSafely(base, userCustomRule);
    },
    buildUserPrompt: ({ sourceSummary, sourceUrl, sourceTitle }) => {
      const summary = sourceSummary || {};
      const points = Array.isArray(summary.keyPoints) ? summary.keyPoints.join(', ') : '';
      const data = Array.isArray(summary.dataPoints) ? summary.dataPoints.join(', ') : '';
      return `원본 글: "${sourceTitle}"
URL: ${sourceUrl}

[원본 요약]
- 핵심 가치: ${summary.coreValue || ''}
- 주요 포인트: ${points}
- 수치/데이터: ${data}

${spec.name}에 어울리는 글 1편을 작성하세요. 본문 400~700자, 마지막에 "출처: ${sourceUrl}". 위 [1~3단계] 룰을 모두 지킬 것.`;
    },
    ...spec,
    id: spec.id,
    name: spec.name,
  });
}

module.exports = { makeSpecialized };
