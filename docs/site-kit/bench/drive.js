#!/usr/bin/env node
/**
 * 살아 있는 창을 한 단계씩 조작한다 — session.js 가 띄운 창에 붙는다.
 *
 * 남의 대시보드는 화면이 예상과 다를 때가 많다. 그래서 "보고 → 판단 → 한 번 클릭"
 * 을 되풀이할 수 있게 쪼갰다. 한 방에 끝내는 스크립트는 엉뚱한 걸 누른다.
 *
 * 사용:
 *   node drive.js where                    지금 무슨 화면인지
 *   node drive.js goto <주소>
 *   node drive.js read [선택자]             글자만 읽는다 (기본: 본문 전체 요약)
 *   node drive.js buttons                  누를 수 있는 것 목록
 *   node drive.js inputs                   입력칸 목록
 *   node drive.js click "<글자 또는 선택자>"
 *   node drive.js fill "<선택자>" "<값>"
 *   node drive.js shot <파일명>             화면 저장
 *   node drive.js find "<찾을 글자>"         그 글자가 있는 요소들
 */
const { chromium } = require('playwright');
const path = require('path');

const PORT = 9222;
const [cmd, arg1, arg2] = process.argv.slice(2);
const SHOT_DIR = path.join(__dirname, 'shots');

const trim = (s, n) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:' + PORT).catch(() => null);
  if (!browser) {
    console.error('창을 못 찾았습니다. 먼저 session.js 를 띄우세요.');
    process.exit(1);
  }
  const ctx = browser.contexts()[0];
  const pages = ctx.pages().filter((p) => !p.url().startsWith('devtools://'));
  const page = pages[pages.length - 1];

  switch (cmd) {
    case 'where': {
      console.log('주소: ' + page.url());
      console.log('제목: ' + (await page.title().catch(() => '?')));
      const h = await page.evaluate(() =>
        [...document.querySelectorAll('h1,h2')].slice(0, 6).map((e) => e.textContent.trim()).filter(Boolean)
      );
      console.log('제목줄: ' + (h.join(' / ') || '(없음)'));
      console.log('열린 탭 ' + pages.length + '개');
      break;
    }
    case 'goto': {
      await page.goto(arg1, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForTimeout(2500);
      console.log('이동함: ' + page.url());
      break;
    }
    case 'read': {
      const sel = arg1 || 'body';
      const txt = await page.evaluate((s) => {
        const el = document.querySelector(s);
        return el ? el.innerText : '(해당 요소 없음)';
      }, sel);
      console.log(txt.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 80).join('\n'));
      break;
    }
    case 'buttons': {
      const list = await page.evaluate(() =>
        [...document.querySelectorAll('button, a[role="button"], input[type="submit"], [role="button"]')]
          .map((e) => ({ 글자: (e.innerText || e.value || '').trim(), 보임: !!e.offsetParent, 비활성: !!e.disabled }))
          .filter((x) => x.글자 && x.보임)
          .slice(0, 40)
      );
      list.forEach((b, i) => console.log(String(i).padStart(2) + '  ' + (b.비활성 ? '(비활성) ' : '') + b.글자.slice(0, 70)));
      break;
    }
    case 'inputs': {
      const list = await page.evaluate(() =>
        [...document.querySelectorAll('input, textarea, select')]
          .map((e) => ({
            종류: e.type || e.tagName.toLowerCase(),
            이름: e.name || e.id || '',
            안내: e.placeholder || '',
            값있음: !!e.value,
            보임: !!e.offsetParent,
          }))
          .filter((x) => x.보임)
          .slice(0, 30)
      );
      list.forEach((x, i) =>
        console.log(String(i).padStart(2) + '  [' + x.종류 + '] ' + (x.이름 || '(이름없음)') + '  ' + x.안내 + (x.값있음 ? '  ← 값 있음' : ''))
      );
      break;
    }
    case 'find': {
      const hits = await page.evaluate((needle) =>
        [...document.querySelectorAll('*')]
          .filter((e) => e.children.length === 0 && e.textContent && e.textContent.includes(needle))
          .slice(0, 15)
          .map((e) => ({ tag: e.tagName, 글자: e.textContent.trim().slice(0, 80), 보임: !!e.offsetParent })), arg1);
      hits.forEach((h) => console.log((h.보임 ? '보임 ' : '숨김 ') + h.tag + '  ' + h.글자));
      if (!hits.length) console.log('"' + arg1 + '" 못 찾음');
      break;
    }
    case 'click': {
      const target = arg1;
      let done = false;
      try {
        await page.click(target, { timeout: 5000 });
        done = true;
      } catch {
        try {
          await page.getByRole('button', { name: target }).first().click({ timeout: 5000 });
          done = true;
        } catch {
          try {
            await page.getByText(target, { exact: false }).first().click({ timeout: 5000 });
            done = true;
          } catch { /* 아래에서 보고 */ }
        }
      }
      await page.waitForTimeout(2500);
      console.log(done ? '눌렀습니다 → ' + page.url() : '못 눌렀습니다: ' + target);
      if (!done) process.exit(2);
      break;
    }
    case 'fill': {
      await page.fill(arg1, arg2, { timeout: 10000 });
      console.log('입력했습니다: ' + arg1);
      break;
    }
    case 'shot': {
      require('fs').mkdirSync(SHOT_DIR, { recursive: true });
      const p = path.join(SHOT_DIR, (arg1 || 'shot') + '.png');
      await page.screenshot({ path: p, fullPage: false });
      console.log('저장: ' + p);
      break;
    }
    default:
      console.log('명령: where / goto / read / buttons / inputs / find / click / fill / shot');
  }

  await browser.close(); // CDP 연결만 끊는다. 창은 살아 있다.
})().catch((e) => {
  console.error('❌ 실패:', e.message);
  process.exit(1);
});
