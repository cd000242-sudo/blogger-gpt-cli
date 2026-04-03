// src/core/content-modes/adsense/adsense-css.ts
// 애드센스 승인 전용 CSS — CTA/배너/펄스 애니메이션 완전 제거
// 깔끔한 콘텐츠 전용 스타일만 생성

/**
 * 애드센스 클린 CSS 생성
 * CTA 관련 요소를 모두 제거하고 콘텐츠 가독성에 집중하는 CSS
 */
export function generateAdsenseCleanCSS(): string {
  return `
/* ═══════════════════════════════════════
   애드센스 승인 전용 CSS — Clean Mode
   CTA, 배너, 애니메이션 전부 제거
   콘텐츠 가독성과 전문성에 집중
   ═══════════════════════════════════════ */

/* 본문 기본 */
.post-body, .entry-content {
  font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-size: 16.5px;
  line-height: 1.85;
  color: #1a1a1a;
  word-break: keep-all;
  overflow-wrap: break-word;
}

/* 제목 구조 */
.post-body h2, .entry-content h2 {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
  margin: 48px 0 20px;
  padding-bottom: 12px;
  border-bottom: 2px solid #e5e7eb;
  line-height: 1.4;
}

.post-body h3, .entry-content h3 {
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
  margin: 36px 0 16px;
  padding-left: 14px;
  border-left: 4px solid #3b82f6;
  line-height: 1.4;
}

/* 문단 */
.post-body p, .entry-content p {
  margin: 0 0 18px;
  text-align: justify;
}

/* 인용 블록 */
.post-body blockquote, .entry-content blockquote {
  margin: 24px 0;
  padding: 20px 24px;
  background-color: #f9fafb;
  border-left: 4px solid #6b7280;
  border-radius: 0 8px 8px 0;
  font-style: normal;
  color: #374151;
}

/* 리스트 */
.post-body ul, .post-body ol,
.entry-content ul, .entry-content ol {
  margin: 16px 0;
  padding-left: 24px;
}

.post-body li, .entry-content li {
  margin-bottom: 8px;
  line-height: 1.7;
}

/* 비교 분석 표 */
.post-body table, .entry-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 24px 0;
  font-size: 15px;
}

.post-body th, .entry-content th {
  background-color: #f3f4f6;
  color: #111827;
  font-weight: 600;
  padding: 14px 16px;
  text-align: left;
  border: 1px solid #d1d5db;
}

.post-body td, .entry-content td {
  padding: 12px 16px;
  border: 1px solid #e5e7eb;
  vertical-align: top;
}

.post-body tr:nth-child(even) td,
.entry-content tr:nth-child(even) td {
  background-color: #f9fafb;
}

/* FAQ 섹션 */
.faq-item {
  margin-bottom: 16px;
  padding: 16px 20px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.faq-item h3 {
  font-size: 17px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 8px;
  padding-left: 0;
  border-left: none;
}

.faq-item p {
  margin: 0;
  color: #4b5563;
  font-size: 15px;
}

/* 작성자 정보 */
.author-info {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: #f0f9ff;
  border-radius: 12px;
  margin-bottom: 32px;
  border: 1px solid #bae6fd;
}

.author-info img {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
}

/* 핵심 정보 박스 */
.info-box {
  margin: 24px 0;
  padding: 20px 24px;
  background: #eff6ff;
  border-radius: 10px;
  border: 1px solid #bfdbfe;
}

.info-box p {
  margin: 4px 0;
}

/* 이미지 */
.post-body img, .entry-content img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 20px 0;
}

/* 링크 (내부 링크용) */
.post-body a, .entry-content a {
  color: #2563eb;
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s;
}

.post-body a:hover, .entry-content a:hover {
  border-bottom-color: #2563eb;
}

/* ═══ 모바일 반응형 ═══ */
@media (max-width: 768px) {
  .post-body, .entry-content {
    font-size: 15.5px;
    line-height: 1.75;
  }

  .post-body h2, .entry-content h2 {
    font-size: 21px;
    margin: 36px 0 16px;
  }

  .post-body h3, .entry-content h3 {
    font-size: 18px;
    margin: 28px 0 12px;
  }

  .post-body table, .entry-content table {
    font-size: 13.5px;
  }

  .post-body th, .post-body td,
  .entry-content th, .entry-content td {
    padding: 10px 12px;
  }

  .author-info {
    flex-direction: column;
    text-align: center;
  }
}

/* ═══ CTA/배너/광고 관련 CSS 강제 제거 ═══ */
.cta-btn, .cta-banner, .cta-box, .cta-wrapper,
.ad-safe-zone, .ad-placeholder, .ad-container,
.revenue-box, .affiliate-link, .sponsored-box {
  display: none !important;
}

/* 펄스/바운스/스핀 애니메이션 강제 비활성화 */
@keyframes ctaPulse { from {} to {} }
@keyframes premiumPulse { from {} to {} }
@keyframes bounce { from {} to {} }
@keyframes spin { from {} to {} }
@keyframes slideIn { from {} to {} }
@keyframes fadeInUp { from {} to {} }
@keyframes fadeFloat { from {} to {} }
`.trim();
}

/**
 * 기존 HTML에서 CTA/광고 관련 요소를 제거하는 후처리
 * 프롬프트로 막아도  혹시 남아있을 경우 대비
 */
export function stripAdRelatedCSS(html: string): string {
  // CTA 관련 인라인 스타일 제거
  let cleaned = html;

  // pulse, bounce, premiumPulse, fadeFloat 애니메이션 참조 제거
  cleaned = cleaned.replace(/animation\s*:\s*[^;]*(?:pulse|bounce|spin|ctaPulse|premiumPulse|fadeFloat)[^;]*;/gi, '');

  // CTA 클래스 참조 제거
  cleaned = cleaned.replace(/class="[^"]*(?:cta-btn|cta-banner|cta-box|ad-safe-zone)[^"]*"/gi, '');

  return cleaned;
}
