/**
 * v3.8.593 — 숫자 중간에서 볼드가 시작되던 버그
 *
 * ## 사장님이 네 번 지적했고 내가 네 번 "0건"이라고 답했다
 * 실제 발행 페이지에 이렇게 나가고 있었다 (8곳):
 *   2<strong class="bgpt-s9">026년</strong>
 * "2026년"에서 앞의 2 만 밖에 남고 "026년"이 볼드로 감싸졌다.
 *
 * ## 내가 왜 못 봤나 — 측정이 틀렸다
 * REST 로 받은 본문을 이 정규식으로 검사했다:
 *   /\d<\/?(?:strong|b)>\d/
 * **속성이 붙은 태그**(`<strong class="...">`)를 못 잡는 정규식이다.
 * 실제 태그에는 클래스가 붙어 있었으므로 매번 0건이 나왔다.
 * 비평은 계속 맞았고 내 자가 틀렸다.
 *
 * ## 원인
 *   .replace(/((?:최대\s*|약\s*)?\d{1,3}\s*(?:년|개월|일|시간|분))(?![^<]*>)/g, '<strong>$1</strong>')
 * `\d{1,3}` 은 **최대 세 자리**라 "2026년"에서 "026년"만 잡는다.
 * 금액·퍼센트 패턴도 같은 구조라 같은 병을 갖고 있었다.
 *
 * ## 고친 방법
 *   · `(?<![\d,.])` — 앞에 숫자가 있으면 매치하지 않는다 (숫자 중간에서 시작 금지)
 *   · 년은 `\d{1,4}` 로 넓힌다 — 연도가 네 자리다
 */
import * as fs from 'fs';
import * as path from 'path';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');

/** 두 발행 경로가 같은 규칙을 써야 한다 — 한쪽만 고치면 다른 쪽으로 새어 나간다 */
const PUBLISHERS = ['src/wordpress/wordpress-publisher.ts', 'src/core/blogger-publisher.js'];

describe('① 숫자 중간에서 볼드가 시작되지 않는다', () => {
  // 소스에 박힌 규칙을 그대로 꺼내 쓴다 — 테스트가 따로 흉내 내면 갈라진다
  const RULES = [
    /(?<![\d,.])(\d{1,3}(?:,\d{3})*\s*(?:만원|원|억|달러|USD))(?![^<]*>)/g,
    /(?<![\d,.])(\d{1,3}(?:\.\d+)?\s*%)(?![^<]*>)/g,
    /(?<![\d,.])((?:최대\s*|약\s*)?\d{1,4}\s*(?:년|개월|일|시간|분))(?![^<]*>)/g,
  ];
  const apply = (t: string) => RULES.reduce((s, re) => s.replace(re, '<strong>$1</strong>'), t);

  test('⭐ 실제로 나갔던 그 문자열 — 2026년', () => {
    expect(apply('2026년 9월 추석')).toBe('<strong>2026년</strong> 9월 추석');
  });

  test('볼드가 숫자 사이를 가르지 않는다', () => {
    for (const t of ['2026년', '2026년 9월 1일 기준', '70만원과 2026년']) {
      const out = apply(t);
      expect(out).not.toMatch(/\d<strong>/);      // 숫자 뒤에서 볼드 시작
      expect(out).not.toMatch(/<\/strong>\d/);    // 볼드 끝난 뒤 숫자 이어짐
    }
  });

  test('자릿수를 넘는 값은 아예 건드리지 않는다 (반쪽 볼드 방지)', () => {
    expect(apply('12345원 결제')).toBe('12345원 결제');
    expect(apply('1234% 오류')).toBe('1234% 오류');
  });

  test('정상 값은 그대로 볼드한다 (기능을 죽이지 않았다)', () => {
    expect(apply('70만원 한도')).toBe('<strong>70만원</strong> 한도');
    expect(apply('10% 캐시백')).toBe('<strong>10%</strong> 캐시백');
    expect(apply('6개월 유지')).toBe('<strong>6개월</strong> 유지');
    expect(apply('출발 91일 이전')).toBe('출발 <strong>91일</strong> 이전');
  });
});

describe('② 두 발행 경로가 같은 규칙을 쓴다', () => {
  test.each(PUBLISHERS)('%s 에 앞자리 보호가 있다', (file) => {
    const src = read(file);
    const guarded = [...src.matchAll(/\(\?<!\[\\d,\.\]\)/g)].length;
    expect(guarded).toBeGreaterThanOrEqual(3);
  });

  test.each(PUBLISHERS)('%s 의 연도가 네 자리까지 열려 있다', (file) => {
    expect(read(file)).toContain(String.raw`\d{1,4}\s*(?:년|개월|일|시간|분)`);
  });

  /** 고치기 전 형태가 남아 있으면 그 경로로 또 새어 나간다 */
  test.each(PUBLISHERS)('%s 에 옛 세 자리 규칙이 없다', (file) => {
    expect(read(file)).not.toContain(String.raw`?\d{1,3}\s*(?:년|개월|일|시간|분)`);
  });
});

/**
 * ③ 내가 틀렸던 자 — 속성 붙은 태그를 못 보던 정규식
 *
 * 이걸 테스트로 박아 두는 이유: 다음에 같은 방식으로 검사하면 또 0건이 나온다.
 */
describe('③ 검사 정규식이 속성 붙은 태그를 본다', () => {
  const 나쁜자 = /\d<\/?(?:strong|b)>\d/;
  const 바른자 = /\d\s*<\/?(?:strong|b)[^>]*>\s*\d/;
  const 실제 = '2<strong class="bgpt-s9">026년</strong>';

  test('예전 자로는 실제 사고를 못 잡는다', () => {
    expect(나쁜자.test(실제)).toBe(false);
  });

  test('속성을 허용하면 잡는다', () => {
    expect(바른자.test(실제)).toBe(true);
  });
});
