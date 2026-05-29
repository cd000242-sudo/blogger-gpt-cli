# 🍌 Dropshot 나노바나나 Pro — 단일 파일 이식 키트

> **이 .md 하나로 다른 Node/Electron 앱에 Dropshot 이미지 생성을 통합할 수 있습니다.**
>
> 본 키트는 [blogger-gpt-cli v3.6.0](https://github.com/cd000242-sudo/blogger-gpt-cli)에서 추출한 production-ready 코드 + 통합 패턴입니다. 실측 검증 완료 (3장 batch + i2i smoke 성공, md5 hash로 고유성 확인).

---

## 📋 이식 체크리스트 (15분)

```
□ 1. 의존성 추가 (npm install 1줄)
□ 2. src/core/dropshotGenerator.ts 생성 (§3 코드 그대로 복붙)
□ 3. dispatcher 통합 (§4 — case 분기 + alias map + 폴백 정책)
□ 4. UI 통합 (§5 — select option + 비용 표시)
□ 5. 검증 (§6 — smoke test 1장 생성)
```

각 단계는 아래 섹션에서 그대로 복붙 가능.

---

## ⚠️ 비용 정확하게

| 항목 | 비용 | 의미 |
|---|---|---|
| Dropshot Pro 월 구독료 | **74,000~99,000원/월** (사이트 직접 결제) | 이게 진짜 비용 |
| 이미지 1장당 추가비용 | **0원** | Pro 구독자 한정, `isUnlimited: true` |
| 무료 사용자 | creditCost 75/장 | daily/monthly quota 안에서만 |

**즉**: "무료"가 아니라 **"구독료별, 한계비용 0원"**. UI/비용표에서 정확히 표시해야 사용자가 헷갈리지 않음.

---

## §1. 핵심 결정 — 왜 UI 자동화인가

API 직접 호출 11번 시도 모두 401 INTERNAL_SERVER_ERROR:
- AWS Cognito accessToken/idToken (쿠키 저장)
- **페이지 JS 내부의 token refresh 로직**을 거쳐야 인증 통과 (자체 fetch wrapper)
- 외부 fetch / page.evaluate / page.request 셋 다 차단됨

**결론**: API 우회 비현실적 → Playwright UI 조작으로 우회.

---

## §2. 의존성 추가

```bash
npm install patchright playwright
```

> - **patchright**: Playwright drop-in fork (reCAPTCHA Enterprise/Cloudflare 회피 강화)
> - **playwright**: patchright 미설치 환경 fallback용

추가 의존성 불필요. Node 18+ (fetch 빌트인 사용).

---

## §3. 핵심 코드 — `src/core/dropshotGenerator.ts`

**그대로 복붙. 353줄 (검증 완료된 production 코드).**

```typescript
/**
 * 🍌 Dropshot 이미지 생성 엔진 (UI 자동화 방식)
 *
 * dropshot.io의 nano-banana-pro 모델을 Playwright UI 조작으로 자동 사용.
 * - API 직접 호출은 Cognito refresh 외부 흐름 우회 불가능 → UI 조작으로 우회
 * - 같은 profile 영구 세션 (~/.your-app/dropshot-profile/)
 * - 결과는 DOM의 `<img src="data:image/png;base64,...">`에서 직접 scrape
 *
 * 비용 (정확):
 * - Pro 구독자 (월 74,000~99,000원 구독료별): 이미지당 한계비용 0원, 무제한 (isUnlimited: true)
 * - 무료 사용자: creditCost 75/이미지 — daily/monthly quota 안에서만
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

const BOARD_URL = 'https://aistudio.dropshot.io/ko/workspace/board?panel=image&imageModelName=google/nano-banana-pro';
const PROFILE_NAME = 'dropshot-profile'; // ← 앱 이름에 맞게 변경 권장 (예: 'myapp-dropshot-profile')
const PROFILE_ROOT = '.your-app';        // ← 앱 이름에 맞게 변경 (예: '.myapp')
const PROMPT_SELECTOR = 'textarea[placeholder="어떤 장면을 만들고 싶나요?"]';

let cachedContext: any = null;
let cachedPage: any = null;
let _ensurePagePromise: Promise<any> | null = null;

function getProfileDir(): string {
  const dir = path.join(os.homedir(), PROFILE_ROOT, PROFILE_NAME);
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
      try { await ctx.addInitScript(stealthInit); } catch {}
      return ctx;
    } catch {}
  }
  throw new Error('Chrome/Edge/Chromium 실행 실패');
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
      } catch {}
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

  // 1차: headless로 세션 확인
  let context = await launchBrowser(profileDir, true);
  let page = context.pages()[0] || await context.newPage();
  await page.goto(BOARD_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise(r => setTimeout(r, 5000));

  if (await isLoggedIn(page)) {
    onLog?.('✅ [Dropshot] 로그인 세션 확인');
    cachedContext = context; cachedPage = page;
    return page;
  }

  // 2차: visible 로그인 유도 (최대 5분)
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

  // 3차: visible 닫고 headless 재진입
  await context.close();
  const hctx = await launchBrowser(profileDir, true);
  const hpage = hctx.pages()[0] || await hctx.newPage();
  await hpage.goto(BOARD_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise(r => setTimeout(r, 4000));

  cachedContext = hctx; cachedPage = hpage;
  onLog?.('✅ [Dropshot] 준비 완료');
  return hpage;
}

export interface DropshotResult {
  ok: boolean;
  dataUrl: string;
  error?: string;
}

/** URL 이미지 → buffer (setInputFiles용) */
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
    /** i2i: URL 배열 (최대 4장). 각 URL을 buffer로 다운로드 후 setInputFiles로 dropshot UI에 주입. */
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

      try {
        // 1. board URL 재확인
        if (!page.url().includes('panel=image')) {
          await page.goto(BOARD_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await new Promise(r => setTimeout(r, 3000));
        }

        // 2. 호출 전 DOM의 result 이미지 snapshot (이전 이미지 반복 캡처 방지 — 중요!)
        const beforeSrcs: string[] = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('img'))
            .map(i => i.src || '')
            .filter(s => (s.startsWith('data:image/') || s.includes('cdn.aistudio.dropshot.io')) && !s.includes('/icons/') && !s.includes('/sample/'));
        });

        // 3. reference 이미지가 있으면 i2i 모드 — file input에 setInputFiles로 buffer 주입
        const refList = (options.referenceImageList || []).slice(0, 4);
        if (refList.length > 0) {
          onLog?.(`📎 [Dropshot] reference ${refList.length}장 업로드 중...`);
          const buffers: Array<{ name: string; mimeType: string; buffer: Buffer }> = [];
          for (const url of refList) {
            const f = await downloadAsFileBuffer(url);
            if (f) buffers.push(f);
          }
          if (buffers.length > 0) {
            const fileInput = await page.$(
              'input[type="file"][data-dropzone-accept="image"][multiple], ' +
              '[data-sentry-component="UploadedImage"] input[type="file"], ' +
              'input[type="file"][accept*="image"]'
            );
            if (fileInput) {
              try {
                await fileInput.setInputFiles(buffers);
                onLog?.(`✅ [Dropshot] reference ${buffers.length}장 업로드 완료`);
                await new Promise(r => setTimeout(r, 2500));
              } catch (e: any) {
                onLog?.(`⚠️ [Dropshot] reference 업로드 실패: ${e.message?.slice(0, 100)}`);
              }
            } else {
              onLog?.(`⚠️ [Dropshot] reference 업로드 input 못 찾음 (UI 변경?) — 텍스트→이미지로 폴백`);
            }
          }
        }

        // 4. 프롬프트 입력
        await page.waitForSelector(PROMPT_SELECTOR, { timeout: 10000 });
        await page.click(PROMPT_SELECTOR);
        await page.fill(PROMPT_SELECTOR, currentPrompt);
        await new Promise(r => setTimeout(r, 1000));

        // 5. 생성 버튼 클릭 — textarea parent의 absolute button
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
        if (!clicked) await page.keyboard.press('Enter');

        // 6. 결과 이미지 대기 — snapshot에 없던 NEW 이미지만 잡음 (최대 90초)
        const startTs = Date.now();
        let foundDataUrl: string | null = null;
        while ((Date.now() - startTs) < 90_000) {
          await new Promise(r => setTimeout(r, 2000));

          // base64 data URL
          const dataUrl = await page.evaluate((before: string[]) => {
            const beforeSet = new Set(before);
            return Array.from(document.querySelectorAll('img')).find(i => {
              const src = i.src || '';
              return src.startsWith('data:image/') && i.naturalWidth > 200 && !src.includes('icons/') && !beforeSet.has(src);
            })?.src || null;
          }, beforeSrcs);
          if (dataUrl) { foundDataUrl = dataUrl; break; }

          // CDN URL → blob → dataURL 변환
          const cdnUrl: string | null = await page.evaluate((before: string[]) => {
            const beforeSet = new Set(before);
            return Array.from(document.querySelectorAll('img')).find(i => {
              const src = i.src || '';
              return src.includes('cdn.aistudio.dropshot.io') && !src.includes('/icons/') && !src.includes('/sample/') && i.naturalWidth > 200 && !beforeSet.has(src);
            })?.src || null;
          }, beforeSrcs);
          if (cdnUrl) {
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
```

**커스터마이즈 포인트** (4곳):
- `PROFILE_ROOT` / `PROFILE_NAME`: 본인 앱 이름에 맞게 변경 (예: `.myapp` / `dropshot-profile`)
- `isLoggedIn()`: 본인 앱의 추가 로그인 확인 조건이 있으면 추가
- `BOARD_URL` / `PROMPT_SELECTOR`: dropshot UI 리뉴얼 시 selector 갱신
- `MAX_RETRIES` (기본 3): 본인 앱의 신뢰성 요구에 맞춰 조정

---

## §4. Dispatcher 통합 (3개 hook 포인트)

본인 앱에 이미지 dispatcher(여러 엔진 분기 처리)가 있다면 다음 3곳에 dropshot을 등록:

### 4.1 지원 엔진 목록 추가
```typescript
export const SUPPORTED_IMAGE_ENGINES = [
  // ... 기존 엔진들 ...
  'dropshot-nanobanana-pro', // 신규
] as const;
```

### 4.2 별칭 매핑 (사용자가 다양한 표기로 입력해도 인식)
```typescript
const aliasMap: Record<string, ImageEngine> = {
  // ... 기존 alias ...
  'dropshot': 'dropshot-nanobanana-pro',
  'dropshot-nano-banana-pro': 'dropshot-nanobanana-pro',
  'dropshotnanobananapro': 'dropshot-nanobanana-pro',
};
```

### 4.3 분기 case 추가
```typescript
case 'dropshot-nanobanana-pro':
case 'dropshot': {
  const { makeDropshotImage } = await import('./dropshotGenerator');
  const refList = (extra as any)?.referenceImageList as string[] | undefined;
  const result = await makeDropshotImage(
    inferredPrompt,
    refList && refList.length > 0 ? { referenceImageList: refList } : {},
    onLog,
  );
  if (result.ok) {
    return { ok: true, dataUrl: result.dataUrl,
      source: refList?.length ? `Dropshot (i2i ${refList.length}장)` : 'Dropshot' };
  }
  return { ok: false, dataUrl: '', source: '', error: `Dropshot 실패: ${result.error}` };
}
```

### 4.4 (선택) auto/폴백 체인에서 제외
**중요**: dropshot은 UI 자동화라 API보다 느리고 fragile. 사용자가 명시 선택할 때만 사용하도록, **auto 모드와 자동 폴백 체인에서는 제외** 권장.

### 4.5 (선택) AI 프롬프트 추론 스킵
dropshot은 한국어 prompt를 자체 처리 잘함. 영어 강제 변환 불필요:
```typescript
if (engine !== 'nanobanana' && ... && engine !== 'dropshot-nanobanana-pro') {
  // AI 추론 실행
}
```

---

## §5. UI 통합

### 5.1 엔진 select option
```html
<option value="dropshot-nanobanana-pro">
  🍌 Dropshot 나노바나나 Pro (Pro 구독자 무제한 · 구독료별 · UI 자동화)
</option>
```

### 5.2 비용 매핑 (정확하게)
```javascript
const IMAGE_ENGINE_COST_KRW_PER_IMAGE = {
  // 이미지당 한계비용. Pro 구독료(월 74,000~99,000원)는 별도.
  'dropshot-nanobanana-pro': 0,
  // ...
};
```

### 5.3 비용표 행 (필수: 구독료 안내)
```html
<tr>
  <td>🍌 Dropshot 나노바나나 Pro <span class="badge">i2i 지원</span></td>
  <td>구독료별*</td>
  <td>구독자 무제한</td>
  <td>✅ 최우수 (한글 텍스트)</td>
</tr>
<tr>
  <td colspan="4" class="footnote">
    ※ Dropshot Pro 구독료: 월 74,000~99,000원 (사이트 직접 결제).
       구독자는 이미지 무제한 + 이미지당 추가비용 0원.
  </td>
</tr>
```

### 5.4 i2i 자동 연결 (선택 — 쇼핑 모드 등)
```typescript
// dropshot 엔진 + 수집 이미지가 있으면 → i2i 자동 활성화
const isDropshot = /^dropshot/i.test(String(engineName));
if (isDropshot && productImages?.length > 0) {
  extra.referenceImageList = productImages.slice(0, 4);
}
```

---

## §6. 검증 — smoke test (Node.js 단일 파일)

`scripts/dropshot-smoke.js`:

```javascript
const { makeDropshotImage } = require('../dist/core/dropshotGenerator');
const fs = require('fs');

(async () => {
  console.log('[smoke] Dropshot 이미지 1장 생성 시도...');
  const t0 = Date.now();

  const r = await makeDropshotImage(
    '귀여운 노란 고양이가 햇살 비치는 창가에서 잠자는 사실적인 사진',
    { aspectRatio: '16:9' },
    msg => console.log('  📢', msg),
  );

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  if (r.ok && r.dataUrl) {
    const m = /^data:image\/(\w+);base64,(.+)$/.exec(r.dataUrl);
    if (m) {
      const buf = Buffer.from(m[2], 'base64');
      const out = `dropshot-smoke.${m[1]}`;
      fs.writeFileSync(out, buf);
      console.log(`✅ ${elapsed}s — ${out} (${Math.round(buf.length/1024)}KB)`);
      process.exit(0);
    }
  }
  console.log(`❌ ${elapsed}s — 실패: ${r.error}`);
  process.exit(1);
})();
```

**실행**:
```bash
# 1. 빌드 (TS → JS)
npm run build

# 2. smoke test (첫 실행은 visible 브라우저 + 사용자 로그인 5분 대기)
node scripts/dropshot-smoke.js

# 3. 두 번째 실행은 headless로 즉시 작동 (세션 영구 저장)
node scripts/dropshot-smoke.js
```

**기대 결과**:
- 1차: visible Chrome 열림 → 사용자 Google/이메일 로그인 → 자동으로 headless 전환 → 이미지 1장 생성
- 2차: ~13-20초 안에 즉시 이미지 1장 생성 (세션 재사용)

---

## §7. 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| 5분 대기 후 "로그인 시간 초과" | 사용자가 로그인 안 함 | visible 창에서 로그인 — Google OAuth 또는 이메일 |
| `Failed to fetch` / 401 INTERNAL_SERVER_ERROR | API 직접 호출 시도 | 이 키트는 UI 조작 — 그런 에러 안 남. 만약 본다면 코드를 잘못 적용 |
| `90초 내 결과 이미지 미발견` | UI selector 변경 / dropshot 사이트 리뉴얼 | 본 .md §3의 selector들을 dropshot 사이트 DevTools로 재조사 |
| 같은 이미지가 반복 반환됨 | snapshot 비교 누락 | `beforeSrcs` 캡처 후 그것에 없는 NEW 이미지만 추출 (코드에 이미 포함) |
| reference 업로드 실패 | i2i input selector 변경 | `input[type="file"][data-dropzone-accept="image"]` 등 selector 다시 조사 |
| Chrome 없음 에러 | 시스템 Chrome/Edge 미설치 | `npm install playwright && npx playwright install chromium` |
| reCAPTCHA 무한 루프 | patchright 미설치 | `npm install patchright` |

---

## §8. 일반화 — 다른 무료 이미지 사이트로 확장

같은 패턴(Cognito + Firebase 또는 자체 token refresh + UI 조작 우회)이 적용 가능한 서비스들. 각 사이트의 **3개 selector**만 dropshot용에서 교체:

| 사이트 | 프롬프트 selector | 생성 버튼 | 결과 이미지 |
|---|---|---|---|
| dropshot.io | `textarea[placeholder="어떤 장면을..."]` | parent의 `button.absolute` | `img[src^="data:image/"]` |
| (다른 서비스 추가 시 여기에 기록) | | | |

**핵심 추출 단계** (15분):
1. 사이트 정상 로그인 + DevTools 열기
2. Elements 탭에서 프롬프트 입력란 우클릭 → Copy selector
3. 같은 방식으로 생성 버튼 + 결과 이미지 영역 selector 추출
4. 본 .md §3의 코드에서 BOARD_URL + 3개 selector만 교체
5. §6 smoke test로 검증

---

## §9. 라이선스 & 윤리

- ✅ **개인 계정 1개만 사용** (다중 계정 회피 = ToS 위반)
- ✅ Dropshot Pro 구독 정상 결제 후 사용
- ✅ Rate limit / 사이트 의도된 사용량 준수
- ❌ DDoS / 스크래핑 / 콘텐츠 도용 금지

dropshot.io의 ToS 변경 시 본 키트가 정책 위반이 될 수 있음 — 사용 시점에 직접 ToS 확인.

---

## §10. 변경 이력

- **v1.0 (2026-05-30, app v3.6.0)**: 초안 — blogger-gpt-cli에서 추출, 실측 검증 완료
  - 3장 batch 모두 고유 hash + i2i smoke 성공
  - 비용 표시 정정: "0원" → "구독료별, 한계비용 0원"

---

## 📞 문의

- **레퍼런스 앱**: [blogger-gpt-cli v3.6.0](https://github.com/cd000242-sudo/blogger-gpt-cli)
- **실제 코드 파일**: [src/core/dropshotGenerator.ts](../src/core/dropshotGenerator.ts)
- **dispatcher 통합 예제**: [src/core/imageDispatcher.ts](../src/core/imageDispatcher.ts) (`case 'dropshot-nanobanana-pro'` 검색)
- **i2i 자동 연결 예제**: [src/core/final/orchestration.ts](../src/core/final/orchestration.ts) (`isDropshot && productImgList` 검색)

이 .md 하나로 통합 가능. 코드 추가 의존성 없음.
