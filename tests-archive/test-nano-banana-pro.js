/**
 * 🍌 나노 바나나 프로 - 블로그스팟 발행 테스트
 * 이미지 소스: Nano Banana Pro (Gemini 이미지 생성)
 * CTA 포함 완벽한 글 발행
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

async function main() {
  console.log('\n🍌 ===========================================');
  console.log('🍌 나노 바나나 프로 이미지 소스 테스트');
  console.log('🍌 ===========================================\n');
  console.log('📌 키워드: 2024 연말정산 꿀팁');
  console.log('🖼️ 이미지 소스: Nano Banana Pro (Gemini 이미지 생성)');
  console.log('📝 플랫폼: Blogger (블로그스팟)');
  console.log('💰 CTA: 자동 생성');
  console.log('');
  
  try {
    // 환경 변수 로드
    const env = loadEnv();
    
    console.log('✅ 환경 변수 로드 완료');
    console.log('   - Gemini API:', env.geminiKey || env.GEMINI_API_KEY ? '✅ 있음 (나노 바나나 프로용)' : '❌ 없음');
    console.log('   - Pexels API:', env.pexelsApiKey || env.PEXELS_API_KEY ? '✅ 있음' : '❌ 없음');
    console.log('   - Stability API:', env.STABILITY_API_KEY ? '✅ 있음' : '❌ 없음');
    console.log('   - Blog ID:', env.blogId || env.BLOG_ID ? '✅ 있음' : '❌ 없음');
    console.log('   - Google Client ID:', env.googleClientId || env.GOOGLE_CLIENT_ID ? '✅ 있음' : '❌ 없음');
    console.log('');
    
    // ultimate-final-functions 로드
    const { generateUltimateMaxModeArticleFinal } = require('./src/core/ultimate-final-functions');
    
    // 발행 payload 생성 - 🍌 소제목 이미지: 나노바나나프로 (텍스트 없음), 썸네일: SVG
    const payload = {
      topic: '쿠팡 개인정보 유출',  // 🔥 키워드
      platform: 'blogger',
      h2ImageSource: 'nanobananapro', // 🍌 H2 이미지: Nano Banana Pro (텍스트 없음)
      thumbnailSource: 'svg', // 📐 썸네일: SVG (기본값)
      skipImages: false,
      fastMode: false,
    };
    
    console.log('📝 콘텐츠 생성 시작...\n');
    console.log('⏱️ 예상 소요 시간: 1-2분');
    console.log('🍌 이미지 생성: Nano Banana Pro (Gemini 이미지 생성 API)');
    console.log('');
    
    // 콘텐츠 생성 - Gemini API로 나노 바나나 프로 이미지 생성
    const result = await generateUltimateMaxModeArticleFinal(
      payload,
      {
        geminiKey: env.geminiKey || env.GEMINI_API_KEY,  // 🍌 나노 바나나 프로에 필수!
        stabilityApiKey: env.STABILITY_API_KEY,
        pexelsApiKey: env.pexelsApiKey || env.PEXELS_API_KEY,
      },
      (log) => console.log(log)
    );
    
    console.log('\n✅ 콘텐츠 생성 완료!');
    console.log('   - 제목:', result.title);
    console.log('   - 글자수:', result.html.length, '자');
    console.log('   - 썸네일:', result.thumbnail ? '✅ 있음' : '❌ 없음');
    console.log('   - 라벨:', result.labels?.join(', ') || '없음');
    
    // HTML에서 CTA 확인
    const ctaCount = (result.html.match(/cta-container/g) || []).length;
    console.log('   - CTA 버튼:', ctaCount, '개');
    
    // HTML에서 이미지 확인
    const imgCount = (result.html.match(/<img/g) || []).length;
    console.log('   - 이미지:', imgCount, '개');
    
    // HTML 파일로 저장 (미리보기용)
    const previewPath = path.join(__dirname, 'test-nano-banana-preview.html');
    const previewHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${result.title}</title>
  <style>
    body { max-width: 800px; margin: 0 auto; padding: 20px; font-family: 'Noto Sans KR', sans-serif; background: #f5f5f5; }
    h1 { color: #333; border-bottom: 2px solid #FFD700; padding-bottom: 10px; }
    img { max-width: 100%; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>${result.title}</h1>
  ${result.thumbnail ? `<img src="${result.thumbnail}" alt="썸네일" style="max-width: 100%; margin-bottom: 20px;">` : ''}
  ${result.html}
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
      console.log('   - access_token:', accessToken ? '✅ 있음' : '❌ 없음');
      console.log('   - refresh_token:', refreshToken ? '✅ 있음' : '❌ 없음');
    } else {
      console.log('⚠️ 토큰 파일 없음:', tokenPath);
      console.log('⚠️ 먼저 앱에서 Blogger 인증을 해주세요.');
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
    
    console.log('\n===========================================');
    if (publishResult.ok) {
      console.log('🎉 발행 성공!');
      console.log('   - URL:', publishResult.url);
      console.log('   - Post ID:', publishResult.postId);
      console.log('===========================================\n');
      
      // 결과 저장
      const resultData = {
        success: true,
        keyword: '2024 연말정산 꿀팁',
        imageSource: 'Nano Banana Pro (Gemini)',
        title: result.title,
        url: publishResult.url,
        postId: publishResult.postId,
        timestamp: new Date().toISOString(),
        stats: {
          htmlLength: result.html.length,
          ctaCount,
          imgCount,
          hasThumbnail: !!result.thumbnail
        }
      };
      fs.writeFileSync('test-nano-banana-result.json', JSON.stringify(resultData, null, 2), 'utf-8');
      console.log('📊 결과 저장: test-nano-banana-result.json');
      console.log('\n🍌 나노 바나나 프로 이미지 소스 테스트 완료!');
      
    } else {
      console.log('❌ 발행 실패:', publishResult.error);
      console.log('===========================================\n');
    }
    
  } catch (error) {
    console.error('\n❌ 오류 발생:', error.message);
    console.error(error.stack);
  }
}

main();

