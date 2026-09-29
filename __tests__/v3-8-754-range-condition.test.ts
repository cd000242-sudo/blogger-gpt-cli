const fs = require('fs');
const path = require('path');

import { assembleEvidence, renderEvidence, canonicalUrl, evidenceHeader } from '../src/core/final/evidence';

const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/run-1b7d92/evidence-and-packet.json'), 'utf8'));
const TODAY = '2026-09-29';

/*
 * v3.8.754 §4 — 실제 run 1b7d92 의 stage2 후보(실제 자료)로 문장 선택이 조건을 끊어먹지 않는지 본다.
 * 옛 E19/E20(네이버 블로그 두 편)은 레지스트리 뒤 번호가 달라지므로 URL 로 찾는다.
 */
describe('v3.8.754 선택 구간이 조건·부정·예외를 보존한다 (실제 자료)', () => {
  const reg = new Map<string, string>();
  assembleEvidence(FX.stage1.candidates, TODAY, reg);
  const items = assembleEvidence(FX.stage2.candidates, TODAY, reg);
  const r = renderEvidence(items, 11000);
  const byRunId = (id: string) => {
    const url = FX.stage2.ids.find((x: any) => x.id === id).url;
    const item = items.find((i) => canonicalUrl(i.url) === canonicalUrl(url))!;
    return { item, sel: r.selection.find((s) => s.id === item.id)! };
  };
  const pieces = ({ item, sel }: ReturnType<typeof byRunId>) => sel.ranges.map(([s, e]) => item.cleanedText.slice(s, e));

  test('무기여 구간 문장은 적용 소득구간과 한 구간에 함께 들어 있다', () => {
    const e20 = byRunId('E20');
    expect(e20.sel.delivered).toBe(true);
    const hit = pieces(e20).find((p) => p.includes('받지 못하지만'))!;
    expect(hit).toBeDefined();
    expect(hit).toContain('6,000만 원을 넘고 7,500만 원 이하라면');           // 구간(초과/이하)
    expect(hit).toContain('정부 기여금은 받지 못하지만 이자소득 비과세 혜택은 받을 수 있습니다');   // 받음/받지 못함 둘 다
    // 우대형 기준은 주어(우대형은)·금액·범위(이하)·대상(소상공인·재직자·신규 취업자)이 같은 구간에 있다
    expect(hit).toContain('우대형은 총급여 3,600만 원 이하 또는 연매출 1억 원 이하인 소상공인, 중소기업 재직자·신규 취업자 등 요건을 충족해야');
  });

  test('부정문·순서 조건은 잘리지 않고 통째로 간다', () => {
    const e19 = byRunId('E19');
    const ps = pieces(e19);
    expect(ps.some((p) => p.includes('청년도약계좌를 먼저 해지하면 안 됩니다'))).toBe(true);
    const order = ps.find((p) => p.includes('특별중도해지 신청'))!;
    expect(order).toContain('청년미래적금 계좌를 먼저 개설한 뒤 청년도약계좌를 특별중도해지 해야 합니다');
    const keep = ps.find((p) => p.includes('혜택을 유지'))!;
    expect(keep).toContain('청년미래적금 가입을 목적으로 청년도약계좌를 해지하는 경우 특별중도해지 방식이 적용됩니다');   // 어느 경우인지
  });

  test('구간은 원문 순서·오프셋을 지키고, 건너뛴 자리는 (…) 로 구분한다 — 없던 인과관계를 만들지 않는다', () => {
    for (const id of ['E19', 'E20']) {
      const { item, sel } = byRunId(id);
      for (let i = 1; i < sel.ranges.length; i += 1) expect(sel.ranges[i]![0]).toBeGreaterThanOrEqual(sel.ranges[i - 1]![1]);
      const block = r.text.split(/\n(?=\[E\d{2}\])/).find((b) => b.startsWith(`[${item.id}]`))!.replace(/\n+$/, '');
      expect(block.startsWith(evidenceHeader(item))).toBe(true);                                             // 헤더(출처·게시일·URL)는 그대로
      const body = block.slice(evidenceHeader(item).length + 1);
      expect(body).toBe(sel.ranges.map(([s, e]) => item.cleanedText.slice(s, e).trim()).join(' (…) '));   // 전달본 = 원문 조각 + 생략 표시
      expect(body.split(' (…) ')).toHaveLength(sel.ranges.length);
      expect(item.sourceType).toBe('blog');                                                                // 블로그 자격 그대로(official 승격 없음)
      expect(item.isOfficial).toBe(false);
    }
  });

  test('한 문장 안의 값과 주어를 떼어 놓지 않는다 — 스펙 나열 문장은 통째로', () => {
    const e19 = byRunId('E19');
    const spec = pieces(e19).find((p) => p.includes('우대형 12%'))!;
    expect(spec).toContain('청년미래적금 ✔ 가입기간 : 3년');
    expect(spec).toContain('정부기여금 : 일반형 6%, 우대형 12%');
    expect(spec).toContain('청년도약계좌 ✔ 가입기간 : 5년');
  });
});
