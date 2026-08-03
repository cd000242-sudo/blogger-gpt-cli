/**
 * v3.8.374 실속(정보 밀도) 게이트 회귀 테스트
 *
 * 배경: 기존 품질 게이트는 전부 분량 지표(글자수·단락수·출처 언급수)라
 *   "분량만 채운 알맹이 없는 글"이 전부 통과했다. 실제 발행글에서
 *   "정확한 내용은 공식 사이트에서 확인해주세요."가 섹션 마무리로 반복 등장했다.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  scanSubstance,
  buildSubstanceRetryBlock,
  stripToPlainText,
  SUBSTANCE_THRESHOLDS,
} from '../src/core/final/substance-gate';

/** 구체 정보가 없는 전형적인 "두루뭉실 글" — 분량만 충분하다 */
const VAGUE_ARTICLE = `
<p>이 제도는 많은 분들에게 도움이 되는 아주 유용한 제도입니다. 어떤 분들에게는 큰 힘이 될 수 있어요.</p>
<p>신청 방법은 그리 복잡하지 않습니다. 다만 상황에 따라 달라질 수 있으니 미리 확인하는 것이 중요합니다.</p>
<p>지원 대상은 조건에 따라 다를 수 있습니다. 자세한 내용은 공식 사이트에서 확인해주세요.</p>
<p>준비물도 경우에 따라 다르니, 반드시 확인하시기 바랍니다. 미리 준비하면 훨씬 수월하게 진행할 수 있어요.</p>
<p>이처럼 이 제도는 활용도가 높습니다. 관심 있는 분들은 홈페이지를 참고하시기 바랍니다.</p>
<p>마지막으로 가장 중요한 것은 본인의 상황을 잘 파악하는 것입니다. 상황에 따라 달라질 수 있기 때문이에요.</p>
`.repeat(3);

/** 같은 주제를 구체적으로 쓴 글 */
const CONCRETE_ARTICLE = `
<p>청년내일저축계좌는 만 19~34세 근로 청년이 매월 10만 원을 저축하면 정부가 최대 30만 원을 더해주는 제도입니다.</p>
<p>가입 조건은 세 가지로 갈립니다. 첫째 근로소득이 월 50만 원 초과 220만 원 이하, 둘째 가구소득이 기준 중위소득 100% 이하, 셋째 재산이 대도시 3억 5천만 원 이하여야 합니다.</p>
<p>신청은 복지로 누리집에서 합니다. 로그인 후 [서비스 신청] → [복지서비스 신청] → [청년내일저축계좌] 순서로 들어가면 됩니다. 준비물은 신분증과 재직증명서, 급여명세서 3개월분입니다.</p>
<p>2026년 신청 기간은 5월 1일부터 5월 21일까지 3주간입니다. 이 기간을 놓치면 다음 해까지 기다려야 합니다.</p>
<p>흔한 실수는 가구소득 산정에서 나옵니다. 함께 사는 부모의 소득이 합산되는데, 이걸 몰라서 탈락하는 경우가 전체 탈락 사유의 40%를 차지합니다.</p>
<p>3년 만기 시 본인 저축 360만 원에 정부 지원금 1,080만 원이 더해져 총 1,440만 원과 이자를 받게 됩니다.</p>
`.repeat(3);

/**
 * v3.8.423 — "뻔한 소리"(진부한 상투구) 표본. 숫자·기관명이 없어서 concreteFacts에도
 * 안 걸리고, "확인하세요"/"다를 수 있습니다" 같은 회피·얼버무림 패턴도 안 써서 기존
 * 게이트로는 못 잡던 실패 모드다.
 */
const CLICHE_ARTICLE = `
<p>말할 필요도 없이 이 제품은 정말 좋은 선택입니다. 두말할 나위 없이 다들 만족하실 거예요.</p>
<p>누구나 다 아는 사실이지만, 생각보다 많은 분들이 이 제품을 찾고 계세요.</p>
<p>새삼 강조할 필요 없이 이건 누구에게나 필요한 물건입니다. 이제는 선택이 아니라 필수라고 볼 수 있어요.</p>
<p>굳이 설명하지 않아도 다들 아실 거예요. 그만큼 좋은 제품이라는 뜻이겠죠.</p>
`.repeat(3);

describe('substance-gate — 실속(정보 밀도) 게이트 (v3.8.374)', () => {
  describe('stripToPlainText', () => {
    it('script/style/주석/태그를 제거하고 평문만 남긴다', () => {
      const html = '<style>.a{color:red}</style><script>var x=1</script><!-- c --><p>본문 내용</p>';
      expect(stripToPlainText(html)).toBe('본문 내용');
    });

    it('빈 입력에도 안전하다', () => {
      expect(stripToPlainText('')).toBe('');
      expect(stripToPlainText(null as any)).toBe('');
    });
  });

  describe('scanSubstance', () => {
    it('구체 정보 없는 글을 미달로 판정한다', () => {
      const report = scanSubstance({ contentHtml: VAGUE_ARTICLE });
      expect(report.passed).toBe(false);
      expect(report.metrics.factsPer1000).toBeLessThan(SUBSTANCE_THRESHOLDS.minFactsPer1000);
    });

    it('구체 정보가 풍부한 글을 통과시킨다', () => {
      const report = scanSubstance({ contentHtml: CONCRETE_ARTICLE });
      expect(report.passed).toBe(true);
      expect(report.metrics.factsPer1000).toBeGreaterThanOrEqual(SUBSTANCE_THRESHOLDS.minFactsPer1000);
    });

    it('구체적인 글이 두루뭉실한 글보다 항상 높은 점수를 받는다', () => {
      const vague = scanSubstance({ contentHtml: VAGUE_ARTICLE });
      const concrete = scanSubstance({ contentHtml: CONCRETE_ARTICLE });
      expect(concrete.score).toBeGreaterThan(vague.score);
    });

    it('"공식 사이트에서 확인" 류 책임 회피 문장을 센다', () => {
      const report = scanSubstance({ contentHtml: VAGUE_ARTICLE });
      expect(report.metrics.deferrals).toBeGreaterThan(0);
    });

    it('"상황에 따라 달라질 수 있습니다" 류 얼버무림을 센다', () => {
      const report = scanSubstance({ contentHtml: VAGUE_ARTICLE });
      expect(report.metrics.hedges).toBeGreaterThan(0);
    });

    it('문제 문장을 최대 5개까지 실제 문장 그대로 뽑아낸다', () => {
      const report = scanSubstance({ contentHtml: VAGUE_ARTICLE });
      expect(report.worstSentences.length).toBeGreaterThan(0);
      expect(report.worstSentences.length).toBeLessThanOrEqual(5);
      // 뽑힌 문장은 실제로 본문에 존재해야 한다 (환각 금지)
      const plain = stripToPlainText(VAGUE_ARTICLE);
      report.worstSentences.forEach(s => expect(plain).toContain(s));
    });

    it('같은 날짜를 여러 패턴이 중복 계수하지 않는다 (구간 병합)', () => {
      // "2026년 7월 8일"은 연/월/일 패턴 여러 개에 걸리지만 1개로 세어야 한다
      const report = scanSubstance({ contentHtml: '<p>기준일은 2026년 7월 8일입니다.</p>' });
      expect(report.metrics.concreteFacts).toBe(1);
    });

    it('빈 본문에서 0으로 나누지 않는다', () => {
      const report = scanSubstance({ contentHtml: '' });
      expect(report.metrics.chars).toBe(0);
      expect(report.metrics.factsPer1000).toBe(0);
      expect(Number.isFinite(report.score)).toBe(true);
    });

    it('구체 정보가 없는 단락 수를 센다', () => {
      const html = '<p>' + '이 제도는 여러모로 유용하며 많은 분들께 도움이 되는 좋은 정책입니다. 관심 있게 살펴보시면 좋습니다.'.repeat(2) + '</p>'
        + '<p>' + '지원금은 월 30만 원이며 2026년 5월 1일부터 신청할 수 있습니다. 신청은 복지로 누리집에서 진행합니다.'.repeat(2) + '</p>';
      const report = scanSubstance({ contentHtml: html });
      expect(report.metrics.totalParagraphs).toBe(2);
      expect(report.metrics.emptyParagraphs).toBe(1);
    });

    /**
     * v3.8.423 — "한겨울에 눈이 온다" 같은 뻔한 소리 탐지.
     * 사용자: "정보전달에 정확하게 이뤄지는게 맞는지... 한겨울에 흰눈내리는 그런 뻔한글을
     *   작성하는건아닌지... 실속게이트를 끝판왕으로 해야 가치있는 글이되지않을까"
     */
    describe('진부한 상투구("뻔한 소리") 탐지 (v3.8.423)', () => {
      it('"말할 필요도 없이" 등 뻔한 상투구를 센다', () => {
        const report = scanSubstance({ contentHtml: CLICHE_ARTICLE });
        expect(report.metrics.cliches).toBeGreaterThan(0);
      });

      it('뻔한 상투구로만 채워진 글은 숫자·회피 패턴이 없어도 미달로 판정된다', () => {
        // CLICHE_ARTICLE엔 금액·비율·날짜 등 구체 팩트도, "확인하세요"류 회피 표현도 없다 —
        // 클리셰 탐지가 없다면 이 글은 통과했을 것이다.
        const report = scanSubstance({ contentHtml: CLICHE_ARTICLE });
        expect(report.metrics.concreteFacts).toBe(0);
        expect(report.metrics.deferrals).toBe(0);
        expect(report.metrics.hedges).toBe(0);
        expect(report.passed).toBe(false);
      });

      it('구체적인 글은 뻔한 소리로 오탐되지 않는다', () => {
        const report = scanSubstance({ contentHtml: CONCRETE_ARTICLE });
        expect(report.metrics.cliches).toBe(0);
      });

      it('일반적인 단정 문장("~는 좋은 제품입니다")은 오탐하지 않는다 — 좁은 패턴만 잡는다', () => {
        // "필요한" "중요한" 같은 흔한 단어 자체가 아니라, "누구나 다 아는 사실이지만"처럼
        // 명확히 진부한 어구 전체가 있을 때만 잡아야 한다.
        const report = scanSubstance({ contentHtml: '<p>이 세탁기는 10kg 용량에 저소음 42dB로 밤에도 편하게 쓸 수 있는 좋은 제품입니다.</p>' });
        expect(report.metrics.cliches).toBe(0);
      });

      it('뻔한 소리만 있는 문장도 worstSentences에 실제 문장 그대로 뽑힌다', () => {
        const report = scanSubstance({ contentHtml: CLICHE_ARTICLE });
        expect(report.worstSentences.length).toBeGreaterThan(0);
        const plain = stripToPlainText(CLICHE_ARTICLE);
        report.worstSentences.forEach(s => expect(plain).toContain(s));
      });

      it('뻔한 소리 글은 구체적인 글보다 항상 낮은 점수를 받는다', () => {
        const cliche = scanSubstance({ contentHtml: CLICHE_ARTICLE });
        const concrete = scanSubstance({ contentHtml: CONCRETE_ARTICLE });
        expect(concrete.score).toBeGreaterThan(cliche.score);
      });

      it('⭐ 단락에 팩트가 섞여 있어 "빈 단락" 신호로는 못 잡는 경우에도 클리셰만으로 감점된다', () => {
        // 각 단락에 숫자를 하나씩 섞어 emptyParagraphRatio가 0이 되게 만든다 —
        // 클리셰 카운트가 없다면 이 글은 순수 팩트 밀도만으로 평가돼 오탐 없이 통과할 수 있다.
        const mixed = `
<p>말할 필요도 없이 이 제품은 10kg 용량입니다. 두말할 나위 없이 다들 만족하실 거예요.</p>
<p>누구나 다 아는 사실이지만, 소음을 42% 줄였어요. 생각보다 많은 분들이 이 제품을 찾고 계세요.</p>
<p>새삼 강조할 필요 없이 2026년 출시작입니다. 이제는 선택이 아니라 필수라고 볼 수 있어요.</p>
`.repeat(3);
        const withCliche = scanSubstance({ contentHtml: mixed });
        expect(withCliche.metrics.emptyParagraphs).toBe(0); // 팩트가 있어 "빈 단락"엔 안 걸린다
        expect(withCliche.metrics.cliches).toBeGreaterThan(0); // 그래도 클리셰는 잡힌다

        const withoutCliche = mixed
          .replace(/말할 필요도 없이|두말할 나위 없이/g, '')
          .replace(/누구나 다 아는 사실이지만,?|생각보다 많은 분들이/g, '')
          .replace(/새삼 강조할 필요 없이|이제는 선택이 아니라 필수라고 볼 수 있어요\./g, '');
        const clean = scanSubstance({ contentHtml: withoutCliche });
        expect(clean.metrics.cliches).toBe(0);
        // 클리셰 문구만 뺐을 뿐 같은 팩트를 담고 있는 글이 항상 더 높은 점수를 받아야 한다 —
        // 안 그러면 클리셰 카운트가 점수에 실질적으로 반영되지 않는다는 뜻이다.
        expect(clean.score).toBeGreaterThan(withCliche.score);
      });
    });
  });

  describe('buildSubstanceRetryBlock', () => {
    it('재시도 프롬프트에 실제 측정치와 문제 문장을 포함한다', () => {
      const report = scanSubstance({ contentHtml: VAGUE_ARTICLE });
      const block = buildSubstanceRetryBlock(report);
      expect(block).toContain(String(report.metrics.factsPer1000));
      expect(block).toContain(report.worstSentences[0]!);
    });

    it('재시도 프롬프트가 회피 문장 금지를 명시한다', () => {
      const report = scanSubstance({ contentHtml: VAGUE_ARTICLE });
      const block = buildSubstanceRetryBlock(report);
      expect(block).toContain('공식 사이트에서 확인하세요');
      expect(block).toContain('구체 정보');
    });

    it('재시도 프롬프트가 뻔한 상투구 금지를 명시한다 (v3.8.423)', () => {
      const report = scanSubstance({ contentHtml: CLICHE_ARTICLE });
      const block = buildSubstanceRetryBlock(report);
      expect(block).toContain('뻔한');
      expect(block).toContain('말할 필요도 없이');
    });
  });
});

/**
 * v3.8.423 — "비용은 고정되면서 초기부터 글이 완벽하게 생성되어야 정상아니니??"
 *
 * 재시도(retry) 프롬프트에만 클리셰 금지를 넣으면 재시도가 opt-in(기본 OFF)이라
 * 대부분의 글에서 이 지시 자체가 전달되지 않는다. generateAllSectionsFinal은 매 글마다
 * 정확히 1회 호출되는 메인 본문 생성 함수라, 여기 있는 지시는 재생성 여부와 무관하게
 * 항상 모델에 전달된다 — "처음부터 완벽하게" 원칙은 이 프롬프트에 박아야 실현된다.
 */
describe('generateAllSectionsFinal 메인 프롬프트에도 클리셰 금지가 처음부터 박혀 있다 (v3.8.423)', () => {
  const generationSrc = fs.readFileSync(
    path.join(process.cwd(), 'src', 'core', 'final', 'generation.ts'),
    'utf8',
  );

  it('⭐ [금지 사항] 블록에 뻔한 상투구 금지가 있다 — 재시도 없이도 매 글에 전달된다', () => {
    expect(generationSrc).toContain('말할 필요도 없이');
    expect(generationSrc).toContain('두말할 나위 없이');
    expect(generationSrc).toContain('생각보다 많은 분들이');
  });

  it('⭐ 이 지시는 generateAllSectionsFinal(메인 1회 호출 함수) 안에 있다', () => {
    const fnIdx = generationSrc.indexOf('export async function generateAllSectionsFinal(');
    const banIdx = generationSrc.indexOf('말할 필요도 없이');
    const nextFnIdx = generationSrc.indexOf('\nexport async function ', fnIdx + 1);
    expect(fnIdx).toBeGreaterThan(-1);
    expect(banIdx).toBeGreaterThan(fnIdx);
    if (nextFnIdx > -1) expect(banIdx).toBeLessThan(nextFnIdx);
  });
});
