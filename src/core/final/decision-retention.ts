/**
 * 🧷 v3.8.760 — 보강(구간 반복 손질)이 그 절의 **고유 판단 기준**을 지우지 않게. 호출 0회·결정론.
 *
 * 실측(run d7a142, 011→014): 초안에는 "개인의 가입 시점에 따라 남은 기간은 다르므로, 이미 납입한 금액과 남은 만기를 함께 놓고 …
 * 판단하는 방식이 맞습니다" 가 있었다. 보강 감사가 그 문단의 이웃 문장을 [구간 반복] 으로 지목했고, Writer 가 문단을 바꾸며
 * "가입 시점에 따라 남은 기간" 관점을 지웠다. 글 전체에서 그 관점은 이 문장에만 있었다.
 *
 * 판단 기준 문장 = "…에 따라 … 다르/달라" · "…함께 놓고/보고 … 판단/비교" 꼴. 고유성 = 그 문장의 핵심 구절(인접 낱말 쌍)이
 * 다른 절에 없다. 보강 뒤 핵심 구절의 절반 이상이 글 어디에도 없으면 원문 문장을 같은 절·같은 소제목 끝에 되살린다.
 * 모든 문장을 지키지 않는다 — 같은 뜻이 다른 곳에 남아 있으면(구절이 살아 있으면) 중복 제거를 인정한다.
 */
export interface DecisionPoint { sectionIndex: number; h3Index: number; h2: string; h3: string; sentence: string; phrases: string[] }
export interface RetentionResult<T> { article: T; restored: Array<DecisionPoint & { survived: string[]; lost: string[] }>; checked: number }

interface ArticleLike { sections?: Array<{ h2?: string; h3Sections?: Array<{ h3?: string; content?: string }> }> }

const plain = (s: string) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
const DECISION_CUE = /(?:에\s*따라|별로)\s*[^.]{0,30}?(?:다르|달라)|함께\s*(?:놓고|보고|두고)\s*[^.]{0,20}?(?:판단|비교)|(?:판단|비교)(?:해야|하는\s*방식이\s*맞)/;
const PARTICLE = /(?:으로|에서|에게|까지|부터|처럼|보다|이면|라면|다면|은|는|이|가|을|를|의|에|로|도|과|와|만)$/;
const STOP = new Set(['경우', '방법', '여부', '것', '수', '때', '등', '및', '그리고', '이미', '함께', '따라', '방식', '판단', '비교', '다르', '달라']);

function tokens(clause: string): string[] {
  // 조사는 떼되 두 글자 미만이 되면 원형을 둔다 — "남은" 이 "남" 이 되어 "남은 기간" 구절을 잃지 않게
  const strip = (w: string) => { const s = w.replace(PARTICLE, ''); return s.length >= 2 ? s : w; };
  return plain(clause).replace(/[^가-힣0-9\s]/g, ' ').split(/\s+/).map(strip).filter((w) => w.length >= 2 && !STOP.has(w));
}
/** 핵심 구절 = 판단 기준 문장의 조건절(단서 앞부분)에서 인접 낱말 쌍 */
export function keyPhrases(sentence: string): string[] {
  const s = plain(sentence);
  const cueAt = s.search(DECISION_CUE);
  const clause = cueAt > 0 ? s.slice(0, s.indexOf('므로', cueAt) > 0 ? s.indexOf('므로', cueAt) : cueAt + 20) : s;
  const t = tokens(clause);
  const out: string[] = [];
  for (let i = 0; i + 1 < t.length; i += 1) out.push(`${t[i]} ${t[i + 1]}`);
  return out;
}
/** 문장들 — 표는 문장이 아니라 뺀다(칸 글자가 이어져 가짜 판단문이 된다) */
const sentencesOf = (html: string) => plain(String(html || '').replace(/<table[\s\S]*?<\/table>/gi, ' ')).split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => x.length >= 12);
const hasPhrase = (hay: string, phrase: string) => { const [a, b] = phrase.split(' '); return new RegExp(`${a}[^.]{0,6}${b}`).test(hay); };
const articleText = (a: ArticleLike) => plain(JSON.stringify(a));

/** 보강 전 글의 고유 판단 기준 문장들 */
export function uniqueDecisionPoints(article: ArticleLike): DecisionPoint[] {
  const out: DecisionPoint[] = [];
  const sections = article.sections || [];
  sections.forEach((s, si) => (s.h3Sections || []).forEach((h, hi) => {
    for (const sentence of sentencesOf(h.content || '')) {
      if (!DECISION_CUE.test(sentence)) continue;
      const phrases = keyPhrases(sentence);
      if (phrases.length < 2) continue;
      const elsewhere = plain(JSON.stringify(sections.filter((_, i) => i !== si)));
      const uniq = phrases.filter((p) => !hasPhrase(elsewhere, p));
      if (uniq.length * 2 < phrases.length) continue;                      // 다른 절에도 있는 관점이면 고유하지 않다
      out.push({ sectionIndex: si, h3Index: hi, h2: String(s.h2 || ''), h3: String(h.h3 || ''), sentence, phrases });
    }
  }));
  return out;
}

/** 보강 뒤 글에서 사라진 고유 판단 기준을 같은 절·소제목 끝에 되살린다 */
export function retainDecisionPoints<T extends ArticleLike>(before: ArticleLike, after: T): RetentionResult<T> {
  const points = uniqueDecisionPoints(before);
  const afterText = articleText(after);
  const restored: RetentionResult<T>['restored'] = [];
  let next = after;
  for (const p of points) {
    const survived = p.phrases.filter((ph) => hasPhrase(afterText, ph));
    const lost = p.phrases.filter((ph) => !survived.includes(ph));
    if (survived.length * 2 >= p.phrases.length) continue;                 // 뜻이 남아 있다 — 중복 제거 인정
    const sections = [...(next.sections || [])];
    const si = sections.findIndex((s) => plain(String(s.h2 || '')) === plain(p.h2));
    const s = sections[si >= 0 ? si : p.sectionIndex];
    if (!s) continue;
    const h3s = [...(s.h3Sections || [])];
    let hi = h3s.findIndex((h) => plain(String(h.h3 || '')) === plain(p.h3));
    if (hi < 0) hi = Math.min(p.h3Index, h3s.length - 1);
    const h = h3s[hi];
    if (!h) continue;
    h3s[hi] = { ...h, content: `${String(h.content || '')}<p>${p.sentence}</p>` };
    sections[si >= 0 ? si : p.sectionIndex] = { ...s, h3Sections: h3s };
    next = { ...next, sections } as T;
    restored.push({ ...p, survived, lost });
  }
  return { article: next, restored, checked: points.length };
}
