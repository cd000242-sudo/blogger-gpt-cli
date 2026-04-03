/**
 * Adsense content generation test with file-based logging
 */
const path = require('path');
const fs = require('fs');

const LOG_FILE = path.join(__dirname, 'test-result.log');

// Clear log file
fs.writeFileSync(LOG_FILE, '', 'utf-8');

function log(msg) {
    const line = msg + '\n';
    fs.appendFileSync(LOG_FILE, line, 'utf-8');
    process.stdout.write(line);
}

async function main() {
    log('== Adsense Test Start ==');

    // Load env
    let envData;
    try {
        const { loadEnvFromFile } = require('./electron/src/env');
        envData = loadEnvFromFile();
        log('Gemini key: ' + (envData.geminiKey ? 'SET (' + envData.geminiKey.substring(0, 8) + '...)' : 'MISSING'));
        log('Naver ID: ' + (envData.naverClientId ? 'SET' : 'MISSING'));
        log('Google CSE: ' + (envData.googleCseKey ? 'SET' : 'MISSING'));
    } catch (e) {
        log('ENV LOAD ERROR: ' + e.message);
        log('Stack: ' + e.stack);
        process.exit(1);
    }

    if (!envData.geminiKey) {
        log('ERROR: No Gemini API key');
        process.exit(1);
    }

    // Load core module
    let coreIndex;
    try {
        coreIndex = require('./electron/src/core/index');
        log('Core module loaded OK');
        log('Available exports: ' + Object.keys(coreIndex).join(', '));
    } catch (e) {
        log('CORE MODULE LOAD ERROR: ' + e.message);
        log('Stack: ' + e.stack);
        process.exit(1);
    }

    const payload = {
        topic: '2025 blog monetization strategy',
        keywords: ['blog income', 'adsense', 'blog operation'],
        geminiKey: envData.geminiKey,
        contentMode: 'adsense',
        platform: 'blogger',
        thumbnailMode: 'none',
        naverClientId: envData.naverClientId || '',
        naverClientSecret: envData.naverClientSecret || '',
        googleCseKey: envData.googleCseKey || '',
        googleCseCx: envData.googleCseCx || '',
        manualCtas: {},
        adsenseAuthorInfo: { name: 'Test Author', expertise: 'Blog Expert' }
    };

    const env = {
        contentMode: 'adsense',
        thumbnailMode: 'none',
        massCrawlingEnabled: false
    };

    log('Payload topic: ' + payload.topic);
    log('Content mode: ' + payload.contentMode);

    const startTime = Date.now();

    try {
        log('Calling generateMaxModeArticle...');
        const result = await coreIndex.generateMaxModeArticle(
            payload,
            env,
            (progressLog) => {
                if (progressLog.includes('[PROGRESS]')) {
                    log('PROGRESS: ' + progressLog);
                }
            }
        );

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        log('Generation complete in ' + elapsed + 's');

        if (!result || !result.html) {
            log('ERROR: Empty result!');
            process.exit(1);
        }

        const html = result.html;
        const title = result.title;
        const h2Count = (html.match(/<h2[^>]*>/gi) || []).length;
        const h3Count = (html.match(/<h3[^>]*>/gi) || []).length;
        const textOnly = html
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const textLen = textOnly.length;
        const htmlLen = html.length;
        const hasCSS = html.includes('<style>');
        const hasDisclaimer = html.includes('\uBA74\uCC45\uC0AC\uD56D') || html.includes('disclaimer');

        log('\n== RESULTS ==');
        log('Title: ' + title);
        log('Elapsed: ' + elapsed + 's');
        log('HTML length: ' + htmlLen);
        log('Text length: ' + textLen);
        log('H2 count: ' + h2Count);
        log('H3 count: ' + h3Count);
        log('Has CSS: ' + hasCSS);
        log('Has disclaimer: ' + hasDisclaimer);

        log('\n== EVALUATION ==');
        let passed = true;
        if (h2Count >= 5) { log('PASS: H2 sections = ' + h2Count); }
        else { log('FAIL: H2 sections = ' + h2Count + ' (need >= 5)'); passed = false; }

        if (textLen >= 3000) { log('PASS: Text length = ' + textLen); }
        else { log('FAIL: Text length = ' + textLen + ' (need >= 3000)'); passed = false; }

        if (hasCSS) { log('PASS: CSS included'); }
        else { log('FAIL: No CSS'); passed = false; }

        log(passed ? '\nALL TESTS PASSED!' : '\nSOME TESTS FAILED!');

        // Save HTML output
        const outPath = path.join(__dirname, 'test-adsense-output.html');
        fs.writeFileSync(outPath, html, 'utf-8');
        log('HTML saved to: ' + outPath);

    } catch (error) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        log('GENERATION FAILED after ' + elapsed + 's');
        log('Error: ' + error.message);
        log('Stack: ' + error.stack);
        process.exit(1);
    }
}

main().catch(e => {
    log('UNHANDLED ERROR: ' + e.message);
    log('Stack: ' + e.stack);
    process.exit(1);
});
