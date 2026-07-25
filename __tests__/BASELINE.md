# 테스트 baseline (릴리스 게이트 기준)

이 문서는 **"새로 깨진 것이 있는가"**를 판정하기 위한 기준점이다.
릴리스 전 `npm test`를 완주하고 아래와 대조한다. 아래 2건 외의 실패가 하나라도 있으면 릴리스하지 않는다.

## 기준 시점

- 버전: **v3.8.375** (R0 안전망 추가 직전)
- 측정: 2026-07-26, `npx jest --json` 전체 완주
- 소요: 약 19분

## 기준 수치

```
Test Suites: 58 passed, 2 failed, 60 total
Tests:      572 passed, 2 failed, 574 total
```

## 알려진 실패 2건 (R0 이전부터 존재 — 이번 작업과 무관)

| # | 파일 | 테스트 이름 |
|---|---|---|
| 1 | `__tests__/fact-integrity-regression.test.ts` | `fact integrity regression blocks a newer year when the supplied evidence only supports an older baseline` |
| 2 | `__tests__/imageDispatcher.test.ts` | `에러 메시지 상세화 + 엄격 모드 opt-in (v3.6.0) STRICT_H2_IMAGE_ENGINE=true + nanobananapro 실패 → STRICT_ENGINE_FAILED throw (폴백 차단)` |

## R0에서 추가한 안전망 (의도적으로 red)

아래는 **고쳐야 할 버그를 잡는 그물**이라 지금은 실패하는 것이 정상이다.
각 릴리스에서 해당 버그를 고치면 green으로 바뀌어야 하며, **green이 되지 않으면 그 수정은 완료된 것이 아니다.**

| 테스트 파일 | red 개수 | 대응 릴리스 | 잡는 버그 |
|---|---|---|---|
| `internal-links-roundtrip.test.ts` | 2 | R2 | 본문에 `<html>/<head>/<body>` 래퍼 삽입 |
| `gemini-engine-503-loop.test.ts` | 2 | R4 | 503 무한 재시도 → 엔진 락 영구 점유 |
| `schedule-manager-reentrancy.test.ts` | 3 | R6 | 중복 발행 / `processing` 영구 유실 / 미정렬 |
| `schedule-prefill-guard.test.ts` | 1 | R2.5 | UTC 프리필 → 예약이 즉시발행으로 강등 |
| `blogger-draft-log-guard.test.ts` | 1 | R1 | 로그가 실제 전송값과 다름 |

## 오답 방지 가드 (지금도 green — 절대 깨지면 안 됨)

- `internal-links-roundtrip`: `<style>`이 맨 앞에 남는지 / JSON-LD 1개 보존 / H1 1개 / 본문 텍스트 유실 없음
  → `$('body').html()`로 고치면 **모든 글의 CSS가 사라진다**. 정답은 `cheerio.load(html, null, false)`.
- `schedule-prefill-guard`: 로컬 시각 변환 로직이 되읽기에서 일치하는지 / 결과가 반드시 미래인지

## 빠른 반복용

```bash
npm run test:guard     # 이번 작업 관련 그물만 (~30초)
npm run test:fast      # imageDispatcher 제외 전체 (타입체크 생략)
npm run typecheck      # 타입은 여기서 따로 본다
npm test               # 릴리스 게이트 (전체, ~19분)
```
