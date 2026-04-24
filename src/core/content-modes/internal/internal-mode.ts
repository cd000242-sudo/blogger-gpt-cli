// src/core/content-modes/internal/internal-mode.ts
// 내부 일관성 모드 — 단일 글로 완결, 외부 글 참조 금지
// sections: INTERNAL_CONSISTENCY_SECTIONS

import type { ContentModeConfig } from '../../max-mode-structure';
import type { ContentModePlugin, PromptParams } from '../mode-interface';
import { registerMode } from '../mode-registry';
import { INTERNAL_CONSISTENCY_SECTIONS } from '../../max-mode/mode-sections-extended';

const INTERNAL_CONFIG: ContentModeConfig = {
  name: '내부 일관성 모드',
  description: '단일 글 완결성 + 토픽 클러스터 + 자동 내부링크 (trigram 유사도 기반)',
  titleStrategy: '독립적이고 완결된 정보 글 제목',
  sectionStrategy: '5섹션 정보 전달 구조 (개요→핵심지식→심화사례→요약→추가탐색)',
  tone: '정보 전달자 — 차분하고 신뢰감 있는 톤',
  ctaStrategy: '내부링크 위주 (관련도 70+ 만 자동 삽입)',
};

const internalModePlugin: ContentModePlugin = {
  id: 'internal',
  config: INTERNAL_CONFIG,
  sections: INTERNAL_CONSISTENCY_SECTIONS,

  buildSectionPrompt(params: PromptParams): string {
    const sec = params.section;
    const reqs = (sec.requiredElements || []).map(r => `  - ${r}`).join('\n');
    return `역할: ${sec.role || '정보 전달자'}
핵심: ${sec.contentFocus || ''}
필수 요소:
${reqs}
(최소 ${sec.minChars || 600}자)
🔴 절대 금지: 과거/미래 시리즈 언급, 다른 글 참조, "1편/2편" 같은 시리즈 번호 표기`;
  },

  buildTitlePrompt(topic: string): string {
    return `"${topic}" 에 대한 단일 완결형 정보 글 제목 1개. 독립적이고 자기충족적인 표현.`;
  },

  buildOutlinePrompt(topic: string): string {
    return `"${topic}" 에 대한 5섹션 구조: 개요 → 핵심 지식 → 심화 사례 → 요약 → 추가 탐색.`;
  },
};

registerMode(internalModePlugin);

export { internalModePlugin };
export default internalModePlugin;
