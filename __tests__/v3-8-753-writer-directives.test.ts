const fs = require('fs');
const path = require('path');

import { buildFactIntegrityPrompt } from '../src/core/final/fact-integrity';
import { HUMAN_VOICE_RULES, buildLivedVoiceBlock } from '../src/core/final/lived-voice';
import { DECISION_SUPPORT_RULES, hasDecisionSupportRules } from '../src/core/final/decision-support';
import { blockBetween } from './helpers/source-block';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const weak = { context: '근거 본문 '.repeat(60), provider: 'Naver Grounding', trustLevel: 'weak' as const, topic: '청년미래적금' };
const strong = { context: '근거 본문 '.repeat(60), provider: 'Perplexity', trustLevel: 'strong' as const, sourceUrls: ['https://www.fsc.go.kr/x'], topic: '청년미래적금' };

/*
 * v3.8.753 (P1) — 009 Writer 입력에서 확인된 네 지시를 정리한다. 특정 누락의 단독 원인으로 확정된 것은 아니다.
 * 새 규칙 수천 자를 덧붙이지 않고, 정본의 해당 문장만 고친다. 형식·파서는 그대로.
 */
describe('v3.8.753 핵심 답을 빼거나 단정하게 만드는 지시 정리', () => {
  test('T14 "통째로 빼세요"·"다른 주제로 바꾸세요"·"그냥 단정해서 쓰세요"·"일반 설명만" 이 핵심 답까지 빼라는 뜻으로 남아 있지 않다', () => {
    const fact = buildFactIntegrityPrompt('청년미래적금 VS 청년 도약계좌', weak);
    expect(fact).not.toContain('자료가 없으면 **그 항목을 통째로 빼세요**');
    expect(fact).not.toContain('검증 가능한 일반 설명만 작성하세요');
    expect(fact).toContain('곁가지 항목은 그 항목을 빼세요');
    expect(fact).toContain('핵심 질문은 말없이 다른 이야기로 바꾸지 마세요');
    expect(fact).toContain('확인된 사실 / 아직 확인되지 않은 부분 / 독자가 자기 조건으로 확인할 부분');
    // 자료 개수만 보고 "충분하다" 로 뒤집지 않는다 — 어느 블록의 사실만 쓸 수 있는지만 말한다
    expect(fact).toContain('위 [RESEARCH PACKET]·[FACT EVIDENCE] 블록에 적힌 사실만');
    expect(fact).not.toMatch(/근거가 충분합니다|모든 근거가 충분/);
    expect(buildFactIntegrityPrompt('x', strong)).toContain('검증 장부가 제공됩니다');

    expect(HUMAN_VOICE_RULES).not.toContain('그 소제목을 다른 주제로 바꾸세요.');
    expect(HUMAN_VOICE_RULES).toContain('핵심 약속이면 말없이 다른 이야기로 바꾸지 마세요');
    expect(HUMAN_VOICE_RULES).toContain('값을 약속했으면 값을 적으세요');            // 헤드라인 규칙은 그대로

    const lived = buildLivedVoiceBlock([{ kind: 'friction', text: '등본 유효기간 때문에 반려된다' } as any]);
    expect(lived).not.toContain('원래 알고 있던 것처럼 그냥 단정해서 쓰세요');
    expect(lived).toContain('검증된 사실처럼 단정하지는 마세요');
    expect(lived).toContain('인용하지 마세요');                                       // 인용 금지는 유지
  });

  test('T15 개인별 확인 안내와 명시적인 가정 계산을 무조건 금지하지 않는다', () => {
    expect(HUMAN_VOICE_RULES).toContain('모르는 건 모른다고 하세요');
    expect(HUMAN_VOICE_RULES).toContain('지자체마다 다르니 확인이 필요합니다');
    expect(DECISION_SUPPORT_RULES).toContain('가정을 밝히면 써도 됩니다');
    expect(DECISION_SUPPORT_RULES).toContain('그것은 회피가 아닙니다');
    expect(DECISION_SUPPORT_RULES).toContain('남은 개월 수를 지어내지 말고');
    // 비교 글의 다섯 구분 (특정 상품·공고 번호 없음)
    for (const s of ['신규 가입자와 이미 가입한 사람', '최대 한도와 의무 납입액', '원래 만기와 지금부터 남은 기간', '확정된 사실과 가정을 둔 계산', '가입할 수 있는 조건 · 혜택을 받는 조건 · 우대를 받는 조건']) expect(DECISION_SUPPORT_RULES).toContain(s);
    expect(DECISION_SUPPORT_RULES).not.toMatch(/87726|87370|청년미래적금|청년도약계좌|70만/);
    expect(hasDecisionSupportRules(DECISION_SUPPORT_RULES)).toBe(true);
  });

  test('T16 수정이 실제 사용 정본에 연결돼 있다 — 죽은 프롬프트가 아니다', () => {
    const gen = read('src/core/final/generation.ts');
    const orch = read('src/core/final/orchestration.ts');
    expect(gen).toContain('${DECISION_SUPPORT_RULES}');
    expect(orch).toContain('scopedSectionBlock += HUMAN_VOICE_RULES;');
    expect(orch).toContain('buildFactIntegrityPrompt(keyword, factEvidence)');
    expect(orch).toContain('buildLivedVoiceBlock(');
    // 형식 규칙(JSON 구조)은 손대지 않았다
    expect(gen).toContain('"h3Sections": [');
    expect(gen).toContain('JSON만 출력 (설명/마크다운 금지)');
  });

  test('T18 모드·플랫폼·QUALITY_LOOP·비용 정책은 그대로다', () => {
    const orch = read('src/core/final/orchestration.ts');
    expect(orch).toContain("const qualityLoopOn = (payload as any).qualityLoop === true || process.env['QUALITY_LOOP'] === '1';");
    expect(orch).toContain("publishDecision = qualityConverged ? 'AUTO_PUBLISH' : 'MANUAL_REVIEW';");
    expect(orch).toMatch(/renderEvidence\(evidenceItems, 11000[,)]/);                // 근거 예산 불변(765: 뒤에 예약·묶음 옵션이 붙어도 예산은 11000)
    const pricing = read('src/core/llm/pricing.ts');
    expect(blockBetween(pricing, "value: 'openai-gpt41'", "value: 'openai-gpt4o'")).toContain('usdPer1M: { input: 2, output: 12');
  });
});
