// src/core/max-mode/section-configs.ts
// 기본 섹션 구조 및 콘텐츠 모드 설정

import type { MaxModeSection, ContentModeConfig } from './types-interfaces';

// 일정표/표 형태 콘텐츠용 섹션 구조
export const SCHEDULE_MODE_SECTIONS: MaxModeSection[] = [
  {
    id: "introduction",
    title: "개요",
    description: "일정표 개요와 주요 정보를 소개하는 섹션",
    minChars: 600,
    role: "체계적이고 정확한 정보를 제공하는 전문가",
    contentFocus: "일정표 개요, 주요 일정, 중요 정보 요약",
    requiredElements: [
      "일정표 개요 설명",
      "주요 일정 요약",
      "중요한 정보 강조",
      "자연스러운 키워드 포함"
    ]
  },
  {
    id: "schedule_table",
    title: "상세 일정표",
    description: "체계적인 일정표나 표 형태로 정보를 제공하는 섹션",
    minChars: 1000,
    role: "정확하고 체계적인 정보를 정리하는 전문가",
    contentFocus: "표 형태의 체계적 정보, 시간/날짜/장소 등 구체적 정보",
    requiredElements: [
      "표나 리스트 형태의 체계적 정보",
      "구체적인 시간, 날짜, 장소 정보",
      "정확하고 검증된 데이터",
      "이해하기 쉬운 구조화"
    ]
  },
  {
    id: "important_info",
    title: "중요 정보",
    description: "일정표에서 주의해야 할 중요한 정보를 제공하는 섹션",
    minChars: 800,
    role: "실무 경험이 풍부한 전문가",
    contentFocus: "주의사항, 변경 가능성, 추가 정보",
    requiredElements: [
      "주의사항이나 변경 가능성",
      "추가로 알아야 할 정보",
      "실용적인 팁",
      "관련 링크나 연락처"
    ]
  },
  {
    id: "tips_guide",
    title: "활용 가이드",
    description: "일정표를 효과적으로 활용하는 방법을 안내하는 섹션",
    minChars: 700,
    role: "실무 경험이 풍부한 전문가",
    contentFocus: "활용 방법, 팁, 실용적 조언",
    requiredElements: [
      "일정표 활용 방법",
      "실용적인 팁과 조언",
      "주의할 점",
      "추가 도움이 되는 정보"
    ]
  },
  {
    id: "conclusion",
    title: "마무리",
    description: "일정표 정보를 요약하고 마무리하는 섹션",
    minChars: 500,
    role: "정보를 정리하고 요약하는 전문가",
    contentFocus: "핵심 정보 요약, 추가 안내, 마무리",
    requiredElements: [
      "핵심 정보 요약",
      "추가 안내나 연락처",
      "마무리 멘트",
      "관련 정보나 링크"
    ]
  }
];

// 🔥 SEO 모드 - 크롤링 기반 5개 섹션 구조
export const MAX_MODE_SECTIONS: MaxModeSection[] = [
  {
    id: "section_1",
    title: "[크롤링 기반 소제목 1]",
    description: "크롤링된 조회수 1위 주제",
    minChars: 1500,
    role: "SEO 전문가",
    contentFocus: "크롤링 데이터 기반 + 조회수 최고 주제",
    requiredElements: [
      "크롤링된 인기 키워드 포함",
      "독자 질문에 대한 명확한 답변",
      "구체적 데이터와 통계",
      "실용적 정보 제공"
    ]
  },
  {
    id: "section_2",
    title: "[크롤링 기반 소제목 2]",
    description: "크롤링된 조회수 2위 주제",
    minChars: 1500,
    role: "SEO 전문가",
    contentFocus: "크롤링 데이터 기반 + 조회수 2위 주제",
    requiredElements: [
      "크롤링된 인기 키워드 포함",
      "독자 질문에 대한 명확한 답변",
      "구체적 데이터와 통계",
      "실용적 정보 제공"
    ]
  },
  {
    id: "section_3",
    title: "[크롤링 기반 소제목 3]",
    description: "크롤링된 조회수 3위 주제",
    minChars: 1500,
    role: "SEO 전문가",
    contentFocus: "크롤링 데이터 기반 + 조회수 3위 주제",
    requiredElements: [
      "크롤링된 인기 키워드 포함",
      "독자 질문에 대한 명확한 답변",
      "구체적 데이터와 통계",
      "실용적 정보 제공"
    ]
  },
  {
    id: "section_4",
    title: "[크롤링 기반 소제목 4]",
    description: "크롤링된 조회수 4위 주제",
    minChars: 1500,
    role: "SEO 전문가",
    contentFocus: "크롤링 데이터 기반 + 조회수 4위 주제",
    requiredElements: [
      "크롤링된 인기 키워드 포함",
      "독자 질문에 대한 명확한 답변",
      "구체적 데이터와 통계",
      "실용적 정보 제공"
    ]
  },
  {
    id: "section_5",
    title: "[크롤링 기반 소제목 5]",
    description: "크롤링된 조회수 5위 주제",
    minChars: 1500,
    role: "SEO 전문가",
    contentFocus: "크롤링 데이터 기반 + 조회수 5위 주제",
    requiredElements: [
      "크롤링된 인기 키워드 포함",
      "독자 질문에 대한 명확한 답변",
      "구체적 데이터와 통계",
      "실용적 정보 제공"
    ]
  }
];

export const CONTENT_MODE_CONFIGS: Record<string, ContentModeConfig> = {
  external: {
    name: "SEO 최적화 모드",
    description: "검색 엔진 최적화에 중점을 둔 콘텐츠",
    titleStrategy: "SEO 키워드 포함, 클릭률 최적화, 검색 의도 반영",
    sectionStrategy: "키워드 밀도 최적화, 구조화된 정보 제공, 사용자 경험 향상",
    tone: "전문적이면서도 친근한 톤으로 신뢰성 있는 정보 제공",
    ctaStrategy: "자연스러운 내부 링크와 관련 콘텐츠 연결"
  },
  internal: {
    name: "내부링크 일관성 모드",
    description: "사이트 내 콘텐츠 간 연결과 일관성에 중점",
    titleStrategy: "사이트 내 다른 글과 연결되는 키워드 중심",
    sectionStrategy: "관련 주제 연결, 시리즈 형태 구성, 독자 유도",
    tone: "일관된 브랜드 톤으로 독자와의 관계 구축",
    ctaStrategy: "관련 글 추천과 시리즈 연결"
  },
  shopping: {
    name: "쇼핑/구매유도 모드",
    description: "구매 전환에 최적화된 마케팅 콘텐츠",
    titleStrategy: "문제 해결형, 비밀 공개형, 숫자·리스트형, 긴급·한정형, 결과 보장형, 공감 질문형, 비교·대조형",
    sectionStrategy: "후킹→문제제기→해결책→사회적증거→스토리텔링→시각적분할→희소성·긴급성→CTA→안전장치→클로징",
    tone: "구매를 유도하되 과대광고 없이 신뢰성 있는 톤",
    ctaStrategy: "구매 전환 최적화 CTA"
  },
  adsense: {
    name: "애드센스 승인 전문 모드",
    description: "애드센스 승인을 위한 고품질 전문 콘텐츠",
    titleStrategy: "독창적이고 가치있는 제목, 교육적 가치 중심",
    sectionStrategy: "작성자 소개→서론→완전히 이해하기→직접 경험→단계별 가이드→비교 분석→마무리 리소스",
    tone: "전문적이고 신뢰할 수 있는 톤으로 E-E-A-T 강조",
    ctaStrategy: "자연스러운 내부 링크와 관련 정보 제공"
  },
  paraphrasing: {
    name: "페러프레이징 전문 모드",
    description: "원문을 완전히 다른 표현으로 재작성하는 전문 모드",
    titleStrategy: "원문 제목을 완전히 다른 표현으로, 같은 의미 다른 어순/단어",
    sectionStrategy: "서론 페러프레이징→내용 확장→관점 전환→구조 재편성→새 내용 추가→종합 정리",
    tone: "원문과 유사하지만 완전히 다른 표현으로 작성",
    ctaStrategy: "자연스러운 내부 링크와 관련 정보 제공"
  }
};
