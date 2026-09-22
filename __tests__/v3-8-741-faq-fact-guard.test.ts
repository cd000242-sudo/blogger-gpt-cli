/**
 * v3.8.741 — FAQ 값 관문 (Release Blocker 3). 유료 호출 0.
 *
 * live 재현 둘:
 *   · 주담대: "대출 신청금액이 7억원이면 …" 에서 옛 필터가 "7억원" 토큰만 도려내 "대출 신청금액이 이면" 이 됐다.
 *   · 부산국제영화제: "동행이 3명인데 한 회차에 같이 예매할 수 있나요?" — 질문의 가정값 3명 때문에 FAQ 항목이 통째로 빠졌다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { guardFaqs, unsupportedAnswerValues, splitAnswerSentences } from '../src/core/final/faq-fact-guard';
import { ledgerFromItems } from '../src/core/final/fact-claims';

process.env['NO_LIVE_LLM'] = '1';
const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');

const ledger = ledgerFromItems([
  { id: 'E01', text: '보금자리론은 주택가격 6억원 이하, 대출한도 3억6천만원이다. 고정형 상단은 연 7.17%다.' },
  { id: 'E02', text: '부산국제영화제 온라인 예매는 상영 코드별 최대 2매까지 가능하다. 개막식 티켓은 전석 매진됐다.' },
]);

describe('① 질문의 값은 가정값 — 근거를 요구하지 않는다', () => {
  it('⭐⭐ Case A: "7억원을 대출하면 이자는?" — 7억원은 가정값 → 문장 유지, 토큰 삭제 없음', () => {
    const r = guardFaqs([{ question: '집값은 6억원 이하인데 대출 신청금액이 7억원이면 보금자리론을 볼 수 있나요?', answer: '<p>보금자리론은 주택가격 6억원 이하 요건을 먼저 봅니다. 대출한도는 3억6천만원입니다.</p>' }], ledger);
    expect(r.faqs).toHaveLength(1);
    expect(r.faqs[0]!.question).toBe('집값은 6억원 이하인데 대출 신청금액이 7억원이면 보금자리론을 볼 수 있나요?');
    expect(r.faqs[0]!.question).not.toContain('신청금액이 이면');
    expect(r.notes[0]!.action).toBe('kept');
  });
  it('⭐⭐ Case B: "동행이 3명인데 예매할 수 있나요?" — 3명은 사용자 시나리오 → 질문 유지', () => {
    const r = guardFaqs([{ question: '동행이 3명인데 한 회차에 같이 예매할 수 있나요?', answer: '<p>상영 코드별 예매는 최대 2매까지 가능합니다. 인원이 더 많으면 다른 회차나 코드로 나누어 예매해야 합니다.</p>' }], ledger);
    expect(r.faqs).toHaveLength(1);
    expect(r.faqs[0]!.question).toContain('3명');
    expect(r.notes[0]!.action).toBe('kept');
  });
  it('답변이 질문의 가정값을 되받는 것은 시나리오 반복 — 근거 불요', () => {
    expect(unsupportedAnswerValues('7억원을 빌리면 이자는 얼마인가요?', '7억원을 빌리는 경우 적용금리를 곱해 계산합니다. 고정형 상단은 연 7.17%입니다.', ledger)).toEqual([]);
  });
});

describe('② 답변의 값은 사실 주장 — 근거 없으면 문장 단위로, 부분 삭제 금지', () => {
  it('⭐⭐ Case C: "최대 3명까지 가능합니다"(근거는 최대 2매) 가 핵심 답 문장 → 항목 제외', () => {
    const r = guardFaqs([{ question: '한 번에 몇 명까지 예매할 수 있나요?', answer: '<p>최대 3명까지 가능합니다. 동행이 더 많으면 나누어 예매합니다.</p>' }], ledger);
    expect(r.faqs).toHaveLength(0);
    expect(r.notes[0]).toMatchObject({ action: 'dropped', unsupported: ['3명'] });
  });
  it('⭐ 근거 없는 값이 뒷문장에만 있으면 그 문장만 뺀다 — 앞 문장은 글자 그대로', () => {
    const r = guardFaqs([{ question: '보금자리론 조건은?', answer: '<p>보금자리론은 주택가격 6억원 이하 요건을 봅니다.</p><p>대출한도는 5억원까지입니다.</p>' }], ledger);
    expect(r.faqs).toHaveLength(1);
    expect(r.faqs[0]!.answer).toBe('<p>보금자리론은 주택가격 6억원 이하 요건을 봅니다.</p>');
    expect(r.notes[0]).toMatchObject({ action: 'sentence_removed', unsupported: ['5억원'] });
  });
  it('⭐ 부분 문자열 삭제는 없다 — 어떤 경우에도 값만 빠진 문장이 남지 않는다', () => {
    const r = guardFaqs([{ question: '한도는?', answer: '<p>대출한도는 5억원까지이고 금리는 연 7.17%입니다. 조건은 은행에서 확인합니다.</p>' }], ledger);
    const all = r.faqs.map((f) => f.answer).join(' ');
    expect(all).not.toMatch(/한도는\s*까지/);
    expect(all).not.toMatch(/금리는\s*연\s*입니다/);
  });
  it('값 문장을 빼면 답이 남지 않으면 항목 제외 · 빈 항목도 제외', () => {
    const r = guardFaqs([
      { question: '한도는?', answer: '<p>안내드립니다.</p><p>대출한도는 5억원입니다.</p>' },
      { question: '', answer: '<p>x</p>' },
    ], ledger);
    expect(r.faqs).toHaveLength(0);
    expect(r.notes.map((n) => n.action)).toEqual(['dropped', 'dropped']);
  });
  it('문장 나누기: <p>/<li> 경계와 마침표', () => {
    expect(splitAnswerSentences('<p>하나입니다.</p><ul><li>둘</li><li>셋.</li></ul>')).toEqual(['하나입니다.', '둘', '셋.']);
  });
});

describe('②-b Final Judge 의 FAQ 코드 검사도 같은 잣대 (v3.8.742 — live 741 재현)', () => {
  const { runFinalJudge } = require('../src/core/final/critique-loop');
  const items = [{ id: 'E01', title: '주담대', cleanedText: '5대 은행 고정형 상단은 연 7.17%다. 보금자리론 대출한도는 3억6천만원이다.' }];
  const article = { introduction: '<p>주담대 금리 상단은 연 7.17%입니다.</p>', sections: [], conclusion: '<p>조건을 확인합니다.</p>' };
  const PASS = JSON.stringify({ decision: 'PASS', blockingIssues: [], advisory: [] });
  it('⭐⭐ 질문의 "7억원"(가정값)은 BLOCK 사유가 아니다', async () => {
    const r = await runFinalJudge({ title: 't', mainKeyword: '주택담보대출 금리 7% 돌파', article, packetText: '', evidenceText: '', items, callModel: async () => PASS,
      faqItems: [{ question: '주택담보대출 7억원에 금리 7%면 월 상환액은 바로 계산할 수 있나요?', answer: '<p>적용금리와 상환기간을 넣어 계산기로 확인해야 합니다. 고정형 상단은 연 7.17%입니다.</p>' }] });
    expect(r.decision).toBe('PASS');
    expect(r.blockingIssues).toEqual([]);
  });
  it('⭐ 답변의 근거 없는 값("5억원")은 여전히 BLOCK', async () => {
    const r = await runFinalJudge({ title: 't', mainKeyword: 'k', article, packetText: '', evidenceText: '', items, callModel: async () => PASS,
      faqItems: [{ question: '보금자리론 한도는?', answer: '<p>대출한도는 5억원입니다.</p>' }] });
    expect(r.decision).toBe('BLOCK');
    expect(r.blockingIssues[0]).toMatchObject({ sectionId: 'FAQ', exactSpan: '5억원', type: 'UNSUPPORTED_VALUE' });
  });
  it('faqItems 없이 faqText 만 주는 옛 호출은 예전 규칙 그대로(회귀 방지)', async () => {
    const r = await runFinalJudge({ title: 't', mainKeyword: 'k', article, packetText: '', evidenceText: '', items, callModel: async () => PASS, faqText: 'Q. 한도는?\nA. 대출한도는 5억원입니다.' });
    expect(r.decision).toBe('BLOCK');
  });
});

describe('③ 배선 — 옛 토큰 도려내기 필터가 FAQ 에서 사라지고, 68% 와 Final QA 가 같은 관문을 쓴다', () => {
  const orch = read('src/core/final/orchestration.ts');
  it('FAQ 경로에 sanitizeFactUnsafeHeading(토큰 도려내기)이 없다 · guardFaqs 가 두 번(68%·Final QA) 배선', () => {
    const faqBlockStart = orch.indexOf("require('./faq-fact-guard')");
    expect(faqBlockStart).toBeGreaterThan(0);
    expect((orch.match(/require\('\.\/faq-fact-guard'\)/g) || []).length).toBeGreaterThanOrEqual(2);
    // 질문 토큰 도려내기는 제목(H1) 경로에만 남는다
    const heading = orch.match(/sanitizeFactUnsafeHeading\(String\(item\.question/g) || [];
    expect(heading).toHaveLength(0);
    expect(orch).not.toContain('FAQ 항목 제거 (질문 또는 답변이 비어 짝 밀림 방지)');
    expect(orch).toMatch(/faqItems: faqs\.map\(/);   // Judge 에도 질문/답변을 따로 준다
  });
});
