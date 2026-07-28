/**
 * 발행 검수 게이트 테스트 (v3.8.384)
 *
 * 이 게이트는 2026-07-28 실측으로 확인된 "발행 성공인데 색인에서 죽는 글"의
 * 원인들을 발행 전에 잡는다. 각 테스트는 실제 사고 사례에 대응한다.
 *
 * 최우선 불변식: 게이트는 절대 throw 하지 않는다. 게이트 버그로 발행이 멈추면 그게 최악이다.
 */
import {
  verifyBeforePublish,
  stripNonProse,
  looksLikeJsonPollution,
} from '../src/core/publish-verifier';

// 게이트를 통과해야 하는 정상 본문 (1000자 이상 + 이미지 + 내부링크)
const GOOD_HTML =
  '<h2>청년월세지원 신청 방법</h2>' +
  '<img src="https://leadernam.com/wp-content/uploads/a.jpg" alt="안내">' +
  '<p>' + '서울시 청년월세지원은 서울주거포털에서 신청합니다. '.repeat(40) + '</p>' +
  '<a href="https://leadernam.com/금융-보험/related/">관련 글</a>';

describe('stripNonProse — JSON-LD 오염의 근본 원인', () => {
  it('script 블록을 통째로 제거한다 (태그만 벗기면 JSON 본문이 남는다)', () => {
    const html = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"HowTo"}</script>'
      + '<p>실제 본문입니다.</p>';
    const out = stripNonProse(html);
    expect(out).toBe('실제 본문입니다.');
    expect(out).not.toContain('@context');
    // 대조: 기존의 순진한 방식은 JSON 본문을 남긴다 — 이것이 11편 오염의 원인이었다
    expect(html.replace(/<[^>]*>/g, '')).toContain('@context');
  });

  it('style 블록과 주석도 제거한다', () => {
    expect(stripNonProse('<style>.a{color:red}</style><!-- 메모 --><p>본문</p>')).toBe('본문');
  });

  it('엔티티를 공백으로 정규화한다', () => {
    expect(stripNonProse('<p>가&nbsp;나&#38;다</p>')).toBe('가 나 다');
  });
});

describe('looksLikeJsonPollution', () => {
  it.each([
    ['{"@context":"https://schema.org"', true],
    ['["a","b"]', true],
    ['"{"@graph":[]', true],
    ['서울 청년월세지원 결과는 서울주거포털에서 확인합니다.', false],
    ['', false],
  ])('%s → %s', (input, expected) => {
    expect(looksLikeJsonPollution(input)).toBe(expected);
  });
});

describe('절대 throw 하지 않는다', () => {
  it.each([
    ['빈 입력', {}],
    ['html null', { html: null as any }],
    ['title 숫자', { html: GOOD_HTML, title: 123 as any }],
    ['siteUrl 이 URL이 아님', { html: GOOD_HTML, siteUrl: 'not a url' }],
    ['metaDescription 객체', { html: GOOD_HTML, metaDescription: {} as any }],
  ])('%s → throw 없이 결과 반환', (_name, input) => {
    expect(() => verifyBeforePublish(input as any)).not.toThrow();
    const r = verifyBeforePublish(input as any);
    expect(typeof r.blocked).toBe('boolean');
    expect(Array.isArray(r.issues)).toBe(true);
  });
});

describe('wordpress-publisher 소스 가드', () => {
  const src = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'src', 'wordpress', 'wordpress-publisher.ts'), 'utf8');

  it('메타 생성에 순진한 태그 제거가 남아 있지 않다', () => {
    // content.replace(/<[^>]*>/g, ...) 는 script 안 JSON을 남긴다 — 재발 방지 가드
    const offenders = src.split('\n')
      .map((line: string, i: number) => ({ line: line.trim(), no: i + 1 }))
      .filter(({ line }: { line: string }) =>
        /content\s*\.?\s*replace\(\/<\[\^>\]\*>\/g/.test(line) && !line.startsWith('//'));
    expect(offenders.map((o: any) => `${o.no}: ${o.line}`)).toEqual([]);
  });

  it('stripNonProse 를 import 한다', () => {
    expect(src).toContain("import { stripNonProse } from '../core/publish-verifier'");
  });
});
