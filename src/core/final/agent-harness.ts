/**
 * agent-harness — 에이전트 모드가 API 경로와 **같은 규칙**을 쓰게 만든다.
 *
 * ## 왜 필요한가
 * 에이전트 모드는 orchestration 을 타지 않는다. electron/main.ts 안에 손으로 쓴
 * 별도 프롬프트가 있고, 외부 CLI 에게 그것만 준다. 그래서 그동안 쌓아온 규칙이
 * **하나도 적용되지 않았다.**
 *   · 제목 규칙   → "50~60자, 검색 친화" 한 줄이 전부
 *   · 문체 규칙   → 없음
 *   · 알맹이 규칙 → 없음
 *   · 후처리      → 없음
 * 사용자 지적: "에이전트모드는 지금까지 수정한거 하나도 적용이 안되어있네",
 *              "제목뿐만 아니라 본문내용과 소제목도 그냥 내가 이 글을 읽을 이유가 없어요".
 *
 * ## 설계
 * 규칙 문구를 여기서 **다시 쓰지 않는다.** 원본 모듈에서 가져와 이어 붙인다.
 * 복사해두면 한쪽만 고쳐지고 엔진에 따라 품질이 조용히 갈린다.
 */
import { HUMAN_VOICE_RULES } from './lived-voice';
import { autoRepairBeforePublish, describeRepairs } from './auto-repair';
import { SUBSTANCE_FIRST_PASS_RULES, FRESHNESS_RULES } from './substance-rules';
import { DECISION_SUPPORT_RULES } from './decision-support';
import { NO_EXPERIENCE_GUARD } from './experience-block';
import { buildArchetypeGuide } from './title-archetypes';
import { stripTitleCliches, dedupeKeywordInTitle, enforceTitleLength } from './generation';
import { findEmptyBlocks, describeEmptyBlocks, dropEmptyFaqItems } from './empty-block-guard';
import { findValuePromises } from './value-promise';
import { isDiscoverMode, buildDiscoverTitleDirective, buildDiscoverBodyBlock, findDiscoverTitleViolations, findDiscoverHeadingIssues } from './discover-mode';
import { buildModeStructureBlock } from './agent-mode-structure';
import { findUnkeptTitleClaims, stripUnkeptClaims, describeUnkeptClaims } from './title-claim-check';
import { buildResearchDirective } from './agent-research';
import { buildOperatorBrief, MODE_LABELS } from './agent-operator';
// v3.8.577: API 경로와 같은 눈으로 본다 — 둘 다 무료 로컬 연산이라 에이전트 모드에 써도 된다
import { findStructureIssues } from './structure-guard';
import { hasAdTracking, isUserGeneratedUrl } from '../../cta/host-trust';

export interface AgentHarnessInput {
  keyword: string;
  currentYear: number;
  /** 검색자가 실제로 던진 질문들 — 있으면 제목·소제목 재료로 준다 */
  demandQuestions?: string[];
  /** 'discover' 면 제목·본문 규칙을 피드 기준으로 갈아끼운다 */
  contentMode?: string;
  /**
   * 무료로 모은 근거 장부 (v3.8.583).
   * 없으면 예전과 똑같이 동작한다 — 에이전트가 스스로 찾아 쓴다.
   */
  evidence?: string;
}

/**
 * 근거 장부를 지시서에 싣는다. (v3.8.583)
 *
 * ## 왜 필요했나
 * 에이전트 모드는 `orchestration` 을 타지 않는다. 그래서 API 경로가 모으는 것들이
 * **하나도 넘어가지 않았다** — 크롤링 21건도, 네이버 근거 23건도, 팩트체크도.
 * 넘어가는 건 키워드·연도·수요질문·모드뿐이었다.
 *
 * 에이전트가 스스로 검색은 하지만, 우리가 만든 검증(뉴스 우선 · 블로그 순위 필터 ·
 * 기관 원문 · 첨부파일 배제)은 하나도 적용되지 않은 자료로 쓰는 셈이다.
 *
 * 네이버 근거는 **공짜**이고 구독 CLI 도 **공짜**다. 둘을 합치면 ₩0 에 검증까지 된다 —
 * 사장님이 원한 그림이 정확히 이것이다.
 *
 * ## 왜 "참고"가 아니라 "숫자를 옮겨라"인가
 * 실속 게이트 점수의 **절반(50점)이 팩트 밀도**다(1,000자당 6개 기준).
 * 실측에서 근거엔 수치가 25개 있는데 본문엔 3개만 들어간 적이 있다.
 * 장부를 주면서 "참고하라"고만 하면 모델은 요약하고 숫자를 버린다.
 */
function buildEvidenceBlock(evidence?: string): string {
  const text = String(evidence || '').trim();
  if (!text) return '';

  return [
    '## 📚 앱이 미리 모아 둔 근거 (검증된 출처만)',
    '',
    '아래는 뉴스·공공기관 문서·상위 노출 블로그에서 모은 것이다.',
    '블로그·카페 중 순위가 낮은 것, 첨부파일, 광고 랜딩은 이미 걸러 냈다.',
    '',
    '**쓰는 법**',
    '- 여기 있는 **금액·기한·비율·기관명은 그대로 옮겨 쓴다.** 요약하면서 숫자를 빼지 않는다.',
    '  숫자가 빠진 문장은 정보가 아니라 인상이다.',
    '- `[뉴스]`·`[공식]` 이 붙은 것이 `[블로그]` 보다 우선한다. 숫자가 엇갈리면 앞의 것을 쓴다.',
    '- 여기 없는 수치는 **직접 검색해 확인한 뒤에만** 쓴다. 확인 못 하면 쓰지 않는다.',
    '- 이 장부가 주제를 다 덮지 못하면 스스로 더 찾아본다 — 이건 출발점이지 전부가 아니다.',
    '',
    '```',
    text.slice(0, 12000),
    '```',
    '',
  ].join('\n');
}

/**
 * 제목 지시문. API 경로와 같은 아키타입을 쓰고, 키워드 복창을 명시적으로 막는다.
 *
 * 사용자 보고: "제목도 자동생성으로 선택했는데 자동생성 안 하고 키워드 그대로 나오는 버그".
 * 원인의 절반은 지시가 약해서다 — "검색 친화" 라고만 하면 모델은 키워드를 그대로 쓴다.
 */
function buildTitleRules(input: AgentHarnessInput): string {
  const { keyword, currentYear, demandQuestions } = input;
  const questions = (demandQuestions || []).filter(Boolean).slice(0, 8);

  /**
   * 디스커버는 검색이 아니다. 독자가 검색하지 않았고, 관심사에 맞아 피드에 뜬 카드를
   * 제목만 보고 누른다. 그래서 규칙이 검색용과 정반대다 — 검색용은 키워드를 앞세우지만
   * 디스커버는 결론을 담아야 하고 낚시를 금지한다.
   * 둘을 함께 주면 서로 어긋나므로 **통째로 갈아끼운다.**
   */
  if (isDiscoverMode(input.contentMode)) {
    return [
      '',
      buildDiscoverTitleDirective(currentYear),
      questions.length
        ? [
          '',
          '📥 **독자들이 이 주제에서 실제로 궁금해한 것입니다. 본문 소제목 재료로 쓰세요.**',
          ...questions.map((q) => `   · ${q}`),
        ].join('\n')
        : '',
    ].filter((line) => line !== '').join('\n');
  }

  return [
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '📌 **[제목 — 다른 어떤 규칙보다 먼저 지킵니다]**',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    `⚠️ **제목을 키워드 "${keyword}" 와 똑같이 쓰지 마세요.** 키워드를 그대로 옮겨 적는 것은 실패입니다.`,
    '   키워드는 검색창에 치는 말이고, 제목은 그 사람이 **무엇 때문에 검색했는지**를 담아야 합니다.',
    '',
    '1. 제목에 **검색한 사람이 처한 상황이나 겪는 문제**를 넣으세요.',
    '   경쟁이 센 넓은 말로 싸우지 말고, 좁고 구체적인 상황으로 들어갑니다.',
    `     ✗ "${keyword}"                      (키워드 복창 — 금지)`,
    `     ✗ "${keyword} 총정리 / 완벽 가이드"  (누구나 쓰는 상투어 — 금지)`,
    `     ✓ "${keyword}, 등본 유효기간 때문에 반려되는 경우"  (실제로 막히는 지점)`,
    '',
    '2. 아래 형태 중 하나를 고르세요. **예시 문구를 베끼지 말고 형태만 참고합니다.**',
    buildArchetypeGuide(currentYear),
    '',
    '3. 40자 이내. 이모지·특수문자로 끝맺지 않습니다.',
    `4. ${currentYear}년 기준으로 씁니다. 지난 연도 조건을 쓰지 않습니다.`,
    '5. 키워드는 제목 앞쪽에 자연스럽게 한 번만 넣습니다. 두 번 반복하지 않습니다.',
    '6. **제목에 개수를 약속하지 마세요** ("용어 20개", "방법 7가지"). 글이 실제로 그만큼 담을 때만 쓸 수 있습니다.',
    '   금액·기간·비율도 근거로 확인된 값만 씁니다. 확인 못 했으면 숫자 없이 씁니다.',
    '',
    questions.length
      ? [
        '📥 **검색한 사람들이 실제로 던진 질문입니다. 제목과 소제목의 1순위 재료로 쓰세요.**',
        ...questions.map((q) => `   · ${q}`),
      ].join('\n')
      : '',
    '',
  ].filter((line) => line !== '').join('\n');
}

/**
 * 에이전트 지시서에 붙일 규칙 뭉치.
 * API 경로가 쓰는 것과 같은 원본을 이어 붙인다.
 */
export function buildAgentHarnessRules(input: AgentHarnessInput): string {
  return [
    /**
     * v3.8.487 — 어떻게 읽을지를 먼저 정해준다.
     * 규칙 뭉치보다 앞에 와야 한다 — 읽는 방식이 달라져야 규칙이 살아난다.
     */
    buildOperatorBrief({
      keyword: input.keyword,
      modeLabel: MODE_LABELS[String(input.contentMode || '').toLowerCase()],
    }),
    /**
     * v3.8.487 — 먼저 찾아보고 쓰라고 시킨다.
     * 에이전트는 스스로 웹을 검색할 수 있는데 지시서에 그 말이 한 줄도 없었다.
     * 주제만 던지면 모델이 아는 것만으로 쓴다 — 그게 "누구나 아는 내용" 의 원인이다.
     */
    buildResearchDirective(input),
    /**
     * v3.8.583 — 앱이 모은 근거를 **검색 지시 바로 뒤에** 놓는다.
     * 순서가 중요하다. "찾아보라"고 한 다음 "여기 이미 모아 뒀다"가 와야
     * 에이전트가 이걸 출발점으로 삼고 모자란 데만 더 찾는다.
     */
    buildEvidenceBlock(input.evidence),
    /**
     * v3.8.487 — 이 모드가 어떤 글인지 알려준다.
     * 구성을 여기서 다시 적지 않고 mode-registry(API 경로가 쓰는 그것)에서 읽는다.
     */
    buildModeStructureBlock(String(input.contentMode || ''), input.keyword),
    buildTitleRules(input),
    // 디스커버는 본문 규칙도 피드 기준으로 다르다 (첫 화면에서 결론을 주고, 스크롤을 미끼로 쓰지 않는다)
    isDiscoverMode(input.contentMode) ? buildDiscoverBodyBlock(input.currentYear) : '',
    SUBSTANCE_FIRST_PASS_RULES,
    HUMAN_VOICE_RULES,
    DECISION_SUPPORT_RULES,
    FRESHNESS_RULES,
    NO_EXPERIENCE_GUARD,
    /**
     * 쇼핑 글에서 에이전트가 만든 상품 링크는 100% 죽은 링크다.
     * 실제 제휴링크는 글을 받은 뒤 앱이 쿠팡 파트너스로 만들어 붙인다.
     */
    String(input.contentMode || '').toLowerCase() === 'shopping'
      ? [
        '',
        '🛒 **상품 링크를 직접 만들지 마세요.**',
        '   쿠팡·스마트스토어 주소를 지어내거나 검색해서 넣지 마세요 — 앱이 실제 제휴링크로 붙입니다.',
        '   본문에는 제품을 **말로** 설명하고, 링크 자리는 비워 두세요.',
        '',
      ].join('\n')
      : '',
  ].join('\n');
}

/**
 * 에이전트가 돌려준 제목을 API 경로와 같은 기준으로 다듬는다.
 * 추가 API 호출은 하지 않는다 — 에이전트 모드는 구독 CLI 를 쓰려고 고른 것이므로
 * 여기서 유료 호출을 끼워 넣으면 그 선택을 뒤집는 셈이다.
 */
export function normalizeAgentTitle(rawTitle: string, keyword: string, bodyText = ''): string {
  try {
    const base = String(rawTitle || '').trim();
    if (!base) return '';
    let cleaned = enforceTitleLength(dedupeKeywordInTitle(stripTitleCliches(base), keyword), 40);

    /**
     * v3.8.594 — 제목이 약속한 수치를 본문이 갖고 있는지 본다. (무료 로컬 연산)
     * API 경로에만 달아 두면 에이전트 모드로 같은 제목이 그대로 나간다.
     */
    if (bodyText) {
      const unkept = findUnkeptTitleClaims({ title: cleaned, bodyText, keyword });
      if (unkept.length > 0) {
        console.log(`[AGENT-TITLE] ${describeUnkeptClaims(unkept)}`);
        cleaned = stripUnkeptClaims(cleaned, unkept);
      }
    }

    return cleaned.trim();
  } catch {
    return String(rawTitle || '').trim();
  }
}

export interface AgentArticleReport {
  html: string;
  warnings: string[];
  /** 값을 약속하고 안 준 문장 수 — 로그·진단용 */
  valuePromises: number;
  emptyBlocks: number;
  /** 디스커버 정책에 걸리는 제목 표현 — 검색 모드에서는 늘 빈 배열 */
  titleViolations: string[];
  /** v3.8.577 — 열거 구멍·앞 잘린 문단·과한 단정 */
  structureIssues: number;
  /** v3.8.577 — 광고 랜딩·타 블로그로 나가는 링크 */
  badLinks: number;
}

/**
 * v3.8.577 — 에이전트가 만든 링크를 본다.
 *
 * ## 왜 필요한가
 * API 경로는 `judgeCtaHost` 가 목적지를 거른다. 그런데 **에이전트 모드는 그 관문을 안 탄다** —
 * 지시서에 "CTA: …" 한 줄만 주고 링크는 에이전트가 알아서 고른다.
 * 그래서 API 쪽에서 막은 것들이 이쪽으로 그대로 새어 나간다:
 *   · 광고 랜딩(utm_·n_ad·gclid) — 광고주 예산을 태우고 캠페인이 끝나면 죽는다
 *   · 블로그·카페 — 사장님 규칙: 타 블로그로 트래픽을 보내지 않는다(허브글이 없다)
 *
 * 전부 **무료 로컬 연산**이다. 에이전트 모드는 구독 CLI 를 쓰려고 고른 모드라
 * 후처리에서 유료 API 를 부르면 안 된다.
 */
function findBadOutboundLinks(html: string, ownHost = 'leadernam.com'): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of String(html || '').matchAll(/<a\s[^>]*href="(https?:\/\/[^"]+)"/gi)) {
    const url = String(m[1]).replace(/&amp;/g, '&');
    let host = '';
    try { host = new URL(url).hostname.toLowerCase(); } catch { continue; }
    if (host.replace(/^www\./, '').endsWith(ownHost)) continue;
    if (seen.has(url)) continue;
    seen.add(url);

    if (hasAdTracking(url)) out.push(`광고 랜딩 링크: ${host}`);
    else if (isUserGeneratedUrl(url)) out.push(`블로그·카페 링크: ${host}`);
  }
  return [...new Set(out)];
}

export interface AgentArticleOptions {
  contentMode?: string;
  title?: string;
  /** 소제목이 이 키워드를 되풀이하는지 보는 데 쓴다 (디스커버 모드) */
  keyword?: string;
}

/**
 * 에이전트가 돌려준 HTML 을 API 경로와 같은 후처리로 통과시킨다.
 *
 * 여기서 발행을 막지는 않는다 — 에이전트 실행은 이미 몇 분을 썼고, 되돌릴 수 없다.
 * 대신 고칠 수 있는 건 고치고, 못 고치는 건 경고로 올려 사용자가 판단하게 한다.
 */
export function postProcessAgentArticle(html: string, options?: AgentArticleOptions): AgentArticleReport {
  const warnings: string[] = [];
  let out = String(html || '');

  try {
    // 에이전트는 이미지 금지 지시를 받지만 종종 figure/caption 을 넣는다.
    // 소제목을 그대로 되풀이하는 캡션은 화면에서 제목이 두 번 찍히게 만든다.
    const before = out;
    out = out.replace(/<figcaption\b[^>]*>[\s\S]*?<\/figcaption>/gi, '');
    if (out !== before) warnings.push('이미지 캡션을 제거했습니다 (소제목 중복 방지)');
  } catch { /* 못 지워도 발행은 계속한다 */ }

  /**
   * 🔧 v3.8.629 — 에이전트 글에도 같은 자동 수정을 건다.
   *
   * 에이전트 모드는 orchestration 을 안 탄다(별도 경로). 그래서 API 쪽에 넣은
   * 게이트가 이쪽에는 자동으로 안 들어온다 — 이 저장소가 여러 번 겪은 함정이다.
   * 사장님 요구가 "api와 에이전트 둘다" 이므로 같은 자를 여기서도 댄다.
   */
  try {
    const repaired = autoRepairBeforePublish(out);
    if (repaired.repairs.length > 0) {
      out = repaired.html;
      warnings.push(describeRepairs(repaired));
    }
  } catch { /* 자동 수정 실패가 발행을 막지는 않는다 */ }

  let valuePromises = 0;
  try {
    valuePromises = findValuePromises(out).length;
    if (valuePromises > 0) {
      warnings.push(`값을 약속하고 수치를 안 적은 문장 ${valuePromises}건이 남아 있습니다`);
    }
  } catch { /* 진단 실패는 무시한다 */ }

  let emptyBlocks = 0;
  try {
    const found = findEmptyBlocks(out);
    emptyBlocks = found.length;
    if (emptyBlocks > 0) warnings.push(`내용이 빈 블록: ${describeEmptyBlocks(found)}`);
  } catch { /* 진단 실패는 무시한다 */ }

  /**
   * 디스커버 제목 정책 검사. 막지 않는다 — 에이전트 실행에 이미 몇 분을 썼고,
   * 제목을 다시 짓게 하려면 유료 호출이 필요하다. 알리고 사용자가 고르게 한다.
   */
  let titleViolations: string[] = [];
  try {
    if (isDiscoverMode(options?.contentMode) && options?.title) {
      titleViolations = findDiscoverTitleViolations(options.title);
      if (titleViolations.length > 0) {
        warnings.push(`디스커버 제목 정책에 걸리는 표현: ${titleViolations.join(', ')}`);
      }
    }
  } catch { /* 진단 실패는 무시한다 */ }

  /**
   * 소제목이 키워드 나열로 굳었는지도 같이 본다.
   * 제목은 사람에게 말하는데 소제목만 검색어를 늘어놓으면 톤이 어긋난다(실측 사례).
   * 여기서도 막지 않는다 — 알리기만 한다.
   */
  try {
    if (isDiscoverMode(options?.contentMode)) {
      const headingIssues = findDiscoverHeadingIssues(out, options?.keyword);
      headingIssues.forEach((issue) => warnings.push(issue));
    }
  } catch { /* 진단 실패는 무시한다 */ }

  /**
   * v3.8.577 — 구조 검사. **API 경로와 같은 눈**으로 본다.
   * 열거 구멍("2·3·4세대는 있는데 1세대가 없다")·앞 잘린 문단·과한 단정.
   * AI 를 부르지 않는 로컬 연산이라 에이전트 모드 원칙(유료 호출 금지)에 어긋나지 않는다.
   */
  let structureIssues = 0;
  try {
    const issues = findStructureIssues(out);
    structureIssues = issues.length;
    issues.forEach((i) => warnings.push(i.detail));
  } catch { /* 진단 실패는 무시한다 */ }

  /**
   * v3.8.577 — 링크 검사.
   * 에이전트는 judgeCtaHost 관문을 안 타므로 광고 랜딩·타 블로그가 그대로 나갈 수 있다.
   */
  let badLinks = 0;
  try {
    const bad = findBadOutboundLinks(out);
    badLinks = bad.length;
    bad.forEach((b) => warnings.push(`${b} — 광고 랜딩은 광고주 예산을 태우고, 타 블로그는 트래픽이 새어 안 돌아옵니다`));
  } catch { /* 진단 실패는 무시한다 */ }

  return { html: out, warnings, valuePromises, emptyBlocks, titleViolations, structureIssues, badLinks };
}

/** 에이전트가 만든 FAQ 배열에도 같은 규칙을 적용한다 */
export { dropEmptyFaqItems };
