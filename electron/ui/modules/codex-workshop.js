import { getAppState, addLog, sanitizeHTML, getTextLength, getStorageManager, getProgressManager } from './core.js';
import { createPreviewPayload } from './posting.js';
import { displayPreviewInModal } from './preview.js';

const MODAL_ID = 'codexWorkshopModal';
const INSTALL_MODAL_ID = 'agentInstallModal';
const ENTRY_ID = 'codexWorkshopEntry';
const STYLE_ID = 'codexWorkshopStyles';
const SETTINGS_SECTION_ID = 'agentModeSettingsSection';
const ENTRY_STATUS_ID = 'codexWorkshopEntryStatus';
const AGENT_STATUS_ID = 'codexAgentStatusPanel';
const AGENT_LOGIN_COMMAND_ID = 'codexAgentLoginCommand';
const AGENT_PROFILE_SELECT_ID = 'codexAgentProfileSelect';
const SETTINGS_PROFILE_SELECT_ID = 'agentModeSettingsProfileSelect';
const SETTINGS_PROFILE_START_LOGIN_ID = 'agentModeSettingsStartLogin';
const SETTINGS_PROFILE_REFRESH_ID = 'agentModeSettingsRefresh';
const SETTINGS_PROFILE_COMMAND_ID = 'agentModeSettingsLoginCommand';
const AGENT_RUN_STATUS_ID = 'codexAgentRunStatus';
const RUN_AGENT_JOB_BTN_ID = 'runCodexAgentJobBtn';
const EXECUTION_MODE_KEY = 'leadernamExecutionMode';
const ACTIVE_AGENT_PROVIDER_KEY = 'leadernamActiveAgentProvider';
const ACTIVE_AGENT_PROFILE_IDS_KEY = 'leadernamActiveAgentProfileIds';
const ACTIVE_API_TEXT_PROVIDER_KEY = 'leadernamActiveApiTextProvider';
const ACTIVE_API_IMAGE_PROVIDER_KEY = 'leadernamActiveApiImageProvider';
const AGENT_IMAGE_SETTINGS_KEY = 'leadernamAgentImageSettings';
const USAGE_SETTINGS_KEY = 'agentModeUsageSettings';
const USAGE_STATE_KEY = 'agentModeUsageState';
const USAGE_WINDOW_DEFAULT_HOURS = 5;
const DEFAULT_USAGE_LIMITS = {
  codex: 24,
  claude: 24,
};
const DEFAULT_AGENT_IMAGE_SETTINGS = {
  policy: 'all',
  thumbnailTextMode: 'include',
};
const AGENT_IMAGE_POLICY_OPTIONS = [
  { value: 'all', label: '?몃꽕???뚯젣紐??꾩껜', hint: '?몃꽕??1?κ낵 蹂몃Ц H2 ?꾩껜' },
  { value: 'thumbnail-only', label: '?몃꽕?쇰쭔', hint: '蹂몃Ц ?대?吏??留뚮뱾吏 ?딆쓬' },
  { value: 'odd-only', label: '????뚯젣紐?, hint: '?몃꽕??+ 1, 3, 5踰?H2' },
  { value: 'even-only', label: '吏앹닔 ?뚯젣紐?, hint: '?몃꽕??+ 2, 4踰?H2' },
  { value: 'none', label: '?대?吏 ?놁쓬', hint: '湲留??앹꽦' },
];

const state = {
  payload: null,
  articleTask: '',
  imageTask: '',
  activeAgentProfileIds: {},
  agentStatus: null,
  usageTimer: null,
  loginPollTimer: null,
  loginPollStartedAt: 0,
  installRunning: false,
  executionMode: 'api',
  activeAgentProvider: 'codex',
  activeApiTextProvider: 'gemini',
  activeApiImageProvider: 'stability',
};

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(value = '') {
  const temp = document.createElement('div');
  temp.innerHTML = String(value);
  return (temp.textContent || temp.innerText || '').trim();
}

function getBridgeApi() {
  return window.electronAPI || window.blogger || null;
}

function updateAgentProgress(percent, message, type = 'info') {
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  try {
    window.updateAgentProgressUI?.(safePercent, message, type);
  } catch (error) {
    console.warn('[CODEX-WORKSHOP] agent progress UI bridge failed:', error);
  }
  try {
    const progressManager = getProgressManager?.();
    progressManager?.updateProgress?.(safePercent, safePercent, message);
    progressManager?.updateStatus?.(message);
  } catch (error) {
    console.warn('[CODEX-WORKSHOP] progress update failed:', error);
  }

  try {
    const fallback = window.fallbackProgressModal;
    if (fallback?.progressBar) fallback.progressBar.style.width = `${safePercent}%`;
    if (fallback?.progressText) fallback.progressText.textContent = `${Math.round(safePercent)}%`;
    if (fallback?.progressStatus) fallback.progressStatus.textContent = message || '';
  } catch (error) {
    console.warn('[CODEX-WORKSHOP] fallback progress update failed:', error);
  }

  if (message) addLog(message, type);
}

function appendAgentGeneratedImagePreview(image = {}) {
  try {
    window.appendAgentGeneratedImageUI?.(image);
  } catch (error) {
    console.warn('[CODEX-WORKSHOP] agent image preview bridge failed:', error);
  }
}

function isMaxAgentAllowed(status = state.agentStatus) {
  return status?.ok === true && status?.allowed === true;
}

function getStorage() {
  try {
    return getStorageManager();
  } catch {
    return null;
  }
}

const API_TEXT_PROVIDERS = [
  {
    id: 'gemini',
    label: 'Gemini',
    keyIds: ['geminiKey'],
    dashboardUrl: 'https://aistudio.google.com/app/apikey',
    billingUrl: 'https://aistudio.google.com/plan_information',
    note: 'Google AI Studio/API ?ъ슜??湲곗?',
  },
  {
    id: 'openai',
    label: 'OpenAI API',
    keyIds: ['openaiKey'],
    dashboardUrl: 'https://platform.openai.com/api-keys',
    billingUrl: 'https://platform.openai.com/usage',
    note: 'Platform ?ъ슜???щ젅??湲곗?',
  },
  {
    id: 'claude',
    label: 'Anthropic API',
    keyIds: ['claudeKey'],
    dashboardUrl: 'https://console.anthropic.com/settings/keys',
    billingUrl: 'https://console.anthropic.com/settings/usage',
    note: 'Console ?ъ슜???щ젅??湲곗?',
  },
  {
    id: 'perplexity',
    label: 'Perplexity API',
    keyIds: ['perplexityKey'],
    dashboardUrl: 'https://www.perplexity.ai/settings/api',
    billingUrl: 'https://www.perplexity.ai/settings/api',
    note: 'Perplexity API ?щ젅??湲곗?',
  },
];

const API_IMAGE_PROVIDERS = [
  {
    id: 'stability',
    label: 'Stability',
    keyIds: ['stabilityApiKey', 'stabilityApiKeyHidden'],
    dashboardUrl: 'https://platform.stability.ai/account/keys',
    billingUrl: 'https://platform.stability.ai/account/credits',
    note: '?대?吏 ?щ젅??湲곗?',
  },
  {
    id: 'deepinfra',
    label: 'DeepInfra',
    keyIds: ['deepInfraApiKey'],
    dashboardUrl: 'https://deepinfra.com/dash/api_keys',
    billingUrl: 'https://deepinfra.com/dash/billing',
    note: '?대?吏/?띿뒪??API 怨쇨툑 湲곗?',
  },
  {
    id: 'openai-image',
    label: 'OpenAI Image',
    keyIds: ['dalleApiKey', 'openaiKey'],
    dashboardUrl: 'https://platform.openai.com/api-keys',
    billingUrl: 'https://platform.openai.com/usage',
    note: 'OpenAI Platform ?대?吏 ?ъ슜??湲곗?',
  },
];

const AGENT_PROVIDER_META = {
  codex: {
    id: 'codex',
    label: 'Codex',
    title: 'Codex 援щ룆 Agent',
    profileButton: 'Codex 怨꾩젙 以鍮?,
    upgradeUrl: 'https://chatgpt.com/explore/pro?utm_internal_source=openai_developers_codex',
    planUrl: 'https://chatgpt.com/pricing',
    analyticsUrl: 'https://chatgpt.com/codex/cloud/settings/analytics',
    docsUrl: 'https://developers.openai.com/codex/pricing',
    measuredStatus: '媛쒖씤 Plus/Pro 援щ룆???ㅼ떆媛??붿뿬?됱? 怨듦컻 CLI/API濡??쒓났?섏? ?딆뒿?덈떎. Business/Enterprise??愿由ъ옄 Analytics?먯꽌 ?ㅼ륫 ?ъ슜?됱쓣 ?뺤씤?????덉뒿?덈떎.',
    estimateText: '湲/?대?吏 ?앹꽦 媛??媛쒖닔???ㅼ젣 ?⑥? 援щ룆?됱쓣 ?????놁뼱??怨꾩궛?섏? ?딆뒿?덈떎. ?깆? ?앹꽦 ?깃났/?ㅽ뙣? 濡쒖뺄 ?묒뾽 湲곕줉留??쒖떆?⑸땲??',
  },
  claude: {
    id: 'claude',
    label: 'Claude Code',
    title: 'Claude Code 援щ룆 Agent',
    profileButton: 'Claude 怨꾩젙 以鍮?,
    upgradeUrl: 'https://claude.ai/upgrade',
    planUrl: 'https://claude.ai/settings/billing',
    analyticsUrl: 'https://claude.ai/settings/billing',
    docsUrl: 'https://support.claude.com/en/articles/8324991-about-claude-s-pro-plan-usage',
    measuredStatus: 'Claude Pro/Max??5?쒓컙 ?몄뀡 湲곗??쇰줈 由ъ뀑?섏?留?硫붿떆吏 湲몄씠, 紐⑤뜽, 湲곕뒫, ?꾩옱 ?⑸웾???곕씪 ?щ씪???⑥? 媛쒖닔瑜??몃? ?깆뿉???뺥솗??怨꾩궛?????놁뒿?덈떎.',
    estimateText: '?⑥? 湲/?대?吏 媛쒖닔???쒖떆?섏? ?딆뒿?덈떎. ???怨듭떇 ?뚮옖 ?붾㈃怨?Claude Code 濡쒓렇???곹깭, ???깆쓽 ?묒뾽 湲곕줉留?遺꾨━?댁꽌 蹂댁뿬以띾땲??',
  },
};

function openExternalUrl(url) {
  if (!url) return;
  const api = getBridgeApi();
  try {
    if (typeof api?.openExternal === 'function') {
      api.openExternal(url);
      return;
    }
    if (typeof api?.openLink === 'function') {
      api.openLink(url);
      return;
    }
  } catch {
    // fallback below
  }
  window.open(url, '_blank');
}

function loadExecutionPrefs() {
  const storage = getStorage();
  const savedMode = storage?.getSync?.(EXECUTION_MODE_KEY, true);
  const mode = savedMode === 'agent' ? 'agent' : 'api';
  const agentProvider = storage?.getSync?.(ACTIVE_AGENT_PROVIDER_KEY, true) === 'claude' ? 'claude' : 'codex';
  const apiTextProvider = String(storage?.getSync?.(ACTIVE_API_TEXT_PROVIDER_KEY, true) || 'gemini');
  const apiImageProvider = String(storage?.getSync?.(ACTIVE_API_IMAGE_PROVIDER_KEY, true) || 'stability');
  const savedProfileIds = storage?.getSync?.(ACTIVE_AGENT_PROFILE_IDS_KEY, true) || {};

  state.executionMode = mode;
  state.activeAgentProvider = agentProvider;
  state.activeApiTextProvider = API_TEXT_PROVIDERS.some((item) => item.id === apiTextProvider) ? apiTextProvider : 'gemini';
  state.activeApiImageProvider = API_IMAGE_PROVIDERS.some((item) => item.id === apiImageProvider) ? apiImageProvider : 'stability';
  state.activeAgentProfileIds = normalizeAgentProfileSelectionMap(savedProfileIds);
  return {
    mode: state.executionMode,
    agentProvider: state.activeAgentProvider,
    apiTextProvider: state.activeApiTextProvider,
    apiImageProvider: state.activeApiImageProvider,
    activeAgentProfileIds: state.activeAgentProfileIds,
  };
}

function saveExecutionPrefs() {
  const storage = getStorage();
  storage?.setSync?.(EXECUTION_MODE_KEY, state.executionMode, true);
  storage?.setSync?.(ACTIVE_AGENT_PROVIDER_KEY, state.activeAgentProvider, true);
  storage?.setSync?.(ACTIVE_API_TEXT_PROVIDER_KEY, state.activeApiTextProvider, true);
  storage?.setSync?.(ACTIVE_API_IMAGE_PROVIDER_KEY, state.activeApiImageProvider, true);
  storage?.setSync?.(ACTIVE_AGENT_PROFILE_IDS_KEY, state.activeAgentProfileIds, true);
}

function normalizeAgentProfileSelectionMap(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    codex: typeof source.codex === 'string' ? source.codex : '',
    claude: typeof source.claude === 'string' ? source.claude : '',
  };
}

function getSavedAgentProfileIdMap() {
  const storage = getStorage();
  return normalizeAgentProfileSelectionMap(storage?.getSync?.(ACTIVE_AGENT_PROFILE_IDS_KEY, true));
}

function getActiveAgentProfileId(provider) {
  const normalizedProvider = provider === 'claude' ? 'claude' : 'codex';
  const currentMap = state.activeAgentProfileIds || {};
  const selectedId = (currentMap?.[normalizedProvider] || '').toString().trim();
  return selectedId;
}

function getAgentProfilesByProvider(provider) {
  const normalizedProvider = provider === 'claude' ? 'claude' : 'codex';
  const profiles = Array.isArray(state.agentStatus?.profiles) ? state.agentStatus.profiles : [];
  return profiles.filter((profile) => profile.provider === normalizedProvider);
}

function getProfileById(provider, profileId) {
  const normalizedProvider = provider === 'claude' ? 'claude' : 'codex';
  if (!profileId) return null;
  return getAgentProfilesByProvider(normalizedProvider).find((profile) => profile.id === profileId) || null;
}

function getActiveAgentProfile(provider) {
  const normalizedProvider = provider === 'claude' ? 'claude' : 'codex';
  const selectedId = getActiveAgentProfileId(normalizedProvider);
  const selectedProfile = getProfileById(normalizedProvider, selectedId);
  const profiles = getAgentProfilesByProvider(normalizedProvider);
  return selectedProfile || profiles[0] || null;
}

function setActiveAgentProfile(provider, profileId) {
  const normalizedProvider = provider === 'claude' ? 'claude' : 'codex';
  const map = normalizeAgentProfileSelectionMap({
    ...state.activeAgentProfileIds,
    ...getSavedAgentProfileIdMap(),
  });
  const profile = getProfileById(normalizedProvider, profileId);
  if (profile) {
    map[normalizedProvider] = profile.id;
  } else if (profileId) {
    delete map[normalizedProvider];
  }
  state.activeAgentProfileIds = map;
  const storage = getStorage();
  storage?.setSync?.(ACTIVE_AGENT_PROFILE_IDS_KEY, map, true);
  return map[normalizedProvider] || '';
}

function getSelectedProfileByUi(provider) {
  const normalizedProvider = provider === 'claude' ? 'claude' : 'codex';
  const modalProfileId = $(AGENT_PROFILE_SELECT_ID)?.value?.trim() || '';
  const settingsProfileId = $(SETTINGS_PROFILE_SELECT_ID)?.value?.trim() || '';
  const selectedId = modalProfileId || settingsProfileId;
  return selectedId ? getProfileById(normalizedProvider, selectedId) : null;
}

function syncAgentProfileSelectValues(provider, profileId = '') {
  const normalizedProvider = provider === 'claude' ? 'claude' : 'codex';
  const profile = getProfileById(normalizedProvider, profileId || getActiveAgentProfileId(normalizedProvider)) || null;
  if (!profile) return;

  const settingsSelect = $(SETTINGS_PROFILE_SELECT_ID);
  const modalSelect = $(AGENT_PROFILE_SELECT_ID);
  if (settingsSelect) {
    settingsSelect.value = profile.id;
  }
  if (modalSelect) {
    modalSelect.value = profile.id;
  }
  const commandEl = $('agentModeSettingsLoginCommand');
  if (commandEl && profile.loginCommand) {
    commandEl.value = profile.loginCommand;
  }
  const modalCommandEl = $(AGENT_LOGIN_COMMAND_ID);
  if (modalCommandEl && profile.loginCommand) {
    modalCommandEl.value = profile.loginCommand;
  }
}

function normalizeAgentImagePolicy(value) {
  const raw = String(value || '').toLowerCase().trim();
  if (raw === 'odd') return 'odd-only';
  if (raw === 'even') return 'even-only';
  return AGENT_IMAGE_POLICY_OPTIONS.some((option) => option.value === raw) ? raw : DEFAULT_AGENT_IMAGE_SETTINGS.policy;
}

function getAgentImagePolicyLabel(policy) {
  const normalized = normalizeAgentImagePolicy(policy);
  return AGENT_IMAGE_POLICY_OPTIONS.find((option) => option.value === normalized)?.label || '?몃꽕???뚯젣紐??꾩껜';
}

function loadAgentImageSettings() {
  const storage = getStorage();
  const saved = storage?.getSync?.(AGENT_IMAGE_SETTINGS_KEY, true) || {};
  return {
    policy: normalizeAgentImagePolicy(saved.policy || saved.imagePolicy || saved.h2ImageMode),
    thumbnailTextMode: saved.thumbnailTextMode === 'none' ? 'none' : DEFAULT_AGENT_IMAGE_SETTINGS.thumbnailTextMode,
  };
}

function saveAgentImageSettings(next = {}) {
  const current = loadAgentImageSettings();
  const merged = {
    policy: normalizeAgentImagePolicy(next.policy || current.policy),
    thumbnailTextMode: next.thumbnailTextMode === 'none' ? 'none' : 'include',
  };
  getStorage()?.setSync?.(AGENT_IMAGE_SETTINGS_KEY, merged, true);
  return merged;
}

function toLegacyH2ImageMode(policy) {
  const normalized = normalizeAgentImagePolicy(policy);
  if (normalized === 'odd-only') return 'odd';
  if (normalized === 'even-only') return 'even';
  return normalized;
}

function getAgentImageSettingsMode() {
  const prefs = loadExecutionPrefs();
  const settings = loadAgentImageSettings();
  const isAgentMode = prefs.mode === 'agent';
  const provider = prefs.agentProvider;
  const codexImageManaged = isAgentMode && provider === 'codex' && settings.policy !== 'none';
  return {
    executionMode: prefs.mode,
    provider,
    isAgentMode,
    codexImageManaged,
    claudeNeedsImageEngine: isAgentMode && provider === 'claude',
    policy: settings.policy,
    imagePolicy: settings.policy,
    h2ImageMode: toLegacyH2ImageMode(settings.policy),
    thumbnailTextMode: settings.thumbnailTextMode,
    thumbnailTextIncluded: settings.thumbnailTextMode !== 'none',
    thumbnailIncludeText: settings.thumbnailTextMode !== 'none',
    h2TextIncluded: false,
  };
}

function refreshGlobalAiModelBadge() {
  try {
    window.updateAiModelStatus?.();
  } catch {
    // badge update is non-critical
  }
  try {
    window.applyAgentImageSettingsVisibility?.();
  } catch {
    // image setting visibility is non-critical
  }
}

function hasInputValue(id) {
  const el = $(id);
  return !!String(el?.value || '').trim();
}

function isApiProviderReady(provider) {
  return (provider.keyIds || []).some((id) => hasInputValue(id));
}

function getProviderProfile(provider) {
  return getActiveAgentProfile(provider);
}

function isAgentProfileReady(profile) {
  return profile?.status === 'ready';
}

function getProviderLoginLabel(provider, profile = getProviderProfile(provider)) {
  if (isAgentProfileReady(profile)) return '濡쒓렇???꾨즺';
  if (profile) return '濡쒓렇???湲?;
  return '濡쒓렇???꾩슂';
}

function getLocalAgentHistory(provider) {
  const summary = getUsageSummary(provider);
  const jobs = Array.isArray(summary.usageState?.jobs)
    ? summary.usageState.jobs.filter((job) => job.provider === provider)
    : [];
  const measuredJobs = jobs.filter((job) => job.usage?.measured);
  const totals = measuredJobs.reduce((acc, job) => {
    const usage = job.usage || {};
    acc.input += Number(usage.input_tokens || usage.usage?.input_tokens || 0);
    acc.output += Number(usage.output_tokens || usage.usage?.output_tokens || 0);
    acc.cost += Number(usage.total_cost_usd || 0);
    return acc;
  }, { input: 0, output: 0, cost: 0 });
  return {
    runs: summary.used,
    windowText: `${summary.settings.resetHours}?쒓컙 李??????ㅽ뻾 湲곕줉`,
    nextResetText: formatRemainingTime(summary.nextResetAt - Date.now()),
    measuredJobs: measuredJobs.length,
    inputTokens: totals.input,
    outputTokens: totals.output,
    costUsd: totals.cost,
  };
}

function loadUsageSettings() {
  const storage = getStorage();
  const saved = storage?.getSync?.(USAGE_SETTINGS_KEY, true) || {};
  const resetHours = Math.max(1, Math.min(24, Number(saved.resetHours || USAGE_WINDOW_DEFAULT_HOURS)));
  return {
    resetHours,
    limits: {
      codex: Math.max(1, Number(saved?.limits?.codex || DEFAULT_USAGE_LIMITS.codex)),
      claude: Math.max(1, Number(saved?.limits?.claude || DEFAULT_USAGE_LIMITS.claude)),
    },
  };
}

function saveUsageSettings(settings) {
  const storage = getStorage();
  storage?.setSync?.(USAGE_SETTINGS_KEY, settings, true);
}

function createFreshUsageState(now = Date.now()) {
  return {
    windowStartedAt: now,
    used: { codex: 0, claude: 0 },
    jobs: [],
  };
}

function getUsageWindowMs(settings = loadUsageSettings()) {
  return Math.max(1, Number(settings.resetHours || USAGE_WINDOW_DEFAULT_HOURS)) * 60 * 60 * 1000;
}

function normalizeUsageState(raw, settings = loadUsageSettings()) {
  const now = Date.now();
  const windowMs = getUsageWindowMs(settings);
  const startedAt = Number(raw?.windowStartedAt || 0);
  if (!startedAt || (now - startedAt) >= windowMs) {
    return createFreshUsageState(now);
  }

  return {
    windowStartedAt: startedAt,
    used: {
      codex: Math.max(0, Number(raw?.used?.codex || 0)),
      claude: Math.max(0, Number(raw?.used?.claude || 0)),
    },
    jobs: Array.isArray(raw?.jobs) ? raw.jobs.slice(-80) : [],
  };
}

function loadUsageState(settings = loadUsageSettings()) {
  const storage = getStorage();
  const raw = storage?.getSync?.(USAGE_STATE_KEY, true);
  const normalized = normalizeUsageState(raw, settings);
  if (normalized !== raw) {
    storage?.setSync?.(USAGE_STATE_KEY, normalized, true);
  }
  return normalized;
}

function saveUsageState(usageState) {
  getStorage()?.setSync?.(USAGE_STATE_KEY, usageState, true);
}

function getUsageSummary(provider = 'codex') {
  const settings = loadUsageSettings();
  const usageState = loadUsageState(settings);
  const key = provider === 'claude' ? 'claude' : 'codex';
  const limit = Math.max(1, Number(settings.limits[key] || DEFAULT_USAGE_LIMITS[key]));
  const used = Math.max(0, Number(usageState.used[key] || 0));
  const remaining = Math.max(0, limit - used);
  const nextResetAt = usageState.windowStartedAt + getUsageWindowMs(settings);
  return { settings, usageState, provider: key, limit, used, remaining, nextResetAt };
}

function recordAgentUsage(provider, jobId = '', usage = null) {
  const settings = loadUsageSettings();
  const usageState = loadUsageState(settings);
  const key = provider === 'claude' ? 'claude' : 'codex';
  usageState.used[key] = Math.max(0, Number(usageState.used[key] || 0)) + 1;
  usageState.jobs = [
    ...(Array.isArray(usageState.jobs) ? usageState.jobs : []),
    { provider: key, jobId, at: Date.now(), usage },
  ].slice(-80);
  saveUsageState(usageState);
  renderUsagePanels();
}

function resetAgentUsageWindow() {
  saveUsageState(createFreshUsageState());
  renderUsagePanels();
}

function formatRemainingTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}?쒓컙 ${minutes}遺?;
  if (minutes > 0) return `${minutes}遺?${seconds}珥?;
  return `${seconds}珥?;
}

function usagePercent(summary) {
  return Math.max(0, Math.min(100, Math.round((summary.used / Math.max(1, summary.limit)) * 100)));
}

async function loadAgentModeStatus(force = false) {
  if (!force && state.agentStatus) return state.agentStatus;

  const api = getBridgeApi();
  try {
    let result = null;
    if (typeof api?.getAgentModeStatus === 'function') {
      result = await api.getAgentModeStatus();
    } else if (typeof api?.invoke === 'function') {
      result = await api.invoke('agent-mode:get-status');
    }

    state.agentStatus = result?.ok
      ? result
      : {
          ok: false,
          allowed: false,
          mode: 'api-key',
          currentName: '?뺤씤 ?ㅽ뙣',
          requiredName: '?ㅽ깲?ㅻ뱶 (3媛쒖썡)',
          message: result?.error || 'Agent Mode ?곹깭瑜??뺤씤?섏? 紐삵뻽?듬땲??',
        };

    const codexTool = state.agentStatus?.tools?.codex;
    const activeTool = state.agentStatus?.tools?.[state.activeAgentProvider];
    if (
      state.activeAgentProvider === 'claude'
      && codexTool?.installed
      && codexTool.usable !== false
      && (!activeTool?.installed || activeTool.usable === false)
    ) {
      state.activeAgentProvider = 'codex';
      saveExecutionPrefs();
      refreshGlobalAiModelBadge();
    }
  } catch (error) {
    state.agentStatus = {
      ok: false,
      allowed: false,
      mode: 'api-key',
      currentName: '?뺤씤 ?ㅽ뙣',
      requiredName: '?ㅽ깲?ㅻ뱶 (3媛쒖썡)',
      message: error?.message || 'Agent Mode ?곹깭瑜??뺤씤?섏? 紐삵뻽?듬땲??',
    };
  }

  renderEntryStatus();
  renderAgentStatusPanel();
  renderAgentSettingsSection();
  return state.agentStatus;
}

function renderEntryStatus() {
  const statusEl = $(ENTRY_STATUS_ID);
  const button = $('openCodexWorkshopBtn');
  const status = state.agentStatus;
  if (!statusEl || !button) return;

  const prefs = loadExecutionPrefs();
  if (prefs.mode === 'api') {
    statusEl.className = 'codex-workshop-status is-muted';
    statusEl.textContent = '?꾩옱 API ??紐⑤뱶?낅땲?? Agent ?묒뾽?ㅼ? 鍮꾪솢?깊솕?섏뼱 ?덉뒿?덈떎.';
    button.textContent = '?ㅼ젙?먯꽌 Agent ?좏깮';
    button.disabled = true;
    return;
  }

  if (!status) {
    statusEl.className = 'codex-workshop-status is-muted';
    statusEl.textContent = '?쇱씠?좎뒪 ?곹깭 ?뺤씤 以?..';
    button.textContent = '?곹깭 ?뺤씤 以?;
    button.disabled = true;
    return;
  }

  if (isMaxAgentAllowed(status)) {
    const provider = prefs.agentProvider === 'claude' ? 'claude' : 'codex';
    const profile = getProviderProfile(provider);
    const ready = isAgentProfileReady(profile);
    statusEl.className = `codex-workshop-status ${ready ? 'is-ready' : 'is-muted'}`;
    statusEl.textContent = `${provider === 'claude' ? 'Claude Code' : 'Codex'} Agent 紐⑤뱶 쨌 ${ready ? '濡쒓렇???꾨즺' : getProviderLoginLabel(provider, profile)} 쨌 ${status.currentName || '3媛쒖썡 ?댁긽'}`;
    button.textContent = ready ? `${provider === 'claude' ? 'Claude' : 'Codex'} ?묒뾽???닿린` : 'Agent 濡쒓렇???꾩슂';
    button.disabled = false;
    return;
  }

  statusEl.className = 'codex-workshop-status is-locked';
  statusEl.textContent = `API ??紐⑤뱶 쨌 Max Agent??${status.requiredName || '3媛쒖썡 ?댁긽'}遺??;
  button.textContent = 'Max ?덈궡 蹂닿린';
  button.disabled = true;
}

function getToolInstalledLabel(tool) {
  if (!tool) return '?뺤씤 ??;
  if (!tool.installed) return '誘멸컧吏';
  if (tool.usable === false) return '?ㅽ뻾 沅뚰븳 ?뺤씤 ?꾩슂';
  return '?ㅼ튂??;
}

function renderUsageCard(provider) {
  const summary = getUsageSummary(provider);
  const label = provider === 'claude' ? 'Claude Code' : 'Codex';
  const percent = usagePercent(summary);
  const nextResetText = formatRemainingTime(summary.nextResetAt - Date.now());
  return `
    <div style="background: rgba(2,6,23,0.35); border: 1px solid rgba(148,163,184,0.18); border-radius: 14px; padding: 14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;">
        <strong style="color:#f8fafc;font-size:14px;">${label}</strong>
        <span style="font-size:12px;font-weight:900;color:${summary.remaining > 0 ? '#86efac' : '#fecaca'};">${summary.remaining}/${summary.limit} ?⑥쓬</span>
      </div>
      <div style="height:8px;background:rgba(15,23,42,0.8);border-radius:999px;overflow:hidden;">
        <div style="width:${percent}%;height:100%;background:${summary.remaining > 0 ? 'linear-gradient(90deg,#22c55e,#38bdf8)' : 'linear-gradient(90deg,#f97316,#ef4444)'};"></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;color:rgba(226,232,240,0.68);font-size:11px;">
        <span>?ъ슜 ${summary.used}??/span>
        <span>由ъ뀑 ${nextResetText}</span>
      </div>
    </div>
  `;
}

function renderUsagePanels() {
  renderApiProviderCards();
  renderAgentProviderPanel();
}

function saveUsageSettingsFromInputs() {
  const settings = {
    resetHours: Math.max(1, Math.min(24, Number($('agentUsageResetHours')?.value || USAGE_WINDOW_DEFAULT_HOURS))),
    limits: {
      codex: Math.max(1, Number($('agentUsageLimitCodex')?.value || DEFAULT_USAGE_LIMITS.codex)),
      claude: Math.max(1, Number($('agentUsageLimitClaude')?.value || DEFAULT_USAGE_LIMITS.claude)),
    },
  };
  saveUsageSettings(settings);
  loadUsageState(settings);
  renderUsagePanels();
  addLog('Max Agent ?ъ슜???ㅼ젙????ν뻽?듬땲??', 'success');
}

function startUsageTimer() {
  if (state.usageTimer) return;
  state.usageTimer = setInterval(renderUsagePanels, 1000);
}

function setSettingsStatus(message = '', type = 'info') {
  const el = $('agentModeSettingsStatus');
  if (!el) return;
  el.style.display = message ? 'block' : 'none';
  el.style.borderColor = type === 'error' ? 'rgba(248, 113, 113, 0.35)' : type === 'success' ? 'rgba(52, 211, 153, 0.35)' : 'rgba(59, 130, 246, 0.22)';
  el.style.background = type === 'error' ? 'rgba(127, 29, 29, 0.18)' : type === 'success' ? 'rgba(6, 78, 59, 0.2)' : 'rgba(59, 130, 246, 0.09)';
  el.style.color = type === 'error' ? '#fecaca' : type === 'success' ? '#bbf7d0' : 'rgba(191, 219, 254, 0.92)';
  el.textContent = message;
}

function ensureAgentInstallModal() {
  let modal = $(INSTALL_MODAL_ID);
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = INSTALL_MODAL_ID;
  modal.className = 'agent-install-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `
    <div class="agent-install-shell">
      <div class="agent-install-head">
        <div>
          <strong id="agentInstallTitle">Agent ?ㅼ튂</strong>
          <span id="agentInstallSubtitle">?ㅼ튂 紐낅졊???ㅽ뻾?섍퀬 寃곌낵瑜??뺤씤?⑸땲??</span>
        </div>
      </div>
      <div class="agent-install-body">
        <div id="agentInstallStatus" class="agent-install-status">
          <span class="agent-install-spinner"></span>
          <span id="agentInstallStatusText">以鍮?以묒엯?덈떎.</span>
        </div>
        <pre id="agentInstallOutput" class="agent-install-output">?ㅼ튂 濡쒓렇媛 ?ш린???쒖떆?⑸땲??</pre>
        <div class="agent-install-actions">
          <button type="button" id="agentInstallCloseBtn">?リ린</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  $('agentInstallCloseBtn')?.addEventListener('click', () => {
    if (state.installRunning) {
      setSettingsStatus('?ㅼ튂媛 ?꾩쭅 吏꾪뻾 以묒엯?덈떎. ?좎떆留?湲곕떎?ㅼ＜?몄슂.');
      return;
    }
    modal.classList.remove('is-open');
  });
  return modal;
}

function updateAgentInstallModal({ label = 'Agent', status = '?ㅼ튂 以鍮?以묒엯?덈떎.', output = '', type = 'info' } = {}) {
  ensureAgentInstallModal();
  const title = $('agentInstallTitle');
  const subtitle = $('agentInstallSubtitle');
  const statusBox = $('agentInstallStatus');
  const statusText = $('agentInstallStatusText');
  const outputEl = $('agentInstallOutput');

  if (title) title.textContent = `${label} ?ㅼ튂`;
  if (subtitle) subtitle.textContent = type === 'success'
    ? '?ㅼ튂媛 ?앸궗?듬땲?? ?곹깭瑜??ㅼ떆 ?뺤씤?⑸땲??'
    : type === 'error'
      ? '?ㅼ튂 以?臾몄젣媛 諛쒖깮?덉뒿?덈떎.'
      : '?ㅼ튂媛 吏꾪뻾 以묒엯?덈떎. 李쎌쓣 ?レ? 留먭퀬 湲곕떎?ㅼ＜?몄슂.';
  if (statusBox) statusBox.className = `agent-install-status ${type === 'success' ? 'is-success' : type === 'error' ? 'is-error' : ''}`;
  if (statusText) statusText.textContent = status;
  if (outputEl) outputEl.textContent = output || '?ㅼ튂 濡쒓렇瑜?湲곕떎由щ뒗 以묒엯?덈떎...';
}

function openAgentInstallModal(label) {
  const modal = ensureAgentInstallModal();
  updateAgentInstallModal({ label, status: `${label} ?ㅼ튂瑜??쒖옉?⑸땲??`, output: '?ㅼ튂 紐낅졊 以鍮?以?..', type: 'info' });
  modal.classList.add('is-open');
}

function renderSettingsProfileSelect() {
  const select = $('agentModeSettingsProfileSelect');
  const commandEl = $('agentModeSettingsLoginCommand');
  if (!select) return;

  const profiles = Array.isArray(state.agentStatus?.profiles) ? state.agentStatus.profiles : [];
  const providerProfiles = profiles.filter((profile) => profile.provider === state.activeAgentProvider);
  const previous = (select.value || '').trim();

  if (!providerProfiles.length) {
    select.innerHTML = '<option value="">선택된 계정 없음</option>';
    select.disabled = true;
    if (commandEl) commandEl.value = '';
    return;
  }

  select.disabled = false;
  select.innerHTML = providerProfiles
    .map((profile) => {
      const provider = profile.provider === 'claude' ? 'Claude Code' : 'Codex';
      const label = `${provider} | ${profile.label || profile.id} | ${getProviderLoginLabel(profile.provider, profile)}`;
      return `<option value="${escapeHtml(profile.id)}">${escapeHtml(label)}</option>`;
    })
    .join('');

  const activeProfile = getActiveAgentProfile(state.activeAgentProvider);
  const fallbackProfile = providerProfiles[0] || null;
  const selected = previous && providerProfiles.some((profile) => profile.id === previous)
    ? providerProfiles.find((profile) => profile.id === previous) || null
    : activeProfile && providerProfiles.some((profile) => profile.id === activeProfile.id)

      ? activeProfile
      : fallbackProfile;

  if (selected) {
    select.value = selected.id;
    setActiveAgentProfile(state.activeAgentProvider, selected.id);
    syncAgentProfileSelectValues(state.activeAgentProvider, selected.id);
    if (commandEl) commandEl.value = selected.loginCommand || '';
  } else {
    select.value = '';
    syncAgentProfileSelectValues(state.activeAgentProvider, '');
    if (commandEl) commandEl.value = '';
  }
}

function renderToolCards(status = state.agentStatus) {
  const codexTool = status?.tools?.codex;
  const claudeTool = status?.tools?.claude;
  const row = $('agentModeToolStatus');
  if (!row) return;
  row.innerHTML = `
    <div class="agent-mode-mini-card">
      <strong>Codex CLI</strong>
      <span>${escapeHtml(getToolInstalledLabel(codexTool))}</span>
    </div>
    <div class="agent-mode-mini-card">
      <strong>Claude Code</strong>
      <span>${escapeHtml(getToolInstalledLabel(claudeTool))}</span>
    </div>
  `;
}

function renderModeButtons() {
  const prefs = loadExecutionPrefs();
  const apiButton = $('executionModeApiBtn');
  const agentButton = $('executionModeAgentBtn');
  if (apiButton) apiButton.className = `agent-mode-choice ${prefs.mode === 'api' ? 'is-active' : ''}`;
  if (agentButton) agentButton.className = `agent-mode-choice ${prefs.mode === 'agent' ? 'is-active' : ''}`;

  const apiPanel = $('apiExecutionPanel');
  const agentPanel = $('agentExecutionPanel');
  const dualGrid = document.querySelector('.agent-mode-dual-grid');
  if (dualGrid) {
    dualGrid.classList.toggle('is-api-mode', prefs.mode === 'api');
    dualGrid.classList.toggle('is-agent-mode', prefs.mode === 'agent');
  }
  if (apiPanel) {
    apiPanel.classList.toggle('is-disabled', prefs.mode !== 'api');
    apiPanel.style.display = prefs.mode === 'api' ? '' : 'none';
  }
  if (agentPanel) {
    agentPanel.classList.toggle('is-disabled', prefs.mode !== 'agent');
    agentPanel.style.display = prefs.mode === 'agent' ? '' : 'none';
  }
}

function syncApiProviderSelectors() {
  const textSelect = $('apiTextProviderSelect');
  const imageSelect = $('apiImageProviderSelect');
  if (textSelect && textSelect.value !== state.activeApiTextProvider) textSelect.value = state.activeApiTextProvider;
  if (imageSelect && imageSelect.value !== state.activeApiImageProvider) imageSelect.value = state.activeApiImageProvider;
}

function renderApiProviderCards() {
  const target = $('apiProviderCards');
  if (!target) return;

  const text = API_TEXT_PROVIDERS.find((item) => item.id === state.activeApiTextProvider) || API_TEXT_PROVIDERS[0];
  const image = API_IMAGE_PROVIDERS.find((item) => item.id === state.activeApiImageProvider) || API_IMAGE_PROVIDERS[0];
  const cards = [
    { type: '湲 ?앹꽦', provider: text },
    { type: '?대?吏 ?앹꽦', provider: image },
  ];

  target.innerHTML = cards.map(({ type, provider }) => {
    const ready = isApiProviderReady(provider);
    return `
      <div class="agent-mode-provider-card">
        <div class="agent-mode-provider-top">
          <div>
            <strong>${escapeHtml(type)} 쨌 ${escapeHtml(provider.label)}</strong>
            <span>${ready ? 'API ???낅젰?? : 'API ???꾩슂'}</span>
          </div>
          <span class="agent-mode-pill ${ready ? 'is-ready' : 'is-locked'}">${ready ? '?ъ슜 媛?? : '誘몄꽕??}</span>
        </div>
        <div class="agent-mode-measure">
          <div class="agent-mode-gauge"><span style="width:${ready ? 100 : 0}%;"></span></div>
          <p>?ㅼ륫 ?ъ슜?됯낵 ?붿븸? ?쒓났????쒕낫??湲곗??쇰줈 ?뺤씤?⑸땲?? ${escapeHtml(provider.note)}</p>
        </div>
        <div class="agent-mode-actions">
          <button type="button" data-open-url="${escapeHtml(provider.dashboardUrl)}">API ???ㅼ젙</button>
          <button type="button" data-open-url="${escapeHtml(provider.billingUrl)}">異⑹쟾/?ъ슜??蹂닿린</button>
        </div>
      </div>
    `;
  }).join('');

  target.querySelectorAll('[data-open-url]').forEach((button) => {
    button.addEventListener('click', () => openExternalUrl(button.getAttribute('data-open-url') || ''));
  });
}

function renderAgentProviderTabs() {
  const codex = $('agentProviderTabCodex');
  const claude = $('agentProviderTabClaude');
  if (codex) codex.className = `agent-provider-tab ${state.activeAgentProvider === 'codex' ? 'is-active' : ''}`;
  if (claude) claude.className = `agent-provider-tab ${state.activeAgentProvider === 'claude' ? 'is-active' : ''}`;
}

function renderAgentImageSettingsPanel(provider) {
  const settings = loadAgentImageSettings();
  const disabled = provider !== 'codex';
  const disabledAttr = disabled ? 'disabled aria-disabled="true"' : '';
  const note = disabled
    ? 'Claude Code???대?吏 紐⑤뜽???놁뼱??蹂몃Ц ?대?吏 ?꾨＼?꾪듃留??뺣━?⑸땲?? ?ㅼ젣 ?대?吏??蹂꾨룄 ?대?吏 ?붿쭊?쇰줈 ?앹꽦?⑸땲??'
    : 'Codex媛 湲 ?앹꽦怨??④퍡 ?대?吏 ?꾩튂? ?꾨＼?꾪듃源뚯? 泥섎━?⑸땲?? ?뚯젣紐??대?吏???대뼡 ?듭뀡?먯꽌???띿뒪?몃? ?ｌ? ?딆뒿?덈떎.';

  return `
    <div class="agent-image-policy-panel ${disabled ? 'is-disabled' : ''}">
      <div class="agent-image-policy-head">
        <div>
          <strong>?대?吏 ?앹꽦 踰붿쐞</strong>
          <span>${escapeHtml(note)}</span>
        </div>
        <span class="agent-mode-pill ${disabled ? 'is-locked' : 'is-ready'}">${disabled ? '?꾨＼?꾪듃留? : escapeHtml(getAgentImagePolicyLabel(settings.policy))}</span>
      </div>
      <div class="agent-image-policy-grid">
        ${AGENT_IMAGE_POLICY_OPTIONS.map((option) => `
          <button type="button" data-agent-image-policy="${escapeHtml(option.value)}" class="${settings.policy === option.value ? 'is-active' : ''}" ${disabledAttr}>
            <strong>${escapeHtml(option.label)}</strong>
            <span>${escapeHtml(option.hint)}</span>
          </button>
        `).join('')}
      </div>
      <div class="agent-thumb-text-row">
        <div>
          <strong>?몃꽕???띿뒪??/strong>
          <span>?몃꽕?쇰쭔 ?띿뒪???ы븿 ?щ?瑜??좏깮?⑸땲?? ?뚯젣紐??대?吏????긽 ?띿뒪???놁쓬.</span>
        </div>
        <div class="agent-thumb-text-toggle">
          <button type="button" data-agent-thumb-text="include" class="${settings.thumbnailTextMode !== 'none' ? 'is-active' : ''}" ${disabledAttr}>?ы븿</button>
          <button type="button" data-agent-thumb-text="none" class="${settings.thumbnailTextMode === 'none' ? 'is-active' : ''}" ${disabledAttr}>誘명룷??/button>
        </div>
      </div>
    </div>
  `;
}

function renderAgentProviderPanel() {
  const detail = $('agentProviderDetail');
  if (!detail) return;

  const provider = state.activeAgentProvider === 'claude' ? 'claude' : 'codex';
  const meta = AGENT_PROVIDER_META[provider];
  const profile = getProviderProfile(provider);
  const tool = state.agentStatus?.tools?.[provider];
  const history = getLocalAgentHistory(provider);
  const allowed = isMaxAgentAllowed(state.agentStatus);
  const ready = isAgentProfileReady(profile);
  const loginLabel = getProviderLoginLabel(provider, profile);
  const toolLabel = getToolInstalledLabel(tool);
  const gaugeLabel = provider === 'claude'
    ? '怨듭떇 5?쒓컙 ?몄뀡 ?붿뿬??
    : '怨듭떇 援щ룆 ?붿뿬??;

  detail.innerHTML = `
    <div class="agent-mode-provider-card">
      <div class="agent-mode-provider-top">
        <div>
          <strong>${escapeHtml(meta.title)}</strong>
          <span>${escapeHtml(`${meta.label} ${toolLabel} 쨌 ${loginLabel}`)}</span>
        </div>
        <span class="agent-mode-pill ${allowed && ready ? 'is-ready' : 'is-locked'}">${allowed ? loginLabel : '3媛쒖썡 ?댁긽 ?꾩슂'}</span>
      </div>

      <div class="agent-mode-provider-layout">
        <div class="agent-mode-provider-main">
          <div class="agent-mode-plan-grid">
            <div>
              <strong>?꾩옱 援щ룆 ?뚮옖</strong>
              <span>?깆뿉???먮룞 ?ㅼ륫 遺덇?</span>
            </div>
              <div>
                <strong>怨듭떇 ?ъ슜??湲곗?</strong>
                <span>${provider === 'claude' ? '5?쒓컙 ?몄뀡/?숈쟻 ?쒗븳' : 'Plus/Pro ?먮뒗 Workspace Analytics'}</span>
              </div>
            <div>
              <strong>?????묒뾽 湲곕줉</strong>
              <span>${history.runs}??쨌 ${history.windowText}</span>
            </div>
            <div>
              <strong>?ㅼ륫 ?좏겙 湲곕줉</strong>
              <span>${history.measuredJobs}??쨌 ?낅젰 ${history.inputTokens.toLocaleString()} / 異쒕젰 ${history.outputTokens.toLocaleString()}</span>
            </div>
            <div>
              <strong>?ㅼ륫 鍮꾩슜 湲곕줉</strong>
              <span>${history.costUsd > 0 ? `$${history.costUsd.toFixed(4)}` : '?쒓났 ???쒖떆'}</span>
            </div>
          </div>

          <div class="agent-mode-measure">
            <div class="agent-mode-gauge is-unknown"><span style="width:0%;"></span></div>
            <p><b>${escapeHtml(gaugeLabel)}:</b> ${escapeHtml(meta.measuredStatus)}</p>
            <p>${escapeHtml(meta.estimateText)}</p>
            <p>濡쒖뺄 湲곕줉 由ъ뀑源뚯? ${escapeHtml(history.nextResetText)} ?⑥븯?듬땲?? ?좏겙/鍮꾩슜? CLI媛 諛섑솚??寃쎌슦?먮쭔 ?ㅼ륫?쇰줈 湲곕줉?⑸땲??</p>
          </div>
          ${renderAgentImageSettingsPanel(provider)}
        </div>

        <aside class="agent-mode-action-panel">
          <strong>鍮좊Ⅸ ?묒뾽</strong>
          <button type="button" class="agent-mode-primary-action" data-install-agent="${escapeHtml(provider)}">${escapeHtml(tool?.installed && tool.usable !== false ? `${meta.label} ?ㅼ튂/?낅뜲?댄듃` : `${meta.label} ?ㅼ튂?섍린`)}</button>
          <button type="button" class="agent-mode-primary-action" data-agent-login="${escapeHtml(provider)}">${escapeHtml(ready ? `${meta.label} 濡쒓렇???꾨즺 ?뺤씤` : `${meta.label} 濡쒓렇??李??닿린`)}</button>
          <button type="button" data-agent-refresh="true">?곹깭 ?덈줈怨좎묠</button>
          <div class="agent-mode-link-grid">
            <button type="button" data-open-url="${escapeHtml(meta.planUrl)}">?꾩옱 ?뚮옖</button>
            <button type="button" data-open-url="${escapeHtml(meta.analyticsUrl)}">?ъ슜??/button>
            <button type="button" data-open-url="${escapeHtml(meta.upgradeUrl)}">?낃렇?덉씠??/button>
            <button type="button" data-open-url="${escapeHtml(meta.docsUrl)}">怨듭떇 湲곗?</button>
          </div>
        </aside>
      </div>
    </div>
  `;

  detail.querySelectorAll('[data-open-url]').forEach((button) => {
    button.addEventListener('click', () => openExternalUrl(button.getAttribute('data-open-url') || ''));
  });
  detail.querySelectorAll('[data-install-agent]').forEach((button) => {
    button.addEventListener('click', () => installAgentTool(button.getAttribute('data-install-agent') || provider, button));
  });
  detail.querySelectorAll('[data-agent-login]').forEach((button) => {
    button.addEventListener('click', () => {
      const selectedProvider = button.getAttribute('data-agent-login') || provider;
      const selectedProfileId = getActiveAgentProfile(selectedProvider)?.id || '';
      startAgentLogin(selectedProvider, selectedProfileId);
    });
  });
  detail.querySelectorAll('[data-agent-refresh]').forEach((button) => {
    button.addEventListener('click', () => loadAgentModeStatus(true));
  });
  detail.querySelectorAll('[data-agent-image-policy]').forEach((button) => {
    button.addEventListener('click', () => {
      saveAgentImageSettings({ policy: button.getAttribute('data-agent-image-policy') || 'all' });
      renderAgentProviderPanel();
      refreshGlobalAiModelBadge();
    });
  });
  detail.querySelectorAll('[data-agent-thumb-text]').forEach((button) => {
    button.addEventListener('click', () => {
      saveAgentImageSettings({ thumbnailTextMode: button.getAttribute('data-agent-thumb-text') || 'include' });
      renderAgentProviderPanel();
      refreshGlobalAiModelBadge();
    });
  });

  const modalRunButton = $(RUN_AGENT_JOB_BTN_ID);
  if (modalRunButton && !modalRunButton.disabled) modalRunButton.textContent = `${meta.label}濡??앹꽦`;
  renderAgentProviderTabs();
  renderSettingsProfileSelect();
}

function setExecutionMode(mode) {
  const nextMode = mode === 'agent' ? 'agent' : 'api';
  if (nextMode === 'agent' && !isMaxAgentAllowed(state.agentStatus)) {
    alert(state.agentStatus?.message || 'Agent 紐⑤뱶??3媛쒖썡 ?댁긽 肄붾뱶?먯꽌 ?ъ슜?????덉뒿?덈떎.');
    state.executionMode = 'api';
  } else {
    state.executionMode = nextMode;
  }
  saveExecutionPrefs();
  applyExecutionModeToApp();
  renderAgentSettingsSection();
  refreshGlobalAiModelBadge();
  addLog(`?ㅽ뻾 紐⑤뱶瑜?${state.executionMode === 'agent' ? 'Agent 紐⑤뱶' : 'API ??紐⑤뱶'}濡?蹂寃쏀뻽?듬땲??`, 'info');
}

function setAgentProvider(provider) {
  state.activeAgentProvider = provider === 'claude' ? 'claude' : 'codex';
  state.articleTask = '';
  state.imageTask = '';
  if (state.payload) {
    state.articleTask = buildCodexArticleTask(state.payload);
    state.imageTask = buildCodexImageTask(state.payload);
    setModalValues();
  }
  saveExecutionPrefs();
  renderAgentSettingsSection();
  refreshGlobalAiModelBadge();
}

function setApiProvider(kind, providerId) {
  if (kind === 'image') {
    state.activeApiImageProvider = API_IMAGE_PROVIDERS.some((item) => item.id === providerId) ? providerId : 'stability';
  } else {
    state.activeApiTextProvider = API_TEXT_PROVIDERS.some((item) => item.id === providerId) ? providerId : 'gemini';
  }
  saveExecutionPrefs();
  renderAgentSettingsSection();
  refreshGlobalAiModelBadge();
}

function applyExecutionModeToApp() {
  const prefs = loadExecutionPrefs();
  const agentSelected = prefs.mode === 'agent';
  const apiInputIds = [
    'openaiKey', 'geminiKey', 'claudeKey', 'perplexityKey', 'dalleApiKey',
    'pexelsApiKey', 'stabilityApiKey', 'deepInfraApiKey', 'prodiaApiKey',
    'leonardoKey', 'coupangAccessKey', 'coupangSecretKey', 'naverCustomerId',
    'naverSecretKey', 'googleCseKey', 'googleCseCx', 'youtubeApiKey',
    'generationEngine',
  ];

  apiInputIds.forEach((id) => {
    const el = $(id);
    if (el) el.disabled = id === 'generationEngine' ? agentSelected : false;
  });

  const apiTextProviderSelect = $('apiTextProviderSelect');
  if (apiTextProviderSelect) apiTextProviderSelect.disabled = agentSelected;
  const apiImageProviderSelect = $('apiImageProviderSelect');
  if (apiImageProviderSelect) apiImageProviderSelect.disabled = agentSelected && state.activeAgentProvider === 'codex';

  ['agentModeSettingsStartLogin', 'agentModeSettingsRefresh', 'agentUsageResetBtn', 'agentModeSettingsProfileSelect'].forEach((id) => {
    const el = $(id);
    if (el) el.disabled = !agentSelected;
  });

  document.querySelectorAll('[data-agent-mode-original-display]').forEach((node) => {
    node.style.display = node.dataset.agentModeOriginalDisplay || '';
    delete node.dataset.agentModeOriginalDisplay;
  });

  document.querySelectorAll('input[name="primaryGeminiTextModel"]').forEach((el) => {
    el.disabled = agentSelected;
  });

  const tab = $('tab-api-keys');
  const agentHiddenBlocks = new Set();
  const addAgentHiddenBlock = (el) => {
    if (!el || !tab) return;
    let node = el.parentElement;
    while (node && node.parentElement !== tab) {
      node = node.parentElement;
    }
    if (node && node.id !== SETTINGS_SECTION_ID) {
      agentHiddenBlocks.add(node);
    }
  };

  addAgentHiddenBlock($('textEnginePicker'));
  [
    ...apiInputIds,
    'openaiKeyHidden', 'pexelsApiKeyHidden', 'stabilityApiKeyHidden', 'dalleApiKeyHidden',
  ].forEach((id) => addAgentHiddenBlock($(id)));
  document.querySelectorAll('input[name="primaryGeminiTextModel"]').forEach(addAgentHiddenBlock);

  agentHiddenBlocks.forEach((node) => {
    if (!node.dataset.agentModeOriginalDisplay) {
      node.dataset.agentModeOriginalDisplay = node.style.display || '';
    }
    node.style.display = agentSelected ? 'none' : node.dataset.agentModeOriginalDisplay;
  });

  const runButton = $(RUN_AGENT_JOB_BTN_ID);
  if (runButton) runButton.disabled = !agentSelected;
  const openButton = $('openCodexWorkshopBtn');
  if (openButton) openButton.disabled = !agentSelected || !isMaxAgentAllowed(state.agentStatus);

  renderModeButtons();
}

function renderAgentSettingsSection() {
  const section = $(SETTINGS_SECTION_ID);
  if (!section) return;

  loadExecutionPrefs();
  const status = state.agentStatus;
  const badge = $('agentModeSettingsBadge');
  const summary = $('agentModeSettingsSummary');
  const description = $('agentModeSettingsDescription');

  if (badge) {
    const allowed = isMaxAgentAllowed(status);
    badge.textContent = !status ? '?뺤씤 以? : state.executionMode === 'agent' ? (allowed ? 'Agent 紐⑤뱶' : 'Agent ?좉?') : 'API ??紐⑤뱶';
    badge.className = `agent-mode-pill ${state.executionMode === 'agent' && allowed ? 'is-ready' : state.executionMode === 'api' ? '' : 'is-locked'}`;
  }

  if (summary) {
    summary.textContent = status
      ? `?꾩옱 肄붾뱶: ${status.currentName || '?뺤씤 ?ㅽ뙣'} 쨌 Max 湲곗?: ${status.requiredName || '?ㅽ깲?ㅻ뱶 (3媛쒖썡)'}`
      : '?쇱씠?좎뒪? ?ㅼ튂 ?꾧뎄瑜??뺤씤?섍퀬 ?덉뒿?덈떎.';
  }

  if (description) {
    description.textContent = state.executionMode === 'agent'
      ? 'Agent 紐⑤뱶媛 ?좏깮?섏뼱 ?꾨옒 AI ?띿뒪???붿쭊怨?API ???낅젰移몄? ?④꺼吏묐땲?? Codex? Claude Code???꾨옒?먯꽌 ?섎굹留??좏깮???ъ슜?⑸땲??'
      : 'API ??紐⑤뱶媛 ?좏깮?섏뿀?듬땲?? ?꾨옒 API ???낅젰移멸낵 湲곗〈 紐⑤뜽 ?좏깮 UI瑜??ъ슜?⑸땲??';
  }

  renderToolCards(status);
  renderModeButtons();
  syncApiProviderSelectors();
  applyExecutionModeToApp();
  renderApiProviderCards();
  renderAgentProviderPanel();
  renderSettingsProfileSelect();
}

function ensureAgentSettingsSection() {
  if ($(SETTINGS_SECTION_ID)) {
    renderAgentSettingsSection();
    return;
  }

  const tab = $('tab-api-keys');
  if (!tab) return;

  const section = document.createElement('section');
  section.id = SETTINGS_SECTION_ID;
  section.className = 'agent-mode-settings agent-mode-settings-compact';
  section.innerHTML = `
    <div class="agent-mode-settings-head">
      <div>
        <div class="agent-mode-eyebrow">AI ?ㅽ뻾 諛⑹떇</div>
        <h3>API ??紐⑤뱶 / Agent 紐⑤뱶</h3>
        <p id="agentModeSettingsDescription">API 紐⑤뱶?먯꽌?????낅젰移몄쓣 蹂댁뿬二쇨퀬, Agent 紐⑤뱶?먯꽌?????낅젰移멸낵 紐⑤뜽 ?좏깮???④퉩?덈떎.</p>
      </div>
      <span id="agentModeSettingsBadge" class="agent-mode-pill">?뺤씤 以?/span>
    </div>

    <div class="agent-mode-summary" id="agentModeSettingsSummary">?곹깭 ?뺤씤 以?..</div>

    <div class="agent-mode-mode-switch">
      <button type="button" id="executionModeApiBtn" class="agent-mode-choice">API ??紐⑤뱶</button>
      <button type="button" id="executionModeAgentBtn" class="agent-mode-choice">Agent 紐⑤뱶</button>
    </div>

    <div class="agent-mode-dual-grid">
      <div class="agent-mode-execution-panel" id="apiExecutionPanel">
        <div class="agent-mode-panel-title">
          <strong>API ??異⑹쟾??/strong>
          <span>?좏깮??API ?ㅻ쭔 ?ъ슜?⑸땲?? Agent ?ㅽ뻾? 爰쇱쭛?덈떎.</span>
        </div>
        <div class="agent-mode-control-grid">
          <label>
            <span>湲 ?앹꽦 API</span>
            <select id="apiTextProviderSelect">
              ${API_TEXT_PROVIDERS.map((provider) => `<option value="${escapeHtml(provider.id)}">${escapeHtml(provider.label)}</option>`).join('')}
            </select>
          </label>
          <label>
            <span>?대?吏 ?앹꽦 API</span>
            <select id="apiImageProviderSelect">
              ${API_IMAGE_PROVIDERS.map((provider) => `<option value="${escapeHtml(provider.id)}">${escapeHtml(provider.label)}</option>`).join('')}
            </select>
          </label>
        </div>
        <div id="apiProviderCards" class="agent-mode-provider-list"></div>
      </div>

      <div class="agent-mode-execution-panel" id="agentExecutionPanel">
        <div class="agent-mode-panel-title">
          <strong>Agent 援щ룆??/strong>
          <span>3媛쒖썡 ?댁긽 肄붾뱶?먯꽌 Codex ?먮뒗 Claude Code 援щ룆 怨꾩젙?쇰줈 ?ㅽ뻾?⑸땲?? API ???낅젰移몄? 爰쇱쭛?덈떎.</span>
        </div>
        <div class="agent-mode-tool-row" id="agentModeToolStatus"></div>
        <div class="agent-provider-tabs">
          <button type="button" id="agentProviderTabCodex" class="agent-provider-tab">Codex</button>
          <button type="button" id="agentProviderTabClaude" class="agent-provider-tab">Claude Code</button>
        </div>
        <div id="agentProviderDetail"></div>
        <div class="agent-mode-control-grid" style="margin-top:10px; margin-bottom:2px;">
          <label>
            <span>怨꾩젙 ?좏깮</span>
            <select id="agentModeSettingsProfileSelect"></select>
          </label>
          <div class="agent-mode-maintenance-actions">
            <button type="button" id="agentModeSettingsStartLogin">?좏깮 怨꾩젙 濡쒓렇??/button>
            <button type="button" id="agentModeSettingsRefresh">?곹깭 ?덈줈怨좎묠</button>
          </div>
        </div>

        <div class="agent-mode-maintenance-actions">
          <button type="button" id="agentUsageResetBtn">濡쒖뺄 湲곕줉 珥덇린??/button>
        </div>
        <textarea id="agentModeSettingsLoginCommand" class="codex-workshop-textarea codex-workshop-code" style="display:none;" readonly></textarea>
      </div>
    </div>

    <div id="agentModeSettingsStatus" class="codex-workshop-note" style="display:none;"></div>
    <div class="agent-mode-footnote">?먯튃: ?ㅼ륫 遺덇??ν븳 ?붿뿬?됱? ?レ옄濡??쒖떆?섏? ?딆뒿?덈떎. API???쒓났????쒕낫?? Agent??怨듭떇 援щ룆/Analytics ?붾㈃ 湲곗??쇰줈 ?뺤씤?⑸땲??</div>
  `;

  const firstBlock = tab.firstElementChild;
  if (firstBlock) {
    firstBlock.insertAdjacentElement('afterend', section);
  } else {
    tab.appendChild(section);
  }

  $('executionModeApiBtn')?.addEventListener('click', () => setExecutionMode('api'));
  $('executionModeAgentBtn')?.addEventListener('click', () => setExecutionMode('agent'));
  $('apiTextProviderSelect')?.addEventListener('change', (event) => setApiProvider('text', event.target?.value));
  $('apiImageProviderSelect')?.addEventListener('change', (event) => setApiProvider('image', event.target?.value));
  $('agentProviderTabCodex')?.addEventListener('click', () => setAgentProvider('codex'));
  $('agentProviderTabClaude')?.addEventListener('click', () => setAgentProvider('claude'));
  $('agentModeSettingsProfileSelect')?.addEventListener('change', () => {
    const profile = getSelectedProfileByUi(state.activeAgentProvider);
    if (profile) {
      setActiveAgentProfile(state.activeAgentProvider, profile.id);
      renderAgentProfileSelect();
    }
  });
  $('agentModeSettingsStartLogin')?.addEventListener('click', () => startAgentLogin(
    state.activeAgentProvider,
    $('agentModeSettingsProfileSelect')?.value || '',
  ));
  $('agentModeSettingsRefresh')?.addEventListener('click', () => {
    loadAgentModeStatus(true);
  });
  $('agentUsageResetBtn')?.addEventListener('click', () => {
    resetAgentUsageWindow();
    setSettingsStatus('???깆쓽 濡쒖뺄 Agent ?ㅽ뻾 湲곕줉??珥덇린?뷀뻽?듬땲??');
  });

  renderUsagePanels();
  renderAgentSettingsSection();
}

function getTopic(payload = {}) {
  return payload.title || payload.topic || payload.keywords?.[0]?.keyword || $('keywordInput')?.value?.trim() || '';
}

function normalizePlatformName(platform = '') {
  const value = String(platform || '').toLowerCase();
  if (value.includes('wordpress') || value.includes('wp')) return 'WordPress';
  if (value.includes('blogger') || value.includes('blogspot')) return 'Blogspot';
  if (value.includes('tistory')) return 'Tistory';
  if (value.includes('naver')) return 'Naver Blog';
  return 'Blog';
}

function getReferenceLines(payload = {}) {
  const urls = [
    ...(Array.isArray(payload.manualCrawlUrls) ? payload.manualCrawlUrls : []),
    payload.sourceUrl,
  ].filter(Boolean);
  return [...new Set(urls)].slice(0, 6);
}

function getPayloadImagePolicy(payload = {}) {
  return normalizeAgentImagePolicy(payload.imagePolicy || payload.h2ImageMode || loadAgentImageSettings().policy);
}

function describeImagePolicy(policy) {
  const normalized = normalizeAgentImagePolicy(policy);
  if (normalized === 'thumbnail-only') return '?몃꽕??1?λ쭔 ?앹꽦?섍퀬 蹂몃Ц H2 ?대?吏??留뚮뱾吏 ?딆뒿?덈떎.';
  if (normalized === 'odd-only') return '?몃꽕??1?κ낵 ???踰덉㎏ H2(1, 3, 5...) ?대?吏留??앹꽦?⑸땲??';
  if (normalized === 'even-only') return '?몃꽕??1?κ낵 吏앹닔 踰덉㎏ H2(2, 4, 6...) ?대?吏留??앹꽦?⑸땲??';
  if (normalized === 'none') return '?대?吏瑜??앹꽦?섏? ?딄퀬 湲 HTML留??꾩꽦?⑸땲??';
  return '?몃꽕??1?κ낵 紐⑤뱺 H2 ?뚯젣紐??대?吏瑜??앹꽦?⑸땲??';
}

function buildCodexArticleTask(payload = {}) {
  const topic = getTopic(payload);
  const references = getReferenceLines(payload);
  const platform = normalizePlatformName(payload.targetPlatform || payload.platform);
  const sectionCount = Number(payload.sectionCount || 5);
  const minChars = payload.minChars ? Number(payload.minChars).toLocaleString() : 'enough';
  const maxChars = payload.maxChars ? Number(payload.maxChars).toLocaleString() : 'natural';

  return `Codex ?묒뾽??吏?쒖꽌

紐⑺몴:
- ?꾨옒 ?ㅼ젙??湲곗??쇰줈 諛쒗뻾 媛?ν븳 釉붾줈洹?湲 HTML??留뚮뱺??
- 寃곌낵??Orbit ?깆뿉 ?ㅼ떆 ?ｌ쓣 ???덈룄濡?HTML留?源붾걫?섍쾶 異쒕젰?쒕떎.

?낅젰 ?ㅼ젙:
- ?듭떖 ?ㅼ썙?? ${topic || '(keyword empty)'}
- ?뚮옯?? ${platform}
- 湲 ?좏삎: ${payload.contentMode || 'general'}
- 留먰닾: ${payload.toneStyle || '移쒖젅??議대뙎留?}
- H2 ?뚯젣紐??? ${sectionCount}媛??댁쇅
- 紐⑺몴 湲몄씠: ${minChars}???댁긽, ${maxChars}???댄븯
- 李멸퀬 URL:
${references.length ? references.map((url, index) => `  ${index + 1}. ${url}`).join('\n') : '  ?놁쓬'}

?묒뾽 諛⑹떇:
1. 寃???섎룄? ?낆옄 ?섎Ⅴ?뚮굹瑜?癒쇱? 異붾줎?쒕떎.
2. 珥덈컲 3臾몃떒? ?낆옄媛 諛붾줈 ?먭린 ?곹솴?대씪怨??먮겮寃??대떎.
3. H2 援ъ“???낆옄媛 ?뺤씤?댁빞 ???쒖꽌?濡?諛곗튂?쒕떎.
4. ?뺤콉, 吏?먭툑, 媛寃? ?쇱젙泥섎읆 蹂??媛?ν븳 ?댁슜? 怨듭떇 ?뺤씤 ?먮쫫???ｋ뒗??
5. 怨쇱옣, ?뺤젙 ?섏씡, 猷⑤㉧, 異쒖쿂 遺덈챸 ?섏튂, ?먮룞 ?앹꽦 ???섎뒗 臾몄옣???쇳븳??
6. 蹂몃Ц 以묎컙??泥댄겕由ъ뒪?몃굹 鍮꾧탳 ?쒓? ?꾩슂?섎㈃ HTML ?쒕줈 ?ｋ뒗??
7. 留덉?留됱뿉???낆옄媛 ?ㅼ쓬 ?됰룞???뺥븷 ???덈뒗 吏㏃? ?뺣━ 臾몃떒???ｋ뒗??

異쒕젰 洹쒖튃:
- ?ㅻ챸?섏? 留먭퀬 理쒖쥌 HTML留?異쒕젰?쒕떎.
- script, iframe, form, onclick, 異붿쟻 肄붾뱶???ｌ? ?딅뒗??
- ?꾨옒 援ъ“瑜??좎??쒕떎.

<article class="bgpt-wp-ready bgpt-codex-workshop">
  <h1>?쒕ぉ</h1>
  <p>?꾩엯 臾몃떒</p>
  <h2>?뚯젣紐?/h2>
  <p>蹂몃Ц</p>
  <h2>?먯＜ 臾삳뒗 吏덈Ц</h2>
  <h3>吏덈Ц</h3>
  <p>?듬?</p>
  <h2>留덈Т由?/h2>
  <p>?뺣━ 臾몃떒</p>
</article>`;
}

function buildCodexImageTask(payload = {}) {
  const topic = getTopic(payload);
  const platform = normalizePlatformName(payload.targetPlatform || payload.platform);
  const provider = state.activeAgentProvider === 'claude' ? 'claude' : 'codex';
  const agentLabel = provider === 'claude' ? 'Claude Code' : 'Codex';
  const imagePolicy = getPayloadImagePolicy(payload);
  const thumbnailTextIncluded = payload.thumbnailTextIncluded !== false && payload.thumbnailIncludeText !== false;
  const references = getReferenceLines(payload);
  const imageCapabilityNote = provider === 'claude'
    ? '以묒슂: Claude Code?먮뒗 ?먯껜 ?대?吏 ?앹꽦 紐⑤뜽???놁뒿?덈떎. ?ㅼ젣 ?대?吏???깆쓽 ?대?吏 ?붿쭊(GPT Image, Gemini Image, Leonardo, Flow ???쇰줈 蹂꾨룄 ?앹꽦?섍퀬, Claude Code???대?吏 ?꾨＼?꾪듃/援щ룄/alt/?쎌엯 ?꾩튂留??ㅺ퀎?⑸땲??'
    : '以묒슂: Codex???묒뾽 Agent?낅땲?? ?대?吏 ?앹꽦 湲곕뒫???곌껐???섍꼍?먯꽌??GPT Image ??蹂꾨룄 ?대?吏 ?붿쭊?쇰줈 ?앹꽦?섍퀬, 洹몃젃吏 ?딆쑝硫??대?吏 ?꾨＼?꾪듃/援щ룄/alt/?쎌엯 ?꾩튂瑜??ㅺ퀎?⑸땲??';

  return `${agentLabel} ?대?吏 ?묒뾽 吏?쒖꽌

紐⑺몴:
- 湲 二쇱젣??留욌뒗 釉붾줈洹??몃꽕???먮뒗 蹂몃Ц ?대?吏 諛⑺뼢???ㅺ퀎?쒕떎.
- 媛?ν븯硫?16:9 ?몃꽕??1?κ낵 H2蹂??대?吏 ?꾩씠?붿뼱瑜??④퍡 ?뺣━?쒕떎.
- ${imageCapabilityNote}

?낅젰 ?ㅼ젙:
- ?듭떖 ?ㅼ썙?? ${topic || '(keyword empty)'}
- ?뚮옯?? ${platform}
- ?대?吏 ?앹꽦 踰붿쐞: ${describeImagePolicy(imagePolicy)}
- ?몃꽕???띿뒪?? ${thumbnailTextIncluded ? '?ы븿 媛?? ?? 吏㏃? ?쒓뎅???쒕ぉ??臾멸뎄留??ъ슜' : '誘명룷?? ?몃꽕?쇱뿉??湲?먮? ?ｌ? ?딆쓬'}
- ?뚯젣紐??대?吏 ?띿뒪?? ??긽 誘명룷?? H2 ?대?吏??媛꾪뙋, ?먮쭑, 臾멸뎄, 濡쒓퀬, ?뚰꽣留덊겕 ?놁씠 ?λ㈃留??앹꽦
- 李멸퀬 URL:
${references.length ? references.map((url, index) => `  ${index + 1}. ${url}`).join('\n') : '  ?놁쓬'}

?대?吏 諛⑺뼢:
- ?쒓뎅 ?앺솢?뺣낫/?뺤콉??釉붾줈洹몄뿉 ?댁슱由щ뒗 ?꾩떎媛??덈뒗 ?λ㈃
- 諛앷퀬 ?좊챸???鍮?- ?쒕ぉ???뱀쓣 ???덈뒗 ?щ갚 ?뺣낫
- ?뱀젙 釉뚮옖??濡쒓퀬, ?좊챸???쇨뎬, ?ㅽ빐 媛?ν븳 怨듦났湲곌? 吏곸씤 ?쒗쁽 湲덉?
- ?몃꽕???띿뒪??誘명룷???먮뒗 H2 ?대?吏?먯꽌???띿뒪???녿뒗 ?대?吏濡??앹꽦?섍퀬 ?쒕ぉ ?곸뿭留?鍮꾩썙?붾떎.

異쒕젰:
1. ?좏깮???대?吏 ?앹꽦 踰붿쐞??留욌뒗 ?몃꽕??H2 ?대?吏 ?꾨＼?꾪듃
2. H2蹂??대?吏 ?꾩씠?붿뼱. ?좏깮 踰붿쐞 諛?H2??"skip"?쇰줈 ?쒖떆
3. ?몃꽕??臾멸뎄 ?꾨낫 3媛? ?몃꽕???띿뒪??誘명룷?⑥씠硫?鍮?諛곗뿴濡??쒖떆
4. ?ㅼ젣 ?앹꽦???ъ슜??異붿쿇 ?대?吏 ?붿쭊`;
}

function ensureStyles() {
  if ($(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .codex-workshop-entry {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 14px;
      align-items: center;
      margin: -4px 0 16px;
      padding: 14px 16px;
      border: 1px solid rgba(96, 165, 250, 0.34);
      border-radius: 14px;
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(30, 64, 175, 0.28));
      box-shadow: 0 12px 34px rgba(15, 23, 42, 0.18);
    }
    .codex-workshop-entry h4 {
      margin: 0 0 4px;
      color: #f8fafc;
      font-size: 14px;
      font-weight: 900;
    }
    .codex-workshop-entry p {
      margin: 0;
      color: rgba(226, 232, 240, 0.74);
      font-size: 12px;
      line-height: 1.5;
    }
    .codex-workshop-status {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      margin-top: 8px;
      padding: 4px 9px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0;
      border: 1px solid transparent;
    }
    .codex-workshop-status.is-muted {
      color: #cbd5e1;
      background: rgba(148, 163, 184, 0.12);
      border-color: rgba(148, 163, 184, 0.2);
    }
    .codex-workshop-status.is-ready {
      color: #ccfbf1;
      background: rgba(20, 184, 166, 0.14);
      border-color: rgba(45, 212, 191, 0.28);
    }
    .codex-workshop-status.is-locked {
      color: #fed7aa;
      background: rgba(249, 115, 22, 0.12);
      border-color: rgba(251, 146, 60, 0.3);
    }
    .codex-workshop-btn {
      border: 0;
      border-radius: 12px;
      cursor: pointer;
      font-family: inherit;
      font-weight: 900;
      transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
    }
    .codex-workshop-btn:hover {
      transform: translateY(-1px);
      opacity: 0.96;
    }
    .codex-workshop-primary {
      min-height: 46px;
      padding: 12px 18px;
      color: #082f49;
      background: linear-gradient(135deg, #93c5fd, #38bdf8);
      box-shadow: 0 10px 24px rgba(56, 189, 248, 0.24);
      white-space: nowrap;
    }
    .codex-workshop-modal {
      position: fixed;
      inset: 0;
      z-index: 100200;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(2, 6, 23, 0.78);
      backdrop-filter: blur(18px);
    }
    .codex-workshop-modal.is-open {
      display: flex;
    }
    .agent-install-modal {
      position: fixed;
      inset: 0;
      z-index: 100240;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: rgba(2, 6, 23, 0.62);
      backdrop-filter: blur(8px);
    }
    .agent-install-modal.is-open {
      display: flex;
    }
    .agent-install-shell {
      width: min(620px, calc(100vw - 48px));
      border-radius: 18px;
      border: 1px solid rgba(148, 163, 184, 0.22);
      background: linear-gradient(145deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.98));
      box-shadow: 0 24px 70px rgba(2, 6, 23, 0.45);
      overflow: hidden;
    }
    .agent-install-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 18px 20px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.14);
    }
    .agent-install-head strong {
      display: block;
      color: #f8fafc;
      font-size: 17px;
      font-weight: 950;
    }
    .agent-install-head span {
      display: block;
      margin-top: 4px;
      color: rgba(203, 213, 225, 0.72);
      font-size: 12px;
    }
    .agent-install-body {
      display: grid;
      gap: 12px;
      padding: 18px 20px 20px;
    }
    .agent-install-status {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 44px;
      padding: 12px 14px;
      border-radius: 12px;
      color: #bfdbfe;
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.24);
      font-size: 13px;
      font-weight: 850;
    }
    .agent-install-status.is-success {
      color: #bbf7d0;
      background: rgba(6, 78, 59, 0.22);
      border-color: rgba(52, 211, 153, 0.34);
    }
    .agent-install-status.is-error {
      color: #fecaca;
      background: rgba(127, 29, 29, 0.2);
      border-color: rgba(248, 113, 113, 0.32);
    }
    .agent-install-spinner {
      width: 18px;
      height: 18px;
      flex: 0 0 auto;
      border-radius: 999px;
      border: 2px solid rgba(191, 219, 254, 0.26);
      border-top-color: #67e8f9;
      animation: agentInstallSpin 0.8s linear infinite;
    }
    .agent-install-status.is-success .agent-install-spinner,
    .agent-install-status.is-error .agent-install-spinner {
      display: none;
    }
    .agent-install-output {
      max-height: 230px;
      overflow: auto;
      margin: 0;
      padding: 12px;
      border-radius: 12px;
      white-space: pre-wrap;
      word-break: break-word;
      color: rgba(226, 232, 240, 0.78);
      background: rgba(2, 6, 23, 0.48);
      border: 1px solid rgba(148, 163, 184, 0.12);
      font-size: 11px;
      line-height: 1.55;
    }
    .agent-install-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .agent-install-actions button {
      min-height: 36px;
      padding: 8px 14px;
      border: 0;
      border-radius: 10px;
      cursor: pointer;
      color: #082f49;
      background: linear-gradient(135deg, #bae6fd, #67e8f9);
      font-size: 12px;
      font-weight: 900;
    }
    @keyframes agentInstallSpin {
      to { transform: rotate(360deg); }
    }
    .codex-workshop-shell {
      width: min(1180px, 96vw);
      max-height: 92vh;
      overflow: hidden;
      border-radius: 20px;
      background: #0f172a;
      border: 1px solid rgba(148, 163, 184, 0.24);
      box-shadow: 0 26px 80px rgba(0, 0, 0, 0.55);
      color: #e2e8f0;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
    }
    .codex-workshop-head {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 22px 24px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.18);
      background: linear-gradient(135deg, rgba(56, 189, 248, 0.14), rgba(99, 102, 241, 0.1));
    }
    .codex-workshop-head h3 {
      margin: 0;
      color: #f8fafc;
      font-size: 22px;
      line-height: 1.25;
      font-weight: 950;
      letter-spacing: 0;
    }
    .codex-workshop-head p {
      margin: 8px 0 0;
      color: rgba(226, 232, 240, 0.74);
      font-size: 13px;
      line-height: 1.55;
    }
    .codex-workshop-close {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      border: 1px solid rgba(148, 163, 184, 0.24);
      color: #e2e8f0;
      background: rgba(15, 23, 42, 0.9);
      cursor: pointer;
      font-size: 18px;
      font-weight: 900;
    }
    .codex-workshop-body {
      overflow: auto;
      padding: 20px 24px 24px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(320px, 0.72fr);
      gap: 18px;
    }
    .codex-workshop-panel {
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.72);
      padding: 16px;
    }
    .codex-workshop-panel h4 {
      margin: 0 0 10px;
      color: #f8fafc;
      font-size: 14px;
      font-weight: 900;
    }
    .codex-workshop-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .codex-workshop-secondary {
      min-height: 40px;
      padding: 10px 14px;
      color: #e2e8f0;
      background: rgba(51, 65, 85, 0.86);
      border: 1px solid rgba(148, 163, 184, 0.2);
    }
    .codex-workshop-success {
      min-height: 42px;
      padding: 11px 16px;
      color: #082f49;
      background: linear-gradient(135deg, #bae6fd, #67e8f9);
      box-shadow: 0 10px 24px rgba(6, 182, 212, 0.22);
    }
    .codex-workshop-textarea {
      width: 100%;
      min-height: 210px;
      resize: vertical;
      box-sizing: border-box;
      padding: 14px;
      border-radius: 12px;
      border: 1px solid rgba(148, 163, 184, 0.2);
      background: rgba(2, 6, 23, 0.68);
      color: #e2e8f0;
      font-family: Consolas, 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.55;
      outline: none;
    }
    .codex-workshop-textarea:focus {
      border-color: rgba(56, 189, 248, 0.58);
      box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.12);
    }
    .codex-workshop-paste {
      min-height: 470px;
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
    }
    .codex-workshop-note {
      margin-top: 12px;
      padding: 12px;
      border-radius: 12px;
      background: rgba(59, 130, 246, 0.09);
      border: 1px solid rgba(59, 130, 246, 0.22);
      color: rgba(191, 219, 254, 0.9);
      font-size: 12px;
      line-height: 1.55;
    }
    .codex-workshop-agent-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-top: 10px;
    }
    .codex-workshop-agent-card {
      min-height: 84px;
      padding: 12px;
      border-radius: 12px;
      border: 1px solid rgba(148, 163, 184, 0.18);
      background: rgba(2, 6, 23, 0.32);
    }
    .codex-workshop-agent-card strong {
      display: block;
      color: #f8fafc;
      font-size: 13px;
      margin-bottom: 4px;
    }
    .codex-workshop-agent-card span {
      display: block;
      color: rgba(226, 232, 240, 0.72);
      font-size: 12px;
      line-height: 1.45;
    }
    .codex-workshop-code {
      min-height: 80px;
      font-family: Consolas, 'Courier New', monospace;
      font-size: 12px;
    }
    .codex-workshop-select {
      width: 100%;
      min-height: 42px;
      box-sizing: border-box;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid rgba(148, 163, 184, 0.24);
      background: rgba(2, 6, 23, 0.68);
      color: #e2e8f0;
      font-family: inherit;
      font-size: 13px;
      outline: none;
    }
    .codex-workshop-select:focus {
      border-color: rgba(56, 189, 248, 0.58);
      box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.12);
    }
    .agent-mode-settings {
      margin: 0 0 24px;
      width: 100%;
      box-sizing: border-box;
      padding: 24px;
      border-radius: 16px;
      border: 1px solid rgba(56, 189, 248, 0.2);
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(30, 41, 59, 0.82));
      box-shadow: 0 18px 42px rgba(2, 6, 23, 0.18);
      color: #e2e8f0;
    }
    .agent-mode-settings-compact {
      margin: 0 0 16px;
      padding: 16px 18px;
      border-radius: 14px;
      box-shadow: none;
    }
    .agent-mode-settings-compact #apiExecutionPanel {
      display: none !important;
    }
    .agent-mode-settings-compact .agent-mode-summary {
      margin: 10px 0 0;
    }
    .agent-mode-settings-compact .agent-mode-mode-switch {
      max-width: 420px;
      margin: 12px 0 0;
    }
    .agent-mode-settings-compact #agentExecutionPanel {
      margin-top: 14px;
    }
    .agent-mode-settings-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 14px;
    }
    .agent-mode-eyebrow {
      color: #67e8f9;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0;
      margin-bottom: 4px;
    }
    .agent-mode-settings h3 {
      margin: 0;
      color: #f8fafc;
      font-size: 18px;
      font-weight: 900;
    }
    .agent-mode-settings p,
    .agent-mode-profile-box span,
    .agent-mode-footnote {
      margin: 6px 0 0;
      color: rgba(226, 232, 240, 0.68);
      font-size: 12px;
      line-height: 1.55;
    }
    .agent-mode-pill {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 6px 10px;
      border-radius: 999px;
      white-space: nowrap;
      color: #dbeafe;
      background: rgba(59, 130, 246, 0.12);
      border: 1px solid rgba(59, 130, 246, 0.24);
      font-size: 12px;
      font-weight: 900;
    }
    .agent-mode-pill.is-ready {
      color: #bbf7d0;
      background: rgba(34, 197, 94, 0.12);
      border-color: rgba(34, 197, 94, 0.28);
    }
    .agent-mode-pill.is-locked {
      color: #fed7aa;
      background: rgba(249, 115, 22, 0.12);
      border-color: rgba(249, 115, 22, 0.26);
    }
    .agent-mode-summary {
      margin-bottom: 12px;
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(2, 6, 23, 0.34);
      color: rgba(226, 232, 240, 0.82);
      font-size: 12px;
      font-weight: 700;
    }
    .agent-mode-mode-switch,
    .agent-provider-tabs {
      display: flex;
      gap: 8px;
      padding: 4px;
      margin: 14px 0;
      border-radius: 12px;
      background: rgba(2, 6, 23, 0.36);
      border: 1px solid rgba(148, 163, 184, 0.14);
    }
    .agent-mode-choice,
    .agent-provider-tab {
      flex: 1;
      min-height: 40px;
      border: 0;
      border-radius: 9px;
      cursor: pointer;
      color: rgba(226, 232, 240, 0.72);
      background: transparent;
      font-size: 13px;
      font-weight: 900;
    }
    .agent-mode-choice.is-active,
    .agent-provider-tab.is-active {
      color: #082f49;
      background: linear-gradient(135deg, #bae6fd, #67e8f9);
      box-shadow: 0 8px 22px rgba(6, 182, 212, 0.18);
    }
    .agent-mode-dual-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      align-items: start;
    }
    .agent-mode-dual-grid.is-agent-mode,
    .agent-mode-dual-grid.is-api-mode {
      grid-template-columns: minmax(0, 1fr);
    }
    .agent-mode-dual-grid.is-agent-mode .agent-mode-execution-panel,
    .agent-mode-dual-grid.is-api-mode .agent-mode-execution-panel {
      grid-column: 1 / -1;
    }
    .agent-mode-execution-panel {
      border: 1px solid rgba(148, 163, 184, 0.16);
      border-radius: 16px;
      background: rgba(2, 6, 23, 0.24);
      padding: 18px;
      transition: opacity 0.2s ease, filter 0.2s ease;
    }
    .agent-mode-execution-panel.is-disabled {
      opacity: 0.45;
      filter: grayscale(0.35);
    }
    .agent-mode-panel-title {
      margin-bottom: 12px;
    }
    .agent-mode-panel-title strong {
      display: block;
      color: #f8fafc;
      font-size: 14px;
      margin-bottom: 4px;
    }
    .agent-mode-panel-title span {
      color: rgba(226, 232, 240, 0.64);
      font-size: 12px;
      line-height: 1.5;
    }
    .agent-mode-tool-row,
    .agent-mode-usage-grid,
    .agent-mode-control-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .agent-mode-tool-row {
      grid-template-columns: repeat(2, minmax(180px, 240px));
      margin-bottom: 14px;
    }
    .agent-mode-mini-card {
      padding: 12px;
      border-radius: 12px;
      border: 1px solid rgba(148, 163, 184, 0.16);
      background: rgba(2, 6, 23, 0.28);
    }
    .agent-mode-mini-card strong,
    .agent-mode-profile-box strong,
    .agent-mode-usage-head strong {
      display: block;
      color: #f8fafc;
      font-size: 13px;
      margin-bottom: 4px;
    }
    .agent-mode-mini-card span {
      color: rgba(226, 232, 240, 0.72);
      font-size: 12px;
    }
    .agent-mode-usage-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin: 16px 0 10px;
    }
    .agent-mode-usage-head span {
      color: rgba(186, 230, 253, 0.86);
      font-size: 12px;
      font-weight: 800;
    }
    .agent-mode-control-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      margin-top: 12px;
    }
    .agent-mode-control-grid label {
      display: grid;
      gap: 6px;
      color: rgba(226, 232, 240, 0.72);
      font-size: 12px;
      font-weight: 800;
    }
    .agent-mode-control-grid input,
    .agent-mode-control-grid select {
      width: 100%;
      min-height: 38px;
      box-sizing: border-box;
      padding: 8px 10px;
      border-radius: 10px;
      border: 1px solid rgba(148, 163, 184, 0.24);
      background: rgba(2, 6, 23, 0.62);
      color: #e2e8f0;
      outline: none;
    }
    .agent-mode-provider-list {
      display: grid;
      gap: 10px;
      margin-top: 12px;
    }
    .agent-mode-provider-card {
      padding: 18px;
      border-radius: 16px;
      border: 1px solid rgba(148, 163, 184, 0.16);
      background: rgba(15, 23, 42, 0.46);
    }
    .agent-mode-provider-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }
    .agent-mode-provider-top strong {
      display: block;
      color: #f8fafc;
      font-size: 15px;
      margin-bottom: 4px;
    }
    .agent-mode-provider-top span,
    .agent-mode-plan-grid span {
      color: rgba(226, 232, 240, 0.68);
      font-size: 12px;
      line-height: 1.45;
    }
    .agent-mode-provider-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 248px;
      gap: 18px;
      align-items: start;
    }
    .agent-mode-provider-main {
      min-width: 0;
    }
    .agent-mode-plan-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 14px;
    }
    .agent-mode-plan-grid > div {
      min-height: 72px;
      padding: 12px;
      border-radius: 12px;
      background: rgba(2, 6, 23, 0.28);
      border: 1px solid rgba(148, 163, 184, 0.12);
    }
    .agent-mode-plan-grid strong {
      display: block;
      color: #f8fafc;
      font-size: 12px;
      margin-bottom: 3px;
    }
    .agent-mode-measure {
      display: grid;
      gap: 10px;
      margin: 12px 0 0;
      padding: 14px;
      border-radius: 14px;
      background: rgba(2, 6, 23, 0.22);
      border: 1px solid rgba(148, 163, 184, 0.1);
    }
    .agent-mode-gauge {
      height: 9px;
      border-radius: 999px;
      overflow: hidden;
      background: rgba(15, 23, 42, 0.88);
      border: 1px solid rgba(148, 163, 184, 0.1);
    }
    .agent-mode-gauge span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #22c55e, #38bdf8);
    }
    .agent-mode-gauge.is-unknown span {
      width: 100% !important;
      background: repeating-linear-gradient(135deg, rgba(148, 163, 184, 0.3) 0 8px, rgba(71, 85, 105, 0.3) 8px 16px);
    }
    .agent-mode-measure p {
      margin: 0;
      color: rgba(226, 232, 240, 0.66);
      font-size: 12px;
      line-height: 1.5;
    }
    .agent-mode-action-panel {
      display: grid;
      gap: 10px;
      padding: 14px;
      border-radius: 14px;
      background: rgba(2, 6, 23, 0.26);
      border: 1px solid rgba(148, 163, 184, 0.14);
    }
    .agent-mode-action-panel > strong {
      color: #f8fafc;
      font-size: 13px;
      font-weight: 900;
    }
    .agent-mode-action-panel button {
      width: 100%;
      min-height: 38px;
      padding: 9px 12px;
      border-radius: 10px;
      border: 1px solid rgba(148, 163, 184, 0.18);
      cursor: pointer;
      color: #e2e8f0;
      background: rgba(51, 65, 85, 0.72);
      font-size: 12px;
      font-weight: 900;
      text-align: center;
    }
    .agent-mode-action-panel .agent-mode-primary-action {
      color: #082f49;
      border-color: transparent;
      background: linear-gradient(135deg, #bae6fd, #67e8f9);
      box-shadow: 0 8px 18px rgba(6, 182, 212, 0.14);
    }
    .agent-mode-link-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      padding-top: 4px;
      border-top: 1px solid rgba(148, 163, 184, 0.12);
    }
    .agent-mode-link-grid button {
      min-height: 34px;
      padding: 7px 8px;
      font-size: 11px;
      background: rgba(15, 23, 42, 0.58);
    }
    .agent-image-policy-panel {
      display: grid;
      gap: 12px;
      margin-top: 14px;
      padding: 14px;
      border-radius: 14px;
      background: rgba(2, 6, 23, 0.24);
      border: 1px solid rgba(56, 189, 248, 0.18);
    }
    .agent-image-policy-panel.is-disabled {
      opacity: 0.72;
    }
    .agent-image-policy-head,
    .agent-thumb-text-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .agent-image-policy-head strong,
    .agent-thumb-text-row strong {
      display: block;
      color: #f8fafc;
      font-size: 13px;
      font-weight: 900;
      margin-bottom: 4px;
    }
    .agent-image-policy-head span,
    .agent-thumb-text-row span,
    .agent-image-policy-grid button span {
      display: block;
      color: rgba(226, 232, 240, 0.66);
      font-size: 12px;
      line-height: 1.45;
    }
    .agent-image-policy-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 8px;
    }
    .agent-image-policy-grid button,
    .agent-thumb-text-toggle button {
      min-height: 54px;
      padding: 10px;
      border-radius: 11px;
      border: 1px solid rgba(148, 163, 184, 0.16);
      cursor: pointer;
      text-align: left;
      color: rgba(226, 232, 240, 0.78);
      background: rgba(15, 23, 42, 0.58);
      font-family: inherit;
    }
    .agent-image-policy-grid button strong {
      display: block;
      color: #e2e8f0;
      font-size: 12px;
      font-weight: 900;
      margin-bottom: 4px;
    }
    .agent-image-policy-grid button.is-active,
    .agent-thumb-text-toggle button.is-active {
      color: #082f49;
      border-color: transparent;
      background: linear-gradient(135deg, #bae6fd, #67e8f9);
      box-shadow: 0 8px 18px rgba(6, 182, 212, 0.14);
    }
    .agent-image-policy-grid button.is-active strong,
    .agent-image-policy-grid button.is-active span,
    .agent-thumb-text-toggle button.is-active {
      color: #082f49;
    }
    .agent-image-policy-grid button:disabled,
    .agent-thumb-text-toggle button:disabled {
      cursor: not-allowed;
      opacity: 0.58;
    }
    .agent-thumb-text-toggle {
      display: grid;
      grid-template-columns: repeat(2, minmax(76px, 1fr));
      gap: 8px;
      min-width: 170px;
    }
    .agent-thumb-text-toggle button {
      min-height: 38px;
      text-align: center;
      font-weight: 900;
    }
    .agent-mode-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }
    .agent-mode-actions button {
      min-height: 36px;
      padding: 8px 12px;
      border: 0;
      border-radius: 10px;
      cursor: pointer;
      color: #082f49;
      background: linear-gradient(135deg, #bae6fd, #67e8f9);
      font-size: 12px;
      font-weight: 900;
    }
    .agent-mode-actions button:nth-child(2n) {
      color: #e2e8f0;
      background: rgba(51, 65, 85, 0.86);
      border: 1px solid rgba(148, 163, 184, 0.18);
    }
    .agent-mode-actions button:disabled,
    .agent-mode-choice:disabled,
    .agent-provider-tab:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      filter: grayscale(0.35);
    }
    .agent-mode-maintenance-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 14px;
    }
    .agent-mode-maintenance-actions button {
      min-height: 34px;
      padding: 7px 11px;
      border-radius: 9px;
      border: 1px solid rgba(148, 163, 184, 0.16);
      color: rgba(226, 232, 240, 0.76);
      background: rgba(15, 23, 42, 0.5);
      font-size: 11px;
      font-weight: 800;
      cursor: pointer;
    }
    .agent-mode-profile-box {
      margin-top: 16px;
      padding: 14px;
      border-radius: 14px;
      border: 1px solid rgba(148, 163, 184, 0.16);
      background: rgba(2, 6, 23, 0.24);
    }
    .agent-mode-profile-box select {
      margin-top: 12px;
    }
    .agent-mode-profile-box textarea {
      margin-top: 12px;
      min-height: 74px;
    }
    .agent-mode-footnote {
      margin-top: 12px;
    }
    @media (max-width: 900px) {
      .codex-workshop-entry,
      .codex-workshop-body,
      .codex-workshop-agent-grid,
      .agent-mode-dual-grid,
      .agent-mode-tool-row,
      .agent-mode-usage-grid,
      .agent-mode-control-grid,
      .agent-mode-provider-layout,
      .agent-mode-plan-grid,
      .agent-image-policy-grid {
        grid-template-columns: 1fr;
      }
      .agent-mode-settings-head,
      .agent-mode-usage-head,
      .agent-image-policy-head,
      .agent-thumb-text-row {
        align-items: stretch;
        flex-direction: column;
      }
      .codex-workshop-primary {
        width: 100%;
      }
      .codex-workshop-paste {
        min-height: 280px;
      }
    }
  `;
  document.head.appendChild(style);
}

function ensureEntryButton() {
  $(ENTRY_ID)?.remove();
  return;

  if ($(ENTRY_ID)) return;

  const publishBtn = $('publishBtn');
  const actionRow = publishBtn?.parentElement;
  if (!actionRow) return;

  const entry = document.createElement('div');
  entry.id = ENTRY_ID;
  entry.className = 'codex-workshop-entry';
  entry.innerHTML = `
    <div>
      <h4>Max Agent Mode</h4>
      <p>3媛쒖썡 ?댁긽 肄붾뱶??Codex/Claude 援щ룆 怨꾩젙 ?묒뾽?ㅼ쓣 ?닿퀬, 1媛쒖썡 肄붾뱶??湲곗〈 API ???앹꽦 ?먮쫫???좎??⑸땲??</p>
      <div id="${ENTRY_STATUS_ID}" class="codex-workshop-status is-muted">?쇱씠?좎뒪 ?곹깭 ?뺤씤 以?..</div>
    </div>
    <button type="button" class="codex-workshop-btn codex-workshop-primary" id="openCodexWorkshopBtn">?곹깭 ?뺤씤 以?/button>
  `;

  actionRow.insertAdjacentElement('afterend', entry);
  $('openCodexWorkshopBtn')?.addEventListener('click', openCodexWorkshopPanel);
  loadAgentModeStatus(true);
}

function ensureModal() {
  if ($(MODAL_ID)) return $(MODAL_ID);

  const modal = document.createElement('div');
  modal.id = MODAL_ID;
  modal.className = 'codex-workshop-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `
    <div class="codex-workshop-shell">
      <div class="codex-workshop-head">
        <div>
          <h3 id="codexWorkshopTitle">Agent ?묒뾽??/h3>
          <p id="codexWorkshopSubtitle">?좏깮??Agent媛 湲 援ъ“, ?대?吏 諛⑺뼢, ?덉쭏 湲곗?????踰덉뿉 ?댄빐?섎룄濡??꾩옱 ???ㅼ젙???묒뾽 ?⑥쐞濡??뺣━?⑸땲??</p>
        </div>
        <button type="button" class="codex-workshop-close" id="closeCodexWorkshopBtn" aria-label="?リ린">X</button>
      </div>
      <div class="codex-workshop-body">
        <div style="display:grid;gap:16px;">
          <section class="codex-workshop-panel">
            <h4>1. 湲 ?묒뾽吏?쒖꽌</h4>
            <div class="codex-workshop-actions">
              <button type="button" class="codex-workshop-btn codex-workshop-success" id="copyCodexArticleTaskBtn">湲 吏?쒖꽌 蹂듭궗</button>
            </div>
            <textarea id="codexArticleTask" class="codex-workshop-textarea" readonly></textarea>
          </section>
          <section class="codex-workshop-panel">
            <h4>2. ?대?吏 ?묒뾽吏?쒖꽌</h4>
            <div class="codex-workshop-actions">
              <button type="button" class="codex-workshop-btn codex-workshop-secondary" id="copyCodexImageTaskBtn">?대?吏 吏?쒖꽌 蹂듭궗</button>
            </div>
            <textarea id="codexImageTask" class="codex-workshop-textarea" readonly></textarea>
          </section>
        </div>
        <div style="display:grid;gap:16px;">
          <section class="codex-workshop-panel">
            <h4>Max Agent 怨꾩젙</h4>
            <div id="${AGENT_STATUS_ID}" class="codex-workshop-note">Agent Mode ?곹깭瑜??뺤씤 以묒엯?덈떎.</div>
            <select id="${AGENT_PROFILE_SELECT_ID}" class="codex-workshop-select" style="display:none;">
              <option value="">怨꾩젙 以鍮?以?/option>
            </select>
            <div class="codex-workshop-actions" style="margin-top:12px;">
              <button type="button" class="codex-workshop-btn codex-workshop-secondary" id="startCodexAgentLoginBtn">濡쒓렇??李??닿린</button>
              <button type="button" class="codex-workshop-btn codex-workshop-success" id="${RUN_AGENT_JOB_BTN_ID}">?좏깮 Agent濡??앹꽦</button>
            </div>
            <textarea id="${AGENT_LOGIN_COMMAND_ID}" class="codex-workshop-textarea codex-workshop-code" style="display:none;" readonly></textarea>
            <div id="${AGENT_RUN_STATUS_ID}" class="codex-workshop-note" style="display:none;"></div>
          </section>
          <section class="codex-workshop-panel">
            <h4>3. Codex ?곗텧臾??곸슜</h4>
            <textarea id="codexResultPaste" class="codex-workshop-textarea codex-workshop-paste" placeholder="Codex媛 留뚮뱺 理쒖쥌 HTML???ш린??遺숈뿬?ｌ쑝?몄슂."></textarea>
            <div class="codex-workshop-actions" style="margin-top:12px;margin-bottom:0;">
              <button type="button" class="codex-workshop-btn codex-workshop-success" id="applyCodexResultBtn">誘몃━蹂닿린濡??곸슜</button>
              <button type="button" class="codex-workshop-btn codex-workshop-secondary" id="clearCodexResultBtn">?댁슜 鍮꾩슦湲?/button>
            </div>
          </section>
          <section class="codex-workshop-panel">
            <h4>?댁쁺 ?ㅺ퀎</h4>
            <div class="codex-workshop-note">
              ?ㅼ쓬 ?④퀎?먯꽌??Codex CLI ?먮뒗 Codex app-server瑜?Electron 諛깆뿏?쒖뿉 ?곌껐???묒뾽吏?쒖꽌 ?앹꽦 ???곗텧臾??뚯씪???먮룞?쇰줈 ?뚯닔?섎뒗 援ъ“濡??뺤옣?????덉뒿?덈떎.
            </div>
          </section>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  $('closeCodexWorkshopBtn')?.addEventListener('click', closeCodexWorkshopPanel);
  $('copyCodexArticleTaskBtn')?.addEventListener('click', () => copyText(state.articleTask, '湲 ?묒뾽吏?쒖꽌'));
  $('copyCodexImageTaskBtn')?.addEventListener('click', () => copyText(state.imageTask, '?대?吏 ?묒뾽吏?쒖꽌'));
  $('applyCodexResultBtn')?.addEventListener('click', applyCodexResult);
  $('clearCodexResultBtn')?.addEventListener('click', () => { const el = $('codexResultPaste'); if (el) el.value = ''; });
  $('startCodexAgentLoginBtn')?.addEventListener('click', () => startAgentLogin(
    state.activeAgentProvider,
    $(AGENT_PROFILE_SELECT_ID)?.value?.trim() || '',
  ));
  $('codexAgentProfileSelect')?.addEventListener('change', () => {
    const selectedProfileId = $(AGENT_PROFILE_SELECT_ID)?.value?.trim() || '';
    if (selectedProfileId) {
      setActiveAgentProfile(state.activeAgentProvider, selectedProfileId);
      syncAgentProfileSelectValues(state.activeAgentProvider, selectedProfileId);
      const command = state.agentStatus?.profiles?.find((profile) => profile.id === selectedProfileId)?.loginCommand || '';
      const modalCommandEl = $(AGENT_LOGIN_COMMAND_ID);
      if (modalCommandEl && command) {
        modalCommandEl.value = command;
      }
    }
  });
  $(RUN_AGENT_JOB_BTN_ID)?.addEventListener('click', runAgentJobFromModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeCodexWorkshopPanel();
  });

  return modal;
}

function renderToolStatus(tool, label) {
  if (!tool) return `${label}: ?뺤씤 ??;
  if (tool.installed && tool.usable === false) return `${label}: ?ㅽ뻾 沅뚰븳 ?뺤씤 ?꾩슂`;
  if (tool.installed) return `${label}: ?ㅼ튂??;
  return `${label}: 誘멸컧吏`;
}

function renderProfileSummary(profiles = []) {
  if (!profiles.length) {
    return '<span>?꾩쭅 濡쒓렇??怨꾩젙???놁뒿?덈떎. 濡쒓렇??李??닿린瑜?癒쇱? ?뚮윭二쇱꽭??</span>';
  }

  return profiles
    .map((profile) => `<span>${escapeHtml(profile.label)} 쨌 ${escapeHtml(profile.provider)} 쨌 ${escapeHtml(getProviderLoginLabel(profile.provider, profile))}</span>`)
    .join('');
}

function renderAgentProfileSelect() {
  const select = $(AGENT_PROFILE_SELECT_ID);
  if (!select) return;

  const profiles = (Array.isArray(state.agentStatus?.profiles) ? state.agentStatus.profiles : [])
    .filter((profile) => profile.provider === state.activeAgentProvider);
  const previous = select.value;

  if (!profiles.length) {
    select.innerHTML = `<option value="">${state.activeAgentProvider === 'claude' ? 'Claude' : 'Codex'} 怨꾩젙 以鍮?以?/option>`;
    select.disabled = true;
    return;
  }

  select.disabled = false;
  select.innerHTML = profiles
    .map((profile) => {
      const label = `${profile.provider === 'claude' ? 'Claude' : 'Codex'} 쨌 ${profile.label} 쨌 ${getProviderLoginLabel(profile.provider, profile)}`;
      return `<option value="${escapeHtml(profile.id)}">${escapeHtml(label)}</option>`;
    })
    .join('');

  if (previous && profiles.some((profile) => profile.id === previous)) {
    select.value = previous;
    setActiveAgentProfile(state.activeAgentProvider, previous);
    syncAgentProfileSelectValues(state.activeAgentProvider, previous);
    return;
  }

  const activeProfile = getActiveAgentProfile(state.activeAgentProvider);
  if (activeProfile && profiles.some((profile) => profile.id === activeProfile.id)) {
    select.value = activeProfile.id;
    setActiveAgentProfile(state.activeAgentProvider, activeProfile.id);
    syncAgentProfileSelectValues(state.activeAgentProvider, activeProfile.id);
  }
}

function getSelectedAgentProfile() {
  const profiles = Array.isArray(state.agentStatus?.profiles) ? state.agentStatus.profiles : [];
  const provider = state.activeAgentProvider || 'codex';
  const uiProfile = getSelectedProfileByUi(provider);
  if (uiProfile) {
    setActiveAgentProfile(provider, uiProfile.id);
    return uiProfile;
  }

  const activeProfile = getActiveAgentProfile(provider);
  if (activeProfile) {
    setActiveAgentProfile(provider, activeProfile.id);
    return activeProfile;
  }

  return profiles.find((profile) => profile.provider === provider) || null;
}

function setAgentRunStatus(message, type = 'info') {
  const el = $(AGENT_RUN_STATUS_ID);
  if (!el) return;
  el.style.display = message ? 'block' : 'none';
  el.style.borderColor = type === 'error' ? 'rgba(248, 113, 113, 0.35)' : 'rgba(59, 130, 246, 0.22)';
  el.style.background = type === 'error' ? 'rgba(127, 29, 29, 0.18)' : 'rgba(59, 130, 246, 0.09)';
  el.style.color = type === 'error' ? '#fecaca' : 'rgba(191, 219, 254, 0.9)';
  el.textContent = message || '';
}

function renderAgentStatusPanel() {
  const panel = $(AGENT_STATUS_ID);
  if (!panel) return;

  const status = state.agentStatus;
  if (!status) {
    panel.innerHTML = 'Agent Mode ?곹깭瑜??뺤씤 以묒엯?덈떎.';
    return;
  }

  const codexTool = renderToolStatus(status.tools?.codex, 'Codex');
  const claudeTool = renderToolStatus(status.tools?.claude, 'Claude');
  const modeLabel = isMaxAgentAllowed(status) ? 'Max Agent Mode' : 'API ??紐⑤뱶';
  const modeClass = isMaxAgentAllowed(status) ? 'is-ready' : 'is-locked';

  panel.innerHTML = `
    <div class="codex-workshop-status ${modeClass}" style="margin-top:0;">${escapeHtml(modeLabel)}</div>
    <div class="codex-workshop-agent-grid">
      <div class="codex-workshop-agent-card">
        <strong>?쇱씠?좎뒪</strong>
        <span>?꾩옱: ${escapeHtml(status.currentName || '?뺤씤 ?ㅽ뙣')}</span>
        <span>Max 湲곗?: ${escapeHtml(status.requiredName || '?ㅽ깲?ㅻ뱶 (3媛쒖썡)')}</span>
      </div>
      <div class="codex-workshop-agent-card">
        <strong>?꾧뎄 媛먯?</strong>
        <span>${escapeHtml(codexTool)}</span>
        <span>${escapeHtml(claudeTool)}</span>
      </div>
    </div>
  `;
  renderAgentProfileSelect();
}

async function createAgentProfile(provider) {
  const status = await loadAgentModeStatus(true);
  if (!isMaxAgentAllowed(status)) {
    alert(status?.message || 'Max Agent Mode??3媛쒖썡 ?댁긽 肄붾뱶?먯꽌 ?ъ슜?????덉뒿?덈떎.');
    return null;
  }

  const api = getBridgeApi();
  try {
    const payload = {
      provider,
      authMode: 'subscription',
      label: provider === 'claude' ? 'Claude 援щ룆 怨꾩젙' : 'Codex 援щ룆 怨꾩젙',
    };
    const result = typeof api?.createAgentProfile === 'function'
      ? await api.createAgentProfile(payload)
      : await api?.invoke?.('agent-mode:create-profile', payload);

    if (!result?.ok) {
      alert(result?.error || 'Agent 怨꾩젙 以鍮꾩뿉 ?ㅽ뙣?덉뒿?덈떎.');
      return null;
    }

    state.agentStatus = {
      ...status,
      profiles: result.profiles || status.profiles || [],
    };
    renderEntryStatus();
    renderAgentStatusPanel();
    renderAgentSettingsSection();

    const commandEl = $(AGENT_LOGIN_COMMAND_ID);
    if (commandEl) commandEl.value = result.profile?.loginCommand || '';
    const select = $(AGENT_PROFILE_SELECT_ID);
    if (select && result.profile?.id) select.value = result.profile.id;
    const settingsCommandEl = $('agentModeSettingsLoginCommand');
    if (settingsCommandEl) settingsCommandEl.value = result.profile?.loginCommand || '';
    const settingsSelect = $('agentModeSettingsProfileSelect');
    if (settingsSelect && result.profile?.id) {
      setActiveAgentProfile(provider, result.profile.id);
      settingsSelect.value = result.profile.id;
      renderSettingsProfileSelect();
    }
    const modalSelect = $(AGENT_PROFILE_SELECT_ID);
    if (modalSelect && result.profile?.id) {
      setActiveAgentProfile(provider, result.profile.id);
      modalSelect.value = result.profile.id;
      renderAgentProfileSelect();
    }
    setSettingsStatus(`${provider === 'claude' ? 'Claude' : 'Codex'} 怨꾩젙 以鍮꾧? ?앸궗?듬땲?? 濡쒓렇??李쎌뿉??援щ룆 怨꾩젙?쇰줈 濡쒓렇?명븯?몄슂.`);
    addLog(`${provider === 'claude' ? 'Claude' : 'Codex'} 怨꾩젙 以鍮꾧? ?앸궗?듬땲?? 濡쒓렇??李쎌뿉??怨듭떇 濡쒓렇?몄쓣 吏꾪뻾?섏꽭??`, 'success');
    return result.profile || null;
  } catch (error) {
    console.error('[CODEX-WORKSHOP] create agent profile failed:', error);
    alert(`Agent 怨꾩젙 以鍮꾩뿉 ?ㅽ뙣?덉뒿?덈떎: ${error?.message || error}`);
    setSettingsStatus(`Agent 怨꾩젙 以鍮??ㅽ뙣: ${error?.message || error}`, 'error');
    return null;
  }
}

function applyAgentLoginStatus(result) {
  if (!result?.ok) return;
  state.agentStatus = {
    ...(state.agentStatus || {}),
    profiles: Array.isArray(result.profiles) ? result.profiles : (state.agentStatus?.profiles || []),
  };
  renderEntryStatus();
  renderAgentStatusPanel();
  renderAgentSettingsSection();
}

function stopAgentLoginPolling() {
  if (state.loginPollTimer) {
    clearInterval(state.loginPollTimer);
    state.loginPollTimer = null;
  }
}

async function checkAgentLoginStatus(provider = state.activeAgentProvider, profileId = '') {
  const normalizedProvider = provider === 'claude' ? 'claude' : 'codex';
  const api = getBridgeApi();
  const payload = { id: profileId || undefined, provider: normalizedProvider };
  const result = typeof api?.checkAgentLogin === 'function'
    ? await api.checkAgentLogin(payload)
    : await api?.invoke?.('agent-mode:check-login', payload);

  applyAgentLoginStatus(result);
  return result || { ok: false, ready: false };
}

function startAgentLoginPolling(provider = state.activeAgentProvider, profileId = '') {
  const normalizedProvider = provider === 'claude' ? 'claude' : 'codex';
  const label = normalizedProvider === 'claude' ? 'Claude Code' : 'Codex';
  stopAgentLoginPolling();
  state.loginPollStartedAt = Date.now();

  const tick = async () => {
    try {
      const result = await checkAgentLoginStatus(normalizedProvider, profileId);
      if (result?.ready) {
        stopAgentLoginPolling();
        setSettingsStatus(`${label} 濡쒓렇???꾨즺瑜??뺤씤?덉뒿?덈떎. ?댁젣 Agent 紐⑤뱶?먯꽌 ?ъ슜?????덉뒿?덈떎.`, 'success');
        addLog(`${label} 濡쒓렇???꾨즺媛 ?먮룞 ?뺤씤?섏뿀?듬땲??`, 'success');
        return;
      }

      if (Date.now() - state.loginPollStartedAt > 5 * 60 * 1000) {
        stopAgentLoginPolling();
        setSettingsStatus(`${label} 濡쒓렇???꾨즺瑜??꾩쭅 ?뺤씤?섏? 紐삵뻽?듬땲?? 釉뚮씪?곗? 濡쒓렇?몄씠 ?앸궗?ㅻ㈃ ?곹깭 ?덈줈怨좎묠????踰??뚮윭二쇱꽭??`, 'error');
      }
    } catch (error) {
      console.warn('[CODEX-WORKSHOP] login polling failed:', error);
    }
  };

  tick();
  state.loginPollTimer = setInterval(tick, 3000);
}

async function installAgentTool(provider = state.activeAgentProvider, triggerButton = null) {
  const normalizedProvider = provider === 'claude' ? 'claude' : 'codex';
  const label = normalizedProvider === 'claude' ? 'Claude Code' : 'Codex';
  const api = getBridgeApi();
  const previousText = triggerButton?.textContent || '';

  try {
    state.installRunning = true;
    openAgentInstallModal(label);
    if (triggerButton) {
      triggerButton.disabled = true;
      triggerButton.textContent = `${label} ?ㅼ튂 以?..`;
    }
    setSettingsStatus(`${label} ?ㅼ튂瑜??쒖옉?덉뒿?덈떎. ?ㅼ튂 紐⑤떖?먯꽌 吏꾪뻾 ?곹깭瑜??뺤씤?섏꽭??`);
    updateAgentInstallModal({
      label,
      status: `${label} ?ㅼ튂 紐낅졊???ㅽ뻾 以묒엯?덈떎.`,
      output: normalizedProvider === 'codex' ? 'npm install -g @openai/codex' : '怨듭떇 ?ㅼ튂 紐낅졊 ?ㅽ뻾 以?..',
      type: 'info',
    });
    const result = typeof api?.installAgentTool === 'function'
      ? await api.installAgentTool({ provider: normalizedProvider })
      : await api?.invoke?.('agent-mode:install-tool', { provider: normalizedProvider });

    if (!result?.ok) {
      const output = [
        result?.command ? `紐낅졊: ${result.command}` : '',
        result?.error ? `?ㅻ쪟: ${result.error}` : '',
        result?.output || '',
      ].filter(Boolean).join('\n\n');
      updateAgentInstallModal({
        label,
        status: result?.error || `${label} ?ㅼ튂???ㅽ뙣?덉뒿?덈떎.`,
        output,
        type: 'error',
      });
      alert(result?.error || `${label} ?ㅼ튂???ㅽ뙣?덉뒿?덈떎.`);
      setSettingsStatus(result?.error || `${label} ?ㅼ튂???ㅽ뙣?덉뒿?덈떎.`, 'error');
      return null;
    }

    const verified = result.verified || result.tool?.usable === true;
    const output = [
      result.command ? `紐낅졊: ${result.command}` : '',
      result.output || '',
      result.tool?.version ? `\n?뺤씤: ${result.tool.version}` : '',
      !verified && result.tool?.error ? `\n?ㅽ뻾 ?뺤씤 ?ㅻ쪟: ${result.tool.error}` : '',
    ].filter(Boolean).join('\n\n');
    updateAgentInstallModal({
      label,
      status: verified ? `${label} ?ㅼ튂媛 ?꾨즺?섏뿀?듬땲??` : `${label} ?ㅼ튂???앸궗吏留??ㅽ뻾 ?뺤씤???꾩슂?⑸땲??`,
      output,
      type: verified ? 'success' : 'error',
    });
    setSettingsStatus(verified
      ? `${label} ?ㅼ튂媛 ?꾨즺?섏뿀?듬땲?? ?댁젣 濡쒓렇??李??닿린瑜??뚮윭二쇱꽭??`
      : `${label} ?ㅼ튂???앸궗吏留??ㅽ뻾 ?뺤씤???꾩슂?⑸땲?? ?ㅼ튂 濡쒓렇瑜??뺤씤?댁＜?몄슂.`,
      verified ? 'success' : 'error');
    addLog(`${label} ?ㅼ튂 紐낅졊???꾨즺?섏뿀?듬땲??`, verified ? 'success' : 'warning');
    await loadAgentModeStatus(true);
    return result;
  } catch (error) {
    console.error('[CODEX-WORKSHOP] install agent tool failed:', error);
    updateAgentInstallModal({
      label,
      status: `${label} ?ㅼ튂 ?ㅽ뻾 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.`,
      output: error?.message || String(error || ''),
      type: 'error',
    });
    alert(`${label} ?ㅼ튂瑜??ㅽ뻾?섏? 紐삵뻽?듬땲?? ${error?.message || error}`);
    setSettingsStatus(`${label} ?ㅼ튂 ?ㅽ뻾 ?ㅽ뙣: ${error?.message || error}`, 'error');
    return null;
  } finally {
    state.installRunning = false;
    if (triggerButton) {
      triggerButton.disabled = false;
      triggerButton.textContent = previousText || `${label} ?ㅼ튂?섍린`;
    }
  }
}

async function startAgentLogin(provider = state.activeAgentProvider, profileId = '') {
  const status = await loadAgentModeStatus(true);
  if (!isMaxAgentAllowed(status)) {
    alert(status?.message || 'Agent 紐⑤뱶??3媛쒖썡 ?댁긽 肄붾뱶?먯꽌 ?ъ슜?????덉뒿?덈떎.');
    return;
  }

  const normalizedProvider = provider === 'claude' ? 'claude' : 'codex';
  const tool = status?.tools?.[normalizedProvider];
  const label = normalizedProvider === 'claude' ? 'Claude Code' : 'Codex';
  if (!tool?.installed) {
    setSettingsStatus(`${label} ?ㅼ튂媛 癒쇱? ?꾩슂?⑸땲?? ?ㅼ튂 踰꾪듉?쇰줈 ?ㅼ튂/?뺤씤???앸궦 ??濡쒓렇??李쎌쓣 ?댁뼱二쇱꽭??`, 'error');
    return;
  }
  if (tool.usable === false) {
    setSettingsStatus(`${label} ?ㅽ뻾 ?뺤씤???꾩쭅 ?꾨즺?섏? ?딆븯?듬땲?? ?ㅼ튂 踰꾪듉?먯꽌 ?ㅽ뻾 ?뺤씤??癒쇱? ?앸궦 ??濡쒓렇??李쎌쓣 ?댁뼱二쇱꽭??`, 'error');
    return;
  }

  let profile = profileId ? getProfileById(normalizedProvider, profileId) : null;
  if (!profile) {
    profile = getSelectedProfileByUi(normalizedProvider);
  }
  if (!profile) {
    profile = getProviderProfile(normalizedProvider);
  }
  if (!profile) {
    profile = await createAgentProfile(normalizedProvider);
  }
  if (profile) {
    setActiveAgentProfile(normalizedProvider, profile.id);
  }
  if (!profile) {
    alert('濡쒓렇?명븷 Agent 怨꾩젙 以鍮꾩뿉 ?ㅽ뙣?덉뒿?덈떎.');
    return;
  }

  if (isAgentProfileReady(profile)) {
    setSettingsStatus(`${label} 濡쒓렇???꾨즺 ?곹깭?낅땲?? 諛붾줈 Agent 紐⑤뱶?먯꽌 ?ъ슜?????덉뒿?덈떎.`, 'success');
    addLog(`${label} 濡쒓렇???꾨즺 ?곹깭瑜??뺤씤?덉뒿?덈떎.`, 'success');
    return;
  }

  const api = getBridgeApi();
  try {
    const result = typeof api?.startAgentLogin === 'function'
      ? await api.startAgentLogin({ id: profile.id, provider: normalizedProvider })
      : await api?.invoke?.('agent-mode:start-login', { id: profile.id, provider: normalizedProvider });

    if (!result?.ok) {
      alert(result?.error || '濡쒓렇??李쎌쓣 ?댁? 紐삵뻽?듬땲??');
      setSettingsStatus(result?.error || '濡쒓렇??李쎌쓣 ?댁? 紐삵뻽?듬땲??', 'error');
      return;
    }

    const commandEl = $(AGENT_LOGIN_COMMAND_ID);
    if (commandEl) commandEl.value = result.command || profile.loginCommand || '';
    const settingsCommandEl = $('agentModeSettingsLoginCommand');
    if (settingsCommandEl) settingsCommandEl.value = result.command || profile.loginCommand || '';
    setSettingsStatus(`${label} 濡쒓렇??釉뚮씪?곗?瑜??댁뿀?듬땲?? 濡쒓렇???꾨즺 ?щ?瑜??먮룞?쇰줈 ?뺤씤?섎뒗 以묒엯?덈떎.`);
    addLog(`${label} 濡쒓렇??釉뚮씪?곗?瑜??댁뿀?듬땲?? ?꾨즺?섎㈃ ???곹깭媛 ?먮룞?쇰줈 諛붾앸땲??`, 'info');
    startAgentLoginPolling(normalizedProvider, profile.id);
  } catch (error) {
    console.error('[CODEX-WORKSHOP] start agent login failed:', error);
    alert(`濡쒓렇??李쎌쓣 ?????놁뒿?덈떎: ${error?.message || error}`);
    setSettingsStatus(`濡쒓렇??李??ㅽ뻾 ?ㅽ뙣: ${error?.message || error}`, 'error');
  }
}

async function runAgentJob({ payload: inputPayload = null, button = null, source = 'modal' } = {}) {
  loadExecutionPrefs();
  if (state.executionMode !== 'agent') {
    throw new Error('?꾩옱 API ??紐⑤뱶?낅땲?? ?섍꼍?ㅼ젙?먯꽌 Agent 紐⑤뱶瑜??좏깮?????ㅼ떆 ?ㅽ뻾?댁＜?몄슂.');
  }

  const status = await loadAgentModeStatus(true);
  if (!isMaxAgentAllowed(status)) {
    throw new Error(status?.message || 'Max Agent Mode??3媛쒖썡 ?댁긽 肄붾뱶?먯꽌 ?ъ슜?????덉뒿?덈떎.');
  }

  if (source === 'posting') {
    updateAgentProgress(24, 'Agent 紐⑤뱶: ?쇱씠?좎뒪? 援щ룆 沅뚰븳???뺤씤?덉뒿?덈떎.');
  }

  let profile = getSelectedAgentProfile();
  if (!profile) {
    profile = await createAgentProfile(state.activeAgentProvider);
  }
  if (!profile) {
    throw new Error('Agent 怨꾩젙 以鍮꾩뿉 ?ㅽ뙣?덉뒿?덈떎. 癒쇱? 濡쒓렇??李??닿린濡?援щ룆 怨꾩젙 濡쒓렇?몄쓣 吏꾪뻾?댁＜?몄슂.');
  }
  if (!isAgentProfileReady(profile)) {
    const providerLabel = state.activeAgentProvider === 'claude' ? 'Claude Code' : 'Codex';
    setSettingsStatus(`${providerLabel} 濡쒓렇???꾨즺媛 ?꾩슂?⑸땲?? 濡쒓렇???깃났???먮룞?쇰줈 媛먯??⑸땲??`, 'error');
    throw new Error(`${providerLabel} 濡쒓렇?몄씠 ?꾩쭅 ?꾨즺?섏? ?딆븯?듬땲?? 濡쒓렇??李??닿린瑜??꾨Ⅸ ???꾨즺???뚭퉴吏 湲곕떎?ㅼ＜?몄슂.`);
  }

  if (source === 'posting') {
    updateAgentProgress(30, `${profile.provider === 'claude' ? 'Claude Code' : 'Codex'} 濡쒓렇???곹깭瑜??뺤씤?덉뒿?덈떎.`);
  }

  const payload = inputPayload || state.payload || await createPreviewPayload();
  const topic = getTopic(payload);
  if (!topic) {
    throw new Error('癒쇱? ?ㅼ썙?쒕굹 ?쒕ぉ???낅젰?댁＜?몄슂.');
  }

  state.payload = payload;
  const editedArticleTask = source === 'modal' ? $('codexArticleTask')?.value?.trim() : '';
  const editedImageTask = source === 'modal' ? $('codexImageTask')?.value?.trim() : '';
  state.articleTask = editedArticleTask || buildCodexArticleTask(payload);
  state.imageTask = editedImageTask || buildCodexImageTask(payload);
  setModalValues();
  if (source === 'posting') {
    updateAgentProgress(38, '湲 ?앹꽦 吏?쒖꽌? ?대?吏 ?앹꽦 吏?쒖꽌瑜?以鍮꾪뻽?듬땲??');
  }

  const providerLabel = profile.provider === 'claude' ? 'Claude Code' : 'Codex';
  if (button) {
    button.disabled = true;
    button.textContent = 'Agent ?앹꽦 以?..';
  }
  setAgentRunStatus(`${providerLabel}媛 ?꾩옱 ?곸꽭?ㅼ젙???쎄퀬 湲 ?앹꽦???쒖옉?덉뒿?덈떎. 泥??ㅽ뻾? 濡쒓렇???곹깭 ?뺤씤 ?뚮Ц???쒓컙??嫄몃┫ ???덉뒿?덈떎.`);
  addLog(`${providerLabel} Agent ?앹꽦???쒖옉?덉뒿?덈떎.`, 'info');

  const api = getBridgeApi();
  if (source === 'posting') {
    updateAgentProgress(46, `${providerLabel}媛 湲 蹂몃Ц怨??대?吏 ?곗텧臾쇱쓣 ?앹꽦 以묒엯?덈떎.`);
  }

  const request = {
    profileId: profile.id,
    provider: profile.provider,
    payload,
    articleTask: state.articleTask,
    imageTask: state.imageTask,
    title: topic,
  };

  let agentRunSettled = false;
  let imageStageTimer = null;
  if (source === 'posting') {
    imageStageTimer = setTimeout(() => {
      if (!agentRunSettled) {
        updateAgentProgress(62, `${providerLabel}媛 ?대?吏 ?곗텧臾쇨낵 蹂몃Ц ?쎌엯 援ъ꽦???뺣━ 以묒엯?덈떎.`);
      }
    }, 15000);
  }

  let result;
  try {
    result = typeof api?.runAgentJob === 'function'
      ? await api.runAgentJob(request)
      : await api?.invoke?.('agent-mode:run-job', request);
  } finally {
    agentRunSettled = true;
    if (imageStageTimer) clearTimeout(imageStageTimer);
  }

  if (!result?.ok) {
    const detail = [result?.error, result?.stderr, result?.stdout].filter(Boolean).join('\n\n').trim();
    setAgentRunStatus(detail || 'Agent ?앹꽦???ㅽ뙣?덉뒿?덈떎.', 'error');
    throw new Error(detail || result?.error || 'Agent ?앹꽦???ㅽ뙣?덉뒿?덈떎. 濡쒓렇???곹깭瑜??뺤씤?댁＜?몄슂.');
  }

  let content = String(result.content || '').trim();
  if (!content) {
    setAgentRunStatus('Agent???꾨즺?섏뿀吏留?HTML 異쒕젰臾쇱씠 鍮꾩뼱 ?덉뒿?덈떎.', 'error');
    throw new Error('Agent 異쒕젰臾쇱씠 鍮꾩뼱 ?덉뒿?덈떎. ?곸꽭?ㅼ젙???뺤씤?????ㅼ떆 ?쒕룄?댁＜?몄슂.');
  }

  if (source === 'posting') {
    updateAgentProgress(72, `Agent ?곗텧臾쇱쓣 ?뚯닔?덉뒿?덈떎. (${getTextLength(content).toLocaleString()}??`, 'success');
  }

  const imageEnhancement = await enhanceCodexAgentImages(content, payload, result.title || topic);
  content = imageEnhancement.content || content;

  const pasteEl = $('codexResultPaste');
  if (pasteEl) pasteEl.value = content;
  recordAgentUsage(profile.provider, result.jobId || '', result.usage || null);
  setAgentRunStatus(`?앹꽦 ?꾨즺: ${result.title || topic}${result.jobId ? ` 쨌 ?묒뾽 ID ${result.jobId}` : ''}`);
  setSettingsStatus(`${providerLabel} ?묒뾽 1?뚮? 濡쒖뺄 ?ㅽ뻾 湲곕줉????ν뻽?듬땲??`);
  addLog(`Agent 異쒕젰臾쇱쓣 ?뚯닔?덉뒿?덈떎. (${getTextLength(content).toLocaleString()}??`, 'success');
  await applyCodexResult({ thumbnailUrl: imageEnhancement.thumbnailUrl || '' });
  if (source === 'posting') {
    updateAgentProgress(82, '湲怨??대?吏 ?곗텧臾쇱쓣 誘몃━蹂닿린???곸슜?덉뒿?덈떎. 諛쒗뻾 ?④퀎濡??섏뼱媛묐땲??', 'success');
  }

  return {
    ok: true,
    title: result.title || topic,
    content,
    jobId: result.jobId || '',
    provider: profile.provider,
  };
}

async function runAgentJobFromModal() {
  const button = $(RUN_AGENT_JOB_BTN_ID);
  try {
    await runAgentJob({ button, source: 'modal' });
  } catch (error) {
    console.error('[CODEX-WORKSHOP] run agent job failed:', error);
    setAgentRunStatus(`Agent ?앹꽦 ?ㅽ뙣: ${error?.message || error}`, 'error');
    alert(`Agent ?앹꽦???ㅽ뙣?덉뒿?덈떎: ${error?.message || error}`);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = `${state.activeAgentProvider === 'claude' ? 'Claude Code' : 'Codex'}濡??앹꽦`;
    }
  }
}

function setModalValues() {
  const articleEl = $('codexArticleTask');
  const imageEl = $('codexImageTask');
  if (articleEl) articleEl.value = state.articleTask;
  if (imageEl) imageEl.value = state.imageTask;
}

async function copyText(text, label = '?댁슜') {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const temp = document.createElement('textarea');
      temp.value = text;
      temp.style.position = 'fixed';
      temp.style.opacity = '0';
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      temp.remove();
    }
    addLog(`${label}瑜??대┰蹂대뱶??蹂듭궗?덉뒿?덈떎.`, 'success');
  } catch (error) {
    console.error('[CODEX-WORKSHOP] copy failed:', error);
    alert(`${label} 蹂듭궗???ㅽ뙣?덉뒿?덈떎. ?띿뒪?몃? 吏곸젒 ?좏깮?댁꽌 蹂듭궗?댁＜?몄슂.`);
  }
}

function stripCodeFence(raw = '') {
  const text = String(raw || '').trim();
  const fenceMatch = text.match(/^```(?:html|markdown|md)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) return fenceMatch[1].trim();
  return text.replace(/```(?:html|markdown|md)?/gi, '').replace(/```/g, '').trim();
}

function extractTitle(raw = '', payload = {}) {
  const text = stripCodeFence(raw);
  const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    || text.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (titleMatch) return stripHtml(titleMatch[1]).trim();

  const markdownTitle = text.split('\n').map(line => line.trim()).find(line => /^#\s+/.test(line));
  if (markdownTitle) return markdownTitle.replace(/^#\s+/, '').trim();

  return getTopic(payload) || 'Codex ?앹꽦 湲';
}

function inlineMarkdown(value = '') {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

function markdownToHtml(raw = '', title = '') {
  const lines = stripCodeFence(raw).replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  let listType = '';

  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = '';
    }
  };
  const flushParagraph = () => {
    if (!paragraph.length) return;
    closeList();
    html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const openList = (type) => {
    if (listType === type) return;
    closeList();
    html.push(`<${type}>`);
    listType = type;
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      closeList();
      return;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = Math.min(heading[1].length, 4);
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      return;
    }

    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      openList('ul');
      html.push(`<li>${inlineMarkdown(unordered[1])}</li>`);
      return;
    }

    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      openList('ol');
      html.push(`<li>${inlineMarkdown(ordered[1])}</li>`);
      return;
    }

    paragraph.push(trimmed);
  });

  flushParagraph();
  closeList();

  const hasH1 = html.some(part => /^<h1/i.test(part));
  const titleHtml = hasH1 ? '' : `<h1>${escapeHtml(title || 'Codex ?앹꽦 湲')}</h1>`;
  return `<article class="bgpt-wp-ready bgpt-codex-workshop">${titleHtml}${html.join('\n')}</article>`;
}

function normalizeCodexContent(raw = '', payload = {}) {
  const cleaned = stripCodeFence(raw);
  const title = extractTitle(cleaned, payload);
  const looksLikeHtml = /<\/?(article|h1|h2|h3|p|ul|ol|li|blockquote|table|div|section)\b/i.test(cleaned);
  const html = looksLikeHtml ? cleaned : markdownToHtml(cleaned, title);

  return sanitizeHTML(html, {
    allowTags: ['article', 'section', 'div', 'span', 'p', 'br', 'strong', 'b', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'img', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'figure', 'figcaption', 'hr'],
    allowAttributes: ['href', 'src', 'alt', 'title', 'class', 'style', 'id', 'target', 'rel', 'width', 'height', 'colspan', 'rowspan'],
  });
}

async function prepareContentForPlatform(html, payload) {
  const targetPlatform = String(payload?.targetPlatform || payload?.platform || '').toLowerCase();
  const platform = /wordpress|wp|?뚮뱶?꾨젅??i.test(targetPlatform)
    ? 'wordpress'
    : (/blogger|blogspot|釉붾줈洹몄뒪??i.test(targetPlatform) ? 'blogspot' : '');

  if (!platform || !window.electronAPI?.invoke) return html;

  try {
    const prepared = await window.electronAPI.invoke('prepare-publish-content', {
      payload: { ...payload, platform },
      platform,
      content: html,
    });
    if (prepared?.ok && typeof prepared.content === 'string' && prepared.content.trim()) {
      addLog(`Codex ?곗텧臾쇱쓣 ${normalizePlatformName(platform)} 諛쒗뻾 ?뺤떇?쇰줈 ?뺣━?덉뒿?덈떎.`, 'info');
      return prepared.content;
    }
  } catch (error) {
    console.warn('[CODEX-WORKSHOP] prepare-publish-content failed:', error);
  }

  return html;
}

function shouldGenerateH2Image(policy, index) {
  const normalized = normalizeAgentImagePolicy(policy);
  const idx = Number(index) || 0;
  if (normalized === 'thumbnail-only' || normalized === 'none') return false;
  if (normalized === 'odd-only') return idx % 2 === 1;
  if (normalized === 'even-only') return idx % 2 === 0;
  return true;
}

function getImageResultUrl(result) {
  if (!result || result.ok === false) return '';
  return String(
    result.dataUrl
    || result.url
    || result.imageUrl
    || result.thumbnailUrl
    || result.result?.dataUrl
    || result.result?.url
    || ''
  ).trim();
}

function buildAgentThumbnailPrompt(title, topic, includeText) {
  const base = [
    `Korean blog thumbnail, 16:9 landscape, topic: ${title || topic}`,
    'clean editorial composition, realistic but polished, bright contrast, safe non-branded scene',
    'leave enough negative space for title area, no public agency seal, no celebrity face, no watermark',
  ];
  if (includeText) {
    base.push(`include one short bold Korean title text only: "${title || topic}"`);
  } else {
    base.push('no text, no letters, no typography, no captions, no signage');
  }
  return base.join('. ');
}

function buildAgentH2ImagePrompt(h2Text, topic) {
  return [
    `Korean blog body image for section "${h2Text}" in article topic "${topic}"`,
    'realistic lifestyle/editorial scene, clean composition, helpful information mood',
    'no text, no letters, no captions, no logo, no watermark, no signage',
    '16:9 landscape, natural light, visually distinct from other section images',
  ].join('. ');
}

async function generateAgentImage(engine, prompt, includeText, label) {
  const api = getBridgeApi();
  if (!api?.invoke || !engine || engine === 'none') return '';
  try {
    const result = await api.invoke('batch-image-generate', {
      engine,
      quality: 'medium',
      aspectRatio: '16:9',
      prompt,
      includeText: !!includeText,
    });
    const url = getImageResultUrl(result);
    if (!url) {
      addLog(`${label} ?대?吏 ?앹꽦 ?ㅽ뙣: ${result?.error || '?대?吏 URL ?놁쓬'}`, 'warning');
      return '';
    }
    return url;
  } catch (error) {
    addLog(`${label} ?대?吏 ?앹꽦 ?ㅽ뙣: ${error?.message || error}`, 'warning');
    return '';
  }
}

async function enhanceCodexAgentImages(html, payload = {}, title = '') {
  const policy = getPayloadImagePolicy(payload);
  if (state.activeAgentProvider !== 'codex' || policy === 'none') {
    return { content: html, thumbnailUrl: '' };
  }

  const topic = getTopic(payload) || title;
  const thumbnailEngine = payload.thumbnailMode || payload.thumbnailType || payload.thumbnailSource || 'nanobanana2';
  const h2Engine = payload.h2ImageSource || payload.h2Images?.source || thumbnailEngine;
  const thumbnailTextIncluded = payload.thumbnailTextIncluded !== false && payload.thumbnailIncludeText !== false;
  let thumbnailUrl = '';
  let content = String(html || '');

  updateAgentProgress(76, `?대?吏 ?뺤콉 ?곸슜 以? ${getAgentImagePolicyLabel(policy)}`, 'info');

  if (policy !== 'none') {
    thumbnailUrl = await generateAgentImage(
      thumbnailEngine,
      buildAgentThumbnailPrompt(title || topic, topic, thumbnailTextIncluded),
      thumbnailTextIncluded,
      '?몃꽕??
    );
    if (thumbnailUrl) {
      addLog('Agent ?몃꽕???대?吏瑜??앹꽦?덉뒿?덈떎.', 'success');
      appendAgentGeneratedImagePreview({ url: thumbnailUrl, label: '?몃꽕?? });
    }
  }

  if (policy === 'thumbnail-only') {
    return { content, thumbnailUrl };
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const root = doc.querySelector('article') || doc.body;
    const h2Nodes = Array.from(root.querySelectorAll('h2'));
    let inserted = 0;

    for (let i = 0; i < h2Nodes.length; i++) {
      const index = i + 1;
      if (!shouldGenerateH2Image(policy, index)) continue;
      const h2 = h2Nodes[i];
      const h2Text = (h2.textContent || '').replace(/\s+/g, ' ').trim();
      if (!h2Text) continue;

      updateAgentProgress(Math.min(82, 76 + inserted + 1), `H2 ${index} ?대?吏 ?앹꽦 以? ${h2Text.slice(0, 28)}`, 'info');
      const imageUrl = await generateAgentImage(
        h2Engine,
        buildAgentH2ImagePrompt(h2Text, topic),
        false,
        `H2 ${index}`
      );
      if (!imageUrl) continue;
      appendAgentGeneratedImagePreview({ url: imageUrl, label: `H2 ${index}` });

      const figure = doc.createElement('figure');
      figure.className = 'agent-generated-h2-image';
      figure.setAttribute('data-agent-image', 'generated');
      figure.setAttribute('style', 'margin:18px 0;text-align:center;');
      const img = doc.createElement('img');
      img.src = imageUrl;
      img.alt = h2Text;
      img.loading = 'lazy';
      img.setAttribute('style', 'max-width:100%;height:auto;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,0.1);');
      figure.appendChild(img);
      h2.insertAdjacentElement('afterend', figure);
      inserted++;
    }

    if (inserted > 0) {
      content = root.tagName.toLowerCase() === 'article' ? root.outerHTML : doc.body.innerHTML;
      addLog(`Agent H2 ?대?吏 ${inserted}?μ쓣 蹂몃Ц???쎌엯?덉뒿?덈떎.`, 'success');
    }
  } catch (error) {
    addLog(`Agent H2 ?대?吏 ?꾩쿂由??ㅽ뙣: ${error?.message || error}`, 'warning');
  }

  return { content, thumbnailUrl };
}

export async function runAgentJobFromPosting(payload = null) {
  ensureStyles();
  ensureModal();
  loadExecutionPrefs();
  return runAgentJob({ payload, source: 'posting' });
}

export async function openCodexWorkshopPanel() {
  try {
    ensureStyles();
    ensureModal();
    loadExecutionPrefs();

    if (state.executionMode !== 'agent') {
      alert('?꾩옱 API ??紐⑤뱶?낅땲?? ?섍꼍?ㅼ젙?먯꽌 Agent 紐⑤뱶瑜??좏깮?댁빞 Codex/Claude ?묒뾽?ㅼ쓣 ?????덉뒿?덈떎.');
      addLog('API ??紐⑤뱶?먯꽌??Agent ?묒뾽?ㅼ쓣 ?댁? ?딆뒿?덈떎.', 'warning');
      return;
    }

    const agentStatus = await loadAgentModeStatus(true);
    if (!isMaxAgentAllowed(agentStatus)) {
      const message = agentStatus?.message || '?꾩옱 ?쇱씠?좎뒪??API ??湲곕컲 ?앹꽦 紐⑤뱶?낅땲??';
      alert(`${message}\n\n1媛쒖썡 肄붾뱶??湲곗〈 API ??湲곕컲 湲/?대?吏 ?앹꽦 ?먮쫫??洹몃?濡??ъ슜?섍퀬, Codex/Claude 援щ룆 怨꾩젙 湲곕컲 Max Agent Mode??3媛쒖썡 ?댁긽 肄붾뱶?먯꽌 ?대┰?덈떎.`);
      addLog('?꾩옱 ?쇱씠?좎뒪??API ??紐⑤뱶?낅땲?? Max Agent Mode??3媛쒖썡 ?댁긽 肄붾뱶?먯꽌 ?ъ슜?????덉뒿?덈떎.', 'warning');
      return;
    }

    const payload = await createPreviewPayload();
    const topic = getTopic(payload);
    if (!topic) {
      alert('癒쇱? ?ㅼ썙?쒕굹 ?쒕ぉ???낅젰?댁＜?몄슂.');
      return;
    }

    state.payload = payload;
    state.articleTask = buildCodexArticleTask(payload);
    state.imageTask = buildCodexImageTask(payload);
    setModalValues();
    renderAgentStatusPanel();
    const providerLabel = state.activeAgentProvider === 'claude' ? 'Claude Code' : 'Codex';
    const titleEl = $('codexWorkshopTitle');
    const subtitleEl = $('codexWorkshopSubtitle');
    if (titleEl) titleEl.textContent = `${providerLabel} ?묒뾽??;
    if (subtitleEl) subtitleEl.textContent = `${providerLabel}媛 ?꾩옱 ???ㅼ젙???쎄퀬 諛쒗뻾 媛?ν븳 湲怨??대?吏 諛⑺뼢???앹꽦?⑸땲??`;

    $(MODAL_ID)?.classList.add('is-open');
    addLog(`${state.activeAgentProvider === 'claude' ? 'Claude' : 'Codex'} ?묒뾽??吏?쒖꽌瑜??꾩옱 ?ㅼ젙 湲곗??쇰줈 以鍮꾪뻽?듬땲??`, 'info');
  } catch (error) {
    console.error('[CODEX-WORKSHOP] open failed:', error);
    alert(`Codex ?묒뾽?ㅼ쓣 ?????놁뒿?덈떎: ${error?.message || error}`);
  }
}

export function closeCodexWorkshopPanel() {
  $(MODAL_ID)?.classList.remove('is-open');
}

export async function applyCodexResult(options = {}) {
  try {
    const raw = $('codexResultPaste')?.value?.trim() || '';
    if (!raw) {
      alert('Codex ?곗텧臾쇱쓣 癒쇱? 遺숈뿬?ｌ뼱 二쇱꽭??');
      return;
    }

    const payload = state.payload || await createPreviewPayload();
    const title = extractTitle(raw, payload);
    let html = normalizeCodexContent(raw, payload);
    html = await prepareContentForPlatform(html, payload);

    const appState = getAppState();
    appState.generatedContent.title = title;
    appState.generatedContent.content = html;
    appState.generatedContent.thumbnailUrl = options.thumbnailUrl || '';
    appState.generatedContent.payload = {
      ...payload,
      provider: 'codex-workshop',
      codexWorkshop: true,
      previewOnly: true,
    };

    displayPreviewInModal();
    closeCodexWorkshopPanel();
    addLog(`Codex ?곗텧臾쇱쓣 誘몃━蹂닿린濡??곸슜?덉뒿?덈떎. (${getTextLength(html).toLocaleString()}??`, 'success');
  } catch (error) {
    console.error('[CODEX-WORKSHOP] apply failed:', error);
    alert(`Codex ?곗텧臾??곸슜???ㅽ뙣?덉뒿?덈떎: ${error?.message || error}`);
  }
}

export function initCodexWorkshop() {
  ensureStyles();
  loadExecutionPrefs();
  ensureEntryButton();
  ensureAgentSettingsSection();
  startUsageTimer();
  applyExecutionModeToApp();
  loadAgentModeStatus(true);

  window.openCodexWorkshopPanel = openCodexWorkshopPanel;
  window.closeCodexWorkshopPanel = closeCodexWorkshopPanel;
  window.applyCodexResult = applyCodexResult;
  window.runAgentJobFromPosting = runAgentJobFromPosting;
  window.getAgentImageSettingsMode = getAgentImageSettingsMode;
  window.refreshAgentModeSettings = () => {
    ensureAgentSettingsSection();
    return loadAgentModeStatus(true);
  };

  window.addEventListener('license-access-updated', () => {
    ensureAgentSettingsSection();
    loadAgentModeStatus(true);
  });
}
