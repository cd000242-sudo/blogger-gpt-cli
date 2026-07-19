// sidebar.js — 사이드바 내비게이션 모듈
export function initSidebar() {
    const container = document.getElementById('appSidebar');
    if (!container) {
        console.error('[SIDEBAR] ❌ #appSidebar 컨테이너를 찾을 수 없습니다. 사이드바 초기화 실패.');
        showFallbackNav(); // 에러 폴백
        return;
    }

    // v3.7.23: 좌측 탭 순서 재정렬 — 사용자 워크플로우 자연스러운 순서로 통일.
    //   메인 → 썸네일 → 이미지생성 → 글포스팅 → 거미줄포스팅 → 외부유입글생성 → 다중계정 → 설정
    // v3.8.39: 황금키워드 탭 제거 — LEWORD 외부 앱으로 대체.
    const navItems = [
        { id: 'nav-main', icon: '🏠', label: '메인', action: () => window.showTab?.('main') },
        { id: 'nav-thumbnail', icon: '🖼️', label: '썸네일', action: () => window.showTab?.('thumbnail') },
        { id: 'nav-image-batch', icon: '✨', label: '이미지생성', action: () => window.showTab?.('image-batch') },
        { id: 'nav-auto', icon: '⚡', label: '글포스팅', action: () => window.showTab?.('settings') },
        { id: 'nav-intlinks-page', icon: '🕸️', label: '거미줄포스팅', action: () => window.showTab?.('internal-links') },
        { id: 'nav-external-traffic', icon: '🚀', label: '외부유입글생성', action: () => window.showTab?.('external-traffic') },
        // 숨김 — 기존 메뉴 유지용
        { id: 'nav-semiauto', icon: '🎨', label: '반자동', action: () => window.showTab?.('semi-auto'), hidden: true },
        { id: 'nav-schedule', icon: '📅', label: '스케줄', action: () => window.showTab?.('schedule'), hidden: true },
    ];

    const toolItems = [
        { id: 'nav-multi', icon: '👥', label: '다중계정', action: () => window.openMultiAccountModal?.() },
        { id: 'nav-settings', icon: '⚙️', label: '설정', action: () => window.openSettingsModal?.() },
    ];

    container.innerHTML = '';

    // 로고
    const logo = document.createElement('div');
    logo.className = 'sidebar-logo';
    logo.innerHTML = '<img src="assets/logo-icon.png" alt="L" class="sidebar-logo-img">';
    container.appendChild(logo);

    // 네비게이션 (탭 전환)
    navItems.forEach(item => renderItem(container, item, true));

    // 구분선
    const divider = document.createElement('div');
    divider.className = 'sidebar-divider';
    container.appendChild(divider);

    // 도구 (모달 호출 — active 상태 불변)
    toolItems.forEach(item => renderItem(container, item, false));

    // 관리자 영상 업로드 (조건부)
    const adminItem = document.createElement('button');
    adminItem.type = 'button';
    adminItem.id = 'tutorialUploadBtn'; // tutorial.js L77이 이 ID로 참조 — 반드시 일치
    adminItem.className = 'sidebar-item sidebar-admin-item';
    adminItem.style.display = 'none'; // 기본 숨김
    adminItem.innerHTML = '<span class="sidebar-icon">🎬</span><span class="sidebar-label">영상업로드</span>';
    adminItem.addEventListener('click', () => {
        window.showTutorialUploadModal?.(); // tutorial.js L506에서 등록된 함수명
    });
    container.appendChild(adminItem);

    // 외부 노출 (관리자 버튼 표시용)
    window.__showAdminUpload = () => {
        adminItem.style.display = '';
    };

    // v3.8.56: 사이드바 하단 버전 배지 (사용자가 현재 버전 확인)
    const verBadge = document.createElement('div');
    verBadge.id = 'sidebarVersionBadge';
    verBadge.style.cssText = 'margin-top:auto;padding:10px 8px;text-align:center;font-size:11px;color:#94a3b8;font-weight:700;letter-spacing:0.5px;background:rgba(99,102,241,0.08);border-top:1px solid rgba(148,163,184,0.1);';
    verBadge.textContent = 'v...';
    container.appendChild(verBadge);
    // 비동기로 버전 불러오기
    (async () => {
      try {
        let ver = '';
        if (window.electronAPI?.invoke) {
          const r = await window.electronAPI.invoke('app:getVersion').catch(() => null);
          if (typeof r === 'string') ver = r;
          else if (r && r.version) ver = r.version;
        }
        if (!ver) ver = 'unknown';
        verBadge.textContent = 'v' + ver;
      } catch { verBadge.textContent = 'v?'; }
    })();

    // 초기 active
    setActiveSidebarItem('nav-main');

    // showTab 콜백
    window.__sidebarSetActive = setActiveSidebarItem;

    console.log('[SIDEBAR] ✅ 사이드바 초기화 완료');
}

function renderItem(container, item, isNav) {
    const el = document.createElement('button');
    el.type = 'button';
    el.id = item.id;                    // 규칙3: -tab 접미사 없음
    el.className = 'sidebar-item';      // 규칙1,2: tab-content/tab-btn 없음
    el.innerHTML = `<span class="sidebar-icon">${item.icon}</span><span class="sidebar-label">${item.label}</span>`;
    if (item.hidden) el.style.display = 'none';

    el.addEventListener('click', (event) => { // 규칙4: onclick 없음
        event.preventDefault();
        event.stopPropagation();
        if (isNav && item.id !== 'nav-main' && item.id !== 'nav-auto' && typeof window.blockFreeTrialFeatureAccess === 'function') {
            if (window.blockFreeTrialFeatureAccess(item.label)) return;
        }
        item.action();
        if (isNav) setActiveSidebarItem(item.id);
    });

    container.appendChild(el);
}

function setActiveSidebarItem(id) {
    document.querySelectorAll('.sidebar-item').forEach(el => {
        el.classList.remove('active');
    });
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
}

// 에러 폴백: 사이드바 실패 시 최소 네비게이션 제공
function showFallbackNav() {
    console.warn('[SIDEBAR] 폴백 네비게이션 활성화');
    const fallback = document.createElement('div');
    fallback.id = 'fallback-nav';
    fallback.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:#1e293b;padding:8px 16px;z-index:100;display:flex;gap:8px;';

    const tabs = [
        { name: '메인', tab: 'main' },
        { name: '썸네일', tab: 'thumbnail' },
        { name: '설정', tab: 'settings' },
        { name: '스케줄', tab: 'schedule' },
    ];

    tabs.forEach(t => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = t.name;
        btn.style.cssText = 'padding:6px 12px;background:#334155;color:#fff;border:none;border-radius:6px;cursor:pointer;';
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            window.showTab?.(t.tab);
        });
        fallback.appendChild(btn);
    });

    document.body.prepend(fallback);
}
