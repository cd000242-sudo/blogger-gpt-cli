// src/kakao-channel/kakao-poster.js
// v3.8.511 — 카카오톡 채널 소식 자동 발행 (business.kakao.com UI 자동화, 2026-08-17 실측 기반).
//
// 소식(포스트) 공식 API 는 없다 (2026-08 데브톡 공식 확인) — 관리자 화면을 대신 눌러준다.
// 실측에서 확정된 사실:
//  - 화면은 Shadow DOM — playwright locator 만 요소를 찾는다 (querySelector 무력).
//  - 카카오 세션 쿠키는 브라우저 종료 시 증발 — 로그인 직후 storageState 로 백업해
//    다음 실행 때 주입한다 (주입 복원 검증 완료 2026-08-17).
//  - 작성 화면은 /posts 직행. 제목 input[placeholder="제목"], 본문 textarea[type="creator"],
//    발행 버튼은 정확히 "등록" ("등록순" 버튼과 substring 충돌 — exact 필수).
// 원칙:
//  - 사장님 손은 로그인 1회 + 충전뿐. 비밀번호는 어디에도 저장하지 않는다 (세션 쿠키만).
//  - 하루 2회 하드캡 — 소식 도배는 채널 제재 리스크.
//  - 실패는 "몇 단계, 어느 화면"인지 스크린샷과 함께 돌려준다 (조용한 실패 금지).

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { KAKAO_URLS, KAKAO_SELECTORS, CARD_LIMITS, CARD_MAX, DAILY_CAP } = require('./kakao-selectors');

const PROFILE_ROOT = path.join(os.homedir(), '.leadernam-orbit', 'kakao-channel-profile');
const STATE_FILE = path.join(PROFILE_ROOT, 'state.json'); // storageState 쿠키 백업
const POST_LOG = path.join(PROFILE_ROOT, 'post-log.json');
const CHANNEL_CACHE = path.join(PROFILE_ROOT, 'channel.json'); // 자동 인식된 채널 ID (사용자별)
const DEBUG_DIR = path.join(PROFILE_ROOT, 'debug');

function firstExistingPath(paths) {
  for (const item of paths) {
    if (item && fs.existsSync(item)) return item;
  }
  return '';
}

// 실제 크롬/엣지 필수 — 번들 크로미움은 카카오에서 빈 화면 스톨 (2026-08-17 실측)
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

/** 헤드리스 작업용 — 백업 쿠키(storageState)를 주입한 새 브라우저 */
async function launchWithState() {
  const { chromium } = require('playwright');
  const executablePath = findBrowserExecutable();
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1380, height: 900 },
    ...(fs.existsSync(STATE_FILE) ? { storageState: STATE_FILE } : {}),
  });
  const page = await context.newPage();
  return { browser, context, page };
}

/** 로그인 창용 — 보이는 지속 프로필 (간편로그인 저장 계정이 남아 다음 로그인이 원클릭) */
async function launchLoginWindow() {
  const { chromium } = require('playwright');
  fs.mkdirSync(PROFILE_ROOT, { recursive: true });
  const executablePath = findBrowserExecutable();
  const context = await chromium.launchPersistentContext(path.join(PROFILE_ROOT, 'browser'), {
    headless: false,
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

/** PNG IHDR 에서 가로·세로 읽기 (외부 의존성 없이) */
function pngSize(file) {
  try {
    const buf = fs.readFileSync(file);
    if (buf.length < 24 || buf.readUInt32BE(12) !== 0x49484452) return null; // 'IHDR'
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  } catch {
    return null;
  }
}

/**
 * v3.8.516 — 카드는 무조건 세로형(3:4)으로 나간다. 카드뉴스의 정체성이 세로형이다 (사장님 확정).
 * 이미 3:4 이상이면 그대로, 아니면(1:1·4:5) 1080×1440 cover 로 변환해 임시 파일로 만든다.
 * 변환 통과는 실검증됨 (2026-08-17: 변환한 1080×1440 이 카카오 세로형 검증 ✅).
 */
async function toPortraitFile(browser, file, outDir, index) {
  const size = pngSize(file);
  if (size && size.width > 0 && size.height / size.width >= 4 / 3) return file; // 이미 세로형
  const mime = /\.jpe?g$/i.test(file) ? 'image/jpeg' : 'image/png';
  const b64 = fs.readFileSync(file).toString('base64');
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1080, height: 1440 });
    await page.setContent(`<body style="margin:0"><img src="data:${mime};base64,${b64}" style="width:1080px;height:1440px;object-fit:cover;display:block"></body>`);
    await page.waitForTimeout(400);
    fs.mkdirSync(outDir, { recursive: true });
    const out = path.join(outDir, `portrait-${index}.png`);
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1080, height: 1440 } });
    return out;
  } finally {
    await page.close().catch(() => {});
  }
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

function readCachedChannelId() {
  try {
    return String(JSON.parse(fs.readFileSync(CHANNEL_CACHE, 'utf-8')).channelId || '');
  } catch {
    return '';
  }
}

function cacheChannelId(channelId) {
  try {
    fs.mkdirSync(PROFILE_ROOT, { recursive: true });
    fs.writeFileSync(CHANNEL_CACHE, JSON.stringify({ channelId, at: new Date().toISOString() }, null, 2), 'utf-8');
  } catch { /* 캐시 실패는 치명적이지 않다 */ }
}

// _guest 는 비즈멤버십 안내용 자리표시자 — 채널이 아니다 (2026-08-17 실검증에서 오인식 사고)
function extractRealChannelId(text) {
  const match = String(text || '').match(/\/(_[A-Za-z0-9]+)/);
  return match && match[1] !== '_guest' ? match[1] : '';
}

/**
 * 채널 ID 자동 인식 — 사용자가 타이핑할 이유가 없다 (배포용: 사용자마다 자기 채널).
 * 실검증 확정 경로(2026-08-17): 루트 → "내 비즈니스" 클릭 → 자기 채널 대시보드로 이동 → URL 에서 추출.
 */
async function detectChannelId(options = {}) {
  const cached = readCachedChannelId();
  if (cached && !options.force) return { ok: true, channelId: cached, cached: true };
  if (!fs.existsSync(STATE_FILE)) return { ok: false, error: 'LOGIN_REQUIRED: 먼저 [채널 연결]로 로그인해주세요' };
  let browser = null;
  try {
    const launched = await launchWithState();
    browser = launched.browser;
    const page = launched.page;
    await page.goto('https://business.kakao.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4000);
    if (!isLoggedInUrl(page.url())) {
      return { ok: false, error: 'LOGIN_REQUIRED: 세션이 만료됐습니다 — [채널 연결]로 다시 로그인해주세요' };
    }
    let channelId = extractRealChannelId(page.url());
    if (!channelId) {
      // "내 비즈니스" → 자기 채널 대시보드로 이동한다 (실검증 경로)
      const myBiz = page.locator('text=내 비즈니스').first();
      if (await myBiz.count().catch(() => 0)) {
        await myBiz.click({ timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(5000);
        channelId = extractRealChannelId(page.url());
      }
    }
    if (!channelId) {
      // 다중 채널 선택 화면 폴백 — 첫 실채널 링크에서 추출
      const anchors = page.locator('a[href*="/_"]');
      const total = Math.min(await anchors.count().catch(() => 0), 60);
      for (let i = 0; i < total; i++) {
        const href = await anchors.nth(i).getAttribute('href').catch(() => '');
        channelId = extractRealChannelId(href);
        if (channelId) break;
      }
    }
    if (!channelId) {
      return { ok: false, error: 'CHANNEL_NOT_FOUND: 채널을 자동 인식하지 못했습니다 — ID 칸에 직접 입력해주세요' };
    }
    cacheChannelId(channelId);
    return { ok: true, channelId };
  } catch (error) {
    return { ok: false, error: String(error && error.message || error).slice(0, 200) };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/** 백업 쿠키로 로그인 상태 확인 (헤드리스, 화면 안 뜸). 채널 ID 없으면 캐시→루트 순으로 판정 */
async function checkSession(channelId) {
  const id = String(channelId || '').trim() || readCachedChannelId();
  if (!fs.existsSync(STATE_FILE)) return { ok: true, loggedIn: false, channelId: id };
  let browser = null;
  try {
    const launched = await launchWithState();
    browser = launched.browser;
    const page = launched.page;
    const target = id ? KAKAO_URLS.dashboard(id) : 'https://business.kakao.com/';
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000); // 리다이렉트 정착 대기 — 조기 판정 금지
    return { ok: true, loggedIn: isLoggedInUrl(page.url()), channelId: id };
  } catch (error) {
    return { ok: false, loggedIn: false, error: String(error && error.message || error).slice(0, 200) };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/**
 * 보이는 창을 띄워 사장님이 로그인 — 성공 감지 즉시 쿠키를 백업하고 닫는다.
 * 비밀번호는 만지지 않는다. 감지는 URL 기준 + 8초 정착 + 2회 연속 확인
 * (본문 길이 검사는 Shadow DOM 때문에 영원히 실패한다 — 2026-08-17 사고).
 */
async function loginInteractive(channelId, timeoutMs = 10 * 60 * 1000) {
  // 채널 ID 는 몰라도 된다 — 루트로 들어가면 로그인 후 자기 채널로 리다이렉트되고 거기서 인식한다
  const id = String(channelId || '').trim();
  let context = null;
  try {
    const launched = await launchLoginWindow();
    context = launched.context;
    let page = launched.page;
    const target = id ? KAKAO_URLS.dashboard(id) : 'https://business.kakao.com/';
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(8000).catch(() => {}); // 리다이렉트 정착
    const deadline = Date.now() + timeoutMs;
    let confirmCount = 0;
    while (Date.now() < deadline) {
      const pages = context.pages();
      if (!pages.length) return { ok: false, error: 'WINDOW_CLOSED: 로그인 전에 창이 닫혔습니다' };
      let hit = null;
      for (const candidate of pages) {
        if (isLoggedInUrl(candidate.url())) { hit = candidate; break; }
      }
      if (hit) {
        confirmCount += 1;
        if (confirmCount >= 2) {
          page = hit;
          // 세션 쿠키는 창을 닫으면 증발한다 — 지금 즉시 백업
          await context.storageState({ path: STATE_FILE });
          // 로그인된 URL 에서 채널 ID 자동 인식 (배포용: 사용자마다 자기 채널, _guest 오인식 방지)
          const detected = extractRealChannelId(page.url()) || id || readCachedChannelId();
          if (detected) cacheChannelId(detected);
          return { ok: true, channelId: detected || '' };
        }
      } else {
        confirmCount = 0;
      }
      await pages[0].waitForTimeout(3000).catch(() => {});
    }
    return { ok: false, error: 'LOGIN_TIMEOUT: 10분 안에 로그인이 감지되지 않았습니다' };
  } catch (error) {
    return { ok: false, error: String(error && error.message || error).slice(0, 200) };
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

/**
 * 소식 자동 발행 (실측 확정 흐름: /posts 직행 → 제목·본문 입력 → 링크 → 등록).
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
  let browser = null;
  let page = null;
  try {
    const launched = await launchWithState();
    browser = launched.browser;
    page = launched.page;

    step = '소식 작성 화면 접속';
    await page.goto(KAKAO_URLS.posts(channelId), { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(5000); // SPA 렌더 대기
    if (!isLoggedInUrl(page.url())) {
      return { ok: false, step, error: 'LOGIN_REQUIRED: 세션이 없습니다 — [채널 연결] 버튼으로 먼저 로그인해주세요' };
    }

    step = '제목 입력';
    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
    const titleLine = (lines[0] || '').slice(0, 100);
    const bodyText = lines.slice(1).join('\n') || titleLine;
    const titleInput = page.locator(KAKAO_SELECTORS.titleInput).first();
    if (!(await titleInput.count())) {
      return { ok: false, step, error: 'TITLE_INPUT_NOT_FOUND: 제목 칸을 찾지 못했습니다', screenshot: await saveDebugShot(page, step) };
    }
    await titleInput.click({ timeout: 8000 });
    await titleInput.fill(titleLine, { timeout: 8000 });

    step = '본문 입력';
    const bodyInput = page.locator(KAKAO_SELECTORS.bodyInput).first();
    if (!(await bodyInput.count())) {
      return { ok: false, step, error: 'BODY_INPUT_NOT_FOUND: 본문 칸을 찾지 못했습니다', screenshot: await saveDebugShot(page, step) };
    }
    await bodyInput.click({ timeout: 8000 });
    await bodyInput.fill(bodyText, { timeout: 10000 });

    // 카드뷰(카드뉴스) 첨부 — 카드뉴스 탭에서 만든 카드를 전부 재사용 (재생성 없음, 비용 0).
    // v3.8.515: 여러 장 캐러셀 — 첫 장은 카드뷰 탭, 이후는 "카드 추가" 버튼. 링크 버튼은 마지막 카드에만.
    // v3.8.516: 무조건 세로형 — 정사각형 폴백 없음 (카드뉴스의 정체성이 세로형, 사장님 확정).
    //           3:4 미만 파일은 발행 직전 1080×1440 으로 자동 변환한다.
    const cards = Array.isArray(input && input.cards) && input.cards.length
      ? input.cards.filter((c) => c && c.imagePath).slice(0, CARD_MAX)
      : (input && input.card && input.card.imagePath ? [input.card] : []);
    let cardAttached = false;
    let cardsAttached = 0;
    if (cards.length) {
      step = '카드 세로형 변환';
      const tmpDir = path.join(PROFILE_ROOT, 'tmp-cards');
      for (let i = 0; i < cards.length; i++) {
        if (!fs.existsSync(cards[i].imagePath)) {
          return { ok: false, step, cardsAttached, error: `CARD_IMAGE_NOT_FOUND: 카드 이미지가 없습니다 — ${cards[i].imagePath}` };
        }
        cards[i] = { ...cards[i], imagePath: await toPortraitFile(browser, cards[i].imagePath, tmpDir, i) };
      }
    }
    for (let i = 0; i < cards.length; i++) {
      const cardItem = cards[i];
      const isLast = i === cards.length - 1;
      step = `카드 ${i + 1}/${cards.length} 첨부`;
      if (i === 0) {
        // btn_tab 스코프 — 화면 다른 곳의 동일 텍스트 오클릭 방지 (실측)
        await page.locator(KAKAO_SELECTORS.tabButton, { hasText: KAKAO_SELECTORS.cardViewTabText }).first().click({ timeout: 8000 });
      } else {
        const addButton = page.locator(`button:has-text("${KAKAO_SELECTORS.cardAddText}")`).first();
        if (!(await addButton.count())) {
          return { ok: false, step, cardsAttached, error: 'CARD_ADD_NOT_FOUND: 카드 추가 버튼을 찾지 못했습니다', screenshot: await saveDebugShot(page, step) };
        }
        await addButton.click({ timeout: 8000 });
      }
      await page.waitForTimeout(2500);
      // 항상 세로형 (v3.8.516) — 변환을 거쳤으니 검증(3:4 이상)을 반드시 통과한다
      await page.getByText(KAKAO_SELECTORS.cardShapePortraitText, { exact: true }).first().click({ timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(800);
      const fileInput = page.locator(KAKAO_SELECTORS.cardFileInput).last();
      if (!(await fileInput.count())) {
        return { ok: false, step, cardsAttached, error: 'CARD_FILE_INPUT_NOT_FOUND: 카드 이미지 업로드 칸을 찾지 못했습니다', screenshot: await saveDebugShot(page, step) };
      }
      await fileInput.setInputFiles(cardItem.imagePath);
      await page.waitForTimeout(5000); // 업로드 완료 대기
      await page.locator(KAKAO_SELECTORS.cardTitleInput).first().fill(String(cardItem.title || titleLine).slice(0, CARD_LIMITS.title), { timeout: 8000 });
      await page.locator(KAKAO_SELECTORS.cardBodyInput).first().fill(String(cardItem.body || '').slice(0, CARD_LIMITS.body), { timeout: 8000 });
      if (isLast && cardItem.buttonUrl) {
        step = `카드 ${i + 1} 버튼(링크) 설정`;
        await page.getByText(KAKAO_SELECTORS.cardButtonYesText, { exact: true }).first().click({ timeout: 6000 }).catch(() => {});
        await page.waitForTimeout(1200);
        const nameInput = page.locator(KAKAO_SELECTORS.cardButtonNameInput).first();
        if (await nameInput.count()) {
          await nameInput.fill(String(cardItem.buttonLabel || '전체 글 보기').slice(0, CARD_LIMITS.buttonLabel), { timeout: 6000 });
        }
        const urlInput = page.locator(KAKAO_SELECTORS.cardButtonUrlInput).first();
        if (await urlInput.count()) {
          await urlInput.fill(String(cardItem.buttonUrl), { timeout: 6000 });
        }
      }
      step = `카드 ${i + 1} 확인`;
      await page.getByRole('button', { name: KAKAO_SELECTORS.cardConfirmText, exact: true }).last().click({ timeout: 8000 });
      await page.waitForTimeout(2500);
      // 확인 후에도 모달이 열려 있으면 형식 거부(비율 등) — 조용히 넘기지 않는다
      const modalStillOpen = await page.locator('text=카드뷰 만들기').count().catch(() => 0);
      if (modalStillOpen) {
        return { ok: false, step, cardsAttached, error: `CARD_REJECTED: 카드 ${i + 1} 이 첨부되지 않았습니다 (이미지 비율·형식 검증 거부 가능성)`, screenshot: await saveDebugShot(page, step) };
      }
      cardsAttached += 1;
      cardAttached = true;
    }

    let linkAttached = false;
    if (link && !cardAttached) { // 카드가 있으면 링크는 카드 버튼에 산다 — 이중 첨부 금지
      step = '링크 첨부';
      const linkTab = page.locator(KAKAO_SELECTORS.tabButton, { hasText: KAKAO_SELECTORS.linkTabText }).first();
      if (await linkTab.count()) {
        await linkTab.click({ timeout: 6000 }).catch(() => {});
        await page.waitForTimeout(1500);
        for (const selector of KAKAO_SELECTORS.linkInputCandidates) {
          const linkInput = page.locator(selector).first();
          if (await linkInput.count().catch(() => 0)) {
            await linkInput.fill(link, { timeout: 6000 }).catch(() => {});
            await page.keyboard.press('Enter').catch(() => {});
            await page.waitForTimeout(2000);
            linkAttached = true;
            break;
          }
        }
      }
      if (!linkAttached) {
        // 링크 위젯을 못 찾으면 본문 끝에 붙인다 — 소식 본문 URL 은 자동 링크된다
        await bodyInput.fill(`${bodyText}\n\n${link}`, { timeout: 10000 }).catch(() => {});
      }
    }

    if (dryRun) {
      const shot = await saveDebugShot(page, '드라이런-작성폼');
      return { ok: true, dryRun: true, linkAttached, cardAttached, cardsAttached, screenshot: shot };
    }

    step = '등록';
    // "등록순" 버튼과 substring 충돌 — 정확 일치만 (실측 확인)
    const submitButton = page.getByRole('button', { name: KAKAO_SELECTORS.submitExactText, exact: true }).first();
    if (!(await submitButton.count())) {
      return { ok: false, step, error: 'SUBMIT_NOT_FOUND: 등록 버튼을 찾지 못했습니다', screenshot: await saveDebugShot(page, step) };
    }
    await submitButton.click({ timeout: 10000 });
    await page.waitForTimeout(4000);

    recordPost();
    return { ok: true, linkAttached, cardAttached, cardsAttached, channelHome: KAKAO_URLS.channelHome(channelId) };
  } catch (error) {
    const screenshot = page ? await saveDebugShot(page, step) : '';
    return { ok: false, step, error: String(error && error.message || error).slice(0, 300), screenshot };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = {
  PROFILE_ROOT,
  STATE_FILE,
  DAILY_CAP,
  detectChannelId,
  checkSession,
  loginInteractive,
  postNews,
  countPostsToday,
  recordPost,
};
