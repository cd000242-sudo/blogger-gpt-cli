/**
 * v3.8.599 — 마커를 **말로 언급한 것**을 본문으로 회수하던 버그
 *
 * 사장님: "내가발행해봣는데 글이 통쨰로 사라졋네"
 *
 * 실측(발행글 5441 "월급 300만 원, 95년생·85년생 국민연금 수령액"):
 *   워드프레스 content.rendered 가 문자 그대로 `and` 였다. 원문은 32,324자.
 *
 * 왜: 에이전트가 파일을 못 써서(Write·Bash·PowerShell 전부 차단) 지시서의 폴백대로
 * 마커 사이에 본문을 출력했는데, 그 **직전에 지시문을 인용**했다:
 *   …("If file writing is blocked, print between ARTICLE_HTML_BEGIN and ARTICLE_HTML_END …")
 * 첫 BEGIN + 첫 END 를 잡는 정규식이 그 사이의 " and " 를 본문으로 회수했다.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

/** main.ts 의 추출기를 그대로 떼어 와 시험한다 (거대 파일이라 import 불가) */
function loadExtractor(): (text: string) => string {
  const src = read('electron/main.ts');
  const start = src.indexOf('function extractHtmlFromAgentText');
  expect(start).toBeGreaterThan(-1);
  const end = src.indexOf('\nfunction extractAgentTextValue', start);
  // TS 타입 표기만 걷어낸다 (new Function 은 JS 만 읽는다) — 로직은 손대지 않는다
  const body = src.slice(start, end)
    .replace('function extractHtmlFromAgentText(text: string): string {', 'function extractHtmlFromAgentText(text) {')
    .replace('const candidates: string[] = [];', 'const candidates = [];');
  // 의존하는 헬퍼는 최소 구현으로 대체
  const stripMarkdownFence = (v: string) => String(v || '')
    .replace(/^\s*```(?:html)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  // eslint-disable-next-line no-new-func
  return new Function('stripMarkdownFence', `${body}; return extractHtmlFromAgentText;`)(stripMarkdownFence);
}

const ARTICLE = `<article class="bgpt-wp-ready">
  <h1>월급 300만 원, 95년생·85년생 국민연금 수령액</h1>
  ${'<p>국민연금 수령액은 가입 기간과 소득에 따라 달라집니다.</p>'.repeat(12)}
</article>`;

/** 사고를 낸 실제 응답 모양 — 인용이 먼저 오고 진짜 블록이 뒤에 온다 */
const REAL_SHAPE = [
  'All file-writing tools — Write, Bash, and PowerShell — are denied in this environment,',
  'so I cannot create the files on disk. Per the instructions\' explicit fallback',
  '("If file writing is blocked, print between ARTICLE_HTML_BEGIN and ARTICLE_HTML_END as last resort"),',
  "I'm outputting the complete article HTML below.",
  '',
  'ARTICLE_HTML_BEGIN',
  '```html',
  ARTICLE,
  '```',
  'ARTICLE_HTML_END',
].join('\n');

describe('마커가 두 번 나와도 진짜 본문을 고른다', () => {
  const extract = loadExtractor();

  test('사고를 낸 그 응답에서 32KB 본문을 회수한다 (예전엔 "and")', () => {
    const got = extract(REAL_SHAPE);
    expect(got).not.toBe('and');
    expect(got).toContain('<article');
    expect(got).toContain('국민연금 수령액은');
    expect(got.length).toBeGreaterThan(500);
  });

  test('마커 쌍이 하나뿐인 정상 응답은 그대로 회수한다', () => {
    const got = extract(`ARTICLE_HTML_BEGIN\n${ARTICLE}\nARTICLE_HTML_END`);
    expect(got).toContain('<article');
  });

  test('코드펜스를 걷어낸다', () => {
    const got = extract(`ARTICLE_HTML_BEGIN\n\`\`\`html\n${ARTICLE}\n\`\`\`\nARTICLE_HTML_END`);
    expect(got.startsWith('<article')).toBe(true);
  });

  test('마커가 없으면 <article> 로 회수한다', () => {
    expect(extract(`설명입니다.\n${ARTICLE}`)).toContain('<article');
  });

  test('마커 안이 말뿐이고 밖에 진짜 HTML 이 있으면 HTML 을 고른다', () => {
    const text = `print between ARTICLE_HTML_BEGIN and ARTICLE_HTML_END please\n\n${ARTICLE}`;
    const got = extract(text);
    expect(got).toContain('<article');
    expect(got).not.toBe('and');
  });

  test('건질 게 없으면 빈 문자열', () => {
    expect(extract('아무것도 없습니다')).toBe('');
  });
});

describe('짧은 본문은 발행하지 않는다', () => {
  const main = read('electron/main.ts');

  test('길이 가드가 있고 200자 기준이다', () => {
    expect(main).toContain('MIN_ARTICLE_TEXT');
    expect(main).toContain('const MIN_ARTICLE_TEXT = 200');
    expect(main).toContain('hasContent = contentText.length >= MIN_ARTICLE_TEXT');
  });

  test('태그를 걷어낸 실제 글자 수로 잰다 (빈 div 로 통과하면 안 된다)', () => {
    expect(main).toContain("replace(/<[^>]*>/g, ' ')");
  });

  test('실패 문구가 몇 자였는지 말해 준다', () => {
    expect(main).toContain('자뿐이라 발행하지 않았습니다');
  });
});
