// Actual Blogspot publish test with minimal content
const path = require('path');

async function testPublish() {
  try {
    const publisherPath = path.join(__dirname, 'src', 'core', 'blogger-modules', 'publisher.js');
    const { publishToBlogger } = require(publisherPath);

    const envModule = require(path.join(__dirname, 'dist', 'env.js'));
    const env = envModule.loadEnvFromFile();

    const payload = {
      blogId: env.blogId || env.BLOGGER_BLOG_ID || env.GOOGLE_BLOG_ID || env.BLOG_ID || '',
      googleClientId: env.googleClientId || env.GOOGLE_CLIENT_ID || '',
      googleClientSecret: env.googleClientSecret || env.GOOGLE_CLIENT_SECRET || '',
      labels: ['test', 'diagnostic']
    };

    console.log('PAYLOAD_BLOG_ID: ' + (!!payload.blogId));
    console.log('PAYLOAD_CLIENT_ID: ' + (!!payload.googleClientId));
    console.log('PAYLOAD_CLIENT_SECRET: ' + (!!payload.googleClientSecret));

    const title = 'TEST - Blogspot Publish Test ' + new Date().toISOString().replace(/[:.]/g, '-');
    const html = '<div style="max-width:100%;width:100%;"><h2>Test Post</h2><p>This is a test post from the diagnostic script. It will be deleted shortly.</p></div>';

    console.log('STARTING_PUBLISH...');

    const result = await publishToBlogger(
      payload,
      title,
      html,
      '',  // no thumbnail
      (msg) => console.log('LOG: ' + msg),
      'draft',  // save as draft only
      null
    );

    console.log('PUBLISH_RESULT_OK: ' + result.ok);
    console.log('PUBLISH_RESULT_URL: ' + (result.postUrl || result.url || 'none'));
    console.log('PUBLISH_RESULT_ID: ' + (result.postId || 'none'));
    console.log('PUBLISH_RESULT_ERROR: ' + (result.error || 'none'));
    console.log('PUBLISH_RESULT_NEEDS_AUTH: ' + (result.needsAuth || false));

  } catch (e) {
    console.log('PUBLISH_EXCEPTION: ' + e.message);
    console.log('PUBLISH_STACK: ' + e.stack);
  }
}

testPublish();
