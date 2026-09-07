/**
 * v3.8.695 — 티스토리 ① 썸네일 두 번 ② 본문에 SCRIPT 가 글자로 노출
 *
 * 사장님 실물 검수:
 *   "티스토리 수정해야겠어 썸네일두번나오고"
 *   "미리보기 수정 누르고 들어가면 티스토리는 스크립트가 미리보기에 노출되어있고 삭제도 안돼"
 *
 * ## 두 문제가 한 뿌리였다
 * 티스토리 퍼블리셔의 썸네일 중복 제거는 전부 `^\s*` — **본문 맨 앞**을 붙잡고 있었다.
 * 그런데 발행 직전 Schema.org JSON-LD `<script>` 가 본문 **앞**에 끼어들면서
 * (orchestration: `${schema.scriptTag}\n${html}`) 앵커가 빗나갔다.
 *   → 썸네일이 안 지워져 대표이미지와 본문 첫 이미지가 나란히 두 번 나왔다.
 *   → 그 script 는 티스토리 편집기가 "SCRIPT" 딱지를 붙여 글자로 노출시킨다.
 *
 * ## 고친 것 셋
 *   ① 티스토리에는 JSON-LD 를 본문에 넣지 않는다(스킨 head 의 몫이다).
 *   ② 썸네일 제거를 앵커 대신 "앞부분에서 처음 걸리는 하나"로 바꾼다.
 *   ③ 편집기: 미리보기에서 script 를 숨기고, 저장할 때 JSON-LD 는 **지우지 않는다**.
 *      (지우고 있었다 — 편집기로 한 번 저장하면 그 글의 구조화 데이터가 통째로 날아갔다.)
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const publisher = read('src/tistory/tistory-publisher.ts');
const orchestration = read('src/core/final/orchestration.ts');
const editor = read('electron/ui/modules/editor.js');

/** 퍼블리셔의 비공개 함수 둘을 소스에서 떼어내 그대로 돌린다 — 코드가 곧 시험 대상이다 */
function loadStripper() {
  // 한 덩어리로 떼어낸다 — 두 번 자르면 같은 선언이 두 번 들어간다
  const region = publisher.slice(
    publisher.indexOf('function stripLeadingTemporaryImage'),
    publisher.indexOf('export function buildTistoryImageFallback'),
  ).replace(/:\s*(string|RegExp)\b/g, '');
  const helpers = `
    function escapeRegExp(s){ return String(s).replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'); }
    function normalizeTistoryPublishedImageUrl(u){ return String(u || '').trim(); }
    ${region}
    return stripGeneratedThumbnailHero;
  `;
  // eslint-disable-next-line no-new-func
  return new Function(helpers)() as (html: string, url: string) => string;
}

describe('① 썸네일이 두 번 나오지 않는다', () => {
  const strip = loadStripper();
  const THUMB = 'https://img1.daumcdn.net/thumb/x/abc.png';
  const heroBox = `<div class="bgpt-thumbnail-box" style="width:100%"><img src="${THUMB}" alt="제목" /></div>`;
  const body = '<h2>1. 첫 소제목</h2><p>본문입니다.</p>';

  test('맨 앞에 있으면 지운다 (예전에도 되던 것)', () => {
    expect(strip(`${heroBox}\n${body}`, THUMB)).not.toContain('bgpt-thumbnail-box');
  });

  test('⭐ 앞에 JSON-LD 가 끼어 있어도 지운다 — 이번 사고의 그 모양', () => {
    const withSchema = `<script type="application/ld+json">{"@type":"Article"}</script>\n${heroBox}\n${body}`;
    const out = strip(withSchema, THUMB);
    expect(out).not.toContain('bgpt-thumbnail-box');
    expect(out).toContain('첫 소제목');            // 본문은 그대로
    expect(out).toContain('application/ld+json');  // 스키마는 퍼블리셔가 건드리지 않는다
  });

  test('⭐ 감싼 태그(p·div·figure)가 달라도 그 이미지를 걷어낸다', () => {
    for (const tag of ['p', 'div', 'figure']) {
      const html = `<script>x</script><${tag}><img src="${THUMB}" alt="x" /></${tag}>${body}`;
      expect(strip(html, THUMB)).not.toContain(THUMB);
    }
  });

  test('⭐ 글 한참 뒤의 같은 이미지는 건드리지 않는다 — 중복은 늘 맨 위에서 생긴다', () => {
    const filler = '<p>내용</p>'.repeat(500);   // 4000자 넘김
    const html = `${heroBox}${filler}<p><img src="${THUMB}" alt="본문에서 다시 씀" /></p>`;
    const out = strip(html, THUMB);
    expect(out).not.toContain('bgpt-thumbnail-box');
    expect(out).toContain('본문에서 다시 씀');    // 뒤쪽 것은 살아 있다
  });

  test('썸네일이 없으면 아무것도 지우지 않는다', () => {
    expect(strip(body, '')).toContain('첫 소제목');
  });
});

describe('② 티스토리 본문에는 JSON-LD 를 넣지 않는다', () => {
  test('⭐ 플랫폼으로 갈라진다', () => {
    expect(orchestration).toContain("const skipBodyJsonLd = /tistory/i.test(String(platform || ''))");
  });

  test('⭐ 건너뛸 때는 삽입 코드가 아예 돌지 않는다', () => {
    // 길이가 아니라 경계로 자른다 (feedback: 고정 길이 슬라이스 금지)
    const block = blockBetween(orchestration, 'const skipBodyJsonLd', '// <article> 시작 직전에 삽입');
    expect(block).toContain('if (skipBodyJsonLd) {');
    expect(block.indexOf('if (skipBodyJsonLd) {')).toBeLessThan(block.indexOf('buildSchemaJsonLd({'));
  });

  test('워드프레스·블로거는 예전 그대로 넣는다', () => {
    expect(orchestration).toContain('${schema.scriptTag}');
  });

  test('건너뛰었다고 화면에 알린다 — 조용히 빠뜨리지 않는다', () => {
    expect(orchestration).toContain('JSON-LD 는 본문에 넣지 않습니다');
  });
});

describe('③ 편집기 — 미리보기에서 숨기되 저장할 때는 지키다', () => {
  test('⭐ 미리보기에서 script 가 안 보인다', () => {
    expect(editor).toContain('script{display:none!important;}');
  });

  test('⭐ 저장할 때 JSON-LD 를 지우지 않는다 (지우고 있었다 — 조용한 손실)', () => {
    const fn = editor.slice(editor.indexOf('export function serializeEditor'));
    const head = fn.slice(0, 2600);
    expect(head).toContain("type === 'application/ld+json'");
    expect(head).toContain('return;');
  });

  test('⭐ 실행되는 스크립트는 여전히 지운다 — 남의 코드를 실어 나르지 않는다', () => {
    const fn = editor.slice(editor.indexOf('export function serializeEditor'));
    expect(fn.slice(0, 2600)).toContain('el.remove();');
  });

  test('광고 자리 치환은 script 정리 뒤에 그대로 남아 있다 (기존 규칙)', () => {
    const fn = editor.slice(editor.indexOf('export function serializeEditor'));
    const head = fn.slice(0, 3000);
    expect(head.indexOf("querySelectorAll('script')")).toBeLessThan(head.indexOf('expandAdSlots('));
  });
});
