// src/core/max-mode/mode-sections-extended.ts
// 확장 콘텐츠 모드 섹션 구조 정의

import type { MaxModeSection, ContentModeConfig } from './types-interfaces';
import { MAX_MODE_SECTIONS } from './section-configs';

// 🔧 모듈 로드 시점의 연도 (프롬프트에 전달되는 섹션 설명 문자열에서 bare "년" 방지용)
const RESOLVED_YEAR = new Date().getFullYear();

// ============================================================================
// 새로운 콘텐츠 모드 구조 정의
// ============================================================================

// 일관성/거미줄치기 전문 모드 섹션 구조
export const SPIDERWEBBING_MODE_SECTIONS: MaxModeSection[] = [
  {
    id: "introduction",
    title: "서론",
    description: "검색 의도 파악 및 메인 키워드 자연스러운 삽입",
    minChars: 300,
    role: "검색엔진 최적화 전문가",
    contentFocus: "검색 의도 파악, 메인 키워드 2회 삽입, 가치 제시",
    requiredElements: [
      "검색 의도 파악 문구",
      "메인 키워드 자연스럽게 2회 삽입",
      "이 글에서 얻을 수 있는 가치 제시",
      "독자 관심 유도"
    ]
  },
  {
    id: "basic_concept",
    title: "[메인 키워드]란 무엇인가?",
    description: "기본 개념과 핵심 특징을 설명하는 섹션",
    minChars: 1300,
    role: "해당 분야 전문가",
    contentFocus: "정의, 핵심 특징, 중요성, 최신 트렌드",
    requiredElements: [
      "정의와 핵심 특징 (300-400자)",
      "중요한 이유와 실생활 활용 사례 (400-500자)",
      "최신 트렌드 및 변화 (300-400자)",
      "관련 이미지 1-2개 (alt 태그 포함)",
      "내부링크 1개 삽입"
    ]
  },
  {
    id: "types_classification",
    title: "[롱테일 키워드 1] 종류 및 분류",
    description: "유형별 상세 분류와 선택 기준을 제공하는 섹션",
    minChars: 1500,
    role: "분류 및 비교 분석 전문가",
    contentFocus: "유형별 분류, 선택 기준, 전문가 추천 조합",
    requiredElements: [
      "유형별 상세 분류 (카테고리별 특징과 장단점)",
      "각 유형별 선택 기준 (상황별 추천)",
      "전문가가 추천하는 조합 (실제 활용 예시)",
      "비교표 삽입",
      "LSI 키워드 자연스럽게 5-7회 포함"
    ]
  },
  {
    id: "practical_guide",
    title: "[롱테일 키워드 2] 방법 및 절차",
    description: "실전 가이드와 단계별 실행 방법을 제공하는 섹션",
    minChars: 1500,
    role: "실무 경험 풍부한 전문가",
    contentFocus: "준비 단계, 단계별 실행 방법, 흔한 실수와 해결책",
    requiredElements: [
      "준비 단계 (필요한 도구/재료, 소요 시간/비용)",
      "단계별 실행 방법 (Step 1-4, 각 150자씩)",
      "흔한 실수 및 해결책 (실수 사례 3가지)",
      "각 단계별 이미지 권장",
      "체크리스트 박스"
    ]
  },
  {
    id: "comparison_recommendation",
    title: "[롱테일 키워드 3] 비교 및 추천",
    description: "심화 분석과 상황별 맞춤 추천을 제공하는 섹션",
    minChars: 1500,
    role: "비교 분석 및 추천 전문가",
    contentFocus: "주요 옵션 비교, 상황별 추천, 실사용 후기",
    requiredElements: [
      "주요 옵션 비교 분석 (A vs B vs C 상세 비교표)",
      "상황별 맞춤 추천 (초보자/중급자/전문가용)",
      "실사용 후기 및 평가 (1인칭 시점, 장단점)",
      "외부 리뷰 링크 1-2개",
      "가격 정보 (최신 업데이트)"
    ]
  },
  {
    id: "faq_conclusion",
    title: "실행 체크리스트 + 마무리 가이드",
    description: "단계별 실행 가이드와 마무리 정리를 제공하는 섹션",
    minChars: 1500,
    role: "실행 가이드 및 콘텐츠 마무리 전문가",
    contentFocus: "단계별 실행 체크리스트, 실천 팁, 결론 및 다음 스텝",
    requiredElements: [
      "단계별 실행 체크리스트 (10-15개 항목)",
      "각 단계별 상세 설명과 주의사항",
      "시간 절약 팁과 고급 기법",
      "결론 및 다음 스텝 (핵심 내용 요약)",
      "추가 리소스 및 참고자료 링크",
      "마지막 업데이트 날짜 표시"
    ]
  }
];

// 애드센스 승인 전문 모드 섹션 구조
export const ADSENSE_MODE_SECTIONS: MaxModeSection[] = [
  {
    id: "author_intro",
    title: "작성자 소개",
    description: "전문성과 경험을 간단히 제시하는 섹션",
    minChars: 100,
    role: "신뢰할 수 있는 전문가",
    contentFocus: "전문성/경험 간단히 제시, 신뢰감 형성",
    requiredElements: [
      "전문성/경험 간단히 제시",
      "5년간 이 분야에서... 형식",
      "신뢰감을 주는 표현"
    ]
  },
  {
    id: "introduction",
    title: "서론",
    description: "독자 문제 공감과 독창적 가치 제시",
    minChars: 300,
    role: "공감과 가치 전달 전문가",
    contentFocus: "독자 문제 공감, 독창적 가치, 직접 경험 강조",
    requiredElements: [
      "독자 문제 공감",
      "이 글의 독창적 가치",
      "직접 경험 강조",
      "독자 관심 유도"
    ]
  },
  {
    id: "complete_understanding",
    title: "[주제] 완전히 이해하기",
    description: "교육적 가치를 제공하는 섹션",
    minChars: 1500,
    role: "교육 전문가",
    contentFocus: "기초 설명, 실생활 예시, 오해와 진실",
    requiredElements: [
      "기초부터 차근차근 (전문 용어 쉽게 풀어쓰기)",
      "실생활 예시로 설명 (직접 겪은 사례 스토리텔링)",
      "흔한 오해와 진실 (잘못 알려진 정보 바로잡기)",
      "직접 촬영한 이미지 또는 직접 만든 도표",
      "저작권 free 이미지 사용"
    ]
  },
  {
    id: "personal_experience",
    title: "제가 직접 해본 [실전 경험]",
    description: "독창성의 핵심이 되는 직접 경험 섹션",
    minChars: 1500,
    role: "실전 경험 풍부한 전문가",
    contentFocus: "시작 계기, 시행착오, 최종 결과와 성과",
    requiredElements: [
      "시작하게 된 계기 (1인칭 시점 스토리)",
      "과정에서 겪은 시행착오 (실패 사례 3가지 솔직하게)",
      "최종 결과와 성과 (Before & After 비교)",
      "과정 사진 3-4장 (직접 촬영)",
      "타임라인 인포그래픽"
    ]
  },
  {
    id: "step_by_step_guide",
    title: "단계별 실행 가이드",
    description: "실용적 가치를 제공하는 섹션",
    minChars: 1500,
    role: "실무 가이드 전문가",
    contentFocus: "준비물과 체크리스트, 따라하기 쉬운 단계, 체크포인트",
    requiredElements: [
      "준비물과 사전 체크리스트 (필요한 것 상세 리스트)",
      "따라하기 쉬운 10단계 (각 150-200자씩 상세 설명)",
      "단계별 체크포인트 (제대로 하고 있는지 확인 방법)",
      "단계별 스크린샷 또는 사진",
      "다운로드 가능한 체크리스트"
    ]
  },
  {
    id: "comparison_analysis",
    title: "비교 분석 및 추천",
    description: "전문성을 강조하는 섹션",
    minChars: 1500,
    role: "비교 분석 전문가",
    contentFocus: "주요 옵션 심층 비교, 상황별 맞춤 추천, 피해야 할 것들",
    requiredElements: [
      "주요 옵션 심층 비교 (직접 사용해본 3-5가지 옵션)",
      "상황별 맞춤 추천 (예산별, 수준별 추천)",
      "피해야 할 것들 (광고성 정보 아닌 진짜 조언)",
      "비교표 이미지 (직접 제작)",
      "가격 정보 최신 업데이트"
    ]
  },
  {
    id: "core6",
    title: "핵심 내용 6",
    description: "주제의 여섯 번째 핵심 포인트를 다루는 섹션",
    minChars: 1200,
    role: "실무 경험이 풍부한 전문가",
    contentFocus: "고급 기법, 심화된 정보, 전문적 인사이트",
    requiredElements: [
      "고급 기법과 심화된 정보",
      "전문가 수준의 인사이트",
      "실제 사례와 적용 방법",
      "주의사항이나 팁"
    ]
  },
  {
    id: "core7",
    title: "핵심 내용 7",
    description: "주제의 일곱 번째 핵심 포인트를 다루는 섹션",
    minChars: 1200,
    role: "실무 경험이 풍부한 전문가",
    contentFocus: "최종 정리, 종합적 관점, 실전 적용",
    requiredElements: [
      "종합적 관점과 최종 정리",
      "실전 적용 방법",
      "통합적 해결책",
      "마무리 조언"
    ]
  },
  {
    id: "conclusion_resources",
    title: "마무리 및 추가 리소스",
    description: "핵심 정리와 추가 자료를 제공하는 섹션",
    minChars: 1500,
    role: "콘텐츠 마무리 전문가",
    contentFocus: "핵심 내용 정리, FAQ, 도움이 되는 자료",
    requiredElements: [
      "핵심 내용 정리 (꼭 기억해야 할 3가지)",
      "자주 묻는 질문 6-8개 (실제 받은 질문 기반)",
      "도움이 되는 자료 및 참고링크 (신뢰할 수 있는 외부 사이트)",
      "댓글로 추가 질문 유도",
      "관련 글 추천 (내부링크 2-3개)"
    ]
  }
];

// 페러프레이징 전문 모드 섹션 구조
// 쇼핑/구매유도 모드용 7번 소제목 구조
export const SHOPPING_MODE_SECTIONS: MaxModeSection[] = [
  {
    id: "product_introduction",
    title: "제품 소개 및 개요",
    description: "제품의 기본 정보와 핵심 특징을 소개하는 섹션",
    minChars: 800,
    role: "제품 전문가이자 구매 컨설턴트",
    contentFocus: "제품의 핵심 가치와 차별화 포인트 강조",
    requiredElements: [
      "제품의 핵심 특징과 장점",
      "경쟁사 대비 차별화 포인트",
      "타겟 고객층과 사용 시나리오",
      "구매 전 확인해야 할 핵심 정보"
    ]
  },
  {
    id: "detailed_analysis",
    title: "상세 분석 및 리뷰",
    description: "제품의 세부 기능과 성능을 분석하는 섹션",
    minChars: 1000,
    role: "제품 테스터이자 기술 분석가",
    contentFocus: "제품의 세부 기능, 성능, 품질 분석",
    requiredElements: [
      "제품의 세부 기능 분석",
      "실제 사용 경험과 테스트 결과",
      "품질과 내구성 평가",
      "사용자 피드백과 리뷰 반영"
    ]
  },
  {
    id: "comparison_guide",
    title: "비교 분석 및 선택 가이드",
    description: "경쟁 제품과의 비교 및 선택 기준을 제시하는 섹션",
    minChars: 900,
    role: "비교 분석 전문가",
    contentFocus: "경쟁 제품 비교, 선택 기준, 구매 팁",
    requiredElements: [
      "경쟁 제품과의 상세 비교",
      "가격 대비 성능 분석",
      "구매 시나리오별 추천",
      "선택 기준과 체크리스트"
    ]
  },
  {
    id: "buying_guide",
    title: "구매 가이드 및 팁",
    description: "실제 구매 시 고려사항과 팁을 제공하는 섹션",
    minChars: 800,
    role: "구매 컨설턴트",
    contentFocus: "구매 전략, 할인 정보, 구매 시기",
    requiredElements: [
      "구매 시기와 할인 정보",
      "구매처 비교 및 추천",
      "구매 전 체크리스트",
      "추가 구매 고려사항"
    ]
  },
  {
    id: "user_experience",
    title: "사용자 경험 및 후기",
    description: "실제 사용자들의 경험과 후기를 다루는 섹션",
    minChars: 700,
    role: "사용자 경험 분석가",
    contentFocus: "실제 사용 후기, 만족도, 개선점",
    requiredElements: [
      "다양한 사용자 후기 수집",
      "장단점과 개선점 분석",
      "사용 시 주의사항",
      "만족도와 재구매 의도"
    ]
  },
  {
    id: "decision_making",
    title: "구매 결정을 위한 최종 가이드",
    description: "구매 결정을 돕는 종합적인 정보를 제공하는 섹션",
    minChars: 900,
    role: "구매 결정 컨설턴트",
    contentFocus: "구매 결정 요인, 최종 추천, 결론",
    requiredElements: [
      "구매 결정에 영향을 주는 핵심 요소",
      "개인별 맞춤 추천 기준",
      "구매하지 않아도 되는 경우",
      "최종 구매 추천 및 이유"
    ]
  },
  {
    id: "conversion_optimization",
    title: "구매 전환 최적화 및 행동 유도",
    description: "고객의 구매 결심을 유도하는 마지막 섹션",
    minChars: 800,
    role: "마케팅 심리학자이자 구매 유도 전문가",
    contentFocus: "구매 결심 유도, 긴급성 조성, 행동 촉구",
    requiredElements: [
      "구매 결심을 유도하는 심리적 요소",
      "한정성과 긴급성 조성",
      "구매 후 기대 효과 강조",
      "즉시 행동을 유도하는 CTA"
    ]
  }
];

export const PARAPHRASING_MODE_SECTIONS: MaxModeSection[] = [
  {
    id: "introduction",
    title: "서론",
    description: "원문 서론의 의미를 완전히 다른 표현으로 재작성",
    minChars: 300,
    role: "페러프레이징 전문가",
    contentFocus: "원문 서론 의미만 가져오기, 문장 구조 100% 변경",
    requiredElements: [
      "원문 서론의 의미만 가져오기",
      "문장 구조 100% 변경",
      "수동태↔능동태 전환",
      "독자 관심 유도"
    ]
  },
  {
    id: "different_perspective",
    title: "[원문 H2-1 주제를 다르게 표현]",
    description: "원문 내용에 새로운 관점을 추가하는 섹션",
    minChars: 1500,
    role: "관점 전환 전문가",
    contentFocus: "원문 내용 + 새로운 관점, 다른 순서로 재배치, 보충 내용",
    requiredElements: [
      "유의어/동의어 100% 치환",
      `원문에 없던 최신 데이터 추가 (${RESOLVED_YEAR}년)`,
      "원문 내용을 다른 순서로 재배치",
      "원문에 없던 보충 내용",
      "새로운 이미지/그래프 제작"
    ]
  },
  {
    id: "expanded_content",
    title: "[원문 H2-2 내용을 확장/심화]",
    description: "원문 내용을 확장하고 심화하는 섹션",
    minChars: 1500,
    role: "내용 확장 전문가",
    contentFocus: "원문 핵심을 다른 각도에서, 대조적 사례, 실용적 적용 방법",
    requiredElements: [
      "원문 핵심을 다른 각도에서 접근",
      "원문 내용 + 대조적 사례",
      "실용적 적용 방법 추가",
      "인용문 재작성 (의미 유지, 표현 변경)",
      "LSI 키워드 자연스럽게 포함"
    ]
  },
  {
    id: "restructured_content",
    title: "[원문 H2-3을 구조부터 바꿔서]",
    description: "원문 구조를 완전히 바꿔서 재구성하는 섹션",
    minChars: 1500,
    role: "구조 재편성 전문가",
    contentFocus: "원문 마지막 부분을 앞으로, 중간 부분 확장, Case Study 형식",
    requiredElements: [
      "원문 마지막 부분을 앞으로 배치",
      "원문 중간 부분 확장 (2문장 → 1개 문단)",
      "Case Study 형식으로 재구성",
      "숫자/통계 최신 데이터로 업데이트",
      "구어체 ↔ 문어체 전환"
    ]
  },
  {
    id: "new_section",
    title: "[원문에 없던 새 섹션 추가]",
    description: "원문에 없던 새로운 섹션을 추가하는 섹션",
    minChars: 1500,
    role: "콘텐츠 확장 전문가",
    contentFocus: "최신 트렌드 반영, 반대 의견/비판적 시각, 실전 체크리스트",
    requiredElements: [
      `최신 트렌드 반영 (2024-${RESOLVED_YEAR}년 변화)`,
      "반대 의견/비판적 시각 (균형잡힌 시각)",
      "실전 체크리스트 (오늘 바로 실천 가능한 5가지)",
      "원문 대비 20-30% 새로운 정보",
      "전문가 의견 추가"
    ]
  },
  {
    id: "comprehensive_conclusion",
    title: "종합 정리 및 확장",
    description: "원문과 다른 결론을 제공하는 섹션",
    minChars: 1500,
    role: "종합 정리 전문가",
    contentFocus: "핵심 요약 (다른 표현), 추가 인사이트, FAQ (원문에 없던 질문)",
    requiredElements: [
      "핵심 요약 (완전히 다른 3줄)",
      "추가 인사이트 (원문에서 언급 안 된 관련 주제)",
      "FAQ (원문에 없던 질문 5개)",
      "참고자료 다시 찾아서 재구성",
      "관련 글 추천"
    ]
  }
];

// 콘텐츠 모드 설정 업데이트
export const UPDATED_CONTENT_MODE_CONFIGS: Record<string, ContentModeConfig> = {
  external: {
    name: "SEO 최적화 모드",
    description: "검색엔진 최적화에 중점을 둔 콘텐츠(기존 맥스 모드)",
    titleStrategy: "SEO 키워드 포함, 클릭률 최적화, 검색 노출 극대화",
    sectionStrategy: "키워드 밀도 최적화된 구조, 사용자 경험 향상, 전환율 극대화",
    tone: "전문적이면서도 친근한 톤으로 신뢰감을 주는 최적화된 콘텐츠",
    ctaStrategy: "명확한 행동 유도와 전환 최적화된 콘텐츠 구조"
  },
  spiderwebbing: {
    name: "일관성/거미줄치기 전문 모드",
    description: "체계적이고 일관성 있는 정보 제공에 중점을 둔 모드",
    titleStrategy: `완벽 가이드 형식, ${RESOLVED_YEAR}년 최신 정보 강조`,
    sectionStrategy: "기본 개념 → 종류 분류 → 실전 가이드 → 비교 추천 → FAQ 마무리",
    tone: "전문적이면서도 이해하기 쉬운 교육적 톤",
    ctaStrategy: "자연스러운 내부링크 연결과 관련 콘텐츠 추천"
  },
  adsense: {
    name: "애드센스 승인 전문 모드",
    description: "E-E-A-T 원칙을 강화한 독창적이고 가치있는 콘텐츠",
    titleStrategy: "독창적이고 가치있는 제목, 직접 경험 강조",
    sectionStrategy: "작성자 소개 → 서론 → 완전 이해 → 직접 경험 → 실행 가이드 → 비교 분석 → 마무리",
    tone: "신뢰할 수 있는 전문가의 솔직하고 실용적인 톤",
    ctaStrategy: "자연스러운 관련 콘텐츠 추천과 댓글 유도"
  },
  paraphrasing: {
    name: "페러프레이징 전문 모드",
    description: "원문을 완전히 다른 표현으로 재작성하는 모드",
    titleStrategy: "원문 제목을 완전히 다른 표현으로 변경",
    sectionStrategy: "서론 → 다른 관점 → 확장 내용 → 구조 변경 → 새 섹션 → 종합 정리",
    tone: "원문과 다른 어조와 표현 방식 사용",
    ctaStrategy: "원문과 다른 CTA 접근 방식"
  },
  internal: {
    name: "내부 일관성(시리즈) 모드",
    description: "하나의 대주제로 시리즈형 글을 작성하여 일관된 톤·구조·깊이를 유지하는 모드",
    titleStrategy: "시리즈 넘버링 + 소주제 제목 (예: '파이썬 기초 ③ — 함수 완전 정복')",
    sectionStrategy: "시리즈 도입 → 핵심 지식 → 심화 사례 → 오늘의 핵심(고정) → 다음 편 예고(고정)",
    tone: "지식을 나누는 선배 같은 일관된 톤, 시리즈 전체에서 동일한 깊이와 용어 사용",
    ctaStrategy: "다음 편 예고로 재방문 유도, 시리즈 내 이전 글 자연스러운 언급"
  },
  shopping: {
    name: "쇼핑 구매유도 모드",
    description: "7단계 구매 퍼널 기반 상품 추천 및 전환 최적화 콘텐츠",
    titleStrategy: "구매 유도형 제목 전략 — 가성비/추천/비교/후기 키워드 포함",
    sectionStrategy: "후킹 → 제품 스펙 → 비교 분석(장단점 TABLE) → 실사용 후기 → 가격 꿀팁 → FAQ → 배너 CTA",
    tone: "10년 경력 쇼핑몰 MD가 솔직하게 추천하는 톤 — 장단점 모두 언급",
    ctaStrategy: "대형 배너 CTA 버튼 (그라데이션, 가격 표시, 긴급성 메시지)"
  }
};

// 🔥 애드센스 승인 전문 모드 섹션 구조 (E-E-A-T 강화 중심)
export const ADSENSE_APPROVAL_MODE_SECTIONS: MaxModeSection[] = [
  {
    id: "author_intro",
    title: "작성자 소개",
    description: "전문성과 경험을 간단히 제시하는 섹션",
    minChars: 200,
    role: "해당 분야 전문가",
    contentFocus: "전문성/경험 간단히 제시, 5년간 이 분야에서... 형식",
    requiredElements: [
      "전문성 어필",
      "경험 기간 명시",
      "신뢰성 구축",
      "자연스러운 키워드 포함"
    ]
  },
  {
    id: "introduction",
    title: "서론",
    description: "독자 문제 공감과 글의 독창적 가치를 제시하는 섹션",
    minChars: 500,
    role: "독자의 문제를 이해하고 해결책을 제시하는 전문가",
    contentFocus: "독자 문제 공감, 이 글의 독창적 가치, 직접 경험 강조",
    requiredElements: [
      "독자 문제 공감",
      "독창적 가치 제시",
      "직접 경험 강조",
      "호기심 유발"
    ]
  },
  {
    id: "understanding_topic",
    title: "[주제] 완전히 이해하기",
    description: "교육적 가치를 제공하는 핵심 섹션",
    minChars: 1000,
    role: "교육 전문가이자 실무자",
    contentFocus: "기초부터 차근차근, 전문 용어 쉽게 풀어쓰기, 실생활 예시, 흔한 오해와 진실",
    requiredElements: [
      "기초부터 차근차근 설명",
      "전문 용어 쉽게 풀어쓰기",
      "비유와 예시 3가지",
      "직접 겪은 사례 스토리텔링",
      "구체적 숫자/날짜 포함",
      "흔한 오해와 진실 바로잡기",
      "근거 있는 정보 제공"
    ]
  },
  {
    id: "personal_experience",
    title: "제가 직접 해본 [실전 경험]",
    description: "독창성의 핵심이 되는 직접 경험 섹션",
    minChars: 1000, // 6,000자 목표를 위해 감소 (1500 → 1000)
    role: "실전 경험자이자 솔직한 공유자",
    contentFocus: "시작 계기, 시행착오, 최종 결과와 성과",
    requiredElements: [
      "1인칭 시점 스토리",
      "구체적 상황 묘사",
      "실패 사례 3가지 솔직하게",
      "각 실패에서 배운 점",
      "다른 곳에서 찾을 수 없는 인사이트",
      "Before & After 비교",
      "구체적 숫자 (비율, 금액, 시간 등)",
      "증빙 이미지 언급"
    ]
  },
  {
    id: "step_by_step_guide",
    title: "단계별 실행 가이드",
    description: "실용적 가치를 제공하는 실행 섹션",
    minChars: 1000, // 6,000자 목표를 위해 감소 (1500 → 1000)
    role: "실무 가이드 전문가",
    contentFocus: "준비물과 사전 체크리스트, 따라하기 쉬운 10단계, 단계별 체크포인트",
    requiredElements: [
      "필요한 것 상세 리스트",
      "예상 비용/시간 투명하게 공개",
      "무료 vs 유료 옵션 비교",
      "Step 1-5 상세 설명",
      "Step 6-10 상세 설명",
      "각 단계마다 주의점",
      "제대로 하고 있는지 확인 방법",
      "문제 발생 시 해결 방법"
    ]
  },
  {
    id: "comparison_recommendation",
    title: "비교 분석 및 추천",
    description: "전문성을 강조하는 분석 섹션",
    minChars: 1000, // 6,000자 목표를 위해 감소 (1500 → 1000)
    role: "객관적 분석 전문가",
    contentFocus: "주요 옵션 심층 비교, 상황별 맞춤 추천, 피해야 할 것들",
    requiredElements: [
      "직접 사용해본 3-5가지 옵션",
      "장점/단점 표 형식",
      "개인적 평가 점수 (근거와 함께)",
      "예산별 추천 (3가지)",
      "수준별 추천 (초/중/고급)",
      "제가 다시 시작한다면... 관점",
      "광고성 정보 아닌 진짜 조언",
      "제가 손해본 경험 공유",
      "법적/안전 이슈 (해당시)"
    ]
  },
  {
    id: "conclusion_resources",
    title: "마무리 및 추가 리소스",
    description: "마무리와 추가 가치 제공 섹션",
    minChars: 1300, // 6,000자 목표를 위해 감소 (1500 → 1300) - 마무리는 조금 더 길게
    role: "마무리 전문가이자 리소스 큐레이터",
    contentFocus: "핵심 내용 정리, 자주 묻는 질문, 도움이 되는 자료 및 참고링크",
    requiredElements: [
      "꼭 기억해야 할 3가지",
      "실천 가능한 액션 아이템",
      "실제 받은 질문 기반 FAQ 6-8개",
      "각 질문마다 상세한 답변",
      "신뢰할 수 있는 외부 사이트 3-5개",
      "각 링크에 대한 설명",
      "마지막 업데이트 날짜",
      "댓글로 추가 질문 유도",
      "관련 글 추천 (내부링크 2-3개)"
    ]
  }
];

// 쇼핑/구매유도 모드 섹션 구조 (7단계 구매 퍼널)
export const SHOPPING_CONVERSION_MODE_SECTIONS: MaxModeSection[] = [
  {
    id: "hook_problem",
    title: "[주제] 고를 때 꼭 알아야 할 것",
    description: "독자의 고통 포인트를 정확히 짚어 관심을 끄는 도입부",
    minChars: 800,
    role: "마케팅 심리 전문가",
    contentFocus: "독자 고통 포인트 환기, 시장 데이터, 긴급성, 후킹",
    requiredElements: [
      "독자가 겪는 핵심 문제를 3줄 이내로 명확하게 제시",
      "이 제품/서비스가 필요한 시장 트렌드·통계 데이터 2개 이상",
      "지금 해결하지 않으면 손해보는 이유 (시간·돈·기회비용)",
      "강력한 후킹 문장으로 마무리 (스크롤 유도)"
    ]
  },
  {
    id: "product_intro_spec",
    title: "[주제] 핵심 스펙 총정리",
    description: "제품의 핵심 정보와 스펙을 시각적으로 정리하는 섹션",
    minChars: 1200,
    role: "제품 전문가이자 기술 분석가",
    contentFocus: "제품 핵심 특징, 스펙 표, 차별화 포인트, 사용 시나리오",
    requiredElements: [
      "제품 스펙 카드 (브랜드, 모델명, 핵심 스펙 5개 이상) — 쇼핑 전용 카드 스타일",
      "핵심 장점 3가지를 아이콘+텍스트로 시각화",
      "타겟 사용자와 사용 시나리오 (이런 분에게 추천!)",
      "크롤링 데이터 기반 실제 제품 정보 활용"
    ]
  },
  {
    id: "comparison_guide",
    title: "[주제] 비교 분석 & 선택 가이드",
    description: "경쟁 제품과의 비교와 장단점을 표로 시각화하는 섹션",
    minChars: 1500,
    role: "비교 분석 전문가",
    contentFocus: "경쟁 제품 비교표, 장단점 비교 TABLE, 선택 기준 체크리스트",
    requiredElements: [
      "경쟁 제품 3~5개 비교표 (가격, 핵심 스펙, 평점 포함)",
      "⚠️ 장단점 비교 TABLE 필수! (장점=초록, 단점=주황 — 표 형식으로 반드시 출력)",
      "상황별 맞춤 추천 (예산별/용도별/수준별)",
      "가격 대비 성능 분석 (가성비 점수)"
    ]
  },
  {
    id: "real_reviews",
    title: "[주제] 실사용 후기 & 솔직 평가",
    description: "실제 사용자 후기와 Before&After로 신뢰를 구축하는 섹션",
    minChars: 1200,
    role: "사용자 경험 분석가",
    contentFocus: "실제 후기 카드, 별점 시각화, Before&After, 사회적 증거",
    requiredElements: [
      "실제 구매 후기 카드 3개 이상 (따옴표 스타일, 별점 포함)",
      "별점 + 리뷰 요약 바 (예: ⭐4.7/5 — 1,234명 평가)",
      "Before & After 비교 또는 결과 수치 명시",
      "전문가/기관/언론 신뢰 레퍼런스 1개 이상"
    ]
  },
  {
    id: "honest_cons",
    title: "[주제] 솔직한 단점 — 이런 분에겐 비추천",
    description: "신뢰 구축의 핵심 — 칭찬만 늘어놓으면 독자가 즉시 이탈. 단점을 솔직하게 짚어야 전환율 상승",
    minChars: 800,
    role: "객관적 리뷰어",
    contentFocus: "구체적 단점 3개 이상, 어떤 사용자에게는 맞지 않는지 명시",
    requiredElements: [
      "이 제품의 명확한 단점 3가지 이상 (구체적 사례)",
      "이런 사용자에게는 비추천 (사용 시나리오 명시)",
      "대안 제품 1~2개 짧게 언급",
      "단점에도 불구하고 추천하는 이유 (균형감)"
    ]
  },
  {
    id: "price_deal",
    title: "[주제] 최저가 & 구매 꿀팁",
    description: "가격 비교와 할인 정보를 시각적으로 강조하는 섹션",
    minChars: 1000,
    role: "구매 전략 컨설턴트",
    contentFocus: "가격 비교표, 할인 정보, 쿠폰, 구매처 추천",
    requiredElements: [
      "가격 비교표 (정가 vs 할인가 vs 경쟁사 — 할인율 빨간 태그 강조)",
      "쿠폰/할인 코드 정보 (있는 경우)",
      "구매처별 비교 (쿠팡, 네이버쇼핑, 공식몰 등)",
      "구매 시기·타이밍 팁 (세일 시즌, 최적 구매 시기)"
    ]
  },
  {
    id: "faq_objection",
    title: "[주제] 자주 묻는 질문 (FAQ)",
    description: "구매 전 궁금증을 해소하고 불안 요소를 제거하는 섹션",
    minChars: 800,
    role: "고객 상담 전문가",
    contentFocus: "자주 묻는 질문 5~7개, 환불/배송/AS 정보, 불안 해소",
    requiredElements: [
      "실제 구매자 FAQ 5~7개 (Q&A 형식)",
      "배송·환불·교환·AS 정보 명확히 제시",
      "구매 전 체크리스트 (확인해야 할 사항 리스트)",
      "안심 보증 메시지 (만족도 보장, 무료 반품 등)"
    ]
  },
  {
    id: "final_cta",
    title: "[주제] 구매 전 최종 체크리스트",
    description: "강력한 배너 CTA 버튼으로 즉시 구매 행동을 유도하는 마지막 섹션",
    minChars: 500,
    role: "전환 퍼포먼스 리더",
    contentFocus: "핵심 요약, 긴급성 메시지, 대형 배너 CTA 버튼",
    requiredElements: [
      "핵심 내용 3줄 요약 (이 제품을 선택해야 하는 이유)",
      "긴급성/한정 혜택 메시지 (마감일, 재고, 특가)",
      "⚠️ 대형 배너 CTA 버튼 필수! (쇼핑 전용 특별 디자인 — 그라데이션, 가격 표시, 화살표)",
      "구매 후 기대 효과 한 문장"
    ]
  }
];

// 📝 내부 일관성 모드 섹션 구조 (시리즈형 글 — TV 에피소드 스타일)
export const INTERNAL_CONSISTENCY_SECTIONS: MaxModeSection[] = [
  {
    id: "topic_intro",
    title: "[주제] 핵심 개요",
    description: "주제 소개와 독자가 얻을 핵심 가치 제시",
    minChars: 600,
    role: "정보 전달자",
    contentFocus: "주제 소개, 독자 관점 질문, 오늘 글의 핵심 가치",
    requiredElements: [
      "주제의 중요성과 독자가 이 글에서 얻을 가치",
      "독자의 일반적 궁금증/고민 제시",
      "글 전체의 로드맵 1문장 요약",
      "과거/미래 시리즈 언급 절대 금지"
    ]
  },
  {
    id: "core_knowledge",
    title: "[주제] 핵심 지식",
    description: "주제의 핵심 정보를 체계적으로 전달",
    minChars: 1500,
    role: "해당 분야 전문가",
    contentFocus: "H3 소제목 3~4개로 구조화, 구체적 수치/데이터",
    requiredElements: [
      "H3 소제목 3~4개로 구조화",
      "구체적 수치/데이터 5개 이상",
      "일관된 설명 깊이와 용어",
      "외부 글 참조 금지"
    ]
  },
  {
    id: "deep_dive_case",
    title: "[주제] 심화 분석 & 사례",
    description: "실제 사례·적용법으로 핵심 지식 보강",
    minChars: 1000,
    role: "실무 경험자",
    contentFocus: "실제 사례, 단계별 가이드, 팁",
    requiredElements: [
      "실제 사례 또는 시나리오 2개 이상",
      "단계별 가이드 또는 체크리스트",
      "실전 팁 2~3개",
      "다른 글 언급 절대 금지"
    ]
  },
  {
    id: "key_takeaways",
    title: "[주제] 핵심 요약",
    description: "빠른 복습용 핵심 정리",
    minChars: 400,
    role: "정보 요약가",
    contentFocus: "불릿 리스트와 한 줄 결론",
    requiredElements: [
      "불릿 3~5개로 핵심 요약",
      "한 줄 정리 결론",
      "독립적이고 완결된 마무리"
    ]
  },
  {
    id: "additional_resources",
    title: "[주제] 더 알아보기",
    description: "독자가 추가로 탐색할 수 있는 가이드 제공",
    minChars: 300,
    role: "정보 안내자",
    contentFocus: "추가 학습 포인트와 관련 개념 소개",
    requiredElements: [
      "추가 탐색 주제 2~3개 제안",
      "각 주제가 왜 유용한지 짧은 설명",
      "존재하지 않는 글 언급 금지"
    ]
  }
];

// 페러프레이징 전문 모드 섹션 구조
export const PARAPHRASING_PROFESSIONAL_MODE_SECTIONS: MaxModeSection[] = [
  {
    id: "introduction_paraphrase",
    title: "[주제] 핵심 개요",
    description: "원문 서론을 완전히 다른 표현으로 재작성",
    minChars: 400, // 4,000자 목표를 위해 증가 (300 → 400)
    role: "페러프레이징 전문가",
    contentFocus: "원문 서론의 의미만 가져오기, 문장 구조 100% 변경, 수동태↔능동태 전환",
    requiredElements: [
      "원문 의미 유지하되 표현 완전 변경",
      "문장 구조 100% 변경",
      "수동태↔능동태 전환",
      "유의어/동의어 치환",
      "새로운 관점 추가"
    ]
  },
  {
    id: "content_expansion",
    title: "[주제] 심층 분석",
    description: "원문 내용을 확장하고 심화하는 섹션",
    minChars: 700, // 4,000자 목표를 위해 감소 (1500 → 700)
    role: "콘텐츠 확장 전문가",
    contentFocus: "원문 내용 + 새로운 관점 추가, 다른 순서로 재배치, 보충 내용",
    requiredElements: [
      "유의어/동의어 100% 치환",
      `원문에 없던 최신 데이터 추가 (${RESOLVED_YEAR}년)`,
      "원문 내용을 다른 순서로 재배치",
      "설명 방식 전환 (리스트→서술형)",
      "나만의 예시로 교체",
      "원문의 빈틈 채우기",
      "다른 전문가 의견 추가",
      "반대 의견도 제시 (균형)"
    ]
  },
  {
    id: "perspective_change",
    title: "[주제] 다른 관점에서 보기",
    description: "원문을 다른 관점에서 재구성하는 섹션",
    minChars: 700, // 4,000자 목표를 위해 감소 (1500 → 700)
    role: "관점 전환 전문가",
    contentFocus: "원문 핵심을 다른 각도에서, 대조적 사례, 실용적 적용 방법",
    requiredElements: [
      "원문: 소비자 관점 → 전문가 관점",
      "문장 길이 조절 (긴 문장→짧게, 짧은 문장→길게)",
      "원문에서 A만 다룸 → A와 B 비교",
      "표 형식 ↔ 문단 형식 전환",
      "단어 레벨까지 변경",
      "원문이 이론적이면 → 실전 예시 추가",
      "원문이 실전 중심이면 → 이론적 배경 추가"
    ]
  },
  {
    id: "structural_reorganization",
    title: "[주제] 체계적 정리",
    description: "원문 구조를 완전히 바꿔서 재구성",
    minChars: 700, // 4,000자 목표를 위해 감소 (1500 → 700)
    role: "구조 재편성 전문가",
    contentFocus: "원문 마지막 부분을 앞으로, 중간 부분 확장, Case Study 형식으로 재구성",
    requiredElements: [
      "시간 순서 역배치 시도",
      "결론부터 말하자면... 형식",
      "원문 2문장 → 페러프레이징 1개 문단",
      "부연 설명/배경 정보 추가",
      "구어체 ↔ 문어체 전환",
      "원문 일반론 → 구체적 사례로 변환",
      "실제로 [상황]에서는... 형식",
      "숫자/통계 최신 데이터로 업데이트"
    ]
  },
  {
    id: "new_content_addition",
    title: "[주제] 최신 트렌드 & 추가 정보",
    description: "원문에 없던 새로운 섹션 추가",
    minChars: 700, // 4,000자 목표를 위해 감소 (1500 → 700)
    role: "콘텐츠 확장 전문가",
    contentFocus: "최신 트렌드 반영, 반대 의견/비판적 시각, 실전 체크리스트",
    requiredElements: [
      `2024-${RESOLVED_YEAR}년 변화 내용`,
      "원문 작성 이후 달라진 점",
      "원문이 긍정적이면 → 한계점 추가",
      "원문이 부정적이면 → 장점 추가",
      "균형잡힌 시각 제공",
      "원문 내용을 액션 아이템으로 전환",
      "오늘 바로 실천 가능한 5가지",
      "원문 대비 20-30% 새로운 정보"
    ]
  },
  {
    id: "conclusion_expansion",
    title: "[주제] 종합 정리 & 결론",
    description: "원문과 다른 결론으로 마무리",
    minChars: 800, // 4,000자 목표를 위해 감소 (1500 → 800) - 마무리는 조금 더 길게
    role: "결론 확장 전문가",
    contentFocus: "핵심 요약 (다른 표현으로), 추가 인사이트, FAQ (원문에 없던 질문)",
    requiredElements: [
      "원문 3줄 요약 → 완전히 다른 3줄",
      "강조점 변경",
      "원문에서 언급 안 된 관련 주제",
      "원문 주제 A → 관련 주제 B로 연결",
      "원문 읽고 생길 수 있는 질문 5개",
      "답변도 독창적으로 작성",
      "참고자료 다시 찾아서 재구성"
    ]
  }
];

// 콘텐츠 모드별 섹션 구조 매핑
export const CONTENT_MODE_SECTIONS_MAP: Record<string, MaxModeSection[]> = {
  external: MAX_MODE_SECTIONS, // 기존 MAX모드를 SEO최적화 모드로 사용
  spiderwebbing: SPIDERWEBBING_MODE_SECTIONS,
  adsense: ADSENSE_APPROVAL_MODE_SECTIONS, // 새로운 애드센스 승인 전문 모드
  paraphrasing: PARAPHRASING_PROFESSIONAL_MODE_SECTIONS, // 새로운 페러프레이징 전문 모드
  internal: INTERNAL_CONSISTENCY_SECTIONS, // 시리즈형 내부 일관성 모드
  shopping: SHOPPING_CONVERSION_MODE_SECTIONS  // 새로운 쇼핑/구매유도 모드
};
