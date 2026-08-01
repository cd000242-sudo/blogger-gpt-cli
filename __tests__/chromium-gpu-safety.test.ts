/**
 * Chromium 실행 지점 GPU 안전성 전수 검사 (v3.8.396)
 *
 * ── 왜 (실측 2026-08-01) ──
 * 사용자 PC 가 하루 3번 블루스크린으로 재부팅됐다:
 *   11:53  0x0000010E  VIDEO_MEMORY_MANAGEMENT_INTERNAL
 *   12:07  0x0000010E  VIDEO_MEMORY_MANAGEMENT_INTERNAL
 *   12:28  0x0000009F  DRIVER_POWER_STATE_FAILURE
 * 하드웨어: Intel Iris Xe 드라이버 2023-06-15(3년 전) + NVIDIA RTX 4060 2026-06-03
 * 하이브리드 그래픽에서 Chromium 합성은 Intel iGPU 로 가고, 이 앱은 크롤·이미지 생성으로
 * Chromium 을 반복 실행한다. 구버전 드라이버 + 최신 Chromium 이 0x10E 의 전형 조합이다.
 *
 * ── 왜 테스트로 막나 ──
 * 사람이 매번 기억하지 못했다:
 *   · dropshotGenerator 는 **보이는 모드에서만** --disable-gpu 를 넣고 headless 는 빠뜨렸다
 *     (요즘 headless 는 실제 GPU 경로를 탄다)
 *   · 새로 추가한 affiliate/crawl.ts 는 인자를 아예 안 넣었다
 *   · playwright-runner 는 **빌드 산출물(src/core/crawlers/*.js)** 을 고치고
 *     진짜 소스(src/crawlers/*.ts)를 놓쳤다
 * 그래서 "실행 지점이 늘어나면 자동으로 걸리는" 검사로 바꾼다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { CHROMIUM_GPU_SAFE_ARGS, withGpuSafeArgs } from '../src/utils/chromium-safe-args';

const ROOT = path.join(__dirname, '..');
const read = (...p: string[]) => {
  try { return fs.readFileSync(path.join(ROOT, ...p), 'utf8'); } catch { return ''; }
};

describe('공용 GPU 안전 인자', () => {
  it('핵심 플래그를 담고 있다', () => {
    ['--disable-gpu', '--disable-software-rasterizer', '--disable-gpu-compositing']
      .forEach(f => expect(CHROMIUM_GPU_SAFE_ARGS).toContain(f));
  });

  it('기존 인자에 합치되 중복하지 않는다', () => {
    const merged = withGpuSafeArgs(['--no-sandbox', '--disable-gpu']);
    expect(merged.filter(a => a === '--disable-gpu')).toHaveLength(1);
    expect(merged).toContain('--no-sandbox');
  });

  it('키가 같은 --disable-features 를 중복 추가하지 않는다', () => {
    const merged = withGpuSafeArgs(['--disable-features=IsolateOrigins']);
    expect(merged.filter(a => a.startsWith('--disable-features='))).toHaveLength(1);
  });

  it('빈 입력에 안전하다', () => {
    expect(withGpuSafeArgs()).toEqual([...CHROMIUM_GPU_SAFE_ARGS]);
  });
});

describe('실행 지점별 GPU 차단 — 새 지점이 생기면 여기서 걸린다', () => {
  const sites: Array<{ label: string; file: string[]; }> = [
    { label: '제휴 링크 크롤', file: ['src', 'core', 'affiliate', 'crawl.ts'] },
    { label: '범용 크롤러(진짜 소스)', file: ['src', 'crawlers', 'playwright-runner.ts'] },
    { label: 'dropshot 이미지 생성', file: ['src', 'core', 'dropshotGenerator.ts'] },
  ];

  sites.forEach(({ label, file }) => {
    it(`${label} — GPU 를 끈다`, () => {
      const src = read(...file);
      expect(src.length).toBeGreaterThan(0);                      // 파일 경로가 맞는지부터 확인
      const usesSafeConst = src.includes('CHROMIUM_GPU_SAFE_ARGS');
      const usesFlag = src.includes('--disable-gpu');
      expect(usesSafeConst || usesFlag).toBe(true);
    });
  });

  it('dropshot 은 headless 에서도 끈다 — 조건부 블록 밖에 있어야 한다', () => {
    const src = read('src', 'core', 'dropshotGenerator.ts');
    const argsStart = src.search(/args:\s*\[\s*[\r\n]+\s*'--no-first-run'/);
    // ⚠️ indexOf('if (!effectiveHeadless)') 는 **주석 안의 같은 문구**를 먼저 잡는다
    //   (실제로 이 테스트가 그 함정에 걸렸다). 줄 맨 앞의 실제 문장만 찾는다.
    const condStart = src.search(/^\s*if \(!effectiveHeadless\) \{/m);
    expect(argsStart).toBeGreaterThan(-1);
    expect(condStart).toBeGreaterThan(argsStart);                 // 기본 args 가 조건문보다 앞
    expect(src.slice(argsStart, condStart)).toContain('--disable-gpu');
  });

  it('빌드 산출물이 아니라 진짜 소스를 고쳤는지 확인한다', () => {
    // src/core/crawlers/*.js 는 컴파일 결과물이다. 여기만 고치면 다음 빌드에 날아간다.
    const realSource = read('src', 'crawlers', 'playwright-runner.ts');
    expect(realSource).toContain('--disable-gpu');
  });
});

describe('새 Chromium 실행 지점 감시', () => {
  /** src 전체에서 chromium.launch / launchPersistentContext 를 쓰는 파일을 찾는다 */
  function findLaunchSites(dir: string, acc: string[] = []): string[] {
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === 'crawlers') continue;   // crawlers 는 위에서 개별 검사
        findLaunchSites(full, acc);
      } else if (/\.ts$/.test(e.name)) {
        const src = fs.readFileSync(full, 'utf8');
        if (/chromium\.launch\s*\(|launchChromiumWithAutoInstall\s*\(/.test(src)) acc.push(full);
      }
    }
    return acc;
  }

  it('공용 래퍼가 GPU 안전 인자를 강제한다 — 여기가 최종 방어선이다', () => {
    const wrapper = read('src', 'utils', 'playwright-browser-installer.ts');
    expect(wrapper).toContain('withGpuSafeArgs');
    // launch / launchPersistentContext 양쪽 모두 통과시켜야 한다
    expect(wrapper).toContain('chromium.launch(ensureGpuSafe(options))');
    expect(wrapper).toContain('chromium.launchPersistentContext(userDataDir, ensureGpuSafe(options))');
  });

  it('발견된 모든 .ts 실행 지점이 GPU 를 끈다 (직접 실행 또는 공용 래퍼 경유)', () => {
    const sites = findLaunchSites(path.join(ROOT, 'src'));
    expect(sites.length).toBeGreaterThan(0);   // 탐지 자체가 동작하는지 확인

    const offenders = sites.filter((f) => {
      const src = fs.readFileSync(f, 'utf8');
      // ① 직접 플래그를 넣었거나 공용 인자를 쓰면 안전
      //    (withGpuSafeArgs 는 래퍼 자신이 쓰는 함수다 — 이걸 빠뜨려 래퍼가 오탐됐었다)
      if (/--disable-gpu|CHROMIUM_GPU_SAFE_ARGS|withGpuSafeArgs/.test(src)) return false;
      // ② 공용 래퍼만 경유하면 래퍼가 강제하므로 안전
      return !/launch(?:Chromium|PersistentContext)WithAutoInstall\s*\(/.test(src);
    }).map(f => path.relative(ROOT, f));

    expect(offenders).toEqual([]);
  });
});
