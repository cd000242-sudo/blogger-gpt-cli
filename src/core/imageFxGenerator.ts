/**
 * 🖼️ ImageFX 이미지 생성 엔진
 * 
 * Google ImageFX API (labs.google/fx) 기반 무료 이미지 생성.
 * - IMAGEN 3.5 모델 사용
 * - API Key 불필요 — Google 계정 세션 기반
 * - Playwright persistent context로 로그인 세션 유지
 * - 시스템 Chrome → Edge → Playwright Chromium 폴백
 * 
 * 이 앱(blogger-gpt-cli)의 아키텍처에 맞게 구현:
 * - `{ok, dataUrl, error}` 리턴 형식 (thumbnail.ts 패턴)
 * - loadEnvFromFile()로 설정 로드
 * - onLog 콜백으로 진행 상태 전송
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

// ── 캐시 (모듈 레벨 싱글턴) ──
let cachedContext: any = null;
let cachedPage: any = null;
let cachedToken: string | null = null;
let cachedTokenExpiry: Date | null = null;

// ── 동시 접근 방지 lock (병렬 호출 시 브라우저 중복 생성 방지) ──
let _ensurePagePromise: Promise<any> | null = null;

// ── 프로필 디렉토리 ──
function getProfileDir(): string {
  const dir = path.join(os.homedir(), '.blogger-gpt', 'imagefx-profile');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// ── Aspect Ratio 매핑 ──
function toFxAspectRatio(ratio: string): string {
  const map: Record<string, string> = {
    '1:1':  'IMAGE_ASPECT_RATIO_SQUARE',
    '16:9': 'IMAGE_ASPECT_RATIO_LANDSCAPE',
    '9:16': 'IMAGE_ASPECT_RATIO_PORTRAIT',
    '4:3':  'IMAGE_ASPECT_RATIO_LANDSCAPE_4_3',
    '3:4':  'IMAGE_ASPECT_RATIO_PORTRAIT_3_4',
  };
  return map[ratio] || 'IMAGE_ASPECT_RATIO_LANDSCAPE';
}

// ── 안전 필터 프롬프트 순화 ──
function sanitizePrompt(prompt: string): string {
  return prompt
    .replace(/\b(blood|gore|violence|weapon|knife|gun|drug|nude|naked|sexy|kill|murder|dead|death|war|fight|attack|bomb|terror|horror|scary|creepy|disturb)\b/gi, '')
    .replace(/[^\w\s가-힣.,!?'"()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 시스템 브라우저 폴백 전략으로 persistent context 생성
 * Chrome → Edge → Playwright Chromium 순서
 */
async function launchBrowser(profileDir: string, headless: boolean): Promise<any> {
  const { chromium } = await import('playwright') as any;
  
  const baseOptions = {
    headless,
    args: [
      '--no-first-run',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
    ],
    viewport: { width: 1280, height: 800 },
    ignoreDefaultArgs: ['--enable-automation'],
  };

  // 1. 시스템 Chrome
  try {
    const ctx = await chromium.launchPersistentContext(profileDir, { ...baseOptions, channel: 'chrome' });
    console.log('[ImageFX] ✅ 시스템 Chrome 사용');
    return ctx;
  } catch { /* Chrome 없음 */ }

  // 2. 시스템 Edge (Windows 기본)
  try {
    const ctx = await chromium.launchPersistentContext(profileDir, { ...baseOptions, channel: 'msedge' });
    console.log('[ImageFX] ✅ 시스템 Edge 사용');
    return ctx;
  } catch { /* Edge 없음 */ }

  // 3. Playwright 내장 Chromium
  try {
    const ctx = await chromium.launchPersistentContext(profileDir, baseOptions);
    console.log('[ImageFX] ✅ Playwright Chromium 사용');
    return ctx;
  } catch (err: any) {
    throw new Error(`브라우저를 실행할 수 없습니다. Chrome 또는 Edge를 설치해주세요. (${err.message?.substring(0, 80)})`);
  }
}

/**
 * labs.google/fx 세션 토큰 가져오기
 */
async function getSessionToken(page: any): Promise<{ token: string; userName?: string } | null> {
  try {
    const session = await page.evaluate(async () => {
      try {
        const res = await fetch('/fx/api/auth/session', { credentials: 'include' });
        if (!res.ok) return null;
        const data = await res.json();
        return data.access_token ? data : null;
      } catch { return null; }
    });

    if (session?.access_token) {
      return {
        token: session.access_token,
        userName: session.user?.name || session.user?.email,
      };
    }
  } catch { /* 무시 */ }
  return null;
}

/**
 * 브라우저 페이지 확보 (캐시 재사용 + 자동 로그인)
 * 병렬 호출 시 mutex로 보호 — 첫 호출만 브라우저 생성, 나머지는 대기
 *
 * 🌊 Flow 이식 시 export: flowGenerator.ts가 동일 labs.google 세션을 공유하기 위해 이 함수를 직접 호출.
 * Google OAuth 쿠키는 labs.google 도메인 전체에 유효하므로 /fx/와 /flow/ 모두 같은 페이지에서 접근 가능.
 */
export async function ensurePage(onLog?: (msg: string) => void): Promise<any> {
  // 🔒 다른 호출이 초기화 중이면 완료 대기
  if (_ensurePagePromise) {
    console.log('[ImageFX] ⏳ 다른 초기화 진행 중 — 대기...');
    await _ensurePagePromise;
    // 대기 후 캐시가 있으면 바로 반환
    if (cachedPage && cachedContext) {
      try {
        await cachedPage.evaluate(() => document.readyState);
        return cachedPage;
      } catch { /* 캐시 무효 → 아래에서 재초기화 */ }
    }
  }

  // 🔒 lock 설정
  let lockResolve: () => void;
  _ensurePagePromise = new Promise<void>(r => { lockResolve = r; });

  try {
    const page = await _ensurePageInternal(onLog);
    return page;
  } finally {
    // 🔓 lock 해제
    _ensurePagePromise = null;
    lockResolve!();
  }
}

/** 실제 브라우저 초기화 (lock 내부에서만 호출) */
async function _ensurePageInternal(onLog?: (msg: string) => void): Promise<any> {
  // 1. 캐시된 페이지가 살아있으면 재사용
  if (cachedPage && cachedContext) {
    try {
      await cachedPage.evaluate(() => document.readyState);
      // labs.google에 있는지 확인
      const url = cachedPage.url();
      if (!url.includes('labs.google/fx')) {
        await cachedPage.goto('https://labs.google/fx/tools/image-fx', { waitUntil: 'networkidle', timeout: 30000 });
        await new Promise(r => setTimeout(r, 1500));
      }
      return cachedPage;
    } catch {
      console.log('[ImageFX] ⚠️ 캐시된 페이지 연결 끊김 → 재연결');
      cachedPage = null;
      cachedContext = null;
      cachedToken = null;
    }
  }

  const profileDir = getProfileDir();

  // 2. headless로 먼저 시도 (세션 확인)
  onLog?.('🌐 [ImageFX] 브라우저 준비 중...');
  let context = await launchBrowser(profileDir, true);
  let page = context.pages()[0] || await context.newPage();

  await page.goto('https://labs.google/fx/tools/image-fx', { waitUntil: 'networkidle', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));

  const session = await getSessionToken(page);
  if (session) {
    // 이미 로그인됨 → headless 유지
    console.log(`[ImageFX] ✅ Google 로그인 확인: ${session.userName || 'user'} (숨김 모드)`);
    onLog?.(`✅ [ImageFX] Google 로그인 확인: ${session.userName || 'user'}`);
    
    cachedContext = context;
    cachedPage = page;
    cachedToken = session.token;
    cachedTokenExpiry = new Date(Date.now() + 50 * 60 * 1000);
    return page;
  }

  // 3. 로그인 필요 → visible로 재실행
  console.log('[ImageFX] 🔐 Google 로그인 필요 → 브라우저 표시');
  onLog?.('🔐 [ImageFX] Google 로그인이 필요합니다. 브라우저가 열립니다...');
  await context.close();

  context = await launchBrowser(profileDir, false);
  page = context.pages()[0] || await context.newPage();
  await page.goto('https://labs.google/fx/tools/image-fx', { waitUntil: 'networkidle', timeout: 30000 });

  onLog?.('🔐 [ImageFX] 브라우저에서 Google 계정으로 로그인해주세요. (최대 5분 대기)');

  // 5초 간격, 최대 5분 대기
  let loggedIn = false;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));

    try {
      // labs.google 도메인 페이지 우선 선택
      const pages = context.pages();
      if (pages.length > 0) {
        const fxPage = pages.find((p: any) => {
          try { return p.url().includes('labs.google'); } catch { return false; }
        });
        page = fxPage || pages[pages.length - 1];
      }

      const check = await getSessionToken(page);
      if (check) {
        loggedIn = true;
        console.log(`[ImageFX] ✅ Google 로그인 성공: ${check.userName || 'user'}`);
        onLog?.(`✅ [ImageFX] Google 로그인 완료: ${check.userName || 'user'}`);
        cachedToken = check.token;
        cachedTokenExpiry = new Date(Date.now() + 50 * 60 * 1000);
        break;
      }
    } catch {
      // context 파괴 시 다음 루프에서 재시도
      continue;
    }

    if (i % 6 === 5) {
      onLog?.(`⏳ [ImageFX] Google 로그인 대기 중... (${Math.round((i + 1) * 5 / 60)}분 경과)`);
    }
  }

  if (!loggedIn) {
    await context.close();
    throw new Error('Google 로그인 시간 초과 (5분). ImageFX 사용 전 Google 계정으로 로그인해주세요.');
  }

  // 4. 로그인 성공 → visible 닫고 headless로 전환 (화면에서 숨김)
  onLog?.('🔄 [ImageFX] 로그인 완료! 숨김 모드로 전환 중...');
  await context.close();

  const headlessCtx = await launchBrowser(profileDir, true);
  const headlessPage = headlessCtx.pages()[0] || await headlessCtx.newPage();
  await headlessPage.goto('https://labs.google/fx/tools/image-fx', { waitUntil: 'networkidle', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));

  cachedContext = headlessCtx;
  cachedPage = headlessPage;
  onLog?.('✅ [ImageFX] 이미지 생성 준비 완료 (숨김 모드)');

  return headlessPage;
}

/**
 * 세션 토큰 (캐시 + 갱신)
 */
async function getToken(page: any, onLog?: (msg: string) => void): Promise<string> {
  // 캐시된 토큰이 유효하면 반환
  if (cachedToken && cachedTokenExpiry && cachedTokenExpiry > new Date()) {
    return cachedToken;
  }

  // 페이지에서 토큰 가져오기
  const url = page.url();
  if (!url.includes('labs.google/fx')) {
    await page.goto('https://labs.google/fx/tools/image-fx', { waitUntil: 'networkidle', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));
  }

  const session = await getSessionToken(page);
  if (!session) {
    throw new Error('Google 세션 만료. ImageFX 사용 전 Google 계정으로 다시 로그인해주세요.');
  }

  cachedToken = session.token;
  cachedTokenExpiry = new Date(Date.now() + 50 * 60 * 1000);
  return session.token;
}

// ═══════════════════════════════════════════════════
// 🎯 PUBLIC API
// ═══════════════════════════════════════════════════

export interface ImageFxResult {
  ok: boolean;
  dataUrl: string;
  error?: string;
}

/**
 * ImageFX로 이미지 생성
 * 
 * @param prompt - 이미지 생성 프롬프트 (한국어/영어)
 * @param options - 옵션
 * @param onLog - 진행 로그 콜백
 * @returns `{ok, dataUrl, error}` — thumbnail.ts 패턴과 동일
 * 
 * @example
 * const result = await makeImageFxImage('A cozy Korean cafe', { aspectRatio: '16:9' });
 * if (result.ok) console.log('Image:', result.dataUrl);
 */
export async function makeImageFxImage(
  prompt: string,
  options: {
    aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
    isThumbnail?: boolean;
  } = {},
  onLog?: (msg: string) => void,
): Promise<ImageFxResult> {
  const MAX_RETRIES = 3;
  const fxAspectRatio = toFxAspectRatio(options.aspectRatio || '16:9');
  let currentPrompt = prompt;
  let lastError: Error | null = null;

  try {
    // 브라우저 페이지 확보
    const page = await ensurePage(onLog);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // 토큰 획득/갱신
        const token = await getToken(page, onLog);
        onLog?.(`🖼️ [ImageFX] 이미지 생성 중... (시도 ${attempt}/${MAX_RETRIES})`);

        // API 호출 (page.evaluate로 브라우저 컨텍스트에서 실행)
        const genResult = await page.evaluate(
          async (params: { token: string; prompt: string; ratio: string; seed: number }) => {
            try {
              const body = JSON.stringify({
                userInput: {
                  candidatesCount: 1,
                  prompts: [params.prompt],
                  seed: params.seed,
                },
                clientContext: {
                  sessionId: `;${Date.now()}`,
                  tool: 'IMAGE_FX',
                },
                modelInput: {
                  modelNameType: 'IMAGEN_3_5',
                },
                aspectRatio: params.ratio,
              });

              const res = await fetch('https://aisandbox-pa.googleapis.com/v1:runImageFx', {
                method: 'POST',
                body,
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${params.token}`,
                },
              });

              if (!res.ok) {
                const text = await res.text();
                return { error: `HTTP_${res.status}`, detail: text.substring(0, 500) };
              }

              const data = await res.json();
              const images = data?.imagePanels?.[0]?.generatedImages;
              if (images && images.length > 0 && images[0].encodedImage) {
                return {
                  success: true,
                  encodedImage: images[0].encodedImage,
                };
              }
              return { error: 'NO_IMAGES', detail: JSON.stringify(data).substring(0, 500) };
            } catch (err: any) {
              return { error: 'EXCEPTION', detail: err.message };
            }
          },
          {
            token,
            prompt: currentPrompt,
            ratio: fxAspectRatio,
            seed: Math.floor(Math.random() * 999999),
          },
        );

        // 성공
        if (genResult.success && genResult.encodedImage) {
          const buffer = Buffer.from(genResult.encodedImage, 'base64');
          console.log(`[ImageFX] ✅ 이미지 생성 성공 (${Math.round(buffer.length / 1024)}KB, 시도 ${attempt})`);
          onLog?.(`✅ [ImageFX] 이미지 생성 완료 (${Math.round(buffer.length / 1024)}KB)`);

          // MIME type 감지
          const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8;
          const isWebP = buffer[0] === 0x52 && buffer[1] === 0x49;
          const mime = isJPEG ? 'image/jpeg' : isWebP ? 'image/webp' : 'image/png';

          return {
            ok: true,
            dataUrl: `data:${mime};base64,${genResult.encodedImage}`,
          };
        }

        // 에러 처리
        const errorCode = genResult.error || 'UNKNOWN';
        const errorDetail = genResult.detail || '';

        // 토큰 만료 (401) → 갱신
        if (errorCode === 'HTTP_401') {
          console.warn('[ImageFX] 🔑 토큰 만료 → 갱신 시도');
          onLog?.('🔑 [ImageFX] 토큰 갱신 중...');
          cachedToken = null;
          cachedTokenExpiry = null;
          continue;
        }

        // 안전 필터 차단 → 프롬프트 순화
        if (errorDetail.includes('safety') || errorDetail.includes('blocked') || errorDetail.includes('policy')) {
          console.warn(`[ImageFX] 🛡️ 안전 필터 차단 (시도 ${attempt}) → 프롬프트 순화`);
          onLog?.('🛡️ [ImageFX] 안전 필터 — 프롬프트 조정 중...');
          currentPrompt = sanitizePrompt(currentPrompt);
          continue;
        }

        // 서버 과부하 (503) → 대기
        if (errorCode === 'HTTP_503') {
          const waitSec = 5 * attempt;
          console.warn(`[ImageFX] ⏳ 서버 과부하 → ${waitSec}초 대기`);
          onLog?.(`⏳ [ImageFX] 서버 과부하 — ${waitSec}초 대기 중...`);
          await new Promise(r => setTimeout(r, waitSec * 1000));
          continue;
        }

        // 기타 에러
        console.error(`[ImageFX] ❌ 생성 실패 (시도 ${attempt}/${MAX_RETRIES}): ${errorCode}`);
        lastError = new Error(`${errorCode}: ${errorDetail.substring(0, 200)}`);

        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 3000));
        }
      } catch (error: any) {
        lastError = error;
        console.error(`[ImageFX] ❌ 예외 (시도 ${attempt}/${MAX_RETRIES}): ${error.message}`);

        // 연결 문제 → 캐시 초기화
        if (error.message?.includes('연결') || error.message?.includes('WebSocket') || error.message?.includes('Target closed')) {
          cachedPage = null;
          cachedContext = null;
          cachedToken = null;
        }

        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    }

    console.error('[ImageFX] ❌ 모든 재시도 실패:', lastError?.message);
    return { ok: false, dataUrl: '', error: lastError?.message || 'ImageFX 이미지 생성 실패' };
  } catch (err: any) {
    console.error('[ImageFX] ❌ 초기화 실패:', err.message);
    return { ok: false, dataUrl: '', error: err.message || 'ImageFX 초기화 실패' };
  }
}

/**
 * ImageFX 브라우저 세션 정리
 */
export async function cleanupImageFx(): Promise<void> {
  try {
    if (cachedContext) {
      await cachedContext.close();
      console.log('[ImageFX] 🧹 브라우저 세션 정리 완료');
    }
  } catch { /* 무시 */ }
  cachedContext = null;
  cachedPage = null;
  cachedToken = null;
  cachedTokenExpiry = null;
}

/**
 * Google 로그인 상태 사전 확인 (UI에서 호출)
 * 
 * - 캐시 토큰 유효 → 즉시 통과
 * - 세션 확인 → 로그인됨/미로그인 반환
 * - 미로그인 시 visible 브라우저 열지 않음 (확인만)
 */
export async function checkGoogleLoginForImageFx(): Promise<{
  loggedIn: boolean;
  userName?: string | undefined;
  message: string;
}> {
  try {
    console.log('[ImageFX] 🔍 Google 로그인 사전 확인 시작...');

    // 1. 캐시된 토큰이 유효하면 즉시 통과
    if (cachedToken && cachedTokenExpiry && cachedTokenExpiry > new Date()) {
      console.log('[ImageFX] ✅ 캐시된 토큰 유효 → 로그인 확인 스킵');
      return { loggedIn: true, message: 'Google 로그인 확인 (캐시됨)' };
    }

    // 2. 캐시된 페이지가 살아있으면 세션만 확인
    if (cachedPage && cachedContext) {
      try {
        await cachedPage.evaluate(() => document.readyState);
        const url = cachedPage.url();
        if (!url.includes('labs.google/fx')) {
          await cachedPage.goto('https://labs.google/fx/tools/image-fx', { waitUntil: 'networkidle', timeout: 30000 });
          await new Promise(r => setTimeout(r, 1500));
        }
        const session = await getSessionToken(cachedPage);
        if (session) {
          cachedToken = session.token;
          cachedTokenExpiry = new Date(Date.now() + 50 * 60 * 1000);
          console.log(`[ImageFX] ✅ Google 로그인 확인: ${session.userName || 'user'}`);
          return { loggedIn: true, userName: session.userName || undefined, message: `Google 로그인 완료: ${session.userName || 'user'}` };
        }
        return { loggedIn: false, message: 'Google 로그인이 필요합니다.' };
      } catch {
        cachedPage = null;
        cachedContext = null;
        cachedToken = null;
      }
    }

    // 3. 새 headless 브라우저로 세션 확인
    const profileDir = getProfileDir();
    let tempContext: any = null;
    try {
      tempContext = await launchBrowser(profileDir, true);
      const page = tempContext.pages()[0] || await tempContext.newPage();
      await page.goto('https://labs.google/fx/tools/image-fx', { waitUntil: 'networkidle', timeout: 30000 });
      await new Promise(r => setTimeout(r, 1500));

      const session = await getSessionToken(page);
      if (session) {
        // 로그인됨 → 캐시
        cachedContext = tempContext;
        cachedPage = page;
        cachedToken = session.token;
        cachedTokenExpiry = new Date(Date.now() + 50 * 60 * 1000);
        console.log(`[ImageFX] ✅ Google 로그인 확인: ${session.userName || 'user'}`);
        return { loggedIn: true, userName: session.userName || undefined, message: `Google 로그인 완료: ${session.userName || 'user'}` };
      }

      // 미로그인 → 임시 브라우저 닫기
      await tempContext.close();
      return { loggedIn: false, message: 'Google 로그인이 필요합니다. "Google 로그인" 버튼을 눌러주세요.' };
    } catch (err: any) {
      if (tempContext) { try { await tempContext.close(); } catch {} }
      return { loggedIn: false, message: `로그인 확인 실패: ${err.message?.substring(0, 80)}` };
    }
  } catch (err: any) {
    return { loggedIn: false, message: `로그인 확인 오류: ${err.message?.substring(0, 80)}` };
  }
}

/**
 * Google 로그인 실행 (UI에서 호출 — 브라우저 열어서 로그인 유도)
 * 
 * 1. visible 브라우저 열기
 * 2. labs.google/fx 로 이동
 * 3. 사용자가 Google 계정으로 로그인할 때까지 5분 대기
 * 4. 로그인 성공 → headless 전환 + 캐시
 */
export async function loginGoogleForImageFx(): Promise<{
  loggedIn: boolean;
  userName?: string | undefined;
  message: string;
}> {
  try {
    console.log('[ImageFX] 🔐 Google 로그인 시작 (visible 모드)...');

    // 먼저 이미 로그인되어 있는지 확인
    const preCheck = await checkGoogleLoginForImageFx();
    if (preCheck.loggedIn) {
      return preCheck;
    }

    // 기존 세션 정리
    if (cachedContext) {
      try { await cachedContext.close(); } catch {}
      cachedContext = null;
      cachedPage = null;
      cachedToken = null;
    }

    const profileDir = getProfileDir();

    // visible 브라우저 열기
    const context = await launchBrowser(profileDir, false);
    const page = context.pages()[0] || await context.newPage();
    await page.goto('https://labs.google/fx/tools/image-fx', { waitUntil: 'networkidle', timeout: 30000 });

    // 5초 간격, 최대 5분 대기
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 5000));

      try {
        const pages = context.pages();
        const fxPage = pages.find((p: any) => {
          try { return p.url().includes('labs.google'); } catch { return false; }
        });
        const checkPage = fxPage || pages[pages.length - 1];

        const session = await getSessionToken(checkPage);
        if (session) {
          console.log(`[ImageFX] ✅ Google 로그인 성공: ${session.userName || 'user'}`);

          // visible 닫고 headless로 전환
          await context.close();
          const headlessCtx = await launchBrowser(profileDir, true);
          const headlessPage = headlessCtx.pages()[0] || await headlessCtx.newPage();
          await headlessPage.goto('https://labs.google/fx/tools/image-fx', { waitUntil: 'networkidle', timeout: 30000 });
          await new Promise(r => setTimeout(r, 1500));

          cachedContext = headlessCtx;
          cachedPage = headlessPage;
          cachedToken = session.token;
          cachedTokenExpiry = new Date(Date.now() + 50 * 60 * 1000);

          return {
            loggedIn: true,
            userName: session.userName,
            message: `Google 로그인 완료: ${session.userName || 'user'}`,
          };
        }
      } catch {
        continue;
      }
    }

    // 타임아웃
    try { await context.close(); } catch {}
    return { loggedIn: false, message: 'Google 로그인 시간 초과 (5분). 다시 시도해주세요.' };
  } catch (err: any) {
    return { loggedIn: false, message: `Google 로그인 실패: ${err.message?.substring(0, 80)}` };
  }
}
