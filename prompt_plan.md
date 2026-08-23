# 네이버 API HUB 전면 배선 + 구글 CSE 제거 (v3.8.553~)

확정: 2026-08-22 · 사장님 승인 (CSE 옵션 ⓐ)

## 목표
1. 네이버 검색·데이터랩 호출을 **단일 창구(naver-search-client)** 경유로 통일 → HUB 우선 + 기존 키 만료 시 자동 토스
2. 구글 CSE 완전 제거 (신규 발급 불가 · 2027-01-01 종료)
3. 공공기관 근거 수집은 **네이버 webkr 로 이식** — 기능을 잃지 않는다
4. 전체 테스트 통과

## 진행 상황

### ✅ Phase 0 — 코어 15곳 (완료, v3.8.553)
content-crawler(5) · naver-api(3) · mass-crawler(2) · perplexityFactCheck(1)
keyword-demand(1) · keyword-narrowing(1) · naver-datalab(1) · subtopic-crawler(1)
→ src/core 직접 호출 잔여 0곳, tsc 통과, 창구 테스트 40/40

### ✅ Phase 1 — 나머지 38곳 (완료, v3.8.554)
- src/utils/*          21곳  (naver-datalab-api 5 · blog-index-via-datalab 6 · 기타 10)
- src/main/ipc/*       16곳  (realtime-trends 5 · content-crawling 4 · keyword-discovery 3 등)
- src/naver-crawler.ts  1곳
- 위험: blog-index-via-datalab 은 블로그 지수 계산이라 응답 스키마 의존도가 높다 — 개별 확인

### ✅ Phase 2 — CSE 완전 제거 (완료, v3.8.555)
- 2-1. official-sources.ts 를 네이버 webkr 기반으로 이식 (기능 유지가 먼저)
- 2-2. orchestration 의 CSE 두 자리 제거 (크롤링 2순위 폴백 · 공공기관 수집)
- 2-3. content-crawler.crawlFromCSE 제거
- 2-4. 설정 화면 칸 · IPC 점검 핸들러 · env 매핑 · preload 타입 정리
- 관련 테스트 5벌(official-sources · naver-web-official · v3-8-491 · v3-8-538 · cta-action-link-harness) 앵커 현행화

**마무리에서 잡은 반쪽 이식 4건** — 몸통은 네이버로 바꿔놓고 **입구 게이트에 CSE 키 조건이 남아 있던** 자리다.
CSE 키는 이제 아무도 발급받을 수 없으므로, 그 조건은 곧 "기능 영구 정지"를 뜻했다.
- `generation.searchOfficialSite` — `if (!googleCseKey || !googleCseCx) return null` 삭제 (CTA 주소 찾기 전체가 죽어 있었다)
- `generation.generateCTAsFinal` — 2단계 폴백 진입 조건에서 CSE 키 삭제
- `google-trends-api` — 1순위·폴백2 두 곳의 키 게이트 삭제 + 이름 정리(`getTrendKeywordsFromWeb`)
- `script.js` — `window.checkCseConnection = checkCseConnection`(함수는 이미 삭제됨) → **로드 즉시 ReferenceError**. 화면 전체가 죽는 자리였다

**같이 걷어낸 죽은 배선**: MassCrawlingSystem 생성자 CSE 인자 · `CrawlingStats.cseCount` ·
`CSEThumbOptions` · preload `testGoogleCseConnection`(핸들러는 이미 없어짐) ·
`main.ts`/`envIpcHandlers` keyMap · `env.ts` keyMap과 `imageSource` 기본값 `'cse'` ·
설정 저장/표시 목록 · "Google CSE 발급하러 가기" 버튼

### ✅ Phase 3 — 실행 검증 테스트 (완료, `__tests__/v3-8-555-naver-hub-live-wiring.test.ts` 20/20)
가짜 fetch 주입해 **실제 실행**으로 검증 (문자열 일치만으론 버그가 통과한다)
- 키 우선순위 · 토스(HUB→기존 / 기존→HUB / 데이터랩) · 재호출 1회
- 네트워크 오류엔 키 유지 · 429 는 토스 안 함
- 종료된 API(shop/book/doc) 호출 0건
- 라이브 경로에 openapi.naver.com 직접 호출 0건 고정

### ✅ Phase 4 — 전체 테스트 완주 + pack (완료, 2026-08-23)
- `npx jest` 완주: **241 스위트 / 3,472 테스트 전부 통과, 실패 0**
  (한 번에 돌리면 중간에 끊겨서 30개씩 9배치로 나눠 완주)
- 밀린 앵커 3건 현행화 — 전부 Phase 0/1 이전(단일 창구) 때 문자열이 바뀐 자리고 불변식은 살아 있었다
  - `fact-check-freshness-regression`: `'&sort=date'` → `"sort: 'date'"` (`sort: 'sim'` 부재도 함께 잠금)
  - `freshness-audit` 배선: `'sort=date'` → `"sort: 'date'"`
  - `freshness-audit` 폴백: `AbortSignal.timeout(8000)` → `timeoutMs: 8000` (타임아웃 조립이 창구 안으로 들어갔다)
- `npm run pack` → asar `package.json` 실측 **3.8.555**
- 패키지 안 `electron/main.js` · `preload.js` · `ui/script.js` · `ui/index.html` · `dist/ui/*` 에 CSE 흔적 **0건**

**⚠️ pack 이 TS2307 로 죽어 있었다** — `electron/main.ts` 의
`import { naverSearch } from '../core/naver-search-client'` (정답은 `../src/core/`, 게다가
그 파일에서 한 번도 안 쓰인다). 루트 `tsconfig.json` 은 `electron/main.ts` 를 include 하지 않아
`npx tsc --noEmit` 도 테스트 3,472건도 전부 통과하는데 **실행본만 못 만드는 상태**였다.
electron/*.ts 를 건드린 릴리스는 pack 을 실제로 돌려봐야 한다.

## 규율
- 1릴리스 1위험. Phase 마다 tsc + 관련 스위트 통과 확인
- 기존 id·class·fetchImpl 주입 경로는 건드리지 않는다 (하네스 보호)
- 없는 배선은 조용히 넘기지 않는다 — 경고를 남긴다

---

## 이전 계획

# Tistory Platform Integration Plan

## Goal

Add Tistory to LEADERNAM Orbit as a third publishing platform without breaking the existing Blogger and WordPress flows.

## Core Decision

Tistory must be implemented as browser automation, not as API publishing. Tistory Open API write/upload behavior is not a reliable production path, so the app should treat Tistory like a browser-driven publisher similar to the Naver automation flow.

## Product Shape

```text
LEADERNAM Orbit
├─ Blogger: Google Blogger API
├─ WordPress: WordPress REST API
└─ Tistory: Browser automation publisher
```

Common systems remain shared:

- Content generation
- Image generation
- CTA generation
- FAQ/table/mobile HTML
- Sequential queue
- Spider web posting
- External traffic post generation

Only the final publishing adapter changes by platform.

## Architecture

```text
src/core/index.ts
└─ publishGeneratedContent()
   ├─ publishToBlogger()
   ├─ WordPressPublisher.publish()
   └─ publishToTistory()

src/tistory/
├─ tistory-types.ts
├─ tistory-selectors.ts
├─ tistory-session.ts
└─ tistory-publisher.ts
```

## Phase 1: Foundation

1. Add Tistory env keys.
2. Add Tistory profile/session helpers.
3. Add Tistory selector registry.
4. Add `publishToTistory()` MVP entry point.
5. Connect `platform === "tistory"` to `publishGeneratedContent()`.
6. Add IPC methods for session check and login/editor opening.

## Phase 2: Beginner Setup UX

1. Add a Tistory card in platform settings.
2. Split user intent:
   - Connect existing Tistory blog
   - Create a new Tistory blog
3. Open a visible browser window.
4. Guide the user step by step:
   - Login
   - Select or create blog
   - Open editor
   - Detect categories
   - Run private test publish
5. Mark each step green when completed.

## Phase 3: Publishing MVP

1. Open `https://<blogName>.tistory.com/manage/newpost`.
2. Detect login state.
3. Switch to HTML editor mode where possible.
4. Insert title.
5. Insert generated HTML.
6. Add tags.
7. Select category if configured.
8. Save draft/private post first.
9. Return final URL or recovery payload.

## Phase 4: Image Handling

1. Keep URL-based images as a fallback.
2. Add local image upload through the editor.
3. Wait for upload completion.
4. Replace generated image URLs with Tistory-hosted URLs where possible.

## Phase 5: Queue, Spider, External Traffic

1. Force serial publishing for Tistory.
2. Keep a longer delay than API platforms.
3. Clear image previews per post.
4. Store Tistory post URL/postId for spider web posts.
5. Add optional advanced flow to edit old posts and insert a hub-return CTA marker.

## Phase 6: Reliability

1. Add selector health checks.
2. Add screenshots/log artifacts on failure.
3. Add recovery mode:
   - Open editor
   - Copy title
   - Copy HTML
   - Copy tags
4. Never continue the queue after a Tistory publish failure unless the user explicitly retries.

## Release Gate

Tistory should ship as beta only after these pass:

- Existing blog session check succeeds.
- Editor page opens.
- Private test publish succeeds.
- Generated HTML renders without major breakage.
- At least one image path works.
- Three sequential posts complete without parallelism.

