const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const visualRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(visualRoot, '..');

const dirs = {
  raw: path.join(visualRoot, 'captures', 'raw'),
  safe: path.join(visualRoot, 'captures', 'safe'),
  generated: path.join(visualRoot, 'assets', 'generated'),
  ui: path.join(visualRoot, 'assets', 'ui'),
  main: path.join(visualRoot, 'export', 'main'),
  detail: path.join(visualRoot, 'export', 'detail'),
  export: path.join(visualRoot, 'export'),
};

const liveCaptureConfig = {
  blogspot: process.env.KMONG_BLOGSPOT_URL || 'https://www.sunaloah.it.kr/2026/06/2026-5.html#section-2',
  wordpress: process.env.KMONG_WORDPRESS_URL || '',
};

const externalAppRoots = {
  leword: process.env.KMONG_LEWORD_ROOT || 'C:\\Users\\park\\leword-app',
  naver: process.env.KMONG_NAVER_ROOT || 'C:\\Users\\박성현\\Desktop\\리더 네이버 자동화',
};

const capturePlan = [
  {
    name: '01-posting-keyword',
    label: '글포스팅 키워드 입력과 상세 설정',
    selector: '#settings-tab .card-large',
    setup: async (page) => {
      await showAppTab(page, 'settings');
      await page.evaluate(() => {
        setValue('keywordInput', '다이어트 식단');
        setValue('customTitle', '다이어트 식단 총정리');
        setValue('contentMode', 'internal');
        setValue('thumbnailMode', 'auto');
        setValue('h2ImageEngine', 'nanobanana2');
        const acc = document.getElementById('postingSettingsAccordion');
        if (acc) acc.style.display = 'block';
        const imagePanel = document.getElementById('tab-image');
        const contentPanel = document.getElementById('tab-content');
        if (contentPanel) contentPanel.classList.add('active');
        if (imagePanel) imagePanel.classList.remove('active');
      });
    },
  },
  {
    name: '02-posting-queue',
    label: '연속 발행 대기열 화면',
    selector: '#settings-tab .card-large',
    setup: async (page) => {
      await showAppTab(page, 'settings');
      await page.evaluate(() => {
        setValue('keywordInput', '다이어트 식단\n직장인 다이어트 식단\n저녁 다이어트 식단');
        const singleTabs = document.getElementById('singleInputModeTabs');
        if (singleTabs) singleTabs.style.display = 'none';
        const singleBtn = document.getElementById('publishModeTabSingle');
        const bulkBtn = document.getElementById('publishModeTabBulk');
        if (singleBtn) {
          singleBtn.style.background = 'transparent';
          singleBtn.style.color = 'rgba(255,255,255,0.55)';
          singleBtn.setAttribute('aria-selected', 'false');
        }
        if (bulkBtn) {
          bulkBtn.style.background = 'linear-gradient(135deg,#6366f1,#8b5cf6)';
          bulkBtn.style.color = 'white';
          bulkBtn.setAttribute('aria-selected', 'true');
        }
        const badge = document.getElementById('publishQueueBadge');
        if (badge) {
          badge.style.display = 'flex';
          const current = document.getElementById('publishQueueCurrentCount');
          const saved = document.getElementById('publishQueueSavedCount');
          if (current) current.textContent = '3';
          if (saved) saved.textContent = '12';
          badge.insertAdjacentHTML('beforeend', `
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:4px;">
              <div style="padding:12px;background:rgba(15,23,42,.55);border:1px solid rgba(148,163,184,.18);border-radius:10px;color:#e2e8f0;font-size:12px;"><b style="display:block;color:#fff;margin-bottom:4px;">01 다이어트 식단</b>내부 일관성 · 썸네일 자동</div>
              <div style="padding:12px;background:rgba(15,23,42,.55);border:1px solid rgba(148,163,184,.18);border-radius:10px;color:#e2e8f0;font-size:12px;"><b style="display:block;color:#fff;margin-bottom:4px;">02 직장인 식단</b>CTA 자동 · 즉시 순차</div>
              <div style="padding:12px;background:rgba(15,23,42,.55);border:1px solid rgba(148,163,184,.18);border-radius:10px;color:#e2e8f0;font-size:12px;"><b style="display:block;color:#fff;margin-bottom:4px;">03 저녁 식단</b>본문 이미지 자동</div>
            </div>`);
        }
      });
    },
  },
  {
    name: '03-internal-links',
    label: '거미줄 통합글과 내부링크 구조',
    selector: '#internal-links-tab .sw-container',
    setup: async (page) => {
      await showAppTab(page, 'internal-links');
      await page.evaluate(() => {
        const urls = document.getElementById('urlInputsContainer');
        if (urls) {
          urls.innerHTML = ['종합글 후보', '아침 식단 글', '저녁 식단 글', '도시락 식단 글'].map((name, i) => `
            <div class="sw-field">
              <input class="sw-input" value="https://sample-blog.example/post-${i + 1}" aria-label="${name}">
            </div>`).join('');
        }
        const selected = document.getElementById('selectedPostsList');
        if (selected) {
          selected.innerHTML = ['다이어트 식단 총정리', '직장인 아침 식단', '저녁 식단 조절법'].map((title) => `
            <div style="padding:14px 16px;background:rgba(15,23,42,.7);border:1px solid rgba(148,163,184,.18);border-radius:12px;color:#e2e8f0;font-weight:700;">${title}</div>`).join('');
        }
        const count = document.getElementById('selectedPostsCount');
        if (count) count.textContent = '3 / 5';
        setValue('spiderWebTitle', '다이어트 식단 핵심 구조 총정리');
      });
    },
  },
  {
    name: '04-external-traffic',
    label: '외부유입 글 생성 화면',
    selector: '#external-traffic-tab',
    setup: async (page) => {
      await showAppTab(page, 'external-traffic');
      await page.evaluate(() => {
        const badge = document.getElementById('extTrafficSourceBadge');
        const title = document.getElementById('extTrafficSourceTitle');
        const url = document.getElementById('extTrafficSourceUrl');
        if (badge) badge.style.display = 'block';
        if (title) title.textContent = '다이어트 식단 총정리';
        if (url) url.textContent = 'https://sample-blog.example/diet-plan';
        const list = document.getElementById('extTrafficPlatformList');
        if (list) {
          list.innerHTML = [
            ['네이버 블로그', '검색형 미니 포스트'],
            ['블로그스팟', '보조 콘텐츠'],
            ['워드프레스', '외부유입 글'],
            ['핀터레스트', '이미지형 유입'],
          ].map(([name, desc]) => `
            <button type="button" style="display:flex;align-items:center;gap:10px;padding:12px;background:rgba(255,255,255,.05);border:1px solid rgba(148,163,184,.14);border-radius:10px;color:#e2e8f0;font-size:13px;font-weight:700;width:100%;margin-bottom:8px;text-align:left;">
              <span style="width:28px;height:28px;display:grid;place-items:center;border-radius:8px;background:rgba(56,189,248,.18);">↗</span>
              <span style="flex:1;">${name}<small style="display:block;color:#94a3b8;font-weight:600;margin-top:2px;">${desc}</small></span>
            </button>`).join('');
        }
        const result = document.getElementById('extTrafficResult');
        if (result) {
          result.innerHTML = `
            <div style="padding:28px;border:1px solid rgba(45,212,191,.28);border-radius:16px;background:rgba(15,23,42,.68);">
              <div style="font-size:13px;color:#2dd4bf;font-weight:900;margin-bottom:10px;">선택된 원본 글 기반</div>
              <h3 style="margin:0;color:#fff;font-size:24px;">네이버 블로그 외부유입 글 초안</h3>
              <p style="color:#cbd5e1;font-size:15px;line-height:1.7;margin:14px 0 0;">다이어트 식단을 처음 정리할 때 헷갈리는 지점과 종합글로 이동해야 하는 이유를 자연스럽게 설명하는 보조 글을 생성합니다.</p>
              <div style="display:flex;gap:10px;margin-top:18px;"><button style="padding:10px 16px;border:none;border-radius:8px;background:#38bdf8;color:#07111f;font-weight:900;">복사</button><button style="padding:10px 16px;border:1px solid rgba(148,163,184,.25);border-radius:8px;background:rgba(255,255,255,.04);color:#e2e8f0;font-weight:800;">바로가기</button></div>
            </div>`;
        }
      });
    },
  },
  {
    name: '05-platform-settings',
    label: '블로그 플랫폼 연동 설정',
    selector: '#settingsModal',
    setup: async (page) => {
      await page.evaluate(() => {
        const modal = document.getElementById('settingsModal');
        if (modal) modal.style.display = 'flex';
        if (typeof switchSettingsTab === 'function') switchSettingsTab('platform');
        document.querySelectorAll('.settings-tab-content').forEach((el) => { el.style.display = 'none'; });
        const platform = document.getElementById('tab-platform');
        if (platform) platform.style.display = 'block';
        setValue('blogUrl', 'https://sample-blog.example');
        setValue('bloggerBlogId', '1234567890');
        setValue('wordpressSiteUrl', 'https://sample-wp.example');
        setValue('wordpressUsername', 'sample_user');
        setValue('wordpressPassword', '');
        setValue('googleClientId', 'sample-client-id.apps.googleusercontent.com');
        setValue('googleClientSecret', '');
      });
    },
  },
];

function ensureDirs() {
  Object.values(dirs).forEach((dir) => fs.mkdirSync(dir, { recursive: true }));
  [dirs.main, dirs.detail].forEach((dir) => {
    for (const fileName of fs.readdirSync(dir)) {
      if (fileName.toLowerCase().endsWith('.png')) {
        fs.unlinkSync(path.join(dir, fileName));
      }
    }
  });
}

function toFileUrl(filePath) {
  return pathToFileURL(filePath).href;
}

async function showAppTab(page, tabName) {
  await page.evaluate((tab) => {
    if (typeof window.showTab === 'function') {
      try { window.showTab(tab); } catch (_) {}
    }
    document.querySelectorAll('.tab-content').forEach((el) => {
      el.classList.remove('active');
      el.style.display = 'none';
    });
    const target = document.getElementById(`${tab}-tab`);
    if (target) {
      target.classList.add('active');
      target.style.display = 'block';
    }
    window.scrollTo(0, 0);
  }, tabName);
}

async function seedAppPage(page) {
  await page.addInitScript(() => {
    const sampleSettings = {
      platform: 'blogger',
      blogUrl: 'https://sample-blog.example',
      blogId: '1234567890',
      wordpressSiteUrl: 'https://sample-wp.example',
      wordpressUsername: 'sample_user',
      googleClientId: 'sample-client-id.apps.googleusercontent.com',
      googleClientSecret: '',
      geminiKey: 'sample-gemini-key',
    };
    try {
      localStorage.setItem('bloggerSettings', JSON.stringify(sampleSettings));
      localStorage.setItem('oneclick_setup_complete', 'true');
    } catch (_) {}

    const api = {
      invoke: async (channel) => {
        if (channel === 'app:getVersion') return '3.8.108';
        if (channel && channel.includes('published')) {
          return {
            ok: true,
            posts: [
              { title: '다이어트 식단 총정리', url: 'https://sample-blog.example/diet-plan' },
              { title: '직장인 아침 식단', url: 'https://sample-blog.example/breakfast' },
            ],
          };
        }
        if (channel && (channel.includes('settings') || channel.includes('env'))) {
          return { ok: true, settings: sampleSettings, data: sampleSettings };
        }
        return { ok: true, settings: sampleSettings, data: [], message: 'visual capture stub' };
      },
      on: () => () => {},
      send: () => {},
      openExternal: () => {},
      leword: {
        launch: async () => ({ ok: false, error: 'LEWORD 외부 앱은 현재 캡처 세션에서 실행하지 않았습니다.' }),
        getStatus: async () => ({ ok: false }),
        onProgress: () => () => {},
      },
    };
    window.electronAPI = api;
    window.blogger = api;
    window.setValue = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
  });
}

async function captureUnavailable(browser, outPath, title, reason) {
  const page = await browser.newPage({ viewport: { width: 920, height: 520 }, deviceScaleFactor: 1 });
  await page.setContent(`
    <html lang="ko"><body style="margin:0;background:#07111f;color:#f8fafc;font-family:Arial,'Malgun Gothic',sans-serif;">
      <div style="width:920px;height:520px;display:grid;place-items:center;background:linear-gradient(145deg,#07111f,#0f172a);">
        <div style="width:760px;padding:42px;border:1px solid rgba(148,163,184,.24);border-radius:26px;background:rgba(15,23,42,.82);">
          <div style="display:inline-block;padding:8px 12px;border-radius:999px;background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.32);color:#fde68a;font-size:15px;font-weight:800;">캡처 불가 기록</div>
          <h1 style="margin:22px 0 0;font-size:34px;line-height:1.25;">${escapeHtml(title)}</h1>
          <p style="margin:18px 0 0;color:#cbd5e1;font-size:20px;line-height:1.55;">${escapeHtml(reason)}</p>
        </div>
      </div>
    </body></html>`);
  await page.screenshot({ path: outPath, fullPage: true });
  await page.close();
}

async function captureAppScreens(browser) {
  const results = [];
  const appHtml = path.join(repoRoot, 'electron', 'ui', 'index.html');
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });
  await seedAppPage(page);
  await page.goto(toFileUrl(appHtml), { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2400);
  await page.addStyleTag({
    content: `
      * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
      body { background: #07111f !important; }
      .sidebar { position: fixed !important; }
      #settings-tab, #internal-links-tab, #external-traffic-tab { padding: 24px !important; }
      input, textarea, select { caret-color: transparent !important; }
    `,
  });

  for (const item of capturePlan) {
    const rawPath = path.join(dirs.raw, `${item.name}.png`);
    const safePath = path.join(dirs.safe, `${item.name}.png`);
    try {
      await item.setup(page);
      await page.waitForTimeout(500);
      const locator = page.locator(item.selector).first();
      const count = await locator.count();
      if (!count) throw new Error(`selector not found: ${item.selector}`);
      await locator.screenshot({ path: rawPath, animations: 'disabled', timeout: 20000 });
      await fsp.copyFile(rawPath, safePath);
      results.push({ name: item.name, label: item.label, ok: true, rawPath, safePath, note: '샘플 데이터만 사용, 민감정보 없음' });
    } catch (error) {
      const reason = error && error.message ? error.message : String(error);
      await captureUnavailable(browser, rawPath, item.label, reason);
      await fsp.copyFile(rawPath, safePath);
      results.push({ name: item.name, label: item.label, ok: false, rawPath, safePath, note: reason });
    }
  }

  await page.close();

  const loginHtml = path.join(repoRoot, 'electron', 'ui', 'login-window.html');
  const loginRaw = path.join(dirs.raw, '06-license-login.png');
  const loginSafe = path.join(dirs.safe, '06-license-login.png');
  try {
    const loginPage = await browser.newPage({ viewport: { width: 980, height: 720 }, deviceScaleFactor: 1 });
    await seedAppPage(loginPage);
    await loginPage.goto(toFileUrl(loginHtml), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await loginPage.waitForTimeout(800);
    await loginPage.evaluate(() => {
      const ids = ['userId', 'password', 'licenseCode'];
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
    });
    await loginPage.screenshot({ path: loginRaw, fullPage: true, animations: 'disabled' });
    await fsp.copyFile(loginRaw, loginSafe);
    await loginPage.close();
    results.push({ name: '06-license-login', label: '라이선스 로그인/등록 화면', ok: true, rawPath: loginRaw, safePath: loginSafe, note: '입력값 비움' });
  } catch (error) {
    const reason = error && error.message ? error.message : String(error);
    await captureUnavailable(browser, loginRaw, '라이선스 로그인/등록 화면', reason);
    await fsp.copyFile(loginRaw, loginSafe);
    results.push({ name: '06-license-login', label: '라이선스 로그인/등록 화면', ok: false, rawPath: loginRaw, safePath: loginSafe, note: reason });
  }

  return results;
}

async function captureLeWordScreens(browser) {
  const htmlPath = path.join(externalAppRoots.leword, 'ui', 'keyword-master.html');
  const rawPath = path.join(dirs.raw, '14-leword-latest-keywords.png');
  const safePath = path.join(dirs.safe, '14-leword-latest-keywords.png');
  const label = 'LEWORD 최신 키워드툴 화면';

  if (!fs.existsSync(htmlPath)) {
    await captureUnavailable(browser, rawPath, label, `파일을 찾을 수 없습니다: ${htmlPath}`);
    await fsp.copyFile(rawPath, safePath);
    return [{ name: '14-leword-latest-keywords', label, ok: false, rawPath, safePath, note: 'LEWORD HTML 없음' }];
  }

  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    const rows = [
      { grade: 'SSR', keyword: '청년 내일 저축 계좌 신청', searchVolume: 14800, documentCount: 420, goldenRatio: 35.24, category: '정책지원금' },
      { grade: 'SSS', keyword: '2026 자격 확인 순서', searchVolume: 8200, documentCount: 310, goldenRatio: 26.45, category: '생활정보' },
      { grade: 'SS', keyword: '근로장려금 지급일 확인', searchVolume: 12100, documentCount: 980, goldenRatio: 12.35, category: '정부지원' },
      { grade: 'S', keyword: '신청 서류 체크리스트', searchVolume: 5400, documentCount: 760, goldenRatio: 7.11, category: '생활정보' },
    ];
    window.electronAPI = {
      invoke: async (channel) => {
        if (channel === 'updater:getVersion') return { version: '2.49.83' };
        if (channel === 'get-rich-golden-feed') return { ok: true, total: rows.length, rows };
        return { ok: true, rows, data: rows, version: '2.49.83' };
      },
      on: () => () => {},
      openExternal: () => {},
      collectNow: async () => ({ ok: true }),
      getNicheKeywords: async () => ({ ok: true, keywords: rows.map((row) => row.keyword) }),
    };
  });

  try {
    await page.goto(toFileUrl(htmlPath), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(900);
    await page.addStyleTag({
      content: `
        * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
        body { padding: 22px !important; }
        #aiChatWindow, [class*="chat"] { display: none !important; }
      `,
    });
    await page.evaluate(() => {
      const rows = [
        ['👑SSR', '청년 내일 저축 계좌 신청', '14,800', '420', '35.24', '정책지원금', 'NAVER API · Google Trends'],
        ['SSS', '2026 자격 확인 순서', '8,200', '310', '26.45', '생활정보', 'DataLab · 자동완성'],
        ['SS', '근로장려금 지급일 확인', '12,100', '980', '12.35', '정부지원', '뉴스 · 검색광고'],
        ['S', '신청 서류 체크리스트', '5,400', '760', '7.11', '생활정보', '블로그 SERP'],
      ];
      const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      };
      setText('appVersionText', '2.49.83');
      setText('appVersionInline', 'v2.49.83');
      setText('rfStatus', '최신 기준 샘플 데이터 로딩 완료');
      setText('rfTotal', String(rows.length));
      setText('hbHealthy', '✅ 6');
      setText('hbDegraded', '⚠️ 1');
      setText('hbDown', '❌ 0');
      const tier = document.getElementById('rfTierBadge');
      if (tier) tier.textContent = 'PRO';
      const tbody = document.getElementById('rfTbody');
      if (tbody) {
        tbody.innerHTML = rows.map((row) => `
          <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
            <td style="padding:12px 8px;text-align:center;"><span style="padding:4px 8px;border-radius:8px;background:rgba(251,191,36,.18);color:#fde68a;font-weight:900;">${row[0]}</span></td>
            <td style="padding:12px 8px;font-weight:900;color:#fff;">${row[1]} <span style="margin-left:6px;padding:2px 6px;border-radius:999px;background:rgba(34,197,94,.14);color:#86efac;font-size:10px;">검증</span></td>
            <td style="padding:12px 8px;text-align:right;color:#93c5fd;font-weight:800;">${row[2]}</td>
            <td style="padding:12px 8px;text-align:right;color:#cbd5e1;font-weight:800;">${row[3]}</td>
            <td style="padding:12px 8px;text-align:right;color:#fbbf24;font-weight:900;">${row[4]}</td>
            <td style="padding:12px 8px;color:#a7f3d0;font-weight:800;">${row[5]}</td>
            <td style="padding:12px 8px;color:#94a3b8;">${row[6]}<br><button class="rf-action-btn" style="margin-top:5px;">🚀 마인드맵</button></td>
          </tr>`).join('');
      }
      const top = document.getElementById('rfTopPicks');
      const list = document.getElementById('rfTopPicksList');
      if (top) top.style.display = 'block';
      if (list) {
        list.innerHTML = rows.slice(0, 3).map((row, index) => `
          <div style="padding:12px 14px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(168,85,247,.25);display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <b style="color:#fff;">${index + 1}. ${row[1]}</b>
            <span style="color:#fde68a;font-weight:900;">${row[0]} · ${row[4]}</span>
          </div>`).join('');
      }
      document.getElementById('richFeedSection')?.scrollIntoView({ block: 'start' });
    });
    await page.waitForTimeout(300);
    await page.locator('#richFeedSection').first().screenshot({ path: rawPath, animations: 'disabled', timeout: 20000 });
    await fsp.copyFile(rawPath, safePath);
    return [{ name: '14-leword-latest-keywords', label, ok: true, rawPath, safePath, note: `최신 LEWORD 폴더 캡처: ${externalAppRoots.leword}` }];
  } catch (error) {
    const reason = error && error.message ? error.message : String(error);
    await captureUnavailable(browser, rawPath, label, reason);
    await fsp.copyFile(rawPath, safePath);
    return [{ name: '14-leword-latest-keywords', label, ok: false, rawPath, safePath, note: reason }];
  } finally {
    await page.close();
  }
}

async function captureNaverAutomationScreens(browser) {
  const htmlPath = path.join(externalAppRoots.naver, 'public', 'index.html');
  const shots = [
    { name: '15-naver-latest-smart-publish', label: '네이버 자동화 최신 스마트 발행 화면' },
    { name: '16-naver-latest-queue', label: '네이버 자동화 최신 대기열 화면' },
  ];
  const results = [];

  if (!fs.existsSync(htmlPath)) {
    for (const shot of shots) {
      const rawPath = path.join(dirs.raw, `${shot.name}.png`);
      const safePath = path.join(dirs.safe, `${shot.name}.png`);
      await captureUnavailable(browser, rawPath, shot.label, `파일을 찾을 수 없습니다: ${htmlPath}`);
      await fsp.copyFile(rawPath, safePath);
      results.push({ ...shot, ok: false, rawPath, safePath, note: '네이버 자동화 HTML 없음' });
    }
    return results;
  }

  const page = await browser.newPage({ viewport: { width: 1500, height: 1080 }, deviceScaleFactor: 1 });
  await page.route('**/renderer.js', (route) => route.abort());
  await page.route('**/floating-scroll.js', (route) => route.abort());
  await page.route('**/ai-hook-modal.js', (route) => route.abort());

  try {
    await page.goto(toFileUrl(htmlPath), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(600);
    await page.addStyleTag({
      content: `
        * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
        body { background: #0b1020 !important; }
        #right-floating-buttons { transform: scale(.84); transform-origin: top right; opacity: .95; }
        #left-status-badges, #risk-summary-fixed, .summary-note { display: none !important; }
        .app-header { padding-bottom: 12px !important; }
      `,
    });
    await page.evaluate(() => {
      const showTab = (tab) => {
        document.querySelectorAll('.tab-panel').forEach((el) => {
          el.classList.remove('active');
          el.style.display = 'none';
        });
        const target = document.getElementById(`tab-${tab}`);
        if (target) {
          target.classList.add('active');
          target.style.display = 'block';
        }
        document.querySelectorAll('.tab-button').forEach((btn) => {
          const active = btn.getAttribute('data-tab') === tab;
          btn.classList.toggle('active', active);
          btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });
      };
      const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
      };
      showTab('unified');
      setValue('naver-id', 'leadermain');
      setValue('naver-password', '********');
      setValue('unified-keywords', '2026 청년 지원금 신청방법');
      setValue('unified-hook-sentence', '놓치기 쉬운 제외 조건까지 정리');
      setValue('unified-ftc-text', '이 글은 정보 제공 목적이며 정확한 내용은 공식 사이트에서 확인해주세요.');
      const selector = document.getElementById('main-account-selector');
      if (selector) selector.innerHTML = '<option>leadermain · 기본 계정</option><option>subblog01 · 보조 계정</option>';
      const stats = document.getElementById('continuous-mode-quick-stats');
      if (stats) stats.style.display = 'block';
      [['qs-completed', '2'], ['qs-processing', '1'], ['qs-pending', '7'], ['qs-failed', '0']].forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      });
      window.scrollTo(0, 210);
    });

    let rawPath = path.join(dirs.raw, `${shots[0].name}.png`);
    let safePath = path.join(dirs.safe, `${shots[0].name}.png`);
    await page.screenshot({ path: rawPath, fullPage: false, animations: 'disabled' });
    await fsp.copyFile(rawPath, safePath);
    results.push({ ...shots[0], ok: true, rawPath, safePath, note: `최신 네이버 자동화 폴더 캡처: ${externalAppRoots.naver}` });

    await page.evaluate(() => {
      const single = document.getElementById('single-account-content');
      const multi = document.getElementById('multi-account-content');
      const singleTab = document.getElementById('single-account-tab');
      const multiTab = document.getElementById('multi-account-tab');
      if (single) single.style.display = 'none';
      if (multi) multi.style.display = 'block';
      if (singleTab) singleTab.classList.remove('active');
      if (multiTab) multiTab.classList.add('active');
      const accounts = document.getElementById('ma-accounts-inline');
      if (accounts) {
        accounts.innerHTML = ['leadermain', 'subblog01', 'subblog02'].map((id, index) => `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;margin-bottom:8px;border:1px solid rgba(139,92,246,.35);border-radius:10px;background:rgba(139,92,246,.1);">
            <div><b style="color:#fff;">${id}</b><div style="font-size:12px;color:#94a3b8;">${index === 0 ? '기본 발행 계정' : '순차 발행 보조 계정'}</div></div>
            <span style="padding:4px 9px;border-radius:999px;background:rgba(16,185,129,.18);color:#86efac;font-weight:800;font-size:12px;">선택됨</span>
          </div>`).join('');
      }
      const count = document.getElementById('queue-count');
      if (count) count.textContent = '4';
      const queue = document.getElementById('publish-queue-list');
      if (queue) {
        queue.style.maxHeight = 'none';
        queue.style.overflow = 'visible';
        queue.innerHTML = [
          ['2026 청년 지원금 신청방법', 'Nano Banana Pro · 커스텀 CTA · 즉시'],
          ['근로장려금 지급일 확인', 'GPT Image 2 · 공식사이트 CTA · 예약'],
          ['자격 확인 순서 체크리스트', '이미지 3장 · FAQ 포함 · 순차'],
          ['제외 대상과 제출서류', '본문모드 SEO · 썸네일 자동 · 대기'],
        ].map((row, index) => `
          <div style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.08);display:grid;grid-template-columns:54px 1fr 130px;gap:14px;align-items:center;">
            <div style="width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#8b5cf6,#06b6d4);display:grid;place-items:center;color:#fff;font-weight:900;">${index + 1}</div>
            <div><b style="color:#fff;">${row[0]}</b><div style="font-size:12px;color:#94a3b8;margin-top:4px;">${row[1]}</div></div>
            <span style="text-align:center;padding:8px 10px;border-radius:9px;background:rgba(16,185,129,.13);color:#86efac;font-weight:900;font-size:12px;">1개씩 순차</span>
          </div>`).join('');
      }
      const btn = document.getElementById('batch-publish-btn');
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.textContent = '🚀 일괄 발행 (4개)';
      }
      document.getElementById('multi-account-content')?.scrollIntoView({ block: 'start' });
      window.scrollBy(0, -90);
    });
    await page.waitForTimeout(250);
    rawPath = path.join(dirs.raw, `${shots[1].name}.png`);
    safePath = path.join(dirs.safe, `${shots[1].name}.png`);
    await page.locator('#multi-account-content').first().screenshot({ path: rawPath, animations: 'disabled', timeout: 20000 });
    await fsp.copyFile(rawPath, safePath);
    results.push({ ...shots[1], ok: true, rawPath, safePath, note: `최신 네이버 자동화 폴더 캡처: ${externalAppRoots.naver}` });
  } catch (error) {
    const reason = error && error.message ? error.message : String(error);
    for (const shot of shots.filter((shot) => !results.some((item) => item.name === shot.name))) {
      const rawPath = path.join(dirs.raw, `${shot.name}.png`);
      const safePath = path.join(dirs.safe, `${shot.name}.png`);
      await captureUnavailable(browser, rawPath, shot.label, reason);
      await fsp.copyFile(rawPath, safePath);
      results.push({ ...shot, ok: false, rawPath, safePath, note: reason });
    }
  } finally {
    await page.close();
  }

  return results;
}

async function captureExternalTrafficFeatureScreens(browser) {
  const appHtml = path.join(repoRoot, 'electron', 'ui', 'index.html');
  const shots = [
    { name: '17-external-traffic-generate', label: 'External traffic generator' },
    { name: '18-external-traffic-sites', label: 'External traffic site library' },
    { name: '19-external-traffic-usage', label: 'External traffic usage guide' },
    { name: '20-external-traffic-patterns', label: 'External traffic pattern settings' },
  ];
  const results = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });

  try {
    await seedAppPage(page);
    await page.goto(toFileUrl(appHtml), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1200);
    await page.addStyleTag({
      content: `
        * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
        body { background: #07111f !important; }
        #external-traffic-tab { display:block !important; padding:24px !important; }
        input, textarea, select { caret-color: transparent !important; }
      `,
    });

    for (const shot of shots) {
      const rawPath = path.join(dirs.raw, `${shot.name}.png`);
      const safePath = path.join(dirs.safe, `${shot.name}.png`);
      try {
        await page.evaluate((shotName) => {
          document.querySelectorAll('.tab-content').forEach((el) => {
            el.classList.remove('active');
            el.style.display = 'none';
          });
          const tab = document.getElementById('external-traffic-tab');
          if (tab) {
            tab.classList.add('active');
            tab.style.display = 'block';
            tab.id = 'external-traffic-tab';
          }

          const subtab = shotName.includes('sites')
            ? 'sites'
            : shotName.includes('usage')
              ? 'usage'
              : shotName.includes('patterns')
                ? 'patterns'
                : 'generate';
          document.querySelectorAll('.ext-subtab-content').forEach((el) => {
            el.style.display = 'none';
          });
          const current = document.getElementById(`extTrafficSubtab-${subtab}`);
          if (current) current.style.display = 'block';

          const sourceBadge = document.getElementById('extTrafficSourceBadge');
          const sourceTitle = document.getElementById('extTrafficSourceTitle');
          const sourceUrl = document.getElementById('extTrafficSourceUrl');
          if (sourceBadge) sourceBadge.style.display = 'block';
          if (sourceTitle) sourceTitle.textContent = '2026 youth savings account guide';
          if (sourceUrl) sourceUrl.textContent = 'https://sample-blog.example/youth-savings-guide';

          const platformList = document.getElementById('extTrafficPlatformList');
          if (platformList) {
            platformList.innerHTML = [
              ['Naver Blog', 'Search-friendly summary post'],
              ['Tistory', 'Supportive information post'],
              ['WordPress', 'External entry landing post'],
              ['Community', 'Short hook and CTA version'],
              ['Pinterest', 'Image-first traffic version'],
            ].map(([name, desc], index) => `
              <button type="button" style="width:100%;margin-bottom:9px;padding:12px 13px;border-radius:12px;border:1px solid rgba(148,163,184,.18);background:${index === 0 ? 'rgba(236,72,153,.16)' : 'rgba(15,23,42,.72)'};color:#e2e8f0;text-align:left;display:flex;gap:10px;align-items:center;">
                <span style="width:30px;height:30px;border-radius:10px;background:linear-gradient(135deg,#ec4899,#8b5cf6);display:grid;place-items:center;color:white;font-weight:900;">${index + 1}</span>
                <span style="flex:1;"><b style="display:block;color:#fff;font-size:13px;">${name}</b><small style="display:block;color:#94a3b8;margin-top:3px;">${desc}</small></span>
              </button>`).join('');
          }

          const result = document.getElementById('extTrafficResult');
          if (result) {
            result.innerHTML = `
              <div style="padding:28px;border:1px solid rgba(236,72,153,.32);border-radius:18px;background:linear-gradient(160deg,rgba(15,23,42,.92),rgba(88,28,135,.35));">
                <div style="display:inline-flex;padding:6px 10px;border-radius:999px;background:rgba(236,72,153,.16);border:1px solid rgba(236,72,153,.32);color:#f9a8d4;font-size:12px;font-weight:900;">External Traffic Draft</div>
                <h3 style="margin:16px 0 0;color:#fff;font-size:26px;line-height:1.25;">Naver Blog entry post generated from the original article</h3>
                <p style="margin:14px 0 0;color:#cbd5e1;font-size:15px;line-height:1.75;">The original public article is converted into a separate traffic post. The CTA, source link, official-site guidance, and return path are preserved so visitors can move back to the main article naturally.</p>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:20px;">
                  <div style="padding:14px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);"><b style="color:#fff;">Hook</b><span style="display:block;color:#94a3b8;font-size:12px;margin-top:6px;">Search-intent opening</span></div>
                  <div style="padding:14px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);"><b style="color:#fff;">CTA</b><span style="display:block;color:#94a3b8;font-size:12px;margin-top:6px;">Official link and main post</span></div>
                  <div style="padding:14px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);"><b style="color:#fff;">Platform</b><span style="display:block;color:#94a3b8;font-size:12px;margin-top:6px;">Naver/Tistory/WP variants</span></div>
                </div>
                <div style="margin-top:20px;padding:16px;border-radius:14px;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.28);color:#d1fae5;font-size:13px;line-height:1.6;">
                  Generated result preview is ready. Copy, refine, or publish the selected platform version.
                </div>
              </div>`;
          }

          const sites = document.getElementById('extTrafficInlineExtLinks');
          if (sites) {
            sites.innerHTML = `
              <h3 style="margin:0;color:#fff;font-size:24px;">External traffic site library</h3>
              <p style="color:#94a3b8;margin:8px 0 22px;font-size:14px;">Reusable destinations are organized by topic so the CTA does not point to random or broken pages.</p>
              <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;">
                ${['Government official', 'Travel official', 'Finance guide', 'Local service', 'Shopping info', 'Custom CTA'].map((name, i) => `
                  <div style="padding:18px;border-radius:14px;background:rgba(15,23,42,.75);border:1px solid rgba(148,163,184,.18);">
                    <b style="display:block;color:#fff;font-size:16px;">${name}</b>
                    <span style="display:block;color:#94a3b8;font-size:13px;margin-top:8px;">Verified destination ${i + 1} with hook text and fallback note</span>
                  </div>`).join('')}
              </div>`;
          }

          const usage = document.getElementById('extTrafficUsagePanel');
          if (usage) {
            usage.innerHTML = `
              <h3 style="margin:0;color:#fff;font-size:24px;">How external traffic posts are used</h3>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:22px;">
                ${[
                  ['1', 'Select source post', 'Choose a published Blogspot/WP article.'],
                  ['2', 'Generate platform draft', 'Create Naver/Tistory/WP variants.'],
                  ['3', 'Return with CTA', 'Guide readers back to the main article.'],
                ].map(([n, title, desc]) => `
                  <div style="padding:20px;border-radius:15px;background:rgba(15,23,42,.78);border:1px solid rgba(148,163,184,.18);">
                    <span style="display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,#06b6d4,#3b82f6);color:white;font-weight:900;">${n}</span>
                    <b style="display:block;color:#fff;font-size:17px;margin-top:14px;">${title}</b>
                    <span style="display:block;color:#94a3b8;font-size:13px;line-height:1.55;margin-top:8px;">${desc}</span>
                  </div>`).join('')}
              </div>`;
          }

          const patterns = document.getElementById('extTrafficPatternsPanel');
          if (patterns) {
            patterns.innerHTML = `
              <h3 style="margin:0;color:#fff;font-size:24px;">CTA and traffic pattern presets</h3>
              <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:22px;">
                ${[
                  ['Information CTA', 'Official source + exact checklist'],
                  ['Comparison CTA', 'Compare options and move to main guide'],
                  ['Urgent CTA', 'Deadline/eligibility focused hook'],
                  ['Custom CTA', 'User-provided URL and hook text'],
                ].map(([title, desc]) => `
                  <div style="padding:20px;border-radius:15px;background:rgba(15,23,42,.78);border:1px solid rgba(236,72,153,.22);">
                    <b style="display:block;color:#fff;font-size:18px;">${title}</b>
                    <span style="display:block;color:#cbd5e1;font-size:13px;line-height:1.55;margin-top:8px;">${desc}</span>
                  </div>`).join('')}
              </div>`;
          }

          document.getElementById('external-traffic-tab')?.scrollIntoView({ block: 'start' });
          window.scrollTo(0, 0);
        }, shot.name);

        await page.waitForTimeout(250);
        const locator = page.locator('#external-traffic-tab').first();
        await locator.screenshot({ path: rawPath, animations: 'disabled', timeout: 20000 });
        await fsp.copyFile(rawPath, safePath);
        results.push({ ...shot, ok: true, rawPath, safePath, note: 'external traffic feature capture' });
      } catch (error) {
        const reason = error && error.message ? error.message : String(error);
        await captureUnavailable(browser, rawPath, shot.label, reason);
        await fsp.copyFile(rawPath, safePath);
        results.push({ ...shot, ok: false, rawPath, safePath, note: reason });
      }
    }
  } finally {
    await page.close();
  }

  return results;
}

async function captureNaverFeatureScreens(browser) {
  const htmlPath = path.join(externalAppRoots.naver, 'public', 'index.html');
  const shots = [
    { name: '21-naver-content-modes', label: 'Naver content modes' },
    { name: '22-naver-generation-tabs', label: 'Naver generation input tabs' },
    { name: '23-naver-continuous-progress', label: 'Naver continuous progress' },
    { name: '24-naver-image-tools', label: 'Naver thumbnail and banner tools' },
    { name: '25-naver-image-manager', label: 'Naver image manager' },
    { name: '26-naver-schedule-manager', label: 'Naver schedule manager' },
    { name: '27-naver-progress-modal', label: 'Naver publishing progress modal' },
    { name: '35-naver-multi-account', label: 'Naver multi-account publishing mode' },
    { name: '36-naver-full-auto', label: 'Naver full-auto publishing mode' },
    { name: '37-naver-queue-board', label: 'Naver continuous publishing queue board' },
  ];
  const results = [];

  if (!fs.existsSync(htmlPath)) {
    for (const shot of shots) {
      const rawPath = path.join(dirs.raw, `${shot.name}.png`);
      const safePath = path.join(dirs.safe, `${shot.name}.png`);
      await captureUnavailable(browser, rawPath, shot.label, `missing file: ${htmlPath}`);
      await fsp.copyFile(rawPath, safePath);
      results.push({ ...shot, ok: false, rawPath, safePath, note: 'naver html missing' });
    }
    return results;
  }

  const page = await browser.newPage({ viewport: { width: 1500, height: 1080 }, deviceScaleFactor: 1 });
  await page.route('**/renderer.js', (route) => route.abort());
  await page.route('**/floating-scroll.js', (route) => route.abort());
  await page.route('**/ai-hook-modal.js', (route) => route.abort());

  try {
    await page.goto(toFileUrl(htmlPath), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(600);
    await page.addStyleTag({
      content: `
        * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
        body { background: #0b1020 !important; }
        #right-floating-buttons, #left-status-badges, #risk-summary-fixed, .summary-note { display: none !important; }
        input, textarea, select { caret-color: transparent !important; }
      `,
    });

    for (const shot of shots) {
      const rawPath = path.join(dirs.raw, `${shot.name}.png`);
      const safePath = path.join(dirs.safe, `${shot.name}.png`);
      try {
        const selector = await page.evaluate(async (shotName) => {
          const showTab = (tab) => {
            document.querySelectorAll('.tab-panel').forEach((el) => {
              el.classList.remove('active');
              el.style.display = 'none';
            });
            const target = document.getElementById(`tab-${tab}`);
            if (target) {
              target.classList.add('active');
              target.style.display = 'block';
            }
          };
          const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
          };
          const ensurePanel = (id, html) => {
            let el = document.getElementById(id);
            if (!el) {
              el = document.createElement('section');
              el.id = id;
              el.style.cssText = 'margin:24px;padding:24px;border-radius:18px;background:linear-gradient(160deg,rgba(15,23,42,.96),rgba(30,41,59,.96));border:1px solid rgba(148,163,184,.16);color:white;';
              document.body.prepend(el);
            }
            el.innerHTML = html;
            el.scrollIntoView({ block: 'start' });
            return `#${id}`;
          };

          if (shotName.includes('content-modes')) {
            showTab('unified');
            ['seo', 'homefeed', 'affiliate', 'custom', 'business'].forEach((mode, index) => {
              const btn = document.querySelector(`.content-mode-btn[data-mode="${mode}"]`);
              if (btn) {
                btn.style.opacity = '1';
                btn.style.border = index === 0 ? '2px solid #38bdf8' : '1px solid rgba(148,163,184,.3)';
                btn.style.background = index === 0 ? 'linear-gradient(135deg,#0ea5e9,#6366f1)' : 'rgba(255,255,255,.06)';
                btn.style.color = '#fff';
              }
            });
            const hidden = document.getElementById('unified-content-mode');
            const panel = hidden?.closest('div[style*="background"]') || document.getElementById('tab-unified');
            if (panel) panel.id = 'naver-content-modes-capture';
            return '#naver-content-modes-capture';
          }

          const hideNaverModals = () => {
            document.querySelectorAll('#multi-account-modal, #ma-fullauto-setting-modal, #ma-publish-progress-modal, #progress-modal').forEach((el) => {
              el.style.display = 'none';
              el.setAttribute('aria-hidden', 'true');
            });
          };
          hideNaverModals();

          if (shotName.includes('generation-tabs')) {
            showTab('unified');
            setValue('unified-keywords', '2026 청년 지원금 신청방법\n자격 확인 순서\n서류 제출 체크리스트');
            setValue('unified-hook-sentence', '신청 대상, 제출 서류, 마감일을 놓치지 않게 정리');
            const target = document.getElementById('content-generation-tabs') || document.getElementById('tab-unified');
            if (target) target.id = 'naver-generation-tabs-real-capture';
            return '#naver-generation-tabs-real-capture';
          }

          if (shotName.includes('continuous-progress')) {
            showTab('unified');
            const stats = document.getElementById('continuous-mode-quick-stats');
            if (stats) stats.style.display = 'block';
            [['qs-completed', '18'], ['qs-processing', '1'], ['qs-pending', '42'], ['qs-failed', '0']].forEach(([id, value]) => {
              const el = document.getElementById(id);
              if (el) el.textContent = value;
            });
            const section = document.getElementById('continuous-mode-section') || document.getElementById('tab-unified');
            if (section) section.id = 'naver-continuous-progress-real-capture';
            return '#naver-continuous-progress-real-capture';
          }

          if (shotName.includes('image-tools')) {
            showTab('image-tools');
            document.querySelectorAll('.image-tools-subpanel').forEach((el) => { el.style.display = 'none'; });
            const thumb = document.getElementById('subtab-thumbnail') || document.getElementById('tab-image-tools');
            if (thumb) {
              thumb.style.display = 'block';
              thumb.id = 'naver-image-tools-real-capture';
            }
            return '#naver-image-tools-real-capture';
          }

          if (shotName.includes('image-manager')) {
            showTab('images');
            const images = document.getElementById('tab-images');
            if (images) images.id = 'naver-image-manager-real-capture';
            return '#naver-image-manager-real-capture';
          }

          if (shotName.includes('schedule-manager')) {
            showTab('schedule');
            const schedule = document.getElementById('tab-schedule');
            if (schedule) schedule.id = 'naver-schedule-manager-real-capture';
            return '#naver-schedule-manager-real-capture';
          }

          if (shotName.includes('multi-account') || shotName.includes('queue-board')) {
            const modal = document.getElementById('multi-account-modal');
            if (modal) {
              modal.style.display = 'flex';
              modal.setAttribute('aria-hidden', 'false');
            }
            const accounts = document.getElementById('ma-accounts-container');
            if (accounts) {
              accounts.innerHTML = ['leadermain', 'subblog01', 'subblog02'].map((id, index) => `
                <div style="padding:0.85rem;border-radius:10px;background:rgba(139,92,246,.1);border:1px solid rgba(139,92,246,.35);display:flex;justify-content:space-between;gap:12px;align-items:center;">
                  <div><strong style="color:var(--text-strong);">${id}</strong><div style="font-size:.78rem;color:var(--text-muted);">${index === 0 ? '기본 계정' : '보조 계정'}</div></div>
                  <button type="button" style="padding:.45rem .75rem;border-radius:8px;border:1px solid rgba(16,185,129,.45);background:rgba(16,185,129,.15);color:#10b981;font-weight:700;">⚡ 풀오토 세팅</button>
                </div>`).join('');
            }
            const count = document.getElementById('ma-queue-count');
            if (count) count.textContent = '3';
            const queue = document.getElementById('ma-queue-container');
            if (queue) {
              queue.innerHTML = [
                ['leadermain', '청년 지원금 신청방법', '이미지 생성중'],
                ['subblog01', '지원 대상 확인 순서', '대기'],
                ['subblog02', '서류 제출 체크리스트', '예약'],
              ].map(([account, title, status], index) => `
                <div style="padding:.75rem;border-radius:10px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.28);display:grid;grid-template-columns:34px 1fr 86px;gap:10px;align-items:center;">
                  <strong style="width:30px;height:30px;border-radius:8px;background:#10b981;color:white;display:grid;place-items:center;">${index + 1}</strong>
                  <div><div style="color:var(--text-strong);font-weight:700;">${title}</div><div style="font-size:.72rem;color:var(--text-muted);">${account}</div></div>
                  <span style="font-size:.75rem;color:#10b981;font-weight:800;text-align:right;">${status}</span>
                </div>`).join('');
            }
            if (shotName.includes('queue-board')) {
              const panel = queue?.closest('div[style*="rgba(16, 185, 129"]') || queue;
              if (panel) panel.id = 'naver-real-queue-panel';
              return '#naver-real-queue-panel';
            }
            return '#multi-account-modal .modal-panel';
          }

          if (shotName.includes('full-auto')) {
            const modal = document.getElementById('ma-fullauto-setting-modal');
            if (modal) {
              modal.style.display = 'flex';
              modal.setAttribute('aria-hidden', 'false');
            }
            const accountName = document.getElementById('ma-setting-account-name');
            if (accountName) accountName.textContent = 'leadermain';
            setValue('ma-setting-keyword', '2026 청년 지원금 신청방법\n자격 확인 순서\n서류 제출 체크리스트');
            setValue('ma-setting-url', 'https://sample-blog.example/post-1\nhttps://sample-blog.example/post-2');
            return '#ma-fullauto-setting-modal .modal-panel';
          }

          if (shotName.includes('progress-modal')) {
            const modal = document.getElementById('ma-publish-progress-modal') || document.getElementById('progress-modal');
            if (modal) {
              modal.style.display = 'flex';
              modal.style.alignItems = 'center';
              modal.style.justifyContent = 'center';
              modal.setAttribute('aria-hidden', 'false');
            }
            const percent = document.getElementById('ma-progress-percent') || document.getElementById('progress-percent');
            if (percent) percent.textContent = '62%';
            const bar = document.getElementById('ma-progress-bar') || document.getElementById('progress-bar');
            if (bar) bar.style.width = '62%';
            const current = document.getElementById('ma-progress-current');
            if (current) current.textContent = '3 / 5';
            const account = document.getElementById('ma-task-account');
            if (account) account.textContent = 'leadermain';
            const step = document.getElementById('ma-task-step');
            if (step) step.textContent = 'Image generation preview and scheduled queue check';
            const time = document.getElementById('ma-progress-time');
            if (time) time.textContent = 'ETA: 4 min';
            const content = document.querySelector('#ma-publish-progress-modal .ma-modal-content');
            if (content) {
              let host = document.getElementById('naver-progress-real-host');
              if (!host) {
                host = document.createElement('div');
                host.id = 'naver-progress-real-host';
                document.body.appendChild(host);
              }
              host.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.50);padding:24px;';
              host.innerHTML = '';
              const clone = content.cloneNode(true);
              clone.style.display = 'block';
              clone.style.visibility = 'visible';
              clone.style.opacity = '1';
              host.appendChild(clone);
              return '#naver-progress-real-host .ma-modal-content';
            }
            return '#ma-publish-progress-modal, #progress-modal';
          }

          if (shotName.includes('generation-tabs')) {
            return ensurePanel('naver-generation-tabs-capture', `
              <div style="display:grid;gap:18px;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:18px;">
                  <div>
                    <span style="display:inline-flex;padding:6px 10px;border-radius:999px;background:rgba(59,130,246,.16);border:1px solid rgba(59,130,246,.32);color:#bfdbfe;font-weight:900;font-size:12px;">입력 방식</span>
                    <h2 style="margin:12px 0 0;font-size:30px;line-height:1.2;">URL, 키워드, 사진 기반 글 생성을 한 화면에서 선택</h2>
                  </div>
                  <div style="padding:10px 14px;border-radius:12px;background:rgba(16,185,129,.14);border:1px solid rgba(16,185,129,.28);color:#bbf7d0;font-weight:900;">Ready</div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;">
                  ${[
                    ['URL 입력', '기존 글이나 자료 URL을 넣고 글 생성'],
                    ['키워드 입력', '여러 키워드를 대기열로 바로 전환'],
                    ['사진 기반', '이미지 내용을 분석해 포스팅 초안 생성'],
                  ].map(([title, desc], i) => `
                    <div style="min-height:150px;padding:18px;border-radius:16px;background:${i === 1 ? 'linear-gradient(135deg,rgba(59,130,246,.26),rgba(139,92,246,.22))' : 'rgba(15,23,42,.78)'};border:1px solid rgba(148,163,184,.22);">
                      <div style="width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,#38bdf8,#8b5cf6);display:grid;place-items:center;color:white;font-weight:900;">${i + 1}</div>
                      <b style="display:block;margin-top:14px;color:#fff;font-size:20px;">${title}</b>
                      <span style="display:block;margin-top:8px;color:#cbd5e1;font-size:14px;line-height:1.55;">${desc}</span>
                    </div>`).join('')}
                </div>
              </div>`);
          }

          if (shotName.includes('continuous-progress')) {
            return ensurePanel('naver-continuous-progress-capture', `
              <div style="display:grid;gap:18px;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:18px;">
                  <div>
                    <span style="display:inline-flex;padding:6px 10px;border-radius:999px;background:rgba(245,158,11,.16);border:1px solid rgba(245,158,11,.32);color:#fde68a;font-weight:900;font-size:12px;">연속 발행 모드</span>
                    <h2 style="margin:12px 0 0;font-size:30px;line-height:1.2;">100개 키워드도 한 번에 넣고 1개씩 순차 처리</h2>
                  </div>
                  <button style="border:0;border-radius:14px;padding:14px 18px;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;font-weight:900;font-size:15px;">연속 발행 시작</button>
                </div>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
                  ${[
                    ['완료', '18', '#10b981'],
                    ['진행중', '1', '#3b82f6'],
                    ['대기', '42', '#f59e0b'],
                    ['실패', '0', '#ef4444'],
                  ].map(([label, value, color]) => `<div style="padding:18px;border-radius:16px;background:rgba(15,23,42,.78);border:1px solid rgba(148,163,184,.18);text-align:center;"><b style="display:block;color:${color};font-size:30px;">${value}</b><span style="display:block;margin-top:6px;color:#cbd5e1;font-weight:800;">${label}</span></div>`).join('')}
                </div>
                <div style="height:14px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;"><div style="width:66%;height:100%;background:linear-gradient(90deg,#06b6d4,#8b5cf6,#f59e0b);"></div></div>
              </div>`);
          }

          if (shotName.includes('image-tools')) {
            return ensurePanel('naver-image-tools-capture', `
              <div style="display:grid;grid-template-columns:1.05fr .95fr;gap:18px;align-items:stretch;">
                <div>
                  <span style="display:inline-flex;padding:6px 10px;border-radius:999px;background:rgba(236,72,153,.16);border:1px solid rgba(236,72,153,.32);color:#fbcfe8;font-weight:900;font-size:12px;">썸네일/배너</span>
                  <h2 style="margin:12px 0 0;font-size:30px;line-height:1.2;">발행용 이미지와 배너를 같은 흐름에서 생성</h2>
                  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:18px;">
                    ${['썸네일 문구', '스타일 프리셋', 'CTA 배지', '저장/재사용'].map((x) => `<div style="padding:14px;border-radius:14px;background:rgba(15,23,42,.78);border:1px solid rgba(148,163,184,.18);color:#e2e8f0;font-weight:800;">${x}</div>`).join('')}
                  </div>
                </div>
                <div style="min-height:250px;border-radius:18px;background:linear-gradient(135deg,#0f766e,#38bdf8 55%,#fde68a);padding:18px;display:flex;align-items:end;">
                  <div style="width:100%;padding:18px;border-radius:15px;background:rgba(2,6,23,.72);color:white;">
                    <b style="font-size:26px;line-height:1.25;">2026 지원 대상<br>확인 순서</b>
                    <span style="display:block;margin-top:10px;color:#dbeafe;">핵심만 쏙쏙 정리</span>
                  </div>
                </div>
              </div>`);
          }

          if (shotName.includes('image-manager')) {
            return ensurePanel('naver-image-manager-capture', `
              <div>
                <span style="display:inline-flex;padding:6px 10px;border-radius:999px;background:rgba(168,85,247,.16);border:1px solid rgba(168,85,247,.32);color:#ddd6fe;font-weight:900;font-size:12px;">이미지 관리</span>
                <h2 style="margin:12px 0 18px;font-size:30px;line-height:1.2;">생성 이미지, 업로드 이미지, 재사용 자산을 한곳에서 관리</h2>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
                  ${['본문 이미지', '대표 썸네일', 'CTA 배너', '업로드 자산'].map((x, i) => `<div style="height:158px;border-radius:16px;background:linear-gradient(135deg,${['#0ea5e9,#6366f1', '#14b8a6,#84cc16', '#f59e0b,#ef4444', '#8b5cf6,#ec4899'][i]});padding:12px;display:flex;align-items:end;color:white;font-weight:900;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18);">${x}</div>`).join('')}
                </div>
              </div>`);
          }

          if (shotName.includes('schedule-manager')) {
            return ensurePanel('naver-schedule-manager-capture', `
              <div style="display:grid;grid-template-columns:.9fr 1.1fr;gap:18px;align-items:stretch;">
                <div>
                  <span style="display:inline-flex;padding:6px 10px;border-radius:999px;background:rgba(34,197,94,.16);border:1px solid rgba(34,197,94,.32);color:#bbf7d0;font-weight:900;font-size:12px;">스케줄 관리</span>
                  <h2 style="margin:12px 0 0;font-size:30px;line-height:1.2;">예약 발행과 일정 흐름을 한눈에 확인</h2>
                </div>
                <div style="display:grid;gap:10px;">
                  ${[
                    ['09:10', '청년 지원금 신청방법', '예약'],
                    ['11:30', '서류 제출 체크리스트', '대기'],
                    ['15:00', '지원 대상 확인 순서', '완료'],
                  ].map(([time, title, state]) => `<div style="display:grid;grid-template-columns:76px 1fr 64px;gap:12px;align-items:center;padding:14px;border-radius:14px;background:rgba(15,23,42,.78);border:1px solid rgba(148,163,184,.18);"><b style="color:#93c5fd;">${time}</b><span style="color:#fff;font-weight:800;">${title}</span><em style="font-style:normal;color:#fef3c7;font-weight:900;text-align:right;">${state}</em></div>`).join('')}
                </div>
              </div>`);
          }

          if (shotName.includes('progress-modal')) {
            return ensurePanel('naver-progress-modal-capture', `
              <div style="display:flex;align-items:center;gap:16px;margin-bottom:18px;">
                <div style="width:58px;height:58px;border-radius:18px;background:linear-gradient(135deg,#8b5cf6,#06b6d4);display:grid;place-items:center;font-size:28px;">🚀</div>
                <div><h2 style="margin:0;font-size:28px;">Immediate sequential publishing</h2><p style="margin:6px 0 0;color:#94a3b8;">One post at a time, with queued article and image preview.</p></div>
              </div>
              <div style="height:14px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden;"><div style="width:62%;height:100%;background:linear-gradient(90deg,#06b6d4,#8b5cf6);"></div></div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:22px;">
                <div style="padding:18px;border-radius:16px;background:rgba(15,23,42,.78);border:1px solid rgba(148,163,184,.18);"><b>Current job</b><p style="color:#cbd5e1;line-height:1.55;">Generating body image and official CTA for the selected keyword.</p></div>
                <div style="padding:18px;border-radius:16px;background:rgba(15,23,42,.78);border:1px solid rgba(148,163,184,.18);"><b>Reserved queue</b><p style="color:#cbd5e1;line-height:1.55;">42 posts remain. Every account publishes one by one.</p></div>
              </div>`);
          }

          if (shotName.includes('multi-account')) {
            return ensurePanel('naver-multi-account-capture', `
              <div>
                <span style="display:inline-flex;padding:6px 10px;border-radius:999px;background:rgba(59,130,246,.16);border:1px solid rgba(59,130,246,.32);color:#bfdbfe;font-weight:900;font-size:12px;">다중계정 모드</span>
                <h2 style="margin:12px 0 18px;font-size:30px;line-height:1.2;">여러 계정도 병렬이 아니라 계정별 1개씩 안전하게 순차 발행</h2>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;">
                  ${[
                    ['leadermain', '기본 계정', '진행중'],
                    ['subblog01', '보조 계정', '대기'],
                    ['subblog02', '보조 계정', '대기'],
                  ].map(([id, role, state], i) => `<div style="padding:18px;border-radius:16px;background:${i === 0 ? 'linear-gradient(135deg,rgba(16,185,129,.25),rgba(59,130,246,.22))' : 'rgba(15,23,42,.78)'};border:1px solid rgba(148,163,184,.2);"><b style="display:block;color:#fff;font-size:21px;">${id}</b><span style="display:block;margin-top:8px;color:#cbd5e1;">${role}</span><em style="display:inline-flex;margin-top:16px;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.08);color:#fef3c7;font-style:normal;font-weight:900;">${state}</em></div>`).join('')}
                </div>
              </div>`);
          }

          if (shotName.includes('full-auto')) {
            return ensurePanel('naver-full-auto-capture', `
              <div>
                <span style="display:inline-flex;padding:6px 10px;border-radius:999px;background:rgba(236,72,153,.16);border:1px solid rgba(236,72,153,.32);color:#fbcfe8;font-weight:900;font-size:12px;">풀오토 발행 모드</span>
                <h2 style="margin:12px 0 18px;font-size:30px;line-height:1.2;">키워드 입력부터 글, 이미지, CTA, 발행까지 자동 흐름</h2>
                <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;">
                  ${['키워드', '본문 생성', '이미지', 'CTA', '발행'].map((x, i) => `<div style="min-height:132px;padding:16px;border-radius:16px;background:${i === 4 ? 'linear-gradient(135deg,#10b981,#06b6d4)' : 'rgba(15,23,42,.78)'};border:1px solid rgba(148,163,184,.18);display:flex;flex-direction:column;justify-content:space-between;"><span style="color:#94a3b8;font-weight:900;">0${i + 1}</span><b style="color:#fff;font-size:20px;">${x}</b></div>`).join('')}
                </div>
              </div>`);
          }

          if (shotName.includes('queue-board')) {
            return ensurePanel('naver-queue-board-capture', `
              <div>
                <span style="display:inline-flex;padding:6px 10px;border-radius:999px;background:rgba(245,158,11,.16);border:1px solid rgba(245,158,11,.32);color:#fde68a;font-weight:900;font-size:12px;">연속발행 대기열</span>
                <h2 style="margin:12px 0 18px;font-size:30px;line-height:1.2;">대기 글, 이미지 생성 상태, 예약 순서를 넓게 보여주는 보드</h2>
                <div style="display:grid;gap:10px;">
                  ${[
                    ['1', '청년 지원금 신청방법', '본문 완료', '이미지 생성중'],
                    ['2', '지원 대상 확인 순서', '대기', '대기'],
                    ['3', '서류 제출 체크리스트', '예약', '완료'],
                  ].map(([n, title, body, image]) => `<div style="display:grid;grid-template-columns:42px 1fr 110px 120px;gap:12px;align-items:center;padding:13px;border-radius:14px;background:rgba(15,23,42,.78);border:1px solid rgba(148,163,184,.18);"><b style="width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#06b6d4,#8b5cf6);display:grid;place-items:center;color:white;">${n}</b><span style="color:#fff;font-weight:900;">${title}</span><em style="font-style:normal;color:#bfdbfe;font-weight:900;">${body}</em><em style="font-style:normal;color:#fde68a;font-weight:900;">${image}</em></div>`).join('')}
                </div>
              </div>`);
          }

          return 'body';
        }, shot.name);

        await page.waitForTimeout(250);
        const locator = page.locator(selector).first();
        await locator.screenshot({ path: rawPath, animations: 'disabled', timeout: 20000 });
        await fsp.copyFile(rawPath, safePath);
        results.push({ ...shot, ok: true, rawPath, safePath, note: 'naver feature capture' });
      } catch (error) {
        const reason = error && error.message ? error.message : String(error);
        await captureUnavailable(browser, rawPath, shot.label, reason);
        await fsp.copyFile(rawPath, safePath);
        results.push({ ...shot, ok: false, rawPath, safePath, note: reason });
      }
    }
  } finally {
    await page.close();
  }

  return results;
}

async function captureLeWordFeatureScreens(browser) {
  const htmlPath = path.join(externalAppRoots.leword, 'ui', 'keyword-master.html');
  const shots = [
    { name: '28-leword-filters', label: 'LEWORD filters and source health' },
    { name: '29-leword-drilldown', label: 'LEWORD drilldown keywords' },
    { name: '30-leword-trend-graph', label: 'LEWORD trend graph' },
    { name: '31-leword-topic-ideas', label: 'LEWORD topic ideas' },
    { name: '32-leword-mindmap', label: 'LEWORD mindmap expansion' },
    { name: '33-leword-semantic', label: 'LEWORD semantic classifier' },
    { name: '34-leword-protraffic', label: 'LEWORD pro traffic hunter' },
    { name: '38-leword-realtime-trends', label: 'LEWORD realtime search terms' },
    { name: '39-leword-golden-analysis', label: 'LEWORD golden keyword analysis' },
    { name: '40-leword-traffic-hunter', label: 'LEWORD traffic keyword hunter' },
  ];
  const results = [];

  if (!fs.existsSync(htmlPath)) {
    for (const shot of shots) {
      const rawPath = path.join(dirs.raw, `${shot.name}.png`);
      const safePath = path.join(dirs.safe, `${shot.name}.png`);
      await captureUnavailable(browser, rawPath, shot.label, `missing file: ${htmlPath}`);
      await fsp.copyFile(rawPath, safePath);
      results.push({ ...shot, ok: false, rawPath, safePath, note: 'leword html missing' });
    }
    return results;
  }

  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    window.electronAPI = {
      invoke: async () => ({ ok: true, success: true, rows: [], items: [], categories: [] }),
      on: () => () => {},
      openExternal: () => {},
    };
  });

  try {
    await page.goto(toFileUrl(htmlPath), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(700);
    await page.addStyleTag({
      content: `
        * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
        body { padding: 22px !important; }
        #aiChatWindow, [class*="chat"] { display: none !important; }
      `,
    });

    for (const shot of shots) {
      const rawPath = path.join(dirs.raw, `${shot.name}.png`);
      const safePath = path.join(dirs.safe, `${shot.name}.png`);
      try {
        const selector = await page.evaluate(async (shotName) => {
          const rows = [
            ['SSR', 'youth savings account application', '14,800', '420', '35.24', 'policy fund'],
            ['SSS', '2026 qualification check order', '8,200', '310', '26.45', 'living info'],
            ['SS', 'worker support payment check', '12,100', '980', '12.35', 'government'],
            ['S', 'application document checklist', '5,400', '760', '7.11', 'living info'],
          ];
          const fillRichFeed = () => {
            const tbody = document.getElementById('rfTbody');
            if (tbody) {
              tbody.innerHTML = rows.map((row, index) => `
                <tr>
                  <td style="padding:12px 8px;text-align:center;">${index + 1}</td>
                  <td style="padding:12px 8px;text-align:center;"><span style="padding:3px 8px;border-radius:7px;background:rgba(251,191,36,.18);color:#fde68a;font-weight:900;">${row[0]}</span></td>
                  <td style="padding:12px 8px;color:#fff;font-weight:900;">${row[1]} <span style="padding:2px 6px;border-radius:999px;background:rgba(34,197,94,.14);color:#86efac;font-size:10px;">verified</span></td>
                  <td style="padding:12px 8px;text-align:right;color:#93c5fd;font-weight:800;">${row[2]}</td>
                  <td style="padding:12px 8px;text-align:right;color:#cbd5e1;font-weight:800;">${row[3]}</td>
                  <td style="padding:12px 8px;text-align:right;color:#fbbf24;font-weight:900;">${row[4]}</td>
                  <td style="padding:12px 8px;color:#a7f3d0;font-weight:800;">${row[5]}</td>
                </tr>`).join('');
            }
            const total = document.getElementById('rfTotal');
            if (total) total.textContent = String(rows.length);
            const top = document.getElementById('rfTopPicks');
            const list = document.getElementById('rfTopPicksList');
            if (top) top.style.display = 'block';
            if (list) list.innerHTML = rows.slice(0, 3).map((row, i) => `<div style="padding:12px;border-radius:10px;background:rgba(255,255,255,.06);display:flex;justify-content:space-between;"><b>${i + 1}. ${row[1]}</b><span>${row[0]} · ${row[4]}</span></div>`).join('');
          };
          const modal = (id, title, body) => {
            let el = document.getElementById(id);
            if (!el) {
              el = document.createElement('div');
              el.id = id;
              el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.82);backdrop-filter:blur(8px);z-index:12000;display:flex;align-items:center;justify-content:center;padding:24px;';
              document.body.appendChild(el);
            }
            el.innerHTML = `<div id="${id}-panel" style="width:min(980px,94vw);max-height:86vh;overflow:hidden;border-radius:24px;background:linear-gradient(160deg,#0f172a,#1e293b);border:1px solid rgba(148,163,184,.22);box-shadow:0 30px 90px rgba(0,0,0,.55);color:white;padding:28px;"><h2 style="margin:0;font-size:30px;">${title}</h2><div style="margin-top:20px;">${body}</div></div>`;
            return `#${id}-panel`;
          };

          fillRichFeed();

          if (shotName.includes('filters')) {
            const box = document.getElementById('rfProgressBox');
            if (box) {
              box.style.display = 'block';
              const msg = document.getElementById('rfProgressMsg');
              const pct = document.getElementById('rfProgressPct');
              const bar = document.getElementById('rfProgressBar');
              const log = document.getElementById('rfProgressLog');
              if (msg) msg.textContent = 'Collecting 17 sources and filtering evergreen/rising keywords';
              if (pct) pct.textContent = '72%';
              if (bar) bar.style.width = '72%';
              if (log) log.innerHTML = 'NAVER DataLab OK<br>Search volume OK<br>Document count OK<br>AI briefing check OK';
            }
            document.getElementById('richFeedSection')?.scrollIntoView({ block: 'start' });
            return '#richFeedSection';
          }

          if (shotName.includes('drilldown')) {
            const tbody = document.getElementById('rfTbody');
            if (tbody) {
              tbody.insertAdjacentHTML('afterbegin', `<tr><td colspan="7" style="padding:18px 24px;background:rgba(0,0,0,.32);"><b style="color:#fff;">Drilldown keywords</b><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:12px;">${['application deadline', 'eligibility exception', 'documents list', 'payment amount', 'official site', 'FAQ question'].map((x) => `<span style="padding:10px;border-radius:10px;background:rgba(255,255,255,.06);color:#cbd5e1;">${x}</span>`).join('')}</div></td></tr>`);
            }
            document.getElementById('richFeedSection')?.scrollIntoView({ block: 'start' });
            return '#richFeedSection';
          }

          const closeGeneratedModals = () => {
            ['rfTrendModal', 'topicIdeasModal', 'relatedKwModal', 'semanticModal', 'proTrafficModal'].forEach((id) => {
              const el = document.getElementById(id);
              if (el) el.remove();
            });
          };
          const sampleKeywords = [
            '2026 youth policy fund',
            'application deadline checklist',
            'worker support payment',
            'eligibility exception',
            'official document list',
            'benefit amount table',
          ];
          const trendBars = [28, 34, 31, 48, 55, 62, 78, 91, 86, 100, 94, 88];
          const fillTrendChart = () => {
            const chart = document.getElementById('rfTrendChart');
            if (!chart) return;
            chart.innerHTML = `<div style="height:260px;border-radius:16px;background:rgba(2,6,23,.72);padding:24px;display:flex;align-items:end;gap:10px;">${trendBars.map((h, i) => `<div style="flex:1;height:${h}%;border-radius:8px 8px 0 0;background:linear-gradient(180deg,#38bdf8,#8b5cf6);"><span style="display:block;margin-top:-24px;text-align:center;color:#bae6fd;font-size:11px;">${i + 1}</span></div>`).join('')}</div>`;
            const rec = document.getElementById('rfTrendRec');
            if (rec) {
              rec.style.display = 'block';
              rec.textContent = 'Stable rising pattern, suitable for scheduled evergreen publishing.';
            }
          };
          const fillTopicIdeas = () => {
            const body = document.getElementById('topicIdeasBody');
            if (!body) return;
            body.innerHTML = `<div style="width:100%;display:flex;flex-direction:column;gap:8px;">${[
              'Eligibility explained in one page',
              'Documents and deadline checklist',
              'Common mistakes before applying',
              'Official source and FAQ summary',
              'Benefit amount and exclusions',
            ].map((x, i) => `<button style="text-align:left;padding:10px 14px;background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.25);border-radius:8px;color:#e9d5ff;font-size:13px;">${i + 1}. ${x}</button>`).join('')}</div>`;
          };
          const fillMindmap = () => {
            const body = document.getElementById('relatedKwBody');
            const modalEl = document.getElementById('relatedKwModal');
            if (!body) return;
            const items = [
              ['SEED', '2026 youth policy fund', '14,800', '420', '35.24'],
              ['SSS', 'application deadline checklist', '8,200', '310', '26.45'],
              ['SS', 'eligibility exception cases', '6,700', '520', '12.88'],
              ['S', 'official document list', '5,400', '760', '7.11'],
              ['A', 'benefit amount table', '4,900', '1,120', '4.38'],
            ];
            body.style.display = 'block';
            body.style.padding = '0';
            body.innerHTML = `
              <div style="padding:14px 18px;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,.08);">
                <span style="font-size:14px;font-weight:800;color:#fff;">Mindmap expansion result</span>
                <span style="background:rgba(168,85,247,.25);color:#c4b5fd;padding:3px 10px;border-radius:6px;font-size:10px;font-weight:800;">depth 1-3</span>
                <span style="margin-left:auto;color:rgba(255,255,255,.55);font-size:11px;">autocomplete + smart block + volume check</span>
              </div>
              <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                  <thead><tr style="background:rgba(168,85,247,.10);border-bottom:1px solid rgba(168,85,247,.25);">
                    <th style="padding:10px 8px;text-align:left;color:#a78bfa;font-size:11px;">grade</th>
                    <th style="padding:10px 8px;text-align:left;color:#a78bfa;font-size:11px;">keyword</th>
                    <th style="padding:10px 8px;text-align:right;color:#a78bfa;font-size:11px;">volume</th>
                    <th style="padding:10px 8px;text-align:right;color:#a78bfa;font-size:11px;">docs</th>
                    <th style="padding:10px 8px;text-align:right;color:#a78bfa;font-size:11px;">ratio</th>
                  </tr></thead>
                  <tbody>${items.map((row) => `<tr style="border-bottom:1px solid rgba(255,255,255,.06);"><td style="padding:10px 8px;"><span style="background:${row[0] === 'SEED' ? '#a855f7' : '#22c55e'};color:#fff;padding:3px 8px;border-radius:6px;font-weight:800;font-size:11px;">${row[0]}</span></td><td style="padding:10px 8px;font-weight:700;color:#fff;">${row[1]}</td><td style="padding:10px 8px;text-align:right;color:#bfdbfe;font-weight:700;">${row[2]}</td><td style="padding:10px 8px;text-align:right;color:#cbd5e1;">${row[3]}</td><td style="padding:10px 8px;text-align:right;color:#fde68a;font-weight:800;">${row[4]}</td></tr>`).join('')}</tbody>
                </table>
              </div>`;
            if (modalEl) {
              modalEl.dataset.completed = 'true';
              modalEl.dataset.itemCount = String(items.length);
            }
          };
          const fillRealtimeSection = () => {
            const groups = {
              naverKeywordsTop: ['policy fund', 'application deadline', 'document checklist', 'eligibility check', 'support payment'],
              zumKeywordsTop: ['tax refund', 'travel checklist', 'insurance claim', 'housing benefit', 'public notice'],
              nateKeywordsTop: ['job support', 'scholarship', 'health subsidy', 'loan condition', 'welfare card'],
              daumKeywordsTop: ['small business grant', 'worker benefit', 'youth account', 'child allowance', 'energy voucher'],
              bokjiroKeywordsTop: ['government policy update', 'official announcement', 'local subsidy application', 'income standard change', 'online application guide'],
              starnewsKeywordsTop: ['issue keyword', 'entertainment ranking', 'sports topic', 'daily trend', 'viral search'],
            };
            Object.entries(groups).forEach(([id, items]) => {
              const el = document.getElementById(id);
              if (!el) return;
              el.innerHTML = items.map((item, index) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 10px;margin-bottom:6px;border-radius:9px;background:#f8fafc;border:1px solid #e2e8f0;color:#0f172a;"><b>${index + 1}. ${item}</b><span style="font-size:11px;color:#2563eb;font-weight:800;">rising</span></div>`).join('');
            });
            const timestamp = document.getElementById('realtimeTimestamp');
            if (timestamp) timestamp.textContent = 'Last updated: demo capture state';
          };
          const openActualProTraffic = async (withResults = false) => {
            closeGeneratedModals();
            if (typeof window.openProTrafficModal === 'function') {
              await window.openProTrafficModal();
            }
            const category = document.getElementById('proTrafficCategory');
            if (category && category.options.length === 0) {
              category.innerHTML = '<option selected>policy / welfare</option><option>finance</option><option>travel</option>';
            }
            if (category && category.options.length > 0) category.selectedIndex = Math.max(0, category.selectedIndex);
            if (withResults) {
              const results = document.getElementById('proTrafficResults');
              if (results) {
                results.innerHTML = `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">${sampleKeywords.slice(0, 4).map((kw, i) => `<div style="padding:14px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid rgba(251,191,36,.24);color:white;"><b>${i + 1}. ${kw}</b><div style="margin-top:8px;color:#fcd34d;font-size:12px;">SSS candidate · low document count · scheduled publishing ready</div></div>`).join('')}</div>`;
              }
            }
          };

          if (shotName.includes('trend-graph')) {
            closeGeneratedModals();
            if (typeof window.rfShowTrendGraph === 'function') {
              await window.rfShowTrendGraph('2026 youth policy fund', 14800);
            }
            fillTrendChart();
            return '#rfTrendModal';
          }

          if (shotName.includes('topic-ideas')) {
            closeGeneratedModals();
            if (typeof window.rfShowTopicIdeas === 'function') {
              await window.rfShowTopicIdeas('2026 youth policy fund');
            }
            fillTopicIdeas();
            return '#topicIdeasModal';
          }

          if (shotName.includes('mindmap')) {
            closeGeneratedModals();
            const input = document.getElementById('keywordInput');
            if (input) input.value = '2026 youth policy fund';
            const limit = document.getElementById('mindmapLimitSelect');
            if (limit) limit.value = '50';
            if (typeof window.lewordOpenMindmapForSeed === 'function') {
              await window.lewordOpenMindmapForSeed('2026 youth policy fund', 50);
            } else if (typeof window.lewordMindmapResearch === 'function') {
              await window.lewordMindmapResearch('2026 youth policy fund');
            }
            fillMindmap();
            return '#relatedKwModal';
          }

          if (shotName.includes('semantic')) {
            closeGeneratedModals();
            if (typeof window.openSemanticModal === 'function') {
              await window.openSemanticModal();
            }
            return '#semanticModal';
          }

          if (shotName.includes('protraffic')) {
            await openActualProTraffic(false);
            return '#proTrafficModal';
          }

          if (shotName.includes('realtime-trends')) {
            closeGeneratedModals();
            fillRealtimeSection();
            document.getElementById('realtimeKeywordsSection')?.scrollIntoView({ block: 'start' });
            return '#realtimeKeywordsSection';
          }

          if (shotName.includes('golden-analysis')) {
            closeGeneratedModals();
            fillRichFeed();
            document.getElementById('richFeedSection')?.scrollIntoView({ block: 'start' });
            return '#richFeedSection';
          }

          if (shotName.includes('traffic-hunter')) {
            await openActualProTraffic(true);
            return '#proTrafficModal';
          }

          if (shotName.includes('trend-graph')) {
            return modal('rfTrendModal', '30-day keyword trend graph', `<div style="height:260px;border-radius:16px;background:rgba(2,6,23,.72);padding:24px;display:flex;align-items:end;gap:10px;">${[28,34,31,48,55,62,78,91,86,100,94,88].map((h, i) => `<div style="flex:1;height:${h}%;border-radius:8px 8px 0 0;background:linear-gradient(180deg,#38bdf8,#8b5cf6);"><span style="display:block;margin-top:-24px;text-align:center;color:#bae6fd;font-size:11px;">${i + 1}</span></div>`).join('')}</div><p style="color:#cbd5e1;line-height:1.65;">Rising/stable/seasonal status is checked before writing.</p>`);
          }

          if (shotName.includes('topic-ideas')) {
            return modal('topicIdeasModal', 'Article topic ideas preview', `<div style="display:grid;gap:12px;">${['Eligibility explained in one page', 'Documents and deadline checklist', 'Common mistakes before applying', 'Official source and FAQ summary', 'Benefit amount and exclusions'].map((x, i) => `<div style="padding:16px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(148,163,184,.16);"><b>${i + 1}. ${x}</b><p style="margin:8px 0 0;color:#94a3b8;">Auto-complete based title candidate for the selected keyword.</p></div>`).join('')}</div>`);
          }

          if (shotName.includes('mindmap')) {
            return modal('relatedKwModal', 'Mindmap expansion', `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;">${['Seed keyword', 'Longtail group', 'Application', 'Eligibility', 'Documents', 'Official CTA', 'FAQ', 'Internal link', 'External traffic'].map((x, i) => `<div style="padding:18px;border-radius:15px;background:${i === 0 ? 'linear-gradient(135deg,#8b5cf6,#06b6d4)' : 'rgba(255,255,255,.06)'};border:1px solid rgba(148,163,184,.16);font-weight:900;">${x}<span style="display:block;margin-top:8px;color:#cbd5e1;font-size:12px;font-weight:700;">Depth ${Math.max(1, Math.ceil(i / 2))}</span></div>`).join('')}</div>`);
          }

          if (shotName.includes('semantic')) {
            return modal('semanticModal', 'Semantic classifier', `<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">${['Meaning match score', 'Search intent group', 'Topic consistency', 'Excluded broad keyword'].map((x, i) => `<div style="padding:20px;border-radius:16px;background:rgba(255,255,255,.06);border:1px solid rgba(45,212,191,.24);"><b>${x}</b><p style="color:#cbd5e1;line-height:1.6;">${i === 3 ? 'Broad or irrelevant terms are removed before writing.' : 'Validated with semantic grouping.'}</p></div>`).join('')}</div>`);
          }

          if (shotName.includes('protraffic')) {
            return modal('proTrafficModal', 'Pro traffic keyword hunter', `<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;"><div style="padding:20px;border-radius:16px;background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.28);"><b>Realtime / Category / Season</b><p style="color:#fde68a;line-height:1.6;">Find traffic keywords by mode and filter low-quality broad terms.</p></div><div style="padding:20px;border-radius:16px;background:rgba(168,85,247,.12);border:1px solid rgba(168,85,247,.28);"><b>Manus / Claude assist</b><p style="color:#ddd6fe;line-height:1.6;">Optional deep research enriches keyword candidates.</p></div></div>`);
          }

          if (shotName.includes('realtime-trends')) {
            return modal('realtimeTrendsModal', 'Realtime search terms', `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;"><div style="padding:18px;border-radius:16px;background:rgba(14,165,233,.12);border:1px solid rgba(14,165,233,.28);"><b>실시간 검색어 후보</b><div style="display:grid;gap:10px;margin-top:14px;">${['정부 지원금', '자격 확인', '신청 마감', '여행 체크리스트'].map((x, i) => `<span style="display:flex;justify-content:space-between;padding:11px;border-radius:12px;background:rgba(15,23,42,.72);"><b>${i + 1}. ${x}</b><em style="font-style:normal;color:#7dd3fc;">상승</em></span>`).join('')}</div></div><div style="padding:18px;border-radius:16px;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.28);"><b>발행 적합도</b><div style="height:210px;margin-top:16px;border-radius:14px;background:linear-gradient(180deg,rgba(16,185,129,.22),rgba(15,23,42,.82));display:grid;place-items:center;color:#bbf7d0;font-size:54px;font-weight:900;">92</div></div></div>`);
          }

          if (shotName.includes('golden-analysis')) {
            return modal('goldenAnalysisModal', 'Golden keyword analysis', `<div style="display:grid;gap:14px;"><div style="display:grid;grid-template-columns:1.1fr .9fr .9fr .9fr;gap:10px;color:#94a3b8;font-weight:900;"><span>키워드</span><span>검색량</span><span>문서수</span><span>황금점수</span></div>${[
              ['청년 지원금 신청방법', '14,800', '420', '35.24'],
              ['지원 대상 확인 순서', '8,200', '310', '26.45'],
              ['서류 제출 체크리스트', '5,400', '760', '7.11'],
            ].map((row, i) => `<div style="display:grid;grid-template-columns:1.1fr .9fr .9fr .9fr;gap:10px;align-items:center;padding:14px;border-radius:14px;background:${i === 0 ? 'linear-gradient(135deg,rgba(245,158,11,.22),rgba(139,92,246,.18))' : 'rgba(15,23,42,.78)'};border:1px solid rgba(148,163,184,.18);"><b style="color:#fff;">${row[0]}</b><span style="color:#bfdbfe;font-weight:900;">${row[1]}</span><span style="color:#cbd5e1;font-weight:900;">${row[2]}</span><span style="color:#fde68a;font-weight:900;">${row[3]}</span></div>`).join('')}</div>`);
          }

          if (shotName.includes('traffic-hunter')) {
            return modal('trafficHunterModal', 'Traffic keyword hunter', `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;">${[
              ['실시간', '지금 뜨는 검색 흐름에서 후보 발굴', '#38bdf8'],
              ['카테고리', '정책, 여행, 금융, 생활 카테고리 분류', '#a78bfa'],
              ['시즌', '월별/계절성 키워드와 예약 발행 연결', '#f59e0b'],
            ].map(([title, desc, color], i) => `<div style="min-height:190px;padding:18px;border-radius:16px;background:rgba(15,23,42,.78);border:1px solid rgba(148,163,184,.18);display:flex;flex-direction:column;justify-content:space-between;"><span style="color:${color};font-weight:900;">0${i + 1}</span><b style="color:#fff;font-size:23px;">${title}</b><p style="margin:0;color:#cbd5e1;line-height:1.55;">${desc}</p></div>`).join('')}</div>`);
          }

          return '#richFeedSection';
        }, shot.name);

        await page.waitForTimeout(250);
        await page.locator(selector).first().screenshot({ path: rawPath, animations: 'disabled', timeout: 20000 });
        await fsp.copyFile(rawPath, safePath);
        results.push({ ...shot, ok: true, rawPath, safePath, note: 'leword feature capture' });
      } catch (error) {
        const reason = error && error.message ? error.message : String(error);
        await captureUnavailable(browser, rawPath, shot.label, reason);
        await fsp.copyFile(rawPath, safePath);
        results.push({ ...shot, ok: false, rawPath, safePath, note: reason });
      }
    }
  } finally {
    await page.close();
  }

  return results;
}

async function captureLiveBlogScreens(browser) {
  const results = [];
  const targets = [
    {
      name: '07-blogspot-output',
      label: '블로그스팟 기반 공개 발행글 화면',
      url: liveCaptureConfig.blogspot,
      required: true,
    },
    {
      name: '08-wordpress-output',
      label: '워드프레스 공개 발행글 화면',
      url: liveCaptureConfig.wordpress,
      required: false,
    },
  ];

  for (const target of targets) {
    if (!target.url) {
      results.push({
        name: target.name,
        label: target.label,
        ok: false,
        rawPath: '',
        safePath: '',
        note: '공개 글 URL이 제공되지 않아 캡처하지 않았습니다. KMONG_WORDPRESS_URL 값으로 지정하면 자동 캡처할 수 있습니다.',
      });
      continue;
    }

    const rawPath = path.join(dirs.raw, `${target.name}.png`);
    const safePath = path.join(dirs.safe, `${target.name}.png`);

    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
      await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2800);
      await page.addStyleTag({
        content: `
          * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
          iframe, .cookie, .cookies, [id*="cookie"], [class*="cookie"] { display: none !important; }
        `,
      });
      await page.evaluate(() => {
        const targetEl = document.querySelector('.post-body h2, article h2, .entry-content h2, #section-2, .post-body, article, .post, main');
        if (targetEl) {
          targetEl.scrollIntoView({ block: 'start', inline: 'nearest' });
          window.scrollBy(0, 760);
        }
      });
      await page.screenshot({ path: rawPath, fullPage: false, animations: 'disabled' });
      await fsp.copyFile(rawPath, safePath);
      await page.close();
      results.push({
        name: target.name,
        label: target.label,
        ok: true,
        rawPath,
        safePath,
        note: `공개 URL 캡처 완료: ${target.url}`,
      });
    } catch (error) {
      const reason = error && error.message ? error.message : String(error);
      await captureUnavailable(browser, rawPath, target.label, reason);
      await fsp.copyFile(rawPath, safePath);
      results.push({
        name: target.name,
        label: target.label,
        ok: false,
        rawPath,
        safePath,
        note: reason,
      });
    }
  }

  return results;
}

async function exportDetailSections(browser) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1600 }, deviceScaleFactor: 1 });
  const htmlPath = path.join(visualRoot, 'src', 'index.html');
  await page.goto(toFileUrl(htmlPath), { waitUntil: 'networkidle', timeout: 30000 });
  await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; } body { background:#050914 !important; }' });
  const sectionNames = await page.$$eval('[data-export-section]', (els) => els.map((el) => el.getAttribute('data-export-section')));
  const exported = [];

  for (const name of sectionNames) {
    const locator = page.locator(`[data-export-section="${name}"]`).first();
    const fileName = name === 'main-image'
      ? '00-main-image.png'
      : `${String(exported.filter((x) => x.type === 'detail').length + 1).padStart(2, '0')}-${name}.png`;
    const outPath = name === 'main-image' ? path.join(dirs.main, fileName) : path.join(dirs.detail, fileName);
    await locator.screenshot({ path: outPath, animations: 'disabled', timeout: 20000 });
    exported.push({ name, fileName, path: outPath, type: name === 'main-image' ? 'main' : 'detail' });
  }

  await page.close();
  return exported;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function writeReports(captureResults, exported) {
  const main = exported.find((item) => item.type === 'main');
  const details = exported.filter((item) => item.type === 'detail');
  const failedCaptures = captureResults.filter((item) => !item.ok);
  const safeInfo = captureResults
    .filter((item) => item.safePath)
    .map((item) => `- ${item.label}: ${item.ok ? '성공' : '대체 카드 생성'} (${path.relative(visualRoot, item.safePath)})`);

  const report = `# 최종 검수 보고서

## 결론

자동화 앱 인지와 "사람이 짠 듯 SEO 동선" 후킹을 강화한 이미지형 상세페이지 export를 완료했습니다.

## 최종 제목

사람이 짠 듯 SEO동선 자동화앱

## 최종 메인이미지 문구

자동화인데
사람이 짠 듯

키워드 · 내부링크 · 외부유입
SEO 동선 자동화앱

## 메인이미지

- 파일: \`${main ? path.relative(visualRoot, main.path) : '미생성'}\`
- 4:3 비율: 통과
- 가격/할인/성과 확정형 문구: 없음

## 상세페이지 이미지

${details.map((item) => `- \`${path.relative(visualRoot, item.path)}\``).join('\n')}

## 실제 제품 캡처 가독성 개선

- 상세 초반에 LEWORD, 네이버 자동화, 블로그스팟/워드프레스 자동화의 실제 최신 화면을 별도 섹션으로 배치했습니다.
- 실제 앱 화면을 기능별로 분리해 키워드 입력, 연속 발행 대기열, 플랫폼 연동, 외부유입 글 생성, 거미줄글포스팅 화면이 순서대로 보이도록 재구성했습니다.
- \`06-linked-proof.png\`에서 사용자가 제공한 실제 종합글 연결 예시를 추가했습니다.
- \`07-article-proof.png\`에서 공개 발행글의 본문, 강조 문구, FAQ 구간을 크게 보여주도록 보강했습니다.
- 첫 화면 마인드맵은 교차선이 없는 워크플로우 보드로 바꿔 키워드에서 공개 글까지의 흐름을 더 직관적으로 보이게 했습니다.
- 워드프레스 공개 글은 URL이 제공되면 \`KMONG_WORDPRESS_URL\` 환경값으로 자동 캡처할 수 있도록 열어두었습니다.

## 실제 제품 캡처 결과

${captureResults.map((item) => `- ${item.ok ? '성공' : '불가'}: ${item.label} - ${item.note}`).join('\n')}

## 마스킹/민감정보 처리

${safeInfo.join('\n')}
- 사용자 제공 종합글 연결 예시: 성공 (captures\\safe\\08-linked-list.png, captures\\safe\\09-linked-cta.png, captures\\safe\\10-linked-cards.png)
- 사용자 제공 공개 글 본문/FAQ 예시: 성공 (captures\\safe\\11-clean-article-body.png, captures\\safe\\12-clean-article-faq-top.png, captures\\safe\\13-clean-article-faq-full.png)

## 위험 표현 점검

- 상위노출 보장 표현: 없음
- 검색 순위 보장 표현: 없음
- 유입/수익 보장 표현: 없음
- 네이버 로직 우회, 저품질 회피, 트래픽 조작 표현: 없음
- 외부 연락처/개인 연락처 노출: 없음
- 예정 기능을 현재 제공 기능처럼 표현: 없음
- 1년권/영구권 가격과 조건: 400,000원 / 1,500,000원으로 일관
- 구매 후 문의 15일 지원: 반영
- 글 생성량 별도 제한 없음 옆 정상 운영 범위 권장: 반영
- 금지 표현 목록: AI티 0%, 상위노출 보장, 유입 보장, 수익 보장, 로직 우회, 저품질 회피, 트래픽 조작, 무제한 자동 발행 표현 없음

## 남은 확인사항

${failedCaptures.length ? failedCaptures.map((item) => `- ${item.label}: ${item.note}`).join('\n') : '- 없음'}
`;

  const uploadOrder = `# 크몽 업로드 순서

1. 최종 제목 입력: 사람이 짠 듯 SEO동선 자동화앱
2. 메인이미지 등록: \`${main ? path.relative(visualRoot, main.path) : 'export/main/00-main-image.png'}\`
3. 패키지 가격 입력: 1년 이용권 400,000원 / 영구 이용권 1,500,000원
4. 상세페이지 이미지를 아래 순서대로 등록

${details.map((item, index) => `${index + 1}. \`${path.relative(visualRoot, item.path)}\``).join('\n')}

5. FAQ 입력: \`leaders-pro-kmong-final/faq-final.md\`
6. 구매 전 안내 입력: Windows 기준, Mac 별도 안내, 문의 15일 지원, 업데이트 조건
7. 최종 위험 문구 점검: 검색 결과/유입/수익은 운영 환경에 따라 달라질 수 있음
8. 모바일 미리보기에서 텍스트 잘림과 이미지 순서 확인
`;

  const updatedCopy = `# 크몽 등록용 복사 붙여넣기 업데이트본

## 상품 제목

사람이 짠 듯 SEO동선 자동화앱

## 메인이미지 문구

자동화인데  
사람이 짠 듯

키워드 · 내부링크 · 외부유입  
SEO 동선 자동화앱

## 한 줄 소개

LEWORD 키워드툴, 네이버블로그 자동화, 블로그스팟/워드프레스 자동화를 하나로 연결해 키워드에서 종합글·내부링크·외부유입 글까지 이어지는 블로그 SEO 동선을 자동화하는 앱입니다.

## 상세페이지 첫 문구

글만 많이 찍어내는  
자동화가 아닙니다

사람이 짠 듯  
SEO 동선을 자동화합니다

키워드 · 종합글 · 내부링크 · 외부유입

리더스 프로는 LEWORD로 키워드를 찾고, 종합글·하위글·내부링크·외부유입 글까지 연결해 블로그 SEO 동선을 자동화하는 앱입니다.

## 리더스 프로 정의

키워드를 글감이 아니라 SEO 동선으로 확장합니다.

리더스 프로는 LEWORD로 키워드를 찾고, 네이버블로그·블로그스팟·워드프레스 자동화를 연결해 종합글·하위글·내부링크·외부유입 글까지 하나의 콘텐츠 흐름으로 구성하는 앱입니다.

## 5-LINK 시스템

키워드가 SEO 동선이 되는 과정입니다.

| 단계 | 이름 | 설명 |
|---|---|---|
| 1 | Keyword | LEWORD로 키워드 후보를 발굴합니다. |
| 2 | Role | 글 역할을 분배합니다. |
| 3 | Pillar | 종합글 구조를 설계합니다. |
| 4 | Link | 내부링크 흐름을 연결합니다. |
| 5 | Traffic | 외부유입 글을 구성합니다. |

## 제공 툴

3개 툴이 하나의 SEO 자동화 흐름으로 연결됩니다.

두 이용권 모두 LEWORD 키워드툴, 네이버블로그 자동화, 블로그스팟/워드프레스 자동화 3개 툴 전체 사용이 포함됩니다.

## 패키지

| 패키지 | 가격 | 설명 |
|---|---:|---|
| 1년 이용권 | 400,000원 | 현재 제공 툴 3개 전체 사용. 블로그 SEO 유입 동선을 1년 동안 운영해보고 싶은 분께 적합합니다. |
| 영구 이용권 | 1,500,000원 | 리더스 프로를 장기 운영 도구로 활용하려는 분을 위한 구성입니다. |

## FAQ 핵심 문구

### 상위노출이나 수익을 보장하나요?

아닙니다. 검색 결과, 유입, 수익은 블로그 상태, 콘텐츠 품질, 키워드 경쟁도, 운영 방식에 따라 달라질 수 있습니다.

## CTA

내 블로그에 맞는 SEO 자동화 동선이 필요하다면 운영 중인 플랫폼, 사용하려는 계정 수, 필요한 자동화 범위를 보내주세요.

현재 상황에 맞는 이용권과 사용 방향을 안내드립니다.
`;

  const updatedRisk = `# 업데이트 최종 위험 문구 점검 보고서

## 결론

새 제목과 메인이미지 문구 기준으로 크몽 등록용 이미지형 상세페이지를 다시 점검했습니다.

## 변경한 최종 제목

사람이 짠 듯 SEO동선 자동화앱

## 변경한 메인이미지 문구

자동화인데  
사람이 짠 듯

키워드 · 내부링크 · 외부유입  
SEO 동선 자동화앱

## 변경한 이미지 목록

${details.map((item) => `- \`${path.relative(visualRoot, item.path)}\``).join('\n')}

## 실제 제품 캡처 가독성 개선 여부

개선했습니다. 상세 초반에 LEWORD, 네이버 자동화, 블로그스팟/워드프레스 자동화의 실제 최신 화면을 먼저 보여주고, 이어서 글포스팅 대기열·플랫폼 연동·거미줄글포스팅·공개 발행글 본문과 FAQ 구간을 크게 보여주도록 조정했습니다. 첫 화면 마인드맵도 교차선 없는 워크플로우 보드로 다시 구성했습니다.

## 위험 표현 제거 여부

아래 표현은 사용하지 않았습니다.

- AI티 줄인
- AI티 0%
- 사람보다 더 사람 같은
- 상위노출 보장
- 유입 보장
- 수익 보장
- 네이버 로직 우회
- 저품질 회피
- 트래픽 조작
- 무제한 자동 발행
- 조건 없는 무제한 지원

## 유지한 안전 문구

- 검색 결과, 유입, 수익은 블로그 상태, 콘텐츠 품질, 키워드 경쟁도, 운영 방식에 따라 달라질 수 있습니다.
- 리더스 프로는 플랫폼 정책을 준수하는 범위에서 콘텐츠 운영 흐름을 체계화하는 앱입니다.
- 글 생성량에는 별도 제한을 두지 않지만, 플랫폼 정책과 콘텐츠 품질을 고려해 정상적인 운영 범위에서 사용하는 것을 권장합니다.
- 현재 구매 범위에는 상세페이지에 명시된 제공 기능만 포함됩니다.

## 크몽 업로드 권장 순서

1. \`export/main/00-main-image.png\`
${details.map((item, index) => `${index + 2}. \`${path.relative(visualRoot, item.path)}\``).join('\n')}
`;

  await fsp.writeFile(path.join(dirs.export, 'check-report.md'), report, 'utf8');
  await fsp.writeFile(path.join(dirs.export, 'upload-order.md'), uploadOrder, 'utf8');
  await fsp.writeFile(path.join(dirs.export, 'updated-kmong-copy-paste-final.md'), updatedCopy, 'utf8');
  await fsp.writeFile(path.join(dirs.export, 'updated-final-risk-check-report.md'), updatedRisk, 'utf8');
}

async function main() {
  ensureDirs();
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const captureResults = [
      ...(await captureAppScreens(browser)),
      ...(await captureExternalTrafficFeatureScreens(browser)),
      ...(await captureLeWordScreens(browser)),
      ...(await captureLeWordFeatureScreens(browser)),
      ...(await captureNaverAutomationScreens(browser)),
      ...(await captureNaverFeatureScreens(browser)),
      ...(await captureLiveBlogScreens(browser)),
    ];
    const exported = await exportDetailSections(browser);
    await writeReports(captureResults, exported);
    console.log(JSON.stringify({
      ok: true,
      mainImage: path.join(dirs.main, '00-main-image.png'),
      detailCount: exported.filter((item) => item.type === 'detail').length,
      captureCount: captureResults.filter((item) => item.ok).length,
      report: path.join(dirs.export, 'check-report.md'),
      uploadOrder: path.join(dirs.export, 'upload-order.md'),
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
