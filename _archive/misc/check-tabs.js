const fs = require('fs');
const c = fs.readFileSync('c:/Users/park/blogger-gpt-cli/electron/ui/index.html', 'utf-8');
const lines = c.split('\n');

// Track depth from tab-content-container
let tccIdx = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('id="tab-content-container"')) {
        tccIdx = i;
        break;
    }
}

let depth = 0;
let tccCloseIdx = -1;
for (let i = tccIdx; i < lines.length; i++) {
    const line = lines[i];
    // Only count div opens/closes (tab-content-container is a div)
    const opens = (line.match(/<div[\s>]/g) || []).length;
    const closes = (line.match(/<\/div>/g) || []).length;
    depth += opens - closes;
    if (depth <= 0 && i > tccIdx) {
        tccCloseIdx = i;
        break;
    }
}

const results = [];
results.push('tab-content-container opens at L' + (tccIdx + 1));
results.push('tab-content-container closes at L' + (tccCloseIdx + 1));
results.push('Close line: ' + lines[tccCloseIdx].trim());

// Show what's after TCC close
results.push('\n--- After TCC close ---');
for (let i = tccCloseIdx; i < Math.min(tccCloseIdx + 10, lines.length); i++) {
    results.push('L' + (i + 1) + ': ' + lines[i]);
}

// Find the <style> block that's after internal-links-tab
let styleIdx = -1;
for (let i = 4170; i < lines.length; i++) {
    if (lines[i].includes('<style>')) {
        styleIdx = i;
        break;
    }
}
results.push('\nFirst <style> after tabs at L' + (styleIdx + 1));

// Show lines around that area
results.push('\n--- Lines around style block ---');
for (let i = styleIdx - 5; i < Math.min(styleIdx + 3, lines.length); i++) {
    results.push('L' + (i + 1) + ': ' + lines[i]);
}

fs.writeFileSync('c:/Users/park/blogger-gpt-cli/structure-check.txt', results.join('\n'));
console.log('Done');
