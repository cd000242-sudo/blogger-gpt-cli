// internal-links.js - 거미줄치기 통합글 만들기 기능

// 선택한 글 목록 (최대 5개)
let selectedPosts = [];
let generatedContent = null;
let urlInputCount = 0;

// 페이지 로드 시 초기화 (모듈 import 시점에 따라 다르게 처리)
function initModule() {
  console.log('[SPIDER-WEB] 모듈 초기화 시작');
  initializeUrlInputs();
}

// DOMContentLoaded가 이미 발생했는지 확인
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initModule);
} else {
  // 이미 DOMContentLoaded가 발생한 경우 즉시 실행
  setTimeout(initModule, 100);
}

/**
 * URL 입력 필드 초기화 (최대 5개)
 */
function initializeUrlInputs() {
  console.log('[SPIDER-WEB] initializeUrlInputs 호출됨');
  const container = document.getElementById('urlInputsContainer');
  if (!container) {
    console.log('[SPIDER-WEB] urlInputsContainer를 찾을 수 없음 - 탭이 표시되지 않았을 수 있음');
    return;
  }
  
  console.log('[SPIDER-WEB] URL 입력 필드 초기화');
  urlInputCount = 0;
  container.innerHTML = '';
  addUrlInput();
}

// 탭 활성화 시 초기화하는 함수
window.initSpiderWebTab = function() {
  console.log('[SPIDER-WEB] 탭 활성화 - 초기화 시작');
  initializeUrlInputs();
  // v3.7.22: 마지막 통합글 미리보기 자동 복원 (새 생성 전까지 유지)
  try { restoreSpiderWebLast(); } catch (e) { console.warn('[SPIDER-WEB] 복원 실패:', e); }
};

/**
 * URL 입력 필드 추가 (최대 5개)
 */
function addUrlInput() {
  if (urlInputCount >= 5) {
    alert('⚠️ 최대 5개까지만 입력할 수 있습니다.');
    return;
  }
  
  const container = document.getElementById('urlInputsContainer');
  if (!container) return;
  
  urlInputCount++;
  const inputId = `spiderWebUrl${urlInputCount}`;
  
  // v3.7.23: 다크 글래스모피즘 URL 입력 — 텍스트 컬러 명시(흰 배경 흰 텍스트 가독성 0 문제 해결).
  //   왼쪽 번호 배지 + 글래스 입력 + 호버 시 인디고 글로우 + 미니멀 삭제 버튼.
  const inputDiv = document.createElement('div');
  inputDiv.className = 'sw-url-row';
  inputDiv.style.cssText = 'display: flex; gap: 10px; align-items: center;';
  inputDiv.innerHTML = `
    <span class="sw-url-num" aria-hidden="true">${urlInputCount}</span>
    <div class="sw-url-input-wrap">
      <span class="sw-url-input-icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      </span>
      <input
        type="text"
        id="${inputId}"
        class="sw-url-input"
        placeholder="https://blog.example.com/post-slug"
        autocomplete="off"
        spellcheck="false"
      />
    </div>
    <button
      type="button"
      onclick="removeUrlInput('${inputId}')"
      class="sw-url-remove"
      aria-label="이 입력칸 삭제"
      title="삭제">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;
  
  container.appendChild(inputDiv);
  
  // 입력 시 선택한 글 목록 업데이트
  const input = document.getElementById(inputId);
  input.addEventListener('input', () => {
    updateSelectedPostsFromInputs();
  });
}

/**
 * URL 입력 필드 제거
 */
function removeUrlInput(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  
  input.parentElement.remove();
  urlInputCount--;
  updateSelectedPostsFromInputs();
}

/**
 * 모든 URL 입력 필드 지우기
 */
function clearUrlInputs() {
  if (!confirm('정말로 모든 입력을 지우시겠습니까?')) {
    return;
  }
  
  initializeUrlInputs();
  selectedPosts = [];
  updateSelectedPostsList();
}

/**
 * 입력 필드에서 선택한 글 목록 업데이트
 */
function updateSelectedPostsFromInputs() {
  selectedPosts = [];
  
  for (let i = 1; i <= 5; i++) {
    const input = document.getElementById(`spiderWebUrl${i}`);
    if (input && input.value.trim()) {
      const url = input.value.trim();
      // 중복 체크
      if (!selectedPosts.find(p => p.url === url)) {
        selectedPosts.push({
          url: url,
          title: url, // 크롤링 시 실제 제목으로 업데이트됨
          order: selectedPosts.length + 1
        });
      }
    }
  }
  
  updateSelectedPostsList();
}

/**
 * 발행글 저장 (발행 완료 후 자동 호출)
 * v3.8.11: publishedPosts 데이터 셰이프 통일 — calendar.js/posting.js 호환 위한 객체 셰이프 {dateKey: [posts]} 보존.
 *   이전엔 평면 배열로 덮어써서 calendar의 이전달 조회가 모두 빈 셀로 보이던 버그 수정.
 */
function savePublishedPost(post) {
  try {
    if (!post || !post.url) return;
    const raw = localStorage.getItem('publishedPosts');
    /** @type {Record<string, any[]>} */
    let store = {};

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // 이전 버그로 배열 저장된 데이터 → 객체로 복원 (날짜별 그룹화)
          for (const p of parsed) {
            if (!p || !p.url) continue;
            const d = new Date(p.publishedAt || p.timestamp || Date.now());
            const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (!Array.isArray(store[dk])) store[dk] = [];
            store[dk].push(p);
          }
          console.warn('[SPIDER-WEB] publishedPosts 배열 셰이프 감지 → 객체로 복원');
        } else if (parsed && typeof parsed === 'object') {
          store = parsed;
        }
      } catch {
        store = {};
      }
    }

    // 중복 체크 (URL 기준) — 모든 날짜 검색
    let alreadyExists = false;
    for (const dk of Object.keys(store)) {
      const list = store[dk];
      if (Array.isArray(list) && list.some((p) => p && p.url === post.url)) {
        alreadyExists = true;
        break;
      }
    }
    if (alreadyExists) {
      console.log('[SPIDER-WEB] 이미 저장된 글:', post.url);
      return;
    }

    const now = new Date(post.publishedAt || Date.now());
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (!Array.isArray(store[dateKey])) store[dateKey] = [];
    store[dateKey].push({
      title: post.title || '제목 없음',
      url: post.url,
      // platform: posting.js는 한글('워드프레스'/'블로거')로 저장 — 통일
      platform: post.platform || 'wordpress',
      publishedAt: now.toISOString(),
      timestamp: now.getTime(),
      time: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      summary: post.summary || '',
      thumbnail: post.thumbnail || '',
    });

    localStorage.setItem('publishedPosts', JSON.stringify(store));
    console.log('[SPIDER-WEB] 발행글 저장 완료 (객체 셰이프):', post.title, 'on', dateKey);

    // 달력이 열려 있으면 갱신
    if (typeof window.renderCalendar === 'function') {
      try { window.renderCalendar(); } catch {}
    }
  } catch (error) {
    console.error('[SPIDER-WEB] 발행글 저장 실패:', error);
  }
}

/**
 * 발행글 목록 불러오기
 *
 * v3.7.20: 데이터 셰이프 호환성 — posting.js / calendar.js는 publishedPosts를
 *   `{ [dateKey]: [posts] }` 객체로 저장하는데 이 함수는 평면 배열만 가정해서
 *   "목록에서 불러오기" 모달이 항상 빈 결과로 떴음.
 *   양쪽 셰이프(배열·dateKey 객체) 모두 받아 평면 배열로 정규화한다.
 */
function getPublishedPosts() {
  try {
    const raw = localStorage.getItem('publishedPosts');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (!parsed || typeof parsed !== 'object') return [];
    const flat = [];
    Object.entries(parsed).forEach(([dateKey, list]) => {
      if (!Array.isArray(list)) return;
      list.forEach((p) => {
        if (!p || !p.url) return;
        flat.push({
          title: p.title || '제목 없음',
          url: p.url,
          platform: p.platform || 'wordpress',
          publishedAt: p.publishedAt || (p.timestamp ? new Date(p.timestamp).toISOString() : dateKey),
          timestamp: p.timestamp || 0,
          summary: p.summary || '',
          thumbnail: p.thumbnail || '',
        });
      });
    });
    flat.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return flat;
  } catch (error) {
    console.error('[SPIDER-WEB] 발행글 불러오기 실패:', error);
    return [];
  }
}

/**
 * v3.7.21: 모달 캐시 — 매번 getPublishedPosts() 호출하지 않고 열 때 한 번만 fetch.
 * 체크박스 onChange 핸들러에서 인덱스로 빠르게 조회하기 위함.
 */
let modalPosts = [];

const escapeHtml = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * 발행글 목록 모달 열기 (v3.7.21 — 체크박스 다중 선택)
 *
 * 변경 사항:
 *  - 정식 모달은 거미줄 탭의 `.sw-modal` (HTML5 hidden 속성 사용) 한 곳뿐. 포스팅 탭의
 *    중복 #publishedPostsModal은 index.html에서 제거됨.
 *  - 기존 "한 줄마다 ✅ 선택" 버튼 → 체크박스로 교체, 최대 5개까지 한 번에 선택해
 *    하단 액션 바의 "선택한 N개 추가" 버튼으로 일괄 URL 입력 필드에 주입.
 *  - 모달 다크 테마(.sw-modal 계열 CSS)에 맞춰 카드 색감 슬레이트 톤으로 통일.
 */
// v3.8.2: 모달 mode 정식 통합
//   - 'spider-web' (기본): 다중 선택(최대 5개) + 거미줄 URL 입력칸 채우기
//   - 'external-traffic': 단일 선택 + 외부유입 탭으로 자동 복귀
// 양쪽 탭에서 동일한 modal DOM을 공유하되 mode에 따라 UI·버튼·동작 분기.
let _modalMode = 'spider-web';
let _modalSinglePick = false;

function openPublishedPostsModal(opts) {
  // v3.8.2: opts.mode로 분기. 백워드: window._extTrafficSinglePickMode 플래그 호환.
  const isExtTraffic = !!(opts && opts.mode === 'external-traffic') || !!window._extTrafficSinglePickMode;
  _modalMode = isExtTraffic ? 'external-traffic' : 'spider-web';
  _modalSinglePick = isExtTraffic; // external-traffic은 단일 선택

  modalPosts = getPublishedPosts();
  const modal = document.getElementById('publishedPostsModal');
  const list = document.getElementById('publishedPostsList');

  if (!modal || !list) {
    console.error('[SPIDER-WEB] 모달 요소를 찾을 수 없습니다');
    alert('❌ 발행글 목록 UI를 찾을 수 없습니다.');
    return;
  }

  // 헤더 텍스트도 mode에 따라
  const titleEl = document.getElementById('sw-pubmodal-title');
  if (titleEl) {
    titleEl.textContent = isExtTraffic ? '📖 외부유입 — 원본 글 1개 선택' : '📚 발행한 글 목록';
  }

  console.log('[PUB-MODAL] mode:', _modalMode, '글:', modalPosts.length, '개');

  // 모달 열린 후 백그라운드로 누락 썸네일 fetch (v3.8.2)
  setTimeout(() => _enrichMissingThumbnails(modalPosts), 100);

  if (modalPosts.length === 0) {
    list.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: #94a3b8;">
        <div style="font-size: 64px; margin-bottom: 16px;">📭</div>
        <div style="font-size: 18px; font-weight: 700; color: #e2e8f0; margin-bottom: 8px;">발행한 글이 없습니다</div>
        <div style="font-size: 13px; color: #94a3b8;">먼저 글을 발행한 후 다시 시도해주세요</div>
      </div>
    `;
  } else {
    // 최신순 정렬 (timestamp 역순으로 이미 정렬되어 있음)
    const sortedPosts = modalPosts;
    // 현재 입력 필드에 이미 들어가 있는 URL은 기본 체크 + 비활성화 처리
    const existingUrls = new Set();
    for (let i = 1; i <= 5; i++) {
      const input = document.getElementById(`spiderWebUrl${i}`);
      const v = (input && input.value || '').trim();
      if (v) existingUrls.add(v);
    }

    // v3.8.2: 상단 안내 배너 mode 분기
    const topBanner = _modalSinglePick
      ? `<div style="margin-bottom: 14px; padding: 12px 16px; background: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 10px; color: #c7d2fe; font-weight: 700;">📖 외부유입 모드 — 총 ${modalPosts.length}개. 글 1개를 클릭하면 외부유입 변환 탭으로 자동 복귀합니다.</div>`
      : `<div style="margin-bottom: 14px; padding: 12px 16px; background: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 10px; color: #c7d2fe; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
        <div style="font-weight: 700;">총 ${modalPosts.length}개 · <span id="pubModalSelectedCount" style="color: #fbbf24;">0</span>개 선택 (최대 5)</div>
        <div style="display: flex; gap: 8px;">
          <button type="button" onclick="selectAllPublishedPosts(true)" style="padding: 6px 12px; background: rgba(255,255,255,0.06); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">최근 5개 선택</button>
          <button type="button" onclick="selectAllPublishedPosts(false)" style="padding: 6px 12px; background: rgba(255,255,255,0.06); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">선택 해제</button>
        </div>
      </div>`;

    list.innerHTML = `
      ${topBanner}
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${sortedPosts.map((post, index) => {
          const safeTitle = escapeHtml(post.title || '제목 없음');
          const safeUrl = escapeHtml(post.url || '');
          const safeThumb = escapeHtml(post.thumbnail || '');
          // v3.8.2: platform 정규화 — 한글·영문·URL 패턴 모두 인식
          const platformLower = String(post.platform || '').toLowerCase();
          const isWordPress = ['wordpress', '워드프레스', 'wp'].includes(platformLower)
            || /\/wp-admin\/|\/wp-content\/|wordpress\.com/i.test(post.url || '');
          const isBlogger = ['blogger', 'blogspot', '블로거'].includes(platformLower)
            || /\.blogspot\.com|blogger\.com/i.test(post.url || '');
          const platformLabel = isWordPress ? 'WordPress' : (isBlogger ? 'Blogger' : (post.platform || 'Blog'));
          const platformColor = isWordPress ? '#0073aa' : (isBlogger ? '#ff5722' : '#64748b');
          const dateLabel = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('ko-KR') : '';
          const alreadyIn = existingUrls.has(post.url);
          // v3.7.21: 우측 썸네일 미리보기 — 없으면 첫 글자로 그라데이션 placeholder
          const titleInitial = (post.title || '?').trim().charAt(0) || '?';
          const thumbBlock = safeThumb
            ? `<img src="${safeThumb}" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" style="width: 88px; height: 88px; object-fit: cover; border-radius: 10px; flex-shrink: 0; background: #1e293b; border: 1px solid rgba(148, 163, 184, 0.15);">
               <div style="width: 88px; height: 88px; border-radius: 10px; flex-shrink: 0; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); display: none; align-items: center; justify-content: center; color: white; font-size: 28px; font-weight: 900;">${escapeHtml(titleInitial)}</div>`
            : `<div style="width: 88px; height: 88px; border-radius: 10px; flex-shrink: 0; background: linear-gradient(135deg, ${alreadyIn ? '#10b981 0%, #059669' : '#6366f1 0%, #8b5cf6'} 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 28px; font-weight: 900;">${escapeHtml(titleInitial)}</div>`;
          // v3.7.21: 선택된 글은 카드 자체에 강조 테두리 + 좌측 액센트 바 + "✓ 선택됨" 배지
          const selectedStyle = alreadyIn
            ? 'background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(34, 197, 94, 0.45); box-shadow: inset 4px 0 0 0 #22c55e;'
            : 'background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(148, 163, 184, 0.15);';
          const hoverIn = alreadyIn
            ? "this.style.background='rgba(16, 185, 129, 0.14)';"
            : "this.style.background='rgba(51, 65, 85, 0.6)'; this.style.borderColor='rgba(99, 102, 241, 0.4)';";
          const hoverOut = alreadyIn
            ? "this.style.background='rgba(16, 185, 129, 0.08)';"
            : "this.style.background='rgba(30, 41, 59, 0.6)'; this.style.borderColor='rgba(148, 163, 184, 0.15)';";
          // v3.8.2: single-pick 모드에서는 카드 자체 클릭 = 즉시 선택+모달 닫기
          if (_modalSinglePick) {
            return `
            <div data-pubidx="${index}" data-puburl="${safeUrl}" onclick="extTrafficPickSingleFromModal(${index})" style="display: flex; gap: 12px; align-items: stretch; padding: 14px 16px; background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 12px; cursor: pointer; transition: background 0.15s, border-color 0.15s, transform 0.15s;" onmouseover="this.style.background='rgba(99, 102, 241, 0.18)'; this.style.borderColor='rgba(99, 102, 241, 0.5)'; this.style.transform='translateY(-1px)';" onmouseout="this.style.background='rgba(30, 41, 59, 0.6)'; this.style.borderColor='rgba(148, 163, 184, 0.15)'; this.style.transform='translateY(0)';">
              <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;">
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap;">
                  <span style="padding: 2px 8px; background: ${platformColor}; color: white; border-radius: 6px; font-size: 10px; font-weight: 700;">${platformLabel}</span>
                  ${dateLabel ? `<span style="font-size: 11px; color: #94a3b8;">📅 ${dateLabel}</span>` : ''}
                </div>
                <div style="font-size: 14px; font-weight: 700; color: #e2e8f0; margin-bottom: 4px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${safeTitle}</div>
                <div style="font-size: 11px; color: #64748b; word-break: break-all; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;">${safeUrl}</div>
              </div>
              <button type="button" onclick="event.preventDefault(); event.stopPropagation(); window.open('${safeUrl}', '_blank');" title="새 창에서 열기" style="background: rgba(99, 102, 241, 0.15); color: #c7d2fe; border: 1px solid rgba(99, 102, 241, 0.3); padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; flex-shrink: 0; align-self: center;">🔗 열기</button>
              ${thumbBlock}
            </div>
            `;
          }
          // spider-web 모드: 다중 선택 체크박스
          return `
          <label for="pubChk${index}" data-puburl="${safeUrl}" style="display: flex; gap: 12px; align-items: stretch; padding: 14px 16px; ${selectedStyle} border-radius: 12px; cursor: pointer; transition: background 0.15s ease, border-color 0.15s ease;" onmouseover="${hoverIn}" onmouseout="${hoverOut}">
            <input type="checkbox" id="pubChk${index}" class="pub-modal-checkbox" data-index="${index}" ${alreadyIn ? 'checked disabled' : ''} onchange="updatePublishedSelectionCount()" style="margin-top: 4px; width: 18px; height: 18px; accent-color: ${alreadyIn ? '#22c55e' : '#6366f1'}; cursor: pointer; flex-shrink: 0;">
            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;">
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap;">
                <span style="padding: 2px 8px; background: ${platformColor}; color: white; border-radius: 6px; font-size: 10px; font-weight: 700;">${platformLabel}</span>
                ${dateLabel ? `<span style="font-size: 11px; color: #94a3b8;">📅 ${dateLabel}</span>` : ''}
                ${alreadyIn ? '<span style="padding: 2px 9px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; border-radius: 6px; font-size: 10px; font-weight: 800; box-shadow: 0 2px 6px rgba(34, 197, 94, 0.35);">✓ 선택됨</span>' : ''}
              </div>
              <div style="font-size: 14px; font-weight: 700; color: ${alreadyIn ? '#d1fae5' : '#e2e8f0'}; margin-bottom: 4px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${safeTitle}</div>
              <div style="font-size: 11px; color: #64748b; word-break: break-all; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;">${safeUrl}</div>
            </div>
            <button type="button" onclick="event.preventDefault(); event.stopPropagation(); window.open('${safeUrl}', '_blank');" title="새 창에서 열기" style="background: rgba(99, 102, 241, 0.15); color: #c7d2fe; border: 1px solid rgba(99, 102, 241, 0.3); padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; flex-shrink: 0; align-self: center;">🔗 열기</button>
            ${thumbBlock}
          </label>
          `;
        }).join('')}
      </div>
      <div style="position: sticky; bottom: -24px; margin: 20px -24px -24px; padding: 16px 24px; background: linear-gradient(180deg, transparent 0%, rgba(15, 23, 42, 0.95) 30%); display: flex; gap: 10px; justify-content: flex-end; border-top: 1px solid rgba(148, 163, 184, 0.1);">
        <button type="button" onclick="closePublishedPostsModal()" style="padding: 10px 18px; background: rgba(255,255,255,0.06); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer;">${_modalSinglePick ? '닫기' : '취소'}</button>
        ${_modalSinglePick ? '' : '<button type="button" onclick="addSelectedPostsToInputs()" style="padding: 10px 22px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; border: none; border-radius: 10px; font-size: 13px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);">✅ 선택한 글 추가</button>'}
      </div>
    `;
    if (!_modalSinglePick) updatePublishedSelectionCount();
  }

  // .sw-modal은 HTML5 hidden 속성으로 토글. inline style.display 건드리지 말 것.
  modal.removeAttribute('hidden');
}

/**
 * 발행글 목록 모달 닫기
 */
function closePublishedPostsModal() {
  const modal = document.getElementById('publishedPostsModal');
  if (modal) {
    modal.setAttribute('hidden', '');
  }
  // v3.8.2: 모달 mode 정식 통합 — 별도 헤더 원복 불필요 (mode 분기 시 항상 적절 헤더 출력)
  _modalMode = 'spider-web';
  _modalSinglePick = false;
  if (window._extTrafficSinglePickMode) {
    window._extTrafficSinglePickMode = false;
  }
}

// v3.8.2: single-pick 모드 카드 클릭 핸들러
function extTrafficPickSingleFromModal(index) {
  const post = modalPosts[index];
  if (!post) {
    console.warn('[PUB-MODAL] single-pick 글 못 찾음:', index);
    return;
  }
  console.log('[PUB-MODAL] single-pick 선택:', post.title);
  // 외부유입 탭의 setSource 호출 + 모달 닫기
  if (typeof window.extTrafficSetSource === 'function') {
    window.extTrafficSetSource(post);
  }
  closePublishedPostsModal();
}
window.extTrafficPickSingleFromModal = extTrafficPickSingleFromModal;

// v3.8.2: 누락 썸네일 백그라운드 fetch (v3.8.7: 진행 모달 그리드도 동시 갱신)
async function _enrichMissingThumbnails(posts) {
  if (!window.electronAPI || !window.electronAPI.invoke) return;
  const targets = (posts || []).filter((p) => p && !p.thumbnail && p.url).slice(0, 20);
  if (!targets.length) return;
  for (const post of targets) {
    try {
      const result = await window.electronAPI.invoke('fetch-og-image', { url: post.url });
      if (result && result.success && result.imageUrl) {
        post.thumbnail = result.imageUrl;
        // localStorage에도 반영 (다음 모달 진입 시 캐시)
        _saveThumbnailToCache(post.url, result.imageUrl);
        // 카드의 placeholder를 실제 이미지로 교체 (발행글 모달 + 거미줄 진행 모달)
        _updateThumbnailInDom(post.url, result.imageUrl);
      }
    } catch (e) {
      // 무시 (썸네일 fetch 실패는 비치명적)
    }
  }
}

function _saveThumbnailToCache(url, imageUrl) {
  try {
    const raw = localStorage.getItem('publishedPosts');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const p of parsed) {
        if (p && p.url === url && !p.thumbnail) p.thumbnail = imageUrl;
      }
    } else if (parsed && typeof parsed === 'object') {
      for (const dateKey of Object.keys(parsed)) {
        const list = parsed[dateKey];
        if (!Array.isArray(list)) continue;
        for (const p of list) {
          if (p && p.url === url && !p.thumbnail) p.thumbnail = imageUrl;
        }
      }
    }
    localStorage.setItem('publishedPosts', JSON.stringify(parsed));
  } catch (e) {
    console.warn('[PUB-MODAL] 썸네일 캐싱 실패:', e?.message);
  }
}

function _updateThumbnailInDom(url, imageUrl) {
  // v3.8.7: 발행글 모달 + 거미줄 진행 모달 swpmSourceGrid 둘 다 갱신
  const containers = [
    document.getElementById('publishedPostsList'),
    document.getElementById('swpmSourceGrid'),
  ].filter(Boolean);
  for (const container of containers) {
    const cards = container.querySelectorAll('[data-puburl]');
    for (const card of cards) {
      if (card.getAttribute('data-puburl') !== url) continue;
      // 이미 <img>면 src만 교체
      if (card.tagName === 'IMG') {
        card.setAttribute('src', imageUrl);
        card.style.display = '';
        // 다음 형제 placeholder가 있으면 hide
        const sib = card.nextElementSibling;
        if (sib && /placeholder/i.test(sib.className || '')) sib.style.display = 'none';
        continue;
      }
      // placeholder div면 부모에서 형제 img 찾기, 없으면 img 삽입
      const parent = card.parentElement;
      if (!parent) continue;
      const existingImg = parent.querySelector('img[data-puburl="' + url.replace(/"/g, '&quot;') + '"]');
      if (existingImg) {
        existingImg.src = imageUrl;
        existingImg.style.display = '';
        card.style.display = 'none';
      } else {
        // placeholder 앞에 img 삽입 (swpmSourceGrid는 background-image용 .sw-source-thumb 사용 가능 → img로 통일)
        const newImg = document.createElement('img');
        newImg.src = imageUrl;
        newImg.setAttribute('data-puburl', url);
        newImg.loading = 'lazy';
        // swpmSourceGrid의 카드 vs 발행글 모달의 카드 스타일 분기
        if (card.classList.contains('sw-source-thumb')) {
          newImg.className = 'sw-source-thumb';
          newImg.style.objectFit = 'cover';
        } else {
          newImg.style.cssText = 'width: 88px; height: 88px; object-fit: cover; border-radius: 10px; flex-shrink: 0; background: #1e293b; border: 1px solid rgba(148, 163, 184, 0.15);';
        }
        parent.insertBefore(newImg, card);
        card.style.display = 'none';
      }
    }
  }
}

// v3.8.12: 거미줄 전용 ImageFX/Dropshot 로그인 확인 wrapper
//   글포스팅탭의 ID(dropshotLoginStatusSettings, imagefxLoginStatus)와 별개로
//   거미줄 카드의 status element(swDropshotLoginStatus, swImagefxLoginStatus)를 직접 갱신.
async function spiderHandleDropshotCheckLogin() {
  const status = document.getElementById('swDropshotLoginStatus');
  if (!status) return;
  status.textContent = '⏳ 확인 중...';
  status.style.color = 'rgba(255,255,255,0.6)';
  try {
    const r = await window.electronAPI?.invoke?.('dropshot:check-login');
    if (window.handlePaymentRequiredResponse && window.handlePaymentRequiredResponse(r)) {
      status.textContent = '🛡️ 유료 라이선스 필요';
      status.style.color = '#fbbf24';
      return;
    }
    if (r?.loggedIn) {
      const subTxt = r.subscription === 'pro' ? ' · ✅ Pro 구독자 무제한' : (r.subscription === 'free' ? ' · ⚠️ 무료 사용자' : '');
      status.textContent = `✅ 로그인됨${r.userName ? ' — ' + r.userName : ''}${subTxt}`;
      status.style.color = '#86efac';
    } else {
      status.textContent = '🔐 ' + (r?.message || '로그인 필요 — 위 [로그인] 버튼 클릭');
      status.style.color = '#fbbf24';
    }
  } catch (e) {
    status.textContent = '❌ ' + (e?.message || e);
    status.style.color = '#fca5a5';
  }
}
async function spiderHandleImageFxCheckLogin() {
  const status = document.getElementById('swImagefxLoginStatus');
  if (!status) return;
  status.textContent = '⏳ 확인 중...';
  status.style.color = 'rgba(255,255,255,0.6)';
  try {
    const r = await window.electronAPI?.invoke?.('imagefx:check-login');
    if (r?.loggedIn) {
      status.textContent = `✅ 로그인됨${r.userEmail ? ' — ' + r.userEmail : ''}`;
      status.style.color = '#86efac';
    } else {
      status.textContent = '🔐 ' + (r?.message || '로그인 필요 — 위 [Google 로그인] 버튼 클릭');
      status.style.color = '#fbbf24';
    }
  } catch (e) {
    status.textContent = '❌ ' + (e?.message || e);
    status.style.color = '#fca5a5';
  }
}
window.spiderHandleDropshotCheckLogin = spiderHandleDropshotCheckLogin;
window.spiderHandleImageFxCheckLogin = spiderHandleImageFxCheckLogin;

// v3.8.7: 엔진 선택 카드 토글 (Google 로그인 / 리더스 나노바나나 무제한)
function _spiderWebUpdateEngineCards() {
  const thumbEngine = (document.getElementById('swThumbnailEngine')?.value || '').toLowerCase();
  const h2Engine = (document.getElementById('swH2ImageEngine')?.value || '').toLowerCase();
  const imagefxCard = document.getElementById('swImagefxLoginCard');
  const dropshotCard = document.getElementById('swDropshotLoginCard');
  const needsImagefx = /^(imagefx|flow)$/i.test(thumbEngine) || /^(imagefx|flow)$/i.test(h2Engine);
  const needsDropshot = /dropshot/i.test(thumbEngine) || /dropshot/i.test(h2Engine);
  if (imagefxCard) imagefxCard.style.display = needsImagefx ? 'block' : 'none';
  if (dropshotCard) dropshotCard.style.display = needsDropshot ? 'block' : 'none';
}
window._spiderWebUpdateEngineCards = _spiderWebUpdateEngineCards;

/**
 * 체크된 항목 수 + 5개 초과 시 비활성화 처리
 */
function updatePublishedSelectionCount() {
  const checkboxes = Array.from(document.querySelectorAll('.pub-modal-checkbox'));
  // 이미 입력 필드에 들어가 있는 disabled checked 는 계산에서 제외(추가 가능 카운트만 본다)
  const newlyChecked = checkboxes.filter(cb => cb.checked && !cb.disabled);
  // 입력 필드의 남은 슬롯 = 5 - 현재 입력된 URL 수
  let usedSlots = 0;
  for (let i = 1; i <= 5; i++) {
    const input = document.getElementById(`spiderWebUrl${i}`);
    if (input && input.value.trim()) usedSlots++;
  }
  const remainingSlots = Math.max(0, 5 - usedSlots);
  const countEl = document.getElementById('pubModalSelectedCount');
  if (countEl) countEl.textContent = String(newlyChecked.length);
  // 슬롯 초과 시 추가 체크 불가
  if (newlyChecked.length >= remainingSlots) {
    checkboxes.forEach(cb => { if (!cb.checked && !cb.disabled) cb.disabled = true; });
  } else {
    checkboxes.forEach(cb => { if (!cb.checked && cb.disabled) cb.disabled = false; });
  }
}

/**
 * 최근 N개 자동 체크 / 전체 해제
 */
function selectAllPublishedPosts(autoCheckTopFive) {
  const checkboxes = Array.from(document.querySelectorAll('.pub-modal-checkbox'));
  if (!autoCheckTopFive) {
    checkboxes.forEach(cb => { if (!cb.disabled || cb.checked) { /* keep disabled+checked alone */ } });
    // 사용자 추가분만 해제 (already-added 항목은 disabled+checked 유지)
    checkboxes.forEach(cb => {
      if (!(cb.disabled && cb.checked)) cb.checked = false;
    });
  } else {
    // 가용 슬롯 만큼 위에서부터 체크
    let usedSlots = 0;
    for (let i = 1; i <= 5; i++) {
      const input = document.getElementById(`spiderWebUrl${i}`);
      if (input && input.value.trim()) usedSlots++;
    }
    let remaining = Math.max(0, 5 - usedSlots);
    for (const cb of checkboxes) {
      if (remaining <= 0) break;
      if (cb.disabled) continue;
      if (!cb.checked) { cb.checked = true; remaining--; }
      else remaining--;
    }
  }
  updatePublishedSelectionCount();
}

/**
 * 체크된 글을 URL 입력 필드에 일괄 주입.
 *   - 빈 입력 필드부터 채움 → 모자라면 addUrlInput()으로 슬롯 추가 (최대 5)
 *   - 채운 뒤 selectedPosts 동기화 + 모달 닫기
 */
function addSelectedPostsToInputs() {
  const checked = Array.from(document.querySelectorAll('.pub-modal-checkbox'))
    .filter(cb => cb.checked && !cb.disabled);
  if (checked.length === 0) {
    alert('⚠️ 선택한 글이 없습니다.');
    return;
  }

  const picks = checked
    .map(cb => modalPosts[parseInt(cb.dataset.index, 10)])
    .filter(Boolean);

  // v3.7.23: 외부유입 탭에서 호출한 single-pick 모드 — 첫 글만 콜백으로 넘기고 종료
  if (window._extTrafficSinglePickMode) {
    window._extTrafficSinglePickMode = false;
    const first = picks[0];
    if (first && typeof window.extTrafficSetSource === 'function') {
      window.extTrafficSetSource(first);
    }
    if (typeof closePublishedPostsModal === 'function') closePublishedPostsModal();
    return;
  }

  let added = 0;
  for (const post of picks) {
    // 빈 입력칸 우선 채움
    let placed = false;
    for (let i = 1; i <= 5; i++) {
      const input = document.getElementById(`spiderWebUrl${i}`);
      if (input && !input.value.trim()) {
        input.value = post.url;
        placed = true;
        break;
      }
    }
    if (!placed) {
      // 빈 칸이 없으면 새 슬롯 추가 (최대 5 제한은 addUrlInput 내부에서)
      if (urlInputCount >= 5) break;
      addUrlInput();
      const newInput = document.getElementById(`spiderWebUrl${urlInputCount}`);
      if (newInput) {
        newInput.value = post.url;
        placed = true;
      }
    }
    if (placed) added++;
  }

  updateSelectedPostsFromInputs();
  closePublishedPostsModal();
  if (added > 0) {
    console.log(`[SPIDER-WEB] 발행글 ${added}개 일괄 추가 완료`);
  }
}

/**
 * URL 복사
 */
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert('✅ URL이 복사되었습니다!');
  }).catch(err => {
    console.error('[SPIDER-WEB] 복사 실패:', err);
    alert('❌ 복사에 실패했습니다.');
  });
}

/**
 * 모달에서 글 선택
 */
function selectPostFromModal(index) {
  const posts = getPublishedPosts();
  const post = posts[index];
  
  if (!post) {
    alert('❌ 글을 찾을 수 없습니다.');
    return;
  }
  
  if (selectedPosts.length >= 5) {
    alert('⚠️ 최대 5개까지만 선택할 수 있습니다.');
    return;
  }
  
  if (selectedPosts.find(p => p.url === post.url)) {
    alert('⚠️ 이미 선택한 글입니다.');
    return;
  }
  
  // URL 입력 필드에 추가
  if (urlInputCount < 5) {
    addUrlInput();
    const input = document.getElementById(`spiderWebUrl${urlInputCount}`);
    if (input) {
      input.value = post.url;
      updateSelectedPostsFromInputs();
    }
  }
  
  closePublishedPostsModal();
  alert(`✅ "${post.title}"이(가) 선택되었습니다. (${selectedPosts.length}/5)`);
}

/**
 * 선택한 글 목록 업데이트
 */
function updateSelectedPostsList() {
  const list = document.getElementById('selectedPostsList');
  if (!list) return;
  
  if (selectedPosts.length === 0) {
    list.innerHTML = `
      <div style="text-align: center; color: #94a3b8; padding: 40px;">
        <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
        <div style="font-size: 16px;">위에서 글 주소를 입력하거나 생성 글 목록에서 불러오세요</div>
      </div>
    `;
    return;
  }
  
  list.innerHTML = selectedPosts.map((post, index) => `
    <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 12px; padding: 20px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; border: 2px solid #3b82f6;">
      <div style="flex: 1;">
        <span style="font-weight: 700; color: #1e40af; margin-right: 12px;">${index + 1}.</span>
        <span style="font-weight: 600; color: #1e293b; margin-right: 12px;">${post.title || post.url}</span>
        <span style="font-size: 12px; color: #64748b; word-break: break-all;">${post.url}</span>
      </div>
      <div style="display: flex; gap: 8px;">
        <button onclick="window.open('${post.url}', '_blank')" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; border: none; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">
          🔗 바로가기
        </button>
        <button onclick="copyToClipboard('${post.url}')" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">
          📋 복사
        </button>
        <button onclick="removeSelectedPost(${index})" style="background: #ef4444; color: white; border: none; width: 32px; height: 32px; border-radius: 50%; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
          ❌
        </button>
      </div>
    </div>
  `).join('');
}

/**
 * 선택한 글 제거
 */
function removeSelectedPost(index) {
  selectedPosts.splice(index, 1);
  
  // URL 입력 필드도 업데이트
  const container = document.getElementById('urlInputsContainer');
  if (container) {
    const inputs = container.querySelectorAll('input[type="text"]');
    inputs.forEach((input, idx) => {
      if (idx === index && selectedPosts[idx]) {
        input.value = selectedPosts[idx].url;
      } else if (idx >= selectedPosts.length) {
        input.value = '';
      }
    });
  }
  
  updateSelectedPostsList();
}

/**
 * 거미줄치기 통합글 생성
 */
async function generateSpiderWebContent() {
  console.log('[SPIDER-WEB] generateSpiderWebContent 호출됨');
  
  try {
    // 입력 필드에서 URL 다시 수집
    updateSelectedPostsFromInputs();
    
    // 선택한 글 URL 수집
    const urls = selectedPosts.map(p => p.url).filter(url => url && url.trim());
    console.log('[SPIDER-WEB] 수집된 URL:', urls);
    
    if (urls.length === 0) {
      alert('⚠️ 최소 1개 이상의 글 주소를 입력하거나 선택해주세요.');
      return;
    }
    
    if (urls.length > 5) {
      alert('⚠️ 최대 5개까지만 선택할 수 있습니다.');
      return;
    }
    
    // 제목 가져오기 (비어있으면 자동 생성)
    const titleInput = document.getElementById('spiderWebTitle');
    const title = titleInput ? titleInput.value.trim() : '';
    
    // 미리보기 표시
    const previewDiv = document.getElementById('spiderWebPreview');
    const previewContent = document.getElementById('spiderWebPreviewContent');
    
    if (previewDiv) {
      previewDiv.style.display = 'block';
    }
    
    if (previewContent) {
      previewContent.innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
          <div style="font-size: 48px; margin-bottom: 16px;">⏳</div>
          <div style="font-size: 18px; font-weight: 600; color: #1e293b;">거미줄치기 통합글 생성 중...</div>
          <div style="font-size: 14px; color: #64748b; margin-top: 8px;">선택한 ${urls.length}개의 글을 분석하고 있습니다</div>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 8px;">각 글의 70% 핵심 내용과 CTA를 포함한 통합글을 생성합니다</div>
        </div>
      `;
    }
    
    // 백엔드 API 호출
    console.log('[SPIDER-WEB] API 호출 시작...', { urls, title });
    
    let result;
    try {
      // electronAPI 또는 blogger 사용
      if (window.electronAPI && window.electronAPI.invoke) {
        result = await window.electronAPI.invoke('generate-internal-consistency', {
          urls: urls,
          title: title || '', // 비어있으면 자동 생성
          posts: selectedPosts.map((post, index) => ({
            id: `post-${index + 1}`,
            url: post.url,
            title: post.title || post.url,
            order: index + 1
          }))
        });
      } else if (window.blogger && window.blogger.generateInternalLinkContent) {
        result = await window.blogger.generateInternalLinkContent({
          urls: urls,
          title: title || '',
          posts: selectedPosts.map((post, index) => ({
            id: `post-${index + 1}`,
            url: post.url,
            title: post.title || post.url,
            order: index + 1
          }))
        });
      } else {
        throw new Error('API를 사용할 수 없습니다. electronAPI 또는 blogger API가 필요합니다.');
      }
    } catch (apiError) {
      console.error('[SPIDER-WEB] API 호출 에러:', apiError);
      throw apiError;
    }
    
    console.log('[SPIDER-WEB] API 응답:', result);
    
    if (!result || !result.success) {
      throw new Error(result?.error || '글 생성에 실패했습니다.');
    }
    
    if (!result.html) {
      throw new Error('생성된 HTML이 없습니다.');
    }
    
    // 생성된 콘텐츠 저장
    generatedContent = {
      html: result.html,
      title: result.title || title || '거미줄치기 통합글',
      urls: urls
    };
    
    // 미리보기 표시
    if (previewContent) {
      previewContent.innerHTML = result.html;
    }
    
    // 제목 업데이트
    if (titleInput && result.title) {
      titleInput.value = result.title;
    }
    
    alert('✅ 거미줄치기 통합글이 생성되었습니다! 미리보기를 확인하세요.');
    
  } catch (error) {
    console.error('[SPIDER-WEB] 글 생성 실패:', error);
    alert(`❌ 글 생성에 실패했습니다: ${error.message}`);
    
    // 에러 표시
    const previewContent = document.getElementById('spiderWebPreviewContent');
    if (previewContent) {
      previewContent.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: #ef4444;">
          <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
          <div style="font-size: 18px; font-weight: 600;">글 생성 실패</div>
          <div style="font-size: 14px; margin-top: 8px;">${error.message}</div>
        </div>
      `;
    }
  }
}

/**
 * 글만 생성하기 (저장) - 임시저장으로 처리
 */
async function saveSpiderWebContent() {
  try {
    console.log('[SPIDER-WEB] saveSpiderWebContent 호출됨');
    
    if (!generatedContent) {
      alert('⚠️ 먼저 글을 생성해주세요.');
      return;
    }
    
    if (!confirm('이 글을 임시저장으로 저장하시겠습니까?')) {
      return;
    }
    
    // 임시저장(Draft) 발행
    console.log('[SPIDER-WEB] 임시저장 시작...', {
      title: generatedContent.title,
      htmlLength: generatedContent.html?.length || 0
    });
    
    let result;
    if (window.blogger && window.blogger.publishContent) {
      result = await window.blogger.publishContent({
        title: generatedContent.title,
        html: generatedContent.html,
        platform: 'blogspot',
        publishType: 'draft' // 임시저장
      });
    } else if (window.electronAPI && window.electronAPI.invoke) {
      result = await window.electronAPI.invoke('publish-content', {
        title: generatedContent.title,
        content: generatedContent.html,
        payload: {
          platform: 'blogspot',
          publishType: 'draft'
        }
      });
    } else {
      throw new Error('발행 API를 사용할 수 없습니다.');
    }
    
    console.log('[SPIDER-WEB] 임시저장 결과:', result);
    
    if (result && result.ok) {
      alert('✅ 글이 임시저장되었습니다!');
    } else {
      throw new Error(result?.error || '저장에 실패했습니다.');
    }
    
  } catch (error) {
    console.error('[SPIDER-WEB] 저장 실패:', error);
    alert(`❌ 저장에 실패했습니다: ${error.message}`);
  }
}

/**
 * 글 생성 및 발행
 */
async function saveAndPublishSpiderWebContent() {
  try {
    console.log('[SPIDER-WEB] saveAndPublishSpiderWebContent 호출됨');
    
    if (!generatedContent) {
      alert('⚠️ 먼저 글을 생성해주세요.');
      return;
    }
    
    if (!confirm('이 글을 생성하고 발행하시겠습니까?')) {
      return;
    }
    
    // 발행 요청
    console.log('[SPIDER-WEB] 발행 시작...', {
      title: generatedContent.title,
      htmlLength: generatedContent.html?.length || 0
    });
    
    let result;
    if (window.blogger && window.blogger.publishContent) {
      result = await window.blogger.publishContent({
        title: generatedContent.title,
        html: generatedContent.html,
        platform: 'blogspot', // 기본 플랫폼
        publishType: 'publish'
      });
    } else if (window.electronAPI && window.electronAPI.invoke) {
      result = await window.electronAPI.invoke('publish-content', {
        title: generatedContent.title,
        content: generatedContent.html,
        payload: {
          platform: 'blogspot',
          publishType: 'publish'
        }
      });
    } else {
      throw new Error('발행 API를 사용할 수 없습니다.');
    }
    
    console.log('[SPIDER-WEB] 발행 결과:', result);
    
    if (result && result.ok) {
      // 발행한 글 저장
      savePublishedPost({
        url: result.url || result.postUrl || '',
        title: generatedContent.title,
        publishedAt: new Date().toISOString(),
        platform: 'blogspot'
      });
      
      alert(`✅ 글이 성공적으로 발행되었습니다!\n\n${result.url || result.postUrl || ''}`);
    } else {
      throw new Error(result?.error || '발행에 실패했습니다.');
    }
    
  } catch (error) {
    console.error('[SPIDER-WEB] 발행 실패:', error);
    alert(`❌ 발행에 실패했습니다: ${error.message}`);
  }
}

/**
 * v3.7.22: 통합글 생성 + 자동 발행 일체화 + 고급 진행 모달
 *
 * 변경 요약:
 *  - Step 03 단일 버튼 "통합글 생성 및 발행하기" 클릭 → 본 함수 진입
 *  - Step 04 하단 두 버튼(글만/생성+발행) 제거됨
 *  - 진행 모달: 좌측 원본 글 그리드 + 우측 6단계 진행 + 회전 링 + 경과 시간
 *  - 백엔드 API는 progress event를 emit하지 않으므로 클라이언트가 단계를 시뮬레이션.
 *    실제 응답 수신 시점에 100% 도달.
 *  - 결과를 localStorage('spiderWebLastGenerated')에 저장 → 새 생성 전까지 미리보기 유지.
 *  - 미리보기는 워드프레스/블로그스팟 발행 모양(흰 배경 + 글 너비 제한)으로 렌더링.
 */

const SW_STEPS = [
  { id: 1, label: 'URL 분석',         detail: '입력한 글 주소가 유효한지 확인하고 있어요',           icon: '🔍', weight: 5  },
  { id: 2, label: '콘텐츠 크롤링',     detail: '각 글의 본문·이미지·메타데이터를 읽어오는 중이에요',  icon: '📥', weight: 25 },
  { id: 3, label: '통합 제목 생성',    detail: '5개 글을 모두 포함하는 SEO 제목을 만들고 있어요',     icon: '✍️', weight: 10 },
  { id: 4, label: '본문 합성',         detail: '각 글의 핵심 70%를 추출해 통합 본문을 만들고 있어요', icon: '🧩', weight: 35 },
  { id: 5, label: '이미지·CTA 처리',   detail: '썸네일, 본문 이미지, 내부 링크 CTA를 배치하고 있어요', icon: '🖼️', weight: 10 },
  { id: 6, label: '발행',              detail: '워드프레스/블로그스팟에 자동 발행하고 있어요',          icon: '🚀', weight: 15 },
];

let _swProgressState = {
  modal: null,
  startedAt: 0,
  timer: null,
  currentStep: 0,
  simInterval: null,
  apiDone: false,
  // v3.8.3: 닫혀도 진행상태 보존 (mini progress + 재오픈 위함)
  active: false,
  finished: false,
  status: 'idle', // 'idle' | 'running' | 'success' | 'error'
  lastLabel: '',
  lastDetail: '',
  lastIcon: '⏳',
  lastPercent: 0,
  publishedUrl: '',
  errorMessage: '',
  sources: [],
};

// v3.8.3: 실시간 로그 라인 추가
function _swPushLog(message, level) {
  level = level || 'info';
  try {
    const list = document.getElementById('swpmLogList');
    if (!list) return;
    const ts = new Date();
    const hh = String(ts.getHours()).padStart(2, '0');
    const mm = String(ts.getMinutes()).padStart(2, '0');
    const ss = String(ts.getSeconds()).padStart(2, '0');
    const color = level === 'error' ? '#fca5a5' : (level === 'warn' ? '#fbbf24' : (level === 'success' ? '#34d399' : '#cbd5e1'));
    const icon = level === 'error' ? '❌' : (level === 'warn' ? '⚠️' : (level === 'success' ? '✅' : 'ℹ️'));
    const line = document.createElement('div');
    line.style.cssText = 'color: ' + color + ';';
    line.textContent = `[${hh}:${mm}:${ss}] ${icon} ${message}`;
    list.appendChild(line);
    list.parentElement.scrollTop = list.parentElement.scrollHeight;
  } catch (e) { /* 무시 */ }
}

// v3.8.3/v3.8.12: mini progress bar 갱신 (디자인 고도화 + 모달 visibility 동기화)
function _swUpdateMiniProgress() {
  const mini = document.getElementById('swMiniProgress');
  if (!mini) return;
  if (!_swProgressState.active) {
    mini.style.display = 'none';
    return;
  }
  // 모달이 열려 있으면 mini는 숨김 (중복 표시 방지)
  const modal = document.getElementById('spiderWebProgressModal');
  const modalOpen = modal && !modal.hasAttribute('hidden');
  if (modalOpen) {
    mini.style.display = 'none';
    return;
  }
  mini.style.display = 'block';
  const fill = document.getElementById('swMiniFill');
  const label = document.getElementById('swMiniLabel');
  const detail = document.getElementById('swMiniDetail');
  const percent = document.getElementById('swMiniPercent');
  const icon = document.getElementById('swMiniIcon');
  const elapsed = document.getElementById('swMiniElapsed');
  if (fill) fill.style.width = _swProgressState.lastPercent + '%';
  if (label) label.textContent = _swProgressState.lastLabel || '진행 중…';
  if (detail) detail.textContent = _swProgressState.lastDetail || '';
  if (percent) percent.textContent = _swProgressState.lastPercent + '%';
  if (icon) icon.textContent = _swProgressState.lastIcon || '🕷️';
  if (elapsed && _swProgressState.startedAt) {
    const sec = Math.floor((Date.now() - _swProgressState.startedAt) / 1000);
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    elapsed.textContent = `${mm}:${ss}`;
  }
  if (_swProgressState.status === 'success') {
    mini.style.borderColor = 'rgba(34,197,94,0.6)';
    if (percent) percent.style.color = '#34d399';
  } else if (_swProgressState.status === 'error') {
    mini.style.borderColor = 'rgba(239,68,68,0.6)';
    if (percent) percent.style.color = '#f87171';
  } else {
    mini.style.borderColor = 'rgba(99,102,241,0.55)';
    if (percent) percent.style.color = '#fbbf24';
  }
}

// v3.8.3: 모달 재오픈 (사용자가 닫았다 다시 열기)
function reopenSpiderWebProgressModal() {
  const modal = document.getElementById('spiderWebProgressModal');
  if (!modal) return;
  modal.removeAttribute('hidden');
  // 상태 UI 복원 — 단계는 그대로, 결과 영역 표시 여부도 finished에 따라.
  if (_swProgressState.finished && _swProgressState.status === 'success') {
    const result = document.getElementById('swpmResult');
    if (result) result.hidden = false;
    const link = document.getElementById('swpmResultLink');
    if (link && _swProgressState.publishedUrl) link.href = _swProgressState.publishedUrl;
    const closeBtn = document.getElementById('swpmCloseBtn');
    if (closeBtn) closeBtn.disabled = false;
  }
}
window.reopenSpiderWebProgressModal = reopenSpiderWebProgressModal;

function _openSwProgressModal(sources) {
  const modal = document.getElementById('spiderWebProgressModal');
  if (!modal) return;
  _swProgressState.modal = modal;
  _swProgressState.startedAt = new Date().getTime();
  _swProgressState.currentStep = 0;
  _swProgressState.apiDone = false;
  _swProgressState.active = true;
  _swProgressState.finished = false;
  _swProgressState.status = 'running';
  _swProgressState.lastPercent = 0;
  _swProgressState.publishedUrl = '';
  _swProgressState.errorMessage = '';
  _swProgressState.sources = sources || [];
  // 로그 영역 초기화
  const logList = document.getElementById('swpmLogList');
  if (logList) logList.innerHTML = '';
  _swPushLog('거미줄 통합글 생성 시작 — 소스 ' + (sources || []).length + '개', 'info');
  _swUpdateMiniProgress();

  // 소스 그리드 채우기
  const grid = document.getElementById('swpmSourceGrid');
  const countEl = document.getElementById('swpmSourceCount');
  if (countEl) countEl.textContent = String(sources.length);
  if (grid) {
    grid.innerHTML = sources.map((s, i) => {
      const idx = String(i + 1).padStart(2, '0');
      const safeTitle = escapeHtml(s.title || '제목 없음');
      const safeUrl = escapeHtml(s.url || '');
      const titleInitial = (s.title || '?').trim().charAt(0) || '?';
      const safeThumb = escapeHtml(s.thumbnail || '');
      // v3.8.4: img 태그 + onerror 폴백 (background-image는 cache miss 시 깨짐)
      const thumbHtml = safeThumb
        ? `<img class="sw-source-thumb" data-puburl="${safeUrl}" src="${safeThumb}" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" style="object-fit: cover;">
           <div class="sw-source-thumb sw-source-thumb--placeholder" style="display: none;">${escapeHtml(titleInitial)}</div>`
        : `<div class="sw-source-thumb sw-source-thumb--placeholder" data-puburl="${safeUrl}">${escapeHtml(titleInitial)}</div>`;
      return `
        <div class="sw-source-card">
          ${thumbHtml}
          <div class="sw-source-meta">
            <div class="sw-source-num">SOURCE ${idx}</div>
            <div class="sw-source-title">${safeTitle}</div>
            <div class="sw-source-url">${safeUrl}</div>
          </div>
        </div>
      `;
    }).join('');
    // v3.8.4: 모달 진입 후 누락된 썸네일 자동 fetch
    setTimeout(() => _enrichMissingThumbnails(sources), 100);
  }

  // 단계 리스트 초기화
  document.querySelectorAll('#swpmStepList .sw-step-item').forEach((li) => {
    li.classList.remove('is-active', 'is-done', 'is-error');
    li.classList.add('is-pending');
    const state = li.querySelector('.sw-step-state');
    if (state) state.textContent = '대기';
  });

  // 결과/닫기 버튼 초기화
  const result = document.getElementById('swpmResult');
  if (result) result.hidden = true;
  const closeBtn = document.getElementById('swpmCloseBtn');
  if (closeBtn) closeBtn.disabled = true;

  // 진행률 초기화
  _swUpdateProgress(0);
  _swSetCurrent({ label: '대기 중', detail: '곧 시작합니다…', icon: '⏳' });
  document.getElementById('swpmStepCounter').textContent = `0 / ${SW_STEPS.length}`;
  document.getElementById('swpmElapsed').textContent = '00:00';

  modal.removeAttribute('hidden');

  // 경과 시간 timer
  _swProgressState.timer = setInterval(() => {
    const sec = Math.floor((new Date().getTime() - _swProgressState.startedAt) / 1000);
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    const el = document.getElementById('swpmElapsed');
    if (el) el.textContent = `${mm}:${ss}`;
  }, 1000);
}

function _swUpdateProgress(percent) {
  const fill = document.getElementById('swpmProgressFill');
  const ringFill = document.getElementById('swpmRingFill');
  const percentEl = document.getElementById('swpmRingPercent');
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  if (fill) fill.style.width = clamped + '%';
  if (ringFill) {
    const circumference = 2 * Math.PI * 52; // ≈ 326.7
    const offset = circumference - (circumference * clamped) / 100;
    ringFill.setAttribute('stroke-dashoffset', String(offset));
  }
  if (percentEl) percentEl.textContent = String(clamped);
  // v3.8.3: mini 진행률 동기화
  _swProgressState.lastPercent = clamped;
  _swUpdateMiniProgress();
}

function _swSetCurrent({ label, detail, icon }) {
  const lab = document.getElementById('swpmCurrentLabel');
  const det = document.getElementById('swpmCurrentDetail');
  const ic = document.getElementById('swpmCurrentIcon');
  if (lab) lab.textContent = label;
  if (det) det.textContent = detail;
  if (ic) ic.textContent = icon;
  // v3.8.3: 상태 저장 + 로그 + mini 동기화
  _swProgressState.lastLabel = label || '';
  _swProgressState.lastDetail = detail || '';
  _swProgressState.lastIcon = icon || '⏳';
  if (label) _swPushLog(label + (detail ? ': ' + detail : ''), 'info');
  _swUpdateMiniProgress();
}

function _swAdvanceStep(stepId, state) {
  // state: 'active' | 'done' | 'error'
  const li = document.querySelector(`#swpmStepList .sw-step-item[data-step="${stepId}"]`);
  if (!li) return;
  li.classList.remove('is-pending', 'is-active', 'is-done', 'is-error');
  if (state === 'active') {
    li.classList.add('is-active');
    const st = li.querySelector('.sw-step-state');
    if (st) st.textContent = '진행 중';
  } else if (state === 'done') {
    li.classList.add('is-done');
    const st = li.querySelector('.sw-step-state');
    if (st) st.textContent = '완료';
  } else if (state === 'error') {
    li.classList.add('is-error');
    const st = li.querySelector('.sw-step-state');
    if (st) st.textContent = '실패';
  }
}

/**
 * 단계 시뮬레이션 — API 응답 전까지 단계를 cumulative weight 기준으로 점진적으로 진행.
 * 실제 API 응답 시점에 100%로 점프.
 */
function _swStartStepSimulation() {
  // 1단계 즉시 active
  const totalWeight = SW_STEPS.reduce((sum, s) => sum + s.weight, 0);
  _swProgressState.currentStep = 0;

  const advance = () => {
    if (_swProgressState.apiDone) return;
    const stepIdx = _swProgressState.currentStep;
    if (stepIdx >= SW_STEPS.length - 1) {
      // 마지막 발행 단계는 API 응답 후 처리하므로 5단계까지만 자동 진행
      return;
    }
    const step = SW_STEPS[stepIdx];

    // 직전 단계 done 처리
    if (stepIdx > 0) {
      _swAdvanceStep(SW_STEPS[stepIdx - 1].id, 'done');
    }
    // 현재 단계 active
    _swAdvanceStep(step.id, 'active');
    _swSetCurrent({ label: step.label, detail: step.detail, icon: step.icon });

    document.getElementById('swpmStepCounter').textContent = `${stepIdx + 1} / ${SW_STEPS.length}`;

    // 누적 weight 기준 percent (이 단계가 끝나는 시점의 percent)
    const cumulative = SW_STEPS.slice(0, stepIdx + 1).reduce((s, x) => s + x.weight, 0);
    const cap = Math.min(85, Math.round((cumulative / totalWeight) * 100)); // 5단계까지만 자동, 85% cap

    // 현재 percent → cap까지 천천히 채움
    let p = stepIdx === 0 ? 2 : Math.round(((SW_STEPS.slice(0, stepIdx).reduce((s, x) => s + x.weight, 0)) / totalWeight) * 100);
    const tickIntervalMs = Math.max(120, Math.round(step.weight * 80)); // 단계 weight에 비례하는 속도
    const stepInterval = setInterval(() => {
      if (_swProgressState.apiDone) {
        clearInterval(stepInterval);
        return;
      }
      p += 1;
      if (p >= cap) {
        clearInterval(stepInterval);
        _swProgressState.currentStep = stepIdx + 1;
        if (_swProgressState.currentStep < SW_STEPS.length - 1) {
          // 다음 단계로
          setTimeout(advance, 200);
        }
      }
      _swUpdateProgress(p);
    }, tickIntervalMs);

    _swProgressState.simInterval = stepInterval;
  };

  advance();
}

function _swMarkAllDoneUntil(stepId) {
  for (let i = 1; i <= stepId; i++) {
    _swAdvanceStep(i, 'done');
  }
}

function _swFinishSuccess(publishedUrl) {
  _swProgressState.apiDone = true;
  if (_swProgressState.simInterval) clearInterval(_swProgressState.simInterval);

  // 발행 단계 active → done
  _swMarkAllDoneUntil(5);
  _swAdvanceStep(6, 'active');
  _swSetCurrent({ label: '발행', detail: '발행 완료!', icon: '🚀' });
  document.getElementById('swpmStepCounter').textContent = `${SW_STEPS.length} / ${SW_STEPS.length}`;
  _swPushLog('워드프레스/블로그스팟에 발행 완료', 'success');

  // 0.5s 뒤 완료 UI
  setTimeout(() => {
    _swAdvanceStep(6, 'done');
    _swUpdateProgress(100);
    _swSetCurrent({ label: '완료', detail: '모든 작업이 끝났습니다 ✨', icon: '✅' });

    const result = document.getElementById('swpmResult');
    const link = document.getElementById('swpmResultLink');
    if (link && publishedUrl) link.href = publishedUrl;
    if (result) result.hidden = false;

    const closeBtn = document.getElementById('swpmCloseBtn');
    if (closeBtn) closeBtn.disabled = false;

    if (_swProgressState.timer) clearInterval(_swProgressState.timer);

    // v3.8.3: 상태 저장 + 토스트 + 미리보기 자동 스크롤
    _swProgressState.finished = true;
    _swProgressState.status = 'success';
    _swProgressState.publishedUrl = publishedUrl || '';
    _swUpdateMiniProgress();
    _swShowToast('🎉 거미줄 통합글 발행 완료! 미리보기로 이동합니다…', 'success');

    // v3.8.12: 발행 완료 시 1.8초 후 모달 자동 닫기 + 미리보기 자동 스크롤
    setTimeout(() => {
      const modal = document.getElementById('spiderWebProgressModal');
      if (modal) modal.setAttribute('hidden', '');
      _swScrollToPreview();
      // mini bar 4초 후 자동 hide
      setTimeout(() => {
        _swProgressState.active = false;
        _swUpdateMiniProgress();
      }, 4000);
    }, 1800);
  }, 500);
}

function _swFinishError(message) {
  _swProgressState.apiDone = true;
  if (_swProgressState.simInterval) clearInterval(_swProgressState.simInterval);
  if (_swProgressState.timer) clearInterval(_swProgressState.timer);

  const stepId = Math.min(_swProgressState.currentStep + 1, SW_STEPS.length);
  _swAdvanceStep(stepId, 'error');
  _swSetCurrent({ label: '오류 발생', detail: message || '알 수 없는 오류', icon: '❌' });
  _swPushLog('실패: ' + (message || '알 수 없는 오류'), 'error');

  const closeBtn = document.getElementById('swpmCloseBtn');
  if (closeBtn) closeBtn.disabled = false;

  // v3.8.3: 상태 저장 + 실패 토스트
  _swProgressState.finished = true;
  _swProgressState.status = 'error';
  _swProgressState.errorMessage = message || '';
  _swUpdateMiniProgress();
  _swShowToast('❌ 실패: ' + (message || '알 수 없는 오류'), 'error');
}

function closeSpiderWebProgressModal() {
  const modal = document.getElementById('spiderWebProgressModal');
  if (modal) modal.setAttribute('hidden', '');
  // v3.8.3: timer/sim은 작업이 끝났을 때만 정리. 진행 중인 동안에는 backstage 유지.
  if (_swProgressState.finished) {
    if (_swProgressState.timer) clearInterval(_swProgressState.timer);
    if (_swProgressState.simInterval) clearInterval(_swProgressState.simInterval);
    // 완료 후 닫음 → mini도 일정 시간 후 hide
    setTimeout(() => {
      _swProgressState.active = false;
      _swUpdateMiniProgress();
    }, 8000);
  } else {
    // 진행 중인 동안 닫음 → mini는 계속 보임
    _swUpdateMiniProgress();
  }
}

// v3.8.3: 토스트 알림
function _swShowToast(message, level) {
  const color = level === 'error' ? '#fca5a5' : (level === 'success' ? '#34d399' : '#cbd5e1');
  const border = level === 'error' ? 'rgba(239,68,68,0.5)' : (level === 'success' ? 'rgba(34,197,94,0.5)' : 'rgba(99,102,241,0.4)');
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = 'position: fixed; bottom: 88px; left: 50%; transform: translateX(-50%); padding: 14px 26px; background: linear-gradient(135deg, #0f172a, #1e293b); border: 1px solid ' + border + '; border-radius: 12px; color: ' + color + '; font-size: 14px; font-weight: 800; box-shadow: 0 12px 32px rgba(0,0,0,0.5); z-index: 100051; opacity: 0; transition: opacity 0.25s, transform 0.25s;';
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(-4px)';
  });
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// v3.8.3: 미리보기 영역으로 자동 스크롤
function _swScrollToPreview() {
  setTimeout(() => {
    const preview = document.getElementById('spiderWebPreview');
    if (preview && !preview.hidden) {
      preview.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 800);
}

/**
 * 통합글 생성 + 자동 발행 일체화 (v3.7.22)
 */
async function generateAndPublishSpiderWeb() {
  console.log('[SPIDER-WEB] generateAndPublishSpiderWeb 호출됨');

  try {
    updateSelectedPostsFromInputs();
    const urls = selectedPosts.map(p => p.url).filter(u => u && u.trim());

    if (urls.length === 0) {
      alert('⚠️ 최소 1개 이상의 글 주소를 입력하거나 선택해주세요.');
      return;
    }
    if (urls.length > 5) {
      alert('⚠️ 최대 5개까지만 선택할 수 있습니다.');
      return;
    }

    const titleInput = document.getElementById('spiderWebTitle');
    const title = titleInput ? titleInput.value.trim() : '';

    // v3.8.8: platform을 먼저 결정 (이미지 호스팅 분기에 활용)
    const platformInputEarly = document.querySelector('input[name="platform"]:checked');
    const platformEarly = (platformInputEarly && platformInputEarly.value) || 'blogspot';

    // v3.8.13: 발행 시작 전 엔진별 사전 로그인 확인 (dropshot/imagefx 자동 로그인 대기 방지)
    //   - dropshot 계열: dropshot:check-login으로 미로그인 확인 → 미로그인이면 안내 + 중단
    //   - imagefx/flow: imagefx:check-login으로 확인 → 미로그인이면 안내 + 중단
    const _swEngineNeedsLogin = async () => {
      const thumbEng = (document.getElementById('swThumbnailEngine')?.value || '').toLowerCase();
      const h2Eng = (document.getElementById('swH2ImageEngine')?.value || '').toLowerCase();
      const usesDropshot = /dropshot/.test(thumbEng) || /dropshot/.test(h2Eng);
      const usesImagefx = /^(imagefx|flow)$/.test(thumbEng) || /^(imagefx|flow)$/.test(h2Eng);
      const issues = [];
      if (usesDropshot && window.electronAPI?.invoke) {
        try {
          const r = await window.electronAPI.invoke('dropshot:check-login');
          if (!r?.loggedIn) {
            issues.push({ engine: '리더스 나노바나나 무제한', reason: r?.message || '로그인 필요', action: '거미줄 Step 03 카드의 [🔑 리더스 나노바나나 로그인] 버튼 클릭 후 사이트 로그인' });
          }
        } catch (e) { /* IPC 미지원 환경 — 통과 */ }
      }
      if (usesImagefx && window.electronAPI?.invoke) {
        try {
          const r = await window.electronAPI.invoke('imagefx:check-login');
          if (!r?.loggedIn) {
            issues.push({ engine: 'ImageFX/Flow', reason: r?.message || '로그인 필요', action: '거미줄 Step 03 카드의 [🔑 Google 로그인] 버튼 클릭 후 Google 계정 로그인' });
          }
        } catch (e) { /* 무시 */ }
      }
      return issues;
    };

    // v3.8.24: 진행 모달을 login check 전에 먼저 표시 — 사용자가 클릭 후 즉시 반응 확인
    //   기존엔 login check IPC(Playwright 사이트 확인, 5~10초)가 동기로 끝난 후에야 모달 표시 → "10초 대기" 체감.
    //   이제 모달 먼저 → 안에서 login check 진행 → 실패 시 모달 안에서 중단 안내.
    _openSwProgressModal(selectedPosts);
    _swPushLog('이미지 엔진 로그인 상태 확인 중…', 'info');

    const loginIssues = await _swEngineNeedsLogin();
    if (loginIssues.length > 0) {
      const lines = loginIssues.map((it) => `• ${it.engine}: ${it.reason}\n  → ${it.action}`);
      const msg = '⚠️ 선택한 이미지 엔진이 로그인 필요한 상태입니다.\n\n' + lines.join('\n\n') + '\n\n로그인 완료 후 다시 [통합글 생성 및 발행하기] 클릭.';
      _swFinishError('이미지 엔진 로그인 필요 — ' + loginIssues.map((it) => it.engine).join(', '));
      alert(msg);
      return; // 발행 중단
    }

    // v3.8.4: 이미지 정책 + 썸네일/본문 엔진 분리
    const policyInput = document.querySelector('input[name="swImagePolicy"]:checked');
    const imagePolicy = (policyInput && policyInput.value) || 'all';
    const thumbEngineSel = document.getElementById('swThumbnailEngine');
    const h2EngineSel = document.getElementById('swH2ImageEngine');
    const imageThumbnailEngine = (thumbEngineSel && thumbEngineSel.value) || 'nanobanana2';
    const imageH2Engine = (h2EngineSel && h2EngineSel.value) || 'nanobanana2';
    // v3.8.7: 텍스트 포함 옵션
    const includeTextCb = document.getElementById('swImageIncludeText');
    const imageIncludeText = !!(includeTextCb && includeTextCb.checked);

    _swPushLog(`URL ${urls.length}개 · 제목 "${title || '자동 생성'}" · 정책 ${imagePolicy} · 썸네일 ${imageThumbnailEngine} · 본문 ${imageH2Engine}${imageIncludeText ? ' · 텍스트포함' : ''}`, 'info');

    // 단계 시뮬레이션 시작
    _swStartStepSimulation();

    // ── Stage 1: 생성 API ──
    let genResult;
    try {
      const payload = {
        urls,
        title: title || '',
        posts: selectedPosts.map((post, index) => ({
          id: `post-${index + 1}`,
          url: post.url,
          title: post.title || post.url,
          order: index + 1,
        })),
        // v3.8.4: 이미지 옵션 전달 (썸네일/본문 분리 + 정책)
        imagePolicy,
        imageThumbnailEngine,
        imageH2Engine,
        // v3.8.7: 텍스트 포함 (나노바나나·GPT 덕테이프 등에서 한글 텍스트 오버레이)
        imageIncludeText,
        // v3.8.8: 발행 플랫폼 — 백엔드가 WP 미디어 우선 업로드 결정
        platform: platformEarly,
      };
      _swPushLog('IPC generate-internal-consistency 호출…', 'info');
      if (window.electronAPI && window.electronAPI.invoke) {
        genResult = await window.electronAPI.invoke('generate-internal-consistency', payload);
      } else if (window.blogger && window.blogger.generateInternalLinkContent) {
        genResult = await window.blogger.generateInternalLinkContent(payload);
      } else {
        throw new Error('생성 API를 사용할 수 없습니다.');
      }
      _swPushLog('IPC 응답 수신 (success=' + (genResult && genResult.success) + ')', genResult && genResult.success ? 'success' : 'error');
    } catch (e) {
      _swPushLog('IPC 호출 예외: ' + (e?.message || e), 'error');
      _swFinishError('통합글 생성 실패: ' + (e?.message || '알 수 없는 오류'));
      return;
    }

    if (!genResult || !genResult.success) {
      _swPushLog('백엔드 실패 사유: ' + (genResult?.error || '응답 없음'), 'error');
      _swFinishError(genResult?.error || '통합글 생성에 실패했습니다.');
      return;
    }
    if (!genResult.html) {
      _swPushLog('백엔드가 HTML을 반환하지 않음', 'error');
      _swFinishError('생성된 HTML이 없습니다.');
      return;
    }
    _swPushLog('생성된 HTML 길이: ' + genResult.html.length + '자', 'info');
    // v3.8.9: 이미지 생성 결과 로그 — 모든 errors 표시 (사용자 진단 도움)
    if (genResult.imageStats) {
      const s = genResult.imageStats;
      const status = (s.thumbnail || (s.h2Generated && s.h2Generated > 0)) ? 'success' : 'error';
      _swPushLog(`이미지 — 썸네일 ${s.thumbnail ? '✓' : '✗'} · H2 ${s.h2Generated || 0}성공/${s.h2Failed || 0}실패`, status);
      if (Array.isArray(s.errors) && s.errors.length > 0) {
        // 모든 errors 표시 (이전엔 3개로 잘림 → 진단 어려움)
        s.errors.forEach((err) => _swPushLog('이미지 오류: ' + err, 'error'));
      }
      if (!s.thumbnail && (!s.h2Generated || s.h2Generated === 0)) {
        _swPushLog('⚠️ 이미지가 모두 생성 실패 — API 키·엔진 로그인 상태 확인 필요', 'error');
      }
    } else {
      _swPushLog('⚠️ 백엔드가 imageStats를 반환하지 않음 — 이미지 생성 코드 미통합?', 'warn');
    }

    generatedContent = {
      html: genResult.html,
      title: genResult.title || title || '거미줄치기 통합글',
      urls,
      // v3.8.15: 썸네일 + 라벨(해시태그) 보존 → publish-content에 전달
      thumbnailUrl: genResult.thumbnailUrl || '',
      labels: Array.isArray(genResult.labels) ? genResult.labels : [],
      // v3.8.16: WordPress 발행용 SEO 메타데이터 (excerpt, metaDescription)
      excerpt: genResult.excerpt || '',
      metaDescription: genResult.metaDescription || '',
    };
    if (titleInput && genResult.title) titleInput.value = genResult.title;
    if (generatedContent.thumbnailUrl) _swPushLog('썸네일 URL 수신: ' + generatedContent.thumbnailUrl.substring(0, 60) + (generatedContent.thumbnailUrl.length > 60 ? '…' : ''), 'info');
    if (generatedContent.labels.length > 0) _swPushLog('자동 라벨 ' + generatedContent.labels.length + '개: ' + generatedContent.labels.join(', '), 'info');

    // ── Stage 2: 자동 발행 ──
    // 단계 5까지 done 처리, 6단계 active
    _swMarkAllDoneUntil(5);
    _swAdvanceStep(6, 'active');
    _swSetCurrent({ label: '발행', detail: '워드프레스/블로그스팟에 자동 발행 중…', icon: '🚀' });
    _swUpdateProgress(90);

    // 발행 플랫폼: 메인 설정 또는 기본 blogspot
    const platformInput = document.querySelector('input[name="platform"]:checked');
    const platform = (platformInput && platformInput.value) || 'blogspot';

    let pubResult;
    try {
      // v3.8.4: window.blogger.publishContent는 4-인자 시그니처 (payload, title, content, thumbnailUrl).
      //   이전엔 단일 객체로 호출해서 title=undefined → 백엔드 validateTitle 거부 → "제목이 비었습니다" 에러.
      //   → invoke 직접 호출로 통일 (페이로드 객체 형식 일관 + 4-인자 함정 회피).
      const safeTitle = (generatedContent.title && String(generatedContent.title).trim()) || '거미줄치기 통합글';
      const safeHtml = generatedContent.html || '';
      // v3.8.15: 썸네일 + 라벨(해시태그) payload 보존 — 일반 글포스팅과 동일하게 Blogger에 정확 등록
      const safeThumbnail = generatedContent.thumbnailUrl || '';
      const safeLabels = Array.isArray(generatedContent.labels) ? generatedContent.labels : [];

      // v3.8.16: WordPress 발행 전용 세팅 — 글포스팅탭과 동일하게 카테고리 + geminiKey + 메타 전달
      //   publishGeneratedContent → WordPressPublisher.publish가 사용:
      //   · payload.wordpressCategory → categories 옵션
      //   · payload.generatedLabels → preGeneratedTags (AI 태그 건너뜀)
      //   · payload.geminiKey → AI SEO (focusKeyword·metaDescription) 자동 처리
      const isWordPress = /wordpress/i.test(platform);
      const wpCategoryEl = isWordPress ? document.getElementById('wpCategory') : null;
      const wordpressCategory = (wpCategoryEl && wpCategoryEl.value) || '';
      // geminiKey는 localStorage에서 (환경설정 로드 결과)
      let geminiKeyFromUi = '';
      try {
        geminiKeyFromUi = (localStorage.getItem('geminiKey') || localStorage.getItem('geminiApiKey') || '').trim();
      } catch {}
      const platformExtra = isWordPress
        ? ' · WP 카테고리: ' + (wordpressCategory || '(미선택)')
        : '';
      _swPushLog('IPC publish-content 호출 (제목: "' + safeTitle.substring(0, 40) + '"' + (safeTitle.length > 40 ? '…' : '') + ', 썸네일: ' + (safeThumbnail ? '✓' : '✗') + ', 라벨: ' + safeLabels.length + platformExtra + ')', 'info');

      // v3.8.17: Blogger 전용 인증·메타 옵션
      const isBlogger = /^(blogger|blogspot)$/i.test(platform);
      let bloggerCreds = {};
      if (isBlogger) {
        try {
          bloggerCreds = {
            blogId: (localStorage.getItem('blogId') || '').trim() || undefined,
            googleClientId: (localStorage.getItem('googleClientId') || '').trim() || undefined,
            googleClientSecret: (localStorage.getItem('googleClientSecret') || '').trim() || undefined,
            googleAccessToken: (localStorage.getItem('googleAccessToken') || '').trim() || undefined,
            googleRefreshToken: (localStorage.getItem('googleRefreshToken') || '').trim() || undefined,
          };
        } catch (e) { /* localStorage 접근 실패 — publisher가 env로 폴백 */ }
      }

      // 공통 payload 빌더
      const fullPayload = {
        platform,
        publishType: 'publish',
        // Blogger 라벨 우선순위 (publisher가 generatedLabels → labels → topic+keywords 순서로 사용)
        generatedLabels: safeLabels,
        labels: safeLabels,
        topic: safeTitle,
        // 메타 (Blogger는 직접 적용 안 되지만 일관성 위해 전달 — publisher가 무시)
        excerpt: generatedContent.excerpt || undefined,
        metaDescription: generatedContent.metaDescription || undefined,
        featuredImageAlt: safeTitle,
        geminiKey: geminiKeyFromUi || undefined,
        // v3.8.20: 거미줄 통합글 CTA URL 화이트리스트 — publisher의 removeCompetitorLinks가
        //   본인 blogspot/tistory/wordpress 도메인을 경쟁사로 잘못 분류해 <a> 태그를 제거하던
        //   문제를 차단. 통합글 소스 URL은 본인이 직전 발행한 본인 글이므로 무조건 보존.
        sourceUrls: Array.isArray(urls) ? urls.filter(Boolean) : [],
        // Blogger 전용 인증·식별자
        ...(isBlogger ? bloggerCreds : {}),
        // WordPress 전용
        ...(isWordPress ? {
          wordpressCategory: wordpressCategory || undefined,
          wordpressCategories: wordpressCategory || undefined,
        } : {}),
      };

      if (window.electronAPI && window.electronAPI.invoke) {
        pubResult = await window.electronAPI.invoke('publish-content', {
          title: safeTitle,
          content: safeHtml,
          thumbnailUrl: safeThumbnail,
          payload: fullPayload,
        });
      } else if (window.blogger && window.blogger.publishContent) {
        // 폴백: preload 4-인자 시그니처 정확히 사용
        pubResult = await window.blogger.publishContent(
          fullPayload,
          safeTitle,
          safeHtml,
          safeThumbnail
        );
      } else {
        throw new Error('발행 API를 사용할 수 없습니다.');
      }
      _swPushLog('publish-content 응답 수신 (ok=' + (pubResult && pubResult.ok) + ')', pubResult && pubResult.ok ? 'success' : 'error');
    } catch (e) {
      _swFinishError('발행 실패: ' + (e?.message || '알 수 없는 오류'));
      // 생성된 HTML은 미리보기에 그대로 표시 (재발행 가능하도록)
      _renderSpiderWebPreview(generatedContent.html, null, null);
      _persistSpiderWebLast({ title: generatedContent.title, html: generatedContent.html, urls, publishedUrl: '', publishedAt: '' });
      return;
    }

    if (!pubResult || !pubResult.ok) {
      _swFinishError(pubResult?.error || '발행에 실패했습니다.');
      _renderSpiderWebPreview(generatedContent.html, null, null);
      _persistSpiderWebLast({ title: generatedContent.title, html: generatedContent.html, urls, publishedUrl: '', publishedAt: '' });
      return;
    }

    const publishedUrl = pubResult.url || pubResult.postUrl || '';
    const publishedAt = new Date().toISOString();

    // 발행한 글 저장 (publishedPosts에 추가 — 다른 탭에서 활용)
    try {
      savePublishedPost({
        url: publishedUrl,
        title: generatedContent.title,
        publishedAt,
        platform,
      });
    } catch (e) { console.warn('[SPIDER-WEB] savePublishedPost 실패:', e); }

    // 미리보기 렌더 + localStorage 저장
    _renderSpiderWebPreview(generatedContent.html, publishedUrl, publishedAt);
    _persistSpiderWebLast({
      title: generatedContent.title,
      html: generatedContent.html,
      urls,
      publishedUrl,
      publishedAt,
      platform,
    });

    _swFinishSuccess(publishedUrl);

  } catch (error) {
    console.error('[SPIDER-WEB] generateAndPublishSpiderWeb 실패:', error);
    _swFinishError(error?.message || '알 수 없는 오류');
  }
}

/**
 * Step 04 미리보기 영역 렌더 (워드프레스/블로그스팟 발행 모양 그대로)
 */
function _renderSpiderWebPreview(html, publishedUrl, publishedAt) {
  const section = document.getElementById('spiderWebPreview');
  const content = document.getElementById('spiderWebPreviewContent');
  const badge = document.getElementById('spiderWebResultBadge');
  const urlEl = document.getElementById('spiderWebResultUrl');
  const timeEl = document.getElementById('spiderWebResultTime');

  // v3.8.18: 본문에는 썸네일 안 박지만 미리보기에서는 보이도록 별도 prepend
  //   발행 시에는 publisher가 separator 구조로 자동 본문 앞 삽입.
  if (section) section.removeAttribute('hidden');
  if (content) {
    const thumb = (generatedContent && generatedContent.thumbnailUrl) || '';
    const safeThumb = escapeHtml(thumb);
    const thumbBlock = thumb
      ? `<p style="text-align:center;margin:0 0 24px 0;"><img src="${safeThumb}" alt="" style="max-width:100%;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,0.12);"></p>`
      : '';
    content.innerHTML = thumbBlock + (html || '');
  }

  if (badge && publishedUrl) {
    badge.hidden = false;
    if (urlEl) urlEl.href = publishedUrl;
    if (timeEl && publishedAt) {
      try {
        const d = new Date(publishedAt);
        timeEl.textContent = '· ' + d.toLocaleString('ko-KR');
      } catch { timeEl.textContent = ''; }
    }
  } else if (badge) {
    badge.hidden = true;
  }
}

const SW_LAST_KEY = 'spiderWebLastGenerated';

function _persistSpiderWebLast(data) {
  try {
    localStorage.setItem(SW_LAST_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[SPIDER-WEB] localStorage 저장 실패:', e);
  }
}

/**
 * v3.7.22: 거미줄 탭 진입 시 마지막 통합글 복원 (새 글 생성 전까지 미리보기 유지)
 */
function restoreSpiderWebLast() {
  try {
    const raw = localStorage.getItem(SW_LAST_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data || !data.html) return;
    _renderSpiderWebPreview(data.html, data.publishedUrl || null, data.publishedAt || null);
    const titleInput = document.getElementById('spiderWebTitle');
    if (titleInput && data.title && !titleInput.value.trim()) {
      titleInput.value = data.title;
    }
    console.log('[SPIDER-WEB] 마지막 통합글 미리보기 복원 완료');
  } catch (e) {
    console.warn('[SPIDER-WEB] 마지막 통합글 복원 실패:', e);
  }
}

// 전역 스코프에 함수 노출
window.savePublishedPost = savePublishedPost;
window.getPublishedPosts = getPublishedPosts;
window.openPublishedPostsModal = openPublishedPostsModal;
window.closePublishedPostsModal = closePublishedPostsModal;
window.copyToClipboard = copyToClipboard;
window.selectPostFromModal = selectPostFromModal;
window.removeSelectedPost = removeSelectedPost;
window.addUrlInput = addUrlInput;
window.removeUrlInput = removeUrlInput;
window.clearUrlInputs = clearUrlInputs;
window.generateSpiderWebContent = generateSpiderWebContent;
window.saveSpiderWebContent = saveSpiderWebContent;
window.saveAndPublishSpiderWebContent = saveAndPublishSpiderWebContent;
// v3.7.22: 통합 생성+발행 + 진행 모달
window.generateAndPublishSpiderWeb = generateAndPublishSpiderWeb;
window.closeSpiderWebProgressModal = closeSpiderWebProgressModal;
window.restoreSpiderWebLast = restoreSpiderWebLast;
// v3.7.21: 체크박스 다중 선택 헬퍼
window.updatePublishedSelectionCount = updatePublishedSelectionCount;
window.selectAllPublishedPosts = selectAllPublishedPosts;
window.addSelectedPostsToInputs = addSelectedPostsToInputs;

console.log('[SPIDER-WEB] 모듈 로드 완료');
