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
 */
function getPublishedPosts() {
  try {
    const posts = localStorage.getItem('publishedPosts');
    return posts ? JSON.parse(posts) : [];
  } catch (error) {
    console.error('[SPIDER-WEB] 발행글 불러오기 실패:', error);
    return [];
  }
}

/**
 * 발행글 목록 모달 열기
 */
function openPublishedPostsModal() {
  const posts = getPublishedPosts();
  const modal = document.getElementById('publishedPostsModal');
  const list = document.getElementById('publishedPostsList');
  
  if (!modal || !list) {
    console.error('[SPIDER-WEB] 모달 요소를 찾을 수 없습니다');
    alert('❌ 발행글 목록 UI를 찾을 수 없습니다.');
    return;
  }
  
  console.log('[SPIDER-WEB] 발행글 목록 열기:', posts.length, '개');
  
  if (posts.length === 0) {
    list.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: #94a3b8;">
        <div style="font-size: 64px; margin-bottom: 16px;">📭</div>
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">발행한 글이 없습니다</div>
        <div style="font-size: 14px;">먼저 글을 발행한 후 다시 시도해주세요</div>
      </div>
    `;
  } else {
    // 최신순으로 정렬
    const sortedPosts = [...posts].reverse();
    
    list.innerHTML = `
      <div style="margin-bottom: 16px; padding: 12px 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; color: white; text-align: center; font-weight: 700;">
        총 ${posts.length}개의 발행글
      </div>
      ${sortedPosts.map((post, index) => `
        <div style="background: white; border-radius: 16px; padding: 24px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); transition: all 0.3s ease; margin-bottom: 16px;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 25px rgba(0, 0, 0, 0.15)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(0, 0, 0, 0.1)';">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="font-size: 12px; color: #94a3b8; font-weight: 600;">#${sortedPosts.length - index}</span>
                <h3 style="font-size: 18px; font-weight: 700; color: #1e293b; margin: 0;">${post.title}</h3>
              </div>
              <p style="font-size: 14px; color: #64748b; word-break: break-all; margin: 8px 0;">${post.url}</p>
              <div style="display: flex; gap: 8px; margin-top: 8px;">
                <span style="padding: 4px 12px; background: ${post.platform === 'wordpress' ? '#0073aa' : '#ff5722'}; color: white; border-radius: 20px; font-size: 12px; font-weight: 600;">${post.platform === 'wordpress' ? 'WordPress' : 'Blogger'}</span>
                ${post.publishedAt ? `<span style="padding: 4px 12px; background: #e5e7eb; color: #64748b; border-radius: 20px; font-size: 12px; font-weight: 600;">📅 ${new Date(post.publishedAt).toLocaleDateString('ko-KR')}</span>` : ''}
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button onclick="window.open('${post.url}', '_blank')" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; border: none; padding: 10px 20px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);">
              🔗 바로가기
            </button>
            <button onclick="copyToClipboard('${post.url}')" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; padding: 10px 20px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);">
              📋 복사
            </button>
            <button onclick="selectPostFromModal(${posts.length - 1 - index})" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border: none; padding: 10px 20px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);">
              ✅ 선택
            </button>
          </div>
        </div>
      `).join('')}
    `;
  }
  
  modal.style.display = 'flex';
}

/**
 * 발행글 목록 모달 닫기
 */
function closePublishedPostsModal() {
  const modal = document.getElementById('publishedPostsModal');
  if (modal) {
    modal.style.display = 'none';
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

console.log('[SPIDER-WEB] 모듈 로드 완료');
