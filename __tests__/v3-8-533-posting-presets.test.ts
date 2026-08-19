/**
 * 발행 프리셋 콘솔 테스트 (v3.8.533)
 *
 * 배경 — 실측: 상세설정 66개 컨트롤이 5탭 아코디언(기본 닫힘)에 숨어 발행 순간
 * 유효 설정이 화면에 없었다. 실사고 2건(contentMode 우선순위·유령 기본값)의
 * 공통 원인이 "안 보이는 값이 실려 나감"이었다.
 *
 * 설계 계약 — 칩은 새 상태가 아니라 기존 컨트롤의 뷰다:
 *   1) 칩이 참조하는 컨트롤은 index.html 에 실존해야 한다 (유령 기본값 차단)
 *   2) 변경은 반드시 원본 컨트롤에 쓰고 change 를 쏜다 (3경로 payload 무변경)
 *   3) 모듈이 localStorage 에 쓰는 키는 프리셋 저장소 하나뿐이다
 *      (contentMode 등 payload 가 읽는 키를 오염시키면 v3.8.44x 사고 재발)
 */
import * as fs from 'fs';
import * as path from 'path';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const mod = read('electron/ui/modules/posting-presets.js');
const html = read('electron/ui/index.html');
const mainJs = read('electron/ui/modules/main.js');

describe('① 칩이 참조하는 컨트롤 실존 (유령 기본값 차단)', () => {
  it('셀렉트 3종이 index.html 에 있다', () => {
    for (const id of ['contentMode', 'thumbnailType', 'h2ImageSource']) {
      expect(mod).toContain(`getElementById('${id}')`);
      expect(html).toContain(`id="${id}"`);
    }
  });

  it('라디오 2종(name)이 index.html 에 있다', () => {
    for (const name of ['postingMode', 'ctaMode']) {
      expect(mod).toContain(`'${name}'`);
      expect(html).toContain(`name="${name}"`);
    }
  });

  it('컨트롤이 없으면 칩을 만들지 않고 경고한다 — 조용히 기본값을 만들지 않는다', () => {
    expect(mod).toContain('칩을 건너뜁니다');
    expect(mod).toContain("console.warn('[PRESET]");
  });
});

describe('② 변경은 원본 컨트롤 경유 — payload 3경로 무변경', () => {
  it('쓰기는 change 이벤트를 bubbles 로 쏜다 (기존 리스너가 그대로 돈다)', () => {
    expect(mod).toContain("dispatchEvent(new Event('change', { bubbles: true }))");
  });

  it('셀렉트에 없는 값은 쓰지 않는다 — 낡은 프리셋 값 차단', () => {
    expect(mod).toContain('some((o) => o.value === value)');
  });

  it('옵션 목록도 실제 컨트롤에서 수확한다 — 모드가 추가돼도 칩 목록이 안 낡는다', () => {
    expect(mod).toContain('Array.from(el.options)');
  });
});

describe('③ 저장소 격리', () => {
  it('localStorage 쓰기는 프리셋 저장소 키 하나뿐이다', () => {
    const writes = mod.match(/localStorage\.setItem\(([^,]+),/g) || [];
    expect(writes.length).toBeGreaterThan(0);
    for (const w of writes) {
      expect(w).toContain('STORE_KEY');
    }
    expect(mod).toContain("const STORE_KEY = 'postingPresetsV1'");
  });
});

describe('④ 배선 — 자리와 초기화가 실존한다', () => {
  it('index.html 에 칩 바 자리가 있다', () => {
    expect(html).toContain('id="postingPresetBar"');
  });

  it('main.js 가 모듈을 import 하고 초기화한다', () => {
    expect(mainJs).toContain("'./posting-presets.js'");
    expect(mainJs).toContain('initPostingPresets');
  });

  it('자리가 없으면 조용히 죽지 않고 경고한다', () => {
    expect(mod).toContain('#postingPresetBar 가 index.html 에 없습니다');
  });
});
