const fs = require('fs');
const lines = fs.readFileSync('c:/Users/park/blogger-gpt-cli/electron/ui/index.html', 'utf-8').split('\n');

const out = [];

let bodyStart = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<body>')) { bodyStart = i; break; }
}

const tabIds = ['tab-content-container', 'semi-auto-tab', 'schedule-tab', 'main-tab',
    'thumbnail-tab', 'settings-tab', 'content-tab', 'excel-tab', 'internal-links-tab'];

let depth = 0;
for (let i = bodyStart; i < lines.length; i++) {
    for (const tabId of tabIds) {
        if (lines[i].includes('id="' + tabId + '"')) {
            out.push(tabId + ': L' + (i + 1) + ' depth=' + (depth + 1));
        }
    }
    const opens = (lines[i].match(/<(div|aside|header|section|article|main|nav|footer)[\s>]/g) || []).length;
    const closes = (lines[i].match(/<\/(div|aside|header|section|article|main|nav|footer)>/g) || []).length;
    depth += opens - closes;
}

// Find where tab-content-container ends
let tcIdx = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('id="tab-content-container"')) { tcIdx = i; break; }
}
let d = 0;
for (let i = tcIdx; i < lines.length; i++) {
    const o = (lines[i].match(/<div[\s>]/g) || []).length;
    const c = (lines[i].match(/<\/div>/g) || []).length;
    d += o - c;
    if (d <= 0 && i > tcIdx) {
        out.push('');
        out.push('tab-content-container closes at L' + (i + 1));
        break;
    }
}

fs.writeFileSync('c:/Users/park/blogger-gpt-cli/nesting-result.txt', out.join('\n'), 'utf-8');
console.log('Done. Check nesting-result.txt');
