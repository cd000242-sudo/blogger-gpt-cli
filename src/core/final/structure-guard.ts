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

export type StructureIssueKind = 'enumeration-gap' | 'dangling-connective' | 'overclaim';

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
    ];
  } catch {
    return [];
  }
}

/** 로그 한 줄 — 발행 로그에 그대로 찍는다 */
export function describeStructureIssues(issues: StructureIssue[]): string {
  if (!issues.length) return '구조 검사 통과 — 열거 누락·앞 잘린 문단·과한 단정 없음';
  return `구조 검사 ${issues.length}건:\n` + issues.map((i) => `  · ${i.detail}`).join('\n');
}
