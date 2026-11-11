/**
 * Auto-bold must not start inside a word ("요약 2026년" -> "요<strong>약 2026년</strong>").
 *
 * Reported on a published WordPress post: "핵심 요약 2026년 11월" came out as
 * "핵심 요<strong>약 2026년</strong> 11월". The duration pattern treats "약" / "최대" as an optional
 * prefix, but its lookbehind only rejected digits, commas and dots, so the "약" of "요약",
 * "예약", "계약", "절약" was swallowed as a prefix and the bold started mid-word.
 *
 * Rule: "약" / "최대" count as a prefix only when they stand alone (start of text, after a space,
 * an opening bracket, punctuation or a tag). Glued to a preceding Hangul/Latin letter they are
 * left out and only the number part is bolded.
 *
 * Both publishers carry the same regex, so every case runs through both public entry points:
 *   WordPress  -> applyWordPressInlineStyles (src/wordpress/wordpress-publisher.ts)
 *   Blogspot   -> applyInlineStyles          (src/core/blogger-publisher.js)
 */
import * as fs from 'fs';
import * as path from 'path';
import { applyWordPressInlineStyles } from '../src/wordpress/wordpress-publisher';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const blogger = require('../src/core/blogger-publisher');

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

const PLATFORMS: Array<[string, (html: string) => string]> = [
  ['워드프레스', (html) => applyWordPressInlineStyles(html)],
  ['블로그스팟', (html) => blogger.applyInlineStyles(html)],
];

/** First <p>/<li> element of the output, ignoring <style> blocks the publishers prepend. */
const firstBlock = (out: string, tag: 'p' | 'li' = 'p'): string => {
  const noStyle = out.replace(/<style\b[\s\S]*?<\/style>/gi, '');
  const m = noStyle.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1] : '';
};
const strongTexts = (html: string): string[] =>
  [...html.matchAll(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi)].map((m) => m[1]);
const visibleText = (html: string): string => html.replace(/<[^>]+>/g, '');

let logSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;
beforeAll(() => {
  // The publishers print a lot of [BODY-TRACE] lines — keep the test output readable.
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterAll(() => {
  logSpy.mockRestore();
  warnSpy.mockRestore();
});

describe.each(PLATFORMS)('%s — 낱말 중간에서 굵게가 시작되지 않는다', (_name, run) => {
  const bolds = (text: string, tag: 'p' | 'li' = 'p') => {
    const block = firstBlock(run(`<${tag}>${text}</${tag}>`), tag);
    return { block, bolds: strongTexts(block) };
  };

  test.each([
    ['핵심 요약 2026년 11월', ['2026년']],
    ['예약 3일 전까지 신청', ['3일']],
    ['계약 12개월 이상 유지', ['12개월']],
    ['절약 5분이면 충분', ['5분']],
    ['요약2026년 기준', ['2026년']],
    ['역대최대 3일 연휴', ['3일']],
    ['Summary약 2시간', ['2시간']],
  ])('⭐ "%s" — 접두어 글자는 굵게 밖에 둔다', (text, expected) => {
    const { block, bolds: found } = bolds(text);
    expect(found).toEqual(expected);
    expect(visibleText(block)).toBe(text); // only markup changes, never the words
  });

  test('한 문단에 낱말 접두어와 독립 접두어가 섞여 있어도 각각 맞게 처리한다', () => {
    const { bolds: found } = bolds('예약 3일 또는 약 5분, 최대 2시간, 요약 1년');
    expect(found).toEqual(['3일', '약 5분', '최대 2시간', '1년']);
  });

  test('li 안에서도 같다', () => {
    expect(bolds('예약 3일 전까지', 'li').bolds).toEqual(['3일']);
    expect(bolds('약 3일 걸림', 'li').bolds).toEqual(['약 3일']);
  });
});

describe.each(PLATFORMS)('%s — 낱말로 떨어진 접두어는 그대로 굵게', (_name, run) => {
  const bolds = (text: string) => strongTexts(firstBlock(run(`<p>${text}</p>`)));

  test.each([
    ['약 3일 걸립니다', ['약 3일']],
    ['최대 12개월 지원', ['최대 12개월']],
    ['소요 시간(약 2시간)입니다', ['약 2시간']],
    ['끝났다. 약 3일 뒤에 온다', ['약 3일']],
    ['예상 최대 3일', ['최대 3일']],
    ['약3일 이내', ['약3일']],
    ['“약 3일” 이라고 합니다', ['약 3일']],
    ['[최대 5분] 소요', ['최대 5분']],
    ['~약 3일', ['약 3일']],
    ['순서: 약 2시간, 최대 3일', ['약 2시간', '최대 3일']],
  ])('"%s"', (text, expected) => {
    expect(bolds(text)).toEqual(expected);
  });

  test('태그 바로 뒤의 접두어도 접두어다 (<em>약 3일</em>)', () => {
    expect(bolds('<em>약 3일</em> 걸림')).toEqual(['약 3일']);
  });
});

describe.each(PLATFORMS)('%s — 기존 굵게는 그대로', (_name, run) => {
  const bolds = (text: string) => strongTexts(firstBlock(run(`<p>${text}</p>`)));

  test.each([
    ['2026년 11월', ['2026년']],
    ['출발 91일 이전', ['91일']],
    ['6개월 유지', ['6개월']],
    ['월 20만원, 이자 3.5%', ['20만원', '3.5%']],
    ['70만원 한도, 10% 캐시백', ['70만원', '10%']],
    ['1,500달러와 3,000,000원', ['1,500달러', '3,000,000원']],
    ['2026년 11월 5일 마감', ['2026년', '5일']],
  ])('"%s"', (text, expected) => {
    expect(bolds(text)).toEqual(expected);
  });

  test('자릿수를 넘는 값은 건드리지 않는다', () => {
    expect(bolds('12345원 결제, 1234% 오류')).toEqual([]);
  });

  test('숫자가 없으면 아무것도 굵게 하지 않는다', () => {
    expect(bolds('요약 예약 계약 절약 약 최대')).toEqual([]);
  });
});

describe.each(PLATFORMS)('%s — 태그 속성과 이미 굵은 글자', (_name, run) => {
  test('태그 속성 안의 숫자·접두어는 건드리지 않는다', () => {
    const attr = 'title="최대 3일 약 2시간 예약 5분"';
    const block = firstBlock(run(`<p>안내 <a href="https://example.com/a" ${attr}>링크</a> 끝</p>`));
    expect(strongTexts(block)).toEqual([]);
    expect(block).toContain(attr);
  });

  test('속성 옆 본문 글자는 정상 처리한다', () => {
    const block = firstBlock(run('<p><a href="https://example.com/약-3일" title="x">예약 3일</a> 안내</p>'));
    expect(strongTexts(block)).toEqual(['3일']);
    expect(block).toContain('href="https://example.com/약-3일"');
  });

  test('이미 굵은 문단은 다시 감싸지 않는다', () => {
    const block = firstBlock(run('<p><strong>약 3일</strong> 뒤 예약 5분, 2026년</p>'));
    expect(strongTexts(block)).toEqual(['약 3일']);
    expect(block).not.toMatch(/<strong\b[^>]*>[^<]*<strong\b/i);
    expect(block).not.toMatch(/<\/strong>\s*<\/strong>/i);
  });
});

describe('두 발행 경로가 같은 규칙을 쓴다', () => {
  const PUBLISHERS = ['src/wordpress/wordpress-publisher.ts', 'src/core/blogger-publisher.js'];
  const durationRule = (file: string): string[] =>
    read(file)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.includes('(?:년|개월|일|시간|분))(?![^<]*>)'));

  test.each(PUBLISHERS)('%s 에 기간 규칙이 한 줄 있다', (file) => {
    expect(durationRule(file)).toHaveLength(1);
  });

  test('기간 규칙 줄이 두 파일에서 글자까지 같다', () => {
    expect(durationRule(PUBLISHERS[0])).toEqual(durationRule(PUBLISHERS[1]));
  });

  test.each(PUBLISHERS)('%s 의 접두어 앞에 글자 검사가 있다', (file) => {
    const [line] = durationRule(file);
    // "최대"/"약" may only act as a prefix when no Hangul/Latin letter is glued in front of it.
    expect(line).toMatch(/\(\?<!\[가-힣A-Za-z\]\)\(\?:최대\\s\*\|약\\s\*\)/);
  });
});
