/**
 * 748-quality-fix-2 (A) — thread 관련도 필터.
 *
 * 실측(경주 APEC 여행 live 3회): 앱이 긁은 지식iN 질문 1번이 "국내 여름 휴양지 추천 10 선" 이라
 * 실(thread)의 「독자의 문제」가 그 문장이 됐고, 도입·결론이 휴양지 얘기를 하다가 Judge 가 CTA_OFFTOPIC 을 냈다.
 * 코드가 결정적으로 거른다 — AI 호출 0.
 */
import { filterThreadQuestions, buildThread } from '../src/core/final/thread';

const KW = '경주 APEC 기간 숙소 예약';
const CTX = {
  keyword: KW,
  title: '경주 APEC 기간 숙소 예약, 10월 31일 정상회의 앞두고 보문단지 남은 객실은',
  relatedQueries: ['경주 apec 호텔', '경주 apec 일정', '경주 apec 장소'],
  packetText: '경주시가 확보한 숙박시설 약 12,800여 개 객실. 정상회의 10월 31일(금)~11월 1일(토). 권장 예약 시기 행사 3~6개월 전.',
};

describe('748 (A) filterThreadQuestions — 무관 질문을 결정적으로 거른다', () => {
  test('A-1 실측 사례: "국내 여름 휴양지 추천 10 선" 은 DROP (키워드 실체와 겹침 0)', () => {
    const r = filterThreadQuestions(['국내 여름 휴양지 추천 10 선'], CTX);
    expect(r.accepted).toEqual([]);
    expect(r.dropped).toHaveLength(1);
    expect(r.dropped[0]!.reason).toBe('NO_ENTITY_OVERLAP');
  });

  test('A-2 관련 질문은 ACCEPT: "경주 APEC 기간 대릉원 인근 숙박시설 정보 알려주세요."', () => {
    const r = filterThreadQuestions(['경주 APEC 기간 대릉원 인근 숙박시설 정보 알려주세요.'], CTX);
    expect(r.accepted).toEqual(['경주 APEC 기간 대릉원 인근 숙박시설 정보 알려주세요.']);
    expect(r.dropped).toEqual([]);
  });

  test('A-3 지역만 겹치고 패킷이 받쳐 주지 않으면 DROP: "11월 2일 경주" (735 제목 사고의 씨앗)', () => {
    const r = filterThreadQuestions(['11월 2일 경주'], CTX);
    expect(r.accepted).toEqual([]);
    expect(r.dropped[0]!.reason).toBe('NO_PACKET_SUPPORT');
  });

  test('A-3b 지역만 겹쳐도 패킷이 그 값을 받쳐 주면 ACCEPT', () => {
    const r = filterThreadQuestions(['11월 1일 경주'], { ...CTX, packetText: `${CTX.packetText} 11월 1일 폐막.` });
    expect(r.accepted).toEqual(['11월 1일 경주']);
  });

  test('A-3c 패킷이 "검색자가 실제로 물은 것" 에 그 질문을 되실어도 자기 자신은 받쳐 주지 못한다 (오프라인 재생에서 잡힌 구멍)', () => {
    const r = filterThreadQuestions(['11월 2일 경주'], { ...CTX, packetText: `${CTX.packetText}\n▸ 검색자가 실제로 물은 것\n- 11월 2일 경주` });
    expect(r.accepted).toEqual([]);
    expect(r.dropped[0]!.reason).toBe('NO_PACKET_SUPPORT');
  });

  test('A-4 일반어만 남는 질문은 GENERIC_ONLY: "추천 좀 알려주세요"', () => {
    const r = filterThreadQuestions(['추천 좀 알려주세요'], CTX);
    expect(r.dropped[0]!.reason).toBe('GENERIC_ONLY');
  });

  test('A-5 다른 도시만 말하면 OFF_TOPIC_REGION: "부산 APEC 숙소 예약 어디가 좋나요"', () => {
    const r = filterThreadQuestions(['부산 APEC 숙소 예약 어디가 좋나요'], CTX);
    expect(r.dropped[0]!.reason).toBe('OFF_TOPIC_REGION');
  });

  test('A-5b 키워드 도시와 다른 도시를 함께 말하면(관계) ACCEPT: "대구에서 경주 APEC 숙소까지 셔틀"', () => {
    const r = filterThreadQuestions(['대구에서 경주 APEC 숙소까지 셔틀 있나요'], CTX);
    expect(r.accepted).toHaveLength(1);
  });

  test('A-6 행동이 어긋나면 INTENT_MISMATCH: "경주 APEC 자원봉사 신청 방법"', () => {
    const r = filterThreadQuestions(['경주 APEC 자원봉사 신청 방법'], CTX);
    expect(r.dropped[0]!.reason).toBe('INTENT_MISMATCH');
  });

  test('A-7 시기가 어긋나면 OFF_TOPIC_TIME: "경주 여름 숙소 예약 팁" (제목·패킷은 10~11월)', () => {
    const r = filterThreadQuestions(['경주 여름 숙소 예약 팁'], CTX);
    expect(r.dropped[0]!.reason).toBe('OFF_TOPIC_TIME');
  });

  test('A-8 문맥(제목·패킷)이 없어도 키워드만으로 1차 거름이 된다', () => {
    const r = filterThreadQuestions(['국내 여름 휴양지 추천 10 선', '경주 APEC 호텔 예약 언제 해야 하나요'], { keyword: KW });
    expect(r.accepted).toEqual(['경주 APEC 호텔 예약 언제 해야 하나요']);
    expect(r.dropped.map((d) => d.reason)).toEqual(['NO_ENTITY_OVERLAP']);
  });

  test('A-9 로그 줄은 ACCEPTED/DROPPED 와 이유를 담는다', () => {
    const r = filterThreadQuestions(['국내 여름 휴양지 추천 10 선', '경주 APEC 기간 대릉원 인근 숙박시설 정보 알려주세요.'], CTX);
    expect(r.log.some((l) => /THREAD_QUESTION_DROPPED.*NO_ENTITY_OVERLAP/.test(l))).toBe(true);
    expect(r.log.some((l) => /THREAD_QUESTION_ACCEPTED/.test(l))).toBe(true);
  });

  test('A-10 빈 입력·비문자열은 조용히 빈 결과', () => {
    expect(filterThreadQuestions(undefined as any, CTX)).toEqual({ accepted: [], dropped: [], log: [] });
    expect(filterThreadQuestions([null, 3, ''] as any, CTX).accepted).toEqual([]);
  });
});

describe('748 (A) buildThread — 걸러진 질문은 실이 되지 않는다', () => {
  test('A-11 지식iN 1번이 무관하면 2번이 실이 된다', () => {
    const t = buildThread({
      title: CTX.title, keyword: KW,
      userQuestions: ['국내 여름 휴양지 추천 10 선', '경주 APEC 기간 대릉원 인근 숙박시설 정보 알려주세요.'],
      h2Titles: ['보문단지 남은 객실', '예약 시기'],
      relevance: CTX,
    });
    expect(t.source).toBe('kin');
    expect(t.question).toBe('경주 APEC 기간 대릉원 인근 숙박시설 정보 알려주세요.');
  });

  test('A-12 지식iN 전부 무관하면 제목 약속으로 내려간다 (무관 질문이 실이 되지 않는다)', () => {
    const t = buildThread({
      title: CTX.title, keyword: KW,
      userQuestions: ['국내 여름 휴양지 추천 10 선'],
      h2Titles: ['보문단지 남은 객실'],
      relevance: CTX,
    });
    expect(t.source).not.toBe('kin');
    expect(t.question).not.toMatch(/휴양지/);
  });

  test('A-13 relevance 문맥을 안 주면(예전 호출부) 동작이 그대로다', () => {
    const t = buildThread({ title: CTX.title, keyword: KW, userQuestions: ['국내 여름 휴양지 추천 10 선'], h2Titles: ['x'] });
    expect(t.source).toBe('kin');
  });
});
