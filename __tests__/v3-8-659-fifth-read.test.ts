const fs = require('fs');
const path = require('path');

import { removeEchoedSentences } from '../src/core/final/auto-repair';
import { extractFaqPairs, findFaqMismatches } from '../src/core/final/reader-retention';
import { auditArticle, findInlineFaq } from '../src/core/final/article-audit';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.659 — 다섯 번째 읽기: 파서를 고친 뒤 서로 다른 키워드 5편(100 · 58 · 100 · 92 · 96, 중간값 96).
 * 주소 훼손·빈 절·"$1" 은 0건. 그래도 읽으니:
 *
 *  ① "…늦춘 것이지," 가 덩그러니 — 쉼표로 끝나는 <br> 조각의 뒷조각만 겹친다고 지워졌다 (2편)
 *  ② "9·3 노동부 지침" 이 소제목에서 "3 노동부 지침으로…" — 모델이 "9.3" 으로 쓰면 번호 벗기기가 "9." 를 먹는다
 *  ③ "5-2. 부결 뒤 자주 묻는 질문" — 본문 절 안에 Q/A 를 평문으로 늘어놓고 진짜 FAQ 가 또 붙었다
 *  ④ FAQ 딴 답 오탐: "경남은 10월부터 가입이 열리는 지역이에요. … 확인할 수 있어요" — 답한 뒤 맺음말을 피하는 말로 봤다
 */
describe('v3.8.659 다섯 번째 읽기', () => {
  test('① 쉼표로 끝나는 조각은 다음 조각과 한 문장으로 묶어 잰다 — 뒷조각만 지워지지 않는다', () => {
    const 겹치는뒷조각 = '모든 기업의 상장유지를 보장하는 것이 아닙니다.';
    const html = '<h2>0.</h2><p>' + 겹치는뒷조각 + ' 기준 강화 시점만 늦춘 조치입니다.</p>'
      + '<h2>1.</h2><p>결정된 내용은 시가총액 기준을 높이는 시점을 늦춘 것이지,<br>' + 겹치는뒷조각 + '<br>코스닥은 200억원에서 300억원으로 올리는 일정이 2027년 7월로 옮겨졌습니다.</p>';
    const r = removeEchoedSentences(html);
    const second = r.html.slice(r.html.indexOf('<h2>1.'));
    // 조각이 지워졌다면 앞조각과 함께 지워져야 하고, 남았다면 둘 다 남아야 한다 — "것이지," 만 남는 일은 없다
    const dangling = /것이지,\s*(?:<br>)?\s*코스닥/.test(second);
    expect(dangling).toBe(false);
  });

  test('② "9.3 노동부 지침" 은 번호가 아니다 — 소제목 번호 벗기기가 "9." 를 먹지 않는다', () => {
    const g = read('src/core/final/generation.ts');
    const o = read('src/core/final/orchestration.ts');
    // 번호 벗기기 정규식은 "숫자 뒤에 또 숫자" 이면 벗기지 않는다
    for (const src of [g, o]) expect(src).toContain('(?!\\d)');
    const strip = (t: string) => t.replace(/^\d+(?:[.):]\s*(?!\d)|\s+)/, '').trim();
    expect(strip('1. 성과급 요구안 점검')).toBe('성과급 요구안 점검');
    expect(strip('1.성과급 요구안 점검')).toBe('성과급 요구안 점검');
    expect(strip('9.3 노동부 지침으로 보는 요구안 점검')).toBe('9.3 노동부 지침으로 보는 요구안 점검');
    expect(strip('9·3 노동부 지침')).toBe('9·3 노동부 지침');
  });

  test('③ 본문 h3 에 FAQ 가 있으면 잡는다', () => {
    const html = '<h2>5. 자료</h2><h3>5-1. 기존 대출 지키기</h3><p>' + '내용입니다. '.repeat(20) + '</p>'
      + '<h3>5-2. 부결 뒤 자주 묻는 질문</h3><p>갈아타기가 부결되면 기존 대출은 바로 없어지나요 아닙니다.</p>'
      + '<h2>자주 묻는 질문 (FAQ)</h2><details><summary>Q. 정말?</summary><p>네.</p></details>';
    expect(findInlineFaq(html)).toHaveLength(1);
    expect(auditArticle(html).issues.map((i) => i.kind)).toContain('inline-faq');
    // 진짜 FAQ h2 만 있는 글은 안 잡는다
    expect(findInlineFaq('<h2>자주 묻는 질문 (FAQ)</h2><details><summary>Q</summary><p>A</p></details>')).toHaveLength(0);
  });

  test('③ 절 프롬프트가 본문 FAQ 를 금지한다', () => {
    expect(read('src/core/final/generation.ts')).toContain('**FAQ 는 본문에 넣지 않습니다 (v3.8.659)**');
  });

  test('④ 답한 뒤 "…에서 확인할 수 있어요" 로 맺는 답은 딴 답이 아니다', () => {
    const plain = ['자주 묻는 질문 (FAQ)', '', 'Q.', '경남 소상공인 무료 상생보험은 지금 바로 신청할 수 있나요?', '▼',
      '경남은 행정 준비 일정에 따라 10월부터 가입이 열리는 지역이에요. 접수 흐름은 지자체가 대상자를 선별한 뒤 SMS 로 안내하는 방식이에요. 문자를 받으면 상품명과 가입 가능 시점을 함께 확인할 수 있어요.',
    ].join('\n');
    expect(findFaqMismatches(extractFaqPairs(plain))).toHaveLength(0);
  });

  test('④ 첫 문장부터 피하면 여전히 딴 답이다', () => {
    const plain = ['자주 묻는 질문 (FAQ)', '', 'Q.', '임실형 농어촌 기본소득을 지금도 신청할 수 있나요?', '▼',
      '현재 접수 가능 여부는 주소지 관할 읍면사무소에서 확인할 수 있어요. 기존 거주자인지 알려주세요.',
    ].join('\n');
    expect(findFaqMismatches(extractFaqPairs(plain))).toHaveLength(1);
  });
});
