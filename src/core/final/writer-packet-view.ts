/**
 * 📄 Writer 가 보는 패킷 (748-quality-fix-2 B)
 *
 * ## 왜
 * 748a 실측: 값 배정 블록은 패킷 잡음(부산 숙소 조건·연도 없는 지난 일정·기사 날짜)을 본문에 밀어 넣어 Critic 이 도로 빼냈다.
 * Writer 에게 값을 더 강제하지 말고, **Writer 가 보는 입력에서 잡음을 내리거나 뺀다.**
 *
 * ## 무엇을 하나 (LLM 호출 0)
 *   · RAW 패킷은 그대로 둔다 — Title Fact Gate·Verification·Judge·장부는 RAW 를 본다(여기서 뺀 값도 근거로는 유효하다).
 *   · Writer 프롬프트에만 이 보기를 준다. 값마다 core-values 의 같은 규칙(judgePacketValue)으로 판정한다:
 *       KEEP/CORE            — 의도 낱말과 둘 이상 겹치고 문맥에 값이 있는 판단 기준
 *       DEMOTE/SUPPORTING    — 뜻은 통하지만 기준은 아닌 값(의도 겹침 하나뿐 · 다른 도시와의 관계 값 · 문맥에 값이 없음)
 *       DEMOTE/CONTEXT_ONLY  — 지난해·지난 회차·이미 지난 날짜·요일 어긋난 일정 → "배경" 묶음, 현재 기준으로 쓰지 말라고 적는다
 *       DROP_FROM_WRITER_VIEW — 기사 작성일·오늘 날짜·다른 도시만의 값·쪼개진 숫자·정의(=)
 *   · 값→절 배정은 하지 않는다. 절은 Writer 가 고른다.
 */
import { buildJudgeContext, judgePacketValue, type CoreContext, type PacketValueReason, citiesIn } from './core-values';
import type { ResearchPacket, SourcedClaim, SourcedValue } from './research-packet';

export type ViewTier = 'CORE' | 'SUPPORTING' | 'CONTEXT_ONLY';
export type ViewVerdict = 'KEEP' | 'DEMOTE' | 'DROP_FROM_WRITER_VIEW';
export interface ViewDecision {
  kind: 'number' | 'date' | 'condition' | 'fact' | 'eligibility' | 'official' | 'conflict';
  value: string;
  context: string;
  verdict: ViewVerdict;
  tier: ViewTier | null;
  reason: PacketValueReason | 'OK';
}
export interface WriterPacketView { text: string; decisions: ViewDecision[]; summary: string }

/** 이유별 처분 — 근거가 낡은 것은 배경으로, 근거가 아닌 것은 뺀다 */
const CONTEXT_ONLY_REASONS = new Set<PacketValueReason>(['STALE_YEAR', 'PAST_ROUND', 'PAST_DATE', 'WEEKDAY_MISMATCH']);
const SUPPORTING_REASONS = new Set<PacketValueReason>(['LOW_INTENT', 'NO_VALUE_IN_CONTEXT']);

export function buildWriterPacketView(packet: ResearchPacket, ctx: CoreContext): WriterPacketView {
  const judge = buildJudgeContext(packet, ctx);
  const decisions: ViewDecision[] = [];

  /**
   * 출처(sourceMap)로 한 번 더 본다 — 문맥 문장에 도시·연도가 없어도 출처 제목·게시일이 말해 준다.
   * live 748a: "10월 25일~11월 10일 프로모션" 은 문맥에 도시가 없어 CORE 가 됐는데 출처 제목이 "해운대 모던 스테이" (부산) 였다.
   * live 748b: "APEC(10월27일~11월1일)" 은 연도가 없는데 출처가 2025-12 기사였다 — 지난해 일정이다.
   */
  const sourceMap = new Map<string, { title: string; pubDate: string | null }>((packet.sourceMap || []).map((s) => [String(s.id), { title: String(s.title || ''), pubDate: s.pubDate ? String(s.pubDate) : null }]));
  const sourceHint = (ids: string[], value: string): { crossCity: boolean; otherCityOnly: boolean; staleSource: boolean } => {
    const srcs = (ids || []).map((id) => sourceMap.get(String(id))).filter(Boolean) as Array<{ title: string; pubDate: string | null }>;
    if (!srcs.length) return { crossCity: false, otherCityOnly: false, staleSource: false };
    const cities = srcs.flatMap((s) => citiesIn(s.title));
    const other = judge.intentCities.length > 0 && cities.some((c) => !judge.intentCities.includes(c));
    const same = judge.intentCities.some((c) => cities.includes(c));
    const years = srcs.map((s) => (s.pubDate || '').match(/^(\d{4})/)).map((m) => (m ? Number(m[1]) : null));
    const allDated = years.length > 0 && years.every((y) => y !== null);
    const staleSource = allDated && years.every((y) => (y as number) < judge.nowYear) && !/20\d{2}/.test(value);
    return { crossCity: other && same, otherCityOnly: other && !same, staleSource };
  };

  const decide = (kind: ViewDecision['kind'], value: string, context: string, sourceIds: string[] = []): ViewDecision => {
    const v = judgePacketValue(kind === 'number' || kind === 'date' ? kind : 'fact', value, context, judge);
    const hint = sourceHint(sourceIds, value);
    let d: ViewDecision;
    if (v.ok && hint.otherCityOnly && !v.crossCity) {
      d = { kind, value, context, verdict: 'DROP_FROM_WRITER_VIEW', tier: null, reason: 'OTHER_CITY' };
    } else if (v.ok && hint.staleSource && (kind === 'date' || /\d{1,2}\s*월/.test(value))) {
      d = { kind, value, context, verdict: 'DEMOTE', tier: 'CONTEXT_ONLY', reason: 'STALE_SOURCE' };
    } else if (v.ok) {
      // 다른 도시와의 관계 값(대구→경주 셔틀)은 뜻은 통하지만 이 글의 판단 기준은 아니다
      d = v.crossCity || hint.crossCity ? { kind, value, context, verdict: 'DEMOTE', tier: 'SUPPORTING', reason: 'OK' } : { kind, value, context, verdict: 'KEEP', tier: 'CORE', reason: 'OK' };
    } else if (CONTEXT_ONLY_REASONS.has(v.reason!)) {
      d = { kind, value, context, verdict: 'DEMOTE', tier: 'CONTEXT_ONLY', reason: v.reason! };
    } else if (SUPPORTING_REASONS.has(v.reason!)) {
      d = { kind, value, context, verdict: 'DEMOTE', tier: 'SUPPORTING', reason: v.reason! };
    } else {
      d = { kind, value, context, verdict: 'DROP_FROM_WRITER_VIEW', tier: null, reason: v.reason! };
    }
    decisions.push(d);
    return d;
  };

  /**
   * 정리된 문장(사실·자격·조건·기관 발표·상충)은 LLM 이 이미 고른 것이라 값 판정을 다 대지 않는다.
   * 다만 **다른 도시만의 문장**(해운대 모던 스테이 조건)과 **지난해 문장**은 Writer 에게서 뺀다/내린다 — 748a 에서 본문에 들어간 그 잡음이다.
   */
  const claimDecision = (kind: ViewDecision['kind'], c: SourcedClaim): ViewDecision => {
    const claim = String(c.claim || '');
    const cities = citiesIn(claim);
    const otherOnly = judge.intentCities.length > 0 && cities.some((x) => !judge.intentCities.includes(x)) && !judge.intentCities.some((x) => cities.includes(x));
    let d: ViewDecision;
    if (otherOnly) d = { kind, value: claim, context: claim, verdict: 'DROP_FROM_WRITER_VIEW', tier: null, reason: 'OTHER_CITY' };
    else if (/(지난해|작년|전년|20(?:19|2[0-4]))\s*년?/.test(claim) && !new RegExp(`${judge.nowYear}`).test(claim)) d = { kind, value: claim, context: claim, verdict: 'DEMOTE', tier: 'CONTEXT_ONLY', reason: 'STALE_YEAR' };
    else d = { kind, value: claim, context: claim, verdict: 'KEEP', tier: 'SUPPORTING', reason: 'OK' };   // 문장은 값이 아니다 — CORE 수치로 올리지 않는다
    decisions.push(d);
    return d;
  };

  const line = (c: SourcedClaim) => `- ${c.claim} [${c.sourceIds.join(',')}]`;
  const val = (v: SourcedValue) => `- ${v.value} — ${v.context} [${v.sourceIds.join(',')}]`;
  const section = (title: string, rows: string[]) => (rows.length ? [`▸ ${title}`, ...rows] : []);
  // KEEP 만 제자리에 남는다 — CONTEXT_ONLY 문장은 아래 "배경" 묶음으로, DROP 은 Writer 에게 안 간다
  const keepClaims = (kind: ViewDecision['kind'], rows: SourcedClaim[]) => rows.filter((c) => claimDecision(kind, c).verdict === 'KEEP');

  const facts = keepClaims('fact', packet.facts || []);
  const eligibility = keepClaims('eligibility', packet.eligibility || []);
  const conditions = keepClaims('condition', packet.conditions || []);
  const official = keepClaims('official', packet.officialStatements || []);
  const conflicts = keepClaims('conflict', packet.conflictingInformation || []);

  const numberRows = (packet.numbers || []).map((n) => ({ row: n, d: decide('number', n.value, n.context, n.sourceIds) }));
  const dateRows = (packet.dates || []).map((n) => ({ row: n, d: decide('date', n.value, n.context, n.sourceIds) }));
  const byTier = (tier: ViewTier, rows: Array<{ row: SourcedValue; d: ViewDecision }>) => rows.filter((r) => r.d.tier === tier).map((r) => val(r.row));

  const background = [
    ...byTier('CONTEXT_ONLY', numberRows),
    ...byTier('CONTEXT_ONLY', dateRows),
    ...decisions.filter((d) => d.tier === 'CONTEXT_ONLY' && !['number', 'date'].includes(d.kind)).map((d) => `- ${d.value}`),
  ];

  const text = [
    `[RESEARCH PACKET — ${packet.currentAsOf} 서울 기준 · 메인 키워드: ${packet.mainKeyword}]`,
    '(Writer 보기 — 판단 기준이 아닌 값은 보조·배경으로 내렸거나 뺐습니다. 핵심 수치는 그 값 그대로 조언 문장의 기준으로 씁니다.)',
    ...(packet.searchIntent ? [`검색 의도: ${packet.searchIntent}`] : []),
    ...section('확인된 사실', facts.map(line)),
    ...section('자격·대상', eligibility.map(line)),
    ...section('조건·절차', conditions.map(line)),
    ...section('기관 발표', official.map(line)),
    ...section('핵심 수치 — 이 글의 판단 기준 (근거 원문 표기 그대로)', byTier('CORE', numberRows)),
    ...section('핵심 날짜·기간 — 이 글의 판단 기준 (근거 원문 표기 그대로)', byTier('CORE', dateRows)),
    ...section('보조 수치·날짜 (뜻이 통할 때만 · 기준으로 세우지 않습니다)', [...byTier('SUPPORTING', numberRows), ...byTier('SUPPORTING', dateRows)]),
    ...section('배경 — 지난해·지난 회차·이미 지난 일정 (현재 기준으로 쓰지 마세요. 쓰려면 "지난해에는" 처럼 시점을 붙입니다)', background),
    ...section('근거끼리 다른 점 — 섞어 쓰지 마세요', conflicts.map(line)),
    ...section('검색자가 실제로 물은 것', (packet.readerQuestions || []).map((q) => `- ${q}`)),
    ...section('실제 자동완성(연관 검색어)', (packet.actualSearchSuggestions || []).length ? [`- ${packet.actualSearchSuggestions.join(' / ')}`] : []),
    ...(packet.status === 'EMPTY' ? ['⚠️ 확인된 근거가 없습니다. 금액·날짜·기간·자격조건을 구체적으로 쓰지 말고, 공식 창구에서 확인하라고 안내하세요.'] : []),
  ].join('\n');

  const count = (verdict: ViewVerdict) => decisions.filter((d) => d.verdict === verdict).length;
  const core = decisions.filter((d) => d.tier === 'CORE').length;
  const summary = `KEEP ${count('KEEP')} · DEMOTE ${count('DEMOTE')} · DROP ${count('DROP_FROM_WRITER_VIEW')} (핵심 수치 ${core}개)`;
  return { text, decisions, summary };
}
