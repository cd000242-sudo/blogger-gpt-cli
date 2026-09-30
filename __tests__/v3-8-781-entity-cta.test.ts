/**
 * v3.8.781 — FINAL ENTITY SCOPE + CTA DESTINATION FIX (호출 0 · 새 검색 0)
 *
 * A. 값의 대상(문서·제도·상품) — "근거에 값이 있다" 만으로 다른 대상의 값을 지지하지 않는다(772 변형 축과 같은 관계·같은 판정·같은 행동)
 * B. CTA 목적지 — 대상·행동·목적지가 맞는 공식 행동 화면을 근거·본문에서 먼저 쓴다 · 확인 못 한 정확한 주소를 무관한 공식 페이지로 바꾸지 않는다
 */
const fs = require('fs');
const path = require('path');

import { buildVariantLedger, bodyUnits, judgeVariantValue, sentenceUnit, variantDeletes, variantHolds } from '../src/core/final/variant-ledger';
import { checkClaims, ledgerFromItems } from '../src/core/final/fact-claims';
import { inspectArticleFactIntegrity, type FactEvidence } from '../src/core/final/fact-integrity';
import { buildEntityContext, entitySubject, valueEntity, carriedTopics, entityRelation } from '../src/core/final/claim-entity';
import { evidenceActionCandidates, enforceCtaDestination, classifyCtaLiveness, isHardDead, candidateFits } from '../src/cta/cta-authority';
import { buildCtaCopy, siteNameFromUrl } from '../src/cta/cta-copy';
import { parseUserRequirements } from '../src/core/final/user-requirement';
import { checkUserRequirements, requirementGate } from '../src/core/final/user-requirement-coverage';

const NOW = new Date('2026-09-30T15:00:00+09:00');
const FX = path.join(__dirname, 'fixtures');
const LIVE = JSON.parse(fs.readFileSync(path.join(FX, 'run-776-508d55', 'run-inputs.json'), 'utf8'));
const ADMIN = JSON.parse(fs.readFileSync(path.join(FX, 'run-batch2-770', 'run-inputs.json'), 'utf8')).admin;
const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const plain = (h: string) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

type Src = { id: string; title: string; text: string; authority?: string; hasBody?: boolean };
function judge(title: string, sentence: string, value: string, sources: Src[], prose: Array<{ id: string; text: string }> = []) {
  const ledger = buildVariantLedger({ title, sources, prose });
  return judgeVariantValue(ledger, sentenceUnit(ledger, sentence), value);
}
function replay(fx: { items: any[]; packetText: string; finalHtml: string; draftBeforeFilter?: any }, title: string) {
  const sources = fx.items.map((i: any) => ({ id: i.id, title: String(i.title || ''), text: String(i.cleanedText || ''), authority: i.authority || (i.isOfficial ? 'PUBLIC_AUTHORITY_OFFICIAL' : undefined), hasBody: i.hasBody }));
  const prose = [{ id: 'PACKET', text: fx.packetText }];
  const on = buildVariantLedger({ title, sources, prose });
  const off = { ...on, entity: null };
  const legacy = ledgerFromItems([...sources.map((s) => ({ id: s.id, text: `${s.title} ${s.text}` })), ...prose]);
  const body = fx.finalHtml.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ');
  const gate = (l: typeof on) => checkClaims(plain(body), legacy, NOW, [], { ledger: l, units: bodyUnits(l, body, title) });
  const evidence: FactEvidence = { context: [...sources.map((s) => `${s.title}\n${s.text}`), fx.packetText].join('\n\n'), provider: 'test', trustLevel: 'strong', sourceUrls: fx.items.map((i: any) => i.url) };
  const filter = (l: typeof on) => (fx.draftBeforeFilter ? inspectArticleFactIntegrity(fx.draftBeforeFilter, { ...evidence, variant: { ledger: l } }).violations.map((v) => `${v.location}:${v.detail}`) : []);
  return { on, gateOn: gate(on), gateOff: gate(off), filterOn: filter(on), filterOff: filter(off) };
}
const liveTitle = LIVE.title;
const adminTitle = ((ADMIN.finalHtml.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || ADMIN.keyword).replace(/<[^>]+>/g, '').trim();

describe('A. 값의 대상(문서·제도·상품) — T1~T4', () => {
  const TITLE = '가나증명서 온라인 발급 수수료';
  const E01 = { id: 'E01', title: '가나증명서와 다라확인서 차이', text: '다라확인서는 신분증을 가지고 방문해 신청한다. 서명만 하면 발급받을 수 있고, 수수료는 2028년 12월 31일까지 면제된다. 가나증명서는 먼저 신고한 도장이 있어야 한다. 방문 발급은 대리인도 신청할 수 있으며, 수수료는 1통당 600원이다.' };

  test('T1 같은 출처·다른 대상의 값 → 지지 금지(VARIANT_MISMATCH · 본문 관문 보류) · 같은 기관 페이지라도 마찬가지', () => {
    const j = judge(TITLE, '웹 수수료는 2028년 12월 31일까지 면제입니다.', '2028년 12월 31일', [E01]);
    expect(j.verdict).toBe('VARIANT_MISMATCH');
    expect(j.reason).toContain('다라확인서');
    expect(variantHolds(j)).toBe(true);
    // 서드파티(뉴스·블로그)면 지우지 않고 보류, 1차 원문이 다른 대상의 값이라 말하면 사실 필터가 지운다(774 행동 그대로)
    expect(variantDeletes(j)).toBe(false);
    const primary = judge(TITLE, '웹 수수료는 2028년 12월 31일까지 면제입니다.', '2028년 12월 31일', [{ ...E01, authority: 'PUBLIC_AUTHORITY_OFFICIAL' }]);
    expect(variantDeletes(primary)).toBe(true);
  });
  test('T2 같은 대상·같은 속성·같은 값 → 지지', () => {
    expect(judge(TITLE, '방문 발급 수수료는 1통당 600원입니다.', '600원', [E01]).verdict).toBe('SUPPORTED');
    // 글이 스스로 다른 대상을 말하면 그 대상의 값으로 지지된다
    expect(judge(TITLE, '다라확인서 수수료는 2028년 12월 31일까지 면제입니다.', '2028년 12월 31일', [E01]).verdict).toBe('SUPPORTED');
  });
  test('T3 근거의 대상이 불분명 → 이 대상의 값으로 승격 금지(UNKNOWN · 보류) · 모순으로도 만들지 않는다', () => {
    const vague = { id: 'E02', title: '민원 수수료 모음', text: '온라인 신청 수수료는 1,500원이다.' };
    const j = judge(TITLE, '온라인 수수료는 1,500원입니다.', '1,500원', [E01, vague]);
    expect(j.verdict).toBe('UNKNOWN');
    expect(variantHolds(j)).toBe(true);
    expect(variantDeletes(j)).toBe(false);
    // LLM 서술(패킷)은 대상을 정하지 못한다 — 대상 없는 패킷 줄로 다른 대상의 값이 되살아나지 않는다
    const packet = judge(TITLE, '웹 수수료는 2028년 12월 31일까지 면제입니다.', '2028년 12월 31일', [E01], [{ id: 'PACKET', text: '2028년 12월 31일 — 수수료는 2028년 12월 31일까지 면제된다. [E01]' }]);
    expect(packet.verdict).toBe('VARIANT_MISMATCH');
  });
  test('비활성: 근거에 다른 대상이 없으면 예전 동작(값 존재) · 사양값(kWh)은 774 그대로', () => {
    const only = { id: 'E01', title: '가나증명서 발급', text: '가나증명서는 방문 수수료가 600원이다.' };
    expect(buildVariantLedger({ title: TITLE, sources: [only] }).entity?.active).toBe(false);
    expect(judge(TITLE, '수수료는 600원입니다.', '600원', [only]).verdict).toBe('NOT_APPLICABLE');
    const kwh = judge('주택용 전기요금 계산', '사용량은 400kWh입니다.', '400kWh', [{ id: 'E01', title: '요금표', text: '주택용은 400kWh까지 2단계다. 산업용은 계약전력 기준이다.' }]);
    expect(kwh.verdict).toBe('NOT_APPLICABLE');
  });
  test('주제·대상 판정은 모양만 본다 — 이음 꼴(위해서)은 대상이 아님 · 납작해진 표 머리는 모호', () => {
    expect(entitySubject('인감증명서 온라인 발급 가능한 용도 대리인 발급 여부')).toBe('인감증명서');
    const ctx = buildEntityContext('가나증명서 발급', ['다라확인서는 방문한다.', '발급받기 위해서는 신분증이 필요하다.'])!;
    expect([...ctx.entities]).toEqual(['가나증명서', '다라확인서']);
    expect(valueEntity(ctx, '항목 가나증명서 다라확인서 방문 수수료 600원 면제', 30, '')).toBe('*');
    expect(carriedTopics(ctx, ['다라확인서는 방문한다.', '수수료는 면제다.', '가나증명서는 도장이 필요하다.', '수수료는 600원이다.'])).toEqual(['', '다라확인서', '다라확인서', '가나증명서']);
    expect(entityRelation('가나증명서', '*')).toBe('AMBIGUOUS');
    expect(entityRelation('가나증명서', '')).toBe('UNKNOWN');
    // 제품 코드에 두 서류 이름을 박지 않는다
    const src = read('src/core/final/claim-entity.ts') + read('src/cta/cta-authority.ts') + read('src/core/final/variant-ledger.ts');
    expect(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')).not.toMatch(/인감증명서|본인서명사실확인서|정부24|gov\.kr\/main/);
  });

  test('T4 실제 인감증명서 run 508d55 재생 — 2028년 면제·승인 4년(다른 서류의 값) 차단, 인감증명서 사실 600원은 유지', () => {
    const r = replay(LIVE, liveTitle);
    expect(r.on.entity?.subject).toBe('인감증명서');
    expect(r.gateOff.unsupported).toEqual([]);                                   // BEFORE: 전부 통과했다
    expect(r.gateOn.unsupported.sort()).toEqual(['2028년 12월 31일', '4년간']);   // AFTER: 두 값이 보류된다
    const v = (claim: string) => (r.gateOn.variant || []).find((x) => x.claim === claim)!;
    expect(v('2028년 12월 31일')).toMatchObject({ verdict: 'VARIANT_MISMATCH' });
    expect(v('2028년 12월 31일').reason).toContain('본인서명사실확인서');
    expect(v('4년간')).toMatchObject({ verdict: 'VARIANT_MISMATCH' });
    expect(v('4년간').reason).toContain('전자본인서명확인서');
    expect(v('600원')).toMatchObject({ verdict: 'SUPPORTED' });
    // 사실 필터는 서드파티 근거라 지우지 않는다(보류로 사람 확인) — 새로 생긴 삭제 0
    expect(r.filterOn.filter((x) => !r.filterOff.includes(x))).toEqual([]);
  });
  test('T4 회귀: 같은 주제의 예전 정상 run(48417f) — 새 보류·새 삭제 0', () => {
    const r = replay(ADMIN, adminTitle);
    expect(r.gateOn.unsupported).toEqual(r.gateOff.unsupported);
    expect(r.filterOn.filter((x) => !r.filterOff.includes(x))).toEqual([]);
  });
});

describe('A. 교차 도메인 — 다른 대상의 값은 지지 금지', () => {
  test('보험: 특약 A 한도 → 특약 B 지지 금지', () => {
    const src = [{ id: 'E01', title: '암진단특약 보장 안내', text: '뇌졸중진단특약은 최대 2,000만원까지 보장한다. 암진단특약은 최대 3,000만원까지 보장한다.' }];
    expect(judge('암진단특약 보장 한도', '최대 2,000만원까지 보장합니다.', '2,000만원', src).verdict).toBe('VARIANT_MISMATCH');
    expect(judge('암진단특약 보장 한도', '최대 3,000만원까지 보장합니다.', '3,000만원', src).verdict).toBe('SUPPORTED');
  });
  test('행정: 서류 A 값 → 서류 B 지지 금지(주제 이어받기)', () => {
    const src = [{ id: 'E01', title: '가족관계증명서 발급', text: '기본증명서는 본인만 신청할 수 있다. 수수료는 1,000원이다. 가족관계증명서는 대리 신청이 된다. 수수료는 500원이다.' }];
    expect(judge('가족관계증명서 발급 수수료', '수수료는 1,000원입니다.', '1,000원', src).verdict).toBe('VARIANT_MISMATCH');
    expect(judge('가족관계증명서 발급 수수료', '수수료는 500원입니다.', '500원', src).verdict).toBe('SUPPORTED');
  });
  test('자동차·IT: 트림·모델 축(772)은 그대로 — 트림 A 값 → 트림 B, 모델 A 사양 → 모델 B 지지 금지', () => {
    const ev = [{ id: 'E01', title: 'EV3 스탠다드 · 롱레인지', text: 'EV3 스탠다드 주행거리는 350km이다. EV3 롱레인지 주행거리는 501km이다.', authority: 'SUBJECT_OWNER_PRIMARY' }];
    // 1차 원문이 같은 트림의 다른 값(501km)을 말하므로 모순 — 다른 트림 값으로는 지지되지 않는다
    expect(judge('EV3 롱레인지 주행거리', 'EV3 롱레인지 주행거리는 350km입니다.', '350km', ev).verdict).toBe('CONTRADICTED');
    expect(judge('EV3 롱레인지 주행거리', 'EV3 롱레인지 주행거리는 350km입니다.', '350km', [{ ...ev[0]!, text: 'EV3 스탠다드 주행거리는 350km이다.' }]).verdict).toBe('VARIANT_MISMATCH');
    const it = [{ id: 'E01', title: 'Galaxy S26 | S26+', text: 'S26+ 배터리는 4,900mAh이다. S26 배터리는 4,300mAh이다.', authority: 'SUBJECT_OWNER_PRIMARY' }];
    expect(judge('갤럭시 S26 배터리', 'S26 배터리는 4,900mAh입니다.', '4,900mAh', it).verdict).toBe('CONTRADICTED');
    expect(judge('갤럭시 S26 배터리', 'S26 배터리는 4,900mAh입니다.', '4,900mAh', [{ ...it[0]!, text: 'S26+ 배터리는 4,900mAh이다.' }]).verdict).toBe('VARIANT_MISMATCH');
  });
});

describe('B. CTA 목적지 — T5~T9', () => {
  const kw = LIVE.keyword;
  const sources = [
    ...LIVE.items.map((i: any) => ({ url: i.url, title: i.title, text: String(i.cleanedText || '').slice(0, 600), official: !!i.isOfficial, via: 'evidence' as const })),
    ...[...LIVE.finalHtml.matchAll(/<a\b[^>]*href="(https?:[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map((m: RegExpMatchArray) => ({ url: m[1]!.replace(/&amp;/g, '&'), title: String(m[2]).replace(/<[^>]+>/g, ' ').trim(), official: /(?:^|\.)gov\.kr$|\.go\.kr$/.test(new URL(m[1]!.replace(/&amp;/g, '&')).hostname), via: 'body' as const })),
  ];
  const E04 = 'https://www.gov.kr/main?a=AA020InfoCappViewApp&CappBizCD=13100000025';
  const BENEFIT = { url: 'https://plus.gov.kr/portal/benefitV2/', buttonText: '🔗 정부24에서 조회 안내 확인', hookingMessage: '조회 안내' };
  const exact = (u: string) => { const hit = LIVE.items.find((i: any) => i.url === u); return hit ? { title: hit.title, text: String(hit.cleanedText || '').slice(0, 600) } : undefined; };
  const relabel = (cta: typeof BENEFIT, cand: { url: string }) => { const c = buildCtaCopy({ url: cand.url, siteName: siteNameFromUrl(cand.url), action: '발급', actionStatus: 'UNKNOWN' }); return { ...cta, url: cand.url, buttonText: `🔗 ${c.buttonText}`, hookingMessage: c.hookingMessage }; };

  test('T5 근거에 정확한 공식 행동 주소(E04 "인감증명서 발급 바로가기") → 첫 후보 · 본문 링크는 같은 주소라 한 번만', () => {
    const cands = evidenceActionCandidates({ keyword: kw, title: LIVE.title, action: '발급', sources });
    expect(cands.map((c) => c.url)).toEqual([E04]);
    expect(cands[0]!.via).toBe('evidence');
  });
  test('T6 공식 도메인이라도 행동·대상이 다르면 거절 — 발급사실 통보(E03) · 다른 서류(E05·E06) · 정책 뉴스(E14) · 확인 안 된 혜택 조회 포털', () => {
    const byId = (id: string) => LIVE.items.find((i: any) => i.id === id);
    for (const id of ['E03', 'E05', 'E06', 'E14']) expect(candidateFits(kw, '발급', { url: byId(id).url, title: byId(id).title, text: String(byId(id).cleanedText).slice(0, 600) })).toBe(false);
    expect(candidateFits(kw, '발급', { url: E04, title: '인감증명서 발급 바로가기' })).toBe(true);
    const r = enforceCtaDestination({ ctas: [BENEFIT], keyword: kw, title: LIVE.title, action: '발급', required: true, candidates: evidenceActionCandidates({ keyword: kw, title: LIVE.title, action: '발급', sources }), lookup: exact, relabel });
    expect(r.ctas.map((c) => c.url)).toEqual([E04]);
    expect(r.changes[0]).toMatchObject({ kind: 'REPLACED', from: BENEFIT.url, to: E04 });
  });
  test('T7 정확한 주소의 생존 확인이 UNKNOWN(세션·로그인·HEAD 거부·시간 초과) → 죽음 아님 · 무관한 공식 페이지로 바꾸지 않는다', () => {
    expect(['session-bound-url', 'http-403', 'http-405', 'timeout', 'redirect-to-error', 'error-content'].map((reason) => isHardDead(classifyCtaLiveness({ isValid: false, reason })))).toEqual([false, false, false, false, false, false]);
    expect(classifyCtaLiveness({ isValid: false, reason: 'session-bound-url' })).toBe('AUTH_REQUIRED');
    expect(isHardDead(classifyCtaLiveness({ isValid: false, reason: 'http-404' }))).toBe(true);
    // 이미 정확한 주소를 가진 CTA 는 생존 확인과 무관하게 그대로(교체 없음)
    const keep = enforceCtaDestination({ ctas: [{ ...BENEFIT, url: E04 }], keyword: kw, title: LIVE.title, action: '발급', required: true, candidates: evidenceActionCandidates({ keyword: kw, title: LIVE.title, action: '발급', sources }), lookup: exact, relabel });
    expect(keep.changes).toEqual([]);
    // 검색 경로도: 확인 못 한 후보라도 제목이 대상·행동과 맞으면 남긴다(generation.ts 생존 루프)
    const gen = read('src/core/final/generation.ts');
    expect(gen).toContain('if (!isHardDead(liveness) && actionIntent && candidateFits(keyword, String(actionIntent), { url: c.url, title: c.title })) {');
    expect(candidateFits(kw, '발급', { url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13100000025', title: '인감증명서 발급 | 민원안내 및 신청 | 정부24' })).toBe(true);
  });
  test('T8 정확한 CTA 를 못 찾음 + 작성자 필수 → CTA 를 뺀다(잘못된 CTA 대신) → 요구 MISSING → 보류', () => {
    const r = enforceCtaDestination({ ctas: [BENEFIT], keyword: kw, title: LIVE.title, action: '발급', required: true, candidates: [], lookup: exact, relabel });
    expect(r.ctas).toEqual([]);
    expect(r.changes[0]).toMatchObject({ kind: 'DROPPED', from: BENEFIT.url });
    const contract = parseUserRequirements('정부24 공식 발급 페이지로 연결되는 CTA를 넣어주세요.');
    const res = checkUserRequirements(contract, { html: '<p>본문</p>' });
    expect(res[0]!.status).toBe('MISSING');
    expect(requirementGate(res).pass).toBe(false);
    // 필수가 아니면 예전처럼 둔다(후보가 없을 때)
    expect(enforceCtaDestination({ ctas: [BENEFIT], keyword: kw, title: LIVE.title, action: '발급', required: false, candidates: [], lookup: exact }).ctas).toEqual([BENEFIT]);
  });
  test('T9 작성자 MUST CTA 불일치 → PUBLISH_HELD(요구 관문) · 권위 적용 뒤에는 COVERED', () => {
    const contract = parseUserRequirements('정부24 공식 발급 페이지로 연결되는 CTA를 넣어주세요.');
    const before = checkUserRequirements(contract, { html: `<a class="cta-btn" href="${BENEFIT.url}">${BENEFIT.buttonText}</a>` });
    expect(before[0]!.status).toBe('CONTRADICTED');
    expect(requirementGate(before).pass).toBe(false);
    const fixed = enforceCtaDestination({ ctas: [BENEFIT], keyword: kw, title: LIVE.title, action: '발급', required: true, candidates: evidenceActionCandidates({ keyword: kw, title: LIVE.title, action: '발급', sources }), lookup: exact, relabel }).ctas[0]!;
    const after = checkUserRequirements(contract, { html: `<a class="cta-btn" href="${fixed.url}">${fixed.buttonText}</a>` });
    expect(after[0]!.status).toBe('COVERED');
  });
  test('교차 도메인 CTA — 정책 뉴스·보험 상품 소개·관광청 홈·다른 모델 구매 페이지는 행동·대상 불일치', () => {
    const t = (k: string, a: string, title: string, url: string) => candidateFits(k, a, { url, title });
    expect(t('청년도약계좌 신청 방법', '신청', '청년도약계좌 신청 안내', 'https://www.korea.kr/news/policyNewsView.do?newsId=1')).toBe(false);
    expect(t('청년도약계좌 신청 방법', '신청', '청년도약계좌 가입 신청', 'https://ylaccount.kinfa.or.kr/apply')).toBe(true);
    expect(t('암보험 보험금 청구 방법', '청구', '암보험 상품 소개', 'https://www.samsunglife.com/product/1')).toBe(false);
    expect(t('암보험 보험금 청구 방법', '청구', '암보험 보험금 청구하기', 'https://www.samsunglife.com/claim')).toBe(true);
    expect(t('제주도 숙소 예약', '예약', '제주관광공사', 'https://www.visitjeju.net/')).toBe(false);
    expect(t('갤럭시 S26 구매 방법', '구매', '갤럭시 S25 구매하기', 'https://www.samsung.com/sec/buy/s25')).toBe(false);
    expect(t('갤럭시 S26 구매 방법', '구매', '갤럭시 S26+ 구매하기', 'https://www.samsung.com/sec/buy/s26p')).toBe(false);
    expect(t('갤럭시 S26 구매 방법', '구매', '갤럭시 S26 구매하기', 'https://www.samsung.com/sec/buy/s26')).toBe(true);
  });
  test('배선: 자동 CTA 뒤에 권위 적용 · 필수 행동은 작성자 계약에서 · 내 블로그 CTA 는 건드리지 않음 · 새 검색 0', () => {
    const orch = read('src/core/final/orchestration.ts');
    const block = orch.slice(orch.indexOf("const authority = require('../../cta/cta-authority');"), orch.indexOf('// CTA 배치'));
    expect(block).toContain("const requiredAction = userPlan.cta.explicit && userPlan.cta.enabled ? String(userPlan.cta.action || '') : '';");
    expect(block).toContain('ctas: ctas.filter((c) => !ownBlog(String(c.url || ""))), keyword'.replace('""', "''"));
    expect(block).toContain("trace.event('cta.authority'");
    expect(block).not.toMatch(/search|fetch\(|callGemini/);
    expect(read('src/cta/cta-authority.ts')).not.toMatch(/fetch\(|axios|naverSearch|callGemini/);
  });
});
