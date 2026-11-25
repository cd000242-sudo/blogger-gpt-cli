/**
 * v3.8.785 — 티스토리 로그인 창: "열었습니다"는 열린 것을 확인한 뒤에만 말한다
 *
 * 구매자(3.8.775 업데이트 뒤): "업데이트해도 티스토리 브라우저가 안 열린다"
 * 캡처: 단추 옆 글씨는 "로그인 창을 열었습니다" 인데 작업 표시줄에 실행 중인 크롬 창이 없다.
 *
 * 앱은 크롬을 띄우고 로그인 주소로 보낸 직후 "열었습니다" 를 돌려줬다. 그 뒤 크롬이 꺼졌는지,
 * 창이 어디에 있는지는 보지 않았다 — 실패를 성공으로 알린 것이다. 그래서 캡처 한 장으로 원인을 가릴 수 없었다.
 *
 * 고친 것: 잠시 기다린 뒤 크롬이 살아 있는지 확인하고, 창을 화면 안으로 꺼내 위치와 브라우저 버전을 함께 돌려준다.
 * 꺼졌으면 "열렸다가 바로 닫혔습니다" 로 실패를 알린다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';
import { inspectLoginWindow } from '../src/tistory/tistory-session';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const SESSION = read('src/tistory/tistory-session.ts');
const SETTINGS = read('electron/ui/modules/settings.js');

type Bounds = { left: number; top: number; width: number; height: number; windowState: string };

/** 크롬 창 하나를 흉내 낸다. diesAfterOpen 이면 조종 통로를 열 수 없다(크롬이 꺼진 상태). */
function fakeChrome(start: Bounds, opts: { diesAfterOpen?: boolean } = {}) {
  const bounds: Bounds = { ...start };
  const session = {
    async send(method: string, params?: { bounds?: Partial<Bounds> }) {
      if (method === 'Browser.getVersion') return { product: 'Chrome/158.0.8127.37' };
      if (method === 'Browser.getWindowForTarget') return { windowId: 7, bounds: { ...bounds } };
      if (method === 'Browser.getWindowBounds') return { bounds: { ...bounds } };
      if (method === 'Browser.setWindowBounds') {
        const next = params?.bounds || {};
        const moves = ['left', 'top', 'width', 'height'].some((key) => key in next);
        const stateAfter = next.windowState || bounds.windowState;
        if (moves && (bounds.windowState !== 'normal' || stateAfter !== 'normal')) throw new Error('restore it to normal state first');
        Object.assign(bounds, next);
      }
      return {};
    },
    async detach() { /* nothing to release */ },
  };
  const page = {
    isClosed: () => !!opts.diesAfterOpen,
    waitForTimeout: async () => undefined,
    bringToFront: async () => undefined,
    context: () => ({ newCDPSession: async () => { if (opts.diesAfterOpen) throw new Error('Target page, context or browser has been closed'); return session; } }),
  };
  return { page, bounds };
}

describe('① 연 뒤에 실제로 살아 있는지, 어디에 있는지 본다', () => {
  test('⭐ 살아 있으면 창 위치·상태와 브라우저 버전을 돌려준다', async () => {
    const chrome = fakeChrome({ left: 100, top: 100, width: 1400, height: 900, windowState: 'normal' });
    expect(await inspectLoginWindow(chrome.page)).toEqual({
      alive: true,
      browser: 'Chrome/158.0.8127.37',
      window: { left: 100, top: 100, width: 1400, height: 900, state: 'normal' },
    });
  });

  test('⭐ 열자마자 꺼졌으면 alive=false — "열었습니다" 라고 하지 않는다', async () => {
    const chrome = fakeChrome({ left: 100, top: 100, width: 1400, height: 900, windowState: 'normal' }, { diesAfterOpen: true });
    expect(await inspectLoginWindow(chrome.page)).toEqual({ alive: false });
  });

  test('⭐ 화면 밖·최소화 상태였으면 화면 안으로 꺼낸 뒤의 위치를 돌려준다', async () => {
    const chrome = fakeChrome({ left: -32000, top: -32000, width: 100, height: 100, windowState: 'minimized' });
    const seen = await inspectLoginWindow(chrome.page);
    expect(seen.alive).toBe(true);
    expect(seen.window).toMatchObject({ left: 100, top: 100, state: 'normal' });
  });
});

describe('② 로그인 창 열기 결과에 반영한다', () => {
  const open = blockBetween(SESSION, 'export async function openTistoryLoginWindow(', '// v3.8.156: 로그인 완료 자동 감지');

  test('⭐ 꺼졌으면 실패로 돌려준다 — 문구에 "열렸다가 바로 닫혔습니다"', () => {
    expect(open).toContain('const seen = await inspectLoginWindow(page)');
    expect(open).toContain('if (!seen.alive)');
    expect(blockBetween(open, 'if (!seen.alive)', 'Login window opened. Complete')).toContain('ok: false');
    expect(open).toContain('열렸다가 바로 닫혔습니다');
  });

  test('성공 결과에 브라우저 버전과 창 위치를 싣는다', () => {
    // openTistoryLoginWindow is the last function in the file: everything after the watcher comment is its tail.
    const tail = SESSION.slice(SESSION.indexOf('// v3.8.156: 로그인 완료 자동 감지'));
    expect(tail).toContain('browserVersion: seen.browser');
    expect(tail).toContain('window: seen.window');
  });
});

describe('③ 화면: 확인한 내용을 단추 옆에 보여 준다', () => {
  const handler = blockBetween(SETTINGS, 'window.openTistoryLoginFromSettings = async function', 'function setTistoryCategoryOptions');

  test('⭐ 열린 창이 안 보일 때 찾는 방법(Alt+Tab)과 브라우저 버전·창 위치를 함께 적는다', () => {
    expect(handler).toContain('Alt+Tab');
    expect(handler).toContain('result?.browserVersion');
    expect(handler).toContain('result?.window');
  });
});
