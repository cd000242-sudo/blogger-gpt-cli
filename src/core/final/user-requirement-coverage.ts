/**
 * 📋 v3.8.776 — 작성자 명시 요구가 **최종 글에서 실제로 지켜졌나**(USER REQUIREMENT COVERAGE). 호출 0회·결정론.
 *
 * 유형마다 판정이 다르다 — 문자열 하나가 있는지로 끝내지 않는다:
 *   · 표: 본문 <table>(요약표·답 상자 제외, 2행·2열 이상) 개수 · FAQ 제외: 보이는 FAQ 0 + FAQPage JSON-LD 0 + FAQ 소제목 0 · FAQ n개: 보이는 FAQ 수
 *   · n단계: 번호 목록(<ol>) 항목 수 · "1단계~n단계" 연속 표지 · 번호 붙은 h3 연속 중 하나가 정확히 n
 *   · CTA: 실제 CTA 버튼(주소 있음) + 요청한 행동 낱말 + 공식 요구면 공식 주소 · CTA 제외: CTA 버튼 0
 *   · 내용: 기존 핵심 질문 coverage(coverCoreQuestions)에 걸리면 그것으로, 아니면 주제 낱말이 한 문단에 모였는가
 *   · 제외 주제: 주제 낱말이 한 문장에 모두 나오면 위반 · 가정 계산: 가정 값 + 가정 표지(같은 문단) · 값 단정: 근거에 있으면 COVERED, 없으면 CONFLICTS_WITH_EVIDENCE
 * 관문: MUST 의 MISSING/CONTRADICTED/UNSATISFIABLE(구조·CTA 는 PARTIAL 도) · EXCLUDE 위반 · 근거 충돌 → 자동 발행하지 않는다. PREFER·말투는 막지 않는다.
 */
import { coverCoreQuestions, type CoreQuestion } from './core-questions';
import { findValue } from './variant-ledger';
import type { Requirement, RequirementStatus, UserRequirementContract } from './user-requirement';

export interface RequirementResult extends Requirement { status: RequirementStatus; reason: string; evidence?: string[] }
export interface RequirementCoverageInput {
  html: string;
  /** 근거 원문(값 단정 요청 대조용) */
  evidenceText?: string;
  /** 근거 가운데 1차(공식·당사자) 원문 수 */
  officialSources?: number;
}
export interface RequirementGate { pass: boolean; reason: string; blockers: RequirementResult[] }

const plain = (s: string) => String(s || '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
const units = (html: string) => String(html || '').split(/<\/(?:p|li|td|th|h[1-6]|summary|details|div|blockquote)>/i).map(plain).filter(Boolean);
const sentences = (html: string) => plain(html).split(/(?<=[.!?])\s+/).filter(Boolean);
const STOP = new Set(['방법', '설명', '내용', '관련', '경우', '대한', '대해', '이야기', '얘기', '부분', '정리', '반드시', '꼭']);
const terms = (topic: string) => [...new Set(topic.split(/[\s·,/]+/).map((w) => w.replace(/(?:의|을|를|은|는|이|가|와|과|도|에서|으로|로|에)$/, '')).filter((w) => w.length >= 2 && !STOP.has(w)))];

/** 본문 표 — 요약표·답 상자는 빼고 2행·2열 이상 */
export function bodyTables(html: string): number {
  const body = String(html || '').replace(/<div class="summary-container"[\s\S]*?<\/table>[\s\S]*?<\/div>/gi, ' ').replace(/<section class="answer-first"[\s\S]*?<\/section>/gi, ' ');
  return [...body.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi)].filter((m) => {
    if (/summary-table/.test(m[1] || '')) return false;
    const rows = [...(m[2] || '').matchAll(/<tr\b[\s\S]*?<\/tr>/gi)];
    return rows.length >= 2 && rows.some((r) => (r[0].match(/<t[hd]\b/gi) || []).length >= 2);
  }).length;
}
export function faqPresence(html: string): { visible: number; jsonLd: boolean; heading: boolean } {
  const src = String(html || '');
  return {
    visible: (src.match(/<details\b/gi) || []).length,
    jsonLd: /"@type"\s*:\s*"FAQPage"/.test(src),
    heading: /<h[23]\b[^>]*>[^<]*(?:FAQ|자주\s*묻는)/i.test(src),
  };
}
/** 단계 구조 후보 — 번호 목록 항목 수들 · "1단계…k단계" 연속 길이 · 번호 붙은 h3 연속 길이 */
export function stepStructures(html: string): number[] {
  const src = String(html || '');
  const ol = [...src.matchAll(/<ol\b[\s\S]*?<\/ol>/gi)].map((m) => (m[0].match(/<li\b/gi) || []).length);
  const marks = new Set([...plain(src).matchAll(/(?<!\d)(\d{1,2})\s*단계/g)].map((m) => Number(m[1])));
  let run = 0; while (marks.has(run + 1)) run += 1;
  const h3 = [...src.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)].map((m) => plain(m[1] || '').match(/^(?:STEP\s*)?(\d{1,2})\s*(?:단계|[.)])/i)).map((m) => (m ? Number(m[1]) : 0));
  let h3run = 0; for (const n of h3) { if (n === h3run + 1) h3run = n; else if (n === 1) h3run = 1; }
  return [...ol, run, h3run].filter((n) => n > 0);
}
export function ctaButtons(html: string): Array<{ href: string; text: string }> {
  return [...String(html || '').matchAll(/<a\b[^>]*class="[^"]*cta-btn[^"]*"[^>]*>[\s\S]*?<\/a>/gi)].map((m) => ({ href: (m[0].match(/href="([^"]+)"/i) || [])[1] || '', text: plain(m[0]) }))
    .filter((c) => /^https?:\/\//i.test(c.href));
}
export const OFFICIAL_HOST = /\.go\.kr$|(^|\.)korea\.kr$|\.gov$|(^|\.)gov\.kr$/i;
const hostOf = (u: string) => { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } };

function contentCoverage(topic: string, html: string): { status: RequirementStatus; evidence: string[]; via: string } {
  // 기존 핵심 질문(남은 기간·갈아타기 가능 여부)에 해당하는 주제면 그 coverage 를 그대로 쓴다
  for (const id of ['CQ-REMAINING-TERM', 'CQ-SWITCH-AVAILABILITY']) {
    const q: CoreQuestion = { id, question: topic, principle: '', dimension: '', applicable: true, reason: '작성자 요청' };
    if (coverCoreQuestions(topic, [q])[0]?.status === 'ANSWERED' || (id === 'CQ-REMAINING-TERM' && coverCoreQuestions(topic, [q])[0]?.status === 'PARTIAL')) {
      const r = coverCoreQuestions(html, [q])[0]!;
      return { status: r.status === 'ANSWERED' ? 'COVERED' : r.status === 'PARTIAL' ? 'PARTIAL' : 'MISSING', evidence: r.evidence, via: id };
    }
  }
  const t = terms(topic);
  if (!t.length) return { status: 'NOT_APPLICABLE', evidence: [], via: 'terms' };
  let best = 0; let where = '';
  for (const u of units(html)) { const hit = t.filter((w) => u.includes(w)).length / t.length; if (hit > best) { best = hit; where = u; } }
  return { status: best >= 0.75 || (t.length <= 2 && best === 1) ? 'COVERED' : best >= 0.5 ? 'PARTIAL' : 'MISSING', evidence: where ? [where.slice(0, 160)] : [], via: `terms(${t.join('·')})` };
}

function judge(r: Requirement, input: RequirementCoverageInput): Pick<RequirementResult, 'status' | 'reason' | 'evidence'> {
  const d = r.directive; const html = input.html;
  switch (d.kind) {
    case 'FAQ': {
      const f = faqPresence(html);
      if (!d.enabled) return f.visible || f.jsonLd || f.heading ? { status: 'CONTRADICTED', reason: `FAQ 제외 요청 위반(보이는 FAQ ${f.visible} · JSON-LD ${f.jsonLd ? '있음' : '없음'} · FAQ 소제목 ${f.heading ? '있음' : '없음'})` } : { status: 'COVERED', reason: 'FAQ 없음(보이는 FAQ·JSON-LD·소제목 0)' };
      if (!f.visible) return { status: 'MISSING', reason: 'FAQ 없음' };
      return d.count && f.visible !== d.count ? { status: 'PARTIAL', reason: `FAQ ${f.visible}개 — 요청 ${d.count}개` } : { status: 'COVERED', reason: `FAQ ${f.visible}개` };
    }
    case 'TABLE': {
      const n = bodyTables(html);
      if (!d.enabled) return n ? { status: 'CONTRADICTED', reason: `표 제외 요청 위반(본문 표 ${n}개)` } : { status: 'COVERED', reason: '본문 표 없음' };
      const min = d.min || 1;
      return n >= min ? { status: 'COVERED', reason: `본문 표 ${n}개(요청 ${min}개 이상)` } : n ? { status: 'PARTIAL', reason: `본문 표 ${n}개 — 요청 ${min}개` } : { status: 'MISSING', reason: '본문 표 없음("아래 표" 같은 문장만으로는 충족 아님)' };
    }
    case 'STEPS': {
      const found = stepStructures(html);
      return found.includes(d.count) ? { status: 'COVERED', reason: `${d.count}단계 구조 확인` } : { status: 'MISSING', reason: `${d.count}단계 구조 없음(찾은 구조: ${found.join('·') || '없음'})` };
    }
    case 'CTA': {
      const btns = ctaButtons(html);
      if (!d.enabled) return btns.length ? { status: 'CONTRADICTED', reason: `CTA 제외 요청 위반(${btns.length}개)` } : { status: 'COVERED', reason: 'CTA 없음' };
      if (!btns.length) return { status: 'MISSING', reason: '맞는 목적지의 CTA 가 없음(주소를 지어내지 않음)' };
      const ok = btns.filter((b) => (!d.action || b.text.includes(d.action)) && (!d.official || OFFICIAL_HOST.test(hostOf(b.href))));
      return ok.length ? { status: 'COVERED', reason: `CTA "${ok[0]!.text.slice(0, 30)}" → ${hostOf(ok[0]!.href)}`, evidence: ok.map((b) => b.href) }
        : { status: 'CONTRADICTED', reason: `CTA 는 있지만 요청과 다름(${d.action ? `행동 "${d.action}"` : ''}${d.official ? ' · 공식 주소' : ''}): ${btns.map((b) => `${b.text.slice(0, 20)}→${hostOf(b.href)}`).join(', ')}`, evidence: btns.map((b) => b.href) };
    }
    case 'TOPIC': {
      if (r.type === 'EXCLUSION') {
        const t = terms(d.topic);
        const hit = t.length ? sentences(html).find((s) => t.every((w) => s.includes(w))) : undefined;
        return hit ? { status: 'CONTRADICTED', reason: `제외 요청한 "${d.topic}" 이 나옴`, evidence: [hit.slice(0, 160)] } : { status: 'COVERED', reason: `"${d.topic}" 없음` };
      }
      const c = contentCoverage(d.topic, html);
      return { status: c.status, reason: `내용 "${d.topic}" — ${c.via}`, evidence: c.evidence };
    }
    case 'HYPOTHETICAL': {
      if (!d.values.length) {
        const calc = units(html).find((u) => /[×x*]\s*\d|=\s*\d|계산하면|계산\s*결과|합계|총\s*\d/.test(u));
        return calc ? { status: 'COVERED', reason: '계산 과정 확인', evidence: [calc.slice(0, 160)] } : { status: 'MISSING', reason: '계산 과정 없음' };
      }
      const blocks = units(html).filter((u) => d.values.every((v) => findValue(u, v).length));
      const marked = blocks.find((u) => /가정|가상|예를\s*들|예시|사례|라고\s*하면|라면/.test(u));
      return marked ? { status: 'COVERED', reason: `가정 예시 ${d.values.join('·')} 확인`, evidence: [marked.slice(0, 160)] }
        : blocks.length ? { status: 'PARTIAL', reason: '값은 있지만 가정 표지가 없음 — 실제 사실로 읽힐 수 있음', evidence: [blocks[0]!.slice(0, 160)] }
          : { status: 'MISSING', reason: `가정 예시 ${d.values.join('·')} 없음` };
    }
    case 'ASSERT_VALUE': {
      const inEvidence = d.values.every((v) => findValue(String(input.evidenceText || ''), v).length);
      const inFinal = d.values.some((v) => findValue(plain(html), v).length);
      if (inEvidence) return inFinal ? { status: 'COVERED', reason: '요청 값이 근거와 같고 글에 있음' } : { status: 'MISSING', reason: '요청 값이 근거에 있으나 글에 없음' };
      return inFinal ? { status: 'CONTRADICTED', reason: `근거에 없는 요청 값(${d.values.join('·')})이 글에 들어감 — 사실이 우선` } : { status: 'CONFLICTS_WITH_EVIDENCE', reason: `요청 값 ${d.values.join('·')} 은 근거에 없음 — 사실이 우선이라 쓰지 않았음(사람 확인 필요)` };
    }
    case 'OFFICIAL_SOURCE':
      return (input.officialSources || 0) > 0 ? { status: 'COVERED', reason: `1차 원문 ${input.officialSources}건 근거` } : { status: 'MISSING', reason: '근거에 공식·당사자 원문이 없음' };
    case 'STYLE':
      return { status: 'DELIVERED', reason: '말투 요구는 Writer 에 전달(코드 판정 대상 아님)' };
    default:
      return { status: 'NOT_APPLICABLE', reason: '' };
  }
}

/** 요구마다 판정 — 계약이 비면 빈 결과 */
export function checkUserRequirements(contract: UserRequirementContract | null | undefined, input: RequirementCoverageInput): RequirementResult[] {
  return (contract?.requirements || []).map((r) => ({ ...r, ...judge(r, input) }));
}

/** 발행 관문 — MUST 누락·모순 · EXCLUDE 위반 · 근거 충돌. PREFER·말투는 막지 않는다 */
export function requirementGate(results: ReadonlyArray<RequirementResult>): RequirementGate {
  const blockers = results.filter((r) => {
    if (r.status === 'CONFLICTS_WITH_EVIDENCE') return true;
    if (r.priority === 'EXCLUDE') return r.status === 'CONTRADICTED';
    if (r.priority !== 'MUST' || r.type === 'STYLE') return false;
    if (r.status === 'MISSING' || r.status === 'CONTRADICTED' || r.status === 'UNSATISFIABLE') return true;
    return r.status === 'PARTIAL' && (r.type === 'STRUCTURE' || r.type === 'CTA');
  });
  return { pass: blockers.length === 0, reason: blockers.map((b) => `${b.id} ${b.priority} ${b.type}: ${b.reason}`).join(' · '), blockers };
}

/** 초안(JSON) → 판정용 HTML — Writer 단계 충족 상태를 재기 위해(유지 검사) */
interface DraftTable { headers?: string[]; rows?: string[][] }
interface DraftShape { introduction?: string; conclusion?: string; sections?: Array<{ h2?: string; h3Sections?: Array<{ h3?: string; content?: string; tables?: DraftTable[] }> }> }
export function draftHtml(draft: DraftShape | null | undefined): string {
  const table = (t: DraftTable) => `<table><tr>${(t?.headers || []).map((h: string) => `<th>${h}</th>`).join('')}</tr>${(t?.rows || []).map((row: string[]) => `<tr>${row.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;
  return [String(draft?.introduction || ''), ...(draft?.sections || []).flatMap((s) => [`<h2>${s?.h2 || ''}</h2>`, ...(s?.h3Sections || []).flatMap((h) => [`<h3>${h?.h3 || ''}</h3>`, String(h?.content || ''), ...(h?.tables || []).map(table)])]), String(draft?.conclusion || '')].join('\n');
}

/** 한 단계 앞뒤 본문으로 유지 검사 — 발행 전 자가 수정처럼 본문을 다시 쓰는 단계가 요구를 깼는지(v3.8.778, API·에이전트 공용) */
export function stageRegressions(contract: UserRequirementContract | null | undefined, beforeHtml: string, afterHtml: string, stage: string, extra: Omit<RequirementCoverageInput, 'html'> = {}): ReturnType<typeof requirementRegressions> {
  if (!contract?.requirements.length) return [];
  return requirementRegressions(checkUserRequirements(contract, { ...extra, html: beforeHtml }), checkUserRequirements(contract, { ...extra, html: afterHtml }), stage);
}

/** 보류 사유 구분 — 점수가 아니라 이름만(v3.8.778). 강제 발행 확인창과 감사 기록이 쓴다 */
export type HoldCategory = 'USER_REQUIREMENT_MISSING' | 'EXCLUDE_VIOLATED' | 'CTA_CONTRADICTED' | 'FACT_CONFLICT' | 'CRITICAL_STATE_CONTRADICTION';
export interface HoldSummary { categories: HoldCategory[]; missingMust: RequirementResult[]; excludeViolations: RequirementResult[]; ctaProblems: RequirementResult[]; factConflicts: RequirementResult[] }
export function holdSummary(blockers: ReadonlyArray<RequirementResult>): HoldSummary {
  const fact = (r: RequirementResult) => r.status === 'CONFLICTS_WITH_EVIDENCE' || (r.directive.kind === 'ASSERT_VALUE' && r.status === 'CONTRADICTED');
  const factConflicts = blockers.filter(fact);
  const excludeViolations = blockers.filter((r) => !fact(r) && r.priority === 'EXCLUDE');
  const ctaProblems = blockers.filter((r) => !fact(r) && r.type === 'CTA' && r.priority !== 'EXCLUDE');
  const missingMust = blockers.filter((r) => !fact(r) && r.priority === 'MUST' && r.type !== 'CTA');
  const categories: HoldCategory[] = [
    ...(missingMust.length || ctaProblems.some((r) => r.status !== 'CONTRADICTED') ? ['USER_REQUIREMENT_MISSING' as const] : []),
    ...(excludeViolations.length ? ['EXCLUDE_VIOLATED' as const] : []),
    ...(ctaProblems.some((r) => r.status === 'CONTRADICTED') ? ['CTA_CONTRADICTED' as const] : []),
    ...(factConflicts.length ? ['FACT_CONFLICT' as const] : []),
  ];
  return { categories, missingMust, excludeViolations, ctaProblems, factConflicts };
}

/** 유지 검사 — 앞 단계(Writer)에서 충족됐던 요구가 뒤에서 사라졌나 */
export function requirementRegressions(before: ReadonlyArray<RequirementResult>, after: ReadonlyArray<RequirementResult>, stage: string): Array<{ id: string; stage: string; before: RequirementStatus; after: RequirementStatus; sourceText: string }> {
  return after.filter((a) => {
    const b = before.find((x) => x.id === a.id);
    return b && b.status === 'COVERED' && a.status !== 'COVERED';
  }).map((a) => ({ id: a.id, stage, before: 'COVERED' as RequirementStatus, after: a.status, sourceText: a.sourceText }));
}
