// @ts-nocheck
// 🚀 원클릭 블로그 세팅 모듈 — 초보자 완벽 가이드
// electron/ui/modules/oneclick-setup.js

import { addLog, getStorageManager } from './core.js';

// ═══════════════════════════════════════════════
// 상수 정의
// ═══════════════════════════════════════════════

const ENGINE_NAMES = {
  google: '구글 서치 콘솔',
  naver: '네이버 서치어드바이저',
  daum: '다음 웹마스터도구',
  bing: 'Bing 웹마스터도구'
};

const ENGINE_GRADIENTS = {
  google: 'linear-gradient(135deg, #4285f4, #1a73e8)',
  naver: 'linear-gradient(135deg, #00c853, #009624)',
  daum: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
  bing: 'linear-gradient(135deg, #f28e26, #e67e22)'
};

const BLOGGER_OAUTH_REDIRECT_URI = 'http://127.0.0.1:58392/callback';
const GOOGLE_AUTH_CLIENTS_URL = 'https://console.cloud.google.com/auth/clients';
const GOOGLE_AUTH_OVERVIEW_URL = 'https://console.cloud.google.com/auth/overview';
const GOOGLE_AUTH_AUDIENCE_URL = 'https://console.cloud.google.com/auth/audience';
const GOOGLE_BLOGGER_API_URL = 'https://console.cloud.google.com/apis/library/blogger.googleapis.com';

// ═══════════════════════════════════════════════
// 타이밍 상수
// ═══════════════════════════════════════════════

const POLL_INTERVAL_MS = 3000;
const BUTTON_RESET_DELAY_MS = 5000;
const BLOG_URL_AUTO_LOAD_DELAY_MS = 1000;
const MAX_CONSECUTIVE_POLL_ERRORS = 10;

// ═══════════════════════════════════════════════
// 폴링 interval 관리 (orphan 방지)
// ═══════════════════════════════════════════════

let platformPollId = null;
let webmasterPollId = null;
let infraPollId = null;
let connectPollId = null;

function clearPoll(type) {
  if (type === 'all') { clearPoll('platform'); clearPoll('webmaster'); clearPoll('connect'); clearPoll('infra'); return; }
  if (type === 'platform' && platformPollId) { clearInterval(platformPollId); platformPollId = null; }
  if (type === 'webmaster' && webmasterPollId) { clearInterval(webmasterPollId); webmasterPollId = null; }
  if (type === 'connect' && connectPollId) { clearInterval(connectPollId); connectPollId = null; }
  if (type === 'infra' && infraPollId) { clearInterval(infraPollId); infraPollId = null; }
}

// ═══════════════════════════════════════════════
// 동시 실행 방지 (상호 배타)
// ═══════════════════════════════════════════════

function isAnyOperationRunning() {
  if (activeSetup && !activeSetup.cancelled) return '플랫폼 세팅';
  if (activeWebmaster && !activeWebmaster.cancelled) return '웹마스터 세팅';
  if (activeConnect && !activeConnect.cancelled) return '플랫폼 연동';
  if (activeInfra && !activeInfra.cancelled) return '인프라 세팅';
  return null;
}

// ═══════════════════════════════════════════════
// 인라인 토스트 (alert() 대체, 스택 관리)
// ═══════════════════════════════════════════════

const TOAST_GAP = 8;
const activeToasts = [];

function showToast(msg, type = 'info', durationMs = 4000) {
  const colors = {
    info: { bg: 'rgba(59, 130, 246, 0.95)', border: 'rgba(59, 130, 246, 0.4)' },
    success: { bg: 'rgba(16, 185, 129, 0.95)', border: 'rgba(16, 185, 129, 0.4)' },
    error: { bg: 'rgba(239, 68, 68, 0.95)', border: 'rgba(239, 68, 68, 0.4)' },
    warn: { bg: 'rgba(245, 158, 11, 0.95)', border: 'rgba(245, 158, 11, 0.4)' },
  };
  const c = colors[type] || colors.info;
  // 스택 오프셋 계산
  const topOffset = 20 + activeToasts.reduce((sum, t) => sum + (t.offsetHeight || 48) + TOAST_GAP, 0);
  const el = document.createElement('div');
  el.style.cssText = `
    position: fixed; top: ${topOffset}px; left: 50%; transform: translateX(-50%) translateY(-10px);
    padding: 14px 28px; background: ${c.bg}; border: 1px solid ${c.border};
    border-radius: 14px; color: white; font-size: 13px; font-weight: 600;
    z-index: 999999; backdrop-filter: blur(12px); box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    opacity: 0; transition: all 0.3s ease; max-width: 90%; text-align: center; line-height: 1.5;
  `;
  el.textContent = msg;
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'polite');
  document.body.appendChild(el);
  activeToasts.push(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateX(-50%) translateY(0)'; });
  setTimeout(() => {
    el.style.opacity = '0'; el.style.transform = 'translateX(-50%) translateY(-10px)';
    setTimeout(() => {
      el.remove();
      const idx = activeToasts.indexOf(el);
      if (idx > -1) activeToasts.splice(idx, 1);
      // 남은 토스트 위치 재계산
      let y = 20;
      activeToasts.forEach(t => { t.style.top = y + 'px'; y += (t.offsetHeight || 48) + TOAST_GAP; });
    }, 300);
  }, durationMs);
}

// 버튼 innerHTML 대체 — DOM API로 아이콘+라벨 세팅
function setButtonContent(btn, icon, label) {
  btn.textContent = '';
  const iconSpan = document.createElement('span');
  iconSpan.textContent = icon;
  const labelSpan = document.createElement('span');
  labelSpan.textContent = label;
  btn.appendChild(iconSpan);
  btn.appendChild(labelSpan);
}

// ═══════════════════════════════════════════════
// 인라인 입력 모달 (prompt() 대체)
// ═══════════════════════════════════════════════

function showInputModal({ title, placeholder, defaultValue = '', onConfirm, onCancel }) {
  const existing = document.getElementById('oneclick-input-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'oneclick-input-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'oneclick-input-modal-title');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center; z-index: 99999;
  `;

  const card = document.createElement('div');
  card.style.cssText = `
    background: linear-gradient(135deg, #1e3a5f 0%, #0d1b2a 100%); border-radius: 24px;
    padding: 36px; max-width: 480px; width: 90%; border: 1px solid rgba(255,255,255,0.1);
  `;

  const titleEl = document.createElement('h3');
  titleEl.id = 'oneclick-input-modal-title';
  titleEl.style.cssText = 'color: white; font-size: 18px; font-weight: 800; margin: 0 0 16px; text-align: center;';
  titleEl.textContent = title;

  const input = document.createElement('input');
  input.type = 'text';
  input.value = defaultValue;
  input.placeholder = placeholder;
  input.style.cssText = `
    width: 100%; padding: 14px 16px; background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; color: white;
    font-size: 14px; outline: none; box-sizing: border-box; margin-bottom: 16px;
  `;

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display: flex; gap: 10px;';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '취소';
  cancelBtn.style.cssText = `
    flex: 1; padding: 12px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
    color: #94a3b8; border-radius: 12px; font-weight: 600; cursor: pointer; font-size: 14px;
  `;

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = '확인';
  confirmBtn.style.cssText = `
    flex: 1; padding: 12px; background: linear-gradient(135deg, #3b82f6, #2563eb);
    border: none; color: white; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 14px;
  `;

  const escHandler = (e) => { if (e.key === 'Escape') { close(); onCancel?.(); } };
  const close = () => { modal.remove(); document.removeEventListener('keydown', escHandler); document.removeEventListener('keydown', trapFocus); };
  cancelBtn.onclick = () => { close(); onCancel?.(); };
  confirmBtn.onclick = () => { const val = input.value.trim(); close(); onConfirm?.(val); };
  input.onkeydown = (e) => { if (e.key === 'Enter') confirmBtn.click(); };
  modal.onclick = (e) => { if (e.target === modal) { close(); onCancel?.(); } };
  document.addEventListener('keydown', escHandler);

  // 포커스 트랩: Tab 키가 모달 내 포커스 가능 요소 사이에서만 순환
  const focusableEls = [input, cancelBtn, confirmBtn];
  const trapFocus = (e) => {
    if (e.key !== 'Tab') return;
    const first = focusableEls[0], last = focusableEls[focusableEls.length - 1];
    if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
    else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
  };
  document.addEventListener('keydown', trapFocus);

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);
  card.appendChild(titleEl);
  card.appendChild(input);
  card.appendChild(btnRow);
  modal.appendChild(card);
  document.body.appendChild(modal);
  requestAnimationFrame(() => input.focus());
}

// ═══════════════════════════════════════════════
// 블로그스팟 전용 사전 입력 모달
// ═══════════════════════════════════════════════

async function getSavedBloggerBlogId() {
  try {
    const creds = await getStoredBloggerOAuthSettings();
    return String(creds?.blogId || '').trim();
  } catch (e) {
    console.warn('[ONECLICK] saved Blogger Blog ID load skipped:', e);
    return '';
  }
}

function showBlogspotSetupModal(onComplete) {
  const existing = document.getElementById('blogspot-setup-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'blogspot-setup-modal';
  modal.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
    z-index: 99999; display: flex; align-items: center; justify-content: center;
    animation: fadeIn 0.2s ease;
  `;

  const card = document.createElement('div');
  card.style.cssText = `
    background: linear-gradient(145deg, #1e293b, #0f172a); border: 1px solid rgba(255,255,255,0.12);
    border-radius: 20px; padding: 32px; width: 620px; max-width: 95vw; max-height: 90vh;
    overflow-y: auto; box-shadow: 0 24px 64px rgba(0,0,0,0.5);
  `;

  // 헤더
  const header = document.createElement('div');
  header.style.cssText = 'text-align: center; margin-bottom: 24px;';
  header.innerHTML = `
    <div style="font-size: 36px; margin-bottom: 8px;">🔵</div>
    <h3 style="margin: 0; font-size: 20px; font-weight: 800; color: white;">블로그스팟 세팅 정보 입력</h3>
    <p style="margin: 8px 0 0; font-size: 12px; color: rgba(255,255,255,0.45); line-height: 1.5;">
      먼저 목적을 고른 뒤 진행합니다. 새 블로그를 추가로 만들 수도 있고, 기존 블로그를 점검·최적화할 수도 있습니다.
    </p>
  `;
  card.appendChild(header);

  let blogspotSetupPurpose = 'create-new';
  const purposeWrap = document.createElement('div');
  purposeWrap.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:18px;';
  const purposeButtons = {};
  function createPurposeButton(purpose, title, desc, badge) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.purpose = purpose;
    btn.style.cssText = 'text-align:left; padding:14px; border-radius:13px; border:1px solid rgba(255,255,255,0.12); background:rgba(15,23,42,0.62); color:#e5e7eb; cursor:pointer; transition:all .18s ease;';
    btn.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px;">
        <span style="font-size:13px; font-weight:900;">${title}</span>
        <span style="font-size:10px; font-weight:900; color:#fed7aa;">${badge}</span>
      </div>
      <div style="font-size:11px; color:#94a3b8; line-height:1.45;">${desc}</div>
    `;
    btn.onclick = () => setBlogspotPurpose(purpose);
    purposeButtons[purpose] = btn;
    return btn;
  }
  purposeWrap.appendChild(createPurposeButton(
    'create-new',
    '새 블로그 추가 개설',
    '기존 블로그가 있어도 새 제목과 주소로 블로그를 하나 더 만듭니다.',
    '신규'
  ));
  purposeWrap.appendChild(createPurposeButton(
    'existing',
    '기존 블로그 점검·최적화',
    '이미 있는 블로그를 감지하고, 어떤 항목이 확인됐는지 근거를 보여준 뒤 다음 단계로 넘어갑니다.',
    '기존'
  ));
  card.appendChild(purposeWrap);

  let blogspotSkinPreset = 'approval-revenue';
  const skinSection = document.createElement('div');
  skinSection.style.cssText = 'margin-bottom:18px;';
  skinSection.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:9px;">
      <div>
        <div style="font-size:12px; font-weight:900; color:#f8fafc;">테마스킨 선택</div>
        <div style="font-size:10px; color:#94a3b8; margin-top:2px;">광고를 버튼처럼 속이지 않고, 탐색 버튼과 광고 영역을 분리합니다.</div>
      </div>
    </div>
  `;
  const skinWrap = document.createElement('div');
  skinWrap.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:10px;';
  const skinButtons = {};
  function createSkinButton(preset, title, desc, badge) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.skinPreset = preset;
    btn.style.cssText = 'text-align:left; min-height:94px; padding:14px; border-radius:13px; border:1px solid rgba(255,255,255,0.12); background:rgba(15,23,42,0.62); color:#e5e7eb; cursor:pointer; transition:all .18s ease;';
    btn.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:7px;">
        <span style="font-size:13px; font-weight:900;">${title}</span>
        <span style="font-size:10px; font-weight:900; color:#fed7aa;">${badge}</span>
      </div>
      <div style="font-size:11px; color:#94a3b8; line-height:1.5;">${desc}</div>
    `;
    btn.onclick = () => setBlogspotSkinPreset(preset);
    skinButtons[preset] = btn;
    return btn;
  }
  skinWrap.appendChild(createSkinButton(
    'approval-revenue',
    '애드센스 승인형',
    '고급형 본문 폭, 명확한 내비게이션, 정책 안전 광고 슬롯, 버튼형 관련글/CTA를 적용합니다.',
    '추천'
  ));
  skinWrap.appendChild(createSkinButton(
    'cloud',
    '기존 클라우드',
    '기존 리더남 클라우드 글 디자인을 유지합니다. 이미 쓰던 스타일이 필요할 때 선택하세요.',
    '기존'
  ));
  skinSection.appendChild(skinWrap);
  card.appendChild(skinSection);

  // 필드 생성 함수
  function createField(label, id, placeholder, required = false, helpText = '') {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-bottom: 16px;';
    const lbl = document.createElement('label');
    lbl.style.cssText = 'display: block; font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.6); margin-bottom: 6px;';
    lbl.textContent = label + (required ? ' *' : '');
    const input = document.createElement('input');
    input.id = id;
    input.type = 'text';
    input.placeholder = placeholder;
    input.style.cssText = `
      width: 100%; padding: 12px 14px; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px; color: white; font-size: 14px; outline: none; box-sizing: border-box;
      transition: border-color 0.2s;
    `;
    input.onfocus = () => { input.style.borderColor = 'rgba(255, 87, 34, 0.5)'; };
    input.onblur = () => { input.style.borderColor = 'rgba(255,255,255,0.12)'; };
    wrap.appendChild(lbl);
    wrap.appendChild(input);
    if (helpText) {
      const help = document.createElement('p');
      help.style.cssText = 'margin: 4px 0 0; font-size: 10px; color: rgba(255,255,255,0.35); line-height: 1.4;';
      help.textContent = helpText;
      wrap.appendChild(help);
    }
    return wrap;
  }

  const existingIdField = createField(
    '🆔 기존 Blog ID (선택)', 'bs-existing-id', '예: 1234567890123456789',
    false, '비워두면 Blogger 화면에서 자동 감지합니다. 기존 블로그 점검 모드에서만 사용합니다'
  );
  card.appendChild(existingIdField);

  const titleField = createField(
    '📝 블로그 제목', 'bs-title', '예: 블로소득 블로그', true,
    '주제와 관련된 키워드가 포함된 제목을 추천합니다'
  );
  card.appendChild(titleField);

  const addressField = createField(
    '🌐 블로그 주소 (도메인)', 'bs-address', '예: blog-income-tube', true,
    '영문 소문자, 숫자, 하이픈만 사용. {주소}.blogspot.com 형태로 생성됩니다'
  );
  card.appendChild(addressField);

  const descField = createField(
    '💬 블로그 설명', 'bs-desc', '예: 블로그 수익화, 티스토리, 워드프레스 관련 정보', true,
    '검색엔진에 노출되는 설명문입니다. 키워드 중심 2~3줄 권장'
  );
  card.appendChild(descField);

  // 구분선
  const divider = document.createElement('div');
  divider.style.cssText = 'height: 1px; background: rgba(255,255,255,0.08); margin: 8px 0 20px;';
  card.appendChild(divider);

  // 자동 설정 안내
  const autoInfo = document.createElement('div');
  autoInfo.style.cssText = 'padding: 14px 16px; background: rgba(255, 87, 34, 0.08); border: 1px solid rgba(255, 87, 34, 0.2); border-radius: 12px; margin-bottom: 20px;';
  autoInfo.innerHTML = `
    <div style="font-size: 12px; font-weight: 700; color: #FF7043; margin-bottom: 6px;">⚡ 블로그 생성과 기초 설정만 진행합니다</div>
    <div style="font-size: 11px; color: rgba(255,255,255,0.62); line-height: 1.55; margin-bottom: 8px;">
      파비콘, Google Analytics, ads.txt는 발행 필수 항목이 아니므로 원클릭 세팅에서 제외했습니다.
      실제 글 발행은 아래의 <strong style="color:#fed7aa;">앱 연동</strong>에서 OAuth와 Blog ID가 완료되면 가능합니다.
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 6px;">
      ${['검색엔진 표시 ON', 'HTTPS 활성화', '시간대: 서울', '댓글 숨기기', '이미지 라이트박스', '이미지 지연로드', 'WebP 형식', '성인콘텐츠 OFF', '글 표시 6개', '날짜 형식 yyyy.MM.dd', '선택 테마스킨 적용']
        .map(item => `<span style="padding: 3px 8px; background: rgba(255,255,255,0.05); border-radius: 6px; font-size: 10px; color: rgba(255,255,255,0.5);">✓ ${item}</span>`).join('')}
    </div>
  `;
  card.appendChild(autoInfo);

  function setBlogspotPurpose(purpose) {
    blogspotSetupPurpose = purpose;
    Object.entries(purposeButtons).forEach(([key, btn]) => {
      const active = key === purpose;
      btn.style.background = active ? 'rgba(255,87,34,0.16)' : 'rgba(15,23,42,0.62)';
      btn.style.borderColor = active ? 'rgba(255,112,67,0.52)' : 'rgba(255,255,255,0.12)';
      btn.style.boxShadow = active ? '0 0 0 1px rgba(255,112,67,0.16), 0 10px 28px rgba(255,87,34,0.12)' : 'none';
    });
    const createMode = purpose === 'create-new';
    existingIdField.style.display = createMode ? 'none' : 'block';
    titleField.style.display = createMode ? 'block' : 'none';
    addressField.style.display = createMode ? 'block' : 'none';
    const descLabel = descField.querySelector('label');
    const descHelp = descField.querySelector('p');
    if (descLabel) descLabel.textContent = createMode ? '💬 블로그 설명 *' : '💬 블로그 설명 (선택 · 덮어쓸 때만)';
    if (descHelp) descHelp.textContent = createMode
      ? '검색엔진에 노출되는 설명문입니다. 키워드 중심 2~3줄 권장'
      : '비워두면 기존 설명을 유지합니다. 입력하면 기존 블로그 설명/메타 설명 최적화에 사용합니다';
    startBtn.textContent = createMode ? '🚀 새 블로그 만들기 시작' : '🔎 기존 블로그 점검 시작';
  }

  function setBlogspotSkinPreset(preset) {
    blogspotSkinPreset = preset;
    Object.entries(skinButtons).forEach(([key, btn]) => {
      const active = key === preset;
      btn.style.background = active ? 'rgba(34,197,94,0.14)' : 'rgba(15,23,42,0.62)';
      btn.style.borderColor = active ? 'rgba(74,222,128,0.45)' : 'rgba(255,255,255,0.12)';
      btn.style.boxShadow = active ? '0 0 0 1px rgba(74,222,128,0.14), 0 10px 28px rgba(34,197,94,0.10)' : 'none';
    });
  }

  // 버튼
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display: flex; gap: 10px;';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '취소';
  cancelBtn.style.cssText = 'flex: 1; padding: 14px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #94a3b8; border-radius: 12px; font-weight: 600; cursor: pointer; font-size: 14px;';
  const startBtn = document.createElement('button');
  startBtn.textContent = '🚀 세팅 시작';
  startBtn.style.cssText = 'flex: 2; padding: 14px; background: linear-gradient(135deg, #FF5722, #FF7043); border: none; color: white; border-radius: 12px; font-weight: 800; cursor: pointer; font-size: 15px; box-shadow: 0 4px 20px rgba(255, 87, 34, 0.4);';

  const close = () => { modal.remove(); };
  cancelBtn.onclick = () => { close(); onComplete?.(null); };
  startBtn.onclick = () => {
    const createMode = blogspotSetupPurpose === 'create-new';
    const title = document.getElementById('bs-title')?.value?.trim();
    const address = document.getElementById('bs-address')?.value?.trim();
    const desc = document.getElementById('bs-desc')?.value?.trim();
    const existingBlogId = document.getElementById('bs-existing-id')?.value?.trim() || '';

    if (createMode && !title) { showToast('📝 새 블로그 제목을 입력해주세요', 'warn'); return; }
    if (createMode && !address) { showToast('🌐 새 블로그 주소를 입력해주세요', 'warn'); return; }
    if (createMode && !desc) { showToast('💬 새 블로그 설명을 입력해주세요', 'warn'); return; }
    if (!createMode && existingBlogId && !/^\d+$/.test(existingBlogId)) {
      showToast('🆔 Blog ID는 숫자만 입력해주세요. 모르겠다면 비워두세요', 'warn');
      return;
    }

    const config = {
      setupPurpose: blogspotSetupPurpose,
      skinPreset: blogspotSkinPreset,
      useExistingBlog: !createMode,
      forceCreateNew: createMode,
      existingBlogId: !createMode ? existingBlogId : '',
      blogTitle: createMode ? title : '',
      blogAddress: createMode ? address.toLowerCase().replace(/[^a-z0-9-]/g, '') : '',
      blogDescription: desc,
    };
    if (createMode && !config.blogAddress) {
      showToast('🌐 블로그 주소는 영문 소문자·숫자·하이픈만 사용할 수 있습니다', 'warn');
      return;
    }

    close();
    onComplete?.(config);
  };

  modal.onclick = (e) => { if (e.target === modal) { close(); onComplete?.(null); } };

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(startBtn);
  card.appendChild(btnRow);
  modal.appendChild(card);
  document.body.appendChild(modal);
  setBlogspotPurpose('create-new');
  setBlogspotSkinPreset('approval-revenue');
  getSavedBloggerBlogId().then((blogId) => {
    const input = document.getElementById('bs-existing-id');
    if (!blogId) return;
    if (input && !input.value) input.value = blogId;
    setBlogspotPurpose('existing');
    requestAnimationFrame(() => input?.focus());
  });
  requestAnimationFrame(() => document.getElementById('bs-title')?.focus());
}

// ═══════════════════════════════════════════════
// 모달 유틸리티
// ═══════════════════════════════════════════════

function attachModalDismiss(modal) {
  // ARIA 접근성
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  const cleanup = () => { modal.remove(); document.removeEventListener('keydown', escHandler); };
  const escHandler = (e) => { if (e.key === 'Escape') cleanup(); };
  // 배경 클릭으로 닫기
  modal.onclick = (e) => { if (e.target === modal) cleanup(); };
  // ESC 키로 닫기
  document.addEventListener('keydown', escHandler);
  // 외부에서 modal.remove() 호출 시에도 리스너 정리
  const observer = new MutationObserver(() => {
    if (!document.body.contains(modal)) { document.removeEventListener('keydown', escHandler); observer.disconnect(); }
  });
  observer.observe(document.body, { childList: true });
}

const PLATFORM_CONNECT_GUIDES = {
  blogspot: {
    id: 'blogspot',
    modalId: 'oneclick-blogger-oauth-guide-modal',
    title: '블로그스팟 앱 연동 따라하기',
    subtitle: '사용자가 해야 하는 흐름은 4단계로만 보여줍니다. 내부 자동화는 세부 화면을 감시하지만, 최종 완료 기준은 Client 저장이 아니라 OAuth 권한 승인까지입니다.',
    accent: '#FF7043',
    badgeBg: 'rgba(255,112,67,0.16)',
    badgeBorder: 'rgba(255,112,67,0.34)',
    note: '403 access_denied 방지 핵심: 앱을 게시하지 말고 테스트 상태로 두세요. 대신 OAuth 대상/Test users에 현재 로그인한 Gmail을 반드시 추가해야 합니다.',
    autoLabel: '블로그스팟 원클릭 연동 시작',
    steps: [
      { title: '프로젝트 + 외부/데스크톱 앱 만들기', desc: 'Chrome에서 Google Cloud 프로젝트를 만들거나 선택합니다. OAuth 동의 화면은 사용자 유형을 외부로 두고, OAuth Client는 데스크톱 앱으로 만듭니다.', btn: 'Cloud 열기', action: "window.__oneclickSetup?.openGoogleOAuthConsole('clients')", manual: true },
      { title: 'Blogger API + Client 값 저장', desc: 'Blogger API를 사용으로 켜고 Client ID/Secret을 블로그 플랫폼 설정 필드에 저장합니다. 자동 추출 결과도 같은 필드에 자동 반영됩니다.', btn: '플랫폼 필드', action: "window.__oneclickSetup?.openBloggerPlatformFields('googleClientId')", manual: true },
      { title: '테스트 사용자 Gmail 추가', desc: 'Google Auth Platform의 대상/Audience > Test users에 현재 로그인한 Gmail을 추가합니다. 앱 게시 버튼은 누르지 않습니다.', btn: '테스트 사용자', action: "window.__oneclickSetup?.openGoogleOAuthConsole('audience')", manual: true },
      { title: 'OAuth 인증 + Blog ID 확인', desc: '앱에서 OAuth 인증을 완료하고 Blogger 관리자 URL의 Blog ID를 블로그 플랫폼 필드에 자동 또는 수동 저장합니다. 여기까지 끝나야 발행 준비 완료입니다.', btn: '인증 시작', action: "window.__oneclickSetup?.saveBloggerOAuthCredentials(true)", manual: true },
    ],
  },
  wordpress: {
    id: 'wordpress',
    modalId: 'oneclick-wordpress-guide-modal',
    title: '워드프레스 앱 연동 따라하기',
    subtitle: '가이드 시작과 자동 연동이 같은 순서로 진행됩니다. 앱은 wp-admin과 프로필 화면을 열고, Application Password 생성/추출과 REST 검증까지 이어갑니다.',
    accent: '#38bdf8',
    badgeBg: 'rgba(14,165,233,0.16)',
    badgeBorder: 'rgba(14,165,233,0.34)',
    note: '완전 무인 자동화는 아닙니다. 관리자 로그인, 2FA, CAPTCHA, 보안 플러그인 확인, 한 번만 보이는 비밀번호 복사는 직접 처리해야 할 수 있습니다.',
    autoLabel: '가이드 순서대로 App Password 생성',
    steps: [
      { title: '사이트 URL 입력', desc: 'WordPress 주소를 입력합니다. /wp-admin이 붙어 있어도 앱이 자동 정리합니다.', btn: 'URL 입력칸', action: "document.getElementById('oneclick-wordpress-guide-modal')?.remove(); document.getElementById('oneclick-wp-site-url')?.focus()", manual: true },
      { title: 'wp-admin 로그인', desc: '앱이 관리자 로그인 화면을 엽니다. 보안 플러그인, 2FA, CAPTCHA가 나오면 직접 완료하세요.', btn: 'wp-admin 열기', action: "window.__oneclickSetup?.openWordPressAdmin('login')", manual: true },
      { title: '사용자명 확인', desc: '로그인 후 관리자명/사용자명을 자동 추출하고 입력칸에 반영합니다.', btn: '불러오기', action: "window.__oneclickSetup?.loadWordPressFields()", manual: false },
      { title: '프로필 열기', desc: '프로필 하단 Application Passwords 영역으로 이동합니다.', btn: '프로필 열기', action: "window.__oneclickSetup?.openWordPressAdmin('profile')", manual: false },
      { title: 'Application Password 생성', desc: '이름을 LEADERNAM Orbit 등으로 넣고 Add New Application Password를 누릅니다.', btn: 'App Password', action: "window.__oneclickSetup?.openWordPressAdmin('profile')", manual: true },
      { title: '비밀번호 복사', desc: '한 번만 표시되는 비밀번호를 앱 입력칸에 붙여넣습니다. 일반 로그인 비밀번호가 아닙니다.', btn: '입력칸 이동', action: "document.getElementById('oneclick-wordpress-guide-modal')?.remove(); document.getElementById('oneclick-wp-app-password')?.focus()", manual: true },
      { title: '저장 후 REST 검증', desc: '/wp-json/wp/v2/users/me로 REST 인증을 확인하고 발행 준비 상태를 저장합니다.', btn: '저장 후 검증', action: "window.__oneclickSetup?.saveWordPressCredentials(true)", manual: false },
    ],
  },
};

function normalizeConnectPlatformId(platformId) {
  return platformId === 'blogger' ? 'blogspot' : platformId;
}

function getConnectRuntimePlatformId(platformId) {
  return normalizeConnectPlatformId(platformId) === 'blogspot' ? 'blogger' : 'wordpress';
}

function getPlatformConnectGuide(platformId) {
  return PLATFORM_CONNECT_GUIDES[normalizeConnectPlatformId(platformId)];
}

function renderConnectStepRail(platformId, options = {}) {
  const guide = getPlatformConnectGuide(platformId);
  if (!guide) return '';
  const maxSteps = options.maxSteps || guide.steps.length;
  const steps = guide.steps.slice(0, maxSteps);
  const compact = Boolean(options.compact);
  const columns = compact ? 'repeat(auto-fit, minmax(136px, 1fr))' : 'repeat(auto-fit, minmax(168px, 1fr))';
  return `
    <div class="oneclick-connect-guide-rail" style="display:grid; grid-template-columns:${columns}; gap:8px; margin:${compact ? '8px 0 10px' : '12px 0'};">
      ${steps.map((step, index) => `
        <div style="min-width:0; padding:${compact ? '9px 10px' : '11px 12px'}; background:rgba(15,23,42,0.42); border:1px solid rgba(255,255,255,0.09); border-radius:10px;">
          <div style="display:flex; align-items:center; gap:7px; color:#f8fafc; font-size:${compact ? '10px' : '11px'}; font-weight:850;">
            <span style="width:20px; height:20px; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; border-radius:7px; background:${guide.badgeBg}; border:1px solid ${guide.badgeBorder}; color:${guide.accent}; font-size:10px; font-weight:900;">${index + 1}</span>
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(step.title)}</span>
            ${step.manual ? '<span style="flex-shrink:0; color:#fde68a; font-size:9px; font-weight:800;">직접</span>' : ''}
          </div>
          ${compact ? '' : `<div style="margin-top:5px; color:#94a3b8; font-size:10px; line-height:1.45;">${escapeHtml(step.desc)}</div>`}
        </div>
      `).join('')}
    </div>
    ${options.hideNote ? '' : `<div style="padding:9px 11px; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.23); border-radius:9px; color:#fde68a; font-size:11px; line-height:1.55;">${escapeHtml(guide.note)}</div>`}
  `;
}

function showUnifiedPlatformConnectGuide(platformId) {
  const guide = getPlatformConnectGuide(platformId);
  if (!guide) return;

  const existing = document.getElementById(guide.modalId);
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = guide.modalId;
  modal.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.72); backdrop-filter: blur(8px);
    z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 18px;
  `;

  const card = document.createElement('div');
  card.style.cssText = `
    width: min(860px, 96vw); max-height: 90vh; overflow-y: auto;
    background: linear-gradient(145deg, #172033, #0f172a); border: 1px solid rgba(255,255,255,0.13);
    border-radius: 18px; box-shadow: 0 28px 80px rgba(0,0,0,0.55); padding: 24px;
  `;

  card.innerHTML = `
    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:14px; margin-bottom:18px;">
      <div>
        <div style="font-size:19px; font-weight:900; color:white; letter-spacing:-0.2px;">${escapeHtml(guide.title)}</div>
        <div style="font-size:12px; color:#94a3b8; line-height:1.6; margin-top:5px;">${escapeHtml(guide.subtitle)}</div>
      </div>
      <button type="button" data-guide-close style="padding:8px 12px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12); color:#cbd5e1; border-radius:9px; cursor:pointer; font-size:12px; font-weight:700;">닫기</button>
    </div>

    <div style="display:flex; flex-direction:column; gap:10px;">
      ${guide.steps.map((step, index) => `
        <div style="display:grid; grid-template-columns:auto 1fr auto; gap:12px; align-items:center; padding:14px; background:rgba(255,255,255,0.045); border:1px solid rgba(255,255,255,0.08); border-radius:12px;">
          <div style="width:30px; height:30px; display:flex; align-items:center; justify-content:center; background:${guide.badgeBg}; border:1px solid ${guide.badgeBorder}; color:${guide.accent}; border-radius:9px; font-size:12px; font-weight:900;">${index + 1}</div>
          <div style="min-width:0;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <div style="font-size:13px; font-weight:850; color:#f8fafc;">${escapeHtml(step.title)}</div>
              ${step.manual ? '<span style="padding:2px 7px; background:rgba(245,158,11,0.14); border:1px solid rgba(245,158,11,0.26); border-radius:999px; color:#fde68a; font-size:10px; font-weight:800;">직접 확인</span>' : '<span style="padding:2px 7px; background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.24); border-radius:999px; color:#bbf7d0; font-size:10px; font-weight:800;">자동 시도</span>'}
            </div>
            <div style="font-size:11px; color:#cbd5e1; line-height:1.55; margin-top:3px;">${escapeHtml(step.desc)}</div>
          </div>
          <button type="button" onclick="${step.action}" style="padding:9px 11px; background:rgba(59,130,246,0.16); border:1px solid rgba(59,130,246,0.35); color:#bfdbfe; border-radius:9px; cursor:pointer; font-size:11px; font-weight:800; white-space:nowrap;">${escapeHtml(step.btn)}</button>
        </div>
      `).join('')}
    </div>

    <div style="margin-top:14px; padding:12px 14px; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.24); border-radius:11px; color:#fde68a; font-size:12px; line-height:1.65;">
      ${escapeHtml(guide.note)}
    </div>
    <div style="display:flex; flex-wrap:wrap; gap:10px; justify-content:flex-end; margin-top:14px;">
      <button type="button" data-account-add-start style="padding:11px 15px; background:linear-gradient(135deg,#8b5cf6,#6366f1); border:1px solid rgba(196,181,253,0.45); color:white; border-radius:10px; cursor:pointer; font-size:12px; font-weight:900; box-shadow:0 10px 26px rgba(99,102,241,0.24);">계정 추가 원클릭 시작</button>
      <button type="button" data-guide-close-secondary style="padding:11px 14px; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12); color:#cbd5e1; border-radius:10px; cursor:pointer; font-size:12px; font-weight:800;">나중에</button>
    </div>
  `;

  card.querySelector('[data-guide-close]')?.addEventListener('click', () => modal.remove());
  card.querySelector('[data-guide-close-secondary]')?.addEventListener('click', () => modal.remove());
  card.querySelector('[data-account-add-start]')?.addEventListener('click', () => {
    modal.remove();
    window.__oneclickSetup?.startOneclickAccountAddFlow?.(normalizeConnectPlatformId(platformId), 'connect');
  });
  modal.appendChild(card);
  document.body.appendChild(modal);
  attachModalDismiss(modal);
}

function showPlatformConnectGuide(platformId) {
  showUnifiedPlatformConnectGuide(platformId);
}

function showPlatformGuideHub() {
  const existing = document.getElementById('oneclick-platform-guide-hub-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'oneclick-platform-guide-hub-modal';
  modal.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.72); backdrop-filter: blur(8px);
    z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 18px;
  `;

  const card = document.createElement('div');
  card.style.cssText = `
    width: min(900px, 96vw); max-height: 90vh; overflow-y: auto;
    background: linear-gradient(145deg, #172033, #0f172a); border: 1px solid rgba(255,255,255,0.13);
    border-radius: 18px; box-shadow: 0 28px 80px rgba(0,0,0,0.55); padding: 24px;
  `;

  card.innerHTML = `
    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:14px; margin-bottom:18px;">
      <div>
        <div style="font-size:19px; font-weight:900; color:white;">앱 연동 통합 가이드</div>
        <div style="font-size:12px; color:#94a3b8; line-height:1.6; margin-top:5px;">가이드 시작, 빠른 준비, 자동 연동 버튼이 모두 아래와 같은 단계표를 사용합니다.</div>
      </div>
      <button type="button" data-guide-close style="padding:8px 12px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12); color:#cbd5e1; border-radius:9px; cursor:pointer; font-size:12px; font-weight:700;">닫기</button>
    </div>
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:14px;">
      ${['blogspot', 'wordpress'].map((id) => {
        const guide = getPlatformConnectGuide(id);
        return `
          <div style="padding:16px; background:rgba(255,255,255,0.045); border:1px solid rgba(255,255,255,0.09); border-radius:14px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px;">
              <div style="font-size:15px; font-weight:900; color:${guide.accent};">${escapeHtml(guide.title)}</div>
              <button type="button" onclick="document.getElementById('oneclick-platform-guide-hub-modal')?.remove(); window.__oneclickSetup?.showPlatformConnectGuide('${id}')" style="padding:7px 10px; background:${guide.badgeBg}; border:1px solid ${guide.badgeBorder}; color:#f8fafc; border-radius:8px; cursor:pointer; font-size:11px; font-weight:850;">가이드 열기</button>
            </div>
            ${renderConnectStepRail(id, { compact: true, hideNote: true })}
            <div style="margin-top:8px; color:#cbd5e1; font-size:11px; line-height:1.55;">${escapeHtml(guide.note)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  card.querySelector('[data-guide-close]')?.addEventListener('click', () => modal.remove());
  modal.appendChild(card);
  document.body.appendChild(modal);
  attachModalDismiss(modal);
}

const PLATFORMS = {
  blogspot: {
    id: 'blogspot',
    name: '블로그스팟',
    icon: '🔵',
    color: '#FF5722',
    gradient: 'linear-gradient(135deg, #FF5722 0%, #FF7043 100%)',

    adminUrl: 'https://www.blogger.com/',
    steps: [
      { id: 'login', title: 'Google 로그인', desc: '에드센스 계정과 동일한 Google 계정으로 로그인', action: '열린 Chrome 창에서 Blogger에 쓸 Google 계정으로 로그인하고, 2단계 인증/CAPTCHA가 나오면 완료하세요.', icon: '🔐', manual: true },
      { id: 'create-blog', title: '블로그 확인 또는 생성', desc: '목적에 따라 기존 블로그를 감지하거나 새 blogspot 주소로 블로그를 만듭니다', action: '새 블로그면 제목/주소를 확인하고, 기존 블로그면 목록에서 사용할 블로그를 한 번 선택하거나 Blog ID를 입력하세요.', icon: '📝', manual: true },
      { id: 'settings', title: '기초 설정 자동 최적화', desc: '검색엔진 표시, HTTPS, 시간대, 댓글, 이미지 최적화 등 기본 항목', action: '앱이 Blogger 설정 화면을 열고 항목이 실제로 보이는지 검사합니다. Chrome 창을 닫지 마세요.', icon: '⚙️', manual: false },
      { id: 'skin', title: '선택 테마스킨 적용', desc: '애드센스 승인형 또는 기존 클라우드 테마 CSS 자동 적용', action: '앱이 테마 HTML 편집기를 열고 b:skin 위치를 확인한 뒤 선택한 CSS를 삽입합니다. 저장 화면이 보이면 그대로 두세요.', icon: '🎨', manual: false },
      { id: 'done', title: '기초 세팅 완료!', desc: '발행은 앱 연동에서 OAuth와 Blog ID가 완료되면 가능합니다', action: '다음은 계정 추가 / 앱 연동에서 OAuth와 Blog ID를 완료하면 발행 준비가 끝납니다.', icon: '✅', manual: false },
    ]
  },
  wordpress: {
    id: 'wordpress',
    name: '워드프레스',
    icon: '🟣',
    color: '#21759B',
    gradient: 'linear-gradient(135deg, #21759B 0%, #0073AA 100%)',

    adminUrl: '', // 사용자별 다름
    steps: [
      { id: 'login', title: 'WP 관리자 로그인', desc: '브라우저에서 워드프레스 관리자 페이지에 로그인해주세요', chrome: 'wp-login.php 또는 wp-admin 로그인 화면', action: '열린 Chrome 창에서 관리자 계정으로 로그인하고 2FA/CAPTCHA/보안 플러그인 확인을 끝내세요.', ok: 'wp-admin 관리자바/좌측 메뉴/대시보드 문구가 확인됨', blocked: '로그인 화면에 머물면 직접 인증을 완료하세요. 보안 플러그인 화면이면 확인 절차를 끝내야 합니다.', icon: '🔐', manual: true },
      { id: 'theme', title: '테마 CSS 자동 적용', desc: '커스터마이저에서 리더남 스킨 CSS를 적용합니다', chrome: 'WordPress 커스터마이저 또는 추가 CSS 화면', action: '앱이 커스터마이저/추가 CSS 화면이 실제로 열렸는지 검사한 뒤 진행합니다.', ok: 'wp-admin 화면 근거와 추가 CSS 편집 영역 접근 확인', blocked: '커스터마이저가 막히면 관리자 권한, 테마 권한, 보안 플러그인 차단을 확인하세요.', icon: '🎨', manual: false },
      { id: 'plugins', title: '필수 플러그인 확인', desc: 'Classic Editor, Yoast SEO 등 필수 플러그인 페이지 확인', chrome: 'wp-admin/plugin-install.php 화면', action: '앱이 플러그인 설치 화면 접근 권한을 확인합니다. 권한/보안 플러그인에 막히면 안내에 따라 직접 확인하세요.', ok: '플러그인 설치 화면이 관리자 권한으로 열림', blocked: '플러그인 설치 메뉴가 없으면 관리자 권한 또는 호스팅 제한을 확인하세요.', icon: '🔌', manual: false },
      { id: 'permalink', title: '고유주소 설정', desc: 'SEO에 최적화된 고유주소 구조로 변경합니다', chrome: 'wp-admin/options-permalink.php 화면', action: '앱이 고유주소 설정 화면을 검증하고 글 이름 구조를 선택합니다.', ok: '고유주소 설정 화면 접근 및 글 이름 옵션 확인', blocked: '화면이 열리지 않으면 관리자 권한과 사이트 URL을 확인하세요.', icon: '🔗', manual: false },
      { id: 'naver-search', title: '네이버 서치어드바이저 등록', desc: '네이버 검색에 블로그를 등록합니다', chrome: 'searchadvisor.naver.com 로그인/사이트 등록 화면', action: '네이버 로그인이 필요하면 열린 창에서 직접 완료하세요.', ok: '사이트 등록 또는 이미 등록된 사이트 근거 확인', blocked: '네이버 로그인/소유확인 화면에서 멈추면 직접 인증을 완료하세요.', icon: '🔍', manual: true },
      { id: 'google-search-console', title: '구글 서치 콘솔 등록', desc: '구글 검색에 블로그를 등록합니다', chrome: 'Google Search Console 로그인/URL prefix 화면', action: 'Google 로그인이 필요하면 열린 창에서 직접 완료하세요.', ok: '사이트 등록 또는 사이트맵 제출 화면 접근 확인', blocked: '소유권 확인이 필요하면 안내된 HTML/meta/DNS 방식 중 가능한 방식으로 직접 완료하세요.', icon: '🔍', manual: true },
    ]
  }
};

// ═══════════════════════════════════════════════
// UI 렌더링
// ═══════════════════════════════════════════════

const LIVE_GUIDE_PANEL_ID = 'oneclick-live-guide-panel';
let liveGuideState = null;

function getLiveGuideSteps(kind, platformId) {
  if (kind === 'connect') {
    const guide = getPlatformConnectGuide(platformId);
    return (guide?.steps || []).map((step, index) => ({
      title: step.title,
      desc: step.desc,
      manual: Boolean(step.manual),
      icon: step.manual ? '☝' : '⚙',
      index,
    }));
  }

  if (kind === 'blogger-blog-id') {
    return [
      { title: 'Blogger 열기', desc: 'Blogger 관리자 화면을 열고 Google 로그인 상태를 확인합니다.', manual: false, icon: '↗', index: 0 },
      { title: '로그인 확인', desc: '로그인, 2단계 인증, CAPTCHA가 나오면 창을 닫지 말고 완료합니다.', manual: true, icon: '🔐', index: 1 },
      { title: 'Blog ID 찾기', desc: '블로그를 선택하면 앱이 URL과 화면에서 Blog ID를 자동으로 추출합니다.', manual: false, icon: '🔎', index: 2 },
    ];
  }

  if (kind === 'setup' && platformId === 'blogspot') {
    const purpose = activeSetup?.setupPurpose
      || window.__blogspotSetupConfig?.setupPurpose
      || 'create-new';
    const existingMode = purpose === 'existing';
    return [
      {
        title: 'Google 로그인',
        desc: 'Blogger에 쓸 Google 계정인지 확인합니다',
        chrome: 'accounts.google.com 로그인 화면 또는 Blogger 대시보드',
        action: '열린 Chrome 창에서 Google 로그인, 2단계 인증, CAPTCHA를 완료하세요. 완료 후 앱이 Blogger 화면 근거를 확인해야 다음으로 갑니다.',
        ok: 'Blogger 대시보드/블로그 목록/게시물 화면 중 하나가 실제로 감지됨',
        blocked: 'Google 도움말/계정 화면으로 빠지면 앱이 Blogger로 복구합니다. 다시 로그인 화면이면 인증을 완료하세요.',
        manual: true,
        icon: '🔐',
        index: 0,
      },
      existingMode
        ? {
          title: '기존 블로그 선택·감지',
          desc: '이미 만든 Blogger 블로그를 찾아 Blog ID와 설정 화면 접근을 검증합니다',
          chrome: 'Blogger 블로그 목록, 게시물 목록, 또는 설정 화면',
          action: 'Blogger 목록이 보이면 사용할 기존 블로그를 한 번 클릭하세요. Blog ID를 알고 있으면 입력해도 됩니다. 앱이 설정 화면 접근 근거를 확인해야 OK입니다.',
          ok: 'Blog ID 감지 후 /blog/settings/{Blog ID} 화면 접근과 설정 항목 근거가 확인됨',
          blocked: '다른 계정의 Blog ID이거나 목록에서 블로그를 선택하지 않으면 중단됩니다. 현재 로그인 계정의 블로그를 다시 선택하세요.',
          manual: true,
          icon: '🔎',
          index: 1,
        }
        : {
          title: '새 블로그 생성',
          desc: '입력한 제목과 blogspot 주소로 새 블로그를 만들고 Blog ID를 검증합니다',
          chrome: 'Blogger 새 블로그 만들기 창',
          action: '앱이 새 블로그 만들기 화면을 엽니다. 제목/주소가 비어 있거나 주소가 중복되면 멈추니 안내대로 수정하세요.',
          ok: '새 블로그 생성 후 Blog ID가 URL/링크에서 감지되고 해당 블로그 화면이 확인됨',
          blocked: '주소 중복, 제목/주소 누락, 생성 버튼 미노출이면 안내에 따라 주소를 바꾸거나 새 블로그 만들기 창을 직접 열어주세요.',
          manual: true,
          icon: '📝',
          index: 1,
        },
      {
        title: '기초 설정 검증·최적화',
        desc: '설정 화면이 실제로 열린 뒤 검색엔진, HTTPS, 시간대, 댓글 등을 점검합니다',
        chrome: 'Blogger 설정 화면',
        action: '앱이 Blogger 설정 화면의 HTTPS/검색엔진/댓글/시간대 항목을 확인합니다. 화면 근거가 없으면 다음으로 넘어가지 않습니다.',
        ok: '설정 URL과 HTTPS/검색엔진/댓글/시간대 등 설정 항목 근거 2개 이상 확인',
        blocked: '설정 화면이 안 뜨거나 권한이 없으면 현재 계정이 해당 블로그 관리자인지 확인하세요.',
        manual: false,
        icon: '⚙️',
        index: 2,
      },
      {
        title: '스킨 CSS 검증·적용',
        desc: '테마 HTML 편집기와 b:skin 삽입 위치를 확인한 뒤 스킨을 적용합니다',
        chrome: 'Blogger 테마 HTML 편집 화면',
        action: '앱이 HTML 편집기와 b:skin 위치를 검증합니다. 편집기가 안 뜨면 저장 완료로 처리하지 않고 멈춥니다.',
        ok: 'CodeMirror/textarea/HTML 편집기와 ]]></b:skin> 삽입 위치가 확인되고 스킨 마커가 저장됨',
        blocked: '테마 편집 권한이나 화면 로딩이 막히면 HTML 편집 화면이 보이는지 확인한 뒤 재시도하세요.',
        manual: false,
        icon: '🎨',
        index: 3,
      },
      {
        title: '완료 확인',
        desc: existingMode ? '기존 블로그 점검과 기본 최적화가 완료됩니다' : '새 블로그 생성과 기본 최적화가 완료됩니다',
        chrome: 'Blogger 설정/테마 적용 완료 상태',
        action: '이후 발행 전에는 계정 추가 / 앱 연동에서 OAuth와 Blog ID까지 완료하세요.',
        ok: '로그인, 블로그 확인/생성, 설정 검증, 스킨 검증이 모두 OK',
        blocked: '하나라도 실패하면 완료가 아니라 실패 단계에서 멈춥니다.',
        manual: false,
        icon: '✅',
        index: 4,
      },
    ];
  }

  const platform = PLATFORMS[platformId];
  return (platform?.steps || []).map((step, index) => ({
    title: step.title,
    desc: step.desc,
    action: step.action,
    chrome: step.chrome,
    ok: step.ok,
    blocked: step.blocked,
    manual: Boolean(step.manual),
    icon: step.icon || (step.manual ? '☝' : '⚙'),
    index,
  }));
}

function getLiveGuideLabels(kind, platformId) {
  if (kind === 'connect') {
    const guide = getPlatformConnectGuide(platformId);
    return {
      title: `${guide?.title || '앱 연동'} 진행 가이드`,
      subtitle: 'Chrome 창은 닫지 마세요. 완료된 단계는 초록색으로 바뀌고, 필요한 사용자 행동만 차례대로 안내합니다.',
      accent: guide?.accent || '#8b5cf6',
    };
  }

  if (kind === 'blogger-blog-id') {
    return {
      title: 'Blog ID 자동 가져오기',
    subtitle: 'Chrome 창은 닫지 마세요. 로그인과 블로그 선택을 완료하면 앱이 자동으로 다음 단계로 넘어갑니다.',
      accent: '#ff5722',
    };
  }

  const platform = PLATFORMS[platformId];
  return {
    title: `${platform?.name || '원클릭'} 세팅 가이드`,
    subtitle: 'Chrome 창은 닫지 마세요. 완료된 단계는 초록색으로 바뀌고 다음 단계로 자동 이동합니다.',
    accent: platform?.color || '#8b5cf6',
  };
}

function getLiveGuideStatusMeta(state) {
  if (state === 'done') {
    return { icon: '✓', label: '완료', bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.36)', color: '#86efac', dot: 'linear-gradient(135deg,#10b981,#059669)' };
  }
  if (state === 'waiting') {
    return { icon: '!', label: '사용자 확인', bg: 'rgba(245,158,11,0.13)', border: 'rgba(245,158,11,0.36)', color: '#fde68a', dot: 'linear-gradient(135deg,#f59e0b,#d97706)' };
  }
  if (state === 'error') {
    return { icon: '×', label: '확인 필요', bg: 'rgba(239,68,68,0.13)', border: 'rgba(239,68,68,0.36)', color: '#fca5a5', dot: 'linear-gradient(135deg,#ef4444,#dc2626)' };
  }
  if (state === 'running') {
    return { icon: '…', label: '진행 중', bg: 'rgba(59,130,246,0.13)', border: 'rgba(59,130,246,0.36)', color: '#bfdbfe', dot: 'linear-gradient(135deg,#3b82f6,#2563eb)' };
  }
  return { icon: '', label: '대기', bg: 'rgba(15,23,42,0.52)', border: 'rgba(148,163,184,0.18)', color: '#94a3b8', dot: 'rgba(100,116,139,0.35)' };
}

function ensureLiveGuidePanel(kind, platformId, options = {}) {
  const steps = options.steps || getLiveGuideSteps(kind, platformId);
  const labels = getLiveGuideLabels(kind, platformId);
  let panel = document.getElementById(LIVE_GUIDE_PANEL_ID);

  if (!panel || liveGuideState?.kind !== kind || liveGuideState?.platformId !== platformId) {
    panel?.remove();
    panel = document.createElement('aside');
    panel.id = LIVE_GUIDE_PANEL_ID;
    panel.setAttribute('aria-live', 'polite');
    panel.style.cssText = `
      position: fixed; right: 18px; top: 82px; width: min(430px, calc(100vw - 28px));
      max-height: calc(100vh - 108px); z-index: 99998; display: flex; flex-direction: column;
      background: linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98));
      border: 1px solid rgba(255,255,255,0.14); border-radius: 18px;
      box-shadow: 0 26px 90px rgba(0,0,0,0.48), 0 0 0 1px rgba(255,255,255,0.04) inset;
      overflow: hidden; backdrop-filter: blur(18px);
    `;
    panel.innerHTML = `
      <div style="padding:15px 16px 13px; border-bottom:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.035);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
          <div style="min-width:0;">
            <div style="font-size:15px; font-weight:900; color:#f8fafc; line-height:1.35;">${escapeHtml(labels.title)}</div>
            <div style="margin-top:4px; font-size:11px; color:#94a3b8; line-height:1.45;">${escapeHtml(labels.subtitle)}</div>
          </div>
          <div style="display:flex; gap:6px; flex-shrink:0;">
            <button type="button" data-live-minimize title="가이드 접기" style="width:30px; height:30px; border-radius:9px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.07); color:#cbd5e1; cursor:pointer; font-size:14px; font-weight:800;">−</button>
            <button type="button" data-live-close title="가이드 닫기" style="width:30px; height:30px; border-radius:9px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.07); color:#cbd5e1; cursor:pointer; font-size:14px; font-weight:800;">×</button>
          </div>
        </div>
        <div style="margin-top:12px; height:8px; background:rgba(148,163,184,0.18); border-radius:999px; overflow:hidden;">
          <div data-live-progress style="height:100%; width:0%; background:linear-gradient(90deg, ${labels.accent}, #22c55e); border-radius:999px; transition:width .28s ease;"></div>
        </div>
      </div>
      <div data-live-body style="overflow-y:auto; padding:14px; display:flex; flex-direction:column; gap:10px;">
        <div data-live-current style="padding:12px 13px; border-radius:13px; background:rgba(59,130,246,0.10); border:1px solid rgba(59,130,246,0.28);">
          <div data-live-current-title style="font-size:13px; font-weight:900; color:#f8fafc;">준비 중</div>
          <div data-live-current-msg style="margin-top:5px; font-size:12px; line-height:1.55; color:#bfdbfe;">자동화 상태를 확인하고 있습니다.</div>
          <div data-live-current-action style="margin-top:9px; padding:8px 9px; border-radius:9px; background:rgba(2,6,23,0.38); color:#e0f2fe; font-size:11px; line-height:1.5;">지금 할 일: 앱 안내를 기다려주세요.</div>
        </div>
        <div data-live-steps style="display:flex; flex-direction:column; gap:8px;"></div>
      </div>
    `;
    document.body.appendChild(panel);
    panel.querySelector('[data-live-close]')?.addEventListener('click', () => {
      panel.remove();
      liveGuideState = null;
    });
    panel.querySelector('[data-live-minimize]')?.addEventListener('click', () => {
      const body = panel.querySelector('[data-live-body]');
      const hidden = body.style.display === 'none';
      body.style.display = hidden ? 'flex' : 'none';
      panel.querySelector('[data-live-minimize]').textContent = hidden ? '−' : '+';
    });
  }

  const previousStep = liveGuideState?.kind === kind && liveGuideState?.platformId === platformId
    ? liveGuideState.currentStep
    : undefined;
  liveGuideState = { kind, platformId, steps, currentStep: previousStep };
  renderLiveGuideSteps(panel, steps);
  return panel;
}

function renderLiveGuideSteps(panel, steps) {
  const host = panel.querySelector('[data-live-steps]');
  if (!host) return;
  host.innerHTML = steps.map((step, index) => `
    <div data-live-step="${index}" style="display:grid; grid-template-columns:auto 1fr auto; gap:10px; align-items:center; padding:11px; border-radius:12px; background:rgba(15,23,42,0.52); border:1px solid rgba(148,163,184,0.18); transition:all .22s ease;">
      <div data-live-step-dot="${index}" style="width:28px; height:28px; border-radius:9px; display:flex; align-items:center; justify-content:center; background:rgba(100,116,139,0.35); color:#cbd5e1; font-size:12px; font-weight:900;">${index + 1}</div>
      <div style="min-width:0;">
        <div style="display:flex; gap:7px; align-items:center; min-width:0;">
          <span style="font-size:13px; flex-shrink:0;">${escapeHtml(step.icon || '')}</span>
          <span style="font-size:12px; font-weight:850; color:#f8fafc; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(step.title)}</span>
          ${step.manual ? '<span style="flex-shrink:0; padding:2px 6px; border-radius:999px; background:rgba(245,158,11,0.14); border:1px solid rgba(245,158,11,0.28); color:#fde68a; font-size:9px; font-weight:850;">직접</span>' : ''}
        </div>
        <div style="margin-top:3px; font-size:10px; line-height:1.45; color:#94a3b8;">${escapeHtml(step.desc || '')}</div>
        ${step.chrome ? `<div style="margin-top:4px; font-size:10px; line-height:1.45; color:#bae6fd;">Chrome: ${escapeHtml(step.chrome)}</div>` : ''}
        ${step.action ? `<div style="margin-top:4px; font-size:10px; line-height:1.45; color:#c4b5fd;">할 일: ${escapeHtml(step.action)}</div>` : ''}
        ${step.ok ? `<div style="margin-top:4px; font-size:10px; line-height:1.45; color:#bbf7d0;">OK: ${escapeHtml(step.ok)}</div>` : ''}
        ${step.blocked ? `<div style="margin-top:4px; font-size:10px; line-height:1.45; color:#fed7aa;">막히면: ${escapeHtml(step.blocked)}</div>` : ''}
      </div>
      <div data-live-step-label="${index}" style="font-size:10px; font-weight:850; color:#94a3b8; white-space:nowrap;">대기</div>
    </div>
  `).join('');
}

function normalizeLiveGuideDisplayStatus(kind, platformId, status, stepCount) {
  const normalized = normalizeConnectPlatformId(platformId);
  if (kind !== 'connect' || normalized !== 'blogspot' || stepCount !== 4) {
    return status;
  }

  const rawStep = Number(status.currentStep);
  if (!Number.isFinite(rawStep)) {
    return { ...status, totalSteps: stepCount };
  }

  let currentStep = 0;
  if (rawStep <= 1) currentStep = 0;
  else if (rawStep <= 2) currentStep = 1;
  else if (rawStep <= 4) currentStep = 2;
  else currentStep = 3;

  return {
    ...status,
    currentStep,
    totalSteps: stepCount,
  };
}

function renderLiveGuideActionHtml(step, fallbackAction = '') {
  const rows = [
    { label: 'Chrome 화면', value: step.chrome },
    { label: '사용자 행동', value: step.action || fallbackAction || step.desc },
    { label: 'OK 기준', value: step.ok },
    { label: '막히면', value: step.blocked },
  ].filter(row => row.value);

  if (!rows.length) {
    return `<div><strong style="color:#bfdbfe;">지금 할 일</strong>: ${escapeHtml(fallbackAction || '앱 안내를 기다려주세요.')}</div>`;
  }

  return rows.map(row => `
    <div style="margin-top:4px;">
      <strong style="color:#bfdbfe;">${escapeHtml(row.label)}</strong>
      <span style="color:#e5e7eb;">: ${escapeHtml(row.value)}</span>
    </div>
  `).join('');
}

function updateLiveOneclickGuide(kind, platformId, status = {}) {
  const panel = ensureLiveGuidePanel(kind, platformId);
  if (!panel || !liveGuideState) return;

  const steps = liveGuideState.steps || [];
  const displayStatus = normalizeLiveGuideDisplayStatus(kind, platformId, status, steps.length);
  const total = Math.max(steps.length, Number(displayStatus.totalSteps) || 0, 1);
  const currentStepRaw = Number(displayStatus.currentStep);
  const currentStep = Number.isFinite(currentStepRaw) ? Math.max(0, Math.min(currentStepRaw, total - 1)) : 0;
  liveGuideState.currentStep = currentStep;
  const completed = Boolean(displayStatus.completed);
  const error = displayStatus.error || null;
  const stepStatus = displayStatus.stepStatus || 'running';

  steps.forEach((_, index) => {
    let state = 'idle';
    if (completed || index < currentStep) state = 'done';
    else if (error && index === currentStep) state = 'error';
    else if (index === currentStep) {
      state = stepStatus === 'done' ? 'done' : stepStatus === 'waiting-login' ? 'waiting' : stepStatus === 'error' ? 'error' : 'running';
    }

    const meta = getLiveGuideStatusMeta(state);
    const row = panel.querySelector(`[data-live-step="${index}"]`);
    const dot = panel.querySelector(`[data-live-step-dot="${index}"]`);
    const label = panel.querySelector(`[data-live-step-label="${index}"]`);
    if (row) {
      row.style.background = meta.bg;
      row.style.borderColor = meta.border;
    }
    if (dot) {
      dot.textContent = meta.icon || String(index + 1);
      dot.style.background = meta.dot;
      dot.style.color = state === 'idle' ? '#cbd5e1' : '#fff';
    }
    if (label) {
      label.textContent = meta.label;
      label.style.color = meta.color;
    }
  });

  const activeStep = steps[currentStep] || steps[steps.length - 1] || { title: '진행 중', desc: '' };
  const currentTitle = panel.querySelector('[data-live-current-title]');
  const currentMsg = panel.querySelector('[data-live-current-msg]');
  const currentAction = panel.querySelector('[data-live-current-action]');
  const progress = panel.querySelector('[data-live-progress]');
  const currentBox = panel.querySelector('[data-live-current]');
  const activeMeta = getLiveGuideStatusMeta(error ? 'error' : completed ? 'done' : stepStatus === 'waiting-login' ? 'waiting' : 'running');

  if (currentTitle) currentTitle.textContent = completed ? '모든 단계 완료' : error ? '확인이 필요한 단계' : activeStep.title;
  if (currentMsg) currentMsg.textContent = error || displayStatus.message || activeStep.desc || '다음 상태를 기다리는 중입니다.';
  if (currentAction) {
    if (completed) {
      currentAction.innerHTML = '<strong style="color:#bbf7d0;">완료</strong>: 필요한 값은 앱 설정에 저장되었습니다. 다음 필수 단계가 있으면 계정 추가 / 앱 연동을 진행하세요.';
      currentAction.style.color = '#bbf7d0';
    } else if (error) {
      currentAction.innerHTML = '<strong style="color:#fecaca;">확인 필요</strong>: 안내 문구를 확인하고 Chrome 창에서 빠진 로그인, 권한, 블로그 선택, 입력 단계를 보완하세요.';
      currentAction.style.color = '#fecaca';
    } else if (stepStatus === 'waiting-login' || activeStep.manual) {
      currentAction.innerHTML = renderLiveGuideActionHtml(activeStep, '열린 Chrome 창에서 요청된 로그인/권한 승인/저장을 완료하세요.');
      currentAction.style.color = '#fde68a';
    } else {
      currentAction.innerHTML = renderLiveGuideActionHtml(activeStep, '앱이 자동으로 확인 중입니다. Chrome 창을 닫지 말고 잠시 기다려주세요.');
      currentAction.style.color = '#e0f2fe';
    }
  }
  if (currentBox) {
    currentBox.style.background = activeMeta.bg;
    currentBox.style.borderColor = activeMeta.border;
  }
  if (progress) {
    const doneCount = completed ? total : Math.min(currentStep + (stepStatus === 'done' ? 1 : 0), total);
    progress.style.width = `${Math.max(0, Math.min(100, Math.round((doneCount / total) * 100)))}%`;
  }
}

function finishLiveOneclickGuide(kind, platformId, message, ok = true) {
  const fallbackStep = Number.isFinite(Number(liveGuideState?.currentStep)) ? liveGuideState.currentStep : 0;
  updateLiveOneclickGuide(kind, platformId, {
    currentStep: ok ? 999 : fallbackStep,
    stepStatus: ok ? 'done' : 'error',
    completed: ok,
    error: ok ? null : message,
    message,
  });
}

let liveGuideDemoRunId = 0;

function waitForDemo(ms, runId) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(runId === liveGuideDemoRunId), ms);
  });
}

function focusOneclickControl(id) {
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => {
    try { el.focus?.(); } catch {}
  }, 250);
  return true;
}

async function openOneclickExternalUrl(url) {
  if (!url) return false;
  if (window.electronAPI?.openLink) {
    await window.electronAPI.openLink(url);
    return true;
  }
  if (window.electronAPI?.openExternal) {
    await window.electronAPI.openExternal(url);
    return true;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

async function openOneclickPracticeStep(kind, platformId, step, index) {
  const normalized = normalizeConnectPlatformId(platformId);

  try {
    if (kind === 'connect' && normalized === 'blogspot') {
      if (index === 0) {
        openGoogleOAuthConsole('clients');
        return 'Google Cloud OAuth 클라이언트 화면을 열었습니다. 프로젝트 생성 후 사용자 유형은 외부, 클라이언트 유형은 데스크톱 앱으로 만드세요.';
      }
      if (index === 1) {
        openGoogleOAuthConsole('bloggerApi');
        openBloggerPlatformFields('googleClientId');
        return 'Blogger API v3 사용 화면을 열었습니다. Client ID/Secret은 블로그 플랫폼 필드에 정확히 붙여넣으세요.';
      }
      if (index === 2) {
        openGoogleOAuthConsole('audience');
        return 'Google 인증 플랫폼 Audience/Test users 화면을 열었습니다. 앱 게시 없이 현재 Gmail을 테스트 사용자로 추가하세요.';
      }
      if (index === 3) {
        openBloggerPlatformFields('blogId');
        await openOneclickExternalUrl('https://www.blogger.com/');
        return '블로그 플랫폼 필드로 돌아와 OAuth 인증을 진행하고, Blogger 관리자에서 Blog ID를 복사해 저장하세요.';
      }
      openBloggerPlatformFields('googleClientId');
      return '블로그 플랫폼 필드로 돌아왔습니다. Client ID/Secret/Blog ID를 확인한 뒤 저장 후 인증을 누르세요.';
    }

    if (kind === 'connect' && normalized === 'wordpress') {
      if (index === 0) {
        focusOneclickControl('oneclick-wp-site-url');
        return 'WordPress 사이트 URL 입력칸으로 이동했습니다.';
      }
      if (index === 1) {
        await openWordPressAdmin('login');
        return 'WordPress 관리자 로그인 화면을 열었습니다.';
      }
      if (index === 2 || index === 3 || index === 4) {
        await openWordPressAdmin('profile');
        return 'WordPress 프로필의 Application Password 구간을 열었습니다.';
      }
      focusOneclickControl('oneclick-wp-app-password');
      return '앱 입력칸으로 돌아와 Application Password 붙여넣기 구간을 보여줍니다.';
    }

    if (kind === 'blogger-blog-id') {
      await openOneclickExternalUrl('https://www.blogger.com/');
      return 'Blogger 관리자 화면을 열었습니다. 블로그를 선택하면 앱이 Blog ID를 자동으로 찾습니다.';
    }

    if (kind === 'setup' && platformId === 'blogspot') {
      if (index <= 5) {
        await openOneclickExternalUrl('https://www.blogger.com/');
        return `${step.title} 단계 재현을 위해 Blogger 관리자 화면을 열었습니다.`;
      }
      if (index === 6) {
        await openOneclickExternalUrl('https://search.google.com/search-console');
        return 'Google Search Console 화면을 열었습니다.';
      }
      return 'Blogspot 세팅 완료 화면 예시로 이동합니다.';
    }

    if (kind === 'setup' && platformId === 'wordpress') {
      if (index === 0) {
        await openWordPressAdmin('login');
        return 'WordPress 관리자 로그인 화면을 열었습니다.';
      }
      if (index <= 3) {
        await openWordPressAdmin('login');
        return `${step.title} 단계 재현을 위해 WordPress 관리자 화면을 열었습니다.`;
      }
      if (index === 4) {
        await openOneclickExternalUrl('https://searchadvisor.naver.com/');
        return '네이버 서치어드바이저 화면을 열었습니다.';
      }
      if (index === 5) {
        await openOneclickExternalUrl('https://search.google.com/search-console');
        return 'Google Search Console 화면을 열었습니다.';
      }
    }
  } catch (e) {
    return `화면 열기에 실패했습니다: ${e?.message || e}`;
  }

  return '';
}

async function startOneclickGuideDemo(kind = 'connect', platformId = 'blogspot') {
  const runningOp = isAnyOperationRunning();
  if (runningOp) {
    showToast(`진행 중인 작업(${runningOp})이 끝난 뒤 단계 미리보기를 실행해주세요.`, 'warn', 6000);
    return;
  }

  const runId = ++liveGuideDemoRunId;
  const steps = getLiveGuideSteps(kind, platformId);
  const demoTitleMap = {
    setup: '원클릭 세팅',
    connect: '앱 연동',
    'blogger-blog-id': 'Blog ID 자동 가져오기',
  };
  const demoName = `${demoTitleMap[kind] || '가이드'} 단계 미리보기`;
  const ok = window.confirm?.(
    `${demoName}는 실제 Chrome/브라우저 탭을 순서대로 엽니다.\n\n`
    + '앱 저장값은 자동으로 변경하지 않습니다. 단, Google/WordPress 화면에서 사용자가 직접 만들기/저장 버튼을 누르면 실제 계정에는 반영될 수 있습니다.\n\n'
    + '처음 세팅하는 흐름을 먼저 미리 볼까요?'
  );
  if (ok === false) return;

  ensureLiveGuidePanel(kind, platformId, { steps });
  showToast(`${demoName}를 시작합니다. 실제 화면을 열되 앱 저장값은 변경하지 않습니다.`, 'info', 6000);
  addLog?.(`[원클릭] ${demoName} 시작 (브라우저 화면 재현, 저장값 미변경)`);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    updateLiveOneclickGuide(kind, platformId, {
      currentStep: i,
      totalSteps: steps.length,
      stepStatus: 'running',
      message: `단계 미리보기: ${step.title} 화면을 엽니다.`,
    });
    if (!(await waitForDemo(900, runId))) return;
    const screenMessage = await openOneclickPracticeStep(kind, platformId, step, i);
    if (screenMessage) {
      updateLiveOneclickGuide(kind, platformId, {
        currentStep: i,
        totalSteps: steps.length,
        stepStatus: step.manual ? 'waiting-login' : 'running',
        message: screenMessage,
      });
    }
    if (!(await waitForDemo(step.manual ? 1800 : 1100, runId))) return;

    if (step.manual) {
      updateLiveOneclickGuide(kind, platformId, {
        currentStep: i,
        totalSteps: steps.length,
        stepStatus: 'waiting-login',
        message: `사용자가 직접 처리하는 구간입니다. 로그인, 권한 승인, 테스트 사용자 추가, 복사/붙여넣기 같은 행동이 필요한 단계입니다.`,
      });
      if (!(await waitForDemo(1700, runId))) return;
    }

    updateLiveOneclickGuide(kind, platformId, {
      currentStep: i,
      totalSteps: steps.length,
      stepStatus: 'done',
      message: `${step.title} 완료 처리 예시입니다.`,
    });
    if (!(await waitForDemo(700, runId))) return;
  }

  finishLiveOneclickGuide(kind, platformId, `${demoName}가 완료되었습니다. 앱 저장값은 자동 변경하지 않았습니다.`, true);
  showToast(`${demoName} 완료`, 'success', 4000);
}

async function startOneclickAccountAddFlow(platformId = 'blogspot', kind = 'connect') {
  const runningOp = isAnyOperationRunning();
  if (runningOp) {
    showToast(`진행 중인 작업(${runningOp})이 끝난 뒤 계정 추가를 다시 시작해주세요.`, 'warn', 6000);
    return;
  }

  const normalized = normalizeConnectPlatformId(platformId);
  const runtimePlatformId = getConnectRuntimePlatformId(normalized);
  const titleMap = {
    setup: normalized === 'wordpress' ? 'WordPress 새 사이트 세팅' : 'Blogspot 새 블로그 세팅',
    connect: normalized === 'wordpress' ? 'WordPress 계정 추가' : 'Blogspot 계정 추가',
    'blogger-blog-id': 'Blogger Blog ID 자동 가져오기',
  };
  const modeName = titleMap[kind] || '계정 추가';
  const ok = window.confirm?.(
    `${modeName}를 시작합니다.\n\n`
    + '이 흐름은 처음 세팅하는 사용자와 같은 순서로 진행됩니다. 앱의 단계별 가이드가 옆에서 다음 행동을 안내하고, 완료된 단계는 자동으로 체크됩니다.\n\n'
    + '- Chrome/Edge/자동화 브라우저 창이 실제로 열립니다.\n'
    + '- 로그인, 2FA, CAPTCHA, 권한 승인 구간은 사용자가 직접 처리할 때까지 기다립니다.\n'
    + '- 성공하면 앱 설정에 새 계정 정보가 저장되거나 실제 계정 설정이 변경될 수 있습니다.\n\n'
    + '계속 진행할까요?'
  );
  if (ok === false) return;

  addLog?.(`[원클릭] ${modeName} 흐름 시작`);
  showToast(`${modeName}를 시작합니다. 브라우저 창을 닫지 말고, 오른쪽 가이드 순서대로 진행해주세요.`, 'info', 7000);

  if (kind === 'setup') {
    document.getElementById(`oneclick-card-${normalized}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    ensureLiveGuidePanel('setup', normalized);
    await startSetup(normalized, { accountAddMode: true, forceFirstRun: true });
    return;
  }

  if (kind === 'connect') {
    document.getElementById(`oneclick-connect-card-${runtimePlatformId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    ensureLiveGuidePanel('connect', runtimePlatformId);
    await startPlatformConnect(runtimePlatformId, { accountAddMode: true, forceFirstRun: true });
    return;
  }

  if (kind === 'blogger-blog-id') {
    document.getElementById('oneclick-blogger-oauth-helper')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    ensureLiveGuidePanel('blogger-blog-id', 'blogger-blog-id');
    await startBloggerBlogIdExtract({ accountAddMode: true });
  }
}

async function startOneclickFilmingMode(kind = 'connect', platformId = 'blogspot') {
  return startOneclickAccountAddFlow(platformId, kind);
}

function stopOneclickGuideDemo() {
  liveGuideDemoRunId++;
  if (!liveGuideState) {
    showToast('진행 중인 계정 추가 가이드가 없습니다.', 'info', 3000);
    return;
  }
  finishLiveOneclickGuide(liveGuideState?.kind || 'connect', liveGuideState?.platformId || 'blogspot', '계정 추가 가이드를 중지했습니다.', false);
}

function renderBeginnerPathCard() {
  return `
    <div id="oneclick-beginner-path-card" style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(168, 85, 247, 0.32); border-radius: 16px; padding: 20px;">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:14px; margin-bottom:14px;">
        <div style="display:flex; align-items:flex-start; gap:12px;">
          <div style="width:40px; height:40px; background:linear-gradient(135deg,#8b5cf6,#6366f1); border-radius:12px; display:flex; align-items:center; justify-content:center; box-shadow:0 8px 24px rgba(139,92,246,0.25);">
            <span style="font-size:20px;">🧭</span>
          </div>
          <div>
            <h4 style="margin:0; font-weight:900; color:white; font-size:16px; letter-spacing:-0.2px;">처음 세팅이면 이 순서대로 진행하세요</h4>
            <p style="margin:4px 0 0; font-size:12px; color:#c4b5fd; line-height:1.55;">
              블로그가 아직 없으면 먼저 블로그를 만들고, 그 다음 계정 추가/앱 연동을 진행합니다.
              이미 운영 중인 블로그가 있다면 1단계는 건너뛰고 2단계부터 시작하면 됩니다.
            </p>
          </div>
        </div>
        <button type="button" onclick="window.__oneclickSetup?.stopOneclickGuideDemo()"
          style="padding:9px 12px; background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.32); color:#fecaca; border-radius:10px; font-size:12px; font-weight:800; cursor:pointer; white-space:nowrap;">
          진행 중지
        </button>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:10px;">
        <button type="button" onclick="document.getElementById('oneclick-card-blogspot')?.scrollIntoView({ behavior: 'smooth', block: 'center' })"
          style="text-align:left; padding:14px; background:rgba(249,115,22,0.12); border:1px solid rgba(249,115,22,0.28); border-radius:12px; color:#fff7ed; cursor:pointer;">
          <div style="color:#fdba74; font-size:11px; font-weight:900; margin-bottom:6px;">STEP 1</div>
          <div style="font-size:14px; font-weight:900;">새 블로그/사이트 준비</div>
          <div style="margin-top:5px; font-size:11px; color:#fed7aa; line-height:1.45;">블로그스팟은 이름과 주소를 정하고, 워드프레스는 사이트 준비를 확인합니다.</div>
        </button>
        <button type="button" onclick="document.getElementById('oneclick-connect-card-blogger')?.scrollIntoView({ behavior: 'smooth', block: 'center' })"
          style="text-align:left; padding:14px; background:rgba(139,92,246,0.12); border:1px solid rgba(139,92,246,0.30); border-radius:12px; color:#f5f3ff; cursor:pointer;">
          <div style="color:#c4b5fd; font-size:11px; font-weight:900; margin-bottom:6px;">STEP 2</div>
          <div style="font-size:14px; font-weight:900;">계정 추가 / 앱 연동</div>
          <div style="margin-top:5px; font-size:11px; color:#ddd6fe; line-height:1.45;">OAuth, 테스트 사용자, Blog ID, App Password를 가이드와 함께 연결합니다.</div>
        </button>
        <button type="button" onclick="document.getElementById('oneclick-webmaster-url')?.scrollIntoView({ behavior: 'smooth', block: 'center' })"
          style="text-align:left; padding:14px; background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.30); border-radius:12px; color:#fffbeb; cursor:pointer;">
          <div style="color:#fde68a; font-size:11px; font-weight:900; margin-bottom:6px;">STEP 3</div>
          <div style="font-size:14px; font-weight:900;">검색 등록 / 최종 세팅</div>
          <div style="margin-top:5px; font-size:11px; color:#fef3c7; line-height:1.45;">사이트맵, RSS, 검색엔진 등록을 이어서 진행합니다.</div>
        </button>
      </div>
    </div>
  `;
}

function renderBlogspotCreationExamples() {
  const examples = [
    {
      type: '정부지원금 정보형',
      title: '리더남의 지원금 알림장',
      address: 'support-checklist-note',
      topics: '정부24, 보조금24, 신청방법, 자격조건',
      note: '공식 정보 기반 글과 표/FAQ 구성이 잘 맞습니다.'
    },
    {
      type: '생활경제/절약형',
      title: '생활비 절약 연구소',
      address: 'smart-save-lab',
      topics: '통신비, 카드혜택, 환급금, 공과금',
      note: '초보자도 키워드를 넓게 확장하기 쉽습니다.'
    },
    {
      type: '취업/자격증형',
      title: '자격증 로드맵 노트',
      address: 'license-roadmap-note',
      topics: '자격증 일정, 응시자격, 합격전략',
      note: '일정/조건/준비물처럼 구조화된 글에 좋습니다.'
    },
    {
      type: '여행 체크리스트형',
      title: '여행 준비 체크리스트',
      address: 'trip-ready-checklist',
      topics: '준비물, 교통패스, 안전정보',
      note: 'CTA와 외부유입 글 연결을 만들기 쉽습니다.'
    },
  ];

  return `
    <div style="margin-bottom:14px; padding:14px; background:rgba(255,112,67,0.10); border:1px solid rgba(255,112,67,0.28); border-radius:12px;">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:10px;">
        <div>
          <div style="font-size:13px; font-weight:900; color:#fed7aa;">새 블로그 이름·주소 예시</div>
          <div style="margin-top:3px; font-size:11px; color:#ffedd5; line-height:1.5;">
            막막하면 아래 예시처럼 “넓은 주제 + 정보형 이름”으로 시작하세요. 주소는 영어 소문자, 짧은 단어 조합을 권장합니다.
          </div>
        </div>
        <span style="flex-shrink:0; padding:4px 8px; border-radius:999px; background:rgba(251,191,36,0.14); border:1px solid rgba(251,191,36,0.28); color:#fde68a; font-size:10px; font-weight:900;">초보 추천</span>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:8px;">
        ${examples.map((item) => `
          <div style="padding:11px 12px; background:rgba(15,23,42,0.48); border:1px solid rgba(255,255,255,0.08); border-radius:10px;">
            <div style="font-size:10px; color:#fdba74; font-weight:900;">${item.type}</div>
            <div style="margin-top:4px; font-size:13px; color:#fff7ed; font-weight:900;">${item.title}</div>
            <div style="margin-top:5px; font-size:11px; color:#93c5fd; font-weight:800;">${item.address}.blogspot.com</div>
            <div style="margin-top:6px; font-size:10px; color:#cbd5e1; line-height:1.45;">주제: ${item.topics}</div>
            <div style="margin-top:5px; font-size:10px; color:#fed7aa; line-height:1.45;">${item.note}</div>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:10px; padding:9px 11px; background:rgba(2,6,23,0.32); border:1px solid rgba(255,255,255,0.07); border-radius:9px; color:#fde68a; font-size:11px; line-height:1.55;">
        피해야 할 예시: 일상잡담처럼 주제가 너무 넓은 이름, 단일 키워드 하나만 담은 너무 좁은 이름, 기관명·상표명을 그대로 가져온 이름.
      </div>
    </div>
  `;
}

export function renderOneclickSetupTab() {
  return `
    <div style="display: flex; flex-direction: column; gap: 20px;">
      <!-- v3.8.344: 시작전준비/헬스체크/beginnerPath/STEP 1 모두 삭제 (사용자 요청 — 계정 추가/앱 연동 + 준비 상태 외 다 제거). 헤더도 간소화. -->

      <!-- 🎬 세팅 영상 안내 (사용자 요청: 세팅 영상은 원클릭 연동에 같이) -->
      <div style="background: linear-gradient(135deg, rgba(239,68,68,0.10) 0%, rgba(220,38,38,0.08) 100%); border: 1px solid rgba(239,68,68,0.35); border-radius: 14px; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 28px;">▶️</span>
          <div>
            <div style="color: white; font-weight: 800; font-size: 14px;">처음이신가요? 세팅 영상부터 보세요</div>
            <div style="color: rgba(226,232,240,0.65); font-size: 12px; margin-top: 3px;">계정 추가·앱 연동을 단계별로 따라 하는 5분 가이드 영상</div>
          </div>
        </div>
        <a href="https://www.youtube.com/watch?v=_AJLxsyI-JY" target="_blank" rel="noopener" style="padding: 10px 18px; background: linear-gradient(135deg,#ef4444,#dc2626); border-radius: 10px; color: white; font-size: 13px; font-weight: 800; text-decoration: none; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px;">▶️ 세팅 영상 보기</a>
      </div>

      <!-- 🔗 STEP: 계정 추가 / 앱 연동 (유일하게 유지된 원클릭 세팅 카드) -->
      <div style="background: rgba(30, 41, 59, 0.4); border: 2px solid rgba(139, 92, 246, 0.45); border-radius: 16px; padding: 24px; box-shadow: 0 12px 36px rgba(139, 92, 246, 0.18);">
        <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 16px;">
          <div style="position: relative; flex-shrink: 0;">
            <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #8b5cf6, #6d28d9); border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 20px rgba(139, 92, 246, 0.4);">
              <span style="font-size: 24px;">🔗</span>
            </div>
            <span style="position: absolute; top: -8px; right: -8px; padding: 3px 8px; background: linear-gradient(135deg, #a855f7, #ec4899); color: white; border-radius: 8px; font-size: 10px; font-weight: 900; letter-spacing: 0.05em; box-shadow: 0 4px 12px rgba(168, 85, 247, 0.5);">STEP 2</span>
          </div>
          <div style="flex: 1; min-width: 0;">
            <h4 style="margin: 0; font-weight: 800; color: white; font-size: 17px; letter-spacing: -0.3px;">계정 추가 / 앱 연동 <span style="margin-left: 8px; padding: 2px 8px; background: rgba(139, 92, 246, 0.18); color: #ddd6fe; border-radius: 6px; font-size: 10px; font-weight: 700;">발행 전 필수</span></h4>
            <p style="margin: 4px 0 0; font-size: 12px; color: #c4b5fd;">블로그스팟은 블로그 생성 후 OAuth와 Blog ID를 연결하고, 워드프레스는 사이트 준비 후 App Password를 연결합니다.</p>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          <!-- 블로그스팟 연동 카드 -->
          <div id="oneclick-connect-card-blogger" style="padding: 16px 18px; background: rgba(255, 87, 34, 0.12); border: 1px solid rgba(255, 87, 34, 0.3); border-radius: 14px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
              <div>
                <div style="font-size: 14px; font-weight: 800; color: #FF7043;">🔵 블로그스팟 앱 연동</div>
                <div style="font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 2px;">4단계 안내대로 Chrome을 열고 OAuth 완료까지 이어갑니다</div>
              </div>
              <div id="oneclick-connect-status-blogger" style="padding: 4px 10px; background: rgba(100,116,139,0.2); border: 1px solid rgba(100,116,139,0.3); border-radius: 12px; font-size: 10px; font-weight: 600; color: #94a3b8;">
                ⏳ 미연동
              </div>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;">
              <span style="padding: 4px 8px; background: rgba(255,255,255,0.06); border-radius: 6px; font-size: 10px; color: rgba(255,255,255,0.5);">✓ 앱 가이드</span>
              <span style="padding: 4px 8px; background: rgba(255,255,255,0.06); border-radius: 6px; font-size: 10px; color: rgba(255,255,255,0.5);">✓ Chrome 자동 이동</span>
              <span style="padding: 4px 8px; background: rgba(255,255,255,0.06); border-radius: 6px; font-size: 10px; color: rgba(255,255,255,0.5);">✓ 값 저장 + OAuth</span>
            </div>
            ${renderConnectStepRail('blogspot', { compact: true })}
            <div id="oneclick-connect-msg-blogger" style="display: none; padding: 10px 14px; background: rgba(0,0,0,0.2); border-radius: 8px; margin-bottom: 10px; font-size: 12px; color: #a78bfa; transition: all 0.3s;"></div>
            <!-- v3.8.345: 초보자 친화 재구성 — 큰 가이드 버튼 하나 + [▼ 수동 설정] 접기 -->
            <div id="oneclick-blogger-oauth-helper" style="padding: 14px; background: rgba(15, 23, 42, 0.45); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; margin-bottom: 12px;">
              <div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px;">
                <div style="flex: 1;">
                  <div style="font-size: 12px; font-weight: 800; color: #fed7aa;">Google OAuth 연동</div>
                  <div style="font-size: 11px; color: rgba(255,255,255,0.55); margin-top: 3px; line-height: 1.55;">
                    아래 <strong style="color:#fbbf24;">가이드 시작</strong>을 누르면 Google Cloud Client 생성 → Blogger API 활성화 → 테스트 사용자 추가 → 저장 후 인증까지 순서대로 안내합니다. 초보자는 이 버튼 하나로 완료 가능합니다.
                  </div>
                </div>
              </div>

              <!-- 큰 가이드 버튼 (초보자 메인 액션) -->
              <button type="button" onclick="window.__oneclickSetup?.showBloggerOAuthGuide()"
                style="width: 100%; padding: 14px; background: linear-gradient(135deg, #fbbf24, #f59e0b); border: none; color: #1f2937; border-radius: 10px; font-size: 14px; font-weight: 900; cursor: pointer; box-shadow: 0 4px 14px rgba(251,191,36,0.35); display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px;"
                onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 8px 24px rgba(251,191,36,0.5)'"
                onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 14px rgba(251,191,36,0.35)'">
                <span style="font-size: 18px;">▶️</span>
                <span>5분 가이드로 OAuth 연동 시작 (초보자 추천)</span>
              </button>

              <!-- 저장된 값 불러오기 (보조 액션) -->
              <button type="button" onclick="window.__oneclickSetup?.loadBloggerOAuthFields()"
                style="width: 100%; padding: 9px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; margin-bottom: 10px;">
                📥 저장된 값 다시 불러오기
              </button>

              <!-- 수동 설정 (고급/자동 실패 시) — 기본 접힘 -->
              <details style="margin-top: 4px;">
                <summary style="list-style:none; cursor:pointer; padding:10px 12px; border-radius:10px; background:rgba(255,112,67,0.10); border:1px solid rgba(255,112,67,0.24); color:#fed7aa; font-size:12px; font-weight:850;">
                  ▼ 자동 안 될 때만 열기 — 수동 설정 (고급)
                  <span style="display:block; margin-top:3px; color:rgba(255,255,255,0.48); font-size:10px; font-weight:600;">Client ID/Secret 붙여넣기, Blog ID 수동 감지, Redirect URI 복사 등</span>
                </summary>
                <div id="oneclick-blogger-manual-details" style="margin-top: 12px;">
                  <div style="padding:10px 12px; border-radius:10px; background:rgba(255,112,67,0.10); border:1px solid rgba(255,112,67,0.24); color:#fed7aa; font-size:12px; font-weight:850; margin-bottom:10px;">
                    직접 입력은 <button type="button" onclick="window.__oneclickSetup?.openBloggerPlatformFields('blogId')" style="padding:4px 8px; margin:0 4px; background:rgba(255,255,255,0.10); border:1px solid rgba(255,255,255,0.18); color:#fff7ed; border-radius:7px; font-size:11px; font-weight:850; cursor:pointer;">블로그 플랫폼 필드</button>에서 합니다.
                    <span style="display:block; margin-top:3px; color:rgba(255,255,255,0.48); font-size:10px; font-weight:600;">원클릭으로 추출한 값도 해당 필드에 자동 삽입됩니다.</span>
                  </div>
                  <div style="display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; margin-bottom: 10px;">
                    <input id="oneclick-oauth-redirect" type="text" readonly value="${BLOGGER_OAUTH_REDIRECT_URI}"
                      style="width: 100%; padding: 9px 10px; background: rgba(2, 6, 23, 0.65); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #93c5fd; font-size: 11px; box-sizing: border-box;" />
                    <button type="button" onclick="window.__oneclickSetup?.copyBloggerOAuthRedirectUri()"
                      style="padding: 9px 12px; background: rgba(59,130,246,0.18); border: 1px solid rgba(59,130,246,0.35); color: #bfdbfe; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer;">
                      Redirect 복사
                    </button>
                  </div>
                  <label style="display:flex; align-items:flex-start; gap:8px; padding:10px 11px; margin-bottom:10px; background:rgba(251,191,36,0.08); border:1px solid rgba(251,191,36,0.22); border-radius:9px; color:#fde68a; font-size:11px; line-height:1.5; cursor:pointer;">
                    <input id="oneclick-oauth-test-user-confirm" type="checkbox" style="margin-top:2px;" />
                    <span><strong>현재 Chrome에 로그인된 Gmail</strong>을 Google Cloud → Audience → Test users에 추가하고 저장했습니다. 이 확인 없이 인증을 열면 Google 403 access_denied가 뜰 수 있습니다.</span>
                  </label>
                  <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button type="button" onclick="window.__oneclickSetup?.openGoogleOAuthConsole('clients')"
                      style="flex: 1; min-width: 120px; padding: 9px 10px; background: rgba(255,112,67,0.16); border: 1px solid rgba(255,112,67,0.35); color: #fed7aa; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer;">Client 만들기</button>
                    <button type="button" onclick="window.__oneclickSetup?.openGoogleOAuthConsole('bloggerApi')"
                      style="flex: 1; min-width: 120px; padding: 9px 10px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer;">Blogger API 열기</button>
                    <button type="button" onclick="window.__oneclickSetup?.openGoogleOAuthConsole('audience')"
                      style="flex: 1; min-width: 128px; padding: 9px 10px; background: rgba(251,191,36,0.16); border: 1px solid rgba(251,191,36,0.35); color: #fde68a; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer;">테스트 사용자</button>
                    <button type="button" onclick="window.__oneclickSetup?.startBloggerBlogIdExtract()"
                      style="flex: 1; min-width: 130px; padding: 9px 10px; background: rgba(14,165,233,0.16); border: 1px solid rgba(14,165,233,0.35); color: #bae6fd; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer;">Blog ID 자동</button>
                    <button type="button" onclick="window.__oneclickSetup?.openBloggerPlatformFields('googleClientId')"
                      style="flex: 1; min-width: 140px; padding: 9px 10px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #e5e7eb; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer;">플랫폼 필드 열기</button>
                    <button type="button" onclick="window.__oneclickSetup?.saveBloggerOAuthCredentials(false)"
                      style="flex: 1; min-width: 120px; padding: 9px 10px; background: rgba(16,185,129,0.16); border: 1px solid rgba(16,185,129,0.35); color: #bbf7d0; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer;">플랫폼 값 저장</button>
                    <button type="button" onclick="window.__oneclickSetup?.saveBloggerOAuthCredentials(true)"
                      style="flex: 1.3; min-width: 140px; padding: 9px 10px; background: linear-gradient(135deg, #8b5cf6, #6366f1); border: none; color: white; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer;">저장 후 인증</button>
                  </div>
                </div>
              </details>
              <div id="oneclick-oauth-helper-msg" style="display: none; margin-top: 10px; padding: 9px 10px; background: rgba(0,0,0,0.18); border-radius: 8px; color: #c4b5fd; font-size: 11px; line-height: 1.5;"></div>
            </div>
            <button id="oneclick-connect-btn-blogger" onclick="window.__oneclickSetup?.startPlatformConnect('blogger')"
              style="width: 100%; padding: 11px; background: linear-gradient(135deg, #FF5722, #FF7043); color: white; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.2); transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 6px;"
              onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
              <span>▶</span><span>가이드 순서대로 OAuth 연동 시작</span>
            </button>
          </div>

          <!-- 워드프레스 연동 카드 -->
          <div id="oneclick-connect-card-wordpress" style="padding: 16px 18px; background: rgba(33, 117, 155, 0.12); border: 1px solid rgba(33, 117, 155, 0.3); border-radius: 14px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
              <div>
                <div style="font-size: 14px; font-weight: 800; color: #4fc3f7;">🟣 워드프레스 앱 연동</div>
                <div style="font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 2px;">관리자 로그인 → Application Password 자동 생성 → REST 발행 검증</div>
              </div>
              <div id="oneclick-connect-status-wordpress" style="padding: 4px 10px; background: rgba(100,116,139,0.2); border: 1px solid rgba(100,116,139,0.3); border-radius: 12px; font-size: 10px; font-weight: 600; color: #94a3b8;">
                ⏳ 미연동
              </div>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;">
              <span style="padding: 4px 8px; background: rgba(255,255,255,0.06); border-radius: 6px; font-size: 10px; color: rgba(255,255,255,0.5);">✓ wp-admin 자동 접속</span>
              <span style="padding: 4px 8px; background: rgba(255,255,255,0.06); border-radius: 6px; font-size: 10px; color: rgba(255,255,255,0.5);">✓ Application Password 생성</span>
              <span style="padding: 4px 8px; background: rgba(255,255,255,0.06); border-radius: 6px; font-size: 10px; color: rgba(255,255,255,0.5);">✓ 자격증명 자동 저장</span>
              <span style="padding: 4px 8px; background: rgba(255,255,255,0.06); border-radius: 6px; font-size: 10px; color: rgba(255,255,255,0.5);">✓ REST API 검증</span>
            </div>
            ${renderConnectStepRail('wordpress', { compact: true })}
            <div id="oneclick-connect-msg-wordpress" style="display: none; padding: 10px 14px; background: rgba(0,0,0,0.2); border-radius: 8px; margin-bottom: 10px; font-size: 12px; color: #4fc3f7; transition: all 0.3s;"></div>
            <div id="oneclick-wordpress-helper" style="padding: 14px; background: rgba(15, 23, 42, 0.45); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; margin-bottom: 12px;">
              <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 10px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 220px;">
                  <div style="font-size: 12px; font-weight: 800; color: #bae6fd;">WordPress 연동 상태</div>
                  <div style="font-size: 10px; color: rgba(255,255,255,0.45); margin-top: 3px; line-height: 1.5;">
                    초보자는 아래 큰 버튼으로 진행하세요. 직접 입력은 App Password 자동 생성이 막힌 경우에만 펼칩니다.
                  </div>
                </div>
                <button type="button" onclick="window.__oneclickSetup?.loadWordPressFields()"
                  style="padding: 7px 10px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; border-radius: 8px; font-size: 10px; font-weight: 700; cursor: pointer; white-space: nowrap;">
                  불러오기
                </button>
                <button type="button" onclick="window.__oneclickSetup?.showWordPressGuide()"
                  style="padding: 7px 10px; background: rgba(251,191,36,0.16); border: 1px solid rgba(251,191,36,0.35); color: #fde68a; border-radius: 8px; font-size: 10px; font-weight: 800; cursor: pointer; white-space: nowrap;">
                  가이드 시작
                </button>
              </div>
              <details id="oneclick-wordpress-manual-details" style="margin-top: 10px;">
                <summary style="list-style:none; cursor:pointer; padding:10px 12px; border-radius:10px; background:rgba(14,165,233,0.10); border:1px solid rgba(14,165,233,0.24); color:#bae6fd; font-size:12px; font-weight:850;">
                  자동 연동이 막혔을 때만 직접 입력 열기
                  <span style="display:block; margin-top:3px; color:rgba(255,255,255,0.48); font-size:10px; font-weight:600;">여기서 저장하면 플랫폼 설정과 .env에도 같이 반영됩니다.</span>
                </summary>
                <div style="margin-top: 10px;">
              <input id="oneclick-wp-site-url" type="text" placeholder="https://yourblog.com"
                style="width: 100%; padding: 10px 12px; background: rgba(2, 6, 23, 0.65); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; font-size: 12px; box-sizing: border-box; margin-bottom: 8px;" />
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
                <input id="oneclick-wp-username" type="text" placeholder="WordPress 관리자 ID"
                  style="width: 100%; padding: 10px 12px; background: rgba(2, 6, 23, 0.65); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; font-size: 12px; box-sizing: border-box;" />
                <input id="oneclick-wp-app-password" type="password" placeholder="Application Password"
                  style="width: 100%; padding: 10px 12px; background: rgba(2, 6, 23, 0.65); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; font-size: 12px; box-sizing: border-box;" />
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button type="button" onclick="window.__oneclickSetup?.openWordPressAdmin('login')"
                  style="flex: 1; min-width: 120px; padding: 9px 10px; background: rgba(14,165,233,0.16); border: 1px solid rgba(14,165,233,0.35); color: #bae6fd; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer;">
                  wp-admin 열기
                </button>
                <button type="button" onclick="window.__oneclickSetup?.openWordPressAdmin('profile')"
                  style="flex: 1.2; min-width: 145px; padding: 9px 10px; background: rgba(59,130,246,0.16); border: 1px solid rgba(59,130,246,0.35); color: #bfdbfe; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer;">
                  App Password 열기
                </button>
                <button type="button" onclick="window.__oneclickSetup?.saveWordPressCredentials(false)"
                  style="flex: 1; min-width: 100px; padding: 9px 10px; background: rgba(16,185,129,0.16); border: 1px solid rgba(16,185,129,0.35); color: #bbf7d0; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer;">
                  저장
                </button>
                <button type="button" onclick="window.__oneclickSetup?.saveWordPressCredentials(true)"
                  style="flex: 1.2; min-width: 130px; padding: 9px 10px; background: linear-gradient(135deg, #0ea5e9, #2563eb); border: none; color: white; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer;">
                  저장 후 검증
                </button>
              </div>
                </div>
              </details>
              <div id="oneclick-wp-helper-msg" style="display: none; margin-top: 10px; padding: 9px 10px; background: rgba(0,0,0,0.18); border-radius: 8px; color: #bae6fd; font-size: 11px; line-height: 1.5;"></div>
            </div>
            <div id="oneclick-connect-wp-url-wrap" style="display:none; margin-bottom: 10px;">
              <input id="oneclick-connect-wp-url" type="text" placeholder="https://yourblog.com/wp-admin"
                style="width: 100%; padding: 10px 14px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; color: white; font-size: 13px; outline: none; box-sizing: border-box;" />
            </div>
            <button id="oneclick-connect-btn-wordpress" onclick="window.__oneclickSetup?.startPlatformConnect('wordpress')"
              style="width: 100%; padding: 11px; background: linear-gradient(135deg, #21759B, #0073AA); color: white; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.2); transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 6px;"
              onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
              <span>▶</span><span>가이드 순서대로 App Password 생성</span>
            </button>
          </div>
        </div>
      </div>

      <!-- v3.8.341: STEP 3 웹마스터도구 자동세팅 + STEP 4 인프라 원클릭(Cloudways) 삭제 (사용자 요청) -->
      <!--   자동화 대신 반자동 안내 카드로 교체. 각 서비스는 사용자가 직접 로그인·설정. -->
      <div style="background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 16px; padding: 24px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
          <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #64748b, #475569); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 20px;">🔧</span>
          </div>
          <div>
            <h4 style="margin: 0; font-weight: 800; color: white; font-size: 16px;">웹마스터도구 · 인프라 설정 (직접 진행)</h4>
            <p style="margin: 4px 0 0; font-size: 11px; color: rgba(226,232,240,0.55);">각 서비스에 직접 로그인해서 등록하세요. 아래는 바로가기 링크.</p>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; margin-top: 14px;">
          <a href="https://search.google.com/search-console" target="_blank" rel="noopener" style="padding: 12px 14px; background: rgba(66,133,244,0.14); border: 1px solid rgba(66,133,244,0.35); border-radius: 10px; color: #93bbfc; font-size: 12px; font-weight: 700; text-decoration: none; display: flex; align-items: center; gap: 8px;">🔵 구글 서치콘솔 →</a>
          <a href="https://searchadvisor.naver.com" target="_blank" rel="noopener" style="padding: 12px 14px; background: rgba(0,200,83,0.14); border: 1px solid rgba(0,200,83,0.35); border-radius: 10px; color: #6ee7b7; font-size: 12px; font-weight: 700; text-decoration: none; display: flex; align-items: center; gap: 8px;">🟢 네이버 서치어드바이저 →</a>
          <a href="https://webmaster.daum.net" target="_blank" rel="noopener" style="padding: 12px 14px; background: rgba(59,130,246,0.14); border: 1px solid rgba(59,130,246,0.35); border-radius: 10px; color: #93c5fd; font-size: 12px; font-weight: 700; text-decoration: none; display: flex; align-items: center; gap: 8px;">🔷 다음 웹마스터 →</a>
          <a href="https://www.bing.com/webmasters" target="_blank" rel="noopener" style="padding: 12px 14px; background: rgba(242,142,38,0.14); border: 1px solid rgba(242,142,38,0.35); border-radius: 10px; color: #fbbf24; font-size: 12px; font-weight: 700; text-decoration: none; display: flex; align-items: center; gap: 8px;">🟠 Bing 웹마스터 →</a>
        </div>
        <div style="margin-top: 14px; padding: 10px 14px; background: rgba(255,255,255,0.03); border-radius: 8px; font-size: 11px; color: rgba(226,232,240,0.6); line-height: 1.6;">
          💡 각 사이트에 로그인 → 내 블로그 URL 등록 → 사이트맵(<code style="color:#fbbf24;">/sitemap.xml</code>) 제출. Cloudways/SSL 등 인프라는 각 호스팅 관리 페이지에서 직접 진행.
        </div>
      </div>
    </div>
  `;
}

function renderWebmasterCard({ id, title, subtitle, bgColor, borderColor, textColor, gradient, features }) {
  return `
    <div id="oneclick-webmaster-card-${id}"
      style="padding: 16px 18px; background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 14px; transition: all 0.3s;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
        <div>
          <div style="font-size: 14px; font-weight: 800; color: ${textColor};">${title}</div>
          <div style="font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 2px;">${subtitle}</div>
        </div>
        <div id="oneclick-webmaster-status-${id}" style="padding: 4px 10px; background: rgba(100,116,139,0.2); border: 1px solid rgba(100,116,139,0.3); border-radius: 12px; font-size: 10px; font-weight: 600; color: #94a3b8;">
          ⏳ 미연동
        </div>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;">
        ${features.map(f => `<span style="padding: 4px 8px; background: rgba(255,255,255,0.06); border-radius: 6px; font-size: 10px; color: rgba(255,255,255,0.5);">✓ ${f}</span>`).join('')}
      </div>
      <button id="oneclick-webmaster-btn-${id}" onclick="window.__oneclickSetup?.startWebmasterSetup('${id}')"
        style="width: 100%; padding: 11px; background: ${gradient}; color: white; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.2); transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 6px;"
        onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
        <span>▶</span><span>자동 세팅 시작</span>
      </button>
    </div>
  `;
}

// ═══════════════════════════════════════════════
// 세팅 시작 / 진행 / 완료
// ═══════════════════════════════════════════════

let activeSetup = null; // { platform, stepIndex, cancelled }
let activeWebmaster = null; // { engine, cancelled }
let activeInfra = null; // { cancelled }

async function startSetup(platformId, options = {}) {
  const runningOp = isAnyOperationRunning();
  if (runningOp) {
    showToast(`⚠️ ${runningOp}이(가) 진행 중입니다. 완료 후 다시 시도해주세요.`, 'warn');
    return;
  }

  // 이미 세팅되어 있는지 체크
  try {
    const storage = getStorageManager();
    const setupKey = `setup_complete_${platformId}`;
    const already = await storage.get(setupKey, true);
    if (already && !options.forceFirstRun) {
      const proceed = confirm(`✅ 이미 ${platformId === 'blogspot' ? 'Blogspot' : 'WordPress'} 원클릭 셋업이 완료되어 있습니다.\n\n다시 진행하시겠습니까?`);
      if (!proceed) {
        showToast(`✅ 이미 셋업이 완료되어 있습니다.`, 'success');
        return;
      }
    }
  } catch { /* 무시 */ }

  const platform = PLATFORMS[platformId];
  if (!platform) return;

  // 워드프레스 사이트 URL 확인 (원본 객체 변이 방지: 로컬 변수 사용)
  let adminUrl = platform.adminUrl;
  if (platformId === 'wordpress') {
    showInputModal({
      title: '워드프레스 관리자 URL 입력',
      placeholder: 'https://yourblog.com/wp-admin',
      onConfirm: (wpUrl) => {
        if (!wpUrl) return;
        const url = wpUrl.replace(/\/wp-admin\/?$/, '') + '/wp-admin';
        continueSetup(platformId, platform, url);
      }
    });
    return;
  }

  // 블로그스팟 사전 입력 모달 (제목, 주소, 설명, GA ID)
  if (platformId === 'blogspot') {
    showBlogspotSetupModal((config) => {
      if (!config) return;
      // blogspotConfig를 window에 임시 저장 → continueSetup에서 IPC로 전달
      window.__blogspotSetupConfig = config;
      continueSetup(platformId, platform, adminUrl);
    });
    return;
  }

  continueSetup(platformId, platform, adminUrl);
}

async function continueSetup(platformId, platform, adminUrl) {
  activeSetup = {
    platform: platformId,
    stepIndex: 0,
    cancelled: false,
    setupPurpose: platformId === 'blogspot'
      ? (window.__blogspotSetupConfig?.setupPurpose || 'create-new')
      : undefined,
  };
  updateLiveOneclickGuide('setup', platformId, {
    currentStep: 0,
    totalSteps: platform.steps.length,
    stepStatus: 'running',
    message: '원클릭 세팅을 시작합니다. 필요한 수동 단계가 나오면 이 가이드가 함께 안내합니다.',
  });

  // UI 업데이트 — 진행 모드
  const btn = document.getElementById(`oneclick-btn-${platformId}`);
  const progress = document.getElementById(`oneclick-progress-${platformId}`);
  const status = document.getElementById(`oneclick-status-${platformId}`);

  if (btn) {
    setButtonContent(btn, '⏸', '세팅 취소');
    btn.style.background = 'rgba(239, 68, 68, 0.3)';
    btn.style.boxShadow = 'none';
    btn.onclick = () => cancelSetup(platformId);
  }

  if (status) {
    status.textContent = '🔄 진행 중...';
    status.style.background = 'rgba(59, 130, 246, 0.2)';
    status.style.borderColor = 'rgba(59, 130, 246, 0.4)';
    status.style.color = '#60a5fa';
  }

  // 스텝 UI 렌더링
  if (progress) {
    progress.style.display = 'block';
    const stepsContainer = document.getElementById(`oneclick-steps-${platformId}`);
    if (stepsContainer) {
      stepsContainer.innerHTML = platform.steps.map((step, i) => `
        <div id="oneclick-step-${platformId}-${i}" 
          style="display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; transition: all 0.3s;">
          <div id="oneclick-step-icon-${platformId}-${i}"
            style="width: 32px; height: 32px; border-radius: 50%; background: rgba(100,116,139,0.2); display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0;">
            ${i + 1}
          </div>
          <div style="flex: 1;">
            <div style="font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.7);">${step.icon} ${step.title}</div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 2px;">${step.desc}</div>
          </div>
          <div id="oneclick-step-status-${platformId}-${i}" style="font-size: 11px; color: rgba(255,255,255,0.3);">
            대기
          </div>
        </div>
      `).join('');
    }
  }

  // 세팅 실행
  try {
    console.log(`[ONECLICK] 🚀 ${platform.name} 세팅 시작`);
    addLog?.(`[원클릭] 🚀 ${platform.name} 세팅 시작`);

    // 블로그스팟 추가 설정 데이터 포함
    const ipcPayload = {
      platform: platformId,
      adminUrl: adminUrl,
      steps: platform.steps.map(s => s.id),
    };
    if (platformId === 'blogspot' && window.__blogspotSetupConfig) {
      ipcPayload.blogspotConfig = window.__blogspotSetupConfig;
      delete window.__blogspotSetupConfig;
    }
    const result = await window.electronAPI?.invoke('oneclick:start-setup', ipcPayload);

    if (result?.ok) {
      listenForProgress(platformId);
    } else {
      throw new Error(result?.error || '세팅 시작 실패');
    }

  } catch (error) {
    console.error(`[ONECLICK] ❌ ${platform.name} 세팅 실패:`, error);
    setSetupFailed(platformId, error.message);
  }
}

// ═══════════════════════════════════════════════
// 웹마스터도구 자동 세팅
// ═══════════════════════════════════════════════

async function startWebmasterSetup(engine) {
  const runningOp = isAnyOperationRunning();
  if (runningOp) {
    showToast(`⚠️ ${runningOp}이(가) 진행 중입니다. 완료 후 다시 시도해주세요.`, 'warn');
    return;
  }

  const blogUrl = document.getElementById('oneclick-webmaster-url')?.value?.trim();
  if (!blogUrl) {
    showToast('📍 먼저 등록할 블로그 주소를 입력해주세요.', 'warn');
    document.getElementById('oneclick-webmaster-url')?.focus();
    return;
  }

  // URL 유효성 검사
  if (!blogUrl.startsWith('http://') && !blogUrl.startsWith('https://')) {
    showToast('⚠️ URL은 http:// 또는 https://로 시작해야 합니다.', 'warn');
    return;
  }

  // 이미 등록되어 있는지 체크
  try {
    const storage = getStorageManager();
    const wmKey = `webmaster_${engine}_${blogUrl}`;
    const already = await storage.get(wmKey, true);
    if (already) {
      const proceed = confirm(`✅ 이미 ${ENGINE_NAMES[engine]}에 "${blogUrl}"이 등록되어 있습니다.\n\n다시 등록하시겠습니까?`);
      if (!proceed) {
        showToast(`✅ 이미 ${ENGINE_NAMES[engine]}에 등록되어 있습니다.`, 'success');
        return;
      }
    }
  } catch { /* 무시 */ }

  activeWebmaster = { engine, cancelled: false };

  // 버튼 상태 변경
  const btn = document.getElementById(`oneclick-webmaster-btn-${engine}`);
  const statusEl = document.getElementById(`oneclick-webmaster-status-${engine}`);

  if (btn) {
    setButtonContent(btn, '⏸', '취소');
    btn.style.background = 'rgba(239, 68, 68, 0.3)';
    btn.onclick = () => cancelWebmasterSetup(engine);
  }

  if (statusEl) {
    statusEl.textContent = '🔄 진행 중...';
    statusEl.style.background = 'rgba(59, 130, 246, 0.2)';
    statusEl.style.borderColor = 'rgba(59, 130, 246, 0.4)';
    statusEl.style.color = '#60a5fa';
  }

  // 진행 상태 영역 표시
  const progressArea = document.getElementById('oneclick-webmaster-progress');
  const stepsContainer = document.getElementById('oneclick-webmaster-steps');
  if (progressArea) progressArea.style.display = 'block';

  if (stepsContainer) {
    stepsContainer.innerHTML = `
      <div style="padding: 12px 16px; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">⏳</span>
          <div>
            <div style="font-size: 13px; font-weight: 700; color: #fbbf24;">${ENGINE_NAMES[engine]} 자동 세팅 진행 중...</div>
            <div id="oneclick-webmaster-msg" style="font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 4px;">브라우저를 여는 중...</div>
          </div>
        </div>
      </div>
    `;
  }

  try {
    addLog?.(`[원클릭] 🔍 ${ENGINE_NAMES[engine]} 자동 세팅 시작`);

    const result = await window.electronAPI?.invoke('oneclick:start-webmaster', {
      engine,
      blogUrl
    });

    if (result?.ok) {
      // 폴링으로 상태 추적
      clearPoll('webmaster');
      let wmPollErrors = 0;
      webmasterPollId = setInterval(async () => {
        if (!activeWebmaster || activeWebmaster.cancelled || activeWebmaster.engine !== engine) {
          clearPoll('webmaster');
          return;
        }

        try {
          const status = await window.electronAPI?.invoke('oneclick:get-webmaster-status', { engine });
          if (!status?.ok) return;
          wmPollErrors = 0;

          // 메시지 업데이트
          const msgEl = document.getElementById('oneclick-webmaster-msg');
          if (msgEl && status.message) {
            msgEl.textContent = status.message;
          }

          if (status.stepStatus === 'waiting-login') {
            if (msgEl) msgEl.textContent = '🔐 브라우저에서 로그인해주세요...';
            showWebmasterLoginGuide(engine, ENGINE_NAMES[engine]);
          }

          if (status.completed) {
            clearPoll('webmaster');
            setWebmasterComplete(engine, status.results);
          } else if (status.error) {
            clearPoll('webmaster');
            setWebmasterFailed(engine, status.error);
          }
        } catch {
          wmPollErrors++;
          if (wmPollErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
            clearPoll('webmaster');
            setWebmasterFailed(engine, '연결 시간 초과 (폴링 실패 연속)');
          }
        }
      }, POLL_INTERVAL_MS);
    } else {
      throw new Error(result?.error || '세팅 시작 실패');
    }

  } catch (error) {
    console.error(`[ONECLICK] ❌ 웹마스터 세팅 실패:`, error);
    setWebmasterFailed(engine, error.message);
  }
}

function showWebmasterLoginGuide(engine, engineName) {
  const existing = document.getElementById('oneclick-webmaster-login-modal');
  if (existing) return; // 이미 표시됨

  const accountType = {
    google: 'Google 계정',
    naver: '네이버 계정',
    daum: '다음 계정 (PIN 인증)',
    bing: 'Microsoft 계정'
  }[engine] || engine;

  const modal = document.createElement('div');
  modal.id = 'oneclick-webmaster-login-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'oneclick-webmaster-login-title');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center; z-index: 99999;
  `;

  modal.innerHTML = `
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #0d1b2a 100%); border-radius: 24px; padding: 40px; max-width: 480px; width: 90%; text-align: center; border: 1px solid rgba(255,255,255,0.1);">
      <div style="font-size: 64px; margin-bottom: 16px;">🔐</div>
      <h2 id="oneclick-webmaster-login-title" style="color: white; font-size: 22px; font-weight: 800; margin-bottom: 12px;">
        ${engineName} 로그인
      </h2>
      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin-bottom: 24px;">
        방금 열린 브라우저 창에서<br>
        <strong style="color: white;">${accountType}으로 로그인</strong>해주세요.<br>
        <span style="color: #fbbf24;">로그인 후 자동으로 최적 세팅이 진행됩니다!</span>
      </p>
      <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: left;">
        <div style="font-size: 13px; color: #6ee7b7; line-height: 1.8;">
          ✅ 사이트 등록 자동 처리<br>
          ✅ 사이트맵/RSS 자동 제출<br>
          ✅ 색인 요청까지 한번에 완료
        </div>
      </div>
      <button onclick="document.getElementById('oneclick-webmaster-login-modal')?.remove()"
        style="width: 100%; padding: 14px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1; border-radius: 12px; font-weight: 600; cursor: pointer; font-size: 14px;"
        onmouseover="this.style.background='rgba(255,255,255,0.12)'"
        onmouseout="this.style.background='rgba(255,255,255,0.08)'">
        알겠습니다 ✓
      </button>
    </div>
  `;
  document.body.appendChild(modal);
  attachModalDismiss(modal);
}

async function setWebmasterComplete(engine, results) {
  activeWebmaster = null;

  // 상태 뱃지
  const statusEl = document.getElementById(`oneclick-webmaster-status-${engine}`);
  if (statusEl) {
    statusEl.textContent = '✅ 연동 완료';
    statusEl.style.background = 'rgba(16, 185, 129, 0.2)';
    statusEl.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    statusEl.style.color = '#10b981';
  }

  // 버튼 복원
  const btn = document.getElementById(`oneclick-webmaster-btn-${engine}`);
  if (btn) {
    setButtonContent(btn, '✅', '세팅 완료!');
    btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    btn.onclick = () => startWebmasterSetup(engine);
    setTimeout(() => {
      if (btn) {
        setButtonContent(btn, '🔄', '재설정');
        btn.style.background = ENGINE_GRADIENTS[engine];
      }
    }, BUTTON_RESET_DELAY_MS);
  }

  // 진행 메시지 -> 완료 결과
  const stepsContainer = document.getElementById('oneclick-webmaster-steps');
  if (stepsContainer && results) {
    const resultItems = Object.entries(results).map(([key, val]) => {
      const item = document.createElement('div');
      item.style.cssText = 'display: flex; align-items: center; gap: 6px; padding: 6px 0;';
      const icon = document.createElement('span');
      icon.style.color = val ? '#10b981' : '#f59e0b';
      icon.textContent = val ? '✅' : '⚠️';
      const label = document.createElement('span');
      label.style.cssText = 'font-size: 12px; color: rgba(255,255,255,0.7);';
      label.textContent = key;
      item.appendChild(icon);
      item.appendChild(label);
      return item;
    });
    
    stepsContainer.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'padding: 16px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 12px;';
    const title = document.createElement('div');
    title.style.cssText = 'font-size: 14px; font-weight: 700; color: #10b981; margin-bottom: 8px;';
    title.textContent = `✅ ${ENGINE_NAMES[engine]} 세팅 완료!`;
    wrapper.appendChild(title);
    resultItems.forEach(item => wrapper.appendChild(item));
    stepsContainer.appendChild(wrapper);
  }

  // 로그인 모달 제거
  document.getElementById('oneclick-webmaster-login-modal')?.remove();

  addLog?.(`[원클릭] ✅ ${ENGINE_NAMES[engine]} 세팅 완료!`);
  showToast(`🎉 ${ENGINE_NAMES[engine]} 웹마스터 등록 완료!`, 'success', 5000);

  // 등록 정보 저장 (다음번 중복 체크용)
  try {
    const blogUrl = document.getElementById('oneclick-webmaster-url')?.value?.trim();
    if (blogUrl) {
      const storage = getStorageManager();
      await storage.set(`webmaster_${engine}_${blogUrl}`, { registeredAt: Date.now(), results }, true);
    }
  } catch { /* 무시 */ }
}

function setWebmasterFailed(engine, errorMsg) {
  activeWebmaster = null;

  const statusEl = document.getElementById(`oneclick-webmaster-status-${engine}`);
  if (statusEl) {
    statusEl.textContent = '❌ 실패';
    statusEl.style.background = 'rgba(239, 68, 68, 0.2)';
    statusEl.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    statusEl.style.color = '#ef4444';
  }

  const btn = document.getElementById(`oneclick-webmaster-btn-${engine}`);
  if (btn) {
    setButtonContent(btn, '🔄', '다시 시도');
    btn.style.background = ENGINE_GRADIENTS[engine];
    btn.onclick = () => startWebmasterSetup(engine);
  }

  document.getElementById('oneclick-webmaster-login-modal')?.remove();
  addLog?.(`[원클릭] ❌ ${ENGINE_NAMES[engine]} 세팅 실패: ${errorMsg}`);
  showToast(`❌ ${ENGINE_NAMES[engine]} 세팅 실패: ${errorMsg}`, 'error', 6000);
}

function cancelWebmasterSetup(engine) {
  if (activeWebmaster) activeWebmaster.cancelled = true;
  clearPoll('webmaster');
  window.electronAPI?.invoke('oneclick:cancel-webmaster', { engine });

  const btn = document.getElementById(`oneclick-webmaster-btn-${engine}`);
  if (btn) {
    setButtonContent(btn, '▶', '자동 세팅 시작');
    btn.style.background = ENGINE_GRADIENTS[engine];
    btn.onclick = () => startWebmasterSetup(engine);
  }

  const statusEl = document.getElementById(`oneclick-webmaster-status-${engine}`);
  if (statusEl) {
    statusEl.textContent = '⏳ 미연동';
    statusEl.style.background = 'rgba(100,116,139,0.2)';
    statusEl.style.borderColor = 'rgba(100,116,139,0.3)';
    statusEl.style.color = '#94a3b8';
  }

  document.getElementById('oneclick-webmaster-login-modal')?.remove();
  const progressArea = document.getElementById('oneclick-webmaster-progress');
  if (progressArea) progressArea.style.display = 'none';
  activeWebmaster = null;
}

function listenForProgress(platformId) {
  clearPoll('platform');
  let pfPollErrors = 0;
  // v3.7.23+: silent stall watchdog — 3단계 에스컬레이션 (60초 → 3분 → 5분)
  let _lastStepIdx = -1;
  let _lastStepMsg = '';
  let _stallSince = 0;
  let _stallTier = 0; // 0=정상, 1=60초 알림, 2=3분 강한 알림, 3=5분 취소 권고
  platformPollId = setInterval(async () => {
    if (!activeSetup || activeSetup.cancelled || activeSetup.platform !== platformId) {
      clearPoll('platform');
      return;
    }

    try {
      const status = await window.electronAPI?.invoke('oneclick:get-status', { platform: platformId });
      if (!status) return;
      if (status.ok === false) {
        pfPollErrors++;
        if (pfPollErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
          clearPoll('platform');
          const errorMessage = status.error || '원클릭 세팅 상태를 확인하지 못했습니다. 다시 시작해주세요.';
          updateLiveOneclickGuide('setup', platformId, {
            currentStep: status.currentStep,
            totalSteps: PLATFORMS[platformId]?.steps?.length || status.totalSteps,
            stepStatus: 'error',
            error: errorMessage,
            message: errorMessage,
          });
          setSetupFailed(platformId, errorMessage);
        }
        return;
      }
      pfPollErrors = 0;
      updateLiveOneclickGuide('setup', platformId, {
        currentStep: status.currentStep,
        totalSteps: PLATFORMS[platformId]?.steps?.length || status.totalSteps,
        stepStatus: status.stepStatus,
        message: status.message,
        completed: status.completed,
        error: status.error,
      });

      // v3.7.23+: Stall 3단계 에스컬레이션 — 60초 / 3분 / 5분
      const now = new Date().getTime();
      if (status.currentStep === _lastStepIdx && status.message === _lastStepMsg && status.stepStatus === 'running') {
        if (_stallSince === 0) {
          _stallSince = now;
          _stallTier = 0;
        } else {
          const elapsed = now - _stallSince;
          const platLabel = platformId === 'blogspot' ? '🔵 블로그스팟' : '🟣 워드프레스';

          // 1차 (60초): 부드러운 안내
          if (_stallTier < 1 && elapsed > 60000) {
            _stallTier = 1;
            showManualWaitModalOnce({
              modalKey: `stall-1-${platformId}-${status.currentStep}`,
              platformLabel: platLabel,
              stepLabel: '자동화가 잠시 멈춘 것 같아요',
              expectedTime: '확인 후 보통 30초~1분 내 재개',
              urgency: 'low',
              faqType: 'stall',
              instructions: [
                { title: 'Chrome 브라우저 창을 확인해주세요',
                  detail: '자동화가 <strong>60초 넘게</strong> 같은 단계에 머물러 있어요. 보통 브라우저에서 사용자 조치를 기다리고 있어요. 작업 표시줄에서 Chrome 아이콘을 클릭하거나 <strong>Alt + Tab</strong>으로 브라우저 창을 앞으로 가져오세요.',
                  successCheck: 'Chrome 창이 보이고 어떤 페이지가 떠 있어요.',
                  failHint: 'Chrome이 닫혔으면 자동화는 실패한 거예요. 아래 "취소 후 처음부터" 버튼을 누르세요.' },
                { title: 'Chrome 화면에 다음 중 하나가 있는지 확인',
                  detail: '<strong>① 캡차</strong> — "나는 로봇이 아닙니다" 체크박스<br><strong>② 2단계 인증</strong> — 휴대폰 인증번호 입력<br><strong>③ "계속" / "확인" / "다음" 버튼</strong> — 클릭이 필요<br><strong>④ 로그인 추가 확인</strong> — "내가 맞아요" 확인<br><strong>⑤ 팝업 차단 알림</strong> — 우측 상단 작은 알림',
                  successCheck: '위 중 하나가 있으면 직접 처리해주세요.',
                  failHint: '아무것도 없는데 멈춰 있으면 Chrome 자체 문제. 아래 FAQ "Chrome은 열려있는데 화면이 멈춰있어요" 참고.' },
                { title: '해당 항목을 직접 처리해주세요',
                  detail: '발견한 항목을 직접 눌러서 해결. 처리하면 자동화가 다시 알아서 진행됩니다.',
                  successCheck: '처리 후 페이지가 다음으로 넘어가요. 이 앱으로 돌아오면 진행 메시지가 바뀝니다.',
                  failHint: '' },
              ],
              warning: 'Chrome 창이 가려져 있으면 멈춘 것처럼 보여요. 가장 먼저 Chrome 창을 앞으로 가져와 확인하세요.',
              hint: '자주 멈추는 곳 → 캡차 / 휴대폰 인증 / "확인" 버튼 / 새 탭 차단 알림 / 약관 동의 체크박스',
              allowRetry: true,
            });
          }

          // 2차 (3분): 조금 더 강하게 — 도움이 필요하신가요?
          else if (_stallTier < 2 && elapsed > 180000) {
            _stallTier = 2;
            showManualWaitModalOnce({
              modalKey: `stall-2-${platformId}-${status.currentStep}`,
              platformLabel: platLabel,
              stepLabel: '벌써 3분이 지났어요 · 도움이 필요하신가요?',
              expectedTime: '지금 결정하면 1분 내 해결',
              urgency: 'mid',
              faqType: 'stall',
              instructions: [
                { title: 'Chrome 창에 무언가 떠 있는데 어떻게 해야 할지 모르겠다면',
                  detail: '아래 <strong>"자주 발생하는 문제 4가지"</strong>를 펼쳐서 해당 상황을 찾아보세요. 거기에 정확한 해결책이 있어요.',
                  successCheck: 'FAQ에서 답을 찾으면 그대로 따라하세요.',
                  failHint: '답이 없으면 다음 단계로.' },
                { title: 'Chrome 창이 아예 안 보이거나 닫혔다면',
                  detail: '자동화가 실패한 상태예요. <strong style="color:#fca5a5;">아래 "취소 후 처음부터" 빨간 버튼</strong>을 눌러주세요. 1~2분 안에 다시 시도 가능합니다.',
                  successCheck: '취소되면 옆 패널에서 다시 시작 버튼이 나타나요.',
                  failHint: '버튼이 안 보이면 모달을 닫고 옆 패널을 살펴보세요.' },
                { title: '같은 곳에서 계속 막힌다면 5~10분 대기 후 재시도',
                  detail: 'Google/네이버가 일시적으로 차단했을 가능성이 커요. 같은 IP로 너무 자주 시도하면 더 오래 막혀요. 5~10분 기다린 뒤 다시 시작해주세요.',
                  successCheck: '시간이 지나면 차단이 풀려요.',
                  failHint: '30분 이상 막히면 IP가 변경되어야 풀려요. 라우터 재부팅 시도.' },
              ],
              warning: '⚠️ 3분이 넘었다는 건 단순 대기가 아니라 어딘가 문제가 생겼다는 신호예요. FAQ를 꼭 확인해주세요.',
              hint: '취소해도 입력했던 정보(블로그 주소 등)는 그대로 남아 있어 다시 입력할 필요 없어요.',
              allowRetry: true,
            });
          }

          // 3차 (5분): 강력하게 — 거의 확실히 문제 있음
          else if (_stallTier < 3 && elapsed > 300000) {
            _stallTier = 3;
            showManualWaitModalOnce({
              modalKey: `stall-3-${platformId}-${status.currentStep}`,
              platformLabel: platLabel,
              stepLabel: '5분 넘게 진행이 없어요 · 다시 시작하는 게 좋겠어요',
              expectedTime: '취소 → 재시작 1~2분',
              urgency: 'high',
              faqType: 'stall',
              instructions: [
                { title: '지금까지 진행된 내용은 보존됩니다',
                  detail: '취소해도 이미 완료된 자동 단계는 그대로 유지돼요. 다시 시작하면 멈춘 지점부터(또는 가까운 지점부터) 진행됩니다. 처음부터 100% 다시 하는 게 아니에요.',
                  successCheck: '안심하고 취소 후 다시 시작하세요.',
                  failHint: '' },
                { title: '아래 빨간 "취소 후 처음부터" 버튼을 눌러주세요',
                  detail: '강제로 중단하고 처음 화면으로 돌아갑니다. 입력했던 블로그 주소·계정 정보는 그대로 남아 있어요.',
                  successCheck: '취소 후 옆 패널에 "다시 시작" 옵션이 나타나면 성공.',
                  failHint: '버튼이 안 보이면 페이지를 살짝 위로 스크롤하거나 모달을 닫고 옆 사이드를 살펴보세요.' },
                { title: '재시작 전에 5분 정도 쉬어주세요',
                  detail: 'Google·네이버가 너무 빠른 재시도를 막을 수 있어요. 휴식 후 시작하면 통과율이 훨씬 높아요.',
                  successCheck: '재시작 시 같은 단계에서 빠르게 통과해요.',
                  failHint: '여전히 같은 곳에서 막히면 IP·계정 차단 상태. 30분~1시간 더 기다리거나 다른 계정 사용.' },
              ],
              warning: '🚨 5분 이상 멈춰있다는 건 99% 자동화가 실패한 상태예요. 더 기다리는 건 의미가 없습니다. 취소 후 재시도하세요.',
              hint: '계정이 일시 차단된 경우 강제로 더 시도하면 차단 기간이 더 길어집니다.',
              allowRetry: true,
            });
          }
        }
      } else {
        _stallSince = 0;
        _stallTier = 0;
      }
      _lastStepIdx = status.currentStep;
      _lastStepMsg = status.message || '';

      if (status.currentStep !== undefined) {
        for (let i = 0; i < status.currentStep; i++) {
          updateStepUI(platformId, i, 'done');
        }

        if (status.stepStatus === 'running') {
          updateStepUI(platformId, status.currentStep, 'running', status.message);
          // 진행 중이면 로그인 완료 버튼 제거
          document.getElementById(`oneclick-login-btn-${platformId}`)?.remove();
        } else if (status.stepStatus === 'waiting-login') {
          updateStepUI(platformId, status.currentStep, 'waiting', '🔐 로그인을 완료한 뒤 아래 버튼을 눌러주세요');

          // v3.7.23+: 큰 안내 모달 — 초보자도 정확히 따라할 수 있게 화면 묘사·성공 체크·실패 대응 포함.
          //   같은 platform·step 조합에 대해 1회만 띄움 (dismiss 추적).
          showManualWaitModalOnce({
            modalKey: `wait-login-${platformId}-${status.currentStep}`,
            platformLabel: platformId === 'blogspot' ? '🔵 블로그스팟' : '🟣 워드프레스',
            stepLabel: '로그인이 필요해요',
            expectedTime: '약 1~2분',
            instructions: platformId === 'blogspot'
              ? [
                { title: 'Chrome 브라우저 창을 찾아주세요',
                  detail: '방금 자동으로 새 Chrome 창이 열렸어요. 안 보이면 화면 맨 아래 <strong>작업 표시줄</strong>에서 Chrome 아이콘을 찾아 클릭하거나, 키보드 <strong>Alt + Tab</strong>을 눌러 창을 전환하세요.',
                  successCheck: '"Google에 로그인" 또는 "Google" 로고가 보이는 페이지가 나타나면 성공이에요.',
                  failHint: 'Chrome이 한 개도 안 보이면 작업 표시줄에서 Chrome 아이콘 우클릭 → 새 창 열기 시도해보세요.' },
                { title: 'Google 계정으로 로그인하세요',
                  detail: '<strong>에드센스 승인받은 Google 계정</strong>(또는 받을 계정)의 이메일과 비밀번호를 입력해주세요. 다른 계정이면 안 돼요. 2단계 인증이 켜져 있으면 휴대폰으로 오는 인증번호까지 입력해야 합니다.',
                  successCheck: '오른쪽 상단에 본인 프로필 사진/이니셜이 보이면 로그인 완료예요.',
                  failHint: '비밀번호를 모르거나 인증이 막히면 이 모달을 닫고 옆에 "취소" 버튼을 눌러 처음부터 다시 시작해도 돼요.' },
                { title: '이 앱 창으로 돌아오세요',
                  detail: '<strong>이 앱(LEADERNAM Orbit)</strong>을 다시 화면 맨 위로 가져오세요. 작업 표시줄에서 이 앱 아이콘 클릭, 또는 Alt+Tab으로 전환.',
                  successCheck: '이 모달이 보이면 정확히 돌아온 거예요.',
                  failHint: '' },
                { title: '아래 초록 버튼 "✅ 로그인 완료"를 클릭하세요',
                  detail: '이 모달을 닫고, 화면 아래쪽에 표시된 <strong style="color:#34d399;">✅ 로그인 완료</strong> 초록 버튼을 눌러주세요. 그러면 다음 단계가 자동으로 시작됩니다.',
                  successCheck: '"✅ 로그인 완료"를 누르면 자동으로 다음 단계로 넘어가요. 1~2초 기다리세요.',
                  failHint: '버튼이 안 보이면 페이지를 살짝 위로 스크롤해보세요.' },
              ]
              : [
                { title: 'Chrome 브라우저 창을 찾아주세요',
                  detail: '방금 자동으로 새 Chrome 창이 열렸어요. 안 보이면 화면 맨 아래 <strong>작업 표시줄</strong>에서 Chrome 아이콘을 찾아 클릭하거나, 키보드 <strong>Alt + Tab</strong>을 눌러 창을 전환하세요.',
                  successCheck: '본인 워드프레스 사이트의 "wp-admin" 로그인 페이지가 보여야 해요. (예: yourblog.com/wp-admin)',
                  failHint: 'wp-admin 페이지가 안 뜨면 URL을 직접 확인해주세요. 주소가 틀렸을 수 있어요.' },
                { title: '워드프레스 관리자 계정으로 로그인하세요',
                  detail: '<strong>WordPress 설치 시 만든 관리자 ID/비밀번호</strong>를 입력하세요. 호스팅 가입 정보랑 다를 수 있어요 (Cloudways/카페24 계정 ≠ WP 관리자 계정).',
                  successCheck: '왼쪽에 검은색 사이드바와 "대시보드"라는 글자가 보이면 로그인 완료예요.',
                  failHint: '비밀번호 분실 시 wp-admin 로그인 페이지의 "Lost your password?" 링크로 재설정 가능.' },
                { title: '이 앱 창으로 돌아오세요',
                  detail: '<strong>이 앱(LEADERNAM Orbit)</strong>을 다시 화면 맨 위로 가져오세요. 작업 표시줄에서 이 앱 아이콘 클릭, 또는 Alt+Tab으로 전환.',
                  successCheck: '이 모달이 보이면 정확히 돌아온 거예요.',
                  failHint: '' },
                { title: '아래 초록 버튼 "✅ 로그인 완료"를 클릭하세요',
                  detail: '이 모달을 닫고, 화면 아래쪽에 표시된 <strong style="color:#34d399;">✅ 로그인 완료</strong> 초록 버튼을 눌러주세요. 다음 단계가 자동으로 시작됩니다.',
                  successCheck: '"✅ 로그인 완료"를 누르면 자동으로 다음 단계로 넘어가요.',
                  failHint: '버튼이 안 보이면 페이지를 살짝 위로 스크롤해보세요.' },
              ],
            warning: '⚠️ Chrome 창이 다른 창 뒤에 가려져 있을 수 있어요. 보이지 않으면 작업 표시줄에서 Chrome 아이콘을 클릭하거나 Alt + Tab으로 창을 전환해주세요.',
            hint: '시간이 더 필요하면 천천히 하세요. 자동화는 무한정 기다려요. 3분 넘게 멈춰있으면 자동으로 도움말이 한 번 더 뜹니다.',
            faqType: platformId === 'blogspot' ? 'blogspot-login' : 'wordpress-login',
            allowRetry: true,
          });

          // "로그인 완료" 버튼 추가 (이미 있으면 스킵)
          if (!document.getElementById(`oneclick-login-btn-${platformId}`)) {
            const stepEl = document.getElementById(`oneclick-step-${platformId}-${status.currentStep}`);
            if (stepEl) {
              const loginBtn = document.createElement('button');
              loginBtn.id = `oneclick-login-btn-${platformId}`;
              loginBtn.textContent = '✅ 로그인 완료';
              loginBtn.style.cssText = `
                padding: 8px 20px; border: none; border-radius: 8px; cursor: pointer;
                background: linear-gradient(135deg, #10b981, #059669); color: white;
                font-size: 13px; font-weight: 700; flex-shrink: 0;
                transition: all 0.2s; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
              `;
              loginBtn.onmouseenter = () => { loginBtn.style.transform = 'scale(1.05)'; };
              loginBtn.onmouseleave = () => { loginBtn.style.transform = 'scale(1)'; };
              loginBtn.onclick = async () => {
                loginBtn.disabled = true;
                loginBtn.textContent = '⏳ 확인 중...';
                loginBtn.style.opacity = '0.6';
                try {
                  await window.electronAPI?.invoke('oneclick:confirm-login', { platform: platformId });
                } catch (e) {
                  console.error('[ONECLICK] 로그인 확인 실패:', e);
                }
                loginBtn.remove();
              };
              stepEl.appendChild(loginBtn);
            }
          }
        }
      }

      if (status.completed) {
        clearPoll('platform');
        renderSetupSummary(platformId, status.stepResults || []);
        finishLiveOneclickGuide('setup', platformId, '원클릭 세팅이 완료되었습니다.', true);
        setSetupComplete(platformId);
      } else if (status.error) {
        clearPoll('platform');
        renderSetupSummary(platformId, status.stepResults || [], { failedMessage: status.error, currentStep: status.currentStep });
        updateLiveOneclickGuide('setup', platformId, {
          currentStep: status.currentStep,
          totalSteps: PLATFORMS[platformId]?.steps?.length || status.totalSteps,
          stepStatus: 'error',
          error: status.error,
          message: status.error,
        });
        setSetupFailed(platformId, status.error);
      }
    } catch {
      pfPollErrors++;
      if (pfPollErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
        clearPoll('platform');
        setSetupFailed(platformId, '연결 시간 초과 (폴링 실패 연속)');
      }
    }
  }, POLL_INTERVAL_MS);
}

function updateStepUI(platformId, stepIndex, state, message) {
  const stepEl = document.getElementById(`oneclick-step-${platformId}-${stepIndex}`);
  const iconEl = document.getElementById(`oneclick-step-icon-${platformId}-${stepIndex}`);
  const statusEl = document.getElementById(`oneclick-step-status-${platformId}-${stepIndex}`);
  // badgeEl은 프리뷰 뱃지 — 세팅 UI 내부에는 없으므로 별도 조회
  const badgeEl = document.getElementById(`oneclick-step-badge-${platformId}-${stepIndex}`) || null;

  if (!stepEl) return;

  if (state === 'running') {
    stepEl.style.background = 'rgba(59, 130, 246, 0.08)';
    stepEl.style.borderColor = 'rgba(59, 130, 246, 0.3)';
    if (iconEl) { iconEl.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)'; iconEl.style.color = 'white'; iconEl.textContent = '⏳'; }
    if (statusEl) { statusEl.textContent = message || '진행 중...'; statusEl.style.color = '#60a5fa'; }
  } else if (state === 'done') {
    stepEl.style.background = 'rgba(16, 185, 129, 0.08)';
    stepEl.style.borderColor = 'rgba(16, 185, 129, 0.3)';
    if (iconEl) { iconEl.style.background = 'linear-gradient(135deg, #10b981, #059669)'; iconEl.style.color = 'white'; iconEl.textContent = '✓'; }
    if (statusEl) { statusEl.textContent = '완료 ✅'; statusEl.style.color = '#10b981'; }
    if (badgeEl) { badgeEl.style.background = 'rgba(16, 185, 129, 0.15)'; badgeEl.style.borderColor = 'rgba(16, 185, 129, 0.3)'; badgeEl.style.color = '#10b981'; }
  } else if (state === 'waiting') {
    stepEl.style.background = 'rgba(245, 158, 11, 0.08)';
    stepEl.style.borderColor = 'rgba(245, 158, 11, 0.3)';
    if (iconEl) { iconEl.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)'; iconEl.style.color = 'white'; iconEl.textContent = '🔐'; }
    if (statusEl) { statusEl.textContent = message || '로그인 대기'; statusEl.style.color = '#fbbf24'; }
  } else if (state === 'error') {
    stepEl.style.background = 'rgba(239, 68, 68, 0.08)';
    stepEl.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    if (iconEl) { iconEl.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)'; iconEl.style.color = 'white'; iconEl.textContent = '✕'; }
    if (statusEl) { statusEl.textContent = message || '오류'; statusEl.style.color = '#ef4444'; }
  }
}

// ═══════════════════════════════════════════════
// 📋 완료 요약 화면 + Step 재시도
// ═══════════════════════════════════════════════
function renderSetupSummary(platformId, stepResults, opts = {}) {
  const host = document.getElementById(`oneclick-steps-${platformId}`) || document.getElementById(`oneclick-progress-${platformId}`);
  if (!host) return;

  const summaryId = `oneclick-summary-${platformId}`;
  const existing = document.getElementById(summaryId);
  if (existing) existing.remove();

  const ok = (stepResults || []).filter(r => r.ok);
  const fail = (stepResults || []).filter(r => !r.ok);
  const total = (stepResults || []).length;

  const box = document.createElement('div');
  box.id = summaryId;
  box.style.cssText = 'margin-top: 14px; padding: 16px; background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 12px;';

  const header = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
      <div style="font-weight:800; color:white; font-size:14px;">📋 세팅 결과 요약</div>
      <div style="font-size:12px; color:${fail.length ? '#fca5a5' : '#86efac'};">
        성공 ${ok.length} / 실패 ${fail.length} / 총 ${total}
      </div>
    </div>
  `;

  const rows = (stepResults || []).map(r => `
    <div style="display:grid; grid-template-columns:minmax(150px, 240px) 1fr; gap:10px; padding:9px 10px; margin-bottom:5px; background:${r.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)'}; border:1px solid ${r.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.25)'}; border-radius:8px; align-items:start;">
      <div style="font-size:12px; color:${r.ok ? '#86efac' : '#fca5a5'}; font-weight:700;">
        ${r.ok ? '✅' : '❌'} Step ${r.index}. ${r.label}
      </div>
      <div style="display:flex; gap:8px; align-items:flex-start; min-width:0;">
        <div style="font-size:11px; color:#cbd5e1; line-height:1.55; white-space:normal; word-break:keep-all; overflow-wrap:anywhere;">${escapeHtml(r.message || '')}</div>
        ${!r.ok ? `<button class="oneclick-retry-btn" data-platform="${platformId}" data-step="${r.index}" style="padding:4px 10px; background:linear-gradient(135deg,#ef4444,#dc2626); color:white; border:none; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">🔁 Step ${r.index} 재시도</button>` : ''}
      </div>
    </div>
  `).join('');

  const footer = opts.failedMessage
    ? `<div style="margin-top:8px; padding:8px 10px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:8px; font-size:12px; color:#fca5a5;">❌ ${opts.failedMessage}${typeof opts.currentStep === 'number' ? ` (Step ${opts.currentStep}에서 중단)` : ''}</div>`
    : `<div style="margin-top:8px; padding:8px 10px; background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.3); border-radius:8px; font-size:12px; color:#86efac;">🎉 모든 단계 완료 — 이제 글 작성 탭으로 이동해 포스팅을 시작하세요.</div>`;

  box.innerHTML = header + rows + footer;
  host.appendChild(box);

  // Step 재시도 버튼 바인딩
  box.querySelectorAll('.oneclick-retry-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const p = btn.dataset.platform;
      const s = Number(btn.dataset.step);
      if (!Number.isFinite(s)) return;
      btn.disabled = true;
      btn.textContent = '⏳ 재시도 중...';
      try {
        // 기존 입력값 재사용을 위해 localStorage에서 blogspotConfig 복원
        const raw = localStorage.getItem(`oneclick_config_${p}`);
        const cfg = raw ? JSON.parse(raw) : undefined;
        const r = await window.electronAPI.invoke('oneclick:retry-step', { platform: p, fromStep: s, blogspotConfig: cfg });
        if (!r?.ok) {
          btn.textContent = `❌ 재시도 실패: ${r?.error || '알 수 없음'}`;
        } else {
          btn.textContent = `🔁 Step ${s}부터 재시작됨`;
          // 재시도 후에는 기존 요약 박스 제거하고 재폴링 시작
          setTimeout(() => { box.remove(); if (window.__oneclickSetup?.startPollSetupStatus) window.__oneclickSetup.startPollSetupStatus(p); }, 1500);
        }
      } catch (e) {
        btn.textContent = `❌ ${e?.message || e}`;
      }
    });
  });
}

function setSetupComplete(platformId) {
  activeSetup = null;
  const platform = PLATFORMS[platformId];

  const btn = document.getElementById(`oneclick-btn-${platformId}`);
  const status = document.getElementById(`oneclick-status-${platformId}`);

  if (btn) {
    setButtonContent(btn, '✅', '세팅 완료!');
    btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    btn.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
    btn.onclick = () => startSetup(platformId);
    setTimeout(() => {
      if (btn) {
        setButtonContent(btn, '🔄', '재설정');
        btn.style.background = platform.gradient;
      }
    }, BUTTON_RESET_DELAY_MS);
  }

  if (status) {
    status.textContent = '✅ 설정 완료';
    status.style.background = 'rgba(16, 185, 129, 0.2)';
    status.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    status.style.color = '#10b981';
  }

  addLog?.(`[원클릭] ✅ ${platform?.name || platformId} 세팅 완료!`);
  showToast(`🎉 ${platform?.name || platformId} 원클릭 세팅 완료!`, 'success', 5000);
  localStorage.setItem('oneclick_setup_complete', 'true');

  // 다음번 중복 체크용 저장
  try {
    const storage = getStorageManager();
    storage.set(`setup_complete_${platformId}`, { completedAt: Date.now() }, true);
  } catch { /* 무시 */ }

  // blogId 자동 저장 (설정에 반영)
  try {
    var settings = JSON.parse(localStorage.getItem('bloggerSettings') || '{}');
    // blogId는 status에서 못 가져오지만, Blogger URL에서 추출 가능
    // 환경설정 저장 트리거
    if (window.blogger && window.blogger.saveEnv) {
      var envData = {};
      if (settings.blogId) envData.blogId = settings.blogId;
      if (settings.platform) envData.platform = settings.platform;
      if (settings.geminiKey) envData.geminiKey = settings.geminiKey;
      window.blogger.saveEnv(envData).catch(function() {});
    }
  } catch(e) { console.warn('[ONECLICK] .env 저장 실패:', e); }

  // 완료 후 "다음 단계" 안내
  setTimeout(function() {
    var container = document.getElementById('oneclick-setup-container');
    if (container) {
      var nextStepDiv = document.createElement('div');
      nextStepDiv.id = 'oneclick-next-step';
      nextStepDiv.style.cssText = 'background:linear-gradient(135deg,rgba(99,102,241,0.2),rgba(168,85,247,0.2));border:1px solid rgba(99,102,241,0.4);border-radius:12px;padding:20px;margin-top:16px;text-align:center;';
      nextStepDiv.innerHTML = '<div style="font-size:20px;margin-bottom:8px;">🎉 세팅 완료!</div>'
        + '<p style="color:rgba(255,255,255,0.8);font-size:14px;margin:0 0 16px 0;">다음 단계: 블로그 발행을 위한 인증이 필요해요</p>'
        + '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">'
        + '<button onclick="if(typeof switchSettingsTab===\'function\')switchSettingsTab(\'platform\')" style="padding:10px 20px;background:linear-gradient(135deg,#6366f1,#a855f7);border:none;border-radius:8px;color:white;font-size:13px;font-weight:600;cursor:pointer;">🔐 플랫폼 인증하기</button>'
        + '<button onclick="if(typeof switchSettingsTab===\'function\')switchSettingsTab(\'api-keys\')" style="padding:10px 20px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:white;font-size:13px;cursor:pointer;">🔑 API 키 설정</button>'
        + '</div>';
      // 기존 next-step이 있으면 제거
      var old = document.getElementById('oneclick-next-step');
      if (old) old.remove();
      container.appendChild(nextStepDiv);
    }
    // 체크리스트도 갱신
    if (typeof checkPostingReadiness === 'function') checkPostingReadiness();
  }, 1000);
}

function setSetupFailed(platformId, errorMsg) {
  activeSetup = null;
  const platform = PLATFORMS[platformId];
  finishLiveOneclickGuide('setup', platformId, errorMsg || '원클릭 세팅이 중단되었습니다.', false);

  const btn = document.getElementById(`oneclick-btn-${platformId}`);
  const status = document.getElementById(`oneclick-status-${platformId}`);

  if (btn) {
    setButtonContent(btn, '🔄', '다시 시도');
    btn.style.background = platform.gradient;
    btn.style.boxShadow = `0 6px 20px ${platform.color}40`;
    btn.onclick = () => startSetup(platformId);
  }

  if (status) {
    status.textContent = '❌ 실패';
    status.style.background = 'rgba(239, 68, 68, 0.2)';
    status.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    status.style.color = '#ef4444';
  }

  addLog?.(`[원클릭] ❌ ${platform?.name || platformId} 세팅 실패: ${errorMsg}`);
  showToast(`❌ 세팅 실패: ${errorMsg}`, 'error', 6000);
}

function cancelSetup(platformId) {
  if (activeSetup) {
    activeSetup.cancelled = true;
  }
  clearPoll('platform');
  window.electronAPI?.invoke('oneclick:cancel', { platform: platformId });

  const platform = PLATFORMS[platformId];
  const btn = document.getElementById(`oneclick-btn-${platformId}`);
  const status = document.getElementById(`oneclick-status-${platformId}`);
  const progress = document.getElementById(`oneclick-progress-${platformId}`);

  if (btn) {
    setButtonContent(btn, '▶', '세팅 시작');
    btn.style.background = platform.gradient;
    btn.style.boxShadow = `0 6px 20px ${platform.color}40`;
    btn.onclick = () => startSetup(platformId);
  }

  if (status) {
    status.textContent = '⏳ 미설정';
    status.style.background = 'rgba(100,116,139,0.2)';
    status.style.borderColor = 'rgba(100,116,139,0.3)';
    status.style.color = '#94a3b8';
  }

  if (progress) progress.style.display = 'none';
  finishLiveOneclickGuide('setup', platformId, '사용자가 원클릭 세팅을 취소했습니다.', false);
  activeSetup = null;
}

// ═══════════════════════════════════════════════
// 🔗 플랫폼 자동 연동 (WordPress / Blogger)
// ═══════════════════════════════════════════════

let activeConnect = null;

async function startPlatformConnect(platformId, options = {}) {
  const runningOp = isAnyOperationRunning();
  if (runningOp) {
    showToast(`⚠️ ${runningOp}이(가) 진행 중입니다. 완료 후 다시 시도해주세요.`, 'warn');
    return;
  }

  // 🛡️ Blogger 연동 시작 전 GCP 결제 계정 사전 검증 — 결제 미연결이면 Blogger API 활성화 차단되므로 미리 차단
  if (platformId === 'blogger' || platformId === 'blogspot') {
    try {
      const storage = getStorageManager();
      const settings = await storage.get('bloggerSettings', true) || {};
      // 이미 OAuth 자격증명이 있을 때만 사전 검증 가능 (최초 연동은 스킵)
      if (settings.googleClientId && settings.googleClientSecret && settings.googleRefreshToken) {
        showToast('🔍 GCP 결제 계정 사전 확인 중...', 'info');
        const preflight = await window.electronAPI.invoke('oneclick:preflight-gcp-billing', {
          googleClientId: settings.googleClientId,
          googleClientSecret: settings.googleClientSecret,
          googleRefreshToken: settings.googleRefreshToken,
          googleAccessToken: settings.googleAccessToken || '',
          gcpProjectId: settings.gcpProjectId || '',
        });
        if (preflight && preflight.ok === false && preflight.status === 'fail') {
          const proceed = confirm(
            `⚠️ GCP 결제 계정 미연결 감지\n\n` +
            `${preflight.message}\n\n` +
            `[확인]: 먼저 결제 계정을 연결한 뒤 다시 시도 (권장)\n` +
            `[취소]: 무시하고 계속 진행 (Blogger API 활성화 단계에서 실패할 수 있음)`,
          );
          if (proceed) {
            if (preflight.fix && window.electronAPI?.openLink) {
              window.electronAPI.openLink(preflight.fix);
            }
            return;
          }
        } else if (preflight && preflight.ok === true) {
          showToast(`✅ 결제 계정 확인: ${preflight.billingAccountName || '연결됨'}`, 'success');
        }
      }
    } catch (e) {
      console.log('[ONECLICK] preflight 건너뜀:', e?.message || e);
    }
  }

  // 이미 세팅되어 있는지 체크
  try {
    const storage = getStorageManager();
    const settings = await storage.get('bloggerSettings', true) || {};
    if (platformId === 'blogger' || platformId === 'blogspot') {
      if (settings.googleClientId && settings.googleClientSecret && settings.blogId && !options.forceFirstRun) {
        const proceed = confirm(`✅ 이미 Blogger OAuth가 세팅되어 있습니다.\n\nBlog ID: ${settings.blogId}\n\n다시 설정하시겠습니까?`);
        if (!proceed) {
          showToast('✅ 이미 세팅되어 있습니다.', 'success');
          return;
        }
      }
    } else if (platformId === 'wordpress') {
      if (settings.wordpressSiteUrl && settings.wordpressUsername && settings.wordpressPassword && !options.forceFirstRun) {
        const proceed = confirm(`✅ 이미 WordPress가 세팅되어 있습니다.\n\nSite: ${settings.wordpressSiteUrl}\n\n다시 설정하시겠습니까?`);
        if (!proceed) {
          showToast('✅ 이미 세팅되어 있습니다.', 'success');
          return;
        }
      }
    }
  } catch { /* 무시 */ }

  let siteUrl = '';

  // WordPress는 사이트 URL 필요 — 4단계 폴백으로 자동 채움
  if (platformId === 'wordpress') {
    // 1순위: 원클릭 카드 입력값 (사용자가 바로 입력한 값)
    try {
      const quickInput = document.getElementById('oneclick-wp-site-url');
      const cardInput = document.getElementById('oneclick-connect-wp-url');
      siteUrl = quickInput?.value?.trim() || cardInput?.value?.trim() || '';
      if (siteUrl) console.log('[ONECLICK-CONNECT] 📥 사이트 URL: 원클릭 카드에서 로드');
    } catch { /* 무시 */ }

    // 2순위: 플랫폼 설정 input (#wordpressSiteUrl) 현재 값
    try {
      const inputEl = document.getElementById('wordpressSiteUrl');
      if (!siteUrl && inputEl && inputEl.value && inputEl.value.trim()) {
        siteUrl = inputEl.value.trim();
        console.log('[ONECLICK-CONNECT] 📥 사이트 URL: 플랫폼 input에서 로드');
      }
    } catch { /* 무시 */ }

    // 3순위: localStorage bloggerSettings (다양한 키명 지원)
    if (!siteUrl) {
      try {
        const storage = getStorageManager();
        const settings = await storage.get('bloggerSettings', true);
        siteUrl = settings?.wordpressSiteUrl || settings?.wpSiteUrl || settings?.wordpressUrl || '';
        if (siteUrl) console.log('[ONECLICK-CONNECT] 📥 사이트 URL: bloggerSettings에서 로드');
      } catch { /* 무시 */ }
    }

    // 4순위: .env (getEnv IPC) — 외부에서 수동 편집한 .env도 흡수
    if (!siteUrl) {
      try {
        const envRes = await window.electronAPI?.getEnv?.();
        const env = envRes?.data || envRes || {};
        siteUrl = env.WORDPRESS_SITE_URL || env.WP_SITE_URL || env.WORDPRESS_URL || env.WP_URL || env.wordpressSiteUrl || '';
        if (siteUrl) console.log('[ONECLICK-CONNECT] 📥 사이트 URL: .env에서 로드');
      } catch { /* 무시 */ }
    }

    // 5순위: 모달 입력 — 위 모든 폴백 실패 시에만
    if (!siteUrl) {
      console.log('[ONECLICK-CONNECT] ⚠️ 사이트 URL 미발견 — 수동 입력 모달 표시');
      showInputModal({
        title: '워드프레스 사이트 URL 입력',
        placeholder: 'https://yourblog.com',
        onConfirm: (url) => {
          if (!url) return;
          const normalizedUrl = url.startsWith('http') ? url : 'https://' + url;
          continuePlatformConnect(platformId, normalizedUrl);
        }
      });
      return;
    }
    if (!siteUrl.startsWith('http')) siteUrl = 'https://' + siteUrl;
  }

  continuePlatformConnect(platformId, siteUrl);
}

async function continuePlatformConnect(platformId, siteUrl) {
  activeConnect = { platform: platformId, cancelled: false };
  updateLiveOneclickGuide('connect', platformId, {
    currentStep: 0,
    totalSteps: getLiveGuideSteps('connect', platformId).length,
    stepStatus: 'running',
    message: '앱 연동을 시작합니다. 필요한 로그인과 복사 작업은 이 가이드가 순서대로 안내합니다.',
  });

  // UI 업데이트
  const btn = document.getElementById(`oneclick-connect-btn-${platformId}`);
  const progressDiv = document.getElementById(`oneclick-connect-progress-${platformId}`);
  let msgDiv = document.getElementById(`oneclick-connect-msg-${platformId}`);

  if (btn) {
    setButtonContent(btn, '⏸', '연동 취소');
    btn.style.background = 'rgba(239, 68, 68, 0.3)';
    btn.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    btn.onclick = () => cancelPlatformConnect(platformId);
  }
  if (progressDiv) {
    progressDiv.style.display = 'block';
    if (!document.getElementById(`oneclick-connect-steps-${platformId}`)) {
      progressDiv.innerHTML = `
        <div id="oneclick-connect-msg-${platformId}" style="font-size: 12px; color: #c4b5fd; line-height:1.55;">준비 중...</div>
        <div id="oneclick-connect-steps-${platformId}">
          ${renderConnectStepRail(platformId, { compact: true })}
        </div>
      `;
      msgDiv = document.getElementById(`oneclick-connect-msg-${platformId}`);
    }
  }
  if (msgDiv) { msgDiv.style.display = 'block'; msgDiv.textContent = '🔄 브라우저를 여는 중...'; }

  try {
    const result = await window.electronAPI?.invoke('oneclick:platform-connect', {
      platform: platformId,
      siteUrl: siteUrl
    });

    if (!result?.ok) throw new Error(result?.error || '연동 시작 실패');

    // 상태 폴링
    clearPoll('connect');
    let cnPollErrors = 0;
    let lastPartialConnectResultJson = '';
    connectPollId = setInterval(async () => {
      if (activeConnect?.cancelled) {
        clearPoll('connect');
        return;
      }

      try {
        const status = await window.electronAPI?.invoke('oneclick:get-connect-status', { platform: platformId });
        if (!status?.ok) return;
        cnPollErrors = 0;
        updateLiveOneclickGuide('connect', platformId, {
          currentStep: status.currentStep,
          totalSteps: status.totalSteps || getLiveGuideSteps('connect', platformId).length,
          stepStatus: status.stepStatus,
          message: status.message,
          completed: status.completed,
          error: status.error,
        });

        // UI 메시지 업데이트 (textContent로 XSS 방지)
        if (msgDiv) {
          const icon = status.stepStatus === 'waiting-login' ? '🔐' :
                       status.stepStatus === 'running' ? '🔄' :
                       status.stepStatus === 'done' ? '✅' : '❌';
          msgDiv.textContent = `${icon} ${status.message}`;
        }

        if (status.stepStatus === 'waiting-login' && status.results && Object.values(status.results).some(Boolean)) {
          const partialJson = JSON.stringify(status.results);
          if (partialJson !== lastPartialConnectResultJson) {
            lastPartialConnectResultJson = partialJson;
            await saveConnectResults(platformId, status.results);
          }
        }

        // 완료 처리
        if (status.completed || status.error) {
          clearPoll('connect');
          let keepConnectUiWaitingForOauth = false;

          if (status.completed && status.results) {
            const hasSavedResults = Object.values(status.results).some(Boolean);
            // 환경설정에 자동 저장
            await saveConnectResults(platformId, status.results);
            if (msgDiv && hasSavedResults) {
              msgDiv.appendChild(document.createElement('br'));
              const savedSpan = document.createElement('span');
              savedSpan.style.cssText = 'color: #22c55e; font-size: 11px;';
              savedSpan.textContent = '✅ 추출된 값이 블로그 플랫폼 필드에 자동 저장되었습니다!';
              msgDiv.appendChild(savedSpan);
            }
            // 핵심 필드 검증
            const platformName = platformId === 'wordpress' ? 'WordPress' : 'Blogger OAuth';
            const requiredFields = platformId === 'wordpress'
              ? ['wordpressSiteUrl', 'wordpressUsername', 'wordpressPassword']
              : ['googleClientId', 'googleClientSecret', 'blogId'];
            const missing = requiredFields.filter(f => !status.results[f]);
            if (missing.length === 0) {
              if (platformId === 'blogger' || platformId === 'blogspot') {
                updateLiveOneclickGuide('connect', 'blogger', {
                  currentStep: 3,
                  totalSteps: getLiveGuideSteps('connect', 'blogger').length,
                  stepStatus: 'waiting-login',
                  message: 'Client ID/Secret/Blog ID 저장 완료. 이어서 OAuth 권한 승인 창을 엽니다.',
                });
                setOAuthHelperMessage('Client ID/Secret/Blog ID 저장 완료. 이제 Google 권한 승인까지 이어서 진행합니다.', 'success');
                const authStart = await startBloggerOAuthFromOneclick({
                  clientId: status.results.googleClientId,
                  clientSecret: status.results.googleClientSecret,
                  blogId: status.results.blogId,
                  skipPrecheck: false,
                });
                if (authStart?.ok === false) {
                  keepConnectUiWaitingForOauth = false;
                  finishLiveOneclickGuide('connect', 'blogger', '테스트 사용자 등록 확인 후 [저장 후 인증]을 다시 눌러주세요.', false);
                } else {
                  keepConnectUiWaitingForOauth = true;
                  showToast('마지막 단계: 열린 Google 인증 창에서 계속/허용을 눌러주세요.', 'info', 7000);
                }
              } else {
                finishLiveOneclickGuide('connect', platformId, '앱 연동이 완료되었습니다. 추출된 값은 환경 설정에 저장됩니다.', true);
                showToast(`🎉 ${platformName} 연동 완료! 환경설정에 자동 저장되었습니다.`, 'success', 5000);
              }
              } else {
                if (platformId === 'blogger' || platformId === 'blogspot') {
                  openBloggerPlatformFields(missing.includes('blogId') ? 'blogId' : 'googleClientId');
                } else if (platformId === 'wordpress') {
                  document.getElementById('oneclick-wordpress-manual-details')?.setAttribute('open', 'open');
                }
              finishLiveOneclickGuide('connect', platformId, '자동 추출이 일부 막혔습니다. 직접 입력 칸을 펼쳐 부족한 값을 붙여넣어 주세요.', false);
              showToast(`⚠️ ${platformName} 부분 완료: ${missing.join(', ')} 추출 실패. 화면에서 직접 복사해주세요.`, 'warn', 8000);
            }
          } else if (status.error) {
            updateLiveOneclickGuide('connect', platformId, {
              currentStep: status.currentStep,
              totalSteps: status.totalSteps || getLiveGuideSteps('connect', platformId).length,
              stepStatus: 'error',
              error: status.error,
              message: status.error,
            });
            showToast(`❌ 연동 실패: ${status.error}`, 'error');
          }

          // 버튼 복원
          if (!keepConnectUiWaitingForOauth) {
            resetConnectUI(platformId);
          }
        }
      } catch (e) {
        console.warn('[ONECLICK-CONNECT] 상태 폴링 오류:', e);
        cnPollErrors++;
        if (cnPollErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
          clearPoll('connect');
          if (msgDiv) msgDiv.textContent = '❌ 연결 시간 초과';
          finishLiveOneclickGuide('connect', platformId, '연동 상태 확인이 지연되어 중단되었습니다.', false);
          resetConnectUI(platformId);
        }
      }
    }, POLL_INTERVAL_MS);

  } catch (error) {
    console.error('[ONECLICK-CONNECT] 연동 시작 실패:', error);
    if (msgDiv) msgDiv.textContent = `❌ ${error.message}`;
    finishLiveOneclickGuide('connect', platformId, error.message || '연동 시작에 실패했습니다.', false);
    resetConnectUI(platformId);
  }
}

async function cancelPlatformConnect(platformId) {
  if (activeConnect) activeConnect.cancelled = true;
  clearPoll('connect');
  try {
    await window.electronAPI?.invoke('oneclick:cancel-connect', { platform: platformId });
  } catch { /* cancel IPC 실패 무시 — 브라우저가 이미 닫혔을 수 있음 */ }
  resetConnectUI(platformId);
  const msgDiv = document.getElementById(`oneclick-connect-msg-${platformId}`);
  if (msgDiv) msgDiv.textContent = '⏹ 취소됨';
  finishLiveOneclickGuide('connect', platformId, '사용자가 앱 연동을 취소했습니다.', false);
}

function resetConnectUI(platformId) {
  const btn = document.getElementById(`oneclick-connect-btn-${platformId}`);
  if (btn) {
    const guide = getPlatformConnectGuide(platformId);
    const label = guide?.autoLabel || (platformId === 'wordpress' ? '가이드대로 App Password 생성' : '가이드대로 OAuth 연동 시작');
    setButtonContent(btn, '🔗', label);
    btn.style.background = 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(99, 102, 241, 0.3))';
    btn.style.borderColor = 'rgba(139, 92, 246, 0.4)';
    btn.onclick = () => startPlatformConnect(platformId);
  }
  activeConnect = null;
}

function getOneclickStoredSettingsSync() {
  try {
    const raw = localStorage.getItem('bloggerSettings');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function getStoredBloggerOAuthSettings() {
  let settings = {};
  try {
    const storage = getStorageManager();
    settings = await storage.get('bloggerSettings', true) || {};
  } catch {
    settings = getOneclickStoredSettingsSync();
  }

  let env = {};
  try {
    const envRes = await window.electronAPI?.getEnv?.();
    env = envRes?.data || {};
  } catch { /* .env 로드는 선택 */ }

  return {
    googleClientId: settings.googleClientId || env.GOOGLE_CLIENT_ID || env.googleClientId || '',
    googleClientSecret: settings.googleClientSecret || env.GOOGLE_CLIENT_SECRET || env.googleClientSecret || '',
    blogId: settings.blogId || env.BLOG_ID || env.BLOGGER_ID || env.blogId || '',
    googleRefreshToken: settings.googleRefreshToken || env.GOOGLE_REFRESH_TOKEN || '',
    googleAccessToken: settings.googleAccessToken || env.GOOGLE_ACCESS_TOKEN || '',
  };
}

function setOAuthHelperMessage(message, type = 'info') {
  const msg = document.getElementById('oneclick-oauth-helper-msg');
  if (!msg) return;
  const colorMap = {
    info: '#c4b5fd',
    success: '#bbf7d0',
    warn: '#fde68a',
    error: '#fca5a5',
  };
  msg.style.display = 'block';
  msg.style.color = colorMap[type] || colorMap.info;
  msg.textContent = message;
}

function updateBloggerConnectStatusFromCredentials(creds) {
  const status = document.getElementById('oneclick-connect-status-blogger');
  if (!status) return;

  if (creds?.googleClientId && creds?.googleClientSecret && creds?.blogId) {
    status.textContent = '✅ 저장됨';
    status.style.background = 'rgba(16,185,129,0.2)';
    status.style.borderColor = 'rgba(16,185,129,0.35)';
    status.style.color = '#6ee7b7';
  } else if (creds?.googleClientId && creds?.googleClientSecret) {
    status.textContent = '🔐 OAuth 준비';
    status.style.background = 'rgba(59,130,246,0.18)';
    status.style.borderColor = 'rgba(59,130,246,0.35)';
    status.style.color = '#93c5fd';
  }
}

async function loadBloggerOAuthFields(showResult = true) {
  const creds = await getStoredBloggerOAuthSettings();
  const clientIdInput = document.getElementById('googleClientId');
  const secretInput = document.getElementById('googleClientSecret');
  const blogIdInput = document.getElementById('blogId');
  const redirectInput = document.getElementById('oneclick-oauth-redirect');

  if (clientIdInput && creds.googleClientId) clientIdInput.value = creds.googleClientId;
  if (secretInput && creds.googleClientSecret) secretInput.value = creds.googleClientSecret;
  if (blogIdInput && creds.blogId) blogIdInput.value = creds.blogId;
  [clientIdInput, secretInput, blogIdInput].forEach((el) => {
    if (el) el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  if (redirectInput) redirectInput.value = BLOGGER_OAUTH_REDIRECT_URI;

  updateBloggerConnectStatusFromCredentials(creds);
  if (showResult) {
    const ready = creds.googleClientId && creds.googleClientSecret;
    setOAuthHelperMessage(ready ? '저장된 Google OAuth 값을 블로그 플랫폼 필드에 불러왔습니다.' : '저장된 Google OAuth 값이 아직 없습니다. 블로그 플랫폼 필드에 Client ID/Secret을 입력해 주세요.', ready ? 'success' : 'warn');
  }
  return creds;
}

async function copyBloggerOAuthRedirectUri() {
  const text = BLOGGER_OAUTH_REDIRECT_URI;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const input = document.getElementById('oneclick-oauth-redirect');
    if (input) {
      input.select();
      document.execCommand('copy');
    }
  }
  setOAuthHelperMessage(`Redirect URI를 복사했습니다: ${text}`, 'success');
  showToast('Redirect URI가 복사되었습니다.', 'success');
}

function openGoogleOAuthConsole(target = 'clients') {
  const urls = {
    clients: GOOGLE_AUTH_CLIENTS_URL,
    consent: GOOGLE_AUTH_OVERVIEW_URL,
    audience: GOOGLE_AUTH_AUDIENCE_URL,
    testUsers: GOOGLE_AUTH_AUDIENCE_URL,
    bloggerApi: GOOGLE_BLOGGER_API_URL,
  };
  const url = urls[target] || GOOGLE_AUTH_CLIENTS_URL;
  if (window.electronAPI?.openLink) {
    window.electronAPI.openLink(url);
  } else if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

function openBloggerPlatformFields(focusId = 'blogId') {
  try {
    if (typeof window.switchSettingsTab === 'function') {
      window.switchSettingsTab('platform');
    } else if (typeof switchSettingsTab === 'function') {
      switchSettingsTab('platform');
    }
  } catch (e) {
    console.warn('[ONECLICK] 블로그 플랫폼 탭 전환 실패:', e);
  }

  try {
    if (typeof window.selectPlatform === 'function') {
      window.selectPlatform('blogger');
    } else if (typeof selectPlatform === 'function') {
      selectPlatform('blogger');
    }
  } catch (e) {
    console.warn('[ONECLICK] Blogger 플랫폼 선택 실패:', e);
  }

  const details = document.getElementById('bloggerAdvancedSettings');
  if (details) details.setAttribute('open', 'open');

  setTimeout(() => {
    const target = document.getElementById(focusId) || document.getElementById('blogId');
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target?.focus();
  }, 150);

  setOAuthHelperMessage('블로그 플랫폼 탭의 기존 Blogger 필드에서 값을 입력하거나 확인하세요. 원클릭 추출값도 이 필드로 자동 반영됩니다.', 'info');
}

function isBloggerOAuthAccessDeniedError(message = '') {
  return /access_denied|테스터|테스트 사용자|테스트 중|인증 절차를 완료하지|verification|not completed|only.*test/i.test(String(message || ''));
}

function showBloggerOAuthAccessDeniedHelp(detail = '') {
  document.getElementById('oneclick-oauth-access-denied-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'oneclick-oauth-access-denied-modal';
  modal.style.cssText = `
    position: fixed; inset: 0; z-index: 1000000;
    display: flex; align-items: center; justify-content: center;
    background: rgba(2, 6, 23, 0.74); backdrop-filter: blur(10px);
    padding: 24px;
  `;
  modal.innerHTML = `
    <div style="width:min(720px, 96vw); background:#111827; border:1px solid rgba(248,113,113,0.42); border-radius:18px; box-shadow:0 24px 80px rgba(0,0,0,0.45); overflow:hidden;">
      <div style="padding:18px 20px; background:linear-gradient(135deg, rgba(239,68,68,0.22), rgba(245,158,11,0.12)); border-bottom:1px solid rgba(248,113,113,0.22); display:flex; justify-content:space-between; gap:14px;">
        <div>
          <div style="font-size:18px; font-weight:900; color:#fee2e2;">Google OAuth access_denied 해결</div>
          <div style="margin-top:5px; font-size:12px; color:#fecaca; line-height:1.55;">이 오류는 보통 Client ID/Secret 문제가 아니라 Google OAuth 앱의 테스트 사용자/검증 상태 문제입니다.</div>
        </div>
        <button type="button" data-close-oauth-denied style="width:34px; height:34px; border-radius:10px; border:1px solid rgba(255,255,255,0.16); background:rgba(15,23,42,0.65); color:#e5e7eb; cursor:pointer; font-size:18px;">×</button>
      </div>
      <div style="padding:20px; color:#e5e7eb; font-size:13px; line-height:1.75;">
        <div style="padding:14px 16px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); border-radius:12px; color:#fecaca; margin-bottom:14px;">
          <strong>왜 뜨나요?</strong><br>
          OAuth 앱이 <strong>Testing</strong> 상태이면, 현재 Chrome에 로그인된 Gmail이 Google Cloud의 <strong>Audience → Test users</strong>에 등록되어 있어야 Blogger 권한 승인이 열립니다.
          등록되지 않은 계정으로 인증하면 가이드 순서가 맞아도 403 access_denied가 뜹니다.
        </div>
        <ol style="margin:0 0 14px 18px; padding:0;">
          <li><strong>테스트 사용자 열기</strong>를 눌러 현재 로그인한 Gmail을 Test users에 추가합니다.</li>
          <li>Blogger API v3가 사용 설정되어 있는지 확인합니다.</li>
          <li>앱으로 돌아와 <strong>저장 후 인증</strong>을 다시 누릅니다.</li>
          <li>지금처럼 본인 계정으로 쓰는 세팅은 앱 게시가 아니라 테스트 사용자 Gmail 추가가 정답입니다.</li>
        </ol>
        ${detail ? `<div style="max-height:96px; overflow:auto; margin-top:12px; padding:10px 12px; background:#0b1020; border:1px solid rgba(148,163,184,0.18); border-radius:10px; color:#cbd5e1; font-size:12px;">${escapeHtml(detail)}</div>` : ''}
        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:18px;">
          <button type="button" data-open-oauth-audience style="padding:11px 14px; border-radius:10px; border:1px solid rgba(34,197,94,0.35); background:rgba(34,197,94,0.16); color:#bbf7d0; font-weight:850; cursor:pointer;">테스트 사용자 열기</button>
          <button type="button" data-open-blogger-api style="padding:11px 14px; border-radius:10px; border:1px solid rgba(59,130,246,0.35); background:rgba(59,130,246,0.16); color:#bfdbfe; font-weight:850; cursor:pointer;">Blogger API 열기</button>
          <button type="button" data-open-oauth-consent style="padding:11px 14px; border-radius:10px; border:1px solid rgba(168,85,247,0.35); background:rgba(168,85,247,0.16); color:#ddd6fe; font-weight:850; cursor:pointer;">동의 화면 열기</button>
          <button type="button" data-close-oauth-denied style="padding:11px 14px; border-radius:10px; border:1px solid rgba(148,163,184,0.25); background:rgba(15,23,42,0.72); color:#e5e7eb; font-weight:850; cursor:pointer;">닫기</button>
        </div>
      </div>
    </div>
  `;
  modal.querySelectorAll('[data-close-oauth-denied]').forEach((btn) => {
    btn.addEventListener('click', () => modal.remove());
  });
  modal.querySelector('[data-open-oauth-audience]')?.addEventListener('click', () => openGoogleOAuthConsole('audience'));
  modal.querySelector('[data-open-blogger-api]')?.addEventListener('click', () => openGoogleOAuthConsole('bloggerApi'));
  modal.querySelector('[data-open-oauth-consent]')?.addEventListener('click', () => openGoogleOAuthConsole('consent'));
  document.body.appendChild(modal);
}

function isBloggerOAuthPrecheckConfirmed() {
  const checkbox = document.getElementById('oneclick-oauth-test-user-confirm');
  return !checkbox || Boolean(checkbox.checked);
}

function blockBloggerOAuthUntilTestUserConfirmed() {
  const checkbox = document.getElementById('oneclick-oauth-test-user-confirm');
  checkbox?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (checkbox) {
    const wrap = checkbox.closest('label');
    if (wrap) {
      wrap.style.boxShadow = '0 0 0 3px rgba(251,191,36,0.26)';
      setTimeout(() => { wrap.style.boxShadow = ''; }, 1600);
    }
  }
  setOAuthHelperMessage('먼저 현재 Chrome 로그인 Gmail을 Google Cloud > Audience > Test users에 추가하고 체크해주세요. 체크 전에는 403 방지를 위해 인증창을 열지 않습니다.', 'warn');
  showToast('Test users 등록 확인 후 인증을 진행해주세요.', 'warn', 6500);
  showBloggerOAuthAccessDeniedHelp('인증 전 차단: 현재 로그인 Gmail이 Test users에 등록되었는지 확인되지 않았습니다.');
}

function validateBloggerOAuthInputs(clientId, clientSecret) {
  if (!clientId || !clientSecret) {
    return 'Google Client ID와 Client Secret을 모두 입력해주세요.';
  }
  if (!/\.apps\.googleusercontent\.com$/.test(clientId)) {
    return 'Google Client ID 형식이 이상합니다. 보통 .apps.googleusercontent.com 으로 끝납니다.';
  }
  if (clientSecret.length < 8) {
    return 'Google Client Secret 값이 너무 짧습니다. 다시 복사해 주세요.';
  }
  return '';
}

async function saveBloggerOAuthCredentials(startAuthAfterSave = false) {
  const clientId = document.getElementById('googleClientId')?.value?.trim()
    || '';
  const clientSecret = document.getElementById('googleClientSecret')?.value?.trim()
    || '';
  const blogId = document.getElementById('blogId')?.value?.trim()
    || '';

  const validationError = validateBloggerOAuthInputs(clientId, clientSecret);
  if (validationError) {
    openBloggerPlatformFields(!clientId ? 'googleClientId' : 'googleClientSecret');
    setOAuthHelperMessage(validationError, 'error');
    showToast(validationError, 'warn');
    return { ok: false, error: validationError };
  }

  const storage = getStorageManager();
  const settings = await storage.get('bloggerSettings', true) || {};
  settings.googleClientId = clientId;
  settings.googleClientSecret = clientSecret;
  if (blogId) settings.blogId = blogId;
  settings.platform = 'blogger';
  settings.redirectUri = BLOGGER_OAUTH_REDIRECT_URI;
  await storage.set('bloggerSettings', settings, true);

  const envPayload = {
    googleClientId: clientId,
    googleClientSecret: clientSecret,
    googleRedirectUri: BLOGGER_OAUTH_REDIRECT_URI,
    platform: 'blogger',
  };
  if (blogId) envPayload.blogId = blogId;

  try {
    if (!window.blogger?.saveEnv) {
      throw new Error('환경 저장 IPC를 찾지 못했습니다');
    }
    const saveRes = await window.blogger?.saveEnv?.(envPayload);
    if (saveRes && saveRes.ok === false) {
      throw new Error(saveRes.error || '환경 파일 저장 실패');
    }
  } catch (e) {
    setOAuthHelperMessage(`저장소에는 저장했지만 .env 저장에 실패했습니다: ${e?.message || e}`, 'warn');
    showToast('.env 저장에 실패했습니다. 환경설정을 다시 저장해주세요.', 'warn');
    return { ok: false, error: e?.message || String(e) };
  }

  const results = { googleClientId: clientId, googleClientSecret: clientSecret, blogId };
  updateBloggerConnectStatusFromCredentials(results);
  ['googleClientId', 'googleClientSecret', 'blogId'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === 'googleClientId') el.value = clientId;
    if (id === 'googleClientSecret') el.value = clientSecret;
    if (id === 'blogId' && blogId) el.value = blogId;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });

  setOAuthHelperMessage('블로그 플랫폼 필드의 Google OAuth 값이 앱 설정과 .env에 저장되었습니다.', 'success');
  showToast('Google OAuth 값 저장 완료', 'success');

  if (startAuthAfterSave) {
    await startBloggerOAuthFromOneclick({ clientId, clientSecret, blogId });
  }

  return { ok: true };
}

async function startBloggerOAuthFromOneclick({ clientId, clientSecret, blogId, skipPrecheck = false }) {
  if (!window.electronAPI?.startBloggerAuth) {
    setOAuthHelperMessage('Blogger OAuth IPC를 찾지 못했습니다. 앱을 재시작한 뒤 다시 시도해주세요.', 'error');
    return;
  }

  if (!skipPrecheck && !isBloggerOAuthPrecheckConfirmed()) {
    blockBloggerOAuthUntilTestUserConfirmed();
    return { ok: false, error: '테스트 사용자 Gmail 추가 확인이 필요합니다.' };
  }

  updateLiveOneclickGuide('connect', 'blogger', {
    currentStep: 3,
    totalSteps: getLiveGuideSteps('connect', 'blogger').length,
    stepStatus: 'waiting-login',
    message: '마지막 단계입니다. 열린 Google 인증 창에서 계속/허용을 눌러 Blogger 권한을 승인해주세요.',
  });
  setOAuthHelperMessage('브라우저를 열고 Google 권한 승인을 기다리는 중입니다. 403 access_denied 화면이면 Google Cloud > Audience > Test users에 현재 로그인 Gmail을 추가한 뒤 다시 인증하세요.', 'info');
  const result = await window.electronAPI.startBloggerAuth({
    blogId,
    googleClientId: clientId,
    googleClientSecret: clientSecret,
  });

  if (!result?.ok) {
    const err = result?.error || '알 수 없는 오류';
    setOAuthHelperMessage(`OAuth 인증 시작 실패: ${err}`, 'error');
    if (isBloggerOAuthAccessDeniedError(err)) {
      showBloggerOAuthAccessDeniedHelp(err);
    }
    showToast(`OAuth 인증 시작 실패: ${err}`, 'error');
    return;
  }

  setOAuthHelperMessage(`브라우저에서 Google 권한을 승인해주세요. "테스터만 액세스" 403이 뜨면 [테스트 사용자] 버튼으로 현재 로그인 Gmail을 추가한 뒤 다시 누르세요. Redirect URI: ${result.redirectUri || BLOGGER_OAUTH_REDIRECT_URI}`, 'info');
  showToast('브라우저에서 Google 권한을 승인해주세요.', 'info', 6000);
}

async function startBloggerBlogIdExtract() {
  const runningOp = isAnyOperationRunning();
  if (runningOp) {
    showToast(`⚠️ ${runningOp}이(가) 진행 중입니다. 완료 후 다시 시도해주세요.`, 'warn');
    return;
  }

  activeConnect = { platform: 'blogger-blog-id', cancelled: false };
  updateLiveOneclickGuide('blogger-blog-id', 'blogger-blog-id', {
    currentStep: 0,
    totalSteps: 3,
    stepStatus: 'running',
    message: 'Blogger 관리자 화면을 열고 Blog ID 자동 추출을 준비합니다.',
  });
  setOAuthHelperMessage('Blogger 관리자 화면을 열고 Blog ID를 찾는 중입니다. Google 로그인/2FA/CAPTCHA가 나오면 창을 닫지 말고 완료해주세요. 최대 15분까지 기다립니다.', 'info');
  showToast('Blogger Blog ID 자동 가져오기를 시작합니다. 로그인 창은 오래 열어둡니다.', 'info', 6000);

  try {
    updateLiveOneclickGuide('blogger-blog-id', 'blogger-blog-id', {
      currentStep: 0,
      totalSteps: 3,
      stepStatus: 'running',
      message: '자동화 브라우저 구성요소를 확인합니다. 포맷 후 첫 실행이면 자동 설치를 진행할 수 있습니다.',
    });
    setOAuthHelperMessage('자동화 브라우저를 확인하는 중입니다. 처음 실행하는 PC에서는 Chromium 설치 때문에 몇 분 걸릴 수 있습니다.', 'info');

    const browserCheck = await window.electronAPI?.invoke('oneclick:browser-check', { autoInstall: true });
    if (!browserCheck?.ok) {
      throw new Error([
        browserCheck?.detail || '자동화 브라우저 준비에 실패했습니다.',
        browserCheck?.fix || '인터넷 연결을 확인한 뒤 다시 눌러주세요.',
      ].filter(Boolean).join('\n'));
    }

    setOAuthHelperMessage(`자동화 브라우저 준비 완료: ${browserCheck.browser || 'Chromium'}. Blogger 관리자 화면을 여는 중입니다.`, 'success');

    const result = await window.electronAPI?.invoke('oneclick:extract-blogger-blog-id');
    if (!result?.ok) throw new Error(result?.error || 'Blog ID 자동 가져오기 시작 실패');
  } catch (e) {
    activeConnect = null;
    finishLiveOneclickGuide('blogger-blog-id', 'blogger-blog-id', e?.message || 'Blog ID 자동 가져오기 시작에 실패했습니다.', false);
    setOAuthHelperMessage(`Blog ID 자동 가져오기 시작 실패: ${e?.message || e}`, 'error');
    showToast(`Blog ID 자동 가져오기 실패: ${e?.message || e}`, 'error');
    return;
  }

  clearPoll('connect');
  let pollErrors = 0;
  connectPollId = setInterval(async () => {
    if (activeConnect?.cancelled) {
      clearPoll('connect');
      return;
    }

    try {
      const status = await window.electronAPI?.invoke('oneclick:get-connect-status', { platform: 'blogger-blog-id' });
      if (!status?.ok) return;
      pollErrors = 0;
      updateLiveOneclickGuide('blogger-blog-id', 'blogger-blog-id', {
        currentStep: status.currentStep,
        totalSteps: status.totalSteps || 3,
        stepStatus: status.stepStatus,
        message: status.message,
        completed: status.completed,
        error: status.error,
      });

      const icon = status.stepStatus === 'waiting-login' ? '🔐' :
                   status.stepStatus === 'running' ? '🔎' :
                   status.stepStatus === 'done' ? '✅' : '❌';
      setOAuthHelperMessage(`${icon} ${status.message}`, status.stepStatus === 'error' ? 'error' : 'info');

      if (status.completed || status.error) {
        clearPoll('connect');
        activeConnect = null;

        if (status.completed && status.results?.blogId) {
          await saveBloggerBlogIdOnly(status.results.blogId);
          finishLiveOneclickGuide('blogger-blog-id', 'blogger-blog-id', `Blog ID를 자동으로 가져와 저장했습니다: ${status.results.blogId}`, true);
          setOAuthHelperMessage(`Blog ID를 자동으로 가져와 저장했습니다: ${status.results.blogId}`, 'success');
          showToast('Blog ID 자동 저장 완료', 'success');
        } else if (status.error) {
          updateLiveOneclickGuide('blogger-blog-id', 'blogger-blog-id', {
            currentStep: status.currentStep,
            totalSteps: status.totalSteps || 3,
            stepStatus: 'error',
            error: status.error,
            message: status.error,
          });
          setOAuthHelperMessage(status.error, 'error');
          showToast(`Blog ID 자동 가져오기 실패: ${status.error}`, 'error', 8000);
        }
      }
    } catch (e) {
      pollErrors++;
      if (pollErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
        clearPoll('connect');
        activeConnect = null;
        finishLiveOneclickGuide('blogger-blog-id', 'blogger-blog-id', 'Blog ID 자동 가져오기 상태 확인이 끊겼습니다. 다시 시도해주세요.', false);
        setOAuthHelperMessage('Blog ID 자동 가져오기 상태 확인이 끊겼습니다. 다시 시도해주세요.', 'error');
      }
    }
  }, POLL_INTERVAL_MS);
}

async function saveBloggerBlogIdOnly(blogId) {
  if (!blogId) return;
  const storage = getStorageManager();
  const settings = await storage.get('bloggerSettings', true) || {};
  settings.blogId = blogId;
  settings.platform = 'blogger';
  settings.redirectUri = BLOGGER_OAUTH_REDIRECT_URI;
  await storage.set('bloggerSettings', settings, true);

  const settingsBlogId = document.getElementById('blogId');
  if (settingsBlogId) settingsBlogId.value = blogId;
  if (settingsBlogId) settingsBlogId.dispatchEvent(new Event('input', { bubbles: true }));

  try {
    const envRes = await window.blogger?.saveEnv?.({
      blogId,
      platform: 'blogger',
      googleRedirectUri: BLOGGER_OAUTH_REDIRECT_URI,
    });
    if (envRes && envRes.ok === false) throw new Error(envRes.error || '환경 파일 저장 실패');
  } catch (e) {
    setOAuthHelperMessage(`Blog ID는 저장했지만 .env 저장에 실패했습니다: ${e?.message || e}`, 'warn');
  }

  const creds = await getStoredBloggerOAuthSettings();
  updateBloggerConnectStatusFromCredentials({ ...creds, blogId });
}

function showBloggerOAuthGuide() {
  return showUnifiedPlatformConnectGuide('blogspot');
  const existing = document.getElementById('oneclick-blogger-oauth-guide-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'oneclick-blogger-oauth-guide-modal';
  modal.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.72); backdrop-filter: blur(8px);
    z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 18px;
  `;

  const card = document.createElement('div');
  card.style.cssText = `
    width: min(720px, 96vw); max-height: 90vh; overflow-y: auto;
    background: linear-gradient(145deg, #172033, #0f172a); border: 1px solid rgba(255,255,255,0.13);
    border-radius: 18px; box-shadow: 0 28px 80px rgba(0,0,0,0.55); padding: 24px;
  `;

  card.innerHTML = `
    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:14px; margin-bottom:18px;">
      <div>
        <div style="font-size:18px; font-weight:900; color:white; letter-spacing:-0.2px;">블로그스팟 OAuth 따라하기</div>
        <div style="font-size:12px; color:#94a3b8; line-height:1.6; margin-top:5px;">
          앱이 필요한 화면을 순서대로 열어줍니다. 사용자는 Google 화면에서 클릭하고 Client ID/Secret만 복사하면 됩니다.
        </div>
      </div>
      <button type="button" data-guide-close style="padding:8px 12px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12); color:#cbd5e1; border-radius:9px; cursor:pointer; font-size:12px; font-weight:700;">닫기</button>
    </div>

    <div style="display:flex; flex-direction:column; gap:10px;">
      ${[
        ['1', '외부 사용자 + 데스크톱 앱 만들기', 'Google Cloud에서 프로젝트를 만들고 OAuth 사용자 유형은 외부, OAuth Client 유형은 데스크톱 앱으로 만듭니다.', 'Client 만들기', "window.__oneclickSetup?.openGoogleOAuthConsole('clients')"],
        ['2', 'Client ID/Secret 입력 + Blogger API 활성화', '생성된 Client ID와 Secret을 앱에 정확히 붙여넣고 Blogger API v3를 사용 설정합니다.', 'Blogger API 열기', "window.__oneclickSetup?.openGoogleOAuthConsole('bloggerApi')"],
        ['3', '앱 게시 금지 + 테스트 사용자 Gmail 추가', 'Google 인증 플랫폼 대상/Audience에서 앱을 게시하지 말고 현재 로그인 Gmail을 Test users에 추가합니다.', '테스트 사용자', "window.__oneclickSetup?.openGoogleOAuthConsole('audience')"],
        ['4', 'OAuth 인증 후 Blog ID 입력', '앱에서 OAuth 인증을 진행하고 Blogger 관리자에서 URL 맨 뒤 Blog ID를 복사해 블로그 플랫폼 필드에 저장합니다.', '플랫폼 필드', "document.getElementById('oneclick-blogger-oauth-guide-modal')?.remove(); window.__oneclickSetup?.openBloggerPlatformFields('blogId')"],
      ].map(([num, title, desc, btn, action]) => `
        <div style="display:grid; grid-template-columns:auto 1fr auto; gap:12px; align-items:center; padding:14px; background:rgba(255,255,255,0.045); border:1px solid rgba(255,255,255,0.08); border-radius:12px;">
          <div style="width:28px; height:28px; display:flex; align-items:center; justify-content:center; background:rgba(251,191,36,0.16); border:1px solid rgba(251,191,36,0.32); color:#fde047; border-radius:8px; font-size:12px; font-weight:900;">${num}</div>
          <div style="min-width:0;">
            <div style="font-size:13px; font-weight:850; color:#f8fafc;">${title}</div>
            <div style="font-size:11px; color:#cbd5e1; line-height:1.55; margin-top:3px;">${desc}</div>
          </div>
          <button type="button" onclick="${action}" style="padding:9px 11px; background:rgba(59,130,246,0.16); border:1px solid rgba(59,130,246,0.35); color:#bfdbfe; border-radius:9px; cursor:pointer; font-size:11px; font-weight:800; white-space:nowrap;">${btn}</button>
        </div>
      `).join('')}
    </div>

    <div style="margin-top:14px; padding:12px 14px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.24); border-radius:11px; color:#bbf7d0; font-size:12px; line-height:1.65;">
      영상 안내 문구 추천: “이 화면에서 순서대로 버튼을 누르고, Google에서 Client ID와 Secret 두 값만 복사해 붙여넣으면 됩니다.”
    </div>
  `;

  card.querySelector('[data-guide-close]')?.addEventListener('click', () => modal.remove());
  modal.appendChild(card);
  document.body.appendChild(modal);
  attachModalDismiss(modal);
}

function normalizeWordPressSiteUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  const withProtocol = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
  return withProtocol
    .replace(/\/wp-admin\/?$/i, '')
    .replace(/\/wp-login\.php$/i, '')
    .replace(/\/+$/, '');
}

async function getStoredWordPressSettings() {
  let settings = {};
  try {
    const storage = getStorageManager();
    settings = await storage.get('bloggerSettings', true) || {};
  } catch {
    settings = getOneclickStoredSettingsSync();
  }

  let env = {};
  try {
    const envRes = await window.electronAPI?.getEnv?.();
    env = envRes?.data || {};
  } catch { /* .env 로드는 선택 */ }

  return {
    wordpressSiteUrl: normalizeWordPressSiteUrl(
      settings.wordpressSiteUrl || settings.wpSiteUrl || env.WORDPRESS_SITE_URL || env.WP_SITE_URL || env.wordpressSiteUrl || ''
    ),
    wordpressUsername: settings.wordpressUsername || env.WORDPRESS_USERNAME || env.WP_USERNAME || env.wordpressUsername || '',
    wordpressPassword: settings.wordpressPassword || env.WORDPRESS_PASSWORD || env.WP_PASSWORD || env.wordpressPassword || '',
  };
}

function setWordPressHelperMessage(message, type = 'info') {
  const msg = document.getElementById('oneclick-wp-helper-msg');
  if (!msg) return;
  const colorMap = {
    info: '#bae6fd',
    success: '#bbf7d0',
    warn: '#fde68a',
    error: '#fca5a5',
  };
  msg.style.display = 'block';
  msg.style.color = colorMap[type] || colorMap.info;
  msg.textContent = message;
}

function updateWordPressConnectStatusFromCredentials(creds) {
  const status = document.getElementById('oneclick-connect-status-wordpress');
  if (!status) return;

  if (creds?.wordpressSiteUrl && creds?.wordpressUsername && creds?.wordpressPassword) {
    status.textContent = '✅ 저장됨';
    status.style.background = 'rgba(16,185,129,0.2)';
    status.style.borderColor = 'rgba(16,185,129,0.35)';
    status.style.color = '#6ee7b7';
  } else if (creds?.wordpressSiteUrl) {
    status.textContent = '🔐 준비 중';
    status.style.background = 'rgba(59,130,246,0.18)';
    status.style.borderColor = 'rgba(59,130,246,0.35)';
    status.style.color = '#93c5fd';
  }
}

async function loadWordPressFields(showResult = true) {
  const creds = await getStoredWordPressSettings();
  const siteInput = document.getElementById('oneclick-wp-site-url');
  const legacySiteInput = document.getElementById('oneclick-connect-wp-url');
  const usernameInput = document.getElementById('oneclick-wp-username');
  const passwordInput = document.getElementById('oneclick-wp-app-password');

  if (siteInput && creds.wordpressSiteUrl) siteInput.value = creds.wordpressSiteUrl;
  if (legacySiteInput && creds.wordpressSiteUrl) legacySiteInput.value = `${creds.wordpressSiteUrl}/wp-admin`;
  if (usernameInput && creds.wordpressUsername) usernameInput.value = creds.wordpressUsername;
  if (passwordInput && creds.wordpressPassword) passwordInput.value = creds.wordpressPassword;

  updateWordPressConnectStatusFromCredentials(creds);
  if (showResult) {
    const ready = creds.wordpressSiteUrl && creds.wordpressUsername && creds.wordpressPassword;
    setWordPressHelperMessage(ready ? '저장된 WordPress 연동 값을 불러왔습니다.' : '저장된 값이 부족합니다. 사이트 URL, 관리자 ID, Application Password를 확인해주세요.', ready ? 'success' : 'warn');
  }
  return creds;
}

function getWordPressFieldsFromUi() {
  const siteUrl = normalizeWordPressSiteUrl(
    document.getElementById('oneclick-wp-site-url')?.value?.trim()
      || document.getElementById('oneclick-connect-wp-url')?.value?.trim()
      || document.getElementById('wordpressSiteUrl')?.value?.trim()
      || ''
  );
  const username = document.getElementById('oneclick-wp-username')?.value?.trim()
    || document.getElementById('wordpressUsername')?.value?.trim()
    || '';
  const password = document.getElementById('oneclick-wp-app-password')?.value?.trim()
    || document.getElementById('wordpressPassword')?.value?.trim()
    || '';
  return { siteUrl, username, password };
}

async function openWordPressAdmin(target = 'login') {
  let { siteUrl } = getWordPressFieldsFromUi();
  if (!siteUrl) {
    const stored = await getStoredWordPressSettings();
    siteUrl = stored.wordpressSiteUrl;
  }

  if (!siteUrl) {
    setWordPressHelperMessage('먼저 WordPress 사이트 URL을 입력해주세요. 예: https://yourblog.com', 'warn');
    document.getElementById('oneclick-wp-site-url')?.focus();
    return;
  }

  const paths = {
    login: '/wp-admin',
    profile: '/wp-admin/profile.php#application-passwords-section',
    rest: '/wp-json/wp/v2',
  };
  const url = `${siteUrl}${paths[target] || paths.login}`;
  if (window.electronAPI?.openLink) {
    await window.electronAPI.openLink(url);
  } else if (window.electronAPI?.openExternal) {
    await window.electronAPI.openExternal(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  setWordPressHelperMessage(`${url} 화면을 열었습니다.`, 'info');
}

function validateWordPressInputs(siteUrl, username, password) {
  if (!siteUrl) return 'WordPress 사이트 URL을 입력해주세요.';
  if (!/^https?:\/\//i.test(siteUrl)) return 'WordPress 사이트 URL 형식이 이상합니다.';
  if (!username) return 'WordPress 관리자 ID를 입력해주세요.';
  if (!password) return 'Application Password를 입력해주세요.';
  if (password.length < 8) return 'Application Password 값이 너무 짧습니다. 프로필 화면에서 새로 복사해주세요.';
  return '';
}

async function saveWordPressCredentials(testAfterSave = false) {
  const { siteUrl, username, password } = getWordPressFieldsFromUi();
  const validationError = validateWordPressInputs(siteUrl, username, password);
  if (validationError) {
    setWordPressHelperMessage(validationError, 'error');
    showToast(validationError, 'warn');
    return { ok: false, error: validationError };
  }

  const storage = getStorageManager();
  const settings = await storage.get('bloggerSettings', true) || {};
  settings.wordpressSiteUrl = siteUrl;
  settings.wordpressUsername = username;
  settings.wordpressPassword = password;
  settings.platform = 'wordpress';
  await storage.set('bloggerSettings', settings, true);

  try {
    if (!window.blogger?.saveEnv) {
      throw new Error('환경 저장 IPC를 찾지 못했습니다');
    }
    const saveRes = await window.blogger.saveEnv({
      wordpressSiteUrl: siteUrl,
      wordpressUsername: username,
      wordpressPassword: password,
      platform: 'wordpress',
    });
    if (saveRes && saveRes.ok === false) {
      throw new Error(saveRes.error || '환경 파일 저장 실패');
    }
  } catch (e) {
    setWordPressHelperMessage(`저장소에는 저장했지만 .env 저장에 실패했습니다: ${e?.message || e}`, 'warn');
    showToast('.env 저장에 실패했습니다. 환경설정을 다시 저장해주세요.', 'warn');
    return { ok: false, error: e?.message || String(e) };
  }

  const fields = {
    wordpressSiteUrl: siteUrl,
    wordpressUsername: username,
    wordpressPassword: password,
  };
  updateWordPressConnectStatusFromCredentials(fields);
  const siteInput = document.getElementById('wordpressSiteUrl');
  const usernameInput = document.getElementById('wordpressUsername');
  const passwordInput = document.getElementById('wordpressPassword');
  const legacySiteInput = document.getElementById('oneclick-connect-wp-url');
  if (siteInput) siteInput.value = siteUrl;
  if (usernameInput) usernameInput.value = username;
  if (passwordInput) passwordInput.value = password;
  if (legacySiteInput) legacySiteInput.value = `${siteUrl}/wp-admin`;

  setWordPressHelperMessage('WordPress 연동 값이 앱 설정과 .env에 저장되었습니다.', 'success');
  showToast('WordPress 연동 값 저장 완료', 'success');

  if (testAfterSave) {
    await testWordPressRestConnection(fields);
  }
  return { ok: true };
}

async function testWordPressRestConnection(fields) {
  const input = fields || (() => {
    const { siteUrl, username, password } = getWordPressFieldsFromUi();
    return { wordpressSiteUrl: siteUrl, wordpressUsername: username, wordpressPassword: password };
  })();

  const siteUrl = normalizeWordPressSiteUrl(input.wordpressSiteUrl || input.siteUrl || '');
  const username = input.wordpressUsername || input.username || '';
  const password = input.wordpressPassword || input.password || '';
  const validationError = validateWordPressInputs(siteUrl, username, password);
  if (validationError) {
    setWordPressHelperMessage(validationError, 'error');
    return { ok: false, error: validationError };
  }

  setWordPressHelperMessage('WordPress REST API 연결을 검증 중입니다...', 'info');
  try {
    const result = window.electronAPI?.testWordPressConnection
      ? await window.electronAPI.testWordPressConnection({ siteUrl, username, password })
      : await window.electronAPI?.invoke('test-wordpress-connection', { siteUrl, username, password });

    if (result?.connected || result?.ok && result?.message && !result?.error) {
      setWordPressHelperMessage(result.message || 'WordPress REST API 연결 검증 성공. 발행 준비가 됐습니다.', 'success');
      showToast('WordPress REST API 검증 성공', 'success');
      return { ok: true };
    }

    const error = result?.error || result?.message || 'REST API 연결 검증 실패';
    setWordPressHelperMessage(error, 'error');
    showToast(`WordPress 검증 실패: ${error}`, 'error', 8000);
    return { ok: false, error };
  } catch (e) {
    setWordPressHelperMessage(`WordPress 검증 실패: ${e?.message || e}`, 'error');
    showToast(`WordPress 검증 실패: ${e?.message || e}`, 'error', 8000);
    return { ok: false, error: e?.message || String(e) };
  }
}

function showWordPressGuide() {
  return showUnifiedPlatformConnectGuide('wordpress');
  const existing = document.getElementById('oneclick-wordpress-guide-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'oneclick-wordpress-guide-modal';
  modal.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.72); backdrop-filter: blur(8px);
    z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 18px;
  `;

  const card = document.createElement('div');
  card.style.cssText = `
    width: min(740px, 96vw); max-height: 90vh; overflow-y: auto;
    background: linear-gradient(145deg, #12263a, #0f172a); border: 1px solid rgba(255,255,255,0.13);
    border-radius: 18px; box-shadow: 0 28px 80px rgba(0,0,0,0.55); padding: 24px;
  `;

  const steps = [
    ['1', '사이트 URL 입력', 'WordPress 주소를 입력합니다. /wp-admin까지 붙어 있어도 앱이 자동 정리합니다.', 'URL 입력칸', "document.getElementById('oneclick-wordpress-guide-modal')?.remove(); document.getElementById('oneclick-wp-site-url')?.focus()"],
    ['2', 'wp-admin 로그인', '앱이 관리자 화면을 열어줍니다. 보안 플러그인, 2FA, CAPTCHA가 나오면 화면에서 직접 완료하세요.', 'wp-admin 열기', "window.__oneclickSetup?.openWordPressAdmin('login')"],
    ['3', 'Application Password 화면', '프로필 하단의 Application Passwords 영역으로 이동합니다. 이름은 LEADERNAM Orbit 또는 원하는 이름으로 넣으면 됩니다.', 'App Password 열기', "window.__oneclickSetup?.openWordPressAdmin('profile')"],
    ['4', '비밀번호 복사', 'Add New Application Password를 누른 뒤 한 번만 표시되는 비밀번호를 복사해 앱 입력칸에 붙여넣습니다.', '입력칸으로 이동', "document.getElementById('oneclick-wordpress-guide-modal')?.remove(); document.getElementById('oneclick-wp-app-password')?.focus()"],
    ['5', '저장 후 검증', '앱이 /wp-json/wp/v2/users/me로 REST 인증을 확인합니다. 이 검증이 통과해야 발행 기능이 안정적으로 동작합니다.', '저장 후 검증', "window.__oneclickSetup?.saveWordPressCredentials(true)"],
  ];

  card.innerHTML = `
    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:14px; margin-bottom:18px;">
      <div>
        <div style="font-size:18px; font-weight:900; color:white; letter-spacing:-0.2px;">워드프레스 연동 따라하기</div>
        <div style="font-size:12px; color:#94a3b8; line-height:1.6; margin-top:5px;">
          막히는 구간은 로그인/보안/REST API입니다. 앱이 필요한 화면을 열고, 사용자는 Application Password만 복사합니다.
        </div>
      </div>
      <button type="button" data-guide-close style="padding:8px 12px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12); color:#cbd5e1; border-radius:9px; cursor:pointer; font-size:12px; font-weight:700;">닫기</button>
    </div>

    <div style="display:flex; flex-direction:column; gap:10px;">
      ${steps.map(([num, title, desc, btn, action]) => `
        <div style="display:grid; grid-template-columns:auto 1fr auto; gap:12px; align-items:center; padding:14px; background:rgba(255,255,255,0.045); border:1px solid rgba(255,255,255,0.08); border-radius:12px;">
          <div style="width:28px; height:28px; display:flex; align-items:center; justify-content:center; background:rgba(14,165,233,0.16); border:1px solid rgba(14,165,233,0.32); color:#bae6fd; border-radius:8px; font-size:12px; font-weight:900;">${num}</div>
          <div style="min-width:0;">
            <div style="font-size:13px; font-weight:850; color:#f8fafc;">${title}</div>
            <div style="font-size:11px; color:#cbd5e1; line-height:1.55; margin-top:3px;">${desc}</div>
          </div>
          <button type="button" onclick="${action}" style="padding:9px 11px; background:rgba(59,130,246,0.16); border:1px solid rgba(59,130,246,0.35); color:#bfdbfe; border-radius:9px; cursor:pointer; font-size:11px; font-weight:800; white-space:nowrap;">${btn}</button>
        </div>
      `).join('')}
    </div>

    <div style="margin-top:14px; padding:12px 14px; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.24); border-radius:11px; color:#fde68a; font-size:12px; line-height:1.65;">
      Application Password가 안 보이면 HTTPS 미설정, WordPress 5.6 미만, 관리자 권한 부족, 보안 플러그인 또는 REST API 차단을 먼저 확인해야 합니다.
    </div>
  `;

  card.querySelector('[data-guide-close]')?.addEventListener('click', () => modal.remove());
  modal.appendChild(card);
  document.body.appendChild(modal);
  attachModalDismiss(modal);
}

async function saveConnectResults(platformId, results) {
  try {
    const storage = getStorageManager();
    const settings = await storage.get('bloggerSettings', true) || {};

    if (platformId === 'wordpress') {
      if (results.wordpressSiteUrl) settings.wordpressSiteUrl = results.wordpressSiteUrl;
      if (results.wordpressUsername) settings.wordpressUsername = results.wordpressUsername;
      if (results.wordpressPassword) settings.wordpressPassword = results.wordpressPassword;
    } else if (platformId === 'blogger' || platformId === 'blogspot') {
      if (results.googleClientId) settings.googleClientId = results.googleClientId;
      if (results.googleClientSecret) settings.googleClientSecret = results.googleClientSecret;
      if (results.blogId) settings.blogId = results.blogId;
    }

    await storage.set('bloggerSettings', settings, true);
    addLog?.(`[원클릭] ${platformId} 연동 정보 환경설정에 저장 완료`);

    try {
      const envPayload = { platform: platformId === 'wordpress' ? 'wordpress' : 'blogger' };
      if (platformId === 'wordpress') {
        if (results.wordpressSiteUrl) envPayload.wordpressSiteUrl = results.wordpressSiteUrl;
        if (results.wordpressUsername) envPayload.wordpressUsername = results.wordpressUsername;
        if (results.wordpressPassword) envPayload.wordpressPassword = results.wordpressPassword;
      } else if (platformId === 'blogger' || platformId === 'blogspot') {
        if (results.googleClientId) envPayload.googleClientId = results.googleClientId;
        if (results.googleClientSecret) envPayload.googleClientSecret = results.googleClientSecret;
        if (results.blogId) envPayload.blogId = results.blogId;
        envPayload.googleRedirectUri = BLOGGER_OAUTH_REDIRECT_URI;
      }
      const envRes = await window.blogger?.saveEnv?.(envPayload);
      if (envRes && envRes.ok === false) {
        throw new Error(envRes.error || '환경 파일 저장 실패');
      }
      addLog?.(`[원클릭] ${platformId} 연동 정보 .env 저장 완료`);
    } catch (envErr) {
      console.warn('[ONECLICK-CONNECT] .env 저장 실패:', envErr);
      showToast('연동 값은 저장했지만 .env 저장에 실패했습니다. 환경설정 저장을 한 번 눌러주세요.', 'warn', 8000);
    }

    // 환경설정 UI도 업데이트 (열려 있다면)
    if (platformId === 'wordpress') {
      const siteUrlInput = document.getElementById('wordpressSiteUrl');
      const usernameInput = document.getElementById('wordpressUsername');
      const passwordInput = document.getElementById('wordpressPassword');
      const quickSiteInput = document.getElementById('oneclick-wp-site-url');
      const quickUsernameInput = document.getElementById('oneclick-wp-username');
      const quickPasswordInput = document.getElementById('oneclick-wp-app-password');
      const cardSiteInput = document.getElementById('oneclick-connect-wp-url');
      if (siteUrlInput && results.wordpressSiteUrl) siteUrlInput.value = results.wordpressSiteUrl;
      if (usernameInput && results.wordpressUsername) usernameInput.value = results.wordpressUsername;
      if (passwordInput && results.wordpressPassword) passwordInput.value = results.wordpressPassword;
      if (quickSiteInput && results.wordpressSiteUrl) quickSiteInput.value = normalizeWordPressSiteUrl(results.wordpressSiteUrl);
      if (quickUsernameInput && results.wordpressUsername) quickUsernameInput.value = results.wordpressUsername;
      if (quickPasswordInput && results.wordpressPassword) quickPasswordInput.value = results.wordpressPassword;
      if (cardSiteInput && results.wordpressSiteUrl) cardSiteInput.value = `${normalizeWordPressSiteUrl(results.wordpressSiteUrl)}/wp-admin`;
      updateWordPressConnectStatusFromCredentials({
        wordpressSiteUrl: results.wordpressSiteUrl,
        wordpressUsername: results.wordpressUsername,
        wordpressPassword: results.wordpressPassword,
      });
    } else if (platformId === 'blogger' || platformId === 'blogspot') {
      const clientIdInput = document.getElementById('googleClientId');
      const secretInput = document.getElementById('googleClientSecret');
      const blogIdInput = document.getElementById('blogId');
      if (clientIdInput && results.googleClientId) clientIdInput.value = results.googleClientId;
      if (secretInput && results.googleClientSecret) secretInput.value = results.googleClientSecret;
      if (blogIdInput && results.blogId) blogIdInput.value = results.blogId;
      [clientIdInput, secretInput, blogIdInput].forEach((el) => {
        if (el) el.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }

    // 우상단 플랫폼/API 상태 배지 즉시 갱신
    try {
      if (typeof window.updatePlatformStatus === 'function') window.updatePlatformStatus();
      if (typeof window.updateApiStatusIndicators === 'function') window.updateApiStatusIndicators();
      if (typeof window.updatePlatformBadge === 'function') {
        const platform = (platformId === 'wordpress') ? 'wordpress' : 'blogger';
        window.updatePlatformBadge(platform);
      }
      // 환경설정 다시 로드
      if (typeof window.loadSettings === 'function') window.loadSettings();
    } catch (e) {
      console.warn('[ONECLICK-CONNECT] 상태 배지 갱신 실패:', e);
    }
  } catch (err) {
    console.error('[ONECLICK-CONNECT] 결과 저장 실패:', err);
  }
}


// ═══════════════════════════════════════════════
// 🔒 인프라 세팅 (DNS + SSL) — UI 로직
// ═══════════════════════════════════════════════

const INFRA_STEPS = [
  { icon: '🔐', title: 'Cloudways 로그인', desc: '계정에 로그인합니다' },
  { icon: '📱', title: '앱 자동 선택', desc: 'Cloudways 앱을 자동으로 찾습니다' },
  { icon: '🌐', title: '도메인 연결', desc: '사용자 도메인을 앱에 추가합니다' },
  { icon: '🔒', title: 'SSL 인증서 설치', desc: "Let's Encrypt 인증서를 설치합니다" },
  { icon: '✅', title: 'HTTPS 확인', desc: '보안 연결이 정상 작동하는지 확인합니다' },
];

async function startInfraSetup() {
  const runningOp = isAnyOperationRunning();
  if (runningOp) {
    showToast(`⚠️ ${runningOp}이(가) 진행 중입니다. 완료 후 다시 시도해주세요.`, 'warn');
    return;
  }

  const domain = document.getElementById('oneclick-infra-domain')?.value?.trim();
  const email = document.getElementById('oneclick-infra-email')?.value?.trim();

  if (!domain) {
    showToast('🌐 도메인을 입력해주세요. (예: leadernam.com)', 'warn');
    document.getElementById('oneclick-infra-domain')?.focus();
    return;
  }

  if (!email) {
    showToast('📧 이메일을 입력해주세요. (SSL 인증서 발급에 필요합니다)', 'warn');
    document.getElementById('oneclick-infra-email')?.focus();
    return;
  }

  // URL 프로토콜 제거 (순수 도메인만)
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  window.__lastInfraDomain = cleanDomain; // 폴링 콜백에서 사용

  // 이미 인프라 세팅된 도메인인지 체크
  try {
    const storage = getStorageManager();
    const already = await storage.get(`infra_complete_${cleanDomain}`, true);
    if (already) {
      const proceed = confirm(`✅ "${cleanDomain}"의 인프라 세팅(도메인+SSL)이 이미 완료되어 있습니다.\n\n다시 진행하시겠습니까?`);
      if (!proceed) {
        showToast(`✅ 이미 인프라 세팅이 완료되어 있습니다.`, 'success');
        return;
      }
    }
  } catch { /* 무시 */ }

  activeInfra = { cancelled: false };

  // 버튼 UI — 취소 모드
  const btn = document.getElementById('oneclick-infra-btn');
  if (btn) {
    setButtonContent(btn, '⏸', '세팅 취소');
    btn.style.background = 'rgba(239, 68, 68, 0.3)';
    btn.style.boxShadow = 'none';
    btn.onclick = () => cancelInfraSetup();
  }

  // 스텝 UI 렌더링
  const progress = document.getElementById('oneclick-infra-progress');
  const stepsContainer = document.getElementById('oneclick-infra-steps');
  if (progress) progress.style.display = 'block';

  if (stepsContainer) {
    stepsContainer.innerHTML = INFRA_STEPS.map((step, i) => `
      <div id="oneclick-infra-step-${i}"
        style="display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; transition: all 0.3s;">
        <div id="oneclick-infra-step-icon-${i}"
          style="width: 32px; height: 32px; border-radius: 50%; background: rgba(100,116,139,0.2); display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0;">
          ${i + 1}
        </div>
        <div style="flex: 1;">
          <div style="font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.7);">${step.icon} ${step.title}</div>
          <div style="font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 2px;">${step.desc}</div>
        </div>
        <div id="oneclick-infra-step-status-${i}" style="font-size: 11px; color: rgba(255,255,255,0.3);">
          대기
        </div>
      </div>
    `).join('');
  }

  // IPC 호출
  try {
    console.log(`[ONECLICK-INFRA] 🚀 인프라 세팅 시작: ${cleanDomain}`);
    addLog?.(`[원클릭] 🔒 인프라 세팅 시작: ${cleanDomain} / ${email}`);

    const result = await window.electronAPI?.invoke('oneclick:start-infra', {
      domain: cleanDomain,
      email: email,
    });

    if (result?.ok) {
      listenForInfraProgress();
    } else {
      throw new Error(result?.error || '인프라 세팅 시작 실패');
    }
  } catch (error) {
    console.error('[ONECLICK-INFRA] ❌ 인프라 세팅 실패:', error);
    resetInfraUI('❌ ' + error.message);
  }
}

async function cancelInfraSetup() {
  if (activeInfra) activeInfra.cancelled = true;
  clearPoll('infra');
  try {
    await window.electronAPI?.invoke('oneclick:cancel-infra');
  } catch { /* ignore */ }
  resetInfraUI('⏹ 취소됨');
}

function resetInfraUI(message) {
  const btn = document.getElementById('oneclick-infra-btn');
  if (btn) {
    setButtonContent(btn, '▶', '인프라 자동 세팅 시작');
    btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    btn.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
    btn.onclick = () => startInfraSetup();
  }

  if (message) {
    const msgDiv = document.getElementById('oneclick-infra-msg') || (() => {
      const div = document.createElement('div');
      div.id = 'oneclick-infra-msg';
      div.style.cssText = 'margin-top: 12px; padding: 12px 16px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 10px; font-size: 12px; color: #6ee7b7;';
      document.getElementById('oneclick-infra-progress')?.parentElement?.appendChild(div);
      return div;
    })();
    if (msgDiv) {
      msgDiv.style.display = 'block';
      msgDiv.textContent = message;
    }
  }

  activeInfra = null;
}

function updateInfraStepUI(stepIndex, state, message) {
  const stepEl = document.getElementById(`oneclick-infra-step-${stepIndex}`);
  const iconEl = document.getElementById(`oneclick-infra-step-icon-${stepIndex}`);
  const statusEl = document.getElementById(`oneclick-infra-step-status-${stepIndex}`);

  if (!stepEl) return;

  if (state === 'running') {
    stepEl.style.background = 'rgba(59, 130, 246, 0.08)';
    stepEl.style.borderColor = 'rgba(59, 130, 246, 0.3)';
    if (iconEl) { iconEl.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)'; iconEl.style.color = 'white'; iconEl.textContent = '⏳'; }
    if (statusEl) { statusEl.textContent = message || '진행 중...'; statusEl.style.color = '#60a5fa'; }
  } else if (state === 'done') {
    stepEl.style.background = 'rgba(16, 185, 129, 0.08)';
    stepEl.style.borderColor = 'rgba(16, 185, 129, 0.3)';
    if (iconEl) { iconEl.style.background = 'linear-gradient(135deg, #10b981, #059669)'; iconEl.style.color = 'white'; iconEl.textContent = '✅'; }
    if (statusEl) { statusEl.textContent = message || '완료'; statusEl.style.color = '#6ee7b7'; }
  } else if (state === 'waiting') {
    stepEl.style.background = 'rgba(245, 158, 11, 0.08)';
    stepEl.style.borderColor = 'rgba(245, 158, 11, 0.3)';
    if (iconEl) { iconEl.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)'; iconEl.style.color = 'white'; iconEl.textContent = '🔐'; }
    if (statusEl) { statusEl.textContent = message || '대기 중'; statusEl.style.color = '#fbbf24'; }
  } else if (state === 'error') {
    stepEl.style.background = 'rgba(239, 68, 68, 0.08)';
    stepEl.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    if (iconEl) { iconEl.style.background = 'rgba(239, 68, 68, 0.3)'; iconEl.textContent = '❌'; }
    if (statusEl) { statusEl.textContent = message || '실패'; statusEl.style.color = '#f87171'; }
  }
}

function listenForInfraProgress() {
  clearPoll('infra');
  let pollErrors = 0;

  infraPollId = setInterval(async () => {
    if (!activeInfra || activeInfra.cancelled) {
      clearPoll('infra');
      return;
    }

    try {
      const status = await window.electronAPI?.invoke('oneclick:get-infra-status');
      if (!status?.ok) return;
      pollErrors = 0;

      if (status.currentStep !== undefined) {
        // 완료된 스텝 업데이트
        for (let i = 0; i < status.currentStep; i++) {
          updateInfraStepUI(i, 'done');
        }

        if (status.stepStatus === 'running') {
          updateInfraStepUI(status.currentStep, 'running', status.message);
          // 로그인 완료 버튼 제거
          document.getElementById('oneclick-infra-login-btn')?.remove();
        } else if (status.stepStatus === 'waiting-login') {
          updateInfraStepUI(status.currentStep, 'waiting', '🔐 Cloudways에 로그인한 뒤 아래 버튼을 눌러주세요');

          // "로그인 완료" 버튼 (이미 존재하면 스킵)
          if (!document.getElementById('oneclick-infra-login-btn')) {
            const stepEl = document.getElementById(`oneclick-infra-step-${status.currentStep}`);
            if (stepEl) {
              const loginBtn = document.createElement('button');
              loginBtn.id = 'oneclick-infra-login-btn';
              loginBtn.textContent = '✅ Cloudways 로그인 완료';
              loginBtn.style.cssText = `
                padding: 10px 24px; border: none; border-radius: 8px; cursor: pointer;
                background: linear-gradient(135deg, #10b981, #059669); color: white;
                font-size: 13px; font-weight: 700; flex-shrink: 0; margin-top: 8px;
                transition: all 0.2s; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
              `;
              loginBtn.onmouseenter = () => { loginBtn.style.transform = 'scale(1.05)'; };
              loginBtn.onmouseleave = () => { loginBtn.style.transform = 'scale(1)'; };
              loginBtn.onclick = async () => {
                loginBtn.disabled = true;
                loginBtn.textContent = '⏳ 확인 중...';
                loginBtn.style.opacity = '0.6';
                try {
                  await window.electronAPI?.invoke('oneclick:confirm-infra-login');
                } catch (e) {
                  console.error('[ONECLICK-INFRA] 로그인 확인 실패:', e);
                }
                loginBtn.remove();
              };
              stepEl.appendChild(loginBtn);
            }
          }
        } else if (status.stepStatus === 'done' && !status.completed) {
          updateInfraStepUI(status.currentStep, 'done', status.message);
        }
      }

      // 완료 처리
      if (status.completed) {
        clearPoll('infra');
        // 모든 스텝 완료 표시
        for (let i = 0; i < 5; i++) {
          updateInfraStepUI(i, 'done');
        }

        const btn = document.getElementById('oneclick-infra-btn');
        if (btn) {
          setButtonContent(btn, '✅', '인프라 세팅 완료!');
          btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
          btn.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
          btn.style.cursor = 'default';
          // 🟢 Issue #6 Fix: HTML attribute onclick도 제거 + disabled로 완전 차단
          btn.removeAttribute('onclick');
          btn.onclick = null;
          btn.disabled = true;
        }

        showToast('🎉 인프라 세팅 완료! 도메인 + SSL이 설정되었습니다.', 'success');
        addLog?.('[원클릭] 🎉 인프라 세팅 완료 (도메인 + SSL)');

        // 다음번 중복 체크용 저장
        try {
          const storage = getStorageManager();
          const dom = window.__lastInfraDomain;
          if (dom) await storage.set(`infra_complete_${dom}`, { completedAt: Date.now() }, true);
        } catch { /* 무시 */ }

        activeInfra = null;
      } else if (status.error) {
        clearPoll('infra');
        const failStep = status.currentStep || 0;
        updateInfraStepUI(failStep, 'error', status.error);
        resetInfraUI(`❌ ${status.error}`);
      }
    } catch {
      pollErrors++;
      if (pollErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
        clearPoll('infra');
        resetInfraUI('❌ 연결 시간 초과 (폴링 실패 연속)');
      }
    }
  }, POLL_INTERVAL_MS);
}


// ═══════════════════════════════════════════════
// v3.7.23: 수동 대기 안내 모달 + Silent stall watchdog
// ═══════════════════════════════════════════════

// 같은 (modalKey)는 1회만 노출 — 사용자가 닫은 뒤 다시 띄우지 않음
const _oneclickShownModals = new Set();

/**
 * v3.7.23+: 초보자 친화 큰 안내 모달.
 *   - z-index 2147483000 (브라우저 한도 근처) → 다른 모든 UI 위로 강제 노출
 *   - 본문 폰트 16~17px / 굵게·고대비 색상
 *   - 단계마다 (a) 무엇을 / (b) ✅ 성공 신호 / (c) ⚠️ 안 되면 가이드
 *   - 신호등 색상: 단계 번호 = 보라, 성공 = 녹색, 실패 가이드 = 빨강
 *   - 모달 자체에도 닫기/이해 버튼 외에 "다시 보지 않기" 옵션
 */
/**
 * v3.7.23+: 자주 발생하는 문제 FAQ — 단계별로 다르게 노출.
 *   loginType: 'blogspot-login' | 'wordpress-login' | 'stall' 등
 */
const _MANUAL_FAQ = {
  'blogspot-login': [
    { q: 'Chrome 창이 안 보여요',
      a: '① 화면 맨 아래 작업 표시줄에서 Chrome 아이콘 찾아 클릭<br>② Alt + Tab으로 창 전환<br>③ Windows 키 + D로 모든 창 최소화 → Chrome만 다시 클릭<br>④ Chrome 아이콘이 아예 없으면 자동화가 실패한 거예요. "취소" 후 다시 시작하세요.' },
    { q: 'Google 비밀번호를 모르겠어요',
      a: 'Google 로그인 페이지의 <strong>"비밀번호를 잊으셨나요?"</strong> 링크를 클릭해서 휴대폰 인증으로 재설정하세요. 시간이 걸릴 수 있으니 처음부터 다시 시작해도 됩니다.' },
    { q: '2단계 인증 휴대폰이 없어요',
      a: 'Google 계정 복구 페이지(accounts.google.com/signin/recovery)에서 백업 코드나 다른 인증 방법으로 진행하세요. 정 안 되면 이 단계를 건너뛰고 다른 계정을 사용해주세요.' },
    { q: '캡차(자동입력 방지) 이미지가 계속 떠요',
      a: '천천히 정확하게 풀어주세요. 너무 자주 틀리면 일시적으로 차단될 수 있어요. 5~10분 기다린 뒤 처음부터 다시 시도하세요.' },
    { q: '로그인 했는데 진행이 안 돼요',
      a: '아래 초록색 "✅ 로그인 완료" 버튼을 누르셨나요? 못 보면 페이지를 살짝 위로 스크롤해보세요. 그래도 안 되면 "🔄 이 단계 다시 시도"를 눌러주세요.' },
  ],
  'wordpress-login': [
    { q: 'wp-admin 페이지가 안 떠요',
      a: '입력하신 URL이 맞는지 확인하세요 (예: https://yourblog.com/wp-admin). https:// 빼먹지 마세요. URL이 틀렸으면 옆 패널에서 다시 입력해주세요.' },
    { q: '관리자 비밀번호를 모르겠어요',
      a: 'wp-admin 로그인 페이지의 <strong>"Lost your password?"</strong> 링크로 이메일 재설정 가능. WP 관리자 계정 ≠ 호스팅(카페24/Cloudways) 계정이에요. 헷갈리지 마세요.' },
    { q: 'WordPress 관리자 계정을 만든 적 없어요',
      a: '워드프레스 설치를 안 했다는 의미예요. 호스팅사 가이드 따라 WordPress 설치 → 그 과정에서 관리자 계정 생성 → 이후 다시 시도하세요.' },
    { q: '로그인 했는데 진행이 안 돼요',
      a: '왼쪽 사이드바에 "대시보드"가 보이나요? 보이면 이 앱으로 돌아와 "✅ 로그인 완료" 버튼 클릭. 안 보이면 페이지 새로고침 후 다시 시도.' },
  ],
  'stall': [
    { q: 'Chrome을 닫아버렸어요',
      a: '자동화는 실패했어요. 옆 패널에서 "취소" 버튼 누른 뒤 처음부터 다시 시작하세요.' },
    { q: 'Chrome은 열려있는데 화면이 멈춰있어요',
      a: '브라우저 자체 문제일 수 있어요. Chrome 창에서 F5 (새로고침)을 한 번 눌러보세요. 그래도 안 되면 5분 기다린 뒤 옆 패널의 "취소" → 다시 시도.' },
    { q: '캡차가 계속 떠서 진행이 안 돼요',
      a: 'Google이 일시적으로 차단한 상태예요. 10~30분 정도 기다린 뒤 다시 시도해야 풀려요. 같은 IP로 너무 자주 시도하면 더 오래 막혀요.' },
    { q: '여러 번 시도했는데 계속 같은 곳에서 멈춰요',
      a: '브라우저 캐시·쿠키 문제일 수 있어요. Chrome 설정 → 인터넷 사용 기록 삭제 → 모두 삭제 후 처음부터 다시 시도하세요.' },
  ],
};

function showManualWaitModalOnce({ modalKey, platformLabel, stepLabel, expectedTime, instructions, warning, hint, faqType, allowRetry, urgency }) {
  if (_oneclickShownModals.has(modalKey)) return;
  _oneclickShownModals.add(modalKey);

  const id = 'oneclick-manual-wait-modal';
  // 기존 모달이 있으면 제거 (중첩 방지)
  const old = document.getElementById(id);
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = id;
  // v3.7.23+: z-index 최상위 (2^31 - 1 근처). 다른 모달/팝업 위로 무조건 노출.
  modal.style.cssText = `
    position: fixed; inset: 0; z-index: 2147483000;
    background: rgba(2, 6, 23, 0.88); backdrop-filter: blur(16px) saturate(120%);
    -webkit-backdrop-filter: blur(16px) saturate(120%);
    display: flex; align-items: center; justify-content: center;
    padding: 24px; animation: oneclickModalFadeIn 0.3s ease;
  `;

  // 새 데이터 구조 지원: [{ title, detail, successCheck, failHint }, ...]
  //   하위 호환: 그냥 문자열 배열이면 단순 형태로 표시
  const safeInstructions = Array.isArray(instructions) ? instructions : [String(instructions || '')];
  const instructionsHtml = safeInstructions.map((step, i) => {
    const isStructured = step && typeof step === 'object';
    const title = isStructured ? (step.title || '') : '';
    const detail = isStructured ? (step.detail || '') : String(step || '');
    const successCheck = isStructured ? (step.successCheck || '') : '';
    const failHint = isStructured ? (step.failHint || '') : '';

    return `
      <div style="background: linear-gradient(165deg, rgba(30, 41, 59, 0.85), rgba(15, 23, 42, 0.92)); border: 1px solid rgba(99, 102, 241, 0.32); border-radius: 14px; padding: 18px 20px; margin-bottom: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.25);">
        <div style="display: flex; gap: 14px; align-items: flex-start; margin-bottom: ${(successCheck || failHint) ? '12px' : '0'};">
          <div style="flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; font-size: 16px; font-weight: 900; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">${i + 1}</div>
          <div style="flex: 1; min-width: 0;">
            ${title ? `<h3 style="margin: 4px 0 8px; color: #f1f5f9; font-size: 16px; font-weight: 800; line-height: 1.4; letter-spacing: -0.2px;">${escapeHtml(title)}</h3>` : ''}
            <div style="color: #cbd5e1; font-size: 14px; line-height: 1.75; font-weight: 500;">${detail /* 의도적으로 HTML 허용 — 화면 묘사용 <strong> */}</div>
          </div>
        </div>
        ${successCheck ? `
        <div style="margin-left: 50px; padding: 10px 14px; background: rgba(16, 185, 129, 0.1); border-left: 3px solid #10b981; border-radius: 0 8px 8px 0; font-size: 13px; color: #6ee7b7; line-height: 1.6;">
          <span style="font-weight: 900; color: #34d399;">✅ 이렇게 되면 성공:</span> ${escapeHtml(successCheck)}
        </div>` : ''}
        ${failHint ? `
        <div style="margin-left: 50px; margin-top: 8px; padding: 10px 14px; background: rgba(239, 68, 68, 0.08); border-left: 3px solid #ef4444; border-radius: 0 8px 8px 0; font-size: 13px; color: #fca5a5; line-height: 1.6;">
          <span style="font-weight: 900; color: #f87171;">⚠️ 잘 안되면:</span> ${escapeHtml(failHint)}
        </div>` : ''}
      </div>`;
  }).join('');

  modal.innerHTML = `
    <div style="position: relative; width: 100%; max-width: 720px; max-height: 92vh; background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%); border: 2px solid rgba(168, 85, 247, 0.45); border-radius: 24px; padding: 0; box-shadow: 0 60px 160px -20px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.06) inset, 0 0 80px rgba(168, 85, 247, 0.18); animation: oneclickModalZoom 0.45s cubic-bezier(0.16, 1, 0.3, 1); display: flex; flex-direction: column; overflow: hidden;">

      <!-- 헤더 -->
      <div style="padding: 28px 32px 22px; border-bottom: 1px solid rgba(148, 163, 184, 0.12); background: linear-gradient(180deg, rgba(168, 85, 247, 0.08), transparent);">
        <div style="display: flex; align-items: flex-start; gap: 18px;">
          <div style="position: relative; flex-shrink: 0;">
            <div style="width: 64px; height: 64px; border-radius: 18px; background: linear-gradient(135deg, #f59e0b, #ef4444); display: flex; align-items: center; justify-content: center; font-size: 34px; box-shadow: 0 10px 30px rgba(245, 158, 11, 0.5); animation: oneclickPulse 1.8s ease-in-out infinite;">⏸</div>
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="display: inline-block; padding: 5px 12px; background: linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(236, 72, 153, 0.2)); border: 1px solid rgba(168, 85, 247, 0.5); border-radius: 8px; color: #e9d5ff; font-size: 11px; font-weight: 900; letter-spacing: 0.12em; margin-bottom: 10px;">⏸ 자동화 일시 정지 · 직접 해주세요</div>
            <h2 style="margin: 0 0 6px; color: #ffffff; font-size: 24px; font-weight: 900; letter-spacing: -0.4px; line-height: 1.25;">${escapeHtml(platformLabel)} — ${escapeHtml(stepLabel || '수동 작업이 필요해요')}</h2>
            <p style="margin: 0; color: #cbd5e1; font-size: 15px; font-weight: 500; line-height: 1.5;">아래 단계를 <strong style="color: #fbbf24;">순서대로 천천히</strong> 따라하시면 자동화가 다시 진행됩니다. ${expectedTime ? `<span style="display: inline-block; margin-left: 8px; padding: 2px 10px; background: rgba(251, 191, 36, 0.15); border: 1px solid rgba(251, 191, 36, 0.35); border-radius: 6px; color: #fde047; font-size: 12px; font-weight: 700;">⏱ 예상 ${escapeHtml(expectedTime)}</span>` : ''}</p>
          </div>
        </div>
      </div>

      <!-- 본문 (스크롤) -->
      <div style="padding: 24px 32px; overflow-y: auto; flex: 1; min-height: 0;">
        ${instructionsHtml}
        ${warning ? `
        <div style="margin-top: 16px; padding: 16px 20px; background: linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(245, 158, 11, 0.08)); border: 2px solid rgba(239, 68, 68, 0.4); border-radius: 12px; display: flex; gap: 14px; align-items: flex-start; box-shadow: 0 4px 16px rgba(239, 68, 68, 0.15);">
          <span style="font-size: 28px; flex-shrink: 0; line-height: 1;">⚠️</span>
          <div style="flex: 1; min-width: 0; color: #fef2f2; font-size: 14px; font-weight: 600; line-height: 1.65;">${escapeHtml(warning)}</div>
        </div>` : ''}
        ${hint ? `
        <div style="margin-top: 12px; padding: 14px 18px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.32); border-radius: 11px; display: flex; gap: 12px; align-items: flex-start;">
          <span style="font-size: 20px; flex-shrink: 0; line-height: 1;">💡</span>
          <div style="flex: 1; min-width: 0; color: #dbeafe; font-size: 13px; font-weight: 500; line-height: 1.6;">${escapeHtml(hint)}</div>
        </div>` : ''}

        ${faqType && _MANUAL_FAQ[faqType] ? `
        <details style="margin-top: 18px; background: rgba(0,0,0,0.25); border: 1px solid rgba(148, 163, 184, 0.18); border-radius: 12px; overflow: hidden;">
          <summary style="padding: 14px 20px; cursor: pointer; color: #fbbf24; font-size: 14px; font-weight: 800; display: flex; align-items: center; gap: 10px; user-select: none; list-style: none;">
            <span style="font-size: 18px;">❓</span>
            <span>자주 발생하는 문제 ${_MANUAL_FAQ[faqType].length}가지 — 클릭해서 펼치기</span>
            <span style="margin-left: auto; font-size: 12px; color: #94a3b8;">▼</span>
          </summary>
          <div style="padding: 4px 20px 18px;">
            ${_MANUAL_FAQ[faqType].map((f, idx) => `
              <details style="margin-top: 8px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(148, 163, 184, 0.12); border-radius: 10px; overflow: hidden;">
                <summary style="padding: 12px 16px; cursor: pointer; color: #e2e8f0; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 10px; list-style: none;">
                  <span style="flex-shrink: 0; width: 22px; height: 22px; border-radius: 6px; background: rgba(251, 191, 36, 0.2); border: 1px solid rgba(251, 191, 36, 0.4); color: #fde047; font-size: 11px; font-weight: 900; display: inline-flex; align-items: center; justify-content: center;">Q${idx + 1}</span>
                  <span style="flex: 1; min-width: 0;">${escapeHtml(f.q)}</span>
                  <span style="font-size: 11px; color: #94a3b8;">▼</span>
                </summary>
                <div style="padding: 0 16px 14px 48px; color: #cbd5e1; font-size: 13px; line-height: 1.7; font-weight: 500;">${f.a}</div>
              </details>
            `).join('')}
          </div>
        </details>` : ''}
      </div>

      <!-- 푸터 — v3.7.23+: 회복 버튼 추가 (다시 시도 / 취소) -->
      <div style="padding: 18px 28px 24px; border-top: 1px solid rgba(148, 163, 184, 0.12); display: flex; gap: 10px; flex-wrap: wrap; justify-content: space-between; align-items: center; background: rgba(0, 0, 0, 0.25);">
        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
          ${allowRetry ? `
          <button type="button" onclick="this.closest('#${id}').remove(); window.__oneclickSetup?.cancelSetup && window.__oneclickSetup.cancelSetup();" style="padding: 11px 18px; background: rgba(239, 68, 68, 0.15); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.15s ease;" onmouseover="this.style.background='rgba(239,68,68,0.25)'" onmouseout="this.style.background='rgba(239,68,68,0.15)'">
            🚫 취소 후 처음부터
          </button>` : ''}
        </div>
        <button type="button" onclick="this.closest('#${id}').remove()" style="padding: 14px 30px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 900; cursor: pointer; box-shadow: 0 8px 24px rgba(16, 185, 129, 0.45); letter-spacing: -0.2px; transition: transform 0.15s ease;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
          ✅ 알겠어요 · 따라할게요
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // ESC로 닫기
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

// 헬퍼: escapeHtml — 모듈 자체에서 정의 (의존성 없이)
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// CSS 키프레임 1회 주입
(function injectOneclickManualCSS() {
  if (document.getElementById('oneclick-manual-css')) return;
  const style = document.createElement('style');
  style.id = 'oneclick-manual-css';
  style.textContent = `
    @keyframes oneclickModalFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes oneclickModalZoom { from { transform: translateY(20px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
    @keyframes oneclickPulse { 0%,100% { transform: scale(1); box-shadow: 0 8px 24px rgba(245, 158, 11, 0.4); } 50% { transform: scale(1.06); box-shadow: 0 8px 32px rgba(245, 158, 11, 0.6); } }
  `;
  document.head.appendChild(style);
})();

// ═══════════════════════════════════════════════
// 전역 등록
// ═══════════════════════════════════════════════

export function initOneclickSetup() {
  window.__oneclickSetup = {
    startSetup,
    cancelSetup,
    startWebmasterSetup,
    cancelWebmasterSetup,
    startPlatformConnect,
    cancelPlatformConnect,
    loadBloggerOAuthFields,
    copyBloggerOAuthRedirectUri,
    openGoogleOAuthConsole,
    openBloggerPlatformFields,
    showBloggerOAuthAccessDeniedHelp,
    saveBloggerOAuthCredentials,
    startBloggerBlogIdExtract,
    showBloggerOAuthGuide,
    showPlatformConnectGuide,
    showPlatformGuideHub,
    loadWordPressFields,
    openWordPressAdmin,
    saveWordPressCredentials,
    testWordPressRestConnection,
    showWordPressGuide,
    startInfraSetup,
    cancelInfraSetup,
    runHealthcheck,
    startOneclickAccountAddFlow,
    startOneclickFilmingMode,
    startOneclickGuideDemo,
    stopOneclickGuideDemo,
  };

  // 블로그 URL 불러오기 (이전 모듈 레벨 사이드이펙트 → init으로 이동)
  window.__loadBlogUrlFromSettings = () => loadBlogUrlToInput(true);
  setTimeout(() => {
    const urlInput = document.getElementById('oneclick-webmaster-url');
    if (urlInput && !urlInput.value) loadBlogUrlToInput(false);
  }, BLOG_URL_AUTO_LOAD_DELAY_MS);

  // 🔍 헬스체크 버튼 바인딩 (탭 렌더 후 약간의 지연)
  setTimeout(() => {
    const btn = document.getElementById('oneclick-healthcheck-btn');
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', runHealthcheck);
    }
    // 📋 시작 전 준비사항 내 도움말 링크 바인딩 (외부 URL 안전하게 열기)
    document.querySelectorAll('[data-oneclick-help]').forEach(el => {
      if (el.dataset.bound) return;
      el.dataset.bound = '1';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const key = el.dataset.oneclickHelp;
        const urls = {
          ga: 'https://support.google.com/analytics/answer/9539598', // GA4 측정 ID 찾기
          gcp: 'https://console.cloud.google.com/billing',           // GCP 결제 계정 연결
          cloudways: 'https://platform.cloudways.com/signup',        // Cloudways 가입
          gemini: 'https://aistudio.google.com/apikey',              // Gemini API 키 발급
        };
        const url = urls[key];
        if (!url) return;
        if (window.electronAPI?.openLink) {
          window.electronAPI.openLink(url);
        } else {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      });
    });

    loadBloggerOAuthFields(false).catch((e) => {
      console.warn('[ONECLICK] Blogger OAuth 필드 자동 로드 실패:', e);
    });
    loadWordPressFields(false).catch((e) => {
      console.warn('[ONECLICK] WordPress 필드 자동 로드 실패:', e);
    });

    if (window.electronAPI?.onBloggerAuthComplete && !window.__oneclickBloggerAuthListenerBound) {
      window.__oneclickBloggerAuthListenerBound = true;
      window.electronAPI.onBloggerAuthComplete((result) => {
        if (result?.ok) {
          setOAuthHelperMessage('Blogger OAuth 인증이 완료되었습니다. 이제 블로그스팟 발행을 사용할 수 있습니다.', 'success');
          finishLiveOneclickGuide('connect', 'blogger', 'Blogger OAuth 인증까지 완료되었습니다. 이제 블로그스팟 발행을 사용할 수 있습니다.', true);
          resetConnectUI('blogger');
          showToast('Blogger OAuth 인증 완료', 'success', 5000);
          loadBloggerOAuthFields(false).catch(() => {});
        } else {
          const authError = result?.error || '알 수 없는 오류';
          const accessDenied = isBloggerOAuthAccessDeniedError(authError);
          const helper = accessDenied
            ? 'Blogger OAuth 인증 실패: Google OAuth 앱이 테스트 상태입니다. [테스트 사용자] 버튼을 눌러 현재 로그인한 Gmail을 Test users에 추가한 뒤 다시 인증하세요.'
            : `Blogger OAuth 인증 실패: ${authError}`;
          setOAuthHelperMessage(helper, 'error');
          if (accessDenied) {
            showBloggerOAuthAccessDeniedHelp(authError);
          }
          finishLiveOneclickGuide('connect', 'blogger', helper, false);
          resetConnectUI('blogger');
          showToast(`Blogger OAuth 인증 실패: ${result?.error || '알 수 없는 오류'}`, 'error', 8000);
        }
      });
    }
  }, 300);

  console.log('[ONECLICK] ✅ 원클릭 세팅 모듈 초기화 완료 (웹마스터 자동화 + 플랫폼 연동 + 인프라 세팅 + 헬스체크 + 준비사항 포함)');
}

// ═══════════════════════════════════════════════
// 🔍 환경 헬스체크
// ═══════════════════════════════════════════════
async function runHealthcheck() {
  const btn = document.getElementById('oneclick-healthcheck-btn');
  const resultsEl = document.getElementById('oneclick-healthcheck-results');
  if (!btn || !resultsEl) return;

  btn.disabled = true;
  btn.textContent = '🔄 검증 중...';
  resultsEl.innerHTML = `
    <div style="padding: 14px; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 10px; color: #93c5fd; font-size: 13px;">
      저장된 자격증명으로 5개 항목을 병렬 검증 중... (최대 15초)
    </div>
  `;

  try {
    // 저장된 설정에서 자격증명 수집
    const settings = (() => {
      try {
        const raw = localStorage.getItem('bloggerSettings');
        return raw ? JSON.parse(raw) : {};
      } catch { return {}; }
    })();

    const payload = {
      blogUrl: settings.blogUrl || settings.wordpressSiteUrl || '',
      wordpressSiteUrl: settings.wordpressSiteUrl || '',
      wordpressUsername: settings.wordpressUsername || '',
      wordpressPassword: settings.wordpressPassword || '',
      googleClientId: settings.googleClientId || '',
      googleClientSecret: settings.googleClientSecret || '',
      googleAccessToken: settings.googleAccessToken || '',
      googleRefreshToken: settings.googleRefreshToken || '',
    };

    const browserStartedAt = Date.now();
    let browserCheck = null;
    try {
      browserCheck = await window.electronAPI.invoke('oneclick:browser-check', { autoInstall: true });
    } catch (browserError) {
      browserCheck = {
        ok: false,
        detail: browserError?.message || String(browserError || ''),
        fix: 'Chrome/Edge 설치 또는 Playwright Chromium 설치가 필요합니다.',
      };
    }

    const report = await window.electronAPI.invoke('oneclick:verify-only', payload);
    if (report && Array.isArray(report.items) && browserCheck) {
      report.items.unshift({
        label: '자동화 브라우저',
        status: browserCheck.ok ? 'ok' : 'fail',
        detail: browserCheck.ok
          ? `${browserCheck.browser || 'Browser'} 실행 가능`
          : (browserCheck.detail || '브라우저 실행 실패'),
        fix: browserCheck.ok ? '' : (browserCheck.fix || 'Chrome/Edge 설치 후 다시 시도하세요.'),
        elapsedMs: Date.now() - browserStartedAt,
      });
      report.ok = !!report.ok && !!browserCheck.ok;
    }
    renderHealthcheckReport(resultsEl, report);
  } catch (e) {
    resultsEl.innerHTML = `
      <div style="padding: 14px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 10px; color: #fca5a5; font-size: 13px;">
        ❌ 검증 실행 실패: ${e?.message || e}
      </div>
    `;
  } finally {
    btn.disabled = false;
    btn.textContent = '🔍 검증만 실행';
  }
}

function renderHealthcheckReport(el, report) {
  if (!report || !Array.isArray(report.items)) {
    el.innerHTML = `<div style="padding: 12px; color: #94a3b8; font-size: 13px;">검증 결과가 없습니다.</div>`;
    return;
  }
  const badge = (s) => s === 'ok' ? '🟢' : s === 'fail' ? '🔴' : '⚪';
  const bgColor = (s) => s === 'ok'
    ? 'rgba(34, 197, 94, 0.08)'
    : s === 'fail' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(100, 116, 139, 0.08)';
  const borderColor = (s) => s === 'ok'
    ? 'rgba(34, 197, 94, 0.25)'
    : s === 'fail' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(100, 116, 139, 0.25)';
  const textColor = (s) => s === 'ok' ? '#86efac' : s === 'fail' ? '#fca5a5' : '#94a3b8';

  const summary = `
    <div style="padding: 10px 14px; margin-bottom: 10px; background: ${report.ok ? 'rgba(34, 197, 94, 0.08)' : 'rgba(234, 179, 8, 0.08)'}; border: 1px solid ${report.ok ? 'rgba(34, 197, 94, 0.3)' : 'rgba(234, 179, 8, 0.3)'}; border-radius: 10px; font-size: 13px; color: ${report.ok ? '#86efac' : '#fde68a'};">
      ${report.ok ? '✅ 최소 운영 조건 충족 (Blogger 또는 WordPress 인증 성공)' : '⚠️ 일부 검증 실패 — 아래 항목 확인 필요'}
      <span style="float:right; font-size: 11px; color: #94a3b8;">${report.elapsedMs}ms</span>
    </div>
  `;

  const rows = report.items.map(it => `
    <div style="padding: 10px 12px; margin-bottom: 6px; background: ${bgColor(it.status)}; border: 1px solid ${borderColor(it.status)}; border-radius: 8px;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
        <div style="font-size: 13px; font-weight: 700; color: ${textColor(it.status)};">
          ${badge(it.status)} ${it.label}
        </div>
        <div style="font-size: 10px; color: #64748b;">${it.elapsedMs}ms</div>
      </div>
      <div style="margin-top: 4px; font-size: 12px; color: rgba(255,255,255,0.65);">${it.detail || ''}</div>
      ${it.fix ? `<div style="margin-top: 4px; font-size: 11px; color: #fbbf24;">💡 ${it.fix}</div>` : ''}
    </div>
  `).join('');

  el.innerHTML = summary + rows;
}


function renderPlatformCard(platform) {
  const stepCount = platform.steps.length;
  const isBlogspot = platform.id === 'blogspot';
  const startLabel = isBlogspot
    ? '블로그스팟 세팅 시작'
    : platform.id === 'wordpress'
      ? '사이트 세팅 시작'
      : '단계별 세팅 시작';
  const subtitle = isBlogspot
    ? `${stepCount}단계 반자동 설정 • 이름·주소는 직접, 반복 설정은 자동`
    : `${stepCount}단계 반자동 설정 • 로그인·입력은 직접, 반복 설정은 자동`;
  return `
    <div id="oneclick-card-${platform.id}"
      style="background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 24px; transition: all 0.3s;">
      
      <!-- 카드 헤더 -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 48px; height: 48px; background: ${platform.gradient}; border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 20px ${platform.color}33;">
            <span style="font-size: 24px;">${platform.icon}</span>
          </div>
          <div>
            <h4 style="margin: 0; font-weight: 800; color: white; font-size: 17px; letter-spacing: -0.3px;">
              ${platform.name} 원클릭 세팅
            </h4>
            <p style="margin: 4px 0 0; font-size: 12px; color: rgba(255,255,255,0.5);">
              ${subtitle}
            </p>
          </div>
        </div>
        <div id="oneclick-status-${platform.id}" 
          style="padding: 6px 14px; background: rgba(100,116,139,0.2); border: 1px solid rgba(100,116,139,0.3); border-radius: 20px; font-size: 11px; font-weight: 600; color: #94a3b8;">
          ⏳ 미설정
        </div>
      </div>

      <!-- 스텝 프리뷰 -->
      <div style="display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap;">
        ${platform.steps.map((step, i) => `
          <div id="oneclick-step-badge-${platform.id}-${i}" 
            style="display: flex; align-items: center; gap: 5px; padding: 5px 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; font-size: 11px; color: rgba(255,255,255,0.5);">
            <span>${step.icon}</span>
            <span>${step.title}</span>
            ${step.manual ? '<span style="color: #fbbf24; font-size: 9px;">(수동)</span>' : ''}
          </div>
        `).join('')}
      </div>

      <div style="margin-bottom: 12px; padding: 10px 12px; background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.22); border-radius: 10px; color: #fde68a; font-size: 11px; line-height: 1.55;">
        창을 띄워두면 반복 설정은 자동으로 진행하지만, 로그인·2FA·CAPTCHA·권한 승인·새 블로그 이름 입력처럼 보안상 막히는 화면은 직접 완료해야 합니다.
      </div>

      ${isBlogspot ? renderBlogspotCreationExamples() : ''}

      <!-- 시작 버튼 -->
      <button id="oneclick-btn-${platform.id}" onclick="window.__oneclickSetup?.startSetup('${platform.id}')"
        style="width: 100%; padding: 14px; background: ${platform.gradient}; color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; box-shadow: 0 6px 20px ${platform.color}40; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 8px;"
        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 30px ${platform.color}50'"
        onmouseout="this.style.transform='none'; this.style.boxShadow='0 6px 20px ${platform.color}40'">
        <span>▶</span>
        <span>${startLabel}</span>
      </button>

      <!-- 진행 상태 (기본 숨김) -->
      <div id="oneclick-progress-${platform.id}" style="display: none; margin-top: 16px;">
        <div style="display: flex; flex-direction: column; gap: 10px;" id="oneclick-steps-${platform.id}">
        </div>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════
// ⚙️ 환경설정에서 블로그 URL 불러오기
// ═══════════════════════════════════════════════

// 공통 blogUrl 로드 함수 (중복 제거)
async function loadBlogUrlToInput(showWarning = false) {
  const urlInput = document.getElementById('oneclick-webmaster-url');
  if (!urlInput) return;

  let blogUrl = '';
  let source = '';

  // 1순위: 플랫폼 설정 input (#blogUrl, #wordpressSiteUrl) — 사용자가 방금 입력하고 아직 저장 전인 값도 캐치
  try {
    const blogUrlInput = document.getElementById('blogUrl');
    const wpSiteUrlInput = document.getElementById('wordpressSiteUrl');
    if (blogUrlInput?.value?.trim()) {
      blogUrl = blogUrlInput.value.trim();
      source = '플랫폼 설정 input(blogUrl)';
    } else if (wpSiteUrlInput?.value?.trim()) {
      blogUrl = wpSiteUrlInput.value.trim();
      source = '플랫폼 설정 input(wordpressSiteUrl)';
    }
  } catch { /* 무시 */ }

  // 2순위: localStorage bloggerSettings (다양한 키명 지원)
  if (!blogUrl) {
    try {
      const storage = getStorageManager();
      const settings = await storage.get('bloggerSettings', true);
      blogUrl = settings?.blogUrl
        || settings?.wordpressSiteUrl
        || settings?.wpSiteUrl
        || settings?.wordpressUrl
        || settings?.bloggerUrl
        || '';
      if (blogUrl) source = 'bloggerSettings (저장된 설정)';
    } catch { /* 무시 */ }
  }

  // 3순위: .env (getEnv IPC) — 외부에서 수동 편집한 .env도 흡수
  if (!blogUrl) {
    try {
      const envRes = await window.electronAPI?.getEnv?.();
      const env = envRes?.data || envRes || {};
      blogUrl = env.BLOG_URL
        || env.BLOGGER_URL
        || env.WORDPRESS_SITE_URL
        || env.WP_SITE_URL
        || env.WORDPRESS_URL
        || env.WP_URL
        || '';
      if (blogUrl) source = '.env 파일';
    } catch { /* 무시 */ }
  }

  if (!blogUrl) {
    if (showWarning) {
      showToast('⚠️ 환경설정 → 플랫폼 설정 → "내 블로그 주소" 또는 "워드프레스 사이트 URL"에 값을 먼저 입력하고 저장해주세요.', 'warn', 7000);
    }
    return;
  }

  blogUrl = blogUrl.trim();
  if (!blogUrl.startsWith('http')) blogUrl = 'https://' + blogUrl;

  urlInput.value = blogUrl;
  urlInput.style.borderColor = 'rgba(245, 158, 11, 0.5)';
  // input 이벤트 트리거 — 다른 리스너에 알림
  urlInput.dispatchEvent(new Event('input', { bubbles: true }));
  addLog?.(`[원클릭] 블로그 URL 불러옴 (${source}): ${blogUrl}`);
  if (showWarning) showToast(`✅ 블로그 URL 불러옴 (${source}): ${blogUrl}`, 'success', 3500);
}

// (블로그 URL 로드 로직은 initOneclickSetup()으로 이동됨)
