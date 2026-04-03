/**
 * 끝판왕 블로그 자동화 테스트
 */

import { generateUltimateBlog } from './src/core/ultimate-blog';
import * as fs from 'fs';

async function test() {
  console.log('🚀 끝판왕 블로그 테스트 시작!\n');
  
  const keyword = '민생회복 2차 지원금';
  
  try {
    const html = await generateUltimateBlog(keyword);
    
    console.log('\n✅ 테스트 성공!');
    console.log(`📊 생성된 HTML 길이: ${html.length}자`);
    
    // HTML 파일로 저장
    fs.writeFileSync('test-output.html', html, 'utf-8');
    console.log('\n💾 test-output.html 파일로 저장됨');
    
  } catch (error) {
    console.error('\n❌ 테스트 실패:', error);
    process.exit(1);
  }
}

test();













