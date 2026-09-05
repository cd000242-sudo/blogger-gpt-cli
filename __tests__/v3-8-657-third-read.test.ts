const fs = require('fs');
const path = require('path');

import { repairGluedSentences, repairSplitNumbers, removeEchoedSentences } from '../src/core/final/auto-repair';
import { linesAfter } from './helpers/source-block';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.657 — 세 번째 3편(100 · 86 · 76)을 읽어서 잡은 후처리 결함 넷.
 * 전부 모델이 아니라 코드가 만든 것이고, 하네스는 하나도 못 봤다.
 *
 *  ① "www. globalepic. co. kr" — 붙은 문장 고치기가 주소 안의 마침표에도 공백을 넣었다
 *  ② "5,<br>087대" — 천 단위 쉼표에서 줄이 갈렸다
 *  ③ 절이 "이때 기준이…" 로 시작 / 마무리가 "첫째, … 셋째" — echo 제거가 첫 문장·번호 문장을 지웠다
 *  ④ 목차 "5. 공식 안내 확인과 문의 전 준비할 정보" vs 본문 h2 "5. 과 문의 전 준비할 정보" — 본문 h2 가 모델 것
 */
describe('v3.8.657 세 번째 읽기', () => {
  test('① 주소 안의 마침표에는 공백을 넣지 않는다, 글에는 넣는다', () => {
    const html = '<p>끝났습니다.다음 문장. 원문은 http://www.globalepic.co.kr/view.php?ud=1 와 https://www.newsis.com/view/N1 에서 봅니다.끝.</p>';
    const r = repairGluedSentences(html);
    expect(r.html).toContain('http://www.globalepic.co.kr/view.php?ud=1');
    expect(r.html).toContain('https://www.newsis.com/view/N1');
    expect(r.html).toContain('끝났습니다. 다음 문장');
    expect(r.html).toContain('봅니다. 끝');
  });

  test('② 천 단위 쉼표에서 갈린 숫자를 붙인다 — 진짜 절 경계는 둔다', () => {
    const r = repairSplitNumbers('<p>부과 발표에는 5,<br>\n087대, 약 2억2천만원 규모와 함께,<br>\n납부기한이 담겼다.</p>');
    expect(r.html).toContain('5,087대');
    expect(r.html).toContain('함께,<br>\n납부기한');
    expect(r.count).toBe(1);
  });

  test('③ 절의 첫 문장은 본문과 겹쳐도 지우지 않는다', () => {
    const 첫문장 = '신규 전입자는 7월 1일 이후 전입하고 전입신고 뒤 30일이 지나야 신청할 수 있습니다.';
    const html = '<h2>1.</h2><p>' + 첫문장 + ' 다른 이야기를 덧붙입니다. 조금 더 길게 씁니다.</p>'
      + '<h2>2.</h2><p>' + 첫문장 + '<br>이때 기준이 되는 출발점은 전입신고를 마친 날입니다.</p>';
    const r = removeEchoedSentences(html);
    const second = r.html.slice(r.html.indexOf('<h2>2.'));
    expect(second).toContain(첫문장);
  });

  test('③ "첫째·둘째·셋째" 문단은 통째로 지우지 않는다', () => {
    const 둘째 = '둘째, 7월 1일 이후 전입자는 전입신고 뒤 30일이 지나야 신청할 수 있고 90일 실거주 확인을 받습니다.';
    const html = '<h2>1.</h2><p>' + 둘째.replace('둘째, ', '') + '</p><p>다른 문단입니다. 충분히 긴 다른 문장입니다.</p>'
      + '<h2>마무리</h2><p>첫째, 기존 거주자입니다.</p><p>' + 둘째 + '</p><p>셋째, 주소만 둔 경우입니다.</p>';
    const r = removeEchoedSentences(html);
    expect(r.html).toContain(둘째);
  });

  test('④ 본문 h2 는 계획된 h2Titles 를 쓴다 — 목차와 본문이 같아야 한다', () => {
    const o = read('src/core/final/orchestration.ts');
    expect(o).toContain('const plannedH2 = String(h2Titles[idx]');
    expect(linesAfter(o, 'const plannedH2 = String(h2Titles[idx]', 2)).toContain('if (plannedH2) cleanH2 = plannedH2;');
  });

  test('② 가 발행 전 수리 파이프라인에 들어 있다', () => {
    const a = read('src/core/final/auto-repair.ts');
    expect(a).toContain("kind: 'split-number'");
  });
});
