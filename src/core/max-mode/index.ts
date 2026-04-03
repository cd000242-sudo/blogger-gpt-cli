// src/core/max-mode/index.ts
// MAX 모드 모듈 통합 re-export
// ⚡ 모듈화된 모드는 content-modes/mode-registry.ts를 통해 우선 처리됨

// 모듈화된 모드 자동 등록 (side-effect import)
import '../content-modes/adsense/adsense-mode';

// Types & Interfaces
export type { MaxModeSection, ContentModeConfig } from './types-interfaces';

// Tone & Text Utilities (internal helpers, not exported from original but used by modules)
// getToneInstruction and truncateText were not exported in the original file

// Color CTA
export { generateRandomColorCTA } from './color-cta';

// Section Configs
export {
  SCHEDULE_MODE_SECTIONS,
  MAX_MODE_SECTIONS,
  CONTENT_MODE_CONFIGS,
} from './section-configs';

// Prompt Builders
export {
  buildMaxModePrompt,
  buildMaxModeTitlePrompt,
  buildMaxModeOutlinePrompt,
  buildMaxModePromptWithSubtopic,
} from './prompt-builders';

// Extended Mode Sections
export {
  SPIDERWEBBING_MODE_SECTIONS,
  ADSENSE_MODE_SECTIONS,
  SHOPPING_MODE_SECTIONS,
  PARAPHRASING_MODE_SECTIONS,
  UPDATED_CONTENT_MODE_CONFIGS,
  ADSENSE_APPROVAL_MODE_SECTIONS,
  SHOPPING_CONVERSION_MODE_SECTIONS,
  INTERNAL_CONSISTENCY_SECTIONS,
  PARAPHRASING_PROFESSIONAL_MODE_SECTIONS,
  CONTENT_MODE_SECTIONS_MAP,
} from './mode-sections-extended';

// Content Mode Prompt
export { buildContentModePrompt } from './content-mode-prompt';
