/**
 * 소제목 파스텔 상자는 소제목에만 (v3.8.750)
 *
 * 749 에서 퍼블리셔 덧칠이 사라지자 스킨의 h3 파스텔 규칙(v3.8.419)이 드러났다. 사장님은 소제목 상자를
 * 유지하기로 했다(2026-09-23). 그런데 이 규칙은 .white-paper 안의 **모든** h3 에 걸린다. 소제목은
 * 자기 인라인 파스텔(data-orbit-h3box, v3.8.433)을 이미 두르고 있어서, 실제로 이 규칙이 새로 칠하는 것은
 * 부품 제목뿐이었다 — 라이브 URL 글(749)에서:
 *   · "⚡ 성급한 분들을 위한 핵심 요약" → 놋쇠 요약 카드 안에 분홍 알약 (액자 속 액자, v3.8.433 지적 그대로)
 *   · "📌 전체 읽어보기 절차" → 목차 제목이 소제목처럼 분홍 상자
 *   · 요약 제목의 인라인 margin:0 을 규칙의 margin 30px !important 가 이겨 카드 안에서 밀려 내려감
 * 이제 요약 카드·목차·CTA 안의 h3 는 이 규칙에서 빠진다. 소제목(본문 h3)은 그대로다.
 */
import { generateCSSFinal } from '../src/core/final/html';

const EXCLUDE = ':where(:not(.summary-container h3, .toc-grid-container h3, .cta-section h3))';

describe('스킨 h3 상자 규칙 — 부품 제목은 뺀다', () => {
  const css = generateCSSFinal('wordpress', 'external');
  // 주석을 떼고 규칙 단위로 자른다 — ".white-paper h3" 가 붙어 있는 규칙만
  //   (CTA 전용 ".white-paper .cta-section h3"·목차 전용 ".toc-grid-container h3" 는 이 꼴이 아니라 안 걸린다)
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = (bare.match(/[^{}]*\.white-paper h3[^{}]*\{[^}]*\}/g) || []).map((r) => r.trim());
  const boxRules = rules.filter((r) => /padding:\s*14px 20px|background:\s*#[0-9a-f]{6}\s*!important;\s*border-color/.test(r));

  it('검사기가 상자 규칙 7개(기본 1 + 6색)를 찾는다 — 못 찾으면 검사기 고장', () => {
    expect(boxRules).toHaveLength(7);
  });

  it('상자 규칙마다 요약 카드·목차·CTA 안의 h3 를 뺀다', () => {
    for (const rule of boxRules) expect(rule.split('{')[0]).toContain(EXCLUDE);
  });

  it('제외 조건은 :where 로 감싸 점수(specificity)를 올리지 않는다 — 「먹과 놋쇠」 층 순서 보존', () => {
    for (const rule of boxRules) {
      const selector = rule.split('{')[0] || '';
      const withoutExclude = selector.replace(EXCLUDE, '');
      // 제외 조건을 떼면 예전 선택자와 같아야 한다 (점수가 같다)
      expect(withoutExclude).toMatch(/^\s*:where\(\.bgpt-content\) \.white-paper h3(:nth-of-type\(6n\+\d\))?\s*$/);
    }
  });

  it('6색 순환과 소제목 인라인 상자는 그대로다', () => {
    for (const [bg, bd] of [['#fef3f2', '#fecdca'], ['#eff8ff', '#b9e0fe'], ['#f0fdf4', '#bbf7d0'], ['#fefbea', '#fde68a'], ['#f5f3ff', '#ddd6fe'], ['#fdf2f8', '#fbcfe8']]) {
      expect(css).toContain(`background: ${bg} !important; border-color: ${bd} !important;`);
    }
  });
});
