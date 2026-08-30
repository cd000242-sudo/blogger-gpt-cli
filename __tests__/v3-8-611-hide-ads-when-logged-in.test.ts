/**
 * v3.8.611 — 로그인한 운영자에게는 광고를 보이지 않는다
 *
 * 사장님 실제 사고: 본인 광고를 클릭해 게재가 일시정지됐다(~9/21).
 * 두 번째 적발은 계정 자체가 위험하다.
 *
 * 운영자는 발행 확인하러 자기 사이트를 하루에도 몇 번씩 연다.
 * 그 화면에 광고가 있으면 언젠가 눌린다 — 그리고 본인 노출은 **어차피 수익이 0**이다.
 * 가려서 잃는 것이 없고, 안 가리면 계정을 잃는다.
 */
import { generateCSSFinal } from '../src/core/final/html';

const css = generateCSSFinal('wordpress');

describe('로그인 상태에서만 가린다', () => {
  test('body.logged-in 을 기준으로 삼는다 — 워드프레스 코어가 붙이는 클래스', () => {
    expect(css).toContain('body.logged-in');
  });

  test('애드센스 단위를 가린다', () => {
    expect(css).toMatch(/body\.logged-in[^{]*\.adsbygoogle/);
    expect(css).toMatch(/body\.logged-in[^{]*ins\.adsbygoogle/);
  });

  test('앱이 심는 수동 광고 자리도 가린다', () => {
    expect(css).toMatch(/body\.logged-in[^{]*\.bgpt-ad\b/);
    expect(css).toMatch(/body\.logged-in[^{]*\[data-bgpt-ad-unit\]/);
  });

  test('실제로 감추는 규칙이다', () => {
    const rule = css.slice(css.indexOf('body.logged-in'));
    expect(rule).toMatch(/display: none !important/);
  });
});

describe('방문자 수익에는 손대지 않는다', () => {
  test('로그인 조건 없이 광고를 가리는 규칙은 없다', () => {
    /**
     * `.adsbygoogle { display:none }` 처럼 무조건 가리는 규칙이 있으면 방문자 수익이 0이 된다.
     *
     * 길이(idx+4)로 자르지 않는다 — 저장소 규칙이고, 규칙 길이가 바뀌면 검사가 헛돈다.
     * 선택자부터 그 규칙이 닫히는 `}` 까지, **경계로** 자른다.
     */
    for (const m of css.matchAll(/[^\n}]*\.adsbygoogle[^{]*\{[^}]*\}/g)) {
      const rule = m[0];
      if (/logged-in/.test(rule)) continue;          // 로그인 조건이 붙은 것은 정상
      expect(rule).not.toMatch(/display:\s*none/);
    }
  });

  test('본문 영역 안으로 한정한다 — 사이트 전체를 건드리지 않는다', () => {
    expect(css).toMatch(/body\.logged-in \.bgpt-content/);
  });
});
