// 성능 최적화 유틸리티
class PerformanceOptimizer {
  constructor() {
    this.debounceTimers = new Map();
    this.throttleTimers = new Map();
    this.frameTimers = new Map();
    this.idleTimers = new Set();
    this.observers = new Map();
    this.cache = new Map();
    this.profile = this.detectProfile();
    this.applyProfile();
    this.bindVisibilityGuards();
  }

  detectProfile() {
    const nav = window.navigator || {};
    const cores = Number(nav.hardwareConcurrency || 4);
    const memory = Number(nav.deviceMemory || 4);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    const lowPowerHint = cores <= 4 || memory <= 4 || reducedMotion;
    return {
      cores,
      memory,
      reducedMotion,
      tier: lowPowerHint ? 'balanced' : 'performance',
      idleDelayScale: lowPowerHint ? 1.45 : 0.85,
      animationScale: reducedMotion ? 0 : (lowPowerHint ? 0.72 : 1),
      logLimit: lowPowerHint ? 240 : 420,
    };
  }

  applyProfile() {
    const root = document.documentElement;
    if (!root) return;
    root.dataset.perfTier = this.profile.tier;
    root.classList.toggle('perf-balanced', this.profile.tier === 'balanced');
    root.classList.toggle('perf-reduced-motion', this.profile.reducedMotion);
    root.style.setProperty('--app-motion-scale', String(this.profile.animationScale));
    root.style.setProperty('--app-fast-transition', `${Math.max(80, Math.round(150 * this.profile.animationScale))}ms`);
    root.style.setProperty('--app-base-transition', `${Math.max(120, Math.round(250 * this.profile.animationScale))}ms`);
  }

  bindVisibilityGuards() {
    document.addEventListener('visibilitychange', () => {
      document.documentElement.classList.toggle('app-background-paused', document.hidden);
    }, { passive: true });
  }

  getAdaptiveDelay(delay = 0) {
    return Math.max(0, Math.round(delay * this.profile.idleDelayScale));
  }

  getLogLimit() {
    return this.profile.logLimit;
  }

  // 디바운스 함수 - 연속 호출을 방지
  debounce(func, delay, key = 'default') {
    return (...args) => {
      if (this.debounceTimers.has(key)) {
        clearTimeout(this.debounceTimers.get(key));
      }
      
      const timer = setTimeout(() => {
        func.apply(this, args);
        this.debounceTimers.delete(key);
      }, delay);
      
      this.debounceTimers.set(key, timer);
    };
  }

  // 스로틀 함수 - 호출 빈도 제한
  throttle(func, delay, key = 'default') {
    return (...args) => {
      if (this.throttleTimers.has(key)) {
        return;
      }
      
      func.apply(this, args);
      this.throttleTimers.set(key, true);
      
      setTimeout(() => {
        this.throttleTimers.delete(key);
      }, delay);
    };
  }

  requestFrame(key, callback) {
    if (this.frameTimers.has(key)) {
      cancelAnimationFrame(this.frameTimers.get(key));
    }
    const frame = requestAnimationFrame(() => {
      this.frameTimers.delete(key);
      callback();
    });
    this.frameTimers.set(key, frame);
    return frame;
  }

  scheduleIdle(callback, options = {}) {
    const timeout = this.getAdaptiveDelay(options.timeout ?? 1200);
    let idleId = null;
    const wrapped = (deadline) => {
      if (idleId !== null) this.idleTimers.delete(idleId);
      callback(deadline);
    };

    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(wrapped, { timeout });
      this.idleTimers.add(idleId);
      return idleId;
    }

    idleId = setTimeout(() => wrapped({ didTimeout: true, timeRemaining: () => 0 }), Math.min(timeout, 1600));
    this.idleTimers.add(idleId);
    return idleId;
  }

  async runChunked(tasks, options = {}) {
    const chunkSize = Math.max(1, Number(options.chunkSize || 1));
    const gapMs = Math.max(0, Number(options.gapMs ?? (this.profile.tier === 'balanced' ? 120 : 55)));
    const results = [];

    for (let i = 0; i < tasks.length; i += chunkSize) {
      const chunk = tasks.slice(i, i + chunkSize);
      results.push(...await Promise.all(chunk.map(task => Promise.resolve().then(task))));
      if (i + chunkSize < tasks.length) {
        await new Promise(resolve => setTimeout(resolve, gapMs));
      }
    }

    return results;
  }

  // Intersection Observer를 사용한 지연 로딩
  createIntersectionObserver(callback, options = {}) {
    const defaultOptions = {
      root: null,
      rootMargin: '50px',
      threshold: 0.1,
      ...options
    };

    return new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          callback(entry.target);
        }
      });
    }, defaultOptions);
  }

  // 가상 스크롤링을 위한 요소 관리
  virtualizeList(container, items, itemHeight, renderItem) {
    const containerHeight = container.clientHeight;
    const visibleCount = Math.ceil(containerHeight / itemHeight) + 2;
    const scrollTop = container.scrollTop;
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(startIndex + visibleCount, items.length);

    // 가시 영역의 아이템만 렌더링
    const visibleItems = items.slice(startIndex, endIndex);
    
    container.innerHTML = '';
    visibleItems.forEach((item, index) => {
      const element = renderItem(item, startIndex + index);
      element.style.position = 'absolute';
      element.style.top = `${(startIndex + index) * itemHeight}px`;
      element.style.height = `${itemHeight}px`;
      container.appendChild(element);
    });

    // 전체 높이 설정
    container.style.height = `${items.length * itemHeight}px`;
  }

  // 메모리 정리
  cleanup() {
    // 타이머 정리
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    
    this.throttleTimers.forEach(timer => clearTimeout(timer));
    this.throttleTimers.clear();

    this.frameTimers.forEach(frame => cancelAnimationFrame(frame));
    this.frameTimers.clear();

    this.idleTimers.forEach(timer => {
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(timer);
      else clearTimeout(timer);
    });
    this.idleTimers.clear();

    // Observer 정리
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();

    // 캐시 정리
    this.cache.clear();
  }

  // 캐시 관리
  setCache(key, value, ttl = 300000) { // 기본 5분 TTL
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl
    });
  }

  getCache(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  // 이미지 지연 로딩
  lazyLoadImages() {
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = this.createIntersectionObserver((img) => {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
      imageObserver.unobserve(img);
    });

    images.forEach(img => imageObserver.observe(img));
    this.observers.set('images', imageObserver);
  }

  // DOM 조작 최적화 - 배치 업데이트
  batchDOMUpdates(updates) {
    requestAnimationFrame(() => {
      updates.forEach(update => update());
    });
  }

  // 이벤트 위임을 사용한 이벤트 리스너 최적화
  delegateEvents(container, eventType, selector, handler) {
    container.addEventListener(eventType, (e) => {
      if (e.target.matches(selector)) {
        handler(e);
      }
    });
  }
}

// 전역 성능 최적화 인스턴스
window.performanceOptimizer = new PerformanceOptimizer();

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
  window.performanceOptimizer.cleanup();
});

export default PerformanceOptimizer;

