/**
 * 지식iN 질문 관련도 — 키워드 복합어의 **짧은 조각만** 겹치면 같은 주제가 아니다
 * (v3.8.750 · POST-PUBLISH AUDIT, leadernam 5865)
 *
 * 실측: 키워드 "2026 신규사업자 카드수수료 환급 조회" 의 지식iN 2번 「카드 미납 질문」(신한카드 800 미납·이자·압류)이
 *   질문 낱말 「카드」 가 키워드 낱말 「카드수수료」 안에 있다는 이유만으로 748 관련도 필터(thread.ts)를 통과했다.
 *   통과 목록의 첫째라 실의 「독자의 문제」가 되어 도입이 미납을 물었고, 같은 목록이 소제목 재료(검색자 질문)로 가서
 *   H2 「7. 미납 상태에서 확인할 사항」 이 생겼다. FAQ·결론·메타설명까지 미납 20문장. 재현한 제목 5개 중 3개에도 "미납".
 * 고친 것: 기존 필터의 겹침 판단 한 줄 — 질문 낱말이 키워드 낱말의 조각일 때는 3글자 이상이거나 그 낱말의 60% 이상일 때만
 *   같은 대상으로 센다. 새 관문·새 AI 호출·특정 낱말 하드코딩 없음.
 */
import { buildThread, filterThreadQuestions } from '../src/core/final/thread';
import FIXTURE_SETS from './fixtures/thread-kin-sets-2026-09-23.json';

const KW = '2026 신규사업자 카드수수료 환급 조회';
const POST_5865_KIN = [
  '개인회생 진행시 서울보증보험 재가입 가능한가요?',
  '카드 미납 질문',
  '신용회복8회차납부 새출발 납부유예기간중',
  '대출 받을 수 있을까요 막막하네요',
  '소상공인 카드수수료 환급, 실제로 얼마나 돌려받을 수 있나....',
];

describe('5865 실제 입력 (캐시된 지식iN 5건 그대로)', () => {
  it('⭐⭐ 「카드 미납 질문」 은 조각 겹침뿐이라 떨어지고 주 의도 질문만 산다', () => {
    const r = filterThreadQuestions(POST_5865_KIN, { keyword: KW });
    expect(r.accepted).toEqual(['소상공인 카드수수료 환급, 실제로 얼마나 돌려받을 수 있나....']);
    const drop = r.dropped.find((d) => d.question === '카드 미납 질문');
    expect(drop?.reason).toBe('NO_ENTITY_OVERLAP');
    expect(drop?.detail).toMatch(/「카드」.*「카드수수료」/);
  });

  it('⭐⭐ 실(독자의 문제)이 주 의도 질문이 된다 — 도입이 미납을 묻지 않는다', () => {
    const t = buildThread({ title: '2026년 신규사업자 카드수수료 환급 조회 평균 38만7천원', keyword: KW, userQuestions: POST_5865_KIN, relevance: { keyword: KW } });
    expect(t.source).toBe('kin');
    expect(t.question).toBe('소상공인 카드수수료 환급, 실제로 얼마나 돌려받을 수 있나....');
  });

  it('⭐ 2차(제목·패킷 뒤)도 같다', () => {
    const r = filterThreadQuestions(POST_5865_KIN, { keyword: KW, title: '2026년 신규사업자 카드수수료 환급 조회 평균 38만7천원', packetText: '신규 신용카드가맹점 15만9천곳 · 평균 38만7천원 · 카드대금 지급 계좌' });
    expect(r.accepted).toEqual(['소상공인 카드수수료 환급, 실제로 얼마나 돌려받을 수 있나....']);
  });
});

describe('필요한 보조 의도는 지킨다', () => {
  it('⭐ 조각이 3글자 이상이면 같은 대상 — 「도약계좌」⊂「청년도약계좌」', () => {
    expect(filterThreadQuestions(['도약계좌 중도해지하면 불이익 있나요'], { keyword: '청년도약계좌 해지 방법' }).accepted).toHaveLength(1);
  });

  it('⭐ 조각이 그 낱말의 60% 이상이면 같은 대상 — 「환급」⊂「환급금」', () => {
    expect(filterThreadQuestions(['환급 언제 들어오나요'], { keyword: '근로장려금 환급금 조회' }).accepted).toHaveLength(1);
  });

  it('⭐ FAQ 로 쓸 만한 보조 질문(폐업 사업자도 받나)은 산다 — 온전한 낱말로 겹친다', () => {
    expect(filterThreadQuestions(['폐업한 사업자도 카드수수료 환급 받을 수 있나요'], { keyword: KW }).accepted).toHaveLength(1);
  });

  it('⭐ 온전한 낱말 하나라도 겹치면 산다 — 조각만 있을 때만 뺀다', () => {
    expect(filterThreadQuestions(['카드 환급 입금일 언제인가요'], { keyword: KW }).accepted).toHaveLength(1);
  });

  it('⭐ 질문 낱말이 키워드 낱말을 품으면(「카드수수료환급」⊃「카드수수료」) 예전처럼 산다', () => {
    expect(filterThreadQuestions(['카드수수료환급 조회 사이트'], { keyword: KW }).accepted).toHaveLength(1);
  });
});

/**
 * 실전 질문 묶음 회귀 0 — 수정 전과 통과 목록이 한 글자도 같아야 한다.
 *   저장: quality-run-output 의 라이브 실행(경주 APEC 5회·전기차 2회 — 같은 질문이라 하나씩)
 *   오늘: 2026-09-23 네이버 지식iN 에서 받은 정책·금융·연예·자동차·여행 키워드 질문
 * 수정 전후 13묶음을 돌려 달라진 것은 5865 의 「카드 미납 질문」 하나뿐이었다.
 */
describe('실전 질문 묶음 — 수정 전과 같은 결과 (정책·금융·연예·자동차·여행)', () => {
  const sets = FIXTURE_SETS as Array<{ name: string; keyword: string; questions: string[]; accepted: string[] }>;

  it('묶음이 다 있다 (7묶음 · 57문항)', () => {
    expect(sets).toHaveLength(7);
    expect(sets.reduce((n, s) => n + s.questions.length, 0)).toBe(57);
  });

  it.each(sets.map((s) => [s.name, s] as const))('⭐ %s', (_name, set) => {
    expect(filterThreadQuestions(set.questions, { keyword: set.keyword }).accepted).toEqual(set.accepted);
  });
});
