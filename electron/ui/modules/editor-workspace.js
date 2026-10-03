const PANEL_STATE_KEY = 'orbit.editor.toolPanelOpen';

/** Reparent existing controls; their values, references and listeners stay intact. */
export function arrangeEditorWorkspace(overlay) {
  if (!overlay || overlay.querySelector('#veWorkspace')) return;
  const toolbar = overlay.querySelector('#veToolbar');
  const body = overlay.querySelector('#veBody');
  if (!toolbar || !body) return;
  const doc = overlay.ownerDocument;
  const win = doc.defaultView;
  const make = (tag, id, className) => {
    const element = doc.createElement(tag);
    if (id) element.id = id;
    if (className) element.className = className;
    return element;
  };
  const workspace = make('div', 'veWorkspace');
  const panel = make('aside', 'veToolPanel');
  panel.setAttribute('aria-label', '편집 도구');
  const panelHeading = make('div', null, 've-panel-heading');
  panelHeading.textContent = '편집 도구';
  panel.append(panelHeading);
  body.before(workspace);
  workspace.append(body, panel);

  const group = (id, title, open = false, visualOnly = false) => {
    const details = make('details', id, 've-tool-group');
    details.open = open;
    const summary = make('summary');
    summary.textContent = title;
    const content = make('div', null, `ve-tool-content${visualOnly ? ' ve-visual-only' : ''}`);
    details.append(summary, content);
    panel.append(details);
    return content;
  };
  const move = (target, ids) => {
    for (const id of ids) {
      const element = overlay.querySelector(`#${id}`);
      if (element) target.append(element);
    }
  };

  const review = group('veReviewTools', '비평 · 글 수정');
  move(review, ['veAskFixBtn']);
  // Keep the visual-mode wrapper referenced by the existing editor controller.
  const draftWrap = overlay.querySelector('#veDraftWrap');
  const critique = overlay.querySelector('#veCritiqueBtn');
  if (critique) critique.classList.add('ve-visual-only');
  move(review, ['veCritiqueBtn', 'veRegenWrap']);

  const images = group('veImageTools', '이미지', true, true);
  const thumbnailRow = make('div', null, 've-thumbnail-row');
  images.append(thumbnailRow);
  move(thumbnailRow, ['veThumbBtn']);
  const textCheckbox = overlay.querySelector('#veThumbTextChk');
  if (textCheckbox) thumbnailRow.append(textCheckbox.closest('label') || textCheckbox);
  move(images, ['veThumbInsertBtn', 'veInsertImageBtn']);
  const batchRow = make('div', null, 've-batch-row');
  images.append(batchRow);
  move(batchRow, ['veGenerateAllImagesBtn', 'veImageScope']);
  move(images, ['veImageBatchCancelBtn', 'veImageBatchSummary']);

  const formatting = group('veFormattingTools', '서식', true);
  move(formatting, ['veFormatBar']);
  const insert = group('veInsertTools', '넣기', false, true);
  move(insert, ['veAdUnitSelect', 'veInsertAdBtn', 'veInsertCtaBtn', 'veRegenCtaBtn']);
  const settings = group('veSettingsTools', '엔진 · 발행');
  move(settings, ['veEngineWrap', 'veTargetPlatformWrap', 'veHostImagesLabel', 'veCopyHtmlBtn', 'veSaveAsBtn']);
  const help = group('veHelpTools', '도움말');
  move(help, ['veHintBar', 'veRevertBtn']);
  // The obsolete wrapper is retained for modalRefs without taking toolbar space.
  if (draftWrap) {
    review.append(draftWrap);
    draftWrap.hidden = true;
  }

  const toggle = make('button', 'veToolsToggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-controls', 'veToolPanel');
  toggle.title = '오른쪽 편집 도구를 열거나 접습니다';
  toolbar.append(toggle);
  // Only primary actions remain in the single-row header.
  move(toolbar, ['veTitleInput', 'veUndoBtn', 'veSourceBtn', 'veToolsToggle', 'veSaveBtn', 'veCancelBtn']);
  for (const button of toolbar.querySelectorAll('button')) {
    if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', button.textContent.trim());
  }
  for (const child of [...toolbar.children]) {
    if (!child.id) child.remove();
  }
  const status = overlay.querySelector('#veStatus');
  if (status) {
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    workspace.after(status);
  }

  const style = make('style');
  style.dataset.bgptEditorUi = '1';
  style.textContent = `
    #visualEditorOverlay { min-width:0; min-height:0; overflow:hidden; }
    #visualEditorOverlay #veToolbar { flex:0 0 auto; flex-wrap:nowrap!important; gap:6px!important; padding:8px 12px!important; min-width:0; overflow-x:auto; }
    #visualEditorOverlay #veTitleInput { min-width:100px!important; width:100px; flex:1 1 auto!important; }
    #visualEditorOverlay #veToolbar button { flex:0 0 auto; white-space:nowrap; min-height:36px; }
    #veToolsToggle { border:1px solid #475569; border-radius:8px; padding:8px 12px; background:#273449; color:#e2e8f0; font-family:inherit; font-size:12px; font-weight:600; cursor:pointer; }
    #visualEditorOverlay #veWorkspace { display:flex; flex:1 1 0; min-height:0; min-width:0; overflow:hidden; }
    #visualEditorOverlay #veBody { flex:1 1 0!important; min-width:0; min-height:0; height:100%; }
    #visualEditorOverlay #veToolPanel { flex:0 0 320px; width:320px; max-width:42vw; box-sizing:border-box; min-height:0; overflow:auto; overscroll-behavior:contain; padding:12px; background:#111c2e; border-left:1px solid #334155; color:#e2e8f0; }
    #visualEditorOverlay #veToolPanel[hidden], #visualEditorOverlay #veDraftWrap[hidden] { display:none!important; }
    #veToolPanel .ve-panel-heading { font-size:14px; font-weight:700; padding:2px 2px 12px; color:#cbd5e1; }
    #veToolPanel .ve-tool-group { border:1px solid #334155; border-radius:10px; margin:0 0 9px; background:#172337; overflow:hidden; }
    #veToolPanel summary { padding:12px; cursor:pointer; font-size:13px; font-weight:700; user-select:none; }
    #veToolPanel summary:hover { background:#23324a; }
    #veToolPanel summary:focus-visible, #veToolsToggle:focus-visible { outline:2px solid #38bdf8; outline-offset:-2px; }
    #veToolPanel .ve-tool-content { display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:0 10px 12px; min-width:0; }
    #veToolPanel .ve-tool-content > button { flex:1 1 100%; text-align:left; }
    #veToolPanel button { padding:9px 10px!important; min-height:36px; max-width:100%; white-space:normal!important; line-height:1.4!important; box-sizing:border-box; font-size:12px!important; }
    #veToolPanel select { width:100%!important; max-width:100%!important; min-width:0!important; box-sizing:border-box; padding:9px 8px!important; font-size:12px!important; }
    #veToolPanel label { flex-wrap:wrap; font-size:12px; line-height:1.5; }
    #veToolPanel .ve-thumbnail-row { display:flex; align-items:center; flex-wrap:wrap; gap:8px; width:100%; }
    #veToolPanel .ve-thumbnail-row button { flex:1 1 auto; }
    #veToolPanel .ve-thumbnail-row label { display:flex; align-items:center; gap:4px; color:#cbd5e1; }
    #veToolPanel .ve-batch-row { display:flex; align-items:center; flex-wrap:wrap; gap:6px; width:100%; min-width:0; }
    #veToolPanel .ve-batch-row > button { flex:1 1 150px; }
    #veToolPanel .ve-batch-row > select { flex:1 1 100px; width:auto!important; }
    #veToolPanel #veEngineWrap, #veToolPanel #veTargetPlatformWrap, #veToolPanel #veRegenWrap { width:100%; flex-wrap:wrap; gap:8px!important; min-width:0; }
    #veToolPanel #veEngineWrap > span, #veToolPanel #veTargetPlatformWrap > span, #veToolPanel #veRegenWrap > span { display:none; }
    #veToolPanel #veFormatBar { padding:0!important; border:0!important; background:transparent!important; gap:6px!important; }
    #veToolPanel #veFormatBar > span { display:none; }
    #veToolPanel #veFormatBar button { flex:1 1 78px; min-width:74px; white-space:nowrap!important; text-align:center; }
    #veToolPanel #veHintBar { border:0!important; padding:0!important; background:transparent!important; gap:10px!important; box-sizing:border-box; }
    #veToolPanel #veImageBatchSummary { flex-basis:100%; font-size:12px; line-height:1.5; overflow-wrap:anywhere; }
    #visualEditorOverlay #veStatus { flex:0 0 auto; width:auto!important; box-sizing:border-box; padding:5px 12px; min-height:24px!important; max-height:44px; overflow:auto; background:#0f172a; border-top:1px solid #334155; }
    #visualEditorOverlay.ve-images-busy #veImgToolbar,
    #visualEditorOverlay.ve-images-busy #veLinkToolbar,
    #visualEditorOverlay.ve-images-busy #veInsertMarker { display:none!important; }
    @media(max-width:759px) {
      #visualEditorOverlay #veToolbar { padding:6px!important; gap:4px!important; }
      #visualEditorOverlay #veToolbar button { padding:7px 8px!important; font-size:11px!important; }
      #visualEditorOverlay #veToolPanel { flex-basis:280px; max-width:45vw; padding:7px; }
      #veToolPanel .ve-tool-content { padding:0 7px 9px; gap:6px; }
    }
    @media(max-width:519px) {
      #visualEditorOverlay #veTitleInput { min-width:60px!important; width:60px; padding:7px 6px!important; }
      #visualEditorOverlay #veToolbar button { overflow:hidden; text-overflow:ellipsis; padding:7px 4px!important; }
      #visualEditorOverlay #veUndoBtn { width:36px; }
      #visualEditorOverlay #veSourceBtn { width:44px; }
      #visualEditorOverlay #veToolsToggle { width:64px; }
      #visualEditorOverlay #veSaveBtn { max-width:56px; }
      #visualEditorOverlay #veCancelBtn { width:36px; }
    }
  `;
  overlay.append(style);

  let preferredOpen = true;
  try { preferredOpen = win.localStorage.getItem(PANEL_STATE_KEY) !== 'false'; } catch { /* Private/file contexts may not expose storage. */ }
  const media = win.matchMedia('(max-width:759px)');
  let narrowOpened = false;
  const render = () => {
    const open = preferredOpen && (!media.matches || narrowOpened);
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? '도구 접기 ›' : '도구 열기 ‹';
    toggle.setAttribute('aria-label', open ? '편집 도구 접기' : '편집 도구 열기');
  };
  toggle.addEventListener('click', () => {
    const open = panel.hidden;
    preferredOpen = open;
    narrowOpened = open;
    try { win.localStorage.setItem(PANEL_STATE_KEY, String(open)); } catch { /* Continue without persistence. */ }
    render();
  });
  media.addEventListener('change', () => { narrowOpened = false; render(); });
  render();
}
