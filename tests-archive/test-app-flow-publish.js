/**
 * 앱과 동일한 발행 흐름 테스트
 * - UI(payload) -> generateUltimateMaxModeArticleFinal -> publishGeneratedContent
 * - Blogspot 1건 + WordPress 1건
 */

const path = require('path');
const fs = require('fs');

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
      content.split(/\r?\n/).forEach((line) => {
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

async function runOne({ platform, keyword, blogId, tokenPath, wpSiteUrl, wpUsername, wpPassword }) {
  const env = loadEnv();

  // dist 빌드 산출물 기준으로 로드 (앱이 사용하는 경로와 동일)
  const { generateUltimateMaxModeArticleFinal } = require('./dist/core/ultimate-final-functions');
  const { publishGeneratedContent } = require('./dist/core/index');

  const payload = {
    provider: 'gemini',
    topic: keyword,
    keywords: [
      {
        keyword,
        title: '',
      },
    ],

    // 앱 옵션들(대표값)
    titleMode: 'auto',
    contentMode: 'external',
    toneStyle: 'professional',
    thumbnailMode: 'nanobananapro',
    ctaMode: 'auto',

    publishType: 'publish',
    postingMode: 'publish',

    // 이미지
    h2ImageSource: 'nanobananapro',
    h2Images: { source: 'nanobananapro', sections: [] },

    sectionCount: 5,

    platform,

    // Blogger용
    blogId,

    // WordPress용(앱처럼 payload에도 들어가지만, core/index.ts는 env에서 로드)
    wordpressSiteUrl: wpSiteUrl,
    wordpressUsername: wpUsername,
    wordpressPassword: wpPassword,

    // 키들
    geminiKey: env.GEMINI_API_KEY || env.geminiKey || env.GOOGLE_API_KEY || '',

    // CSE/Naver는 env가 없으면 0개여도 정상 (현재 상태 그대로)
    googleCseKey: env.GOOGLE_CSE_KEY || env.googleCseKey || '',
    googleCseCx: env.GOOGLE_CSE_CX || env.googleCseCx || '',

    // Blogger token 경로는 publishToBlogger가 payload에서 사용
    tokenPath,
  };

  console.log('\n===========================================');
  console.log(`🚀 앱 동일 플로우 테스트 시작: ${platform}`);
  console.log(`   - keyword: ${keyword}`);
  console.log('===========================================');

  const result = await generateUltimateMaxModeArticleFinal(payload, env, (log) => console.log(log));

  const title = result.title && result.title.trim().length > 0 ? result.title : `${keyword} - 2025년 가이드`;
  const html = result.html || '';
  const thumbnailUrl = result.thumbnail || '';

  console.log('[TEST] 생성 완료:', {
    title,
    htmlLength: html.length,
    hasThumbnail: !!thumbnailUrl,
  });

  const publish = await publishGeneratedContent(payload, title, html, thumbnailUrl);

  console.log('[TEST] 발행 결과:', publish);
  return publish;
}

async function main() {
  const blogId = '7313363217330018818';
  const tokenPath = path.join(__dirname, 'blogger-token.json');

  // Blogspot 1건
  const blogspotRes = await runOne({
    platform: 'blogspot',
    keyword: '기초연금 수급 자격',
    blogId,
    tokenPath,
  });

  // WordPress 1건
  const wpRes = await runOne({
    platform: 'wordpress',
    keyword: '기초연금 수급 자격',
    blogId,
    tokenPath,
    // payload로도 전달(참고용)
    wpSiteUrl: process.env.WORDPRESS_SITE_URL || '',
    wpUsername: process.env.WORDPRESS_USERNAME || '',
    wpPassword: process.env.WORDPRESS_PASSWORD || '',
  });

  console.log('\n===========================================');
  console.log('✅ 테스트 종료');
  console.log(' - Blogspot:', blogspotRes?.url || blogspotRes);
  console.log(' - WordPress:', wpRes?.url || wpRes);
  console.log('===========================================');
}

main().catch((e) => {
  console.error('❌ 테스트 실패:', e);
  process.exit(1);
});
