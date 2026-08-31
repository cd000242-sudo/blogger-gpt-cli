#!/usr/bin/env node
/**
 * 워드프레스 추가 CSS 에 처방을 붙인다 — 사람이 하던 클릭을 그대로 한다.
 *
 * 안전장치 넷:
 *   1) 손대기 전에 지금 CSS 를 파일로 통째 백업한다 (backups/custom-css-<시각>.css)
 *   2) 이미 붙어 있으면(표식 검사) 아무것도 하지 않는다 — 두 번 돌려도 안전하다
 *   3) 기존 CSS 를 지우지 않는다. 맨 뒤에 덧붙이기만 한다
 *   4) 저장 뒤 실제 사이트를 다시 받아 정말 반영됐는지 확인한다
 *
 * 로그인은 두 가지 중 하나:
 *   (권장) 사람이 직접 — 창이 열리고, 로그인만 하면 나머지는 이어서 한다.
 *     node docs/site-kit/bench/apply-css.js --manual-login
 *   (자동) 환경변수로. 비밀번호는 파일에 적지 않는다.
 *     WP_USER=아이디 WP_PASS=비밀번호 node docs/site-kit/bench/apply-css.js
 *
 * 되돌리기: --revert 를 주면 표식 구간만 도로 지운다.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SITE = (process.env.WP_URL || 'https://leadernam.com').replace(/\/+$/, '');
const USER = process.env.WP_USER || '';
const PASS = process.env.WP_PASS || '';
const REVERT = process.argv.includes('--revert');
const MANUAL = process.argv.includes('--manual-login');
const HEADED = MANUAL || process.argv.includes('--headed');
const MANUAL_WAIT_MS = 10 * 60 * 1000; // 사람이 로그인할 시간 10분

const BEGIN = '/* ▼▼ CLS-FIX-LEADERNAM 시작 — 자동 삽입, 이 표식은 지우지 마세요 ▼▼ */';
const END = '/* ▲▲ CLS-FIX-LEADERNAM 끝 ▲▲ */';
const FIX = fs.readFileSync(path.join(__dirname, 'fix-cls.css'), 'utf8');
const BLOCK = '\n\n' + BEGIN + '\n' + FIX.trim() + '\n' + END + '\n';

const BACKUP_DIR = path.join(__dirname, 'backups');

if (!MANUAL && (!USER || !PASS)) {
  console.error('로그인 방법을 정해 주세요.');
  console.error('  직접 로그인:  node docs/site-kit/bench/apply-css.js --manual-login');
  console.error('  자동 로그인:  WP_USER=아이디 WP_PASS=비밀번호 node docs/site-kit/bench/apply-css.js');
  process.exit(1);
}

/** 표식 구간을 뺀 나머지. 되돌리기와 중복 삽입 방지 양쪽에 쓴다. */
function stripBlock(css) {
  const s = css.indexOf(BEGIN);
  const e = css.indexOf(END);
  if (s === -1 || e === -1 || e < s) return css;
  return (css.slice(0, s) + css.slice(e + END.length)).replace(/\n{3,}/g, '\n\n').trim();
}

(async () => {
  const browser = await chromium.launch({ headless: !HEADED });
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const page = await ctx.newPage();

  try {
    // ── 1. 로그인 ────────────────────────────────────────────
    await page.goto(SITE + '/wp-login.php', { waitUntil: 'domcontentloaded', timeout: 60000 });

    if (MANUAL) {
      console.log('① 창이 열렸습니다. 워드프레스에 로그인해 주세요.');
      console.log('   (비밀번호는 이 창에만 들어가고 어디에도 저장되지 않습니다)');
      console.log('   로그인하시면 자동으로 이어서 진행합니다 — 최대 10분 기다립니다…\n');
      await page.waitForURL(/\/wp-admin/, { timeout: MANUAL_WAIT_MS });
      console.log('   로그인 확인됨 — 이어서 진행합니다');
    } else {
      console.log('① 로그인 중…');
      await page.fill('#user_login', USER);
      await page.fill('#user_pass', PASS);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}),
        page.click('#wp-submit'),
      ]);
      if (await page.locator('#login_error').count()) {
        const msg = (await page.locator('#login_error').innerText()).trim().slice(0, 200);
        throw new Error('로그인 거부: ' + msg);
      }
      if (!/wp-admin/.test(page.url())) {
        throw new Error('로그인 후 관리자 화면으로 안 갔습니다. 지금 주소: ' + page.url() + ' (2단계 인증이 걸려 있을 수 있습니다)');
      }
      console.log('   로그인 완료');
    }

    // ── 2. 사용자 정의하기 → 추가 CSS ────────────────────────
    console.log('② 추가 CSS 화면 여는 중…');
    await page.goto(SITE + '/wp-admin/customize.php?autofocus[section]=custom_css', {
      waitUntil: 'load',
      timeout: 90000,
    });
    await page.waitForFunction(() => window.wp && window.wp.customize, { timeout: 60000 });
    await page.waitForTimeout(4000); // 편집기(CodeMirror) 준비

    // ── 3. 지금 CSS 읽기 + 백업 ──────────────────────────────
    const settingId = await page.evaluate(() => {
      const ids = [];
      window.wp.customize.each((v, id) => ids.push(id));
      return ids.find((id) => id.indexOf('custom_css') === 0) || null;
    });
    if (!settingId) throw new Error('추가 CSS 설정을 못 찾았습니다.');

    const current = await page.evaluate((id) => window.wp.customize(id).get() || '', settingId);
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, 'custom-css-' + stamp + '.css');
    fs.writeFileSync(backupPath, current);
    console.log('③ 백업 완료: ' + path.relative(process.cwd(), backupPath) + ' (' + current.length + '자)');

    // ── 4. 새 내용 계산 ──────────────────────────────────────
    const already = current.includes(BEGIN);
    let next;
    if (REVERT) {
      if (!already) { console.log('   되돌릴 것이 없습니다 (표식 없음). 그대로 둡니다.'); await browser.close(); return; }
      next = stripBlock(current);
      console.log('④ 되돌리기 — 표식 구간만 제거');
    } else {
      if (already) {
        console.log('④ 이미 적용돼 있습니다. 최신 내용으로 교체합니다.');
        next = stripBlock(current) + BLOCK;
      } else {
        next = current.trimEnd() + BLOCK;
        console.log('④ 맨 뒤에 덧붙입니다 (' + current.length + '자 → ' + next.length + '자)');
      }
    }

    // ── 5. 넣고 저장 ─────────────────────────────────────────
    await page.evaluate(({ id, value }) => {
      const control = window.wp.customize.control('custom_css');
      // 편집기가 있으면 편집기로 넣어야 화면과 설정이 함께 갱신된다
      if (control && control.editor && control.editor.codemirror) {
        control.editor.codemirror.setValue(value);
      }
      window.wp.customize(id).set(value);
    }, { id: settingId, value: next });

    await page.waitForTimeout(1200);
    console.log('⑤ 저장 중…');
    await page.click('#save');
    await page.waitForFunction(
      () => document.querySelector('#save') && document.querySelector('#save').disabled,
      { timeout: 60000 }
    ).catch(() => {});
    await page.waitForTimeout(4000);

    const saved = await page.evaluate((id) => window.wp.customize(id).get() || '', settingId);
    if (REVERT ? saved.includes(BEGIN) : !saved.includes(BEGIN)) {
      throw new Error('저장이 반영되지 않았습니다. 백업은 ' + backupPath + ' 에 있습니다.');
    }
    console.log('   저장 완료 (' + saved.length + '자)');
  } finally {
    await browser.close();
  }

  // ── 6. 실제 사이트에서 확인 ────────────────────────────────
  console.log('⑥ 실제 사이트에서 확인 중…');
  const res = await fetch(SITE + '/?cachebust=' + Date.now(), { headers: { 'Cache-Control': 'no-cache' } });
  const html = await res.text();
  const 붙었나 = html.includes('Pretendard Fallback');
  console.log('   페이지에 처방이 ' + (붙었나 ? '보입니다 ✅' : '아직 안 보입니다 (캐시 때문일 수 있습니다) ⚠️'));
  console.log('\n다음: node docs/site-kit/bench/harness.js compare before-cloudflare');
})().catch((e) => {
  console.error('❌ 실패:', e.message);
  process.exit(1);
});
