/**
 * 🎯 핵심 값 배정 (748-quality-prep)
 *
 * ## 왜
 * 정보밀도 감사(2026-09-22, live 5편): 두루뭉실함의 원인은 근거 부족이 아니라 **Writer 가 패킷에 있는 구체 값을 조언 문장에서 버린 것**이었다.
 * 여행 패킷의 "▸ 수치" 20줄 중 19줄이 잡음(11개월·90%·4배·73%·33회…)이고 정작 "12,800 객실 · 3~6개월 전" 은 그 사이에 묻혀 있었다.
 * 규칙 문장은 이미 충분히 있다(실속 규칙 1~6 · 결정 지원 1~5). 부족한 것은 **어느 값이 핵심이고 어느 절에서 쓸지**다.
 *
 * ## 무엇을 하나 (LLM 호출 0)
 *   · 패킷의 수치·날짜·조건 중 검색 의도·제목·소제목의 낱말과 겹치는 것만 CORE 로 고른다(잡음·시점 표시 제외).
 *   · CORE 값 하나를 **한 절에만** 배정한다(가장 겹치는 소제목). 같은 값이 3~5절에서 되풀이되던 것도 이걸로 막는다.
 *   · Writer 프롬프트에 짧은 블록 하나를 붙인다: 값 → 쓸 절 → "조언 문장의 기준으로". 이미 잘 쓰는 글(정책·자동차)은 값이 이미 본문에 있어 결과가 안 바뀐다.
 */

import { norm, extractClaims } from './fact-claims';

export interface CoreValue {
  value: string;
  context: string;
  kind: 'number' | 'date' | 'condition' | 'fact';
  sourceIds: string[];
  /** 배정된 절(0-based h2 index). 없으면 -1(도입·결론·요약표에서만) */
  sectionIndex: number;
  score: number;
}

export interface CoreContext { keyword: string; title: string; h2Titles: string[]; questions?: string[]; searchIntent?: string }

const MAX_CORE = 10;
const MAX_PER_SECTION = 3;
/** 시점 표시("[2025-10-30 작성 · 11개월 전]")나 문맥이 없는 값은 판단 기준이 아니다 */
const NOISE_CONTEXT = /^\s*\[?\d{4}-\d{2}-\d{2}\s*작성|·\s*\d+\s*(?:개월|일|년)\s*전\]|방송일|작성일|게시일|입력\s*\d{4}|기사입력|수정\s*\d{4}|^\s*$/;
/** 다른 회차·다른 해·다른 대상의 값 — 현재 판단 기준이 아니다 */
const STALE_CONTEXT = /(지난해|작년|전년|2019|2020|2021|2022|2023|2024)\s*(?:\d{1,2}\s*월)?|제\d{1,2}회 .{0,10}(?:2019|2020|2021|2022|2023)/;   // "지난 7월 15일" 은 올해 7월이다(금융 fixture) — 지난 N월 은 낡음 신호가 아니다. 출처 게시일은 writer-packet-view 가 본다

/**
 * 의도 낱말 — evidence.ts 의 distinctiveTokens 는 개체 판별용이라 "예약·예매·기간·일정·가격" 같은 행동어를 버린다.
 * 여기서는 그 행동어가 곧 판단 기준의 신호다(예매 시각·예약 시기·객실 수). 조사만 떼고 기능어만 뺀다.
 */
const STOP = new Set(['알고', '싶다', '싶어요', '여부', '상황', '것', '수', '등', '및', '위해', '대한', '대해', '관련', '경우', '이상', '이하', '있는', '없는', '하는', '되는', '무엇', '어떻게', '언제', '얼마', '무엇을', '어디서', '어떤', '있나요', '되나요', '인가요', '할까', '까요', '나요', '정보', '내용', '방법', '확인', '정리', '총정리', '추천', '법', '때', '뒤', '전', '중', '후', '위', '아래']);
const PARTICLE = /(의|와|과|을|를|은|는|이|가|에|로|으로|에서|까지|부터|도|만|라면|이면|처럼|보다|에게|이나|나)$/;
const toks = (s: string): string[] => String(s || '').toLowerCase().split(/[^0-9a-z가-힣%~.]+/).map((w) => w.replace(PARTICLE, '')).filter((w) => w.length >= 2 && !STOP.has(w) && !/^\d+$/.test(w));
/** 한국어 합성어("최고금리"·"주담대금리")를 잡으려고 낱말 포함으로 센다 — 문맥 문자열에 의도 낱말이 들어 있으면 겹친 것 */
const overlap = (contextFlat: string, tokens: Iterable<string>): number => { let n = 0; for (const t of tokens) if (contextFlat.includes(t)) n += 1; return n; };

/** 현재 연도보다 앞선 해가 값이나 문맥에 박혀 있으면 지난 회차·지난 행사다 ("2025년 11월, 경주가 APEC…" · "6월 22일부터 7월 3일까지 진행된 최초 모집") */
const yearsIn = (s: string): number[] => (String(s || '').match(/(20\d{2})\s*년?/g) || []).map((y) => Number(y.slice(0, 4)));
const PAST_ROUND = /(최초|1차|지난|앞서|직전)\s*(?:모집|접수|공고|회차|시즌|행사)/;
const CITIES = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '수원', '성남', '고양', '용인', '창원', '청주', '전주', '천안', '포항', '경주', '과천', '양산', '김해', '구미', '제주', '강릉', '춘천', '여수', '순천', '군산', '목포', '안동'];
/** 748-fix-2: 동네 이름은 도시로 읽는다 — "해운대 모던 스테이" 는 부산 숙소다(경주 글에 끼던 것). 동네가 키워드면 그 도시의 값은 같은 지역이다 */
const DISTRICTS: Record<string, string> = { '해운대': '부산', '서면': '부산', '광안리': '부산', '동성로': '대구', '강남': '서울', '명동': '서울', '홍대': '서울', '보문단지': '경주', '황리단길': '경주' };
/** 글자에 든 도시(동네는 도시로) — 중복 없이 */
export function citiesIn(text: string): string[] {
  const t = String(text || '');
  const out = new Set<string>(CITIES.filter((city) => t.includes(city)));
  for (const [district, city] of Object.entries(DISTRICTS)) if (t.includes(district)) out.add(city);
  return [...out];
}

/** 값 하나에 대한 판정 — 748-fix-2 에서 selectCoreValues 와 Writer 패킷 보기가 같은 규칙을 쓴다 */
export type PacketValueReason =
  | 'ARTICLE_DATE' | 'STALE_YEAR' | 'PAST_ROUND' | 'PAST_DATE' | 'OTHER_CITY' | 'SPLIT_NUMBER' | 'DEFINITION' | 'WEEKDAY_MISMATCH' | 'SITE_CHROME' | 'LOW_INTENT' | 'NO_VALUE_IN_CONTEXT'
  /** writer-packet-view 만 쓴다 — 연도 없는 날짜인데 출처가 전부 지난해 이전 글이면 그 해의 일정이다 */
  | 'STALE_SOURCE';
/** 사이트 껍데기 수치 — "350개 호텔, 숙소 검색 결과"·조회수·댓글 수는 주제의 값이 아니다 (748-fix-2 fixture E) */
const SITE_CHROME = /검색\s*결과|조회수|댓글\s*\d|공감\s*\d|구독자|좋아요|팔로워/;
export interface PacketValueVerdict {
  ok: boolean;
  reason?: PacketValueReason;
  /** 의도 낱말 겹침 수 — 2 이상이면 판단 기준 후보 */
  intentHit: number;
  /** 문맥 문장에 값 자체가 있는가 */
  valueInContext: boolean;
  /** 다른 도시가 키워드 도시와 **함께** 있는가 (대구→경주 셔틀 같은 관계) */
  crossCity: boolean;
}
export interface PacketJudgeContext {
  intent: Set<string>;
  intentCities: string[];
  nowYear: number;
  asOf: RegExpMatchArray | null;
  todayMD: number | null;
}

export function buildJudgeContext(packet: any, ctx: CoreContext): PacketJudgeContext {
  // 의도 낱말에 소제목 낱말도 넣는다 — 글이 스스로 고른 주제어("주담대 월상환액", "변동금리")라 키워드 표기("주택담보대출")와 어긋나도 잡힌다
  const intent = new Set<string>([ctx.keyword, ctx.title, ctx.searchIntent || packet?.searchIntent || '', ...(ctx.questions || []), ...(packet?.readerQuestions || []), ...(ctx.h2Titles || [])].flatMap(toks));
  const asOf = String(packet?.currentAsOf || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  const nowYear = asOf ? Number(asOf[1]) : new Date().getFullYear();
  const todayMD = asOf ? Number(asOf[2]) * 100 + Number(asOf[3]) : null;
  // 키워드에 도시가 있으면 다른 도시의 값은 판단 기준이 아니다 (여행 경주 글에 "웨스틴조선 부산 예약률 90%" 가 끼던 것)
  const intentCities = citiesIn(norm(`${ctx.keyword} ${ctx.title}`));
  return { intent, intentCities, nowYear, asOf, todayMD };
}

export function judgePacketValue(kind: CoreValue['kind'], value: string, context: string, j: PacketJudgeContext): PacketValueVerdict {
  const c = String(context || ''); const v = String(value || '').trim();
  const cf = norm(c);
  const at = c.indexOf(v);
  const intentHit = overlap(cf, j.intent);
  const contextCities = citiesIn(cf);
  const otherCity = j.intentCities.length > 0 && contextCities.some((city) => !j.intentCities.includes(city));
  const sameCity = j.intentCities.some((city) => contextCities.includes(city));
  const crossCity = otherCity && sameCity;
  const base = { intentHit, valueInContext: at >= 0, crossCity };
  const no = (reason: PacketValueReason): PacketValueVerdict => ({ ok: false, reason, ...base });
  if (!v || NOISE_CONTEXT.test(c)) return no('ARTICLE_DATE');
  if (STALE_CONTEXT.test(c)) return no('STALE_YEAR');
  if (PAST_ROUND.test(c)) return no('PAST_ROUND');
  if ([...yearsIn(v), ...yearsIn(c)].some((y) => y < j.nowYear)) return no('STALE_YEAR');
  // 오늘 날짜 그 자체(기사·방송 날짜)는 판단 기준이 아니다
  if (j.asOf && norm(v).includes(`${j.nowYear}년${Number(j.asOf[2])}월${Number(j.asOf[3])}일`)) return no('ARTICLE_DATE');
  // 오늘보다 앞선 날짜(올해)는 이미 지난 일정이다 — 독자가 지금 쓸 판단 기준이 아니다 ("9월 11일 시간표 선공개", "7월 15일 동의 기한")
  if (j.todayMD !== null && (kind === 'date' || kind === 'fact') && !yearsIn(v).some((y) => y > j.nowYear)) {
    const all = [...v.matchAll(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/g)].map((m) => Number(m[1]) * 100 + Number(m[2]));
    // "10월 7일부터 16일까지" 처럼 끝이 일만 있으면 앞의 달을 쓴다
    const tail = v.match(/(?:~|부터|-)\s*(\d{1,2})\s*일/); if (tail && all.length === 1) all.push(Math.floor(all[0]! / 100) * 100 + Number(tail[1]));
    const last = all.length ? Math.max(...all) : null;   // 기간이면 끝 날짜, 하루면 그 날짜
    if (last !== null && last < j.todayMD) return no('PAST_DATE');
  }
  if (otherCity && !sameCity) return no('OTHER_CITY');
  // "138만5000명" 을 "5000명" 으로 쪼갠 값 — 앞 글자가 숫자·만·천·억이면 조각이다
  if (at > 0 && /[\d만천억,]/.test(c[at - 1] || '')) return no('SPLIT_NUMBER');
  // "10월 27일(월)" — 연도가 없는 일정은 요일로 해를 알 수 있다. 올해 그 날짜의 요일과 다르면 지난해 일정이다 (경주 APEC SOM 일정이 이 경우)
  if (weekdayMismatch(c, j.nowYear) || weekdayMismatch(v, j.nowYear)) return no('WEEKDAY_MISMATCH');
  if (at > 0 && c[at - 1] === '=') return no('DEFINITION');   // "(1bp=0.01%포인트)" 같은 정의는 판단 기준이 아니다
  if (SITE_CHROME.test(c)) return no('SITE_CHROME');
  if (intentHit < 2) return no('LOW_INTENT');   // 낱말 하나("경주"가 든 경주월드 73%)로는 판단 기준이 아니다 — 둘 이상 겹쳐야
  // 문맥 문장에 값 자체가 없으면(출처 요약만 붙은 값) 뜻을 알 수 없다 — 의도와 셋 이상 겹칠 때만 남긴다 (렌트·리스 블로그의 12월 2일 같은 것)
  if (at < 0 && intentHit < 3) return no('NO_VALUE_IN_CONTEXT');
  return { ok: true, ...base };
}

export function selectCoreValues(packet: any, ctx: CoreContext): CoreValue[] {
  const judge = buildJudgeContext(packet, ctx);
  const h2Tokens = (ctx.h2Titles || []).map((h) => new Set(toks(h)));
  const rows: CoreValue[] = [];
  const push = (kind: CoreValue['kind'], value: string, context: string, sourceIds: string[]) => {
    const c = String(context || ''); const v = String(value || '').trim();
    const verdict = judgePacketValue(kind, v, c, judge);
    if (!verdict.ok) return;
    const cf = norm(c);
    const intentHit = verdict.intentHit;
    const ranked = h2Tokens.map((set, i) => ({ i, hit: overlap(cf, set) })).filter((x) => x.hit > 0).sort((a, b) => b.hit - a.hit).map((x) => x.i);
    rows.push({ value: v, context: c.replace(/\s+/g, ' ').trim().slice(0, 90), kind, sourceIds: Array.isArray(sourceIds) ? sourceIds.slice(0, 3) : [], sectionIndex: ranked[0] ?? -1, score: intentHit * 2 + (ranked.length ? overlap(cf, h2Tokens[ranked[0]!]!) : 0), candidates: ranked } as CoreValue & { candidates: number[] });
  };
  for (const n of packet?.numbers || []) push('number', n.value, n.context, n.sourceIds);
  for (const d of packet?.dates || []) push('date', d.value, d.context, d.sourceIds);
  for (const c of packet?.conditions || []) push('condition', String(c.claim || '').slice(0, 60), c.claim, c.sourceIds);
  // 정리된 사실·기관 발표 가운데 값이 든 것 — 코드 추출 수치 목록이 놓친 범위값("4.02~6.37%")이 여기 있다
  const PREFER: Record<string, number> = { range: 0, percent: 1, amount: 2, date: 3, duration: 4, count: 5, rank: 6 };
  for (const f of [...(packet?.facts || []), ...(packet?.officialStatements || [])]) {
    const claim = String(f?.claim || '');
    const best = extractClaims(claim).sort((a, b) => (PREFER[a.kind] ?? 9) - (PREFER[b.kind] ?? 9))[0];   // "5대 은행 … 4.02~6.37%" 는 5대가 아니라 범위값이 대표
    if (best) push('fact', best.text, claim, f.sourceIds);
  }
  // 같은 값(정규화)은 하나만 · 점수 순 · 절당 상한 — 상한이 차면 버리지 않고 다음 후보 절이나 "도입·결론" 로 보낸다
  const seen = new Set<string>(); const perSection: Record<number, number> = {};
  const out: CoreValue[] = [];
  const sigs: string[] = [];   // 숫자만 남긴 서명 — "2026년 10월 6일~10월 15일" 과 "10월 6일부터 10월 15일", "2026년 10월" 은 같은 일정
  for (const r of rows.sort((a, b) => b.score - a.score)) {
    const k = norm(r.value); if (seen.has(k)) continue; seen.add(k);
    const sig = k.replace(/[^0-9]/g, '');
    if (sig.length >= 3 && sigs.some((s) => s.includes(sig) || sig.includes(s))) continue;
    if (sig.length >= 3) sigs.push(sig);
    const cands: number[] = (r as any).candidates || [];
    let home = -1;
    for (const i of cands) { if ((perSection[i] || 0) < MAX_PER_SECTION) { home = i; break; } }
    perSection[home] = (perSection[home] || 0) + 1;
    const { candidates: _c, ...rest } = r as any; void _c;
    out.push({ ...rest, sectionIndex: home });
    if (out.length >= MAX_CORE) break;
  }
  return out;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
/** "10월 27일(월)" 처럼 요일이 붙은 날짜가 올해 달력과 어긋나면 지난해 일정이다 */
export function weekdayMismatch(text: string, year: number): boolean {
  const re = /(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*\(\s*([일월화수목금토])\s*(?:요일)?\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(text || ''))) !== null) {
    const d = new Date(year, Number(m[1]) - 1, Number(m[2]));
    if (d.getMonth() !== Number(m[1]) - 1) continue;
    if (WEEKDAYS[d.getDay()] !== m[3]) return true;
  }
  return false;
}

/** Writer 프롬프트용 블록 — 짧다. 값이 없으면 빈 문자열(프롬프트에 아무것도 안 붙는다) */
export function renderCoreBlock(core: CoreValue[], h2Titles: string[]): string {
  if (!core.length) return '';
  const lines = core.map((c) => `- ${c.value} → ${c.sectionIndex >= 0 ? `${c.sectionIndex + 1}. ${h2Titles[c.sectionIndex]}` : '도입·결론·요약표'} · ${c.context}`);
  return [
    '',
    '🎯 [핵심 값 → 쓸 절] 아래 값은 검색 의도의 판단 기준입니다. Research Packet 의 나머지 값은 참고입니다.',
    ...lines,
    '규칙: ① 조언·판단("~하는 편이 좋습니다", "~를 따져야 합니다")을 쓸 때 그 판단을 뒷받침하는 값이 위에 있으면 **값 → 뜻 → 독자가 할 일** 순으로 붙입니다. 값 없는 일반론으로 문장을 끝내지 않습니다.',
    '② 각 값은 배정된 절에서 한 번 충분히 설명합니다. 다른 절에서는 새 뜻이 없는 한 같은 값을 되풀이하지 않습니다(요약표·결론은 예외).',
    '③ 정보형 절의 첫 1~2문장에 그 절이 답할 핵심(값·조건·행동)을 둡니다. "중요합니다 / 확인해야 합니다 / 상황에 따라 다릅니다" 로 절을 시작하지 않습니다.',
    '④ 위에 없는 값을 억지로 넣지 않습니다. 관련 없는 숫자를 채워 넣는 것은 금지입니다.',
  ].join('\n');
}

/**
 * 값 없는 규칙 한 토막 — 기본 경로. 값 배정 블록은 live 에서 다른 지역 숙소를 밀어 넣어(748b) 기본 OFF 로 두었다.
 * 짧게(≈420자): 조언엔 기준값, 정보형 절은 답 먼저, 같은 값은 한 절에서만.
 */
export function renderRulesOnly(): string {
  return [
    '',
    '🎯 [구체성] ① 조언·판단("~하는 편이 좋습니다", "~를 따져야 합니다")을 쓸 때 Research Packet 에 그 판단을 뒷받침하는 금액·기간·수량·조건이 있으면 **값 → 뜻 → 독자가 할 일** 순으로 붙입니다. 값 없는 일반론으로 문장을 끝내지 않습니다.',
    '② 정보형 절의 첫 1~2문장에 그 절이 답할 핵심(값·조건·행동)을 둡니다. "중요합니다 / 확인해야 합니다 / 상황에 따라 다릅니다" 로 절을 시작하지 않습니다.',
    '③ 같은 핵심 값은 그것을 맡은 절에서 한 번 충분히 설명하고, 다른 절에서는 새 뜻이 없는 한 되풀이하지 않습니다(요약표·결론은 예외). 패킷에 없는 값이나 다른 지역·다른 대상의 값은 넣지 않습니다.',
  ].join('\n');
}

/** 하네스·테스트용 — 본문이 CORE 값을 얼마나 썼는지 */
export function coreCoverage(core: CoreValue[], bodyText: string): { used: CoreValue[]; missing: CoreValue[] } {
  const f = norm(String(bodyText || '')).replace(/퍼센트/g, '%');
  const used: CoreValue[] = []; const missing: CoreValue[] = [];
  for (const c of core) (f.includes(norm(c.value).replace(/퍼센트/g, '%')) ? used : missing).push(c);
  return { used, missing };
}
