const fs = require('fs');
const html = fs.readFileSync('c:/Users/park/blogger-gpt-cli/electron/ui/index.html', 'utf8');
const lines = html.split('\n');

function countOpens(line) {
    const matches = line.match(/<(div|aside|section|main|article|header|footer|nav|form)([\s>]|$)/gi);
    return matches ? matches.length : 0;
}
function countCloses(line) {
    const matches = line.match(/<\/(div|aside|section|main|article|header|footer|nav|form)>/gi);
    return matches ? matches.length : 0;
}

// Track from mainContent (L319)
let depth = 0;
let output = [];
let mainContentLine = 319;
let tabContainerCloses = null;
let mainContentCloses = null;

for (let i = mainContentLine - 1; i < lines.length; i++) {
    const line = lines[i];
    const opens = countOpens(line);
    const closes = countCloses(line);
    const delta = opens - closes;
    const prevDepth = depth;
    depth += delta;

    // Log important depth changes only
    if (delta !== 0 && (depth <= 3 || prevDepth <= 3)) {
        const trimmed = line.trim().substring(0, 100);
        output.push(`L${i + 1}: d=${prevDepth}→${depth} | ${trimmed}`);
    }

    if (depth === 1 && prevDepth === 2 && !tabContainerCloses) {
        tabContainerCloses = i + 1;
        output.push(`*** tab-content-container CLOSES at line ${i + 1} ***`);
    }

    if (depth <= 0) {
        mainContentCloses = i + 1;
        output.push(`*** mainContent CLOSES at line ${i + 1} ***`);
        break;
    }
}

output.push(`\nSummary:`);
output.push(`- mainContent opens at: L${mainContentLine}`);
output.push(`- tab-content-container closes at: L${tabContainerCloses || 'NOT FOUND'}`);
output.push(`- mainContent closes at: L${mainContentCloses || 'NOT FOUND'}`);

fs.writeFileSync('debug-depth-v3.txt', output.join('\n'));
console.log('Saved. Tab container closes at L' + tabContainerCloses + ', mainContent closes at L' + mainContentCloses);
