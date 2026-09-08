/**
 * agency-registry — **기관 이름을 실제 호스트로 바꾸는 사전. 쓰면서 자란다.** (v3.8.706)
 *
 * ## 왜 (2026-09-07 실측, 서로 다른 주제 15개)
 * AI(smart-cta)는 이름을 제대로 정했다 — 정부24 · 동물보호관리시스템 · 아이사랑 · 비짓제주.
 * 그런데 그 이름을 **도메인으로 바꾸는 길이 카탈로그(198곳) 하나뿐**이라 15곳 중 9곳이
 * 사전에 없었고, 그 결과는 이랬다:
 *   · 정부24 라고 정해 놓고 → 금천구청 페이지        (후보가 그 기관 호스트인지 아무도 안 봤다)
 *   · 동물보호관리시스템 → 부산시청 페이지
 *   · 비짓제주(visitjeju.net) → 전부 unknown-host 로 제외 (.go.kr 이 아니라서)
 * 사장님: "이러한 시드가 방대해야 되지 않니?"
 *
 * ## 원칙
 *   · 주소를 사람이 치지 않는다. 시드(agency-seed.ts)도 **이름 목록을 실측**해서 만든 것이다.
 *   · 여기서 모르는 이름은 **검색 → 홈을 열어 이름 확인 → 저장** 으로 배운다. 다음 글부터 검색이 없다.
 *   · AI 를 부르지 않는다. 비용 0원, 결과가 같아 테스트가 된다.
 *   · 실패해도 발행을 막지 않는다 — null 을 돌려주고 호출자가 예전 경로로 간다.
 *
 * ## 자라는 파일
 *   Electron 이면 userData/cta-agency-registry.json, 아니면 ~/.blogger-gpt/ 아래.
 *   (engine-stats.ts 와 같은 규칙) 테스트는 configureAgencyRegistry({ storePath }) 로 tmp 를 쓴다.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AGENCY_SEED } from './agency-seed';
import { resolveOfficialUrlByName } from './name-to-url';
import { judgeCtaHost, isInstitutionalHost, sameSite, apexHost } from './host-trust';
import type { PageFetcher } from './action-link-harness';

export interface AgencyEntry {
  /** AI·본문이 부르는 이름 그대로 (예: "경찰청교통민원24(이파인)") */
  name: string;
  /** www. 를 뗀 호스트 (예: "efine.go.kr") */
  host: string;
  /** 확인한 홈 주소 */
  url: string;
  source: 'seed' | 'learned' | 'catalog';
  verifiedAt: string;
}

export type AgencySearcher = (query: string) => Promise<Array<{ url: string; title: string }>>;

/* ───────────────────────────── 이름 다루기 ───────────────────────────── */

/** 이름 자체는 아닌데 기관 이름에 자주 붙는 말 — 이것만으로 "이름이 있다"고 하지 않는다 */
const GENERIC_NAME_PARTS = new Set([
  '홈페이지', '포털', '시스템', '센터', '공식', '대한민국', '한국', '서비스', '종합', '온라인',
  '사이트', '누리집', '지원', '통합', '정보', '안내', '국가', '전국', '민원', '고객',
]);

/** 공백·괄호·중점을 지우고 소문자로 — 비교는 늘 이 꼴로 한다 */
export function normalizeAgencyName(value: string): string {
  return String(value || '')
    .replace(/[\s()（）\[\]·・,\/'"‘’“”]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * 이름을 조각으로 나눈다 — "경찰청교통민원24(이파인)" → ["경찰청교통민원24", "이파인"].
 * 검색 결과 제목이 "이파인 - 경찰청교통민원24" 처럼 순서를 바꿔 적어도 맞추기 위해서다.
 * 총칭어(홈페이지·포털…)와 두 글자 이하는 조각으로 치지 않는다 — 아무 데나 걸린다.
 */
export function agencyNameParts(name: string): string[] {
  const parts = String(name || '')
    .split(/[\s()（）\[\]·・,\/]+/)
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length >= 3 && !GENERIC_NAME_PARTS.has(p));
  const whole = normalizeAgencyName(name);
  return Array.from(new Set([whole, ...parts].filter((p) => p.length >= 2)));
}

/**
 * 글자 덩어리(제목·본문) 안에 이 기관 이름이 보이는가.
 * 앞뒤에 붙은 글자는 따지지 않는다 — "대검찰청"·"한국도로교통공단"·"TS한국교통안전공단"은 검찰청·도로교통공단·한국교통안전공단의 집이다.
 * (앞 글자 경계를 세웠다가 이 넷을 전부 놓친 실측. 남의 이름 속에 든 경우는 호스트로 턴다 — NOT_THE_AGENCY_HOST 의 국회 상임위)
 */
export function agencyNameAppears(text: string, name: string): boolean {
  const hay = normalizeAgencyName(text);
  if (!hay) return false;
  return agencyNameParts(name).some((part) => hay.includes(part));
}

/** 두 이름이 같은 기관을 가리키는가 — 한쪽이 다른 쪽을 품으면 인정 (3글자 이상일 때만) */
function namesMatch(a: string, b: string): boolean {
  const left = normalizeAgencyName(a);
  const right = normalizeAgencyName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length < 3 || right.length < 3) return false;
  return left.includes(right) || right.includes(left);
}

/* ───────────────────────────── 저장 ───────────────────────────── */

let storePathOverride: string | null = null;
let learned: AgencyEntry[] | null = null;

/** 테스트·도구용 — 저장 위치를 바꾸고 메모리를 비운다 */
export function configureAgencyRegistry(options: { storePath?: string | null }): void {
  storePathOverride = options.storePath ?? null;
  learned = null;
  MISS_CACHE.clear();
}

function getStorePath(): string {
  if (storePathOverride) return storePathOverride;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require('electron');
    if (electron?.app?.getPath) return path.join(electron.app.getPath('userData'), 'cta-agency-registry.json');
  } catch { /* Electron 밖(테스트·스크립트) */ }
  return path.join(os.homedir(), '.blogger-gpt', 'cta-agency-registry.json');
}

function loadLearned(): AgencyEntry[] {
  if (learned) return learned;
  let loaded: AgencyEntry[] = [];
  try {
    const raw = fs.readFileSync(getStorePath(), 'utf-8');
    const parsed = JSON.parse(raw);
    loaded = Array.isArray(parsed?.entries)
      ? parsed.entries.filter((e: any) => e && typeof e.name === 'string' && typeof e.host === 'string')
      : [];
  } catch {
    loaded = [];
  }
  learned = loaded;
  return loaded;
}

function saveLearned(entries: AgencyEntry[]): void {
  const target = getStorePath();
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify({ version: 1, entries }, null, 2), 'utf-8');
  } catch (e) {
    // 저장 실패는 기능 실패가 아니다 — 이번 발행은 메모리 값으로 간다
    console.warn('[AGENCY-REGISTRY] ⚠️ 학습 파일 저장 실패:', (e as Error)?.message);
  }
}

/** 새로 알게 된 기관을 적는다. 같은 이름이 있으면 새 값으로 바꾼다(주소는 낡는다). */
export function learnAgency(entry: Omit<AgencyEntry, 'source' | 'verifiedAt'> & Partial<Pick<AgencyEntry, 'verifiedAt'>>): AgencyEntry {
  const next: AgencyEntry = {
    name: String(entry.name || '').trim(),
    host: normalizeHost(entry.host),
    url: String(entry.url || `https://${normalizeHost(entry.host)}/`),
    source: 'learned',
    verifiedAt: entry.verifiedAt || new Date().toISOString(),
  };
  const key = normalizeAgencyName(next.name);
  const rest = loadLearned().filter((e) => normalizeAgencyName(e.name) !== key);
  const nextList = [...rest, next];
  learned = nextList;
  saveLearned(nextList);
  MISS_CACHE.delete(key);
  return next;
}

/** 지금까지 배운 것 — 화면·측정용 */
export function listLearnedAgencies(): AgencyEntry[] {
  return [...loadLearned()];
}

/* ───────────────────────────── 조회 ───────────────────────────── */

export function normalizeHost(host: string): string {
  return String(host || '').toLowerCase().replace(/^www\./, '').replace(/\/.*$/, '').trim();
}

function hostOfUrl(url: string): string {
  try { return normalizeHost(new URL(url).hostname); } catch { return ''; }
}

/** 이 주소가 그 호스트와 같은 집(등기 도메인)인가 — fine.fss.or.kr 도 www.fss.or.kr 도 fss.or.kr 이다 */
export function isOnHost(url: string, host: string): boolean {
  const h = hostOfUrl(url);
  const target = normalizeHost(host);
  if (!h || !target) return false;
  return sameSite(h, target);
}

function findIn(entries: ReadonlyArray<{ name: string }>, name: string): number {
  const key = normalizeAgencyName(name);
  const exact = entries.findIndex((e) => normalizeAgencyName(e.name) === key);
  if (exact >= 0) return exact;
  return entries.findIndex((e) => namesMatch(e.name, name));
}

/**
 * 이름으로 호스트를 찾는다 — 학습분 → 시드 → 카탈로그 순. 없으면 null (지어내지 않는다).
 * 네트워크를 쓰지 않는다.
 */
export function lookupAgency(name: string): AgencyEntry | null {
  const query = String(name || '').trim();
  if (query.length < 2) return null;

  const learnedList = loadLearned();
  const li = findIn(learnedList, query);
  if (li >= 0) return learnedList[li]!;

  const si = findIn(AGENCY_SEED, query);
  if (si >= 0) {
    const s = AGENCY_SEED[si]!;
    return { name: s.name, host: normalizeHost(s.host), url: s.url, source: 'seed', verifiedAt: s.verifiedAt };
  }

  const catalog = resolveOfficialUrlByName(query);
  if (catalog) {
    const host = hostOfUrl(catalog.url);
    if (host) return { name: catalog.name, host, url: catalog.url, source: 'catalog', verifiedAt: '' };
  }
  return null;
}

/** 사전 크기 — 얼마나 넓은지 재는 용도 */
export function agencyRegistrySize(): { seed: number; learned: number } {
  return { seed: AGENCY_SEED.length, learned: loadLearned().length };
}

/* ───────────────────────────── 실측 해석 ───────────────────────────── */

/** 같은 이름을 한 시간 안에 다시 검색하지 않는다 — 못 찾은 것도 기억한다 */
const MISS_CACHE = new Map<string, number>();
const MISS_TTL_MS = 60 * 60 * 1000;

/**
 * @param hinted     "X 홈페이지 바로가기 (url)" 중계 글 몇 건이 이 호스트를 적었는가 — 중계 글은 제목에 진짜 주소를 적어 준다
 * @param homes      열어서 확인할 홈 후보들. 한 등기 도메인에 홈이 여럿이면(park.airport.co.kr · www.airport.co.kr) 차례로 열어
 *                   **이름이 보이는 홈**을 고른다. 순서는 rank(검색 제목이 이름 그 자체 2 · 첫 마디가 이름 1 · 홈 모양만 0) →
 *                   뿌리에 가까운 주소(www·등기 도메인 뿌리) → 검색 순위.
 */
interface HomeCandidate { url: string; rank: number; depth: number; idx: number }
/** hits 는 이 집으로 센 결과 수(중계 글 표는 빼고) · nameRun 은 어느 제목이든 이름과 네 글자 이상 이어 겹친 적이 있는가 — 과반 규칙 ⑤가 본다 */
interface HostTally { host: string; titleHits: number; hinted: number; score: number; homes: HomeCandidate[]; exactTitle: boolean; hits: number; nameRun: boolean }
const EMPTY_TALLY = (host: string): HostTally => ({ host, titleHits: 0, hinted: 0, score: 0, homes: [], exactTitle: false, hits: 0, nameRun: false });

/**
 * 제목과 이름이 **네 글자 이상 이어서** 겹치는가 — "국가동물보호정보시스템" ↔ "동물보호관리시스템"은 "동물보호"가 겹치고,
 * "불법금융신고센터" ↔ "금융민원센터"는 "금융"·"센터" 두 글자씩뿐이라 남이다. 이름이 바뀐 서비스를 알아보는 최소한의 실마리다.
 */
function sharesNameRun(title: string, name: string, min = 4): boolean {
  const a = normalizeAgencyName(title);
  const b = normalizeAgencyName(name);
  if (a.length < min || b.length < min) return false;
  for (let i = 0; i + min <= b.length; i += 1) {
    if (a.includes(b.slice(i, i + min))) return true;
  }
  return false;
}

/** 뿌리에 가까울수록 작다 — www.airport.co.kr/ (0) < park.airport.co.kr/ (10) < gyeonggi.work.go.kr/icheon/main.do (12) */
function homeDepth(url: string): number {
  try {
    const u = new URL(url);
    const full = normalizeHost(u.hostname);
    const apex = apexHost(url);
    const rootHost = full === apex || full === `www.${apex}`;
    return (rootHost ? 0 : 10) + u.pathname.split('/').filter(Boolean).length;
  } catch {
    return 99;
  }
}

/** 사이트 자체의 뿌리인가 — "/" 또는 "/main.do" 하나. "/icheon/main.do"(이천일자리센터)는 그 사이트 안의 하위 사이트다 */
function isSiteRoot(url: string): boolean {
  try {
    const segs = new URL(url).pathname.split('/').filter(Boolean);
    return segs.length === 0 || (segs.length === 1 && /^(?:index|main|home|intro)(?:\.\w+)?$/i.test(segs[0]!));
  } catch {
    return false;
  }
}

function orderHomes(homes: HomeCandidate[]): HomeCandidate[] {
  return [...homes].sort((a, b) => b.rank - a.rank || a.depth - b.depth || a.idx - b.idx);
}

/**
 * "X 홈페이지 바로가기 (https://…)" 류 중계 블로그 — 제목에 기관 이름을 그대로 달아서 제목 일치로는 못 가른다.
 * 실측: 크레딧포유 → info.primeage.co.kr, 경찰민원포털 → infocodak.com, 씨리얼 → url.infoflex.net.
 * 제목에 다른 주소를 적었거나 "바로가기·접속하기"를 달았거나, 경로가 한글을 %-인코딩한 글 주소면 그 기관의 집이 아니다.
 */
function looksLikeRelayPage(url: string, title: string): boolean {
  if (/바로가기|바로 가기|접속하기|접속 방법|사이트 및|안내-/.test(title)) return true;
  if (/https?:\/\/|www\./i.test(title)) return true;
  try {
    const { pathname } = new URL(url);
    if (/%[0-9a-f]{2}%[0-9a-f]{2}%[0-9a-f]{2}/i.test(pathname)) return true;
  } catch { /* 주소가 이상하면 아래 규칙으로 */ }
  return false;
}

/**
 * 기관 홈으로 볼 주소 — 게이트의 looksLikeHomeUrl 보다 한 가지 넓고 두 가지 좁다.
 *   넓게: /www/main.do·/kor/index.jsp 처럼 "마디 하나 + 진입 파일"도 홈이다 (외교부 mofa.go.kr/www/main.do 실측)
 *   좁게: 쿼리가 붙은 주소(?p=397)는 글이고, /162 처럼 숫자 한 마디는 블로그 글 번호다
 */
function looksLikeAgencyHome(url: string): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (u.search) return false;
  const segs = u.pathname.split('/').filter(Boolean);
  if (segs.length === 0) return true;
  const entry = /^(?:index|main|home|intro)(?:\.\w+)?$/i.test(segs[segs.length - 1]!);
  if (segs.length === 1) return entry || /^[a-z][a-z0-9_-]{1,15}$/i.test(segs[0]!);
  return segs.length === 2 && entry;
}

/** 제목에 적힌 주소들의 호스트 — "크레딧포유 홈페이지 바로가기 www.credit4u.or.kr" 에서 credit4u.or.kr */
function hostsNamedIn(title: string): string[] {
  const found = new Set<string>();
  const re = /(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,6})(?::\d+)?(?=[\/\s)\]|,]|$)/gi;
  for (const m of title.matchAll(re)) {
    const host = normalizeHost(String(m[1] || ''));
    if (host && host.includes('.') && !NOT_THE_AGENCY_HOST.test(host)) found.add(host);
  }
  return [...found];
}

/**
 * 검색 결과 제목이 기관 이름 **그 자체**인가 ("SRT" | etk.srail.kr) — 그 기관의 홈일 확률이 매우 높다.
 * 등급으로 돌려준다: 이름 전체와 같음 3 · 이름의 한 조각·꼬리말 뗀 꼴·"청" 꼴 2 · 아님 0.
 * 전체 일치가 조각 일치보다 앞선다 — "국토교통부 실거래가공개시스템" | rt.molit.go.kr(3)이 "국토교통부" | www.molit.go.kr(2, 조각)을 이긴다.
 */
function titleExactGrade(title: string, name: string): 0 | 2 | 3 {
  const t = normalizeAgencyName(title.replace(/\s*[-|–—:]\s*(홈페이지|공식|메인|home|main)\s*$/i, ''));
  const n = normalizeAgencyName(name);
  if (!t || !n) return 0;
  if (t === n) return 3;
  if (agencyNameParts(name).some((p) => p.length >= 3 && t === p)) return 2;
  // 기관 꼬리말을 뗀 이름과 같은 제목 — "국민건강보험" | nhis.or.kr 은 국민건강보험공단의 홈이다 (실측: 홈 제목에 "공단"이 없다)
  const bare = n.replace(/(공단|공사|위원회|진흥원|재단|협회|본부|사업단|공제회)$/, '');
  if (bare.length >= 4 && bare !== n && t === bare) return 2;
  // 지자체는 홈 제목이 "청"으로 끝난다 — "강원특별자치도청" | state.gwd.go.kr 은 강원특별자치도의 집이다.
  // (교육청·의회는 다른 기관이라 받지 않는다 — 실측: 강원특별자치도교육청 화면 다섯이 도청을 점수로 이겼다)
  return n.length >= 3 && /^(청|시청|군청|구청|도청)$/.test(t.slice(n.length)) && t.startsWith(n) ? 2 : 0;
}

function titleIsExactlyName(title: string, name: string): boolean {
  return titleExactGrade(title, name) > 0;
}

/** 제목의 첫 마디가 이름 그 자체인가 — "고용보험 - 고용24" | ei.work24.go.kr 은 고용보험의 집이다 (뒤 마디는 사이트 이름) */
function titleLeadSegmentIsName(title: string, name: string): boolean {
  const lead = String(title || '').split(/\s+[-|–—:]\s+|\s*\|\s*/)[0] || '';
  return lead !== title.trim() && titleIsExactlyName(lead, name);
}

/**
 * 기관 이름을 제목에 달고 있지만 기관의 집이 아닌 것들 — 시드 생성에서 실제로 걸려 나온 유형.
 *   한국철도공사 → koraillabor.kr(노조) · 예금보험공사 → kdic.saramin.co.kr(채용관) · 씨리얼 → url.infoflex.net(단축 링크)
 * 이름이 들어간 제목만 믿으면 이런 곳이 1등이 된다. 제목의 낱말과 호스트로 턴다.
 */
const NOT_THE_AGENCY_TITLE = /노동조합|노조|채용|입사|인재채용|공고|뉴스|기사|보도|블로그|카페|위키|나무위키|백과|주가|종목|채용정보|기업정보/;
// 주의: 호스트 낱말은 좁게 — labor.moel.go.kr(노동포털)·jobaba.net(경기도 잡아바)은 진짜 기관이다
// *.na.go.kr 은 국회 상임위 페이지 — "과학기술정보방송통신위원회" 제목이 방송통신위원회로 잡혀 science.na.go.kr 을 배웠던 실측
const NOT_THE_AGENCY_HOST = /saramin|jobkorea|incruit|wanted\.|jobplanet|catch\.co|linkareer|namu\.wiki|wikipedia|infoflex|bit\.ly|alio\.go\.kr|cleaneye|\.na\.go\.kr$/i;
/** 기관이 채널을 여는 플랫폼 — 제목이 이름 그 자체여도 그 기관의 집이 아니다(국민건강보험공단 → tv.naver.com 실측) */
const PLATFORM_HOST = /(^|\.)(naver\.com|daum\.net|kakao\.com|kakaocdn\.net|youtube\.com|youtu\.be|facebook\.com|instagram\.com|twitter\.com|x\.com|tistory\.com|brunch\.co\.kr|linkedin\.com|medium\.com|threads\.net|google\.com)$/i;

/**
 * 검색 결과를 **등기 도메인(apex)** 별로 모아 점수를 매긴다.
 * 한 기관의 하위 도메인(license.korcham.net · cert.korcham.net · www.korcham.net)은 한 집이다 — 따로 세면 표가 흩어져
 * 셋 다 떨어지고 엉뚱한 곳(korchamhrd.net)이 남는다. 판정 쪽 비교도 어차피 apex 다(sameSite).
 */
function tallyHosts(name: string, results: Array<{ url: string; title: string }>): HostTally[] {
  const byHost = new Map<string, HostTally>();
  /** 두 번 검색("이름 홈페이지"·"이름")이 같은 주소를 돌려주면 한 번으로 센다 — 같은 화면이 두 표를 갖지 않게 */
  const seenUrls = new Set<string>();
  results.forEach((r, idx) => {
    // 검색이 세션이 붙은 주소(/web/index.do;jsessionid=…)를 주기도 한다 — 떼고 봐야 홈 모양이고, 적어도 그 꼴로 적는다
    const url = String(r?.url || '').replace(/;jsessionid=[^?#/]*/i, '');
    const title = String(r?.title || '');
    const fullHost = hostOfUrl(url);
    const host = apexHost(url);
    if (!fullHost || !host) return;
    const urlKey = url.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();
    if (seenUrls.has(urlKey)) return;
    seenUrls.add(urlKey);
    if (NOT_THE_AGENCY_HOST.test(fullHost) || PLATFORM_HOST.test(fullHost)) return;
    if (NOT_THE_AGENCY_TITLE.test(title.replace(/\s+/g, ''))) return;
    if (looksLikeRelayPage(url, title)) {
      /**
       * 중계 글은 버리지만, 제목에 적어 둔 **다른** 주소는 표로 받는다 — "크레딧포유 홈페이지 바로가기 www.credit4u.or.kr".
       * 기관 화면 제목("본인신용정보 열람서비스")에 이름이 없어 제목 일치로는 못 찾는 기관을 이 표가 찾는다.
       */
      if (!agencyNameAppears(title, name)) return;
      for (const hint of hostsNamedIn(title).map((h) => apexHost(h))) {
        if (!hint || hint === host || PLATFORM_HOST.test(hint)) continue;
        const prev = byHost.get(hint) || EMPTY_TALLY(hint);
        byHost.set(hint, { ...prev, hinted: prev.hinted + 1, score: prev.score + 2 + (isInstitutionalHost(`https://${hint}/`) ? 1 : 0) });
      }
      return;
    }
    /**
     * 블로그·중계·광고·쇼핑은 기관의 집이 아니다. unknown-host 는 여기서는 **버리지 않는다** —
     * 바로 그 낯선 도메인(visitjeju.net)을 찾아내는 게 이 함수의 일이다. 근거는 제목·홈 확인이 댄다.
     */
    const verdict = judgeCtaHost(url, name, [name], title);
    if (!verdict.ok && verdict.reason !== 'unknown-host') return;

    const titleHit = agencyNameAppears(title, name);
    /** 제목이 이름으로 **시작**하면 그 기관의 자기 화면일 확률이 훨씬 높다("정부24 | 홈" vs "정부24 이용 후기") */
    const titleLeads = titleHit && agencyNameAppears(title.slice(0, Math.max(name.length + 4, 12)), name);
    const home = looksLikeAgencyHome(url);
    const exactGrade = home ? titleExactGrade(title, name) : 0;
    const exact = exactGrade > 0;
    const bonus = (titleHit ? 2 : 0) + (titleLeads ? 1 : 0) + (exact ? 2 : 0) + (home ? 1 : 0) + (isInstitutionalHost(url) ? 1 : 0) + (10 - Math.min(idx, 9)) * 0.05;

    const prev = byHost.get(host) || EMPTY_TALLY(host);
    /**
     * 홈 후보의 등급: 제목이 이름 전체(3) > 이름의 한 조각(2, "국토교통부" ← 국토교통부 실거래가 공개시스템) > 제목 첫 마디가 이름("고용보험 - 고용24", 1) > 그냥 홈 모양(0).
     * "이름이 들어 있다"만으로는 올리지 않는다 — "대한상공회의소 원산지증명센터"(cert.korcham.net)가 코참넷 홈을 밀어내면 안 된다.
     * 등급이 같으면 뿌리에 가까운 홈이 먼저다 — park.airport.co.kr(주차)보다 www.airport.co.kr 이 한국공항공사의 집이다.
     * 전체 일치가 조각보다 높은 까닭: 뿌리 홈은 등급이 같거나 높을 때만 하위 홈을 이기는데, 국토교통부 뿌리(www.molit)가
     * "국토교통부 실거래가공개시스템"(rt.molit)을 조각 일치로 밀어내면 독자는 실거래가 화면 대신 부처 홈에 떨어진다.
     */
    const homeRank = home ? (exact ? exactGrade : titleLeadSegmentIsName(title, name) ? 1 : 0) : -1;
    byHost.set(host, {
      ...prev,
      titleHits: prev.titleHits + (titleHit || exact ? 1 : 0),
      score: prev.score + bonus,
      homes: home ? [...prev.homes, { url, rank: homeRank, depth: homeDepth(url), idx }] : prev.homes,
      exactTitle: prev.exactTitle || exact,
      hits: prev.hits + 1,
      nameRun: prev.nameRun || sharesNameRun(title, name),
    });
  });
  /**
   * 제목이 이름 그 자체인 홈("외교부" | mofa.go.kr/www/main.do)은 점수보다 앞선다 — 하위 서비스(여권안내) 화면이
   * 여럿 나와 점수를 쌓아도, 이름만 달고 있는 홈이 그 기관의 집이다. 확인은 어차피 홈을 열어서 한다.
   */
  return [...byHost.values()].sort((a, b) => Number(b.exactTitle) - Number(a.exactTitle) || b.score - a.score);
}

function titleOf(html: string): string {
  const m = String(html || '').match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i);
  return String(m?.[1] || '');
}

/**
 * 이름을 **실측으로** 호스트로 바꾼다. 사전에 있으면 그것을, 없으면 검색해서 확인하고 배운다.
 *
 * 어디에서도 못 찾으면 null — 호출자는 예전 경로(기관 기준 없이 판정)로 간다.
 * @param options.learn  false 면 저장하지 않는다(시드 생성 스크립트가 쓴다)
 * @param options.fresh  true 면 사전(학습·시드·카탈로그)과 실패 캐시를 건너뛰고 **검색으로만** 확인한다
 *                       — 시드 생성이 옛 시드나 손으로 적은 카탈로그를 베끼지 않게 한다
 */
export async function resolveAgencyHost(input: {
  name: string;
  search: AgencySearcher;
  fetchPage: PageFetcher;
  learn?: boolean;
  fresh?: boolean;
  onLog?: (message: string) => void;
}): Promise<AgencyEntry | null> {
  const name = String(input.name || '').trim();
  const say = (m: string) => input.onLog?.(m);
  if (name.length < 2 || name === '없음') return null;

  const key = normalizeAgencyName(name);
  if (!input.fresh) {
    const known = lookupAgency(name);
    if (known) return known;

    const missedAt = MISS_CACHE.get(key);
    if (missedAt && Date.now() - missedAt < MISS_TTL_MS) return null;
  }

  let results: Array<{ url: string; title: string }> = [];
  try {
    results = await input.search(`${name} 홈페이지`);
    if (results.length < 3) results = [...results, ...(await input.search(name))];
  } catch (e: any) {
    say(`기관 주소 검색 실패(${name}): ${String(e?.message || e).slice(0, 60)}`);
    return null;
  }

  const accept = (cand: HostTally, verdict: { url: string; note: string }): AgencyEntry => {
    const entry: AgencyEntry = {
      name,
      // 표는 apex 로 모았지만 기록은 실제로 열린 홈의 호스트다(m.nts.go.kr 처럼) — 비교는 어디서나 sameSite 라 어느 쪽이든 같다
      host: hostOfUrl(verdict.url) || cand.host,
      url: verdict.url,
      source: 'learned',
      verifiedAt: new Date().toISOString(),
    };
    say(`기관 주소 확인: ${name} → ${entry.host}${verdict.note ? ` (${verdict.note})` : ''}`);
    if (input.learn !== false) learnAgency(entry);
    return entry;
  };

  // 제목에 이름이 있는 호스트, 또는 중계 글 둘 이상이 적어 준 호스트만 후보다
  const tally = tallyHosts(name, results);
  const ranked = tally.filter((t) => t.titleHits > 0 || t.hinted >= 2);

  /**
   * 점수 1등부터 차례로 홈을 실제로 열어 확인한다 — 검색이 준 제목만 믿지 않는다.
   * 1등이 떨어지면 2·3등을 본다: 보도자료가 많은 금융위(fsc.go.kr)가 "어카운트인포" 검색을 점수로 이겼던 실측.
   */
  const rejected: string[] = [];
  for (const cand of ranked.slice(0, 3)) {
    const verdict = await verifyAgencyHome(name, cand, input.fetchPage);
    if (verdict.ok) return accept(cand, verdict);
    rejected.push(`${cand.host}(${verdict.why})`);
  }

  /** ⑤ 후보가 없거나 다 떨어졌으면 — 이름이 바뀐 서비스인지 마지막으로 본다 */
  const dominant = await resolveByDominance(name, tally, input.fetchPage);
  if (dominant) return accept(dominant.cand, dominant);

  say(rejected.length ? `기관 주소 미확인: ${name} — ${rejected.join(' · ')}` : `기관 주소를 못 찾음: ${name} — 제목에 이름이 있는 결과가 없다`);
  MISS_CACHE.set(key, Date.now());
  return null;
}

/**
 * ⑤ 이름이 바뀐 서비스 — 검색이 한 집을 **과반**으로 가리키는데 그 집 제목 어디에도 이 이름이 없다.
 * "동물보호관리시스템"을 찾으면 결과 9건 중 7건이 animal.go.kr 인데 제목은 전부 "국가동물보호정보시스템"(개명)이라
 * 제목 일치 규칙으로는 못 찾고 독자를 부산시 반려동물 안내로 보냈던 실측.
 * 받는 조건은 넷 다:
 *   · 그 집이 센 결과의 과반이고 4건 이상 — 두세 건은 우연이다
 *   · 이름이 그 집 제목에 한 번도 없다 — 있었으면 위 규칙이 이미 열어 보고 거른 후보다(보도자료 많은 금융위를 어카운트인포로 되살리지 않게)
 *   · 어느 제목이든 이름과 네 글자 이상 이어 겹친다("동물보호") — 금감원 신고센터 글이 "금융민원센터" 검색을 과반으로 채워도 남이다
 *   · 검색 결과에 사이트 뿌리 홈이 있고 실제로 열리며, 기관 도메인이거나 본문에 이름이 있다
 * 기관 이름을 코드에 적지 않는다 — 어느 개명이든 같은 잣대다.
 */
async function resolveByDominance(
  name: string,
  tally: HostTally[],
  fetchPage: PageFetcher,
): Promise<{ cand: HostTally; url: string; note: string } | null> {
  const total = tally.reduce((sum, t) => sum + t.hits, 0);
  const top = [...tally].sort((a, b) => b.hits - a.hits)[0];
  if (!top || top.hits < 4 || top.hits * 2 < total) return null;
  if (top.titleHits > 0 || !top.nameRun) return null;
  const root = orderHomes(top.homes).find((h) => h.depth === 0 && isSiteRoot(h.url));
  if (!root) return null;
  const page = await openHome(name, root.url, fetchPage);
  if (!page || !(isInstitutionalHost(root.url) || page.nameInBody)) return null;
  return { cand: top, url: recordUrl(page), note: `검색 결과 과반(${top.hits}/${total}건)이 가리킴 — 이름이 바뀐 서비스로 봄` };
}

/**
 * 후보 호스트의 홈을 열어 이 기관의 집인지 본다.
 *
 * 본문 어딘가에 이름이 있는 것만으로는 부족하다 — 노조·채용관·협력사 홈도 그 기관 이름을 본문에 적는다.
 * 기관 도메인도 예외가 아니다: 금융위 홈 새소식에 "어카운트인포"가 있어 어카운트인포 → fsc.go.kr 로 배웠던 실측.
 *   받는 경우 ① 홈 <title> 에 이름  ② 본문 언급 + 제목 일치 2건 이상
 *            ③ 홈은 열리는데 이름이 안 보여도(JS 로 그리는 비짓제주 등) 검색 결과에 **사이트 뿌리 홈 주소가 실제로 있고** 제목 일치 2건 이상
 *   ③에서 "뿌리 홈 주소가 실제로 있고"가 중요하다 — 보도자료 깊은 페이지만 두 건인 호스트, 하위 사이트(gyeonggi.work.go.kr/icheon/)만
 *   나온 호스트는 그 기관의 집이 아니다.
 *            ④ 중계 글("X 홈페이지 바로가기 url") 둘 이상이 같은 주소를 적었고 그 홈이 열린다 — 이름은 검색 제목에서 이미 확인됐다
 * 한 등기 도메인에 홈이 여럿이면 차례로 열어 **이름이 보이는 홈**을 받는다 — 나라장터 검색에 "나라장터" | bddm.g2b.go.kr(제목 빈 화면)과
 * "나라장터 국가종합전자조달" | www.g2b.go.kr 이 같이 나왔고, 열어 보면 이름이 있는 쪽은 www 다.
 * 못 찾음(null)이 오답보다 낫다 — null 이면 옛 경로(기관 기준 없이 판정)로 가고, 오답이면 preferredHost 가 엉뚱한 곳을 가리킨다.
 */
const HOMES_TO_OPEN = 3;

interface OpenedHome { url: string; finalUrl: string; nameInTitle: boolean; nameInBody: boolean }

async function openHome(name: string, homeUrl: string, fetchPage: PageFetcher): Promise<OpenedHome | null> {
  try {
    const page = await fetchPage(homeUrl);
    if (!page?.ok || !page.html) return null;
    const homeTitle = titleOf(page.html);
    const text = `${homeTitle} ${page.html.slice(0, 60_000).replace(/<[^>]+>/g, ' ')}`;
    return {
      url: homeUrl,
      finalUrl: String(page.finalUrl || homeUrl),
      nameInTitle: agencyNameAppears(homeTitle, name),
      nameInBody: agencyNameAppears(text, name),
    };
  } catch {
    return null;   // 열지 못한 것은 아래 규칙으로
  }
}

async function verifyAgencyHome(
  name: string,
  cand: HostTally,
  fetchPage: PageFetcher,
): Promise<{ ok: true; url: string; note: string } | { ok: false; why: string }> {
  const homes: HomeCandidate[] = cand.homes.length
    ? orderHomes(cand.homes).slice(0, HOMES_TO_OPEN)
    : [{ url: `https://${cand.host}/`, rank: 0, depth: 0, idx: 0 }];
  const opened: Array<OpenedHome & HomeCandidate> = [];
  for (const home of homes) {
    const page = await openHome(name, home.url, fetchPage);
    if (!page) continue;
    opened.push({ ...page, ...home });
    if (page.nameInTitle && home.depth === 0) break;   // 뿌리 홈에 이름이 있다 — 더 볼 것이 없다
  }

  /**
   * 열리지 않는 홈은 어떤 규칙으로도 받지 않는다 — 독자를 죽은 주소로 보낸다.
   * 강원특별자치도 → office365.gwe.go.kr(교육청 내부 시스템, fetch failed)을 제목 일치 규칙으로 받았던 실측.
   */
  const first = opened[0];
  if (!first) return { ok: false, why: '홈이 열리지 않음' };

  const verified = opened
    .filter((h) => h.nameInTitle || (h.nameInBody && cand.titleHits >= 2))
    .sort((a, b) => Number(b.nameInTitle) - Number(a.nameInTitle) || b.rank - a.rank || a.depth - b.depth);
  const best = verified[0];
  /** 등기 도메인 뿌리(www·apex)의 사이트 뿌리 홈이 열렸는가 — 제목이 EUC-KR 로 깨지거나(www.khug.or.kr) JS 로 그려 비어도(www.koreapost.go.kr) "열린 뿌리"다 */
  const rootOpened = opened.find((h) => h.depth === 0 && isSiteRoot(h.url));
  /**
   * 뿌리 홈이 검색 결과에 있는데 열리지 않았으면, 이름만 달린 하위 홈으로 대신하지 않는다 — 한국장애인고용공단은 www.kead.or.kr 이
   * (Node 에서) 안 열려 "한국장애인고용공단 고용개발원" | edi.kead.or.kr 을 배웠던 실측. 시드에 한 번 적히면 앱은 다시 풀지 않으니
   * null 로 두고 앱이 크로미움으로 뿌리를 여는 편이 낫다. 제목이 이름 그 자체인 하위 홈(등급 3, "SRT" | etk.srail.kr)은 그대로 받는다.
   */
  const rootListed = homes.some((h) => h.depth === 0 && isSiteRoot(h.url));
  if (best && rootListed && !rootOpened && best.rank < 3) return { ok: false, why: '뿌리 홈이 열리지 않아 하위 홈으로 대신하지 않음' };
  if (best) {
    /**
     * 이름은 하위 도메인이 확인해 줬어도 독자는 뿌리로 보낸다 — cert.korcham.net(원산지증명센터)·jodal.koreapost.go.kr(조달센터)·
     * onestop.khug.or.kr(모바일HUG)이 이름을 보여줬지만 집은 www 다. 단, 검색 제목이 이름을 앞세운 홈(ei.work24.go.kr "고용보험 - 고용24",
     * 등급 1)이 뿌리(www.work24.go.kr "고용24", 등급 0)보다 등급이 높으면 그 홈이 집이다.
     */
    const pick = rootOpened && rootOpened.rank >= best.rank ? rootOpened : best;
    return { ok: true, url: recordUrl(pick), note: '' };
  }

  /** 검색 제목이 이름 그 자체인 홈 주소("SRT" | etk.srail.kr) — 홈 <title> 이 "승차권 예약/발매 - 국민철도 SR" 이어도 받는다 */
  if (cand.exactTitle && cand.homes.length > 0) return { ok: true, url: recordUrl(first), note: '제목 일치로 인정' };
  /** 어느 홈에도 이름이 없어도(JS 로 그리는 비짓제주·전자소송포털) **사이트 뿌리** 홈이 열렸고 제목 일치 2건이면 받는다 */
  const siteRootOpened = cand.homes.length > 0 ? opened.find((h) => isSiteRoot(h.url)) : undefined;
  if (siteRootOpened && cand.titleHits >= 2) return { ok: true, url: recordUrl(siteRootOpened), note: '제목 일치로 인정' };
  /** ④ 중계 글 둘 이상이 이 주소를 적었고 홈이 실제로 열린다 — 기관 화면 제목엔 이름이 없는 크레딧포유(credit4u.or.kr) 실측 */
  if (cand.hinted >= 2) return { ok: true, url: recordUrl(first), note: `중계 글 ${cand.hinted}건이 가리킴` };
  if (cand.titleHits < 2) return { ok: false, why: `홈에 이름이 없고 제목 일치 ${cand.titleHits}건` };
  return { ok: false, why: '홈에 이름이 없고 검색 결과에 뿌리 홈 주소도 없음' };
}

/**
 * 적어 둘 주소 — 열린 뒤 주소가 같은 집 안에서만 움직였으면 검색이 준 깨끗한 주소를 적는다.
 * 최종 주소엔 세션 토큰이 붙는다(www.g2b.go.kr/?bodyDataKey=…&key=…, ;jsessionid=…) — 다음 독자에게는 낡은 표다.
 * 다른 집으로 옮겨 갔으면(이전한 기관) 옮겨 간 주소를 적는다.
 */
function recordUrl(home: OpenedHome): string {
  const strip = (u: string) => u.replace(/;jsessionid=[^?#/]*/i, '');
  return strip(sameSite(home.url, home.finalUrl) ? home.url : home.finalUrl);
}
