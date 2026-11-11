/**
 * Genspark image engine — the "try Media Studio" notice must not block the send button.
 *
 * Measured 2026-11-11 (logged-in account, app 3.8.770): /ai_image shows a notice ("AI 이미지은(는) 이제 Media Studio의
 * 일부입니다") inside `.mar-backdrop`. The backdrop covers the page, so the click on [aria-label="메시지 전송"] timed out
 * after 10 s and every Genspark image failed ("모든 이미지 엔진 실패") although the account was logged in.
 */
import fs from 'fs';
import path from 'path';
import { blockBetween } from './helpers/source-block';
import { dismissGensparkNotice } from '../src/core/genspark/genspark-image';

function fakePage(opts: { backdropVisible: boolean; laterVisible: boolean }) {
  const calls: string[] = [];
  let open = opts.backdropVisible;
  const later = {
    first: () => later,
    isVisible: async () => open && opts.laterVisible,
    click: async () => { calls.push('click:later'); open = false; },
  };
  const backdrop = {
    first: () => backdrop,
    isVisible: async () => open,
    locator: (_sel: string, _o?: unknown) => later,
    waitFor: async () => undefined,
  };
  const page = {
    locator: (sel: string) => { calls.push(`locator:${sel}`); return backdrop; },
    keyboard: { press: async (key: string) => { calls.push(`key:${key}`); open = false; } },
  };
  return { page, calls };
}

describe('dismissGensparkNotice', () => {
  it('does nothing when no notice is shown', async () => {
    const { page, calls } = fakePage({ backdropVisible: false, laterVisible: false });
    expect(await dismissGensparkNotice(page)).toBe(false);
    expect(calls).toEqual(['locator:.mar-backdrop']);
  });

  it('closes the notice with its "later" button and reports it', async () => {
    const logs: string[] = [];
    const { page, calls } = fakePage({ backdropVisible: true, laterVisible: true });
    expect(await dismissGensparkNotice(page, (m) => logs.push(m))).toBe(true);
    expect(calls).toContain('click:later');
    expect(calls).not.toContain('key:Escape');
    expect(logs.join(' ')).toMatch(/안내 창/);
  });

  it('falls back to Escape when the button is not there', async () => {
    const { page, calls } = fakePage({ backdropVisible: true, laterVisible: false });
    expect(await dismissGensparkNotice(page)).toBe(true);
    expect(calls).toContain('key:Escape');
  });

  it('never ticks "do not show again" (the account setting is the user\'s)', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/core/genspark/genspark-image.ts'), 'utf8');
    const fn = blockBetween(src, 'export async function dismissGensparkNotice', 'export interface GensparkImageResult');
    expect(fn).not.toMatch(/checkbox|다시 표시하지/);
  });
});

describe('makeOnce — send click', () => {
  it('retries the send click once after closing the notice, and keeps the first error when there was no notice', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/core/genspark/genspark-image.ts'), 'utf8');
    const send = blockBetween(src, "page.locator('[aria-label=\"메시지 전송\"]').first()", "options.onLog?.('✨ 젠스파크 이미지 생성 중");
    expect(send).toMatch(/catch \(clickError\)/);
    expect(send).toMatch(/if \(!\(await dismissGensparkNotice\(page, options\.onLog\)\)\) throw clickError;/);
    expect((send.match(/\.click\(\{ timeout:/g) || []).length).toBe(2);
  });
});

/**
 * Second cause, measured the same day: after the notice is closed, a HEADLESS browser gets
 * "서버가 과부하 상태입니다. 나중에 다시 시도해 주세요." within 4 s (both Seedream 5.5 and Nano Banana 2 Flash Lite),
 * while the same profile in an ordinary (headed) window placed off-screen gets its image in about 31 s.
 * The old code also waited the full 3 minutes on that refusal and reported only a timeout.
 */
import { gensparkLaunchOptions } from '../src/core/genspark/genspark-client';
import { parseGensparkImageProject, judgeImageProgress } from '../src/core/genspark/genspark-image';

describe('gensparkLaunchOptions', () => {
  it('headless by default (login check, research)', () => {
    const o = gensparkLaunchOptions('C:/chrome.exe', false);
    expect(o.headless).toBe(true);
    expect(o.args.join(' ')).not.toMatch(/window-position/);
  });

  it('an ordinary window parked off-screen for image generation', () => {
    const o = gensparkLaunchOptions('C:/chrome.exe', true);
    expect(o.headless).toBe(false);
    expect(o.args).toContain('--window-position=-32000,-32000');
    expect(o.executablePath).toBe('C:/chrome.exe');
    expect(o.ignoreDefaultArgs).toEqual(['--enable-automation']);
  });

  it('the image engine asks for the off-screen window', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/core/genspark/genspark-image.ts'), 'utf8');
    expect(src).toMatch(/openGensparkHeadless\(options\.onLog, \{ visibleOffscreen: true \}\)/);
  });
});

describe('refusal from Genspark ("server overloaded")', () => {
  const refused = { data: { status: 'FINISHED', session_state: { messages: [
    { role: 'user', content: 'a room' },
    { role: 'assistant', content: '서버가 과부하 상태입니다. 나중에 다시 시도해 주세요.', session_state: null },
  ] } } };
  const started = { data: { status: 'FINISHED', session_state: { messages: [
    { role: 'user', content: 'a room' },
    { role: 'assistant', content: 'Bytedance Seedream 5.5 모델로 16:9 비율의 이미지 생성을 시작했습니다.', session_state: null },
  ] } } };

  it('is read from the last assistant message; an ordinary "started" message is not a refusal', () => {
    expect(parseGensparkImageProject(refused).refusal).toMatch(/과부하/);
    expect(parseGensparkImageProject(started).refusal).toBeUndefined();
    // data.status is FINISHED from the first poll even on a run that succeeds 30 s later, so it must not end the wait
    expect(parseGensparkImageProject(started).finished).toBe(false);
    expect(parseGensparkImageProject(null)).toEqual({ finished: false, images: [] });
  });

  it('fails soon with Genspark\'s own words instead of waiting three minutes', () => {
    const p = parseGensparkImageProject(refused);
    expect(judgeImageProgress(p, 0, 2_000).state).toBe('wait');
    const verdict = judgeImageProgress(p, 0, 9_000);
    expect(verdict.state).toBe('failed');
    expect(verdict.reason).toMatch(/GENSPARK_REFUSED/);
    expect(verdict.reason).toMatch(/서버가 과부하 상태입니다/);
  });

  it('a run that only said "started" keeps waiting', () => {
    expect(judgeImageProgress(parseGensparkImageProject(started), 0, 60_000).state).toBe('wait');
  });
});
