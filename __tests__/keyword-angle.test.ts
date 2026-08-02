/**
 * 키워드 각도 분류기 테스트 (v3.8.384)
 *
 * 근거: 2026-07-28 엣지 리서치 — SERP 22회 실측으로 확인된 "개인이 대기업·정부를 이기는 5문형".
 * 각 테스트의 키워드는 실제 발행분 또는 일일 고CPC 리포트에서 가져왔다.
 */
import {
  analyzeKeywordAngle,
  composeTitleDirective,
} from '../src/core/keyword-angle';
import { braceBlock } from './helpers/source-block';

describe('5문형 판정 — 실제 키워드로', () => {
  it.each([
    // [키워드, 기대 문형, 출처]
    ['청년월세지원 지급일', 'payout', '실제 발행 · GSC 13.5위 자산'],
    ['새도약기금 언제 들어오나', 'payout', '실제 발행'],
    ['청년월세 소급 적용', 'payout', '리포트 롱테일'],
    ['후불제 상조 해지 환급금', 'cancel', '실제 발행 2026-07-26'],
    ['티빙 개인정보 유출 탈퇴', 'cancel', 'GSC 9.7위 최상위 자산'],
    ['실손보험 소액청구 불이익', 'downside', '리포트 S등급 1픽'],
    ['상조 가입 단점', 'downside', '리포트 파생'],
    ['서울 온누리상품권 사용처', 'lookup', 'GSC 10.6위 자산'],
    ['청년월세지원 결과 확인', 'lookup', 'GSC 13.5위 쿼리'],
    ['건강보험 자격 조회', 'lookup', '일반'],
    ['1·2세대 실손 5세대로 갈아타면', 'transition', '실제 발행 2026-07-26'],
    ['도수치료 관리급여 개편', 'transition', '제도변경 3건 중 하나'],
  ])('"%s" → %s (%s)', (kw, expected) => {
    const r = analyzeKeywordAngle(kw);
    expect(r.archetype).toBe(expected);
    expect(r.matched.length).toBeGreaterThan(0);
    expect(r.titleGuide).toBeTruthy();
    expect(r.bodyGuide).toBeTruthy();
  });
});

describe('문형별 제목 꼴이 실제로 다르다', () => {
  it('payout → 질문+숫자답형, 숫자 요구', () => {
    const r = analyzeKeywordAngle('청년월세지원 지급일');
    expect(r.titlePattern).toBe('질문+숫자답형');
    expect(r.titleGuide).toContain('숫자');
    // 근거 없는 숫자 날조를 막는 문장이 반드시 있어야 한다
    expect(r.titleGuide).toContain('지어내면 안 된다');
  });

  it('downside → 팩트체크 구도, 단정 금지', () => {
    const r = analyzeKeywordAngle('실손보험 청구 불이익');
    expect(r.titlePattern).toBe('팩트체크 구도');
    expect(r.titleGuide).toContain('단정');
    expect(r.bodyGuide).toContain('상충');
  });

  it('lookup → 괄호 나열형, 괄호와 H2 일치 요구', () => {
    const r = analyzeKeywordAngle('온누리상품권 사용처 조회');
    expect(r.titlePattern).toBe('괄호 나열형');
    expect(r.titleGuide).toContain('H2');
    expect(r.bodyGuide).toContain('표');
  });

  it('transition → 조건분기형', () => {
    const r = analyzeKeywordAngle('5세대 실손 갈아타기');
    expect(r.titlePattern).toBe('조건분기형');
    expect(r.titleGuide).toContain('갈라');
    expect(r.bodyGuide).toContain('시행일');
  });

  it('cancel → 덧셈형', () => {
    const r = analyzeKeywordAngle('상조 해지 위약금');
    expect(r.titlePattern).toBe('덧셈형');
    expect(r.bodyGuide).toContain('환급률');
  });
});

describe('문형 미해당 — 정직하게 경고한다', () => {
  it.each([
    ['긴급복지 생계지원', '정부 문서 독점 SERP'],
    ['2026 월드컵 일정', '오프토픽 (GSC 62위 실측)'],
    ['논산 훈련소 맛집', '오프토픽 (GSC 20위 실측)'],
  ])('"%s" → archetype null (%s)', (kw) => {
    const r = analyzeKeywordAngle(kw);
    expect(r.archetype).toBeNull();
    expect(r.titleGuide).toBeNull();
    expect(r.bodyGuide).toBeNull();
    // ⚠️ 미해당은 "나쁜 키워드"가 아니라 "이 목록으로 설명 안 됨"이다.
    //    단정하는 문구를 쓰면 실제로 좋은 키워드를 버리게 된다.
    expect(r.summary).toContain('SERP 선점 판정');
    expect(r.summary).not.toContain('정면 경쟁');
  });
});

describe('리포트 A등급이 미해당으로 빠지지 않는다 (실전 검증에서 발견한 결함)', () => {
  // 초기 cue 목록은 2026-07-28 고CPC 리포트의 A등급 2건을 미해당으로 떨어뜨렸다.
  // 5문형은 SERP 실측 목록이지 완전한 분류가 아니라는 증거다.
  it.each([
    ['직장 건강검진 과태료', 'downside', '과태료 = "안 하면 무슨 불이익" 계열'],
    ['청약 무주택기간', 'lookup', '기산일 = "내 경우 어떻게 계산되나" 계열'],
    ['실손보험 지급 거절 이의신청', 'downside', '거절 = 불이익 계열'],
    ['새도약기금 부결', 'downside', '부결 = 불이익 계열'],
  ])('%s → %s (%s)', (kw, expected) => {
    expect(analyzeKeywordAngle(kw).archetype).toBe(expected);
  });
});

describe('여러 문형에 걸리면 단서가 많은 쪽', () => {
  it('해지+환급+위약금(3단서)이 변경(1단서)을 이긴다', () => {
    const r = analyzeKeywordAngle('상조 해지 환급 위약금 변경');
    expect(r.archetype).toBe('cancel');
    expect(r.matched.length).toBeGreaterThanOrEqual(3);
  });
});

describe('견고성 — 순수 함수, 절대 throw 하지 않는다', () => {
  it.each([
    ['빈 문자열', ''],
    ['공백만', '   '],
    ['null', null],
    ['undefined', undefined],
    ['숫자', 12345],
    ['객체', {}],
    ['아주 긴 문자열', '가'.repeat(5000)],
    ['특수문자', '!@#$%^&*()[]{}'],
  ])('%s → throw 없이 결과 반환', (_n, input) => {
    expect(() => analyzeKeywordAngle(input as any)).not.toThrow();
    const r = analyzeKeywordAngle(input as any);
    expect(r).toHaveProperty('archetype');
    expect(Array.isArray(r.matched)).toBe(true);
  });

  it('한글 뒤 경계 문제 없이 부분 일치로 판정한다 (\\b 는 한글 뒤에서 안 먹는다)', () => {
    // 조사가 붙어도 판정돼야 한다
    expect(analyzeKeywordAngle('지급일이').archetype).toBe('payout');
    expect(analyzeKeywordAngle('해지는').archetype).toBe('cancel');
  });

  it('대소문자·공백 흔들림을 흡수한다', () => {
    expect(analyzeKeywordAngle('  청년월세지원   지급일  ').archetype).toBe('payout');
  });
});

describe('composeTitleDirective — 수요 힌트와 각도 결합', () => {
  const angle = analyzeKeywordAngle('청년월세지원 지급일');

  it('둘 다 있으면 합친다', () => {
    const d = composeTitleDirective('검색 실측: "청년월세지원"으로 시작하라.', angle);
    expect(d).toContain('검색 실측');
    expect(d).toContain('질문을 던지고');
  });

  it('수요 힌트만 있어도 동작한다', () => {
    const d = composeTitleDirective('검색 실측 힌트', analyzeKeywordAngle('긴급복지 생계지원'));
    expect(d).toBe('검색 실측 힌트');
  });

  it('각도만 있어도 동작한다', () => {
    const d = composeTitleDirective(null, angle);
    expect(d).toContain('개인 승산 문형');
  });

  it('둘 다 없으면 null — 프롬프트에 아무것도 넣지 않는다', () => {
    const d = composeTitleDirective(null, analyzeKeywordAngle('긴급복지 생계지원'));
    expect(d).toBeNull();
  });

  it('잘못된 입력에도 throw 하지 않는다', () => {
    expect(() => composeTitleDirective(undefined, undefined)).not.toThrow();
    expect(composeTitleDirective(undefined, undefined)).toBeNull();
  });
});

describe('orchestration 배선 가드', () => {
  const src = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf8');

  it('각도 분류기를 import 하고 호출한다', () => {
    expect(src).toContain("from '../keyword-angle'");
    expect(src).toContain('analyzeKeywordAngle(keyword)');
  });

  it('수요 힌트와 각도를 합쳐 제목 프롬프트에 넘긴다', () => {
    expect(src).toContain('composeTitleDirective(demandHint, angle)');
    // v3.8.404: 쇼핑 상품 등록명을 넘기려고 4번째 인자가 붙었다 — 인자 구성으로 확인한다
    const j = src.indexOf('generateH1TitleFinal(');
    expect(j).toBeGreaterThan(-1);
    const callBlock = braceBlock(src, 'generateH1TitleFinal(');
    expect(callBlock).toContain('keyword');
    expect(callBlock).toContain('titles');
    expect(callBlock).toContain('demandTitleHint');
  });

  it('전체가 try/catch 안에 있어 발행을 막지 않는다', () => {
    const start = src.indexOf('키워드 수요 실측 게이트');
    const end = src.indexOf('관측 전용 — 어떤 실패도 발행 흐름에');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
  });
});
