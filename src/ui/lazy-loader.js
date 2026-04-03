// 지연 로딩 및 코드 분할 시스템
class LazyLoader {
  constructor() {
    this.loadedModules = new Map();
    this.loadingPromises = new Map();
    this.observers = new Map();
  }

  // 동적 모듈 로딩
  async loadModule(modulePath, condition = () => true) {
    if (!condition()) {
      return null;
    }

    // 이미 로드된 모듈 반환
    if (this.loadedModules.has(modulePath)) {
      return this.loadedModules.get(modulePath);
    }

    // 로딩 중인 모듈의 Promise 반환
    if (this.loadingPromises.has(modulePath)) {
      return this.loadingPromises.get(modulePath);
    }

    // 새 모듈 로딩 시작
    const loadPromise = this.loadModuleInternal(modulePath);
    this.loadingPromises.set(modulePath, loadPromise);

    try {
      const module = await loadPromise;
      this.loadedModules.set(modulePath, module);
      this.loadingPromises.delete(modulePath);
      return module;
    } catch (error) {
      this.loadingPromises.delete(modulePath);
      throw error;
    }
  }

  async loadModuleInternal(modulePath) {
    // ES6 모듈 동적 로딩
    if (modulePath.endsWith('.js')) {
      const module = await import(modulePath);
      return module.default || module;
    }

    // JSON 파일 로딩
    if (modulePath.endsWith('.json')) {
      const response = await fetch(modulePath);
      return response.json();
    }

    // CSS 파일 로딩
    if (modulePath.endsWith('.css')) {
      return this.loadCSS(modulePath);
    }

    throw new Error(`Unsupported module type: ${modulePath}`);
  }

  // CSS 지연 로딩
  loadCSS(href) {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      
      link.onload = () => resolve(link);
      link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));
      
      document.head.appendChild(link);
    });
  }

  // 이미지 지연 로딩
  lazyLoadImages(container = document) {
    const images = container.querySelectorAll('img[data-src]');
    
    if (images.length === 0) return;

    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          img.classList.add('loaded');
          imageObserver.unobserve(img);
        }
      });
    }, {
      rootMargin: '50px'
    });

    images.forEach(img => imageObserver.observe(img));
    this.observers.set('images', imageObserver);
  }

  // 컴포넌트 지연 로딩
  lazyLoadComponents(container = document) {
    const components = container.querySelectorAll('[data-component]');
    
    if (components.length === 0) return;

    const componentObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const element = entry.target;
          const componentName = element.dataset.component;
          
          this.loadComponent(componentName, element);
          componentObserver.unobserve(element);
        }
      });
    }, {
      rootMargin: '100px'
    });

    components.forEach(component => componentObserver.observe(component));
    this.observers.set('components', componentObserver);
  }

  async loadComponent(componentName, element) {
    try {
      const componentPath = `./components/${componentName}.js`;
      const Component = await this.loadModule(componentPath);
      
      if (Component && typeof Component === 'function') {
        const instance = new Component(element);
        element._componentInstance = instance;
      }
    } catch (error) {
      console.error(`Failed to load component ${componentName}:`, error);
    }
  }

  // 라우트 기반 코드 분할
  async loadRoute(routePath) {
    const routeModule = await this.loadModule(`./routes/${routePath}.js`);
    return routeModule;
  }

  // 조건부 로딩
  async loadConditionally(modulePath, condition) {
    if (await condition()) {
      return this.loadModule(modulePath);
    }
    return null;
  }

  // 배치 로딩
  async loadBatch(modulePaths) {
    const promises = modulePaths.map(path => this.loadModule(path));
    return Promise.allSettled(promises);
  }

  // 프리로딩
  preloadModule(modulePath) {
    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = modulePath;
    document.head.appendChild(link);
  }

  // 프리페칭
  prefetchModule(modulePath) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = modulePath;
    document.head.appendChild(link);
  }

  // 로딩 상태 관리
  createLoadingState(element) {
    const loadingElement = document.createElement('div');
    loadingElement.className = 'loading-state';
    loadingElement.innerHTML = `
      <div class="loading-spinner"></div>
      <span>로딩 중...</span>
    `;
    
    element.appendChild(loadingElement);
    
    return {
      show: () => loadingElement.style.display = 'flex',
      hide: () => loadingElement.style.display = 'none',
      remove: () => loadingElement.remove()
    };
  }

  // 에러 바운더리
  createErrorBoundary(element, fallbackComponent) {
    return {
      catch: (error) => {
        console.error('Component error:', error);
        if (fallbackComponent) {
          element.innerHTML = fallbackComponent;
        } else {
          element.innerHTML = `
            <div class="error-boundary">
              <h3>오류가 발생했습니다</h3>
              <p>페이지를 새로고침해주세요.</p>
            </div>
          `;
        }
      }
    };
  }

  // 정리
  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
  }
}

// 전역 지연 로더
window.lazyLoader = new LazyLoader();

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
  window.lazyLoader.cleanup();
});

// 자동 초기화
document.addEventListener('DOMContentLoaded', () => {
  window.lazyLoader.lazyLoadImages();
  window.lazyLoader.lazyLoadComponents();
});

export default LazyLoader;

