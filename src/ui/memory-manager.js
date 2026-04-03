// 메모리 관리 시스템
class MemoryManager {
  constructor() {
    this.cache = new Map();
    this.observers = new Set();
    this.timers = new Set();
    this.eventListeners = new Map();
    this.maxCacheSize = 50; // 최대 캐시 항목 수
    this.cacheExpiry = 5 * 60 * 1000; // 5분
    this.memoryThreshold = 100 * 1024 * 1024; // 100MB
  }

  // 캐시 관리
  setCache(key, value, ttl = this.cacheExpiry) {
    // 캐시 크기 제한
    if (this.cache.size >= this.maxCacheSize) {
      this.cleanOldCache();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    });
  }

  getCache(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    // TTL 확인
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  // 오래된 캐시 정리
  cleanOldCache() {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    
    // 오래된 항목들 제거
    entries.forEach(([key, item]) => {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    });

    // 여전히 크기가 크면 가장 오래된 항목들 제거
    if (this.cache.size >= this.maxCacheSize) {
      const sortedEntries = entries
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, Math.floor(this.maxCacheSize / 2));
      
      sortedEntries.forEach(([key]) => {
        this.cache.delete(key);
      });
    }
  }

  // Observer 등록 및 관리
  registerObserver(observer) {
    this.observers.add(observer);
    return observer;
  }

  unregisterObserver(observer) {
    this.observers.delete(observer);
  }

  // 타이머 관리
  setTimeout(callback, delay) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delay);
    
    this.timers.add(timer);
    return timer;
  }

  setInterval(callback, delay) {
    const timer = setInterval(callback, delay);
    this.timers.add(timer);
    return timer;
  }

  clearTimer(timer) {
    clearTimeout(timer);
    clearInterval(timer);
    this.timers.delete(timer);
  }

  // 이벤트 리스너 관리
  addEventListener(element, event, handler, options = {}) {
    const key = `${element.constructor.name}-${event}`;
    
    if (!this.eventListeners.has(key)) {
      this.eventListeners.set(key, new Set());
    }
    
    this.eventListeners.get(key).add({ element, handler, options });
    element.addEventListener(event, handler, options);
  }

  removeEventListener(element, event, handler) {
    const key = `${element.constructor.name}-${event}`;
    const listeners = this.eventListeners.get(key);
    
    if (listeners) {
      listeners.forEach(listener => {
        if (listener.element === element && listener.handler === handler) {
          element.removeEventListener(event, handler);
          listeners.delete(listener);
        }
      });
    }
  }

  // 메모리 사용량 모니터링
  getMemoryUsage() {
    if (performance.memory) {
      return {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      };
    }
    return null;
  }

  // 메모리 압박 감지
  isMemoryPressure() {
    const memory = this.getMemoryUsage();
    if (!memory) return false;
    
    return memory.used > this.memoryThreshold;
  }

  // 메모리 정리
  cleanup() {
    // 모든 타이머 정리
    this.timers.forEach(timer => {
      clearTimeout(timer);
      clearInterval(timer);
    });
    this.timers.clear();

    // 모든 Observer 정리
    this.observers.forEach(observer => {
      if (observer.disconnect) {
        observer.disconnect();
      }
    });
    this.observers.clear();

    // 모든 이벤트 리스너 정리
    this.eventListeners.forEach(listeners => {
      listeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });
    });
    this.eventListeners.clear();

    // 캐시 정리
    this.cache.clear();
  }

  // 가비지 컬렉션 강제 실행 (개발 환경에서만)
  forceGC() {
    if (window.gc && typeof window.gc === 'function') {
      window.gc();
    }
  }

  // 메모리 사용량 로깅
  logMemoryUsage(label = 'Memory Usage') {
    const memory = this.getMemoryUsage();
    if (memory) {
      console.log(`${label}:`, {
        used: `${Math.round(memory.used / 1024 / 1024)}MB`,
        total: `${Math.round(memory.total / 1024 / 1024)}MB`,
        limit: `${Math.round(memory.limit / 1024 / 1024)}MB`,
        percentage: `${Math.round((memory.used / memory.limit) * 100)}%`
      });
    }
  }

  // 이미지 최적화
  optimizeImage(img, maxWidth = 800, quality = 0.8) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob(resolve, 'image/jpeg', quality);
    });
  }

  // DOM 요소 재사용
  createElementPool(tagName, initialSize = 10) {
    const pool = [];
    
    for (let i = 0; i < initialSize; i++) {
      pool.push(document.createElement(tagName));
    }
    
    return {
      get: () => pool.pop() || document.createElement(tagName),
      release: (element) => {
        element.innerHTML = '';
        element.className = '';
        element.removeAttribute('style');
        pool.push(element);
      }
    };
  }
}

// 전역 메모리 관리자
window.memoryManager = new MemoryManager();

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
  window.memoryManager.cleanup();
});

// 메모리 압박 감지 및 정리
setInterval(() => {
  if (window.memoryManager.isMemoryPressure()) {
    console.warn('Memory pressure detected, cleaning cache...');
    window.memoryManager.cleanOldCache();
    window.memoryManager.logMemoryUsage('After cleanup');
  }
}, 30000); // 30초마다 체크

export default MemoryManager;

