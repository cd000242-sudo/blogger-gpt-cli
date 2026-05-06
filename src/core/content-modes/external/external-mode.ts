// src/core/content-modes/external/external-mode.ts
// SEO 최적화 모드 — v3.5.81부터 정형 sections 적용
//   기존: sections [] 비어있어 mode-dispatcher가 h2Titles=null 반환 → AI 동적 생성 → 매번 다른 구조
//   변경: SEO_OPTIMIZED_MODE_SECTIONS (5섹션) 적용 → 다른 모드(adsense/shopping/internal/paraphrasing)와 동일하게
//        매번 같은 정형 H2로 호출. 검색 의도 3종(정보형/탐색형/거래형) 모두 커버.

import type { ContentModeConfig } from '../../max-mode-structure';
import type { ContentModePlugin, PromptParams } from '../mode-interface';
import { registerMode } from '../mode-registry';
import { buildIntentPromptBlock } from '../../search-intent-classifier';
import { SEO_OPTIMIZED_MODE_SECTIONS } from '../../max-mode/mode-sections-extended';

const EXTERNAL_CONFIG: ContentModeConfig = {
  name: 'SEO 최적화 모드',
  description: '5섹션 정형 (정의→원리→실전→비교→FAQ) + 검색 의도 자동 분류 + 크롤링 데이터',
  titleStrategy: '검색 의도(정보형/탐색형/거래형)에 맞는 클릭 유도형 제목',
  sectionStrategy: '5섹션 정형 (개념→특성→실전→비교→FAQ) — 검색 의도 모두 커버',
  tone: '자연스러운 정보 전달, 구체적 수치와 사례 중심',
  ctaStrategy: '정보형 CTA만 사용 (구매 명령형 금지)',
};

const externalModePlugin: ContentModePlugin = {
  id: 'external',
  config: EXTERNAL_CONFIG,
  sections: SEO_OPTIMIZED_MODE_SECTIONS,

  buildSectionPrompt(params: PromptParams): string {
    const sec = params.section;
    const reqs = (sec.requiredElements || []).map(r => `  - ${r}`).join('\n');
    const intentBlock = buildIntentPromptBlock(params.topic);
    return `${intentBlock}
역할: ${sec.role || 'SEO 콘텐츠 전문가'}
핵심: ${sec.contentFocus || '검색 의도에 맞는 정보의 깊이와 명확성'}
필수 요소:
${reqs}
(최소 ${sec.minChars || 700}자)
🎯 SEO 4원칙:
  - 두괄식 답변: 첫 문단에 핵심 답을 즉시 노출 (스크롤 없이 답 보이게)
  - 구체성 우선: 수치·사례·출처를 매 섹션에 주입 (두루뭉술한 일반론 금지)
  - 모바일 가독성: 단락 3~4문장 단위 + 불릿/표 적극 활용
  - 검색 의도 반영: 정보형은 정의→원리, 탐색형은 비교→장단점, 거래형은 절차→대안`;
  },

  buildTitlePrompt(topic: string, _keywords: string[], _trendKeywords?: string[]): string {
    return `"${topic}" 에 대한 SEO 최적화 제목 1개를 생성하세요. 검색 의도에 맞춰 클릭 유도형 30자 이내.`;
  },

  buildOutlinePrompt(topic: string, _keywords: string[], _targetYear?: number | null): string {
    return `"${topic}" 5섹션 정형: 개념 정의 → 핵심 특성 → 실전 활용 → 비교 가이드 → FAQ + 마무리. 검색 의도(정보형/탐색형/거래형) 모두 커버.`;
  },
};

registerMode(externalModePlugin);

export { externalModePlugin };
export default externalModePlugin;
