/**
 * CDP Script: Blogspot Test Publisher
 * Connects to the Electron app via Chrome DevTools Protocol
 * and triggers a Blogspot post via the IPC run-post handler.
 */
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');

const KEYWORD = "부모님 사후 '상속재산 파악' 안심상속 원스톱 서비스 신청 및 유류분 계산";

function getTargets() {
    return new Promise((resolve, reject) => {
        http.get('http://localhost:9222/json', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

function evalInPage(wsUrl, expression, timeout = 300000) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        ws.on('open', () => {
            ws.send(JSON.stringify({
                id: 1,
                method: 'Runtime.evaluate',
                params: {
                    expression,
                    returnByValue: true,
                    awaitPromise: true
                }
            }));
        });
        ws.on('message', (data) => {
            const parsed = JSON.parse(data.toString());
            if (parsed.id === 1) {
                ws.close();
                if (parsed.result?.exceptionDetails) {
                    reject(new Error(parsed.result.exceptionDetails.exception?.description || 'Eval error'));
                } else {
                    resolve(parsed.result?.result?.value);
                }
            }
        });
        ws.on('error', (err) => reject(err));
        setTimeout(() => { ws.close(); reject(new Error(`Timeout after ${timeout / 1000}s`)); }, timeout);
    });
}

async function main() {
    console.log('=== Blogspot Test Publisher ===\n');

    // 1. Connect to Electron
    const targets = await getTargets();
    const page = targets.find(t => t.type === 'page');
    if (!page) { console.error('⚠️ No Electron page found'); process.exit(1); }
    console.log(`✅ Connected to: ${page.title}`);
    console.log(`   URL: ${page.url}\n`);

    const wsUrl = page.webSocketDebuggerUrl;

    // 2. Read current env settings from the app
    console.log('📋 Reading environment settings...');
    const envState = await evalInPage(wsUrl, `
    (async () => {
      try {
        const envResult = await window.blogger.getEnv();
        if (envResult && envResult.ok && envResult.data) {
          return JSON.stringify({
            hasBlogId: !!envResult.data.blogId || !!envResult.data.BLOG_ID,
            blogId: envResult.data.blogId || envResult.data.BLOG_ID || '',
            hasClientId: !!envResult.data.googleClientId || !!envResult.data.GOOGLE_CLIENT_ID,
            hasClientSecret: !!envResult.data.googleClientSecret || !!envResult.data.GOOGLE_CLIENT_SECRET,
            hasGeminiKey: !!envResult.data.geminiKey || !!envResult.data.GEMINI_API_KEY,
            hasAccessToken: !!envResult.data.BLOGGER_ACCESS_TOKEN,
            hasRefreshToken: !!envResult.data.BLOGGER_REFRESH_TOKEN,
            platform: envResult.data.PLATFORM || envResult.data.platform || 'blogger'
          });
        }
        return JSON.stringify({ error: 'Failed to load env' });
      } catch(e) {
        return JSON.stringify({ error: e.message });
      }
    })()
  `);

    const env = JSON.parse(envState);
    console.log('   Blog ID:', env.blogId ? `✅ ${env.blogId}` : '❌ Missing');
    console.log('   Client ID:', env.hasClientId ? '✅' : '❌ Missing');
    console.log('   Client Secret:', env.hasClientSecret ? '✅' : '❌ Missing');
    console.log('   Gemini Key:', env.hasGeminiKey ? '✅' : '❌ Missing');
    console.log('   Access Token:', env.hasAccessToken ? '✅' : '❌ Missing');
    console.log('   Refresh Token:', env.hasRefreshToken ? '✅' : '❌ Missing');
    console.log();

    if (!env.hasBlogId || !env.hasClientId || !env.hasClientSecret || !env.hasGeminiKey) {
        console.error('❌ Missing required credentials. Please configure in Settings.');
        process.exit(1);
    }

    if (!env.hasAccessToken) {
        console.log('⚠️ No access token found. OAuth authentication may be needed.');
        console.log('   Please authenticate via the app first, then re-run this script.');
    }

    // 3. Trigger publish via IPC
    console.log(`🚀 Publishing to Blogspot...`);
    console.log(`   Keyword: ${KEYWORD}`);
    console.log(`   Platform: Blogger`);
    console.log(`   Publish Mode: now`);
    console.log();
    console.log('⏳ Content generation in progress (this may take 2-5 minutes)...\n');

    const publishResult = await evalInPage(wsUrl, `
    (async () => {
      try {
        // Get full env data
        const envResult = await window.blogger.getEnv();
        const envData = envResult?.data || {};
        
        const payload = {
          topic: ${JSON.stringify(KEYWORD)},
          keywords: ${JSON.stringify(KEYWORD)},
          provider: 'gemini',
          geminiKey: envData.geminiKey || envData.GEMINI_API_KEY || '',
          blogId: envData.blogId || envData.BLOG_ID || '',
          googleClientId: envData.googleClientId || envData.GOOGLE_CLIENT_ID || '',
          googleClientSecret: envData.googleClientSecret || envData.GOOGLE_CLIENT_SECRET || '',
          redirectUri: envData.redirectUri || envData.REDIRECT_URI || 'http://localhost:8888/callback',
          publishType: 'now',
          contentMode: 'external',
          toneStyle: 'professional',
          platform: 'blogger',
          bloggerAccessToken: envData.BLOGGER_ACCESS_TOKEN || '',
          bloggerRefreshToken: envData.BLOGGER_REFRESH_TOKEN || '',
          h2ImageSource: 'none',
          thumbnailMode: 'none'
        };
        
        console.log('[CDP-PUBLISH] Calling window.blogger.runPost...');
        const result = await window.blogger.runPost(payload);
        return JSON.stringify(result);
      } catch(e) {
        return JSON.stringify({ ok: false, error: e.message, stack: e.stack?.substring(0, 500) });
      }
    })()
  `, 600000); // 10 minute timeout for content generation + publish

    console.log('\n=== RESULT ===');
    try {
        const result = JSON.parse(publishResult);
        if (result.ok) {
            console.log('🎉 SUCCESS!');
            if (result.url) console.log(`   URL: ${result.url}`);
            if (result.title) console.log(`   Title: ${result.title}`);
            if (result.published) console.log('   Status: Published');
            else if (result.publishError) console.log(`   Status: Content generated, publish failed: ${result.publishError}`);
        } else {
            console.log('❌ FAILED');
            console.log(`   Error: ${result.error || 'Unknown error'}`);
        }

        // Write full result to file
        fs.writeFileSync('cdp-publish-result.json', JSON.stringify(result, null, 2), 'utf8');
        console.log('\n   Full result saved to cdp-publish-result.json');
    } catch (e) {
        console.log('Raw result:', publishResult);
    }
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
