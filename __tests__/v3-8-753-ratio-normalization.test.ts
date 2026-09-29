const fs = require('fs');
const path = require('path');

import { inspectFactIntegrity, sanitizeFactUnsafeHtml, type FactEvidence } from '../src/core/final/fact-integrity';
import { normalizeForMatch, containsValueToken } from '../src/core/final/number-token';
import { blockBetween } from './helpers/source-block';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const FX = JSON.parse(read('__tests__/fixtures/run-1b7d92/evidence-and-packet.json'));

/** 실제 run 의 근거 장부와 같은 표기 — 근거는 "12%" 로 쓴다 */
const EVIDENCE: FactEvidence = {
  provider: 'Naver Grounding', trustLevel: 'weak', topic: '청년미래적금 VS 청년 도약계좌',
  context: [
    '청년미래적금은 3년 동안 매월 최대 50만원을 납입하면 정부가 기여금을 지원한다.',
    '청년미래적금 일반형에는 납입액의 6%, 중소기업 재직자와 신규 취업자 소상공인 등 우대형에는 12%의 기여금이 지급된다.',
    '청년도약계좌는 만기 5년 동안 매월 70만 원 한도 내에서 저축하면 매월 최대 6%의 정부 기여금을 받을 수 있는 상품이다.',
    '2차 가입 신청은 10월 7일부터 16일까지다.',
  ].join(' '),
};
const rowHtml = (label: string, cell: string) => `<table><tr><td>${label}</td><td>${cell}</td></tr></table>`;

/*
 * v3.8.753 (실제 run 1b7d92 · P0) — 014 요약표 rows[4] ["우대형 기여금","납입액의 12퍼센트"] 가
 * 015 에서 ["우대형 기여금",""] 로 비워졌다(events #3 sanitizeFactUnsafeHtml). 근거·본문에는 "우대형 12%" 가 있다.
 * "12퍼센트" 와 "12%" 를 다른 값으로 본 것이다. 12%p 는 여전히 다른 단위다.
 */
describe('v3.8.753 비율 표기 정규화 — 12퍼센트 = 12%, 12%p 는 다르다', () => {
  test('T09 12% 와 12퍼센트는 같은 조건에서 보존된다', () => {
    expect(inspectFactIntegrity('<p>우대형 기여금은 납입액의 12퍼센트입니다.</p>', EVIDENCE).status).toBe('passed');
    expect(inspectFactIntegrity('<p>우대형 기여금은 납입액의 12%입니다.</p>', EVIDENCE).status).toBe('passed');
    // 반대 방향 — 근거가 퍼센트로 쓰고 본문이 % 로 써도 같다
    const ev2 = { ...EVIDENCE, context: EVIDENCE.context.replace('12%의', '12퍼센트의') };
    expect(inspectFactIntegrity('<p>우대형은 12%입니다.</p>', ev2).status).toBe('passed');
    expect(normalizeForMatch('12퍼센트')).toBe(normalizeForMatch('12%'));
    expect(containsValueToken(normalizeForMatch('우대형 12퍼센트'), normalizeForMatch('12%'))).toBe(true);
  });

  /** weak 근거는 본문이 200자 이상이어야 대조 대상이 된다(기존 규칙) — 짧은 문맥은 그 규칙에 걸리므로 채운다 */
  const PAD = ' 청년미래적금은 청년의 자산 형성을 돕는 정책형 적금이며 은행 창구와 앱에서 신청한다. 자세한 절차는 취급 은행이 안내한다.'.repeat(3);

  test('T10 12% 와 12%p(퍼센트포인트)는 구분한다', () => {
    const evP = { ...EVIDENCE, context: `우대형 기여금 비율을 12%p 높이는 방안이 추진된다.${PAD}` };
    expect(inspectFactIntegrity('<p>우대형 비율은 12%입니다.</p>', evP).status).toBe('blocked');
    expect(inspectFactIntegrity('<p>우대형 비율을 12%p 높입니다.</p>', evP).status).toBe('passed');
    expect(inspectFactIntegrity('<p>우대형 비율을 12퍼센트포인트 높입니다.</p>', evP).status).toBe('passed');
    // 근거가 12% 인데 본문이 12%p 라고 쓰면 막는다
    expect(inspectFactIntegrity('<p>우대형 비율을 12%p 높입니다.</p>', EVIDENCE).status).toBe('blocked');
    expect(normalizeForMatch('12퍼센트포인트')).toBe(normalizeForMatch('12%p'));
    expect(containsValueToken(normalizeForMatch('12%p 상향'), normalizeForMatch('12%'))).toBe(false);
  });

  test('T11 다른 상품·다른 유형의 수치는 숫자만 같다고 통과하지 않는다 (행 이름표가 있을 때)', () => {
    // 근거엔 "청년도약계좌 … 최대 6%" 와 "일반형 6%" 만 있고 "우대형 12%" 는 없다 → 우대형 행의 12% 는 근거 없음
    const evOther = { ...EVIDENCE, context: `청년미래적금 일반형에는 납입액의 6%의 기여금이 지급된다. 다른 상품인 청년도약계좌는 매월 최대 6%, 지방 근무자는 12%의 기여금을 받을 수 있다.${PAD}` };
    const withSubject = { ...evOther, subjectHint: '우대형 기여금' };
    expect(inspectFactIntegrity('<p>납입액의 12퍼센트</p>', withSubject).status).toBe('blocked');
    // 이름표가 근거의 값 곁에 있으면 통과
    expect(inspectFactIntegrity('<p>납입액의 12퍼센트</p>', { ...EVIDENCE, subjectHint: '우대형 기여금' }).status).toBe('passed');
    // 이름표가 없으면 예전 동작(값 존재만) — 다른 경로를 흔들지 않는다
    expect(inspectFactIntegrity('<p>납입액의 12퍼센트</p>', evOther).status).toBe('passed');
  });

  test('T12 014 원본 → 필터 → 정상 우대형 행이 보존된다 (실제 run 표)', () => {
    const raw = FX.summaryRaw;
    const row = raw.rows.find((r: string[]) => r[0] === '우대형 기여금');
    expect(row).toEqual(['우대형 기여금', '납입액의 12퍼센트']);
    expect(FX.summaryFiltered.rows.find((r: string[]) => r[0] === '우대형 기여금')).toEqual(['우대형 기여금', '']);   // 실제 run 에서 지워진 모양
    const filtered = raw.rows.map((r: string[]) => r.map((v: string) => sanitizeFactUnsafeHtml(v, { ...EVIDENCE, subjectHint: r[0] })));
    expect(filtered.find((r: string[]) => r[0] === '우대형 기여금')).toEqual(['우대형 기여금', '납입액의 12퍼센트']);
    // 원래 표시 텍스트는 바꾸지 않는다(퍼센트 → % 로 고쳐 쓰지 않는다)
    expect(filtered.flat().join(' ')).toContain('12퍼센트');
    // 셀 단위 HTML 경로도 같다
    expect(sanitizeFactUnsafeHtml(rowHtml('우대형 기여금', '납입액의 12퍼센트'), EVIDENCE)).toContain('납입액의 12퍼센트');
  });

  test('T13 근거 없는 수치를 거르는 기존 동작은 그대로다', () => {
    expect(inspectFactIntegrity('<p>우대형 기여금은 납입액의 15퍼센트입니다.</p>', EVIDENCE).status).toBe('blocked');
    expect(inspectFactIntegrity('<p>우대형 기여금은 납입액의 15%입니다.</p>', EVIDENCE).status).toBe('blocked');
    expect(sanitizeFactUnsafeHtml(rowHtml('우대형 기여금', '납입액의 15퍼센트'), EVIDENCE)).toContain('<td></td>');
    expect(sanitizeFactUnsafeHtml('<p>월 최대 50만원을 납입합니다.</p>', EVIDENCE)).toContain('50만원');
    expect(sanitizeFactUnsafeHtml('<p>월 최대 80만원을 납입합니다.</p>', EVIDENCE)).not.toContain('80만원');
  });

  test('배선 — 요약표 정리는 행 이름표를 힌트로 넘기고, 지운 칸을 진단 기록에 남긴다', () => {
    const src = read('src/core/final/orchestration.ts');
    const block = blockBetween(src, '// 6. 요약표', '// 7. 해시태그');
    expect(block).toContain('subjectHint');
    expect(block).toContain("trace.change('summary-table.fact-filter'");
    expect(block).toContain('clearedCells');
  });
});
