const fs = require('fs');
const path = require('path');

import { repairStrayBrackets } from '../src/core/final/auto-repair';
import { findInlineFaq } from '../src/core/final/article-audit';
import { buildAnswerBlock } from '../src/core/final/answer-block';
import { restoreDatePrefix, buildTitlePromiseBlock } from '../src/core/final/title-promise-headings';
import { NARRATIVE_FLOW_RULES } from '../src/core/final/narrative-flow';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.661 — 여섯 번째 읽기: 흐름 규칙(660) 뒤 5편(94 · 80 · 88 · 100 · 76).
 * 서론이 질문으로 끝나고, 절마다 판단이 붙고, 결론이 답한다 — 척추가 생겼다. 그래도 읽으니:
 *
 *  ① "…적용될 예정이기 때문입니다></p>" — 모델이 흘린 '>' 하나가 문장 끝에 찍혔다
 *  ② "9·3 노동부 지침" 이 소제목에서 "3 노동부 지침과 …" — 코드 정규식이 아니라 모델이 "9·" 를 번호로 알고 뗀다 (3회 재현)
 *  ③ 소제목 없이 평문으로 늘어놓은 Q/A ("부결되면 기존 대출은 유지되나요?" / 답 / 질문 / 답) — h3 만 보던 검사가 놓쳤다
 *  ④ 답 박스 질문 자리에 60자 넘는 서술문("고용노동부 … 보지 않았습니다.")이 왔다
 *  ⑤ "제 판단은" 이 다섯 절에 다섯 번 — 말머리를 바꿔 쓰게 한다
 */
describe('v3.8.661 여섯 번째 읽기', () => {
  test('① 문장 끝의 꺾쇠 찌꺼기를 지운다 — 태그는 건드리지 않는다', () => {
    const r = repairStrayBrackets('<p>강화 기준이 적용될 예정이기 때문입니다></p><p>다음 문단.</p><a href="x">링크</a>');
    expect(r.count).toBe(1);
    expect(r.html).toContain('때문입니다</p>');
    expect(r.html).toContain('<a href="x">링크</a>');
    expect(repairStrayBrackets('<p>비교: A > B 입니다.</p>').count).toBe(0);
  });

  test('② 제목의 날짜 접두어를 소제목에 되돌린다', () => {
    const title = '성과급 요구 파업이 불법으로 갈리는 선, 9·3 노동부 지침';
    expect(restoreDatePrefix('3 노동부 지침과 판례 오해', title)).toBe('9·3 노동부 지침과 판례 오해');
    expect(restoreDatePrefix('4 서민금융센터도 보증심사는 별도', '햇살론15가 거절되는 지점 - 9·4 서민금융 복합지원센터')).toBe('9·4 서민금융센터도 보증심사는 별도');
    // 제목에 그런 날짜가 없으면 손대지 않는다 (진짜 숫자 소제목)
    expect(restoreDatePrefix('3 노동부 지침과 판례 오해', '성과급 파업 지침')).toBe('3 노동부 지침과 판례 오해');
    expect(restoreDatePrefix('노동부 지침과 판례 오해', title)).toBe('노동부 지침과 판례 오해');
    expect(buildTitlePromiseBlock(title)).toContain('날짜입니다');
    expect(read('src/core/final/orchestration.ts')).toContain('restoreDatePrefix(t, String(h1');
  });

  test('③ 평문 Q/A 목록도 본문 속 FAQ 로 잡는다', () => {
    const html = '<h2>5. 상담 창구</h2><h3>5-1. 기존 계약</h3><p>주택담보대출 부결 뒤 확인할 것은 기존 대출입니다.</p>'
      + '<p>부결되면 기존 대출은 유지되나요?</p><p>대환이 실행되지 않았다면 기존 계약은 유지됩니다.</p>'
      + '<p>부결 후 바로 재신청해도 되나요?</p><p>금융회사별 기준이 다릅니다.</p>'
      + '<p>정책대출 부결 뒤 일반 신용대출을 신청하면 해결되나요?</p><p>두 상품은 심사 체계가 다릅니다.</p>'
      + '<h2>자주 묻는 질문 (FAQ)</h2><details><summary>Q</summary><p>A</p></details>';
    expect(findInlineFaq(html)).toHaveLength(1);
    // 질문 문단이 둘 이하이면 흉내가 아니다
    const fine = '<h2>1.</h2><p>왜 갈릴까요?</p><p>이유는 이렇습니다. 길게 설명합니다.</p><h2>자주 묻는 질문 (FAQ)</h2><p>Q</p>';
    expect(findInlineFaq(fine)).toHaveLength(0);
  });

  test('④ 답 박스 질문 자리에 온 긴 서술문은 키워드 질문으로 대신한다', () => {
    const html = buildAnswerBlock({
      keyword: '성과급 요구 파업',
      question: '고용노동부 2026년 9월 3일 지침은 매출·영업이익·당기순이익 등 기업 이익과 일정 비율로 연동하는 N% 성과급 요구를 노조법상 의무적 교섭·조정·쟁의행위 대상으로 보지 않았습니다.',
      answer: '영업이익 N퍼센트처럼 기업 이익과 연동한 성과급 요구는 의무적 교섭과 쟁의행위 대상으로 보지 않는 입장입니다. 취업규칙에 적힌 지급 기준의 이행 요구는 근로조건으로 다뤄질 여지가 남습니다.',
    });
    expect(html).not.toContain('보지 않았습니다.</');
    expect(html).toContain('성과급 요구 파업');
    // 진짜 질문은 그대로
    const ok = buildAnswerBlock({ keyword: 'k', question: '성과급 요구는 노동쟁의 대상인가?', answer: '기업 이익과 연동한 요구는 대상이 아닙니다. 약정 이행 요구는 근로조건입니다.' });
    expect(ok).toContain('성과급 요구는 노동쟁의 대상인가?');
  });

  test('⑤ 판단 말머리를 절마다 바꿔 쓰게 한다', () => {
    expect(NARRATIVE_FLOW_RULES).toContain('같은 말머리를 절마다 되풀이하지 마세요');
  });
});
