const { loadEnvFromFile } = require('./dist/env.js');
const env = loadEnvFromFile();
const auth = Buffer.from(env.WORDPRESS_USERNAME + ':' + env.WORDPRESS_PASSWORD).toString('base64');

fetch('https://leadernam.com/wp-json/wp/v2/posts/3875', { 
  headers: { 'Authorization': 'Basic ' + auth } 
}).then(r => r.json()).then(d => {
  const content = d.content.rendered;
  console.log('=== 최신 글 (ID 3875) ===');
  console.log('제목:', d.title.rendered);
  console.log('');
  console.log('📋 마크다운 아티팩트 체크:');
  console.log('  `html:', content.includes('`html') ? '❌ 있음' : '✅ 없음');
  console.log('  ```:', content.includes('```') ? '❌ 있음' : '✅ 없음');
  console.log('');
  console.log('🖼️ 섹션 이미지:');
  const sectionImgCount = (content.match(/section-image/g) || []).length;
  console.log('  개수:', sectionImgCount);
  console.log('');
  console.log('🎨 스타일 체크:');
  console.log('  !important:', content.includes('!important') ? '✅ 있음' : '❌ 없음');
  console.log('  H2 배경:', content.includes('background: #1e293b !important') ? '✅ 적용' : '❌ 미적용');
  console.log('');
  console.log('🖼️ 섹션 이미지 src:');
  // section-image 텍스트 위치 찾기
  const idx = content.indexOf('section-image');
  if (idx > -1) {
    console.log('  첫 번째 section-image 주변:');
    console.log('  ' + content.substring(idx - 20, idx + 200));
  }
  
  // 모든 img src 출력
  console.log('');
  console.log('🖼️ 모든 이미지 URLs:');
  const allImgs = content.match(/src="[^"]+"/g);
  if (allImgs) {
    allImgs.slice(0, 8).forEach((src, i) => console.log(`  ${i+1}. ${src.substring(0, 80)}`));
  }
});

