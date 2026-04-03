/**
 * Phase 1 cleanup script: Removes old UI elements from index.html
 * This is a one-time migration script.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'electron/ui/index.html');
const content = fs.readFileSync(FILE, 'utf-8');
const lines = content.split('\n');

console.log(`[Phase1] Original: ${lines.length} lines`);

// === Step 1: Find key anchors ===
let tabContentContainerIdx = -1; // <div id="tab-content-container">
let realScheduleTabIdx = -1;     // Real schedule-tab content start (the <div style="padding...)
let excelTabStartIdx = -1;       // <!-- 엑셀 포스팅 탭 -->
let excelTabEndIdx = -1;         // </div> closing excel-tab
let inlineShowTabStartIdx = -1;  // <!-- 탭 전환 함수 -->
let inlineShowTabEndIdx = -1;    // </script> closing showTab

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('id="tab-content-container"') && tabContentContainerIdx === -1) {
        tabContentContainerIdx = i;
    }

    // Find the REAL schedule-tab: look for schedule-tab div that is followed by
    // actual schedule content (padding: 40px, max-width: 1200px)
    if (line.includes('id="schedule-tab"')) {
        // Check next lines for actual schedule content
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            if (lines[j].includes('padding: 40px') && lines[j].includes('max-width: 1200px')) {
                realScheduleTabIdx = i;
                break;
            }
        }
    }

    if (line.includes('엑셀 포스팅 탭') && line.includes('<!--')) {
        excelTabStartIdx = i;
    }

    if (line.includes('id="excel-tab"')) {
        // Find closing </div> for excel-tab by tracking nesting
        let depth = 0;
        for (let j = i; j < lines.length; j++) {
            const opens = (lines[j].match(/<div/g) || []).length;
            const closes = (lines[j].match(/<\/div>/g) || []).length;
            depth += opens - closes;
            if (depth <= 0) {
                excelTabEndIdx = j;
                break;
            }
        }
    }

    if (line.includes('탭 전환 함수') && line.includes('<!--')) {
        inlineShowTabStartIdx = i;
    }

    if (inlineShowTabStartIdx !== -1 && inlineShowTabEndIdx === -1
        && line.includes('</script>') && i > inlineShowTabStartIdx) {
        inlineShowTabEndIdx = i;
    }
}

console.log(`[Phase1] Anchors found:`);
console.log(`  tab-content-container: L${tabContentContainerIdx + 1}`);
console.log(`  real schedule-tab: L${realScheduleTabIdx + 1}`);
console.log(`  excel-tab: L${excelTabStartIdx + 1} - L${excelTabEndIdx + 1}`);
console.log(`  inline showTab: L${inlineShowTabStartIdx + 1} - L${inlineShowTabEndIdx + 1}`);

if (tabContentContainerIdx === -1 || realScheduleTabIdx === -1) {
    console.error('[Phase1] ABORT: Could not find required anchors!');
    process.exit(1);
}

// === Step 2: Build new content ===
// Keep everything before tab-content-container line (inclusive)
// Then skip everything until the real schedule-tab line
// Look back from realScheduleTabIdx to find the comment line
let scheduleCommentIdx = realScheduleTabIdx;
for (let i = realScheduleTabIdx - 1; i >= 0; i--) {
    if (lines[i].includes('스케줄 관리 탭') && lines[i].includes('<!--')) {
        scheduleCommentIdx = i;
        break;
    }
    if (lines[i].trim() !== '') break; // stop at first non-empty line
}

// Delete range 1: from tabContentContainerIdx+1 to scheduleCommentIdx-1
const deleteStart1 = tabContentContainerIdx + 1;
const deleteEnd1 = scheduleCommentIdx - 1;
console.log(`[Phase1] Delete range 1 (old buttons/tabs/dup-semi-auto): L${deleteStart1 + 1} - L${deleteEnd1 + 1} (${deleteEnd1 - deleteStart1 + 1} lines)`);

// Delete range 2: excel-tab (if found, from comment to closing div)
let deleteStart2 = -1, deleteEnd2 = -1;
if (excelTabStartIdx !== -1 && excelTabEndIdx !== -1) {
    deleteStart2 = excelTabStartIdx;
    deleteEnd2 = excelTabEndIdx;
    console.log(`[Phase1] Delete range 2 (excel-tab): L${deleteStart2 + 1} - L${deleteEnd2 + 1} (${deleteEnd2 - deleteStart2 + 1} lines)`);
}

// Delete range 3: inline showTab
let deleteStart3 = -1, deleteEnd3 = -1;
if (inlineShowTabStartIdx !== -1 && inlineShowTabEndIdx !== -1) {
    deleteStart3 = inlineShowTabStartIdx;
    deleteEnd3 = inlineShowTabEndIdx;
    console.log(`[Phase1] Delete range 3 (inline showTab): L${deleteStart3 + 1} - L${deleteEnd3 + 1} (${deleteEnd3 - deleteStart3 + 1} lines)`);
}

// Build filtered lines
const newLines = [];
for (let i = 0; i < lines.length; i++) {
    // Skip delete range 1
    if (i >= deleteStart1 && i <= deleteEnd1) continue;
    // Skip delete range 2
    if (deleteStart2 !== -1 && i >= deleteStart2 && i <= deleteEnd2) continue;
    // Skip delete range 3
    if (deleteStart3 !== -1 && i >= deleteStart3 && i <= deleteEnd3) continue;

    newLines.push(lines[i]);
}

console.log(`[Phase1] New total: ${newLines.length} lines (deleted ${lines.length - newLines.length} lines)`);

// === Step 3: Write back ===
fs.writeFileSync(FILE, newLines.join('\n'), 'utf-8');
console.log(`[Phase1] ✅ File saved successfully!`);
