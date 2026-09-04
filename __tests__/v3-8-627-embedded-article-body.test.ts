const fs = require('fs');
const path = require('path');

import { extractEmbeddedArticle } from '../src/core/crawlers/embedded-article-body';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/** 200자 문턱을 넘기기 위한 채움 문단 — 내용은 중요하지 않다. */
const 긴문단 = '정부 합동조사단은 유출 규모와 경로를 확인했다고 밝혔다. '.repeat(8);

/*
 * v3.8.627 — 조선일보 기사로 글을 뽑으면 "개판"이 나오던 이유.
 *
 * 실측 2026-09-04, deepCrawlUrl 로 그 기사를 긁으면:
 *   제목 "티빙, 3954만 계정 개인정보 유출… 비번 등 싹 털렸다"
 *   본문 **0자**
 * 제목 한 줄로 2천 자를 쓰라고 시킨 셈이라 모델이 지어낼 수밖에 없었다.
 *
 * 원인은 순서였다. 조선일보는 Arc Publishing 을 써서 본문이
 * `<script>Fusion.globalContent={...}</script>` 안에 있는데,
 * deepCrawlUrl 이 추출 전에 script 를 통째로 지웠다.
 * 상자를 열기 전에 버린 것이다.
 *
 * 고친 뒤 같은 주소 실측: 0자 → 2,019자.
 */
describe('v3.8.627 스크립트 안에 숨은 기사 본문', () => {
  describe('Arc Publishing (Fusion) — 조선일보가 쓰는 방식', () => {
    const html = `<html><head><title>제목</title></head><body><h1>제목</h1>
      <script>window.Fusion=window.Fusion||{};Fusion.globalContent={"headlines":{"basic":"티빙 계정 정보 유출"},
      "content_elements":[{"type":"text","content":"${긴문단}"},{"type":"text","content":"두 번째 문단이다."}]};</script>
      </body></html>`;

    test('본문을 꺼내 온다', () => {
      const r = extractEmbeddedArticle(html);
      expect(r.source).toBe('fusion');
      expect(r.content.length).toBeGreaterThan(200);
      expect(r.content).toContain('두 번째 문단이다.');
    });

    test('제목도 함께 가져온다', () => {
      expect(extractEmbeddedArticle(html).title).toBe('티빙 계정 정보 유출');
    });

    test('본문 안에 중괄호가 있어도 JSON 을 제대로 끊는다', () => {
      const 까다로운 = `<script>Fusion.globalContent={"content_elements":[{"type":"text","content":"규칙은 {가} 형태로 쓴다. ${긴문단}"}]};</script>`;
      const r = extractEmbeddedArticle(까다로운);
      expect(r.source).toBe('fusion');
      expect(r.content).toContain('{가}');
    });

    test('HTML 태그는 걷어내고 평문만 남긴다', () => {
      const 태그포함 = `<script>Fusion.globalContent={"content_elements":[{"type":"text","content":"<b>굵게</b><br>${긴문단}"}]};</script>`;
      const r = extractEmbeddedArticle(태그포함);
      expect(r.content).toContain('굵게');
      expect(r.content).not.toContain('<b>');
    });
  });

  describe('JSON-LD 의 articleBody — 표준을 지키는 매체', () => {
    test('articleBody 를 본문으로 쓴다', () => {
      const html = `<html><body><script type="application/ld+json">
        {"@type":"NewsArticle","headline":"표준 기사","articleBody":"${긴문단}"}
      </script></body></html>`;
      const r = extractEmbeddedArticle(html);
      expect(r.source).toBe('ld-json');
      expect(r.title).toBe('표준 기사');
    });

    test('블록이 여러 개면 본문이 든 쪽을 찾아낸다', () => {
      const html = `<html><body>
        <script type="application/ld+json">{"@type":"BreadcrumbList","itemListElement":[]}</script>
        <script type="application/ld+json">{"@type":"NewsArticle","articleBody":"${긴문단}"}</script>
      </body></html>`;
      expect(extractEmbeddedArticle(html).source).toBe('ld-json');
    });

    test('깨진 블록이 있어도 멈추지 않고 다음 블록을 본다', () => {
      const html = `<html><body>
        <script type="application/ld+json">{이건 JSON 이 아니다}</script>
        <script type="application/ld+json">{"@type":"NewsArticle","articleBody":"${긴문단}"}</script>
      </body></html>`;
      expect(extractEmbeddedArticle(html).source).toBe('ld-json');
    });
  });

  describe('Next.js (__NEXT_DATA__)', () => {
    test('깊이 묻힌 본문도 찾는다', () => {
      const html = `<script id="__NEXT_DATA__" type="application/json">
        {"props":{"pageProps":{"article":{"title":"넥스트 기사","content":"${긴문단}"}}}}
      </script>`;
      const r = extractEmbeddedArticle(html);
      expect(r.source).toBe('next-data');
      expect(r.title).toBe('넥스트 기사');
    });
  });

  describe('없는 것을 있다고 하지 않는다', () => {
    test('평범한 HTML 은 none 을 돌려준다', () => {
      const r = extractEmbeddedArticle('<html><body><article><p>본문입니다.</p></article></body></html>');
      expect(r.source).toBe('none');
      expect(r.content).toBe('');
    });

    test('너무 짧은 조각은 본문으로 치지 않는다 — 부제만 걸린 경우', () => {
      const html = `<script>Fusion.globalContent={"content_elements":[{"type":"text","content":"한 줄 요약."}]};</script>`;
      expect(extractEmbeddedArticle(html).source).toBe('none');
    });

    test('빈 입력·깨진 JSON 에도 터지지 않는다', () => {
      expect(extractEmbeddedArticle('').source).toBe('none');
      expect(extractEmbeddedArticle('<script>Fusion.globalContent={깨짐</script>').source).toBe('none');
    });
  });

  describe('배선 — 순서가 전부다', () => {
    const src = read('src/core/url-content-generator.ts');

    test('스크립트를 지우기 전에 본문을 꺼낸다', () => {
      const 추출 = src.indexOf('extractEmbeddedArticle(html)');
      const 삭제 = src.indexOf("$('script, style, nav");
      expect(추출).toBeGreaterThan(-1);
      expect(삭제).toBeGreaterThan(-1);
      // 이 순서가 뒤집히면 다시 본문 0자가 된다 — 버그의 핵심이 정확히 이것이었다
      expect(추출).toBeLessThan(삭제);
    });

    test('스크립트에서 찾은 본문이 더 길면 그걸 쓴다', () => {
      expect(src).toContain('embedded.content.length > content.length');
    });

    test('본문이 없으면 성공이라고 찍지 않는다', () => {
      expect(src).toContain('본문을 못 읽었습니다');
      // 예전에는 0자에도 ✅ 크롤링 완료 를 찍어 원인을 못 찾게 했다
      expect(src).toMatch(/if \(content\.length < EMPTY_BODY_THRESHOLD\)/);
    });

    test('본문이 없으면 글을 지어내지 않고 멈춘다', () => {
      const fn = src.slice(src.indexOf('export async function generateContentFromUrl'));
      expect(fn).toContain('EMPTY_BODY_THRESHOLD');
      expect(fn).toContain('throw new Error(describeCrawlFailure(url');
    });

    test('문턱은 기사 첫 문단에도 못 미치는 값이다', () => {
      expect(src).toContain('export const EMPTY_BODY_THRESHOLD = 200;');
    });
  });
});
