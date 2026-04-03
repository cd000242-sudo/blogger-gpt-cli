// src/core/content-modes/adsense/adsense-mode.ts
// 애드센스 끝판왕 모듈 — ContentModePlugin 완전한 구현체
// mode-registry에 자동 등록

import type { ContentModeConfig } from '../../max-mode-structure';
import type { ContentModePlugin, PromptParams } from '../mode-interface';
import { registerMode } from '../mode-registry';
import { ADSENSE_ULTIMATE_SECTIONS } from './adsense-sections';
import { buildAdsenseSectionPrompt, buildAdsenseTitlePrompt, buildAdsenseOutlinePrompt } from './adsense-prompt-builder';
import { generateAdsenseCleanCSS, stripAdRelatedCSS } from './adsense-css';
import { postProcessForApproval } from './adsense-post-processor';

/**
 * 애드센스 모드 전용 설정
 */
const ADSENSE_CONFIG: ContentModeConfig = {
    name: '애드센스 승인 끝판왕 모드',
    description: '2026년 최신 정책 반영 — E-E-A-T 극대화, AI 탐지 방지, CTA 완전 제거',
    titleStrategy: '교육적 가치 + 전문성이 느껴지는 제목, 수익/광고 표현 절대 금지',
    sectionStrategy: '작성자 소개→주제 이해→직접 경험→단계별 가이드→비교 분석→FAQ(Schema)→마무리 리소스',
    tone: '전문적이면서도 인간적인 톤. 1인칭 경험 기반, 객관적 데이터 인용, 과장 표현 0',
    ctaStrategy: '광고/CTA 완전 제거. 자연스러운 내부링크와 관련 정보 제공만 허용',
};

/**
 * 애드센스 끝판왕 플러그인 구현체
 */
const adsenseModePlugin: ContentModePlugin = {
    id: 'adsense',
    config: ADSENSE_CONFIG,
    sections: ADSENSE_ULTIMATE_SECTIONS,

    // ── 프롬프트 빌더 ──
    buildSectionPrompt(params: PromptParams): string {
        return buildAdsenseSectionPrompt(params);
    },

    buildTitlePrompt(topic: string, keywords: string[], trendKeywords?: string[]): string {
        return buildAdsenseTitlePrompt(topic, keywords, trendKeywords);
    },

    buildOutlinePrompt(topic: string, keywords: string[], targetYear?: number | null): string {
        return buildAdsenseOutlinePrompt(topic, keywords, targetYear);
    },

    // ── CSS 생성 ──
    generateCSS(): string {
        return generateAdsenseCleanCSS();
    },

    // ── HTML 후처리 (AI 탐지 방지 + CTA 잔여물 제거) ──
    postProcess(html: string): { html: string; report: any } {
        // 1단계: CSS 레벨 CTA 제거
        const cssCleanedHtml = stripAdRelatedCSS(html);

        // 2단계: 콘텐츠 레벨 후처리
        const result = postProcessForApproval(cssCleanedHtml);

        return {
            html: result.html,
            report: result.report,
        };
    },
};

// ── 모드 자동 등록 ──
// 이 파일이 import 되는 시점에 레지스트리에 등록됨
registerMode(adsenseModePlugin);

export { adsenseModePlugin };
export default adsenseModePlugin;
