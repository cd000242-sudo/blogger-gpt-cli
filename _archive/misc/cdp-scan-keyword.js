const fs = require('fs');
const WebSocket = require('ws');

async function main() {
    const resp = await fetch('http://localhost:9222/json');
    const targets = await resp.json();
    const wsUrl = targets[0].webSocketDebuggerUrl;
    console.log('Connecting to:', wsUrl);

    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
        console.log('Connected! Clicking scan button...');
        // Click the scan button
        ws.send(JSON.stringify({
            id: 1,
            method: 'Runtime.evaluate',
            params: {
                expression: `
                    (function() {
                        const scanBtn = document.getElementById('kd-scan-btn');
                        if (scanBtn) {
                            scanBtn.click();
                            return 'Clicked scan button: ' + scanBtn.textContent;
                        }
                        return 'Scan button not found';
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

            // Wait 3 seconds then take a progress screenshot
            setTimeout(() => {
                console.log('Taking progress screenshot (3s)...');
                ws.send(JSON.stringify({
                    id: 2,
                    method: 'Page.captureScreenshot',
                    params: { format: 'png' }
                }));
            }, 3000);
        }

        if (msg.id === 2 && msg.result) {
            const buf = Buffer.from(msg.result.data, 'base64');
            fs.writeFileSync('keyword-scan-progress.png', buf);
            console.log('Progress screenshot saved! Size:', buf.length, 'bytes');

            // Wait another 15 seconds for scan to complete, then take final screenshot
            console.log('Waiting 20 more seconds for scan to finish...');
            setTimeout(() => {
                console.log('Taking final screenshot...');
                ws.send(JSON.stringify({
                    id: 3,
                    method: 'Page.captureScreenshot',
                    params: { format: 'png' }
                }));
            }, 20000);
        }

        if (msg.id === 3 && msg.result) {
            const buf = Buffer.from(msg.result.data, 'base64');
            fs.writeFileSync('keyword-scan-result.png', buf);
            console.log('Final screenshot saved! Size:', buf.length, 'bytes');

            // Also check for any errors in console
            ws.send(JSON.stringify({
                id: 4,
                method: 'Runtime.evaluate',
                params: {
                    expression: `
                        (function() {
                            const progressEl = document.getElementById('kd-progress');
                            const emptyEl = document.getElementById('kd-empty');
                            const listEl = document.getElementById('kd-list');
                            const statsEl = document.getElementById('kd-stats');
                            const scanBtn = document.getElementById('kd-scan-btn');
                            return JSON.stringify({
                                progress: progressEl ? progressEl.style.display : 'null',
                                empty: emptyEl ? emptyEl.style.display + ' | ' + emptyEl.textContent.trim().substring(0, 100) : 'null',
                                list: listEl ? listEl.style.display + ' | childCount:' + listEl.children.length : 'null',
                                stats: statsEl ? statsEl.style.display : 'null',
                                scanBtn: scanBtn ? scanBtn.textContent : 'null',
                            });
                        })()
                    `,
                    returnByValue: true
                }
            }));
        }

        if (msg.id === 4) {
            console.log('UI State:', JSON.stringify(msg.result));
            ws.close();
            process.exit(0);
        }
    });

    ws.on('error', (e) => {
        console.error('WS Error:', e.message);
        process.exit(1);
    });

    // Safety timeout
    setTimeout(() => {
        console.log('Safety timeout reached. Exiting...');
        ws.close();
        process.exit(0);
    }, 35000);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
