/**
 * action-link-harness — CTA 를 "바로 그 화면"으로 보낸다.
 *
 * ## 왜 만드는가
 * 독자는 홈에 가서 다시 찾으려고 버튼을 누르는 게 아니다. 광고처럼 누르면 바로
 * 그 일을 할 수 있어야 한다. 지금은 검색어를 행동 쪽으로 돌리는 데까지는 하는데
 * (action-intent), **고른 주소가 정말 그 행동을 할 수 있는 화면인지 아무도 안 본다.**
 * 그래서 구글이 1등으로 준 기관 홈이 그대로 CTA 가 된다.
 *
 * ## 4단 하네스
 *   ① 분석  글에서 "독자가 하려는 행동"을 읽는다        (action-intent 재사용)
 *   ② 검색  그 행동으로 후보 주소를 모은다               (수집된 근거 + 검색 결과)
 *   ③ 확인  후보를 실제로 열어 "여기서 되는가"를 채점한다  ← 지금 없는 것
 *   ④ 연동  기준을 넘으면 채택, 아니면 한 단계씩 물러선다
 *
 * ## 무리하지 않는다
 * 정부 사이트의 진짜 신청 화면은 공동인증서 뒤에 있거나 세션 주소라 남에게 주면
 * 안 열리는 경우가 많다. 그런 데는 "제도 안내 페이지"까지가 최선이고, 그것만으로도
 * 검색을 한 번 덜 한다. **죽은 딥링크는 홈보다 나쁘다** — 확신이 없으면 물러선다.
 *
 * ## AI 를 부르지 않는다
 * 페이지를 받아 글자를 세는 일이다. 비용이 0원이고 결과가 항상 같아 테스트가 된다.
 */
import type { ActionIntent } from './action-intent';

/** ③ 확인 단계에서 매기는 점수 (양수=행동 화면답다, 음수=아니다) */
export interface ActionPageScore {
  score: number;
  /** 사람이 읽을 수 있는 판단 근거 — 로그로 남겨 나중에 왜 그 링크였는지 쫓는다 */
  reasons: string[];
  hasKeyword: boolean;
  hasActionElement: boolean;
  looksLikeHome: boolean;
  loginWalled: boolean;
}

export type LinkStage = 'action' | 'guide' | 'home' | 'none';

export interface ActionLinkResult {
  url: string;
  /** action=신청 화면 · guide=제도 안내 · home=기관 홈 · none=붙이지 않음 */
  stage: LinkStage;
  score: number;
  reasons: string[];
}

export interface LinkCandidate {
  url: string;
  /** 검색 결과 제목이나 기관명 — 없으면 빈 문자열 */
  title?: string;
}

/** ③ 채택 기준. 이 밑이면 "그 화면"이라고 말할 수 없다. */
const ACTION_THRESHOLD = 4;
const GUIDE_THRESHOLD = 1;

/** 행동별로 그 화면에 실제로 붙어 있는 말 */
const ACTION_MARKERS: Record<ActionIntent, RegExp> = {
  신청: /신청하기|온라인\s*신청|신청서\s*작성|접수하기|신청\s*바로가기/,
  예매: /예매하기|승차권\s*예매|좌석\s*선택|예매\s*바로가기|간편예매/,
  예약: /예약하기|예약\s*신청|날짜\s*선택|예약\s*바로가기/,
  조회: /조회하기|조회\s*버튼|내역\s*조회|검색하기|확인하기/,
  발급: /발급하기|발급\s*신청|인터넷\s*발급|출력하기/,
  접수: /접수하기|원서\s*접수|접수\s*바로가기/,
  가입: /가입하기|회원가입|가입\s*신청/,
  납부: /납부하기|납부\s*바로가기|결제하기/,
};

/** 어느 행동이든 "여기서 뭔가 하는 화면"임을 알려주는 흔적 */
const FORM_MARKERS = /<form[\s>]|type=["']submit["']|<button[^>]*>(?:[^<]*?)(신청|접수|조회|발급|예매|예약|납부|가입)/i;

/**
 * 로그인 벽 — 감점하지 않는다.
 *
 * 처음엔 감점했는데 틀린 판단이었다. 정부·공공 서비스의 진짜 신청 화면은
 * 원래 로그인 뒤에 있다. 로그인만 하면 그 자리에서 신청이 되는 화면이라면
 * 그게 바로 독자가 가야 할 곳이다 — 홈으로 보내 다시 찾게 하는 것보다 낫다.
 * 주제와 무관한 맨 로그인 페이지는 키워드 검사에서 어차피 걸러진다.
 */
const LOGIN_WALL = /로그인\s*(?:후|이[용후])|공동인증서|간편인증|본인확인\s*후|회원만\s*이용/;

/** 홈으로 보이는 주소 (경로가 없거나 index 류) */
export function looksLikeHomeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, '');
    if (!path || path === '') return true;
    if (/^\/(?:index|main|home)(?:\.\w+)?$/i.test(path)) return true;
    // /portal 처럼 한 마디짜리 진입 경로도 사실상 홈이다
    if (path.split('/').filter(Boolean).length <= 1 && !u.search) return true;
    return false;
  } catch {
    return true;
  }
}

/**
 * 키워드에서 "주제"만 뽑는다.
 *
 * 행동어(신청·조회·발급…)를 빼는 게 핵심이다. 안 빼면 모든 신청 화면에 "신청"이
 * 적혀 있으니 엉뚱한 기관 페이지도 키워드가 맞는 것처럼 통과한다 —
 * 은행 신청 화면이 "청년내일저축계좌" 페이지로 뽑히는 사고가 여기서 난다.
 */
const ACTION_WORDS = /^(신청|신청서|접수|조회|발급|예매|예약|가입|납부|청구|등록|결제)$/;
const FILLER_WORDS = /^(방법|기준|조건|안내|정리|총정리|얼마|언제|어디|바로가기|온라인|홈페이지|사이트|공식)$/;

export function keywordTokens(keyword: string): string[] {
  return String(keyword || '')
    .replace(/[^가-힣a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2)
    .filter((w) => !FILLER_WORDS.test(w))
    .filter((w) => !ACTION_WORDS.test(w))
    .slice(0, 4);
}

/** 주소의 호스트가 기관 이름과 이어지는지 (복지로 → bokjiro 처럼 흔한 표기) */
const AGENCY_HOSTS: Array<[RegExp, RegExp]> = [
  [/복지로/, /bokjiro/i],
  [/정부24/, /gov\.kr/i],
  [/국민건강보험|건강보험공단/, /nhis/i],
  [/국민연금/, /nps\.or\.kr/i],
  [/고용노동부|고용24|워크넷/, /moel|work24|worknet/i],
  [/근로복지공단/, /comwel|kcomwel/i],
  [/국세청|홈택스/, /nts\.go\.kr|hometax/i],
  [/주택도시기금|HUG/, /nhuf|khug/i],
  [/한국장학재단/, /kosaf/i],
  [/소상공인시장진흥공단/, /semas|sbiz/i],
];

export function hostMatches(url: string, agency: string): boolean {
  try {
    const host = new URL(url).hostname;
    for (const [name, hostRe] of AGENCY_HOSTS) {
      if (name.test(agency) && hostRe.test(host)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * ① 분석 — 키워드가 아니라 **글 전체**에서 읽는다.
 *
 * 키워드만 보면 "청년내일저축계좌"까지는 알아도 그게 복지로에서 하는 일인지
 * 은행에서 하는 일인지 모른다. 그런데 글에는 이미 적혀 있다 —
 * 근거를 모아 쓴 글이라 어디서 신청하는지 본문이 말해 준다. 그걸 읽는다.
 */
export interface ArticleContext {
  intent: ActionIntent | null;
  /** 행동어를 뺀 주제어 */
  subject: string[];
  /** 글이 지목한 기관 이름 (많이 나온 순) */
  agencies: string[];
}

/** 기관으로 보이는 이름 — 흔한 접미어로 잡는다 */
const AGENCY_PATTERN = /([가-힣]{2,10}(?:공단|공사|재단|진흥원|관리원|위원회|청|처|부(?=\s|,|\.|·)|은행))|복지로|정부24|홈택스|워크넷|고용24|손택스|위택스|국민비서/g;

export function analyzeArticleContext(input: {
  keyword: string;
  title?: string;
  content?: string;
  /** 키워드에서 읽은 행동 — 없으면 본문에서 다시 찾는다 */
  intent?: ActionIntent | null;
}): ArticleContext {
  const text = `${input.title || ''}\n${String(input.content || '').replace(/<[^>]+>/g, ' ')}`;

  // 기관: 본문에 여러 번 나온 이름일수록 이 글의 진짜 목적지다
  const counts = new Map<string, number>();
  for (const m of text.matchAll(AGENCY_PATTERN)) {
    const name = (m[0] || '').trim();
    if (name.length < 2) continue;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  const agencies = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  return {
    intent: input.intent ?? null,
    subject: keywordTokens(`${input.keyword} ${input.title || ''}`),
    agencies,
  };
}

/**
 * ③ 확인 — 받아온 페이지가 "그 행동을 할 수 있는 화면"인지 채점한다.
 * html 은 소문자 변환하지 않는다(한글 마커가 대소문자와 무관하고, 원문이 판단에 낫다).
 */
export function scoreActionPage(input: {
  url: string;
  html: string;
  keyword: string;
  intent: ActionIntent;
  /** 글이 지목한 기관 — 맥락에서 얻은 신호 */
  agencies?: string[];
}): ActionPageScore {
  const reasons: string[] = [];
  const html = String(input.html || '');
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');

  const tokens = keywordTokens(input.keyword);
  const hitCount = tokens.filter((t) => text.includes(t)).length;
  const hasKeyword = tokens.length > 0 && hitCount >= Math.ceil(tokens.length / 2);

  const marker = ACTION_MARKERS[input.intent];
  const hasActionText = marker ? marker.test(text) : false;
  const hasForm = FORM_MARKERS.test(html);
  const hasActionElement = hasActionText || hasForm;

  const looksHome = looksLikeHomeUrl(input.url);
  const loginWalled = LOGIN_WALL.test(text);

  let score = 0;
  if (hasKeyword) { score += 3; reasons.push(`주제어 ${hitCount}/${tokens.length} 일치`); }
  else reasons.push('주제어가 페이지에 없음');

  if (hasActionText) { score += 3; reasons.push(`행동 문구 발견(${input.intent})`); }
  else if (hasForm) { score += 2; reasons.push('입력 양식 있음'); }
  else reasons.push('행동 요소 없음');

  // 글이 지목한 기관과 같은 곳이면 가산 — 맥락에서 얻은 가장 확실한 신호다
  if (input.agencies?.length) {
    const hit = input.agencies.find((a) => a && (text.includes(a) || hostMatches(input.url, a)));
    if (hit) { score += 2; reasons.push(`글이 지목한 기관과 일치(${hit})`); }
  }

  if (looksHome) { score -= 3; reasons.push('홈으로 보이는 주소'); }
  /* 로그인 벽은 감점하지 않는다 — 로그인만 하면 되는 화면이면 그게 목적지다 */
  if (loginWalled && hasKeyword) { score += 1; reasons.push('로그인 후 이용 가능한 해당 서비스 화면'); }

  return { score, reasons, hasKeyword, hasActionElement, looksLikeHome: looksHome, loginWalled };
}

/** 페이지를 받아오는 함수 — 테스트에서 갈아끼울 수 있게 밖에서 넣는다 */
export type PageFetcher = (url: string) => Promise<{ ok: boolean; html: string; finalUrl?: string }>;

/**
 * ④ 연동 — 후보를 채점해 가장 좋은 것을 고른다.
 *
 * 후보를 무한정 열지 않는다. 발행 한 번에 몇 초씩 늘어나면 안 되고,
 * 상위 몇 개를 넘어가면 어차피 관련 없는 결과다.
 */
const MAX_PROBE = 3;

export async function resolveActionLink(input: {
  keyword: string;
  intent: ActionIntent | null;
  candidates: LinkCandidate[];
  fetchPage: PageFetcher;
  /** ① 분석 결과 — 글이 지목한 기관. 있으면 채점이 훨씬 정확해진다 */
  agencies?: string[];
  /** 아무것도 통과 못 했을 때 쓸 기관 홈 (기존 흐름이 고른 값) */
  fallbackUrl?: string;
}): Promise<ActionLinkResult> {
  const fallback = String(input.fallbackUrl || '').trim();
  const none: ActionLinkResult = { url: '', stage: 'none', score: 0, reasons: ['후보 없음'] };

  // 행동을 못 읽었으면 채점할 기준이 없다 — 기존 동작 그대로 둔다
  if (!input.intent) {
    return fallback
      ? { url: fallback, stage: 'home', score: 0, reasons: ['행동 의도를 못 읽음 — 기존 링크 유지'] }
      : none;
  }

  const seen = new Set<string>();
  const probes = input.candidates
    .map((c) => String(c?.url || '').trim())
    .filter((u) => /^https?:\/\//i.test(u))
    .filter((u) => (seen.has(u) ? false : (seen.add(u), true)))
    .slice(0, MAX_PROBE);

  let best: { url: string; s: ActionPageScore } | null = null;
  for (const url of probes) {
    let page: { ok: boolean; html: string; finalUrl?: string };
    try {
      page = await input.fetchPage(url);
    } catch {
      continue;   // 못 열리는 후보는 조용히 건너뛴다 — 죽은 링크를 내보내지 않기 위한 것
    }
    if (!page?.ok || !page.html) continue;

    // 리다이렉트로 홈에 떨어졌으면 그 사실을 반영해 채점한다
    const finalUrl = String(page.finalUrl || url);
    const s = scoreActionPage({
      url: finalUrl, html: page.html, keyword: input.keyword,
      intent: input.intent, agencies: input.agencies || [],
    });
    if (!best || s.score > best.s.score) best = { url: finalUrl, s };
  }

  if (best && best.s.score >= ACTION_THRESHOLD) {
    return { url: best.url, stage: 'action', score: best.s.score, reasons: best.s.reasons };
  }
  if (best && best.s.score >= GUIDE_THRESHOLD && !best.s.looksLikeHome) {
    // 신청 화면은 아니어도 그 제도를 설명하는 페이지 — 홈보다 한 걸음 가깝다
    return { url: best.url, stage: 'guide', score: best.s.score, reasons: best.s.reasons };
  }
  if (fallback) {
    return {
      url: fallback, stage: 'home', score: best?.s.score ?? 0,
      reasons: [...(best?.s.reasons || []), '기준 미달 — 기관 홈으로 물러섬'],
    };
  }
  return none;
}
