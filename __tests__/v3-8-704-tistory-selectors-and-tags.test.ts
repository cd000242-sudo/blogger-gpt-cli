/**
 * v3.8.704 — 티스토리 발행이 **태그 하나 때문에 통째로 실패**하던 문제
 *
 * 사장님: "발행 실패: Tistory tag input was not found or tags could not be added. 이건 왜이래??"
 *
 * ## 원인 둘
 * ① 한글 선택자가 **전부 죽어 있었다.** 소스에 `\\uD0DC\\uADF8` 로 적혀 있어 런타임 문자열이
 *    `태그`(백슬래시+u+숫자, 글자 그대로)가 됐다. CSS 도 Playwright 의 has-text 도
 *    이걸 한글로 읽지 못한다. 실측 **60곳**이 그랬다 — 제목·태그·카테고리·저장·발행 버튼까지.
 *    사실상 `input#tagText` 하나로 버티고 있었고, 티스토리가 그 id 를 바꾸면 발행이 멈춘다.
 *
 * ② 태그를 못 넣으면 **발행 전체를 실패**시켰다. 본문·제목·카테고리까지 다 채워 놓고
 *    태그 칸 하나 때문에 글을 통째로 버리는 셈이다. 태그는 부가 정보다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { TISTORY_SELECTORS } from '../src/tistory/tistory-selectors';
import { blockBetween } from './helpers/source-block';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const selectorsSrc = read('src/tistory/tistory-selectors.ts');
const publisher = read('src/tistory/tistory-publisher.ts');

describe('① 선택자가 실제로 한글을 매칭한다', () => {
  test('⭐ 소스에 깨진 유니코드 이스케이프가 남아 있지 않다', () => {
    // `\\uXXXX` 는 CSS·Playwright 가 한글로 못 읽는다 — 실측 60곳이 이 상태였다
    expect(selectorsSrc).not.toMatch(/\\\\u[0-9A-Fa-f]{4}/);
  });

  test('⭐ 런타임 값에 진짜 한글이 들어 있다', () => {
    const flat = JSON.stringify(TISTORY_SELECTORS);
    expect(flat).toContain('태그');
    expect(flat).toContain('제목');
    expect(flat).toContain('발행');
    // 글자 그대로의 백슬래시-u 가 남아 있으면 안 된다
    expect(flat).not.toMatch(/\\\\u[0-9A-Fa-f]{4}/);
  });

  /**
   * jsdom 을 깔지 않고도 이번 사고를 잡는다.
   * 놓쳤던 것은 "문자열엔 뭔가 있는데 브라우저는 아무것도 못 찾는" 상태였다 —
   * 그 원인이 백슬래시 이스케이프였으므로, **속성값 안의 백슬래시**와
   * 따옴표·괄호 짝을 본다. 실제 파서를 부르려면 의존성이 하나 늘어난다.
   */
  test('⭐ 모든 선택자에 짝이 맞고, 속성값에 백슬래시가 없다', () => {
    const all: string[] = [];
    const walk = (node: any) => {
      if (Array.isArray(node)) node.forEach((v) => (typeof v === 'string' ? all.push(v) : walk(v)));
      else if (node && typeof node === 'object') Object.values(node).forEach(walk);
    };
    walk(TISTORY_SELECTORS);
    expect(all.length).toBeGreaterThan(50);

    const broken = all.filter((s) => {
      const quotes = (s.match(/"/g) || []).length;
      const open = (s.match(/\[/g) || []).length;
      const close = (s.match(/\]/g) || []).length;
      const paren = (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length;
      // 속성값·텍스트 안의 백슬래시가 이번 사고의 지문이다
      const hasBackslash = /\\/.test(s);
      return hasBackslash || quotes % 2 !== 0 || open !== close || paren !== 0;
    });
    expect(broken).toEqual([]);
  });

  test('⭐ 태그 입력칸 후보가 한 개에 기대지 않는다', () => {
    // 예전엔 사실상 input#tagText 하나였다 — 그 id 가 바뀌면 발행이 멈춘다
    expect(TISTORY_SELECTORS.editor.tagInputs.length).toBeGreaterThanOrEqual(8);
    expect(TISTORY_SELECTORS.editor.tagInputs).toContain('input#tagText');
    expect(TISTORY_SELECTORS.editor.tagInputs.some((s) => s.includes('태그'))).toBe(true);
  });
});

describe('② 태그를 못 넣어도 글은 나간다', () => {
  test('⭐ 더 이상 발행을 중단시키지 않는다', () => {
    expect(publisher).not.toContain("throw new Error('Tistory tag input was not found or tags could not be added.')");
  });

  test('⭐ 대신 못 넣었다고 알린다 — 조용히 넘기지 않는다', () => {
    expect(publisher).toContain('개를 넣지 못했습니다 — 글은 그대로 발행합니다');
    expect(publisher).toContain('개만 들어갔습니다');
  });

  test('⭐ 결과에도 숫자로 실어 보낸다', () => {
    expect(publisher).toContain('tagsRequested: tags.length');
    expect(publisher).toContain('tagsAdded: addedTags');
    expect(read('src/tistory/tistory-types.ts')).toContain('tagsRequested?: number;');
  });

  test('제목·본문처럼 진짜 중요한 것은 여전히 실패로 막는다', () => {
    // 태그만 부가 정보다 — 본문이 안 들어가면 빈 글이 나간다
    expect(publisher).toMatch(/throw new Error\(/);
  });
});

describe('③ 못 찾았을 때 다음에 볼 것을 남긴다', () => {
  const fn = blockBetween(publisher, 'async function fillTags', 'async function setVisibility');

  test('⭐ 화면의 입력칸을 적어 둔다 — 다시 재현하지 않아도 되게', () => {
    expect(fn).toContain('화면의 입력칸');
    expect(fn).toContain("querySelectorAll('input[type=\"text\"], input:not([type]), textarea')");
  });

  test('진단이 실패해도 예전 메시지로 물러선다', () => {
    expect(fn).toContain("log(onLog, 'Tag input was not found. Skipping tags.')");
  });
});
