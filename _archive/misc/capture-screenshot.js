const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    try {
        const browser = await chromium.connectOverCDP('http://localhost:9222');
        const contexts = browser.contexts();

        if (contexts.length > 0) {
            const pages = contexts[0].pages();
            if (pages.length > 0) {
                const page = pages[0];

                const debugInfo = await page.evaluate(() => {
                    const mc = document.querySelector('#mainContent');
                    const result = {};

                    if (mc) {
                        result.mainContentChildren = [];
                        for (let i = 0; i < mc.children.length; i++) {
                            const child = mc.children[i];
                            result.mainContentChildren.push({
                                i, tag: child.tagName, id: child.id || '(none)',
                                childCount: child.children.length,
                            });
                        }
                    }

                    // Check if tab-content-container exists and what's in it
                    const tcc = document.querySelector('#tab-content-container');
                    if (tcc) {
                        result.tabContentContainer = {
                            parent: tcc.parentElement ? tcc.parentElement.id : 'unknown',
                            childCount: tcc.children.length,
                            children: Array.from(tcc.children).map((child, i) => ({
                                i, tag: child.tagName, id: child.id || '(none)',
                            })),
                        };
                    } else {
                        result.tabContentContainer = 'NOT FOUND';
                    }

                    return result;
                });

                fs.writeFileSync('debug-dom.json', JSON.stringify(debugInfo, null, 2));
                console.log('Saved to debug-dom.json');
            }
        }
        await browser.close();
    } catch (err) {
        console.error('Error:', err.message);
    }
})();
