// 전역 함수: 내부링크 관리 모달 열기
function openInternalLinksManagerModal() {
  console.log('[INTERNAL-LINKS] 내부링크 관리 모달 열기');
  
  // 모달 생성 또는 표시
  let modal = document.getElementById('internalLinksManagerModal');
  
  if (!modal) {
    // 모달이 없으면 생성
    const modalHTML = `
      <div id="internalLinksManagerModal" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.85); z-index: 10001; backdrop-filter: blur(12px); align-items: center; justify-content: center;">
        <div style="width: 95%; max-width: 1200px; max-height: 90vh; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 28px; box-shadow: 0 40px 100px rgba(0, 0, 0, 0.5); overflow: hidden; display: flex; flex-direction: column;">
          
          <!-- 모달 헤더 -->
          <div style="background: linear-gradient(135deg, #ff6b6b 0%, #feca57 100%); padding: 36px 40px; color: white; position: relative; overflow: hidden;">
            <div style="position: absolute; top: -50%; right: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, transparent 70%); opacity: 0.6;"></div>
            <div style="display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 2;">
              <div style="display: flex; align-items: center; gap: 16px;">
                <div style="width: 72px; height: 72px; background: rgba(255, 255, 255, 0.25); border-radius: 20px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); border: 2px solid rgba(255, 255, 255, 0.4); font-size: 36px;">
                  🕸️
                </div>
                <div>
                  <h2 style="font-size: 32px; font-weight: 900; margin: 0; text-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);">내부 링크 관리</h2>
                  <p style="font-size: 16px; margin: 8px 0 0 0; opacity: 0.95; font-weight: 500;">발행한 글들을 거미줄처럼 연결하여 SEO를 향상시키세요</p>
                </div>
              </div>
              <button onclick="closeInternalLinksManagerModal()" style="background: rgba(255, 255, 255, 0.25); color: white; border: none; padding: 14px 28px; border-radius: 14px; font-size: 16px; font-weight: 800; cursor: pointer; backdrop-filter: blur(10px); border: 2px solid rgba(255, 255, 255, 0.4); transition: all 0.3s;">
                ✕ 닫기
              </button>
            </div>
          </div>
          
          <!-- 모달 바디 -->
          <div style="flex: 1; overflow-y: auto; padding: 40px;">
            
            <!-- 발행글 목록 불러오기 버튼 -->
            <div style="text-align: center; margin-bottom: 32px;">
              <button onclick="openPublishedPostsModal()" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 20px 50px; border-radius: 16px; font-size: 18px; font-weight: 700; cursor: pointer; box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4); transition: all 0.3s ease;">
                📚 발행한 글 선택
              </button>
            </div>

            <!-- 선택한 글 목록 (최대 5개) -->
            <div style="background: white; border-radius: 24px; padding: 40px; margin-bottom: 32px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);">
              <h3 style="font-size: 24px; font-weight: 700; color: #1e293b; margin-bottom: 24px;">✅ 선택한 글 (최대 5개)</h3>
              <div id="selectedPostsList" style="min-height: 100px;">
                <div style="text-align: center; color: #94a3b8; padding: 40px;">
                  <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                  <div style="font-size: 16px;">위 버튼을 눌러 발행한 글을 선택하세요</div>
                </div>
              </div>
            </div>

            <!-- 글 주소 직접 입력 -->
            <div style="background: white; border-radius: 24px; padding: 40px; margin-bottom: 32px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);">
              <h3 style="font-size: 24px; font-weight: 700; color: #1e293b; margin-bottom: 24px;">🔗 글 주소 직접 입력</h3>
              <div style="display: grid; gap: 16px;">
                <input type="text" id="internalLink1" placeholder="글 주소 1" style="width: 100%; padding: 16px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 16px; box-sizing: border-box; transition: all 0.3s;" onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102, 126, 234, 0.1)'" onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'">
                <input type="text" id="internalLink2" placeholder="글 주소 2" style="width: 100%; padding: 16px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 16px; box-sizing: border-box; transition: all 0.3s;" onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102, 126, 234, 0.1)'" onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'">
                <input type="text" id="internalLink3" placeholder="글 주소 3" style="width: 100%; padding: 16px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 16px; box-sizing: border-box; transition: all 0.3s;" onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102, 126, 234, 0.1)'" onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'">
                <input type="text" id="internalLink4" placeholder="글 주소 4" style="width: 100%; padding: 16px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 16px; box-sizing: border-box; transition: all 0.3s;" onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102, 126, 234, 0.1)'" onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'">
                <input type="text" id="internalLink5" placeholder="글 주소 5" style="width: 100%; padding: 16px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 16px; box-sizing: border-box; transition: all 0.3s;" onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102, 126, 234, 0.1)'" onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'">
              </div>
            </div>

            <!-- 글 생성 버튼 -->
            <div style="text-align: center; margin-bottom: 32px;">
              <button onclick="generateInternalLinkContent()" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; padding: 20px 60px; border-radius: 16px; font-size: 20px; font-weight: 700; cursor: pointer; box-shadow: 0 10px 30px rgba(16, 185, 129, 0.4); transition: all 0.3s ease;">
                ✨ 관련 글 생성하기
              </button>
            </div>

            <!-- 미리보기 -->
            <div id="internalLinkPreview" style="display: none; background: white; border-radius: 24px; padding: 40px; margin-bottom: 32px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);">
              <h3 style="font-size: 24px; font-weight: 700; color: #1e293b; margin-bottom: 24px;">👁️ 미리보기</h3>
              <div id="internalLinkPreviewContent" style="background: #f7f9fc; padding: 40px; border-radius: 16px; min-height: 400px;"></div>
            </div>

            <!-- 발행 버튼들 -->
            <div id="internalLinkPublishButtons" style="display: none; text-align: center; gap: 16px; justify-content: center;">
              <button onclick="publishInternalLinkContent(false)" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; border: none; padding: 20px 40px; border-radius: 16px; font-size: 18px; font-weight: 700; cursor: pointer; box-shadow: 0 10px 30px rgba(59, 130, 246, 0.3); transition: all 0.3s ease; margin-right: 16px;">
                📝 글만 생성하기
              </button>
              <button onclick="publishInternalLinkContent(true)" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border: none; padding: 20px 40px; border-radius: 16px; font-size: 18px; font-weight: 700; cursor: pointer; box-shadow: 0 10px 30px rgba(245, 158, 11, 0.3); transition: all 0.3s ease;">
                🚀 글 생성 및 발행
              </button>
            </div>
            
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    modal = document.getElementById('internalLinksManagerModal');
    console.log('[INTERNAL-LINKS] ✅ 모달 생성 완료');
  } else {
    modal.style.display = 'flex';
    console.log('[INTERNAL-LINKS] ✅ 모달 표시');
  }
}

// 내부링크 관리 모달 닫기
function closeInternalLinksManagerModal() {
  const modal = document.getElementById('internalLinksManagerModal');
  if (modal) {
    modal.style.display = 'none';
    console.log('[INTERNAL-LINKS] 모달 닫기');
  }
}

// 🔥 4개 글 묶음 종합글 생성
async function generateInternalLinkContent() {
  console.log('[INTERNAL-LINKS] 🚀 종합글 생성 시작');
  
  // URL 수집 (입력된 URL들)
  const urls = [];
  for (let i = 1; i <= 5; i++) {
    const input = document.getElementById(`internalLink${i}`);
    if (input && input.value.trim()) {
      urls.push(input.value.trim());
    }
  }
  
  // 선택된 글 URL도 추가
  const selectedPosts = document.querySelectorAll('#selectedPostsList [data-url]');
  selectedPosts.forEach(post => {
    const url = post.getAttribute('data-url');
    if (url && !urls.includes(url)) {
      urls.push(url);
    }
  });
  
  if (urls.length < 2) {
    alert('최소 2개 이상의 글 URL을 입력해주세요.');
    return;
  }
  
  if (urls.length > 5) {
    alert('최대 5개까지 선택 가능합니다.');
    return;
  }
  
  // 로딩 표시
  const previewArea = document.getElementById('internalLinkPreview');
  const previewContent = document.getElementById('internalLinkPreviewContent');
  const publishButtons = document.getElementById('internalLinkPublishButtons');
  
  if (previewArea) previewArea.style.display = 'block';
  if (previewContent) {
    previewContent.innerHTML = `
      <div style="text-align: center; padding: 60px;">
        <div style="font-size: 48px; margin-bottom: 20px; animation: spin 2s linear infinite;">⏳</div>
        <div style="font-size: 18px; color: #64748b;">AI가 종합글을 생성하고 있습니다...</div>
        <div style="font-size: 14px; color: #94a3b8; margin-top: 8px;">각 글을 분석하고 CTA를 배치합니다</div>
      </div>
      <style>@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }</style>
    `;
  }
  
  try {
    // 각 URL의 콘텐츠 크롤링
    console.log('[INTERNAL-LINKS] 📰 URL 크롤링 시작:', urls.length, '개');
    
    const crawledContents = [];
    for (const url of urls) {
      try {
        const result = await window.blogger.invoke('crawl-url', url);
        if (result && result.ok) {
          crawledContents.push({
            url: url,
            title: result.title || '제목 없음',
            content: result.content || '',
            summary: (result.content || '').substring(0, 300) + '...'
          });
        } else {
          crawledContents.push({
            url: url,
            title: new URL(url).pathname.split('/').pop() || '관련 글',
            content: '',
            summary: ''
          });
        }
      } catch (err) {
        console.warn('[INTERNAL-LINKS] 크롤링 실패:', url, err);
        crawledContents.push({
          url: url,
          title: '관련 글',
          content: '',
          summary: ''
        });
      }
    }
    
    console.log('[INTERNAL-LINKS] ✅ 크롤링 완료:', crawledContents.length, '개');
    
    // 종합글 HTML 생성
    const comprehensiveHtml = generateComprehensivePost(crawledContents);
    
    // 상태 저장
    window.internalLinkState = {
      urls: urls,
      crawledContents: crawledContents,
      html: comprehensiveHtml
    };
    
    // 미리보기 표시
    if (previewContent) {
      previewContent.innerHTML = comprehensiveHtml;
    }
    
    // 발행 버튼 표시
    if (publishButtons) {
      publishButtons.style.display = 'flex';
    }
    
    console.log('[INTERNAL-LINKS] ✅ 종합글 생성 완료');
    
  } catch (error) {
    console.error('[INTERNAL-LINKS] ❌ 종합글 생성 오류:', error);
    if (previewContent) {
      previewContent.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #ef4444;">
          <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
          <div style="font-size: 18px;">종합글 생성에 실패했습니다</div>
          <div style="font-size: 14px; margin-top: 8px;">${error.message}</div>
        </div>
      `;
    }
  }
}

// 🔥 종합글 HTML 생성 (4개 CTA 포함)
function generateComprehensivePost(crawledContents) {
  const posts = crawledContents.slice(0, 4); // 최대 4개
  
  // CTA 색상 (초록/빨강 교대)
  const ctaColors = [
    { bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', btnBg: '#fff', btnColor: '#059669' },
    { bg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', btnBg: '#fff', btnColor: '#dc2626' },
    { bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', btnBg: '#fff', btnColor: '#059669' },
    { bg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', btnBg: '#fff', btnColor: '#dc2626' }
  ];
  
  // 종합 제목 생성
  const mainTitle = `${posts[0]?.title || '관련 정보'} 외 ${posts.length - 1}가지 완벽 총정리`;
  
  let html = `
<div class="bgpt-content" style="font-family: 'Pretendard', 'Apple SD Gothic Neo', sans-serif; line-height: 1.8; color: #1e293b; max-width: 100%;">
  
  <!-- 메인 제목 -->
  <h1 style="font-size: 28px; font-weight: 800; color: #0f172a; margin-bottom: 24px; border-bottom: 4px solid #3b82f6; padding-bottom: 16px;">
    📚 ${mainTitle}
  </h1>
  
  <!-- 도입부 -->
  <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); padding: 24px; border-radius: 16px; margin-bottom: 32px; border-left: 5px solid #3b82f6;">
    <p style="margin: 0; font-size: 16px; color: #1e40af;">
      이 글에서는 <strong>${posts.map(p => p.title).slice(0, 3).join(', ')}</strong> 등 관련된 ${posts.length}가지 주제를 한눈에 정리해드립니다.
      각 주제별로 핵심 내용을 확인하고, 더 자세한 정보는 링크를 통해 확인하세요!
    </p>
  </div>
`;

  // 각 글에 대한 섹션 + CTA 생성
  posts.forEach((post, index) => {
    const color = ctaColors[index % ctaColors.length];
    const emoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'][index];
    
    html += `
  <!-- 섹션 ${index + 1} -->
  <h2 style="font-size: 22px; font-weight: 700; color: #ffffff; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 16px 20px; border-radius: 0 14px 14px 0; margin: 40px 0 20px 0; border-left: 6px solid #fbbf24;">
    ${emoji} ${post.title}
  </h2>
  
  <div style="padding: 20px; background: #f8fafc; border-radius: 12px; margin-bottom: 20px;">
    <p style="font-size: 15px; color: #475569; line-height: 1.8; margin: 0;">
      ${post.summary || `${post.title}에 대한 자세한 내용을 확인해보세요. 핵심 정보와 실용적인 팁이 담겨 있습니다.`}
    </p>
  </div>
  
  <!-- CTA ${index + 1} -->
  <div style="text-align: center; margin: 24px 0 40px 0;">
    <div style="display: inline-block; width: 100%; max-width: 550px; padding: 28px 36px; background: ${color.bg}; border-radius: 18px; box-shadow: 0 10px 40px rgba(0,0,0,0.15);">
      <p style="font-size: 18px; font-weight: 700; color: white; margin: 0 0 16px 0; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        💡 ${post.title} 더 자세히 알아보기
      </p>
      <a href="${post.url}" target="_blank" rel="noopener" style="display: inline-block; padding: 14px 40px; background: ${color.btnBg}; color: ${color.btnColor}; text-decoration: none; border-radius: 50px; font-weight: 800; font-size: 16px; box-shadow: 0 4px 16px rgba(0,0,0,0.1); transition: transform 0.3s;">
        🚀 자세히 보러가기
      </a>
    </div>
  </div>
`;
  });

  // 종합 요약표
  html += `
  <!-- 종합 요약 -->
  <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 28px; border-radius: 16px; margin: 40px 0; border: 2px solid #fbbf24;">
    <h3 style="font-size: 20px; font-weight: 700; color: #92400e; margin: 0 0 20px 0;">📊 관련 글 한눈에 보기</h3>
    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden;">
      <thead>
        <tr style="background: #f59e0b; color: white;">
          <th style="padding: 14px; text-align: left; font-weight: 700;">번호</th>
          <th style="padding: 14px; text-align: left; font-weight: 700;">제목</th>
          <th style="padding: 14px; text-align: center; font-weight: 700;">바로가기</th>
        </tr>
      </thead>
      <tbody>
        ${posts.map((post, i) => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 14px; font-weight: 600; color: #f59e0b;">${i + 1}</td>
          <td style="padding: 14px; color: #1e293b;">${post.title}</td>
          <td style="padding: 14px; text-align: center;">
            <a href="${post.url}" target="_blank" style="color: #3b82f6; text-decoration: none; font-weight: 600;">보기 →</a>
          </td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  
  <!-- 마무리 -->
  <div style="background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); padding: 24px; border-radius: 16px; text-align: center;">
    <p style="font-size: 15px; color: #64748b; margin: 0;">
      위 글들은 서로 연관된 주제로, 함께 읽으시면 더 깊은 이해에 도움이 됩니다.<br>
      각 링크를 통해 더 자세한 정보를 확인해보세요! 🙌
    </p>
  </div>
  
</div>
`;
  
  return html;
}

// 종합글 발행
async function publishInternalLinkContent(shouldPublish = false) {
  if (!window.internalLinkState || !window.internalLinkState.html) {
    alert('먼저 종합글을 생성해주세요.');
    return;
  }
  
  const title = `${window.internalLinkState.crawledContents[0]?.title || '관련 정보'} 외 ${window.internalLinkState.crawledContents.length - 1}가지 완벽 총정리`;
  
  if (shouldPublish) {
    // 실제 발행
    try {
      const payload = {
        topic: title,
        title: title,
        html: window.internalLinkState.html,
        platform: document.querySelector('input[name="platform"]:checked')?.value || 'wordpress',
        previewOnly: false
      };
      
      console.log('[INTERNAL-LINKS] 📤 발행 시작');
      
      // runPost 호출 또는 직접 발행
      if (window.blogger && window.blogger.runPost) {
        const result = await window.blogger.runPost(payload);
        if (result && result.ok) {
          alert('✅ 종합글이 성공적으로 발행되었습니다!');
          closeInternalLinksManagerModal();
        } else {
          alert('발행 실패: ' + (result?.error || '알 수 없는 오류'));
        }
      }
    } catch (error) {
      console.error('[INTERNAL-LINKS] 발행 오류:', error);
      alert('발행 중 오류가 발생했습니다: ' + error.message);
    }
  } else {
    // 글만 생성 (미리보기)
    const previewContainer = document.getElementById('internalLinkPreviewContent');
    if (previewContainer) {
      // 클립보드에 복사
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = window.internalLinkState.html;
      
      try {
        await navigator.clipboard.writeText(tempDiv.innerHTML);
        alert('✅ HTML이 클립보드에 복사되었습니다!\n직접 블로그에 붙여넣기 하세요.');
      } catch (err) {
        // 폴백: 텍스트 영역에 표시
        previewContainer.innerHTML = `
          <div style="margin-bottom: 16px; color: #059669; font-weight: 600;">✅ 아래 HTML을 복사하여 사용하세요:</div>
          <textarea style="width: 100%; height: 400px; padding: 16px; border: 2px solid #e5e7eb; border-radius: 12px; font-family: monospace; font-size: 13px;">${window.internalLinkState.html.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
        `;
      }
    }
  }
}

// 발행글 목록 모달 열기
function openPublishedPostsModal() {
  alert('📚 발행한 글 목록 기능은 준비 중입니다.\n\n직접 URL을 입력해주세요.');
}











