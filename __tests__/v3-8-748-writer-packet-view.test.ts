/**
 * 748-quality-fix-2 (B) — Writer 가 보는 패킷.
 *
 * RAW 패킷은 그대로 둔다(Title Fact Gate·Verification·Judge 는 RAW 를 본다).
 * Writer 프롬프트에만 **정제된 보기**를 준다: 판단 기준이 되는 값(CORE) · 보조 값(SUPPORTING) · 배경(CONTEXT_ONLY) · 뺀 것(DROP).
 * 값→절 배정은 하지 않는다(748a 에서 해로웠다).
 */
import { buildWriterPacketView } from '../src/core/final/writer-packet-view';
import { renderPacket } from '../src/core/final/research-packet';

const base = {
  mainKeyword: '경주 APEC 기간 숙소 예약', topic: '경주 APEC 숙소', searchIntent: '경주 APEC 기간 숙소 예약 시기·객실', currentAsOf: '2026-09-22',
  facts: [], numbers: [], dates: [], eligibility: [], conditions: [], officialStatements: [], conflictingInformation: [],
  readerQuestions: ['경주 APEC 기간 대릉원 인근 숙박시설 정보 알려주세요.'], actualSearchSuggestions: ['경주 apec 호텔'], sourceMap: [], status: 'OK' as const, notes: [],
};
const CTX = { keyword: '경주 APEC 기간 숙소 예약', title: '경주 APEC 기간 숙소 예약, 보문단지 남은 객실은', h2Titles: ['숙소 예약 시기', '객실 현황', '셔틀·교통'] };

describe('748 (B) buildWriterPacketView — 잡음은 내리고, RAW 는 그대로', () => {
  test('B-1 판단 기준 값은 CORE 로 남고 RAW 패킷 문자열은 바뀌지 않는다', () => {
    const packet = { ...base, numbers: [{ value: '12,800여 개 객실', context: '경주시가 확보한 숙박시설: 약 12,800여 개 객실 예약', sourceIds: ['E15'] }] };
    const raw = renderPacket(packet as any);
    const view = buildWriterPacketView(packet as any, CTX);
    expect(renderPacket(packet as any)).toBe(raw);
    expect(view.text).toContain('12,800여 개 객실');
    expect(view.decisions.find((d) => d.value === '12,800여 개 객실')).toMatchObject({ verdict: 'KEEP', tier: 'CORE' });
  });

  test('B-2 (fixture B) 대구만 나오는 셔틀 8회는 DROP · 대구→경주 셔틀은 관계라 SUPPORTING 으로 남는다', () => {
    const packet = {
      ...base,
      numbers: [
        { value: '8회', context: '대구 동성로 무인 자율주행 셔틀 하루 8회 운행', sourceIds: ['E2'] },
        { value: '6회', context: '대구역에서 경주 APEC 숙소 권역까지 셔틀 하루 6회 운행', sourceIds: ['E9'] },
      ],
    };
    const view = buildWriterPacketView(packet as any, CTX);
    expect(view.decisions.find((d) => d.value === '8회')).toMatchObject({ verdict: 'DROP_FROM_WRITER_VIEW', reason: 'OTHER_CITY' });
    expect(view.text).not.toContain('동성로');
    const six = view.decisions.find((d) => d.value === '6회');
    expect(six?.verdict).not.toBe('DROP_FROM_WRITER_VIEW');
    expect(six?.tier).not.toBe('CORE');
    expect(view.text).toContain('6회');
  });

  test('B-3 (fixture C) 2025년 값은 CONTEXT_ONLY(배경) — 2026년 값은 CORE', () => {
    const packet = {
      ...base,
      dates: [
        { value: '2025년 10월 31일', context: '2025년 10월 31일~11월 1일 경주 APEC 정상회의 기간 숙소 예약 마감', sourceIds: ['E3'] },
        { value: '2026년 10월 31일', context: '2026년 10월 31일 경주 APEC 기념 행사 기간 숙소 예약 시작', sourceIds: ['E4'] },
      ],
    };
    const view = buildWriterPacketView(packet as any, CTX);
    expect(view.decisions.find((d) => d.value === '2025년 10월 31일')).toMatchObject({ verdict: 'DEMOTE', tier: 'CONTEXT_ONLY', reason: 'STALE_YEAR' });
    expect(view.decisions.find((d) => d.value === '2026년 10월 31일')).toMatchObject({ verdict: 'KEEP', tier: 'CORE' });
    // 배경 값은 따로 묶여 "현재 기준으로 쓰지 말라" 는 머리말 아래에 온다
    const bgAt = view.text.indexOf('▸ 배경');
    expect(bgAt).toBeGreaterThan(-1);
    expect(view.text.indexOf('2025년 10월 31일')).toBeGreaterThan(bgAt);
    expect(view.text.indexOf('2026년 10월 31일')).toBeLessThan(bgAt);
  });

  test('B-4 (fixture D) 기사 작성일은 DROP · 앞으로의 일정은 CORE', () => {
    const packet = {
      ...base,
      dates: [
        { value: '9월 22일', context: '[2026-09-22 작성 · 0일 전] 경주 APEC 숙소 예약 기사', sourceIds: ['E1'] },
        { value: '11월 1일', context: '경주 APEC 행사 기간 11월 1일까지 숙소 예약 접수', sourceIds: ['E5'] },
      ],
    };
    const view = buildWriterPacketView(packet as any, CTX);
    expect(view.decisions.find((d) => d.value === '9월 22일')).toMatchObject({ verdict: 'DROP_FROM_WRITER_VIEW', reason: 'ARTICLE_DATE' });
    expect(view.decisions.find((d) => d.value === '11월 1일')).toMatchObject({ verdict: 'KEEP', tier: 'CORE' });
    expect(view.text).not.toContain('0일 전');
  });

  test('B-5 (fixture E) 조건·사이트 이름·숙소 이름은 CORE 수치가 되지 않는다', () => {
    const packet = {
      ...base,
      conditions: [{ claim: '해운대 모던 스테이는 2박 이상 예약 시 조식 포함', sourceIds: ['E14'] }],
      numbers: [{ value: '350개', context: '마이리얼트립 경주의 350개 호텔, 숙소 검색 결과', sourceIds: ['E15'] }],
    };
    const view = buildWriterPacketView(packet as any, CTX);
    const core = view.decisions.filter((d) => d.tier === 'CORE');
    expect(core.map((d) => d.value)).not.toContain('해운대 모던 스테이는 2박 이상 예약 시 조식 포함');
    expect(view.decisions.find((d) => d.value === '350개')?.tier).not.toBe('CORE');
    // 조건 줄은 그대로 "조건·절차" 에 남는다(사이트 이름 수치만 안 올린다) — 단 다른 도시(해운대=부산권) 숙소 조건은 뺀다
    expect(view.text).not.toContain('해운대 모던 스테이');
  });

  test('B-6 의도와 안 겹치는 값(LOW_INTENT)은 SUPPORTING 으로 내려가고 지워지지 않는다', () => {
    const packet = { ...base, numbers: [{ value: '73%', context: '경주월드 가을 방문객 73% 증가', sourceIds: ['E7'] }] };
    const view = buildWriterPacketView(packet as any, CTX);
    expect(view.decisions.find((d) => d.value === '73%')).toMatchObject({ verdict: 'DEMOTE', tier: 'SUPPORTING', reason: 'LOW_INTENT' });
    expect(view.text).toContain('73%');
  });

  test('B-7 요약 줄이 KEEP/DEMOTE/DROP 수를 말한다 · EMPTY 패킷 경고는 그대로 · 머리줄은 RESEARCH PACKET 그대로(프롬프트 규칙이 그 이름을 가리킨다)', () => {
    const view = buildWriterPacketView({ ...base, status: 'EMPTY' } as any, CTX);
    expect(view.text).toMatch(/^\[RESEARCH PACKET — 2026-09-22/);
    expect(view.text).toContain('확인된 근거가 없습니다');
    expect(view.summary).toMatch(/KEEP \d+ · DEMOTE \d+ · DROP \d+/);
  });
});
