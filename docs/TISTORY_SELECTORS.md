# 티스토리 셀렉터 + 정보 수집 양식

> 티스토리는 공식 API가 없으므로 **모든 발행이 Playwright UI 자동화**. UI가 자주 바뀌므로 셀렉터를 한 곳에 모아 관리.
> 
> 사용법:
> 1. Playwright로 visible 브라우저 띄움 → 사용자가 직접 로그인 → DevTools(F12)로 셀렉터 수집
> 2. 본 문서의 각 항목에 셀렉터 채움
> 3. `src/tistory/` 코드가 `TISTORY_SELECTORS` constant를 import해서 사용
> 4. UI 변경 시 본 문서만 갱신 → 코드는 그대로

---

## 0. 셀렉터 수집 헬퍼 스크립트

`tmp/tistory-selector-collect.js` (참고용 — `tmp/cloudways-diag*.js` 패턴 그대로):

```javascript
const path = require('node:path');
const fs = require('node:fs');

async function loadChromium() {
  try { return (require('patchright')).chromium; }
  catch { return (require('playwright')).chromium; }
}

(async () => {
  const chromium = await loadChromium();
  const profileDir = path.join(__dirname, '.tistory-profile');
  if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

  const ctx = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    locale: 'ko-KR',
    args: ['--disable-blink-features=AutomationControlled', '--window-size=1400,900'],
    viewport: { width: 1400, height: 900 },
  });

  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://www.tistory.com/auth/login', { waitUntil: 'domcontentloaded' });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1. 브라우저 창에서 카카오 로그인 완료');
  console.log('2. 글쓰기 페이지(https://<blog>.tistory.com/manage/newpost) 이동');
  console.log('3. DevTools(F12) → Console에 다음 입력:');
  console.log('');
  console.log('   $$("input, textarea, button, [role=button], select").forEach(el => ');
  console.log('     console.log(el.tagName, el.id, el.name, el.className.substring(0,50), el.textContent.substring(0,30))');
  console.log('   )');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 1시간 유지
  await new Promise(r => setTimeout(r, 3600 * 1000));
})();
```

---

## 1. 카카오 로그인 페이지 (`https://accounts.kakao.com/login`)

> 카카오는 자체 봇 감지 강도가 높음. **patchright + visible 모드 + 사용자 수동 입력**이 가장 안정적.

| 항목 | 셀렉터 후보 | 비고 | 확인일 |
|---|---|---|---|
| 이메일 입력 | `input#loginId--1` 또는 `input[name="loginId"]` | 동적으로 ID 끝자리 변경됨 — name 권장 | TBD |
| 비밀번호 입력 | `input#password--2` 또는 `input[name="password"]` | 동적 ID — name 권장 | TBD |
| 로그인 유지 체크박스 | `input[name="stay_signed_in"]` | 기본 unchecked | TBD |
| 로그인 버튼 | `button[type="submit"]` 또는 `button.btn_g.highlight.submit` | | TBD |
| 2단계 인증 (모바일 카톡) | (별도 페이지 navigation) | URL 패턴: `/talk_verify` | TBD |
| 2단계 인증 코드 입력 | `input[name="verify_code"]` 또는 SMS code input | | TBD |
| 보안 문자 (캡차) | iframe — 자동화 회피 어려움 | **patchright 필수** | TBD |

**로그인 성공 감지**:
- URL 패턴: `accounts.kakao.com` → `kauth.kakao.com` → 최종 티스토리 도메인으로 redirect
- 또는 `document.cookie`에 `_T_ANO` 쿠키 존재

---

## 2. 티스토리 글쓰기 페이지 (`https://<blog>.tistory.com/manage/newpost`)

> 2024~2026 기준 티스토리는 **에디터 모드 3종**: 마크다운 / HTML / 리치 텍스트(WYSIWYG).
> HTML 모드가 가장 안정적 (블로그 GPT가 생성한 HTML을 그대로 paste 가능).

### 2.1 페이지 진입

| 항목 | 셀렉터/URL | 비고 |
|---|---|---|
| 글쓰기 페이지 URL | `https://<blogName>.tistory.com/manage/newpost` | blogName은 사용자 설정 |
| 모달 안내 — 처음 글쓰기 | `.layer_post_intro` 또는 `dialog` | "안내" 모달 자동 닫기 필요 |
| 에디터 모드 선택 모달 | `text=HTML` 버튼 클릭 | 첫 진입 시 모드 선택 |
| 에디터 모드 변경 버튼 (이후) | 우측 상단 `[data-button-type="mode"]` 또는 `text=기본 모드 ▼` | "HTML 모드"로 전환 |

### 2.2 제목 입력

| 항목 | 셀렉터 후보 | 비고 | 확인일 |
|---|---|---|---|
| 제목 input | `textarea#post-title-inp` 또는 `[placeholder*="제목"]` | textarea 형태 가능성 | TBD |
| 제목 max length | (확인 필요) | 일반적으로 100자 제한 | TBD |

### 2.3 본문 입력 — HTML 모드

| 항목 | 셀렉터 후보 | 비고 | 확인일 |
|---|---|---|---|
| HTML 모드 버튼 | `button[data-mode="html"]` 또는 `text=HTML` | 모드 전환 메뉴 안 | TBD |
| HTML textarea | `textarea.tx-source` 또는 `.cm-content`(CodeMirror) | 마크다운 모드와 다른 element | TBD |
| 입력 방식 | `page.fill()` 또는 `evaluate(()=>{ textarea.value = html; textarea.dispatchEvent(new Event('input', {bubbles:true})); })` | CodeMirror면 별도 처리 | TBD |

### 2.4 본문 입력 — 리치 텍스트 모드 (대안)

| 항목 | 셀렉터 후보 | 비고 |
|---|---|---|
| contenteditable 본문 | `[contenteditable="true"]` 또는 `.editor-content` | iframe 내부일 수 있음 |
| iframe 진입 | `frameLocator('.tx-canvas-wrap iframe')` | 티스토리는 iframe 에디터 사용 가능 |
| HTML 주입 | `frame.locator('body').evaluate(el => el.innerHTML = html)` | |

### 2.5 카테고리 선택

| 항목 | 셀렉터 후보 | 비고 |
|---|---|---|
| 카테고리 드롭다운 트리거 | `button#category-btn` 또는 `[data-category-trigger]` | |
| 카테고리 옵션 리스트 | `ul.list_category li` | |
| 카테고리 ID | 옵션의 `data-category-id` 속성 | 블로그마다 다름 — 사전 조회 필요 |
| 새 카테고리 만들기 | `button.btn_add_category` | 옵션 |

**카테고리 ID 조회 API** (있다면):
- `GET https://<blog>.tistory.com/manage/category/list.json` (구버전 — 동작 확인 필요)
- 또는 카테고리 페이지 HTML 파싱

### 2.6 태그 입력

| 항목 | 셀렉터 후보 | 비고 |
|---|---|---|
| 태그 입력 input | `input#tagText` 또는 `input[placeholder*="태그"]` | |
| 태그 추가 트리거 | Enter 키 또는 쉼표 입력 | |
| 태그 칩 컨테이너 | `.tag_post .tag_item` | 추가된 태그 확인 |

### 2.7 공개 설정

| 항목 | 셀렉터 후보 | 비고 |
|---|---|---|
| 공개 라디오 | `input[name="visibility"][value="20"]` | value: 0=비공개, 15=보호, 20=공개 (티스토리 내부 코드) |
| 보호 라디오 | `input[name="visibility"][value="15"]` | 패스워드 입력 필요 |
| 비공개 라디오 | `input[name="visibility"][value="0"]` | |
| 보호 패스워드 input | `input#protectedPassword` | visibility=15일 때만 |

### 2.8 발행 / 예약 / 임시저장

| 항목 | 셀렉터 후보 | 비고 |
|---|---|---|
| 발행 버튼 | `button#publish-btn` 또는 `text=발행` | 최종 버튼 |
| 발행 옵션 모달 | `.layer_publish` | 발행 클릭 후 |
| 즉시 발행 라디오 | `input[name="publishTime"][value="now"]` | |
| 예약 발행 라디오 | `input[name="publishTime"][value="reservation"]` | |
| 예약 날짜 picker | `input#publish-date` | YYYY-MM-DD HH:MM 형식 |
| 임시 저장 버튼 | `button#temp-save-btn` 또는 `text=임시저장` | |
| 최종 발행 확인 버튼 | `text=공개 발행` 또는 모달 안의 confirm | |

### 2.9 발행 완료 감지

| 항목 | 패턴 | 비고 |
|---|---|---|
| 성공 URL | `https://<blog>.tistory.com/<postId>` | postId는 숫자 (예: 123) |
| 성공 토스트 | `.layer_alert text=발행되었습니다` | 일시적 (2~3초 후 사라짐) |
| 실패 토스트 | `.layer_alert.error` 또는 alert dialog | |

---

## 3. 카테고리 사전 조회 (블로그 설정용)

티스토리 관리 페이지에서 사용자의 카테고리 ID 목록 가져오기:

```typescript
async function listTistoryCategories(page: any, blogName: string): Promise<Array<{id: string, name: string}>> {
  await page.goto(`https://${blogName}.tistory.com/manage/category`, { waitUntil: 'domcontentloaded' });

  return await page.evaluate(() => {
    const items = document.querySelectorAll('TISTORY_SELECTORS.categoryListItem'); // ← 셀렉터 채워야 함
    return Array.from(items).map(el => ({
      id: el.getAttribute('data-category-id') || el.getAttribute('data-id') || '',
      name: el.querySelector('.category-name')?.textContent?.trim() || '',
    })).filter(c => c.id && c.name);
  });
}
```

이 결과를 환경설정 UI의 `<select id="tistoryDefaultCategory">`에 옵션으로 채움.

---

## 4. 이미지 업로드 (티스토리 특유)

티스토리는 본문 HTML에 외부 이미지 URL을 직접 넣어도 동작하지만, **다음과 같은 이슈 가능**:
- 외부 호스팅 이미지는 hotlink 차단되면 깨짐
- 티스토리 자체 CDN(`t1.daumcdn.net`)에 업로드하는 게 안정적

### 4.1 이미지 업로드 방식 선택지

| 방식 | 장점 | 단점 |
|---|---|---|
| **A. 외부 URL을 HTML에 직접** | 빠름, 추가 작업 X | hotlink 차단 위험, CDN 이점 X |
| **B. 클립보드 paste** | 자동 업로드됨 | Playwright clipboard API 복잡 |
| **C. 에디터 이미지 버튼 + 파일 선택** | 가장 안정적 | 자동화 셀렉터 복잡 |

### 4.2 셀렉터 (방식 C 기준)

| 항목 | 셀렉터 후보 |
|---|---|
| 이미지 추가 버튼 | `button#image-btn` 또는 toolbar `.btn_image` |
| 파일 input | `input[type="file"][accept*="image"]` |
| 업로드 진행 표시 | `.upload_progress` |
| 업로드 완료 후 본문 삽입 위치 | (자동 삽입) |

---

## 5. 자주 바뀌는 셀렉터 — 검증 자동화

UI 변경에 대비해 **CI에서 주기적 smoke 테스트** 권장:

```yaml
# .github/workflows/tistory-selectors-smoke.yml
name: Tistory Selectors Smoke Test
on:
  schedule:
    - cron: '0 0 * * 0'  # 매주 일요일
  workflow_dispatch:
jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm install
      - run: npx playwright install chromium
      - run: npx jest __tests__/tistory-selectors.smoke.test.ts
        env:
          KAKAO_EMAIL: ${{ secrets.KAKAO_EMAIL }}
          KAKAO_PASSWORD: ${{ secrets.KAKAO_PASSWORD }}
          TISTORY_BLOG_NAME: ${{ secrets.TISTORY_BLOG_NAME }}
```

테스트는:
- 로그인 → 글쓰기 페이지 진입 → 각 셀렉터가 페이지에 존재하는지 `await expect(page.locator(SEL).count()).toBeGreaterThan(0)`
- 셀렉터가 사라지면 GitHub Issue 자동 생성

---

## 6. 셀렉터 통합 export (`src/tistory/tistory-selectors.ts`)

```typescript
// 본 문서의 셀렉터를 TypeScript constant로 통합
export const TISTORY_SELECTORS = {
  kakaoLogin: {
    emailInput: 'input[name="loginId"]',
    passwordInput: 'input[name="password"]',
    staySignedIn: 'input[name="stay_signed_in"]',
    submitButton: 'button[type="submit"]',
  },
  editor: {
    introModalCloseButton: '.layer_post_intro .btn_close',
    modeSelector: '[data-button-type="mode"]',
    htmlModeButton: 'button[data-mode="html"]',
    titleInput: 'textarea#post-title-inp',
    htmlTextarea: 'textarea.tx-source',  // CodeMirror일 경우 별도 처리
    categoryTrigger: 'button#category-btn',
    categoryOption: (id: string) => `[data-category-id="${id}"]`,
    tagInput: 'input#tagText',
    visibilityRadio: (level: 'public' | 'protected' | 'private') => {
      const val = { public: '20', protected: '15', private: '0' }[level];
      return `input[name="visibility"][value="${val}"]`;
    },
    publishButton: 'button#publish-btn',
    publishConfirmButton: '.layer_publish text=공개 발행',
    scheduleRadio: 'input[name="publishTime"][value="reservation"]',
    scheduleDateInput: 'input#publish-date',
    tempSaveButton: 'button#temp-save-btn',
  },
  success: {
    postUrlPattern: /\/(?:m\/)?(\d+)$/,
    toastSelector: '.layer_alert',
  },
} as const;
```

이렇게 한 곳에 모아두면 **UI 변경 시 이 파일만 수정**.

---

## 7. 셀렉터 수집 진행 상황 추적

| 영역 | 진행률 | 마지막 검증 | 검증자 |
|---|---|---|---|
| 카카오 로그인 | 0% (TBD) | - | - |
| 글쓰기 페이지 진입 | 0% (TBD) | - | - |
| 본문 입력 (HTML 모드) | 0% (TBD) | - | - |
| 카테고리 선택 | 0% (TBD) | - | - |
| 태그 입력 | 0% (TBD) | - | - |
| 공개 설정 | 0% (TBD) | - | - |
| 발행 / 예약 | 0% (TBD) | - | - |
| 이미지 업로드 | 0% (TBD) | - | - |

→ 사용자가 실제로 티스토리 글쓰기 페이지를 열고 셀렉터 수집한 뒤 본 문서를 갱신.

---

> 작성일: 2026-05-28 / 기준: 티스토리 2024~2026 UI 추정 (실제 셀렉터는 사용자가 수집 필요)
> 다음 문서: [DESIGN.md](DESIGN.md) (UI 디자인 시스템)
