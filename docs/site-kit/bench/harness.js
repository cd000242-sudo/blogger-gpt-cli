#!/usr/bin/env node
/**
 * 사이트 속도 하네스 — 고치기 전과 후를 같은 기준으로 잰다.
 *
 *   node docs/site-kit/bench/harness.js baseline before-cloudflare
 *   ... 사이트를 고친다 ...
 *   node docs/site-kit/bench/harness.js compare before-cloudflare
 *
 * 인자 없이 돌리면 지금 상태만 찍는다.
 *
 * 설계상 지킨 것 세 가지:
 *  1) 한 번만 재지 않는다 — 네트워크는 한 번씩 딸꾹질하므로 3회 중앙값을 쓴다.
 *  2) 모바일을 같이 잰다 — 네이버 유입은 대부분 휴대폰이다. 데스크톱만 재면 절반만 본 것이다.
 *  3) 매번 새 브라우저 문맥으로 연다 — 연결과 캐시를 물려받으면 두 번째부터 거짓으로 빨라진다.
 *
 * 대상 주소와 반복 횟수는 targets.json 에서 고친다.
 * 숫자를 해석하는 계산부는 lib/metrics.js 에 있고 __tests__/site-speed-harness.test.ts 로 묶여 있다.
 */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const { summarize, compare, verdict, classifyHosts, THRESHOLDS } = require('./lib/metrics.js');

const HERE = __dirname;
const BASE_DIR = path.join(HERE, 'baselines');
const CFG = JSON.parse(fs.readFileSync(path.join(HERE, 'targets.json'), 'utf8'));

const DEVICE_PRESETS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: devices['Pixel 7'] || { viewport: { width: 390, height: 844 }, isMobile: true },
};

const MARK = { good: '✅', ok: '⚠️', bad: '❌' };
const fmt = (v, unit) => (v === undefined || v === null ? '—' : String(v) + unit);

/** 한 페이지를 한 번 연다. 반환값은 지표 한 벌. */
async function measureOnce(browser, url, device) {
  const ctx = await browser.newContext(DEVICE_PRESETS[device]);
  const page = await ctx.newPage();
  const reqs = [];

  page.on('response', async (res) => {
    let size = 0;
    try {
      size = Number((await res.headerValue('content-length')) || 0);
    } catch {
      /* 헤더가 없는 응답 — 0 으로 둔다 */
    }
    let host = '';
    try {
      host = new URL(res.url()).host;
    } catch {
      /* blob: 같은 주소는 호스트가 없다 */
    }
    reqs.push({ host, size });
  });

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 90000 });
    await page.waitForTimeout(3000); // 나중에 주입되는 광고까지 잡는다
  } catch (err) {
    await ctx.close();
    throw new Error('페이지를 못 열었습니다 (' + url + '): ' + err.message);
  }

  const raw = await page.evaluate(() => new Promise((resolve) => {
    const out = { lcp: 0, cls: 0 };
    try {
      new PerformanceObserver((l) => {
        const e = l.getEntries().pop();
        if (e) out.lcp = e.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) if (!e.hadRecentInput) out.cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {
      /* 관측기를 지원하지 않으면 0 으로 남는다 */
    }
    setTimeout(() => {
      const nav = performance.getEntriesByType('navigation')[0] || {};
      const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
      const tcpEnd = nav.secureConnectionStart > 0 ? nav.secureConnectionStart : nav.connectEnd;
      resolve({
        lcp: out.lcp,
        cls: out.cls,
        fcp: fcpEntry ? fcpEntry.startTime : null,
        ttfb: nav.responseStart || null,
        connectMs: nav.connectStart ? tcpEnd - nav.connectStart : null,
        tlsMs: nav.secureConnectionStart > 0 ? nav.connectEnd - nav.secureConnectionStart : null,
      });
    }, 600);
  }));

  const byHost = {};
  for (const r of reqs) {
    const h = byHost[r.host] || { count: 0, KB: 0 };
    byHost[r.host] = { count: h.count + 1, KB: h.KB + r.size / 1024 };
  }
  const rounded = Object.fromEntries(
    Object.entries(byHost)
      .sort((a, b) => b[1].KB - a[1].KB)
      .map(([k, v]) => [k, { count: v.count, KB: Math.round(v.KB) }])
  );

  await ctx.close();
  return {
    ...raw,
    requests: reqs.length,
    totalKB: Math.round(reqs.reduce((a, r) => a + r.size, 0) / 1024),
    byHost: rounded,
  };
}

/** 한 페이지를 여러 번 재서 중앙값 한 벌로 접는다. */
async function measureTarget(browser, target, device, runs) {
  const passes = [];
  for (let i = 0; i < runs; i++) {
    process.stdout.write('   ' + target.name + ' / ' + device + ' — ' + (i + 1) + '회차\r');
    passes.push(await measureOnce(browser, target.url, device));
  }
  return { ...summarize(passes), byHost: passes[passes.length - 1].byHost };
}

async function measureAll() {
  const browser = await chromium.launch();
  const result = { measuredAt: new Date().toISOString(), runs: CFG.runs, targets: {} };
  try {
    for (const t of CFG.urls) {
      for (const device of CFG.devices) {
        const key = t.name + '/' + device;
        const s = await measureTarget(browser, t, device, CFG.runs);
        result.targets[key] = s;
        console.log(
          '   ' + key.padEnd(12) +
          ' LCP ' + String(s.lcp).padStart(5) + 'ms · FCP ' + String(s.fcp).padStart(5) +
          'ms · TTFB ' + String(s.ttfb).padStart(5) + 'ms · CLS ' + s.cls + ' · ' + s.totalKB + 'KB'
        );
      }
    }
  } finally {
    await browser.close();
  }
  return result;
}

function printReport(result) {
  for (const [key, s] of Object.entries(result.targets)) {
    console.log('\n── ' + key + ' ──────────────────────');
    for (const m of Object.keys(THRESHOLDS)) {
      if (s[m] === undefined) continue;
      const v = verdict(m, s[m]);
      console.log('  ' + (MARK[v] || '  ') + ' ' + THRESHOLDS[m].label.padEnd(16) + ' ' + fmt(s[m], THRESHOLDS[m].unit));
    }
    const b = classifyHosts(s.byHost, CFG.ownHost);
    console.log(
      '     구성: 우리 것 ' + b.own.KB + 'KB(' + b.own.count + ') · 폰트 ' + b.font.KB + 'KB(' + b.font.count +
      ') · 광고/분석 ' + b.ads.KB + 'KB(' + b.ads.count + ') · 기타 ' + b.other.KB + 'KB(' + b.other.count + ')'
    );
  }
}

function printCompare(before, after) {
  for (const key of Object.keys(after.targets)) {
    if (!before.targets[key]) {
      console.log('\n── ' + key + ' — 기준선에 없음, 건너뜀');
      continue;
    }
    console.log('\n── ' + key + ' ──────────────────────');
    for (const row of compare(before.targets[key], after.targets[key])) {
      const arrow = row.unchanged ? '=' : row.improved ? '▼' : '▲';
      const pct = row.pct === null ? '' : ' (' + (row.pct > 0 ? '+' : '') + row.pct + '%)';
      const grade = row.verdictBefore !== row.verdictAfter
        ? '   ' + MARK[row.verdictBefore] + '→' + MARK[row.verdictAfter]
        : '   ' + (MARK[row.verdictAfter] || '');
      console.log(
        '  ' + arrow + ' ' + row.label.padEnd(16) +
        fmt(row.before, row.unit).padStart(9) + ' → ' + fmt(row.after, row.unit).padStart(9) + pct + grade
      );
    }
  }
}

(async () => {
  const [mode, label] = process.argv.slice(2);

  if (mode === 'compare') {
    if (!label) {
      console.error('사용법: harness.js compare <기준선이름>');
      process.exit(1);
    }
    const file = path.join(BASE_DIR, label + '.json');
    if (!fs.existsSync(file)) {
      const have = fs.existsSync(BASE_DIR)
        ? fs.readdirSync(BASE_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''))
        : [];
      console.error("기준선 '" + label + "' 이 없습니다. 있는 것: " + (have.join(', ') || '(없음)'));
      process.exit(1);
    }
    const before = JSON.parse(fs.readFileSync(file, 'utf8'));
    console.log('📏 지금 상태를 ' + CFG.runs + '회씩 잽니다 (기준선: ' + label + ', ' + before.measuredAt + ')\n');
    const after = await measureAll();
    console.log('\n=== ' + label + ' 대비 변화 ===');
    printCompare(before, after);
    fs.mkdirSync(BASE_DIR, { recursive: true });
    fs.writeFileSync(path.join(BASE_DIR, '_last.json'), JSON.stringify(after, null, 2));
    console.log('\n저장: baselines/_last.json');
    return;
  }

  console.log('📏 ' + CFG.urls.length + '개 주소 × ' + CFG.devices.length + '개 기기 × ' + CFG.runs + '회\n');
  const result = await measureAll();
  printReport(result);

  if (mode === 'baseline') {
    const name = label || 'baseline-' + new Date().toISOString().slice(0, 10);
    fs.mkdirSync(BASE_DIR, { recursive: true });
    fs.writeFileSync(path.join(BASE_DIR, name + '.json'), JSON.stringify(result, null, 2));
    console.log('\n📌 기준선 저장: baselines/' + name + '.json');
    console.log('   고친 뒤:  node docs/site-kit/bench/harness.js compare ' + name);
  }
})().catch((e) => {
  console.error('❌ 하네스 실패:', e.message);
  process.exit(1);
});
