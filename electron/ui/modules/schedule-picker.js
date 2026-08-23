// 📅 예약 시간 입력 보조 — v3.8.549
//
// 사장님 보고: "예약발행 선택하고 예약시간 뜨면 우측에 달력 표시가 검은색이라 잘 안 보여요.
//               달력 열기 버튼으로 바꿔줘. 연속발행도 마찬가지야.
//               드롭다운으로 시간 선택도 가능하게 해주고."
//
// ## 왜 한 파일인가
// 예약 시간 입력칸은 **세 곳**에 있다.
//   ① 단일 발행 상세설정  #scheduleDateTime      (index.html)
//   ② 연속발행 일괄 적용  #pq-bulk-schedule      (publish-queue.js)
//   ③ 연속발행 항목 카드  .pq-item-schedule      (publish-queue.js, 항목마다)
// 같은 도구를 세 번 따로 만들면 한 곳만 고쳐지고 나머지는 조용히 낡는다
// (이 저장소의 'payload 3경로 함정'과 같은 구조). 그래서 여기 한 번만 만든다.
//
// ## 원래 값 배선은 건드리지 않는다
// 시/분 드롭다운은 **input 의 value 를 바꾸고 change 를 bubbles 로 쏜다.**
// 그러면 기존 리스너(큐의 .pq-item-schedule change → item.scheduleDate,
// 일괄 적용의 pq-bulk-schedule 읽기)가 그대로 돈다. id·class 도 그대로 둔다.

const MINUTE_STEP = 5;

/** "2026-08-22T09:05" → { date: '2026-08-22', hh: '09', mm: '05' } */
function splitValue(value) {
  const m = String(value || '').match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return { date: m[1], hh: m[2], mm: m[3] };
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function todayLocalDate() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function ensureStyles() {
  if (document.getElementById('spStyles')) return;
  const st = document.createElement('style');
  st.id = 'spStyles';
  st.textContent = `
    /* 기본 달력 아이콘이 검은색이라 어두운 배경에서 안 보인다 — 밝게 뒤집는다.
       버튼을 따로 주더라도 아이콘 자체가 보여야 오해가 없다. */
    input[type="datetime-local"]::-webkit-calendar-picker-indicator,
    input[type="date"]::-webkit-calendar-picker-indicator,
    input[type="time"]::-webkit-calendar-picker-indicator {
      filter: invert(1) brightness(1.7);
      opacity: .85;
      cursor: pointer;
    }
    .sp-tools {
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
      margin-top: 6px;
    }
    .sp-open {
      display: inline-flex; align-items: center; gap: 5px;
      min-height: 32px; padding: 5px 11px;
      background: rgba(251, 191, 36, .14);
      border: 1px solid rgba(251, 191, 36, .45);
      border-radius: 8px;
      color: #fde68a; font-size: 12px; font-weight: 800;
      cursor: pointer; white-space: nowrap;
      font-family: inherit;
    }
    .sp-open:hover { background: rgba(251, 191, 36, .24); }
    .sp-open:active { transform: translateY(1px); }
    .sp-sep { color: rgba(226, 232, 240, .45); font-size: 11px; font-weight: 700; }
    .sp-tools select {
      min-height: 32px; padding: 5px 7px;
      background: rgba(15, 23, 42, .78);
      border: 1px solid rgba(148, 163, 184, .3);
      border-radius: 8px;
      color: #e2e8f0; font-size: 12px; font-weight: 700;
      font-family: inherit;
      cursor: pointer;
    }
    .sp-unit { color: rgba(226, 232, 240, .7); font-size: 11px; font-weight: 700; }
  `;
  document.head.appendChild(st);
}

function buildOptions(select, values, labelOf) {
  select.innerHTML = values.map((v) => `<option value="${v}">${labelOf(v)}</option>`).join('');
}

/**
 * 예약 시간 input 하나에 [📅 달력 열기] + [시][분] 드롭다운을 붙인다.
 * 이미 붙어 있으면 값만 다시 맞춘다 (다시 그려도 중복으로 안 붙는다).
 *
 * @param {HTMLInputElement} input datetime-local 입력칸
 * @returns {boolean} 새로 붙였으면 true
 */
export function enhanceScheduleInput(input) {
  if (!input || input.type !== 'datetime-local') return false;
  ensureStyles();

  if (input.dataset.spReady === '1') {
    syncSelectsFromInput(input);
    return false;
  }
  input.dataset.spReady = '1';

  const tools = document.createElement('div');
  tools.className = 'sp-tools';

  const openBtn = document.createElement('button');
  openBtn.type = 'button';
  openBtn.className = 'sp-open';
  openBtn.textContent = '📅 달력 열기';
  openBtn.title = '달력에서 날짜와 시간을 고릅니다';

  const hourSel = document.createElement('select');
  hourSel.className = 'sp-h';
  hourSel.title = '시';
  buildOptions(hourSel, Array.from({ length: 24 }, (_, i) => pad(i)), (v) => `${v}시`);

  const minSel = document.createElement('select');
  minSel.className = 'sp-m';
  minSel.title = '분';
  const minutes = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => pad(i * MINUTE_STEP));
  buildOptions(minSel, minutes, (v) => `${v}분`);

  const sep = document.createElement('span');
  sep.className = 'sp-sep';
  sep.textContent = '또는 직접';

  tools.appendChild(openBtn);
  tools.appendChild(sep);
  tools.appendChild(hourSel);
  tools.appendChild(minSel);

  // input 바로 뒤에 둔다 — input 을 다른 곳으로 옮기지 않는다.
  //   옮기면 .pq-field 의 폭 규칙과 기존 선택자가 어긋날 수 있다.
  input.insertAdjacentElement('afterend', tools);

  openBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openCalendar(input);
  });

  const onPick = () => writeInputFromSelects(input, hourSel.value, minSel.value);
  hourSel.addEventListener('change', onPick);
  minSel.addEventListener('change', onPick);

  // 사용자가 input 을 직접 고치면 드롭다운도 따라간다
  input.addEventListener('change', () => syncSelectsFromInput(input));
  input.addEventListener('input', () => syncSelectsFromInput(input));

  syncSelectsFromInput(input);
  return true;
}

/** 달력을 연다. showPicker 가 막히면 입력칸에 포커스를 준다(그래도 손으로 칠 수 있다). */
export function openCalendar(input) {
  try {
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return true;
    }
  } catch (err) {
    // 사용자 제스처 없이 부르면 브라우저가 막는다 — 조용히 숨기지 않고 남긴다
    console.warn('[SCHEDULE-PICKER] showPicker 실패, 포커스로 대체:', err?.message || err);
  }
  try { input.focus(); } catch { /* 포커스 실패는 치명 아님 */ }
  return false;
}

function toolsOf(input) {
  const el = input?.nextElementSibling;
  return el && el.classList?.contains('sp-tools') ? el : null;
}

/** input 값 → 시/분 드롭다운 */
function syncSelectsFromInput(input) {
  const tools = toolsOf(input);
  if (!tools) return;
  const hourSel = tools.querySelector('.sp-h');
  const minSel = tools.querySelector('.sp-m');
  const parts = splitValue(input.value);
  if (!parts) return;

  hourSel.value = parts.hh;

  /**
   * 분이 5분 단위가 아닐 수 있다 (간격 분산으로 09:07 같은 값이 들어온다).
   * 그 값을 버리고 09:05 로 보여주면 화면이 거짓말을 한다 — 그 값 그대로 옵션에 넣는다.
   */
  if (!Array.from(minSel.options).some((o) => o.value === parts.mm)) {
    const opt = document.createElement('option');
    opt.value = parts.mm;
    opt.textContent = `${parts.mm}분`;
    minSel.appendChild(opt);
    Array.from(minSel.options)
      .sort((a, b) => Number(a.value) - Number(b.value))
      .forEach((o) => minSel.appendChild(o));
  }
  minSel.value = parts.mm;
}

/** 시/분 드롭다운 → input 값 (날짜는 유지, 비어 있으면 오늘) */
function writeInputFromSelects(input, hh, mm) {
  const parts = splitValue(input.value);
  const date = parts?.date || todayLocalDate();
  input.value = `${date}T${hh}:${mm}`;
  // 기존 배선이 그대로 돌게 한다 — 큐 항목 저장·일괄 적용이 여기에 걸려 있다
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * 범위 안의 예약 시간 입력칸을 모두 보강한다.
 * 큐는 목록을 다시 그릴 때마다 부르면 된다 (이미 붙은 것은 건너뛴다).
 */
export function enhanceAllScheduleInputs(root = document) {
  const scope = root || document;
  let added = 0;
  scope.querySelectorAll('input[type="datetime-local"]').forEach((input) => {
    if (enhanceScheduleInput(input)) added += 1;
  });
  return added;
}
