/**
 * key-fact-gate — **근거에 있는 핵심 수치가 본문에 안 들어갔는지** 본다. (v3.8.591)
 *
 * ## 실제 사고 (발행글 5432)
 * "2026년 9월 추석 대비 지자체 10% 할인가맹점" 글에 **할인율이 한 번도 안 나왔다.**
 * 제목의 10%조차 본문에 없었다. 그 글의 존재 이유가 "9월 추석 할인"인데.
 *
 * 결정적 물증: 본문에 "평달과 명절 달의 차이도 분명합니다"라고 써 놓고
 * **그 차이가 뭔지 끝까지 말하지 않았다.** 사실이 빠진 자리에 접속 문장만 남았다.
 *
 * ## 근거에는 있었다 (실측)
 *   네이버 무료 근거 6,892자 — 10% 9회 · 15% 2회 · 25% 2회
 *     "보령사랑상품권은 구매 시 10% 할인 … 통합 1인당 월 70만 원"
 *     "평달에는 결제 금액의 10%, 명절이 있는 달에는 15%의 캐시백"
 *   퍼플렉시티 2,351자 — 10% 13회
 * 즉 자료를 못 구한 게 아니라 **손에 쥐고도 안 썼다.**
 *
 * ## 기존 검사가 왜 못 잡나 — 전부 반대 방향을 본다
 *   · fact-guard      : 근거에 **없는** 수치를 찾는다 (지어내기)
 *   · 실속 게이트      : 팩트 **밀도**를 잰다 — 다른 숫자로 채우면 통과한다
 *                        (실측: 이 글이 팩트 74개로 91점을 받았다)
 *   · 최신성 검사      : 개념 단위라 수치를 안 본다
 * 지어내기는 잘 막는데 **빠뜨리기**를 보는 눈이 없었다. 이 모듈이 그 자리다.
 *
 * ## 무엇을 핵심으로 보나
 * 근거에서 **여러 번 되풀이되는 수치**다. 한 문서에만 스친 숫자는 곁가지일 수 있지만,
 * 여러 자료가 같은 값을 말하면 그건 그 주제의 뼈대다.
 * 여기에 **키워드가 약속한 수치**(제목의 10%)를 더한다 — 그건 무조건 답해야 한다.
 *
 * ## 막지 않는다
 * 알리기만 한다. 다시 쓰면 본문급 호출이 하나 더 붙어 비용이 두 배가 된다.
 * (사장님 원칙: 검수 때문에 발행이 막히면 안 된다 · 비용은 고정이어야 한다)
 */

/** 수치로 볼 것 — 실속 게이트의 팩트 패턴 중 **값이 뚜렷한 것**만 */
const VALUE_PATTERNS: RegExp[] = [
  /\d+(?:\.\d+)?\s*%/g,                                   // 10% · 15.5%
  /\d[\d,]*\s*(?:억|천만|백만|십만|만|천)?\s*원/g,          // 70만원 · 1,200원
  /\d[\d,]*\s*(?:개월|일|주|년|시간|회|명|건)/g,            // 6개월 · 91일
];

const normalize = (v: string): string => v.replace(/\s+/g, '');

function extractValues(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const src = String(text || '');
  for (const pattern of VALUE_PATTERNS) {
    const re = new RegExp(pattern.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      if (!m[0]) { re.lastIndex += 1; continue; }
      const key = normalize(m[0]);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return counts;
}

/** 근거에서 이만큼 되풀이되면 "이 주제의 뼈대"로 본다 */
const REPEAT_MIN = 2;
/** 한 번에 알릴 최대 개수 — 목록이 길면 아무도 안 읽는다 */
const MAX_REPORT = 6;

export interface MissingFacts {
  /** 키워드가 약속했는데 본문에 없는 수치 — 가장 나쁜 경우 */
  promised: string[];
  /** 근거가 되풀이하는데 본문에 없는 수치 */
  repeated: string[];
}

/**
 * 근거에 있는데 본문에 없는 수치를 찾는다.
 *
 * 값이 **글자 그대로** 본문에 있는지만 본다. "10%"를 "십 퍼센트"로 풀어 썼다면
 * 못 찾지만, 그런 표기는 드물고 오탐보다 놓침이 안전하다.
 */
export function findMissingKeyFacts(input: {
  keyword: string;
  evidenceText: string;
  bodyText: string;
}): MissingFacts {
  const body = normalize(String(input.bodyText || ''));
  const inBody = (value: string) => body.includes(value);

  const promised = [...extractValues(input.keyword).keys()].filter((v) => !inBody(v));

  const repeated = [...extractValues(input.evidenceText).entries()]
    .filter(([, n]) => n >= REPEAT_MIN)
    .map(([v]) => v)
    .filter((v) => !inBody(v))
    .filter((v) => !promised.includes(v))
    .slice(0, MAX_REPORT);

  return { promised, repeated };
}

export function hasMissingKeyFacts(m: MissingFacts): boolean {
  return m.promised.length > 0 || m.repeated.length > 0;
}

/** 로그 한 줄 — 무엇이 빠졌는지 사람이 바로 읽을 수 있게 */
export function describeMissingKeyFacts(m: MissingFacts): string {
  if (!hasMissingKeyFacts(m)) return '핵심 수치 누락 없음';
  const parts: string[] = [];
  if (m.promised.length) parts.push(`제목이 약속한 수치 미출현: ${m.promised.join(', ')}`);
  if (m.repeated.length) parts.push(`자료가 되풀이하는데 본문에 없음: ${m.repeated.join(', ')}`);
  return `핵심 수치 누락 — ${parts.join(' · ')}`;
}

/**
 * 쓰기 전 지시.
 *
 * 실측 사고의 문장을 그대로 예시로 쓴다. 막연한 당부는 안 먹힌다는 것을
 * 실속 규칙에서 이미 확인했다(규칙 1 에 실패율을 박은 뒤에야 63% → 49% 로 내려갔다).
 */
export function buildKeyFactDirective(keyword: string): string {
  const promised = [...extractValues(keyword).keys()];

  const lines: string[] = [
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '🔢 **[자료에 있는 수치를 빠뜨리지 마세요]**',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '**자료가 여러 번 말하는 숫자는 그 주제의 뼈대입니다. 반드시 본문에 그대로 쓰세요.**',
    '',
    '⚠️ 실제 사고: "9월 추석 대비 지자체 10% 할인가맹점" 글에 **할인율이 한 번도 안 나왔습니다.**',
    '   자료에는 "평달 캐시백 10%, 명절 달 15%, 구매 할인 10%" 가 분명히 있었는데도',
    '   본문은 이렇게만 썼습니다:',
    '     ❌ "평달과 명절 달의 차이도 분명합니다."',
    '   차이가 **얼마인지** 말하지 않으면 그 문장은 아무 정보도 주지 않습니다.',
    '     ✅ "평달 캐시백은 10%, 추석이 있는 9월은 15%입니다. 구매 할인 10%까지 더하면 최대 25%입니다."',
    '',
    '**지켜야 할 것**',
    '1. "차이가 있다"·"달라진다"고 썼으면 **그 자리에서 두 값을 다 적으세요.**',
    '2. 비교·상향·인하를 말할 때는 **전후 값**을 함께 쓰세요.',
    '3. 자료에 있는 값을 요약하며 빼지 마세요. 숫자가 빠진 요약은 정보가 아니라 인상입니다.',
  ];

  if (promised.length > 0) {
    lines.push('');
    lines.push(`4. **제목이 이 수치를 약속했습니다: ${promised.join(', ')}**`);
    lines.push('   독자는 그 숫자를 보러 왔습니다. 본문에 반드시 나와야 하고,');
    lines.push('   자료와 다르면 자료의 값을 쓰고 무엇이 다른지 밝히세요.');
  }

  lines.push('');
  return lines.join('\n');
}
