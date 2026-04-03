/**
 * 블로그스팟 글 생성 테스트 - 결과 저장
 * 키워드: 유아인 복귀
 */

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '.env') });

async function runTest() {
  console.log('🔥 블로그스팟 글 생성 테스트 시작');
  console.log('📌 키워드: 유아인 복귀');
  console.log('📌 플랫폼: blogspot\n');
  
  try {
    const { generateUltimateMaxModeArticleFinal } = require('./dist/core/ultimate-final-functions');
    
    const payload = {
      topic: '유아인 복귀',
      platform: 'blogspot',
      skipImages: true,
      fastMode: true,
    };
    
    const onLog = (msg) => console.log(msg);
    
    const result = await generateUltimateMaxModeArticleFinal(payload, process.env, onLog);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ 생성 완료!');
    console.log('='.repeat(60));
    console.log('📝 제목:', result.title);
    console.log('🏷️ 태그:', result.labels?.join(', ') || '없음');
    console.log('📄 글자수:', result.html?.length || 0, '자');
    
    // 결과를 파일로 저장
    fs.writeFileSync('test-result.html', result.html || '', 'utf-8');
    fs.writeFileSync('test-result.json', JSON.stringify({
      title: result.title,
      labels: result.labels,
      htmlLength: result.html?.length,
      thumbnail: result.thumbnail
    }, null, 2), 'utf-8');
    
    console.log('\n📁 결과 저장됨: test-result.html, test-result.json');
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  }
}

runTest();
