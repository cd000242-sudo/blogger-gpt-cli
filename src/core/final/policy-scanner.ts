// src/core/final/policy-scanner.ts
// 🛡️ AdSense 정책 위반 사전 스캔
//
// 발행 전 AdSense Programme Policies(2024-2026 버전) 위반 패턴을 자동 검사한다.
// 거절 사유 1순위(금지 콘텐츠·과장 표현·YMYL 면책 누락)을 차단해 승인률을 끌어올린다.
//
// 위반 분류:
//   1) prohibited (즉시 차단) — 성인·도박·마약·무기·헤이트
//   2) restricted (경고) — YMYL(의료/금융/법률) 면책 누락
//   3) misleading (경고) — 100% 보장·절대 안 망함 류 과장
//   4) deceptive (경고) — 클릭베이트·가짜 통계
//
// 중요: false positive 최소화 — 일상 단어와 충돌하는 패턴은 단어 경계 명시.

export type PolicyViolation = {
    severity: 'block' | 'warn';
    category: 'prohibited' | 'restricted' | 'misleading' | 'deceptive';
    pattern: string;
    matched: string;
    fix: string;
};

export interface PolicyScanResult {
    safe: boolean;          // block 위반 0건이면 true
    score: number;          // 100 - (block × 30) - (warn × 5), 음수 클램프
    violations: PolicyViolation[];
    summary: string;
}

// ─── 즉시 차단 패턴 (prohibited) ───
const PROHIBITED_PATTERNS: Array<{ re: RegExp; cat: string }> = [
    // 성인 콘텐츠
    { re: /(성인\s*동영상|야동|섹스\s*비디오|포르노|음란물|불법\s*촬영물)/g, cat: '성인' },
    // 도박
    { re: /(불법\s*도박|온라인\s*카지노\s*승률|토토\s*사이트\s*추천|배팅\s*추천)/g, cat: '도박' },
    // 마약
    { re: /(마약\s*구입|대마초\s*구입|필로폰\s*판매|향정신성\s*약물\s*구매)/g, cat: '마약' },
    // 무기
    { re: /(불법\s*총기|폭발물\s*제조|사제\s*폭탄|화염병\s*제조법)/g, cat: '무기' },
    // 헤이트
    { re: /(특정\s*인종\s*혐오|성소수자\s*공격|장애인\s*비하)/g, cat: '혐오' },
    // 해킹·악성
    { re: /(해킹\s*도구\s*판매|크랙\s*다운로드|시리얼\s*키\s*공유)/g, cat: '해킹' },
];

// ─── YMYL 키워드 — 면책 조항 필수 (restricted) ───
const YMYL_PATTERNS: Array<{ re: RegExp; topic: string; mustHave: RegExp }> = [
    {
        re: /(처방|복용량|용법|치료법|증상|진단|약물\s*상호\s*작용)/g,
        topic: '의료',
        mustHave: /(전문의\s*상담|의료진\s*상담|병원\s*방문|의사\s*상담|건강\s*전문가)/,
    },
    {
        re: /(투자\s*수익률|주식\s*추천|코인\s*투자|레버리지|선물\s*거래)/g,
        topic: '금융',
        mustHave: /(투자\s*위험|손실\s*가능|전문가\s*상담|책임은\s*본인|투자\s*결정은)/,
    },
    {
        re: /(법률\s*자문|소송\s*승소|이혼\s*소송|상속\s*분쟁)/g,
        topic: '법률',
        mustHave: /(변호사\s*상담|법률\s*전문가|사안마다\s*다름|개별\s*상담)/,
    },
];

// ─── 과장·오인 표현 (misleading) ───
const MISLEADING_PATTERNS: Array<{ re: RegExp; reason: string }> = [
    { re: /100%\s*(보장|성공|합격|확실|완벽)/g, reason: '근거 없는 절대적 보장' },
    { re: /절대\s*(안\s*망함|실패\s*없음|손해\s*없음)/g, reason: '근거 없는 절대 부정' },
    { re: /무조건\s*(합격|성공|이득|수익)/g, reason: '무조건 단언' },
    { re: /(최저가|최고가)\s*보장/g, reason: '가격 보장 표현' },
    { re: /(유일한|단\s*하나의|국내\s*1위)\s+(?!블로그|글|포스트)/g, reason: '근거 없는 우월성' },
];

// ─── 클릭베이트·기만 (deceptive) ───
const DECEPTIVE_PATTERNS: Array<{ re: RegExp; reason: string }> = [
    { re: /(충격|소름|경악|미친)\s*[!?]/g, reason: '클릭베이트 감정 어휘' },
    { re: /(아무도\s*모르는|숨겨진\s*비밀|당신만\s*아는)/g, reason: '미스터리 클릭베이트' },
    { re: /(놓치면\s*후회|지금\s*안\s*보면\s*손해)/g, reason: 'FOMO 압박' },
    { re: /(\d+%\s*할인|즉시\s*수익|당장\s*돈)/g, reason: '즉시성 자극' },
];

/**
 * 본문 텍스트(HTML 태그 제거된 순수 텍스트)에 대해 정책 스캔 수행.
 */
export function scanAdsensePolicy(html: string): PolicyScanResult {
    // HTML 태그 제거 (간단 휴리스틱 — 정책 스캔은 텍스트만 대상)
    const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z]+;/gi, ' ');

    const violations: PolicyViolation[] = [];

    // 1) prohibited — 즉시 block
    for (const { re, cat } of PROHIBITED_PATTERNS) {
        re.lastIndex = 0;
        const matches = text.match(re);
        if (matches) {
            const sample = Array.from(new Set(matches)).slice(0, 3).join(', ');
            violations.push({
                severity: 'block',
                category: 'prohibited',
                pattern: cat,
                matched: sample,
                fix: `"${cat}" 관련 표현을 본문에서 모두 제거해 주세요. AdSense 즉시 거절 사유입니다.`,
            });
        }
    }

    // 2) YMYL — 키워드 있는데 면책 없으면 warn
    for (const { re, topic, mustHave } of YMYL_PATTERNS) {
        re.lastIndex = 0;
        const hits = text.match(re);
        if (hits && hits.length > 0) {
            mustHave.lastIndex = 0;
            if (!mustHave.test(text)) {
                violations.push({
                    severity: 'warn',
                    category: 'restricted',
                    pattern: `YMYL-${topic}`,
                    matched: Array.from(new Set(hits)).slice(0, 3).join(', '),
                    fix: `${topic} 주제 — 글 끝부분에 "전문가/의사/변호사 상담 권장" 면책 조항을 추가해 주세요.`,
                });
            }
        }
    }

    // 3) misleading — warn
    for (const { re, reason } of MISLEADING_PATTERNS) {
        re.lastIndex = 0;
        const hits = text.match(re);
        if (hits && hits.length > 0) {
            violations.push({
                severity: 'warn',
                category: 'misleading',
                pattern: reason,
                matched: Array.from(new Set(hits)).slice(0, 3).join(', '),
                fix: `과장 표현 제거 — "${hits[0]}" 같은 절대적 보장 표현 대신 "도움이 될 수 있습니다", "참고하세요" 등으로 완화.`,
            });
        }
    }

    // 4) deceptive — warn
    for (const { re, reason } of DECEPTIVE_PATTERNS) {
        re.lastIndex = 0;
        const hits = text.match(re);
        if (hits && hits.length > 0) {
            violations.push({
                severity: 'warn',
                category: 'deceptive',
                pattern: reason,
                matched: Array.from(new Set(hits)).slice(0, 3).join(', '),
                fix: `클릭베이트/감정 자극 표현 완화 — "${hits[0]}" 같은 패턴은 AdSense 신뢰도 점수 감점 요인입니다.`,
            });
        }
    }

    // 점수 계산: 100 - (block × 30) - (warn × 5)
    const blockCount = violations.filter(v => v.severity === 'block').length;
    const warnCount = violations.filter(v => v.severity === 'warn').length;
    const score = Math.max(0, 100 - blockCount * 30 - warnCount * 5);
    const safe = blockCount === 0;

    const summary = safe && warnCount === 0
        ? '✅ AdSense 정책 검사 통과 (위반 0건)'
        : safe
            ? `⚠️ 경고 ${warnCount}건 — 발행은 가능하나 승인률 저하 가능 (점수 ${score})`
            : `❌ 즉시 차단 ${blockCount}건 — 발행 시 AdSense 거절 위험 (점수 ${score})`;

    return { safe, score, violations, summary };
}
