/**
 * 🏦 기초연금 수급 자격 - 블로그스팟 발행 테스트
 * 이미지 소스: Nano Banana Pro (Gemini 이미지 생성)
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
  console.log('===========================================');
  console.log('🏦 기초연금 수급 자격 - 블로그스팟 테스트');
  console.log('===========================================\n');
  
  const startTime = Date.now();
  
  // 환경 변수 로드
  const env = loadEnv();
  console.log('✅ 환경 변수 로드 완료\n');
  
  // 모듈 로드
  const { generateUltimateMaxModeArticleFinal } = require('./dist/core/ultimate-final-functions');
  const { publishToBlogger } = require('./dist/core/blogger-publisher');
  
  // 테스트 키워드
  const keyword = '기초연금 수급 자격';
  
  console.log(`🎯 키워드: "${keyword}"`);
  console.log('📝 플랫폼: Blogger (블로그스팟)\n');
  
  // 콘텐츠 생성
  console.log('🚀 콘텐츠 생성 시작...\n');
  
  const payload = {
    keyword: keyword,
    topic: keyword,  // 🔥 topic 필드 추가 (CTA URL 생성에 필요)
    platform: 'blogger',
    tone: 'professional',
    skipImages: false,
    h2ImageSource: 'nanobananapro',  // 🔥 NanoBanana Pro로 이미지 생성
    thumbnailSource: 'nanobananapro', // 🔥 썸네일도 NanoBanana Pro
    // 🔥 수동 CTA 테스트 (앱에서 설정 시 이 형식으로 전달됨)
    manualCtas: {
      1: {
        url: 'https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveTWAT52011M.do?wlfareInfoId=WLF00000425',
        text: '🔗 기초연금 신청하기',
        hook: '지금 바로 기초연금을 신청하세요!'
      }
    }
  };
  
  const result = await generateUltimateMaxModeArticleFinal(
    payload,
    env,
    (log) => console.log(log)
  );
  
  // 제목이 비어있거나 키워드와 무관하면 키워드 기반 제목 생성
  if (!result.title || result.title.length < 5) {
    result.title = `${keyword} - 2025년 완벽 가이드 🔥`;
  }
  
  console.log('\n✅ 콘텐츠 생성 완료!');
  console.log(`   - 제목: ${result.title}`);
  console.log(`   - HTML 길이: ${result.html.length}자`);
  console.log(`   - 라벨: ${result.labels.join(', ')}`);
  console.log(`   - 썸네일: ${result.thumbnail ? '있음' : '없음'}`);
  
  // H2 섹션 수 카운트
  const h2Count = (result.html.match(/<h2[^>]*>/gi) || []).length;
  console.log(`   - H2 섹션 수: ${h2Count}개`);
  
  // CTA 수 카운트
  const ctaCount = (result.html.match(/nofollow noopener/gi) || []).length;
  console.log(`   - CTA 수: ${ctaCount}개`);
  
  // 미리보기 HTML 저장
  const previewPath = path.join(__dirname, 'test-기초연금-preview.html');
  fs.writeFileSync(previewPath, `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${result.title}</title>
  <style>body { max-width: 800px; margin: 0 auto; padding: 20px; }</style>
</head>
<body>
  <h1>${result.title}</h1>
  ${result.html}
</body>
</html>
  `);
  console.log(`\n📄 미리보기 저장: ${previewPath}`);
  
  // Blogger에 발행
  console.log('\n🚀 Blogger에 발행 중...\n');
  
  const blogId = env.BLOGGER_BLOG_ID || '7313363217330018818';
  const tokenPath = path.join(__dirname, 'blogger-token.json');
  
  // 제목이 비어있으면 키워드로 대체
  const finalTitle = result.title || `${keyword} - 2025년 최신 정보`;
  
  // publishPayload 객체 생성
  const publishPayload = {
    blogId: blogId,
    tokenPath: tokenPath,
    labels: result.labels,
  };
  
  // publishToBlogger(payload, title, html, thumbnailUrl, onLog, postingStatus, scheduleDate)
  const publishResult = await publishToBlogger(
    publishPayload,
    finalTitle,
    result.html,
    result.thumbnail || '',
    (log) => console.log(log),
    'publish',
    null
  );
  
  if (publishResult.ok) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);
    
    console.log('\n===========================================');
    console.log('🎉 발행 성공!');
    console.log(`   - URL: ${publishResult.url}`);
    console.log(`   - Post ID: ${publishResult.postId}`);
    console.log(`   - H2 섹션: ${h2Count}개`);
    console.log(`   - CTA: ${ctaCount}개`);
    console.log(`   - 총 소요시간: ${duration}초`);
    console.log('===========================================\n');
  } else {
    console.error('❌ 발행 실패:', publishResult.error);
  }
}

main().catch(console.error);
