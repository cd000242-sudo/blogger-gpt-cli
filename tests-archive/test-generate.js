const { generateUltimateMaxModeArticleFinal } = require('./dist/core/ultimate-final-functions');
const { loadEnvFromFile } = require('./dist/env');
const fs = require('fs');
const path = require('path');

async function testGenerateAndPreview() {
  console.log('🔥 콘텐츠 생성 테스트 시작...');
  
  const env = loadEnvFromFile();
  
  // 테스트 페이로드 - Pollinations (무료, 빠름)
  const payload = {
    topic: '손흥민 토트넘 복귀',
    keywords: [{ keyword: '손흥민 토트넘 복귀', title: null }],
    platform: 'blogspot',
    h2ImageSource: 'pollinations', // 테스트용 pollinations (무료)
    h2ImageSections: [1, 2, 3],
    publishType: 'publish',
    skipImages: true, // 빠른 테스트용
    fastMode: true
  };
  
  console.log('📋 Payload:', JSON.stringify({
    topic: payload.topic,
    h2ImageSource: payload.h2ImageSource,
    publishType: payload.publishType
  }, null, 2));
  
  try {
    const result = await generateUltimateMaxModeArticleFinal(payload, env, (msg) => console.log(msg));
    
    // HTML 파일로 저장
    const htmlFile = path.join(__dirname, 'test-output.html');
    const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${result.title}</title></head>
<body style="max-width: 800px; margin: 0 auto; padding: 20px; font-family: -apple-system, sans-serif;">
${result.html}
</body></html>`;
    
    fs.writeFileSync(htmlFile, fullHtml, 'utf8');
    console.log('\n✅ HTML 파일 저장됨:', htmlFile);
    console.log('📊 제목:', result.title);
    console.log('📊 HTML 길이:', result.html.length, '자');
    console.log('📊 썸네일:', result.thumbnail ? '생성됨' : '없음');
    
    // CTA 확인 - 인라인 스타일로 변경된 CTA
    const ctaGreenCount = (result.html.match(/#059669/g) || []).length;
    const ctaRedCount = (result.html.match(/#dc2626/g) || []).length;
    console.log('📊 CTA 초록색:', ctaGreenCount, '개');
    console.log('📊 CTA 빨간색:', ctaRedCount, '개');
    
    // 인라인 스타일 확인
    const inlineStyleCount = (result.html.match(/style="/g) || []).length;
    console.log('📊 인라인 스타일 수:', inlineStyleCount);
    
    // H2 스타일 확인
    const h2WithStyle = (result.html.match(/<h2[^>]*class="h2"/g) || []).length;
    console.log('📊 H2 태그 수:', h2WithStyle);
    
    return result;
  } catch (error) {
    console.error('❌ 에러:', error.message);
    throw error;
  }
}

testGenerateAndPreview()
  .then(() => {
    console.log('\n🎉 테스트 완료!');
    process.exit(0);
  })
  .catch(err => {
    console.error('테스트 실패:', err);
    process.exit(1);
  });
