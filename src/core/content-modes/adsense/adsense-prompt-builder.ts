// src/core/content-modes/adsense/adsense-prompt-builder.ts
// 애드센스 승인 전용 프롬프트 빌더 — 끝판왕 버전
// 기존 공통 프롬프트와 완전 분리된 독립 로직

import type { PromptParams } from '../mode-interface';
import { getToneInstruction, buildYearGuideline, generateUniqueContentId } from '../base-prompt-builder';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 애드센스 절대 금지 표현 (프롬프트에 직접 삽입)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const FORBIDDEN_EXPRESSIONS = `
🚫 **절대 금지 표현 (위반 시 즉시 거절)**:
- "수익", "광고 수익", "조회수 폭발", "돈 벌기", "매출 증대"
- "지금 바로 클릭하세요", "놓치지 마세요", "한정 특가", "독점 혜택"
- CTA 버튼, 배너, 팝업, 긴급성/FOMO 표현 전부 금지
- "이 포스팅은 ~를 포함하고 있습니다" (광고 고지 문구)
- 외부 제휴 링크 (쿠팡 파트너스, 알리 어필리에이트 등)
- "완벽하다", "최고다", "반드시", "절대" 같은 과장 표현
- "~해보세요!" 같은 명령형 CTA 표현
`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// E-E-A-T 심층 전략
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const EEAT_STRATEGY = `
✅ **E-E-A-T 심층 강화 전략**:

1. **Experience (경험)**:
   - 1인칭 시점으로 직접 경험 서술 ("제가 직접 3개월간 사용해본 결과...")
   - Before/After 구체적 수치 포함 ("사용 전 월 3만원 → 사용 후 월 8천원")
   - 실패 경험도 솔직하게 공유 ("처음에는 실패했는데, 이유는...")

2. **Expertise (전문성)**:
   - 전문 용어를 사용하되 초보자도 이해하도록 설명
   - 데이터와 통계를 인용 ("한국소비자원 2026년 조사에 따르면...")
   - 해당 분야 자격증, 경력, 교육 배경 자연스럽게 언급

3. **Authoritativeness (권위성)**:
   - 신뢰할 수 있는 출처 명시 (정부기관, 학술논문, 공식 사이트)
   - 관련 법규나 규정 인용 (해당 시)
   - 전문가 의견 인용

4. **Trustworthiness (신뢰성)**:
   - 장단점을 모두 객관적으로 분석
   - "완벽하다", "최고다" 같은 과장 표현 제거
   - 마지막 업데이트 날짜 명시 ("2026년 3월 기준")
   - 오류가 있을 수 있음을 인정 ("상황에 따라 다를 수 있습니다")
`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI 탐지 방지 전략
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const AI_DETECTION_AVOIDANCE = `
🤖 **AI 탐지 방지 — 인간의 글쓰기 패턴**:

1. **문장 길이 변화율 (Burstiness)**:
   - 짧은 문장(10자) → 긴 문장(80자) → 중간 문장(40자) 섞기
   - 연속 3문장이 비슷한 길이면 즉시 조정
   - 목표: 문장 길이 표준편차 12 이상

2. **종결어미 다양성 (최소 4종류 사용)**:
   - "~습니다" / "~요" / "~다" / "~죠" / "~거든요" / "~더라고요"
   - 같은 종결어미 3번 연속 사용 금지

3. **도입 패턴 비반복**:
   - 각 문단 시작을 절대 같은 구조로 하지 않기
   - ❌ "또한 ~합니다. 또한 ~합니다. 그리고 ~합니다."
   - ✅ "한 가지 더 중요한 건요. 이건 좀 의외인데. 실제로 써보니까."

4. **자연스러운 불완전성**:
   - 가끔 짧은 감탄사 ("아, 이건 진짜 좋았어요")
   - 구어체 표현 적절히 섞기 ("솔직히 말하면", "근데 여기서 중요한 게")
   - 괄호 안 부연 설명 ("이 부분은 좀 논란이 있는데요")

❌ **절대 금지 — AI 느낌 나는 표현들**:
- "또한", "그리고" 같은 반복적 접속사 남용
- "~할 수 있습니다", "~가능합니다" 같은 형식적 표현
- "~라고 할 수 있습니다", "~것으로 보입니다" 같은 불확실 표현
- 완벽하게 정돈된 문장만 나열 (기계적 느낌)
`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 콘텐츠 구조 규칙
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const CONTENT_STRUCTURE_RULES = `
📝 **콘텐츠 구조 규칙**:
1. H2/H3 구조: 명확한 계층적 구조 유지
2. 이미지 alt 태그: 모든 이미지 위치에 설명적 alt 텍스트 제안
3. 내부링크: 관련 글 3개 이상 자연스럽게 연결
   - "이 주제에 대해 더 알고 싶다면 [관련 글 제목] 글도 참고해보세요"
4. 외부링크: 신뢰할 수 있는 출처 3-5개 (정부기관, 학술논문, 공식 사이트)
5. 표/리스트: 비교 분석은 반드시 표 형태로 시각화
`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 승인 거절 방지
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const REJECTION_PREVENTION = `
🚨 **Google 2026 승인 거절 TOP 10 방지**:
1. "저가치 콘텐츠" → 최소 6,000자 이상, 독창적 인사이트 필수
2. "복제/도용 콘텐츠" → 표절률 5% 이하, 자체 경험 기반
3. "사이트 탐색 어려움" → 명확한 카테고리, 사이트맵
4. "에드센스 정책 위반" → 성인/도박/마약/무기 콘텐츠 0
5. "비존재 페이지" → 필수 4개 페이지 확인
6. "불충분한 콘텐츠양" → 최소 15개 이상 고품질 글
7. "트래픽 조작" → 자연 트래픽만 허용
8. "과도한 광고" → 승인 전 광고 코드 0
9. "반응형 미지원" → 모바일 완전 최적화
10. "작성자 불명확" → About 페이지 필수
`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 프롬프트 빌더 함수들
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 섹션 프롬프트 생성 — 애드센스 전용
 */
export function buildAdsenseSectionPrompt(params: PromptParams): string {
    const {
        topic, keywords, section, subtopic,
        platform, toneStyle, targetYear,
        draftContext, timestamp, randomSeed, trendKeywords,
        authorInfo,
    } = params;

    const uniqueId = generateUniqueContentId(timestamp, randomSeed);
    const yearGuide = buildYearGuideline(targetYear);
    const toneGuide = getToneInstruction(toneStyle);
    const cleanedDraft = draftContext ? draftContext.trim() : '';

    const trendInfo = trendKeywords && trendKeywords.length > 0
        ? `\n\n【네이버 데이터랩 트렌드 키워드】\n${trendKeywords.slice(0, 8).join(', ')}\n⚠️ 트렌드 키워드를 본문에 자연스럽게 포함하되, 강제로 넣지 마세요.`
        : '';

    // 사용자 지정 저자 정보 — 없으면 1인칭 경험담 생성 자체를 금지 (E-E-A-T 위조 방지)
    const hasAuthor = !!(authorInfo?.name && authorInfo.name.trim());
    const authorInstruction = hasAuthor
        ? `\n👤 **사용자 지정 저자 정보** (이 정보를 기반으로 일관된 저자 페르소나를 유지하세요):
- 이름: ${authorInfo!.name}
- 직함/전문 분야: ${authorInfo!.title || '(주제에 맞게 AI가 결정)'}
- 자격/경력: ${authorInfo!.credentials || '(주제에 맞게 AI가 결정)'}
⚠️ 작성자 소개 섹션에서는 위 정보를 자연스러운 1인칭 서술로 풀어주세요.
⚠️ 다른 섹션에서도 이 저자의 관점과 전문성을 유지하세요.\n`
        : `\n🛡️ **저자 프로필 미입력 — 1인칭 경험담 생성 절대 금지**:
- "제가 직접 ~해본 결과", "저는 ~를 사용했더니" 같은 1인칭 경험 서술 사용 금지
- 가상의 저자 페르소나 만들기 금지 (구글 E-E-A-T 위조 = 즉시 거절 사유)
- 대신 "공식 자료에 따르면", "전문가들은 ~라고 말합니다", "한국소비자원 데이터에 의하면" 같은 객관적 3인칭 서술만 사용
- 작성자 소개 섹션은 "이 글의 정보 출처와 검증 방식"으로 대체하여 작성\n`;

    // FAQ 섹션 특수 처리 — Schema.org JSON-LD 포함
    const faqSchemaInstruction = section.id === 'faq_section'
        ? `\n\n📋 **FAQ Schema.org 마크업 필수**:
글 끝에 다음 형식의 JSON-LD를 <script type="application/ld+json"> 태그로 추가하세요:
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "질문1", "acceptedAnswer": { "@type": "Answer", "text": "답변1" } },
    // ... 각 질문-답변 쌍
  ]
}`
        : '';

    return `🏆 **애드센스 승인 전문 모드** — 2026년 최신 정책 반영
당신은 Google AdSense 심사관의 관점에서 콘텐츠를 작성하는 전문가입니다.

⚠️ **콘텐츠 고유성**: 고유 ID ${uniqueId} — 매번 완전히 다른 관점과 표현으로 작성하세요.
${yearGuide}
${toneGuide}
${authorInstruction}

📌 **섹션**: ${section.title}
🔍 **소제목**: ${subtopic}
👤 **역할**: ${section.role}
🎯 **콘텐츠 포커스**: ${section.contentFocus}
📊 **참고 글자수**: ${section.minChars}자 (글의 질이 최우선, 억지로 맞추지 마세요)
🔑 **키워드**: ${keywords.join(', ')}
📝 **주제**: ${topic}
${trendInfo}

${FORBIDDEN_EXPRESSIONS}
${EEAT_STRATEGY}
${AI_DETECTION_AVOIDANCE}
${CONTENT_STRUCTURE_RULES}
${REJECTION_PREVENTION}
${faqSchemaInstruction}

✅ **필수 포함 요소** (이 섹션에서 반드시 다뤄야 할 내용):
${section.requiredElements.map((el, i) => `${i + 1}. ${el}`).join('\n')}

⚠️ **핵심 원칙**:
- 글의 질과 완성도가 모든 것보다 중요합니다
- 독자에게 가치 있는 정보를 제공하는 것이 최우선 목표입니다
- CTA, 배너, 광고 관련 요소는 절대 포함하지 마세요
- 이 글은 순수한 정보 제공/교육 목적의 콘텐츠입니다
- 글 마지막에 "이 글은 ${new Date().getFullYear()}년 ${new Date().getMonth() + 1}월 기준으로 작성되었습니다" 형태의 업데이트 날짜를 반드시 포함하세요 (E-E-A-T 신뢰성)

${cleanedDraft ? `\n📖 **참고 초안**:\n${cleanedDraft}\n이 초안을 참고하되 완전히 새롭게 작성하세요.\n` : ''}

이제 "${subtopic}" 소제목의 내용을 작성해주세요.`;
}

/**
 * 제목 프롬프트 생성 — 애드센스 전용
 */
export function buildAdsenseTitlePrompt(
    topic: string,
    keywords: string[],
    trendKeywords?: string[]
): string {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const trendInfo = trendKeywords && trendKeywords.length > 0
        ? `\n🔥 트렌드 키워드: ${trendKeywords.slice(0, 5).join(', ')}`
        : '';

    return `🏆 **애드센스 승인 전문 모드 — 제목 생성**

당신은 Google 검색 결과에서 높은 CTR을 달성하면서도
AdSense 심사관이 "이건 고품질 콘텐츠"라고 판단할 제목을 만드는 전문가입니다.

📝 **주제**: ${topic}
🔑 **키워드**: ${keywords.join(', ')}
📅 **현재**: ${currentYear}년 ${currentMonth}월${trendInfo}

🚫 **제목 금지 규칙**:
- "~하는 법 TOP 10" 같은 진부한 리스트형 제목
- "수익", "돈", "매출" 등 광고/수익 관련 단어
- "충격", "경악", "반전" 같은 낚시성 단어
- "꿀팁" 등 과도하게 캐주얼한 표현
- 과장된 숫자 ("1000%", "무조건")

✅ **제목 필수 규칙**:
- 키워드를 자연스럽게 포함
- 교육적 가치/전문성이 느껴지는 톤
- 독자의 구체적 문제를 해결해줄 것 같은 느낌
- 2026년 최신 정보임을 암시
- 15-30자 사이 (너무 길거나 짧지 않게)

✅ **좋은 예시**:
- "[키워드] 완벽 가이드: 전문가가 알려주는 핵심 포인트"
- "${currentYear}년 [키워드] 비교 분석 — 실제 사용 후기"
- "[키워드] 초보자가 반드시 알아야 할 5가지"
- "직접 써본 [키워드] 솔직 리뷰와 선택 가이드"

제목을 **하나만** 생성해주세요. 부가 설명 없이 제목만 출력하세요.`;
}

/**
 * 아웃라인 프롬프트 생성 — 애드센스 전용
 */
export function buildAdsenseOutlinePrompt(
    topic: string,
    keywords: string[],
    targetYear?: number | null
): string {
    const currentYear = targetYear || new Date().getFullYear();

    return `🏆 **애드센스 승인 전문 모드 — 아웃라인 생성**

📝 **주제**: ${topic}
🔑 **키워드**: ${keywords.join(', ')}
📅 **기준 연도**: ${currentYear}년

이 주제에 대해 AdSense 승인에 최적화된 H2 소제목 구조를 생성하세요.

📋 **필수 구조** (7개 섹션):
1. 작성자 소개 (전문성/경험 간략 소개)
2. [주제] 완전히 이해하기 (핵심 개념, E-E-A-T 핵심)
3. 직접 경험 (1인칭 경험, Before/After)
4. 단계별 실행 가이드 (따라할 수 있는 구체적 단계)
5. 비교 분석 및 추천 (객관적 비교, 표 포함)
6. 자주 묻는 질문 FAQ (Schema.org 마크업, 6-8개 질문)
7. 마무리 및 추가 리소스 (내부링크 3개+)

✅ **규칙**:
- 각 소제목에 키워드를 자연스럽게 포함
- 독자 관점의 질문형 또는 가이드형 제목
- 광고/수익 관련 표현 절대 금지
- H3 소제목도 각 H2마다 2-3개씩 제안

⚠️ **출력 형식**:
JSON 배열로 출력하세요. 각 항목은 { "title": "소제목", "subtopics": ["H3-1", "H3-2", "H3-3"] } 형태입니다.`;
}
