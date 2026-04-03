# LEADERNAM Orbit — 아키텍처

## 시스템 구조

```
┌─────────────────────────────────────────────┐
│              Electron Shell                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │ main.ts  │  │preload.ts│  │ renderer  │ │
│  │ (IPC Hub)│  │ (Bridge) │  │ (UI)      │ │
│  └────┬─────┘  └──────────┘  └───────────┘ │
│       │                                      │
│  ┌────┴──────────────────────────────┐      │
│  │        IPC Handlers (분리됨)       │      │
│  │ schedule│ env │ config │ adsense  │      │
│  └────┬──────────────────────────────┘      │
└───────┼─────────────────────────────────────┘
        │
┌───────┼─────────────────────────────────────┐
│  src/ │  Core Business Logic                 │
│       │                                      │
│  ┌────┴─────┐  ┌──────────┐  ┌───────────┐ │
│  │  core/   │  │ crawlers/│  │  utils/    │ │
│  │          │  │          │  │            │ │
│  │ ultimate │  │ parsers/ │  │ error-     │ │
│  │ -blog.ts │  │ ├coupang │  │ handler.ts │ │
│  │          │  │ ├naver   │  │ logger.ts  │ │
│  │ mass-    │  │ ├ali     │  │ license-   │ │
│  │ crawler  │  │ ├temu    │  │ manager.ts │ │
│  │ .ts      │  │ └gmarket │  │ api-       │ │
│  │          │  │          │  │ cache.ts   │ │
│  │ schedule │  │ parser-  │  │ puppeteer- │ │
│  │ -manager │  │ utils.ts │  │ pool.ts    │ │
│  │ .ts      │  │          │  │            │ │
│  └──────────┘  └──────────┘  └───────────┘ │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │ content/ │  │wordpress/│  │  api/      │ │
│  │ modes/   │  │publisher │  │ blog-index │ │
│  │ ├adsense │  │ api      │  │ keyword-   │ │
│  │ ├external│  │ pipeline │  │ explorer   │ │
│  │ ├shopping│  └──────────┘  └───────────┘ │
│  │ └parapr. │                               │
│  └──────────┘                               │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │        config/constants.ts            │   │
│  │   (전역 상수: 타임아웃, 리밋 등)       │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
        │
┌───────┼─────────────────────────────────────┐
│  External Services                           │
│  ├ Gemini API (primary LLM)                 │
│  ├ OpenAI API (fallback LLM)                │
│  ├ Naver Search/Datalab API                 │
│  ├ Google CSE / Pexels (images)             │
│  ├ Blogger API v3 / WordPress REST          │
│  └ GAS License Server                       │
└─────────────────────────────────────────────┘
```

## 데이터 흐름

```
키워드 입력
    │
    ▼
[대량 크롤링] ── 네이버 API + RSS + Google CSE
    │                    │
    │               [제품 파서]
    │               coupang/naver/ali/temu
    │                    │
    ▼                    ▼
[콘텐츠 생성] ◄── 크롤링 데이터 + AI(Gemini/OpenAI)
    │
    ├─ H2/H3 소제목 재구성
    ├─ 본문 생성 (병렬)
    ├─ CTA + 요약표 (병렬)
    └─ 이미지 수집/생성
    │
    ▼
[콘텐츠 모드 적용]
    ├─ external (SEO)
    ├─ adsense (E-E-A-T)
    ├─ shopping (AIDA)
    ├─ paraphrasing
    └─ spiderweb (내부링크)
    │
    ▼
[발행] ── Blogger API / WordPress REST
    │
    ▼
[스케줄러] ── 예약 발행, 반복 실행
```

## 보안 레이어

| 레이어 | 구현 |
|--------|------|
| 비밀번호 | bcrypt (salt round 12) + SHA256 하위호환 마이그레이션 |
| 디바이스 ID | hostname + MAC + CPU model → SHA256 |
| 패치 파일 | AES-256-GCM 암호화 (scrypt 키 파생) |
| API 서버 | helmet + express-rate-limit |
| API 키 | 헤더 전용 (query param 차단) |
| CORS | localhost 제한 |

## 성능 최적화

| 영역 | 전략 |
|------|------|
| 브라우저 | Puppeteer 풀 (최대 3 인스턴스, 5분 유휴 해제) |
| API 호출 | Redis + 인메모리 TTL 캐시 |
| 크롤링 | pLimit(3) 동시성 제한 + PQueue(20) |
| 콘텐츠 생성 | H2/H3 병렬 Promise.all |
| 이미지 | 병렬 다운로드 + Sharp 압축 |
| 빌드 | incremental TS + 8GB heap |
