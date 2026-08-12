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
import { SUBSTANCE_FIRST_PASS_RULES, FRESHNESS_RULES } from './substance-rules';
import { DECISION_SUPPORT_RULES } from './decision-support';
import { NO_EXPERIENCE_GUARD } from './experience-block';
import { buildArchetypeGuide } from './title-archetypes';
import { stripTitleCliches, dedupeKeywordInTitle, enforceTitleLength } from './generation';
import { findEmptyBlocks, describeEmptyBlocks, dropEmptyFaqItems } from './empty-block-guard';
import { findValuePromises } from './value-promise';
import { isDiscoverMode, buildDiscoverTitleDirective, buildDiscoverBodyBlock, findDiscoverTitleViolations } from './discover-mode';

export interface AgentHarnessInput {
  keyword: string;
  currentYear: number;
  /** 검색자가 실제로 던진 질문들 — 있으면 제목·소제목 재료로 준다 */
  demandQuestions?: string[];
  /** 'discover' 면 제목·본문 규칙을 피드 기준으로 갈아끼운다 */
  contentMode?: string;
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
    buildTitleRules(input),
    // 디스커버는 본문 규칙도 피드 기준으로 다르다 (첫 화면에서 결론을 주고, 스크롤을 미끼로 쓰지 않는다)
    isDiscoverMode(input.contentMode) ? buildDiscoverBodyBlock(input.currentYear) : '',
    SUBSTANCE_FIRST_PASS_RULES,
    HUMAN_VOICE_RULES,
    DECISION_SUPPORT_RULES,
    FRESHNESS_RULES,
    NO_EXPERIENCE_GUARD,
  ].join('\n');
}

/**
 * 에이전트가 돌려준 제목을 API 경로와 같은 기준으로 다듬는다.
 * 추가 API 호출은 하지 않는다 — 에이전트 모드는 구독 CLI 를 쓰려고 고른 것이므로
 * 여기서 유료 호출을 끼워 넣으면 그 선택을 뒤집는 셈이다.
 */
export function normalizeAgentTitle(rawTitle: string, keyword: string): string {
  try {
    const base = String(rawTitle || '').trim();
    if (!base) return '';
    const cleaned = enforceTitleLength(dedupeKeywordInTitle(stripTitleCliches(base), keyword), 40);
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
}

export interface AgentArticleOptions {
  contentMode?: string;
  title?: string;
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

  return { html: out, warnings, valuePromises, emptyBlocks, titleViolations };
}

/** 에이전트가 만든 FAQ 배열에도 같은 규칙을 적용한다 */
export { dropEmptyFaqItems };
