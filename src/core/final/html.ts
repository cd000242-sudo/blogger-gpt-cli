/**
 * HTML/CSS 생성 함수 모음
 * - generateCSSFinal: 플랫폼별 CSS 생성
 * - generateTOCFinal: 목차 HTML 생성
 * - generateWPFloatingTOC: 워드프레스 플로팅 목차
 * - generateBloggerTOCFinal: 블로그스팟 목차
 */

export function generateCSSFinal(platform?: string, contentMode?: string): string {
  // 🛡️ 애드센스 모드 CSS는 publisher.js:270의 injectCSS()가 단일 소스로 주입한다.
  //    과거 여기서도 adsensePlugin.generateCSS()를 반환하여 본문에 raw CSS가 새거나
  //    <style> 블록이 중복 주입되어 Blogger가 본문을 텍스트로 노출하는 회귀가 있었다.
  //    WordPress 경로는 adsense 분기를 원래 쓰지 않았으므로 제거해도 영향 없음.

  const isWP = platform === 'wordpress';
  // 📝 블로그스팟 기본 인디고 팔레트 (blogger-theme-injector.ts와 동기화)
  const INDIGO_PALETTE = { name: '인디고', primary: '#4f46e5', primaryLight: '#e0e7ff', ctaAccent: '#6366f1', ctaHover: '#4338ca', gradientStart: '#eef2ff', gradientEnd: '#e0e7ff', heading1: '#312e81', heading2Border: '#818cf8', tocBtnHoverBorder: '#a5b4fc', tocNumberText: '#4f46e5' };
  const selectedPalette = INDIGO_PALETTE;
  console.log(`[CSS] 🎨 컬러 선택: ${selectedPalette.name} (모드: ${contentMode || 'default'})`);

  const theme = isWP ? {
    primary: '#059669',
    primaryLight: '#d1fae5',
    ctaAccent: '#10b981',
    ctaHover: '#047857',
    gradientStart: '#f0fdf4',
    gradientEnd: '#d1fae5',
    heading1: '#064e3b',
    heading2Border: '#34d399',
    tocBtnHoverBorder: '#6ee7b7',
    tocNumberText: '#047857',
  } : selectedPalette;

  // 💰 Revenue-Max Skin v3.5 Ultimate — 100점 완벽 스킨
  return `
<style>
/* ============================================
   💎 1-BILLION-POINT PREMIUM WHITE PAPER SKIN
   ============================================
   !important: only on layout/container overrides.
   Typography uses specificity.
   ============================================ */
@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.8/dist/web/static/pretendard.css");

html { scroll-behavior: smooth !important; }

/* === CSS Custom Properties === */
.bgpt-content {
  --rv-primary: ${theme.primary};
  --rv-primary-light: ${theme.primaryLight};
  --rv-cta-accent: ${theme.ctaAccent};
  --rv-cta-accent-hover: ${theme.ctaHover};
  --rv-text: #1e293b;
  --rv-text-strong: #0f172a;
  --rv-text-secondary: #475569;
  --rv-text-muted: #94a3b8;
  --rv-border: #e2e8f0;
}

/* 🛡️ 플랫폼 테마 강제 오버라이드 (티스토리/블로그스팟/워드프레스 공용) */
.gradient-frame {
  width: 100% !important;
  max-width: 100% !important;
  background: linear-gradient(135deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 100%) !important;
  border-radius: 24px !important;
  padding: 5px !important;
  box-sizing: border-box !important;
  font-family: "Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
  margin: 0 auto 50px auto !important;
  display: block !important;
  overflow: hidden !important;
}

.white-paper {
  background-color: #FFFFFF !important;
  border-radius: 20px !important;
  padding: 60px 40px !important;
  color: #1e293b !important;
  line-height: 1.8 !important;
  box-sizing: border-box !important;
  width: 100% !important;
  -webkit-font-smoothing: antialiased;
}

/* === 타이포그래피 === */
.white-paper h1.post-title {
  font-size: 32px !important;
  font-weight: 900;
  color: ${theme.heading1};
  margin-bottom: 24px !important;
  line-height: 1.4;
  word-break: keep-all !important;
}

.white-paper h2 {
  color: ${theme.primary};
  font-weight: 800;
  font-size: 26px !important;
  margin: 60px 0 25px !important;
  border-left: 6px solid ${theme.heading2Border} !important;
  padding: 0 0 0 18px !important;
  line-height: 1.4;
  word-break: keep-all !important;
  background: transparent !important;
  border-top: none !important;
  border-right: none !important;
  border-bottom: none !important;
}

.white-paper h3 {
  font-size: 21px !important;
  font-weight: 700;
  color: #0f172a;
  margin: 40px 0 16px !important;
  padding: 0 !important;
  letter-spacing: -0.01em;
  line-height: 1.45;
}

.white-paper p {
  font-size: 17px !important;
  line-height: 1.95;
  margin: 0 0 24px !important;
  color: #1e293b;
  word-break: keep-all !important;
}

.white-paper strong {
  color: ${theme.primary} !important;
  font-weight: 700 !important;
  background: linear-gradient(180deg, transparent 60%, ${theme.primaryLight} 40%) !important;
}

/* === 목차 (TOC Grid) === */
.toc-grid-container {
  margin: 40px 0 !important;
  padding: 30px !important;
  background: #f8fafc !important;
  border-radius: 20px !important;
  border: 1px solid #e2e8f0 !important;
}
.toc-grid-container h3 {
  margin: 0 0 20px 0 !important;
  font-size: 20px !important;
  font-weight: 800 !important;
  color: #0f172a !important;
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}
.toc-grid {
  display: flex !important;
  flex-direction: column !important;
  gap: 12px !important;
}
.toc-btn {
  background: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
  padding: 18px 20px !important;
  border-radius: 14px !important;
  text-align: left !important;
  font-weight: 700;
  color: #475569;
  text-decoration: none !important;
  display: flex !important;
  align-items: center !important; /* 세로 중앙 정렬 */
  gap: 12px !important;
  width: 100% !important;
  box-sizing: border-box !important;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
}
.toc-btn:hover {
  background: ${theme.gradientStart} !important;
  color: ${theme.ctaAccent};
  border-color: ${theme.tocBtnHoverBorder} !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 6px 12px rgba(0,0,0,0.05);
}
.toc-number {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 28px !important;
  height: 28px !important;
  background: ${theme.primaryLight} !important;
  color: ${theme.tocNumberText} !important;
  border-radius: 8px !important;
  font-size: 13px !important;
  font-weight: 800 !important;
  flex-shrink: 0 !important;
}

/* === CTA Box (Max-Adsense 가시성 극대화) === */
@keyframes pulse-cta {
  0% { transform: scale(1); box-shadow: 0 4px 6px rgba(255, 59, 59, 0.2); }
  50% { transform: scale(1.02); box-shadow: 0 8px 15px rgba(255, 59, 59, 0.4); }
  100% { transform: scale(1); box-shadow: 0 4px 6px rgba(255, 59, 59, 0.2); }
}

.cta-box {
  width: 100% !important;
  background: #fff8f8 !important; /* 초경고성 연분홍 배경 */
  border: 3px dashed #ff3b3b !important; /* 강렬한 점선 박스 (쿠폰 은유) */
  border-radius: 12px !important;
  padding: 30px 20px !important;
  text-align: center !important;
  margin: 45px 0 !important;
  box-sizing: border-box !important;
  position: relative;
}
.cta-box p {
  margin-bottom: 20px !important;
  font-size: 19px !important;
  font-weight: 800 !important;
  color: #111827 !important;
  line-height: 1.4 !important;
  word-break: keep-all;
}
.cta-btn {
  display: block !important;
  width: 100% !important;
  max-width: 400px !important;
  margin: 0 auto !important;
  background: #ef4444 !important; /* 강렬한 레드 */
  color: #ffffff !important;
  padding: 18px 20px !important;
  border-radius: 8px !important;
  font-size: 18px !important;
  font-weight: 800;
  text-decoration: none !important;
  transition: all 0.2s ease;
  animation: pulse-cta 2s infinite !important; /* 박동 애니메이션 */
  box-sizing: border-box !important; /* 모바일 넘침 방지 */
  word-break: keep-all !important; /* 모바일 텍스트 줄바꿈 깔끔하게 */
}
.cta-btn:hover {
  background: #dc2626 !important;
  transform: translateY(-2px) scale(1.02) !important;
}
.cta-microcopy {
  display: block !important;
  margin-top: 12px !important;
  font-size: 13px !important;
  font-weight: 700;
  color: #ef4444;
  letter-spacing: -0.5px;
}

/* === 면책 조항 === */
.disclaimer {
  font-size: 13px !important;
  color: #94a3b8 !important;
  background: #f8fafc !important;
  padding: 24px !important;
  border-radius: 16px !important;
  margin-top: 50px !important;
  line-height: 1.7 !important;
  border: 1px solid #e2e8f0 !important;
}

/* === 베이스 === */
.bgpt-content {
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 auto !important;
  padding: 0 !important;
  box-sizing: border-box !important;
  font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: var(--rv-text);
  line-height: 1.9;
  letter-spacing: 0.01em;
  word-spacing: 0.05em;
  background: var(--rv-bg);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* === 🔥 워드프레스 테마 폭 강제 확장 (부모 컨테이너 override) === */
.entry-content,
.post-content,
.page-content,
.site-content .content-area,
.type-post .entry-content,
.single-post .entry-content,
article .entry-content,
.wp-block-post-content {
  max-width: 100% !important;
  width: 100% !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
}

/* === 이미지 === */
.white-paper .section-image {
  margin: 32px 0 40px !important;
}
.white-paper .section-image img {
  width: 100% !important;
  height: auto !important;
  border-radius: 12px !important;
  display: block !important;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05) !important;
}
.white-paper .section-image figcaption {
  text-align: center !important;
  font-size: 13px !important;
  color: #64748b !important;
  margin-top: 12px !important;
  font-style: italic !important;
}

/* === 인용구 (Blockquote) === */
.white-paper blockquote {
  margin: 32px 0 !important;
  padding: 24px 30px !important;
  background: #f8fafc !important;
  border-left: 4px solid var(--rv-primary) !important;
  border-radius: 0 12px 12px 0 !important;
  font-size: 16px !important;
  color: #334155;
  font-style: normal !important;
}

/* === 표 === */
.white-paper .table-wrapper {
  width: 100% !important;
  overflow-x: auto !important;
  margin: 32px 0 !important;
  border-radius: 12px !important;
  border: 1px solid #e2e8f0 !important;
}
.white-paper table {
  width: 100% !important;
  min-width: 500px !important;
  border-collapse: collapse !important;
  font-size: 15px !important;
}
.white-paper th {
  background: #f1f5f9 !important;
  color: #1e293b;
  font-weight: 800;
  padding: 16px 20px !important;
  text-align: left !important;
  border-bottom: 2px solid #cbd5e1 !important;
}
.white-paper td {
  padding: 16px 20px !important;
  border-bottom: 1px solid #e2e8f0 !important;
  color: #334155;
  background: #ffffff !important;
}
.white-paper tr:nth-child(even) td {
  background: #f8fafc !important;
}

/* === 공유 버튼 — 미니멀 === */
.bgpt-content .rv-share {
  margin: 36px 0 16px;
  padding: 20px 0;
  border-top: 1px solid var(--rv-border-table);
  text-align: center;
}
.bgpt-content .rv-share-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--rv-text-muted);
  margin-bottom: 12px;
}
.bgpt-content .rv-share a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 4px 6px;
  padding: 8px 18px;
  border: 1px solid var(--rv-border);
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  color: var(--rv-text-secondary);
  text-decoration: none;
  transition: all 0.2s;
}
.bgpt-content .rv-share a:hover {
  border-color: var(--rv-primary);
  color: var(--rv-primary);
  background: var(--rv-primary-light);
}

/* === 면책 — 접근성 준수 (WCAG AA 4.5:1) === */
.bgpt-content .disclaimer {
  margin: 24px 0 16px;
  padding: 0;
  font-size: 12px;
  color: var(--rv-text-muted);
  line-height: 1.7;
}

/* ═══════════════════════════════════════════════════════════════
   🛡️ AdSense Ad-Safe Zone — Auto-Ads가 표/CTA 내부에 광고를 삽입하지 못하도록 차단
   (Google은 class="ad-safe-zone", data-ad-region, role 기반으로 광고 배치를 회피)
   ═══════════════════════════════════════════════════════════════ */
.ad-safe-zone {
  position: relative !important;
  isolation: isolate !important;  /* 광고 주입 stacking context 격리 */
  contain: layout style !important;  /* 레이아웃 오염 방지 */
  overflow-x: auto !important;
  -webkit-overflow-scrolling: touch !important;
}
.ad-safe-zone[data-ad-region="no-ad"]::before {
  /* AdSense 크롤러 시그널 — 이 영역은 광고 배치 불가 */
  content: "";
  display: none;
}

/* ═══════════════════════════════════════════════════════════════
   📊 Responsive Table — 반응형 표 (모바일 최적화 + AdSense 침입 차단)
   ═══════════════════════════════════════════════════════════════ */
.table-wrapper {
  width: 100% !important;
  max-width: 100% !important;
  overflow-x: auto !important;
  -webkit-overflow-scrolling: touch !important;
  margin: 28px 0 !important;
}
.summary-container {
  padding: 24px !important;
}
.responsive-table {
  width: 100% !important;
  max-width: 100% !important;
  border-collapse: collapse !important;
  table-layout: auto !important;
}
.responsive-table th,
.responsive-table td {
  word-break: break-word !important;
  overflow-wrap: break-word !important;
  white-space: normal !important;
}

/* ===== 📱 스마트폰 반응형 (max-width: 768px) ===== */
@media (max-width: 768px) {
  .gradient-frame {
    padding: 0 !important;
    border-radius: 0 !important;
    margin-bottom: 20px !important;
  }
  .white-paper {
    padding: 30px 20px !important;
    border-radius: 0 !important;
  }
  .white-paper h1.post-title { font-size: 26px !important; }
  .white-paper h2 { font-size: 22px !important; margin: 40px 0 20px !important; }
  .white-paper p { font-size: 16px !important; line-height: 1.8 !important; }

  .toc-grid-container { padding: 20px !important; }
  .toc-btn { padding: 14px 16px !important; font-size: 15px !important; }

  .cta-box { padding: 24px 16px !important; }
  .cta-btn {
    padding: 14px 16px !important;
    font-size: 16px !important;
    width: 100% !important;
    white-space: normal !important; /* 모바일 좁은 화면에서 텍스트 자동으로 줄바꿈 되도록 허용 */
  }

  /* 📊 모바일 표 — 글자/패딩 축소 + 줄바꿈 강제 */
  .table-wrapper {
    margin: 20px -4px !important;  /* 좌우 여백 살짝 확장 → 화면 활용도 ↑ */
    border-radius: 8px !important;
  }
  .responsive-table {
    font-size: 14px !important;
  }
  .responsive-table th,
  .responsive-table .rt-th {
    padding: 10px 10px !important;
    font-size: 12px !important;
    letter-spacing: 0.02em !important;
  }
  .responsive-table td,
  .responsive-table .rt-td {
    padding: 10px 10px !important;
    font-size: 13px !important;
    line-height: 1.5 !important;
  }
  /* 이미지 — 모바일에서도 100% 유지 */
  .white-paper img {
    max-width: 100% !important;
    height: auto !important;
  }

  /* 📊 상단 요약표 컨테이너 — 모바일 패딩 축소로 표 짤림 방지 */
  .summary-container {
    padding: 14px !important;
    margin: 0 0 24px !important;
    border-radius: 12px !important;
  }
  .summary-container .table-wrapper {
    margin: 12px 0 0 !important;
  }
}

/* ===== 📱 초소형 스마트폰 반응형 (max-width: 380px) ===== */
@media (max-width: 380px) {
  .white-paper { padding: 20px 14px !important; }
  .white-paper h1.post-title { font-size: 22px !important; }
  .white-paper h2 { font-size: 19px !important; }
  .white-paper p { font-size: 15px !important; }

  .responsive-table {
    font-size: 12px !important;
  }
  .responsive-table th,
  .responsive-table .rt-th {
    padding: 8px 6px !important;
    font-size: 11px !important;
  }
  .responsive-table td,
  .responsive-table .rt-td {
    padding: 8px 6px !important;
    font-size: 12px !important;
  }

  /* 📊 초소형 화면 — 요약표 컨테이너 패딩 추가 축소 */
  .summary-container {
    padding: 10px !important;
    border-radius: 10px !important;
  }
}

/* ===== 🖨️ 인쇄 스타일 ===== */
@media print {
  .bgpt-content {
    color: #000 !important;
    background: #fff !important;
    font-size: 12pt;
    line-height: 1.6;
  }
  .bgpt-content h2 {
    border-left: none !important;
    padding-left: 0 !important;
    page-break-after: avoid;
  }
  .bgpt-content h3 { page-break-after: avoid; }
  .bgpt-content .section-image { page-break-inside: avoid; }
  .bgpt-content .rv-cta,
  .bgpt-content .rv-inline-cta,
  .bgpt-content .rv-share { display: none !important; }
  .bgpt-content .table { page-break-inside: avoid; }
  .bgpt-content a { color: #000 !important; text-decoration: underline !important; }
  .bgpt-content a::after { content: " (" attr(href) ")"; font-size: 10pt; color: #555; }
}

/* === 📦 시맨틱 콘텐츠 클래스 (prompt.ts 출력용) === */
.white-paper .highlight {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%) !important;
  padding: 20px !important;
  border-radius: 12px !important;
  border-left: 5px solid #f59e0b !important;
  margin: 20px 0 !important;
  box-shadow: 0 2px 10px rgba(245, 158, 11, 0.15) !important;
}
.white-paper .warning {
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%) !important;
  border: 1px solid #fecaca !important;
  color: #dc2626 !important;
  padding: 20px !important;
  border-radius: 12px !important;
  margin: 20px 0 !important;
}
.white-paper .success {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%) !important;
  border: 1px solid #bbf7d0 !important;
  color: #16a34a !important;
  padding: 20px !important;
  border-radius: 12px !important;
  margin: 20px 0 !important;
}
.white-paper .data-box {
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%) !important;
  border: 2px solid #0ea5e9 !important;
  padding: 20px !important;
  border-radius: 12px !important;
  margin: 20px 0 !important;
}
.white-paper .data-box h4 {
  color: #0c4a6e !important;
  margin: 0 0 12px !important;
  font-weight: 700 !important;
}
.white-paper .checklist {
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%) !important;
  padding: 20px !important;
  border-radius: 12px !important;
  border: 1px solid #bae6fd !important;
  margin: 20px 0 !important;
}
.white-paper .checklist li {
  margin: 10px 0 !important;
  padding-left: 12px !important;
  position: relative !important;
}
.white-paper .quote {
  border-left: 5px solid ${theme.primary} !important;
  padding: 16px 20px !important;
  margin: 20px 0 !important;
  font-style: italic !important;
  color: #6b7280 !important;
  background: #f8fafc !important;
  border-radius: 0 8px 8px 0 !important;
}
.white-paper .comparison-table {
  background: linear-gradient(135deg, #fefce8 0%, #fef3c7 100%) !important;
  border: 1px solid #fde047 !important;
}
.white-paper .comparison-table th {
  background: linear-gradient(135deg, #fef3c7 0%, #fde047 100%) !important;
  color: #92400e !important;
}
.white-paper .cta-section {
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%) !important;
  padding: 24px !important;
  border-radius: 16px !important;
  margin: 24px 0 !important;
  text-align: center !important;
  border: 2px solid ${theme.primary} !important;
}
.white-paper .cta-section h3 {
  color: ${theme.heading1} !important;
  margin: 0 0 16px !important;
  font-size: 1.3em !important;
  font-weight: 700 !important;
}
.white-paper .cta-section p {
  color: #374151 !important;
  margin: 0 0 20px !important;
  font-size: 1.05em !important;
  line-height: 1.6 !important;
}
.white-paper .cta-button {
  display: inline-block !important;
  background: linear-gradient(135deg, ${theme.ctaAccent} 0%, ${theme.primary} 100%) !important;
  color: white !important;
  padding: 16px 32px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 700;
  font-size: 1.1em !important;
  margin: 20px 0 !important;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(79, 70, 229, 0.3);
}
.white-paper .cta-button:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 6px 20px rgba(79, 70, 229, 0.4);
}
.white-paper .tags {
  display: flex !important;
  flex-wrap: wrap !important;
  gap: 8px !important;
  padding: 0 !important;
  margin: 28px 0 !important;
  list-style: none !important;
}
.white-paper .tags li {
  background: #f3f4f6 !important;
  color: #374151 !important;
  padding: 6px 12px !important;
  border-radius: 20px !important;
  font-size: 0.85em !important;
  font-weight: 500 !important;
  border: 1px solid #e5e7eb !important;
}

/* === 📝 내부 일관성 모드 전용 컴포넌트 === */
.series-badge {
  display: inline-flex !important; align-items: center !important; gap: 8px !important;
  background: linear-gradient(135deg, ${theme.gradientStart}, ${theme.gradientEnd}) !important;
  border: 1px solid ${theme.tocBtnHoverBorder} !important;
  border-radius: 20px !important;
  padding: 6px 16px !important;
  font-size: 13px !important; font-weight: 600 !important;
  color: ${theme.primary} !important;
  margin-bottom: 20px !important;
}
.takeaway-box {
  background: linear-gradient(135deg, ${theme.gradientStart}, #f5f3ff) !important;
  border: 2px solid ${theme.heading2Border} !important;
  border-radius: 14px !important;
  padding: 20px 24px !important;
  margin: 32px 0 !important;
}
.takeaway-box .takeaway-title {
  font-size: 17px !important; font-weight: 800;
  color: ${theme.primary}; margin-bottom: 12px !important;
}
.takeaway-box ul { padding-left: 20px !important; }
.takeaway-box li {
  color: ${theme.heading1}; font-size: 15px !important;
  margin-bottom: 6px !important; line-height: 1.6;
}
.takeaway-box .one-liner {
  margin-top: 12px !important; padding-top: 12px !important;
  border-top: 1px solid ${theme.tocBtnHoverBorder} !important;
  font-weight: 700; color: ${theme.ctaHover};
}
.next-episode-card {
  background: linear-gradient(135deg, ${theme.gradientStart}, ${theme.gradientEnd}) !important;
  border: 2px dashed ${theme.heading2Border} !important;
  border-radius: 14px !important;
  padding: 20px 24px !important;
  margin-top: 36px !important;
}
.next-episode-card .next-label {
  font-size: 13px !important; font-weight: 700;
  color: ${theme.ctaAccent}; margin-bottom: 8px !important;
}
.next-episode-card .next-topic {
  font-size: 18px !important; font-weight: 800;
  color: ${theme.heading1}; margin-bottom: 6px !important;
}
.next-episode-card .next-reason {
  font-size: 14px !important; color: ${theme.ctaHover};
}
</style>
`;
}



export function generateTOCFinal(h2Titles: string[]): string {
  if (!h2Titles || h2Titles.length === 0) return '';

  const tocItems = h2Titles.map((h2, i) =>
    `<a class="toc-btn" href="#section-${i}">
      <span class="toc-number">${i + 1}</span>
      <span style="line-height:1.4 !important; flex:1 !important; display: flex; align-items: center;">${h2}</span>
    </a>`
  ).join('\n    ');

  return `
<div class="toc-grid-container" id="toc">
  <h3>📌 전체 읽어보기 절차</h3>
  <div class="toc-grid">
    ${tocItems}
  </div>
</div>
`;
}

// 🔥 워드프레스용 좌측 플로팅 세로 목차 (본문에서는 숨기고 좌측에 고정)
export function generateWPFloatingTOC(h2Titles: string[]): string {
  if (!h2Titles || h2Titles.length === 0) return '';
  const tocItems = h2Titles.map((h2, i) =>
    `<a href="#section-${i}" style="display:block !important;padding:10px 14px !important;margin-bottom:6px !important;color:#475569 !important;text-decoration:none !important;font-size:14px !important;font-weight:600 !important;border-left:3px solid #3b82f6 !important;border-radius:6px !important;background:#fff !important;line-height:1.4 !important;">${i + 1}. ${h2}</a>`
  ).join('\n      ');

  // 워드프레스에서는 좌측 고정 + 본문 내에서는 숨김
  // 단, WP에서 position:fixed가 안 될 수 있으므로 inline 목차를 제공하되 깔끔하게
  return `
<div style="margin:0 0 30px !important;padding:0 !important;display:block !important;">
  <details style="background:#f8fafc !important;border:1px solid #e2e8f0 !important;border-radius:12px !important;padding:16px 20px !important;">
    <summary style="cursor:pointer !important;font-size:16px !important;font-weight:800 !important;color:#1e293b !important;list-style:none !important;display:flex !important;align-items:center !important;gap:8px !important;">
      <span style="font-size:20px !important;">📋</span> 목차 보기
      <span style="margin-left:auto !important;font-size:12px !important;color:#94a3b8 !important;">클릭하여 펼치기</span>
    </summary>
    <nav style="display:flex !important;flex-direction:column !important;margin-top:12px !important;padding-top:12px !important;border-top:1px solid #e2e8f0 !important;">
      ${tocItems}
    </nav>
  </details>
</div>
`;
}

// 🔥 블로그스팟/티스토리/WP 공용 화이트페이퍼 목차
export function generateBloggerTOCFinal(h2Titles: string[]): string {
  return generateTOCFinal(h2Titles); // 이제 모두 통일된 버튼형 화이트페이퍼 UI를 사용합니다.
}
