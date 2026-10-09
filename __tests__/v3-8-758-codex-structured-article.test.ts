/**
 * v3.8.758 — 형식표가 열리자 드러난 본문 회수 버그
 *
 * 실측(2026-10-09, 고친 앱 + 실제 Codex 0.162 한 편, fixtures/codex-final-message-758.json):
 *   · 윈도우에서 Codex 가 파일을 못 써(읽기 전용) 본문을 마지막 답의 articleHtml 칸으로 보냈다.
 *   · 마지막 답은 형식표대로 JSON 인데, 앱은 그 **글자 그대로**에서 HTML 을 찾았다 →
 *     본문에 글자 그대로의 \n 117개 · \" 6개(따옴표 기호)가 섞였다.
 *   · 게다가 본문 칸 안에 "ARTICLE_HTML_BEGIN" 표시까지 들어 있었다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { parseAgentFinalResponse, unwrapArticleMarkers } from '../src/core/final/agent-output-schema';

const finalMessage = fs.readFileSync(path.join(__dirname, 'fixtures', 'codex-final-message-758.json'), 'utf8');
const mainTs = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.ts'), 'utf8');

describe('v3.8.758 실제 Codex 마지막 답에서 본문 꺼내기', () => {
  const parsed = parseAgentFinalResponse(finalMessage);

  test('제목·출처를 읽는다', () => {
    expect(parsed.title).toContain('전기요금 누진제');
    expect(parsed.sources.length).toBeGreaterThan(0);
  });

  test('본문은 진짜 HTML — JSON 기호(\\n · \\")가 글자로 남지 않는다', () => {
    expect(parsed.articleHtml).toMatch(/<h2\b/);
    expect(parsed.articleHtml).not.toContain('\\n');
    expect(parsed.articleHtml).not.toContain('\\"');
  });

  test('본문 칸에 섞여 온 ARTICLE_HTML_BEGIN/END 표시를 벗긴다', () => {
    expect(finalMessage).toContain('ARTICLE_HTML_BEGIN');
    expect(parsed.articleHtml).not.toMatch(/ARTICLE_HTML_(BEGIN|END)/);
  });

  test.each([
    ['ARTICLE_HTML_BEGIN\n<p>a</p>\nARTICLE_HTML_END', '<p>a</p>'],
    ['ARTICLE_HTML_BEGIN\n```html\n<p>b</p>\n```\nARTICLE_HTML_END', '<p>b</p>'],
    ['<p>c</p>', '<p>c</p>'],
    ['ARTICLE_HTML_BEGIN <p>d</p>', '<p>d</p>'],
  ])('표시 벗기기: %s', (input, expected) => {
    expect(unwrapArticleMarkers(input)).toBe(expected);
  });

  test('앱은 JSON 을 먼저 풀어 본문 칸을 쓰고, 그다음에야 글자 그대로 찾기', () => {
    const at = mainTs.indexOf("contentSource = 'finalMessage.articleHtml';");
    expect(at).toBeGreaterThan(-1);
    const block = mainTs.slice(mainTs.indexOf('let fromStructured = \'\';'), mainTs.indexOf("contentSource = 'stdout (fallback)';"));
    expect(block.indexOf('parseAgentFinalResponse(finalMessage)')).toBeLessThan(block.indexOf('extractHtmlFromAgentText(finalMessage)'));
    expect(block).toContain("const fromFinal = fromStructured ? '' : extractHtmlFromAgentText(finalMessage);");
  });
});
