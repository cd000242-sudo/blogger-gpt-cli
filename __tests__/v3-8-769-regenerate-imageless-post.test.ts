/**
 * v3.8.769 - "Regenerate images" must work on a post that has zero images.
 *
 * Field report (2026-11-10 recording): the first publish made 0 images (Codex quota),
 * then "regenerate images" failed with "this post has no image to regenerate" and only
 * "generate all images" in the editor worked. Root cause: electron/main.ts returned an
 * error when findPostImages() found no <img>, because the old flow only swaps src values.
 * Fix: with no image, plan slots (thumbnail + one per heading) and insert new images.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  findPostImages,
  planMissingImageSlots,
  insertMissingImages,
} from '../src/core/final/post-regenerate';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

const BARE = [
  '<article>',
  '<p>intro</p>',
  '<h2>첫 번째 소제목</h2>',
  '<p>본문 하나</p>',
  '<h2>두 번째 소제목</h2>',
  '<p>본문 둘</p>',
  '</article>',
].join('\n');

describe('planMissingImageSlots - 이미지가 없는 글의 자리 계획', () => {
  test('썸네일 1장 + 소제목마다 1장', () => {
    const slots = planMissingImageSlots(BARE);
    expect(slots.map((s) => s.kind)).toEqual(['thumbnail', 'section', 'section']);
    expect(slots.map((s) => s.index)).toEqual([0, 1, 2]);
    expect(slots[0]?.sectionTitle).toBe('');
    expect(slots[1]?.sectionTitle).toBe('첫 번째 소제목');
    expect(slots[2]?.sectionTitle).toBe('두 번째 소제목');
  });

  test('H2 가 없으면 H3 를 소제목으로 쓴다', () => {
    const slots = planMissingImageSlots('<p>x</p><h3>작은 소제목</h3><p>y</p>');
    expect(slots.map((s) => s.sectionTitle)).toEqual(['', '작은 소제목']);
  });

  test('소제목이 하나도 없어도 썸네일 자리는 있다', () => {
    const slots = planMissingImageSlots('<p>소제목 없는 짧은 글</p>');
    expect(slots).toHaveLength(1);
    expect(slots[0]?.kind).toBe('thumbnail');
  });

  test('글자가 없는 빈 소제목은 건너뛴다', () => {
    const slots = planMissingImageSlots('<h2> </h2><h2>진짜 소제목</h2>');
    expect(slots.map((s) => s.sectionTitle)).toEqual(['', '진짜 소제목']);
  });
});

describe('insertMissingImages - 만든 이미지를 자리에 끼워 넣는다', () => {
  const urls = new Map<number, string>([
    [0, 'https://img.example/thumb.webp'],
    [1, 'https://img.example/a.webp'],
    [2, 'https://img.example/b.webp'],
  ]);

  test('썸네일은 본문 맨 앞, 소제목 이미지는 각 소제목 바로 뒤', () => {
    const out = insertMissingImages(BARE, urls);
    const images = findPostImages(out);
    expect(images.map((i) => i.src)).toEqual([
      'https://img.example/thumb.webp',
      'https://img.example/a.webp',
      'https://img.example/b.webp',
    ]);
    // 소제목 이미지는 자기 소제목 뒤에 있어야 한다 (썸네일은 앞선 소제목이 없다)
    expect(images.map((i) => i.sectionTitle)).toEqual(['', '첫 번째 소제목', '두 번째 소제목']);
    expect(out.indexOf('thumb.webp')).toBeLessThan(out.indexOf('<p>intro</p>'));
    expect(out.indexOf('</h2>')).toBeLessThan(out.indexOf('a.webp'));
  });

  test('글자는 한 글자도 바뀌지 않는다', () => {
    const out = insertMissingImages(BARE, urls);
    const strip = (h: string) => h.replace(/<div class="separator"[\s\S]*?<\/div>/g, '');
    expect(strip(out)).toBe(BARE);
  });

  test('만들지 못한 자리는 비워 둔다 - 있는 것만 넣는다', () => {
    const out = insertMissingImages(BARE, new Map([[2, 'https://img.example/b.webp']]));
    const images = findPostImages(out);
    expect(images).toHaveLength(1);
    expect(images[0]?.sectionTitle).toBe('두 번째 소제목');
  });

  test('아무것도 못 만들었으면 원문 그대로', () => {
    expect(insertMissingImages(BARE, new Map())).toBe(BARE);
  });

  test('주소의 따옴표가 속성을 깨지 못한다', () => {
    const out = insertMissingImages('<h2>제목</h2>', new Map([[1, 'https://x.example/a"onerror="1.webp']]));
    expect(out).not.toMatch(/src="[^"]*"onerror=/);
    expect(findPostImages(out)).toHaveLength(1);
  });

  test('발행기 문서(body)는 body 시작 직후에 썸네일을 둔다', () => {
    const doc = '<html><head><style>p{}</style></head><body><p>a</p><h2>소제목</h2></body></html>';
    const out = insertMissingImages(doc, new Map([[0, 'https://img.example/t.webp']]));
    expect(out.indexOf('<body>')).toBeLessThan(out.indexOf('t.webp'));
    expect(out.indexOf('t.webp')).toBeLessThan(out.indexOf('<p>a</p>'));
    expect(out.indexOf('<style>')).toBeLessThan(out.indexOf('t.webp'));
  });
});

describe('regenerate-published-post 연결', () => {
  const main = read('electron/main.ts');
  const handler = main.slice(main.indexOf("ipcMain.handle('regenerate-published-post'"));

  test('이미지 0장이라고 곧바로 실패를 돌려주지 않는다', () => {
    expect(handler).not.toMatch(/images\.length === 0\) return \{ ok: false, error: '이 글에는 다시 만들 이미지가 없습니다/);
  });

  test('빈 글은 자리 계획 → 끼워 넣기 경로를 탄다', () => {
    expect(handler).toContain('planMissingImageSlots');
    expect(handler).toContain('insertMissingImages');
  });
});
