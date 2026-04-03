// src/core/content-modes/adsense/content-planner.ts
// 콘텐츠 포트폴리오 다양성 엔진
// 카테고리별 콘텐츠 비율 분석 + 추천

/**
 * 콘텐츠 유형
 */
export type ContentType = 'guide' | 'review' | 'info' | 'experience' | 'comparison' | 'news';

export interface ContentDistribution {
    type: ContentType;
    label: string;
    count: number;
    percentage: number;
    target: number;       // 목표 비율 (%)
    status: 'good' | 'low' | 'excess';
}

export interface PlannerResult {
    totalPosts: number;
    distribution: ContentDistribution[];
    recommendations: string[];
    diversityScore: number;  // 0-100
}

// ── 목표 비율 (Google 권장) ──
const TARGET_RATIOS: Record<ContentType, { label: string; target: number }> = {
    guide: { label: '📋 가이드/튜토리얼', target: 35 },
    review: { label: '⭐ 리뷰/비교', target: 20 },
    info: { label: '📰 정보/뉴스', target: 15 },
    experience: { label: '💡 경험/사례', target: 15 },
    comparison: { label: '📊 비교분석', target: 10 },
    news: { label: '🔔 최신소식', target: 5 },
};

/**
 * 콘텐츠 유형 자동 분류 (제목 기반 휴리스틱)
 */
export function classifyContentType(title: string): ContentType {
    const lower = title.toLowerCase();

    if (/방법|하는\s*법|가이드|튜토리얼|step|단계|설치|설정|사용법/.test(lower)) return 'guide';
    if (/리뷰|후기|사용기|솔직|장단점/.test(lower)) return 'review';
    if (/비교|차이|vs|구분|어떤.*좋|추천.*선택/.test(lower)) return 'comparison';
    if (/경험|실제|직접|시행착오|실패|성공|도전/.test(lower)) return 'experience';
    if (/최신|업데이트|변경|소식|발표|출시/.test(lower)) return 'news';

    return 'info'; // 기본값
}

/**
 * 콘텐츠 포트폴리오 분석
 */
export function analyzeContentDiversity(postTitles: string[]): PlannerResult {
    const total = postTitles.length;
    if (total === 0) {
        return {
            totalPosts: 0,
            distribution: Object.entries(TARGET_RATIOS).map(([type, info]) => ({
                type: type as ContentType,
                label: info.label,
                count: 0,
                percentage: 0,
                target: info.target,
                status: 'low' as const,
            })),
            recommendations: ['콘텐츠가 없습니다. 최소 15개 이상 작성을 시작하세요.'],
            diversityScore: 0,
        };
    }

    // 유형별 분류
    const counts: Record<ContentType, number> = {
        guide: 0, review: 0, info: 0, experience: 0, comparison: 0, news: 0,
    };

    for (const title of postTitles) {
        const type = classifyContentType(title);
        counts[type]++;
    }

    // 분포 계산
    const distribution: ContentDistribution[] = Object.entries(TARGET_RATIOS).map(([type, info]) => {
        const count = counts[type as ContentType];
        const percentage = Math.round((count / total) * 100);
        const diff = percentage - info.target;

        return {
            type: type as ContentType,
            label: info.label,
            count,
            percentage,
            target: info.target,
            status: diff >= -5 && diff <= 10 ? 'good' : diff < -5 ? 'low' : 'excess',
        };
    });

    // 추천 생성
    const recommendations: string[] = [];
    for (const dist of distribution) {
        if (dist.status === 'low') {
            const needed = Math.max(1, Math.ceil((dist.target / 100) * total) - dist.count);
            recommendations.push(`${dist.label}: ${needed}개 추가 작성 권장 (현재 ${dist.percentage}% → 목표 ${dist.target}%)`);
        }
        if (dist.status === 'excess') {
            recommendations.push(`${dist.label}: 비율이 높음 (${dist.percentage}%). 다른 유형의 콘텐츠를 추가하세요.`);
        }
    }

    if (total < 15) {
        recommendations.unshift(`⚠️ 총 ${total}개 — AdSense 신청에는 최소 15개 필요합니다.`);
    }

    // 다양성 점수 (평균 편차 기반)
    const avgDeviation = distribution.reduce((sum, d) => sum + Math.abs(d.percentage - d.target), 0) / distribution.length;
    const diversityScore = Math.max(0, Math.round(100 - avgDeviation * 2));

    return { totalPosts: total, distribution, recommendations, diversityScore };
}
