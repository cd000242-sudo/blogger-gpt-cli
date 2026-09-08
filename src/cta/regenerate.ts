/**
 * regenerate — 이미 있는 글의 CTA 를 **글을 다시 읽고** 새로 정한다. (v3.8.688)
 *
 * ## 왜 만드는가
 * 사장님: "미리보기 수정에서도 글 다시 생성이랑 이미지 다시 생성 옆에
 *          CTA 다시 생성을 추가해"
 *
 * 발행 때 한 번 정해진 CTA 가 틀렸을 때(실측: 하지정맥류 글이 금융감독원 민원조회로
 * 나갔다) 지금은 고칠 방법이 **글을 통째로 다시 만드는 것뿐**이다. 본문은 멀쩡한데
 * 버튼 하나 때문에 글을 새로 쓰는 건 낭비고, 새로 쓴 글이 더 나으리란 보장도 없다.
 *
 * ## 판단의 순서 — 발행 경로와 같다
 *   ① 이 글이 무슨 행동을 하러 가는 글인가 (제목 → 안 나오면 본문)
 *   ② 이 글이 지목한 기관은 어디인가       (본문에서 읽는다)
 *   ②-b 그 기관의 **실제 호스트**는 무엇인가 (agency-registry — v3.8.706)
 *   ③ 그 행동을 하는 화면을 검색으로 찾는다
 *   ④ 후보를 열어 **게이트로 검산한다**    ← 조회 벽·주제어 0·문서·에러·홈을 전부 본다
 *      기관 호스트의 후보를 **먼저** 연다. 거기에 없으면 한 번 더 검색하고, 그래도 없으면
 *      그 기관 홈(guide). 다른 호스트는 마지막이고 guide 까지만 올라간다.
 *
 * ## 목적지를 코드에 박지 않는다
 * 사장님: "하드코딩시키지말고 그때그때 추론해서 판단해서 넣게해야지 범용적이지 못하잖아"
 * 이 모듈에는 기관 목록도, 주소도 없다. AI(smart-cta)가 **이름**을 정하고, 검색이
 * 실주소를 찾고, 게이트가 검산한다. AI 호출은 이 모듈 밖에서 한다 —
 * 그래야 판단부가 네트워크·모델 없이 테스트된다(이 저장소의 기존 규칙).
 *
 * ## v3.8.706 — 왜 기관 호스트를 먼저 보나 (2026-09-07 실측 15주제)
 * AI 는 "정부24"·"동물보호관리시스템"·"아이사랑" 이라고 **맞게** 정했는데, 검색 결과 중
 * 그 기관이 아닌 금천구청·부산시청·서울시 페이지가 먼저 게이트를 넘어 나갔다.
 * 후보가 지목 기관의 호스트인지 아무도 안 봤기 때문이다.
 */
import type { ActionIntent } from './action-intent';
import { detectActionIntent, detectActionIntentFromArticle, buildActionQuery } from './action-intent';
import { analyzeArticleContext, keywordTokens } from './action-link-harness';
import type { PageFetcher } from './action-link-harness';
import { gateCtaDestination } from './destination-gate';
import { judgeCtaHost } from './host-trust';
import { resolveAgencyHost, isOnHost } from './agency-registry';
import type { AgencyEntry } from './agency-registry';

/** AI 가 정한 목적지 — smart-cta 의 결과 (순환 import 을 피해 구조만 적는다) */
export interface SmartTargetLike {
  site: string;
  action: string;
  buttonLabel: string;
  hookMessage?: string;
  searchQuery: string;
  /** v3.8.706 — 목적지 화면에 꼭 있어야 하는 낱말 */
  mustHave?: string[];
}

export type CtaSearcher = (query: string) => Promise<Array<{ url: string; title: string }>>;

export interface RegenerateCtaInput {
  /** 글 제목 — 행동과 주제어를 여기서 먼저 읽는다 */
  keyword: string;
  /** 편집기의 본문 전체(태그를 벗긴 글자). 발췌가 아니라 **전문**을 준다 */
  articleText: string;
  search: CtaSearcher;
  fetchPage: PageFetcher;
  /** AI 가 정한 목적지. 없으면 제목·본문만으로 검색어를 만든다 */
  smartTarget?: SmartTargetLike | null;
  /**
   * v3.8.706 — AI 가 "이 글엔 다음 행동이 없다"고 판정했다(레시피·여행 감상).
   * true 면 검색하지 않고 `none: true` 로 돌려준다 — 억지 기관을 붙이지 않는다.
   */
  noDestination?: boolean;
  /** 지금 글에 이미 있는 주소 — 같은 곳을 다시 고르면 "다시 생성"이 아니다 */
  skipUrls?: string[];
  /** 열어 볼 후보 수 상한 — 사장님이 버튼을 누르고 기다리는 시간이다 */
  maxProbe?: number;
  onLog?: (message: string) => void;
}

export interface RegeneratedCta {
  url: string;
  /** action=그 행동을 하는 화면 · guide=제도 안내 화면 */
  stage: 'action' | 'guide';
  score: number;
  reasons: string[];
  /** 검색 결과에 적혀 있던 제목 — 문구를 지을 때 쓴다 */
  title: string;
}

export interface RegenerateCtaResult {
  ok: boolean;
  picked: RegeneratedCta | null;
  /** 왜 이렇게 됐는지 — 화면에 그대로 보여 준다. 조용히 실패하지 않는다 */
  log: string[];
  intent: ActionIntent | null;
  agencies: string[];
  query: string;
  /** v3.8.706 — AI 판정이 "CTA 없음"이었다. 실패가 아니다 */
  none?: boolean;
  /** v3.8.706 — 레지스트리가 확인한 지목 기관 호스트 */
  preferredHost?: string | undefined;
}

/** 같은 주소인가 — 쿼리스트링·꼬리 슬래시 차이는 같은 것으로 본다 */
function urlKey(url: string): string {
  try {
    const u = new URL(String(url));
    return `${u.host}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return String(url || '').trim().toLowerCase();
  }
}

interface Candidate { url: string; title: string }

/** action 이 guide 보다, 같은 단계면 점수가 높은 쪽이 낫다 */
function better(a: RegeneratedCta | null, b: RegeneratedCta): boolean {
  if (!a) return true;
  if (a.stage !== b.stage) return b.stage === 'action';
  return b.score > a.score;
}

/**
 * CTA 를 다시 정한다.
 *
 * 못 찾으면 `picked: null` 을 돌려준다 — **기존 버튼을 지우지 않는다.**
 * 틀린 버튼보다 나쁜 건 버튼이 사라지는 것이다(사장님: "버튼을 눌러야 광고 수익이 난다").
 * 지울지 말지는 부르는 쪽이 정한다.
 */
export async function regenerateCta(input: RegenerateCtaInput): Promise<RegenerateCtaResult> {
  const log: string[] = [];
  const say = (m: string) => { log.push(m); input.onLog?.(m); };

  const keyword = String(input.keyword || '').trim();
  const articleText = String(input.articleText || '');
  const maxProbe = Math.max(1, Math.min(input.maxProbe ?? 6, 10));

  // ① 무슨 행동을 하러 가는 글인가 — 제목에 없으면 본문에서 읽는다 (v3.8.571 과 같은 규칙)
  const intent = detectActionIntent(keyword) || detectActionIntentFromArticle(articleText);

  // ② 이 글이 지목한 기관 — 게이트의 오배송 판정 기준이 된다
  const ctx = analyzeArticleContext({ keyword, content: articleText, intent });
  const agencies = ctx.agencies;
  say(`이 글의 행동: ${intent || '못 읽음'} · 지목한 기관: ${agencies.join(', ') || '없음'}`);

  if (input.noDestination) {
    say('AI 판정: 이 글에는 독자가 바로 할 행동이 없습니다 — 외부 버튼을 붙이지 않습니다.');
    return { ok: false, picked: null, log, intent, agencies, query: '', none: true };
  }

  // ②-b 지목 기관의 실제 호스트 — 사전에 있으면 0회, 없으면 검색 1~2회 뒤 배운다
  const site = String(input.smartTarget?.site || '').trim();
  let preferred: AgencyEntry | null = null;
  /** 기준이 된 이름 — 둘째 검색어("이름 주제어")에 쓴다 */
  let preferredName = site;
  /** 'site' = AI 가 정한 서비스 이름을 사전이 풀었다(강한 기준) · 'article' = 글이 지목한 기관으로 대신했다(약한 기준) */
  let preferredFrom: 'site' | 'article' | null = null;
  if (site) {
    preferred = await resolveAgencyHost({ name: site, search: input.search, fetchPage: input.fetchPage, onLog: say });
    if (preferred) preferredFrom = 'site';
    say(preferred
      ? `지목 기관 호스트: ${site} → ${preferred.host} (${preferred.source})`
      : `지목 기관 호스트를 모름: ${site}`);
  }
  /**
   * 서비스 이름("금융민원센터")은 사전이 못 풀어도 글이 지목한 기관("금융감독원")은 풀린다 — 2026-09-08 실측:
   * 이 후퇴가 없으면 기준 없이 판정해 easylaw 안내글로 갔다. 다만 글의 기관은 AI 가 정한 목적지와 다를 수 있으니
   * **약한 기준**이다 — 다른 호스트의 행동 화면이 나오면 그쪽이 이긴다(아래 ⑤).
   * AI 가 목적지를 정하지 않은 글(site 없음)에는 하지 않는다 — 그 경로는 못 찾으면 null 이라야 기존 버튼이 산다(약속 ①).
   */
  if (site && !preferred) {
    for (const agency of agencies.slice(0, 2)) {
      const entry = await resolveAgencyHost({ name: agency, search: input.search, fetchPage: input.fetchPage, onLog: say });
      if (!entry) continue;
      preferred = entry;
      preferredName = agency;
      preferredFrom = 'article';
      say(`글이 지목한 기관을 기준으로: ${agency} → ${entry.host} (${entry.source}) — 약한 기준`);
      break;
    }
    if (!preferred) say('기관 기준 없이 판정합니다');
  }
  const trustedHosts = preferred ? [preferred.host] : [];
  const mustHave = input.smartTarget?.mustHave;

  // ③ 검색어 — AI 가 목적지를 정했으면 그 이름으로, 아니면 제목+행동으로
  const query = input.smartTarget?.searchQuery?.trim() || buildActionQuery(keyword, intent);
  say(`검색어: ${query}`);

  const fail = (): RegenerateCtaResult => ({
    ok: false, picked: null, log, intent, agencies, query, preferredHost: preferred?.host,
  });

  let results: Array<{ url: string; title: string }> = [];
  try {
    results = await input.search(query);
  } catch (e: any) {
    say(`검색 실패: ${String(e?.message || e).slice(0, 80)}`);
    return fail();
  }
  if (!results.length) {
    say('검색 결과가 없습니다.');
    return fail();
  }

  const skip = new Set((input.skipUrls || []).map(urlKey).filter(Boolean));
  const seen = new Set<string>();
  const toCandidates = (items: Array<{ url: string; title: string }>): Candidate[] => items
    .map((r) => ({ url: String(r?.url || '').trim(), title: String(r?.title || '') }))
    .filter((r) => /^https?:\/\//i.test(r.url))
    .filter((r) => {
      const key = urlKey(r.url);
      if (!key || skip.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    // 블로그·검색엔진·리다이렉터를 여기서 턴다 — 열어 보는 시간을 아낀다
    .filter((r) => {
      const verdict = judgeCtaHost(r.url, keyword, agencies, r.title, { trustedHosts });
      if (!verdict.ok) say(`제외 ${r.url} — ${verdict.reason}`);
      return verdict.ok;
    });

  const first = toCandidates(results);
  let onHost = preferred ? first.filter((c) => isOnHost(c.url, preferred!.host)) : first;
  const offHost = preferred ? first.filter((c) => !isOnHost(c.url, preferred!.host)) : [];

  /**
   * 기관 호스트의 후보가 하나도 없다 — 검색어가 기관 이름을 못 살렸을 수 있다.
   * `"${기관} ${주제어}"` 로 한 번 더 찾는다 (예: "정부24 여권 재발급").
   */
  if (preferred && onHost.length === 0) {
    const topic = keywordTokens(keyword).slice(0, 2).join(' ');
    const secondQuery = `${preferredName} ${topic}`.trim();
    if (secondQuery !== query) {
      say(`기관 호스트 후보가 없어 다시 검색: ${secondQuery}`);
      try {
        const more = await input.search(secondQuery);
        onHost = toCandidates(more).filter((c) => isOnHost(c.url, preferred!.host));
      } catch (e: any) {
        say(`두 번째 검색 실패: ${String(e?.message || e).slice(0, 80)}`);
      }
    }
  }

  if (!onHost.length && !offHost.length && !preferred) {
    say('믿을 만한 후보가 없습니다 (블로그·검색결과 페이지만 나왔습니다).');
    return fail();
  }

  /**
   * ④ 후보를 열어 게이트로 검산한다.
   *
   * 채점기(scoreActionPage)를 직접 부르지 않고 게이트를 쓰는 이유:
   * 게이트에만 있는 검사가 있다 — 조회 벽(v3.8.688)·문서 파일·200 에러 페이지·홈.
   * 두 벌로 재면 한쪽만 고쳐지고 어긋난다(이 저장소가 반복해서 겪은 실수다).
   */
  let probes = 0;
  const probe = async (list: Candidate[], label: string): Promise<RegeneratedCta | null> => {
    let best: RegeneratedCta | null = null;
    for (const c of list) {
      if (probes >= maxProbe) { say(`열어 볼 수 있는 후보 수(${maxProbe})를 다 썼습니다.`); break; }
      probes += 1;
      const verdict = await gateCtaDestination({
        url: c.url,
        keyword,
        intent,
        agencies,
        fetchPage: input.fetchPage,
        mustHave,
        // 약한 기준(글의 기관)은 게이트에 주지 않는다 — 주면 다른 호스트가 전부 guide 로 깎여 행동 화면이 이길 길이 없다
        preferredHost: preferredFrom === 'site' ? preferred?.host : undefined,
      });

      if (!verdict.ok) {
        say(`✗ ${c.url} — ${verdict.reasons[0] || verdict.severity}`);
        continue;
      }

      const found: RegeneratedCta = {
        url: c.url,
        stage: verdict.stage,
        score: verdict.score,
        reasons: verdict.reasons,
        title: c.title,
      };
      say(`✓ ${c.url} — ${verdict.stage} ${verdict.score}점 (${label})`);

      // 행동 화면이면 더 볼 것 없다. 안내 화면은 일단 쥐고 더 나은 걸 찾는다.
      if (verdict.stage === 'action') { best = found; break; }
      if (better(best, found)) best = found;
    }
    return best;
  };

  // 기관 호스트 먼저
  let picked = await probe(onHost, preferred ? '지목 기관 호스트' : '후보');

  // 기관 홈 — 행동 화면은 못 찾았어도 그 기관으로 보내는 것이 다른 기관 딥링크보다 맞다
  const agencyHome = (): RegeneratedCta | null => {
    if (!preferred || skip.has(urlKey(preferred.url))) return null;
    say(`↳ 기관 홈으로: ${preferred.url}`);
    return {
      url: preferred.url,
      stage: 'guide',
      score: 1,
      reasons: [`지목 기관(${preferredName}) 홈 — 그 안에서 ${intent || '필요한 일'} 화면을 못 찾아 홈으로 보냅니다`],
      title: preferredName,
    };
  };

  // AI 가 정한 서비스가 풀렸으면(강한 기준) 그 홈이 다른 호스트의 어떤 화면보다 먼저다
  if (!picked && preferredFrom === 'site') picked = agencyHome();

  /**
   * ⑤ 다른 호스트는 기관 쪽에 **아무것도** 없을 때만 — 게이트가 preferredHost 로 guide 까지만 올려 준다.
   * 글의 기관으로 대신한 약한 기준이면: 다른 호스트의 **행동 화면**은 받고, 안내 화면뿐이면 기관 홈이 낫다.
   */
  if (!picked) {
    const other = await probe(offHost, '다른 호스트');
    picked = other && (other.stage === 'action' || preferredFrom !== 'article') ? other : (agencyHome() || other);
  }

  if (!picked) {
    say('열어본 후보 중 이 글에 맞는 화면이 없습니다 — 기존 버튼을 그대로 둡니다.');
    return fail();
  }

  return { ok: true, picked, log, intent, agencies, query, preferredHost: preferred?.host };
}
