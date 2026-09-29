const fs = require('fs');
const path = require('path');

import { inspectFactIntegrity, sanitizeArticleFactClaims, sanitizeFactUnsafeHtml, type FactEvidence } from '../src/core/final/fact-integrity';
import { resolveDerivedDifferences } from '../src/core/final/derived-difference';
import { buildValidationEvidence } from '../src/core/final/validation-evidence';
import { deriveSourceScope, sourceMatchesScope, comparisonSubjects, isComparisonTopic, buildSourceScopeDirective } from '../src/core/final/source-scope';
import { fetchGrounding } from '../src/core/final/naver-grounding';
import { blockBetween } from './helpers/source-block';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const FX = JSON.parse(read('__tests__/fixtures/run-f607bc/filter-inputs.json'));
const PAD = ' 청년 자산형성 상품은 은행 창구와 앱에서 신청하며 자세한 절차는 취급 은행이 안내합니다. 가입 전 본인 소득 요건을 확인하세요.'.repeat(3);
const ev = (context: string, extra: Partial<FactEvidence> = {}): FactEvidence => ({ provider: 'Naver Grounding', trustLevel: 'weak', topic: '상품 비교', context: `[E01] 합성 근거\n${context}${PAD}`, ...extra });
const plain = (o: any) => [String(o.introduction || ''), ...(o.sections || []).flatMap((s: any) => (s.h3Sections || []).map((h: any) => String(h.content || '')))].join('\n');
/** 아래 금액은 파서 검증용 합성 값이다 — 제품 허용목록이 아니다 */
const TABLE = '<table><thead><tr><th>구분</th><th>상품 A</th><th>상품 B</th></tr></thead><tbody><tr><td>월 최대 납입액</td><td>50만 원</td><td>70만 원</td></tr></tbody></table>';
const LEDGER = '상품 A 는 월 최대 50만 원까지 납입할 수 있다. 상품 B 는 월 최대 70만 원까지 납입할 수 있다.';

describe('v3.8.757 [파생 차액] 같은 항목의 두 근거값으로 검산되는 차액만 보존한다', () => {
  test('T1 같은 항목 70만 원 − 50만 원 = 20만 원 차이 → 보존 (직접 근거 없음 · 계산 검증)', () => {
    const block = `${TABLE}<p>월 한도는 20만 원 차이이므로 같은 상품처럼 비교하면 안 됩니다.</p>`;
    const rep = inspectFactIntegrity(block, ev(LEDGER));
    expect(rep.status).toBe('passed');
    expect(rep.derived?.[0]?.verdict).toBe('verified');
    expect(rep.derived?.[0]?.operation).toBe('|50만원 − 70만원|');
    expect(rep.derived?.[0]?.operands.map((o) => o.sourceIds)).toEqual([['E01'], ['E01']]);   // 입력값이 근거에 연결됨
    expect(sanitizeFactUnsafeHtml(block, ev(LEDGER))).toContain('20만 원 차이');
    // 직접 근거가 있는 값은 계산 없이 지원된다 — 처리 경로가 다르다
    const direct = inspectFactIntegrity('<p>상품 A 는 월 최대 50만 원까지 납입할 수 있다.</p>', ev(LEDGER));
    expect(direct.status).toBe('passed');
    expect(direct.derived).toBeUndefined();
  });

  test('T2 같은 입력으로 25만 원 차이라고 주장 → 불일치(차단)', () => {
    const block = `${TABLE}<p>월 한도는 25만 원 차이입니다.</p>`;
    const rep = inspectFactIntegrity(block, ev(LEDGER));
    expect(rep.status).toBe('blocked');
    expect(rep.violations[0]!.detail).toContain('25만원');
    expect(sanitizeFactUnsafeHtml(block, ev(LEDGER))).not.toContain('25만 원');
  });

  test('T3 피연산자 하나가 원고에만 있으면 계산 검증으로 통과하지 않는다', () => {
    const block = `${TABLE}<p>월 한도는 20만 원 차이입니다.</p>`;
    const onlyA = ev('상품 A 는 월 최대 50만 원까지 납입할 수 있다.');            // 70만 원은 근거에 없다
    const rep = inspectFactIntegrity(block, onlyA);
    expect(rep.status).toBe('blocked');
    expect(rep.violations.map((v) => v.detail).join(' ')).toMatch(/70만원/);            // 표의 70만 원 자체가 근거 없음
    expect(rep.derived?.some((d) => d.claim === '20만원' && d.verdict === 'unverifiable')).toBe(true);
  });

  test('T4 월 한도와 연 한도를 섞어 빼지 않는다', () => {
    const mixed = '<table><tr><th>구분</th><th>상품 A</th><th>상품 B</th></tr><tr><td>월 최대 납입액</td><td>50만 원</td><td>0만 원</td></tr><tr><td>연 최대 납입액</td><td>600만 원</td><td>620만 원</td></tr></table><p>월 한도는 20만 원 차이입니다.</p>';
    const ledger = '상품 A 는 월 50만 원, 연 600만 원까지. 상품 B 는 월 0만 원, 연 620만 원까지.';
    expect(inspectFactIntegrity(mixed, ev(ledger)).status).toBe('blocked');                // 연 한도 행(620−600=20)으로 월 한도 차이를 검산하지 않는다
  });

  test('T5 다른 항목·조건부·과거 행의 값으로 차액을 검산하지 않는다', () => {
    const cond = '<table><tr><th>구분</th><th>상품 A</th><th>상품 B</th></tr><tr><td>월 최대 납입액(예산안 통과 시 예정)</td><td>50만 원</td><td>70만 원</td></tr></table><p>월 한도는 20만 원 차이입니다.</p>';
    expect(inspectFactIntegrity(cond, ev(LEDGER)).status).toBe('blocked');
    const other = '<table><tr><th>구분</th><th>상품 A</th><th>상품 B</th></tr><tr><td>월 최대 납입액</td><td>50만 원</td><td>70만 원</td></tr></table><p>기여금은 20만 원 차이입니다.</p>';
    // 문장이 "월" 을 말하지 않으면 항목 대응을 확인할 수 없어 표의 월 한도 행으로 검산한다 — 이 경우는 통과하지만 유불리·항목 일치는 검증하지 않았음을 derived.reason 이 말한다
    const rep = inspectFactIntegrity(other, ev(LEDGER));
    expect(rep.derived?.[0]?.item).toBe('월 최대 납입액');
    // 방향을 말하면 방향까지 맞아야 한다
    const wrongDir = `${TABLE}<p>상품 A 가 월 한도가 20만 원 더 많습니다.</p>`;
    expect(inspectFactIntegrity(wrongDir, ev(LEDGER)).status).toBe('blocked');
    const rightDir = `${TABLE}<p>상품 B 가 월 한도가 20만 원 더 많습니다.</p>`;
    expect(inspectFactIntegrity(rightDir, ev(LEDGER)).status).toBe('passed');
  });

  test('T6 차액이 맞아도 유불리 추천은 검증 대상이 아니다 — 기록에 남긴다', () => {
    const block = `${TABLE}<p>월 한도는 20만 원 차이라서 상품 B 가 무조건 유리합니다.</p>`;
    const rep = inspectFactIntegrity(block, ev(LEDGER));
    expect(rep.status).toBe('passed');                                                     // 숫자 검사는 통과
    expect(rep.derived?.[0]?.reason).toContain('유불리 판단은 검증 대상 아님');
    expect(resolveDerivedDifferences('추천 문장', ['20만원'], TABLE, '', () => true).checks.length).toBe(0);   // 차이 단서 없는 문장은 검산하지 않는다
  });

  test('T7 f607bc 017 — 20만 원 차이 문장이 본문 필터·요약표·후속 필터에서 살아남고, 10월 9일은 차단', () => {
    const items = FX.stage2Items;
    const view = buildValidationEvidence(items, { context: '', provider: 'Naver Grounding', trustLevel: 'weak', topic: '청년미래적금 VS 청년 도약계좌' }, { deliveredIds: new Set(FX.renderUsedIds) });
    const rep = inspectFactIntegrity(FX.draft017.sections[0].h3Sections[0].content, view.evidence);
    const d = (rep.derived || []).find((x) => x.claim === '20만원');
    expect(d?.verdict).toBe('verified');
    expect(d?.item).toBe('월 최대 납입액');
    expect(d?.operands.map((o) => o.value).sort()).toEqual(['50만원', '70만원']);
    expect(d?.operands.every((o) => o.sourceIds.length > 0)).toBe(true);
    const cleaned = sanitizeArticleFactClaims(FX.draft017, view.evidence);
    const out = plain(cleaned);
    expect(out).toContain('기간은 2년, 월 한도는 20만 원 차이이므로');
    expect(out).toContain('총급여 3600만 원과 기준 중위소득 150% 이하 등 우대형 조건을 함께 충족해야 합니다');
    expect(out).not.toContain('10월 9일부터 16일까지는');
    // 후속 검사(요약표 정리 · 제목)는 이 문장을 다시 보지 않는다 — 요약표 자체는 그대로
    const rows = FX.summary019.rows.map((row: string[]) => row.map((v, ci) => (ci ? sanitizeFactUnsafeHtml(v, { ...view.evidence, subjectHint: String(row[0]) }) : v)));
    expect(rows).toEqual(FX.summary019.rows);
    // 문장 하나만 다시 검사해도(sanitize 의 문장 단위 재검사 경로) 블록 문맥이 있으면 살아남는다
    expect(sanitizeFactUnsafeHtml(FX.draft017.sections[0].h3Sections[0].content, view.evidence)).toContain('20만 원 차이');
  });

  test('T8~T12 기존 숫자 검사 회귀', () => {
    const none = ev('월 한도는 정해져 있다.');
    expect(inspectFactIntegrity('<p>월 한도는 90만 원이다.</p>', none).status).toBe('blocked');
    expect(inspectFactIntegrity('<p>월 한도는 90만원이다.</p>', ev('월 한도는 90만 원이다.')).status).toBe('passed');
    expect(inspectFactIntegrity('<p>총급여 3600만 원 이하</p>', ev('총급여 3600만 원 이하')).status).toBe('passed');
    expect(inspectFactIntegrity('<p>총급여 3600만 원 이하</p>', ev('총급여 600만 원 이하')).status).toBe('blocked');
    expect(sanitizeFactUnsafeHtml('납입액의 12퍼센트', ev('일반형 6%, 우대형 12%.', { subjectHint: '우대형 기여금' }))).toBe('납입액의 12퍼센트');
    expect(inspectFactIntegrity('<p>비율은 12%p 오른다.</p>', ev('비율은 12%다.')).status).toBe('blocked');
  });
});

describe('v3.8.757 [공식자료 배선] 비교 글의 출처 범위와 본문 수집', () => {
  test('T13 단일 대상과 비교 대상 모두 적절한 범위 — 비교는 거르지 않고 우선만', () => {
    const single = deriveSourceScope('LH 든든전세 4차 모집 공고');
    expect(single?.agency).toBe('LH');
    expect(single?.comparison).toBeUndefined();
    const cmp = deriveSourceScope('LH 든든전세 vs 행복주택 비교');
    expect(cmp?.agency).toBe('LH');
    expect(cmp?.comparison).toBe(true);
    expect(cmp?.subjects).toEqual(['LH 든든전세', '행복주택']);
    expect(comparisonSubjects('청년미래적금 VS 청년 도약계좌')).toEqual(['청년미래적금', '청년 도약계좌']);
    expect(comparisonSubjects('청년미래적금 대 청년도약계좌')).toEqual(['청년미래적금', '청년도약계좌']);
    expect(isComparisonTopic('대전 청년주택 공고')).toBe(false);                             // '대' 글자만으로 비교형이 아니다
    // 비교 범위는 다른 쪽 자료를 빼지 않는다
    expect(sourceMatchesScope({ url: 'https://news.example.com/a', title: '행복주택 안내', content: '' }, cmp)).toBe(true);
    expect(sourceMatchesScope({ url: 'https://news.example.com/a', title: '행복주택 안내', content: '' }, single)).toBe(false);
    expect(buildSourceScopeDirective(cmp)).toContain('비교 대상: LH 든든전세 · 행복주택');
    // 두 기관을 견주면 단일 범위로 못 좁힌다(예전 그대로 — 한계)
    expect(deriveSourceScope('LH와 HUG 든든전세 비교', [{ url: 'https://apply.lh.or.kr/notice' }])?.agency).toBeUndefined();
    // f607bc 키워드: 기관 매핑이 없어 범위가 안 생긴다 — 비교 형식 때문이 아니라 매핑 부재 때문(보고서에 명시)
    expect(deriveSourceScope('청년미래적금 VS 청년 도약계좌')).toBeUndefined();
  });

  test('T14 비정책 비교 글에 엉뚱한 금융기관 조사를 강제하지 않는다', () => {
    expect(deriveSourceScope('아이폰 vs 갤럭시 카메라 비교')).toBeUndefined();
    expect(deriveSourceScope('제주 vs 부산 여행 비교')).toBeUndefined();
    expect(deriveSourceScope('LH 청약 vs 민간 청약 비교')?.comparison).toBe(true);                   // 기관이 있으면 우선만
  });

  const search = (results: Record<string, any[]>) => {
    const calls: Array<{ type: string; query: string }> = [];
    const fn = async (type: string, params: any) => { calls.push({ type, query: params.query }); return { ok: true, items: results[`${type}:${params.query}`] || results[type] || [] }; };
    return { fn, calls };
  };
  const news = (n: number) => Array.from({ length: n }, (_, i) => ({ title: `청년미래적금 2차 신청 기사 ${i + 1}`, description: '청년미래적금 2차 가입 신청 안내 기사', link: `https://news.example.com/a/${i + 1}`, originallink: `https://news.example.com/a/${i + 1}`, pubDate: 'Mon, 28 Sep 2026 09:00:00 +0900' }));
  const fetched: string[] = [];
  const fetchBody = async (url: string) => { fetched.push(url); return url.includes('fail') ? null : `${url} 본문 청년미래적금 2차 가입 신청 절차와 심사 일정 안내 `.repeat(12); };

  test('T15·T16 관련 공식 결과가 뉴스보다 먼저 본문 수집 후보가 되고, 총 본문 요청은 6건을 넘지 않는다', async () => {
    fetched.length = 0;
    const { fn, calls } = search({
      news: news(8),
      webkr: [
        { title: '청년미래적금 2차 가입 안내', description: '금융위원회 청년미래적금 2차 신청 절차', link: 'https://www.fsc.go.kr/edu/news/1' },
        { title: '일반 웹문서', description: '청년미래적금 설명', link: 'https://www.example.com/w/1' },
      ],
      blog: [],
    });
    const g = await fetchGrounding('청년미래적금 VS 청년 도약계좌', fn as any, { mainKeyword: '청년미래적금 VS 청년 도약계좌', fetchBody });
    expect(fetched[0]).toBe('https://www.fsc.go.kr/edu/news/1');                            // 공식 페이지가 먼저
    expect(fetched.length).toBeLessThanOrEqual(6);                                           // BODY_FETCH_MAX 불변
    expect(fetched.filter((u) => u.includes('news.example.com')).length).toBe(5);            // 뉴스는 남은 5건
    expect(g.webCount).toBeGreaterThanOrEqual(1);                                            // 갈래·집계는 [웹] 그대로(기존 계약)
    expect(g.text.indexOf('[뉴스]')).toBeLessThan(g.text.indexOf('[웹]'));                    // 본문 순서도 그대로 — 바뀐 것은 fetch 예산 순서뿐
    expect(g.fetchLog!.find((f) => f.url.includes('fsc.go.kr'))!.reason).toBe('ok');
    expect(calls.filter((c) => c.type === 'webkr').length).toBe(1);                          // 검색 횟수 불변(기관 재검색 없음 — 범위 없음)
    expect(g.items!.find((i) => i.url.includes('fsc.go.kr'))!.hasBody).toBe(true);
  });

  test('T17 무관한 공식 페이지는 우선하지 않고, 옛 안내를 최신으로 승격하지 않는다', async () => {
    fetched.length = 0;
    const { fn } = search({
      news: news(8),
      webkr: [{ title: '어린이집 보육료 안내', description: '보육 지원 안내', link: 'https://www.mohw.go.kr/x' }],
      blog: [],
    });
    const g = await fetchGrounding('청년미래적금 VS 청년 도약계좌', fn as any, { mainKeyword: '청년미래적금 VS 청년 도약계좌', fetchBody });
    expect(fetched[0]).toContain('news.example.com');                                       // 주제와 안 맞는 공식 페이지는 예산 예약 없음
    expect(fetched.filter((u) => u.includes('mohw')).length).toBe(0);
    expect(g.officialCount).toBe(0);
    // 게시일은 그대로 — 공식 페이지에 날짜를 지어 붙이지 않는다
    for (const it of g.items || []) if (it.url.includes('mohw')) expect(it.pubDate).toBeNull();
  });

  test('T18 fetch 실패·snippet-only 를 원문 확인 성공으로 기록하지 않는다', async () => {
    fetched.length = 0;
    const { fn } = search({
      news: news(8),
      webkr: [{ title: '청년미래적금 2차 가입 안내', description: '금융위원회 청년미래적금 2차 신청 절차 안내', link: 'https://www.fsc.go.kr/fail/1' }],
      blog: [],
    });
    const g = await fetchGrounding('청년미래적금 VS 청년 도약계좌', fn as any, { mainKeyword: '청년미래적금 VS 청년 도약계좌', fetchBody });
    const rec = g.fetchLog!.find((f) => f.url.includes('fsc.go.kr'))!;
    expect(rec).toMatchObject({ attempted: true, ok: false, reason: 'fetch-failed' });
    const item = (g.items || []).find((i) => i.url.includes('fsc.go.kr'));
    if (item) expect(item.hasBody).toBe(false);                                              // 스니펫만 — 본문 확인 아님
    expect(g.fetchLog!.filter((f) => f.reason === 'budget').length).toBeGreaterThan(0);      // 예산에 밀린 것도 기록
  });

  test('T19 source ID·fullText·validationView 연결 회귀 없음 · T20 오프라인 재생 가능 (배선)', () => {
    const orch = read('src/core/final/orchestration.ts');
    expect(orch).toContain('crawledPosts.push(toFinalCrawledPost(item as any) as any)');
    expect(orch).toContain('sanitizeArticleFactClaims(allSectionsObj, bodyValidation.evidence)');
    expect(orch).toContain("trace.event('grounding.fetch'");
    expect(orch).toContain('derived: factIntegrityReport.derived || []');
    expect(orch).toContain('renderEvidence(evidenceItems, 11000)');
    const grounding = read('src/core/final/naver-grounding.ts');
    expect(grounding).toContain('const BODY_FETCH_MAX = 6;');
    expect(grounding).toContain('const OFFICIAL_RESERVE = 2;');
    expect(grounding).toContain('if (sourceScope && !sourceScope.comparison) {');
    expect(blockBetween(grounding, 'const [news, web, blog, agencyWeb]', 'if (sourceScope && !sourceScope.comparison)')).not.toContain('OFFICIAL_QUERY_HINTS');   // 검색 슬롯 추가 없음
    // 파생 차액 검산은 eval 이 없다
    expect(read('src/core/final/derived-difference.ts')).not.toMatch(/\beval\(|new Function\(/);
  });
});
