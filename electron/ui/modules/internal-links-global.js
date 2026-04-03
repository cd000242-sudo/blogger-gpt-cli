// 전역 함수: 내부링크 관리 모달 열기
function openInternalLinksManagerModal() {
  console.log('[INTERNAL-LINKS] 버튼 클릭됨 - 내부링크 탭으로 전환');
  
  // 탭 전환 함수가 있으면 사용
  if (typeof showTab === 'function') {
    showTab('internal-links');
  } else {
    // showTab 함수가 없으면 직접 탭 표시
    const allTabs = document.querySelectorAll('.tab-content, [id$="-tab"]');
    allTabs.forEach(tab => {
      tab.style.display = 'none';
    });
    
    const internalLinksTab = document.getElementById('internal-links-tab');
    if (internalLinksTab) {
      internalLinksTab.style.display = 'block';
      
      // 탭 버튼 활성화
      const tabButtons = document.querySelectorAll('.tab-btn');
      tabButtons.forEach(btn => btn.classList.remove('active'));
      
      const internalLinksBtn = Array.from(tabButtons).find(btn => 
        btn.getAttribute('onclick')?.includes("'internal-links'")
      );
      if (internalLinksBtn) {
        internalLinksBtn.classList.add('active');
      }
      
      console.log('[INTERNAL-LINKS] ✅ 내부링크 탭 열기 성공');
    } else {
      console.error('[INTERNAL-LINKS] ❌ 내부링크 탭을 찾을 수 없습니다');
      alert('❌ 내부링크 관리 탭을 찾을 수 없습니다. 앱을 재시작해주세요.');
    }
  }
}

// 전역 스코프에 함수 등록
if (typeof window !== 'undefined') {
  window.openInternalLinksManagerModal = openInternalLinksManagerModal;
  console.log('[INTERNAL-LINKS] ✅ 전역 함수 등록 완료');
}













