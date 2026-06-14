const PLATFORM_META = {
  blogger: {
    label: 'Blogger',
    title: 'Blogger 계정',
    icon: 'B',
    color: '#f97316',
  },
  wordpress: {
    label: 'WordPress',
    title: 'WordPress 계정',
    icon: 'W',
    color: '#3b82f6',
  },
  tistory: {
    label: 'Tistory',
    title: 'Tistory 계정',
    icon: 'T',
    color: '#10b981',
  },
};

let multiAccountsState = [];
let isPublishing = false;
let publishAbort = false;

function parseJson(value, fallback) {
  try {
    return JSON.parse(value || '');
  } catch {
    return fallback;
  }
}

function readLocalSettings() {
  return parseJson(localStorage.getItem('bloggerSettings'), {}) || {};
}

async function readEnvSettings() {
  try {
    const api = window.electronAPI || window.blogger;
    const res = await api?.getEnv?.();
    return res?.data || {};
  } catch {
    return {};
  }
}

function valueFromDom(id) {
  return document.getElementById(id)?.value?.trim?.() || '';
}

function checkedValue(name, fallback = '') {
  return document.querySelector(`input[name="${name}"]:checked`)?.value || fallback;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizePlatform(type) {
  const raw = String(type || '').toLowerCase();
  if (raw === 'blogspot') return 'blogger';
  if (raw === 'wp') return 'wordpress';
  if (PLATFORM_META[raw]) return raw;
  return 'blogger';
}

function normalizeTistoryBlogName(value) {
  return String(value || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/g, '')
    .replace(/\.tistory\.com$/i, '')
    .replace(/[^a-zA-Z0-9_-]/g, '');
}

function defaultSettings(type) {
  const defaults = collectCurrentDetailSettings();
  return {
    blogId: '',
    clientId: '',
    clientSecret: '',
    siteUrl: '',
    username: '',
    password: '',
    wordpressCategory: '',
    tistoryBlogName: '',
    tistoryBlogUrl: '',
    tistoryDefaultCategory: '',
    tistoryDefaultVisibility: 'private',
    keyword: valueFromDom('topicInput') || valueFromDom('topic') || '',
    crawlUrl: '',
    imageSource: defaults.thumbnailSource || 'nanobanana2',
    toneStyle: defaults.toneStyle || 'professional',
    contentMode: defaults.contentMode || 'external',
    ...typeSpecificDefaults(type),
  };
}

function typeSpecificDefaults(type) {
  const settings = readLocalSettings();
  if (type === 'blogger') {
    return {
      blogId: valueFromDom('blogId') || settings.blogId || '',
      clientId: valueFromDom('googleClientId') || settings.googleClientId || '',
      clientSecret: valueFromDom('googleClientSecret') || settings.googleClientSecret || '',
    };
  }
  if (type === 'wordpress') {
    return {
      siteUrl: valueFromDom('wordpressSiteUrl') || settings.wordpressSiteUrl || settings.blogUrl || '',
      username: valueFromDom('wordpressUsername') || settings.wordpressUsername || '',
      password: valueFromDom('wordpressPassword') || settings.wordpressPassword || '',
      wordpressCategory: valueFromDom('wordpressCategory') || settings.wordpressCategory || '',
    };
  }
  if (type === 'tistory') {
    const blogName = valueFromDom('tistoryBlogName') || settings.tistoryBlogName || settings.tistoryBlogUrl || '';
    return {
      tistoryBlogName: normalizeTistoryBlogName(blogName),
      tistoryBlogUrl: settings.tistoryBlogUrl || (blogName ? `https://${normalizeTistoryBlogName(blogName)}.tistory.com` : ''),
      tistoryDefaultCategory: valueFromDom('tistoryDefaultCategory') || settings.tistoryDefaultCategory || '',
      tistoryDefaultVisibility: valueFromDom('tistoryDefaultVisibility') || settings.tistoryDefaultVisibility || 'private',
    };
  }
  return {};
}

function loadAccounts() {
  const raw = parseJson(localStorage.getItem('multiAccounts'), []) || [];
  multiAccountsState = raw.map((account) => {
    const type = normalizePlatform(account.type);
    return {
      ...account,
      id: account.id || `acc_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      type,
      name: account.name || `${PLATFORM_META[type].title} ${raw.filter((a) => normalizePlatform(a.type) === type).length + 1}`,
      enabled: account.enabled !== false,
      settings: {
        ...defaultSettings(type),
        ...(account.settings || {}),
      },
    };
  });
}

function saveAccounts() {
  localStorage.setItem('multiAccounts', JSON.stringify(multiAccountsState));
  updateSelectedCount();
}

function updateSelectedCount() {
  const count = multiAccountsState.filter((account) => account.enabled).length;
  const el = document.getElementById('selectedAccountCount');
  if (el) el.textContent = `${count}개 선택됨`;
}

function accountKey(account) {
  if (account.type === 'blogger') return account.settings.blogId || '';
  if (account.type === 'wordpress') return account.settings.siteUrl || '';
  return normalizeTistoryBlogName(account.settings.tistoryBlogName || account.settings.tistoryBlogUrl || '');
}

function upsertAccount(type, settings, preferredName) {
  const normalizedType = normalizePlatform(type);
  const incomingKey = accountKey({ type: normalizedType, settings });
  let existing = multiAccountsState.find((account) => (
    account.type === normalizedType
    && incomingKey
    && accountKey(account).toLowerCase() === incomingKey.toLowerCase()
  ));
  if (!existing && incomingKey) {
    existing = multiAccountsState.find((account) => account.type === normalizedType && !accountKey(account));
  }
  if (existing) {
    existing.enabled = true;
    existing.settings = { ...existing.settings, ...settings };
    if (preferredName) existing.name = preferredName;
    return existing;
  }

  const sameTypeCount = multiAccountsState.filter((account) => account.type === normalizedType).length;
  const account = {
    id: `acc_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type: normalizedType,
    name: preferredName || `${PLATFORM_META[normalizedType].title} ${sameTypeCount + 1}`,
    enabled: true,
    settings: {
      ...defaultSettings(normalizedType),
      ...settings,
    },
  };
  multiAccountsState.push(account);
  return account;
}

function addMultiAccount(type, preset = {}) {
  loadAccounts();
  const normalizedType = normalizePlatform(type);
  const sameTypeCount = multiAccountsState.filter((account) => account.type === normalizedType).length;
  multiAccountsState.push({
    id: `acc_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type: normalizedType,
    name: `${PLATFORM_META[normalizedType].title} ${sameTypeCount + 1}`,
    enabled: true,
    settings: {
      ...defaultSettings(normalizedType),
      ...preset,
    },
  });
  saveAccounts();
  renderMultiAccountList();
}

function deleteMultiAccount(id) {
  if (!confirm('이 계정을 삭제하시겠습니까?')) return;
  multiAccountsState = multiAccountsState.filter((account) => account.id !== id);
  saveAccounts();
  renderMultiAccountList();
}

function toggleMultiAccount(id) {
  const account = multiAccountsState.find((item) => item.id === id);
  if (!account) return;
  account.enabled = !account.enabled;
  saveAccounts();
  renderMultiAccountList();
}

function updateMultiAccountSetting(id, field, value) {
  const account = multiAccountsState.find((item) => item.id === id);
  if (!account) return;
  if (field === 'name') {
    account.name = value;
  } else {
    account.settings[field] = value;
    if (field === 'tistoryBlogName') {
      account.settings.tistoryBlogName = normalizeTistoryBlogName(value);
      if (!account.settings.tistoryBlogUrl && account.settings.tistoryBlogName) {
        account.settings.tistoryBlogUrl = `https://${account.settings.tistoryBlogName}.tistory.com`;
      }
    }
  }
  saveAccounts();
}

function renderToolbar() {
  const list = document.getElementById('multiAccountList');
  const toolbar = list?.previousElementSibling;
  if (!toolbar || toolbar.dataset.multiAccountToolbar === '1') return;
  toolbar.dataset.multiAccountToolbar = '1';
  toolbar.className = 'ma-toolbar';
  toolbar.removeAttribute('style');
  toolbar.innerHTML = `
    <button type="button" class="ma-btn ma-btn-import" data-ma-action="import-current">현재 설정 불러오기</button>
    <button type="button" class="ma-btn ma-btn-blogger" data-ma-action="add-blogger">Blogger 추가</button>
    <button type="button" class="ma-btn ma-btn-wordpress" data-ma-action="add-wordpress">WordPress 추가</button>
    <button type="button" class="ma-btn ma-btn-tistory" data-ma-action="add-tistory">Tistory 추가</button>
  `;
  toolbar.addEventListener('click', async (event) => {
    const action = event.target?.closest?.('[data-ma-action]')?.dataset?.maAction;
    if (!action) return;
    if (action === 'import-current') {
      await importStoredAccounts();
    } else if (action === 'add-blogger') {
      addMultiAccount('blogger');
    } else if (action === 'add-wordpress') {
      addMultiAccount('wordpress');
    } else if (action === 'add-tistory') {
      addMultiAccount('tistory');
    }
  });
}

function renderAdvancedSettings() {
  const list = document.getElementById('multiAccountList');
  if (!list || document.getElementById('multiAdvancedSettingsCard')) return;
  const card = document.createElement('div');
  card.id = 'multiAdvancedSettingsCard';
  card.className = 'ma-advanced-card';
  card.innerHTML = `
    <div class="ma-advanced-head">
      <div>
        <h3>상세 설정 일괄 적용</h3>
        <p>연속발행에서 쓰는 콘텐츠 모드, 이미지 엔진, CTA, 발행 방식을 다중계정 발행에도 같이 적용합니다.</p>
      </div>
      <button type="button" class="ma-btn ma-btn-import" data-ma-advanced-import>현재 글포스팅 설정 불러오기</button>
    </div>
    <div class="ma-advanced-grid">
      ${renderAdvancedSelect('multiContentMode', '콘텐츠 모드', [
        ['external', '외부유입'],
        ['seo', 'SEO'],
        ['adsense', '애드센스'],
        ['custom', '커스텀'],
        ['paraphrasing', '초안 리라이팅'],
      ])}
      ${renderAdvancedSelect('multiToneStyle', '문체', [
        ['professional', '전문가형'],
        ['friendly', '친근한 설명형'],
        ['casual', '캐주얼'],
        ['formal', '격식형'],
      ])}
      ${renderAdvancedSelect('multiTitleMode', '제목 방식', [
        ['auto', '자동 최적화'],
        ['keyword', '키워드 중심'],
        ['click', '클릭 유도'],
      ])}
      ${renderAdvancedSelect('multiSectionCount', '본문 깊이', [
        ['3', '간단 3섹션'],
        ['5', '표준 5섹션'],
        ['7', '심층 7섹션'],
      ])}
      ${renderAdvancedSelect('multiThumbnailSource', '썸네일 엔진', imageEngineOptions())}
      ${renderAdvancedSelect('multiH2ImageSource', '본문 이미지 엔진', imageEngineOptions(true))}
      ${renderAdvancedSelect('multiH2ImageMode', '본문 이미지 배치', [
        ['auto', '자동 배치'],
        ['odd', '홀수 H2'],
        ['even', '짝수 H2'],
        ['thumbnail-only', '썸네일만'],
        ['none', '본문 이미지 없음'],
      ])}
      ${renderAdvancedSelect('multiCtaMode', 'CTA', [
        ['auto', '자동 CTA'],
        ['manual', '커스텀 CTA'],
        ['none', 'CTA 없음'],
      ])}
      ${renderAdvancedSelect('multiPostingMode', '발행 방식', [
        ['immediate', '즉시 발행'],
        ['draft', '임시 저장'],
        ['schedule', '예약 발행'],
      ])}
    </div>
    <div class="ma-note">Tistory 계정은 보안 세션 안정성을 위해 다중계정 발행에서도 항상 순차 처리됩니다.</div>
  `;
  list.insertAdjacentElement('afterend', card);
  card.querySelector('[data-ma-advanced-import]')?.addEventListener('click', applyCurrentDetailSettingsToAdvancedControls);
  applyCurrentDetailSettingsToAdvancedControls();
}

function imageEngineOptions(allowSame = false) {
  const options = [
    ['nanobanana2', 'Nano Banana 2'],
    ['dropshot-nanobanana-pro', 'Leaders Nano Banana Pro'],
    ['gptimage2', 'GPT 이미지 2'],
    ['deepinfra', 'DeepInfra'],
    ['leonardo', 'Leonardo AI'],
    ['flow', 'Flow'],
    ['crawled', 'URL 수집'],
    ['none', '없음'],
  ];
  return allowSame ? [['same', '썸네일과 동일'], ...options] : options;
}

function renderAdvancedSelect(id, label, options) {
  return `
    <label class="ma-field">
      <span>${escapeHtml(label)}</span>
      <select id="${id}" class="ma-select">
        ${options.map(([value, text]) => `<option value="${escapeHtml(value)}">${escapeHtml(text)}</option>`).join('')}
      </select>
    </label>
  `;
}

function setSelectValue(id, value) {
  const el = document.getElementById(id);
  if (!el || value === undefined || value === null || value === '') return;
  const normalized = String(value);
  const hasOption = Array.from(el.options || []).some((option) => option.value === normalized);
  if (hasOption) el.value = normalized;
}

function collectCurrentDetailSettings() {
  const settings = readLocalSettings();
  const thumbnailSource = valueFromDom('thumbnailType') || settings.thumbnailSource || settings.thumbnailType || 'nanobanana2';
  const h2Source = valueFromDom('h2ImageSource') || settings.h2ImageSource || thumbnailSource;
  return {
    provider: settings.defaultAiProvider || settings.generationEngine || '',
    generationEngine: settings.generationEngine || '',
    primaryGeminiTextModel: settings.primaryGeminiTextModel || '',
    contentMode: valueFromDom('contentMode') || localStorage.getItem('contentMode') || settings.contentMode || 'external',
    toneStyle: valueFromDom('toneStyle') || settings.toneStyle || 'professional',
    titleMode: valueFromDom('titleMode') || settings.titleMode || 'auto',
    sectionCount: valueFromDom('sectionCount') || settings.sectionCount || '5',
    thumbnailSource,
    thumbnailType: thumbnailSource,
    h2ImageSource: h2Source,
    h2ImageMode: valueFromDom('h2ImageMode') || settings.h2ImageMode || 'auto',
    ctaMode: checkedValue('ctaMode', settings.ctaMode || 'auto'),
    postingMode: checkedValue('postingMode', settings.postingMode || 'immediate'),
  };
}

function applyCurrentDetailSettingsToAdvancedControls() {
  const defaults = collectCurrentDetailSettings();
  setSelectValue('multiContentMode', defaults.contentMode);
  setSelectValue('multiToneStyle', defaults.toneStyle);
  setSelectValue('multiTitleMode', defaults.titleMode);
  setSelectValue('multiSectionCount', defaults.sectionCount);
  setSelectValue('multiThumbnailSource', defaults.thumbnailSource);
  setSelectValue('multiH2ImageSource', defaults.h2ImageSource === defaults.thumbnailSource ? 'same' : defaults.h2ImageSource);
  setSelectValue('multiH2ImageMode', defaults.h2ImageMode);
  setSelectValue('multiCtaMode', defaults.ctaMode);
  setSelectValue('multiPostingMode', defaults.postingMode);
}

function collectAdvancedSettings() {
  const defaults = collectCurrentDetailSettings();
  const thumbnailSource = valueFromDom('multiThumbnailSource') || defaults.thumbnailSource;
  const h2Raw = valueFromDom('multiH2ImageSource') || defaults.h2ImageSource;
  const h2ImageSource = h2Raw === 'same' ? thumbnailSource : h2Raw;
  return {
    ...defaults,
    contentMode: valueFromDom('multiContentMode') || defaults.contentMode,
    toneStyle: valueFromDom('multiToneStyle') || defaults.toneStyle,
    titleMode: valueFromDom('multiTitleMode') || defaults.titleMode,
    sectionCount: Number(valueFromDom('multiSectionCount') || defaults.sectionCount || 5),
    thumbnailSource,
    thumbnailType: thumbnailSource,
    thumbnailMode: thumbnailSource,
    h2ImageSource,
    h2Images: {
      source: h2ImageSource,
      mode: valueFromDom('multiH2ImageMode') || defaults.h2ImageMode || 'auto',
    },
    h2ImageMode: valueFromDom('multiH2ImageMode') || defaults.h2ImageMode || 'auto',
    ctaMode: valueFromDom('multiCtaMode') || defaults.ctaMode,
    postingMode: valueFromDom('multiPostingMode') || defaults.postingMode,
    publishType: valueFromDom('multiPostingMode') || defaults.postingMode,
  };
}

function renderInput(account, field, label, placeholder = '', type = 'text') {
  return `
    <label class="ma-field">
      <span>${escapeHtml(label)}</span>
      <input class="ma-input" type="${type}" data-ma-id="${escapeHtml(account.id)}" data-ma-field="${escapeHtml(field)}"
        value="${escapeHtml(account.settings[field] || '')}" placeholder="${escapeHtml(placeholder)}">
    </label>
  `;
}

function renderSelect(account, field, label, options) {
  const current = account.settings[field] || '';
  return `
    <label class="ma-field">
      <span>${escapeHtml(label)}</span>
      <select class="ma-select" data-ma-id="${escapeHtml(account.id)}" data-ma-field="${escapeHtml(field)}">
        ${options.map(([value, text]) => `<option value="${escapeHtml(value)}" ${current === value ? 'selected' : ''}>${escapeHtml(text)}</option>`).join('')}
      </select>
    </label>
  `;
}

function platformFields(account) {
  if (account.type === 'blogger') {
    return [
      renderInput(account, 'blogId', 'Blog ID', '숫자 Blog ID'),
      renderInput(account, 'clientId', 'Client ID', 'OAuth Client ID'),
      renderInput(account, 'clientSecret', 'Client Secret', 'OAuth Client Secret', 'password'),
    ].join('');
  }
  if (account.type === 'wordpress') {
    return [
      renderInput(account, 'siteUrl', 'Site URL', 'https://yoursite.com'),
      renderInput(account, 'username', 'Username', '관리자 아이디'),
      renderInput(account, 'password', 'App Password', '애플리케이션 비밀번호', 'password'),
      renderInput(account, 'wordpressCategory', '카테고리', '선택 카테고리 ID 또는 이름'),
    ].join('');
  }
  return [
    renderInput(account, 'tistoryBlogName', 'Tistory 블로그', 'leadernam 또는 https://leadernam.tistory.com'),
    renderInput(account, 'tistoryDefaultCategory', '카테고리', '선택 카테고리 이름'),
    renderSelect(account, 'tistoryDefaultVisibility', '공개 설정', [
      ['public', '공개'],
      ['private', '비공개'],
      ['protected', '보호'],
    ]),
  ].join('');
}

function renderAccountCard(account) {
  const meta = PLATFORM_META[account.type] || PLATFORM_META.blogger;
  return `
    <div class="ma-account-card ${account.enabled ? 'is-enabled' : 'is-disabled'}" style="--ma-color:${meta.color}">
      <div class="ma-card-head">
        <label class="ma-toggle">
          <input type="checkbox" data-ma-toggle="${escapeHtml(account.id)}" ${account.enabled ? 'checked' : ''}>
          <span>${escapeHtml(meta.icon)}</span>
        </label>
        <input class="ma-name-input" data-ma-id="${escapeHtml(account.id)}" data-ma-field="name"
          value="${escapeHtml(account.name)}" aria-label="계정 이름">
        <span class="ma-platform-pill">${escapeHtml(meta.label)}</span>
        <button type="button" class="ma-delete-btn" data-ma-delete="${escapeHtml(account.id)}">삭제</button>
      </div>
      <div class="ma-grid">
        ${platformFields(account)}
        ${renderInput(account, 'keyword', '키워드', '발행할 키워드')}
        ${renderInput(account, 'crawlUrl', '크롤링 URL', '참고할 URL 또는 제품 링크')}
        ${renderSelect(account, 'imageSource', '계정별 이미지 엔진', imageEngineOptions())}
        ${renderSelect(account, 'contentMode', '계정별 콘텐츠 모드', [
          ['external', '외부유입'],
          ['seo', 'SEO'],
          ['adsense', '애드센스'],
          ['custom', '커스텀'],
          ['paraphrasing', '초안 리라이팅'],
        ])}
      </div>
    </div>
  `;
}

function bindAccountEvents(container) {
  container.querySelectorAll('[data-ma-field]').forEach((el) => {
    const eventName = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(eventName, (event) => {
      const target = event.currentTarget;
      updateMultiAccountSetting(target.dataset.maId, target.dataset.maField, target.value);
    });
  });
  container.querySelectorAll('[data-ma-toggle]').forEach((el) => {
    el.addEventListener('change', (event) => toggleMultiAccount(event.currentTarget.dataset.maToggle));
  });
  container.querySelectorAll('[data-ma-delete]').forEach((el) => {
    el.addEventListener('click', (event) => deleteMultiAccount(event.currentTarget.dataset.maDelete));
  });
}

function renderMultiAccountList() {
  loadAccounts();
  renderToolbar();
  renderAdvancedSettings();
  const container = document.getElementById('multiAccountList');
  if (!container) return;
  container.className = 'ma-account-list';
  container.removeAttribute('style');

  if (multiAccountsState.length === 0) {
    container.innerHTML = `
      <div class="ma-empty">
        <strong>등록된 계정이 없습니다.</strong>
        <p>현재 설정 불러오기를 누르거나 Blogger, WordPress, Tistory 계정을 추가하세요.</p>
      </div>
    `;
    updateSelectedCount();
    return;
  }

  container.innerHTML = multiAccountsState.map(renderAccountCard).join('');
  bindAccountEvents(container);
  updateSelectedCount();
}

async function importStoredAccounts(options = {}) {
  loadAccounts();
  const local = readLocalSettings();
  const env = await readEnvSettings();
  const current = collectCurrentDetailSettings();
  let added = 0;

  const bloggerSettings = {
    ...defaultSettings('blogger'),
    ...current,
    blogId: valueFromDom('blogId') || local.blogId || env.BLOG_ID || env.blogId || '',
    clientId: valueFromDom('googleClientId') || local.googleClientId || env.GOOGLE_CLIENT_ID || env.googleClientId || '',
    clientSecret: valueFromDom('googleClientSecret') || local.googleClientSecret || env.GOOGLE_CLIENT_SECRET || env.googleClientSecret || '',
    keyword: valueFromDom('topicInput') || valueFromDom('topic') || '',
  };
  if (bloggerSettings.blogId || bloggerSettings.clientId || bloggerSettings.clientSecret) {
    upsertAccount('blogger', bloggerSettings, 'Blogger 현재 설정');
    added += 1;
  }

  const wpSettings = {
    ...defaultSettings('wordpress'),
    ...current,
    siteUrl: valueFromDom('wordpressSiteUrl') || local.wordpressSiteUrl || env.WORDPRESS_SITE_URL || env.wordpressSiteUrl || env.BLOG_URL || '',
    username: valueFromDom('wordpressUsername') || local.wordpressUsername || env.WORDPRESS_USERNAME || env.wordpressUsername || '',
    password: valueFromDom('wordpressPassword') || local.wordpressPassword || env.WORDPRESS_PASSWORD || env.wordpressPassword || '',
    wordpressCategory: local.wordpressCategory || local.wordpressCategories || env.WORDPRESS_CATEGORIES || '',
    keyword: valueFromDom('topicInput') || valueFromDom('topic') || '',
  };
  if (wpSettings.siteUrl || wpSettings.username || wpSettings.password) {
    upsertAccount('wordpress', wpSettings, 'WordPress 현재 설정');
    added += 1;
  }

  const tistoryNameRaw = valueFromDom('tistoryBlogName') || local.tistoryBlogName || local.tistoryBlogUrl || env.TISTORY_BLOG_NAME || env.TISTORY_BLOG_URL || '';
  const tistoryBlogName = normalizeTistoryBlogName(tistoryNameRaw);
  const tistorySettings = {
    ...defaultSettings('tistory'),
    ...current,
    tistoryBlogName,
    tistoryBlogUrl: local.tistoryBlogUrl || env.TISTORY_BLOG_URL || (tistoryBlogName ? `https://${tistoryBlogName}.tistory.com` : ''),
    tistoryDefaultCategory: valueFromDom('tistoryDefaultCategory') || local.tistoryDefaultCategory || env.TISTORY_DEFAULT_CATEGORY || '',
    tistoryDefaultVisibility: valueFromDom('tistoryDefaultVisibility') || local.tistoryDefaultVisibility || env.TISTORY_DEFAULT_VISIBILITY || 'private',
    keyword: valueFromDom('topicInput') || valueFromDom('topic') || '',
  };
  if (tistorySettings.tistoryBlogName || tistorySettings.tistoryBlogUrl) {
    upsertAccount('tistory', tistorySettings, 'Tistory 현재 설정');
    added += 1;
  }

  saveAccounts();
  renderMultiAccountList();
  if (!options.silent) {
    alert(added > 0 ? '저장된 플랫폼 설정을 다중계정 목록으로 불러왔습니다.' : '불러올 플랫폼 설정이 없습니다. 먼저 환경설정에서 플랫폼 정보를 저장해주세요.');
  }
}

function openMultiAccountModal() {
  const modal = document.getElementById('multiAccountModal');
  if (modal) modal.style.display = 'block';
  renderMultiAccountList();
  if (multiAccountsState.length === 0) {
    importStoredAccounts({ silent: true });
  }
}

function closeMultiAccountModal() {
  const modal = document.getElementById('multiAccountModal');
  if (modal) modal.style.display = 'none';
}

function addLog(message, type = 'info') {
  const logContainer = document.getElementById('multiPublishLog');
  if (!logContainer) return;
  const colors = { info: '#60a5fa', success: '#34d399', error: '#f87171', warning: '#fbbf24' };
  const time = new Date().toLocaleTimeString();
  logContainer.innerHTML += `<div style="color:${colors[type] || colors.info};margin-bottom:4px;">[${time}] ${escapeHtml(message)}</div>`;
  logContainer.scrollTop = logContainer.scrollHeight;
}

function setPublishingUi(active) {
  const start = document.getElementById('multiPublishBtn');
  const stop = document.getElementById('multiStopBtn');
  const progress = document.getElementById('multiPublishProgress');
  if (start) start.style.display = active ? 'none' : 'flex';
  if (stop) stop.style.display = active ? 'flex' : 'none';
  if (progress) progress.style.display = 'block';
}

async function publishToAccount(account) {
  const advanced = collectAdvancedSettings();
  const payload = {
    ...advanced,
    platform: account.type,
    targetPlatform: account.type === 'blogger' ? 'blogspot' : account.type,
    keyword: account.settings.keyword || '',
    topic: account.settings.keyword || '',
    crawlUrl: account.settings.crawlUrl || '',
    imageSource: account.settings.imageSource || advanced.thumbnailSource || 'nanobanana2',
    thumbnailSource: account.settings.imageSource || advanced.thumbnailSource || 'nanobanana2',
    thumbnailType: account.settings.imageSource || advanced.thumbnailType || 'nanobanana2',
    h2ImageSource: advanced.h2ImageSource || account.settings.imageSource || 'nanobanana2',
    toneStyle: account.settings.toneStyle || advanced.toneStyle || 'professional',
    contentMode: account.settings.contentMode || advanced.contentMode || 'external',
    blogId: account.settings.blogId || '',
    googleClientId: account.settings.clientId || '',
    googleClientSecret: account.settings.clientSecret || '',
    wordpressSiteUrl: account.settings.siteUrl || '',
    wordpressUsername: account.settings.username || '',
    wordpressPassword: account.settings.password || '',
    wordpressCategory: account.settings.wordpressCategory || '',
    wordpressCategories: account.settings.wordpressCategory || '',
    tistoryBlogName: account.settings.tistoryBlogName || '',
    tistoryBlogUrl: account.settings.tistoryBlogUrl || '',
    tistoryDefaultCategory: account.settings.tistoryDefaultCategory || '',
    tistoryDefaultVisibility: account.settings.tistoryDefaultVisibility || 'private',
  };

  const api = window.electronAPI || window.blogger;
  if (!api?.runMultiAccountPost) {
    throw new Error('다중계정 발행 API를 찾을 수 없습니다. 앱을 다시 실행해주세요.');
  }
  const result = await api.runMultiAccountPost(payload);
  if (!result?.ok) {
    throw new Error(result?.error || '발행 실패');
  }
  return result;
}

async function publishGroup(accounts) {
  const regular = accounts.filter((account) => account.type !== 'tistory');
  const tistory = accounts.filter((account) => account.type === 'tistory');
  const results = [];

  if (regular.length > 0) {
    addLog(`일반 플랫폼 ${regular.length}개 계정 동시 발행 시작`, 'info');
    const regularResults = await Promise.all(regular.map(async (account) => {
      try {
        addLog(`[${account.name}] 발행 시작: ${account.settings.keyword}`, 'info');
        const result = await publishToAccount(account);
        addLog(`[${account.name}] 발행 완료${result.url ? `: ${result.url}` : ''}`, 'success');
        return { account, ok: true, result };
      } catch (error) {
        addLog(`[${account.name}] 발행 실패: ${error.message}`, 'error');
        return { account, ok: false, error };
      }
    }));
    results.push(...regularResults);
  }

  for (const account of tistory) {
    if (publishAbort) break;
    try {
      addLog(`[${account.name}] Tistory 순차 발행 시작: ${account.settings.keyword}`, 'info');
      const result = await publishToAccount(account);
      addLog(`[${account.name}] Tistory 발행 완료${result.url ? `: ${result.url}` : ''}`, 'success');
      results.push({ account, ok: true, result });
    } catch (error) {
      addLog(`[${account.name}] Tistory 발행 실패: ${error.message}`, 'error');
      results.push({ account, ok: false, error });
    }
  }

  return results;
}

async function startMultiPublish() {
  loadAccounts();
  const enabledAccounts = multiAccountsState.filter((account) => account.enabled);
  if (enabledAccounts.length === 0) {
    alert('발행할 계정을 선택해주세요.');
    return;
  }
  const missingKeyword = enabledAccounts.find((account) => !account.settings.keyword?.trim());
  if (missingKeyword) {
    alert(`"${missingKeyword.name}" 계정에 키워드가 입력되지 않았습니다.`);
    return;
  }

  isPublishing = true;
  publishAbort = false;
  setPublishingUi(true);
  const logContainer = document.getElementById('multiPublishLog');
  if (logContainer) logContainer.innerHTML = '';

  const mode = valueFromDom('multiPublishMode') || 'simultaneous';
  const interval = Number(valueFromDom('multiPublishInterval') || 0) * 1000;
  const batchCount = Math.max(1, Number(valueFromDom('multiPublishCount') || 1));
  const hasTistory = enabledAccounts.some((account) => account.type === 'tistory');
  if (hasTistory) {
    addLog('Tistory 계정은 세션 보호를 위해 항상 1개씩 순차 발행합니다.', 'warning');
  }

  try {
    if (mode === 'simultaneous') {
      const results = await publishGroup(enabledAccounts);
      const successCount = results.filter((item) => item.ok).length;
      addLog(`다중계정 발행 완료: ${successCount}/${results.length} 성공`, 'success');
    } else if (mode === 'sequential') {
      for (let i = 0; i < enabledAccounts.length; i += 1) {
        if (publishAbort) break;
        await publishGroup([enabledAccounts[i]]);
        if (i < enabledAccounts.length - 1 && interval > 0) {
          addLog(`${interval / 1000}초 대기 후 다음 계정으로 이동합니다.`, 'info');
          await new Promise((resolve) => setTimeout(resolve, interval));
        }
      }
      addLog('순차 발행 완료', 'success');
    } else {
      for (let round = 0; round < batchCount; round += 1) {
        if (publishAbort) break;
        addLog(`대량 발행 라운드 ${round + 1}/${batchCount} 시작`, 'info');
        await publishGroup(enabledAccounts);
        if (round < batchCount - 1 && interval > 0) {
          addLog(`${interval / 1000}초 대기 후 다음 라운드로 이동합니다.`, 'info');
          await new Promise((resolve) => setTimeout(resolve, interval));
        }
      }
      addLog('대량 발행 완료', 'success');
    }
  } catch (error) {
    addLog(`오류 발생: ${error.message}`, 'error');
  } finally {
    isPublishing = false;
    setPublishingUi(false);
  }
}

function stopMultiPublish() {
  publishAbort = true;
  addLog('발행 중단 요청을 받았습니다. 현재 작업이 끝나면 멈춥니다.', 'warning');
}

function bootstrap() {
  loadAccounts();
  window.openMultiAccountModal = openMultiAccountModal;
  window.closeMultiAccountModal = closeMultiAccountModal;
  window.addMultiAccount = addMultiAccount;
  window.deleteMultiAccount = deleteMultiAccount;
  window.toggleMultiAccount = toggleMultiAccount;
  window.updateMultiAccountSetting = updateMultiAccountSetting;
  window.renderMultiAccountList = renderMultiAccountList;
  window.startMultiPublish = startMultiPublish;
  window.stopMultiPublish = stopMultiPublish;
  window.importStoredMultiAccounts = importStoredAccounts;
  renderToolbar();
  renderAdvancedSettings();
  renderMultiAccountList();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
