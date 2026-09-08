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
import { sameSite } from './host-trust';

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
 * 🔎 v3.8.694 — **거의 모든 공공 사이트에는 검색창이 있다.**
 *
 * 실측(2026-09-07)에서 안내문·게시판 목록·보도자료가 나란히 "행동 화면(action)"으로
 * 뽑혔다. 셋 다 신청 문구는 하나도 없는데 `<form>` 하나로 +2점을 받았고,
 * 그 form 은 전부 **사이트 검색창**이었다.
 *
 *   생활법령 해설      신청 문구 없음 · form 있음 → +2
 *   임실군 게시판 목록  신청 문구 없음 · form 있음 → +2
 *   고용노동부 보도자료  신청 문구 없음 · form 있음 → +2
 *
 * 검색창은 "여기서 그 일을 할 수 있다"는 증거가 아니다. 검색창밖에 없으면 점수를 주지 않는다.
 */
const SEARCH_FORM_HINT = /(name|id|class|placeholder)\s*=\s*["'][^"']*(search|srch|query|keyword|kwd|q)[^"']*["']|type\s*=\s*["']search["']/i;

/** 검색창 말고 진짜 입력 양식이 있는가 */
function hasRealForm(html: string): boolean {
  if (!FORM_MARKERS.test(html)) return false;
  const forms = String(html).match(/<form[\s\S]{0,1200}?<\/form>/gi) || [];
  // <form> 을 못 찾았는데 submit 버튼 문구가 잡힌 경우는 그대로 인정한다(버튼에 "신청" 등이 적혔다)
  if (forms.length === 0) return true;
  return forms.some((f) => !SEARCH_FORM_HINT.test(f));
}

/**
 * 📋 v3.8.694 — **목록·보도자료 화면은 행동 화면이 아니다.**
 *
 * 실측에서 뽑힌 것들: `imsil.go.kr/board/list.imsil?…`(군정소식 목록),
 * `moel.go.kr/news/enews/report/enewsView.do?…`(보도자료).
 * 읽을 거리는 되지만 그 자리에서 신청·조회를 할 수는 없다 — 홈과 같은 성격이다.
 *
 * ## 주소만으로 단정하지 않는다 — 실측이 그러지 말라고 했다
 * 이 저장소가 직접 고른 **금융감독원 민원신청** 화면의 주소가
 * `fss.or.kr/fss/bbs/B0000313/list.do?menuNo=201099` 다. `bbs`·`list.do` 가 둘 다 있다.
 * 주소만 봤으면 맞는 목적지를 버렸을 것이다.
 *
 * 그래서 **주소 + (제목 또는 본문)** 이 함께 말할 때만 목록으로 본다. 실측 대조(2026-09-07):
 *   고용노동부 보도자료   제목 "고용노동부"(단서 없음) · 본문에 "보도자료" 5회
 *   금감원 민원신청       제목 "금융감독원 민원신청"   · 본문에 "보도자료" 0회
 * 제목이 기관명뿐인 화면이 흔해서 본문까지 봐야 갈린다.
 */
/**
 * 경로 조각(`/news/`)만 보면 **리다이렉트에 흔들린다.** 실측: 정책브리핑 보도자료가
 * `korea.kr/news/pressReleaseView.do` → `korea.kr/briefing/pressReleaseView.do` 로 옮겨가
 * `/news/` 가 사라졌다. 그래서 경로와 함께 **화면 이름**(…View.do·…List.do)도 본다 —
 * 이쪽은 리다이렉트해도 잘 안 바뀐다.
 */
const LISTING_URL = /\/(?:board|bbs|news|notice|press|briefing)\b|\/list\b|list\.do|pressRelease\w*|enewsView|articleView|\bboardId=/i;
const LISTING_TITLE = /목록\s*페이지|목록$|보도\s*자료|보도\s*참고|공지\s*사항|게시판/;
/** 본문에 이 말이 여러 번 나오면 읽을 거리다 — 한 번은 메뉴에도 있으니 세어 본다 */
const LISTING_BODY = /보도\s*자료|보도\s*참고자료|배포\s*일시|보도\s*시점/g;

export function looksLikeListingPage(url: string, title: string, text = ''): boolean {
  if (!LISTING_URL.test(String(url || ''))) return false;
  if (LISTING_TITLE.test(String(title || ''))) return true;
  return (String(text || '').match(LISTING_BODY) || []).length >= 3;
}

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
/**
 * v3.8.691 — `감독원`·`심사평가원`·`지원단` 추가.
 * 실측에서 **금융감독원이 한 번도 안 잡혔다** — 접미어에 맨 `원` 이 없고 진흥원·관리원만 있었다.
 * 하필 보험·금융 글의 목적지가 대부분 금융감독원이라, 그 글들은 기관 기준 없이 채점됐다.
 * 맨 `원` 을 넣지 않는 이유는 "지원·병원·후원" 같은 말이 무더기로 걸리기 때문이다.
 */
const AGENCY_PATTERN = /([가-힣]{2,10}(?:공단|공사|재단|진흥원|관리원|감독원|심사평가원|지원단|위원회|청|처|부(?=\s|,|\.|·)|은행))|복지로|정부24|홈택스|워크넷|고용24|손택스|위택스|국민비서/g;

/**
 * 🏛️ v3.8.691 — 접미어만 보면 **기관이 아닌 말이 무더기로 걸린다.**
 *
 * ## 실측 (2026-09-07, leadernam.com 발행글 182편 · CTA 주소 112개)
 * 지목 기관 목록에 이런 것들이 들어 있었다:
 *   이의신청 · 재신청 · 추가납부 · 정보공개청 · 확인청   (…청)
 *   연락처 · 거래처 · 구매처 · 형사처 · 조세범처 · 퇴사처 (…처)
 *   시중은행                                            (…은행)
 *
 * **112개 중 40개(35.7%)** 에 이런 유령이 섞였고, 그 결과는 두 방향으로 나쁘다.
 *   · 게이트가 멀쩡한 CTA 를 "글이 지목한 기관과 다르다"며 **reject** 한다 (실측 12건 중 10건)
 *   · 채점기가 엉뚱한 페이지에 "기관 일치" **+2점**을 준다
 *
 * ## 왜 목록으로 푸는가
 * `청`·`처`로 끝나는 **실제 행정기관은 닫힌 집합**이다(정부조직법). 반면 `청구·신청`,
 * `처리·처벌`, `연락처·거래처` 처럼 같은 글자로 끝나는 일반명사는 무한히 만들어진다.
 * 그러니 "무엇이 기관인가"를 세는 쪽이 정확하고 짧다 — 이건 목적지 목록이 아니라
 * **낱말 사전**이다(목적지는 여전히 AI 와 검색이 정한다).
 * 지자체는 규칙으로 잡는다 — 시청·군청·구청·도청은 개수가 많고 규칙적이다.
 */
const LOCAL_GOV_CHEONG = /[가-힣]{2,8}(?:시|군|구|도)청$/;

/** 정부조직법상 청 단위 (지자체는 위 규칙이 따로 본다) */
const CENTRAL_CHEONG = new Set([
  '국세청', '관세청', '조달청', '통계청', '검찰청', '병무청', '방위사업청', '경찰청',
  '소방청', '문화재청', '국가유산청', '농촌진흥청', '산림청', '특허청', '기상청',
  '해양경찰청', '질병관리청', '우주항공청', '새만금개발청', '재외동포청',
  '행정중심복합도시건설청', '통계청', '고용노동청', '지방국세청', '중부지방국세청',
]);

/** 처 단위 — 실제로는 몇 개뿐이다 */
const CENTRAL_CHEO = new Set([
  '인사혁신처', '법제처', '식품의약품안전처', '식약처', '대통령경호처', '국가보훈처',
]);

/** 총칭어는 갈 곳이 아니다 — action-venues 의 NOT_A_VENUE 와 같은 취지 */
const GENERIC_BANK = /^(시중|지방|국책|일반|해당|각|여러|모든|주거래|거래|가까운|근처|타|제1금융|제2금융|1금융|2금융)/;

/**
 * 부 단위 — 청·처와 같은 이유로 **닫힌 목록**으로 센다.
 * 처음엔 "일부·전부·내부" 를 빼는 제외목록으로 짰는데, 실측에서 `등록원부` 가 통과했다.
 * 제외목록은 끝이 없다("…부"로 끝나는 일반명사는 계속 생긴다). 있는 것을 세는 편이 짧다.
 */
const MINISTRIES = new Set([
  '기획재정부', '교육부', '과학기술정보통신부', '외교부', '통일부', '법무부', '국방부',
  '행정안전부', '국가보훈부', '문화체육관광부', '농림축산식품부', '산업통상자원부',
  '보건복지부', '환경부', '고용노동부', '여성가족부', '성평등가족부', '국토교통부',
  '해양수산부', '중소벤처기업부', '기후에너지환경부',
]);

/** 걸린 말이 정말 기관 이름인가 — 접미어별로 다르게 묻는다 */
export function isAgencyName(name: string): boolean {
  const n = String(name || '').trim();
  if (n.length < 2) return false;
  if (n.endsWith('청')) return CENTRAL_CHEONG.has(n) || LOCAL_GOV_CHEONG.test(n);
  if (n.endsWith('처')) return CENTRAL_CHEO.has(n);
  if (n.endsWith('부')) return MINISTRIES.has(n);
  if (n.endsWith('은행')) return !GENERIC_BANK.test(n);
  // 공단·공사·재단·진흥원·관리원·위원회와 고유명(복지로·정부24…)은 오탐이 드물다
  return true;
}

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
    // v3.8.675 — "계속됐는지처" 처럼 용언 꼬리에 "처·부·청" 이 붙은 것은 기관이 아니다 (실측: 주택연금 글의 지목 기관에 섞였다)
    if (/됐|했|는지|인지|으로|에서|하는|되는|하면|되면|까지|부터/.test(name)) continue;
    // v3.8.691 — "이의신청·연락처·시중은행" 처럼 접미어만 같은 일반명사를 턴다 (실측 35.7%)
    if (!isAgencyName(name)) continue;
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
  // v3.8.694: 검색창 하나로 "행동 화면" 점수를 받던 구멍을 막는다
  const hasForm = hasRealForm(html);
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

/** 공백을 지운 뒤 비교 — "임의 가입" 과 "임의가입" 은 같은 말이다 */
function squash(value: string): string {
  return String(value || '').replace(/\s+/g, '').toLowerCase();
}

/**
 * v3.8.706 — AI 가 정한 "그 화면에 꼭 있어야 하는 낱말"(mustHave) 이 몇 개 빠졌나.
 * 1~2개면 전부, 3개 이상이면 하나까지 빠져도 봐준다(표기 차이). 빠진 낱말을 돌려준다.
 * mustHave 가 없으면 null — "검사할 것이 없음"과 "전부 있음"([])을 구별한다.
 *
 * 실측(2026-09-07): 월세 세액공제 글이 홈택스 **교육비** 세액공제 페이지로, 청년도약계좌 글이
 * **청년미래적금** 페이지로 갔다. 주제어 판정이 "토큰 절반"이라 같은 기관의 옆 제도가 통과했다.
 * destination-gate 와 resolveActionLink 가 **같은 함수**를 쓴다 — 두 경로가 다르게 재면 안 된다.
 */
export function missingMustHave(text: string, mustHave: string[] | undefined): string[] | null {
  const words = (mustHave || []).map((w) => String(w || '').trim()).filter((w) => w.length >= 2).slice(0, 3);
  if (words.length === 0) return null;
  const hay = squash(text);
  const missing = words.filter((w) => !hay.includes(squash(w)));
  const allowedMissing = words.length >= 3 ? 1 : 0;
  return missing.length > allowedMissing ? missing : [];
}

/**
 * v3.8.706 — 이 주소가 지목 기관의 호스트(또는 하위 도메인)인가.
 * preferredHost 가 없으면 null — "기준 없음"과 "다른 호스트"(false)를 구별한다.
 */
export function onPreferredHost(url: string, preferredHost: string | undefined): boolean | null {
  const target = String(preferredHost || '').trim();
  if (!target) return null;
  // 등기 도메인 단위로 본다 — 레지스트리가 ta.ksd.or.kr 로 배웠어도 www.ksd.or.kr 은 같은 집이다
  return sameSite(url, target);
}

/** 페이지를 받아오는 함수 — 테스트에서 갈아끼울 수 있게 밖에서 넣는다 */
export type PageFetcher = (url: string) => Promise<{ ok: boolean; html: string; finalUrl?: string }>;

/**
 * ④ 연동 — 후보를 채점해 가장 좋은 것을 고른다.
 *
 * 후보를 무한정 열지 않는다. 발행 한 번에 몇 초씩 늘어나면 안 되고,
 * 상위 몇 개를 넘어가면 어차피 관련 없는 결과다.
 */
/**
 * v3.8.557 — 3 → 5.
 * 사장님: "시간이 좀 더 걸리더라도 정확해야 된다."
 * 기관 사이트는 검색 상위 두세 개가 홈·공지·PDF 인 경우가 흔해서 3개만 보면
 * 진짜 신청 화면을 못 만나고 홈으로 물러섰다. 한 후보당 4초 상한이라 최악이 +8초다.
 */
const MAX_PROBE = 5;

export async function resolveActionLink(input: {
  keyword: string;
  intent: ActionIntent | null;
  candidates: LinkCandidate[];
  fetchPage: PageFetcher;
  /** ① 분석 결과 — 글이 지목한 기관. 있으면 채점이 훨씬 정확해진다 */
  agencies?: string[];
  /** 아무것도 통과 못 했을 때 쓸 기관 홈 (기존 흐름이 고른 값) */
  fallbackUrl?: string;
  /**
   * v3.8.706 — 지목 기관의 호스트(agency-registry 가 확인). 그 호스트의 후보를 먼저 열고
   * 채점에서 앞세운다. 다른 호스트는 action 으로 올리지 않는다(정부24 → 금천구청 사고).
   */
  preferredHost?: string | undefined;
  /** v3.8.706 — 목적지 화면에 꼭 있어야 하는 낱말. 없으면 action 으로 올리지 않는다 */
  mustHave?: string[] | undefined;
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
  const unique = input.candidates
    .map((c) => String(c?.url || '').trim())
    .filter((u) => /^https?:\/\//i.test(u))
    .filter((u) => (seen.has(u) ? false : (seen.add(u), true)));
  // 기관 호스트 먼저 — 열어 볼 수 있는 수가 정해져 있으니 순서가 곧 결과다
  const probes = [
    ...unique.filter((u) => onPreferredHost(u, input.preferredHost) === true),
    ...unique.filter((u) => onPreferredHost(u, input.preferredHost) !== true),
  ].slice(0, MAX_PROBE);

  /** 채점 + v3.8.706 의 두 상한(다른 호스트 · 필수어 없음) */
  let best: { url: string; s: ActionPageScore; rank: number; caps: string[] } | null = null;
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
    const caps: string[] = [];
    const onHost = onPreferredHost(finalUrl, input.preferredHost);
    if (onHost === false) caps.push(`지목 기관(${input.preferredHost}) 의 호스트가 아님 — 행동 화면으로 올리지 않는다`);
    const missing = missingMustHave(page.html.replace(/<[^>]+>/g, ' '), input.mustHave);
    if (missing && missing.length > 0) caps.push(`꼭 있어야 하는 낱말이 없음(${missing.join(', ')}) — 같은 기관의 다른 제도 화면일 수 있다`);
    // 순위는 기관 호스트에 +3 — 점수(stage 판정)는 그대로 둔다
    const rank = s.score + (onHost === true ? 3 : 0) - (caps.length > 0 ? 2 : 0);
    if (!best || rank > best.rank) best = { url: finalUrl, s, rank, caps };
  }

  if (best && best.caps.length > 0 && best.s.score >= ACTION_THRESHOLD && !best.s.looksLikeHome) {
    return {
      url: best.url, stage: 'guide', score: best.s.score,
      reasons: [...best.s.reasons, ...best.caps],
    };
  }

  /**
   * 🎯 v3.8.688 — 주제어가 하나도 없으면 'action' 이라고 말하지 않는다.
   * destination-gate 와 같은 규칙이다(두 경로가 다르게 재면 안 된다는 원칙).
   * 근거는 그쪽 주석에 적어 뒀다 — 주제어 0 + 행동 3 + 기관 2 = 5점으로 문턱을 넘는 구멍.
   */
  if (best && best.s.score >= ACTION_THRESHOLD && !best.s.hasKeyword && !best.s.looksLikeHome) {
    return {
      url: best.url, stage: 'guide', score: best.s.score,
      reasons: [...best.s.reasons, '이 글의 주제어가 페이지에 하나도 없음 — 행동 화면으로 단정하지 않는다'],
    };
  }
  if (best && best.s.score >= ACTION_THRESHOLD) {
    return { url: best.url, stage: 'action', score: best.s.score, reasons: best.s.reasons };
  }
  if (best && best.s.score >= GUIDE_THRESHOLD && !best.s.looksLikeHome) {
    // 신청 화면은 아니어도 그 제도를 설명하는 페이지 — 홈보다 한 걸음 가깝다
    return { url: best.url, stage: 'guide', score: best.s.score, reasons: best.s.reasons };
  }
  /**
   * v3.8.522 — 물러설 곳이 "그 글의 기관"일 때만 물러선다.
   *
   * 사장님 실물 검수: 본인부담상한제(국민건강보험공단) 글인데 버튼이 samsungfire.com
   * 홈으로 나갔다. 글이 지목한 기관과 다른 회사 홈으로 보내는 건 물러섬이 아니라 오배송이다.
   * 그런 링크는 독자를 엉뚱한 데로 보내니, 차라리 버튼을 안 넣는다
   * (기존 원칙: "근거가 없으면 CTA 를 넣지 않는다 — 남의 링크를 싣는 것보다 낫다").
   */
  if (fallback) {
    const agencies = (input.agencies || []).filter(Boolean);
    const mismatched = agencies.length > 0
      && looksLikeHomeUrl(fallback)
      && onPreferredHost(fallback, input.preferredHost) !== true   // v3.8.706 레지스트리가 확인한 기관 홈은 오배송이 아니다
      && !agencies.some((agency) => hostMatches(fallback, agency));
    if (mismatched) {
      return {
        url: '', stage: 'none', score: best?.s.score ?? 0,
        reasons: [...(best?.s.reasons || []), `글이 지목한 기관(${agencies.join(', ')})과 다른 곳의 홈 — CTA 를 넣지 않음`],
      };
    }
    return {
      url: fallback, stage: 'home', score: best?.s.score ?? 0,
      reasons: [...(best?.s.reasons || []), '기준 미달 — 기관 홈으로 물러섬'],
    };
  }
  return none;
}
