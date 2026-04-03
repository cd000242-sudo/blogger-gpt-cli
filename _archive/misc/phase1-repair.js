/**
 * Phase 1 structural repair script.
 * Fixes div nesting by:
 * 1. Finding the correct positions of structural elements
 * 2. Recalculating expected closings
 * 3. Adding proper closing divs after internal-links-tab and before <style>
 */
const fs = require('fs');
const FILE = 'c:/Users/park/blogger-gpt-cli/electron/ui/index.html';
const content = fs.readFileSync(FILE, 'utf-8');
const lines = content.split('\n');

console.log('Total lines:', lines.length);

// Find key structural lines
let appLayoutIdx = -1;
let mainContentIdx = -1;
let tabContentContainerIdx = -1;
let firstStyleAfterTabsIdx = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('class="app-layout"') && appLayoutIdx === -1) appLayoutIdx = i;
    if (lines[i].includes('id="mainContent"') && mainContentIdx === -1) mainContentIdx = i;
    if (lines[i].includes('id="tab-content-container"') && tabContentContainerIdx === -1) tabContentContainerIdx = i;
}

// Find the <style> block after all tabs (around L4176)
for (let i = 4100; i < lines.length; i++) {
    if (lines[i].trim().startsWith('<style>')) {
        firstStyleAfterTabsIdx = i;
        break;
    }
}

console.log('app-layout: L' + (appLayoutIdx + 1));
console.log('mainContent: L' + (mainContentIdx + 1));
console.log('tab-content-container: L' + (tabContentContainerIdx + 1));
console.log('First <style> after tabs: L' + (firstStyleAfterTabsIdx + 1));

// Now calculate the div depth from app-layout to just before the <style> block
// We want to know: how many extra </div> are needed at firstStyleAfterTabsIdx
// to properly close tab-content-container, mainContent, and app-layout

// Count opens and closes from app-layout to the line before <style>
let totalOpens = 0;
let totalCloses = 0;

for (let i = appLayoutIdx; i < firstStyleAfterTabsIdx; i++) {
    const line = lines[i];
    const opens = (line.match(/<div[\s>]/g) || []).length +
        (line.match(/<aside[\s>]/g) || []).length +
        (line.match(/<header[\s>]/g) || []).length;
    const closes = (line.match(/<\/div>/g) || []).length +
        (line.match(/<\/aside>/g) || []).length +
        (line.match(/<\/header>/g) || []).length;
    totalOpens += opens;
    totalCloses += closes;
}

const unclosed = totalOpens - totalCloses;
console.log('Div opens from app-layout to <style>:', totalOpens);
console.log('Div closes from app-layout to <style>:', totalCloses);
console.log('Unclosed divs:', unclosed);
console.log('Expected: 3 (app-layout + mainContent + tab-content-container)');

// We need exactly 3 unclosed at this point
// If unclosed != 3, some orphan </div> tags exist or are missing

if (unclosed === 3) {
    console.log('✅ Nesting is already correct! Just need to add 3 closing divs.');
    // Insert 3 closing divs before firstStyleAfterTabsIdx
    const closings = [
        '      </div> <!-- /tab-content-container -->',
        '    </div> <!-- /mainContent -->',
        '  </div> <!-- /app-layout -->',
        ''
    ];

    // Check if closing divs are already there
    const prevLines = lines.slice(firstStyleAfterTabsIdx - 5, firstStyleAfterTabsIdx).map(l => l.trim());
    console.log('Lines before <style>:', prevLines);

    // Insert the closings
    lines.splice(firstStyleAfterTabsIdx, 0, ...closings);
    fs.writeFileSync(FILE, lines.join('\n'), 'utf-8');
    console.log('✅ Added 3 closing divs. New total:', lines.length, 'lines');

} else if (unclosed > 3) {
    console.log('⚠️ Too many unclosed divs (' + unclosed + '). There are ' + (unclosed - 3) + ' extra opening tags.');
    // Still add the 3 needed closings, the extras are within tab content
    const closings = [
        '      </div> <!-- /tab-content-container -->',
        '    </div> <!-- /mainContent -->',
        '  </div> <!-- /app-layout -->',
        ''
    ];
    lines.splice(firstStyleAfterTabsIdx, 0, ...closings);
    fs.writeFileSync(FILE, lines.join('\n'), 'utf-8');
    console.log('Added 3 closing divs anyway. New total:', lines.length, 'lines');

} else {
    console.log('❌ Too few unclosed divs (' + unclosed + '). There are ' + (3 - unclosed) + ' orphan </div> tags.');

    // We need to find and remove (3 - unclosed) orphan </div> tags
    // These are likely right after tab-content-container opens, from the old deleted content
    // Let's find them by tracking depth from tab-content-container

    const orphanCount = 3 - unclosed;
    console.log('Looking for', orphanCount, 'orphan </div> tags after tab-content-container...');

    // Track from tab-content-container
    // The first few tabs should be: schedule-tab, main-tab, etc.
    // Orphan </div>s would be between tab-content-container and schedule-tab, or
    // between schedule-tab's close and main-tab

    // Just find any </div> that makes the depth go below 1 (tab-content-container is depth 1)
    let depth = 0;
    let orphansFound = [];
    for (let i = tabContentContainerIdx; i < firstStyleAfterTabsIdx; i++) {
        const line = lines[i];
        const opens = (line.match(/<div[\s>]/g) || []).length +
            (line.match(/<aside[\s>]/g) || []).length +
            (line.match(/<header[\s>]/g) || []).length;
        const closes = (line.match(/<\/div>/g) || []).length +
            (line.match(/<\/aside>/g) || []).length +
            (line.match(/<\/header>/g) || []).length;

        // For each close on this line, check if it would make depth go < 1
        for (let c = 0; c < closes; c++) {
            let newDepth = depth + opens - (c + 1);
            // After processing all opens and c+1 closes
        }

        depth += opens - closes;

        if (depth < 1 && i > tabContentContainerIdx) {
            // This line caused depth to drop below 1 - it's an orphan
            orphansFound.push({ idx: i, line: line.trim(), depthAfter: depth });
            console.log('  Orphan at L' + (i + 1) + ': depth=' + depth + ' "' + line.trim().substring(0, 60) + '"');
        }
    }

    // Remove the orphan lines (only pure </div> lines where the content is just </div>)
    // Be careful not to remove </div> that is the last tag of e.g. schedule-tab
    let removed = 0;
    for (const orphan of orphansFound) {
        if (removed >= orphanCount) break;
        // Only remove if the line is just a </div> with whitespace
        if (lines[orphan.idx].trim() === '</div>') {
            console.log('  Removing orphan at L' + (orphan.idx + 1));
            lines[orphan.idx] = '<!-- ORPHAN_REMOVED -->';
            removed++;
        }
    }

    // Filter out orphan markers
    const filtered = lines.filter(l => l !== '<!-- ORPHAN_REMOVED -->');

    // Now recalculate and add closings
    // Recalculate firstStyleAfterTabsIdx
    let newStyleIdx = -1;
    for (let i = 4000; i < filtered.length; i++) {
        if (filtered[i].trim().startsWith('<style>')) {
            newStyleIdx = i;
            break;
        }
    }

    const closings = [
        '      </div> <!-- /tab-content-container -->',
        '    </div> <!-- /mainContent -->',
        '  </div> <!-- /app-layout -->',
        ''
    ];
    filtered.splice(newStyleIdx, 0, ...closings);

    fs.writeFileSync(FILE, filtered.join('\n'), 'utf-8');
    console.log('Removed', removed, 'orphan </div>s and added 3 closings. New total:', filtered.length, 'lines');
}
