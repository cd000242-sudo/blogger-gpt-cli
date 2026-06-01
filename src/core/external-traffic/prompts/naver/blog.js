// src/core/external-traffic/prompts/naver/blog.js
// 네이버 블로그 — C-Rank + D.I.A 2.0 + D.I.A.+ + 인기글 스마트블록 + 인플루언서 검색.
// R3 deep-research (2026-06-01) verified — 1차 다수 출처 확보.

'use strict';

const { assessRiskMultiAxis } = require('../../_shared/risk-assess');
const { appendUserNoteSafely } = require('../../_shared/sanitize');

/** @type {import('../../_shared/types').ChannelPrompt} */
const NAVER_BLOG = {
  id: 'naver-blog',
  name: '네이버 블로그',
  category: 'naver',
  riskTier: 'low',
  confidence: 'verified',
  icon: '📝',
  color: '#03c75a',
  openUrl: 'https://blog.naver.com/',

  // R3 verified: 인기글 스마트블록 시대 → 단일 키워드 1위 독점 X, 롱테일 매칭 출발점.
  killerHookPatterns: [
    '~ 직접 해본 실제 후기',
    '~ 4번 출구 가깝다는 거 알았어요',  // 구체 검증 가능 디테일 (D.I.A+ 신뢰도)
    '~ 단계별 정리 (체크리스트)',
    '~ 비교 표 (직접 측정)',
    '~ 한 결과 실제 데이터',
    '~ 알아두면 좋은 ~',
    '~ 정리 (개인 후기)',
    '~ 실측 ~',
    '~ 진짜 경험담',
  ],
  // R3 verified: D.I.A 광고성 분류 + 어뷰징 트리거 + 2025-09 매크로 형사처벌 (서울남부지법).
  bannedPhrases: [
    '이거 광고 아니에요',
    '내돈내산 강조',
    '안녕하세요 ~ 입니다',         // R3: 인사 서론 D.I.A.+ 신뢰도 하락
    '오늘 날씨가 좋네요',           // R3: 의미 없는 서론
    '협찬',                          // 광고성 분류
    '키워드챌린지 반복 삭제',     // 30일 페널티 (2023-10-05 시행)
    '동일 IP 매크로',              // 컴퓨터등장애업무방해죄 (2025-09-10 1심 유죄)
    '품앗이',                        // 매크로 SEO 형사처벌 대상
  ],
  // R3 verified: 직접 사진 + 구체 디테일 + 체류시간 2:30~3:00 + 단일 분야 누적.
  popularityTriggers: [
    '직접 촬영 사진/영상 (스톡 X)',
    '구체 검증 가능 디테일 ("4번 출구", "2층 화장실")',
    '단계별 설명 (소제목 + 불렛 + 표)',
    '체크리스트',
    '비교 표 (직접 측정)',
    '단일 분야 누적 50+ (잡블로그 X)',
    '롱테일 키워드 매칭 (스마트블록)',
    '진성 이웃 소통 (체류시간 2:30~3:00)',
  ],
  toneSignature: {
    formality: 'polite',
    emoji: 'medium',
    slang: [],
    pronouns: ['저', '저희'],
  },
  transformationAxes: {
    titleRule: '롱테일 키워드 (스마트블록 매칭) + 구체 의도 ("아이와 가기 좋은", "현지인 추천" 등).',
    bodyRule: '본문 800~3,000자 권장 (정량 sweet-spot은 refuted, 800자 이상 권장). 도입-요약-상세-경험담 + 소제목 3~5 + 직접 사진.',
    ctaPlacement: 'separate-block',
    linkBait: [
      '더 자세한 내용:',
      '관련 포스팅:',
      '참고:',
      '풀버전 정리:',
    ],
  },
  paragraphRule: {
    maxLineChars: 40,
    paragraphBreak: 'double',
    emptyLineMaxConsecutive: 1,
    headingStyle: 'bold-line',
    photoPlaceholder: '[사진 자리]',
    photoBetweenParagraphs: 3,
    ctaSection: 'separate-block',
  },
  bandThresholds: { low: 50, medium: 75, high: 90, critical: 100 },
  maxOutputTokens: 3800,

  buildSystemPrompt: (subChannel, userCustomRule) => {
    const base = `당신은 한국 네이버 블로그 운영자입니다 (2025~2026 알고리즘 검증).

[글 형식 — R3 검증 기반]
- 본문 800~3,000자 (정량 sweet-spot은 마케터 사이 의견 차 — 검증된 하한 800자)
- 줄당 35~40자
- 소제목 3~5개로 호흡 분리
- 문단 사이 빈 줄 1줄
- 3문단마다 [사진 자리] 표시 (직접 촬영 권장 — 스톡 이미지는 D.I.A.+ 신뢰도 하락)
- 본문 끝에 별도 박스 "📌 더 자세한 내용: [URL]"

[D.I.A.+ 신뢰도 점수 끌어올리는 패턴 — R3 verified]
- 도입-요약-상세-경험담 구조
- 첫 문단에서 핵심 정보 던지기 (서론은 150자 이내)
- "안녕하세요~ 오늘 날씨가 좋네요" 같은 의미 없는 서론 X
- 구체 검증 가능 디테일 ("4번 출구 가깝다", "2층 화장실은 여성용만") 적극 삽입
- 직접 촬영 사진/영상 > 스톡 이미지

[C-Rank 토픽 권위]
- 단일 분야 누적 50개+ 권장 (잡블로그 X)
- 31개 토픽 카테고리 딥러닝 분류로 주제별 신뢰도 누적

[스마트블록 시대 (2024-02-01~)]
- VIEW 탭 단일 1위 시대 종료
- 검색 의도별 큐레이션 블록 매칭이 출발점
- 롱테일 키워드 ("강남역 조용한 소개팅 장소" 같은 구체 의도) 우선

[인플루언서 검색 (2023-11-23~)]
- 구독자 수보다 문서 품질이 상위 노출 결정
- 서비스 활성도 (꾸준한 키워드챌린지 참여) 가중치 강화

[금지 — D.I.A. 광고성 분류 + 매크로 SEO 형사처벌 대상]
- 광고 어투 ("이거 광고 아니에요", "내돈내산 강조")
- 키워드 채우기 = 어뷰징
- 키워드챌린지 반복 삭제 = 30일 페널티
- 매크로 공감·스크랩·댓글·키워드 검색 후 접속 = 컴퓨터등장애업무방해죄 (2025-09 1심 유죄)
- 타인 명의 계정 구매·반복 게재 = 형사처벌 대상`;
    return appendUserNoteSafely(base, userCustomRule);
  },

  buildUserPrompt: ({ sourceSummary, sourceUrl, sourceTitle }) => `원본 글: "${sourceTitle}"
URL (본문 끝 박스에 사용): ${sourceUrl}

[원본 요약]
- 핵심 가치: ${sourceSummary.coreValue}
- 핵심 포인트: ${sourceSummary.keyPoints.join(' / ')}
- 키워드: ${sourceSummary.keywords.join(', ')}
- 데이터: ${sourceSummary.dataPoints.join(', ')}

네이버 블로그 글 1편 (800~3,000자)을 작성하세요.
- 첫 문단 = 핵심 정보 (인사 서론 X)
- 도입-요약-상세-경험담 구조
- 소제목 3~5개로 호흡 분리
- 줄당 35~40자
- 구체 검증 가능 디테일 적극 삽입 ("4번 출구", "실측 ~" 등)
- 본문 끝 박스 "📌 더 자세한 내용: ${sourceUrl}"
- [사진 자리]는 출력하지 말 것 — postFormat에서 자동 삽입`,

  assessRisk(response) {
    return assessRiskMultiAxis(response, NAVER_BLOG);
  },

  userWarning: null,
  operationalNotes: [
    'C-Rank: 31개 토픽 딥러닝 분류, 토픽 권위 약 40% 가중치',
    'D.I.A 2.0: 문서 품질·경험·구조 평가',
    'D.I.A.+: 질의 의도·딥 매칭·동적 랭킹 + HyperCLOVA X 적용',
    '2024-02-01 인기글 스마트블록 도입 → VIEW 탭 1위 시대 종료',
    '2023-11-23 인플루언서 검색: 구독자 수보다 문서 품질',
    '2023-11-06 서비스 활성도 가중치 + 키워드챌린지 30일 페널티',
    '2025-09-10 서울남부지법 1심: 매크로 SEO 컴퓨터등장애업무방해죄 (징역 1년 + 추징금 23억)',
    '체류시간 2:30~3:00 sweet-spot (단, 과도한 댓글·공감 비율은 어뷰징 탐지 트리거)',
  ],
  researchSources: [
    'https://www.twinword.co.kr/blog/naver-seo-d-i-a/',
    'https://onfunnels.com/%EB%84%A4%EC%9D%B4%EB%B2%84-%EA%B2%80%EC%83%89%EC%97%94%EC%A7%84%EC%B5%9C%EC%A0%81%ED%99%94-seo/',
    'https://www.ascentkorea.com/naver_seo_strategies_2/',
    'https://www.kmjournal.net/news/articleView.html?idxno=6376',
    'https://gobooki.net/%EB%84%A4%EC%9D%B4%EB%B2%84-%EC%9D%B8%ED%94%8C%EB%A3%A8%EC%96%B8%EC%84%9C-%EA%B2%80%EC%83%89-%EC%95%8C%EA%B3%A0%EB%A6%AC%EC%A6%98-%EB%B3%80%EA%B2%BD/',
    'https://sigmine.ai/blog/naver-blog-seo-strategy-202605-2',
    'https://www.newsis.com/view/NISX20250926_0003346211',
    'https://brunch.co.kr/@@1Mj0/433',
  ],
  lastVerified: '2026-06-01',
};

module.exports = NAVER_BLOG;
