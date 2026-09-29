/**
 * ⚖️ v3.8.761 — 최종 권위 재검사(final authority). 호출 0회·결정론.
 *
 * 실측(run b8cdb4·a280b4): 사실 필터·검산·답 상자 fidelity·FAQ 일치 검사가 끝난 **뒤**에 발행 직전 LLM 자가 수정(fact-guard)이 문단을 다시 써서
 * 검산된 차액·금리·조건(1편), 답 상자 판정문·FAQ 답(2편)을 지웠다. 뒤의 LLM 재작성이 앞의 결정론 검사보다 높은 권한을 가졌던 셈이다.
 *
 * 여기서 끝낸다: 의미를 바꾸는 마지막 단계 뒤, 독자가 실제로 보는 HTML 로 기존 결정론 모듈을 **다시** 돌린다.
 *   fact(장부 검사 — 보고) · decision(상한→요구 조건 약화) · answer(답 상자 fidelity) · faq(일치 검사 + visible↔JSON-LD 단일 소스) · core(핵심 질문 coverage)
 * 새 검사·새 Judge 를 만들지 않는다. 최종 PASS 는 이 시점 결과가 기준이다.
 */
import { inspectFactIntegrity, type FactEvidence, type FactIntegrityViolation } from './fact-integrity';
import { weakenHtml, type SemanticChange } from './decision-semantics';
import { alignSummaryToBody, checkFaqConsistency, type FidelityChange, type FaqConsistencyNote } from './answer-fidelity';
import { coverCoreQuestions, type CoreQuestion, type CoverageResult } from './core-questions';
import { parseVisibleArticle } from './visible-article';

export interface FinalAuthorityInput { html: string; evidence: FactEvidence; keyword: string; coreQuestions?: CoreQuestion[]; dimensions?: string[] }
export interface FinalAuthorityReport {
  fact: { blocks: number; status: 'passed' | 'blocked'; violations: Array<FactIntegrityViolation & { location: string }> };
  decision: SemanticChange[];
  answer: { before: string; after: string; changes: FidelityChange[] };
  faq: { before: number; after: number; notes: FaqConsistencyNote[]; ldSynced: boolean; ldCount: number };
  coreQuestions: CoverageResult[];
  changed: boolean;
}

const plain = (s: string) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const escapeHtml = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SCRIPT_OR_STYLE = /(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>)/gi;

/** script·style 을 뺀 조각에만 f 를 적용한다 */
function mapOutsideScripts(html: string, f: (segment: string) => string): string {
  return String(html || '').split(SCRIPT_OR_STYLE).map((seg, i) => (i % 2 === 1 ? seg : f(seg))).join('');
}

export interface VisibleFaq { question: string; answer: string; block: string }
export function parseVisibleFaqs(html: string): VisibleFaq[] {
  const out: VisibleFaq[] = [];
  for (const m of String(html || '').matchAll(/<details\b[\s\S]*?<\/details>/gi)) {
    const sm = m[0].match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
    const question = plain(sm ? sm[1] || '' : '').replace(/^Q\.\s*/i, '').replace(/\s*▼\s*$/, '');
    const answer = plain(m[0].replace(/<summary[^>]*>[\s\S]*?<\/summary>/i, ''));
    if (question) out.push({ question, answer, block: m[0] });
  }
  return out;
}

/** FAQPage JSON-LD 를 보이는 FAQ 목록에서 다시 만든다 — 단일 소스. 독립 script 와 @graph 안의 FAQPage 둘 다 갈아끼운다(없으면 만들지 않는다) */
export function syncFaqJsonLd(html: string, faqs: Array<{ question: string; answer: string }>): { html: string; synced: boolean; count: number } {
  const entity = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })) };
  let synced = false; let count = 0;
  const out = String(html || '').replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi, (whole, body: string) => {
    let json: unknown;
    try { json = JSON.parse(body); } catch { return whole; }
    const obj = json as { '@type'?: string; '@graph'?: Array<{ '@type'?: string; mainEntity?: unknown }> };
    if (obj && obj['@type'] === 'FAQPage') {
      count += 1;
      if (count > 1 || faqs.length === 0) { synced = true; return ''; }                     // 둘째 FAQPage 나 FAQ 0개면 뺀다
      synced = true; return `<script type="application/ld+json">${JSON.stringify(entity)}</script>`;
    }
    if (obj && Array.isArray(obj['@graph'])) {
      const nodes = obj['@graph'].filter((n) => n && n['@type'] === 'FAQPage');
      if (nodes.length === 0) return whole;
      synced = true;
      const graph = obj['@graph'].filter((n) => !(n && n['@type'] === 'FAQPage'));
      if (faqs.length > 0 && count === 0) { count += 1; graph.push({ '@type': 'FAQPage', mainEntity: entity.mainEntity } as never); }
      return `<script type="application/ld+json">${JSON.stringify({ ...obj, '@graph': graph })}</script>`;
    }
    return whole;
  });
  return { html: out, synced, count: faqs.length === 0 ? 0 : Math.min(count, 1) };
}

export function runFinalAuthority(input: FinalAuthorityInput): { html: string; report: FinalAuthorityReport } {
  let html = String(input.html || '');
  const dims = input.dimensions || [];
  // 5) core questions — Writer 가 답했는가는 **약화 전** 본문으로 잰다(약화가 판단축 이름을 끼워 넣으므로 그 뒤에 재면 부풀려진다)
  const coverage = coverCoreQuestions(plain(mapOutsideScripts(html, (s) => s)), input.coreQuestions || []);
  // 1) fact — 독자가 보는 절·서론·결론을 장부 검사기로 다시 잰다(보고). 본문 필터는 초안 단계에 이미 돌았고, 늦은 재작성의 유입은 게이트가 막는다
  const vis = parseVisibleArticle(html);
  const blocks: Array<{ location: string; html: string }> = [
    // 답 상자(근거 줄의 기준 날짜는 시스템 값)는 서론에서 뺀다
    { location: 'introduction', html: vis.introduction.replace(/<section[^>]*class="[^"]*answer-first[^"]*"[^>]*>[\s\S]*?<\/section>/i, '') },
    ...vis.sections.flatMap((s, si) => s.h3Sections.map((h, hi) => ({ location: `section.${si}.h3.${hi}`, html: h.content }))),
    { location: 'conclusion', html: vis.conclusion },
  ].filter((b) => plain(b.html));
  const violations: Array<FactIntegrityViolation & { location: string }> = [];
  for (const b of blocks) {
    const rep = inspectFactIntegrity(b.html, { ...input.evidence, blockHtml: b.html });
    for (const v of rep.violations) violations.push({ ...v, location: b.location });
  }
  // 2) decision — 상한→요구 조건 문형(본문·답 상자·요약표 칸까지). script/style 은 손대지 않는다
  const decision: SemanticChange[] = [];
  html = mapOutsideScripts(html, (seg) => { const r = weakenHtml(seg, input.evidence.context || '', 'final', { dimensions: dims }); decision.push(...r.changes); return r.html; });
  // 3) answer — 답 상자 fidelity 를 최종 본문 기준으로 다시
  const bodyText = plain(mapOutsideScripts(html, (s) => s));
  let answerBefore = ''; let answerAfter = ''; let answerChanges: FidelityChange[] = [];
  html = html.replace(/(<p[^>]*class="answer-first-a"[^>]*>)([\s\S]*?)(<\/p>)/i, (_m, open: string, inner: string, close: string) => {
    answerBefore = plain(inner);
    const r = alignSummaryToBody(answerBefore, bodyText, { dimensions: dims });
    answerAfter = r.text; answerChanges = r.changes;
    if (r.changes.length === 0 || !r.text) return `${open}${inner}${close}`;
    return `${open}${r.text.split(/(?<=[.!?])\s+/).map(escapeHtml).join('<br>')}${close}`;
  });
  // 4) faq — 보이는 FAQ 를 다시 검사하고, JSON-LD 를 그 목록에서 만든다
  const faqsBefore = parseVisibleFaqs(html);
  const consistent = checkFaqConsistency(faqsBefore, input.keyword);
  const dropped = new Set(consistent.notes.filter((n) => n.action === 'dropped').map((n) => n.question));
  for (const f of faqsBefore) if (dropped.has(f.question)) html = html.replace(f.block, '');
  const faqsAfter = parseVisibleFaqs(html);
  const ld = syncFaqJsonLd(html, faqsAfter.map((f) => ({ question: f.question, answer: f.answer })));
  html = ld.html;
  const report: FinalAuthorityReport = {
    fact: { blocks: blocks.length, status: violations.length ? 'blocked' : 'passed', violations },
    decision,
    answer: { before: answerBefore, after: answerAfter, changes: answerChanges },
    faq: { before: faqsBefore.length, after: faqsAfter.length, notes: consistent.notes, ldSynced: ld.synced, ldCount: ld.count },
    coreQuestions: coverage,
    changed: html !== String(input.html || ''),
  };
  return { html, report };
}
