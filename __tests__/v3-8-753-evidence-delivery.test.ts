const fs = require('fs');
const path = require('path');

import { assembleEvidence, renderEvidence, evidenceHeader, type EvidenceItem } from '../src/core/final/evidence';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const FX = JSON.parse(read('__tests__/fixtures/run-1b7d92/evidence-and-packet.json'));
type Cand = Omit<EvidenceItem, 'id'>;
const TODAY = '2026-09-29';
const KW = '청년미래적금 VS 청년 도약계좌';
const BLOG_A = 'https://m.blog.naver.com/jeongwon353/224425408918';   // 특별중도해지 시 기여금·비과세 유지 (700자 뒤)
const BLOG_B = 'https://m.blog.naver.com/ji73330/224425407317';       // 6,000만 초과~7,500만 = 기여금 없이 비과세만 · 우대형 3,600만 (700자 뒤)

/** 렌더 본문(머리줄 제외)이 전부 원문의 글자 그대로인가 — 요약·재작성이 아니다 */
function bodyOf(text: string, item: EvidenceItem): string {
  const head = evidenceHeader(item);
  const at = text.indexOf(head);
  if (at < 0) return '';
  const rest = text.slice(at + head.length + 1);
  const next = rest.search(/\n\n\[E\d{2}\]/);
  return next < 0 ? rest : rest.slice(0, next);
}
const pieces = (body: string) => body.split(/\s\(…\)\s/).map((s) => s.trim()).filter(Boolean);

/*
 * v3.8.753 (실제 run 1b7d92 · P0) — 절단이 여러 단계에서 겹쳐 핵심 조건이 사라졌다.
 * 003: 블로그 E13/E14 cleanedText 는 1,223자인데 renderText 엔 앞 700자만. 005: 같은 문서가 E19/E20 이 되고,
 * 009 Writer 근거 블록엔 11건만 들어가 E19/E20 은 아예 없었다. 그 뒤쪽 문장에 무기여 구간·특별중도해지 혜택 유지·우대형 기준이 있었다.
 */
describe('v3.8.753 근거 전달 — 앞 N자가 아니라 조건을 말하는 구간을 고른다', () => {
  const items = assembleEvidence(FX.stage2.candidates as Cand[], TODAY);
  const A = items.find((i) => i.url === BLOG_A)!;
  const B = items.find((i) => i.url === BLOG_B)!;

  test('T05 700자 뒤의 조건·예외 문장이 발췌에 남는다 (실제 run 의 두 블로그)', () => {
    expect(A.cleanedText.indexOf('특별중도해지')).toBeGreaterThan(700);
    expect(B.cleanedText.indexOf('기여금은 받지 못하지만')).toBeGreaterThan(700);
    const r = renderEvidence(items, 11000);
    const ids = r.used.map((u) => u.id);
    expect(ids).toContain(A.id);
    expect(ids).toContain(B.id);
    expect(bodyOf(r.text, A)).toContain('정부기여금과 이자소득 비과세 혜택을 유지');
    expect(bodyOf(r.text, B)).toContain('기여금은 받지 못하지만 이자소득 비과세 혜택은 받을 수 있습니다');
    expect(bodyOf(r.text, B)).toContain('3,600만 원 이하');
  });

  test('T06 총 전달 예산을 넘지 않는다 · 예산이 작아도 넘지 않는다', () => {
    for (const budget of [3000, 6000, 11000]) {
      const r = renderEvidence(items, budget);
      expect(r.text.length).toBeLessThanOrEqual(budget);
      expect(r.used.length).toBeGreaterThan(0);
      // 선택 기록: 전달/제외 문서와 이유가 남는다
      expect(r.selection.length).toBe(items.length);
      for (const s of r.selection) expect(typeof s.delivered).toBe('boolean');
      expect(r.selection.filter((s) => !s.delivered).every((s) => s.reason)).toBe(true);
    }
  });

  test('T07 다른 회차·무관한 수치만 있는 문서가 핵심 문서를 밀어내지 않는다', () => {
    const mk = (title: string, url: string, text: string, tag = '뉴스'): Cand => ({
      mainKeyword: KW, title, sourceName: 'x', domain: new URL(url).hostname, url, pubDate: '2026-09-16', retrievedAt: '2026-09-29T00:00:00.000Z',
      sourceType: tag === '공식' ? 'government' : 'news', isOfficial: tag === '공식', query: KW, relevanceScore: 0.9, promiseRelevanceScore: null, hasBody: true, cleanedText: text,
    });
    const core = mk('2차 가입 안내', 'https://www.fsc.go.kr/x/1', '청년미래적금 2차 가입 신청은 10월 7일부터 16일까지다. 총급여 6,000만원 초과 7,500만원 이하는 기여금 없이 비과세만 적용된다. 청년도약계좌 가입자는 계좌 개설 뒤 특별중도해지하면 기여금과 비과세가 유지된다.', '공식');
    const noise = mk('지난 회차 통계', 'https://news.example.com/old', '지난 6월 1차 모집 신청자는 100만명을 돌파했다. 첫날 19만 6000건, 둘째 날 25만건, 셋째 날 30만건이 접수됐다. 은행별로는 A은행 12%, B은행 9%, C은행 7% 비중이었다. ' .repeat(6));
    const r = renderEvidence(assembleEvidence([noise, core], TODAY), 900);
    const coreItem = r.used.find((u) => u.url === core.url)!;
    expect(coreItem).toBeDefined();
    const body = bodyOf(r.text, coreItem);
    expect(body).toContain('기여금 없이 비과세만');
    expect(body).toContain('특별중도해지');
    // 잡음 문서는 예산이 남을 때만, 그것도 핵심 문서 뒤에
    const noiseItem = r.used.find((u) => u.url === noise.url);
    if (noiseItem) expect(r.text.indexOf(evidenceHeader(coreItem))).toBeLessThan(r.text.indexOf(evidenceHeader(noiseItem)));
  });

  test('T08 발췌는 원문 문장 그대로다 — 코드가 문장을 만들거나 요약하지 않는다', () => {
    const r = renderEvidence(items, 11000);
    for (const u of r.used) {
      const body = bodyOf(r.text, u);
      expect(body.length).toBeGreaterThan(0);
      for (const piece of pieces(body)) expect(u.cleanedText.includes(piece)).toBe(true);
      const sel = r.selection.find((s) => s.id === u.id)!;
      expect(sel.delivered).toBe(true);
      // 원문 위치와 대응: 기록된 구간을 원문에서 잘라 붙이면 전달 본문과 같다
      const rebuilt = sel.ranges.map(([s, e]) => u.cleanedText.slice(s, e).trim()).join(' (…) ');
      expect(rebuilt).toBe(body.trim());
    }
  });

  test('공식 자료가 앞자리와 큰 몫을 받는 규칙은 그대로다', () => {
    const r = renderEvidence(items, 11000);
    expect(r.used[0]!.isOfficial).toBe(true);
    const officialChars = r.used.filter((u) => u.isOfficial).reduce((n, u) => n + bodyOf(r.text, u).length, 0);
    const blogChars = r.used.filter((u) => u.sourceType === 'blog').reduce((n, u) => n + bodyOf(r.text, u).length, 0) / Math.max(1, r.used.filter((u) => u.sourceType === 'blog').length);
    expect(officialChars / Math.max(1, r.used.filter((u) => u.isOfficial).length)).toBeGreaterThan(blogChars);
  });

  test('배선 — 캡처에 선택/제외 문서와 구간이 남는다', () => {
    const src = read('src/core/final/orchestration.ts');
    expect(src).toContain('renderSelection: evidenceRender.selection');
  });
});
