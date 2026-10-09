/**
 * v3.8.758 — 블로그스팟에서 CTA 버튼 끝에 "&#8594;" 글자가 찍히던 것 · 글꼴 하나가 안 불려오던 것
 *
 * 실측(2026-10-09, 고객 블로그스팟 글 2편):
 *   블로그스팟은 글을 저장할 때 특수기호(→ — · ✅ …)와 & 를 HTML 기호(&#8594; &amp;)로 바꾼다.
 *   본문 글자·속성 값은 브라우저가 되돌려 읽지만 <style> 안은 되돌리지 않는다.
 *     .cta-btn::after { content: "→" }      → 버튼에 "&#8594;" 가 그대로 보임
 *     @import url("…700&family=IBM+Plex…")  → "&amp;family" 로 바뀌어 IBM Plex Mono 미로드 · display=swap 소실
 *   워드프레스 글(leadernam REST 20편)은 & 가 그대로라 문제 없었다.
 *
 * 고치는 법: 주석 밖 CSS 는 ASCII 로만 쓰고 &·특수기호는 CSS 이스케이프(\26 · \2192)로 쓴다.
 * 블로그스팟은 역슬래시를 건드리지 않는다(같은 페이지 테마의 content:"\201c" 가 그대로 살아 있음).
 * 실제 브라우저(Edge)에서 \2192 → "→", \26 → "&" 로 읽혀 글꼴 두 개가 다 불려오는 것까지 확인했다.
 */
import { generateCSSFinal } from '../src/core/final/html';

const outsideComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('v3.8.758 블로그스팟에서도 깨지지 않는 스킨 CSS', () => {
  const cases: Array<[string, string | undefined]> = [
    ['blogger', undefined],
    ['blogger', 'adsense'],
    ['wordpress', undefined],
  ];

  test.each(cases)('%s/%s: 주석 밖에 & 가 없다 (블로그스팟이 &amp; 로 바꾼다)', (platform, mode) => {
    const css = outsideComments(generateCSSFinal(platform, mode));
    expect(css.match(/&/g) || []).toEqual([]);
  });

  test.each(cases)('%s/%s: 주석 밖에 ASCII 가 아닌 글자가 없다 (블로그스팟이 &#…; 로 바꾼다)', (platform, mode) => {
    const css = outsideComments(generateCSSFinal(platform, mode));
    const found = [...new Set(css.match(/[^\x00-\x7F]/g) || [])];
    expect(found).toEqual([]);
  });

  test('CTA 화살표는 이스케이프로 그대로 남는다(빼 버린 게 아니다)', () => {
    const css = outsideComments(generateCSSFinal('blogger'));
    expect(css).toContain('.cta-btn::after {\n  content: "\\2192" !important;');
  });

  test('글꼴 주소는 두 글꼴과 display=swap 을 그대로 요청한다', () => {
    const css = outsideComments(generateCSSFinal('blogger'));
    expect(css).toContain(
      '@import url("https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700\\26 family=IBM+Plex+Mono:wght@400;500\\26 display=swap");',
    );
  });
});
