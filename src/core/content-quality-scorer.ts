// src/core/content-quality-scorer.ts
export interface QualityScore {
  originality: number;      // 독창성 (0-100)
  reliability: number;      // 신뢰성 (0-100)
  seo: number;             // SEO 최적화 (0-100)
  readability: number;     // 가독성 (0-100)
  engagement: number;      // 참여도 (0-100)
  adsenseApproval: number; // 애드센스 승인 가능성 (0-100)
  total: number;           // 총점 (0-100)
}

export interface QualityAnalysis {
  score: QualityScore;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  adsenseRisk: string[];
}

export class ContentQualityScorer {
  analyzeContent(content: string, _topic: string, keywords: string[]): QualityAnalysis {
    // 독창성 분석
    const originality = this.calculateOriginality(content);
    
    // 신뢰성 분석
    const reliability = this.calculateReliability(content);
    
    // SEO 분석
    const seo = this.calculateSEO(content, keywords);
    
    // 가독성 분석
    const readability = this.calculateReadability(content);
    
    // 참여도 분석
    const engagement = this.calculateEngagement(content);
    
    // 애드센스 승인 가능성
    const adsenseApproval = this.calculateAdsenseApproval(content, originality, reliability);
    
    const total = Math.round((originality + reliability + seo + readability + engagement + adsenseApproval) / 6);
    
    const score: QualityScore = {
      originality,
      reliability,
      seo,
      readability,
      engagement,
      adsenseApproval,
      total
    };

    const strengths = this.identifyStrengths(score);
    const weaknesses = this.identifyWeaknesses(score);
    const recommendations = this.generateRecommendations(score, content);
    const adsenseRisk = this.identifyAdsenseRisks(content, score);

    return {
      score,
      strengths,
      weaknesses,
      recommendations,
      adsenseRisk
    };
  }

  private calculateOriginality(content: string): number {
    // Q&A 형식 사용 여부
    const hasQA = /Q\.|A\.|질문|답변/.test(content);
    if (hasQA) return 20;

    // 템플릿식 표현 사용 여부
    const hasTemplate = /몇 가지|핵심 주의사항|중요한|꼭/.test(content);
    if (hasTemplate) return 30;

    // 독창적 표현 사용 여부
    const hasCreative = /혁신적|독창적|차별화|고유한/.test(content);
    if (hasCreative) return 80;

    return 60; // 기본 점수
  }

  private calculateReliability(content: string): number {
    // 검증된 데이터 사용 여부
    const hasData = /통계|연구|조사|공식|기관/.test(content);
    if (hasData) return 85;

    // 추측성 표현 사용 여부
    const hasSpeculation = /일 것 같습니다|라고 합니다|추정됩니다/.test(content);
    if (hasSpeculation) return 30;

    return 70; // 기본 점수
  }

  private calculateSEO(content: string, keywords: string[]): number {
    let score = 50;
    
    // 키워드 밀도 확인
    const keywordDensity = this.calculateKeywordDensity(content, keywords);
    score += keywordDensity * 20;

    // 제목 최적화
    if (content.includes('<h1>') || content.includes('<h2>')) {
      score += 15;
    }

    // 내부 링크
    if (content.includes('href=')) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  private calculateReadability(content: string): number {
    // 문장 길이 분석
    const sentences = content.split(/[.!?]/);
    const avgLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
    
    if (avgLength < 50) return 90;
    if (avgLength < 100) return 80;
    if (avgLength < 150) return 70;
    return 60;
  }

  private calculateEngagement(content: string): number {
    let score = 50;

    // 스토리텔링 요소
    if (/스토리|경험|사례|이야기/.test(content)) {
      score += 20;
    }

    // 시각적 요소
    if (/표|체크리스트|인포그래픽|이미지/.test(content)) {
      score += 15;
    }

    // CTA 버튼
    if (/cta-button|바로 시작|지금/.test(content)) {
      score += 15;
    }

    return Math.min(score, 100);
  }

  private calculateAdsenseApproval(content: string, originality: number, reliability: number): number {
    let score = 50;

    // 독창성 반영
    score += originality * 0.3;

    // 신뢰성 반영
    score += reliability * 0.3;

    // 길이 적절성
    if (content.length > 2000) score += 10;
    if (content.length > 3000) score += 10;

    // 중복 콘텐츠 위험
    if (originality < 40) score -= 30;

    return Math.min(Math.max(score, 0), 100);
  }

  private calculateKeywordDensity(content: string, keywords: string[]): number {
    const totalWords = content.split(/\s+/).length;
    let keywordCount = 0;

    keywords.forEach(keyword => {
      const regex = new RegExp(keyword, 'gi');
      const matches = content.match(regex);
      if (matches) keywordCount += matches.length;
    });

    return keywordCount / totalWords;
  }

  private identifyStrengths(score: QualityScore): string[] {
    const strengths: string[] = [];
    
    if (score.originality > 70) strengths.push('높은 독창성');
    if (score.reliability > 70) strengths.push('신뢰할 수 있는 정보');
    if (score.seo > 70) strengths.push('SEO 최적화');
    if (score.readability > 70) strengths.push('우수한 가독성');
    if (score.engagement > 70) strengths.push('높은 참여도');
    if (score.adsenseApproval > 70) strengths.push('애드센스 승인 가능성 높음');

    return strengths;
  }

  private identifyWeaknesses(score: QualityScore): string[] {
    const weaknesses: string[] = [];
    
    if (score.originality < 50) weaknesses.push('독창성 부족');
    if (score.reliability < 50) weaknesses.push('신뢰성 부족');
    if (score.seo < 50) weaknesses.push('SEO 최적화 부족');
    if (score.readability < 50) weaknesses.push('가독성 부족');
    if (score.engagement < 50) weaknesses.push('참여도 부족');
    if (score.adsenseApproval < 50) weaknesses.push('애드센스 승인 위험');

    return weaknesses;
  }

  private generateRecommendations(score: QualityScore, _content: string): string[] {
    const recommendations: string[] = [];

    if (score.originality < 60) {
      recommendations.push('더 독창적인 접근법과 표현을 사용하세요');
    }

    if (score.reliability < 60) {
      recommendations.push('검증된 데이터와 공식 정보를 더 많이 포함하세요');
    }

    if (score.seo < 60) {
      recommendations.push('키워드를 자연스럽게 더 많이 포함하세요');
    }

    if (score.engagement < 60) {
      recommendations.push('스토리텔링과 시각적 요소를 추가하세요');
    }

    if (score.adsenseApproval < 60) {
      recommendations.push('중복 콘텐츠를 피하고 독창성을 높이세요');
    }

    return recommendations;
  }

  private identifyAdsenseRisks(content: string, score: QualityScore): string[] {
    const risks: string[] = [];

    if (score.originality < 40) {
      risks.push('중복 콘텐츠 위험 - 독창성을 높여야 합니다');
    }

    if (/Q\.|A\.|질문|답변/.test(content)) {
      risks.push('Q&A 형식은 애드센스에서 선호하지 않을 수 있습니다');
    }

    if (content.length < 1500) {
      risks.push('콘텐츠 길이가 너무 짧습니다');
    }

    if (score.reliability < 40) {
      risks.push('신뢰성 부족으로 애드센스 승인에 불리할 수 있습니다');
    }

    return risks;
  }
}




