// 🔧 썸네일 생성 관련 함수들
import { addLog, debugLog } from './core.js';

// 전역 변수
let currentThumbnailCanvas = null;

// 자동 썸네일 생성
export function generateAutoThumbnail(title, platform = 'blogger') {
  const thumbnailContainer = document.createElement('div');
  thumbnailContainer.className = `auto-thumbnail auto-thumbnail-${platform}`;
  
  const thumbnailText = document.createElement('div');
  thumbnailText.className = 'auto-thumbnail-text';
  
  // 제목을 적절히 줄바꿈하여 표시
  const words = title.split(' ');
  let lines = [];
  let currentLine = '';
  
  words.forEach(word => {
    if ((currentLine + word).length <= 15) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });
  if (currentLine) lines.push(currentLine);
  
  thumbnailText.textContent = lines.join('\n');
  thumbnailContainer.appendChild(thumbnailText);
  
  return thumbnailContainer;
}

// AI 배경 이미지 생성
export async function generateAIBackgroundImage(title, platform = 'blogger') {
  try {
    debugLog('IMAGE', 'AI 배경 이미지 생성 시작', { title, platform });
    
    const imagePrompt = `Create a modern, professional thumbnail image for a blog post titled "${title}". 
    The image should be ${platform === 'blogger' ? 'warm and inviting with orange/red gradients' : 'cool and professional with blue/cyan gradients'}.
    Include subtle text overlay area for the title. 
    Style: modern, clean, professional, high quality, 16:9 aspect ratio.`;
    
    const result = await window.electronAPI.generateAIImage({
      prompt: imagePrompt,
      size: '1024x1024',
      quality: 'standard'
    });
    
    debugLog('IMAGE', 'AI 배경 이미지 생성 완료', result);
    return result.imageUrl;
  } catch (error) {
    console.error('🎨 [IMAGE] AI 배경 이미지 생성 오류:', error);
    return null;
  }
}

// H2 섹션 이미지 생성
export async function generateH2SectionImages(sections, title) {
  try {
    debugLog('IMAGE', 'H2 섹션 이미지 생성 시작', { sections, title });
    
    const imagePromises = sections.map(async (sectionNumber) => {
      const sectionPrompt = `Create a professional illustration for section ${sectionNumber} of a blog post titled "${title}". 
      The image should be modern, clean, and relevant to the content. 
      Style: professional, high quality, 16:9 aspect ratio.`;
      
      const result = await window.electronAPI.generateAIImage({
        prompt: sectionPrompt,
        size: '1024x1024',
        quality: 'standard'
      });
      
      return {
        section: sectionNumber,
        imageUrl: result.imageUrl
      };
    });
    
    const results = await Promise.all(imagePromises);
    debugLog('IMAGE', 'H2 섹션 이미지 생성 완료', results);
    return results;
  } catch (error) {
    console.error('🎨 [IMAGE] H2 섹션 이미지 생성 오류:', error);
    return [];
  }
}

// 텍스트 썸네일 생성
export function generateTextThumbnail() {
  const text = document.getElementById('thumbnailText')?.value;
  if (!text || text.trim() === '') {
    alert('썸네일에 표시할 텍스트를 입력해주세요.');
    return;
  }
  
  updateThumbnailPreview();
  
  // 생성된 썸네일을 localStorage에 저장
  if (currentThumbnailCanvas) {
    currentThumbnailCanvas.toBlob((blob) => {
      const reader = new FileReader();
      reader.onload = function() {
        const dataUrl = reader.result;
        localStorage.setItem('generatedThumbnail', dataUrl);
        localStorage.setItem('thumbnailText', text);
        console.log('✅ 썸네일이 저장되었습니다. 포스팅 시 자동으로 사용됩니다.');
      };
      reader.readAsDataURL(blob);
    });
  }
  
  alert('✅ 썸네일이 생성되었습니다! 포스팅 시 자동으로 사용됩니다.');
}

// 썸네일 미리보기 업데이트
export function updateThumbnailPreview() {
  const text = document.getElementById('thumbnailText')?.value || '';
  const canvas = document.getElementById('thumbnailCanvas');
  const preview = document.getElementById('thumbnailPreview');
  
  if (!canvas || !preview) return;
  
  const ctx = canvas.getContext('2d');
  const width = 1200;
  const height = 630;
  
  canvas.width = width;
  canvas.height = height;
  
  // 배경
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  
  // 테두리
  ctx.strokeStyle = '#f97316';
  ctx.lineWidth = 8;
  ctx.strokeRect(150, 90, 900, 450);
  
  // 텍스트
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 48px "Noto Sans KR", "Malgun Gothic", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const lines = text.split('\n');
  const lineHeight = 60;
  const startY = height / 2 - (lines.length - 1) * lineHeight / 2;
  
  lines.forEach((line, index) => {
    ctx.fillText(line, width / 2, startY + index * lineHeight);
  });
  
  // 미리보기 업데이트
  preview.src = canvas.toDataURL();
  currentThumbnailCanvas = canvas;
}

// 썸네일 다운로드
export function downloadThumbnail() {
  if (!currentThumbnailCanvas) {
    alert('먼저 썸네일을 생성해주세요.');
    return;
  }
  
  try {
    currentThumbnailCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `thumbnail-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert('✅ 썸네일이 다운로드되었습니다!');
    }, 'image/png');
  } catch (error) {
    console.error('썸네일 다운로드 오류:', error);
    alert('❌ 썸네일 다운로드 중 오류가 발생했습니다.');
  }
}

// 프리셋 적용
export function applyPreset(bgColor, textColor, borderColor) {
  const bgInput = document.getElementById('thumbnailBgColor');
  const textInput = document.getElementById('thumbnailTextColor');
  const borderInput = document.getElementById('thumbnailBorderColor');
  
  if (bgInput) bgInput.value = bgColor;
  if (textInput) textInput.value = textColor;
  if (borderInput) borderInput.value = borderColor;
  
  updateThumbnailPreview();
}

// ============================================
// 🖼️ 썸네일 생성기 탭 - 배경 이미지 설정 이벤트 핸들러
// ============================================

(function initThumbnailGeneratorSettings() {
  const bgTypeRadios = document.querySelectorAll('input[name="thumbnailGenBackgroundType"]');
  const localUpload = document.getElementById('thumbnailGenLocalUpload');
  const urlInput = document.getElementById('thumbnailGenUrlInput');
  const bgOpacitySlider = document.getElementById('thumbnailGenBgOpacity');
  const bgOpacityValue = document.getElementById('thumbnailGenBgOpacityValue');
  const bgBlurSlider = document.getElementById('thumbnailGenBgBlur');
  const bgBlurValue = document.getElementById('thumbnailGenBgBlurValue');
  
  if (!bgTypeRadios || bgTypeRadios.length === 0) {
    console.log('[썸네일 생성기] 배경 설정 요소를 찾을 수 없습니다');
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
            label.style.background = 'rgba(59, 130, 246, 0.3)';
            label.style.borderColor = 'rgba(59, 130, 246, 0.6)';
            label.querySelector('span').style.color = '#ffffff';
          } else {
            label.style.background = 'rgba(255, 255, 255, 0.1)';
            label.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            label.querySelector('span').style.color = 'rgba(255, 255, 255, 0.9)';
          }
        }
      });
      
      if (localUpload) localUpload.style.display = type === 'local' ? 'block' : 'none';
      if (urlInput) urlInput.style.display = type === 'url' ? 'block' : 'none';
    });
  });
  
  // 초기 선택 상태 적용
  const checkedRadio = document.querySelector('input[name="thumbnailGenBackgroundType"]:checked');
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
  
  console.log('[썸네일 생성기] ✅ 배경 설정 초기화 완료');
})();

// 배경 이미지가 있는 썸네일 생성
export async function generateTextThumbnailWithBackground() {
  const text = document.getElementById('thumbnailText')?.value;
  if (!text || text.trim() === '') {
    alert('썸네일에 표시할 텍스트를 입력해주세요.');
    return;
  }
  
  const bgTypeRadio = document.querySelector('input[name="thumbnailGenBackgroundType"]:checked');
  const bgType = bgTypeRadio?.value || 'none';
  
  // 배경 이미지가 없으면 기본 생성
  if (bgType === 'none') {
    generateTextThumbnail();
    return;
  }
  
  try {
    let backgroundSource = undefined;
    
    // 로컬 이미지
    if (bgType === 'local') {
      const fileInput = document.getElementById('thumbnailGenImageFile');
      const file = fileInput?.files?.[0];
      
      if (!file) {
        alert('이미지 파일을 선택하세요.');
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
      const urlInputElem = document.getElementById('thumbnailGenImageUrl');
      backgroundSource = urlInputElem?.value;
      
      if (!backgroundSource) {
        alert('이미지 URL을 입력하세요.');
        return;
      }
    }
    
    // 썸네일 생성 요청
    const bgOpacitySlider = document.getElementById('thumbnailGenBgOpacity');
    const bgBlurSlider = document.getElementById('thumbnailGenBgBlur');
    
    const result = await window.blogger.generateThumbnail({
      title: text,
      keyword: text,
      backgroundType: bgType,
      backgroundSource,
      opacity: bgOpacitySlider ? parseInt(bgOpacitySlider.value) / 100 : 0.6,
      blur: bgBlurSlider ? parseInt(bgBlurSlider.value) : 8
    });
    
    if (result.ok) {
      // 미리보기 영역에 표시
      const preview = document.getElementById('thumbnailPreview');
      const previewContainer = preview?.parentElement;
      
      if (preview) {
        // 이미지로 표시
        const img = document.createElement('img');
        img.src = result.dataUrl;
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '12px';
        img.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.1)';
        
        // 기존 내용 제거하고 이미지 추가
        if (previewContainer) {
          previewContainer.innerHTML = '';
          previewContainer.appendChild(img);
        } else {
          preview.innerHTML = '';
          preview.appendChild(img);
        }
        
        // 캔버스 생성 (다운로드용)
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 630;
        const ctx = canvas.getContext('2d');
        
        const canvasImg = new Image();
        canvasImg.onload = () => {
          ctx.drawImage(canvasImg, 0, 0, 1200, 630);
          currentThumbnailCanvas = canvas;
          
          // localStorage에 저장
          localStorage.setItem('generatedThumbnail', result.dataUrl);
          localStorage.setItem('thumbnailText', text);
          
          // 다운로드 버튼 표시
          const downloadBtn = document.getElementById('downloadThumbnailBtn');
          if (downloadBtn) {
            downloadBtn.style.display = 'block';
          }
          
          alert('✅ 배경 이미지 썸네일이 생성되었습니다!');
        };
        canvasImg.src = result.dataUrl;
      } else {
        alert('✅ 썸네일이 생성되었습니다!');
      }
    } else {
      alert('썸네일 생성 실패: ' + result.error);
    }
    
  } catch (error) {
    console.error('[썸네일 생성기] 배경 이미지 썸네일 생성 오류:', error);
    alert('썸네일 생성 중 오류가 발생했습니다.');
  }
}




