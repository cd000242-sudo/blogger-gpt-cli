/**
 * 내 폴더 이미지 배치를 마쳐도 상세설정이 모르던 문제 (v3.8.723)
 *
 * 사장님: "내폴더 이미지 h2 배치를 썸네일배치를 하고 소제목은 안 넣고 완료시켰는데
 *          상세설정에 이미지는 인식을 안 하고 있네요?? 썸네일과 소제목 이미지를 생성하면 안 되고
 *          드롭다운에도 내폴더 이미지 배치라고 뜨면서 비활성화되어야 정상인데 그렇게 안 되어 있네요"
 *
 * ## 원인
 * 배치 모달의 「완료」는 window 전역(__preGeneratedImagesForArticle 등)만 채우고
 * **화면의 이미지 설정은 한 글자도 건드리지 않았다.** 직접 배치를 마쳤는데도 상세설정에는
 * "나노바나나 2 로 생성" 이 그대로 남아, 화면이 실제 동작과 다른 말을 하고 있었다.
 *
 * ## 이 테스트가 보는 것
 * 판단(무엇을 보여주고 어떤 범위로 둘지)은 순수 함수로 빼 두었다 — DOM 안에 숨겨 두면
 * 가짜 DOM 을 만들어야 하고, 가짜는 통과해도 실물에서 틀릴 수 있다.
 * DOM 조작 자체는 아래 ④에서 **배선**으로 잠근다.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

/** 화면 모듈에서 순수 함수만 꺼내 온다 (브라우저 전용 코드를 건드리지 않기 위해) */
function loadDescribe(): (placement: any) => any {
  const src = read('electron/ui/modules/folder-image-lock.js');
  const start = src.indexOf('export function describeFolderPlacement');
  const end = src.indexOf('function ensureLockOption');
  const body = src.slice(start, end).replace('export function', 'function');
  // eslint-disable-next-line no-new-func
  return new Function(`${body}\nreturn describeFolderPlacement;`)();
}

const describeFolderPlacement = loadDescribe();

describe('① 썸네일만 배치하고 완료 (사장님이 한 그대로)', () => {
  const plan = describeFolderPlacement({ h2Count: 0, hasThumbnail: true, active: true });

  it('⭐⭐ 드롭다운에 "내 폴더 이미지 배치" 로 뜬다', () => {
    expect(plan.locked).toBe(true);
    expect(plan.label).toContain('내 폴더 이미지 배치');
    expect(plan.label).toContain('썸네일');
    expect(plan.label).not.toContain('소제목');   // 안 넣었으니 없어야 한다
  });

  it('⭐⭐ 소제목 이미지를 만들지 않는다', () => {
    expect(plan.mode).toBe('thumbnail-only');
  });

  it('⭐ 왜 잠겼는지와 푸는 법을 알려 준다 (이유 없이 잠그면 고장으로 읽힌다)', () => {
    expect(plan.notice).toContain('AI 이미지는 만들지 않습니다');
    expect(plan.notice).toContain('배치를 비우세요');
  });
});

describe('② 배치 조합별로 범위가 달라진다', () => {
  it('⭐⭐ 썸네일 + 소제목 → 전체', () => {
    const plan = describeFolderPlacement({ h2Count: 3, hasThumbnail: true, active: true });
    expect(plan.mode).toBe('all');
    expect(plan.label).toContain('썸네일');
    expect(plan.label).toContain('소제목 3장');
  });

  it('⭐⭐ 소제목만 배치 → 전체 (썸네일은 기존 설정대로)', () => {
    const plan = describeFolderPlacement({ h2Count: 2, hasThumbnail: false, active: true });
    expect(plan.mode).toBe('all');
    expect(plan.label).toContain('소제목 2장');
    expect(plan.label).not.toContain('썸네일');
  });

  it('⭐⭐ 배치가 없으면 잠그지 않는다', () => {
    for (const placement of [
      { h2Count: 0, hasThumbnail: false, active: false },
      null,
      undefined,
    ]) {
      expect(describeFolderPlacement(placement).locked).toBe(false);
    }
  });
});

describe('③ 잠금을 풀 수 있어야 한다 (잠그고 못 푸는 것이 제일 나쁘다)', () => {
  const src = read('electron/ui/modules/folder-image-lock.js');

  it('⭐⭐ 잠그기 전 값을 기억하고 해제할 때 되돌린다', () => {
    expect(src).toContain('if (!saved) saved = { source: source.value, mode: mode.value };');
    expect(src).toContain('source.value = saved.source;');
    expect(src).toContain('mode.value = saved.mode;');
  });

  it('⭐⭐ 두 번 잠가도 원본을 잃지 않는다 (if (!saved) 가 그 자물쇠다)', () => {
    // 값을 담는 대입은 **한 곳뿐**이어야 하고, 그 앞에 `if (!saved)` 가 붙어 있어야 한다
    const captures = src.match(/saved = \{/g) || [];
    expect(captures.length).toBe(1);
    expect(src).toContain('if (!saved) saved = {');
    expect(src).toContain('saved = null;');
  });

  it('⭐⭐ 해제하면 잠금용 항목과 안내를 지운다', () => {
    expect(src).toContain('if (option) option.remove();');
    expect(src).toContain("setNotice(source, '');");
    expect(src).toContain('source.disabled = false;');
    expect(src).toContain('mode.disabled = false;');
  });
});

describe('④ 배선 — 화면과 payload 양쪽', () => {
  it('⭐⭐ 배지를 새로 그릴 때마다 설정도 같이 맞춘다 (배치·비움·큐 전환이 전부 이 함수를 지난다)', () => {
    const script = read('electron/ui/script.js');
    const fn = script.slice(
      script.indexOf('window.refreshPreGeneratedBadge = function'),
      script.indexOf('const arr = window.__preGeneratedImagesForArticle'),
    );
    expect(fn).toContain('window.syncFolderImageLock?.()');
  });

  it('⭐⭐ 보여주기용 값이 payload 로 새지 않는다 (백엔드가 모르는 엔진이 된다)', () => {
    const script = read('electron/ui/script.js');
    expect(script).toContain("rawSource === '__folder-images__' ? 'none' : rawSource");
  });

  it('⭐⭐ 모듈이 실제로 로드된다 (import 안 하면 window 에 안 붙어 아무 일도 안 일어난다)', () => {
    expect(read('electron/ui/modules/main.js')).toContain("import './folder-image-lock.js'");
  });

  it('⭐ 실제 컨트롤 id 를 쓴다 (없는 id 를 읽으면 조용히 아무 일도 안 한다)', () => {
    const html = read('electron/ui/index.html');
    expect(html).toContain('id="h2ImageSource"');
    expect(html).toContain('id="h2ImageMode"');
    // 잠금이 고르는 범위 값들이 실제 선택지에 있어야 한다
    expect(html).toContain('value="thumbnail-only"');
    expect(html).toContain('value="all"');
  });
});
