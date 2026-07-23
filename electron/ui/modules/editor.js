// ✏️ 비주얼 글 편집기 — HTML 코드를 보지 않고 실제 렌더 화면에서 글/이미지 수정
// 소스: appstate(생성 직후) / republish(재발행 대기열) / file(외부 HTML/TXT)
//       + 생성된 글목록 탭의 발행된 글(blogger / wordpress / tistory) 수정발행
import { getAppState, addLog, getTextLength } from './core.js';
import { initImageEditing, detachImageEditing, hostPendingImages, undoImageOp, hasImageOps, insertImagesAtCaret } from './editor-images.js';

// 생성된 글목록 탭에서 넘어온 "이미 발행된 글" 소스 — 저장 = 해당 플랫폼에 수정발행
const PUBLISHED_POST_SOURCES = {
  blogger: { label: '블로그스팟', updateChannel: 'blogger-update-post' },
  wordpress: { label: '워드프레스', updateChannel: 'wordpress-update-post' },
  tistory: { label: '티스토리', updateChannel: 'tistory-update-post' },
};

function getPublishedSource(kind) {
  return PUBLISHED_POST_SOURCES[kind] || null;
}

let session = null;
let modalRefs = null;

// ─────────────────────────────────────────────
// HTML 분해/조립
// ─────────────────────────────────────────────

function splitDocument(html) {
  const raw = String(html || '');
  const isFullDocument = /<html[\s>]/i.test(raw) || /<head[\s>]/i.test(raw);
  if (isFullDocument) {
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    return {
      isFullDocument: true,
      headHtml: doc.head ? doc.head.innerHTML : '',
      styles: [],
      bodyHtml: doc.body ? doc.body.innerHTML : raw,
    };
  }
  const styles = [];
  const bodyHtml = raw.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, (match) => {
    styles.push(match);
    return '';
  });
  return { isFullDocument: false, headHtml: '', styles, bodyHtml };
}

function getFrameDoc() {
  return modalRefs?.frame?.contentDocument || null;
}

// 편집기 아티팩트를 제거한 최종 HTML 생성
export function serializeEditor() {
  const doc = getFrameDoc();
  if (!doc || !session) return '';
  const body = doc.body.cloneNode(true);

  body.removeAttribute('contenteditable');
  body.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));
  body.querySelectorAll('.ve-img-selected, .ve-link-selected').forEach((el) => {
    el.classList.remove('ve-img-selected', 've-link-selected');
    if (!el.getAttribute('class')) el.removeAttribute('class');
  });
  body.querySelectorAll('[data-bgpt-editor], [data-bgpt-editor-ui]').forEach((el) => el.remove());
  body.querySelectorAll('script').forEach((el) => el.remove());

  if (session.isFullDocument) {
    return '<!doctype html>\n<html><head>' + session.originalHeadHtml + '</head><body>' + body.innerHTML + '</body></html>';
  }
  const stylePart = session.styles.length ? session.styles.join('\n') + '\n' : '';
  return stylePart + body.innerHTML;
}

function computeThumbnailUrl() {
  const doc = getFrameDoc();
  if (!doc) return '';
  const sepImg = doc.querySelector('div.separator img');
  return sepImg ? (sepImg.getAttribute('src') || '') : '';
}

// ─────────────────────────────────────────────
// 모달 DOM
// ─────────────────────────────────────────────

const BTN_BASE = 'padding:9px 14px;border:none;border-radius:9px;font-weight:700;cursor:pointer;font-size:13px;white-space:nowrap;';

function ensureEditorModal() {
  if (modalRefs) return modalRefs;

  const overlay = document.createElement('div');
  overlay.id = 'visualEditorOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#0f172a;display:none;flex-direction:column;';
  overlay.innerHTML = `
    <div id="veToolbar" style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:#1e293b;border-bottom:1px solid #334155;flex-wrap:wrap;">
      <span style="font-size:18px;">✏️</span>
      <input id="veTitleInput" type="text" placeholder="제목" style="flex:1;min-width:180px;padding:9px 12px;border:1px solid #475569;border-radius:9px;background:#0f172a;color:#f1f5f9;font-size:14px;font-weight:600;" />
      <label id="veHostImagesLabel" style="display:none;align-items:center;gap:5px;color:#cbd5e1;font-size:12px;cursor:pointer;">
        <input id="veHostImagesChk" type="checkbox" checked /> 저장 시 이미지 업로드
      </label>
      <button id="veInsertImageBtn" style="${BTN_BASE}background:#334155;color:#e2e8f0;" title="현재 커서 위치(또는 글 끝)에 내 PC 이미지를 삽입합니다">🖼️ 이미지 삽입</button>
      <button id="veUndoImageOpBtn" style="${BTN_BASE}background:#334155;color:#e2e8f0;" title="이미지/링크 삭제·교체·삽입 작업을 한 단계 되돌립니다 (글자 수정은 Ctrl+Z)">↩️ 이미지·링크 취소</button>
      <button id="veRevertBtn" style="${BTN_BASE}background:#334155;color:#fbbf24;" title="모든 편집을 버리고 처음 상태로 되돌립니다">🔄 원본으로</button>
      <button id="veCopyHtmlBtn" style="${BTN_BASE}background:#334155;color:#93c5fd;" title="편집된 HTML을 클립보드로 복사합니다">📋 HTML 복사</button>
      <button id="veSaveAsBtn" style="display:none;${BTN_BASE}background:#334155;color:#e2e8f0;">💾 다른 이름으로</button>
      <button id="veSaveBtn" style="${BTN_BASE}background:linear-gradient(135deg,#10b981,#059669);color:#fff;box-shadow:0 2px 8px rgba(16,185,129,0.4);">✅ 저장</button>
      <button id="veCancelBtn" style="${BTN_BASE}background:transparent;color:#94a3b8;border:1px solid #475569;">✕ 닫기</button>
      <div id="veHintBar" style="width:100%;display:flex;gap:6px 18px;flex-wrap:wrap;background:#0f172a;border:1px solid #334155;border-radius:9px;padding:8px 14px;color:#cbd5e1;font-size:12px;line-height:1.5;">
        <span>✍️ <b style="color:#f1f5f9;">글자</b> 클릭 → 바로 수정 (Ctrl+Z 되돌리기)</span>
        <span>🖼️ <b style="color:#f1f5f9;">이미지</b> 클릭 → 교체·삭제</span>
        <span>🔗 <b style="color:#f1f5f9;">버튼·링크</b> 클릭 → 주소 수정·삭제</span>
        <span>➕ <b style="color:#f1f5f9;">이미지 추가</b> → 문단에 마우스 올리면 ＋ 버튼</span>
      </div>
      <span id="veStatus" style="width:100%;color:#94a3b8;font-size:12px;min-height:14px;"></span>
    </div>
    <div id="veBody" style="flex:1;position:relative;overflow:hidden;">
      <iframe id="veFrame" sandbox="allow-same-origin" style="width:100%;height:100%;border:0;background:#fff;display:block;"></iframe>
    </div>
  `;
  document.body.appendChild(overlay);

  modalRefs = {
    overlay,
    toolbar: overlay.querySelector('#veToolbar'),
    body: overlay.querySelector('#veBody'),
    frame: overlay.querySelector('#veFrame'),
    titleInput: overlay.querySelector('#veTitleInput'),
    hostImagesLabel: overlay.querySelector('#veHostImagesLabel'),
    hostImagesChk: overlay.querySelector('#veHostImagesChk'),
    insertImageBtn: overlay.querySelector('#veInsertImageBtn'),
    undoImageOpBtn: overlay.querySelector('#veUndoImageOpBtn'),
    revertBtn: overlay.querySelector('#veRevertBtn'),
    copyHtmlBtn: overlay.querySelector('#veCopyHtmlBtn'),
    saveAsBtn: overlay.querySelector('#veSaveAsBtn'),
    saveBtn: overlay.querySelector('#veSaveBtn'),
    cancelBtn: overlay.querySelector('#veCancelBtn'),
    status: overlay.querySelector('#veStatus'),
  };

  modalRefs.cancelBtn.addEventListener('click', () => requestClose());
  modalRefs.revertBtn.addEventListener('click', () => {
    if (!session) return;
    if (!confirm('모든 편집을 취소하고 원본으로 되돌릴까요?')) return;
    const parts = splitDocument(session.originalHtml);
    session.styles = parts.styles;
    session.isFullDocument = parts.isFullDocument;
    session.originalHeadHtml = parts.headHtml;
    loadIntoFrame(parts.bodyHtml);
    modalRefs.titleInput.value = session.originalTitle || '';
    setStatus('원본으로 되돌렸습니다.');
  });
  modalRefs.copyHtmlBtn.addEventListener('click', async () => {
    try {
      const doc = getFrameDoc();
      const pending = doc ? doc.querySelectorAll('img[data-bgpt-user-image][src^="data:"]').length : 0;
      if (pending > 0 && !confirm(`아직 업로드되지 않은 내 PC 이미지 ${pending}장이 base64로 포함됩니다. 그대로 복사할까요?`)) return;
      await navigator.clipboard.writeText(serializeEditor());
      setStatus('📋 HTML이 복사되었습니다 — Blogger 글 수정 화면(HTML 보기)에 붙여넣으세요.');
    } catch (err) {
      setStatus('복사 실패: ' + (err?.message || err));
    }
  });
  modalRefs.insertImageBtn.addEventListener('click', () => {
    const doc = getFrameDoc();
    if (doc) insertImagesAtCaret(doc);
  });
  modalRefs.undoImageOpBtn.addEventListener('click', () => {
    const doc = getFrameDoc();
    if (!doc) return;
    if (!hasImageOps()) { setStatus('되돌릴 이미지·링크 작업이 없습니다.'); return; }
    undoImageOp(doc);
    protectSeparators(doc);
    setStatus('이미지·링크 작업을 한 단계 되돌렸습니다.');
  });
  modalRefs.saveBtn.addEventListener('click', () => saveCurrentSession(false));
  modalRefs.saveAsBtn.addEventListener('click', () => saveCurrentSession(true));

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalRefs.overlay.style.display !== 'none') requestClose();
  });

  return modalRefs;
}

function setStatus(text) {
  if (modalRefs?.status) modalRefs.status.textContent = text || '';
}

function protectSeparators(doc) {
  // 썸네일 separator는 타이핑/백스페이스로 파손되지 않게 보호 (이미지 툴바로만 관리)
  doc.querySelectorAll('div.separator').forEach((el) => el.setAttribute('contenteditable', 'false'));
}

function loadIntoFrame(bodyHtml) {
  const refs = ensureEditorModal();
  detachImageEditing();
  const doc = refs.frame.contentDocument;
  const needsFallbackStyle = !session.styles.length && !session.isFullDocument;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8">
    ${session.isFullDocument ? session.originalHeadHtml : session.styles.join('\n')}
    <style data-bgpt-editor="1">
      body{margin:0;padding:28px 24px;background:#fff;min-height:100vh;box-sizing:border-box;}
      img{cursor:pointer;}
      .ve-img-selected{outline:3px solid #6366f1!important;outline-offset:2px;}
      .ve-link-selected{outline:2px dashed #f59e0b!important;outline-offset:3px;}
      ${needsFallbackStyle ? "body{font-family:'Noto Sans KR','Malgun Gothic',sans-serif;max-width:860px;margin:0 auto;line-height:1.8;color:#1f2937;} body img{max-width:100%;height:auto;}" : ''}
    </style>
  </head><body></body></html>`);
  doc.close();
  doc.body.innerHTML = bodyHtml;
  doc.body.contentEditable = 'true';
  try { doc.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* 일부 환경 미지원 */ }
  protectSeparators(doc);
  doc.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') requestClose();
  });
  initImageEditing(refs.frame, doc, { setStatus, onAfterRestore: () => protectSeparators(doc) });
  session.baseline = serializeEditor();
  try { doc.body.focus(); } catch { /* noop */ }
}

function isDirty() {
  if (!session) return false;
  const titleChanged = (modalRefs.titleInput.value.trim() !== (session.originalTitle || '').trim())
    && modalRefs.titleInput.style.display !== 'none';
  return titleChanged || serializeEditor() !== session.baseline;
}

function requestClose() {
  if (!session) { hideModal(); return; }
  if (isDirty() && !confirm('저장하지 않은 편집 내용이 있습니다. 닫을까요?')) return;
  hideModal();
}

function hideModal() {
  detachImageEditing();
  if (modalRefs) {
    modalRefs.overlay.style.display = 'none';
    const doc = getFrameDoc();
    if (doc) { try { doc.open(); doc.write('<!doctype html><html><body></body></html>'); doc.close(); } catch { /* noop */ } }
  }
  session = null;
}

// ─────────────────────────────────────────────
// 세션 열기
// ─────────────────────────────────────────────

export async function openVisualEditor(source) {
  const kind = source?.kind;
  try {
    let title = '';
    let html = '';
    let filePath = null;
    let itemId = null;
    let postId = null;
    let postUrl = null;

    if (kind === 'appstate') {
      const appState = getAppState();
      if (appState.isRunning) {
        alert('작업이 실행 중입니다. 완료 후 편집해주세요.');
        return;
      }
      const gen = appState.generatedContent || {};
      if (!String(gen.content || '').trim()) {
        alert('편집할 생성된 글이 없습니다. 먼저 글을 생성해주세요.');
        return;
      }
      title = gen.title || '';
      html = gen.content;
    } else if (kind === 'republish') {
      itemId = source.itemId;
      const queue = JSON.parse(localStorage.getItem('pendingRepublishQueue') || '[]');
      const item = queue.find((x) => x.id === itemId);
      if (!item) {
        alert('대기열 항목을 찾을 수 없습니다.');
        return;
      }
      title = item.title || item.keyword || '';
      html = item.html || '';
    } else if (kind === 'file') {
      const res = await window.electronAPI.invoke('open-html-file', { filePath: source.filePath || undefined });
      if (!res?.ok) {
        if (!res?.canceled) alert('파일 열기 실패: ' + (res?.error || '알 수 없는 오류'));
        return;
      }
      filePath = res.filePath;
      html = res.content;
      title = '';
    } else if (getPublishedSource(kind)) {
      // 생성된 글목록 탭: 발행된 글을 불러와 수정 후 해당 플랫폼에 업데이트(수정발행)
      postId = source.postId;
      postUrl = source.postUrl || '';
      title = source.title || '';
      html = source.html || '';
      if (!postId || !String(html).trim()) {
        alert('글 내용을 불러오지 못했습니다. 목록을 새로고침 후 다시 시도해주세요.');
        return;
      }
    } else {
      console.warn('[EDITOR] 알 수 없는 편집 소스:', source);
      return;
    }

    const parts = splitDocument(html);
    session = {
      kind,
      originalHtml: html,
      originalTitle: title,
      filePath,
      itemId,
      postId,
      postUrl,
      isFullDocument: parts.isFullDocument,
      originalHeadHtml: parts.headHtml,
      styles: parts.styles,
      baseline: '',
    };

    const refs = ensureEditorModal();
    refs.titleInput.value = title;
    refs.titleInput.style.display = kind === 'file' ? 'none' : '';
    refs.hostImagesLabel.style.display = kind === 'file' ? 'inline-flex' : 'none';
    refs.saveAsBtn.style.display = kind === 'file' ? '' : 'none';
    refs.saveBtn.textContent = kind === 'appstate' ? '✅ 적용 (발행 시 반영)'
      : kind === 'republish' ? '✅ 대기열에 저장'
      : getPublishedSource(kind) ? '🚀 수정발행하기'
      : '✅ 파일에 저장';
    setStatus(kind === 'file' ? `편집 중: ${filePath}` : '아래 화면은 블로그에 보이는 실제 모습입니다. 고치고 싶은 곳을 클릭하세요.');
    refs.overlay.style.display = 'flex';
    loadIntoFrame(parts.bodyHtml);
  } catch (err) {
    console.error('[EDITOR] 편집기 열기 실패:', err);
    alert('편집기를 열지 못했습니다: ' + (err?.message || err));
  }
}

// ─────────────────────────────────────────────
// 저장
// ─────────────────────────────────────────────

async function saveCurrentSession(saveAs) {
  if (!session) return;
  const refs = modalRefs;
  const doc = getFrameDoc();
  if (!doc) return;

  refs.saveBtn.disabled = true;
  refs.saveAsBtn.disabled = true;
  try {
    const shouldHost = session.kind !== 'file' || refs.hostImagesChk.checked;
    if (shouldHost) {
      const result = await hostPendingImages(doc, setStatus);
      if (result.failed > 0) {
        const proceed = confirm(`이미지 ${result.failed}장 업로드에 실패했습니다.\n그대로 저장하면 발행 시 자동 업로드를 다시 시도합니다. 계속할까요?`);
        if (!proceed) { setStatus('저장이 취소되었습니다.'); return; }
      }
    }

    const html = serializeEditor();
    if (getTextLength(html) < 100 && !confirm('본문이 거의 비어 있습니다. 그래도 저장할까요?')) {
      setStatus('저장이 취소되었습니다.');
      return;
    }
    const title = refs.titleInput.value.trim() || session.originalTitle || '';

    if (session.kind === 'appstate') {
      const appState = getAppState();
      const newThumbnailUrl = computeThumbnailUrl();
      appState.generatedContent = {
        ...appState.generatedContent,
        title,
        content: html,
        thumbnailUrl: newThumbnailUrl,
        thumbnail: newThumbnailUrl,
      };
      try {
        localStorage.setItem('lastGeneratedContent', html);
        localStorage.setItem('lastGeneratedTitle', title);
      } catch { /* 저장 실패해도 발행에는 지장 없음 */ }
      addLog('✏️ 편집 내용이 적용되었습니다. 발행 시 편집본이 반영됩니다.', 'success');
      window.veRefreshEntryButton?.();
      hideModalAfterSave();
    } else if (session.kind === 'republish') {
      const queue = JSON.parse(localStorage.getItem('pendingRepublishQueue') || '[]');
      const item = queue.find((x) => x.id === session.itemId);
      if (!item) {
        alert('대기열 항목이 삭제되어 저장할 수 없습니다.');
        return;
      }
      item.html = html;
      item.title = title;
      item.thumbnailUrl = computeThumbnailUrl();
      item.editedAt = new Date().toISOString();
      localStorage.setItem('pendingRepublishQueue', JSON.stringify(queue));
      window.renderRepublishQueueBanner?.();
      addLog('✏️ 대기열 항목이 수정되었습니다. 재발행 시 편집본이 발행됩니다.', 'success');
      hideModalAfterSave();
    } else if (getPublishedSource(session.kind)) {
      const published = getPublishedSource(session.kind);
      const slowNotice = session.kind === 'tistory'
        ? '\n\n티스토리는 브라우저로 편집기를 조작하므로 1분 정도 걸릴 수 있습니다.'
        : '';
      if (!confirm(`편집한 내용으로 ${published.label} 글을 수정발행할까요?\n블로그에 올라간 글이 즉시 바뀝니다.${slowNotice}`)) {
        setStatus('수정발행이 취소되었습니다.');
        return;
      }
      setStatus(`🚀 ${published.label} 수정발행 중…`);
      const res = await window.electronAPI.invoke(published.updateChannel, {
        postId: session.postId,
        title,
        content: html,
        // 티스토리는 블로그 주소(화면 설정)가 있어야 편집기 URL을 만들 수 있다 — 목록 조회와 같은 소스를 쓴다
        payload: await window.__buildPublishedPlatformPayload?.(session.kind),
      });
      if (res?.ok) {
        addLog(`🚀 ${published.label} 수정발행 완료: ${res.url || title}`, 'success');
        window.__refreshPublishedPosts?.();
        alert(`✅ 수정발행 완료!\n${res.url || ''}`);
        hideModalAfterSave();
      } else {
        alert(`❌ ${published.label} 수정발행 실패\n\n` + (res?.error || '알 수 없는 오류'));
        setStatus('수정발행에 실패했습니다.');
      }
    } else if (session.kind === 'file') {
      const res = await window.electronAPI.invoke('save-html-file', {
        filePath: saveAs ? undefined : (session.filePath || undefined),
        content: html,
        defaultName: session.filePath ? undefined : '편집한-글.html',
      });
      if (res?.ok) {
        session.filePath = res.filePath;
        session.originalHtml = html;
        session.baseline = serializeEditor();
        setStatus(`💾 저장됨: ${res.filePath}`);
        addLog(`✏️ HTML 파일 저장 완료: ${res.filePath}`, 'success');
      } else if (!res?.canceled) {
        alert('파일 저장 실패: ' + (res?.error || '알 수 없는 오류'));
      }
    }
  } catch (err) {
    console.error('[EDITOR] 저장 실패:', err);
    alert('저장 중 오류가 발생했습니다: ' + (err?.message || err));
  } finally {
    refs.saveBtn.disabled = false;
    refs.saveAsBtn.disabled = false;
  }
}

function hideModalAfterSave() {
  // 저장 완료 → dirty 확인 없이 즉시 닫기
  const saved = session;
  session = null;
  hideModal();
  void saved;
}
