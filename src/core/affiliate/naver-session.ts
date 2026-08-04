/**
 * 네이버 로그인 세션 (v3.8.453) — 성인인증(연령확인) 상품 크롤 전용
 *
 * ## 왜 만드나
 * 주류·성인용품 상품은 네이버가 연령확인을 요구해 비로그인 크롤이 막힌다
 * (실측 2026-08-04: naver.me/GT42MEXe → "연령확인이 필요해요").
 * 사용자 판단: "수동입력을 하면 자동화툴을 쓰는 이유가 없자나 술이나 와인같은거
 * 다루는사람들한테는 꼭필요해 로그인창을 띄워서 로그인할수있게해줘".
 *
 * ## 설계 원칙 — 세션은 최소로 쓴다
 * 일반 크롤은 지금처럼 **비로그인**으로 돈다(3회 연속 정상 실측).
 * 저장된 세션은 크롤이 로그인/연령확인 화면을 만났을 때 **재시도 1회**에만 쓴다.
 * 모든 크롤을 계정에 묶으면 네이버 자동화 탐지에 노출되는 면적이 커진다.
 *
 * ## 저장 방식 — storageState (프로필 디렉토리가 아니라)
 * 티스토리처럼 영구 프로필 디렉토리를 쓰면 디렉토리 잠금 때문에 동시 실행이 안 된다.
 * 네이버 크롤은 crawlAffiliateLinks 가 동시성 3으로 돌므로 잠금이 충돌한다.
 * storageState JSON 은 컨텍스트마다 읽기만 하므로 동시 크롤과 안전하게 공존한다.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SESSION_DIR = path.join(os.homedir(), '.leadernam-orbit');
const SESSION_PATH = path.join(SESSION_DIR, 'naver-session.json');

const REAL_CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const LOGIN_URL = 'https://nid.naver.com/nidlogin.login?mode=form&url=https%3A%2F%2Fwww.naver.com';

export function getNaverSessionPath(): string {
  return SESSION_PATH;
}

/** 저장된 세션이 있는가 (내용까지 검사하지는 않는다 — 만료 여부는 쓸 때 판명된다) */
export function hasNaverSession(): boolean {
  try {
    const stat = fs.statSync(SESSION_PATH);
    return stat.isFile() && stat.size > 10;
  } catch {
    return false;
  }
}

export function clearNaverSession(): void {
  try { fs.rmSync(SESSION_PATH, { force: true }); } catch { /* noop */ }
}

export interface NaverLoginResult {
  ok: boolean;
  loggedIn: boolean;
  error?: string;
}

/**
 * 🔔 v3.8.458 — 발행 중 성인인증을 만나면 로그인 창을 **자동으로 한 번** 띄운다.
 *
 * 사용자 실측: "와인인데 왜 네이버로그인이 안뜨나요??" — 설정에 버튼을 만들어
 * 뒀지만, 발행하다 막힌 순간에 창이 떠야 쓸 수 있다는 기대가 맞다.
 *
 * 앱 실행당 1회만 띄운다:
 *   · 동시 크롤 3개가 창을 3개 띄우는 것 방지 (동기적으로 선점)
 *   · 예약발행처럼 무인 상태에서 창이 반복해서 뜨는 것 방지
 * 로그인하지 않고 닫으면 이번 실행에서는 다시 묻지 않는다 — 설정 버튼은 언제나 열려 있다.
 */
let loginPromptUsedThisRun = false;

export function tryClaimLoginPrompt(): boolean {
  if (loginPromptUsedThisRun) return false;
  loginPromptUsedThisRun = true;
  return true;
}

/**
 * 로그인 창을 띄우고 사용자가 로그인을 마치면 세션을 저장한다.
 *
 * 완료를 기다렸다가 결과를 돌려준다(최대 5분) — UI 가 성공/실패를 바로 보여줄 수
 * 있게 하기 위해서다. 판정은 네이버 로그인 쿠키(NID_AUT + NID_SES)로 한다.
 */
export async function openNaverLoginWindow(
  onLog?: (message: string) => void,
): Promise<NaverLoginResult> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { chromium } = require('playwright');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { CHROMIUM_GPU_SAFE_ARGS } = require('../../utils/chromium-safe-args');

  fs.mkdirSync(SESSION_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: false,
    // 자동화 흔적을 줄인다 — 로그인 화면에서 봇 탐지에 걸리면 사용자가 캡차 지옥에 빠진다
    ignoreDefaultArgs: ['--enable-automation'],
    args: [...CHROMIUM_GPU_SAFE_ARGS, '--window-position=120,80', '--window-size=980,860'],
  });

  try {
    const ctx = await browser.newContext({
      userAgent: REAL_CHROME_UA,
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      viewport: { width: 960, height: 800 },
    });
    const page = await ctx.newPage();
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    onLog?.('[NAVER-LOGIN] 로그인 창을 열었습니다 — 브라우저에서 로그인해 주세요 (최대 5분 대기)');

    const deadline = Date.now() + 5 * 60 * 1000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));

      // 사용자가 창을 닫았으면 그대로 종료
      try {
        if (page.isClosed()) {
          return { ok: false, loggedIn: false, error: '로그인 창이 닫혔습니다. 다시 시도해 주세요.' };
        }
      } catch {
        return { ok: false, loggedIn: false, error: '로그인 창이 닫혔습니다. 다시 시도해 주세요.' };
      }

      try {
        const cookies: Array<{ name: string }> = await ctx.cookies('https://www.naver.com');
        const names = new Set(cookies.map((c) => c.name));
        if (names.has('NID_AUT') && names.has('NID_SES')) {
          await ctx.storageState({ path: SESSION_PATH });
          onLog?.('[NAVER-LOGIN] ✅ 로그인 확인 — 세션을 저장했습니다');
          return { ok: true, loggedIn: true };
        }
      } catch { /* 쿠키 조회 실패는 다음 폴링에서 다시 본다 */ }
    }

    return {
      ok: false,
      loggedIn: false,
      error: '5분 안에 로그인이 확인되지 않았습니다. 다시 시도해 주세요.',
    };
  } finally {
    await browser.close().catch(() => { /* noop */ });
  }
}
