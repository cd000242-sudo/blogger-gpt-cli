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
/**
 * v3.8.463 — 로그인 창 전용 영구 프로필.
 * 기기 지문이 유지돼야 네이버가 로그인마다 자동화 탐지 캡차를 내지 않는다.
 */
const PROFILE_DIR = path.join(SESSION_DIR, 'naver-profile');

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
  /** 연령확인까지 통과해 상품 화면이 실제로 열렸는가 (targetUrl 을 준 경우에만 의미 있음) */
  verified?: boolean;
  error?: string;
}

/**
 * 지금 화면이 어느 단계인지 읽는다 — 로그인 화면 / 연령확인 / 진짜 상품 페이지.
 *
 * 상품 판정을 "로그인 화면이 아니다" 로만 하면 연령확인 안내 페이지를 상품으로
 * 착각한다. 상품 구조(JSON-LD Product 또는 og:product 메타)가 실제로 있어야
 * 통과시킨다 — 그래야 크롤러가 빈손으로 돌지 않는다.
 */
async function readPageState(page: {
  isClosed: () => boolean;
  evaluate: <T>(fn: () => T) => Promise<T>;
}): Promise<{ ageGate: boolean; loginPage: boolean; productReady: boolean } | null> {
  try {
    if (page.isClosed()) return null;
    return await page.evaluate(() => {
      const text = (document.body?.innerText || '').slice(0, 4000);
      const ageGate = /연령\s*확인|성인\s*인증|미성년|19세\s*미만|본인\s*확인이\s*필요/.test(text);
      const loginPage = /nid\.naver\.com|nidlogin/i.test(location.href);

      let hasProduct = false;
      const nodes = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      for (const node of nodes) {
        try {
          const parsed = JSON.parse(node.textContent || '{}');
          const items = Array.isArray(parsed) ? parsed : [parsed];
          if (items.some((it) => /Product/i.test(String(it?.['@type'] || '')))) { hasProduct = true; break; }
        } catch { /* 다음 스크립트 */ }
      }
      if (!hasProduct) {
        const ogType = document.querySelector('meta[property="og:type"]')?.getAttribute('content') || '';
        const price = document.querySelector('meta[property="product:price:amount"]');
        hasProduct = /product/i.test(ogType) || !!price;
      }

      return { ageGate, loginPage, productReady: hasProduct && !ageGate && !loginPage };
    });
  } catch {
    // 페이지 이동 중이면 evaluate 가 실패한다 — 다음 폴링에서 다시 본다
    return null;
  }
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
 * ## 🚦 v3.8.463 — 로그인만으로 끝내지 않는다
 * 사용자 지적: "로그인창 띄우고나서 로그인만하고 끝내는게아니고 성인인증을 해야되
 * … 정상적으로 상품창이뜨면 그때 크롤링이 들어가야되".
 *
 * 실측(2026-08-06, naver.me/GT42MEXe): 상품 주소로 들어가면 네이버가
 * `nid.naver.com/nidlogin.login?...url=https%3A%2F%2Fsmartstore.naver.com%2Fmakkaejo…`
 * 로 보내면서 "네이버 서비스 이용을 위해 연령확인이 필요해요" 를 띄운다.
 * 즉 **되돌아갈 주소가 로그인 URL 안에 들어 있다.** 그래서 로그인 페이지가 아니라
 * `targetUrl` 로 바로 열면, 로그인 → (필요하면) 성인인증 → 상품 페이지까지
 * 네이버가 알아서 데려다 준다.
 *
 * 예전에는 `LOGIN_URL`(되돌아갈 곳 = naver.com)로 열고 쿠키 두 개만 생기면 바로
 * 창을 닫았다. 성인인증은 **상품 페이지에서** 하는 단계라 창이 닫힌 뒤에 와야 할
 * 화면이었고, 그래서 로그인을 해도 수집이 계속 실패했다.
 *
 * targetUrl 을 주면 상품 페이지가 진짜로 열릴 때까지 기다린다(최대 10분).
 * 안 주면 예전처럼 로그인만 확인한다(설정의 "네이버 로그인" 버튼용, 최대 5분).
 */
export async function openNaverLoginWindow(
  onLog?: (message: string) => void,
  targetUrl?: string,
): Promise<NaverLoginResult> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { chromium } = require('playwright');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { CHROMIUM_GPU_SAFE_ARGS } = require('../../utils/chromium-safe-args');

  fs.mkdirSync(SESSION_DIR, { recursive: true });
  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  /**
   * 🤖 v3.8.463 — **번들 Chromium 으로는 네이버 로그인이 안 된다.**
   *
   * 실측(2026-08-06): 번들 Chromium 으로 로그인하니 네이버가
   * "네이버 보안을 위해 추가 확인을 해주세요 / 영수증 빈칸 채우기" 자동화 탐지
   * 화면을 띄우고, 그걸 지나도 다시 연령확인 로그인 화면으로 되돌렸다.
   * 성인인증 단계는 구경도 못 했다. 같은 창을 실제 Chrome 으로 열자 봇 검사 없이
   * 로그인이 통과했다. 쿠팡 수집기(coupang-enrich.ts)도 같은 이유로 channel:'chrome'.
   *
   * 프로필도 영구 디렉토리로 바꾼다. storageState 는 쿠키·localStorage 만 담아서
   * 기기 지문이 매번 새것이 되고, 그러면 네이버가 로그인 때마다 다시 캡차를 낸다.
   * (실측: 8/4 에 저장한 storageState 를 실었는데도 로그인 화면으로 튕겼다.)
   * 로그인 창은 한 번에 하나만 뜨므로(tryClaimLoginPrompt) 프로필 잠금 충돌이 없다 —
   * 동시성 3으로 도는 **크롤 재시도는 지금처럼 storageState** 를 쓴다.
   */
  const launchOptions = {
    headless: false,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    viewport: { width: 1200, height: 860 },
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      ...CHROMIUM_GPU_SAFE_ARGS,
      '--disable-blink-features=AutomationControlled',
      '--window-position=100,50',
      '--window-size=1240,940',
    ],
  };

  /**
   * Chrome 이 안 깔린 PC 도 있다 — 그럴 땐 번들 Chromium 으로라도 창을 띄운다.
   * 캡차를 만날 확률은 높지만, **창이 아예 안 뜨는 것보다는 낫다.**
   * (channel:'chrome' 은 Chrome 이 없으면 실행 자체가 예외를 던진다)
   */
  let ctx: any;
  try {
    ctx = await chromium.launchPersistentContext(PROFILE_DIR, { ...launchOptions, channel: 'chrome' });
  } catch (chromeError: any) {
    onLog?.('[NAVER-LOGIN] ⚠️ 크롬을 찾지 못해 기본 브라우저로 엽니다 — 네이버가 추가 확인(캡차)을 요구할 수 있습니다');
    console.warn('[NAVER-LOGIN] channel:chrome 실패 → 번들 Chromium 폴백:', chromeError?.message);
    ctx = await chromium.launchPersistentContext(PROFILE_DIR, launchOptions);
  }

  try {
    // navigator.webdriver 를 지운다 (playwright-runner.js 와 같은 패치)
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined, configurable: true });
    });

    const page = ctx.pages()[0] || await ctx.newPage();
    // 상품 주소로 열면 로그인 URL 안에 되돌아갈 상품 주소가 실려서, 성인인증까지
    // 마친 뒤 상품 페이지로 돌아온다. 주소가 없으면 예전처럼 로그인 페이지만 연다.
    await page.goto(targetUrl || LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });

    const waitMinutes = targetUrl ? 10 : 5;
    onLog?.(targetUrl
      ? `[NAVER-LOGIN] 창을 열었습니다 — 로그인 후 **성인인증까지** 마쳐 주세요. 상품 화면이 뜨면 자동으로 수집을 이어갑니다 (최대 ${waitMinutes}분)`
      : `[NAVER-LOGIN] 로그인 창을 열었습니다 — 브라우저에서 로그인해 주세요 (최대 ${waitMinutes}분 대기)`);

    const deadline = Date.now() + waitMinutes * 60 * 1000;
    let sawLogin = false;
    let notifiedAgeStep = false;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));

      // 사용자가 창을 닫았으면 그대로 종료
      try {
        if (page.isClosed()) {
          if (sawLogin) {
            // 로그인은 됐는데 창을 닫았다 — 세션이라도 남겨 둔다
            return { ok: true, loggedIn: true, verified: false, error: '창이 닫혔습니다. 성인인증이 끝나지 않았을 수 있습니다.' };
          }
          return { ok: false, loggedIn: false, error: '로그인 창이 닫혔습니다. 다시 시도해 주세요.' };
        }
      } catch {
        return { ok: false, loggedIn: false, error: '로그인 창이 닫혔습니다. 다시 시도해 주세요.' };
      }

      let loggedIn = false;
      try {
        const cookies: Array<{ name: string }> = await ctx.cookies('https://www.naver.com');
        const names = new Set(cookies.map((c) => c.name));
        loggedIn = names.has('NID_AUT') && names.has('NID_SES');
      } catch { /* 쿠키 조회 실패는 다음 폴링에서 다시 본다 */ }

      if (loggedIn && !sawLogin) {
        sawLogin = true;
        onLog?.('[NAVER-LOGIN] ✅ 로그인 확인');
      }

      // 상품 주소가 없으면 로그인만 보고 끝낸다 (설정 버튼 경로)
      if (!targetUrl) {
        if (loggedIn) {
          await ctx.storageState({ path: SESSION_PATH });
          onLog?.('[NAVER-LOGIN] 세션을 저장했습니다');
          return { ok: true, loggedIn: true, verified: false };
        }
        continue;
      }

      const state = await readPageState(page);
      if (!state) continue;

      if (state.productReady) {
        await ctx.storageState({ path: SESSION_PATH });
        onLog?.('[NAVER-LOGIN] 🎉 상품 화면 확인 — 세션을 저장하고 수집을 시작합니다');
        return { ok: true, loggedIn: true, verified: true };
      }

      if (loggedIn && state.ageGate && !notifiedAgeStep) {
        notifiedAgeStep = true;
        onLog?.('[NAVER-LOGIN] 🔞 로그인은 됐지만 아직 연령확인이 남았습니다 — 창에서 본인확인을 마쳐 주세요');
      }
    }

    if (sawLogin) {
      // 로그인까지는 됐다 — 세션을 저장해 두면 다음 시도에서 성인인증만 하면 된다
      try { await ctx.storageState({ path: SESSION_PATH }); } catch { /* noop */ }
      return {
        ok: true,
        loggedIn: true,
        verified: false,
        error: `${waitMinutes}분 안에 연령확인이 끝나지 않았습니다. 네이버에서 본인확인을 마친 뒤 다시 시도해 주세요.`,
      };
    }

    return {
      ok: false,
      loggedIn: false,
      error: `${waitMinutes}분 안에 로그인이 확인되지 않았습니다. 다시 시도해 주세요.`,
    };
  } finally {
    await ctx.close().catch(() => { /* noop */ });
  }
}
