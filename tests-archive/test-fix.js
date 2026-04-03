// 수정사항 테스트 - 짧은 제목 + 테마 친화적 스타일 + 모바일
const { generateUltimateMaxModeArticleFinal } = require('./dist/core/ultimate-final-functions.js');
const { publishToWordPress } = require('./dist/wordpress/wordpress-publisher.js');
const { loadEnvFromFile } = require('./dist/env.js');

async function test() {
  console.log('');
  console.log('🔧 수정사항 테스트');
  console.log('   - 제목 25자 이내');
  console.log('   - 테마 친화적 스타일 (넓은 레이아웃)');
  console.log('   - 모바일 최적화');
  console.log('');
  
  const env = loadEnvFromFile();
  
  const payload = {
    topic: '2026 월드컵 조추첨 결과 한국 A조',
    platform: 'wordpress',
  };
  
  const onLog = (msg) => console.log('[📝]', msg);
  
  try {
    const result = await generateUltimateMaxModeArticleFinal(payload, env, onLog);
    
    console.log('');
    console.log('=== 결과 ===');
    console.log('📝 제목:', result.title);
    console.log('📏 제목 길이:', result.title.length, '자');
    console.log('📄 HTML:', result.html.length.toLocaleString(), '자');
    
    // bgpt-content 클래스 확인
    console.log('🎨 테마 친화적 클래스:', result.html.includes('bgpt-content') ? '✅' : '❌');
    console.log('🎨 clamp() 반응형:', result.html.includes('clamp(') ? '✅' : '❌');
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





