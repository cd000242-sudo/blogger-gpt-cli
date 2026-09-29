/**
 * ⏱️ v3.8.768 — 독자의 "지금 할 수 있는 행동" 을 바꾸는 상태 변화(critical state). 호출 0회·결정론.
 *
 * 실측(BATCH 1 여행 run 69f928): 근거 5건·패킷 7줄에 "마지막 날인 10월 2일은 예매 시작 뒤 조기 매진됐다" 가 있었는데 초안·최종 글 모두 0회였다.
 * 그 문장은 패킷의 사실(facts)이 아니라 **값 목록(날짜·숫자)의 문맥**으로만 7번 붙어 있었고, Writer 보기는 값("4~6일")의 의도 겹침으로
 * 7줄을 모두 보조(SUPPORTING)로 내렸다. 값의 무게로 판정하느라 문장이 담은 **상태**를 못 봤다. 결과: 답 상자가 "10월 2일 관람이라면 … 예매하면 됩니다".
 *
 * 판정 기준: "이 사실이 바뀌면 독자가 지금 할 수 있는 행동이 달라지는가?"
 *   · 일정(예매 기간 8/26~10/1)은 상태가 아니다. 완료된 전환(매진됐다 · 조기 마감됐다 · 중단됐다 · 소진됐다 · 종료됐다)만 대상이다. 예정·조건·부정은 제외.
 *   · 날짜가 주제("10월 2일은 … 매진")면 그 날짜의 행동에만 걸린다 — 지난 날짜는 이미 행동할 수 없으니 뺀다.
 *     날짜가 사건 시점("10일 조기 마감됐다")이면 지금 상태다(NOW).
 *   · 다른 연도·회차 문장, 목표 연도보다 오래된 문서뿐인 문장은 현재 회차에 쓰지 않는다(currentness).
 *   · 같은 (행동 · 상태 · 적용 날짜) 는 하나로 묶는다 — 패킷에 7번 있어도 요구사항은 1개.
 * Writer 에게는 "원래 일정보다 이 상태가 우선" 한 줄로 준다(writer-packet-view). 초안·최종 글과 대조해 COVERED / PARTIAL / MISSING / CONTRADICTED.
 * 날짜만 나온다고 COVERED 가 아니다 — 같은 문장에 상태 뜻이 있어야 한다. MISSING 을 새 호출로 채우거나 문장을 끼워 넣지 않는다.
 */

export type ActionFamily = 'BOOK' | 'APPLY' | 'BUY' | 'VISIT';
export interface CriticalState {
  subject: string;
  action: ActionFamily;
  /** 근거가 쓴 행동 낱말(예매·신청·주문 …) */
  actionWord: string;
  state: 'UNAVAILABLE';
  /** 근거가 쓴 상태 표현(조기 매진 · 조기 마감 · 중단 …) */
  stateWord: string;
  /** 상태가 걸리는 앞으로의 날짜(주제 날짜). 비어 있으면 지금 상태(NOW) */
  effective: string[];
  scope: string[];
  sourceIds: string[];
  /** 근거 문서의 가장 늦은 게시일 — "몇 월 며칠 보도 기준" */
  asOf: string | null;
  currentness: 'CURRENT';
  confidence: 'high' | 'medium';
  sentence: string;
  occurrences: number;
}
export type CriticalCoverage = 'COVERED' | 'PARTIAL' | 'MISSING' | 'CONTRADICTED';
export interface CriticalStateCheck { key: string; effective: string[]; stateWord: string; status: CriticalCoverage; evidence: string[] }

interface ClaimLike { claim?: string; context?: string; sourceIds?: string[] }
export interface PacketLike {
  mainKeyword?: string; currentAsOf?: string;
  facts?: ClaimLike[]; conditions?: ClaimLike[]; eligibility?: ClaimLike[]; officialStatements?: ClaimLike[]; conflictingInformation?: ClaimLike[];
  numbers?: ClaimLike[]; dates?: ClaimLike[];
  sourceMap?: Array<{ id: string; title?: string; pubDate?: string | null }>;
}

/** 행동 낱말 → 가족. 판매·재고는 독자 쪽에선 구매·가입이다 */
const ACTION: Array<{ family: ActionFamily; re: RegExp }> = [
  { family: 'BOOK', re: /예매|예약|관람권|입장권|티켓|좌석/ },
  { family: 'APPLY', re: /신청|접수|모집|지원|청약|등록|응시/ },
  { family: 'BUY', re: /판매|구매|구입|주문|가입|재고|사전\s*예약|출고/ },
  { family: 'VISIT', re: /운영|개방|관람|이용|입장/ },
];
/** 완료된 전환 — "됐다/했다/났다" 꼴이거나 그 자체가 결과인 말(매진·품절·동났다·잔여 0) */
const UNAVAILABLE_DONE = /(?:조기\s*)?(?:매진|품절)(?!\s*(?:이|가|을|를)?\s*(?:임박|우려|가능|예상|될|되기))|조기\s*(?:마감|종료)|(?:마감|종료|중단|중지|소진|휴관|휴장|취소)(?:됐|되었|된\s*상태|했|하였|돼)|동났|팔려\s*나갔|잔여\s*(?:수량|석)[^.]{0,8}?(?:‘?0’?|없)|재고\s*(?:가\s*)?(?:소진|없)/;
const NOT_DONE = /예정|전망|우려|가능성|될\s*수|할\s*수도|않았|않는다|아니다|없었다면|경우에?\s*(?:한해|만)|하면\s*(?:조기|마감)/;
/** 글 쪽: 그 행동을 지금 할 수 있다고 말하는 꼴 — 행동 낱말 **바로 뒤**의 가능 술어만("예매하면 됩니다" · "신청할 수 있습니다" · "주문 가능"). "잔여석부터 판단하면 됩니다" 는 아니다 */
const availableClaim = (familySource: string) => new RegExp(`(?:${familySource})(?:을|를|이|가|은|는)?[\\s|]*(?:하면|하시면|할\\s*수\\s*있|하실\\s*수\\s*있|이?\\s*가능|을?\\s*진행하면)`);
/** 질문 문장(FAQ 제목 등)은 주장이 아니다 */
const QUESTION = /\?\s*$|(?:나요|까요|인가요|을까|ㄹ까)\s*\??\s*$/;
/** 글 쪽의 불가 표현 — 전환 꼴("마감됐다" · "판매 종료")만. "마감일 전이라" · "입장 마감 20:30" 같은 명사·시각은 아니다 */
const UNAVAILABLE_TEXT = /매진|품절|조기\s*(?:마감|종료)|(?:마감|종료|중단|중지|소진)(?:됐|되었|돼|된|했|하였)|(?:판매|접수|신청|예매|예약|주문|모집)\s*(?:종료|중단|마감)(?!\s*(?:일|시각|시간|예정))|불가|할\s*수\s*없|못\s*(?:합|해)|동났|잔여\s*(?:석|수량)[^.]{0,6}(?:0|없)/;
/** 그 자체로 "지금 못 한다" 는 결과어 — 행동 낱말 없이도 상태 설명이다. "입장 마감 20:30" 같은 시각의 마감은 여기 들지 않는다 */
const UNAVAILABLE_RESULT = /매진|품절|동났|소진|잔여\s*(?:석|수량)[^.]{0,6}(?:0|없)/;
const DATE_TOKEN = /(?:(\d{1,2})\s*월\s*)?(\d{1,2})(?:\s*[~∼～\-–]\s*(\d{1,2}))?\s*일/g;
const YEAR = /(20\d{2})\s*년?/g;
const ROUND = /(상반기|하반기|\d+\s*차|\d+\s*회차)/g;

/** 문장 — 제목·문단·목록·칸·FAQ 질문 경계도 문장 경계다(제목이 다음 문장에 붙지 않게) */
const sentencesOf = (s: string) => String(s || '')
  // v3.8.769 — 표의 칸은 한 줄(행)로 잇는다: "현재 구매 | 가능" 이 한 문장이어야 표의 행동 안내를 읽는다
  .replace(/<\/(?:td|th)\s*>/gi, ' | ')
  .replace(/<br\s*\/?>|<\/(?:p|div|li|tr|h[1-6]|blockquote|summary|section|details|table)\s*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ')
  .split(/(?<=[.!?。])\s+|\n+/).map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
/** 상태가 걸린 행동 — 상태 표현 바로 앞(없으면 바로 뒤)의 행동 낱말. "사전 예약 판매를 시작했으나 이후 주문이 중단됐다" 는 예약이 아니라 주문이다 */
const actionOf = (s: string, stateAt: number, stateLen = 0): { family: ActionFamily; word: string } | null => {
  const all = ACTION.flatMap((a) => [...s.matchAll(new RegExp(a.re.source, 'g'))].map((m) => ({ family: a.family, word: m[0].replace(/\s+/g, ''), at: m.index || 0, len: m[0].length })));
  // 더 긴 낱말 안에 든 짧은 낱말은 버린다("사전예약" 안의 "예약")
  const hits = all.filter((h) => !all.some((o) => o !== h && o.len > h.len && o.at <= h.at && o.at + o.len >= h.at + h.len));
  // 상태 표현 자체에 든 행동 낱말이 먼저다("재고가 소진")
  const inside = hits.find((h) => h.at >= stateAt && h.at < stateAt + stateLen);
  if (inside) return { family: inside.family, word: inside.word };
  const before = hits.filter((h) => h.at < stateAt).sort((a, b) => b.at - a.at)[0];
  const after = hits.filter((h) => h.at >= stateAt).sort((a, b) => a.at - b.at)[0];
  const pick = before || after;
  return pick ? { family: pick.family, word: pick.word } : null;
};
const md = (m: number, d: number) => m * 100 + d;

/** 문장의 날짜들 — 달이 없는 "11~13일" 은 앞 날짜의 달을 잇는다. topic = 날짜 뒤에 은/는/관람분/회차가 붙은 목록이면 주제 날짜 */
function datesOf(sentence: string): { dates: Array<{ text: string; month: number; start: number; end: number }>; topic: boolean } {
  const out: Array<{ text: string; month: number; start: number; end: number }> = [];
  let month = 0;
  let topic = false;
  for (const m of sentence.matchAll(DATE_TOKEN)) {
    if (m[1]) month = Number(m[1]);
    if (!month) continue;
    const start = Number(m[2]); const end = m[3] ? Number(m[3]) : start;
    out.push({ text: `${month}월 ${start}일${m[3] ? `~${end}일` : ''}`, month, start, end });
    if (/^\s*(?:은|는|관람분|회차|공연|입장|분)/.test(sentence.slice((m.index || 0) + m[0].length))) topic = true;
  }
  return { dates: out, topic };
}

/** 패킷에서 critical state 를 뽑는다. today = 'YYYY-MM-DD'(서울). 키워드 연도가 있으면 그 연도가 목표, 없으면 오늘의 연도 */
export function extractCriticalStates(packet: PacketLike, opts: { keyword: string; today: string; distinctive?: string[] }): CriticalState[] {
  const [ty, tm, td] = String(opts.today || '').split('-').map(Number);
  const targetYear = Number((String(opts.keyword).match(/20\d{2}/) || [])[0]) || ty || 0;
  const todayMd = md(tm || 0, td || 0);
  const keywordRounds = new Set((String(opts.keyword).match(ROUND) || []).map((r) => r.replace(/\s+/g, '')));
  const sourceById = new Map((packet.sourceMap || []).map((s) => [s.id, s]));
  const distinctive = (opts.distinctive || []).filter((w) => w.length >= 2);
  const rows: ClaimLike[] = [
    ...(packet.facts || []), ...(packet.conditions || []), ...(packet.eligibility || []), ...(packet.officialStatements || []), ...(packet.conflictingInformation || []),
    ...(packet.numbers || []), ...(packet.dates || []),
  ];
  const byKey = new Map<string, CriticalState>();
  for (const row of rows) {
    const text = String(row.claim || row.context || '');
    const ids = (row.sourceIds || []).filter(Boolean);
    for (const s of sentencesOf(text)) {
      const stateMatch = s.match(UNAVAILABLE_DONE);
      if (!stateMatch || NOT_DONE.test(s)) continue;
      const action = actionOf(s, stateMatch.index || 0, stateMatch[0].length);
      if (!action) continue;
      // currentness — 다른 연도·회차를 적은 문장, 목표 연도보다 오래된 문서뿐인 문장은 현재 회차에 쓰지 않는다
      const years = [...s.matchAll(YEAR)].map((m) => Number(m[1]));
      if (targetYear && years.length && !years.includes(targetYear)) continue;
      const rounds = (s.match(ROUND) || []).map((r) => r.replace(/\s+/g, ''));
      if (keywordRounds.size && rounds.length && !rounds.some((r) => keywordRounds.has(r))) continue;
      const pubYears = ids.map((id) => Number(String(sourceById.get(id)?.pubDate || '').slice(0, 4))).filter((y) => y > 0);
      if (targetYear && !years.length && pubYears.length && pubYears.every((y) => y < targetYear)) continue;
      // 대상 — 문장이나 그 근거 문서 제목이 이 글의 주제어를 가리켜야 한다(다른 행사·상품의 매진을 옮겨 오지 않게)
      const onTopic = !distinctive.length || distinctive.some((w) => s.includes(w) || ids.some((id) => String(sourceById.get(id)?.title || '').includes(w)));
      if (!onTopic) continue;
      const { dates, topic } = datesOf(s);
      let effective: string[] = [];
      if (topic && dates.length) {
        effective = dates.filter((d) => md(d.month, d.end) >= todayMd).map((d) => d.text);
        if (!effective.length) continue;                                  // 주제 날짜가 모두 지났으면 지금 행동과 상관없다
      }
      const key = `${action.family}|${effective.join(',') || 'NOW'}`;
      const prev = byKey.get(key);
      const allIds = [...new Set([...(prev?.sourceIds || []), ...ids])];
      const asOf = allIds.map((id) => sourceById.get(id)?.pubDate || '').filter(Boolean).sort().pop() || null;
      byKey.set(key, {
        subject: String(packet.mainKeyword || opts.keyword),
        action: action.family, actionWord: prev?.actionWord || action.word,
        state: 'UNAVAILABLE', stateWord: prev?.stateWord || stateMatch[0].replace(/\s+/g, ' ').replace(/(됐|되었|했|하였|돼)$/, '').trim(),
        effective, scope: [...new Set([...years.map(String), ...rounds])],
        sourceIds: allIds, asOf, currentness: 'CURRENT',
        confidence: allIds.length >= 2 ? 'high' : 'medium',
        sentence: prev?.sentence || s, occurrences: (prev?.occurrences || 0) + 1,
      });
    }
  }
  return [...byKey.values()];
}

/** Writer 패킷에 싣는 한 절 — 내부 식별자 없이 행동·상태·날짜·보도 기준만 */
export function renderCriticalStates(states: CriticalState[]): string[] {
  if (!states.length) return [];
  return [
    '▸ 지금 독자의 행동을 바꾸는 상태 — 본문에서 한 번 분명히 쓰세요. 원래 일정(예매·신청 기간)보다 이 상태가 우선합니다',
    ...states.map((s) => `- ${s.effective.length ? `${s.effective.join('·')} ` : '현재 '}${s.actionWord}: ${s.stateWord}${s.asOf ? ` (${s.asOf} 보도 기준)` : ''} [${s.sourceIds.join(',')}] — ${s.effective.length ? '이 날짜를' : '지금'} ${s.actionWord}할 수 있는 것처럼 쓰지 마세요. 원래 기간을 적을 때는 이 상태를 함께 적습니다. 근거: "${s.sentence.slice(0, 120)}"`),
  ];
}

/**
 * v3.8.769 — 답 상자(요약표 호출) 입력용. Writer 보기와 **같은 상태 배열**을 쓴다(새 추출 없음).
 * 보도 기준일은 "언제 확인했나" 다 — 그 뒤 취소표·추가 판매가 없다고 말하지 않는다.
 */
export function renderCriticalStatesForAnswer(states: CriticalState[]): string {
  if (!states.length) return '';
  return [
    '⏱️ 지금 독자의 행동을 바꾸는 상태 — answer·표에서 이 상태와 반대로(그 날짜에 할 수 있다고) 쓰지 마세요. 원래 기간보다 이 상태가 우선합니다:',
    ...states.map((s) => `- ${s.effective.length ? `${s.effective.join('·')} ` : '현재 '}${s.actionWord}: ${s.asOf ? `${s.asOf} 보도 기준 ` : ''}${s.stateWord} [${s.sourceIds.join(',')}]${s.asOf ? ' (보도 기준일은 확인 시점입니다 — 그 뒤 취소분·추가 판매 여부는 근거에 없습니다)' : ''}`),
  ].join('\n');
}

/**
 * v3.8.769 — 발행 판단용 한 줄 계약: 최종 글(답 상자·본문·표·FAQ)이 상태와 **정면으로 반대**면 자동 발행 금지.
 * MISSING 은 막지 않는다(부수 정보일 수 있다) — CONTRADICTED 만 blocker.
 */
export function criticalStateGate(checks: CriticalStateCheck[]): { pass: boolean; reason: string } {
  const bad = checks.filter((c) => c.status === 'CONTRADICTED');
  return bad.length
    ? { pass: false, reason: `현재 상태와 반대 안내: ${bad.map((c) => `${c.effective.join('·') || '지금'} ${c.stateWord}`).join(', ')}` }
    : { pass: true, reason: '' };
}

const familyRe = (f: ActionFamily) => ACTION.find((a) => a.family === f)!.re;
const mentionsDate = (sentence: string, date: string) => {
  const first = date.match(/(\d{1,2})월\s*(\d{1,2})일/);
  if (!first) return false;
  return new RegExp(`${first[1]}\\s*월\\s*${first[2]}\\s*일`).test(sentence);
};

/**
 * 글이 critical state 를 다뤘는가. 날짜만 나오면 MISSING — 같은 문장에 상태 뜻(매진·마감·불가 …)이 있어야 COVERED.
 * 그 날짜(또는 지금)를 두고 행동이 된다고 말하면(상태 뜻 없이) CONTRADICTED.
 */
export function criticalStateCoverage(textOrHtml: string, states: CriticalState[]): CriticalStateCheck[] {
  const sentences = sentencesOf(textOrHtml).filter((s) => !QUESTION.test(s));
  return states.map((st) => {
    const key = `${st.action}|${st.effective.join(',') || 'NOW'}`;
    const actionRe = familyRe(st.action);
    const claimsAvailable = availableClaim(actionRe.source);
    const about = st.effective.length ? sentences.filter((s) => st.effective.some((d) => mentionsDate(s, d))) : sentences.filter((s) => actionRe.test(s));
    const contradicted = about.filter((s) => claimsAvailable.test(s) && !UNAVAILABLE_TEXT.test(s));
    const covered = about.filter((s) => UNAVAILABLE_RESULT.test(s) || (actionRe.test(s) && UNAVAILABLE_TEXT.test(s)));
    const base = { key, effective: st.effective, stateWord: st.stateWord };
    if (contradicted.length) return { ...base, status: 'CONTRADICTED' as const, evidence: contradicted.slice(0, 3).map((s) => s.slice(0, 160)) };
    if (covered.length) return { ...base, status: 'COVERED' as const, evidence: covered.slice(0, 3).map((s) => s.slice(0, 160)) };
    const partial = st.effective.length ? sentences.filter((s) => actionRe.test(s) && UNAVAILABLE_DONE.test(s)) : [];
    if (partial.length) return { ...base, status: 'PARTIAL' as const, evidence: partial.slice(0, 3).map((s) => s.slice(0, 160)) };
    return { ...base, status: 'MISSING' as const, evidence: [] };
  });
}
