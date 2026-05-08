// src/core/final/source-verifier.ts
// 🛡️ 출처 인용 환각 검증 — 휴리스틱 (외부 API 없이 코드만)
//
// AI가 "통계청에 따르면 87.3%" 같은 인용을 만들 때, 그게 진짜 데이터인지
// 휴리스틱으로 의심도를 측정한다. 외부 API 호출 0, 빠르고 안전.
//
// 측정 신호 (5개):
//   1. 인용 옆 구체성 — 조사명·연도·문서명 동반 여부
//   2. 숫자 합리성 — 퍼센트 0~100, 이상 수치 검출
//   3. 같은 기관 반복도 — 1글에서 5회 초과 = 의심
//   4. 미래/너무 먼 과거 연도 — 본문에 인용된 연도가 합리적 범위인지
//   5. 외국 출처 한도 — McKinsey/Statista 등 1회 초과 시 (prompt가 1회 제한 강제)
//
// 결과: 0~100 의심도 점수 (낮을수록 신뢰). 임계값 50 초과 시 경고.

const KOREAN_INSTITUTIONS = [
    '통계청', 'KOSIS', '한국소비자원', '한국은행', 'ECOS', '보건복지부',
    '국립국어원', '기획재정부', '국세청', '국토교통부', '고용노동부',
    '식품의약품안전처', '식약처', '금융감독원', '금융위원회',
    '산업통상자원부', '교육부', '환경부', '행정안전부',
    '국가법령정보센터', '공공데이터포털', 'e-나라지표',
];

const FOREIGN_INSTITUTIONS = [
    'McKinsey', 'Statista', 'Gartner', 'Forrester', 'PwC', 'Deloitte',
    'Bloomberg', 'Reuters', 'Forbes', 'Harvard', 'Stanford', 'MIT',
];

const SPECIFIC_KEYWORDS = [
    '조사', '연구', '발표', '보고서', '백서', '통계', '데이터', '자료',
    '인구주택총조사', '경제활동인구조사', '가계동향조사', '소비자물가지수',
];

export interface CitationFinding {
    institution: string;
    text: string;        // 인용 문맥 (앞뒤 30자)
    hasSpecific: boolean; // 조사명/연도 동반 여부
    suspectedReason?: string;
}

export interface SourceVerifyResult {
    suspicionScore: number;        // 0~100 (낮을수록 신뢰)
    citationCount: number;
    foundCitations: CitationFinding[];
    signals: {
        specificityScore: number;   // 0~25 (구체성 부족 시 점수 ↑)
        numericSanityScore: number; // 0~25
        repetitionScore: number;    // 0~25
        yearSanityScore: number;    // 0~15
        foreignOveruseScore: number; // 0~10
    };
    summary: string;
}

const CURRENT_YEAR = new Date().getFullYear();

/**
 * 본문에서 기관 인용을 추출하고 휴리스틱 검증.
 * @param text - HTML 태그가 제거된 본문 텍스트
 */
export function verifyCitationHeuristics(text: string): SourceVerifyResult {
    const findings: CitationFinding[] = [];
    const institutionCounts: Record<string, number> = {};

    // 1) 한국 기관 인용 추출 — indexOf 루프로 정확한 등장 횟수 카운트
    //    이전 정규식 (.{0,50}) 후행 캡처가 lastIndex를 과다 진행시켜 인접 매치를 흡수하던 버그 수정
    for (const inst of KOREAN_INSTITUTIONS) {
        let searchFrom = 0;
        while (true) {
            const idx = text.indexOf(inst, searchFrom);
            if (idx < 0) break;
            const before = text.slice(Math.max(0, idx - 30), idx);
            const after = text.slice(idx + inst.length, idx + inst.length + 50);
            const ctx = (before + inst + after).slice(0, 100);
            const hasYear = /(20\d{2})\s*년?/.test(after) || /(20\d{2})\s*년?/.test(before);
            const hasSpecificDoc = SPECIFIC_KEYWORDS.some(kw => after.includes(kw) || before.includes(kw));
            const finding: CitationFinding = {
                institution: inst,
                text: ctx,
                hasSpecific: hasYear && hasSpecificDoc,
            };
            if (!hasYear && !hasSpecificDoc) {
                finding.suspectedReason = '연도·조사명 동반 없음';
            }
            findings.push(finding);
            institutionCounts[inst] = (institutionCounts[inst] || 0) + 1;
            searchFrom = idx + inst.length;
        }
    }

    // 2) 신호 1: 구체성 — 인용 중 hasSpecific 비율
    const totalCitations = findings.length;
    const specificCount = findings.filter(f => f.hasSpecific).length;
    const specificRatio = totalCitations > 0 ? specificCount / totalCitations : 1;
    const specificityScore = Math.round(25 * (1 - specificRatio));

    // 3) 신호 2: 숫자 합리성 — 본문 숫자 패턴 검사
    let numericSanityScore = 0;
    const percentMatches = text.match(/(\d+(?:\.\d+)?)\s*%/g) || [];
    for (const pm of percentMatches) {
        const n = parseFloat(pm.replace('%', '').trim());
        if (n > 100 || n < 0) {
            numericSanityScore = Math.min(25, numericSanityScore + 8);
        }
    }
    // 인구 수 같은 큰 숫자 sanity (5천만 부근이 정상)
    const populationMatch = text.match(/(\d+(?:\.\d+)?)\s*억\s*(\d+(?:\.\d+)?)\s*만\s*명/);
    if (populationMatch) {
        const eok = parseFloat(populationMatch[1] || '0');
        if (eok > 1) numericSanityScore = Math.min(25, numericSanityScore + 5); // 1억명 초과는 한국 인구 아님
    }

    // 4) 신호 3: 같은 기관 반복도
    let repetitionScore = 0;
    const maxRepeat = Math.max(0, ...Object.values(institutionCounts));
    if (maxRepeat > 5) {
        repetitionScore = Math.min(25, (maxRepeat - 5) * 4);
    }

    // 5) 신호 4: 연도 합리성 — 본문에 등장하는 연도가 미래/너무 먼 과거?
    let yearSanityScore = 0;
    const yearMatches = text.match(/20\d{2}/g) || [];
    const uniqueYears = Array.from(new Set(yearMatches));
    for (const y of uniqueYears) {
        const yi = parseInt(y, 10);
        if (yi > CURRENT_YEAR + 1) yearSanityScore = Math.min(15, yearSanityScore + 5); // 미래 연도
        if (yi < CURRENT_YEAR - 10) yearSanityScore = Math.min(15, yearSanityScore + 3); // 10년 이상 과거
    }

    // 6) 신호 5: 외국 출처 과다
    let foreignOveruseScore = 0;
    let foreignTotal = 0;
    for (const inst of FOREIGN_INSTITUTIONS) {
        const re = new RegExp(inst, 'gi');
        const m = text.match(re);
        if (m) foreignTotal += m.length;
    }
    if (foreignTotal > 1) {
        foreignOveruseScore = Math.min(10, (foreignTotal - 1) * 3);
    }

    // 합산 의심도
    const suspicionScore = specificityScore + numericSanityScore + repetitionScore + yearSanityScore + foreignOveruseScore;

    const summary = totalCitations === 0
        ? '⚠️ 인용된 한국 공공기관 출처 없음 — E-E-A-T 부족'
        : suspicionScore < 25
            ? `✅ 출처 신뢰도 양호 (인용 ${totalCitations}건, 의심도 ${suspicionScore}/100)`
            : suspicionScore < 50
                ? `⚠️ 출처 일부 의심 (인용 ${totalCitations}건, 의심도 ${suspicionScore}/100) — 구체성 ${specificityScore}, 숫자 ${numericSanityScore}, 반복 ${repetitionScore}, 연도 ${yearSanityScore}, 외국 ${foreignOveruseScore}`
                : `❌ 출처 환각 의심 높음 (인용 ${totalCitations}건, 의심도 ${suspicionScore}/100) — AI가 가짜 통계를 만들었을 가능성. 본문 검토 권장`;

    return {
        suspicionScore,
        citationCount: totalCitations,
        foundCitations: findings.slice(0, 10),
        signals: {
            specificityScore,
            numericSanityScore,
            repetitionScore,
            yearSanityScore,
            foreignOveruseScore,
        },
        summary,
    };
}
