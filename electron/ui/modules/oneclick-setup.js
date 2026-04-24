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

// ═══════════════════════════════════════════════
// 타이밍 상수
// ═══════════════════════════════════════════════

const POLL_INTERVAL_MS = 1500;
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
    border-radius: 20px; padding: 32px; width: 520px; max-width: 95vw; max-height: 90vh;
    overflow-y: auto; box-shadow: 0 24px 64px rgba(0,0,0,0.5);
  `;

  // 헤더
  const header = document.createElement('div');
  header.style.cssText = 'text-align: center; margin-bottom: 24px;';
  header.innerHTML = `
    <div style="font-size: 36px; margin-bottom: 8px;">🔵</div>
    <h3 style="margin: 0; font-size: 20px; font-weight: 800; color: white;">블로그스팟 세팅 정보 입력</h3>
    <p style="margin: 8px 0 0; font-size: 12px; color: rgba(255,255,255,0.45); line-height: 1.5;">
      아래 정보를 입력하면 블로그 생성부터 설정까지 <strong style="color: #FF7043;">전부 자동</strong>으로 세팅됩니다
    </p>
  `;
  card.appendChild(header);

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

  // 필드들
  card.appendChild(createField(
    '📝 블로그 제목', 'bs-title', '예: 블로소득 블로그', true,
    '주제와 관련된 키워드가 포함된 제목을 추천합니다'
  ));

  card.appendChild(createField(
    '🌐 블로그 주소 (도메인)', 'bs-address', '예: blog-income-tube', true,
    '영문 소문자, 숫자, 하이픈만 사용. {주소}.blogspot.com 형태로 생성됩니다'
  ));

  card.appendChild(createField(
    '💬 블로그 설명', 'bs-desc', '예: 블로그 수익화, 티스토리, 워드프레스 관련 정보', true,
    '검색엔진에 노출되는 설명문입니다. 키워드 중심 2~3줄 권장'
  ));

  card.appendChild(createField(
    '📊 Google 애널리틱스 측정 ID (선택)', 'bs-ga-id', '예: G-XXXXXXXXXX',
    false, 'GA4 속성이 없으면 비워두세요. 설정 위치: analytics.google.com → 관리(톱니) → 데이터 스트림 → 속성 선택 → "측정 ID" 복사. 나중에 환경설정에서도 추가 가능합니다'
  ));

  card.appendChild(createField(
    '📄 ads.txt 코드 (선택)', 'bs-adstxt', '예: google.com, pub-XXXXXXX, DIRECT, f08c47fec...',
    false, '⚠️ AdSense 승인 전이라면 반드시 비워두세요. 승인 심사는 최소 2~4주, 때로는 수개월 걸립니다. 신규 블로그는 최소 20~30개 포스팅 후 신청 권장 — 승인 후 환경설정에서 추가하세요'
  ));

  // 파비콘 파일 선택
  const faviconWrap = document.createElement('div');
  faviconWrap.style.cssText = 'margin-bottom: 20px;';
  const faviconLabel = document.createElement('label');
  faviconLabel.style.cssText = 'display: block; font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.6); margin-bottom: 6px;';
  faviconLabel.textContent = '🖼️ 파비콘 이미지 (선택)';
  const faviconRow = document.createElement('div');
  faviconRow.style.cssText = 'display: flex; gap: 8px; align-items: center;';
  const faviconPathEl = document.createElement('span');
  faviconPathEl.id = 'bs-favicon-path';
  faviconPathEl.style.cssText = 'flex: 1; padding: 12px 14px; background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; color: rgba(255,255,255,0.4); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
  faviconPathEl.textContent = '파일 미선택';
  const faviconBtn = document.createElement('button');
  faviconBtn.textContent = '📂 선택';
  faviconBtn.style.cssText = `
    padding: 12px 18px; background: linear-gradient(135deg, #6366f1, #4f46e5); border: none;
    color: white; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap;
  `;
  faviconBtn.onclick = async () => {
    try {
      const result = await window.electronAPI?.invoke('dialog:open-file', {
        title: '파비콘 이미지 선택',
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'ico', 'svg'] }]
      });
      if (result?.filePath) {
        faviconPathEl.textContent = result.filePath;
        faviconPathEl.style.color = '#10b981';
        faviconPathEl.dataset.path = result.filePath;
      }
    } catch (e) {
      console.error('[BLOGSPOT-MODAL] 파비콘 선택 실패:', e);
      showToast('⚠️ 파일 선택에 실패했습니다', 'warn');
    }
  };
  faviconRow.appendChild(faviconPathEl);
  faviconRow.appendChild(faviconBtn);
  const faviconHelp = document.createElement('p');
  faviconHelp.style.cssText = 'margin: 4px 0 0; font-size: 10px; color: rgba(255,255,255,0.35);';
  faviconHelp.textContent = '16x16 또는 32x32 PNG/ICO 권장. 검색결과에 표시되는 브랜드 아이콘입니다';
  faviconWrap.appendChild(faviconLabel);
  faviconWrap.appendChild(faviconRow);
  faviconWrap.appendChild(faviconHelp);
  card.appendChild(faviconWrap);

  // 구분선
  const divider = document.createElement('div');
  divider.style.cssText = 'height: 1px; background: rgba(255,255,255,0.08); margin: 8px 0 20px;';
  card.appendChild(divider);

  // 자동 설정 안내
  const autoInfo = document.createElement('div');
  autoInfo.style.cssText = 'padding: 14px 16px; background: rgba(255, 87, 34, 0.08); border: 1px solid rgba(255, 87, 34, 0.2); border-radius: 12px; margin-bottom: 20px;';
  autoInfo.innerHTML = `
    <div style="font-size: 12px; font-weight: 700; color: #FF7043; margin-bottom: 6px;">⚡ 아래 항목은 자동으로 최적 세팅됩니다</div>
    <div style="display: flex; flex-wrap: wrap; gap: 6px;">
      ${['검색엔진 표시 ON', 'HTTPS 활성화', '시간대: 서울', '댓글 숨기기', '이미지 라이트박스', '이미지 지연로드', 'WebP 형식', '성인콘텐츠 OFF', '글 표시 6개', '날짜 형식 yyyy.MM.dd', '메타태그 활성화', '서치콘솔 자동연동']
        .map(item => `<span style="padding: 3px 8px; background: rgba(255,255,255,0.05); border-radius: 6px; font-size: 10px; color: rgba(255,255,255,0.5);">✓ ${item}</span>`).join('')}
    </div>
  `;
  card.appendChild(autoInfo);

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
    const title = document.getElementById('bs-title')?.value?.trim();
    const address = document.getElementById('bs-address')?.value?.trim();
    const desc = document.getElementById('bs-desc')?.value?.trim();

    if (!title) { showToast('📝 블로그 제목을 입력해주세요', 'warn'); return; }
    if (!address) { showToast('🌐 블로그 주소를 입력해주세요', 'warn'); return; }
    if (!desc) { showToast('💬 블로그 설명을 입력해주세요', 'warn'); return; }

    const config = {
      blogTitle: title,
      blogAddress: address.toLowerCase().replace(/[^a-z0-9-]/g, ''),
      blogDescription: desc,
      gaId: document.getElementById('bs-ga-id')?.value?.trim() || '',
      adsTxt: document.getElementById('bs-adstxt')?.value?.trim() || '',
      faviconPath: document.getElementById('bs-favicon-path')?.dataset?.path || '',
    };

    close();
    onComplete?.(config);
  };

  modal.onclick = (e) => { if (e.target === modal) { close(); onComplete?.(null); } };

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(startBtn);
  card.appendChild(btnRow);
  modal.appendChild(card);
  document.body.appendChild(modal);
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

const PLATFORMS = {
  blogspot: {
    id: 'blogspot',
    name: '블로그스팟',
    icon: '🔵',
    color: '#FF5722',
    gradient: 'linear-gradient(135deg, #FF5722 0%, #FF7043 100%)',

    adminUrl: 'https://www.blogger.com/',
    steps: [
      { id: 'login', title: 'Google 로그인', desc: '에드센스 계정과 동일한 Google 계정으로 로그인', icon: '🔐', manual: true },
      { id: 'create-blog', title: '블로그 만들기', desc: '블로그 제목과 주소(도메인) 자동 설정', icon: '📝', manual: false },
      { id: 'settings', title: '설정 자동 최적화', desc: '검색엔진 표시, HTTPS, 시간대, 댓글, 이미지 최적화 등 13개 항목', icon: '⚙️', manual: false },
      { id: 'metatag', title: '메타태그 · GA · ads.txt', desc: '메타태그 활성화, 애널리틱스 연동, ads.txt 설정', icon: '🏷️', manual: false },
      { id: 'favicon', title: '파비콘 업로드', desc: '브랜드 아이콘(파비콘) 자동 설정', icon: '🖼️', manual: false },
      { id: 'skin', title: '리더남 클라우드 스킨 적용', desc: '수익 최적화 전용 테마 CSS 자동 적용', icon: '🎨', manual: false },
      { id: 'gsc', title: '구글 서치 콘솔 연동', desc: '서치 콘솔 자동 등록 및 사이트맵 제출', icon: '🔍', manual: false },
      { id: 'done', title: '세팅 완료!', desc: '블로그 운영을 시작하세요 🎉', icon: '✅', manual: false },
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
      { id: 'login', title: 'WP 관리자 로그인', desc: '브라우저에서 워드프레스 관리자 페이지에 로그인해주세요', icon: '🔐', manual: true },
      { id: 'theme', title: '테마 CSS 자동 적용', desc: '커스터마이저에서 리더남 스킨 CSS를 적용합니다', icon: '🎨', manual: false },
      { id: 'plugins', title: '필수 플러그인 설치', desc: 'Classic Editor, Yoast SEO 등 필수 플러그인 자동 설치', icon: '🔌', manual: false },
      { id: 'permalink', title: '고유주소 설정', desc: 'SEO에 최적화된 고유주소 구조로 변경합니다', icon: '🔗', manual: false },
      { id: 'naver-search', title: '네이버 서치어드바이저 등록', desc: '네이버 검색에 블로그를 등록합니다', icon: '🔍', manual: true },
      { id: 'google-search-console', title: '구글 서치 콘솔 등록', desc: '구글 검색에 블로그를 등록합니다', icon: '🔍', manual: true },
    ]
  }
};

// ═══════════════════════════════════════════════
// UI 렌더링
// ═══════════════════════════════════════════════

export function renderOneclickSetupTab() {
  return `
    <div style="display: flex; flex-direction: column; gap: 24px;">
      <!-- 헤더 -->
      <div style="text-align: center; padding: 20px 0 8px;">
        <div style="font-size: 32px; margin-bottom: 8px;">🚀</div>
        <h3 style="margin: 0; font-size: 22px; font-weight: 800; color: white; letter-spacing: -0.5px;">
          원클릭 블로그 세팅
        </h3>
        <p style="margin: 8px 0 0; font-size: 13px; color: rgba(255,255,255,0.5); line-height: 1.6;">
          반자동 세팅 — 로그인과 필수 입력은 직접, 설정·등록 반복작업은 자동으로 처리합니다
        </p>
      </div>

      <!-- 📋 시작 전 준비사항 (초보 구매자 기대치 관리) -->
      <div id="oneclick-prereq" style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(234, 179, 8, 0.35); border-radius: 16px; padding: 20px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px;">
          <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #eab308, #ca8a04); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 20px;">📋</span>
          </div>
          <div>
            <h4 style="margin: 0; font-weight: 800; color: white; font-size: 16px; letter-spacing: -0.3px;">시작 전 준비사항</h4>
            <p style="margin: 3px 0 0; font-size: 11px; color: #fde68a;">아래 항목이 준비되어야 원클릭이 끊기지 않고 완주됩니다</p>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; color: rgba(255,255,255,0.75);">
          <div style="padding: 10px 12px; background: rgba(234, 179, 8, 0.08); border: 1px solid rgba(234, 179, 8, 0.2); border-radius: 8px;">
            <div style="font-weight: 700; color: #fde047;">🔵 블로그스팟 쪽</div>
            <ul style="margin: 6px 0 0; padding-left: 18px; line-height: 1.7;">
              <li>Google 계정 (2단계 인증 해제 권장)</li>
              <li>블로그 제목·주소 (신규 생성 시)</li>
              <li>파비콘 이미지 (16×16 PNG/ICO, 선택)</li>
              <li><strong>GA4 측정 ID</strong> — 선택. <a href="#" data-oneclick-help="ga" style="color:#93c5fd;">구하는 법</a></li>
              <li><strong>AdSense pub-ID</strong> — 승인 후 입력 (승인 최소 2~4주, 지금은 비워두세요)</li>
              <li><strong>GCP 결제 계정</strong> — Blogger OAuth 연동 시 필요. <a href="#" data-oneclick-help="gcp" style="color:#93c5fd;">연결하기</a></li>
            </ul>
          </div>
          <div style="padding: 10px 12px; background: rgba(234, 179, 8, 0.08); border: 1px solid rgba(234, 179, 8, 0.2); border-radius: 8px;">
            <div style="font-weight: 700; color: #fde047;">🟠 워드프레스/인프라 쪽</div>
            <ul style="margin: 6px 0 0; padding-left: 18px; line-height: 1.7;">
              <li>도메인 구입 (가비아·Namecheap 등에서 사전 구매)</li>
              <li><strong>Cloudways 계정 + 앱 생성</strong> — 인프라 자동화는 앱이 이미 만들어진 상태에서 시작합니다. <a href="#" data-oneclick-help="cloudways" style="color:#93c5fd;">가입하기</a></li>
              <li>도메인 DNS A레코드를 Cloudways 서버 IP로 변경 (전파 24~48시간)</li>
              <li>WordPress 관리자 계정 (ID/비밀번호)</li>
              <li>Gemini API 키 (무료). <a href="#" data-oneclick-help="gemini" style="color:#93c5fd;">발급</a></li>
            </ul>
          </div>
        </div>
        <div style="margin-top: 12px; padding: 10px 12px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 8px; font-size: 12px; color: #fca5a5;">
          ⚠️ 위 항목이 준비되지 않은 채 원클릭을 시작하면 중간에 실패하거나 수동 작업이 발생할 수 있습니다. 예상 소요 시간: <strong>5~15분</strong> (로그인·입력 포함, DNS 전파 제외).
        </div>
      </div>

      <!-- 🔍 환경 헬스체크 (이미 수동 세팅한 사용자용) -->
      <div id="oneclick-healthcheck" style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(59, 130, 246, 0.35); border-radius: 16px; padding: 20px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 20px rgba(59, 130, 246, 0.25);">
              <span style="font-size: 20px;">🔍</span>
            </div>
            <div>
              <h4 style="margin: 0; font-weight: 800; color: white; font-size: 16px; letter-spacing: -0.3px;">환경 헬스체크</h4>
              <p style="margin: 3px 0 0; font-size: 11px; color: #94a3b8;">이미 수동으로 세팅을 마쳤다면 — 원클릭을 다시 돌리지 않고 현재 상태만 검증합니다</p>
            </div>
          </div>
          <button id="oneclick-healthcheck-btn" style="padding: 10px 16px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap;">
            🔍 검증만 실행
          </button>
        </div>
        <div id="oneclick-healthcheck-results" style="margin-top: 8px;"></div>
      </div>

      <!-- 블로그스팟 카드 -->
      ${renderPlatformCard(PLATFORMS.blogspot)}

      <!-- 워드프레스 카드 -->
      ${renderPlatformCard(PLATFORMS.wordpress)}

      <!-- 🔗 앱 연동 (Blogger OAuth / WordPress 연결) -->
      <div style="background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 16px; padding: 24px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #8b5cf6, #6d28d9); border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 20px rgba(139, 92, 246, 0.3);">
            <span style="font-size: 22px;">🔗</span>
          </div>
          <div>
            <h4 style="margin: 0; font-weight: 800; color: white; font-size: 17px; letter-spacing: -0.3px;">앱 ↔ 플랫폼 원클릭 연동</h4>
            <p style="margin: 4px 0 0; font-size: 11px; color: #a78bfa;">GCP OAuth 자동 설정 + Blog ID 추출 / WordPress Application Password 생성</p>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          <!-- 블로그스팟 연동 카드 -->
          <div id="oneclick-connect-card-blogger" style="padding: 16px 18px; background: rgba(255, 87, 34, 0.12); border: 1px solid rgba(255, 87, 34, 0.3); border-radius: 14px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
              <div>
                <div style="font-size: 14px; font-weight: 800; color: #FF7043;">🔵 블로그스팟 앱 연동</div>
                <div style="font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 2px;">GCP 프로젝트 생성 → Blogger API 활성화 → OAuth 설정 → Blog ID 추출</div>
              </div>
              <div id="oneclick-connect-status-blogger" style="padding: 4px 10px; background: rgba(100,116,139,0.2); border: 1px solid rgba(100,116,139,0.3); border-radius: 12px; font-size: 10px; font-weight: 600; color: #94a3b8;">
                ⏳ 미연동
              </div>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;">
              <span style="padding: 4px 8px; background: rgba(255,255,255,0.06); border-radius: 6px; font-size: 10px; color: rgba(255,255,255,0.5);">✓ GCP 프로젝트 자동 생성</span>
              <span style="padding: 4px 8px; background: rgba(255,255,255,0.06); border-radius: 6px; font-size: 10px; color: rgba(255,255,255,0.5);">✓ Blogger API 활성화</span>
              <span style="padding: 4px 8px; background: rgba(255,255,255,0.06); border-radius: 6px; font-size: 10px; color: rgba(255,255,255,0.5);">✓ OAuth Client ID/Secret 추출</span>
              <span style="padding: 4px 8px; background: rgba(255,255,255,0.06); border-radius: 6px; font-size: 10px; color: rgba(255,255,255,0.5);">✓ Blog ID 자동 추출</span>
            </div>
            <div id="oneclick-connect-msg-blogger" style="display: none; padding: 10px 14px; background: rgba(0,0,0,0.2); border-radius: 8px; margin-bottom: 10px; font-size: 12px; color: #a78bfa; transition: all 0.3s;"></div>
            <button id="oneclick-connect-btn-blogger" onclick="window.__oneclickSetup?.startPlatformConnect('blogger')"
              style="width: 100%; padding: 11px; background: linear-gradient(135deg, #FF5722, #FF7043); color: white; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.2); transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 6px;"
              onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
              <span>▶</span><span>자동 연동 시작</span>
            </button>
          </div>

          <!-- 워드프레스 연동 카드 -->
          <div id="oneclick-connect-card-wordpress" style="padding: 16px 18px; background: rgba(33, 117, 155, 0.12); border: 1px solid rgba(33, 117, 155, 0.3); border-radius: 14px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
              <div>
                <div style="font-size: 14px; font-weight: 800; color: #4fc3f7;">🟣 워드프레스 앱 연동</div>
                <div style="font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 2px;">관리자 로그인 → Application Password 자동 생성</div>
              </div>
              <div id="oneclick-connect-status-wordpress" style="padding: 4px 10px; background: rgba(100,116,139,0.2); border: 1px solid rgba(100,116,139,0.3); border-radius: 12px; font-size: 10px; font-weight: 600; color: #94a3b8;">
                ⏳ 미연동
              </div>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;">
              <span style="padding: 4px 8px; background: rgba(255,255,255,0.06); border-radius: 6px; font-size: 10px; color: rgba(255,255,255,0.5);">✓ wp-admin 자동 접속</span>
              <span style="padding: 4px 8px; background: rgba(255,255,255,0.06); border-radius: 6px; font-size: 10px; color: rgba(255,255,255,0.5);">✓ Application Password 생성</span>
              <span style="padding: 4px 8px; background: rgba(255,255,255,0.06); border-radius: 6px; font-size: 10px; color: rgba(255,255,255,0.5);">✓ 자격증명 자동 저장</span>
            </div>
            <div id="oneclick-connect-msg-wordpress" style="display: none; padding: 10px 14px; background: rgba(0,0,0,0.2); border-radius: 8px; margin-bottom: 10px; font-size: 12px; color: #4fc3f7; transition: all 0.3s;"></div>
            <div id="oneclick-connect-wp-url-wrap" style="margin-bottom: 10px;">
              <input id="oneclick-connect-wp-url" type="text" placeholder="https://yourblog.com/wp-admin"
                style="width: 100%; padding: 10px 14px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; color: white; font-size: 13px; outline: none; box-sizing: border-box;" />
            </div>
            <button id="oneclick-connect-btn-wordpress" onclick="window.__oneclickSetup?.startPlatformConnect('wordpress')"
              style="width: 100%; padding: 11px; background: linear-gradient(135deg, #21759B, #0073AA); color: white; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.2); transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 6px;"
              onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
              <span>▶</span><span>자동 연동 시작</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 🔍 웹마스터도구 자동 세팅 -->
      <div style="background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 16px; padding: 24px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
          <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 20px rgba(245, 158, 11, 0.3);">
            <span style="font-size: 22px;">🔍</span>
          </div>
          <div>
            <h4 style="margin: 0; font-weight: 800; color: white; font-size: 17px; letter-spacing: -0.3px;">웹마스터도구 최적 세팅</h4>
            <p style="margin: 4px 0 0; font-size: 11px; color: #fbbf24;">로그인만 해주세요! 사이트맵, RSS, 색인 요청까지 자동 설정 (4대 검색엔진)</p>
          </div>
        </div>

        <!-- 블로그 URL 입력 (환경설정에서 불러오기) -->
        <div style="margin: 16px 0; padding: 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;">
          <label style="display: block; font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.6); margin-bottom: 8px;">📍 등록할 블로그 주소</label>
          <div style="display: flex; gap: 8px; align-items: center;">
            <input id="oneclick-webmaster-url" type="text" placeholder="https://yourblog.com"
              style="flex: 1; padding: 12px 16px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; color: white; font-size: 14px; outline: none; box-sizing: border-box;"
              oninput="this.style.borderColor = this.value ? 'rgba(245, 158, 11, 0.5)' : 'rgba(255,255,255,0.15)'"
            />
            <button id="oneclick-load-blog-url" onclick="window.__loadBlogUrlFromSettings && window.__loadBlogUrlFromSettings()"
              style="padding: 12px 16px; background: linear-gradient(135deg, #f59e0b, #d97706); border: none; border-radius: 10px; color: white; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap; transition: all 0.2s;"
              onmouseover="this.style.transform='scale(1.05)'"
              onmouseout="this.style.transform='scale(1)'"
            >⚙️ 설정에서 불러오기</button>
          </div>
          <p style="margin: 6px 0 0; font-size: 11px; color: rgba(255,255,255,0.4);">
            💡 환경설정 → 플랫폼 설정 → <strong style="color: #fbbf24;">내 블로그 주소</strong>에 저장된 URL을 불러옵니다
          </p>
        </div>

        <!-- 4개 웹마스터도구 카드 -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${renderWebmasterCard({ id: 'google', title: '🔵 구글 서치 콘솔', subtitle: 'Google Search Console',
            bgColor: 'rgba(66, 133, 244, 0.15)', borderColor: 'rgba(66, 133, 244, 0.3)', textColor: '#93bbfc', gradient: 'linear-gradient(135deg, #4285f4, #1a73e8)',
            features: ['URL 접두어 방식 사이트 추가', '사이트맵 자동 제출 (/sitemap.xml)', '색인 생성 요청'] })}
          ${renderWebmasterCard({ id: 'naver', title: '🟢 네이버 서치어드바이저', subtitle: 'Naver Search Advisor',
            bgColor: 'rgba(0, 200, 83, 0.15)', borderColor: 'rgba(0, 200, 83, 0.3)', textColor: '#6ee7b7', gradient: 'linear-gradient(135deg, #00c853, #009624)',
            features: ['사이트 자동 추가', '사이트맵 제출 (/sitemap.xml)', 'RSS 피드 등록', '웹 페이지 수집 요청'] })}
          ${renderWebmasterCard({ id: 'daum', title: '🔷 다음 웹마스터도구', subtitle: 'Daum Webmaster Tools (PIN 인증)',
            bgColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.3)', textColor: '#93c5fd', gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            features: ['PIN코드 자동 발급 (webmaster.daum.net/join)', 'PIN 인증 자동 처리', 'RSS 피드 등록'] })}
          ${renderWebmasterCard({ id: 'bing', title: '🟠 Bing 웹마스터도구', subtitle: 'Bing Webmaster Tools',
            bgColor: 'rgba(242, 142, 38, 0.15)', borderColor: 'rgba(242, 142, 38, 0.3)', textColor: '#fbbf24', gradient: 'linear-gradient(135deg, #f28e26, #e67e22)',
            features: ['Microsoft 로그인 → 사이트 추가', '사이트맵 자동 제출', 'URL 제출'] })}
        </div>

        <!-- 진행 상태 영역 -->
        <div id="oneclick-webmaster-progress" style="display: none; margin-top: 16px;">
          <div id="oneclick-webmaster-steps" style="display: flex; flex-direction: column; gap: 8px;"></div>
        </div>
      </div>

      <!-- 🔒 인프라 세팅 (Cloudways DNS + SSL) — 워드프레스 전용 -->
      <div style="background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 16px; padding: 24px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
          <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 20px rgba(16, 185, 129, 0.3);">
            <span style="font-size: 22px;">🔒</span>
          </div>
          <div>
            <h4 style="margin: 0; font-weight: 800; color: white; font-size: 17px; letter-spacing: -0.3px;">인프라 원클릭 세팅</h4>
            <p style="margin: 4px 0 0; font-size: 11px; color: #6ee7b7;">Cloudways 도메인 연결 + SSL 인증서 자동 설치 (워드프레스 전용)</p>
          </div>
        </div>

        <!-- 안내 배너 -->
        <div style="margin: 12px 0; padding: 12px 16px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 10px;">
          <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.5); line-height: 1.6;">
            💡 <strong style="color: #6ee7b7;">사전 준비:</strong> 도메인 등록업체(가비아 등)에서 A레코드를 Cloudways 서버 IP로 설정해주세요.
            <br>이후 Cloudways 로그인만 하면 도메인 연결 → SSL 인증서 설치까지 자동으로 완료됩니다!
          </p>
        </div>

        <!-- 도메인 & 이메일 입력 -->
        <div style="margin: 16px 0; display: flex; flex-direction: column; gap: 10px;">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.6); margin-bottom: 6px;">🌐 도메인</label>
            <input id="oneclick-infra-domain" type="text" placeholder="leadernam.com"
              style="width: 100%; padding: 12px 16px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; color: white; font-size: 14px; outline: none; box-sizing: border-box;"
              oninput="this.style.borderColor = this.value ? 'rgba(16, 185, 129, 0.5)' : 'rgba(255,255,255,0.15)'"
            />
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.6); margin-bottom: 6px;">📧 이메일 (SSL 인증용)</label>
            <input id="oneclick-infra-email" type="email" placeholder="your@email.com"
              style="width: 100%; padding: 12px 16px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; color: white; font-size: 14px; outline: none; box-sizing: border-box;"
              oninput="this.style.borderColor = this.value ? 'rgba(16, 185, 129, 0.5)' : 'rgba(255,255,255,0.15)'"
            />
          </div>
        </div>

        <!-- 5단계 프리뷰 뱃지 -->
        <div style="display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap;">
          <span style="padding: 5px 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; font-size: 11px; color: rgba(255,255,255,0.5);">🔐 로그인 <span style="color: #fbbf24; font-size: 9px;">(수동)</span></span>
          <span style="padding: 5px 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; font-size: 11px; color: rgba(255,255,255,0.5);">📱 앱 선택</span>
          <span style="padding: 5px 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; font-size: 11px; color: rgba(255,255,255,0.5);">🌐 도메인</span>
          <span style="padding: 5px 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; font-size: 11px; color: rgba(255,255,255,0.5);">🔒 SSL</span>
          <span style="padding: 5px 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; font-size: 11px; color: rgba(255,255,255,0.5);">✅ HTTPS</span>
        </div>

        <!-- 시작 버튼 -->
        <button id="oneclick-infra-btn" onclick="window.__oneclickSetup?.startInfraSetup()"
          style="width: 100%; padding: 14px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4); transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 8px;"
          onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 30px rgba(16, 185, 129, 0.5)'"
          onmouseout="this.style.transform='none'; this.style.boxShadow='0 6px 20px rgba(16, 185, 129, 0.4)'">
          <span>▶</span>
          <span>인프라 자동 세팅 시작</span>
        </button>

        <!-- 진행 상태 (기본 숨김) -->
        <div id="oneclick-infra-progress" style="display: none; margin-top: 16px;">
          <div id="oneclick-infra-steps" style="display: flex; flex-direction: column; gap: 8px;"></div>
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

async function startSetup(platformId) {
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
    if (already) {
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
  activeSetup = { platform: platformId, stepIndex: 0, cancelled: false };

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
  platformPollId = setInterval(async () => {
    if (!activeSetup || activeSetup.cancelled || activeSetup.platform !== platformId) {
      clearPoll('platform');
      return;
    }

    try {
      const status = await window.electronAPI?.invoke('oneclick:get-status', { platform: platformId });
      if (!status) return;
      pfPollErrors = 0;

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
        setSetupComplete(platformId);
      } else if (status.error) {
        clearPoll('platform');
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
  activeSetup = null;
}

// ═══════════════════════════════════════════════
// 🔗 플랫폼 자동 연동 (WordPress / Blogger)
// ═══════════════════════════════════════════════

let activeConnect = null;

async function startPlatformConnect(platformId) {
  const runningOp = isAnyOperationRunning();
  if (runningOp) {
    showToast(`⚠️ ${runningOp}이(가) 진행 중입니다. 완료 후 다시 시도해주세요.`, 'warn');
    return;
  }

  // 이미 세팅되어 있는지 체크
  try {
    const storage = getStorageManager();
    const settings = await storage.get('bloggerSettings', true) || {};
    if (platformId === 'blogger' || platformId === 'blogspot') {
      if (settings.googleClientId && settings.googleClientSecret && settings.blogId) {
        const proceed = confirm(`✅ 이미 Blogger OAuth가 세팅되어 있습니다.\n\nBlog ID: ${settings.blogId}\n\n다시 설정하시겠습니까?`);
        if (!proceed) {
          showToast('✅ 이미 세팅되어 있습니다.', 'success');
          return;
        }
      }
    } else if (platformId === 'wordpress') {
      if (settings.wordpressSiteUrl && settings.wordpressUsername && settings.wordpressPassword) {
        const proceed = confirm(`✅ 이미 WordPress가 세팅되어 있습니다.\n\nSite: ${settings.wordpressSiteUrl}\n\n다시 설정하시겠습니까?`);
        if (!proceed) {
          showToast('✅ 이미 세팅되어 있습니다.', 'success');
          return;
        }
      }
    }
  } catch { /* 무시 */ }

  let siteUrl = '';

  // WordPress는 사이트 URL 필요
  if (platformId === 'wordpress') {
    // 환경설정에서 먼저 불러오기 시도
    try {
      const storage = getStorageManager();
      const settings = await storage.get('bloggerSettings', true);
      if (settings?.wordpressSiteUrl) {
        siteUrl = settings.wordpressSiteUrl;
      }
    } catch { /* 환경설정 미저장 시 무시 — 아래 모달에서 수동 입력 */ }

    if (!siteUrl) {
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

  // UI 업데이트
  const btn = document.getElementById(`oneclick-connect-btn-${platformId}`);
  const progressDiv = document.getElementById(`oneclick-connect-progress-${platformId}`);
  const msgDiv = document.getElementById(`oneclick-connect-msg-${platformId}`);

  if (btn) {
    setButtonContent(btn, '⏸', '연동 취소');
    btn.style.background = 'rgba(239, 68, 68, 0.3)';
    btn.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    btn.onclick = () => cancelPlatformConnect(platformId);
  }
  if (progressDiv) progressDiv.style.display = 'block';
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
    connectPollId = setInterval(async () => {
      if (activeConnect?.cancelled) {
        clearPoll('connect');
        return;
      }

      try {
        const status = await window.electronAPI?.invoke('oneclick:get-connect-status', { platform: platformId });
        if (!status?.ok) return;
        cnPollErrors = 0;

        // UI 메시지 업데이트 (textContent로 XSS 방지)
        if (msgDiv) {
          const icon = status.stepStatus === 'waiting-login' ? '🔐' :
                       status.stepStatus === 'running' ? '🔄' :
                       status.stepStatus === 'done' ? '✅' : '❌';
          msgDiv.textContent = `${icon} ${status.message}`;
        }

        // 완료 처리
        if (status.completed || status.error) {
          clearPoll('connect');

          if (status.completed && status.results) {
            // 환경설정에 자동 저장
            await saveConnectResults(platformId, status.results);
            if (msgDiv) {
              msgDiv.appendChild(document.createElement('br'));
              const savedSpan = document.createElement('span');
              savedSpan.style.cssText = 'color: #22c55e; font-size: 11px;';
              savedSpan.textContent = '✅ 추출된 값이 환경설정에 자동 저장되었습니다!';
              msgDiv.appendChild(savedSpan);
            }
            // 핵심 필드 검증
            const platformName = platformId === 'wordpress' ? 'WordPress' : 'Blogger OAuth';
            const requiredFields = platformId === 'wordpress'
              ? ['wordpressSiteUrl', 'wordpressUsername', 'wordpressPassword']
              : ['googleClientId', 'googleClientSecret', 'blogId'];
            const missing = requiredFields.filter(f => !status.results[f]);
            if (missing.length === 0) {
              showToast(`🎉 ${platformName} 연동 완료! 환경설정에 자동 저장되었습니다.`, 'success', 5000);
            } else {
              showToast(`⚠️ ${platformName} 부분 완료: ${missing.join(', ')} 추출 실패. 화면에서 직접 복사해주세요.`, 'warn', 8000);
            }
          } else if (status.error) {
            showToast(`❌ 연동 실패: ${status.error}`, 'error');
          }

          // 버튼 복원
          resetConnectUI(platformId);
        }
      } catch (e) {
        console.warn('[ONECLICK-CONNECT] 상태 폴링 오류:', e);
        cnPollErrors++;
        if (cnPollErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
          clearPoll('connect');
          if (msgDiv) msgDiv.textContent = '❌ 연결 시간 초과';
          resetConnectUI(platformId);
        }
      }
    }, POLL_INTERVAL_MS);

  } catch (error) {
    console.error('[ONECLICK-CONNECT] 연동 시작 실패:', error);
    if (msgDiv) msgDiv.textContent = `❌ ${error.message}`;
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
}

function resetConnectUI(platformId) {
  const btn = document.getElementById(`oneclick-connect-btn-${platformId}`);
  if (btn) {
    const label = platformId === 'wordpress' ? 'Application Password 자동 생성' : 'GCP OAuth 자동 설정 (API 연동)';
    setButtonContent(btn, '🔗', label);
    btn.style.background = 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(99, 102, 241, 0.3))';
    btn.style.borderColor = 'rgba(139, 92, 246, 0.4)';
    btn.onclick = () => startPlatformConnect(platformId);
  }
  activeConnect = null;
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

    // 환경설정 UI도 업데이트 (열려 있다면)
    if (platformId === 'wordpress') {
      const siteUrlInput = document.getElementById('wordpressSiteUrl');
      const usernameInput = document.getElementById('wordpressUsername');
      const passwordInput = document.getElementById('wordpressPassword');
      if (siteUrlInput && results.wordpressSiteUrl) siteUrlInput.value = results.wordpressSiteUrl;
      if (usernameInput && results.wordpressUsername) usernameInput.value = results.wordpressUsername;
      if (passwordInput && results.wordpressPassword) passwordInput.value = results.wordpressPassword;
    } else if (platformId === 'blogger' || platformId === 'blogspot') {
      const clientIdInput = document.getElementById('googleClientId');
      const secretInput = document.getElementById('googleClientSecret');
      const blogIdInput = document.getElementById('blogId');
      if (clientIdInput && results.googleClientId) clientIdInput.value = results.googleClientId;
      if (secretInput && results.googleClientSecret) secretInput.value = results.googleClientSecret;
      if (blogIdInput && results.blogId) blogIdInput.value = results.blogId;
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
    startInfraSetup,
    cancelInfraSetup,
    runHealthcheck,
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

    const report = await window.electronAPI.invoke('oneclick:verify-only', payload);
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
              ${stepCount}단계 반자동 설정 • 로그인·입력은 직접, 반복 설정은 자동
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

      <!-- 시작 버튼 -->
      <button id="oneclick-btn-${platform.id}" onclick="window.__oneclickSetup?.startSetup('${platform.id}')"
        style="width: 100%; padding: 14px; background: ${platform.gradient}; color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; box-shadow: 0 6px 20px ${platform.color}40; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 8px;"
        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 30px ${platform.color}50'"
        onmouseout="this.style.transform='none'; this.style.boxShadow='0 6px 20px ${platform.color}40'">
        <span>▶</span>
        <span>세팅 시작</span>
      </button>

      ${(platform.id === 'blogspot' || platform.id === 'wordpress') ? `
      <!-- 🔗 앱 연동 자동 설정 버튼 -->
      <button id="oneclick-connect-btn-${platform.id}" onclick="window.__oneclickSetup?.startPlatformConnect('${platform.id}')"
        style="width: 100%; padding: 12px; margin-top: 8px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(99, 102, 241, 0.3)); border: 1px solid rgba(139, 92, 246, 0.4); color: #c4b5fd; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 8px;"
        onmouseover="this.style.background='linear-gradient(135deg, rgba(139, 92, 246, 0.5), rgba(99, 102, 241, 0.5))'; this.style.transform='translateY(-1px)'"
        onmouseout="this.style.background='linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(99, 102, 241, 0.3))'; this.style.transform='none'">
        <span>🔗</span>
        <span>${platform.id === 'wordpress' ? 'Application Password 자동 생성' : 'GCP OAuth 자동 설정 (API 연동)'}</span>
      </button>
      <div id="oneclick-connect-progress-${platform.id}" style="display: none; margin-top: 8px; padding: 12px; background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 10px;">
        <div id="oneclick-connect-msg-${platform.id}" style="font-size: 12px; color: #c4b5fd;">준비 중...</div>
      </div>
      ` : ''}

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

  try {
    const storage = getStorageManager();
    const settings = await storage.get('bloggerSettings', true);
    
    if (!settings || !settings.blogUrl) {
      if (showWarning) {
        showToast('⚠️ 환경설정 → 플랫폼 설정 → "내 블로그 주소"에 URL을 먼저 입력하고 저장해주세요.', 'warn', 6000);
      }
      return;
    }

    let blogUrl = settings.blogUrl.trim();
    if (!blogUrl.startsWith('http')) blogUrl = 'https://' + blogUrl;

    urlInput.value = blogUrl;
    urlInput.style.borderColor = 'rgba(245, 158, 11, 0.5)';
    addLog?.(`[원클릭] 설정에서 블로그 URL 불러옴: ${blogUrl}`);

  } catch (err) {
    console.error('[ONECLICK] 블로그 URL 불러오기 오류:', err);
    if (showWarning) {
      showToast('⚠️ 설정 읽기에 실패했습니다. 직접 URL을 입력해주세요.', 'warn');
    }
  }
}

// (블로그 URL 로드 로직은 initOneclickSetup()으로 이동됨)