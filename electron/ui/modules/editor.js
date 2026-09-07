// ✏️ 비주얼 글 편집기 — HTML 코드를 보지 않고 실제 렌더 화면에서 글/이미지 수정
// 소스: appstate(생성 직후) / republish(재발행 대기열) / file(외부 HTML/TXT)
//       + 생성된 글목록 탭의 발행된 글(blogger / wordpress / tistory) 수정발행
import { getAppState, addLog, getTextLength } from './core.js';
import { initImageEditing, detachImageEditing, hostPendingImages, undoImageOp, hasImageOps, insertImagesAtCaret, insertHtmlAtCaret, findCaretBlock } from './editor-images.js';
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

/**
 * 🎯 v3.8.556 — 발행할 곳 드롭다운.
 *
 * 값은 발행 코드(publishGeneratedContent)가 읽는 키와 같아야 한다: blogspot/wordpress/tistory.
 * 글목록 탭의 kind 는 'blogger' 인데 발행 키는 'blogspot' 이라 여기서 한 번 번역한다 —
 * 이 번역이 빠지면 "알 수 없는 플랫폼: blogger" 로 떨어진다.
 */
const EDITOR_PLATFORMS = [
  { key: 'blogspot', label: '블로그스팟' },
  { key: 'wordpress', label: '워드프레스' },
  { key: 'tistory', label: '티스토리' },
];

function normalizeEditorPlatform(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'blogger' || raw === 'blogspot') return 'blogspot';
  if (raw === 'wordpress' || raw === 'wp') return 'wordpress';
  if (raw === 'tistory') return 'tistory';
  return 'blogspot';
}

function editorPlatformLabel(value) {
  const key = normalizeEditorPlatform(value);
  return EDITOR_PLATFORMS.find((p) => p.key === key)?.label || key;
}

/** 글목록 탭의 kind('blogger'…) → 발행 키('blogspot'…) */
function publishedKindToPlatform(kind) {
  return normalizeEditorPlatform(kind);
}

/** 지금 편집기에서 고른 발행 플랫폼 (드롭다운이 안 보이는 소스면 null) */
function selectedEditorPlatform() {
  if (!session?.platformPickable) return null;
  return normalizeEditorPlatform(modalRefs?.targetPlatform?.value || session.originalPlatform);
}

/**
 * 🔌 v3.8.684 — 발행 플랫폼 설정(티스토리 블로그 이름·워드프레스 계정)을 가져온다.
 * 배선 점검에서 찾은 구멍: `window.__buildPublishedPlatformPayload` 는 글목록 탭을 한 번 열어야 생긴다.
 * 붙여넣기·파일 글을 바로 발행하면 그 탭을 안 열었을 수 있으니, 없으면 모듈을 직접 불러 같은 함수를 쓴다.
 */
async function platformPayloadFor(target) {
  try {
    if (typeof window.__buildPublishedPlatformPayload === 'function') return (await window.__buildPublishedPlatformPayload(target)) || {};
    const mod = await import('./published-posts.js');
    return (await mod.buildPlatformPayload?.(target)) || {};
  } catch (err) {
    console.warn('[EDITOR] 플랫폼 설정을 못 읽었습니다:', err?.message || err);
    return {};
  }
}

/** 이미 발행된 글인데 다른 플랫폼을 골랐나 — 그렇다면 수정이 아니라 새 발행이다 */
function isCrossPlatformPublish() {
  if (!session || !getPublishedSource(session.kind)) return false;
  const picked = selectedEditorPlatform();
  return !!picked && picked !== normalizeEditorPlatform(session.originalPlatform);
}

/**
 * 저장 버튼 문구를 지금 상태에 맞춘다.
 *
 * 플랫폼을 바꾸는 순간 버튼이 "수정발행하기" → "워드프레스에 새 글 발행" 으로 바뀐다.
 * 누르기 전에 **업데이트가 아니라는 것**을 알 수 있어야 하기 때문이다.
 */
function refreshSaveButtonLabel(isSemiAuto = false) {
  if (!session || !modalRefs?.saveBtn) return;
  const kind = session.kind;
  const published = getPublishedSource(kind);
  modalRefs.saveBtn.textContent = isSemiAuto ? '🚀 저장하고 발행'
    : kind === 'appstate' ? '✅ 적용 (발행 시 반영)'
    : kind === 'republish' ? '✅ 대기열에 저장'
    : published ? (isCrossPlatformPublish()
      ? `🚀 ${editorPlatformLabel(selectedEditorPlatform())}에 새 글 발행`
      : '🚀 수정발행하기')
    // v3.8.683 — 파일·붙여넣기 글은 발행할 곳을 골라 새 글로 낸다. "파일에 저장" 은 '다른 이름으로' 버튼이 맡는다
    : (kind === 'file' || kind === 'paste') && selectedEditorPlatform()
      ? `🚀 ${editorPlatformLabel(selectedEditorPlatform())}에 새 글 발행`
    : '✅ 파일에 저장';
}

let session = null;
let modalRefs = null;
/**
 * v3.8.691 — 모달을 지을 때 채워 넣는다. **모듈 최상위에 두는 이유**는
 * 이미지 도구막대의 [🎨 다시 생성] 이 loadIntoFrame(최상위)에서 배선되기 때문이다.
 * 클로저 안에만 두면 그쪽에서 못 부른다 — 두 벌로 만들면 잠금·엔진 선택이 갈라진다.
 */
let draftButtons = () => [];
let lockDraftButtons = () => {};
let editorPayload = async () => ({});

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

/**
 * v3.8.490 — 도구 묶음 표시.
 * 사장님: "이 도구들을 정리좀해줘 내눈에는 너무 어수선해보이고 뭐가뭔지모르겠어"
 * 버튼 8개가 같은 크기·같은 색으로 한 줄에 늘어서 있어 무엇이 중요한지 안 보였다.
 * 작은 글씨 라벨과 세로 구분선으로 묶어 눈이 쉬어갈 곳을 만든다.
 */
const GROUP_LABEL = 'color:#64748b;font-size:11px;font-weight:700;letter-spacing:0.02em;';
const DIVIDER = 'width:1px;height:22px;background:#334155;margin:0 2px;';

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
      <!--
        v3.8.490 - 도구를 네 묶음으로 나눈다.
        사장님: "이 도구들을 정리좀해줘 내눈에는 너무 어수선해보이고 뭐가뭔지모르겠어"
        한 줄에 8개가 같은 크기·같은 색으로 늘어서 있어 무엇이 중요한지 안 보였다.
        [넣기] [되돌리기] [내보내기] [마무리] 로 묶고, 묶음 사이에 구분선을 둔다.
      -->
      <span style="${GROUP_LABEL}">넣기</span>
      <button id="veInsertImageBtn" class="ve-visual-only" style="${BTN_BASE}background:#334155;color:#e2e8f0;" title="커서 위치(또는 글 끝)에 내 PC 이미지를 넣습니다">🖼️ 이미지</button>
      <!-- 💰 v3.8.482: 수동 광고 자리. 자동 광고는 위치를 못 고르므로 직접 찍는다. -->
      <select id="veAdUnitSelect" class="ve-visual-only" style="${BTN_BASE}background:#0f172a;color:#e2e8f0;border:1px solid #475569;max-width:150px;" title="넣을 광고 단위를 고르세요"></select>
      <button id="veInsertAdBtn" class="ve-visual-only" style="${BTN_BASE}background:#7c3aed;color:#ede9fe;" title="커서 위치에 광고 자리를 넣습니다 (발행 시 실제 광고 코드로 바뀝니다)">💰 광고</button>
      <!-- 🔘 v3.8.570: 사장님 "미리보기 및 수정에 버튼생성이있으면 좋겠는데" -->
      <button id="veInsertCtaBtn" class="ve-visual-only" style="${BTN_BASE}background:#0ea5e9;color:#e0f2fe;" title="커서 위치에 CTA 버튼을 넣습니다 (주소를 넣으면 문구는 자동으로 채워집니다)">🔘 버튼</button>

      <span style="${DIVIDER}"></span>
      <span style="${GROUP_LABEL}">되돌리기</span>
      <button id="veUndoImageOpBtn" class="ve-visual-only" style="${BTN_BASE}background:#334155;color:#e2e8f0;" title="방금 한 이미지·링크·광고 작업을 한 단계 되돌립니다 (글자 수정은 Ctrl+Z)">↩️ 되돌리기</button>
      <button id="veRevertBtn" style="${BTN_BASE}background:#334155;color:#fbbf24;" title="편집을 모두 버리고 처음 상태로 돌아갑니다">🔄 처음으로</button>

      <span style="${DIVIDER}"></span>
      <!--
        </> v3.8.687 — HTML 코드 보기·편집.
        사장님: "혹시 HTML코드로는 못보니?? HTML코드를 수정해야하는경우 아무것도못하자나 표도 못넣고.."
        미리보기(iframe)와 같은 자리에 코드 칸을 바꿔 끼운다. 코드를 고친 뒤 [미리보기로] 를 누르거나
        그대로 [저장] 하면 프레임에 반영된다. 코드 모드에서는 프레임에만 먹는 도구(서식·이미지·비평)를 잠근다.
      -->
      <button id="veSourceBtn" class="ve-source-toggle" style="${BTN_BASE}background:#0f172a;color:#93c5fd;border:1px solid #475569;" title="HTML 코드를 직접 보고 고칩니다 (표·특수 태그). 다시 누르면 미리보기로 돌아오며 고친 코드가 반영됩니다">&lt;/&gt; HTML 편집</button>
      <button id="veCopyHtmlBtn" style="${BTN_BASE}background:#334155;color:#93c5fd;" title="편집된 HTML을 클립보드로 복사합니다">📋 HTML</button>
      <button id="veSaveAsBtn" style="display:none;${BTN_BASE}background:#334155;color:#e2e8f0;">💾 다른 이름으로</button>

      <!--
        🎯 v3.8.556 — 발행할 곳을 여기서 바꾼다.
        사장님: "미리보기 수정버튼눌러서 가면 수정가능하자나 거기에서도 플랫폼변경할수있도록"
        대기열 글은 고른 플랫폼으로 저장되고, 이미 발행된 글은 **원본을 그대로 둔 채**
        고른 플랫폼에 새 글로 나간다(사장님 확정: 원본 유지).
      -->
      <span id="veTargetPlatformWrap" style="display:none;align-items:center;gap:6px;">
        <span style="${DIVIDER}"></span>
        <span style="${GROUP_LABEL}">발행할 곳</span>
        <select id="veTargetPlatform" style="${BTN_BASE}background:#0f172a;color:#e2e8f0;border:1px solid #475569;max-width:150px;" title="이 글을 어느 블로그에 올릴지 고릅니다"></select>
      </span>

      <!--
        🔄 v3.8.603 — 다시 만들기를 **여기에도** 둔다.
        사장님: "다시 글 생성하는 건 왜 미리보기·수정에 안 뜨나요?"
        맞는 지적이다. 글이 깨진 것은 미리보기에서 보게 되는데, 고치려면 창을 닫고
        목록으로 돌아가야 했다. 이미 발행된 글일 때만 보인다(대기열·파일에는 postId 가 없다).
      -->
      <span id="veRegenWrap" class="ve-visual-only" style="display:none;align-items:center;gap:6px;">
        <span style="${DIVIDER}"></span>
        <button id="veRegenBtn" style="${BTN_BASE}background:#134e4a;color:#a7f3d0;border:1px solid #115e59;" title="같은 주소 그대로 본문만 새로 만들어 덮어씁니다">🔄 글 다시 생성</button>
        <button id="veRegenImgBtn" style="${BTN_BASE}background:#3f3016;color:#fcd34d;border:1px solid #57411f;" title="글자는 그대로 두고 이 글의 AI 이미지를 모두 다시 만듭니다 (한 장만 바꾸려면 본문에서 그 이미지를 클릭하세요)">🖼️ 이미지 다시 생성</button>
      </span>

      <!-- ✏️ v3.8.683 — 어디서 온 글이든(붙여넣기·파일·발행글) 비평→수정, 썸네일, 영역 이미지 -->
      <span id="veDraftWrap" class="ve-visual-only" style="display:inline-flex;align-items:center;gap:6px;">
        <span style="${DIVIDER}"></span>
        <button id="veCritiqueBtn" style="${BTN_BASE}background:#3b0764;color:#e9d5ff;border:1px solid #6b21a8;" title="지금 편집기의 글을 비평합니다. 항목을 고르고 '수정하기'를 누르면 그 구간만 고쳐 편집기에 다시 싣습니다 (발행은 저장 버튼)">🩺 비평·개선</button>
        <button id="veThumbBtn" style="${BTN_BASE}background:#3f3016;color:#fcd34d;border:1px solid #57411f;" title="제목으로 썸네일 이미지를 만들어 글 맨 위에 넣습니다">🖼️ 썸네일 생성</button>
        <button id="veSectionImgBtn" style="${BTN_BASE}background:#3f3016;color:#fcd34d;border:1px solid #57411f;" title="커서가 있는 소제목 영역에 맞는 이미지를 만들어 그 자리에 넣습니다 (본문을 먼저 클릭해 영역을 고르세요)">🖼️ 이 영역 이미지</button>
        <!--
          🔗 v3.8.688 — 사장님: "글 다시 생성이랑 이미지 다시 생성 옆에 CTA 다시 생성을 추가해"
          발행글 전용인 veRegenWrap 이 아니라 여기 둔다 — 붙여넣기·대기열 글에도 버튼은 필요하다.
        -->
        <button id="veRegenCtaBtn" style="${BTN_BASE}background:#075985;color:#bae6fd;border:1px solid #0369a1;" title="글을 다시 읽고 CTA 버튼의 목적지를 새로 찾습니다. 못 찾으면 지금 버튼을 그대로 둡니다">🔗 CTA 다시 생성</button>
      </span>

      <!--
        🧠 v3.8.691 — 엔진을 **여기서** 고른다.
        사장님: "이미지생성이되면 여기에서 AI엔진을 글/이미지 엔진을 선택 가능하게 해줘야지"
        선택지는 본 화면의 셀렉트에서 복제한다 — 목록을 두 벌로 적으면 갈라진다.
        비워 두면 본 화면에서 고른 값을 그대로 쓴다(예전과 같은 동작).
      -->
      <span id="veEngineWrap" class="ve-visual-only" style="display:inline-flex;align-items:center;gap:6px;">
        <span style="${DIVIDER}"></span>
        <span style="${GROUP_LABEL}">엔진</span>
        <select id="veTextEngine" style="${BTN_BASE}background:#0f172a;color:#e2e8f0;border:1px solid #475569;max-width:150px;" title="이 편집기에서 글을 만들 때 쓸 AI (비평·개선, CTA 문구)"></select>
        <select id="veImageEngine" style="${BTN_BASE}background:#0f172a;color:#e2e8f0;border:1px solid #475569;max-width:210px;" title="이 편집기에서 이미지를 만들 때 쓸 엔진 (썸네일, 영역 이미지, 이미지별 다시 생성)"></select>
      </span>

      <span style="${DIVIDER}"></span>
      <button id="veSaveBtn" style="${BTN_BASE}background:linear-gradient(135deg,#10b981,#059669);color:#fff;box-shadow:0 2px 8px rgba(16,185,129,0.4);font-weight:800;">✅ 저장</button>
      <button id="veCancelBtn" style="${BTN_BASE}background:transparent;color:#94a3b8;border:1px solid #475569;">✕ 닫기</button>
      <!-- ✍️ v3.8.440: 서식 도구.
           사용자 요구: "링크삽입하는게 없고 글자크기나 하이라이트 그리고 박스추가 등등
             기능이 많이 빠져있어 추가해줘"
           본문에서 글자를 드래그해 고른 뒤 누르면 적용된다. -->
      <div id="veFormatBar" class="ve-visual-only" style="width:100%;display:flex;align-items:center;gap:6px;flex-wrap:wrap;background:#0f172a;border:1px solid #334155;border-radius:9px;padding:8px 10px;">
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
        <!-- 📊 v3.8.687: 사장님 "표도 못넣고" — 커서가 있는 문단 아래에 표를 넣는다. 칸은 본문처럼 바로 클릭해 고친다. -->
        <button data-vefmt="table" style="${BTN_BASE}background:#1e3a5f;color:#bfdbfe;" title="커서가 있는 문단 아래에 표를 넣습니다 (행x열을 물어봅니다 · 첫 줄은 머리글)">📊 표</button>
      </div>
      <div id="veHintBar" style="width:100%;display:flex;gap:6px 18px;flex-wrap:wrap;background:#0f172a;border:1px solid #334155;border-radius:9px;padding:8px 14px;color:#cbd5e1;font-size:12px;line-height:1.5;">
        <span>✍️ <b style="color:#f1f5f9;">글자</b> 클릭 → 바로 수정 (Ctrl+Z 되돌리기)</span>
        <span>🖼️ <b style="color:#f1f5f9;">이미지</b> 클릭 → 교체·삭제</span>
        <span>🔗 <b style="color:#f1f5f9;">버튼·링크</b> 클릭 → 주소 수정·삭제</span>
        <span>➕ <b style="color:#f1f5f9;">이미지 추가</b> → 문단에 마우스 올리면 ＋ 버튼</span>
        <span>✍️ <b style="color:#f1f5f9;">서식</b> → 글자를 드래그해 고른 뒤 위 도구 클릭</span>
        <span>&lt;/&gt; <b style="color:#f1f5f9;">HTML 편집</b> → 코드로 직접 고치기 (표·특수 태그) · 📊 표 버튼으로 표 넣기</span>
      </div>
      <span id="veStatus" style="width:100%;color:#94a3b8;font-size:12px;min-height:14px;"></span>
    </div>
    <div id="veBody" style="flex:1;position:relative;overflow:hidden;">
      <iframe id="veFrame" sandbox="allow-same-origin" style="width:100%;height:100%;border:0;background:#fff;display:block;"></iframe>
      <!-- </> v3.8.687: 코드 편집 칸 — 미리보기와 같은 자리를 번갈아 쓴다 -->
      <textarea id="veSourceArea" spellcheck="false" wrap="off" placeholder="HTML 코드"
        style="display:none;width:100%;height:100%;border:0;box-sizing:border-box;padding:18px 20px;background:#0b1220;color:#e2e8f0;font-family:Consolas,'Cascadia Mono','D2Coding',monospace;font-size:13px;line-height:1.55;resize:none;outline:none;overflow:auto;tab-size:2;"></textarea>
    </div>
    <style data-bgpt-editor-ui="1">
      /* 코드 모드에서는 프레임에만 먹는 도구를 잠근다 — 눌러도 아무 일이 없으면 고장으로 보인다 */
      #visualEditorOverlay.ve-source .ve-visual-only { opacity:.35; pointer-events:none; }
      #visualEditorOverlay.ve-source .ve-source-toggle { background:#1d4ed8 !important; color:#dbeafe !important; }
    </style>
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
    sourceBtn: overlay.querySelector('#veSourceBtn'),           // v3.8.687
    sourceArea: overlay.querySelector('#veSourceArea'),
    saveAsBtn: overlay.querySelector('#veSaveAsBtn'),
    targetPlatformWrap: overlay.querySelector('#veTargetPlatformWrap'),
    targetPlatform: overlay.querySelector('#veTargetPlatform'),
    regenWrap: overlay.querySelector('#veRegenWrap'),          // v3.8.603
    regenBtn: overlay.querySelector('#veRegenBtn'),
    regenImgBtn: overlay.querySelector('#veRegenImgBtn'),
    draftWrap: overlay.querySelector('#veDraftWrap'),           // v3.8.683
    critiqueBtn: overlay.querySelector('#veCritiqueBtn'),
    thumbBtn: overlay.querySelector('#veThumbBtn'),
    sectionImgBtn: overlay.querySelector('#veSectionImgBtn'),
    regenCtaBtn: overlay.querySelector('#veRegenCtaBtn'),       // v3.8.688
    textEngine: overlay.querySelector('#veTextEngine'),          // v3.8.691
    imageEngine: overlay.querySelector('#veImageEngine'),        // v3.8.691
    saveBtn: overlay.querySelector('#veSaveBtn'),
    cancelBtn: overlay.querySelector('#veCancelBtn'),
    status: overlay.querySelector('#veStatus'),
  };

  modalRefs.cancelBtn.addEventListener('click', () => requestClose());

  /**
   * 🔄 v3.8.603 — 편집기에서 바로 다시 만든다.
   *
   * 사장님: "다시 글 생성하는 건 왜 미리보기·수정에 안 뜨나요?"
   * 목록 카드와 **같은 채널**을 부른다 — 두 벌로 만들면 한쪽만 고쳐지고 어긋난다.
   * 끝나면 새 본문을 편집기에 다시 실어 준다. 창을 닫았다 열 필요가 없다.
   */
  async function runEditorRegenerate(mode) {
    if (!session || !session.postId) return;
    const what = mode === 'images'
      ? '글자는 그대로 두고 AI 이미지만 다시 만듭니다.'
      : '본문을 통째로 새로 만들어 덮어씁니다. 지금 본문은 사라집니다.';
    if (!confirm(`${what}\n\n· 주소(URL)와 제목은 그대로라 검색 색인이 유지됩니다.\n· 새로 만든 것이 지금보다 나쁘면 덮지 않고 멈춥니다.\n· 편집 중이던 내용은 저장되지 않습니다.`)) return;

    const buttons = [modalRefs.regenBtn, modalRefs.regenImgBtn].filter(Boolean);
    buttons.forEach((b) => { b.disabled = true; b.style.opacity = '0.5'; });
    setStatus(mode === 'images' ? '🖼️ 이미지를 다시 만드는 중… (몇 분 걸립니다)' : '🔄 본문을 다시 만드는 중… (몇 분 걸립니다)');

    try {
      const res = await window.electronAPI.invoke('regenerate-published-post', {
        platform: normalizeEditorPlatform(session.originalPlatform),
        postId: session.postId,
        title: modalRefs.titleInput.value || session.originalTitle || '',
        mode,
      });
      if (!res?.ok) throw new Error(res?.error || '알 수 없는 오류');

      // 갈아끼운 본문을 편집기에 다시 싣는다 — 눈으로 바로 확인하시라고
      if (res.html) {
        const parts = splitDocument(res.html);
        session.styles = parts.styles;
        session.isFullDocument = parts.isFullDocument;
        session.originalHeadHtml = parts.headHtml;
        session.originalHtml = res.html;
        loadIntoFrame(parts.bodyHtml);
      }
      setStatus(`✅ 다시 만들어 같은 주소에 반영했습니다 (${res.length}자). 새로고침하면 목록에도 반영됩니다.`);
    } catch (err) {
      setStatus(`❌ 다시 생성 실패: ${err?.message || err}`);
      window.notifyUser?.(`다시 생성하지 못했습니다.
${err?.message || err}
기존 글은 그대로 있습니다.`, 'error');
    } finally {
      buttons.forEach((b) => { b.disabled = false; b.style.opacity = '1'; });
    }
  }
  modalRefs.regenBtn?.addEventListener('click', () => runEditorRegenerate('article'));
  modalRefs.regenImgBtn?.addEventListener('click', () => runEditorRegenerate('images'));

  /**
   * ✏️ v3.8.683 — 편집기 안의 글을 그대로 비평하고, 고른 지적만 고쳐서 편집기에 다시 싣는다. 발행은 저장 버튼이 한다.
   * 사장님: "비평 개선 버튼 구현해서 누르면 비평할 부분 알려주고 수정하기 버튼 누르면 알아서 그 위치가 수정 개선되게."
   * postId 가 없어도 된다 — 붙여넣기·파일 글도 같은 버튼이다. 발행된 글은 postId 로 비평 이력을 남기는 기존 경로가 따로 있다.
   */
  draftButtons = () => [modalRefs.critiqueBtn, modalRefs.thumbBtn, modalRefs.sectionImgBtn, modalRefs.regenCtaBtn].filter(Boolean);
  lockDraftButtons = (locked) => draftButtons().forEach((b) => { b.disabled = locked; b.style.opacity = locked ? '0.5' : '1'; });
  editorPayload = async () => {
    const target = selectedEditorPlatform() || normalizeEditorPlatform(session?.originalPlatform);
    const base = await platformPayloadFor(target);
    /**
     * 🧠 v3.8.691 — 편집기에서 고른 엔진을 실어 보낸다.
     * 비워 두면(=본 화면 값 그대로) 아무것도 덮지 않는다 — 예전 동작이 유지된다.
     */
    const textEngine = modalRefs.textEngine?.value || '';
    const imageEngine = modalRefs.imageEngine?.value || '';
    return {
      ...base,
      platform: target, targetPlatform: target, blogPlatform: target,
      ...(textEngine ? { generationEngine: textEngine, provider: textEngine } : {}),
      ...(imageEngine ? { h2ImageSource: imageEngine, imageSource: imageEngine } : {}),
    };
  };
  modalRefs.critiqueBtn?.addEventListener('click', async () => {
    if (!session) return;
    const title = modalRefs.titleInput.value.trim() || session.originalTitle || '';
    lockDraftButtons(true);
    setStatus('🩺 편집기의 글을 읽고 비평하는 중… (1~2분)');
    try {
      const payload = await editorPayload();
      const critique = await window.electronAPI.invoke('critique-editor-html', { title, html: serializeEditor(), payload });
      if (!critique?.ok) throw new Error(critique?.error || '알 수 없는 오류');
      setStatus(`🩺 비평 완료 — ${critique.summary}`);
      const { showCritiqueModal } = await import('./post-critique-modal.js');
      showCritiqueModal(critique, async (issues) => {
        setStatus(`✍️ 고른 ${issues.length}건을 반영해 고쳐 쓰는 중… (몇 분 걸립니다)`);
        const res = await window.electronAPI.invoke('improve-editor-html', { title, html: serializeEditor(), issues, payload });
        if (!res?.ok) throw new Error(res?.error || '알 수 없는 오류');
        if (res.html && res.revised > 0) {
          const parts = splitDocument(res.html);
          loadIntoFrame(parts.bodyHtml);
          setStatus(`✅ ${res.revised}개 구간을 고쳐 편집기에 실었습니다 (${res.length}자). 확인 뒤 저장 버튼으로 발행하세요.`);
        } else {
          setStatus('ℹ️ 고친 구간이 없습니다 — 다시 쓴 결과가 원본보다 낫지 않아 그대로 뒀습니다.');
        }
        return { ...res, url: '' };
      }, () => modalRefs.critiqueBtn.click());
    } catch (err) {
      setStatus(`❌ 비평 실패: ${err?.message || err}`);
      window.notifyUser?.(`비평하지 못했습니다.\n${err?.message || err}\n글은 그대로 있습니다.`, 'error');
    } finally {
      lockDraftButtons(false);
    }
  });

  /**
   * 🔗 v3.8.688 — 글을 다시 읽고 CTA 목적지를 새로 찾는다.
   *
   * 사장님: "글 다시 생성이랑 이미지 다시 생성 옆에 CTA 다시 생성을 추가해"
   *
   * 계기가 된 실측 사고: 하지정맥류 실손 입원 거절 글의 버튼이 "금융감독원에서 신청하기"인데
   * 주소는 민원 **조회** 인증 화면(민원접수번호·가상키패드)이었다. 본문은 멀쩡했으므로
   * 글을 통째로 다시 만들 이유가 없다 — 버튼만 다시 정한다.
   *
   * ⚠️ 못 찾으면 **기존 버튼을 그대로 둔다.** 틀린 버튼보다 나쁜 건 버튼이 사라지는 것이다.
   */
  modalRefs.regenCtaBtn?.addEventListener('click', async () => {
    if (!session) return;
    const doc = getFrameDoc();
    if (!doc) return;
    const title = modalRefs.titleInput.value.trim() || session.originalTitle || '';

    // 지금 글에 있는 CTA — 같은 곳을 다시 고르면 "다시 생성"이 아니다
    const existing = [...doc.querySelectorAll('.cta-box, .cta-responsive-box')];
    const currentUrls = existing
      .map((el) => el.querySelector('a')?.getAttribute('href') || '')
      .filter(Boolean);

    lockDraftButtons(true);
    setStatus(existing.length
      ? '🔗 글을 다시 읽고 CTA 목적지를 찾는 중… (30초~1분)'
      : '🔗 이 글에 맞는 CTA 목적지를 찾는 중… (30초~1분)');

    try {
      const res = await window.electronAPI.invoke('cta-regenerate', { title, html: serializeEditor(), currentUrls });
      if (!res?.ok) {
        // 실패는 조용히 넘기지 않는다 — 왜 못 찾았는지 그대로 보여 준다
        setStatus(`ℹ️ 새 CTA 를 찾지 못했습니다 — ${res?.error || '알 수 없는 이유'} (기존 버튼은 그대로 둡니다)`);
        return;
      }

      const wrap = doc.createElement('div');
      wrap.innerHTML = res.html;
      const block = wrap.firstElementChild;
      if (!block) throw new Error('CTA 블록을 만들지 못했습니다.');

      if (existing.length) {
        // 첫 CTA 를 갈아끼우고 나머지는 그대로 둔다 (창구 버튼 묶음을 지우지 않기 위해)
        existing[0].replaceWith(block);
      } else {
        // 버튼이 없던 글이면 커서 자리에, 커서가 없으면 글 끝에
        const atCaret = insertHtmlAtCaret(doc, res.html);
        if (!atCaret) doc.body.appendChild(block);
      }

      const target = doc.querySelector(`a[href="${res.url}"]`)?.closest('.cta-box') || block;
      try { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch { /* 스크롤 실패가 교체를 되돌릴 이유는 없다 */ }

      const where = res.stage === 'action' ? '그 일을 하는 화면' : '제도 안내 화면';
      setStatus(`✅ CTA 를 바꿨습니다 — ${res.buttonText} (${where}, ${res.score}점). 확인 뒤 저장 버튼을 누르세요.`);
    } catch (err) {
      setStatus(`❌ CTA 다시 생성 실패: ${err?.message || err}`);
      window.notifyUser?.(`CTA 를 다시 만들지 못했습니다.\n${err?.message || err}\n기존 버튼은 그대로 있습니다.`, 'error');
    } finally {
      lockDraftButtons(false);
    }
  });

  /** 커서가 있는 소제목 영역 — 커서 블록에서 위로 올라가 첫 h2 를 찾는다 */
  function sectionTitleAtCaret(doc) {
    let block = findCaretBlock(doc);
    let hops = 0;
    while (block && hops < 200) {
      if (/^H2$/i.test(block.tagName)) return { h2: block, title: (block.textContent || '').trim() };
      block = block.previousElementSibling || block.parentElement;
      hops += 1;
    }
    return null;
  }

  async function generateEditorImage(kind) {
    if (!session) return;
    const doc = getFrameDoc();
    if (!doc) return;
    const title = modalRefs.titleInput.value.trim() || session.originalTitle || '';
    if (!title) { setStatus('제목 칸을 먼저 채워 주세요 — 이미지 프롬프트는 제목으로 만듭니다.'); return; }
    let sectionTitle = '';
    let anchor = null;
    let placedAtCaret = false;
    if (kind === 'section') {
      const found = sectionTitleAtCaret(doc);
      if (!found) { setStatus('본문에서 이미지를 넣을 소제목 영역을 먼저 클릭해 주세요.'); return; }
      sectionTitle = found.title;
      anchor = found.h2;
    }
    lockDraftButtons(true);
    setStatus(kind === 'section' ? `🖼️ "${sectionTitle.slice(0, 24)}" 영역 이미지를 만드는 중… (1~2분)` : '🖼️ 썸네일을 만드는 중… (1~2분)');
    try {
      const payload = await editorPayload();
      const res = await window.electronAPI.invoke('generate-editor-image', { title, sectionTitle, kind, payload });
      if (!res?.ok) throw new Error(res?.error || '알 수 없는 오류');
      const wrap = doc.createElement('div');
      wrap.innerHTML = res.html;
      const node = wrap.firstElementChild;
      if (kind === 'section') {
        /**
         * 🖼️ v3.8.691 — **커서 자리에** 넣는다.
         *
         * 사장님: "[이 영역 이미지]는 마우스커서 위치에 정확하게 이미지가 생성이 되어야 돼"
         *
         * 예전에는 `anchor.insertAdjacentElement('afterend')` 로 **소제목(H2) 바로 뒤**에
         * 꽂았다. 그래서 소제목 영역 한가운데를 클릭해도 이미지는 늘 그 영역 맨 위로 갔다.
         * 커서는 프롬프트를 지을 소제목을 고르는 데만 쓰이고, 넣는 자리는 무시된 것이다.
         *
         * 광고·CTA·내 PC 이미지가 쓰는 insertHtmlAtCaret 을 그대로 쓴다 —
         * 커서 → 마지막 커서 → 마우스가 지나간 블록 → 화면 한가운데 순으로 물러나므로
         * "넣고 보니 딴 데 있다"가 없다. 되돌리기 스택도 그쪽과 공유된다.
         */
        // 넣은 자리를 다시 찾으려고 표시를 달아 둔다 — 문자열로 넣으면 node 참조가 끊긴다
        placedAtCaret = insertHtmlAtCaret(doc, `<span class="bgpt-img-mark" hidden></span>${res.html}`);
        if (!placedAtCaret && anchor) anchor.insertAdjacentElement('afterend', node);
      } else {
        const container = doc.querySelector('.content, article, main, body') || doc.body;
        // 이미 썸네일(첫 separator 이미지)이 있으면 바꿔 끼운다
        const existing = doc.querySelector('div.separator img');
        if (existing && existing.closest('div.separator') && existing.closest('div.separator').parentElement === container) {
          existing.closest('div.separator').replaceWith(node);
        } else {
          container.insertBefore(node, container.firstChild);
        }
      }
      // 커서 삽입은 문자열로 들어갔으니 표시를 따라가 실물을 찾는다 (표시는 곧 지운다)
      let placed = node;
      if (kind === 'section') {
        const marks = doc.querySelectorAll('.bgpt-img-mark');
        const mark = marks[marks.length - 1];
        if (mark) {
          placed = mark.nextElementSibling || placed;
          mark.remove();
        }
      }
      try { placed?.scrollIntoView({ block: 'center' }); } catch { /* 스크롤 실패가 삽입을 되돌릴 이유는 없다 */ }
      setStatus(kind === 'section'
        ? (placedAtCaret
          ? `✅ "${sectionTitle.slice(0, 24)}" 이미지를 커서 위치에 넣었습니다.`
          : `✅ "${sectionTitle.slice(0, 24)}" 이미지를 소제목 아래에 넣었습니다(커서 위치를 찾지 못했습니다).`)
        : '✅ 썸네일을 글 맨 위에 넣었습니다 (저장 시 썸네일로 씁니다).');
    } catch (err) {
      setStatus(`❌ 이미지 생성 실패: ${err?.message || err}`);
    } finally {
      lockDraftButtons(false);
    }
  }

  modalRefs.thumbBtn?.addEventListener('click', () => generateEditorImage('thumbnail'));
  modalRefs.sectionImgBtn?.addEventListener('click', () => generateEditorImage('section'));

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
  modalRefs.sourceBtn.addEventListener('click', () => {
    if (!session) return;
    setSourceMode(!session.sourceMode);
  });
  modalRefs.copyHtmlBtn.addEventListener('click', async () => {
    try {
      applySourceToFrame();   // 코드 모드에서 고친 것도 복사에 들어가야 한다
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
      // v3.8.691 — 영역 이미지도 커서 자리에 넣으므로 같은 가드가 필요하다(안 걸면 선택이 풀린다)
      if (e.target?.closest?.('#veInsertImageBtn, #veInsertAdBtn, #veInsertCtaBtn, #veSectionImgBtn')) e.preventDefault();
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
   * 🔘 v3.8.570 — 커서 위치에 CTA 버튼을 넣는다.
   *
   * 사장님: "생성된 글목록에서 미리보기 및 수정에 버튼생성이있으면 좋겠는데"
   *
   * HTML 은 여기서 안 만든다. 발행 때 쓰는 renderFinalCtaBlock 을 IPC 로 부른다 —
   * UI 에 한 벌 더 적어 두면 생성된 버튼과 손으로 넣은 버튼이 서로 달라진다.
   */
  const ctaBtn = modalRefs.overlay.querySelector('#veInsertCtaBtn');
  if (ctaBtn) {
    ctaBtn.addEventListener('click', async () => {
      const doc = getFrameDoc();
      if (!doc) return;
      const picked = await askCtaDetails();
      if (!picked) return;
      const res = await window.electronAPI.invoke('cta-render-block', picked).catch((e) => ({ ok: false, error: e?.message }));
      if (!res?.ok) {
        setStatus(`❌ 버튼을 만들지 못했습니다: ${res?.error || '알 수 없는 오류'}`);
        return;
      }
      const atCaret = insertHtmlAtCaret(doc, `<div class="bgpt-cta-new">${res.html}</div>`);
      // 광고 넣기와 같은 이유 — 글 중간이면 화면 밖이라 넣고도 안 보인다
      try {
        const fresh = doc.querySelectorAll('.bgpt-cta-new');
        const target = fresh[fresh.length - 1];
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          // 감싼 div 는 표시용일 뿐이라 벗겨 낸다 — 발행 HTML 에 군더더기를 남기지 않는다
          fresh.forEach((el) => { el.replaceWith(...el.childNodes); });
        }, 2000);
      } catch { /* 스크롤 실패가 삽입을 되돌릴 이유는 없다 */ }
      setStatus(atCaret
        ? `버튼을 커서 위치에 넣었습니다 — ${res.buttonText}`
        : `버튼을 글 끝에 넣었습니다(커서 위치를 찾지 못했습니다) — ${res.buttonText}`);
    });
  }

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
  // 🎯 v3.8.556: 발행할 곳을 바꾸면 버튼 문구와 안내를 그 자리에서 바꾼다
  modalRefs.targetPlatform?.addEventListener('change', () => {
    if (!session) return;
    refreshSaveButtonLabel(session.kind === 'appstate' && !!window.__semiAutoMode);
    const picked = selectedEditorPlatform();
    if (isCrossPlatformPublish()) {
      setStatus(`발행할 곳: ${editorPlatformLabel(picked)} — 원래 ${editorPlatformLabel(session.originalPlatform)} 글은 그대로 두고 새 글로 올립니다.`);
    } else {
      setStatus(`발행할 곳: ${editorPlatformLabel(picked)}`);
    }
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
 * 🔘 v3.8.570 — 넣을 버튼의 주소와 문구를 묻는다.
 *
 * 주소를 넣으면 문구는 **자동으로 채워진다**(wetax.go.kr → "위택스 바로가기").
 * 문구를 직접 적으면 그게 이긴다 — 자동은 빈칸을 메우는 역할이다.
 *
 * 취소하면 null 을 돌려준다. prompt() 를 안 쓰는 이유는 세 칸을 한 번에 받아야 하고,
 * 주소를 넣는 즉시 제안 문구를 보여줘야 하기 때문이다.
 */
/**
 * ⌨️ v3.8.691 — 한 줄 입력을 받는다. **`window.prompt()` 대신 쓴다.**
 *
 * 사장님: "표 버튼 클릭해도 아무반응이없는데..??"
 *
 * 원인은 표 코드가 아니라 `window.prompt()` 였다 — **Electron 은 prompt() 를 지원하지 않는다**
 * (alert·confirm 은 되지만 prompt 만 빠져 있다). 그래서 창이 안 뜨고, 예외가 바깥
 * try/catch 에 잡혀 상태줄에만 한 줄 남았다. 사장님 눈에는 "아무 반응 없음"이다.
 *
 * 같은 이유로 서식 바의 **🔗 링크** 버튼도 함께 죽어 있었다 — 둘 다 이 함수로 바꾼다.
 * 취소하면 null 을 돌려준다(빈 문자열과 구별해야 호출부가 조용히 넘어가지 않는다).
 */
function askOneLine({ title, hint = '', label, value = '', placeholder = '' }) {
  return new Promise((resolve) => {
    const prev = document.getElementById('veAskDialog');
    if (prev) prev.remove();

    const wrap = document.createElement('div');
    wrap.id = 'veAskDialog';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(2,6,23,.72);'
      + 'display:flex;align-items:center;justify-content:center;padding:24px;';
    wrap.innerHTML = `
      <div style="width:min(94vw,440px);background:#1e293b;border:1px solid #334155;border-radius:14px;padding:22px;box-shadow:0 24px 64px rgba(0,0,0,.55);">
        <div style="font-size:15px;font-weight:800;color:#e2e8f0;margin-bottom:4px;">${title}</div>
        ${hint ? `<div style="font-size:12px;color:#94a3b8;margin-bottom:16px;">${hint}</div>` : '<div style="height:10px;"></div>'}
        <label style="display:block;font-size:12px;font-weight:800;color:#cbd5e1;margin-bottom:5px;">${label}</label>
        <input id="veAskInput" type="text" style="width:100%;padding:10px 12px;border:1px solid #475569;border-radius:9px;background:#0f172a;color:#f1f5f9;font-size:13.5px;box-sizing:border-box;" />
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px;">
          <button id="veAskCancel" style="padding:9px 16px;border:1px solid rgba(255,255,255,.14);border-radius:9px;background:rgba(255,255,255,.06);color:#cbd5e1;font-size:13px;font-weight:700;cursor:pointer;">취소</button>
          <button id="veAskOk" style="padding:9px 18px;border:none;border-radius:9px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:13px;font-weight:800;cursor:pointer;">확인</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    const input = wrap.querySelector('#veAskInput');
    input.value = value;
    input.placeholder = placeholder;
    const close = (result) => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(result); };
    const onKey = (e) => {
      if (e.key === 'Escape') close(null);
      if (e.key === 'Enter' && document.activeElement === input) { e.preventDefault(); close(input.value.trim()); }
    };
    document.addEventListener('keydown', onKey);
    wrap.querySelector('#veAskCancel').addEventListener('click', () => close(null));
    wrap.querySelector('#veAskOk').addEventListener('click', () => close(input.value.trim()));
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(null); });
    setTimeout(() => { input.focus(); input.select(); }, 0);
  });
}

function askCtaDetails() {
  return new Promise((resolve) => {
    const prev = document.getElementById('veCtaDialog');
    if (prev) prev.remove();

    const wrap = document.createElement('div');
    wrap.id = 'veCtaDialog';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(2,6,23,.72);'
      + 'display:flex;align-items:center;justify-content:center;padding:24px;';
    const field = 'width:100%;padding:10px 12px;border:1px solid #475569;border-radius:9px;'
      + 'background:#0f172a;color:#f1f5f9;font-size:13.5px;box-sizing:border-box;';
    wrap.innerHTML = `
      <div style="width:min(94vw,520px);background:#1e293b;border:1px solid #334155;border-radius:14px;padding:22px;box-shadow:0 24px 64px rgba(0,0,0,.55);">
        <div style="font-size:15px;font-weight:800;color:#e2e8f0;margin-bottom:4px;">🔘 버튼 넣기</div>
        <div style="font-size:12px;color:#94a3b8;margin-bottom:16px;">주소를 넣으면 문구는 자동으로 채워집니다. 직접 적으면 적은 것이 우선입니다.</div>

        <label style="display:block;font-size:12px;font-weight:800;color:#cbd5e1;margin-bottom:5px;">보낼 주소 <span style="color:#f87171;">*</span></label>
        <input id="veCtaUrl" type="url" placeholder="https://www.wetax.go.kr/" style="${field}" />
        <div id="veCtaSite" style="font-size:11.5px;color:#38bdf8;margin:6px 0 14px;min-height:16px;"></div>

        <label style="display:block;font-size:12px;font-weight:800;color:#cbd5e1;margin-bottom:5px;">버튼 문구</label>
        <input id="veCtaBtnText" type="text" placeholder="(비우면 자동)" style="${field}" />

        <label style="display:block;font-size:12px;font-weight:800;color:#cbd5e1;margin:14px 0 5px;">버튼 위 한 줄</label>
        <input id="veCtaHook" type="text" placeholder="(비우면 자동)" style="${field}" />

        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px;">
          <button id="veCtaCancel" style="padding:9px 16px;border:1px solid rgba(255,255,255,.14);border-radius:9px;background:rgba(255,255,255,.06);color:#cbd5e1;font-size:13px;font-weight:700;cursor:pointer;">취소</button>
          <button id="veCtaOk" style="padding:9px 20px;border:none;border-radius:9px;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;font-size:13px;font-weight:800;cursor:pointer;">넣기</button>
        </div>
      </div>`;

    const urlInput = wrap.querySelector('#veCtaUrl');
    const siteHint = wrap.querySelector('#veCtaSite');
    const btnInput = wrap.querySelector('#veCtaBtnText');
    const hookInput = wrap.querySelector('#veCtaHook');

    const close = (value) => {
      document.removeEventListener('keydown', onKey);
      wrap.remove();
      resolve(value);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close(null);
      else if (e.key === 'Enter' && e.target !== btnInput && e.target !== hookInput) submit();
    };
    const submit = () => {
      const url = String(urlInput.value || '').trim();
      if (!/^https?:\/\//i.test(url)) {
        siteHint.textContent = '⚠️ http:// 또는 https:// 로 시작하는 주소를 넣어주세요.';
        siteHint.style.color = '#f87171';
        urlInput.focus();
        return;
      }
      close({
        url,
        buttonText: String(btnInput.value || '').trim(),
        hook: String(hookInput.value || '').trim(),
      });
    };

    // 주소를 넣는 즉시 어디로 가는지 알려주고 문구를 채운다 (빈칸일 때만)
    let suggestTimer = null;
    urlInput.addEventListener('input', () => {
      clearTimeout(suggestTimer);
      suggestTimer = setTimeout(async () => {
        const url = String(urlInput.value || '').trim();
        if (!/^https?:\/\//i.test(url)) { siteHint.textContent = ''; return; }
        const res = await window.electronAPI.invoke('cta-suggest-copy', { url }).catch(() => null);
        if (!res?.ok) { siteHint.textContent = ''; return; }
        siteHint.style.color = '#38bdf8';
        siteHint.textContent = res.siteName ? `🧭 ${res.siteName} 로 보냅니다` : '🧭 아는 기관이 아니라 무난한 문구로 나갑니다';
        if (!btnInput.value.trim()) btnInput.placeholder = res.buttonText;
        if (!hookInput.value.trim()) hookInput.placeholder = res.hookingMessage;
      }, 350);
    });

    wrap.querySelector('#veCtaOk').addEventListener('click', submit);
    wrap.querySelector('#veCtaCancel').addEventListener('click', () => close(null));
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(null); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(wrap);
    urlInput.focus();
  });
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
        /**
         * v3.8.691 — prompt() 는 Electron 에서 안 뜬다. 대화상자를 여는 동안 선택이 풀리므로
         * **범위를 먼저 붙잡아 뒀다가** 닫힌 뒤 되살린다(안 그러면 엉뚱한 곳에 링크가 걸린다).
         */
        const keep = sel.getRangeAt(0).cloneRange();
        askOneLine({
          title: '🔗 링크 걸기',
          hint: '선택한 글자에 연결할 주소를 넣으세요.',
          label: '주소',
          value: 'https://',
          placeholder: 'https://www.example.go.kr/',
        }).then((url) => {
          if (!url) return;
          if (!/^https?:\/\//i.test(url)) { setStatus('주소는 http:// 또는 https:// 로 시작해야 합니다.'); return; }
          const s = doc.getSelection();
          s.removeAllRanges();
          s.addRange(keep);
          const safe = url.replace(/"/g, '&quot;');
          // 외부 링크는 rel 을 붙인다 — 제휴 링크일 수 있으므로 sponsored 도 함께
          const range = s.getRangeAt(0);
          const holder = doc.createElement('div');
          holder.appendChild(range.cloneContents());
          range.deleteContents();
          range.insertNode(doc.createRange().createContextualFragment(
            `<a href="${safe}" target="_blank" rel="sponsored nofollow noopener">${holder.innerHTML}</a>`,
          ));
          s.removeAllRanges();
          setStatus('링크를 걸었습니다');
        });
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
      /**
       * 📊 v3.8.687 — 표 넣기. 사장님: "표도 못넣고.."
       * 커서가 있는 문단 **아래**에 넣는다(구분선과 같은 자리 규칙). 칸은 본문처럼 클릭해 고친다.
       * 플랫폼 스킨이 표 CSS 를 안 실어 주는 일이 많아 테두리·여백을 인라인으로 박는다.
       */
      case 'table': {
        if (!sel?.anchorNode) { setStatus('표를 넣을 위치(문단)를 먼저 클릭하세요.'); return; }
        /**
         * v3.8.691 — prompt() 가 Electron 에서 안 떠서 이 버튼이 통째로 죽어 있었다.
         * 넣을 자리(block)는 **대화상자를 열기 전에** 잡아 둔다 — 열고 나면 선택이 풀린다.
         */
        const el = sel.anchorNode.nodeType === Node.ELEMENT_NODE ? sel.anchorNode : sel.anchorNode.parentElement;
        const block = el?.closest?.('p,h1,h2,h3,h4,li,blockquote,div,table') || doc.body.lastElementChild;
        askOneLine({
          title: '📊 표 넣기',
          hint: '커서가 있는 문단 아래에 넣습니다. 첫 줄은 머리글이 됩니다.',
          label: '표 크기 (행x열)',
          value: '3x3',
          placeholder: '3x3',
        }).then((size) => {
          if (!size) return;
          const m = size.match(/^(\d{1,2})\s*[x×*]\s*(\d{1,2})$/i);
          if (!m) { setStatus('표 크기는 "3x3" 처럼 적어 주세요.'); return; }
          const rows = Math.min(20, Math.max(1, Number(m[1])));
          const cols = Math.min(10, Math.max(1, Number(m[2])));
          const table = doc.createRange().createContextualFragment(buildTableHtml(rows, cols)).firstElementChild;
          if (block && block !== doc.body) block.insertAdjacentElement('afterend', table);
          else doc.body.appendChild(table);
          try { table.scrollIntoView({ block: 'center' }); } catch { /* 스크롤 실패가 삽입을 되돌릴 이유는 없다 */ }
          setStatus(`${rows}행 ${cols}열 표를 넣었습니다 — 칸을 클릭해 내용을 적으세요`);
        });
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
/**
 * 🧠 v3.8.691 — 본 화면의 엔진 셀렉트를 편집기로 **복제**한다.
 *
 * 목록을 여기에 다시 적지 않는 이유: 본 화면에 엔진이 추가되면 편집기 목록만 뒤처지고,
 * 사장님은 "왜 여기엔 그게 없지?" 를 겪는다. 원본을 그대로 베끼면 그 일이 없다.
 * 원본이 아직 안 그려졌으면(편집기를 먼저 여는 경로) 조용히 칸을 숨긴다.
 */
function cloneEngineOptions(target, sourceId) {
  if (!target) return false;
  const source = document.getElementById(sourceId);
  if (!source || source.options.length === 0) return false;
  target.innerHTML = '';
  for (const opt of source.options) {
    const copy = document.createElement('option');
    copy.value = opt.value;
    copy.textContent = opt.textContent;
    copy.disabled = opt.disabled;
    target.appendChild(copy);
  }
  target.value = source.value;   // 본 화면에서 고른 것으로 시작한다
  return true;
}

function refreshEditorEngineOptions(refs) {
  const okText = cloneEngineOptions(refs?.textEngine, 'generationEngine');
  const okImage = cloneEngineOptions(refs?.imageEngine, 'h2ImageSource');
  const wrap = refs?.overlay?.querySelector?.('#veEngineWrap');
  // 둘 다 못 베꼈으면 빈 칸을 보여주느니 숨긴다 — 유령 기본값을 payload 에 싣지 않는다
  if (wrap) wrap.style.display = (okText || okImage) ? 'inline-flex' : 'none';
  if (refs?.textEngine) refs.textEngine.style.display = okText ? '' : 'none';
  if (refs?.imageEngine) refs.imageEngine.style.display = okImage ? '' : 'none';
}

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

/** 📊 v3.8.687 — 인라인 스타일 표 (첫 줄 머리글). 발행 플랫폼 스킨에 기대지 않는다. */
export function buildTableHtml(rows, cols) {
  const th = '<th style="border:1px solid #cbd5e1;background:#f1f5f9;padding:10px 12px;text-align:left;font-weight:700;">항목</th>';
  const td = '<td style="border:1px solid #e2e8f0;padding:10px 12px;">내용</td>';
  const head = `<thead><tr>${th.repeat(cols)}</tr></thead>`;
  const bodyRows = Math.max(0, rows - 1);
  const body = bodyRows ? `<tbody>${`<tr>${td.repeat(cols)}</tr>`.repeat(bodyRows)}</tbody>` : '';
  return `<table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:15px;line-height:1.6;">${head}${body}</table>`;
}

// ─────────────────────────────────────────────
// </> HTML 코드 모드 (v3.8.687)
// ─────────────────────────────────────────────

/**
 * 코드 칸에 보여 줄 HTML. 프레임 본문에서 편집기 흔적만 걷어낸 것이다.
 * 광고 자리표시자·이미지 data: 주소는 **그대로** 둔다 — 저장 때 serializeEditor 가 처리한다.
 * 블록 태그 앞에서 줄을 바꿔 읽기 쉽게 한다(태그 사이 공백은 렌더링에 영향이 없다).
 */
export function htmlForSourceView(bodyInnerHtml) {
  return String(bodyInnerHtml || '')
    .replace(/>\s*<(\/?)(p|h[1-6]|div|table|thead|tbody|tr|ul|ol|li|blockquote|figure|figcaption|hr|section|article|br)\b/gi, '>\n<$1$2')
    .trim();
}

function cleanedBodyHtml() {
  const doc = getFrameDoc();
  if (!doc) return '';
  const body = doc.body.cloneNode(true);
  body.removeAttribute('contenteditable');
  body.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));
  body.querySelectorAll('.ve-img-selected, .ve-link-selected').forEach((el) => {
    el.classList.remove('ve-img-selected', 've-link-selected');
    if (!el.getAttribute('class')) el.removeAttribute('class');
  });
  body.querySelectorAll('[data-bgpt-editor], [data-bgpt-editor-ui]').forEach((el) => el.remove());
  return body.innerHTML;
}

/**
 * 코드 칸의 내용을 프레임에 싣는다. 코드가 안 바뀌었으면 아무것도 하지 않는다.
 * loadIntoFrame 은 baseline 을 새로 잡으므로 **원래 baseline 을 되돌려** 둔다 —
 * 안 그러면 코드로 고친 뒤 "저장하지 않은 편집" 경고가 안 뜬다.
 */
function applySourceToFrame() {
  if (!session?.sourceMode || !modalRefs?.sourceArea) return false;
  const src = modalRefs.sourceArea.value;
  if (src === session.sourceLoaded) return false;
  const keep = session.baseline;
  loadIntoFrame(src);
  session.baseline = keep;
  session.sourceLoaded = src;
  return true;
}

function setSourceMode(on) {
  const refs = modalRefs;
  if (!session || !refs?.sourceArea) return;
  if (on) {
    const src = htmlForSourceView(cleanedBodyHtml());
    refs.sourceArea.value = src;
    session.sourceLoaded = src;
    session.sourceMode = true;
    refs.overlay.classList.add('ve-source');
    refs.frame.style.display = 'none';
    refs.sourceArea.style.display = 'block';
    refs.sourceBtn.textContent = '👁 미리보기로';
    setStatus('HTML 코드를 직접 고칩니다. 표는 <table>, 소제목은 <h2> 로 적으면 됩니다. [미리보기로]를 누르거나 그대로 [저장]하면 반영됩니다.');
    try { refs.sourceArea.focus(); } catch { /* noop */ }
    return;
  }
  const applied = applySourceToFrame();
  session.sourceMode = false;
  refs.overlay.classList.remove('ve-source');
  refs.sourceArea.style.display = 'none';
  refs.frame.style.display = 'block';
  refs.sourceBtn.innerHTML = '&lt;/&gt; HTML 편집';
  setStatus(applied ? '고친 HTML 코드를 미리보기에 반영했습니다.' : '미리보기로 돌아왔습니다.');
}

/**
 * 🎨 v3.8.691 — 고른 이미지 **한 장만** 다시 만든다.
 *
 * 사장님: "이미지를 클릭하면 교체랑 삭제 버튼이뜨는데 다시생성버튼도 뜨게해줘"
 *
 * [이미지 다시 생성](위 도구막대)은 글의 **모든** 이미지를 바꾼다. 이건 그 반대다 —
 * 한 장만 마음에 안 들 때 나머지를 건드리지 않고 그 자리만 새로 만든다.
 * 무엇을 그릴지는 그 이미지 **바로 앞의 소제목**에서 가져온다(발행 때와 같은 규칙).
 */
async function regenerateOneImage(img) {
  if (!session || !img) return;
  const doc = getFrameDoc();
  if (!doc) return;
  const title = modalRefs.titleInput.value.trim() || session.originalTitle || '';
  if (!title) { setStatus('제목 칸을 먼저 채워 주세요 — 이미지 프롬프트는 제목으로 만듭니다.'); return; }

  // 이 이미지 앞의 가장 가까운 소제목 — 없으면 제목만으로 만든다
  let sectionTitle = '';
  for (let el = img; el; el = el.previousElementSibling || el.parentElement) {
    const h = el.previousElementSibling?.matches?.('h2,h3') ? el.previousElementSibling
      : el.matches?.('h2,h3') ? el : null;
    if (h) { sectionTitle = (h.textContent || '').trim(); break; }
    if (el === doc.body) break;
  }

  lockDraftButtons(true);
  setStatus(`🎨 이 이미지를 다시 만드는 중… (1~2분)${sectionTitle ? ` — "${sectionTitle.slice(0, 20)}"` : ''}`);
  try {
    const payload = await editorPayload();
    const res = await window.electronAPI.invoke('generate-editor-image', { title, sectionTitle, kind: 'section', payload });
    if (!res?.ok) throw new Error(res?.error || '알 수 없는 오류');
    // 새로 만든 블록에서 img 주소만 꺼내 **그 자리 이미지의 src 만** 바꾼다.
    // 블록을 통째로 갈아끼우면 발행기가 넣어 둔 클래스·스타일이 사라져 글 모양이 바뀐다.
    const holder = doc.createElement('div');
    holder.innerHTML = res.html;
    const src = holder.querySelector('img')?.getAttribute('src') || '';
    if (!src) throw new Error('만들어진 이미지 주소를 찾지 못했습니다.');
    img.setAttribute('src', src);
    img.removeAttribute('srcset');
    try { img.scrollIntoView({ block: 'center' }); } catch { /* 스크롤 실패가 교체를 되돌릴 이유는 없다 */ }
    setStatus('✅ 이 이미지를 다시 만들었습니다. (↩️ 되돌리기로 복구 가능)');
  } catch (err) {
    setStatus(`❌ 이미지 다시 생성 실패: ${err?.message || err}`);
  } finally {
    lockDraftButtons(false);
  }
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
  /**
   * v3.8.490 — 미리보기에서 이미지가 전부 깨지던 문제.
   *
   * 사장님 보고: "미리보기에서 이미지가 모두 안보입니다 깨져보여요"
   *
   * 이 문서는 doc.write 로 만들어서 **기준 주소(base)가 없다.** 그래서 발행된 글을
   * 불러와 편집할 때 본문의 상대경로 이미지(/wp-content/uploads/…)가 어디를 가리키는지
   * 알 수 없어 전부 깨진다. 원본 글 주소를 기준으로 잡아주면 그대로 보인다.
   */
  const baseHref = (() => {
    try {
      const src = String(session.postUrl || '');
      if (!/^https?:\/\//i.test(src)) return '';
      return `<base href="${new URL(src).origin}/">`;
    } catch {
      return '';
    }
  })();

  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8">${baseHref}
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
  initImageEditing(refs.frame, doc, {
    setStatus,
    onAfterRestore: () => protectSeparators(doc),
    onRegenerateImage: (img) => regenerateOneImage(img),   // 🎨 v3.8.691
  });
  session.baseline = serializeEditor();
  try { doc.body.focus(); } catch { /* noop */ }
}

function isDirty() {
  if (!session) return false;
  const titleChanged = (modalRefs.titleInput.value.trim() !== (session.originalTitle || '').trim())
    && modalRefs.titleInput.style.display !== 'none';
  // v3.8.687 — 코드 칸에서 고친 것도 "저장 안 한 편집"이다
  const sourceChanged = !!session.sourceMode && modalRefs.sourceArea.value !== session.sourceLoaded;
  return titleChanged || sourceChanged || serializeEditor() !== session.baseline;
}

function requestClose() {
  if (!session) { hideModal(); return; }
  if (isDirty() && !confirm('저장하지 않은 편집 내용이 있습니다. 닫을까요?')) return;
  hideModal();
}

function hideModal() {
  detachImageEditing();
  if (modalRefs) {
    // v3.8.687 — 코드 모드로 닫았어도 다음에 열면 미리보기부터
    modalRefs.overlay.classList.remove('ve-source');
    modalRefs.sourceArea.style.display = 'none';
    modalRefs.sourceArea.value = '';
    modalRefs.frame.style.display = 'block';
    modalRefs.sourceBtn.innerHTML = '&lt;/&gt; HTML 편집';
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
    let originalPlatform = '';

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
      originalPlatform = normalizeEditorPlatform(item.platform);
    } else if (kind === 'file') {
      const res = await window.electronAPI.invoke('open-html-file', { filePath: source.filePath || undefined });
      if (!res?.ok) {
        if (!res?.canceled) alert('파일 열기 실패: ' + (res?.error || '알 수 없는 오류'));
        return;
      }
      filePath = res.filePath;
      html = res.content;
      // v3.8.683 — 파일의 첫 h1 을 제목으로 (발행할 때 필요하다)
      const h1 = String(html).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      title = h1 ? h1[1].replace(/<[^>]+>/g, '').trim() : '';
    } else if (kind === 'paste') {
      // 📋 v3.8.683 — 붙여넣기(editor-paste.js 가 normalize-editor-paste 로 서식을 맞춰 넘긴다)
      html = String(source.html || '');
      title = String(source.title || '');
      if (!html.trim()) { alert('붙여 넣은 내용이 비어 있습니다.'); return; }
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
      originalPlatform = publishedKindToPlatform(kind);
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
      // 🎯 v3.8.556: 발행할 곳 — 대기열 글과 이미 발행된 글에서만 고를 수 있다.
      //   생성 직후(appstate)는 글포스팅 화면의 플랫폼 라디오가 정하고,
      //   파일(file)은 발행이 아니라 저장이라 고를 것이 없다.
      originalPlatform,
      // v3.8.683 — 파일·붙여넣기 글도 발행할 곳을 고른다 (사장님: "파일에 저장이 아니라 플랫폼을 선택해서 발행")
      platformPickable: kind === 'republish' || kind === 'file' || kind === 'paste' || !!getPublishedSource(kind),
    };

    const refs = ensureEditorModal();
    refs.titleInput.value = title;
    refs.titleInput.style.display = '';   // v3.8.683: 파일 글도 제목이 있어야 발행한다
    refs.hostImagesLabel.style.display = kind === 'file' || kind === 'paste' ? 'inline-flex' : 'none';
    refs.saveAsBtn.style.display = kind === 'file' || kind === 'paste' ? '' : 'none';
    if (refs.saveAsBtn) refs.saveAsBtn.textContent = kind === 'paste' ? '💾 파일로 저장' : '💾 다른 이름으로';

    /**
     * 🔄 v3.8.603 — 다시 만들기는 **이미 발행된 글에서만** 보인다.
     * 대기열·파일에는 갈아끼울 postId 가 없다.
     */
    if (refs.regenWrap) {
      refs.regenWrap.style.display = getPublishedSource(kind) && postId ? 'inline-flex' : 'none';
    }

    // 🎯 v3.8.556: 발행할 곳 드롭다운 채우기 + 표시
    if (session.platformPickable) {
      refs.targetPlatform.innerHTML = EDITOR_PLATFORMS
        .map((p) => `<option value="${p.key}">${p.label}</option>`)
        .join('');
      // v3.8.683 — 파일·붙여넣기는 원래 플랫폼이 없다: 글포스팅 화면에서 고른 플랫폼을 따라간다
      const fallbackPlatform = originalPlatform || document.querySelector('input[name="blogPlatform"]:checked')?.value || 'blogspot';
      refs.targetPlatform.value = normalizeEditorPlatform(fallbackPlatform);
      refs.targetPlatformWrap.style.display = 'inline-flex';
    } else {
      refs.targetPlatformWrap.style.display = 'none';
    }

    // v3.8.357: 반자동 발행 모드에서는 저장 + 즉시 발행
    const isSemiAuto = kind === 'appstate' && !!window.__semiAutoMode;
    refreshSaveButtonLabel(isSemiAuto);
    refreshEditorEngineOptions(refs);   // v3.8.691: 열 때마다 본 화면 목록을 다시 베낀다
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
    // v3.8.687 — 코드 모드에서 바로 저장하면 고친 코드를 먼저 프레임에 싣는다 (저장은 프레임만 읽는다)
    if (session.sourceMode) setSourceMode(false);
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
      // 🎯 v3.8.556: 고른 발행 플랫폼을 항목에 새긴다.
      //   payload 까지 맞춰야 한다 — 발행 코드는 payload.platform 만 읽는다.
      const pickedPlatform = selectedEditorPlatform();
      if (pickedPlatform) {
        const changed = normalizeEditorPlatform(item.platform) !== pickedPlatform;
        item.platform = pickedPlatform;
        item.payload = {
          ...(item.payload || {}),
          platform: pickedPlatform,
          targetPlatform: pickedPlatform,
          blogPlatform: pickedPlatform,
        };
        if (changed) addLog(`🎯 발행할 곳을 ${editorPlatformLabel(pickedPlatform)}(으)로 바꿨습니다.`, 'info');
      }
      localStorage.setItem('pendingRepublishQueue', JSON.stringify(queue));
      window.renderRepublishQueueBanner?.();
      addLog('✏️ 대기열 항목이 수정되었습니다. 재발행 시 편집본이 발행됩니다.', 'success');
      hideModalAfterSave();
    } else if (getPublishedSource(session.kind) && isCrossPlatformPublish()) {
      /**
       * 🎯 v3.8.556 — 다른 플랫폼을 골랐다: 수정이 아니라 **새 글 발행**이다.
       *
       * 사장님 확정: 원래 플랫폼의 글은 그대로 둔다(복사이지 이동이 아니다).
       * 대상 플랫폼에는 이 글의 postId 가 없으므로 update 채널을 쓸 수 없다 —
       * 일반 발행 경로(publish-content)로 보낸다.
       */
      const target = selectedEditorPlatform();
      const targetLabel = editorPlatformLabel(target);
      const fromLabel = editorPlatformLabel(session.originalPlatform);
      const slowNotice = target === 'tistory'
        ? '\n\n티스토리는 브라우저로 편집기를 조작하므로 1분 정도 걸릴 수 있습니다.'
        : '';
      if (!confirm(`${targetLabel}에 새 글로 발행할까요?\n\n원래 ${fromLabel} 글은 지우지 않고 그대로 둡니다.${slowNotice}`)) {
        setStatus('발행이 취소되었습니다.');
        return;
      }
      setStatus(`🚀 ${targetLabel}에 새 글 발행 중…`);
      const res = await window.electronAPI.invoke('publish-content', {
        platform: target,
        title,
        content: html,
        thumbnailUrl: computeThumbnailUrl(),
        payload: {
          // published-posts.js 의 플랫폼 키와 같은 값을 넘긴다 (blogspot/wordpress/tistory)
          ...(await platformPayloadFor(target)),
          platform: target,
          targetPlatform: target,
          blogPlatform: target,
        },
      });
      if (res?.ok || res?.url) {
        addLog(`🚀 ${targetLabel} 새 글 발행 완료: ${res.url || title}`, 'success');
        window.__refreshPublishedPosts?.();
        alert(`✅ ${targetLabel}에 새 글로 발행했습니다!\n${res.url || ''}\n\n원래 ${fromLabel} 글은 그대로 있습니다.`);
        hideModalAfterSave();
      } else {
        alert(`❌ ${targetLabel} 발행 실패\n\n` + (res?.error || '알 수 없는 오류'));
        setStatus('발행에 실패했습니다.');
      }
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
        payload: await platformPayloadFor(session.kind),
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
    } else if ((session.kind === 'file' || session.kind === 'paste') && !saveAs && selectedEditorPlatform()) {
      /**
       * 🚀 v3.8.683 — 파일·붙여넣기 글을 고른 플랫폼에 **새 글**로 발행한다.
       * 사장님: "파일에 저장이 아니라 블로그 플랫폼을 선택해서 발행이 가능하게 해 줘야지."
       * 다른 플랫폼 새 발행(v3.8.556)과 같은 채널(publish-content)을 쓴다 — 두 벌로 만들지 않는다.
       */
      const target = selectedEditorPlatform();
      const targetLabel = editorPlatformLabel(target);
      if (!title) { alert('제목을 입력해 주세요. 발행에는 제목이 필요합니다.'); setStatus('제목이 비어 발행하지 않았습니다.'); return; }
      const slowNotice = target === 'tistory' ? '\n\n티스토리는 브라우저로 편집기를 조작하므로 1분 정도 걸릴 수 있습니다.' : '';
      if (!confirm(`${targetLabel}에 새 글로 발행할까요?\n\n"${title}"${slowNotice}`)) { setStatus('발행이 취소되었습니다.'); return; }
      setStatus(`🚀 ${targetLabel}에 새 글 발행 중…`);
      const res = await window.electronAPI.invoke('publish-content', {
        platform: target,
        title,
        content: html,
        thumbnailUrl: computeThumbnailUrl(),
        payload: {
          ...(await platformPayloadFor(target)),
          platform: target,
          targetPlatform: target,
          blogPlatform: target,
        },
      });
      if (res?.ok || res?.url) {
        addLog(`🚀 ${targetLabel} 새 글 발행 완료: ${res.url || title}`, 'success');
        window.__refreshPublishedPosts?.();
        alert(`✅ ${targetLabel}에 새 글로 발행했습니다!\n${res.url || ''}`);
        hideModalAfterSave();
      } else {
        alert(`❌ ${targetLabel} 발행 실패\n\n` + (res?.error || '알 수 없는 오류'));
        setStatus('발행에 실패했습니다.');
      }
    } else if (session.kind === 'file' || session.kind === 'paste') {
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
