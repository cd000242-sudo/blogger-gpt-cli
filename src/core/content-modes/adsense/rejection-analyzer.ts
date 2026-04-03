// src/core/content-modes/adsense/rejection-analyzer.ts
// 거절 사유 분석 및 수정 우선순위 제안

/**
 * Google AdSense 거절 사유 코드
 */
export type RejectionReason =
    | 'low_value_content'
    | 'copied_content'
    | 'site_navigation'
    | 'policy_violation'
    | 'missing_pages'
    | 'insufficient_content'
    | 'traffic_manipulation'
    | 'existing_ads'
    | 'not_responsive'
    | 'unclear_author'
    | 'under_review'
    | 'other';

export interface RejectionAction {
    priority: number;       // 1(최우선) ~ 5
    action: string;
    detail: string;
    estimatedDays: number;  // 예상 소요일
}

export interface RejectionAnalysis {
    reason: RejectionReason;
    reasonLabel: string;
    severity: 'critical' | 'major' | 'minor';
    description: string;
    actions: RejectionAction[];
    preventionTips: string[];
}

// ── 거절 사유별 분석 데이터 ──
const REJECTION_DATABASE: Record<RejectionReason, Omit<RejectionAnalysis, 'reason'>> = {
    low_value_content: {
        reasonLabel: '저가치 콘텐츠',
        severity: 'critical',
        description: '콘텐츠가 독자에게 충분한 가치를 제공하지 못한다고 판단됨',
        actions: [
            { priority: 1, action: '모든 글의 글자수를 2000자 이상으로 확장', detail: '각 글에 구체적 사례, 데이터, 비교 분석 추가', estimatedDays: 7 },
            { priority: 2, action: '직접 경험 섹션 강화', detail: '1인칭 Before/After, 구체적 수치 포함', estimatedDays: 5 },
            { priority: 3, action: 'FAQ 섹션 추가', detail: 'Schema.org 마크업 포함된 FAQ 6-8개', estimatedDays: 3 },
            { priority: 4, action: '이미지/표/그래프 추가', detail: '설명적 alt 태그와 함께 시각 자료 보강', estimatedDays: 3 },
        ],
        preventionTips: ['매 글마다 "이 글이 없으면 독자가 뭘 잃는가?" 자문하기', 'E-E-A-T 4가지 축 모두 충족하는지 확인'],
    },
    copied_content: {
        reasonLabel: '복제/도용 콘텐츠',
        severity: 'critical',
        description: '다른 사이트와 유사한 콘텐츠가 감지됨',
        actions: [
            { priority: 1, action: '표절 의심 글 전수 검사', detail: 'Copyscape 또는 유사 도구로 확인', estimatedDays: 2 },
            { priority: 1, action: '유사 콘텐츠 완전 재작성', detail: '같은 주제라도 완전히 다른 관점/경험으로', estimatedDays: 10 },
            { priority: 2, action: '직접 경험 기반 독창적 콘텐츠 추가', detail: '다른 곳에서 찾을 수 없는 인사이트', estimatedDays: 7 },
        ],
        preventionTips: ['크롤링 데이터를 그대로 사용하지 말고 참고만 할 것', 'AI 후처리로 Burstiness/종결어미 다양성 확인'],
    },
    site_navigation: {
        reasonLabel: '사이트 탐색 어려움',
        severity: 'major',
        description: '사이트 구조가 복잡하거나 내비게이션이 불충분',
        actions: [
            { priority: 1, action: '메뉴/내비게이션 위젯 추가', detail: '카테고리별 명확한 메뉴 구성', estimatedDays: 1 },
            { priority: 2, action: '카테고리 정리', detail: '3-5개 주요 카테고리로 정리, 빈 카테고리 제거', estimatedDays: 1 },
            { priority: 3, action: '내부링크 강화', detail: '관련 글 추천 섹션 추가 (각 글 하단)', estimatedDays: 3 },
        ],
        preventionTips: ['사이트맵 제출 확인', '각 글에 관련 글 3개 이상 내부링크'],
    },
    policy_violation: {
        reasonLabel: 'AdSense 정책 위반',
        severity: 'critical',
        description: 'Google AdSense 콘텐츠 정책에 위반되는 내용 감지',
        actions: [
            { priority: 1, action: '성인/도박/마약/무기 관련 콘텐츠 즉시 삭제', detail: '의심되는 모든 글 검토', estimatedDays: 1 },
            { priority: 2, action: '저작권 침해 이미지 교체', detail: '무료 이미지 사이트 또는 직접 촬영', estimatedDays: 3 },
        ],
        preventionTips: ['Google AdSense 콘텐츠 정책 숙지', '의심스러운 콘텐츠는 미리 제거'],
    },
    missing_pages: {
        reasonLabel: '필수 페이지 누락',
        severity: 'major',
        description: '개인정보처리방침, 면책조항, 소개, 연락처 중 누락',
        actions: [
            { priority: 1, action: '필수 페이지 자동 생성 기능 사용', detail: '4개 페이지 원클릭 발행', estimatedDays: 1 },
        ],
        preventionTips: ['신청 전 4개 페이지 존재 여부 반드시 확인'],
    },
    insufficient_content: {
        reasonLabel: '불충분한 콘텐츠 양',
        severity: 'major',
        description: '게시글 수가 너무 적음 (일반적으로 15개 미만)',
        actions: [
            { priority: 1, action: '고품질 글 15개 이상 확보', detail: '각 2000자+ 독창적 콘텐츠', estimatedDays: 14 },
            { priority: 2, action: '콘텐츠 다양성 확보', detail: '가이드/리뷰/정보/경험 균형', estimatedDays: 7 },
        ],
        preventionTips: ['최소 20개 글 확보 후 신청 권장', '양보다 질 우선'],
    },
    traffic_manipulation: {
        reasonLabel: '트래픽 조작',
        severity: 'critical',
        description: '비정상적 트래픽 패턴 감지',
        actions: [
            { priority: 1, action: '모든 유료 트래픽/교환 중단', detail: '자연 검색 트래픽만 허용', estimatedDays: 30 },
            { priority: 2, action: '30일 대기 후 재신청', detail: '트래픽 정상화 기간 필요', estimatedDays: 30 },
        ],
        preventionTips: ['SEO 기반 자연 트래픽 집중', '트래픽 교환 서비스 절대 사용 금지'],
    },
    existing_ads: {
        reasonLabel: '기존 광고 코드 존재',
        severity: 'major',
        description: '다른 광고 네트워크 코드가 이미 설치되어 있음',
        actions: [
            { priority: 1, action: '모든 기존 광고 코드 제거', detail: '다른 광고 네트워크, 배너 등 전부 삭제', estimatedDays: 1 },
        ],
        preventionTips: ['AdSense 승인 전까지 다른 광고 코드 설치 금지'],
    },
    not_responsive: {
        reasonLabel: '반응형 미지원',
        severity: 'major',
        description: '모바일에서 사이트가 제대로 표시되지 않음',
        actions: [
            { priority: 1, action: '반응형 Blogger 템플릿으로 변경', detail: '공식 Blogger 테마 중 반응형 선택', estimatedDays: 1 },
        ],
        preventionTips: ['Google Mobile-Friendly Test로 확인'],
    },
    unclear_author: {
        reasonLabel: '작성자 불명확',
        severity: 'major',
        description: '누가 운영하는 블로그인지 불명확',
        actions: [
            { priority: 1, action: 'About 페이지 작성', detail: '운영자 소개, 전문성, 블로그 목적 명시', estimatedDays: 1 },
            { priority: 2, action: '각 글에 작성자 소개 추가', detail: '관련 분야 경력/자격 간략 언급', estimatedDays: 3 },
        ],
        preventionTips: ['프로필 사진 설정', '관련 자격증/경력 구체적 기재'],
    },
    under_review: {
        reasonLabel: '검토 중',
        severity: 'minor',
        description: '아직 검토가 진행 중',
        actions: [
            { priority: 1, action: '2주 대기', detail: '검토 기간 동안 콘텐츠 계속 발행', estimatedDays: 14 },
        ],
        preventionTips: ['검토 중 콘텐츠 추가/수정 계속하기'],
    },
    other: {
        reasonLabel: '기타',
        severity: 'minor',
        description: '특정 사유가 명시되지 않은 거절',
        actions: [
            { priority: 1, action: '전체 블로그 진단 실행', detail: '25개 항목 체크리스트 기반 진단', estimatedDays: 1 },
            { priority: 2, action: '진단 결과 기반 수정', detail: '점수가 낮은 항목부터 우선 수정', estimatedDays: 7 },
        ],
        preventionTips: ['정기적으로 블로그 진단 실행'],
    },
};

/**
 * 거절 사유 분석
 */
export function analyzeRejection(reason: RejectionReason): RejectionAnalysis {
    const data = REJECTION_DATABASE[reason];
    return { reason, ...data };
}

/**
 * 여러 거절 사유 동시 분석 및 통합 액션 플랜 생성
 */
export function createRecoveryPlan(reasons: RejectionReason[]): {
    analyses: RejectionAnalysis[];
    prioritizedActions: RejectionAction[];
    estimatedTotalDays: number;
} {
    const analyses = reasons.map(r => analyzeRejection(r));

    // 모든 액션을 우선순위 순으로 정렬
    const allActions = analyses.flatMap(a => a.actions);
    const prioritizedActions = allActions
        .sort((a, b) => a.priority - b.priority)
        .filter((action, index, self) =>
            index === self.findIndex(a => a.action === action.action) // 중복 제거
        );

    const estimatedTotalDays = Math.max(...prioritizedActions.map(a => a.estimatedDays));

    return { analyses, prioritizedActions, estimatedTotalDays };
}
