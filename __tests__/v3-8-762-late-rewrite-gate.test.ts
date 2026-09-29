const fs = require('fs');
const path = require('path');

import { buildValidationEvidence } from '../src/core/final/validation-evidence';
import type { FactEvidence } from '../src/core/final/fact-integrity';
import { gateRewrite, gateRepairs } from '../src/core/final/fact-guard';
import { runFinalAuthority } from '../src/core/final/final-authority';
import { planCoreQuestions, isCoreAnswerSentence } from '../src/core/final/core-questions';

/*
 * v3.8.762 — 마지막 늦은 LLM 재작성 경로(pre-publish-fix)를 기존 보호 계약(gateRepairs)에 편입. 새 게이트 없음 · 호출 0.
 * 두 라이브 run(b8cdb4·a280b4)은 revised=0 이라 동작이 바뀌지 않아야 하고, SYNTHETIC 회귀 6종은 거부/허용을 가른다.
 */
const read = (p: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', p), 'utf8'));
const R1 = read('__tests__/fixtures/run-b8cdb4/run-inputs.json');
const R2 = read('__tests__/fixtures/run-a280b4/run-inputs.json');
const viewOf = (r: any) => buildValidationEvidence(r.stage2Items.map((i: any) => ({ ...i, mainKeyword: r.keyword, sourceName: i.domain, retrievedAt: '', query: '', relevanceScore: 1, promiseRelevanceScore: null })), { provider: 'Naver Grounding', trustLevel: 'weak', topic: r.keyword, context: '' } as FactEvidence).evidence;
const PAD = ' 자세한 절차는 취급 기관이 안내합니다. 가입 전 본인 요건을 확인하세요. 신청은 창구와 앱에서 받습니다.'.repeat(3);
const ev = (context: string): FactEvidence => ({ provider: 'Naver Grounding', trustLevel: 'weak', topic: '합성 주제', context: `[E01] 합성 근거\n${context}${PAD}` });
const plain = (s: string) => String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const E = ev('상품 A 는 월 최대 50만원까지 납입한다. 상품 B 는 월 최대 70만원까지 납입한다. 기여금은 12% 이다. 1년 앞당길 때마다 6% 감액된다. 원래 만기는 5년이다.');
const TABLE = '<table><tr><th>구분</th><th>상품 A</th><th>상품 B</th></tr><tr><td>월 최대 납입액</td><td>50만원</td><td>70만원</td></tr></table>';
const doc = (body: string) => `<h1>제목</h1><h2>1. 절</h2><h3>1-1. 소제목</h3>${body}<h2>2. 절</h2><h3>2-1. 소제목</h3><p>마무리 문단입니다.</p>`;

describe('SYNTHETIC — 늦은 재작성의 보호 계약 (1~6)', () => {
  test('1 정상 fact 삭제 → 거부·원본 복원', () => {
    const before = doc('<p>상품 A 의 기여금은 12% 입니다. 신청은 창구에서 합니다.</p>');
    const after = doc('<p>신청은 창구에서 합니다.</p>');
    const g = gateRewrite(before, after, E);
    expect(g.status).toBe('rejected');
    expect(g.regions[0]!.decisions[0]!.lostProtected).toEqual(['12%']);
    expect(g.html).toBe(before);
  });
  test('2 검산 차액 삭제 → 거부', () => {
    const before = doc(`${TABLE}<p>월 한도 차이는 20만원입니다. 만기도 다릅니다.</p>`);
    const after = doc(`${TABLE}<p>만기도 다릅니다.</p>`);
    const g = gateRewrite(before, after, E);
    expect(g.status).toBe('rejected');
    expect(g.regions[0]!.decisions[0]!.lostProtected).toEqual(['20만원']);
    expect(plain(g.html)).toContain('월 한도 차이는 20만원입니다');
  });
  test('3 가정 예시 값 삭제 → 거부', () => {
    const before = doc('<p>원래 월 100만원을 받을 예정이라면 1년 조기수령은 월 94만원입니다.</p><ul><li>1년 조기수령은 월 6만원 감소로 계산합니다.</li></ul>');
    const after = doc('<p>원래 월 100만원을 받을 예정이라면 1년 조기수령은 월 94만원입니다.</p><ul><li>1년 조기수령은 감소로 계산합니다.</li></ul>');
    const g = gateRewrite(before, after, E);
    expect(g.status).toBe('rejected');
    expect(g.regions[0]!.decisions[0]!.lostProtected).toEqual(['6만원']);
  });
  test('4 유일한 핵심 답(남은 기간 원리) 삭제 → 거부', () => {
    const plan = planCoreQuestions({ keyword: '상품 A vs 상품 B 갈아타기', evidenceText: '적금 가입 계약' });
    expect(plan[0]!.applicable).toBe(true);
    const core = '이미 가입 중인 사람은 원래 만기 5년이 아니라 지금부터 남은 기간을 놓고 비교해야 합니다.';
    const before = doc(`<p>${core} 참고로 은행마다 표시가 다릅니다.</p>`);
    const after = doc('<p>참고로 은행마다 표시가 다릅니다.</p>');
    const g = gateRewrite(before, after, E, { isCoreAnswer: (s) => isCoreAnswerSentence(s, plan) });
    expect(g.status).toBe('rejected');
    expect(g.regions[0]!.decisions[0]!.lostCore.length).toBe(1);
    expect(plain(g.html)).toContain(core);
  });
  test('5 실제 근거 없는 주장만 제거 → 허용', () => {
    const before = doc('<p>상품 A 는 월 최대 50만원까지 납입합니다. 우대금리는 연 2.5% 입니다.</p>');
    const after = doc('<p>상품 A 는 월 최대 50만원까지 납입합니다.</p>');
    const g = gateRewrite(before, after, E);
    expect(g.status).toBe('accepted');
    expect(g.html).toBe(after);
  });
  test('6 문체만 고치고 의미 보존 → 허용 · 문단이 늘어나도 값이 남으면 허용 · 새 문단에 근거 없는 값이 들어오면 거부', () => {
    const before = doc('<p>상품 A 는 월 최대 50만원까지 납입합니다. 기여금은 12% 입니다.</p>');
    const styled = doc('<p>상품 A 에는 월 최대 50만원까지 넣을 수 있죠. 기여금은 12% 예요.</p>');
    expect(gateRewrite(before, styled, E).status).toBe('accepted');
    const split = doc('<p>상품 A 에는 월 최대 50만원까지 넣을 수 있죠.</p><p>기여금은 12% 예요.</p>');
    expect(gateRewrite(before, split, E).status).toBe('accepted');
    const injected = doc('<p>상품 A 는 월 최대 50만원까지 납입합니다. 기여금은 12% 입니다.</p><p>우대금리는 연 3.3% 입니다.</p>');
    const g = gateRewrite(before, injected, E);
    expect(g.status).toBe('rejected');
    expect(g.regions[0]!.decisions[0]!.introducedUnsupported).toEqual(['3.3%']);
    expect(plain(g.html)).not.toContain('3.3%');
    expect(gateRewrite(before, before, E).status).toBe('not-applicable');
  });
});

describe('라이브 2편 재생 — revised=0 이라 동작 불변', () => {
  test('before-preflight → final(라이브) 사이 pre-publish-fix 변경 없음(not-applicable) · final-authority 출력은 replay-761 과 같다', () => {
    for (const r of [R1, R2]) {
      const V = viewOf(r);
      // 라이브에서 pre-publish-fix 는 revised=0 — 전후 HTML 이 같으면 게이트는 아무것도 하지 않는다
      expect(gateRewrite(r.htmlBeforePreflight, r.htmlBeforePreflight, V).status).toBe('not-applicable');
      const plan = planCoreQuestions({ keyword: r.keyword, searchIntent: r.searchIntent, evidenceText: V.context });
      const dims = plan.filter((q) => q.applicable).map((q) => q.dimension);
      const fa = runFinalAuthority({ html: r.htmlFinal, evidence: V, keyword: r.keyword, coreQuestions: plan, dimensions: dims });
      const saved = path.join('C:/Users/park/Desktop/ORBIT-실제캡처-20260929/replay-761', `final-after-authority-${r.runId.slice(-6)}.html`);
      if (fs.existsSync(saved)) expect(fa.html).toBe(fs.readFileSync(saved, 'utf8'));                 // replay-761 산출물과 바이트 동일
      expect(fa.report.fact.status).toBe('passed');
    }
  });
  test('배선 — pre-publish-fix 결과가 gateRewrite 를 거치고 trace pre-publish-fix.rewrite 를 남긴다 · gateRewrite 는 gateRepairs 재사용', () => {
    const orch = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
    expect(orch).toContain("gateRewrite(html, outcome.html, validationView().evidence");
    expect(orch).toContain("trace.event('pre-publish-fix.rewrite'");
    expect(orch).toContain("accepted: 'not-applicable'");
    expect(orch.indexOf('gateRewrite(html, outcome.html')).toBeLessThan(orch.indexOf('runFinalAuthority({'));
    const fg = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', 'fact-guard.ts'), 'utf8');
    const body = fg.slice(fg.indexOf('export function gateRewrite'));
    expect(body).toContain('gateRepairs(before, repairs, evidence');
    expect(typeof gateRepairs).toBe('function');
  });
});
