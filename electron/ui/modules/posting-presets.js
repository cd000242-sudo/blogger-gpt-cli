// 🎛️ 발행 프리셋 콘솔 — 항상 보이는 요약 칩 + 프리셋 (v3.8.533)
//
// 사장님 지적: "상세설정 뭔가 켜고 작업하면 많이 불편하지않을까".
// 실측: 상세설정 66개 컨트롤이 5탭 아코디언(기본 닫힘)에 숨어, 발행 순간
// 무슨 설정으로 나가는지 화면에 없었다. 실제 사고 2건(모드 우선순위·유령 기본값)의
// 공통 원인도 "안 보이는 값이 실려 나감"이었다.
//
// ## 설계 원칙 — 칩은 새 상태가 아니라 기존 컨트롤의 뷰다
//   칩이 기존 셀렉트/라디오 값을 직접 읽고, 바꿀 때도 그 컨트롤에 쓰고 change 를
//   쏜다. 단일/큐/스케줄 3경로 payload 조립은 한 줄도 안 바뀐다 (3경로 함정 회피).
//   컨트롤이 없으면 칩을 만들지 않고 크게 경고한다 — 없는 엘리먼트에 기본값을
//   실어 보내는 유령 기본값 사고를 원천 차단.
import { addLog } from './core.js';

const STORE_KEY = 'postingPresetsV1';

/**
 * 칩 정의 — read/write 는 전부 "지금 DOM에 있는 진짜 컨트롤"만 본다.
 * options 도 실제 <option>/라디오에서 수확한다 → 모드가 추가돼도 여기 안 고친다.
 */
const CHIPS = [
  {
    key: 'mode', icon: '🎯', title: '콘텐츠 모드',
    el: () => document.getElementById('contentMode'),
    kind: 'select',
  },
  {
    key: 'thumb', icon: '📸', title: '썸네일',
    el: () => document.getElementById('thumbnailType'),
    kind: 'select',
  },
  {
    key: 'image', icon: '🖼️', title: '본문 이미지',
    el: () => document.getElementById('h2ImageSource'),
    kind: 'select',
  },
  {
    key: 'pub', icon: '🚀', title: '발행 방식',
    name: 'postingMode',
    kind: 'radio',
  },
  {
    key: 'cta', icon: '🔗', title: 'CTA',
    name: 'ctaMode',
    kind: 'radio',
  },
];

// ─── 읽기/쓰기 (기존 컨트롤이 진실) ───────────────────────────

function readChip(chip) {
  if (chip.kind === 'select') {
    const el = chip.el();
    if (!el) return null;
    const opt = el.options[el.selectedIndex];
    return { value: el.value, label: shortLabel(opt ? opt.textContent : el.value) };
  }
  const checked = document.querySelector(`input[name="${chip.name}"]:checked`);
  if (!checked) return null;
  return { value: checked.value, label: shortLabel(radioLabel(checked)) };
}

function chipOptions(chip) {
  if (chip.kind === 'select') {
    const el = chip.el();
    if (!el) return [];
    return Array.from(el.options).map((o) => ({ value: o.value, label: shortLabel(o.textContent) }));
  }
  return Array.from(document.querySelectorAll(`input[name="${chip.name}"]`))
    .map((r) => ({ value: r.value, label: shortLabel(radioLabel(r)) }));
}

function writeChip(chip, value) {
  if (chip.kind === 'select') {
    const el = chip.el();
    if (!el) return false;
    if (!Array.from(el.options).some((o) => o.value === value)) return false; // 낡은 값은 쓰지 않는다
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true })); // 기존 리스너(예약 토글 등)가 그대로 돈다
    return true;
  }
  const radio = document.querySelector(`input[name="${chip.name}"][value="${value}"]`);
  if (!radio) return false;
  radio.checked = true;
  radio.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function radioLabel(radio) {
  const label = radio.closest('label');
  return label ? label.textContent.replace(/\s+/g, ' ').trim() : radio.value;
}

/** 칩에 들어가기엔 긴 라벨을 줄인다 — 원본 셀렉트의 문구는 그대로 둔다 */
function shortLabel(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > 22 ? t.slice(0, 21) + '…' : t;
}

// ─── 프리셋 저장소 ────────────────────────────────────────────

function loadStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (raw && Array.isArray(raw.list)) return raw;
  } catch { /* 깨진 저장소는 새로 시작 */ }
  return { active: null, list: [] };
}

function saveStore(store) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* 저장 실패는 치명 아님 */ }
}

function snapshotValues() {
  const values = {};
  CHIPS.forEach((chip) => {
    const cur = readChip(chip);
    if (cur) values[chip.key] = cur.value;
  });
  return values;
}

function applyPreset(preset) {
  let applied = 0;
  CHIPS.forEach((chip) => {
    const v = preset.values?.[chip.key];
    if (v !== undefined && writeChip(chip, v)) applied += 1;
  });
  return applied;
}

// ─── 렌더 ─────────────────────────────────────────────────────

export function initPostingPresets() {
  const bar = document.getElementById('postingPresetBar');
  if (!bar) {
    // 없는 자리에 조용히 붙지 않는다 — 배선이 끊기면 소리를 낸다 (조용한 미배선 5회 재발 교훈)
    console.warn('[PRESET] ⚠️ #postingPresetBar 가 index.html 에 없습니다 — 칩 바 미표시');
    return;
  }
  if (bar.dataset.ready) return;
  bar.dataset.ready = '1';

  if (!document.getElementById('ppStyles')) {
    const st = document.createElement('style');
    st.id = 'ppStyles';
    st.textContent = `
      #postingPresetBar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:11px 12px;
        margin-bottom:14px; background:rgba(30,41,59,.5); border:1px solid rgba(148,163,184,.16); border-radius:12px; }
      #postingPresetBar .pp-preset { display:flex; align-items:center; gap:7px; padding:8px 12px; border-radius:999px;
        cursor:pointer; background:linear-gradient(135deg,rgba(99,102,241,.25),rgba(139,92,246,.25));
        border:1px solid rgba(99,102,241,.45); font-size:12.5px; font-weight:800; color:#c7d2fe; position:relative; }
      #postingPresetBar .pp-preset:hover { border-color:rgba(129,140,248,.7); }
      #postingPresetBar .pp-div { width:1px; height:22px; background:rgba(148,163,184,.16); }
      #postingPresetBar .pp-chip { display:flex; align-items:center; gap:6px; padding:7px 11px; border-radius:999px;
        cursor:pointer; background:rgba(148,163,184,.09); border:1px solid rgba(148,163,184,.2);
        font-size:12px; font-weight:700; color:#cbd5e1; position:relative; transition:border-color .15s, background-color .15s; }
      #postingPresetBar .pp-chip:hover { border-color:rgba(129,140,248,.55); background:rgba(99,102,241,.12); }
      #postingPresetBar .pp-chip .pp-v { color:#e2e8f0; font-weight:800; }
      #postingPresetBar .pp-chip.pp-dirty::after { content:''; width:6px; height:6px; border-radius:50%; background:#fbbf24; }
      #postingPresetBar .pp-pop { position:absolute; top:calc(100% + 8px); left:0; z-index:60; min-width:230px; max-height:300px; overflow-y:auto;
        background:#111a30; border:1px solid rgba(148,163,184,.3); border-radius:12px; padding:11px;
        box-shadow:0 16px 40px rgba(2,6,23,.6); display:none; }
      #postingPresetBar .pp-pop.open { display:block; }
      #postingPresetBar .pp-pop .pp-t { font-size:11px; font-weight:800; color:#94a3b8; margin-bottom:7px; }
      #postingPresetBar .pp-opt { display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:8px;
        cursor:pointer; font-size:12.5px; font-weight:700; color:#cbd5e1; }
      #postingPresetBar .pp-opt:hover { background:rgba(99,102,241,.14); }
      #postingPresetBar .pp-opt.sel { background:rgba(99,102,241,.2); color:#c7d2fe; }
      #postingPresetBar .pp-x { margin-left:auto; color:#64748b; font-weight:900; padding:0 4px; border-radius:6px; }
      #postingPresetBar .pp-x:hover { color:#fca5a5; background:rgba(239,68,68,.12); }
      #postingPresetBar .pp-save input { width:100%; box-sizing:border-box; background:#0b1120; border:1px solid #334155;
        color:#e2e8f0; border-radius:8px; padding:8px 10px; font-size:12.5px; margin-bottom:8px; }
      #postingPresetBar .pp-save input:focus { outline:none; border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.18); }
      #postingPresetBar .pp-save button { border:none; border-radius:8px; padding:8px 12px; font-size:12px; font-weight:800;
        cursor:pointer; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; }
      #postingPresetBar .pp-hint { font-size:10.5px; color:#94a3b8; }
    `;
    document.head.appendChild(st);
  }

  renderBar(bar);

  // 아코디언 쪽에서 바꿔도 칩이 따라온다 — 진실은 컨트롤 하나뿐이므로 표시만 갱신
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!t) return;
    const watched = CHIPS.some((c) => (c.kind === 'select' ? c.el() === t : t.name === c.name));
    if (watched) refreshChips(bar);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#postingPresetBar')) closePops(bar);
  });

  addLog('🎛️ 발행 프리셋 콘솔 준비 완료', 'info');
}

function renderBar(bar) {
  const store = loadStore();
  const activeName = store.active && store.list.some((p) => p.name === store.active) ? store.active : null;

  bar.innerHTML = `
    <div class="pp-preset" id="ppPresetBtn">💾 <span id="ppPresetName">${escapeHtml(activeName || '프리셋 없음')}</span> ▾
      <div class="pp-pop" id="ppPresetPop"></div>
    </div>
    <div class="pp-div"></div>
    ${CHIPS.map((chip) => {
      const cur = readChip(chip);
      if (!cur) {
        console.warn(`[PRESET] ⚠️ ${chip.title} 컨트롤을 찾지 못해 칩을 건너뜁니다 (${chip.kind === 'select' ? 'select' : 'name=' + chip.name})`);
        return '';
      }
      return `
      <div class="pp-chip" data-pp-chip="${chip.key}">${chip.icon} <span class="pp-v" data-pp-v="${chip.key}">${escapeHtml(cur.label)}</span>
        <div class="pp-pop" data-pp-pop="${chip.key}"></div>
      </div>`;
    }).join('')}
    <span class="pp-hint">칩을 눌러 바로 변경 · 노란 점 = 프리셋과 다름</span>`;

  bar.querySelectorAll('[data-pp-chip]').forEach((chipEl) => {
    chipEl.addEventListener('click', (e) => {
      if (e.target.closest('.pp-opt')) return;
      const pop = chipEl.querySelector('.pp-pop');
      const was = pop.classList.contains('open');
      closePops(bar);
      if (!was) { fillChipPop(chipEl); pop.classList.add('open'); }
      e.stopPropagation();
    });
  });

  const presetBtn = bar.querySelector('#ppPresetBtn');
  presetBtn.addEventListener('click', (e) => {
    if (e.target.closest('.pp-opt') || e.target.closest('.pp-save')) return;
    const pop = presetBtn.querySelector('.pp-pop');
    const was = pop.classList.contains('open');
    closePops(bar);
    if (!was) { fillPresetPop(bar); pop.classList.add('open'); }
    e.stopPropagation();
  });

  refreshChips(bar);
}

function fillChipPop(chipEl) {
  const key = chipEl.dataset.ppChip;
  const chip = CHIPS.find((c) => c.key === key);
  const pop = chipEl.querySelector('.pp-pop');
  const cur = readChip(chip);
  pop.innerHTML = `<div class="pp-t">${chip.title}</div>` + chipOptions(chip).map((o) => `
    <div class="pp-opt${cur && o.value === cur.value ? ' sel' : ''}" data-v="${escapeHtml(o.value)}">${escapeHtml(o.label)}</div>`).join('');
  pop.querySelectorAll('.pp-opt').forEach((opt) => {
    opt.addEventListener('click', (e) => {
      writeChip(chip, opt.dataset.v); // change 이벤트가 refreshChips 를 부른다
      closePops(chipEl.closest('#postingPresetBar'));
      e.stopPropagation();
    });
  });
}

function fillPresetPop(bar) {
  const store = loadStore();
  const pop = bar.querySelector('#ppPresetPop');
  pop.innerHTML = `
    <div class="pp-t">저장된 프리셋 — 한 번에 전체 전환</div>
    ${store.list.length ? store.list.map((p) => `
      <div class="pp-opt${p.name === store.active ? ' sel' : ''}" data-pp-apply="${escapeHtml(p.name)}">
        ${escapeHtml(p.name)}<span class="pp-x" data-pp-del="${escapeHtml(p.name)}" title="삭제">✕</span>
      </div>`).join('')
      : '<div class="pp-hint" style="padding:4px 2px 8px;">아직 없습니다 — 아래에서 지금 조합을 저장하세요</div>'}
    <div class="pp-save" style="margin-top:8px; border-top:1px solid rgba(148,163,184,.14); padding-top:10px;">
      <input id="ppSaveName" placeholder="예: SEO 기본, 쇼핑 쿠팡" maxlength="20" />
      <button id="ppSaveBtn">＋ 현재 칩 조합을 프리셋으로 저장</button>
    </div>`;

  pop.querySelectorAll('[data-pp-apply]').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-pp-del]')) return;
      const name = row.dataset.ppApply;
      const preset = loadStore().list.find((p) => p.name === name);
      if (!preset) return;
      const n = applyPreset(preset);
      const store2 = loadStore(); store2.active = name; saveStore(store2);
      bar.querySelector('#ppPresetName').textContent = name;
      refreshChips(bar);
      closePops(bar);
      addLog(`🎛️ 프리셋 적용: ${name} (${n}개 설정)`, 'info');
      e.stopPropagation();
    });
  });
  pop.querySelectorAll('[data-pp-del]').forEach((x) => {
    x.addEventListener('click', (e) => {
      const name = x.dataset.ppDel;
      const store2 = loadStore();
      store2.list = store2.list.filter((p) => p.name !== name);
      if (store2.active === name) store2.active = null;
      saveStore(store2);
      bar.querySelector('#ppPresetName').textContent = store2.active || '프리셋 없음';
      fillPresetPop(bar); refreshChips(bar);
      e.stopPropagation();
    });
  });
  pop.querySelector('#ppSaveBtn').addEventListener('click', (e) => {
    const input = pop.querySelector('#ppSaveName');
    const name = String(input.value || '').trim();
    if (!name) { input.focus(); return; }
    const store2 = loadStore();
    store2.list = store2.list.filter((p) => p.name !== name); // 같은 이름은 덮어쓴다
    store2.list.push({ name, values: snapshotValues() });
    store2.active = name;
    saveStore(store2);
    bar.querySelector('#ppPresetName').textContent = name;
    fillPresetPop(bar); refreshChips(bar);
    addLog(`🎛️ 프리셋 저장: ${name}`, 'success');
    e.stopPropagation();
  });
}

function refreshChips(bar) {
  const store = loadStore();
  const active = store.list.find((p) => p.name === store.active);
  CHIPS.forEach((chip) => {
    const v = bar.querySelector(`[data-pp-v="${chip.key}"]`);
    const chipEl = bar.querySelector(`[data-pp-chip="${chip.key}"]`);
    if (!v || !chipEl) return;
    const cur = readChip(chip);
    if (!cur) return;
    v.textContent = cur.label;
    const presetVal = active?.values?.[chip.key];
    chipEl.classList.toggle('pp-dirty', presetVal !== undefined && presetVal !== cur.value);
  });
}

function closePops(bar) {
  if (bar) bar.querySelectorAll('.pp-pop.open').forEach((p) => p.classList.remove('open'));
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
