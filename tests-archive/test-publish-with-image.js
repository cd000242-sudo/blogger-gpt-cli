// 이미지 포함 워드프레스 발행 테스트
const { generateUltimateMaxModeArticleFinal } = require('./dist/core/ultimate-final-functions.js');
const { publishToWordPress } = require('./dist/wordpress/wordpress-publisher.js');
const { loadEnvFromFile } = require('./dist/env.js');

async function testPublishWithImage() {
  console.log('');
  console.log('============================================');
  console.log('   2026 월드컵 조추첨 결과 - 이미지 포함 발행');
  console.log('============================================');
  console.log('');
  
  const env = loadEnvFromFile();
  
  // 워드프레스 설정
  const wpUrl = env.wordpressSiteUrl || env.WORDPRESS_SITE_URL;
  const wpUser = env.wordpressUsername || env.WORDPRESS_USERNAME;
  const wpPass = env.wordpressPassword || env.WORDPRESS_PASSWORD;
  
  console.log('🔑 워드프레스:', wpUrl);
  console.log('');
  
  const payload = {
    topic: '2026 월드컵 조추첨 결과',
    platform: 'wordpress',
  };
  
  const onLog = (msg) => console.log('[LOG]', msg);
  
  try {
    console.log('🚀 1단계: 콘텐츠 생성...');
    console.log('');
    
    const result = await generateUltimateMaxModeArticleFinal(payload, env, onLog);
    
    console.log('');
    console.log('✅ 콘텐츠 생성 완료!');
    console.log('   제목:', result.title);
    console.log('   HTML 길이:', result.html.length, '자');
    console.log('   썸네일:', result.thumbnail ? '있음 (' + result.thumbnail.substring(0, 30) + '...)' : '없음');
    console.log('');
    
    console.log('🚀 2단계: 워드프레스 발행...');
    console.log('');
    
    const publishResult = await publishToWordPress({
      title: result.title,
      content: result.html,
      status: 'draft', // 임시저장으로 발행
      categories: [],
      tags: result.labels.slice(0, 10), // 태그 10개까지
      siteUrl: wpUrl,
      username: wpUser,
      password: wpPass,
      thumbnailUrl: result.thumbnail, // 썸네일 이미지
    }, onLog);
    
    console.log('');
    console.log('============================================');
    console.log('   발행 완료!');
    console.log('============================================');
    console.log('');
    console.log('🔗 게시물 URL:', publishResult.url || 'N/A');
    console.log('📝 게시물 ID:', publishResult.id);
    console.log('📊 상태:', publishResult.ok ? '✅ 성공' : '❌ 실패');
    if (publishResult.thumbnail) {
      console.log('🖼️ 썸네일:', publishResult.thumbnail ? '✅ 업로드됨' : '❌ 없음');
    }
    
  } catch (error) {
    console.error('');
    console.error('❌ 오류:', error.message);
    if (error.stack) {
      console.error('스택:', error.stack.split('\n').slice(0, 3).join('\n'));
    }
  }
}

testPublishWithImage();





