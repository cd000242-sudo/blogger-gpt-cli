// src/core/content-modes/index.ts
// 하위호환 barrel 파일
// 기존 코드의 import 경로를 깨뜨리지 않으면서 새 모듈화 API도 제공

// ──────────────────────────────────────────
// 기존 max-mode-structure.ts 호환 re-export
// ──────────────────────────────────────────
export type { MaxModeSection, ContentModeConfig } from '../max-mode-structure';

export {
    // 섹션 구조
    SCHEDULE_MODE_SECTIONS,
    MAX_MODE_SECTIONS,
    SPIDERWEBBING_MODE_SECTIONS,
    ADSENSE_MODE_SECTIONS,
    ADSENSE_APPROVAL_MODE_SECTIONS,
    SHOPPING_MODE_SECTIONS,
    SHOPPING_CONVERSION_MODE_SECTIONS,
    INTERNAL_CONSISTENCY_SECTIONS,
    PARAPHRASING_MODE_SECTIONS,
    PARAPHRASING_PROFESSIONAL_MODE_SECTIONS,
    // 설정
    CONTENT_MODE_CONFIGS,
    UPDATED_CONTENT_MODE_CONFIGS,
    CONTENT_MODE_SECTIONS_MAP,
    // 프롬프트 빌더
    buildMaxModePrompt,
    buildMaxModeTitlePrompt,
    buildMaxModeOutlinePrompt,
    buildMaxModePromptWithSubtopic,
    buildContentModePrompt,
    // 유틸
    generateRandomColorCTA,
} from '../max-mode-structure';

// ──────────────────────────────────────────
// 새 모듈화 API
// ──────────────────────────────────────────
export type { ContentModePlugin, PromptParams } from './mode-interface';
export { registerMode, getMode, getAllModes, hasMode, getRegisteredModeIds } from './mode-registry';
export {
    getToneInstruction,
    getRandomColorPalette,
    generateRandomColorCTA as baseGenerateRandomColorCTA,
    truncateText,
    buildYearGuideline,
    generateUniqueContentId,
    isWordPressPlatform,
} from './base-prompt-builder';
