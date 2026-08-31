#!/usr/bin/env node
/**
 * 살아 있는 브라우저 창 — 사장님이 로그인하고, 내가 이어서 조작한다.
 *
 * 한 번 띄워 두면 계속 살아 있고, drive.js 가 붙어서 한 단계씩 조작한다.
 * 그래서 화면을 보고 판단한 뒤 다음 클릭을 정할 수 있다.
 * (한 방에 끝내는 스크립트는 상대 화면이 예상과 다르면 엉뚱한 걸 누른다.)
 *
 * 로그인 정보는 이 창에만 들어가고 어디에도 저장되지 않는다.
 * 프로필은 임시 폴더에 두고, 끝나면 지운다.
 *
 * 사용: node docs/site-kit/bench/session.js [처음 열 주소]
 */
const { chromium } = require('playwright');
const path = require('path');
const os = require('os');

const START = process.argv[2] || 'about:blank';
const PORT = 9222;
const PROFILE = path.join(os.tmpdir(), 'leadernam-session-profile');

(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    viewport: null,
    args: ['--remote-debugging-port=' + PORT, '--start-maximized'],
  });

  const page = ctx.pages()[0] || (await ctx.newPage());
  if (START !== 'about:blank') {
    await page.goto(START, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch((e) => {
      console.log('첫 주소 열기 실패(계속 진행):', e.message);
    });
  }

  console.log('창이 열렸습니다. 로그인하세요.');
  console.log('이 창은 계속 살아 있습니다 — 조작은 drive.js 가 붙어서 합니다.');
  console.log('디버그 포트: ' + PORT);

  // 사람이 닫을 때까지 살려 둔다
  await new Promise((resolve) => {
    ctx.on('close', resolve);
    process.on('SIGINT', resolve);
    process.on('SIGTERM', resolve);
  });
  console.log('창이 닫혔습니다.');
})().catch((e) => {
  console.error('❌ 세션 실패:', e.message);
  process.exit(1);
});
