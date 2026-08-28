/**
 * v3.8.564 — 결론 블록의 "근거" 줄에 지시문이 새어 나가던 문제
 *
 * ## 실측으로 발각 (2026-08-27)
 * 라면 주제로 확장할 수 있는지 보려고 "신라면 맛있게 끓이는 법" 을 **실제로 생성**했더니
 * 결론 블록에 이게 그대로 나갔다:
 *
 *     근거: 기관명과 기준 시점 본문 미기재
 *
 * `generation.ts:3613` 이 모델에게 `basis: 그 답의 근거가 되는 기관 이름과 기준 시점` 을
 * 요구하는데, **인용할 기관이 애초에 없는 주제**(레시피·취미·생활)에서는 모델이 빈 값 대신
 * 지시문을 되돌려준다. 그리고 answer-block 은 길이만 다듬고 내용은 안 봤다.
 *
 * 세금·환급 글에서는 기관이 늘 있어서 안 드러났다. **주제를 넓히는 순간 전 글에 박힌다.**
 * 그래서 "값이 있으면 찍는다" 가 아니라 **"근거로 읽히는 값일 때만 찍는다"** 로 바꿨다.
 */
import { buildAnswerBlock, usableBasis } from '../src/core/final/answer-block';

const 답 = '한 봉지는 물 550ml를 기준으로 약 4분 30초 조리합니다. 꼬들한 식감은 면이 완전히 퍼지기 전 불을 끕니다.';

describe('① 근거로 못 쓰는 값은 걸러낸다', () => {
  it('⭐⭐ 실제로 나갔던 그 문장을 막는다', () => {
    expect(usableBasis('기관명과 기준 시점 본문 미기재')).toBe('');
  });

  it('⭐ "없음" 류를 전부 막는다', () => {
    for (const v of ['없음', '해당 없음', '미상', '불명', '확인 불가', '알 수 없음',
                     '본문에 명시되지 않음', '자료 미제공', 'N/A', 'none', 'Unknown',
                     'not specified', 'Not available']) {
      expect(usableBasis(v)).toBe('');
    }
  });

  it('⭐ 프롬프트 필드 설명이 되돌아온 경우도 막는다', () => {
    expect(usableBasis('기관 이름 · 기준 시점')).toBe('');
    expect(usableBasis('[기관명] [연도] [조사명]')).toBe('');
  });

  it('기호만 남은 껍데기도 막는다', () => {
    expect(usableBasis('·')).toBe('');
    expect(usableBasis(' -  · ')).toBe('');
    expect(usableBasis('')).toBe('');
  });

  it('⭐⭐ 진짜 근거는 그대로 통과한다 (과잉 차단 금지)', () => {
    for (const v of ['국세청 · 2026-08 기준', '식품의약품안전처 2026년 고시',
                     '농심 공식 조리법 · 2026-08', 'FDA · Aug 2026', '통계청 KOSIS 2025']) {
      expect(usableBasis(v)).toBe(v);
    }
  });
});

describe('② 블록이 그 결과를 반영한다', () => {
  it('⭐⭐ 근거가 못 쓰는 값이면 근거 줄을 아예 안 만든다', () => {
    const html = buildAnswerBlock({
      keyword: '신라면 맛있게 끓이는 법',
      answer: 답,
      basis: '기관명과 기준 시점 본문 미기재',
    });
    expect(html).toContain('answer-first');          // 블록 자체는 나온다
    expect(html).not.toContain('answer-first-basis'); // 근거 줄만 빠진다
    expect(html).not.toContain('미기재');
    expect(html).not.toContain('근거:');
  });

  it('⭐ 진짜 근거가 있으면 예전처럼 찍는다', () => {
    const html = buildAnswerBlock({ keyword: '연말정산', answer: 답, basis: '국세청 · 2026-08 기준' });
    expect(html).toContain('answer-first-basis');
    expect(html).toContain('근거: 국세청 · 2026-08 기준');
  });

  it('영어 블록에서도 같은 규칙이 돈다', () => {
    const en = buildAnswerBlock({
      keyword: 'ramyeon', language: 'en',
      answer: 'One pack takes 550ml of water and about four and a half minutes on the stove.',
      basis: 'not specified',
    });
    expect(en).toContain('answer-first');
    expect(en).not.toContain('answer-first-basis');
    expect(en).not.toContain('Source:');
  });
});
