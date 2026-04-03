// 실제 사용자 테스트 - 전체 워크플로우
// 키워드: 2026 월드컵 조추첨

const { generateUltimateMaxModeArticleFinal } = require('./dist/core/ultimate-final-functions.js');
const { publishToWordPress } = require('./dist/wordpress/wordpress-publisher.js');
const { loadEnvFromFile } = require('./dist/env.js');

async function realUserTest() {
  const startTime = Date.now();
  
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        🏆 실제 사용자 테스트 - 2026 월드컵 조추첨             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  
  const env = loadEnvFromFile();
  
  // 워드프레스 설정
  const wpUrl = env.wordpressSiteUrl || env.WORDPRESS_SITE_URL;
  const wpUser = env.wordpressUsername || env.WORDPRESS_USERNAME;
  const wpPass = env.wordpressPassword || env.WORDPRESS_PASSWORD;
  
  console.log('📋 설정 확인:');
  console.log('   워드프레스:', wpUrl);
  console.log('   OpenAI:', env.openaiKey ? '✅' : '❌');
  console.log('   Pexels:', env.pexelsApiKey ? '✅' : '❌');
  console.log('   네이버 API:', env.naverClientId ? '✅' : '❌');
  console.log('');
  
  const payload = {
    topic: '2026 월드컵 조추첨',
    platform: 'wordpress',
  };
  
  const logs = [];
  const onLog = (msg) => {
    logs.push(msg);
    console.log('[📝]', msg);
  };
  
  try {
    // ═══════════════════════════════════════════════════════════════
    // 1단계: 콘텐츠 생성
    // ═══════════════════════════════════════════════════════════════
    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│  1️⃣  콘텐츠 생성 중...                                       │');
    console.log('└─────────────────────────────────────────────────────────────┘');
    console.log('');
    
    const genStartTime = Date.now();
    const result = await generateUltimateMaxModeArticleFinal(payload, env, onLog);
    const genDuration = ((Date.now() - genStartTime) / 1000).toFixed(1);
    
    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│  ✅ 콘텐츠 생성 완료!                                         │');
    console.log('└─────────────────────────────────────────────────────────────┘');
    console.log('');
    console.log('   📝 제목:', result.title);
    console.log('   📄 HTML:', result.html.length.toLocaleString(), '자');
    console.log('   🏷️ 태그:', result.labels.slice(0, 5).join(', '), '...');
    console.log('   🖼️ 썸네일:', result.thumbnail ? '✅ 생성됨' : '❌ 없음');
    console.log('   ⏱️ 소요 시간:', genDuration, '초');
    console.log('');
    
    // ═══════════════════════════════════════════════════════════════
    // 2단계: 워드프레스 발행
    // ═══════════════════════════════════════════════════════════════
    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│  2️⃣  워드프레스 발행 중...                                    │');
    console.log('└─────────────────────────────────────────────────────────────┘');
    console.log('');
    
    const pubStartTime = Date.now();
    const publishResult = await publishToWordPress({
      title: result.title,
      content: result.html,
      status: 'draft', // 임시저장으로 발행
      tags: result.labels.slice(0, 10),
      siteUrl: wpUrl,
      username: wpUser,
      password: wpPass,
      thumbnailUrl: result.thumbnail,
    }, onLog);
    const pubDuration = ((Date.now() - pubStartTime) / 1000).toFixed(1);
    
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // ═══════════════════════════════════════════════════════════════
    // 결과 요약
    // ═══════════════════════════════════════════════════════════════
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    🎉 발행 완료!                              ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║                                                              ║');
    console.log('║  📝 제목:', result.title.padEnd(45), '║');
    console.log('║                                                              ║');
    console.log('║  🔗 URL:', (publishResult.url || 'N/A').substring(0, 50).padEnd(48), '║');
    console.log('║                                                              ║');
    console.log('║  📊 상세:                                                     ║');
    console.log('║     - 게시물 ID:', String(publishResult.id || 'N/A').padEnd(40), '║');
    console.log('║     - 상태:', (publishResult.ok ? '✅ 성공' : '❌ 실패').padEnd(42), '║');
    console.log('║     - 썸네일:', (publishResult.thumbnail ? '✅ 업로드됨' : '❌ 없음').padEnd(40), '║');
    console.log('║     - 콘텐츠:', (result.html.length.toLocaleString() + '자').padEnd(40), '║');
    console.log('║     - 태그:', (result.labels.length + '개').padEnd(42), '║');
    console.log('║                                                              ║');
    console.log('║  ⏱️ 소요 시간:                                                ║');
    console.log('║     - 콘텐츠 생성:', (genDuration + '초').padEnd(38), '║');
    console.log('║     - 워드프레스 발행:', (pubDuration + '초').padEnd(34), '║');
    console.log('║     - 총 소요 시간:', (totalDuration + '초').padEnd(37), '║');
    console.log('║                                                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    
    return { success: true, result, publishResult };
    
  } catch (error) {
    console.error('');
    console.error('╔══════════════════════════════════════════════════════════════╗');
    console.error('║                    ❌ 오류 발생                               ║');
    console.error('╚══════════════════════════════════════════════════════════════╝');
    console.error('');
    console.error('   오류:', error.message);
    console.error('');
    if (error.stack) {
      console.error('   스택:', error.stack.split('\n').slice(0, 3).join('\n         '));
    }
    console.error('');
    
    return { success: false, error: error.message };
  }
}

realUserTest();





