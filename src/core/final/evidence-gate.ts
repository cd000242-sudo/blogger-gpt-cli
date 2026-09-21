/**
 * 🚦 Evidence Quality Gate + 단계 상태 (v3.8.734)
 *
 * 검색했다고 곧바로 쓰지 않는다. Writer 직전에 **이 근거로 써도 되는가**를 본다.
 * 모자라면 ① 검색어를 바꿔 다시 ② 공식 자료를 다시 찾고 ③ 그래도 모자라면 **모자란 채로 표시한다.**
 * 모자란 근거를 모델의 추론으로 메우지 않는다 — 그건 Writer 지시(근거 밖 수치 금지)가 맡는다.
 *
 * 발행을 막지는 않는다(이 앱의 원칙: 검수 때문에 발행이 멈추면 안 된다). 대신 조용히 넘어가지도 않는다 —
 * 단계마다 상태를 남기고, 화면 로그·결과·발행 장부에서 볼 수 있게 한다.
 */

import type { EvidenceItem } from './evidence';

export type StageStatus =
  | 'SEARCH_OK' | 'SEARCH_WEAK' | 'SEARCH_FAIL'
  | 'CLEAN_OK'
  | 'GROUNDING_OK' | 'GROUNDING_WEAK'
  | 'RESEARCH_OK' | 'RESEARCH_WEAK' | 'RESEARCH_EMPTY'
  | 'WRITER_READY' | 'WRITER_READY_WEAK';

export interface GateVerdict {
  status: 'GROUNDING_OK' | 'GROUNDING_WEAK';
  reasons: string[];
  needsOfficial: boolean;
  needsDates: boolean;
  stats: { total: number; official: number; news: number; withBody: number; withDate: number; withUrl: number; chars: number };
}

/** 공식 자료가 있어야 하는 주제 — 제도·돈·법·행정 */
const OFFICIAL_TOPIC = /(지원금|보조금|수당|급여|바우처|장려금|환급|공제|세금|연말정산|과태료|벌금|신고|신청|접수|자격|대상자|소득\s*기준|적금|대출|금리|보험|연금|청약|전세|월세|임대|분양|법|시행령|고시|조례|접종|건강검진|복지|실업|고용|출산|육아|장학|학자금|병역|비자|여권|면허|인허가)/;
/** 날짜가 결정적인 주제 — 회차·기간·마감·최신 */
const DATE_TOPIC = /(\d+\s*차|신청\s*기간|접수|마감|모집|일정|언제|개편|시행|인상|인하|돌파|발표|출시|속보|최신|20\d{2})/;

export function topicNeeds(mainKeyword: string, title = ''): { needsOfficial: boolean; needsDates: boolean } {
  const text = `${mainKeyword} ${title}`;
  return { needsOfficial: OFFICIAL_TOPIC.test(text), needsDates: DATE_TOPIC.test(text) };
}

export function evaluateEvidence(items: EvidenceItem[], mainKeyword: string, title = ''): GateVerdict {
  const { needsOfficial, needsDates } = topicNeeds(mainKeyword, title);
  const stats = {
    total: items.length,
    official: items.filter((i) => i.isOfficial).length,
    news: items.filter((i) => i.sourceType === 'news').length,
    withBody: items.filter((i) => i.hasBody).length,
    withDate: items.filter((i) => !!i.pubDate).length,
    withUrl: items.filter((i) => /^https?:\/\//i.test(i.url)).length,
    chars: items.reduce((n, i) => n + i.cleanedText.length, 0),
  };
  const reasons: string[] = [];
  if (stats.total < 3) reasons.push(`관련 근거 ${stats.total}건(3건 미만)`);
  if (stats.withBody < 1) reasons.push('본문을 확인한 근거 0건(검색 요약뿐)');
  if (stats.chars < 1500) reasons.push(`근거 분량 ${stats.chars}자(1,500자 미만)`);
  if (needsOfficial && stats.official === 0) reasons.push('공식기관 자료 0건(제도·행정 주제)');
  if (needsDates && stats.withDate === 0) reasons.push('게시일을 아는 근거 0건(시점이 중요한 주제)');
  return { status: reasons.length ? 'GROUNDING_WEAK' : 'GROUNDING_OK', reasons, needsOfficial, needsDates, stats };
}

export function describeGate(v: GateVerdict): string {
  const s = v.stats;
  const head = `근거 ${s.total}건 (공식 ${s.official} · 뉴스 ${s.news} · 본문확인 ${s.withBody} · 날짜 ${s.withDate}/${s.total} · URL ${s.withUrl}/${s.total} · ${s.chars.toLocaleString()}자)`;
  return v.status === 'GROUNDING_OK' ? head : `${head} · 사유: ${v.reasons.join(' / ')}`;
}

/** 단계 상태 기록 — orchestration 이 한 편마다 하나 만든다 */
export class PipelineStatus {
  readonly stages: Array<{ stage: string; status: StageStatus | string; detail: string }> = [];
  private readonly log?: ((m: string) => void) | undefined;
  constructor(onLog?: (m: string) => void) { this.log = onLog; }
  mark(stage: string, status: StageStatus | string, detail = ''): void {
    this.stages.push({ stage, status, detail });
    this.log?.(`[STAGE] ${stage}: ${status}${detail ? ` — ${detail}` : ''}`);
  }
  get weak(): boolean { return this.stages.some((s) => /WEAK|FAIL|EMPTY/.test(String(s.status))); }
  summary(): string { return this.stages.map((s) => `${s.stage}=${s.status}`).join(' · '); }
}
