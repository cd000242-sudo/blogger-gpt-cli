/**
 * v3.8.756 — 고객 PC 에 전용 브라우저가 없어 기능이 조용히 죽던 것
 *
 * 전수조사 실측(2026-10-08):
 *   · 쇼핑모드 상품 수집이 `chromium.launch()` 만 불러 "Executable doesn't exist" → 사진·가격 없이 "링크만 사용"
 *     (전용 Chromium 은 사장님 PC 에도 없었다). Edge 채널로 띄우면 정상.
 *   · 퍼피티어 크롤러(URL 이미지 자동 수집 · URL 모드 상품 · 검색 결과 본문)가 경로 없이 launch →
 *     전용 크롬(~/.cache/puppeteer)이 없으면 "Could not find Chrome". 같은 기능에 PC Chrome 경로를 주면 정상
 *     (URL 이미지 수집: 고치기 전 1초·0장 → 고친 뒤 실제 페이지 로드).
 *   · 네이버가 돌려준 "[에러] 에러페이지 - 시스템오류" 를 상품명으로 받아들였다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { installPuppeteerBrowserPath, systemBrowserCandidates } from '../electron/browser-paths';
import { launchChromiumWithSystemFallback } from '../src/utils/playwright-browser-installer';

const ROOT = path.join(__dirname, '..');
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

const MISSING = new Error("browserType.launch: Executable doesn't exist at C:\\x\\chrome.exe\nPlease run: npx playwright install");

describe('v3.8.756 퍼피티어 — PC 의 Chrome·Edge 경로', () => {
  const env = { PROGRAMFILES: 'C:\\Program Files', 'PROGRAMFILES(X86)': 'C:\\Program Files (x86)', LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local' };

  test('윈도우: Chrome 을 먼저, 없으면 Edge', () => {
    const list = systemBrowserCandidates(env, 'win32');
    expect(list[0]).toBe('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
    expect(list.findIndex((p) => /msedge\.exe$/.test(p))).toBeGreaterThan(list.findIndex((p) => /chrome\.exe$/.test(p)));
  });

  test('Chrome 이 없으면 Edge 로 정한다', () => {
    const e: Record<string, string | undefined> = { ...env };
    const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    expect(installPuppeteerBrowserPath(e, 'win32', (p) => p === edge)).toBe(edge);
    expect(e['PUPPETEER_EXECUTABLE_PATH']).toBe(edge);
  });

  test('사용자가 정해 둔 경로가 살아 있으면 건드리지 않는다', () => {
    const e: Record<string, string | undefined> = { ...env, PUPPETEER_EXECUTABLE_PATH: 'D:\\my\\chrome.exe' };
    expect(installPuppeteerBrowserPath(e, 'win32', () => true)).toBe('D:\\my\\chrome.exe');
  });

  test('아무 브라우저도 없으면 정하지 않는다(퍼피티어 기본 동작 그대로)', () => {
    const e: Record<string, string | undefined> = { ...env };
    expect(installPuppeteerBrowserPath(e, 'win32', () => false)).toBeUndefined();
    expect(e['PUPPETEER_EXECUTABLE_PATH']).toBeUndefined();
  });

  test('main.ts 가 다른 모듈을 불러오기 전에 정한다(퍼피티어는 처음 불러올 때 경로를 읽는다)', () => {
    const main = read('electron', 'main.ts');
    const callAt = main.indexOf('installPuppeteerBrowserPath();');
    expect(callAt).toBeGreaterThan(-1);
    expect(callAt).toBeLessThan(main.indexOf("from '../dist/"));
  });
});

describe('v3.8.756 플레이라이트 — 전용 Chromium 이 없으면 PC 의 Edge → Chrome', () => {
  const fakeChromium = (works: (opts: any) => boolean, error: Error = MISSING) => {
    const calls: any[] = [];
    return {
      calls,
      launch: async (opts: any) => {
        calls.push(opts.channel || 'bundled');
        if (works(opts)) return { channel: opts.channel || 'bundled' };
        throw error;
      },
    };
  };

  test('전용 Chromium 이 있으면 그대로 쓴다', async () => {
    const c = fakeChromium(() => true);
    expect(await launchChromiumWithSystemFallback(c, { headless: true })).toEqual({ channel: 'bundled' });
    expect(c.calls).toEqual(['bundled']);
  });

  test('없으면 Edge 로, 로그로 알린다', async () => {
    const c = fakeChromium((o) => o.channel === 'msedge');
    const logs: string[] = [];
    expect(await launchChromiumWithSystemFallback(c, { headless: true }, (m) => logs.push(m))).toEqual({ channel: 'msedge' });
    expect(c.calls).toEqual(['bundled', 'msedge']);
    expect(logs.join()).toContain('PC 의 Edge 로 실행합니다');
  });

  test('Edge 도 없으면 Chrome', async () => {
    const c = fakeChromium((o) => o.channel === 'chrome');
    expect(await launchChromiumWithSystemFallback(c, { headless: true })).toEqual({ channel: 'chrome' });
    expect(c.calls).toEqual(['bundled', 'msedge', 'chrome']);
  });

  test('"브라우저 없음" 이 아닌 오류는 감추지 않는다', async () => {
    const c = fakeChromium(() => false, new Error('Target page, context or browser has been closed'));
    await expect(launchChromiumWithSystemFallback(c, { headless: true })).rejects.toThrow('has been closed');
    expect(c.calls).toEqual(['bundled']);
  });

  test('호출자가 채널을 골랐으면 바꾸지 않는다', async () => {
    const c = fakeChromium(() => false);
    await expect(launchChromiumWithSystemFallback(c, { channel: 'chrome' })).rejects.toThrow("Executable doesn't exist");
    expect(c.calls).toEqual(['chrome']);
  });
});

describe('v3.8.756 배선 — 상품 수집 · 네이버 로그인 창', () => {
  const crawl = read('src', 'core', 'affiliate', 'crawl.ts');
  const session = read('src', 'core', 'affiliate', 'naver-session.ts');

  test('상품 수집(crawlNaver)이 새 도우미로 띄운다 — 맨 chromium.launch( 를 쓰지 않는다', () => {
    const body = crawl.slice(crawl.indexOf('async function crawlNaver('), crawl.indexOf('const ctx = await browser.newContext('));
    expect(body).toContain('launchChromiumWithSystemFallback(chromium, {');
    expect(body).not.toMatch(/await chromium\.launch\(/);
  });

  test('네이버 로그인 창: Chrome → Edge → 번들(없으면 설치) 순서', () => {
    const chromeAt = session.indexOf("{ ...launchOptions, channel: 'chrome' }");
    const edgeAt = session.indexOf("{ ...launchOptions, channel: 'msedge' }");
    const bundledAt = session.indexOf('launchPersistentContextWithAutoInstall(chromium, PROFILE_DIR, launchOptions, onLog)');
    expect(chromeAt).toBeGreaterThan(-1);
    expect(edgeAt).toBeGreaterThan(chromeAt);
    expect(bundledAt).toBeGreaterThan(edgeAt);
  });
});

describe('v3.8.756 네이버 오류 페이지를 상품명으로 받지 않는다', () => {
  const crawl = read('src', 'core', 'affiliate', 'crawl.ts');
  const m = crawl.match(/if \((\/\^\\s\*\\\[\\s\*에러[^\n]+?\/i)\.test\(title\)\)/);
  const errorPage = m ? new Function(`return ${m[1]};`)() as RegExp : null;

  test('판정식이 있다', () => {
    expect(errorPage).toBeInstanceOf(RegExp);
  });

  test.each([
    '[에러] 에러페이지 - 시스템오류',
    '요청하신 페이지를 찾을 수 없습니다',
    '접근이 제한된 페이지입니다',
  ])('오류 페이지: %s', (title) => {
    expect(errorPage!.test(title)).toBe(true);
  });

  test.each([
    '[무료배송] 삼성 갤럭시 S26 자급제 256GB',
    '로지텍 MX Master 4 무선 마우스',
    '에러 코드 걱정 없는 무선 공유기 AX3000',
  ])('정상 상품명: %s', (title) => {
    expect(errorPage!.test(title)).toBe(false);
  });
});
