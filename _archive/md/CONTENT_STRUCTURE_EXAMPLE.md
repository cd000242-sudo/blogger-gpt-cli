# 📝 생성되는 글 구조 예시

이 문서는 AI가 생성하는 블로그 글의 실제 구조와 예시를 보여줍니다.

---

## 🎨 전체 글 구조

```
┌─────────────────────────────────────────┐
│         썸네일 이미지 (SVG)              │
│    (generateTextThumbnail)              │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│         메인 제목 (H1)                  │
│    (SEO 최적화된 제목)                   │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│      목차 (WordPress만)                 │
│    (generateTableOfContents)           │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│    핵심 요약표 (Summary Table)          │
│    (generateSummaryTable)               │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│         섹션 1: H2 제목                 │
│    └─ H2 이미지 (DALL-E/Pexels/CSE)    │
│    └─ H3 소제목                         │
│    └─ 본문 내용                         │
│    └─ 체크리스트/표/그래프              │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│         섹션 2: H2 제목                 │
│    └─ H2 이미지 (DALL-E/Pexels/CSE)    │
│    └─ H3 소제목                         │
│    └─ 본문 내용                         │
│    └─ CTA 섹션                          │
└─────────────────────────────────────────┘
           ↓
         ... (5-7개 섹션 반복)
           ↓
┌─────────────────────────────────────────┐
│         면책사항                         │
│    (generateDisclaimer)                 │
└─────────────────────────────────────────┘
```

---

## 📋 실제 HTML 구조 예시

### 1. 썸네일 (SVG만 사용)

```html
<div class="thumbnail-container">
  <img src="data:image/svg+xml;base64,..." alt="블로그 제목" class="main-thumbnail">
  <div class="thumbnail-overlay">
    <h1 class="thumbnail-title">SEO 최적화된 제목</h1>
  </div>
</div>
```

**특징:**
- ✅ `generateTextThumbnail()` 함수로 생성
- ✅ SVG 형식만 사용 (썸네일에서만 허용)
- ✅ Base64 인코딩된 데이터 URL

---

### 2. 메인 제목 (H1)

```html
<h1 style="font-size: 36px; font-weight: bold; color: #2c3e50; 
           margin: 30px 0; padding: 20px; 
           background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
           color: white; border-radius: 12px; text-align: center;">
  2025년 블로그 마케팅 완벽 가이드 - 초보자도 바로 시작하는 방법
</h1>
```

**특징:**
- ✅ Gemini로 생성된 SEO 최적화 제목
- ✅ 키워드 포함
- ✅ 클릭 유도 요소 포함

---

### 3. 목차 (WordPress만)

```html
<div class="table-of-contents">
  <h2>📑 목차</h2>
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
    <button class="menu-box-btn" style="...">
      1회차: 블로그 마케팅 기본 개념
    </button>
    <button class="menu-box-btn" style="...">
      2회차: 키워드 선정 전략
    </button>
    <!-- ... -->
  </div>
</div>
```

---

### 4. 핵심 요약표

```html
<div class="summary-table" style="...">
  <h3>📊 핵심 요약</h3>
  <table style="width: 100%; border-collapse: collapse;">
    <tr>
      <th style="...">항목</th>
      <th style="...">내용</th>
    </tr>
    <tr>
      <td>주제</td>
      <td>블로그 마케팅</td>
    </tr>
    <tr>
      <td>키워드</td>
      <td>블로그, 마케팅, SEO</td>
    </tr>
    <!-- ... -->
  </table>
</div>
```

---

### 5. 섹션 구조 (H2 + 이미지 + 내용)

#### 5.1 H2 섹션 제목

```html
<h2 style="font-size: 28px; font-weight: bold; color: #2c3e50; 
           margin: 30px 0 20px 0; padding: 15px; 
           background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
           color: white; border-radius: 8px; text-align: center;">
  블로그 마케팅의 기본 개념 이해하기
</h2>
```

#### 5.2 H2 전용 이미지 (썸네일과 구분)

```html
<!-- H2 이미지는 실제 이미지 API만 사용 (SVG 사용 불가) -->
<div style="text-align: center; margin: 20px 0; padding: 15px; 
            background: #f8f9fa; border-radius: 12px; border: 2px solid #e9ecef;">
  <!-- DALL-E, Pexels, 또는 CSE에서 가져온 이미지 -->
  <img src="https://images.pexels.com/photos/..." 
       alt="H2 섹션 이미지: 블로그 마케팅의 기본 개념 이해하기" 
       style="max-width: 100%; height: auto; border-radius: 8px;">
  <p style="margin-top: 10px; font-size: 14px; color: #6c757d;">
    📸 블로그 마케팅의 기본 개념 이해하기 관련 이미지
  </p>
</div>
```

**이미지 소스 우선순위:**
1. **DALL-E** (고품질 AI 생성 이미지)
2. **Pexels** (무료 고품질 스톡 이미지)
3. **Google CSE** (검색 기반 이미지)

**⚠️ 중요:**
- ❌ H2 이미지에서는 **SVG 사용 불가**
- ✅ 썸네일에서만 SVG 사용 가능

#### 5.3 H3 소제목

```html
<h3 style="font-size: 24px; font-weight: bold; color: #10b981; 
           margin: 25px 0 15px 0; padding: 12px 20px; 
           background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
           color: white; border-radius: 6px;">
  블로그 마케팅이란 무엇인가?
</h3>
```

#### 5.4 본문 내용

```html
<div class="content-card" style="background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%); 
                                 border-left: 4px solid #f472b6; padding: 20px; 
                                 margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
  <p style="font-size: 20px; line-height: 2.2; color: #333;">
    블로그 마케팅은 비즈니스나 개인 브랜드를 온라인에서 홍보하고 고객과 소통하는 
    효과적인 디지털 마케팅 전략입니다. 이는 단순히 글을 쓰는 것이 아니라, 
    전략적으로 콘텐츠를 계획하고 SEO를 최적화하여 검색 엔진에서 상위 노출을 
    달성하는 것입니다.
  </p>
</div>
```

#### 5.5 체크리스트

```html
<div class="checklist" style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h4 style="margin-bottom: 15px;">✅ 블로그 마케팅의 핵심 요소</h4>
  <ul style="list-style: none; padding: 0;">
    <li style="padding: 10px; margin: 5px 0; background: white; border-radius: 4px;">
      ✓ 타겟 독자층 명확히 정의하기
    </li>
    <li style="padding: 10px; margin: 5px 0; background: white; border-radius: 4px;">
      ✓ 키워드 리서치 및 SEO 최적화
    </li>
    <li style="padding: 10px; margin: 5px 0; background: white; border-radius: 4px;">
      ✓ 일관된 콘텐츠 발행 일정
    </li>
  </ul>
</div>
```

#### 5.6 비교표

```html
<div class="comparison-table" style="...">
  <table style="width: 100%; border-collapse: collapse;">
    <thead>
      <tr>
        <th style="...">항목</th>
        <th style="...">기본 블로그</th>
        <th style="...">마케팅 블로그</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>목적</td>
        <td>개인 기록</td>
        <td>비즈니스 성장</td>
      </tr>
      <tr>
        <td>SEO 최적화</td>
        <td>선택적</td>
        <td>필수</td>
      </tr>
      <!-- ... -->
    </tbody>
  </table>
</div>
```

#### 5.7 CTA 섹션

```html
<div class="cta-section" style="text-align: center; margin: 40px 0; padding: 30px; 
                                 background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                 border-radius: 12px;">
  <p style="font-size: 18px; color: white; margin-bottom: 20px; font-weight: bold;">
    💡 블로그 마케팅에 대한 더 자세한 정보가 필요하신가요?
  </p>
  <a href="https://example.com/blog-marketing-guide" 
     style="display: inline-block; padding: 15px 30px; background: white; 
            color: #667eea; text-decoration: none; border-radius: 8px; font-weight: bold;">
    지금 바로 확인하기 →
  </a>
</div>
```

---

### 6. 면책사항

```html
<div class="disclaimer-section" style="margin-top: 40px; padding: 20px; 
                                      background: #f8f9fa; border-left: 4px solid #007bff; 
                                      border-radius: 8px;">
  <h4 style="color: #007bff; margin-bottom: 15px; font-size: 1.1rem;">
    ⚠️ 면책사항
  </h4>
  <p style="color: #666; line-height: 1.6; margin: 0; font-size: 0.9rem;">
    본 글은 정보 제공 목적으로 작성되었으며, 최신 정보는 공식 소스에서 확인하시기 바랍니다. 
    작성자의 개인적인 의견이 포함될 수 있으며, 투자나 중요한 결정을 내리기 전에는 
    전문가와 상담하시기 바랍니다.
  </p>
</div>
```

---

## 🎯 주요 특징

### 이미지 생성 규칙

| 이미지 종류 | 사용 가능 소스 | SVG 사용 |
|-----------|--------------|---------|
| **썸네일** | SVG (generateTextThumbnail) | ✅ 허용 |
| **H2 이미지** | DALL-E, Pexels, CSE | ❌ 금지 |

### 글 생성 AI

- **글 생성**: **Gemini만 사용** ✅
- **이미지 생성**: DALL-E, Pexels, CSE만 사용 ✅

### 섹션 구조

1. **H2 섹션** (28px, 파란색 그라데이션)
   - 섹션 제목
   - H2 전용 이미지 (실제 이미지만)
   
2. **H3 소제목** (24px, 초록색 그라데이션)
   - 세부 주제

3. **본문** (20px, 줄간격 2.2)
   - 카드 디자인
   - 반투명 효과
   - 부드러운 그림자

4. **동적 콘텐츠**
   - 체크리스트
   - 비교표
   - 그래프
   - CTA 버튼

---

## 📝 실제 생성 예시

### 주제: "블로그 마케팅"

**생성되는 구조:**

```
📸 썸네일 (SVG)
├─ 제목: "2025년 블로그 마케팅 완벽 가이드 - 초보자도 바로 시작하는 방법"
└─ 주제: "블로그 마케팅"

📑 목차 (WordPress만)
├─ 1회차: 블로그 마케팅 기본 개념
├─ 2회차: 키워드 선정 전략
├─ 3회차: 콘텐츠 작성 방법
└─ ...

📊 핵심 요약표
├─ 주제: 블로그 마케팅
├─ 키워드: 블로그, 마케팅, SEO
└─ 목적: 온라인 비즈니스 성장

📝 섹션 1: 블로그 마케팅의 기본 개념 이해하기
├─ 🖼️ H2 이미지 (DALL-E/Pexels/CSE)
├─ H3: 블로그 마케팅이란 무엇인가?
├─ 본문 내용 (300자 이상)
├─ 체크리스트
└─ 비교표

📝 섹션 2: 키워드 선정 전략
├─ 🖼️ H2 이미지 (DALL-E/Pexels/CSE)
├─ H3: 효과적인 키워드 리서치 방법
├─ 본문 내용 (300자 이상)
└─ CTA 섹션

... (5-7개 섹션 반복)

⚠️ 면책사항
```

---

## ✅ 최종 체크리스트

- [x] 썸네일: SVG만 사용
- [x] H2 이미지: DALL-E/Pexels/CSE만 사용 (SVG 금지)
- [x] 글 생성: Gemini만 사용
- [x] 섹션 구조: H2 → 이미지 → H3 → 본문 → 동적 콘텐츠
- [x] 스타일: 인라인 스타일만 사용
- [x] 반응형 디자인: 모바일 친화적
- [x] SEO 최적화: 키워드 자연스러운 반복

---

**생성일**: 2025-01-27  
**버전**: 2.0.0  
**상태**: ✅ 모든 구조 확인 완료




























