// src/core/content-modes/adsense/adsense-post-processor.ts
// 생성된 HTML 후처리 — AI 탐지 방지 + CTA 잔여물 제거
// Burstiness, 종결어미 다양성, AI 패턴 스캔

/**
 * AI 후처리 결과 리포트
 */
export interface HumanizationReport {
    burstinessScore: number;       // 문장 길이 변화율 (0-1, 목표 0.6+)
    endingDiversity: number;       // 종결어미 종류 수 (목표 4+)
    sentenceLengthStdDev: number;  // 문장 길이 표준편차 (목표 12+)
    aiPatternCount: number;        // 탐지된 AI 패턴 수 (목표 0)
    removedCTACount: number;       // 제거된 CTA/광고 잔여물 수
    pass: boolean;                 // 전체 통과 여부
    details: string[];             // 상세 메시지
}

// ── AI 패턴 목록 (25개) ──
const AI_PATTERNS: { pattern: RegExp; name: string }[] = [
    { pattern: /또한[,\s]/g, name: '또한 반복' },
    { pattern: /그리고[,\s]/g, name: '그리고 반복' },
    { pattern: /~할 수 있습니다/g, name: '가능 표현' },
    { pattern: /~에 대해[서\s]/g, name: '~에 대해' },
    { pattern: /~것으로 보입니다/g, name: '불확실 표현' },
    { pattern: /마지막으로[,\s]/g, name: '마지막으로' },
    { pattern: /결론적으로[,\s]/g, name: '결론적으로' },
    { pattern: /요약하면[,\s]/g, name: '요약하면' },
    { pattern: /다음과 같습니다/g, name: '다음과 같습니다' },
    { pattern: /이를 통해[서\s]/g, name: '이를 통해' },
    { pattern: /살펴보겠습니다/g, name: '살펴보겠습니다' },
    { pattern: /알아보겠습니다/g, name: '알아보겠습니다' },
    { pattern: /중요합니다[.!]/g, name: '중요합니다' },
    { pattern: /필요합니다[.!]/g, name: '필요합니다' },
    { pattern: /확인해[보\s]겠습니다/g, name: '확인해보겠습니다' },
    { pattern: /첫째[,\s].*둘째[,\s].*셋째/gs, name: '첫째/둘째/셋째 패턴' },
    { pattern: /무엇보다[도\s]/g, name: '무엇보다' },
    { pattern: /한편[,\s]/g, name: '한편' },
    { pattern: /아울러[,\s]/g, name: '아울러' },
    { pattern: /특히[,\s].*특히/gs, name: '특히 반복' },
    { pattern: /따라서[,\s]/g, name: '따라서' },
    { pattern: /이처럼[,\s]/g, name: '이처럼' },
    { pattern: /그렇기 때문에/g, name: '그렇기 때문에' },
    { pattern: /~할 수 있을 것입니다/g, name: '~할 수 있을 것입니다' },
    { pattern: /~가 되실 것입니다/g, name: '~가 되실 것입니다' },
];

// ── CTA/광고 잔여물 패턴 ──
const CTA_RESIDUE_PATTERNS: { pattern: RegExp; name: string }[] = [
    { pattern: /지금\s*바로\s*클릭/gi, name: '클릭 유도' },
    { pattern: /놓치지\s*마세요/gi, name: 'FOMO' },
    { pattern: /한정\s*특가/gi, name: '한정 특가' },
    { pattern: /수익\s*극대화/gi, name: '수익 극대화' },
    { pattern: /광고\s*수익/gi, name: '광고 수익' },
    { pattern: /조회수\s*폭발/gi, name: '조회수 폭발' },
    { pattern: /쿠팡\s*파트너스/gi, name: '쿠팡 파트너스' },
    { pattern: /<[^>]*class="[^"]*cta[^"]*"[^>]*>/gi, name: 'CTA 클래스' },
    { pattern: /<[^>]*class="[^"]*ad-/gi, name: '광고 클래스' },
    { pattern: /animation\s*:\s*[^;]*pulse/gi, name: 'pulse 애니메이션' },
    { pattern: /animation\s*:\s*[^;]*bounce/gi, name: 'bounce 애니메이션' },
];

// ── AI 패턴 자동 대체 맵 (반복 접속사를 다양한 표현으로 교체) ──
const AI_REPLACEMENT_MAP: { pattern: RegExp; replacements: string[] }[] = [
    { pattern: /또한([,\s])/g, replacements: ['이 외에도$1', '아울러$1', '더불어$1', '그 외에도$1'] },
    { pattern: /그리고([,\s])/g, replacements: ['그러니까$1', '여기에 더해$1', '거기에$1'] },
    { pattern: /따라서([,\s])/g, replacements: ['그래서$1', '이런 이유로$1'] },
    { pattern: /이처럼([,\s])/g, replacements: ['이렇게$1', '이런 식으로$1'] },
    { pattern: /무엇보다([\도\s])/g, replacements: ['가장 중요한 건$1', '핵심은$1'] },
];

// ── 한국어 종결어미 패턴 ──
const ENDING_PATTERNS: { pattern: RegExp; name: string }[] = [
    { pattern: /습니다[.!?]/g, name: '~습니다' },
    { pattern: /[해돼세]요[.!?]/g, name: '~요' },
    { pattern: /[이었았겠]다[.!?]/g, name: '~다' },
    { pattern: /죠[.!?]/g, name: '~죠' },
    { pattern: /거든요[.!?]/g, name: '~거든요' },
    { pattern: /더라고요[.!?]/g, name: '~더라고요' },
    { pattern: /인데요[.!?]/g, name: '~인데요' },
    { pattern: /잖아요[.!?]/g, name: '~잖아요' },
];

/**
 * HTML에서 텍스트만 추출
 */
function extractText(html: string): string {
    return html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // 스크립트 제거
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')   // 스타일 제거
        .replace(/<[^>]+>/g, ' ')                           // HTML 태그 제거
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * 문장 분리
 */
function splitSentences(text: string): string[] {
    return text
        .split(/[.!?]\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 3);
}

/**
 * Burstiness 계산 (문장 길이 변화율)
 * 연속된 문장 쌍의 길이 변화율의 평균
 */
function calculateBurstiness(sentences: string[]): number {
    if (sentences.length < 3) return 0;

    let totalVariation = 0;
    for (let i = 1; i < sentences.length; i++) {
        const prevLen = sentences[i - 1]!.length;
        const currLen = sentences[i]!.length;
        const maxLen = Math.max(prevLen, currLen);
        if (maxLen > 0) {
            totalVariation += Math.abs(currLen - prevLen) / maxLen;
        }
    }

    return totalVariation / (sentences.length - 1);
}

/**
 * 문장 길이 표준편차 계산
 */
function calculateStdDev(sentences: string[]): number {
    if (sentences.length < 2) return 0;
    const lengths = sentences.map(s => s.length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const squaredDiffs = lengths.map(l => Math.pow(l - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / lengths.length);
}

/**
 * 종결어미 다양성 측정
 */
function countEndingDiversity(text: string): number {
    let count = 0;
    for (const ending of ENDING_PATTERNS) {
        if (ending.pattern.test(text)) {
            count++;
        }
        // reset lastIndex for global regex
        ending.pattern.lastIndex = 0;
    }
    return count;
}

/**
 * AI 패턴 스캔
 */
function scanAIPatterns(text: string): { count: number; found: string[] } {
    const found: string[] = [];
    let totalCount = 0;

    for (const { pattern, name } of AI_PATTERNS) {
        const matches = text.match(pattern);
        if (matches && matches.length >= 2) { // 2회 이상 반복시 문제로 판단 (기존 3회에서 강화)
            found.push(`${name} (${matches.length}회)`);
            totalCount += matches.length;
        }
        pattern.lastIndex = 0;
    }

    return { count: totalCount, found };
}

/**
 * CTA/광고 잔여물 검출 및 제거
 */
function cleanCTAResidues(html: string): { cleaned: string; removedCount: number; found: string[] } {
    let cleaned = html;
    let removedCount = 0;
    const found: string[] = [];

    for (const { pattern, name } of CTA_RESIDUE_PATTERNS) {
        const matches = cleaned.match(pattern);
        if (matches) {
            found.push(`${name} (${matches.length}개)`);
            removedCount += matches.length;
            cleaned = cleaned.replace(pattern, '');
        }
        pattern.lastIndex = 0;
    }

    return { cleaned, removedCount, found };
}

/**
 * 메인 후처리 함수 — 생성된 HTML을 애드센스 승인에 최적화
 */
export function postProcessForApproval(html: string): {
    html: string;
    report: HumanizationReport;
} {
    const details: string[] = [];

    // 1. CTA/광고 잔여물 제거
    const { cleaned, removedCount, found: ctaFound } = cleanCTAResidues(html);
    if (removedCount > 0) {
        details.push(`⚠️ CTA/광고 잔여물 ${removedCount}개 제거: ${ctaFound.join(', ')}`);
    }

    // 1.5. AI 패턴 자동 대체 (반복 접속사를 다양한 표현으로 교체)
    let processedHtml = cleaned;
    let replacedCount = 0;
    for (const { pattern, replacements } of AI_REPLACEMENT_MAP) {
        let matchIdx = 0;
        processedHtml = processedHtml.replace(pattern, (...args) => {
            // 첫 번째 매치는 유지, 2번째부터 대체 (자연스러움 보존)
            matchIdx++;
            if (matchIdx >= 2) {
                replacedCount++;
                return replacements[(matchIdx - 2) % replacements.length]!;
            }
            return args[0];
        });
        pattern.lastIndex = 0;
    }
    if (replacedCount > 0) {
        details.push(`🔧 AI 패턴 자동 대체 ${replacedCount}건 (반복 접속사 → 다양한 표현)`);
    }

    // 2. 텍스트 추출 및 문장 분리 (대체 후 HTML 사용)
    const text = extractText(processedHtml);
    const sentences = splitSentences(text);

    // 3. Burstiness 계산
    const burstinessScore = calculateBurstiness(sentences);
    if (burstinessScore < 0.6) {
        details.push(`⚠️ Burstiness ${burstinessScore.toFixed(2)} (목표 0.6+) — 문장 길이 변화 부족`);
    } else {
        details.push(`✅ Burstiness ${burstinessScore.toFixed(2)} — 양호`);
    }

    // 4. 문장 길이 표준편차
    const sentenceLengthStdDev = calculateStdDev(sentences);
    if (sentenceLengthStdDev < 12) {
        details.push(`⚠️ 문장 길이 표준편차 ${sentenceLengthStdDev.toFixed(1)} (목표 12+) — 변화 부족`);
    } else {
        details.push(`✅ 문장 길이 표준편차 ${sentenceLengthStdDev.toFixed(1)} — 양호`);
    }

    // 5. 종결어미 다양성
    const endingDiversity = countEndingDiversity(text);
    if (endingDiversity < 4) {
        details.push(`⚠️ 종결어미 ${endingDiversity}종류 (목표 4+) — 다양성 부족`);
    } else {
        details.push(`✅ 종결어미 ${endingDiversity}종류 — 양호`);
    }

    // 6. AI 패턴 스캔
    const { count: aiPatternCount, found: aiFound } = scanAIPatterns(text);
    if (aiPatternCount > 0) {
        details.push(`⚠️ AI 패턴 ${aiPatternCount}건: ${aiFound.join(', ')}`);
    } else {
        details.push(`✅ AI 패턴 0건 — 양호`);
    }

    // 7. 종합 판정
    const pass = burstinessScore >= 0.6
        && endingDiversity >= 4
        && sentenceLengthStdDev >= 12
        && aiPatternCount === 0
        && removedCount === 0;

    const report: HumanizationReport = {
        burstinessScore,
        endingDiversity,
        sentenceLengthStdDev,
        aiPatternCount,
        removedCTACount: removedCount,
        pass,
        details,
    };

    return { html: processedHtml, report };
}
