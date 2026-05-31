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
  
  const inputDiv = document.createElement('div');
  inputDiv.style.display = 'flex';
  inputDiv.style.gap = '8px';
  inputDiv.style.alignItems = 'center';
  inputDiv.innerHTML = `
    <input 
      type="text" 
      id="${inputId}" 
      placeholder="글 주소를 입력하세요 (예: https://example.com/post)" 
      style="flex: 1; padding: 14px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 14px; background: #f9fafb; transition: all 0.3s ease; box-sizing: border-box;"
      onfocus="this.style.borderColor='#667eea'; this.style.backgroundColor='#ffffff';"
      onblur="this.style.borderColor='#e5e7eb'; this.style.backgroundColor='#f9fafb'; this.dispatchEvent(new Event('input'));"
    />
    <button 
      onclick="removeUrlInput('${inputId}')" 
      style="background: #ef4444; color: white; border: none; padding: 14px 20px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);"
    >
      ❌
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
 */
function savePublishedPost(post) {
  try {
    const posts = getPublishedPosts();
    
    // 중복 체크 (URL 기준)
    const exists = posts.find(p => p.url === post.url);
    if (exists) {
      console.log('[SPIDER-WEB] 이미 저장된 글:', post.url);
      return;
    }
    
    posts.push({
      title: post.title,
      url: post.url,
      platform: post.platform || 'wordpress',
      publishedAt: new Date().toISOString(),
      summary: post.summary || ''
    });
    
    localStorage.setItem('publishedPosts', JSON.stringify(posts));
    console.log('[SPIDER-WEB] 발행글 저장 완료:', post.title);
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
function openPublishedPostsModal() {
  modalPosts = getPublishedPosts();
  const modal = document.getElementById('publishedPostsModal');
  const list = document.getElementById('publishedPostsList');

  if (!modal || !list) {
    console.error('[SPIDER-WEB] 모달 요소를 찾을 수 없습니다');
    alert('❌ 발행글 목록 UI를 찾을 수 없습니다.');
    return;
  }

  console.log('[SPIDER-WEB] 발행글 목록 열기:', modalPosts.length, '개');

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

    list.innerHTML = `
      <div style="margin-bottom: 14px; padding: 12px 16px; background: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 10px; color: #c7d2fe; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
        <div style="font-weight: 700;">총 ${modalPosts.length}개 · <span id="pubModalSelectedCount" style="color: #fbbf24;">0</span>개 선택 (최대 5)</div>
        <div style="display: flex; gap: 8px;">
          <button type="button" onclick="selectAllPublishedPosts(true)" style="padding: 6px 12px; background: rgba(255,255,255,0.06); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">최근 5개 선택</button>
          <button type="button" onclick="selectAllPublishedPosts(false)" style="padding: 6px 12px; background: rgba(255,255,255,0.06); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">선택 해제</button>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${sortedPosts.map((post, index) => {
          const safeTitle = escapeHtml(post.title || '제목 없음');
          const safeUrl = escapeHtml(post.url || '');
          const safeThumb = escapeHtml(post.thumbnail || '');
          const platformLabel = post.platform === 'wordpress' ? 'WordPress' : 'Blogger';
          const platformColor = post.platform === 'wordpress' ? '#0073aa' : '#ff5722';
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
          return `
          <label for="pubChk${index}" style="display: flex; gap: 12px; align-items: stretch; padding: 14px 16px; ${selectedStyle} border-radius: 12px; cursor: pointer; transition: background 0.15s ease, border-color 0.15s ease;" onmouseover="${hoverIn}" onmouseout="${hoverOut}">
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
        <button type="button" onclick="closePublishedPostsModal()" style="padding: 10px 18px; background: rgba(255,255,255,0.06); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer;">취소</button>
        <button type="button" onclick="addSelectedPostsToInputs()" style="padding: 10px 22px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; border: none; border-radius: 10px; font-size: 13px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);">✅ 선택한 글 추가</button>
      </div>
    `;
    updatePublishedSelectionCount();
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
}

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
// v3.7.21: 체크박스 다중 선택 헬퍼
window.updatePublishedSelectionCount = updatePublishedSelectionCount;
window.selectAllPublishedPosts = selectAllPublishedPosts;
window.addSelectedPostsToInputs = addSelectedPostsToInputs;

console.log('[SPIDER-WEB] 모듈 로드 완료');
