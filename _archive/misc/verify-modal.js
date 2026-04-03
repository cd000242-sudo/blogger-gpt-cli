const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');

function getDebugList() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function cdpCommand(ws, method, params = {}) {
  return new Promise((resolve) => {
    const id = Math.floor(Math.random() * 100000);
    const handler = (msg) => {
      const data = JSON.parse(msg);
      if (data.id === id) { ws.removeListener('message', handler); resolve(data.result); }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

(async () => {
  try {
    const targets = await getDebugList();
    const page = targets.find(t => t.type === 'page');
    if (!page) { console.log('No page found'); return; }
    
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => ws.on('open', r));
    
    // Reload page
    await cdpCommand(ws, 'Page.enable');
    await cdpCommand(ws, 'Page.reload', { ignoreCache: true });
    await new Promise(r => setTimeout(r, 3000));
    
    // Click on Feb 14 date to trigger the modal
    // Execute JS to simulate click on 14th date
    await cdpCommand(ws, 'Runtime.evaluate', {
      expression: `
        // Trigger renderCalendar first
        if (typeof renderCalendar === 'function') renderCalendar();
        
        // Wait a moment then click on a date with memo content
        setTimeout(() => {
          const cells = document.querySelectorAll('#calendar-dates > div');
          for (const cell of cells) {
            const text = cell.textContent;
            if (text.startsWith('14') || text.includes('14')) {
              cell.click();
              break;
            }
          }
        }, 500);
        'clicked'
      `
    });
    
    // Wait for modal animation
    await new Promise(r => setTimeout(r, 1500));
    
    // Take screenshot
    const screenshot = await cdpCommand(ws, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('modal-after.png', Buffer.from(screenshot.data, 'base64'));
    console.log('Screenshot saved: modal-after.png');
    
    ws.close();
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
