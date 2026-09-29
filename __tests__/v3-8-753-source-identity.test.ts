const fs = require('fs');
const path = require('path');

import { assembleEvidence, canonicalUrl, type EvidenceItem } from '../src/core/final/evidence';
import { groundClaims, reconcilePacketSources, buildCodePacket } from '../src/core/final/research-packet';
import { blockBetween } from './helpers/source-block';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const FX = JSON.parse(read('__tests__/fixtures/run-1b7d92/evidence-and-packet.json'));
type Cand = Omit<EvidenceItem, 'id'>;
const TODAY = '2026-09-29';
const FSC = 'https://www.fsc.go.kr/edu/news/87370';
const ASIATIME = 'https://www.asiatime.co.kr/article/20260625500339';
const idOf = (items: EvidenceItem[], url: string) => items.find((i) => i.url === url)?.id;

/*
 * v3.8.753 (실제 run 20260929-091901-1b7d92 · P0) — 출처 ID 가 단계마다 바뀌어 claim 연결이 끊겼다.
 *
 * 003-evidence.stage1: E11 = 금융위 87370 → 004 패킷 conditions "개설 뒤 해지" 가 [E11] 을 인용
 * 005-evidence.stage2: 같은 문서가 E10, E11 은 asiatime 기사 → 006 패킷은 여전히 [E11] → 009 Writer 프롬프트까지 그대로.
 * 모델이 처음부터 엉뚱한 기사를 인용한 것이 아니다. 보강·재정렬 뒤 번호가 다른 문서로 옮겨 간 것이다.
 */
describe('v3.8.753 출처 ID 는 실행 내내 같은 문서를 가리킨다', () => {
  /** T01 — 초기 E11(금융위) claim 이 보강 뒤에도 같은 문서를 참조한다 */
  test('T01 실제 run: 1단계 금융위 87370 의 id 가 2단계에서도 같다', () => {
    const registry = new Map<string, string>();
    const stage1 = assembleEvidence(FX.stage1.candidates as Cand[], TODAY, registry);
    const fscId = idOf(stage1, FSC);
    expect(fscId).toMatch(/^E\d{2}$/);
    // 실제 run 에서는 1단계 E11(금융위) 을 인용한 조건 문장이 2단계에서 다른 기사(E11=asiatime)를 가리켰다
    expect(FX.packetRawConditions.some((c: any) => c.sourceIds.includes('E11'))).toBe(true);
    expect(FX.stage1.ids.find((i: any) => i.id === 'E11').url).toBe(FSC);
    expect(FX.stage2.ids.find((i: any) => i.id === 'E11').url).toBe(ASIATIME);
    const stage2 = assembleEvidence(FX.stage2.candidates as Cand[], TODAY, registry);
    expect(idOf(stage2, FSC)).toBe(fscId);                                 // 이제 같은 문서 = 같은 id
    expect(idOf(stage2, ASIATIME)).toBe(idOf(stage1, ASIATIME));          // 예전엔 E11 로 밀려 들어왔다
    // 1단계에 있던 모든 문서가 2단계에서도 같은 id
    for (const it of stage1) {
      if (stage2.some((i) => i.url === it.url)) expect(`${it.url} → ${idOf(stage2, it.url)}`).toBe(`${it.url} → ${it.id}`);
    }
    // 등록부 없이 부르면 예전처럼 순번을 새로 매긴다(기존 호출자 호환)
    const fresh = assembleEvidence(FX.stage2.candidates as Cand[], TODAY);
    expect(fresh.map((i) => i.id)).toEqual(fresh.map((_, i) => `E${String(i + 1).padStart(2, '0')}`));
  });

  /** T02 — 추가·삭제·정렬·중복 제거 뒤에도 남은 문서의 참조가 보존된다 */
  test('T02 문서를 더하고 빼고 뒤집어도 살아남은 문서의 id 는 그대로', () => {
    const registry = new Map<string, string>();
    const base = FX.stage1.candidates as Cand[];
    const first = assembleEvidence(base, TODAY, registry);
    const before = new Map(first.map((i) => [i.url, i.id]));
    const added: Cand[] = [
      { ...base[0]!, title: '새 문서 A', url: 'https://www.fsc.go.kr/no010101/87726', cleanedText: '청년미래적금 2차 가입 신청은 10월 7일부터입니다. '.repeat(20), pubDate: '2026-09-16' },
      { ...base[1]!, title: '새 문서 B', url: 'https://news.example.com/b', cleanedText: '청년도약계좌 갈아타기 절차 안내. '.repeat(20) },
    ];
    const dup: Cand = { ...base[1]!, url: `${base[1]!.url}&utm_source=naver`, cleanedText: `${base[1]!.cleanedText} (전재)` };   // 같은 문서(kbanker)의 전재
    const next = assembleEvidence([...added, ...[...base].reverse().slice(2), dup], TODAY, registry);   // 2개 삭제 · 순서 뒤집기 · 전재 1
    for (const it of next) {
      if (before.has(it.url)) expect(`${it.url} ${it.id}`).toBe(`${it.url} ${before.get(it.url)}`);
    }
    const ids = next.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);                            // 충돌 없음
    for (const a of added) expect(before.has(idOf(next, a.url)!)).toBe(false);   // 새 문서는 새 id
    expect(next.filter((i) => canonicalUrl(i.url) === canonicalUrl(base[1]!.url))).toHaveLength(1);   // 전재는 하나로
    expect(idOf(next, base[1]!.url) ?? idOf(next, dup.url)).toBe(before.get(base[1]!.url));            // 전재가 대표가 돼도 id 는 그 문서의 것
  });

  /** T03 — 없는 참조는 비슷한 문서로 대체하지 않고 미해결로 남긴다 */
  test('T03 미해결 출처는 추측 연결하지 않고 기록한다', () => {
    const registry = new Map<string, string>();
    const items = assembleEvidence(FX.stage1.candidates as Cand[], TODAY, registry);
    const fscId = idOf(items, FSC)!;
    const claims = [
      { claim: '청년도약계좌에서 갈아타려면 청년미래적금 계좌를 개설한 뒤 청년도약계좌를 해지해야 한다', sourceIds: [fscId] },
      { claim: '없는 출처를 인용한 문장', sourceIds: ['E99'] },
    ];
    const g = groundClaims(claims, items);
    expect(g.kept).toHaveLength(1);
    expect(g.kept[0]!.sourceIds).toEqual([fscId]);                          // E99 를 다른 문서로 바꾸지 않는다
    expect(g.dropped).toBe(1);

    // 패킷 sourceMap: Writer 에게 실제 전달된 문서와, 인용됐지만 전달되지 않은 문서를 가른다
    const delivered = items.slice(0, 5).filter((i) => i.id !== fscId);        // 금융위 문서는 전달 목록 밖
    const packet = { ...buildCodePacket({ mainKeyword: '청년미래적금 VS 청년 도약계좌', title: 't', items: delivered }), conditions: g.kept, facts: [{ claim: '유령 인용', sourceIds: ['E77'] }] };
    const r = reconcilePacketSources(packet as any, items, new Set(delivered.map((i) => i.id)));
    const fsc = r.sourceMap.find((s) => s.id === fscId);
    expect(fsc).toBeDefined();
    expect(fsc!.delivered).toBe(false);
    expect(fsc!.url).toBe(FSC);
    expect(r.sourceMap.filter((s) => s.delivered !== false).map((s) => s.id).sort()).toEqual(delivered.map((i) => i.id).sort());
    expect(r.unresolvedSourceIds).toEqual(['E77']);
    expect(r.notes.join(' ')).toContain('E77');
    expect(r.conditions[0]!.sourceIds).toEqual([fscId]);                     // claim 자체는 손대지 않는다
  });

  /** T04 — 같은 도메인의 다른 문서·회차는 다른 문서다 (id 식별 쿼리를 하나로 합치지 않는다) */
  test('T04 URL 정규화가 문서 식별 쿼리를 지우지 않는다', () => {
    expect(canonicalUrl('https://www.korea.kr/news/policyNewsView.do?newsId=148965913')).not.toBe(canonicalUrl('https://www.korea.kr/news/policyNewsView.do?newsId=148966832'));
    expect(canonicalUrl('https://www.kbanker.co.kr/news/articleView.html?idxno=225951')).not.toBe(canonicalUrl('https://www.kbanker.co.kr/news/articleView.html?idxno=225000'));
    // 추적 파라미터·www/m·fragment·꼬리 슬래시는 같은 문서
    expect(canonicalUrl('https://m.blog.naver.com/a/1?utm_source=naver&fbclid=x#top')).toBe(canonicalUrl('https://blog.naver.com/a/1/'));
    expect(canonicalUrl('https://www.nocutnews.co.kr/news/6578881?utm_source=naver&utm_medium=article')).toBe(canonicalUrl('https://nocutnews.co.kr/news/6578881'));
    const base = FX.stage1.candidates[0] as Cand;
    const two: Cand[] = [
      { ...base, title: '정책뉴스 A', url: 'https://www.korea.kr/news/policyNewsView.do?newsId=1', cleanedText: '청년미래적금 A 회차 안내입니다. '.repeat(30) },
      { ...base, title: '정책뉴스 B', url: 'https://www.korea.kr/news/policyNewsView.do?newsId=2', cleanedText: '청년미래적금 B 회차 안내입니다. '.repeat(30) },
    ];
    expect(assembleEvidence(two, TODAY)).toHaveLength(2);
  });

  test('배선 — orchestration 은 run 하나에 등록부 하나를 쓰고, 패킷 갱신 때 출처를 대조한다', () => {
    const src = read('src/core/final/orchestration.ts');
    expect(src).toContain('const evidenceIdRegistry = new Map<string, string>();');
    expect(blockBetween(src, 'const refreshEvidence = (titleForGate: string): void => {', 'refreshEvidence(\'\');')).toContain('assembleEvidence(evidenceCandidates, todayKst, evidenceIdRegistry)');
    expect(blockBetween(src, 'const refreshPacketValues = (): void => {', "pipelineStatus.mark('RESEARCH'")).toContain('reconcilePacketSources(');
  });
});
