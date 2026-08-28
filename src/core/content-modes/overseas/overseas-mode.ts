// src/core/content-modes/overseas/overseas-mode.ts
/**
 * overseas — 한국의 것을 **영어권 독자에게** 설명하는 모드 (v3.8.566 · 하네스 E2)
 *
 * ## 왜 새 모드인가
 * 기존 모드(external/internal/adsense/shopping/paraphrasing)의 프롬프트 블록은
 * 전부 한국어다(externalModePromptBlock 은 한글 78%). 그리고 그 블록에는
 * "이후 모든 일반 지시보다 우선" 이라고 적혀 있다.
 * 그래서 v3.8.566 에서 껍데기를 영어로 바꿨는데도 본문이 한글로 나왔다 —
 * **영어 껍데기 안에서 한국어 모드 지시가 이겼다.** 모드를 새로 만드는 것 말고 방법이 없다.
 *
 * ## 형식은 실측에서 나왔다
 * 2026-08-27, "best Korean instant ramen 2026" 영어권 상위를 실제로 훑었다.
 * 1인칭 사진 후기가 아니라 **표와 등급이 이긴다**:
 *   · The Ramen Rater — 리뷰 5,500개를 점수로 축적
 *   · franvia — "Spice Level Tier List"
 *   · smarterranking — 자체 점수 체계("SR Score 89")
 *   · awesomble(한국 사이트의 /en/) — "실매출 TOP 10"
 * 거인은 The Ramen Rater 하나뿐이고 나머지는 작은 사이트다. 관공서·대기업 벽이 없다.
 *
 * ## 이 모드가 노리는 우위 — "원산지"
 * 영어권 사이트는 한국 제품을 **건너서** 쓴다. 우리는 원자료를 읽을 수 있다.
 * 그 차이가 독자가 이 사이트에 올 이유이고, 프롬프트가 그걸 매 섹션에서 요구한다.
 *
 * ⚠️ 번역투 제거가 이 모드의 사활이다. 자세한 규칙은 prompt-en.ts §2 에 있고,
 *    여기서는 **구조**만 다룬다. 두 곳이 규칙을 중복해서 어긋나면 안 된다.
 */

import type { ContentModeConfig } from '../../max-mode-structure';
import type { ContentModePlugin, PromptParams } from '../mode-interface';
import { registerMode } from '../mode-registry';
/**
 * ⚠️ SEO_OPTIMIZED_MODE_SECTIONS 를 재사용하면 안 된다.
 *    mode-dispatcher 는 이 `sections` 에서 h2Titles 를 만든다 — **H2 는 생성되는 게 아니라
 *    여기서 나온다.** 한국어 섹션을 쓰면 프롬프트를 다섯 군데 영어로 갈아도
 *    소제목이 한국어로 박히고 본문이 그걸 따라간다(실제로 그렇게 나왔다).
 */
import { OVERSEAS_MODE_SECTIONS } from './overseas-sections';

const OVERSEAS_CONFIG: ContentModeConfig = {
  name: '해외(영어권) 모드',
  description: '한국의 것을 영어권 독자에게 — 표·등급·비교 중심. 원산지 정보 우위를 매 섹션에서 쓴다',
  titleStrategy: '영어권 검색어 그대로. 연도·비교·순위가 들어간 실용형 제목',
  sectionStrategy: '설명형이 아니라 비교형 — 등급표·점수·순위가 뼈대',
  tone: '직설적인 영어. 번역투·완곡체·접속 상투구 금지',
  ctaStrategy: '해외 독자가 실제로 할 수 있는 행동만 (어디서 사나 · 대체품)',
};

/** 원산지 우위를 어떻게 쓰라고 지시할지 — 이 모드의 핵심 */
const SOURCE_ADVANTAGE = [
  'You are writing from inside Korea. English-language sites cover this second-hand.',
  'That gap is the only reason a reader picks this page, so use it in every section:',
  '  · What actually sells here — real ranking, not guesswork',
  '  · Official figures read from the Korean source (spec, ingredients, heat level, price in Korea)',
  '  · How much it costs here versus abroad, and why the gap exists',
  '  · Where a reader outside Korea can actually buy it, and what to substitute if they cannot',
  'If a section could have been written by someone who has never been to Korea, it is not done yet.',
].join('\n');

const overseasModePlugin: ContentModePlugin = {
  id: 'overseas',
  config: OVERSEAS_CONFIG,
  sections: OVERSEAS_MODE_SECTIONS,

  buildSectionPrompt(params: PromptParams): string {
    const sec = params.section;
    const reqs = (sec.requiredElements || []).map((r) => `  - ${r}`).join('\n');
    return `Role: ${sec.role || 'A writer who lives in Korea and explains Korean products to English readers'}
Focus: ${sec.contentFocus || 'Comparison a reader can act on, not description'}
Required elements:
${reqs}
(at least ${Math.max(80, Math.round((sec.minChars || 700) / 5.5))} words)

${SOURCE_ADVANTAGE}

How this section should be shaped:
- Lead with the verdict. "If you want X, buy Y." Then justify it.
- Prefer a table or a ranked list over paragraphs whenever you are comparing more than two things.
- Every claim carries a number, a name, or a price. Cut anything that carries none.
- Explain any Korean term the first time: romanized form, then a short gloss in parentheses.
- Give both units: metric first, then the US equivalent in parentheses.
- Never assume the reader has been to Korea, watched Korean shows, or knows Korean brands.`;
  },

  buildTitlePrompt(topic: string, keywords: string[], trendKeywords?: string[]): string {
    const trend = trendKeywords?.length ? `\nRelated searches: ${trendKeywords.slice(0, 6).join(', ')}` : '';
    return `Write one English title for an article about: ${topic}
Keywords: ${keywords.join(', ')}${trend}

Rules:
- Plain English that an American or British reader would type into Google. Not a translation.
- Say what the reader gets. Ranking, comparison, "how to", or a number — one of those.
- 60 characters or fewer so it is not cut off in search results.
- No colon-stacking ("Guide: Everything You Need to Know: 2026 Edition").
- No hype ("Ultimate", "Definitive", "You Won't Believe").
- Include the year only if the content genuinely changes year to year.
- Never leave a Korean word untranslated in the title unless it is the search term itself
  (ramyeon, gochujang, and kimchi are fine; most others are not).

Output the title only. No quotes, no explanation.`;
  },

  buildOutlinePrompt(topic: string, keywords: string[], targetYear?: number | null): string {
    const year = targetYear ? ` (${targetYear})` : '';
    return `Plan the H2 headings for an English article about: ${topic}${year}
Keywords: ${keywords.join(', ')}

${SOURCE_ADVANTAGE}

Shape the outline the way English readers of this subject expect:
- One heading that answers the main question outright, near the top.
- At least one heading that **ranks or compares** (tier list, best-for-each-case, side by side).
- One heading covering what surprises people who buy it outside Korea
  (price gap, availability, a different formulation sold abroad).
- One heading a beginner needs and an expert can skip — say which it is in the heading.
- Avoid an FAQ heading; the system adds one separately.

Heading rules:
- Written as a reader would search, not as a textbook chapter.
- 3 to 8 words. No colons. No "Introduction" or "Conclusion".
- English only.

Output one heading per line, nothing else.`;
  },
};

registerMode(overseasModePlugin);

export default overseasModePlugin;
