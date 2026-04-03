/**
 * 콘텐츠 생성 함수 모음
 * - H1, H2, H3 제목 생성
 * - 전체 본문 일괄 생성
 * - FAQ, CTA, 요약표, 해시태그 생성
 */

import axios from 'axios';
import { loadEnvFromFile } from '../../env';
import { getGeminiApiKey, getPerplexityApiKey } from '../llm';
import { validateCtaUrl } from '../../cta/validate-cta-url';
import { callGeminiWithRetry, callGeminiWithGrounding } from './gemini-engine';
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
    { name: '경험담 공유', pattern: '"OO 직접 해본 솔직 후기", "OO 3개월 써본 결과", "OO 실패하고 깨달은 것"' },
    { name: '트렌드/최신', pattern: `"${currentYear}년 OO 최신 트렌드", "올해 달라진 OO 핵심 변화", "${currentYear} OO 이렇게 바뀌었다"` },
    { name: '문제 해결', pattern: '"OO 안 될 때 해결법 총정리", "OO 실패하는 3가지 이유", "OO 흔한 실수와 해결책"' },
    { name: '전문가 인사이트', pattern: '"전문가가 알려주는 OO 핵심", "현직자가 말하는 OO 비밀", "10년차가 추천하는 OO"' },
    { name: '단계별 가이드', pattern: '"OO 3단계로 끝내기", "OO 따라하면 되는 5스텝", "OO 입문부터 실전까지"' },
    { name: '꿀팁/노하우', pattern: '"OO 꿀팁 모음", "OO 고수만 아는 비법", "OO 효율 200% 올리는 법"' },
  ];

  // 랜덤으로 3개 아키타입 선택
  const shuffled = [...titleArchetypes].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 3);
  const archetypeGuide = selected.map((a, i) => `${i + 1}. **${a.name}형**: ${a.pattern}`).join('\n');

  const prompt = `
당신은 대한민국 최고의 바이럴 마케터입니다.

🔴🔴🔴 **현재: ${currentYear}년 ${currentMonth}월** (반드시 이 날짜 기준!)

키워드: ${keyword}

${titleReference}

🔥 **이번에 사용할 제목 스타일 (아래 중 하나 선택):**
${archetypeGuide}

📌 **제목 작성 핵심 규칙:**
- 위 스타일 중 하나를 골라 창의적으로 작성
- 이모지 1개 필수 포함 (🔥💡🎯✅🚀📊💰🏆 등)
- 키워드 "${keyword}"를 자연스럽게 포함
- 매번 새롭고 독창적인 제목 생성 (같은 패턴 반복 금지)

🔴🔴🔴 **스마트 연도 삽입 규칙 (필수 준수):**
- 검색 키워드("${keyword}")의 성격을 분석하세요.
  - **연도가 꼭 필요한 주제** (예: 정책, 지원금, 세금, 트렌드, 최신 정보, 가이드 등) → **반드시** "${currentYear}년"을 제목 맨 앞에 붙이세요. (예: "${currentYear}년 정부지원금 완벽 가이드")
  - **연도가 불필요한 주제** (예: 맛집, 일상 꿀팁, 고전적인 정보, 개인적인 리뷰 등) → **절대** 연도를 붙이지 마세요. (예: "강남역 맛집 내돈내산 찐후기")
- 만약 연도를 쓴다면, 무조건 제목의 첫 단어로 써야 합니다. 중간이나 끝에 넣지 마세요.

🔴🔴🔴 **절대 금지 패턴 (너무 흔해서 클릭률 저하):**
- "~~ 손해", "놓치면 손해", "모르면 손해" ❌
- "~~ 후회", "안 하면 후회" ❌
- "~~ 대박", "완전 대박" ❌
- 위 표현은 절대 사용하지 마세요!

🔴 **제목 길이: 25~45자**
🔴 **오직 1개만 출력** (옵션/설명/번호 없이 제목만!)

출력: 제목 텍스트만
`;

  const response = await callGeminiWithGrounding(prompt);
  // 🔥 첫 번째 줄만 추출, 특수문자/번호 제거
  const lines = response.trim().split('\n');
  let title = (lines[0] || response.trim())
    .replace(/^[\*\-\d\.\)\]]+\s*/g, '')  // 번호/기호 제거
    .replace(/["']/g, '')
    .trim();

  // 🔥 연도 위치 후처리: "년 ... 2026" 패턴을 "2026년 ..." 으로 수정
  const yearInMiddle = title.match(/^년\s*(.+?)\s*(20\d{2})\s*(.*)$/);
  if (yearInMiddle) {
    title = `${yearInMiddle[2]}년 ${yearInMiddle[1]} ${yearInMiddle[3]}`.replace(/\s+/g, ' ').trim();
  }

  // 🔥 "년 " 단독으로 시작하면 앞 연매 뽑아서 앞쪽으로
  if (title.startsWith('년 ') || title.startsWith('년')) {
    const yearInTitle = title.match(/20\d{2}/);
    if (yearInTitle) {
      title = title.replace(/^년\s*/, '').replace(yearInTitle[0], `${yearInTitle[0]}년`);
      title = title.replace(new RegExp(`${yearInTitle[0]}년`), '').trim();
      title = `${yearInTitle[0]}년 ${title}`;
    } else {
      title = title.replace(/^년\s*/, '').trim(); // 연도가 없으면 그냥 "년" 글자만 제거
    }
  }

  // 강제 연도 삽입 로직(무조건 currentYear 넣는 부분) 삭제됨 - AI 판단에 맡김

  // 🔥 50자 초과시만 자르기 (긴 제목 허용)
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

  const prompt = `
키워드: ${keyword}

${subheadingReference}

🔴🔴🔴 **핵심 규칙 - 중복 금지 & 다양성 확보!**:
1. 각 H2는 완전히 다른 주제/관점을 다뤄야 함
2. 같은 내용을 다르게 표현하지 마세요 (예: "방법", "하는 법" 1개만)
3. **단조로운 패턴 피하기**: 모든 제목을 "OO란?", "OO 방법"으로 똑같이 끝내지 마세요.
4. 아래의 다양한 아키타입 성격을 섞어서 구성하세요:
   - [Q&A형] "사람들이 가장 많이 물어보는 질문 TOP 3"
   - [심층 분석형] "왜 전문가들은 OO를 추천할까?"
   - [체크리스트형] "시작하기 전 반드시 확인해야 할 5가지"
   - [비교 분석형] "OO vs OO, 나에게 맞는 것은?"
   - [스토리텔링/경험형] "직접 겪어보고 알게 된 진짜 꿀팁"

요구사항:
1. 각 H2가 위 아키타입처럼 서로 완전히 다르고 흥미로운 정보를 다룰 것!
2. SEO 최적화, 각 15~20자 이내
3. 🔴🔴🔴 번호/접두어 금지! 순수한 제목 텍스트만!
4. 검색자가 당장 클릭하고 싶을 만큼 매력적인 문장형 제목을 활용할 것
5. 🔴 연도: ${currentYear}년 외 과거 연도 금지

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
      .trim()
    ).filter(t => t.length > 0);
  } catch {
    return sorted.slice(0, targetCount).map(s => s.split(' (')[0]).filter((h): h is string => !!h);
  }
}

export async function generateH3TitlesFinal(h2: string, keyword: string): Promise<string[]> {
  // 🔥 간단한 H3 제목 자동 생성 (API 호출 최소화)
  const templates = [
    [`${h2} 핵심 정리`, `이렇게 하면 돼요!`, `주의할 점은?`],
    [`먼저 알아야 할 것`, `실제 방법 안내`, `꿀팁 모음`],
    [`기본 개념 이해`, `단계별 가이드`, `자주 묻는 질문`],
    [`시작하기 전에`, `실전 적용법`, `마무리 체크`],
    [`왜 필요할까요?`, `구체적인 방법`, `추가 팁들`]
  ];

  // H2 인덱스에 따라 다른 템플릿 사용
  const idx = Math.abs(h2.charCodeAt(0)) % templates.length;
  return templates[idx] ?? templates[0] ?? [`${h2} 핵심 정리`, `이렇게 하면 돼요!`, `주의할 점은?`];
}

// 🔥🔥🔥 전체 글을 단 1회 API 호출로 생성하는 초고속 함수
export async function generateAllSectionsFinal(
  keyword: string,
  h2Titles: string[],
  crawledContents: string[],
  onLog?: (s: string) => void,
  contentMode?: string
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

  // 🔥 내부 일관성 모드 전용 프롬프트 (시리즈형 글)
  const internalModePromptBlock = contentMode === 'internal' ? `

📺📺📺 [시리즈형 내부 일관성 모드 — TV 에피소드 스타일] 📺📺📺

🎯 **이 글은 시리즈형 글입니다!** 하나의 대주제("${keyword}")로 연재되는 시리즈 중 한 편을 작성합니다.

🔴🔴🔴 **시리즈 모드 핵심 규칙**:
1. **일관된 톤 유지**: 지식을 나누는 선배 같은 따뜻하고 전문적인 톤, 시리즈 전체에서 동일
2. **시리즈 맥락 제공**: 서론에서 "이번 시리즈에서는..." 또는 "지난번에 다룬 내용을 바탕으로..." 형식
3. **고정 포맷 섹션 엄수**: ④번 "📌 오늘의 핵심"과 ⑤번 "📺 다음 편 예고"는 **매번 동일한 포맷**으로!

📝 **각 섹션별 작성 가이드**:
- **① 시리즈 위치 + 도입** (600자+): 시리즈 맥락 → 이전 글 간단 회고 → 오늘의 핵심 질문
- **② 핵심 지식 전달** (1500자+): H3 소제목 3~4개로 구조화, 구체적 수치/데이터 5개+, 이전 글 내용과 연결
- **③ 심화·사례 분석** (1000자+): 실제 사례 2개+, 단계별 가이드, 팁 2~3개
- **④ 📌 오늘의 핵심** (400자+): 고정 포맷! 불릿 3~5개 + "한 줄 정리: [결론]" (매번 이 형식 유지!)
- **⑤ 📺 다음 편 예고** (300자+): 고정 포맷! 다음 주제 1줄 소개 + 논리적 이유 + 기대감

🔥 **시리즈 톤 규칙**:
- "~해요", "~거든요" 친근하면서도 전문적인 말투
- 시리즈 전체에서 동일한 깊이와 용어 사용
- 이전 글과의 자연스러운 연결: "지난 글에서 다룬 [개념]을 기반으로 하면..."
- 다음 글 예고로 재방문 유도

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
- **섹션 1: 작성자 소개** (350자+): 해당 분야 전문 자격, 경력, 경험 연수를 자연스러운 1인칭으로. "2026년 N월 기준" 날짜 필수
- **섹션 2: [주제] 완전히 이해하기** (1000자+): 핵심 개념 정의(초보자 눈높이) + 중요한 3가지 이유(데이터) + 흔한 오해 바로잡기 + 신뢰 출처 인용
- **섹션 3: 직접 경험** (1500자+): Before/After 수치, 시행착오, 다른 곳에서 못 찾는 인사이트, 구체적 숫자
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

  const prompt = `
🎯 키워드: ${keyword}

📌 구성해야 할 요소:
1. 글 전체의 서론 (Introduction)
2. H2 소제목 리스트에 따른 본문 섹션들
${h2List}
3. 글 전체의 결론 (Conclusion)

${contentReference}
${internalModePromptBlock}
${adsenseModePromptBlock}
🔴🔴🔴 [10억 점 수익화 블로그 완벽 작성 가이드] 🔴🔴🔴

[1. 가독성(Readability)의 극한화 - 체류시간 폭발]
- **초단문 지향**: 모바일 독자를 위해 한 문장은 절대 2~3줄을 넘지 않게 짧게 끊어 치세요. (호흡을 짧게)
- **시각적 여백 (Breathing Space)**: 단락(Paragraph)은 최대 3~4문장 단위로 무조건 줄바꿈(<p>)을 넣어 텍스트 벽(Wall of Text) 현상을 완벽히 방지하세요.
- **소분류 활용**: 글 중간중간 글머리 기호(<ul>, <li>)나 숫자 리스트를 적어도 1회 이상 섞어서 가독성을 극대화하세요.
- **핵심 정보 선배치 (두괄식)**: 각 H3 섹션의 첫 문단에서 가장 중요한 결론/인사이트를 먼저 때리고 시작하세요.

[2. '진짜 사람' 같은 극사실적 어조(Ultra-Human Tone)]
- **완벽한 구어체 전환**: 기계 번역투, AI 특유의 장황한 설명체("중요한 사실입니다", "다양한 이점이 있습니다") 철저히 배제.
- **디테일한 공감과 경험적 터치**: "많이들 헷갈리시죠?", "실제로 해보면 제일 당황스러운 부분이 바로 여깁니다" 와 같이, 직접 겪어본 듯한 실전 노하우 뉘앙스를 자연스럽게 녹여내세요.
- **결론부 여운 강화 (Conclusion)**: 서론은 300~500자로 매력적인 훅(Hook)을 넣고, 결론은 200~400자로 뻔한 인사말("도움이 되셨길 바랍니다") 대신 명확한 Next Action(다음 행동 유도)이나 꿀팁으로 강력하게 클로징하세요.

[3. SEO 정보 밀도(Density)와 신뢰성(Trust) 극대화]
- **밀도 높은 데이터 주입**: 두루뭉술한 표현 -> 구체적이고 확정적인 표현("실제 데이터에 따르면 10명 중 8명이")으로 치환 강제. 검색에서 들어온 숫자는 반드시 1회 이상 강조(<strong>)할 것.
- **[전문가의 팁] 마이크로 요소**: 각 H2마다 본문 흐름 중 최소 1번은 시선을 확 끄는 인용구 <blockquote> (예: "앗, 여기서 꿀팁 한 가지!" 또는 "실전 주의사항:")를 배치하여 광고(Adsense) 체류시간을 높이세요.
- 🔴 절대금지: 본문에 "20년차", "1억", "전문가" 등 작가의 자격증명/거짓 이력을 언급하지 마세요! E-E-A-T는 글의 구체성에서 나옵니다.

[4. 본문(H3) 구조 및 길이 규칙]
- **각 H3 본문은 반드시 600~1000자** 사이의 알찬 내용으로 채우세요. (전체 3000~4500자 완성 목적)
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

  5. [데이터 전달형]: 정확한 수치와 팩트를 중심으로 한 신뢰감 있는 전개.

🚫🚫🚫 [AI티 제거 - 최우선!] 🚫🚫🚫
⛔ 본문 content에 이모지 사용 절대 금지! (🔥💡📋✅💎👉 등 모든 이모지!)
⛔ 문단 앞에 라벨/접두어 붙이기 금지! ("후킹:", "핵심:", "실전:" 등)
⛔ 번호 이모지 금지! (1️⃣, 2️⃣ 등)
⛔ 글 흐름을 끊는 어떤 마커도 금지!
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
        {"h3": "10~15자 H3 제목", "content": "<p>위 다채로운 본문 포맷 중 하나를 선택해 600~1000자 작성</p>...", "tables": []}
      ]
    },
    ...총 ${h2Titles.length}개의 H2
  ]
}

🚨🚨🚨 최종 체크리스트 (10억 점 기준) 🚨🚨🚨
□ 모바일 가독성을 위해 문장이 짧고 단락 구분이 확실한가? (<p> 떡칠 방지, 여백 최적화)
□ "많이들 헷갈리시죠?" 같은 진짜 사람이 쓴 듯한 구어체가 묻어나는가?
□ 각 H3 본문당 글자 수가 600자 이상 1000자 이내(충분한 분량)인가?
□ 중간중간 독자의 스크롤을 멈출 <blockquote> 꿀팁 박스와 <ul> 리스트가 존재하는가?
□ 서론과 결론이 기계적이지 않고, 매력적인 훅과 네비게이션 역할을 하는가?

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
      response = await callGeminiWithRetry(retryPrompt);
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
5) 구체적인 숫자/사례/도구명 추가

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
        h2: h2Titles[idx] || sec.h2,
        h3Sections: (sec.h3Sections || []).map(h3Sec => ({
          h3: h3Sec.h3,
          content: (h3Sec.content || '')
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
            .replace(/<p>\s*<\/p>/g, ''),
          tables: parseTables((h3Sec as any).tables)
        }))
      }))
    };

  } catch (e) {
    console.error('[generateAllSectionsFinal] 실패:', e);
    onLog?.('[PROGRESS] 50% - ⚠️ 폴백 콘텐츠 사용');

    // 폴백: 기본 콘텐츠 (품질 강화 - 600자 이상)
    return {
      introduction: `<p>🔥 ${keyword}에 대해 궁금하셨죠? 많은 분들이 처음엔 어떻게 해야 할지 감을 잡기 어려워하십니다. 오늘은 이 문제를 완벽하게 해결해드릴 핵심 정보들을 모아봤어요.</p>`,
      conclusion: `<p>오늘 ${keyword}에 대해 알아보았는데요. 이 글에서 알려드린 핵심 방법들을 하나씩 적용해보면 분명 좋은 결과를 얻으실 수 있을 거예요. 당장 오늘부터 작은 것 하나라도 실천해보는 건 어떨까요?</p>`,
      sections: h2Titles.map((h2, idx) => ({
        h2,
        h3Sections: [
          { h3: '핵심 포인트 정리', content: `<p>🔥 ${keyword} 때문에 고민이신가요? 사실 10명 중 7명이 처음에 이 부분에서 막히더라고요. 저도 처음엔 뭐가 뭔지 몰라서 한참 헤맸거든요.</p><p>💡 핵심은 바로 기초부터 탄탄히 이해하는 거예요. 이게 왜 중요하냐면, 나중에 응용할 때 헷갈리지 않거든요. 실제로 기초를 대충 넘기면 나중에 문제가 생겨요.</p><p>📋 그래서 제가 추천하는 방법은 이거예요. 1단계: 먼저 개념을 정확히 이해하기. 2단계: 실제 예시로 확인하기. 3단계: 직접 적용해보기. 이렇게 하면 처음 하시는 분도 30분 안에 이해할 수 있어요.</p><p>✅ 참고로 저는 이 방법으로 처음에 시간을 많이 절약했어요. 주변에서도 해보고 효과 봤다는 분들이 많더라고요.</p><p>💎 이 핵심만 기억해도 절반은 성공이에요!</p>`, tables: [] },
          { h3: '실전 방법 가이드', content: `<p>🔥 "이론은 알겠는데, 실제로 어떻게 해요?" 이런 질문 많이 받아요. 사실 대부분이 여기서 막히거든요. 저도 처음엔 이론만 알고 실전에서 헤맸어요.</p><p>💡 핵심은 작은 것부터 시작하는 거예요. 처음부터 큰 걸 하려면 부담되고 포기하기 쉽거든요. 그래서 작은 성공 경험을 쌓는 게 중요해요.</p><p>📋 구체적인 실전 방법: 1단계 - 가장 기본적인 것부터 시작해요. 2단계 - 매일 10분씩만 투자해요. 3단계 - 결과를 기록하고 개선점을 찾아요. 이 세 가지만 지키면 누구나 할 수 있어요.</p><p>✅ 실제로 이 방법으로 시작한 분들 중 80%가 1주일 안에 결과를 봤어요. 어렵지 않죠?</p><p>💎 실전에서는 이 3단계만 따라하면 돼요!</p>`, tables: [] },
          { h3: '주의사항 체크', content: `<p>🔥 여기서 많은 분들이 실수해요. 저도 처음에 이걸 몰라서 시간을 낭비했거든요. 미리 알았으면 훨씬 빨리 했을 텐데 말이에요.</p><p>💡 가장 흔한 실수는 너무 급하게 하려는 거예요. 빨리 하려다 보면 기초를 놓치게 되고, 나중에 다시 처음부터 해야 할 수도 있어요.</p><p>📋 체크리스트로 확인해보세요: ✅ 기초 개념 이해했나요? ✅ 작은 것부터 시작했나요? ✅ 결과를 기록하고 있나요? 이 세 가지만 확인해도 대부분의 실수를 피할 수 있어요.</p><p>✅ 주변에서 이 체크리스트를 활용한 분들은 실수율이 70% 이상 줄었다고 해요. 간단하지만 효과적이죠!</p><p>💎 이 체크리스트만 잘 따라도 실수를 크게 줄일 수 있어요!</p>`, tables: [] },
        ]
      }))
    };
  }
}

// 🔥 FAQ 생성 함수 -- Schema.org FAQPage 마크업 포함
export async function generateFAQFinal(
  keyword: string,
  h2Titles: string[],
  onLog?: (s: string) => void
): Promise<FAQItem[]> {
  const prompt = `
키워드: ${keyword}

H2 섹션 제목:
${h2Titles.map((h, i) => `${i + 1}. ${h}`).join('\n')}

위 블로그 글에 대해 독자가 실제로 궁금해할 자주 묻는 질문(FAQ) 5개를 만들어주세요.

규칙:
1. 질문은 실제 검색어처럼 자연스럽게 (예: "${keyword} 비용이 얼마인가요?")
2. 답변은 3~4줄로 핵심만 간결하게
3. 답변에 구체적인 숫자/기간/금액 포함
4. 본문 내용과 중복되지 않는 추가 정보 위주
5. "~해요", "~거든요" 친근한 말투

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
    const response = await callGeminiWithRetry(prompt);
    const cleaned = (response || '').trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const first = cleaned.indexOf('[');
    const last = cleaned.lastIndexOf(']');
    if (first === -1 || last === -1 || last <= first) throw new Error('No JSON array found');

    const items: FAQItem[] = JSON.parse(cleaned.slice(first, last + 1));
    const valid = items
      .filter(f => f && typeof f.question === 'string' && typeof f.answer === 'string' && f.question.length > 5 && f.answer.length > 10)
      .slice(0, 7);

    if (valid.length < 3) throw new Error(`Too few valid FAQs: ${valid.length}`);
    onLog?.(`[PROGRESS] 68% - ✅ FAQ ${valid.length}개 생성 완료`);
    return valid;
  } catch (e) {
    console.error('[generateFAQFinal] FAQ 생성 실패:', e);
    onLog?.('[PROGRESS] 68% - ⚠️ FAQ 생성 실패, 기본 FAQ 사용');
    // 폴백: 키워드 기반 기본 FAQ
    return [
      { question: `${keyword}이/가 정확히 무엇인가요?`, answer: `${keyword}은(는) 많은 분들이 관심을 가지는 주제예요. 핵심은 기초부터 차근차근 이해하는 것이 중요하거든요. 위 본문에 자세한 내용을 정리해 두었으니 참고해 주세요.` },
      { question: `${keyword} 시작하려면 어떻게 해야 하나요?`, answer: `가장 중요한 건 작은 것부터 시작하는 거예요. 처음부터 완벽하게 하려고 하면 부담만 커지거든요. 위 가이드의 단계별 방법을 따라해 보시면 30분 안에 기본 틀을 잡을 수 있어요.` },
      { question: `${keyword} 관련해서 주의할 점이 있나요?`, answer: `가장 흔한 실수는 기초를 건너뛰고 바로 실전에 뛰어드는 거예요. 기본 개념을 확실히 이해한 후에 시작하시면 시행착오를 크게 줄일 수 있어요.` },
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
    const response = await callGeminiWithRetry(prompt);
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
      content: `<p>${keyword}에 대해 알아볼게요. ${h3}는 많은 분들이 궁금해하는 부분이에요.</p><p>실제로 해보면 생각보다 간단해요. 차근차근 따라하면 누구나 할 수 있어요!</p>`,
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

  const prompt = `
키워드: ${keyword}
소제목: ${h3}
참고: ${reference.slice(0, 1500)}

${h3}에 대해 400자 내외로 작성하세요.
- 친근한 말투 (~해요, ~거든요)
- p태그 2~3개
- 크롤링 데이터 기반

HTML만:
`;

  let content = await callGeminiWithRetry(prompt);
  content = content.trim()
    .replace(/^```html\n?/gi, '').replace(/```$/gi, '')
    .replace(/입니다\./g, '이에요.')
    .replace(/습니다\./g, '어요.')
    .replace(/합니다\./g, '해요.');

  return { content, tables: [] };
}

// 🔍 Google CSE를 사용해 공식 사이트 찾기
async function searchOfficialSite(keyword: string, googleCseKey: string, googleCseCx: string): Promise<{ url: string; title: string } | null> {
  if (!googleCseKey || !googleCseCx) return null;

  try {
    const query = `${keyword} 공식 홈페이지`;
    console.log(`[CTA] 🔍 공식 사이트 강제 검색 시도: "${query}"`);

    const url = `https://www.googleapis.com/customsearch/v1?key=${googleCseKey}&cx=${googleCseCx}&q=${encodeURIComponent(query)}&num=5`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      console.log(`[CTA] ⚠️ 공식 사이트 검색 결과 없음`);
      return null;
    }

    const trustedDomains = ['.go.kr', '.or.kr', '.ac.kr', '.re.kr', '.edu', '.gov', '.mil'];
    const excludeDomains = ['blog.naver.com', 'tistory.com', 'velog.io', 'brunch.co.kr', 'namu.wiki', 'wikipedia.org', 'youtube.com', 'facebook.com', 'instagram.com', 'twitter.com', 'kin.naver.com'];

    for (const item of data.items) {
      const link = item.link;
      const title = item.title;

      if (excludeDomains.some(d => link.includes(d))) continue;

      if (trustedDomains.some(d => link.includes(d))) {
        console.log(`[CTA] ✅ 공식/신뢰 사이트 발견: ${link} (${title})`);
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
    const ctaPrompt = `
당신은 한국 블로그 독자를 위한 CTA(Call-to-Action) 전문가입니다.

🎯 키워드: "${keyword}"

🔴 **반드시 Google 검색으로** "${keyword}"에 대한 독자가 실제로 필요한 공식 사이트/서비스 페이지를 찾으세요.

🔥 CTA는 "클릭하면 바로 신청/조회/예약/구매가 가능한 실질적 페이지"이어야 합니다!

❌ 절대 하지 말 것:
- 검색 결과 페이지 (search.naver.com, google.com/search 등) → 절대 금지!
- 블로그 글 (blog.naver.com, tistory.com 등) → 절대 금지!
- 404 에러, 존재하지 않는 페이지 → 절대 금지!
- URL을 추측하거나 만들어내기 → 절대 금지! 검색에서 확인한 것만!

✅ 좋은 CTA 예시:
- "국민연금 조회" → https://www.nps.or.kr (실제 조회 가능)
- "청년도약계좌 신청" → https://www.kinfa.or.kr (실제 신청 가능)
- "KTX 예약" → https://www.letskorail.com (실제 예약 가능)
- "아이폰 16 가격" → https://www.apple.com/kr/iphone-16 (실제 가격 확인)

📋 아래 JSON 형식으로 **정확히 1개** 출력:
{
  "url": "검색에서 확인한 실제 공식 사이트 URL (존재가 확인된 것만!)",
  "hookingMessage": "독자가 클릭하고 싶게 만드는 한 줄 (예: '지금 바로 신청하면 최대 70만원 혜택!')",
  "buttonText": "행동 유발 버튼 텍스트 (예: '🚀 바로 신청하기', '🔍 실시간 조회', '📅 예약하기')",
  "actionType": "apply|check|reserve|buy|info 중 하나"
}

🔴🔴🔴 핵심: URL은 **검색에서 실제로 확인한 것만** 사용! 추측 금지!
JSON만 출력:
`;

    const ctaResponse = await callGeminiWithGrounding(ctaPrompt);
    const cleanJson = ctaResponse.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');

    try {
      const ctaData = JSON.parse(cleanJson);

      if (ctaData.url && ctaData.url.startsWith('http')) {
        // 🔴 검색엔진 결과 페이지인지 체크
        const isSearchPage = /search\.(naver|google|daum|bing)\.com|google\.com\/search|m\.search/i.test(ctaData.url);
        const isBlogPage = /blog\.naver|tistory|brunch|velog|medium\.com|blogspot|wordpress\.com/i.test(ctaData.url);

        if (!isSearchPage && !isBlogPage) {
          // 🔥 HTTP HEAD 검증
          const validation = await validateCtaUrl(ctaData.url, { timeout: 5000 });
          if (validation.isValid) {
            safeCTAs.push({
              hookingMessage: ctaData.hookingMessage || `${keyword}에 대해 더 알아보세요!`,
              buttonText: ctaData.buttonText || `🔗 ${keyword} 바로가기`,
              url: ctaData.url,
              position: 1,
              type: 'link',
              design: 'button',
              text: ctaData.buttonText,
              hook: ctaData.hookingMessage,
            });
            console.log(`[CTA] ✅ Search Grounding CTA 검증 성공! URL: ${ctaData.url} (${validation.statusCode || 'OK'}, ${validation.elapsedMs}ms)`);
          } else {
            console.log(`[CTA] ❌ Search Grounding CTA URL 검증 실패: ${ctaData.url} (${validation.reason})`);
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
    const officialLink = await searchOfficialSite(keyword, googleCseKey, googleCseCx);
    if (officialLink) {
      const shortKeyword = keyword.length > 15 ? keyword.split(/\s+/).slice(0, 2).join(' ') : keyword;
      let btnText = `🔗 ${shortKeyword} 공식 사이트`;
      let hookText = `${shortKeyword}에 대해 더 알아보세요!`;
      // 🔥 HTTP HEAD 검증
      const validation = await validateCtaUrl(officialLink.url, { timeout: 5000 });
      if (validation.isValid) {
        const shortKeyword2 = keyword.length > 15 ? keyword.split(/\s+/).slice(0, 2).join(' ') : keyword;
        let btnText2 = `🔗 ${shortKeyword2} 공식 사이트`;
        let hookText2 = `${shortKeyword2}에 대해 더 알아보세요!`;

        if (keyword.match(/신청|접수|등록|발급/)) {
          btnText2 = '🚀 바로 신청하기';
          hookText2 = '지금 바로 신청을 진행해보세요!';
        } else if (keyword.match(/조회|확인|검색|계산/)) {
          btnText2 = '🔍 바로 조회하기';
          hookText2 = '간편하게 결과를 확인하세요.';
        } else if (keyword.match(/예약|예매/)) {
          btnText2 = '📅 바로 예약하기';
          hookText2 = '매진되기 전에 빠르게 예약하세요!';
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
        console.log(`[CTA] ✅ CSE 폴백 CTA 검증 성공: ${officialLink.url} (${validation.statusCode || 'OK'}, ${validation.elapsedMs}ms)`);
      } else {
        console.log(`[CTA] ❌ CSE 폴백 CTA URL 검증 실패: ${officialLink.url} (${validation.reason})`);
      }
    }
  }

  // 🔥 3단계: 크롤링 데이터에서 공식 링크 탐색
  if (safeCTAs.length === 0 && crawledPosts.length > 0) {
    const officialDomains = ['.go.kr', '.or.kr', '.ac.kr', '.re.kr', '.gov', '.edu', '.org'];
    const blogDomains = ['tistory', 'naver.com/blog', 'blog.naver', 'wordpress', 'blogspot', 'velog', 'brunch', 'medium.com'];

    for (const post of crawledPosts) {
      const url = post.url?.toLowerCase() || '';
      const isOfficial = officialDomains.some(d => url.includes(d));
      const isBlog = blogDomains.some(d => url.includes(d));
      if (isOfficial && !isBlog) {
        const validation = await validateCtaUrl(post.url || '', { timeout: 5000 });
        if (validation.isValid) {
          safeCTAs.push({
            hookingMessage: '정확한 정보는 공식 사이트에서 확인하세요!',
            buttonText: '🔗 공식 사이트 바로가기',
            url: post.url || '',
            position: 1,
            type: 'link',
            design: 'button',
            text: '🔗 공식 사이트 바로가기',
            hook: '정확한 정보는 공식 사이트에서 확인하세요!',
          });
          console.log(`[CTA] ✅ 크롤링 데이터 공식 링크 검증 성공: ${post.url} (${validation.statusCode || 'OK'}, ${validation.elapsedMs}ms)`);
          break;
        } else {
          console.log(`[CTA] ❌ 크롤링 데이터 공식 링크 검증 실패: ${post.url} (${validation.reason})`);
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
        const validation = await validateCtaUrl(mapping.url, { timeout: 5000 });
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
  const prompt = `
전체 내용:

${allContent.slice(0, 2000)}

핵심 요약표를 만드세요 (그리드 형식).

요구사항:
1. 한눈에 납득
2. 알찬 실질적 내용
3. 동적 생성

JSON:
{
  "type": "summary",
  "headers": ["항목", "내용"],
  "rows": [
    ["주요 내용", "핵심"],
    ["대상", "누구"],
    ["방법", "어떻게"],
    ["주의사항", "주의"],
    ["기대효과", "결과"]
  ]
}

JSON만:
`;

  try {
    const response = await callGeminiWithRetry(prompt);
    const json = response.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    return JSON.parse(json);
  } catch {
    return {
      type: 'summary',
      headers: ['항목', '내용'],
      rows: [
        ['주요 내용', '핵심 정보'],
        ['대상', '필요한 분'],
        ['방법', '실행 방법'],
        ['주의사항', '주의할 점'],
        ['기대효과', '얻을 수 있는 것'],
      ],
    };
  }
}

export async function generateHashtagsFinal(keyword: string, h2s: string[]): Promise<string> {
  const prompt = `
키워드: ${keyword}
H2들: ${h2s.join(', ')}

최소 10개 이상 해시태그를 만드세요.

요구사항:
1. # 사용 금지
2. , 로만 구분
3. 동적 생성

예: 태그1, 태그2, 태그3, ...

태그만:
`;

  try {
    const response = await callGeminiWithRetry(prompt);
    return response.trim();
  } catch {
    return `${keyword}, 정보, 가이드, 팁, 방법, 알아보기, 핵심정리, 총정리`;
  }
}
