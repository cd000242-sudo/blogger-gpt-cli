// src/core/content-modes/internal/internal-post-processor.ts
// 내부 일관성 모드 후처리 — 시리즈 번호·외부 글 참조·AI 패턴 자동 정화
// adsense의 postProcessForApproval와 같은 라인업이지만 internal 콘셉트에 맞춤

export interface InternalPostProcessReport {
    seriesPatternsRemoved: number;
    externalRefsRemoved: number;
    aiPatternReplacements: number;
    pass: boolean;
    details: string[];
}

// 시리즈 번호 / 시리즈 언급 패턴 (단일 글 완결성 위반)
// 한국어는 단어 경계(\b)가 잘 안 먹으므로 명시적으로 인접 문자 처리
const SERIES_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /\d+\s*편(?=[입니다은는이가\s,.\)])/g, name: 'N편 표기' },
    { pattern: /시리즈\s*\d+/g, name: '시리즈 N' },
    { pattern: /(이전|다음|첫|마지막)\s*(편|글|포스트)/g, name: '이전/다음 편' },
    { pattern: /(다음\s*편|다음\s*포스트)에서\s+(다루겠습니다|이어집니다|계속됩니다)/g, name: '다음 편에서' },
    { pattern: /지난\s*(글|포스트|편)에서/g, name: '지난 편에서' },
];

// 외부 글 참조 패턴 (단일 글 완결성 위반)
const EXTERNAL_REF_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /다른\s*글에서\s+(자세히|언급|소개|다룬|설명)/g, name: '다른 글에서' },
    { pattern: /이전\s*포스트(?:에서|를\s*참고)/g, name: '이전 포스트 참고' },
    { pattern: /별도의?\s*글에서\s+(다루|살펴|소개)/g, name: '별도 글에서' },
];

// 약한 AI 패턴 (한정해서 자동 대체)
const AI_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
    { pattern: /다음과\s*같습니다\s*\./g, replacement: '아래와 같습니다.' },
    { pattern: /이를\s*통해/g, replacement: '이렇게 하면' },
    { pattern: /살펴보겠습니다/g, replacement: '하나씩 풀어 보겠습니다' },
];

/** 패턴 N개 제거 후 잔존 카운트 반환 */
function stripPatterns(html: string, patterns: typeof SERIES_PATTERNS): { html: string; count: number; found: string[] } {
    let out = html;
    let count = 0;
    const found: string[] = [];
    for (const { pattern, name } of patterns) {
        pattern.lastIndex = 0;
        const matches = out.match(pattern);
        if (matches) {
            count += matches.length;
            found.push(`${name}(${matches.length})`);
            out = out.replace(pattern, '');
        }
    }
    return { html: out, count, found };
}

/** internal 모드 후처리 메인 */
export function postProcessInternal(html: string): { html: string; report: InternalPostProcessReport } {
    const details: string[] = [];

    // 1) 시리즈 번호 / 시리즈 언급 자동 제거
    const seriesResult = stripPatterns(html, SERIES_PATTERNS);
    if (seriesResult.count > 0) {
        details.push(`🛡️ 시리즈 패턴 ${seriesResult.count}개 제거: ${seriesResult.found.join(', ')}`);
    }
    let processed = seriesResult.html;

    // 2) 외부 글 참조 자동 제거
    const externalResult = stripPatterns(processed, EXTERNAL_REF_PATTERNS);
    if (externalResult.count > 0) {
        details.push(`🛡️ 외부 글 참조 ${externalResult.count}개 제거: ${externalResult.found.join(', ')}`);
    }
    processed = externalResult.html;

    // 3) AI 패턴 자동 대체 (반복 표현 다양화)
    let aiReplacements = 0;
    for (const { pattern, replacement } of AI_REPLACEMENTS) {
        let idx = 0;
        processed = processed.replace(pattern, (match) => {
            idx++;
            // 첫 번째 매치는 유지, 2번째부터 대체
            if (idx >= 2) {
                aiReplacements++;
                return replacement;
            }
            return match;
        });
        pattern.lastIndex = 0;
    }
    if (aiReplacements > 0) {
        details.push(`🔧 AI 패턴 ${aiReplacements}건 자동 대체`);
    }

    // 4) 연속된 빈 줄·잔여 공백 정리
    processed = processed.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n');

    const totalIssues = seriesResult.count + externalResult.count;
    const pass = totalIssues === 0;
    if (pass) {
        details.push('✅ 시리즈·외부참조 위반 0건');
    }

    return {
        html: processed,
        report: {
            seriesPatternsRemoved: seriesResult.count,
            externalRefsRemoved: externalResult.count,
            aiPatternReplacements: aiReplacements,
            pass,
            details,
        },
    };
}
