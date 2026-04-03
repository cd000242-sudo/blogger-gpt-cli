const CDP = require('chrome-remote-interface');

(async () => {
    try {
        const client = await CDP({ port: 9222 });
        const { Page, Runtime } = client;

        // Reload the page to pick up the new HTML
        await Page.enable();
        await Page.reload({ ignoreCache: true });

        // Wait for page to load
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Take screenshot to verify the new layout
        const { data } = await Page.captureScreenshot({ format: 'png' });
        require('fs').writeFileSync('layout-after.png', Buffer.from(data, 'base64'));
        console.log('Screenshot saved: layout-after.png');

        await client.close();
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
