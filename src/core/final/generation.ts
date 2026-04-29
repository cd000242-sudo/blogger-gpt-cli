/**
 * 콘텐츠 생성 함수 모음
 * - H1, H2, H3 제목 생성
 * - 전체 본문 일괄 생성
 * - FAQ, CTA, 요약표, 해시태그 생성
 */

import axios from 'axios';
import { loadEnvFromFile } from '../../env';
import { getGeminiApiKey, getPerplexityApiKey } from '../llm';
import { validateCtaUrlWithAi } from '../../cta/validate-cta-ai';

/**
 * 🔀 하이브리드 CTA 검증 — HTTP 1차 + (옵션) Perplexity AI 2차
 *
 * 동작:
 *  - HTTP 검증 실패 → 즉시 false (LLM 호출 안 함, 비용 절감)
 *  - HTTP 통과 + 엄격 모드(CTA_AI_VALIDATE_STRICT=true) → AI 검증으로 의미 적합성까지 확인
 *  - HTTP 통과 + 자동 모드 + aiRecommended=true(정부 사이트 등) → AI 검증
 *  - HTTP 통과 + 자동 모드 + aiRecommended=false → 즉시 통과
 */
async function hybridValidateCta(url: string, keyword: string, timeoutMs = 5000): Promise<boolean> {
  const httpResult = await validateCtaUrl(url, { timeout: timeoutMs });
  if (!httpResult.isValid) return false;

  const strictMode = String(process.env['CTA_AI_VALIDATE_STRICT'] || '').toLowerCase() === 'true';
  const shouldAiCheck = strictMode || httpResult.aiRecommended === true;
  if (!shouldAiCheck) return true;

  try {
    const aiResult = await validateCtaUrlWithAi(url, keyword, { strict: strictMode, timeoutMs: 12000 });
    if (aiResult.skipped) return true; // API 키 없거나 호출 실패 시 차단 사유로 삼지 않음
    if (!aiResult.ok) {
      console.log(`[CTA] 🤖 AI 검증 실패 (conf=${aiResult.confidence.toFixed(2)}): ${aiResult.reason}`);
      return false;
    }
    return true;
  } catch (e: any) {
    console.warn('[CTA] AI 검증 예외(통과 처리):', e?.message);
    return true;
  }
}
import { validateCtaUrl } from '../../cta/validate-cta-url';
import { callGeminiWithGrounding } from './gemini-engine';
import { FinalCrawledPost, FinalTableData, FinalCTAData, FAQItem } from './types';

// 🔥 AI 응답에서 테이블 데이터를 안전하게 파싱
function parseTables(raw: unknown): FinalTableData[] {
  if (!raw || !Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>)
    .filter((t) => t && Array.isArray(t['headers']) && Array.isArray(t['rows']) && (t['headers'] as unknown[]).length > 0 && (t['rows'] as unknown[]).length > 0)
    .map((t) => ({
      type: (['feature', 'example', 'summary', 'info', 'comparison', 'checklist'].includes(t['type'] as string) ? t['type'] : 'info') as FinalTableData['type'],
      headers: (t['headers'] as unknown[]).map(String),
      rows: (t['rows'] as unknown[]).map((r) => Array.isArray(r) ? r.map(String) : [])
    }))
    .slice(0, 3);
}

export async function generateH1TitleFinal(keyword: string, crawledTitles: string[]): Promise<string> {
  // 🔥 현재 날짜 주입
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // 🔥 키워드에서 연도 추출 (2025, 2026 등)
  const yearMatch = keyword.match(/20\d{2}/);
  const keywordYear = yearMatch ? yearMatch[0] : null;

  // 🌐 제목 참고 데이터: 크롤링 데이터 있으면 활용, 없으면 검색 지시
  const titleReference = crawledTitles.length > 0
    ? `🔍 참고할 인기 제목들:\n${crawledTitles.slice(0, 10).map((t, i) => `${i + 1}. ${t}`).join('\n')}`
    : `🌐 Google에서 "${keyword}"를 검색하여 현재 상위 노출 중인 인기 블로그 제목 패턴을 분석하세요.`;

  // 🎲 제목 아키타입 랜덤 선택 (매번 다른 패턴으로 다양성 보장)
  const titleArchetypes = [
    { name: '실용 가이드', pattern: '"OO 완벽 가이드", "초보자를 위한 OO 핵심 정리", "OO 시작하는 법"' },
    { name: '숫자 리스트', pattern: '"OO 꼭 알아야 할 5가지", "전문가가 추천하는 OO 7선", "OO BEST 3 비교"' },
    { name: '질문형 호기심', pattern: '"OO 왜 아무도 안 알려줄까?", "OO 진짜 효과 있을까?", "OO 이래도 괜찮은 걸까?"' },
    { name: '비교/대조', pattern: '"OO vs OO 뭐가 더 좋을까", "OO 장단점 솔직 비교", "OO 전후 차이점 총정리"' },
    { name: '핵심 정리', pattern: '"OO 핵심만 쏙쏙 정리", "OO 한눈에 보는 총정리", "OO 알아야 할 모든 것"' },
    { name: '트렌드/최신', pattern: `"${currentYear}년 OO 최신 트렌드", "올해 달라진 OO 핵심 변화", "${currentYear} OO 이렇게 바뀌었다"` },
    { name: '문제 해결', pattern: '"OO 안 될 때 해결법 총정리", "OO 실패하는 3가지 이유", "OO 흔한 실수와 해결책"' },
    { name: '정보 분석', pattern: '"OO 공식 정보 핵심 정리", "OO 최신 변경사항 분석", "OO 데이터로 보는 현황"' },
    { name: '단계별 가이드', pattern: '"OO 3단계로 끝내기", "OO 따라하면 되는 5스텝", "OO 입문부터 실전까지"' },
    { name: '꿀팁/노하우', pattern: '"OO 꿀팁 모음", "OO 고수만 아는 비법", "OO 효율 200% 올리는 법"' },
  ];

  // 랜덤으로 3개 아키타입 선택
  const shuffled = [...titleArchetypes].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 3);
  const archetypeGuide = selected.map((a, i) => `${i + 1}. **${a.name}형**: ${a.pattern}`).join('\n');

  const todayH1 = new Date().toISOString().slice(0, 10);
  const prompt = `당신은 대한민국 최고의 바이럴 마케터입니다.
현재: ${currentYear}년 ${currentMonth}월 (오늘: ${todayH1})

키워드: ${keyword}

${titleReference}

**이번에 사용할 제목 스타일 (아래 중 하나 선택):**
${archetypeGuide}

**작성 규칙:**
- 위 스타일 중 하나를 골라 창의적으로 작성
- 이모지 1개 필수 포함 (🔥💡🎯✅🚀📊💰🏆 등)
- 키워드 "${keyword}"를 자연스럽게 포함
- 연도가 필요한 주제(정책·지원금·세금·트렌드 등)면 "${currentYear}년"을 제목 맨 앞에. 불필요한 주제(맛집·일상 꿀팁 등)면 연도 생략.
- 연도를 쓸 때는 반드시 "2026년" 형태로 제목 맨 앞에. "년 2026" 같은 역순 금지.
- 이미 마감된 사업/이벤트는 제목에 포함 금지. 현재 진행 중이거나 미래 일정만 다루세요.
- 한글과 영문/숫자만 사용. 중국어 한자(漢字) 절대 금지!
- 금지: ~손해, ~후회, ~대박 표현
- 제목 길이: 25~45자
- 오직 1개만 출력 (옵션/설명/번호 없이 제목만)
`;

  const response = await callGeminiWithGrounding(prompt);
  // 첫 번째 줄만 추출, 특수문자/번호 제거
  const lines = response.trim().split('\n');
  let title = (lines[0] || response.trim())
    .replace(/^[\*\-\d\.\)\]]+\s*/g, '')  // 번호/기호 제거
    .replace(/["']/g, '')
    .replace(/[\u4E00-\u9FFF\u3400-\u4DBF]/g, '')  // 한자 제거
    .trim();

  // 50자 초과시만 자르기 (긴 제목 허용)
  if (title.length > 50) {
    title = title.substring(0, 47) + '...';
  }

  return title;
}

export async function generateH2TitlesFinal(keyword: string, subheadings: string[], maxCount?: number): Promise<string[]> {
  // 빈도 분석
  const freq = new Map<string, number>();
  subheadings.forEach(h => {
    const clean = h
      .replace(/^[hH]2[:\-\s]*/gi, '')  // h2:, H2-, H2 등
      .replace(/^[hH]3[:\-\s]*/gi, '')  // h3:, H3- 등
      .replace(/^H2-?\d+[:\s]*/gi, '')  // H2-1:, H21: 등
      .replace(/^\d+[.\):\s]+/g, '')    // 1., 2), 3: 등
      .replace(/^소제목[:\s]*/gi, '')   // 소제목: 등
      .replace(/^제목[:\s]*/gi, '')     // 제목: 등
      .trim();
    if (clean.length > 3 && clean.length < 50) {
      freq.set(clean, (freq.get(clean) || 0) + 1);
    }
  });

  // 빈도순 정렬
  const sorted = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([h]) => h);

  // 🔥 H2 섹션 수: 최소 5개 보장! (크롤링 데이터 부족해도 AI가 생성)
  const uniqueCount = sorted.length;
  const rawSignalCount = Array.isArray(subheadings) ? subheadings.length : 0;
  let targetCount = 5;  // 🔥 최소 5개 기본값!

  // 고유 소제목 수에 따라 타겟 결정 (최소 5개 보장)
  if (uniqueCount <= 3) targetCount = 5;
  else if (uniqueCount <= 5) targetCount = 5;
  else if (uniqueCount <= 8) targetCount = 6;
  else if (uniqueCount <= 12) targetCount = 7;
  else if (uniqueCount <= 18) targetCount = 8;
  else if (uniqueCount <= 25) targetCount = 9;
  else targetCount = 10;  // 🔥 최대 10개까지 확장!

  // 크롤링 신호 수에 따라 상향 조정만 (최소 5개 유지)
  if (rawSignalCount >= 30) targetCount = Math.max(targetCount, 6);
  if (rawSignalCount >= 50) targetCount = Math.max(targetCount, 8);

  if (typeof maxCount === 'number' && Number.isFinite(maxCount) && maxCount > 0) {
    targetCount = Math.min(targetCount, Math.floor(maxCount));
  }

  // 🔥 현재 날짜 주입
  const currentYear = new Date().getFullYear();

  // 🌐 소제목 참고 데이터: 크롤링 데이터 있으면 활용, 없으면 검색 지시
  const subheadingReference = sorted.length > 0
    ? `🔍 참고할 크롤링 소제목:\n${sorted.join('\n')}\n\n===== H2 소제목 후보 =====\n${sorted.slice(0, targetCount).map((h, i) => `${i + 1}. ${h}`).join('\n')}\n=====\n\n위 크롤링 데이터를 분석하여 **서로 다른 정보**를 담은 H2 소제목 ${targetCount}개를 만드세요.`
    : `🌐 Google에서 "${keyword}"를 검색하여 이 주제에 대해 사람들이 가장 궁금해하는 핵심 소주제 ${targetCount}개를 파악하세요.\n검색 결과에서 발견된 실제 트렌드와 이슈를 기반으로 H2 소제목을 만드세요.`;

  // 🎯 검색 의도 자동 분류 — 의도별로 다른 H2 아키타입 제시
  const { buildIntentPromptBlock } = require('../search-intent-classifier');
  const intentBlock = buildIntentPromptBlock(keyword);

  const prompt = `
키워드: ${keyword}
${intentBlock}
${subheadingReference}

🔴🔴🔴 **핵심 규칙 - 중복 금지 & 다양성 확보!**:
1. 각 H2는 완전히 다른 주제/관점을 다뤄야 함
2. 같은 내용을 다르게 표현하지 마세요 (예: "방법", "하는 법" 1개만)
3. **단조로운 패턴 피하기**: 모든 제목을 "OO란?", "OO 방법"으로 똑같이 끝내지 마세요.
4. **검색 의도에 맞는 아키타입 우선 사용** (위 "권장 H2 아키타입" 참조). 의도와 무관한 아래 일반 아키타입은 보조 용도:
   - [Q&A형] "사람들이 가장 많이 물어보는 질문 TOP 3"
   - [심층 분석형] "왜 전문가들은 OO를 추천할까?"
   - [체크리스트형] "시작하기 전 반드시 확인해야 할 5가지"
   - [비교 분석형] "OO vs OO, 나에게 맞는 것은?"
   - [핵심 정리형] "한눈에 보는 핵심 포인트 총정리"

요구사항:
1. 각 H2가 위 아키타입처럼 서로 완전히 다르고 흥미로운 정보를 다룰 것!
2. SEO 최적화, 각 15~20자 이내
3. 🔴🔴🔴 번호/접두어 금지! 순수한 제목 텍스트만!
4. 검색자가 당장 클릭하고 싶을 만큼 매력적인 문장형 제목을 활용할 것
5. 🔴 연도: ${currentYear}년 외 과거 연도 금지
6. 이미 마감된 사업/이벤트/일정은 소제목에 포함 금지. 현재 진행 중이거나 미래 일정만!
7. 한글과 영문/숫자만 사용. 중국어 한자(漢字) 절대 금지!

JSON만(${targetCount}개 문자열 배열):
`;

  try {
    const response = await callGeminiWithGrounding(prompt);
    const json = response.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const titles = JSON.parse(json) as string[];
    // 🔥 모든 접두어 공격적으로 제거
    return titles.map(t => t
      .replace(/^[hH]2[:\-\s]*/gi, '')
      .replace(/^[hH]3[:\-\s]*/gi, '')
      .replace(/^H2-?\d+[:\s]*/gi, '')
      .replace(/^\d+[.\):\s]+/g, '')
      .replace(/^소제목[:\s]*/gi, '')
      .replace(/^제목[:\s]*/gi, '')
      .replace(/[\u4E00-\u9FFF\u3400-\u4DBF]/g, '')
      .trim()
    ).filter(t => t.length > 0);
  } catch {
    return sorted.slice(0, targetCount).map(s => s.split(' (')[0]).filter((h): h is string => !!h);
  }
}

const h3Cache = new Map<string, string[]>();

export async function generateH3TitlesFinal(h2: string, keyword: string): Promise<string[]> {
  const fallback = [`${h2} 핵심 정리`, `실전 적용 방법`, `주의사항 정리`];
  const cacheKey = `${keyword}||${h2}`;

  if (h3Cache.has(cacheKey)) {
    return h3Cache.get(cacheKey)!;
  }

  const prompt = `키워드: ${keyword}
H2 소제목: ${h2}

위 소제목에 대한 H3 부제목 3개를 만드세요.
- 각 H3는 서로 다른 관점 (개념/실전/주의점 등)
- 10~20자, 순수 텍스트만
- JSON 문자열 배열로만 출력: ["제목1", "제목2", "제목3"]`;

  try {
    const raw = await callGeminiWithGrounding(prompt);
    const match = raw.match(/\[[\s\S]*?\]/);
    if (!match) return fallback;

    const parsed: unknown = JSON.parse(match[0]);
    if (!Array.isArray(parsed) || parsed.length < 3) return fallback;

    const titles = parsed
      .slice(0, 3)
      .map((t) => String(t).replace(/^#+\s*/, '').replace(/^\d+[.\):\s]+/, '').replace(/[\u4E00-\u9FFF\u3400-\u4DBF]/g, '').trim())
      .filter((t) => t.length > 0);

    if (titles.length < 3) return fallback;

    h3Cache.set(cacheKey, titles);
    return titles;
  } catch {
    return fallback;
  }
}

// 🔥🔥🔥 전체 글을 단 1회 API 호출로 생성하는 초고속 함수
export async function generateAllSectionsFinal(
  keyword: string,
  h2Titles: string[],
  crawledContents: string[],
  onLog?: (s: string) => void,
  contentMode?: string,
  draftContent?: string,
  sectionGuideBlock?: string
): Promise<{
  introduction: string;
  conclusion: string;
  sections: Array<{
    h2: string;
    h3Sections: Array<{
      h3: string;
      content: string;
      tables: FinalTableData[];
      cta?: FinalCTAData;
    }>;
  }>;
}> {
  const reference = crawledContents.join('\n\n').slice(0, 12000);

  const h2List = h2Titles.map((h2, i) => `${i + 1}. ${h2}`).join('\n');

  // 🌐 참고 데이터: 크롤링 데이터 있으면 활용, 없으면 검색 지시
  const contentReference = reference.trim().length > 100
    ? `===== 참고 데이터 =====\n${reference}\n=====\n\n모든 정보는 위 참고 데이터 기반 + 논리적 확장만`
    : `🌐 Google에서 "${keyword}"를 검색하여 최신 정보를 찾은 뒤, 검색 결과에서 발견한 실제 데이터(숫자, 사례, 공식 정보)를 기반으로 작성하세요.\n검색에서 확인한 팩트만 사용하고, 추측이나 허위 정보를 작성하지 마세요.`;

  // 📝 내부 일관성 모드 — 단일 글 정보 전달 구조 (시리즈 지시 제거)
  const internalModePromptBlock = contentMode === 'internal' ? `

📝📝📝 [내부 일관성 모드 — 체계적 정보 전달] 📝📝📝

🎯 **"${keyword}" 주제를 체계적으로 전달하는 완결형 글을 작성합니다.**

🔴🔴🔴 **핵심 규칙**:
1. **일관된 톤**: 지식을 나누는 선배 같은 따뜻하고 전문적인 톤
2. **자기 완결성**: 이 한 편의 글만 읽어도 주제를 이해할 수 있게 작성
3. **연결 문구 절대 금지**: "지난번에", "이전 글에서", "다음 편에서", "다음 장" 등 존재하지 않는 글을 언급하는 모든 표현 금지!
4. **현재 시점 집중**: 오직 이 글의 주제만 다루며, 가공의 시리즈 맥락을 만들지 마세요

📝 **섹션 구조 가이드**:
- 각 H2는 핵심 지식을 독립적으로 전달
- 구체적 수치/데이터/사례를 풍부하게 활용
- 불릿 포인트와 표로 가독성 극대화

🔥 **톤 규칙**:
- "~해요", "~거든요" 친근하면서도 전문적인 말투
- 전체 글에서 동일한 깊이와 용어 일관성 유지

` : '';

  // 🛡️ 애드센스 승인 전용 E-E-A-T 프롬프트 블록
  const adsenseModePromptBlock = contentMode === 'adsense' ? `

🛡️🛡️🛡️ [애드센스 승인 전용 E-E-A-T 끝판왕 모드] 🛡️🛡️🛡️

🎯 **이 글은 Google 애드센스 승인을 목표로 합니다!**
2026년 Google 애드센스 승인 기준에 100% 부합하는 최고 품질의 글을 작성해야 합니다.

🔴🔴🔴 **애드센스 승인 핵심 규칙**:
1. **E-E-A-T 극대화**: Experience(경험), Expertise(전문성), Authoritativeness(권위), Trustworthiness(신뢰) 를 매 섹션에 녹여내세요.
2. **CTA/광고성 요소 완전 차단**: "바로가기", "신청하기", "다운로드" 같은 행동 유도 문구나 버튼 HTML 절대 금지!
3. **최소 6,000자 이상**: 전체 본문 순수 텍스트 기준 6,000자 이상으로 풍성하게 작성
4. **중립적/교육적 콘텐츠**: 상업적 의도가 전혀 보이지 않는 순수 정보 제공 글

📝 **7섹션 구조별 작성 가이드**:
- **섹션 1: 주제 소개** (350자+): 이 주제가 왜 중요한지, 독자가 이 글에서 얻을 수 있는 핵심 가치를 설명. "2026년 N월 기준" 날짜 필수. (허위 경력/자격 주장 금지!)
- **섹션 2: [주제] 완전히 이해하기** (1000자+): 핵심 개념 정의(초보자 눈높이) + 중요한 3가지 이유(데이터) + 흔한 오해 바로잡기 + 신뢰 출처 인용
- **섹션 3: 심층 분석** (1500자+): 검색에서 확인한 실제 데이터와 수치, 공식 출처 기반 인사이트, 구체적 팩트
- **섹션 4: 단계별 실행 가이드** (1000자+): Step 1~N 상세 설명, 각 단계 주의점, 문제 해결 방법
- **섹션 5: 비교 분석 및 추천** (1000자+): 장단점 공평 분석, 비교 표 포함, 객관적 추천
- **섹션 6: FAQ** (800자+): 실제 검색되는 질문 6-8개, 각 답변 2-4문장, 간결하고 정확
- **섹션 7: 마무리 및 추가 리소스** (1300자+): 핵심 3줄 요약, 신뢰 외부 출처 3~5개, 마지막 업데이트 날짜

🚫🚫🚫 **애드센스 모드 절대 금지**:
- ❌ CTA 버튼/박스 HTML (button, 바로가기 링크 등)
- ❌ 상업적 문구 ("지금 신청하세요", "무료 다운로드" 등)
- ❌ 외부 서비스 홍보 (앱, 커머스 등)
- ❌ 추측이나 허위 정보 (모든 정보는 검증된 데이터 기반)
- ❌ 애니메이션/인터랙티브 CSS (hover 효과 포함)

` : '';

  // 🛍️ 쇼핑/구매유도 모드 전용 프롬프트 블록
  const shoppingModePromptBlock = contentMode === 'shopping' ? `

🛍️🛍️🛍️ [쇼핑/구매유도 끝판왕 모드 — 7단계 구매 퍼널] 🛍️🛍️🛍️

🎯 **이 글은 구매 전환을 목표로 합니다!** 독자가 자연스럽게 구매를 결심하도록 7단계 퍼널로 구성하세요.

🔴🔴🔴 **쇼핑 모드 핵심 규칙**:
1. **10년 경력 쇼핑몰 MD 페르소나**: 제품의 본질을 꿰뚫는 전문가 시점
2. **구매 심리 자극**: FOMO(놓칠까봐 두려운 심리), 사회적 증거(후기/평점), 가격 앵커링
3. **시각적 비교**: 스펙 비교표, 장단점 표, 별점 바를 적극 활용

📝 **7단계 섹션별 가이드**:
- **① 도입 — 문제 인식 & 후킹** (800자+): 독자의 구매 고민을 정확히 짚어내는 공감 도입
- **② 제품 소개 & 핵심 스펙** (1200자+): 제품 스펙 카드 형태로 핵심 정보 정리, 경쟁 제품과 차별점
- **③ 비교 분석 & 선택 가이드** (1500자+): 비교 테이블 필수! A vs B vs C 구조, 용도별 추천
- **④ 실사용 후기 & 사회적 증거** (1200자+): 실제 사용 시나리오, 장단점 솔직 분석
- **⑤ 가격 & 구매 꿀팁** (1000자+): 할인 정보, 구매 시기, 가성비 분석
- **⑥ FAQ & 구매 저항 해소** (800자+): 실제 구매 전 궁금한 질문 5-7개
- **⑦ 최종 구매 유도 & CTA** (500자+): 명확한 결론과 행동 유도

🎨 **필수 시각 요소** (tables 필드 활용):
- 제품 스펙 비교표 (최소 1개)
- 장단점 정리 표 (최소 1개)
` : '';

  // 🔄 페러프레이징 모드 전용 프롬프트 블록
  const draftReference = contentMode === 'paraphrasing' && draftContent
    ? `\n===== 원본 초안 (페러프레이징 대상) =====\n${draftContent.slice(0, 8000)}\n=====\n`
    : '';

  const paraphrasingModePromptBlock = contentMode === 'paraphrasing' ? `

🔄🔄🔄 [페러프레이징 끝판왕 모드 — 원문 완전 재구성] 🔄🔄🔄

🎯 **목표: 원문 유사도 0% + 검색 순위 더 높게!**
${draftContent ? '위의 ===== 원본 초안 ===== 을 기반으로 완전히 새로운 글을 작성하세요.' : '키워드를 기반으로 기존 글과 중복되지 않는 완전히 새로운 글을 작성하세요.'}

🔴🔴🔴 **페러프레이징 핵심 규칙**:
1. **문장 구조 85%+ 변경**: 원문의 문장 구조를 완전히 뒤집으세요 (능동↔수동, 주어 변경, 문장 합치기/쪼개기)
2. **어휘 75%+ 교체**: 동의어, 유의어로 전면 교체. 전문 용어만 유지
3. **새로운 콘텐츠 25-35% 추가**: 원문에 없는 새로운 인사이트, 데이터, 사례를 추가
4. **구조적 재편성**: 섹션 순서, 논리 흐름을 원문과 완전히 다르게 재배치

📝 **6단계 재구성 가이드** (각 섹션 최소 800자):
- **① 핵심 개요**: 원문과 완전히 다른 도입부. 새로운 앵글에서 주제 접근
- **② 심층 분석**: 원문 내용을 심화하되, 새로운 데이터와 사례 추가
- **③ 다른 관점**: 원문과 다른 관점에서 주제 분석 (반대 의견, 다른 각도)
- **④ 체계적 정리**: 원문의 핵심을 유지하면서 완전히 다른 논리 구조로 재배치
- **⑤ 최신 트렌드 & 추가 정보**: 원문에 없는 최신 트렌드, 통계, 전문가 견해
- **⑥ 종합 결론**: 원문과 다른 결론. 새로운 통찰과 행동 유도

🚫 **절대 금지**: 원문 문장을 그대로 복사, 단순 단어 치환, 문장 순서만 바꾸기
` : '';

  // 🌐 SEO 최적화(외부 크롤링) 모드 — 검색 의도 기반 아키타입
  const externalModePromptBlock = (contentMode === 'external' || !contentMode) ? `

🌐🌐🌐 [SEO 최적화 모드 — 검색 의도 기반 정보 전달] 🌐🌐🌐

🎯 **이 글의 목표: Google 검색 상위 노출 + 검색자의 의도 완벽 충족**

🔴🔴🔴 **SEO 모드 핵심 규칙**:
1. **검색 의도 파악**: "${keyword}"가 정보형(무엇인지 알고 싶다)·탐색형(비교하고 싶다)·거래형(구매/실행하고 싶다) 중 어느 의도인지 판단하여 구조를 맞추세요
2. **두괄식 답변**: 각 H2 첫 문단에서 검색자가 찾는 핵심 답을 즉시 제공 (스크롤 없이 답 노출)
3. **구체성 = 신뢰**: 두루뭉술한 일반론 금지. 숫자·사례·출처를 매 섹션에 주입
4. **다양한 H2 아키타입 혼용**: [정의형] [비교분석형] [가이드형] [체크리스트형] [데이터형] 등을 섞어 단조로움 제거

📝 **검색 의도별 권장 구조**:
- **정보형 (~이란? ~뜻)**: 정의 → 원리 → 적용 → 주의점
- **탐색형 (~추천, ~비교)**: 기준 → 비교표 → 장단점 → 용도별 추천
- **거래형 (~사는 법, ~하는 법)**: 준비 → 절차 → 주의사항 → 대안

🚫 **SEO 모드 금지**: 구매 명령형 CTA ("지금 사세요"), 과장 표현 ("최고", "무조건"), 개인 경험 허위 서술
` : '';

  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const prompt = `
🎯 키워드: ${keyword}

📅 오늘 날짜: ${todayStr}
⚠️ 날짜 규칙: 오늘(${todayStr}) 이전에 마감된 사업/이벤트/일정은 언급하지 마세요. 현재 진행 중이거나 미래 일정만 다루세요. 과거 데이터를 인용할 때는 "~기준"을 반드시 명시하세요.
⚠️ 언어 규칙: 반드시 한국어 한글과 영문/숫자만 사용하세요. 중국어 한자(漢字), 일본어는 절대 사용 금지!

📌 구성해야 할 요소:
1. 글 전체의 서론 (Introduction)
2. H2 소제목 리스트에 따른 본문 섹션들
${h2List}
3. 글 전체의 결론 (Conclusion)

${contentMode === 'paraphrasing' && draftContent ? draftReference : contentReference}
${contentMode === 'paraphrasing' && draftContent ? '' : draftReference}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴🔴🔴 **[모드별 최우선 지시]** — 아래 모드 규칙이 이후 모든 일반 지시보다 우선입니다
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${externalModePromptBlock}${internalModePromptBlock}${adsenseModePromptBlock}${shoppingModePromptBlock}${paraphrasingModePromptBlock}${sectionGuideBlock || ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴🔴🔴 [10억 점 ${
  contentMode === 'adsense' ? '전문 정보/E-E-A-T'
  : contentMode === 'shopping' ? '쇼핑 전환'
  : contentMode === 'internal' ? '내부 일관성 정보 전달'
  : contentMode === 'paraphrasing' ? '페러프레이징 재구성'
  : '검색 의도 기반 SEO'
} 블로그 완벽 작성 가이드 (일반 규칙)] 🔴🔴🔴

[1. 가독성(Readability)의 극한화 - 체류시간 폭발]
- **초단문 지향**: 모바일 독자를 위해 한 문장은 절대 2~3줄을 넘지 않게 짧게 끊어 치세요. (호흡을 짧게)
- **시각적 여백 (Breathing Space)**: 단락(Paragraph)은 최대 3~4문장 단위로 무조건 줄바꿈(<p>)을 넣어 텍스트 벽(Wall of Text) 현상을 완벽히 방지하세요.
- **소분류 활용**: 글 중간중간 글머리 기호(<ul>, <li>)나 숫자 리스트를 적어도 1회 이상 섞어서 가독성을 극대화하세요.
- **핵심 정보 선배치 (두괄식)**: 각 H3 섹션의 첫 문단에서 가장 중요한 결론/인사이트를 먼저 때리고 시작하세요.

[2. '진짜 사람' 같은 극사실적 어조(Ultra-Human Tone)]
- **완벽한 구어체 전환**: 기계 번역투, AI 특유의 장황한 설명체("중요한 사실입니다", "다양한 이점이 있습니다") 철저히 배제.
- **디테일한 공감**: "많이들 헷갈리시죠?", "이 부분이 가장 중요한 포인트예요" 와 같이 독자와 공감하는 어조를 사용하세요. 단, 직접 경험하지 않은 것을 경험한 것처럼 쓰지 마세요.
- **결론부 여운 강화 (Conclusion)**: 서론은 300~500자로 매력적인 훅(Hook)을 넣고, 결론은 200~400자로 뻔한 인사말("도움이 되셨길 바랍니다") 대신 ${contentMode === 'adsense' ? '핵심 요약과 추가 학습 리소스 제안으로 교육적으로 클로징하세요. CTA/행동 유도 문구는 절대 금지!' : '명확한 Next Action(다음 행동 유도)이나 꿀팁으로 강력하게 클로징하세요.'}

[3. SEO 정보 밀도(Density)와 신뢰성(Trust) 극대화]
- **밀도 높은 데이터 주입**: 두루뭉술한 표현 -> 구체적인 표현으로 치환. 단, 숫자/통계는 반드시 Google 검색에서 확인한 실제 데이터만 사용! 출처를 알 수 없는 숫자는 절대 만들어내지 마세요.
- **[전문가의 팁] 마이크로 요소**: 각 H2마다 본문 흐름 중 최소 1번은 시선을 확 끄는 인용구 <blockquote> (예: "앗, 여기서 꿀팁 한 가지!" 또는 "실전 주의사항:")를 배치하여 체류시간을 높이세요.
- 🔴 절대금지: 본문에 "20년차", "1억", "전문가" 등 작가의 자격증명/거짓 이력을 언급하지 마세요! E-E-A-T는 글의 구체성에서 나옵니다.

[4. 본문(H3) 구조 및 길이 규칙]
- **각 H3 본문은 반드시 ${contentMode === 'shopping' || contentMode === 'adsense' || contentMode === 'paraphrasing' ? '800~1500자' : '600~1000자'}** 사이의 알찬 내용으로 채우세요.
- 같은 내용 반복 절대 금지. 모든 H3는 독립적이고 100% 새로운 인사이트로 채우세요.
- "결론적으로", "정리하면", "요약하면" 등 기계적인 반복 연결사 금지.

🔥 [표 & 체크리스트 활용 지침 - 스크롤 늦추기]
- 중요한 스펙, 가격, 단계, 장단점 등은 글로만 서술하지 말고 표(Table)나 체크리스트로 정리하세요.
- 각 H3마다 필요하다면 1개 정도의 표를 포함할 수 있습니다. (JSON 구조의 "tables" 필드에 데이터 넣기)
- **독자가 눈으로 멈춰서 한 번 더 읽게 만드는 것이 목표입니다.**

🔥 [H3 본문 다양화 지침]
- 딱딱한 5단계 구조를 버리고, **섹션의 성격에 맞게 톤과 구조를 다양하게** 섞으세요!
- 예시 아키타입:
  1. [가이드/절차형]: 구체적인 스텝바이스텝.
  2. [비교분석형]: A와 B의 장단점, 나에게 맞는 선택.
  3. [체이스크리스트형]: 확인해야 할 필수 항목들 나열 및 점검.
  4. [스토리텔링형]: 개인적인 공감대에서 시작해 팩트로 넘어가는 자연스러운 구성.
  5. [데이터 전달형]: 정확한 수치와 팩트를 중심으로 한 신뢰감 있는 전개.

🚫🚫🚫 [AI티 제거 - 최우선!] 🚫🚫🚫
⛔ 본문 content에 이모지 사용 절대 금지! (🔥💡📋✅💎👉 등 모든 이모지!)
⛔ 문단 앞에 라벨/접두어 붙이기 금지! ("후킹:", "핵심:", "실전:" 등)
⛔ 번호 이모지 금지! (1️⃣, 2️⃣ 등)
⛔ 글 흐름을 끊는 어떤 마커도 금지!
⛔ h3Sections[].content 안에 <h1>, <h2>, <div>, <img>, <button>, <a href="구매">, <iframe>, <script>, <form>, <input> 태그 출력 절대 금지!
   - H2는 시스템이 자동 삽입함
   - 상품 카드/가격 표시/구매 버튼 HTML 절대 생성 금지 (시스템이 별도 블록으로 렌더)
   - content는 오직 <p>, <ul>, <ol>, <li>, <blockquote>, <table>, <thead>, <tbody>, <tr>, <th>, <td>, <strong>, <em>, <br> 만 허용!
⛔ 상품 링크 필요 시 <a href="..."> 텍스트 </a> 형태로만 (스타일/버튼/이미지 포함 금지)
⛔ content 첫머리에 "1. ", "2. " 같은 숫자 접두어 금지! H2 번호는 시스템이 자동 부여함.
✅ 순수한 텍스트로만 자연스럽게 작성!

🚫 [금지 사항] - 필수 준수!
- 150자 이하의 빈약한 문단
- "~입니다", "~합니다" 딱딱한 말투 (→ "~해요", "~거든요"로)
- 근거 없는 과장 ("최고", "완벽", "무조건")
- 🔴🔴🔴 절대금지: "다음은", "다음 장에서", "넘어가서", "굳혀볼게요" 등 섹션 연결 문구!
- 각 블록은 독립적으로 완결되어야 함 - 다른 섹션 언급 금지!

JSON 형식 (이 구조 정확히 따르기!):
{
  "introduction": "<p>서론 내용 1</p><p>서론 내용 2...</p>",
  "conclusion": "<p>결론 내용 1</p><p>행동 유도 등...</p>",
  "sections": [
    {
      "h2": "첫 번째 H2 제목",
      "h3Sections": [
        {"h3": "10~15자 H3 제목", "content": "<p>위 다채로운 본문 포맷 중 하나를 선택해 충분한 분량으로 작성</p>...", "tables": []}
      ]
    },
    ...총 ${h2Titles.length}개의 H2
  ]
}

🚨🚨🚨 최종 체크리스트 (10억 점 기준) 🚨🚨🚨
□ 모바일 가독성을 위해 문장이 짧고 단락 구분이 확실한가? (<p> 떡칠 방지, 여백 최적화)
□ "많이들 헷갈리시죠?" 같은 진짜 사람이 쓴 듯한 구어체가 묻어나는가?
□ 각 H3 본문당 글자 수가 ${contentMode === 'shopping' || contentMode === 'adsense' || contentMode === 'paraphrasing' ? '800자 이상 1500자 이내' : '600자 이상 1000자 이내'}(충분한 분량)인가?
□ 중간중간 독자의 스크롤을 멈출 <blockquote> 꿀팁 박스와 <ul> 리스트가 존재하는가?
□ 서론과 결론이 기계적이지 않고, 매력적인 훅과 네비게이션 역할을 하는가?

🔴🔴🔴 **상단의 [모드별 최우선 지시] 블록이 이 일반 규칙보다 우선합니다.** 섹션별 상세 지시(필수 요소, 역할, 최소 글자수)가 있다면 반드시 해당 H2 섹션에 그대로 적용하세요.

JSON만 출력 (설명/마크다운 금지):
`;

  const extractJsonObject = (text: string): string => {
    const cleaned = (text || '').trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
      return cleaned.slice(first, last + 1);
    }
    return cleaned;
  };

  const countParagraphs = (html: string): number => {
    const matches = (html || '').match(/<p[\s>]/gi);
    return matches ? matches.length : 0;
  };

  const textLength = (html: string): number => {
    return (html || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim().length;
  };

  try {
    onLog?.('[PROGRESS] 50% - 🤖 AI 본문 생성 중...');
    let response = await callGeminiWithGrounding(prompt);
    let json = extractJsonObject(response);

    let allSectionsObj: {
      introduction: string;
      conclusion: string;
      sections: Array<{
        h2: string;
        h3Sections: Array<{ h3: string; content: string; tables: FinalTableData[]; cta?: FinalCTAData }>;
      }>;
    };

    try {
      allSectionsObj = JSON.parse(json);
    } catch (e) {
      onLog?.('[PROGRESS] 50% - 🔁 JSON 파싱 실패, 1회 재시도...');
      const retryPrompt = `${prompt}\n\nIMPORTANT: Return ONLY a valid JSON object starting with { and ending with }. No markdown, no code fences, no extra text.`;
      response = await callGeminiWithGrounding(retryPrompt);
      json = extractJsonObject(response);
      allSectionsObj = JSON.parse(json);
    }

    onLog?.('[PROGRESS] 65% - ✅ AI 본문 생성 완료!');

    const flat = (allSectionsObj.sections || []).flatMap(s => (s.h3Sections || []).map(h => h.content || ''));
    // 🔥 품질 기준 강화: 500자 이상, 4문단 이상
    const lowQualityCount = flat.filter(c => textLength(c) < 500 || countParagraphs(c) < 4).length;
    const totalCount = flat.length || 1;
    const lowQualityRatio = lowQualityCount / totalCount;

    // 🔥 30% 이상 저품질이면 보강
    if (lowQualityRatio >= 0.30) {
      onLog?.('[PROGRESS] 65% - 🔁 본문 품질 보강 중 (1회 호출)...');
      const improvePrompt = `
키워드: ${keyword}
아래 JSON은 블로그 본문 초안입니다. **품질이 낮아서 보강이 필요합니다!**

🔴🔴🔴 필수 보강 규칙 🔴🔴🔴
1) JSON 구조(객체/필드명)는 그대로 유지
2) 각 H3의 content를 **600~1000자**로 확장 (현재 너무 짧음!)
3) 각 content는 **<p> 태그 5개** 필수
4) 중복 표현/반복 멘트 완전 제거
5) 숫자/통계는 Google 검색에서 확인된 실제 데이터만 사용! 출처 불명 숫자 만들기 금지!
6) 직접 경험하지 않은 것을 경험한 것처럼 쓰지 마세요
7) 한글과 영문/숫자만 사용. 중국어 한자(漢字) 절대 금지!

🔥 [H3 본문 다양화 지침]
- 딱딱한 5단계 구조를 버리고, **섹션의 성격에 맞게 톤과 구조를 다양하게** 섞으세요!
- 예시 아키타입:
  1. [가이드/절차형]: 구체적인 스텝바이스텝.
  2. [비교분석형]: A와 B의 장단점, 나에게 맞는 선택.
  3. [체크리스트형]: 확인해야 할 필수 항목들 나열 및 점검.
  4. [스토리텔링형]: 개인적인 공감대에서 시작해 팩트로 넘어가는 자연스러운 구성.
  5. [데이터 전달형]: 정확한 수치와 팩트를 중심으로 한 신뢰감 있는 전개.

📝 톤 규칙:
- "~해요", "~거든요" 친근한 말투
- 전문성이 느껴지면서 친근한 톤
- 체류시간 5분 이상 유지할 수 있는 흡인력

===== 참고 크롤링 데이터 =====
${reference.slice(0, 8000)}
=====

===== 보강할 JSON =====
${JSON.stringify(allSectionsObj)}
=====

🚨 주의: 각 H3 content가 600자 미만이면 실패입니다! 중요 문장에 <strong> 및 <mark> 태그를 적극 활용하세요.

JSON만 출력:
`;
      const improved = await callGeminiWithGrounding(improvePrompt);
      const improvedJson = extractJsonObject(improved);
      allSectionsObj = JSON.parse(improvedJson);
      onLog?.('[PROGRESS] 65% - ✅ 본문 보강 완료!');
    }

    // 결과 정규화 및 에디팅 톤 변환
    return {
      introduction: allSectionsObj.introduction || '',
      conclusion: allSectionsObj.conclusion || '',
      sections: (allSectionsObj.sections || []).map((sec, idx) => ({
        h2: (h2Titles[idx] || sec.h2 || '').replace(/[\u4E00-\u9FFF\u3400-\u4DBF]/g, ''),
        h3Sections: (sec.h3Sections || []).map(h3Sec => ({
          h3: (h3Sec.h3 || '').replace(/[\u4E00-\u9FFF\u3400-\u4DBF]/g, ''),
          content: (h3Sec.content || '')
            // 🛡️ AI가 본문에 H1/H2 태그를 직접 출력하는 경우 강제 제거 (H2 번호 사라짐 버그 방지)
            .replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '')
            .replace(/<h2[^>]*>[\s\S]*?<\/h2>/gi, '')
            // 친근한 말투 변환
            .replace(/입니다\./g, '이에요.')
            .replace(/습니다\./g, '어요.')
            .replace(/합니다\./g, '해요.')
            .replace(/있습니다\./g, '있어요.')
            .replace(/없습니다\./g, '없어요.')
            // 🔥 AI티 나는 이모지 접두어 제거
            .replace(/🔥후킹:\s*/g, '')
            .replace(/💡핵심:\s*/g, '')
            .replace(/📋실전:\s*/g, '')
            .replace(/✅사례:\s*/g, '')
            .replace(/💎마무리:\s*/g, '')
            .replace(/👉브릿지:\s*/g, '')
            .replace(/🔥\s+/g, '')
            .replace(/💡\s+/g, '')
            .replace(/📋\s+/g, '')
            .replace(/✅\s+/g, '')
            .replace(/💎\s+/g, '')
            .replace(/1️⃣\s*/g, '')
            .replace(/2️⃣\s*/g, '')
            .replace(/3️⃣\s*/g, '')
            .replace(/4️⃣\s*/g, '')
            .replace(/5️⃣\s*/g, '')
            // 🔥 다음섹션 안내 문구 완전 제거
            .replace(/👉\s*다음은[^]*?굳혀볼게요\./g, '')
            .replace(/👉\s*다음은[^]*?넘어가서[^]*?\./g, '')
            .replace(/👉[^<]*넘어가[^<]*/g, '')
            .replace(/👉[^<]*굳혀볼게요[^<]*/g, '')
            .replace(/다음은[^<]*넘어가서[^<]*굳혀볼게요\./g, '')
            .replace(/\"어떻게\"를 실제 실행 단계로 굳혀볼게요\./g, '')
            .replace(/체류시간\s*→\s*신뢰\s*→\s*수익/g, '')
            .replace(/노출→클릭→체류→전환/g, '')
            .replace(/<p>\s*<\/p>/g, '')
            // 한자(漢字) → 한글 변환 (AI가 가끔 한자를 출력하는 문제)
            .replace(/解答/g, '해답').replace(/質問/g, '질문').replace(/方法/g, '방법')
            .replace(/完璧/g, '완벽').replace(/説明/g, '설명').replace(/活用/g, '활용')
            .replace(/重要/g, '중요').replace(/必要/g, '필요').replace(/可能/g, '가능')
            .replace(/問題/g, '문제').replace(/結果/g, '결과').replace(/情報/g, '정보')
            .replace(/支援/g, '지원').replace(/申請/g, '신청').replace(/確認/g, '확인')
            .replace(/製造/g, '제조').replace(/導入/g, '도입').replace(/自動/g, '자동')
            // 남은 CJK 한자 일괄 제거 (한글/영문/숫자/기본 기호만 유지)
            .replace(/[\u4E00-\u9FFF\u3400-\u4DBF]/g, ''),
          tables: parseTables((h3Sec as any).tables)
        }))
      }))
    };

  } catch (e) {
    // 🚨 LLM 실패 시 폴백을 사용하면 H2 N개가 모두 동일 보일러플레이트로 채워져
    //    SEO/UX 모두 치명적. 사일런트 페일 대신 명시적으로 throw하여 사용자가
    //    재시도하거나 LLM 키/할당량을 점검하도록 유도.
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error('[generateAllSectionsFinal] LLM 섹션 생성 실패:', errMsg);
    onLog?.(`[PROGRESS] 50% - ❌ LLM 섹션 생성 실패: ${errMsg.slice(0, 200)}`);
    onLog?.('[PROGRESS] 50% - 💡 가능한 원인: LLM API 키 누락/만료, 할당량 초과, 네트워크 오류, JSON 파싱 실패');
    throw new Error(
      `섹션 콘텐츠 생성 실패: ${errMsg}\n` +
      `폴백 콘텐츠는 모든 H2가 동일 보일러플레이트가 되어 SEO/UX에 치명적이므로 발행을 차단합니다.\n` +
      `대처: ① API 키 확인 (Gemini/OpenAI/Perplexity) ② 할당량 확인 ③ 키워드 단순화 후 재시도`
    );
  }
}

// 🔥 FAQ 생성 함수 -- Schema.org FAQPage 마크업 포함
export async function generateFAQFinal(
  keyword: string,
  h2Titles: string[],
  onLog?: (s: string) => void
): Promise<FAQItem[]> {
  const faqToday = new Date().toISOString().slice(0, 10);
  const prompt = `
키워드: ${keyword}
📅 오늘 날짜: ${faqToday}

H2 섹션 제목:
${h2Titles.map((h, i) => `${i + 1}. ${h}`).join('\n')}

위 블로그 글에 대해 독자가 실제로 궁금해할 자주 묻는 질문(FAQ) 5개를 만들어주세요.

🔴 반드시 Google 검색으로 "${keyword}"에 대한 최신 정보를 확인한 후 답변하세요!

규칙:
1. 질문은 실제 검색어처럼 자연스럽게 (예: "${keyword} 비용이 얼마인가요?")
2. 답변은 3~4줄로 핵심만 간결하게
3. 답변에 구체적인 숫자/기간/금액 포함 — 반드시 검색에서 확인한 실제 데이터만 사용!
4. 본문 내용과 중복되지 않는 추가 정보 위주
5. "~해요", "~거든요" 친근한 말투
6. 이미 마감된 사업/이벤트/일정은 답변에 포함 금지. 현재 진행 중이거나 미래 일정만!
7. 한글과 영문/숫자만 사용. 중국어 한자(漢字) 절대 금지!
8. 🔴 추측/허위 데이터 절대 금지! 확인할 수 없는 숫자는 쓰지 마세요.

JSON 형식:
[
  {"question": "질문1", "answer": "답변1"},
  {"question": "질문2", "answer": "답변2"},
  ...총 5개
]

JSON만 출력:
`;

  try {
    onLog?.('[PROGRESS] 67% - ❓ FAQ 생성 중...');
    const response = await callGeminiWithGrounding(prompt);
    const cleaned = (response || '').trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const first = cleaned.indexOf('[');
    const last = cleaned.lastIndexOf(']');
    if (first === -1 || last === -1 || last <= first) throw new Error('No JSON array found');

    const items: FAQItem[] = JSON.parse(cleaned.slice(first, last + 1));
    const cjkRegex = /[\u4E00-\u9FFF\u3400-\u4DBF]/g;
    const valid = items
      .map(f => ({
        question: (f.question || '').replace(cjkRegex, ''),
        answer: (f.answer || '').replace(cjkRegex, ''),
      }))
      .filter(f => typeof f.question === 'string' && typeof f.answer === 'string' && f.question.length > 5 && f.answer.length > 10)
      .slice(0, 7);

    if (valid.length < 3) throw new Error(`Too few valid FAQs: ${valid.length}`);
    onLog?.(`[PROGRESS] 68% - ✅ FAQ ${valid.length}개 생성 완료`);
    return valid;
  } catch (e) {
    console.error('[generateFAQFinal] FAQ 생성 실패:', e);
    onLog?.('[PROGRESS] 68% - ⚠️ FAQ 생성 실패, 기본 FAQ 사용');
    // 폴백: 키워드 기반 기본 FAQ
    return [
      { question: `${keyword}이/가 정확히 무엇인가요?`, answer: `${keyword}에 대한 자세한 내용은 위 본문에 정리해 두었어요. 핵심 개념부터 확인해보시면 이해가 빠를 거예요.` },
      { question: `${keyword} 시작하려면 어떻게 해야 하나요?`, answer: `위 본문의 단계별 가이드를 참고해주세요. 공식 사이트에서 최신 정보를 확인하시는 것도 추천드려요.` },
      { question: `${keyword} 관련해서 주의할 점이 있나요?`, answer: `기본 개념을 먼저 확인한 후 진행하시는 걸 추천드려요. 자세한 주의사항은 위 본문을 참고해주세요.` },
    ];
  }
}

// 🔥 FAQ HTML + Schema.org 마크업 생성
export function buildFAQHtml(faqs: FAQItem[]): string {
  if (!faqs || faqs.length === 0) return '';

  // Schema.org FAQPage 구조화 데이터
  const schemaJson = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': faqs.map(f => ({
      '@type': 'Question',
      'name': f.question,
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': f.answer
      }
    }))
  });

  const faqItems = faqs.map(f => `
  <details style="margin-bottom:12px !important;border:1px solid #e8e8e8 !important;border-radius:10px !important;overflow:hidden !important;background:#fff !important;">
    <summary style="padding:16px 20px !important;font-size:16px !important;font-weight:700 !important;color:#222 !important;-webkit-text-fill-color:#222 !important;cursor:pointer !important;list-style:none !important;display:flex !important;align-items:center !important;gap:10px !important;">
      <span style="color:#0066FF !important;-webkit-text-fill-color:#0066FF !important;font-size:18px !important;flex-shrink:0 !important;">Q.</span>
      <span style="flex:1 !important;line-height:1.5 !important;">${f.question}</span>
      <span style="color:#999 !important;-webkit-text-fill-color:#999 !important;font-size:12px !important;flex-shrink:0 !important;">▼</span>
    </summary>
    <div style="padding:0 20px 16px 20px !important;font-size:15px !important;line-height:1.8 !important;color:#444 !important;-webkit-text-fill-color:#444 !important;border-top:1px solid #f0f0f0 !important;">
      <p style="margin:12px 0 0 !important;">${f.answer}</p>
    </div>
  </details>`).join('\n');

  return `
<div style="margin:48px 0 32px !important;padding:0 !important;display:block !important;visibility:visible !important;">
  <h2 style="font-size:22px !important;font-weight:800 !important;color:#111 !important;-webkit-text-fill-color:#111 !important;margin:0 0 20px !important;padding:0 0 14px 16px !important;border-bottom:2px solid #111 !important;border-left:5px solid #0066FF !important;line-height:1.4 !important;">자주 묻는 질문 (FAQ)</h2>
  ${faqItems}
</div>
<script type="application/ld+json">${schemaJson}</script>
`;
}

// 🔥 H2 전체 섹션을 한 번에 생성하는 최적화 함수 (호환성 유지)
export async function generateH2SectionFinal(
  h2: string,
  h3s: string[],
  keyword: string,
  crawledContents: string[],
  isFirst: boolean = false,
  isLast: boolean = false
): Promise<Array<{ h3: string; content: string; tables: FinalTableData[] }>> {
  const reference = crawledContents.join('\n\n').slice(0, 4000);

  // 🔥 위치에 따른 스타일
  let styleGuide = '';
  if (isFirst) {
    styleGuide = '첫 섹션: 바로 본론으로 시작. 도입부 멘트 금지.';
  } else if (isLast) {
    styleGuide = '마지막 섹션: 자연스러운 마무리 가능.';
  } else {
    styleGuide = '중간 섹션: 본론만 작성.';
  }

  const h3List = h3s.map((h3, i) => `${i + 1}. ${h3}`).join('\n');

  const prompt = `
키워드: ${keyword}
소제목: ${h2}
스타일: ${styleGuide}

===== 크롤링 데이터 (참고만) =====
${reference}
=====

===== H3 목록 =====
${h3List}
=====

🔴 각 H3마다 400~500자 본문을 작성하세요.

필수 규칙:
1. 크롤링 데이터의 팩트만 사용 (추측 금지)
2. 친근한 말투 (~해요, ~거든요)
3. 딱딱한 문어체 금지 (~이다, ~한다)
4. 각 H3는 서로 다른 내용으로 작성

JSON 형식으로 출력:
[
  {
    "h3": "첫 번째 소제목",
    "content": "<p>첫 문단...</p><p>두 번째 문단...</p>"
  },
  ...
]

JSON만:
`;

  try {
    const response = await callGeminiWithGrounding(prompt);
    const json = response.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const sections = JSON.parse(json) as Array<{ h3: string; content: string }>;

    // 결과 반환 (표 생성 없이 빠르게)
    return sections.map((sec, idx) => {
      let content = sec.content
        .replace(/입니다\./g, '이에요.')
        .replace(/습니다\./g, '어요.')
        .replace(/합니다\./g, '해요.')
        .replace(/있습니다\./g, '있어요.')
        .replace(/없습니다\./g, '없어요.');

      return {
        h3: h3s[idx] || sec.h3,
        content,
        tables: []
      };
    });
  } catch (e) {
    // 폴백: 기본 콘텐츠 생성
    console.warn('[generateH2SectionFinal] JSON 파싱 실패, 기본 콘텐츠 사용');
    return h3s.map(h3 => ({
      h3,
      content: `<p>${keyword}의 ${h3}에 대해 정리해드릴게요. 자세한 내용은 공식 사이트에서 최신 정보를 확인해주세요.</p>`,
      tables: []
    }));
  }
}

export async function generateH3ContentFinal(
  h2: string,
  h3: string,
  keyword: string,
  crawledContents: string[],
  position: 'first' | 'middle' | 'last' = 'middle',
  previousFirstSentences: string[] = []
): Promise<{ content: string; tables: FinalTableData[] }> {
  // 🔥 배치 생성으로 대체 - 이 함수는 호환성을 위해 유지
  const reference = crawledContents.join('\n\n').slice(0, 2000);

  const h3Today = new Date().toISOString().slice(0, 10);
  const prompt = `
키워드: ${keyword}
소제목: ${h3}
📅 오늘: ${h3Today}
참고: ${reference.slice(0, 1500)}

${h3}에 대해 400자 내외로 작성하세요.
- 친근한 말투 (~해요, ~거든요)
- p태그 2~3개
- Google 검색으로 확인한 최신 정보 기반. 추측/허위 데이터 금지!
- 마감된 사업/이벤트 언급 금지. 현재 진행 중이거나 미래 일정만!
- 한글/영문/숫자만 사용. 중국어 한자 금지!

HTML만:
`;

  let content = await callGeminiWithGrounding(prompt);
  content = content.trim()
    .replace(/^```html\n?/gi, '').replace(/```$/gi, '')
    .replace(/입니다\./g, '이에요.')
    .replace(/습니다\./g, '어요.')
    .replace(/합니다\./g, '해요.');

  return { content, tables: [] };
}

// 🔍 Google CSE를 사용해 공식 사이트 찾기
async function searchOfficialSite(keyword: string, googleCseKey: string, googleCseCx: string, contentMode?: string): Promise<{ url: string; title: string } | null> {
  if (!googleCseKey || !googleCseCx) return null;

  try {
    // 🎯 모드별 쿼리 — 쇼핑 모드면 쇼핑 페이지를, 나머지는 공식 홈페이지를
    const query = contentMode === 'shopping'
      ? `${keyword} 최저가 구매`
      : `${keyword} 공식 홈페이지`;
    console.log(`[CTA] 🔍 ${contentMode === 'shopping' ? '쇼핑 페이지' : '공식 사이트'} 검색 시도: "${query}"`);

    const url = `https://www.googleapis.com/customsearch/v1?key=${googleCseKey}&cx=${googleCseCx}&q=${encodeURIComponent(query)}&num=5`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      console.log(`[CTA] ⚠️ 검색 결과 없음`);
      return null;
    }

    // 🎯 모드별 신뢰 도메인
    const trustedDomains = contentMode === 'shopping'
      ? ['coupang.com', 'smartstore.naver.com', 'shopping.naver.com', '11st.co.kr', 'gmarket.co.kr', 'auction.co.kr', 'danawa.com', 'apple.com/kr', 'samsung.com', 'lg.com', 'brand.naver.com']
      : ['.go.kr', '.or.kr', '.ac.kr', '.re.kr', '.edu', '.gov', '.mil'];
    const excludeDomains = ['blog.naver.com', 'tistory.com', 'velog.io', 'brunch.co.kr', 'namu.wiki', 'wikipedia.org', 'youtube.com', 'facebook.com', 'instagram.com', 'twitter.com', 'kin.naver.com'];

    for (const item of data.items) {
      const link = item.link;
      const title = item.title;

      if (excludeDomains.some(d => link.includes(d))) continue;

      if (trustedDomains.some(d => link.includes(d))) {
        console.log(`[CTA] ✅ ${contentMode === 'shopping' ? '쇼핑 페이지' : '공식/신뢰 사이트'} 발견: ${link} (${title})`);
        return { url: link, title: title };
      }
    }

    // 신뢰 도메인을 못 찾았지만 첫 번째 결과가 제외 도메인이 아니라면 사용
    const firstItem = data.items[0];
    if (!excludeDomains.some(d => firstItem.link.includes(d))) {
      console.log(`[CTA] ✅ 대체 사이트 발견 (최상위 결과): ${firstItem.link}`);
      return { url: firstItem.link, title: firstItem.title };
    }

    return null;

  } catch (error) {
    console.error(`[CTA] ❌ 공식 사이트 검색 중 오류:`, error);
    return null;
  }
}

// 🔥 본문에 스마트 링크 삽입 (인라인 링크)
export function applySmartLinkToContent(content: string, keyword: string, officialLink: string): string {
  if (!officialLink || !content) return content;

  console.log(`[LINK] 🔗 본문 인라인 링크 작업 시작 (링크: ${officialLink})`);

  let newContent = content;
  let linkApplied = false;
  let replaceCount = 0;

  // 행위 키워드 목록
  const actionWords = ['신청', '조회', '예약', '접수', '확인', '바로가기', '홈페이지', '사이트', '가입', '다운로드'];

  // 1. "키워드 + 공백(옵션) + 행위" 패턴 우선 치환
  for (const action of actionWords) {
    if (replaceCount >= 3) break;

    const pattern = new RegExp(`(${keyword}\\s*${action}(?:하기|하러\\s*가기|방법)?)`, 'gi');

    newContent = newContent.replace(pattern, (match) => {
      if (replaceCount >= 3) return match;
      if (match.includes('</a>')) return match;

      replaceCount++;
      linkApplied = true;
      return `<a href="${officialLink}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: bold;">${match}</a>`;
    });
  }

  // 2. 만약 하나도 안 걸렸다면 키워드 단독 치환 (1회만)
  if (!linkApplied) {
    const keywordRegex = new RegExp(`${keyword}`, 'i');
    newContent = newContent.replace(keywordRegex, (match) => {
      linkApplied = true;
      return `<a href="${officialLink}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: bold;">${match}</a>`;
    });
  }

  if (linkApplied) {
    console.log(`[LINK] ✅ 본문에 공식 링크 인라인 삽입 완료 (${replaceCount}회)`);
  }

  return newContent;
}

// 📥 문서/자료 URL 감지 헬퍼 — 파일 확장자별 버튼/훅 텍스트 자동 결정
// AI가 반환한 버튼 텍스트가 문서 URL인데도 "사이트 바로가기" 같은 오류를 내는 경우를 방지
function detectDocumentCta(url: string): { isDoc: boolean; btnText: string; hookText: string } {
  const match = url.match(/\.(pdf|ppt|pptx|pps|ppsx|key|hwp|hwpx|xlsx|xls|ods|csv|tsv|zip|rar|7z|docx|doc|odt|rtf|txt|pages|numbers)(\?|#|$)/i);
  if (!match) return { isDoc: false, btnText: '', hookText: '' };
  const ext = match[1]!.toLowerCase();
  const typeLabel =
    ext === 'pdf' ? 'PDF 자료' :
    /^(ppt|pps|key)/.test(ext) ? '발표자료' :
    /^doc|^odt|^rtf|^txt|pages/.test(ext) ? '문서' :
    /^xls|^ods|csv|tsv|numbers/.test(ext) ? '엑셀 자료' :
    /^hwp/.test(ext) ? '한글파일' :
    /^(zip|rar|7z)/.test(ext) ? '압축파일' :
    '자료';
  return {
    isDoc: true,
    btnText: `📥 ${typeLabel} 다운받기`,
    hookText: `${typeLabel}를 다운받아 자세히 확인하세요!`,
  };
}

export async function generateCTAsFinal(
  keyword: string,
  crawledPosts: FinalCrawledPost[],
  generatedSections?: any[],
  contentMode?: string
): Promise<FinalCTAData[]> {
  // 🛡️ 애드센스 모드: CTA 완전 차단
  if (contentMode === 'adsense') {
    console.log('[CTA] 🛡️ 애드센스 모드 — CTA 생성 생략 (승인 정책 준수)');
    return [];
  }

  const encodedKeyword = encodeURIComponent(keyword);

  // 환경변수 로드
  const envData = loadEnvFromFile();
  const googleCseKey = envData['googleCseKey'] || envData['GOOGLE_CSE_KEY'] || (process.env as any)['GOOGLE_CSE_KEY'] || '';
  const googleCseCx = envData['googleCseCx'] || envData['GOOGLE_CSE_CX'] || (process.env as any)['GOOGLE_CSE_CX'] || '';

  const safeCTAs: FinalCTAData[] = [];

  // 🌐 1단계: Gemini Search Grounding으로 실질적 CTA URL 찾기!
  console.log(`[CTA] 🌐 Search Grounding으로 "${keyword}" 관련 실질적 CTA URL 검색 중...`);

  try {
    // 🎯 모드별 CTA 가이드 — 글 톤과 일치하는 CTA를 유도
    const modeCtaHint = contentMode === 'shopping' ? `
🛍️ **쇼핑 모드 CTA 특화 지시**:
- **우선**: 가격 비교/리뷰/실제 구매 가능한 이커머스 페이지 (쿠팡/네이버쇼핑/브랜드 공식몰/다나와 등)
- 검색어에 "후기/리뷰/비교"가 붙으면 비교 페이지 또는 신뢰도 높은 리뷰 랜딩 우선
- 버튼 예시: "🛒 최저가 비교하기", "💰 가격 확인하기", "⭐ 실구매 후기 보기", "🛍️ 공식몰 바로가기"
- 훅 예시: "실제 구매자들이 선택한 최저가를 확인하세요!", "솔직한 리뷰부터 가격까지 한눈에!"
- actionType 권장: buy 또는 info
` : contentMode === 'internal' ? `
📝 **내부 정보 전달 모드 CTA 특화 지시**:
- **우선**: 주제의 공식 리소스/가이드/정부 사이트 (교육·학습·참고용)
- 구매 명령형 지양. 학습/탐색을 돕는 톤
- 버튼 예시: "📚 공식 가이드 보기", "🔍 자세히 알아보기", "📖 원문 확인하기"
- 훅 예시: "더 깊이 있는 정보는 공식 자료에서 확인하세요"
- actionType 권장: info 또는 check
` : contentMode === 'paraphrasing' ? `
🔄 **페러프레이징 모드 CTA 특화 지시**:
- **우선**: 주제의 원 출처가 아닌 "독자가 실행할 수 있는" 공식 사이트/서비스
- 원문을 재구성했으므로 CTA도 원문과 다른 앵글의 랜딩 제시
- 버튼 예시: "🚀 바로 시작하기", "🔍 실시간 확인하기"
- actionType 권장: apply, check, 또는 info
` : `
🌐 **SEO/정보 제공 모드 CTA 특화 지시**:
- **우선**: 정부·공공·기관 공식 사이트 (신청/조회/예약/등록 가능한 페이지)
- 버튼 예시: "🚀 바로 신청하기", "🔍 실시간 조회하기", "📅 예약하기"
- actionType 권장: apply, check, 또는 reserve
`;

    const ctaPrompt = `
당신은 한국 블로그 독자를 위한 CTA(Call-to-Action) 전문가입니다.

🎯 키워드: "${keyword}"
📌 글 모드: ${contentMode || 'external (SEO)'}
⚠️ 한글/영문만 사용. 중국어 한자 금지! 존재하지 않는 서비스/혜택을 만들어내지 마세요!
${modeCtaHint}
🔴 **반드시 Google 검색으로** "${keyword}"에 대한 독자가 실제로 필요한 페이지를 찾으세요. (위 모드별 지시에 맞는 유형)

🔥 CTA는 "클릭하면 바로 해당 액션(구매/비교/신청/조회/예약 등)이 가능한 실질적 페이지"이어야 합니다!

❌ 절대 하지 말 것:
- 검색 결과 페이지 (search.naver.com, google.com/search 등) → 절대 금지!
- 블로그 글 (blog.naver.com, tistory.com 등) → 절대 금지!
- 404 에러, 존재하지 않는 페이지 → 절대 금지!
- URL을 추측하거나 만들어내기 → 절대 금지! 검색에서 확인한 것만!

✅ 좋은 CTA 예시 (모드별):
- 쇼핑: "아이폰 16" → https://www.apple.com/kr/iphone-16 또는 쿠팡/네이버쇼핑 상품 페이지
- SEO/정보: "청년도약계좌 신청" → https://www.kinfa.or.kr
- 정보/예약: "KTX 예약" → https://www.letskorail.com
- 내부/정보: "국민연금 제도" → https://www.nps.or.kr (제도 설명 페이지)

📋 아래 JSON 형식으로 **정확히 1개** 출력:
{
  "url": "검색에서 확인한 실제 URL (존재가 확인된 것만!)",
  "hookingMessage": "독자가 클릭하고 싶게 만드는 한 줄",
  "buttonText": "행동 유발 버튼 텍스트 (모드 톤에 맞게)",
  "actionType": "apply|check|reserve|buy|info 중 하나"
}

📥 **파일 URL 처리 규칙** (중요):
- URL 끝이 .pdf/.ppt/.pptx/.hwp/.xlsx/.docx/.zip 등 문서 확장자면:
  - buttonText: "📥 PDF 다운받기", "📥 발표자료 다운받기", "📥 한글파일 다운받기" 등 **다운로드 형식**으로 작성
  - hookingMessage: "자료를 다운받아 자세히 확인하세요" 같은 **다운로드 유도** 문구
  - actionType: "info" 사용
- 절대 문서 URL에 "사이트 바로가기", "홈페이지 바로가기" 같은 웹사이트용 텍스트 사용 금지!

🔴🔴🔴 핵심: URL은 **검색에서 실제로 확인한 것만** 사용! 추측 금지!
JSON만 출력:
`;

    const ctaResponse = await callGeminiWithGrounding(ctaPrompt);
    const cleanJson = ctaResponse.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');

    try {
      const cjkCta = /[\u4E00-\u9FFF\u3400-\u4DBF]/g;
      const ctaData = JSON.parse(cleanJson);
      if (ctaData.buttonText) ctaData.buttonText = ctaData.buttonText.replace(cjkCta, '');
      if (ctaData.hookingMessage) ctaData.hookingMessage = ctaData.hookingMessage.replace(cjkCta, '');

      if (ctaData.url && ctaData.url.startsWith('http')) {
        // 🔴 검색엔진 결과 페이지인지 체크
        const isSearchPage = /search\.(naver|google|daum|bing)\.com|google\.com\/search|m\.search/i.test(ctaData.url);
        const isBlogPage = /blog\.naver|tistory|brunch|velog|medium\.com|blogspot|wordpress\.com/i.test(ctaData.url);

        if (!isSearchPage && !isBlogPage) {
          // 🔀 하이브리드 검증: HTTP 1차 + (의심 시/엄격 모드) Perplexity AI 2차
          const isValid = await hybridValidateCta(ctaData.url, keyword, 5000);
          if (isValid) {
            // 📥 파일 다운로드 URL 감지 — AI가 반환한 텍스트보다 우선 (AI가 "사이트 바로가기"로 잘못 생성하는 케이스 방지)
            const doc = detectDocumentCta(ctaData.url);
            // 🎯 모드별 기본 버튼/훅 텍스트
            const modeDefaultButton = contentMode === 'shopping' ? `🛒 ${keyword} 최저가 확인`
              : contentMode === 'internal' ? `📚 ${keyword} 자세히 알아보기`
              : contentMode === 'paraphrasing' ? `🔍 ${keyword} 원문 확인하기`
              : `🔗 ${keyword} 바로가기`;
            const modeDefaultHook = contentMode === 'shopping' ? `실제 구매자들이 선택한 가격과 후기를 확인하세요!`
              : contentMode === 'internal' ? `더 깊이 있는 정보는 공식 자료에서 확인하세요`
              : contentMode === 'paraphrasing' ? `주제의 원 출처와 추가 자료를 살펴보세요`
              : `${keyword}에 대해 더 알아보세요!`;
            // 🔴 문서 URL이면 AI 텍스트 무시하고 강제로 다운로드 버튼 사용
            const finalButtonText = doc.isDoc
              ? doc.btnText
              : (ctaData.buttonText || modeDefaultButton);
            const finalHookMessage = doc.isDoc
              ? doc.hookText
              : (ctaData.hookingMessage || modeDefaultHook);
            if (doc.isDoc && ctaData.buttonText && ctaData.buttonText !== doc.btnText) {
              console.log(`[CTA] 🔧 문서 URL 감지 → AI 버튼 텍스트("${ctaData.buttonText}") 무시하고 "${doc.btnText}"로 교체`);
            }

            safeCTAs.push({
              hookingMessage: finalHookMessage,
              buttonText: finalButtonText,
              url: ctaData.url,
              position: 1,
              type: 'link',
              design: 'button',
              text: finalButtonText,
              hook: finalHookMessage,
            });
            console.log(`[CTA] ✅ Search Grounding CTA 하이브리드 검증 통과: ${ctaData.url}`);
          } else {
            console.log(`[CTA] ❌ Search Grounding CTA 검증 실패 (HTTP+AI 하이브리드): ${ctaData.url}`);
          }
        } else {
          console.log(`[CTA] ⚠️ 검색엔진/블로그 URL 감지, 필터링: ${ctaData.url}`);
        }
      }
    } catch (parseErr) {
      console.log(`[CTA] ⚠️ Grounding CTA JSON 파싱 실패, 폴백으로 진행`);
    }
  } catch (groundingErr: any) {
    console.log(`[CTA] ⚠️ Search Grounding CTA 실패: ${groundingErr.message?.substring(0, 100)}`);
  }

  // 🔥 2단계: Grounding 실패 시 기존 Google CSE 폴백
  if (safeCTAs.length === 0 && googleCseKey && googleCseCx) {
    console.log('[CTA] 폴백: Google CSE로 공식 사이트 검색...');
    const officialLink = await searchOfficialSite(keyword, googleCseKey, googleCseCx, contentMode);
    if (officialLink) {
      const shortKeyword = keyword.length > 15 ? keyword.split(/\s+/).slice(0, 2).join(' ') : keyword;
      let btnText = `🔗 ${shortKeyword} 공식 사이트`;
      let hookText = `${shortKeyword}에 대해 더 알아보세요!`;
      // 🔀 하이브리드 검증
      const isCseValid = await hybridValidateCta(officialLink.url, keyword, 5000);
      if (isCseValid) {
        const shortKeyword2 = keyword.length > 15 ? keyword.split(/\s+/).slice(0, 2).join(' ') : keyword;
        const docCse = detectDocumentCta(officialLink.url);
        let btnText2 = docCse.isDoc ? docCse.btnText : `🔗 ${shortKeyword2} 공식 사이트`;
        let hookText2 = docCse.isDoc ? docCse.hookText : `${shortKeyword2}에 대해 더 알아보세요!`;

        if (!docCse.isDoc) {
          // 🛍️ 쇼핑 모드 우선 매핑 (모드가 shopping이면 구매/비교 CTA 먼저)
          if (contentMode === 'shopping') {
            if (keyword.match(/최저가|가격|할인|세일/)) {
              btnText2 = '💰 최저가 확인하기';
              hookText2 = '실시간 가격을 비교하고 가장 저렴한 곳을 찾으세요!';
            } else if (keyword.match(/비교|차이|vs|대비/)) {
              btnText2 = '⚖️ 상세 비교하기';
              hookText2 = '스펙과 가격을 한눈에 비교해보세요!';
            } else if (keyword.match(/후기|리뷰|평가|사용기/)) {
              btnText2 = '⭐ 실구매 후기 보기';
              hookText2 = '실제 구매자들의 솔직한 후기를 확인하세요!';
            } else if (keyword.match(/추천|best|베스트|인기/)) {
              btnText2 = '🏆 베스트 상품 보기';
              hookText2 = '실구매자들이 선택한 인기 상품을 확인하세요!';
            } else {
              btnText2 = '🛒 상품 정보 보기';
              hookText2 = '가격·스펙·후기까지 한눈에 확인하세요!';
            }
          } else if (keyword.match(/신청|접수|등록|발급/)) {
            btnText2 = '🚀 바로 신청하기';
            hookText2 = '지금 바로 신청을 진행해보세요!';
          } else if (keyword.match(/조회|확인|검색|계산/)) {
            btnText2 = '🔍 바로 조회하기';
            hookText2 = '간편하게 결과를 확인하세요.';
          } else if (keyword.match(/예약|예매/)) {
            btnText2 = '📅 바로 예약하기';
            hookText2 = '매진되기 전에 빠르게 예약하세요!';
          } else if (keyword.match(/보조금|지원금|지원사업|보조/)) {
            btnText2 = '🚀 지원사업 신청하기';
            hookText2 = '지금 바로 지원사업을 확인하고 신청하세요!';
          }
        }

        safeCTAs.push({
          hookingMessage: hookText2,
          buttonText: btnText2,
          url: officialLink.url,
          position: 1,
          type: 'link',
          design: 'button',
          text: btnText2,
          hook: hookText2,
        });
        console.log(`[CTA] ✅ CSE 폴백 CTA 하이브리드 검증 통과: ${officialLink.url}`);
      } else {
        console.log(`[CTA] ❌ CSE 폴백 CTA 검증 실패 (HTTP+AI 하이브리드): ${officialLink.url}`);
      }
    }
  }

  // 🔥 3단계: 크롤링 데이터에서 공식 링크 탐색 (모드별 도메인 우선순위)
  if (safeCTAs.length === 0 && crawledPosts.length > 0) {
    // 🎯 모드별 신뢰 도메인
    const officialDomains = contentMode === 'shopping'
      ? ['coupang.com', 'smartstore.naver.com', 'shopping.naver.com', '11st.co.kr', 'gmarket.co.kr', 'danawa.com', 'apple.com', 'samsung.com', 'lg.com']
      : ['.go.kr', '.or.kr', '.ac.kr', '.re.kr', '.gov', '.edu', '.org'];
    const blogDomains = ['tistory', 'naver.com/blog', 'blog.naver', 'wordpress', 'blogspot', 'velog', 'brunch', 'medium.com'];

    for (const post of crawledPosts) {
      const url = post.url?.toLowerCase() || '';
      const isOfficial = officialDomains.some(d => url.includes(d));
      const isBlog = blogDomains.some(d => url.includes(d));
      if (isOfficial && !isBlog) {
        const isCrawledValid = await hybridValidateCta(post.url || '', keyword, 5000);
        if (isCrawledValid) {
          const docCrawled = detectDocumentCta(post.url || '');
          const dlBtn = docCrawled.isDoc ? docCrawled.btnText
            : contentMode === 'shopping' ? '🛒 상품 페이지 보기'
            : contentMode === 'internal' ? '📚 공식 자료 보기'
            : '🔗 공식 사이트 바로가기';
          const dlHook = docCrawled.isDoc ? docCrawled.hookText
            : contentMode === 'shopping' ? '가격과 실구매 후기를 확인하세요!'
            : contentMode === 'internal' ? '신뢰할 수 있는 공식 자료를 확인하세요'
            : '정확한 정보는 공식 사이트에서 확인하세요!';
          safeCTAs.push({
            hookingMessage: dlHook,
            buttonText: dlBtn,
            url: post.url || '',
            position: 1,
            type: 'link',
            design: 'button',
            text: dlBtn,
            hook: dlHook,
          });
          console.log(`[CTA] ✅ 크롤링 데이터 공식 링크 하이브리드 검증 통과: ${post.url}`);
          break;
        } else {
          console.log(`[CTA] ❌ 크롤링 데이터 공식 링크 검증 실패 (HTTP+AI 하이브리드): ${post.url}`);
        }
      }
    }
  }

  // 🔥 4단계: 키워드 맞춤형 공식 서비스 CTA
  if (safeCTAs.length === 0) {
    console.log(`[CTA] ⚠️ 모든 검색 실패. 키워드 맞춤형 공식 서비스 매핑 시도...`);

    const specificMappings: { pattern: RegExp; url: string; btnText: string; hookText: string }[] = [
      { pattern: /지원금|보조금|연금|수당|청년|장려금|바우처|복지/, url: 'https://www.bokjiro.go.kr/', btnText: '🎁 복지로에서 혜택 찾기', hookText: '나에게 맞는 복지 혜택을 복지로에서 확인하세요!' },
      { pattern: /세금|국세|종소세|부가세|연말정산|원천징수/, url: 'https://www.hometax.go.kr/', btnText: '💰 홈택스 바로가기', hookText: '세금 관련 신고·조회를 홈택스에서 바로 처리하세요.' },
      { pattern: /건강보험|건보|의료보험/, url: 'https://www.nhis.or.kr/', btnText: '🏥 건강보험 조회하기', hookText: '건강보험 자격·보험료를 공식 사이트에서 확인하세요.' },
      { pattern: /고용보험|실업급여|취업|구직/, url: 'https://www.ei.go.kr/', btnText: '💼 고용보험 조회하기', hookText: '고용보험 자격·실업급여를 바로 확인하세요.' },
      { pattern: /부동산|아파트|전세|월세|집값|매매|실거래/, url: 'https://rt.molit.go.kr/', btnText: '🏠 실거래가 조회하기', hookText: '국토교통부 실거래가 공개시스템에서 확인하세요.' },
    ];

    for (const mapping of specificMappings) {
      if (mapping.pattern.test(keyword)) {
        // 🛡️ 최후 폴백 단계: 공식 기관 루트 URL은 형식 검증만 수행
        //    (.go.kr 루트가 간헐적 에러 본문을 띄워 error-content로 탈락하면 CTA가 완전히 사라지는 회귀 방지)
        const validation = await validateCtaUrl(mapping.url, { timeout: 5000, skipHttp: true });
        if (validation.isValid) {
          safeCTAs.push({
            hookingMessage: mapping.hookText,
            buttonText: mapping.btnText,
            url: mapping.url,
            position: 1,
            type: 'link',
            design: 'button',
            text: mapping.btnText,
            hook: mapping.hookText,
          });
          console.log(`[CTA] ✅ 키워드 매핑 CTA 검증 성공: ${mapping.url} (${validation.statusCode || 'OK'}, ${validation.elapsedMs}ms)`);
        } else {
          console.log(`[CTA] ❌ 키워드 매핑 CTA 검증 실패: ${mapping.url} (${validation.reason})`);
        }
        break;
      }
    }

    if (safeCTAs.length === 0) {
      console.log(`[CTA] ℹ️ "${keyword}" — 유효한 CTA를 찾지 못했습니다. CTA 생략.`);
    }
  }

  // 스마트 툴 링크 (Pexels, Pixabay 등)
  if (generatedSections && generatedSections.length > 0) {
    const fullText = generatedSections.flatMap(s => s.h3Sections.map((h: any) => h.content)).join(' ');

    const smartTools = [
      { name: 'Pexels', url: 'https://www.pexels.com/ko-kr/', keywords: ['pexels', '펙셀스', '무료 이미지', '무료 사진', '저작권 없는 이미지'], hook: '저작권 걱정 없는 고화질 이미지가 필요하신가요?', btn: '📸 Pexels에서 이미지 찾기' },
      { name: 'Pixabay', url: 'https://pixabay.com/ko/', keywords: ['pixabay', '픽사베이', '무료 스톡', '고화질 사진'], hook: '상업적 이용이 가능한 무료 이미지를 지금 확인해보세요.', btn: '🖼️ Pixabay 바로가기' },
      { name: 'Unsplash', url: 'https://unsplash.com/', keywords: ['unsplash', '언스플래쉬', '감성 사진', '배경화면'], hook: '감각적인 무료 이미지를 찾고 계신가요?', btn: '🎨 Unsplash 갤러리 구경하기' },
    ];

    for (const tool of smartTools) {
      if (safeCTAs.length > 1) break;

      const hasKeyword = tool.keywords.some(k => fullText.toLowerCase().includes(k) || keyword.toLowerCase().includes(k));
      if (hasKeyword) {
        safeCTAs.push({
          type: 'link',
          text: tool.btn,
          url: tool.url,
          design: 'button',
          hook: tool.hook,
          hookingMessage: tool.hook,
          buttonText: tool.btn
        });
        break;
      }
    }
  }

  return safeCTAs;
}

export async function generateSummaryTableFinal(allContent: string): Promise<FinalTableData> {
  const tableToday = new Date().toISOString().slice(0, 10);
  // 🧹 입력 전처리 — 상품 카드/버튼/이미지 같은 HTML 제거 후 AI에 전달
  //    (그대로 넣으면 AI가 셀 값으로 HTML 조각을 복사해 넣음 → 모바일 레이아웃 깨짐)
  const cleanedContent = String(allContent || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1')          // a 태그는 내용만 유지
    .replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '')
    .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    // 광고/CTA/상품 카드로 보이는 div 블록 제거
    .replace(/<div[^>]*class="[^"]*(cta|ad-|product|coupang|affiliate|price|buy)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<[^>]+>/g, ' ')                              // 나머지 태그도 다 벗겨 순수 텍스트로
    .replace(/\s+/g, ' ')
    .trim();

  const prompt = `
📅 오늘: ${tableToday}
전체 내용 (순수 텍스트):

${cleanedContent.slice(0, 2000)}

위 본문 내용을 기반으로 핵심 요약표를 만드세요 (그리드 형식).

🚫🚫🚫 **절대 규칙 — 반드시 지킬 것**:
1. 본문에 실제로 언급된 내용만 요약! 본문에 없는 정보 추가 금지!
2. **셀 값은 오직 평문(plain text)만!** HTML 태그, <div>, <img>, <a>, 버튼 등 절대 금지!
3. 가격/상품명 나열 금지 — 상품 정보는 다른 섹션에 있음. 여기는 "핵심 요약"만.
4. 각 셀은 30자 이내로 간결하게. 쉼표/접속사로 나열식 자제.
5. 숫자/통계는 본문에서 그대로 인용
6. 한글/영문/숫자만 사용. 한자 금지!

✅ 좋은 예:
  ["주요 대상", "30~40대 직장인"]
  ["핵심 혜택", "세액공제 최대 700만원"]

❌ 나쁜 예 (절대 출력 금지):
  ["상품", "<div class='...'>조르쥬 레쉬 자켓 289,000원 <button>구매하기</button></div>"]
  ["추천", "<img src='...'/><br>가격: 49,000원"]

JSON:
{
  "type": "summary",
  "headers": ["항목", "내용"],
  "rows": [
    ["주요 내용", "본문 기반 핵심"],
    ["대상", "본문 기반"],
    ...3~5행
  ]
}

JSON만 (평문 셀):
`;

  try {
    const response = await callGeminiWithGrounding(prompt);
    const json = response.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const parsed = JSON.parse(json);
    // CJK 필터링 + HTML 태그 2차 스트립 (AI가 지시 어기고 HTML 넣은 경우 방어)
    const cjk = /[\u4E00-\u9FFF\u3400-\u4DBF]/g;
    const stripHtml = (cell: string) =>
      String(cell || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (parsed.rows) {
      parsed.rows = parsed.rows
        .map((row: string[]) => row.map((cell: string) => stripHtml((cell || '').replace(cjk, ''))))
        .filter((row: string[]) => row.some((c: string) => c.length > 0));
    }
    if (parsed.headers) {
      parsed.headers = parsed.headers.map((h: string) => stripHtml((h || '').replace(cjk, '')));
    }
    return parsed;
  } catch {
    // 폴백: 본문에서 키워드 추출하여 최소한의 테이블 생성
    const keywordMatch = allContent.match(/<h2[^>]*>([^<]+)<\/h2>/g);
    const h2List = keywordMatch ? keywordMatch.map(h => h.replace(/<[^>]+>/g, '').trim()).slice(0, 3) : [];
    return {
      type: 'summary',
      headers: ['항목', '내용'],
      rows: h2List.length > 0
        ? h2List.map((h, i) => [`핵심 ${i + 1}`, h])
        : [['내용', '위 본문을 참고해주세요']],
    };
  }
}

export async function generateHashtagsFinal(keyword: string, h2s: string[]): Promise<string> {
  const prompt = `
키워드: ${keyword}
H2들: ${h2s.join(', ')}

위 키워드와 소제목을 기반으로 검색에 유리한 해시태그를 10개 이상 만드세요.

요구사항:
1. # 사용 금지
2. , 로만 구분
3. 키워드와 H2에서 파생된 실제 검색어만 사용. 허위/과장 태그 금지!
4. 한글/영문만 사용. 한자 금지!

예: 태그1, 태그2, 태그3, ...

태그만:
`;

  try {
    const response = await callGeminiWithGrounding(prompt);
    return response.trim().replace(/[\u4E00-\u9FFF\u3400-\u4DBF]/g, '');
  } catch {
    // 폴백: 키워드 + H2 기반 태그
    const tags = [keyword, ...h2s.slice(0, 5)].join(', ');
    return tags;
  }
}
