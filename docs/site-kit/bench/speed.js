/**
 * 사이트 속도 실측 — 짐작 금지. 브라우저가 실제로 받은 것만 적는다.
 *
 * 재는 것:
 *  1) LCP / FCP / DOMContentLoaded / load
 *  2) 요청 전수 — 호스트별 개수·바이트·소요시간
 *  3) 렌더를 막는 것 (head 안의 동기 script, stylesheet)
 *  4) 제일 무거운 자원 20개
 *  5) 캐시 안 되는 자원 (Cache-Control 없음/짧음)
 *
 * 사용: node docs/site-kit/bench/speed.js <url> [url...]
 * 출력: BENCH_OUT 또는 스크립트 폴더의 speed-report.json
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = process.env.BENCH_OUT || __dirname;
const TARGETS = process.argv.slice(2);
if (!TARGETS.length) { console.error('usage: node speed.js <url> [url...]'); process.exit(1); }

(async () => {
  const browser = await chromium.launch();
  const report = {};

  for (const url of TARGETS) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const reqs = [];

    page.on('response', async (res) => {
      const r = res.request();
      let size = 0;
      try { size = Number((await res.headerValue('content-length')) || 0); } catch {}
      reqs.push({
        url: res.url(),
        host: new URL(res.url()).host,
        type: r.resourceType(),
        status: res.status(),
        size,
        cache: (await res.headerValue('cache-control').catch(() => null)) || '',
      });
    });

    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'load', timeout: 90000 });
    const loadMs = Date.now() - t0;
    await page.waitForTimeout(3000); // 지연 주입되는 것(광고 등)까지 잡는다

    const vitals = await page.evaluate(() => new Promise((resolve) => {
      const out = { lcp: 0, lcpUrl: '', cls: 0 };
      try {
        new PerformanceObserver((l) => {
          const e = l.getEntries().pop();
          if (e) { out.lcp = Math.round(e.startTime); out.lcpUrl = e.url || (e.element && e.element.tagName) || ''; }
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) if (!e.hadRecentInput) out.cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
      } catch {}
      setTimeout(() => {
        const nav = performance.getEntriesByType('navigation')[0] || {};
        const fcp = performance.getEntriesByName('first-contentful-paint')[0];
        resolve({
          ...out,
          cls: Number(out.cls.toFixed(4)),
          fcp: fcp ? Math.round(fcp.startTime) : 0,
          ttfb: Math.round(nav.responseStart || 0),
          domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
          loadEvent: Math.round(nav.loadEventEnd || 0),
          transferKB: Math.round((nav.transferSize || 0) / 1024),
        });
      }, 500);
    }));

    // 렌더를 막는 것 — </head> 앞의 동기 script 와 stylesheet
    const blocking = await page.evaluate(() => {
      const head = document.head;
      const out = { syncScripts: [], stylesheets: [] };
      head.querySelectorAll('script[src]').forEach((s) => {
        if (!s.async && !s.defer && s.type !== 'module') out.syncScripts.push(s.src);
      });
      head.querySelectorAll('link[rel="stylesheet"]').forEach((l) => out.stylesheets.push(l.href));
      return out;
    });

    const byHost = {};
    for (const r of reqs) {
      const h = (byHost[r.host] ||= { count: 0, bytes: 0 });
      h.count++; h.bytes += r.size;
    }

    report[url] = {
      wallClockLoadMs: loadMs,
      vitals,
      totalRequests: reqs.length,
      totalKB: Math.round(reqs.reduce((a, r) => a + r.size, 0) / 1024),
      byHost: Object.fromEntries(
        Object.entries(byHost).sort((a, b) => b[1].bytes - a[1].bytes)
          .map(([k, v]) => [k, { count: v.count, KB: Math.round(v.bytes / 1024) }])
      ),
      renderBlocking: { syncScriptCount: blocking.syncScripts.length, stylesheetCount: blocking.stylesheets.length, ...blocking },
      heaviest: reqs.slice().sort((a, b) => b.size - a.size).slice(0, 20)
        .map((r) => ({ KB: Math.round(r.size / 1024), type: r.type, cache: r.cache, url: r.url.slice(0, 130) })),
      noCache: reqs.filter((r) => !r.cache || /no-store|no-cache|max-age=0/.test(r.cache))
        .map((r) => ({ type: r.type, cache: r.cache || '(없음)', url: r.url.slice(0, 110) })).slice(0, 25),
    };
    console.log(`[측정] ${url}\n  LCP ${vitals.lcp}ms · FCP ${vitals.fcp}ms · TTFB ${vitals.ttfb}ms · CLS ${vitals.cls}`);
    console.log(`  요청 ${reqs.length}개 · ${report[url].totalKB}KB · load ${loadMs}ms`);
    await ctx.close();
  }

  fs.writeFileSync(path.join(OUT, 'speed-report.json'), JSON.stringify(report, null, 2));
  console.log('\n저장:', path.join(OUT, 'speed-report.json'));
  await browser.close();
})();
