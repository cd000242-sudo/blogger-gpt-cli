// 2026 월드컵 조추첨 결과 - 크롤링 정보 100% 반영 테스트
const { generateUltimateMaxModeArticleFinal } = require('./dist/core/ultimate-final-functions.js');
const { publishToWordPress } = require('./dist/wordpress/wordpress-publisher.js');
const { loadEnvFromFile } = require('./dist/env.js');

async function test() {
  const startTime = Date.now();
  
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   🏆 2026 월드컵 조추첨 결과 - 크롤링 100% 반영 테스트        ║');
  console.log('║   키워드: 2026 월드컵 조추첨 결과 한국 A조 멕시코 남아공       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  
  const env = loadEnvFromFile();
  
  // 매우 구체적인 키워드 (실제 조추첨 결과 포함)
  const payload = {
    topic: '2026 월드컵 조추첨 결과 한국 A조 멕시코 남아공',
    platform: 'wordpress',
  };
  
  const onLog = (msg) => console.log('[📝]', msg);
  
  try {
    console.log('1️⃣ 콘텐츠 생성 중... (크롤링 팩트 100% 반영)');
    console.log('');
    
    const result = await generateUltimateMaxModeArticleFinal(payload, env, onLog);
    
    console.log('');
    console.log('✅ 콘텐츠 생성 완료!');
    console.log('📝 제목:', result.title);
    console.log('📄 HTML:', result.html.length.toLocaleString(), '자');
    
    // A조 멤버 체크
    const hasKorea = result.html.includes('한국') || result.html.includes('대한민국');
    const hasMexico = result.html.includes('멕시코');
    const hasSouthAfrica = result.html.includes('남아공') || result.html.includes('남아프리카');
    const hasGroupA = result.html.includes('A조');
    
    console.log('');
    console.log('📋 조추첨 결과 반영 체크:');
    console.log('   - 한국:', hasKorea ? '✅' : '❌');
    console.log('   - A조:', hasGroupA ? '✅' : '❌');
    console.log('   - 멕시코:', hasMexico ? '✅' : '❌');
    console.log('   - 남아공:', hasSouthAfrica ? '✅' : '❌');
    console.log('');
    
    console.log('2️⃣ 워드프레스 즉시발행 중...');
    console.log('');
    
    const publishResult = await publishToWordPress({
      title: result.title,
      content: result.html,
      status: 'publish',
      tags: result.labels.slice(0, 10),
      siteUrl: env.wordpressSiteUrl || env.WORDPRESS_SITE_URL,
      username: env.wordpressUsername || env.WORDPRESS_USERNAME,
      password: env.wordpressPassword || env.WORDPRESS_PASSWORD,
      thumbnailUrl: result.thumbnail,
    }, onLog);
    
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // 실제 URL 가져오기
    const auth = Buffer.from((env.wordpressUsername || env.WORDPRESS_USERNAME) + ':' + (env.wordpressPassword || env.WORDPRESS_PASSWORD)).toString('base64');
    const postData = await fetch(`${env.wordpressSiteUrl || env.WORDPRESS_SITE_URL}/wp-json/wp/v2/posts/${publishResult.id}`, {
      headers: { 'Authorization': 'Basic ' + auth }
    }).then(r => r.json());
    
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    🎉 발행 완료!                              ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║  📝 제목:', result.title.substring(0, 45).padEnd(50), '║');
    console.log('║  🆔 ID:', String(publishResult.id).padEnd(53), '║');
    console.log('║  ⏱️ 시간:', (totalDuration + '초').padEnd(51), '║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('🌐 URL:', postData.link);
    console.log('');
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  }
}

test();





