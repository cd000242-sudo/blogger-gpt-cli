const fs = require('fs');
const path = require('path');

import { checkTitleAuthority, authorityClaims, authoritySentences } from '../src/core/final/title-authority';
import { checkHeadingAuthority, factualSurfaceGate } from '../src/core/final/factual-surface';
import { factcheckWithLineage } from '../src/core/final/content-provenance';
import { distinctiveTokens } from '../src/core/final/evidence';
import { anchorsFrom, labelsOf, scopeHtml, valueScope, variantRelation, describeScope, variantMentions } from '../src/core/final/claim-variant';

/*
 * v3.8.772 — ENTITY VARIANT SCOPE BINDING. 같은 제품군 안의 모델·트림·유형·회차 값을 섞지 않는다. 호출 0회.
 * S26 픽스처는 공식 시리즈 페이지의 **문맥 구조**(시리즈 제목 · 상단 일반 문장 + 각주 · 모델별 비교표)를 합성한 것이다 — 값은 테스트 안에만 있다.
 */
const B2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'run-batch2-770', 'run-inputs.json'), 'utf8'));
const IT = B2.it;

/** 문서 한 장(제목 = 문서 이름표)을 권위로 두고 한 줄을 잰다 */
const against = (line: string, pageHtml: string) => {
  const anchors = anchorsFrom([line], labelsOf(pageHtml));
  return authorityClaims(line, scopeHtml(pageHtml, { anchors }), { anchors });
};
const verdict = (line: string, pageHtml: string, v: string) => against(line, pageHtml).find((c) => c.claim === v)!;
/** 모델 축이 없던 예전 판정(문자열 권위) — BEFORE 기록용 */
const before = (line: string, pageHtml: string, v: string) => authorityClaims(line, authoritySentences(pageHtml)).find((c) => c.claim === v)!;

const PRODUCT_PAGE = [
  '<h1>Product A | Product A+</h1>',
  '<p>약 30분 최대 69% 고속 충전*</p>',
  '<p>* Product A+에만 적용됩니다.</p>',
  '<table><tr><th>구분</th><th>Product A</th><th>Product A+</th></tr>',
  '<tr><td>30분 고속 충전</td><td>55%</td><td>69%</td></tr>',
  '<tr><td>표준 배터리</td><td>4,300mAh</td><td>4,900mAh</td></tr></table>',
].join('');

const S26_PAGE = [
  '<h1>갤럭시 S26 | S26+</h1>',
  '<p>고속 유선 충전으로 약 30분 만에 최대 69% 충전*</p>',
  '<p>* 갤럭시 S26+에만 해당합니다.</p>',
  '<table><tr><th>사양</th><th>갤럭시 S26</th><th>갤럭시 S26+</th></tr>',
  '<tr><td>표준 배터리 용량</td><td>4,300mAh</td><td>4,900mAh</td></tr>',
  '<tr><td>정격 배터리 용량</td><td>4,175mAh</td><td>-</td></tr>',
  '<tr><td>30분 고속 충전</td><td>최대 55%</td><td>최대 69%</td></tr>',
  '<tr><td>유선 충전 어댑터</td><td>25W</td><td>45W</td></tr></table>',
].join('');

describe('VARIANT SCOPE (T1~T8)', () => {
  test('T1 같은 제품군·같은 속성·다른 변형 → 지지 아님', () => {
    const page = '<h1>Product A | Product A+</h1><p>Product A+는 약 30분 최대 69% 고속 충전을 지원합니다.</p>';
    expect(before('Product A 30분 최대 69% 고속 충전', page, '69%').verdict).toBe('SUPPORTED'); // BEFORE: 같은 값·속성이면 지지
    const c = verdict('Product A 30분 최대 69% 고속 충전', page, '69%');
    expect(c.verdict).not.toBe('SUPPORTED');
    expect(c.variant).toBe('product a');
    expect(c.variantExcluded?.[0]).toMatch(/product a\+/);
  });
  test('T2 같은 변형·속성 + 같은 값 → 지지', () => {
    expect(verdict('Product A 30분 최대 55% 고속 충전', PRODUCT_PAGE, '55%').verdict).toBe('SUPPORTED');
    expect(verdict('Product A 표준 배터리 4,300mAh', PRODUCT_PAGE, '4,300mAh').verdict).toBe('SUPPORTED');
  });
  test('T3 같은 변형·속성 + 다른 값 → 모순', () => {
    const c = verdict('Product A 30분 최대 69% 고속 충전', PRODUCT_PAGE, '69%');
    expect(c.verdict).toBe('CONTRADICTED');
    expect(verdict('Product A 표준 배터리 4,900mAh', PRODUCT_PAGE, '4,900mAh').verdict).toBe('CONTRADICTED');
  });
  test('T4 페이지 제목(시리즈)만 같음 → 이름 없는 값을 두 변형 공통으로 올리지 않음(PAGE_ENTITY ≠ CLAIM_ENTITY)', () => {
    const series = '<h1>Product A | Product A+</h1><p>표준 배터리 용량은 4,300mAh입니다.</p>';
    expect(before('Product A 표준 배터리 4,300mAh', series, '4,300mAh').verdict).toBe('SUPPORTED');
    const c = verdict('Product A 표준 배터리 4,300mAh', series, '4,300mAh');
    expect(c.verdict).toBe('UNCHECKED'); // 지지도 모순도 아님 — 모호
    expect(c.variantExcluded?.[0]).toMatch(/모호/);
    // 한 모델 페이지면 그 모델의 값이다
    expect(verdict('Product A 표준 배터리 4,300mAh', '<h1>Product A 사양</h1><p>표준 배터리 용량은 4,300mAh입니다.</p>', '4,300mAh').verdict).toBe('SUPPORTED');
    // 시리즈 이름("S26 시리즈")도 한 모델이 아니다
    expect(verdict('갤럭시 S26 표준 배터리 4,300mAh', '<h1>갤럭시 S26 시리즈</h1><p>표준 배터리 용량은 4,300mAh입니다.</p>', '4,300mAh').verdict).toBe('UNCHECKED');
  });
  test('T5 각주 "Product A+에만 적용" → 바로 앞 값이 Plus 범위를 이어받음', () => {
    const anchors = anchorsFrom(['Product A 30분 최대 69% 고속 충전'], labelsOf(PRODUCT_PAGE));
    const units = scopeHtml(PRODUCT_PAGE, { anchors });
    const top = units.find((u) => u.s.startsWith('약 30분'))!;
    expect(valueScope(top, top.s.indexOf('69%'))).toMatchObject({ via: 'footnote', keys: [{ name: 'product a', trim: '+' }] });
    // 표지 없는 각주 문장도 바로 앞 값에 붙는다
    const plainNote = scopeHtml('<h1>Product A | Product A+</h1><p>약 30분 최대 69% 고속 충전</p><p>Product A+에만 해당합니다.</p>', { anchors });
    expect(valueScope(plainNote[0]!, plainNote[0]!.s.indexOf('69%')).label).toBe('product a+');
  });
  test('T6 비교표 열 머리 범위 유지 · 행 머리 범위', () => {
    const anchors = anchorsFrom(['Product A'], labelsOf(PRODUCT_PAGE));
    const row = scopeHtml(PRODUCT_PAGE, { anchors }).find((u) => u.s.startsWith('30분 고속 충전'))!;
    expect(valueScope(row, row.s.indexOf('55%'))).toMatchObject({ via: 'column', label: 'product a' });
    expect(valueScope(row, row.s.indexOf('69%'))).toMatchObject({ via: 'column', label: 'product a+' });
    const byRow = '<h1>Product A | Product A+</h1><table><tr><th>모델</th><th>30분 고속 충전</th></tr><tr><td>Product A</td><td>55%</td></tr><tr><td>Product A+</td><td>69%</td></tr></table>';
    expect(verdict('Product A 30분 최대 55% 고속 충전', byRow, '55%').verdict).toBe('SUPPORTED');
    expect(verdict('Product A 30분 최대 69% 고속 충전', byRow, '69%').verdict).toBe('CONTRADICTED');
  });
  test('T7 "모두 · 공통 · 와/과" 로 명시하면 두 변형에 적용', () => {
    const both = '<h1>Product A | Product A+</h1><p>Product A와 Product A+ 모두 25W 고속 충전을 지원합니다.</p>';
    expect(verdict('Product A 25W 고속 충전', both, '25W').verdict).toBe('SUPPORTED');
    expect(verdict('Product A+ 25W 고속 충전', both, '25W').verdict).toBe('SUPPORTED');
    const coordinated = '<h1>Product A | Product A+</h1><p>Product A와 Product A+는 25W 고속 충전을 지원합니다.</p>';
    expect(verdict('Product A 25W 고속 충전', coordinated, '25W').verdict).toBe('SUPPORTED');
    // 나란히 적지 않고 각자 값을 말하면 공통이 아니다
    const each = '<h1>Product A | Product A+</h1><p>Product A는 25W, Product A+는 45W 고속 충전입니다.</p>';
    expect(verdict('Product A 45W 고속 충전', each, '45W').verdict).not.toBe('SUPPORTED');
  });
  test('T8 팩트체크 공식 주소도 변형 범위가 필요 — 주소에 모델 이름이 있어도 문단이 다른 변형을 말하면 지지 아님', () => {
    const ctx = '갤럭시 S26+는 고속 유선 충전으로 약 30분 만에 최대 69% 충전됩니다.\n\n[Verified source URLs]\n- https://www.samsung.com/sec/smartphones/galaxy-s26/specs/';
    const fc = factcheckWithLineage(ctx, [], ['s26']);
    expect(fc.ledger[0]!.text).toMatch(/69%/); // 장부 글자는 그대로(770 장부 일치)
    expect(fc.ledger[0]!.scope).toMatchObject({ document: 's26+' });
    const title = '갤럭시 S26 고속 유선 충전 30분 최대 69%';
    const r = checkTitleAuthority(title, '<p>이 글은 갤럭시 S26 을 다룹니다.</p>', fc.ledger.map((l) => l.text));
    expect(r.claims.find((c) => c.claim === '69%')!.verdict).not.toBe('SUPPORTED');
    // 주소만 모델을 말하고 문단은 말하지 않으면 변형을 정하지 않는다(NONE) — 주소가 공식이라는 이유로 S26 으로 승격하지 않음
    expect(describeScope('약 30분 만에 최대 69% 충전됩니다. [출처] https://www.samsung.com/sec/smartphones/galaxy-s26-ultra/buy/').document).toBe('NONE');
    expect(variantMentions('https://www.samsung.com/sec/smartphones/galaxy-s26-ultra/buy/', anchorsFrom(['갤럭시 S26']))).toEqual([]);
  });
});

describe('S26 공식 페이지 문맥 구조 (T9~T11 · 25W/45W · mAh)', () => {
  test('T9 S26 30분 69% → 지지 차단(각주·S26+ 열) · 같은 모델 55% 와 모순', () => {
    expect(before('갤럭시 S26 30분 최대 69% 고속 충전', S26_PAGE, '69%').verdict).toBe('SUPPORTED'); // BEFORE
    const c = verdict('갤럭시 S26 30분 최대 69% 고속 충전', S26_PAGE, '69%');
    expect(c.verdict).toBe('CONTRADICTED');
    expect(c.variant).toBe('s26');
    expect(c.variantExcluded!.join(' ')).toMatch(/s26\+/);
  });
  test('T10 S26 30분 55% → 지지', () => {
    expect(verdict('갤럭시 S26 30분 최대 55% 고속 충전', S26_PAGE, '55%').verdict).toBe('SUPPORTED');
  });
  test('T11 S26+ 30분 69% → 지지', () => {
    expect(verdict('갤럭시 S26+ 30분 최대 69% 고속 충전', S26_PAGE, '69%').verdict).toBe('SUPPORTED');
  });
  test('25W vs 45W — 어댑터 행의 S26 열은 25W, S26+ 열은 45W', () => {
    expect(verdict('갤럭시 S26 25W 유선 충전', S26_PAGE, '25W').verdict).toBe('SUPPORTED');
    expect(verdict('갤럭시 S26 45W 유선 충전', S26_PAGE, '45W').verdict).toBe('CONTRADICTED');
    expect(verdict('갤럭시 S26+ 45W 유선 충전', S26_PAGE, '45W').verdict).toBe('SUPPORTED');
  });
  test('4,300 / 4,175mAh 는 S26, 4,900mAh 는 S26+ — 다른 모델 값은 S26 에 쓰지 않는다', () => {
    expect(verdict('갤럭시 S26 배터리 4,300mAh', S26_PAGE, '4,300mAh').verdict).toBe('SUPPORTED');
    expect(verdict('갤럭시 S26 배터리 4,175mAh', S26_PAGE, '4,175mAh').verdict).toBe('SUPPORTED');
    expect(verdict('갤럭시 S26 배터리 4,900mAh', S26_PAGE, '4,900mAh').verdict).toBe('CONTRADICTED');
    expect(verdict('갤럭시 S26+ 배터리 4,900mAh', S26_PAGE, '4,900mAh').verdict).toBe('SUPPORTED');
  });
  test('소제목도 같은 축 — S26 글의 소제목 "30분 최대 69% 고속 충전" 은 표면 관문에서 보류', () => {
    const article = `<h1>갤럭시 S26 충전 속도</h1><h2>30분 최대 69% 고속 충전</h2>${S26_PAGE.replace(/<h1>[\s\S]*?<\/h1>/, '')}`;
    const headings = checkHeadingAuthority(article, [], '갤럭시 S26 충전 속도');
    expect(headings[0]!.claims.find((c) => c.claim === '69%')).toMatchObject({ verdict: 'CONTRADICTED', variant: 's26' });
    expect(factualSurfaceGate(null, headings).pass).toBe(false);
  });
});

describe('교차 도메인 (T12~T13)', () => {
  test('T12 EV3 스탠다드 / 롱레인지 — 롱레인지 501km 를 스탠다드 값으로 쓰지 않음', () => {
    const ev = '<h1>EV3 스탠다드 · 롱레인지</h1><p>EV3 롱레인지의 1회 충전 주행거리는 501km입니다.</p><p>스탠다드 모델의 1회 충전 주행거리는 350km입니다.</p>';
    expect(verdict('EV3 스탠다드 주행거리 501km', ev, '501km').verdict).toBe('CONTRADICTED');
    expect(verdict('EV3 스탠다드 주행거리 350km', ev, '350km').verdict).toBe('SUPPORTED');
    expect(verdict('EV3 롱레인지 주행거리 501km', ev, '501km').verdict).toBe('SUPPORTED');
  });
  test('T13 적금 일반형 / 우대형 · 지원금 1차 / 2차 · Laptop Pro / Pro Max', () => {
    const ins = '<h1>OO 적금 일반형·우대형</h1><p>일반형 기본 금리는 연 6%입니다.</p><p>우대형 기본 금리는 연 12%입니다.</p>';
    expect(verdict('OO 적금 일반형 금리 12%', ins, '12%').verdict).toBe('CONTRADICTED');
    expect(verdict('OO 적금 우대형 금리 12%', ins, '12%').verdict).toBe('SUPPORTED');
    const rounds = '<h1>청년 지원금 모집 안내</h1><p>1차 모집 지원금은 300만 원입니다.</p><p>2차 모집 지원금은 200만 원입니다.</p>';
    expect(verdict('2차 모집 지원금 300만 원', rounds, '300만원').verdict).toBe('CONTRADICTED');
    expect(verdict('2차 모집 지원금 200만 원', rounds, '200만원').verdict).toBe('SUPPORTED');
    const laptop = '<h1>Laptop Pro / Laptop Pro Max</h1><p>Laptop Pro Max 배터리는 최대 22시간 지속됩니다.</p><p>Laptop Pro 배터리는 최대 18시간 지속됩니다.</p>';
    expect(verdict('Laptop Pro 배터리 22시간', laptop, '22시간').verdict).toBe('CONTRADICTED');
    expect(verdict('Laptop Pro Max 배터리 22시간', laptop, '22시간').verdict).toBe('SUPPORTED');
  });
  test('모델 이름 모양이 아닌 코드(IP68 · Qi2)는 변형이 아니다 — 주장에 없는 규격 이름으로 지지를 끊지 않음', () => {
    const doc = '<h1>갤럭시 S26 사양</h1><p>IP68 방수와 표준 배터리 4,300mAh를 갖췄습니다.</p>';
    expect(verdict('갤럭시 S26 배터리 4,300mAh', doc, '4,300mAh').verdict).toBe('SUPPORTED');
  });
  test('주장에 변형이 없으면 예전 동작(UNKNOWN) — 새 보류를 만들지 않음', () => {
    expect(variantRelation({ keys: [], via: 'none', label: '' }, { keys: [{ name: 's26', trim: '+' }], via: 'sentence', label: 's26+' })).toBe('UNKNOWN');
    expect(verdict('배터리 4,900mAh 정리', S26_PAGE, '4,900mAh').verdict).toBe('SUPPORTED');
  });
});

describe('GENERALIZATION', () => {
  test('새 모듈에 회사·모델·값 이름이 없다 — 모양(코드·트림)과 문서 구조만 본다', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', 'claim-variant.ts'), 'utf8').replace(/\/\*\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    expect(src).not.toMatch(/samsung|galaxy|갤럭시|S26|EV3|kia|기아|4,?300|4,?175|4,?900|69\s*%|55\s*%|45W|25W|501|350km/i);
  });
});

describe('T14 회귀 — 771 IT a4fc1b 저장 run', () => {
  const FC = factcheckWithLineage(IT.factcheckSupplement, [], distinctiveTokens(IT.keyword));
  test('제목 4000mAh · 45W 는 여전히 모순(같은 S26 범위의 4300mAh · 25W)', () => {
    const r = checkTitleAuthority(IT.visible.title, IT.finalHtml, FC.ledger.map((l) => l.text));
    expect(r.claims.filter((c) => c.verdict === 'CONTRADICTED').map((c) => c.claim).sort()).toEqual(['4000mAh', '45W']);
  });
  test('소제목 "4000mAh 45W 충전 성능" 도 여전히 모순 · 팩트체크 문단 범위는 S26', () => {
    const h = checkHeadingAuthority(IT.finalHtml, FC.ledger.map((l) => l.text), IT.visible.title);
    expect(factualSurfaceGate(null, h).pass).toBe(false);
    expect(FC.ledger[0]!.scope.document).toBe('s26');
  });
});
