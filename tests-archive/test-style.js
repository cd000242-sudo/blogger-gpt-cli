// 진한 박스 색상 + SVG 썸네일 테스트
const { generateUltimateMaxModeArticleFinal } = require('./dist/core/ultimate-final-functions.js');
const { publishToWordPress } = require('./dist/wordpress/wordpress-publisher.js');
const { loadEnvFromFile } = require('./dist/env.js');

async function test() {
  console.log('');
  console.log('🎨 스타일 테스트');
  console.log('   - H2/H3 진한 배경색');
  console.log('   - SVG 자동 썸네일');
  console.log('');
  
  const env = loadEnvFromFile();
  
  const payload = {
    topic: '2026 월드컵 조추첨 결과 한국',
    platform: 'wordpress',
  };
  
  const onLog = (msg) => console.log('[📝]', msg);
  
  try {
    const result = await generateUltimateMaxModeArticleFinal(payload, env, onLog);
    
    console.log('');
    console.log('=== 결과 ===');
    console.log('📝 제목:', result.title);
    console.log('🎨 H2 배경 #1e293b:', result.html.includes('#1e293b') ? '✅' : '❌');
    console.log('🎨 H3 배경 #334155:', result.html.includes('#334155') ? '✅' : '❌');
    console.log('🖼️ SVG 썸네일:', result.thumbnail.startsWith('data:image/svg') ? '✅ SVG' : (result.thumbnail ? '❌ 다른 형식' : '❌ 없음'));
    console.log('');
    
    // 발행
    console.log('📤 워드프레스 발행 중...');
    const publishResult = await publishToWordPress({
      title: result.title,
      content: result.html,
      status: 'publish',
      tags: result.labels.slice(0, 5),
      siteUrl: env.wordpressSiteUrl || env.WORDPRESS_SITE_URL,
      username: env.wordpressUsername || env.WORDPRESS_USERNAME,
      password: env.wordpressPassword || env.WORDPRESS_PASSWORD,
      thumbnailUrl: result.thumbnail,
    }, onLog);
    
    // 실제 URL 가져오기
    const auth = Buffer.from((env.wordpressUsername || env.WORDPRESS_USERNAME) + ':' + (env.wordpressPassword || env.WORDPRESS_PASSWORD)).toString('base64');
    const postData = await fetch(`${env.wordpressSiteUrl || env.WORDPRESS_SITE_URL}/wp-json/wp/v2/posts/${publishResult.id}`, {
      headers: { 'Authorization': 'Basic ' + auth }
    }).then(r => r.json());
    
    console.log('');
    console.log('✅ 발행 완료!');
    console.log('🆔 ID:', publishResult.id);
    console.log('🌐 URL:', postData.link);
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  }
}

test();





