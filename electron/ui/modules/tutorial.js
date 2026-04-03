// 🎬 사용법 영상 모듈 (관리자 모드 포함)
// - Shift+X+C로 관리자 모드 활성화
// - 관리자만 영상 URL 설정 가능
// - 모든 사용자가 영상 시청 가능

import { getStorageManager, addLog } from './core.js';

// 관리자 모드 상태
let isAdminMode = false;
let adminKeySequence = [];
const ADMIN_KEY_COMBO = ['Shift', 'x', 'c']; // Shift + X + C

// 키 시퀀스 리스너 초기화
export function initTutorialModule() {
  console.log('[TUTORIAL] 튜토리얼 모듈 초기화...');

  // 키보드 이벤트 리스너 등록
  document.addEventListener('keydown', handleAdminKeyPress);

  // 튜토리얼 버튼 이벤트 연결
  setupTutorialButton();

  // 저장된 영상 URL 확인
  checkTutorialVideo();

  console.log('[TUTORIAL] ✅ 튜토리얼 모듈 초기화 완료');
}

// 관리자 키 조합 감지
function handleAdminKeyPress(e) {
  // Shift 키 감지 시 시퀀스 시작
  if (e.key === 'Shift') {
    adminKeySequence = ['Shift'];
    return;
  }

  // Shift가 눌린 상태에서만 시퀀스 진행
  if (!e.shiftKey) {
    adminKeySequence = [];
    return;
  }

  const key = e.key.toLowerCase();

  // 시퀀스 체크 (Shift -> X -> C)
  if (adminKeySequence.length === 1 && adminKeySequence[0] === 'Shift') {
    if (key === 'x') {
      adminKeySequence.push('x');
    } else {
      adminKeySequence = [];
    }
  } else if (adminKeySequence.length === 2 && adminKeySequence[1] === 'x') {
    if (key === 'c') {
      adminKeySequence.push('c');
      // 관리자 모드 토글
      toggleAdminMode();
      adminKeySequence = []; // 성공 시 즉시 초기화
    } else {
      adminKeySequence = [];
    }
  }

  // 시퀀스 이탈 시 또는 입력 후 2초 뒤 리셋 (3초는 너무 긺)
  if (adminKeySequence.length > 0) {
    if (this._adminResetTimer) clearTimeout(this._adminResetTimer);
    this._adminResetTimer = setTimeout(() => {
      adminKeySequence = [];
    }, 2000);
  }
}

// 관리자 모드 토글
function toggleAdminMode() {
  isAdminMode = !isAdminMode;

  const adminBadge = document.getElementById('tutorialAdminBadge');
  const uploadBtn = document.getElementById('tutorialUploadBtn');

  if (isAdminMode) {
    console.log('[TUTORIAL] 🔓 관리자 모드 활성화');
    addLog?.('[튜토리얼] 🔓 관리자 모드 활성화');

    // 관리자 배지 표시
    if (adminBadge) {
      adminBadge.style.display = 'inline-flex';
    }

    // 업로드 버튼 표시
    if (uploadBtn) {
      uploadBtn.style.display = 'inline-flex';
    }

    // 알림
    showToast('🔓 관리자 모드 활성화됨', 'success');
  } else {
    console.log('[TUTORIAL] 🔒 관리자 모드 비활성화');
    addLog?.('[튜토리얼] 🔒 관리자 모드 비활성화');

    // 관리자 배지 숨기기
    if (adminBadge) {
      adminBadge.style.display = 'none';
    }

    // 업로드 버튼 숨기기
    if (uploadBtn) {
      uploadBtn.style.display = 'none';
    }

    showToast('🔒 관리자 모드 비활성화됨', 'info');
  }
}

// 튜토리얼 버튼 설정
function setupTutorialButton() {
  const watchBtn = document.getElementById('tutorialWatchBtn');
  const uploadBtn = document.getElementById('tutorialUploadBtn');

  if (watchBtn) {
    watchBtn.addEventListener('click', showTutorialVideo);
  }

  if (uploadBtn) {
    uploadBtn.addEventListener('click', showUploadModal);
  }
}

// 저장된 영상 URL 확인
async function checkTutorialVideo() {
  try {
    const storage = getStorageManager();
    const videoData = await storage.get('tutorialVideo', true);

    const watchBtn = document.getElementById('tutorialWatchBtn');

    if (videoData && videoData.url) {
      console.log('[TUTORIAL] 저장된 영상 URL 발견');
      if (watchBtn) {
        watchBtn.style.opacity = '1';
        watchBtn.disabled = false;
      }
    } else {
      console.log('[TUTORIAL] 저장된 영상 없음');
      if (watchBtn) {
        watchBtn.style.opacity = '0.5';
        watchBtn.title = '영상이 아직 등록되지 않았습니다';
      }
    }
  } catch (error) {
    console.error('[TUTORIAL] 영상 확인 실패:', error);
  }
}

// 튜토리얼 영상 보기
async function showTutorialVideo() {
  try {
    const storage = getStorageManager();
    const videoData = await storage.get('tutorialVideo', true);

    if (!videoData || !videoData.url) {
      showToast('❌ 등록된 사용법 영상이 없습니다', 'error');
      return;
    }

    // 모달 생성 및 표시
    showVideoModal(videoData);

  } catch (error) {
    console.error('[TUTORIAL] 영상 로드 실패:', error);
    showToast('❌ 영상을 불러올 수 없습니다', 'error');
  }
}

// 영상 모달 표시
function showVideoModal(videoData) {
  // 기존 모달 제거
  const existingModal = document.getElementById('tutorialVideoModal');
  if (existingModal) {
    existingModal.remove();
  }

  // YouTube URL 변환
  let embedUrl = videoData.url;
  if (embedUrl.includes('youtube.com/watch')) {
    const videoId = new URL(embedUrl).searchParams.get('v');
    embedUrl = `https://www.youtube.com/embed/${videoId}`;
  } else if (embedUrl.includes('youtu.be/')) {
    const videoId = embedUrl.split('youtu.be/')[1].split('?')[0];
    embedUrl = `https://www.youtube.com/embed/${videoId}`;
  }

  const modal = document.createElement('div');
  modal.id = 'tutorialVideoModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.95);
    backdrop-filter: blur(20px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.3s ease;
  `;

  modal.innerHTML = `
    <div style="width: 90%; max-width: 1200px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 24px; overflow: hidden; box-shadow: 0 40px 80px rgba(0, 0, 0, 0.5); border: 2px solid #ffd700;">
      <!-- 헤더 -->
      <div style="padding: 24px; background: linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 215, 0, 0.05) 100%); border-bottom: 1px solid rgba(255, 215, 0, 0.3); display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <span style="font-size: 36px;">🎬</span>
          <div>
            <h2 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffd700;">${videoData.title || '사용법 영상'}</h2>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: rgba(255, 215, 0, 0.7);">${videoData.description || '블로거 GPT CLI 사용법을 알아보세요'}</p>
          </div>
        </div>
        <button onclick="document.getElementById('tutorialVideoModal').remove()" style="width: 48px; height: 48px; background: rgba(255, 255, 255, 0.1); border: 2px solid rgba(255, 215, 0, 0.5); border-radius: 12px; color: #ffd700; font-size: 20px; cursor: pointer;">✕</button>
      </div>
      
      <!-- 비디오 영역 -->
      <div style="padding: 24px; aspect-ratio: 16/9;">
        <iframe 
          src="${embedUrl}?autoplay=1&rel=0" 
          style="width: 100%; height: 100%; border: none; border-radius: 16px;"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>
    </div>
  `;

  // 모달 외부 클릭 시 닫기
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // ESC 키로 닫기
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(modal);

  addLog?.('[튜토리얼] 🎬 사용법 영상 재생');
}

// 업로드 모달 표시 (관리자 전용)
function showUploadModal() {
  if (!isAdminMode) {
    showToast('❌ 관리자 모드에서만 사용 가능합니다', 'error');
    return;
  }

  // 기존 모달 제거
  const existingModal = document.getElementById('tutorialUploadModal');
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'tutorialUploadModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(20px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.3s ease;
  `;

  modal.innerHTML = `
    <div style="width: 90%; max-width: 600px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 24px; overflow: hidden; box-shadow: 0 40px 80px rgba(0, 0, 0, 0.5); border: 2px solid #ef4444;">
      <!-- 헤더 -->
      <div style="padding: 24px; background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.05) 100%); border-bottom: 1px solid rgba(239, 68, 68, 0.3); display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <span style="font-size: 32px;">🔐</span>
          <div>
            <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #ef4444;">관리자 - 영상 등록</h2>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: rgba(239, 68, 68, 0.7);">YouTube 또는 외부 영상 URL을 등록하세요</p>
          </div>
        </div>
        <button onclick="document.getElementById('tutorialUploadModal').remove()" style="width: 40px; height: 40px; background: rgba(255, 255, 255, 0.1); border: 2px solid rgba(239, 68, 68, 0.5); border-radius: 10px; color: #ef4444; font-size: 18px; cursor: pointer;">✕</button>
      </div>
      
      <!-- 폼 영역 -->
      <div style="padding: 32px;">
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 600; color: white; font-size: 14px;">영상 제목</label>
          <input type="text" id="tutorialVideoTitle" placeholder="사용법 영상" value="블로거 GPT CLI 사용법" style="width: 100%; padding: 14px 16px; background: rgba(255, 255, 255, 0.1); border: 2px solid rgba(255, 255, 255, 0.2); border-radius: 10px; font-size: 14px; color: white; outline: none;" onfocus="this.style.borderColor='#ef4444'" onblur="this.style.borderColor='rgba(255, 255, 255, 0.2)'">
        </div>
        
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 600; color: white; font-size: 14px;">영상 URL (YouTube 권장)</label>
          <input type="url" id="tutorialVideoUrl" placeholder="https://www.youtube.com/watch?v=..." style="width: 100%; padding: 14px 16px; background: rgba(255, 255, 255, 0.1); border: 2px solid rgba(255, 255, 255, 0.2); border-radius: 10px; font-size: 14px; color: white; outline: none;" onfocus="this.style.borderColor='#ef4444'" onblur="this.style.borderColor='rgba(255, 255, 255, 0.2)'">
          <small style="display: block; margin-top: 6px; color: rgba(255, 255, 255, 0.5); font-size: 11px;">YouTube, Vimeo, 또는 직접 MP4 URL 지원</small>
        </div>
        
        <div style="margin-bottom: 24px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 600; color: white; font-size: 14px;">설명 (선택)</label>
          <textarea id="tutorialVideoDesc" placeholder="영상에 대한 간단한 설명..." rows="2" style="width: 100%; padding: 14px 16px; background: rgba(255, 255, 255, 0.1); border: 2px solid rgba(255, 255, 255, 0.2); border-radius: 10px; font-size: 14px; color: white; outline: none; resize: vertical;" onfocus="this.style.borderColor='#ef4444'" onblur="this.style.borderColor='rgba(255, 255, 255, 0.2)'"></textarea>
        </div>
        
        <div style="display: flex; gap: 12px;">
          <button onclick="window.saveTutorialVideo()" style="flex: 1; padding: 14px 24px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);">
            💾 영상 등록
          </button>
          <button onclick="window.deleteTutorialVideo()" style="padding: 14px 20px; background: rgba(255, 255, 255, 0.1); color: #ef4444; border: 2px solid rgba(239, 68, 68, 0.5); border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer;">
            🗑️ 삭제
          </button>
        </div>
      </div>
    </div>
  `;

  // 모달 외부 클릭 시 닫기
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  document.body.appendChild(modal);

  // 기존 데이터 로드
  loadExistingVideoData();
}

// 기존 영상 데이터 로드
async function loadExistingVideoData() {
  try {
    const storage = getStorageManager();
    const videoData = await storage.get('tutorialVideo', true);

    if (videoData) {
      const titleInput = document.getElementById('tutorialVideoTitle');
      const urlInput = document.getElementById('tutorialVideoUrl');
      const descInput = document.getElementById('tutorialVideoDesc');

      if (titleInput && videoData.title) titleInput.value = videoData.title;
      if (urlInput && videoData.url) urlInput.value = videoData.url;
      if (descInput && videoData.description) descInput.value = videoData.description;
    }
  } catch (error) {
    console.error('[TUTORIAL] 기존 데이터 로드 실패:', error);
  }
}

// 영상 저장
window.saveTutorialVideo = async function () {
  const titleInput = document.getElementById('tutorialVideoTitle');
  const urlInput = document.getElementById('tutorialVideoUrl');
  const descInput = document.getElementById('tutorialVideoDesc');

  const title = titleInput?.value.trim();
  const url = urlInput?.value.trim();
  const description = descInput?.value.trim();

  if (!url) {
    showToast('❌ 영상 URL을 입력해주세요', 'error');
    return;
  }

  // URL 유효성 검사
  try {
    new URL(url);
  } catch {
    showToast('❌ 유효한 URL을 입력해주세요', 'error');
    return;
  }

  try {
    const storage = getStorageManager();
    await storage.set('tutorialVideo', {
      title: title || '사용법 영상',
      url: url,
      description: description || '',
      updatedAt: Date.now(),
      updatedBy: 'admin'
    }, true);

    console.log('[TUTORIAL] ✅ 영상 등록 완료:', url);
    addLog?.('[튜토리얼] ✅ 사용법 영상 등록 완료');

    showToast('✅ 사용법 영상이 등록되었습니다', 'success');

    // 모달 닫기
    const modal = document.getElementById('tutorialUploadModal');
    if (modal) modal.remove();

    // 버튼 상태 업데이트
    checkTutorialVideo();

  } catch (error) {
    console.error('[TUTORIAL] 영상 저장 실패:', error);
    showToast('❌ 저장 실패: ' + error.message, 'error');
  }
};

// 영상 삭제
window.deleteTutorialVideo = async function () {
  if (!confirm('정말 사용법 영상을 삭제하시겠습니까?')) {
    return;
  }

  try {
    const storage = getStorageManager();
    await storage.remove('tutorialVideo');

    console.log('[TUTORIAL] 🗑️ 영상 삭제 완료');
    addLog?.('[튜토리얼] 🗑️ 사용법 영상 삭제 완료');

    showToast('🗑️ 사용법 영상이 삭제되었습니다', 'info');

    // 모달 닫기
    const modal = document.getElementById('tutorialUploadModal');
    if (modal) modal.remove();

    // 버튼 상태 업데이트
    checkTutorialVideo();

  } catch (error) {
    console.error('[TUTORIAL] 영상 삭제 실패:', error);
    showToast('❌ 삭제 실패: ' + error.message, 'error');
  }
};

// 토스트 메시지 표시
function showToast(message, type = 'info') {
  // 기존 토스트 제거
  const existingToast = document.querySelector('.tutorial-toast');
  if (existingToast) {
    existingToast.remove();
  }

  const colors = {
    success: '#10b981',
    error: '#ef4444',
    info: '#3b82f6',
    warning: '#f59e0b'
  };

  const toast = document.createElement('div');
  toast.className = 'tutorial-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%);
    padding: 16px 32px;
    background: ${colors[type] || colors.info};
    color: white;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    z-index: 100000;
    animation: slideUp 0.3s ease, fadeOut 0.3s ease 2.7s;
  `;
  toast.textContent = message;

  // 스타일 추가
  if (!document.getElementById('tutorial-toast-style')) {
    const style = document.createElement('style');
    style.id = 'tutorial-toast-style';
    style.textContent = `
      @keyframes slideUp {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);

  // 3초 후 제거
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// 전역 함수로 등록
window.showTutorialVideo = showTutorialVideo;
window.showTutorialUploadModal = showUploadModal;
window.toggleAdminMode = toggleAdminMode;

// 관리자 모드 상태 확인 함수
window.isAdminMode = () => isAdminMode;

export { showTutorialVideo, showUploadModal, toggleAdminMode, isAdminMode };





