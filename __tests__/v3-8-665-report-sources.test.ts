const fs = require('fs');
const path = require('path');

import { topicWords, fetchReportSourceBodies, buildReportSourcesBlock } from '../src/core/final/report-sources';
import { promiseQuery } from '../src/core/final/reader-retention';
import { fetchPromiseGrounding, promiseChunks } from '../src/core/final/promise-grounding';
import { repairRelativeYear, repairGluedNumbers, removeEchoedSentences, autoRepairBeforePublish } from '../src/core/final/auto-repair';
import { acceptRevisedSection } from '../src/core/final/post-critique';
import { DEPTH_VOICE_RULES } from '../src/core/final/depth-voice';
import { blockBetween } from './helpers/source-block';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

const TITLE = '햇살론15가 거절되는 지점 - 9·4 서민금융 복합지원센터로 가도 보증심사는 따로다';
const KEYWORD = '햇살론15가 거절되는 지점';
const noSearch = (async () => ({ ok: true, items: [] })) as any;

/*
 * v3.8.665 — 근거 쪽 지렛대 + 여덟 번째 읽기(664: 78 · 86 · 84 · 100 · 100)의 잔여.
 *  ① 리포트 출처 본문을 근거 맨 앞에 — 지금까지 주소만 글자로 실렸다
 *  ② 약속 조각 검색어를 낱말 셋으로 — 통째로 검색하니 뉴스 0건
 *  ③ 두 경로(API·에이전트)가 같은 함수를 쓴다
 *  ④ "다음 해 7월" → 연도, "200억원과300억원" → 공백
 *  ⑤ 다시 쓴 구간이 띄어쓰기를 뭉개면 원본 유지
 *  ⑥ 되풀이 삭제가 "이 안내에서…" 의 앞 문장을 지우지 않는다
 *  ⑦ 규칙 — 제목이 부른 것은 곁가지가 아니다 · 긴 고유명사는 줄여 · 연도는 절대 연도
 */
describe('v3.8.665 리포트 출처 본문 · 약속 검색어 · 여덟 번째 읽기의 잔여', () => {
  test('① 리포트 출처 본문 — 제목·키워드 낱말이 둘 이상 든 페이지만, 관련도 순', async () => {
    const pages: Record<string, string | null> = {
      'https://news.example.com/a': '서민금융진흥원은 9월 4일 강원 춘천에 서민금융 복합지원센터를 열었다. 햇살론15 등 정책서민금융과 채무조정, 복지 연계를 한 곳에서 상담한다. ' + '상담은 무료다. '.repeat(20),
      'https://news.example.com/b': '삼성전자 임직원 주거안정 대출은 최대 5억원, 연 1.5% 이율이다. 사내 복지 제도가 확대된다. ' + '복지 확대. '.repeat(25),
      'https://news.example.com/c': null,
      'ftp://nope': 'x',
    };
    const fetchBody = async (u: string) => pages[u] ?? null;
    const r = await fetchReportSourceBodies(Object.keys(pages), { keyword: KEYWORD, title: TITLE }, fetchBody);
    expect(r.used.map((b) => b.url)).toEqual(['https://news.example.com/a']);
    expect(r.skipped).toBe(1);
    expect(r.failed).toBe(1);
    const block = buildReportSourcesBlock(r);
    expect(block).toContain('[리포트 출처 원문');
    expect(block).toContain('복합지원센터를 열었다');
    expect(block).not.toContain('삼성전자');
    expect(buildReportSourcesBlock({ used: [], skipped: 0, failed: 0 })).toBe('');
    expect(topicWords(KEYWORD, '9·4 서민금융 복합지원센터')).toEqual(expect.arrayContaining(['햇살론15', '서민금융', '복합지원센터']));
    // 주소가 없으면 아무것도 안 한다
    expect((await fetchReportSourceBodies([], { keyword: KEYWORD, title: TITLE }, fetchBody)).used).toHaveLength(0);
  });

  test('② 약속 조각 검색어 — 긴 낱말 셋과 날짜', () => {
    const q = promiseQuery('9·4 서민금융 복합지원센터로 가도 보증심사는 따로다', KEYWORD);
    expect(q).toContain('복합지원센터');
    expect(q).toContain('서민금융');
    expect(q).toContain('보증심사');
    expect(q).toContain('9월 4일');
    expect(q).not.toContain('가도');
    expect(q).not.toContain('따로다');
    const q2 = promiseQuery('내 종목이 코넥스 이전 대상인지', '상장유지 시가총액 기준 6개월 유예');
    expect(q2).toContain('코넥스');
    expect(q2).not.toContain('대상인지');
    expect(promiseChunks(TITLE, KEYWORD)).toEqual(['9·4 서민금융 복합지원센터로 가도 보증심사는 따로다']);
  });

  test('③ 약속 근거 — 낱말 검색어로 먼저, 뉴스·기관 0건이면 예전 검색어로 한 번 더', async () => {
    const calls: string[] = [];
    const fake = async (q: string) => {
      calls.push(q);
      const hit = q.includes('복합지원센터') && !q.includes('햇살론15');
      return { text: hit ? '[뉴스] 9월 4일 복합지원센터 개소 …' : '', newsCount: hit ? 1 : 0, webCount: 0, officialCount: 0, blogCount: 0, skippedBlogs: 0 } as any;
    };
    const r = await fetchPromiseGrounding(TITLE, KEYWORD, noSearch, fake);
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0]).toContain('[제목 약속 근거: 9·4 서민금융 복합지원센터로 가도 보증심사는 따로다]');
    expect(r.chunks[0]!.query).toBe('서민금융 복합지원센터 보증심사 9월 4일');
    expect(calls).toHaveLength(1);

    const calls2: string[] = [];
    const fake2 = async (q: string) => {
      calls2.push(q);
      const legacy = q.startsWith(`${KEYWORD} `);
      return { text: legacy ? '[웹] 예전 검색 결과' : '', newsCount: 0, webCount: legacy ? 1 : 0, officialCount: 0, blogCount: 0, skippedBlogs: 0 } as any;
    };
    const r2 = await fetchPromiseGrounding(TITLE, KEYWORD, noSearch, fake2);
    expect(calls2).toHaveLength(2);
    expect(r2.blocks[0]).toContain('예전 검색 결과');
    expect(r2.chunks[0]!.query).toBe(`${KEYWORD} 9·4 서민금융 복합지원센터로 가도 보증심사는 따로다`);
  });

  test('④ 상대 시점 → 연도, 단위 붙은 숫자 앞 띄어쓰기', () => {
    const now = new Date(2026, 8, 6);
    const y = repairRelativeYear('<p>코스닥 기준 적용은 다음 해 7월로 늦춰졌습니다. 올해 9월 기준이고 작년 12월과 다릅니다. 다음 해에 다시 봅니다.</p>', now);
    expect(y.count).toBe(3);
    expect(y.html).toContain('2027년 7월');
    expect(y.html).toContain('2026년 9월');
    expect(y.html).toContain('2025년 12월');
    expect(y.html).toContain('다음 해에 다시');

    const g = repairGluedNumbers('<p>200억원과300억원 또는300억원과500억원만으로는 최근3개년도 중2개년도 영업이익이1년 흑자면 제2회 코스피200 지수</p>');
    expect(g.html).toContain('200억원과 300억원 또는 300억원과 500억원만으로는');
    expect(g.html).toContain('최근 3개년도 중 2개년도');
    expect(g.html).toContain('영업이익이 1년');
    expect(g.html).toContain('제2회');
    expect(g.html).toContain('코스피200');
    expect(g.count).toBe(6);
    expect(repairGluedNumbers('<p style="margin:0 0 10px">기준 300억원</p>').html).toBe('<p style="margin:0 0 10px">기준 300억원</p>');

    const all = autoRepairBeforePublish('<h1>t</h1><p>' + '적용은 다음 해 7월입니다. 기준은 200억원과300억원입니다. '.repeat(12) + '</p>');
    expect(all.repairs.map((r) => r.kind)).toEqual(expect.arrayContaining(['relative-year', 'glued-number']));
  });

  test('⑤ 다시 쓴 구간이 숫자 앞 띄어쓰기를 뭉개면 원본 유지', () => {
    const body = '코스닥은 200억원과 300억원 사이를 봅니다. 최근 3개년도 중 2개년도 영업이익이 1년 흑자면 대상입니다. '.repeat(3);
    const original = { index: 2, heading: '2. 기준', html: `<h2>2. 기준</h2><p>${body}</p>` };
    const glued = original.html.replace(/([가-힣]) (\d)/g, '$1$2') + '<p>덧붙인 문장이라 분량은 줄지 않았습니다.</p>';
    const v = acceptRevisedSection(glued, original);
    expect(v.accepted).toBe(false);
    expect(v.reason).toContain('띄어쓰기');
    expect(acceptRevisedSection(original.html.replace('대상입니다', '검토 대상입니다'), original).accepted).toBe(true);
  });

  test('⑥ 되풀이 삭제 — 다음 문장이 "이 안내에서" 처럼 앞을 가리키면 지우지 않는다', () => {
    const s = '금융위원회 보도자료는 개인사업자 갈아타기 대상을 은행권 운전자금 신용대출로 안내합니다.';
    const lead = '여기서는 새 이야기를 시작하는 첫 문장입니다.';
    const html = `<p>${s} 그 뒤 문장은 다릅니다.</p><h2>2</h2><p>${lead} ${s} 이 안내에서 읽을 점은 비교 화면과 실행 창구가 나뉜다는 사실입니다. 마지막 문장입니다.</p>`;
    const r = removeEchoedSentences(html);
    expect(r.count).toBe(0);
    expect(r.html).toContain(`${s} 이 안내에서`);
    const html2 = `<p>${s} 그 뒤 문장은 다릅니다.</p><h2>2</h2><p>${lead} ${s} 비교 화면과 실행 창구는 나뉩니다. 마지막 문장입니다.</p>`;
    expect(removeEchoedSentences(html2).count).toBe(1);
  });

  test('⑦ 규칙 — 제목이 부른 것은 곁가지가 아니다 · 긴 고유명사는 줄여 · 연도는 절대 연도', () => {
    expect(DEPTH_VOICE_RULES).toContain('제목이 부른 것은 곁가지가 아닙니다');
    expect(DEPTH_VOICE_RULES).toContain('줄여 부릅니다');
    expect(DEPTH_VOICE_RULES).toContain('절대 연도');
    const g = read('src/core/final/generation.ts');
    // "아니다"(1120행) 와 "아닙니다"(1328행) — 두 소제목 프롬프트 모두
    expect((g.match(/제목이 부른 주제는 곁가지가 아/g) || []).length).toBe(2);
    expect(g).not.toContain('햇살론 글에 "강원 센터"');
  });

  test('배선 — API 경로와 에이전트 경로 둘 다', () => {
    const o = read('src/core/final/orchestration.ts');
    expect(o).toContain("require('./promise-grounding')");
    expect(o).toContain("require('./report-sources')");
    expect(o).toContain('fetchReportSourceBodies(reportUrls');
    const agent = blockBetween(read('electron/main.ts'), 'v3.8.583 — 에이전트에게도', '[AGENT-GROUNDING] 준비 스킵');
    expect(agent).toContain("require('../dist/core/final/promise-grounding')");
    expect(agent).toContain("require('../dist/core/final/report-sources')");
    expect(agent).toContain('agentEvidenceBlock: agentEvidence');
    expect(agent).not.toContain('agentEvidenceBlock: g.text');
    const repair = read('src/core/final/auto-repair.ts');
    expect(repair).toContain("kind: 'relative-year'");
    expect(repair).toContain("kind: 'glued-number'");
    expect(read('src/core/final/post-critique.ts')).toContain('숫자 앞 띄어쓰기가 뭉개졌습니다');
  });
});
