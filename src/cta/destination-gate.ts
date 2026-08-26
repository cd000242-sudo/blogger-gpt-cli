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
import { scoreActionPage, looksLikeHomeUrl, hostMatches, keywordTokens } from './action-link-harness';
import type { PageFetcher } from './action-link-harness';

/** 문서·압축 파일 확장자 — 브라우저가 열어도 "행동"은 못 하는 것들 */
const DOCUMENT_EXT =
  /\.(pdf|ppt|pptx|pps|ppsx|key|hwp|hwpx|xlsx|xls|ods|csv|tsv|zip|rar|7z|docx|doc|odt|rtf|pages|numbers)(\?|#|$)/i;

/** 주소가 문서 파일을 가리키는가 */
export function isDocumentUrl(url: string): boolean {
  return DOCUMENT_EXT.test(String(url || ''));
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
    return {
      ok: true,
      stage: home ? 'guide' : 'action',
      score: hasKeyword ? 2 : 0,
      reasons: [hasKeyword ? `주제어 ${hitTokens}/${tokens.length} 일치` : '주제어 확인 못 함(행동 없는 글)'],
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
