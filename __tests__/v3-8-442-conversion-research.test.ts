/**
 * v3.8.442 — 2026-08 전환 리서치 결과를 하네스에 반영한 것에 대한 회귀 방지
 *
 * 리서치 근거 요약:
 *   ① 구글 2026-03 코어 업데이트 — "제품을 실제로 쓰는 사진·영상"이 랭킹 요소.
 *      네이버 — 직접 촬영 이미지 10장↑ 가산점, 스톡 이미지는 감점.
 *      → AI 생성컷이 기본값이면 순위에 불리하다. 사진이 충분하면 실사진이 기본.
 *   ② "이런 사람에게 이것을 권한다"는 전환되고 "필요에 따라 다르다"는 전환 안 됨.
 *   ③ 구체적 수치가 뭉뚱그린 표현을 이긴다.
 *   ④ 도입부 준비운동("혹시 ~해보신 적")은 이탈 요인.
 *   ⑤ 반론(해소 가능)과 결격(구조적 불일치)은 나눠 써야 한다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');

const orch = read('src/core/final/orchestration.ts');
const indexHtml = read('electron/ui/index.html');

describe('① 수집 사진이 충분하면 실사진이 기본값이다', () => {
  it('⭐⭐ 백엔드 기본값이 더 이상 무조건 AI 생성이 아니다', () => {
    // 예전: String(payload.shoppingImageStrategy || 'product-i2i')
    expect(orch).not.toContain("(payload as any).shoppingImageStrategy || 'product-i2i'");
    expect(orch).toContain('const explicitStrategy =');
  });

  it('⭐⭐ 수집한 사진 장수로 기본값을 정한다', () => {
    const block = blockBetween(orch, 'const explicitStrategy =', 'const productPool =');
    expect(block).toContain('collectedPhotoCount');
    expect(block).toContain("'product-all'");
    expect(block).toContain("'product-i2i'");
  });

  it('⭐ 사용자가 UI 에서 고른 값이 있으면 그게 우선이다', () => {
    const block = blockBetween(orch, 'const explicitStrategy =', 'const productPool =');
    expect(block).toContain('explicitStrategy\n            ||');
  });

  it('⭐ 쿠팡(사진 1장)은 자동으로 AI 생성에 남는다', () => {
    // 임계값이 2 이하면 쿠팡 대표컷 1장 + 무언가로도 product-all 이 될 수 있다
    const block = blockBetween(orch, 'const explicitStrategy =', 'const productPool =');
    const m = block.match(/collectedPhotoCount\s*>=\s*(\d+)/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(3);
  });

  it('⭐⭐ UI 도 수집 가능한 제휴사면 실사진을 기본으로 고른다', () => {
    const fn = blockBetween(indexHtml, 'window.__syncStrategyRadios = function', 'document.addEventListener');
    expect(fn).toContain('__strategyUserPicked');
    expect(fn).toContain("allDisabled ? 'product-i2i' : 'product-all'");
  });

  it('⭐ 사용자가 직접 고르면 제휴사를 바꿔도 그 선택이 유지된다', () => {
    expect(indexHtml).toContain('window.__strategyUserPicked = true;');
  });

  it('⭐ 안내 문구가 근거를 알려준다 (왜 실사진이 권장인지)', () => {
    expect(indexHtml).toContain('검색 순위 요소');
    expect(indexHtml).toContain('감점');
  });
});

describe('② 판단을 독자에게 떠넘기는 문장을 차단한다', () => {
  const voice = blockBetween(orch, '🎯 **판단을 독자에게 떠넘기지 마세요', '🔢 **뭉뚱그리지 말고');

  it('⭐⭐ 실제 발행 글에 나온 표현들을 이름 대고 금지한다', () => {
    expect(voice).toContain('본인의 사용 목적에 맞게 선택하세요');
    expect(voice).toContain('판단이 달라집니다');
    expect(voice).toContain('한 번도 쓰지 마세요');
  });

  it('⭐ 금지만 하지 않고 대체 형태를 준다', () => {
    expect(voice).toContain('사람을 지목하고 이유를 붙이세요');
    expect(voice).toContain('사세요');
    expect(voice).toContain('사지 마세요');
  });

  it('⭐ 섹션마다 최소 1회 지목을 요구한다', () => {
    expect(voice).toContain('최소 한 번은');
  });
});

describe('③ 구체적 수치 강제', () => {
  const num = blockBetween(orch, '🔢 **뭉뚱그리지 말고', '⚡ **도입부는');

  it('⭐ 뭉뚱그린 표현을 예시로 집어 금지한다', () => {
    expect(num).toContain('비교적 선명해요');
    expect(num).toContain('꽤 크게 느껴질 수 있습니다');
  });

  it('⭐⭐ 지어내기 금지는 유지한다 (구체성 요구가 할루시네이션이 되면 안 된다)', () => {
    expect(num).toContain('확인 안 된 수치는 지어내지 마세요');
  });

  it('⭐ 확인된 수치로 계산해 주는 것은 허용한다', () => {
    expect(num).toContain('계산해서 보여주세요');
  });
});

describe('④ 도입부 준비운동 금지', () => {
  const intro = blockBetween(orch, '⚡ **도입부는 준비운동 없이', '`;');

  it('⭐ 셋업형 오프닝을 금지한다', () => {
    expect(intro).toContain('혹시 ~해보신 적 있나요');
    expect(intro).toContain('상황 설명으로 시작하지 마세요');
  });

  it('⭐ 첫 두 문장 안에 무엇인지가 나와야 한다고 못 박는다', () => {
    expect(intro).toContain('첫 두 문장');
  });
});

describe('⑤ 반론과 결격을 나눈다', () => {
  it('⭐⭐ 단점 섹션 분기가 배선돼 있다', () => {
    expect(orch).toContain("if (sec.id === 'honest_cons' && !hasNoReviews)");
  });

  it('⭐⭐ 두 종류를 명확히 구분해 지시한다', () => {
    const block = blockBetween(orch, "if (sec.id === 'honest_cons' && !hasNoReviews)", '/**\n         * v3.8.441');
    expect(block).toContain('걱정되지만 해결되는 것');
    expect(block).toContain('이런 분은 사지 마세요');
    expect(block).toContain('해결책을 붙이지 말고');
  });

  it('⭐ 결격은 사람을 구체적으로 묘사하게 한다', () => {
    const block = blockBetween(orch, "if (sec.id === 'honest_cons' && !hasNoReviews)", '/**\n         * v3.8.441');
    expect(block).toContain('구체적으로');
    expect(block).toContain('최소 2가지');
  });

  it('⭐ 후기 없는 상품에는 기존 분기가 그대로 산다 (덮어쓰지 않는다)', () => {
    // hasNoReviews 전용 honest_cons 분기가 여전히 존재해야 한다
    expect(orch).toContain("hasNoReviews && sec.id === 'honest_cons'");
  });
});
