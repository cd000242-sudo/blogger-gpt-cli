// applyInlineStyles 함수 테스트
const fs = require('fs');
const path = require('path');

// blogger-publisher.js의 applyInlineStyles 함수 직접 테스트
const bloggerPublisher = require('./dist/core/blogger-publisher.js');

// 테스트용 HTML (클래스 기반)
const testHtml = `
<div class="bgpt-content">
  <h2 class="h2" id="section-0">테스트 제목 H2</h2>
  <h3 class="h3">테스트 소제목 H3</h3>
  <p>테스트 문단입니다.</p>
  <ul>
    <li>항목 1</li>
    <li>항목 2</li>
  </ul>
  <table>
    <thead><tr><th>헤더1</th><th>헤더2</th></tr></thead>
    <tbody><tr><td>값1</td><td>값2</td></tr></tbody>
  </table>
</div>
`;

console.log('🔍 applyInlineStyles 테스트...\n');
console.log('원본 HTML:');
console.log(testHtml.substring(0, 300) + '...\n');

// applyInlineStyles 함수 찾기
if (typeof bloggerPublisher.applyInlineStyles === 'function') {
  const styledHtml = bloggerPublisher.applyInlineStyles(testHtml);
  console.log('✅ applyInlineStyles 함수 실행 성공!');
  console.log('\n변환된 HTML (일부):');
  console.log(styledHtml.substring(0, 500) + '...\n');
  
  // 인라인 스타일 확인
  const styleCount = (styledHtml.match(/style="/g) || []).length;
  console.log('📊 인라인 스타일 수:', styleCount);
  
  // H2 스타일 확인
  if (styledHtml.includes('background: #1e293b')) {
    console.log('✅ H2 배경색 적용됨');
  } else {
    console.log('❌ H2 배경색 미적용');
  }
  
  // H3 스타일 확인
  if (styledHtml.includes('background: #f1f5f9')) {
    console.log('✅ H3 배경색 적용됨');
  } else {
    console.log('❌ H3 배경색 미적용');
  }
} else {
  console.log('⚠️ applyInlineStyles 함수가 export되지 않음');
  console.log('  모듈 내보내기 목록:', Object.keys(bloggerPublisher).join(', '));
}



