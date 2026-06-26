'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function main() {
  const uiPath = path.join(process.cwd(), 'electron/ui/modules/external-traffic.js');
  const uiScript = `${fs.readFileSync(uiPath, 'utf8')}
window.__threadsUiTest = {
  render: _renderV2ResultCard,
  show: extTrafficShowThreadsVariant,
  copy: _getThreadsVariantCopy,
  setSource(url) { _selectedSource = { url, title: 'source' }; },
};`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.setContent('<!doctype html><html><body style="background:#0f172a"><div id="app"></div></body></html>');
  await page.addScriptTag({ content: uiScript });

  const result = await page.evaluate(() => {
    window.__threadsUiTest.setSource('https://example.com/source');
    const cached = {
      sourceUrl: 'https://example.com/source',
      formatted: { body: 'A body' },
      risk: { score: 12, band: 'low' },
      lengthViolations: [],
      threads: {
        context: {
          articleType: '세금/환급/공제',
          coreTopic: '세금 추징과 탈세 차이',
          targetReader: '프리랜서',
          readerSituation: '신고 기준이 헷갈리는 상황',
        },
        variants: ['A', 'B', 'C'].map((key, idx) => ({
          key,
          label: ['댓글형', '공감형', '공유형'][idx],
          tone: '친구에게 툭 말하는 반말',
          goal: '댓글 유도',
          hookEngine: '질문형 훅',
          selectedFirstLine: `${key} 첫 줄`,
          critique: { score: 90 + idx },
          finalRevision: {
            firstLine: `${key} 첫 줄`,
            body: `${key} 본문`,
            commentPrompt: '다들 어떻게 봄?',
            linkPrompt: '원문은 여기: https://example.com/source',
          },
        })),
      },
    };
    const platform = {
      id: 'threads',
      label: 'Threads',
      openUrl: 'https://www.threads.com/',
      color: '#000',
    };
    document.getElementById('app').innerHTML = window.__threadsUiTest.render(platform, cached);
    window.__threadsUiTest.show(2);

    const textareas = Array.from(document.querySelectorAll('textarea[id^="threadsFinalCopy_"]'));
    const tabs = Array.from(document.querySelectorAll('[id^="threadsVariantTab_"]'));
    const panels = Array.from(document.querySelectorAll('[id^="threadsVariantPanel_"]'));
    return {
      textareas: textareas.length,
      tabs: tabs.length,
      panelDisplays: panels.map((panel) => panel.style.display),
      contextText: document.body.innerText.includes('자동분류')
        && document.body.innerText.includes('핵심주제')
        && document.body.innerText.includes('예상 독자')
        && document.body.innerText.includes('독자 상황'),
      hasJson: /THREADS_RESULT_JSON|"context"|"variants"/.test(textareas.map((ta) => ta.value).join('\n')),
      cCopy: textareas[2] && textareas[2].value,
    };
  });

  await browser.close();
  if (result.textareas !== 3 || result.tabs !== 3 || result.panelDisplays[2] !== 'block' || !result.contextText || result.hasJson) {
    throw new Error(`Threads UI smoke failed: ${JSON.stringify(result)}`);
  }
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
