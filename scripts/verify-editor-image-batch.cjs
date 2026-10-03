// Chromium integration: all generation IPC is mocked. No API costs or publication.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const strip = source => source.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '' }));
    await page.goto('https://editor-image.test/');
    await page.setContent('<html><body><select id="h2ImageSource"><option value="gpt-image-2.5-flare">GPT 이미지 2.5</option></select></body></html>');
    await page.evaluate(() => {
      Object.assign(window, {
        getAppState: () => ({}), addLog: () => {}, getTextLength: s => s.replace(/<[^>]*>/g, '').length,
        loadAdUnits: () => [], collapseAdBlocks: s => s, expandAdSlots: s => ({ html: s, missing: 0 }),
        AD_SLOT_STYLE: '', engineOverrides: () => ({}), alert: message => { throw Error(message); }, confirm: () => true,
        __buildPublishedPlatformPayload: async () => ({}), calls: [], failAt: 0, hold: false,
        electronAPI: { invoke: async (channel, args) => {
          if (channel !== 'generate-editor-image') throw Error('Unexpected IPC: ' + channel);
          window.calls.push(args);
          const id = window.calls.length;
          if (window.hold) await new Promise(resolve => { window.releaseImage = resolve; });
          if (id === window.failAt) return { ok: false, error: 'test engine failure', ...(window.retryToken ? { retryToken: window.retryToken } : {}) };
          return { ok: true, url: `https://images.test/${id}.png`, html: `<img alt="generated" src="https://images.test/${id}.png">` };
        } },
      });
    });
    const images = strip(read('electron/ui/modules/editor-images.js'));
    await page.addScriptTag({ content: `(function(){${images}\nObject.assign(window,{initImageEditing,detachImageEditing,hostPendingImages,insertImagesAtCaret,insertHtmlAtCaret,findCaretBlock});})();` });
    await page.addScriptTag({ content: `${strip(read('electron/ui/modules/editor-workspace.js'))}\n${strip(read('electron/ui/modules/editor-image-plan.js'))}` });
    await page.addScriptTag({ content: `(function(){${strip(read('electron/ui/modules/editor.js'))}\nwindow.editorTest={openVisualEditor,serializeEditor,undoOnce,runEditorImageBatch,regenerateOneImage};})();` });
    const original = '<!doctype html><html lang="ko"><head><style>.imported h2{color:rgb(12,34,56)} .imported p{font-size:23px}</style></head><body class="imported"><article><header><h1>외부 HTML 제목</h1><img id="original-thumb" class="custom-thumb" style="border:2px solid red" src="https://images.test/original.png"></header><nav><h2>목차</h2></nav><section><h2>첫째</h2><p>첫째 본문</p><picture><source srcset="https://images.test/old.webp"><img id="old-section" class="custom-section" src="https://images.test/old.png" srcset="https://images.test/old2.png 2x"></picture></section><section><h2>둘째</h2><p>둘째 본문</p></section><section><h2>셋째</h2><p>셋째 본문</p></section><section><h2>넷째</h2><p>넷째 본문</p></section></article></body></html>';
    const open = async (html = original) => {
      await page.evaluate(async html => {
        window.calls = []; window.failAt = 0; window.hold = false; window.retryToken = null;
        await window.editorTest.openVisualEditor({ kind: 'paste', title: '테스트 제목', html });
      }, html);
    };
    const run = async scope => {
      await page.locator('#veImageScope').selectOption(scope);
      await page.locator('#veGenerateAllImagesBtn').click();
      await page.waitForFunction(() => !document.getElementById('veGenerateAllImagesBtn').disabled);
    };
    await open();
    assert.equal(await page.locator('#veThumbTextChk').isChecked(), true);
    assert.match(await page.locator('#veImageBatchSummary').textContent(), /총 5장/);
    const before = await page.evaluate(() => window.editorTest.serializeEditor());
    await run('all');
    assert.deepEqual(await page.evaluate(() => calls.map(x => [x.kind, x.sectionTitle, x.thumbnailText, x.payload.imageSource])), [
      ['thumbnail', '', true, 'gpt-image-2.5-flare'], ['section', '첫째', true, 'gpt-image-2.5-flare'],
      ['section', '둘째', true, 'gpt-image-2.5-flare'], ['section', '셋째', true, 'gpt-image-2.5-flare'], ['section', '넷째', true, 'gpt-image-2.5-flare'],
    ]);
    const content = await page.evaluate(() => {
      const doc = document.getElementById('veFrame').contentDocument;
      return { count: doc.querySelectorAll('img').length, cls: doc.querySelector('#old-section').className,
        srcset: doc.querySelector('#old-section').getAttribute('srcset'), picture: doc.querySelector('source').getAttribute('srcset'),
        h2: [...doc.querySelectorAll('article > section h2')].map(h => h.textContent),
        color: getComputedStyle(doc.querySelector('article > section h2')).color };
    });
    assert.equal(content.count, 5); assert.equal(content.cls, 'custom-section');
    assert.equal(content.srcset, null); assert.equal(content.picture, null);
    assert.equal(content.color, 'rgb(12, 34, 56)');
    assert.deepEqual(content.h2, ['첫째', '둘째', '셋째', '넷째']);
    await page.locator('#veUndoBtn').click();
    assert.equal(await page.evaluate(() => window.editorTest.serializeEditor()), before);

    for (const [scope, headings] of [['odd', ['', '첫째', '셋째']], ['even', ['', '둘째', '넷째']], ['thumbnail', ['']]]) {
      await open(); await page.locator('#veThumbTextChk').uncheck(); await run(scope);
      assert.deepEqual(await page.evaluate(() => calls.map(x => x.sectionTitle)), headings);
      assert(await page.evaluate(() => calls.every(x => x.thumbnailText === false)));
    }
    await open();
    await page.locator('#veThumbBtn').click();
    await page.waitForFunction(() => !document.getElementById('veThumbBtn').disabled);
    assert.equal(await page.evaluate(() => calls.length), 1);
    assert.equal(await page.evaluate(() => calls[0].kind), 'thumbnail');
    await page.evaluate(() => window.editorTest.regenerateOneImage(document.getElementById('veFrame').contentDocument.querySelector('#original-thumb')));
    assert.equal(await page.evaluate(() => calls[1].kind), 'thumbnail');
    await open(); await page.evaluate(() => { window.failAt = 1; window.retryToken = 'saved-single-token'; });
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.evaluate(() => window.editorTest.regenerateOneImage(document.getElementById('veFrame').contentDocument.querySelector('#original-thumb')));
    }
    assert.equal(await page.evaluate(() => calls[1].retryToken), 'saved-single-token');

    // A failed section stops subsequent billing; resume keeps already completed slots.
    await open(); await page.evaluate(() => { window.failAt = 3; }); await run('all');
    assert.equal(await page.evaluate(() => calls.length), 3);
    assert.match(await page.locator('#veGenerateAllImagesBtn').textContent(), /남은 3장/);
    assert.match(await page.locator('#veStatus').textContent(), /자동 재시도하지 않습니다/);
    await run('all');
    assert.deepEqual(await page.evaluate(() => calls.map(x => x.sectionTitle)), ['', '첫째', '둘째', '둘째', '셋째', '넷째']);
    assert.equal(await page.evaluate(() => document.getElementById('veFrame').contentDocument.querySelectorAll('img').length), 5);

    // Post-processing failures carry the saved server result token, avoiding paid regeneration.
    await open(); await page.evaluate(() => { window.failAt = 1; window.retryToken = 'saved-image-token'; });
    await run('all'); await run('all');
    assert.equal(await page.evaluate(() => calls[1].retryToken), 'saved-image-token');
    assert.equal(await page.evaluate(() => calls[2].retryToken), undefined);

    // Stop lets the paid in-flight result finish; no next request and no racing edits.
    await open(); await page.evaluate(() => { window.hold = true; });
    await page.locator('#veGenerateAllImagesBtn').click();
    await page.waitForFunction(() => window.calls.length === 1 && !!window.releaseImage);
    assert.equal(await page.locator('#veSaveBtn').isDisabled(), true);
    assert.equal(await page.locator('#veUndoBtn').isDisabled(), true);
    assert.equal(await page.evaluate(() => document.getElementById('veFrame').contentDocument.body.contentEditable), 'false');
    await page.locator('#veImageBatchCancelBtn').click();
    await page.evaluate(() => { window.hold = false; window.releaseImage(); });
    await page.waitForFunction(() => !document.getElementById('veGenerateAllImagesBtn').disabled);
    assert.equal(await page.evaluate(() => calls.length), 1);
    assert.match(await page.locator('#veGenerateAllImagesBtn').textContent(), /남은 4장/);
    await run('all'); assert.equal(await page.evaluate(() => calls.length), 5);

    // New thumbnails must never replace the first section's pre-existing image.
    await open('<article><h2>첫째</h2><div class="separator"><img id="section-only" src="https://images.test/keep.png"></div><p>본문</p></article>');
    await run('thumbnail');
    assert.equal(await page.evaluate(() => document.getElementById('veFrame').contentDocument.querySelector('#section-only').getAttribute('src')), 'https://images.test/keep.png');
    await open('<article><header><img class="author-avatar" src="https://images.test/author.png"><h1>제목</h1></header><h2>소제목</h2><img id="icon" width="24" height="24" src="https://images.test/icon.png"><a href="https://images.test/article.png"><img id="content-img" src="https://images.test/article.png"></a></article>');
    await run('all');
    assert.deepEqual(await page.evaluate(() => {
      const doc = document.getElementById('veFrame').contentDocument;
      return [doc.querySelector('.author-avatar').getAttribute('src'), doc.querySelector('#icon').getAttribute('src'),
        doc.querySelector('#content-img').getAttribute('src'), doc.querySelector('a').getAttribute('href'), doc.querySelectorAll('img').length];
    }), ['https://images.test/author.png', 'https://images.test/icon.png', 'https://images.test/2.png', 'https://images.test/2.png', 4]);
    await open('<main><h3>H3 소제목</h3><p>내용</p></main>'); await run('all');
    assert.deepEqual(await page.evaluate(() => calls.map(x => x.sectionTitle)), ['', 'H3 소제목']);
    await open('<article><p>소제목 없음</p></article>'); await run('all');
    assert.equal(await page.evaluate(() => calls.length), 1);
    assert.deepEqual(errors, []);
    if (process.env.ORBIT_EDITOR_SCREENSHOT) {
      await open();
      await page.locator('#veImageScope').selectOption('all');
      await page.screenshot({ path: process.env.ORBIT_EDITOR_SCREENSHOT });
    }
    console.log('PASS image batch: 4 scopes, selected engine/text flag, nested headings, replacement/CSS, undo, partial resume, cancellation, thumbnail identity, H3/no-heading fallback.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
