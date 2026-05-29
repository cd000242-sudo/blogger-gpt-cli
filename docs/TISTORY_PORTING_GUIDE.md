# 티스토리 전용 앱 — 포팅 가이드

> 이 문서는 [APP_ARCHITECTURE.md](APP_ARCHITECTURE.md)를 읽었다는 전제로 작성됨.
> 
> **목표**: `blogger-gpt-cli`를 fork해서 **티스토리 전용 앱**(`tistory-gpt-cli`)으로 변환.
> **원칙**: 콘텐츠 생성·이미지·UI 90%는 그대로 두고, **발행/인증만 교체**.

---

## Phase 0 — 사전 준비

### 0.1 Repo Fork & 이름 변경
```bash
git clone https://github.com/cd000242-sudo/blogger-gpt-cli.git tistory-gpt-cli
cd tistory-gpt-cli
git remote remove origin
# 새 GitHub repo 생성 후
git remote add origin https://github.com/cd000242-sudo/tistory-gpt-cli.git
```

### 0.2 `package.json` 메타데이터 수정
```diff
{
-  "name": "blogger-gpt-cli",
+  "name": "tistory-gpt-cli",
-  "productName": "LEADERNAM Orbit",
+  "productName": "LEADERNAM Tistory",
   "version": "1.0.0",
   "build": {
-    "appId": "com.leadernam.orbit",
+    "appId": "com.leadernam.tistory",
     "publish": {
       "provider": "github",
       "owner": "cd000242-sudo",
-      "repo": "blogger-gpt-cli"
+      "repo": "tistory-gpt-cli"
     }
   }
}
```

### 0.3 티스토리 셀렉터 수집 먼저
[TISTORY_SELECTORS.md](TISTORY_SELECTORS.md)의 양식을 채워야 publisher 작성 가능.
양식이 비어있으면 Playwright로 한 번 띄워서 셀렉터를 직접 수집(아래 6장 참고).

---

## Phase 1 — 발행 분기 추가

### 1.1 [src/core/index.ts:1714](../src/core/index.ts) 수정

기존:
```typescript
if (platform === 'blogspot' || platform === 'blogger') {
  // ... Blogger API ...
} else if (platform === 'wordpress') {
  // ... WordPress REST API ...
}
```

→ 티스토리만 남기는 버전:
```typescript
if (platform === 'tistory') {
  const { publishToTistory } = require('./tistory/tistory-publisher');
  const result = await publishToTistory(
    payload,
    title,
    html,
    thumbnailUrl || '',
    (msg: string) => console.log(msg),
    postingMode,
    scheduleDate,
  );
  return {
    ok: result.ok,
    url: result.postUrl || result.url,
    postId: result.postId,
    id: result.postId,
    error: result.error,
    needsAuth: result.needsAuth,
  };
} else {
  return { ok: false, error: `Unsupported platform: ${platform} (only "tistory" is supported in this app)` };
}
```

### 1.2 src/tistory/ 디렉토리 신규 생성

```
src/tistory/
├── tistory-publisher.ts   # 메인 export: publishToTistory()
├── tistory-login.ts       # 카카오 OAuth 로그인 자동화
├── tistory-editor.ts      # 글쓰기 페이지 자동화
└── tistory-types.ts       # 타입 정의
```

각 파일 시그니처 (TISTORY_SELECTORS.md의 셀렉터 채운 뒤 구현):

**tistory-publisher.ts**:
```typescript
export async function publishToTistory(
  payload: RunOnePostPayload,
  title: string,
  htmlBody: string,
  thumbnailDataUrl: string,
  onLog?: (msg: string) => void,
  postingMode: 'immediate' | 'scheduled' | 'draft' = 'immediate',
  scheduleDate?: string,
): Promise<TistoryPublishResult> {
  // 1. 로그인 (캐시된 세션 우선)
  const page = await loginToTistory(onLog);
  // 2. 글쓰기 페이지 이동
  await openWriteEditor(page, payload.tistoryBlogName);
  // 3. 제목/본문/카테고리/태그/공개설정 입력
  await fillEditor(page, { title, htmlBody, category, tags, visibility });
  // 4. 발행 또는 예약
  const result = await publish(page, postingMode, scheduleDate);
  // 5. URL 추출 후 반환
  return result;
}
```

### 1.3 [src/env.ts](../src/env.ts) MAP 객체 수정

제거:
```typescript
BLOG_ID: 'blogId',
GOOGLE_CLIENT_ID: 'googleClientId',
GOOGLE_CLIENT_SECRET: 'googleClientSecret',
REDIRECT_URI: 'redirectUri',
WORDPRESS_SITE_URL: 'wordpressSiteUrl',
WORDPRESS_USERNAME: 'wordpressUsername',
WORDPRESS_PASSWORD: 'wordpressPassword',
```

추가:
```typescript
// 🆕 티스토리 설정
TISTORY_BLOG_NAME: 'tistoryBlogName',       // 예: myblog (myblog.tistory.com)
KAKAO_EMAIL: 'kakaoEmail',
KAKAO_PASSWORD: 'kakaoPassword',              // 옵션 — 토큰 캐시 우선
TISTORY_DEFAULT_CATEGORY: 'tistoryDefaultCategory',
TISTORY_DEFAULT_VISIBILITY: 'tistoryDefaultVisibility', // public/protected/private
```

---

## Phase 2 — UI 수정 (electron/ui/)

> ⚠️ src/ui/는 미사용. **반드시 electron/ui/에서 작업**.

### 2.1 [electron/ui/index.html](../electron/ui/index.html)

#### 2.1.1 플랫폼 선택 카드 (line 1322-1343)

**제거**: Blogger 카드 + WordPress 카드
**추가**: 티스토리 카드 1장만 (또는 카드 자체를 숨기고 헤더만 "📝 티스토리 발행"으로 변경)

```html
<!-- 변경 후 — 단일 카드 또는 헤더만 -->
<div style="margin-bottom: 24px; text-align: center;">
  <h2 style="font-size: 24px; font-weight: 800; color: white;">📝 티스토리 자동 발행</h2>
  <p style="color: rgba(255,255,255,0.7); font-size: 14px; margin-top: 8px;">
    카카오 계정으로 자동 로그인 → AI 콘텐츠 생성 → 발행
  </p>
</div>
<!-- platform 라디오는 hidden + value="tistory" 고정 -->
<input type="hidden" name="platform" value="tistory">
```

#### 2.1.2 환경설정 모달 — API 키 탭

**제거 영역** (Blogger/WP 카드):
- `#blogId`, `#googleClientId`, `#googleClientSecret`, `#redirectUri` (블로거 설정)
- `#wordpressSiteUrl`, `#wordpressUsername`, `#wordpressPassword` (워드프레스 설정)

**추가 영역** (티스토리 카드):
```html
<div style="background: linear-gradient(135deg, #f97316, #ea580c); border-radius: 14px; padding: 18px; margin-top: 16px;">
  <h3 style="color: white; font-weight: 800; margin: 0 0 12px 0;">📝 티스토리 설정</h3>
  <div class="acc-field">
    <label class="acc-label">블로그 이름 (xxx.tistory.com의 xxx)</label>
    <input type="text" id="tistoryBlogName" placeholder="myblog" />
  </div>
  <div class="acc-field">
    <label class="acc-label">카카오 계정 이메일</label>
    <input type="email" id="kakaoEmail" placeholder="user@example.com" />
  </div>
  <div class="acc-field">
    <label class="acc-label">카카오 비밀번호 (선택 — 캐시 만료 시에만 사용)</label>
    <input type="password" id="kakaoPassword" />
    <small>💡 OAuth 토큰 캐시가 살아있으면 자동 로그인됩니다. 비번 미입력 시 첫 로그인은 수동.</small>
  </div>
  <div class="acc-field">
    <label class="acc-label">기본 카테고리</label>
    <select id="tistoryDefaultCategory">
      <option value="">-- 카테고리 자동 로드 (블로그명 저장 후) --</option>
    </select>
    <button type="button" onclick="loadTistoryCategories()">🔄 카테고리 새로고침</button>
  </div>
  <div class="acc-field">
    <label class="acc-label">기본 공개 설정</label>
    <select id="tistoryDefaultVisibility">
      <option value="public" selected>전체 공개</option>
      <option value="protected">보호</option>
      <option value="private">비공개</option>
    </select>
  </div>
</div>
```

### 2.2 [electron/ui/script.js](../electron/ui/script.js)

#### 2.2.1 platform 값 고정

**기존 (v3.5.93 fix 후)**:
```javascript
const platformSelectedRadio = document.querySelector('input[name="platform"]:checked');
const platformSelect = { value: platformSelectedRadio?.value || '' };
```

**티스토리 전용**:
```javascript
const platformSelect = { value: 'tistory' };  // 항상 tistory
```

#### 2.2.2 saveSettings — Blogger/WP 키 제거, 티스토리 키 추가

`saveSettings()` 함수에서:
```diff
- blogId: document.getElementById('blogId')?.value || '',
- googleClientId: document.getElementById('googleClientId')?.value || '',
- googleClientSecret: document.getElementById('googleClientSecret')?.value || '',
- wordpressSiteUrl: document.getElementById('wordpressSiteUrl')?.value || '',
- wordpressUsername: document.getElementById('wordpressUsername')?.value || '',
- wordpressPassword: document.getElementById('wordpressPassword')?.value || '',
+ tistoryBlogName: document.getElementById('tistoryBlogName')?.value || '',
+ kakaoEmail: document.getElementById('kakaoEmail')?.value || '',
+ kakaoPassword: document.getElementById('kakaoPassword')?.value || '',
+ tistoryDefaultCategory: document.getElementById('tistoryDefaultCategory')?.value || '',
+ tistoryDefaultVisibility: document.getElementById('tistoryDefaultVisibility')?.value || 'public',
```

`envData` 동기화 부분에서도 동일하게.

#### 2.2.3 인증 상태 체크 함수 교체

기존 `checkBloggerAuthStatus()`, `checkWordPressAuthStatus()` → `checkTistoryAuthStatus()`:
```javascript
async function checkTistoryAuthStatus() {
  if (window.electronAPI?.checkTistoryAuth) {
    const result = await window.electronAPI.checkTistoryAuth();
    return result; // { authenticated: bool, blogName: string, expiresAt: ... }
  }
  return { authenticated: false };
}
```

### 2.3 [electron/ui/modules/posting.js](../electron/ui/modules/posting.js)

성공 오버레이의 platform 라벨 부분 (v3.5.93에서 추가됨):
```javascript
const platformLabel = String(platformName || '').toUpperCase() || '티스토리';
// "TISTORY에 정상 발행되었습니다"로 표시됨
```

---

## Phase 3 — 신규 작성 (src/tistory/)

### 3.1 tistory-login.ts

카카오 OAuth 로그인 자동화. ImageFX/Flow와 같은 패턴 (persistent context + patchright stealth).

```typescript
// 의사 코드 (실제 셀렉터는 TISTORY_SELECTORS.md 작성 후 확정)
import { chromium } from 'patchright'; // 또는 playwright
import * as path from 'node:path';
import * as os from 'node:os';

const PROFILE_DIR = path.join(os.homedir(), '.blogger-gpt', 'tistory-profile');

export async function loginToTistory(onLog?: (msg: string) => void): Promise<any> {
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: process.env.VISIBLE_BROWSER === 'true' ? false : true,
    locale: 'ko-KR',
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  // 1. 티스토리 관리 페이지로 이동 (로그인 필요 시 카카오로 자동 redirect)
  await page.goto('https://www.tistory.com/auth/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // 2. 이미 로그인됐는지 확인 (대시보드 URL이면 OK)
  if (page.url().includes('/manage') || page.url() === 'https://www.tistory.com/') {
    return page;
  }

  // 3. 카카오 로그인 버튼 클릭
  await page.click('TISTORY_SELECTORS.kakaoLoginButton'); // TISTORY_SELECTORS.md 참고

  // 4. 카카오 이메일/비번 입력
  const env = loadEnvFromFile();
  if (env.kakaoEmail) {
    await page.fill('#loginId--1', env.kakaoEmail);
  }
  if (env.kakaoPassword) {
    await page.fill('#password--2', env.kakaoPassword);
    await page.click('button[type="submit"]');
  } else {
    // 비번 없으면 사용자가 직접 입력하도록 visible 모드로 대기
    onLog?.('🔐 카카오 비번을 직접 입력해주세요 (최대 5분 대기)');
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 5000));
      if (page.url().includes('/manage') || page.url() === 'https://www.tistory.com/') break;
    }
  }

  // 5. 2단계 인증(카카오톡 알림 승인) 처리
  // ...

  return page;
}
```

### 3.2 tistory-editor.ts

글쓰기 페이지 자동화:
```typescript
export async function openWriteEditor(page: any, blogName: string): Promise<void> {
  await page.goto(`https://${blogName}.tistory.com/manage/newpost`, { waitUntil: 'domcontentloaded' });
}

export async function fillEditor(page: any, opts: {
  title: string;
  htmlBody: string;
  category?: string;
  tags?: string[];
  visibility?: 'public' | 'protected' | 'private';
}): Promise<void> {
  // 1. 제목
  await page.fill('TISTORY_SELECTORS.titleInput', opts.title);

  // 2. 본문 (HTML 모드 전환 후 paste)
  await page.click('TISTORY_SELECTORS.htmlModeButton');
  await page.fill('TISTORY_SELECTORS.htmlTextarea', opts.htmlBody);
  // 또는 contenteditable인 경우:
  // await page.evaluate((html) => {
  //   const editor = document.querySelector('TISTORY_SELECTORS.contentEditor');
  //   editor.innerHTML = html;
  //   editor.dispatchEvent(new Event('input', { bubbles: true }));
  // }, opts.htmlBody);

  // 3. 카테고리
  if (opts.category) {
    await page.click('TISTORY_SELECTORS.categoryDropdown');
    await page.click(`text=${opts.category}`);
  }

  // 4. 태그
  if (opts.tags?.length) {
    const tagInput = page.locator('TISTORY_SELECTORS.tagInput');
    for (const tag of opts.tags) {
      await tagInput.fill(tag);
      await tagInput.press('Enter');
    }
  }

  // 5. 공개 설정
  await page.click(`TISTORY_SELECTORS.visibility_${opts.visibility || 'public'}`);
}

export async function publish(page: any, mode: 'immediate' | 'scheduled' | 'draft', scheduleDate?: string): Promise<TistoryPublishResult> {
  if (mode === 'scheduled' && scheduleDate) {
    await page.click('TISTORY_SELECTORS.scheduleRadio');
    await page.fill('TISTORY_SELECTORS.scheduleDateInput', scheduleDate);
  }

  // 발행 버튼 클릭
  await page.click('TISTORY_SELECTORS.publishButton');

  // 발행 완료 대기 + URL 추출
  await page.waitForURL(/\/post\/\d+/, { timeout: 30000 });
  const postUrl = page.url();
  const postId = postUrl.match(/\/post\/(\d+)/)?.[1];

  return { ok: true, postUrl, postId };
}
```

### 3.3 tistory-publisher.ts

위 둘을 묶어 export.

---

## Phase 4 — 단위 테스트

`__tests__/tistory-publisher.test.ts` 신규 작성:
```typescript
jest.mock('../src/tistory/tistory-login', () => ({
  loginToTistory: jest.fn(),
}));
jest.mock('../src/tistory/tistory-editor', () => ({
  openWriteEditor: jest.fn(),
  fillEditor: jest.fn(),
  publish: jest.fn(() => ({ ok: true, postUrl: 'https://test.tistory.com/post/123', postId: '123' })),
}));

import { publishToTistory } from '../src/tistory/tistory-publisher';

describe('publishToTistory', () => {
  it('정상 발행 흐름', async () => {
    const result = await publishToTistory(
      { topic: 'test', tistoryBlogName: 'test' } as any,
      'Test Title', '<p>Body</p>', '',
    );
    expect(result.ok).toBe(true);
    expect(result.postUrl).toContain('test.tistory.com');
  });

  it('카테고리/태그/공개설정 모두 fillEditor에 전달됨', async () => {
    // ...
  });
});
```

기존 [__tests__/imageDispatcher.test.ts](../__tests__/imageDispatcher.test.ts)는 그대로 유지 (이미지 dispatcher 변경 없음).

---

## Phase 5 — 빌드 + 릴리스

```bash
# 의존성 + 빌드
npm install
npm run build

# 테스트
npx jest __tests__/tistory-publisher.test.ts --no-coverage

# Windows installer
npx electron-builder --win --publish never

# GitHub Release
gh release create v1.0.0 --title "v1.0.0 — 티스토리 GPT CLI 초기 릴리스" --notes-file CHANGELOG.md
gh release upload v1.0.0 release/LEADERNAM-Tistory-1.0.0.exe release/LEADERNAM-Tistory-1.0.0.exe.blockmap release/latest.yml
```

---

## Phase 6 — 실측 검증 체크리스트

1. ☐ 카카오 로그인 자동화 — 첫 로그인 (비번 입력 또는 사용자 수동)
2. ☐ 세션 재사용 — 두 번째 발행은 자동 진입
3. ☐ 콘텐츠 생성 5단계 모두 동작 (external/internal/shopping/adsense/paraphrasing)
4. ☐ 이미지 8엔진 모두 동작 (ImageFX/Flow/나노바나나 3종/GPT 이미지 2종/Prodia/DeepInfra)
5. ☐ GPT 이미지 1/2 quality 옵션이 OpenAI에 전달됨
6. ☐ 카테고리 자동 선택
7. ☐ 태그 입력
8. ☐ 공개/보호/비공개 모두 동작
9. ☐ 즉시 발행 + 예약 발행 + 임시 저장
10. ☐ 발행 결과 URL이 정확히 추출됨
11. ☐ 발행 완료 시 전체화면 성공 오버레이 표시 (v3.5.93 추가)
12. ☐ 작업 중지 버튼 동작 (v3.5.93 추가)
13. ☐ 라이선스 + 자동 로그인 — auto-login.json 정상 생성
14. ☐ electron-updater — 새 버전 알림 동작

---

## Phase 7 — 알려진 차이 (티스토리 특유)

| 항목 | Blogger | WordPress | **티스토리** |
|---|---|---|---|
| 인증 | Google OAuth | App Password | **카카오 OAuth (Playwright 자동화)** |
| 발행 | REST API | REST API | **웹 UI 자동화 (공식 API 없음)** |
| 이미지 업로드 | base64 inline | 미디어 라이브러리 | **드래그&드롭 또는 클립보드** |
| HTML 모드 | 자체 모드 | Gutenberg/Classic | **마크다운/HTML/리치 텍스트 3종** |
| 예약 발행 | timestamp 필드 | status='future' | **예약 라디오 + 날짜 picker** |
| 카테고리 | 라벨(텍스트) | ID | **카테고리 ID (블로그별)** |

**가장 큰 도전**: 티스토리는 공식 API가 (2019년 deprecate 후) 사실상 없음 → **모든 발행이 Playwright UI 자동화**. 셀렉터 변경에 취약 → CI에서 주기적 smoke 테스트 권장.

---

## Phase 8 — 라이선스 / 자동 업데이트 — 변경 없이 그대로

- `src/utils/license-manager-new.ts`: 그대로 사용 (server URL만 별도면 분리)
- `src/utils/auto-login-manager.ts`: 그대로 사용
- `electron/main-login.js`: 그대로 사용
- `electron-updater`: GitHub Releases owner/repo만 변경 (`package.json` build.publish)

---

## Phase 9 — 작업 소요 시간 추정

| 단계 | 시간 |
|---|---|
| Phase 0 (메타데이터/repo) | 30분 |
| Phase 1 (분기 + tistory/ 디렉토리 작성) | 4시간 |
| Phase 2 (UI 수정) | 2시간 |
| Phase 3 (Playwright 자동화 작성) | **8~16시간** — 셀렉터 수집 + 시행착오 |
| Phase 4 (테스트) | 2시간 |
| Phase 5 (빌드/릴리스) | 1시간 |
| Phase 6 (실측 디버깅) | **4~8시간** — 카카오 2단계 인증 등 |
| **합계** | **약 21~33시간 (3~5일)** |

가장 큰 변수: **카카오 로그인 자동화의 봇 감지** 회피. patchright + visible 모드 + 사용자 수동 첫 로그인이 가장 안정적.

---

> 작성일: 2026-05-28 / 기준 버전: blogger-gpt-cli v3.5.93
> 다음 문서: [TISTORY_SELECTORS.md](TISTORY_SELECTORS.md) (셀렉터 수집 양식)
