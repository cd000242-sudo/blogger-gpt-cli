// src/core/content-modes/base-prompt-builder.ts
// 모든 모드가 공유하는 프롬프트 유틸리티 함수들
// max-mode-structure.ts에서 추출한 공통 로직

/**
 * 말투/어투 지시사항 생성
 */
export function getToneInstruction(toneStyle?: string): string {
    if (!toneStyle) return '';

    const toneMap: Record<string, string> = {
        formal: '📝 **말투**: 격식체 ("~습니다", "~합니다") 사용. 전문적이고 신뢰감 있는 톤.',
        casual: '📝 **말투**: 반말/친근체 ("~해요", "~거든요", "~더라고요") 사용. 친구에게 말하듯 자연스럽게.',
        expert: '📝 **말투**: 전문가 톤. 데이터와 근거 중심. 권위 있되 이해하기 쉽게.',
        friendly: '📝 **말투**: 따뜻한 이웃 톤. "~하시면 좋을 것 같아요", "저도 처음엔 그랬는데요".',
        review: '📝 **말투**: 솔직한 리뷰어 톤. 장단점 모두 언급. "솔직히 말하면", "근데 이건 좀...".',
    };

    return toneMap[toneStyle] || '';
}

/**
 * 랜덤 색상 팔레트 생성 (CTA, 표, 박스 등에 사용)
 * ⚠️ 레거시 — 현재 CTA는 인디고 고정 팔레트 사용
 */
export function getRandomColorPalette(): {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    border: string;
    animationName: string;
} {
    // 🔒 인디고 팔레트 고정 (generateCSSFinal과 동기화)
    return { primary: '#4f46e5', secondary: '#6366f1', background: '#eef2ff', text: '#312e81', border: '#a5b4fc', animationName: 'pulse-indigo' };
}

/**
 * 텍스트 길이 제한
 */
export function truncateText(value: string | null | undefined, maxLength: number): string {
    if (!value) return '';
    return value.length > maxLength ? value.substring(0, maxLength) + '...' : value;
}

/**
 * 연도 가이드라인 생성
 */
export function buildYearGuideline(targetYear?: number | null): string {
    if (!targetYear) return '';
    return `\n📅 **연도 준수 규칙**: 모든 데이터와 문장은 반드시 ${targetYear}년 기준으로 작성하고, 과거 연도를 언급할 때는 ${targetYear}년 최신 상황과 비교하여 업데이트하세요.`;
}

/**
 * 고유 콘텐츠 ID 생성 (같은 키워드로도 매번 다른 콘텐츠 생성 유도)
 */
export function generateUniqueContentId(timestamp?: number, randomSeed?: number): string {
    const ts = timestamp || Date.now();
    const seed = randomSeed || Math.floor(Math.random() * 10000);
    return `${ts}-${seed}`;
}

/**
 * 워드프레스 플랫폼 여부 확인
 */
export function isWordPressPlatform(platform?: string): boolean {
    return platform === 'wordpress';
}

/**
 * CTA HTML 생성 — 인디고 팔레트 고정 (generateCSSFinal 동기화)
 * 애드센스 모드에서는 사용 안 함
 */
export function generateRandomColorCTA(
    hook: string,
    url: string,
    text: string,
    isWordPress: boolean = false
): string {
    const wpSize = isWordPress ? 'max-width: 580px;' : 'max-width: 650px;';

    return `
<div style="margin: 28px auto; ${wpSize} text-align: center;">
  <div style="background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); border-radius: 16px; padding: 24px 20px; box-shadow: 0 8px 32px rgba(79,70,229,0.25);">
    <p style="color: white; font-size: 15px; font-weight: 600; margin: 0 0 14px 0; line-height: 1.5;">${hook}</p>
    <a href="${url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: white; color: #4f46e5; text-decoration: none; padding: 12px 32px; border-radius: 30px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: transform 0.2s ease;">
      ${text}
    </a>
  </div>
</div>`;
}

