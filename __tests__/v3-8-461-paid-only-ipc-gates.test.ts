/**
 * v3.8.461 — 유료 전용 발행 경로가 백엔드에서도 막혀 있는지 고정한다.
 *
 * 적대적 감사에서 나온 지적: 다중계정·거미줄·예약 발행은 무료 체험 UI에서 탭이
 * 숨겨져 있을 뿐, IPC 채널 자체는 열려 있었다. preload 가 범용 `invoke` 를
 * 노출하므로 개발자도구에서 `window.electronAPI.invoke('run-multi-account-post', …)`
 * 를 반복 호출하면 하루 3회 제한을 통째로 지나칠 수 있었다.
 *
 * 렌더러 가드는 가드가 아니다 — 백엔드에서 막아야 진짜 막힌 것이다.
 */
import * as fs from 'fs';
import * as path from 'path';

const main = fs.readFileSync(path.join(__dirname, '..', 'electron/main.ts'), 'utf-8');

/** 핸들러 등록 지점부터 본문 앞부분을 잘라 온다 */
function handlerHead(anchor: string, chars = 1600): string {
  const idx = main.indexOf(anchor);
  expect(idx).toBeGreaterThan(-1);
  return main.slice(idx, idx + chars);
}

describe('유료 전용 IPC 경로는 무료 체험을 백엔드에서 차단한다', () => {
  const PAID_ONLY: Array<[string, string]> = [
    ["ipcMain.handle('run-multi-account-post'", '다중계정 발행'],
    ["safeRegisterHandler('publish-internal-link-content'", '거미줄 포스팅'],
    ["ipcMain.handle('add-schedule'", '예약 발행 등록'],
    ["ipcMain.handle('start-schedule-monitoring'", '예약 발행 모니터링'],
  ];

  it.each(PAID_ONLY)('⭐⭐ %s 는 blockIfFreeTier 로 시작한다', (anchor, feature) => {
    const head = handlerHead(anchor);
    expect(head).toContain('blockIfFreeTier');
    expect(head).toContain(feature);
    expect(head).toContain('if (!paidOnly.allowed) return paidOnly.response;');
  });

  it('⭐⭐ 차단은 실제 발행 호출보다 먼저 온다', () => {
    const head = handlerHead("ipcMain.handle('run-multi-account-post'", 20000);
    const gateIdx = head.indexOf('blockIfFreeTier');
    const publishIdx = head.indexOf('await publishGeneratedContent(');
    expect(gateIdx).toBeGreaterThan(-1);
    expect(publishIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeLessThan(publishIdx);
  });
});

describe('임시/예약 발행도 무료 체험 3회에 포함된다', () => {
  const auth = fs.readFileSync(path.join(__dirname, '..', 'electron/auth-utils.ts'), 'utf-8');

  it('⭐⭐ draft·schedule 은 더 이상 카운팅 제외 목록에 없다', () => {
    const m = auth.match(/return !\[([^\]]*)\]\.includes\(mode\);/);
    expect(m).not.toBeNull();
    const excluded = m![1]!;
    for (const counted of ['draft', 'save', 'schedule', 'scheduled']) {
      expect(excluded).not.toContain(`'${counted}'`);
    }
  });

  it('⭐ 미리보기는 여전히 카운팅에서 빠진다 (아무것도 발행하지 않으므로)', () => {
    const m = auth.match(/return !\[([^\]]*)\]\.includes\(mode\);/);
    expect(m![1]!).toContain("'preview'");
    expect(auth).toContain('if (request.previewOnly === true) return false;');
  });
});
