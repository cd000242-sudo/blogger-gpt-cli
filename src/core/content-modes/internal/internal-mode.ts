// src/core/content-modes/internal/internal-mode.ts
// 단일 완결 모드 (자동 내부링크 거미줄) — 단일 글 완결성 + 자동 내부링크 + 외부 출처 인용 강제
// sections: INTERNAL_CONSISTENCY_SECTIONS

import type { ContentModeConfig } from '../../max-mode-structure';
import type { ContentModePlugin, PromptParams } from '../mode-interface';
import { registerMode } from '../mode-registry';
import { INTERNAL_CONSISTENCY_SECTIONS } from '../../max-mode/mode-sections-extended';
import { postProcessInternal } from './internal-post-processor';

const INTERNAL_CONFIG: ContentModeConfig = {
  name: '단일 완결 모드 (자동 내부링크)',
  description: '한 글이 완결된 클러스터 노드 — 외부 출처 강제 인용 + 자동 내부링크 + 후처리 정화',
  titleStrategy: '독립적이고 완결된 정보 글 제목',
  sectionStrategy: '5섹션 정보 전달 구조 (개요→핵심지식→심화사례→요약→추가탐색)',
  tone: '정보 전달자 — 차분하고 신뢰감 있는 톤',
  ctaStrategy: '관련도 70+ 자동 내부링크 우선 → 후보 0개면 카테고리 최근 글 폴백',
};

/** 외부 출처 자동 인용 강제 — AI 환각 차단을 위해 모든 섹션 prompt에 포함 */
const SOURCE_MANDATE = `
📊 **외부 출처 인용 필수** (AI 환각·가짜 통계 차단):
- 본문 중 최소 2회 이상 검증 가능한 한국 공공·기관 데이터를 인용하세요.
  예: "통계청 KOSIS 자료에 따르면", "한국소비자원 2026년 조사", "한국은행 ECOS 데이터", "보건복지부 공식 발표"
- 인용 형식: "[기관명] [연도] [조사명]에 따르면 [구체 수치/내용]"
- 출처를 모르는 데이터는 "공식 자료를 참고하세요"라고만 표현. 추측 통계 절대 금지.
- 수치를 본문에 넣을 때 출처를 함께 명시하지 못하면 그 수치는 빼세요.`;

function buildTopicScopeGuard(topic: string): string {
  const safeTopic = (topic || '').trim() || '입력 키워드';
  return `
🎯 **내부 일관성 범위 고정**:
- 이 글의 유일한 중심 범위는 "${safeTopic}"입니다.
- "${safeTopic}"가 신청방법이면 신청 절차·준비물·단계·주의사항만 깊게 다루고, 혜택·대상·서류·기간은 신청방법을 이해하는 데 필요한 만큼만 짧게 언급하세요.
- "${safeTopic}"가 혜택이면 혜택 종류·금액·한도·활용 조건만 깊게 다루고, 신청방법·서류·기간을 총정리처럼 섞지 마세요.
- "${safeTopic}"가 대상/조건/서류/기간/사용처 중 하나라면 그 범위만 깊게 파고, 다른 축은 배경 설명 1~2문장으로 제한하세요.
- 키워드에 "총정리", "종합", "전체", "완벽 가이드"가 직접 포함되지 않는 한 여러 주제를 얕게 나열하지 마세요.
- H2/H3는 모두 "${safeTopic}"의 하위 의도만 사용하세요.`;
}

const internalModePlugin: ContentModePlugin = {
  id: 'internal',
  config: INTERNAL_CONFIG,
  sections: INTERNAL_CONSISTENCY_SECTIONS,

  buildSectionPrompt(params: PromptParams): string {
    const sec = params.section;
    const reqs = (sec.requiredElements || []).map(r => `  - ${r}`).join('\n');
    // 추가 탐색 섹션은 자동 내부링크가 채워주므로 LLM이 가짜 글 제목을 만들지 않도록 안내
    const isAdditional = sec.id === 'additional_resources';
    const additionalGuard = isAdditional
      ? `\n🛡️ 이 섹션은 발행 후 자동으로 같은 블로그의 "관련도 70+ 글"이 링크로 채워집니다.\n  - LLM은 가짜 글 제목/URL을 만들지 마세요.\n  - 추가 탐색할 "주제" 자체만 2~3개 짧게 안내하세요 (구체적 글 제목 X).`
      : '';
    return `역할: ${sec.role || '정보 전달자'}
핵심: ${sec.contentFocus || ''}
필수 요소:
${reqs}
(최소 ${sec.minChars || 600}자)
${buildTopicScopeGuard(params.topic)}
🔴 절대 금지: 과거/미래 시리즈 언급, 다른 글 참조, "1편/2편" 같은 시리즈 번호 표기${additionalGuard}
${SOURCE_MANDATE}`;
  },

  buildTitlePrompt(topic: string): string {
    return `"${topic}" 에 대한 단일 완결형 정보 글 제목 1개. 제목은 입력 주제의 범위만 드러내야 하며, 혜택·대상·서류·기간·신청방법을 총정리처럼 섞지 마세요. "1편/2편/시리즈" 표기 절대 금지.`;
  },

  buildOutlinePrompt(topic: string): string {
    return `"${topic}" 에 대한 5섹션 구조를 만드세요. ${buildTopicScopeGuard(topic)}\n구조: 개요 → 핵심 지식 → 심화 사례 → 요약 → 추가 탐색. 시리즈 번호·다른 글 언급 금지.`;
  },

  /** 후처리 — 시리즈 번호·외부 글 참조·AI 패턴 자동 정화 */
  postProcess(html: string): { html: string; report: any } {
    const result = postProcessInternal(html);
    return { html: result.html, report: result.report };
  },
};

registerMode(internalModePlugin);

export { internalModePlugin };
export default internalModePlugin;
