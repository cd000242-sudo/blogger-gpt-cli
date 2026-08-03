/**
 * "계산은 했는데 실제로 안 전달됨" 배선 버그 재발 방지 (v3.8.424)
 *
 * 사용자: "애초에 크롤링이 완벽하다면 할루시네이션도 없고 글도 프롬프트대로 완벽하게
 *   작성해줘야정상맞지?" → "쇼핑모드뿐만아니라 다른모드도 같이 하네스를 하나하나
 *   꼼꼼하게 확인해"
 *
 * 이 세션에서 반복적으로 나온 실패 모드 — 지시문을 정성껏 써놓고도 실제 생성 호출에
 * 안 실리는 것 — 을 shopping 모드 밖에서도 하나 더 찾았다.
 *
 * orchestration.ts 1611행: `let scopedSectionBlock = modeResult.sectionPromptBlock || '';`
 * 이 시점에 modeResult.sectionPromptBlock의 문자열 값이 scopedSectionBlock으로
 * **복사**된다(원시값이라 참조가 아니다). 이후 generateAllSectionsFinal 호출은 전부
 * scopedSectionBlock만 쓴다 — 그러니 이 시점 이후에 modeResult.sectionPromptBlock을
 * 고쳐도 실제 생성 프롬프트에는 반영되지 않는다.
 *
 * 실제로 v3.8.404의 "읽기 편하게 쓰는 법"(문단 길이·목록·표·강조 지시)가 바로 이
 * 실수로 modeResult.sectionPromptBlock에 붙어서 한 번도 실제 프롬프트에 실리지
 * 않았다 — 콘텐츠 모드와 무관하게 **모든 글**에 영향을 준 손실이었다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';

const orch = fs.readFileSync(
  path.join(process.cwd(), 'src', 'core', 'final', 'orchestration.ts'),
  'utf8',
);

describe('scopedSectionBlock 배선 — 스냅샷 이후 modeResult.sectionPromptBlock을 다시 쓰지 않는다', () => {
  it('⭐ 가독성 지시("읽기 편하게 쓰는 법")가 scopedSectionBlock에 직접 붙는다', () => {
    const block = blockBetween(orch, "// 📖 v3.8.404 — 가독성 규칙", 'let allSectionsObj = await generateAllSectionsFinal(');
    expect(block).toContain('scopedSectionBlock += `');
    expect(block).toContain('읽기 편하게 쓰는 법');
  });

  it('⭐ generateAllSectionsFinal(첫 호출)은 scopedSectionBlock을 인자로 받는다', () => {
    const block = blockBetween(orch, 'let allSectionsObj = await generateAllSectionsFinal(', ');');
    expect(block).toContain('scopedSectionBlock,');
  });

  it('⭐ 스냅샷(1611행) 이후로는 modeResult.sectionPromptBlock을 다시 대입하지 않는다', () => {
    // scopedSectionBlock 스냅샷 지점부터 첫 생성 호출 직전까지 구간에서
    // modeResult.sectionPromptBlock에 값을 대입하는 코드가 있으면 안 된다 —
    // 있으면 그 내용은 절대 실제 프롬프트에 도달하지 못한다(원시 문자열 복사이기 때문).
    const snapshotIdx = orch.indexOf("let scopedSectionBlock = modeResult.sectionPromptBlock || '';");
    const firstCallIdx = orch.indexOf('let allSectionsObj = await generateAllSectionsFinal(');
    expect(snapshotIdx).toBeGreaterThan(-1);
    expect(firstCallIdx).toBeGreaterThan(snapshotIdx);
    const between = orch.slice(snapshotIdx, firstCallIdx);
    expect(between).not.toMatch(/modeResult\.sectionPromptBlock\s*=/);
  });

  it('스냅샷 이후 추가되는 지시(중복회피·경험메모·초점좁히기)는 전부 scopedSectionBlock에 직접 붙는다', () => {
    const snapshotIdx = orch.indexOf("let scopedSectionBlock = modeResult.sectionPromptBlock || '';");
    const firstCallIdx = orch.indexOf('let allSectionsObj = await generateAllSectionsFinal(');
    const between = orch.slice(snapshotIdx, firstCallIdx);
    // 각 추가 지시가 scopedSectionBlock에 직접 append되는지 — 다른 변수에 붙었다가
    // 버려지는 패턴이 없는지 개수로 확인한다.
    const appendCount = (between.match(/scopedSectionBlock\s*\+=/g) || []).length;
    expect(appendCount).toBeGreaterThanOrEqual(5); // 스코프prepend 이후 최소 5곳(중복회피/경험/초점/가독성 등)
  });
});
