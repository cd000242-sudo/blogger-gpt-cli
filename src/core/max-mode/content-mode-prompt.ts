// src/core/max-mode/content-mode-prompt.ts
// 콘텐츠 모드별 프롬프트 생성 함수

import type { MaxModeSection } from './types-interfaces';
import { UPDATED_CONTENT_MODE_CONFIGS } from './mode-sections-extended';
import { getToneInstruction } from './tone-text-utils';

// 콘텐츠 모드별 프롬프트 생성 함수
export function buildContentModePrompt(
  _topic: string,
  section: MaxModeSection,
  subtopic: string,
  _mode: string = 'external',
  manualCta?: { url: string; text: string; hook?: string },
  platform?: string,
  toneStyle?: string,
  timestamp?: number,
  randomSeed?: number,
  trendKeywords?: string[],
  authorInfo?: { name: string; title?: string; credentials?: string }
): string {
  const modeConfig = UPDATED_CONTENT_MODE_CONFIGS[_mode] || UPDATED_CONTENT_MODE_CONFIGS['external']!;

  // 🔧 네이버 데이터랩 트렌드 키워드 반영
  const trendKeywordsInfo = trendKeywords && trendKeywords.length > 0
    ? `\n\n【네이버 데이터랩 트렌드 키워드 (최근 30일 검색량 기반)】\n${trendKeywords.slice(0, 8).join(', ')}\n\n⚠️ **중요**: 위 트렌드 키워드들을 본문에 자연스럽게 포함하여 최신 검색 트렌드를 반영하세요.\n✅ **필수**: 트렌드 키워드를 강제로 넣지 말고, 문맥에 맞게 자연스럽게 포함하세요.`
    : '';
  const isWordPress = platform === 'wordpress';

  // 🔧 같은 키워드로도 매번 다른 내용이 나오도록 타임스탬프와 랜덤 시드 추가
  const contentTimestamp = timestamp || Date.now();
  const contentRandomSeed = randomSeed || Math.floor(Math.random() * 10000);
  const uniqueContentId = `${contentTimestamp}-${contentRandomSeed}`;

  // 🔧 연도 주입 — "년 기준" 같이 연도 없는 어색한 표현을 막기 위해 프롬프트에 명시
  const currentYear = new Date().getFullYear();

  let basePrompt = `⚠️ **매우 중요 - 콘텐츠 고유성 보장**:
- 같은 주제와 키워드로도 매번 완전히 다른 내용을 작성해야 합니다!
- 이전에 작성한 내용과 유사하거나 동일한 내용을 작성하지 마세요!
- 현재 시간(${uniqueContentId})을 고려하여 매번 새로운 관점과 접근 방식으로 작성하세요!
- 크롤링된 데이터를 참고하되, 완전히 다른 표현, 구조, 관점으로 재작성하세요!
- 문장 구조, 어휘 선택, 예시, 사례를 모두 다르게 작성하세요!

 **콘텐츠 모드**: ${modeConfig.name}
📝 **모드 설명**: ${modeConfig.description}
🎨 **톤앤매너**: ${modeConfig.tone}
${toneStyle ? getToneInstruction(toneStyle) : ''}

📌 **섹션**: ${section.title}
 **소제목**: ${subtopic}${trendKeywordsInfo}
👤 **역할**: ${section.role}
📊 **목표 글자수**: ${section.minChars}자 (±20% 허용 — 정보의 깊이가 최우선, 억지로 맞추지 마세요)
${section.crawledData ? `

🔍 **크롤링 데이터 분석 결과 (쇼핑 모드용 실제 사용자 데이터)**:
📈 **총 분석 콘텐츠 수**: ${section.crawledData.totalContents || 0}개
🏷️ **추출된 주요 키워드**: ${section.crawledData.keywords ? section.crawledData.keywords.slice(0, 15).join(', ') : '없음'}
📊 **주요 주제**: ${section.crawledData.mainTopics ? section.crawledData.mainTopics.slice(0, 8).join(', ') : '없음'}
😊 **전체 감정 분석**: ${section.crawledData.sentiment || 'neutral'}
📋 **콘텐츠 요약**: ${section.crawledData.summary || '분석 실패'}

📝 **실제 크롤링된 콘텐츠 샘플**:
${section.crawledData.contents ? section.crawledData.contents.slice(0, 5).map((content, i) =>
    `${i + 1}. [${content.type?.toUpperCase()}] ${content.title}\n   내용: ${content.content.substring(0, 200)}...\n   출처: ${content.url}`
  ).join('\n\n') : '크롤링 데이터 없음'}

⚠️ **중요**: 위 크롤링 데이터를 기반으로 실제 사용자 경험과 리뷰를 반영하여 콘텐츠를 작성하세요!
✅ **필수**: 크롤링 데이터의 실제 가격, 스펙, 사용자 의견을 활용하여 신뢰성을 높이세요!
` : ''}

⚠️ **핵심 원칙 - 글의 질이 최우선**:
- 글자수보다 정보의 깊이와 명확성이 우선입니다 (목표 ${section.minChars}자 ±20%)
- 구체적인 사례, 예시, 팁, 주의사항, 통계, 비교 정보를 포함하여 내용을 풍부하게 만드세요
- 글자수만 맞추려고 같은 내용 반복, 의미 없는 문장 늘리기, "~입니다/~합니다" 기계적 표현 사용 지양
- 한 번의 진실한 문단이 열 번의 채움 문단보다 가치 있습니다

 **콘텐츠 포커스**: ${section.contentFocus}
${authorInfo?.name && _mode === 'adsense' ? `
👤 **사용자 지정 저자 정보 (E-E-A-T)** — 입력된 항목만 사용, 비어있는 항목은 본문에 등장 금지:
- 이름: ${authorInfo.name}
${authorInfo.title && authorInfo.title.trim() ? `- 직함/전문 분야: ${authorInfo.title}` : '- 직함/전문 분야: (입력 안 됨 — 직함/전문 분야를 본문에 절대 언급하지 마세요)'}
${authorInfo.credentials && authorInfo.credentials.trim() ? `- 자격/경력: ${authorInfo.credentials}` : '- 자격/경력: (입력 안 됨 — 자격증·경력·근무처를 만들어내지 마세요)'}
⚠️ 위 입력된 정보 범위 내에서만 일관된 페르소나를 유지하세요.
⚠️ 작성자 소개 섹션에서 HTML <img> 태그·프로필 사진·아바타를 절대 생성하지 마세요 (텍스트만).
` : ''}
⚠️ **AI 감지 방지 - 자연스러운 인간의 글쓰기 (신뢰성 유지)**:
🚨 **핵심 목표**: 독자가 "이건 진짜 사람이 쓴 글이구나"라고 느끼면서도, 동시에 "신뢰할 수 있는 정보구나"라고 확신할 수 있어야 합니다.

⚠️ **중요 원칙 - 신뢰성 최우선**:
- ❌ **절대 금지**: 실제로 경험하지 않은 일을 지어내거나 허위 경험담을 만드는 것
- ❌ **절대 금지**: 객관적 정보가 필요한 주제에서 억지로 개인 경험담을 끼워넣는 것
- ✅ **필수**: 주제에 맞는 자연스러운 표현만 사용 (정보공유글은 객관적, 경험담이 적절한 주제는 자연스럽게 포함)
- ✅ **필수**: 가독성과 신뢰성을 해치지 않는 선에서 자연스러운 말투 사용

❌ **절대 금지 - AI 느낌 나는 표현들**:
- "~입니다", "~합니다", "~되며", "~됩니다" 같은 기계적 존댓말 반복
- "또한", "그리고", "또한" 같은 반복적 접속사 남용
- "~할 수 있습니다", "~가능합니다" 같은 형식적 표현
- "~라고 할 수 있습니다", "~것으로 보입니다" 같은 불확실한 표현
- "~에 대해", "~에 관하여" 같은 과도한 격 조사
- "~것", "~것" 같은 추상적 명사 반복
- "~수 있습니다" 같은 가능 표현 반복
- 완벽하게 정돈된 문장만 나열 (기계적 느낌)

✅ **필수 - 실제 사람처럼 쓰기 (크롤링 최신 데이터 기반 깊이 있는 정보)**:

1. **주제에 맞는 적절한 표현 사용**:
   - **정보공유/객관적 정보 글**: 경험담을 억지로 만들지 말고, 객관적 정보를 자연스러운 말투로 전달
     예: "이 방법은 많은 분들이 효과를 봤다고 하더라구요" (억지 경험담 대신)
   - **경험담이 적절한 주제**: 실제 경험이 있다면 자연스럽게 포함, 없다면 억지로 만들지 않기
     예: "제가 직접 해봤는데요" (실제 경험이 있을 때만)
   - **절대 금지**: 없는 경험을 지어내거나 허위 정보를 만드는 것

2. **자연스러운 말투와 표현 (주제에 맞게)**:
   - "~했어요", "~더라구요", "~거든요", "~더라고요", "~인데요" (억지로 넣지 말고 자연스럽게)
   - "~하긴 하는데", "~하긴 해요" (필요할 때만)
   - "~인 것 같아요", "~일 수도 있어요" (불확실할 때만, 객관적 정보는 확실하게)
   - "~인데", "~그런데", "~하지만", "~근데" 같은 자연스러운 전환

3. **문장 길이와 구조 다양화 (기계적 패턴 금지)**:
   - 짧은 문장 + 긴 문장 혼합
   - 주어-서술어, 도치, 접속 등 다양한 구조
   - 때로는 한 문장으로, 때로는 여러 문장으로
   - **중요**: 정보공유글도 자연스러운 문장 구조로 작성 (기계적 나열 금지)

4. **독자와의 자연스러운 소통 (과하지 않게)**:
   - "아시나요?", "생각해보세요", "참고하시면" (적절히 사용)
   - "이런 분들 계실 거예요" (필요할 때만)
   - "궁금하시죠?" (과도하게 반복하지 않기)

5. **솔직하고 신뢰할 수 있는 표현**:
   - "확실하지 않은 부분은 확인이 필요해요" (불확실한 정보는 솔직하게)
   - "이건 개인차가 있을 수 있어요" (적절할 때만)
   - "제가 직접 확인한 정보는 아니지만, 공식 자료에 따르면..." (출처 명시)

6. **가독성 최우선**:
   - 명확하고 이해하기 쉬운 문장
   - 불필요한 장식적 표현 최소화
   - 핵심 정보가 명확하게 전달되도록

💡 **최종 체크**: 
- 글을 읽었을 때 "자연스럽고 신뢰할 수 있는 정보구나"라는 느낌이 들어야 합니다
- AI가 만든 것 같으면 안 되지만, 억지로 경험담을 만들어내서 신뢰성을 해치면 안 됩니다
- 주제가 객관적 정보를 요구하면 객관적으로, 경험담이 적절하면 자연스럽게 포함
- **가독성과 신뢰성이 최우선입니다**

🎯 **독자가 이 글을 꼭 읽어야 하는 이유 만들기**:
- ✅ **정보의 깊이**: 크롤링한 최신 데이터로 다른 글보다 더 깊고 정확한 정보 제공
- ✅ **최신성**: ${currentYear}년 기준 최신 정보, 최근 변경사항 반영
- ⚠️ **연도 표기 규칙**: "년" 앞에는 반드시 4자리 숫자가 와야 합니다. "년 기준", "올해 년" 처럼 숫자 없이 "년"만 쓰는 것은 절대 금지. 반드시 "${currentYear}년" 형태로 작성하세요.
- ✅ **실용성**: 바로 적용 가능한 구체적 방법, 단계별 가이드
- ✅ **차별성**: 다른 글에 없는 독특한 관점, 전문가 인사이트, 실제 사례
- ✅ **문제 해결**: 독자의 실제 고민을 해결해주는 솔루션 제공
- ✅ **공감과 신뢰**: 독자 입장에서 이해하기 쉽게, 신뢰할 수 있는 출처 명시
- 💡 **중요**: 독자가 "아, 이 글 읽기 잘했다!" 라고 생각하게 만드세요

 **필수 요소**:
${section.requiredElements.map(element => `- ${element}`).join('\n')}`;

  // 모드별 특별 지침 추가
  if (_mode === 'spiderwebbing') {
    basePrompt += `

🕸️🕸️🕸️ **거미줄치기 끝판왕 모드 - 콘텐츠 네트워크 극대화 시스템** 🕸️🕸️🕸️

【최종 목표: 독자가 한 글에서 시작해 10개 글을 읽게 만들기 + 체류시간 10배 증가】

🎯 **10년 경력 콘텐츠 전략가 + 내부 링크 최적화 전문가 페르소나**

🔥 **거미줄치기 핵심 3대 원칙**:
1. **독립성 + 연결성** - 각 글은 홀로 서되, 함께 읽으면 시너지 폭발
2. **학습 플로우** - 초급→중급→고급 자연스러운 여정 설계
3. **내부 PageRank** - 검색 엔진이 사이트 구조를 완벽히 이해하도록

🌐 **STEP 1: 콘텐츠 클러스터 전략** 🌐

**📊 클러스터 구조 설계**:
✅ **필라 콘텐츠 (중심축)**:
   - 주제의 전체 개요를 다루는 종합 가이드
   - 모든 하위 글로 연결되는 허브 역할
   - 최소 5,000자 이상의 심층 콘텐츠
   - "완벽 가이드", "종합 정리", "A to Z" 형식

✅ **클러스터 콘텐츠 (가지)**:
   - 필라 콘텐츠의 각 섹션을 심화한 개별 글
   - 난이도별 분류: 초급 / 중급 / 고급
   - 목적별 분류: 이론 / 실전 / 사례
   - 관점별 분류: 초보자 / 전문가 / 비즈니스

✅ **연결 콘텐츠 (거미줄)**:
   - 클러스터 간 횡적 연결
   - "A vs B 비교", "A를 위한 B 활용법"
   - 독자의 다양한 진입점 제공

🔗 **STEP 2: 내부 링크 최적화 전략** 🔗

**✅ 앵커 텍스트 전략 (SEO 극대화)**:
❌ 금지: "자세히 보기", "더 알아보기", "클릭"
✅ 권장: "OO 심층 분석 가이드", "OO 실전 활용법 완벽 정리"
✅ 권장: "초보자를 위한 OO 단계별 가이드"
✅ 권장: "OO vs XX 비교 분석 (${currentYear}년 최신)"

**📍 링크 배치 전략**:
✅ **도입부 링크 (10% 지점)**:
   - "이 글을 읽기 전 [기초 개념 정리]를 먼저 보시면 이해가 쉬워요"
   - 독자의 배경 지식 확인 + 필요 시 기초 글로 유도

✅ **본문 중간 링크 (30%, 50%, 70% 지점)**:
   - "이 부분이 궁금하시다면 [심화 가이드]를 참고하세요"
   - "실전 예시는 [사례 연구]에서 자세히 다뤘어요"
   - "다른 방법도 궁금하시다면 [대안 전략]을 확인하세요"

✅ **마무리 링크 (90% 지점)**:
   - "다음 단계: [중급 가이드]로 넘어가볼까요?"
   - "이 주제와 관련된 [추가 팁 모음]도 확인해보세요"
   - "실전 적용이 궁금하다면 [케이스 스터디]를 읽어보세요"

**🔄 양방향 연결 전략**:
✅ **필수 규칙**:
   - A 글에서 B 글로 링크 → B 글에서도 A 글로 링크
   - "이전 글에서 다룬 [기초 개념]을 바탕으로..."
   - "이 내용의 심화 버전은 [고급 가이드]에서..."

🎓 **STEP 3: 학습 플로우 설계** 🎓

**📚 단계별 학습 경로**:
✅ **초급 단계 (1-3편)**:
   - 기본 개념 이해
   - 용어 정리
   - 간단한 예시
   - 다음 단계: "기초를 다졌다면 [실전 가이드]로!"

✅ **중급 단계 (4-7편)**:
   - 실전 적용 방법
   - 구체적 사례
   - 주의사항 및 팁
   - 다음 단계: "이제 [고급 전략]을 배워볼까요?"

✅ **고급 단계 (8-10편)**:
   - 심화 전략
   - 전문가 인사이트
   - 최적화 기법
   - 다음 단계: "마스터하셨다면 [케이스 스터디]로!"

**🎯 진입점 다양화**:
✅ **초보자 진입점**:
   - "OO가 처음이신가요? [기초 가이드]부터 시작하세요"
   - 쉬운 용어, 친절한 설명, 단계별 안내

✅ **중급자 진입점**:
   - "기초는 아시죠? 바로 [실전 활용법]으로!"
   - 구체적 사례, 실무 팁, 최적화 전략

✅ **전문가 진입점**:
   - "전문가를 위한 [고급 전략]과 [최신 트렌드]"
   - 심화 이론, 최신 연구, 전문가 인사이트

📊 **STEP 4: 단일 글 완결성** 📊

**✅ 이 글은 독립적으로 완결되어야 합니다**:
- "시리즈 N편", "이전 글", "다음 글" 같은 외부 글 참조 절대 금지 (존재하지 않는 글 언급 = 신뢰도 손상)
- 글 안에서 "1편/2편" 같은 번호 표기 금지 (H2 번호와 충돌)
- 독자가 이 글 하나만 읽어도 핵심 가치를 얻을 수 있어야 함

🚀 **STEP 5: SEO + UX 동시 최적화** 🚀

**🔍 내부 PageRank 극대화**:
✅ **링크 구조 최적화**:
   - 필라 콘텐츠 → 모든 클러스터 글 (1:N 연결)
   - 클러스터 글 → 필라 콘텐츠 (N:1 역연결)
   - 클러스터 글 ↔ 클러스터 글 (N:N 횡적 연결)
   - 검색 엔진이 사이트 구조를 완벽히 이해

✅ **체류시간 증가 전략**:
   - 평균 체류시간 목표: 5분 이상
   - 페이지뷰 목표: 세션당 3페이지 이상
   - 이탈률 목표: 30% 이하
   - 재방문율 목표: 50% 이상

✅ **전환율 상승 전략**:
   - 단계적 심화로 신뢰 구축
   - 시리즈 완독 시 CTA 제시
   - 이메일 구독 유도 (다음 편 알림)
   - 프리미엄 콘텐츠 전환

💡 **STEP 6: 독자 여정 최적화** 💡

**✅ 분기점 제공**:
🔀 여기서 두 가지 선택이 가능해요:
   1️⃣ 이론을 더 깊이 파고들고 싶다면 → [심화 이론 가이드]
   2️⃣ 바로 실전에 적용하고 싶다면 → [실전 활용 가이드]

**✅ 컨텍스트 제공**:
💡 이 링크를 왜 읽어야 하나요?
   - [고급 전략 가이드]에서는 이 개념을 실무에 적용하는 10가지 방법을 다룹니다
   - 이 글만 읽어도 되지만, 함께 읽으면 이해도가 3배 높아져요
   - 예상 독서 시간: 5분

**✅ 완료 목표 설정**:
🎯 시리즈 완독 시 얻을 수 있는 것:
   ✅ OO 분야 전문가 수준의 지식
   ✅ 실무에 바로 적용 가능한 10가지 전략
   ✅ 종합 체크리스트 + 실전 템플릿
   ✅ 커뮤니티 멤버십 (선착순 100명)

🎯 **최종 품질 검증 체크리스트** 🎯

**✅ 필수 확인 사항**:
□ 이 글만 읽어도 가치가 있는가?
□ 다른 글과 연결되어 시너지가 나는가?
□ 내부 링크가 3개 이상 포함되었는가?
□ 앵커 텍스트가 구체적이고 SEO 최적화되었는가?
□ 링크 전에 컨텍스트를 제공했는가?
□ 양방향 연결이 설계되었는가?
□ 현재 위치가 명확히 표시되었는가?
□ 다음 단계가 명확히 안내되었는가?
□ 진입점이 다양하게 제공되었는가?
□ 학습 플로우가 자연스러운가?

**📈 성과 목표**:
- 평균 체류시간: 5분 이상
- 페이지뷰/세션: 3페이지 이상
- 이탈률: 30% 이하
- 재방문율: 50% 이상
- 시리즈 완독률: 30% 이상

**🏆 최종 목표: 독자가 10개 글을 읽게 만들기 + 체류시간 10배 증가! 🏆**
`;
  } else if (_mode === 'adsense') {
    basePrompt += `

🏆🏆🏆 **애드센스 승인 끝판왕 모드 - 구글 심사 100% 통과 시스템** 🏆🏆🏆

【최종 목표: 애드센스 심사 한 번에 통과 + E-E-A-T 만점 달성】

🎯 **10년 경력 애드센스 전문가 + E-E-A-T 마스터 페르소나**

🔥 **애드센스 승인 핵심 4대 원칙**:
1. **E-E-A-T 완벽 구현** - Experience + Expertise + Authoritativeness + Trustworthiness
2. **독창성 100%** - 복사/표절 0%, 완전히 새로운 콘텐츠
3. **가치 제공** - 독자에게 실질적 도움이 되는 정보
4. **정책 준수** - 구글 정책 100% 준수, 위반 요소 0%

📚 **STEP 1: E-E-A-T 완벽 구현 전략** 📚

**✅ E - Experience (경험)**:
🎯 **실제 경험 증명**:
   - "제가 5년간 이 분야에서 일하면서..."
   - "직접 100개 이상의 사례를 분석한 결과..."
   - "2020년부터 ${currentYear}년까지 추적한 데이터에 따르면..."
   - 구체적 날짜, 장소, 상황 명시
   - 성공 사례 + 실패 사례 모두 공유

🎯 **경험 표현 방식**:
   - ❌ 금지: "일반적으로 ~합니다"
   - ✅ 권장: "제가 직접 해봤을 때는 ~했어요"
   - ✅ 권장: "2023년 3월에 시도했을 때..."
   - ✅ 권장: "100명의 사용자를 대상으로 테스트한 결과..."

**✅ E - Expertise (전문성)**:
🎯 **전문 지식 증명**:
   - 해당 분야 최소 3년 이상 경력 암시
   - 전문 용어를 적절히 사용하되 설명 추가
   - 최신 트렌드와 연구 결과 인용
   - 업계 표준과 베스트 프랙티스 제시
   - 경쟁자 분석 및 비교

🎯 **전문성 표현 방식**:
   - "이 분야 전문가로서 5년간..."
   - "업계 표준에 따르면..."
   - "최신 연구(${currentYear}년)에서는..."
   - "전문가들 사이에서는..."

**✅ A - Authoritativeness (권위성)**:
🎯 **권위 구축**:
   - 검증된 출처 인용 (공식 사이트, 정부 기관, 학술 논문)
   - 통계 데이터 제시 (출처 명시)
   - 전문가 의견 인용
   - 업계 인정 사례
   - 수상 경력 또는 인증 (있는 경우)

🎯 **권위 표현 방식**:
   - "한국소비자원 자료에 따르면..."
   - "식품의약품안전처 공식 발표에서..."
   - "${currentYear}년 OO 학회 연구 결과..."
   - "업계 1위 기업의 공식 가이드라인..."

**✅ T - Trustworthiness (신뢰성)**:
🎯 **신뢰 구축**:
   - 100% 검증된 정보만 사용
   - 불확실한 정보는 명시 ("확인 필요", "추가 검증 필요")
   - 편견 없는 객관적 시각
   - 장점 + 단점 모두 솔직하게 언급
   - 독자 안전과 이익 최우선

🎯 **신뢰 표현 방식**:
   - "확인된 정보에 따르면..."
   - "공식 자료를 확인한 결과..."
   - "이 부분은 아직 확실하지 않아 추가 확인이 필요해요"
   - "개인적 의견이지만..."

🚀 **STEP 2: 독창성 100% 보장 전략** 🚀

**❌ 절대 금지 사항**:
- 다른 글 복사/표절 (단 한 문장도 안 됨)
- 일반적인 정보만 나열 (차별화 0%)
- AI 생성 티 나는 기계적 표현
- 추측이나 가정으로 정보 채우기
- 검증되지 않은 통계나 수치
- 저작권 침해 가능성 있는 내용

**✅ 필수 포함 요소**:
□ 완전히 새로운 관점과 접근법
□ 다른 글에 없는 독특한 인사이트
□ 실제 경험 기반 구체적 사례
□ 검증된 데이터와 통계 (출처 명시)
□ Before & After 비교 (구체적 수치)
□ 실패 사례 + 해결 방법
□ FAQ 섹션 (최소 5개 질문)
□ 체크리스트 또는 단계별 가이드
□ 주의사항 및 경고
□ 최신 정보 (${currentYear}년 기준)

💡 **STEP 3: 가치 제공 극대화 전략** 💡

**✅ 실질적 도움 제공**:
🎯 **문제 해결 중심**:
   - 독자의 실제 고민 파악
   - 구체적 해결책 제시
   - 단계별 실행 가이드
   - 예상 결과 및 소요 시간
   - 대안 방법도 함께 제시

🎯 **실용성 극대화**:
   - 바로 적용 가능한 팁
   - 구체적 수치와 기준
   - 체크리스트 제공
   - 템플릿 또는 양식 제공
   - 주의사항 및 함정 경고

**✅ 콘텐츠 구조 최적화**:
1. 도입부 (10%): 독자 고민 공감 + 이 글의 가치 제시
2. 본문 (70%): 
   - 기본 개념 설명 (20%)
   - 실전 적용 방법 (30%)
   - 사례 및 예시 (20%)
3. FAQ (10%): 자주 묻는 질문 5개 이상
4. 마무리 (10%): 핵심 요약 + 행동 유도

🛡️ **STEP 4: 구글 정책 100% 준수** 🛡️

**❌ 절대 금지 콘텐츠**:
- 성인/폭력/혐오 콘텐츠
- 저작권 침해 콘텐츠
- 불법/위험 콘텐츠
- 오해의 소지가 있는 정보
- 과장 광고 또는 허위 정보
- 클릭베이트 제목
- 스팸성 콘텐츠

**✅ 권장 콘텐츠**:
- 교육적 가치가 높은 콘텐츠
- 실용적이고 유용한 정보
- 검증된 사실 기반 콘텐츠
- 독자 안전을 고려한 콘텐츠
- 객관적이고 중립적인 시각
- 출처가 명확한 정보
- 최신 정보 (${currentYear}년 기준)

📊 **STEP 5: 글자수 및 체류시간 최적화** 📊

**✅ 목표 지표**:
- 글자수: 6,300 ~ 7,500자 (공백 제외)
- 체류시간: 4 ~ 5분
- 가독성: 중학생도 이해 가능
- 정보 밀도: 높음 (물 타기 금지)
- 독창성: 100% (복사 0%)

**✅ 글자수 채우기 전략** (억지로 늘리기 금지!):
□ 구체적 사례 3개 이상 추가
□ Before & After 비교
□ 단계별 가이드 상세화
□ FAQ 섹션 확장 (5~10개)
□ 주의사항 및 팁 추가
□ 경쟁 제품/서비스 비교
□ 최신 트렌드 분석
□ 전문가 의견 인용
□ 통계 데이터 추가 (출처 명시)
□ 실패 사례 + 해결 방법

🎯 **최종 품질 검증 체크리스트** 🎯

**✅ E-E-A-T 체크**:
□ 실제 경험이 구체적으로 드러나는가?
□ 전문 지식이 충분히 드러나는가?
□ 권위 있는 출처를 인용했는가?
□ 신뢰할 수 있는 정보인가?

**✅ 독창성 체크**:
□ 다른 글과 1%도 유사하지 않은가?
□ 완전히 새로운 관점을 제시하는가?
□ 독특한 인사이트가 있는가?
□ 복사/표절이 전혀 없는가?

**✅ 가치 체크**:
□ 독자에게 실질적 도움이 되는가?
□ 바로 적용 가능한 정보인가?
□ 구체적이고 명확한가?
□ 문제를 해결해주는가?

**✅ 정책 체크**:
□ 구글 정책을 100% 준수하는가?
□ 위반 요소가 전혀 없는가?
□ 독자 안전을 고려했는가?
□ 객관적이고 중립적인가?

**✅ 기술 체크**:
□ 글자수 6,300~7,500자인가?
□ 체류시간 4~5분 예상되는가?
□ 가독성이 높은가?
□ 정보 밀도가 높은가?

**🏆 최종 목표: 애드센스 심사 한 번에 통과 + E-E-A-T 만점 달성! 🏆**

**📈 승인 확률 극대화 공식**:
E-E-A-T 만점 (40점) + 독창성 100% (30점) + 가치 제공 (20점) + 정책 준수 (10점) = 승인 100%`;
  } else if (_mode === 'shopping') {
    basePrompt += `

🛍️🛍️🛍️ **쇼핑 구매유도 끝판왕 모드 — 7단계 구매 퍼널 + 전용 스킨** 🛍️🛍️🛍️

【최종 목표: 독자가 "이거 안 사면 바보" 생각하게 만들기 + 검색 1위 동시 달성】

📊 **10년 경력 쇼핑몰 MD + 블로그 고수 + SEO 전문가 페르소나**

🎯 **쇼핑 모드 핵심 3대 원칙**:
1. **크롤링 데이터 = 신뢰의 증거** — 실제 사용자 리뷰와 제품 정보만 사용
2. **자연스러운 경험담 = 공감의 힘** — AI 티 완전 제거, 블로그 고수 느낌 극대화
3. **구매 심리 자극 = 전환의 기술** — FOMO + 사회적 증거 + 장단점 솔직 비교

🎨 **쇼핑 전용 컬러 팔레트** (반드시 아래 색상 사용!):
- 🟠 Primary: #FF6B35 (구매 유도 오렌지)
- 🟢 Secondary: #2EC4B6 (신뢰 민트)
- 🔴 Accent: #E71D36 (할인/긴급 레드)
- 🟡 Warm BG: #FFF8F0 (따뜻한 베이지 배경)
- ⚫ Text: #1a1a2e (짙은 네이비 텍스트)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 **필수 시각 컴포넌트 1: 제품 스펙 카드** (2번 섹션에서 사용)

${platform === 'wordpress' ? '<!-- wp:html -->' : ''}
<div style="margin:30px 0; padding:0; border-radius:16px; overflow:hidden; box-shadow:0 8px 30px rgba(255,107,53,0.15); border:2px solid #FF6B35;">
  <div style="background:linear-gradient(135deg, #FF6B35 0%, #ff8c42 100%); padding:20px 25px; color:white;">
    <div style="font-size:13px; font-weight:600; opacity:0.9; margin-bottom:4px;">PRODUCT SPEC</div>
    <div style="font-size:22px; font-weight:900; letter-spacing:-0.5px;">📦 제품명 — 핵심 한 줄 설명</div>
  </div>
  <div style="padding:25px; background:#FFF8F0;">
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
      <div style="padding:14px; background:white; border-radius:10px; border-left:4px solid #FF6B35; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        <div style="font-size:12px; color:#888; font-weight:600;">브랜드</div>
        <div style="font-size:16px; color:#1a1a2e; font-weight:800; margin-top:4px;">브랜드명</div>
      </div>
      <div style="padding:14px; background:white; border-radius:10px; border-left:4px solid #2EC4B6; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        <div style="font-size:12px; color:#888; font-weight:600;">가격</div>
        <div style="font-size:16px; color:#E71D36; font-weight:800; margin-top:4px;">₩00,000</div>
      </div>
      <div style="padding:14px; background:white; border-radius:10px; border-left:4px solid #FF6B35; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        <div style="font-size:12px; color:#888; font-weight:600;">스펙 1</div>
        <div style="font-size:16px; color:#1a1a2e; font-weight:800; margin-top:4px;">수치/값</div>
      </div>
      <div style="padding:14px; background:white; border-radius:10px; border-left:4px solid #2EC4B6; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        <div style="font-size:12px; color:#888; font-weight:600;">스펙 2</div>
        <div style="font-size:16px; color:#1a1a2e; font-weight:800; margin-top:4px;">수치/값</div>
      </div>
    </div>
  </div>
</div>
${platform === 'wordpress' ? '<!-- /wp:html -->' : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅❌ **필수 시각 컴포넌트 2: 장단점 비교 TABLE** (3번 섹션에서 사용 — ⚠️ 가장 중요!)

${platform === 'wordpress' ? '<!-- wp:html -->' : ''}
<table style="width:100%; border-collapse:separate; border-spacing:0; margin:30px 0; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08);">
  <thead>
    <tr>
      <th style="background:linear-gradient(135deg, #2EC4B6 0%, #26a69a 100%); color:white; padding:16px 20px; font-size:17px; font-weight:800; text-align:center; width:50%;">✅ 장점</th>
      <th style="background:linear-gradient(135deg, #FF6B35 0%, #e65100 100%); color:white; padding:16px 20px; font-size:17px; font-weight:800; text-align:center; width:50%;">⚠️ 단점</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:14px 20px; background:#e8f5e9; border-bottom:1px solid #c8e6c9; font-size:15px; color:#2e7d32; vertical-align:top;">✅ 장점 내용 1</td>
      <td style="padding:14px 20px; background:#fff3e0; border-bottom:1px solid #ffe0b2; font-size:15px; color:#e65100; vertical-align:top;">⚠️ 단점 내용 1</td>
    </tr>
    <tr>
      <td style="padding:14px 20px; background:#e8f5e9; border-bottom:1px solid #c8e6c9; font-size:15px; color:#2e7d32; vertical-align:top;">✅ 장점 내용 2</td>
      <td style="padding:14px 20px; background:#fff3e0; border-bottom:1px solid #ffe0b2; font-size:15px; color:#e65100; vertical-align:top;">⚠️ 단점 내용 2</td>
    </tr>
    <tr>
      <td style="padding:14px 20px; background:#e8f5e9; font-size:15px; color:#2e7d32; vertical-align:top;">✅ 장점 내용 3</td>
      <td style="padding:14px 20px; background:#fff3e0; font-size:15px; color:#e65100; vertical-align:top;">⚠️ 단점 내용 3</td>
    </tr>
  </tbody>
</table>
${platform === 'wordpress' ? '<!-- /wp:html -->' : ''}

⚠️ **장단점 TABLE 필수 규칙**:
- 반드시 위 형식의 TABLE로 출력 (텍스트 나열 금지!)
- 장점 최소 3개, 단점 최소 2개 포함 (솔직한 단점이 신뢰도 ↑)
- 장점은 초록 배경(#e8f5e9), 단점은 주황 배경(#fff3e0)
- 단점은 치명적이지 않은 것 + 대안/해소 문구 포함

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⭐ **필수 시각 컴포넌트 3: 별점 + 리뷰 바** (4번 섹션에서 사용)

${platform === 'wordpress' ? '<!-- wp:html -->' : ''}
<div style="margin:30px 0; padding:25px; background:linear-gradient(135deg, #FFF8F0 0%, #fff3e0 100%); border-radius:16px; border:2px solid #FF6B35; box-shadow:0 4px 15px rgba(255,107,53,0.1);">
  <div style="text-align:center; margin-bottom:20px;">
    <div style="font-size:42px; font-weight:900; color:#FF6B35; margin-bottom:4px;">4.7</div>
    <div style="font-size:22px; margin-bottom:6px;">⭐⭐⭐⭐⭐</div>
    <div style="font-size:14px; color:#666;">1,234명이 평가했어요</div>
  </div>
  <div style="display:flex; flex-direction:column; gap:8px;">
    <div style="display:flex; align-items:center; gap:10px;">
      <span style="font-size:13px; color:#888; width:40px;">5점</span>
      <div style="flex:1; height:14px; background:#f5f5f5; border-radius:7px; overflow:hidden;"><div style="width:72%; height:100%; background:linear-gradient(90deg, #FF6B35, #ff8c42); border-radius:7px;"></div></div>
      <span style="font-size:13px; color:#888; width:35px;">72%</span>
    </div>
    <div style="display:flex; align-items:center; gap:10px;">
      <span style="font-size:13px; color:#888; width:40px;">4점</span>
      <div style="flex:1; height:14px; background:#f5f5f5; border-radius:7px; overflow:hidden;"><div style="width:18%; height:100%; background:linear-gradient(90deg, #2EC4B6, #26a69a); border-radius:7px;"></div></div>
      <span style="font-size:13px; color:#888; width:35px;">18%</span>
    </div>
  </div>
</div>
${platform === 'wordpress' ? '<!-- /wp:html -->' : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 **필수 시각 컴포넌트 4: 후기 카드** (4번 섹션에서 사용)

${platform === 'wordpress' ? '<!-- wp:html -->' : ''}
<div style="margin:20px 0; padding:22px 25px; background:white; border-radius:14px; border-left:5px solid #FF6B35; box-shadow:0 4px 16px rgba(0,0,0,0.06); position:relative;">
  <div style="position:absolute; top:14px; right:20px; font-size:32px; color:#f0f0f0; font-weight:900;">"</div>
  <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
    <div style="width:40px; height:40px; background:linear-gradient(135deg, #FF6B35, #ff8c42); border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-weight:800; font-size:16px;">김</div>
    <div>
      <div style="font-size:15px; font-weight:700; color:#1a1a2e;">김** 님</div>
      <div style="font-size:12px; color:#888;">⭐⭐⭐⭐⭐ · 구매 후 3개월</div>
    </div>
  </div>
  <p style="margin:0; font-size:15px; color:#424242; line-height:1.7; word-break:keep-all;">
    실제 후기 내용을 자연스럽게 작성...
  </p>
</div>
${platform === 'wordpress' ? '<!-- /wp:html -->' : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 **필수 시각 컴포넌트 5: 가격 비교표** (5번 섹션에서 사용)

${platform === 'wordpress' ? '<!-- wp:html -->' : ''}
<table style="width:100%; border-collapse:separate; border-spacing:0; margin:30px 0; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08);">
  <thead>
    <tr>
      <th style="background:linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color:white; padding:14px 18px; font-size:14px; font-weight:700;">구매처</th>
      <th style="background:linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color:white; padding:14px 18px; font-size:14px; font-weight:700;">정가</th>
      <th style="background:linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color:white; padding:14px 18px; font-size:14px; font-weight:700;">할인가</th>
      <th style="background:linear-gradient(135deg, #E71D36 0%, #c62828 100%); color:white; padding:14px 18px; font-size:14px; font-weight:700;">할인율</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background:#FFF8F0;">
      <td style="padding:14px 18px; font-size:15px; font-weight:700; color:#1a1a2e; border-bottom:1px solid #ffe0b2;">🏪 쿠팡</td>
      <td style="padding:14px 18px; font-size:15px; color:#888; text-decoration:line-through; border-bottom:1px solid #ffe0b2;">₩00,000</td>
      <td style="padding:14px 18px; font-size:17px; font-weight:900; color:#FF6B35; border-bottom:1px solid #ffe0b2;">₩00,000</td>
      <td style="padding:14px 18px; border-bottom:1px solid #ffe0b2;"><span style="background:#E71D36; color:white; padding:4px 10px; border-radius:20px; font-size:13px; font-weight:800;">-30%</span></td>
    </tr>
    <tr style="background:white;">
      <td style="padding:14px 18px; font-size:15px; font-weight:700; color:#1a1a2e; border-bottom:1px solid #f5f5f5;">🛒 네이버</td>
      <td style="padding:14px 18px; font-size:15px; color:#888; text-decoration:line-through; border-bottom:1px solid #f5f5f5;">₩00,000</td>
      <td style="padding:14px 18px; font-size:17px; font-weight:900; color:#FF6B35; border-bottom:1px solid #f5f5f5;">₩00,000</td>
      <td style="padding:14px 18px; border-bottom:1px solid #f5f5f5;"><span style="background:#E71D36; color:white; padding:4px 10px; border-radius:20px; font-size:13px; font-weight:800;">-25%</span></td>
    </tr>
  </tbody>
</table>
${platform === 'wordpress' ? '<!-- /wp:html -->' : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🛒 **필수 시각 컴포넌트 6: 대형 배너 CTA 버튼** (7번 마지막 섹션 — ⚠️ 특별 디자인 필수!)

${platform === 'wordpress' ? '<!-- wp:html -->' : ''}
<div style="margin:40px 0; text-align:center;">
  <div style="display:inline-block; width:100%; max-width:500px; border-radius:20px; overflow:hidden; box-shadow:0 12px 40px rgba(255,107,53,0.35); transition:transform 0.3s;">
    <div style="background:linear-gradient(135deg, #FF6B35 0%, #E71D36 50%, #ff8c42 100%); padding:28px 35px; position:relative; overflow:hidden;">
      <div style="position:absolute; top:-30px; right:-30px; width:120px; height:120px; background:rgba(255,255,255,0.1); border-radius:50%;"></div>
      <div style="position:absolute; bottom:-20px; left:-20px; width:80px; height:80px; background:rgba(255,255,255,0.08); border-radius:50%;"></div>
      <div style="position:relative; z-index:1;">
        <div style="font-size:13px; color:rgba(255,255,255,0.9); font-weight:600; margin-bottom:6px; letter-spacing:1px;">🛒 상품 정보</div>
        <div style="font-size:22px; font-weight:900; color:white; margin-bottom:8px; letter-spacing:-0.5px;">쿠팡에서 상품 정보 확인하기</div>
        <div style="font-size:14px; color:rgba(255,255,255,0.85); margin-bottom:14px;">실제 가격과 리뷰는 판매처에서 확인하세요</div>
        <div style="display:inline-block; background:white; color:#FF6B35; padding:12px 32px; border-radius:30px; font-size:16px; font-weight:800; box-shadow:0 4px 12px rgba(0,0,0,0.15);">
          상품 정보 보기
        </div>
      </div>
    </div>
  </div>
</div>
${platform === 'wordpress' ? '<!-- /wp:html -->' : ''}

⚠️ **배너 정보 카드 규칙** (AdSense 정책 준수):
- 위와 같은 정보형 배너로 출력 (구매 명령형 CTA 금지)
- 그라데이션 배경 + 둥근 버튼 + 그림자 효과는 사용 가능
- "한정 특가", "오늘만", "놓치면 후회", "지금 바로 구매" 등 긴급성/명령형 표현 사용 금지
- 대신 "상품 정보 확인", "리뷰 보기", "가격 비교" 같은 정보형 표현 사용
- 버튼에는 크롤링한 실제 판매처 링크 삽입

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔥 **크롤링 데이터 활용 전략** 🔥

✅ **제품 상세페이지 크롤링 시**:
   - 가격 정보 (정가, 할인가, 할인율) → 가격 비교표로 시각화
   - 제품 스펙 (최소 5개 이상) → 제품 스펙 카드로 제시
   - 장단점 → 장단점 비교 TABLE로 필수 출력
   - 배송 정보 → FAQ 섹션에 포함
   - 재고 상태 → 배너 CTA의 긴급성 메시지에 활용

✅ **사용자 리뷰 크롤링 시**:
   - 평점 분포 → 별점 + 리뷰 바로 시각화
   - 실제 구매자 후기 → 후기 카드 3개 이상
   - 만족도 키워드 → "95% 만족", "재구매율 1위"
   - 불만 사항 → 장단점 TABLE의 단점에 솔직하게 포함

🎭 **AI 감지 완전 차단 — 블로그 고수 페르소나** 🎭

**❌ 절대 금지 — AI 티 나는 표현**:
- "이 제품은 ~합니다" → "이거 진짜 좋더라구요"
- "~할 수 있습니다" → "~할 수 있어요" 또는 "~되더라구요"
- "완벽한", "최고의" 과도한 사용 → 구체적 표현으로 대체

**✅ 필수 — 블로그 고수 말투**:
- "제가 직접 써봤는데요, 진짜 좋더라구요"
- "처음엔 반신반의했는데 써보니까 완전 만족"
- "솔직히 이 부분은 좀 아쉬웠어요" (단점도 언급!)
- 짧은 문장 + 중간 문장 + 긴 문장 리듬 다양화

🔍 **SEO 최적화 전략**:
✅ **제목**: 핵심 키워드 + 숫자 + 후킹 (예: "OO 추천 BEST 5 (${currentYear}년 최신)")
✅ **본문**: H2 소제목에 롱테일 키워드, 첫/마지막 문단에 핵심 키워드
✅ **표/리스트**: LSI 키워드 자연스럽게 활용

🎯 **최종 품질 검증 체크리스트** 🎯

□ 장단점 비교 TABLE이 표 형식으로 포함되었는가? (텍스트 나열 금지!)
□ 대형 배너 CTA 버튼이 특별 디자인으로 포함되었는가? (단순 링크 금지!)
□ 제품 스펙 카드가 시각적으로 정리되었는가?
□ 별점 + 리뷰 바가 포함되었는가?
□ 가격 비교표에 할인율이 빨간 태그로 강조되었는가?
□ 후기 카드가 3개 이상 포함되었는가?
□ AI 티가 전혀 나지 않는 자연스러운 말투인가?
□ 크롤링 데이터 기반 실제 정보만 사용했는가?

**🏆 최종 목표: 검색 1위 + 구매 전환율 1위 동시 달성! 🏆**
`;
  } else if (_mode === 'paraphrasing') {
    basePrompt += `

🔄🔄🔄 ** 페러프레이징 끝판왕 모드 - 중복 문서 0 % 보장 시스템 ** 🔄🔄🔄

【최종 목표: 원문 유사도 0 % + 검색 순위 원문보다 높게】

🎯 ** 10년 경력 리라이팅 전문가 + SEO 최적화 마스터 페르소나 **

🔥 ** 페러프레이징 핵심 4대 원칙 **:
    1. ** 의미 보존 ** - 핵심 정보(사실, 수치, 인용)는 유지
    2. ** 표현 재구성 ** - 문장 구조와 어휘를 새롭게 풀어쓰기 (원문 단어 직접 사용 금지, trigram 유사도 40% 이하 목표)
    3. ** 가치 추가 ** - 원문에 없던 새로운 데이터/관점을 최소 1개 이상 추가 (전체 분량의 20~30% 증가)
    4. ** 단일 기준 ** - 위 2와 3은 동시에 만족해야 함. 어느 하나만 충족하면 미완성으로 간주

📋 ** STEP 1: 원문 분석 및 전략 수립 ** 📋

**✅ 필수 확인 사항 **:
□ 수동 크롤링 링크가 정확히 1개인가 ?
□ 원문의 핵심 정보를 파악했는가 ?
□ 원문의 구조를 분석했는가 ?
□ 원문의 부족한 부분을 찾았는가 ?
□ 추가할 새로운 정보를 준비했는가 ?

**🎯 원문 분석 체크리스트 **:
□ 핵심 키워드 추출(5~10개)
□ 주요 주제 파악(3~5개)
□ 정보 구조 분석(도입 - 본문 - 결론)
□ 부족한 정보 파악
□ 개선 가능한 부분 파악

🔤 ** STEP 2: 어휘 변경 전략(목표: 75 % 이상) ** 🔤

**✅ 유의어 / 동의어 활용 **:
    원문 → 변경
      - 방법 → 전략, 기법, 노하우, 비법, 접근법
        - 중요하다 → 핵심이다, 필수다, 결정적이다, 관건이다
          - 효과적 → 탁월한, 뛰어난, 강력한, 최적의
            - 사용하다 → 활용하다, 적용하다, 구사하다, 구현하다
              - 문제 → 이슈, 과제, 난제, 장애물, 걸림돌

                **✅ 표현 전환 **:
    원문 → 변경
      - "~할 수 있다" → "~가 가능하다", "~할 여지가 있다"
        - "~해야 한다" → "~가 필수다", "~가 요구된다"
          - "~이다" → "~에 해당한다", "~로 볼 수 있다"
            - "~때문에" → "~로 인해", "~덕분에", "~의 영향으로"

              **✅ 전문 용어 변경 **:
    - 일반 용어 → 전문 용어 또는 그 반대
      - 예: "최적화" → "효율화", "개선", "고도화"
        - 예: "분석" → "검토", "평가", "진단"

📝 ** STEP 3: 문장 구조 변경 전략(목표: 85 % 이상) ** 📝

**✅ 능동태 ↔ 수동태 전환 **:
    원문: "사용자가 이 기능을 활용할 수 있다"
    변경: "이 기능은 사용자에 의해 활용될 수 있다"
    또는: "이 기능의 활용이 가능하다"

      **✅ 문장 순서 변경 **:
    원문: "A를 하면 B가 된다. 그러므로 C가 중요하다."
    변경: "C가 중요한 이유는 A를 통해 B를 달성할 수 있기 때문이다."

      **✅ 문장 분할 / 결합 **:
    원문: "이 방법은 효과적이며 많은 사람들이 사용한다."
    변경: "이 방법은 효과적이다. 실제로 많은 사람들이 활용하고 있다."
    또는: "효과적이라는 이유로 많은 사람들이 이 방법을 선택한다."

      **✅ 설명 방식 전환 **:
    - 리스트 → 서술형
      - 서술형 → 리스트
        - 표 → 문단
          - 문단 → 표

➕ ** STEP 4: 새로운 내용 추가 전략(목표: 25~35 %) ** ➕

**✅ 최신 정보 추가(${currentYear}년 기준) **:
□ 최신 트렌드 분석
□ ${currentYear}년 업데이트 사항
□ 최근 연구 결과
□ 최신 통계 데이터
□ 새로운 사례 연구

      **✅ 다른 관점 추가 **:
□ 전문가 의견
□ 반대 의견(균형)
□ 다양한 시각
□ 비교 분석
□ 대안 제시

      **✅ 실용성 강화 **:
□ 구체적 예시 추가
□ 단계별 가이드
□ 체크리스트
□ 주의사항
□ 팁과 노하우

      **✅ 원문 빈틈 채우기 **:
□ 원문에서 부족한 정보
□ 독자가 궁금해할 내용
□ FAQ 추가(5개 이상)
□ Before & After 비교
□ 성공 / 실패 사례

🔄 ** STEP 5: 구조 재배치 전략 ** 🔄

**✅ 문단 순서 변경 **:
원문 순서: A → B → C → D
변경 순서: C → A → D → B(논리적 흐름 유지)

      **✅ 정보 계층 재구성 **:
    - 원문: 개요 → 세부 → 결론
      - 변경: 문제 제기 → 해결책 → 세부 설명 → 결론

        **✅ 강조점 변경 **:
    - 원문에서 부차적이던 내용을 주요 내용으로
      - 원문에서 주요하던 내용을 배경 설명으로

🎯 ** STEP 6: SEO 최적화(원문보다 높은 순위) ** 🎯

**✅ 키워드 최적화 **:
□ 핵심 키워드 자연스럽게 포함
□ 롱테일 키워드 추가
□ LSI 키워드 활용
□ H2 / H3에 키워드 배치
□ 첫 문단에 키워드 포함

      **✅ 제목 최적화 **:
    - 원문 제목 완전 변경
      - 숫자 + 키워드 + 후킹 멘트
        - 예: "OO 완벽 가이드  (전문가 추천 BEST 7)"

          **✅ 메타 설명 최적화 **:
    - 150자 이내
      - 핵심 키워드 포함
        - 클릭 유도 문구
          - 독자 혜택 명시

✅ ** STEP 7: 품질 검증 체크리스트 ** ✅

**✅ 변경률 체크 **:
□ 문장 변경률 85 % 이상인가 ?
□ 단어 변경률 75 % 이상인가 ?
□ 원문 유사도 25 % 이하인가 ?
□ 새로운 내용 25~35 % 추가했는가 ?

**✅ 의미 보존 체크 **:
□ 핵심 정보가 유지되었는가 ?
□ 원문의 의도가 전달되는가 ?
□ 왜곡된 정보가 없는가 ?
□ 논리적 흐름이 자연스러운가 ?

**✅ 독창성 체크 **:
□ 원문과 완전히 다른 표현인가 ?
□ 문장 구조가 100 % 변경되었는가 ?
□ 새로운 관점이 추가되었는가 ?
□ 독자에게 더 큰 가치를 제공하는가 ?

**✅ SEO 체크 **:
□ 키워드가 자연스럽게 포함되었는가 ?
□ 제목이 최적화되었는가 ?
□ H2 / H3가 적절히 배치되었는가 ?
□ 메타 설명이 작성되었는가 ?

**✅ 글자수 체크 **:
□ 6, 500 ~7, 500자인가 ?
□ 원문 대비 110~130 % 인가 ?
□ 억지로 늘리지 않았는가 ?
□ 정보 밀도가 높은가 ?

❌ ** 절대 금지 사항 ** ❌

**❌ 금지 행위 **:
    - 원문 문장을 그대로 복사
      - 단순히 단어만 바꾸기(문장 구조는 동일)
        - 원문 이미지 사용
          - 의미 왜곡 또는 정보 누락
            - 억지로 글자수만 늘리기
              - 불필요한 내용 추가
                - 원문보다 가치 낮추기

                  **✅ 필수 행위 **:
    - 완전히 새로운 문장 구조
      - 의미는 유지, 표현은 완전 변경
        - 새로운 정보 25~35 % 추가
          - 원문보다 더 나은 콘텐츠
            - 독자에게 더 큰 가치 제공
              - SEO 최적화로 검색 순위 향상

                **🏆 최종 목표: 원문 유사도 0 % + 검색 순위 원문보다 높게! 🏆**

**📈 성공 지표 **:
    - 문장 변경률: 85 % 이상 ✅
    - 단어 변경률: 75 % 이상 ✅
    - 원문 유사도: 25 % 이하 ✅
    - 새로운 내용: 25~35 % 추가 ✅
    - 글자수: 원문 대비 110~130 % ✅
    - 검색 순위: 원문보다 높게 ✅`;
  }

  // CTA 끝판왕 추가
  if (manualCta) {
    basePrompt += `

🎯 ** CTA 끝판왕 시스템 - 필수 적용 규칙 ** 🎯

**✅ CTA 정보 **:
    - 🔗 링크: ${manualCta.url}
    - 📝 버튼 텍스트: "${manualCta.text}"
      - 💬 후킹 멘트: "${manualCta.hook || '💡 더 자세한 정보가 필요하신가요?'}"

        **🎨 CTA HTML 템플릿(반드시 이 형식으로!) **:
    \`\`\`html
<CENTER>
<div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 40px; margin: 48px 0; border-radius: 16px; text-align: center; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15); position: relative; overflow: hidden;">
  <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #ffd700 0%, #ffed4e 50%, #ffd700 100%);"></div>
  <p style="font-size: 1.75rem; font-weight: 700; color: #ffffff; margin: 0 0 16px 0;">${manualCta.hook || '💡 더 자세한 정보가 필요하신가요?'}</p>
  <p style="font-size: 1.125rem; color: #cbd5e1; margin: 0 0 28px 0; line-height: 1.7;">지금 바로 공식 사이트에서 확인해보세요!</p>
  <a href="${manualCta.url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%); color: #1e293b; font-weight: 700; font-size: 1.125rem; text-decoration: none; border-radius: 50px; transition: all 0.3s ease; box-shadow: 0 6px 20px rgba(255, 215, 0, 0.4);">${manualCta.text}</a>
</div>
</CENTER>
\`\`\`

**🚨 필수 준수 사항**:
✅ 반드시 <CENTER> 태그로 중앙 정렬
✅ 후킹 멘트는 클릭하고 싶게 만드는 문구
✅ 소제목과 완벽하게 연관된 내용
✅ 공식 사이트/뉴스/인스타그램만 연동 (블로그/카페 절대 금지)
✅ 에러 페이지나 404 페이지 없는 검증된 링크만 사용
✅ 섹션 마지막에 자연스럽게 배치

**❌ 절대 금지**:
- 다른 블로그나 카페 링크
- 에러 페이지나 접속 불가 링크
- 광고성 링크
- 출처 불명 사이트`;
  }

  // 워드프레스 전용 출력 형식
  if (isWordPress) {
    basePrompt += `

📝 **WordPress 전용 출력 형식**:

⚠️ **절대 규칙**: 
- CSS class/id 사용 금지! 모든 스타일은 인라인으로만!
- 마크다운 코드블록(\`\`\`) 사용 금지! 
- 순수 HTML만 출력!

<!-- wp:html -->
<div style="margin:40px 0; padding:30px; background:linear-gradient(135deg, #2d4a3e 0%, #3d6b5a 50%, #1a3a2a 100%); border-radius:20px; box-shadow:0 15px 40px rgba(45,74,62,0.3), 0 0 0 3px rgba(255,255,255,0.06); position:relative; overflow:hidden;">
  <div style="position:absolute; top:0; left:0; width:100%; height:100%; background:radial-gradient(circle at 30% 70%, rgba(212,187,140,0.08) 0%, transparent 50%);"></div>
  <h3 style="text-align:center; margin-bottom:25px; color:#faf5eb; font-size:1.8rem; font-weight:900; text-shadow:0 2px 8px rgba(0,0,0,0.2); position:relative; z-index:1;">🚀 빠른 이동 목차</h3>
  <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:15px; position:relative; z-index:1;">
    <a href="#toc1" class="toc-nav-item" style="padding:15px 25px; background:linear-gradient(45deg, rgba(255,255,255,0.92) 0%, rgba(250,245,235,0.85) 100%); color:#2d4a3e; text-decoration:none; border-radius:15px; font-weight:700; font-size:16px; transition:all 0.3s ease; border:2px solid rgba(212,187,140,0.3); text-align:center; box-shadow:0 6px 20px rgba(0,0,0,0.08);">1️⃣ 목차 아이템 1</a>
    <a href="#toc2" class="toc-nav-item" style="padding:15px 25px; background:linear-gradient(45deg, rgba(255,255,255,0.92) 0%, rgba(250,245,235,0.85) 100%); color:#2d4a3e; text-decoration:none; border-radius:15px; font-weight:700; font-size:16px; transition:all 0.3s ease; border:2px solid rgba(212,187,140,0.3); text-align:center; box-shadow:0 6px 20px rgba(0,0,0,0.08);">2️⃣ 목차 아이템 2</a>
    <a href="#s3" style="padding:12px 20px; background:rgba(255,255,255,0.2); color:white; text-decoration:none; border-radius:12px; font-weight:600; transition:all 0.3s ease; backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.3); text-align:center;">3회차</a>
    <a href="#s4" style="padding:12px 20px; background:rgba(255,255,255,0.2); color:white; text-decoration:none; border-radius:12px; font-weight:600; transition:all 0.3s ease; backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.3); text-align:center;">4회차</a>
    <a href="#s5" style="padding:12px 20px; background:rgba(255,255,255,0.2); color:white; text-decoration:none; border-radius:12px; font-weight:600; transition:all 0.3s ease; backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.3); text-align:center;">5회차</a>
  </div>
</div>
<!-- /wp:html -->

<!-- wp:html -->
<div style="margin:40px 0; padding:25px; background:linear-gradient(135deg, #2d4a3e 0%, #3d6b5a 100%); border-radius:20px; box-shadow:0 10px 30px rgba(45,74,62,0.25); position:relative; overflow:hidden;">
  <div style="position:absolute; top:0; right:0; width:150px; height:150px; background:radial-gradient(circle, rgba(212,187,140,0.1) 0%, transparent 70%); border-radius:50%; transform:translate(30%, -30%);"></div>
  <h2 style="font-size:26px; font-weight:800; color:#faf5eb; margin:0; padding:0; text-shadow:0 2px 8px rgba(0,0,0,0.15); position:relative; z-index:1;">${subtopic}</h2>
</div>
<!-- /wp:html -->

<!-- wp:html -->
<div style="margin:30px 0 20px 0; padding:18px 22px; background:linear-gradient(135deg, #c9a96e 0%, #b8956a 100%); border-radius:15px; box-shadow:0 6px 20px rgba(201,169,110,0.2); border-left:6px solid #faf5eb; position:relative;">
  <div style="position:absolute; bottom:0; left:0; width:100px; height:100px; background:radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%); border-radius:50%; transform:translate(-20%, 20%);"></div>
  <h3 style="font-size:23px; font-weight:700; color:#ffffff; margin:0; padding:0; text-shadow:0 2px 6px rgba(0,0,0,0.1); position:relative; z-index:1; word-break:keep-all; overflow-wrap:break-word;">첫 번째 H3 소제목</h3>
</div>
<!-- /wp:html -->

<!-- wp:html -->
<div style="margin:24px 0; padding:22px 26px; background:#f8f9fa; border-radius:12px; border-left:4px solid #e3f2fd; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
  <p style="font-size:20px; line-height:1.9; color:#2c3e50; margin:0 0 20px 0; font-weight:400; word-break:keep-all; overflow-wrap:break-word;">첫 번째 문단... (3-4문장, 구체적)</p>
  <p style="font-size:20px; line-height:1.9; color:#2c3e50; margin:0 0 20px 0; font-weight:400; word-break:keep-all; overflow-wrap:break-word;">두 번째 문단... (사례 포함)</p>
  <p style="font-size:20px; line-height:1.9; color:#2c3e50; margin:0; font-weight:400; word-break:keep-all; overflow-wrap:break-word;">세 번째 문단... (실질적 팁)</p>
</div>
<!-- /wp:html -->

${manualCta ? `
<!-- 시리즈 내비게이션 (WordPress) -->
<!-- wp:html -->
<div style="margin:40px 0; padding:25px; background:linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%); border-radius:15px; border:2px solid #bbdefb;">
  <h3 style="margin:0 0 20px 0; color:#1976d2; font-size:20px;">📚 시리즈 내비게이션</h3>
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
    <a href="#" style="padding:10px 20px; background:#1976d2; color:white; text-decoration:none; border-radius:8px;">← 이전 글</a>
    <span style="font-weight:600; color:#424242;">현재: 3 / 10편</span>
    <a href="#" style="padding:10px 20px; background:#1976d2; color:white; text-decoration:none; border-radius:8px;">다음 글 →</a>
  </div>
  <div style="background:#ffffff; padding:15px; border-radius:8px; border:1px solid #e0e0e0;">
    <strong>이번 글 핵심:</strong> 심화 개념 이해와 실전 적용
  </div>
</div>
<!-- /wp:html -->

<!-- 관련 콘텐츠 클러스터 (WordPress) -->
<!-- wp:html -->
<div style="margin:40px 0; padding:25px; background:linear-gradient(135deg, #fff3e0 0%, #fce4ec 100%); border-radius:15px; border:2px solid #ffcc02;">
  <h3 style="margin:0 0 20px 0; color:#f57c00; font-size:20px;">🎯 관련 콘텐츠 클러스터</h3>
  <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:15px;">
    <div style="background:#ffffff; padding:15px; border-radius:8px; border-left:4px solid #ff9800;">
      <h4 style="margin:0 0 8px 0; color:#e65100;">초급자용 추가 학습</h4>
      <p style="margin:0 0 10px 0; font-size:14px;">기초 개념을 더 자세히 알고 싶다면</p>
      <a href="#" style="color:#f57c00; text-decoration:none; font-weight:600;">→ 기초 개념 완전 정복</a>
    </div>
    <div style="background:#ffffff; padding:15px; border-radius:8px; border-left:4px solid #e91e63;">
      <h4 style="margin:0 0 8px 0; color:#c2185b;">실전 프로젝트</h4>
      <p style="margin:0 0 10px 0; font-size:14px;">배운 내용을 직접 적용해보고 싶다면</p>
      <a href="#" style="color:#e91e63; text-decoration:none; font-weight:600;">→ 실전 프로젝트 가이드</a>
    </div>
    <div style="background:#ffffff; padding:15px; border-radius:8px; border-left:4px solid #9c27b0;">
      <h4 style="margin:0 0 8px 0; color:#7b1fa2;">심화 학습</h4>
      <p style="margin:0 0 10px 0; font-size:14px;">더 깊이 있는 내용을 원한다면</p>
      <a href="#" style="color:#9c27b0; text-decoration:none; font-weight:600;">→ 고급 개념 마스터</a>
    </div>
  </div>
</div>
<!-- /wp:html -->

<!-- wp:html -->
<div style="text-align:center; margin:50px 0; padding:35px; background:linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%); border-radius:20px; box-shadow:0 10px 30px rgba(253,203,110,0.4); position:relative; overflow:hidden;">
  <div style="position:absolute; top:50%; left:50%; width:200px; height:200px; background:radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%); border-radius:50%; transform:translate(-50%, -50%);"></div>
  <p style="font-size:24px; color:#2d3436; margin-bottom:20px; font-weight:800; position:relative; z-index:1;">${manualCta.hook || '💡 더 자세한 정보가 필요하신가요?'}</p>
  <a href="${manualCta.url}" rel="noreferrer noopener" style="display:inline-block; padding:18px 40px; background:linear-gradient(45deg, #6c5ce7 0%, #a29bfe 100%); color:#ffffff; font-size:20px; font-weight:bold; text-decoration:none; border-radius:50px; box-shadow:0 8px 25px rgba(108,92,231,0.4); position:relative; z-index:1;">${manualCta.text} →</a>
</div>
<!-- /wp:html -->
` : ''}

📌 **필수 준수 사항**:
1. **본문**: 20px
2. **H2**: 26px, 보라색 그라디언트 박스
3. **H3**: 23px, 핑크색 그라디언트 박스
4. **문단**: 3-4개로 나누어 가독성 극대화
5. **CTA**: 크롤링 기반 외부 링크 + 후킹멘트
6. **순수 HTML**: 인라인 스타일만
7. **마크다운 금지**: \`\`\`html 같은 코드블록 마커 절대 사용 금지!
⚠️⚠️⚠️ **중요**: \`\`\`html, \`\`\`json, \`\`\` 등 모든 백틱 3개 마커는 절대 사용하지 마세요! 코드 블록 전체가 그대로 노출됩니다!`;
  } else {
    // 블로거 전용 출력 형식
    basePrompt += `

📝 **Blogger 전용 출력 형식** (MAX 모드 구조 요소 적용):

⚠️ **절대 규칙**: 
- CSS class/id 사용 금지! 모든 스타일은 인라인으로만!
- 마크다운 코드블록(\`\`\`) 사용 금지! \`\`\`html, \`\`\`json 등 모든 백틱 3개 마커 절대 금지!
- 순수 HTML만 출력! 코드 블록 마커 없이 바로 HTML 태그만 작성!

<div style="margin:40px 0; padding:18px 24px; background:linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(236, 253, 245, 0.45) 100%); border-radius:20px; box-shadow:0 20px 42px rgba(16, 185, 129, 0.18); border:1px solid rgba(16, 185, 129, 0.32); position:relative; overflow:hidden;">
  <h2 style="font-size:1.7rem; margin:0; padding:0; color:#064e3b; text-align:left; font-weight:800; letter-spacing:-0.01em; line-height:1.28; word-break:keep-all; overflow-wrap:break-word; white-space:normal; position:relative; z-index:1;">${subtopic}</h2>
</div>

<div style="margin:30px 0 20px 0; padding:18px 22px; background:linear-gradient(135deg, #fd79a8 0%, #ffeaa7 100%); border-radius:15px; box-shadow:0 6px 20px rgba(253,121,168,0.3); border-left:6px solid #ffffff; position:relative;">
  <div style="position:absolute; bottom:0; left:0; width:100px; height:100px; background:radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%); border-radius:50%; transform:translate(-20%, 20%);"></div>
  <h3 style="font-size:24px; font-weight:700; color:#ffffff; margin:0; padding:0; text-shadow:0 2px 8px rgba(0,0,0,0.15); position:relative; z-index:1;">첫 번째 H3 소제목</h3>
</div>

<p style="font-size:20px; line-height:1.9; color:#2c3e50; margin:0 0 28px 0; font-weight:400;">첫 번째 문단... (3-4문장, 구체적)</p>

<p style="font-size:20px; line-height:1.9; color:#2c3e50; margin:0 0 28px 0; font-weight:400;">두 번째 문단... (사례 포함)</p>

<!-- 동적 테이블 (비교 정보) -->
<table style="width:100%; border-collapse:collapse; margin:30px 0; box-shadow:0 5px 15px rgba(0,0,0,0.1); border-radius:12px; overflow:hidden;">
  <thead>
    <tr style="background:linear-gradient(135deg, #74b9ff 0%, #a29bfe 100%);">
      <th style="padding:18px; border:none; color:white; font-weight:700; font-size:18px;">항목</th>
      <th style="padding:18px; border:none; color:white; font-weight:700; font-size:18px;">내용</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background:#f8f9fa;">
      <td style="padding:15px; border-bottom:1px solid #e9ecef; font-size:17px;">예시 1</td>
      <td style="padding:15px; border-bottom:1px solid #e9ecef; font-size:17px;">설명...</td>
    </tr>
  </tbody>
</table>

${manualCta ? `
<div style="text-align:center; margin:50px 0; padding:35px; background:linear-gradient(135deg, #dfe6e9 0%, #b2bec3 100%); border-radius:20px; box-shadow:0 10px 30px rgba(178,190,195,0.4); position:relative; overflow:hidden;">
  <div style="position:absolute; top:50%; left:50%; width:200px; height:200px; background:radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%); border-radius:50%; transform:translate(-50%, -50%);"></div>
  <p style="font-size:24px; color:#2d3436; margin-bottom:20px; font-weight:800; position:relative; z-index:1;">${manualCta.hook || '💡 더 자세한 정보가 필요하신가요?'}</p>
  <a href="${manualCta.url}" rel="noreferrer noopener" style="display:inline-block; padding:18px 40px; background:linear-gradient(45deg, #fd79a8 0%, #ffeaa7 100%); color:#2d3436; font-size:20px; font-weight:bold; text-decoration:none; border-radius:50px; box-shadow:0 8px 25px rgba(253,121,168,0.4); position:relative; z-index:1;">${manualCta.text} →</a>
</div>
` : ''}

📌 **필수 준수 사항**:
1. **본문**: 20px
2. **H2**: 26px, 파란-보라 그라디언트 박스
3. **H3**: 23px, 핑크-노랑 그라디언트 박스
4. **문단**: 3-4개로 나누어 가독성 극대화
5. **CTA**: 크롤링 기반 외부 링크 + 후킹멘트
6. **순수 HTML**: 인라인 스타일만
7. **마크다운 금지**: \`\`\`html 같은 코드블록 마커 절대 사용 금지!`;
  }

  basePrompt += `

📌 **Blogger 필수 준수 사항**:
1. **본문**: 20px, 줄간격 2.2
2. **H2**: 28px, 파란색 그라디언트 박스
3. **H3**: 24px, 핑크색 그라디언트 박스
4. **문단**: 3-4개로 나누어 가독성 극대화
5. **CTA**: 크롤링 기반 외부 링크 + 후킹멘트
6. **순수 HTML**: 인라인 스타일만
7. **마크다운 금지**: \`\`\`html 같은 코드블록 마커 절대 사용 금지!
8. **버튼형 목차 없음**: WordPress와 차별화
9. **MAX 모드 구조 요소**: 동적 콘텐츠, 체크리스트, 표, 그래프 활용
10. **반투명 카드 디자인**: 부드러운 그림자 효과 적용

🎯 **SEO 최적화 구조 (노출→클릭→체류→전환)**:
1. **노출 최적화**: 키워드를 제목(H2)과 본문에 자연스럽게 포함, 검색 엔진이 이해할 수 있도록 구조화
2. **클릭 유도**: 호기심을 자극하는 소제목, 독자의 문제를 정확히 짚는 도입, 해결책 약속
3. **체류시간 증가**: 실용적이고 바로 적용 가능한 정보, 구체적 사례, 시각적 요소로 끝까지 읽고 싶게 구성
4. **전환 유도**: 섹션 끝에 자연스러운 CTA, 독자 검색 의도에 맞는 링크, 명확한 행동 제안

💡 **작성 가이드**:
1. "${subtopic}" 소제목에 맞는 내용으로 작성
2. 독자의 관심을 끄는 도입으로 시작 (클릭 유도)
3. 구체적이고 실용적인 정보 제공 (체류시간 증가)
4. 실제 사례나 경험담 포함 (체류시간 증가)
5. 독자가 바로 적용할 수 있는 팁 제공 (전환 유도)
6. 자연스러운 키워드 포함 (노출 최적화)
7. ${section.minChars}자 가이드라인 (참고용, 강제 아님 - 글의 질이 최우선)
8. MAX 모드 구조 요소 활용 (동적 콘텐츠, 체크리스트, 표, 그래프)
${manualCta ? `9. **중요**: CTA는 크롤링 기반으로 독자들이 실제 필요로 하고 가장 많이 찾는 실제 링크를 넣어야 합니다 (전환 유도)` : ''}

⚠️ **글자수 작성 원칙 - 마지막 확인**:
- ${section.minChars}자는 **최소 목표**이며, 억지로 늘리지 마세요
- **양보다 질 우선** - 독자에게 가치 있는 정보 제공이 최우선입니다
- 구체적인 사례, 예시, 팁, 통계 등을 추가하여 자연스럽게 확장하세요
- 같은 내용 반복이나 의미 없는 문장으로 늘리기는 절대 금지입니다

이제 "${subtopic}" 소제목에 맞는 ${section.title} 섹션의 내용을 작성해주세요.`;

  return basePrompt;
}

