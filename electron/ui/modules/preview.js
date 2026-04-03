// 🔧 미리보기 관련 함수들
import { DOMCache, getAppState, getErrorHandler, ButtonStateManager, addLog, debugLog, sanitizeHTML, getTextLength } from './core.js';
import { showTab, setRunning } from './ui.js';
import { isLicenseValid } from './settings.js';
import { createPreviewPayload } from './posting.js';

// 미리보기 생성 함수
export async function generatePreview() {
  console.log('[NEW-PREVIEW] 미리보기 함수 시작');
  
  try {
    // 이전 캐시 삭제
    localStorage.removeItem('lastGeneratedContent');
    localStorage.removeItem('lastGeneratedTitle');
    localStorage.removeItem('lastGeneratedCharCount');
    console.log('[NEW-PREVIEW] 이전 캐시 삭제 완료');
    
    // 라이선스 체크
    if (!isLicenseValid()) {
      alert('🔒 라이선스 등록이 필요합니다.');
      const licenseModal = document.getElementById('licenseModal');
      if (licenseModal) licenseModal.style.display = 'flex';
      return;
    }
    
    // 실행 중 체크
    const appState = getAppState();
    if (appState.isRunning) {
      alert('작업이 실행 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    
    // 키워드 확인
    const keywordInput = DOMCache.get('keywordInput');
    const keyword = keywordInput?.value?.trim();
    if (!keyword) {
      alert('키워드를 입력해주세요.');
      return;
    }
    
    console.log('[NEW-PREVIEW] 키워드:', keyword);
    
    // 상태 설정
    setRunning(true);
    appState.isCanceled = false;
    
    // 버튼 로딩 상태
    ButtonStateManager.setLoading('generateBtn', '⏳ 생성 중...');
    
    addLog('[NEW-PREVIEW] 콘텐츠 생성 시작...');
    
    // Payload 생성
    const payload = createPreviewPayload();
    
    console.log('[NEW-PREVIEW] Payload:', payload);
    
    // API 호출
    const result = await window.blogger.runPost(payload);
    console.log('[NEW-PREVIEW] Result:', result);
    
    if (result?.ok) {
      addLog('✅ 콘텐츠 생성 완료!', 'success');
      
      const htmlContent = result.html || result.content || '';
      const textLength = getTextLength(htmlContent);
      const htmlSizeKB = (htmlContent.length / 1024).toFixed(2);
      console.log(`[NEW-PREVIEW] HTML 콘텐츠 크기: ${textLength}자 (순수 텍스트, HTML: ${htmlContent.length}자, ${htmlSizeKB}KB)`);
      addLog(`📏 받은 HTML 크기: ${textLength}자 (순수 텍스트)`, 'info');
      
      appState.generatedContent.title = result.title || keyword;
      appState.generatedContent.content = htmlContent;
      appState.generatedContent.thumbnailUrl = result.thumbnailUrl || '';
      appState.generatedContent.payload = payload;
      
      const savedTextLength = getTextLength(appState.generatedContent.content);
      console.log('[NEW-PREVIEW] 저장된 콘텐츠:', {
        title: appState.generatedContent.title,
        contentLength: savedTextLength,
        htmlLength: appState.generatedContent.content.length,
        contentPreview: appState.generatedContent.content.substring(0, 200)
      });
      
      // 미리보기 표시
      displayPreviewInModal();
      
      // 🔍 미리보기 자동 저장 (디버깅용)
      try {
        const fs = require('fs');
        const path = require('path');
        const previewDir = path.join(process.cwd(), 'preview-debug');
        
        // 디렉토리 생성
        if (!fs.existsSync(previewDir)) {
          fs.mkdirSync(previewDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `preview-${timestamp}.html`;
        const filepath = path.join(previewDir, filename);
        
        fs.writeFileSync(filepath, appState.generatedContent.content, 'utf-8');
        console.log(`[PREVIEW-DEBUG] 미리보기 저장 완료: ${filepath}`);
        addLog(`[PREVIEW-DEBUG] 미리보기 저장: ${filename}`, 'success');
      } catch (err) {
        console.error('[PREVIEW-DEBUG] 미리보기 저장 실패:', err);
      }
      
      addLog('[NEW-PREVIEW] 미리보기 데이터 준비 완료! 미리보기 버튼을 클릭하세요.', 'success');
      
    } else {
      throw new Error(result?.error || result?.logs || '콘텐츠 생성 실패');
    }
    
  } catch (error) {
    getErrorHandler().handle(error, {
      function: 'generatePreview',
      step: '콘텐츠 생성'
    });
  } finally {
    ButtonStateManager.restore('generateBtn');
    setRunning(false);
    appState.isCanceled = false;
  }
}

// 미리보기 탭에 콘텐츠 표시
export function displayPreviewInModal() {
  console.log('[DISPLAY-PREVIEW] 미리보기 탭에 표시 시작');
  
  const previewContent = DOMCache.get('previewContent');
  const previewTitleText = document.getElementById('previewTitleText');
  const previewCharCount = document.getElementById('previewCharCount');
  
  if (!previewContent) {
    console.error('[DISPLAY-PREVIEW] previewContent 요소를 찾을 수 없습니다');
    return;
  }
  
  const appState = getAppState();
  const content = appState.generatedContent.content;
  const title = appState.generatedContent.title;
  const thumbnailUrl = appState.generatedContent.thumbnailUrl;
  
  if (content && content.trim()) {
    // 제목 표시
    if (previewTitleText) {
      previewTitleText.textContent = title || '제목 없음';
    }
    
    const previewTitle = document.getElementById('previewTitle');
    if (previewTitle) {
      previewTitle.textContent = title || '제목 없음';
    }
    
    // 썸네일 표시
    const thumbnailSection = document.getElementById('previewThumbnailSection');
    const thumbnailImage = document.getElementById('previewThumbnailImage');
    if (thumbnailUrl && thumbnailUrl.trim()) {
      if (thumbnailSection) thumbnailSection.style.display = 'block';
      if (thumbnailImage) {
        thumbnailImage.src = thumbnailUrl;
        thumbnailImage.onerror = function() {
          if (thumbnailSection) thumbnailSection.style.display = 'none';
          console.warn('[DISPLAY-PREVIEW] 썸네일 로드 실패:', thumbnailUrl);
        };
      }
      console.log('[DISPLAY-PREVIEW] 썸네일 표시:', thumbnailUrl);
    } else {
      if (thumbnailSection) thumbnailSection.style.display = 'none';
      console.log('[DISPLAY-PREVIEW] 썸네일 없음');
    }
    
    // 콘텐츠 표시
    console.log('[DISPLAY-PREVIEW] 표시할 콘텐츠 길이:', content.length);
    
    try {
      let displayContent = content;
      
      // 콘텐츠가 너무 길면 일부만 표시 (80000자 이상)
      if (content.length > 80000) {
        const showLength = 60000; // 앞부분 60000자만 표시
        displayContent = content.substring(0, showLength);
        console.log('[DISPLAY-PREVIEW] ⚠️ 콘텐츠가 너무 길어 일부만 표시합니다 (' + showLength + '자 / 전체 ' + content.length + '자)');
        
        displayContent += `
          <div style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); 
                      color: white; 
                      padding: 20px; 
                      border-radius: 12px; 
                      margin: 30px 0; 
                      text-align: center; 
                      font-weight: 700; 
                      box-shadow: 0 4px 15px rgba(251, 191, 36, 0.3);">
            ⚠️ 미리보기 표시 제한 (전체 ${content.length.toLocaleString()}자 중 일부만 표시)<br>
            📋 <strong>실제 발행되는 글은 전체 내용이 포함됩니다!</strong><br>
            🔍 전체 확인: "HTML 복사" 또는 "브라우저에서 보기" 이용
          </div>
        `;
      }
      
      // Sanitize 적용
      let sanitizedContent;
      if (displayContent.includes('<') && displayContent.includes('>')) {
        sanitizedContent = sanitizeHTML(displayContent);
      } else {
        sanitizedContent = `<div style="padding: 20px; font-size: 14px; line-height: 1.6; color: #374151;">${sanitizeHTML(displayContent)}</div>`;
      }
      
      // 프리미엄 스킨 적용된 콘텐츠로 래핑
      const wrappedContent = `
        <div class="preview-content-wrapper" style="
          background: #f8fafc !important;
          color: #1e293b !important;
          padding: 40px !important;
          border-radius: 16px !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1) !important;
          margin: 20px 0 !important;
          min-height: 500px !important;
          font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
        ">
          <style>
            /* 🎨 프리미엄 스킨 미리보기 스타일 */
            .preview-content-wrapper * {
              box-sizing: border-box !important;
            }
            
            /* H1 - 메인 제목 */
            .preview-content-wrapper h1,
            .preview-content-wrapper .premium-h1 {
              font-size: 28px !important;
              font-weight: 800 !important;
              color: #0f172a !important;
              margin: 0 0 24px 0 !important;
              line-height: 1.4 !important;
            }
            
            /* H2 - 섹션 제목 (박스 스타일) - 빨간색 테마 */
            .preview-content-wrapper h2,
            .preview-content-wrapper .premium-h2 {
              font-size: 20px !important;
              font-weight: 700 !important;
              color: #991b1b !important;
              background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%) !important;
              border-left: 4px solid #ef4444 !important;
              border-radius: 0 12px 12px 0 !important;
              padding: 14px 18px !important;
              margin: 40px 0 16px 0 !important;
              line-height: 1.4 !important;
              box-shadow: 0 2px 8px rgba(239,68,68,0.08) !important;
            }
            
            /* H3 - 소제목 (박스 스타일) */
            .preview-content-wrapper h3,
            .preview-content-wrapper .premium-h3 {
              font-size: 17px !important;
              font-weight: 600 !important;
              color: #1e293b !important;
              background: #ffffff !important;
              border: 1px solid #e2e8f0 !important;
              border-left: 3px solid #10b981 !important;
              border-radius: 0 8px 8px 0 !important;
              padding: 10px 14px !important;
              margin: 24px 0 12px 0 !important;
              line-height: 1.5 !important;
            }
            
            /* 본문 */
            .preview-content-wrapper p {
              color: #374151 !important;
              line-height: 1.85 !important;
              margin: 0 0 16px 0 !important;
              font-size: 16px !important;
            }
            
            /* 본문 컨테이너 */
            .preview-content-wrapper .premium-content {
              background: #fafafa !important;
              border-radius: 12px !important;
              border: 1px solid #f1f5f9 !important;
              padding: 18px !important;
              margin-bottom: 20px !important;
            }
            
            /* 링크 */
            .preview-content-wrapper a {
              color: #2563eb !important;
              text-decoration: underline !important;
            }
            
            /* 번호 리스트 (행동 리스트) */
            .preview-content-wrapper ol,
            .preview-content-wrapper .premium-action-list {
              list-style: none !important;
              padding: 0 !important;
              margin: 16px 0 !important;
              counter-reset: action-counter !important;
            }
            
            .preview-content-wrapper ol li,
            .preview-content-wrapper .premium-action-list li {
              display: flex !important;
              align-items: flex-start !important;
              padding: 14px 16px !important;
              margin: 10px 0 !important;
              background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%) !important;
              border-radius: 10px !important;
              border-left: 4px solid #3b82f6 !important;
              font-size: 15px !important;
              line-height: 1.6 !important;
              color: #1e40af !important;
              counter-increment: action-counter !important;
            }
            
            .preview-content-wrapper ol li::before,
            .preview-content-wrapper .premium-action-list li::before {
              content: counter(action-counter) !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              min-width: 24px !important;
              height: 24px !important;
              background: #3b82f6 !important;
              color: white !important;
              border-radius: 50% !important;
              font-weight: 700 !important;
              font-size: 13px !important;
              margin-right: 12px !important;
              flex-shrink: 0 !important;
            }
            
            /* 강조 */
            .preview-content-wrapper strong,
            .preview-content-wrapper b {
              color: #0f172a !important;
              font-weight: 600 !important;
              background: #fef3c7 !important;
              padding: 1px 5px !important;
              border-radius: 3px !important;
            }
            
            /* 테이블 */
            .preview-content-wrapper table {
              border-collapse: collapse !important;
              width: 100% !important;
              margin: 20px 0 !important;
              border-radius: 8px !important;
              overflow: hidden !important;
            }
            
            .preview-content-wrapper th {
              background: #f1f5f9 !important;
              font-weight: 600 !important;
              color: #0f172a !important;
              padding: 12px !important;
              border: 1px solid #e2e8f0 !important;
            }
            
            .preview-content-wrapper td {
              padding: 12px !important;
              border: 1px solid #e2e8f0 !important;
              color: #374151 !important;
            }
            
            /* 이미지 */
            .preview-content-wrapper img {
              max-width: 100% !important;
              height: auto !important;
              border-radius: 8px !important;
              margin: 16px 0 !important;
            }
            
            /* CTA 버튼 */
            .preview-content-wrapper .premium-cta-box,
            .preview-content-wrapper .premium-cta-center {
              text-align: center !important;
              margin: 24px 0 !important;
            }
            
            .preview-content-wrapper .premium-cta-btn {
              display: inline-block !important;
              background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
              color: white !important;
              padding: 14px 28px !important;
              border-radius: 10px !important;
              font-weight: 700 !important;
              text-decoration: none !important;
              font-size: 16px !important;
            }
          </style>
          ${sanitizedContent}
        </div>
      `;
      
      previewContent.innerHTML = wrappedContent;
      
      // 스타일 강제 설정
      previewContent.style.height = 'auto';
      previewContent.style.maxHeight = 'none';
      previewContent.style.overflow = 'visible';
      previewContent.style.whiteSpace = 'normal';
      previewContent.style.wordWrap = 'break-word';
      previewContent.style.display = 'block';
      previewContent.style.background = '#f8fafc';
      previewContent.style.padding = '0';
      
      const parentContainer = previewContent.parentElement;
      if (parentContainer) {
        parentContainer.style.height = 'auto';
        parentContainer.style.maxHeight = 'none';
        parentContainer.style.overflow = 'visible';
        parentContainer.style.background = '#f8fafc';
      }
      
      console.log('[DISPLAY-PREVIEW] 콘텐츠 표시 완료');
      
    } catch (error) {
      console.error('[DISPLAY-PREVIEW] 콘텐츠 표시 오류:', error);
      const errorMessage = sanitizeHTML(error.message);
      previewContent.innerHTML = sanitizeHTML(`<div style="color: red; padding: 20px; font-size: 14px;">콘텐츠 표시 중 오류가 발생했습니다: ${errorMessage}</div>`);
    }
    
    // 순수 텍스트 글자수 계산
    const actualCharCount = getTextLength(content);
    
    // 글자수 표시
    if (previewCharCount) {
      previewCharCount.textContent = `${actualCharCount}자`;
    }
    
    console.log('[DISPLAY-PREVIEW] 제목:', title);
    console.log('[DISPLAY-PREVIEW] 글자수:', actualCharCount);
    
    // localStorage에 콘텐츠 저장
    try {
      localStorage.setItem('lastGeneratedContent', content);
      localStorage.setItem('lastGeneratedTitle', title || '제목 없음');
      localStorage.setItem('lastGeneratedCharCount', actualCharCount.toString());
      console.log('[DISPLAY-PREVIEW] localStorage에 콘텐츠 저장 완료');
    } catch (error) {
      console.error('[DISPLAY-PREVIEW] localStorage 저장 중 오류:', error);
    }
    
    // 자동으로 미리보기 탭으로 전환
    console.log('[DISPLAY-PREVIEW] 미리보기 탭으로 자동 전환');
    setTimeout(() => {
      showTab('preview');
      console.log('[DISPLAY-PREVIEW] 미리보기 탭 전환 완료');
    }, 500);
    
    addLog(`✅ 미리보기 생성 완료: ${title} (${actualCharCount}자)`, 'success');
  } else {
    console.warn('[DISPLAY-PREVIEW] 콘텐츠가 없습니다');
    const errorHtml = `
      <div style="text-align: center; padding: 60px 20px; color: #94a3b8;">
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin: 0 auto 24px; opacity: 0.3;">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        <div style="font-size: 20px; font-weight: 600; color: #64748b; margin-bottom: 12px;">콘텐츠 생성 오류</div>
        <div style="font-size: 14px; color: #94a3b8;">콘텐츠가 생성되지 않았습니다</div>
      </div>
    `;
    previewContent.innerHTML = sanitizeHTML(errorHtml);
  }
  
  // 발행 버튼 활성화
  ButtonStateManager.setEnabled('publishBtn', true);
}

// 미리보기 모달 표시
export function showPreviewModal(title, content, platform) {
  const overlay = document.getElementById('previewOverlay');
  const modal = document.getElementById('previewModal');
  const titleText = document.getElementById('previewTitleText');
  const platformText = document.getElementById('previewPlatformText');
  const charCount = document.getElementById('previewCharCount');
  const body = document.getElementById('previewBody');
  
  if (overlay && modal) {
    if (titleText) titleText.textContent = title || '제목 없음';
    if (platformText) platformText.textContent = platform === 'wordpress' ? 'WordPress' : 'Blogger';
    
    const textLength = getTextLength(content);
    if (charCount) charCount.textContent = textLength.toLocaleString() + '자';
    
    if (body) {
      body.innerHTML = sanitizeHTML(content);
    }
    
    overlay.style.display = 'block';
    modal.style.display = 'flex';
  }
}

// 미리보기 모달 닫기
export function closePreviewModal() {
  const overlay = document.getElementById('previewOverlay');
  const modal = document.getElementById('previewModal');
  
  if (overlay) overlay.style.display = 'none';
  if (modal) modal.style.display = 'none';
}


