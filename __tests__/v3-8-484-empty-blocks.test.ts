/**
 * v3.8.484 — 빈 블록은 아예 그리지 않는다 + 그래도 남으면 발행을 멈춘다
 *
 * 사장님 지시(순서대로):
 *   "1. 빈 필드는 렌더링하지 않기 — FAQ 질문·답변, 핵심요약, 소제목 중 하나라도 비면
 *       그 블록 자체를 출력하지 않도록. 깨진 걸 보여주는 것보다 없는 게 낫습니다"
 *   "2. 발행 전 검증 단계 추가 — 빈 필드 감지되면 발행 중단"
 *
 * ## 어디서 비는가
 * 값이 비는 건 모델이 안 채워서가 아니라 **후처리가 지워서**다.
 * sanitizeFactUnsafeHtml 은 근거 없는 문장을 통째로 삭제하고, 남는 게 없으면
 * 빈 문자열을 돌려준다. 그게 FAQ 답변·요약표 셀·소제목에 그대로 들어간다.
 * v3.8.471 이 근거 장부를 넓혀 빈도는 줄였지만 0 이 되지는 않는다.
 *
 * ## 2번은 품질 차단이 아니다
 * "검수 때문에 발행이 막히면 절대 안 된다"는 규칙은 그대로다.
 * 여기서 막는 건 글이 **구조적으로 깨진** 경우뿐이고, 1번이 먼저 걷어내므로
 * 2번이 실제로 걸리는 일은 거의 없다. 안전망이다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { dropEmptyFaqItems, isSummaryRenderable, findEmptyBlocks } from '../src/core/final/empty-block-guard';
import { buildFAQHtml } from '../src/core/final/generation';

const orchestration = fs.readFileSync(
  path.join(__dirname, '..', 'src/core/final/orchestration.ts'), 'utf-8',
);

describe('① FAQ — 질문이나 답변이 비면 그 항목을 뺀다', () => {
  it('⭐⭐ 답변이 빈 항목은 버린다 (Q만 있고 A가 없는 아코디언이 나가던 문제)', () => {
    const kept = dropEmptyFaqItems([
      { question: '신청 자격이 어떻게 되나요?', answer: '만 19세 이상이면 신청할 수 있습니다.' },
      { question: '언제까지 접수하나요?', answer: '' },
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.question).toContain('신청 자격');
  });

  it('⭐⭐ 질문이 빈 항목도 버린다', () => {
    expect(dropEmptyFaqItems([{ question: '   ', answer: '내용은 있습니다.' }])).toHaveLength(0);
  });

  it('⭐⭐ 태그만 남은 껍데기도 빈 것으로 본다 (<p></p> 는 눈에 안 보인다)', () => {
    expect(dropEmptyFaqItems([{ question: '질문입니다', answer: '<p></p>' }])).toHaveLength(0);
    expect(dropEmptyFaqItems([{ question: '질문입니다', answer: '<p>&nbsp;</p>' }])).toHaveLength(0);
  });

  it('⭐⭐ 멀쩡한 항목은 손대지 않는다', () => {
    const items = [{ question: '질문입니다', answer: '답변입니다.' }];
    expect(dropEmptyFaqItems(items)).toEqual(items);
  });

  it('⭐⭐ 렌더러가 실제로 걸러낸다 (모듈만 만들고 안 쓰면 무효)', () => {
    const html = buildFAQHtml([
      { question: '살아남을 질문', answer: '살아남을 답변입니다.' },
      { question: '지워질 질문', answer: '' },
    ]);
    expect(html).toContain('살아남을 질문');
    expect(html).not.toContain('지워질 질문');
  });

  it('⭐⭐ 전부 비면 FAQ 블록 자체를 안 그린다 (제목만 남는 게 제일 흉하다)', () => {
    expect(buildFAQHtml([{ question: '질문', answer: '' }])).toBe('');
  });

  it('⭐ 구조화 데이터에도 빈 항목이 안 들어간다 (구글이 빈 FAQ 를 읽는다)', () => {
    const html = buildFAQHtml([
      { question: '살아남을 질문', answer: '살아남을 답변입니다.' },
      { question: '지워질 질문', answer: '   ' },
    ]);
    const schema = html.slice(html.indexOf('FAQPage'), html.indexOf('FAQPage') + 600);
    expect(schema).not.toContain('지워질 질문');
  });
});

describe('② 핵심 요약표 — 뼈대가 비면 표를 안 그린다', () => {
  it('⭐⭐ 헤더가 통째로 비면 그리지 않는다', () => {
    expect(isSummaryRenderable(['', '  '], [['값1', '값2']])).toBe(false);
  });

  it('⭐⭐ 행이 하나도 없으면 그리지 않는다', () => {
    expect(isSummaryRenderable(['항목', '내용'], [])).toBe(false);
  });

  it('⭐⭐ 절반 넘게 빈 표는 그리지 않는다 (구멍 뚫린 표가 더 나쁘다)', () => {
    expect(isSummaryRenderable(['항목', '내용'], [['지원금', ''], ['', ''], ['기간', '']])).toBe(false);
  });

  it('⭐⭐ 멀쩡한 표는 그린다', () => {
    expect(isSummaryRenderable(['항목', '내용'], [['지원금', '월 30만원'], ['기간', '3년']])).toBe(true);
  });

  it('⭐ 셀 하나 정도 비는 건 통과시킨다 (지나치게 엄하면 멀쩡한 표가 사라진다)', () => {
    expect(isSummaryRenderable(['항목', '내용'], [['지원금', '월 30만원'], ['비고', '']])).toBe(true);
  });
});

describe('③ 완성된 글에서 빈 블록을 찾아낸다 (2번 안전망)', () => {
  it('⭐⭐ 빈 소제목을 잡는다', () => {
    const found = findEmptyBlocks('<h2></h2><p>본문입니다.</p>');
    expect(found.length).toBeGreaterThan(0);
    expect(found[0]?.kind).toBe('heading');
  });

  it('⭐⭐ 태그만 남은 소제목도 잡는다', () => {
    expect(findEmptyBlocks('<h3><strong>&nbsp;</strong></h3>').length).toBeGreaterThan(0);
  });

  it('⭐⭐ 빈 FAQ 답변을 잡는다', () => {
    const html = '<details><summary>Q. 질문입니다</summary><div class="faq-answer"></div></details>';
    const found = findEmptyBlocks(html);
    expect(found.some((f) => f.kind === 'faq')).toBe(true);
  });

  it('⭐⭐ 멀쩡한 글에서는 아무것도 안 나온다 (오탐이 나면 멀쩡한 발행이 막힌다)', () => {
    const html = '<h2>지원 대상</h2><p>만 19세 이상이면 신청할 수 있습니다.</p>'
      + '<table><thead><tr><th>항목</th></tr></thead><tbody><tr><td>월 30만원</td></tr></tbody></table>';
    expect(findEmptyBlocks(html)).toHaveLength(0);
  });

  it('⭐⭐ 이미지·구분선처럼 원래 내용이 없는 태그는 빈 것으로 안 본다', () => {
    expect(findEmptyBlocks('<h2>제목</h2><p><img src="https://x.test/a.jpg"></p><hr><td></td>')).toHaveLength(0);
  });
});

describe('④ 발행 경로에 배선돼 있다', () => {
  it('⭐⭐ 요약표를 그리기 전에 물어본다', () => {
    expect(orchestration).toContain('isSummaryRenderable(');
  });

  it('⭐⭐ 발행 직전에 빈 블록을 검사한다', () => {
    expect(orchestration).toContain('findEmptyBlocks(');
  });

  it('⭐⭐ 빈 블록이 남아 있으면 발행을 멈춘다 (사장님: "발행 중단")', () => {
    const idx = orchestration.indexOf('findEmptyBlocks(');
    const block = orchestration.slice(idx - 400, idx + 900);
    expect(block).toContain('throw new Error');
  });
});
