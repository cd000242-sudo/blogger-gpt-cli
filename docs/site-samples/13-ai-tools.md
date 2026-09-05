# 13. AI 도구·SaaS 리뷰  *(영어 사이트 전제)*

> **"둘 중에 뭘 써야 하나."** 디렉터리는 나열만 한다. 우리는 비교하고 결론을 준다.

## 판정

| 항목 | 값 |
|---|---|
| 검색량 | 큼 · 신제품마다 새 검색어가 생긴다 |
| 단가 | **최상** — SaaS 제휴는 **반복 커미션 20~30%**. 한 번 소개하면 구독하는 내내 들어온다 |
| 스펙트럼 | **최상** — 도구 수만 개 × 용도 × 가격대 × 대안 비교 |
| 진입 | **상(어려움)** — Toolify 26,000개, TAAFT 12,000개. 디렉터리로는 못 이긴다 |
| **자동화 친화도** | **최상** — 실사진이 필요 없다. 스크린샷과 표로 끝난다 |
| 영어 확장 | 이 주제는 **처음부터 영어**다. 한국어로는 시장이 없다 |

### 왜 이 주제인가 — 자동화 관점

여행·음식·뷰티는 **실사진이 랭킹 요소**라 자동 발행으로 못 채운다. AI 도구는 다르다.
스크린샷·가격표·기능 비교표가 콘텐츠의 전부이고, 전부 공개 데이터다.
**툴로 돌리기에 12개 주제 중 가장 잘 맞는다.**

### 이길 자리

디렉터리(나열)로는 못 이긴다. **비교(결론)**로 이긴다.

| 저쪽이 하는 것 | 우리가 할 것 |
|---|---|
| "AI 글쓰기 도구 200개" | "**Jasper vs Copy.ai — 6개월 써보고 갈아탄 이유**" |
| 기능 목록 나열 | 가격 함정·해지 조건·실제 한도 |
| 전부 별 4.5개 | **안 좋은 점을 먼저 쓴다** |

구매 직전 검색어라 전환율이 가장 높고, 디렉터리는 이 자리를 비워 둔다.

## 벤치마크 — 블로그 형태만 골랐다

| 사이트 | 배울 것 | 확인 |
|---|---|---|
| **zapier.com/blog** | **글 구조의 교과서.** 아래 3-1 참고 | HTTP 200 |
| **detailed.com** | 개인이 운영하는 깔끔한 블로그 디자인·타이포 | HTTP 200 |
| **rtings.com** | 데이터를 표·점수로 보여주는 법(하드웨어지만 형식이 같다) | HTTP 200 |

### 3-1. Zapier 글 구조 (실측)

`zapier.com/blog/task-automation-tools/` 를 뜯어보니 이 순서였다.

```
① The best {카테고리} tools              ← 제목
② What makes the best {카테고리}?        ← 선정 기준을 먼저 공개 (신뢰 장치)
③ The best {카테고리} at a glance        ← 요약 표 1개
④ Best {카테고리} for {용도}  × 6        ← 순위가 아니라 용도별 1위
⑤ Which one should you choose?           ← 결론
```

**핵심은 ④다.** "1위·2위·3위"가 아니라 **"이런 사람에겐 이것"**으로 나눈다.
읽는 사람이 자기 상황을 찾으면 바로 결론에 도달한다.
그리고 ②에서 기준을 먼저 밝히는 게 "돈 받고 쓴 글"이라는 의심을 지운다.

## 스킨 — 잉크 + 형광펜 (12개 중 유일한 모노크롬)

**색으로 강조하지 않는다.** 링크는 밑줄, 강조는 형광펜 배경.
편집자가 빨간 펜 대신 형광펜을 든 인상 — 마케팅 톤을 지우고 "판정"의 톤을 만든다.

```yaml
ground:    "#F4F3EF"   # 종이
surface:   "#FFFFFF"
ink:       "#131418"   # 거의 검정 (중립)
ink-2:     "#34363D"
muted:     "#62656E"
accent:    "#2E2F36"   # 링크·라벨도 잉크색. 밑줄로 구분한다
highlight: "#EFD34A"   # 형광펜 — 배경으로만 쓴다. 글자색으로 쓰지 않는다
pass:      "#2C6B49"   # 표의 O
fail:      "#98342B"   # 표의 X
line:      "#E0DED7"
```

| 요소 | 값 |
|---|---|
| 제목 글꼴 | **Newsreader** 600 — 편집형 세리프 |
| 본문 글꼴 | **IBM Plex Sans** 400 / 17px / 행간 1.7 |
| 숫자·가격 | IBM Plex Mono — 요금·한도·커미션율 |
| 모서리 | 4px |
| 이미지 비율 | **16:10** — 앱 스크린샷 |
| 배치 | 목록형. 요약 표가 글 상단에 |

> ⚠️ Inter·Space Grotesk·Plus Jakarta Sans 는 쓰지 않는다.
> AI 생성 UI 가 전부 이 폰트로 수렴해서 티가 난다(impeccable 이 잡는다).

**이 주제만의 요소**
- **판정 카드**: 도구 하나당 `가장 좋은 점 / 가장 나쁜 점 / 가격 / 이런 사람에게`
- **비교 표**: 기능 O/X 를 초록·빨강으로. 색맹 대비로 기호도 함께
- **가격 함정 박스**: 무료 한도, 연간 결제 강제, 해지 조건 — 공식 사이트가 안 쓰는 것

## 카테고리

| 이름 | 슬러그 | 다루는 것 |
|---|---|---|
| Writing | `writing` | 글쓰기·카피 |
| Image & Video | `visual` | 이미지·영상 생성 |
| Coding | `coding` | 코딩 보조 |
| Automation | `automation` | 워크플로·에이전트 |
| Comparisons | `vs` | A vs B 정면 비교 |
| Guides | `guides` | 고르는 법·가격 정리 |

## 첫 12편

**비교부터 시작한다.** 디렉터리를 흉내 내지 않는다.

1. Jasper vs Copy.ai — which one actually keeps your voice
2. The 6 best AI writing tools for long-form content
3. ChatGPT Plus vs Claude Pro — what you give up either way
4. Midjourney vs Flux — cost per usable image
5. The real price of "free" AI tools (limits nobody reads)
6. Best AI coding assistants for solo developers
7. Notion AI vs standalone tools — is bundling worth it
8. How to cancel AI subscriptions without losing your data
9. The 5 best AI tools for small teams under $50/month
10. AI detectors: what they actually measure
11. Best free AI tools that stay free
12. What to check before you pay for an annual plan

## 수익 · 주의

- **반복 커미션이 본체다.** 20~30% 구독 커미션이 애드센스보다 크다. 애드센스는 보조
- **제휴 표기 필수.** 미국 FTC 는 제휴 관계 공개를 법으로 요구한다. 글 상단에 명시
- ⚠️ **"돈 받고 쓴 글" 의심이 이 주제의 최대 적이다.** Zapier 가 선정 기준과 무보수 원칙을
  글마다 밝히는 이유가 그것이다. 우리도 같은 자리에 같은 문구를 둔다
- ⚠️ **도구가 자주 죽는다.** 가격·기능이 몇 달마다 바뀐다. 갱신 주기를 분기로 잡고,
  글마다 "확인 시점"을 표기한다(결론 블록의 `basis` 가 이 역할)
- ⚠️ 스크린샷은 각 서비스의 상표다. 비교·리뷰 목적의 인용 범위를 넘지 않는다
