/**
 * 🎚️ 깊이와 목소리 (v3.8.662)
 *
 * 사장님(2026-09-06): "난 여기에 인생을 걸었어 … 100점까지 글의 깊이와 목소리를 끌어올려줬으면 해"
 *                     "반드시 100점이 될 수 있다는 건 거짓이겠지. 그에 근접하게 해주면 돼."
 *
 * 흐름 규칙(v3.8.660) 뒤 5편을 읽고 남은 격차는 셋이었다:
 *   ① 판단이 얕다 — "메모해 두는 쪽입니다" 는 관점이 아니다. 조건과 행동이 있어야 판단이다.
 *   ② 자료의 깊이를 글이 버린다 — 생성 로그마다 "자료가 되풀이하는데 본문에 없는 수치" 가 6개씩 찍혔다.
 *      그 수치는 생성 **뒤**에만 세고 있었다. 생성 **전**에 문장째 넘겨 주면 쓸 수 있다 (호출 0).
 *   ③ 표가 절마다 같은 틀("누구에게 맞는지" 열) — 양식이 보이면 사람 글이 아니다.
 *
 * 100점을 보장하지 않는다. 대신 "읽어서 잡히는 결함 0" 과 "판단에 조건·행동이 있는 글" 까지 민다.
 */

import type { AuditIssue } from './article-audit';

export const DEPTH_VOICE_RULES = `

🎚️ [깊이와 목소리 — 판단은 조건과 행동으로, 수치는 자료 그대로] (v3.8.662)
1. **판단 문장에는 조건과 행동이 둘 다 있어야 합니다.** "…쪽입니다" 로 끝내면 판단이 아닙니다.
   ❌ "공고문을 한 번 읽고 끝내기보다 메모해 두는 쪽입니다." (조건도 행동도 없음)
   ✅ "경남 사업자라면 10월 안내를 기다리지 말고 지금 손해보험 공고부터 읽으세요. 신용생명보험은 대출이 있을 때만 의미가 있기 때문입니다."
   조건(누가·언제·어떤 경우) + 행동(무엇을 먼저 한다/하지 않는다) + 이유(자료의 어느 사실 때문인지).
2. **절 다섯 개는 한 방향으로 걷습니다.** 역할을 나눠 맡습니다 — 소제목은 바꾸지 말고 역할만 맡깁니다:
   문제의 상황 정의 → 갈림길(조건별로 갈리는 지점) → 예외·함정(흔한 오해) → 사례·수치(자료의 숫자로 구체화) → 결정(오늘 할 일).
   뒤 절은 앞 절이 정한 것을 다시 설명하지 않고 그 위에 올라섭니다. 같은 갈림길을 두 절이 설명하면 하나는 지웁니다.
3. **자료가 되풀이하는 수치는 문장째 씁니다.** 아래 [자료가 되풀이하는 수치] 에 있는 값은 그 절의 판단 근거로 본문에 그대로 넣습니다.
   "차이가 있다" 로 뭉개지 말고 두 값을 다 적습니다. 자료에 없는 수치는 만들지 않습니다.
4. **표는 글 전체에 최대 3개.** 수치나 조건을 실제로 비교할 때만 씁니다. "누구에게 맞는지" 열을 습관처럼 붙이지 마세요.
   표가 없는 절은 문단으로 씁니다 — 표 대신 사례 한 단락이 더 깊습니다. (넘치면 코드가 숫자가 적은 표부터 뺍니다.)
   **분량은 전체 6,000~9,000자.** H2 하나에 H3 는 하나가 기본입니다. 같은 절을 H3 둘로 쪼개 같은 말을 두 번 하지 마세요 — 12,000자 글은 되풀이가 만든 길이입니다.
5. **곁가지 절 금지.** 제목이 부른 독자에게 필요 없는 절(국내 코스닥 보유자 글의 나스닥 절, 햇살론 글의 특정 지역 센터 절)은 검색어에 딸려 온 것입니다. 그 절은 제목의 독자에게 무엇을 주는지 첫 문장에서 잇지 못하면 뺍니다.
`;

/* ────────────────────────────────────────────────────────────────
 * ② 자료가 되풀이하는 수치 — 생성 전에 문장째 넘긴다
 * ──────────────────────────────────────────────────────────────── */

const VALUE_RE = /\d{1,3}(?:,\d{3})+(?:\s?(?:원|만원|억원|억|명|건|개|곳|대))?|\d+(?:\.\d+)?\s?%p?|\d+(?:\.\d+)?\s?(?:만원|억원|억|천원|원|개월|년|주|일|시간|명|건|회|곳|대|세|평|㎡|층|호)|\d{1,2}월\s?\d{1,2}일|20\d\d년\s?\d{1,2}월|20\d\d년/g;

/** 값 표기 정규화 — "14.7 %" 와 "14.7%" 는 같은 값 */
function normValue(v: string): string {
  return v.replace(/\s+/g, '');
}

/** 값 하나가 들어 있는 첫 문장 (160자 이내) — 모델이 문맥째 쓰게 */
function sentenceWith(text: string, value: string): string {
  const flat = text.replace(/\s+/g, ' ');
  const at = flat.indexOf(value);
  if (at === -1) return '';
  const start = Math.max(0, flat.lastIndexOf('. ', at) + 1, flat.lastIndexOf('\n', at) + 1);
  let end = flat.indexOf('. ', at);
  if (end === -1 || end - start > 220) end = Math.min(flat.length, at + 120);
  return flat.slice(start, end + 1).trim().slice(0, 160);
}

export interface RepeatedFact { value: string; count: number; sentence: string }

/**
 * 근거에서 두 번 이상 나오는 수치를 문장과 함께 뽑는다. 최대 8개, 많이 되풀이되는 순.
 * 연도만 있는 값("2026년")은 뼈대가 아니라 날짜라 뺀다.
 */
export function extractRepeatedFacts(evidenceText: string, max = 8): RepeatedFact[] {
  const text = String(evidenceText || '');
  const counts = new Map<string, { raw: string; n: number }>();
  for (const m of text.matchAll(VALUE_RE)) {
    const raw = m[0].trim();
    if (/^20\d\d년$/.test(raw)) continue;
    const key = normValue(raw);
    const cur = counts.get(key);
    if (cur) cur.n += 1; else counts.set(key, { raw, n: 1 });
  }
  return [...counts.values()]
    .filter((c) => c.n >= 2)
    .sort((a, b) => b.n - a.n)
    .slice(0, max)
    .map((c) => ({ value: c.raw, count: c.n, sentence: sentenceWith(text, c.raw) }))
    .filter((f) => f.sentence.length >= 10);
}

/**
 * 프롬프트 블록. 되풀이 수치가 없으면 빈 문자열.
 * v3.8.663 실측: 대출 갈아타기 글에 "삼성전자 사내 주거안정 대출 최대 5억원·1.5%" 가 세 번 들어갔다 — 자료(뉴스 묶음)에 되풀이된
 * 숫자라고 다 뼈대는 아니다. 제목·키워드 낱말이 든 문장의 수치만 넘기고, 무관한 수치는 건너뛰라고 못 박는다.
 */
export function buildRepeatedFactsBlock(evidenceText: string, opts: { keyword?: string; title?: string } = {}): string {
  const topic = [...new Set(`${opts.keyword || ''} ${opts.title || ''}`.replace(/[^가-힣0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 2))];
  let facts = extractRepeatedFacts(evidenceText);
  if (topic.length > 0) {
    // "대출" 한 낱말은 아무 문장에나 있다 — 주제 낱말이 둘 이상 든 문장만 관련 있다고 본다 (주제 낱말이 하나뿐이면 하나)
    const need = Math.min(2, topic.length);
    const related = facts.filter((f) => topic.filter((w) => f.sentence.includes(w)).length >= need);
    // 관련 수치가 하나라도 있으면 그것만 넘긴다 — 없는 것보다 무관한 수치가 들어가는 쪽이 더 나쁘다(삼성전자 사내 대출 실측)
    if (related.length >= 1) facts = related;
  }
  facts = facts.slice(0, 6);
  if (facts.length === 0) return '';
  return [
    '',
    '🔢 [자료가 되풀이하는 수치 — 이 글의 뼈대. 본문에 그대로 쓰세요]',
    ...facts.map((f) => `   · ${f.value} (${f.count}회) — "${f.sentence}"`),
    '이 수치가 들어갈 절에서 판단의 근거로 씁니다. 값을 바꾸거나 어림하지 않습니다. 자료에 없는 수치는 만들지 않습니다.',
    '⚠️ 수치의 주체가 제목의 독자와 다른 곳(특정 회사의 사내 제도, 다른 상품·다른 지역)이면 쓰지 않습니다 — 관련 있는 것만 고르고, 같은 수치를 두 절에 되풀이하지 않습니다.',
    '',
  ].join('\n');
}

/* ────────────────────────────────────────────────────────────────
 * ① 얕은 판단 — 조건도 행동도 없는 "…쪽입니다"
 * ──────────────────────────────────────────────────────────────── */

/** 판단 문장 — 1인칭 말머리 또는 판단 어미 (narrative-flow 의 FIRST_PERSON_STANCE 와 같은 눈) */
// v3.8.663 실측: 모델은 "판단이 타당합니다 / 편이 낫습니다 / 쪽이 맞습니다 / 더 직접적입니다" 로도 판단을 닫는다 — 그것도 판단이다
const STANCE_ANY = /제\s*(?:판단|생각|의견|결론)(?:은|으로는?|엔|에는|이|을)|저는\s|제가\s*보기(?:엔|에는)|저라면|맞다고\s*봅니다|(?:으로|로)\s*봅니다|쪽입니다|쪽으로\s*봅니다|(?:쪽|편|것|판단|순서|방식|기록)(?:이|은)\s*(?:더\s*)?(?:맞습니다|낫습니다|타당합니다|합리적입니다|자연스럽습니다|현실적입니다|직접적입니다|안전합니다|정확합니다)|권합니다|권하지\s*않습니다|먼저라는\s*쪽|여기서는\s[^.]{0,80}?(?:맞습니다|낫습니다|타당합니다|봅니다)/;
const CONDITION = /(?:라면|이라면|이면|면\s|경우|때는|때에는|일수록|있다면|없다면|받았다면|않았다면|중이라면|전이라면|뒤라면|이상|미만|까지는|부터는|나왔다면|없으면|있으면|거절됐다면|부결됐다면)/;
const ACTION = /(?:신청|접수|내세요|내는|제출|확인|읽|보세요|보는|기다리|미루|먼저|나중|택|고르|바꾸|바꿔|넣|빼|줄이|늘리|묻|문의|정리|대조|분리|나누|피하|말고|하지\s*않|않는|권하|권합|보류|서두르|멈추|시작|짚|검토|비교)/;

export interface StanceStats { total: number; sharp: number; shallow: string[] }

/**
 * 판단 문장 가운데 조건·행동을 갖춘 것을 센다.
 * 판단 문장 = 판단 표현이 든 문장 + 바로 다음 문장(이유). 문장 단위로 잰다 — 200자 창은 앞 문장을 끌어들여 오탐이 났다.
 */
export function measureStances(plainText: string): StanceStats {
  const sentences = String(plainText || '').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const shallow: string[] = [];
  let total = 0;
  let sharp = 0;
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i]!;
    if (!STANCE_ANY.test(s)) continue;
    total += 1;
    const pair = `${s} ${sentences[i + 1] || ''}`;
    if (CONDITION.test(pair) && ACTION.test(pair)) sharp += 1;
    else shallow.push(s.slice(0, 70));
  }
  return { total, sharp, shallow };
}

export function findShallowStances(plainText: string): AuditIssue[] {
  const s = measureStances(plainText);
  if (s.total < 3 || s.sharp / s.total >= 0.5) return [];
  return [{
    kind: 'stance-shallow',
    title: `판단 ${s.total}개 중 ${s.sharp}개만 조건과 행동이 있습니다`,
    evidence: `얕은 판단: "${s.shallow[0] || ''}…" — "…쪽입니다" 로 끝나는 문장은 관점이 아닙니다. 누가·어떤 경우에·무엇을 먼저 하는지가 있어야 합니다.`,
    penalty: 6,
  }];
}

/* ────────────────────────────────────────────────────────────────
 * ③ 표 양식 반복
 * ──────────────────────────────────────────────────────────────── */

export function findTableTemplate(html: string, sectionCount: number): AuditIssue[] {
  const src = String(html || '');
  const tables = [...src.matchAll(/<table[\s\S]*?<\/table>/gi)].map((m) => m[0]);
  if (tables.length === 0) return [];
  const lastHeaders = tables.map((t) => {
    const ths = [...t.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((h) => h[1]!.replace(/<[^>]+>/g, '').trim());
    return ths[ths.length - 1] || '';
  }).filter(Boolean);
  const freq = new Map<string, number>();
  for (const h of lastHeaders) freq.set(h, (freq.get(h) || 0) + 1);
  const [topHeader, topCount] = [...freq.entries()].sort((a, b) => b[1] - a[1])[0] || ['', 0];
  const tooMany = sectionCount >= 3 && tables.length > 3;
  const sameShape = topCount >= 3;
  if (!tooMany && !sameShape) return [];
  return [{
    kind: 'table-template',
    title: tooMany
      ? `표가 ${tables.length}개입니다 (절 ${sectionCount}개) — 절마다 표를 붙였습니다`
      : `표 ${topCount}개의 마지막 열이 똑같이 "${topHeader}" 입니다 — 양식이 보입니다`,
    evidence: '표는 수치·조건을 실제로 비교할 때만 씁니다. 같은 틀의 표가 절마다 나오면 독자는 양식을 보고, 검색엔진은 찍어낸 글로 읽습니다.',
    penalty: 4,
  }];
}
