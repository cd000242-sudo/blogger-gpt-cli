/**
 * R0 안전망 — 내부링크 삽입이 본문 HTML 구조를 훼손하지 않는지 (v3.8.376)
 *
 * 배경: internal-links.ts 의 insertInternalLinks 가 cheerio 의 $.html() 을 반환한다.
 *   cheerio 는 document 모드로 파싱하므로 결과가 <html><head>...</head><body>...</body></html> 로 감싸진다.
 *
 * ※ 정정(2026-07-28): 초기 조사에서 "발행글 5편이 이미 오염됨(id 4281,1771,1641,1534,1035)"이라고
 *   판단했으나 오진이었다. 그 5편은 전부 <!DOCTYPE html> + <!-- wp:html --> 을 동반한
 *   **의도적으로 삽입된 임베드 HTML 문서**(다크 카드/표 위젯)였다.
 *   cheerio 산출물은 DOCTYPE 없이 속성 없는 <html> 만 만들므로 구분된다.
 *   즉 라이브 오염 실적은 0편이고, 이 테스트는 **앞으로의 오염을 막는 예방용**이다.
 *   (버그 자체는 실재 — 아래 첫 케이스가 수정 전 실제로 실패했다)
 *
 * ⚠️ 이 테스트는 "오답 방지" 목적을 겸한다.
 *   $('body').html() 로 고치면 래퍼는 사라지지만, cheerio 가 선두의 <style> 을 <head> 로 올려버리기 때문에
 *   **모든 글의 CSS가 통째로 사라진다** (orchestration.ts 가 generateCSSFinal() 을 맨 앞에 붙인다).
 *   따라서 아래 3번 테스트가 그 오답을 잡는다. 정답은 fragment 모드다:
 *       cheerio.load(html, null, false)
 */

import { insertInternalLinks, type InternalLink } from '../src/core/internal-links';

const LINKS: InternalLink[] = [
  { title: '관련 글 하나', url: 'https://leadernam.com/a/', relevance: 90 },
  { title: '관련 글 둘', url: 'https://leadernam.com/b/', relevance: 85 },
];

/** orchestration.ts 가 실제로 조립하는 순서를 축약 재현: CSS가 맨 앞, JSON-LD가 뒤 */
const ARTICLE = [
  '<style>.bgpt-content{max-width:760px}.rv-h2{color:#111}</style>',
  '<div class="bgpt-content">',
  '<h1 class="post-title">테스트 제목</h1>',
  '<h2>첫 번째 소제목</h2>',
  '<p>첫 섹션 본문입니다. 충분히 긴 문단이어야 링크가 붙습니다.</p>',
  '<h2>두 번째 소제목</h2>',
  '<p>두 번째 섹션 본문입니다. 여기에도 문단이 있습니다.</p>',
  '</div>',
  '<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage"}</script>',
].join('');

describe('insertInternalLinks — 본문 구조 보존 (R0 안전망)', () => {
  const out = insertInternalLinks(ARTICLE, LINKS, 1);

  it('본문에 <html>/<head>/<body> 래퍼를 추가하지 않는다', () => {
    // 현재 구현($.html())은 여기서 실패한다 — 그게 이 테스트의 목적이다.
    expect(out).not.toMatch(/<html[\s>]/i);
    expect(out).not.toMatch(/<\/?head[\s>]/i);
    expect(out).not.toMatch(/<\/?body[\s>]/i);
  });

  it('선두의 <style> 블록이 사라지지 않고 맨 앞에 그대로 남는다', () => {
    // $('body').html() 로 고치면 여기서 실패한다 (오답 방지 가드)
    expect(out).toContain('<style>');
    expect(out.indexOf('<style>')).toBe(0);
    expect(out).toContain('.bgpt-content{max-width:760px}');
  });

  it('JSON-LD 스크립트가 정확히 1개 보존되고 파싱 가능하다', () => {
    const scripts = out.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];
    expect(scripts.length).toBe(1);
    const json = scripts[0]!.replace(/<script[^>]*>|<\/script>/gi, '');
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('H1이 정확히 1개다', () => {
    expect((out.match(/<h1[\s>]/gi) || []).length).toBe(1);
  });

  it('원래 본문 텍스트가 유실되지 않는다', () => {
    expect(out).toContain('첫 섹션 본문입니다');
    expect(out).toContain('두 번째 섹션 본문입니다');
    expect(out).toContain('테스트 제목');
  });

  it('링크가 실제로 삽입된다 (기능 회귀 방지)', () => {
    expect(out).toContain('https://leadernam.com/a/');
  });

  it('링크가 비면 입력을 그대로 돌려준다 (부작용 없음)', () => {
    expect(insertInternalLinks(ARTICLE, [], 1)).toBe(ARTICLE);
    expect(insertInternalLinks(ARTICLE, LINKS, 0)).toBe(ARTICLE);
  });
});
