'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const SOURCE_URL = 'https://example.com/source-post';

function candidates(prefix) {
  return Array.from({ length: 10 }, (_, idx) => ({ text: `${prefix} 후보 ${idx + 1}`, score: 96 - idx }));
}

function cachedResult(extraKey, candidateKey, selectedKey, scoreKey, finalRevision) {
  return {
    sourceUrl: SOURCE_URL,
    formatted: { body: 'preview body' },
    risk: { score: 10, band: 'low' },
    lengthViolations: [],
    [extraKey]: {
      context: {
        autoCategory: '생활정보',
        coreTopic: '기준 확인',
        targetReader: '초보자',
        readerSituation: '헷갈리는 상황',
      },
      variants: ['A', 'B', 'C'].map((key, idx) => ({
        key,
        label: `${key}안`,
        goal: `${key} 목적`,
        [candidateKey]: candidates(`${key}`),
        [selectedKey]: candidates(`${key}`)[0].text,
        [scoreKey]: 96,
        selectedReason: '가장 자연스럽습니다.',
        critique: { score: 94 - idx, notes: '검수 완료' },
        finalRevision,
      })),
    },
  };
}

const CASES = [
  {
    platform: { id: 'naver-cafe', label: '네이버 카페', color: '#03c75a', openUrl: 'https://section.cafe.naver.com/' },
    cached: cachedResult('naverCafe', 'titleCandidates', 'selectedTitle', 'titleScore', {
      title: '카페 공유 제목',
      body: '카페 공유 본문입니다.',
      commentPrompt: '댓글 질문입니다.',
      linkPrompt: `원문 ${SOURCE_URL}`,
    }),
  },
  {
    platform: { id: 'x', label: 'X (트위터)', color: '#1da1f2', openUrl: 'https://x.com/compose/post' },
    cached: cachedResult('x', 'firstLineCandidates', 'selectedFirstLine', 'firstLineScore', {
      firstLine: '첫 줄입니다.',
      body: '본문입니다.',
      linkPrompt: `원문 ${SOURCE_URL}`,
    }),
  },
  {
    platform: { id: 'facebook', label: 'Facebook', color: '#1877f2', openUrl: 'https://www.facebook.com/' },
    cached: cachedResult('facebook', 'firstLineCandidates', 'selectedFirstLine', 'firstLineScore', {
      firstLine: '첫 문장입니다.',
      body: '페이스북 본문입니다.',
      sharePrompt: '공유 맥락입니다.',
      commentPrompt: '댓글 질문입니다.',
      linkPrompt: `원문 ${SOURCE_URL}`,
    }),
  },
  {
    platform: { id: 'kakao-openchat', label: '카카오톡 오픈채팅', color: '#fee500', openUrl: 'https://open.kakao.com/' },
    cached: cachedResult('kakaoOpenChat', 'firstLineCandidates', 'selectedFirstLine', 'firstLineScore', {
      firstLine: '잠깐 공유드려요.',
      body: '짧은 공지입니다.',
      entryPrompt: '필요한 분만 확인해보세요.',
      linkPrompt: `원문 ${SOURCE_URL}`,
    }),
  },
  {
    platform: { id: 'youtube-shorts', label: '유튜브 쇼츠', color: '#ff0000', openUrl: 'https://studio.youtube.com/' },
    cached: cachedResult('youtubeShorts', 'first3SecCandidates', 'first3SecHook', 'hookScore', {
      videoTitle: '영상 제목',
      first3SecHook: '첫 3초 훅',
      bodyScript: '영상 본문 스크립트',
      onScreenCaptions: ['자막1', '자막2', '자막3', '자막4', '자막5'],
      pinnedComment: `원문 ${SOURCE_URL}`,
      description: `설명 ${SOURCE_URL}`,
      hashtags: ['#쇼츠', '#정보', '#체크'],
    }),
  },
  {
    platform: { id: 'tiktok', label: '틱톡', color: '#ff0050', openUrl: 'https://www.tiktok.com/upload' },
    cached: cachedResult('tiktok', 'first2SecCandidates', 'first2SecHook', 'hookScore', {
      videoTitle: '틱톡 제목',
      first2SecHook: '첫 2초 훅',
      bodyScript: '틱톡 본문 스크립트',
      cutCaptions: ['컷1', '컷2', '컷3', '컷4', '컷5', '컷6'],
      profileLinkPrompt: `프로필 링크 ${SOURCE_URL}`,
      hashtags: ['#틱톡', '#정보', '#체크'],
    }),
  },
  {
    platform: { id: 'pinterest', label: 'Pinterest', color: '#e60023', openUrl: 'https://www.pinterest.com/pin-builder/' },
    cached: cachedResult('pinterest', 'titleCandidates', 'pinTitle', 'titleScore', {
      pinTitle: '핀 제목',
      pinDescription: `핀 설명 ${SOURCE_URL}`,
      imageTextLines: ['줄1', '줄2', '줄3', '줄4', '줄5'],
      imageDesignDirection: '2:3 카드',
      blogLead: `상세 ${SOURCE_URL}`,
      keywordTags: ['#핀', '#체크'],
    }),
  },
];

async function main() {
  const uiPath = path.join(process.cwd(), 'electron/ui/modules/external-traffic.js');
  const uiScript = `${fs.readFileSync(uiPath, 'utf8')}
window.__structuredUiTest = {
  render: _renderV2ResultCard,
  show: extTrafficShowStructuredVariant,
  setSource(url) { _selectedSource = { url, title: 'source' }; },
};`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1360, height: 980 } });
  await page.setContent('<!doctype html><html><body style="background:#0f172a"><div id="app"></div></body></html>');
  await page.addScriptTag({ content: uiScript });

  const results = [];
  for (const item of CASES) {
    const result = await page.evaluate(({ platform, cached, sourceUrl }) => {
      window.__structuredUiTest.setSource(sourceUrl);
      document.getElementById('app').innerHTML = window.__structuredUiTest.render(platform, cached);
      window.__structuredUiTest.show(platform.id, 2);
      const textareas = Array.from(document.querySelectorAll('textarea'));
      const tabs = Array.from(document.querySelectorAll('button[id*="VariantTab_"]'));
      const panels = Array.from(document.querySelectorAll('section[id*="VariantPanel_"]'));
      const copy = textareas.map((ta) => ta.value).join('\n\n');
      return {
        id: platform.id,
        textareas: textareas.length,
        tabs: tabs.length,
        displays: panels.map((panel) => panel.style.display),
        hasContext: document.body.innerText.includes('자동분류')
          && document.body.innerText.includes('핵심주제')
          && document.body.innerText.includes('예상 독자')
          && document.body.innerText.includes('독자 상황'),
        hasUrl: copy.includes(sourceUrl),
        hasJson: /RESULT_JSON|"context"|"variants"/.test(copy),
      };
    }, { ...item, sourceUrl: SOURCE_URL });
    results.push(result);
  }

  await browser.close();
  const failed = results.filter((result) => (
    result.textareas !== 3
    || result.tabs !== 3
    || result.displays[2] !== 'block'
    || !result.hasContext
    || !result.hasUrl
    || result.hasJson
  ));
  if (failed.length) {
    throw new Error(`Structured UI smoke failed: ${JSON.stringify(failed, null, 2)}`);
  }
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
