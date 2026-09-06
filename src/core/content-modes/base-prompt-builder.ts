// src/core/content-modes/base-prompt-builder.ts
// 모든 모드가 공유하는 프롬프트 유틸리티 함수들
// max-mode-structure.ts에서 추출한 공통 로직

/**
 * 말투/어투 지시사항 생성
 */
export function getToneInstruction(toneStyle?: string): string {
    if (!toneStyle) return '';

    // v3.8.670: 친근·대화 말투는 "책"이 아니라 "사람이 사람에게 설명하는 말" 이다.
    // 선생님이 앞에 앉은 한 사람에게 존댓말로 풀어 주듯 쓴다. 규칙은 어미가 아니라 태도다.
    const TALK = [
        '📝 **말투**: 이 글은 책이 아니라 대화입니다. 선생님이 앞에 앉은 한 사람에게 설명하듯, 존댓말(해요체 "~해요", "~이에요", "~거든요", "~죠")로 말합니다.',
        '- 읽는 사람에게 직접 말을 겁니다: "이럴 때는요", "여기서 하나만 짚을게요", "~하셨다면", "~해 보세요". 독자를 "여러분"이 아니라 앞에 있는 한 사람으로 대합니다.',
        '- 문장은 말할 때 길이로 짧게 끊습니다. 한 문장에 한 가지만 말합니다. 어미는 "~해요·~이에요·~거든요·~인데요·~죠·~할게요" 를 섞어 같은 어미가 세 번 연달아 오지 않게 합니다.',
        '- 어려운 말은 일상어로 바꿔 말합니다: "부과 → 고지서가 날아온다", "산정 → 계산". 법령 용어는 처음 한 번만 쓰고 그 뒤는 쉬운 말로 부릅니다.',
        '- 설명은 "왜 그런지" 를 덧붙입니다. 결론만 던지지 않고 "왜냐하면 ~거든요" 로 이유를 한 문장 붙입니다.',
        '- 판단은 분명하게 합니다. "~인 것 같아요", "~일 수도 있어요", "~하시면 좋을 것 같아요" 같은 흐린 말 대신 "~예요", "~하세요", "~하지 마세요" 로 말합니다. 대화체라고 내용이 물러지면 안 됩니다.',
        '- 물음표와 느낌표를 써도 됩니다. 말하듯 되묻고("그럼 자동으로 빠지냐고요?") 힘줘 말합니다("네, 신청 안 해도 돼요!"). 다만 느낌표는 절마다 한 번쯤, 되묻는 문장 뒤에는 바로 그 답을 붙입니다.',
        '- 답변 상자·요약·FAQ·강조 문장·표 설명까지 전부 같은 말투입니다. "~합니다" 로 끝나는 문장이 글 어디에도 없어야 합니다.',
        // v3.8.673 — 사장님 대본에서 뽑은 말버릇 본보기 (voice-profile.ts)
        require('../final/voice-profile').LEADERNAM_VOICE_RULES,
    ].join('\n');
    const toneMap: Record<string, string> = {
        formal: '📝 **말투**: 격식체 ("~습니다", "~합니다") 사용. 전문적이고 신뢰감 있는 톤.',
        casual: TALK + '\n- 말버릇은 조금 더 편하게: "~더라고요", "~거든요" 를 자주 씁니다. 다만 반말은 쓰지 않습니다.',
        conversational: TALK,
        expert: '📝 **말투**: 전문가 톤. 데이터와 근거 중심. 권위 있되 이해하기 쉽게.',
        friendly: TALK + '\n- 따뜻하게, 그러나 "저도 처음엔 그랬는데요" 같은 지어낸 경험담은 쓰지 않습니다. 겪은 척 대신 "이 부분에서 많이들 헷갈리세요" 처럼 말합니다.',
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

