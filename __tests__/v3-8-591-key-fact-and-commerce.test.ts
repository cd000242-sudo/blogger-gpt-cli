/**
 * v3.8.591 — 병이 "지어내기"에서 "빠뜨리기"로 넘어왔다
 *
 * ## 실제 사고 (발행글 5432)
 * "2026년 9월 추석 대비 지자체 10% 할인가맹점" 글에 **할인율이 한 번도 안 나왔다.**
 * 제목의 10%조차 본문에 없었다. 결정적 물증:
 *   "평달과 명절 달의 차이도 분명합니다." — 그 차이가 얼마인지 끝까지 안 말한다.
 *
 * 근거에는 있었다(실측):
 *   네이버 무료 근거 6,892자 — 10% 9회 · 15% 2회 · 25% 2회
 *   퍼플렉시티 2,351자 — 10% 13회
 * 자료를 못 구한 게 아니라 **손에 쥐고도 안 썼다.**
 *
 * ## 기존 검사는 전부 반대 방향을 본다
 *   fact-guard   근거에 **없는** 수치를 찾는다 (지어내기)
 *   실속 게이트   팩트 **밀도**만 잰다 — 다른 숫자로 채우면 통과
 *                (실측: 할인율이 통째로 빠진 글이 팩트 74개로 91점)
 * 재현으로 확인: fact-integrity 에 실제 근거를 물려 보니 15%·10%·25% 가 **전부 통과**했다.
 * 즉 규칙이 지운 게 아니라 애초에 안 쓴 것이다.
 *
 * ## 그리고 링크 버그가 라벨을 바꿔 재발했다
 * 지역화폐 정보글의 CTA 가 **롯데온 쇼핑몰**로 나갔다.
 *   judgeCtaHost('https://www.lotteon.com') → { ok: true, reason: 'catalog' }
 * 카탈로그에 `롯데 선물세트 / lotteon.com` 이 태그 `명절·추석·선물세트`, weight 10 으로
 * 등록돼 있다. v3.8.574 에서 "공식 권장" **배지**는 기관만 받도록 고쳤는데,
 * **목적지를 거르는 관문은 그대로**여서 라벨만 바뀐 같은 링크가 나갔다.
 */
import {
  findMissingKeyFacts, describeMissingKeyFacts, hasMissingKeyFacts, buildKeyFactDirective,
} from '../src/core/final/key-fact-gate';
import { judgeCtaHost, isCommerceUrl } from '../src/cta/host-trust';
import { blockBetween } from './helpers/source-block';

const 근거 = '보령사랑상품권은 구매 시 10% 할인 혜택이 제공되며 통합 1인당 월 70만 원이다. '
  + '평달에는 결제 금액의 10%, 명절이 있는 달에는 15%의 캐시백 혜택을 받을 수 있다. '
  + '명절 달에는 15%를 지급한다. 합치면 최대 25% 할인 효과이며 25% 수준이다.';

describe('① 자료에 있는데 본문에 없는 수치를 잡는다', () => {
  test('⭐ 실측 그 글 — 할인율이 통째로 빠진 경우', () => {
    const m = findMissingKeyFacts({
      keyword: '2026년 9월 추석 대비 지자체 10% 할인가맹점',
      evidenceText: 근거,
      bodyText: '추석 전에는 가맹점을 미리 확인해 두는 편이 좋습니다. 평달과 명절 달의 차이도 분명합니다.',
    });
    expect(m.promised).toContain('10%');       // 제목이 약속한 수치
    expect(m.repeated).toEqual(expect.arrayContaining(['15%', '25%']));
    expect(describeMissingKeyFacts(m)).toContain('제목이 약속한 수치');
  });

  test('제대로 쓴 글은 통과시킨다', () => {
    const m = findMissingKeyFacts({
      keyword: '지자체 10% 할인가맹점',
      evidenceText: 근거,
      bodyText: '평달 캐시백은 10%, 추석이 있는 9월은 15%입니다. '
        + '구매 할인 10%까지 더하면 최대 25%이고 한도는 월 70만 원입니다.',
    });
    expect(hasMissingKeyFacts(m)).toBe(false);
    expect(describeMissingKeyFacts(m)).toContain('누락 없음');
  });

  /** 한 문서에만 스친 숫자는 곁가지일 수 있다 — 여러 자료가 말할 때만 뼈대로 본다 */
  test('한 번만 나온 숫자는 요구하지 않는다', () => {
    const m = findMissingKeyFacts({
      keyword: '지원금',
      evidenceText: '어떤 자료에 3,700원이라는 값이 한 번 나옵니다.',
      bodyText: '지원금 안내입니다.',
    });
    expect(m.repeated).not.toContain('3,700원');
  });

  test('띄어쓰기가 달라도 같은 값으로 본다', () => {
    const m = findMissingKeyFacts({
      keyword: '지원금',
      evidenceText: '월 70만 원입니다. 한도는 70만 원입니다.',
      bodyText: '한도는 월 70만원입니다.',
    });
    expect(m.repeated).not.toContain('70만원');
  });

  test('빈 값에 던지지 않는다', () => {
    for (const bad of ['', null, undefined]) {
      expect(() => findMissingKeyFacts({
        keyword: bad as any, evidenceText: bad as any, bodyText: bad as any,
      })).not.toThrow();
    }
  });
});

describe('② 쓰기 전 지시가 실제 실패 문장을 겨냥한다', () => {
  const d = buildKeyFactDirective('2026년 9월 추석 대비 지자체 10% 할인가맹점');

  test('실제로 나갔던 그 문장을 나쁜 예로 박아 둔다', () => {
    expect(d).toContain('평달과 명절 달의 차이도 분명합니다');
    expect(d).toContain('차이가 **얼마인지** 말하지 않으면');
  });

  test('제목이 약속한 수치를 짚어 준다', () => {
    expect(d).toContain('제목이 이 수치를 약속했습니다: 10%');
  });

  test('비교를 쓸 때 전후 값을 요구한다', () => {
    expect(d).toContain('전후 값');
  });
});

describe('③ 정보글에 쇼핑몰 링크를 넣지 않는다', () => {
  test('⭐ 실측 그 링크 — 지역화폐 글의 롯데온', () => {
    expect(judgeCtaHost('https://www.lotteon.com', '추석 지역화폐')).toEqual({
      ok: false, reason: 'commerce',
    });
  });

  test('주요 쇼핑몰을 모두 막는다', () => {
    for (const u of [
      'https://www.coupang.com', 'https://smartstore.naver.com/x',
      'https://www.11st.co.kr', 'https://www.gmarket.co.kr', 'https://www.ssg.com',
    ]) expect(judgeCtaHost(u, '아무 주제').ok).toBe(false);
  });

  /** 카탈로그는 쇼핑 모드를 위해 커머스를 품고 있다 — 그 모드에선 맞다 */
  test('쇼핑·제휴 모드에서는 그대로 통과시킨다', () => {
    expect(judgeCtaHost('https://www.lotteon.com', '추석 선물세트', [], '', { allowCommerce: true }).ok).toBe(true);
  });

  test('기관 링크는 그대로 통과한다 (과잉 차단 금지)', () => {
    for (const u of ['https://www.gov.kr', 'https://www.work.go.kr', 'https://www.nhis.or.kr']) {
      expect(judgeCtaHost(u, '아무 주제').ok).toBe(true);
    }
  });

  test('커머스 판별이 따로 열려 있다 (본문 링크 검사에서도 쓴다)', () => {
    expect(isCommerceUrl('https://www.lotteon.com/p/1')).toBe(true);
    expect(isCommerceUrl('https://www.gov.kr')).toBe(false);
  });
});

describe('④ 발행 경로에 배선돼 있다', () => {
  const fs = require('fs');
  const path = require('path');
  const orch = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf-8',
  );

  test('쓰기 전 지시가 프롬프트에 들어간다', () => {
    expect(orch).toContain('buildKeyFactDirective(keyword)');
    expect(orch).toContain('...(keyFactDirective ? [keyFactDirective] : [])');
  });

  test('쓴 뒤 검사도 돈다', () => {
    expect(orch).toContain('findMissingKeyFacts({');
    expect(orch).toContain('[KEY-FACT]');
  });

  /** 근거 전체(무료 + 유료)를 다 봐야 한다 — 한쪽만 보면 놓친다 */
  test('무료·유료 근거를 합쳐서 본다', () => {
    // 길이로 자르지 않는다 — 위아래가 조금만 바뀌어도 검사 범위가 어긋난다
    const block = blockBetween(orch, 'findMissingKeyFacts({', '});');
    expect(block).toContain('factEvidence.context');
    expect(block).toContain('naverGrounding');
  });

  test('발행을 막지 않는다', () => {
    // 검사 시작부터 catch 까지를 경계로 잘라 본다 (길이로 자르지 않는다)
    const block = blockBetween(orch, 'const missing = findMissingKeyFacts({', '[KEY-FACT] 스킵');
    expect(block).toContain('catch (keyFactErr');
    expect(block).not.toContain('throw new Error');
  });
});
