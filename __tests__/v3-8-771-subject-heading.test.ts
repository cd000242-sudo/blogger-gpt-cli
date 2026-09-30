const fs = require('fs');
const path = require('path');

import { propertyWindow, propertyRelation } from '../src/core/final/claim-property';
import { checkTitleAuthority, authorityClaims, authoritySentences } from '../src/core/final/title-authority';
import { checkHeadingAuthority, factualSurfaceGate } from '../src/core/final/factual-surface';
import { factcheckWithLineage } from '../src/core/final/content-provenance';
import { distinctiveTokens } from '../src/core/final/evidence';
import { extractClaims, checkClaims, ledgerFromItems } from '../src/core/final/fact-claims';
import { visiblePlainText } from '../src/core/final/visible-article';
import { runFinalAuthority } from '../src/core/final/final-authority';

/*
 * v3.8.771 — CLAIM SUBJECT BINDING + HEADING FINAL AUTHORITY. BATCH 2 IT run a4fc1b 저장 입력 재생 + BATCH 1·2 회귀 + 교차 도메인. 호출 0회.
 */
const B2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'run-batch2-770', 'run-inputs.json'), 'utf8'));
const B1 = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'run-batch1-767', 'publish-769.json'), 'utf8'));
const IT = B2.it; const ADMIN = B2.admin;
const FC = factcheckWithLineage(IT.factcheckSupplement, [], distinctiveTokens(IT.keyword)).ledger.map((l: any) => l.text);
const IT_TITLE = '갤럭시 S26 자급제 eSIM 듀얼심 지원, 4000mAh 45W 충전';
const claimOf = (line: string, doc: string, v: string) => authorityClaims(line, authoritySentences(doc)).find((c) => c.claim === v)!;
const at = (s: string, v: string) => propertyWindow(s, s.indexOf(v), v.length);

describe('SUBJECT/PROPERTY (T1~T5)', () => {
  test('T1 같은 값 + 다른 대상 → 지지 아님 (충전기 65W ≠ 노트북 65W 충전)', () => {
    expect(propertyRelation(at('노트북 65W 충전', '65W'), at('충전기 출력은 65W입니다.', '65W'))).toBe('DIFFERENT');
    expect(claimOf('노트북 65W 충전', '<p>충전기 출력은 65W입니다.</p>', '65W').verdict).not.toBe('SUPPORTED');
  });
  test('T2 같은 값 + 다른 속성 → 지지 아님 — 보험료/보상한도 10만원 · 수수료/우편료 1000원 · 주차/관람 2시간', () => {
    expect(claimOf('보상한도 10만원 정리', '<p>월 보험료는 10만원입니다.</p>', '10만원').verdict).not.toBe('SUPPORTED');
    expect(claimOf('발급 수수료 1000원', '<p>등기 우편료는 1000원입니다.</p>', '1000원').verdict).not.toBe('SUPPORTED');
    expect(claimOf('관람 2시간 코스', '<p>주차는 2시간까지 무료입니다.</p>', '2시간').verdict).not.toBe('SUPPORTED');
  });
  test('T3 같은 대상·속성 + 같은 값 → 지지', () => {
    expect(claimOf('노트북 45W 충전', '<p>이 노트북의 최대 입력은 45W입니다.</p>', '45W').verdict).toBe('SUPPORTED');
    expect(claimOf('보상한도 10만원 정리', '<p>보상한도는 10만원입니다.</p>', '10만원').verdict).toBe('SUPPORTED');
  });
  test('T4 같은 대상·속성 + 다른 값 → 모순 — 노트북 65W vs 입력 45W · 350kW 초고속 충전 vs 차량 충전 수용 180kW', () => {
    const doc = '<p>충전기 출력은 65W입니다.</p><p>노트북 최대 입력은 45W입니다.</p>';
    expect(claimOf('노트북 65W 충전', doc, '65W')).toMatchObject({ verdict: 'CONTRADICTED' });
    const car = '<p>충전기 출력은 350kW입니다.</p><p>차량의 최대 충전 수용은 180kW입니다.</p>';
    expect(claimOf('350kW 초고속 충전', car, '350kW')).toMatchObject({ verdict: 'CONTRADICTED' });
  });
  test('T5 대상 불명(곁 낱말 없음) → 지지로 승격하지 않음 · 모순으로도 만들지 않음 (용량 mAh 처럼 단위가 속성을 정하는 경우만 예외)', () => {
    expect(propertyRelation([], at('노트북 65W 충전', '65W'))).toBe('UNKNOWN');
    expect(claimOf('노트북 65W 충전', '<p>65W입니다.</p>', '65W').verdict).toBe('UNCHECKED');
    // 곁 낱말이 없는 용량값(live 제목 "…, 4000mAh 45W 충전" 의 4000mAh)은 단위(mAh)가 속성을 정한다 → 같은 속성의 다른 값과 모순
    expect(claimOf('S26 사양, 4000mAh', '<p>표준 용량 4,300mAh입니다.</p>', '4000mAh').verdict).toBe('CONTRADICTED');
    // 한계(기록): 곁 낱말이 서로 다른 동의어("배터리" vs "용량")면 DIFFERENT 로 보고 대조하지 않는다 — 억지 모순보다 대조 불가
    expect(claimOf('배터리 4000mAh', '<p>표준 용량 4,300mAh입니다.</p>', '4000mAh').verdict).toBe('UNCHECKED');
  });
});

describe('IT FIXTURE a4fc1b (T11~T15)', () => {
  test('T11 "45W 충전기 보유 여부…" 는 S26 45W 충전의 지지가 아니다 — 속성 창 {충전기…} vs {충전}', () => {
    const s = '45W 충전기 보유 여부와 갤럭시 S26의 유선 충전 기준은 구분해서 봐야 합니다.';
    expect(IT.finalHtml).toContain(s);
    expect(propertyWindow(s, 0, 3)).toEqual(expect.arrayContaining(['충전기']));
    expect(propertyRelation(at('4000mAh 45W 충전', '45W'), propertyWindow(s, 0, 3))).toBe('DIFFERENT');
    const c = checkTitleAuthority(IT_TITLE, IT.finalHtml, FC).claims.find((x) => x.claim === '45W')!;
    expect(c.evidence.join(' ')).not.toContain('충전기 보유 여부');
  });
  test('T12 S26 25W(같은 대상·속성)가 제목 45W 를 모순으로 잡는다 (770 BEFORE: 45W SUPPORTED)', () => {
    const c = checkTitleAuthority(IT_TITLE, IT.finalHtml, FC).claims.find((x) => x.claim === '45W')!;
    expect(c).toMatchObject({ verdict: 'CONTRADICTED' });
    expect(c.reason).toMatch(/25W/);
  });
  test('T13·T14 소제목 "4000mAh 45W 충전 성능" — 4000mAh·45W 둘 다 HEADING 모순', () => {
    const hs = checkHeadingAuthority(IT.finalHtml, FC);
    const h = hs.find((x) => x.heading === '4000mAh 45W 충전 성능')!;
    expect(h).toMatchObject({ level: 'h2', pass: false });
    expect(h.claims.map((c) => [c.claim, c.verdict])).toEqual([['4000mAh', 'CONTRADICTED'], ['45W', 'CONTRADICTED']]);
    expect(hs.find((x) => x.heading === '갤럭시 S26 자급제 듀얼심 지원')).toMatchObject({ pass: true });
  });
  test('T15 본문 4300mAh·4175mAh·25W 는 그대로 — 검사는 보고만 하고 글을 바꾸지 않는다', () => {
    const fa = runFinalAuthority({ html: IT.finalHtml, evidence: { context: '', provider: 'x', trustLevel: 'strong', topic: IT.keyword }, keyword: IT.keyword, coreQuestions: [], title: IT_TITLE, factcheck: FC });
    for (const v of ['표준 용량 4300mAh', '정격 용량 4175mAh', '25W 고속 유선 충전']) expect(fa.html).toContain(v);
    expect(fa.report.headings.find((h) => h.heading === '4000mAh 45W 충전 성능')).toMatchObject({ pass: false });
    expect(fa.report.title).toMatchObject({ pass: false });
  });
});

describe('HEADING (T6~T10)', () => {
  const body = '<p>공식 사양은 표준 용량 4300mAh이며 25W 유선 충전을 지원합니다.</p><p>온라인 발급은 본인만 할 수 있고 대리인의 온라인 발급은 불가능합니다.</p>';
  test('T6 수치 소제목 모순 → 검출', () => {
    expect(checkHeadingAuthority(`<h2>2. 배터리 용량 4000mAh 성능</h2>${body}`)[0]).toMatchObject({ heading: '배터리 용량 4000mAh 성능', pass: false, claims: [expect.objectContaining({ claim: '4000mAh', verdict: 'CONTRADICTED' })] });
  });
  test('T7 가능/불가 소제목 모순 → 검출', () => {
    expect(checkHeadingAuthority(`<h3>1-1. 대리인 온라인 발급 가능</h3>${body}`)[0]).toMatchObject({ pass: false, claims: [expect.objectContaining({ kind: 'categorical', verdict: 'CONTRADICTED' })] });
  });
  test('T8 정보 없는 소제목은 검사 대상이 아니다', () => {
    expect(checkHeadingAuthority(`<h2>어떤 차이가 있을까</h2><h3>사용 전에 알아둘 점</h3><h2>직접 비교해 보면</h2>${body}`)).toEqual([]);
  });
  test('T9 제목 정상 + 소제목 모순 → 보류(FINAL_FACTUAL_SURFACE)', () => {
    const doc = `<h2>배터리 용량 4000mAh 성능</h2>${body}`;
    const g = factualSurfaceGate(checkTitleAuthority('배터리 용량 4300mAh 정리', doc), checkHeadingAuthority(doc));
    expect(g).toMatchObject({ pass: false, reason: '4000mAh(소제목 "배터리 용량 4000mAh 성능")' });
    const orch = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
    expect(orch).toMatch(/FINAL_FACTUAL_SURFACE_PASS: surfaceGate\.pass,/);
    expect(orch).toContain('const publishEnforced = qualityLoopOn || !criticalGate.pass || !surfaceGate.pass;');
    expect(orch).not.toMatch(/TITLE_AUTHORITY_PASS/);
  });
  test('T10 제목 + 소제목이 같은 틀린 값 → 둘 다 기록하되 사유는 값마다 한 번 (live a4fc1b)', () => {
    const g = factualSurfaceGate(checkTitleAuthority(IT_TITLE, IT.finalHtml, FC), checkHeadingAuthority(IT.finalHtml, FC));
    expect(g.pass).toBe(false);
    expect(g.blockers.map((b) => [b.claim, b.locations])).toEqual([['4000mAh', ['제목', '소제목 "4000mAh 45W 충전 성능"']], ['45W', ['제목', '소제목 "4000mAh 45W 충전 성능"']]]);
    expect(g.reason).toBe('4000mAh(제목·소제목 "4000mAh 45W 충전 성능") · 45W(제목·소제목 "4000mAh 45W 충전 성능")');
  });
});

describe('REGRESSION — BATCH 1·2 저장 run', () => {
  const fcOf = (supp: string, kw: string) => factcheckWithLineage(supp, [], distinctiveTokens(kw)).ledger.map((l: any) => l.text);
  test('행정 48417f: 사실 소제목 "정부24 대리는 허용 안 됨" PASS · 가짜 토큰 24일/24대/6위 계속 0', () => {
    const f = fcOf(ADMIN.factcheckSupplement, ADMIN.keyword);
    expect(factualSurfaceGate(checkTitleAuthority(ADMIN.visible.title, ADMIN.finalHtml, f), checkHeadingAuthority(ADMIN.finalHtml, f)).pass).toBe(true);
    expect(checkHeadingAuthority(ADMIN.finalHtml, f).map((h) => [h.heading, h.pass])).toEqual([['정부24 대리는 허용 안 됨', true]]);
    expect(extractClaims('정부24 대상에서 제외 6 위임장 작성 정부24 일반용').length).toBe(0);
    const ledger = ledgerFromItems([...ADMIN.items.map((i: any) => ({ id: i.id, text: `${i.title} ${i.cleanedText}` })), { id: 'PACKET', text: ADMIN.packetText }]);
    expect(checkClaims(visiblePlainText(ADMIN.visible), ledger).unsupported).toEqual([]);
  });
  test('자동차·보험·여행(BATCH 1): 사실 소제목이 불필요하게 모순 처리되지 않는다 · 표면 관문 통과', () => {
    for (const k of ['car', 'insurance', 'travel']) {
      const hs = checkHeadingAuthority(B1[k].finalHtml);
      expect(hs.filter((h) => !h.pass)).toEqual([]);
    }
    expect(checkHeadingAuthority(B1.car.finalHtml).map((h) => h.heading)).toEqual(expect.arrayContaining(['서울은 721만 원 적용', '501km는 조건부 수치']));
  });
  test('하드코딩 없음 — 새 모듈에 회사·모델·값 이름이 없다', () => {
    for (const f of ['claim-property.ts', 'factual-surface.ts']) {
      const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', f), 'utf8').replace(/\/\*\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
      expect(src).not.toMatch(/삼성|samsung|갤럭시|S26|충전기|45W|25W|4000|4300/i);
    }
  });
});
