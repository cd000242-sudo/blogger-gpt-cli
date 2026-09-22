/**
 * 748-quality-prep — "이미 가진 좋은 자료를 버리지 않는 버전". 유료 호출 0.
 *   · 핵심 값 선별·절 배정(core-values): 잡음·시점 표시·지난해 값 제외, 값 하나는 한 절에만
 *   · MISSING_INFORMATION(ADD) 만 소제목을 insertionAnchor 로 인정
 *   · 빈 도입부도 수리 대상
 */
import * as fs from 'fs';
import * as path from 'path';
import { selectCoreValues, renderCoreBlock, coreCoverage } from '../src/core/final/core-values';
import { runCritiqueLoop, runCritic1, sectionize, type ArticleSections } from '../src/core/final/critique-loop';
import { repairEmptySections } from '../src/core/final/empty-section-gate';
import { ledgerFromItems } from '../src/core/final/fact-claims';

process.env['NO_LIVE_LLM'] = '1';
const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');

// 여행 패킷 축소판 — live 738 경주 APEC 패킷의 모양 그대로(잡음 포함)
const travelPacket = {
  mainKeyword: '경주 APEC 기간 숙소 예약', searchIntent: '경주 APEC 정상회의 기간의 숙소 예약 가능 여부와 예약 제한·숙박비 상황을 알고 싶다.',
  facts: [], conditions: [{ claim: '소노캄 경주는 정상회의 기간 중에는 예약 제한이 있다고 소개됐다.', sourceIds: ['E18'] }], eligibility: [], officialStatements: [],
  numbers: [
    { value: '11개월', context: '[2025-10-30 작성 · 11개월 전]', sourceIds: ['E13'] },
    { value: '90%', context: '업계에 따르면 웨스틴조선 부산, 파라다이스호텔 부산 등의 예약률이 90%에 이른다', sourceIds: ['E01'] },
    { value: '73%', context: '경주월드 자유이용권 조회 횟수도 73% 증가했다.', sourceIds: ['E03'] },
    { value: '6개월', context: '경주시가 확보한 숙박시설: 약 12,800여 개 객실 권장 예약 시기: 행사 최소 3~6개월 전 (5월~7월) 추천 숙소 지역: 보문단지', sourceIds: ['E07'] },
    { value: '12,800여 개', context: '경주시가 확보한 숙박시설: 약 12,800여 개 객실 권장 예약 시기: 행사 최소 3~6개월 전', sourceIds: ['E07'] },
    { value: '33회', context: '지난해 10월 31일부터 11월 1일까지 경주에서 열린 제33회 아시아 태평양.', sourceIds: ['E09'] },
  ],
  dates: [
    { value: '10월 31일부터 11월 1일', context: '지난해 10월 31일부터 11월 1일까지 경주에서 열린 제33회 아시아 태평양.', sourceIds: ['E09'] },
    { value: '10월 25일 ~ 11월 10일', context: 'APEC 기간 한정 프로모션 10월 25일 ~ 11월 10일 숙박 시 APEC 방문객 단기 숙박 요금 적용 (예약', sourceIds: ['E11'] },
  ],
  readerQuestions: ['경주 APEC 기간 대릉원 인근 숙박시설 정보 알려주세요.'], actualSearchSuggestions: [], status: 'OK',
};
const travelH2 = ['경주 APEC 숙소 정보 확인법', '대릉원 인근 숙소 위치 비교', '경주 호텔 예약 전 확인 항목', '행사장 기준 숙소 동선', '예약 가능 객실 공식 확인 경로', '주말 숙박 날짜별 선택 전략', '경주 숙소 예약 취소 규정 점검'];

describe('① 핵심 값 선별 — 잡음은 빠지고 판단 기준만 남는다', () => {
  it('⭐⭐ 여행: 12,800 객실 · 3~6개월 전 · 예약 제한 · 프로모션 기간은 뽑고, "11개월(작성 시점)"·"73%(경주월드)"·"33회(지난해)"·지난해 날짜는 뺀다', () => {
    const core = selectCoreValues(travelPacket, { keyword: '경주 APEC 기간 숙소 예약', title: '경주 APEC 기간 숙소 예약 대릉원 인근 숙소 찾는 법', h2Titles: travelH2 });
    const values = core.map((c) => c.value);
    expect(values).toEqual(expect.arrayContaining(['6개월', '12,800여 개', '10월 25일 ~ 11월 10일']));
    expect(values).not.toContain('11개월');
    expect(values).not.toContain('73%');
    expect(values).not.toContain('33회');
    expect(values).not.toContain('10월 31일부터 11월 1일');
    expect(core.some((c) => c.kind === 'condition' && /소노캄/.test(c.context))).toBe(true);
  });
  it('⭐ 값 하나는 한 절에만 · 절당 최대 3 · 전체 최대 8', () => {
    const core = selectCoreValues(travelPacket, { keyword: '경주 APEC 기간 숙소 예약', title: 't', h2Titles: travelH2 });
    const byValue = new Map(core.map((c) => [c.value, c.sectionIndex]));
    expect(byValue.size).toBe(core.length);   // 같은 값 중복 없음
    const perSection: Record<number, number> = {}; core.forEach((c) => { perSection[c.sectionIndex] = (perSection[c.sectionIndex] || 0) + 1; });
    expect(Object.entries(perSection).every(([k, n]) => Number(k) < 0 || n <= 3)).toBe(true);
    expect(core.length).toBeLessThanOrEqual(8);
  });
  it('⭐ 금융: 4.02~6.37% · +0.35%p · 3억→월이자 30만원 은 판단 기준 · 연예: 9월 17일 14:00 · 15,000원', () => {
    const fin = selectCoreValues({ mainKeyword: '주택담보대출 금리 7% 돌파', searchIntent: '주담대 금리가 7%를 넘었다는 뉴스가 내 대출에 뜻하는 것', facts: [], conditions: [], eligibility: [], officialStatements: [], readerQuestions: ['변동형 상환 부담'],
      numbers: [{ value: '4.02~6.37%', context: '5대 은행의 변동형 주담대 금리는 연 4.02~6.37%였으며', sourceIds: ['E02'] }, { value: '0.35%', context: '5대 은행의 변동형 주담대 금리는 지난 7월 15일 연 4.02~6.37%였으며, 두 달여 만에 최고금리는 0.35%포인트 올랐다', sourceIds: ['E02'] }, { value: '30만원', context: '3%p 뛴 주담대 금리… 3억 빌리면 월이자 30만원 더 내 상환 부담', sourceIds: ['E05'] }, { value: '0.01%', context: '1bp=0.01%포인트 미 국채 10년물', sourceIds: ['E06'] }], dates: [] },
      { keyword: '주택담보대출 금리 7% 돌파', title: '주택담보대출 금리 7% 돌파 변동형 상환 부담', h2Titles: ['주담대 월상환액 비교', '변동금리 고정금리 선택 기준'] });
    expect(fin.map((c) => c.value)).toEqual(expect.arrayContaining(['4.02~6.37%', '0.35%', '30만원']));
    expect(fin.map((c) => c.value)).not.toContain('0.01%');
    const ent = selectCoreValues({ mainKeyword: '부산국제영화제 개막작 예매', searchIntent: '개막작 예매 가능 여부와 예매 절차', facts: [], conditions: [], eligibility: [], officialStatements: [], readerQuestions: [],
      numbers: [{ value: '15,000원', context: '부산국제영화제 예매 사이트 일반 상영 티켓 가격 15,000원 개막작 예매', sourceIds: ['E04'] }], dates: [{ value: '9월 17일', context: '부산국제영화제 개막식과 폐막식 예매가 9월 17일 오후 2시에 시작', sourceIds: ['E02'] }] },
      { keyword: '부산국제영화제 개막작 예매', title: '부산국제영화제 개막작 예매 매진 뒤 확인할 절차', h2Titles: ['개막작 예매와 개막식 표 차이', '티켓팅 전 준비물'] });
    expect(ent.map((c) => c.value)).toEqual(expect.arrayContaining(['15,000원', '9월 17일']));
  });
  it('⭐ 정책·자동차 회귀 없음: 본문이 이미 값을 다 쓰면 missing 0 · 검색 의도와 안 겹치는 패킷이면 블록 자체가 비어 프롬프트에 아무것도 안 붙는다', () => {
    const core = selectCoreValues({ mainKeyword: '청년미래적금 2차 신청', facts: [], conditions: [], eligibility: [], officialStatements: [], readerQuestions: [], numbers: [{ value: '50만원', context: '청년미래적금 월 납입 한도는 50만원', sourceIds: ['E01'] }], dates: [{ value: '10월 7일부터 16일까지', context: '청년미래적금 2차 가입 신청은 10월 7일부터 16일까지', sourceIds: ['E01'] }] }, { keyword: '청년미래적금 2차 신청', title: 't', h2Titles: ['신청 기간', '납입 한도'] });
    const cov = coreCoverage(core, '2차 신청은 10월 7일부터 16일까지이고 월 납입 한도는 50만원입니다.');
    expect(cov.missing).toEqual([]);
    expect(renderCoreBlock([], ['x'])).toBe('');
  });
  it('블록은 짧고(8개 기준 1,300자 이하) 규칙 넷이 들어 있다', () => {
    const core = selectCoreValues(travelPacket, { keyword: '경주 APEC 기간 숙소 예약', title: 't', h2Titles: travelH2 });
    const block = renderCoreBlock(core, travelH2);
    expect(block.length).toBeLessThanOrEqual(1300);
    expect(block).toMatch(/값 → 뜻 → 독자가 할 일/);
    expect(block).toMatch(/같은 값을 되풀이하지 않습니다/);
    expect(block).toMatch(/첫 1~2문장/);
    expect(block).toMatch(/억지로 넣지 않습니다/);
    expect(block).toMatch(/12,800여 개 → \d\. /);
  });
});

const items = [{ id: 'E07', title: '경주시 숙박 안내', cleanedText: '경주시가 확보한 숙박시설은 약 12,800여 개 객실이다. 권장 예약 시기는 행사 최소 3~6개월 전이다.' }];
const ledger = ledgerFromItems(items.map((i) => ({ id: i.id, text: `${i.title} ${i.cleanedText}` })));
const packetText = '[RESEARCH PACKET]\n▸ 수치\n- 12,800여 개 [E07]\n- 3~6개월 전 [E07]';
const evidenceText = `[E07][공식] ${items[0]!.title}\n${items[0]!.cleanedText}`;
const PASS = JSON.stringify({ status: 'PASS', issues: [] });
const article = (): ArticleSections => ({
  introduction: '<p>경주 APEC 기간 숙소 예약을 앞두고 무엇부터 봐야 하는지 정리합니다.</p>',
  sections: [
    { h2: '경주 숙소 예약 전 확인 항목', h3Sections: [{ h3: '미리 예약하는 이유', content: '<p>선택지가 필요하면 미리 예약하는 편이 좋습니다. 취소 조건도 함께 읽는 편이 낫습니다. 객실 사진보다 판매 가격의 기준을 먼저 봅니다.</p>' }] },
    { h2: '대릉원 인근 숙소 위치', h3Sections: [{ h3: '시내권', content: '<p>대릉원 인근 숙소는 황리단길을 걸어서 연결하려는 일정에 맞습니다. 유적과 가깝습니다.</p>' }] },
  ],
  conclusion: '<p>날짜를 넣어 객실을 비교하면 됩니다.</p>',
});

describe('② MISSING_INFORMATION(ADD) 만 소제목을 insertionAnchor 로', () => {
  const isCritic1 = (p: string) => p.includes('당신은 검수자입니다. 칭찬하지 않고');
  const isEditor = (p: string) => p.includes('당신은 교정자입니다');
  const isVerify = (p: string) => p.includes('OPEN 지적 각각이 해결됐는가');
  it('⭐⭐ 여행 fixture: "미리 예약하는 편이 좋습니다" 만 있고 3~6개월 전이 빠짐 → 소제목 span 의 MAJOR 가 blocking 으로 살아남고 anchor=heading', async () => {
    const r = await runCritic1({ title: 't', mainKeyword: '경주 APEC 기간 숙소 예약', article: article(), packetText, evidenceText, items, callModel: async () => JSON.stringify({ status: 'REVISION_REQUIRED', issues: [
      { severity: 'MAJOR', sectionId: 'S01', exactSpan: '미리 예약하는 이유', type: 'MISSING_INFORMATION', problem: '권장 예약 시기(3~6개월 전)와 확보 객실 규모(12,800)가 패킷에 있는데 본문은 "미리" 라고만 한다', evidenceIds: ['E07'], requiredChange: '3~6개월 전 기준을 붙인다' },
    ], missingIntentAnswers: [], titleIssues: [], researchQueries: [] }) }, sectionize(article()));
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0]).toMatchObject({ severity: 'MAJOR', type: 'MISSING_INFORMATION', anchor: 'heading', allowedOperations: ['ADD'] });
    expect(r.status).toBe('REVISION_REQUIRED');
  });
  it('⭐⭐ live 748a 재현: 같은 소제목에 누락 지적이 둘이면 지문이 달라 둘 다 산다', async () => {
    const r = await runCritic1({ title: 't', mainKeyword: 'k', article: article(), packetText, evidenceText, items, callModel: async () => JSON.stringify({ status: 'REVISION_REQUIRED', issues: [
      { severity: 'MAJOR', sectionId: 'S01', exactSpan: '## 경주 숙소 예약 전 확인 항목', type: 'MISSING_INFORMATION', problem: '권장 예약 시기 3~6개월 전이 빠졌다', evidenceIds: ['E07'], requiredChange: '붙인다' },
      { severity: 'MAJOR', sectionId: 'S01', exactSpan: '## 경주 숙소 예약 전 확인 항목', type: 'MISSING_INFORMATION', problem: '경주시 확보 객실 12,800여 개가 빠졌다', evidenceIds: ['E07'], requiredChange: '붙인다' },
    ] }) }, sectionize(article()));
    expect(r.issues).toHaveLength(2);
    expect(new Set(r.issues.map((i) => i.issueKey)).size).toBe(2);
    expect(r.issues.every((i) => i.anchor === 'heading' && i.severity === 'MAJOR')).toBe(true);
  });
  it('⭐ H2 제목 · "## " 접두 · 번호 접두도 anchor 로 읽는다', async () => {
    for (const span of ['## 경주 숙소 예약 전 확인 항목', '1. 경주 숙소 예약 전 확인 항목', '경주 숙소 예약 전 확인 항목']) {
      const r = await runCritic1({ title: 't', mainKeyword: 'k', article: article(), packetText, evidenceText, items, callModel: async () => JSON.stringify({ status: 'REVISION_REQUIRED', issues: [{ severity: 'MAJOR', sectionId: 'S01', exactSpan: span, type: 'MISSING_INFORMATION', problem: '권장 예약 시기가 본문에 없다 — 패킷에는 있다', evidenceIds: ['E07'], requiredChange: '붙인다' }] }) }, sectionize(article()));
      expect(r.issues[0]?.anchor).toBe('heading');
      expect(r.issues[0]?.severity).toBe('MAJOR');
    }
  });
  it('⭐⭐ 다른 종류(CONTRADICTION·REDUNDANCY)는 H2 소제목 span 을 여전히 인정하지 않는다(MINOR) — exactSpan 정책은 그대로', async () => {
    for (const type of ['CONTRADICTION', 'REDUNDANCY', 'MIXED_ENTITY', 'SECTION_CONFLICT']) {
      const r = await runCritic1({ title: 't', mainKeyword: 'k', article: article(), packetText, evidenceText, items, callModel: async () => JSON.stringify({ status: 'REVISION_REQUIRED', issues: [{ severity: 'MAJOR', sectionId: 'S01', exactSpan: '경주 숙소 예약 전 확인 항목', type, problem: '소제목만 대고 본문 구절은 없는 지적이다', evidenceIds: ['E07'], requiredChange: '…' }] }) }, sectionize(article()));
      expect(r.issues[0]?.severity).toBe('MINOR');
      expect(r.issues[0]?.anchor).toBeUndefined();
    }
  });
  it('⭐ 편집기는 소제목 아래에 문단 하나를 보태고(기존 문장 보존) 검증이 풀면 RESOLVED · 다른 절 그대로', async () => {
    const a = article();
    const key = (await runCritic1({ title: 't', mainKeyword: 'k', article: a, packetText, evidenceText, items, callModel: async () => JSON.stringify({ status: 'REVISION_REQUIRED', issues: [{ severity: 'MAJOR', sectionId: 'S01', exactSpan: '미리 예약하는 이유', type: 'MISSING_INFORMATION', problem: '권장 예약 시기가 본문에 없다 — 패킷에는 있다', evidenceIds: ['E07'], requiredChange: '붙인다' }] }) }, sectionize(a))).issues[0]!.issueKey;
    let editorPrompt = '';
    const callModel = async (p: string) => {
      if (isCritic1(p)) return JSON.stringify({ status: 'REVISION_REQUIRED', issues: [{ severity: 'MAJOR', sectionId: 'S01', exactSpan: '미리 예약하는 이유', type: 'MISSING_INFORMATION', problem: '권장 예약 시기가 본문에 없다 — 패킷에는 있다', evidenceIds: ['E07'], requiredChange: '붙인다' }] });
      if (isEditor(p)) { editorPrompt = p; return JSON.stringify({ revisions: [{ sectionId: 'S01', h3Sections: [{ index: 0, content: '<p>선택지가 필요하면 미리 예약하는 편이 좋습니다. 취소 조건도 함께 읽는 편이 낫습니다. 객실 사진보다 판매 가격의 기준을 먼저 봅니다.</p><p>경주시가 확보한 객실은 약 12,800여 개이고 권장 예약 시기는 행사 최소 3~6개월 전입니다. 선택지를 넓히려면 그 전에 후보를 확인하는 편이 좋습니다.</p>' }], resolvedIssueKeys: [key] }] }); }
      if (isVerify(p)) return JSON.stringify({ resolved: [key], stillOpen: [], issues: [] });
      return PASS;
    };
    const r = await runCritiqueLoop({ title: 't', mainKeyword: '경주 APEC 기간 숙소 예약', article: a, packetText, evidenceText, items, callModel });
    expect(editorPrompt).toContain('보탤 위치(소제목): "미리 예약하는 이유"');
    expect(r.report.revisions[0]!.revised).toEqual(['S01']);
    expect(r.article.sections[0]!.h3Sections[0]!.content).toContain('선택지가 필요하면 미리 예약하는 편이 좋습니다');   // 기존 문장 보존
    expect(r.article.sections[0]!.h3Sections[0]!.content).toContain('3~6개월 전');
    expect(r.article.sections[1]).toEqual(a.sections[1]);
    expect(r.report.issueLedger.find((i) => i.issueKey === key)!.status).toBe('RESOLVED');
    expect(r.report.converged).toBe(true);
  });
});

describe('③ 빈 도입부도 수리한다 (live 744 금융: introduction "")', () => {
  it('⭐ introduction "" → 수리 1호출 · 값 대조 통과면 채움 · 실패면 미해결(sectionIndex -1)', async () => {
    const a = { ...article(), introduction: '' };
    let calls = 0;
    const ok = await repairEmptySections(a, { title: '경주 APEC 기간 숙소 예약 대릉원 인근 숙소 찾는 법', mainKeyword: '경주 APEC 기간 숙소 예약', packetText, evidenceText, ledger, callModel: async (p) => { calls += 1; expect(p).toContain('빈 도입부'); return JSON.stringify({ introduction: '<p>경주 APEC 기간 숙소 예약은 경주시가 확보한 약 12,800여 개 객실 가운데 대릉원 인근 후보부터 좁히는 일입니다.</p><p>권장 예약 시기는 행사 최소 3~6개월 전입니다. 지금 어디부터 봐야 할까요?</p>' }); } });
    expect(calls).toBe(1);
    expect(ok.article.introduction).toContain('12,800여 개');
    expect(ok.result.repaired[0]).toMatchObject({ sectionIndex: -1, h2: '(도입)' });
    expect(ok.result.unresolved).toEqual([]);
    const bad = await repairEmptySections({ ...article(), introduction: '<p></p>' }, { title: '경주 APEC 기간 숙소 예약', mainKeyword: 'k', packetText, evidenceText, ledger, callModel: async () => JSON.stringify({ introduction: '<p>경주 APEC 기간 숙소 예약은 경주시가 확보한 평균 숙박비 30만원 수준의 객실 가운데 고르는 일입니다. 대릉원 인근과 보문권 가운데 어느 쪽이 맞는지부터 정하면 후보가 빨리 좁혀집니다.</p><p>지금 어디부터 봐야 할까요? 후보를 좁히고 취소 조건을 비교한 뒤 날짜를 넣어 남은 객실을 확인합니다.</p>' }) });
    expect(bad.result.unresolved[0]).toMatchObject({ sectionIndex: -1 });
    expect(bad.result.unresolved[0]!.reason).toContain('30만원');
    expect(bad.article.introduction).toBe('<p></p>');
  });
  it('도입부가 있으면 호출 0 · 글 그대로', async () => {
    const a = article();
    const r = await repairEmptySections(a, { title: 't', mainKeyword: 'k', packetText, evidenceText, ledger, callModel: async () => { throw new Error('호출되면 안 된다'); } });
    expect(r.article).toBe(a);
  });
});

describe('④ 배선 — Writer 프롬프트에 핵심 값 블록 · Critic 규칙 문구 · 디버그 노출', () => {
  const orch = read('src/core/final/orchestration.ts');
  const loop = read('src/core/final/critique-loop.ts');
  it('core-values 가 H2 뒤·본문 생성 전에 절 블록에 붙는다 · 값 배정 블록은 CORE_VALUES_BLOCK=1 일 때만, 기본은 값 없는 규칙만', () => {
    const at = orch.indexOf("require('./core-values')");
    expect(at).toBeGreaterThan(orch.indexOf('h2Titles = await generateH2TitlesFinal('));
    expect(at).toBeLessThan(orch.indexOf('let allSectionsObj = await generateAllSectionsFinal('));
    expect(orch).toMatch(/process\.env\['CORE_VALUES_BLOCK'\] === '1' \? cv\.renderCoreBlock\(coreValues, h2Titles\) : cv\.renderRulesOnly\(\)/);
    expect(orch).toContain('coreValues, threadQuestions: threadQuestionAudit');
    const { renderRulesOnly } = require('../src/core/final/core-values');
    const rules = renderRulesOnly();
    expect(rules.length).toBeLessThan(600);
    expect(rules).toMatch(/값 → 뜻 → 독자가 할 일/);
    expect(rules).toMatch(/다른 지역·다른 대상의 값은 넣지 않습니다/);
    expect(rules).not.toMatch(/→ \d\. /);   // 값 배정 줄이 없다
  });
  it('Critic 1 규칙이 MISSING_INFORMATION 의 exactSpan 은 소제목이라고 말한다 · 편집기에 "보탤 위치" 가 전달된다', () => {
    expect(loop).toMatch(/MISSING_INFORMATION\(빠진 정보를 보태라\)은 틀린 구절이 없으므로 exactSpan 에 \*\*그 정보를 보탤 소제목/);
    expect(loop).toContain('보탤 위치(소제목)');
  });
});
