const fs = require('fs');
const path = require('path');

import { measureStances, buildRepeatedFactsBlock, DEPTH_VOICE_RULES } from '../src/core/final/depth-voice';
import { findInlineFaq } from '../src/core/final/article-audit';
import { findFlowGaps } from '../src/core/final/narrative-flow';
import { toPlainText } from '../src/core/final/article-audit';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.663 — 일곱 번째 읽기: 깊이·목소리 규칙(662) 뒤 5편(90 · 68 · 96 · 74 · 74).
 * 곁가지 절이 사라지고, 자료 수치(6.96%→11.9%, 약 200곳, 90·45거래일)가 본문에 들어왔고, 결론이 "오늘 할 일" 로 닫힌다.
 * 그래도 읽으니:
 *  ① 판단을 "판단이 타당합니다 / 편이 낫습니다 / 쪽이 맞습니다 / 더 직접적입니다" 로도 닫는다 — 검사가 또 못 셌다
 *  ② 되풀이 수치가 무관해도 들어간다 — 대출 갈아타기 글에 삼성전자 사내 대출(5억원·1.5%)이 세 번
 *  ③ h2 "4. 은행 심사 거절 뒤 자주 묻는 질문" — 절 제목에 FAQ 를 박고 Q/A 를 늘어놓았다. h3 만 보던 검사가 놓쳤다
 *  ④ 표 4~6개 — "최대 3개" 를 시켜도 안 지킨다 → 코드가 숫자 적은 표부터 뺀다
 *  ⑤ H2 하나에 H3 둘 → 12,000자
 */
describe('v3.8.663 일곱 번째 읽기', () => {
  test('① 판단 어미를 넓게 센다', () => {
    const text = '여기서는 기업 이익의 N퍼센트를 새로 요구하는 경우와 약정된 기준의 지급을 요구하는 경우를 분리해 적는 판단이 타당합니다. '
      + '기존 지급 기준의 이행을 먼저 다루는 쪽이 맞습니다. '
      + '경남 사업자라면 10월 안내를 기다리지 말고 손해보험 공고부터 읽는 편이 낫습니다. '
      + '판례 목록을 넓게 찾기보다 자율 협의 문구를 다듬는 편이 더 직접적입니다.';
    const s = measureStances(text);
    expect(s.total).toBe(4);
    expect(s.sharp).toBeGreaterThanOrEqual(2);
    const flow = findFlowGaps('<h1>t</h1><h2>1</h2><p>' + text.repeat(6) + '</p>', toPlainText);
    expect(flow.stats.firstPersonStance).toBeGreaterThanOrEqual(4);
  });

  test('② 되풀이 수치는 제목·키워드 낱말이 든 문장 것만 넘기고, 무관한 수치는 쓰지 말라고 못 박는다', () => {
    const evidence = [
      '대출 갈아타기 부결 뒤 재신청은 6개월 뒤에 가능하다는 안내가 있다. 대출 갈아타기 부결 사유는 DSR 초과가 많다.',
      '삼성전자 사내 주거안정 지원 대출은 최대 5억원, 연 1.5% 이율이다. 삼성전자 임직원은 최대 5억원까지 빌릴 수 있다.',
      '대출 갈아타기 재신청은 6개월 뒤 가능하다. DSR 초과는 부결 사유다.',
    ].join('\n');
    const block = buildRepeatedFactsBlock(evidence, { keyword: '대출 갈아타기 부결', title: '대출 갈아타기 부결 사유와 재신청 방법' });
    expect(block).toContain('6개월');
    expect(block).not.toContain('5억원');
    expect(block).toContain('수치의 주체가 제목의 독자와 다른 곳');
    // 관련 수치가 둘 미만이면 걸러내지 않는다 (없는 것보다 낫다)
    expect(buildRepeatedFactsBlock(evidence, { keyword: '전혀 다른 주제' })).toContain('5억원');
  });

  test('③ FAQ 낱말이 든 본문 h2 를 잡는다 — 진짜 FAQ 블록 제목은 안 잡는다', () => {
    const html = '<h2>4. 은행 심사 거절 뒤 자주 묻는 질문</h2><p>보증번호가 발급됐는데 은행은 왜 거절할 수 있나요? 금융회사는 자체 심사기준을 적용합니다.</p>'
      + '<h2>자주 묻는 질문 (FAQ)</h2><details><summary>Q</summary><p>A</p></details>';
    const issues = findInlineFaq(html);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.title).toContain('절 제목에 FAQ');
    expect(findInlineFaq('<h2>1. 본문</h2><p>내용.</p><h2>자주 묻는 질문 (FAQ)</h2><p>Q</p>')).toHaveLength(0);
    // 질문으로 시작해 답이 이어지는 문단도 셋 이상이면 잡는다
    const prose = '<h2>1.</h2><p>왜 거절되나요? 자체 심사 때문입니다.</p><p>다른 지점은 되나요? 단정할 수 없습니다.</p><p>자동 전환되나요? 아닙니다.</p><h2>자주 묻는 질문 (FAQ)</h2><p>Q</p>';
    expect(findInlineFaq(prose)).toHaveLength(1);
  });

  test('④⑤ 표 상한과 분량 상한이 코드와 프롬프트에 있다', () => {
    const o = read('src/core/final/orchestration.ts');
    expect(o).toContain('const MAX_TABLES = 3;');
    expect(o).toContain('숫자가 적은');
    expect(DEPTH_VOICE_RULES).toContain('분량은 전체 6,000~9,000자');
    expect(DEPTH_VOICE_RULES).toContain('H2 하나에 H3 는 하나가 기본');
  });
});
