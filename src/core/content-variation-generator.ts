// src/core/content-variation-generator.ts
export interface ContentVariation {
  type: 'news' | 'guide' | 'review' | 'analysis' | 'story' | 'comparison';
  title: string;
  approach: string;
  structure: string[];
  tone: string;
  targetAudience: string;
  uniqueValue: string;
}

export interface VariationStrategy {
  variations: ContentVariation[];
  recommendedType: string;
  differentiationPoints: string[];
  contentMix: string[];
}

export class ContentVariationGenerator {
  generateVariations(topic: string, _keywords: string[]): VariationStrategy {
    const variations: ContentVariation[] = [
      {
        type: 'news',
        title: `${topic} 최신 동향과 트렌드 분석`,
        approach: '최신 뉴스와 트렌드를 중심으로 한 시의성 있는 콘텐츠',
        structure: ['최신 동향', '트렌드 분석', '전문가 의견', '미래 전망', '실무 적용'],
        tone: '객관적이고 신뢰성 있는',
        targetAudience: '업계 전문가, 트렌드 관심자',
        uniqueValue: '실시간 정보와 전문적 분석'
      },
      {
        type: 'guide',
        title: `${topic} 완벽 실전 가이드`,
        approach: '단계별 실습 중심의 실용적 가이드',
        structure: ['기본 개념', '준비사항', '단계별 실습', '문제해결', '고급 팁'],
        tone: '친근하고 설명적인',
        targetAudience: '초보자, 실무자',
        uniqueValue: '즉시 적용 가능한 실용적 정보'
      },
      {
        type: 'review',
        title: `${topic} 전문가 리뷰와 평가`,
        approach: '다양한 관점에서의 객관적 리뷰와 평가',
        structure: ['개요', '장단점 분석', '비교 평가', '사용자 후기', '종합 평가'],
        tone: '균형잡힌 분석적',
        targetAudience: '구매 고려자, 비교 검토자',
        uniqueValue: '신뢰할 수 있는 객관적 평가'
      },
      {
        type: 'analysis',
        title: `${topic} 심층 데이터 분석`,
        approach: '데이터와 통계를 바탕으로 한 전문적 분석',
        structure: ['데이터 수집', '통계 분석', '패턴 발견', '인사이트 도출', '결론'],
        tone: '전문적이고 논리적인',
        targetAudience: '데이터 분석가, 의사결정자',
        uniqueValue: '검증된 데이터 기반 인사이트'
      },
      {
        type: 'story',
        title: `${topic} 성공 스토리와 경험담`,
        approach: '실제 경험과 스토리를 통한 감동적 콘텐츠',
        structure: ['도입 스토리', '도전과 극복', '핵심 교훈', '실용적 적용', '영감 메시지'],
        tone: '감동적이고 영감을 주는',
        targetAudience: '동기부여 추구자, 경험 공유자',
        uniqueValue: '감정적 연결과 실질적 교훈'
      },
      {
        type: 'comparison',
        title: `${topic} 종합 비교 분석`,
        approach: '다양한 옵션과 방법론의 체계적 비교',
        structure: ['비교 기준', '옵션별 분석', '장단점 비교', '상황별 추천', '최종 결론'],
        tone: '객관적이고 체계적인',
        targetAudience: '선택 고민자, 비교 검토자',
        uniqueValue: '체계적이고 신뢰할 수 있는 비교'
      }
    ];

    const recommendedType = 'analysis'; // 데이터 기반 분석이 애드센스에 가장 친화적

    const differentiationPoints = [
      '각 변형마다 완전히 다른 접근법과 구조 사용',
      '타겟 오디언스에 맞는 맞춤형 톤앤매너',
      '고유한 가치 제안으로 차별화',
      '다양한 콘텐츠 타입으로 포트폴리오 구성'
    ];

    const contentMix = [
      '뉴스형: 시의성 있는 최신 정보',
      '가이드형: 실용적이고 적용 가능한 정보',
      '리뷰형: 신뢰할 수 있는 객관적 평가',
      '분석형: 데이터 기반 전문적 인사이트',
      '스토리형: 감정적 연결과 영감',
      '비교형: 체계적이고 신뢰할 수 있는 비교'
    ];

    return {
      variations,
      recommendedType,
      differentiationPoints,
      contentMix
    };
  }

  generateContentOutline(variation: ContentVariation, _topic: string): string[] {
    const baseOutline = [
      `독창적인 도입부: ${variation.uniqueValue}를 강조`,
      `핵심 내용: ${variation.approach}`,
      `구체적 사례: ${variation.targetAudience}를 위한 실제 적용 사례`,
      `전문적 분석: 데이터와 통계를 활용한 신뢰성 있는 정보`,
      `실용적 가이드: 독자가 바로 적용할 수 있는 구체적 방법`,
      `차별화된 결론: ${variation.uniqueValue}를 다시 강조하며 행동 유도`
    ];

    return baseOutline;
  }
}




