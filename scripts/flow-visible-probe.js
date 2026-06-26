const fs = require('fs');
const path = require('path');

require('dotenv').config();
process.env.VISIBLE_BROWSER = 'true';

const { ensurePage, cleanupImageFx } = require('../dist/core/imageFxGenerator');
const { makeFlowImage } = require('../dist/core/flowGenerator');

const outDir = path.resolve(__dirname, '..', 'test-output', 'flow-probe');
fs.mkdirSync(outDir, { recursive: true });

const networkLog = [];
function log(line) {
  const text = `[FLOW_PROBE] ${line}`;
  console.log(text);
  fs.appendFileSync(path.join(outDir, 'probe.log'), `${new Date().toISOString()} ${text}\n`, 'utf8');
}

async function snap(page, name) {
  const file = path.join(outDir, `${String(Date.now()).slice(-8)}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(e => log(`screenshot ${name} failed: ${e.message}`));
  log(`screenshot ${name}: ${file}`);
}

async function inspect(page, name) {
  const data = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button')).slice(0, 40).map((b, i) => ({
      i,
      text: (b.textContent || '').trim().slice(0, 80),
      disabled: b.disabled,
      ariaDisabled: b.getAttribute('aria-disabled'),
      title: b.getAttribute('title'),
      icons: Array.from(b.querySelectorAll('i')).map(i => (i.textContent || '').trim()).join('|'),
    }));
    const boxes = Array.from(document.querySelectorAll('div[role="textbox"][contenteditable="true"], [data-slate-editor="true"], textarea')).map((el, i) => ({
      i,
      tag: el.tagName,
      text: (el.textContent || el.value || '').trim().slice(0, 120),
      visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
    }));
    return {
      url: location.href,
      title: document.title,
      body: (document.body?.innerText || '').slice(0, 1500),
      buttons,
      boxes,
    };
  });
  const file = path.join(outDir, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  log(`inspect ${name}: ${file}`);
}

(async () => {
  let page;
  let ticker;
  try {
    fs.rmSync(path.join(outDir, 'probe.log'), { force: true });
    log('start visible probe');
    page = await ensurePage(msg => log(msg));
    log(`page ready: ${page.url()}`);

    page.on('request', req => {
      const url = req.url();
      if (/\/fx\/api|flowMedia|trpc|batchGenerate|generate/i.test(url)) {
        networkLog.push({ type: 'request', method: req.method(), url });
        log(`request ${req.method()} ${url}`);
      }
    });
    page.on('response', async res => {
      const url = res.url();
      if (/\/fx\/api|flowMedia|trpc|batchGenerate|generate/i.test(url)) {
        const item = { type: 'response', status: res.status(), url };
        networkLog.push(item);
        log(`response ${res.status()} ${url}`);
      }
    });

    await snap(page, 'before');
    await inspect(page, 'before');

    ticker = setInterval(async () => {
      if (!page) return;
      await snap(page, 'tick');
      await inspect(page, 'tick');
    }, 30000);

    const result = await makeFlowImage(
      'Premium Korean blog thumbnail, clean laptop dashboard and publishing calendar, photorealistic, no text overlay, 16:9.',
      { aspectRatio: '16:9', isThumbnail: false },
      msg => log(msg),
    );

    clearInterval(ticker);
    await snap(page, 'after');
    await inspect(page, 'after');

    const summary = { ok: result.ok, error: result.error, modelUsed: result.modelUsed, networkLog };
    if (result.ok) {
      const m = /^data:image\/(\w+);base64,(.+)$/i.exec(result.dataUrl);
      if (m) {
        const ext = m[1].toLowerCase().replace('jpeg', 'jpg');
        const imageFile = path.join(outDir, `flow-probe-result.${ext}`);
        fs.writeFileSync(imageFile, Buffer.from(m[2], 'base64'));
        summary.imageFile = imageFile;
      }
    }
    fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
    log(`done ok=${result.ok} error=${result.error || ''}`);
    process.exitCode = result.ok ? 0 : 1;
  } catch (e) {
    if (ticker) clearInterval(ticker);
    log(`fatal ${e.stack || e.message || e}`);
    process.exitCode = 1;
  } finally {
    if (ticker) clearInterval(ticker);
    await cleanupImageFx().catch(() => {});
    setTimeout(() => process.exit(process.exitCode || 0), 500);
  }
})();
