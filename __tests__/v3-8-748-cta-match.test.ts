/**
 * 748 — CTA 적합성 세 가지. live Run 3 실측 사례가 기준이다.
 *   경주 APEC 숙소 예약 글의 CTA 가 국립경주박물관 전시 페이지를 "예약 안내 확인" 으로 걸었다.
 *   근거 장부에 있던 주소라 기존 검사는 통과했고, Judge 가 CTA_OFFTOPIC·MIXED_ENTITY 로 막았다.
 * 규칙: 공식 도메인이라는 이유만으로 자격을 주지 않는다 · 맞는 목적지가 없으면 링크를 뺀다.
 */
import { checkCtaMatch, actionOf, subjectTokens } from '../src/cta/cta-match';

const ARTICLE = { keyword: '경주 APEC 기간 숙소 예약', title: '경주 APEC 기간 숙소 예약, 대릉원 근처는 왜 막혔나' };

describe('live Run 3 재현 — 박물관 전시 페이지는 숙소 예약 CTA 가 될 수 없다', () => {
  it('⭐ gyeongju.museum.go.kr 은 탈락한다 (.go.kr 이어도)', () => {
    const v = checkCtaMatch({
      ...ARTICLE,
      action: '🔗 예약 안내 확인',
      destination: { url: 'https://gyeongju.museum.go.kr/kor/html/sub03/030101.html', title: '신라 금관, 권력과 위신 — 국립경주박물관', text: '국립경주박물관 상설전시관 신라역사관 소장품 전시 안내입니다.' },
    });
    expect(v.ok).toBe(false);
    expect(v.failed).toBe('CTA_DESTINATION_MATCH');
    expect(v.reason).toMatch(/전시관람|박물관/);
  });

  it('⭐ 같은 도메인이라도 숙박 안내 페이지면 통과한다 — 도메인이 아니라 내용으로 판단한다', () => {
    const v = checkCtaMatch({
      ...ARTICLE,
      action: '🔗 예약 안내 확인',
      destination: { url: 'https://www.gyeongju.go.kr/tour/page.do?mnu_uid=2118', title: '경주 문화관광 — 숙박시설 예약 안내', text: '보문단지·시내권 숙박시설 목록과 객실 예약 방법을 안내합니다.' },
    });
    expect(v.ok).toBe(true);
    expect(v.failed).toBeNull();
  });
});

describe('CTA_ENTITY_MATCH — 지역·일반어만 겹치는 것은 겹친 게 아니다', () => {
  it('지역 이름(경주)만 같고 주제가 다르면 탈락', () => {
    const v = checkCtaMatch({
      ...ARTICLE,
      action: '자세히 보기',
      destination: { url: 'https://www.gyeongju.go.kr/news/page.do', title: '경주시 보도자료 — 시민 체육대회 개최', text: '경주시는 시민 체육대회를 개최한다고 밝혔다.' },
    });
    expect(v.ok).toBe(false);
    expect(['CTA_ENTITY_MATCH', 'CTA_DESTINATION_MATCH']).toContain(v.failed);
  });

  it('"안내·정보·공식·홈페이지" 같은 일반어는 주제 낱말로 세지 않는다', () => {
    const t = subjectTokens('경주 APEC 기간 숙소 예약 공식 안내 정보');
    expect(t.has('숙소')).toBe(true);
    expect(t.has('예약')).toBe(true);
    expect(t.has('경주')).toBe(false);   // 지역
    expect(t.has('안내')).toBe(false);   // 일반어
    expect(t.has('공식')).toBe(false);
  });

  it('숙소 ↔ 숙박 처럼 같은 것을 가리키는 말은 겹침으로 본다', () => {
    const v = checkCtaMatch({
      ...ARTICLE,
      action: '🔗 예약하기',
      destination: { url: 'https://example.kr/rooms', title: '숙박 예약', text: '객실 예약 페이지' },
    });
    expect(v.ok).toBe(true);
  });
});

describe('CTA_ACTION_MATCH — 약속한 행동을 할 수 있는 곳인가', () => {
  it('"예약하기" 인데 목적지가 채용 공고면 탈락', () => {
    const v = checkCtaMatch({
      keyword: '전기차 보조금 하반기 추가 공고',
      title: '전기차 보조금 하반기 추가 공고, 지금 신청해도 되는 지역',
      action: '🔗 보조금 신청하기',
      destination: { url: 'https://www.example.go.kr/recruit', title: '직원 채용 공고', text: '2026년 상반기 직원 채용 공고입니다.' },
    });
    expect(v.ok).toBe(false);
    expect(v.failed).toBe('CTA_ACTION_MATCH');
  });

  it('행동 낱말이 목적지에 있으면 통과 (신청 ↔ 접수)', () => {
    const v = checkCtaMatch({
      keyword: '전기차 보조금 하반기 추가 공고',
      action: '🔗 보조금 신청하기',
      destination: { url: 'https://ev.or.kr/apply', title: '전기차 구매 보조금 접수', text: '보조금 신청 접수 화면입니다.' },
    });
    expect(v.ok).toBe(true);
  });

  it('actionOf 는 문구에서 행동을 뽑는다', () => {
    expect(actionOf('🔗 경주시에서 예약하기')).toBe('예약');
    expect(actionOf('🔗 신청 안내 확인')).toBe('신청');
    expect(actionOf('자세히 보기')).toBeNull();
  });
});

describe('모르면 막지 않는다 · 링크가 없으면 탈락', () => {
  it('근거 장부에 제목·본문이 없으면(주소만) 통과시킨다 — 옛 경로 회귀 방지', () => {
    const v = checkCtaMatch({ ...ARTICLE, action: '🔗 예약하기', destination: { url: 'https://unknown.example.kr/x' } });
    expect(v.ok).toBe(true);
    expect(v.reason).toMatch(/목적지 정보 없음/);
  });

  it('주소가 비면 탈락', () => {
    expect(checkCtaMatch({ ...ARTICLE, destination: { url: '' } }).ok).toBe(false);
  });
});
