/**
 * 모바일 헤더 고침안을 **적용 전에** 시험한다.
 * 파란 상자·3px 줄이 사라지고 아이콘이 보이는지 좌표와 색으로 확인.
 */
const { chromium } = require('playwright');
const fs = require('fs');

const CSS = fs.readFileSync('docs/site-kit/bench/fix-mobile-header.css', 'utf-8');

(async () => {
  const browser = await chromium.launch();
  const mk = async () => {
    const p = await browser.newPage({
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
    });
    await p.goto('https://leadernam.com/?v=' + Date.now(), { waitUntil: 'networkidle', timeout: 60000 });
    return p;
  };
  const probe = (p) => p.evaluate(() => {
    const pick = (s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      return { w: Math.round(r.width), h: Math.round(r.height), bg: cs.backgroundColor, color: cs.color };
    };
    const icon = document.querySelector('#mobile-menu-control-wrapper .menu-bar-item > a');
    return {
      wrapper: pick('#mobile-menu-control-wrapper'),
      nav: pick('#site-navigation'),
      iconColor: icon ? getComputedStyle(icon).color : null,
      toggleColor: (() => { const t = document.querySelector('#mobile-menu-control-wrapper .menu-toggle'); return t ? getComputedStyle(t).color : null; })(),
    };
  });

  const before = await mk();
  console.log('고치기 전:', JSON.stringify(await probe(before), null, 0));
  await before.screenshot({ path: 'docs/site-kit/bench/shots/mobile-before.png', clip: { x: 0, y: 0, width: 390, height: 200 } });
  await before.close();

  const after = await mk();
  await after.addStyleTag({ content: CSS });
  await after.waitForTimeout(400);
  console.log('고친 뒤  :', JSON.stringify(await probe(after), null, 0));
  await after.screenshot({ path: 'docs/site-kit/bench/shots/mobile-after.png', clip: { x: 0, y: 0, width: 390, height: 200 } });

  // 메뉴를 열어도 멀쩡한가 — 닫힘 상태만 고치고 열림을 망가뜨리면 안 된다
  await after.click('#mobile-menu-control-wrapper .menu-toggle');
  await after.waitForTimeout(600);
  const opened = await after.evaluate(() => {
    const nav = document.querySelector('#site-navigation');
    const r = nav.getBoundingClientRect();
    return { toggled: nav.className.includes('toggled'), h: Math.round(r.height), bg: getComputedStyle(nav).backgroundColor,
             items: document.querySelectorAll('#primary-menu li').length };
  });
  console.log('메뉴 연 뒤:', JSON.stringify(opened));
  await after.screenshot({ path: 'docs/site-kit/bench/shots/mobile-menu-open.png', clip: { x: 0, y: 0, width: 390, height: 500 } });
  await browser.close();
})();
