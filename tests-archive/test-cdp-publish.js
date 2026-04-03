// CDP를 통해 Electron 앱의 IPC로 전체 파이프라인 발행 트리거
const WebSocket = require('ws');

async function main() {
  try {
    const resp = await fetch('http://localhost:9222/json');
    const pages = await resp.json();
    const target = pages.find(p => p.title.includes('블로그'));

    if (!target) {
      console.log('ERROR: App page not found');
      return;
    }

    console.log('Found:', target.title);
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let msgId = 1;

    function sendCDP(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        const timeout = setTimeout(() => reject(new Error('CDP timeout')), 600000); // 10분
        const handler = (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.id === id) {
            clearTimeout(timeout);
            ws.removeListener('message', handler);
            if (msg.error) reject(new Error(msg.error.message));
            else resolve(msg.result);
          }
        };
        ws.on('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await new Promise(resolve => ws.on('open', resolve));
    console.log('CDP connected!');

    const jsCode = `
      (async () => {
        try {
          const payload = {
            topic: '2026년 최신 노트북 추천 가성비',
            keywords: '2026년 노트북 추천, 가성비 노트북, 최신 노트북',
            platform: 'blogger',
            publishType: 'now',
            postingMode: 'immediate',
            contentMode: 'external',
            toneStyle: 'professional',
            h2ImageSource: 'nanobananapro',
            thumbnailMode: 'nanobananapro',
            previewOnly: false
          };
          
          console.log('[CDP-TEST] Calling run-post IPC with nanobananapro...');
          
          let result;
          if (window.blogger && window.blogger.runPost) {
            result = await window.blogger.runPost(payload);
          } else if (window.electron && window.electron.ipcRenderer) {
            result = await window.electron.ipcRenderer.invoke('run-post', payload);
          } else {
            result = await window.api?.invoke?.('run-post', payload);
          }
          
          if (!result) {
            return JSON.stringify({ error: 'No IPC handler found' });
          }
          
          return JSON.stringify({ 
            ok: result.ok, 
            title: result.title,
            htmlLen: result.html?.length || 0,
            error: result.error,
            labels: result.labels,
            hasThumb: !!result.thumbnail
          });
        } catch (err) {
          return JSON.stringify({ error: err.message });
        }
      })()
    `;

    console.log('Executing IPC call in renderer...');
    const evalResult = await sendCDP('Runtime.evaluate', {
      expression: jsCode,
      awaitPromise: true,
      returnByValue: true,
      timeout: 600000
    });

    console.log('IPC Result:', JSON.stringify(evalResult?.result?.value || evalResult));

    const fs = require('fs');
    const path = require('path');
    fs.writeFileSync(
      path.join(__dirname, 'publish-result.txt'),
      'CDP IPC Result:\n' + JSON.stringify(evalResult?.result?.value || evalResult, null, 2),
      'utf-8'
    );

    ws.close();
  } catch (err) {
    console.error('ERROR:', err.message);
    const fs = require('fs');
    const path = require('path');
    fs.writeFileSync(
      path.join(__dirname, 'publish-result.txt'),
      'ERROR: ' + err.message,
      'utf-8'
    );
  }
}

main();
