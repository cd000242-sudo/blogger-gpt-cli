const fs = require('fs');
const path = require('path');

import { inspectArticleFactIntegrity, type FactEvidence } from '../src/core/final/fact-integrity';
import { checkClaims, ledgerFromItems } from '../src/core/final/fact-claims';
import { buildVariantLedger, bodyUnits, judgeVariantValue, sentenceUnit, claimKey, variantDeletes, variantHolds } from '../src/core/final/variant-ledger';
import { checkTitleAuthority, authorityContext } from '../src/core/final/title-authority';
import { checkHeadingAuthority, factualSurfaceGate } from '../src/core/final/factual-surface';
import { factcheckWithLineage } from '../src/core/final/content-provenance';
import { distinctiveTokens } from '../src/core/final/evidence';

/*
 * v3.8.773 — VARIANT LEDGER PARITY. 모델·트림 범위를 본문 사실 필터·본문 관문(checkClaims)·팩트체크 장부까지 같은 장부·같은 판정으로. 호출 0회.
 */
const NOW = new Date('2026-09-30T09:00:00+09:00');
const FX = path.join(__dirname, 'fixtures');
const A4 = JSON.parse(fs.readFileSync(path.join(FX, 'run-batch2-770', 'run-inputs.json'), 'utf8')).it;
const F9 = JSON.parse(fs.readFileSync(path.join(FX, 'run-batch3-773', 'f91a10.json'), 'utf8'));

/**
 * v3.8.774 계약 개정: 모순은 1차 원문(당사자·공적 기관)만 말하고, 사실 필터는 1차 원문이 반박할 때만 지운다.
 * 서드파티·모호한 근거의 판정은 지우지 않고 본문 관문이 보류한다. 삭제·모순을 보려는 경우 원문에 authority 를 준다.
 */
type Src = { id: string; title: string; text: string; html?: string; authority?: string; hasBody?: boolean };
const OWNER = 'SUBJECT_OWNER_PRIMARY';
type Prose = { id: string; text: string };
const plain = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
/** 본문 HTML → 파이프라인의 원고 구조(h2 필드 + h3 content). 사실 필터는 이 구조로 절 범위를 받는다 */
const articleOf = (html: string) => {
  const [intro, ...parts] = html.split('<h2>');
  return { introduction: intro || '', conclusion: '', sections: parts.map((p) => { const [h2, rest] = p.split('</h2>'); return { h2: h2 || '', h3Sections: [{ h3: '', content: rest || '' }] }; }) };
};
/** 같은 입력으로 사실 필터(fact-integrity)와 본문 관문(checkClaims)을 모델 장부 있이·없이 돌린다 */
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
const verdicts = (r: { variant?: Array<{ claim: string; verdict: string }> }) => [...new Set((r.variant || []).map((v) => `${v.claim.replace(/\s+/g, '')}:${v.verdict}`))].sort();

const TITLE = 'Z10 충전 속도';
const A_PAGE: Src = { id: 'E01', title: 'Z10 사양', text: 'Z10은 약 30분 만에 최대 55% 고속 충전됩니다.', authority: OWNER };
const PLUS_PAGE: Src = { id: 'E02', title: 'Z10+ 사양', text: 'Z10+는 약 30분 만에 최대 69% 고속 충전됩니다.', authority: OWNER };
/** 판정 목록 → 기대 행동: 필터는 variantDeletes 가 있으면 지우고, 관문은 variantHolds 가 있으면 보류 */
const contract = (r: { filterOn: { variant?: any[] }; gateOn: { variant?: any[] } }) => ({
  filterBlocked: (r.filterOn.variant || []).some(variantDeletes),
  gateFails: (r.gateOn.variant || []).some(variantHolds),
});
const BODY_69 = '<p>Z10은 약 30분 만에 최대 69% 고속 충전됩니다.</p>';
const BODY_55 = '<p>Z10은 약 30분 만에 최대 55% 고속 충전됩니다.</p>';

describe('BODY (T1~T4)', () => {
  test('T1 같은 제품군·속성·값 + 다른 변형 → 지지 아님 (필터·관문 모두)', () => {
    const r = run(TITLE, BODY_69, [PLUS_PAGE]);
    expect(r.filterOff.status).toBe('passed'); // BEFORE: 69% 가 근거에 있으니 통과
    expect(r.gateOff.unsupported).toEqual([]);
    expect(r.filterOn.status).toBe('blocked');
    expect(r.gateOn.unsupported).toContain('69%');
    expect(verdicts(r.gateOn)).toEqual(['69%:VARIANT_MISMATCH']);
    // 같은 반례를 서드파티 원문이 말하면 — 지우지 않고(필터 통과) 본문 관문이 보류(774)
    const weak = run(TITLE, BODY_69, [{ ...PLUS_PAGE, authority: 'SECONDARY' }]);
    expect(verdicts(weak.gateOn)).toEqual(['69%:VARIANT_MISMATCH']);
    expect(weak.filterOn.status).toBe('passed');
    expect(weak.gateOn.unsupported).toContain('69%');
  });
  test('T2 같은 변형·속성·값 → 지지', () => {
    const r = run(TITLE, BODY_55, [A_PAGE, PLUS_PAGE]);
    expect(r.filterOn.status).toBe('passed');
    expect(r.gateOn.unsupported).toEqual([]);
    expect(verdicts(r.gateOn)).toEqual(['55%:SUPPORTED']);
  });
  test('T3 같은 변형·속성 + 다른 값 → 모순', () => {
    const r = run(TITLE, BODY_69, [A_PAGE, PLUS_PAGE]);
    expect(r.filterOff.status).toBe('passed');
    expect(r.filterOn.status).toBe('blocked');
    expect(verdicts(r.gateOn)).toEqual(['69%:CONTRADICTED']);
    expect(r.gateOn.variant![0]!.reason).toMatch(/55%/);
  });
  test('T4 변형을 정할 수 없는 근거(시리즈 문맥·LLM 서술) → UNKNOWN, 지지로 승격하지 않음', () => {
    const series: Src = { id: 'E03', title: 'Z10 | Z10+', text: '약 30분 만에 최대 69% 고속 충전됩니다.' };
    const r = run(TITLE, BODY_69, [series]);
    expect(r.filterOff.status).toBe('passed');
    expect(verdicts(r.gateOn)).toEqual(['69%:UNKNOWN']);
    // 모호한 근거로는 지우지 않는다(774) — 본문 관문이 보류
    expect(r.filterOn.status).toBe('passed');
    expect(r.gateOn.unsupported).toContain('69%');
    // 원문이 모델을 전혀 말하지 않으면(범위 없음) 예전 동작 — 값 존재로 지지
    const unscoped = run(TITLE, BODY_69, [{ id: 'E04', title: '고속 충전 비교', text: '약 30분 만에 최대 69% 고속 충전됩니다.' }]);
    expect(unscoped.filterOn.status).toBe('passed');
    expect(unscoped.gateOn.unsupported).toEqual([]);
  });
});

describe('LEDGER (T5~T6)', () => {
  test('T5 사실 필터와 본문 관문은 같은 판정 — 행동은 판정표대로(필터 = 1차 원문 반박만 삭제, 관문 = 지지 아니면 보류)', () => {
    const series: Src = { id: 'E03', title: 'Z10 | Z10+', text: '약 30분 만에 최대 69% 고속 충전됩니다.' };
    const cases: Array<[string, string, Src[], Prose[]]> = [
      ['T1', BODY_69, [PLUS_PAGE], []], ['T2', BODY_55, [A_PAGE, PLUS_PAGE], []], ['T3', BODY_69, [A_PAGE, PLUS_PAGE], []],
      ['T4', BODY_69, [series], []], ['PROSE', BODY_69, [], [{ id: 'FACTCHECK1', text: 'Z10은 약 30분 만에 최대 69% 고속 충전됩니다.' }]],
      ['SECTION', '<h2>Z10+ 충전</h2><p>약 30분 만에 최대 69% 고속 충전됩니다.</p>', [PLUS_PAGE], []],
    ];
    for (const [name, body, sources, prose] of cases) {
      const r = run(TITLE, body, sources, prose);
      expect({ name, v: verdicts(r.filterOn) }).toEqual({ name, v: verdicts(r.gateOn) });
      const c = contract(r);
      expect({ name, blocked: r.filterOn.status === 'blocked' }).toEqual({ name, blocked: c.filterBlocked });
      expect({ name, fail: r.gateOn.unsupported.length > 0 }).toEqual({ name, fail: c.gateFails });
      // 지운 것은 반드시 보류 대상이기도 하다(필터 통과·관문 실패는 있어도, 필터 삭제·관문 지지는 없다)
      if (c.filterBlocked) expect(c.gateFails).toBe(true);
    }
  });
  test('T6 제목·소제목·본문이 같은 주장 신원(claimKey) — 같은 문서에서 같은 판정', () => {
    const page = '<h1>Z10 | Z10+</h1><p>약 30분 만에 최대 69% 고속 충전*</p><p>* Z10+에만 적용됩니다.</p><table><tr><th>구분</th><th>Z10</th><th>Z10+</th></tr><tr><td>30분 고속 충전</td><td>55%</td><td>69%</td></tr></table>';
    const line = 'Z10 30분 최대 69% 고속 충전';
    expect(checkTitleAuthority(line, page).claims.find((c) => c.claim === '69%')!.verdict).toBe('CONTRADICTED');
    const ledger = buildVariantLedger({ title: 'Z10 충전', sources: [{ id: 'E01', title: 'Z10 | Z10+', text: plain(page), html: page, authority: OWNER }] });
    expect(judgeVariantValue(ledger, sentenceUnit(ledger, 'Z10은 약 30분 만에 최대 69% 고속 충전됩니다.'), '69%').verdict).toBe('CONTRADICTED');
    // 제목 권위의 권위 단위와 장부 단위가 같은 claimKey 를 낸다
    const ctx = authorityContext(page, [], { pageTitle: 'Z10 | Z10+', claimLines: [line] });
    const row = ctx.units.find((u) => u.s.startsWith('30분 고속 충전'))!;
    const lrow = ledger.sources[0]!.units.find((u) => u.s.startsWith('30분 고속 충전'))!;
    expect(claimKey(row, row.s.indexOf('55%'), 3)).toEqual(claimKey(lrow, lrow.s.indexOf('55%'), 3));
    // 소스 차원: 네 표면이 같은 함수를 부른다
    const src = (f: string) => fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', f), 'utf8');
    expect(src('title-authority.ts')).toMatch(/claimKey\(u, q\.index, q\.raw\.length\)/);
    expect(src('fact-integrity.ts')).toMatch(/judgeVariantValue\(evidence\.variant\.ledger/);
    expect(src('fact-claims.ts')).toMatch(/judgeVariantValue\(variant\.ledger/);
    expect(src('orchestration.ts')).toMatch(/withVariant\(bodyValidation\.evidence, filterLedger\)/);
    expect(src('orchestration.ts')).toMatch(/withVariant\(tableValidationBase\.evidence, variantLedger\(\)\)/);
  });
});

describe('FACTCHECK (T7~T9)', () => {
  const footnotePage = '<h1>Z10 | Z10+</h1><p>약 30분 만에 최대 69% 고속 충전*</p><p>* Z10+에만 적용됩니다.</p>';
  const FC_69: Prose = { id: 'FACTCHECK1', text: 'Z10은 약 30분 만에 최대 69% 고속 충전됩니다.\n[출처] https://www.example.com/z10/specs/' };
  test('T7 팩트체크가 "Z10 69%" 라고 해도 원문이 "Z10+ 전용" 이면 Z10 지지 금지 — 원문 범위가 LLM 서술보다 우선', () => {
    const src: Src = { id: 'E01', title: 'Z10 | Z10+', text: plain(footnotePage), html: footnotePage, authority: OWNER };
    const r = run(TITLE, BODY_69, [src], [FC_69]);
    expect(r.gateOff.unsupported).toEqual([]); // BEFORE: 팩트체크 문단이 지지
    expect(verdicts(r.gateOn)).toEqual(['69%:VARIANT_MISMATCH']);
    expect(r.filterOn.status).toBe('blocked');
    expect(r.ledger.sources.find((s) => s.id === 'FACTCHECK1')!.scope.via).toBe('prose');
    // 제목 권위도 같은 규칙 — 팩트체크 서술은 모델 붙은 제목 값을 지지하지 못한다
    expect(checkTitleAuthority('Z10 30분 최대 69% 고속 충전', '<p>Z10 이야기</p>', [FC_69.text]).claims.find((c) => c.claim === '69%')!.verdict).not.toBe('SUPPORTED');
  });
  test('T8 원문이 변형을 정하지 못하면 UNKNOWN (시리즈 페이지 · LLM 서술만)', () => {
    const series: Src = { id: 'E01', title: 'Z10 시리즈', text: '약 30분 만에 최대 69% 고속 충전됩니다.' };
    expect(verdicts(run(TITLE, BODY_69, [series], [FC_69]).gateOn)).toEqual(['69%:UNKNOWN']);
    expect(verdicts(run(TITLE, BODY_69, [], [FC_69]).gateOn)).toEqual(['69%:UNKNOWN']);
    // 본문이 서술과 다른 표현으로 써도(속성 창이 어미 차이로 갈려도) 서술의 값은 예전 동작(값 존재 지지)으로 새지 않는다
    const reworded = run(TITLE, '<p>Z10은 30분이면 배터리의 69%까지 채워진다고 합니다.</p>', [], [FC_69]);
    expect(reworded.gateOff.unsupported).toEqual([]);
    expect(verdicts(reworded.gateOn)).toEqual(['69%:UNKNOWN']);
    expect(reworded.filterOn.status).toBe('passed');   // 모호 — 지우지 않고
    expect(reworded.gateOn.unsupported).toContain('69%'); // 보류
  });
  test('충전기 45W ≠ 기기 충전 45W — 같은 모델 원문이라도 충전기 문장은 기기 충전의 근거가 아니다(같은 속성의 25W 와 모순)', () => {
    const src: Src = { id: 'E01', title: 'Z10 사양', text: '45W 충전기 보유 여부와 Z10의 유선 충전 기준은 구분해서 봐야 합니다. Z10은 25W 유선 충전을 지원합니다.', authority: OWNER };
    const ledger = buildVariantLedger({ title: TITLE, sources: [src] });
    const j = judgeVariantValue(ledger, sentenceUnit(ledger, 'Z10은 45W 유선 충전을 지원합니다.'), '45W');
    expect(j.verdict).toBe('CONTRADICTED');
    expect(j.reason).toMatch(/25W/);
    expect(judgeVariantValue(ledger, sentenceUnit(ledger, 'Z10은 25W 유선 충전을 지원합니다.'), '25W').verdict).toBe('SUPPORTED');
  });
  test('T9 원문 표가 Z10 = 55% 를 확인하면 지지 · 같은 표의 Z10 69% 는 모순', () => {
    const table = '<h1>Z10 | Z10+</h1><table><tr><th>구분</th><th>Z10</th><th>Z10+</th></tr><tr><td>30분 고속 충전</td><td>55%</td><td>69%</td></tr></table>';
    const src: Src = { id: 'E01', title: 'Z10 | Z10+', text: plain(table), html: table, authority: OWNER };
    expect(verdicts(run(TITLE, BODY_55, [src], [{ id: 'FACTCHECK1', text: 'Z10은 약 30분 만에 최대 55% 충전됩니다.' }]).gateOn)).toEqual(['55%:SUPPORTED']);
    expect(verdicts(run(TITLE, BODY_69, [src]).gateOn)).toEqual(['69%:CONTRADICTED']);
  });
});

describe('CROSS DOMAIN (T10~T12)', () => {
  test('T10 EV 스탠다드 / 롱레인지 — 롱레인지 가격을 스탠다드 값으로 쓰지 않음', () => {
    const src: Src = { id: 'E01', title: 'EV9 가격표', text: 'EV9 스탠다드 가격은 3,995만 원입니다. EV9 롱레인지 가격은 4,415만 원입니다.', authority: OWNER };
    const bad = run('EV9 스탠다드 구매 가이드', '<p>EV9 스탠다드 가격은 4,415만 원입니다.</p>', [src]);
    expect(bad.gateOff.unsupported).toEqual([]);
    expect(verdicts(bad.gateOn)).toEqual(['4,415만원:CONTRADICTED']);
    expect(bad.filterOn.status).toBe('blocked');
    const good = run('EV9 롱레인지 구매 가이드', '<p>EV9 롱레인지 가격은 4,415만 원입니다.</p>', [src]);
    expect(good.gateOn.unsupported).toEqual([]);
    expect(good.filterOn.status).toBe('passed');
  });
  test('T11 적금 일반형 / 우대형', () => {
    const src: Src = { id: 'E01', title: '청년 적금 안내', text: '일반형 기본 금리는 연 6%입니다. 우대형 기본 금리는 연 12%입니다.', authority: OWNER };
    const bad = run('청년 적금 일반형 금리', '<p>일반형 기본 금리는 연 12%입니다.</p>', [src]);
    expect(verdicts(bad.gateOn)).toEqual(['12%:CONTRADICTED']);
    expect(bad.filterOn.status).toBe('blocked');
    expect(run('청년 적금 우대형 금리', '<p>우대형 기본 금리는 연 12%입니다.</p>', [src]).filterOn.status).toBe('passed');
  });
  test('T12 Base / Pro / Max', () => {
    const src: Src = { id: 'E01', title: 'Laptop / Laptop Pro / Laptop Pro Max 가격', text: 'Laptop 가격은 149만 원입니다. Laptop Pro 가격은 199만 원입니다. Laptop Pro Max 가격은 249만 원입니다.', authority: OWNER };
    const bad = run('Laptop Pro 구매 가이드', '<p>Laptop Pro 가격은 249만 원입니다.</p>', [src]);
    expect(verdicts(bad.gateOn)).toEqual(['249만원:CONTRADICTED']);
    expect(bad.filterOn.status).toBe('blocked');
    expect(run('Laptop Pro Max 구매 가이드', '<p>Laptop Pro Max 가격은 249만 원입니다.</p>', [src]).gateOn.unsupported).toEqual([]);
    expect(run('Laptop 구매 가이드', '<p>Laptop 가격은 149만 원입니다.</p>', [src]).gateOn.unsupported).toEqual([]);
  });
});

describe('IT 저장 run 재생', () => {
  const ledgerOf = (title: string, items: any[], fc: string[]) => buildVariantLedger({
    title, sources: items.map((i: any) => ({ id: i.id, title: String(i.title || ''), text: String(i.cleanedText || '') })), prose: fc.map((t, k) => ({ id: `FACTCHECK${k + 1}`, text: t })),
  });
  test('f91a10 — 본문 "30분에 최대 69%" 는 팩트체크 서술에만 있다 → UNKNOWN, 본문 관문 실패(예전: 지지)', () => {
    const fc = factcheckWithLineage(`${F9.factcheck.text}\n\n[Verified source URLs]\n${F9.factcheck.urls.map((u: string) => `- ${u}`).join('\n')}`, [], distinctiveTokens(F9.title)).ledger.map((l) => l.text);
    const ledger = ledgerOf(F9.title, F9.items, fc);
    const legacy = ledgerFromItems([...F9.items.map((i: any) => ({ id: i.id, text: `${i.title} ${i.cleanedText}` })), ...fc.map((t: string, k: number) => ({ id: `FACTCHECK${k + 1}`, text: t }))]);
    const body = plain(F9.finalHtml);
    expect(checkClaims(body, legacy, NOW).unsupported).not.toContain('69%');
    const after = checkClaims(body, legacy, NOW, [], { ledger, units: bodyUnits(ledger, F9.finalHtml, F9.title) });
    expect(after.unsupported).toContain('69%');
    expect(after.variant!.filter((v) => v.claim === '69%').map((v) => v.verdict)).toEqual(expect.arrayContaining(['UNKNOWN']));
  });
  test('a4fc1b — 55% 도 팩트체크 서술에만 있다 → UNKNOWN(맞는 값이지만 원문 확인 불가) · 제목·소제목 4000mAh·45W 모순 유지', () => {
    const fc = factcheckWithLineage(A4.factcheckSupplement, [], distinctiveTokens(A4.keyword)).ledger.map((l) => l.text);
    const ledger = ledgerOf(A4.visible.title, A4.items, fc);
    const legacy = ledgerFromItems([...A4.items.map((i: any) => ({ id: i.id, text: `${i.title} ${i.cleanedText}` })), ...fc.map((t: string, k: number) => ({ id: `FACTCHECK${k + 1}`, text: t }))]);
    const after = checkClaims(plain(A4.finalHtml), legacy, NOW, [], { ledger, units: bodyUnits(ledger, A4.finalHtml, A4.visible.title) });
    expect(after.unsupported).toContain('55%');
    const title = checkTitleAuthority(A4.visible.title, A4.finalHtml, fc);
    expect(title.claims.filter((c) => c.verdict === 'CONTRADICTED').map((c) => c.claim).sort()).toEqual(['4000mAh', '45W']);
    expect(factualSurfaceGate(null, checkHeadingAuthority(A4.finalHtml, fc, A4.visible.title)).pass).toBe(false);
  });
});
