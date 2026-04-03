// src/core/max-mode/color-cta.ts
// 색상 팔레트 및 CTA HTML 생성

/**
 * 색상 팔레트 — 인디고 고정 (generateCSSFinal과 동기화)
 */
function getRandomColorPalette(): {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  border: string;
  animationName: string;
} {
  // 🔒 인디고 팔레트 고정 (스킨 통일)
  return {
    primary: '#4f46e5',
    secondary: '#6366f1',
    background: '#eef2ff',
    text: '#312e81',
    border: '#a5b4fc',
    animationName: 'pulse-indigo'
  };
}

/**
 * 랜덤 색상으로 CTA HTML 생성 (반응형 최적화)
 */
export function generateRandomColorCTA(
  hook: string,
  url: string,
  text: string,
  isWordPress: boolean = false
): string {
  const colors = getRandomColorPalette();

  // 애니메이션 CSS (인라인 스타일로 포함)
  const animationCSS = `
<style>
@keyframes ${colors.animationName} {
  0%, 100% { transform: scale(1); box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
  50% { transform: scale(1.02); box-shadow: 0 15px 40px rgba(0,0,0,0.15); }
}
@media (max-width: 768px) {
  .cta-responsive-box {
    padding: 25px 15px !important;
    margin: 30px 0 !important;
  }
  .cta-responsive-text {
    font-size: 20px !important;
    margin-bottom: 18px !important;
  }
  .cta-responsive-button {
    padding: 14px 28px !important;
    font-size: 18px !important;
    width: 90% !important;
    max-width: 100% !important;
  }
}
</style>`;

  // 🔧 CTA 크기 키우기 및 후킹멘트 필수 확인
  const finalHook = hook || '🔥 지금 확인하지 않으면 손해입니다!';

  // 🔧 CTA 텍스트에서 &#10022; 문자 제거 (후킹멘트와 버튼 텍스트 모두)
  const cleanHook = finalHook
    .replace(/&#10022;/g, '')
    .replace(/&amp;#10022;/g, '')
    .replace(/&[#]?10022;/gi, '')
    .replace(/\u2726/g, '')
    .trim();
  const cleanText = text
    .replace(/&#10022;/g, '')
    .replace(/&amp;#10022;/g, '')
    .replace(/&[#]?10022;/gi, '')
    .replace(/\u2726/g, '')
    .trim();

  const ctaHTML = `
<style>
@keyframes premiumPulse {
  0%, 100% { transform: scale(1); box-shadow: 0 12px 40px rgba(0,0,0,0.25), 0 0 20px rgba(255,215,0,0.3); }
  50% { transform: scale(1.02); box-shadow: 0 16px 50px rgba(0,0,0,0.3), 0 0 30px rgba(255,215,0,0.5); }
}
@media (max-width: 768px) {
  .cta-responsive-box { padding: 30px 20px !important; margin: 40px auto !important; }
  .cta-responsive-text { font-size: 22px !important; margin-bottom: 20px !important; }
  .cta-responsive-button { padding: 16px 32px !important; font-size: 19px !important; width: 85% !important; }
}
</style>
<div style="text-align:center; margin:50px 0;">
<div class="cta-responsive-box" style="padding: 45px 40px; border: 3px solid transparent; background: linear-gradient(135deg, #1a1a2e 0%, #2c3e50 100%); border-radius: 18px; text-align: center; margin: 0 auto; max-width: 95%; animation: premiumPulse 2s infinite; box-shadow: 0 12px 40px rgba(0,0,0,0.25), 0 0 20px rgba(255,215,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1); position: relative; overflow: hidden;">
  <div style="position: absolute; top: 50%; left: 50%; width: 300px; height: 300px; background: radial-gradient(circle, rgba(255,215,0,0.1) 0%, transparent 70%); border-radius: 50%; transform: translate(-50%, -50%);"></div>
  <p class="cta-responsive-text" style="font-size: 28px !important; font-weight: 900 !important; background: linear-gradient(135deg, #ffd700 0%, #ffffff 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 25px; line-height: 1.6; position: relative; z-index: 1;" data-ke-size="size20">${cleanHook}</p>
  <a class="cta-responsive-button" style="color: #ffffff !important; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #991b1b 100%); padding: 22px 50px; text-decoration: none; font-weight: 900 !important; border-radius: 50px; display: inline-block; margin-top: 20px; font-size: 22px !important; transition: all 0.3s ease; box-shadow: 0 8px 30px rgba(220,38,38,0.4), inset 0 1px 0 rgba(255,255,255,0.2); letter-spacing: 0.5px; text-shadow: 0 2px 4px rgba(0,0,0,0.3); border: 2px solid rgba(255,215,0,0.3); position: relative; z-index: 1;" href="${url}" rel="noopener">${cleanText}</a>
</div>
</div>`;

  return isWordPress ? `<!-- wp:html -->${ctaHTML}<!-- /wp:html -->` : ctaHTML;
}
