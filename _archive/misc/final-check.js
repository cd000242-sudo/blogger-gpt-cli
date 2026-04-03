const fs = require('fs');
const h = fs.readFileSync('electron/ui/index.html', 'utf8');
const main = fs.readFileSync('electron/ui/modules/main.js', 'utf8');
const ui = fs.readFileSync('electron/ui/modules/ui.js', 'utf8');
const sidebar = fs.readFileSync('electron/ui/modules/sidebar.js', 'utf8');
const css = fs.readFileSync('electron/ui/styles.css', 'utf8');

console.log('=== Final Integrity Check ===');
console.log('');

// HTML checks
const htmlChecks = {
    'appSidebar': h.includes('id="appSidebar"'),
    'mainContent': h.includes('id="mainContent"'),
    'app-header': h.includes('class="app-header"'),
    'tab-content-container': h.includes('id="tab-content-container"'),
    'main-tab': h.includes('id="main-tab"'),
    'semi-auto-tab': h.includes('id="semi-auto-tab"'),
    'content-tab': h.includes('id="content-tab"'),
    'internal-links-tab': h.includes('id="internal-links-tab"'),
    'schedule-tab': h.includes('id="schedule-tab"'),
    'thumbnail-tab': h.includes('id="thumbnail-tab"'),
    'settings-tab': h.includes('id="settings-tab"'),
};
console.log('HTML IDs:');
Object.entries(htmlChecks).forEach(([k, v]) => console.log(`  ${v ? '✅' : '❌'} ${k}`));

// Module checks
console.log('\nModule integration:');
console.log(`  ${main.includes("import { initSidebar }") ? '✅' : '❌'} main.js imports sidebar`);
console.log(`  ${main.includes("initSidebar()") ? '✅' : '❌'} main.js calls initSidebar()`);
console.log(`  ${ui.includes("__sidebarSetActive") ? '✅' : '❌'} ui.js has sidebar sync`);
console.log(`  ${ui.includes("case 'content':") ? '✅' : '❌'} ui.js has content case`);

// CSS checks
console.log('\nCSS:');
console.log(`  ${css.includes('.app-layout') ? '✅' : '❌'} .app-layout`);
console.log(`  ${css.includes('.sidebar') ? '✅' : '❌'} .sidebar`);
console.log(`  ${css.includes('.sidebar-item.active') ? '✅' : '❌'} .sidebar-item.active`);
console.log(`  ${css.includes('.main-content') ? '✅' : '❌'} .main-content`);
console.log(`  ${css.includes('.app-header') ? '✅' : '❌'} .app-header`);
console.log(`  ${css.includes('.header-badge') ? '✅' : '❌'} .header-badge`);
console.log(`  ${css.includes('--primary-start') ? '✅' : '❌'} --primary-start variable used`);
console.log(`  ${css.includes('--primary-end') ? '✅' : '❌'} --primary-end variable used`);
console.log(`  ${!css.includes('.tab-navigation') ? '✅' : '❌'} .tab-navigation removed`);
console.log(`  ${!css.includes('.tab-btn') ? '✅' : '❌'} .tab-btn removed`);

// sidebar.js checks
console.log('\nSidebar module:');
console.log(`  ${sidebar.includes("export function initSidebar") ? '✅' : '❌'} exports initSidebar`);
console.log(`  ${sidebar.includes("nav-main") ? '✅' : '❌'} nav-main item`);
console.log(`  ${sidebar.includes("nav-intlinks-page") ? '✅' : '❌'} nav-intlinks-page item`);
console.log(`  ${sidebar.includes("nav-convert") ? '✅' : '❌'} nav-convert item`);
console.log(`  ${sidebar.includes("tutorialUploadBtn") ? '✅' : '❌'} tutorialUploadBtn ID`);
console.log(`  ${sidebar.includes("showFallbackNav") ? '✅' : '❌'} fallback nav`);
console.log(`  ${sidebar.includes("__sidebarSetActive") ? '✅' : '❌'} __sidebarSetActive callback`);
console.log(`  ${!sidebar.includes("onclick") ? '✅' : '❌'} No onclick (rule 4)`);
console.log(`  ${!sidebar.includes("tab-content") ? '✅' : '❌'} No tab-content class (rule 1)`);
console.log(`  ${!sidebar.includes("tab-btn") ? '✅' : '❌'} No tab-btn class (rule 2)`);

// Count checks
const allOk = [...Object.values(htmlChecks),
main.includes("import { initSidebar }"), main.includes("initSidebar()"),
ui.includes("__sidebarSetActive"), ui.includes("case 'content':"),
css.includes('.app-layout'), css.includes('.sidebar'), css.includes('.sidebar-item.active'),
css.includes('.main-content'), css.includes('.app-header'), css.includes('.header-badge'),
css.includes('--primary-start'), css.includes('--primary-end'),
!css.includes('.tab-navigation'), !css.includes('.tab-btn'),
sidebar.includes("export function initSidebar"), sidebar.includes("nav-main"),
sidebar.includes("nav-intlinks-page"), sidebar.includes("nav-convert"),
sidebar.includes("tutorialUploadBtn"), sidebar.includes("showFallbackNav"),
sidebar.includes("__sidebarSetActive"), !sidebar.includes("onclick"),
!sidebar.includes("tab-content"), !sidebar.includes("tab-btn")
].every(Boolean);

console.log(`\n=== ${allOk ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'} ===`);
