const fs = require('fs');
const path = require('path');

import { findEchoedFaqs } from '../src/core/final/article-audit';
import { blockBetween } from './helpers/source-block';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.645 — FAQ 가 본문을 되풀이한다.
 *
 * 사장님 지적으로 처음으로 글을 실제 생성해 재 봤더니(2026-09-05),
 * 고친 것들은 다 좋아졌는데 **구간 반복만 5건 그대로**였다:
 *   롱테일 이행 0/3 → 3/3, 팩트밀도 1.3 → 7.04, 작성과정 노출 2 → 0, 중복 5 → 5
 *
 * 그중 셋이 FAQ ↔ 본문이었다:
 *   본문: 개인사업자 신용대출 갈아타기 신청은 영업일 9:00부터 16:00 사이에 할 수 있어요.
 *   FAQ : 개인사업자 신용대출 갈아타기 신청은 영업일 9:00부터 16:00까지 가능해요.
 *
 * 원인은 모델이 아니라 구조다 — FAQ 생성기가 **본문을 근거로** 받는다.
 * 근거로 준 글을 다시 쓰지 말라고 부탁해서는 안 지켜진다. 만든 뒤에 재서 걸러야 한다.
 */
describe('v3.8.645 본문을 되풀이하는 FAQ', () => {
  const 본문 = [
    '개인사업자 신용대출 갈아타기 신청은 영업일 9:00부터 16:00 사이에 할 수 있어요.',
    '부동산임대업 대출과 담보 대출, 보증 대출은 갈아타기 대상에서 제외됩니다.',
    '한도와 총부채원리금상환비율은 소득 자료를 함께 보고 판단합니다.',
  ].join('\n');

  describe('겹치는 것을 집어낸다', () => {
    test('말만 바꾼 되풀이를 잡는다', () => {
      const faqs = [
        { question: '언제 신청하나요', answer: '개인사업자 신용대출 갈아타기 신청은 영업일 9:00부터 16:00까지 가능해요.' },
      ];
      expect(findEchoedFaqs(faqs, 본문)).toEqual([0]);
    });

    /** 본문이 안 다룬 빈칸을 채우는 답은 살아야 한다 — 이게 FAQ 의 존재 이유다 */
    test('본문에 없는 이야기는 안 건드린다', () => {
      const faqs = [
        { question: '거절되면 기존 대출은', answer: '기존 대출은 그대로 유지되고 만기와 금리도 바뀌지 않습니다. 다만 조회 기록은 남습니다.' },
      ];
      expect(findEchoedFaqs(faqs, 본문)).toEqual([]);
    });

    test('여러 개가 겹치면 전부 집어낸다', () => {
      const faqs = [
        { question: 'a', answer: '개인사업자 신용대출 갈아타기 신청은 영업일 9:00부터 16:00까지 가능해요.' },
        { question: 'b', answer: '새로운 이야기입니다. 조회 기록은 신용점수에 곧바로 반영되지는 않습니다.' },
        { question: 'c', answer: '부동산임대업 대출과 담보 대출, 보증 대출은 갈아타기 대상에서 제외돼요.' },
      ];
      expect(findEchoedFaqs(faqs, 본문)).toEqual([0, 2]);
    });

    /** 짧은 답은 우연히 겹친다 — 낱말이 적으면 재지 않는다 */
    test('너무 짧은 답은 재지 않는다', () => {
      expect(findEchoedFaqs([{ question: 'a', answer: '네, 가능합니다.' }], 본문)).toEqual([]);
    });

    test('빈 입력에도 터지지 않는다', () => {
      expect(findEchoedFaqs([], 본문)).toEqual([]);
      expect(findEchoedFaqs(undefined as any, '')).toEqual([]);
    });
  });

  describe('발행 경로에 배선돼 있다', () => {
    const orch = read('src/core/final/orchestration.ts');

    test('FAQ 를 만든 뒤에 거른다', () => {
      const block = blockBetween(orch, 'let faqs = await generateFAQFinal', 'const faqText =');
      expect(block).toContain('findEchoedFaqs');
    });

    /** 다 버리면 그 자리가 더 허전하다 */
    test('두 개 아래로 줄어들면 그대로 둔다', () => {
      const block = blockBetween(orch, 'let faqs = await generateFAQFinal', 'const faqText =');
      expect(block).toContain('kept.length >= 2');
    });

    test('무엇을 뺐는지 로그로 알린다 — 조용히 지우지 않는다', () => {
      const block = blockBetween(orch, 'let faqs = await generateFAQFinal', 'const faqText =');
      expect(block).toContain('겹치는 FAQ');
    });

    /** 검사만 있으면 매번 뒤늦게 버린다. 애초에 안 쓰게 시키는 편이 싸다 */
    test('프롬프트도 함께 못박는다', () => {
      const gen = read('src/core/final/generation.ts');
      expect(gen).toContain('본문에 이미 있는 문장을 다시 쓰지 마세요');
    });
  });
});
