// electron/ui/modules/semi-auto.js
// 반자동 이미지 관리 시스템

/**
 * 🚀 Stability AI 이미지 생성
 * https://platform.stability.ai/
 */
async function generateStabilityImage(prompt) {
  try {
    const stabilityApiKey = document.getElementById('stabilityApiKey')?.value ||
      localStorage.getItem('stabilityApiKey') || '';

    if (!stabilityApiKey) {
      return { ok: false, error: 'Stability AI API 키가 설정되지 않았습니다. 환경설정에서 API 키를 입력해주세요.' };
    }

    console.log('[STABILITY] 이미지 생성 요청:', prompt.substring(0, 50) + '...');

    // Stability AI API 호출 (Stable Diffusion 3)
    const response = await fetch('https://api.stability.ai/v2beta/stable-image/generate/sd3', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stabilityApiKey}`,
        'Accept': 'image/*'
      },
      body: (() => {
        const formData = new FormData();
        formData.append('prompt', prompt);
        formData.append('output_format', 'png');
        formData.append('aspect_ratio', '16:9');
        formData.append('mode', 'text-to-image');
        return formData;
      })()
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[STABILITY] API 오류:', response.status, errorText);
      return { ok: false, error: `Stability AI 오류: ${response.status} - ${errorText}` };
    }

    // 이미지 blob을 Base64로 변환
    const imageBlob = await response.blob();
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(imageBlob);
    });

    console.log('[STABILITY] 이미지 생성 완료');
    return { ok: true, url: base64 };

  } catch (error) {
    console.error('[STABILITY] 이미지 생성 오류:', error);
    return { ok: false, error: error.message };
  }
}

/**
 * 🌸 Pollinations.ai 무료 이미지 생성
 * https://pollinations.ai/
 */
async function generatePollinationsImage(prompt) {
  try {
    console.log('[POLLINATIONS] 이미지 생성 요청:', prompt.substring(0, 50) + '...');

    // Pollinations는 무료이며 API 키가 필요 없음
    // URL에 프롬프트를 인코딩하여 이미지 생성
    const encodedPrompt = encodeURIComponent(prompt);
    const width = 1200;
    const height = 630;
    const seed = Math.floor(Math.random() * 1000000);

    // Pollinations.ai 이미지 URL
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`;

    // 이미지가 실제로 로드되는지 확인
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`HTTP 오류: ${response.status}`);
    }

    // 이미지 blob을 Base64로 변환
    const imageBlob = await response.blob();
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(imageBlob);
    });

    console.log('[POLLINATIONS] 이미지 생성 완료');
    return { ok: true, url: base64 };

  } catch (error) {
    console.error('[POLLINATIONS] 이미지 생성 오류:', error);
    return { ok: false, error: error.message };
  }
}

let semiAutoState = {
  keyword: '',
  imageSource: 'nanobananapro', // 기본값: Nano Banana Pro (Gemini)
  previewPlatform: 'blogspot', // 'blogspot' or 'wordpress'
  generatedContent: null,
  subtopics: [],
  images: {},
  appliedImages: false,
  isGenerating: false,
  cancelRequested: false,
  // 🔗 내부링크 설정
  enableInternalLinks: true,
  internalLinkCount: 1,
  internalLinkBlogUrl: '',
  // 📊 진행률 상태
  progressPercent: 0,
  currentStep: ''
};

// 📊 반자동 고급 진행률 모달 표시/숨기기
function showSemiAutoProgress() {
  const modal = document.getElementById('semiAutoProgressModal');
  if (modal) {
    modal.style.display = 'flex';
    resetSemiAutoProgressModal();
    updateSemiAutoProgress(5, '🚀 콘텐츠 생성을 시작합니다...', 'crawl');
  }
}

function hideSemiAutoProgress() {
  const modal = document.getElementById('semiAutoProgressModal');
  if (modal) {
    // 완료 애니메이션
    updateSemiAutoProgress(100, '✅ 콘텐츠 생성이 완료되었습니다!', 'complete');
    setTimeout(() => {
      modal.style.display = 'none';
      resetSemiAutoProgressModal();
    }, 1500);
  }
}

// 모달 닫기 버튼용 전역 함수
window.closeSemiAutoProgressModal = function () {
  const modal = document.getElementById('semiAutoProgressModal');
  if (modal) {
    modal.style.display = 'none';
  }
};

// 📊 끝판왕 진행률 업데이트 (원형 + 단계 + 로그 + 애니메이션)
function updateSemiAutoProgress(percent, message, step = '') {
  const actualPercent = Math.min(100, Math.max(0, percent));

  // 🎨 원형 진행률 (부드러운 애니메이션)
  const progressCircle = document.getElementById('semiAutoProgressCircle');
  if (progressCircle) {
    const circumference = 2 * Math.PI * 85; // r=85
    const offset = circumference - (actualPercent / 100) * circumference;
    progressCircle.style.transition = 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
    progressCircle.style.strokeDashoffset = offset;

    // 🔥 글로우 효과
    if (actualPercent >= 100) {
      progressCircle.style.filter = 'drop-shadow(0 0 25px rgba(16, 185, 129, 0.9))';
    } else if (actualPercent > 0) {
      progressCircle.style.filter = 'drop-shadow(0 0 15px rgba(102, 126, 234, 0.6))';
    }
  }

  // 🎨 퍼센트 텍스트 (카운트업 애니메이션)
  const progressPercent = document.getElementById('semiAutoProgressPercent');
  if (progressPercent) {
    const currentValue = parseInt(progressPercent.textContent) || 0;
    if (Math.abs(currentValue - actualPercent) > 1) {
      animateSemiAutoValue(progressPercent, currentValue, actualPercent, 400);
    } else {
      progressPercent.textContent = `${Math.round(actualPercent)}%`;
    }

    // 완료 시 색상 변경
    if (actualPercent >= 100) {
      progressPercent.style.color = '#10b981';
      progressPercent.style.textShadow = '0 0 30px rgba(16, 185, 129, 0.8)';
    }
  }

  // 🎨 현재 작업 텍스트 (페이드 효과)
  const progressText = document.getElementById('semiAutoProgressText');
  if (progressText && message) {
    const cleanMessage = message.replace(/\[PROGRESS\]\s*\d+%\s*-\s*/, '').trim();
    if (progressText.textContent !== cleanMessage) {
      progressText.style.opacity = '0';
      progressText.style.transform = 'translateY(5px)';
      setTimeout(() => {
        progressText.innerHTML = `<span style="font-size: 22px; margin-right: 8px;">${getStepEmoji(step)}</span> ${cleanMessage}`;
        progressText.style.transition = 'all 0.3s ease';
        progressText.style.opacity = '1';
        progressText.style.transform = 'translateY(0)';
      }, 150);
    }
  }

  // 🎨 로그 추가 (스타일 개선)
  const progressLog = document.getElementById('semiAutoProgressLog');
  if (progressLog && message) {
    const timestamp = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const cleanMessage = message.replace(/\[PROGRESS\]\s*\d+%\s*-\s*/, '').trim();
    const logColor = step === 'complete' ? '#10b981' : actualPercent > 50 ? '#60a5fa' : '#94a3b8';
    const icon = step === 'complete' ? '✅' : getStepEmoji(step);
    progressLog.innerHTML += `<div style="color: ${logColor}; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">${icon} [${timestamp}] ${cleanMessage}</div>`;
    progressLog.scrollTop = progressLog.scrollHeight;
  }

  // 🎨 단계 업데이트
  if (step) {
    updateSemiAutoProgressStep(step);
  }

  semiAutoState.progressPercent = actualPercent;
  semiAutoState.currentStep = step;
}

// 🔥 숫자 카운트업 애니메이션
function animateSemiAutoValue(element, start, end, duration) {
  const startTime = performance.now();
  const update = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (end - start) * easeOut);
    element.textContent = `${current}%`;
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  };
  requestAnimationFrame(update);
}

function getStepEmoji(step) {
  const emojis = {
    'crawl': '🔍',
    'h1': '📝',
    'h2': '📑',
    'content': '✍️',
    'complete': '✅',
    '': '⏳'
  };
  return emojis[step] || '⏳';
}

function updateSemiAutoProgressStep(activeStep) {
  const steps = document.querySelectorAll('#semiAutoProgressSteps .semi-progress-step');
  const stepOrder = ['crawl', 'h1', 'h2', 'content', 'complete'];
  const activeIndex = stepOrder.indexOf(activeStep);

  steps.forEach((stepEl, index) => {
    stepEl.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';

    if (index < activeIndex) {
      // 🔥 완료 상태
      stepEl.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(5, 150, 105, 0.3) 100%)';
      stepEl.style.borderColor = 'rgba(16, 185, 129, 0.8)';
      stepEl.style.transform = 'scale(1)';
      stepEl.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.4)';
      stepEl.style.animation = 'none';
      // 아이콘 변경
      const iconEl = stepEl.querySelector('div:first-child');
      if (iconEl && !iconEl.textContent.includes('✅')) {
        iconEl.textContent = '✅';
      }
    } else if (index === activeIndex) {
      // 🔥 진행 중 상태 (펄스 애니메이션)
      stepEl.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.4) 0%, rgba(118, 75, 162, 0.4) 100%)';
      stepEl.style.borderColor = 'rgba(102, 126, 234, 0.8)';
      stepEl.style.transform = 'scale(1.1)';
      stepEl.style.boxShadow = '0 6px 25px rgba(102, 126, 234, 0.5)';
      stepEl.style.animation = 'pulse 1.5s infinite';
    } else {
      // 🔥 대기 상태
      stepEl.style.background = 'rgba(255,255,255,0.05)';
      stepEl.style.borderColor = 'rgba(255,255,255,0.15)';
      stepEl.style.transform = 'scale(1)';
      stepEl.style.boxShadow = 'none';
      stepEl.style.animation = 'none';
    }
  });
}

function resetSemiAutoProgressModal() {
  // 원형 진행률 리셋
  const progressCircle = document.getElementById('semiAutoProgressCircle');
  if (progressCircle) {
    progressCircle.style.strokeDashoffset = 534; // r=85, circumference = 2 * PI * 85 ≈ 534
  }

  // 퍼센트 리셋
  const progressPercent = document.getElementById('semiAutoProgressPercent');
  if (progressPercent) {
    progressPercent.textContent = '0%';
  }

  // 텍스트 리셋
  const progressText = document.getElementById('semiAutoProgressText');
  if (progressText) {
    progressText.innerHTML = '<span style="font-size: 20px;">⏳</span> 콘텐츠 생성 준비 중...';
  }

  // 단계 리셋
  const steps = document.querySelectorAll('#semiAutoProgressSteps .semi-progress-step');
  steps.forEach(step => {
    step.classList.remove('active', 'completed');
  });

  // 로그 리셋
  const progressLog = document.getElementById('semiAutoProgressLog');
  if (progressLog) {
    progressLog.innerHTML = '<div style="color: #60a5fa;">🚀 콘텐츠 생성을 시작합니다...</div>';
  }
}

// 전역 함수로 등록 (IPC에서 호출 가능)
window.updateSemiAutoProgress = updateSemiAutoProgress;

/**
 * 🔗 내부링크 개수 설정
 */
window.setInternalLinkCount = function (count) {
  semiAutoState.internalLinkCount = count;

  // 버튼 스타일 업데이트
  for (let i = 0; i <= 3; i++) {
    const btn = document.getElementById(`linkCount${i}`);
    if (btn) {
      if (i === count) {
        btn.classList.add('active');
        btn.style.background = 'rgba(255, 215, 0, 0.3)';
        btn.style.borderColor = '#ffd700';
        btn.style.color = 'white';
      } else {
        btn.classList.remove('active');
        btn.style.background = 'rgba(255, 255, 255, 0.1)';
        btn.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        btn.style.color = 'rgba(255, 255, 255, 0.7)';
      }
    }
  }

  console.log(`[SEMI-AUTO] 내부링크 개수 변경: ${count}개`);
};

/**
 * 🔗 내부링크 토글 초기화
 */
function initInternalLinkToggle() {
  const toggle = document.getElementById('enableInternalLinks');
  const options = document.getElementById('internalLinkOptions');
  const blogUrlInput = document.getElementById('internalLinkBlogUrl');

  if (toggle) {
    toggle.addEventListener('change', function () {
      semiAutoState.enableInternalLinks = this.checked;
      if (options) {
        options.style.display = this.checked ? 'block' : 'none';
      }
      console.log(`[SEMI-AUTO] 내부링크 ${this.checked ? '활성화' : '비활성화'}`);
    });
  }

  if (blogUrlInput) {
    blogUrlInput.addEventListener('change', function () {
      semiAutoState.internalLinkBlogUrl = this.value.trim();
      console.log(`[SEMI-AUTO] 블로그 URL 설정: ${this.value}`);
    });
  }
}

// DOM 로드 후 초기화
document.addEventListener('DOMContentLoaded', initInternalLinkToggle);

/**
 * 이미지 소스 설정
 */
window.setSemiAutoImageSource = function (source) {
  semiAutoState.imageSource = source;
  console.log(`[SEMI-AUTO] 이미지 소스 변경: ${source}`);
};

// ============================================
// 🖼️ AI 이미지 자동 수집 시스템 (끝판왕)
// ============================================

/**
 * 🤖 완전 자동 이미지 수집 및 배치 (콘텐츠 생성 시 자동 호출)
 * @param {string} keyword - 키워드/제목
 * @param {string[]} subtopics - 소제목 배열
 */
async function autoCollectAndApplyImages(keyword, subtopics) {
  if (!keyword || !subtopics || subtopics.length === 0) {
    console.log('[AUTO-IMAGE] 키워드 또는 소제목이 없어 건너뜀');
    return;
  }

  console.log('[AUTO-IMAGE] 🚀 자동 이미지 수집 시작:', keyword);
  console.log('[AUTO-IMAGE] 소제목 수:', subtopics.length);

  // 네이버 API 키 확인
  const settings = await window.blogger?.getEnv?.() || { data: {} };
  const naverClientId = settings.data?.naverClientId || settings.data?.naverCustomerId || '';
  const naverClientSecret = settings.data?.naverClientSecret || settings.data?.naverSecretKey || '';

  // 네이버 API 없으면 Pexels 또는 다른 소스 시도
  if (naverClientId && naverClientSecret) {
    try {
      console.log('[AUTO-IMAGE] 네이버 API로 이미지 수집 시도');

      const result = await window.blogger.collectImagesByTitle({
        title: keyword,
        subtopics: subtopics,
        naverClientId,
        naverClientSecret,
        options: {
          saveToFolder: true,
          maxImagesPerSubtopic: 2,
          includeShoppingImages: false
        }
      });

      if (result.ok && result.images && result.images.length > 0) {
        console.log('[AUTO-IMAGE] ✅ 네이버 이미지 수집 성공:', result.images.length, '개');
        await applyCollectedImages(result.images, result.folderPath);
        semiAutoState.autoImageCollected = true;
        return;
      }
    } catch (error) {
      console.warn('[AUTO-IMAGE] 네이버 API 수집 실패:', error.message);
    }
  }

  // Pexels API 시도
  const pexelsApiKey = settings.data?.pexelsApiKey || '';
  if (pexelsApiKey) {
    try {
      console.log('[AUTO-IMAGE] Pexels API로 이미지 수집 시도');

      // 각 소제목에 대해 Pexels 이미지 검색
      const images = [];
      for (let i = 0; i < Math.min(subtopics.length, 5); i++) {
        const searchQuery = subtopics[i].replace(/<[^>]*>/g, '').trim();
        // Pexels API는 main.js의 핸들러를 통해 호출
        try {
          const pexelsResult = await window.blogger.invoke('search-pexels-images', {
            query: searchQuery || keyword,
            perPage: 1
          });
          if (pexelsResult && pexelsResult.photos && pexelsResult.photos.length > 0) {
            images.push({
              url: pexelsResult.photos[0].src.large,
              title: searchQuery,
              source: 'pexels'
            });
          }
        } catch {
          // 개별 검색 실패는 무시
        }
      }

      if (images.length > 0) {
        console.log('[AUTO-IMAGE] ✅ Pexels 이미지 수집 성공:', images.length, '개');
        await applyCollectedImages(images, null);
        semiAutoState.autoImageCollected = true;
        return;
      }
    } catch (error) {
      console.warn('[AUTO-IMAGE] Pexels API 수집 실패:', error.message);
    }
  }

  // 기본: Google CSE 또는 AI 생성 이미지 사용
  console.log('[AUTO-IMAGE] API 키 없음 - 수동 이미지 추가 필요');
  semiAutoState.autoImageCollected = false;
}

/**
 * 🖼️ 제목 기반 AI 이미지 자동 수집 (수동 버튼용)
 * 네이버 이미지 검색 + 쇼핑 API 활용
 */
window.collectAIImages = async function () {
  const keyword = semiAutoState.keyword;
  const subtopics = semiAutoState.subtopics || [];

  if (!keyword) {
    alert('❌ 먼저 키워드를 입력하고 콘텐츠를 생성해주세요.');
    return;
  }

  if (subtopics.length === 0) {
    alert('❌ 먼저 콘텐츠를 생성해주세요. 소제목이 필요합니다.');
    return;
  }

  // 네이버 API 키 확인
  const settings = await window.blogger?.getEnv?.() || { data: {} };
  const naverClientId = settings.data?.naverClientId || settings.data?.naverCustomerId || '';
  const naverClientSecret = settings.data?.naverClientSecret || settings.data?.naverSecretKey || '';

  if (!naverClientId || !naverClientSecret) {
    alert('❌ 네이버 API 키가 설정되지 않았습니다.\n\n환경설정에서 네이버 데이터랩 ID와 Secret을 입력해주세요.');
    return;
  }

  // 수집 진행 모달 표시
  showImageCollectionProgress('🖼️ AI 이미지 자동 수집 중...', `키워드: ${keyword}`);

  try {
    console.log('[IMAGE-COLLECT] 🚀 제목 기반 이미지 수집 시작:', keyword);
    console.log('[IMAGE-COLLECT] 소제목:', subtopics);

    const result = await window.blogger.collectImagesByTitle({
      title: keyword,
      subtopics: subtopics,
      naverClientId,
      naverClientSecret,
      options: {
        saveToFolder: true,
        maxImagesPerSubtopic: 3,
        includeShoppingImages: true
      }
    });

    hideImageCollectionProgress();

    if (result.ok && result.images.length > 0) {
      console.log('[IMAGE-COLLECT] ✅ 수집 완료:', result.images.length, '개');

      // 수집된 이미지를 소제목별로 자동 배치
      await applyCollectedImages(result.images, result.folderPath);

      alert(`✅ AI 이미지 수집 완료!\n\n수집된 이미지: ${result.images.length}개\n저장 폴더: ${result.folderPath}\n\n각 소제목에 최적 이미지가 자동 배치되었습니다.`);
    } else {
      alert(`❌ 이미지 수집 실패\n\n${result.error || '이미지를 찾을 수 없습니다.'}`);
    }

  } catch (error) {
    hideImageCollectionProgress();
    console.error('[IMAGE-COLLECT] ❌ 오류:', error);
    alert(`❌ 이미지 수집 중 오류 발생: ${error.message}`);
  }
};

/**
 * 🛍️ 쇼핑몰 URL 이미지 자동 수집
 */
window.collectShoppingImages = async function () {
  const subtopics = semiAutoState.subtopics || [];

  if (subtopics.length === 0) {
    alert('❌ 먼저 콘텐츠를 생성해주세요. 소제목이 필요합니다.');
    return;
  }

  // URL 입력 모달 표시
  const shoppingUrl = await showShoppingUrlInputModal();

  if (!shoppingUrl) {
    return; // 취소됨
  }

  // URL 유효성 검사
  try {
    new URL(shoppingUrl);
  } catch {
    alert('❌ 유효한 URL을 입력해주세요.');
    return;
  }

  // 수집 진행 모달 표시
  showImageCollectionProgress('🛍️ 쇼핑몰 이미지 수집 중...', `URL: ${shoppingUrl.substring(0, 50)}...`);

  try {
    console.log('[IMAGE-COLLECT] 🛍️ 쇼핑몰 URL 이미지 수집 시작:', shoppingUrl);

    const result = await window.blogger.collectImagesFromUrl({
      shoppingUrl,
      subtopics,
      options: {
        saveToFolder: true,
        maxImages: 20
      }
    });

    hideImageCollectionProgress();

    if (result.ok && result.images.length > 0) {
      console.log('[IMAGE-COLLECT] ✅ 수집 완료:', result.images.length, '개');

      // 수집된 이미지를 소제목별로 자동 배치
      await applyCollectedImages(result.images, result.folderPath);

      alert(`✅ 쇼핑몰 이미지 수집 완료!\n\n수집된 이미지: ${result.images.length}개\n저장 폴더: ${result.folderPath}\n\n각 소제목에 최적 이미지가 자동 배치되었습니다.`);
    } else {
      alert(`❌ 이미지 수집 실패\n\n${result.error || '이미지를 찾을 수 없습니다.'}`);
    }

  } catch (error) {
    hideImageCollectionProgress();
    console.error('[IMAGE-COLLECT] ❌ 오류:', error);
    alert(`❌ 이미지 수집 중 오류 발생: ${error.message}`);
  }
};

/**
 * 수집된 이미지를 소제목별로 자동 배치 (중복 방지)
 */
async function applyCollectedImages(images, folderPath) {
  console.log('[IMAGE-COLLECT] 🎯 이미지 자동 배치 시작');

  const subtopics = semiAutoState.subtopics || [];
  const usedImageUrls = new Set(); // 중복 방지용

  // 이미지를 소제목 수 만큼 분배 (중복 없이)
  const assignedImages = [];
  for (let i = 0; i < subtopics.length; i++) {
    // 아직 사용되지 않은 이미지 찾기
    const availableImage = images.find(img => !usedImageUrls.has(img.url));
    if (availableImage) {
      assignedImages[i] = availableImage;
      usedImageUrls.add(availableImage.url);
    } else if (images.length > 0) {
      // 모든 이미지가 사용되었으면 처음부터 재사용 (마지막 수단)
      assignedImages[i] = images[i % images.length];
    }
  }

  for (let i = 0; i < subtopics.length; i++) {
    const subtopic = subtopics[i];
    const image = assignedImages[i];

    if (!image) continue;

    // 이미지 URL 결정 (로컬 경로 또는 원본 URL)
    let imageUrl = image.url;
    if (image.localPath) {
      imageUrl = image.url;
    }

    // 이미지 데이터 저장
    if (!semiAutoState.images) {
      semiAutoState.images = {};
    }

    semiAutoState.images[i] = {
      url: imageUrl,
      prompt: image.title || `Collected image for: ${subtopic}`,
      generated: true,
      source: image.source || 'naver-image'
    };

    // 🔥 영어 프롬프트 영역 업데이트
    const promptDiv = document.getElementById(`prompt-${i}`);
    if (promptDiv) {
      promptDiv.innerHTML = `
        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 12px; border-radius: 8px; border-left: 4px solid #f59e0b;">
          <div style="font-size: 11px; color: #b45309; margin-bottom: 4px; font-weight: 600;">🛍️ 수집된 이미지</div>
          <span style="color: #92400e; word-break: break-word; font-size: 12px;">${image.title || subtopic}</span>
          <div style="font-size: 10px; color: #a16207; margin-top: 4px;">출처: ${image.source || 'API 수집'}</div>
        </div>
      `;
    }

    // 🔥 이미지 미리보기 영역 업데이트 (preview-{index}) - 클릭 가능하게
    const previewDiv = document.getElementById(`preview-${i}`);
    if (previewDiv) {
      previewDiv.innerHTML = `
        <div style="position: relative; width: 100%; height: 100%; cursor: pointer;" onclick="showSemiAutoImageModal(${i})">
          <img src="${imageUrl}" alt="${subtopic}" 
               style="width: 100%; height: 200px; border-radius: 12px; object-fit: cover; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15); pointer-events: none;"
               onerror="this.parentElement.innerHTML='<div style=\\'padding: 20px; color: #f59e0b; text-align: center;\\'>⚠️ 이미지 로드 실패</div>';">
          <div style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 600; pointer-events: none;">
            ✅ 수집 완료
          </div>
        </div>
      `;
    }

    // 기존 미리보기 영역도 업데이트 (semiAutoImagePreview_{i})
    const oldPreviewDiv = document.getElementById(`semiAutoImagePreview_${i}`);
    if (oldPreviewDiv) {
      oldPreviewDiv.innerHTML = `
        <img src="${imageUrl}" alt="${subtopic}" 
             style="width: 100%; height: auto; border-radius: 12px; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15); object-fit: cover; max-height: 400px;"
             onerror="this.parentElement.innerHTML='<div style=\\'padding: 20px; color: #f59e0b;\\'>⚠️ 이미지 로드 실패</div>';">
      `;
    }

    console.log(`[IMAGE-COLLECT] ✅ 소제목 ${i + 1} 이미지 배치: ${image.title?.substring(0, 30)}...`);
  }

  semiAutoState.appliedImages = true;

  // 이미지 적용 버튼 활성화
  const applyBtn = document.getElementById('applySemiAutoBtn');
  if (applyBtn) {
    applyBtn.disabled = false;
    applyBtn.style.opacity = '1';
  }

  console.log(`[IMAGE-COLLECT] ✅ 이미지 자동 배치 완료 (${assignedImages.filter(Boolean).length}/${subtopics.length}개)`);
}

/**
 * 쇼핑몰 URL 입력 모달
 */
function showShoppingUrlInputModal() {
  return new Promise((resolve) => {
    // 기존 모달 제거
    const existingModal = document.getElementById('shoppingUrlModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'shoppingUrlModal';
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
    `;

    modal.innerHTML = `
      <div style="width: 90%; max-width: 600px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 24px; overflow: hidden; box-shadow: 0 40px 80px rgba(0, 0, 0, 0.5); border: 2px solid #ffd700;">
        <div style="padding: 24px; background: linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 215, 0, 0.05) 100%); border-bottom: 1px solid rgba(255, 215, 0, 0.3);">
          <div style="display: flex; align-items: center; gap: 16px;">
            <span style="font-size: 36px;">🛍️</span>
            <div>
              <h2 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffd700;">쇼핑몰 URL 이미지 수집</h2>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: rgba(255, 215, 0, 0.7);">쿠팡, G마켓, 11번가 등 쇼핑몰 상품 페이지 URL을 입력하세요</p>
            </div>
          </div>
        </div>
        
        <div style="padding: 32px;">
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: white; font-size: 14px;">쇼핑몰 상품 URL</label>
            <input type="url" id="shoppingUrlInput" placeholder="https://www.coupang.com/vp/products/..." 
                   style="width: 100%; padding: 14px 16px; background: rgba(255, 255, 255, 0.1); border: 2px solid rgba(255, 215, 0, 0.3); border-radius: 10px; font-size: 14px; color: white; outline: none;"
                   onfocus="this.style.borderColor='#ffd700'" onblur="this.style.borderColor='rgba(255, 215, 0, 0.3)'">
          </div>
          
          <div style="background: rgba(255, 215, 0, 0.1); border-radius: 10px; padding: 16px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #ffd700; font-size: 13px;">💡 지원 쇼핑몰</p>
            <p style="margin: 0; font-size: 12px; color: rgba(255, 255, 255, 0.7); line-height: 1.6;">
              쿠팡, G마켓, 11번가, 네이버 쇼핑, 옥션, 인터파크<br>
              일반 쇼핑몰 사이트도 대부분 지원됩니다.
            </p>
          </div>
          
          <div style="display: flex; gap: 12px;">
            <button id="shoppingUrlSubmit" style="flex: 1; padding: 14px 24px; background: linear-gradient(135deg, #ffd700 0%, #f59e0b 100%); color: #1e293b; border: none; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer;">
              🖼️ 이미지 수집 시작
            </button>
            <button id="shoppingUrlCancel" style="padding: 14px 20px; background: rgba(255, 255, 255, 0.1); color: white; border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer;">
              취소
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // 포커스
    setTimeout(() => {
      document.getElementById('shoppingUrlInput')?.focus();
    }, 100);

    // 이벤트
    document.getElementById('shoppingUrlSubmit').onclick = () => {
      const url = document.getElementById('shoppingUrlInput').value.trim();
      modal.remove();
      resolve(url);
    };

    document.getElementById('shoppingUrlCancel').onclick = () => {
      modal.remove();
      resolve(null);
    };

    // Enter 키
    document.getElementById('shoppingUrlInput').onkeypress = (e) => {
      if (e.key === 'Enter') {
        document.getElementById('shoppingUrlSubmit').click();
      }
    };

    // 외부 클릭
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.remove();
        resolve(null);
      }
    };
  });
}

/**
 * 이미지 수집 진행 모달
 */
function showImageCollectionProgress(title, subtitle) {
  const existingModal = document.getElementById('imageCollectProgressModal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'imageCollectProgressModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(10px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  modal.innerHTML = `
    <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 20px; padding: 40px; text-align: center; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5); border: 2px solid rgba(255, 215, 0, 0.3);">
      <div style="width: 80px; height: 80px; margin: 0 auto 24px; border: 4px solid rgba(255, 215, 0, 0.3); border-top-color: #ffd700; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <h3 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 700; color: #ffd700;">${title}</h3>
      <p style="margin: 0; font-size: 14px; color: rgba(255, 255, 255, 0.7);">${subtitle}</p>
    </div>
    <style>
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
  `;

  document.body.appendChild(modal);
}

function hideImageCollectionProgress() {
  const modal = document.getElementById('imageCollectProgressModal');
  if (modal) modal.remove();
}

/**
 * 저장된 이미지 폴더 열기
 */
window.openImageFolders = async function () {
  try {
    const result = await window.blogger.getImageFolders();

    if (result.ok && result.folders.length > 0) {
      showImageFoldersModal(result.folders);
    } else {
      alert('📁 저장된 이미지 폴더가 없습니다.\n\nAI 이미지 수집을 먼저 실행해주세요.');
    }
  } catch (error) {
    console.error('[IMAGE-FOLDERS] ❌ 오류:', error);
    alert(`❌ 폴더 목록을 불러올 수 없습니다: ${error.message}`);
  }
};

/**
 * 이미지 폴더 목록 모달
 */
function showImageFoldersModal(folders) {
  const existingModal = document.getElementById('imageFoldersModal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'imageFoldersModal';
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
  `;

  const folderList = folders.map(f => `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; background: rgba(255, 255, 255, 0.05); border-radius: 10px; margin-bottom: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 28px;">📁</span>
        <div>
          <p style="margin: 0; font-weight: 600; color: white; font-size: 14px;">${f.name}</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: rgba(255, 255, 255, 0.5);">${f.imageCount}개 이미지</p>
        </div>
      </div>
      <button onclick="window.useImagesFromFolder('${f.path.replace(/\\/g, '\\\\')}'); document.getElementById('imageFoldersModal').remove();" 
              style="padding: 8px 16px; background: linear-gradient(135deg, #ffd700 0%, #f59e0b 100%); color: #1e293b; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;">
        사용하기
      </button>
    </div>
  `).join('');

  modal.innerHTML = `
    <div style="width: 90%; max-width: 600px; max-height: 80vh; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 24px; overflow: hidden; box-shadow: 0 40px 80px rgba(0, 0, 0, 0.5); border: 2px solid rgba(255, 215, 0, 0.3);">
      <div style="padding: 24px; background: linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 215, 0, 0.05) 100%); border-bottom: 1px solid rgba(255, 215, 0, 0.3); display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <span style="font-size: 32px;">🗂️</span>
          <div>
            <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffd700;">저장된 이미지 폴더</h2>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: rgba(255, 215, 0, 0.7);">${folders.length}개 폴더</p>
          </div>
        </div>
        <button onclick="document.getElementById('imageFoldersModal').remove()" style="width: 40px; height: 40px; background: rgba(255, 255, 255, 0.1); border: 2px solid rgba(255, 215, 0, 0.5); border-radius: 10px; color: #ffd700; font-size: 18px; cursor: pointer;">✕</button>
      </div>
      
      <div style="padding: 24px; max-height: 60vh; overflow-y: auto;">
        ${folderList}
      </div>
    </div>
  `;

  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };

  document.body.appendChild(modal);
}

/**
 * 폴더에서 이미지 사용하기
 */
window.useImagesFromFolder = async function (folderPath) {
  try {
    const result = await window.blogger.getFolderImages(folderPath);

    if (result.ok && result.images.length > 0) {
      console.log('[IMAGE-FOLDERS] 폴더 이미지 로드:', result.images.length, '개');

      const subtopics = semiAutoState.subtopics || [];

      for (let i = 0; i < Math.min(subtopics.length, result.images.length); i++) {
        const image = result.images[i];

        // 로컬 파일 경로를 file:// URL로 변환
        const imageUrl = 'file://' + image.path.replace(/\\/g, '/');

        if (!semiAutoState.images) {
          semiAutoState.images = {};
        }

        semiAutoState.images[i] = {
          url: imageUrl,
          prompt: image.name,
          generated: true,
          source: 'local-folder'
        };

        // 미리보기 업데이트
        const previewDiv = document.getElementById(`semiAutoImagePreview_${i}`);
        if (previewDiv) {
          previewDiv.innerHTML = `
            <img src="${imageUrl}" alt="${image.name}" 
                 style="width: 100%; height: auto; border-radius: 12px; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15); object-fit: cover; max-height: 400px;"
                 onerror="this.parentElement.innerHTML='<div style=\\'padding: 20px; color: #f59e0b;\\'>⚠️ 이미지 로드 실패</div>';">
          `;
        }
      }

      semiAutoState.appliedImages = true;
      alert(`✅ ${Math.min(subtopics.length, result.images.length)}개 이미지가 배치되었습니다.`);
    } else {
      alert('❌ 폴더에 이미지가 없습니다.');
    }
  } catch (error) {
    console.error('[IMAGE-FOLDERS] ❌ 오류:', error);
    alert(`❌ 이미지를 불러올 수 없습니다: ${error.message}`);
  }
};

// ============================================
// 기존 코드 계속
// ============================================

/**
 * 미리보기 플랫폼 설정
 */
window.setSemiAutoPreviewPlatform = function (platform) {
  semiAutoState.previewPlatform = platform;

  // 버튼 스타일 업데이트
  const blogspotBtn = document.getElementById('semiAutoPreviewBlogspotBtn');
  const wordpressBtn = document.getElementById('semiAutoPreviewWordpressBtn');

  if (platform === 'blogspot') {
    blogspotBtn.classList.add('active');
    wordpressBtn.classList.remove('active');
  } else {
    blogspotBtn.classList.remove('active');
    wordpressBtn.classList.add('active');
  }

  // 미리보기 스타일 업데이트
  updatePreviewStyle();

  console.log(`[SEMI-AUTO] 미리보기 플랫폼 변경: ${platform}`);
};

/**
 * 미리보기 스타일 업데이트
 */
function updatePreviewStyle() {
  const previewContainer = document.getElementById('semiAutoPreview');
  if (!previewContainer || !semiAutoState.generatedContent) return;

  // 플랫폼별 스타일 적용
  const isWordPress = semiAutoState.previewPlatform === 'wordpress';
  const platformClass = isWordPress ? 'wordpress-optimized' : 'blogspot-optimized';

  // 기존 클래스 제거
  previewContainer.classList.remove('blogspot-optimized', 'wordpress-optimized');
  // 새 클래스 추가
  previewContainer.classList.add(platformClass);

  // 통합 스킨 적용
  previewContainer.className = `unified-premium-skin ${platformClass}`;
  previewContainer.style.color = '#1e293b'; // 텍스트 색상 검은색으로 설정
  previewContainer.innerHTML = `
    <div class="article-container" style="color: #1e293b !important;">
      ${semiAutoState.generatedContent.html}
    </div>
  `;
}

/**
 * 반자동 콘텐츠 생성
 */
window.generateSemiAutoContent = async function () {
  const keywordInput = document.getElementById('semiAutoKeyword');
  const titleInput = document.getElementById('semiAutoTitle');
  const keyword = keywordInput.value.trim();
  const title = titleInput.value.trim();
  const sourceUrlInput = document.getElementById('semiAutoSourceUrl');
  const sourceUrl = sourceUrlInput ? sourceUrlInput.value.trim() : '';

  // 키워드 또는 제목이 있어야 함
  if (!keyword && !title && !sourceUrl) {
    alert('제목, 키워드 또는 URL 중 하나를 입력해주세요.');
    return;
  }

  // 🔒 콘텐츠 모드는 반드시 선택해야 함
  const contentModeEl = document.getElementById('semiAutoContentMode');
  if (!contentModeEl || !contentModeEl.value) {
    alert('콘텐츠 모드를 반드시 선택해주세요.');
    contentModeEl?.focus();
    return;
  }
  const contentMode = contentModeEl.value;

  // 말투/어투 설정 가져오기 (기본값 있음)
  const toneStyleEl = document.getElementById('semiAutoToneStyle');
  const toneStyle = toneStyleEl ? toneStyleEl.value : 'professional';

  // URL이 있으면 URL을 우선 사용
  const finalTopic = sourceUrl || title || keyword;
  semiAutoState.keyword = finalTopic;
  semiAutoState.isGenerating = true;
  semiAutoState.cancelRequested = false;

  const generateBtn = document.getElementById('semiAutoGenerateBtn');
  const cancelBtn = document.getElementById('semiAutoCancelBtn');
  const originalText = generateBtn.innerHTML;
  generateBtn.disabled = true;
  generateBtn.style.display = 'none';
  if (cancelBtn) {
    cancelBtn.style.display = 'inline-block';
  }
  generateBtn.innerHTML = '<span style="font-size: 20px;">⏳</span> 생성 중...';

  // 🔧 진행률 바 표시
  showSemiAutoProgress();
  updateSemiAutoProgress(5, '🔍 크롤링 데이터 수집 시작...', 'crawl');

  // 🔧 진행률 이벤트 리스너 등록
  let progressUnsubscribe = null;
  if (window.blogger && window.blogger.onProgress) {
    progressUnsubscribe = window.blogger.onProgress((data) => {
      const percent = data.p || 0;
      const label = data.label || '';

      // 진행률에 따라 단계 결정
      let step = 'crawl';
      if (percent >= 100) step = 'complete';
      else if (percent >= 70) step = 'content';
      else if (percent >= 40) step = 'h2';
      else if (percent >= 20) step = 'h1';

      updateSemiAutoProgress(percent, label, step);
    });
  }

  try {
    console.log(`[SEMI-AUTO] 🔥 완벽 끝판왕 모드로 생성!`);
    console.log(`[SEMI-AUTO] 키워드: ${finalTopic}`);
    console.log(`[SEMI-AUTO] 말투: ${toneStyle}`);

    // 🔒 콘텐츠 모드 최종 검증 (이중 체크)
    if (!contentMode || contentMode === '') {
      throw new Error('콘텐츠 모드가 설정되지 않았습니다. 반드시 콘텐츠 모드를 선택해주세요.');
    }

    // 🔥 수동 크롤링 URL 수집 (3개까지)
    const manualCrawlUrls = [];
    const manualUrl1 = document.getElementById('manualCrawlUrl1')?.value?.trim();
    const manualUrl2 = document.getElementById('manualCrawlUrl2')?.value?.trim();
    const manualUrl3 = document.getElementById('manualCrawlUrl3')?.value?.trim();
    if (manualUrl1) manualCrawlUrls.push(manualUrl1);
    if (manualUrl2) manualCrawlUrls.push(manualUrl2);
    if (manualUrl3) manualCrawlUrls.push(manualUrl3);

    // sourceUrl도 추가 (중복 제거)
    if (sourceUrl && !manualCrawlUrls.includes(sourceUrl)) {
      manualCrawlUrls.unshift(sourceUrl);
    }

    console.log(`[SEMI-AUTO] 📋 콘텐츠 모드: ${contentMode}`);
    console.log(`[SEMI-AUTO] 🔗 수동 크롤링 URL: ${manualCrawlUrls.length}개`);
    manualCrawlUrls.forEach((url, i) => console.log(`   ${i + 1}. ${url}`));

    // 🖼️ H2 이미지 설정 가져오기
    const h2ImageSettings = window.getH2ImageSections ? window.getH2ImageSections() : { source: 'nanobananapro', sections: [] };
    console.log('[SEMI-AUTO] 🖼️ H2 이미지 설정:', h2ImageSettings);

    const payload = {
      topic: finalTopic,
      keywords: keyword ? [keyword] : [],
      platform: semiAutoState.previewPlatform || 'wordpress',
      titleMode: title ? 'custom' : 'auto',
      titleValue: title || '',
      imageMode: h2ImageSettings.sections?.length > 0 ? 'h2' : 'none', // 🖼️ 이미지 모드 자동 설정
      thumbnailMode: 'auto',
      toneStyle: toneStyle,
      contentMode: contentMode, // 🔥 콘텐츠 모드 추가!
      sourceUrl: sourceUrl || '',
      manualCrawlUrls: manualCrawlUrls, // 🔥 수동 크롤링 URL 배열
      // 🖼️ H2 이미지 설정 추가
      h2ImageSource: h2ImageSettings.source || 'nanobananapro',
      h2ImageSections: h2ImageSettings.sections || [],
      h2Images: h2ImageSettings, // 전체 객체도 전달 (호환성)
      dryRun: true
    };

    console.log('[SEMI-AUTO] ✅ 완벽 끝판왕 Payload 준비 완료');

    const result = await window.blogger.runSemiAutoPost(payload);

    // 취소 요청 확인
    if (semiAutoState.cancelRequested) {
      console.log('[SEMI-AUTO] 사용자가 생성 취소 요청');
      return;
    }

    if (!result.ok) {
      throw new Error(result.error || '콘텐츠 생성 실패');
    }

    // 🔧 응답 구조 수정: result.data가 아니라 result 자체에 html이 있음
    const html = result.html || result.data?.html || result.content || '';
    const resultTitle = result.title || title || semiAutoState.keyword;

    if (!html) {
      throw new Error('생성된 콘텐츠가 없습니다.');
    }

    // ✅ 제목 필드가 비어있으면 AI가 생성한 제목을 자동으로 채우기
    if (!title && result.title && result.title !== '제목 없음') {
      const titleInput = document.getElementById('semiAutoTitle');
      if (titleInput) {
        titleInput.value = result.title;
        console.log(`[SEMI-AUTO] ✅ AI 생성 제목 자동 입력: ${result.title}`);

        // 제목 필드에 하이라이트 효과 (사용자에게 알림)
        titleInput.style.background = 'rgba(102, 126, 234, 0.1)';
        titleInput.style.borderColor = 'rgba(102, 126, 234, 0.6)';
        setTimeout(() => {
          titleInput.style.background = 'rgba(255, 255, 255, 0.9)';
          titleInput.style.borderColor = 'rgba(102, 126, 234, 0.3)';
        }, 2000);
      }
    }

    semiAutoState.generatedContent = {
      html: html,
      title: resultTitle,
      labels: result.labels || [],
      thumbnail: result.thumbnail || ''
    };

    // 소제목 추출
    extractSubtopics(html);

    // 🔥 반자동 모드: 이미지 자동 수집 비활성화
    // 사용자가 직접 이미지를 수집/생성 후 "완성 미리보기 생성" 버튼으로 조립
    console.log('[SEMI-AUTO] 📝 콘텐츠 생성 완료 - 이미지는 사용자가 직접 선택합니다');

    // 기본 미리보기 표시 (이미지 없이)
    updatePreview(html);

    // 🖼️ 완성 미리보기 생성 버튼 표시
    showFinalPreviewButton();

    // 버튼 활성화
    const applyBtn = document.getElementById('applySemiAutoBtn');
    if (applyBtn) {
      applyBtn.disabled = false;
    }

    // 🔥 발행 버튼은 완성 미리보기 생성 후 활성화
    const publishBtn = document.getElementById('startSemiAutoPublishBtn');
    if (publishBtn) {
      publishBtn.disabled = true;
      publishBtn.style.opacity = '0.5';
      publishBtn.title = '⚠️ 먼저 이미지를 선택하고 "완성 미리보기 생성" 버튼을 클릭하세요';
    }

    console.log('[SEMI-AUTO] ✅ 콘텐츠 생성 완료! 이미지를 선택 후 "완성 미리보기 생성" 버튼을 클릭하세요');

    // 🔧 진행률 바 완료 처리
    hideSemiAutoProgress();

    // 진행률 이벤트 리스너 해제
    if (progressUnsubscribe) {
      progressUnsubscribe();
    }

  } catch (error) {
    if (semiAutoState.cancelRequested) {
      console.log('[SEMI-AUTO] 사용자가 생성 취소');
      return;
    }
    console.error('[SEMI-AUTO] 콘텐츠 생성 오류:', error);
    alert(`콘텐츠 생성 실패: ${error.message}`);

    // 🔧 오류 시 진행률 바 숨기기
    updateSemiAutoProgress(0, '❌ 콘텐츠 생성 실패: ' + error.message);
    setTimeout(() => {
      hideSemiAutoProgress();
    }, 2000);

    // 진행률 이벤트 리스너 해제
    if (progressUnsubscribe) {
      progressUnsubscribe();
    }
  } finally {
    semiAutoState.isGenerating = false;
    generateBtn.disabled = false;
    generateBtn.style.display = 'inline-block';
    if (cancelBtn) {
      cancelBtn.style.display = 'none';
    }
    generateBtn.innerHTML = originalText;
  }
};

/**
 * 반자동 예약 설정 토글
 */
window.toggleSemiAutoScheduleSettings = function () {
  const postingMode = document.querySelector('input[name="semiAutoPostingMode"]:checked');
  const scheduleSettings = document.getElementById('semiAutoScheduleSettings');

  if (postingMode && postingMode.value === 'schedule' && scheduleSettings) {
    scheduleSettings.style.display = 'block';
  } else if (scheduleSettings) {
    scheduleSettings.style.display = 'none';
  }
};

/**
 * 반자동 CTA 설정 토글
 */
window.toggleSemiAutoCtaSettings = function () {
  const ctaMode = document.querySelector('input[name="semiAutoCtaMode"]:checked');
  const manualCtaSection = document.getElementById('semiAutoManualCtaSection');

  if (ctaMode && ctaMode.value === 'manual' && manualCtaSection) {
    manualCtaSection.style.display = 'block';
  } else if (manualCtaSection) {
    manualCtaSection.style.display = 'none';
  }
};

/**
 * 반자동 수동 CTA 모달 열기
 */
window.openSemiAutoManualCtaModal = function () {
  // 기존 수동 CTA 모달 재사용
  if (window.openManualCtaModal) {
    window.openManualCtaModal();
    // 모달이 닫힐 때 반자동 CTA 상태 업데이트
    const originalClose = window.closeManualCtaModal;
    if (originalClose) {
      window.closeManualCtaModal = function () {
        originalClose();
        updateSemiAutoManualCtaStatus();
      };
    }
  } else {
    alert('수동 CTA 설정 기능을 사용할 수 없습니다.');
  }
};

/**
 * 반자동 수동 CTA 상태 업데이트
 */
function updateSemiAutoManualCtaStatus() {
  if (window.getManualCtas) {
    const manualCtas = window.getManualCtas();
    const count = manualCtas ? manualCtas.filter(cta => cta && cta.url && cta.url.trim()).length : 0;

    const statusEl = document.getElementById('semiAutoManualCtaStatus');
    const countEl = document.getElementById('semiAutoManualCtaCount');

    if (statusEl && countEl) {
      if (count > 0) {
        countEl.textContent = count;
        statusEl.style.display = 'block';
      } else {
        statusEl.style.display = 'none';
      }
    }
  }
}

/**
 * 반자동 콘텐츠 생성 중지
 */
window.cancelSemiAutoGeneration = function () {
  if (semiAutoState.isGenerating) {
    semiAutoState.cancelRequested = true;
    console.log('[SEMI-AUTO] 콘텐츠 생성 중지 요청');

    // 진행률 모달 숨기기
    if (window.hideProgressModal) {
      window.hideProgressModal();
    }

    // 버튼 상태 복원
    const generateBtn = document.getElementById('semiAutoGenerateBtn');
    const cancelBtn = document.getElementById('semiAutoCancelBtn');
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.style.display = 'inline-block';
      generateBtn.innerHTML = '🚀 반자동 미리보기 글 생성하기';
    }
    if (cancelBtn) {
      cancelBtn.style.display = 'none';
    }

    semiAutoState.isGenerating = false;
    alert('콘텐츠 생성이 중지되었습니다.');
  }
};

/**
 * 소제목 추출
 */
function extractSubtopics(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const h2Elements = doc.querySelectorAll('h2');

  semiAutoState.subtopics = [];
  semiAutoState.images = [];

  // 소제목 분석 영역
  const subtopicsContainer = document.getElementById('semiAutoSubheadings');
  // 이미지 생성 영역
  const imageArea = document.getElementById('semiAutoImageArea');
  const imageListContainer = document.getElementById('semiAutoImageList');

  if (!subtopicsContainer || !imageListContainer) {
    console.error('[SEMI-AUTO] 필수 컨테이너를 찾을 수 없습니다.');
    return;
  }

  // 컨테이너 초기화
  subtopicsContainer.innerHTML = '';
  imageListContainer.innerHTML = '';

  if (h2Elements.length === 0) {
    subtopicsContainer.innerHTML = '<p style="color: #64748b; text-align: center;">소제목을 찾을 수 없습니다.</p>';
    return;
  }

  // 소제목 분석 결과 HTML 생성
  let subtopicsHtml = '<div style="display: flex; flex-direction: column; gap: 16px;">';
  let imageFieldsHtml = '';

  // 중복 제거를 위한 Set 사용
  const seenSubtopics = new Set();
  let uniqueIndex = 0;

  h2Elements.forEach((h2, index) => {
    const subtopic = h2.textContent.trim();
    if (!subtopic) return;

    // 중복 체크: 이미 본 소제목이면 건너뛰기
    if (seenSubtopics.has(subtopic)) {
      console.log(`[SEMI-AUTO] 중복 소제목 건너뛰기: "${subtopic}"`);
      return;
    }

    // 중복이 아니면 Set에 추가하고 배열에 추가
    seenSubtopics.add(subtopic);
    semiAutoState.subtopics.push(subtopic);

    // 소제목 분석 영역에 표시
    subtopicsHtml += `
      <div style="background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%); border: 2px solid rgba(102, 126, 234, 0.3); border-radius: 12px; padding: 16px; transition: all 0.3s ease;"
           onmouseover="this.style.borderColor='rgba(102, 126, 234, 0.5)'; this.style.transform='translateX(4px)';"
           onmouseout="this.style.borderColor='rgba(102, 126, 234, 0.3)'; this.style.transform='translateX(0)';">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 16px; flex-shrink: 0;">
            ${uniqueIndex + 1}
          </div>
          <span style="font-size: 15px; font-weight: 600; color: #1e293b; flex: 1; line-height: 1.5;">${subtopic}</span>
        </div>
      </div>
    `;

    // 이미지 생성 필드 생성
    imageFieldsHtml += `
      <div style="background: linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(248, 250, 252, 0.9) 100%); backdrop-filter: blur(10px); border: 2px solid rgba(102, 126, 234, 0.3); border-radius: 16px; padding: 24px; transition: all 0.3s ease;"
           onmouseover="this.style.borderColor='rgba(102, 126, 234, 0.5)'; this.style.boxShadow='0 8px 25px rgba(102, 126, 234, 0.15)';"
           onmouseout="this.style.borderColor='rgba(102, 126, 234, 0.3)'; this.style.boxShadow='none';">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
          <h4 style="font-size: 18px; font-weight: 700; color: #1e293b; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
            🖼️ 이미지 ${uniqueIndex + 1}: ${subtopic.length > 30 ? subtopic.substring(0, 30) + '...' : subtopic}
          </h4>
          <button onclick="regenerateSemiAutoImage(${uniqueIndex})" id="regenerate-${uniqueIndex}" 
                  style="padding: 8px 16px; background: rgba(102, 126, 234, 0.1); border: 2px solid rgba(102, 126, 234, 0.3); border-radius: 8px; color: #667eea; font-size: 12px; font-weight: 600; cursor: pointer; display: none; transition: all 0.3s ease;"
                  onmouseover="this.style.background='rgba(102, 126, 234, 0.2)'; this.style.borderColor='rgba(102, 126, 234, 0.5)';"
                  onmouseout="this.style.background='rgba(102, 126, 234, 0.1)'; this.style.borderColor='rgba(102, 126, 234, 0.3)';">
            🔄 재생성
          </button>
        </div>
        
        <div style="margin-bottom: 16px;">
          <div style="font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 8px;">소제목</div>
          <div style="font-size: 14px; color: #1e293b; background: rgba(102, 126, 234, 0.05); padding: 12px; border-radius: 8px; border-left: 4px solid #667eea; line-height: 1.6;">
            ${subtopic}
          </div>
        </div>
        
        <div style="margin-bottom: 16px;">
          <div style="font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 8px;">영어 프롬프트</div>
          <div id="prompt-${uniqueIndex}" style="font-size: 13px; color: #64748b; background: rgba(102, 126, 234, 0.05); padding: 12px; border-radius: 8px; font-family: 'Courier New', monospace; line-height: 1.6; min-height: 40px; display: flex; align-items: center;">
            <span style="color: #94a3b8;">생성 중...</span>
          </div>
        </div>
        
        <div style="margin-bottom: 16px;">
          <div style="font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 8px;">이미지 미리보기</div>
          <div id="preview-${uniqueIndex}" style="min-height: 200px; background: linear-gradient(135deg, rgba(248, 250, 252, 0.8) 0%, rgba(241, 245, 249, 0.9) 100%); border: 2px dashed rgba(102, 126, 234, 0.3); border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            <span style="color: #94a3b8; font-size: 14px;">이미지가 생성되면 여기에 표시됩니다</span>
          </div>
        </div>
        
        <button onclick="generateSemiAutoImage(${uniqueIndex})" id="generate-${uniqueIndex}"
                style="width: 100%; padding: 14px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 12px; color: white; font-size: 15px; font-weight: 700; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);"
                onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 12px 35px rgba(102, 126, 234, 0.5)';"
                onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 8px 25px rgba(102, 126, 234, 0.4)';">
          <span style="font-size: 18px;">🎨</span> 이미지 생성하기
        </button>
      </div>
    `;

    // 이미지 상태 초기화 (uniqueIndex 사용)
    semiAutoState.images[uniqueIndex] = { prompt: '', url: null };

    // 영어 프롬프트 생성 (uniqueIndex 사용)
    generateEnglishPrompt(subtopic, uniqueIndex);

    // 다음 고유 인덱스로 증가
    uniqueIndex++;
  });

  subtopicsHtml += '</div>';

  // 소제목 분석 영역 업데이트
  subtopicsContainer.innerHTML = subtopicsHtml;

  // 이미지 생성 영역 업데이트 및 표시
  imageListContainer.innerHTML = imageFieldsHtml;
  if (imageArea) {
    imageArea.style.display = 'block';
  }

  console.log(`[SEMI-AUTO] 소제목 ${semiAutoState.subtopics.length}개 추출 완료`);
}

/**
 * 영어 프롬프트 생성 (AI 번역 + 최적화)
 */
async function generateEnglishPrompt(subtopic, index) {
  try {
    const promptDiv = document.getElementById(`prompt-${index}`);
    if (!promptDiv) {
      console.error(`[SEMI-AUTO] 프롬프트 DIV를 찾을 수 없음 (${index})`);
      return;
    }

    // 로딩 상태
    promptDiv.innerHTML = `<span style="color: #667eea; font-weight: 600;">⏳ 영어 프롬프트 생성 중...</span>`;

    // 한국어 → 영어 키워드 매핑 (확장)
    const korToEng = {
      '개인정보': 'personal data privacy protection',
      '유출': 'data breach security incident',
      '신청': 'application registration process',
      '방법': 'how-to step-by-step guide',
      '가이드': 'comprehensive tutorial guide',
      '정리': 'organized summary compilation',
      '확인': 'verification and check',
      '대출': 'loan and financing',
      '보험': 'insurance coverage',
      '투자': 'investment strategy',
      '부동산': 'real estate property',
      '건강': 'health and wellness',
      '다이어트': 'diet and fitness',
      '요리': 'cooking and recipe',
      '여행': 'travel and tourism',
      '쇼핑': 'shopping and deals',
      '리뷰': 'product review analysis',
      '비교': 'comparison and analysis',
      '월드컵': 'FIFA World Cup soccer',
      '축구': 'football soccer match',
      '조추첨': 'group draw lottery',
      '경기': 'sports game match',
      '일정': 'schedule timeline',
      '결과': 'result outcome',
      '뉴스': 'news update',
      '정보': 'information guide',
      '가격': 'price cost',
      '후기': 'user review feedback',
      '추천': 'recommendation best picks',
      '팁': 'tips and tricks'
    };

    // 키워드 추출 및 변환 (여러 키워드 조합)
    let englishConcepts = [];
    for (const [kor, eng] of Object.entries(korToEng)) {
      if (subtopic.includes(kor)) {
        englishConcepts.push(eng);
      }
    }

    // 영어 개념이 없으면 기본 변환
    let englishConcept = englishConcepts.length > 0
      ? englishConcepts.slice(0, 2).join(' and ')
      : subtopic.replace(/[^\w\s가-힣]/g, ' ').trim();

    // 소제목별로 다른 스타일 적용 (중복 방지)
    const imageStyles = [
      'professional infographic with icons and diagrams',
      'modern flat design illustration with vibrant colors',
      'clean minimalist concept art with geometric shapes',
      'isometric 3D rendered scene with detailed elements',
      'corporate presentation visual with charts',
      'abstract artistic representation with gradients',
      'photorealistic scene with natural lighting',
      'hand-drawn sketch style with creative elements'
    ];
    const style = imageStyles[index % imageStyles.length];

    // 고유한 시드값으로 다양성 확보
    const uniqueElements = [
      'unique perspective',
      'creative composition',
      'distinctive angle',
      'original layout',
      'innovative design'
    ];
    const unique = uniqueElements[index % uniqueElements.length];

    const prompt = `A ${style} about "${englishConcept}". ${unique}. High quality, detailed, visually appealing for blog content. No text overlay, clean composition, professional studio lighting. 4K resolution, sharp focus.`;

    // DOM 업데이트 - 더 눈에 띄게
    promptDiv.innerHTML = `
      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 12px; border-radius: 8px; border-left: 4px solid #22c55e;">
        <span style="color: #166534; word-break: break-word; font-size: 12px; line-height: 1.6;">${prompt}</span>
      </div>
    `;

    // 상태 저장
    if (semiAutoState.images[index]) {
      semiAutoState.images[index].prompt = prompt;
    } else {
      semiAutoState.images[index] = { prompt, url: null };
    }

    console.log(`[SEMI-AUTO] ✅ 프롬프트 생성 완료 (${index}):`, prompt.substring(0, 80) + '...');

  } catch (error) {
    console.error(`[SEMI-AUTO] 프롬프트 생성 오류 (${index}):`, error);
    const promptDiv = document.getElementById(`prompt-${index}`);
    if (promptDiv) {
      promptDiv.innerHTML = `
        <div style="background: #fef2f2; padding: 12px; border-radius: 8px; border-left: 4px solid #ef4444;">
          <span style="color: #dc2626;">❌ 프롬프트 생성 실패: ${error.message}</span>
        </div>
      `;
    }
  }
}

/**
 * 이미지 생성
 */
window.generateSemiAutoImage = async function (index) {
  const generateBtn = document.getElementById(`generate-${index}`);
  const previewDiv = document.getElementById(`preview-${index}`);
  const regenerateBtn = document.getElementById(`regenerate-${index}`);

  const originalText = generateBtn.innerHTML;
  generateBtn.disabled = true;
  generateBtn.innerHTML = '<span style="font-size: 16px;">⏳</span> 생성 중...';

  previewDiv.innerHTML = '<span style="color: rgba(255, 255, 255, 0.7); font-size: 14px;">🎨 이미지 생성 중...</span>';

  try {
    const imageData = semiAutoState.images[index];

    const result = await window.blogger.generateAIImage({
      prompt: imageData.prompt || semiAutoState.subtopics[index] || semiAutoState.keyword,
      type: semiAutoState.imageSource,
      size: '1024x1024'
    });

    if (!result.success) {
      throw new Error(result.error || '이미지 생성 실패');
    }

    imageData.url = result.imageUrl || result.url;

    // 이미지 미리보기 업데이트
    previewDiv.innerHTML = `
      <img src="${imageData.url}" alt="${semiAutoState.subtopics[index]}" 
           style="width: 100%; height: auto; border-radius: 12px; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15); object-fit: cover; max-height: 400px;">
    `;

    // 재생성 버튼 표시
    if (regenerateBtn) {
      regenerateBtn.style.display = 'block';
    }

    console.log(`[SEMI-AUTO] 이미지 ${index + 1} 생성 완료`);

  } catch (error) {
    console.error(`[SEMI-AUTO] 이미지 생성 오류 (${index}):`, error);
    previewDiv.innerHTML = `<span style="color: #ef4444; font-size: 13px;">❌ 생성 실패: ${error.message}</span>`;
  } finally {
    generateBtn.disabled = false;
    generateBtn.innerHTML = originalText;
  }
};

/**
 * 이미지 재생성
 */
window.regenerateSemiAutoImage = async function (index) {
  await generateSemiAutoImage(index);
};

/**
 * 🔥 완성 미리보기 생성 버튼 표시
 */
function showFinalPreviewButton() {
  const previewContainer = document.getElementById('semiAutoPreview');
  if (!previewContainer) return;

  // 기존 버튼 제거
  const existingBtn = document.getElementById('finalPreviewBtn');
  if (existingBtn) existingBtn.remove();

  // 버튼 컨테이너 생성
  const btnContainer = document.createElement('div');
  btnContainer.id = 'finalPreviewBtnContainer';
  btnContainer.style.cssText = `
    position: sticky;
    top: 0;
    z-index: 100;
    background: linear-gradient(180deg, rgba(30, 41, 59, 0.98) 0%, rgba(30, 41, 59, 0.95) 100%);
    padding: 16px;
    margin: -32px -32px 16px -32px;
    border-radius: 12px 12px 0 0;
    text-align: center;
    backdrop-filter: blur(10px);
  `;

  btnContainer.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
      <div style="font-size: 14px; color: #fbbf24;">
        💡 이미지를 선택/생성한 후 아래 버튼을 클릭하세요
      </div>
      <button id="finalPreviewBtn" onclick="generateFinalPreview()"
              style="padding: 16px 40px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: none; border-radius: 14px; color: white; font-size: 17px; font-weight: 800; cursor: pointer; box-shadow: 0 8px 30px rgba(16, 185, 129, 0.4); transition: all 0.3s ease; display: flex; align-items: center; gap: 10px;"
              onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 12px 40px rgba(16, 185, 129, 0.5)';"
              onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 8px 30px rgba(16, 185, 129, 0.4)';">
        <span style="font-size: 22px;">✨</span>
        완성 미리보기 생성
      </button>
      <div style="font-size: 12px; color: #94a3b8;">
        이미지가 포함된 최종 미리보기를 생성합니다
      </div>
    </div>
  `;

  // 미리보기 컨테이너 맨 앞에 삽입
  previewContainer.insertBefore(btnContainer, previewContainer.firstChild);
}

/**
 * 🔥 완성 미리보기 생성 (이미지 포함)
 */
window.generateFinalPreview = async function () {
  console.log('[SEMI-AUTO] 🎨 완성 미리보기 생성 시작...');

  const btn = document.getElementById('finalPreviewBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span style="font-size: 22px;">⏳</span> 미리보기 조립 중...';
  }

  try {
    // 생성된 HTML 가져오기
    let html = semiAutoState.generatedContent?.html || '';
    if (!html) {
      throw new Error('생성된 콘텐츠가 없습니다.');
    }

    // HTML 파싱
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const h2Elements = doc.querySelectorAll('h2');

    // 각 H2 섹션에 이미지 삽입
    h2Elements.forEach((h2, index) => {
      const imageData = semiAutoState.images[index];
      if (imageData && imageData.url) {
        const source = imageData.source || 'AI 생성';

        // figure 요소 생성
        const figure = doc.createElement('figure');
        figure.className = 'section-image';
        figure.style.cssText = 'margin: 20px 0;';

        const img = doc.createElement('img');
        img.src = imageData.url;
        img.alt = `${semiAutoState.subtopics[index] || h2.textContent} - ${source}`;
        img.title = semiAutoState.subtopics[index] || h2.textContent;
        img.style.cssText = 'width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.12);';

        const caption = doc.createElement('figcaption');
        caption.style.cssText = 'text-align: center; font-size: 12px; color: #64748b; margin-top: 8px; font-style: italic;';
        caption.textContent = `📷 이미지 출처: ${source}`;

        figure.appendChild(img);
        figure.appendChild(caption);

        // H2 다음에 삽입
        h2.parentNode.insertBefore(figure, h2.nextSibling);

        console.log(`[SEMI-AUTO] ✅ 섹션 ${index + 1} 이미지 삽입 완료`);
      }
    });

    // 최종 HTML 추출
    const finalHtml = doc.body.innerHTML;

    // 상태 업데이트
    semiAutoState.generatedContent.html = finalHtml;
    semiAutoState.finalPreviewReady = true;

    // 미리보기 업데이트
    updatePreview(finalHtml);

    // 버튼 상태 변경
    if (btn) {
      btn.innerHTML = '<span style="font-size: 22px;">✅</span> 미리보기 완성!';
      btn.style.background = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
    }

    // 🔥 발행 버튼 활성화
    const publishBtn = document.getElementById('startSemiAutoPublishBtn');
    if (publishBtn) {
      publishBtn.disabled = false;
      publishBtn.style.opacity = '1';
      publishBtn.title = '클릭하여 발행';
      publishBtn.style.animation = 'pulse 2s infinite';
    }

    console.log('[SEMI-AUTO] ✅ 완성 미리보기 생성 완료!');

    // 버튼 컨테이너 숨기기 (잠시 후)
    setTimeout(() => {
      const btnContainer = document.getElementById('finalPreviewBtnContainer');
      if (btnContainer) {
        btnContainer.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; gap: 12px; padding: 12px;">
            <span style="font-size: 24px;">✅</span>
            <div>
              <div style="font-size: 16px; font-weight: 700; color: #10b981;">미리보기 완성!</div>
              <div style="font-size: 13px; color: #94a3b8;">이제 발행 버튼을 클릭하세요</div>
            </div>
          </div>
        `;
      }
    }, 1500);

  } catch (error) {
    console.error('[SEMI-AUTO] 완성 미리보기 생성 오류:', error);
    alert(`미리보기 생성 실패: ${error.message}`);

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span style="font-size: 22px;">✨</span> 완성 미리보기 생성';
    }
  }
};

/**
 * 미리보기 업데이트
 */
function updatePreview(html) {
  const previewContainer = document.getElementById('semiAutoPreview');
  if (!previewContainer) return;

  // ✅ 배경만 흰색, 나머지 제거
  previewContainer.className = '';
  previewContainer.style.cssText = `
    min-height: 400px;
    max-height: 800px;
    overflow-y: auto;
    background: #f8fafc !important;
    padding: 0 !important;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
  `;

  let decodedHtml = html;
  if (html.includes('&lt;') || html.includes('&gt;') || html.includes('&amp;')) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    decodedHtml = tempDiv.innerHTML;
  }

  // ✅ CSS 그대로 유지
  const cleanedHtml = decodedHtml;

  // 🖼️ 썸네일 HTML 생성
  let thumbnailHtml = '';
  const thumbnailUrl = semiAutoState.generatedContent?.thumbnail || semiAutoState.thumbnailDataUrl;
  if (thumbnailUrl) {
    thumbnailHtml = `
      <div style="width: 100%; margin-bottom: 24px; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
        <img src="${thumbnailUrl}" alt="썸네일" style="width: 100%; height: auto; display: block;">
             </div>
    `;
  }

  // ✅ 미리보기용 CSS 추가 (H2/H3 흰색 텍스트)
  const previewStyles = `
    <style>
      /* 미리보기 프리미엄 스킨 */
      .preview-wrapper { background: #f8fafc; color: #1e293b; padding: 32px; }
      .preview-wrapper h1, .preview-wrapper .premium-h1 { font-size: 26px; font-weight: 800; color: #0f172a; margin: 0 0 24px 0; }
      /* 🔥 H2: 진한 그라디언트 배경 + 흰색 텍스트 */
      .preview-wrapper h2, .preview-wrapper .premium-h2 { 
        font-size: 19px; font-weight: 700; 
        color: #ffffff !important; 
        background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); 
        border-left: 5px solid #fbbf24; 
        border-radius: 0 12px 12px 0; 
        padding: 14px 18px; 
        margin: 32px 0 14px 0; 
        text-shadow: 0 1px 2px rgba(0,0,0,0.2);
        box-shadow: 0 4px 12px rgba(59,130,246,0.3);
      }
      /* 🔥 H3: 진한 배경 + 흰색 텍스트 */
      .preview-wrapper h3, .preview-wrapper .premium-h3 { 
        font-size: 16px; font-weight: 600; 
        color: #ffffff !important; 
        background: linear-gradient(135deg, #059669 0%, #10b981 100%); 
        border-left: 4px solid #fcd34d; 
        border-radius: 0 10px 10px 0; 
        padding: 12px 16px; 
        margin: 20px 0 10px 0; 
        text-shadow: 0 1px 2px rgba(0,0,0,0.2);
        box-shadow: 0 3px 10px rgba(16,185,129,0.25);
      }
      .preview-wrapper p { font-size: 15px; line-height: 1.8; color: #374151; margin: 0 0 14px 0; }
      .preview-wrapper .premium-content { background: #fafafa; border-radius: 10px; border: 1px solid #f1f5f9; padding: 16px; margin-bottom: 16px; }
      .preview-wrapper ol, .preview-wrapper .premium-action-list { list-style: none; padding: 0; margin: 14px 0; counter-reset: action-counter; }
      .preview-wrapper ol li, .preview-wrapper .premium-action-list li { display: flex; align-items: flex-start; padding: 12px 14px; margin: 8px 0; background: linear-gradient(135deg, #eff6ff, #dbeafe); border-radius: 8px; border-left: 3px solid #3b82f6; font-size: 14px; line-height: 1.6; color: #1e40af; counter-increment: action-counter; }
      .preview-wrapper ol li::before, .preview-wrapper .premium-action-list li::before { content: counter(action-counter); display: flex; align-items: center; justify-content: center; min-width: 22px; height: 22px; background: #3b82f6; color: white; border-radius: 50%; font-weight: 700; font-size: 12px; margin-right: 10px; flex-shrink: 0; }
      .preview-wrapper strong, .preview-wrapper b { color: #0f172a; font-weight: 600; background: #fef3c7; padding: 1px 4px; border-radius: 3px; }
      .preview-wrapper table { border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 14px; }
      .preview-wrapper th { background: #f1f5f9; font-weight: 600; padding: 10px; border: 1px solid #e2e8f0; }
      .preview-wrapper td { padding: 10px; border: 1px solid #e2e8f0; }
    </style>
  `;

  // ✅ 래퍼로 감싸기
  previewContainer.innerHTML = `
    ${previewStyles}
    <div class="preview-wrapper">
      ${thumbnailHtml}
      ${cleanedHtml}
    </div>
  `;

  console.log('[SEMI-AUTO] ✅ 미리보기 업데이트 완료' + (thumbnailUrl ? ' (썸네일 포함)' : ''));
}

/**
 * 이미지 적용
 */
window.applySemiAutoImages = function () {
  if (!semiAutoState.generatedContent) {
    alert('먼저 콘텐츠를 생성해주세요.');
    return;
  }

  // 생성된 이미지를 HTML에 삽입
  let html = semiAutoState.generatedContent.html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const h2Elements = doc.querySelectorAll('h2');

  h2Elements.forEach((h2, index) => {
    const imageData = semiAutoState.images[index];
    if (imageData && imageData.url) {
      // H2 다음에 이미지 삽입
      const img = doc.createElement('img');
      img.src = imageData.url;
      img.alt = semiAutoState.subtopics[index];
      img.style.cssText = 'max-width: 100%; height: auto; border-radius: 12px; margin: 32px 0; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);';

      h2.parentNode.insertBefore(img, h2.nextSibling);
    }
  });

  // 업데이트된 HTML 저장
  semiAutoState.generatedContent.html = doc.body.innerHTML;
  semiAutoState.appliedImages = true;

  // 미리보기 업데이트
  updatePreview(semiAutoState.generatedContent.html);

  // 발행 버튼 활성화
  document.getElementById('semiAutoPublishBtn').disabled = false;

  alert('✅ 이미지가 미리보기에 적용되었습니다!');
  console.log('[SEMI-AUTO] 이미지 적용 완료');
};

/**
 * 반자동 발행
 */
window.publishSemiAutoContent = async function () {
  if (!semiAutoState.generatedContent) {
    alert('먼저 콘텐츠를 생성해주세요.');
    return;
  }

  // 이미지 적용 여부 확인 (선택사항)
  if (!semiAutoState.appliedImages) {
    const confirmApply = confirm('이미지가 적용되지 않았습니다. 이미지 없이 발행하시겠습니까?');
    if (!confirmApply) {
      return;
    }
  }

  const publishBtn = document.getElementById('startSemiAutoPublishBtn') || document.getElementById('semiAutoPublishBtn');
  if (!publishBtn) {
    console.error('[SEMI-AUTO] 발행 버튼을 찾을 수 없습니다.');
    return;
  }

  const originalText = publishBtn.innerHTML;
  publishBtn.disabled = true;
  publishBtn.innerHTML = '<span style="font-size: 20px;">⏳</span> 발행 중...';

  try {
    console.log('[SEMI-AUTO] 발행 시작');

    // 발행 설정 가져오기
    const postingModeEl = document.querySelector('input[name="semiAutoPostingMode"]:checked');
    const postingMode = postingModeEl ? postingModeEl.value : 'immediate';
    const scheduleDateTimeEl = document.getElementById('semiAutoScheduleDateTime');
    const scheduleDateTime = scheduleDateTimeEl ? scheduleDateTimeEl.value : null;
    const ctaModeEl = document.querySelector('input[name="semiAutoCtaMode"]:checked');
    const ctaMode = ctaModeEl ? ctaModeEl.value : 'auto';

    // 실제 플랫폼 설정 가져오기
    const settings = await window.blogger.getSettings();
    const platform = settings.platform || 'blogspot';

    // 발행 타입 결정
    // immediate, now, live, publish 모두 즉시 발행으로 처리
    let finalPostingMode = postingMode;
    if (postingMode === 'immediate' || postingMode === 'now' || postingMode === 'live') {
      finalPostingMode = 'publish';
    }

    let publishType = 'publish';
    if (finalPostingMode === 'draft') {
      publishType = 'draft';
    } else if (finalPostingMode === 'schedule' && scheduleDateTime) {
      publishType = 'schedule';
    } else {
      // immediate, now, live, publish 모두 publish로
      publishType = 'publish';
    }

    console.log(`[SEMI-AUTO] 발행 모드 변환: "${postingMode}" → "${finalPostingMode}" → publishType: "${publishType}"`);

    // CTA 설정 가져오기
    let manualCtas = null;
    if (ctaMode === 'manual' && window.getManualCtas) {
      manualCtas = window.getManualCtas();
    }

    // 백엔드에 발행 요청
    // 미리보기와 동일한 HTML 사용 (이미 CSS 포함된 완전한 HTML)
    const publishPayload = {
      ...semiAutoState.generatedContent,
      platform: platform,
      html: semiAutoState.generatedContent.html, // 실제 발행될 HTML (CSS 포함)
      publishType: publishType,
      postingMode: finalPostingMode, // 변환된 postingMode 사용
      manualCtas: manualCtas // 수동 CTA 추가
    };

    // 예약 발행인 경우 날짜/시간 추가
    if (publishType === 'schedule' && scheduleDateTime) {
      publishPayload.scheduleDate = scheduleDateTime;
    }

    // 수동 CTA가 있는 경우 추가
    if (manualCtas && manualCtas.length > 0) {
      publishPayload.manualCtas = manualCtas;
    }

    console.log('[SEMI-AUTO] 발행 HTML 확인:', publishPayload.html.substring(0, 200) + '...');
    console.log('[SEMI-AUTO] 미리보기와 동일한 HTML 사용 확인');

    const result = await window.blogger.publishContent(publishPayload);

    if (!result.ok) {
      throw new Error(result.error || '발행 실패');
    }

    alert('✅ 발행이 완료되었습니다!');
    console.log('[SEMI-AUTO] 발행 완료:', result.url);

    // 상태 초기화
    resetSemiAutoState();

  } catch (error) {
    console.error('[SEMI-AUTO] 발행 오류:', error);
    alert(`발행 실패: ${error.message}`);
  } finally {
    publishBtn.disabled = false;
    publishBtn.innerHTML = originalText;
  }
};

/**
 * 상태 초기화
 */
function resetSemiAutoState() {
  semiAutoState = {
    keyword: '',
    imageSource: 'nanobananapro',
    previewPlatform: 'blogspot',
    generatedContent: null,
    subtopics: [],
    images: {},
    appliedImages: false
  };

  // UI 초기화
  document.getElementById('semiAutoKeyword').value = '';
  document.getElementById('semiAutoSubtopics').innerHTML = `
    <div style="text-align: center; padding: 40px 20px; color: rgba(255, 255, 255, 0.7);">
      <p style="font-size: 16px; margin: 0;">반자동 발행하기 버튼을 클릭하면<br>자동으로 소제목이 분석됩니다.</p>
    </div>
  `;
  document.getElementById('semiAutoImageGeneration').innerHTML = `
    <div style="text-align: center; padding: 40px 20px; color: rgba(255, 255, 255, 0.7);">
      <p style="font-size: 16px; margin: 0;">소제목 분석 후<br>이미지 생성 영역이 표시됩니다.</p>
    </div>
  `;
  document.getElementById('semiAutoPreview').innerHTML = `
    <div style="padding: 60px 40px; text-align: center; color: #64748b;">
      <p style="font-size: 18px; margin: 0;">반자동 발행하기 버튼을 클릭하면<br>미리보기가 표시됩니다.</p>
    </div>
  `;

  document.getElementById('semiAutoApplyBtn').disabled = true;
  document.getElementById('semiAutoPublishBtn').disabled = true;
}

console.log('✅ [SEMI-AUTO] 반자동 이미지 관리 모듈 로드 완료');

// ============================================
// 🖼️ 이미지 모달 - 크게보기 / 로컬이미지 변경 / AI 이미지 생성
// ============================================

/**
 * 이미지 클릭 시 모달 표시
 */
window.showImageModal = function (imageUrl, index, source = 'unknown') {
  // 기존 모달 제거
  const existingModal = document.getElementById('imageViewerModal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'imageViewerModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.95);
    backdrop-filter: blur(20px);
    z-index: 100000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.3s ease;
  `;

  modal.innerHTML = `
    <style>
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    </style>
    
    <!-- 닫기 버튼 -->
    <button onclick="closeImageModal()" style="position: absolute; top: 20px; right: 20px; width: 50px; height: 50px; background: rgba(255,255,255,0.1); border: none; border-radius: 50%; color: white; font-size: 24px; cursor: pointer; z-index: 10;">✕</button>
    
    <!-- 이미지 영역 -->
    <div style="max-width: 90%; max-height: 70%; animation: scaleIn 0.3s ease;">
      <img id="modalImage" src="${imageUrl}" alt="미리보기" style="max-width: 100%; max-height: 70vh; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
    </div>
    
    <!-- 출처 정보 -->
    <div style="margin-top: 16px; padding: 8px 16px; background: rgba(255,255,255,0.1); border-radius: 20px; color: white; font-size: 13px;">
      📷 출처: <span id="modalImageSource">${source}</span>
    </div>
    
    <!-- 버튼 영역 -->
    <div style="display: flex; gap: 12px; margin-top: 24px; flex-wrap: wrap; justify-content: center;">
      <!-- 로컬 이미지로 변경 -->
      <button onclick="selectLocalImageForIndex(${index})" style="padding: 14px 24px; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); border: none; border-radius: 12px; color: white; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: transform 0.2s;">
        📁 로컬 이미지로 변경
      </button>
      
      <!-- AI 이미지로 생성 -->
      <button onclick="generateAIImageForIndex(${index})" style="padding: 14px 24px; background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); border: none; border-radius: 12px; color: white; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: transform 0.2s;">
        🤖 AI 이미지로 생성
      </button>
      
      <!-- 다른 이미지 수집 -->
      <button onclick="collectNewImageForIndex(${index})" style="padding: 14px 24px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border: none; border-radius: 12px; color: white; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: transform 0.2s;">
        🔄 다른 이미지 수집
      </button>
    </div>
    
    <!-- 숨겨진 파일 입력 -->
    <input type="file" id="localImageInput_${index}" accept="image/*" style="display: none;" onchange="handleLocalImageSelect(event, ${index})">
  `;

  document.body.appendChild(modal);

  // ESC 키로 닫기
  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      closeImageModal();
      document.removeEventListener('keydown', handleKeydown);
    }
  };
  document.addEventListener('keydown', handleKeydown);

  // 배경 클릭으로 닫기
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeImageModal();
  });
};

/**
 * 이미지 모달 닫기
 */
window.closeImageModal = function () {
  const modal = document.getElementById('imageViewerModal');
  if (modal) {
    modal.style.animation = 'fadeIn 0.2s ease reverse';
    setTimeout(() => modal.remove(), 200);
  }
};

/**
 * 로컬 이미지 선택
 */
window.selectLocalImageForIndex = function (index) {
  const fileInput = document.getElementById(`localImageInput_${index}`);
  if (fileInput) fileInput.click();
};

/**
 * 로컬 이미지 선택 핸들러
 */
window.handleLocalImageSelect = function (event, index) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const dataUrl = e.target.result;

    // 이미지 상태 업데이트
    semiAutoState.images[index] = {
      prompt: semiAutoState.images[index]?.prompt || '',
      url: dataUrl,
      source: `로컬: ${file.name}`,
      isLocal: true
    };

    // 모든 미리보기 영역 동기화
    syncImageToAllPreviews(index, dataUrl, `로컬: ${file.name}`);

    // 모달 이미지 업데이트
    const modalImage = document.getElementById('modalImage');
    const modalSource = document.getElementById('modalImageSource');
    if (modalImage) modalImage.src = dataUrl;
    if (modalSource) modalSource.textContent = `로컬: ${file.name}`;

    console.log(`[IMAGE] ✅ 로컬 이미지로 변경: ${file.name}`);
  };
  reader.readAsDataURL(file);
};

/**
 * AI 이미지 생성 (모달에서)
 */
window.generateAIImageForIndex = async function (index) {
  const subtopic = semiAutoState.subtopics[index];
  if (!subtopic) {
    alert('소제목 정보가 없습니다.');
    return;
  }

  closeImageModal();

  // 기존 이미지 생성 함수 호출
  await generateSemiAutoImage(index);

  // 미리보기 동기화
  const imageData = semiAutoState.images[index];
  if (imageData?.url) {
    syncImageToAllPreviews(index, imageData.url, 'AI 생성');
  }
};

/**
 * 다른 이미지 수집 (Pexels)
 */
window.collectNewImageForIndex = async function (index) {
  const subtopic = semiAutoState.subtopics[index];
  if (!subtopic) {
    alert('소제목 정보가 없습니다.');
    return;
  }

  try {
    const result = await window.blogger.searchPexelsImage(subtopic);
    if (result.ok && result.url) {
      semiAutoState.images[index] = {
        prompt: semiAutoState.images[index]?.prompt || '',
        url: result.url,
        source: 'Pexels',
        isLocal: false
      };

      syncImageToAllPreviews(index, result.url, 'Pexels');

      // 모달 이미지 업데이트
      const modalImage = document.getElementById('modalImage');
      const modalSource = document.getElementById('modalImageSource');
      if (modalImage) modalImage.src = result.url;
      if (modalSource) modalSource.textContent = 'Pexels';

      console.log(`[IMAGE] ✅ 새 이미지 수집 완료`);
    }
  } catch (error) {
    console.error('[IMAGE] 이미지 수집 오류:', error);
    alert('이미지 수집에 실패했습니다.');
  }
};

/**
 * 🔄 모든 미리보기 영역에 이미지 동기화
 */
function syncImageToAllPreviews(index, imageUrl, source = '') {
  // 1. 영어 프롬프트 미리보기 영역
  const promptPreview = document.getElementById(`preview-${index}`);
  if (promptPreview) {
    promptPreview.innerHTML = `
      <img src="${imageUrl}" alt="${semiAutoState.subtopics[index] || ''}" 
           style="width: 100%; height: auto; border-radius: 12px; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15); object-fit: cover; max-height: 400px; cursor: pointer;"
           onclick="showImageModal('${imageUrl.replace(/'/g, "\\'")}', ${index}, '${source}')">
      <div style="margin-top: 8px; font-size: 11px; color: #64748b; text-align: center;">📷 ${source}</div>
    `;
  }

  // 2. 소제목별 이미지 미리보기 영역
  const sectionPreview = document.getElementById(`semiAutoImagePreview_${index}`);
  if (sectionPreview) {
    sectionPreview.innerHTML = `
      <img src="${imageUrl}" alt="${semiAutoState.subtopics[index] || ''}" 
           style="width: 100%; height: auto; border-radius: 12px; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15); object-fit: cover; max-height: 400px; cursor: pointer;"
           onclick="showImageModal('${imageUrl.replace(/'/g, "\\'")}', ${index}, '${source}')">
    `;
  }

  // 3. 포스팅 글 미리보기의 해당 섹션 이미지 업데이트
  updatePostPreviewImage(index, imageUrl, source);

  console.log(`[IMAGE-SYNC] ✅ 인덱스 ${index} 이미지 동기화 완료`);
}

/**
 * 포스팅 미리보기의 섹션 이미지 업데이트
 */
function updatePostPreviewImage(index, imageUrl, source) {
  const previewContainer = document.getElementById('semiAutoPreview');
  if (!previewContainer) return;

  // 미리보기 HTML에서 해당 섹션의 이미지 찾기
  const sectionImages = previewContainer.querySelectorAll('.section-image img');
  if (sectionImages[index]) {
    sectionImages[index].src = imageUrl;
    sectionImages[index].alt = `${semiAutoState.subtopics[index] || '이미지'} (출처: ${source})`;
    sectionImages[index].style.cursor = 'pointer';
    sectionImages[index].onclick = () => showImageModal(imageUrl, index, source);
  }

  // 또는 H2 다음 이미지 찾기
  const h2Elements = previewContainer.querySelectorAll('h2');
  if (h2Elements[index]) {
    let nextEl = h2Elements[index].nextElementSibling;
    while (nextEl) {
      if (nextEl.tagName === 'IMG' || nextEl.querySelector('img')) {
        const img = nextEl.tagName === 'IMG' ? nextEl : nextEl.querySelector('img');
        if (img) {
          img.src = imageUrl;
          img.alt = `${semiAutoState.subtopics[index] || '이미지'} (출처: ${source})`;
          img.style.cursor = 'pointer';
          img.onclick = () => showImageModal(imageUrl, index, source);
        }
        break;
      }
      if (nextEl.tagName === 'H2' || nextEl.tagName === 'H3') break;
      nextEl = nextEl.nextElementSibling;
    }
  }
}

/**
 * 🖼️ 이미지 미리보기에 클릭 이벤트 추가 (기존 코드 확장)
 */
function addImageClickHandlers() {
  // 영어 프롬프트 미리보기 이미지들에 클릭 이벤트 추가
  semiAutoState.subtopics.forEach((subtopic, index) => {
    const previewDiv = document.getElementById(`preview-${index}`);
    if (previewDiv) {
      const img = previewDiv.querySelector('img');
      if (img && !img.hasAttribute('data-click-added')) {
        img.style.cursor = 'pointer';
        img.setAttribute('data-click-added', 'true');
        img.onclick = () => {
          const source = semiAutoState.images[index]?.source || 'Unknown';
          showImageModal(img.src, index, source);
        };
      }
    }
  });
}

// 🔧 미리보기 텍스트 가시성 자동 수정
(function () {
  if (typeof document === 'undefined') return;

  const existingFix = document.getElementById('semi-auto-preview-fix');
  if (existingFix) return;

  const style = document.createElement('style');
  style.id = 'semi-auto-preview-fix';
  style.innerHTML = `
    #semiAutoPreview {
      background: #ffffff !important;
    }
    
    #semiAutoPreview .preview-wrapper {
      background: #ffffff !important;
      color: #1e293b !important;
    }
    
    #semiAutoPreview p,
    #semiAutoPreview h1,
    #semiAutoPreview h2,
    #semiAutoPreview h3,
    #semiAutoPreview h4,
    #semiAutoPreview h5,
    #semiAutoPreview h6 {
      color: #1e293b !important;
    }
    
    #semiAutoPreview .content p {
      color: #334155 !important;
    }
    
    #semiAutoPreview .table th {
      color: white !important;
    }
    
    #semiAutoPreview .table td {
      color: #334155 !important;
    }
    
    #semiAutoPreview .cta-hook {
      color: white !important;
    }
    
    #semiAutoPreview .cta-btn {
      color: #6366f1 !important;
    }
    
    #semiAutoPreview .summary h3 {
      color: #1e293b !important;
    }
    
    #semiAutoPreview .disclaimer p {
      color: #78350f !important;
    }
  `;

  document.head.appendChild(style);
  console.log('[SEMI-AUTO] ✅ 텍스트 가시성 CSS 적용');
})();

// ============================================
// 🖼️ 썸네일 설정 이벤트 핸들러
// ============================================

(function initThumbnailSettings() {
  const bgTypeRadios = document.querySelectorAll('input[name="thumbnailBackgroundType"]');
  const localUpload = document.getElementById('localImageUpload');
  const urlInput = document.getElementById('urlImageInput');
  const previewBtn = document.getElementById('thumbnailPreviewBtn');
  const previewArea = document.getElementById('thumbnailPreviewArea');
  const previewImage = document.getElementById('thumbnailPreviewImage');
  const bgOpacitySlider = document.getElementById('thumbnailBgOpacity');
  const bgOpacityValue = document.getElementById('bgOpacityValue');
  const bgBlurSlider = document.getElementById('thumbnailBgBlur');
  const bgBlurValue = document.getElementById('bgBlurValue');

  if (!bgTypeRadios || bgTypeRadios.length === 0) {
    console.log('[썸네일] 썸네일 설정 요소를 찾을 수 없습니다');
    return;
  }

  // 배경 타입 변경
  bgTypeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const type = e.target.value;

      // 선택된 라디오 버튼의 부모 label 스타일 업데이트
      bgTypeRadios.forEach(r => {
        const label = r.closest('label');
        if (label) {
          if (r.checked) {
            label.style.background = '#3b82f6';
            label.style.borderColor = '#2563eb';
            label.querySelector('span').style.color = '#ffffff';
          } else {
            label.style.background = '#f9fafb';
            label.style.borderColor = '#e5e7eb';
            label.querySelector('span').style.color = '#374151';
          }
        }
      });

      if (localUpload) localUpload.style.display = type === 'local' ? 'block' : 'none';
      if (urlInput) urlInput.style.display = type === 'url' ? 'block' : 'none';
    });
  });

  // 초기 선택 상태 적용
  const checkedRadio = document.querySelector('input[name="thumbnailBackgroundType"]:checked');
  if (checkedRadio) {
    checkedRadio.dispatchEvent(new Event('change'));
  }

  // 슬라이더 값 표시
  if (bgOpacitySlider && bgOpacityValue) {
    bgOpacitySlider.addEventListener('input', (e) => {
      bgOpacityValue.textContent = `${e.target.value}%`;
    });
  }

  if (bgBlurSlider && bgBlurValue) {
    bgBlurSlider.addEventListener('input', (e) => {
      bgBlurValue.textContent = `${e.target.value}px`;
    });
  }

  // 썸네일 미리보기 생성
  if (previewBtn) {
    previewBtn.addEventListener('click', async () => {
      try {
        previewBtn.disabled = true;
        previewBtn.textContent = '⏳ 생성 중...';

        const title = document.getElementById('semiAutoTitle')?.value || '제목 없음';
        const keyword = document.getElementById('semiAutoKeyword')?.value || '';
        const bgTypeRadio = document.querySelector('input[name="thumbnailBackgroundType"]:checked');
        const bgType = bgTypeRadio?.value || 'none';

        let backgroundSource = undefined;

        // 로컬 이미지
        if (bgType === 'local') {
          const fileInput = document.getElementById('thumbnailImageFile');
          const file = fileInput?.files?.[0];

          if (!file) {
            alert('이미지 파일을 선택하세요.');
            previewBtn.disabled = false;
            previewBtn.textContent = '🔍 썸네일 미리보기';
            return;
          }

          // 파일 → Base64
          backgroundSource = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }

        // URL 이미지
        if (bgType === 'url') {
          const urlInputElem = document.getElementById('thumbnailImageUrl');
          backgroundSource = urlInputElem?.value;

          if (!backgroundSource) {
            alert('이미지 URL을 입력하세요.');
            previewBtn.disabled = false;
            previewBtn.textContent = '🔍 썸네일 미리보기';
            return;
          }
        }

        // 썸네일 생성 요청
        const result = await window.blogger.generateThumbnail({
          title,
          keyword,
          backgroundType: bgType,
          backgroundSource,
          opacity: bgOpacitySlider ? parseInt(bgOpacitySlider.value) / 100 : 0.6,
          blur: bgBlurSlider ? parseInt(bgBlurSlider.value) : 8
        });

        if (result.ok) {
          // 미리보기 표시
          if (previewImage) {
            previewImage.src = result.dataUrl;
          }
          if (previewArea) {
            previewArea.style.display = 'block';
          }

          // 상태 저장
          if (semiAutoState) {
            semiAutoState.thumbnailDataUrl = result.dataUrl;
          }

          console.log('[썸네일] ✅ 미리보기 생성 완료');
        } else {
          alert('썸네일 생성 실패: ' + result.error);
        }

      } catch (error) {
        console.error('[썸네일] 미리보기 생성 오류:', error);
        alert('썸네일 생성 중 오류가 발생했습니다.');
      } finally {
        if (previewBtn) {
          previewBtn.disabled = false;
          previewBtn.textContent = '🔍 썸네일 미리보기';
        }
      }
    });
  }

  console.log('[썸네일] ✅ 썸네일 설정 초기화 완료');
})();

/**
 * 🖼️ 반자동 발행 이미지 미리보기 모달 표시
 * @param {number} index - 소제목 인덱스
 */
window.showSemiAutoImageModal = function (index) {
  console.log('[SEMI-AUTO-IMAGE-MODAL] 이미지 모달 표시:', index);

  const subtopic = semiAutoState.subtopics?.[index] || `소제목 ${index + 1}`;
  const imageData = semiAutoState.images?.[index];
  const images = imageData?.url ? [imageData] : (semiAutoState.images?.[index]?.images || []);

  // 모달 생성
  const modal = document.createElement('div');
  modal.id = 'semiAutoImageModal';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.9); z-index: 10000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);';

  modal.innerHTML = `
    <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 20px; padding: 32px; max-width: 90vw; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5); position: relative;">
      <button onclick="document.getElementById('semiAutoImageModal')?.remove();" style="position: absolute; top: 16px; right: 16px; width: 40px; height: 40px; background: rgba(255,255,255,0.1); border: none; border-radius: 10px; color: white; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
      
      <h2 style="color: white; font-size: 24px; font-weight: 700; margin-bottom: 24px; text-align: center;">${subtopic}</h2>
      
      <div id="semiAutoImageModalContent" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
        ${images.length > 0 ? images.map((img, idx) => `
          <div style="position: relative; border-radius: 12px; overflow: hidden; border: 2px solid rgba(255,255,255,0.2);">
            <img src="${img.url || img}" alt="${subtopic}" style="width: 100%; height: 200px; object-fit: cover; display: block;">
            <div style="position: absolute; top: 8px; right: 8px; display: flex; gap: 4px;">
              <button onclick="removeSemiAutoImage(${index}, ${idx})" style="width: 32px; height: 32px; background: rgba(239, 68, 68, 0.9); border: none; border-radius: 6px; color: white; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center;">🗑️</button>
            </div>
          </div>
        `).join('') : '<p style="color: rgba(255,255,255,0.6); text-align: center; grid-column: 1/-1;">이미지가 없습니다</p>'}
      </div>
      
      <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
        <button onclick="changeSemiAutoImage(${index})" style="padding: 12px 24px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 12px; font-weight: 600; cursor: pointer; font-size: 14px;">
          🔄 다른 이미지로 변경
        </button>
        <button onclick="addSemiAutoImage(${index})" style="padding: 12px 24px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 12px; font-weight: 600; cursor: pointer; font-size: 14px;" ${images.length >= 3 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
          ➕ 이미지 추가 (${images.length}/3)
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
};

/**
 * 이미지 변경
 */
window.changeSemiAutoImage = async function (index) {
  // 최근 폴더부터 표시하는 모달 표시
  // TODO: 구현 필요
  alert('이미지 변경 기능 구현 중...');
};

/**
 * 이미지 추가
 */
window.addSemiAutoImage = async function (index) {
  // 최근 폴더부터 표시하는 모달 표시
  // TODO: 구현 필요
  alert('이미지 추가 기능 구현 중...');
};

/**
 * 이미지 제거
 */
window.removeSemiAutoImage = function (index, imageIndex) {
  if (!semiAutoState.images?.[index]) return;

  const images = semiAutoState.images[index].images || [];
  if (images.length > imageIndex) {
    images.splice(imageIndex, 1);
    semiAutoState.images[index].images = images;

    // 모달 업데이트
    showSemiAutoImageModal(index);

    // 미리보기 업데이트
    updateSemiAutoImagePreview(index);
  }
};

/**
 * 미리보기 업데이트
 */
function updateSemiAutoImagePreview(index) {
  const imageData = semiAutoState.images?.[index];
  const images = imageData?.url ? [imageData] : (imageData?.images || []);

  const previewDiv = document.getElementById(`preview-${index}`);
  if (previewDiv && images.length > 0) {
    previewDiv.innerHTML = `
      <div style="position: relative; width: 100%; height: 100%; cursor: pointer;" onclick="showSemiAutoImageModal(${index})">
        ${images.map((img, idx) => `
          <img src="${img.url || img}" alt="${semiAutoState.subtopics?.[index]}" 
               style="width: ${100 / images.length}%; height: 200px; border-radius: ${idx === 0 ? '12px 0 0 12px' : idx === images.length - 1 ? '0 12px 12px 0' : '0'}; object-fit: cover; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15); display: inline-block; vertical-align: top; pointer-events: none;">
        `).join('')}
      </div>
    `;
  }
}
