const http = require('http');
const fs = require('fs');

// Step 1: Find the WebSocket endpoint
function getDebugList() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

// Step 2: Send command via WebSocket
function sendCommand(wsUrl, method, params = {}) {
  return new Promise((resolve, reject) => {
    const WebSocket = require('ws');
    const ws = new WebSocket(wsUrl);
    let id = 1;
    ws.on('open', () => {
      ws.send(JSON.stringify({ id: id++, method, params }));
    });
    ws.on('message', (msg) => {
      const data = JSON.parse(msg);
      if (data.id) {
        resolve(data);
        ws.close();
      }
    });
    ws.on('error', reject);
  });
}

(async () => {
  try {
    const targets = await getDebugList();
    const page = targets.find(t => t.type === 'page');
    if (!page) { console.log('No page target found'); return; }
    
    console.log('Found page:', page.title);
    const wsUrl = page.webSocketDebuggerUrl;
    
    // Reload the page
    console.log('Reloading page...');
    await sendCommand(wsUrl, 'Page.reload', { ignoreCache: true });
    
    // Wait
    await new Promise(r => setTimeout(r, 3000));
    
    // Take screenshot  
    const WebSocket = require('ws');
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({ id: 1, method: 'Page.captureScreenshot', params: { format: 'png' } }));
      });
      ws.on('message', (msg) => {
        const data = JSON.parse(msg);
        if (data.id === 1 && data.result) {
          fs.writeFileSync('layout-after.png', Buffer.from(data.result.data, 'base64'));
          console.log('Screenshot saved: layout-after.png');
          ws.close();
          resolve();
        }
      });
      ws.on('error', reject);
    });
    
    console.log('Done!');
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
