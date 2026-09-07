/**
 * destination-gate — CTA 주소를 내보내기 전에 "여기서 그 일이 되는가"를 마지막으로 묻는다.
 *
 * ## 왜 만드는가 (v3.8.557)
 * 사장님 실물 검수: "PDF 파일을 연동시키거나 보험 관련 글인데 국세청 홈으로 연동한다거나…
 * 실제 사람들이 글에 나온 정보대로 행동할 수 있는 결과를 볼 수 있는 곳을 연동해야 된다고."
 *
 * 원인은 **경로마다 검사가 달랐다**는 것이다.
 *   · 2단계(검색 폴백)에는 행동 화면 채점기(action-link-harness)가 붙어 있다.
 *   · 그런데 실제로 대부분의 CTA 를 정하는 **1단계(AI 추론)에는 그게 없었다.**
 *     1단계는 "검색엔진/블로그인가 · 도메인이 믿을 만한가 · 살아있는가" 세 가지만 봤다.
 *     그래서 살아있기만 하면 국세청 **홈**도, 안내문 **PDF** 도 그대로 버튼이 됐다.
 *
 * 이 모듈은 어느 경로로 정해진 주소든 같은 질문을 던진다:
 *   ① 파일인가 (PDF·HWP·XLSX…)            → 읽을 수는 있어도 그 자리에서 할 수는 없다
 *   ② 이 글이 지목한 기관이 맞는가          → 보험 글의 국세청은 오배송이다
 *   ③ 홈인가, 그 행동을 하는 화면인가        → 홈은 독자에게 "다시 찾아라"는 말이다
 *
 * ## 떨어뜨리는 방식이 두 가지다 — 이게 핵심이다
 *   · reject : 엉뚱한 기관. 절대 쓰지 않는다 (버튼을 아예 안 다는 게 낫다).
 *   · demote : 기관은 맞는데 홈이거나 파일. **당장은 쓰지 않고** 검색 경로에
 *              제대로 된 행동 화면을 찾을 기회를 준다. 그래도 못 찾으면 그때 쓴다.
 *   사장님 요구가 둘 다다 — "정확해야 된다" 와 "버튼을 눌러야 광고 수익이 난다".
 *   무조건 reject 하면 CTA 가 사라지고, 무조건 통과시키면 지금 문제가 그대로다.
 *
 * ## AI 를 부르지 않는다
 * 페이지를 받아 글자를 세는 일이다. 비용 0원, 결과가 항상 같아 테스트가 된다.
 * (목적지 "판단"은 이미 앞단에서 AI 가 한다 — 여기는 그 판단의 검산이다.)
 */
import type { ActionIntent } from './action-intent';
import { scoreActionPage, looksLikeHomeUrl, hostMatches, keywordTokens, looksLikeListingPage } from './action-link-harness';
import type { PageFetcher } from './action-link-harness';

/** 문서·압축 파일 확장자 — 브라우저가 열어도 "행동"은 못 하는 것들 */
const DOCUMENT_EXT =
  /\.(pdf|ppt|pptx|pps|ppsx|key|hwp|hwpx|xlsx|xls|ods|csv|tsv|zip|rar|7z|docx|doc|odt|rtf|pages|numbers)(\?|#|$)/i;

/**
 * 📎 v3.8.619 — 확장자가 없어도 **내려받기 주소**는 있다.
 *
 * 사장님 실물 검수: "공식 사이트 바로가기라 되어 있으면서 PDF 파일이 다운로드되는데?"
 * 실제로 발행글의 CTA 가 이 주소였다:
 *   https://eiec.kdi.re.kr/policy/callDownload.do?num=264303&filenum=3
 * 눌러 보면 `Content-Disposition: attachment; filename="R2503531-2.pdf"` 가 돌아온다.
 * 확장자 검사만 하던 예전 규칙은 `.pdf` 가 주소에 없으니 그냥 통과시켰다.
 *
 * 한국 공공기관 CMS 는 파일을 대부분 이런 꼴로 내보낸다 — 경로나 질의문자열에
 * download / fileDown / atchFile 같은 말이 들어간다. 그 꼴을 문서로 본다.
 * 버튼에 "바로가기"라 써 놓고 파일이 떨어지면 그건 약속을 어긴 것이다.
 */
const DOWNLOAD_ENDPOINT = /(?:call)?down(?:load)?\.do|file_?down(?:load)?|filedown\b|\/download\b|getfile|atchfile|attachfile|fileid=|filesn=|filenum=|cmd=download/i;

/** 주소가 문서 파일(또는 내려받기 주소)을 가리키는가 */
export function isDocumentUrl(url: string): boolean {
  const value = String(url || '');
  return DOCUMENT_EXT.test(value) || DOWNLOAD_ENDPOINT.test(value);
}

/** 채택 기준 — action-link-harness 와 같은 눈금을 쓴다(두 경로가 다르게 재면 안 된다) */
const ACTION_THRESHOLD = 4;
const GUIDE_THRESHOLD = 1;

export type GateStage = 'action' | 'guide';
export type GateSeverity =
  /** 엉뚱한 목적지 — 쓰지 않는다 */
  | 'reject'
  /** 목적지는 맞는데 행동 화면이 아니다 — 더 나은 것을 못 찾으면 그때 쓴다 */
  | 'demote';

export type GateVerdict =
  | { ok: true; stage: GateStage; score: number; reasons: string[] }
  | { ok: false; severity: GateSeverity; score: number; reasons: string[] };

function textOf(html: string): string {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
}

/**
 * v3.8.571 — 200 을 주면서 "그런 페이지 없다"고 말하는 화면.
 *
 * ## 실측 근거 (2026-08-28)
 * 발행된 글에 이 주소가 버젓이 박혀 있었다:
 *   https://www.fss.or.kr/fss/cv/cnslt/disptMain.do?menuNo=200004
 *   → HTTP 200, 제목 "금융감독원 통합홈페이지- 에러페이지", 본문 82자
 *     "페이지가 없거나 잘못된 경로 입니다."
 *
 * 상태코드만 보는 검증은 이걸 못 잡는다. 홈 판정도 못 잡는다(경로가 있으니까).
 * 기관 검사도 못 잡는다 — **에러 페이지에도 기관 이름이 적혀 있다.**
 * 그래서 기관 검사보다 **먼저** 물어야 한다.
 *
 * ## demote 가 아니라 reject 인 이유
 * 홈은 최소한 진짜 목적지다("다시 찾아라"일 뿐). 에러 페이지는 목적지가 아니다.
 * 미뤄 뒀다가 나중에 쓰면 독자가 빈 화면을 본다. 버튼이 없는 편이 낫다.
 */
/** 이것만으로 확정 — 다른 뜻으로 쓰일 일이 없는 제목 */
const ERROR_TITLE_STRONG = /에러\s*페이지|오류\s*페이지|error\s*page|page\s*not\s*found|404\s*(error|not)/i;

/**
 * 홀로 선 "Error"·"오류" — 실측 제목이 이랬다("정책브리핑 - Error", "페이지 오류").
 * 다만 "오류 신고", "에러 코드 안내" 같은 멀쩡한 페이지도 있으므로
 * **본문이 짧을 때만** 에러로 본다.
 */
const ERROR_TITLE_WEAK = /(^|[\s\-–—|·:])(에러|오류|error)([\s\-–—|·:]|$)/i;

const ERROR_PAGE_TEXT =
  /페이지가 없거나|잘못된 경로|페이지를 찾을 수 없|요청하신 (페이지|자료|주소)|존재하지 않는 (페이지|주소)|삭제되었거나|서비스가 종료|일시적인 오류|Not Found|Bad Request|Access Denied|Forbidden/i;

/** 에러 화면은 짧다 — 실측 82자. 긴 페이지를 같은 낱말로 떨어뜨리면 멀쩡한 걸 버린다 */
const SHORT_BODY = 500;

export function looksLikeErrorPage(title: string, text: string): boolean {
  const t = String(title || '');
  const body = String(text || '').replace(/\s+/g, ' ').trim();
  if (ERROR_TITLE_STRONG.test(t)) return true;
  if (body.length >= SHORT_BODY) return false;   // 내용이 있으면 에러가 아니다
  return ERROR_TITLE_WEAK.test(t) || ERROR_PAGE_TEXT.test(body);
}

/**
 * 🔒 v3.8.688 — **조회 벽**. 제목은 "신청"인데 실물은 접수번호를 묻는 화면이다.
 *
 * ## 실측 근거 (2026-09-07)
 * 사장님 실물 검수: 하지정맥류 실손 입원 거절 글의 CTA 가 이 주소였다.
 *   https://www.fss.or.kr/fss/cvpl/ombdsmnDstrss/listCertification.do?menuNo=201100&viewType=MINWONBODY
 *   → HTTP 200, 제목 "금융감독원 **민원신청**", 본문은 이렇다:
 *     "민원접수번호 · 주민등록번호 · 성명 · 비밀번호 · 가상키패드 ·
 *      접수하신 민원에 대한 결과를 확인할 수 있습니다"
 *
 * 신청 화면이 아니라 **이미 접수한 건의 결과를 여는 인증 화면**이다.
 * 글을 읽고 온 독자에게는 넣을 접수번호가 없다 — 눌러도 아무것도 못 한다.
 *
 * ## 기존 검사가 왜 다 통과시켰나
 *   · 에러 페이지 아님 (멀쩡한 화면이다)
 *   · 기관 일치     (금융감독원 맞다)
 *   · 홈 아님        (경로가 깊다)
 *   · 행동 채점 +3   (**제목에 "민원신청"이 있다**) +2(입력 양식) +2(기관) = 7점
 * 채점기는 글자를 세므로 "제목은 신청, 실물은 조회"인 화면을 구별할 수 없다.
 *
 * ## 무엇을 신호로 삼나 — "독자가 갖고 있을 리 없는 번호"
 * 접수번호·처리번호를 **입력하라고 요구하는 것**만 본다. 로그인·인증서 요구는
 * 신호가 아니다(진짜 신청 화면도 그렇다 — LOGIN_WALL 주석 참고).
 * 좁게 잡는 이유: 넓게 잡으면 멀쩡한 조회 서비스(자격득실확인서 등)까지 버린다.
 */
const LOOKUP_WALL_MARKERS: RegExp[] = [
  /(민원|접수|신청|처리|상담|진정)\s*접수번호/,
  /접수번호[^가-힣]{0,6}(비밀번호|주민)/,
  /가상\s*키패드/,
  /비밀번호\s*(생성|찾기)/,
  /접수(하신|한)\s*(민원|신청|건)에\s*대한\s*(결과|처리)/,
];

/** 진짜 신청 화면에만 붙는 말 — 이게 있으면 조회 벽으로 보지 않는다 */
const REAL_APPLY_MARKERS = /신청하기|신청서\s*작성|온라인\s*신청|접수하기|작성\s*하기/;

/** 마커 하나로는 단정하지 않는다 — 두 개 이상 겹칠 때만 조회 벽이다 */
const LOOKUP_WALL_MIN_HITS = 2;

/**
 * 접수번호를 요구하는 조회·인증 화면인가.
 *
 * @param text  페이지 본문(태그를 벗긴 것도, 안 벗긴 것도 상관없다 — 한글만 본다)
 */
export function looksLikeLookupWall(text: string): boolean {
  const body = String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  if (REAL_APPLY_MARKERS.test(body)) return false;
  const hits = LOOKUP_WALL_MARKERS.filter((re) => re.test(body)).length;
  return hits >= LOOKUP_WALL_MIN_HITS;
}

/** <title> 만 뽑는다 — 에러 판정은 제목이 가장 정확했다 */
function titleOf(html: string): string {
  const m = String(html || '').match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i);
  return String(m?.[1] || '').replace(/\s+/g, ' ').trim();
}

/** 이 글이 지목한 기관과 같은 곳인가 — 주소로도, 페이지 글자로도 본다 */
function agencyHit(url: string, text: string, agencies: string[]): string | null {
  for (const agency of agencies) {
    const name = String(agency || '').trim();
    if (name.length < 2) continue;
    if (hostMatches(url, name) || text.includes(name)) return name;
  }
  return null;
}

/**
 * 목적지 검산. 실패해도 발행을 막지 않는다 — 판정만 돌려준다.
 *
 * @param intent   독자가 하려는 행동. null 이면 채점 기준이 없으므로 기관·홈 여부만 본다.
 * @param agencies 이 글이 지목한 기관 이름들(본문 빈출 기관 + 스마트 라우터가 정한 곳).
 *                 비어 있으면 기관 검사는 건너뛴다 — 없는 기준으로 떨어뜨리지 않는다.
 */
export async function gateCtaDestination(input: {
  url: string;
  keyword: string;
  intent: ActionIntent | null;
  agencies?: string[];
  fetchPage: PageFetcher;
}): Promise<GateVerdict> {
  const url = String(input.url || '').trim();
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, severity: 'reject', score: 0, reasons: ['주소 형식이 아님'] };
  }

  const agencies = (input.agencies || []).map((a) => String(a || '').trim()).filter((a) => a.length >= 2);

  // ① 파일 — 여기서는 아무것도 할 수 없다. 기관이 맞아도 행동 화면이 아니다.
  if (isDocumentUrl(url)) {
    return {
      ok: false,
      severity: 'demote',
      score: 0,
      reasons: ['문서 파일 주소 — 읽을 수는 있어도 그 자리에서 신청·조회를 할 수 없다'],
    };
  }

  let page: { ok: boolean; html: string; finalUrl?: string } | null = null;
  try {
    page = await input.fetchPage(url);
  } catch {
    page = null;
  }

  const finalUrl = String(page?.finalUrl || url);
  const home = looksLikeHomeUrl(finalUrl);

  // 페이지를 못 읽었다 — 주소 모양만으로 판단한다(못 읽었다는 이유로 떨어뜨리진 않는다)
  if (!page?.ok || !page.html) {
    if (home && input.intent) {
      return {
        ok: false,
        severity: 'demote',
        score: 0,
        reasons: ['페이지를 열지 못했고 주소가 기관 홈으로 보임 — 행동 화면을 먼저 찾는다'],
      };
    }
    return { ok: true, stage: 'guide', score: 0, reasons: ['페이지 확인 불가 — 주소 모양으로만 통과'] };
  }

  const text = textOf(page.html);

  /**
   * ①-b 살아있는 척하는 에러 페이지 — 기관 검사보다 먼저 묻는다.
   *   에러 화면에도 기관 이름이 박혀 있어 뒤에 두면 통과해버린다(실측 사례가 그랬다).
   */
  if (looksLikeErrorPage(titleOf(page.html), text)) {
    return {
      ok: false,
      severity: 'reject',
      score: 0,
      reasons: ['HTTP 200 이지만 "없는 페이지" 화면 — 눌러도 아무것도 못 한다'],
    };
  }

  /**
   * ①-c 🔒 v3.8.688 조회 벽 — 기관 검사보다 먼저 묻는다(에러 페이지와 같은 이유).
   *
   * demote 인 이유: 기관은 맞다. 그 기관 안에 진짜 신청 화면이 따로 있을 수 있으니
   * 검색에 한 번 더 기회를 준다. 그래도 못 찾으면 홈이 이 화면보다 낫다 —
   * 홈은 "다시 찾아라"이지만 이 화면은 "없는 번호를 넣어라"다.
   */
  if (looksLikeLookupWall(text)) {
    return {
      ok: false,
      severity: 'demote',
      score: 0,
      reasons: ['접수번호를 넣어야 열리는 조회·인증 화면 — 글을 읽고 온 독자에게는 그 번호가 없다'],
    };
  }

  /**
   * ①-d 📋 v3.8.694 목록·보도자료 — 읽을 거리이지 할 거리가 아니다.
   *
   * 실측에서 CTA 후보로 임실군 게시판 목록과 고용노동부 보도자료가 뽑혔다.
   * demote 인 이유는 홈과 같다 — 기관은 맞으니 더 나은 화면을 먼저 찾아보고,
   * 끝내 못 찾으면 그때 쓴다(버튼이 아예 없는 것보다는 낫다).
   */
  if (looksLikeListingPage(finalUrl, titleOf(page.html), text)) {
    return {
      ok: false,
      severity: 'demote',
      score: 0,
      reasons: ['게시판 목록·보도자료 화면 — 읽을 수는 있어도 그 자리에서 할 수 있는 일이 없다'],
    };
  }

  const hitAgency = agencies.length ? agencyHit(finalUrl, text, agencies) : null;

  // ② 기관 오배송 — 글이 지목한 기관이 있는데 그 흔적이 어디에도 없다
  //    (보험 글 → 국세청 홈. 이건 물러섬이 아니라 다른 데로 보내는 것이다)
  if (agencies.length && !hitAgency && home) {
    return {
      ok: false,
      severity: 'reject',
      score: 0,
      reasons: [`글이 지목한 기관(${agencies.join(', ')})과 다른 곳의 홈 — 오배송`],
    };
  }

  /**
   * ③-a 홈은 행동 화면이 아니다 — 점수와 무관하게 미룬다.
   *
   * 채점기는 홈에 -3 을 줄 뿐이라, 홈 화면에 "조회하기" 배너만 있어도 기준을 넘길 수 있다.
   * 사장님 요구는 "홈에 가서 다시 찾게 하지 말 것"이므로 여기서는 눈금이 아니라 규칙으로 막는다.
   * 버리는 게 아니라 미루는 것이다 — 검색이 더 나은 화면을 못 찾으면 이 주소로 돌아온다.
   */
  if (home && input.intent) {
    return {
      ok: false,
      severity: 'demote',
      score: 0,
      reasons: [`기관 홈 주소 — ${input.intent} 을(를) 하는 화면을 먼저 찾는다`],
    };
  }

  const tokens = keywordTokens(input.keyword);
  const hitTokens = tokens.filter((t) => text.includes(t)).length;
  const hasKeyword = tokens.length > 0 && hitTokens >= Math.ceil(tokens.length / 2);

  // 행동을 못 읽었으면 채점 기준이 없다 — 주제어와 홈 여부만 본다
  if (!input.intent) {
    if (home && !hasKeyword) {
      return {
        ok: false,
        severity: 'demote',
        score: 0,
        reasons: ['기관 홈이고 이 글의 주제어도 없음 — 더 가까운 화면을 먼저 찾는다'],
      };
    }
    /**
     * 🎯 v3.8.694 — 행동을 못 읽은 글에서 **아무 딥링크나 'action' 이 되던 구멍.**
     *
     * 실측(2026-09-07): 노동부 파업 지침 글의 CTA 후보로 **보도자료**
     * (`moel.go.kr/news/enews/report/enewsView.do?news_seq=…`)가 뽑혔고,
     * 판정은 `action` 인데 **점수는 0점**이었다. 홈만 아니면 무엇이든 action 이었기 때문이다.
     *
     * 'action' 은 "여기서 그 일이 된다"는 약속이다. 행동을 읽지 못했고 주제어도 없으면
     * 그 약속을 할 근거가 하나도 없다 — guide(안내 화면)까지가 정직하다.
     */
    return {
      ok: true,
      stage: (home || !hasKeyword) ? 'guide' : 'action',
      score: hasKeyword ? 2 : 0,
      reasons: [hasKeyword
        ? `주제어 ${hitTokens}/${tokens.length} 일치`
        : '행동도 주제어도 못 읽음 — 행동 화면이라고 말할 근거가 없다'],
    };
  }

  // ③ 행동 화면인가 — 기존 채점기를 그대로 쓴다(두 경로가 같은 눈금을 쓰게)
  const scored = scoreActionPage({
    url: finalUrl,
    html: page.html,
    keyword: input.keyword,
    intent: input.intent,
    agencies,
  });

  /**
   * 🎯 v3.8.688 — 주제어가 **하나도** 없으면 'action' 으로 올리지 않는다.
   *
   * 실측(하지정맥류 실손 글)에서 이 구멍으로 금감원 민원조회 화면이 통과했다.
   *   주제어 0 + 행동 문구 3 + 기관 2 = 5점 → 문턱(4)을 넘는다.
   * 즉 **이 글과 아무 상관 없는 페이지도 "그 기관의 신청 화면"이기만 하면 통과했다.**
   * 채점표에서 주제어는 3점짜리 항목일 뿐이라 나머지 둘로 메워지기 때문이다.
   *
   * 버리지 않고 guide 로 낮춘다 — 기관은 맞으니 최후 후보로는 남긴다.
   * (홈이면 앞의 ③-a 에서 이미 걸러졌으므로 여기 오는 건 깊은 주소다.)
   */
  if (scored.score >= ACTION_THRESHOLD && !scored.hasKeyword) {
    return {
      ok: true,
      stage: 'guide',
      score: scored.score,
      reasons: [...scored.reasons, '이 글의 주제어가 페이지에 하나도 없음 — 행동 화면으로 단정하지 않는다'],
    };
  }
  if (scored.score >= ACTION_THRESHOLD) {
    return { ok: true, stage: 'action', score: scored.score, reasons: scored.reasons };
  }
  if (scored.score >= GUIDE_THRESHOLD && !home) {
    // 신청 화면은 아니어도 그 제도를 설명하는 페이지 — 홈보다 한 걸음 가깝다
    return { ok: true, stage: 'guide', score: scored.score, reasons: scored.reasons };
  }
  return {
    ok: false,
    severity: 'demote',
    score: scored.score,
    reasons: [...scored.reasons, `${input.intent} 을(를) 할 수 있는 화면이라고 보기 어려움 — 검색으로 다시 찾는다`],
  };
}
