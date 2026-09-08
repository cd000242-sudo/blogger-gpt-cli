/**
 * v3.8.708 — ① 티스토리 대표 이미지 ② 글목록 티스토리 썸네일 ③ CTA 점검 → 수정하기
 *
 * 사장님:
 *   "티스토리는 다좋은데 썸네일이 지정이안되네 제목부분에 썸네일이미지가 대표이미지로 선택되서 보여야되는데 안보여"
 *   "생성된 글목록은 티스토리 썸네일이 깨져서 보이네...?"
 *   "CTA 점검도 돌려서 죽은링크하고 분석은 잘하는데 수정하기누르니까 하나도 못고치네"
 *
 * 실측(2026-09-07) 원인 세 가지:
 *   ① 이어쓰기 confirm 승낙 → 옛 임시글 첨부가 대표로 · 첨부 버튼만 누르고 "사진"을 안 눌러 업로드 0회
 *      · 이미지는 iframe 에 있는데 메인 프레임만 봄 · 대표 배지엔 글자가 없는데 글자로 찾음
 *   ② 관리 화면엔 썸네일이 없고, 배경 이미지 폴백이 관리자 아이콘 스프라이트를 모든 행에 실음
 *   ③ 렌더러는 postId 로 보내는데 main 은 post.id 를 읽어 리포트마다 postId 가 비고, 일괄 수정이 전부 버림
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';
import {
  attachTistoryDialogMonitor,
  buildTistoryAttachedImageMarkup,
  buildTistoryFinalHtml,
  buildUploadedThumbnailBlock,
  isTistoryDraftContinueDialog,
} from '../src/tistory/tistory-publisher';
import { extractTistoryEntryThumbnail } from '../src/tistory/tistory-posts';
import { TISTORY_SELECTORS } from '../src/tistory/tistory-selectors';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const publisher = read('src/tistory/tistory-publisher.ts');
const posts = read('src/tistory/tistory-posts.ts');
const main = read('electron/main.ts');
const rendererPosts = read('electron/ui/modules/published-posts.js');

const KAKAO_SRC = 'https://blog.kakaocdn.net/dna/uUjck/dJMcaaGMjan/AAAAAAAAAAAAAAAAAAAAABAPyBEy/img.webp?credential=abc&expires=1790780399&allow_ip=&allow_referer=&signature=q%3D';

function fakePage() {
  const handlers: Record<string, Function> = {};
  return {
    on: (name: string, fn: Function) => { handlers[name] = fn; },
    off: () => undefined,
    fire: (message: string) => {
      const calls: string[] = [];
      const dialog = {
        message: () => message,
        accept: async () => { calls.push('accept'); },
        dismiss: async () => { calls.push('dismiss'); },
      };
      return (handlers.dialog as Function)(dialog).then(() => calls);
    },
  };
}

describe('① 이어쓰기 confirm 은 거절한다 — 옛 임시글 첨부가 대표가 되던 원인', () => {
  test('⭐ 실측 문구를 알아본다', () => {
    expect(isTistoryDraftContinueDialog('2026. 9. 7. 11:36에 저장된 글이 있습니다.\n이어서 작성하시겠습니까?')).toBe(true);
    expect(isTistoryDraftContinueDialog('작성 모드를 변경하시겠습니까?')).toBe(false);
    expect(isTistoryDraftContinueDialog('')).toBe(false);
  });

  test('⭐ 이어쓰기는 dismiss, 나머지는 전처럼 accept', async () => {
    const page = fakePage();
    const logs: string[] = [];
    attachTistoryDialogMonitor(page, (m) => logs.push(m));
    expect(await page.fire('2026. 9. 7. 11:36에 저장된 글이 있습니다.\n이어서 작성하시겠습니까?')).toEqual(['dismiss']);
    expect(await page.fire('작성 모드를 변경하시겠습니까?')).toEqual(['accept']);
    expect(logs[0]).toContain('dismissed');
    expect(logs[1]).toContain('accepted');
  });
});

describe('① 업로드 — 첨부 메뉴의 "사진"까지 누르고, 모든 프레임에서 찾는다', () => {
  const upload = blockBetween(publisher, 'async function uploadThumbnailThroughTistoryEditor', 'export function buildTistoryFinalHtml');

  test('⭐ 첨부 버튼 뒤에 사진 항목을 누른다 (filechooser 를 기다리는 동안)', () => {
    const chooserAt = upload.indexOf("waitForEvent('filechooser'");
    const controlAt = upload.indexOf('await clickImageUploadControl(page)');
    const menuAt = upload.indexOf('await clickImageMenuItem(page)');
    expect(chooserAt).toBeGreaterThan(-1);
    expect(controlAt).toBeGreaterThan(chooserAt);
    expect(menuAt).toBeGreaterThan(controlAt);
    expect(upload.indexOf('await fileChooserPromise')).toBeGreaterThan(menuAt);
  });

  test('⭐ 사진 항목 선택자는 실측 id 를 첫째로 둔다', () => {
    expect(TISTORY_SELECTORS.editor.imageMenuItems[0]).toBe('#attach-image');
    const menu = blockBetween(publisher, 'async function clickImageMenuItem', 'type UploadedImageInfo');
    expect(menu).toContain('TISTORY_SELECTORS.editor.imageMenuItems');
    expect(menu).toContain('(사진|이미지|그림|image|photo)');
  });

  test('⭐ 이미지 탐색은 메인 프레임이 아니라 page.frames() 전부를 본다', () => {
    expect(publisher).toContain('function listPageFrames(page: any)');
    const sources = blockBetween(publisher, 'async function getPageImageSources', 'async function setThumbnailFileInput');
    expect(sources).toContain('for (const frame of listPageFrames(page))');
    const finder = blockBetween(publisher, 'async function findUploadedImageAcrossFrames', 'export function buildUploadedThumbnailBlock');
    expect(finder).toContain('for (const frame of listPageFrames(page))');
    expect(finder).toContain('frame.evaluate(FIND_UPLOADED_IMAGE');
  });

  test('⭐ 편집기 사진 블록(figure[data-ke-type="image"])을 가장 높이 친다', () => {
    const finder = blockBetween(publisher, 'const FIND_UPLOADED_IMAGE', 'async function findUploadedImageAcrossFrames');
    expect(finder).toContain('figure[data-ke-type^="image"]');
    expect(finder).toContain('data-origin-width');
    expect(finder).toContain('data-filename');
  });

  test('⭐ 편집 영역 밖 + 티스토리 저장소도 아닌 그림은 "이번 업로드"로 치지 않는다', () => {
    const finder = blockBetween(publisher, 'const FIND_UPLOADED_IMAGE', 'async function findUploadedImageAcrossFrames');
    expect(finder).toContain('if (!inEditorFigure && !inEditableArea && !onTistoryHost) return -1;');
  });

  /**
   * 실측(2026-09-08): `i.mce-i-image` 의 가장 가까운 button(#attach-layer-btn)은 폭 0 —
   * 보이는 것은 그 바깥 div.mce-btn[aria-label="첨부"]. 첫 조상만 보면 "안 보임"으로 넘어간다.
   */
  test('⭐⭐ 첨부 버튼은 보이는 조상이 나올 때까지 올라가서 누른다', () => {
    const control = blockBetween(publisher, 'async function clickImageUploadControl', 'async function clickImageMenuItem');
    expect(control).toContain('for (let depth = 0; cursor && depth < 5; depth += 1)');
    expect(control).toContain('const clickable = candidates.find(visible);');
    expect(control).not.toContain('? node\n          : node.closest(');
  });
});

describe('① 대표 배지 — 글자 없는 .mce-represent-image-btn 을 누른다', () => {
  const fn = blockBetween(publisher, 'const EDITOR_FRAME_SELECTOR =', 'async function uploadThumbnailThroughTistoryEditor');

  /**
   * 실측(2026-09-08): window.tinymce 는 메인 문서에 없다(activeEditor 길은 늘 no-editor).
   * 본문 iframe 의 figure img 를 **진짜 클릭**해야 selectionchange 가 나고 배지가 그려진다.
   */
  test('⭐⭐ 본문 iframe 의 올린 이미지를 frameLocator 로 실제 클릭한다 (tinymce 전역 의존 금지)', () => {
    expect(fn).toContain("page.frameLocator(EDITOR_FRAME_SELECTOR)");
    expect(fn).toContain("frame.locator('figure[data-ke-type^=\"image\"] img')");
    expect(fn).toContain('click({ force: true, timeout: 5000 })');
    expect(fn).not.toContain('tinymce');
    expect(fn).not.toContain('activeEditor');
  });

  test('⭐ 편집기 iframe 선택자는 실측 id 다', () => {
    expect(fn).toContain("'iframe#editor-tistory_ifr, iframe[id$=\"_ifr\"]'");
  });

  test('⭐ 배지는 토글이다 — 이미 active 면 누르지 않는다', () => {
    expect(fn).toContain('.mce-represent-image-btn');
    expect(fn).toContain("if (badge.classList.contains('active')) return 'already-active'");
    expect(fn).toContain("state === 'already-active' || state === 'activated'");
  });

  test('⭐ 배지가 늦게 그려져도 몇 번 다시 본다', () => {
    expect(fn).toContain('for (let attempt = 0; attempt < 6; attempt += 1)');
    expect(fn).toContain("if (state === 'missing') continue;");
  });

  test('⭐ "대표/썸네일" 글자로 찾던 옛 방식은 사라졌다', () => {
    expect(fn).not.toContain('(대표|대표\\s*이미지|썸네일|thumbnail|cover)');
  });

  test('업로드 흐름이 올린 이미지 주소를 배지 단계에 넘긴다', () => {
    const upload = blockBetween(publisher, 'async function uploadThumbnailThroughTistoryEditor', 'export function buildTistoryFinalHtml');
    expect(upload).toContain('trySetUploadedImageAsRepresentative(page, unescapeHtmlAttribute(uploadedSource), onLog)');
  });
});

describe('① 본문 첫 블록은 티스토리 첨부 표기 [##_Image|kage@…]', () => {
  test('⭐ kakaocdn 업로드 주소 → 편집기가 쓰는 첨부 표기 그대로', () => {
    const block = buildUploadedThumbnailBlock({ src: KAKAO_SRC, originWidth: 1200, originHeight: 670, filename: 'a.webp' }, '제목');
    const markup = buildTistoryAttachedImageMarkup(block);
    expect(markup.startsWith('[##_Image|kage@uUjck/dJMcaaGMjan/AAAAAAAAAAAAAAAAAAAAABAPyBEy/img.webp?credential=abc&amp;expires=1790780399')).toBe(true);
    expect(markup.endsWith('|CDM|1.3|{"originWidth":1200,"originHeight":670,"style":"alignCenter","filename":"a.webp"}_##]')).toBe(true);
    expect(markup).not.toContain('&amp;amp;');
  });

  test('외부 주소면 첨부 표기를 만들지 않는다 (호출 쪽이 <img> 로 간다)', () => {
    expect(buildTistoryAttachedImageMarkup('<p><img src="https://example.com/a.png" /></p>')).toBe('');
    expect(buildTistoryAttachedImageMarkup('')).toBe('');
  });

  test('⭐ buildTistoryFinalHtml 이 첨부 표기를 맨 앞에 둔다', () => {
    const block = buildUploadedThumbnailBlock({ src: KAKAO_SRC, originWidth: 1200, originHeight: 670, filename: 'a.webp' }, '제목');
    const html = buildTistoryFinalHtml('<p>본문</p>', 'https://example.com/thumb.png', block, '제목');
    expect(html.startsWith('[##_Image|kage@')).toBe(true);
    expect(html).toContain('<p>본문</p>');
    expect(html).not.toContain('<img');
  });

  test('첨부 표기를 못 만들면 예전처럼 <img> 로 간다', () => {
    const block = '<p><img src="https://cdn.example.com/a.png" alt="x" /></p>';
    const html = buildTistoryFinalHtml('<p>본문</p>', '', block, '제목');
    expect(html.startsWith('<p><img src="https://cdn.example.com/a.png"')).toBe(true);
  });
});

/**
 * 실측(2026-09-08, 비공개 시험 발행 3회): 좌표 클릭(humanClick)이 2회 빗나가 글이 안 생겼는데
 * 로그는 "발행 완료(주소 미확인)" — 결과를 묻지 않는 클릭이라 성공처럼 보였다.
 */
describe('① 발행 확인 — 화면이 안 넘어가면 DOM 클릭으로 한 번 더', () => {
  const finish = blockBetween(publisher, 'async function finishPublish(', 'export async function publishToTistory(');

  test('⭐⭐ 고정 3초 대기가 아니라 편집 화면을 벗어날 때까지 본다', () => {
    expect(finish).toContain('await waitForPublishNavigation(page, PUBLISH_NAVIGATION_WAIT_MS)');
    expect(finish).not.toContain('await page.waitForTimeout(3000)');
  });

  test('⭐⭐ 재시도는 한 번, 버튼이 아직 보일 때만 (이중 발행 방지)', () => {
    expect(finish).toContain('const retried = await clickPublishConfirmByDom(page);');
    expect((finish.match(/clickPublishConfirmByDom\(page\)/g) || []).length).toBe(1);
    const dom = blockBetween(publisher, 'async function clickPublishConfirmByDom', 'async function finishPublish(');
    expect(dom).toContain('if (rect.width <= 0 || rect.height <= 0 || button.disabled) continue;');
    expect(dom).toContain("!selector.includes(':has-text')");
  });

  test('⭐ 넘어갔는지는 URL 이 /manage/newpost 를 벗어났는지로 판단한다', () => {
    const wait = blockBetween(publisher, 'async function waitForPublishNavigation', 'async function clickPublishConfirmByDom');
    expect(wait).toContain("!/manage\\/newpost/i.test(currentUrl)) return true;");
  });

  /** 발행 뒤 화면은 글 목록(/manage/posts/) — 글 id 는 posts.json 을 제목으로 찾아야 나온다 */
  test('⭐⭐ 글 id 가 URL 에 없으면 posts.json 을 제목으로 찾아 진짜 글 주소를 돌려준다', () => {
    expect(finish).toContain('const resolved = await resolvePublishedPostByTitle(page, config.blogName, title, newestIdBefore);');
    expect(publisher).toContain('await finishPublish(page, config, postingMode, scheduleDate, onLog, title)');
    const list = blockBetween(publisher, 'async function fetchTistoryManageList', 'async function snapshotNewestTistoryPostId');
    expect(list).toContain('searchType=title&visibility=all');
    expect(list).toContain("credentials: 'include'");
  });

  /** 실측: 목록이 1~2초 늦게 갱신돼 같은 제목의 옛 글(321)을 새 글(322)로 잘못 잡았다 */
  test('⭐⭐ 발행 전 최신 id 를 찍어 두고, 그보다 큰 id 만 새 글로 인정하며 몇 번 다시 본다', () => {
    expect(finish).toContain('newestIdBefore = await snapshotNewestTistoryPostId(page, config.blogName);');
    const resolve = blockBetween(publisher, 'async function resolvePublishedPostByTitle', 'async function finishPublish(');
    expect(resolve).toContain('for (let attempt = 0; attempt < RESOLVE_PUBLISHED_POST_ATTEMPTS; attempt += 1)');
    expect(resolve).toContain("const fresh = items.filter((item) => Number(String(item?.id || '').trim()) > newestIdBefore);");
    // 엉뚱한 옛 글을 "방금 발행한 글"로 기록하지 않는다 — 제목 일치 아니면 새 글이 하나일 때만
    expect(resolve).toContain('(fresh.length === 1 ? fresh[0] : undefined)');
    expect(resolve).toContain("if (/^\\d+$/.test(postId)) return { url: `https://${blogName}.tistory.com/${postId}`, postId };");
  });
});

describe('② 글목록 티스토리 썸네일 — 글 페이지 og:image 에서 가져온다', () => {
  test('⭐ og:image 를 읽고 &amp; 를 푼다', () => {
    const html = '<head><meta property="og:image" content="https://img1.daumcdn.net/thumb/R800x0/?scode=mtistory2&amp;fname=x"/></head>';
    expect(extractTistoryEntryThumbnail(html)).toBe('https://img1.daumcdn.net/thumb/R800x0/?scode=mtistory2&fname=x');
  });

  test('og:image 가 없으면 공유 버튼의 data-thumbnail-url', () => {
    const html = '<button data-entry-id="317" data-thumbnail-url="https://img1.daumcdn.net/thumb/R800x0/?fname=y"></button>';
    expect(extractTistoryEntryThumbnail(html)).toBe('https://img1.daumcdn.net/thumb/R800x0/?fname=y');
  });

  test('⭐ 관리자 아이콘 스프라이트는 썸네일이 아니다', () => {
    const html = '<meta property="og:image" content="https://t1.daumcdn.net/tistory_admin/static/images/ico_tistory_210420.png"/>';
    expect(extractTistoryEntryThumbnail(html)).toBe('');
    expect(extractTistoryEntryThumbnail('')).toBe('');
  });

  test('⭐ 목록은 og:image 를 우선 싣는다 (없을 때만 관리 화면 값)', () => {
    expect(posts).toContain('await fetchTistoryEntryThumbnails(pageRef, session.config.blogName, sliced.map((post) => post.id))');
    expect(posts).toContain('imageUrl: entryThumbnails[post.id] || post.thumb');
  });

  test('⭐ 배경 이미지 폴백이 스프라이트를 집지 않는다', () => {
    const fn = blockBetween(posts, 'const images = Array.from(row.querySelectorAll', '// 글 행의 최소 증거');
    expect(fn).toContain('if (/tistory_admin|ico_tistory|sprite/i.test(url)) continue;');
  });

  test('글 페이지는 숨은 브라우저 안에서 같은 출처로 가져온다 (비공개 글도 쿠키로)', () => {
    const fn = blockBetween(posts, 'async function fetchTistoryEntryThumbnails', 'export async function listTistoryPosts');
    expect(fn).toContain("credentials: 'include'");
    expect(fn).toContain('ENTRY_THUMBNAIL_FETCH_TIMEOUT_MS');
  });
});

describe('③ CTA 점검 → 수정하기 — postId 배선', () => {
  test('⭐ 렌더러가 보내는 키(postId)를 main 이 읽는다', () => {
    expect(rendererPosts).toContain('postId: item.id, title: item.title, link: item.url');
    const audit = blockBetween(main, "ipcMain.handle('cta-audit-run'", "ipcMain.handle('cta-suggest-copy'");
    expect(audit).toContain('postId: post?.postId ?? post?.id');
    expect(audit).not.toContain('postId: post?.id,');
  });

  test('⭐ 글 id 없는 대상만 있으면 성공으로 꾸미지 않고 실패로 알린다', () => {
    const repair = blockBetween(main, "ipcMain.handle('cta-bulk-repair'", 'const results: any[] = [];');
    expect(repair).toContain('if (byPost.size === 0) {');
    expect(repair).toContain('postId)가 없습니다');
  });
});
