# 블로그 GPT CLI — 앱 전체 구조 (티스토리 포팅 기준)

> **목적**: 이 문서는 현재 앱(Blogger + WordPress 지원)을 **티스토리 전용 앱**으로 포팅할 때 필요한 모든 구조 정보를 담는다. 콘텐츠 생성·이미지·UI 등 **90%는 그대로 재사용**하고, 발행·인증 부분만 티스토리로 교체하면 된다.
> 
> 함께 볼 문서:
> - [TISTORY_PORTING_GUIDE.md](TISTORY_PORTING_GUIDE.md) — 어디를 어떻게 수정할지
> - [TISTORY_SELECTORS.md](TISTORY_SELECTORS.md) — 티스토리 UI 셀렉터/정보 수집 양식
> - [DESIGN.md](DESIGN.md) — 디자인 시스템 (색상·타이포·컴포넌트)

---

## 1. 핵심 스택

| 영역 | 기술 | 비고 |
|---|---|---|
| 앱 셸 | **Electron 42** | Chromium 134+, BrowserWindow 다중 인스턴스 |
| UI | Vanilla HTML/CSS/JS (`electron/ui/`) | React 사용 안 함, 빠른 로딩 우선 |
| 콘텐츠 생성 | TypeScript (`src/core/`) | Gemini/OpenAI/Claude API |
| 이미지 생성 | TypeScript (`src/thumbnail.ts`, `src/core/imageDispatcher.ts`) | 8개 엔진 dispatcher |
| 브라우저 자동화 | **patchright 1.60** + Playwright 1.60 | ImageFX/Flow stealth |
| 일반 크롤링 | **Puppeteer 25** + puppeteer-extra-stealth | 네이버/Google CSE 등 |
| 빌드 | tsc + electron-builder 26 | NSIS installer |
| 자동 업데이트 | electron-updater 6 | GitHub Releases |

---

## 2. 디렉토리 구조 (재사용 가능성 표시)

```
blogger-gpt-cli/
├── electron/                    # Electron 메인 프로세스 + UI
│   ├── main.js                  # ♻️ 90% 재사용 (IPC 핸들러, 일부만 티스토리화)
│   ├── preload.js               # ♻️ 100% 재사용 (IPC 브릿지)
│   ├── auth-utils.js            # ⚠️ 일부 수정 (라이선스는 그대로, 외부 인증 추가)
│   ├── main-login.js            # ♻️ 100% 재사용 (자동 로그인 시스템)
│   └── ui/
│       ├── index.html           # ⚠️ 일부 수정 (platform select 영역 + WP 설정 → 티스토리 설정으로 교체)
│       ├── login-window.html    # ♻️ 100% 재사용
│       ├── script.js            # ⚠️ 일부 수정 (platform 분기 → 티스토리만)
│       └── modules/
│           ├── posting.js       # ⚠️ 일부 수정 (발행 흐름)
│           ├── publish-queue.js # ♻️ 90% 재사용
│           ├── preview.js       # ♻️ 100% 재사용
│           ├── calendar.js      # ♻️ 100% 재사용 (예약 발행 UI)
│           └── ...
│
├── src/                         # 비즈니스 로직 (TypeScript)
│   ├── core/
│   │   ├── index.ts             # ⚠️ 일부 수정 (publish 분기 line 1714-1738)
│   │   ├── final/orchestration.ts  # ♻️ 100% 재사용 (콘텐츠 생성 orchestrator)
│   │   ├── imageDispatcher.ts   # ♻️ 100% 재사용 (이미지 엔진 8종)
│   │   ├── imageFxGenerator.ts  # ♻️ 100% 재사용 (ImageFX/Flow Playwright 자동화)
│   │   ├── flowGenerator.ts     # ♻️ 100% 재사용
│   │   ├── blogger-publisher.js # ❌ 제거 (티스토리에서는 미사용)
│   │   ├── max-mode/            # ♻️ 100% 재사용 (콘텐츠 생성 prompt)
│   │   ├── content-modes/       # ♻️ 100% 재사용 (5종 모드: external/internal/shopping/adsense/paraphrasing)
│   │   └── crawlers/            # ♻️ 100% 재사용 (네이버/Google 검색)
│   ├── wordpress/
│   │   └── wordpress-publisher.ts  # ❌ 제거 (티스토리 publisher로 교체)
│   ├── tistory/                 # 🆕 신규 생성 (티스토리 publisher)
│   │   ├── tistory-publisher.ts # 🆕 작성 필요
│   │   ├── tistory-login.ts     # 🆕 카카오 로그인 자동화
│   │   └── tistory-editor.ts    # 🆕 글쓰기/발행 자동화
│   ├── thumbnail.ts             # ♻️ 100% 재사용 (8 엔진 이미지 생성)
│   ├── env.ts                   # ⚠️ 일부 수정 (WP 키 제거, 티스토리 키 추가)
│   ├── cli.ts                   # ♻️ 100% 재사용
│   └── utils/                   # ♻️ 100% 재사용
│       ├── license-manager-new.ts  # 라이선스 시스템
│       ├── auto-login-manager.ts   # 자동 로그인
│       └── ...
│
├── docs/                        # 🆕 본 문서 + 포팅 가이드
├── __tests__/                   # ♻️ 100% 재사용 (Jest)
├── dist/                        # 빌드 산출물
└── package.json                 # ⚠️ name/productName/build 수정
```

**재사용률 요약**:
- ♻️ 100% 재사용: 약 **75%** (콘텐츠 생성·이미지·UI 큰 틀·라이선스·자동 업데이트)
- ⚠️ 일부 수정: 약 **15%** (platform 분기, env 키, UI 일부)
- 🆕 신규 작성: 약 **10%** (티스토리 publisher·login·editor)

---

## 3. 콘텐츠 생성 파이프라인 (플랫폼 무관 — 100% 재사용)

`src/core/final/orchestration.ts`의 `generateUltimateContent()` 함수가 메인. 다음 단계를 순서대로 실행:

```
1. payload 검증 + env 로드
2. URL 크롤링 (manualCrawlUrls) 또는 키워드 기반 크롤링 (네이버 블로그 + Google CSE + RSS)
3. AI 추론으로 제목(H1) 생성
4. 콘텐츠 모드별 구조 결정:
   - external: SEO 최적화 5섹션
   - internal: 단일 완결 + 자동 내부링크 거미줄
   - shopping: 쇼핑/구매유도 (점검 중)
   - adsense: 에드센스 승인 모드
   - paraphrasing: 페러프레이징 모드
5. AI가 전체 본문 생성 (1회 호출, JSON 파싱 실패 시 1회 재시도)
6. 팩트체크 (Naver Blog Search → Perplexity → Gemini 순)
7. 본문 품질 보강 (추가 1회 AI 호출)
8. FAQ 5개 생성
9. CTA 버튼 생성 (Gemini 추론 또는 manualCtas)
10. 백서(White Paper) 구조 조립
11. 섹션별 이미지 5장 + 썸네일 1장 생성 (병렬, 사용자 선택 엔진)
12. E-E-A-T 메타 보강 + Schema.org JSON-LD 삽입
13. 최종 HTML 완성 → 발행 단계로 전달
```

**티스토리 포팅 시 변경 사항 없음** — 위 13단계 모두 동일.

---

## 4. 이미지 엔진 — 8종 dispatcher (100% 재사용)

`src/core/imageDispatcher.ts`의 `dispatchH2ImageGeneration()`이 메인. 지원 엔진:

| 엔진 ID | 모델 | 장당 가격 | 한글 텍스트 |
|---|---|---|---|
| `imagefx` | Google ImageFX | 무료 | ❌ |
| `flow` | Google Flow (Nano Banana Pro) | 무료 (AI Pro 구독) | ✅ 최우수 |
| `nanobanana` | gemini-2.5-flash-image | $0.039 | 🟢 |
| `nanobanana2` | gemini-3.1-flash-image-preview | $0.067 | ✅ 우수 |
| `nanobananapro` | gemini-3-pro-image-preview | $0.134~0.24 | ✅ 최우수 |
| `gptimage1` | OpenAI gpt-image-1 | $0.011~0.167 (quality 별) | 🟢 |
| `gptimage2` | OpenAI gpt-image-2 (덕테이프) | $0.011~0.167 (quality 별) | ✅ |
| `prodia` | Prodia FLUX schnell | $0.001 | ❌ |
| `deepinfra` | DeepInfra FLUX-2-dev | $0.012 | ❌ |

**핵심 동작**:
- 사용자 명시 선택 시 → **strict 모드 자동** (폴백 차단, 실패 시 STRICT_ENGINE_FAILED throw)
- `'auto'`/`'default'`/빈값 → 폴백 체인 (nanobanana → imagefx → flow → deepinfra 순)
- 403/PERMISSION_DENIED 감지 시 → **자동 profile 백업 + 재로그인 유도** (v3.5.92)
- VISIBLE_BROWSER=true 환경변수 → headless 강제 false (봇 회피 모드)
- GPT 이미지 1/2는 quality(low/medium/high) 옵션 지원

**티스토리 포팅 시**: 변경 없음. 모든 엔진 그대로 사용 가능.

---

## 5. 발행 분기 (티스토리 포팅의 핵심)

[src/core/index.ts:1714-1850](../src/core/index.ts) `publishGeneratedContent()`:

```typescript
if (platform === 'blogspot' || platform === 'blogger') {
  // Google Blogger API 호출 (publishToBlogger)
} else if (platform === 'wordpress') {
  // WordPress REST API 호출 (publishToWordPress)
}
// 🆕 추가:
// else if (platform === 'tistory') {
//   const { publishToTistory } = require('./tistory/tistory-publisher');
//   await publishToTistory(payload, title, html, thumbnailUrl, ...);
// }
```

**티스토리 발행 흐름 (새로 만들어야 함)**:
```
1. 카카오 OAuth 로그인 (Playwright 자동화) — 토큰 캐시 재사용
2. 티스토리 글쓰기 페이지 열기 (https://blog.tistory.com/manage/post)
3. 제목 textarea에 H1 입력
4. 본문 에디터에 HTML 입력
   - 옵션 A: HTML 모드로 직접 paste
   - 옵션 B: 마크다운/리치 텍스트 변환 후 입력
5. 카테고리 선택 (드롭다운)
6. 태그 입력 (쉼표 구분)
7. 공개 설정 (공개/비공개/보호)
8. 발행 또는 예약 발행
9. 결과 URL 추출 후 반환
```

---

## 6. UI 구조 — `electron/ui/`

> ⚠️ **중요**: `src/ui/`는 미사용 디렉토리. **모든 UI 변경은 `electron/ui/`에 적용**.
> 빌드 시 `copy-ui.js`가 `electron/ui/` → `dist/ui/`로 복사함.

### 6.1 메인 화면 (`electron/ui/index.html`)

| 영역 | ID/셀렉터 | 비고 |
|---|---|---|
| 플랫폼 선택 | `input[name="platform"]` 라디오 | blogger / wordpress 카드형 |
| 키워드 입력 | `textarea#keywordInput` | 단일/연속 발행 공용 |
| 원본 URL | `textarea#referenceUrl` | URL 모드 입력 |
| 콘텐츠 모드 | `select#contentMode` | 5종 |
| 썸네일 타입 | `select#thumbnailType` | 9종 (5 엔진 + text/cse/crawled/none) |
| H2 이미지 소스 | `select#h2ImageSource` | 동일 |
| GPT quality | `input[name="gptImageQuality"]` 라디오 | gpt-image-1/2 선택 시만 표시 |
| 봇 회피 모드 | `input#visibleBrowserMode` | ImageFX/Flow visible 강제 |
| 발행 모드 서브탭 | `[data-publish-mode]` | 단일/연속 |
| 입력 소스 서브탭 | `[data-single-input-mode]` | 키워드/URL (단일 모드만) |
| 발행 버튼 | (스크롤 영역) | "🚀 블로그 글 작성 시작" |

### 6.2 환경설정 모달 (`#settingsModal`)

탭: API 키 / 블로그 플랫폼 / 원클릭 세팅 / 이미지 비용표

**API 키 탭에 있는 입력 필드** (티스토리에서 일부 제거 필요):
- `#geminiKey`, `#openaiKey`, `#claudeKey`, `#perplexityKey` — 콘텐츠/이미지 AI (유지)
- `#leonardoKey`, `#pexelsApiKey`, `#stabilityApiKey`, `#deepInfraApiKey`, `#prodiaApiKey` — 이미지 (유지)
- `#naverCustomerId`, `#naverSecretKey`, `#googleCseKey`, `#googleCseCx` — 검색 (유지)
- `#blogId`, `#googleClientId`, `#googleClientSecret` — **Blogger 전용 (제거)**
- `#wordpressSiteUrl`, `#wordpressUsername`, `#wordpressPassword` — **WP 전용 (제거)**
- 🆕 추가 필요: `#tistoryBlogName` (티스토리 블로그명), `#kakaoEmail`, `#kakaoPassword` 또는 OAuth 토큰

---

## 7. IPC 채널 (preload.js + main.js)

### 7.1 발행 관련 (티스토리 포팅 시 추가/수정)

| 채널 | 방향 | 용도 | 티스토리 포팅 |
|---|---|---|---|
| `run-post` | render → main | 발행 실행 | ♻️ 그대로 (내부 분기에 tistory 추가) |
| `cancel-task` | render → main | 작업 중지 | ♻️ 그대로 |
| `check-blogger-auth` | render → main | Blogger OAuth 확인 | ❌ 제거 |
| `check-wordpress-auth` | render → main | WP 인증 확인 | ❌ 제거 |
| `check-tistory-auth` | render → main | 🆕 카카오 OAuth 토큰 확인 |
| `tistory-login` | render → main | 🆕 Playwright로 로그인 |

### 7.2 라이선스 / 자동 로그인 (100% 재사용)

| 채널 | 용도 |
|---|---|
| `license-authenticate` | ID/비번 + 라이선스 코드 인증 |
| `license-logout` | 로그아웃 (license.json 삭제) |
| `license-status-new` | 라이선스 상태 조회 |
| `save-auto-login-config` | auto-login.json 저장 |
| `load-auto-login-config` | auto-login.json 로드 |
| `session-validate` | 중복 로그인 감지 |
| `session-start-validation` | 주기적 세션 검증 시작 |

### 7.3 자동 업데이트 (100% 재사용)

| 채널 | 용도 |
|---|---|
| `auto-update-event` | main → render: 업데이트 알림 |
| `updater:getVersion` | 현재 버전 조회 |
| `updater:check` | 강제 업데이트 확인 |

---

## 8. 환경변수 (env.ts) — 티스토리 포팅 시 수정

### 8.1 유지 (콘텐츠 생성용 — 변경 없음)

```
GEMINI_API_KEY, OPENAI_API_KEY, CLAUDE_API_KEY, PERPLEXITY_API_KEY,
NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, GOOGLE_CSE_KEY, GOOGLE_CSE_CX,
DEEPINFRA_API_KEY, PRODIA_API_KEY, STABILITY_API_KEY, PEXELS_API_KEY,
VISIBLE_BROWSER, STRICT_H2_IMAGE_ENGINE, STRICT_THUMBNAIL_ENGINE
```

### 8.2 제거 (Blogger/WP 전용)

```
BLOG_ID, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI,
WORDPRESS_SITE_URL, WORDPRESS_USERNAME, WORDPRESS_PASSWORD
```

### 8.3 신규 추가 (티스토리 전용)

```
TISTORY_BLOG_NAME       # 예: myblog (myblog.tistory.com)
KAKAO_EMAIL             # 카카오 로그인 이메일
KAKAO_PASSWORD          # (옵션) 비밀번호 — 또는 토큰 캐시만 사용
TISTORY_DEFAULT_CATEGORY # 기본 카테고리 ID
TISTORY_DEFAULT_VISIBILITY # public / protected / private
```

[src/env.ts](../src/env.ts)의 MAP 객체에 위 키들 추가/제거.

---

## 9. 라이선스 / 인증 시스템 (100% 재사용)

`src/utils/license-manager-new.ts` + `src/utils/auto-login-manager.ts`:
- 라이선스 파일: `%APPDATA%/<app-name>/license.json` + `license.lic`
- 자동 로그인 파일: `%APPDATA%/<app-name>/auto-login.json`
- 세션 검증: 중복 로그인 감지 (다른 기기에서 로그인 시 이쪽 강제 종료)

**티스토리 포팅 시**: `<app-name>` 변경(`tistory-gpt-cli`)만 하면 됨. 시스템 자체는 그대로.

---

## 10. 자동 업데이트 (electron-updater + GitHub Releases)

- `package.json`의 `build.publish` 필드에 GitHub Releases 설정
- `release/latest.yml` + `.exe.blockmap` + `.exe`를 GitHub Release에 업로드
- 사용자 앱이 시작 시 자동으로 latest.yml 확인 → 새 버전 알림 → 다운로드 → 재시작

**티스토리 포팅 시**:
- `package.json`에서 `productName`, `appId`, `publish.owner`/`repo`를 티스토리용으로 변경
- 새 GitHub repo 생성 (`tistory-gpt-cli`)
- electron-updater 자체는 그대로 동작

---

## 11. 빌드 / 패키징

```bash
npm run build              # tsc + UI 복사
npx electron-builder --win # NSIS installer 생성
                           # → release/<productName>-<version>.exe
                           # → release/<productName>-<version>.exe.blockmap
                           # → release/latest.yml
```

**산출물 크기**: 약 110~120MB (Chromium 134 + 의존성).

---

## 12. 핵심 파일 빠른 참조

### 발행 분기 추가할 곳
- [src/core/index.ts:1714](../src/core/index.ts) `publishGeneratedContent()` 함수

### UI 플랫폼 선택 추가할 곳
- [electron/ui/index.html:1322-1343](../electron/ui/index.html) 플랫폼 카드 영역

### 환경변수 매핑
- [src/env.ts:148-160](../src/env.ts) MAP 객체

### 라이선스 매니저
- [src/utils/license-manager-new.ts](../src/utils/license-manager-new.ts)

### IPC 정의
- [electron/preload.js](../electron/preload.js)
- [electron/main.js](../electron/main.js)

---

## 13. 알려진 함정 (티스토리 포팅 시 주의)

1. **`src/ui/`는 미사용 디렉토리** — 모든 UI 변경은 `electron/ui/`에만 적용. [memory/project_ui_dual_dir.md](../../memory/project_ui_dual_dir.md) 참고.
2. **`platformSelect` ID는 HTML에 존재하지 않음** — `name="platform"` 라디오만 있음. v3.5.93에서 fix됨.
3. **patchright와 playwright는 버전이 일치해야 함** — 미스매치 시 reCAPTCHA로 403. v3.5.92에서 fix.
4. **Puppeteer 25 breaking changes** — `headless: 'new'` → `true`, `page.waitForTimeout` → `setTimeout` Promise.
5. **WordPress 설정이 Blogger 설정과 envData에서 다르게 처리됨** — 티스토리는 새로 설계 가능.

---

> 작성일: 2026-05-28 / 기준 버전: v3.5.93
> 다음 문서: [TISTORY_PORTING_GUIDE.md](TISTORY_PORTING_GUIDE.md)
