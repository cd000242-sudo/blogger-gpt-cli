/**
 * v3.8.484 ⑤ — 별점 위젯을 요구하지 않는다
 *
 * 사장님: "rates 위젯 제거"
 *
 * ## 왜 지우는가
 * 프롬프트가 "별점 + 리뷰 요약 바 (예: ⭐4.7/5 — 1,234명 평가)" 를 **필수 컴포넌트**로
 * 요구하고 있었다. 요구를 받으면 모델은 어떻게든 채운다 — 수집된 후기가 없으면
 * 그럴듯한 숫자를 만들어낸다. v3.8.470 에서 "실제 데이터에 있는 값만" 이라는 단서를
 * 달았지만, 같은 문서 안에 "필수" 와 "없으면 빼라" 가 함께 있으면 필수가 이긴다.
 *
 * 구글은 실제 경험에 근거하지 않은 후기·평점 마크업에 수동 조치를 취한다.
 * 지어낸 별점은 애드센스 Misrepresentative content 에도 걸린다.
 * 요구 자체를 없애는 편이 확실하다.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
/** 주석에는 삭제 경위가 남으므로 코드만 검사한다 */
const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');

const modeSections = codeOnly(read('src/core/max-mode/mode-sections-extended.ts'));
const modePrompt = codeOnly(read('src/core/max-mode/content-mode-prompt.ts'));
const promptBuilders = codeOnly(read('src/core/max-mode/prompt-builders.ts'));

describe('별점 위젯을 필수로 요구하지 않는다', () => {
  it('⭐⭐ 후기 섹션이 별점 바를 요구하지 않는다', () => {
    expect(modeSections).not.toContain('별점 + 리뷰 요약 바');
    expect(modeSections).not.toContain('⭐4.7/5');
  });

  it('⭐⭐ 후기 카드에 별점을 넣으라고 하지 않는다', () => {
    expect(modeSections).not.toContain('별점 포함');
  });

  it('⭐⭐ "필수 시각 컴포넌트" 목록에서 빠졌다', () => {
    expect(modePrompt).not.toContain('필수 시각 컴포넌트 3: 별점 + 리뷰 바');
    expect(modePrompt).not.toContain('별점 + 리뷰 바가 포함되었는가?');
  });

  it('⭐⭐ 체크리스트·지시문에도 별점 시각화 요구가 없다', () => {
    expect(promptBuilders).not.toContain('별점 시각화');
    expect(modeSections).not.toContain('별점 시각화');
  });

  it('⭐⭐ 수집된 후기 자체는 계속 쓴다 (후기를 버리라는 게 아니다)', () => {
    // 사람들이 실제로 뭐라고 했는지는 이 글의 알맹이다. 지우는 건 별점 "위젯" 이다.
    expect(modeSections).toContain('실제 구매 후기');
  });

  it('⭐⭐ 지어내지 말라는 경고는 남는다 (혹시 모델이 스스로 넣을 때의 안전망)', () => {
    expect(modeSections).toContain('수집된 실제 데이터에 있는 값만');
  });
});
