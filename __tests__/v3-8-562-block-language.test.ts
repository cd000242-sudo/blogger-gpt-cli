/**
 * 자동 삽입 블록의 언어 분리 (v3.8.562 · 하네스 E5)
 *
 * 문제: v3.8.559 결론 블록과 v3.8.560 독자 확보 블록에 **한국어 문구가 코드에 박혀 있었다.**
 *       영어 사이트를 발행하면 영어 본문 사이에 "이런 글, 놓치지 않으려면" 이 그대로 나온다.
 *
 * 영어 발행에 필요한 일곱 가지(E1~E7) 중 가장 싸고 눈에 바로 보이는 것이라 먼저 한다.
 *
 * 가장 중요한 불변식: **language 를 안 주면 예전과 100% 같아야 한다.**
 *   기존 한국어 사이트 수백 편이 이 코드로 나가고 있다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockStrings, normalizeBlockLanguage, attachJosa } from '../src/core/final/block-strings';
import { buildAnswerBlock } from '../src/core/final/answer-block';
import { buildAudienceBlock } from '../src/core/final/audience-block';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

const 답 = '마그네슘은 형태에 따라 흡수율이 다릅니다. 산화마그네슘은 값이 싸지만 대부분 빠져나갑니다. 속이 약하면 글리시네이트가 낫습니다.';
const ANSWER_EN = 'Magnesium absorption depends on the form. Oxide is cheap but most of it passes through. Glycinate is gentler on the stomach.';
const WP_ENV = { WORDPRESS_SITE_URL: 'https://leadernam.com' };

describe('① 언어 판별 — 모르면 한국어다', () => {
  it('⭐⭐ 안 주면 한국어 (기존 동작을 바꾸지 않는다)', () => {
    expect(normalizeBlockLanguage(undefined)).toBe('ko');
    expect(normalizeBlockLanguage(null)).toBe('ko');
    expect(normalizeBlockLanguage('')).toBe('ko');
    expect(normalizeBlockLanguage('알수없는값')).toBe('ko');
  });

  it('영어 표기 흔들림을 함께 받는다', () => {
    expect(normalizeBlockLanguage('en')).toBe('en');
    expect(normalizeBlockLanguage('EN')).toBe('en');
    expect(normalizeBlockLanguage('en-US')).toBe('en');
    expect(normalizeBlockLanguage('en_GB')).toBe('en');
    expect(normalizeBlockLanguage('English')).toBe('en');
  });
});

describe('② 조사 — "을(를)" 병기를 없앴다', () => {
  it('⭐ 받침이 있으면 을, 없으면 를', () => {
    expect(attachJosa('마그네슘', '을', '를')).toBe('을');   // 슘 = ㅁ 받침
    expect(attachJosa('성분노트', '을', '를')).toBe('를');   // 트 = 받침 없음
    expect(attachJosa('홈택스', '을', '를')).toBe('를');     // 스 = 받침 없음
  });

  it('⭐ 한글이 아닌 이름으로 끝나면 병기하지 않는다', () => {
    expect(attachJosa('Tooldesk', '을', '를')).toBe('를');
    expect(attachJosa('CLAIMWISE', '을', '를')).toBe('를');
    expect(attachJosa('사이트24', '을', '를')).toBe('를');
    expect(attachJosa('', '을', '를')).toBe('를');
  });
});

describe('③ 결론 블록', () => {
  it('⭐⭐ 언어를 안 주면 예전 그대로 한국어다', () => {
    const html = buildAnswerBlock({ keyword: '마그네슘', answer: 답, basis: '식약처 · 2026-08' });
    expect(html).toContain('마그네슘, 결론부터');
    expect(html).toContain('근거: 식약처 · 2026-08');
  });

  it('⭐⭐ 영어면 문구가 전부 영어다 — 한국어가 한 글자도 없다', () => {
    const html = buildAnswerBlock({
      keyword: 'magnesium', language: 'en', answer: ANSWER_EN, basis: 'FDA · Aug 2026',
    });
    expect(html).toContain('magnesium: the short answer');
    expect(html).toContain('Source: FDA · Aug 2026');
    expect(html).not.toMatch(/[가-힣]/);
  });

  it('영어에서도 질문을 직접 주면 그걸 쓴다', () => {
    const html = buildAnswerBlock({
      keyword: 'magnesium', language: 'en', question: 'Which magnesium should I take?', answer: ANSWER_EN,
    });
    expect(html).toContain('Which magnesium should I take?');
  });

  it('답이 없으면 언어와 무관하게 안 만든다', () => {
    expect(buildAnswerBlock({ keyword: 'x', language: 'en', answer: '' })).toBe('');
    expect(buildAnswerBlock({ keyword: 'x', answer: '' })).toBe('');
  });
});

describe('④ 독자 확보 블록', () => {
  it('⭐⭐ 언어를 안 주면 예전 그대로 한국어다', () => {
    const html = buildAudienceBlock({ platform: 'wordpress', env: WP_ENV, siteName: '성분노트' });
    expect(html).toContain('이런 글, 놓치지 않으려면');
    expect(html).toContain('즐겨 보는 출처로 지정하기');
    expect(html).toContain('팔로우');
  });

  it('⭐⭐ 영어면 문구가 전부 영어다 — 한국어가 한 글자도 없다', () => {
    const html = buildAudienceBlock({
      platform: 'wordpress', env: WP_ENV, siteName: 'Tooldesk', language: 'en',
    });
    expect(html).toContain('preferred source');
    expect(html).toContain('Follow');
    expect(html).not.toMatch(/[가-힣]/);
  });

  it('⭐ 사이트 이름에 맞는 조사가 붙는다 (을(를) 병기가 사라졌다)', () => {
    const a = buildAudienceBlock({ platform: 'wordpress', env: WP_ENV, siteName: '성분노트' });
    expect(a).toContain('성분노트</strong>를');
    expect(a).not.toContain('을(를)');

    const b = buildAudienceBlock({ platform: 'wordpress', env: WP_ENV, siteName: '건강백과사전' });
    expect(b).toContain('건강백과사전</strong>을');
  });

  it('영어에서는 조사 처리가 아예 돌지 않는다', () => {
    const html = buildAudienceBlock({
      platform: 'wordpress', env: WP_ENV, siteName: 'Tooldesk', language: 'en',
    });
    expect(html).not.toContain('을');
    expect(html).not.toContain('를');
  });

  it('언어와 무관하게 도메인을 모르면 안 만든다', () => {
    expect(buildAudienceBlock({ platform: 'wordpress', env: {}, language: 'en' })).toBe('');
    expect(buildAudienceBlock({ platform: 'wordpress', env: {} })).toBe('');
  });

  it('언어와 무관하게 애드센스 모드에는 안 넣는다', () => {
    expect(buildAudienceBlock({ platform: 'wordpress', env: WP_ENV, contentMode: 'adsense', language: 'en' })).toBe('');
  });
});

describe('⑤ 문구 표 자체', () => {
  it('두 언어가 같은 항목을 모두 갖는다 (하나만 비면 그 자리가 빈칸으로 나간다)', () => {
    const ko = blockStrings('ko'), en = blockStrings('en');
    for (const key of ['answerBasisLabel', 'audienceTitle', 'audienceCta', 'audienceFollow'] as const) {
      expect(String(ko[key]).length).toBeGreaterThan(0);
      expect(String(en[key]).length).toBeGreaterThan(0);
    }
    expect(ko.answerQuestionFallback('키워드')).toContain('키워드');
    expect(en.answerQuestionFallback('keyword')).toContain('keyword');
    expect(ko.audienceLine('사이트')).toContain('사이트');
    expect(en.audienceLine('Site')).toContain('Site');
  });
});

describe('⑥ 발행 경로에 실제로 걸려 있다', () => {
  const orchestration = read('src/core/final/orchestration.ts');
  const answerBlock = read('src/core/final/answer-block.ts');
  const audienceBlock = read('src/core/final/audience-block.ts');

  it('⭐⭐ 두 블록 모두 문구 표를 쓴다 (하드코딩이 남아 있지 않다)', () => {
    expect(answerBlock).toContain("from './block-strings'");
    expect(audienceBlock).toContain("from './block-strings'");
    expect(answerBlock).not.toContain('결론부터`');
    expect(audienceBlock).not.toContain('이런 글, 놓치지 않으려면<');
  });

  it('⭐⭐ orchestration 이 payload 의 언어를 두 블록에 모두 넘긴다', () => {
    expect((orchestration.match(/language: \(payload as any\)\?\.language/g) || []).length).toBe(2);
  });

  it('⭐ 영어 발행의 나머지 항목은 아직 안 됐다 (E5 만 끝났다는 사실을 기록해 둔다)', () => {
    // 프롬프트(E2)·조사 후처리(E3)·CTA 목적지(E6) 는 여전히 한국어 전용이다.
    // 이 테스트는 "다 됐다"고 착각하지 않기 위한 표시다.
    const generation = read('src/core/final/generation.ts');
    expect(generation).toContain('한글');            // 프롬프트가 아직 한국어를 강제한다
  });
});
