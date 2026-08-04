/**
 * v3.8.456 — 티스토리에서 카테고리 탭이 아예 안 보이던 문제
 *
 * 사용자 실측: "없는데? 카테고리탭이?" (티스토리 선택 상태, 탭 4개만 표시)
 *
 * 원인: togglePlatformFields 가 **두 벌**(script.js · ui.js)이고 같은 엘리먼트
 * (#settingsTabCategory)를 서로 다른 규칙으로 만졌다.
 *   script.js — 블로거가 아니면 표시 (v3.8.453 에서 맞게 고침)
 *   ui.js     — wordpress 만 표시, 나머지 숨김  ← 설정 저장 후 실행돼 최종 승자
 * 사용자 콘솔 로그가 증거였다:
 *   "togglePlatformFields 실행: tistory" 직후 "워드프레스 카테고리 탭: 숨김"
 *
 * v3.8.453 검증 때 script.js 경로만 확인한 것이 내(어시스턴트) 실수다.
 * 이 테스트는 두 구현이 항상 같은 결과를 내는지를 고정한다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const uiJs = read('electron/ui/modules/ui.js');
const scriptJs = read('electron/ui/script.js');

describe('두 togglePlatformFields 가 카테고리 탭을 같은 규칙으로 다룬다', () => {
  it('⭐⭐ ui.js — 티스토리도 카테고리 탭을 표시한다', () => {
    expect(uiJs).toContain("const showCategoryTab = selectedPlatform === 'wordpress' || selectedPlatform === 'tistory';");
    // 옛 규칙(wordpress 단독 조건)이 되살아나면 티스토리 탭이 다시 사라진다
    const block = blockBetween(uiJs, 'const wpCategoryTab = document.getElementById', '// 블로거 설정 표시/숨김');
    expect(block).not.toMatch(/if \(selectedPlatform === 'wordpress'\) \{\s*\n\s*wpCategoryTab/);
  });

  it('⭐⭐ ui.js — 탭 안의 WP/티스토리 블록도 함께 토글한다', () => {
    expect(uiJs).toContain('postingTistoryCategoryBlock');
    expect(uiJs).toContain("postingTistoryBlock.style.display = selectedPlatform === 'tistory' ? 'block' : 'none'");
  });

  it('⭐ script.js — 기존 규칙 유지 (블로거만 숨김)', () => {
    expect(scriptJs).toContain("wpCategoryTab.style.display = isBlogger ? 'none' : 'flex';");
    expect(scriptJs).toContain("postingTistoryBlock.style.display = isTistory ? 'block' : 'none'");
  });

  it('⭐ 두 구현의 표시 조건이 논리적으로 일치한다', () => {
    // script.js: !isBlogger → wordpress·tistory 표시 / ui.js: wordpress || tistory 표시
    // 플랫폼이 3개(blogger·wordpress·tistory)인 한 두 조건은 동치다.
    // 새 플랫폼이 추가되면 이 테스트를 함께 갱신할 것.
    expect(uiJs).toContain("'wordpress' || selectedPlatform === 'tistory'");
    expect(scriptJs).toContain("isBlogger ? 'none' : 'flex'");
  });
});
