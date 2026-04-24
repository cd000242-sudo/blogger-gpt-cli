// src/core/content-modes/external/external-mode.ts
// SEO 최적화 모드 — 검색 의도 기반 H2 자동 생성
// sections 배열은 비워두고, h2Titles 는 orchestration 의 AI 생성 경로에 위임

import type { ContentModeConfig } from '../../max-mode-structure';
import type { ContentModePlugin, PromptParams } from '../mode-interface';
import { registerMode } from '../mode-registry';
import { buildIntentPromptBlock } from '../../search-intent-classifier';

const EXTERNAL_CONFIG: ContentModeConfig = {
  name: 'SEO 최적화 모드',
  description: '검색 의도 자동 분류 + 의도별 H2 아키타입 + 크롤링 데이터 기반 정보 전달',
  titleStrategy: '검색 의도(정보형/탐색형/거래형)에 맞는 클릭 유도형 제목',
  sectionStrategy: 'AI 생성 — 검색 의도에 맞는 H2 아키타입 자동 선택',
  tone: '자연스러운 정보 전달, 구체적 수치와 사례 중심',
  ctaStrategy: '정보형 CTA만 사용 (구매 명령형 금지)',
};

const externalModePlugin: ContentModePlugin = {
  id: 'external',
  config: EXTERNAL_CONFIG,
  // 빈 배열 — h2Titles 는 orchestration 의 generateH2TitlesFinal 이 AI 로 생성
  sections: [],

  buildSectionPrompt(params: PromptParams): string {
    const intentBlock = buildIntentPromptBlock(params.topic);
    return `${intentBlock}
역할: SEO 콘텐츠 전문가
핵심: 검색 의도에 맞는 정보의 깊이와 명확성
필수 요소:
  - 검색자가 즉시 답을 얻을 수 있는 두괄식 구조
  - 구체적 수치/통계/사례 (출처 명시)
  - 의도가 정보형이면 정의→원리→적용, 탐색형이면 비교→장단점, 거래형이면 리뷰→구매가이드
  - 모바일 가독성 (단락 3~4문장 단위)`;
  },

  buildTitlePrompt(topic: string, _keywords: string[], _trendKeywords?: string[]): string {
    return `"${topic}" 에 대한 SEO 최적화 제목 1개를 생성하세요. 검색 의도에 맞춰 클릭 유도형 30자 이내.`;
  },

  buildOutlinePrompt(topic: string, _keywords: string[], _targetYear?: number | null): string {
    return `"${topic}" 에 대한 H2 소제목 5~7개를 생성하세요. 검색 의도(정보형/탐색형/거래형)를 반영한 다양한 아키타입.`;
  },
};

registerMode(externalModePlugin);

export { externalModePlugin };
export default externalModePlugin;
