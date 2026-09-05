# 디자인 실측서 — the-edit.co.kr (디에디트)

> **이 문서의 숫자는 전부 브라우저로 열어서 받아 적은 것이다.** 스크린샷을 보고 짐작한 값이 아니다.
> 측정일 2026-08-27. Playwright(Chromium) 로 데스크톱 1440×900 · 모바일 390×844 두 벌.
> 측정 스크립트와 원본 JSON 은 세션 스크래치패드에 있고, 재측정 방법은 맨 아래 §9 에 적어 뒀다.
>
> **왜 다시 쟀나:** `00-build-spec.md` 에는 디자인 항목이 아예 없었고, 벤치마크 사이트를
> "WP + GeneratePress 조합" 이라고 적어 뒀는데 **틀렸다.** 실제로는 자체 제작 테마다.
> 폰트·색·간격·애니메이션 중 실측값이 하나도 없는 상태였다.

---

## 0. 한 줄 결론

**디에디트의 인상은 "색 두 개 + 굵은 프리텐다드 + 딱 두 가지 움직임"으로 만들어져 있다.**
화려해 보이지만 CSS 키프레임 애니메이션은 **로딩 스피너 하나뿐**이고, 나머지는 전부
`transition` 22개와 GSAP 핀 고정 4개로 끝난다. 흉내 내기 어려운 쪽은 그림이 아니라 **여백과 굵기**다.

비유하자면 잘 차려입은 사람이 액세서리를 주렁주렁 단 게 아니라,
**옷 두 벌을 아주 잘 맞춰 입은 것**에 가깝다. 따라 할 때 장식을 늘리면 오히려 멀어진다.

---

## 1. 무엇으로 만들었나 (실측)

| 항목 | 실측값 | 비고 |
|---|---|---|
| CMS | WordPress | `wp-content`, `wp-includes` 경로 확인 |
| 테마 | **`theedit-data` (자체 제작)** | `body.wp-theme-theedit-data`. GeneratePress 아님 |
| 캐시 | WP Rocket 3.21.1 | `<meta name="generator">`, lazyload 17.8.3 동봉 |
| 블록 확장 | Spectra (Ultimate Addons for Gutenberg) 2.19.26 | swiper·isotope·slick 번들 |
| 애니메이션 | **GSAP 3.5.1 + ScrollTrigger** | 테마가 직접 번들 |
| jQuery | 3.5.1(테마) + 3.7.1(WP) **중복 로드** | 따라 하지 말 것 |
| 외부 스크립트 | 3개 (구글 계열) | 애드센스·애널리틱스 |
| CSS 파일 | `<link rel=stylesheet>` **0개** | WP Rocket 이 전부 인라인화 |

**로딩 시간 실측:** 데스크톱 networkidle **14.6초**, 모바일 3.2초.
데스크톱이 느린 건 대표글 이미지가 크고 lazyload 대상이 많아서다. **이건 벤치마크할 대목이 아니다.**

---

## 2. 색 — 두 개로 끝난다

큰 면적을 차지하는 배경색을 전부 세어 봤더니 종류가 이것뿐이었다.

| 역할 | 실측 | HEX | 어디에 |
|---|---|---|---|
| 브랜드 | `rgb(196, 255, 48)` | **`#C4FF30`** | 홈 목록 섹션 바탕 (형광 라임) |
| 바탕 | `rgb(251, 252, 246)` | **`#FBFCF6`** | body·패널·본문. 테마 변수 `--color-light` |
| 먹 | `rgb(0, 0, 0)` | **`#000000`** | 글자 122곳 중 대부분, 푸터 배경, 구분선 |
| 반전 글자 | `rgb(255, 255, 255)` | **`#FFFFFF`** | 이미지 위 글자 10곳 |

**회색 계열이 없다.** `#666` 같은 중간톤을 쓰지 않고, 흐리게 보여야 할 곳은
**글자 굵기(300)** 로 처리한다. 이게 화면이 정돈돼 보이는 가장 큰 이유다.

### 2-1. 글마다 헤더 색이 다르다

측정한 글(`/87752`)의 `.single-header`·`.desc` 배경은 `rgb(158, 183, 88)` 이었다.
브랜드 라임도 아니고 바탕색도 아니다 — **글마다 대표 이미지에 맞춘 색을 따로 넣는다.**

> 우리 파이프에 그대로 옮기려면 대표 이미지에서 대표색을 뽑아 헤더 배경에 넣는 처리가 필요하다.
> **지금은 없다.** 넣을지 말지는 별도 판단 사항이고, 이 문서는 "그쪽은 이렇게 한다"만 기록한다.

---

## 3. 글꼴 — Pretendard 하나

```
@font-face: Pretendard  ·  woff2 + woff  ·  font-display: swap  ·  self-host
로드된 굵기: 300 / 500 / 600 / 700 / 800
computed font-family: "Pretendard, sans-serif"
```

`local("Pretendard Bold")` 를 먼저 시도하고 없으면 내려받는 순서로 걸려 있다.
**구글 폰트 CDN 을 쓰지 않는다** — 파일을 테마 안에 직접 넣었다.

---

## 4. 타이포 실측표

같은 요소를 데스크톱·모바일에서 각각 쟀다. 괄호 안은 line-height.

### 글 페이지 (`/87752`)

| 요소 | 데스크톱 1440 | 모바일 390 | 굵기 | 자간 |
|---|---|---|---|---|
| h1 (글 제목) | **72px** (82.8px) | **36px** (50.4px) | 800 | -0.5px |
| h2 (소제목) | **25px** (37.5px) | 25px (37.5px) — **동일** | 800 | -0.5px |
| p (본문) | **16px** (28px) | 16px (28px) — **동일** | **300** | -0.2px / 모바일 -0.25px |
| strong | 16px (28px) | — | **800** | -0.2px |

**핵심 두 가지.**
1. **본문은 데스크톱·모바일이 완전히 같다** (16/28). 반응형으로 줄이는 건 **제목뿐**이다.
2. 본문 굵기가 **300(Light)** 이다. 강조는 800 으로 점프한다 — 중간(500·600)을 본문에 안 쓴다.
   300↔800 의 격차가 크니까 굳이 색을 안 바꿔도 강조가 보인다.

### 홈

| 요소 | 데스크톱 | 모바일 | 굵기 | 색 |
|---|---|---|---|---|
| 대표글 제목 h2 | **52px** (65px) | **36px** (46.8px) | 800 | `#FFF` |
| 카드 제목 (`h3.title`) | **28.8px** (36px) | — | **800** | `#000` · 자간 **-1px** |
| body 기본 | 16px (24px) | 16px (24px) | 500 | `#000` |

> ⚠️ **정정(2026-08-27, measure5).** 처음엔 카드 제목을 `40px / 60px / 700` 이라고 적었다. **틀렸다.**
> 1차에서 `querySelectorAll('a')` 의 첫 링크를 잰 건데, 그게 카드가 아니라 **대표글 제목 링크**였다.
> 정확한 선택자(`.loop h3.title`)로 다시 재서 위 값으로 바로잡았다.
> **교훈: "첫 번째로 찾아지는 요소"를 재면 엉뚱한 걸 잰다. 선택자를 확인하고 재라.**

---

## 5. 레이아웃 실측

### 5-0. 카드 그리드 — 2열 지그재그 (measure5 실측)

1차에서 **카드 목록을 세로 한 줄로 잘못 봤다.** 실제는 이렇다.

```
1440 폭 기준 · 카드 x 좌표 = 29 / 373 │ 749 / 1093

 29        373            749       1093
 ├─318─┤26├─318─┤   58   ├─318─┤26├─318─┤     ← 4열, 거터 26, 중앙 58, 바깥 29
   y=64                    y=64      y=192     ← 둘째 열이 128px 아래로 엇갈린다
   y=689                   y=689     y=817     ← 같은 열 세로 간격 48
```

| 항목 | 실측 |
|---|---|
| 카드 폭 | **318px** (고정) |
| 카드 전체 높이 | **577px** (이미지 397 + 글 180) |
| 이미지 프레임 | **318 × 397** (비율 0.801) |
| 열 사이 거터 | **26px** |
| 같은 열 세로 간격 | **48px** |
| 둘째 열 엇갈림 | **128px** 아래로 |
| 중앙 간격(좌/우 반쪽 사이) | 58px |
| 바깥 여백 | 29px |

**열마다 DOM 컨테이너가 따로 있다**(`div.home-list-scroll-list-mid`, 폭 318, `display:block`).
CSS Grid 로 짜고 짝수 항목에 `margin-top` 을 주는 방식은 **안 된다** — 행 높이가 같이 밀려서
같은 열 간격이 48 이 아니라 176 이 된다. (목업에서 실제로 겪고 고쳤다.)

### 글 페이지

| 항목 | 데스크톱 1440 | 모바일 390 |
|---|---|---|
| 본문 컬럼 폭 | **800px 고정** (x=320, 중앙) | **390px 전폭** (x=0) |
| 본문 이미지 폭 | **800px** — 컬럼 꽉 채움 | **390px** — 화면 꽉 채움 |
| 문단 사이 간격 | **30px** | — |
| 좌우 패딩 | 0px (컬럼 자체가 800) | 0px |
| 가로 스크롤 | 없음 | **없음** (scrollWidth 390 = clientWidth) |

컬럼이 `max-width` 가 아니라 **800px 고정**이다. `--h-gutter: 3.3vw` 라는 변수가 따로 있어
바깥 여백은 뷰포트 비례, 안쪽 본문은 고정폭인 구조다.

### 헤더 / 푸터

| 항목 | 데스크톱 | 모바일 |
|---|---|---|
| 헤더 높이 | **130px** | **80px** |
| 헤더 position | `fixed` | `fixed` |
| 헤더 배경 | **투명** (`rgba(0,0,0,0)`) | 투명 |
| 헤더 그림자·테두리 | **없음** (`none`) | 없음 |
| 푸터 배경 | `#000` | — |
| 푸터 상하 패딩 | 32px | — |

헤더가 투명하고 그림자도 없다. 배경 위에 로고와 햄버거만 떠 있는 형태다.

### 테마가 선언한 간격 변수

```css
--v-spacing:  10vh    /* 세로 간격의 기준 — 화면 높이의 10% */
--h-gutter:   3.3vw   /* 좌우 여백의 기준 */
--color-light:#fbfcf6
--vh / --vw / --doc-height   /* JS 가 실제 뷰포트를 재서 넣는 값 */
```

**세로 간격이 px 가 아니라 `10vh`** 다. 큰 화면에서는 여백이 같이 커진다.

### 5-2. 카테고리 목록 페이지는 홈과 **그리드가 다르다** (measure6)

`/category/tech` 실측. 홈의 2열 지그재그가 아니라 **가지런한 4열**이다.

| 항목 | 홈 | 카테고리 목록 |
|---|---|---|
| 열 | 2열 × 좌우 반쪽 (지그재그) | **4열, 엇갈림 없음** |
| 카드 폭 | 318px | **306px** |
| 거터 | 26px | **24px** |
| 열 x좌표 | 29 / 373 │ 749 / 1093 | **72 / 402 / 732 / 1062** |
| 첫 행 y | 64 (열마다 엇갈림) | **415 (네 열 모두 같음)** |
| 행 간격 | 48px (같은 열) | 610px (카드 높이 포함) |

- **h1 이 있다**: `TECH` · **64px / 96px / 800 / -0.5px / uppercase / 검정**
  (홈은 h1 이 0개인데 카테고리 페이지엔 1개다)
- 한 페이지 **20장** + 페이지네이션 있음
- 바탕색은 홈과 같은 `#FBFCF6`
- ⚠️ **meta description 이 없다**(`null`), 이미지 alt 는 **44개 중 2개**

> 목록 페이지는 홈보다 훨씬 평범하다. **화려한 건 홈뿐이고, 나머지는 정직한 격자다.**
> 따라 만들 때 전 페이지에 지그재그를 깔 필요가 없다는 뜻이다.

### 5-3. 카드 배지 · 대표글 머리말 · 작성자 · 푸터 (measure6)

**배지와 머리말은 서로 다른 요소다.** 같은 텍스트(EAT/LIFE…)가 두 자리에 나와서
measure5 가 이걸 헷갈렸다(부모 앵커를 집었다).

| 요소 | 실측 |
|---|---|
| **카드 배지** (`h5`, 이미지 위) | **18px / 18px / 800 / 자간 1px / 흰색** · **배경 없음** · 패딩 0 · 그림자 없음 |
| 배지 위치 | 이미지 상자 기준 **left 16px · bottom 16px** (이미지 318×397, `overflow:hidden`) |
| **대표글 머리말** (`h4.meta`) | **20px / 30px / 800 / 자간 1px / 흰색** |
| 작성자 (`a.author`) | 60 × 80 박스 · 16px / 24px / 500 / 검정 · **모서리 둥글기 0** |
| 푸터 | 배경 `#000` · 패딩 **32px 48px** · 높이 64px |
| 푸터 링크 | **18px / 31.5px / 800 / -0.2px / 흰색 / uppercase** · 8개 |

**배지에 배경 상자가 없다.** 반투명 알약도, 그림자도 없이 흰 글자만 이미지 위에 얹는다.
사진이 밝으면 안 보일 텐데도 그렇게 쓴다 — 대표 이미지를 어두운 걸로 고르는 편집 규칙이 있는 셈이다.

> 목업은 배지를 `left:16 bottom:14` + `text-shadow` 로 짐작해 만들었었다.
> 위치는 **bottom 이 14 가 아니라 16**, 그리고 **그림자는 원본에 없다.** 아래 §8·§9-1 에 반영했다.

---

## 6. 애니메이션 — 실제로 굴려서 잰 것

CSS 에 적힌 것만 세면 `transition` **22개**, `@keyframes` **1개**(스와이퍼 로딩 스피너뿐),
`animation` 2개(그 스피너). **즉 키프레임 애니메이션은 사실상 없다.**
움직임은 아래 다섯 개가 전부다.

### ① 헤더 숨김/복귀 — 스크롤해서 전후를 쟀다

```
스크롤 0      → position:fixed, top:0px,    class=""
스크롤 800 아래 → position:fixed, top:-130px, class="nav-up"     ← 위로 숨는다
다시 맨 위     → position:fixed, top:0px,   class="nav-down"

transition: top 0.2s ease-in-out
```

`transform` 이 아니라 **`top` 을 움직인다.** 숨는 거리 = 헤더 높이(130px)와 정확히 같다.

### ② 카드 이미지 hover — 진짜 마우스를 올려서 쟀다

```
전: transform none            박스 318 × 397
후: matrix(1.09933, 0.0383894, -0.0383894, 1.09933, 0, 0)   박스 365 × 449
    → scale 1.10  +  rotate 2.0°

transition: width, height, transform 0.7s
```

**여기가 이 사이트의 서명이다.** 확대만 하는 게 아니라 **2도 기울인다.**
0.7초는 요즘 기준으로 **느린 편**이고, 그 느림이 고급스러움을 만든다.

> 스크린샷으로는 절대 알 수 없는 값이다. 2도·0.7초 — 이 두 개가 인상을 만든다.

#### ⚠️ 정정 — "박스도 같이 커진다"는 틀렸다 (2026-08-27, measure5)

처음엔 `img` 의 rect 가 318×397 → 365×449 로 읽히는 걸 보고
**"width/height 도 같이 커져서 옆 카드를 밀어낸다"**고 적었다. **둘 다 틀렸다.**

`getBoundingClientRect()` 는 **transform 이 적용된 뒤의 경계상자**를 돌려준다.
scale 1.1 + rotate 2° 를 넣고 계산하면 커진 값이 정확히 나온다.

```
w' = 318 × 1.1 × cos2° + 397 × 1.1 × sin2° = 349.6 + 15.2 = 364.8  ≈ 365 ✓
h' = 318 × 1.1 × sin2° + 397 × 1.1 × cos2° =  12.2 + 436.4 = 448.6 ≈ 449 ✓
```

**즉 365×449 는 전부 transform 으로 설명된다. width/height 는 실제로 변하지 않는다.**
`transition` 목록에 적혀 있을 뿐 아무 일도 안 하는 값이었다.

밀기 여부도 직접 쟀다 — hover 전후로 목록 전체 높이와 다음 카드 위치를 찍었다.

```
전: 목록높이 1378 · 다음카드 top 689 · img rect 318×397
후: 목록높이 1378 · 다음카드 top 689 · img rect 365×449
→ 레이아웃 불변. 형제를 밀지 않는다. 부모(a.image, 318×397 고정)가 자른다.
```

**교훈 두 가지.**
1. `getBoundingClientRect` 로 크기를 잴 때는 **transform 이 걸려 있는지 먼저 본다.**
   안 그러면 안 일어난 일을 봤다고 적게 된다.
2. "커졌다"와 "레이아웃이 변했다"는 다른 말이다. **레이아웃 변화는 이웃을 재서 확인한다.**

결과적으로 **목업의 `transform` 전용 구현이 근사가 아니라 정확한 재현**이다.
그리고 `transition` 에서 width/height 를 빼는 게 원본과 다른 게 아니라 **원본과 같다.**

### ③ 대표글(`.loop-home-featured`) 반응

```css
.loop-home-featured .image img              → width, height 0.5s
.loop-home-featured .desc h2, .desc p       → color 0.3s
.loop-home-featured .desc .title h2 a       → color 0.2s
.loop-home-featured::after                  → opacity 0.4s, transform 0.4s cubic-bezier(.165,.84,.44,1)
.loop-home-featured .desc .title h2 a:hover → text-decoration: underline
.loop .desc .header h3                      → color 0.5s
```

`cubic-bezier(0.165, 0.84, 0.44, 1)` 은 **처음에 확 나가고 끝에서 부드럽게 멎는** 곡선이다.

### ④ 햄버거 패널 — 실제로 클릭해서 쟀다

```
닫힘: transform: translateX(734.391px)   (화면 밖 오른쪽)
열림: transform: translateX(0)            body 에 class="open" 추가
폭: 734.391px  = 뷰포트 1440 의 51%
배경: #FBFCF6   z-index: 9999
transition: transform 0.5s
```

오른쪽에서 **화면의 절반**을 덮으며 들어온다. 전체를 덮지 않는다.

### ⑤ GSAP ScrollTrigger — 라이브러리에 직접 물어봤다

```
ScrollTrigger.getAll() → 4개, 전부 trigger = DIV.loop-home-featured
  #1 start   -0.001  end   478   pin:true  scrub:true
  #2 start 1378      end  1856   pin:true  scrub:true
  #3 start 2756      end  3234   pin:true  scrub:true
  #4 start 2756      end  3234   pin:true  scrub:true   ← 중복 등록으로 보인다
```

**대표글이 화면에 핀으로 고정된 채 478px 만큼 스크롤이 흐른다.** 왼쪽 큰 이미지는 멈춰 있고
오른쪽 목록만 올라가는 그 느낌이 여기서 나온다.

> #3 과 #4 가 구간까지 완전히 같다 — **중복 등록된 버그로 보인다.** 따라 할 때 같이 베끼지 말 것.

#### ⭐ 정정 — `scrub` 은 시각 효과를 만들지 않는다. sticky 로 충분하다

처음엔 "`scrub: true` 라 스크롤에 1:1로 붙어 **움직인다**" 고 적고, §8·§10 에도
"sticky 로는 같아지지 않는다" 고 써 뒀다. **틀렸다.** 스크롤 구간마다 실제 값을 찍어 봤다.

```
scrollY    0 : position:fixed    top:0    transform: 없음        opacity 1   ← 핀 걸림
scrollY  600 : position:relative          translateY(478.001px)  opacity 1   ← 풀림
scrollY 1400 : (다음 대표글) position:fixed top:0                 opacity 1   ← 다음 핀
scrollY 2200 : position:relative          translateY(478px)      opacity 1
```

**opacity 는 처음부터 끝까지 1이고, transform 은 순수 세로 이동뿐이다.**
확대도 페이드도 시차(parallax)도 없다. 저 `fixed` ↔ `translateY(핀 거리)` 전환은
**GSAP 이 핀을 구현하는 방식 그 자체**다 — 고정할 땐 `fixed` 로 띄우고,
풀 때는 그동안 흘러간 만큼 `translateY` 로 밀어 제자리에 앉힌다.

`scrub: true` 는 "핀 진행도를 스크롤에 물린다"는 뜻이지, 무언가를 애니메이션한다는 뜻이 아니었다.
**그래서 `position: sticky` 는 근사가 아니라 같은 결과다.** GSAP 을 들일 이유가 없다.

> 교훈: 라이브러리 옵션 이름(`scrub`)에서 동작을 유추하지 말 것.
> **구간마다 값을 찍어 보면 3분이면 끝난다.**

### ⑥ 링크 hover (기본)

```css
a:hover { color: #000; text-decoration: none; }   /* 이미지 위 흰 글자 → 검정 */
transition: color 0.2s
```

---

## 7. SEO 실측 — 우리 체크리스트와 대조

`00-build-spec.md` §1 의 15개 항목을 벤치마크에 그대로 적용해 봤다.
**벤치마크가 우리 기준을 다 지키는 건 아니다.**

| 항목 | the-edit 실측 | 우리 기준 | 판정 |
|---|---|---|---|
| 글 h1 개수 | 1개 | 정확히 1개 | ✅ |
| **홈 h1 개수** | **0개** | 정확히 1개 | ❌ 안 지킴 |
| 글 h2 / h3 | 5개 / **0개** | 건너뛰기 금지 | ⚠️ h3 미사용 |
| **이미지 alt** | 글 5개 중 **1개**, 홈 44개 중 10개 | 전부 | ❌ 안 지킴 |
| canonical | 자기 자신 1개 | 필수 | ✅ |
| meta description | 있음 (부제를 그대로 씀) | 필수 | ✅ |
| **URL 구조** | **`/87752` — 숫자 ID** | `/{category}/{postname}/` | ❌ 정반대 |
| JSON-LD | NewsMediaOrganization, WebSite, ImageObject, BreadcrumbList, WebPage, Person, Article | 권장 | ✅ 충실 |
| 내부링크 | 글당 **52개** | 최소 3개 | ✅ 압도적 |
| 외부링크 | 5개 | — | — |
| 관련 글 블록 | 있음 | 3~6개 | ✅ |
| 저자 블록 | 있음 | 신뢰 신호 | ✅ |
| 공유 버튼 | **없음** | — | — |
| 모바일 가로 스크롤 | 0 | 0 | ✅ |
| 본문 분량 | **4,777자** | — | 참고 |

**여기서 배울 것과 배우지 말 것을 갈라 둔다.**

- **배울 것**: 내부링크 52개, JSON-LD 풀세트, 저자 블록, 관련 글, 모바일 무결
- **배우지 말 것**: 숫자 URL(`/87752`), 이미지 alt 방치, 홈 h1 없음, jQuery 중복, 14.6초 로딩

디에디트는 **브랜드로 들어오는 트래픽**이 크기 때문에 URL·alt 를 방치해도 버틴다.
검색으로 먹고사는 우리 사이트는 그 여유가 없다. **디자인은 따라 하되 SEO 는 따라 하면 안 된다.**

---

## 8. 그대로 옮길 수 있는 값 (복사용)

우리 사이트에 적용할 때 쓸 토큰이다. 위 실측값을 그대로 옮겼다.

```css
:root {
  /* 색 — 브랜드 라임 자리에 각 사이트 색을 넣는다. 나머지는 그대로 */
  --brand:       #C4FF30;   /* 큰 면적 1곳에만 */
  --bg:          #FBFCF6;
  --ink:         #000000;
  --ink-invert:  #FFFFFF;
  /* 회색은 두지 않는다. 흐림은 font-weight 300 으로 만든다 */

  /* 간격 — 세로는 뷰포트 비례, 가로도 비례 */
  --v-spacing:   10vh;
  --h-gutter:    3.3vw;

  /* 본문 */
  --content-w:   800px;     /* 데스크톱 고정폭 */
  --para-gap:    30px;

  /* 카드 그리드 (measure5) */
  --card-w:      318px;
  --card-img-h:  397px;     /* 프레임 318×397 — hover 확대를 여기서 자른다 */
  --grid-gutter: 26px;      /* 열 사이 */
  --grid-row-gap:48px;      /* 같은 열 카드 사이 */
  --grid-stagger:128px;     /* 둘째 열이 내려간 거리 */
  --edge:        29px;      /* 바깥 여백 */

  /* 헤더 */
  --header-h:        130px;
  --header-h-mobile: 80px;

  /* 움직임 */
  --ease-out:    cubic-bezier(0.165, 0.84, 0.44, 1);
  --t-fast:      0.2s;   /* 색·헤더 */
  --t-mid:       0.5s;   /* 패널·대표글 이미지 */
  --t-slow:      0.7s;   /* 카드 hover */
}

body { font-family: Pretendard, sans-serif; background: var(--bg); color: var(--ink); }

/* 본문 — 데스크톱·모바일 동일. 반응형으로 줄이는 건 제목뿐 */
.entry-content p { font-size: 16px; line-height: 28px; font-weight: 300; letter-spacing: -0.2px; }
.entry-content p + p { margin-top: var(--para-gap); }
.entry-content strong { font-weight: 800; }   /* 색을 바꾸지 않는다 */

h1 { font-size: 72px; line-height: 82.8px; font-weight: 800; letter-spacing: -0.5px; }
h2 { font-size: 25px; line-height: 37.5px; font-weight: 800; letter-spacing: -0.5px; }
@media (max-width: 768px) {
  h1 { font-size: 36px; line-height: 50.4px; }
  /* h2·본문은 그대로 둔다 — 실측상 모바일에서도 동일하다 */
}

/* 헤더 — 스크롤 내리면 숨고 올리면 돌아온다. transform 아니라 top 을 움직인다 */
header { position: fixed; top: 0; height: var(--header-h);
         background: transparent; box-shadow: none; border: 0;
         transition: top var(--t-fast) ease-in-out; }
header.nav-up   { top: calc(-1 * var(--header-h)); }
header.nav-down { top: 0; }

/* 카드 그리드 — 열마다 독립 컨테이너. Grid + margin-top 으로 엇갈림을 주면
   행 높이가 밀려 같은 열 간격이 48 → 176 이 된다(실제로 겪었다). */
.cards { display: flex; gap: var(--grid-gutter); align-items: flex-start; }
.cards .col { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: var(--grid-row-gap); }
.cards .col:nth-child(2) { margin-top: var(--grid-stagger); }

/* 카드 hover — 이 사이트의 서명. 확대(1.10) + 기울임(2deg), 0.7초.
   프레임이 자르므로 레이아웃은 변하지 않는다. 원본 transition 에 적힌
   width·height 는 실제로 변하지 않는 값이라 뺐다 — 원본과 다른 게 아니라 같다. */
.card .thumb { position: relative; overflow: hidden; aspect-ratio: 318/397; }
.card .thumb img { position: absolute; inset: 0; transition: transform var(--t-slow); }
.card:hover .thumb img { transform: scale(1.10) rotate(2deg); }

/* 슬라이드 패널 — 화면의 절반만 덮는다 */
.panel { position: fixed; z-index: 9999; width: 51vw; background: var(--bg);
         transform: translateX(100%); transition: transform var(--t-mid); }
body.open .panel { transform: translateX(0); }
```

```css
/* 대표글 핀 — GSAP 없이 sticky 로 같은 결과가 나온다 (§6-⑤ 정정 참고).
   핀 지속 거리(실측 478px)는 sticky 요소를 감싼 **기둥의 여분 높이**로 준다. */
.featured-col { height: calc(100vh + var(--pin-run)); }   /* --pin-run: 478px */
.featured     { position: sticky; top: 0; height: 100vh; }
```

**주의 — 이건 CSS 로 되는 데까지다.** 남은 하나는 §2-1 의 **글별 헤더 색**이다.
그건 스타일이 아니라 발행 파이프가 대표 이미지에서 색을 뽑아 넣어야 하는 일이라
CSS 토큰만으로는 안 된다.

---

## 9. 다시 재는 법

이 문서의 값이 의심되면 짐작하지 말고 다시 재라.
**스크립트 4개와 원본 JSON 을 저장소에 함께 넣어 뒀다** — `docs/site-kit/bench/`.

```bash
# 저장소 루트에서 실행한다.
#   NODE_PATH  — 스크립트가 프로젝트의 playwright 를 찾게 해 준다 (없으면 MODULE_NOT_FOUND)
#   BENCH_OUT  — 스크린샷·JSON 을 여기에 쏟는다. 안 주면 스크립트 옆(=저장소)에 쌓인다
export NODE_PATH="$(pwd)/node_modules"
export BENCH_OUT="/tmp/bench"

node docs/site-kit/bench/measure.js "https://the-edit.co.kr/"   # 대상 URL 을 받는 유일한 스크립트
node docs/site-kit/bench/measure2.js
node docs/site-kit/bench/measure3.js
node docs/site-kit/bench/measure4.js
```

*(2026-08-27 `measure3.js` 로 위 명령이 그대로 도는 것과, 저장소에 산출물이 안 쌓이는 것까지 확인했다.)*

`measure.js` 만 대상 URL 을 인자로 받는다 — **다른 사이트를 잴 때는 이걸 쓴다.**
나머지 셋은 the-edit 전용 선택자가 박혀 있다(대상이 바뀌면 선택자를 고쳐야 한다).

| 스크립트 | 재는 것 | 산출물 |
|---|---|---|
| `measure.js` | 테마·폰트·타이포·레이아웃·transition 전수·헤더 스크롤·hover 규칙 (데스크톱+모바일) | `report.json`, 스크린샷 4장 |
| `measure2.js` | GSAP ScrollTrigger 목록·햄버거 패널·카드 hover 실제 전후 | `report2.json`, `panel-open.png` |
| `measure3.js` | 글 페이지 본문 타이포·컬럼폭·문단간격·JSON-LD·링크 수 | `report3.json`, 글 스크린샷 3장 |
| `measure4.js` | 색 팔레트 전수·CSS 변수·모바일 글 페이지 | `report4.json`, `article-mobile.png` |

`report*.json` 은 **이번 측정의 원본**이라 그대로 커밋해 뒀다. 이 문서의 표와 대조해 볼 수 있다.
(스크린샷은 용량이 커서 저장소에 넣지 않았다 — 재측정하면 다시 나온다.)

**측정 원칙 — 이 문서가 지킨 것.**
1. hover 는 합성 이벤트로는 안 걸린다. **진짜 `hover()` 를 호출**하고 전후 computed 값을 비교했다.
2. GSAP 같은 JS 애니메이션은 CSS 에 안 나온다. **`ScrollTrigger.getAll()` 로 라이브러리에 직접 물었다.**
3. 헤더 스크롤 반응은 **실제로 800px 내렸다가 다시 올려서** 세 시점을 찍었다.
4. 색은 "연두색"이라 적지 않고 **면적 400px² 이상 요소의 배경색을 전수로 세어** 빈도순으로 뽑았다.
5. 못 잰 건 못 잰 대로 적었다 — §8 끝의 GSAP 핀, §2-1 의 글별 헤더 색.

---

## 9-1. 목업 — 이 숫자가 실제로 어떻게 보이는가

`docs/site-kit/mockup/tokens-mockup.html` 를 브라우저로 열면 §8 토큰이 적용된 화면이 나온다.
홈(대표글 + 카드 목록)과 글 페이지를 한 장에 담았다. 왼쪽 아래 버튼 두 개:

- **ⓘ 실측값 표시** — 각 요소 옆에 "이 값은 어디서 나왔는지"가 뜬다
- **📱 모바일 폭** — 390px 폭으로 좁혀서 본다

**저쪽 브랜드는 하나도 쓰지 않았다.** 로고·이름·글은 전부 플레이스홀더다.
따라 만든 건 *숫자*지 *그 사이트*가 아니다.

#### 색은 일부러 바꿨다 — AI 블로그용 전기 보라

구조(색 2개 + 흑백, 회색 없음, 굵기로 위계)는 실측 그대로 두고 **색상만** 교체했다.

| 역할 | the-edit 실측 | 우리 AI 블로그 |
|---|---|---|
| 브랜드 | `#C4FF30` 형광 라임 | **`#5B4BFF` 전기 보라** |
| 바탕 | `#FBFCF6` | **`#F6F5FB`** |
| 먹 | `#000000` | **`#0B0A1A`** |
| 반전 | `#FFFFFF` | `#FFFFFF` |

**지켜야 하는 건 색이 아니라 규칙이다.** 검증에도 값이 아니라 규칙으로 넣었다 —
"회색 글자 0개", "브랜드가 큰 면적으로 쓰인 곳 1~4곳". 색을 또 바꿔도 이 검사는 그대로 쓴다.

### 목업이 실측값대로 그려지는지 검증했다

눈으로 "비슷하다" 하지 않고, 목업을 다시 브라우저로 열어 the-edit 실측값과 1:1 대조했다.

```bash
NODE_PATH="$(pwd)/node_modules" BENCH_OUT=/tmp/bench \
  node docs/site-kit/bench/verify-mockup.js docs/site-kit/mockup/tokens-mockup.html
```

**2026-08-27 결과: 45개 항목 전부 일치, 불일치 0건.** 확인한 것 중 중요한 것들:

| 항목 | the-edit 실측 | 목업 |
|---|---|---|
| 글 h1 | 72px / 82.8px / 800 / -0.5px | 동일 ✅ |
| 글 h2 · 본문 | 25/37.5/800 · 16/28/300/-0.2px | 동일 ✅ |
| **카드 제목** | **28.8px / 36px / 800 / -1px** | 동일 ✅ |
| 본문 컬럼 · 문단 간격 | 800px · 30px | 동일 ✅ |
| **카드 그리드** | **폭 318 · 거터 26 · 세로 48 · 엇갈림 128** | 동일 ✅ |
| 카드 이미지 프레임 | 318 × 397 | 동일 ✅ |
| 카드 hover | scale 1.100 / rotate 2.0° / 0.7s | 동일 ✅ |
| **hover 가 형제를 밀지 않음** | 레이아웃 불변 | 동일 ✅ |
| 헤더 | 130px · fixed · 투명 · 그림자 0 | 동일 ✅ |
| 헤더 스크롤 | ↓ `-130px`(nav-up) / ↑ `0px`(nav-down) | 동일 ✅ |
| 패널 | 폭 734px(51vw) / 열림 x=706 / 클릭으로 닫힘 | 동일 ✅ |
| **카테고리 그리드** | **4열 · 306 · 거터 24 · 첫 열 x=72 · 엇갈림 없음** | 동일 ✅ |
| **카테고리 h1** | **64/96/800/uppercase · 1개** | 동일 ✅ |
| **배지** | **left16 bottom16 · 18/18/800/1px · 그림자·배경 없음** | 동일 ✅ |
| **핀 지속 거리** | **478px** | 동일 ✅ |
| **글 헤더 색** | 글마다 다른 자리 (브랜드색이 아님) | `--post-accent` 로 분리 ✅ |
| 모바일 | h1 36/50.4 · **h2·본문은 안 줄임** · 1열 · 가로스크롤 0 | 동일 ✅ |
| [규칙] 회색 글자 | 0개 (흐림은 weight 300 으로) | 동일 ✅ |
| [규칙] 한쪽만 두른 액센트 바 | 0개 | 동일 ✅ |

### 검사를 세 번 고쳤다 — 거짓 실패를 내는 검사는 검사가 아니다

1. 기댓값을 `top:-130px` 라고 적었는데 출력은 `-130px` — **문자열만 안 맞았다.** 비교식을 고쳤다.
2. 문단 간격을 `.single-content > p` 순서대로 쟀더니 사이에 `figure`·`h2` 가 낀 쌍까지 재서
   `710` 이 나왔다. **인접한 `p + p` 만** 재도록 고쳤다.
3. 카드 열을 DOM 순서로 묶었더니 열 구조를 바꾼 뒤 엉뚱한 값이 나왔다. **x 좌표로 묶도록** 고쳤다.

반대로 **진짜 결함 2건은 검사가 잡아냈다** — 같은 열 세로 간격 48→176(Grid margin-top 문제),
그리고 패널이 헤더를 덮어 **닫기 버튼이 사라진 것**(그래서 클릭 테스트를 항목으로 추가했다).

---

## 10. 지금 상태 (착각 방지)

### 실측으로 확정된 것 — 목업이 45항목으로 이걸 지킨다

| 항목 | 근거 |
|---|---|
| 색 4개 · 타이포 전체 · 본문 컬럼 800 · 문단 30 | §2 §4 §5 (measure1·3·4) |
| 홈 카드 그리드 — 폭 318 · 거터 26 · 세로 48 · 엇갈림 128 | §5-0 (measure5) |
| **카테고리 목록 그리드 — 4열 · 306 · 거터 24 · 엇갈림 없음** | §5-2 (measure6) |
| **배지 — 18/18/800/자간1 · 이미지 기준 left16 bottom16 · 배경·그림자 없음** | §5-3 (measure6) |
| 작성자 60×80 · 푸터 32/48 · 푸터 링크 18/800/uppercase | §5-3 (measure6) |
| 카드 hover — scale 1.10 + rotate 2° · 0.7s · **레이아웃 불변** | §6-② (이웃을 재서 확인) |
| 헤더 숨김/복귀 · 패널 51vw · **핀 478px** | §6-①④⑤ |

### 세 번 틀렸고, 세 번 다 재서 바로잡았다

1. **카드 제목 40px** → 실제 28.8px. 첫 링크를 집는 선택자가 대표글 제목을 잡았다 (§4 정정)
2. **"박스가 커져 옆 카드를 밀어낸다"** → 전부 transform 의 경계상자였다. 레이아웃은 불변 (§6-② 정정)
3. **"scrub 이라 sticky 로는 같아지지 않는다"** → scrub 은 시각 효과가 아니라 핀 구현 방식이었다.
   **sticky 가 정확한 재현이다.** GSAP 불필요 (§6-⑤ 정정)

> 셋 다 **이름이나 인상에서 유추한 것**이 원인이었다(`a` 첫 링크, `getBoundingClientRect`,
> 옵션 이름 `scrub`). 값을 찍어 보면 매번 3분이면 끝났다.

### 아직 안 한 것

- [ ] **토큰을 실제 사이트 테마에 반영** — 목업까지만 나왔다.
      운영 중인 사이트 CSS 를 되돌리기 어렵게 건드리는 일이라 **대상 사이트를 정한 뒤**에 한다.
      (이 문서의 원칙도 "기존 사이트는 바꾸지 않는다" 다 — `00-build-spec.md` §6-1)
- [ ] **글별 헤더 색 추출** — 목업은 `--post-accent` 라는 **빈칸**으로 자리만 잡아 뒀다.
      실제로 채우려면 발행 파이프가 대표 이미지에서 대표색을 뽑아야 한다. 그 기능은 **없다.**
- [ ] **검색 결과 페이지**는 안 쟀다 (홈·글·카테고리 세 장만 쟀다)
- [ ] 태그 페이지·작성자 페이지도 안 쟀다
