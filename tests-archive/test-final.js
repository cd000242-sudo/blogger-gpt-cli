// 최종 테스트 - 2026 월드컵 조추첨 결과 + 섹션 이미지 5개 + 즉시발행
const { generateUltimateMaxModeArticleFinal } = require('./dist/core/ultimate-final-functions.js');
const { publishToWordPress } = require('./dist/wordpress/wordpress-publisher.js');
const { loadEnvFromFile } = require('./dist/env.js');

async function finalTest() {
  const startTime = Date.now();
  
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   🏆 최종 테스트 - 2026 월드컵 조추첨 결과 (즉시발행)          ║');
  console.log('║   - 섹션별 이미지 5개                                         ║');
  console.log('║   - !important 스킨                                          ║');
  console.log('║   - 마크다운 아티팩트 제거                                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  
  const env = loadEnvFromFile();
  
  const wpUrl = env.wordpressSiteUrl || env.WORDPRESS_SITE_URL;
  const wpUser = env.wordpressUsername || env.WORDPRESS_USERNAME;
  const wpPass = env.wordpressPassword || env.WORDPRESS_PASSWORD;
  
  // 최신 정보 반영을 위해 키워드를 구체적으로
  const payload = {
    topic: '2026 월드컵 조추첨 결과 한국 조편성',
    platform: 'wordpress',
  };
  
  const onLog = (msg) => console.log('[📝]', msg);
  
  try {
    console.log('');
    console.log('┌───────────────────────────────────────────────────────────────┐');
    console.log('│  1️⃣  콘텐츠 생성 중... (섹션 이미지 포함)                      │');
    console.log('└───────────────────────────────────────────────────────────────┘');
    console.log('');
    
    const result = await generateUltimateMaxModeArticleFinal(payload, env, onLog);
    
    console.log('');
    console.log('   ✅ 콘텐츠 생성 완료!');
    console.log('   📝 제목:', result.title);
    console.log('   📄 HTML:', result.html.length.toLocaleString(), '자');
    console.log('   🖼️ 섹션 이미지 포함 여부:', result.html.includes('section-image') ? '✅' : '❌');
    console.log('   🖼️ 썸네일:', result.thumbnail ? '✅' : '❌');
    console.log('');
    
    // 마크다운 아티팩트 체크
    const hasMarkdownArtifact = result.html.includes('`html') || result.html.includes('```');
    console.log('   📋 마크다운 아티팩트:', hasMarkdownArtifact ? '❌ 있음' : '✅ 없음');
    console.log('');
    
    console.log('');
    console.log('┌───────────────────────────────────────────────────────────────┐');
    console.log('│  2️⃣  워드프레스 즉시발행 중...                                 │');
    console.log('└───────────────────────────────────────────────────────────────┘');
    console.log('');
    
    const publishResult = await publishToWordPress({
      title: result.title,
      content: result.html,
      status: 'publish', // 🔥 즉시발행
      tags: result.labels.slice(0, 10),
      siteUrl: wpUrl,
      username: wpUser,
      password: wpPass,
      thumbnailUrl: result.thumbnail,
    }, onLog);
    
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    🎉 발행 완료!                              ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║                                                              ║');
    console.log('║  📝 제목:', result.title.substring(0, 40).padEnd(45), '║');
    console.log('║                                                              ║');
    console.log('║  🔗 URL:', (publishResult.url || 'N/A').substring(0, 50).padEnd(48), '║');
    console.log('║                                                              ║');
    console.log('║  📊 상세:                                                     ║');
    console.log('║     - 게시물 ID:', String(publishResult.id || 'N/A').padEnd(40), '║');
    console.log('║     - 상태:', (publishResult.ok ? '✅ 성공 (즉시발행)' : '❌ 실패').padEnd(37), '║');
    console.log('║     - 썸네일:', (publishResult.thumbnail ? '✅' : '❌').padEnd(40), '║');
    console.log('║     - 총 소요 시간:', (totalDuration + '초').padEnd(37), '║');
    console.log('║                                                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    
    // 발행된 글의 실제 URL 가져오기
    const auth = Buffer.from(wpUser + ':' + wpPass).toString('base64');
    const postData = await fetch(`${wpUrl}/wp-json/wp/v2/posts/${publishResult.id}`, {
      headers: { 'Authorization': 'Basic ' + auth }
    }).then(r => r.json());
    
    console.log('🌐 실제 페이지 URL:', postData.link);
    console.log('');
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
    if (error.stack) {
      console.error('스택:', error.stack.split('\\n').slice(0, 3).join('\\n'));
    }
  }
}

finalTest();





