# 🔥 MAX 모드 글 구조 (5개 섹션)

## 📋 전체 구조 개요

```
H1 제목 (메인 제목)
├─ 📝 WordPress 버튼형 목차
├─ H2 섹션 1: 인삿말 + 핵심 정보
│   ├─ 인삿말 (1-2문장)
│   ├─ H3 소제목 (2-3개)
│   ├─ 본문 내용 (800-1000자)
│   ├─ HTML 표 (3-5행)
│   └─ CTA 버튼 (검증된 링크)
├─ H2 섹션 2: 상세 가이드
│   ├─ H3 소제목 (2-3개)
│   ├─ 본문 내용 (800-1000자)
│   ├─ HTML 표 (3-5행)
│   └─ CTA 버튼
├─ H2 섹션 3: 실전 활용법
│   ├─ H3 소제목 (2-3개)
│   ├─ 본문 내용 (800-1000자)
│   ├─ HTML 표 (3-5행)
│   └─ CTA 버튼
├─ H2 섹션 4: 주의사항 & FAQ
│   ├─ H3 소제목 (2-3개)
│   ├─ 본문 내용 (800-1000자)
│   ├─ HTML 표 (3-5행)
│   └─ CTA 버튼
└─ H2 섹션 5: 마무리 정리
    ├─ H3 소제목 (2-3개)
    ├─ 본문 내용 (800-1000자)
    ├─ HTML 표 (3-5행)
    ├─ CTA 버튼
    └─ ✨ 마무리 멘트 (유일한 마무리!)
```

---

## ✅ HTML 구조 예시

### 1️⃣ H1 메인 제목
```html
<h1>통신비 환급금 조회 사이트 TOP 5 (2025년 최신)</h1>
```

### 2️⃣ WordPress 버튼형 목차
```html
<!-- wp:html -->
<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 12px; margin: 20px 0;">
  <h2 style="color: white; text-align: center; margin-bottom: 20px;">📋 목차</h2>
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px;">
    <a href="#section1" style="display: block; background: rgba(255,255,255,0.2); color: white; padding: 12px 16px; border-radius: 8px; text-decoration: none; text-align: center; font-weight: 600;">1. 통신비 환급금이란?</a>
    <a href="#section2" style="display: block; background: rgba(255,255,255,0.2); color: white; padding: 12px 16px; border-radius: 8px; text-decoration: none; text-align: center; font-weight: 600;">2. 조회 사이트 TOP 5</a>
    <a href="#section3" style="display: block; background: rgba(255,255,255,0.2); color: white; padding: 12px 16px; border-radius: 8px; text-decoration: none; text-align: center; font-weight: 600;">3. 신청 방법 완벽 가이드</a>
    <a href="#section4" style="display: block; background: rgba(255,255,255,0.2); color: white; padding: 12px 16px; border-radius: 8px; text-decoration: none; text-align: center; font-weight: 600;">4. 주의사항 & FAQ</a>
    <a href="#section5" style="display: block; background: rgba(255,255,255,0.2); color: white; padding: 12px 16px; border-radius: 8px; text-decoration: none; text-align: center; font-weight: 600;">5. 마무리 정리</a>
  </div>
</div>
<!-- /wp:html -->
```

### 3️⃣ 섹션 1: 인삿말 + 핵심 정보 (마무리 없음!)
```html
<!-- wp:html -->
<h2 id="section1">1. 통신비 환급금이란?</h2>
<!-- /wp:html -->

<p>통신비 환급금에 대해 궁금하셨나요? 많은 분들이 모르고 지나치는 돈이 바로 이 환급금이에요.</p>

<!-- wp:html -->
<h3>1-1. 환급금 발생 원리</h3>
<!-- /wp:html -->

<p>통신비 환급금은 이동통신사에서 과다 청구된 요금을 돌려받는 제도예요...</p>

<!-- wp:html -->
<h3>1-2. 누가 받을 수 있나요?</h3>
<!-- /wp:html -->

<p>모든 휴대폰 사용자가 대상이에요. 특히 오랫동안 같은 요금제를 사용한 분들이...</p>

<!-- wp:html -->
<table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
  <thead>
    <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
      <th style="padding: 16px 20px; text-align: left; color: white; font-weight: 700;">구분</th>
      <th style="padding: 16px 20px; text-align: left; color: white; font-weight: 700;">내용</th>
      <th style="padding: 16px 20px; text-align: left; color: white; font-weight: 700;">평균 금액</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 16px 20px;">환급 대상</td>
      <td style="padding: 16px 20px;">과다 청구 이력 있는 고객</td>
      <td style="padding: 16px 20px;">3만~15만원</td>
    </tr>
    <tr style="border-bottom: 1px solid #e5e7eb; background: #f8fafc;">
      <td style="padding: 16px 20px;">조회 기간</td>
      <td style="padding: 16px 20px;">최근 5년 이내</td>
      <td style="padding: 16px 20px;">-</td>
    </tr>
    <tr>
      <td style="padding: 16px 20px;">신청 방법</td>
      <td style="padding: 16px 20px;">온라인/모바일 신청</td>
      <td style="padding: 16px 20px;">5분 소요</td>
    </tr>
  </tbody>
</table>
<!-- /wp:html -->

<a href="https://example.com/official" style="display:inline-block;background:linear-gradient(135deg,#4facfe 0%,#00f2fe 100%);color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;box-shadow:0 4px 15px rgba(79,172,254,0.3);margin:20px 0;">🔗 환급금 조회하기</a>
```

### 4️⃣ 섹션 2-4: 본론만 (마무리 없음!)
```html
<!-- wp:html -->
<h2 id="section2">2. 조회 사이트 TOP 5</h2>
<!-- /wp:html -->

<p>실제로 사용해본 결과, 가장 정확하고 빠른 조회 사이트 5곳을 추천드려요...</p>

<!-- H3, 본문, 표, CTA 버튼 동일한 구조 반복 -->
```

### 5️⃣ 섹션 5: 마무리 정리 (유일한 마무리!)
```html
<!-- wp:html -->
<h2 id="section5">5. 마무리 정리</h2>
<!-- /wp:html -->

<p>지금까지 통신비 환급금 조회 사이트와 신청 방법에 대해 알아봤어요...</p>

<!-- H3, 본문, 표, CTA 버튼 -->

<p><strong>✨ 마무리:</strong> 오늘 소개해드린 사이트들을 활용하면 숨은 돈을 찾을 수 있어요. 5분만 투자해서 여러분의 환급금을 확인해보세요!</p>
```

---

## 🚨 절대 규칙

### ✅ 반드시 지켜야 할 것
1. **정확히 5개 H2 섹션** (더도 말고 덜도 말고!)
2. **섹션 1-4는 본론만** (마무리 문구 절대 금지!)
3. **섹션 5만 마무리 포함** (유일한 마무리!)
4. **각 섹션마다 HTML 표 1개** (3-5행)
5. **검증된 CTA 버튼** (임의 URL 생성 금지)
6. **해요체 100%** (~해요, ~예요, ~에요)
7. **WordPress HTML 블록** (<!-- wp:html -->)

### ❌ 절대 하지 말아야 할 것
1. 섹션 1-4에 "마지막으로", "결론적으로" 사용
2. 5개가 아닌 다른 개수의 섹션
3. 마크다운 테이블 (| 기호) 사용
4. 임의로 생성한 가짜 링크
5. AI 메타 멘트 ("알겠습니다", "작성하겠습니다")
6. 이미지 URL 텍스트 노출

---

## 📊 각 섹션별 체크리스트

### 섹션 1 ✅
- [ ] 인삿말 1-2문장 포함
- [ ] H3 소제목 2-3개
- [ ] 본문 800-1000자
- [ ] HTML 표 1개
- [ ] CTA 버튼 1개
- [ ] ❌ 마무리 문구 없음!

### 섹션 2-4 ✅
- [ ] H3 소제목 2-3개
- [ ] 본문 800-1000자
- [ ] HTML 표 1개
- [ ] CTA 버튼 1개
- [ ] ❌ 마무리 문구 없음!

### 섹션 5 ✅
- [ ] H3 소제목 2-3개
- [ ] 본문 800-1000자
- [ ] HTML 표 1개
- [ ] CTA 버튼 1개
- [ ] ✨ 마무리 문구 포함! (유일함!)

---

## 💡 예상 결과

총 글자 수: **약 4,000~5,000자**
총 섹션: **정확히 5개 H2**
총 표 개수: **5개 (각 섹션 1개)**
총 CTA 버튼: **5개 (각 섹션 1개)**

이 구조를 따르면 **독자 참여도 높고, SEO에 최적화되고, 끝까지 읽고 싶어하는 매력적인 글**이 완성됩니다! 🎉

