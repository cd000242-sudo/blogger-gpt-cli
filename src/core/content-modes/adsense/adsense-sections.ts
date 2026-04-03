// src/core/content-modes/adsense/adsense-sections.ts
// 애드센스 승인 전용 섹션 구조 — 끝판왕 버전
// E-E-A-T 강화 + FAQ 독립 섹션 + Schema.org 마크업

import type { MaxModeSection } from '../../max-mode-structure';

/**
 * 애드센스 승인 전문 모드 — 7개 섹션 구조
 * 기존 ADSENSE_APPROVAL_MODE_SECTIONS를 강화한 최종 버전
 */
export const ADSENSE_ULTIMATE_SECTIONS: MaxModeSection[] = [
    // ── 1. 작성자 소개 ──
    {
        id: 'author_intro',
        title: '작성자 소개',
        description: '전문성과 경험을 간단히 제시하여 E-E-A-T의 Experience와 Expertise를 확립하는 섹션',
        minChars: 350,
        role: '해당 분야 전문가',
        contentFocus: '전문 자격, 경력, 교육 배경, 직접 경험 연수 — 자연스러운 1인칭 서술',
        requiredElements: [
            '전문 자격증 또는 관련 경력 (구체적 연수)',
            '이 주제를 다루게 된 개인적 계기',
            '독자에게 약속하는 이 글의 가치',
            '마지막 업데이트 날짜 (2026년 N월 기준)',
        ],
    },

    // ── 2. 주제 완전 이해 ──
    {
        id: 'understanding_topic',
        title: '[주제] 완전히 이해하기',
        description: 'E-E-A-T의 핵심. 교육적 가치를 제공하며 Authority를 확립하는 섹션',
        minChars: 1000,
        role: '교육 전문가이자 실무자',
        contentFocus: '기본 개념 → 핵심 원리 → 실생활 적용. 독자 눈높이 맞춤 설명',
        requiredElements: [
            '핵심 개념 정의 (초보자도 이해 가능)',
            '왜 중요한지 3가지 이유 (데이터 기반)',
            '흔한 오해와 진실 (잘못 알려진 정보 바로잡기)',
            '신뢰할 수 있는 출처 인용 (정부기관, 학술논문)',
            '직접 촬영/제작한 이미지 제안 (alt 태그 포함)',
        ],
    },

    // ── 3. 직접 경험 ──
    {
        id: 'personal_experience',
        title: '제가 직접 해본 [실전 경험]',
        description: 'E-E-A-T Experience 핵심. 독창성의 핵심이 되는 직접 경험 섹션',
        minChars: 1500,
        role: '실전 경험 풍부한 전문가',
        contentFocus: '1인칭 직접 경험 — Before/After, 구체적 수치, 실패 경험도 솔직하게',
        requiredElements: [
            'Before & After 구체적 수치 (예: 사용 전 월 3만원 → 사용 후 월 8천원)',
            '시행착오 경험 (처음에 실패한 이유와 깨달은 점)',
            '다른 곳에서 찾을 수 없는 인사이트',
            '구체적 숫자 (비율, 금액, 시간 등)',
            '증빙 이미지 설명 (alt 태그 포함)',
        ],
    },

    // ── 4. 단계별 가이드 ──
    {
        id: 'step_by_step_guide',
        title: '단계별 실행 가이드',
        description: '실용적 가치 제공 — 독자가 따라할 수 있는 구체적 실행 가이드',
        minChars: 1000,
        role: '실무 가이드 전문가',
        contentFocus: '1단계~N단계 상세 설명, 각 단계 주의점, 체크포인트',
        requiredElements: [
            '무료 vs 유료 옵션 비교',
            '각 단계 상세 설명 (Step 1-N)',
            '각 단계마다 주의점과 확인 방법',
            '문제 발생 시 해결 방법',
            '각 단계별 스크린샷 설명 (alt 태그 포함)',
        ],
    },

    // ── 5. 비교 분석 ──
    {
        id: 'comparison_recommendation',
        title: '비교 분석 및 추천',
        description: 'Trustworthiness 강화 — 객관적이고 중립적인 비교 분석',
        minChars: 1000,
        role: '객관적 분석 전문가',
        contentFocus: '장단점 공평 분석, 상황별 맞춤 추천, 과장 표현 0',
        requiredElements: [
            '비교 표 (3개 이상 옵션 비교)',
            '수준별 추천 (초/중/고급)',
            '"제가 다시 시작한다면..." 관점',
            '광고성 정보 아닌 진짜 조언',
            '법적/안전 이슈 (해당시)',
        ],
    },

    // ── 6. FAQ (신규 독립 섹션) ──
    {
        id: 'faq_section',
        title: '자주 묻는 질문 (FAQ)',
        description: 'Schema.org FAQPage 구조화 데이터 포함 — 검색 결과 노출 최적화',
        minChars: 800,
        role: '질문 답변 전문가',
        contentFocus: '실제 독자가 궁금해할 질문 6-8개에 대한 명확하고 간결한 답변',
        requiredElements: [
            '실제 검색되는 질문 6-8개 (각 질문 + 답변)',
            '각 답변 2-4문장 (간결하고 정확)',
            'JSON-LD FAQPage Schema 마크업 생성',
            '관련 내부링크 자연 삽입',
            '질문은 H3 태그로 구성',
        ],
    },

    // ── 7. 마무리 및 리소스 ──
    {
        id: 'conclusion_resources',
        title: '마무리 및 추가 리소스',
        description: '마무리와 추가 가치 제공 — 내부링크 3개+ 필수',
        minChars: 1300,
        role: '종합 가이드 전문가',
        contentFocus: '핵심 요약, 추가 리소스, 관련 글 추천, 댓글 유도',
        requiredElements: [
            '핵심 내용 3줄 요약',
            '신뢰할 수 있는 외부 사이트 3-5개 (출처 링크)',
            '각 링크에 대한 설명',
            '마지막 업데이트 날짜',
            '댓글로 추가 질문 유도',
            '관련 글 추천 (내부링크 3개 이상)',
        ],
    },
];
