/**
 * 🧬 v3.8.767 — 최종 원고의 값마다 출처 계보(provenance)를 남긴다.
 *
 * 실측(run 19fb30): "고속도로 447km · 도심 545km" 가 근거 장부(E번호) 어디에도 없이 본문에 들어갔다. 경로는 유료 팩트체크 요약
 * ("[FACT EVIDENCE — 보조]" 블록)이었고, 사실 필터·본문 관문은 km 를 값으로 읽지 않아 아무도 대조하지 않았다.
 * 값이 맞았는지와 별개로, 어디서 왔는지 모르는 값은 검수할 수 없다.
 *
 * 계보 종류: EVIDENCE_SOURCE(근거 장부 ID) · DERIVED_FROM_EVIDENCE(근거 값의 한 단계 계산) · HYPOTHETICAL(명시적 가정) ·
 *           FACTCHECK_SOURCE(팩트체크 요약 — 문단의 인용 주소 또는 요약 전체의 검증 주소 목록) · NONE(계보 없음 → 검수 대상).
 * 팩트체크 요약은 **주소가 하나도 없으면** 검사 근거로 쓰지 않는다(factcheckWithLineage) — 요약이 말했다는 것만으로는 출처가 아니다.
 * 새 호출 없음.
 */
import { extractClaims, norm, type DerivedSupport, type LedgerItem } from './fact-claims';

export type ProvenanceKind = 'EVIDENCE_SOURCE' | 'DERIVED_FROM_EVIDENCE' | 'HYPOTHETICAL' | 'FACTCHECK_SOURCE' | 'NONE';

export interface FactcheckParagraph { text: string; urls: string[]; lineage: 'inline' | 'report' | 'none' }

export interface ProvenanceEntry {
  claim: string;
  kind: ProvenanceKind;
  sourceIds?: string[];
  operation?: string;
  factcheck?: { provider: string; query: string; urls: string[]; lineage: 'inline' | 'report'; excerpt: string };
}

const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;
/** km·kWh·cc 같은 측정값 — fact-claims 의 값 종류(금액·비율·인원·기간·날짜)에 없는 것까지 계보를 본다 */
const MEASURE = /\d[\d,]*(?:\.\d+)?\s*(?:km|㎞|kWh|kW|cc|마력|톤|kg|인치|분)(?![A-Za-z])/g;

/** 팩트체크 요약을 문단으로 — 문단 안 주소가 있으면 inline, 없으면 요약 끝의 검증 주소 목록(또는 호출부가 준 주소)이 있을 때 report */
export function splitFactcheck(context: string, sourceUrls: ReadonlyArray<string> = []): FactcheckParagraph[] {
  const blocks = String(context || '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const listIdx = blocks.findIndex((b) => /^\[?\s*(?:verified\s*source\s*urls|sources?|출처|참고)/i.test(b));
  const reportUrls = [...new Set([...(listIdx >= 0 ? blocks.slice(listIdx).join('\n').match(URL_RE) || [] : []), ...sourceUrls.filter((u) => /^https?:\/\//i.test(u))])];
  const body = listIdx >= 0 ? blocks.slice(0, listIdx) : blocks;
  return body.map((text) => {
    const urls = [...new Set(text.match(URL_RE) || [])];
    return urls.length ? { text, urls, lineage: 'inline' as const } : { text, urls: reportUrls, lineage: reportUrls.length ? 'report' as const : 'none' as const };
  });
}

/** 검사 근거로 넣을 팩트체크 요약 — 계보 없는 문단은 뺀다(그 문단에만 있는 값은 원고에 들어갈 근거가 없다) */
export function factcheckWithLineage(context: string, sourceUrls: ReadonlyArray<string> = []): { context: string; dropped: number } {
  const paragraphs = splitFactcheck(context, sourceUrls);
  const kept = paragraphs.filter((p) => p.lineage !== 'none');
  return { context: kept.map((p) => p.text).join('\n\n'), dropped: paragraphs.length - kept.length };
}

function valuesOf(text: string): string[] {
  const src = String(text || '').replace(/<[^>]+>/g, ' ');
  const out = extractClaims(src).map((c) => c.text);
  for (const m of src.matchAll(MEASURE)) out.push(m[0].trim());
  const seen = new Set<string>();
  return out.filter((v) => { const k = norm(v); if (/^20\d{2}년$/.test(k) || seen.has(k)) return false; seen.add(k); return true; });
}

/**
 * 최종 본문의 값마다 계보를 붙인다. 순서: 근거 장부 → 파생 계산 → 팩트체크 요약 → 명시적 가정 → 없음.
 * ledger 는 ledgerFromItems 를 지난 근거(ID·정규화 본문)다.
 */
export function traceProvenance(text: string, input: {
  ledger: ReadonlyArray<LedgerItem>;
  derived?: ReadonlyArray<DerivedSupport>;
  hypothetical?: ReadonlyArray<string>;
  factcheck?: { provider: string; query: string; paragraphs: ReadonlyArray<FactcheckParagraph> };
}): ProvenanceEntry[] {
  const ledger = input.ledger.map((l) => ({ id: l.id, text: norm(l.text) }));
  const derived = new Map((input.derived || []).map((d) => [norm(d.claim), d]));
  const hypothetical = new Set((input.hypothetical || []).map(norm));
  const fcParas = (input.factcheck?.paragraphs || []).map((p) => ({ ...p, flat: norm(p.text) }));
  return valuesOf(text).map((claim): ProvenanceEntry => {
    const key = norm(claim);
    const ids = ledger.filter((l) => l.text.includes(key)).map((l) => l.id);
    if (ids.length) return { claim, kind: 'EVIDENCE_SOURCE', sourceIds: ids.slice(0, 5) };
    const d = derived.get(key);
    if (d) return { claim, kind: 'DERIVED_FROM_EVIDENCE', sourceIds: d.sourceIds, operation: d.operation };
    const fc = fcParas.find((p) => p.lineage !== 'none' && p.flat.includes(key));
    if (fc && input.factcheck) {
      const at = Math.max(0, fc.text.indexOf((key.match(/\d+/) || [''])[0]));
      return { claim, kind: 'FACTCHECK_SOURCE', factcheck: { provider: input.factcheck.provider, query: input.factcheck.query, urls: fc.urls.slice(0, 5), lineage: fc.lineage as 'inline' | 'report', excerpt: fc.text.slice(Math.max(0, at - 80), at + 120).replace(/\s+/g, ' ').trim() } };
    }
    if (hypothetical.has(key)) return { claim, kind: 'HYPOTHETICAL' };
    return { claim, kind: 'NONE' };
  });
}

export function summarizeProvenance(entries: ReadonlyArray<ProvenanceEntry>): Record<ProvenanceKind, number> {
  const out: Record<ProvenanceKind, number> = { EVIDENCE_SOURCE: 0, DERIVED_FROM_EVIDENCE: 0, HYPOTHETICAL: 0, FACTCHECK_SOURCE: 0, NONE: 0 };
  for (const e of entries) out[e.kind] += 1;
  return out;
}
