/**
 * 🧷 v3.8.771 — 값이 **무엇의 무엇**인지(대상·속성)를 곁 낱말로 묶는다. 호출 0회·결정론.
 *
 * 실측(BATCH 2 IT run a4fc1b): 제목 "… 45W 충전" 을 본문 "45W 충전기 보유 여부와 … 유선 충전 기준은 구분" 이 지지하는 것으로 셌다.
 * 값·단위만 같으면 지지로 본 것 — 충전기(다른 대상)의 45W 는 기기 충전(속성)의 45W 가 아니다. 같은 수치가 다른 항목에 붙는 일은 흔하다:
 *   자동차 충전기 출력 350kW vs 차량 최대 수용 180kW · 보험 보험료 10만원 vs 보상한도 10만원 · 행정 수수료 1000원 vs 우편료 1000원.
 *
 * 규칙(새 온톨로지 없음 — 기존 subjectHint 와 같은 "값 곁의 낱말" 방식):
 *   · 속성 창 = 같은 절 안에서 값 앞 3낱말 + 값 뒤 3낱말. 다른 값·절 경계(쉼표·표 칸·"~고/~며/~면/~지만")에서 멈춘다.
 *     값에 조사·어미가 바로 붙어 있으면("45W가 · 1000원이고 · 25W입니다") 뒤 창은 없다 — 뒤는 다른 말이다.
 *   · 두 값의 창이 한 낱말이라도 같으면 SAME(같은 대상·속성), 둘 다 있는데 겹치지 않으면 DIFFERENT, 어느 한쪽이 비면 UNKNOWN.
 *   · UNKNOWN 은 지지로 승격하지 않고 모순으로도 바꾸지 않는다(호출부가 단위만으로 속성이 정해지는 경우만 따로 본다).
 */

export type PropertyRelation = 'SAME' | 'DIFFERENT' | 'UNKNOWN';

/** 속성을 가르지 않는 낱말 — 한정·상태·서술어 조각 */
const STOP = new Set(['최대', '최소', '약', '기준', '지원', '가능', '정도', '이상', '이하', '사용', '경우', '현재', '실제', '공식', '국내', '전제', '판단', '표기', '수치', '값', '총', '각', '모두', '함께', '따로', '먼저', '다시', '이번', '올해', '하루', '매월', '월', '연', '로', '및', '또는', '그리고']);
const PARTICLE_END = /(?:에서는|에서|에게|으로는|으로|로는|까지|부터|이며|이고|입니다|이다|이죠|합니다|해요|했고|하며|하고|는|은|이|가|을|를|의|에|로|와|과|도|만|죠)$/;
/** 절을 끊는 낱말 끝 — 이 낱말부터는 다른 절이다 */
const CLAUSE_END = /(?:하고|되고|이고|있고|없고|했고|하며|되며|이며|하면|되면|으면|라면|다면|지만|는데|면서|거나|니다|어요|아요|해서|어서)$/;
const BOUNDARY_TOKEN = /[,|·:;]$|^[|·:;]$/;

function normalizeWord(w: string): string {
  // v3.8.772 — 각주 표지("충전*" · "용량¹")는 낱말이 아니다
  let s = String(w || '').replace(/[.,!?()[\]"'“”‘’…*※†‡¹²³⁴⁵]+/g, '');
  for (let i = 0; i < 2; i += 1) s = s.replace(PARTICLE_END, '');
  return s;
}
const usable = (w: string) => w.length >= 2 && !/\d/.test(w) && !STOP.has(w);

/** 값(index·length) 곁의 속성 낱말들 */
export function propertyWindow(text: string, index: number, length: number): string[] {
  const src = String(text || '');
  const words: string[] = [];
  // 앞: 값 바로 앞에서 거꾸로 3낱말 — 값·경계·절 끝에서 멈춘다
  const before = src.slice(0, index).split(/\s+/).filter(Boolean);
  for (let i = before.length - 1, taken = 0; i >= 0 && taken < 3; i -= 1) {
    const tok = before[i]!;
    if (/\d/.test(tok) || BOUNDARY_TOKEN.test(tok) || CLAUSE_END.test(tok.replace(/[.,]$/, ''))) break;
    const w = normalizeWord(tok);
    if (usable(w)) words.push(w);
    taken += 1;
  }
  // 뒤: 값에 조사·어미가 붙어 있으면 없음. 띄어 쓴 뒤 3낱말 — 값·경계에서 멈추고, 문장 끝 낱말은 넣고 멈춘다
  const after = src.slice(index + length);
  if (/^\s/.test(after)) {
    const toks = after.trim().split(/\s+/).filter(Boolean);
    for (let i = 0; i < toks.length && i < 3; i += 1) {
      const tok = toks[i]!;
      if (/\d/.test(tok) || /^[|·:;]/.test(tok)) break;
      const w = normalizeWord(tok);
      if (usable(w)) words.push(w);
      if (/[.,!?|·;:]$/.test(tok) || CLAUSE_END.test(tok.replace(/[.,!?]$/, ''))) break;
    }
  }
  return [...new Set(words)];
}

/** v3.8.772 — 표 행 머리("30분 충전")처럼 값 없는 이름표의 속성 낱말. 칸 값 곁에 낱말이 없을 때 호출부가 쓴다 */
export function propertyWords(text: string): string[] {
  return [...new Set(String(text || '').split(/\s+/).map(normalizeWord).filter(usable))];
}

export function propertyRelation(a: ReadonlyArray<string>, b: ReadonlyArray<string>): PropertyRelation {
  if (!a.length || !b.length) return 'UNKNOWN';
  return a.some((w) => b.includes(w)) ? 'SAME' : 'DIFFERENT';
}
