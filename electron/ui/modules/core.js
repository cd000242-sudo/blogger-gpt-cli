// 🔧 Core 모듈 - AppState, EventManager, DOMCache, ButtonStateManager, StorageManager, ErrorHandler, ProgressManager

// DOM 캐시 객체
export const DOMCache = {
  tabContents: null,
  tabButtons: null,
  elements: {},

  init() {
    this.tabContents = document.querySelectorAll('.tab-content');
    this.tabButtons = document.querySelectorAll('.tab-btn');
    this.preloadCommonElements();
  },

  preloadCommonElements() {
    const commonIds = [
      'publishBtn', 'generateBtn', 'previewContent', 'keywordInput', 'thumbnailType',
      'contentMode', 'topicInput', 'runBtn', 'topic', 'sectionCount', 'titleMode',
      'customSectionCount', 'scheduleTopic', 'scheduleKeywords', 'scheduleDate',
      'scheduleTime', 'scheduleContentMode', 'scheduleCtaMode', 'schedulePublishType',
      'scheduleThumbnailMode', 'schedulePlatform', 'licenseModal', 'licenseStatus',
      'licenseKey', 'licenseEmail', 'scheduleList', 'realtime-date', 'calendar-month',
      'realtime-clock', 'timezone', 'scheduleDateTime', 'bulkInterval', 'paraphraseUrl',
      'authorNickname', 'closeBtn', 'workStatusTitle', 'workStatusSubtitle'
    ];

    commonIds.forEach(id => {
      this.elements[id] = document.getElementById(id);
    });
  },

  get(id) {
    if (!this.elements[id]) {
      this.elements[id] = document.getElementById(id);
    }
    return this.elements[id];
  },

  invalidate(id) {
    if (id) {
      delete this.elements[id];
    } else {
      this.elements = {};
      this.preloadCommonElements();
    }
  },

  getValue(id) {
    const element = this.get(id);
    return element ? element.value : null;
  },

  setValue(id, value) {
    const element = this.get(id);
    if (element) {
      element.value = value;
    }
  },

  getTabContents() {
    if (!this.tabContents) this.init();
    return this.tabContents;
  },

  getTabButtons() {
    if (!this.tabButtons) this.init();
    return this.tabButtons;
  }
};

// AppState 싱글톤 클래스
const AppState = (() => {
  let instance = null;

  class AppStateClass {
    constructor() {
      if (instance) {
        return instance;
      }

      this._currentPlatform = 'wordpress';
      this._isRunning = false;
      this._isCanceled = false;
      this._currentTab = 'main';
      this._lastProgressUpdateTime = null;
      this._generatedContent = {
        title: '',
        content: '',
        thumbnailUrl: '',
        payload: null
      };
      this._manualCtasData = [];
      this._keywordCtaData = {};
      this._listeners = new Map();

      instance = this;
      return this;
    }

    get currentPlatform() {
      return this._currentPlatform;
    }

    set currentPlatform(value) {
      const oldValue = this._currentPlatform;
      this._currentPlatform = value;
      this._notify('currentPlatform', value, oldValue);
    }

    get isRunning() {
      return this._isRunning;
    }

    set isRunning(value) {
      const oldValue = this._isRunning;
      this._isRunning = value;
      this._notify('isRunning', value, oldValue);
    }

    get isCanceled() {
      return this._isCanceled;
    }

    set isCanceled(value) {
      const oldValue = this._isCanceled;
      this._isCanceled = value;
      this._notify('isCanceled', value, oldValue);
    }

    get currentTab() {
      return this._currentTab;
    }

    set currentTab(value) {
      const oldValue = this._currentTab;
      this._currentTab = value;
      this._notify('currentTab', value, oldValue);
    }

    get lastProgressUpdateTime() {
      return this._lastProgressUpdateTime;
    }

    set lastProgressUpdateTime(value) {
      const oldValue = this._lastProgressUpdateTime;
      this._lastProgressUpdateTime = value;
      this._notify('lastProgressUpdateTime', value, oldValue);
    }

    get generatedContent() {
      return this._generatedContent;
    }

    set generatedContent(value) {
      const oldValue = { ...this._generatedContent };
      this._generatedContent = value;
      this._notify('generatedContent', value, oldValue);
    }

    get manualCtasData() {
      return this._manualCtasData;
    }

    set manualCtasData(value) {
      const oldValue = [...this._manualCtasData];
      this._manualCtasData = value;
      this._notify('manualCtasData', value, oldValue);
    }

    get keywordCtaData() {
      return this._keywordCtaData;
    }

    set keywordCtaData(value) {
      const oldValue = { ...this._keywordCtaData };
      this._keywordCtaData = value;
      this._notify('keywordCtaData', value, oldValue);
    }

    reset() {
      const oldState = {
        currentPlatform: this._currentPlatform,
        isRunning: this._isRunning,
        isCanceled: this._isCanceled,
        currentTab: this._currentTab,
        lastProgressUpdateTime: this._lastProgressUpdateTime,
        generatedContent: { ...this._generatedContent },
        manualCtasData: [...this._manualCtasData],
        keywordCtaData: { ...this._keywordCtaData }
      };

      this._currentPlatform = 'wordpress';
      this._isRunning = false;
      this._isCanceled = false;
      this._currentTab = 'main';
      this._lastProgressUpdateTime = null;
      this._generatedContent = {
        title: '',
        content: '',
        thumbnailUrl: '',
        payload: null
      };
      this._manualCtasData = [];
      this._keywordCtaData = {};

      this._notify('reset', null, oldState);
      console.log('✅ [AppState] 상태 초기화 완료');
    }

    on(event, callback) {
      if (!this._listeners.has(event)) {
        this._listeners.set(event, []);
      }
      this._listeners.get(event).push(callback);
    }

    off(event, callback) {
      if (this._listeners.has(event)) {
        const callbacks = this._listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    }

    _notify(property, newValue, oldValue) {
      if (this._listeners.has(property)) {
        this._listeners.get(property).forEach(callback => {
          try {
            callback(newValue, oldValue, property);
          } catch (error) {
            console.error(`[AppState] 이벤트 리스너 오류 (${property}):`, error);
          }
        });
      }

      if (this._listeners.has('*')) {
        this._listeners.get('*').forEach(callback => {
          try {
            callback(property, newValue, oldValue);
          } catch (error) {
            console.error('[AppState] 전체 이벤트 리스너 오류:', error);
          }
        });
      }
    }
  }

  return {
    getInstance: () => {
      if (!instance) {
        instance = new AppStateClass();
      }
      return instance;
    }
  };
})();

export const getAppState = () => AppState.getInstance();

// EventManager
export const EventManager = {
  init() {
    document.addEventListener('click', this.handleClick.bind(this));
    document.addEventListener('change', this.handleChange.bind(this));
    document.addEventListener('keypress', this.handleKeypress.bind(this));
  },

  handleClick(e) {
    const target = e.target;
    if (target.matches('.tab-btn')) {
      const tabName = target.getAttribute('onclick')?.match(/showTab\('(.+)'\)/)?.[1];
      if (tabName && window.showTab) {
        window.showTab(tabName);
      }
    }
  },

  handleChange(e) {
    const target = e.target;
    if (target.id === 'thumbnailType' && window.updateThumbnailPreview) {
      window.updateThumbnailPreview();
    }
  },

  handleKeypress(e) {
    if (e.key === 'Enter') {
      const target = e.target;
      if (target.classList.contains('work-record-input') && window.addTodayWorkRecord) {
        window.addTodayWorkRecord('manual', target.value);
        target.value = '';
      }
    }
  }
};

// ButtonStateManager
export const ButtonStateManager = {
  buttons: {
    publishBtn: null,
    generateBtn: null,
    runBtn: null
  },

  init() {
    this.buttons.publishBtn = DOMCache.get('publishBtn');
    this.buttons.generateBtn = DOMCache.get('generateBtn');
    this.buttons.runBtn = DOMCache.get('runBtn');

    this.saveOriginalState('publishBtn');
    this.saveOriginalState('generateBtn');
    this.saveOriginalState('runBtn');
  },

  saveOriginalState(buttonId) {
    const button = this.buttons[buttonId];
    if (!button) return;

    if (!button.dataset.originalState) {
      button.dataset.originalState = JSON.stringify({
        disabled: button.disabled,
        innerHTML: button.innerHTML,
        textContent: button.textContent || '',
        style: {
          opacity: button.style.opacity || '',
          pointerEvents: button.style.pointerEvents || '',
          cursor: button.style.cursor || '',
          display: button.style.display || '',
          visibility: button.style.visibility || ''
        },
        className: button.className || '',
        originalStyle: button.getAttribute('style') || ''
      });
    }
  },

  getOriginalState(buttonId) {
    const button = this.buttons[buttonId];
    if (!button || !button.dataset.originalState) return null;

    try {
      return JSON.parse(button.dataset.originalState);
    } catch (e) {
      console.error(`[ButtonStateManager] 원래 상태 파싱 실패 (${buttonId}):`, e);
      return null;
    }
  },

  setLoading(buttonId, message = null) {
    const button = this.buttons[buttonId];
    if (!button) {
      console.warn(`[ButtonStateManager] 버튼을 찾을 수 없습니다: ${buttonId}`);
      return;
    }

    if (!button.dataset.originalState) {
      this.saveOriginalState(buttonId);
    }

    const loadingMessages = {
      publishBtn: message || '<span style="position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; gap: 12px;"><span style="font-size: 28px; animation: pulse 2s infinite;">⏳</span><span style="text-shadow: 0 2px 10px rgba(0,0,0,0.2);">발행 중...</span><span style="font-size: 24px; animation: pulse 2s infinite 0.5s;">✨</span></span>',
      generateBtn: message || '⏳ 생성 중...',
      runBtn: message || '실행 중...'
    };

    button.disabled = false;
    button.style.pointerEvents = 'auto';
    button.style.cursor = 'pointer';
    button.style.opacity = '1';

    if (buttonId === 'runBtn') {
      button.textContent = loadingMessages[buttonId];
    } else {
      button.innerHTML = loadingMessages[buttonId];
    }

    console.log(`[ButtonStateManager] ${buttonId} 로딩 상태 설정:`, loadingMessages[buttonId]);
  },

  restore(buttonId) {
    const button = this.buttons[buttonId];
    if (!button) {
      console.warn(`[ButtonStateManager] 버튼을 찾을 수 없습니다: ${buttonId}`);
      return;
    }

    const originalState = this.getOriginalState(buttonId);
    if (!originalState) {
      console.warn(`[ButtonStateManager] 원래 상태를 찾을 수 없습니다: ${buttonId}`);
      button.disabled = false;
      button.style.opacity = '1';
      button.style.pointerEvents = 'auto';
      button.style.cursor = 'pointer';
      return;
    }

    button.disabled = originalState.disabled;

    if (originalState.originalStyle) {
      button.setAttribute('style', originalState.originalStyle);
    } else {
      Object.keys(originalState.style).forEach(key => {
        if (originalState.style[key]) {
          button.style[key] = originalState.style[key];
        }
      });
    }

    if (originalState.className) {
      button.className = originalState.className;
    }

    if (buttonId === 'runBtn') {
      if (originalState.textContent) {
        button.textContent = originalState.textContent;
      }
    } else {
      if (originalState.innerHTML) {
        button.innerHTML = originalState.innerHTML;
      }
    }

    button.disabled = false;
    button.style.pointerEvents = 'auto';
    button.style.cursor = 'pointer';
    button.style.opacity = '1';

    console.log(`[ButtonStateManager] ${buttonId} 원래 상태로 복원 완료`);
  },

  setEnabled(buttonId, enabled) {
    const button = this.buttons[buttonId];
    if (!button) {
      console.warn(`[ButtonStateManager] 버튼을 찾을 수 없습니다: ${buttonId}`);
      return;
    }

    if (enabled) {
      button.disabled = false;
      button.style.opacity = '1';
      button.style.pointerEvents = 'auto';
      button.style.cursor = 'pointer';
    } else {
      button.disabled = true;
      button.style.opacity = '0.6';
      button.style.pointerEvents = 'none';
      button.style.cursor = 'not-allowed';
    }

    console.log(`[ButtonStateManager] ${buttonId} ${enabled ? '활성화' : '비활성화'}`);
  },

  restoreAll() {
    Object.keys(this.buttons).forEach(buttonId => {
      this.restore(buttonId);
    });
  }
};

// StorageManager 싱글톤 클래스
const StorageManager = (() => {
  let instance = null;

  class StorageManagerClass {
    constructor() {
      if (instance) {
        return instance;
      }

      this.queue = [];
      this.processing = false;
      this.requestIdleCallback = window.requestIdleCallback ||
        ((cb) => setTimeout(() => cb({ timeRemaining: () => 16 }), 1));

      instance = this;
      return this;
    }

    async processQueue() {
      if (this.processing || this.queue.length === 0) return;

      this.processing = true;

      while (this.queue.length > 0) {
        const task = this.queue.shift();

        try {
          await this.executeTask(task);
        } catch (error) {
          console.error('[StorageManager] 작업 실행 오류:', error);
          if (task.reject) {
            task.reject(error);
          }
        }
      }

      this.processing = false;
    }

    async executeTask(task) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          try {
            let result;

            const getItem = localStorage.getItem.bind(localStorage);
            const setItem = localStorage.setItem.bind(localStorage);
            const removeItem = localStorage.removeItem.bind(localStorage);

            switch (task.operation) {
              case 'get':
                result = getItem(task.key);
                if (task.parse) {
                  result = result ? JSON.parse(result) : null;
                }
                break;

              case 'set':
                const value = task.parse ? JSON.stringify(task.value) : task.value;
                setItem(task.key, value);
                result = true;
                break;

              case 'remove':
                removeItem(task.key);
                result = true;
                break;

              default:
                throw new Error(`알 수 없는 작업: ${task.operation}`);
            }

            if (task.resolve) {
              task.resolve(result);
            }
            resolve(result);
          } catch (error) {
            if (task.reject) {
              task.reject(error);
            }
            reject(error);
          }
        }, 0);
      });
    }

    async get(key, parse = false) {
      return new Promise((resolve, reject) => {
        this.queue.push({
          operation: 'get',
          key,
          parse,
          resolve,
          reject
        });

        this.processQueue();
      });
    }

    async set(key, value, stringify = false) {
      return new Promise((resolve, reject) => {
        this.queue.push({
          operation: 'set',
          key,
          value,
          parse: stringify,
          resolve,
          reject
        });

        this.processQueue();
      });
    }

    async remove(key) {
      return new Promise((resolve, reject) => {
        this.queue.push({
          operation: 'remove',
          key,
          resolve,
          reject
        });

        this.processQueue();
      });
    }

    getSync(key, parse = false) {
      try {
        const value = localStorage.getItem(key);
        if (parse) {
          return value ? JSON.parse(value) : null;
        }
        return value;
      } catch (error) {
        console.error(`[StorageManager] 동기 get 오류 (${key}):`, error);
        return null;
      }
    }

    setSync(key, value, stringify = false) {
      try {
        const valueToStore = stringify ? JSON.stringify(value) : value;
        localStorage.setItem(key, valueToStore);
        return true;
      } catch (error) {
        console.error(`[StorageManager] 동기 set 오류 (${key}):`, error);
        return false;
      }
    }

    removeSync(key) {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        console.error(`[StorageManager] 동기 remove 오류 (${key}):`, error);
        return false;
      }
    }
  }

  return {
    getInstance: () => {
      if (!instance) {
        instance = new StorageManagerClass();
      }
      return instance;
    }
  };
})();

export const getStorageManager = () => StorageManager.getInstance();

// ErrorHandler 싱글톤 클래스
const ErrorHandler = (() => {
  let instance = null;

  class ErrorHandlerClass {
    constructor() {
      if (instance) {
        return instance;
      }

      this.errorMessages = {
        'NetworkError': '네트워크 연결에 문제가 발생했습니다. 인터넷 연결을 확인해주세요.',
        'Failed to fetch': '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.',
        'API key': 'API 키가 유효하지 않거나 만료되었습니다. 환경 설정에서 확인해주세요.',
        'Invalid API key': 'API 키가 올바르지 않습니다. 환경 설정에서 확인해주세요.',
        'Unauthorized': '인증에 실패했습니다. API 키를 확인해주세요.',
        'Rate limit': 'API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
        '알 수 없는 오류': '알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      };

      this.errorStrategies = {
        'NetworkError': { severity: 'high', retryable: true, showToast: true },
        'TypeError': { severity: 'medium', retryable: false, showToast: true },
        'ReferenceError': { severity: 'high', retryable: false, showToast: true },
        'Error': { severity: 'medium', retryable: true, showToast: true }
      };

      instance = this;
      return this;
    }

    getUserFriendlyMessage(error) {
      const errorMessage = error?.message || String(error);
      const errorName = error?.constructor?.name || 'Error';

      for (const [key, message] of Object.entries(this.errorMessages)) {
        if (errorMessage.includes(key) || errorMessage.toLowerCase().includes(key.toLowerCase())) {
          return message;
        }
      }

      if (errorName === 'NetworkError' || errorMessage.includes('fetch') || errorMessage.includes('network')) {
        return '네트워크 연결에 문제가 발생했습니다. 인터넷 연결을 확인해주세요.';
      }

      if (errorMessage.includes('API') || errorMessage.includes('key') || errorMessage.includes('인증')) {
        return 'API 설정에 문제가 있습니다. 환경 설정에서 API 키를 확인해주세요.';
      }

      return errorMessage || '알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    }

    logError(error, context = {}) {
      const timestamp = new Date().toLocaleTimeString();
      const errorName = error?.constructor?.name || 'Error';
      const errorMessage = error?.message || String(error);
      const userMessage = this.getUserFriendlyMessage(error);

      console.error(`[${timestamp}] ❌ [ERROR] ${errorName}:`, errorMessage);
      if (context && Object.keys(context).length > 0) {
        console.error(`[${timestamp}] 📋 [ERROR] 컨텍스트:`, context);
      }
      if (error?.stack) {
        console.error(`[${timestamp}] 📚 [ERROR] 스택:`, error.stack);
      }

      if (window.addLog) {
        const contextStr = context.function ? `[${context.function}] ` : '';
        window.addLog(`${contextStr}오류: ${userMessage}`, 'error');
      }

      return {
        errorName,
        errorMessage,
        userMessage,
        timestamp,
        context
      };
    }

    showToast(message, type = 'error', duration = 5000) {
      const existingToast = document.getElementById('errorToast');
      if (existingToast) {
        existingToast.remove();
      }

      const toast = document.createElement('div');
      toast.id = 'errorToast';
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        padding: 16px 24px;
        background: ${type === 'error' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' :
          type === 'success' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' :
            'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'};
        color: white;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        font-size: 14px;
        font-weight: 600;
        max-width: 400px;
        word-wrap: break-word;
        animation: slideInRight 0.3s ease-out;
        backdrop-filter: blur(10px);
        border: 2px solid rgba(255, 255, 255, 0.2);
      `;

      const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
      toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 20px;">${icon}</span>
          <span>${message}</span>
        </div>
      `;

      if (!document.getElementById('toastAnimationStyle')) {
        const style = document.createElement('style');
        style.id = 'toastAnimationStyle';
        style.textContent = `
          @keyframes slideInRight {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          @keyframes slideOutRight {
            from {
              transform: translateX(0);
              opacity: 1;
            }
            to {
              transform: translateX(100%);
              opacity: 0;
            }
          }
        `;
        document.head.appendChild(style);
      }

      document.body.appendChild(toast);

      setTimeout(() => {
        if (toast.parentNode) {
          toast.style.animation = 'slideOutRight 0.3s ease-out';
          setTimeout(() => {
            if (toast.parentNode) {
              toast.remove();
            }
          }, 300);
        }
      }, duration);

      return toast;
    }

    handle(error, context = {}) {
      const errorName = error?.constructor?.name || 'Error';
      const strategy = this.errorStrategies[errorName] || this.errorStrategies['Error'];
      const userMessage = this.getUserFriendlyMessage(error);

      const logData = this.logError(error, context);

      if (strategy.showToast) {
        this.showToast(userMessage, 'error', strategy.severity === 'high' ? 7000 : 5000);
      }

      if (strategy.severity === 'high' && !strategy.retryable) {
        setTimeout(() => {
          alert(`⚠️ 심각한 오류가 발생했습니다:\n\n${userMessage}\n\n자세한 내용은 로그를 확인해주세요.`);
        }, 100);
      }

      return {
        handled: true,
        userMessage,
        retryable: strategy.retryable,
        severity: strategy.severity,
        logData
      };
    }
  }

  return {
    getInstance: () => {
      if (!instance) {
        instance = new ErrorHandlerClass();
      }
      return instance;
    }
  };
})();

export const getErrorHandler = () => ErrorHandler.getInstance();

// ProgressManager 싱글톤 클래스
const ProgressManager = (() => {
  let instance = null;

  class ProgressManagerClass {
    constructor() {
      if (instance) {
        return instance;
      }

      this.progressStartTime = null;
      this.overallProgress = 0;
      this.currentProgress = 0;
      this.progressAnimationId = null;

      this.elements = {
        fillEl: null,
        textEl: null,
        stepEl: null,
        elapsedEl: null,
        etaEl: null,
        progressBarFill: null,
        progressText: null,
        circle: null
      };

      instance = this;
      return this;
    }

    init() {
      // 🔥 끝판왕 진행률 요소 초기화 (모든 가능한 ID 지원)
      this.elements = {
        // 막대 진행률 바
        fillEl: document.getElementById('progressFill') || document.getElementById('progressBarFill'),
        // 퍼센트 텍스트
        textEl: document.getElementById('progressPercentage') || document.getElementById('progressBarText'),
        // 상태 텍스트
        stepEl: document.getElementById('progressStep'),
        elapsedEl: document.getElementById('progressElapsed') || document.getElementById('elapsedTime'),
        etaEl: document.getElementById('progressEta') || document.getElementById('estimatedTime'),
        progressBarFill: document.getElementById('progressBarFill'),
        progressText: document.getElementById('progressBarText'),
        circle: document.getElementById('progressCircle')
      };

      if (!this.progressStartTime) {
        this.progressStartTime = Date.now();
      }
    }

    updateStatus(statusText) {
      if (!statusText) return;
      if (!this.elements.stepEl) this.init();

      // premiumProgressBar 내부의 progressStep 업데이트
      const progressStep = document.getElementById('progressStep');
      if (progressStep) {
        progressStep.textContent = statusText;
        console.log(`✅ progressStep 업데이트: ${statusText}`);
      }

      if (this.elements.stepEl) {
        this.elements.stepEl.textContent = statusText;
      }
    }

    _updateTime(percentage = 0) {
      if (!this.elements.elapsedEl || !this.elements.etaEl) this.init();

      if (!this.progressStartTime) {
        this.progressStartTime = Date.now();
      }

      // premiumProgressBar 내부의 시간 요소 업데이트
      const progressTime = document.getElementById('progressTime');
      const estimatedTime = document.getElementById('estimatedTime');

      const elapsed = Date.now() - this.progressStartTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      const timeText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

      if (progressTime) {
        progressTime.textContent = `⏱️ 경과: ${timeText}`;
      }

      if (estimatedTime) {
        if (percentage > 0) {
          const totalEstimated = (elapsed / percentage) * 100;
          const remaining = Math.max(0, totalEstimated - elapsed);
          const remMinutes = Math.floor(remaining / 60000);
          const remSeconds = Math.floor((remaining % 60000) / 1000);
          estimatedTime.textContent = `⏳ 예상: ${remMinutes.toString().padStart(2, '0')}:${remSeconds.toString().padStart(2, '0')}`;
        } else {
          estimatedTime.textContent = '⏳ 예상: 00:00';
        }
      }

      if (this.elements.elapsedEl) {
        this.elements.elapsedEl.textContent = timeText;
      }

      if (this.elements.etaEl) {
        if (percentage > 0) {
          const totalEstimated = (elapsed / percentage) * 100;
          const remaining = Math.max(0, totalEstimated - elapsed);
          const remMinutes = Math.floor(remaining / 60000);
          const remSeconds = Math.floor((remaining % 60000) / 1000);
          this.elements.etaEl.textContent = `${remMinutes.toString().padStart(2, '0')}:${remSeconds.toString().padStart(2, '0')}`;
        } else {
          this.elements.etaEl.textContent = '--:--';
        }
      }
    }

    updateProgress(stepPercentage, targetPercentage = null, statusText = null) {
      requestAnimationFrame(() => {
        if (!this.elements.fillEl || !this.elements.textEl) this.init();

        const percentage = Math.max(0, Math.min(100, Math.round(stepPercentage)));

        // 🔥 퍼센트 텍스트 업데이트
        const percentageEl = document.getElementById('progressPercentage');
        if (percentageEl) {
          percentageEl.textContent = `${percentage}%`;
        }
        if (this.elements.textEl) {
          this.elements.textEl.textContent = `${percentage}%`;
        }

        // 🔥 막대 진행률 바 업데이트
        const fillEl = document.getElementById('progressFill');
        if (fillEl) {
          fillEl.style.width = `${percentage}%`;
          fillEl.style.transition = 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        }
        if (this.elements.fillEl) {
          this.elements.fillEl.style.width = `${percentage}%`;
        }

        // 🔥 원형 진행률 업데이트 (SVG circle)
        const circleEl = document.getElementById('progressCircle');
        if (circleEl) {
          const circumference = 2 * Math.PI * 50; // r=50
          const offset = circumference - (percentage / 100) * circumference;
          circleEl.style.strokeDashoffset = offset;
          circleEl.style.transition = 'stroke-dashoffset 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        }

        // 🔥 단계 표시 업데이트
        this._updateStageIndicators(percentage);

        if (statusText) {
          this.updateStatus(statusText);
        }

        this._updateTime(percentage);

        const finalProgress = targetPercentage || stepPercentage;
        if (finalProgress > this.overallProgress) {
          this.overallProgress = finalProgress;
        }
      });
    }

    // 🔥 단계 표시기 업데이트
    _updateStageIndicators(percentage) {
      const stages = document.querySelectorAll('.progress-stage');
      if (!stages.length) return;

      stages.forEach(stage => {
        const stageName = stage.getAttribute('data-stage');
        let stageThreshold = 0;

        switch (stageName) {
          case 'crawl': stageThreshold = 5; break;
          case 'title': stageThreshold = 30; break;
          case 'structure': stageThreshold = 45; break;
          case 'content': stageThreshold = 60; break;
          case 'publish': stageThreshold = 90; break;
        }

        if (percentage >= stageThreshold) {
          stage.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%)';
          stage.style.borderColor = 'rgba(102, 126, 234, 0.6)';
          stage.style.transform = 'scale(1.05)';
          stage.style.boxShadow = '0 4px 20px rgba(102, 126, 234, 0.3)';
        } else {
          stage.style.background = 'rgba(255,255,255,0.05)';
          stage.style.borderColor = 'rgba(255,255,255,0.1)';
          stage.style.transform = 'scale(1)';
          stage.style.boxShadow = 'none';
        }
      });
    }

    updateStepProgress(percentage) {
      console.log(`📊 단계별 진행률 업데이트: ${percentage}%`);

      if (!this.elements.progressBarFill || !this.elements.progressText) this.init();

      const clampedPercentage = Math.min(100, Math.max(0, percentage));

      if (this.elements.progressBarFill) {
        this.elements.progressBarFill.style.transition = 'width 0.2s ease-out';
        this.elements.progressBarFill.style.width = `${clampedPercentage}%`;
      }

      if (this.elements.progressText) {
        this.elements.progressText.textContent = `${Math.round(clampedPercentage)}%`;
      }

      this.updateOverallProgressBar(clampedPercentage);

      requestAnimationFrame(() => {
        if (this.elements.progressBarFill) {
          this.elements.progressBarFill.style.transform = 'translateZ(0)';
        }
      });
    }

    updateOverallProgressBar(percentage) {
      this.overallProgress = Math.min(100, Math.max(0, percentage));
      console.log(`📈 전체 진행률 업데이트: ${this.overallProgress}%`);

      // 진행률 바 업데이트 (금색, 부드러운 애니메이션) - premiumProgressBar 내부의 progressFill
      const progressFill = document.getElementById('progressFill');
      if (progressFill) {
        progressFill.style.transition = 'width 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        progressFill.style.width = `${this.overallProgress}%`;
        console.log(`✅ progressFill 업데이트: ${this.overallProgress}%`);
      } else {
        console.warn('⚠️ progressFill 요소를 찾을 수 없음');
      }

      // 진행률 퍼센트 텍스트 업데이트 - premiumProgressBar 내부의 progressPercentage
      const progressPercentage = document.getElementById('progressPercentage');
      if (progressPercentage) {
        progressPercentage.textContent = `${Math.round(this.overallProgress)}%`;
        console.log(`✅ progressPercentage 업데이트: ${Math.round(this.overallProgress)}%`);
      } else {
        console.warn('⚠️ progressPercentage 요소를 찾을 수 없음');
      }

      // 시간 정보 업데이트
      this._updateTime(this.overallProgress);

      if (!this.elements.fillEl || !this.elements.textEl) this.init();

      if (this.elements.fillEl) {
        this.elements.fillEl.style.transition = 'width 0.3s ease-out';
        this.elements.fillEl.style.width = `${this.overallProgress}%`;
      }

      if (this.elements.textEl) {
        this.elements.textEl.textContent = `${Math.round(this.overallProgress)}%`;
      }
    }

    updateProgressCircle(percentage) {
      if (!this.elements.circle) this.init();

      if (this.elements.circle) {
        const circumference = 2 * Math.PI * 40;
        const offset = circumference - (percentage / 100) * circumference;

        this.elements.circle.style.transition = 'stroke-dashoffset 0.4s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.2s ease-out';
        this.elements.circle.style.strokeDashoffset = offset;

        if (percentage > 0 && percentage < 100) {
          this.elements.circle.style.filter = 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.2))';
        } else if (percentage === 100) {
          this.elements.circle.style.filter = 'drop-shadow(0 0 10px rgba(76, 175, 80, 0.5))';
        }

        console.log(`🎯 진행률: ${percentage}%, 오프셋: ${offset}`);
      }
    }

    smoothProgressUpdate(targetProgress, label) {
      console.log(`[SMOOTH PROGRESS] 비활성화됨 - 백엔드 진행률 직접 사용: ${targetProgress}%`);
      return;
    }

    reset() {
      this.progressStartTime = Date.now();
      this.overallProgress = 0;
      this.currentProgress = 0;
      if (this.progressAnimationId) {
        cancelAnimationFrame(this.progressAnimationId);
        this.progressAnimationId = null;
      }
    }

    resetProgress() {
      this.overallProgress = 0;
      this.currentProgress = 0;
      this.updateProgress(0, 0);
      this.updateStepProgress(0);
      this.updateOverallProgressBar(0);
    }
  }

  return {
    getInstance: () => {
      if (!instance) {
        instance = new ProgressManagerClass();
      }
      return instance;
    }
  };
})();

export const getProgressManager = () => ProgressManager.getInstance();

// 🔧 Debounce 유틸리티 함수
export function debounce(func, wait, immediate = false) {
  let timeout = null;

  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(this, args);
    };

    const callNow = immediate && !timeout;

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(later, wait);

    if (callNow) {
      func.apply(this, args);
    }
  };
}

// 🔧 HTML에서 순수 텍스트만 추출하는 유틸리티 함수
export function getPlainText(html) {
  if (!html) return '';
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const text = tempDiv.textContent || tempDiv.innerText || '';
  return text.replace(/\s+/g, ' ').trim();
}

// 🔧 순수 텍스트 글자수 계산 유틸리티 함수
export function getTextLength(html) {
  return getPlainText(html).length;
}

// 🔧 HTML Sanitization 함수 (기본적인 XSS 방지)
export function sanitizeHTML(html, options = {}) {
  if (!html || typeof html !== 'string') return '';

  const {
    allowTags = ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'img', 'div', 'span'],
    allowAttributes = ['href', 'src', 'alt', 'title', 'class', 'style'],
    stripTags = false
  } = options;

  if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
    const config = { ALLOWED_TAGS: allowTags, ALLOWED_ATTR: allowAttributes, ALLOW_DATA_ATTR: false, KEEP_CONTENT: true };
    return DOMPurify.sanitize(html, config);
  }

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  const scripts = tempDiv.querySelectorAll('script, style, iframe, object, embed, form, input, button');
  scripts.forEach(el => el.remove());

  const allElements = tempDiv.querySelectorAll('*');
  allElements.forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
      if (!allowAttributes.includes(attr.name) && attr.name !== 'id' && attr.name !== 'class') {
        if (attr.name !== 'style' && attr.name !== 'class') {
          el.removeAttribute(attr.name);
        }
      }
    });

    if (!allowTags.includes(el.tagName.toLowerCase())) {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
      }
    }
  });

  const links = tempDiv.querySelectorAll('a[href]');
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.toLowerCase().startsWith('javascript:')) {
      link.removeAttribute('href');
    }
  });

  return tempDiv.innerHTML;
}

// 로그 관리 객체
const LogManager = {
  logContent: null,

  init() {
    this.logContent = document.getElementById('logContent');
  },

  getLogContent() {
    if (!this.logContent) this.init();
    return this.logContent;
  },

  add(message, type = 'info') {
    const logContent = this.getLogContent();
    if (logContent) {
      const logEntry = document.createElement('div');

      // 🔥 [BILLING:provider] 마커 → 충전 버튼 변환
      const billingUrls = {
        gemini: 'https://aistudio.google.com/plan_billing',
        openai: 'https://platform.openai.com/settings/organization/billing',
        claude: 'https://console.anthropic.com/settings/billing',
        perplexity: 'https://www.perplexity.ai/settings/api',
      };
      const billingNames = { gemini: 'Google AI Studio', openai: 'OpenAI', claude: 'Anthropic', perplexity: 'Perplexity' };
      const billingMatch = message.match(/\[BILLING:(\w+)\]/);
      let billingHtml = '';
      if (billingMatch) {
        const provider = billingMatch[1];
        const url = billingUrls[provider] || '';
        const name = billingNames[provider] || provider;
        message = message.replace(/\[BILLING:\w+\]/, '').trim();
        if (url) {
          billingHtml = `<button onclick="(window.electronAPI?.openExternal || window.open)('${url}')" style="margin-top:8px;padding:8px 16px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">💳 ${name} 크레딧 충전하기 →</button>`;
        }
      }

      // 🔗 [LINK:url] 마커 → 클릭 가능한 링크 변환
      const linkMatch = message.match(/\[LINK:(https?:\/\/[^\]]+)\]/);
      if (linkMatch) {
        const linkUrl = linkMatch[1];
        message = message.replace(/\[LINK:https?:\/\/[^\]]+\]/, '');
        billingHtml += `<a onclick="(window.electronAPI?.openExternal || window.open)('${linkUrl}')" style="margin-top:6px;padding:8px 16px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">🔗 발행된 글 바로가기 →</a>`;
      }

      let autoType = type;
      if (message.includes('[PROGRESS]')) {
        autoType = 'progress';
      } else if (message.includes('[CRAWL') || message.includes('[SUBTITLE') || message.includes('[CONTENT')) {
        autoType = 'crawl';
      } else if (message.includes('[SECTION')) {
        autoType = 'section';
      } else if (message.includes('[FINAL')) {
        autoType = 'final';
      }

      if (autoType === 'progress') {
        logEntry.className = `log-entry ${autoType} progress-highlight`;
        const progressMatch = message.match(/(\d+)%/);
        if (progressMatch) {
          const progressPercent = progressMatch[1];
          logEntry.innerHTML = `
            <span class="progress-indicator">📊 ${progressPercent}%</span>
            <span class="progress-message">${message.replace(/\d+%/, '').trim()}</span>
            <span class="log-timestamp">[${new Date().toLocaleTimeString()}]</span>
          ` + billingHtml;
        } else {
          logEntry.innerHTML = `
            <span class="progress-message">${message}</span>
            <span class="log-timestamp">[${new Date().toLocaleTimeString()}]</span>
          ` + billingHtml;
        }
      } else {
        logEntry.className = `log-entry ${autoType}`;
        logEntry.innerHTML = `[${new Date().toLocaleTimeString()}] ${message}` + billingHtml;
      }

      logContent.appendChild(logEntry);

      // 부드럽게 스크롤 (진행상황 로그와 동기화)
      requestAnimationFrame(() => {
        const logContainer = document.getElementById('logContainer');
        if (logContainer) {
          logContainer.scrollTo({
            top: logContainer.scrollHeight,
            behavior: 'smooth'
          });
        } else {
          // 폴백: 직접 스크롤
          logContent.scrollTop = logContent.scrollHeight;
        }
      });
    }
  },

  clear() {
    const logContent = this.getLogContent();
    if (logContent) {
      logContent.innerHTML = '';
    }
  }
};

// 로그 추가 함수 (진행상황 로그와 동기화, 부드럽게 스크롤)
export function addLog(message, type = 'info') {
  LogManager.add(message, type);

  // 로그 컨테이너를 부드럽게 스크롤
  const logContainer = document.getElementById('logContainer');
  if (logContainer) {
    // requestAnimationFrame을 사용하여 부드럽게 스크롤
    requestAnimationFrame(() => {
      logContainer.scrollTo({
        top: logContainer.scrollHeight,
        behavior: 'smooth'
      });
    });
  }
}

// 로그 지우기
export function clearLog() {
  LogManager.clear();
}

// 디버그 로깅 함수
export function debugLog(step, message, data = null) {
  const timestamp = new Date().toLocaleTimeString();
  const logMessage = `[${timestamp}] 🔍 [${step}] ${message}`;
  console.log(logMessage);

  if (data) {
    console.log(`[${timestamp}] 📊 [${step}] 데이터:`, data);
  }

  addLog(`[${step}] ${message}`, 'info');
}

// 오류 상세 로깅 함수
export function errorLog(step, error, context = null) {
  const timestamp = new Date().toLocaleTimeString();
  const errorMessage = `[${timestamp}] ❌ [${step}] 오류: ${error.message || error}`;
  console.error(errorMessage);

  if (context) {
    console.error(`[${timestamp}] 📋 [${step}] 컨텍스트:`, context);
  }

  if (error.stack) {
    console.error(`[${timestamp}] 📚 [${step}] 스택:`, error.stack);
  }

  addLog(`[${step}] 오류: ${error.message || error}`, 'error');
}

// 성공 로깅 함수
export function successLog(step, message, data = null) {
  const timestamp = new Date().toLocaleTimeString();
  const successMessage = `[${timestamp}] ✅ [${step}] 성공: ${message}`;
  console.log(successMessage);

  if (data) {
    console.log(`[${timestamp}] 📊 [${step}] 결과:`, data);
  }

  addLog(`[${step}] 성공: ${message}`, 'success');
}

