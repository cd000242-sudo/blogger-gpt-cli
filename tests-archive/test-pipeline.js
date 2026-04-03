/**
 * 직접 IPC 호출로 Blogger 콘텐츠 생성 파이프라인 검증
 * window.blogger.runSemiAutoPost를 직접 호출하여 UI를 우회
 */
const http = require('http');
const fs = require('fs');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function test() {
  const targets = await fetchJSON('http://localhost:9222/json');
  const pageTarget = targets.find(t => t.type === 'page');
  const WebSocket = require('ws');
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  let msgId = 1;
  const pending = {};
  const logs = [];

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id && pending[msg.id]) pending[msg.id](msg);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const args = msg.params.args.map(a => a.value || a.description || '').join(' ');
      logs.push(args);
      // 핵심 로그만 실시간 출력
      const lower = args.toLowerCase();
      if (lower.includes('semi-auto') || lower.includes('progress') ||
        lower.includes('faq') || lower.includes('table') || lower.includes('테이블') ||
        lower.includes('image') || lower.includes('이미지') ||
        lower.includes('schema') || lower.includes('cta') || lower.includes('parsetable') ||
        lower.includes('polback') || lower.includes('fallback') || lower.includes('폴백') ||
        lower.includes('error') || lower.includes('에러') || lower.includes('실패') ||
        lower.includes('generate') || lower.includes('h1') || lower.includes('h2') ||
        lower.includes('max-mode') || lower.includes('끝판왕') || lower.includes('runSemiAutoPost') ||
        lower.includes('content') || lower.includes('crawl') || lower.includes('크롤') ||
        lower.includes('gemini') || lower.includes('api') ||
        args.includes('✅') || args.includes('❌') || args.includes('⚠️') || args.includes('🔥') || args.includes('📋')) {
        const ts = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        console.log(`[${ts}] 📋 ${args.slice(0, 400)}`);
      }
    }
  });

  function cdp(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++;
      pending[id] = resolve;
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await new Promise(resolve => ws.on('open', resolve));
  await cdp('Runtime.enable');
  console.log('✅ CDP 연결 완료\n');

  // window.alert을 무시하도록 override
  await cdp('Runtime.evaluate', {
    expression: `window.alert = function(msg) { console.log('[ALERT]', msg); }`,
    returnByValue: true
  });

  // window.blogger.runSemiAutoPost 직접 호출
  console.log('🚀 window.blogger.runSemiAutoPost 직접 호출');
  console.log('━'.repeat(60));

  const genStart = Date.now();
  const genResult = await cdp('Runtime.evaluate', {
    expression: `
      (async function() {
        try {
          if (!window.blogger || !window.blogger.runSemiAutoPost) {
            return 'ERROR: window.blogger.runSemiAutoPost NOT FOUND';
          }
          
          const payload = {
            topic: '국민연금 수령나이',
            keywords: ['국민연금 수령나이'],
            platform: 'blogger',
            titleMode: 'auto',
            titleValue: '',
            imageMode: 'none',
            thumbnailMode: 'auto',
            toneStyle: 'professional',
            contentMode: 'adsense',
            sourceUrl: '',
            manualCrawlUrls: [],
            h2ImageSource: 'dalle',
            h2ImageSections: [],
            dryRun: true
          };
          
          console.log('[TEST] 🔥 runSemiAutoPost 호출 시작:', JSON.stringify(payload).slice(0, 200));
          const result = await window.blogger.runSemiAutoPost(payload);
          console.log('[TEST] ✅ runSemiAutoPost 결과:', JSON.stringify(result).slice(0, 500));
          
          if (result && result.html) {
            const html = result.html;
            return JSON.stringify({
              status: 'SUCCESS',
              htmlLength: html.length,
              hasFAQ: html.includes('FAQPage') || html.includes('<details>'),
              detailsCount: (html.match(/<details>/g) || []).length,
              markCount: (html.match(/<mark>/g) || []).length,
              tableCount: (html.match(/<table/g) || []).length,
              h2Count: (html.match(/<h2/g) || []).length,
              title: result.title || '',
              hasSchema: html.includes('FAQPage') || html.includes('application/ld+json'),
              htmlSnippet: html.slice(-500)
            });
          } else {
            return JSON.stringify({
              status: 'NO_HTML',
              error: result?.error || 'no html in result',
              resultKeys: Object.keys(result || {})
            });
          }
        } catch(e) {
          console.error('[TEST] ❌ 오류:', e.message, e.stack);
          return JSON.stringify({status: 'ERROR', message: e.message, stack: e.stack?.slice(0, 500)});
        }
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });

  const elapsed = Math.round((Date.now() - genStart) / 1000);
  console.log('━'.repeat(60));
  console.log(`\n⏱️ 소요 시간: ${elapsed}초`);

  try {
    const result = JSON.parse(genResult.result?.result?.value);
    console.log('\n📊 결과:');
    console.log(`   상태: ${result.status}`);
    if (result.status === 'SUCCESS') {
      console.log(`   HTML 길이: ${result.htmlLength} chars`);
      console.log(`   FAQ (FAQPage/details): ${result.hasFAQ}`);
      console.log(`   <details> 태그: ${result.detailsCount}개`);
      console.log(`   <mark> 태그: ${result.markCount}개`);
      console.log(`   <table> 태그: ${result.tableCount}개`);
      console.log(`   <h2> 태그: ${result.h2Count}개`);
      console.log(`   제목: ${result.title}`);
      console.log(`   Schema 마크업: ${result.hasSchema}`);
      console.log(`   HTML 끝부분: ${result.htmlSnippet?.slice(0, 300)}`);
    } else {
      console.log(`   에러: ${result.error || result.message}`);
      console.log(`   결과 키: ${JSON.stringify(result.resultKeys)}`);
      if (result.stack) console.log(`   스택: ${result.stack}`);
    }
  } catch (e) {
    console.log('   Raw result:', genResult.result?.result?.value?.slice(0, 500));
  }

  // 전체 로그 저장
  fs.writeFileSync('test-full-logs.txt', logs.join('\n'));
  console.log(`\n📝 전체 로그 저장: test-full-logs.txt (${logs.length}개)`);

  ws.close();
  console.log('\n✅ 테스트 완료');
}

test().catch(console.error);
