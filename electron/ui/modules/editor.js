// ✏️ 비주얼 글 편집기 — HTML 코드를 보지 않고 실제 렌더 화면에서 글/이미지 수정
// 소스: appstate(생성 직후) / republish(재발행 대기열) / file(외부 HTML/TXT)
//       + 생성된 글목록 탭의 발행된 글(blogger / wordpress / tistory) 수정발행
import { getAppState, addLog, getTextLength } from './core.js';
import { initImageEditing, detachImageEditing, hostPendingImages, undoImageOp, hasImageOps, insertImagesAtCaret, insertHtmlAtCaret } from './editor-images.js';
import { loadAdUnits, makeAdSlotHtml, expandAdSlots, collapseAdBlocks, AD_SLOT_STYLE } from './ad-slots.js';

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

  /**
   * 💰 v3.8.482 — 광고 자리를 실제 코드로 바꾼다.
   *   **반드시 위 script 제거 뒤에** 한다. 애드센스 코드는 `<script>` 둘로 이뤄져
   *   있어서, 먼저 넣으면 바로 위 줄이 지워버린다. 편집기 안에서 자리표시자로
   *   두는 이유가 이것이다.
   */
  const expanded = expandAdSlots(body.innerHTML);
  if (expanded.missing > 0) {
    console.warn(`[EDITOR-AD] 등록이 삭제된 광고 자리 ${expanded.missing}개를 제거했습니다.`);
  }
  const bodyHtml = expanded.html;

  if (session.isFullDocument) {
    return '<!doctype html>\n<html><head>' + session.originalHeadHtml + '</head><body>' + bodyHtml + '</body></html>';
  }
  const stylePart = session.styles.length ? session.styles.join('\n') + '\n' : '';
  return stylePart + bodyHtml;
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
      <!-- 💰 v3.8.482: 수동 광고 자리. 자동 광고는 위치를 못 고르므로 직접 찍는다. -->
      <select id="veAdUnitSelect" style="${BTN_BASE}background:#0f172a;color:#e2e8f0;border:1px solid #475569;max-width:170px;" title="넣을 광고 단위를 고르세요"></select>
      <button id="veInsertAdBtn" style="${BTN_BASE}background:#7c3aed;color:#ede9fe;" title="현재 커서 위치에 광고 자리를 넣습니다 (발행 시 실제 광고 코드로 바뀝니다)">💰 광고</button>
      <button id="veUndoImageOpBtn" style="${BTN_BASE}background:#334155;color:#e2e8f0;" title="이미지/링크 삭제·교체·삽입 작업을 한 단계 되돌립니다 (글자 수정은 Ctrl+Z)">↩️ 이미지·링크 취소</button>
      <button id="veRevertBtn" style="${BTN_BASE}background:#334155;color:#fbbf24;" title="모든 편집을 버리고 처음 상태로 되돌립니다">🔄 원본으로</button>
      <button id="veCopyHtmlBtn" style="${BTN_BASE}background:#334155;color:#93c5fd;" title="편집된 HTML을 클립보드로 복사합니다">📋 HTML 복사</button>
      <button id="veSaveAsBtn" style="display:none;${BTN_BASE}background:#334155;color:#e2e8f0;">💾 다른 이름으로</button>
      <button id="veSaveBtn" style="${BTN_BASE}background:linear-gradient(135deg,#10b981,#059669);color:#fff;box-shadow:0 2px 8px rgba(16,185,129,0.4);">✅ 저장</button>
      <button id="veCancelBtn" style="${BTN_BASE}background:transparent;color:#94a3b8;border:1px solid #475569;">✕ 닫기</button>
      <!-- ✍️ v3.8.440: 서식 도구.
           사용자 요구: "링크삽입하는게 없고 글자크기나 하이라이트 그리고 박스추가 등등
             기능이 많이 빠져있어 추가해줘"
           본문에서 글자를 드래그해 고른 뒤 누르면 적용된다. -->
      <div id="veFormatBar" style="width:100%;display:flex;align-items:center;gap:6px;flex-wrap:wrap;background:#0f172a;border:1px solid #334155;border-radius:9px;padding:8px 10px;">
        <span style="color:#64748b;font-size:11px;font-weight:700;margin-right:2px;">선택한 글자에 적용 →</span>
        <button data-vefmt="bold" style="${BTN_BASE}background:#334155;color:#e2e8f0;font-weight:900;" title="굵게">B</button>
        <button data-vefmt="italic" style="${BTN_BASE}background:#334155;color:#e2e8f0;font-style:italic;" title="기울임">I</button>
        <button data-vefmt="underline" style="${BTN_BASE}background:#334155;color:#e2e8f0;text-decoration:underline;" title="밑줄">U</button>
        <span style="width:1px;height:18px;background:#334155;"></span>
        <button data-vefmt="size-up" style="${BTN_BASE}background:#334155;color:#e2e8f0;" title="글자 크게">🔠 크게</button>
        <button data-vefmt="size-down" style="${BTN_BASE}background:#334155;color:#e2e8f0;" title="글자 작게">🔡 작게</button>
        <span style="width:1px;height:18px;background:#334155;"></span>
        <button data-vefmt="hl-yellow" style="${BTN_BASE}background:#fde68a;color:#78350f;font-weight:800;" title="노랑 형광펜">형광</button>
        <button data-vefmt="hl-pink" style="${BTN_BASE}background:#fbcfe8;color:#831843;font-weight:800;" title="분홍 형광펜">형광</button>
        <button data-vefmt="color-red" style="${BTN_BASE}background:#334155;color:#f87171;font-weight:800;" title="빨간 글자">가</button>
        <button data-vefmt="clear" style="${BTN_BASE}background:#334155;color:#94a3b8;" title="서식 지우기">✕ 서식</button>
        <span style="width:1px;height:18px;background:#334155;"></span>
        <button data-vefmt="link" style="${BTN_BASE}background:#1d4ed8;color:#dbeafe;font-weight:800;" title="선택한 글자에 링크 걸기">🔗 링크</button>
        <button data-vefmt="unlink" style="${BTN_BASE}background:#334155;color:#e2e8f0;" title="링크 해제">🔗✕</button>
        <span style="width:1px;height:18px;background:#334155;"></span>
        <button data-vefmt="box-gray" style="${BTN_BASE}background:#334155;color:#e2e8f0;" title="회색 박스로 감싸기">▢ 박스</button>
        <button data-vefmt="box-tip" style="${BTN_BASE}background:#0e7490;color:#cffafe;" title="파란 정보 박스">💡 팁</button>
        <button data-vefmt="box-warn" style="${BTN_BASE}background:#b45309;color:#fef3c7;" title="주황 주의 박스">⚠️ 주의</button>
        <button data-vefmt="quote" style="${BTN_BASE}background:#334155;color:#e2e8f0;" title="인용문">❝ 인용</button>
        <span style="width:1px;height:18px;background:#334155;"></span>
        <button data-vefmt="ul" style="${BTN_BASE}background:#334155;color:#e2e8f0;" title="글머리 목록">• 목록</button>
        <button data-vefmt="ol" style="${BTN_BASE}background:#334155;color:#e2e8f0;" title="번호 목록">1. 목록</button>
        <button data-vefmt="hr" style="${BTN_BASE}background:#334155;color:#e2e8f0;" title="구분선">─ 구분선</button>
      </div>
      <div id="veHintBar" style="width:100%;display:flex;gap:6px 18px;flex-wrap:wrap;background:#0f172a;border:1px solid #334155;border-radius:9px;padding:8px 14px;color:#cbd5e1;font-size:12px;line-height:1.5;">
        <span>✍️ <b style="color:#f1f5f9;">글자</b> 클릭 → 바로 수정 (Ctrl+Z 되돌리기)</span>
        <span>🖼️ <b style="color:#f1f5f9;">이미지</b> 클릭 → 교체·삭제</span>
        <span>🔗 <b style="color:#f1f5f9;">버튼·링크</b> 클릭 → 주소 수정·삭제</span>
        <span>➕ <b style="color:#f1f5f9;">이미지 추가</b> → 문단에 마우스 올리면 ＋ 버튼</span>
        <span>✍️ <b style="color:#f1f5f9;">서식</b> → 글자를 드래그해 고른 뒤 위 도구 클릭</span>
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
  /**
   * 🖼️ v3.8.482 — 이미지가 커서 위치가 아니라 **글 끝에 붙던** 문제.
   *
   * 사용자 보고: "이미지 여전히 맨아래에 삽입되는데?? 커서위치가아니고?"
   *
   * v3.8.440 이 mousedown+preventDefault 로 선택 유실을 막았는데, 그 가드가
   * **서식 바(#veFormatBar)에만** 걸려 있었다. 이미지 삽입 버튼은 위쪽
   * 툴바(#veToolbar)에 있어서 가드 밖이었다 — 누르는 순간 iframe 안 선택이
   * 풀리고, 기억해 둔 위치(lastCaretBlock)마저 없으면 글 끝으로 갔다.
   *
   * 같은 줄의 다른 버튼(제목 입력·저장·닫기)은 기본 동작이 필요하므로
   * **삽입 계열 버튼에만** 건다.
   */
  const toolbar = modalRefs.overlay.querySelector('#veToolbar');
  if (toolbar) {
    toolbar.addEventListener('mousedown', (e) => {
      if (e.target?.closest?.('#veInsertImageBtn, #veInsertAdBtn')) e.preventDefault();
    });
  }

  /**
   * 💰 v3.8.482 — 커서 위치에 광고 자리를 넣는다.
   *   편집기에는 회색 박스만 두고, 발행 직전(serializeEditor)에 실제 코드로 바꾼다.
   *   serializeEditor 가 script 를 전부 지우기 때문에 원문을 그대로 두면 사라진다.
   */
  const adSelect = modalRefs.overlay.querySelector('#veAdUnitSelect');
  const adBtn = modalRefs.overlay.querySelector('#veInsertAdBtn');
  refreshAdUnitOptions(adSelect);
  if (adBtn) {
    adBtn.addEventListener('click', () => {
      const doc = getFrameDoc();
      if (!doc) return;
      const units = loadAdUnits();
      if (units.length === 0) {
        setStatus('등록된 광고가 없습니다 — 설정에서 애드센스 광고 코드를 먼저 등록하세요.');
        return;
      }
      const unit = units.find((u) => u.id === adSelect?.value) || units[0];
      const atCaret = insertHtmlAtCaret(doc, makeAdSlotHtml(unit));

      /**
       * v3.8.489 - 넣은 자리로 스크롤한다.
       *
       * 사장님 보고: "광고를 커서위치에 넣었다고하는데 ... 여기서 코드가 못보여주니??"
       * 넣기는 제대로 넣었는데 글 중간이면 화면 밖이라 안 보였다.
       * 방금 넣은 것만 bgpt-ad-slot-new 로 표시되므로 그것을 찾아 보여준다.
       */
      try {
        const fresh = doc.querySelectorAll('.bgpt-ad-slot-new');
        const target = fresh[fresh.length - 1];
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // 강조 표시는 한 번만 — 다음에 넣을 때 이전 것이 같이 깜빡이면 헷갈린다
          setTimeout(() => {
            fresh.forEach((el) => el.classList.remove('bgpt-ad-slot-new'));
          }, 2600);
        }
      } catch { /* 스크롤 실패가 삽입을 되돌릴 이유는 없다 */ }

      setStatus(atCaret
        ? `광고 자리(${unit.name})를 커서 위치에 넣었습니다. 발행하면 실제 광고가 들어갑니다.`
        : `광고 자리(${unit.name})를 글 끝에 넣었습니다(커서 위치를 찾지 못했습니다).`);
    });
  }
  modalRefs.insertImageBtn.addEventListener('click', () => {
    const doc = getFrameDoc();
    if (doc) insertImagesAtCaret(doc);
  });

  /**
   * ✍️ v3.8.440 — 서식 도구 배선.
   *
   * 사용자 요구: "링크삽입하는게 없고 글자크기나 하이라이트 그리고 박스추가 등등
   *   기능이 많이 빠져있어 추가해줘"
   *
   * ⚠️ mousedown 에서 preventDefault 하는 게 핵심이다. 버튼이 iframe 밖에 있어서
   *   그냥 클릭하면 **누르는 순간 본문 선택이 풀린다**(이미지 삽입이 글 끝에 붙던
   *   것과 같은 원인). 기본 동작을 막으면 선택이 유지된 채로 서식이 적용된다.
   */
  const formatBar = modalRefs.overlay.querySelector('#veFormatBar');
  if (formatBar) {
    formatBar.addEventListener('mousedown', (e) => {
      if (e.target?.closest?.('[data-vefmt]')) e.preventDefault();
    });
    formatBar.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('[data-vefmt]');
      if (!btn) return;
      const doc = getFrameDoc();
      if (!doc) return;
      applyFormat(doc, btn.getAttribute('data-vefmt'));
    });
  }
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

/**
 * ✍️ v3.8.440 — 선택한 글자에 서식을 적용한다.
 *
 * 발행 대상이 블로그스팟·워드프레스·티스토리라 **인라인 스타일**로만 넣는다.
 * 외부 CSS 는 플랫폼 스킨이 덮어쓰거나 아예 안 실린다(이 저장소가 본문 스타일을
 * 전부 인라인으로 박는 이유와 같다).
 */
function applyFormat(doc, kind) {
  const sel = doc.getSelection();
  const hasText = sel && !sel.isCollapsed && String(sel.toString() || '').trim().length > 0;

  /** 고른 글자를 태그로 감싼다 */
  const wrap = (openTag, closeTag) => {
    if (!hasText) { setStatus('먼저 본문에서 적용할 글자를 드래그해 선택하세요.'); return false; }
    const range = sel.getRangeAt(0);
    const html = doc.createElement('div');
    html.appendChild(range.cloneContents());
    range.deleteContents();
    const frag = doc.createRange().createContextualFragment(`${openTag}${html.innerHTML}${closeTag}`);
    range.insertNode(frag);
    sel.removeAllRanges();
    return true;
  };

  /** 문단 전체를 박스로 감싼다 (선택이 없으면 커서가 있는 문단) */
  const wrapBlock = (style) => {
    if (!sel || !sel.anchorNode) { setStatus('본문에서 감쌀 위치를 먼저 클릭하세요.'); return false; }
    const el = sel.anchorNode.nodeType === Node.ELEMENT_NODE ? sel.anchorNode : sel.anchorNode.parentElement;
    const block = el?.closest?.('p,h1,h2,h3,h4,li,blockquote,div');
    if (!block) { setStatus('감쌀 문단을 찾지 못했습니다.'); return false; }
    /**
     * 본문 전체를 통째로 감싸는 사고를 막는다.
     * 커서가 큰 래퍼 <div> 안에 있으면 closest 가 그 래퍼를 잡는다. 그대로 감싸면
     * 글 전체가 박스 하나에 들어가고, 되돌리기도 번거롭다.
     * 문단 하나라고 보기 어려운 것(본문 루트이거나 안에 H2 를 품은 것)은 거른다.
     */
    if (block === doc.body || block.parentNode === null
      || block.querySelector('h2') || block.querySelector('figure.section-image')) {
      setStatus('문단 안쪽을 클릭한 뒤 다시 눌러주세요. (글 전체가 감싸지는 걸 막았습니다)');
      return false;
    }
    const box = doc.createElement('div');
    box.setAttribute('style', style);
    block.parentNode.insertBefore(box, block);
    box.appendChild(block);
    return true;
  };

  try {
    switch (kind) {
      case 'bold': return void (wrap('<strong>', '</strong>') && setStatus('굵게 적용'));
      case 'italic': return void (wrap('<em>', '</em>') && setStatus('기울임 적용'));
      case 'underline': return void (wrap('<u>', '</u>') && setStatus('밑줄 적용'));
      case 'size-up': return void (wrap('<span style="font-size:1.25em;">', '</span>') && setStatus('글자 크게'));
      case 'size-down': return void (wrap('<span style="font-size:0.85em;">', '</span>') && setStatus('글자 작게'));
      case 'hl-yellow': return void (wrap('<mark style="background:#fde68a;padding:1px 3px;border-radius:3px;">', '</mark>') && setStatus('형광펜(노랑) 적용'));
      case 'hl-pink': return void (wrap('<mark style="background:#fbcfe8;padding:1px 3px;border-radius:3px;">', '</mark>') && setStatus('형광펜(분홍) 적용'));
      case 'color-red': return void (wrap('<span style="color:#dc2626;font-weight:700;">', '</span>') && setStatus('빨간 글자 적용'));
      case 'quote':
        return void (wrapBlock('border-left:5px solid #94a3b8;background:#f8fafc;padding:12px 18px;margin:18px 0;color:#334155;')
          && setStatus('인용문으로 감쌌습니다'));
      case 'box-gray':
        return void (wrapBlock('border:3px solid #cbd5e1;background:#f8fafc;border-radius:12px;padding:16px 18px;margin:18px 0;')
          && setStatus('박스로 감쌌습니다'));
      case 'box-tip':
        return void (wrapBlock('border:3px solid #67e8f9;background:#ecfeff;border-radius:12px;padding:16px 18px;margin:18px 0;')
          && setStatus('팁 박스로 감쌌습니다'));
      case 'box-warn':
        return void (wrapBlock('border:3px solid #fcd34d;background:#fffbeb;border-radius:12px;padding:16px 18px;margin:18px 0;')
          && setStatus('주의 박스로 감쌌습니다'));
      case 'clear': {
        if (!hasText) { setStatus('서식을 지울 글자를 먼저 선택하세요.'); return; }
        const range = sel.getRangeAt(0);
        const plain = String(sel.toString() || '');
        range.deleteContents();
        range.insertNode(doc.createTextNode(plain));
        sel.removeAllRanges();
        setStatus('서식을 지웠습니다');
        return;
      }
      case 'link': {
        if (!hasText) { setStatus('링크를 걸 글자를 먼저 선택하세요.'); return; }
        const url = String(window.prompt('연결할 주소를 입력하세요 (https:// 로 시작)', 'https://') || '').trim();
        if (!url) return;
        if (!/^https?:\/\//i.test(url)) { setStatus('주소는 http:// 또는 https:// 로 시작해야 합니다.'); return; }
        const safe = url.replace(/"/g, '&quot;');
        // 외부 링크는 rel 을 붙인다 — 제휴 링크일 수 있으므로 sponsored 도 함께
        wrap(`<a href="${safe}" target="_blank" rel="sponsored nofollow noopener">`, '</a>');
        setStatus('링크를 걸었습니다');
        return;
      }
      case 'unlink': {
        if (!sel?.anchorNode) { setStatus('해제할 링크를 클릭하세요.'); return; }
        const el = sel.anchorNode.nodeType === Node.ELEMENT_NODE ? sel.anchorNode : sel.anchorNode.parentElement;
        const a = el?.closest?.('a');
        if (!a) { setStatus('선택한 곳에 링크가 없습니다.'); return; }
        a.replaceWith(...a.childNodes);
        setStatus('링크를 해제했습니다');
        return;
      }
      case 'ul':
      case 'ol': {
        if (!hasText) { setStatus('목록으로 만들 줄을 선택하세요.'); return; }
        // 선택한 텍스트를 줄 단위로 끊어 각각 <li> 로 만든다 (줄바꿈이 없으면 1줄짜리 목록)
        const tag = kind === 'ul' ? 'ul' : 'ol';
        const lines = String(sel.toString() || '')
          .split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
        if (lines.length === 0) { setStatus('목록으로 만들 내용이 없습니다.'); return; }
        const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const items = lines.map((s) => `<li style="margin:4px 0;">${esc(s)}</li>`).join('');
        const range3 = sel.getRangeAt(0);
        range3.deleteContents();
        range3.insertNode(doc.createRange().createContextualFragment(
          `<${tag} style="margin:14px 0;padding-left:24px;">${items}</${tag}>`,
        ));
        sel.removeAllRanges();
        setStatus(`${kind === 'ul' ? '글머리' : '번호'} 목록으로 만들었습니다 (${lines.length}줄)`);
        return;
      }
      case 'hr': {
        if (!sel?.anchorNode) { setStatus('구분선을 넣을 위치를 클릭하세요.'); return; }
        const el = sel.anchorNode.nodeType === Node.ELEMENT_NODE ? sel.anchorNode : sel.anchorNode.parentElement;
        const block = el?.closest?.('p,h1,h2,h3,h4,li,blockquote,div');
        const hr = doc.createElement('hr');
        hr.setAttribute('style', 'border:0;border-top:2px solid #e2e8f0;margin:28px 0;');
        if (block) block.insertAdjacentElement('afterend', hr);
        setStatus('구분선을 넣었습니다');
        return;
      }
      default: return;
    }
  } catch (err) {
    console.error('[EDITOR-FMT] 적용 실패:', err);
    setStatus('서식 적용 실패: ' + (err?.message || err));
  }
}

/**
 * 💰 v3.8.482 — 등록된 광고 단위를 드롭다운에 채운다.
 *   편집기를 열 때마다 다시 읽는다 — 설정에서 방금 추가한 광고가 바로 보여야 한다.
 */
function refreshAdUnitOptions(select) {
  if (!select) return;
  const units = loadAdUnits();
  const previous = select.value;
  select.innerHTML = units.length
    ? units.map((u) => `<option value="${u.id}">${u.name}</option>`).join('')
    : '<option value="">등록된 광고 없음</option>';
  if (previous && units.some((u) => u.id === previous)) select.value = previous;
  select.disabled = units.length === 0;
}

function protectSeparators(doc) {
  // 썸네일 separator는 타이핑/백스페이스로 파손되지 않게 보호 (이미지 툴바로만 관리)
  doc.querySelectorAll('div.separator').forEach((el) => el.setAttribute('contenteditable', 'false'));
}

function loadIntoFrame(rawBodyHtml) {
  const refs = ensureEditorModal();
  detachImageEditing();
  /**
   * 💰 v3.8.482 — 저장된 글에 이미 들어 있는 광고 코드는 **자리표시자로 되돌려** 연다.
   *   안 하면 편집기에 스크립트 원문이 깔려서 "블로그에 보이는 실제 모습"이 깨지고,
   *   저장할 때 script 제거에 걸려 광고가 통째로 사라진다.
   */
  const bodyHtml = collapseAdBlocks(rawBodyHtml);
  refreshAdUnitOptions(refs.overlay.querySelector('#veAdUnitSelect'));
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
      ${AD_SLOT_STYLE}
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
    // v3.8.357: 반자동 발행 모드에서는 저장 + 즉시 발행
    const isSemiAuto = kind === 'appstate' && !!window.__semiAutoMode;
    refs.saveBtn.textContent = isSemiAuto ? '🚀 저장하고 발행'
      : kind === 'appstate' ? '✅ 적용 (발행 시 반영)'
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
      // v3.8.357: 반자동 발행 모드 — 저장 후 즉시 발행
      if (window.__semiAutoMode && typeof window.publishToPlatform === 'function') {
        addLog('🚀 반자동 발행: 편집 내용 적용 완료 → 발행 시작', 'success');
        hideModalAfterSave();
        try {
          await window.publishToPlatform();
        } finally {
          window.__semiAutoMode = false;
        }
        return;
      }
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
