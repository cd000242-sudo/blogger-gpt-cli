const fs = require('fs');
const path = require('path');

import {
  DEPTH_VOICE_RULES,
  extractRepeatedFacts,
  buildRepeatedFactsBlock,
  measureStances,
  findShallowStances,
  findTableTemplate,
} from '../src/core/final/depth-voice';
import { auditArticle, toPlainText } from '../src/core/final/article-audit';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.662 — 깊이와 목소리.
 * 사장님: "100점까지 글의 깊이와 목소리를 끌어올려줬으면 해" / "반드시 100점은 거짓이겠지, 근접하게"
 *
 *  ① 판단에 조건과 행동이 있어야 판단이다 — "메모해 두는 쪽입니다" 는 아니다
 *  ② 자료가 되풀이하는 수치를 생성 전에 문장째 넘긴다 — 로그마다 6개씩 버려지고 있었다
 *  ③ 표가 절마다 같은 틀이면 양식이 보인다
 */
describe('v3.8.662 깊이와 목소리', () => {
  test('② 근거에서 두 번 이상 나오는 수치를 문장과 함께 뽑는다', () => {
    const evidence = [
      '이천시는 2026년 2기분 환경개선부담금으로 5,087대에 약 2억2천만원을 부과했다. 납부기한은 9월 30일까지다.',
      '이번 부과는 5,087대가 대상이며 9월 30일까지 내야 한다. 유로5·유로6 경유차는 면제다.',
      '환경개선부담금 납부기한 9월 30일. 저감장치 부착 차량은 3년간 면제된다. 3년 면제는 부착일부터다.',
    ].join('\n');
    const facts = extractRepeatedFacts(evidence);
    const values = facts.map((f) => f.value);
    expect(values).toContain('5,087대');
    expect(values).toContain('9월 30일');
    expect(values).toContain('3년');
    expect(values).not.toContain('2026년');
    for (const f of facts) expect(f.sentence.length).toBeGreaterThanOrEqual(10);
    const block = buildRepeatedFactsBlock(evidence);
    expect(block).toContain('[자료가 되풀이하는 수치');
    expect(block).toContain('9월 30일');
    expect(buildRepeatedFactsBlock('숫자가 없는 자료입니다.')).toBe('');
  });

  test('① 조건과 행동이 있는 판단만 날카로운 판단으로 센다', () => {
    const sharp = '경남 사업자라면 10월 안내를 기다리지 말고 지금 손해보험 공고부터 읽으세요. 제 판단은 그렇습니다.';
    const shallow = '제 판단은 공고문을 한 번 읽고 끝내기보다 상품명과 보장 목적을 메모해 두는 쪽입니다.';
    const s1 = measureStances('저는 경남 사업자라면 10월 안내를 기다리지 말고 지금 손해보험 공고부터 읽는 쪽으로 봅니다. 신용생명보험은 대출이 있을 때만 의미가 있기 때문입니다.');
    expect(s1.total).toBe(1);
    expect(s1.sharp).toBe(1);
    const s2 = measureStances(shallow);
    expect(s2.total).toBe(1);
    expect(s2.sharp).toBe(0);
    expect(findShallowStances([shallow, shallow, shallow, sharp].join(' '))).toHaveLength(1);
    expect(findShallowStances([sharp, sharp, sharp, shallow].join(' '))).toHaveLength(0);
    expect(findShallowStances(shallow)).toHaveLength(0);   // 판단이 셋 미만이면 재지 않는다
  });

  test('③ 표가 절마다 같은 틀이면 잡는다', () => {
    const table = (last: string) => `<table><thead><tr><th>구분</th><th>내용</th><th>${last}</th></tr></thead><tbody><tr><td>a</td><td>b</td><td>c</td></tr></tbody></table>`;
    const same = '<h2>1</h2>' + table('누구에게 맞는지') + '<h2>2</h2>' + table('누구에게 맞는지') + '<h2>3</h2>' + table('누구에게 맞는지');
    expect(findTableTemplate(same, 3)).toHaveLength(1);
    const varied = '<h2>1</h2>' + table('비고') + '<h2>2</h2><p>표 없음</p><h2>3</h2>' + table('기한');
    expect(findTableTemplate(varied, 3)).toHaveLength(0);
    const tooMany = '<h2>1</h2>' + table('a') + table('b') + '<h2>2</h2>' + table('c') + '<h2>3</h2>' + table('d');
    expect(findTableTemplate(tooMany, 3)).toHaveLength(1);
  });

  test('하네스에 실려 있고 통계가 나온다', () => {
    const shallow = '<p>제 판단은 메모해 두는 쪽입니다.</p>';
    const html = '<h1>소상공인 무료 상생보험 신청 경로</h1>'
      + '<h2>1. 구조</h2><p>' + '상생보험은 7개 지역에서 시작됐습니다. '.repeat(30) + '</p>' + shallow
      + '<h2>2. 지역</h2><p>' + '신청 경로는 지역마다 다릅니다. '.repeat(30) + '</p>' + shallow
      + '<h2>3. 조건</h2><p>' + '대출 이용 여부가 갈림길입니다. '.repeat(30) + '</p>' + shallow;
    const r = auditArticle(html);
    expect(r.issues.map((i) => i.kind)).toContain('stance-shallow');
    expect(r.stats.sharpStances).toBe(0);
    expect(r.stats.firstPersonStance).toBe(3);
  });

  test('규칙과 배선 — 두 경로, 되풀이 수치 블록, 발행 전 수정 대상', () => {
    expect(DEPTH_VOICE_RULES).toContain('판단 문장에는 조건과 행동이 둘 다 있어야 합니다');
    expect(DEPTH_VOICE_RULES).toContain('표는 글 전체에 최대 3개');
    expect(read('src/core/final/generation.ts')).toContain('${DEPTH_VOICE_RULES}');
    expect(read('src/core/final/agent-harness.ts')).toContain("require('./depth-voice').DEPTH_VOICE_RULES");
    expect(read('src/core/final/agent-harness.ts')).toContain('buildRepeatedFactsBlock(input.evidence)');
    const o = read('src/core/final/orchestration.ts');
    expect(o).toContain('buildRepeatedFactsBlock([factEvidence.context, naverGrounding]');
    const p = read('src/core/final/pre-publish-fix.ts');
    for (const k of ['stance-shallow', 'no-stance', 'deferral-flood', 'inline-faq']) expect(p).toContain(`'${k}',`);
    // 소제목 계획 프롬프트에 곁가지 금지
    expect(read('src/core/final/generation.ts')).toContain('곁가지');
  });
});
