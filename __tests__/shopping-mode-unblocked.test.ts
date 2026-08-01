/**
 * 쇼핑 모드 차단 해제 감시 (v3.8.397)
 *
 * ── 사고 ──
 * 사용자가 쇼핑/구매유도 모드를 고르자 발행이 실패했다:
 *   "🚧 쇼핑/구매유도 모드는 현재 점검 중입니다."
 *
 * 원인: v3.5.38(2026-04-24)에 임시 차단으로 들어온 throw 가 3개월 넘게 남아 있었다.
 *   당시엔 UI 드롭다운도 disabled 였고 이건 IPC/스케줄 우회를 막는 **이중 가드**였다.
 *   v3.8.386 에서 UI 잠금은 풀었지만 **백엔드 가드를 놓쳤다.**
 *
 * 왜 심각했나: 그 위에 아래를 전부 쌓아 올렸는데 전 구간이 도달 불가였다.
 *   · 쇼핑 이미지 전략 (v3.8.385)
 *   · 제휴 컴플라이언스·링크 크롤 (v3.8.395)
 *   · 제휴 상품 카드·프롬프트·UI (v3.8.396)
 *
 * 교훈: UI 잠금을 풀 때는 **같은 기능을 막는 백엔드 가드도 함께** 찾아야 한다.
 *   이 테스트가 그 짝을 강제한다.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');
const read = (...p: string[]) => {
  try { return fs.readFileSync(path.join(ROOT, ...p), 'utf8'); } catch { return ''; }
};

describe('쇼핑 모드가 백엔드에서 차단되지 않는다', () => {
  const orch = read('src', 'core', 'final', 'orchestration.ts');

  it('"점검 중" 차단 문구가 없다', () => {
    expect(orch).not.toContain('쇼핑/구매유도 모드는 현재 점검 중입니다');
  });

  it('contentMode === shopping 으로 throw 하지 않는다', () => {
    // "if (... contentMode === 'shopping') { ... throw ... }" 형태를 잡는다
    const blocks = orch.match(/if\s*\([^)]*contentMode\s*===\s*['"]shopping['"][^)]*\)\s*\{[\s\S]{0,400}?\}/g) || [];
    blocks.forEach((b) => {
      expect(b).not.toContain('throw new Error');
    });
  });

  it('차단 해제 근거가 코드에 남아 있다 — 다음 사람이 되돌리지 않게', () => {
    expect(orch).toContain('v3.8.397: 쇼핑 모드 차단 해제');
  });
});

describe('UI 도 쇼핑 모드를 막지 않는다', () => {
  const html = read('electron', 'ui', 'index.html');

  it('shopping 옵션에 disabled 가 없다', () => {
    const opts = html.match(/<option[^>]*value=["']shopping["'][^>]*>/g) || [];
    expect(opts.length).toBeGreaterThan(0);
    opts.forEach(o => expect(o).not.toContain('disabled'));
  });

  it('"준비 중"·"점검" 안내가 남아 있지 않다', () => {
    const opts = html.match(/<option[^>]*value=["']shopping["'][^>]*>[^<]*/g) || [];
    opts.forEach((o) => {
      expect(o).not.toContain('준비 중');
      expect(o).not.toContain('점검');
    });
  });
});

describe('쇼핑 모드 위에 쌓은 기능들이 실제로 도달 가능하다', () => {
  const orch = read('src', 'core', 'final', 'orchestration.ts');
  const html = read('electron', 'ui', 'index.html');

  it('쇼핑 이미지 전략 (v3.8.385)', () => {
    expect(orch).toContain("contentMode === 'shopping' && productPool.length > 0");
    expect(html).toContain('id="shoppingImageStrategy"');
  });

  it('제휴 링크 크롤·카드 (v3.8.395~396)', () => {
    expect(orch).toContain('crawlAffiliateLinks');
    expect(orch).toContain('renderAffiliateProductBlock');
    expect(html).toContain('id="affiliateLinks"');
  });

  it('제휴 컴플라이언스', () => {
    expect(orch).toContain('enforceAffiliateCompliance');
  });

  it('쇼핑 전용 UI 는 쇼핑 모드에서만 보인다 (숨김 ≠ 차단)', () => {
    expect(html).toContain("shopStrategy.style.display = mode === 'shopping' ? 'block' : 'none'");
    expect(html).toContain("affLinks.style.display = mode === 'shopping' ? 'block' : 'none'");
  });
});
