// src/kakao-channel/kakao-poster.js
// v3.8.510 — 카카오톡 채널 소식 자동 발행 (business.kakao.com UI 자동화).
//
// 소식(포스트) 공식 API 는 없다 (2026-08 데브톡 공식 확인) — 관리자 화면을 대신 눌러준다.
// 원칙:
//  - 사장님 손은 로그인 1회 + 충전뿐. 비밀번호는 어디에도 저장하지 않는다 (세션 프로필만).
//  - 하루 2회 하드캡 — 소식 도배는 채널 제재 리스크.
//  - 실패는 "몇 단계, 어느 화면"인지 스크린샷과 함께 돌려준다 (조용한 실패 금지).

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { KAKAO_URLS, KAKAO_SELECTORS, DAILY_CAP } = require('./kakao-selectors');

const PROFILE_ROOT = path.join(os.homedir(), '.leadernam-orbit', 'kakao-channel-profile');
const POST_LOG = path.join(PROFILE_ROOT, 'post-log.json');
const DEBUG_DIR = path.join(PROFILE_ROOT, 'debug');

function firstExistingPath(paths) {
  for (const item of paths) {
    if (item && fs.existsSync(item)) return item;
  }
  return '';
}

// 시스템 크롬/엣지를 우선 사용 — playwright 브라우저 미설치 환경(배포판)에서도 동작
function findBrowserExecutable() {
  if (process.platform !== 'win32') return '';
  const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const localAppData = process.env['LOCALAPPDATA'] || '';
  return firstExistingPath([
    path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    localAppData ? path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe') : '',
    path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ]);
}

async function launch(headless) {
  const { chromium } = require('playwright');
  fs.mkdirSync(PROFILE_ROOT, { recursive: true });
  const executablePath = findBrowserExecutable();
  const context = await chromium.launchPersistentContext(PROFILE_ROOT, {
    headless,
    viewport: { width: 1380, height: 900 },
    ...(executablePath ? { executablePath } : {}),
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const page = context.pages()[0] || await context.newPage();
  return { context, page };
}

function localDay(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function readPostLog() {
  try {
    const parsed = JSON.parse(fs.readFileSync(POST_LOG, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function countPostsToday(now = new Date(), log = readPostLog()) {
  const day = localDay(now);
  return (Array.isArray(log) ? log : []).filter((entry) => entry && entry.day === day).length;
}

function recordPost(now = new Date()) {
  const log = readPostLog();
  const next = [...log, { day: localDay(now), at: now.toISOString() }].slice(-50);
  fs.mkdirSync(PROFILE_ROOT, { recursive: true });
  fs.writeFileSync(POST_LOG, JSON.stringify(next, null, 2), 'utf-8');
}

function isLoggedInUrl(url) {
  return KAKAO_SELECTORS.loggedInUrlPattern.test(url)
    && !KAKAO_SELECTORS.loggedOutUrlPattern.test(url);
}

async function saveDebugShot(page, step) {
  try {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
    const file = path.join(DEBUG_DIR, `${Date.now()}-${step.replace(/[^\w가-힣]/g, '_')}.png`);
    await page.screenshot({ path: file, fullPage: false });
    return file;
  } catch {
    return '';
  }
}

/** 저장된 세션으로 로그인 상태만 확인 (헤드리스, 화면 안 뜸) */
async function checkSession(channelId) {
  const id = String(channelId || '').trim();
  if (!id) return { ok: false, loggedIn: false, error: 'CHANNEL_ID_REQUIRED' };
  let context = null;
  try {
    const launched = await launch(true);
    context = launched.context;
    const page = launched.page;
    await page.goto(KAKAO_URLS.dashboard(id), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1800);
    return { ok: true, loggedIn: isLoggedInUrl(page.url()) };
  } catch (error) {
    return { ok: false, loggedIn: false, error: String(error && error.message || error).slice(0, 200) };
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

/** 보이는 창을 띄워 사장님이 로그인 — 성공 감지 후 닫는다. 비밀번호는 만지지 않는다. */
async function loginInteractive(channelId, timeoutMs = 10 * 60 * 1000) {
  const id = String(channelId || '').trim();
  if (!id) return { ok: false, error: 'CHANNEL_ID_REQUIRED' };
  let context = null;
  try {
    const launched = await launch(false);
    context = launched.context;
    const page = launched.page;
    await page.goto(KAKAO_URLS.dashboard(id), { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (page.isClosed()) return { ok: false, error: 'WINDOW_CLOSED: 로그인 전에 창이 닫혔습니다' };
      if (isLoggedInUrl(page.url())) {
        const bodyLen = await page.evaluate(() => document.body.innerText.length).catch(() => 0);
        if (bodyLen > 200) return { ok: true };
      }
      await page.waitForTimeout(2500);
    }
    return { ok: false, error: 'LOGIN_TIMEOUT: 10분 안에 로그인이 감지되지 않았습니다' };
  } catch (error) {
    return { ok: false, error: String(error && error.message || error).slice(0, 200) };
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

async function fillFirstMatch(page, candidates, value) {
  for (const selector of candidates) {
    const locator = page.locator(selector).first();
    if (await locator.count().catch(() => 0)) {
      const visible = await locator.isVisible().catch(() => false);
      if (!visible) continue;
      await locator.click({ timeout: 5000 }).catch(() => {});
      await locator.fill(value, { timeout: 8000 }).catch(async () => {
        // contenteditable 은 fill 이 안 되는 경우가 있다 — 타이핑 폴백
        await page.keyboard.type(value);
      });
      return selector;
    }
  }
  return '';
}

/**
 * 소식 자동 발행.
 * @param {{ channelId: string, text: string, link?: string, dryRun?: boolean }} input
 * @param {{ logOverride?: Array<{day:string}> }} [testHooks] 테스트 주입용
 */
async function postNews(input, testHooks = {}) {
  const channelId = String(input && input.channelId || '').trim();
  const text = String(input && input.text || '').trim();
  const link = String(input && input.link || '').trim();
  const dryRun = Boolean(input && input.dryRun);

  if (!channelId) return { ok: false, error: 'CHANNEL_ID_REQUIRED: 채널 ID(_로 시작)를 입력해주세요' };
  if (!text) return { ok: false, error: 'EMPTY_TEXT: 발행할 본문이 없습니다 — 먼저 카카오 채널 글을 생성해주세요' };

  const log = testHooks.logOverride !== undefined ? testHooks.logOverride : readPostLog();
  if (!dryRun && countPostsToday(new Date(), log) >= DAILY_CAP) {
    return { ok: false, error: `DAILY_CAP: 오늘 ${DAILY_CAP}회 상한 도달 — 도배는 채널 제재 리스크라 내일 다시 발행해주세요` };
  }

  let step = '브라우저 실행';
  let context = null;
  let page = null;
  try {
    const launched = await launch(true);
    context = launched.context;
    page = launched.page;

    step = '대시보드 접속';
    await page.goto(KAKAO_URLS.dashboard(channelId), { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2000);
    if (!isLoggedInUrl(page.url())) {
      return { ok: false, step, error: 'LOGIN_REQUIRED: 세션이 없습니다 — [채널 연결] 버튼으로 먼저 로그인해주세요' };
    }

    step = '포스트 메뉴 이동';
    const postLink = page.locator('a', { hasText: KAKAO_SELECTORS.postMenuText }).first();
    if (!(await postLink.count())) {
      return { ok: false, step, error: 'POST_MENU_NOT_FOUND: 포스트/소식 메뉴를 찾지 못했습니다', screenshot: await saveDebugShot(page, step) };
    }
    await postLink.click({ timeout: 10000 });
    await page.waitForTimeout(2500);

    step = '작성 화면 열기';
    const writeButton = page.locator('button, a[role="button"], a', { hasText: KAKAO_SELECTORS.composerOpenText }).first();
    if (!(await writeButton.count())) {
      return { ok: false, step, error: 'COMPOSER_NOT_FOUND: 작성 버튼을 찾지 못했습니다', screenshot: await saveDebugShot(page, step) };
    }
    await writeButton.click({ timeout: 10000 });
    await page.waitForTimeout(3000);

    step = '본문 입력';
    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
    const titleLine = lines[0] || '';
    const usedTitle = await fillFirstMatch(page, KAKAO_SELECTORS.titleInputCandidates, titleLine.slice(0, 40));
    const bodyText = usedTitle ? lines.slice(1).join('\n') : text;
    const usedBody = await fillFirstMatch(page, KAKAO_SELECTORS.bodyInputCandidates, bodyText);
    if (!usedBody) {
      return { ok: false, step, error: 'BODY_INPUT_NOT_FOUND: 본문 입력칸을 찾지 못했습니다', screenshot: await saveDebugShot(page, step) };
    }

    if (link) {
      step = '링크 첨부';
      const linkButton = page.locator('button', { hasText: KAKAO_SELECTORS.linkButtonText }).first();
      if (await linkButton.count()) {
        await linkButton.click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1200);
      }
      await fillFirstMatch(page, KAKAO_SELECTORS.linkInputCandidates, link);
      await page.keyboard.press('Enter').catch(() => {});
      await page.waitForTimeout(1500);
    }

    if (dryRun) {
      const shot = await saveDebugShot(page, '드라이런-작성폼');
      return { ok: true, dryRun: true, screenshot: shot };
    }

    step = '발행';
    const submitButton = page.locator('button', { hasText: KAKAO_SELECTORS.submitText }).last();
    if (!(await submitButton.count())) {
      return { ok: false, step, error: 'SUBMIT_NOT_FOUND: 발행 버튼을 찾지 못했습니다', screenshot: await saveDebugShot(page, step) };
    }
    await submitButton.click({ timeout: 10000 });
    await page.waitForTimeout(3500);

    recordPost();
    return { ok: true, channelHome: KAKAO_URLS.channelHome(channelId) };
  } catch (error) {
    const screenshot = page ? await saveDebugShot(page, step) : '';
    return { ok: false, step, error: String(error && error.message || error).slice(0, 300), screenshot };
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

module.exports = {
  PROFILE_ROOT,
  DAILY_CAP,
  checkSession,
  loginInteractive,
  postNews,
  countPostsToday,
  recordPost,
};
