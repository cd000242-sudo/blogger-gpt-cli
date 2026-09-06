/**
 * 🧭 답 상자는 판정문이어야 한다. (v3.8.678)
 *
 * 사장님: "제목을 보고 온 거라면 그 제목에 대해서 시원하게 긁어주는 답변이 있어야 되는데 두루뭉실한 게 아니라 확실한 답변."
 * 실측(672·675·677 라이브 세 편의 답 상자): "…적은지 봐요", "…함께 확인해요", "…요건을 따로 봐요", "…기록이 중요해요",
 * "…다시 신청을 검토할 수 있어요" — 전부 볼 것 목록이지 답이 아니다. 첫 화면에서 독자가 나가는 자리다.
 *
 * 절의 마지막 판단 문장(takeaway, v3.8.672)은 이미 "A 라면 …하세요. …때문이에요" 꼴이다. 답 상자가 판정문이 아니면
 * 그 문장들로 답을 다시 조립한다. 호출 0회.
 */

/** 독자의 처지를 가르는 조건 */
const CONDITION = /(?:라면|다면|이면|경우|때는|때에는|사람은|사람이|분은|분이|분이라면|가구는|사업자는|차량은|이상|미만|이후|이전|없으면|있으면|넘으면|못\s*채우면|안\s*되면)/;
/** 결론이 서는 어미·낱말 — "봐요·확인해요·중요해요·검토할 수 있어요" 는 여기 없다 */
const VERDICT = /(?:돼요|됩니다|안\s*돼요|되지\s*않(?:아요|습니다)|없어요|없습니다|아니에요|아닙니다|가능해요|가능합니다|불가능(?:해요|합니다)|필요해요|필요합니다|(?:탈락|면제|대상|제외|불가|승계|지급|부과|환급|거절|승인|통과|종료|중단|유지|의무|해당)(?:이에요|입니다|예요|돼요|됩니다|이\s*아니에요|가\s*아니에요|이\s*아닙니다|가\s*아닙니다|이죠|죠)|(?:하세요|마세요|내세요|받으세요|넣으세요|고르세요|택하세요|기다리세요)|(?:쪽|편|것)이\s*(?:맞아요|맞습니다|낫습니다|나아요)|(?:해야|야)\s*(?:해요|합니다|돼요|됩니다)|먼저(?:예요|입니다)|맞다고\s*(?:봐요|봅니다))[.!?]?$/;   // v3.8.681: "갖춰야 해요", "행동이 먼저예요" 도 판정이다
/** 회피·점검형 — 판정으로 치지 않는다 */
const HEDGE = /(?:확인|점검|살펴|검토|대조|비교|파악)(?:해요|하세요|해\s*보세요|해야\s*해요|하는\s*것이|하는\s*편이|할\s*수\s*있어요)|봐요[.!?]?$|봐야\s*해요|중요해요|중요합니다|검토할\s*수\s*있어요|따라\s*달라요|따라\s*다릅니다|수\s*있어요[.!?]?$|수\s*있습니다[.!?]?$/;

export function splitSentences(text: string): string[] {
  return String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length >= 8);
}

/** 한 문장이 판정문인가 — 조건이 있고 결론 어미로 끝나거나, 회피 없이 결론 어미로 끝난다 */
export function isVerdictSentence(s: string): boolean {
  const t = String(s || '').trim();
  if (!t || HEDGE.test(t)) return false;
  return VERDICT.test(t);
}

/** 답 전체가 판정문인가 — 문장 절반 이상이 판정문이고 그중 하나는 조건을 단다 */
export function isVerdictAnswer(answer: string): boolean {
  const ss = splitSentences(answer);
  if (ss.length === 0) return false;
  const verdicts = ss.filter(isVerdictSentence);
  if (verdicts.length * 2 < ss.length) return false;
  return verdicts.some((s) => CONDITION.test(s)) || verdicts.length === ss.length;
}

export interface SectionWithTakeaway { h2?: string | undefined; takeaway?: string | undefined; [k: string]: any }

/**
 * 절의 판단 문장들로 답을 다시 조립한다. 조건 있는 판정문을 앞에, 최대 세 문장, 400자 안.
 * 재료가 둘 미만이면 빈 문자열 — 억지로 만들지 않는다(그러면 buildAnswerBlock 이 원래 답이나 생략으로 간다).
 */
/** 제목 조각의 낱말 — 조사·흔한 말을 떼고 (v3.8.681) */
const PROMISE_STOP = new Set(['여부', '방법', '절차', '정리', '총정리', '안내', '확인', '가이드', '경우', '후에도', '후에', '뒤에도', '뒤에', '전에', '남는', '대한', '위한', '그리고', '및']);
export function promiseNouns(promise: string): string[] {
  return String(promise || '')
    .replace(/[^가-힣0-9A-Za-z\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/(?:과|와|은|는|이|가|을|를|의|에|로|도)$/, ''))
    .filter((w) => w.length >= 2 && !PROMISE_STOP.has(w));
}
/**
 * 답이 제목 조각 몇 개를 다루는가.
 * 조각의 낱말 절반 이상이 있으면 다룬 것. 그게 안 되면 **그 조각을 맡은 소제목의 판정문**이 답에 들어 있는지 본다 —
 * "남는 신청 요건" 의 답은 "집행권원·미지급·자녀 연령" 이라 조각 낱말로는 못 알아본다(679 실측).
 */
export function promiseCoverage(answer: string, promises: string[], sections: SectionWithTakeaway[] = []): number {
  const text = String(answer || '').replace(/\s+/g, '');
  let covered = 0;
  for (const p of promises || []) {
    const words = promiseNouns(p);
    if (words.length === 0) continue;
    const hit = words.filter((w) => text.includes(w)).length;
    if (hit * 2 >= words.length) { covered += 1; continue; }
    // 조각을 맡은 소제목(낱말 겹침 최다)의 판정문이 답에 있는가
    let bestSec: SectionWithTakeaway | null = null; let bestHit = 0;
    for (const sec of sections) {
      const h2 = String(sec?.h2 || '').replace(/\s+/g, '');
      const h = words.filter((w) => h2.includes(w)).length;
      if (h > bestHit) { bestSec = sec; bestHit = h; }
    }
    if (!bestSec || bestHit === 0) continue;
    const verdicts = splitSentences(String(bestSec.takeaway || '')).filter(isVerdictSentence).map((s) => s.replace(/\s+/g, '').slice(0, 24));
    if (verdicts.some((v) => v && text.includes(v))) covered += 1;
  }
  return covered;
}

/**
 * 절의 판단 문장들로 답을 다시 조립한다.
 * v3.8.681: **제목이 약속한 조각마다 한 문장씩** 먼저 고른다 — 실측(679 라이브): 조건 있는 문장부터 고르니
 * "이의신청 기한" 은 답했는데 제목의 핵심 "남는 신청 요건(집행권원·미지급·자녀 연령)" 이 첫 화면에 없었다.
 * 남는 자리는 조건 있는 판정문으로 채운다. 최대 세 문장, 400자 안. 재료가 둘 미만이면 빈 문자열.
 */
export function buildVerdictAnswer(sections: SectionWithTakeaway[], maxLen = 400, promises: string[] = []): string {
  // 후보 = 모든 takeaway 의 판정 문장 (이유 문장 제외) + 그 절의 소제목
  const candidates: Array<{ s: string; h2: string }> = [];
  const seen = new Set<string>();
  for (const sec of sections || []) {
    const plain = String(sec?.takeaway || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!plain) continue;
    for (const s of splitSentences(plain).filter(isVerdictSentence)) {
      const key = s.replace(/[^가-힣0-9]/g, '').slice(0, 14);
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ s, h2: String(sec?.h2 || '').replace(/\s+/g, '') });
    }
  }
  if (candidates.length < 2) return '';

  const picked: string[] = [];
  /**
   * ① 제목 조각마다 한 문장 — 그 조각을 **맡은 소제목**의 판정문을 먼저 본다.
   * 실측: 조각 "남는 신청 요건" 의 답은 "집행권원·미지급·자녀 연령" 이라 조각의 낱말이 문장에 없다.
   * 소제목 "1. 소득기준 폐지 후 남는 신청 요건" 은 조각 낱말을 그대로 가지고 있으니 소제목 겹침을 두 배로 친다.
   */
  for (const p of promises) {
    const words = promiseNouns(p);
    if (words.length === 0) continue;
    let best: string | null = null; let bestScore = 0;
    for (const c of candidates) {
      if (picked.includes(c.s)) continue;
      const flat = c.s.replace(/\s+/g, '');
      const score = 2 * words.filter((w) => c.h2.includes(w)).length + words.filter((w) => flat.includes(w)).length;
      if (score > bestScore) { best = c.s; bestScore = score; }
    }
    if (best && bestScore >= 1) picked.push(best);
    if (picked.length >= 3) break;
  }
  // ② 남는 자리는 조건 있는 판정문, 그다음 나머지 — 절 순서대로
  const rest = candidates.map((c) => c.s);
  for (const s of [...rest.filter((s) => CONDITION.test(s)), ...rest.filter((s) => !CONDITION.test(s))]) {
    if (picked.length >= 3) break;
    if (!picked.includes(s)) picked.push(s);
  }
  if (picked.length < 2) return '';
  let out = '';
  for (const s of picked) {
    const next = out ? `${out} ${s}` : s;
    if (next.length > maxLen) break;
    out = next;
  }
  return out;
}

/**
 * 답 상자에 쓸 답을 고른다.
 * 요약 답이 판정문이고 제목 조각을 조립본만큼 다루면 그대로. 아니면(점검 목록형이거나 제목 조각을 덜 다루면) 절의 판단 문장으로 조립한 것.
 */
export function ensureVerdictAnswer(summaryAnswer: string, sections: SectionWithTakeaway[], promises: string[] = []): { answer: string; rebuilt: boolean; reason: string } {
  const original = String(summaryAnswer || '').trim();
  const rebuilt = buildVerdictAnswer(sections, 400, promises);
  const originalOk = Boolean(original) && isVerdictAnswer(original);
  if (originalOk) {
    if (!rebuilt || promises.length === 0) return { answer: original, rebuilt: false, reason: '요약 답이 판정문' };
    const co = promiseCoverage(original, promises, sections); const cr = promiseCoverage(rebuilt, promises, sections);
    if (cr > co) return { answer: rebuilt, rebuilt: true, reason: `요약 답이 제목 조각 ${co}/${promises.length}개만 다뤄 절의 판단 문장(${cr}/${promises.length})으로 조립` };
    return { answer: original, rebuilt: false, reason: '요약 답이 판정문' };
  }
  if (rebuilt) return { answer: rebuilt, rebuilt: true, reason: original ? '요약 답이 점검 목록형이라 절의 판단 문장으로 조립' : '요약 답이 비어 절의 판단 문장으로 조립' };
  return { answer: original, rebuilt: false, reason: original ? '판정문이 아니지만 대신할 판단 문장이 없어 원래 답 유지' : '답 없음' };
}
