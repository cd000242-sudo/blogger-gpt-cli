/**
 * v3.8.755 — Dropshot "로그인 완료" 가 거짓이던 것
 *
 * 고객 신고(2026-10-08): "드롭샷 로그인 됐다고 하는데 이미지 생성에서 계속 실패".
 * 실측(2026-10-08, 사장님 PC 프로필·headless Chromium):
 *   - 로그아웃 상태에서도 AI Studio 보드 주소가 그대로 열린다.
 *   - /api/auth/session 은 200 이지만 user 가 없다.
 *   - 그런데 loginDropshot 은 "보드 주소에 닿았다" 만으로 loggedIn=true, "로그인 완료" 였다.
 *   - 직후의 확인(checkDropshotLogin)은 로그인 창이 같은 프로필을 쥔 채라 배경 브라우저가 못 떠서
 *     늘 실패했고, 실패하면 무조건 "로그인 완료" 로 떨어졌다.
 */
import * as fs from 'fs';
import * as path from 'path';

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'dropshotGenerator.ts'), 'utf8');

function loginBody(): string {
  const start = src.indexOf('export async function loginDropshot(');
  expect(start).toBeGreaterThan(-1);
  const end = src.indexOf('\nasync function downloadAsFileBuffer(', start);
  expect(end).toBeGreaterThan(start);
  return src.slice(start, end);
}

describe('v3.8.755 Dropshot 로그인 판정', () => {
  test('보드 주소만으로는 로그인이 아니다 — 세션 API 가 사용자를 확인해야 한다', () => {
    const body = loginBody();
    const loop = body.slice(body.indexOf('for (let i = 0; i < 300; i++)'), body.indexOf('if (loggedIn) {'));
    const probeAt = loop.indexOf('await probeDropshotAuthApi(p)');
    const guardAt = loop.indexOf('if (!probe.ok) continue;');
    const setAt = loop.indexOf('loggedIn = true;');
    expect(probeAt).toBeGreaterThan(-1);
    expect(guardAt).toBeGreaterThan(probeAt);
    expect(setAt).toBeGreaterThan(guardAt);
    expect(loop).not.toMatch(/const ok = isDropshotBoardUrl[\s\S]*if \(ok\) \{\s*loggedIn = true/);
  });

  test('로그인 창이 열린 채로 배경 확인을 부르지 않는다(프로필 잠금) — 창을 닫은 뒤 확인한다', () => {
    const body = loginBody();
    const block = body.slice(body.indexOf('if (loggedIn) {'));
    const closeAt = block.indexOf('await closeDropshotContext(context);');
    const checkAt = block.indexOf('await checkDropshotLogin({ force: true })');
    expect(closeAt).toBeGreaterThan(-1);
    expect(checkAt).toBeGreaterThan(closeAt);
    expect(block.slice(0, closeAt)).not.toContain('checkDropshotLogin(');
  });

  test('배경 브라우저가 로그인을 못 이어받으면 "로그인 완료" 라고 하지 않는다', () => {
    const block = loginBody().slice(loginBody().indexOf('if (loggedIn) {'));
    expect(block).toContain('if (!background?.loggedIn) {');
    const failed = block.slice(block.indexOf('if (!background?.loggedIn) {'));
    expect(failed).toMatch(/loggedIn: false,\s*ready: false,/);
    expect(failed).toContain('배경 브라우저가 로그인을 이어받지 못했습니다');
  });

  test('확인이 실패해도 무조건 "로그인 완료" 로 떨어지던 예비 갈래가 없다', () => {
    const body = loginBody();
    expect(body).not.toContain("verified?.loggedIn");
    expect(body).not.toMatch(/: \{ loggedIn: true, message: '로그인 완료', subscription: 'unknown' \}\);/);
  });
});
