/**
 * 🎬 유아인 복귀 - 블로그스팟 발행 테스트
 * 이미지 소스: Nano Banana Pro (Gemini 이미지 생성)
 * 목차 위치 확인 + 내부지침 노출 확인 + CTA 포함
 */

const path = require('path');
const fs = require('fs');

// 환경 변수 로드
function loadEnv() {
  const envPaths = [
    path.join(process.env.APPDATA || '', 'lba', '.env'),
    path.join(process.env.APPDATA || '', 'LEADERNAM Orbit', '.env'),
    path.join(__dirname, '.env'),
  ];
  
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      console.log('📁 .env 로드:', envPath);
      const content = fs.readFileSync(envPath, 'utf-8');
      const vars = {};
      content.split(/\r?\n/).forEach(line => {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
          vars[match[1].trim()] = match[2].trim().replace(/\r$/, '');
        }
      });
      return vars;
    }
  }
  
  throw new Error('.env 파일을 찾을 수 없습니다');
}

// HTML에서 문제점 검사
function checkForIssues(html, title) {
  const issues = [];
  
  // 1. 내부지침 노출 검사
  const internalPhrases = [
    '체류시간',
    '수익으로 연결',
    '실행 단계로 굳혀',
    '노출→클릭→체류→전환',
    '페르소나',
    '프롬프트',
    '크롤링 데이터',
    'AI 감지 방지',
    '글자수 기준',
  ];
  
  for (const phrase of internalPhrases) {
    if (html.includes(phrase)) {
      issues.push(`❌ 내부지침 노출: "${phrase}"`);
    }
  }
  
  // 2. 목차 위치 검사 (H1/썸네일 바로 다음에 와야 함)
  const tocMatch = html.match(/목차|📑|table.of.contents/i);
  const h2Match = html.match(/<h2[^>]*>/i);
  
  if (tocMatch && h2Match) {
    const tocIndex = html.indexOf(tocMatch[0]);
    const h2Index = html.indexOf(h2Match[0]);
    
    if (tocIndex > h2Index) {
      issues.push('❌ 목차 위치 오류: 목차가 H2 본문 뒤에 있음');
    } else {
      console.log('✅ 목차 위치 정상: H2 본문 앞에 배치됨');
    }
  }
  
  // 3. 이미지 확인
  const imgCount = (html.match(/<img[^>]*>/gi) || []).length;
  if (imgCount < 3) {
    issues.push(`⚠️ 이미지 부족: ${imgCount}개 (권장: 3개 이상)`);
  } else {
    console.log(`✅ 이미지 개수 정상: ${imgCount}개`);
  }
  
  // 4. CTA 확인
  const ctaCount = (html.match(/cta|바로가기|확인하세요/gi) || []).length;
  if (ctaCount === 0) {
    issues.push('⚠️ CTA 버튼 없음');
  } else {
    console.log(`✅ CTA 버튼 발견: ${ctaCount}개`);
  }
  
  return issues;
}

async function main() {
  console.log('\n🎬 ===========================================');
  console.log('🎬 유아인 복귀 - 블로그스팟 발행 테스트');
  console.log('🎬 ===========================================\n');
  console.log('📌 키워드: 2025년 유아인 복귀 논란');
  console.log('🖼️ 이미지 소스: Nano Banana Pro (Gemini 이미지 생성)');
  console.log('📝 플랫폼: Blogger (블로그스팟)');
  console.log('🔍 검사 항목: 목차위치, 내부지침노출, 이미지, CTA');
  console.log('');
  
  const startTime = Date.now();
  
  try {
    // 환경 변수 로드
    const env = loadEnv();
    
    console.log('✅ 환경 변수 로드 완료');
    console.log('   - Gemini API:', env.geminiKey || env.GEMINI_API_KEY ? '✅ 있음' : '❌ 없음');
    console.log('   - Blog ID:', env.blogId || env.BLOG_ID ? '✅ 있음' : '❌ 없음');
    console.log('');
    
    // ultimate-final-functions 로드
    const { generateUltimateMaxModeArticleFinal } = require('./src/core/ultimate-final-functions');
    
    // 발행 payload 생성
    const payload = {
      topic: '2025년 유아인 복귀 논란 파묘 감독',  // 🔥 키워드
      keywords: ['유아인', '복귀', '파묘', '장재현', '뱀피르', '승부', '하이파이브'],
      platform: 'blogger',
      contentMode: 'external',
      h2ImageSource: 'nanobananapro', // 🍌 H2 이미지: Nano Banana Pro
      thumbnailSource: 'nanobananapro', // 🍌 썸네일도: Nano Banana Pro
      skipImages: false,
      fastMode: false,
      enableCTA: true,
    };
    
    console.log('📝 콘텐츠 생성 시작...\n');
    console.log('⏱️ 예상 소요 시간: 2-3분 (이미지 생성 포함)');
    console.log('🍌 이미지 생성: Nano Banana Pro (Gemini Imagen API)');
    console.log('');
    
    // 콘텐츠 생성
    const result = await generateUltimateMaxModeArticleFinal(
      payload,
      {
        geminiKey: env.geminiKey || env.GEMINI_API_KEY,
        stabilityApiKey: env.STABILITY_API_KEY,
        pexelsApiKey: env.pexelsApiKey || env.PEXELS_API_KEY,
        naverClientId: env.naverClientId || env.NAVER_CLIENT_ID,
        naverClientSecret: env.naverClientSecret || env.NAVER_CLIENT_SECRET,
      },
      (log) => console.log(log)
    );
    
    const generateTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n✅ 콘텐츠 생성 완료! (' + generateTime + '초)');
    console.log('   - 제목:', result.title);
    console.log('   - 글자수:', result.html.length, '자');
    console.log('   - 썸네일:', result.thumbnail ? '✅ 있음' : '❌ 없음');
    console.log('   - 라벨:', result.labels?.join(', ') || '없음');
    
    // 문제점 검사
    console.log('\n🔍 품질 검사 중...');
    const issues = checkForIssues(result.html, result.title);
    
    if (issues.length > 0) {
      console.log('\n⚠️ 발견된 문제점:');
      issues.forEach(issue => console.log('   ' + issue));
    } else {
      console.log('\n✅ 모든 품질 검사 통과!');
    }
    
    // HTML 파일로 저장 (미리보기용)
    const previewPath = path.join(__dirname, 'verify-blogspot-preview-' + Date.now() + '.html');
    const previewHtml = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${result.title}</title>
  <style>
    body { 
      max-width: 800px; 
      margin: 0 auto; 
      padding: 20px; 
      font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif; 
      background: #f5f5f5;
      line-height: 1.8;
    }
    h1 { 
      color: #1a1a1a; 
      border-bottom: 3px solid #3b82f6; 
      padding-bottom: 15px; 
      font-size: 26px;
    }
    h2 { 
      color: #1a1a1a; 
      border-left: 4px solid #3b82f6; 
      padding-left: 15px; 
      margin-top: 40px;
    }
    h3 { color: #2563eb; }
    img { max-width: 100%; border-radius: 12px; margin: 20px 0; }
    p { color: #333; margin: 15px 0; }
    .thumbnail { 
      width: 100%; 
      max-height: 400px; 
      object-fit: cover; 
      margin-bottom: 30px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    }
    .issues-box {
      background: #fef2f2;
      border: 2px solid #ef4444;
      border-radius: 10px;
      padding: 20px;
      margin: 20px 0;
    }
    .success-box {
      background: #f0fdf4;
      border: 2px solid #22c55e;
      border-radius: 10px;
      padding: 20px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="${issues.length > 0 ? 'issues-box' : 'success-box'}">
    <h3>${issues.length > 0 ? '⚠️ 발견된 문제점' : '✅ 품질 검사 통과'}</h3>
    ${issues.length > 0 ? '<ul>' + issues.map(i => '<li>' + i + '</li>').join('') + '</ul>' : '<p>모든 검사 항목을 통과했습니다.</p>'}
  </div>
  
  <h1>${result.title}</h1>
  ${result.thumbnail ? `<img src="${result.thumbnail}" alt="썸네일" class="thumbnail">` : ''}
  ${result.html}
  
  <hr style="margin: 40px 0;">
  <p style="color: #666; font-size: 14px;">
    📊 생성 통계: ${result.html.length}자 | 생성시간: ${generateTime}초 | 
    이미지: ${(result.html.match(/<img/g) || []).length}개
  </p>
</body>
</html>
`;
    fs.writeFileSync(previewPath, previewHtml, 'utf-8');
    console.log('\n📄 미리보기 HTML 저장:', previewPath);
    
    // 블로그스팟 발행
    console.log('\n📤 블로그스팟 발행 시작...\n');
    
    const { publishToBlogger } = require('./src/core/blogger-publisher');
    
    const blogId = env.blogId || env.BLOG_ID;
    console.log('📌 Blog ID:', blogId);
    
    // 토큰 파일에서 직접 읽기
    const tokenPath = path.join(process.env.APPDATA || '', 'lba', 'blogger-token.json');
    let accessToken = null;
    let refreshToken = null;
    
    if (fs.existsSync(tokenPath)) {
      const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      accessToken = tokenData.access_token;
      refreshToken = tokenData.refresh_token;
      console.log('✅ 토큰 파일 로드:', tokenPath);
    } else {
      console.log('⚠️ 토큰 파일 없음:', tokenPath);
      console.log('⚠️ 먼저 앱에서 Blogger 인증을 해주세요.');
      console.log('\n📄 미리보기만 확인하세요:', previewPath);
      
      // 미리보기 자동 열기
      const { exec } = require('child_process');
      exec(`start "" "${previewPath}"`);
      return;
    }
    
    console.log('\n🚀 발행 중...\n');
    
    const publishResult = await publishToBlogger(
      {
        blogId: blogId,
        googleClientId: env.googleClientId || env.GOOGLE_CLIENT_ID,
        googleClientSecret: env.googleClientSecret || env.GOOGLE_CLIENT_SECRET,
        googleAccessToken: accessToken,
        googleRefreshToken: refreshToken,
      },
      result.title,
      result.html,
      result.thumbnail,
      (log) => console.log(log),
      'publish' // 즉시 발행
    );
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n===========================================');
    if (publishResult.ok) {
      console.log('🎉 발행 성공!');
      console.log('   - URL:', publishResult.url);
      console.log('   - Post ID:', publishResult.postId);
      console.log('   - 총 소요시간:', totalTime + '초');
      console.log('===========================================\n');
      
      // 결과 저장
      const resultData = {
        success: true,
        keyword: '2025년 유아인 복귀 논란',
        imageSource: 'Nano Banana Pro (Gemini)',
        title: result.title,
        url: publishResult.url,
        postId: publishResult.postId,
        timestamp: new Date().toISOString(),
        issues: issues,
        stats: {
          htmlLength: result.html.length,
          generateTime: generateTime + '초',
          totalTime: totalTime + '초',
          imgCount: (result.html.match(/<img/g) || []).length,
          hasThumbnail: !!result.thumbnail
        }
      };
      fs.writeFileSync('test-유아인복귀-result.json', JSON.stringify(resultData, null, 2), 'utf-8');
      console.log('📊 결과 저장: test-유아인복귀-result.json');
      
      // 브라우저에서 열기
      console.log('\n🌐 브라우저에서 확인...');
      const { exec } = require('child_process');
      exec(`start "" "${publishResult.url}"`);
      
    } else {
      console.log('❌ 발행 실패:', publishResult.error);
      console.log('===========================================\n');
      
      // 미리보기만 열기
      console.log('📄 미리보기 확인:', previewPath);
      const { exec } = require('child_process');
      exec(`start "" "${previewPath}"`);
    }
    
  } catch (error) {
    console.error('\n❌ 오류 발생:', error.message);
    console.error(error.stack);
  }
}

main();
