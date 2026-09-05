import { restoreSentencePeriods, usableBasis } from '../src/core/final/answer-block';
import { removeEchoedSentences } from '../src/core/final/auto-repair';

/*
 * v3.8.656 — 3편을 읽어서 잡은 결함 셋. 하네스 점수 84·88 글에 그대로 있었다.
 *
 *  ① 답 박스: "신청할 수 있습니다 10월8일까지 신청하면" — 다음 문장이 숫자로 시작하면 마침표를 안 찍었다
 *  ② 답 박스: "근거: 공식 확인 필요 2026 09 05" — 메모지 같은 근거가 첫 화면에 찍혔다
 *  ③ FAQ 답이 "다만 실제 접수는…" 으로 시작 — 첫 문장(=답)이 본문과 겹친다고 지워졌다
 */
describe('v3.8.656 읽어서 잡은 결함', () => {
  test('① 다음 문장이 숫자·영문으로 시작해도 마침표를 찍는다', () => {
    expect(restoreSentencePeriods('계속 거주한 군민은 9월7일부터 신청할 수 있습니다 10월8일까지 신청하면 지급합니다 7월1일 이후 전입자는'))
      .toBe('계속 거주한 군민은 9월7일부터 신청할 수 있습니다. 10월8일까지 신청하면 지급합니다. 7월1일 이후 전입자는');
    expect(restoreSentencePeriods('월출페이로 지급됩니다 F5 영주권자도 포함돼요 기준일은'))
      .toBe('월출페이로 지급됩니다. F5 영주권자도 포함돼요. 기준일은');
  });

  test('② "확인 필요" 류 근거는 안 보여 준다', () => {
    expect(usableBasis('공식 확인 필요 2026 09 05')).toBe('');
    expect(usableBasis('미확인')).toBe('');
    expect(usableBasis('임실군 2026년 9월 4일 발표')).toBe('임실군 2026년 9월 4일 발표');
  });

  test('③ FAQ 구간의 문장은 본문과 겹쳐도 지우지 않는다', () => {
    const 답 = '기존 거주자는 10월 8일까지 신청하면 10월 30일에 30만원을 받을 수 있어요.';
    const html = '<h2>1. 신청 대상</h2><p>' + 답 + '</p><p>다른 내용입니다. 충분히 긴 문장을 하나 더 둡니다.</p>'
      + '<h2>자주 묻는 질문 (FAQ)</h2><details><summary>Q. 지금도 신청할 수 있나요?</summary>'
      + '<p>' + 답 + '<br>다만 실제 접수는 읍면사무소 절차로 진행됩니다.</p></details>';
    const r = removeEchoedSentences(html);
    const faq = r.html.slice(r.html.indexOf('자주 묻는 질문'));
    expect(faq).toContain(답);
    expect(faq).not.toMatch(/<p>다만/);
  });

  test('③ FAQ 앞의 본문 중복은 예전처럼 지운다', () => {
    const 문장 = '신청 기간은 9월 7일부터 10월 30일까지이며 읍면 행정복지센터에서 접수합니다.';
    const html = '<h2>1.</h2><p>' + 문장 + '</p><h2>2.</h2><p>' + 문장 + '</p>';
    expect(removeEchoedSentences(html).count).toBeGreaterThanOrEqual(1);
  });
});
