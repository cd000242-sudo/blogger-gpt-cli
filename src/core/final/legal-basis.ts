/**
 * ⚖️ legal-basis — 제도 글의 **근거 조항을 실제로 받아와** 근거 장부에 넣는다. (v3.8.732)
 *
 * 사장님: "글을 한번 쓸 때 LLM 이 비평하더라도 수정할 게 없고 100점에 가깝게…"
 *
 * ## 왜 필요한가 (장부 실측 2026-09-15)
 * 발행 147편 중 **36편**이 `no-legal-basis` 로 -10 점이다. 제도를 설명하면서 「○○법 제○조」가 한 건도 없다는 뜻이다.
 * 그런데 이건 글쓰기로 못 고친다 — 프롬프트는 "모르는 것을 지어내지 마라" 이므로, 조문을 모르면 안 쓰는 게 맞다.
 * pre-publish-fix 가 이 결함을 AI 에게 안 맡기는 이유도 같다("맡기면 모르는 조항을 지어내 채운다").
 * **재료가 없는 것이 원인이므로 재료를 구해다 준다.**
 *
 * ## 무엇을 하나 (LLM 호출 0회)
 * 법제처 국가법령정보 OPEN API(DRF)를 쓴다. 무료이고 등록 없이 `OC=test` 로 응답한다(2026-09-15 실측).
 *   ① 근거 장부·수집 자료가 **이미 부른 법령 이름**만 뽑는다.
 *   ② 그 이름을 법제처에 물어 **같은 이름이 실재하는지** 확인한다(이름이 다르면 버린다).
 *   ③ 조문 중 주제어가 든 것을 골라 법령명·소관부처·제○조(제목)·본문 일부를 장부에 넣는다.
 *
 * ## 키워드로 법령을 "찾아 주지" 않는다 — 실측으로 버린 설계
 * 처음에는 키워드의 주제어로도 검색했다. 실측 5건 중 2건이 오답이었다:
 *   · "2026 독감 무료접종 임신부" → 「코로나바이러스감염증-19 예방접종 피해보상 특별법」
 *   · "인천·부천 든든전세 4차 모집" → 「국립대학법인 **인천대학교** 설립ㆍ운영에 관한 법률」
 * 두 번째는 "인천" 이 키워드에 있어서 고유명사 검사도 통과했다. 지명·기관명으로 엉뚱한 조직법이 걸리는 것을
 * 목록으로 막으려 하면 하드코딩이 된다. **자료가 부르지 않은 법은 우리도 부르지 않는다** —
 * 오답보다 못 찾음이 낫다(v3.8.706 원칙). 그래서 근거는 늘 자료에서 나온다.
 *
 * ## 절대 원칙
 * 네트워크가 죽어도, 형식이 바뀌어도 **빈 결과**를 돌려준다. 생성을 막지 않는다.
 * 받아온 글자만 넣는다 — 조문 번호·내용을 우리가 만들지 않는다.
 */

export interface StatuteArticle {
  /** "12" 또는 "12의2" */
  no: string;
  title: string;
  text: string;
}

export interface LegalBasis {
  /** 정식 법령명 (법제처가 준 그대로) */
  name: string;
  /** 소관부처 */
  department: string;
  /** 법률 / 시행령 / 시행규칙 */
  kind: string;
  /** 국가법령정보센터 주소 */
  url: string;
  articles: StatuteArticle[];
}

type FetchJson = (url: string) => Promise<any>;

/** 법제처 DRF. OC 는 이메일 아이디 — 등록 전에는 공개 계정(test)이 응답한다 */
const LAW_API_OC = String(process.env['LAW_API_OC'] || 'test').trim() || 'test';
const DRF = 'https://www.law.go.kr/DRF';
const TIMEOUT_MS = 8000;

const plain = (value: unknown): string => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const defaultFetchJson: FetchJson = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: controller.signal });
    const text = await res.text();
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
};

/* ────────────────────────────────────────────────────────────────
 * ① 자료가 이미 부른 법령 이름
 * ──────────────────────────────────────────────────────────────── */

/** 「…」 안이든 맨몸이든, 법령으로 읽히는 이름만. 조사는 떼고 돌려준다 */
const STATUTE_IN_TEXT = /(?:「([^」\n]{2,40})」|([가-힣][가-힣\s·]{1,28}?(?:에\s*관한\s*(?:법률|특별법)|특별법|기본법|보호법|관리법|지원법|촉진법|법률|[가-힣]{1,6}법))(?=\s*(?:시행령|시행규칙)?[\s,.·)」]|[상적]?\s*(?:제\s?\d|에\s*따|에\s*의|이\s*정|[을를은는의과와이가]\s)))/g;
/** 이름처럼 보이지만 법령이 아닌 것 — "방법·수법·용법" 같은 꼬리 */
const NOT_A_STATUTE = /(?:방법|수법|용법|기법|어법|문법|서법|화법|비법|편법|불법|합법|위법|적법|준법|입법|사법|행법)$/;

/**
 * 앞 낱말이 **주격·목적격 조사**로 끝나면 법령 이름이 아니라 앞 문장의 주어다 — 뗀다.
 * 실측: "질병관리청은 감염병의 예방 및 관리에 관한 법률" 이 통째로 잡혔다.
 * 「감염병의」의 `의`, 「지원에」의 `에` 는 이름 안에 실제로 쓰이므로 건드리지 않는다.
 */
const LEADING_PARTICLE = /[은는이가을를]$/;

export function trimStatuteLead(name: string): string {
  const words = plain(name).split(/\s+/).filter(Boolean);
  while (words.length > 1 && LEADING_PARTICLE.test(words[0]!)) words.shift();
  return words.join(' ');
}

export function extractStatuteNames(text: string): string[] {
  const source = plain(text);
  const found: string[] = [];
  for (const match of source.matchAll(STATUTE_IN_TEXT)) {
    const raw = trimStatuteLead(plain(match[1] || match[2] || ''));
    // 「」 안은 법령이 아닐 수도 있다 — 법령 꼬리를 가진 것만
    if (!/(?:법률|특별법|기본법|보호법|관리법|지원법|촉진법|[가-힣]법)$/.test(raw)) continue;
    if (NOT_A_STATUTE.test(raw)) continue;
    if (raw.length < 3 || raw.length > 40) continue;
    if (!found.includes(raw)) found.push(raw);
  }
  return found;
}

/* ────────────────────────────────────────────────────────────────
 * ② 주제어 — 키워드에서 법령 검색어를 뽑는다
 * ──────────────────────────────────────────────────────────────── */

/** 연도·서수·수식어처럼 법령 이름에 없을 말 */
const NOISE = /^(?:20\d{2}년?|\d+차|\d+회|올해|내년|작년|최신|총정리|정리|방법|신청|조회|기준|사유|안내|모집|공고|무료|대상|자격|서류|기한|변경|폐지|확대|지급|혜택|차이|비교|후기|추천)$/;

export function topicTerms(keyword: string, max = 3): string[] {
  const words = plain(keyword).split(/[\s,·]+/).filter(Boolean);
  const kept = words
    .map((w) => w.replace(/[^가-힣A-Za-z0-9]/g, ''))
    .filter((w) => w.length >= 2 && !NOISE.test(w));
  return [...new Set(kept)].slice(0, max);
}

/* ────────────────────────────────────────────────────────────────
 * ③ 안전장치 — 자료가 부른 이름과 **같은 법**인지
 * ──────────────────────────────────────────────────────────────── */

const squash = (value: string): string => plain(value).replace(/[\s·ㆍ]/g, '');

/**
 * 법제처가 돌려준 법령이 **자료가 부른 그 법**인가.
 *
 * 검색은 이름의 일부만 맞아도 다른 법을 준다(실측: "인천" → 인천대학교 설립법).
 * 그래서 이름이 서로를 품을 때만 같은 법으로 본다. 시행령·시행규칙은 본법 이름을 품으므로 함께 통과한다.
 */
export function isSameStatute(candidateName: string, foundName: string): boolean {
  const wanted = squash(candidateName);
  const found = squash(foundName);
  if (wanted.length < 3 || found.length < 3) return false;
  return found.includes(wanted) || wanted.includes(found);
}

/* ────────────────────────────────────────────────────────────────
 * ④ 법제처 API
 * ──────────────────────────────────────────────────────────────── */

interface StatuteHit { name: string; mst: string; department: string; kind: string }

export function parseSearchResponse(json: any): StatuteHit[] {
  const box = json?.LawSearch || {};
  const rows = Array.isArray(box.law) ? box.law : (box.law ? [box.law] : []);
  return rows
    .map((row: any) => ({
      name: plain(row?.법령명한글),
      mst: String(row?.법령일련번호 || '').trim(),
      department: plain(row?.소관부처명),
      kind: plain(row?.법령구분명),
    }))
    .filter((hit: StatuteHit) => hit.name && hit.mst);
}

export function parseArticleResponse(json: any): StatuteArticle[] {
  const units = json?.법령?.조문?.조문단위;
  const rows = Array.isArray(units) ? units : (units ? [units] : []);
  return rows
    .filter((row: any) => String(row?.조문여부 || '').trim() === '조문')
    .map((row: any) => {
      const no = String(row?.조문번호 || '').trim();
      const title = plain(row?.조문제목);
      // 조문내용은 "제3조(목적) 이 법은…" 처럼 머리말이 겹쳐 온다 — 한 번만 남긴다
      const body = plain(row?.조문내용).replace(new RegExp(`^제\\s?${no}\\s?조(?:의\\s?\\d+)?\\s*\\([^)]*\\)\\s*`), '');
      return { no, title, text: body };
    })
    .filter((article: StatuteArticle) => article.no && (article.title || article.text));
}

/** 주제어가 든 조문을 앞세운다. 하나도 안 맞으면 목적(제1조)만 — 그것도 근거다 */
export function pickArticles(articles: StatuteArticle[], terms: string[], max = 3): StatuteArticle[] {
  const score = (article: StatuteArticle): number => {
    const hay = `${article.title} ${article.text}`.replace(/\s+/g, '');
    return terms.reduce((sum, term) => sum + (hay.includes(term.replace(/\s+/g, '')) ? 1 : 0), 0);
  };
  const scored = articles.map((article) => ({ article, hits: score(article) })).filter((row) => row.hits > 0);
  if (scored.length === 0) return articles.slice(0, 1);
  return scored.sort((a, b) => b.hits - a.hits).slice(0, max).map((row) => row.article);
}

const searchUrl = (query: string) =>
  `${DRF}/lawSearch.do?OC=${encodeURIComponent(LAW_API_OC)}&target=law&type=JSON&display=5&query=${encodeURIComponent(query)}`;
const articlesUrl = (mst: string) =>
  `${DRF}/lawService.do?OC=${encodeURIComponent(LAW_API_OC)}&target=law&type=JSON&MST=${encodeURIComponent(mst)}`;
export const statuteUrl = (name: string) => `https://www.law.go.kr/법령/${encodeURIComponent(name.replace(/\s+/g, ''))}`;

/**
 * 근거 조항을 구한다. 못 구하면 null — 생성은 그대로 간다.
 *
 * @param keyword 글의 키워드
 * @param evidenceText 이미 모은 근거(장부·수집 본문). 여기가 부른 법령을 가장 먼저 믿는다.
 */
export async function fetchLegalBasis(
  keyword: string,
  evidenceText: string,
  opts: { fetchJson?: FetchJson; maxArticles?: number; maxCandidates?: number } = {},
): Promise<LegalBasis | null> {
  const fetchJson = opts.fetchJson || defaultFetchJson;
  const terms = topicTerms(keyword);
  // **자료가 부른 이름만** 쓴다. 키워드로 추측하지 않는다(머리말의 실측 참고).
  const candidates = extractStatuteNames(evidenceText).slice(0, opts.maxCandidates ?? 3);
  if (candidates.length === 0) return null;

  for (const candidate of candidates) {
    let hits: StatuteHit[] = [];
    try {
      hits = parseSearchResponse(await fetchJson(searchUrl(candidate)));
    } catch {
      continue;   // 한 번 실패해도 다음 후보로 간다
    }
    // 이름이 같은 것만, 그중 시행령·시행규칙보다 법률을 앞에 (근거로 읽기 쉽다)
    const same = hits
      .filter((hit) => isSameStatute(candidate, hit.name))
      .sort((a, b) => (a.kind === '법률' ? 0 : 1) - (b.kind === '법률' ? 0 : 1));
    for (const hit of same) {
      try {
        const articles = parseArticleResponse(await fetchJson(articlesUrl(hit.mst)));
        if (articles.length === 0) continue;
        return {
          name: hit.name,
          department: hit.department,
          kind: hit.kind,
          url: statuteUrl(hit.name),
          articles: pickArticles(articles, terms, opts.maxArticles ?? 3),
        };
      } catch {
        continue;
      }
    }
  }
  return null;
}

/* ────────────────────────────────────────────────────────────────
 * ⑤ 프롬프트에 실을 블록
 * ──────────────────────────────────────────────────────────────── */

/** 한 조문을 인용 가능한 한 줄로 */
export function formatArticle(article: StatuteArticle): string {
  const head = `제${article.no}조${article.title ? `(${article.title})` : ''}`;
  const body = article.text.slice(0, 220);
  return body ? `${head} ${body}` : head;
}

/**
 * 근거 장부에 넣을 블록. **받아온 글자만** 들어간다.
 * 인용하라고 시키되, 억지로 끼워 넣지는 말라고 함께 적는다 — 관계없는 자리에 조문이 박히면 그게 더 나쁘다.
 */
export function buildLegalBasisBlock(basis: LegalBasis | null): string {
  if (!basis || basis.articles.length === 0) return '';
  return [
    '[근거 법령 — 법제처 국가법령정보센터에서 확인한 원문]',
    `법령: 「${basis.name}」${basis.kind ? ` (${basis.kind}` : ''}${basis.department ? `, 소관 ${basis.department}` : ''}${basis.kind ? ')' : ''}`,
    `원문: ${basis.url}`,
    ...basis.articles.map((article) => `· ${formatArticle(article)}`),
    '',
    '이 글이 제도·지원금·자격·처분을 설명한다면 위 법령명을 본문에서 한 번 이상 부르고,',
    '해당하는 내용이 있는 자리에 「법령명 제○조」 형태로 근거를 답니다. 위에 적힌 조문만 인용합니다.',
    '위에 없는 조문 번호·항·호를 쓰지 않습니다. 맞는 자리가 없으면 법령명만 부르고 조문은 생략합니다.',
  ].join('\n');
}
