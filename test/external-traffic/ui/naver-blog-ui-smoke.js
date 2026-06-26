'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function main() {
  const uiPath = path.join(process.cwd(), 'electron/ui/modules/external-traffic.js');
  const uiScript = `${fs.readFileSync(uiPath, 'utf8')}
window.__naverBlogUiTest = {
  render: _renderV2ResultCard,
  show: extTrafficShowNaverBlogVariant,
  copy: _getNaverBlogVariantCopy,
  setSource(url) { _selectedSource = { url, title: 'source' }; },
};`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1360, height: 980 } });
  await page.setContent('<!doctype html><html><body style="background:#0f172a"><div id="app"></div></body></html>');
  await page.addScriptTag({ content: uiScript });

  const result = await page.evaluate(() => {
    window.__naverBlogUiTest.setSource('https://example.com/naver-source');
    const cached = {
      sourceUrl: 'https://example.com/naver-source',
      formatted: {
        body: '미리보기 본문',
        hashtags: ['#태그1', '#태그2', '#태그3', '#태그4', '#태그5'],
      },
      risk: { score: 12, band: 'low' },
      lengthViolations: [],
      naverBlog: {
        context: {
          articleType: '정부지원금/정책',
          primaryKeyword: '청년내일저축계좌',
          secondaryKeywords: ['신청 조건', '확인 방법'],
          searchTerms: ['청년내일저축계좌 조건', '청년내일저축계좌 신청방법'],
        },
        variants: ['A', 'B', 'C'].map((key, idx) => ({
          key,
          label: ['검색 정리형', '경험 공감형', '체크리스트형'][idx],
          articleType: '정부지원금/정책',
          primaryKeyword: '청년내일저축계좌',
          titleCandidates: Array.from({ length: 10 }, (_, n) => ({
            text: `${key} 제목 후보 ${n + 1}`,
            score: 80 + n,
          })),
          selectedTitle: `${key} 최종 제목`,
          titleScore: 91 + idx,
          selectedReason: '검색 의도와 맞음',
          critique: { score: 92 + idx, notes: '검색형 미니 포스트' },
          finalRevision: {
            title: `${key} 최종 제목`,
            intro: `${key} 도입부입니다.`,
            sections: [
              { heading: '첫 번째 소제목', body: `${key} 본문 1입니다.` },
              { heading: '두 번째 소제목', body: `${key} 본문 2입니다.` },
              { heading: '세 번째 소제목', body: `${key} 본문 3입니다.` },
            ],
            sourceLead: '세부 기준은 원문에서 이어서 확인할 수 있습니다: https://example.com/naver-source',
            commentPrompt: '헷갈린 부분이 있다면 댓글로 남겨주세요.',
            hashtags: ['#청년내일저축계좌', '#정부지원금', '#신청조건', '#복지정보', '#체크리스트'],
          },
        })),
      },
    };
    const platform = {
      id: 'naver-blog',
      label: '네이버 블로그',
      openUrl: 'https://blog.naver.com/',
      color: '#03c75a',
    };
    document.getElementById('app').innerHTML = window.__naverBlogUiTest.render(platform, cached);
    window.__naverBlogUiTest.show(1);

    const textareas = Array.from(document.querySelectorAll('textarea[id^="naverBlogFinalCopy_"]'));
    const tabs = Array.from(document.querySelectorAll('[id^="naverBlogVariantTab_"]'));
    const panels = Array.from(document.querySelectorAll('[id^="naverBlogVariantPanel_"]'));
    return {
      textareas: textareas.length,
      tabs: tabs.length,
      panelDisplays: panels.map((panel) => panel.style.display),
      contextText: document.body.innerText.includes('자동 분류')
        && document.body.innerText.includes('핵심 키워드')
        && document.body.innerText.includes('보조 키워드')
        && document.body.innerText.includes('검색 의도'),
      titleCandidateText: document.body.innerText.includes('제목 후보 10개 보기'),
      hasJson: /NAVER_BLOG_RESULT_JSON|"context"|"variants"/.test(textareas.map((ta) => ta.value).join('\n')),
      bCopy: textareas[1] && textareas[1].value,
    };
  });

  await browser.close();
  if (result.textareas !== 3 || result.tabs !== 3 || result.panelDisplays[1] !== 'block' || !result.contextText || !result.titleCandidateText || result.hasJson) {
    throw new Error(`Naver Blog UI smoke failed: ${JSON.stringify(result)}`);
  }
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
