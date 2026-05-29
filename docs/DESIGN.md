# 디자인 시스템 — LEADERNAM Orbit / Tistory

> 본 앱(blogger-gpt-cli)에서 사용 중인 **색상·타이포·컴포넌트** 정리. 티스토리 앱도 동일한 디자인 언어를 유지하면 사용자 학습 비용 없음.
> 
> 디자인 토큰을 그대로 가져가되, **포인트 색상만 티스토리 오렌지로 교체** 권장.

---

## 1. 색상 팔레트

### 1.1 브랜드 색상

```css
/* 메인 브랜드 — Indigo + Purple 그라데이션 (LEADERNAM Orbit) */
--brand-primary:        #6366f1;   /* indigo-500 */
--brand-primary-hover:  #4f46e5;   /* indigo-600 */
--brand-secondary:      #8b5cf6;   /* violet-500 */
--brand-gradient:       linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
--brand-gradient-light: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* 🆕 티스토리용 — 오렌지 톤 (티스토리 공식 컬러 참고) */
--tistory-primary:      #f97316;   /* orange-500 */
--tistory-primary-hover:#ea580c;   /* orange-600 */
--tistory-gradient:     linear-gradient(135deg, #f97316 0%, #ea580c 100%);
```

### 1.2 시맨틱 색상 (변경 없이 유지)

```css
/* 성공 / 정상 */
--success:        #10b981;   /* emerald-500 */
--success-hover:  #059669;   /* emerald-600 */
--success-light:  #34d399;   /* emerald-400 */
--success-pale:   #6ee7b7;   /* emerald-300 */
--success-gradient: linear-gradient(135deg, #10b981 0%, #059669 100%);

/* 경고 */
--warning:        #fbbf24;   /* amber-400 */
--warning-hover:  #f59e0b;   /* amber-500 */
--warning-pale:   #fde68a;   /* amber-200 */

/* 위험 / 에러 */
--danger:         #ef4444;   /* red-500 */
--danger-hover:   #dc2626;   /* red-600 */
--danger-pale:    #fca5a5;   /* red-300 */
--danger-light:   #fecaca;   /* red-200 */

/* 정보 */
--info:           #3b82f6;   /* blue-500 */
--info-pale:      #93c5fd;   /* blue-300 */
--info-light:     #dbeafe;   /* blue-100 */
```

### 1.3 중성 색상 (다크 테마 기반)

```css
/* 다크 배경 — 그라데이션 베이스 */
--bg-deep:        #0f172a;   /* slate-900 (가장 어두운) */
--bg-dark:        #1e293b;   /* slate-800 */
--bg-medium:      #334155;   /* slate-700 */

/* 라이트 영역 (모달 내부 등) */
--bg-light:       #f9fafb;   /* gray-50 */
--bg-card:        #ffffff;
--border-light:   #e5e7eb;   /* gray-200 */

/* 텍스트 */
--text-dark:      #1e293b;   /* 라이트 배경 위 */
--text-medium:    #374151;   /* gray-700 */
--text-muted:     #64748b;   /* slate-500 */
--text-light:     #94a3b8;   /* slate-400 */
--text-on-dark:   rgba(255, 255, 255, 0.9);
--text-on-dark-muted: rgba(255, 255, 255, 0.6);
--text-on-dark-faint: rgba(255, 255, 255, 0.4);
```

### 1.4 사용 빈도 통계 (실측)

본 앱 HTML에서 가장 많이 쓰인 색상 (참고):

| 색상 | 사용 횟수 | 용도 |
|---|---|---|
| `#1e293b` (slate-800) | 49 | 다크 배경, 텍스트(라이트 배경) |
| `#10b981` (emerald-500) | 37 | 성공/완료 표시 |
| `#ef4444` (red-500) | 30 | 위험/삭제/에러 |
| `#fbbf24` (amber-400) | 25 | 경고/하이라이트 |
| `#e5e7eb` (gray-200) | 23 | 보더, 구분선 |
| `#ffffff` | 22 | 카드 배경 (라이트) |
| `#3b82f6` (blue-500) | 19 | 정보, 링크 |
| `#667eea`, `#764ba2` | 17 | 브랜드 그라데이션 |
| `#6366f1` (indigo-500) | 16 | 브랜드 primary |

---

## 2. 타이포그래피

### 2.1 폰트 패밀리

```css
/* 시스템 폰트 우선 — 한글은 본고딕/맑은 고딕, 영문은 SF/Segoe */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI',
             'Apple SD Gothic Neo', 'Malgun Gothic', '맑은 고딕',
             Roboto, sans-serif;
```

코드/JSON 영역:
```css
font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace;
```

### 2.2 폰트 크기 스케일

| 토큰 | px | 용도 |
|---|---|---|
| `--text-xs` | 10px | 배지, 라벨 |
| `--text-sm` | 11~12px | 보조 설명, hint |
| `--text-base` | 13~14px | 본문, 입력 필드 |
| `--text-lg` | 15~16px | 강조 본문, 라벨 |
| `--text-xl` | 18~20px | 카드 헤더 |
| `--text-2xl` | 22~24px | 모달 헤더, 섹션 타이틀 |
| `--text-3xl` | 32px | 페이지 헤더 |
| `--text-4xl` | 48px | 성공 오버레이 (v3.5.93) |
| `--text-5xl` | 80~100px | 이모지 강조 (이모지 자체) |

### 2.3 폰트 굵기

| 굵기 | 용도 |
|---|---|
| `400` (regular) | 보조 설명 텍스트 |
| `500~600` (medium) | 일반 본문, 라벨 |
| `700` (bold) | 버튼, 강조 |
| `800` (extra-bold) | 카드 헤더, 모달 헤더 |
| `900` (black) | 성공 오버레이 "발행 완료!" 같은 최대 강조 |

### 2.4 자간 (letter-spacing)

- 본문: 기본 (0)
- 큰 헤더 (24px+): `-0.3px ~ -1px` (살짝 좁게)

---

## 3. 공통 컴포넌트

### 3.1 카드 (Card)

```css
.card {
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 24px;
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}
```

### 3.2 1차 버튼 (Primary)

```css
.btn-primary {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  border: none;
  padding: 14px 24px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.3);
  transition: all 0.2s ease;
}
.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4); }
```

🆕 **티스토리용 1차 버튼** (오렌지):
```css
.btn-tistory {
  background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
  /* 나머지 동일 */
}
```

### 3.3 2차 버튼 (Outline)

```css
.btn-secondary {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
  border: 2px solid rgba(255, 255, 255, 0.15);
  padding: 12px 20px;
  border-radius: 12px;
  font-weight: 600;
}
```

### 3.4 위험 버튼 (Destructive)

```css
.btn-danger {
  background: rgba(239, 68, 68, 0.9);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
  padding: 10px 24px;
  border-radius: 10px;
  font-weight: 700;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}
```

→ v3.5.93의 **🛑 작업 중지** 버튼이 이 패턴.

### 3.5 입력 필드

```css
.form-input {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: white;
  padding: 14px 16px;
  border-radius: 10px;
  font-size: 14px;
  transition: all 0.3s;
}
.form-input:focus {
  border-color: rgba(99, 102, 241, 0.5);
  background: rgba(0, 0, 0, 0.4);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}
```

### 3.6 select (드롭다운)

```css
select.form-input {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(51, 65, 85, 0.95) 100%);
  border: 2px solid rgba(255, 255, 255, 0.6);
  color: #ffffff;
  font-weight: 600;
  padding: 12px 16px;
  border-radius: 12px;
  cursor: pointer;
}

/* 그룹 구분 (optgroup 대신 disabled option 사용 — v3.5.90) */
select option[disabled] {
  color: #fbbf24;
  background: #0f172a;
  font-weight: 800;
}
```

> ⚠️ `<optgroup>`은 OS native dropdown에서 색상 inline style이 무시됨. **disabled option 구분자 패턴 사용**.

### 3.7 라디오 (카드형)

```css
.radio-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background: rgba(139, 92, 246, 0.2);
  border-radius: 8px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.3s ease;
}
.radio-card input[type="radio"] {
  width: 16px; height: 16px;
  accent-color: #10b981;
}
.radio-card:has(input:checked) {
  border-color: rgba(16, 185, 129, 0.5);
  background: rgba(16, 185, 129, 0.15);
}
```

### 3.8 체크박스 (토글형)

```css
.toggle-checkbox {
  width: 18px; height: 18px;
  accent-color: #f59e0b;
  cursor: pointer;
}
```

### 3.9 모달 (Overlay + Dialog)

```css
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(16px);
  z-index: 1000;
  display: flex; align-items: center; justify-content: center;
}

.modal-dialog {
  width: 95%; max-width: 900px; max-height: 90vh;
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5), 0 0 40px rgba(99, 102, 241, 0.15);
  overflow: hidden;
  display: flex; flex-direction: column;
}
```

### 3.10 토스트 / 알림

```css
/* 작은 토스트 (4초) */
.toast {
  position: fixed; top: 20px; right: 20px;
  background: rgba(16, 185, 129, 0.9);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  z-index: 9999;
}

/* 전체화면 성공 오버레이 (v3.5.93) */
.success-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  z-index: 10001;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.success-overlay-content {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-radius: 24px;
  padding: 60px 80px;
  text-align: center;
  box-shadow: 0 30px 80px rgba(16, 185, 129, 0.5);
  max-width: 600px;
}
.success-overlay h1 {
  color: white;
  font-size: 48px;
  font-weight: 900;
  letter-spacing: -1px;
}
```

### 3.11 배지 (Pill)

```css
.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
}
.badge-primary { background: rgba(99, 102, 241, 0.2); color: #c4b5fd; }
.badge-success { background: rgba(16, 185, 129, 0.4); color: #d1fae5; }
.badge-warning { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
.badge-danger  { background: rgba(239, 68, 68, 0.25); color: #fecaca; }
```

---

## 4. 그라데이션 카탈로그

본 앱에서 자주 쓰이는 그라데이션:

| 이름 | 코드 | 용도 |
|---|---|---|
| 브랜드 메인 | `linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)` | 1차 버튼, 모달 헤더 |
| 브랜드 라이트 | `linear-gradient(135deg, #667eea 0%, #764ba2 100%)` | 모달 배경, 진행 모달 |
| 성공 | `linear-gradient(135deg, #10b981 0%, #059669 100%)` | 성공 오버레이, 라이선스 활성 |
| 다크 | `linear-gradient(135deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.95) 100%)` | 모달 내부 카드 |
| 모달 배경 | `linear-gradient(135deg, rgba(30,41,59,0.95) 0%, rgba(51,65,85,0.95) 100%)` | select 배경 |
| 위험 | `linear-gradient(135deg, #ef4444 0%, #dc2626 100%)` | 삭제 버튼 |
| 진행 바 | `linear-gradient(90deg, #10b981, #34d399)` | 프로그래스 바 |
| 🆕 티스토리 | `linear-gradient(135deg, #f97316 0%, #ea580c 100%)` | 티스토리 메인 액션 |

---

## 5. 간격 (Spacing)

```css
/* 4px 단위 스케일 */
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

가장 많이 쓰이는 값:
- 카드 padding: **24px**
- 카드 사이 gap: **16px**
- 폼 필드 사이 gap: **12px**
- 버튼 내부 padding: 세로 **10~14px** / 가로 **20~24px**
- 모달 내부 padding: **32px** (헤더/푸터 포함 시 24px)

---

## 6. 그림자 (Box Shadow)

```css
/* 작은 그림자 — 입력 필드 focus */
--shadow-sm: 0 0 0 3px rgba(99, 102, 241, 0.15);

/* 카드 그림자 */
--shadow-md: 0 10px 30px rgba(0, 0, 0, 0.2);

/* 버튼 그림자 */
--shadow-button: 0 6px 20px rgba(99, 102, 241, 0.3);

/* 모달 그림자 */
--shadow-modal: 0 25px 80px rgba(0, 0, 0, 0.5), 0 0 40px rgba(99, 102, 241, 0.15);

/* 강한 알림 그림자 (성공 오버레이) */
--shadow-overlay: 0 30px 80px rgba(16, 185, 129, 0.5);
```

---

## 7. 둥근 모서리 (Border Radius)

```css
--radius-sm:  6~8px;   /* 배지, 작은 칩 */
--radius-md:  10~12px; /* 입력 필드, 버튼 */
--radius-lg:  16px;    /* 카드 */
--radius-xl:  20~24px; /* 모달 */
--radius-full: 9999px; /* 원형 아이콘 */
```

---

## 8. 애니메이션 / 전환

```css
/* 일반 전환 */
transition: all 0.2s ease;          /* 버튼 hover */
transition: all 0.3s ease;          /* 카드/입력 필드 focus */

/* 페이드 인 */
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.9); }
  to   { opacity: 1; transform: scale(1); }
}

/* 팝 인 (성공 오버레이) */
@keyframes popIn {
  0%   { transform: scale(0.5); opacity: 0; }
  60%  { transform: scale(1.05); }
  100% { transform: scale(1); opacity: 1; }
}

/* 펄스 (라이브 표시) */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.5; }
}
```

---

## 9. 이모지 아이콘 시스템

본 앱은 이모지를 시각 아이콘으로 적극 활용 (별도 아이콘 라이브러리 없음):

| 카테고리 | 이모지 | 용도 |
|---|---|---|
| 발행/포스팅 | 📝 📤 🚀 | 단일/연속 발행 |
| 이미지 | 🎨 🖼️ 🌊 🍌 🎯 🚀 🔥 | 엔진별 (ImageFX/Flow/나노바나나/GPT/Prodia/DeepInfra) |
| 키워드 | 🔑 🔗 | 키워드/URL 모드 |
| 카테고리 | 📁 | 카테고리 |
| 설정 | ⚙️ | 환경설정 |
| 성공 | ✅ 🎉 | 완료, 성공 |
| 경고 | ⚠️ ⏳ | 경고, 대기 |
| 위험 | ❌ 🛑 | 실패, 중지 |
| 정보 | 💡 📊 ℹ️ | 안내, 통계 |
| 인증 | 🔐 🔑 🛡️ | 로그인, 보안 |
| 카테고리 | 💰 💸 ⚖️ 💎 | 가격대 |
| 화면 | 🖥️ 👁️ | 봇 회피, 미리보기 |
| 봇 회피 | 🤖 | 자동화 |

🆕 **티스토리 추가**: 📝 (메인 액션) / ⏰ (예약) / 🏷️ (태그) / 🔒 (보호 글)

---

## 10. 접근성 (Accessibility)

- **포커스 표시**: 모든 인터랙티브 요소에 `:focus` 시 `outline` 또는 `box-shadow`로 명확히 표시
- **대비**: 다크 배경 위 텍스트는 `rgba(255,255,255,0.9)` 이상 (WCAG AA 통과)
- **터치 영역**: 버튼/체크박스 최소 32x32px
- **ARIA**: 라디오/탭 그룹에 `role="tablist"`, `aria-selected`, `aria-label` 사용
- **키보드**: 모달은 ESC로 닫기, 폼은 Enter로 제출 (단, 진행 중 모달은 ESC 차단)

---

## 11. 다크 모드 / 라이트 모드

본 앱은 **다크 테마 우선**:
- 메인 화면: 다크 배경 (`#0f172a` ~ `#1e293b`)
- 환경설정 모달: 다크 배경 + 라이트 카드 (혼합)
- 라이선스 인증창: 다크 그라데이션

라이트 모드는 미지원. 티스토리 앱도 동일한 다크 우선 전략 권장.

---

## 12. 컴포넌트 사용 예시 — 티스토리 메인 카드

```html
<div style="
  background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
  border-radius: 16px;
  padding: 24px;
  color: white;
  box-shadow: 0 10px 30px rgba(249, 115, 22, 0.3);
">
  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
    <span style="font-size: 32px;">📝</span>
    <div>
      <h3 style="margin: 0; font-size: 18px; font-weight: 800;">티스토리 자동 발행</h3>
      <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">
        AI 콘텐츠 생성 + 자동 발행
      </p>
    </div>
  </div>
  <!-- 본문 -->
</div>
```

---

## 13. 디자인 토큰 export (CSS Custom Properties)

권장 — `electron/ui/design-tokens.css` 파일로 분리:

```css
:root {
  /* 브랜드 */
  --brand-primary: #6366f1;
  --brand-secondary: #8b5cf6;
  /* ... 위 1~9장의 모든 토큰 */
}

/* 티스토리 전용 오버라이드 — body 또는 root에 class 추가 */
.theme-tistory {
  --brand-primary: #f97316;
  --brand-secondary: #ea580c;
}
```

티스토리 앱에서는 `<body class="theme-tistory">`만 추가하면 모든 인디고/퍼플이 오렌지로 자동 전환됨.

---

> 작성일: 2026-05-28 / 기준 버전: v3.5.93
> 함께 볼 문서:
> - [APP_ARCHITECTURE.md](APP_ARCHITECTURE.md) — 앱 구조
> - [TISTORY_PORTING_GUIDE.md](TISTORY_PORTING_GUIDE.md) — 포팅 단계
> - [TISTORY_SELECTORS.md](TISTORY_SELECTORS.md) — 셀렉터 수집
