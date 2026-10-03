// Real browser layout/event checks. No models, accounts or publishing APIs.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://editor-workspace.test/**', route => route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' }));
    await page.goto('https://editor-workspace.test/');
    const template = read('electron/ui/modules/editor.js').match(/overlay\.innerHTML = `([\s\S]*?)`;/)[1]
      .replaceAll('${BTN_BASE}', 'border:0;border-radius:8px;padding:8px 12px;font-size:12px;cursor:pointer;')
      .replaceAll('${GROUP_LABEL}', 'font-size:11px;')
      .replaceAll('${DIVIDER}', 'width:1px;height:22px;background:#334155;');
    await page.addScriptTag({ content: read('electron/ui/modules/editor-workspace.js').replace(/^export /gm, '') + '\nwindow.arrangeEditorWorkspace = arrangeEditorWorkspace;' });
    await page.evaluate(html => {
      window.makeEditorFixture = () => {
        document.getElementById('visualEditorOverlay')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'visualEditorOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;background:#0f172a';
        overlay.innerHTML = html;
        document.body.append(overlay);
        // The controller creates these controls; support running this test while
        // its template integration is still being developed in parallel.
        const extras = {
          veThumbTextChk: '<label><input id="veThumbTextChk" type="checkbox"> 글자 포함</label>',
          veImageScope: '<select id="veImageScope"><option value="all">모든 소제목</option><option value="missing">이미지 없는 소제목</option></select>',
          veGenerateAllImagesBtn: '<button id="veGenerateAllImagesBtn">소제목 이미지 생성</button>',
          veImageBatchCancelBtn: '<button id="veImageBatchCancelBtn" style="display:none">중지</button>',
          veImageBatchSummary: '<div id="veImageBatchSummary" hidden>준비</div>',
        };
        for (const [id, markup] of Object.entries(extras)) if (!overlay.querySelector('#' + id)) overlay.querySelector('#veDraftWrap').insertAdjacentHTML('beforeend', markup);
        overlay.querySelector('#veSectionImgBtn')?.remove();
        overlay.querySelector('#veRegenImgBtn')?.remove();
        window.imageClicks = 0;
        window.formatClicks = 0;
        const imageButton = overlay.querySelector('#veThumbBtn');
        imageButton.addEventListener('click', () => window.imageClicks++);
        overlay.querySelector('#veFormatBar').addEventListener('click', event => { if (event.target.closest('[data-vefmt]')) window.formatClicks++; });
        window.originalImageButton = imageButton;
        window.arrangeEditorWorkspace(overlay);
      };
      window.makeEditorFixture();
    }, template);

    const measure = () => page.evaluate(() => {
      const rect = id => { const r = document.getElementById(id).getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height, right:r.right }; };
      return { body:rect('veBody'), frame:rect('veFrame'), panel:rect('veToolPanel'), toolbar:rect('veToolbar'), viewport:{ width:innerWidth, height:innerHeight } };
    });
    let geometry = await measure();
    assert(geometry.body.height > geometry.viewport.height * .8);
    assert.equal(geometry.panel.width, 320);
    assert(geometry.body.right <= geometry.panel.x + 1);
    assert(geometry.toolbar.height < 70);
    assert.equal(await page.locator('#veImageTools').getAttribute('open'), '');
    assert.equal(await page.locator('#veFormattingTools').getAttribute('open'), '');
    assert.equal(await page.locator('#veReviewTools').getAttribute('open'), null);
    await page.locator('#veThumbBtn').click();
    await page.locator('#veThumbTextChk').check();
    await page.locator('#veFormatBar [data-vefmt="bold"]').click();
    assert.deepEqual(await page.evaluate(() => [window.imageClicks, window.formatClicks, window.originalImageButton === document.getElementById('veThumbBtn')]), [1, 1, true]);
    assert.equal(await page.locator('#veImageBatchCancelBtn').isVisible(), false);
    assert.equal(await page.locator('#veImageScope').evaluate(node => node.closest('.ve-batch-row')?.contains(document.getElementById('veGenerateAllImagesBtn'))), true);
    const batchRects = await page.evaluate(() => [document.getElementById('veGenerateAllImagesBtn'), document.getElementById('veImageScope')].map(node => node.getBoundingClientRect().y));
    assert(Math.abs(batchRects[0] - batchRects[1]) < 1); // centered controls may differ by a subpixel
    await page.evaluate(() => {
      const overlay = document.getElementById('visualEditorOverlay');
      for (const id of ['veImgToolbar', 'veLinkToolbar', 'veInsertMarker']) {
        const popover = document.createElement('div');
        popover.id = id;
        popover.textContent = 'editing popover';
        popover.style.cssText = 'display:block;position:absolute;width:30px;height:20px';
        document.getElementById('veBody').append(popover);
      }
      overlay.classList.add('ve-images-busy');
    });
    for (const id of ['veImgToolbar', 'veLinkToolbar', 'veInsertMarker']) assert.equal(await page.locator('#' + id).isVisible(), false);
    await page.evaluate(() => {
      document.getElementById('visualEditorOverlay').classList.remove('ve-images-busy');
      for (const id of ['veImgToolbar', 'veLinkToolbar', 'veInsertMarker']) document.getElementById(id).remove();
    });
    assert.equal(await page.locator('#veThumbTextChk').evaluate(node => node.closest('.ve-thumbnail-row')?.contains(document.getElementById('veThumbBtn'))), true);
    await page.locator('#veHelpTools > summary').click();
    assert.equal(await page.locator('#veHintBar').isVisible(), true);
    const beforeWidth = geometry.body.width;
    await page.locator('#veToolsToggle').click();
    geometry = await measure();
    assert.equal(geometry.body.width, geometry.viewport.width);
    assert(geometry.body.width >= beforeWidth + 319);
    assert.equal(await page.locator('#veToolsToggle').getAttribute('aria-expanded'), 'false');
    await page.evaluate(() => window.makeEditorFixture());
    assert.equal(await page.locator('#veToolPanel').isVisible(), false); // persisted close
    await page.locator('#veToolsToggle').click();
    await page.evaluate(() => window.arrangeEditorWorkspace(document.getElementById('visualEditorOverlay')));
    assert.equal(await page.locator('#veWorkspace').count(), 1); // idempotence
    assert.equal(await page.locator('#veThumbBtn').count(), 1);

    for (const width of [640, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await page.evaluate(() => window.makeEditorFixture());
      assert.equal(await page.locator('#veToolPanel').isVisible(), false);
      geometry = await measure();
      assert.equal(geometry.body.width, width);
      assert(geometry.body.height > 640);
      await page.locator('#veToolsToggle').click();
      geometry = await measure();
      assert(geometry.panel.width <= width * .45 + 1);
      assert(geometry.body.right <= geometry.panel.x + 1);
      assert(geometry.body.width >= width * .55 - 1);
      assert(geometry.body.height > 640);
      if (width === 390) assert.equal(await page.locator('#veToolbar').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
    }
    assert.deepEqual(errors, []);
    console.log('PASS editor workspace: preserved listeners, grouped controls, collapse persistence, idempotence, mobile layout and >80% editor height.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
