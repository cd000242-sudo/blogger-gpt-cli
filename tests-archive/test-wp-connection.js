// 워드프레스 연결 테스트
const { loadEnvFromFile } = require('./dist/env.js');

async function testConnection() {
  console.log('');
  console.log('============================================');
  console.log('   워드프레스 연결 테스트');
  console.log('============================================');
  console.log('');
  
  const env = loadEnvFromFile();
  
  const wpUrl = env.wordpressSiteUrl || env.WORDPRESS_SITE_URL;
  const wpUser = env.wordpressUsername || env.WORDPRESS_USERNAME;
  const wpPass = env.wordpressPassword || env.WORDPRESS_PASSWORD;
  
  console.log('🔑 설정:');
  console.log('   URL:', wpUrl);
  console.log('   사용자:', wpUser);
  console.log('   비밀번호:', wpPass ? '✅ ' + wpPass.substring(0, 10) + '...' : '❌ 없음');
  console.log('');
  
  // Basic Auth 헤더 생성
  const auth = Buffer.from(`${wpUser}:${wpPass}`).toString('base64');
  
  console.log('🔄 연결 테스트 중...');
  
  try {
    const response = await fetch(`${wpUrl}/wp-json/wp/v2/posts?per_page=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('   응답 상태:', response.status, response.statusText);
    
    if (response.ok) {
      console.log('');
      console.log('✅ 워드프레스 연결 성공!');
      console.log('');
      return true;
    } else {
      const errorText = await response.text();
      console.log('   오류:', errorText.substring(0, 200));
      console.log('');
      console.log('❌ 워드프레스 연결 실패');
      return false;
    }
  } catch (error) {
    console.log('❌ 연결 오류:', error.message);
    return false;
  }
}

testConnection();





