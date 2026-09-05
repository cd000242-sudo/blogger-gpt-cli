const fs = require('fs');
const path = require('path');

import { titlePromises } from '../src/core/final/reader-retention';
import { measureStances, findTableTemplate } from '../src/core/final/depth-voice';
import { capInlineTables, tableToList } from '../src/core/final/table-cap';
import { findPersonalVoice } from '../src/core/final/claim-safety';
import { repairPersonalFiller } from '../src/core/final/auto-repair';
import { findInlineFaq } from '../src/core/final/article-audit';
import { buildAnswerBlock, restoreAnswerBlockQuestion } from '../src/core/final/answer-block';
import { acceptRevisedSection } from '../src/core/final/post-critique';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.664 — 여덟 번째 읽기: 663 규칙 뒤 5편(96 · 86 · 90 · 94 · 59).
 * 점수는 못 보고 읽어서 찾은 일곱:
 *  ① 답변 블록의 질문 줄이 사라지고 결론의 댓글 문장이 <p> 로 들어왔다
 *  ② 제목의 "주담대"(3자)가 약속 조각에서 빠졌다 — 소제목도 검사도 없었다
 *  ③ "검색자 질문" 재료로 절 하나를 통째로 Q/A 목록으로 만들었다 — 마침표로 닫은 질문은 검사가 못 봤다
 *  ④ 표 상한이 JSON 표만 세어 한 번도 안 걸렸다 — 모델은 본문 HTML 에 표를 넣는다
 *  ⑤ 옛 검사(personal-voice)가 "제가 보기에는" 을 -5 로 깎았다 — 660 이 요구한 말머리다
 *  ⑥ 판단 검사가 "경우에는 …두는 편이 낫습니다" 를 얕다고 셌다
 *  ⑦ 같은 지역 목록을 열 번 나열 (규칙 6)
 */
describe('v3.8.664 여덟 번째 읽기', () => {
  test('① 답변 블록 — 이름 없는 <p> 를 빼고 질문 줄을 되살린다 · 자가 수정이 블록을 바꾸면 원본 유지', () => {
    const good = buildAnswerBlock({
      keyword: '햇살론15가 거절되는 지점',
      question: '햇살론15는 어디서 거절되나',
      answer: '보증번호 발급과 은행 대출 실행은 별도 판단입니다. 금융회사는 자체 여신 심사로 대출을 거절할 수 있습니다.',
      basis: '',
    });
    expect(good).toContain('class="answer-first-q"');
    expect(restoreAnswerBlockQuestion(good, { question: '햇살론15는 어디서 거절되나', keyword: '햇살론15가 거절되는 지점' }).changed).toBe(false);

    const broken = good.replace(/<p class="answer-first-q"[^>]*>[\s\S]*?<\/p>/, '<p>댓글에 보증번호 발급 여부를 남기면 판단 순서가 남습니다.</p>');
    expect(broken).not.toContain('answer-first-q');
    const r = restoreAnswerBlockQuestion(broken, { question: '햇살론15는 어디서 거절되나', keyword: '햇살론15가 거절되는 지점' });
    expect(r.changed).toBe(true);
    expect(r.html).toContain('class="answer-first-q"');
    expect(r.html).toContain('햇살론15는 어디서 거절되나');
    expect(r.html).not.toContain('댓글에 보증번호');
    expect(r.html).toContain('class="answer-first-a"');

    const original = { index: 0, heading: '(도입부)', html: `<h1>t</h1>${good}<div class="content intro-section"><p>${'서론 문장입니다. '.repeat(20)}</p></div>` };
    const revised = original.html.replace(/<p class="answer-first-q"[^>]*>[\s\S]*?<\/p>/, '<p>댓글에 남기면 판단 순서가 남습니다.</p>');
    const verdict = acceptRevisedSection(revised, original);
    expect(verdict.accepted).toBe(false);
    expect(verdict.reason).toContain('답변 블록');
    expect(acceptRevisedSection(original.html.replace('서론 문장입니다.', '서론 첫 문장입니다.'), original).accepted).toBe(true);
  });

  test('② 제목의 세 글자 약속("주담대")도 조각이다', () => {
    const p = titlePromises('대출 갈아타기 부결 사유와 재신청 방법 - 신용대출·주담대·전세대출에서 갈리는 지점');
    expect(p).toContain('주담대');
    expect(p).toContain('신용대출');
  });

  test('③ 문답형 절 제목과 마침표로 닫은 질문 문단을 잡는다', () => {
    const qa = '<h2>3. 신용대출 대환 가능성 질문과 답변</h2><p>설명.</p><h2>자주 묻는 질문 (FAQ)</h2><p>Q</p>';
    expect(findInlineFaq(qa)).toHaveLength(1);
    const dotted = '<h2>5. 거절 뒤 확인할 곳</h2>'
      + '<p>보증번호가 나오면 대출은 확정인가요. 서민금융진흥원 안내상 금융회사 자체 심사가 남아 있어 확정으로 보기는 어렵습니다.</p>'
      + '<p>은행이 거절하면 다른 지점도 같은가요. 같은 금융회사의 여신 기준 문제인지부터 확인해야 합니다.</p>'
      + '<p>개인회생 이력이 있으면 모두 불가한가요. 진행 중인 개인회생과 확정 뒤 경로는 구분해서 봐야 합니다.</p>'
      + '<h2>자주 묻는 질문 (FAQ)</h2><p>Q</p>';
    expect(findInlineFaq(dotted)).toHaveLength(1);
    expect(findInlineFaq('<h2>1. 본문</h2><p>설명 문장입니다. 두 번째 문장입니다.</p><h2>자주 묻는 질문 (FAQ)</h2><p>Q</p>')).toHaveLength(0);
  });

  test('④ 본문 표를 세고 넘치면 숫자 적은 것부터 목록으로 · 검사는 요약표를 빼고 센다', () => {
    const table = (a: string, b: string) => `<table><thead><tr><th>구분</th><th>내용</th></tr></thead><tbody><tr><td>${a}</td><td>${b}</td></tr></tbody></table>`;
    const contents = [
      `<p>a</p>${table('코스닥', '300억원 2027년 7월')}`,
      `<p>b</p>${table('회사 의사', '이전 희망')}`,
      `<p>c</p>${table('영업이익', '3개년 중 2개년 흑자 200억원')}`,
      `<p>d</p>${table('정리매매', '90거래일 45거래일')}`,
    ];
    const r = capInlineTables(contents, 3);
    expect(r.total).toBe(4);
    expect(r.demoted).toBe(1);
    expect(r.contents[1]).not.toContain('<table');
    expect(r.contents[1]).toContain('<ul><li><strong>회사 의사</strong> — 이전 희망</li></ul>');
    expect(r.contents[0]).toContain('<table');
    expect(contents[1]).toContain('<table');   // 입력은 그대로
    expect(capInlineTables(contents.slice(0, 3), 3).demoted).toBe(0);
    expect(tableToList('<table><tr><th>h</th></tr><tr><td>x</td></tr></table>')).toBe('<ul><li>x</li></ul>');

    const summary = '<table class="responsive-table summary-table"><tr><th>항목</th><th>내용</th></tr><tr><td>a</td><td>b</td></tr></table>';
    const body = ['비고', '기한', '문서'].map((h) => `<h2>s</h2><table><tr><th>구분</th><th>${h}</th></tr><tr><td>a</td><td>b</td></tr></table>`).join('');
    expect(findTableTemplate(summary + body, 5)).toHaveLength(0);
    expect(findTableTemplate(body + '<h2>s</h2><table><tr><th>구분</th><th>기타</th></tr><tr><td>a</td><td>b</td></tr></table>', 5)).toHaveLength(1);
  });

  test('⑤ "제가 보기에는" 은 판단의 말머리다 — 깎지도 떼지도 않는다', () => {
    expect(findPersonalVoice('제가 보기에는 대출이 없는 전북 사업자는 손해보험 문구부터 확인하는 쪽이 맞습니다.')).toHaveLength(0);
    expect(findPersonalVoice('제 생각에는 그렇습니다. 개인적으로는 아닙니다.')).toHaveLength(0);
    expect(findPersonalVoice('아무튼 그렇습니다.')).toHaveLength(1);
    expect(repairPersonalFiller('<p>제 기준으로는 손해보험이 먼저입니다.</p>').html).toContain('제 기준으로는');
  });

  test('⑥ 조건 또는 이유 + 행동이면 날카로운 판단이다', () => {
    const cases = [
      '단체협약에 지급 시기나 산식이 들어 있는 경우에는 그 조항의 이행 문제를 요구안 중심에 두는 편이 낫습니다.',
      '신용점수 걱정 때문에 아무 확인도 하지 않는 것보다, 신청 금융기관에 재신청 처리와 조회 기록을 구분해 묻는 편이 낫습니다.',
      '이때 성과급 문구와 배치전환, 구조조정 문구를 한 덩어리로 두지 않는 편이 낫습니다.',
    ];
    for (const c of cases) {
      const s = measureStances(c);
      expect(s.total).toBe(1);
      expect(s.sharp).toBe(1);
    }
    // "그래서" 로 시작하면 근거는 앞 문장에 있다
    const lead = '갈아타기 부결은 기존 대출이 사라졌다는 뜻이 아니라 새 심사에서 조건이 맞지 않았다는 뜻이기 때문입니다. '
      + '그래서 먼저 기존 계약의 만기와 금리 재산정 조건을 보고, 이어서 신청 정보와 서류의 일치 여부를 정리하는 편이 낫습니다.';
    expect(measureStances(lead).sharp).toBe(1);
    // 조건도 이유도 없는 "…쪽입니다" 는 여전히 얕다
    const shallow = measureStances('제 판단은 공고문을 한 번 읽고 끝내기보다 상품명과 보장 목적을 메모해 두는 쪽입니다.');
    expect(shallow.total).toBe(1);
    expect(shallow.sharp).toBe(0);
  });

  test('규칙과 배선', () => {
    const o = read('src/core/final/orchestration.ts');
    expect(o).toContain("require('./table-cap')");
    expect(o).toContain('capInlineTables(');
    expect(o).toContain('restoreAnswerBlockQuestion(');
    expect(o).toContain('표(<table>)는 글 전체에 최대 3개');
    const g = read('src/core/final/generation.ts');
    expect((g.match(/문답형 (?:섹션|소제목) 금지/g) || []).length).toBe(2);
    expect(read('src/core/final/narrative-flow.ts')).toContain('문답 목록으로 늘어놓지 마세요');
    expect(read('src/core/final/depth-voice.ts')).toContain('같은 목록은 한 번만');
  });
});
