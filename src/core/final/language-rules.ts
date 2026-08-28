/**
 * language-rules — 출력 언어를 한 곳에서 정한다. (v3.8.565 · 하네스 E2)
 *
 * ## 왜 만드는가
 * v3.8.562 가 자동 삽입 블록의 문구만 ko/en 으로 갈랐다(E5). 본문은 그대로였다.
 * 실제로 세어 보니 소스에 "한국어/한글" 언급이 33개 파일 107곳인데,
 * 그중 **모델에게 출력 언어를 지시하는 문장은 5곳뿐**이었다. 나머지는 주석·라벨이다.
 * 본문 생성에 걸리는 건 두 곳이다:
 *
 *   · `generation.ts` 본문 프롬프트의 "⚠️ 언어 규칙: 반드시 한국어 …"
 *   · `llm-caller` 의 시스템 프롬프트 "Write publishable Korean blog content …"
 *
 * 이 둘이 서로 다른 파일에 문자열로 박혀 있어서, 한쪽만 고치면 **모델이 두 지시를
 * 동시에 받는다**(하나는 영어로 쓰라, 하나는 한국어로 답하라). 그래서 문장을 여기 모은다.
 *
 * ## 왜 인자로 안 넘기고 모듈 상태인가
 * `llm-caller` 의 시스템 프롬프트는 provider 설정 안에서 쓰이는데 그 함수들은
 * `(model, prompt)` 만 받는다. 언어를 넘기려면 시그니처 세 개를 바꿔야 한다.
 * 이 저장소는 같은 문제를 이미 **말투(setActiveToneStyle)** 에서 모듈 상태로 풀었고,
 * orchestration 이 글 하나를 시작할 때 한 번 설정한다. 같은 방식을 쓴다.
 *
 * ⚠️ 글 단위로 반드시 다시 설정해야 한다. 안 하면 앞 글의 언어가 남는다.
 *    (연속발행에서 한국어 글 다음 영어 글이 오는 경우가 실제로 있다)
 *
 * ═══════════════════════════════════════════════════════════════════════
 * 🚨 이것만으로는 영어 글이 안 나온다 — 실물로 확인했다 (2026-08-28)
 * ═══════════════════════════════════════════════════════════════════════
 * `language: 'en'` 을 주고 실제로 한 편 생성해 봤더니 **본문에 한글이 6,752자** 남았고
 * 제목에도 한국어 단어가 붙었다. 영어로 나온 건 v3.8.562 가 갈라 둔 자동 삽입 블록뿐이었다.
 *
 * 원인은 배선이 아니다. **프롬프트 자체가 한국어로 쓰여 있다.**
 *   본문 생성 프롬프트(generation.ts `generateAllSectionsFinal`) 135줄 =
 *   한글 2,249자 / 영문 1,099자 → **한글 67%**
 *
 * 135줄짜리 한국어 지시문 한가운데에 영어 규칙 한 줄을 끼워 넣으면
 * 모델은 **프롬프트가 쓰인 언어**를 따라간다. 한 줄로 이길 수 있는 신호가 아니다.
 *
 * 즉 E2 는 "언어 규칙을 갈아끼우는 일"이 아니라
 * **"프롬프트 본문을 영어판으로 따로 쓰는 일"** 이다. 규모가 다르다.
 *
 * 이 파일이 하는 일은 그 작업의 **1단계**다 — 언어를 한 곳에서 정하고,
 * 서로 다른 두 지시(본문 규칙 · 시스템 프롬프트)가 어긋나지 않게 묶어 둔다.
 * 남은 일은 `__tests__/v3-8-565-output-language.test.ts` §④ 에 적어 두었다.
 */

import { normalizeBlockLanguage, type BlockLanguage } from './block-strings';

export type OutputLanguage = BlockLanguage;

/** 기본은 한국어 — 여태 그렇게 돌았고, 안 주면 동작이 바뀌면 안 된다 */
let activeLanguage: OutputLanguage = 'ko';

/** 글 하나를 시작할 때 orchestration 이 부른다. 값이 없으면 한국어로 되돌린다. */
export function setActiveLanguage(raw?: unknown): OutputLanguage {
  activeLanguage = normalizeBlockLanguage(raw);
  return activeLanguage;
}

export function getActiveLanguage(): OutputLanguage {
  return activeLanguage;
}

/**
 * 본문 프롬프트에 들어갈 언어 규칙 한 줄.
 *
 * 한국어 규칙은 **기존 문장을 글자 그대로** 유지한다 — 수백 편이 이 문장으로 나갔고,
 * 여기서 표현을 손대면 이번 작업과 무관한 변화가 섞인다.
 */
export function outputLanguageRule(lang: OutputLanguage = activeLanguage): string {
  if (lang === 'en') {
    return '⚠️ Language rule: Write everything in natural English. '
      + 'Do not use Korean, Chinese characters, or Japanese anywhere in the article — '
      + 'headings, body, tables, FAQ, and image captions included. '
      + 'Write for a reader who does not know Korean: when a Korean term is unavoidable, '
      + 'romanize it and explain it in one short clause on first use.';
  }
  return '⚠️ 언어 규칙: 반드시 한국어 한글과 영문/숫자만 사용하세요. 중국어 한자(漢字), 일본어는 절대 사용 금지!';
}

/**
 * LLM 시스템 프롬프트의 첫 줄(언어·매체 지정).
 * 나머지 사실성 규칙은 언어와 무관하므로 llm-caller 에 그대로 둔다.
 */
export function systemLanguageLine(lang: OutputLanguage = activeLanguage): string {
  return lang === 'en'
    ? 'Write publishable English blog content and always respond in English.'
    : 'Write publishable Korean blog content and always respond in Korean.';
}
