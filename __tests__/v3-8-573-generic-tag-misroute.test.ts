/**
 * v3.8.573 — 범용어 하나로 목적지가 정해지던 문제 (사장님 발견)
 *
 * ## 실제 사고
 * "2026년 헬스장 PT 환불 위약금 10% 방어 및 소비자원 피해구제" 글의 CTA 가
 * **SRT 승차권 조회**로 나갔다. 사장님: "이글은 왜 승차권으로 cta를 만들거니"
 *
 * ## 원인
 * 카탈로그의 `SRT 예매` 항목:
 *     tags: ["srt","예매","좌석","발권","환불","취소","좌석변경","기차","여행"], weight: 8
 * 헬스장 **환불** 글이 `환불`·`취소` 두 태그에 걸려 점수를 얻고, 거기에 weight 8 이 붙어
 * 정작 맞는 `한국소비자원`(tags: 소비자·피해구제·분쟁조정·환불·교환, weight 없음)을 이겼다.
 *
 * 태그 자체는 잘못이 아니다 — SRT 글에서 "환불"은 쓸모 있는 신호다.
 * 문제는 **범용어만으로도 "이 기관이 맞다"가 성립했다는 것**이다.
 */
import { resolveOfficialLink } from '../src/cta/resolve';

const nameOf = (q: string, intent?: any) => resolveOfficialLink({ query: q, intent })?.name || null;
const urlOf = (q: string, intent?: any) => resolveOfficialLink({ query: q, intent })?.url || null;

describe('① 사고 재현 — 환불 글이 승차권으로 가면 안 된다', () => {
  const 헬스장 = '2026년 헬스장 PT 환불 위약금 10% 방어 및 소비자원 피해구제';

  test('헬스장 환불 글이 SRT·코레일로 가지 않는다', () => {
    const url = urlOf(헬스장) || '';
    expect(url).not.toMatch(/srail|korail/i);
  });

  /** 막는 데서 끝나면 안 된다 — 맞는 곳으로 가야 고친 것이다 */
  test('맞는 곳(한국소비자원)으로 간다', () => {
    expect(nameOf(헬스장)).toBe('한국소비자원');
  });

  test('범용어만 겹치는 다른 환불 글도 마찬가지다', () => {
    for (const q of [
      '학원비 환불 위약금 기준',
      '상조 해지 환급금 계산',
      '통신사 위약금 취소 환불 절차',
    ]) {
      expect(urlOf(q) || '').not.toMatch(/srail|korail/i);
    }
  });
});

describe('② 진짜 그 기관인 글은 그대로 찾아간다 (과잉 차단 금지)', () => {
  test('SRT 글은 여전히 SRT 로 간다', () => {
    expect(urlOf('SRT 예매 취소 환불 방법')).toMatch(/srail/i);
    expect(urlOf('SRT 좌석 발권 방법')).toMatch(/srail/i);
  });

  test('코레일 글은 코레일로 간다', () => {
    expect(urlOf('코레일 KTX 예매 방법')).toMatch(/korail/i);
  });

  test('기관 이름이 검색어에 있으면 당연히 찾는다', () => {
    expect(nameOf('한국소비자원 피해구제 신청')).toBe('한국소비자원');
    expect(urlOf('복지로 지원금 신청')).toMatch(/bokjiro/i);
    expect(urlOf('정부24 민원 발급')).toMatch(/gov\.kr/i);
  });
});

describe('③ 범용어 목록이 지나치게 넓지 않다', () => {
  /**
   * 기관을 특정하는 낱말까지 범용어로 묶으면 CTA 가 통째로 사라진다.
   * 아래는 **반드시 특정 신호로 남아야 하는** 말들이다.
   */
  test('기관·제도 이름은 범용어가 아니다', () => {
    const { GENERIC_TAGS } = require('../src/cta/resolve');
    if (!GENERIC_TAGS) return;   // 내보내지 않으면 이 검사는 건너뛴다
    for (const word of ['피해구제', '분쟁조정', '실업급여', '근로장려금', '취득세', 'srt', '코레일']) {
      expect(GENERIC_TAGS.has(word)).toBe(false);
    }
  });

  /**
   * 이게 이번 수정의 핵심 불변식이다 — 범용어만 있으면 목적지를 정하지 않는다.
   * 예전엔 "환불 취소"만으로 SRT(weight 8)가 뽑혔다.
   */
  test('범용어만 있는 검색어로는 목적지를 정하지 않는다', () => {
    for (const q of ['신청 접수 기간 안내', '조회 변경 문의']) {
      expect(resolveOfficialLink({ query: q })).toBeNull();
    }
  });
});

describe('④ 소스에 근거가 남아 있다', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src/cta/resolve.ts'), 'utf-8');

  test('범용어 목록과 그 이유가 코드에 적혀 있다', () => {
    expect(src).toContain('const GENERIC_TAGS');
    expect(src).toContain('헬스장');          // 무엇 때문에 만든 규칙인지
  });

  test('범용어는 점수는 주되 특정 신호로는 세지 않는다', () => {
    expect(src).toContain('const mark = (tag: string) =>');
    expect(src).toContain('if (!GENERIC_TAGS.has(tag)) hasDirectSignal = true;');
  });
});
