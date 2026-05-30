/**
 * 🍌 Dropshot 이미지 생성 엔진 (UI 자동화 방식)
 *
 * dropshot.io의 nano-banana-pro 모델을 Playwright UI 조작으로 자동 사용.
 * - API 직접 호출은 Cognito refresh token 외부 흐름 우회 불가능 → UI 조작으로 우회
 * - 같은 profile 영구 세션 (~/.blogger-gpt/dropshot-profile/)
 * - 결과는 DOM의 `<img src="data:image/png;base64,...">`에서 직접 scrape
 *
 * ⚠️ 비용:
 * - Pro 구독자: 무제한 (isUnlimited)
 * - 무료 사용자: creditCost 75/이미지 — 무료 quota 소진 시 자동 실패
 *
 * 패턴 출처: docs/IMAGE_SITE_AUTOMATION_PORTING.md
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

const BOARD_URL = 'https://aistudio.dropshot.io/ko/workspace/board?panel=image&imageModelName=google/nano-banana-pro';
const PROFILE_NAME = 'dropshot-profile';
const PROMPT_SELECTOR = 'textarea[placeholder="어떤 장면을 만들고 싶나요?"]';

let cachedContext: any = null;
let cachedPage: any = null;
let _ensurePagePromise: Promise<any> | null = null;

function getProfileDir(): string {
  const dir = path.join(os.homedir(), '.blogger-gpt', PROFILE_NAME);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function launchBrowser(profileDir: string, headless: boolean): Promise<any> {
  let chromium: any;
  try {
    chromium = (await import('patchright' as any)).chromium;
  } catch {
    chromium = (await import('playwright')).chromium;
  }

  const forceVisible = String(process.env['VISIBLE_BROWSER'] || '').toLowerCase() === 'true';
  const effectiveHeadless = forceVisible ? false : headless;

  const baseOptions: any = {
    headless: effectiveHeadless,
    args: [
      '--no-first-run',
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--lang=ko-KR,ko',
      '--window-size=1280,900',
    ],
    viewport: { width: 1280, height: 900 },
    locale: 'ko-KR',
    timezoneId: (() => {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul'; }
      catch { return 'Asia/Seoul'; }
    })(),
    ignoreDefaultArgs: ['--enable-automation'],
  };

  const stealthInit = () => {
    Object.defineProperty(navigator, 'languages', {
      get: () => ['ko-KR', 'ko', 'en-US', 'en'],
      configurable: true,
    });
  };

  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      const opts = channel ? { ...baseOptions, channel } : baseOptions;
      const ctx = await chromium.launchPersistentContext(profileDir, opts);
      try { await ctx.addInitScript(stealthInit); } catch { /* ignore */ }
      return ctx;
    } catch { /* 다음 채널 */ }
  }
  throw new Error('Chrome/Edge/Chromium 실행 실패');
}

/** 사이트가 로그인 상태인지 — board 페이지 로드 후 "플랜 업그레이드" 또는 "이미지 생성" 메뉴 보이면 OK */
/**
 * v3.7.1: dropshot UI 컨트롤 자동 설정
 *   - 무제한 모드 토글 ON (Pro 구독자 무제한 권한 활성화)
 *   - 카운터(생성 장수)를 1로 (기본 2개씩 생성 → 1개로 변경 — 우리는 1프롬프트=1이미지)
 *   호출 시점: makeDropshotImage 진입 시 매번 (idempotent — 이미 정상이면 no-op)
 */
async function ensureDropshotControls(page: any, onLog?: (m: string) => void): Promise<void> {
  try {
    // 1. 무제한 모드 토글 ON
    const switchHandles = await page.$$('input[role="switch"]');
    for (const sw of switchHandles) {
      const isOn = await sw.evaluate((el: any) => el.checked === true || el.getAttribute('aria-checked') === 'true');
      if (!isOn) {
        // sr-only input은 직접 클릭 안 되므로 부모 label/button 클릭
        const parent = await sw.evaluateHandle((el: any) => el.closest('label') || el.closest('button') || el.parentElement);
        if (parent) {
          try { await parent.click({ timeout: 2000 }); } catch {}
          await new Promise(r => setTimeout(r, 300));
          onLog?.('🎛️ [Dropshot] 무제한 모드 자동 ON');
        }
      }
    }

    // 2. 카운터(생성 장수) 1로 설정 — 우리는 1프롬프트=1이미지 정책
    await page.evaluate(() => {
      // input[type="number"] 직접 변경 + React 이벤트 dispatch
      const numberInputs = Array.from(document.querySelectorAll('input[type="number"]')) as HTMLInputElement[];
      for (const inp of numberInputs) {
        const v = Number(inp.value);
        // 의도된 카운터만 (1~10 범위)
        if (v >= 2 && v <= 10) {
          // React-controlled input은 native setter 호출 필요
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (setter) setter.call(inp, '1');
          else inp.value = '1';
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      // 폴백: number input 없으면 - 버튼 반복 클릭
      if (numberInputs.length === 0) {
        const allBtns = Array.from(document.querySelectorAll('button'));
        const minusBtns = allBtns.filter(b => {
          const t = (b.textContent || '').trim();
          if (t === '-' || t === '−') return true;
          if (b.querySelector('img[src*="ic_minus"]')) return true;
          return false;
        });
        for (const minus of minusBtns) {
          // 같은 카운터 그룹의 숫자 찾기
          const grp = minus.parentElement;
          const numTxt = grp?.querySelector('span:not(:has(img))')?.textContent || '';
          let cur = parseInt(numTxt, 10) || 0;
          let safety = 10;
          while (cur > 1 && safety-- > 0) {
            (minus as HTMLButtonElement).click();
            // 다시 읽기
            cur = parseInt(grp?.querySelector('span:not(:has(img))')?.textContent || '0', 10);
          }
        }
      }
    });
  } catch (e: any) {
    onLog?.(`⚠️ [Dropshot] 컨트롤 자동 조정 실패 (무시): ${(e.message || '').slice(0, 80)}`);
  }
}

async function isLoggedIn(page: any): Promise<boolean> {
  try {
    const has = await page.evaluate(() => {
      const text = document.body.innerText || '';
      return text.includes('이미지 생성') || text.includes('플랜 업그레이드') || text.includes('워크스페이스');
    });
    return !!has;
  } catch { return false; }
}

export async function ensurePage(onLog?: (m: string) => void): Promise<any> {
  if (_ensurePagePromise) {
    await _ensurePagePromise;
    if (cachedPage && cachedContext) {
      try {
        await cachedPage.evaluate(() => document.readyState);
        return cachedPage;
      } catch { /* 죽음 → 재초기화 */ }
    }
  }
  let lockResolve!: (value: any) => void;
  _ensurePagePromise = new Promise<any>(r => { lockResolve = r; });
  try { return await _ensurePageInternal(onLog); }
  finally { _ensurePagePromise = null; lockResolve(undefined); }
}

async function _ensurePageInternal(onLog?: (m: string) => void): Promise<any> {
  if (cachedPage && cachedContext) {
    try {
      await cachedPage.evaluate(() => document.readyState);
      if (!cachedPage.url().includes('dropshot.io')) {
        await cachedPage.goto(BOARD_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 3000));
      }
      return cachedPage;
    } catch {
      cachedPage = null; cachedContext = null;
    }
  }

  const profileDir = getProfileDir();
  onLog?.('🌐 [Dropshot] 브라우저 준비 중...');

  // headless 먼저
  let context = await launchBrowser(profileDir, true);
  let page = context.pages()[0] || await context.newPage();
  await page.goto(BOARD_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise(r => setTimeout(r, 5000));

  if (await isLoggedIn(page)) {
    onLog?.('✅ [Dropshot] 로그인 세션 확인');
    cachedContext = context; cachedPage = page;
    return page;
  }

  // visible 로그인 유도
  onLog?.('🔐 [Dropshot] 로그인 필요 → 브라우저 표시 (최대 5분)');
  await context.close();
  context = await launchBrowser(profileDir, false);
  page = context.pages()[0] || await context.newPage();
  await page.goto('https://aistudio.dropshot.io', { waitUntil: 'domcontentloaded', timeout: 45000 });

  let loggedIn = false;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    try {
      const pages = context.pages();
      page = pages.find((p: any) => { try { return p.url().includes('dropshot.io'); } catch { return false; } })
        || pages[pages.length - 1];
      if (await isLoggedIn(page)) { loggedIn = true; break; }
    } catch { continue; }
    if (i % 6 === 5) onLog?.(`⏳ [Dropshot] 로그인 대기 (${Math.round((i+1)*5/60)}분 경과)`);
  }
  if (!loggedIn) { await context.close(); throw new Error('Dropshot 로그인 시간 초과'); }

  // visible 닫고 headless로 재진입
  await context.close();
  const hctx = await launchBrowser(profileDir, true);
  const hpage = hctx.pages()[0] || await hctx.newPage();
  await hpage.goto(BOARD_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise(r => setTimeout(r, 4000));

  cachedContext = hctx; cachedPage = hpage;
  onLog?.('✅ [Dropshot] 준비 완료');
  return hpage;
}

// ═══════════════════════════════════════════════════
// 🎯 PUBLIC API
// ═══════════════════════════════════════════════════

export interface DropshotResult {
  ok: boolean;
  dataUrl: string;
  error?: string;
}

/**
 * v3.6.4: Dropshot 로그인 상태 확인 (UI 자동화 부수 정보)
 *   - 캐시된 세션이 살아있는지 또는 새로 headless 진입해서 확인
 *   - 구독 정보까지 추출 (Pro 여부)
 */
export async function checkDropshotLogin(): Promise<{
  loggedIn: boolean;
  userId?: string;
  userName?: string;
  email?: string;
  subscription?: 'pro' | 'free' | 'unknown';
  message?: string;
}> {
  try {
    const profileDir = getProfileDir();
    // headless로 빠르게 확인 (cached page 우선)
    let context = cachedContext;
    let page = cachedPage;
    let openedFresh = false;
    if (!context || !page) {
      context = await launchBrowser(profileDir, true);
      page = context.pages()[0] || await context.newPage();
      openedFresh = true;
      try {
        await page.goto('https://aistudio.dropshot.io', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 4000));
      } catch (e: any) {
        if (openedFresh) { try { await context.close(); } catch {} }
        return { loggedIn: false, message: `navigate 실패: ${e.message}` };
      }
    }

    const info = await page.evaluate(async () => {
      try {
        // /v1/user/{externalId} 엔드포인트로 확인 — 사이트 UI가 정상 호출하면 200
        const cookies = document.cookie;
        const cognitoMatch = cookies.match(/CognitoIdentityServiceProvider\.[^.]+\.LastAuthUser=([^;]+)/);
        if (!cognitoMatch) return { loggedIn: false, message: 'Cognito 쿠키 없음 — 로그인 필요' };

        // 사이트의 fetch wrapper를 통해 자체 user info 조회 — page 내부에서 fetch (자동 인증)
        const res = await fetch('/api/me', { credentials: 'include' }).catch(() => null);
        if (res && res.ok) {
          const data = await res.json();
          return { loggedIn: true, userName: data?.name, email: data?.email, userId: data?.externalId, message: 'OK' };
        }
        // 대체: localStorage 또는 다른 source
        return { loggedIn: true, message: 'Cognito 세션 있음 (상세 조회는 사이트 내에서)' };
      } catch (e: any) {
        return { loggedIn: false, message: `evaluate err: ${e.message}` };
      }
    });

    // 구독 상태 — best-effort (API 호출 실패해도 loggedIn 정보는 살림)
    let subscription: 'pro' | 'free' | 'unknown' = 'unknown';
    try {
      const sub = await page.evaluate(async () => {
        const r = await fetch('https://api.aistudio.dropshot.io/v1/user/subscription?lang=ko', { credentials: 'include' });
        if (!r.ok) return null;
        return await r.json();
      });
      if (sub && typeof sub === 'object') {
        const planType = String((sub as any)?.current?.plan || (sub as any)?.plan || '').toLowerCase();
        if (planType === 'pro' || planType.includes('pro')) subscription = 'pro';
        else if (planType === 'free' || planType === 'basic') subscription = 'free';
      }
    } catch { /* subscription 정보 못 가져와도 loggedIn 정보는 유효 */ }

    if (openedFresh) {
      // 캐시 안 했으면 닫기 (별도 ensurePage가 나중에 다시 띄움)
      try { await context.close(); } catch {}
    }

    return { ...info, subscription };
  } catch (e: any) {
    return { loggedIn: false, message: `예외: ${e.message || e}` };
  }
}

/**
 * v3.6.4: Dropshot visible 로그인 (사용자가 직접 로그인하는 흐름 명시적으로 trigger)
 *   - 환경설정의 "Dropshot 로그인" 버튼에서 호출
 *   - visible 브라우저 열고 5분 대기 → 사용자 로그인 완료 시 자동 close
 */
export async function loginDropshot(): Promise<{
  loggedIn: boolean;
  userName?: string;
  message?: string;
}> {
  try {
    const profileDir = getProfileDir();
    // 기존 cached 닫기 (visible 새로 띄움)
    if (cachedContext) { try { await cachedContext.close(); } catch {} cachedContext = null; cachedPage = null; }

    const context = await launchBrowser(profileDir, false);
    const page = context.pages()[0] || await context.newPage();
    await page.goto('https://aistudio.dropshot.io', { waitUntil: 'domcontentloaded', timeout: 45000 });

    let loggedIn = false;
    let userName: string | undefined;
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 5000));
      try {
        const pages = context.pages();
        const p = pages.find((pg: any) => { try { return pg.url().includes('dropshot.io'); } catch { return false; } }) || pages[pages.length - 1];
        const ok = await isLoggedIn(p);
        if (ok) {
          loggedIn = true;
          try {
            const u = await p.evaluate(async () => {
              const r = await fetch('/api/me', { credentials: 'include' });
              return r.ok ? await r.json() : null;
            });
            userName = u?.name || u?.email;
          } catch {}
          break;
        }
      } catch { continue; }
    }
    try { await context.close(); } catch {}
    if (loggedIn) {
      return userName
        ? { loggedIn: true, userName, message: '로그인 완료' }
        : { loggedIn: true, message: '로그인 완료' };
    }
    return { loggedIn: false, message: '5분 내 로그인 미완료' };
  } catch (e: any) {
    return { loggedIn: false, message: `예외: ${e.message || e}` };
  }
}

/**
 * URL 이미지를 buffer로 다운로드 → setInputFiles용 file 객체로 변환.
 * dropshot UI의 reference 업로드 input은 일반 file input이므로 setInputFiles가 동작한다.
 */
async function downloadAsFileBuffer(url: string): Promise<{ name: string; mimeType: string; buffer: Buffer } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = (res.headers.get('content-type') || 'image/jpeg').split(';')[0]?.trim() ?? 'image/jpeg';
    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
    return { name: `ref-${Date.now()}.${ext}`, mimeType: ct, buffer: buf };
  } catch (e) {
    console.warn('[Dropshot] reference 다운로드 실패:', (e as any)?.message);
    return null;
  }
}

export async function makeDropshotImage(
  prompt: string,
  options: {
    aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
    /**
     * v3.6.0: 이미지-투-이미지(reference) 지원.
     * 빈 배열/미설정 = 텍스트→이미지, URL 배열 = i2i (최대 4장 권장).
     * 각 URL을 다운로드해서 dropshot UI의 reference 업로드 input에 setInputFiles로 주입.
     */
    referenceImageList?: string[];
  } = {},
  onLog?: (m: string) => void,
): Promise<DropshotResult> {
  const MAX_RETRIES = 3;
  let currentPrompt = prompt;
  let lastError: string | null = null;

  try {
    const page = await ensurePage(onLog);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      onLog?.(`🍌 [Dropshot] 이미지 생성 중... (시도 ${attempt}/${MAX_RETRIES})`);

      // v3.6.9: 한국어 짧은 prompt 자동 enhance (한국어 그대로 + 한국어 enhancer)
      //   nano-banana-pro는 multilingual이라 한국어를 잘 처리.
      //   짧으면 컨텍스트 부족 → 한국어로 시각적 디테일 자동 추가.
      const hasKorean = /[가-힯]/.test(currentPrompt);
      const isShort = currentPrompt.length < 50;
      const enhancedPrompt = (hasKorean && isShort)
        ? `${currentPrompt} — 본 주제를 직관적으로 표현하는 사실적 사진, 한국적 배경, 자연광, 시네마틱 4K, 텍스트 없음`
        : currentPrompt;

      // 매 호출마다 unique variation hint (한국어 + 영어 mixed, 강한 다양성 강제)
      const nonce = Math.random().toString(36).slice(2, 8);
      const variationSeed = Date.now().toString(36);
      const promptWithVariation = enhancedPrompt
        + ` (버전-${variationSeed}-${nonce}: 매번 완전히 다른 구도, 다른 시점, 다른 인물/배경/소품 — 이전 결과와 절대 같으면 안 됨)`;

      try {
        // 1. board URL 재확인
        if (!page.url().includes('panel=image')) {
          await page.goto(BOARD_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await new Promise(r => setTimeout(r, 3000));
        }

        // v3.7.1: 무제한 모드 토글 ON + 카운터 1로 자동 설정 (매 호출마다 idempotent)
        await ensureDropshotControls(page, onLog);

        // 2. 호출 전 DOM의 result 이미지 snapshot (이전 이미지 반복 캡처 방지)
        const beforeSrcs: string[] = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('img'))
            .map(i => i.src || '')
            .filter(s => (s.startsWith('data:image/') || s.includes('cdn.aistudio.dropshot.io')) && !s.includes('/icons/') && !s.includes('/sample/'));
        });

        // v3.6.0: reference 이미지가 있으면 i2i 모드 — 업로드 input에 setInputFiles로 주입
        const refList = (options.referenceImageList || []).slice(0, 4);
        if (refList.length > 0) {
          onLog?.(`📎 [Dropshot] reference ${refList.length}장 업로드 중...`);
          const buffers: Array<{ name: string; mimeType: string; buffer: Buffer }> = [];
          for (const url of refList) {
            const f = await downloadAsFileBuffer(url);
            if (f) buffers.push(f);
          }
          if (buffers.length > 0) {
            // dropshot UI의 reference 업로드 input 찾기 — image-only + multiple input 우선
            //   selector 우선순위:
            //     1) data-dropzone-accept="image" + multiple — 다중 reference 슬롯
            //     2) data-sentry-component="UploadImage" 내부 input
            //     3) 첫 번째 image-accept file input
            const fileInput = await page.$(
              'input[type="file"][data-dropzone-accept="image"][multiple], ' +
              '[data-sentry-component="UploadedImage"] input[type="file"], ' +
              'input[type="file"][accept*="image"]'
            );
            if (fileInput) {
              try {
                await fileInput.setInputFiles(buffers);
                onLog?.(`✅ [Dropshot] reference ${buffers.length}장 업로드 완료`);
                await new Promise(r => setTimeout(r, 2500)); // upload 완료 대기
              } catch (e: any) {
                onLog?.(`⚠️ [Dropshot] reference 업로드 실패: ${e.message?.slice(0, 100)}`);
              }
            } else {
              onLog?.(`⚠️ [Dropshot] reference 업로드 input 못 찾음 (UI 변경?) — 텍스트→이미지로 폴백`);
            }
          }
        }

        // 3. 프롬프트 입력 (variation hint 포함)
        await page.waitForSelector(PROMPT_SELECTOR, { timeout: 10000 });
        await page.click(PROMPT_SELECTOR);
        await page.fill(PROMPT_SELECTOR, promptWithVariation);
        await new Promise(r => setTimeout(r, 1000));

        // 4. 생성 버튼 클릭 — parent absolute button
        const clicked = await page.evaluate(() => {
          const ta = document.querySelector('textarea[placeholder="어떤 장면을 만들고 싶나요?"]') as HTMLTextAreaElement | null;
          if (!ta) return false;
          let parent = ta.parentElement;
          for (let depth = 0; depth < 5 && parent; depth++) {
            const btn = parent.querySelector('button.absolute') as HTMLButtonElement | null;
            if (btn && !btn.disabled) { btn.click(); return true; }
            parent = parent.parentElement;
          }
          return false;
        });
        if (!clicked) {
          await page.keyboard.press('Enter');
        }

        // 5. 결과 이미지 대기 — snapshot에 없던 NEW 이미지만 잡음 (최대 90초)
        const startTs = Date.now();
        let foundDataUrl: string | null = null;
        while ((Date.now() - startTs) < 90_000) {
          await new Promise(r => setTimeout(r, 2000));
          const dataUrl = await page.evaluate((before: string[]) => {
            const beforeSet = new Set(before);
            const imgs = Array.from(document.querySelectorAll('img'));
            const result = imgs.find(i => {
              const src = i.src || '';
              return src.startsWith('data:image/') && i.naturalWidth > 200 && !src.includes('icons/') && !beforeSet.has(src);
            });
            return result ? result.src : null;
          }, beforeSrcs);
          if (dataUrl) { foundDataUrl = dataUrl; break; }

          // 또는 cdn.aistudio.dropshot.io의 NEW result 이미지
          const cdnUrl: string | null = await page.evaluate((before: string[]) => {
            const beforeSet = new Set(before);
            const imgs = Array.from(document.querySelectorAll('img'));
            const result = imgs.find(i => {
              const src = i.src || '';
              return src.includes('cdn.aistudio.dropshot.io') && !src.includes('/icons/') && !src.includes('/sample/') && i.naturalWidth > 200 && !beforeSet.has(src);
            });
            return result ? result.src : null;
          }, beforeSrcs);
          if (cdnUrl) {
            // CDN URL을 dataUrl로 변환
            const buf = await page.evaluate(async (url: string) => {
              const r = await fetch(url);
              const blob = await r.blob();
              return await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error('blob read failed'));
                reader.readAsDataURL(blob);
              });
            }, cdnUrl);
            foundDataUrl = buf;
            break;
          }
        }

        if (foundDataUrl) {
          onLog?.('✅ [Dropshot] 이미지 생성 완료');
          return { ok: true, dataUrl: foundDataUrl };
        }

        lastError = '90초 내 결과 이미지 미발견';
        onLog?.(`⚠️ [Dropshot] ${lastError} (시도 ${attempt})`);
      } catch (e: any) {
        lastError = e.message || String(e);
        onLog?.(`❌ [Dropshot] 시도 ${attempt} 실패: ${lastError}`);
        if (lastError && (lastError.includes('Target closed') || lastError.includes('WebSocket'))) {
          cachedPage = null; cachedContext = null;
        }
      }
    }
    return { ok: false, dataUrl: '', error: lastError || 'unknown' };
  } catch (e: any) {
    return { ok: false, dataUrl: '', error: e.message || String(e) };
  }
}
