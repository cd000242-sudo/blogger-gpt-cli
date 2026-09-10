const fs = require('fs');
const path = require('path');

import { buildGroundingReference, findUngroundedFacts } from '../src/core/final/fact-guard';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.714 — 사장님이 발행글을 읽고: 본문에 **금액이 한 번도 안 나왔다.**
 *
 * 하네스 실측(경기도 산후조리비 글): 금액 1개 · 날짜 9개.
 * 독자가 가장 먼저 찾는 숫자가 빠졌다.
 *
 * 원인 — 리포트(오늘의 글감)는 "출생아 1인당 50만원 지역화폐" 를 적어 줬는데
 * 그 브리프가 **근거 장부에 안 실렸다.** 장부에 없는 수치는 근거 없음으로 판정돼
 * 문장째 지워진다(fact-guard 규칙 2). 그래서 금액 이야기가 통째로 사라졌다.
 *
 * 리포트는 [확인]/[추정] 을 구분해 적는 자료다 — 근거로 인정한다.
 */
describe('v3.8.714 리포트 사실을 근거로 인정한다', () => {
  const 리포트사실 = [
    '경기도 산후조리비 지원 종료',
    '출생아 1인당 50만원 지역화폐',
    '9월 30일 신청분까지 지원 후 종료',
  ].join('\n');

  test('브리프가 장부에 들어간다', () => {
    const ref = buildGroundingReference({ factContext: '다른 자료', briefFacts: 리포트사실 });
    expect(ref).toContain('50만원');
    expect(ref).toContain('다른 자료');
  });

  test('브리프를 맨 앞에 둔다 — 상한에 밀려 잘리면 또 지워진다', () => {
    const ref = buildGroundingReference({
      factContext: 'ㄱ'.repeat(70000),   // 상한(60,000자)을 넘기는 자료
      briefFacts: 리포트사실,
      maxChars: 3000,
    });
    expect(ref.startsWith('경기도 산후조리비')).toBe(true);
    expect(ref).toContain('50만원');
  });

  test('브리프에 있는 금액은 이제 근거 없음으로 잡히지 않는다', () => {
    const html = '<p>경기도 산후조리비는 출생아 1인당 50만원을 지역화폐로 지급합니다.</p>';

    // 예전처럼 브리프가 없으면 → 근거 없는 수치로 잡혀 문장째 지워졌다
    const before = findUngroundedFacts(html, buildGroundingReference({ factContext: '' }));
    expect(before.some((f) => f.token.includes('50만원'))).toBe(true);

    // 브리프를 실으면 → 근거 있는 수치가 된다
    const after = findUngroundedFacts(html, buildGroundingReference({ briefFacts: 리포트사실 }));
    expect(after.some((f) => f.token.includes('50만원'))).toBe(false);
  });

  test('브리프에 없는 숫자는 여전히 잡는다 — 근거를 넓히되 풀어 주지는 않는다', () => {
    const html = '<p>지원금은 300만원입니다.</p>';
    const found = findUngroundedFacts(html, buildGroundingReference({ briefFacts: 리포트사실 }));
    expect(found.some((f) => f.token.includes('300만원'))).toBe(true);
  });

  test('발행 경로가 리포트 슬롯을 장부에 넘긴다 — 안 넘기면 죽은 설정이다', () => {
    const orch = read('src/core/final/orchestration.ts');
    expect(orch).toContain('briefFacts: reportBriefFacts');
    expect(orch).toContain('cpcReportSlot');
    // 리포트가 적어 둔 값·확인항목·고유명사를 모두 싣는다
    for (const field of ['slot.value', 'slot.mustCheck', 'slot.properNouns']) {
      expect(orch).toContain(field);
    }
  });
});
