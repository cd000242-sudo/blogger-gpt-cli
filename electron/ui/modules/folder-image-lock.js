// 📁 내 폴더 이미지 배치 — 배치가 끝나면 상세설정을 그 상태로 잠근다 (v3.8.723)
//
// 사장님: "내폴더 이미지 h2 배치를 썸네일배치를 하고 소제목은 안 넣고 완료시켰는데
//          상세설정에 이미지는 인식을 안 하고 있네요?? 썸네일과 소제목 이미지를 생성하면 안 되고
//          드롭다운에도 내폴더 이미지 배치라고 뜨면서 비활성화되어야 정상인데"
//
// ## 무엇이 빠져 있었나
// 배치 모달의 「완료」는 window 전역(__preGeneratedImagesForArticle · __preGeneratedThumbnailForArticle ·
// __folderImageH2Titles)만 채우고 **화면의 이미지 설정은 한 글자도 건드리지 않았다.**
// 그래서 사용자가 직접 배치를 마쳤는데도 상세설정에는 "나노바나나 2 로 생성" 이 그대로 남아 있었고,
// 발행하면 AI 이미지를 또 만들 것처럼 보였다(실제 payload 는 배치본을 쓰더라도 화면이 거짓말을 한 셈이다).
//
// ## 무엇을 하나
//   · 이미지 소스 드롭다운 → "📁 내 폴더 이미지 배치" 를 골라 두고 잠근다
//   · 이미지 범위 드롭다운 → 실제 배치 결과대로 맞춘다
//       썸네일만 배치 → 「썸네일만」 · 둘 다 → 「전체」 · 둘 다 없음 → 「이미지 없음」
//   · 왜 잠겼는지 한 줄 안내를 붙인다 — 잠그기만 하고 이유를 안 적으면 고장으로 읽힌다
//   · 배치를 비우면 **원래 값으로 되돌리고** 잠금을 푼다
//
// ## 원칙
// 되돌릴 수 있게 만든다. 잠그기 전 값을 기억해 두고, 해제할 때 그대로 복구한다.

const SOURCE_ID = 'h2ImageSource';
const MODE_ID = 'h2ImageMode';
const LOCK_OPTION_VALUE = '__folder-images__';
const NOTICE_ID = 'folderImageLockNotice';

/** 잠그기 전 값 — 해제할 때 그대로 돌려놓는다 */
let saved = null;

function el(id) {
  return typeof document !== 'undefined' ? document.getElementById(id) : null;
}

/** 배치된 것이 무엇인지 — 화면이 아니라 실제 배치 결과를 본다 */
export function readFolderPlacement() {
  const h2Images = Array.isArray(window.__preGeneratedImagesForArticle)
    ? window.__preGeneratedImagesForArticle.filter((item) => item && (item.dataUrl || item.url))
    : [];
  const thumbnail = window.__preGeneratedThumbnailForArticle?.dataUrl ? 1 : 0;
  return {
    h2Count: h2Images.length,
    hasThumbnail: thumbnail === 1,
    active: h2Images.length > 0 || thumbnail === 1,
  };
}

/**
 * 배치 결과 → 화면에 무엇을 보여줄지. **순수 함수**다.
 *
 * DOM 을 만지는 부분과 판단하는 부분을 나눠 둔다 — 판단이 DOM 안에 숨으면
 * 테스트가 가짜 DOM 을 만들어야 하고, 가짜는 통과해도 실물에서 틀릴 수 있다.
 */
export function describeFolderPlacement(placement) {
  if (!placement || !placement.active) {
    return { locked: false, label: '', mode: '', notice: '' };
  }

  const parts = [];
  if (placement.hasThumbnail) parts.push('썸네일');
  if (placement.h2Count > 0) parts.push(`소제목 ${placement.h2Count}장`);
  const what = parts.join(' · ');

  // 썸네일만 배치했으면 본문 이미지는 만들지 않는다. 소제목이 배치됐으면 전체를 쓴다.
  const mode = placement.h2Count > 0 ? 'all' : 'thumbnail-only';

  return {
    locked: true,
    label: `📁 내 폴더 이미지 배치 (${what})`,
    mode,
    notice: `📁 내 폴더 이미지를 직접 배치하셨습니다 — ${what}. `
      + '배치한 이미지를 그대로 쓰므로 AI 이미지는 만들지 않습니다. '
      + '다시 AI로 만들려면 「내 폴더 이미지로 H2 직접 배치」에서 배치를 비우세요.',
  };
}

function ensureLockOption(select, label) {
  let option = select.querySelector(`option[value="${LOCK_OPTION_VALUE}"]`);
  if (!option) {
    option = document.createElement('option');
    option.value = LOCK_OPTION_VALUE;
    select.insertBefore(option, select.firstChild);
  }
  option.textContent = label;
  return option;
}

function setNotice(anchor, message) {
  if (!anchor || !anchor.parentElement) return;
  let notice = el(NOTICE_ID);
  if (!message) {
    if (notice) notice.remove();
    return;
  }
  if (!notice) {
    notice = document.createElement('div');
    notice.id = NOTICE_ID;
    notice.style.cssText = 'margin-top:8px;padding:9px 12px;border-radius:8px;'
      + 'background:rgba(20,184,166,0.12);border:1px solid rgba(45,212,191,0.35);'
      + 'color:#ccfbf1;font-size:12px;line-height:1.6;';
    anchor.parentElement.insertBefore(notice, anchor.nextSibling);
  }
  notice.textContent = message;
}

/**
 * 배치 상태를 화면에 반영한다.
 * 배치가 있으면 잠그고, 없으면 잠금을 푼다. 어느 쪽이든 이 함수 하나만 부르면 된다.
 */
export function syncFolderImageLock() {
  const source = el(SOURCE_ID);
  const mode = el(MODE_ID);
  if (!source || !mode) return { locked: false, reason: '컨트롤 없음' };

  const placement = readFolderPlacement();

  if (!placement.active) {
    if (saved) {
      source.value = saved.source;
      mode.value = saved.mode;
      saved = null;
    }
    source.disabled = false;
    mode.disabled = false;
    const option = source.querySelector(`option[value="${LOCK_OPTION_VALUE}"]`);
    if (option) option.remove();
    setNotice(source, '');
    return { locked: false, reason: '배치 없음' };
  }

  // 잠그기 전 값을 한 번만 기억한다 (두 번 기억하면 잠긴 값을 원본으로 착각한다)
  if (!saved) saved = { source: source.value, mode: mode.value };

  const plan = describeFolderPlacement(placement);

  ensureLockOption(source, plan.label);
  source.value = LOCK_OPTION_VALUE;
  source.disabled = true;

  mode.value = plan.mode;
  mode.disabled = true;

  setNotice(source, plan.notice);

  return { locked: true, placement, mode: plan.mode };
}

if (typeof window !== 'undefined') {
  window.syncFolderImageLock = syncFolderImageLock;
  window.readFolderPlacement = readFolderPlacement;
}
