import { postProcessForApproval } from '../src/core/content-modes/adsense/adsense-post-processor';
import { auditArticle, findReplacementArtifacts } from '../src/core/final/article-audit';

/*
 * v3.8.656 — 애드센스 후처리가 "그래서$1" 을 발행했다.
 *
 * 접속사 교체가 replace 콜백 안에서 '그래서$1' 문자열을 그대로 돌려줬다.
 * 콜백이 돌려주는 문자열은 `$1` 이 치환되지 않는다. 실측 3편 중 2편에 박혔고,
 * 하네스는 96점을 줬다 — 어느 검사도 안 봤다.
 */
describe('v3.8.656 치환 찌꺼기', () => {
  const para = (s: string) => `<p>${s}</p>`;
  const html = [
    para('경유차 기준입니다. 따라서 등급을 봅니다.'),
    para('저감장치도 봅니다. 따라서 장치 자료를 냅니다.'),
    para('면제 사유도 봅니다. 따라서 자동차 1대를 대조합니다.'),
  ].join('\n');

  test('접속사 교체 뒤에 $1 이 남지 않고 구분자(공백)가 들어간다', () => {
    const out = postProcessForApproval(html).html;
    expect(out).not.toContain('$1');
    // 두 번째 매치부터 교체된다 — 교체어 뒤에 원래 공백이 붙어야 한다
    expect(out).toMatch(/그래서 장치|이런 이유로 장치/);
  });

  test('검사기가 찌꺼기를 잡는다 — 글자 뒤 $숫자, undefined, [object Object]', () => {
    expect(findReplacementArtifacts('그래서$1경유차 여부를')).toHaveLength(1);
    expect(findReplacementArtifacts('값은 undefined 입니다')).toHaveLength(1);
    expect(findReplacementArtifacts('결과 [object Object]')).toHaveLength(1);
  });

  test('정상 글은 안 잡는다 — 금액 "$100", 코드 없는 평문', () => {
    expect(findReplacementArtifacts('비용은 $100 이고 환율은 1,300원입니다.')).toHaveLength(0);
    expect(findReplacementArtifacts('그래서 경유차 여부를 확인합니다.')).toHaveLength(0);
  });

  test('하네스 점수에 들어간다', () => {
    const r = auditArticle('<h2>1. 절</h2><p>그래서$1경유차 여부를 확인합니다.</p>');
    expect(r.issues.map((i) => i.kind)).toContain('replacement-artifact');
  });
});
