/**
 * 🎨 Blogger 테마 CSS 자동 주입 CLI
 * 
 * 사용법:
 *   npx ts-node inject-theme-css.ts
 * 
 * 이 스크립트는:
 * 1. Puppeteer 브라우저를 열고
 * 2. Google 로그인을 기다린 후
 * 3. Blogger 테마에 커스텀 CSS를 자동 주입합니다.
 */

import { injectCustomCSSToTheme } from './src/core/blogger-theme-injector';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// 환경변수 로드
function loadEnv(): string | null {
  // 1. 사용자 데이터 디렉토리에서 로드 시도
  const userDataDir = path.join(os.homedir(), 'AppData', 'Roaming', 'blogger-gpt-cli');
  const userEnvPath = path.join(userDataDir, '.env');
  
  if (fs.existsSync(userEnvPath)) {
    dotenv.config({ path: userEnvPath });
    console.log(`[ENV] 로드: ${userEnvPath}`);
  }
  
  // 2. 현재 디렉토리에서도 로드
  const localEnvPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(localEnvPath)) {
    dotenv.config({ path: localEnvPath, override: true });
  }
  
  // Blog ID 찾기
  const blogId = process.env['BLOG_ID'] || 
                 process.env['BLOGGER_BLOG_ID'] || 
                 process.env['GOOGLE_BLOG_ID'] ||
                 process.env['blogId'];
  
  return blogId || null;
}

async function main() {
  console.log('🎨 ===================================');
  console.log('   Blogger 테마 CSS 자동 주입기');
  console.log('===================================\n');
  
  const blogId = loadEnv();
  
  if (!blogId) {
    console.error('❌ Blog ID를 찾을 수 없습니다.');
    console.error('   .env 파일에 BLOG_ID를 설정해주세요.');
    process.exit(1);
  }
  
  console.log(`📌 Blog ID: ${blogId}\n`);
  console.log('🔐 브라우저가 열리면 Google 계정으로 로그인해주세요.');
  console.log('   로그인 후 자동으로 CSS가 주입됩니다.\n');
  
  const result = await injectCustomCSSToTheme({
    blogId,
    headless: false, // 브라우저 표시 (로그인 필요)
    onLog: (msg) => console.log(msg)
  });
  
  console.log('\n===================================');
  if (result.ok) {
    console.log('✅ 성공:', result.message);
    console.log('\n🎉 이제 새로 발행하는 글에 커스텀 스킨이 적용됩니다!');
  } else {
    console.log('❌ 실패:', result.message);
    if (result.error) {
      console.log('   오류:', result.error);
    }
  }
  console.log('===================================\n');
}

main().catch(console.error);

