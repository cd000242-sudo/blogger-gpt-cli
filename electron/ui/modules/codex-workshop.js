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
const AGENT_RUN_STATUS_ID = 'codexAgentRunStatus';
const RUN_AGENT_JOB_BTN_ID = 'runCodexAgentJobBtn';
const EXECUTION_MODE_KEY = 'leadernamExecutionMode';
const ACTIVE_AGENT_PROVIDER_KEY = 'leadernamActiveAgentProvider';
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
  { value: 'all', label: '썸네일+소제목 전체', hint: '썸네일 1장과 본문 H2 전체' },
  { value: 'thumbnail-only', label: '썸네일만', hint: '본문 이미지는 만들지 않음' },
  { value: 'odd-only', label: '홀수 소제목', hint: '썸네일 + 1, 3, 5번 H2' },
  { value: 'even-only', label: '짝수 소제목', hint: '썸네일 + 2, 4번 H2' },
  { value: 'none', label: '이미지 없음', hint: '글만 생성' },
];

const state = {
  payload: null,
  articleTask: '',
  imageTask: '',
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
    note: 'Google AI Studio/API 사용량 기준',
  },
  {
    id: 'openai',
    label: 'OpenAI API',
    keyIds: ['openaiKey'],
    dashboardUrl: 'https://platform.openai.com/api-keys',
    billingUrl: 'https://platform.openai.com/usage',
    note: 'Platform 사용량/크레딧 기준',
  },
  {
    id: 'claude',
    label: 'Anthropic API',
    keyIds: ['claudeKey'],
    dashboardUrl: 'https://console.anthropic.com/settings/keys',
    billingUrl: 'https://console.anthropic.com/settings/usage',
    note: 'Console 사용량/크레딧 기준',
  },
  {
    id: 'perplexity',
    label: 'Perplexity API',
    keyIds: ['perplexityKey'],
    dashboardUrl: 'https://www.perplexity.ai/settings/api',
    billingUrl: 'https://www.perplexity.ai/settings/api',
    note: 'Perplexity API 크레딧 기준',
  },
];

const API_IMAGE_PROVIDERS = [
  {
    id: 'stability',
    label: 'Stability',
    keyIds: ['stabilityApiKey', 'stabilityApiKeyHidden'],
    dashboardUrl: 'https://platform.stability.ai/account/keys',
    billingUrl: 'https://platform.stability.ai/account/credits',
    note: '이미지 크레딧 기준',
  },
  {
    id: 'deepinfra',
    label: 'DeepInfra',
    keyIds: ['deepInfraApiKey'],
    dashboardUrl: 'https://deepinfra.com/dash/api_keys',
    billingUrl: 'https://deepinfra.com/dash/billing',
    note: '이미지/텍스트 API 과금 기준',
  },
  {
    id: 'openai-image',
    label: 'OpenAI Image',
    keyIds: ['dalleApiKey', 'openaiKey'],
    dashboardUrl: 'https://platform.openai.com/api-keys',
    billingUrl: 'https://platform.openai.com/usage',
    note: 'OpenAI Platform 이미지 사용량 기준',
  },
];

const AGENT_PROVIDER_META = {
  codex: {
    id: 'codex',
    label: 'Codex',
    title: 'Codex 구독 Agent',
    profileButton: 'Codex 계정 준비',
    upgradeUrl: 'https://chatgpt.com/explore/pro?utm_internal_source=openai_developers_codex',
    planUrl: 'https://chatgpt.com/pricing',
    analyticsUrl: 'https://chatgpt.com/codex/cloud/settings/analytics',
    docsUrl: 'https://developers.openai.com/codex/pricing',
    measuredStatus: '개인 Plus/Pro 구독의 실시간 잔여량은 공개 CLI/API로 제공되지 않습니다. Business/Enterprise는 관리자 Analytics에서 실측 사용량을 확인할 수 있습니다.',
    estimateText: '글/이미지 생성 가능 개수는 실제 남은 구독량을 알 수 없어서 계산하지 않습니다. 앱은 생성 성공/실패와 로컬 작업 기록만 표시합니다.',
  },
  claude: {
    id: 'claude',
    label: 'Claude Code',
    title: 'Claude Code 구독 Agent',
    profileButton: 'Claude 계정 준비',
    upgradeUrl: 'https://claude.ai/upgrade',
    planUrl: 'https://claude.ai/settings/billing',
    analyticsUrl: 'https://claude.ai/settings/billing',
    docsUrl: 'https://support.claude.com/en/articles/8324991-about-claude-s-pro-plan-usage',
    measuredStatus: 'Claude Pro/Max는 5시간 세션 기준으로 리셋되지만 메시지 길이, 모델, 기능, 현재 용량에 따라 달라져 남은 개수를 외부 앱에서 정확히 계산할 수 없습니다.',
    estimateText: '남은 글/이미지 개수는 표시하지 않습니다. 대신 공식 플랜 화면과 Claude Code 로그인 상태, 이 앱의 작업 기록만 분리해서 보여줍니다.',
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

  state.executionMode = mode;
  state.activeAgentProvider = agentProvider;
  state.activeApiTextProvider = API_TEXT_PROVIDERS.some((item) => item.id === apiTextProvider) ? apiTextProvider : 'gemini';
  state.activeApiImageProvider = API_IMAGE_PROVIDERS.some((item) => item.id === apiImageProvider) ? apiImageProvider : 'stability';
  return {
    mode: state.executionMode,
    agentProvider: state.activeAgentProvider,
    apiTextProvider: state.activeApiTextProvider,
    apiImageProvider: state.activeApiImageProvider,
  };
}

function saveExecutionPrefs() {
  const storage = getStorage();
  storage?.setSync?.(EXECUTION_MODE_KEY, state.executionMode, true);
  storage?.setSync?.(ACTIVE_AGENT_PROVIDER_KEY, state.activeAgentProvider, true);
  storage?.setSync?.(ACTIVE_API_TEXT_PROVIDER_KEY, state.activeApiTextProvider, true);
  storage?.setSync?.(ACTIVE_API_IMAGE_PROVIDER_KEY, state.activeApiImageProvider, true);
}

function normalizeAgentImagePolicy(value) {
  const raw = String(value || '').toLowerCase().trim();
  if (raw === 'odd') return 'odd-only';
  if (raw === 'even') return 'even-only';
  return AGENT_IMAGE_POLICY_OPTIONS.some((option) => option.value === raw) ? raw : DEFAULT_AGENT_IMAGE_SETTINGS.policy;
}

function getAgentImagePolicyLabel(policy) {
  const normalized = normalizeAgentImagePolicy(policy);
  return AGENT_IMAGE_POLICY_OPTIONS.find((option) => option.value === normalized)?.label || '썸네일+소제목 전체';
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
  const profiles = Array.isArray(state.agentStatus?.profiles) ? state.agentStatus.profiles : [];
  return profiles.find((profile) => profile.provider === provider) || null;
}

function isAgentProfileReady(profile) {
  return profile?.status === 'ready';
}

function getProviderLoginLabel(provider, profile = getProviderProfile(provider)) {
  if (isAgentProfileReady(profile)) return '로그인 완료';
  if (profile) return '로그인 대기';
  return '로그인 필요';
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
    windowText: `${summary.settings.resetHours}시간 창 내 앱 실행 기록`,
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
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  if (minutes > 0) return `${minutes}분 ${seconds}초`;
  return `${seconds}초`;
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
          currentName: '확인 실패',
          requiredName: '스탠다드 (3개월)',
          message: result?.error || 'Agent Mode 상태를 확인하지 못했습니다.',
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
      currentName: '확인 실패',
      requiredName: '스탠다드 (3개월)',
      message: error?.message || 'Agent Mode 상태를 확인하지 못했습니다.',
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
    statusEl.textContent = '현재 API 키 모드입니다. Agent 작업실은 비활성화되어 있습니다.';
    button.textContent = '설정에서 Agent 선택';
    button.disabled = true;
    return;
  }

  if (!status) {
    statusEl.className = 'codex-workshop-status is-muted';
    statusEl.textContent = '라이선스 상태 확인 중...';
    button.textContent = '상태 확인 중';
    button.disabled = true;
    return;
  }

  if (isMaxAgentAllowed(status)) {
    const provider = prefs.agentProvider === 'claude' ? 'claude' : 'codex';
    const profile = getProviderProfile(provider);
    const ready = isAgentProfileReady(profile);
    statusEl.className = `codex-workshop-status ${ready ? 'is-ready' : 'is-muted'}`;
    statusEl.textContent = `${provider === 'claude' ? 'Claude Code' : 'Codex'} Agent 모드 · ${ready ? '로그인 완료' : getProviderLoginLabel(provider, profile)} · ${status.currentName || '3개월 이상'}`;
    button.textContent = ready ? `${provider === 'claude' ? 'Claude' : 'Codex'} 작업실 열기` : 'Agent 로그인 필요';
    button.disabled = false;
    return;
  }

  statusEl.className = 'codex-workshop-status is-locked';
  statusEl.textContent = `API 키 모드 · Max Agent는 ${status.requiredName || '3개월 이상'}부터`;
  button.textContent = 'Max 안내 보기';
  button.disabled = true;
}

function getToolInstalledLabel(tool) {
  if (!tool) return '확인 전';
  if (!tool.installed) return '미감지';
  if (tool.usable === false) return '실행 권한 확인 필요';
  return '설치됨';
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
        <span style="font-size:12px;font-weight:900;color:${summary.remaining > 0 ? '#86efac' : '#fecaca'};">${summary.remaining}/${summary.limit} 남음</span>
      </div>
      <div style="height:8px;background:rgba(15,23,42,0.8);border-radius:999px;overflow:hidden;">
        <div style="width:${percent}%;height:100%;background:${summary.remaining > 0 ? 'linear-gradient(90deg,#22c55e,#38bdf8)' : 'linear-gradient(90deg,#f97316,#ef4444)'};"></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;color:rgba(226,232,240,0.68);font-size:11px;">
        <span>사용 ${summary.used}회</span>
        <span>리셋 ${nextResetText}</span>
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
  addLog('Max Agent 사용량 설정을 저장했습니다.', 'success');
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
          <strong id="agentInstallTitle">Agent 설치</strong>
          <span id="agentInstallSubtitle">설치 명령을 실행하고 결과를 확인합니다.</span>
        </div>
      </div>
      <div class="agent-install-body">
        <div id="agentInstallStatus" class="agent-install-status">
          <span class="agent-install-spinner"></span>
          <span id="agentInstallStatusText">준비 중입니다.</span>
        </div>
        <pre id="agentInstallOutput" class="agent-install-output">설치 로그가 여기에 표시됩니다.</pre>
        <div class="agent-install-actions">
          <button type="button" id="agentInstallCloseBtn">닫기</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  $('agentInstallCloseBtn')?.addEventListener('click', () => {
    if (state.installRunning) {
      setSettingsStatus('설치가 아직 진행 중입니다. 잠시만 기다려주세요.');
      return;
    }
    modal.classList.remove('is-open');
  });
  return modal;
}

function updateAgentInstallModal({ label = 'Agent', status = '설치 준비 중입니다.', output = '', type = 'info' } = {}) {
  ensureAgentInstallModal();
  const title = $('agentInstallTitle');
  const subtitle = $('agentInstallSubtitle');
  const statusBox = $('agentInstallStatus');
  const statusText = $('agentInstallStatusText');
  const outputEl = $('agentInstallOutput');

  if (title) title.textContent = `${label} 설치`;
  if (subtitle) subtitle.textContent = type === 'success'
    ? '설치가 끝났습니다. 상태를 다시 확인합니다.'
    : type === 'error'
      ? '설치 중 문제가 발생했습니다.'
      : '설치가 진행 중입니다. 창을 닫지 말고 기다려주세요.';
  if (statusBox) statusBox.className = `agent-install-status ${type === 'success' ? 'is-success' : type === 'error' ? 'is-error' : ''}`;
  if (statusText) statusText.textContent = status;
  if (outputEl) outputEl.textContent = output || '설치 로그를 기다리는 중입니다...';
}

function openAgentInstallModal(label) {
  const modal = ensureAgentInstallModal();
  updateAgentInstallModal({ label, status: `${label} 설치를 시작합니다.`, output: '설치 명령 준비 중...', type: 'info' });
  modal.classList.add('is-open');
}

function renderSettingsProfileSelect() {
  const select = $('agentModeSettingsProfileSelect');
  const commandEl = $('agentModeSettingsLoginCommand');
  if (!select) return;

  const profiles = Array.isArray(state.agentStatus?.profiles) ? state.agentStatus.profiles : [];
  const previous = select.value;

  if (!profiles.length) {
    select.innerHTML = '<option value="">계정 준비 중</option>';
    select.disabled = true;
    if (commandEl) commandEl.value = '';
    return;
  }

  select.disabled = false;
  select.innerHTML = profiles
    .filter((profile) => profile.provider === state.activeAgentProvider)
    .map((profile) => {
      const provider = profile.provider === 'claude' ? 'Claude Code' : 'Codex';
      const label = `${provider} · ${profile.label || profile.id} · ${getProviderLoginLabel(profile.provider, profile)}`;
      return `<option value="${escapeHtml(profile.id)}">${escapeHtml(label)}</option>`;
    })
    .join('');

  if (!select.innerHTML) {
    select.innerHTML = `<option value="">${state.activeAgentProvider === 'claude' ? 'Claude' : 'Codex'} 계정 준비 중</option>`;
    select.disabled = true;
    if (commandEl) commandEl.value = '';
    return;
  }

  if (previous && profiles.some((profile) => profile.id === previous)) {
    select.value = previous;
  }

  const selected = profiles.find((profile) => profile.id === select.value) || getProviderProfile(state.activeAgentProvider);
  if (selected) {
    select.value = selected.id;
    if (commandEl) commandEl.value = selected.loginCommand || '';
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
    { type: '글 생성', provider: text },
    { type: '이미지 생성', provider: image },
  ];

  target.innerHTML = cards.map(({ type, provider }) => {
    const ready = isApiProviderReady(provider);
    return `
      <div class="agent-mode-provider-card">
        <div class="agent-mode-provider-top">
          <div>
            <strong>${escapeHtml(type)} · ${escapeHtml(provider.label)}</strong>
            <span>${ready ? 'API 키 입력됨' : 'API 키 필요'}</span>
          </div>
          <span class="agent-mode-pill ${ready ? 'is-ready' : 'is-locked'}">${ready ? '사용 가능' : '미설정'}</span>
        </div>
        <div class="agent-mode-measure">
          <div class="agent-mode-gauge"><span style="width:${ready ? 100 : 0}%;"></span></div>
          <p>실측 사용량과 잔액은 제공사 대시보드 기준으로 확인합니다. ${escapeHtml(provider.note)}</p>
        </div>
        <div class="agent-mode-actions">
          <button type="button" data-open-url="${escapeHtml(provider.dashboardUrl)}">API 키/설정</button>
          <button type="button" data-open-url="${escapeHtml(provider.billingUrl)}">충전/사용량 보기</button>
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
    ? 'Claude Code는 이미지 모델이 없어서 본문 이미지 프롬프트만 정리합니다. 실제 이미지는 별도 이미지 엔진으로 생성합니다.'
    : 'Codex가 글 생성과 함께 이미지 위치와 프롬프트까지 처리합니다. 소제목 이미지는 어떤 옵션에서도 텍스트를 넣지 않습니다.';

  return `
    <div class="agent-image-policy-panel ${disabled ? 'is-disabled' : ''}">
      <div class="agent-image-policy-head">
        <div>
          <strong>이미지 생성 범위</strong>
          <span>${escapeHtml(note)}</span>
        </div>
        <span class="agent-mode-pill ${disabled ? 'is-locked' : 'is-ready'}">${disabled ? '프롬프트만' : escapeHtml(getAgentImagePolicyLabel(settings.policy))}</span>
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
          <strong>썸네일 텍스트</strong>
          <span>썸네일만 텍스트 포함 여부를 선택합니다. 소제목 이미지는 항상 텍스트 없음.</span>
        </div>
        <div class="agent-thumb-text-toggle">
          <button type="button" data-agent-thumb-text="include" class="${settings.thumbnailTextMode !== 'none' ? 'is-active' : ''}" ${disabledAttr}>포함</button>
          <button type="button" data-agent-thumb-text="none" class="${settings.thumbnailTextMode === 'none' ? 'is-active' : ''}" ${disabledAttr}>미포함</button>
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
    ? '공식 5시간 세션 잔여량'
    : '공식 구독 잔여량';

  detail.innerHTML = `
    <div class="agent-mode-provider-card">
      <div class="agent-mode-provider-top">
        <div>
          <strong>${escapeHtml(meta.title)}</strong>
          <span>${escapeHtml(`${meta.label} ${toolLabel} · ${loginLabel}`)}</span>
        </div>
        <span class="agent-mode-pill ${allowed && ready ? 'is-ready' : 'is-locked'}">${allowed ? loginLabel : '3개월 이상 필요'}</span>
      </div>

      <div class="agent-mode-provider-layout">
        <div class="agent-mode-provider-main">
          <div class="agent-mode-plan-grid">
            <div>
              <strong>현재 구독 플랜</strong>
              <span>앱에서 자동 실측 불가</span>
            </div>
              <div>
                <strong>공식 사용량 기준</strong>
                <span>${provider === 'claude' ? '5시간 세션/동적 제한' : 'Plus/Pro 또는 Workspace Analytics'}</span>
              </div>
            <div>
              <strong>이 앱 작업 기록</strong>
              <span>${history.runs}회 · ${history.windowText}</span>
            </div>
            <div>
              <strong>실측 토큰 기록</strong>
              <span>${history.measuredJobs}회 · 입력 ${history.inputTokens.toLocaleString()} / 출력 ${history.outputTokens.toLocaleString()}</span>
            </div>
            <div>
              <strong>실측 비용 기록</strong>
              <span>${history.costUsd > 0 ? `$${history.costUsd.toFixed(4)}` : '제공 시 표시'}</span>
            </div>
          </div>

          <div class="agent-mode-measure">
            <div class="agent-mode-gauge is-unknown"><span style="width:0%;"></span></div>
            <p><b>${escapeHtml(gaugeLabel)}:</b> ${escapeHtml(meta.measuredStatus)}</p>
            <p>${escapeHtml(meta.estimateText)}</p>
            <p>로컬 기록 리셋까지 ${escapeHtml(history.nextResetText)} 남았습니다. 토큰/비용은 CLI가 반환한 경우에만 실측으로 기록됩니다.</p>
          </div>
          ${renderAgentImageSettingsPanel(provider)}
        </div>

        <aside class="agent-mode-action-panel">
          <strong>빠른 작업</strong>
          <button type="button" class="agent-mode-primary-action" data-install-agent="${escapeHtml(provider)}">${escapeHtml(tool?.installed && tool.usable !== false ? `${meta.label} 설치/업데이트` : `${meta.label} 설치하기`)}</button>
          <button type="button" class="agent-mode-primary-action" data-agent-login="${escapeHtml(provider)}">${escapeHtml(ready ? `${meta.label} 로그인 완료 확인` : `${meta.label} 로그인 창 열기`)}</button>
          <button type="button" data-agent-refresh="true">상태 새로고침</button>
          <div class="agent-mode-link-grid">
            <button type="button" data-open-url="${escapeHtml(meta.planUrl)}">현재 플랜</button>
            <button type="button" data-open-url="${escapeHtml(meta.analyticsUrl)}">사용량</button>
            <button type="button" data-open-url="${escapeHtml(meta.upgradeUrl)}">업그레이드</button>
            <button type="button" data-open-url="${escapeHtml(meta.docsUrl)}">공식 기준</button>
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
    button.addEventListener('click', () => startAgentLogin(button.getAttribute('data-agent-login') || provider));
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
  if (modalRunButton && !modalRunButton.disabled) modalRunButton.textContent = `${meta.label}로 생성`;
  renderAgentProviderTabs();
  renderSettingsProfileSelect();
}

function setExecutionMode(mode) {
  const nextMode = mode === 'agent' ? 'agent' : 'api';
  if (nextMode === 'agent' && !isMaxAgentAllowed(state.agentStatus)) {
    alert(state.agentStatus?.message || 'Agent 모드는 3개월 이상 코드에서 사용할 수 있습니다.');
    state.executionMode = 'api';
  } else {
    state.executionMode = nextMode;
  }
  saveExecutionPrefs();
  applyExecutionModeToApp();
  renderAgentSettingsSection();
  refreshGlobalAiModelBadge();
  addLog(`실행 모드를 ${state.executionMode === 'agent' ? 'Agent 모드' : 'API 키 모드'}로 변경했습니다.`, 'info');
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
    badge.textContent = !status ? '확인 중' : state.executionMode === 'agent' ? (allowed ? 'Agent 모드' : 'Agent 잠김') : 'API 키 모드';
    badge.className = `agent-mode-pill ${state.executionMode === 'agent' && allowed ? 'is-ready' : state.executionMode === 'api' ? '' : 'is-locked'}`;
  }

  if (summary) {
    summary.textContent = status
      ? `현재 코드: ${status.currentName || '확인 실패'} · Max 기준: ${status.requiredName || '스탠다드 (3개월)'}`
      : '라이선스와 설치 도구를 확인하고 있습니다.';
  }

  if (description) {
    description.textContent = state.executionMode === 'agent'
      ? 'Agent 모드가 선택되어 아래 AI 텍스트 엔진과 API 키 입력칸은 숨겨집니다. Codex와 Claude Code는 아래에서 하나만 선택해 사용합니다.'
      : 'API 키 모드가 선택되었습니다. 아래 API 키 입력칸과 기존 모델 선택 UI를 사용합니다.';
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
        <div class="agent-mode-eyebrow">AI 실행 방식</div>
        <h3>API 키 모드 / Agent 모드</h3>
        <p id="agentModeSettingsDescription">API 모드에서는 키 입력칸을 보여주고, Agent 모드에서는 키 입력칸과 모델 선택을 숨깁니다.</p>
      </div>
      <span id="agentModeSettingsBadge" class="agent-mode-pill">확인 중</span>
    </div>

    <div class="agent-mode-summary" id="agentModeSettingsSummary">상태 확인 중...</div>

    <div class="agent-mode-mode-switch">
      <button type="button" id="executionModeApiBtn" class="agent-mode-choice">API 키 모드</button>
      <button type="button" id="executionModeAgentBtn" class="agent-mode-choice">Agent 모드</button>
    </div>

    <div class="agent-mode-dual-grid">
      <div class="agent-mode-execution-panel" id="apiExecutionPanel">
        <div class="agent-mode-panel-title">
          <strong>API 키 충전형</strong>
          <span>선택한 API 키만 사용합니다. Agent 실행은 꺼집니다.</span>
        </div>
        <div class="agent-mode-control-grid">
          <label>
            <span>글 생성 API</span>
            <select id="apiTextProviderSelect">
              ${API_TEXT_PROVIDERS.map((provider) => `<option value="${escapeHtml(provider.id)}">${escapeHtml(provider.label)}</option>`).join('')}
            </select>
          </label>
          <label>
            <span>이미지 생성 API</span>
            <select id="apiImageProviderSelect">
              ${API_IMAGE_PROVIDERS.map((provider) => `<option value="${escapeHtml(provider.id)}">${escapeHtml(provider.label)}</option>`).join('')}
            </select>
          </label>
        </div>
        <div id="apiProviderCards" class="agent-mode-provider-list"></div>
      </div>

      <div class="agent-mode-execution-panel" id="agentExecutionPanel">
        <div class="agent-mode-panel-title">
          <strong>Agent 구독형</strong>
          <span>3개월 이상 코드에서 Codex 또는 Claude Code 구독 계정으로 실행합니다. API 키 입력칸은 꺼집니다.</span>
        </div>
        <div class="agent-mode-tool-row" id="agentModeToolStatus"></div>
        <div class="agent-provider-tabs">
          <button type="button" id="agentProviderTabCodex" class="agent-provider-tab">Codex</button>
          <button type="button" id="agentProviderTabClaude" class="agent-provider-tab">Claude Code</button>
        </div>
        <div id="agentProviderDetail"></div>

        <div class="agent-mode-maintenance-actions">
          <button type="button" id="agentUsageResetBtn">로컬 기록 초기화</button>
        </div>
        <textarea id="agentModeSettingsLoginCommand" class="codex-workshop-textarea codex-workshop-code" style="display:none;" readonly></textarea>
      </div>
    </div>

    <div id="agentModeSettingsStatus" class="codex-workshop-note" style="display:none;"></div>
    <div class="agent-mode-footnote">원칙: 실측 불가능한 잔여량은 숫자로 표시하지 않습니다. API는 제공사 대시보드, Agent는 공식 구독/Analytics 화면 기준으로 확인합니다.</div>
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
  $('agentUsageResetBtn')?.addEventListener('click', () => {
    resetAgentUsageWindow();
    setSettingsStatus('이 앱의 로컬 Agent 실행 기록을 초기화했습니다.');
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
  if (normalized === 'thumbnail-only') return '썸네일 1장만 생성하고 본문 H2 이미지는 만들지 않습니다.';
  if (normalized === 'odd-only') return '썸네일 1장과 홀수 번째 H2(1, 3, 5...) 이미지만 생성합니다.';
  if (normalized === 'even-only') return '썸네일 1장과 짝수 번째 H2(2, 4, 6...) 이미지만 생성합니다.';
  if (normalized === 'none') return '이미지를 생성하지 않고 글 HTML만 완성합니다.';
  return '썸네일 1장과 모든 H2 소제목 이미지를 생성합니다.';
}

function buildCodexArticleTask(payload = {}) {
  const topic = getTopic(payload);
  const references = getReferenceLines(payload);
  const platform = normalizePlatformName(payload.targetPlatform || payload.platform);
  const sectionCount = Number(payload.sectionCount || 5);
  const minChars = payload.minChars ? Number(payload.minChars).toLocaleString() : 'enough';
  const maxChars = payload.maxChars ? Number(payload.maxChars).toLocaleString() : 'natural';

  return `Codex 작업실 지시서

목표:
- 아래 설정을 기준으로 발행 가능한 블로그 글 HTML을 만든다.
- 결과는 Orbit 앱에 다시 넣을 수 있도록 HTML만 깔끔하게 출력한다.

입력 설정:
- 핵심 키워드: ${topic || '(keyword empty)'}
- 플랫폼: ${platform}
- 글 유형: ${payload.contentMode || 'general'}
- 말투: ${payload.toneStyle || '친절한 존댓말'}
- H2 소제목 수: ${sectionCount}개 내외
- 목표 길이: ${minChars}자 이상, ${maxChars}자 이하
- 참고 URL:
${references.length ? references.map((url, index) => `  ${index + 1}. ${url}`).join('\n') : '  없음'}

작업 방식:
1. 검색 의도와 독자 페르소나를 먼저 추론한다.
2. 초반 3문단은 독자가 바로 자기 상황이라고 느끼게 쓴다.
3. H2 구조는 독자가 확인해야 할 순서대로 배치한다.
4. 정책, 지원금, 가격, 일정처럼 변동 가능한 내용은 공식 확인 흐름을 넣는다.
5. 과장, 확정 수익, 루머, 출처 불명 수치, 자동 생성 티 나는 문장을 피한다.
6. 본문 중간에 체크리스트나 비교 표가 필요하면 HTML 표로 넣는다.
7. 마지막에는 독자가 다음 행동을 정할 수 있는 짧은 정리 문단을 넣는다.

출력 규칙:
- 설명하지 말고 최종 HTML만 출력한다.
- script, iframe, form, onclick, 추적 코드는 넣지 않는다.
- 아래 구조를 유지한다.

<article class="bgpt-wp-ready bgpt-codex-workshop">
  <h1>제목</h1>
  <p>도입 문단</p>
  <h2>소제목</h2>
  <p>본문</p>
  <h2>자주 묻는 질문</h2>
  <h3>질문</h3>
  <p>답변</p>
  <h2>마무리</h2>
  <p>정리 문단</p>
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
    ? '중요: Claude Code에는 자체 이미지 생성 모델이 없습니다. 실제 이미지는 앱의 이미지 엔진(GPT Image, Gemini Image, Leonardo, Flow 등)으로 별도 생성하고, Claude Code는 이미지 프롬프트/구도/alt/삽입 위치만 설계합니다.'
    : '중요: Codex는 작업 Agent입니다. 이미지 생성 기능이 연결된 환경에서는 GPT Image 등 별도 이미지 엔진으로 생성하고, 그렇지 않으면 이미지 프롬프트/구도/alt/삽입 위치를 설계합니다.';

  return `${agentLabel} 이미지 작업 지시서

목표:
- 글 주제에 맞는 블로그 썸네일 또는 본문 이미지 방향을 설계한다.
- 가능하면 16:9 썸네일 1장과 H2별 이미지 아이디어를 함께 정리한다.
- ${imageCapabilityNote}

입력 설정:
- 핵심 키워드: ${topic || '(keyword empty)'}
- 플랫폼: ${platform}
- 이미지 생성 범위: ${describeImagePolicy(imagePolicy)}
- 썸네일 텍스트: ${thumbnailTextIncluded ? '포함 가능. 단, 짧은 한국어 제목형 문구만 사용' : '미포함. 썸네일에도 글자를 넣지 않음'}
- 소제목 이미지 텍스트: 항상 미포함. H2 이미지는 간판, 자막, 문구, 로고, 워터마크 없이 장면만 생성
- 참고 URL:
${references.length ? references.map((url, index) => `  ${index + 1}. ${url}`).join('\n') : '  없음'}

이미지 방향:
- 한국 생활정보/정책형 블로그에 어울리는 현실감 있는 장면
- 밝고 선명한 대비
- 제목을 얹을 수 있는 여백 확보
- 특정 브랜드 로고, 유명인 얼굴, 오해 가능한 공공기관 직인 표현 금지
- 썸네일 텍스트 미포함 또는 H2 이미지에서는 텍스트 없는 이미지로 생성하고 제목 영역만 비워둔다.

출력:
1. 선택한 이미지 생성 범위에 맞는 썸네일/H2 이미지 프롬프트
2. H2별 이미지 아이디어. 선택 범위 밖 H2는 "skip"으로 표시
3. 썸네일 문구 후보 3개. 썸네일 텍스트 미포함이면 빈 배열로 표시
4. 실제 생성에 사용할 추천 이미지 엔진`;
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
      <p>3개월 이상 코드는 Codex/Claude 구독 계정 작업실을 열고, 1개월 코드는 기존 API 키 생성 흐름을 유지합니다.</p>
      <div id="${ENTRY_STATUS_ID}" class="codex-workshop-status is-muted">라이선스 상태 확인 중...</div>
    </div>
    <button type="button" class="codex-workshop-btn codex-workshop-primary" id="openCodexWorkshopBtn">상태 확인 중</button>
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
          <h3 id="codexWorkshopTitle">Agent 작업실</h3>
          <p id="codexWorkshopSubtitle">선택한 Agent가 글 구조, 이미지 방향, 품질 기준을 한 번에 이해하도록 현재 앱 설정을 작업 단위로 정리합니다.</p>
        </div>
        <button type="button" class="codex-workshop-close" id="closeCodexWorkshopBtn" aria-label="닫기">X</button>
      </div>
      <div class="codex-workshop-body">
        <div style="display:grid;gap:16px;">
          <section class="codex-workshop-panel">
            <h4>1. 글 작업지시서</h4>
            <div class="codex-workshop-actions">
              <button type="button" class="codex-workshop-btn codex-workshop-success" id="copyCodexArticleTaskBtn">글 지시서 복사</button>
            </div>
            <textarea id="codexArticleTask" class="codex-workshop-textarea" readonly></textarea>
          </section>
          <section class="codex-workshop-panel">
            <h4>2. 이미지 작업지시서</h4>
            <div class="codex-workshop-actions">
              <button type="button" class="codex-workshop-btn codex-workshop-secondary" id="copyCodexImageTaskBtn">이미지 지시서 복사</button>
            </div>
            <textarea id="codexImageTask" class="codex-workshop-textarea" readonly></textarea>
          </section>
        </div>
        <div style="display:grid;gap:16px;">
          <section class="codex-workshop-panel">
            <h4>Max Agent 계정</h4>
            <div id="${AGENT_STATUS_ID}" class="codex-workshop-note">Agent Mode 상태를 확인 중입니다.</div>
            <select id="${AGENT_PROFILE_SELECT_ID}" class="codex-workshop-select" style="display:none;">
              <option value="">계정 준비 중</option>
            </select>
            <div class="codex-workshop-actions" style="margin-top:12px;">
              <button type="button" class="codex-workshop-btn codex-workshop-secondary" id="startCodexAgentLoginBtn">로그인 창 열기</button>
              <button type="button" class="codex-workshop-btn codex-workshop-success" id="${RUN_AGENT_JOB_BTN_ID}">선택 Agent로 생성</button>
            </div>
            <textarea id="${AGENT_LOGIN_COMMAND_ID}" class="codex-workshop-textarea codex-workshop-code" style="display:none;" readonly></textarea>
            <div id="${AGENT_RUN_STATUS_ID}" class="codex-workshop-note" style="display:none;"></div>
          </section>
          <section class="codex-workshop-panel">
            <h4>3. Codex 산출물 적용</h4>
            <textarea id="codexResultPaste" class="codex-workshop-textarea codex-workshop-paste" placeholder="Codex가 만든 최종 HTML을 여기에 붙여넣으세요."></textarea>
            <div class="codex-workshop-actions" style="margin-top:12px;margin-bottom:0;">
              <button type="button" class="codex-workshop-btn codex-workshop-success" id="applyCodexResultBtn">미리보기로 적용</button>
              <button type="button" class="codex-workshop-btn codex-workshop-secondary" id="clearCodexResultBtn">내용 비우기</button>
            </div>
          </section>
          <section class="codex-workshop-panel">
            <h4>운영 설계</h4>
            <div class="codex-workshop-note">
              다음 단계에서는 Codex CLI 또는 Codex app-server를 Electron 백엔드에 연결해 작업지시서 생성 후 산출물 파일을 자동으로 회수하는 구조로 확장할 수 있습니다.
            </div>
          </section>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  $('closeCodexWorkshopBtn')?.addEventListener('click', closeCodexWorkshopPanel);
  $('copyCodexArticleTaskBtn')?.addEventListener('click', () => copyText(state.articleTask, '글 작업지시서'));
  $('copyCodexImageTaskBtn')?.addEventListener('click', () => copyText(state.imageTask, '이미지 작업지시서'));
  $('applyCodexResultBtn')?.addEventListener('click', applyCodexResult);
  $('clearCodexResultBtn')?.addEventListener('click', () => { const el = $('codexResultPaste'); if (el) el.value = ''; });
  $('startCodexAgentLoginBtn')?.addEventListener('click', () => startAgentLogin(state.activeAgentProvider));
  $(RUN_AGENT_JOB_BTN_ID)?.addEventListener('click', runAgentJobFromModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeCodexWorkshopPanel();
  });

  return modal;
}

function renderToolStatus(tool, label) {
  if (!tool) return `${label}: 확인 전`;
  if (tool.installed && tool.usable === false) return `${label}: 실행 권한 확인 필요`;
  if (tool.installed) return `${label}: 설치됨`;
  return `${label}: 미감지`;
}

function renderProfileSummary(profiles = []) {
  if (!profiles.length) {
    return '<span>아직 로그인 계정이 없습니다. 로그인 창 열기를 먼저 눌러주세요.</span>';
  }

  return profiles
    .map((profile) => `<span>${escapeHtml(profile.label)} · ${escapeHtml(profile.provider)} · ${escapeHtml(getProviderLoginLabel(profile.provider, profile))}</span>`)
    .join('');
}

function renderAgentProfileSelect() {
  const select = $(AGENT_PROFILE_SELECT_ID);
  if (!select) return;

  const profiles = (Array.isArray(state.agentStatus?.profiles) ? state.agentStatus.profiles : [])
    .filter((profile) => profile.provider === state.activeAgentProvider);
  const previous = select.value;

  if (!profiles.length) {
    select.innerHTML = `<option value="">${state.activeAgentProvider === 'claude' ? 'Claude' : 'Codex'} 계정 준비 중</option>`;
    select.disabled = true;
    return;
  }

  select.disabled = false;
  select.innerHTML = profiles
    .map((profile) => {
      const label = `${profile.provider === 'claude' ? 'Claude' : 'Codex'} · ${profile.label} · ${getProviderLoginLabel(profile.provider, profile)}`;
      return `<option value="${escapeHtml(profile.id)}">${escapeHtml(label)}</option>`;
    })
    .join('');

  if (previous && profiles.some((profile) => profile.id === previous)) {
    select.value = previous;
  }
}

function getSelectedAgentProfile() {
  const profiles = Array.isArray(state.agentStatus?.profiles) ? state.agentStatus.profiles : [];
  const selectedId = $(AGENT_PROFILE_SELECT_ID)?.value || '';
  const provider = state.activeAgentProvider || 'codex';
  return profiles.find((profile) => profile.id === selectedId && profile.provider === provider)
    || profiles.find((profile) => profile.provider === provider)
    || null;
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
    panel.innerHTML = 'Agent Mode 상태를 확인 중입니다.';
    return;
  }

  const codexTool = renderToolStatus(status.tools?.codex, 'Codex');
  const claudeTool = renderToolStatus(status.tools?.claude, 'Claude');
  const modeLabel = isMaxAgentAllowed(status) ? 'Max Agent Mode' : 'API 키 모드';
  const modeClass = isMaxAgentAllowed(status) ? 'is-ready' : 'is-locked';

  panel.innerHTML = `
    <div class="codex-workshop-status ${modeClass}" style="margin-top:0;">${escapeHtml(modeLabel)}</div>
    <div class="codex-workshop-agent-grid">
      <div class="codex-workshop-agent-card">
        <strong>라이선스</strong>
        <span>현재: ${escapeHtml(status.currentName || '확인 실패')}</span>
        <span>Max 기준: ${escapeHtml(status.requiredName || '스탠다드 (3개월)')}</span>
      </div>
      <div class="codex-workshop-agent-card">
        <strong>도구 감지</strong>
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
    alert(status?.message || 'Max Agent Mode는 3개월 이상 코드에서 사용할 수 있습니다.');
    return null;
  }

  const api = getBridgeApi();
  try {
    const payload = {
      provider,
      authMode: 'subscription',
      label: provider === 'claude' ? 'Claude 구독 계정' : 'Codex 구독 계정',
    };
    const result = typeof api?.createAgentProfile === 'function'
      ? await api.createAgentProfile(payload)
      : await api?.invoke?.('agent-mode:create-profile', payload);

    if (!result?.ok) {
      alert(result?.error || 'Agent 계정 준비에 실패했습니다.');
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
    if (settingsSelect && result.profile?.id) settingsSelect.value = result.profile.id;
    setSettingsStatus(`${provider === 'claude' ? 'Claude' : 'Codex'} 계정 준비가 끝났습니다. 로그인 창에서 구독 계정으로 로그인하세요.`);
    addLog(`${provider === 'claude' ? 'Claude' : 'Codex'} 계정 준비가 끝났습니다. 로그인 창에서 공식 로그인을 진행하세요.`, 'success');
    return result.profile || null;
  } catch (error) {
    console.error('[CODEX-WORKSHOP] create agent profile failed:', error);
    alert(`Agent 계정 준비에 실패했습니다: ${error?.message || error}`);
    setSettingsStatus(`Agent 계정 준비 실패: ${error?.message || error}`, 'error');
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
        setSettingsStatus(`${label} 로그인 완료를 확인했습니다. 이제 Agent 모드에서 사용할 수 있습니다.`, 'success');
        addLog(`${label} 로그인 완료가 자동 확인되었습니다.`, 'success');
        return;
      }

      if (Date.now() - state.loginPollStartedAt > 5 * 60 * 1000) {
        stopAgentLoginPolling();
        setSettingsStatus(`${label} 로그인 완료를 아직 확인하지 못했습니다. 브라우저 로그인이 끝났다면 상태 새로고침을 한 번 눌러주세요.`, 'error');
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
      triggerButton.textContent = `${label} 설치 중...`;
    }
    setSettingsStatus(`${label} 설치를 시작했습니다. 설치 모달에서 진행 상태를 확인하세요.`);
    updateAgentInstallModal({
      label,
      status: `${label} 설치 명령을 실행 중입니다.`,
      output: normalizedProvider === 'codex' ? 'npm install -g @openai/codex' : '공식 설치 명령 실행 중...',
      type: 'info',
    });
    const result = typeof api?.installAgentTool === 'function'
      ? await api.installAgentTool({ provider: normalizedProvider })
      : await api?.invoke?.('agent-mode:install-tool', { provider: normalizedProvider });

    if (!result?.ok) {
      const output = [
        result?.command ? `명령: ${result.command}` : '',
        result?.error ? `오류: ${result.error}` : '',
        result?.output || '',
      ].filter(Boolean).join('\n\n');
      updateAgentInstallModal({
        label,
        status: result?.error || `${label} 설치에 실패했습니다.`,
        output,
        type: 'error',
      });
      alert(result?.error || `${label} 설치에 실패했습니다.`);
      setSettingsStatus(result?.error || `${label} 설치에 실패했습니다.`, 'error');
      return null;
    }

    const verified = result.verified || result.tool?.usable === true;
    const output = [
      result.command ? `명령: ${result.command}` : '',
      result.output || '',
      result.tool?.version ? `\n확인: ${result.tool.version}` : '',
      !verified && result.tool?.error ? `\n실행 확인 오류: ${result.tool.error}` : '',
    ].filter(Boolean).join('\n\n');
    updateAgentInstallModal({
      label,
      status: verified ? `${label} 설치가 완료되었습니다.` : `${label} 설치는 끝났지만 실행 확인이 필요합니다.`,
      output,
      type: verified ? 'success' : 'error',
    });
    setSettingsStatus(verified
      ? `${label} 설치가 완료되었습니다. 이제 로그인 창 열기를 눌러주세요.`
      : `${label} 설치는 끝났지만 실행 확인이 필요합니다. 설치 로그를 확인해주세요.`,
      verified ? 'success' : 'error');
    addLog(`${label} 설치 명령이 완료되었습니다.`, verified ? 'success' : 'warning');
    await loadAgentModeStatus(true);
    return result;
  } catch (error) {
    console.error('[CODEX-WORKSHOP] install agent tool failed:', error);
    updateAgentInstallModal({
      label,
      status: `${label} 설치 실행 중 오류가 발생했습니다.`,
      output: error?.message || String(error || ''),
      type: 'error',
    });
    alert(`${label} 설치를 실행하지 못했습니다: ${error?.message || error}`);
    setSettingsStatus(`${label} 설치 실행 실패: ${error?.message || error}`, 'error');
    return null;
  } finally {
    state.installRunning = false;
    if (triggerButton) {
      triggerButton.disabled = false;
      triggerButton.textContent = previousText || `${label} 설치하기`;
    }
  }
}

async function startAgentLogin(provider = state.activeAgentProvider) {
  const status = await loadAgentModeStatus(true);
  if (!isMaxAgentAllowed(status)) {
    alert(status?.message || 'Agent 모드는 3개월 이상 코드에서 사용할 수 있습니다.');
    return;
  }

  const normalizedProvider = provider === 'claude' ? 'claude' : 'codex';
  const tool = status?.tools?.[normalizedProvider];
  const label = normalizedProvider === 'claude' ? 'Claude Code' : 'Codex';
  if (!tool?.installed) {
    setSettingsStatus(`${label} 설치가 먼저 필요합니다. 설치 버튼으로 설치/확인을 끝낸 뒤 로그인 창을 열어주세요.`, 'error');
    return;
  }
  if (tool.usable === false) {
    setSettingsStatus(`${label} 실행 확인이 아직 완료되지 않았습니다. 설치 버튼에서 실행 확인을 먼저 끝낸 뒤 로그인 창을 열어주세요.`, 'error');
    return;
  }

  let profile = getProviderProfile(normalizedProvider);
  if (!profile) {
    profile = await createAgentProfile(normalizedProvider);
  }
  if (!profile) {
    alert('로그인할 Agent 계정 준비에 실패했습니다.');
    return;
  }

  if (isAgentProfileReady(profile)) {
    setSettingsStatus(`${label} 로그인 완료 상태입니다. 바로 Agent 모드에서 사용할 수 있습니다.`, 'success');
    addLog(`${label} 로그인 완료 상태를 확인했습니다.`, 'success');
    return;
  }

  const api = getBridgeApi();
  try {
    const result = typeof api?.startAgentLogin === 'function'
      ? await api.startAgentLogin({ id: profile.id, provider: normalizedProvider })
      : await api?.invoke?.('agent-mode:start-login', { id: profile.id, provider: normalizedProvider });

    if (!result?.ok) {
      alert(result?.error || '로그인 창을 열지 못했습니다.');
      setSettingsStatus(result?.error || '로그인 창을 열지 못했습니다.', 'error');
      return;
    }

    const commandEl = $(AGENT_LOGIN_COMMAND_ID);
    if (commandEl) commandEl.value = result.command || profile.loginCommand || '';
    const settingsCommandEl = $('agentModeSettingsLoginCommand');
    if (settingsCommandEl) settingsCommandEl.value = result.command || profile.loginCommand || '';
    setSettingsStatus(`${label} 로그인 브라우저를 열었습니다. 로그인 완료 여부를 자동으로 확인하는 중입니다.`);
    addLog(`${label} 로그인 브라우저를 열었습니다. 완료되면 앱 상태가 자동으로 바뀝니다.`, 'info');
    startAgentLoginPolling(normalizedProvider, profile.id);
  } catch (error) {
    console.error('[CODEX-WORKSHOP] start agent login failed:', error);
    alert(`로그인 창을 열 수 없습니다: ${error?.message || error}`);
    setSettingsStatus(`로그인 창 실행 실패: ${error?.message || error}`, 'error');
  }
}

async function runAgentJob({ payload: inputPayload = null, button = null, source = 'modal' } = {}) {
  loadExecutionPrefs();
  if (state.executionMode !== 'agent') {
    throw new Error('현재 API 키 모드입니다. 환경설정에서 Agent 모드를 선택한 뒤 다시 실행해주세요.');
  }

  const status = await loadAgentModeStatus(true);
  if (!isMaxAgentAllowed(status)) {
    throw new Error(status?.message || 'Max Agent Mode는 3개월 이상 코드에서 사용할 수 있습니다.');
  }

  if (source === 'posting') {
    updateAgentProgress(24, 'Agent 모드: 라이선스와 구독 권한을 확인했습니다.');
  }

  let profile = getSelectedAgentProfile();
  if (!profile) {
    profile = await createAgentProfile(state.activeAgentProvider);
  }
  if (!profile) {
    throw new Error('Agent 계정 준비에 실패했습니다. 먼저 로그인 창 열기로 구독 계정 로그인을 진행해주세요.');
  }
  if (!isAgentProfileReady(profile)) {
    const providerLabel = state.activeAgentProvider === 'claude' ? 'Claude Code' : 'Codex';
    setSettingsStatus(`${providerLabel} 로그인 완료가 필요합니다. 로그인 성공이 자동으로 감지됩니다.`, 'error');
    throw new Error(`${providerLabel} 로그인이 아직 완료되지 않았습니다. 로그인 창 열기를 누른 뒤 완료될 때까지 기다려주세요.`);
  }

  if (source === 'posting') {
    updateAgentProgress(30, `${profile.provider === 'claude' ? 'Claude Code' : 'Codex'} 로그인 상태를 확인했습니다.`);
  }

  const payload = inputPayload || state.payload || await createPreviewPayload();
  const topic = getTopic(payload);
  if (!topic) {
    throw new Error('먼저 키워드나 제목을 입력해주세요.');
  }

  state.payload = payload;
  const editedArticleTask = source === 'modal' ? $('codexArticleTask')?.value?.trim() : '';
  const editedImageTask = source === 'modal' ? $('codexImageTask')?.value?.trim() : '';
  state.articleTask = editedArticleTask || buildCodexArticleTask(payload);
  state.imageTask = editedImageTask || buildCodexImageTask(payload);
  setModalValues();
  if (source === 'posting') {
    updateAgentProgress(38, '글 생성 지시서와 이미지 생성 지시서를 준비했습니다.');
  }

  const providerLabel = profile.provider === 'claude' ? 'Claude Code' : 'Codex';
  if (button) {
    button.disabled = true;
    button.textContent = 'Agent 생성 중...';
  }
  setAgentRunStatus(`${providerLabel}가 현재 상세설정을 읽고 글 생성을 시작했습니다. 첫 실행은 로그인 상태 확인 때문에 시간이 걸릴 수 있습니다.`);
  addLog(`${providerLabel} Agent 생성을 시작했습니다.`, 'info');

  const api = getBridgeApi();
  if (source === 'posting') {
    updateAgentProgress(46, `${providerLabel}가 글 본문과 이미지 산출물을 생성 중입니다.`);
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
        updateAgentProgress(62, `${providerLabel}가 이미지 산출물과 본문 삽입 구성을 정리 중입니다.`);
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
    setAgentRunStatus(detail || 'Agent 생성에 실패했습니다.', 'error');
    throw new Error(detail || result?.error || 'Agent 생성에 실패했습니다. 로그인 상태를 확인해주세요.');
  }

  let content = String(result.content || '').trim();
  if (!content) {
    setAgentRunStatus('Agent는 완료되었지만 HTML 출력물이 비어 있습니다.', 'error');
    throw new Error('Agent 출력물이 비어 있습니다. 상세설정을 확인한 뒤 다시 시도해주세요.');
  }

  if (source === 'posting') {
    updateAgentProgress(72, `Agent 산출물을 회수했습니다. (${getTextLength(content).toLocaleString()}자)`, 'success');
  }

  const imageEnhancement = await enhanceCodexAgentImages(content, payload, result.title || topic);
  content = imageEnhancement.content || content;

  const pasteEl = $('codexResultPaste');
  if (pasteEl) pasteEl.value = content;
  recordAgentUsage(profile.provider, result.jobId || '', result.usage || null);
  setAgentRunStatus(`생성 완료: ${result.title || topic}${result.jobId ? ` · 작업 ID ${result.jobId}` : ''}`);
  setSettingsStatus(`${providerLabel} 작업 1회를 로컬 실행 기록에 저장했습니다.`);
  addLog(`Agent 출력물을 회수했습니다. (${getTextLength(content).toLocaleString()}자)`, 'success');
  await applyCodexResult({ thumbnailUrl: imageEnhancement.thumbnailUrl || '' });
  if (source === 'posting') {
    updateAgentProgress(82, '글과 이미지 산출물을 미리보기에 적용했습니다. 발행 단계로 넘어갑니다.', 'success');
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
    return;

    loadExecutionPrefs();
    if (state.executionMode !== 'agent') {
      alert('현재 API 키 모드입니다. Agent 모드를 선택한 뒤 실행해주세요.');
      return;
    }

    const status = await loadAgentModeStatus(true);
    if (!isMaxAgentAllowed(status)) {
      alert(status?.message || 'Max Agent Mode는 3개월 이상 코드에서 사용할 수 있습니다.');
      return;
    }

    let profile = getSelectedAgentProfile();
    if (!profile) {
      profile = await createAgentProfile(state.activeAgentProvider);
    }
    if (!profile) {
      alert('Agent 계정 준비에 실패했습니다. 먼저 로그인 창 열기를 눌러 구독 계정 로그인을 진행해주세요.');
      return;
    }
    if (!isAgentProfileReady(profile)) {
      alert(`${state.activeAgentProvider === 'claude' ? 'Claude Code' : 'Codex'} 로그인이 아직 완료되지 않았습니다. 로그인 창 열기를 누른 뒤 완료될 때까지 기다려주세요.`);
      setSettingsStatus(`${state.activeAgentProvider === 'claude' ? 'Claude Code' : 'Codex'} 로그인 완료가 필요합니다. 로그인 후 앱이 자동으로 감지합니다.`, 'error');
      return;
    }

    const payload = state.payload || await createPreviewPayload();
    const topic = getTopic(payload);
    if (!topic) {
      alert('먼저 키워드나 제목을 입력해주세요.');
      return;
    }

    state.payload = payload;
    state.articleTask = state.articleTask || buildCodexArticleTask(payload);
    state.imageTask = state.imageTask || buildCodexImageTask(payload);
    setModalValues();

    if (button) {
      button.disabled = true;
      button.textContent = 'Agent 생성 중...';
    }
    setAgentRunStatus(`${profile.provider === 'claude' ? 'Claude' : 'Codex'}가 작업 폴더를 읽고 글을 생성 중입니다. 첫 실행은 로그인 상태 확인 때문에 시간이 걸릴 수 있습니다.`);
    addLog(`${profile.provider === 'claude' ? 'Claude' : 'Codex'} Agent 작업을 시작했습니다.`, 'info');

    const api = getBridgeApi();
    const request = {
      profileId: profile.id,
      provider: profile.provider,
      payload,
      articleTask: state.articleTask,
      imageTask: state.imageTask,
      title: topic,
    };

    const result = typeof api?.runAgentJob === 'function'
      ? await api.runAgentJob(request)
      : await api?.invoke?.('agent-mode:run-job', request);

    if (!result?.ok) {
      const detail = [result?.error, result?.stderr].filter(Boolean).join('\n\n').trim();
      setAgentRunStatus(detail || 'Agent 생성에 실패했습니다.', 'error');
      alert(result?.error || 'Agent 생성에 실패했습니다. 로그인 상태를 확인해주세요.');
      return;
    }

    const content = String(result.content || '').trim();
    if (!content) {
      setAgentRunStatus('Agent는 완료됐지만 HTML 산출물이 비어 있습니다.', 'error');
      alert('Agent 산출물이 비어 있습니다. 작업지시서를 줄여 다시 시도해주세요.');
      return;
    }

    const pasteEl = $('codexResultPaste');
    if (pasteEl) pasteEl.value = content;
    recordAgentUsage(profile.provider, result.jobId || '', result.usage || null);
    setAgentRunStatus(`생성 완료: ${result.title || topic} · 작업 ID ${result.jobId}`);
    setSettingsStatus(`${profile.provider === 'claude' ? 'Claude Code' : 'Codex'} 작업 1회를 로컬 실행 기록에 저장했습니다.`);
    addLog(`Agent 산출물을 회수했습니다. (${getTextLength(content).toLocaleString()}자)`, 'success');
    await applyCodexResult();
  } catch (error) {
    console.error('[CODEX-WORKSHOP] run agent job failed:', error);
    setAgentRunStatus(`Agent 생성 실패: ${error?.message || error}`, 'error');
    alert(`Agent 생성에 실패했습니다: ${error?.message || error}`);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = `${state.activeAgentProvider === 'claude' ? 'Claude Code' : 'Codex'}로 생성`;
    }
  }
}

function setModalValues() {
  const articleEl = $('codexArticleTask');
  const imageEl = $('codexImageTask');
  if (articleEl) articleEl.value = state.articleTask;
  if (imageEl) imageEl.value = state.imageTask;
}

async function copyText(text, label = '내용') {
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
    addLog(`${label}를 클립보드에 복사했습니다.`, 'success');
  } catch (error) {
    console.error('[CODEX-WORKSHOP] copy failed:', error);
    alert(`${label} 복사에 실패했습니다. 텍스트를 직접 선택해서 복사해주세요.`);
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

  return getTopic(payload) || 'Codex 생성 글';
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
  const titleHtml = hasH1 ? '' : `<h1>${escapeHtml(title || 'Codex 생성 글')}</h1>`;
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
  const platform = /wordpress|wp|워드프레스/i.test(targetPlatform)
    ? 'wordpress'
    : (/blogger|blogspot|블로그스팟/i.test(targetPlatform) ? 'blogspot' : '');

  if (!platform || !window.electronAPI?.invoke) return html;

  try {
    const prepared = await window.electronAPI.invoke('prepare-publish-content', {
      payload: { ...payload, platform },
      platform,
      content: html,
    });
    if (prepared?.ok && typeof prepared.content === 'string' && prepared.content.trim()) {
      addLog(`Codex 산출물을 ${normalizePlatformName(platform)} 발행 형식으로 정리했습니다.`, 'info');
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
      addLog(`${label} 이미지 생성 실패: ${result?.error || '이미지 URL 없음'}`, 'warning');
      return '';
    }
    return url;
  } catch (error) {
    addLog(`${label} 이미지 생성 실패: ${error?.message || error}`, 'warning');
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

  updateAgentProgress(76, `이미지 정책 적용 중: ${getAgentImagePolicyLabel(policy)}`, 'info');

  if (policy !== 'none') {
    thumbnailUrl = await generateAgentImage(
      thumbnailEngine,
      buildAgentThumbnailPrompt(title || topic, topic, thumbnailTextIncluded),
      thumbnailTextIncluded,
      '썸네일'
    );
    if (thumbnailUrl) {
      addLog('Agent 썸네일 이미지를 생성했습니다.', 'success');
      appendAgentGeneratedImagePreview({ url: thumbnailUrl, label: '썸네일' });
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

      updateAgentProgress(Math.min(82, 76 + inserted + 1), `H2 ${index} 이미지 생성 중: ${h2Text.slice(0, 28)}`, 'info');
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
      addLog(`Agent H2 이미지 ${inserted}장을 본문에 삽입했습니다.`, 'success');
    }
  } catch (error) {
    addLog(`Agent H2 이미지 후처리 실패: ${error?.message || error}`, 'warning');
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
      alert('현재 API 키 모드입니다. 환경설정에서 Agent 모드를 선택해야 Codex/Claude 작업실을 열 수 있습니다.');
      addLog('API 키 모드에서는 Agent 작업실을 열지 않습니다.', 'warning');
      return;
    }

    const agentStatus = await loadAgentModeStatus(true);
    if (!isMaxAgentAllowed(agentStatus)) {
      const message = agentStatus?.message || '현재 라이선스는 API 키 기반 생성 모드입니다.';
      alert(`${message}\n\n1개월 코드는 기존 API 키 기반 글/이미지 생성 흐름을 그대로 사용하고, Codex/Claude 구독 계정 기반 Max Agent Mode는 3개월 이상 코드에서 열립니다.`);
      addLog('현재 라이선스는 API 키 모드입니다. Max Agent Mode는 3개월 이상 코드에서 사용할 수 있습니다.', 'warning');
      return;
    }

    const payload = await createPreviewPayload();
    const topic = getTopic(payload);
    if (!topic) {
      alert('먼저 키워드나 제목을 입력해주세요.');
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
    if (titleEl) titleEl.textContent = `${providerLabel} 작업실`;
    if (subtitleEl) subtitleEl.textContent = `${providerLabel}가 현재 앱 설정을 읽고 발행 가능한 글과 이미지 방향을 생성합니다.`;

    $(MODAL_ID)?.classList.add('is-open');
    addLog(`${state.activeAgentProvider === 'claude' ? 'Claude' : 'Codex'} 작업실 지시서를 현재 설정 기준으로 준비했습니다.`, 'info');
  } catch (error) {
    console.error('[CODEX-WORKSHOP] open failed:', error);
    alert(`Codex 작업실을 열 수 없습니다: ${error?.message || error}`);
  }
}

export function closeCodexWorkshopPanel() {
  $(MODAL_ID)?.classList.remove('is-open');
}

export async function applyCodexResult(options = {}) {
  try {
    const raw = $('codexResultPaste')?.value?.trim() || '';
    if (!raw) {
      alert('Codex 산출물을 먼저 붙여넣어 주세요.');
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
    addLog(`Codex 산출물을 미리보기로 적용했습니다. (${getTextLength(html).toLocaleString()}자)`, 'success');
  } catch (error) {
    console.error('[CODEX-WORKSHOP] apply failed:', error);
    alert(`Codex 산출물 적용에 실패했습니다: ${error?.message || error}`);
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
