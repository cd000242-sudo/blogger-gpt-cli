/**
 * 타이밍 골드 키워드 파인더
 * "지금 당장 작성하면 트래픽이 폭발할 키워드"를 찾아주는 시스템
 */

export interface KeywordData {
  keyword: string;
  searchVolume: number;
  documentCount: number;
  growthRate?: number; // 전일 대비 성장률 (%)
  firstSeenDate?: Date;
  category?: string;
  changeRate?: number;
  source?: string; // 키워드 출처 (예: 'spider-web', 'smart-block', 'autocomplete' 등)
}

export interface TimingScore {
  keyword: string;
  
  // 기본 황금 점수
  goldenScore: number; // (검색량 / 문서수) × 1000
  
  // 타이밍 점수
  trendingScore: number; // 급상승도 (0-100)
  freshnessScore: number; // 신선도 (0-100)
  seasonalScore: number; // 시즌성 (0-100)
  competitionTimeScore: number; // 경쟁 진입 시간 (0-100)
  
  // 최종 타이밍 골드 점수
  timingGoldScore: number; // 종합 점수
  urgency: 'immediate' | 'today' | 'this-week' | 'normal';
  
  // 메타데이터
  searchVolume: number;
  documentCount: number;
  growthRate: number; // 전일 대비 성장률 (%)
  firstSeenDate: Date;
  peakPrediction: Date; // 예상 피크 시간
  
  // 인사이트
  reason: string; // 왜 지금 작성해야 하는지
  trendingReason?: string; // 왜 지금 급상승했는지 (뉴스/이슈 배경)
  whyNow?: string; // 왜 지금 쓰면 좋은지 (구체적 이유)
  suggestedDeadline: Date; // 권장 작성 마감
  estimatedTraffic: number; // 예상 유입량
  
  // 연관 키워드
  relatedKeywords?: Array<{ keyword: string; searchVolume: number; documentCount: number; validated: boolean }>;
  suggestedKeywords?: Array<{ keyword: string; searchVolume: number; documentCount: number; validated: boolean }>;
  associativeKeywords?: Array<{ keyword: string; searchVolume: number; documentCount: number; validated: boolean }>;
}

export class TimingGoldenFinder {
  
  /**
   * 타이밍 골드 점수 계산
   */
  calculateTimingGoldScore(keyword: KeywordData): TimingScore {
    
    // 1. 기본 황금 점수
    const goldenScore = keyword.documentCount > 0 
      ? (keyword.searchVolume / keyword.documentCount) * 1000 
      : 0;
    
    // 2. 트렌딩 점수 (급상승도)
    const trendingScore = this.calculateTrendingScore(keyword);
    
    // 3. 신선도 점수 (얼마나 최근 이슈인가)
    const freshnessScore = this.calculateFreshnessScore(keyword);
    
    // 4. 시즌성 점수 (시기적절성)
    const seasonalScore = this.calculateSeasonalScore(keyword);
    
    // 5. 경쟁 진입 시간 점수 (얼마나 빨리 써야 하는가)
    const competitionTimeScore = this.calculateCompetitionTimeScore(keyword);
    
    // 최종 타이밍 골드 점수
    const timingGoldScore = (
      goldenScore * 0.3 +           // 30% - 기본 황금 점수
      trendingScore * 0.3 +         // 30% - 급상승도
      freshnessScore * 0.2 +        // 20% - 신선도
      seasonalScore * 0.1 +         // 10% - 시즌성
      competitionTimeScore * 0.1    // 10% - 경쟁 시간
    );
    
    // 긴급도 판단
    const urgency = this.determineUrgency(timingGoldScore, competitionTimeScore);
    
    // 예상 피크 시간
    const peakPrediction = this.predictPeak(keyword);
    
    // 권장 마감일
    const suggestedDeadline = this.calculateDeadline(peakPrediction, competitionTimeScore);
    
    // 예상 트래픽
    const estimatedTraffic = this.estimateTraffic(keyword, timingGoldScore);
    
    // 이유 설명
    const reason = this.generateReason(keyword, {
      trendingScore,
      freshnessScore,
      seasonalScore,
      competitionTimeScore
    });
    
    // 급상승 이유 (구체적 분석)
    const trendingReason = this.generateTrendingReason(keyword, {
      trendingScore,
      freshnessScore,
      seasonalScore
    });
    
    // 왜 지금 쓰면 좋은가 (구체적 이유)
    const whyNow = this.generateWhyNow(keyword, {
      competitionTimeScore,
      timingGoldScore,
      documentCount: keyword.documentCount,
      growthRate: keyword.growthRate || 0
    });
    
    return {
      keyword: keyword.keyword,
      goldenScore: Math.round(goldenScore),
      trendingScore,
      freshnessScore,
      seasonalScore,
      competitionTimeScore,
      timingGoldScore: Math.round(timingGoldScore),
      urgency,
      searchVolume: keyword.searchVolume,
      documentCount: keyword.documentCount,
      growthRate: keyword.growthRate || 0,
      firstSeenDate: keyword.firstSeenDate || new Date(),
      peakPrediction,
      reason,
      trendingReason,
      whyNow,
      suggestedDeadline,
      estimatedTraffic
    };
  }
  
  /**
   * 트렌딩 점수: 검색량 증가율
   */
  calculateTrendingScore(keyword: KeywordData): number {
    const growthRate = keyword.growthRate || keyword.changeRate || 0;
    
    // 급상승일수록 높은 점수
    if (growthRate >= 500) return 100;      // 5배 이상 급증
    if (growthRate >= 300) return 90;       // 3배 이상
    if (growthRate >= 200) return 80;       // 2배 이상
    if (growthRate >= 100) return 70;       // 2배
    if (growthRate >= 50) return 50;        // 1.5배
    if (growthRate >= 20) return 30;        // 20% 증가
    if (growthRate >= 10) return 20;        // 10% 증가
    if (growthRate >= 5) return 10;         // 5% 증가
    return 5;
  }
  
  /**
   * 신선도 점수: 얼마나 최근 이슈인가
   */
  calculateFreshnessScore(keyword: KeywordData): number {
    if (!keyword.firstSeenDate) {
      // firstSeenDate가 없으면 growthRate가 높으면 신선하다고 가정
      if ((keyword.growthRate || keyword.changeRate || 0) > 100) return 80;
      return 50;
    }
    
    const hoursSinceFirst = this.getHoursSince(keyword.firstSeenDate);
    
    // 최근일수록 높은 점수
    if (hoursSinceFirst <= 6) return 100;    // 6시간 이내
    if (hoursSinceFirst <= 12) return 90;   // 12시간 이내
    if (hoursSinceFirst <= 24) return 80;    // 1일 이내
    if (hoursSinceFirst <= 48) return 60;   // 2일 이내
    if (hoursSinceFirst <= 72) return 40;   // 3일 이내
    if (hoursSinceFirst <= 168) return 20;   // 1주일 이내
    return 5;
  }
  
  /**
   * 시즌성 점수: 시기적절한가
   */
  calculateSeasonalScore(keyword: KeywordData): number {
    const now = new Date();
    const month = now.getMonth() + 1;
    
    let score = 50; // 기본 점수
    
    const keywordLower = keyword.keyword.toLowerCase();
    
    // 키워드에 시즌 관련 단어 포함 체크
    const seasonalKeywords: Record<string, { months: number[]; bonus: number }> = {
      '설날': { months: [1, 2], bonus: 50 },
      '설': { months: [1, 2], bonus: 40 },
      '추석': { months: [9, 10], bonus: 50 },
      '크리스마스': { months: [12], bonus: 50 },
      '여름': { months: [6, 7, 8], bonus: 40 },
      '겨울': { months: [12, 1, 2], bonus: 40 },
      '봄': { months: [3, 4, 5], bonus: 40 },
      '가을': { months: [9, 10, 11], bonus: 40 },
      '수능': { months: [11], bonus: 60 },
      '입시': { months: [11, 12, 1], bonus: 50 },
      '여름휴가': { months: [7, 8], bonus: 50 },
      '연말': { months: [12], bonus: 50 },
      '신학기': { months: [2, 3], bonus: 50 },
      '2025': { months: [1, 2, 3, 10, 11, 12], bonus: 30 }, // 연초/연말
    };
    
    for (const [word, config] of Object.entries(seasonalKeywords)) {
      if (keywordLower.includes(word) && config.months.includes(month)) {
        score += config.bonus;
      }
    }
    
    // 2025 포함 시 보너스 (현재가 2025년이므로)
    if (keywordLower.includes('2025')) {
      score += 30;
    }
    
    return Math.min(score, 100);
  }
  
  /**
   * 경쟁 진입 시간: 얼마나 빨리 써야 하는가
   */
  calculateCompetitionTimeScore(keyword: KeywordData): number {
    const docCount = keyword.documentCount;
    const growthRate = keyword.growthRate || keyword.changeRate || 0;
    
    // 문서 적고 + 급상승 = 빨리 써야 함
    let score = 0;
    
    // 문서수 기반
    if (docCount <= 10) score += 50;
    else if (docCount <= 50) score += 40;
    else if (docCount <= 100) score += 30;
    else if (docCount <= 500) score += 20;
    else score += 10;
    
    // 성장률 기반
    if (growthRate >= 300) score += 50;      // 빠르게 경쟁 진입 예상
    else if (growthRate >= 200) score += 40;
    else if (growthRate >= 100) score += 30;
    else if (growthRate >= 50) score += 20;
    else if (growthRate >= 20) score += 10;
    else score += 5;
    
    return Math.min(score, 100);
  }
  
  /**
   * 긴급도 판단
   */
  determineUrgency(timingScore: number, competitionScore: number): 'immediate' | 'today' | 'this-week' | 'normal' {
    if (timingScore >= 80 && competitionScore >= 80) return 'immediate'; // 지금 당장!
    if (timingScore >= 70 || competitionScore >= 70) return 'today';     // 오늘 안에
    if (timingScore >= 50) return 'this-week';                           // 이번 주
    return 'normal';
  }
  
  /**
   * 피크 예측
   */
  predictPeak(keyword: KeywordData): Date {
    const now = new Date();
    const growthRate = keyword.growthRate || keyword.changeRate || 0;
    
    // 급상승 속도에 따라 피크 예측
    if (growthRate >= 300) {
      return new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1일 후
    } else if (growthRate >= 200) {
      return new Date(now.getTime() + 48 * 60 * 60 * 1000); // 2일 후
    } else if (growthRate >= 100) {
      return new Date(now.getTime() + 72 * 60 * 60 * 1000); // 3일 후
    } else {
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7일 후
    }
  }
  
  /**
   * 권장 마감일 계산
   */
  calculateDeadline(peakDate: Date, competitionScore: number): Date {
    // 피크 전에 작성해야 함
    const hoursBeforePeak = competitionScore >= 80 ? 6 : 
                           competitionScore >= 60 ? 12 : 24;
    
    return new Date(peakDate.getTime() - hoursBeforePeak * 60 * 60 * 1000);
  }
  
  /**
   * 예상 트래픽
   */
  estimateTraffic(keyword: KeywordData, timingGoldScore: number): number {
    const searchVolume = keyword.searchVolume;
    const growthRate = keyword.growthRate || keyword.changeRate || 0;
    
    // 검색량 × 성장률 × 타이밍 골드 점수 × 예상 클릭률
    const estimatedCTR = keyword.documentCount <= 100 ? 0.3 : 
                         keyword.documentCount <= 500 ? 0.2 : 0.15; // 경쟁 적으면 CTR 높음
    
    // 타이밍 골드 점수를 0-1 비율로 변환 (100점 만점 기준)
    const scoreRatio = Math.min(timingGoldScore / 100, 1);
    
    return Math.floor(
      searchVolume * (1 + growthRate / 100) * scoreRatio * estimatedCTR
    );
  }
  
  /**
   * 이유 생성 (핵심 요약)
   */
  generateReason(keyword: KeywordData, scores: {
    trendingScore: number;
    freshnessScore: number;
    seasonalScore: number;
    competitionTimeScore: number;
  }): string {
    const reasons: string[] = [];
    const growthRate = keyword.growthRate || keyword.changeRate || 0;
    const hoursSinceFirst = keyword.firstSeenDate ? this.getHoursSince(keyword.firstSeenDate) : null;
    
    // 구체적인 시간 정보 포함
    if (hoursSinceFirst !== null && hoursSinceFirst <= 24) {
      const timeText = hoursSinceFirst < 1 ? '최근 1시간 이내' :
                      hoursSinceFirst < 6 ? '최근 6시간 이내' :
                      hoursSinceFirst < 12 ? '최근 12시간 이내' : '최근 24시간 내';
      reasons.push(`⚡ ${timeText} 급상승 이슈화`);
    } else if (scores.freshnessScore >= 80) {
      reasons.push('⚡ 최근 24시간 내 이슈화');
    }
    
    // 구체적인 성장률 정보
    if (scores.trendingScore >= 80 && growthRate > 0) {
      if (growthRate >= 500) {
        reasons.push(`🔥 검색량이 전일 대비 ${growthRate}% 폭증 (5배 이상 급증)`);
      } else if (growthRate >= 200) {
        reasons.push(`🔥 검색량이 전일 대비 ${growthRate}% 급증 (3배 이상)`);
      } else if (growthRate >= 100) {
        reasons.push(`🔥 검색량이 전일 대비 ${growthRate}% 급증 (2배 이상)`);
      } else {
        reasons.push(`📈 검색량이 전일 대비 ${growthRate}% 급상승 중`);
      }
    }
    
    // 경쟁자 정보 (구체적)
    if (scores.competitionTimeScore >= 80) {
      if (keyword.documentCount <= 10) {
        reasons.push(`🎯 초기 단계 - 경쟁자 ${keyword.documentCount}개 (기회의 창!)`);
      } else if (keyword.documentCount <= 50) {
        reasons.push(`🎯 경쟁자 ${keyword.documentCount}개로 적음 (조기 진입 유리)`);
      } else if (keyword.documentCount <= 100) {
        reasons.push(`🎯 경쟁자 ${keyword.documentCount}개 (아직 경쟁 치열하지 않음)`);
      }
    }
    
    // 시즌성 정보
    if (scores.seasonalScore >= 80) {
      reasons.push('📅 시즌/이벤트 타이밍 완벽');
    }
    
    // 검색량 정보
    if (keyword.searchVolume >= 10000) {
      reasons.push(`💎 월 검색량 ${keyword.searchVolume.toLocaleString()}회 (고검색량)`);
    } else if (keyword.searchVolume >= 5000) {
      reasons.push(`💎 월 검색량 ${keyword.searchVolume.toLocaleString()}회 (중상위 검색량)`);
    }
    
    if (reasons.length === 0) {
      reasons.push('💎 황금 키워드 발견');
    }
    
    return reasons.join(' • ');
  }
  
  /**
   * 급상승 이유 생성 (구체적 분석)
   */
  generateTrendingReason(keyword: KeywordData, scores: {
    trendingScore: number;
    freshnessScore: number;
    seasonalScore: number;
  }): string {
    const growthRate = keyword.growthRate || keyword.changeRate || 0;
    const hoursSinceFirst = keyword.firstSeenDate ? this.getHoursSince(keyword.firstSeenDate) : null;
    const keywordLower = keyword.keyword.toLowerCase();
    
    // 뉴스/이슈 키워드 감지
    const newsKeywords = ['사망', '사고', '논란', '발칵', '충돌', '재판', '선고', '구속', '기소', '수사', '경찰', '검찰', '법원', '판사', '변호사', '의원', '국회', '정부', '대통령', '총리', '장관'];
    const isNewsKeyword = newsKeywords.some(nk => keywordLower.includes(nk));
    
    // 정치 키워드 감지
    const politicsKeywords = ['정치', '선거', '당선', '후보', '공천', '의원', '국회', '정당'];
    const isPoliticsKeyword = politicsKeywords.some(pk => keywordLower.includes(pk));
    
    // 경제 키워드 감지
    const economyKeywords = ['주식', '증시', '코인', '비트코인', '가격', '급락', '급등', '상승', '하락', '투자', '경제'];
    const isEconomyKeyword = economyKeywords.some(ek => keywordLower.includes(ek));
    
    // 엔터테인먼트 키워드 감지
    const entertainmentKeywords = ['결혼', '열애', '이혼', '출연', '방송', '드라마', '영화', '가수', '배우', '아이돌'];
    const isEntertainmentKeyword = entertainmentKeywords.some(ek => keywordLower.includes(ek));
    
    // 구체적인 급상승 이유 생성
    const reasons: string[] = [];
    
    // 시간 기반 분석
    if (hoursSinceFirst !== null) {
      if (hoursSinceFirst < 1) {
        reasons.push('방금 전 급상승 시작');
      } else if (hoursSinceFirst < 6) {
        reasons.push('최근 6시간 이내 급상승');
      } else if (hoursSinceFirst < 12) {
        reasons.push('최근 12시간 이내 급상승');
      } else if (hoursSinceFirst < 24) {
        reasons.push('최근 24시간 내 급상승');
      }
    }
    
    // 키워드에서 실제 사건/이슈 추출 (우선순위 1)
    const keywordText = keyword.keyword;
    
    // 패턴 1: 따옴표 안의 핵심 키워드 추출 (예: "머스크 '1조달러 보상안'")
    const quotedMatch = keywordText.match(/['"]([^'"]{3,30})['"]/);
    if (quotedMatch && quotedMatch[1]) {
      const quotedContent = quotedMatch[1].trim();
      const beforeQuote = keywordText.substring(0, keywordText.indexOf(quotedMatch[0])).trim();
      const personMatch = beforeQuote.match(/([가-힣A-Za-z]{2,15})/);
      if (personMatch && personMatch[1]) {
        reasons.push(`${personMatch[1]} '${quotedContent}' 관련 최근 이슈`);
      } else if (quotedContent.length >= 3) {
        reasons.push(`'${quotedContent}' 관련 최근 이슈`);
      }
    }
    
    // 패턴 2: "인물명 날...기관" 패턴 추출
    const dotPattern = keywordText.match(/([가-힣A-Za-z]{2,15})\s+날\s*\.\.\.\s*([가-힣]{2,15})/);
    if (dotPattern && dotPattern[1] && dotPattern[2]) {
      reasons.push(`${dotPattern[1]} 날...${dotPattern[2]} 관련 최근 이슈`);
    }
    
    // 패턴 3: 인물명 + 사건 패턴 추출
    const personEventPattern = keywordText.match(/([가-힣A-Za-z]{2,15})\s+(?:발표|공개|확인|제안|제시|공약|선언|발언|주장|보상안|지원안)/);
    if (personEventPattern && personEventPattern[1]) {
      const eventMatch = keywordText.match(/([가-힣A-Za-z0-9\s]{3,30})\s*(?:발표|공개|확인|제안|제시|공약|선언|발언|주장|보상안|지원안)/);
      if (eventMatch && eventMatch[1]) {
        reasons.push(`${eventMatch[1]} 관련 최근 이슈`);
      }
    }
    
    // 성장률 기반 분석 (실제 사건 추출 실패 시에만 사용)
    if (reasons.length === 0) {
      if (growthRate >= 500) {
        reasons.push(`검색량이 전일 대비 ${growthRate}% 폭증 (5배 이상 급증)`);
      } else if (growthRate >= 300) {
        reasons.push(`검색량이 전일 대비 ${growthRate}% 급증 (3배 이상)`);
      } else if (growthRate >= 200) {
        reasons.push(`검색량이 전일 대비 ${growthRate}% 급증 (2배 이상)`);
      } else if (growthRate >= 100) {
        reasons.push(`검색량이 전일 대비 ${growthRate}% 급증`);
      } else if (growthRate >= 50) {
        reasons.push(`검색량이 전일 대비 ${growthRate}% 증가`);
      } else if (growthRate >= 20) {
        reasons.push(`검색량이 전일 대비 ${growthRate}% 상승`);
      } else {
        reasons.push('검색량 급증 중');
      }
    }
    
    // 카테고리 기반 분석 (추가 정보로 제공)
    if (isNewsKeyword && reasons.length === 0) {
      reasons.push('뉴스/이슈 키워드로 급상승');
    } else if (isPoliticsKeyword && reasons.length === 0) {
      reasons.push('정치 이슈로 급상승');
    } else if (isEconomyKeyword && reasons.length === 0) {
      reasons.push('경제/금융 이슈로 급상승');
    } else if (isEntertainmentKeyword && reasons.length === 0) {
      reasons.push('엔터테인먼트 이슈로 급상승');
    }
    
    // 시즌성 기반 분석
    if (scores.seasonalScore >= 80) {
      reasons.push('시즌/이벤트 타이밍과 일치');
    }
    
    if (reasons.length === 0) {
      return '검색량 급증 중';
    }
    
    return reasons.join(' • ');
  }
  
  /**
   * 왜 지금 쓰면 좋은가 (구체적 이유)
   */
  generateWhyNow(keyword: KeywordData, context: {
    competitionTimeScore: number;
    timingGoldScore: number;
    documentCount: number;
    growthRate: number;
  }): string {
    const reasons: string[] = [];
    const { competitionTimeScore, timingGoldScore, documentCount, growthRate } = context;
    
    // 경쟁자 수 기반 분석
    if (documentCount <= 10) {
      reasons.push('경쟁자 10개 미만으로 초기 단계 - 조기 진입 시 상위 노출 가능성 매우 높음');
    } else if (documentCount <= 50) {
      reasons.push(`경쟁자 ${documentCount}개로 적음 - 조기 진입 시 상위 노출 가능성 높음`);
    } else if (documentCount <= 100) {
      reasons.push(`경쟁자 ${documentCount}개 - 아직 경쟁이 치열하지 않아 상위 노출 기회 있음`);
    } else if (documentCount <= 500) {
      reasons.push(`경쟁자 ${documentCount}개 - 적절한 경쟁 수준으로 SEO 최적화 시 상위 노출 가능`);
    } else {
      reasons.push(`경쟁자 ${documentCount}개 - 경쟁이 있지만 검색량이 높아 트래픽 확보 가능`);
    }
    
    // 성장률 기반 분석
    if (growthRate >= 300) {
      reasons.push('급상승 속도가 매우 빠름 - 지금 작성하면 급상승 타이밍에 정확히 맞출 수 있음');
    } else if (growthRate >= 200) {
      reasons.push('급상승 속도가 빠름 - 빠른 작성으로 트래픽 폭발 타이밍 포착 가능');
    } else if (growthRate >= 100) {
      reasons.push('급상승 중 - 지금 작성하면 상위 노출 후 지속적인 트래픽 유입 기대');
    } else if (growthRate >= 50) {
      reasons.push('상승 추세 - 조기 진입으로 안정적인 트래픽 확보 가능');
    }
    
    // 타이밍 골드 점수 기반 분석
    if (timingGoldScore >= 80) {
      reasons.push('타이밍 골드 점수 80점 이상 - 최적의 작성 시점');
    } else if (timingGoldScore >= 70) {
      reasons.push('타이밍 골드 점수 70점 이상 - 매우 좋은 작성 시점');
    } else if (timingGoldScore >= 60) {
      reasons.push('타이밍 골드 점수 60점 이상 - 좋은 작성 시점');
    }
    
    // 경쟁 시간 점수 기반 분석
    if (competitionTimeScore >= 80) {
      reasons.push('경쟁 진입 시간이 매우 짧음 - 지금 바로 작성해야 경쟁 우위 확보 가능');
    } else if (competitionTimeScore >= 60) {
      reasons.push('경쟁 진입 시간이 짧음 - 빠른 작성으로 경쟁 우위 확보 가능');
    }
    
    // 검색량 기반 분석
    if (keyword.searchVolume >= 10000) {
      reasons.push(`월 검색량 ${keyword.searchVolume.toLocaleString()}회로 높음 - 트래픽 폭발 가능성 매우 높음`);
    } else if (keyword.searchVolume >= 5000) {
      reasons.push(`월 검색량 ${keyword.searchVolume.toLocaleString()}회로 중상위 - 안정적인 트래픽 확보 가능`);
    } else if (keyword.searchVolume >= 3000) {
      reasons.push(`월 검색량 ${keyword.searchVolume.toLocaleString()}회 - 적절한 트래픽 확보 가능`);
    }
    
    if (reasons.length === 0) {
      return '조기 진입 시 상위 노출 가능성 높음';
    }
    
    return reasons.join(' • ');
  }
  
  /**
   * 헬퍼 함수: 시간 차이 계산
   */
  getHoursSince(date: Date): number {
    return (Date.now() - date.getTime()) / (1000 * 60 * 60);
  }
}

