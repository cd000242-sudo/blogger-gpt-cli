/**
 * v3.8.783 — 티스토리: 로그인 창이 안 보이던 것 · 발행 진단 로그가 화면에 안 오던 것
 *
 * 구매자: "티스토리 로그인창열기해도 크롬창 안열리는건 왜그런걸가요?"
 *
 * ## A. 창이 화면 밖에 떴다
 * 숨길 때는 창을 화면 밖(-32000,-32000)으로 옮기고 최소화한다. 꺼낼 때는 최소화만 풀고
 * 위치를 되돌리지 않았다. 그래서 발행·세션 확인·카테고리 불러오기를 한 번이라도 거치면,
 * 그 뒤 [로그인 창 열기]는 같은 창을 재사용하면서 화면 밖에 띄웠다.
 * (실측: 개발 PC 의 티스토리 프로필에 창 위치 left -26214 · top -26214 가 저장돼 있었다.)
 *
 * ## B. 글 작성 뒤 바로 발행하는 경로는 발행 단계 로그를 화면에 넘기지 않았다
 * 편집기에서 무슨 일이 있었는지 알려 주는 줄이 콘솔에만 남아, 실패해도 원인이 화면에 없었다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';
import { hideTistoryBrowserWindow, restoreTistoryBrowserWindow } from '../src/tistory/tistory-session';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

type Bounds = { left: number; top: number; width: number; height: number; windowState: string };

/** 크롬 창 하나를 흉내 낸다 — 위치·크기는 창이 normal 상태일 때만 바꿀 수 있다(실제 크롬 규칙) */
function fakeChromeWindow(start: Bounds) {
  const bounds: Bounds = { ...start };
  let fronted = 0;
  const session = {
    async send(method: string, params?: { bounds?: Partial<Bounds> }) {
      if (method === 'Browser.getWindowForTarget') return { windowId: 7, bounds: { ...bounds } };
      if (method === 'Browser.setWindowBounds') {
        const next = params?.bounds || {};
        const moves = ['left', 'top', 'width', 'height'].some((key) => key in next);
        const stateAfter = next.windowState || bounds.windowState;
        if (moves && (bounds.windowState !== 'normal' || stateAfter !== 'normal')) {
          throw new Error('To resize minimized/maximized/fullscreen window, restore it to normal state first.');
        }
        Object.assign(bounds, next);
      }
      return {};
    },
    async detach() { /* nothing to release */ },
  };
  const page = { context: () => ({ newCDPSession: async () => session }), bringToFront: async () => { fronted += 1; } };
  return { page, bounds, fronted: () => fronted };
}

const SCREEN = { width: 1536, height: 816 };
const onScreen = (b: Bounds) => b.left >= 0 && b.top >= 0 && b.left < SCREEN.width && b.top < SCREEN.height;

describe('A. 숨긴 창을 꺼내면 화면 안에 보인다', () => {
  test('⭐ 숨김 → 복원: 최소화만 풀리는 게 아니라 화면 안 위치로 돌아온다', async () => {
    const win = fakeChromeWindow({ left: 100, top: 100, width: 1400, height: 900, windowState: 'normal' });
    expect(await hideTistoryBrowserWindow(win.page)).toBe(true);
    expect(win.bounds).toMatchObject({ left: -32000, top: -32000, windowState: 'minimized' });

    expect(await restoreTistoryBrowserWindow(win.page)).toBe(true);
    expect(win.bounds.windowState).toBe('normal');
    expect(onScreen(win.bounds)).toBe(true);
    expect(win.bounds.width).toBeGreaterThanOrEqual(1000);
    expect(win.bounds.height).toBeGreaterThanOrEqual(600);
    expect(win.fronted()).toBe(1);
  });

  test('⭐ 처음부터 숨김으로 띄운 창(카테고리 불러오기·글 목록)도 꺼내면 화면 안에 온다', async () => {
    const win = fakeChromeWindow({ left: -32000, top: -32000, width: 100, height: 100, windowState: 'minimized' });
    await restoreTistoryBrowserWindow(win.page);
    expect(win.bounds.windowState).toBe('normal');
    expect(onScreen(win.bounds)).toBe(true);
    expect(win.bounds.width).toBeGreaterThanOrEqual(1000);
  });

  test('숨김은 그대로다 — 화면 밖으로 옮기고 최소화한다', async () => {
    const win = fakeChromeWindow({ left: 100, top: 100, width: 1400, height: 900, windowState: 'normal' });
    await hideTistoryBrowserWindow(win.page);
    expect(onScreen(win.bounds)).toBe(false);
    expect(win.bounds.windowState).toBe('minimized');
  });
});

describe('B. 글 작성 뒤 바로 발행하는 경로도 발행 단계 로그를 화면에 넘긴다', () => {
  const handlerOf = (src: string) => blockBetween(src, "ipcMain.handle('run-post'", "ipcMain.handle('publish-content'");
  const publishCallOf = (handler: string) => blockBetween(handler, 'const publishResult = await publishGeneratedContent(', ');').replace(/\s+/g, '');

  test.each([
    ['main.ts', read('electron/main.ts')],
    ['main.js (컴파일본)', read('electron/main.js')],
  ])('⭐ %s — 발행 함수에 로그 통로를 다섯 번째 인자로 넘긴다', (_name, src) => {
    expect(publishCallOf(handlerOf(src))).toContain("result.thumbnail||result.thumbnailUrl||'',runPostPublishLog");
  });

  test('진행률 막대는 뒤로 가지 않는다 — 이미 지난 퍼센트는 글자 로그로만 보낸다', () => {
    const wrapper = blockBetween(handlerOf(read('electron/main.ts')), 'const runPostPublishLog = ', 'const MAX_PUBLISH_RETRIES');
    expect(wrapper).toContain('< currentProgress');
    expect(wrapper).toContain("'log-line'");
    expect(wrapper).toContain('onLog(line)');
  });
});
