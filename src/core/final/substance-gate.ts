// src/core/final/substance-gate.ts
// 🧱 본문 "실속" 검증 게이트
//
// 기존 게이트(quality-gate.ts)는 전부 분량 지표다 — 글자수·단락수·출처 언급수·문장 평균 길이.
// 그래서 "9,000자짜리 순수 헛소리"가 모든 게이트를 통과한다. 실제로 발행된 글에서
// "🔍 노선 및 시간표 조회하기 정확한 내용은 공식 사이트에서 확인해주세요." 같은 문장이
// 섹션 마무리로 반복 등장하는 것을 확인했다 (2026-07-25 실측).
//
// 이 모듈은 분량이 아니라 **정보 밀도**를 잰다:
//   구체 팩트(금액·비율·날짜·기간·수량·법조문·기관명)가 1,000자당 몇 개나 있는가
//   그리고 "공식 사이트에서 확인하세요" 같은 책임 회피 문장이 몇 개나 있는가.

export interface SubstanceMetrics {
  /** HTML 제거 후 평문 글자수 */
  chars: number;
  /** 구체 팩트 개수 (중복 구간 병합 후) */
  concreteFacts: number;
  /** 1,000자당 구체 팩트 수 — 핵심 지표 */
  factsPer1000: number;
  /** "공식 사이트에서 확인하세요" 류 책임 회피 표현 수 */
  deferrals: number;
  /** "상황에 따라 달라질 수 있습니다" 류 얼버무림 표현 수 */
  hedges: number;
  /** 1,000자당 (회피 + 얼버무림) 수 */
  vaguePer1000: number;
  /** 구체 팩트가 하나도 없는 단락 수 */
  emptyParagraphs: number;
  /** 전체 단락 수 */
  totalParagraphs: number;
}

export interface SubstanceReport {
  passed: boolean;
  /** 0~100 — 높을수록 알맹이 있음 */
  score: number;
  metrics: SubstanceMetrics;
  /** 재생성 프롬프트에 그대로 넣을 실제 문제 문장 (최대 5개) */
  worstSentences: string[];
  summary: string;
}

/** 구체 팩트 패턴 — 매치 '구간'을 모아 겹치면 1개로 병합한다(이중 계수 방지). */
const FACT_PATTERNS: RegExp[] = [
  /\d[\d,.]*\s*(?:원|만원|억원|천원|달러|USD|엔|유로)/g,                                  // 금액
  /[$₩€£]\s?\d[\d,.]*/g,                                                                  // 통화기호 금액
  /\d+(?:\.\d+)?\s*(?:%|퍼센트|프로)/g,                                                    // 비율
  /\d{4}\s*년(?:\s*\d{1,2}\s*월)?(?:\s*\d{1,2}\s*일)?/g,                                   // 연/월/일
  /\d{1,2}\s*월\s*\d{1,2}\s*일/g,                                                          // 월/일
  /\d[\d,]*\s*(?:명|건|개|회|곳|가지|배|위|점|권|장|부|종|칸|층)/g,                          // 수량
  /\d[\d,]*\s*(?:시간|분|초|일|주|개월|년|주일|영업일)/g,                                    // 기간
  /\d[\d,.]*\s*(?:km|m|cm|kg|g|평|㎡|m²|L|ml|GB|MB)/gi,                                    // 단위
  /제\s?\d+\s?(?:조|항|호|장|절)/g,                                                        // 법조문
  /\d{2,4}-\d{3,4}-\d{4}/g,                                                                // 전화번호
  /[가-힣]{2,10}(?:청|처|부|원|공단|공사|위원회|협회|재단|연구원|학회|진흥원|은행)(?![가-힣])/g, // 기관명
];

/** 책임 회피 — "확인은 네가 알아서" 류 */
const DEFERRAL_PATTERNS: RegExp[] = [
  /공식\s*(?:사이트|홈페이지|누리집|웹사이트|채널)[^.。!?<]{0,25}(?:확인|참고|문의|조회)/g,
  /홈페이지[^.。!?<]{0,20}(?:확인|참고|조회)(?:하|해|바랍)/g,
  /(?:문의|상담)하(?:시기\s*바랍니다|세요|시면\s*됩니다)/g,
  /자세한\s*(?:내용|사항|정보|기준)(?:은|는)[^.。!?<]{0,30}(?:확인|참고|문의|조회)/g,
  /반드시\s*확인하(?:세요|시기|시는)/g,
  /미리\s*확인하(?:는\s*것이|시는\s*것이|세요)/g,
];

/** 얼버무림 — 정보를 주지 않고 빠져나가는 표현 */
const HEDGE_PATTERNS: RegExp[] = [
  /달라질\s*수\s*있(?:습니다|어요|으니)/g,
  /다를\s*수\s*있(?:습니다|어요|으니)/g,
  /변동될\s*수\s*있(?:습니다|어요|으니)/g,
  /상황에\s*따라\s*(?:다르|달라)/g,
  /개인(?:별로|마다)\s*(?:다르|달라)/g,
  /경우에\s*따라\s*(?:다르|달라)/g,
];

/** HTML → 평문 */
export function stripToPlainText(html: string): string {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 겹치는 매치 구간을 병합해서 개수를 센다 — "2026년 7월 8일"이 3번 세어지는 것을 막는다. */
function countMergedMatches(text: string, patterns: RegExp[]): number {
  const spans: Array<[number, number]> = [];
  for (const pattern of patterns) {
    const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) { re.lastIndex++; continue; }
      spans.push([m.index, m.index + m[0].length]);
    }
  }
  if (spans.length === 0) return 0;
  spans.sort((a, b) => a[0] - b[0]);
  let count = 1;
  let currentEnd = spans[0]![1];
  for (let i = 1; i < spans.length; i++) {
    const [start, end] = spans[i]!;
    if (start >= currentEnd) {
      count++;
      currentEnd = end;
    } else if (end > currentEnd) {
      currentEnd = end;
    }
  }
  return count;
}

function countMatches(text: string, patterns: RegExp[]): number {
  let total = 0;
  for (const pattern of patterns) {
    const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    const found = text.match(re);
    if (found) total += found.length;
  }
  return total;
}

/** 한국어 문장 분리 — 종결어미/문장부호 기준 */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|(?<=(?:다|요)\.)\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

export interface SubstanceInput {
  /** 본문 HTML 또는 평문 */
  contentHtml: string;
  /** 단락 단위 검사용 — 없으면 contentHtml에서 <p>/<li>로 추출 */
  paragraphs?: string[];
}

/** 기본 임계값 — 실제 발행 글 6편 실측으로 보정 (2026-07-25) */
export const SUBSTANCE_THRESHOLDS = {
  /** 1,000자당 구체 팩트 최소 개수 */
  minFactsPer1000: 6,
  /** 1,000자당 회피+얼버무림 최대 개수 */
  maxVaguePer1000: 1.2,
  /** 팩트 없는 단락 비율 상한 */
  maxEmptyParagraphRatio: 0.55,
  /** 통과 최소 점수 */
  minScore: 60,
};

export function scanSubstance(input: SubstanceInput): SubstanceReport {
  const text = stripToPlainText(input.contentHtml);
  const chars = text.length;

  const concreteFacts = countMergedMatches(text, FACT_PATTERNS);
  const deferrals = countMatches(text, DEFERRAL_PATTERNS);
  const hedges = countMatches(text, HEDGE_PATTERNS);

  const per1000 = (n: number) => (chars > 0 ? (n / (chars / 1000)) : 0);
  const factsPer1000 = Number(per1000(concreteFacts).toFixed(2));
  const vaguePer1000 = Number(per1000(deferrals + hedges).toFixed(2));

  // 단락별 검사
  const rawParagraphs = input.paragraphs && input.paragraphs.length > 0
    ? input.paragraphs
    : (String(input.contentHtml || '').match(/<(?:p|li)\b[^>]*>[\s\S]*?<\/(?:p|li)>/gi) || []);
  const paragraphTexts = rawParagraphs
    .map(p => stripToPlainText(p))
    .filter(p => p.length >= 40); // 너무 짧은 단락은 판정 제외
  const emptyParagraphs = paragraphTexts.filter(p => countMergedMatches(p, FACT_PATTERNS) === 0).length;
  const totalParagraphs = paragraphTexts.length;
  const emptyParagraphRatio = totalParagraphs > 0 ? emptyParagraphs / totalParagraphs : 0;

  // 문제 문장 추출 — 회피/얼버무림이 있고 구체 팩트가 없는 문장
  const worstSentences: string[] = [];
  for (const sentence of splitSentences(text)) {
    if (sentence.length < 20 || sentence.length > 200) continue;
    const isVague = countMatches(sentence, DEFERRAL_PATTERNS) > 0 || countMatches(sentence, HEDGE_PATTERNS) > 0;
    if (isVague && countMergedMatches(sentence, FACT_PATTERNS) === 0) {
      worstSentences.push(sentence);
      if (worstSentences.length >= 5) break;
    }
  }

  // 점수 — 팩트 밀도 60점 + 회피 억제 25점 + 빈 단락 억제 15점
  const factScore = Math.round(Math.min(1, factsPer1000 / SUBSTANCE_THRESHOLDS.minFactsPer1000) * 60);
  const vagueScore = Math.round(Math.max(0, 1 - vaguePer1000 / Math.max(0.01, SUBSTANCE_THRESHOLDS.maxVaguePer1000)) * 25);
  const paragraphScore = Math.round(Math.max(0, 1 - emptyParagraphRatio / Math.max(0.01, SUBSTANCE_THRESHOLDS.maxEmptyParagraphRatio)) * 15);
  const score = Math.max(0, Math.min(100, factScore + vagueScore + paragraphScore));

  const passed = score >= SUBSTANCE_THRESHOLDS.minScore
    && factsPer1000 >= SUBSTANCE_THRESHOLDS.minFactsPer1000 * 0.7;

  const metrics: SubstanceMetrics = {
    chars,
    concreteFacts,
    factsPer1000,
    deferrals,
    hedges,
    vaguePer1000,
    emptyParagraphs,
    totalParagraphs,
  };

  const summary = passed
    ? `✅ 실속 게이트 통과 (점수 ${score}, 팩트 ${concreteFacts}개=${factsPer1000}/1000자, 회피 ${deferrals + hedges}건, 빈 단락 ${emptyParagraphs}/${totalParagraphs})`
    : `⚠️ 실속 부족 (점수 ${score}/${SUBSTANCE_THRESHOLDS.minScore}, 팩트 ${factsPer1000}/1000자 < ${SUBSTANCE_THRESHOLDS.minFactsPer1000}, 회피 ${deferrals + hedges}건, 빈 단락 ${emptyParagraphs}/${totalParagraphs})`;

  return { passed, score, metrics, worstSentences, summary };
}

/** 실속 미달 시 재생성 프롬프트에 덧붙일 지시 블록 */
export function buildSubstanceRetryBlock(report: SubstanceReport): string {
  const { metrics, worstSentences } = report;
  const examples = worstSentences.length > 0
    ? `\n\n❌ 직전 응답에서 실제로 나온 "알맹이 없는 문장"입니다. 이런 문장은 한 개도 쓰지 마세요:\n${worstSentences.map(s => `   - "${s}"`).join('\n')}`
    : '';

  return `

🚨🚨🚨 **재시도 — 실속(정보 밀도) 강제 규칙** 🚨🚨🚨
직전 응답은 분량은 채웠지만 알맹이가 없었습니다.
측정 결과: 구체 팩트 1,000자당 ${metrics.factsPer1000}개 (기준 ${SUBSTANCE_THRESHOLDS.minFactsPer1000}개 이상),
책임 회피 문장 ${metrics.deferrals + metrics.hedges}건, 구체 정보가 아예 없는 단락 ${metrics.emptyParagraphs}/${metrics.totalParagraphs}개.${examples}

✅ 이번엔 반드시 지키세요:
1. **모든 단락에 최소 1개의 구체 정보**를 넣으세요. 구체 정보 = 금액·비율·기간·수량·날짜·기관명·법조문·메뉴 경로·서류 이름 중 하나.
2. **"공식 사이트에서 확인하세요"로 문단을 끝내지 마세요.** 확인이 필요하면 "어디의 무슨 메뉴에서, 무엇을 준비해서, 무엇을 보면 되는지"까지 쓰세요.
3. **"상황에 따라 달라질 수 있습니다"만 쓰고 끝내지 마세요.** 무엇에 따라 어떻게 갈리는지 조건을 나열하세요.
   예) ❌ "지원금은 상황에 따라 달라질 수 있어요."
       ✅ "지원금은 가구원 수로 갈립니다. 1인 가구는 월 30만 원, 4인 가구는 월 80만 원 구간이에요."
4. 백그라운드 컨텍스트에 실제 숫자·기관명이 있으면 **그대로 본문에 옮기세요.** 요약하면서 숫자를 빼지 마세요.
5. 숫자를 확인할 수 없으면 지어내지 말고, 대신 **판단 기준 / 절차 / 준비물 / 흔한 실수**를 구체적으로 채우세요.
`;
}
