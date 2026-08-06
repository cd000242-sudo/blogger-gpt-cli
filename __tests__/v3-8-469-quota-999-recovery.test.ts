/**
 * v3.8.469 — 쓰지도 않았는데 "3회 모두 소진" 으로 막히던 사고
 *
 * 사용자 보고(스크린샷): 배지 "무료체험 (999/3 소진)" · "무료 체험 발행 999/3"
 *   "오늘 무료체험으로는 한번도 안했는데 다소진됫다하고"
 *
 * ## 내가 낸 버그다
 * v3.8.461 이 서명 payload 에 `h`(날짜별 기록)를 넣었다. 그런데 **그 전에 저장된
 * 파일에는 `h` 없는 서명**이 들어 있다. 새 방식으로만 검증하니 멀쩡한 기존 파일이
 * 전부 위조로 판정됐고, 위조 표식값 999 가 사용량으로 읽혔다.
 *
 * 더 나쁜 건 v3.8.461 이 넣은 "자가 복구" 였다 — 그 999 를 **정상 서명과 함께
 * 디스크에 저장**해 버렸다. 그래서 서명 호환을 되살려도 이미 굳은 999 는 안 풀린다.
 *
 * ## 두 겹으로 고친다
 *   ① 옛 서명(h 없음)도 인정한다 — 보안은 그대로다(같은 비밀키로 만든 진짜 서명이어야 한다)
 *   ② 정상 서명이 붙은 999 는 **우리가 쓴 표식**이므로 0 으로 되돌린다.
 *      사람이 하루 999회를 발행할 수는 없다. 위조로 이득도 없다 —
 *      999 를 쓰려면 서명을 위조해야 하는데, 위조하면 어차피 차단이다.
 */
const TEST_HOME = '.tmp-tests/quota-469';

jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => '.tmp-tests/quota-469'), isPackaged: false },
}));

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const DIR = path.resolve(TEST_HOME);
const MAIN = path.join(DIR, 'quota-state.json');
const BACKUP = path.join(DIR, 'quota-state.backup.json');
const MIRROR = path.join(DIR, '.leadernam-orbit', 'quota-state.json');
const LIMIT = 3;

const SALT = Buffer.from('T3JiaXRRdW90YVNhbHQyMDI2', 'base64').toString('utf-8');
const sign = (payload: unknown) =>
  crypto.createHmac('sha256', SALT).update(JSON.stringify(payload)).digest('hex').substring(0, 16);

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function wipe(): void {
  for (const f of [MAIN, BACKUP, MIRROR]) {
    try { fs.unlinkSync(f); } catch { /* 없으면 그만 */ }
  }
}

function writeState(file: string, state: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state), 'utf-8');
}

/** v3.8.461 이전 형식 — 서명 payload 에 h 가 없다 */
function legacyState(publish: number) {
  const d = today();
  const base = { date: d, publish, policyVersion: 2, lastSeenDate: d };
  return { ...base, _sig: sign({ v: 2, d, p: publish, l: d }) };
}

/** v3.8.461 이 잘못 저장한 상태 — 999 인데 서명은 정상 */
function persistedSentinel() {
  const d = today();
  const history = { [d]: 999 };
  const base = { date: d, publish: 999, history, policyVersion: 2, lastSeenDate: d };
  return { ...base, _sig: sign({ v: 2, d, p: 999, l: d, h: `${d}:999` }) };
}

type QuotaModule = typeof import('../electron/quota-manager');

describe('v3.8.469 무료체험이 잘못 소진되던 사고', () => {
  let Q: QuotaModule;

  beforeEach(() => {
    wipe();
    jest.resetModules();
    Q = require('../electron/quota-manager');
  });

  afterEach(() => wipe());
  afterAll(() => {
    try { fs.rmSync(DIR, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  describe('① 옛 서명 파일이 위조로 몰리지 않는다', () => {
    it('⭐⭐ v3.8.461 이전 파일(1회 사용)이 그대로 1회로 읽힌다', async () => {
      writeState(MAIN, legacyState(1));
      expect(await Q.getUsageToday()).toBe(1);
      expect(await Q.canConsume(LIMIT)).toBe(true);
    });

    it('⭐⭐ 한 번도 안 쓴 옛 파일은 0회다 (사용자가 겪은 그 상황)', async () => {
      writeState(MAIN, legacyState(0));
      const status = await Q.getQuotaStatus(LIMIT);
      expect(status.usage).toBe(0);
      expect(status.isPaywalled).toBe(false);
    });

    it('⭐ 옛 파일이라도 값을 손대면 여전히 막힌다 (보안은 그대로)', async () => {
      const forged = legacyState(3);
      forged.publish = 0;                    // 서명은 3회짜리인데 값만 0으로
      writeState(MAIN, forged);
      expect(await Q.getUsageToday()).not.toBe(0);
    });
  });

  describe('② 이미 굳어버린 999 를 되살린다', () => {
    it('⭐⭐ 정상 서명이 붙은 999 면 0회로 복구한다', async () => {
      writeState(MIRROR, persistedSentinel());
      expect(await Q.getUsageToday()).toBe(0);
      expect(await Q.canConsume(LIMIT)).toBe(true);
    });

    it('⭐⭐ 복구가 디스크에도 반영된다 (앱을 다시 켜도 0회)', async () => {
      writeState(MIRROR, persistedSentinel());
      await Q.getUsageToday();

      jest.resetModules();
      const fresh: QuotaModule = require('../electron/quota-manager');
      expect(await fresh.getUsageToday()).toBe(0);
    });

    it('⭐⭐ 복구 후에도 3회까지만 쓸 수 있다 (무제한이 되면 안 된다)', async () => {
      writeState(MIRROR, persistedSentinel());
      expect(await Q.consumeIfAvailable(LIMIT)).toBe(true);
      expect(await Q.consumeIfAvailable(LIMIT)).toBe(true);
      expect(await Q.consumeIfAvailable(LIMIT)).toBe(true);
      expect(await Q.consumeIfAvailable(LIMIT)).toBe(false);
    });

    it('⭐ 999 기록이 과거 날짜에 남아 있어도 지운다', async () => {
      const d = today();
      const history = { '2020-01-01': 999, [d]: 999 };
      const base = { date: d, publish: 999, history, policyVersion: 2, lastSeenDate: d };
      writeState(MIRROR, { ...base, _sig: sign({ v: 2, d, p: 999, l: d, h: `2020-01-01:999,${d}:999` }) });

      expect(await Q.getUsageToday()).toBe(0);
      const saved = JSON.parse(fs.readFileSync(MIRROR, 'utf-8'));
      for (const v of Object.values(saved.history || {})) expect(Number(v)).toBeLessThan(999);
    });
  });

  describe('③ 진짜 위조는 여전히 막는다', () => {
    it('⭐⭐ 서명이 없으면 차단', async () => {
      writeState(MAIN, { date: today(), publish: 0, policyVersion: 2, lastSeenDate: today() });
      expect(await Q.canConsume(LIMIT)).toBe(false);
    });

    it('⭐⭐ 서명이 엉뚱하면 차단', async () => {
      writeState(MAIN, { date: today(), publish: 0, policyVersion: 2, lastSeenDate: today(), _sig: 'deadbeefdeadbeef' });
      expect(await Q.canConsume(LIMIT)).toBe(false);
    });
  });
});

/**
 * ④ 페이월 화면 — 사용자 요청 3건
 *   "라이선스 구매하기 누르니까 이전 사이트로 가지는데 leaderspro.kr/pricing 이쪽으로"
 *   "닫기 누르면 어차피 아무것도 못하는데 앱 닫히게해주고"
 *   "횟수 차감식으로 수정해야지"
 */
describe('④ 페이월·카운터', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fsMod = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pathMod = require('path');
  const read = (p: string) => fsMod.readFileSync(pathMod.join(__dirname, '..', p), 'utf-8');
  const html = read('electron/ui/index.html');
  const settings = read('electron/ui/modules/settings.js');
  const mainTs = read('electron/main.ts');
  const preload = read('electron/preload.ts');

  it('⭐⭐ 구매 버튼이 leaderspro.kr/pricing 으로 간다', () => {
    expect(html).toContain('https://leaderspro.kr/pricing');
    expect(html).not.toContain('leadernam.imweb.me');
  });

  it('⭐⭐ 닫기 대신 앱 종료다 (닫아봐야 아무것도 못 한다)', () => {
    const modal = html.slice(html.indexOf('function showPaywallModal()'), html.indexOf('window.__quitFromPaywall = function'));
    expect(modal).toContain('앱 종료');
    expect(modal).toContain('__quitFromPaywall');
    expect(modal).not.toContain("getElementById('paywallModal').remove()");
  });

  it('⭐⭐ 종료 IPC 가 실제로 배선돼 있다 (없는 함수를 부르면 조용히 죽는다)', () => {
    expect(mainTs).toContain("ipcMain.handle('app:quit'");
    expect(preload).toContain("quitApp: () => ipcRenderer.invoke('app:quit')");
    expect(html).toContain('window.blogger.quitApp');
  });

  it('⭐⭐ 카운터가 차감식이다 (남은 횟수)', () => {
    expect(html).toContain("left + '회 남음'");
    expect(html).not.toContain("used + '/' + limit");
    expect(settings).toContain('회 남음');
    expect(settings).not.toContain('${usage}/${limit}');
  });
});
