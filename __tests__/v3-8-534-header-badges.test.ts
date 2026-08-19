/**
 * 헤더 배지 드롭다운 배선 테스트 (v3.8.534)
 *
 * 사장님 요구: "배찌에서 플랫폼이나 모델 변경. 배선도 정확하게 —
 * 선택하고 발행했는데 변경 안 되어 있으면 곤란합니다."
 *
 * 배선의 진실(실측): 발행 payload 는 라디오를 발행 순간에 직접 읽고,
 * 모델은 payload 가 env 보다 우선한다(main.ts postPayload 조립).
 * → 배지는 라디오에 쓰고 change 를 쏜다. 재시작 대비는 save-env 부분 저장
 *   (main 의 save-env 는 기존 .env 병합 + 빈 값 스킵이라 다른 키를 못 지운다).
 * → 전체 saveSettings() 호출은 금지 — 모달 미오픈 시 빈 필드 위험.
 */
import * as fs from 'fs';
import * as path from 'path';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const mod = read('electron/ui/modules/header-badges.js');
const html = read('electron/ui/index.html');
const mainJs = read('electron/ui/modules/main.js');
const mainTs = read('electron/main.ts');
const postingJs = read('electron/ui/modules/posting.js');

describe('① 쓰기 대상 컨트롤 실존 — 발행이 실제로 읽는 그 라디오다', () => {
  it('플랫폼: 모듈이 쓰는 라디오가 index.html 에 있고, posting.js 가 같은 라디오를 읽는다', () => {
    expect(mod).toContain('input[name="platform"][value="${value}"]');
    expect(html).toContain('name="platform"');
    expect(postingJs).toContain('input[name="platform"]:checked');
  });

  it('모델: 모듈이 쓰는 라디오가 index.html 에 있고, posting.js 가 같은 라디오를 읽는다', () => {
    expect(mod).toContain('input[name="primaryGeminiTextModel"][value="${value}"]');
    expect(html).toContain('name="primaryGeminiTextModel"');
    expect(postingJs).toContain('input[name="primaryGeminiTextModel"]:checked');
  });

  it('모델 payload 가 env 보다 우선한다 — 라디오 변경 = 즉시 반영의 근거', () => {
    expect(mainTs).toContain('payload.primaryGeminiTextModel || env.PRIMARY_TEXT_MODEL');
  });

  it('라디오가 없으면 조용히 넘어가지 않고 경고한다', () => {
    expect(mod).toContain('플랫폼 라디오 없음');
    expect(mod).toContain('모델 라디오 없음');
  });
});

describe('② 변경은 change 이벤트 경유 — 기존 리스너(배지 갱신 포함)가 그대로 돈다', () => {
  it('bubbles 로 change 를 쏜다', () => {
    const count = (mod.match(/dispatchEvent\(new Event\('change', \{ bubbles: true \}\)\)/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(2); // 플랫폼 + 모델
  });

  it('script.js 에 모델 change → 배지 갱신 리스너가 실존한다', () => {
    const script = read('electron/ui/script.js');
    expect(script).toContain("target.name === 'primaryGeminiTextModel'");
  });
});

describe('③ 저장은 부분 save-env — 전체 saveSettings 금지', () => {
  it('saveEnv 부분 저장만 부른다 (플랫폼 1키, 모델 3키)', () => {
    expect(mod).toContain('saveEnv?.({ platform: value })');
    expect(mod).toContain('primaryGeminiTextModel: value');
    expect(mod).toContain('generationEngine: engine');
    expect(mod).toContain('defaultAiProvider: engine');
  });

  it('전체 saveSettings 는 부를 수 없다 — import 자체가 없다 (모달 미오픈 시 빈 필드 위험)', () => {
    // 주석에 언급은 되지만, import 가 없으면 호출도 불가능하다
    expect(mod).not.toMatch(/import[^;]*\bsaveSettings\b[^;]*from/);
    expect(mod).not.toContain('window.saveSettings');
    expect(mod).toContain("import { updatePlatformStatus } from './settings.js'");
  });

  it('save-env keyMap 이 세 키를 표준 env 키로 매핑한다 (.env 키 표기 함정 차단)', () => {
    expect(mainTs).toContain("'primaryGeminiTextModel': 'PRIMARY_TEXT_MODEL'");
    expect(mainTs).toContain("'generationEngine': 'GENERATION_ENGINE'");
    expect(mainTs).toContain("'defaultAiProvider': 'DEFAULT_AI_PROVIDER'");
  });

  it('엔진 파생 규칙이 saveSettings 와 같다 — 다르면 오배선', () => {
    for (const marker of ["startsWith('gemini-')", "startsWith('claude-')", "=== 'perplexity-sonar'"]) {
      expect(mod).toContain(marker);
      expect(read('electron/ui/modules/settings.js')).toContain(marker);
    }
  });
});

describe('④ 배선 — 배지 실존 + 초기화', () => {
  it('배지 두 개가 index.html 에 있다', () => {
    expect(html).toContain('id="platformStatus"');
    expect(html).toContain('id="aiModelStatus"');
  });

  it('main.js 가 모듈을 import 하고 초기화한다 (실패해도 앱은 계속)', () => {
    expect(mainJs).toContain("'./header-badges.js'");
    expect(mainJs).toContain('initHeaderBadges');
  });

  it('배지가 없으면 조용히 죽지 않고 경고한다', () => {
    expect(mod).toContain('배지를 찾지 못했습니다');
  });
});
