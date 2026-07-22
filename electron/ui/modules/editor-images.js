// ✏️ 비주얼 편집기 - 이미지/링크 편집 (선택/삭제/교체/삽입 + 링크 수정 + 저장 시 일괄 호스팅)
// 오버레이 UI는 iframe 밖(#veBody)에 두어 직렬화 결과를 오염시키지 않는다.

let state = null; // { frame, doc, setStatus, onAfterRestore, imgToolbar, insertMarker, linkToolbar, selectedImg, selectedLink, hoverBlock, opStack }

const IMAGE_BLOCK_STYLE = 'text-align:center;margin:18px 0;';
const IMAGE_STYLE = 'max-width:100%;border-radius:10px;box-shadow:0 4px 14px rgba(0,0,0,0.12);';

function makeImageBlockHtml(dataUrl) {
  return `<p style="${IMAGE_BLOCK_STYLE}"><img src="${dataUrl}" data-bgpt-user-image="1" alt="" style="${IMAGE_STYLE}"/></p>`;
}

// ─────────────────────────────────────────────
// 초기화 / 해제
// ─────────────────────────────────────────────

export function initImageEditing(frame, doc, { setStatus, onAfterRestore }) {
  detachImageEditing();

  const veBody = frame.parentElement;

  let imgToolbar = veBody.querySelector('#veImgToolbar');
  if (!imgToolbar) {
    imgToolbar = document.createElement('div');
    imgToolbar.id = 'veImgToolbar';
    imgToolbar.style.cssText = 'position:absolute;display:none;z-index:10;gap:6px;background:#1e293b;border-radius:10px;padding:6px;box-shadow:0 6px 20px rgba(0,0,0,0.35);';
    imgToolbar.innerHTML = `
      <button id="veImgReplaceBtn" style="padding:7px 12px;border:none;border-radius:7px;background:#334155;color:#e2e8f0;font-weight:700;font-size:12px;cursor:pointer;">🔄 교체</button>
      <button id="veImgDeleteBtn" style="padding:7px 12px;border:none;border-radius:7px;background:#7f1d1d;color:#fecaca;font-weight:700;font-size:12px;cursor:pointer;">🗑 삭제</button>
    `;
    veBody.appendChild(imgToolbar);
    imgToolbar.querySelector('#veImgReplaceBtn').addEventListener('click', () => replaceSelectedImage());
    imgToolbar.querySelector('#veImgDeleteBtn').addEventListener('click', () => deleteSelectedImage());
  }

  let insertMarker = veBody.querySelector('#veInsertMarker');
  if (!insertMarker) {
    insertMarker = document.createElement('button');
    insertMarker.id = 'veInsertMarker';
    insertMarker.style.cssText = 'position:absolute;display:none;z-index:9;transform:translateX(-50%);padding:5px 14px;border:none;border-radius:999px;background:#6366f1;color:#fff;font-weight:800;font-size:12px;cursor:pointer;box-shadow:0 4px 14px rgba(99,102,241,0.45);';
    insertMarker.textContent = '＋ 이미지';
    veBody.appendChild(insertMarker);
    insertMarker.addEventListener('click', () => insertAtHoverBlock());
  }

  let linkToolbar = veBody.querySelector('#veLinkToolbar');
  if (!linkToolbar) {
    linkToolbar = document.createElement('div');
    linkToolbar.id = 'veLinkToolbar';
    linkToolbar.style.cssText = 'position:absolute;display:none;z-index:10;flex-direction:column;gap:6px;background:#1e293b;border-radius:10px;padding:6px;box-shadow:0 6px 20px rgba(0,0,0,0.35);';
    linkToolbar.innerHTML = `
      <div id="veLinkBtnRow" style="display:flex;gap:6px;">
        <button id="veLinkEditBtn" style="padding:7px 12px;border:none;border-radius:7px;background:#334155;color:#93c5fd;font-weight:700;font-size:12px;cursor:pointer;">🔗 링크 수정</button>
        <button id="veLinkDeleteBtn" style="padding:7px 12px;border:none;border-radius:7px;background:#7f1d1d;color:#fecaca;font-weight:700;font-size:12px;cursor:pointer;">🗑 삭제</button>
      </div>
      <div id="veLinkEditRow" style="display:none;gap:6px;align-items:center;">
        <input id="veLinkInput" type="text" placeholder="https://이동할-주소" spellcheck="false"
          style="width:300px;padding:7px 10px;border:1px solid #475569;border-radius:7px;background:#0f172a;color:#f1f5f9;font-size:12px;" />
        <button id="veLinkSaveBtn" style="padding:7px 12px;border:none;border-radius:7px;background:#059669;color:#fff;font-weight:800;font-size:12px;cursor:pointer;">저장</button>
        <button id="veLinkCancelBtn" style="padding:7px 10px;border:none;border-radius:7px;background:#334155;color:#cbd5e1;font-weight:700;font-size:12px;cursor:pointer;">취소</button>
      </div>
    `;
    veBody.appendChild(linkToolbar);
    linkToolbar.querySelector('#veLinkEditBtn').addEventListener('click', () => openLinkEditRow());
    linkToolbar.querySelector('#veLinkDeleteBtn').addEventListener('click', () => deleteSelectedLink());
    linkToolbar.querySelector('#veLinkSaveBtn').addEventListener('click', () => saveLinkEdit());
    linkToolbar.querySelector('#veLinkCancelBtn').addEventListener('click', () => closeLinkEditRow());
    linkToolbar.querySelector('#veLinkInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); saveLinkEdit(); }
      if (e.key === 'Escape') { e.stopPropagation(); closeLinkEditRow(); }
    });
  }

  state = {
    frame, doc, setStatus, onAfterRestore,
    imgToolbar, insertMarker, linkToolbar,
    selectedImg: null, selectedLink: null, hoverBlock: null,
    opStack: [],
  };

  doc.addEventListener('click', onDocClick, true);
  doc.addEventListener('mouseover', onDocMouseOver);
  doc.addEventListener('scroll', hideOverlays, true);
  doc.addEventListener('input', () => { /* 텍스트 편집 중 위치가 어긋나므로 숨김 */ hideOverlays(); });

  if (!window.__veResizeBound) {
    window.__veResizeBound = true;
    window.addEventListener('resize', () => { try { hideOverlays(); } catch { /* noop */ } });
  }
}

export function detachImageEditing() {
  if (!state) return;
  hideOverlays();
  // doc 리스너는 iframe 재작성(doc.open) 시 함께 소멸됨
  state = null;
}

function hideOverlays() {
  if (!state) return;
  state.imgToolbar.style.display = 'none';
  state.insertMarker.style.display = 'none';
  state.linkToolbar.style.display = 'none';
  closeLinkEditRow();
  if (state.selectedImg) {
    state.selectedImg.classList.remove('ve-img-selected');
    if (!state.selectedImg.getAttribute('class')) state.selectedImg.removeAttribute('class');
    state.selectedImg = null;
  }
  if (state.selectedLink) {
    state.selectedLink.classList.remove('ve-link-selected');
    if (!state.selectedLink.getAttribute('class')) state.selectedLink.removeAttribute('class');
    state.selectedLink = null;
  }
  state.hoverBlock = null;
}

// ─────────────────────────────────────────────
// 선택 툴바
// ─────────────────────────────────────────────

function onDocClick(e) {
  if (!state) return;
  const target = e.target;
  if (target && target.tagName === 'IMG') {
    e.preventDefault();
    e.stopPropagation();
    selectImage(target);
    return;
  }
  // 버튼/링크 클릭 → 링크 툴바 (글자 수정을 위한 커서 이동은 막지 않음)
  const anchor = target?.closest ? target.closest('a') : null;
  if (anchor) {
    selectLink(anchor);
    return;
  }
  // 그 외 클릭 → 전체 선택 해제
  hideOverlays();
}

function selectImage(img) {
  hideOverlays();
  state.selectedImg = img;
  img.classList.add('ve-img-selected');

  const rect = img.getBoundingClientRect();
  const toolbar = state.imgToolbar;
  toolbar.style.display = 'flex';
  const top = rect.top - 46;
  toolbar.style.top = `${Math.max(6, top < 6 ? rect.top + 8 : top)}px`;
  toolbar.style.left = `${Math.max(6, rect.left + 8)}px`;
}

// ─────────────────────────────────────────────
// 링크/CTA 버튼 편집
// ─────────────────────────────────────────────

function isButtonLikeLink(a) {
  return /btn|button|cta/i.test(a.className || '');
}

// CTA는 <center><style>…</style><div class="cta-responsive-box">…</div></center> 구조 —
// 박스만 지우면 style/center 껍데기가 남으므로 삭제 단위를 위로 확장한다.
function getCtaDeleteUnit(a) {
  const box = a.closest('.cta-responsive-box') || a.closest('[class*="cta"][class*="box"]');
  if (!box) return null;
  const center = box.closest('center');
  return center || box;
}

function selectLink(anchor) {
  hideOverlays();
  state.selectedLink = anchor;
  anchor.classList.add('ve-link-selected');

  const deleteBtn = state.linkToolbar.querySelector('#veLinkDeleteBtn');
  deleteBtn.textContent = getCtaDeleteUnit(anchor) ? '🗑 CTA 삭제'
    : isButtonLikeLink(anchor) ? '🗑 버튼 삭제'
    : '⛓️ 링크 해제';

  const rect = anchor.getBoundingClientRect();
  const toolbar = state.linkToolbar;
  toolbar.style.display = 'flex';
  const top = rect.top - 46;
  toolbar.style.top = `${Math.max(6, top < 6 ? rect.bottom + 8 : top)}px`;
  toolbar.style.left = `${Math.max(6, rect.left)}px`;
}

function openLinkEditRow() {
  if (!state?.selectedLink) return;
  const editRow = state.linkToolbar.querySelector('#veLinkEditRow');
  const input = state.linkToolbar.querySelector('#veLinkInput');
  editRow.style.display = 'flex';
  input.value = state.selectedLink.getAttribute('href') || '';
  input.focus();
  input.select();
}

function closeLinkEditRow() {
  const editRow = state?.linkToolbar?.querySelector('#veLinkEditRow');
  if (editRow) editRow.style.display = 'none';
}

function saveLinkEdit() {
  if (!state?.selectedLink) return;
  const input = state.linkToolbar.querySelector('#veLinkInput');
  let url = String(input.value || '').trim();
  if (!url) {
    alert('이동할 주소를 입력해주세요.');
    input.focus();
    return;
  }
  // 초보자 배려: 프로토콜 없이 도메인만 입력하면 https:// 자동 보정
  if (!/^(https?:\/\/|mailto:|tel:|#|\/)/i.test(url)) {
    url = 'https://' + url;
  }
  pushImageOp();
  state.selectedLink.setAttribute('href', url);
  state.setStatus(`🔗 링크 주소를 변경했습니다: ${url.slice(0, 80)}`);
  hideOverlays();
}

function deleteSelectedLink() {
  if (!state?.selectedLink) return;
  const anchor = state.selectedLink;
  const ctaUnit = getCtaDeleteUnit(anchor);

  if (ctaUnit) {
    if (!confirm('CTA 버튼(박스 전체)을 삭제할까요?')) return;
    pushImageOp();
    ctaUnit.remove();
    state.setStatus('CTA를 삭제했습니다. (↩️ 이미지·링크 취소로 복구 가능)');
  } else if (isButtonLikeLink(anchor)) {
    if (!confirm('이 버튼을 삭제할까요?')) return;
    pushImageOp();
    anchor.remove();
    state.setStatus('버튼을 삭제했습니다. (↩️ 이미지·링크 취소로 복구 가능)');
  } else {
    pushImageOp();
    // 링크 해제: 글자는 남기고 링크만 제거
    while (anchor.firstChild) anchor.parentNode.insertBefore(anchor.firstChild, anchor);
    anchor.remove();
    state.setStatus('링크를 해제했습니다. 글자는 그대로 남아 있습니다.');
  }
  hideOverlays();
}

function deleteSelectedImage() {
  if (!state?.selectedImg) return;
  const img = state.selectedImg;
  const doc = state.doc;

  const separator = img.closest('div.separator');
  if (separator) {
    if (!confirm('대표(썸네일) 이미지를 삭제할까요?\n발행 시 본문 첫 이미지가 자동으로 썸네일이 됩니다.')) return;
    pushImageOp();
    separator.remove();
  } else {
    pushImageOp();
    removeImageBlock(img);
  }
  hideOverlays();
  state.setStatus('이미지를 삭제했습니다. (↩️ 이미지작업 취소로 복구 가능)');
  void doc;
}

// 이미지만 담고 있는 래퍼(<a>/<p>/<figure>)는 블록째 제거
function removeImageBlock(img) {
  let node = img;
  const anchor = img.closest('a');
  if (anchor && isOnlyMeaningfulChild(anchor, img)) node = anchor;
  const block = node.parentElement;
  if (block && /^(P|FIGURE|DIV)$/i.test(block.tagName) && block.tagName !== 'BODY' && isOnlyMeaningfulChild(block, node)) {
    block.remove();
    return;
  }
  node.remove();
}

function isOnlyMeaningfulChild(parent, child) {
  return Array.from(parent.childNodes).every((n) => {
    if (n === child) return true;
    if (n.nodeType === Node.TEXT_NODE) return !n.textContent.trim();
    if (n.nodeType === Node.ELEMENT_NODE) return n.tagName === 'BR';
    return true;
  });
}

async function replaceSelectedImage() {
  if (!state?.selectedImg) return;
  const img = state.selectedImg;
  try {
    const res = await window.electronAPI.invoke('select-image-files', { multi: false });
    if (!res?.ok || !res.files?.length) {
      if (res?.skipped?.length) alert('이미지를 읽지 못했습니다:\n' + res.skipped.join('\n'));
      return;
    }
    pushImageOp();
    const dataUrl = res.files[0].dataUrl;
    const oldSrc = img.getAttribute('src') || '';
    img.setAttribute('src', dataUrl);
    img.setAttribute('data-bgpt-user-image', '1');
    ['width', 'height', 'srcset', 'data-original-width', 'data-original-height'].forEach((attr) => img.removeAttribute(attr));
    const anchor = img.closest('a');
    if (anchor && (anchor.getAttribute('href') === oldSrc || isOnlyMeaningfulChild(anchor, img))) {
      anchor.setAttribute('href', dataUrl);
    }
    hideOverlays();
    state.setStatus('이미지를 교체했습니다. 저장 시 자동 업로드됩니다.');
  } catch (err) {
    console.error('[EDITOR-IMG] 교체 실패:', err);
    alert('이미지 교체 실패: ' + (err?.message || err));
  }
}

// ─────────────────────────────────────────────
// 삽입 (hover 마커 + 커서 위치)
// ─────────────────────────────────────────────

function getArticleContainer(doc) {
  return doc.querySelector('div.max-mode-article') || doc.body;
}

function findDirectBlock(el, container) {
  let node = el;
  while (node && node.parentElement && node.parentElement !== container) {
    node = node.parentElement;
  }
  return node && node.parentElement === container ? node : null;
}

function onDocMouseOver(e) {
  if (!state) return;
  if (e.target?.tagName === 'IMG') return; // 이미지 위에서는 선택 툴바 우선
  const container = getArticleContainer(state.doc);
  let block = findDirectBlock(e.target, container);
  if (!block && container !== state.doc.body) block = findDirectBlock(e.target, state.doc.body);
  if (!block || block.tagName === 'STYLE') { return; }

  state.hoverBlock = block;
  const rect = block.getBoundingClientRect();
  const marker = state.insertMarker;
  marker.style.display = 'block';
  marker.style.top = `${rect.bottom - 14}px`;
  marker.style.left = `${rect.left + rect.width / 2}px`;
}

async function insertAtHoverBlock() {
  if (!state?.hoverBlock) return;
  const block = state.hoverBlock;
  await pickAndInsertImages((html) => block.insertAdjacentHTML('afterend', html));
}

export async function insertImagesAtCaret(doc) {
  if (!state) return;
  const container = getArticleContainer(doc);
  const selection = doc.getSelection();
  let block = null;
  if (selection?.anchorNode) {
    const el = selection.anchorNode.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection.anchorNode.parentElement;
    block = findDirectBlock(el, container) || (container !== doc.body ? findDirectBlock(el, doc.body) : null);
  }
  await pickAndInsertImages((html) => {
    if (block) block.insertAdjacentHTML('afterend', html);
    else container.insertAdjacentHTML('beforeend', html);
  });
}

async function pickAndInsertImages(insertFn) {
  try {
    const res = await window.electronAPI.invoke('select-image-files', { multi: true });
    if (!res?.ok || !res.files?.length) {
      if (res?.skipped?.length) alert('일부 이미지를 읽지 못했습니다:\n' + res.skipped.join('\n'));
      return;
    }
    pushImageOp();
    const html = res.files.map((f) => makeImageBlockHtml(f.dataUrl)).join('\n');
    insertFn(html);
    hideOverlays();
    if (res.skipped?.length) alert('일부 이미지는 제외되었습니다:\n' + res.skipped.join('\n'));
    state.setStatus(`이미지 ${res.files.length}장을 삽입했습니다. 저장 시 자동 업로드됩니다.`);
  } catch (err) {
    console.error('[EDITOR-IMG] 삽입 실패:', err);
    alert('이미지 삽입 실패: ' + (err?.message || err));
  }
}

// ─────────────────────────────────────────────
// 이미지 작업 undo (contenteditable 네이티브 undo와 별도)
// ─────────────────────────────────────────────

function pushImageOp() {
  if (!state) return;
  state.opStack.push(state.doc.body.innerHTML);
  if (state.opStack.length > 20) state.opStack.shift();
}

export function hasImageOps() {
  return Boolean(state?.opStack.length);
}

export function undoImageOp(doc) {
  if (!state?.opStack.length) return;
  const snapshot = state.opStack.pop();
  doc.body.innerHTML = snapshot;
  hideOverlays();
  state.onAfterRestore?.();
}

// ─────────────────────────────────────────────
// 저장 시 일괄 호스팅: dataURL → 영구 URL
// ─────────────────────────────────────────────

export async function hostPendingImages(doc, setStatus) {
  const pending = Array.from(doc.querySelectorAll('img[data-bgpt-user-image]'))
    .filter((img) => (img.getAttribute('src') || '').startsWith('data:'));
  if (!pending.length) return { total: 0, failed: 0 };

  let failed = 0;
  for (let i = 0; i < pending.length; i++) {
    const img = pending[i];
    setStatus(`이미지 업로드 중 (${i + 1}/${pending.length})…`);
    try {
      const oldSrc = img.getAttribute('src');
      const res = await window.electronAPI.invoke('host-user-image', { dataUrl: oldSrc, label: 'editor' });
      if (res?.ok && res.url) {
        img.setAttribute('src', res.url);
        img.removeAttribute('data-bgpt-user-image');
        const anchor = img.closest('a');
        if (anchor && anchor.getAttribute('href') === oldSrc) anchor.setAttribute('href', res.url);
      } else {
        failed++;
      }
    } catch (err) {
      console.warn('[EDITOR-IMG] 호스팅 실패:', err);
      failed++;
    }
  }
  setStatus(failed ? `이미지 업로드 완료 (실패 ${failed}장)` : '이미지 업로드 완료');
  return { total: pending.length, failed };
}
