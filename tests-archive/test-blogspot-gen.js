/**
 * Blogspot 글 생성 테스트 스크립트
 * CDP를 통해 현재 실행 중인 Electron 앱에 연결하여 반자동 글 생성을 실행합니다.
 */
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

const LOG_FILE = 'test-blogspot-gen-logs.txt';
let logBuffer = [];

function log(msg) {
  const ts = new Date().toLocaleTimeString('ko-KR');
  const line = `[${ts}] ${msg}`;
  console.log(line);
  logBuffer.push(line);
}

function saveLogs() {
  fs.writeFileSync(LOG_FILE, logBuffer.join('\n'), 'utf-8');
  log(`📁 로그 저장 완료: ${LOG_FILE}`);
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function connectCDP() {
  const targets = await httpGet('http://127.0.0.1:9222/json');
  const mainTarget = targets.find(t => t.type === 'page' && t.url && !t.url.includes('devtools'));
  if (!mainTarget) throw new Error('메인 페이지 타겟을 찾을 수 없습니다');
  log(`🎯 타겟: ${mainTarget.title} (${mainTarget.url})`);

  const ws = new WebSocket(mainTarget.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  let msgId = 0;
  const pending = new Map();

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
    // 콘솔 로그 캡처
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params && msg.params.args) {
      const text = msg.params.args.map(a => a.value || a.description || '').join(' ');
      if (text.includes('PROGRESS') || text.includes('SEMI-AUTO') || text.includes('ERROR') ||
        text.includes('generateSemiAuto') || text.includes('runSemiAutoPost') ||
        text.includes('이미지') || text.includes('image') || text.includes('thumbnail') ||
        text.includes('nanobananapro') || text.includes('dalle') || text.includes('h2Image') ||
        text.includes('완료') || text.includes('실패') || text.includes('성공')) {
        log(`📋 ${text.substring(0, 300)}`);
      }
    }
  });

  function cdp(method, params = {}) {
    return new Promise((resolve) => {
      const id = ++msgId;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // 콘솔 로그 감시 활성화
  await cdp('Runtime.enable');

  return { ws, cdp };
}

async function test() {
  log('🚀 Blogspot 글 생성 테스트 시작');

  const { ws, cdp } = await connectCDP();
  log('✅ CDP 연결 성공');

  // 1. 현재 앱 상태 확인
  const stateCheck = await cdp('Runtime.evaluate', {
    expression: `JSON.stringify({
      hasBlogger: !!window.blogger,
      hasRunSemiAutoPost: !!(window.blogger && window.blogger.runSemiAutoPost),
      hasGetEnv: !!(window.blogger && window.blogger.getEnv)
    })`,
    returnByValue: true
  });
  log(`📊 앱 상태: ${stateCheck.result?.value || 'unknown'}`);

  // 2. 환경변수 확인 (gemini key가 있는지)
  const envCheck = await cdp('Runtime.evaluate', {
    expression: `(async () => {
      try {
        const env = await window.blogger.getEnv();
        if (env && env.ok && env.data) {
          return JSON.stringify({
            hasGeminiKey: !!env.data.geminiKey,
            geminiKeyPrefix: env.data.geminiKey ? env.data.geminiKey.substring(0, 10) + '...' : 'none',
            platform: env.data.platform || 'unknown',
            hasBlogId: !!env.data.blogId
          });
        }
        return JSON.stringify({ error: 'env load failed' });
      } catch(e) {
        return JSON.stringify({ error: e.message });
      }
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  log(`🔑 환경변수: ${envCheck.result?.value || 'unknown'}`);

  // 3. 글 생성 실행 (반자동)
  log('🔄 글 생성 시작 (키워드: "여름 휴가 추천 여행지")...');

  const genResult = await cdp('Runtime.evaluate', {
    expression: `
      (async function() {
        try {
          const env = await window.blogger.getEnv();
          const settings = env && env.ok ? env.data : {};
          
          const payload = {
            keyword: '여름 휴가 추천 여행지',
            platform: 'blogspot',
            mode: 'semi-auto',
            contentMode: 'keyword',
            // 환경 설정
            geminiKey: settings.geminiKey || '',
            openaiKey: settings.openaiKey || '',
            // 이미지 설정 - nanobananapro 기본
            h2ImageSource: 'nanobananapro',
            h2ImageSections: [],
            h2Images: { source: 'nanobananapro', sections: [] },
            thumbnailSource: 'nanobananapro',
            // 부가 설정
            sourceUrl: '',
            manualCrawlUrls: [],
            previewPlatform: 'blogspot',
            dryRun: true
          };
          
          console.log('[TEST] 📤 페이로드:', JSON.stringify({
            keyword: payload.keyword,
            platform: payload.platform,
            h2ImageSource: payload.h2ImageSource,
            thumbnailSource: payload.thumbnailSource,
            hasGeminiKey: !!payload.geminiKey
          }));
          
          const result = await window.blogger.runSemiAutoPost(payload);
          return JSON.stringify({
            ok: result?.ok || false,
            hasHtml: !!(result?.html),
            htmlLength: result?.html?.length || 0,
            title: result?.title || '',
            error: result?.error || null,
            imageCount: (result?.html || '').match(/<img/g)?.length || 0,
            hasTable: (result?.html || '').includes('<table'),
            hasFaq: (result?.html || '').includes('faq') || (result?.html || '').includes('FAQ'),
            hasSchema: (result?.html || '').includes('schema.org'),
            snippet: result?.html ? result.html.substring(0, 500) : ''
          });
        } catch(e) {
          return JSON.stringify({ ok: false, error: e.message, stack: e.stack?.substring(0, 300) });
        }
      })()
    `,
    awaitPromise: true,
    returnByValue: true,
    timeout: 300000 // 5분 타임아웃
  });

  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('📋 글 생성 결과:');

  try {
    const result = JSON.parse(genResult.result?.value || '{}');
    log(`  ✅ 성공 여부: ${result.ok}`);
    log(`  📝 제목: ${result.title}`);
    log(`  📄 HTML 길이: ${result.htmlLength}자`);
    log(`  🖼️ 이미지 수: ${result.imageCount}`);
    log(`  📊 테이블 포함: ${result.hasTable}`);
    log(`  ❓ FAQ 포함: ${result.hasFaq}`);
    log(`  🔗 Schema.org: ${result.hasSchema}`);
    if (result.error) {
      log(`  ❌ 에러: ${result.error}`);
    }
    if (result.snippet) {
      log(`  📄 HTML 미리보기: ${result.snippet.substring(0, 200)}...`);
    }

    // 성공시 HTML 파일로 저장
    if (result.ok && result.htmlLength > 0) {
      // 원본 HTML 가져오기
      const htmlResult = await cdp('Runtime.evaluate', {
        expression: `
          (async () => {
            try {
              const env = await window.blogger.getEnv();
              const settings = env && env.ok ? env.data : {};
              const result = await window.blogger.runSemiAutoPost({
                keyword: '여름 휴가 추천 여행지',
                platform: 'blogspot',
                mode: 'semi-auto',
                contentMode: 'keyword',
                geminiKey: settings.geminiKey || '',
                h2ImageSource: 'nanobananapro',
                h2ImageSections: [],
                h2Images: { source: 'nanobananapro', sections: [] },
                thumbnailSource: 'nanobananapro',
                sourceUrl: '',
                manualCrawlUrls: [],
                previewPlatform: 'blogspot',
                dryRun: true
              });
              return result?.html || '';
            } catch(e) { return ''; }
          })()
        `,
        awaitPromise: true,
        returnByValue: true,
        timeout: 300000
      });
      // 첫 번째 결과의 HTML을 캐싱해야 함 - 이미 result에 있으므로 여기서는 skip
      log('📝 HTML 결과가 생성되었습니다.');
    }
  } catch (e) {
    log(`❌ 결과 파싱 실패: ${e.message}`);
    log(`  원본: ${genResult.result?.value?.substring(0, 500)}`);
  }

  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  saveLogs();

  setTimeout(() => {
    ws.close();
    process.exit(0);
  }, 2000);
}

test().catch(err => {
  log(`❌ 테스트 실패: ${err.message}`);
  saveLogs();
  process.exit(1);
});
