const { loadEnvFromFile } = require('./dist/env.js');
const env = loadEnvFromFile();
const auth = Buffer.from(env.WORDPRESS_USERNAME + ':' + env.WORDPRESS_PASSWORD).toString('base64');

fetch('https://leadernam.com/wp-json/wp/v2/posts/3872', { 
  headers: { 'Authorization': 'Basic ' + auth } 
}).then(r => r.json()).then(d => {
  const content = d.content.rendered;
  
  // H2 태그 찾기
  const h2Match = content.match(/<h2[^>]*>/gi);
  console.log('=== H2 태그 확인 ===');
  if (h2Match) {
    h2Match.slice(0, 3).forEach((h, i) => console.log((i+1) + '.', h.substring(0, 200)));
  }
  
  // 인라인 스타일 확인
  console.log('');
  console.log('=== 인라인 스타일 확인 ===');
  console.log('style= 포함:', content.includes('style=') ? '✅ 있음' : '❌ 없음');
  console.log('background: #1e293b:', content.includes('background: #1e293b') ? '✅ 있음' : '❌ 없음');
  
  // <div class="wp-clean-modern" style= 찾기
  const divMatch = content.match(/<div[^>]*wp-clean-modern[^>]*>/i);
  console.log('');
  console.log('=== wp-clean-modern 컨테이너 ===');
  if (divMatch) {
    console.log(divMatch[0].substring(0, 300));
  } else {
    console.log('❌ wp-clean-modern 컨테이너 없음');
  }
});





