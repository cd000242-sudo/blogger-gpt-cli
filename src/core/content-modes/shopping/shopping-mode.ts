// src/core/content-modes/shopping/shopping-mode.ts
// 쇼핑/구매 전환 모드 — 단점 섹션 필수 + 가격 할루시 차단
// 쿠팡 API 호출은 orchestration 의 사이드 이펙트로 별도 처리

import type { ContentModeConfig } from '../../max-mode-structure';
import type { ContentModePlugin, PromptParams } from '../mode-interface';
import { registerMode } from '../mode-registry';
import { SHOPPING_CONVERSION_MODE_SECTIONS } from '../../max-mode/mode-sections-extended';

const SHOPPING_CONFIG: ContentModeConfig = {
  name: '쇼핑 전환 모드',
  description: '솔직한 단점 섹션 필수 + 쿠팡 딥링크 자동 주입 + 가격 할루시 차단',
  titleStrategy: '비교/리뷰/추천 형태의 정보형 제목 (구매 명령형 금지)',
  sectionStrategy: '8섹션 (후킹→스펙→비교→후기→단점→가격→FAQ→요약)',
  tone: '객관적 리뷰어 — 단점도 솔직하게',
  ctaStrategy: '정보형 CTA ("상품 정보 보기") + 쿠팡 카드 블록 자동 삽입',
};

const shoppingModePlugin: ContentModePlugin = {
  id: 'shopping',
  config: SHOPPING_CONFIG,
  sections: SHOPPING_CONVERSION_MODE_SECTIONS,

  buildSectionPrompt(params: PromptParams): string {
    const sec = params.section;
    const reqs = (sec.requiredElements || []).map(r => `  - ${r}`).join('\n');
    const consGuard = sec.id === 'honest_cons'
      ? '\n⚠️ 이 섹션은 신뢰 구축의 핵심입니다. 단점을 진짜로 3개 이상 적지 않으면 글 전체가 광고처럼 보입니다.'
      : '';
    return `역할: ${sec.role || '제품 분석가'}
핵심: ${sec.contentFocus || ''}
필수 요소:
${reqs}
(최소 ${sec.minChars || 1000}자)${consGuard}
🛡️ 가격 표기 규칙: 쿠팡 실제 데이터가 없으면 구체 숫자(₩, 원, "12,900") 사용 금지 — 추상 표현만`;
  },

  buildTitlePrompt(topic: string): string {
    return `"${topic}" 에 대한 비교/리뷰형 제목 1개. "지금 구매", "최저가" 같은 명령형 금지.`;
  },

  buildOutlinePrompt(topic: string): string {
    return `"${topic}" 8섹션 구매 퍼널: 후킹→스펙→비교→실사용 후기→솔직한 단점→가격/구매팁→FAQ→최종 요약.`;
  },
};

registerMode(shoppingModePlugin);

export { shoppingModePlugin };
export default shoppingModePlugin;
