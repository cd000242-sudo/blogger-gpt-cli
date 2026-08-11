/**
 * 💰 수동 광고 자리 (v3.8.482)
 *
 * 사용자 요구: "사람들이 내 글을 봤을 때 원하는 정보를 얻고 정보가 바로 보이면
 *   클릭을 하잖아. 그 위치에 애드센스 광고를 수동으로 배치하고 싶어서."
 *
 * 자동 광고는 위치를 못 고른다. 애드센스에서 광고 단위 코드를 받아 원하는 자리에
 * 직접 붙이는 것이 목적이다.
 *
 * ## 왜 자리표시자를 거치는가 (선택이 아니라 필수다)
 * editor.js 의 serializeEditor 는 저장할 때 `<script>` 를 **전부 지운다**:
 *     body.querySelectorAll('script').forEach((el) => el.remove());
 * 애드센스 코드는 `<script>` 두 개와 `<ins>` 로 이뤄져 있어서, 편집기에 원문을
 * 그대로 넣으면 저장하는 순간 사라진다. 그래서
 *   · 편집기 안에서는 **회색 박스 자리표시자**로 두고
 *   · 스크립트를 지운 **뒤에** 실제 코드로 바꾼다
 * 이렇게 해야 붙여넣은 광고가 살아남는다. 미리보기가 "블로그에 보이는 실제 모습"
 * 이라는 점에서도, 스크립트 원문이 본문에 깔려 보이는 것보다 낫다.
 */

const STORAGE_KEY = 'bgptAdUnits';

/** 편집기 안에서 광고 자리를 나타내는 표시 */
export const AD_SLOT_CLASS = 'bgpt-ad-slot';
/** 발행물에 들어가는 광고 블록 (다시 열었을 때 자리표시자로 되돌리는 기준) */
export const AD_BLOCK_CLASS = 'bgpt-ad';

function safeParse(raw) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** 등록된 광고 단위 목록 — [{ id, name, code }] */
export function loadAdUnits() {
  try {
    return safeParse(localStorage.getItem(STORAGE_KEY)).filter((u) => u && u.id && u.code);
  } catch {
    return [];
  }
}

export function saveAdUnits(units) {
  const list = (Array.isArray(units) ? units : [])
    .filter((u) => u && String(u.code || '').trim())
    .map((u) => ({
      id: String(u.id || '').trim() || `ad-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: String(u.name || '').trim() || '이름 없는 광고',
      code: String(u.code || '').trim(),
    }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return list;
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * 편집기에 넣을 자리표시자.
 * contenteditable=false 라 글자를 잘못 건드리지 않고, 통째로 지우기는 쉽다.
 */
export function makeAdSlotHtml(unit) {
  const id = escapeHtml(unit?.id);
  const name = escapeHtml(unit?.name || '광고');
  return `<div class="${AD_SLOT_CLASS}" data-bgpt-ad-unit="${id}" contenteditable="false"`
    + ` title="발행하면 이 자리에 광고가 들어갑니다">📢 광고 자리 — ${name}</div>`;
}

/** 편집기 안에서 자리표시자를 보이게 하는 스타일 (iframe 에 주입) */
export const AD_SLOT_STYLE = `
  .${AD_SLOT_CLASS}{
    margin:22px 0;padding:18px 12px;border:2px dashed #94a3b8;border-radius:10px;
    background:#f1f5f9;color:#475569;font-size:14px;font-weight:700;text-align:center;
    user-select:none;
  }
`;

/**
 * 자리표시자 → 실제 광고 코드.
 * **serializeEditor 가 script 를 지운 뒤에** 불러야 한다.
 * 등록이 사라진 단위는 자리표시자를 지운다 — 안내 문구가 발행되면 안 된다.
 */
export function expandAdSlots(html, units = loadAdUnits()) {
  const source = String(html || '');
  if (!source.includes(AD_SLOT_CLASS)) return { html: source, expanded: 0, missing: 0 };

  const byId = new Map(units.map((u) => [u.id, u]));
  let expanded = 0;
  let missing = 0;

  const pattern = new RegExp(
    `<div[^>]*class="[^"]*\\b${AD_SLOT_CLASS}\\b[^"]*"[^>]*data-bgpt-ad-unit="([^"]*)"[^>]*>[\\s\\S]*?<\\/div>`,
    'gi',
  );

  const out = source.replace(pattern, (_full, unitId) => {
    const unit = byId.get(String(unitId));
    if (!unit) { missing += 1; return ''; }
    expanded += 1;
    return `<div class="${AD_BLOCK_CLASS}" data-bgpt-ad-unit="${escapeHtml(unit.id)}">${unit.code}</div>`;
  });

  return { html: out, expanded, missing };
}

/**
 * 실제 광고 코드 → 자리표시자.
 * 저장했던 글을 다시 열 때 쓴다. 안 하면 편집기에 스크립트 원문이 깔린다.
 */
export function collapseAdBlocks(html, units = loadAdUnits()) {
  const source = String(html || '');
  if (!source.includes(AD_BLOCK_CLASS)) return source;

  const byId = new Map(units.map((u) => [u.id, u]));
  /**
   * 애드센스 코드는 `<script>` 둘과 `<ins>` 로만 이뤄져 중첩 div 가 없다.
   * 그래서 비탐욕 `</div>` 로 충분하다 — 여기서 균형 매칭까지 갈 필요가 없다.
   */
  const pattern = new RegExp(
    `<div[^>]*class="[^"]*\\b${AD_BLOCK_CLASS}\\b[^"]*"[^>]*data-bgpt-ad-unit="([^"]*)"[^>]*>[\\s\\S]*?<\\/div>`,
    'gi',
  );

  return source.replace(pattern, (_full, unitId) => {
    const unit = byId.get(String(unitId)) || { id: String(unitId), name: '등록이 삭제된 광고' };
    return makeAdSlotHtml(unit);
  });
}
