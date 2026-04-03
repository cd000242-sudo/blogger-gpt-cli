// 성능 최적화 유틸리티
class PerformanceOptimizer {
  constructor() {
    this.debounceTimers = new Map();
    this.throttleTimers = new Map();
    this.observers = new Map();
    this.cache = new Map();
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

