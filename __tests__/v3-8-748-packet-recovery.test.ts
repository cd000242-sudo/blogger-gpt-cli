/**
 * 748 Search Pipeline — Packet LLM omission 보완 (deterministic recovery) · thread stale-support 구멍.
 *
 * 실측(748b): 출처 E17 에 "약 12,800여 개 객실 · 행사 최소 3~6개월 전" 이 있었는데 코드 추출은 "6개월" 만 뽑았고,
 * 그 실행의 LLM 정리가 그 문장을 안 옮기자 패킷에서 값이 사라졌다. 새 LLM 호출 없이 코드 추출로 보존한다.
 */
import { buildResearchPacket, buildCodePacket, markValueOrigins } from '../src/core/final/research-packet';
import { buildWriterPacketView } from '../src/core/final/writer-packet-view';
import { filterThreadQuestions } from '../src/core/final/thread';

const KW = '경주 APEC 기간 숙소 예약';
const item = (id: string, title: string, text: string, extra: Partial<any> = {}) => ({
  id, title, url: `https://x/${id}`, domain: 'x', pubDate: '2026-09-01', sourceType: 'blog', isOfficial: false, cleanedText: text, mainKeyword: KW, ...extra,
});
const SRC = [
  item('E17', '2025 경주 APEC 행사 기간 일정', '숙박 및 예약 팁. 경주시가 확보한 숙박시설: 약 12,800여 개 객실 권장 예약 시기: 행사 최소 3~6개월 전 (5월~7월) 추천 숙소 지역: 보문단지.'),
  item('E02', '대구 동성로서 무인 자율주행 셔틀 달린다', '대구 동성로 무인 자율주행 셔틀이 하루 8회 운행한다.'),
  item('E03', '웨스틴조선 부산 APEC 특수', '웨스틴조선 부산 예약률 90%를 기록했다.'),
  item('E04', '마이리얼트립', '경주의 350개 호텔, 숙소 검색 결과가 있어요.'),
  item('E05', '경주 숙소 예약 기사', '[2026-09-22 작성 · 0일 전] 경주 APEC 숙소 예약이 몰린다.', { pubDate: '2026-09-22' }),
];

describe('코드 추출 — 범위값·"N여 개 객실" 을 잡는다', () => {
  test('26-a "12,800여 개 객실" 과 "3~6개월" 이 numbers 에 있다 · 범위 안의 "6개월" 은 따로 안 뽑는다', () => {
    const p = buildCodePacket({ mainKeyword: KW, title: 't', items: SRC as any });
    const values = p.numbers.map((n) => n.value);
    expect(values.some((v) => /12,800여 개 객실/.test(v))).toBe(true);
    expect(values).toContain('3~6개월');
    expect(values).not.toContain('6개월');
    expect(p.numbers.find((n) => n.value === '3~6개월')!.sourceIds).toEqual(['E17']);
  });

  test('26-b 상한에 걸릴 때 키워드와 겹치는 문맥의 값이 먼저 산다', () => {
    const noise = Array.from({ length: 40 }, (_, i) => item(`N${i}`, '무관 기사', `아무 가격 ${1000 + i}원 이야기.`));
    const p = buildCodePacket({ mainKeyword: KW, title: 't', items: [...noise, SRC[0]] as any });
    expect(p.numbers.length).toBeLessThanOrEqual(24);
    expect(p.numbers.some((n) => /12,800/.test(n.value))).toBe(true);
    expect(p.numbers.some((n) => n.value === '3~6개월')).toBe(true);
  });
});

describe('26 core source fixture — LLM 정리가 빠뜨려도 RAW_PACKET 에 DETERMINISTIC_RECOVERY 로 남는다', () => {
  const llmOmits = async () => JSON.stringify({ searchIntent: '경주 APEC 숙소 예약 시기', facts: [{ claim: '보문단지가 추천 숙소 지역이다', sourceIds: ['E17'] }], eligibility: [], conditions: [], officialStatements: [], conflictingInformation: [] });

  test('RAW: 12,800·3~6개월 은 origin=DETERMINISTIC_RECOVERY · LLM 문장의 값은 LLM_PACKET · recovery 요약 존재', async () => {
    const p = await buildResearchPacket({ mainKeyword: KW, title: '경주 APEC 기간 숙소 예약', items: SRC as any, evidenceText: 'x', callModel: llmOmits });
    expect(p.status).toBe('OK');
    const v12 = p.numbers.find((n) => /12,800/.test(n.value))!;
    const v36 = p.numbers.find((n) => n.value === '3~6개월')!;
    expect(v12.origin).toBe('DETERMINISTIC_RECOVERY');
    expect(v36.origin).toBe('DETERMINISTIC_RECOVERY');
    expect(p.recovery!.added).toBeGreaterThanOrEqual(2);
    expect(p.recovery!.values).toEqual(expect.arrayContaining([v12.value, '3~6개월']));
  });

  test('WRITER_PACKET_VIEW: 복구 값은 관련도가 높으면 CORE 로 유지된다(강제 삽입은 없다 — Writer 프롬프트 문구 그대로)', async () => {
    const p = await buildResearchPacket({ mainKeyword: KW, title: '경주 APEC 기간 숙소 예약', items: SRC as any, evidenceText: 'x', callModel: llmOmits });
    const view = buildWriterPacketView(p, { keyword: KW, title: '경주 APEC 기간 숙소 예약, 남은 객실은', h2Titles: ['예약 시기', '객실 현황'] });
    expect(view.decisions.find((d) => /12,800/.test(d.value))).toMatchObject({ verdict: 'KEEP', tier: 'CORE' });
    expect(view.decisions.find((d) => d.value === '3~6개월')).toMatchObject({ verdict: 'KEEP', tier: 'CORE' });
    expect(view.summary).toMatch(/코드 복구 \d+개/);
    expect(view.text).not.toMatch(/반드시|강제|절에 넣/);
  });

  test('18 중복 병합: 같은 값이 LLM 문장에도 있으면 LLM_PACKET 하나로만 센다(복구로 이중 계산하지 않는다)', async () => {
    const both = async () => JSON.stringify({ searchIntent: 'x', facts: [{ claim: '경주시가 확보한 숙박시설은 약 12,800여 개 객실이다', sourceIds: ['E17'] }], eligibility: [], conditions: [], officialStatements: [], conflictingInformation: [] });
    const p = await buildResearchPacket({ mainKeyword: KW, title: 't', items: SRC as any, evidenceText: 'x', callModel: both });
    expect(p.numbers.find((n) => /12,800/.test(n.value))!.origin).toBe('LLM_PACKET');
    expect(p.recovery!.values).not.toEqual(expect.arrayContaining([expect.stringMatching(/12,800/)]));
    expect(p.numbers.filter((n) => /12,800/.test(n.value))).toHaveLength(1);
  });
});

describe('27 noise fixture — 코드가 잡아도 CORE 로 올라가지 않는다', () => {
  test('대구 셔틀 8회 · 부산 90% · 검색 결과 350개 · 기사 작성일은 복구 값도 CORE 도 아니다', () => {
    const p = markValueOrigins(buildCodePacket({ mainKeyword: KW, title: '경주 APEC 기간 숙소 예약', items: SRC as any }));
    const origin = (re: RegExp) => p.numbers.concat(p.dates).find((n) => re.test(n.value))?.origin;
    expect(origin(/^8회$/)).toBe('CODE_ONLY');          // 대구 — 키워드 낱말과 안 겹친다
    expect(origin(/^350개$/)).toBe('CODE_ONLY');        // 사이트 껍데기(검색 결과)
    const view = buildWriterPacketView(p, { keyword: KW, title: '경주 APEC 기간 숙소 예약', h2Titles: [] });
    const core = view.decisions.filter((d) => d.tier === 'CORE').map((d) => d.value);
    expect(core).not.toEqual(expect.arrayContaining(['8회']));
    expect(core).not.toEqual(expect.arrayContaining(['90%']));
    expect(core).not.toEqual(expect.arrayContaining(['350개']));
    expect(core.some((v) => /9월 22일/.test(v))).toBe(false);
    expect(view.decisions.find((d) => d.value === '90%')).toMatchObject({ verdict: 'DROP_FROM_WRITER_VIEW', reason: 'OTHER_CITY' });
    expect(view.decisions.find((d) => d.value === '350개')).toMatchObject({ verdict: 'DROP_FROM_WRITER_VIEW', reason: 'SITE_CHROME' });
  });
});

describe('20 thread stale-support — 배경 값은 현재 질문을 받쳐 주지 못한다', () => {
  const packet: any = {
    mainKeyword: KW, topic: KW, searchIntent: '', currentAsOf: '2026-09-22',
    facts: [], eligibility: [], conditions: [], officialStatements: [], conflictingInformation: [], readerQuestions: ['11월 2일 경주'], actualSearchSuggestions: [],
    numbers: [], dates: [{ value: '11월 2일부터 21일', context: '지난해 11월 2일부터 21일까지 경주 APEC 기념 숙소 예약 이벤트', sourceIds: ['E9'] }],
    sourceMap: [{ id: 'E9', title: '경주 APEC 이벤트', domain: 'x', url: 'x', pubDate: '2025-11-01', sourceType: 'news', isOfficial: false }], status: 'OK', notes: [],
  };
  test('배경(STALE_YEAR) 행만 있으면 "11월 2일 경주" 는 NO_PACKET_SUPPORT 로 떨어진다', () => {
    const view = buildWriterPacketView(packet, { keyword: KW, title: '경주 APEC 기간 숙소 예약', h2Titles: [] });
    expect(view.decisions[0]!.tier).toBe('CONTEXT_ONLY');
    expect(view.currentSupportText).not.toContain('11월 2일');
    const r = filterThreadQuestions(['11월 2일 경주'], { keyword: KW, title: '경주 APEC 기간 숙소 예약', packetText: view.currentSupportText });
    expect(r.accepted).toEqual([]);
    expect(r.dropped[0]!.reason).toBe('NO_PACKET_SUPPORT');
  });
  test('같은 값이 올해 CORE 행으로 있으면 ACCEPT — 지지 판정은 CORE/SUPPORTING 만 본다', () => {
    const current = { ...packet, dates: [{ value: '11월 2일', context: '경주 APEC 기념 숙소 예약 11월 2일 오픈', sourceIds: ['E9'] }], sourceMap: [{ ...packet.sourceMap[0], pubDate: '2026-09-10' }] };
    const view = buildWriterPacketView(current, { keyword: KW, title: '경주 APEC 기간 숙소 예약', h2Titles: [] });
    expect(view.currentSupportText).toContain('11월 2일');
    const r = filterThreadQuestions(['11월 2일 경주'], { keyword: KW, title: '경주 APEC 기간 숙소 예약', packetText: view.currentSupportText });
    expect(r.accepted).toEqual(['11월 2일 경주']);
  });
});
