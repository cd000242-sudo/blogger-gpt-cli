// ============================================
// 내부링크 관리 탭 디버깅 스크립트
// ============================================
// 
// 사용방법:
// 1. 앱을 실행하고 F12로 개발자 도구 열기
// 2. Console 탭에서 이 스크립트 내용을 붙여넣기
// 3. Enter 키를 눌러 실행
//
// 또는 터미널에서:
// node debug-internal-links.js
// ============================================

console.log('🔍 내부링크 탭 디버깅 시작...');

// 1. 탭 버튼 확인
const tabButtons = document.querySelectorAll('.tab-btn');
console.log(`📍 탭 버튼 개수: ${tabButtons.length}`);
tabButtons.forEach((btn, idx) => {
  const onclick = btn.getAttribute('onclick');
  const text = btn.textContent.trim();
  console.log(`  ${idx + 1}. ${text} - ${onclick}`);
});

// 2. 내부링크 탭 버튼 찾기
const internalLinksBtn = Array.from(tabButtons).find(btn => 
  btn.getAttribute('onclick')?.includes("'internal-links'")
);

if (internalLinksBtn) {
  console.log('✅ 내부링크 탭 버튼 발견!');
  console.log('   텍스트:', internalLinksBtn.textContent.trim());
  console.log('   onclick:', internalLinksBtn.getAttribute('onclick'));
} else {
  console.error('❌ 내부링크 탭 버튼을 찾을 수 없습니다!');
}

// 3. 내부링크 탭 div 확인
const internalLinksTab = document.getElementById('internal-links-tab');
if (internalLinksTab) {
  console.log('✅ 내부링크 탭 div 발견!');
  console.log('   display:', internalLinksTab.style.display);
  console.log('   innerHTML 길이:', internalLinksTab.innerHTML.length);
} else {
  console.error('❌ 내부링크 탭 div를 찾을 수 없습니다!');
}

// 4. showTab 함수 확인
if (typeof showTab === 'function') {
  console.log('✅ showTab 함수 존재');
} else {
  console.error('❌ showTab 함수를 찾을 수 없습니다!');
}

// 5. 강제로 내부링크 탭 열기
console.log('\n🚀 내부링크 탭을 강제로 엽니다...');
try {
  // 모든 탭 숨기기
  const allTabs = document.querySelectorAll('.tab-content, [id$="-tab"]');
  allTabs.forEach(tab => {
    tab.style.display = 'none';
  });
  
  // 내부링크 탭만 표시
  if (internalLinksTab) {
    internalLinksTab.style.display = 'block';
    console.log('✅ 내부링크 탭을 성공적으로 열었습니다!');
    
    // 탭 버튼 활성화
    tabButtons.forEach(btn => btn.classList.remove('active'));
    if (internalLinksBtn) {
      internalLinksBtn.classList.add('active');
    }
  } else {
    console.error('❌ 내부링크 탭을 열 수 없습니다!');
  }
} catch (error) {
  console.error('❌ 오류 발생:', error);
}

console.log('\n✅ 디버깅 완료!');
console.log('📝 문제가 있으면 위 로그를 확인하세요.');













