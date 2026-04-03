const fs = require('fs');
const WebSocket = require('ws');

async function main() {
    const resp = await fetch('http://localhost:9222/json');
    const targets = await resp.json();
    const wsUrl = targets[0].webSocketDebuggerUrl;
    console.log('Connecting to:', wsUrl);

    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
        console.log('Connected! Clicking keyword tab...');
        // Click the 황금키워드 tab
        ws.send(JSON.stringify({
            id: 1,
            method: 'Runtime.evaluate',
            params: {
                expression: `
                    (function() {
                        // Try to find and click the keyword discover tab
                        const tabs = document.querySelectorAll('[data-tab]');
                        let found = false;
                        tabs.forEach(t => {
                            if (t.dataset.tab === 'keyword-discover') {
                                t.click();
                                found = true;
                            }
                        });
                        if (found) return 'clicked keyword-discover tab';
                        
                        // Try sidebar items
                        const sidebarItems = document.querySelectorAll('.sidebar-item, .nav-item, .sidebar-nav-item');
                        let clickText = '';
                        sidebarItems.forEach(item => {
                            const text = item.textContent || '';
                            if (text.includes('황금키워드') || text.includes('keyword')) {
                                item.click();
                                clickText = text.trim();
                                found = true;
                            }
                        });
                        if (found) return 'clicked sidebar: ' + clickText;
                        
                        // List all data-tab values for debugging
                        const allTabs = Array.from(document.querySelectorAll('[data-tab]')).map(t => t.dataset.tab);
                        const allSidebar = Array.from(document.querySelectorAll('.sidebar-item, .nav-item')).map(s => s.textContent.trim().substring(0, 30));
                        return 'NOT FOUND. Tabs: [' + allTabs.join(', ') + '] Sidebar: [' + allSidebar.join(', ') + ']';
                    })()
                `,
                returnByValue: true
            }
        }));
    });

    ws.on('message', (data) => {
        const msg = JSON.parse(data);

        if (msg.id === 1) {
            console.log('Click result:', JSON.stringify(msg.result));
            // Wait 1.5s then take screenshot
            setTimeout(() => {
                console.log('Taking screenshot...');
                ws.send(JSON.stringify({
                    id: 2,
                    method: 'Page.captureScreenshot',
                    params: { format: 'png' }
                }));
            }, 1500);
        }

        if (msg.id === 2 && msg.result) {
            const buf = Buffer.from(msg.result.data, 'base64');
            fs.writeFileSync('keyword-tab-screenshot.png', buf);
            console.log('Screenshot saved! Size:', buf.length, 'bytes');
            ws.close();
            process.exit(0);
        }
    });

    ws.on('error', (e) => {
        console.error('WS Error:', e.message);
        process.exit(1);
    });
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
