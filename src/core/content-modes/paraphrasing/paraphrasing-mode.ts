// src/core/content-modes/paraphrasing/paraphrasing-mode.ts
// 페러프레이징 모드 — trigram 유사도 검증 + 자동 재시도

import type { ContentModeConfig } from '../../max-mode-structure';
import type { ContentModePlugin, PromptParams } from '../mode-interface';
import { registerMode } from '../mode-registry';
import { PARAPHRASING_PROFESSIONAL_MODE_SECTIONS } from '../../max-mode/mode-sections-extended';

const PARAPHRASING_CONFIG: ContentModeConfig = {
  name: '페러프레이징 모드',
  description: '원문 trigram 유사도 40% 이하 강제 + 자동 재시도 + 새 데이터 강제 추가',
  titleStrategy: '원문 제목과 표현이 완전히 다른 새 제목',
  sectionStrategy: '6섹션 재구성 (개요→핵심→심화→사례→요약→확장)',
  tone: '리라이팅 전문가 — 원문 의미 보존 + 표현 100% 재구성',
  ctaStrategy: '원문에 없던 새 정보 추가 후 자연스러운 정보형 CTA',
};

const paraphrasingModePlugin: ContentModePlugin = {
  id: 'paraphrasing',
  config: PARAPHRASING_CONFIG,
  sections: PARAPHRASING_PROFESSIONAL_MODE_SECTIONS,

  buildSectionPrompt(params: PromptParams): string {
    const sec = params.section;
    const reqs = (sec.requiredElements || []).map(r => `  - ${r}`).join('\n');
    return `역할: ${sec.role || '리라이팅 전문가'}
핵심: ${sec.contentFocus || ''}
필수 요소:
${reqs}
(최소 ${sec.minChars || 700}자)
🔄 페러프레이징 4원칙:
  - 의미 보존 (사실/수치/인용은 유지)
  - 표현 재구성 (원문 단어 직접 사용 금지, trigram 유사도 40% 이하 목표)
  - 새 데이터/관점 최소 1개 추가
  - 위 2와 3을 동시에 만족해야 미완성 아님`;
  },

  buildTitlePrompt(topic: string): string {
    return `"${topic}" 에 대한 새 제목 1개. 원문 제목과 표현이 완전히 달라야 함.`;
  },

  buildOutlinePrompt(topic: string): string {
    return `"${topic}" 6섹션 재구성: 개요→핵심→심화→사례→요약→확장. 원문 구조와 다른 순서로.`;
  },
};

registerMode(paraphrasingModePlugin);

export { paraphrasingModePlugin };
export default paraphrasingModePlugin;
