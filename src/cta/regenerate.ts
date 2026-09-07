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
 *   ③ 그 행동을 하는 화면을 검색으로 찾는다
 *   ④ 후보를 열어 **게이트로 검산한다**    ← 조회 벽·주제어 0·문서·에러·홈을 전부 본다
 *
 * ## 목적지를 코드에 박지 않는다
 * 사장님: "하드코딩시키지말고 그때그때 추론해서 판단해서 넣게해야지 범용적이지 못하잖아"
 * 이 모듈에는 기관 목록도, 주소도 없다. AI(smart-cta)가 **이름**을 정하고, 검색이
 * 실주소를 찾고, 게이트가 검산한다. AI 호출은 이 모듈 밖에서 한다 —
 * 그래야 판단부가 네트워크·모델 없이 테스트된다(이 저장소의 기존 규칙).
 */
import type { ActionIntent } from './action-intent';
import { detectActionIntent, detectActionIntentFromArticle, buildActionQuery } from './action-intent';
import { analyzeArticleContext } from './action-link-harness';
import type { PageFetcher } from './action-link-harness';
import { gateCtaDestination } from './destination-gate';
import { judgeCtaHost } from './host-trust';

/** AI 가 정한 목적지 — smart-cta 의 결과 (순환 import 을 피해 구조만 적는다) */
export interface SmartTargetLike {
  site: string;
  action: string;
  buttonLabel: string;
  hookMessage?: string;
  searchQuery: string;
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

  // ③ 검색어 — AI 가 목적지를 정했으면 그 이름으로, 아니면 제목+행동으로
  const query = input.smartTarget?.searchQuery?.trim() || buildActionQuery(keyword, intent);
  say(`검색어: ${query}`);

  let results: Array<{ url: string; title: string }> = [];
  try {
    results = await input.search(query);
  } catch (e: any) {
    say(`검색 실패: ${String(e?.message || e).slice(0, 80)}`);
    return { ok: false, picked: null, log, intent, agencies, query };
  }
  if (!results.length) {
    say('검색 결과가 없습니다.');
    return { ok: false, picked: null, log, intent, agencies, query };
  }

  const skip = new Set((input.skipUrls || []).map(urlKey).filter(Boolean));
  const seen = new Set<string>();
  const candidates = results
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
      const verdict = judgeCtaHost(r.url, keyword, agencies, r.title);
      if (!verdict.ok) say(`제외 ${r.url} — ${verdict.reason}`);
      return verdict.ok;
    })
    .slice(0, maxProbe);

  if (!candidates.length) {
    say('믿을 만한 후보가 없습니다 (블로그·검색결과 페이지만 나왔습니다).');
    return { ok: false, picked: null, log, intent, agencies, query };
  }

  /**
   * ④ 후보를 열어 게이트로 검산한다.
   *
   * 채점기(scoreActionPage)를 직접 부르지 않고 게이트를 쓰는 이유:
   * 게이트에만 있는 검사가 있다 — 조회 벽(v3.8.688)·문서 파일·200 에러 페이지·홈.
   * 두 벌로 재면 한쪽만 고쳐지고 어긋난다(이 저장소가 반복해서 겪은 실수다).
   */
  let best: RegeneratedCta | null = null;
  for (const c of candidates) {
    const verdict = await gateCtaDestination({
      url: c.url,
      keyword,
      intent,
      agencies,
      fetchPage: input.fetchPage,
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
    say(`✓ ${c.url} — ${verdict.stage} ${verdict.score}점`);

    // 행동 화면이면 더 볼 것 없다. 안내 화면은 일단 쥐고 더 나은 걸 찾는다.
    if (verdict.stage === 'action') { best = found; break; }
    if (!best) best = found;
  }

  if (!best) {
    say('열어본 후보 중 이 글에 맞는 화면이 없습니다 — 기존 버튼을 그대로 둡니다.');
    return { ok: false, picked: null, log, intent, agencies, query };
  }

  return { ok: true, picked: best, log, intent, agencies, query };
}
