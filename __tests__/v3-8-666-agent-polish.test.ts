const fs = require('fs');
const path = require('path');

import { sanitizeFactUnsafeHtml } from '../src/core/final/fact-integrity';
import { applyFactRepairs } from '../src/core/final/fact-guard';
import { buildAnswerBlock, restoreAnswerBlockQuestion } from '../src/core/final/answer-block';
import { promiseQuery } from '../src/core/final/reader-retention';
import { fetchPromiseGrounding } from '../src/core/final/promise-grounding';
import { startsWithBackReference } from '../src/core/final/refers-back';
import { removeEchoedSentences } from '../src/core/final/auto-repair';
import { blockBetween } from './helpers/source-block';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

const evidence = (context: string) => ({
  context,
  provider: 'test',
  trustLevel: 'strong',
  sourceUrls: ['https://www.fsc.go.kr/po010101'],
  topic: '상생보험',
}) as any;

/*
 * v3.8.666 — 665 뒤 5편(100 · 83 · 100 · 100 · 92)을 읽고. 전부 후처리 코드였다:
 *  ① 주소가 "https://www. hankookilbo. com" 으로 — 사실검증 문장 분리가 주소 안의 마침표에서 끊었다
 *  ② 답변 블록의 답이 비었다 — 태그만 남은 교체본을 그대로 받았다
 *  ③ "다만 이 수치는…" — 지운 문장 뒤의 지시어 문장이 남았다
 *  ④ 약속 조각 검색어가 "지역", "부결 사유" 로 퇴화했다
 *  ⑤ 에이전트 경로에 호출 0회 후처리를 붙였다 (사장님 질문)
 */
describe('v3.8.666 후처리 잔여와 에이전트 후처리', () => {
  test('① 사실검증은 주소를 건드리지 않고, 주소 안의 숫자를 수치로 세지 않는다', () => {
    const url = 'https://www.mt.co.kr/policy/2026/09/06/2026090412572496705';
    const html = `<p>해당 기사는 ${url} 입니다. 금융위원회 발표는 상생기금 300억원 내용을 보여 줍니다.</p>`;
    const out = sanitizeFactUnsafeHtml(html, evidence('금융위원회는 총 300억원 상생기금을 조성했다.'));
    expect(out).toContain(url);
    expect(out).not.toContain('www. mt. co. kr');
    expect(out).toContain('300억원');
    // 근거 없는 수치가 든 문장만 빠지고 주소 문장은 남는다
    const out2 = sanitizeFactUnsafeHtml(html, evidence('금융위원회가 상생보험을 시작했다. 보장은 지역별로 다르다.'));
    expect(out2).toContain(url);
    expect(out2).not.toContain('300억원');
  });

  test('③ 지운 문장 뒤의 "다만 이 수치는…" 도 함께 빠진다 — 되풀이 삭제와 같은 눈', () => {
    const html = '<p>보증번호가 나온 뒤에는 기존 보증의 정리 여부를 먼저 확인하는 편이 안전합니다. 햇살론15 한도는 최대 2,000만원입니다. 다만 이 수치는 상품 안내의 범위이며 개인별 실행 금액을 약속하는 숫자는 아닙니다. 기존 거래가 있으면 잔액부터 대조합니다.</p>';
    const out = sanitizeFactUnsafeHtml(html, evidence('햇살론15 는 저신용자를 위한 정책서민금융이다. 보증번호 발급 뒤 금융회사 심사가 남는다.'));
    expect(out).not.toContain('2,000만원');
    expect(out).not.toContain('다만 이 수치는');
    expect(out).toContain('기존 거래가 있으면 잔액부터 대조합니다.');
    expect(startsWithBackReference('다만 이 수치는 상품 안내의 범위입니다.')).toBe(true);
    expect(startsWithBackReference('두 내용은 적용 대출 종류가 다릅니다.')).toBe(true);
    expect(startsWithBackReference('기존 거래가 있으면 잔액부터 대조합니다.')).toBe(false);
    // auto-repair 도 같은 규칙 파일을 쓴다
    expect(read('src/core/final/auto-repair.ts')).toContain("require('./refers-back').REFERS_BACK");
    const s = '금융위원회 보도자료는 개인사업자 갈아타기 대상을 은행권 운전자금 신용대출로 안내합니다.';
    const doc = `<p>${s} 그 뒤 문장은 다릅니다.</p><h2>2</h2><p>여기서는 새 이야기를 시작하는 첫 문장입니다. ${s} 두 내용은 적용 대출 종류가 다릅니다. 마지막 문장입니다.</p>`;
    expect(removeEchoedSentences(doc).count).toBe(0);
  });

  test('② 태그만 남은 교체본은 받지 않고, 답이 빈 답변 블록은 뺀다', () => {
    const html = '<p class="answer-first-a" style="x">제주와 충북은 공고 뒤 개별 신청입니다.</p><p>본문 문단입니다.</p>';
    const untouched = applyFactRepairs(html, [{ paragraphIndex: 0, html: '<p class="answer-first-a" style="x"></p>' } as any]);
    expect(untouched).toBe(html);
    const replaced = applyFactRepairs(html, [{ paragraphIndex: 1, html: '<p>고친 본문 문단입니다.</p>' } as any]);
    expect(replaced).toContain('고친 본문 문단입니다.');

    const good = buildAnswerBlock({ keyword: '소상공인 무료 상생보험', question: '경남 상생보험은 문자 안내를 기다려야 하나요', answer: '제주와 충북은 공고 뒤 개별 신청입니다. 경남 경북 광주 전남은 선별 뒤 SMS 안내입니다.', basis: '' });
    const emptied = good.replace(/(<p class="answer-first-a"[^>]*>)[\s\S]*?<\/p>/, '$1</p>');
    expect(emptied).toContain('answer-first-a');
    const r = restoreAnswerBlockQuestion(`<h1>t</h1>${emptied}<div class="content intro-section"><p>서론.</p></div>`, { question: '경남 상생보험은 문자 안내를 기다려야 하나요', keyword: '소상공인 무료 상생보험' });
    expect(r.changed).toBe(true);
    expect(r.removed).toBe(true);
    expect(r.html).not.toContain('answer-first');
    expect(r.html).toContain('<div class="content intro-section">');
    expect(restoreAnswerBlockQuestion(`<h1>t</h1>${good}`, { question: 'q', keyword: 'k' }).changed).toBe(false);
  });

  test('④ 약속 조각 검색어 — 흔한 낱말·용언 조각은 빼고, 약하면 예전 검색어로', async () => {
    expect(promiseQuery('내 지역이 대상인지', '소상공인 무료 상생보험 7개 지자체 개시')).toBe('');
    expect(promiseQuery('신청 경로가 갈리는 지점', '소상공인 무료 상생보험 7개 지자체 개시')).toBe('');
    expect(promiseQuery('대출 갈아타기 부결 사유', '대출 갈아타기가 부결됐을 때')).toBe('');
    expect(promiseQuery('재신청 방법', '대출 갈아타기가 부결됐을 때')).toBe('');
    expect(promiseQuery('정리매매로 가는 경우', '상장유지 시가총액 기준 6개월 유예')).toBe('정리매매');
    expect(promiseQuery('9·3 노동부 지침', '성과급 요구 파업이 불법으로 갈리는 선')).toBe('노동부 지침 9월 3일');
    expect(promiseQuery('9·4 서민금융 복합지원센터로 가도 보증심사는 따로다', '햇살론15가 거절되는 지점')).toBe('서민금융 복합지원센터 보증심사 9월 4일');

    const calls: string[] = [];
    const fake = async (q: string) => { calls.push(q); return { text: '[뉴스] 결과', newsCount: 1, webCount: 0, officialCount: 0, blogCount: 0, skippedBlogs: 0 } as any; };
    const r = await fetchPromiseGrounding('소상공인 무료 상생보험 7개 지자체 개시 — 내 지역이 대상인지와 신청 경로가 갈리는 지점', '소상공인 무료 상생보험 7개 지자체 개시', (async () => ({ ok: true, items: [] })) as any, fake);
    expect(calls).toEqual([
      '소상공인 무료 상생보험 7개 지자체 개시 내 지역이 대상인지',
      '소상공인 무료 상생보험 7개 지자체 개시 신청 경로가 갈리는 지점',
    ]);
    expect(r.blocks).toHaveLength(2);
  });

  test('⑤ 배선 — 에이전트 경로에 호출 0회 후처리, 답변 블록 제거 로그', () => {
    const agent = blockBetween(read('electron/main.ts'), 'v3.8.666 — 호출 0회짜리 후처리를 에이전트 글에도', '🩺 v3.8.630 — 에이전트 글도 발행 전에 자가 수정한다');
    expect(agent).toContain("require('../dist/core/final/table-cap')");
    expect(agent).toContain('removeEchoedSentences(polished)');
    expect(agent).toContain('autoRepairBeforePublish(polished)');
    expect(agent).toContain('result.content = polished');
    const o = read('src/core/final/orchestration.ts');
    expect(o).toContain('restored.removed');
    const fi = read('src/core/final/fact-integrity.ts');
    expect(fi).toContain('sanitizeFactUnsafeHtmlMasked(masked, evidence)');
    expect(fi).toContain("require('./refers-back')");
    expect(read('src/core/final/fact-guard.ts')).toContain('글자가 없으면 교체본이 아니다');
  });

  test('⑥ 리포트 주소의 역슬래시 이스케이프를 푼다 — `\\&` 그대로 부르면 400', () => {
    const { parseCpcReport } = require('../src/core/keywords/cpc-report');
    const report = parseCpcReport('# 슬롯 A - 시의성\n키워드: 테스트\n출처: https://leadernam.com/wp-json/wp/v2/posts?per_page=30\\&orderby=date\\&order=desc\n');
    expect(report.urls[0]).toBe('https://leadernam.com/wp-json/wp/v2/posts?per_page=30&orderby=date&order=desc');
  });
});
