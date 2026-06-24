// publish-queue.js — 줄바꿈 키워드 → 연속발행 대기열 UI 모듈
//
// 동작:
//   1) #keywordInput textarea에서 줄바꿈으로 2개 이상 키워드 입력 → publishQueueBadge 자동 표시
//   2) "📋 대기열 열기" → 모달 띄움
//   3) 모달에서 키워드별 개별 세팅(모드/엔진/CTA) 또는 일괄 세팅
//   4) "🚀 대기열 발행 시작" → scheduledPosts에 추가하거나 즉시 순차 발행
//
// 기존 시스템 재활용:
//   - localStorage 'scheduledPosts' (스케줄러)
//   - publishQueue 항목은 scheduledPosts와 같은 스키마로 변환

const STATE = {
  keywords: [],     // [{ id, keyword, mode, ctaMode, manualCta, thumb, enabled }]
  isOpen: false,
  hydrated: false,
};

const PUBLISH_QUEUE_STORAGE_KEY = 'publishQueueItems.v1';
const PUBLISH_QUEUE_INTERVAL_STORAGE_KEY = 'publishQueueInterval.v1';
const PUBLISH_QUEUE_MIN_MINUTES = 7;
const PUBLISH_QUEUE_DEFAULT_INTERVAL = { mode: 'minutes', value: PUBLISH_QUEUE_MIN_MINUTES };

function readQueueJsonStorage(key, fallback = '') {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return localStorage.getItem(key) || fallback;
  }
}

function getQueueAgentImageMode() {
  if (typeof window !== 'undefined' && typeof window.getAgentImageSettingsMode === 'function') {
    return window.getAgentImageSettingsMode();
  }
  const executionMode = readQueueJsonStorage('leadernamExecutionMode', 'api') === 'agent' ? 'agent' : 'api';
  const provider = readQueueJsonStorage('leadernamActiveAgentProvider', 'codex') === 'claude' ? 'claude' : 'codex';
  return {
    executionMode,
    provider,
    isAgentMode: executionMode === 'agent',
    codexImageManaged: false,
    agentUsesImageApi: executionMode === 'agent',
    claudeNeedsImageEngine: executionMode === 'agent',
  };
}

function isQueueCodexImageManaged() {
  return false;
}

function persistQueue() {
  try {
    localStorage.setItem(PUBLISH_QUEUE_STORAGE_KEY, JSON.stringify(STATE.keywords || []));
  } catch (e) {
    console.warn('[QUEUE] persist failed:', e);
  }
}

function restoreQueue() {
  if (STATE.hydrated) return;
  STATE.hydrated = true;
  try {
    const raw = localStorage.getItem(PUBLISH_QUEUE_STORAGE_KEY);
    if (!raw) return;
    const items = JSON.parse(raw);
    if (!Array.isArray(items)) return;
    STATE.keywords = items
      .filter(item => item && String(item.keyword || '').trim())
      .map(item => applySnapshotToItem({ enabled: true, ...item }, item.settingsSnapshot || undefined));
  } catch (e) {
    console.warn('[QUEUE] restore failed:', e);
  }
}

function getKeywordsFromTextarea() {
  const ta = document.getElementById('keywordInput');
  if (!ta) return [];
  return String(ta.value || '')
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function getLinesFromTextarea(id) {
  const el = document.getElementById(id);
  if (!el) return [];
  return String(el.value || '')
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

function isHttpUrl(value) {
  return /^https?:\/\/\S+/i.test(String(value || '').trim());
}

function getReferenceUrls() {
  return getLinesFromTextarea('referenceUrl').filter(isHttpUrl);
}

function getSingleInputMode() {
  try { return localStorage.getItem('singleInputMode') || 'keyword'; }
  catch { return 'keyword'; }
}

function labelFromUrl(url, index) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean).pop() || u.hostname;
    return `URL ${index + 1}: ${u.hostname}${path && path !== u.hostname ? `/${path}` : ''}`;
  } catch {
    return `URL ${index + 1}`;
  }
}

function hostFromUrl(url) {
  try { return new URL(url).hostname; }
  catch { return String(url || '').slice(0, 42); }
}

function getQueueInputEntries() {
  const inputMode = getSingleInputMode();
  const keywords = getKeywordsFromTextarea();
  const referenceUrls = getReferenceUrls();

  if (inputMode === 'url') {
    return referenceUrls.map((url, index) => ({
      keyword: labelFromUrl(url, index),
      contentUrl: url,
      sourceUrl: url,
    }));
  }

  return keywords.map((rawKeyword, index) => {
    const keywordIsUrl = isHttpUrl(rawKeyword);
    const contentUrl = referenceUrls[index] || (keywordIsUrl ? rawKeyword : '');
    return {
      keyword: keywordIsUrl ? labelFromUrl(rawKeyword, index) : rawKeyword,
      contentUrl,
      sourceUrl: contentUrl,
    };
  });
}

function ensureBadgePlacement() {
  const badge = document.getElementById('publishQueueBadge');
  if (!badge) return;
  const keywordBlock = document.getElementById('keywordInputBlock');
  const referenceBlock = document.getElementById('referenceUrlBlock');
  const shouldLiveWithUrls = getCurrentMode() === 'bulk' && getSingleInputMode() === 'url' && referenceBlock;
  const target = shouldLiveWithUrls ? referenceBlock : keywordBlock;
  if (target && badge.parentElement !== target) {
    target.appendChild(badge);
  }
}

function getCurrentMode() {
  const btn = document.querySelector('[data-publish-mode][aria-selected="true"]');
  return btn?.dataset?.publishMode || 'single';
}

function normalizeIntervalMode(mode) {
  const raw = String(mode || '').toLowerCase();
  if (raw === 'hours' || raw === 'random') return raw;
  return 'minutes';
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function clampIntervalValue(mode, value) {
  const normalized = normalizeIntervalMode(mode);
  if (normalized === 'hours') return clampNumber(value, 1, 72, 1);
  if (normalized === 'random') return PUBLISH_QUEUE_DEFAULT_INTERVAL.value;
  return clampNumber(value, PUBLISH_QUEUE_MIN_MINUTES, 1440, PUBLISH_QUEUE_MIN_MINUTES);
}

function fixedIntervalToMinutes(mode, value) {
  const normalized = normalizeIntervalMode(mode);
  const fixed = clampIntervalValue(normalized, value);
  if (normalized === 'hours') return fixed * 60;
  return fixed;
}

function readQueueIntervalSetting() {
  try {
    const raw = localStorage.getItem(PUBLISH_QUEUE_INTERVAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const mode = normalizeIntervalMode(parsed?.mode);
      return { mode, value: clampIntervalValue(mode, parsed?.value) };
    }
  } catch (e) {
    console.warn('[QUEUE] interval restore failed:', e);
  }

  const mainInput = document.getElementById('publishIntervalMinutes');
  if (mainInput) {
    const minutes = clampIntervalValue('minutes', mainInput.value);
    return { mode: 'minutes', value: minutes };
  }
  return { ...PUBLISH_QUEUE_DEFAULT_INTERVAL };
}

function persistQueueInterval(mode, value, options = {}) {
  const normalized = normalizeIntervalMode(mode);
  const fixedValue = clampIntervalValue(normalized, value);
  const next = { mode: normalized, value: fixedValue };
  try {
    localStorage.setItem(PUBLISH_QUEUE_INTERVAL_STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn('[QUEUE] interval persist failed:', e);
  }

  const mainInput = document.getElementById('publishIntervalMinutes');
  if (mainInput && options.syncMain !== false && normalized !== 'random') {
    mainInput.value = String(fixedIntervalToMinutes(normalized, fixedValue));
  }
  return next;
}

function bindMainIntervalControl() {
  const input = document.getElementById('publishIntervalMinutes');
  if (!input || input.dataset.publishQueueIntervalBound === '1') return;
  input.dataset.publishQueueIntervalBound = '1';
  input.min = String(PUBLISH_QUEUE_MIN_MINUTES);
  input.step = '1';
  input.max = input.max || '1440';

  const restored = readQueueIntervalSetting();
  if (restored.mode !== 'random') input.value = String(fixedIntervalToMinutes(restored.mode, restored.value));

  const syncFromMain = () => {
    const minutes = clampIntervalValue('minutes', input.value);
    input.value = String(minutes);
    persistQueueInterval('minutes', minutes, { syncMain: false });
    if (STATE.isOpen) {
      const modeEl = document.getElementById('pq-interval-mode');
      const valueEl = document.getElementById('pq-interval-value');
      if (modeEl) modeEl.value = 'minutes';
      if (valueEl) valueEl.value = String(minutes);
      syncIntervalControl({ persist: false });
    }
  };

  input.addEventListener('input', syncFromMain);
  input.addEventListener('change', syncFromMain);
  input.addEventListener('blur', syncFromMain);
}

// v3.8.117: 연속발행 모드 활성 시 메인 5개 탭 (콘텐츠/이미지/발행/초안/카테고리) 숨김
//   사용자 요청: "연속발행 모드에서는 숨겨주고 대기열에서 전부 가능하게"
function togglePostingSettingsForQueue() {
  try {
    const queueActive = (STATE.keywords?.length || 0) > 0 || window.__queueRunning === true;
    const tabBar = document.querySelector('.posting-settings-tab-bar');
    const settingsArea = tabBar?.closest('.posting-settings-area') || tabBar?.parentElement;
    if (!settingsArea) return;
    let banner = document.getElementById('queue-active-banner');
    if (queueActive) {
      settingsArea.style.opacity = '0.25';
      settingsArea.style.pointerEvents = 'none';
      settingsArea.style.userSelect = 'none';
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'queue-active-banner';
        banner.style.cssText = 'margin:10px 0;padding:12px 16px;background:linear-gradient(135deg,rgba(99,102,241,0.18),rgba(139,92,246,0.18));border:1px solid rgba(139,92,246,0.55);border-radius:12px;color:#c7d2fe;font-size:13px;font-weight:700;display:flex;align-items:center;gap:10px;';
        banner.innerHTML = '⚡ <strong>연속발행 모드 활성</strong> — 메인 화면 옵션은 비활성화. 대기열 모달 (📋 대기열 보기 및 발행하러가기)에서 일괄 설정하세요.';
        settingsArea.parentElement?.insertBefore(banner, settingsArea);
      }
    } else {
      settingsArea.style.opacity = '';
      settingsArea.style.pointerEvents = '';
      settingsArea.style.userSelect = '';
      banner?.remove();
    }
  } catch (e) {
    console.warn('[QUEUE-TOGGLE] failed:', e?.message);
  }
}

function syncBadge() {
  restoreQueue();
  bindMainIntervalControl();
  togglePostingSettingsForQueue();
  const badge = document.getElementById('publishQueueBadge');
  const countEl = document.getElementById('publishQueueCount');
  const currentCountEl = document.getElementById('publishQueueCurrentCount');
  const savedCountEl = document.getElementById('publishQueueSavedCount');
  const actionButtons = document.getElementById('publishQueueActionButtons');
  const publishBtn = document.getElementById('publishBtn');
  const settingsBtn = document.getElementById('postingSettingsToggleBtn');
  const singleHint = document.getElementById('singleModeHint');
  const bulkHint = document.getElementById('bulkModeHint');
  if (!badge) return;

  ensureBadgePlacement();

  const mode = getCurrentMode();
  const list = getQueueInputEntries();
  const savedCount = STATE.keywords.length;

  if (currentCountEl) currentCountEl.textContent = String(list.length);
  if (savedCountEl) savedCountEl.textContent = String(savedCount);
  if (countEl) countEl.textContent = String(savedCount);

  if (mode === 'bulk') {
    // 연속 발행 서브탭 — 큐 패널 항상 표시
    badge.style.display = 'flex';
    if (actionButtons) actionButtons.style.display = 'flex';
    if (publishBtn) publishBtn.style.display = 'none';
    if (settingsBtn) settingsBtn.style.display = 'none';
    if (singleHint) singleHint.style.display = 'none';
    if (bulkHint) bulkHint.style.display = 'inline-block';
  } else {
    // 단일 발행 서브탭 — 큐 패널 숨김
    badge.style.display = 'none';
    if (actionButtons) actionButtons.style.display = 'none';
    if (publishBtn) publishBtn.style.display = '';
    if (settingsBtn) settingsBtn.style.display = '';
    if (singleHint) singleHint.style.display = 'block';
    if (bulkHint) bulkHint.style.display = 'none';
  }
}

/** 서브탭 토글 — single ↔ bulk */
function bindPublishModeTabs() {
  const tabs = document.querySelectorAll('[data-publish-mode]');
  if (!tabs.length) return;
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.publishMode;
      tabs.forEach(t => {
        const isActive = t === tab;
        t.setAttribute('aria-selected', String(isActive));
        if (isActive) {
          t.style.background = 'linear-gradient(135deg,#6366f1,#8b5cf6)';
          t.style.color = 'white';
          t.style.boxShadow = '0 4px 12px rgba(99,102,241,0.3)';
        } else {
          t.style.background = 'transparent';
          t.style.color = 'rgba(255,255,255,0.6)';
          t.style.boxShadow = 'none';
        }
      });
      syncBadge();
      // 연속 발행 모드 진입 시 키워드 1개만 있으면 안내
      if (mode === 'bulk') {
        const list = getKeywordsFromTextarea();
        if (list.length < 2) {
          const ta = document.getElementById('keywordInput');
          if (ta && !ta.value.includes('\n')) {
            ta.placeholder = '예: 블로그 수익화 방법\nAI 마케팅 전략\n부수입 만들기';
            ta.focus();
          }
        }
      }
    });
  });
}

// ════════════════════════════════════════════
// 모달 빌드
// ════════════════════════════════════════════

const QUEUE_LABELS = {
  contentMode: {
    external: 'SEO 외부링크',
    internal: '내부링크',
    adsense: '애드센스',
    paraphrasing: '페러프레이징',
    shopping: '쇼핑',
  },
  thumb: {
    nanobanana: '나노바나나',
    nanobanana2: '나노바나나 2',
    nanobananapro: '나노바나나 Pro',
    'dropshot-nanobanana-pro': '리더스 무제한',
    gptimage1: 'GPT 이미지 1',
    gptimage2: '덕트테이프',
    prodia: 'Prodia',
    deepinfra: 'DeepInfra',
    leonardo: 'Leonardo',
    flow: 'Flow',
    crawled: 'URL 수집',
    none: '없음',
  },
  cta: {
    auto: '자동',
    manual: '수동',
    none: '없음',
  },
  platform: {
    wordpress: 'WordPress',
    blogspot: 'Blogspot',
    blogger: 'Blogspot',
    tistory: 'Tistory',
  },
  postingMode: {
    publish: '즉시 발행',
    draft: '임시 발행',
    schedule: '예약 발행',
  },
  h2ImageMode: {
    all: '전체',
    odd: '홀수만',
    even: '짝수만',
    'thumbnail-only': '썸네일만',
    none: '이미지 없음',
  },
};

function labelOf(group, value, fallback = '-') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  return QUEUE_LABELS[group]?.[raw] || raw;
}

function getRadioValue(name, fallback = '') {
  return document.querySelector(`input[name="${name}"]:checked`)?.value || fallback;
}

function getSelectValue(id, fallback = '') {
  return document.getElementById(id)?.value || fallback;
}

function normalizeThumbEngine(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === 'auto') return 'nanobanana2';
  if (raw === 'imagefx') return 'flow';
  return raw;
}

function normalizeH2ImageMode(value) {
  const raw = String(value || '').trim().toLowerCase().replace(/_/g, '-');
  if (raw === 'odd-only') return 'odd';
  if (raw === 'even-only') return 'even';
  if (raw === 'thumbnail' || raw === 'thumbnailonly') return 'thumbnail-only';
  if (['all', 'odd', 'even', 'thumbnail-only', 'none'].includes(raw)) return raw;
  return 'all';
}

const PQ_INTERVAL_FLOORS = {
  general: PUBLISH_QUEUE_MIN_MINUTES * 60 * 1000,
  slow: 7 * 60 * 1000,
  browser: 8 * 60 * 1000,
};

function classifyQueueImageEngine(engine) {
  const raw = String(engine || '').trim().toLowerCase();
  if (!raw || raw === 'none' || raw === 'skip' || raw === 'crawled') return 'general';
  if (/(dropshot|imagefx|image-fx|\bflow\b|labs-flow|labsflow|googleflow|browser|playwright)/i.test(raw)) return 'browser';
  if (/(nanobanana|nano-banana|gptimage|gpt-image|deepinfra|leonardo|gemini.*image)/i.test(raw)) return 'slow';
  return 'general';
}

function getQueueItemMinIntervalMs(item) {
  const h2Mode = normalizeH2ImageMode(item?.h2ImageMode || 'all');
  const engines = h2Mode === 'none'
    ? []
    : h2Mode === 'thumbnail-only'
      ? [item?.thumb]
      : [item?.thumb, item?.h2ImageSource || item?.thumb];
  const classes = engines.map(classifyQueueImageEngine);
  if (classes.includes('browser')) return PQ_INTERVAL_FLOORS.browser;
  if (classes.includes('slow')) return PQ_INTERVAL_FLOORS.slow;
  return PQ_INTERVAL_FLOORS.general;
}

function getQueueMinPublishIntervalMs(items) {
  const list = (items && items.length ? items : STATE.keywords).filter(item => item && item.enabled !== false);
  if (list.length === 0) return PQ_INTERVAL_FLOORS.general;
  return Math.max(PQ_INTERVAL_FLOORS.general, ...list.map(getQueueItemMinIntervalMs));
}

function getQueueIntervalReason(items) {
  const minMs = getQueueMinPublishIntervalMs(items);
  if (minMs >= PQ_INTERVAL_FLOORS.browser) return '브라우저 이미지 엔진 감지: 최소 8분';
  if (minMs >= PQ_INTERVAL_FLOORS.slow) return '이미지 생성 엔진 기준: 최소 7분';
  return '연속발행 최소 간격: 7분';
}

function getCurrentH2ImageSource() {
  return normalizeThumbEngine(
    getSelectValue('h2ImageSource')
    || document.querySelector('input[name="h2ImageSource"]:checked')?.value
    || getSelectValue('thumbnailType')
    || 'nanobanana2'
  );
}

function getCurrentH2ImageMode() {
  const direct = getSelectValue('h2ImageMode');
  const swPolicy = document.querySelector('input[name="swImagePolicy"]:checked')?.value || '';
  return normalizeH2ImageMode(direct || swPolicy || 'all');
}

function getCurrentCtaMode() {
  return getRadioValue('ctaMode') || getSelectValue('scheduleCtaMode') || 'auto';
}

function normalizeManualCta(cta) {
  const raw = cta || {};
  return {
    url: String(raw.url || '').trim(),
    text: String(raw.text || raw.title || '').trim(),
    hook: String(raw.hook || '').trim(),
  };
}

function getCurrentManualQueueCta() {
  try {
    const fromGetter = typeof window.getManualCtas === 'function' ? window.getManualCtas() : null;
    if (Array.isArray(fromGetter)) {
      const found = fromGetter.find(cta => cta && cta.url);
      if (found) return normalizeManualCta(found);
    }
  } catch (e) {
    console.warn('[QUEUE] manual CTA getter failed:', e);
  }

  try {
    const appState = typeof getAppState === 'function' ? getAppState() : null;
    const list = appState?.manualCtasData || [];
    if (Array.isArray(list)) {
      const found = list.find(cta => cta && cta.url);
      if (found) return normalizeManualCta(found);
    }
  } catch (e) {
    console.warn('[QUEUE] manual CTA state failed:', e);
  }

  return { url: '', text: '', hook: '' };
}

function getItemManualCta(item) {
  if (!item) return { url: '', text: '', hook: '' };
  if (!item.manualCta && item.customCta) item.manualCta = item.customCta;
  item.manualCta = normalizeManualCta(item.manualCta || {});
  return item.manualCta;
}

function ensureItemManualCta(item) {
  const current = getItemManualCta(item);
  if (!current.url && !current.text && !current.hook) {
    item.manualCta = getCurrentManualQueueCta();
  }
  return getItemManualCta(item);
}

function isManualCtaReady(cta) {
  return !!cta && isHttpUrl(cta.url);
}

function buildManualCtasForItem(item) {
  const cta = getItemManualCta(item);
  if (!isManualCtaReady(cta)) return undefined;
  const sectionCount = Number(item.sectionCount || getCurrentSectionCount() || 5);
  const lastIndex = Math.max(0, sectionCount - 1);
  const position = Math.max(0, Math.min(lastIndex, Math.floor(sectionCount * 0.65)));
  return {
    [position]: {
      url: cta.url,
      text: cta.text || '자세히 보기',
      hook: cta.hook || '필요한 내용을 바로 확인하세요',
    },
  };
}

function validateQueueManualCtas(items) {
  const invalid = (items || []).filter(item => {
    const mode = item.mode || 'external';
    if (mode === 'adsense' || item.ctaMode !== 'manual') return false;
    return !isManualCtaReady(getItemManualCta(item));
  });
  if (invalid.length === 0) return true;

  const preview = invalid.slice(0, 5)
    .map(item => `- ${item.keyword || '(키워드 없음)'}`)
    .join('\n');
  const extra = invalid.length > 5 ? `\n...외 ${invalid.length - 5}개` : '';
  alert(`커스텀 CTA 링크가 비어 있거나 URL 형식이 아닙니다.\n\n${preview}${extra}\n\n수동 CTA를 쓰려면 각 항목에 https://로 시작하는 링크를 넣어주세요.`);
  return false;
}

function getCurrentSectionCount() {
  const direct = Number(getSelectValue('sectionCount') || getSelectValue('h2Count') || 0);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const radio = Number(document.querySelector('input[name="sectionCount"]:checked')?.value || 0);
  if (Number.isFinite(radio) && radio > 0) return radio;
  return 5;
}

function getCurrentQueueSnapshot() {
  const contentMode = getSelectValue('contentMode') || getSelectValue('scheduleContentMode') || 'external';
  const thumbnailMode = normalizeThumbEngine(getSelectValue('thumbnailType') || getSelectValue('scheduleThumbnailMode') || 'nanobanana2');
  const h2ImageSource = getCurrentH2ImageSource();
  const leonardoModel = document.getElementById('h2LeonardoModel')?.value
    || document.getElementById('thumbnailTypeLeonardoModel')?.value
    || document.getElementById('thumbnailLeonardoModel')?.value
    || 'seedream-4.5';
  const h2ImageMode = getCurrentH2ImageMode();
  const ctaMode = getCurrentCtaMode();
  const platform = getCurrentPublishPlatform();
  const postingMode = getCurrentPostingMode();
  const scheduleDate = getSelectValue('scheduleDateTime') || '';
  const urlImageSource = (document.getElementById('urlImageSource')?.value || '').trim();

  return {
    contentMode,
    thumbnailMode,
    h2ImageSource,
    leonardoModel,
    h2ImageMode,
    ctaMode,
    manualCta: ctaMode === 'manual' ? getCurrentManualQueueCta() : undefined,
    platform,
    postingMode,
    scheduleDate,
    sectionCount: getCurrentSectionCount(),
    titleMode: getSelectValue('titleMode') || 'auto',
    toneStyle: getSelectValue('toneStyle') || 'professional',
    factCheckMode: getSelectValue('factCheckMode') || 'auto',
    useKeywordAsTitle: !!document.getElementById('useKeywordAsTitle')?.checked,
    keywordFront: !!document.getElementById('keywordFront')?.checked,
    urlImageSource,
    urlAiCheck: !!document.getElementById('urlImageAiCheck')?.checked,
    urlAiFill: !!document.getElementById('urlImageAiFill')?.checked,
    urlThreshold: 60,
  };
}

function cloneQueueSnapshot(snapshot) {
  const snap = snapshot || {};
  return {
    contentMode: snap.contentMode || 'external',
    thumbnailMode: normalizeThumbEngine(snap.thumbnailMode || 'nanobanana2'),
    h2ImageSource: normalizeThumbEngine(snap.h2ImageSource || snap.thumbnailMode || 'nanobanana2'),
    leonardoModel: snap.leonardoModel || 'seedream-4.5',
    h2ImageMode: normalizeH2ImageMode(snap.h2ImageMode || 'all'),
    ctaMode: snap.ctaMode || 'auto',
    manualCta: normalizeManualCta(snap.manualCta),
    platform: normalizeQueuePlatform(snap.platform || 'blogspot'),
    postingMode: normalizePostingMode(snap.postingMode || 'publish'),
    scheduleDate: snap.scheduleDate || '',
    sectionCount: Number(snap.sectionCount || 5),
    titleMode: snap.titleMode || 'auto',
    toneStyle: snap.toneStyle || 'professional',
    factCheckMode: snap.factCheckMode || 'auto',
    useKeywordAsTitle: !!snap.useKeywordAsTitle,
    keywordFront: !!snap.keywordFront,
    urlImageSource: snap.urlImageSource || '',
    urlAiCheck: !!snap.urlAiCheck,
    urlAiFill: !!snap.urlAiFill,
    urlThreshold: Number(snap.urlThreshold) || 60,
  };
}

function snapshotFromItem(item) {
  return cloneQueueSnapshot({
    contentMode: item.mode,
    thumbnailMode: item.thumb,
    h2ImageSource: item.h2ImageSource,
    leonardoModel: item.leonardoModel,
    h2ImageMode: item.h2ImageMode,
    ctaMode: item.ctaMode,
    manualCta: getItemManualCta(item),
    platform: item.platform,
    postingMode: item.postingMode,
    scheduleDate: item.scheduleDate,
    sectionCount: item.sectionCount,
    titleMode: item.titleMode,
    toneStyle: item.toneStyle,
    factCheckMode: item.factCheckMode,
    useKeywordAsTitle: item.useKeywordAsTitle,
    keywordFront: item.keywordFront,
    urlImageSource: item.url,
    urlAiCheck: item.urlAiCheck,
    urlAiFill: item.urlAiFill,
    urlThreshold: item.urlThreshold,
  });
}

function touchItemSnapshot(item) {
  item.settingsSnapshot = snapshotFromItem(item);
  return item;
}

function applySnapshotToItem(item, snapshot, options = {}) {
  const snap = cloneQueueSnapshot(snapshot || item.settingsSnapshot || getCurrentQueueSnapshot());
  const force = options.force === true;
  if (force || !item.mode) item.mode = snap.contentMode;
  if (force || !item.thumb) item.thumb = normalizeThumbEngine(snap.thumbnailMode);
  else item.thumb = normalizeThumbEngine(item.thumb);
  if (force || !item.h2ImageSource) item.h2ImageSource = normalizeThumbEngine(snap.h2ImageSource || item.thumb);
  else item.h2ImageSource = normalizeThumbEngine(item.h2ImageSource || item.thumb);
  if (force || !item.leonardoModel) item.leonardoModel = snap.leonardoModel || 'seedream-4.5';
  if (force || !item.h2ImageMode) item.h2ImageMode = normalizeH2ImageMode(snap.h2ImageMode);
  else item.h2ImageMode = normalizeH2ImageMode(item.h2ImageMode);
  delete item.agentImageManaged;
  delete item.imageManagedBy;
  if (force || !item.ctaMode) item.ctaMode = snap.ctaMode;
  if (item.mode === 'adsense') item.ctaMode = 'none';
  if (force) item.manualCta = normalizeManualCta(snap.manualCta);
  else if (item.manualCta || item.customCta) item.manualCta = normalizeManualCta(item.manualCta || item.customCta);
  else if (item.ctaMode === 'manual') item.manualCta = normalizeManualCta(snap.manualCta || getCurrentManualQueueCta());
  if (force || !item.platform) item.platform = normalizeQueuePlatform(snap.platform);
  else item.platform = normalizeQueuePlatform(item.platform);
  if (force || !item.postingMode) item.postingMode = normalizePostingMode(snap.postingMode);
  else item.postingMode = normalizePostingMode(item.postingMode);
  if (force || !item.scheduleDate) item.scheduleDate = snap.scheduleDate || '';
  if (force || !item.sectionCount) item.sectionCount = snap.sectionCount;
  if (force || !item.titleMode) item.titleMode = snap.titleMode;
  if (force || !item.toneStyle) item.toneStyle = snap.toneStyle;
  if (force || !item.factCheckMode) item.factCheckMode = snap.factCheckMode;
  if (force || item.useKeywordAsTitle == null) item.useKeywordAsTitle = snap.useKeywordAsTitle;
  if (force || item.keywordFront == null) item.keywordFront = snap.keywordFront;
  if (force || item.url == null) item.url = snap.urlImageSource;
  if (force || item.urlAiCheck == null) item.urlAiCheck = snap.urlAiCheck;
  if (force || item.urlAiFill == null) item.urlAiFill = snap.urlAiFill;
  if (force || !item.urlThreshold) item.urlThreshold = snap.urlThreshold || 60;
  return touchItemSnapshot(item);
}

function buildSnapshotChips(snapshot) {
  const chips = [
    ['플랫폼', labelOf('platform', snapshot.platform)],
    ['발행', labelOf('postingMode', snapshot.postingMode)],
    ['모드', labelOf('contentMode', snapshot.contentMode)],
    ['썸네일', labelOf('thumb', snapshot.thumbnailMode)],
    ['소제목 이미지', labelOf('thumb', snapshot.h2ImageSource)],
    ['본문 배치', labelOf('h2ImageMode', snapshot.h2ImageMode)],
    ['CTA', labelOf('cta', snapshot.ctaMode)],
    ['섹션', `${snapshot.sectionCount}개`],
    ['팩트체크', snapshot.factCheckMode],
  ];
  if (snapshot.postingMode === 'schedule' && snapshot.scheduleDate) {
    chips.splice(2, 0, ['예약', snapshot.scheduleDate.replace('T', ' ')]);
  }
  return chips.map(([k, v]) => `
    <span class="pq-chip"><b>${escHtml(k)}</b>${escHtml(v)}</span>
  `).join('');
}

function buildModalHtml() {
  const snapshot = getCurrentQueueSnapshot();
  return `
<div id="publishQueueModal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.76); z-index: 10000; display: flex; align-items: flex-start; justify-content: center; padding: 18px 18px 40px; backdrop-filter: blur(10px); overflow-y: auto;">
  <style>
    #publishQueueModal * { box-sizing: border-box; letter-spacing: 0; }
    #publishQueueModal select,
    #publishQueueModal input,
    #publishQueueModal textarea {
      background: rgba(15,23,42,0.84);
      border: 1px solid rgba(148,163,184,0.28);
      color: #f8fafc;
      border-radius: 8px;
      outline: none;
    }
    #publishQueueModal select:focus,
    #publishQueueModal input:focus,
    #publishQueueModal textarea:focus {
      border-color: rgba(129,140,248,0.8);
      box-shadow: 0 0 0 3px rgba(99,102,241,0.18);
    }
    #publishQueueModal select option { background: #0f172a; color: #f8fafc; }
    .pq-shell {
      background: linear-gradient(135deg, #0f172a 0%, #172033 55%, #111827 100%);
      border: 1px solid rgba(129,140,248,0.34);
      border-radius: 18px;
      width: min(1860px, calc(100vw - 36px));
      min-height: min(760px, calc(100vh - 36px));
      display: flex;
      flex-direction: column;
      box-shadow: 0 30px 90px rgba(0,0,0,0.62);
      overflow: hidden;
    }
    .pq-head, .pq-toolbar, .pq-footer { padding-left: 28px; padding-right: 28px; }
    .pq-head {
      padding-top: 22px;
      padding-bottom: 16px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .pq-chipbar { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
    .pq-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 28px;
      padding: 6px 10px;
      border: 1px solid rgba(148,163,184,0.18);
      border-radius: 999px;
      background: rgba(15,23,42,0.58);
      color: rgba(226,232,240,0.86);
      font-size: 12px;
      white-space: nowrap;
    }
    .pq-chip b { color: #a5b4fc; font-weight: 800; }
    .pq-toolbar {
      padding-top: 14px;
      padding-bottom: 14px;
      background: rgba(30,41,59,0.48);
      border-bottom: 1px solid rgba(255,255,255,0.07);
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 14px;
      align-items: center;
    }
    .pq-bulk-controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; min-width: 0; }
    .pq-bulk-controls select,
    .pq-bulk-controls input[type="number"] { min-height: 34px; padding: 7px 10px; font-size: 12px; }
    .pq-body {
      flex: 0 0 auto;
      min-height: 0;
      overflow: visible;
      padding: 20px 28px 24px;
    }
    .pq-list-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 430px), 1fr));
      gap: 14px;
      align-items: stretch;
    }
    .pq-card {
      min-width: 0;
      padding: 16px;
      border-radius: 12px;
      border: 1px solid rgba(129,140,248,0.22);
      background: linear-gradient(180deg, rgba(30,41,59,0.78), rgba(15,23,42,0.78));
      box-shadow: 0 12px 30px rgba(0,0,0,0.18);
    }
    .pq-card.off { opacity: 0.58; filter: grayscale(0.45); }
    .pq-card-top { display: flex; gap: 10px; align-items: flex-start; }
    .pq-index {
      flex: 0 0 auto;
      width: 32px;
      height: 32px;
      display: grid;
      place-items: center;
      border-radius: 9px;
      background: rgba(99,102,241,0.18);
      color: #c4b5fd;
      font-size: 12px;
      font-weight: 900;
      border: 1px solid rgba(129,140,248,0.25);
    }
    .pq-keyword-input {
      width: 100%;
      min-height: 38px;
      padding: 9px 11px;
      color: #fff;
      font-size: 13px;
      font-weight: 800;
      line-height: 1.35;
    }
    .pq-url {
      margin-top: 8px;
      color: #86efac;
      font-size: 11px;
      line-height: 1.45;
      word-break: break-all;
    }
    .pq-card-fields {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-top: 14px;
    }
    .pq-field label {
      display: block;
      margin-bottom: 4px;
      color: rgba(203,213,225,0.68);
      font-size: 11px;
      font-weight: 800;
    }
    .pq-field select,
    .pq-field input[type="number"],
    .pq-field input[type="datetime-local"] {
      width: 100%;
      min-height: 34px;
      padding: 7px 9px;
      font-size: 12px;
      box-sizing: border-box;
    }
    .pq-cta-panel {
      margin-top: 12px;
      padding: 12px;
      border: 1px solid rgba(34,197,94,0.28);
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(20,83,45,0.28), rgba(15,23,42,0.66));
    }
    .pq-cta-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      color: #bbf7d0;
      font-size: 12px;
      font-weight: 900;
      margin-bottom: 10px;
    }
    .pq-cta-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(0, 0.85fr) minmax(0, 1fr);
      gap: 10px;
    }
    .pq-cta-panel input {
      width: 100%;
      min-height: 36px;
      padding: 8px 10px;
      font-size: 12px;
    }
    .pq-cta-panel .pq-field label { color: rgba(187,247,208,0.78); }
    .pq-card-meta { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px; }
    .pq-mini {
      display: inline-flex;
      padding: 5px 8px;
      border-radius: 999px;
      background: rgba(2,6,23,0.42);
      border: 1px solid rgba(148,163,184,0.16);
      color: rgba(226,232,240,0.82);
      font-size: 11px;
      line-height: 1.25;
    }
    .pq-footer {
      padding-top: 14px;
      padding-bottom: 16px;
      border-top: 1px solid rgba(255,255,255,0.09);
      background: rgba(2,6,23,0.35);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
    }
    .pq-btn {
      min-height: 40px;
      padding: 10px 16px;
      border-radius: 10px;
      border: none;
      color: white;
      font-size: 13px;
      font-weight: 900;
      cursor: pointer;
      white-space: nowrap;
    }
    @media (max-width: 820px) {
      #publishQueueModal { padding: 8px; }
      .pq-shell { width: calc(100vw - 16px); min-height: calc(100vh - 16px); border-radius: 14px; }
      .pq-head, .pq-toolbar, .pq-footer { padding-left: 16px; padding-right: 16px; }
      .pq-toolbar { grid-template-columns: 1fr; }
      .pq-body { padding-left: 16px; padding-right: 16px; }
      .pq-footer { flex-direction: column; align-items: stretch; }
      .pq-list-grid { grid-template-columns: 1fr; }
      .pq-cta-grid { grid-template-columns: 1fr; }
    }
  </style>
  <div class="pq-shell">

    <!-- 헤더 -->
    <div class="pq-head">
      <div>
        <h3 style="margin: 0; color: white; font-size: 22px; font-weight: 900;">연속발행 대기열</h3>
        <p style="margin: 5px 0 0; color: #c4b5fd; font-size: 12px;">대기열에서 항목별 세부 설정을 조정하고 바로 발행할 수 있습니다.</p>
        <div class="pq-chipbar" id="pq-current-settings">${buildSnapshotChips(snapshot)}</div>
      </div>
      <button onclick="window.__publishQueue && window.__publishQueue.close()" class="pq-btn" style="background: rgba(255,255,255,0.09); border: 1px solid rgba(255,255,255,0.18);">닫기</button>
    </div>

    <!-- 일괄 세팅 바 v3.8.117 — 사용자 요청 구조: 좌 (콘텐츠/이미지) + 우 (발행/간격) -->
    <div class="pq-toolbar" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px;padding:20px;">
      <!-- 좌측: 콘텐츠 + 이미지 -->
      <div style="display:flex;flex-direction:column;gap:18px;">
        <!-- 콘텐츠 섹션 -->
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid rgba(99,102,241,0.5);">
            <span style="font-size:14px;">📄</span>
            <strong style="color:#a5b4fc;font-size:13px;font-weight:900;">콘텐츠 관련</strong>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <label style="display:flex;flex-direction:column;gap:4px;">
              <span style="color:#cbd5e1;font-size:11px;font-weight:700;">콘텐츠 모드</span>
              <select id="pq-bulk-mode">
                <option value="">변경 안 함</option>
                <option value="external">🎯 SEO 외부링크</option>
                <option value="internal">📝 내부링크 일관</option>
                <option value="adsense">🏆 애드센스 승인</option>
                <option value="paraphrasing">🔄 페러프레이징</option>
              </select>
            </label>
          </div>
        </div>

        <!-- 이미지 섹션 -->
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid rgba(236,72,153,0.5);">
            <span style="font-size:14px;">🖼️</span>
            <strong style="color:#fbcfe8;font-size:13px;font-weight:900;">이미지 관련</strong>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <label style="display:flex;flex-direction:column;gap:4px;">
              <span style="color:#cbd5e1;font-size:11px;font-weight:700;">썸네일 엔진</span>
              <select id="pq-bulk-thumb">
                <option value="">변경 안 함</option>
                <option value="dropshot-nanobanana-pro">🍌 리더스 나노바나나 무제한</option>
                <option value="nanobanana2">🍌 Nano Banana 2 (권장)</option>
                <option value="nanobanana">🍌 Nano Banana</option>
                <option value="nanobananapro">🍌 Nano Banana Pro (Gemini 3)</option>
                <option value="gptimage1">🎯 GPT 이미지 1</option>
                <option value="gptimage2">🎯 GPT 이미지 2 / 덕트테이프</option>
                <option value="prodia">🚀 Prodia (유료 최저가)</option>
                <option value="deepinfra">🔥 DeepInfra</option>
                <option value="leonardo">🦁 Leonardo.ai</option>
                <option value="flow">🌊 Flow (Google AI Plus/Pro)</option>
                <option value="crawled">🔗 URL 수집 이미지</option>
                <option value="none">❌ 썸네일 없음</option>
              </select>
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;">
              <span style="color:#cbd5e1;font-size:11px;font-weight:700;">소제목 엔진</span>
              <select id="pq-bulk-h2">
                <option value="">변경 안 함</option>
                <option value="same">썸네일과 동일하게</option>
                <option value="dropshot-nanobanana-pro">🍌 리더스 나노바나나 무제한</option>
                <option value="nanobanana2">🍌 Nano Banana 2</option>
                <option value="nanobanana">🍌 Nano Banana</option>
                <option value="nanobananapro">🍌 Nano Banana Pro</option>
                <option value="gptimage1">🎯 GPT 이미지 1</option>
                <option value="gptimage2">🎯 GPT 이미지 2 / 덕트테이프</option>
                <option value="prodia">🚀 Prodia</option>
                <option value="deepinfra">🔥 DeepInfra</option>
                <option value="leonardo">🦁 Leonardo.ai</option>
                <option value="flow">🌊 Flow (Google AI Plus/Pro)</option>
                <option value="crawled">🔗 URL 수집 이미지</option>
                <option value="none">❌ 이미지 없음</option>
              </select>
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;">
              <span style="color:#cbd5e1;font-size:11px;font-weight:700;">썸네일·소제목 이미지 갯수 세팅</span>
              <select id="pq-bulk-h2-mode">
                <option value="">변경 안 함</option>
                <option value="all">전체 (썸네일 + 모든 소제목)</option>
                <option value="odd">홀수 번째 소제목만</option>
                <option value="even">짝수 번째 소제목만</option>
                <option value="thumbnail-only">썸네일만 (소제목 X)</option>
                <option value="none">이미지 없음</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <!-- 우측: 발행 -->
      <div style="display:flex;flex-direction:column;gap:18px;">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid rgba(52,211,153,0.5);">
            <span style="font-size:14px;">📤</span>
            <strong style="color:#a7f3d0;font-size:13px;font-weight:900;">발행 관련</strong>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <label style="display:flex;flex-direction:column;gap:4px;">
              <span style="color:#cbd5e1;font-size:11px;font-weight:700;">제목 옵션</span>
              <select id="pq-bulk-title">
                <option value="">변경 안 함</option>
                <option value="auto">AI 제목 생성</option>
                <option value="keyword">키워드를 제목으로</option>
                <option value="front">키워드 앞 배치</option>
                <option value="keyword-front">키워드 제목 + 앞 배치</option>
              </select>
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;">
              <span style="color:#cbd5e1;font-size:11px;font-weight:700;">발행 방식</span>
              <select id="pq-bulk-posting">
                <option value="">변경 안 함</option>
                <option value="publish">즉시 발행</option>
                <option value="draft">임시 발행</option>
                <option value="schedule">예약 발행</option>
              </select>
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;">
              <span style="color:#cbd5e1;font-size:11px;font-weight:700;">톤</span>
              <select id="pq-bulk-tone">
                <option value="">변경 안 함</option>
                <option value="professional">전문적</option>
                <option value="friendly">친근한</option>
                <option value="casual">캐주얼</option>
                <option value="formal">격식있는</option>
                <option value="conversational">대화체</option>
              </select>
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;">
              <span style="color:#cbd5e1;font-size:11px;font-weight:700;">팩트체크</span>
              <select id="pq-bulk-fact">
                <option value="">변경 안 함</option>
                <option value="auto">자동</option>
                <option value="naver">네이버</option>
                <option value="perplexity">Perplexity</option>
                <option value="grounding">Gemini Grounding</option>
                <option value="off">끄기</option>
              </select>
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;">
              <span style="color:#cbd5e1;font-size:11px;font-weight:700;">발행 간격 (여러 키워드 시)</span>
              <div style="display:flex;gap:6px;align-items:center;">
                <select id="pq-interval-mode" style="flex:1;">
                  <option value="minutes" selected>분 단위</option>
                  <option value="hours">시간 단위 (스케줄용)</option>
                  <option value="random">4-8h 무작위 분산</option>
                </select>
                <div id="pq-interval-fixed" style="display:flex;align-items:center;gap:6px;">
                  <input type="number" id="pq-interval-value" min="7" max="1440" value="7" step="1" inputmode="numeric" style="width:72px;min-height:32px;padding:6px 8px;background:rgba(15,23,42,0.72);color:white;border:1px solid rgba(148,163,184,0.24);border-radius:8px;font-size:13px;font-weight:900;text-align:center;">
                  <span id="pq-interval-unit" style="color:rgba(255,255,255,0.7);font-size:12px;">분</span>
                </div>
              </div>
              <span id="pq-interval-guard-hint" style="color:#bfdbfe;font-size:11px;font-weight:600;display:block;margin-top:2px;"></span>
            </label>
          </div>
        </div>

        <!-- 액션 버튼 -->
        <div style="display:flex;gap:8px;margin-top:auto;padding-top:12px;border-top:1px solid rgba(148,163,184,0.18);">
          <button id="pq-bulk-apply" class="pq-btn" style="flex:1;min-height:38px;padding:8px 14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);font-size:13px;font-weight:900;">⚡ 일괄 적용</button>
          <button id="pq-sync-current" class="pq-btn" style="flex:1;min-height:38px;padding:8px 14px;background:rgba(14,165,233,0.16);border:1px solid rgba(56,189,248,0.36);color:#bae6fd;font-size:12px;font-weight:700;" title="현재 상세설정 값을 모든 대기열 항목에 다시 반영">🔄 현재 상세설정 반영</button>
        </div>
      </div>

      <!-- v3.8.117 제거됨: 섹션 수(자동), 플랫폼(환경설정), CTA, 본문 배치(이미지 갯수 세팅으로 통합) -->
      <!-- hidden compatibility 더미: legacy 코드가 이 ID들을 .value 접근하면 빈 값 반환 -->
      <select id="pq-bulk-cta" style="display:none;"><option value=""></option></select>
      <select id="pq-bulk-platform" style="display:none;"><option value=""></option></select>
      <select id="pq-bulk-section" style="display:none;"><option value=""></option></select>
    </div>

    <!-- 큐 리스트 -->
    <div id="pq-list" class="pq-body">
      <!-- runtime 채워짐 -->
    </div>

    <!-- 푸터 (액션 버튼) -->
    <div class="pq-footer">
      <div style="color: rgba(255,255,255,0.6); font-size: 12px;">
        즉시 순차발행은 한 글이 완전히 끝난 뒤 다음 글을 시작합니다. 리더스 무제한 이미지는 항상 1개씩만 생성됩니다.
      </div>
      <div style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end;">
        <button id="pq-action-clear" class="pq-btn" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #fca5a5;">큐 비우기</button>
        <button id="pq-action-schedule" class="pq-btn" style="background: linear-gradient(135deg,#f59e0b,#d97706);">스케줄에 추가</button>
        <button id="pq-action-publish" class="pq-btn" style="background: linear-gradient(135deg,#22c55e,#16a34a);">즉시 순차 발행</button>
      </div>
    </div>
  </div>
</div>
  `;
}

function buildItemRow(item, idx) {
  applySnapshotToItem(item);
  const itemSourceUrl = item.contentUrl || item.sourceUrl || '';
  const sourceHint = itemSourceUrl
    ? `<div class="pq-url">URL: ${escHtml(itemSourceUrl)}</div>`
    : '';
  const manualCta = getItemManualCta(item);
  const manualCtaPanel = item.ctaMode === 'manual' && item.mode !== 'adsense'
    ? `
  <div class="pq-cta-panel">
    <div class="pq-cta-head">
      <span>커스텀 CTA</span>
      <span style="color:rgba(187,247,208,0.72); font-weight:800;">후반 핵심 섹션에 자동 배치</span>
    </div>
    <div class="pq-cta-grid">
      <div class="pq-field">
        <label>링크 URL</label>
        <input type="url" class="pq-item-cta-url" placeholder="https://example.com" value="${escHtml(manualCta.url)}">
      </div>
      <div class="pq-field">
        <label>버튼 문구</label>
        <input type="text" class="pq-item-cta-text" placeholder="자세히 보기" value="${escHtml(manualCta.text)}">
      </div>
      <div class="pq-field">
        <label>후킹 멘트</label>
        <input type="text" class="pq-item-cta-hook" placeholder="필요한 내용을 바로 확인하세요" value="${escHtml(manualCta.hook)}">
      </div>
    </div>
  </div>`
    : '';
  const disabledClass = item.enabled ? '' : ' off';
  const platform = normalizeQueuePlatform(item.platform);
  const postingMode = normalizePostingMode(item.postingMode);
  const scheduleValue = toQueueScheduleInputValue(item.scheduleDate);
  const sectionCount = normalizeSectionCount(item.sectionCount || 5);
  const titleOption = getTitleOptionFromItem(item);
  return `
<div data-pq-item-id="${item.id}" class="pq-card${disabledClass}">
  <div class="pq-card-top">
    <div class="pq-index">${idx + 1}</div>
    <div style="flex:1; min-width:0;">
      <input type="text" class="pq-item-keyword pq-keyword-input" value="${escHtml(item.keyword)}">
      ${sourceHint}
    </div>
    <label title="발행 포함" style="flex:0 0 auto; display:flex; align-items:center; gap:6px; color:#cbd5e1; font-size:12px; font-weight:800;">
      <input type="checkbox" class="pq-item-enabled" ${item.enabled ? 'checked' : ''} style="accent-color: #6366f1; width: 18px; height: 18px;">
    </label>
    <button class="pq-item-remove" title="삭제" style="flex:0 0 auto; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; border-radius: 8px; width: 32px; height: 32px; cursor: pointer; font-size: 16px;">×</button>
  </div>
  <div class="pq-card-fields">
    <div class="pq-field">
      <label>콘텐츠 모드</label>
      <select class="pq-item-mode">
        <option value="external" ${item.mode === 'external' ? 'selected' : ''}>SEO 외부</option>
        <option value="internal" ${item.mode === 'internal' ? 'selected' : ''}>내부링크</option>
        <option value="adsense" ${item.mode === 'adsense' ? 'selected' : ''}>애드센스</option>
        <option value="paraphrasing" ${item.mode === 'paraphrasing' ? 'selected' : ''}>페러프레이징</option>
      </select>
    </div>
    <div class="pq-field">
      <label>썸네일</label>
      <select class="pq-item-thumb">
        <option value="dropshot-nanobanana-pro" ${item.thumb === 'dropshot-nanobanana-pro' ? 'selected' : ''}>리더스 무제한</option>
        <option value="nanobanana2" ${(!item.thumb || item.thumb === 'nanobanana2') ? 'selected' : ''}>Nano Banana 2</option>
        <option value="nanobanana" ${item.thumb === 'nanobanana' ? 'selected' : ''}>Nano Banana</option>
        <option value="nanobananapro" ${item.thumb === 'nanobananapro' ? 'selected' : ''}>Nano Banana Pro</option>
        <option value="gptimage1" ${item.thumb === 'gptimage1' ? 'selected' : ''}>GPT 이미지 1</option>
        <option value="gptimage2" ${item.thumb === 'gptimage2' || item.thumb === 'dalle' ? 'selected' : ''}>GPT 이미지 2</option>
        <option value="prodia" ${item.thumb === 'prodia' ? 'selected' : ''}>Prodia</option>
        <option value="deepinfra" ${item.thumb === 'deepinfra' ? 'selected' : ''}>DeepInfra</option>
        <option value="leonardo" ${item.thumb === 'leonardo' ? 'selected' : ''}>Leonardo.ai</option>
        <option value="flow" ${(item.thumb === 'flow' || item.thumb === 'imagefx') ? 'selected' : ''}>Flow</option>
        <option value="crawled" ${item.thumb === 'crawled' ? 'selected' : ''}>URL 수집</option>
        <option value="none" ${item.thumb === 'none' ? 'selected' : ''}>없음</option>
      </select>
    </div>
    <div class="pq-field">
      <label>소제목 이미지</label>
      <select class="pq-item-h2">
        <option value="dropshot-nanobanana-pro" ${item.h2ImageSource === 'dropshot-nanobanana-pro' ? 'selected' : ''}>리더스 무제한</option>
        <option value="nanobanana2" ${(!item.h2ImageSource || item.h2ImageSource === 'nanobanana2') ? 'selected' : ''}>Nano Banana 2</option>
        <option value="nanobanana" ${item.h2ImageSource === 'nanobanana' ? 'selected' : ''}>Nano Banana</option>
        <option value="nanobananapro" ${item.h2ImageSource === 'nanobananapro' ? 'selected' : ''}>Nano Banana Pro</option>
        <option value="gptimage1" ${item.h2ImageSource === 'gptimage1' ? 'selected' : ''}>GPT 이미지 1</option>
        <option value="gptimage2" ${item.h2ImageSource === 'gptimage2' || item.h2ImageSource === 'dalle' ? 'selected' : ''}>GPT 이미지 2</option>
        <option value="prodia" ${item.h2ImageSource === 'prodia' ? 'selected' : ''}>Prodia</option>
        <option value="deepinfra" ${item.h2ImageSource === 'deepinfra' ? 'selected' : ''}>DeepInfra</option>
        <option value="leonardo" ${item.h2ImageSource === 'leonardo' ? 'selected' : ''}>Leonardo.ai</option>
        <option value="flow" ${(item.h2ImageSource === 'flow' || item.h2ImageSource === 'imagefx') ? 'selected' : ''}>Flow</option>
        <option value="crawled" ${item.h2ImageSource === 'crawled' ? 'selected' : ''}>URL 수집</option>
        <option value="none" ${item.h2ImageSource === 'none' ? 'selected' : ''}>없음</option>
      </select>
    </div>
    <div class="pq-field">
      <label>본문 이미지 배치</label>
      <select class="pq-item-h2-mode">
        <option value="all" ${(!item.h2ImageMode || item.h2ImageMode === 'all') ? 'selected' : ''}>전체</option>
        <option value="odd" ${item.h2ImageMode === 'odd' ? 'selected' : ''}>홀수만</option>
        <option value="even" ${item.h2ImageMode === 'even' ? 'selected' : ''}>짝수만</option>
        <option value="thumbnail-only" ${item.h2ImageMode === 'thumbnail-only' ? 'selected' : ''}>썸네일만</option>
        <option value="none" ${item.h2ImageMode === 'none' ? 'selected' : ''}>이미지 없음</option>
      </select>
    </div>
    <div class="pq-field">
      <label>CTA</label>
      <select class="pq-item-cta">
        <option value="auto" ${item.ctaMode === 'auto' ? 'selected' : ''}>자동</option>
        <option value="manual" ${item.ctaMode === 'manual' ? 'selected' : ''}>수동</option>
        <option value="none" ${item.ctaMode === 'none' ? 'selected' : ''}>없음</option>
      </select>
    </div>
    <div class="pq-field">
      <label>플랫폼</label>
      <select class="pq-item-platform">
        <option value="blogspot" ${platform === 'blogspot' ? 'selected' : ''}>Blogspot</option>
        <option value="wordpress" ${platform === 'wordpress' ? 'selected' : ''}>WordPress</option>
        <option value="tistory" ${platform === 'tistory' ? 'selected' : ''}>Tistory</option>
      </select>
    </div>
    <div class="pq-field">
      <label>발행 방식</label>
      <select class="pq-item-posting">
        <option value="publish" ${postingMode === 'publish' ? 'selected' : ''}>즉시 발행</option>
        <option value="draft" ${postingMode === 'draft' ? 'selected' : ''}>임시 발행</option>
        <option value="schedule" ${postingMode === 'schedule' ? 'selected' : ''}>예약 발행</option>
      </select>
    </div>
    <div class="pq-field">
      <label>예약 시간</label>
      <input type="datetime-local" class="pq-item-schedule" value="${escHtml(scheduleValue)}">
    </div>
    <div class="pq-field">
      <label>섹션 수</label>
      <input type="number" class="pq-item-section-count" min="3" max="12" step="1" value="${escHtml(sectionCount)}">
    </div>
    <div class="pq-field">
      <label>제목 옵션</label>
      <select class="pq-item-title-option">
        <option value="auto" ${titleOption === 'auto' ? 'selected' : ''}>AI 제목 생성</option>
        <option value="keyword" ${titleOption === 'keyword' ? 'selected' : ''}>키워드를 제목으로</option>
        <option value="front" ${titleOption === 'front' ? 'selected' : ''}>키워드 앞 배치</option>
        <option value="keyword-front" ${titleOption === 'keyword-front' ? 'selected' : ''}>키워드 제목 + 앞 배치</option>
      </select>
    </div>
    <div class="pq-field">
      <label>톤</label>
      <select class="pq-item-tone">
        <option value="professional" ${item.toneStyle === 'professional' ? 'selected' : ''}>전문적</option>
        <option value="friendly" ${item.toneStyle === 'friendly' ? 'selected' : ''}>친근한</option>
        <option value="casual" ${item.toneStyle === 'casual' ? 'selected' : ''}>캐주얼</option>
        <option value="formal" ${item.toneStyle === 'formal' ? 'selected' : ''}>격식있는</option>
        <option value="conversational" ${item.toneStyle === 'conversational' ? 'selected' : ''}>대화체</option>
      </select>
    </div>
    <div class="pq-field">
      <label>팩트체크</label>
      <select class="pq-item-fact">
        <option value="auto" ${(!item.factCheckMode || item.factCheckMode === 'auto') ? 'selected' : ''}>자동</option>
        <option value="naver" ${item.factCheckMode === 'naver' ? 'selected' : ''}>네이버</option>
        <option value="perplexity" ${item.factCheckMode === 'perplexity' ? 'selected' : ''}>Perplexity</option>
        <option value="grounding" ${item.factCheckMode === 'grounding' ? 'selected' : ''}>Gemini Grounding</option>
        <option value="off" ${item.factCheckMode === 'off' ? 'selected' : ''}>끄기</option>
      </select>
    </div>
  </div>
  ${manualCtaPanel}
  <div class="pq-card-meta">
    <span class="pq-mini">${escHtml(labelOf('platform', item.platform))}</span>
    <span class="pq-mini">${escHtml(labelOf('postingMode', item.postingMode))}${item.postingMode === 'schedule' && item.scheduleDate ? ` · ${escHtml(item.scheduleDate.replace('T', ' '))}` : ''}</span>
    <span class="pq-mini">섹션 ${escHtml(item.sectionCount)}개</span>
    <span class="pq-mini">본문 배치 ${escHtml(labelOf('h2ImageMode', item.h2ImageMode))}</span>
    <span class="pq-mini">팩트체크 ${escHtml(item.factCheckMode)}</span>
    <span class="pq-mini">제목 ${escHtml(item.titleMode)}</span>
    <span class="pq-mini">톤 ${escHtml(item.toneStyle)}</span>
    ${item.url ? '<span class="pq-mini">URL 이미지 연동</span>' : ''}
    ${item.ctaMode === 'manual' && manualCta.url ? `<span class="pq-mini">커스텀 CTA ${escHtml(hostFromUrl(manualCta.url))}</span>` : ''}
  </div>
</div>
  `;
}

function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ════════════════════════════════════════════
// 모달 동작
// ════════════════════════════════════════════
function refreshList() {
  const listEl = document.getElementById('pq-list');
  if (!listEl) return;
  if (STATE.keywords.length === 0) {
    listEl.innerHTML = '<div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.4);">대기열이 비어있습니다. 키워드 입력란에 줄바꿈으로 여러 개 입력하세요.</div>';
    return;
  }
  const enabledCount = STATE.keywords.filter(k => k.enabled).length;
  const header = `
<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;color:rgba(226,232,240,0.82);font-size:12px;">
  <div style="font-weight:900;">총 ${STATE.keywords.length}개 · 활성 ${enabledCount}개</div>
  <div style="color:rgba(148,163,184,0.82);">모달 전체가 넓게 스크롤됩니다. 100개 이상도 가로 드래그 없이 확인할 수 있습니다.</div>
</div>`;
  listEl.innerHTML = `${header}<div class="pq-list-grid">${STATE.keywords.map((it, i) => buildItemRow(it, i)).join('')}</div>`;
  bindItemEvents();
  try { window.applyAgentImageSettingsVisibility?.(document.getElementById('publishQueueModal') || document); } catch {}
  updateIntervalGuardHint();
}

function bindItemEvents() {
  document.querySelectorAll('[data-pq-item-id]').forEach(row => {
    const id = row.getAttribute('data-pq-item-id');
    const item = STATE.keywords.find(k => k.id === id);
    if (!item) return;
    const saveItem = () => {
      touchItemSnapshot(item);
      persistQueue();
      syncBadge();
      updateIntervalGuardHint();
    };
    row.querySelector('.pq-item-enabled')?.addEventListener('change', e => { item.enabled = e.target.checked; saveItem(); refreshList(); });
    row.querySelector('.pq-item-keyword')?.addEventListener('input', e => { item.keyword = e.target.value; saveItem(); });
    row.querySelector('.pq-item-mode')?.addEventListener('change', e => {
      item.mode = e.target.value;
      if (item.mode === 'adsense') item.ctaMode = 'none';
      if (item.ctaMode === 'manual') ensureItemManualCta(item);
      saveItem();
      refreshList();
    });
    row.querySelector('.pq-item-thumb')?.addEventListener('change', e => { item.thumb = normalizeThumbEngine(e.target.value); saveItem(); });
    row.querySelector('.pq-item-h2')?.addEventListener('change', e => { item.h2ImageSource = normalizeThumbEngine(e.target.value); saveItem(); });
    row.querySelector('.pq-item-h2-mode')?.addEventListener('change', e => { item.h2ImageMode = normalizeH2ImageMode(e.target.value); saveItem(); refreshList(); });
    row.querySelector('.pq-item-cta')?.addEventListener('change', e => {
      item.ctaMode = e.target.value;
      if (item.mode === 'adsense') item.ctaMode = 'none';
      if (item.ctaMode === 'manual') ensureItemManualCta(item);
      saveItem();
      refreshList();
    });
    row.querySelector('.pq-item-platform')?.addEventListener('change', e => {
      item.platform = normalizeQueuePlatform(e.target.value);
      saveItem();
      refreshList();
    });
    row.querySelector('.pq-item-posting')?.addEventListener('change', e => {
      item.postingMode = normalizePostingMode(e.target.value);
      saveItem();
      refreshList();
    });
    row.querySelector('.pq-item-schedule')?.addEventListener('change', e => {
      item.scheduleDate = e.target.value || '';
      saveItem();
      refreshList();
    });
    row.querySelector('.pq-item-section-count')?.addEventListener('change', e => {
      item.sectionCount = normalizeSectionCount(e.target.value);
      saveItem();
      refreshList();
    });
    row.querySelector('.pq-item-title-option')?.addEventListener('change', e => {
      applyTitleOptionToItem(item, e.target.value);
      saveItem();
      refreshList();
    });
    row.querySelector('.pq-item-tone')?.addEventListener('change', e => {
      item.toneStyle = e.target.value || 'professional';
      saveItem();
    });
    row.querySelector('.pq-item-fact')?.addEventListener('change', e => {
      item.factCheckMode = e.target.value || 'auto';
      saveItem();
      refreshList();
    });
    const saveManualCta = () => {
      item.manualCta = normalizeManualCta({
        url: row.querySelector('.pq-item-cta-url')?.value || '',
        text: row.querySelector('.pq-item-cta-text')?.value || '',
        hook: row.querySelector('.pq-item-cta-hook')?.value || '',
      });
      saveItem();
    };
    row.querySelector('.pq-item-cta-url')?.addEventListener('input', saveManualCta);
    row.querySelector('.pq-item-cta-text')?.addEventListener('input', saveManualCta);
    row.querySelector('.pq-item-cta-hook')?.addEventListener('input', saveManualCta);
    row.querySelector('.pq-item-remove')?.addEventListener('click', () => {
      STATE.keywords = STATE.keywords.filter(k => k.id !== id);
      persistQueue();
      refreshList();
      syncBadge();
    });
  });
}

/** 현재 UI 설정에서 사용자가 지정한 발행 간격(ms) 계산 — 'random' 모드면 4-8h 사이 무작위 */
function getRawIntervalMs() {
  const stored = readQueueIntervalSetting();
  const mode = document.getElementById('pq-interval-mode')?.value || stored.mode;
  const value = document.getElementById('pq-interval-value')?.value || stored.value;
  if (mode === 'random') return (4 + Math.random() * 4) * 3600 * 1000;
  if (mode === 'hours') return clampIntervalValue('hours', value) * 3600 * 1000;
  return clampIntervalValue('minutes', value) * 60 * 1000;
}

/** 이미지 엔진별 최소 발행 간격을 반영한 실제 대기 시간 */
function getIntervalMs(options = {}) {
  const raw = getRawIntervalMs();
  const minMs = Number(options.minMs || 0);
  return Math.max(raw, minMs);
}

function formatIntervalMs(ms) {
  if (ms >= 3600_000) return `${(ms / 3600_000).toFixed(1)}시간`;
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}분`;
  return `${(ms / 1000).toFixed(0)}초`;
}

function normalizeQueuePlatform(platform) {
  const raw = String(platform || '').toLowerCase();
  if (/wordpress|wp|워드프레스/.test(raw)) return 'wordpress';
  if (/blogger|blogspot|블로거|블로그스팟/.test(raw)) return 'blogspot';
  return raw || 'blogspot';
}

function getCurrentPublishPlatform() {
  const radioValue = document.querySelector('input[name="platform"]:checked')?.value || '';
  const scheduleValue = document.getElementById('schedulePlatform')?.value || '';
  return normalizeQueuePlatform(radioValue || scheduleValue || 'blogspot');
}

function normalizePostingMode(mode) {
  const raw = String(mode || '').toLowerCase();
  if (raw === 'immediate' || raw === 'now' || raw === 'live' || raw === 'single') return 'publish';
  if (raw === 'scheduled') return 'schedule';
  if (raw === 'draft' || raw === 'save') return 'draft';
  if (raw === 'schedule') return 'schedule';
  return 'publish';
}

function getCurrentPostingMode() {
  return normalizePostingMode(document.querySelector('input[name="postingMode"]:checked')?.value || 'publish');
}

function toLocalDateTimeInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toQueueScheduleInputValue(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return toLocalDateTimeInputValue(parsed);
  return String(value).slice(0, 16);
}

function normalizeSectionCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 5;
  return Math.max(3, Math.min(12, Math.round(n)));
}

function getTitleOptionFromItem(item) {
  if (item?.useKeywordAsTitle && item?.keywordFront) return 'keyword-front';
  if (item?.useKeywordAsTitle) return 'keyword';
  if (item?.keywordFront) return 'front';
  return 'auto';
}

function applyTitleOptionToItem(item, value) {
  const option = String(value || 'auto');
  item.titleMode = 'auto';
  item.useKeywordAsTitle = option === 'keyword' || option === 'keyword-front';
  item.keywordFront = option === 'front' || option === 'keyword-front';
}

function getScheduleBaseDate() {
  const value = document.getElementById('scheduleDateTime')?.value || '';
  const parsed = value ? new Date(value) : null;
  if (parsed && !Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now()) return parsed;
  return new Date(Date.now() + 60 * 60 * 1000);
}

function hydrateIntervalControlsFromStorage() {
  const setting = readQueueIntervalSetting();
  const modeEl = document.getElementById('pq-interval-mode');
  const valueEl = document.getElementById('pq-interval-value');
  if (modeEl) modeEl.value = setting.mode;
  if (valueEl) valueEl.value = String(setting.value);
}

/** 간격 모드 변경 시 숫자 입력 범위/단위 라벨 동기화 */
function syncIntervalControl(options = {}) {
  const mode = normalizeIntervalMode(document.getElementById('pq-interval-mode')?.value || 'minutes');
  const valueInput = document.getElementById('pq-interval-value');
  const unit = document.getElementById('pq-interval-unit');
  const fixedWrap = document.getElementById('pq-interval-fixed');
  if (!valueInput || !unit || !fixedWrap) return;

  if (mode === 'random') {
    fixedWrap.style.display = 'none';
    if (options.persist !== false) persistQueueInterval('random', PUBLISH_QUEUE_MIN_MINUTES);
    updateIntervalGuardHint();
    return;
  }
  fixedWrap.style.display = 'flex';

  if (mode === 'minutes') {
    valueInput.min = String(PUBLISH_QUEUE_MIN_MINUTES);
    valueInput.max = '1440';
    valueInput.step = '1';
    valueInput.value = String(clampIntervalValue('minutes', valueInput.value));
    unit.textContent = '분';
  } else {
    valueInput.min = '1';
    valueInput.max = '72';
    valueInput.step = '1';
    valueInput.value = String(clampIntervalValue('hours', valueInput.value));
    unit.textContent = '시간';
  }

  if (options.persist !== false) persistQueueInterval(mode, valueInput.value);
  updateIntervalGuardHint();
}

function updateIntervalGuardHint(items) {
  const hint = document.getElementById('pq-interval-guard-hint');
  if (!hint) return;
  const list = items || STATE.keywords || [];
  const minMs = getQueueMinPublishIntervalMs(list);
  const rawMs = getRawIntervalMs();
  const corrected = rawMs < minMs;
  hint.textContent = corrected
    ? `${getQueueIntervalReason(list)} · ${formatIntervalMs(minMs)} 이상만 설정 가능`
    : `${getQueueIntervalReason(list)} · 현재 간격 안전`;
}

function getDefaultH2Sections() {
  const checked = Array.from(document.querySelectorAll('input[name="h2ImageSections"]:checked,input[name="h2Sections"]:checked'))
    .map(el => Number(el.value))
    .filter(n => Number.isFinite(n) && n > 0);
  if (checked.length > 0) return checked;
  return [2, 3, 4];
}

function buildQueuePayloadOverrides(item, scheduleDateIso) {
  applySnapshotToItem(item, item.settingsSnapshot || undefined);
  const sourceUrl = item.contentUrl || item.sourceUrl || '';
  const h2Sections = getDefaultH2Sections();
  const h2ImageMode = normalizeH2ImageMode(item.h2ImageMode || 'all');
  const postingMode = normalizePostingMode(item.postingMode || getCurrentPostingMode());
  const contentMode = item.mode || 'external';
  const isAdsense = contentMode === 'adsense';
  const manualCtas = !isAdsense && item.ctaMode === 'manual'
    ? buildManualCtasForItem(item)
    : undefined;
  return {
    topic: item.keyword,
    title: item.keyword,
    keywords: [{ keyword: item.keyword, title: item.keyword }],
    platform: normalizeQueuePlatform(item.platform || getCurrentPublishPlatform()),
    targetPlatform: normalizeQueuePlatform(item.platform || getCurrentPublishPlatform()),
    contentMode,
    thumbnailMode: normalizeThumbEngine(item.thumb),
    thumbnailType: normalizeThumbEngine(item.thumb),
    thumbnailSource: normalizeThumbEngine(item.thumb),
    h2ImageSource: normalizeThumbEngine(item.h2ImageSource || item.thumb),
    leonardoModel: item.leonardoModel || 'seedream-4.5',
    h2ImageMode,
    h2ImageSections: h2Sections,
    h2Images: { source: normalizeThumbEngine(item.h2ImageSource || item.thumb), sections: h2Sections, mode: h2ImageMode, leonardoModel: item.leonardoModel || 'seedream-4.5' },
    skipImages: h2ImageMode === 'none',
    ctaMode: isAdsense ? 'none' : (item.ctaMode || 'auto'),
    manualCtas,
    publishType: postingMode,
    postingMode,
    scheduleDate: postingMode === 'schedule' ? scheduleDateIso : undefined,
    sectionCount: Number(item.sectionCount || getCurrentSectionCount()),
    titleMode: item.titleMode || 'auto',
    toneStyle: item.toneStyle || 'professional',
    factCheckMode: item.factCheckMode || 'auto',
    useKeywordAsTitle: !!item.useKeywordAsTitle,
    keywordFront: !!item.keywordFront,
    sourceUrl: sourceUrl || undefined,
    contentUrl: sourceUrl || undefined,
    manualCrawlUrls: sourceUrl ? [sourceUrl] : undefined,
    urlImageSource: item.url ? {
      url: item.url,
      aiCheckEnabled: !!item.urlAiCheck,
      aiFillEnabled: !!item.urlAiFill,
      threshold: Number(item.urlThreshold) || 60,
    } : undefined,
    adsenseScoreGate: isAdsense ? true : undefined,
    adsenseMinScore: isAdsense ? 78 : undefined,
    adsensePolicyScan: isAdsense ? true : undefined,
    adsenseHardeningScan: isAdsense ? true : undefined,
    adsenseGateMode: isAdsense ? 'warn' : undefined,
    fromQueue: true,
  };
}

function applyItemToMainForm(item, scheduleDateIso) {
  const setValue = (id, value) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value || '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const setRadio = (name, value) => {
    const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (!radio) return;
    radio.checked = true;
    radio.dispatchEvent(new Event('change', { bubbles: true }));
  };

  setValue('keywordInput', item.keyword);
  setValue('contentMode', item.mode || 'external');
  setValue('thumbnailType', normalizeThumbEngine(item.thumb));
  setValue('h2ImageSource', normalizeThumbEngine(item.h2ImageSource || item.thumb));
  setValue('h2ImageMode', normalizeH2ImageMode(item.h2ImageMode || 'all'));
  setRadio('ctaMode', item.ctaMode || 'auto');
  if (item.ctaMode === 'manual') {
    const cta = getItemManualCta(item);
    try {
      if (typeof getAppState === 'function') {
        getAppState().manualCtasData = cta.url
          ? [{ url: cta.url, title: cta.text || '자세히 보기', hook: cta.hook || '' }]
          : [];
      }
    } catch (e) {
      console.warn('[QUEUE] manual CTA form sync failed:', e);
    }
  }
  setRadio('platform', item.platform === 'blogspot' ? 'blogger' : item.platform);
  setRadio('postingMode', item.postingMode === 'publish' ? 'immediate' : item.postingMode);
  if (item.postingMode === 'schedule' && scheduleDateIso) {
    setValue('scheduleDateTime', toLocalDateTimeInputValue(new Date(scheduleDateIso)));
  }
}

function createQueueRunModal(items, intervalLabel) {
  const existing = document.getElementById('pqRunModal');
  if (existing) existing.remove();

  const cards = items.map((item, index) => `
    <div class="pqr-card" data-pqr-index="${index}">
      <div class="pqr-card-no">${index + 1}</div>
      <div class="pqr-card-body">
        <div class="pqr-title">${escHtml(item.keyword)}</div>
        <div class="pqr-meta">${escHtml(labelOf('contentMode', item.mode))} · 썸네일 ${escHtml(labelOf('thumb', item.thumb))} · 본문 ${escHtml(labelOf('thumb', item.h2ImageSource || item.thumb))} · 배치 ${escHtml(labelOf('h2ImageMode', item.h2ImageMode))} · CTA ${escHtml(labelOf('cta', item.ctaMode))} · ${escHtml(labelOf('postingMode', item.postingMode))}</div>
        ${(item.contentUrl || item.sourceUrl) ? `<div class="pqr-url">${escHtml(item.contentUrl || item.sourceUrl)}</div>` : ''}
      </div>
      <span class="pqr-status" data-pqr-status>대기</span>
    </div>
  `).join('');

  document.body.insertAdjacentHTML('beforeend', `
<div id="pqRunModal">
  <style>
    #pqRunModal { position: fixed; inset: 0; z-index: 100000; background: rgba(2,6,23,0.88); backdrop-filter: blur(14px); display: flex; align-items: center; justify-content: center; padding: 14px; color: #f8fafc; letter-spacing: 0; }
    #pqRunModal * { box-sizing: border-box; letter-spacing: 0; }
    .pqr-shell { width: min(1880px, calc(100vw - 28px)); height: min(980px, calc(100vh - 28px)); background: linear-gradient(135deg,#0f172a,#172033 55%,#111827); border: 1px solid rgba(129,140,248,0.35); border-radius: 20px; box-shadow: 0 34px 100px rgba(0,0,0,0.65); display: grid; grid-template-rows: auto auto 1fr auto; overflow: hidden; }
    .pqr-head { padding: 22px 26px 16px; display: flex; justify-content: space-between; gap: 18px; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .pqr-head h2 { margin: 0; font-size: 24px; font-weight: 900; color: #fff; }
    .pqr-sub { margin-top: 5px; color: rgba(196,181,253,0.9); font-size: 12px; }
    .pqr-close { min-height: 38px; padding: 9px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.08); color: #fff; font-weight: 800; cursor: pointer; }
    .pqr-progress { padding: 14px 26px; border-bottom: 1px solid rgba(255,255,255,0.08); background: rgba(30,41,59,0.48); }
    .pqr-progress-row { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 9px; color: rgba(226,232,240,0.86); font-size: 13px; font-weight: 800; }
    .pqr-bar { height: 12px; border-radius: 999px; background: rgba(15,23,42,0.86); border: 1px solid rgba(148,163,184,0.18); overflow: hidden; }
    .pqr-bar-fill { height: 100%; width: 0%; background: linear-gradient(90deg,#22c55e,#60a5fa,#a78bfa); transition: width 0.35s ease; }
    .pqr-main { min-height: 0; display: grid; grid-template-columns: minmax(500px, 0.9fr) minmax(680px, 1.25fr); gap: 18px; padding: 20px 28px; overflow: hidden; }
    .pqr-panel { min-height: 0; border: 1px solid rgba(148,163,184,0.16); border-radius: 14px; background: rgba(15,23,42,0.58); overflow: hidden; display: flex; flex-direction: column; }
    .pqr-panel-title { padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.07); font-size: 13px; color: #c4b5fd; font-weight: 900; }
    .pqr-list { padding: 12px; overflow-y: auto; display: grid; gap: 9px; }
    .pqr-card { display: flex; align-items: flex-start; gap: 10px; padding: 11px; border-radius: 12px; border: 1px solid rgba(148,163,184,0.14); background: rgba(30,41,59,0.54); }
    .pqr-card.running { border-color: rgba(96,165,250,0.62); background: rgba(59,130,246,0.12); }
    .pqr-card.done { border-color: rgba(34,197,94,0.48); background: rgba(34,197,94,0.10); }
    .pqr-card.failed { border-color: rgba(239,68,68,0.55); background: rgba(239,68,68,0.10); }
    .pqr-card-no { width: 30px; height: 30px; display: grid; place-items: center; flex: 0 0 auto; border-radius: 9px; background: rgba(99,102,241,0.18); color: #c4b5fd; font-size: 12px; font-weight: 900; }
    .pqr-card-body { min-width: 0; flex: 1; }
    .pqr-title { color: #fff; font-size: 13px; font-weight: 900; line-height: 1.35; word-break: keep-all; overflow-wrap: anywhere; }
    .pqr-meta { margin-top: 4px; color: rgba(203,213,225,0.72); font-size: 11px; line-height: 1.35; }
    .pqr-url { margin-top: 5px; color: #86efac; font-size: 10px; line-height: 1.35; word-break: break-all; }
    .pqr-status { flex: 0 0 auto; padding: 5px 8px; border-radius: 999px; background: rgba(15,23,42,0.7); color: rgba(226,232,240,0.78); font-size: 11px; font-weight: 900; }
    .pqr-images { padding: 14px; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; align-content: start; }
    .pqr-image-empty { grid-column: 1 / -1; min-height: 180px; display: grid; place-items: center; color: rgba(148,163,184,0.74); border: 1px dashed rgba(148,163,184,0.25); border-radius: 14px; }
    .pqr-img-card { border-radius: 13px; overflow: hidden; border: 1px solid rgba(148,163,184,0.16); background: rgba(2,6,23,0.45); box-shadow: 0 10px 26px rgba(0,0,0,0.22); }
    .pqr-img-card img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; background: #020617; cursor: zoom-in; }
    .pqr-img-card div { padding: 8px 9px; color: rgba(226,232,240,0.82); font-size: 11px; line-height: 1.35; }
    .pqr-lightbox { position: fixed; inset: 0; z-index: 100001; display: none; align-items: center; justify-content: center; padding: 22px; background: rgba(0,0,0,0.88); backdrop-filter: blur(8px); }
    .pqr-lightbox.open { display: flex; }
    .pqr-lightbox-inner { width: min(1540px, 98vw); max-height: 96vh; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 10px; }
    .pqr-lightbox-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #fff; font-size: 14px; font-weight: 900; }
    .pqr-lightbox-close { width: 42px; height: 42px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.18); background: rgba(15,23,42,0.72); color: #fff; font-size: 24px; line-height: 1; cursor: pointer; }
    .pqr-lightbox img { width: 100%; max-height: calc(96vh - 58px); object-fit: contain; border-radius: 12px; background: #020617; box-shadow: 0 24px 90px rgba(0,0,0,0.62); }
    .pqr-log { height: 170px; padding: 10px 28px 16px; border-top: 1px solid rgba(255,255,255,0.08); background: rgba(2,6,23,0.42); overflow-y: auto; font-size: 12px; line-height: 1.55; color: rgba(226,232,240,0.82); }
    .pqr-log-line { padding: 2px 0; border-bottom: 1px solid rgba(255,255,255,0.035); }
    @media (max-width: 980px) {
      .pqr-shell { height: calc(100vh - 20px); width: calc(100vw - 20px); }
      .pqr-main { grid-template-columns: 1fr; overflow-y: auto; }
      .pqr-panel { min-height: 320px; }
    }
  </style>
  <div class="pqr-shell">
    <div class="pqr-head">
      <div>
        <h2>즉시 순차발행 진행</h2>
        <div class="pqr-sub">총 ${items.length}개 · 간격 ${escHtml(intervalLabel)} · 한 글 완료 후 다음 글 시작</div>
      </div>
      <button class="pqr-close" id="pqrCloseBtn">닫기</button>
    </div>
    <div class="pqr-progress">
      <div class="pqr-progress-row">
        <span id="pqrProgressText">준비 중</span>
        <span id="pqrProgressPct">0%</span>
      </div>
      <div class="pqr-bar"><div class="pqr-bar-fill" id="pqrProgressFill"></div></div>
    </div>
    <div class="pqr-main">
      <section class="pqr-panel">
        <div class="pqr-panel-title">대기 / 예약 / 발행 글</div>
        <div class="pqr-list">${cards}</div>
      </section>
      <section class="pqr-panel">
        <div class="pqr-panel-title">생성 이미지 미리보기</div>
        <div class="pqr-images" id="pqrImages"><div class="pqr-image-empty">이미지가 생성되면 여기에 표시됩니다.</div></div>
      </section>
    </div>
    <div class="pqr-log" id="pqrLog"></div>
  </div>
  <div class="pqr-lightbox" id="pqrImageLightbox" aria-hidden="true">
    <div class="pqr-lightbox-inner">
      <div class="pqr-lightbox-head">
        <span id="pqrLightboxLabel"></span>
        <button type="button" class="pqr-lightbox-close" id="pqrLightboxClose" aria-label="닫기">×</button>
      </div>
      <img id="pqrLightboxImage" alt="">
    </div>
  </div>
</div>`);

  const modal = document.getElementById('pqRunModal');
  const logEl = document.getElementById('pqrLog');
  let currentIndex = 0;
  let completed = 0;
  let closed = false;
  let imageAccepting = false;
  let currentImageToken = '';

  const log = (message) => {
    if (!logEl || closed) return;
    const line = document.createElement('div');
    line.className = 'pqr-log-line';
    const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    line.textContent = `[${time}] ${String(message || '')}`;
    logEl.appendChild(line);
    while (logEl.children.length > 260) logEl.firstElementChild?.remove();
    logEl.scrollTop = logEl.scrollHeight;
  };

  const updateOverall = (itemProgress = 0, label = '') => {
    const total = Math.max(1, items.length);
    const pct = Math.max(0, Math.min(100, Math.round(((completed + itemProgress / 100) / total) * 100)));
    const fill = document.getElementById('pqrProgressFill');
    const pctEl = document.getElementById('pqrProgressPct');
    const textEl = document.getElementById('pqrProgressText');
    if (fill) fill.style.width = `${pct}%`;
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (textEl) textEl.textContent = label || `${completed}/${items.length} 완료`;
  };

  const setItemStatus = (index, status, message) => {
    currentIndex = index;
    const card = modal?.querySelector(`[data-pqr-index="${index}"]`);
    if (!card) return;
    card.classList.remove('running', 'done', 'failed');
    if (status) card.classList.add(status);
    const statusEl = card.querySelector('[data-pqr-status]');
    if (statusEl) statusEl.textContent = message || status || '대기';
  };

  const openImageLightbox = (url, label) => {
    const lightbox = document.getElementById('pqrImageLightbox');
    const img = document.getElementById('pqrLightboxImage');
    const labelEl = document.getElementById('pqrLightboxLabel');
    if (!lightbox || !img) return;
    img.src = url;
    if (labelEl) labelEl.textContent = label || '이미지 미리보기';
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
  };

  const closeImageLightbox = () => {
    const lightbox = document.getElementById('pqrImageLightbox');
    const img = document.getElementById('pqrLightboxImage');
    if (!lightbox) return;
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    if (img) img.removeAttribute('src');
  };

  const resetImages = (index) => {
    const host = document.getElementById('pqrImages');
    if (host) {
      const keyword = items[index]?.keyword || '';
      const label = keyword ? `${index + 1}번 글 "${keyword}"` : `${index + 1}번 글`;
      host.innerHTML = `<div class="pqr-image-empty">${escHtml(label)} 이미지가 생성되면 여기에 표시됩니다.</div>`;
    }
    closeImageLightbox();
  };

  const addImage = (payload) => {
    if (!imageAccepting || closed) return;
    const payloadToken = String(payload?.queueImageToken || payload?.runToken || '');
    if (currentImageToken && !payloadToken) {
      log(`출처가 불명확한 이미지 이벤트 무시: ${payload?.label || payload?.kind || '이미지'}`);
      return;
    }
    if (payloadToken && currentImageToken && payloadToken !== currentImageToken) {
      log(`이전 글 이미지 이벤트 무시: ${payload?.label || payload?.kind || '이미지'}`);
      return;
    }
    const url = payload?.url || payload?.dataUrl || '';
    if (!url) return;
    const host = document.getElementById('pqrImages');
    if (!host) return;
    host.querySelector('.pqr-image-empty')?.remove();
    const label = payload?.label || payload?.kind || items[currentIndex]?.keyword || '이미지';
    const card = document.createElement('div');
    card.className = 'pqr-img-card';
    const img = document.createElement('img');
    img.src = url;
    img.alt = label;
    img.title = label;
    img.addEventListener('click', () => openImageLightbox(url, label));
    const caption = document.createElement('div');
    caption.textContent = label;
    card.appendChild(img);
    card.appendChild(caption);
    host.prepend(card);
    log(`이미지 미리보기 추가: ${label}`);
  };

  document.getElementById('pqrLightboxClose')?.addEventListener('click', closeImageLightbox);
  document.getElementById('pqrImageLightbox')?.addEventListener('click', (e) => {
    if (e.target?.id === 'pqrImageLightbox') closeImageLightbox();
  });
  const lightboxKeyHandler = (e) => {
    if (e.key === 'Escape') closeImageLightbox();
  };
  document.addEventListener('keydown', lightboxKeyHandler);

  const unsubs = [];
  const api = window.blogger || window.electronAPI;
  try {
    if (api?.onProgress) {
      unsubs.push(api.onProgress((p) => {
        const sub = Number(p?.p ?? p?.percent ?? 0);
        const label = p?.label || p?.message || '진행 중';
        updateOverall(Number.isFinite(sub) ? sub : 0, `${currentIndex + 1}/${items.length} · ${label}`);
      }));
    }
    if (api?.onSwImageGenerated) {
      unsubs.push(api.onSwImageGenerated(addImage));
    }
    if (api?.onLog) {
      unsubs.push(api.onLog((line) => {
        if (/QUEUE|DROPSHOT|NANO|PROGRESS|발행|이미지|썸네일/i.test(String(line || ''))) log(line);
      }));
    }
  } catch (e) {
    console.warn('[QUEUE-RUN] progress subscribe failed:', e);
  }

  const cleanup = () => {
    closed = true;
    unsubs.forEach(fn => { try { fn?.(); } catch {} });
    document.removeEventListener('keydown', lightboxKeyHandler);
  };
  document.getElementById('pqrCloseBtn')?.addEventListener('click', () => {
    cleanup();
    modal?.remove();
  });

  log(`연속발행 시작 준비: ${items.length}개`);
  updateOverall(0, '대기열 준비 완료');

  return {
    log,
    setCurrent(index, token = '') {
      currentIndex = index;
      currentImageToken = String(token || '');
      imageAccepting = true;
      resetImages(index);
      setItemStatus(index, 'running', '진행 중');
      updateOverall(0, `${index + 1}/${items.length} · 시작`);
    },
    markDone(index, message = '완료') {
      imageAccepting = false;
      completed = Math.max(completed, index + 1);
      setItemStatus(index, 'done', message);
      if (index < items.length - 1) resetImages(index + 1);
      updateOverall(0, `${completed}/${items.length} 완료`);
    },
    markFailed(index, message = '실패') {
      imageAccepting = false;
      completed = Math.max(completed, index + 1);
      setItemStatus(index, 'failed', message);
      if (index < items.length - 1) resetImages(index + 1);
      updateOverall(0, `${completed}/${items.length} 처리`);
    },
    finish(message) {
      completed = items.length;
      updateOverall(100, message || '전체 완료');
      log(message || '전체 완료');
    },
    cleanup,
  };
}

async function runOneQueueItem(item) {
  const maxWaitMs = 45 * 60 * 1000;
  if (typeof window.runPosting === 'function') {
    return await Promise.race([
      Promise.resolve(window.runPosting()).then((runResult) => {
        const publishResult = runResult || window.__lastPublishResult || {};
        return {
          timeout: false,
          source: 'runPosting',
          result: publishResult,
          ok: publishResult?.ok === true,
          error: publishResult?.error || '',
        };
      }),
      new Promise(resolve => setTimeout(() => resolve({ timeout: true }), maxWaitMs)),
    ]);
  }

  const btn = document.getElementById('publishBtn') || document.querySelector('[data-action="publish"]');
  if (!btn) throw new Error('발행 버튼을 찾지 못했습니다.');
  const completion = new Promise((resolve) => {
    const handler = (e) => {
      window.removeEventListener('bgpt:publish-complete', handler);
      clearTimeout(timer);
      const publishResult = e?.detail?.result || e?.detail || {};
      resolve({
        timeout: false,
        detail: e?.detail,
        result: publishResult,
        ok: publishResult?.ok === true,
        error: publishResult?.error || '',
      });
    };
    const timer = setTimeout(() => {
      window.removeEventListener('bgpt:publish-complete', handler);
      resolve({ timeout: true });
    }, maxWaitMs);
    window.addEventListener('bgpt:publish-complete', handler);
  });
  btn.click();
  return await completion;
}

function bindModalEvents() {
  // 간격 컨트롤 동기화
  hydrateIntervalControlsFromStorage();
  document.getElementById('pq-interval-mode')?.addEventListener('change', () => syncIntervalControl());
  document.getElementById('pq-interval-value')?.addEventListener('input', () => syncIntervalControl());
  document.getElementById('pq-interval-value')?.addEventListener('change', () => syncIntervalControl());
  syncIntervalControl();

  // 일괄 적용
  document.getElementById('pq-bulk-apply')?.addEventListener('click', () => {
    const m = document.getElementById('pq-bulk-mode')?.value;
    const t = document.getElementById('pq-bulk-thumb')?.value;
    const h = document.getElementById('pq-bulk-h2')?.value;
    const hm = document.getElementById('pq-bulk-h2-mode')?.value;
    const c = document.getElementById('pq-bulk-cta')?.value;
    const p = document.getElementById('pq-bulk-platform')?.value;
    const pm = document.getElementById('pq-bulk-posting')?.value;
    const sc = document.getElementById('pq-bulk-section')?.value;
    const title = document.getElementById('pq-bulk-title')?.value;
    const tone = document.getElementById('pq-bulk-tone')?.value;
    const fact = document.getElementById('pq-bulk-fact')?.value;
    STATE.keywords.forEach(item => {
      if (m) item.mode = m;
      if (t) item.thumb = normalizeThumbEngine(t);
      if (h === 'same') item.h2ImageSource = normalizeThumbEngine(item.thumb);
      else if (h) item.h2ImageSource = normalizeThumbEngine(h);
      if (hm) item.h2ImageMode = normalizeH2ImageMode(hm);
      delete item.agentImageManaged;
      delete item.imageManagedBy;
      if (c) item.ctaMode = c;
      if (p) item.platform = normalizeQueuePlatform(p);
      if (pm) item.postingMode = normalizePostingMode(pm);
      if (sc) item.sectionCount = normalizeSectionCount(sc);
      if (title) applyTitleOptionToItem(item, title);
      if (tone) item.toneStyle = tone;
      if (fact) item.factCheckMode = fact;
      if (item.mode === 'adsense') item.ctaMode = 'none';
      if (item.ctaMode === 'manual') ensureItemManualCta(item);
      touchItemSnapshot(item);
    });
    persistQueue();
    refreshList();
  });

  document.getElementById('pq-sync-current')?.addEventListener('click', () => {
    const snapshot = getCurrentQueueSnapshot();
    STATE.keywords.forEach(item => applySnapshotToItem(item, snapshot, { force: true }));
    const settingsEl = document.getElementById('pq-current-settings');
    if (settingsEl) settingsEl.innerHTML = buildSnapshotChips(snapshot);
    persistQueue();
    refreshList();
  });

  // 큐 비우기
  document.getElementById('pq-action-clear')?.addEventListener('click', () => {
    if (!confirm('대기열을 비우시겠습니까?')) return;
    STATE.keywords = [];
    persistQueue();
    refreshList();
    syncBadge();
  });

  // 스케줄 추가 — 사용자가 선택한 발행 간격 사용
  document.getElementById('pq-action-schedule')?.addEventListener('click', async () => {
    const enabled = STATE.keywords.filter(k => k.enabled && k.keyword.trim());
    if (enabled.length === 0) return alert('활성화된 키워드가 없습니다.');
    enabled.forEach(item => applySnapshotToItem(item));
    if (!validateQueueManualCtas(enabled)) return;

    let cursor = getScheduleBaseDate().getTime();
    const minIntervalMs = getQueueMinPublishIntervalMs(enabled);
    const intervalReason = getQueueIntervalReason(enabled);
    const newSchedules = enabled.map((it, i) => {
      const d = new Date(cursor);
      const scheduleDateIso = d.toISOString();
      const postingMode = normalizePostingMode(it.postingMode || getCurrentPostingMode());
      const platform = normalizeQueuePlatform(it.platform || getCurrentPublishPlatform());
      const itemMode = it.mode || 'external';
      const isAdsense = itemMode === 'adsense';
      const h2Sections = getDefaultH2Sections();
      const h2ImageMode = normalizeH2ImageMode(it.h2ImageMode || 'all');
      const payload = buildQueuePayloadOverrides(it, scheduleDateIso);
      const item = {
        id: Date.now() + i,
        topic: it.keyword,
        keywords: [it.keyword],
        date: d.toISOString().slice(0, 10),
        time: d.toTimeString().slice(0, 5),
        scheduleDateTime: scheduleDateIso,
        contentMode: itemMode,
        ctaMode: isAdsense ? 'none' : it.ctaMode,
        manualCtas: payload.manualCtas,
        publishType: postingMode,
        postingMode,
        scheduleDate: postingMode === 'schedule' ? scheduleDateIso : undefined,
        thumbnailMode: it.thumb,
        platform,
        h2Images: { source: it.h2ImageSource || it.thumb, sections: h2Sections, mode: h2ImageMode, leonardoModel: it.leonardoModel || 'seedream-4.5' },
        h2ImageSource: it.h2ImageSource || it.thumb,
        leonardoModel: it.leonardoModel || 'seedream-4.5',
        h2ImageMode,
        h2ImageSections: h2Sections,
        skipImages: h2ImageMode === 'none',
        sourceUrl: it.contentUrl || it.sourceUrl || undefined,
        contentUrl: it.contentUrl || it.sourceUrl || undefined,
        manualCrawlUrls: (it.contentUrl || it.sourceUrl) ? [it.contentUrl || it.sourceUrl] : undefined,
        payload,
        settingsSnapshot: snapshotFromItem(it),
        adsenseMinScore: isAdsense ? 78 : undefined,
        adsenseScoreGate: isAdsense ? true : undefined,
        adsensePolicyScan: isAdsense ? true : undefined,
        adsenseHardeningScan: isAdsense ? true : undefined,
        status: 'pending',
        createdAt: new Date().toISOString(),
        fromQueue: true,
      };
      // 다음 항목 시각 = 현재 + 사용자 지정 간격, 단 이미지 엔진별 최소 간격으로 자동 보정
      cursor += getIntervalMs({ minMs: minIntervalMs });
      return item;
    });

    try {
      const existing = JSON.parse(localStorage.getItem('scheduledPosts') || '[]');
      localStorage.setItem('scheduledPosts', JSON.stringify([...existing, ...newSchedules]));
      if (window.electronAPI?.addSchedule) {
        for (const schedule of newSchedules) {
          await window.electronAPI.addSchedule({
            topic: schedule.topic,
            keywords: Array.isArray(schedule.keywords) ? schedule.keywords : [schedule.topic],
            platform: schedule.platform === 'blogspot' ? 'blogger' : schedule.platform,
            publishType: schedule.publishType || 'schedule',
            scheduleDateTime: schedule.scheduleDateTime,
            payload: {
              ...(schedule.payload || {}),
              scheduleDate: schedule.scheduleDateTime,
              scheduleDateTime: schedule.scheduleDateTime,
              settingsSnapshot: schedule.settingsSnapshot,
            },
            maxRetries: 3,
          });
        }
        try { await window.electronAPI.startScheduleMonitoring?.(); } catch {}
      }
      alert(`✅ ${newSchedules.length}개 스케줄 추가됨\n간격: ${intervalReason}\n첫 글: ${newSchedules[0].date} ${newSchedules[0].time}\n마지막: ${newSchedules[newSchedules.length - 1].date} ${newSchedules[newSchedules.length - 1].time}`);
      STATE.keywords = [];
      persistQueue();
      close();
      syncBadge();
    } catch (e) {
      alert('❌ 스케줄 저장 실패: ' + (e?.message || e));
    }
  });

  // 즉시 순차 발행 — 사용자가 선택한 발행 간격 사용
  document.getElementById('pq-action-publish')?.addEventListener('click', async () => {
    const enabled = STATE.keywords.filter(k => k.enabled && k.keyword.trim());
    if (enabled.length === 0) return alert('활성화된 키워드가 없습니다.');
    enabled.forEach(item => applySnapshotToItem(item));
    if (!validateQueueManualCtas(enabled)) return;
    persistQueue();
    const intervalMode = document.getElementById('pq-interval-mode')?.value || 'hours';
    const minIntervalMs = getQueueMinPublishIntervalMs(enabled);
    const rawFixedIntervalMs = getRawIntervalMs();
    const fixedIntervalMs = getIntervalMs({ minMs: minIntervalMs });
    const corrected = intervalMode !== 'random' && rawFixedIntervalMs < minIntervalMs;
    const intervalLabel = intervalMode === 'random'
      ? `4-8시간 무작위 (${getQueueIntervalReason(enabled)} 적용)`
      : `${formatIntervalMs(fixedIntervalMs)}${corrected ? ' · 자동 보정됨' : ''}`;
    if (!confirm(`${enabled.length}개 키워드를 즉시 순차 발행합니다.\n각 글 사이 간격: ${intervalLabel}\n이미지 기준: ${getQueueIntervalReason(enabled)}\n(이전 발행 완료 후 추가 대기)\n\n진행할까요?`)) return;
    close();
    const runModal = createQueueRunModal(enabled, intervalLabel);

    try {
      const usesDropshot = enabled.some(it => it.thumb === 'dropshot-nanobanana-pro' || it.h2ImageSource === 'dropshot-nanobanana-pro');
      if (usesDropshot) {
        runModal.log('리더스 나노바나나 무제한 감지: 이미지 생성은 1개씩 순차 실행합니다.');
        if (window.electronAPI?.invoke) {
          const checkLogin = typeof window.checkDropshotLoginCached === 'function'
            ? window.checkDropshotLoginCached({ maxAgeMs: 10 * 60 * 1000 })
            : window.electronAPI.invoke('dropshot:check-login');
          checkLogin.then((r) => {
            if (r?.loggedIn) runModal.log(`Dropshot 로그인 확인: ${r.subscription || 'unknown'}${r.cached ? ' · 최근 확인값' : ''}`);
            else runModal.log(`Dropshot 로그인 확인 필요: ${r?.message || '로그인 정보 없음'}`);
          }).catch((e) => runModal.log(`Dropshot 상태 확인 실패: ${e?.message || e}`));
        }
      }
    } catch (preflightErr) {
      runModal.log(`사전 확인 실패: ${preflightErr?.message || preflightErr}`);
    }

    // 🛡️ v3.5.84: 큐 모드 플래그 — posting.js가 단발 모달 대신 누적하도록 신호
    window.__queueRunning = true;
    window.__queueProgressActive = true;
    try { window.clearQualityAccumulator?.(); } catch {}

    const scheduleBaseDate = getScheduleBaseDate();
    let scheduleOffsetMs = 0;
    const enabledIds = new Set(enabled.map(item => item.id));
    const failedIds = new Set();

    try {
      for (let i = 0; i < enabled.length; i++) {
        const it = enabled[i];
        const itemScheduleDate = new Date(scheduleBaseDate.getTime() + scheduleOffsetMs).toISOString();
        const queueImageToken = `pq-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`;
        runModal.setCurrent(i, queueImageToken);
        runModal.log(`${i + 1}/${enabled.length} 시작: ${it.keyword}`);
        console.log(`[QUEUE] 🚀 ${i + 1}/${enabled.length}: ${it.keyword} (${it.mode}/${it.thumb}/${it.h2ImageSource})`);

        applyItemToMainForm(it, itemScheduleDate);
        window.__publishQueueActiveImageToken = queueImageToken;
        window.__publishForceOptions = {
          urlImageSource: it.url || '',
          urlImageAiCheck: !!it.urlAiCheck,
          urlImageAiFill: !!it.urlAiFill,
          urlImageThreshold: Number(it.urlThreshold) || 60,
          contentUrl: it.contentUrl || it.sourceUrl || '',
          sourceUrl: it.contentUrl || it.sourceUrl || '',
        };
        window.__publishQueuePayloadOverrides = {
          ...buildQueuePayloadOverrides(it, itemScheduleDate),
          queueImageToken,
        };

        await new Promise(r => setTimeout(r, 200));

        const startedAt = Date.now();
        try {
          const result = await runOneQueueItem(it);
          const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(0);
          if (result.timeout) {
            failedIds.add(it.id);
            runModal.markFailed(i, '타임아웃');
            runModal.log(`${i + 1}번 타임아웃: 45분 내 완료 이벤트 없음`);
          } else if (result.ok !== true) {
            failedIds.add(it.id);
            const errorText = result.error || result.result?.error || result.detail?.result?.error || 'publish_failed';
            runModal.markFailed(i, '?ㅽ뙣');
            runModal.log(`${i + 1}踰??ㅽ뙣 (${elapsedSec}珥?: ${errorText}`);
          } else {
            runModal.markDone(i, `${elapsedSec}초`);
            runModal.log(`${i + 1}번 완료 (${elapsedSec}초)`);
          }
        } catch (itemErr) {
          failedIds.add(it.id);
          const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(0);
          runModal.markFailed(i, '실패');
          runModal.log(`${i + 1}번 실패 (${elapsedSec}초): ${itemErr?.message || itemErr}`);
        }

        try { window.__publishQueuePayloadOverrides = null; } catch {}
        try { window.__publishQueueActiveImageToken = null; } catch {}

        if (i < enabled.length - 1) {
          const waitMs = intervalMode === 'random' ? getIntervalMs({ minMs: minIntervalMs }) : fixedIntervalMs;
          scheduleOffsetMs += waitMs;
          runModal.log(`다음 항목까지 ${formatIntervalMs(waitMs)} 대기`);
          await new Promise(r => setTimeout(r, waitMs));
        }
      }
      STATE.keywords = STATE.keywords.filter(item => !enabledIds.has(item.id) || failedIds.has(item.id));
      persistQueue();
      syncBadge();
      const successCount = enabled.length - failedIds.size;
      runModal.finish(failedIds.size > 0
        ? `처리 완료: 성공 ${successCount}개 · 실패 ${failedIds.size}개`
        : `전체 ${enabled.length}개 순차발행 완료`);
    } finally {
      window.__queueRunning = false;
      window.__queueProgressActive = false;
      try { window.__publishQueueActiveImageToken = null; } catch (e) { /* ignore */ }
      try { window.__publishForceOptions = null; } catch (e) { /* ignore */ }
      try { window.__publishQueuePayloadOverrides = null; } catch (e) { /* ignore */ }
      try { window.showQueueQualityReport?.(); } catch (e) { console.warn('[QUEUE] 종합 리포트 표시 실패:', e); }
    }
  });
}

// ════════════════════════════════════════════
// 공개 API
// ════════════════════════════════════════════

/** 현재 textarea의 키워드들을 STATE에 누적 추가 (덮어쓰기 X, 중복 제거) */
function addCurrent() {
  restoreQueue();
  const entries = getQueueInputEntries();
  if (entries.length < 1) {
    alert('키워드를 1개 이상 입력해 주세요.');
    return;
  }

  const snapshot = getCurrentQueueSnapshot();

  // 기존 STATE에 있는 키워드 문자열 집합
  const existing = new Set(STATE.keywords.map(k => (k.contentUrl || k.sourceUrl || k.keyword || '').trim().toLowerCase()));
  let added = 0;
  let skipped = 0;

  entries.forEach((entry, i) => {
    const norm = (entry.contentUrl || entry.sourceUrl || entry.keyword || '').trim().toLowerCase();
    if (!norm) return;
    if (existing.has(norm)) { skipped++; return; }
    existing.add(norm);
    const contentUrl = entry.contentUrl || entry.sourceUrl || '';
    STATE.keywords.push(applySnapshotToItem({
      id: `pq-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      keyword: entry.keyword.trim(),
      mode: snapshot.contentMode,
      thumb: snapshot.thumbnailMode,
      h2ImageSource: snapshot.h2ImageSource,
      leonardoModel: snapshot.leonardoModel,
      h2ImageMode: snapshot.h2ImageMode,
      ctaMode: snapshot.ctaMode,
      platform: snapshot.platform,
      postingMode: snapshot.postingMode,
      scheduleDate: snapshot.scheduleDate,
      sectionCount: snapshot.sectionCount,
      titleMode: snapshot.titleMode,
      toneStyle: snapshot.toneStyle,
      factCheckMode: snapshot.factCheckMode,
      useKeywordAsTitle: snapshot.useKeywordAsTitle,
      keywordFront: snapshot.keywordFront,
      enabled: true,
      // 🆕 URL 이미지 — 단일 발행 UI 현재값을 큐 항목 기본값으로 상속
      url: snapshot.urlImageSource || '',
      urlAiCheck: snapshot.urlAiCheck,
      urlAiFill: snapshot.urlAiFill,
      urlThreshold: snapshot.urlThreshold,
      // 🆕 v3.7.15 — 본문 콘텐츠 소스 URL (URL 모드 연속발행). 빈 값이면 키워드 모드.
      //   main form의 `#contentUrl` input 현재값을 항목별로 스냅샷.
      sourceUrl: contentUrl,
      contentUrl,
    }, snapshot));
    added++;
  });

  // textarea 비우기 (다음 묶음 입력을 위해)
  const ta = document.getElementById('keywordInput');
  if (ta) ta.value = '';
  if (getSingleInputMode() === 'url') {
    const urlTa = document.getElementById('referenceUrl');
    if (urlTa) urlTa.value = '';
  }

  persistQueue();
  syncBadge();

  const msg = skipped > 0
    ? `✅ ${added}개 추가됨 (중복 ${skipped}개 제외)\n현재 대기열: 총 ${STATE.keywords.length}개`
    : `✅ ${added}개 추가됨\n현재 대기열: 총 ${STATE.keywords.length}개`;
  alert(msg);
}

function open() {
  restoreQueue();
  // STATE가 비어있으면 textarea의 키워드로 초기 채움
  if (STATE.keywords.length === 0) {
    const entries = getQueueInputEntries();
    if (entries.length < 1) {
      alert('대기열이 비어있습니다.\n키워드를 입력하고 "➕ 대기열에 추가"를 먼저 누르세요.');
      return;
    }
    const snapshot = getCurrentQueueSnapshot();
    STATE.keywords = entries.map((entry, i) => applySnapshotToItem({
      id: `pq-${Date.now()}-${i}`,
      keyword: entry.keyword,
      mode: snapshot.contentMode,
      thumb: snapshot.thumbnailMode,
      h2ImageSource: snapshot.h2ImageSource,
      leonardoModel: snapshot.leonardoModel,
      h2ImageMode: snapshot.h2ImageMode,
      ctaMode: snapshot.ctaMode,
      platform: snapshot.platform,
      postingMode: snapshot.postingMode,
      scheduleDate: snapshot.scheduleDate,
      sectionCount: snapshot.sectionCount,
      titleMode: snapshot.titleMode,
      toneStyle: snapshot.toneStyle,
      factCheckMode: snapshot.factCheckMode,
      useKeywordAsTitle: snapshot.useKeywordAsTitle,
      keywordFront: snapshot.keywordFront,
      enabled: true,
      sourceUrl: entry.contentUrl || entry.sourceUrl || '',
      contentUrl: entry.contentUrl || entry.sourceUrl || '',
    }, snapshot));
    persistQueue();
  }
  // STATE에 이미 항목이 있으면 저장된 상세설정 스냅샷 기준으로 누락 필드만 보정한다.
  STATE.keywords.forEach(item => applySnapshotToItem(item, item.settingsSnapshot || undefined));
  persistQueue();

  // 모달 렌더
  let host = document.getElementById('publishQueueModal');
  if (host) host.remove();
  document.body.insertAdjacentHTML('beforeend', buildModalHtml());
  STATE.isOpen = true;
  refreshList();
  bindModalEvents();
  syncBadge();
}

function close() {
  const host = document.getElementById('publishQueueModal');
  if (host) host.remove();
  STATE.isOpen = false;
}

export function initPublishQueue() {
  bindMainIntervalControl();
  // textarea 변경 감지 → 배지 표시/숨김 동기화
  const ta = document.getElementById('keywordInput');
  if (ta) {
    ta.addEventListener('input', syncBadge);
    ta.addEventListener('change', syncBadge);
    setTimeout(syncBadge, 200);
  }
  const refTa = document.getElementById('referenceUrl');
  if (refTa) {
    refTa.addEventListener('input', syncBadge);
    refTa.addEventListener('change', syncBadge);
  }

  // 서브탭 (단일 / 연속) 토글 바인딩
  bindPublishModeTabs();

  // 전역 노출
  window.__publishQueue = { open, close, addCurrent, syncBadge, getCurrentMode, _state: STATE };
  console.log('[PUBLISH-QUEUE] ✅ 연속발행 대기열 모듈 + 서브탭 초기화 완료');
}
