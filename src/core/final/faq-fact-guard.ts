/**
 * ❓ FAQ 값 관문 (v3.8.741) — 값을 지우되 문장을 깨뜨리지 않는다.
 *
 * ## 왜
 * live(주담대 금리 7%): 옛 FAQ 필터가 "대출 신청금액이 7억원이면 …" 에서 "7억원" 토큰만 도려내 "대출 신청금액이 이면 …" 이 됐다.
 * live(부산국제영화제): "동행이 3명인데 한 회차에 같이 예매할 수 있나요?" — 질문 속 가정값 "3명" 을 사실 주장으로 봐 FAQ 자체를 버렸다.
 *
 * ## 규칙
 *   · **질문의 값은 사용자의 가정(시나리오)** 이다 — 근거를 요구하지 않는다. ("7억원을 빌리면", "3명이 같이")
 *   · **답변의 값은 사실 주장** 이다 — 근거(fact-claims 장부)에 있어야 한다. 단 질문에 있던 값을 답변이 되받는 것은 시나리오 반복이라 허용.
 *   · 근거 없는 답변 값은 **토큰이 아니라 문장** 단위로 다룬다: 그 문장이 첫 문장(핵심 답)이면 항목을 통째로 뺀다.
 *     뒷문장이면 그 문장만 빼고, 남은 답변이 너무 짧으면 항목을 뺀다. 부분 문자열 삭제는 없다.
 *   · 호출 0. 결정적.
 */

import { checkClaims, extractClaims, norm, type LedgerItem } from './fact-claims';

export interface FaqItem { question: string; answer: string; [k: string]: any }
export interface FaqGuardNote { question: string; action: 'kept' | 'sentence_removed' | 'dropped'; unsupported: string[]; detail?: string }
export interface FaqGuardResult { faqs: FaqItem[]; notes: FaqGuardNote[]; changed: number }

const MIN_ANSWER_CHARS = 20;

const plain = (html: string): string => String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** 문장 단위로 나눈다 — HTML 답변이면 <p>/<li> 경계도 문장 경계 */
export function splitAnswerSentences(answer: string): string[] {
  const text = String(answer || '').replace(/<\/(p|li|div|br)\s*>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ');
  return text.split(/(?<=[.!?。])\s+|\n+/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/** 값의 숫자 몸통 — "7억원"·"7억"·"7억 원" 은 모두 "7억". 질문이 "7억 대출" 이라 하고 답이 "7억원" 이라 되받는 것을 같은 값으로 본다(live 742) */
const numericCore = (s: string): string => norm(s).replace(/(원|달러|USD|%|명|건|가구|세대|좌|대|곳|개소|석|편|회|배|개월|년간|주간|일간|시간|영업일|위)$/, '');

/** 질문에 있는 값의 열쇠들 — 답변이 이 값을 되받으면 시나리오 반복이다 */
function scenarioKeys(question: string): Set<string> {
  const keys = new Set(extractClaims(question).flatMap((c) => c.keys));
  // 화폐 단위 없는 큰 수("7억", "3천만")도 가정값이다 — 답변이 "7억원" 으로 되받을 수 있다. 맨 숫자("3")는 넣지 않는다(3명 ≠ 3%)
  for (const m of String(question || '').match(/\d[\d,.]*\s*(?:억|천만|백만|십만|만|천)/g) || []) keys.add(numericCore(m));
  return keys;
}

/** 답변에서 근거 없는 값(질문의 가정값 제외) */
export function unsupportedAnswerValues(question: string, answer: string, ledger: LedgerItem[]): string[] {
  const scenario = scenarioKeys(question);
  const check = checkClaims(plain(answer), ledger);
  const isScenario = (v: string) => extractClaims(v).every((c) => c.keys.every((k) => scenario.has(k))) || scenario.has(numericCore(v));
  return check.unsupported.filter((v) => !isScenario(v));
}

export function guardFaqs(faqs: FaqItem[], ledger: LedgerItem[]): FaqGuardResult {
  const out: FaqItem[] = [];
  const notes: FaqGuardNote[] = [];
  let changed = 0;
  for (const item of faqs || []) {
    const question = String(item?.question || '');
    const answer = String(item?.answer || '');
    if (!question.trim() || !plain(answer)) { notes.push({ question: question.slice(0, 60), action: 'dropped', unsupported: [], detail: '질문 또는 답변이 비었다' }); changed += 1; continue; }
    const bad = unsupportedAnswerValues(question, answer, ledger);
    if (bad.length === 0) { out.push(item); notes.push({ question: question.slice(0, 60), action: 'kept', unsupported: [] }); continue; }

    const sentences = splitAnswerSentences(answer);
    const badNorm = bad.map(norm);
    const hasBad = (s: string) => badNorm.some((b) => norm(s).includes(b));
    const firstIsBad = sentences.length > 0 && hasBad(sentences[0]!);
    const kept = sentences.filter((s) => !hasBad(s));
    const keptText = kept.join(' ');
    if (firstIsBad || keptText.replace(/\s/g, '').length < MIN_ANSWER_CHARS) {
      notes.push({ question: question.slice(0, 60), action: 'dropped', unsupported: bad, detail: firstIsBad ? '핵심 답 문장에 근거 없는 값' : '값 문장을 빼면 답이 남지 않는다' });
      changed += 1;
      continue;
    }
    // 문장만 뺀다 — HTML 답변이면 문단 구조 대신 <p> 하나로 다시 감싼다(토큰 삭제는 없다)
    const rebuilt = /<[a-z][^>]*>/i.test(answer) ? `<p>${keptText}</p>` : keptText;
    out.push({ ...item, answer: rebuilt });
    notes.push({ question: question.slice(0, 60), action: 'sentence_removed', unsupported: bad, detail: `${sentences.length - kept.length}문장 제거` });
    changed += 1;
  }
  return { faqs: out, notes, changed };
}

export function describeFaqGuard(r: FaqGuardResult): string {
  const dropped = r.notes.filter((n) => n.action === 'dropped').length;
  const trimmed = r.notes.filter((n) => n.action === 'sentence_removed').length;
  return `FAQ 값 관문: 유지 ${r.faqs.length} · 문장 제거 ${trimmed} · 항목 제외 ${dropped}`;
}
