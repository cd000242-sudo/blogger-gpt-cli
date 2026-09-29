/**
 * 🧾 v3.8.755 — 검사기용 근거 보기(validation view).
 *
 * 계약: Writer 가 쓰도록 허용된 **채택 근거**는 그 원고를 검사하는 단계에서도 대조할 수 있어야 한다.
 *
 * 실제 run f607bc: 본문 사실 필터의 문맥은 buildGroundingReference(유료 요약 + naverGrounding 900자 발췌 + 크롤링 발췌)였고,
 * Writer 는 근거 장부 렌더(보존 본문에서 고른 문장)를 받았다. Writer 가 정당하게 쓴 "연매출 1억 원·중위소득 150%·총급여 3,600만"
 * 을 필터가 못 보고 지웠다(017→018). 여기서는 같은 장부(evidenceItems: 안정 ID·정제 보존 본문)로 검사 문맥을 만든다.
 *
 * 하지 않는 것: 탈락 후보(rejected)·검색 결과 전체를 넣지 않는다 · Writer 본문·요약표를 근거로 쓰지 않는다 ·
 * 프롬프트용 문맥(factEvidence.context)은 손대지 않는다(프롬프트·비용 불변).
 */
import { createHash } from 'crypto';
import type { EvidenceItem } from './evidence';
import type { FactEvidence } from './fact-integrity';

/** 검사 문맥 상한 — 채택 문서 31건 × 보존 6,000자 = 18.6만 자까지 담긴다. 넘으면 전달 문서부터 남기고 complete=false 로 표시 */
export const VALIDATION_CONTEXT_MAX_CHARS = 200000;

export interface ValidationDoc {
  id: string;
  url: string;
  domain: string;
  sourceType: string;
  chars: number;
  /** 보존 본문이 상한에서 잘린 위치. null = 안 잘림. undefined = 보존 본문 없이 발췌만(legacy) */
  truncatedAt: number | null | undefined;
  /** 추출기의 보존 본문(fullText)으로 들어온 문서인가 — false 면 발췌만 대조한다 */
  retained: boolean;
  hasBody: boolean;
  /** 이번 렌더에서 Writer 에게 전달된 문서인가(알 수 없으면 undefined) */
  delivered?: boolean;
}

export interface ValidationEvidence {
  evidence: FactEvidence;
  docs: ValidationDoc[];
  contextChars: number;
  contextSha1: string;
  /** 채택 문서를 전부 담았는가. 상한에 밀려 뺀 문서가 있으면 false */
  complete: boolean;
  /** 'ledger' = 채택 근거 장부 · 'legacy-excerpt' = 장부가 비어 예전 발췌 문맥 그대로 */
  basis: 'ledger' | 'legacy-excerpt';
  /** 상한 때문에 빠진 문서 ID */
  droppedIds: string[];
  /** 발췌만 있는(보존 본문 없는) 문서 ID — 이 문서의 뒷부분은 대조할 수 없다 */
  excerptOnlyIds: string[];
}

export interface ValidationExtras {
  /** 유료 검증 요약(퍼플렉시티 등). 근거로 인정한다 */
  paidContext?: string;
  /** 사용자가 준 공고 원문·리포트 사실. 근거로 인정한다 */
  briefFacts?: string;
  /** 기관 근거 블록(공식 페이지). 근거로 인정한다 */
  officialBlock?: string;
  /** 이번 렌더에서 Writer 에게 전달된 문서 ID */
  deliveredIds?: Set<string>;
  maxChars?: number;
}

const sha1 = (s: string) => createHash('sha1').update(s, 'utf8').digest('hex');

export function buildValidationEvidence(items: ReadonlyArray<EvidenceItem>, base: FactEvidence, extras: ValidationExtras = {}): ValidationEvidence {
  const max = Math.max(10000, Number(extras.maxChars) || VALIDATION_CONTEXT_MAX_CHARS);
  const head = [extras.briefFacts, extras.paidContext, extras.officialBlock].map((s) => String(s || '').trim()).filter(Boolean);
  if (!items || items.length === 0) {
    const context = [...head, String(base.context || '')].filter(Boolean).join('\n\n');
    return {
      evidence: { ...base, context },
      docs: [], contextChars: context.length, contextSha1: sha1(context), complete: false, basis: 'legacy-excerpt', droppedIds: [], excerptOnlyIds: [],
    };
  }
  const delivered = extras.deliveredIds;
  // 전달된 문서를 앞에 — 상한에 밀리면 Writer 가 못 본 문서부터 빠진다
  const ordered = [...items].sort((a, b) => Number(!!delivered?.has(b.id)) - Number(!!delivered?.has(a.id)));
  const parts: string[] = [...head];
  let used = head.reduce((n, s) => n + s.length + 2, 0);
  const docs: ValidationDoc[] = [];
  const droppedIds: string[] = [];
  for (const item of ordered) {
    const block = `[${item.id}] ${item.title}\n${item.cleanedText}`;
    if (used + block.length > max) { droppedIds.push(item.id); continue; }
    parts.push(block);
    used += block.length + 2;
    docs.push({
      id: item.id, url: item.url, domain: item.domain, sourceType: item.sourceType, chars: item.cleanedText.length,
      truncatedAt: item.truncatedAt, retained: item.truncatedAt !== undefined, hasBody: item.hasBody,
      ...(delivered ? { delivered: delivered.has(item.id) } : {}),
    });
  }
  const context = parts.join('\n\n');
  const sourceUrls = [...new Set([...(base.sourceUrls || []), ...docs.map((d) => d.url).filter((u) => /^https?:\/\//i.test(u))])].slice(0, 40);
  return {
    evidence: { ...base, context, sourceUrls, trustLevel: base.trustLevel === 'none' ? 'weak' : base.trustLevel, provider: base.provider === 'none' ? 'Evidence Ledger' : base.provider },
    docs, contextChars: context.length, contextSha1: sha1(context), complete: droppedIds.length === 0, basis: 'ledger', droppedIds,
    excerptOnlyIds: docs.filter((d) => !d.retained).map((d) => d.id),
  };
}

/** run-trace 에 남길 입력 기록 — 문맥 본문은 넣지 않는다(장부 스냅샷 ID 로 가리킨다) */
export function describeValidationInput(view: ValidationEvidence, fields: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...fields,
    basis: view.basis, complete: view.complete, contextChars: view.contextChars, contextSha1: view.contextSha1,
    trustLevel: view.evidence.trustLevel, provider: view.evidence.provider,
    docs: view.docs.map((d) => `${d.id}:${d.chars}${d.retained ? '' : ':excerpt'}${d.truncatedAt ? `:T${d.truncatedAt}` : ''}${d.delivered === false ? ':undelivered' : ''}`),
    droppedIds: view.droppedIds, excerptOnlyIds: view.excerptOnlyIds,
  };
}
