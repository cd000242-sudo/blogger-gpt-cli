// src/core/content-modes/mode-interface.ts
// 모든 콘텐츠 모드가 구현해야 하는 공통 인터페이스

import type { MaxModeSection, ContentModeConfig } from '../max-mode-structure';

/**
 * 섹션 프롬프트 빌드에 필요한 파라미터
 */
export interface PromptParams {
    topic: string;
    keywords: string[];
    section: MaxModeSection;
    subtopic: string;
    manualCta?: { url: string; text: string; hook?: string | undefined } | undefined;
    researchData?: any[] | undefined;
    extractedData?: { dates?: string[]; numbers?: string[]; prices?: string[]; percentages?: string[] } | undefined;
    platform?: string | undefined;
    toneStyle?: string | undefined;
    targetYear?: number | null | undefined;
    draftContext?: string | undefined;
    timestamp?: number | undefined;
    randomSeed?: number | undefined;
    trendKeywords?: string[] | undefined;
    authorInfo?: {
        name: string;
        title: string;
        credentials: string;
    } | undefined;
}

/**
 * 콘텐츠 모드 플러그인 인터페이스
 * 각 모드(adsense, shopping, external 등)가 이 인터페이스를 구현하여
 * mode-registry에 등록하면, 기존 max-mode-structure.ts의 함수들이
 * 자동으로 모듈화된 로직을 우선 사용합니다.
 */
export interface ContentModePlugin {
    /** 모드 고유 ID (예: 'adsense', 'shopping') */
    id: string;

    /** 모드 설정 (이름, 설명, 톤, 전략 등) */
    config: ContentModeConfig;

    /** 섹션 구조 배열 */
    sections: MaxModeSection[];

    // ──────────────────────────────────────────
    // 필수 구현: 프롬프트 빌더
    // ──────────────────────────────────────────

    /** 개별 섹션 프롬프트 생성 */
    buildSectionPrompt(params: PromptParams): string;

    /** 제목 프롬프트 생성 */
    buildTitlePrompt(topic: string, keywords: string[], trendKeywords?: string[]): string;

    /** 아웃라인(소제목 구조) 프롬프트 생성 */
    buildOutlinePrompt(topic: string, keywords: string[], targetYear?: number | null): string;

    // ──────────────────────────────────────────
    // 선택 구현: 확장 기능
    // ──────────────────────────────────────────

    /** 모드 전용 CSS 생성 (없으면 공통 CSS 사용) */
    generateCSS?(): string;

    /** 생성된 HTML 후처리 (AI 탐지 방지 등) */
    postProcess?(html: string): { html: string; report?: any };
}
