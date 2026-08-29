/**
 * structure-guard — 발행 직전, **돈 한 푼 안 쓰고** 잡을 수 있는 결함을 찾는다. (v3.8.574)
 *
 * ## 왜 만드나
 * 사장님이 발행된 글을 LLM 에게 비평시켰더니 이런 게 나왔다:
 *   · "2·3·4세대는 있는데 **1세대 설명이 없고**, 첫 문장이 '반면'이라 앞 문단이 잘려나간 티가 나요"
 *   · "YMYL 치고 행동 지시가 단정적이에요 — '단호히 거부하세요'를 예외 없는 정답처럼"
 *
 * 사장님 말: "그런 글을 누가 올리고 싶어할까. 누군가 내 앱으로 글을 만들고 똑같이
 * 비평시키면 내 얼굴에 스스로 먹칠하는 꼴이다."
 *
 * ## 비용이 0 이어야 하는 이유
 * 제미나이 그라운딩·퍼플렉시티는 비싸서 못 쓴다. **무료에 가깝게 쓰게 하는 것**이
 * 이 앱의 차별점이다. 그래서 이 모듈은 **AI 를 한 번도 부르지 않는다.**
 * 글자를 세고 번호를 맞춰 보는 일이라 비용 0, 결과가 항상 같아 테스트가 된다.
 *
 * ## 막지 않는다
 * fact-guard 와 같은 원칙이다 — 예외를 던지지 않고, 판단이 안 서면 아무것도 보고하지 않는다.
 * 검수 때문에 발행이 멈추는 일은 만들지 않는다. 찾은 것은 **보고만** 한다.
 */

export type StructureIssueKind = 'enumeration-gap' | 'dangling-connective' | 'overclaim'
  | 'broken-table' | 'unfulfilled-heading' | 'subjectless-definition';

export interface StructureIssue {
  kind: StructureIssueKind;
  /** 사람이 읽고 바로 고칠 수 있게 쓴다 */
  detail: string;
  /** 문단 번호 — 있으면 그 문단만 고칠 수 있다 */
  paragraphIndex?: number;
}

/** 태그를 지우고 글자만 남긴다 */
function textOf(html: string): string {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 문단을 순서대로 — 번호로 되짚을 수 있게 */
function paragraphs(html: string): string[] {
  return Array.from(String(html || '').matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi), (m) => textOf(m[1] as string))
    .filter((t) => t.length > 0);
}

/**
 * ① 열거의 구멍 — "2·3·4세대는 있는데 1세대가 없다"
 *
 * 실제 사고가 이것이었다. 세대별 비교 섹션인데 1세대 문단이 통째로 빠져 있었고,
 * 그래서 첫 문장이 대뜸 "반면 …2세대는" 으로 시작했다.
 *
 * 두 가지만 본다 (억지로 만들지 않기 위해):
 *   · 범위 **안쪽**이 빈 경우 — 2,4 가 있는데 3 이 없다. 이건 거의 확실히 누락이다.
 *   · 1 이 없는데 3 이상까지 다룬 경우 — 2,3,4 를 다루면서 1 을 뺄 이유는 드물다.
 */
const ENUM_UNITS = ['세대', '단계', '차', '유형', '순위', '항목'];

export function findEnumerationGaps(html: string): StructureIssue[] {
  const text = textOf(html);
  const out: StructureIssue[] = [];

  for (const unit of ENUM_UNITS) {
    // "3세대" 는 잡고 "23세대" 나 "제3세대" 의 앞 글자는 안 잡는다
    const re = new RegExp(`(?<![0-9])([1-9])\\s?${unit}(?![0-9])`, 'g');
    const nums = [...new Set(Array.from(text.matchAll(re), (m) => Number(m[1])))].sort((a, b) => a - b);
    if (nums.length < 2) continue;

    const max = nums[nums.length - 1]!;
    const missing: number[] = [];
    for (let n = 1; n <= max; n += 1) {
      if (nums.includes(n)) continue;
      // 범위 안쪽 구멍은 항상 보고. 1 은 3 이상까지 다룰 때만 보고한다.
      if (n > nums[0]! || max >= 3) missing.push(n);
    }
    if (!missing.length) continue;

    out.push({
      kind: 'enumeration-gap',
      detail: `${unit} 열거에 구멍이 있습니다 — 다룬 것: ${nums.join('·')}${unit} / 빠진 것: ${missing.join('·')}${unit}`,
    });
  }
  return out;
}

/**
 * ② 앞이 잘린 문단 — 대조 접속사로 시작하는데 대조할 대상이 앞에 없다
 *
 * 좁게 본다. "하지만·반면"은 정상적으로도 자주 쓰이므로,
 * **소제목 바로 다음 첫 문단**이 대조 접속사로 시작할 때만 본다.
 * 그 자리는 앞 문단이 없으므로 대조할 것이 있을 수 없다.
 */
const CONTRAST_OPENERS = /^(반면|반대로|이와 달리|하지만|그러나|그런데도)/;

export function findDanglingConnectives(html: string): StructureIssue[] {
  const out: StructureIssue[] = [];
  const src = String(html || '');
  // 소제목(h2/h3) 뒤에 처음 오는 <p> 만 검사한다
  const re = /<h[23][^>]*>[\s\S]*?<\/h[23]>([\s\S]*?)(?=<h[23][^>]*>|$)/gi;
  let sectionIndex = 0;
  for (const m of src.matchAll(re)) {
    sectionIndex += 1;
    const first = paragraphs(m[1] as string)[0];
    if (!first) continue;
    const hit = first.match(CONTRAST_OPENERS);
    if (!hit) continue;
    out.push({
      kind: 'dangling-connective',
      detail: `${sectionIndex}번째 소제목의 첫 문단이 "${hit[1]}"으로 시작합니다 — 앞 내용이 빠졌을 수 있습니다: "${first.slice(0, 40)}…"`,
      paragraphIndex: sectionIndex,
    });
  }
  return out;
}

/**
 * ③ YMYL 단정 — 돈·건강·법률 글에서 예외 없는 정답처럼 말하는 표현
 *
 * 한두 번은 강조지만 여러 번 겹치면 "사안 따라 다르다"는 사실을 지운다.
 * 개수만 세고 문장은 고치지 않는다 — 무엇이 과한지는 사람이 판단할 일이다.
 */
const OVERCLAIM_WORDS = ['절대', '무조건', '반드시', '100%', '틀림없이', '하지 마세요', '단호히'];
const OVERCLAIM_LIMIT = 8;

export function findOverclaims(html: string): StructureIssue[] {
  const text = textOf(html);
  const counts = OVERCLAIM_WORDS
    .map((w) => ({ w, n: (text.match(new RegExp(w, 'g')) || []).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);

  const total = counts.reduce((a, x) => a + x.n, 0);
  if (total < OVERCLAIM_LIMIT) return [];

  return [{
    kind: 'overclaim',
    detail: `단정 표현이 ${total}회입니다 (${counts.slice(0, 4).map((c) => `${c.w} ${c.n}`).join(', ')}) — `
      + 'YMYL 주제에서는 "일반적으로 ~할 수 있습니다" 쪽이 안전합니다',
  }];
}

/** 셋을 한 번에 — 어떤 경우에도 던지지 않는다 */
export function findStructureIssues(html: string): StructureIssue[] {
  try {
    return [
      ...findEnumerationGaps(html),
      ...findDanglingConnectives(html),
      ...findOverclaims(html),
      ...findBrokenTables(html),
      ...findUnfulfilledHeadings(html),
      ...findSubjectlessDefinitions(html),
    ];
  } catch {
    return [];
  }
}

/**
 * ④ 표 무결성 — 행마다 칸 수가 다르면 표가 깨져 보인다. (v3.8.592)
 *
 * 실측(발행글 5432): 표2 가 `4,3,3,3` · 표3 이 `4,4,3,4` 였다.
 * 지류 온누리 행에서 열이 하나 비어 표가 밀렸다.
 * 사람은 한눈에 알아보지만 지금까지 아무 검사도 이걸 안 봤다.
 */
export function findBrokenTables(html: string): StructureIssue[] {
  const out: StructureIssue[] = [];
  const src = String(html || '');
  let tableIndex = 0;

  for (const t of src.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    tableIndex += 1;
    const counts = [...(t[0].matchAll(/<tr[\s\S]*?<\/tr>/gi))]
      .map((r) => [...(r[0].matchAll(/<t[dh]\b/gi))].length)
      .filter((n) => n > 0);
    if (counts.length < 2) continue;

    const widest = Math.max(...counts);
    const short = counts.filter((n) => n < widest).length;
    if (short === 0) continue;

    out.push({
      kind: 'broken-table',
      detail: `${tableIndex}번째 표의 칸 수가 행마다 다릅니다 (${counts.join(',')}) — ${short}개 행에서 칸이 빕니다`,
      paragraphIndex: tableIndex,
    });
  }
  return out;
}

/**
 * ⑤ 소제목이 약속한 것을 본문이 다루는가. (v3.8.592)
 *
 * 실측(발행글 5432): 섹션 5 제목이 "9월 대출규제 전 소비계획 점검"인데
 * 본문에 대출규제 이야기가 없었다. 크롤에 섞인 9월 대출규제 뉴스가 제목으로만 올라온 것이다.
 * 제목이 약속하고 안 지키면 독자는 속은 셈이고, 검색엔진도 제목·본문 불일치를 본다.
 *
 * 소제목의 **핵심 명사**가 그 섹션 본문에 한 번도 안 나오면 알린다.
 * 흔한 말(확인·정리·방법)은 세지 않는다 — 그건 어느 제목에나 있다.
 */
const HEADING_STOPWORDS = new Set([
  '확인', '점검', '정리', '방법', '기준', '조건', '비교', '준비', '순서', '항목',
  '이해하기', '알아보기', '살펴보기', '요약', '핵심', '전체', '먼저', '다음',
  '경우', '내용', '부분', '사항', '가지', '단계', '절차', '결제', '직전',
]);

/**
 * 우리가 넣는 **틀 제목**은 검사하지 않는다.
 * "성급한 분들을 위한 핵심 요약"·"전체 읽어보기 절차"는 내용을 약속하는 제목이 아니다.
 * 실측에서 이 둘이 오탐으로 잡혔다.
 */
const TEMPLATE_HEADINGS = /(핵심\s*요약|읽어보기|자주\s*묻는|FAQ|목차|한눈에)/i;

/**
 * 조사·어미가 붙은 어절은 명사가 아니다.
 * 실측 오탐: "성급한"·"분들을"·"읽어보기"를 핵심 명사로 집었다.
 */
const HEADING_TAIL = /(을|를|이|가|은|는|의|에|로|으로|과|와|한|된|할|들|하기|보기|기의|부터|에서|까지|마다|조차|이나|라도|처럼|보다|에게|한테|으로는|에서는|나|든|든지|랑)$/;

export function findUnfulfilledHeadings(html: string): StructureIssue[] {
  const out: StructureIssue[] = [];
  const src = String(html || '');
  let sectionIndex = 0;

  for (const m of src.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>([\s\S]*?)(?=<h[23][^>]*>|$)/gi)) {
    sectionIndex += 1;
    const heading = textOf(m[1] as string).replace(/^[\d.\-\s]+/, '').trim();
    const body = textOf(m[2] as string);
    if (!heading || body.length < 80) continue;   // 본문이 거의 없으면 다른 검사가 잡는다
    if (TEMPLATE_HEADINGS.test(heading)) continue;

    /**
     * **네 글자 이상**의 낱말만 본다.
     * 실측 사고가 "대출규제"(4자)였고, 세 글자까지 열면 조사 섞인 토막이 걸린다.
     * 그리고 하나라도 빠지면 알린다 — 예전엔 "전부 빠졌을 때만" 이라 정작
     * 그 사고(제목에 대출규제·소비계획이 있고 소비계획만 본문에 있던 경우)를 놓쳤다.
     */
    const nouns = (heading.match(/[가-힣]{2,12}/g) || [])
      .filter((w) => w.length >= 4)
      .filter((w) => !HEADING_STOPWORDS.has(w))
      .filter((w) => !HEADING_TAIL.test(w));
    if (nouns.length === 0) continue;

    const missing = nouns.filter((w) => !body.includes(w));
    if (missing.length === 0) continue;

    out.push({
      kind: 'unfulfilled-heading',
      detail: `${sectionIndex}번째 소제목 "${heading.slice(0, 30)}"이(가) 약속한 내용(${missing.join(', ')})이 본문에 없습니다`,
      paragraphIndex: sectionIndex,
    });
  }
  return out;
}

/**
 * ⑥ 주어 없는 정의문 — "…곳을 뜻합니다" (무엇이?) (v3.8.592)
 *
 * ## 실측 사고 (발행글 5432, 소제목 "2-1. 상품권과 가맹점 구분")
 *   "각 지자체가 판매하는 지역사랑상품권을 쓸 수 있는 가맹점 가운데,
 *    해당 지자체의 할인 판매 조건이 붙은 상품권으로 결제 가능한 곳을 뜻합니다."
 * 무엇이 그런 곳인지가 문장에 없다. 소제목이 "지자체 할인가맹점"이니 그 말이 주어여야 하는데,
 * 정의를 하면서 **정의 대상의 이름을 한 번도 대지 않았다.**
 *
 * ## 어떻게 가리나 — 처음 시도는 실패했다
 * "문장에 은/는 이 있는가"로 봤더니 **놓쳤다.** 위 문장의 "판매**하는**" 이
 * 주어 표지로 잡혔기 때문이다. 한국어 관형형 어미(하는·되는·붙은)가 전부 걸린다.
 *
 * 그래서 성질을 바꿔 본다 — **정의문은 주어를 맨 앞에 댄다.**
 *   ✅ "지역사랑상품권**은** …을 뜻합니다"      (1번째 어절)
 *   ✅ "우리나라에서 지역사랑상품권**은** …"     (2번째 어절)
 *   ❌ "각 / 지자체가 / 판매하는 …"             (앞 두 어절에 표지 없음)
 *
 * 실측: 정상 정의문 5개 통과 · 사고 문장 2개 적발 · 발행글 4편에서 오탐 0건.
 */
const DEFINITION_END = /(뜻합니다|말합니다|의미합니다|가리킵니다|뜻해요|말해요|의미해요)[.。]?\s*$/;
const SUBJECT_MARK = /(은|는|이란|란|이라|라)$/;

function namesItsSubject(sentence: string): boolean {
  return String(sentence).trim().split(/\s+/).slice(0, 2).some((w) => SUBJECT_MARK.test(w));
}

export function findSubjectlessDefinitions(html: string): StructureIssue[] {
  const out: StructureIssue[] = [];
  const sentences = textOf(html)
    .split(/(?<=[.!?])\s+|(?<=[다요])\.\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);

  for (const s of sentences) {
    if (!DEFINITION_END.test(s)) continue;
    if (namesItsSubject(s)) continue;
    out.push({
      kind: 'subjectless-definition',
      detail: `정의문에 주어가 없습니다 — 무엇을 설명하는지 밝히세요: "${s.slice(0, 50)}…"`,
    });
  }
  return out;
}

/** 로그 한 줄 — 발행 로그에 그대로 찍는다 */
export function describeStructureIssues(issues: StructureIssue[]): string {
  if (!issues.length) return '구조 검사 통과 — 열거 누락·앞 잘린 문단·과한 단정·표·소제목 이상 없음';
  return `구조 검사 ${issues.length}건:\n` + issues.map((i) => `  · ${i.detail}`).join('\n');
}
