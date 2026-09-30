const fs = require('fs');
const path = require('path');

import { extractCriticalStates, criticalStateCoverage, renderCriticalStates, type PacketLike } from '../src/core/final/critical-state';
import { buildWriterPacketView } from '../src/core/final/writer-packet-view';
import { runFinalAuthority } from '../src/core/final/final-authority';
import { distinctiveTokens } from '../src/core/final/evidence';

/*
 * v3.8.768 — TIME_SENSITIVE_STATE_RETENTION. BATCH 1 여행 run 69f928 저장 입력 오프라인 재생 + 교차 도메인. 호출 0회.
 * 독자의 현재 행동을 바꾸는 상태(매진·조기 마감·중단·판매 종료·재고 소진)를 패킷에서 뽑아 하나로 묶고, Writer 보기 맨 앞에 싣고, 초안·최종 글과 대조한다.
 */
const S = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'run-batch1-767', 'state-768.json'), 'utf8'));
const TODAY = '2026-09-30';
const opts = (keyword: string, today = TODAY) => ({ keyword, today, distinctive: distinctiveTokens(keyword) });
const bodyOf = (d: any) => [d.introduction, ...d.sections.flatMap((s: any) => s.h3Sections.map((h: any) => `<h3>${h.h3}</h3>${h.content}`)), d.conclusion].join('\n');
const pk = (rows: Partial<PacketLike>): PacketLike => ({ mainKeyword: 'x', currentAsOf: TODAY, facts: [], numbers: [], dates: [], sourceMap: [{ id: 'E01', title: '경복궁 야간관람 예매 안내', pubDate: '2026-09-10' }, { id: 'E02', title: '경복궁 야간관람 소식', pubDate: '2026-09-12' }], ...rows });
const KW = '2026 경복궁 야간관람 예매';
const SOLD_OUT = pk({ facts: [{ claim: '하반기 경복궁 야간관람 예매 기간은 9월 20일부터 10월 5일까지다.', sourceIds: ['E01'] }, { claim: '10월 2일 관람분은 예매 시작 뒤 조기 매진됐다.', sourceIds: ['E01', 'E02'] }] });
const STATES = extractCriticalStates(SOLD_OUT, opts(KW));

describe('EXTRACTION (T1~T4) — 상태 변화만, 하나로, 현재 회차만', () => {
  test('T1 원래 종료일 + 조기 매진 → 조기 매진이 critical (적용 날짜 10월 2일)', () => {
    expect(STATES).toHaveLength(1);
    expect(STATES[0]).toMatchObject({ action: 'BOOK', actionWord: '예매', state: 'UNAVAILABLE', stateWord: '조기 매진', effective: ['10월 2일'], currentness: 'CURRENT', confidence: 'high', sourceIds: ['E01', 'E02'] });
  });
  test('T2 단순 일정 날짜는 critical 아님 — 예매 기간·마감 시각·예정·임박', () => {
    for (const claim of ['예매 기간은 9월 20일부터 10월 5일까지다.', '예매는 10월 1일 오후 11시 59분에 마감한다.', '10월 2일 관람분은 매진이 임박했다.', '접수가 몰리면 조기 마감될 수 있다.', '입장 마감은 20시 30분이다.']) {
      expect(extractCriticalStates(pk({ facts: [{ claim, sourceIds: ['E01'] }] }), opts(KW))).toEqual([]);
    }
  });
  test('T3 같은 상태 7곳 → canonical 1개 (live 69f928 패킷: numbers 4 · dates 3)', () => {
    const p = S.travel.packet;
    const rows = ['numbers', 'dates'].flatMap((k) => p[k].filter((v: any) => /매진/.test(v.context)));
    expect(rows).toHaveLength(7);
    const states = extractCriticalStates(p, opts(S.travel.keyword));
    expect(states).toHaveLength(1);
    expect(states[0]).toMatchObject({ actionWord: '예매', stateWord: '조기 매진', effective: ['10월 2일'], occurrences: 7, asOf: '2026-09-02' });
    expect(states[0]!.sourceIds.sort()).toEqual(['E08', 'E10', 'E11', 'E12', 'E13']);
    // 지난 주말(9월 4~6일 …)·추석(9월 23~27일)은 이미 지나 지금 행동과 상관없다 — 적용 날짜에 없다
    expect(states[0]!.effective).not.toContain('9월 23~27일');
  });
  test('T4 다른 연도 매진은 현재 회차에 쓰지 않는다 — 문장의 연도 · 오래된 문서뿐 · 다른 회차 · 다른 행사', () => {
    expect(extractCriticalStates(pk({ facts: [{ claim: '2025년 10월 2일 관람분은 조기 매진됐다.', sourceIds: ['E01'] }] }), opts(KW))).toEqual([]);
    const old = pk({ facts: [{ claim: '10월 2일 관람분은 조기 매진됐다.', sourceIds: ['E09'] }], sourceMap: [{ id: 'E09', title: '경복궁 야간관람 2025 후기', pubDate: '2025-08-26' }] });
    expect(extractCriticalStates(old, opts(KW))).toEqual([]);
    expect(extractCriticalStates(pk({ facts: [{ claim: '상반기 10월 2일 관람분은 조기 매진됐다.', sourceIds: ['E01'] }] }), opts('2026 하반기 경복궁 야간관람 예매'))).toEqual([]);
    const other = pk({ facts: [{ claim: '10월 2일 공연 티켓은 조기 매진됐다.', sourceIds: ['E07'] }], sourceMap: [{ id: 'E07', title: '창덕궁 달빛기행 예매', pubDate: '2026-09-10' }] });
    expect(extractCriticalStates(other, opts(KW))).toEqual([]);
  });
  test('BATCH 1 자동차·보험 패킷 → 상태 0개 (오탐 없음)', () => {
    expect(extractCriticalStates(S.car.packet, opts(S.car.keyword))).toEqual([]);
    expect(extractCriticalStates(S.insurance.packet, opts(S.insurance.keyword))).toEqual([]);
  });
});

describe('COVERAGE (T5~T9) — 날짜가 아니라 상태 뜻', () => {
  const cov = (text: string) => criticalStateCoverage(text, STATES)[0]!.status;
  test('T5 날짜만 언급 → MISSING', () => {
    expect(cov('<p>야간관람은 10월 2일까지 운영합니다. 10월 2일 관람은 입장 마감 20:30을 넘기지 않게 이동합니다.</p>')).toBe('MISSING');
  });
  test('T6 현재 매진을 설명 → COVERED', () => {
    expect(cov('<p>10월 2일 관람분은 이미 매진됐습니다.</p>')).toBe('COVERED');
    expect(cov('<p>마지막 날인 10월 2일 표는 예매 시작 뒤 모두 팔려 잔여석이 없습니다.</p>')).toBe('COVERED');
  });
  test('T7 반대로 씀 → CONTRADICTED · FAQ 질문 문장은 주장이 아니다', () => {
    expect(cov('<p>10월 2일에도 NOL 티켓에서 예매할 수 있습니다.</p>')).toBe('CONTRADICTED');
    expect(cov('<p>10월 1일 또는 10월 2일 관람이라면 NOL 티켓에서 선착순 예매하면 됩니다.</p>')).toBe('CONTRADICTED');
    expect(cov('<details><summary>Q. 10월 2일 경복궁 야간관람은 당일에 예매할 수 있나요?</summary><p>관람일 전날까지 가능합니다.</p></details>')).toBe('MISSING');
    expect(cov('<p>10월 2일의 NOL 티켓 잔여석부터 판단하면 됩니다.</p>')).toBe('MISSING');
  });
  test('T8 초안엔 있었는데 최종에서 지워짐 → final-authority MISSING', () => {
    const draft = '<p>10월 2일 관람분은 조기 매진됐습니다.</p><p>야간관람은 19:00부터 21:30까지입니다.</p>';
    expect(criticalStateCoverage(draft, STATES)[0]!.status).toBe('COVERED');
    const fa = runFinalAuthority({ html: '<p>야간관람은 19:00부터 21:30까지입니다. 10월 2일까지 운영합니다.</p>', evidence: { context: '', provider: 'x', trustLevel: 'strong', topic: KW }, keyword: KW, coreQuestions: [], criticalStates: STATES });
    expect(fa.report.criticalStates).toEqual([expect.objectContaining({ status: 'MISSING', effective: ['10월 2일'], stateWord: '조기 매진' })]);
  });
  test('T9 원래 일정 + 현재 매진을 함께 설명 → 허용(COVERED)', () => {
    expect(cov('<p>원래 예매 기간은 10월 5일까지였지만 10월 2일 관람분은 조기 매진됐습니다.</p>')).toBe('COVERED');
    expect(cov('<p>10월 2일 관람분은 매진됐지만 취소표가 나오면 예매할 수 있습니다.</p>')).toBe('COVERED');
  });
});

describe('CROSS-DOMAIN (T10·T11) — 범용 동작', () => {
  const run = (claim: string, keyword: string, title: string, writer: string, today = TODAY) => {
    const p = pk({ facts: [{ claim, sourceIds: ['E01'] }], sourceMap: [{ id: 'E01', title, pubDate: '2026-09-20' }] });
    const states = extractCriticalStates(p, opts(keyword, today));
    return { states, status: states.length ? criticalStateCoverage(writer, states)[0]!.status : 'NONE' };
  };
  test('T10 정책: 원래 15일까지 · 10일 조기 마감 → "15일까지 신청할 수 있습니다" 실패, 조기 마감 설명 통과', () => {
    const claim = '청년 월세 지원 신청은 원래 9월 15일까지였으나 신청자가 몰려 9월 10일 조기 마감됐다.';
    const bad = run(claim, '청년 월세 지원 신청', '청년 월세 지원 신청 안내', '<p>9월 15일까지 신청할 수 있습니다.</p>');
    expect(bad.states[0]).toMatchObject({ action: 'APPLY', effective: [] });
    expect(bad.status).toBe('CONTRADICTED');
    expect(run(claim, '청년 월세 지원 신청', '청년 월세 지원 신청 안내', '<p>신청은 9월 10일 조기 마감됐습니다.</p>').status).toBe('COVERED');
  });
  test('T11 자동차: 예약 판매 시작 뒤 주문 중단 → "지금 주문할 수 있습니다" 실패', () => {
    const r = run('사전 예약 판매를 시작했으나 이후 주문이 중단됐다.', '신형 전기차 사전 예약', '신형 전기차 사전 예약 안내', '<p>지금 공식 홈페이지에서 주문할 수 있습니다.</p>');
    expect(r.states[0]).toMatchObject({ action: 'BUY' });
    expect(r.status).toBe('CONTRADICTED');
  });
  test('보험 특약 판매 종료 · IT 사전예약 재고 소진 · 채용 조기 마감 — 현재 가능하다고 쓰면 실패', () => {
    expect(run('해당 운전자 특약은 9월 1일 판매가 종료됐다.', '운전자보험 특약', '운전자보험 특약 판매 안내', '<p>지금도 이 특약에 가입할 수 있습니다.</p>').status).toBe('CONTRADICTED');
    expect(run('사전예약 기간 중 1차 물량 재고가 소진됐다.', '갤럭시 사전예약', '갤럭시 사전예약 안내', '<p>사전예약 기간이 남아 지금 구매할 수 있습니다.</p>').status).toBe('CONTRADICTED');
    expect(run('공개채용 접수는 마감일 전에 조기 마감됐다.', '공개채용 접수', '공개채용 접수 공고', '<p>마감일 전이라 아직 지원할 수 있습니다.</p>').status).toBe('CONTRADICTED');
  });
});

describe('LIVE 69f928 재생 — SOURCE → PACKET → WRITER VIEW → WRITER → FINAL', () => {
  const states = extractCriticalStates(S.travel.packet, opts(S.travel.keyword));
  test('BEFORE: Writer 보기가 7줄 모두 보조(SUPPORTING · LOW_INTENT)로 내렸다 — 값의 무게로 상태를 잰 결과', () => {
    expect(S.travel.oldWriterViewSoldOutDecisions.map((d: any) => `${d.verdict}/${d.tier}/${d.reason}`)).toEqual(Array(7).fill('DEMOTE/SUPPORTING/LOW_INTENT'));
  });
  test('AFTER: Writer 보기 맨 앞에 상태 한 줄 — 내부 식별자·판정명 없음', () => {
    const view = buildWriterPacketView({ ...S.travel.packet, criticalStates: states }, { keyword: S.travel.keyword, title: '', h2Titles: [] }).text.split('\n');
    const at = view.findIndex((l) => /지금 독자의 행동을 바꾸는 상태/.test(l));
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(view.findIndex((l) => /^▸ /.test(l) && !/지금 독자의 행동을 바꾸는 상태/.test(l)) === -1 ? Infinity : view.findIndex((l) => /^▸ /.test(l) && !/지금 독자의 행동을 바꾸는 상태/.test(l)));
    expect(view[at + 1]).toMatch(/^- 10월 2일 예매: 조기 매진 \(2026-09-02 보도 기준\) \[E10,E11,E12,E13,E08\] — 이 날짜를 예매할 수 있는 것처럼 쓰지 마세요/);
    expect(renderCriticalStates(states).join('\n')).not.toMatch(/UNAVAILABLE|BOOK|CURRENT|CS-\d/);
  });
  test('Writer 초안 MISSING — "10월 2일" 은 여러 번 나오지만 상태 뜻이 없다', () => {
    const draft = bodyOf(S.travel.writerDraft);
    expect((draft.match(/10월 2일/g) || []).length).toBeGreaterThan(3);
    expect(criticalStateCoverage(draft, states)[0]!.status).toBe('MISSING');
  });
  test('FINAL(final-authority) CONTRADICTED — 답 상자가 "10월 2일 관람이라면 … 예매하면 됩니다"', () => {
    const fa = runFinalAuthority({ html: S.travel.finalHtml, evidence: { context: '', provider: 'x', trustLevel: 'strong', topic: S.travel.keyword }, keyword: S.travel.keyword, coreQuestions: [], criticalStates: states });
    expect(fa.report.criticalStates[0]).toMatchObject({ status: 'CONTRADICTED', evidence: ['10월 1일 또는 10월 2일 관람이라면 NOL 티켓에서 선착순 예매하면 됩니다.'] });
  });
  test('배선 — 계획 이벤트 · 초안 coverage · final-authority 에 상태 전달', () => {
    const orch = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
    expect(orch).toMatch(/researchPacket = \{ \.\.\.researchPacket, criticalStates \};\s*\n\s*trace\.event\('critical-state\.plan'/);
    expect(orch.indexOf("trace.event('critical-state.plan'")).toBeLessThan(orch.indexOf('writerPacketView = wpv.buildWriterPacketView(researchPacket'));
    expect(orch).toMatch(/trace\.event\('critical-state\.coverage', \{ stage: 'draft'/);
    // v3.8.770 — final-authority 는 제목·팩트체크 문단도 받는다(상태 배열 전달은 그대로)
    expect(orch).toMatch(/runFinalAuthority\(\{[^\n]*criticalStates: researchPacket\.criticalStates \|\| \[\](?:, [^\n]*)? \}\)/);
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', 'critical-state.ts'), 'utf8').replace(/\/\*\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    expect(src).not.toMatch(/경복궁|야간관람|NOL|10월\s*2일/);
  });
});
