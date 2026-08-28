/**
 * v3.8.565 — 본문 출력 언어 배선 (하네스 E2)
 *
 * ## 무엇이 문제였나
 * v3.8.562 가 자동 삽입 블록 문구만 ko/en 으로 갈랐다(E5). **본문은 한국어 전용이었다.**
 * 소스에 "한국어/한글" 언급이 33개 파일 107곳이라 크게 보였지만, 실제로 세어 보니
 * **모델에게 출력 언어를 지시하는 문장은 5곳**이고 본문 생성에 걸리는 건 두 곳이었다:
 *
 *   · generation.ts 본문 프롬프트의 "⚠️ 언어 규칙: 반드시 한국어 …"
 *   · llm-caller 의 시스템 프롬프트 "Write publishable Korean blog content …"
 *
 * 둘이 다른 파일에 문자열로 박혀 있어서 **한쪽만 고치면 모델이 상반된 지시를 동시에 받는다.**
 * 그래서 language-rules 한 곳으로 모았다.
 *
 * ## 가장 중요한 불변식
 * **language 를 안 주면 예전과 100% 같아야 한다.** 한국어 사이트 수백 편이 이 경로로 나간다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';
import {
  setActiveLanguage,
  getActiveLanguage,
  outputLanguageRule,
  systemLanguageLine,
} from '../src/core/final/language-rules';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

/** 이 문장이 여태 나간 한국어 규칙이다 — 글자 하나도 바뀌면 안 된다 */
const KO_RULE = '⚠️ 언어 규칙: 반드시 한국어 한글과 영문/숫자만 사용하세요. 중국어 한자(漢字), 일본어는 절대 사용 금지!';

afterEach(() => { setActiveLanguage('ko'); });   // 모듈 상태라 테스트끼리 샌다

describe('① 기본은 한국어 — 기존 동작을 안 바꾼다', () => {
  it('⭐⭐ 아무것도 안 주면 ko', () => {
    setActiveLanguage(undefined);
    expect(getActiveLanguage()).toBe('ko');
    expect(outputLanguageRule()).toBe(KO_RULE);
    expect(systemLanguageLine()).toContain('respond in Korean');
  });

  it('⭐⭐ 한국어 규칙 문장이 글자 그대로 유지된다', () => {
    // 표현을 손대면 이번 작업과 무관한 변화가 수백 편에 섞인다
    expect(outputLanguageRule('ko')).toBe(KO_RULE);
  });

  it('알 수 없는 값도 한국어로 떨어진다', () => {
    for (const v of ['', null, 'zz', '한국어', 123]) {
      setActiveLanguage(v as unknown);
      expect(getActiveLanguage()).toBe('ko');
    }
  });
});

describe('② 영어를 주면 두 지시가 함께 영어로 간다', () => {
  it('⭐⭐ 본문 규칙과 시스템 프롬프트가 같은 언어를 말한다', () => {
    setActiveLanguage('en');
    const rule = outputLanguageRule();
    const sys = systemLanguageLine();
    expect(rule).toContain('Write everything in natural English');
    expect(sys).toContain('respond in English');
    // 상반된 지시가 남아 있으면 모델이 흔들린다
    expect(rule).not.toContain('한국어');
    expect(sys).not.toContain('Korean');
  });

  it('⭐ 영어 규칙이 글 전체를 덮는다 (제목·표·FAQ 까지)', () => {
    const rule = outputLanguageRule('en');
    for (const part of ['headings', 'body', 'tables', 'FAQ']) {
      expect(rule).toContain(part);
    }
    // 한국어 용어가 불가피할 때 처리도 지시한다
    expect(rule).toContain('romanize');
  });

  it('영어 표기 흔들림을 함께 받는다', () => {
    for (const v of ['en', 'EN', 'en-US', 'en_GB', 'English']) {
      setActiveLanguage(v);
      expect(getActiveLanguage()).toBe('en');
    }
  });
});

describe('③ 배선 — 두 곳 다 language-rules 를 쓴다', () => {
  const generation = read('src/core/final/generation.ts');
  const caller = read('src/core/llm/llm-caller.ts');
  const orchestration = read('src/core/final/orchestration.ts');

  it('⭐⭐ 본문 프롬프트에 한국어 규칙이 박혀 있지 않다', () => {
    expect(generation).toContain("from './language-rules'");
    expect(generation).toContain('${outputLanguageRule()}');
    // 하드코딩된 옛 문장이 남아 있으면 영어에서도 한국어를 지시하게 된다
    expect(generation).not.toContain(KO_RULE);
  });

  it('⭐⭐ 시스템 프롬프트가 호출마다 조립된다 (상수로 굳으면 언어가 안 바뀐다)', () => {
    expect(caller).toContain('systemLanguageLine');
    expect(caller).toContain('function factualSystemPrompt()');
    // 굳은 상수는 사라져야 한다
    expect(caller).not.toContain('KOREAN_BLOG_FACTUAL_SYSTEM');
    expect(caller).not.toContain("'Write publishable Korean blog content and always respond in Korean.'");
    // 세 provider 전부 함수 호출로 바뀌었는가
    expect((caller.match(/factualSystemPrompt\(\)/g) || []).length).toBeGreaterThanOrEqual(4);
  });

  it('⭐⭐ orchestration 이 글마다 언어를 설정한다', () => {
    expect(orchestration).toContain('setActiveLanguage');
    expect(orchestration).toContain('(payload as any)?.language');
  });

  it('⭐ 말투 설정 바로 뒤에서 설정한다 (본문 생성 전에 확정돼야 한다)', () => {
    // ⚠️ braceBlock 을 쓰면 안 된다 — 이 함수는 반환 타입이 `Promise<{ html: ... }>` 라
    //    함수명 뒤 첫 `{` 가 **본문이 아니라 반환 타입**이다. 실제로 그렇게 잡혀서 빈 블록이 됐다.
    const head = blockBetween(
      orchestration,
      'export async function generateUltimateMaxModeArticleFinal',
      'const queueImageToken',
    );
    const tone = head.indexOf('setActiveToneStyle');
    const lang = head.indexOf('setActiveLanguage');
    expect(tone).toBeGreaterThan(-1);
    expect(lang).toBeGreaterThan(tone);
    // 프롬프트 조립보다 앞서야 한다
    const build = head.indexOf('outputLanguageRule');
    if (build > -1) expect(lang).toBeLessThan(build);
  });
});

describe('④ 아직 안 된 것 — 이걸로 영어 글이 나오지는 않는다', () => {
  /**
   * 🚨 2026-08-28 실물 검증: `language:'en'` 으로 한 편 생성했더니
   *    **본문에 한글 6,752자**가 남았다. 영어로 나온 건 자동 삽입 블록(v3.8.562)뿐.
   *
   *    원인은 배선이 아니라 **프롬프트가 한국어로 쓰여 있다는 것**이다.
   *    135줄 한국어 지시문 한가운데 영어 규칙 한 줄로는 못 이긴다.
   *    이 테스트는 "E2 가 끝났다"는 착각을 막는다.
   */
  /**
   * ✅ 이 항목은 **역할을 다하고 갱신됐다.**
   *
   * v3.8.565 에서는 "본문 프롬프트가 아직 한국어(한글 1,000자 초과)" 를 고정해
   * "E2 가 끝났다"는 착각을 막았다. v3.8.566 에서 영어판(prompt-en.ts)을 쓰자
   * 이 테스트가 **설계대로 빨간불이 됐고**, 그래서 여기를 갱신한다.
   *
   * 이제 고정하는 사실은 다르다 — **본문은 갈렸고, 나머지는 아직**이다.
   */
  it('⭐⭐ 본문 프롬프트는 영어판이 생겼다 (한국어판도 그대로 남아 있다)', () => {
    const gen = read('src/core/final/generation.ts');
    // 영어 분기가 실제로 있다
    expect(gen).toContain('buildEnglishBodyPrompt');
    expect(gen).toContain("getActiveLanguage() === 'en'");
    // 한국어 템플릿도 그대로다 — 수백 편이 이 문장으로 나간다
    expect(gen).toContain('🔴🔴🔴 [10억 점');
  });

  it('⭐⭐ 그러나 아직 한국어 전용인 생성기가 남아 있다', () => {
    /**
     * 실물 검증(2026-08-28)에서 확인한 남은 목록이다. 이걸 다 갈면 이 테스트가
     * 빨간불이 되고, 그때가 E2 가 정말 끝난 시점이다.
     *   · generateSectionTitlesFromRoles — H2 텍스트를 만든다
     *   · generateH3ContentFinal · generateCTAsFinal
     *   · 하드코딩된 한국어 라벨 2곳 (html.ts · orchestration.ts)
     */
    const gen = read('src/core/final/generation.ts');
    const korInFn = (fnName: string) => {
      const s = gen.indexOf(`export async function ${fnName}`);
      expect(s).toBeGreaterThan(-1);
      const next = gen.indexOf('\nexport async function ', s + 10);
      return (gen.slice(s, next > -1 ? next : undefined).match(/[가-힣]/g) || []).length;
    };
    expect(korInFn('generateSectionTitlesFromRoles')).toBeGreaterThan(300);
    expect(korInFn('generateCTAsFinal')).toBeGreaterThan(1000);

    // 하드코딩 라벨 — LLM 이 아니라 소스에 박혀 있어 언어 분기로 갈라야 한다
    expect(read('src/core/final/html.ts')).toContain('📌 전체 읽어보기 절차');
    expect(read('src/core/final/orchestration.ts')).toContain('성급한 분들을 위한 핵심 요약');
  });

  it('외부유입·팩트체크 프롬프트도 여전히 한국어 전용이다', () => {
    const fallback = read('src/core/external-traffic/_shared/llm-fallback.js');
    expect(fallback).toContain('Always respond in Korean');
  });
});
