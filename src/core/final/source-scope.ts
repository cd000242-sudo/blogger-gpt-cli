/**
 * source-scope — 공고형 글의 **출처 범위**를 먼저 정하고, 그 범위 밖 자료는 근거에서 뺀다. (v3.8.730)
 *
 * ## 사장님 실측 (leadernam 발행글 「인천·부천 든든전세 4차 모집」, 2026-09-14)
 * LH 공고를 써야 하는데 본문에 **LH 가 0번**, 대신 HUG 안심전세포털·네이버 부동산 매물 시세·거주 후기·국회 회의 자료가
 * 근거가 됐다. 공고일·모집일정·공급호수·자격은 아예 없었다.
 * 사장님이 받은 진단이 맞았다: "크롤링 20% + 소스 선별/팩트체크 로직 80%".
 *
 * ## 왜 섞였나
 * "든든전세"는 LH 도 HUG 도 같은 이름으로 운영한다. 검색 결과는 키워드 일치로만 모이고,
 * 자료 수집 단계는 **주관기관이 누구인지 한 번도 묻지 않았다.** 요청사항 칸에 "LH 공고 기준"이라 적어도
 * 그 글은 글쓰기 프롬프트에만 붙고(user-request.ts) 수집 단계는 보지 않았다.
 *
 * ## 무엇을 하나 (AI 호출 0회 · 네트워크 0회)
 *   ① 키워드·요청사항·직접 넣은 URL 에서 주관기관을 찾는다. 검색 순위로는 절대 정하지 않는다.
 *   ② 정해지면 다른 기관의 같은 이름 제도·다른 회차·다른 지역 자료를 근거에서 뺀다.
 *   ③ 프롬프트에 "공식 공고 → 같은 기관 설명 → 언론" 순의 출처 계층 지시를 싣는다.
 * 기관을 못 정하면 아무것도 하지 않는다 — 예전과 똑같이 동작한다.
 */
export interface SourceCandidate { url?: string; title?: string; content?: string }
export interface SourceScope {
  agency: string;
  domain: string;
  topic: string;
  round?: string;
  year?: string;
  regions: string[];
}

/**
 * 주관기관 사전 — 이름과 **확인된** 공식 도메인만. 확실하지 않은 기관은 넣지 않는다(틀린 도메인은 멀쩡한 근거를 버린다).
 *   LH 한국토지주택공사 lh.or.kr · HUG 주택도시보증공사 khug.or.kr · SH 서울주택도시공사 i-sh.co.kr
 *   GH 경기주택도시공사 gh.or.kr · iH 인천도시공사 ih.co.kr
 */
const AGENCIES = [
  { agency: 'LH', domain: 'lh.or.kr', name: /(?:\bLH\b|한국토지주택공사|토지주택공사)/i },
  { agency: 'HUG', domain: 'khug.or.kr', name: /(?:\bHUG\b|주택도시보증공사)/i },
  { agency: 'SH', domain: 'i-sh.co.kr', name: /(?:\bSH\b|서울주택도시공사)/i },
  { agency: 'GH', domain: 'gh.or.kr', name: /(?:\bGH\b|경기주택도시공사)/i },
  { agency: 'iH', domain: 'ih.co.kr', name: /(?:\biH\b|인천도시공사)/ },
];
const REGIONS = ['서울', '인천', '부천', '부산', '대구', '대전', '광주', '울산', '세종', '수원', '성남', '고양', '용인', '제주', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남'];
const HOUSING_WORDS = /전세|임대|모집|공고|주택|입주|청약|분양/;
const SUBJECTS = ['든든전세', '매입임대', '전세임대', '행복주택', '국민임대', '공공임대', '영구임대', '신혼희망타운', '청년주택'];

const plain = (s: unknown) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const host = (url: string) => { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } };
const within = (url: string, domain: string) => host(url) === domain || host(url).endsWith(`.${domain}`);
export const isScopedOfficialSource = (url: string, scope: SourceScope) => within(url, scope.domain);
const roundOf = (text: string) => text.match(/(?:제\s*)?(\d+)\s*차(?:\b|[^0-9]|$)/)?.[1];

/**
 * 출처 범위를 정한다. 없으면 undefined — 그러면 아무것도 걸러지지 않는다.
 *
 * @param topic 키워드(제목). 범위의 이름표가 된다.
 * @param inputSources 사장님이 직접 넣은 URL 들(원본 URL 칸·리포트 슬롯). 기관 도메인이면 그 기관으로 고정된다.
 * @param hints 요청사항 같은 **덧붙인 글** — 기관·회차·연도·지역을 찾는 데만 쓰고 이름표에는 넣지 않는다.
 *              사장님은 URL 없이 요청사항에만 "LH 공고 기준"이라 적는다(2026-09-15 확인).
 */
export function deriveSourceScope(topic: string, inputSources: SourceCandidate[] = [], hints = ''): SourceScope | undefined {
  const text = plain(topic);
  const clue = `${text} ${plain(hints)}`;
  if (/비교|차이|vs\b/i.test(text)) return undefined;   // 두 제도를 견주는 글은 한쪽으로 좁히면 안 된다
  const named = AGENCIES.filter((a) => a.name.test(clue));
  const anchored = AGENCIES.filter((a) => inputSources.some((s) => within(s.url || '', a.domain)));
  const picked = named.length === 1 ? named[0] : named.length === 0 && anchored.length === 1 ? anchored[0] : undefined;
  if (!picked) return undefined;
  if (!HOUSING_WORDS.test(`${clue} ${inputSources.map((s) => plain(s.title)).join(' ')}`)) return undefined;
  const primary = inputSources.find((s) => within(s.url || '', picked.domain));
  const identity = `${text} ${plain(primary?.title)}`;
  const round = roundOf(identity) || roundOf(clue);
  const year = identity.match(/\b(20\d{2})\s*년?/)?.[1] || clue.match(/\b(20\d{2})\s*년?/)?.[1];
  return {
    agency: picked.agency, domain: picked.domain, topic: identity.trim(),
    ...(round ? { round } : {}),
    ...(year ? { year } : {}),
    regions: REGIONS.filter((r) => identity.includes(r)),
  };
}

/**
 * 이 자료가 범위 안인가.
 *   · 다른 기관(이름이든 도메인이든)이면 아니다 — 같은 이름의 딴 제도다.
 *   · 기관 도메인이 아니면 본문에 그 기관 이름이 있어야 한다(언론 보도·안내 글).
 *   · 회차·연도·지역이 적혀 있는데 다르면 아니다(지난 회차 수치가 이번 모집 사실로 옮겨진다).
 *   · 제도 이름(든든전세 등)이 범위에 있으면 자료에도 있어야 한다 — 같은 기관의 딴 사업도 근거가 아니다.
 */
export function sourceMatchesScope(source: SourceCandidate, scope?: SourceScope): boolean {
  if (!scope) return true;
  const title = plain(source.title);
  const text = `${title} ${plain(source.content)}`;
  const ownDomain = within(source.url || '', scope.domain);
  const otherAgency = AGENCIES.some((a) => a.agency !== scope.agency && (within(source.url || '', a.domain) || a.name.test(text)));
  if (otherAgency) return false;
  const agency = AGENCIES.find((a) => a.agency === scope.agency);
  if (!ownDomain && !agency?.name.test(text)) return false;
  const candidateRound = roundOf(title || text);
  if (scope.round && candidateRound && candidateRound !== scope.round) return false;
  const candidateYear = title.match(/\b(20\d{2})\s*년?/)?.[1];
  if (scope.year && candidateYear && candidateYear !== scope.year) return false;
  const regions = REGIONS.filter((r) => title.includes(r));
  if (scope.regions.length && regions.length && !regions.some((r) => scope.regions.includes(r))) return false;
  const subject = SUBJECTS.find((s) => scope.topic.includes(s));
  return !subject || text.replace(/\s+/g, '').includes(subject);
}

/** 범위 안 자료만 남기고, 기관 공식(같은 회차 우선) → 나머지 순으로 세운다 */
export function selectScopedSources<T extends SourceCandidate>(sources: T[], scope?: SourceScope): T[] {
  const kept = sources.filter((s) => sourceMatchesScope(s, scope));
  if (!scope) return kept;
  const rank = (s: T) => within(s.url || '', scope.domain) ? (scope.round && roundOf(plain(s.title)) === scope.round ? 0 : 1) : 2;
  return [...kept].sort((a, b) => rank(a) - rank(b));
}

/** 범위 안에 기관 공식 자료가 하나라도 있는가 — 없으면 공고 원문 없이 쓰는 셈이라 크게 알려야 한다 */
export function hasOfficialSource(sources: SourceCandidate[], scope?: SourceScope): boolean {
  if (!scope) return true;
  return sources.some((s) => within(s.url || '', scope.domain));
}

/** 프롬프트에 싣는 출처 계층 지시 — 모든 생성·수정에 앞서 붙는다 */
export function buildSourceScopeDirective(scope?: SourceScope): string {
  if (!scope) return '';
  return [
    '[공고 출처 범위 — 모든 생성·수정에 적용]',
    `대상: ${scope.topic}`,
    `주관기관: ${scope.agency} / 공식 도메인: ${scope.domain}`,
    `회차: ${scope.round || '미확인'} / 공고 연도: ${scope.year || '미확인'} / 지역: ${scope.regions.join(', ') || '미확인'}`,
    '입력 공식 공고 → 동일 기관 공식 설명 → 동일 공고 언론 보도 순으로 사용한다. 같은 이름이라도 다른 기관의 제도는 섞지 않는다.',
    '공고명·공고일·모집일정·공급호수·조건은 해당 공고 원문에서 확인한 것만 쓴다. 일반 제도 안내와 다른 회차의 수치를 이번 모집의 사실로 옮기지 않는다.',
    '확인하지 못한 수치·일정·신청 URL 은 추정하거나 다른 기관 자료로 보충하지 않는다. 검색 요약은 원문 확인을 대신하지 않으며 확인되지 않은 사실을 단정하지 않는다.',
  ].join('\n');
}
