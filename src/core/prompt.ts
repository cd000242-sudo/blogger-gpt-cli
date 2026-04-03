// src/core/prompt.ts
export interface BuildPromptOptions {
  topic: string;
  keywordsCSV: string;
  /** 선택값: 없으면 3000으로 사용 */
  minChars?: number;
  /** 말투/어투: professional, friendly, casual, formal, conversational */
  toneStyle?: string;
}

// 주제별 맞춤형 콘텐츠 전략 분석 함수
function analyzeTopicForContentStrategy(topic: string): {
  expertise: string;
  contentFocus: string;
  primaryGoal: string;
  audienceFocus: string;
  contentApproach: string;
  writingStyle: string;
  requiredElements: string;
  contentStructure: string;
  engagementElements: string;
  contentType: string;
  specificInstructions: string;
  uniqueAngle: string;
} {
  const lowerTopic = topic.toLowerCase();

  // 엔터테인먼트/예능 관련
  if (lowerTopic.includes('가왕전') || lowerTopic.includes('투표') || lowerTopic.includes('예능')) {
    return {
      expertise: "예능 프로그램과 팬 문화",
      contentFocus: "시청자 참여와 팬덤 활동",
      primaryGoal: "시청자들이 프로그램을 더 재미있게 즐길 수 있도록 돕는 것",
      audienceFocus: "해당 프로그램을 좋아하는 시청자와 팬들",
      contentApproach: "팬의 관점에서 실제 경험과 감정을 바탕으로 한 솔직한 이야기",
      writingStyle: "친근하고 열정적인 톤으로, 마치 친구와 대화하는 것처럼 자연스럽게",
      requiredElements: "- 실제 시청 경험담과 감상\n- 프로그램에 대한 개인적인 의견과 추천\n- 시청 팁이나 재미있는 포인트",
      contentStructure: "1) 프로그램 소개와 첫인상 2) 개인적인 시청 경험담 3) 추천 포인트와 팁 4) 마무리와 추천",
      engagementElements: "시청자들과의 소통, 개인적인 추억, 프로그램에 대한 애정 표현",
      contentType: "시청 후기와 팬 가이드",
      specificInstructions: "실제로 시청해본 경험을 바탕으로, 프로그램의 매력과 재미있는 포인트를 생생하게 전달해주세요.",
      uniqueAngle: "개인적인 시청 경험과 감정"
    };
  }

  // 기술/IT 관련
  if (lowerTopic.includes('프로그래밍') || lowerTopic.includes('코딩') || lowerTopic.includes('개발') ||
    lowerTopic.includes('it') || lowerTopic.includes('컴퓨터') || lowerTopic.includes('소프트웨어') ||
    lowerTopic.includes('앱') || lowerTopic.includes('웹') || lowerTopic.includes('데이터베이스') ||
    lowerTopic.includes('ai') || lowerTopic.includes('인공지능') || lowerTopic.includes('머신러닝')) {
    return {
      expertise: "소프트웨어 개발과 IT 기술",
      contentFocus: "실무 개발 경험과 기술적 인사이트",
      primaryGoal: "개발자들이 실무에서 바로 활용할 수 있는 실용적인 정보 제공",
      audienceFocus: "초보부터 중급 개발자까지",
      contentApproach: "실무 경험을 바탕으로 한 구체적이고 실용적인 개발 가이드",
      writingStyle: "전문적이면서도 이해하기 쉬운 설명, 코드 예시와 함께",
      requiredElements: "- 실제 프로젝트 경험담\n- 구체적인 코드 예시\n- 실무에서의 팁과 주의사항",
      contentStructure: "1) 기술 소개와 배경 2) 실제 구현 경험 3) 코드 예시와 설명 4) 실무 팁과 주의사항",
      engagementElements: "개발자 커뮤니티와의 소통, 프로젝트 공유, 기술 토론",
      contentType: "기술 튜토리얼과 실무 가이드",
      specificInstructions: "실제 프로젝트에서 사용해본 경험을 바탕으로, 구체적인 코드와 함께 설명해주세요.",
      uniqueAngle: "실무 개발 경험과 기술적 인사이트"
    };
  }

  // 건강/의학 관련 (스포츠 키워드 '운동'은 위에서 먼저 처리됨)
  if (lowerTopic.includes('건강') || lowerTopic.includes('의학') || lowerTopic.includes('병원') ||
    lowerTopic.includes('치료') || lowerTopic.includes('약') ||
    lowerTopic.includes('다이어트') || lowerTopic.includes('영양') || lowerTopic.includes('질병') ||
    lowerTopic.includes('예방') || lowerTopic.includes('증상') || lowerTopic.includes('의료')) {
    return {
      expertise: "건강과 의학 분야",
      contentFocus: "실제 건강 관리 경험과 의학적 정보",
      primaryGoal: "독자들이 건강을 관리하고 의료 정보를 올바르게 이해할 수 있도록 돕는 것",
      audienceFocus: "건강에 관심이 있는 일반인과 환자",
      contentApproach: "실제 건강 관리 경험을 바탕으로 한 실용적이고 신뢰할 수 있는 정보",
      writingStyle: "전문적이면서도 이해하기 쉬운 설명, 실제 경험담과 함께",
      requiredElements: "- 실제 건강 관리 경험담\n- 의학적으로 검증된 정보\n- 실용적인 건강 관리 팁",
      contentStructure: "1) 건강 이슈 소개와 배경 2) 실제 경험담과 증상 3) 전문적 정보와 해결책 4) 예방과 관리 팁",
      engagementElements: "건강 경험 공유, 의료진과의 상담, 건강 관리 팁",
      contentType: "건강 경험담과 의학 가이드",
      specificInstructions: "실제 건강 관리 경험을 바탕으로, 의학적으로 검증된 정보와 함께 설명해주세요.",
      uniqueAngle: "개인적인 건강 경험과 의학적 인사이트"
    };
  }

  // 부동산 관련 (금융보다 먼저 매칭되어야 함)
  if (lowerTopic.includes('아파트') || lowerTopic.includes('전세') || lowerTopic.includes('월세') ||
    lowerTopic.includes('매매') || lowerTopic.includes('분양') || lowerTopic.includes('청약') ||
    lowerTopic.includes('임대') || lowerTopic.includes('실거래')) {
    return {
      expertise: "부동산 시장과 거래",
      contentFocus: "실제 부동산 거래 경험과 시장 분석",
      primaryGoal: "독자들이 현명한 부동산 결정을 할 수 있도록 실질적인 정보 제공",
      audienceFocus: "집을 사고팔려는 사람들과 부동산 투자에 관심이 있는 사람들",
      contentApproach: "실제 거래 경험을 바탕으로 한 현실적인 정보와 주의사항",
      writingStyle: "신중하고 객관적인 톤으로, 데이터와 경험을 균형 있게",
      requiredElements: "- 실제 거래/청약 경험\n- 시세와 비용 분석\n- 계약 시 주의사항",
      contentStructure: "1) 시장 현황과 분석 2) 실제 거래 경험 3) 비용과 절차 4) 주의사항과 팁",
      engagementElements: "실거래 경험, 시세 비교, 절차 안내",
      contentType: "부동산 가이드와 거래 경험담",
      specificInstructions: "실제 거래 경험을 바탕으로, 비용과 절차를 구체적으로 공개해주세요.",
      uniqueAngle: "실제 거래 경험과 시장 데이터 분석"
    };
  }

  // 스포츠/피트니스 관련 (건강에서 '운동' 키워드 분리)
  if (lowerTopic.includes('축구') || lowerTopic.includes('야구') || lowerTopic.includes('농구') ||
    lowerTopic.includes('헬스') || lowerTopic.includes('크로스핏') || lowerTopic.includes('러닝') ||
    lowerTopic.includes('수영') || lowerTopic.includes('골프') || lowerTopic.includes('테니스') ||
    lowerTopic.includes('필라테스') || lowerTopic.includes('요가')) {
    return {
      expertise: "스포츠와 피트니스",
      contentFocus: "실제 운동 경험과 효과적인 트레이닝 방법",
      primaryGoal: "독자들이 올바른 방법으로 운동하고 건강을 관리할 수 있도록 돕는 것",
      audienceFocus: "운동을 시작하거나 실력을 향상시키고 싶은 사람들",
      contentApproach: "실제 운동 경험을 바탕으로 한 현실적이고 실용적인 정보",
      writingStyle: "동기부여가 되면서도 과학적 근거가 있는 전문적인 톤",
      requiredElements: "- 실제 운동 루틴과 경험\n- 부상 방지와 올바른 자세\n- 단계별 프로그램 제안",
      contentStructure: "1) 종목/운동 소개 2) 실제 트레이닝 경험 3) 올바른 방법과 주의사항 4) 루틴 추천과 팁",
      engagementElements: "운동 경험 공유, 체형 변화 스토리, 트레이닝 팁",
      contentType: "운동 가이드와 피트니스 경험담",
      specificInstructions: "실제 운동 경험을 바탕으로, 올바른 자세와 효과적인 방법을 구체적으로 설명해주세요.",
      uniqueAngle: "실제 운동 경험과 과학적 근거를 결합한 가이드"
    };
  }

  // 금융/투자 관련 (부동산 키워드는 위에서 먼저 처리됨)
  if (lowerTopic.includes('투자') || lowerTopic.includes('주식') || lowerTopic.includes('금융') ||
    lowerTopic.includes('재테크') || lowerTopic.includes('예금') || lowerTopic.includes('대출') ||
    lowerTopic.includes('보험') || lowerTopic.includes('펀드')) {
    return {
      expertise: "금융과 투자 분야",
      contentFocus: "실제 투자 경험과 금융 상품 이해",
      primaryGoal: "독자들이 올바른 금융 지식을 바탕으로 현명한 투자 결정을 할 수 있도록 돕는 것",
      audienceFocus: "투자와 금융에 관심이 있는 일반인",
      contentApproach: "실제 투자 경험을 바탕으로 한 실용적이고 신뢰할 수 있는 금융 정보",
      writingStyle: "신중하고 전문적인 톤으로, 리스크를 명확히 설명",
      requiredElements: "- 실제 투자 경험담\n- 금융 상품에 대한 정확한 정보\n- 리스크와 주의사항",
      contentStructure: "1) 금융 상품 소개와 특징 2) 실제 투자 경험담 3) 수익과 리스크 분석 4) 투자 가이드와 주의사항",
      engagementElements: "투자 경험 공유, 금융 상품 비교, 리스크 관리",
      contentType: "투자 경험담과 금융 가이드",
      specificInstructions: "실제 투자 경험을 바탕으로, 리스크를 명확히 설명하며 신중하게 작성해주세요.",
      uniqueAngle: "개인적인 투자 경험과 금융적 인사이트"
    };
  }

  // 교육/학습 관련
  if (lowerTopic.includes('교육') || lowerTopic.includes('학습') || lowerTopic.includes('공부') ||
    lowerTopic.includes('시험') || lowerTopic.includes('자격증') || lowerTopic.includes('언어') ||
    lowerTopic.includes('영어') || lowerTopic.includes('중국어') || lowerTopic.includes('일본어')) {
    return {
      expertise: "교육과 학습 분야",
      contentFocus: "실제 학습 경험과 효과적인 교육 방법",
      primaryGoal: "독자들이 효율적으로 학습하고 목표를 달성할 수 있도록 돕는 것",
      audienceFocus: "학습에 관심이 있는 학생과 성인",
      contentApproach: "실제 학습 경험을 바탕으로 한 실용적이고 효과적인 학습 방법",
      writingStyle: "격려적이고 동기부여가 되는 톤으로, 구체적인 방법론 제시",
      requiredElements: "- 실제 학습 경험담\n- 효과적인 학습 방법\n- 구체적인 학습 팁과 전략",
      contentStructure: "1) 학습 목표와 배경 2) 실제 학습 경험담 3) 효과적인 방법론 4) 학습 팁과 전략",
      engagementElements: "학습 경험 공유, 학습 방법 토론, 동기부여",
      contentType: "학습 경험담과 교육 가이드",
      specificInstructions: "실제 학습 경험을 바탕으로, 효과적인 학습 방법을 구체적으로 설명해주세요.",
      uniqueAngle: "개인적인 학습 경험과 교육적 인사이트"
    };
  }

  // 요리/음식 관련
  if (lowerTopic.includes('요리') || lowerTopic.includes('레시피') || lowerTopic.includes('음식')) {
    return {
      expertise: "요리와 음식 문화",
      contentFocus: "실제 요리 경험과 맛있는 음식 만들기",
      primaryGoal: "독자들이 집에서 쉽게 따라할 수 있는 요리법과 팁 제공",
      audienceFocus: "요리를 좋아하는 일반인과 요리 초보자",
      contentApproach: "실제 요리해본 경험을 바탕으로 한 친근하고 실용적인 가이드",
      writingStyle: "따뜻하고 친근한 톤으로, 마치 어머니가 가르쳐주는 것처럼",
      requiredElements: "- 실제 요리 경험담\n- 구체적인 레시피와 팁\n- 맛과 향에 대한 생생한 묘사",
      contentStructure: "1) 요리 소개와 첫인상 2) 재료 준비와 팁 3) 단계별 요리법 4) 완성 후기와 추천",
      engagementElements: "요리 경험 공유, 맛 평가, 가족과의 추억",
      contentType: "요리 후기와 레시피 가이드",
      specificInstructions: "실제로 요리해본 경험을 바탕으로, 구체적인 레시피와 함께 맛있게 만드는 팁을 알려주세요.",
      uniqueAngle: "개인적인 요리 경험과 맛의 추억"
    };
  }

  // 여행 관련
  if (lowerTopic.includes('여행') || lowerTopic.includes('관광') || lowerTopic.includes('여행지')) {
    return {
      expertise: "여행과 관광 문화",
      contentFocus: "실제 여행 경험과 현지 정보",
      primaryGoal: "독자들이 더 좋은 여행을 계획할 수 있도록 돕는 것",
      audienceFocus: "여행을 계획하는 사람들과 여행 애호가",
      contentApproach: "실제 여행해본 경험을 바탕으로 한 생생하고 실용적인 여행 가이드",
      writingStyle: "생동감 있고 감성적인 톤으로, 여행의 설렘과 추억을 전달",
      requiredElements: "- 실제 여행 경험담\n- 구체적인 여행 정보와 팁\n- 현지 분위기와 감동 포인트",
      contentStructure: "1) 여행지 소개와 첫인상 2) 여행 계획과 준비 3) 현지 경험담 4) 추천 포인트와 팁",
      engagementElements: "여행 추억 공유, 현지 문화 체험, 사진과 함께하는 이야기",
      contentType: "여행 후기와 가이드",
      specificInstructions: "실제로 여행해본 경험을 바탕으로, 생생한 현지 정보와 함께 여행의 감동을 전달해주세요.",
      uniqueAngle: "개인적인 여행 경험과 현지 문화 체험"
    };
  }

  // 뷰티/패션 관련
  if (lowerTopic.includes('화장품') || lowerTopic.includes('메이크업') || lowerTopic.includes('패션') ||
    lowerTopic.includes('코디') || lowerTopic.includes('스킨케어') || lowerTopic.includes('뷰티') ||
    lowerTopic.includes('헤어') || lowerTopic.includes('네일') || lowerTopic.includes('향수')) {
    return {
      expertise: "뷰티와 패션 트렌드",
      contentFocus: "실제 사용 후기와 스타일링 노하우",
      primaryGoal: "독자들이 자신에게 맞는 제품과 스타일을 찾을 수 있도록 돕는 것",
      audienceFocus: "뷰티와 패션에 관심이 많은 20~40대",
      contentApproach: "실제 사용 경험과 before/after를 바탕으로 한 솔직한 리뷰",
      writingStyle: "친근하고 공감대 높은 톤으로, 제품의 장단점을 솔직하게",
      requiredElements: "- 실제 사용 후기와 체감 효과\n- 가격 대비 만족도\n- 피부 타입/체형별 맞춤 추천",
      contentStructure: "1) 제품/트렌드 소개 2) 실제 사용 경험 3) 장단점 비교 4) 추천 대상과 팁",
      engagementElements: "비포/애프터 경험, 제품 비교, 계절별 추천",
      contentType: "뷰티 리뷰와 스타일링 가이드",
      specificInstructions: "실제로 사용해본 경험을 바탕으로 솔직한 장단점과 함께 추천해주세요.",
      uniqueAngle: "실사용 경험과 피부 타입별 맞춤 조언"
    };
  }

  // 인테리어/가구 관련
  if (lowerTopic.includes('인테리어') || lowerTopic.includes('가구') || lowerTopic.includes('리모델링') ||
    lowerTopic.includes('홈데코') || lowerTopic.includes('수납') || lowerTopic.includes('벽지') ||
    lowerTopic.includes('조명') || lowerTopic.includes('셀프 인테리어')) {
    return {
      expertise: "인테리어 디자인과 공간 활용",
      contentFocus: "실제 시공 경험과 공간 변화 스토리",
      primaryGoal: "독자들이 자신의 공간을 더 아름답고 기능적으로 꾸밀 수 있도록 돕는 것",
      audienceFocus: "이사 준비중이거나 집 꾸미기에 관심 있는 사람들",
      contentApproach: "실제 시공/구매 경험을 바탕으로 한 리얼 후기와 비용 정보",
      writingStyle: "감성적이면서도 실용적인 톤으로, 공간의 변화를 생생하게 전달",
      requiredElements: "- 실제 시공/설치 경험담\n- 비용과 소요 시간\n- 추천 브랜드와 주의사항",
      contentStructure: "1) 공간 고민과 컨셉 2) 시공/구매 과정 3) 완성 후기와 만족도 4) 비용 정리와 팁",
      engagementElements: "공간 변화 스토리, 비용 비교, 홈스타일링 팁",
      contentType: "인테리어 후기와 공간 가이드",
      specificInstructions: "실제 시공 경험을 바탕으로 비용, 기간, 만족도를 구체적으로 알려주세요.",
      uniqueAngle: "실제 공간 변화 경험과 비용 투명 공개"
    };
  }

  // 게임/e스포츠 관련
  if (lowerTopic.includes('게임') || lowerTopic.includes('롤') || lowerTopic.includes('발로란트') ||
    lowerTopic.includes('플레이스테이션') || lowerTopic.includes('닌텐도') || lowerTopic.includes('스팀') ||
    lowerTopic.includes('e스포츠') || lowerTopic.includes('모바일게임') || lowerTopic.includes('마인크래프트')) {
    return {
      expertise: "게임 플레이와 공략",
      contentFocus: "실제 플레이 경험과 전략적 인사이트",
      primaryGoal: "게이머들이 더 잘 플레이하고 게임을 즐길 수 있도록 돕는 것",
      audienceFocus: "해당 게임을 플레이하는 게이머들",
      contentApproach: "실제 플레이 경험을 바탕으로 한 구체적인 공략과 팁",
      writingStyle: "게이머 커뮤니티 톤으로, 실전 경험 중심의 생생한 전달",
      requiredElements: "- 실제 플레이 경험과 전적\n- 구체적인 전략과 빌드\n- 초보자도 따라할 수 있는 단계별 가이드",
      contentStructure: "1) 게임/캐릭터 소개 2) 실전 플레이 경험 3) 핵심 공략과 팁 4) 추천 세팅과 마무리",
      engagementElements: "실전 경험담, 티어별 공략, 메타 분석",
      contentType: "게임 공략과 리뷰",
      specificInstructions: "실제 플레이 경험을 바탕으로 구체적인 전략과 수치를 포함해 작성해주세요.",
      uniqueAngle: "실전 플레이 경험과 데이터 기반 공략"
    };
  }


  // 자동차/모빌리티 관련
  if (lowerTopic.includes('자동차') || lowerTopic.includes('전기차') || lowerTopic.includes('suv') ||
    lowerTopic.includes('중고차') || lowerTopic.includes('차량') || lowerTopic.includes('현대') ||
    lowerTopic.includes('기아') || lowerTopic.includes('테슬라') || lowerTopic.includes('bmw')) {
    return {
      expertise: "자동차와 모빌리티",
      contentFocus: "실제 차량 소유/시승 경험과 실용적인 정보",
      primaryGoal: "독자들이 현명한 차량 선택과 관리를 할 수 있도록 돕는 것",
      audienceFocus: "차량 구매를 고려하거나 관리 정보가 필요한 운전자",
      contentApproach: "실제 시승/소유 경험을 바탕으로 한 솔직한 리뷰와 비교",
      writingStyle: "객관적이면서도 개인적인 경험을 녹여낸 리뷰 톤",
      requiredElements: "- 실제 시승/소유 경험\n- 연비, 유지비, 편의사양 비교\n- 구매 시 주의사항과 팁",
      contentStructure: "1) 차량 소개와 스펙 2) 실제 시승/소유 경험 3) 장단점 비교 4) 구매 가이드와 팁",
      engagementElements: "실제 운전 경험, 차량 비교, 유지비 공개",
      contentType: "자동차 리뷰와 구매 가이드",
      specificInstructions: "실제 시승이나 소유 경험을 바탕으로, 연비와 유지비를 구체적으로 공개해주세요.",
      uniqueAngle: "실제 소유 경험과 유지비 투명 공개"
    };
  }

  // 육아/교육(아동) 관련
  if (lowerTopic.includes('육아') || lowerTopic.includes('아기') || lowerTopic.includes('태교') ||
    lowerTopic.includes('어린이집') || lowerTopic.includes('유치원') || lowerTopic.includes('이유식') ||
    lowerTopic.includes('신생아') || lowerTopic.includes('출산')) {
    return {
      expertise: "육아와 아동 교육",
      contentFocus: "실제 육아 경험과 아이 발달에 도움이 되는 정보",
      primaryGoal: "부모들이 더 나은 육아를 할 수 있도록 실질적인 도움 제공",
      audienceFocus: "임산부와 영유아 부모",
      contentApproach: "실제 육아 경험을 바탕으로 한 공감대 높은 정보 공유",
      writingStyle: "따뜻하고 공감적인 톤으로, 육아의 기쁨과 어려움을 함께 나누는 느낌",
      requiredElements: "- 실제 육아 경험담\n- 발달 단계별 정보\n- 제품 추천과 주의사항",
      contentStructure: "1) 육아 상황 소개 2) 실제 경험담과 시행착오 3) 해결 방법과 팁 4) 추천과 마무리",
      engagementElements: "육아 경험 공유, 월령별 정보, 부모 공감대",
      contentType: "육아 경험담과 가이드",
      specificInstructions: "실제 육아 경험을 바탕으로, 시행착오와 해결 방법을 솔직하게 공유해주세요.",
      uniqueAngle: "실제 부모의 시행착오와 성장 스토리"
    };
  }

  // 반려동물 관련
  if (lowerTopic.includes('강아지') || lowerTopic.includes('고양이') || lowerTopic.includes('반려동물') ||
    lowerTopic.includes('펫') || lowerTopic.includes('사료') || lowerTopic.includes('동물병원')) {
    return {
      expertise: "반려동물 케어와 건강",
      contentFocus: "실제 반려동물 양육 경험과 건강 관리 정보",
      primaryGoal: "반려인들이 반려동물과 더 건강하고 행복하게 지낼 수 있도록 돕는 것",
      audienceFocus: "반려동물을 키우고 있거나 입양을 고려하는 사람들",
      contentApproach: "실제 양육 경험을 바탕으로 한 진솔한 이야기와 전문 정보",
      writingStyle: "사랑이 담긴 따뜻한 톤으로, 반려동물과의 일상을 생생하게",
      requiredElements: "- 실제 양육 경험담\n- 건강 관리와 병원 이용 팁\n- 제품/사료 추천과 비교",
      contentStructure: "1) 반려동물 소개 2) 양육 경험담 3) 건강/관리 정보 4) 추천과 주의사항",
      engagementElements: "반려동물과의 일상, 건강 관리 팁, 비용 공개",
      contentType: "반려동물 양육 가이드",
      specificInstructions: "실제 양육 경험을 바탕으로, 건강 관리와 비용을 구체적으로 알려주세요.",
      uniqueAngle: "실제 반려인의 진솔한 양육 경험"
    };
  }

  // 법률/행정 관련
  if (lowerTopic.includes('법률') || lowerTopic.includes('소송') || lowerTopic.includes('계약') ||
    lowerTopic.includes('민원') || lowerTopic.includes('등기') || lowerTopic.includes('변호사') ||
    lowerTopic.includes('형사') || lowerTopic.includes('민사') || lowerTopic.includes('상속')) {
    return {
      expertise: "법률 상담과 행정 절차",
      contentFocus: "실제 법률 상담 경험과 행정 절차 안내",
      primaryGoal: "독자들이 법률 문제를 올바르게 이해하고 대처할 수 있도록 돕는 것",
      audienceFocus: "법률 문제에 직면한 일반인",
      contentApproach: "실제 사례를 바탕으로 한 이해하기 쉬운 법률 정보",
      writingStyle: "정확하고 신중한 톤으로, 법률 용어를 쉽게 풀어 설명",
      requiredElements: "- 실제 상담/처리 경험\n- 관련 법조항과 절차\n- 비용과 소요 기간",
      contentStructure: "1) 법률 이슈 소개 2) 관련 법률과 판례 3) 실제 처리 경험 4) 절차와 비용 안내",
      engagementElements: "실제 사례 공유, 전문가 조언, 절차 안내",
      contentType: "법률 가이드와 행정 절차 안내",
      specificInstructions: "법률 용어를 쉽게 풀어서 설명하고, 실제 절차와 비용을 구체적으로 안내해주세요.",
      uniqueAngle: "복잡한 법률을 쉽게 풀어주는 실전 가이드"
    };
  }


  // 쇼핑/리뷰 관련
  if (lowerTopic.includes('추천') || lowerTopic.includes('리뷰') || lowerTopic.includes('후기') ||
    lowerTopic.includes('비교') || lowerTopic.includes('쿠팡') || lowerTopic.includes('가성비') ||
    lowerTopic.includes('언박싱') || lowerTopic.includes('할인')) {
    return {
      expertise: "소비자 리뷰와 제품 비교",
      contentFocus: "실제 구매/사용 후기와 가성비 분석",
      primaryGoal: "독자들이 현명한 소비 결정을 할 수 있도록 솔직한 정보 제공",
      audienceFocus: "제품 구매를 고려 중인 소비자",
      contentApproach: "실제 구매 경험을 바탕으로 한 솔직하고 객관적인 리뷰",
      writingStyle: "솔직하고 비교 분석적인 톤으로, 장단점을 명확하게",
      requiredElements: "- 실제 구매/사용 경험\n- 가격 비교와 가성비 분석\n- 대안 제품 추천",
      contentStructure: "1) 제품 소개와 구매 동기 2) 실제 사용 후기 3) 장단점 비교 4) 최종 추천과 팁",
      engagementElements: "구매 경험, 제품 비교표, 가성비 분석",
      contentType: "제품 리뷰와 비교 가이드",
      specificInstructions: "실제 구매 경험을 바탕으로 가격, 성능, 장단점을 솔직하게 비교해주세요.",
      uniqueAngle: "실구매자의 솔직한 비교 분석"
    };
  }

  // 문화/공연 관련
  if (lowerTopic.includes('영화') || lowerTopic.includes('드라마') || lowerTopic.includes('뮤지컬') ||
    lowerTopic.includes('전시') || lowerTopic.includes('콘서트') || lowerTopic.includes('넷플릭스') ||
    lowerTopic.includes('웹툰') || lowerTopic.includes('도서') || lowerTopic.includes('책')) {
    return {
      expertise: "문화 콘텐츠와 공연 예술",
      contentFocus: "실제 관람/감상 경험과 리뷰",
      primaryGoal: "독자들이 좋은 문화 콘텐츠를 발견하고 즐길 수 있도록 돕는 것",
      audienceFocus: "문화 생활을 즐기는 사람들",
      contentApproach: "실제 관람 경험을 바탕으로 한 감성적이고 분석적인 리뷰",
      writingStyle: "감성적이면서도 분석적인 톤으로, 스포일러 없이 매력을 전달",
      requiredElements: "- 실제 관람/감상 후기\n- 작품 분석과 인상 깊은 장면\n- 관람 팁과 추천 대상",
      contentStructure: "1) 작품 소개와 기대감 2) 관람 경험과 감상 3) 분석과 인상 포인트 4) 추천과 팁",
      engagementElements: "관람 경험 공유, 작품 비교, 추천 리스트",
      contentType: "문화 리뷰와 감상 가이드",
      specificInstructions: "스포일러 없이 작품의 매력을 전달하고, 관람 팁을 구체적으로 알려주세요.",
      uniqueAngle: "감성적 관람 경험과 작품 분석"
    };
  }

  // 취미/DIY 관련
  if (lowerTopic.includes('캠핑') || lowerTopic.includes('낚시') || lowerTopic.includes('등산') ||
    lowerTopic.includes('공예') || lowerTopic.includes('베이킹') || lowerTopic.includes('원예') ||
    lowerTopic.includes('사진') || lowerTopic.includes('그림') || lowerTopic.includes('목공')) {
    return {
      expertise: "취미 생활과 DIY 프로젝트",
      contentFocus: "실제 취미 활동 경험과 입문 가이드",
      primaryGoal: "독자들이 새로운 취미를 시작하고 즐길 수 있도록 돕는 것",
      audienceFocus: "새로운 취미를 찾거나 실력을 키우고 싶은 사람들",
      contentApproach: "실제 취미 활동 경험을 바탕으로 한 입문자 친화적인 가이드",
      writingStyle: "열정적이고 친근한 톤으로, 취미의 즐거움을 전달",
      requiredElements: "- 실제 활동 경험담\n- 입문자를 위한 장비/준비물 가이드\n- 비용과 시간 투자 정보",
      contentStructure: "1) 취미 소개와 매력 2) 시작 방법과 준비물 3) 실제 활동 경험 4) 팁과 추천",
      engagementElements: "활동 경험 공유, 장비 추천, 커뮤니티 정보",
      contentType: "취미 입문 가이드",
      specificInstructions: "입문자도 쉽게 따라할 수 있도록 준비물, 비용, 단계별 방법을 구체적으로 안내해주세요.",
      uniqueAngle: "실제 취미 활동 경험과 입문자 맞춤 가이드"
    };
  }

  // 사업/창업 관련
  if (lowerTopic.includes('창업') || lowerTopic.includes('사업') || lowerTopic.includes('프리랜서') ||
    lowerTopic.includes('부업') || lowerTopic.includes('스타트업') || lowerTopic.includes('자영업') ||
    lowerTopic.includes('쇼핑몰') || lowerTopic.includes('매출') || lowerTopic.includes('마케팅')) {
    return {
      expertise: "창업과 사업 운영",
      contentFocus: "실제 사업 경험과 실전 노하우",
      primaryGoal: "예비 창업자와 사업자들에게 실질적인 경험과 정보 제공",
      audienceFocus: "창업을 준비하거나 사업을 운영 중인 사람들",
      contentApproach: "실제 사업 경험을 바탕으로 한 현실적이고 솔직한 정보",
      writingStyle: "현실적이고 솔직한 톤으로, 성공과 실패 경험 모두 공유",
      requiredElements: "- 실제 창업/사업 경험담\n- 초기 비용과 수익 구조\n- 실패 경험과 극복 방법",
      contentStructure: "1) 사업 아이템과 동기 2) 준비 과정과 초기 비용 3) 운영 경험과 시행착오 4) 교훈과 팁",
      engagementElements: "사업 경험 공유, 비용 투명 공개, 수익 분석",
      contentType: "창업 경험담과 사업 가이드",
      specificInstructions: "실제 사업 경험을 바탕으로, 비용과 수익을 투명하게 공개하고 시행착오를 솔직하게 공유해주세요.",
      uniqueAngle: "실패와 성공을 모두 담은 리얼 창업 스토리"
    };
  }

  // 기본 패턴 (일반적인 주제)
  return {
    expertise: "해당 분야의 실무자",
    contentFocus: "실용적이고 도움이 되는 정보",
    primaryGoal: "독자들에게 실질적인 도움을 주는 콘텐츠 제공",
    audienceFocus: "해당 주제에 관심이 있는 일반인",
    contentApproach: "실무 경험을 바탕으로 한 솔직하고 실용적인 정보 공유",
    writingStyle: "친근하고 자연스러운 톤으로, 개인적인 경험과 의견을 포함",
    requiredElements: "- 실제 경험담과 개인적인 의견\n- 구체적이고 실용적인 정보\n- 독자에게 도움이 되는 팁과 조언",
    contentStructure: "1) 주제 소개와 배경 2) 개인적인 경험담 3) 실용적인 정보와 팁 4) 마무리와 추천",
    engagementElements: "개인적인 경험 공유, 독자와의 소통, 실용적인 조언",
    contentType: "경험담과 실용 가이드",
    specificInstructions: "실제 경험을 바탕으로, 독자들에게 도움이 될 수 있는 구체적이고 실용적인 정보를 제공해주세요.",
    uniqueAngle: "개인적인 경험과 실무 인사이트"
  };
}

export function buildContentPrompt(opts: BuildPromptOptions & { sectionCount?: number }) {
  const { topic, keywordsCSV, toneStyle = 'professional' } = opts;

  // minChars 정규화(없거나 비정상이면 3000)
  const mc = Number.isFinite(Number(opts.minChars)) ? Number(opts.minChars) : 3000;
  // 섹션 개수 동적 계산 (sectionCount가 있으면 사용, 없으면 글자수 기반으로 추정)
  const sectionCount = Number.isFinite(Number(opts.sectionCount)) ? Number(opts.sectionCount) : Math.max(5, Math.ceil(mc / 1200));
  const per = Math.max(1600, Math.floor(mc / sectionCount));

  // 주제별 맞춤형 전략 분석
  const strategy = analyzeTopicForContentStrategy(topic);

  // 말투/어투 지시사항 생성
  const toneInstructions: Record<string, string> = {
    'professional': '전문적이고 신뢰할 수 있는 톤으로 작성하되, 독자가 쉽게 이해할 수 있도록 명확하고 간결하게 표현해주세요.',
    'friendly': '친근하고 따뜻한 톤으로 작성하되, 마치 친구에게 설명하는 것처럼 자연스럽고 편안하게 표현해주세요.',
    'casual': '캐주얼하고 편안한 톤으로 작성하되, 격식을 차리지 않고 자유롭고 부드럽게 표현해주세요.',
    'formal': '격식있고 정중한 톤으로 작성하되, 존중과 정중함을 유지하면서도 독자가 이해하기 쉽게 표현해주세요.',
    'conversational': '대화하듯이 자연스러운 톤으로 작성하되, 독자와 직접 대화하는 것처럼 친밀하고 소통하는 느낌으로 표현해주세요.'
  };

  const toneInstruction = toneInstructions[toneStyle] || toneInstructions['professional'];

  // CSS는 generateCSSFinal()에서 전담 — 프롬프트에서는 시맨틱 HTML만 출력
  const TAG_UL = '<ul class="tags">';

  // 섹션 개수에 따른 동적 섹션 생성
  const generateSections = (count: number): string => {
    const sections: string[] = [];
    for (let i = 1; i <= count; i++) {
      let description = '';
      if (i === 1) {
        description = '독창적인 스토리텔링과 매력적인 도입부';
      } else if (i === count) {
        description = '실용적 가이드와 구체적 적용법, 혁신적 결론과 차별화된 액션 플랜';
      } else if (i === 2) {
        description = '고유한 인사이트와 차별화된 관점';
      } else if (i === 3) {
        description = '혁신적인 접근법과 창의적 해결책';
      } else if (i === 4) {
        description = '검증된 데이터와 전문적 분석';
      } else {
        description = '심층 분석과 실전 노하우';
      }
      sections.push(`  <section id="s${i}"> ... ${i}회차 본문(${description}) ... </section>`);
    }
    return sections.join('\n');
  };

  const sectionsHtml = generateSections(sectionCount);

  return `
            당신은 ${strategy.expertise} 전문가이자 경험 많은 블로거입니다.
            ${strategy.contentFocus}에 대한 깊이 있는 이해를 바탕으로 독자들에게 실질적인 도움을 주는 콘텐츠를 작성해야 합니다.

            🎯 **E-E-A-T 기준 준수 (Google 품질 평가 가이드라인)**:
            
            📚 **Experience (경험)**:
            - 실제로 경험해본 개인적인 경험담을 바탕으로 작성
            - "제가 직접 해봤는데...", "실제로는...", "개인적으로는..." 등 구체적 경험 표현
            - 시간과 장소가 명확한 구체적인 상황 묘사
            - 실패와 성공 경험 모두 솔직하게 공유
            
            🎓 **Expertise (전문성)**:
            - ${strategy.expertise} 분야의 깊이 있는 지식과 이해도 보여주기
            - 전문적인 용어를 적절히 사용하되 독자가 이해할 수 있게 설명
            - 실무에서 바로 적용 가능한 구체적이고 실용적인 조언
            
            🏆 **Authoritativeness (권위성)**:
            - 검증된 사실과 공식 데이터를 바탕으로 한 정확한 정보
            - 다른 전문가들도 인정할 만한 수준의 깊이 있는 분석
            
            🛡️ **Trustworthiness (신뢰성)**:
            - 정확하고 검증된 정보만 제공
            - 추측이나 불확실한 정보는 명확히 표시
            - 편견 없이 객관적이고 균형 잡힌 시각 제시
            
            🎨 **Originality (독창성)**:
            - 기존 콘텐츠와 완전히 다른 독자적이고 독특한 시각
            - 다른 글에서 찾을 수 없는 특별한 가치와 정보

            📝 **작성 스타일**:
            ${strategy.writingStyle}
            
            🎭 **말투/어투**:
            ${toneInstruction}
            - 선택된 말투/어투를 일관되게 유지하면서 작성해주세요.
            - 문장 구조와 어휘 선택에서도 해당 말투/어투를 반영해주세요.

            🎯 **SEO 최적화 구조 (노출→클릭→체류→전환)**:
            
            📈 **1단계: 노출 최적화 (Search Visibility)**:
            - 핵심 키워드를 제목과 본문에 자연스럽게 포함
            - 메타 설명에 검색 의도와 핵심 가치 명확히 표현
            - 검색 엔진이 콘텐츠를 이해할 수 있도록 구조화
            - 관련 키워드와 LSI 키워드 적절히 배치
            - 제목(H1)에는 반드시 핵심 키워드 포함
            
            👆 **2단계: 클릭 유도 (Click-Through Rate)**:
            - 제목은 호기심을 자극하되 약속은 지킬 수 있는 범위
            - 숫자, 질문형, 긴급성, 혜택 등을 활용한 매력적 제목
            - 독자가 "이건 꼭 읽어야겠다"고 느끼는 제목 작성
            - 서론에서 독자의 문제를 정확히 짚어 공감대 형성
            - "이 글을 읽으면 무엇을 얻을 수 있는지" 명확히 제시
            
            ⏱️ **3단계: 체류시간 증가 (Dwell Time)**:
            - 독자가 끝까지 읽고 싶게 만드는 흥미로운 구성
            - 실용적이고 바로 적용 가능한 정보 제공
            - 문단 구분과 여백을 활용한 가독성 극대화
            - 시각적 요소(표, 리스트, 체크리스트)로 이해도 향상
            - 각 섹션마다 "아, 이거 궁금했는데!"라는 느낌 제공
            - 실제 경험담과 구체적 사례로 몰입도 증가
            - 다음 섹션에 대한 호기심 유발로 끝까지 읽게 유도
            
            💰 **4단계: 전환 유도 (Conversion)**:
            - 각 섹션 끝에 자연스러운 CTA 배치
            - 독자의 검색 의도를 정확히 파악하여 맞는 링크 제공
            - "지금 확인하면 도움이 될 정보" 같은 명확한 제안
            - 공식 사이트나 신뢰할 수 있는 외부 링크 연결
            - 후킹 멘트로 클릭 유도하되 강요하지 않는 자연스러움
            - 마무리 부분에서 핵심 정보 요약과 추가 행동 유도

            🚫 **절대 금지사항**:
            - 일반적인 서류/비용/처리기간 패턴 사용 금지
            - 모든 주제에 똑같은 구조 적용 금지  
            - 대본처럼 뻔한 질문-답변 형식 금지
            - "실수하기 쉬운 부분이 있나요? 어떻게 예방할까요?" 같은 뻔한 질문 금지
            - "요즘 어떤 변화가 있나요? 트렌드는 어떻게 되나요?" 같은 템플릿 질문 금지
            - "실제로 얼마나 걸리고 비용은 어느 정도일까요?" 같은 뻔한 질문 금지
            - "추가 전문가 가이드" 섹션 완전 금지
            - "실무자 체크리스트" 섹션 완전 금지
            - "효율적 진행 시스템" 같은 뻔한 섹션 금지
            - "최종 확인사항" 같은 뻔한 섹션 금지
            - "서류 준비 전문가 가이드" 같은 주제와 맞지 않는 섹션 금지
            - "필요한 서류 및 준비물 안내" 같은 주제와 맞지 않는 섹션 금지
            - 주제와 전혀 관련 없는 내용 생성 금지 (예: 배송 주제에 서류 가이드)
            - 과도한 통계나 수치 나열 금지
            - "핵심 포인트", "업데이트", "성공률", "전문가 검증" 같은 섹션 금지
            - "2025년 업데이트", "성공률 89%", "전문가 3명" 같은 통계 표현 금지
            - 기계적이고 형식적인 표현 금지
            - HTML 엔티티 코드 (&#숫자;, &문자;) 사용 금지
            - 특수 기호 (▶, ►, ▸, ●, ■, ◆, • 등) 사용 금지
            - 이모지나 특수문자 사용 금지
            - 파란색 점이나 색상이 있는 레이아웃 요소 사용 금지
            - 시각적 구분자나 장식 요소 사용 금지
            
            🚨 **신뢰도 해치는 요소 금지**:
            - 검증되지 않은 정보나 추측성 내용 포함 금지
            - "~일 것 같습니다", "~라고 합니다" 같은 불확실한 표현 금지
            - 확실하지 않은 통계나 수치 사용 금지
            - 주제와 관련 없는 일반적인 조언 포함 금지
            - 잘못된 정보로 인한 독자 피해 가능성 있는 내용 금지
            - 개인적 의견을 사실처럼 표현하는 것 금지
            - 최신 정보가 아닌데 최신인 것처럼 표현하는 것 금지

            ✅ **E-E-A-T 필수 포함 요소**:
            ${strategy.requiredElements}
            
            📋 **최고 품질 검증 체크리스트 (MANDATORY)**:
            - [ ] 모든 정보가 100% 검증되었는가?
            - [ ] 개인적 경험담이 구체적이고 생생한가?
            - [ ] 전문적인 지식이 적절히 드러나는가?
            - [ ] 주제와 직접적으로 관련된 내용만 포함되어 있는가?
            - [ ] 독자에게 실질적인 도움이 되는 정보인가?
            - [ ] AI가 작성한 것처럼 보이지 않는 자연스러운 톤인가?
            - [ ] 기존 콘텐츠와 완전히 다른 독창적인 내용인가?
            - [ ] 불확실한 정보는 명시적으로 표시되었는가?
            - [ ] 개인적 의견과 객관적 사실이 구분되었는가?
            - [ ] 독자의 안전과 이익을 고려한 내용인가?
            - [ ] 검증된 출처와 공식 데이터를 사용했는가?
            - [ ] 최신 정보가 아닌 경우 날짜가 명시되었는가?
            
            ⭐ **품질 점수 기준 (90점 이상 필수)**:
            - 정확성: 25점 (모든 정보가 검증됨)
            - 전문성: 25점 (깊이 있는 전문 지식)
            - 신뢰성: 25점 (검증된 출처와 투명성)
            - 독창성: 25점 (완전히 새로운 내용)
            - 총점 90점 미만 시 콘텐츠 거부

            🎨 **콘텐츠 구조**:
            ${strategy.contentStructure}

            💡 **독자 참여 요소**:
            ${strategy.engagementElements}

            📝 **제목 작성 규칙**:
            - 공식적이고 딱딱한 제목 절대 금지 (예: "신청 방법 및 절차", "가이드", "방법론")
            - 자연스럽고 매력적인 제목 작성 (예: "이거 진짜 좋아요", "완전 추천", "솔직한 후기")
            - 개인적 경험담 느낌의 제목 (예: "제가 직접 해봤는데", "실제로는 이렇게")
            - 과도한 키워드 나열 금지
            - 친근하고 구어체 느낌의 제목 선호

[주제]
- ${topic}

[연관 키워드(콤마)]
- ${keywordsCSV}

[주제별 맞춤형 작성 지침]
${strategy.specificInstructions}

[콘텐츠 구조 요구사항]
- 총 ${sectionCount}회차 구성, 회차당 약 ${per}자 이상, 전체(공백 제외) 최소 ${mc}자 이상
- 소제목(h2)은 각 회차마다 자연스럽게 배치 (총 ${sectionCount - 1}개 정도)
- 각 회차는 독립적이면서도 연결된 스토리를 구성
- 길이보다는 각 섹션의 실용성과 깊이에 집중
- 독자에게 실질적 도움이 되는 내용으로 구성

[자연스러운 경험글 톤 규칙]
- **개인적 경험담 중심**: "제가 직접 해봤는데...", "실제로는...", "개인적으로는..." 등 개인적 경험 포함
- **솔직한 표현**: "그런데 생각보다...", "예상과 달리...", "솔직히 말하면..." 등 솔직한 표현 사용
- **시간 흐름 표현**: "처음에는...", "나중에 알게 된 건...", "그때 깨달은 게..." 등 자연스러운 시간 흐름
- **감정 표현**: "짜증났어요", "깜짝 놀랐어요", "정말 도움이 됐어요" 등 구체적 감정 표현
- **흥미로운 표현**: "아무도 안 알려주는", "비밀스러운", "숨겨진" 등 흥미로운 표현 사용
- **감탄 표현**: "이거 진짜?", "믿기지 않지만", "놀랍게도" 등 자연스러운 감탄 표현
- **공감대 형성**: "여러분도 그럴 거예요", "공감하시죠?" 등 독자와의 소통
- **친근한 구어체**: 자연스러운 구어체와 친근한 말투 사용

[🔥 필수 시각적 요소 - 반드시 포함]
**⚠️ 다음 요소들은 무조건 포함해야 합니다. 누락 시 콘텐츠 거부됩니다:**

📊 **표(Table) - 필수 1개 이상**:
- 주제에 맞는 비교표, 정보표, 체크리스트 표 중 하나 이상 반드시 포함
- <table class="comparison-table"> 형식 사용
- 예: 가격 비교, 장단점 비교, 특징 비교, 옵션 비교 등
- 표 제목과 명확한 열/행 구분 필수
- 키워드와 관련된 실용적인 데이터 제공

🎯 **CTA 배너(Call to Action) - 필수 1개 이상**:
- 마지막 섹션에 반드시 CTA 배너 포함
- <div class="cta-section"> 형식 사용
- <a class="cta-button" href="#"> 형식의 버튼 포함
- 독자가 다음 행동을 취하도록 유도하는 명확한 문구
- 예: "지금 바로 확인하기", "무료로 시작하기", "더 알아보기"

📈 **데이터 박스 - 권장 1개 이상**:
- 핵심 정보나 통계를 강조하는 데이터 박스 포함
- <div class="data-box"> 형식 사용
- 주요 수치, 핵심 포인트, 요약 정보 등

✨ **하이라이트 박스 - 권장**:
- 중요한 팁이나 주의사항을 강조
- <div class="highlight"> 또는 <div class="warning"> 또는 <div class="success"> 형식 사용

[절대 금지사항]
- **Q&A 형식 사용 금지**: 질문과 답변 형식은 절대 사용하지 않음
- **템플릿식 구조 금지**: 표준적이거나 뻔한 구조 사용 금지
- **중복된 내용 금지**: 같은 내용을 반복하거나 유사한 표현 사용 금지
- **일반적인 표현 금지**: "몇 가지 핵심 주의사항이 있어요" 등 뻔한 표현 사용 금지
- **동일한 답변 금지**: 다른 주제라도 같은 답변을 제공하는 것 절대 금지
- **추측성 표현 금지**: "~일 것 같습니다", "~라고 합니다" 등 불확실한 표현 금지
- **검증되지 않은 데이터 금지**: 확실하지 않은 통계나 수치 사용 금지
- **AI/로봇 느낌 금지**: "분석 결과", "데이터에 따르면", "알고리즘" 등 AI 같은 표현 절대 금지
- **기계적 표현 금지**: "시스템", "프로세스", "절차" 등 기계적인 표현 사용 금지
- **공식적 표현 금지**: "권장사항", "주의사항", "요구사항" 등 공식적인 표현 사용 금지
- **시각적 장식 금지**: 파란색 점(•), 괄호({, [, }, ]), 특수 기호(▶, ►, ▸), HTML 엔티티(&#숫자;) 등 모든 시각적 장식 요소 절대 금지
- **인라인 스타일 금지**: style="..." 속성 직접 사용 금지. 정의된 CSS 클래스(.highlight, .data-box, .warning 등)만 사용
- **목록 장식 금지**: 번호가 매겨진 목록 앞의 장식적 요소나 아이콘 사용 금지

[출력 형식]
⚠️ CSS(<style> 태그)는 절대 포함하지 마세요. CSS는 시스템이 별도로 적용합니다.
인라인 style 속성도 사용하지 마세요. 클래스 기반 시맨틱 HTML만 출력하세요.
아래 구조를 따르세요:

<div class="bgpt-content"><div class="gradient-frame"><div class="white-paper">
${sectionsHtml}

  ${TAG_UL}
</div></div></div>
`.trim();
}
