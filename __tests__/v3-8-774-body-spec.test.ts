const fs = require('fs');
const path = require('path');

import { inspectArticleFactIntegrity, type FactEvidence } from '../src/core/final/fact-integrity';
import { checkClaims, ledgerFromItems } from '../src/core/final/fact-claims';
import { buildVariantLedger, bodyUnits, judgeVariantValue, sentenceUnit, claimKey, variantDeletes, variantHolds } from '../src/core/final/variant-ledger';
import { checkTitleAuthority, checkSpecConsistency, authorityContext } from '../src/core/final/title-authority';
import { checkHeadingAuthority, factualSurfaceGate } from '../src/core/final/factual-surface';
import { specValues, unitClass } from '../src/core/final/spec-units';

/*
 * v3.8.774 — BODY SPEC CLAIM PARITY. 제목·소제목이 보던 사양값(mAh·W·kW·Wh·kWh·km)을 본문·표·답 상자에서도 같은 추출기·같은 장부·같은 판정으로. 호출 0회.
 */
const NOW = new Date('2026-09-30T09:00:00+09:00');
const FX = path.join(__dirname, 'fixtures');
const A4 = JSON.parse(fs.readFileSync(path.join(FX, 'run-batch2-770', 'run-inputs.json'), 'utf8')).it;
const F9 = JSON.parse(fs.readFileSync(path.join(FX, 'run-batch3-773', 'f91a10.json'), 'utf8'));
const B1 = JSON.parse(fs.readFileSync(path.join(FX, 'run-batch1-767', 'publish-769.json'), 'utf8'));

type Src = { id: string; title: string; text: string; html?: string; authority?: string; hasBody?: boolean };
type Prose = { id: string; text: string };
const plain = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const articleOf = (html: string) => {
  const [intro, ...parts] = html.split('<h2>');
  return { introduction: intro || '', conclusion: '', sections: parts.map((p) => { const [h2, rest] = p.split('</h2>'); return { h2: h2 || '', h3Sections: [{ h3: '', content: rest || '' }] }; }) };
};
function run(title: string, bodyHtml: string, sources: Src[], prose: Prose[] = []) {
  const ledger = buildVariantLedger({ title, sources, prose });
  const evidence: FactEvidence = { context: [...sources.map((s) => `${s.title}\n${s.text}`), ...prose.map((p) => p.text)].join('\n\n'), provider: 'test', trustLevel: 'strong', sourceUrls: ['https://example.com/spec'] };
  const legacy = ledgerFromItems([...sources.map((s) => ({ id: s.id, text: `${s.title} ${s.text}` })), ...prose]);
  return {
    ledger,
    filterOff: inspectArticleFactIntegrity(articleOf(bodyHtml), evidence),
    filterOn: inspectArticleFactIntegrity(articleOf(bodyHtml), { ...evidence, variant: { ledger } }),
    gateOff: checkClaims(plain(bodyHtml), legacy, NOW),
    gateOn: checkClaims(plain(bodyHtml), legacy, NOW, [], { ledger, units: bodyUnits(ledger, bodyHtml, title) }),
  };
}
const verdicts = (r: { variant?: Array<{ claim: string; verdict: string }> }) => [...new Set((r.variant || []).map((v) => `${v.claim.replace(/[\s,]/g, '')}:${v.verdict}`))].sort();
const TITLE = 'Z10 배터리 충전 사양';
const OWNER = 'SUBJECT_OWNER_PRIMARY';

describe('BODY SPEC (T1~T5)', () => {
  test('T1 Z10 4,000mAh vs Z10+ 4,000mAh(또는 다른 모델) → 지지 아님 · 예전에는 본문이 mAh 를 읽지도 않았다', () => {
    const r = run(TITLE, '<p>Z10 배터리 용량은 4,000mAh입니다.</p>', [{ id: 'E01', title: 'Z10+ 사양', text: 'Z10+ 배터리 용량은 4,000mAh입니다.', authority: OWNER }]);
    expect(r.filterOff.status).toBe('passed');
    expect(r.gateOff.unsupported).toEqual([]);
    expect(verdicts(r.gateOn)).toEqual(['4000mAh:VARIANT_MISMATCH']);
    expect(r.filterOn.status).toBe('blocked');           // 당사자 원문이 다른 모델 값이라고 말함 → 지움
    expect(r.gateOn.unsupported).toContain('4,000mAh');
    const other = run(TITLE, '<p>Z10 배터리 용량은 4,000mAh입니다.</p>', [{ id: 'E01', title: 'Y30 사양', text: 'Y30 배터리 용량은 4,000mAh입니다.' }]);
    expect(verdicts(other.gateOn)).toEqual(['4000mAh:VARIANT_MISMATCH']);
    expect(other.filterOn.status).toBe('passed');        // 서드파티 원문 → 지우지 않고
    expect(other.gateOn.unsupported).toContain('4,000mAh'); // 보류
  });
  test('T2 Z10 4,300mAh — 같은 모델 원문 → 지지 (표현이 달라도 mAh 는 단위가 속성)', () => {
    const r = run(TITLE, '<p>Z10 배터리 용량은 4,300mAh입니다.</p>', [{ id: 'E01', title: 'Z10 사양', text: 'Z10 표준 용량은 4,300mAh입니다.' }]);
    expect(verdicts(r.gateOn)).toEqual(['4300mAh:SUPPORTED']);
    expect(r.filterOn.status).toBe('passed');
    expect(r.gateOn.unsupported).toEqual([]);
  });
  test('T3 Z10 45W vs 충전기 45W → 지지 아님(PROPERTY_MISMATCH)', () => {
    const r = run(TITLE, '<p>Z10 최대 유선 충전은 45W입니다.</p>', [{ id: 'E01', title: 'Z10 사양', text: '45W 충전기 보유 여부와 Z10의 유선 충전 기준은 구분해서 봐야 합니다.', authority: OWNER }]);
    expect(verdicts(r.gateOn)).toEqual(['45W:PROPERTY_MISMATCH']);
    expect(r.filterOn.status).toBe('blocked');
    const weak = run(TITLE, '<p>Z10 최대 유선 충전은 45W입니다.</p>', [{ id: 'E01', title: 'Z10 사용기', text: '45W 충전기 보유 여부와 Z10의 유선 충전 기준은 구분해서 봐야 합니다.' }]);
    expect(verdicts(weak.gateOn)).toEqual(['45W:PROPERTY_MISMATCH']);
    expect(weak.filterOn.status).toBe('passed');
    expect(weak.gateOn.unsupported).toContain('45W');
  });
  test('T4 Z10 45W vs Z10 25W 같은 속성 → 모순(1차 원문) · 서드파티끼리 다르면 모순 아님', () => {
    const r = run(TITLE, '<p>Z10은 45W 고속 유선 충전을 지원합니다.</p>', [{ id: 'E01', title: 'Z10 사양', text: 'Z10은 25W 고속 유선 충전을 지원합니다.', authority: OWNER }]);
    const weak = run(TITLE, '<p>Z10은 45W 고속 유선 충전을 지원합니다.</p>', [{ id: 'E01', title: 'Z10 사용기', text: 'Z10은 25W 고속 유선 충전을 지원합니다.' }]);
    expect(verdicts(weak.gateOn)).toEqual(['45W:NOT_FOUND']); // 모순이 아니라 "장부 원문에 없는 사양값"
    expect(weak.gateOn.unsupported).toContain('45W');
    expect(verdicts(r.gateOn)).toEqual(['45W:CONTRADICTED']);
    expect(r.gateOn.variant![0]!.reason).toMatch(/25W/);
    expect(r.filterOn.status).toBe('blocked');
  });
  test('T5 km — 한정어(복합·도심·고속도로)가 다르면 같은 주장이라 단정하지 않는다', () => {
    const src: Src = { id: 'E01', title: 'EV9 롱레인지 제원', text: 'EV9 롱레인지 복합 주행거리는 501km입니다. EV9 롱레인지 고속도로 주행거리는 447km입니다. EV9 롱레인지 도심 주행거리는 545km입니다.', authority: OWNER };
    const t = 'EV9 롱레인지 주행거리';
    expect(verdicts(run(t, '<p>EV9 롱레인지 복합 주행거리는 501km입니다.</p>', [src]).gateOn)).toEqual(['501km:SUPPORTED']);
    // 고속도로에 복합 값을 붙이면 같은 한정어(고속도로)의 447km 와 모순
    expect(verdicts(run(t, '<p>EV9 롱레인지 고속도로 주행거리는 501km입니다.</p>', [src]).gateOn)).toEqual(['501km:CONTRADICTED']);
    // 원문에 없는 한정어로 같은 값을 쓰면 확인 불가(UNRESOLVED) — 지우지 않고(필터 통과) 본문 관문은 보류
    const r = run(t, '<p>EV9 롱레인지 인증 주행거리는 501km입니다.</p>', [src]);
    expect(verdicts(r.gateOn)).toEqual(['501km:UNRESOLVED']);
    expect(r.filterOn.status).toBe('passed');
    expect(r.gateOn.unsupported).toContain('501km');
    // 글 안의 복합 501km · 도심 545km · 고속도로 447km 는 내부 모순이 아니다
    expect(checkSpecConsistency('<p>EV9 롱레인지 복합 주행거리는 501km입니다.</p><p>도심은 545km, 고속도로는 447km입니다.</p>', t)).toEqual([]);
  });
});

describe('서드파티 오정보 · 당사자 1차 (E06 형태)', () => {
  const blog: Src = { id: 'E06', title: 'Z10 실사용 비교', text: 'Z10은 4,000mAh 배터리와 45W 유선 충전을 지원한다.', authority: 'SECONDARY', hasBody: true };
  const owner: Src = { id: 'E01', title: 'Z10 사양', text: 'Z10 표준 배터리 용량은 4,300mAh입니다. Z10은 25W 유선 충전을 지원합니다.', authority: OWNER, hasBody: true };
  test('블로그 "Z10 4,000mAh·45W" 가 당사자 1차 원문과 충돌 → CONTRADICTED(LOWER_AUTHORITY), 블로그 문서는 지우지 않는다', () => {
    const r = run(TITLE, '<p>Z10은 4,000mAh 배터리와 45W 유선 충전을 지원한다.</p>', [blog, owner]);
    expect(verdicts(r.gateOn)).toEqual(['4000mAh:CONTRADICTED', '45W:CONTRADICTED']);
    expect(r.gateOn.variant!.every((v) => v.authority === 'PRIMARY' && /LOWER_AUTHORITY/.test(v.reason))).toBe(true);
    expect(r.ledger.sources.map((s) => s.id)).toEqual(['E06', 'E01']);
    // 당사자 원문의 값은 지지(PRIMARY)
    expect(verdicts(run(TITLE, '<p>Z10 배터리 용량은 4,300mAh입니다.</p>', [blog, owner]).gateOn)).toEqual(['4300mAh:SUPPORTED']);
  });
  test('당사자 1차 후보는 원문 없이(검색 요약만)이고 정확한 사양은 서드파티에만 → UNRESOLVED: 지우지 않고 자동 발행 근거로 쓰지 않음', () => {
    const ownerUnfetched: Src = { id: 'E01', title: 'Z10 | 공식', text: 'Z10 공식 페이지', authority: OWNER, hasBody: false };
    const r = run(TITLE, '<p>Z10은 4,000mAh 배터리를 갖췄다.</p>', [blog, ownerUnfetched]);
    expect(verdicts(r.gateOn)).toEqual(['4000mAh:UNRESOLVED']);
    expect(r.filterOn.status).toBe('passed');
    expect(r.gateOn.unsupported).toContain('4,000mAh');
    // 당사자 후보가 없으면 서드파티 원문도 원문이다(SECONDARY 지지)
    expect(verdicts(run(TITLE, '<p>Z10은 4,000mAh 배터리를 갖췄다.</p>', [blog]).gateOn)).toEqual(['4000mAh:SUPPORTED']);
  });
});

describe('FACTCHECK SOURCE (T6~T9)', () => {
  const FC_PROSE: Prose = { id: 'FACTCHECK1', text: 'Z10은 약 30분 만에 최대 69% 충전되고 45W 유선 충전을 지원합니다.\n[출처] https://www.example.com/z10/specs/' };
  test('T6 팩트체크 서술만 → 근거 아님', () => {
    expect(verdicts(run(TITLE, '<p>Z10은 45W 유선 충전을 지원합니다.</p>', [], [FC_PROSE]).gateOn)).toEqual(['45W:UNKNOWN']);
  });
  test('T7 공식 주소 + 원문 조각 + 모델·속성 일치 → 원문 근거(FCSRC, PRIMARY)', () => {
    const span: Src = { id: 'FCSRC1', title: 'Z10 사양', text: 'Z10은 25W 유선 충전을 지원합니다.', authority: OWNER, hasBody: true };
    const r = run(TITLE, '<p>Z10은 25W 유선 충전을 지원합니다.</p>', [span], [FC_PROSE]);
    expect(verdicts(r.gateOn)).toEqual(['25W:SUPPORTED']);
    expect(r.gateOn.variant![0]).toMatchObject({ sourceIds: ['FCSRC1'], authority: 'PRIMARY' });
    // 같은 조각이 서술의 45W 를 반박한다
    expect(verdicts(run(TITLE, '<p>Z10은 45W 유선 충전을 지원합니다.</p>', [span], [FC_PROSE]).gateOn)).toEqual(['45W:CONTRADICTED']);
  });
  test('T8 공식 주소만 있고 원문 조각이 없으면 권위 있는 지지가 아니다', () => {
    const r = run(TITLE, '<p>Z10은 약 30분 만에 최대 69% 충전됩니다.</p>', [], [FC_PROSE]);
    expect(verdicts(r.gateOn)).toEqual(['69%:UNKNOWN']);
    expect(r.gateOn.unsupported).toContain('69%');
  });
  test('T9 서술의 모델과 원문 조각의 모델이 다르면 원문 범위가 우선', () => {
    const span: Src = { id: 'FCSRC1', title: 'Z10 | Z10+', text: 'Z10+는 45W 유선 충전을 지원합니다.', authority: OWNER, hasBody: true };
    expect(verdicts(run(TITLE, '<p>Z10은 45W 유선 충전을 지원합니다.</p>', [span], [FC_PROSE]).gateOn)).toEqual(['45W:VARIANT_MISMATCH']);
  });
});

describe('PARITY (T10~T11)', () => {
  test('T10 사실 필터와 본문 관문 — mAh·W·kW·Wh·kWh·km 에서 같은 판정·같은 통과/실패', () => {
    const src: Src = { id: 'E01', title: 'Z10 사양', text: 'Z10 표준 배터리 용량은 4,300mAh입니다. Z10은 25W 유선 충전을 지원합니다. Z10 충전 스테이션 출력은 7kW입니다. Z10 배터리 에너지는 16Wh입니다. Z10 월 사용량은 3kWh입니다. Z10 주행 가능 거리는 12km입니다.' };
    const bodies = [
      '<p>Z10 배터리 용량은 4,300mAh입니다.</p>', '<p>Z10 배터리 용량은 4,000mAh입니다.</p>', '<p>Z10은 45W 유선 충전을 지원합니다.</p>',
      '<p>Z10 충전 스테이션 출력은 11kW입니다.</p>', '<p>Z10 배터리 에너지는 16Wh입니다.</p>', '<p>Z10 월 사용량은 5kWh입니다.</p>', '<p>Z10 주행 가능 거리는 12km입니다.</p>',
      '<h2>Z10+ 사양</h2><p>배터리 용량은 4,300mAh입니다.</p>',
    ];
    for (const authority of [OWNER, 'SECONDARY']) {
      for (const body of bodies) {
        const r = run(TITLE, body, [{ ...src, authority }]);
        expect({ authority, body, v: verdicts(r.filterOn) }).toEqual({ authority, body, v: verdicts(r.gateOn) });
        // 행동은 판정표대로: 필터는 1차 원문 반박·장부에 없는 사양값만 지우고, 관문은 지지가 아니면 보류
        const fj = r.filterOn.variant || []; const gj = r.gateOn.variant || [];
        expect({ authority, body, blocked: r.filterOn.status === 'blocked' }).toEqual({ authority, body, blocked: fj.some((j) => variantDeletes(j) || j.verdict === 'NOT_FOUND') });
        expect({ authority, body, fail: r.gateOn.unsupported.length > 0 }).toEqual({ authority, body, fail: gj.some((j) => variantHolds(j) || j.verdict === 'NOT_FOUND') });
        if (r.filterOn.status === 'blocked') expect(r.gateOn.unsupported.length).toBeGreaterThan(0);
      }
    }
  });
  test('T11 제목·소제목·본문·표가 같은 추출기(spec-units)·같은 claimKey', () => {
    expect(specValues('4,300mAh · 25W · 7kW · 16Wh · 3kWh · 501km').map((v) => v.value)).toEqual(['4300mAh', '25W', '7kW', '16Wh', '3kWh', '501km']);
    expect([unitClass('mAh'), unitClass('W'), unitClass('km'), unitClass('%')]).toEqual(['PROPERTY', 'CONTEXT', 'CONTEXT', 'LEGACY']);
    const page = '<h1>Z10 | Z10+</h1><table><tr><th>구분</th><th>Z10</th><th>Z10+</th></tr><tr><td>유선 충전</td><td>25W</td><td>45W</td></tr></table>';
    // 제목 권위와 본문 장부가 같은 문서의 같은 칸에서 같은 신원을 낸다
    const ctx = authorityContext(page, [], { pageTitle: 'Z10 | Z10+', claimLines: ['Z10 45W'] });
    const ledger = buildVariantLedger({ title: 'Z10 충전', sources: [{ id: 'E01', title: 'Z10 | Z10+', text: plain(page), html: page, authority: OWNER }] });
    const row = ctx.units.find((u) => u.s.startsWith('유선 충전'))!;
    const lrow = ledger.sources[0]!.units.find((u) => u.s.startsWith('유선 충전'))!;
    expect(claimKey(row, row.s.indexOf('45W'), 3)).toEqual(claimKey(lrow, lrow.s.indexOf('45W'), 3));
    // 제목·본문이 같은 판정
    expect(checkTitleAuthority('Z10 45W 유선 충전', page).claims.find((c) => c.claim === '45W')!.verdict).toBe('CONTRADICTED');
    expect(judgeVariantValue(ledger, sentenceUnit(ledger, 'Z10은 45W 유선 충전을 지원합니다.'), '45W').verdict).toBe('CONTRADICTED');
    const src = (f: string) => fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', f), 'utf8');
    expect(src('title-authority.ts')).toMatch(/\$\{SPEC_UNIT_SOURCE\}/);
    expect(src('fact-integrity.ts')).toMatch(/specValues\(sentence\)/);
    expect(src('fact-claims.ts')).toMatch(/specValues\(u\.s\)/);
  });
});

describe('답 상자 · 표 · FAQ 내부 대조', () => {
  test('본문 25W ↔ 표 45W (같은 Z10 유선 충전) → 내부 모순 · 사실 표면 관문 보류', () => {
    const html = '<h1>Z10 충전 사양</h1><p>Z10은 25W 유선 충전을 지원합니다.</p><table><tr><th>항목</th><th>값</th></tr><tr><td>유선 충전</td><td>45W</td></tr></table>';
    const c = checkSpecConsistency(html, 'Z10 충전 사양');
    expect(c).toEqual([expect.objectContaining({ variant: 'z10', unit: 'W', values: expect.arrayContaining(['25W', '45W']) })]);
    expect(factualSurfaceGate(null, [], c)).toMatchObject({ pass: false });
  });
  test('거부·대조 문맥 · 한정어가 다른 값 · 다른 모델은 내부 모순이 아니다', () => {
    expect(checkSpecConsistency('<p>Z10은 4000mAh와 45W가 아니라 표준 용량 4300mAh 정격 용량 4175mAh와 25W 고속 유선 충전입니다.</p><p>4300mAh는 표준 용량이고 4175mAh는 정격 용량입니다.</p>', 'Z10 사양')).toEqual([]);
    expect(checkSpecConsistency('<p>Z10은 25W 유선 충전, Z10+는 45W 유선 충전입니다.</p>', 'Z10 | Z10+ 충전')).toEqual([]);
  });
  test('실제 저장 글 6편(IT 두 편·행정·자동차·보험·여행) — 내부 모순 0건(거짓 보류 없음)', () => {
    const h1 = (html: string) => ((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '').replace(/<[^>]+>/g, '').trim();
    const docs: Array<[string, string]> = [[A4.finalHtml, A4.visible.title], [F9.finalHtml, F9.title], ...(['car', 'insurance', 'travel'] as const).map((k) => [B1[k].finalHtml, h1(B1[k].finalHtml)] as [string, string])];
    for (const [html, title] of docs) expect({ title, c: checkSpecConsistency(html, title) }).toEqual({ title, c: [] });
    // 자동차 글의 복합 501 · 도심 545 · 고속도로 447km 는 소제목·본문 모두 모순 없음
    expect(factualSurfaceGate(null, checkHeadingAuthority(B1.car.finalHtml, [], h1(B1.car.finalHtml)), checkSpecConsistency(B1.car.finalHtml, h1(B1.car.finalHtml))).pass).toBe(true);
  });
});

describe('실제 저장 초안 — 약한 근거로 지우지 않는다(회귀 방지)', () => {
  const CAR = JSON.parse(fs.readFileSync(path.join(FX, 'run-batch1-767', 'run-inputs.json'), 'utf8')).car;
  const filterAdded = (draft: any, title: string, items: any[], fcText: string) => {
    const ledger = buildVariantLedger({ title, sources: items.map((i: any) => ({ id: i.id, title: String(i.title || ''), text: String(i.cleanedText || '') })), prose: fcText ? [{ id: 'FACTCHECK1', text: fcText }] : [] });
    const evidence: FactEvidence = { context: [...items.map((i: any) => `${i.title}\n${i.cleanedText}`), fcText].join('\n\n'), provider: 'replay', trustLevel: 'strong', sourceUrls: ['https://example.com'] };
    const off = inspectArticleFactIntegrity(draft, evidence).violations.map((v) => `${v.location}:${v.detail}`);
    return inspectArticleFactIntegrity(draft, { ...evidence, variant: { ledger } }).violations.map((v) => `${v.location}:${v.detail}`).filter((v) => !off.includes(v));
  };
  test('a4fc1b 초안 — 블로그 E06(S26 4000mAh)만으로 맞는 4300mAh·25W·55% 를 지우지 않는다(새 삭제 0건)', () => {
    expect(filterAdded(A4.draftBeforeFilter, A4.visible.title, A4.items, A4.factcheckSupplement)).toEqual([]);
  });
  test('BATCH 1 자동차 초안 — 721만 원·3694만 원(파생)·54km(두 값의 차)·447km 를 지우지 않는다(새 삭제 0건)', () => {
    const h1 = ((B1.car.finalHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '').replace(/<[^>]+>/g, '').trim();
    expect(filterAdded(CAR.draftBeforeFilter, h1, CAR.items, CAR.factcheckSupplement || '')).toEqual([]);
  });
  test('맨 이름("EV3")은 트림 주장("EV3 롱레인지")에 모호 — 다른 모델이 아니다 · 앞 문장부호("…EV3")도 이름', () => {
    const src: Src = { id: 'E01', title: '"160만 원 더 보태면~"…EV3 보러 왔다가 EV5 탄다', text: '서울시 전기차 보조금까지 합치면 EV3는 721만 원, EV5는 717만 원이다.' };
    const ledger = buildVariantLedger({ title: 'EV3 롱레인지 가격', sources: [src] });
    expect(ledger.sources[0]!.scope.via).toBe('ambiguous'); // EV3·EV5 두 모델 페이지
    const j = judgeVariantValue(ledger, sentenceUnit(ledger, 'EV3 롱레인지 서울 보조금 합계는 721만 원입니다.'), '721만 원');
    expect(j.verdict).toBe('UNKNOWN');
    expect(variantDeletes(j)).toBe(false);
  });
});

describe('배선', () => {
  test('팩트체크 검색 결과 원문 조각 → 장부 원문(FCSRC) · 내부 대조 → 사실 표면 관문 · 최종 권위 보고', () => {
    const src = (f: string) => fs.readFileSync(path.join(__dirname, '..', 'src', 'core', f), 'utf8');
    expect(src('perplexityFactCheck.ts')).toMatch(/const sourceSpans = spansOf\(data\.search_results\)/);
    expect(src('final/orchestration.ts')).toMatch(/factSourceSpans = factResult\.success && factResult\.context \? \(factResult\.sourceSpans \|\| \[\]\) : \[\]/);
    expect(src('final/orchestration.ts')).toMatch(/id: `FCSRC\$\{k \+ 1\}`/);
    expect(src('final/orchestration.ts')).toMatch(/factualSurfaceGate\(titleAuth, headingAuth, specInternal\)/);
    expect(src('final/final-authority.ts')).toMatch(/specInternal: checkSpecConsistency\(html, input\.title \|\| ''\)/);
  });
});

describe('교차 도메인 합성', () => {
  test('IT Base 4,300 · Plus 4,900mAh / 자동차 Standard 350 · Long Range 501km / 충전기 45W · 기기 25W / 사용량 400kWh · 단가 120원/kWh', () => {
    const it: Src = { id: 'E01', title: 'Z10 | Z10+ 사양', text: 'Z10 배터리 용량은 4,300mAh입니다. Z10+ 배터리 용량은 4,900mAh입니다.', authority: OWNER };
    expect(verdicts(run('Z10 사양', '<p>Z10 배터리 용량은 4,900mAh입니다.</p>', [it]).gateOn)).toEqual(['4900mAh:CONTRADICTED']);
    const car: Src = { id: 'E01', title: 'EV9 가격표', text: 'EV9 스탠다드 주행거리는 350km입니다. EV9 롱레인지 주행거리는 501km입니다.', authority: OWNER };
    expect(verdicts(run('EV9 스탠다드 주행거리', '<p>EV9 스탠다드 주행거리는 501km입니다.</p>', [car]).gateOn)).toEqual(['501km:CONTRADICTED']);
    const charge: Src = { id: 'E01', title: 'Z10 사양', text: '45W 충전기를 써도 Z10 기기 최대 입력은 25W입니다.', authority: OWNER };
    expect(verdicts(run('Z10 사양', '<p>Z10 기기 최대 입력은 45W입니다.</p>', [charge]).gateOn)).toEqual(['45W:CONTRADICTED']);
    // 생활 계산 — 모델 축이 없으면 예전 동작(사양값을 새로 읽지 않는다): 400kWh 와 120원/kWh 는 섞이지 않는다
    const life = run('주택용 전기요금 400kWh', '<p>사용량 400kWh 기준 1구간 단가는 120원/kWh입니다.</p>', [{ id: 'E01', title: '전기요금표', text: '1구간 단가는 120원/kWh입니다. 사용량 400kWh를 예로 듭니다.' }]);
    expect(life.gateOn.variant || []).toEqual([]);
    expect(life.filterOn.status).toBe(life.filterOff.status);
    expect(specValues('단가는 120원/kWh').map((v) => v.value)).toEqual([]);
  });
});
