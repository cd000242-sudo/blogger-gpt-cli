const fs = require('fs');
const path = require('path');

import { buildOfficialResearchPlan, OFFICIAL_QUESTIONS } from '../src/core/final/official-research-plan';
import { deriveSourceScope } from '../src/core/final/source-scope';
import { fetchGrounding } from '../src/core/final/naver-grounding';
import { assembleEvidence, renderEvidence } from '../src/core/final/evidence';
import { buildValidationEvidence } from '../src/core/final/validation-evidence';
import { sanitizeArticleFactClaims, inspectFactIntegrity, sanitizeFactUnsafeHtml } from '../src/core/final/fact-integrity';
import { buildAnswerBlock } from '../src/core/final/answer-block';
import { blockBetween } from './helpers/source-block';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const FX = JSON.parse(read('__tests__/fixtures/run-f607bc/filter-inputs.json'));
const KEYWORD = '청년미래적금 VS 청년 도약계좌';   // ACTUAL_RUN f607bc 의 실제 키워드
const TODAY = '2026-09-29';

/*
 * v3.8.758 — 기관 매핑이 없는 실제 키워드에서도 공식자료 조사 경로가 연결되는가.
 *   입력 키워드 → 비교 대상 식별 → 조사 계획 → (조건부) 검색 → 관련 공식 후보 → 본문 수집 → 근거 → 렌더.
 * 검색·본문은 MOCK 이다(저장된 f607bc 결과 꼴을 본뜬 합성 응답). 실제 최신 공고 확보를 뜻하지 않는다.
 */
const mkSearch = (results: Record<string, any[]>) => {
  const calls: Array<{ type: string; query: string }> = [];
  const fn = async (type: string, params: any) => { calls.push({ type, query: params.query }); return { ok: true, items: results[`${type}:${params.query}`] || results[type] || [] }; };
  return { fn, calls };
};
const news2nd = (n: number) => Array.from({ length: n }, (_, i) => ({ title: `청년미래적금 2차 가입 신청 기사 ${i + 1}`, description: '금융위원회는 청년미래적금 2차 모집을 받는다', link: `https://news.example.com/a/${i + 1}`, originallink: `https://news.example.com/a/${i + 1}`, pubDate: 'Mon, 28 Sep 2026 09:00:00 +0900' }));
// f607bc 실제 결과 꼴: 6월 출시 안내(회차 없음)만 웹문서에 있었다
const junePage = { title: '6월 22일 출시 청년미래적금, 가입절차·심사일정·갈아타기 방법 등 주요정보', description: '청년미래적금 출시 안내 가입절차 심사일정', link: 'https://www.fsc.go.kr/edu/news/87370' };
const currentPage = { title: '청년미래적금 2차 가입 신청 안내', description: '금융위원회 청년미래적금 2차 모집 가입 조건과 일정', link: 'https://www.fsc.go.kr/edu/news/99999' };   // MOCK — 실제 공고 아님
const fetchOk = async (url: string) => `${url} 본문 청년미래적금 가입 조건 심사 일정 갈아타기 순서 안내 `.repeat(15);

describe('v3.8.758 조사 계획 — 기관 매핑 유무·비교 유형별', () => {
  test('f607bc 실제 키워드: 기관 매핑 없음 → 대상별 공식 안내 검색어 2개(조건부 보강용)', () => {
    expect(deriveSourceScope(KEYWORD)).toBeUndefined();
    const plan = buildOfficialResearchPlan(KEYWORD);
    expect(plan).toMatchObject({ needsOfficial: true, comparison: true, subjects: ['청년미래적금', '청년 도약계좌'] });
    expect(plan.queries).toEqual(['청년미래적금 공식 안내 가입 조건', '청년 도약계좌 공식 안내 가입 조건']);
    expect(plan.questions).toEqual(OFFICIAL_QUESTIONS);
    expect(JSON.stringify(plan)).not.toMatch(/fsc\.go\.kr|87370|87726|만\s?원|%/);            // 도메인·공고 번호·금액 하드코딩 없음
  });
  test('기관 매핑이 있는 비교 → 계획은 비우고 기존 기관 재검색 슬롯이 맡는다', () => {
    const scope = deriveSourceScope('LH 든든전세 vs 행복주택 비교')!;
    const plan = buildOfficialResearchPlan('LH 든든전세 vs 행복주택 비교', scope);
    expect(plan.queries).toEqual([]);
    expect(plan.reason).toContain('LH');
  });
  test('서로 다른 기관의 대상 비교 → 단일 범위 없음, 대상별 계획은 남는다', () => {
    expect(deriveSourceScope('LH와 HUG 든든전세 비교')).toBeUndefined();
    const plan = buildOfficialResearchPlan('LH 든든전세 vs HUG 안심전세 비교');
    expect(plan.subjects).toEqual(['LH 든든전세', 'HUG 안심전세']);
    expect(plan.queries.length).toBe(2);
  });
  test('공식조사가 필요하지 않은 일반 비교 → 계획 없음(엉뚱한 기관 조사 강제 안 함)', () => {
    for (const k of ['아이폰 vs 갤럭시 카메라 비교', '제주 vs 부산 여행 비교', '대전 맛집 추천']) {
      const plan = buildOfficialResearchPlan(k);
      expect(plan.needsOfficial).toBe(false);
      expect(plan.queries).toEqual([]);
    }
  });
});

describe('v3.8.758 실제 키워드의 조사·수집 경로 (MOCK 검색·본문)', () => {
  test('보강 꺼짐(기본): 과거 안내만 있으면 "부족" 으로 기록하고 검색 수는 예전과 같다 — 정보 없음으로 승격하지 않음', async () => {
    const { fn, calls } = mkSearch({ news: news2nd(8), webkr: [junePage], blog: [] });
    const plan = buildOfficialResearchPlan(KEYWORD);
    const g = await fetchGrounding(KEYWORD, fn as any, { mainKeyword: KEYWORD, fetchBody: fetchOk, officialPlan: plan, officialBoost: { enabled: false, maxQueries: 1 } });
    expect(calls.map((c) => c.type)).toEqual(['news', 'webkr', 'blog']);                       // 기본 검색 3회 그대로
    const st = g.officialStatus!;
    expect(st.currentRound).toBe('2');
    expect(st.candidates[0]).toMatchObject({ url: junePage.link, round: null, status: 'body' });   // 6월 안내: 본문은 읽었지만 회차 미확인
    expect(st.sufficient).toBe(false);                                                                // → 현재 회차(2차) 공식 본문으로 치지 않는다
    expect(st.boost).toMatchObject({ enabled: false, wouldTrigger: true, triggered: false });
    expect(st.boost.reason).toContain('승인 전');
    // 6월 안내 본문은 예산 안에서 먼저 읽었다(스니펫만이 아니다) — 다만 현재 회차 문서가 아니라고 표시된다
    expect(g.fetchLog!.find((f) => f.url === junePage.link)!.reason).toBe('ok');
  });

  test('보강 켜짐(승인 시): 대상별 검색어 1회 → 현재 회차 공식 후보 → 본문 수집 → 근거 항목(hasBody) → 렌더에 전달', async () => {
    const { fn, calls } = mkSearch({ news: news2nd(8), webkr: [junePage], blog: [], 'webkr:청년미래적금 공식 안내 가입 조건': [currentPage] });
    const plan = buildOfficialResearchPlan(KEYWORD);
    const g = await fetchGrounding(KEYWORD, fn as any, { mainKeyword: KEYWORD, fetchBody: fetchOk, officialPlan: plan, officialBoost: { enabled: true, maxQueries: 1 } });
    expect(calls.map((c) => c.type)).toEqual(['news', 'webkr', 'blog', 'webkr']);              // +1 회(상한 1)
    expect(calls[3]!.query).toBe('청년미래적금 공식 안내 가입 조건');
    const st = g.officialStatus!;
    expect(st.boost).toMatchObject({ enabled: true, wouldTrigger: true, triggered: true, added: 1 });
    expect(st.candidates.find((c) => c.url === currentPage.link)).toMatchObject({ round: '2', status: 'body' });
    expect(st.sufficient).toBe(true);
    const body = g.fetchLog!.filter((f) => f.attempted).map((f) => f.url);
    expect(body[0]).toBe(currentPage.link);                                                    // 현재 회차 문서가 먼저
    expect(body.length).toBeLessThanOrEqual(6);                                                // 본문 예산 총량 불변
    // 근거 → 렌더까지: 항목이 본문 확보로 들어가고 Writer 렌더에 실린다
    const items = assembleEvidence((g.items || []).map((i) => ({ ...i, mainKeyword: KEYWORD })), TODAY);
    const official = items.find((i) => i.url === currentPage.link)!;
    expect(official.hasBody).toBe(true);
    expect(official.cleanedText.length).toBeGreaterThan(900);
    const r = renderEvidence(items, 11000);
    expect(r.selection.find((s) => s.id === official.id)!.delivered).toBe(true);
    expect(buildValidationEvidence(items, { context: '', provider: 'Naver Grounding', trustLevel: 'weak' }).docs.some((d) => d.url === currentPage.link)).toBe(true);
  });

  test('보강 검색 결과의 관련 없는 공식 페이지·비공식 페이지는 후보가 되지 않는다', async () => {
    const { fn } = mkSearch({ news: news2nd(8), webkr: [junePage], blog: [], 'webkr:청년미래적금 공식 안내 가입 조건': [
      { title: '어린이집 보육료 안내', description: '보육 지원', link: 'https://www.mohw.go.kr/x' },
      { title: '청년미래적금 2차 총정리 블로그', description: '청년미래적금 2차 조건', link: 'https://blog.naver.com/x/1' },
    ] });
    const g = await fetchGrounding(KEYWORD, fn as any, { mainKeyword: KEYWORD, fetchBody: fetchOk, officialPlan: buildOfficialResearchPlan(KEYWORD), officialBoost: { enabled: true, maxQueries: 1 } });
    expect(g.officialStatus!.boost).toMatchObject({ triggered: true, added: 0 });
    expect(g.officialStatus!.boost.reason).toContain('공식 후보 없음');
    expect(g.officialStatus!.sufficient).toBe(false);
  });

  test('본문 접근 실패는 "접근 실패" 로 남고 확인 성공·정보 없음 어느 쪽도 아니다', async () => {
    const { fn } = mkSearch({ news: news2nd(8), webkr: [{ ...currentPage, link: 'https://www.fsc.go.kr/fail/2' }], blog: [] });
    const g = await fetchGrounding(KEYWORD, fn as any, { mainKeyword: KEYWORD, fetchBody: async (u: string) => (u.includes('fail') ? null : fetchOk(u)), officialPlan: buildOfficialResearchPlan(KEYWORD), officialBoost: { enabled: false } });
    expect(g.officialStatus!.candidates[0]).toMatchObject({ round: '2', status: 'fetch-failed' });
    expect(g.officialStatus!.sufficient).toBe(false);
  });

  test('보강은 최대 1회 · 계획이 없으면(일반 비교) 아무 검색도 늘지 않는다', async () => {
    const phoneNews = Array.from({ length: 6 }, (_, i) => ({ title: `아이폰 갤럭시 카메라 비교 리뷰 ${i + 1}`, description: '아이폰과 갤럭시 카메라 비교', link: `https://news.example.com/p/${i + 1}`, originallink: `https://news.example.com/p/${i + 1}`, pubDate: 'Mon, 28 Sep 2026 09:00:00 +0900' }));
    const { fn, calls } = mkSearch({ news: phoneNews, webkr: [], blog: [] });
    await fetchGrounding('아이폰 vs 갤럭시 카메라 비교', fn as any, { mainKeyword: '아이폰 vs 갤럭시 카메라 비교', fetchBody: fetchOk, officialPlan: buildOfficialResearchPlan('아이폰 vs 갤럭시 카메라 비교'), officialBoost: { enabled: true, maxQueries: 1 } });
    expect(calls.length).toBe(3);                                                              // 기본 3회 — 계획이 비어 보강 없음(뉴스가 있으면 기존 기관 검색도 없음)
  });
});

describe('v3.8.758 배선·회귀·의미 보존', () => {
  test('orchestration 은 계획을 만들어 grounding 에 넘기고, 보강은 OFFICIAL_BOOST 로만 켜진다', () => {
    const orch = read('src/core/final/orchestration.ts');
    expect(orch).toContain("require('./official-research-plan')");
    expect(orch).toContain("process.env['OFFICIAL_BOOST'] === '1'");
    expect(orch).toContain('officialPlan, officialBoost });');
    expect(orch).toContain("trace.event('grounding.official-plan'");
    expect(orch).toContain('핵심 공식자료 부족');
    expect(read('src/core/final/naver-grounding.ts')).toContain('const BODY_FETCH_MAX = 6;');
  });

  test('f607bc 017: 차액·출처·정상 값 보존 회귀 + 본문·표·답 상자 의미 보존', () => {
    const items = FX.stage2Items;
    const view = buildValidationEvidence(items, { context: '', provider: 'Naver Grounding', trustLevel: 'weak', topic: KEYWORD }, { deliveredIds: new Set(FX.renderUsedIds) });
    const cleaned = sanitizeArticleFactClaims(FX.draft017, view.evidence);
    const body = [String(cleaned.introduction), ...cleaned.sections.flatMap((s: any) => s.h3Sections.map((h: any) => h.content))].join('\n');
    for (const s of ['월 한도는 20만 원 차이', '총급여 3600만 원과 기준 중위소득 150% 이하', '연매출 1억 원 이하 소상공인, 기준 중위소득 150% 이하', '정부 기여금과 비과세 혜택이 유지', '해지환급금을 청년미래적금에 일시납입하는 방식은 허용되지 않습니다', '총급여 6000만 원 초과 7500만 원 이하인 경우에도 가입 요건을 충족하면 가입할 수 있습니다']) expect(body).toContain(s);
    expect(body).not.toContain('10월 9일부터 16일까지는');
    // 표 칸은 그대로(비우지 않음)
    const table = cleaned.sections[1].h3Sections[0].content;
    expect(table).toContain('<td>총급여 3600만 원 이하 또는 종합소득 2600만 원 이하 중소기업 재직자, 연매출 1억 원 이하 소상공인, 기준 중위소득 150% 이하</td>');
    // 요약표·답 상자(저장 산출물)는 본문과 모순되지 않는다 — 답 상자의 절차 문장이 본문 3절과 같다
    const rows = FX.summary019.rows.map((row: string[]) => row.map((v, ci) => (ci ? sanitizeFactUnsafeHtml(v, { ...view.evidence, subjectHint: String(row[0]) }) : v)));
    expect(rows).toEqual(FX.summary019.rows);
    const answerHtml = buildAnswerBlock({ keyword: KEYWORD, question: '청년도약계좌에서 청년미래적금으로 갈아탈까', answer: '갈아타려면 가입 심사를 통과해 계좌를 먼저 개설한 뒤 기존 계좌를 특별중도해지해야 합니다.', basis: '금융위원회 · 2026-09-29 기준' });
    expect(answerHtml).toContain('특별중도해지');
    expect(body).toContain('청년미래적금 가입 심사를 통과하고 계좌를 먼저 개설해야 합니다');
    // 출처 ID·12퍼센트 회귀
    expect(inspectFactIntegrity('<p>우대형 기여금은 납입액의 12퍼센트입니다.</p>', view.evidence).status).toBe('passed');
    expect(blockBetween(read('src/core/final/orchestration.ts'), 'const judgeCrawledPosts = (): void => {', 'judgeCrawledPosts();')).toContain('bridgeCrawledPost(post, keyword)');
  });
});
