// Real Chromium DOM regression; platform and model calls are mocked (no publishing/API cost).
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { chromium } = require('playwright');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const strip = s => s.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setContent('<html><body></body></html>');
    await page.evaluate(() => {
      Object.assign(window, {
        getAppState: () => ({}), addLog: () => {}, getTextLength: s => s.replace(/<[^>]*>/g, '').length,
        loadAdUnits: () => [], collapseAdBlocks: s => s, expandAdSlots: s => ({html:s, missing:0}),
        AD_SLOT_STYLE: '', engineOverrides: () => ({}),
        alert: s => { throw Error(s); }, confirm: () => true,
        __buildPublishedPlatformPayload: async () => ({}),
        electronAPI: { invoke: async (channel, args) => {
          window.lastCall = {channel,args};
          if (channel === 'improve-editor-html') return {ok:true, revised:1, html:args.html.replace('원래 문장','고친 문장'), actuallyFixed:[], stillPresent:[]};
          return {ok:true};
        }},
      });
    });
    const images = strip(read('electron/ui/modules/editor-images.js'));
    await page.addScriptTag({content: `(function(){${images}\nObject.assign(window,{initImageEditing,detachImageEditing,hostPendingImages,insertImagesAtCaret,insertHtmlAtCaret,findCaretBlock});})();`});
    const editor = strip(read('electron/ui/modules/editor.js'));
    await page.addScriptTag({content: `(function(){${editor}\nwindow.editorTest={openVisualEditor,serializeEditor,pushUndo,undoOnce,isDirty,applyRevisedHtml};})();`});
    const original = '<!doctype html><html lang="ko" class="custom-root"><head><style>body.custom{background:rgb(12, 34, 56);color:white} .custom p{font-size:27px}</style></head><body class="custom" style="padding:7px"><p>원래 문장</p><h2>안내</h2><p>뒤 문장</p></body></html>';
    await page.evaluate(html => window.editorTest.openVisualEditor({kind:'paste',title:'검증',html}), original);
    assert.equal(await page.locator('#veUndoBtn').count(), 1);
    assert.equal(await page.locator('#veUndoImageOpBtn, #veSectionImgBtn').count(), 0);
    const frame = page.frames().find(f => f !== page.mainFrame());
    assert.equal(await frame.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(12, 34, 56)');
    let html = await page.evaluate(() => window.editorTest.serializeEditor());
    assert.match(html, /lang="ko"/); assert.match(html, /class="custom"/); assert.match(html, /padding:7px/);
    await page.evaluate(() => {
      window.editorTest.pushUndo('표 넣기');
      document.querySelector('#visualEditorOverlay iframe').contentDocument.body.insertAdjacentHTML('beforeend','<table><tr><td>표</td></tr></table>');
      window.editorTest.undoOnce();
    });
    assert.doesNotMatch(await page.evaluate(() => window.editorTest.serializeEditor()), /<table/);
    await page.evaluate(() => {
      const d = document.querySelector('#visualEditorOverlay iframe').contentDocument;
      d.querySelector('p').click();
      window.insertHtmlAtCaret(d, '<p id="inserted">이미지 자리</p>');
    });
    assert.match(await page.evaluate(() => window.editorTest.serializeEditor()), /id="inserted"/);
    await page.locator('#veUndoBtn').click();
    assert.doesNotMatch(await page.evaluate(() => window.editorTest.serializeEditor()), /id="inserted"/);
    await page.locator('#veAskFixBtn').click();
    await page.locator('#veAskMultiDialog textarea').fill('원래 문장을 고친 문장으로 바꿔 주세요');
    await page.locator('#veAskMultiOk').click();
    await page.waitForFunction(() => window.lastCall?.channel === 'improve-editor-html');
    await page.waitForFunction(() => window.editorTest.serializeEditor().includes('고친 문장'));
    const issue = await page.evaluate(() => window.lastCall.args.issues[0]);
    assert.equal(issue.sectionIndex, -1); assert.equal(issue.fix, issue.detail);
    assert.equal(await page.evaluate(() => window.editorTest.isDirty()), true);
    await page.locator('#veUndoBtn').click();
    assert.match(await page.evaluate(() => window.editorTest.serializeEditor()), /원래 문장/);
    await page.locator('#veSourceBtn').click();
    await page.locator('#veSourceArea').fill('<p>원래 문장 — 코드에서 먼저 수정</p>');
    await page.locator('#veAskFixBtn').click();
    await page.locator('#veAskMultiInput').fill('원래 문장을 고친 문장으로');
    await page.locator('#veAskMultiOk').click();
    await page.waitForFunction(() => window.editorTest.serializeEditor().includes('고친 문장 — 코드에서 먼저 수정'));
    assert.match(await page.evaluate(() => window.lastCall.args.html), /코드에서 먼저 수정/);
    assert.equal(await page.locator('#veSourceArea').isVisible(), false);
    await page.evaluate(() => window.editorTest.openVisualEditor({kind:'paste',title:'다음 글',html:'<p>다음 글</p>'}));
    assert.equal(await page.locator('#veUndoBtn').isDisabled(), true);
    assert.deepEqual(errors, []);
    console.log('PASS: editor request wiring, custom CSS/attributes, shared undo, dirty state, session isolation');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
