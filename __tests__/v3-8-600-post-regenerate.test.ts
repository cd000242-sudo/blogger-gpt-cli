/**
 * v3.8.600 — 발행된 글을 제자리에서 다시 만든다
 *
 * 사장님: "글목록에 글 다시생성이나 AI 이미지 다시생성하기 기능넣어달라니까 안했네"
 *         "지금처럼 글이 안 나온 상태로 발행이 됐다면 다시 글 생성하고 이미지 넣고
 *          수정발행이 가능해야 되니까요"
 *
 * 실제로 본문이 `and` 한 단어인 글이 나갔다(발행글 5441). 그때 할 수 있는 게 삭제뿐이면
 * 그 글의 색인이 통째로 날아간다. 사장님 확정: **A(제자리 교체)**.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  findPostImages,
  replaceImageSrcs,
  buildImagePromptFor,
  judgeRegenerated,
  htmlToText,
  MIN_REGENERATED_TEXT,
} from '../src/core/final/post-regenerate';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

const GOOD = `<p>${'국민연금 수령액은 가입 기간과 소득에 따라 달라집니다. '.repeat(12)}</p>`;

describe('덮어쓸 가치가 있는지 먼저 본다', () => {
  test('짧은 본문으로는 덮지 않는다 — 사고를 낸 "and" 가 여기 걸린다', () => {
    const v = judgeRegenerated('and', GOOD);
    expect(v.ok).toBe(false);
    expect(v.reason).toContain('최소 200자');
  });

  test('기존보다 절반도 안 되면 덮지 않는다 (퇴보 방지)', () => {
    // 길이 하한(200자)은 넘지만 기존(약 640자)의 절반에는 못 미치는 크기라야
    // "퇴보" 규칙이 걸린다 — 짧으면 길이 규칙에 먼저 걸려 이 규칙을 시험하지 못한다
    const half = `<p>${'국민연금 수령액 안내입니다. '.repeat(17)}</p>`;
    const v = judgeRegenerated(half, `<p>${'국민연금 수령액 안내입니다. '.repeat(40)}</p>`);
    expect(v.ok).toBe(false);
    expect(v.reason).toContain('절반도');
  });

  test('멀쩡하면 통과하고 길이를 알려 준다', () => {
    const v = judgeRegenerated(GOOD, 'and');
    expect(v.ok).toBe(true);
    expect(v.length).toBeGreaterThanOrEqual(MIN_REGENERATED_TEXT);
  });

  test('기존 글이 없어도(신규) 길이만 보면 된다', () => {
    expect(judgeRegenerated(GOOD).ok).toBe(true);
  });

  test('태그를 걷어낸 실제 글자로 잰다 — 빈 div 로 통과하면 안 된다', () => {
    expect(judgeRegenerated('<div></div>'.repeat(200)).ok).toBe(false);
    expect(htmlToText('<p>가</p><p>나</p>')).toBe('가 나');
  });
});

describe('이미지를 찾고 주소만 갈아끼운다', () => {
  const HTML = [
    '<h2>첫 번째 소제목</h2>',
    '<p><img src="https://old.example/a.webp" alt="첫 그림" class="bgpt-img" loading="lazy"></p>',
    '<h2>두 번째 소제목</h2>',
    '<p><img src="https://old.example/b.webp" alt="둘째 그림"></p>',
  ].join('\n');

  test('앞선 H2 를 단서로 물어 온다', () => {
    const images = findPostImages(HTML);
    expect(images).toHaveLength(2);
    expect(images[0]?.sectionTitle).toBe('첫 번째 소제목');
    expect(images[1]?.sectionTitle).toBe('두 번째 소제목');
    expect(images[0]?.src).toBe('https://old.example/a.webp');
  });

  test('src 만 바꾸고 나머지 속성은 그대로 둔다', () => {
    const out = replaceImageSrcs(HTML, new Map([[0, 'https://new.example/a.webp']]));
    expect(out).toContain('src="https://new.example/a.webp"');
    expect(out).toContain('class="bgpt-img"');   // 발행기가 넣은 속성이 살아 있어야 한다
    expect(out).toContain('loading="lazy"');
    expect(out).toContain('alt="첫 그림"');
  });

  test('실패한 이미지는 기존 주소를 유지한다', () => {
    const out = replaceImageSrcs(HTML, new Map([[0, 'https://new.example/a.webp']]));
    expect(out).toContain('https://old.example/b.webp');  // 1번은 그대로
  });

  test('이미지가 없으면 빈 배열', () => {
    expect(findPostImages('<p>글만 있습니다</p>')).toHaveLength(0);
  });

  test('그릴 것을 소제목으로 정하고, 없으면 제목으로 돌아간다', () => {
    expect(buildImagePromptFor('국민연금 수령액', '신청 방법')).toBe('국민연금 수령액 — 신청 방법');
    expect(buildImagePromptFor('국민연금 수령액', '')).toBe('국민연금 수령액');
  });
});

describe('화면과 백엔드가 실제로 이어져 있다 (조용한 미배선 방지)', () => {
  const ui = read('electron/ui/modules/published-posts.js');
  const main = read('electron/main.ts');

  test('버튼 두 개가 카드에 있다', () => {
    expect(ui).toContain('class="ppRegenBtn"');
    expect(ui).toContain('class="ppRegenImgBtn"');
    expect(ui).toContain('🔄 글 다시 생성');
    expect(ui).toContain('🖼️ 이미지 다시 생성');
  });

  test('버튼이 부르는 채널이 main 에 실존한다', () => {
    expect(ui).toContain("invoke('regenerate-published-post'");
    expect(main).toContain("ipcMain.handle('regenerate-published-post'");
  });

  test('카드 클릭(편집 열기)과 섞이지 않는다', () => {
    expect(ui).toContain(".closest('.ppRegenBtn')");
    expect(ui).toContain(".closest('.ppRegenImgBtn')");
  });

  test('제목은 건드리지 않고 본문만 갱신한다 — 주소가 제목에서 왔다', () => {
    expect(main).toContain('adapter.updatePost(postId, { content: nextHtml })');
  });

  test('덮기 전에 판정을 거친다', () => {
    expect(main).toContain('judgeRegenerated(nextHtml, previousHtml)');
    expect(main).toContain('기존 글은 건드리지 않았습니다');
  });
});

/**
 * v3.8.603 — 사장님: "다시 글 생성하는 건 왜 미리보기·수정에 안 뜨나요?"
 * 목록 카드에만 있고 편집기에는 없었다. 글이 깨진 건 미리보기에서 보게 되는데
 * 고치려면 창을 닫고 목록으로 돌아가야 했다.
 */
describe('편집기에서도 다시 만들 수 있다', () => {
  const editor = read('electron/ui/modules/editor.js');
  const main = read('electron/main.ts');

  test('편집기 도구줄에 버튼 두 개가 있다', () => {
    expect(editor).toContain('id="veRegenBtn"');
    expect(editor).toContain('id="veRegenImgBtn"');
  });

  test('목록과 같은 채널을 부른다 (두 벌로 만들지 않는다)', () => {
    expect(editor).toContain("invoke('regenerate-published-post'");
  });

  test('이미 발행된 글에서만 보인다 — 대기열·파일에는 postId 가 없다', () => {
    expect(editor).toMatch(/regenWrap[\s\S]{0,120}getPublishedSource\(kind\) && postId/);
  });

  test('편집기가 읽는 html 을 백엔드가 실제로 돌려준다 (조용한 미배선 방지)', () => {
    expect(editor).toContain('res.html');
    expect(main).toContain('html: nextHtml');
  });
});
