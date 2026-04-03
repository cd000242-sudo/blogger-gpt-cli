const fs = require('fs');
const path = require('path');

async function loadEnvSafe() {
  // Prefer existing env loader if present on window side; in Node tests we read .env via dotenv.
  try {
    require('dotenv').config();
  } catch (e) {
    // ignore
  }

  // Also attempt to load from the project's env loader if available
  try {
    const { loadEnvFromFile } = require('../src/env');
    const envData = loadEnvFromFile();
    // Merge without overwriting existing process.env
    for (const [k, v] of Object.entries(envData || {})) {
      if (process.env[k] == null && v != null) process.env[k] = String(v);
    }
  } catch (e) {
    // ignore
  }

  return process.env;
}

function assertTruthy(name, value) {
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
}

function summarizeHtmlChecks(html) {
  const h2Count = (html.match(/<h2\b/gi) || []).length;
  const h3Count = (html.match(/<h3\b/gi) || []).length;
  const imgCount = (html.match(/<img\b/gi) || []).length;
  const sectionImgs = (html.match(/class="section-image"/gi) || []).length;
  const len = html.length;
  return { len, h2Count, h3Count, imgCount, sectionImgs };
}

async function main() {
  const env = await loadEnvSafe();

  // Required for generation (Gemini) + Blogger publish
  const blogId = env.GOOGLE_BLOG_ID || env.BLOGGER_BLOG_ID || env.BLOG_ID || env.blogId;
  assertTruthy('BLOG_ID (GOOGLE_BLOG_ID/BLOGGER_BLOG_ID/BLOG_ID)', blogId);
  assertTruthy('GOOGLE_CLIENT_ID', env.GOOGLE_CLIENT_ID || env.googleClientId);
  assertTruthy('GOOGLE_CLIENT_SECRET', env.GOOGLE_CLIENT_SECRET || env.googleClientSecret);

  // Note: Gemini key may be missing if user uses other generation modes, but ultimate-final uses Gemini.
  // We don't hard fail here to allow Pollinations-only image generation, but content generation still needs Gemini.

  const keyword = env.TEST_KEYWORD || env.KEYWORD || '2025년 블로그 수익화 시작하는 법';

  const postingStatus = (String(env.POSTING_STATUS || '') || '').toLowerCase() === 'publish'
    ? 'publish'
    : ((String(env.IS_DRAFT || '') || '').toLowerCase() === 'false' ? 'publish' : 'draft');

  const payload = {
    platform: 'blogger',
    topic: keyword,
    // publishToBlogger expects these keys in payload for OAuth
    blogId,
    googleClientId: env.GOOGLE_CLIENT_ID || env.googleClientId,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET || env.googleClientSecret,

    // Posting status
    postingMode: postingStatus,
    publishType: postingStatus,

    // Max-mode pipeline
    promptMode: 'max-mode',
    contentMode: 'external',

    // Images
    h2ImageSource: env.H2_IMAGE_SOURCE || 'nanobananapro',
    h2ImageSections: env.H2_IMAGE_SECTIONS
      ? String(env.H2_IMAGE_SECTIONS)
          .split(',')
          .map(s => parseInt(s.trim()))
          .filter(n => Number.isFinite(n) && n > 0)
      : [],

    thumbnailSource: env.THUMBNAIL_SOURCE || 'svg'
  };

  console.log('[VERIFY] Keyword:', keyword);
  console.log('[VERIFY] Payload image settings:', {
    h2ImageSource: payload.h2ImageSource,
    h2ImageSections: payload.h2ImageSections,
    thumbnailSource: payload.thumbnailSource
  });
  console.log('[VERIFY] Posting status:', postingStatus);

  const { generateUltimateMaxModeArticleFinal } = require('../src/core/ultimate-final-functions');
  const { publishToBlogger } = require('../src/core/blogger-publisher');

  const logs = [];
  const onLog = (s) => {
    logs.push(String(s));
    console.log(String(s));
  };

  console.log('\n[VERIFY] Generating content...\n');
  const generated = await generateUltimateMaxModeArticleFinal(payload, env, onLog);

  const previewPath = path.join(process.cwd(), `verify-blogspot-preview-${Date.now()}.html`);
  fs.writeFileSync(previewPath, generated.html, 'utf-8');

  const summary = summarizeHtmlChecks(generated.html);
  console.log('\n[VERIFY] HTML summary:', summary);
  console.log('[VERIFY] Preview saved:', previewPath);

  console.log(`\n[VERIFY] Publishing to Blogger (${postingStatus.toUpperCase()})...\n`);
  const result = await publishToBlogger(
    payload,
    generated.title,
    generated.html,
    generated.thumbnail || '',
    onLog,
    postingStatus,
    null
  );

  console.log('\n[VERIFY] Publish result:', result);
  if (result && result.ok && result.url) {
    console.log('\n✅ Published URL:', result.url);
  }
}

main().catch((e) => {
  console.error('❌ verify-blogspot-publish failed:', e);
  process.exitCode = 1;
});
