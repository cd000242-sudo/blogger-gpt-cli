/**
 * v3.8.784 — 티스토리: 제목과 썸네일만 있는 글이 발행되던 문제
 *
 * 구매자: "티스토리 글 작성중인데 본문 내용은 생성이 안되고 제목만 썸네일만 작성된 상태로 발행이 되네요"
 *
 * ## 실측 (2026-11-24, 실제 티스토리 편집기 · 입력/발행 없이 구조와 시간만)
 * - 기본 모드에도 HTML 편집기(.CodeMirror.cm-s-tistory-html)가 숨은 채 DOM 에 있다 — `.CodeMirror textarea` 개수는 늘 2.
 *   옛 코드는 "개수 > 0" 으로 전환 성공을 판단해서, 전환이 안 돼도 성공으로 돌려줬다.
 * - 화면 밖·최소화 창은 화면을 1초에 한 번꼴로 그린다(프레임 765~943ms, 화면 안 0~1ms).
 *   HTML 모드 전환이 화면 안 3초 · 화면 밖 36~38초. 옛 코드는 메뉴를 연 뒤 0.6초만 기다리고 한 번 봤다.
 * - 전환이 안 된 채 본문을 넣으면 편집기 틀(iframe)에 헛넣고 성공으로 돌아왔다 — 발행 전 확인이 없었다.
 *
 * ## 고친 것
 * 메뉴와 HTML 편집기가 **실제로 보일 때까지** 기다린다. 전환이 안 되면 한 번 더 해 보고, 그래도 안 되면 발행하지 않는다.
 * 본문을 넣은 뒤 편집기 값을 다시 읽어, 안 들어갔으면 직접 넣어 보고, 그래도 없으면 발행하지 않는다.
 */
jest.mock('../src/env', () => ({ loadEnvFromFile: jest.fn(() => ({})) }));
jest.mock('../src/tistory/tistory-session', () => ({
  ...jest.requireActual('../src/tistory/tistory-session'),
  // The real helper moves a ghost cursor; here a click simply lands on the fake element.
  humanClick: jest.fn(async (page: { locator(sel: string): { first(): { click(): Promise<void> } } }, sel: string) => { await page.locator(sel).first().click(); return true; }),
}));

import * as fs from 'fs';
import * as path from 'path';
import { blockBetween, braceBlock } from './helpers/source-block';
import { TISTORY_SELECTORS } from '../src/tistory/tistory-selectors';
import { switchToHtmlMode, bodyReachedEditor, ensureBodyInHtmlEditor } from '../src/tistory/tistory-publisher';
import { loginWindowAutoHide } from '../src/tistory/tistory-session';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const PUBLISHER = read('src/tistory/tistory-publisher.ts');

const MODE_BUTTON = TISTORY_SELECTORS.editor.modeButtons[0]!;
const HTML_ITEM = '[role="menuitem"]:has-text("HTML")';
const HTML_EDITOR = '.CodeMirror textarea';

/**
 * 실측한 편집기를 흉내 낸다. "폴"은 코드가 한 번 기다릴 때마다 1씩 흐르는 시간이다.
 *  - 모드 단추는 늘 보인다. 메뉴 항목은 단추를 누르고 menuAfterPolls 만큼 지나야 보인다.
 *  - HTML 편집기 입력칸은 기본 모드에도 2개 있지만(숨김), HTML 항목을 누르고 editorAfterPolls 뒤에야 보인다.
 */
function fakeEditor(opts: { menuAfterPolls: number; editorAfterPolls: number | null; startInHtml?: boolean }) {
  let menuPolls: number | null = null;
  let htmlPolls: number | null = opts.startInHtml ? 0 : null;
  const clicks: string[] = [];
  const editorShown = () => htmlPolls !== null && (opts.startInHtml || (opts.editorAfterPolls !== null && htmlPolls >= opts.editorAfterPolls));
  const menuShown = () => menuPolls !== null && menuPolls >= opts.menuAfterPolls && !editorShown();
  const count = (sel: string) => (sel === MODE_BUTTON ? 1 : sel === HTML_ITEM || sel === HTML_EDITOR ? 2 : 0);
  const visible = (sel: string) => (sel === MODE_BUTTON ? true : sel === HTML_ITEM ? menuShown() : sel === HTML_EDITOR ? editorShown() : false);
  const click = async (sel: string) => {
    clicks.push(sel);
    if (sel === MODE_BUTTON) menuPolls = 0;
    if (sel === HTML_ITEM && menuShown()) htmlPolls = 0;
  };
  const page = {
    locator: (sel: string) => ({ first: () => ({ count: async () => count(sel), isVisible: async () => visible(sel), click: async () => click(sel) }) }),
    waitForEvent: async () => { throw new Error('no dialog'); },
    waitForTimeout: async () => { if (menuPolls !== null) menuPolls += 1; if (htmlPolls !== null) htmlPolls += 1; },
    keyboard: { press: async () => undefined },
  };
  return { page, clicks, editorShown };
}

describe('① HTML 모드 전환은 실제로 보일 때까지 기다리고, 안 되면 안 됐다고 말한다', () => {
  test('⭐ 메뉴가 늦게 그려져도(화면 밖 창) 기다렸다가 전환한다', async () => {
    const editor = fakeEditor({ menuAfterPolls: 4, editorAfterPolls: 3 });
    const logs: string[] = [];
    expect(await switchToHtmlMode(editor.page, (m) => logs.push(m))).toBe(true);
    expect(editor.editorShown()).toBe(true);
    expect(logs.join('\n')).toContain('Switched editor to HTML mode.');
  });

  test('⭐ HTML 편집기가 끝내 안 보이면 false — 숨은 편집기가 DOM 에 있다는 이유로 성공이라 하지 않는다', async () => {
    const editor = fakeEditor({ menuAfterPolls: 0, editorAfterPolls: null });
    const logs: string[] = [];
    expect(await switchToHtmlMode(editor.page, (m) => logs.push(m))).toBe(false);
    expect(logs.join('\n')).not.toContain('Switched editor to HTML mode.');
  });

  test('메뉴가 이미 열려 있으면 모드 단추를 다시 누르지 않는다 — 다시 누르면 메뉴가 닫힌다', async () => {
    const editor = fakeEditor({ menuAfterPolls: 0, editorAfterPolls: 1 });
    await editor.page.locator(MODE_BUTTON).first().click();   // an earlier attempt left the menu open
    editor.clicks.length = 0;
    expect(await switchToHtmlMode(editor.page)).toBe(true);
    expect(editor.clicks).toEqual([HTML_ITEM]);
  });

  test('이미 HTML 모드면 아무것도 누르지 않는다 (재시도 때 메뉴를 다시 건드리지 않게)', async () => {
    const editor = fakeEditor({ menuAfterPolls: 0, editorAfterPolls: 0, startInHtml: true });
    expect(await switchToHtmlMode(editor.page)).toBe(true);
    expect(editor.clicks).toEqual([]);
  });
});

describe('② 본문이 들어갔는지 판정 (순수 함수)', () => {
  const body = '<h2>소제목</h2>\n<p>본문 문단입니다. 충분히 긴 내용.</p>';
  test('그대로 들어갔으면 통과 — 줄바꿈·공백 차이는 무시한다', () => {
    expect(bodyReachedEditor(body, body.replace(/\n/g, '\r\n  '))).toBe(true);
  });
  test('⭐ 비었거나, 썸네일 표기만 있거나, 앞부분만 있으면 실패', () => {
    expect(bodyReachedEditor(body, '')).toBe(false);
    expect(bodyReachedEditor(`[##_Image|kage@abc|CDM|1.3|{}_##]\n${body}`, '[##_Image|kage@abc|CDM|1.3|{}_##]')).toBe(false);
    expect(bodyReachedEditor(body, body.slice(0, Math.floor(body.length / 2)))).toBe(false);
  });
});

/** 페이지 안 편집기 다리를 흉내 낸다 — read 는 값을 돌려주고, set 은 값을 바꾼다 */
function fakeBridgePage(start: { visible: boolean; value: string | null; setWorks?: boolean }) {
  const state = { ...start };
  const ops: string[] = [];
  const page = {
    evaluate: async (_fn: unknown, request: { op: 'read' | 'set'; html?: string }, isolated?: boolean) => {
      ops.push(`${request.op}:${isolated === false ? 'main' : 'isolated'}`);
      if (request.op === 'set' && state.visible && state.value !== null && start.setWorks !== false) state.value = String(request.html);
      return { visible: state.visible, value: state.value };
    },
  };
  return { page, ops, state };
}

describe('③ 본문을 넣은 뒤 다시 읽어 확인한다', () => {
  const body = '<h2>소제목</h2><p>본문 문단입니다. 충분히 긴 내용이 들어 있습니다.</p>';

  test('⭐ 들어가 있으면 그대로 진행 — 편집기 값은 페이지 본래 세계에서 읽는다', async () => {
    const fake = fakeBridgePage({ visible: true, value: body });
    await expect(ensureBodyInHtmlEditor(fake.page, body)).resolves.toBeUndefined();
    expect(fake.ops).toEqual(['read:main']);
  });

  test('⭐ 비어 있으면 직접 넣어 보고, 들어가면 진행한다', async () => {
    const fake = fakeBridgePage({ visible: true, value: '' });
    await expect(ensureBodyInHtmlEditor(fake.page, body)).resolves.toBeUndefined();
    expect(fake.ops).toEqual(['read:main', 'set:main']);
    expect(fake.state.value).toBe(body);
  });

  test('⭐ 직접 넣어도 비어 있으면 던진다 — 빈 글을 발행하지 않는다', async () => {
    const fake = fakeBridgePage({ visible: true, value: '', setWorks: false });
    await expect(ensureBodyInHtmlEditor(fake.page, body)).rejects.toThrow('발행하지 않았습니다');
  });

  test('⭐ HTML 편집기가 화면에 없으면 던진다 (숨은 편집기에 든 값은 세지 않는다)', async () => {
    const fake = fakeBridgePage({ visible: false, value: body });
    await expect(ensureBodyInHtmlEditor(fake.page, body)).rejects.toThrow('발행하지 않았습니다');
  });

  test('편집기는 보이는데 값을 읽을 수 없으면 막지 않고 알리기만 한다 — 확인 불가를 실패로 단정하지 않는다', async () => {
    const fake = fakeBridgePage({ visible: true, value: null });
    const logs: string[] = [];
    await expect(ensureBodyInHtmlEditor(fake.page, body, (m) => logs.push(m))).resolves.toBeUndefined();
    expect(logs.join('\n')).toContain('본문 확인을 건너뜁니다');
  });

  test('비상 우회: TISTORY_VERIFY_BODY=off 면 읽지도 않는다', async () => {
    const fake = fakeBridgePage({ visible: false, value: null });
    await expect(ensureBodyInHtmlEditor(fake.page, body, undefined, { TISTORY_VERIFY_BODY: 'off' })).resolves.toBeUndefined();
    expect(fake.ops).toEqual([]);
  });
});

describe('④ 발행 순서 — 전환 확인 → 본문 넣기 → 본문 확인 → 그다음에야 카테고리·발행', () => {
  const publish = braceBlock(PUBLISHER, 'export async function publishToTistory(');
  const bodyStep = blockBetween(publish, "'thumbnail_upload'", 'await selectCategory(');

  test('⭐ 전환 결과를 버리지 않는다 — 실패하면 한 번 더, 그래도 안 되면 던진다', () => {
    expect(bodyStep).not.toMatch(/^\s*await switchToHtmlMode\(page, onLog\);/m);
    expect(bodyStep.match(/await switchToHtmlMode\(page, onLog\)/g)).toHaveLength(2);
    expect(bodyStep).toContain('if (!htmlModeReady) throw new Error(');
  });

  test('⭐ 본문 확인이 본문 넣기 뒤, 카테고리·발행 앞에 있다', () => {
    const fill = bodyStep.indexOf('await fillHtmlEditor(page, finalHtml)');
    const verify = bodyStep.indexOf('await ensureBodyInHtmlEditor(page, finalHtml');
    expect(fill).toBeGreaterThan(-1);
    expect(verify).toBeGreaterThan(fill);
    expect(publish.indexOf('await finishPublish(')).toBeGreaterThan(publish.indexOf('await ensureBodyInHtmlEditor('));
  });
});

describe('⑤ 로그인 창: 이미 로그인된 상태로 열면 2초 뒤 숨기지 않는다', () => {
  const HOME = 'https://myblog.tistory.com/';
  const LOGIN = 'https://www.tistory.com/auth/login';
  const KAKAO = 'https://accounts.kakao.com/login?continue=x';

  test('⭐ 로그인 화면을 본 적 없이 블로그 홈이면 — 숨기지 않고 감시를 끝낸다', () => {
    expect(loginWindowAutoHide(HOME, false)).toEqual({ sawLoginScreen: false, hide: false, done: true });
  });

  test('⭐ 로그인 화면을 거친 뒤 블로그 홈·관리 화면에 오면 숨긴다 (기존 동작)', () => {
    expect(loginWindowAutoHide(LOGIN, false)).toEqual({ sawLoginScreen: true, hide: false, done: false });
    expect(loginWindowAutoHide(KAKAO, true)).toEqual({ sawLoginScreen: true, hide: false, done: false });
    expect(loginWindowAutoHide(HOME, true)).toEqual({ sawLoginScreen: true, hide: true, done: true });
    expect(loginWindowAutoHide('https://myblog.tistory.com/manage/posts', true)).toEqual({ sawLoginScreen: true, hide: true, done: true });
  });

  test('그 밖의 주소에서는 계속 지켜본다', () => {
    expect(loginWindowAutoHide('about:blank', false)).toEqual({ sawLoginScreen: false, hide: false, done: false });
  });
});
