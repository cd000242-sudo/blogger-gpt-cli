# 무료 이미지 사이트 → 앱 자동화 통합 가이드

> **목적**: API 키 없이 무제한 이미지 생성을 제공하는 웹 서비스(예: dropshot.io 나노바나나 프로, Google ImageFX, Google Flow)를 Electron 앱에 자동화로 통합하는 표준 패턴.
>
> **대상**: blogger-gpt-cli + 다른 Electron/Node 앱
>
> **레퍼런스 구현** (모두 검증 완료):
> - [src/core/imageFxGenerator.ts](../src/core/imageFxGenerator.ts) — Google ImageFX (IMAGEN 3.5)
> - [src/core/flowGenerator.ts](../src/core/flowGenerator.ts) — Google Flow (Veo)
> - [src/core/dropshotGenerator.ts](../src/core/dropshotGenerator.ts) — **Dropshot nano-banana-pro (Pro 구독자 무제한 + i2i 지원, v3.6.0 실측 완료)**

---

## 0. TL;DR — 한 페이지 요약

| 단계 | 무엇을 | 왜 |
|------|--------|-----|
| 1 | DevTools Network 탭에서 이미지 생성 요청 캡처 | 엔드포인트 + 헤더 + 페이로드 + 인증 방식 식별 |
| 2 | 인증 토큰 위치 식별 (쿠키 / Bearer / localStorage / CSRF) | 자동화 시 토큰 획득 경로 결정 |
| 3 | Playwright `launchPersistentContext`로 프로필 영구화 | 로그인 1회 → 이후 세션 자동 재사용 |
| 4 | Patchright + stealth args로 봇 탐지 우회 | reCAPTCHA Enterprise, Cloudflare, FingerprintJS 회피 |
| 5 | `page.evaluate(() => fetch(...))` 패턴 — 브라우저 컨텍스트에서 API 호출 | 쿠키 자동 포함 + CORS 우회 + CSRF 헤더 자동 |
| 6 | 토큰/페이지 캐시 + 사전 갱신 + mutex | 병렬 호출 안전 + 만료 직전 401 회피 |
| 7 | 에러별 분기 재시도 (401/429/503/safety filter) | 자동 복구 + 사용자 개입 최소화 |
| 8 | 세션 만료 자동 복구 — 프로필 백업 + 재로그인 유도 | 강제 종료 대신 무중단 복구 |

**다른 앱에 이식**: 7개 파일만 복사 + 사이트별 endpoint/페이로드만 교체.

---

## 1. 핵심 아키텍처 (6 컴포넌트)

```
┌──────────────────────────────────────────────────────────────┐
│                 사용자 / IPC 호출자                          │
└────────────────────┬─────────────────────────────────────────┘
                     │ makeImage(prompt, options)
                     ▼
┌──────────────────────────────────────────────────────────────┐
│              [1] Public API — makeImage()                    │
│   • aspect ratio 매핑 / 프롬프트 sanitize                    │
│   • 최대 N회 재시도 루프 + 에러별 분기                       │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│              [2] ensurePage() — Mutex Gate                   │
│   • _ensurePagePromise lock — 병렬 호출 방어                 │
│   • 캐시된 page 살아있으면 재사용                            │
│   • 죽었으면 [3]→[4]→[5] 흐름                                │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│       [3] launchBrowser() — Persistent Context               │
│   • Profile dir: ~/.app-name/site-profile/                   │
│   • Patchright 우선 → Playwright fallback                    │
│   • Channel: chrome → msedge → bundled Chromium              │
│   • Stealth args + addInitScript                             │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│      [4] 세션 검증 → 분기                                    │
│   • headless 먼저: getSessionToken() 호출                    │
│   • 토큰 있음 → 즉시 사용                                    │
│   • 토큰 없음 → context close → visible 재실행 → 사용자 로그인│
│   • 로그인 폴링 5초마다, 최대 5분                            │
│   • 성공 시 visible 닫고 headless 재진입 (백그라운드 유지)   │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│      [5] getToken() — Token Cache + Proactive Refresh        │
│   • 50분 TTL                                                  │
│   • 만료 5분 전 사전 갱신                                    │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│   [6] page.evaluate(() => fetch(...)) — In-Browser API Call  │
│   • 브라우저 컨텍스트 — 쿠키 자동 첨부                       │
│   • CORS / CSRF / SameSite 자동 통과                         │
│   • 응답: base64 / URL / blob 변환 후 dataURL 반환           │
└──────────────────────────────────────────────────────────────┘
```

### 왜 `page.evaluate(() => fetch(...))`인가
| 방식 | 장점 | 단점 |
|------|------|------|
| Node에서 `fetch` + 수동 쿠키 | 빠름 | 쿠키/CSRF/User-Agent/세션 헤더 수동 동기화 필요. SameSite=Lax 쿠키 미적용. |
| Playwright `page.request` | 자동 쿠키 | Custom 헤더 누락, JS 미실행, 일부 사이트 거부 |
| **`page.evaluate`** | **모든 헤더/쿠키 자동, 실제 사용자 컨텍스트** | 직렬화 한계(파라미터는 JSON 직렬 가능해야 함) |

**결론**: 무인증/세션 기반 서비스는 `page.evaluate` 안에서 `fetch`가 가장 안정적.

---

## 2. 사전 조사 단계 — DevTools로 엔드포인트 발견

자동화 코드를 짜기 전에 사이트의 **3가지**를 식별해야 한다.

### 2.1 이미지 생성 요청 캡처

```
1. 대상 사이트(예: aistudio.dropshot.io) Chrome에서 정상 로그인
2. F12 → Network 탭 → Fetch/XHR 필터
3. 이미지 생성 버튼 클릭
4. 새로 생기는 POST 요청 찾기 (보통 /generate, /api/image, /v1/predict 패턴)
5. 해당 요청 우클릭 → Copy → Copy as fetch (Node.js)
```

### 2.2 분석 체크리스트

캡처한 fetch 문에서 다음 추출:

| 항목 | 위치 | 자동화에서 처리 |
|------|------|---------------|
| **URL** | fetch 첫 인자 | 그대로 사용 |
| **method** | 보통 POST | 그대로 |
| **Authorization 헤더** | `Bearer ...` 또는 미존재 | 있으면 토큰 추출 경로 찾기 |
| **Cookie 헤더** | `session=...; csrf=...` | `page.evaluate` 자동 처리 → 무시 |
| **X-CSRF-Token** | meta 태그/쿠키에서 동기화 | `page.evaluate` 자동 처리 → 무시 |
| **요청 본문** | `body: JSON.stringify({...})` | 파라미터 구조 파악 (특히 model name) |
| **응답 구조** | Network → Response 탭 | base64 / URL / blob 형식 확인 |

### 2.3 토큰 위치 매핑

브라우저 콘솔에서 직접 실행:

```javascript
// 1. localStorage 검색
Object.keys(localStorage).filter(k => /token|auth|session|jwt/i.test(k))

// 2. 쿠키 검색 (HttpOnly가 아닌 것만 보임)
document.cookie.split(';').map(c => c.trim().split('=')[0])

// 3. 세션 엔드포인트 호출 (있다면)
fetch('/api/auth/session').then(r => r.json()).then(console.log)
fetch('/api/me').then(r => r.json()).then(console.log)

// 4. Authorization 헤더가 fetch 인터셉터로 자동 주입되는지 확인
//    → 페이지의 fetch wrapper / axios interceptor 추적
```

### 2.4 결과를 표로 정리

```markdown
| 사이트 | 로그인 | 토큰 방식 | API URL | 모델 파라미터 |
|--------|--------|----------|---------|--------------|
| labs.google/fx | Google OAuth | `/fx/api/auth/session` → access_token → Bearer | aisandbox-pa.googleapis.com/v1:runImageFx | modelInput.modelNameType |
| labs.google/flow | Google OAuth | (동일) | aisandbox-pa.googleapis.com/v1:run... | modelType: VEO |
| aistudio.dropshot.io | (조사 필요) | (조사 필요) | (조사 필요) | imageModelName=google/nano-banana-pro |
```

---

## 3. dropshot.io 구체 적용 플랜 — **v3.6.0 구현 완료 (실측)**

### 3.0 ⚠️ 핵심 발견 (11번 시도 후 결론)

dropshot.io는 **API 직접 호출 불가능**:
- AWS Cognito accessToken/idToken/refreshToken 쿠키 사용
- 모든 사용자별 endpoint는 **페이지 JS 내부의 token refresh 로직**을 거쳐야 인증 통과
- 외부 fetch (Node.js / page.evaluate / page.request) 11회 시도 모두 `401 INTERNAL_SERVER_ERROR`
- CORS preflight + cookie 도메인 매칭 문제까지 겹쳐 인증 우회 비현실적

**결론**: API 우회 포기 → **UI 자동화로 채택**. ImageFX/Flow와 동일 패턴.

### 3.1 사전 조사 결과 (정리 완료)

| 항목 | 값 |
|------|---|
| API host (참고용) | `api.aistudio.dropshot.io` |
| 생성 endpoint | `POST /v1/job/google%2Fnano-banana-pro` (235B body) |
| Body 구조 | `{prompt, modelName, isUnlimited, aspect_ratio, resolution, messageId, boardId}` |
| ID 생성 | Firebase push ID (20자: 8자 timestamp + 12자 random) |
| 응답 | `201 {"id": "..."}` |
| 결과 수신 | **Firebase Realtime DB push** (`ai-studio-prod-67d22-default-rtdb.asia-southeast1.firebasedatabase.app`) — IndexedDB 기반 |
| **결과 추출 방법** | **DOM의 `<img src="data:image/...base64,...">`에서 직접 scrape** (가장 안정적) |

### 3.2 ✅ v3.6.0 구현 — UI 자동화 채택 (API 우회 불가)

#### 핵심 UI selector (probe 검증 완료)

```ts
const PROMPT_SELECTOR = 'textarea[placeholder="어떤 장면을 만들고 싶나요?"]';

// 생성 버튼: textarea parent의 absolute button
const CLICK_STRATEGY = (page) => page.evaluate(() => {
  const ta = document.querySelector('textarea[placeholder="어떤 장면을 만들고 싶나요?"]');
  let parent = ta?.parentElement;
  for (let d = 0; d < 5 && parent; d++) {
    const btn = parent.querySelector('button.absolute');
    if (btn && !btn.disabled) { btn.click(); return true; }
    parent = parent.parentElement;
  }
  return false;
});

// 결과 이미지: DOM scrape (snapshot 비교로 이전 이미지 반복 방지)
const RESULT_DETECT = (page, beforeSrcs) => page.evaluate((before) => {
  const set = new Set(before);
  return Array.from(document.querySelectorAll('img')).find(i =>
    i.src.startsWith('data:image/') &&
    i.naturalWidth > 200 &&
    !i.src.includes('icons/') &&
    !set.has(i.src)
  )?.src;
}, beforeSrcs);

// i2i reference 업로드 selector
const REF_UPLOAD_INPUT =
  'input[type="file"][data-dropzone-accept="image"][multiple], ' +
  '[data-sentry-component="UploadedImage"] input[type="file"], ' +
  'input[type="file"][accept*="image"]';
```

#### v3.6.0 실측 결과 (3장 batch + i2i smoke)

| 시나리오 | 결과 | 시간 | 비고 |
|---|---|---|---|
| 텍스트→이미지 1장 | ✅ | 19.5s | 첫 호출 |
| 텍스트→이미지 2번째 (세션 재사용) | ✅ | 13.5s | 31% 단축 |
| 텍스트→이미지 3장 batch (snapshot fix 후) | ✅ 3/3 | 105.6s | 모두 고유 hash (md5) |
| **i2i 1장 (reference 업로드)** | ✅ | 38.4s | setInputFiles 자동 주입, source 라벨에 "i2i N장" 표시 |

#### 💎 비용 (실측 확인)

- **Pro 구독자: 무제한** (이미지당 0원) — `isUnlimited: true` body 필드로 Pro 권한 통과
- 무료 사용자: creditCost 75/장 — daily/monthly quota 안에서 작동
- **다른 사용자가 이 앱 쓸 경우**: 본인 dropshot 계정 + 본인 plan 따라감 (각자 1회 로그인 필요)

### 3.3 응답 패턴 — Pattern B+C 하이브리드

dropshot 같은 모던 SaaS는 보통 셋 중 하나:

> 참고: dropshot은 아래 세 패턴이 아니라 **B (Job ID) + C (Firebase push)** 하이브리드.
> POST 응답은 즉시 `201 {id}` (Pattern B), 결과는 Firebase Realtime DB의 IndexedDB push로 도착 (Pattern C 변형).
> 외부 polling 호출 안 보임 → **DOM scrape이 유일한 외부 접근 경로**. ImageFX/Flow와는 다른 흐름이라 새로운 generator 패턴이 필요했음.

#### Pattern A — 동기 base64 응답 (ImageFX 패턴)
```
POST /api/generate
→ 200 { "image": "iVBORw0KG..." }  // 30~60초 후 응답
```
**구현**: 한 번의 fetch로 완료. 가장 단순.

#### Pattern B — Job ID + Polling (가장 흔함)
```
POST /api/generate
→ 202 { "jobId": "abc123" }
GET  /api/jobs/abc123
→ 200 { "status": "pending" }  // 5회 반복
GET  /api/jobs/abc123
→ 200 { "status": "done", "imageUrl": "https://cdn.../abc.png" }
```
**구현**: 2초 간격 polling, 최대 60초.

#### Pattern C — WebSocket / SSE Streaming
```
POST /api/generate → { "streamId": "xyz" }
WS:   wss://.../stream/xyz
→ {"event":"progress", "percent":30}
→ {"event":"done", "imageUrl":"..."}
```
**구현**: 가장 복잡. `page.evaluate` 안에서 WebSocket 핸들링.

### 3.3 dropshot 구현 — UI 자동화 (v3.6.0 실제 코드)

실제 구현은 [src/core/dropshotGenerator.ts](../src/core/dropshotGenerator.ts) 참조. 핵심 차이:

| 단계 | ImageFX/Flow | **Dropshot** |
|------|--------------|--------------|
| 인증 | Bearer token (page.evaluate fetch) | Cookie + Origin/Referer (외부 호출 401) |
| API 호출 | `page.evaluate(fetch)` | **불가** — UI 조작 필수 |
| 프롬프트 전달 | API body | `textarea[placeholder="어떤 장면을 만들고 싶나요?"]` fill |
| 생성 트리거 | API 응답 대기 | textarea parent의 `button.absolute` click |
| 결과 추출 | Response.json().encodedImage | **DOM scrape** (`img[src^="data:image/"]`) + snapshot 비교 |
| i2i | 별도 endpoint | `input[data-dropzone-accept="image"]`에 `setInputFiles(buffer)` |

> 아래 골격은 **API 직접 호출 시도용**이었으나 실제로는 401로 실패 — 참고만 (역사). 실제 작동하는 코드는 위 표 + [dropshotGenerator.ts](../src/core/dropshotGenerator.ts).

### 3.3.LEGACY (참고용 — 실제로는 401 실패) Pattern B 가정 골격

```typescript
// src/core/dropshotGenerator.ts
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

const SITE_URL = 'https://aistudio.dropshot.io/ko/workspace/board?panel=image&imageModelName=google/nano-banana-pro';
const SITE_HOME = 'https://aistudio.dropshot.io';
const PROFILE_NAME = 'dropshot-profile';

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
  try { chromium = (await import('patchright' as any)).chromium; }
  catch { chromium = (await import('playwright')).chromium; }

  const forceVisible = String(process.env['VISIBLE_BROWSER'] || '').toLowerCase() === 'true';
  const effectiveHeadless = forceVisible ? false : headless;

  const baseOptions = {
    headless: effectiveHeadless,
    args: [
      '--no-first-run',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--lang=ko-KR,ko',
      '--window-size=1280,800',
    ],
    viewport: { width: 1280, height: 800 },
    locale: 'ko-KR',
    timezoneId: (() => {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul'; }
      catch { return 'Asia/Seoul'; }
    })(),
    ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=IdleDetection'],
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
    } catch { /* 다음 채널 */ }
  }
  throw new Error('Chrome/Edge/Chromium 모두 실행 실패');
}

// 🔑 사이트의 인증 방식에 따라 이 함수를 교체
async function isLoggedIn(page: any): Promise<{ ok: boolean; userName?: string }> {
  return await page.evaluate(async () => {
    try {
      // 🔧 조사 결과로 교체: dropshot의 세션 확인 엔드포인트
      // 예: /api/auth/me, /api/user, /api/session
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) return { ok: false };
      const data = await res.json();
      return { ok: !!data.id || !!data.user, userName: data.email || data.name };
    } catch { return { ok: false }; }
  });
}

export async function ensurePage(onLog?: (m: string) => void): Promise<any> {
  if (_ensurePagePromise) {
    await _ensurePagePromise;
    if (cachedPage && cachedContext) {
      try { await cachedPage.evaluate(() => document.readyState); return cachedPage; }
      catch { /* 죽음 → 재초기화 */ }
    }
  }
  let lockResolve!: () => void;
  _ensurePagePromise = new Promise(r => { lockResolve = r; });
  try { return await _ensurePageInternal(onLog); }
  finally { _ensurePagePromise = null; lockResolve(); }
}

async function _ensurePageInternal(onLog?: (m: string) => void): Promise<any> {
  if (cachedPage && cachedContext) {
    try {
      await cachedPage.evaluate(() => document.readyState);
      const url = cachedPage.url();
      if (!url.includes('dropshot.io')) {
        await cachedPage.goto(SITE_URL, { waitUntil: 'networkidle', timeout: 30000 });
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
  await page.goto(SITE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));

  let session = await isLoggedIn(page);
  if (session.ok) {
    onLog?.(`✅ [Dropshot] 로그인 확인: ${session.userName || 'user'}`);
    cachedContext = context;
    cachedPage = page;
    return page;
  }

  // 2차: visible 로그인 유도
  await context.close();
  context = await launchBrowser(profileDir, false);
  page = context.pages()[0] || await context.newPage();
  await page.goto(SITE_HOME, { waitUntil: 'networkidle', timeout: 30000 });
  onLog?.('🔐 [Dropshot] 브라우저에서 로그인해주세요. (최대 5분 대기)');

  let loggedIn = false;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    try {
      const pages = context.pages();
      page = pages.find((p: any) => { try { return p.url().includes('dropshot.io'); } catch { return false; } })
        || pages[pages.length - 1];
      const check = await isLoggedIn(page);
      if (check.ok) {
        loggedIn = true;
        onLog?.(`✅ [Dropshot] 로그인 완료: ${check.userName || 'user'}`);
        break;
      }
    } catch { continue; }
    if (i % 6 === 5) onLog?.(`⏳ [Dropshot] 로그인 대기 중... (${Math.round((i+1)*5/60)}분 경과)`);
  }
  if (!loggedIn) {
    await context.close();
    throw new Error('Dropshot 로그인 시간 초과 (5분).');
  }

  // 3차: headless로 재진입
  await context.close();
  const headlessCtx = await launchBrowser(profileDir, true);
  const headlessPage = headlessCtx.pages()[0] || await headlessCtx.newPage();
  await headlessPage.goto(SITE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));

  cachedContext = headlessCtx;
  cachedPage = headlessPage;
  onLog?.('✅ [Dropshot] 이미지 생성 준비 완료');
  return headlessPage;
}

// ─────────────────────────────────────────────────
// 🎯 Public API
// ─────────────────────────────────────────────────

export interface DropshotResult {
  ok: boolean;
  dataUrl: string;
  error?: string;
}

export async function makeDropshotImage(
  prompt: string,
  options: {
    aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
    model?: 'google/nano-banana-pro' | 'google/nano-banana-3.1';
  } = {},
  onLog?: (m: string) => void,
): Promise<DropshotResult> {
  const MAX_RETRIES = 5;
  const model = options.model || 'google/nano-banana-pro';
  const aspect = options.aspectRatio || '16:9';

  try {
    const page = await ensurePage(onLog);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      onLog?.(`🍌 [Dropshot] 이미지 생성 중... (시도 ${attempt}/${MAX_RETRIES})`);

      // 🔧 사이트별 endpoint/페이로드는 2.2의 조사 결과로 교체
      const result = await page.evaluate(async (params: { prompt: string; model: string; aspect: string }) => {
        try {
          // ────── Pattern B (Job ID + Polling) ──────
          const startRes = await fetch('/api/v1/images/generate', {  // 🔧 실제 endpoint
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: params.model,
              prompt: params.prompt,
              aspectRatio: params.aspect,
              // 🔧 사이트 조사 결과에 따라 필드 추가
            }),
          });
          if (!startRes.ok) return { error: `HTTP_${startRes.status}`, detail: (await startRes.text()).slice(0, 500) };
          const startData = await startRes.json();
          const jobId = startData.jobId || startData.id || startData.taskId;
          if (!jobId) return { error: 'NO_JOB_ID', detail: JSON.stringify(startData).slice(0, 500) };

          // Polling (2초 간격, 최대 60초)
          for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const stRes = await fetch(`/api/v1/jobs/${jobId}`, { credentials: 'include' });  // 🔧 실제 endpoint
            if (!stRes.ok) continue;
            const stData = await stRes.json();
            if (stData.status === 'done' || stData.status === 'completed' || stData.status === 'success') {
              // 🔧 응답 구조에 따라: imageUrl / image / base64 / data
              if (stData.imageUrl) {
                const imgRes = await fetch(stData.imageUrl);
                const blob = await imgRes.blob();
                const reader = new FileReader();
                return await new Promise<any>(resolve => {
                  reader.onloadend = () => resolve({ success: true, dataUrl: reader.result });
                  reader.onerror = () => resolve({ error: 'BLOB_READ_FAIL' });
                  reader.readAsDataURL(blob);
                });
              }
              if (stData.image || stData.base64) {
                const b64 = stData.image || stData.base64;
                const mime = stData.mimeType || 'image/png';
                return { success: true, dataUrl: `data:${mime};base64,${b64}` };
              }
              return { error: 'NO_IMAGE_FIELD', detail: JSON.stringify(stData).slice(0, 500) };
            }
            if (stData.status === 'failed' || stData.status === 'error') {
              return { error: 'JOB_FAILED', detail: JSON.stringify(stData).slice(0, 500) };
            }
            // pending/running → 계속 polling
          }
          return { error: 'POLL_TIMEOUT' };
        } catch (err: any) {
          return { error: 'EXCEPTION', detail: err.message };
        }
      }, { prompt, model, aspect });

      if (result.success && result.dataUrl) {
        onLog?.('✅ [Dropshot] 이미지 생성 완료');
        return { ok: true, dataUrl: result.dataUrl };
      }

      const code = result.error || 'UNKNOWN';
      const detail = result.detail || '';

      if (code === 'HTTP_401' || code === 'HTTP_403') {
        // 세션 만료 → 캐시 무효화 후 재시도
        cachedPage = null; cachedContext = null;
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      if (code === 'HTTP_429') {
        const waitSec = Math.min(30 * Math.pow(2, attempt - 1), 300);
        onLog?.(`⏳ [Dropshot] 한도 초과 — ${waitSec}초 대기`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
        continue;
      }
      if (code === 'HTTP_503') {
        const waitSec = Math.min(5 * Math.pow(2, attempt - 1), 60);
        onLog?.(`⏳ [Dropshot] 서버 과부하 — ${waitSec}초 대기`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
        continue;
      }
      if (detail.includes('safety') || detail.includes('policy') || detail.includes('blocked')) {
        // 프롬프트 sanitize 후 재시도
        prompt = prompt.replace(/[^\w\s가-힣.,!?'"()-]/g, ' ').replace(/\s+/g, ' ').trim();
        continue;
      }
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    return { ok: false, dataUrl: '', error: `MAX_RETRIES_EXCEEDED` };
  } catch (err: any) {
    return { ok: false, dataUrl: '', error: err.message };
  }
}
```

### 3.4 imageDispatcher 통합

[src/core/imageDispatcher.ts](../src/core/imageDispatcher.ts)에 케이스 추가:

```typescript
// 신규 엔진 분기
case 'dropshot-nanobanana-pro':
case 'dropshot-nanobanana-3.1':
case 'dropshot-nanobanana': {
  const { makeDropshotImage } = await import('./dropshotGenerator');
  const model = engine.replace('dropshot-', 'google/').replace('nanobanana', 'nano-banana');
  return makeDropshotImage(prompt, { aspectRatio: ratio, model: model as any }, onLog);
}
```

### 3.5 UI 통합

[electron/ui/index.html](../electron/ui/index.html) — 이미지 엔진 선택 select에 옵션 추가:

```html
<optgroup label="🍌 Dropshot (무료 무제한)">
  <option value="dropshot-nanobanana-pro">나노바나나 Pro (Dropshot) - 0원</option>
  <option value="dropshot-nanobanana-3.1">나노바나나 3.1 (Dropshot) - 0원</option>
  <option value="dropshot-nanobanana">나노바나나 (Dropshot) - 0원</option>
</optgroup>
```

비용표 객체에도 0원으로 추가:
```javascript
const IMAGE_ENGINE_COST_KRW_PER_IMAGE = {
  'dropshot-nanobanana-pro': 0,
  'dropshot-nanobanana-3.1': 0,
  'dropshot-nanobanana': 0,
  // ...
};
```

---

## 4. 핵심 디자인 결정 — 그대로 따라야 하는 이유

### 4.1 왜 Persistent Context인가
- **메모리/launchOptions 방식**: 매번 빈 프로필 → 매번 로그인 → 사용 불가
- **storageState (JSON)**: 쿠키만 저장. JS-set localStorage, IndexedDB 누락 → 일부 사이트 미인증
- **Persistent Context**: 쿠키 + localStorage + IndexedDB + ServiceWorker 모두 자동 영구화

### 4.2 왜 Patchright인가
- Playwright는 `navigator.webdriver=true` + CDP `Runtime.enable` 시그널 노출
- reCAPTCHA Enterprise는 두 신호로 자동화 탐지 → 403 / 무한 챌린지
- Patchright는 빌드 단계에서 두 신호 모두 제거 (검증된 stealth fork)

### 4.3 왜 `headless: true` 우선인가
- visible 모드는 사용자 작업 방해 (창이 튀어나옴)
- 첫 호출은 headless로 시도 → 세션 있으면 즉시 사용
- 없을 때만 visible로 전환 → 로그인 후 다시 headless

### 4.4 왜 Mutex가 필수인가
- 글 1개당 H2 이미지 3~5장 병렬 생성 → `ensurePage` 동시 호출
- Mutex 없으면 브라우저 N개 동시 launch → 동일 profile 충돌 → 모두 실패
- `_ensurePagePromise` 단일 promise lock으로 첫 호출만 초기화

### 4.5 왜 토큰 사전 갱신인가
- 만료 직전 사용 → 1차 호출 401 → 갱신 → 2차 호출 → 시간 낭비 + 자동화 신호 누적
- 만료 5분 전 미리 갱신 → 항상 신선한 토큰 → 401 발생률 0에 수렴

### 4.6 왜 세션 자동 복구인가
- profile 손상 시 사용자가 직접 폴더 삭제 → 재로그인 → 매우 비친화적
- 403 / `error/error.html` 리다이렉트 감지 시 자동으로:
  1. cached 무효화
  2. profile 폴더 → `.broken-<timestamp>` 백업 (복구 가능)
  3. 빈 profile 생성
  4. 다음 ensurePage 호출 시 visible 로그인 유도

---

## 5. 다른 앱 이식 체크리스트

```markdown
- [ ] 1. patchright + playwright 의존성 추가
       npm i patchright playwright
- [ ] 2. 사이트 사전 조사 완료 (§2)
       - [ ] 로그인 방식 식별
       - [ ] 세션 확인 엔드포인트 식별
       - [ ] 이미지 생성 endpoint + payload 캡처
       - [ ] 응답 패턴 식별 (A/B/C)
- [ ] 3. 파일 복사 + 사이트별 교체
       - [ ] src/core/{site}Generator.ts (이 가이드 §3.3 골격)
       - [ ] SITE_URL, SITE_HOME, PROFILE_NAME 상수 교체
       - [ ] isLoggedIn() 안의 세션 확인 endpoint 교체
       - [ ] makeImage() 안의 fetch URL + payload 교체
       - [ ] 응답 파싱 분기 (A/B/C 중 하나)
- [ ] 4. dispatcher 통합
       - [ ] imageDispatcher.ts에 case 추가
       - [ ] strict 모드/폴백 정책 정의
- [ ] 5. UI 통합
       - [ ] 엔진 select에 옵션 추가
       - [ ] 비용표 객체에 추가 (무료면 0원)
       - [ ] 로그인 상태 확인 버튼 (선택)
- [ ] 6. 테스트
       - [ ] 첫 실행 → visible 로그인 → 이미지 1장 성공
       - [ ] 2번째 실행 → headless 즉시 성공 (세션 재사용)
       - [ ] 병렬 3장 동시 호출 → mutex 작동 확인
       - [ ] 24시간 후 재실행 → 토큰 자동 갱신 확인
       - [ ] profile 강제 삭제 후 재실행 → 자동 복구 확인
```

---

## 6. 일반화 — 같은 패턴이 적용 가능한 서비스

이 가이드는 **API 키 없이 무료로 이미지/영상/음성을 제공하는 모든 웹 서비스**에 적용 가능:

| 서비스 | 자원 | 모델 | 적용 가능 |
|--------|------|------|-----------|
| labs.google/fx | 이미지 | IMAGEN 3.5 | ✅ 구현 완료 (`imageFxGenerator.ts`) |
| labs.google/flow | 영상 | Veo | ✅ 구현 완료 (`flowGenerator.ts`) |
| aistudio.dropshot.io | 이미지 | nano-banana Pro/3.1 | ✅ **v3.6.0 구현 완료 + i2i 지원** (`dropshotGenerator.ts`) |
| poe.com | 이미지/텍스트 | Imagen / FLUX / Midjourney | 🟡 동일 패턴 적용 가능 |
| perplexity.ai (Pro) | 이미지 | FLUX / DALL-E | 🟡 |
| copilot.microsoft.com | 이미지 | DALL-E 3 | 🟡 |
| bing.com/images/create | 이미지 | DALL-E 3 | 🟡 |
| character.ai | 이미지/텍스트 | 자체 | 🟡 |
| chat.qwen.ai | 이미지 | Qwen-Image | 🟡 |

**일반화 원칙**:
1. **세션 기반 인증을 쓰는 사이트**라면 무조건 이 패턴이 가장 안정적
2. **API 키를 제공하는 사이트**는 직접 fetch가 더 빠르지만, 키가 무료/무제한이 아니면 자동화가 비용상 유리
3. **Rate limit이 IP 기반**인 사이트는 multi-profile 확장으로 우회 가능 (profile별 다른 계정)

---

## 7. 트러블슈팅

### 7.1 첫 로그인 시 visible 브라우저가 안 보임
- `VISIBLE_BROWSER=true` 환경변수 설정 후 재실행
- Windows 화면 보호기/모니터 슬립 상태 확인
- 시스템 Chrome이 이미 실행 중이면 profile 충돌 가능 → Chrome 모두 종료 후 재시도

### 7.2 reCAPTCHA Enterprise 챌린지 무한 루프
- Patchright가 설치되어 있는지 확인 (`require('patchright')` 시도)
- timezone이 한국이 아닌 경우 — `Intl.DateTimeFormat().resolvedOptions().timeZone` 결과 확인
- VPN/프록시 사용 시 한국 IP로 전환

### 7.3 세션이 매번 끊김
- `~/.app-name/site-profile/` 경로 쓰기 권한 확인
- 안티바이러스가 profile 폴더를 격리하는 경우 — 예외 추가
- 사이트가 device fingerprint를 강하게 체크하는 경우 — `ignoreDefaultArgs`, stealth init script 강화

### 7.4 401/403이 재시도해도 계속 발생
- `resetSessionAndProfile()` 강제 호출 (profile 백업 + 재로그인)
- 사이트가 계정을 BAN한 경우 — 다른 계정으로 재로그인
- Cloudflare가 차단 — visible 모드 + `--lang=ko-KR`로 일반 사용자 시그널 강화

### 7.5 이미지가 base64가 아니라 URL로 응답
- `page.evaluate` 안에서 fetch(imageUrl) → blob → FileReader → dataURL 변환 (§3.3 참조)
- CORS 이슈가 있으면 `credentials: 'include'` 추가
- 그래도 안 되면 Node fetch + 쿠키 헤더 수동 동기화

---

## 8. 부록 — 보안 / 윤리

이 자동화 패턴 사용 시 준수:

- ✅ **개인 계정 1개**에 한해서만 사용 (다중 계정 회피는 ToS 위반)
- ✅ **사이트 ToS 확인** — "Automated access" 명시적 금지 시 사용 금지
- ✅ **Rate limit 준수** — 사이트가 1분당 N개로 제한하면 그 안에서만
- ✅ **개인적/내부 용도** — 자동화로 생성한 이미지를 재판매하지 않음
- ❌ DDoS / 스크래핑 / 콘텐츠 도용 목적 사용 금지
- ❌ 사이트의 의도된 사용량을 초과하는 대규모 트래픽 금지

dropshot.io는 무료 티어를 제공하므로 개인 사용 범위 내에서는 통상 허용. 단, 실제 ToS는 사용 시점에 직접 확인.

---

## 9. 변경 이력

- **v1.0 (2026-05-30)**: 초안 — ImageFX/Flow 패턴 일반화 + dropshot.io 구체 적용 플랜
- **v2.0 (2026-05-30, app v3.6.0)**: dropshot.io 구현 완료
  - **핵심 교훈**: API 직접 호출은 Cognito + Firebase Realtime DB 흐름 때문에 외부 인증 불가 (11회 시도 모두 401)
  - **채택 패턴**: UI 자동화 (textarea fill + button click + DOM scrape)
  - **i2i 지원**: `setInputFiles`로 reference 이미지 buffer 주입 → `data-dropzone-accept="image"` input에 자동 업로드
  - **쇼핑 모드 자동 연결**: orchestration.ts에서 dropshot 엔진 + productImages 조합 시 reference로 자동 전달
  - **비용**: Pro 구독자 무제한 (이미지당 0원, `isUnlimited: true`)
  - **검증**: 3장 batch 모두 고유 hash + i2i smoke 성공 (38.4s, "i2i 1장" source 라벨)
