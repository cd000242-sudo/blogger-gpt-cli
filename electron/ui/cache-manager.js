// 고성능 캐싱 시스템
class CacheManager {
  constructor() {
    this.memoryCache = new Map();
    this.indexedDBCache = null;
    this.serviceWorkerCache = null;
    this.maxMemorySize = 50; // 최대 메모리 캐시 항목 수
    this.maxMemorySizeBytes = 10 * 1024 * 1024; // 10MB
    this.defaultTTL = 5 * 60 * 1000; // 5분
    this.init();
  }

  async init() {
    // IndexedDB 초기화
    await this.initIndexedDB();
    
    // Service Worker 캐시 초기화 (file:// 프로토콜에서는 사용하지 않음)
    // Service Worker는 HTTP/HTTPS 프로토콜에서만 작동합니다
    const isFileProtocol = window.location.protocol === 'file:';
    if (!isFileProtocol && 'serviceWorker' in navigator && 'caches' in window) {
      try {
        this.serviceWorkerCache = await caches.open('app-cache-v1');
      } catch (error) {
        console.warn('[CacheManager] Service Worker 캐시 초기화 실패:', error);
        this.serviceWorkerCache = null;
      }
    }
  }

  async initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AppCache', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.indexedDBCache = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains('cache')) {
          const store = db.createObjectStore('cache', { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  // 캐시 키 생성
  generateKey(url, options = {}) {
    const params = new URLSearchParams(options);
    return `${url}?${params.toString()}`;
  }

  // 메모리 캐시 관리
  setMemoryCache(key, value, ttl = this.defaultTTL) {
    // 메모리 사용량 체크
    if (this.memoryCache.size >= this.maxMemorySize) {
      this.cleanOldMemoryCache();
    }

    this.memoryCache.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
      size: this.calculateSize(value)
    });
  }

  getMemoryCache(key) {
    const item = this.memoryCache.get(key);
    if (!item) return null;

    // TTL 확인
    if (Date.now() - item.timestamp > item.ttl) {
      this.memoryCache.delete(key);
      return null;
    }

    return item.value;
  }

  // IndexedDB 캐시 관리
  async setIndexedDBCache(key, value, ttl = this.defaultTTL) {
    if (!this.indexedDBCache) return;

    const transaction = this.indexedDBCache.transaction(['cache'], 'readwrite');
    const store = transaction.objectStore('cache');
    
    await store.put({
      key,
      value,
      timestamp: Date.now(),
      ttl
    });
  }

  async getIndexedDBCache(key) {
    if (!this.indexedDBCache) return null;

    const transaction = this.indexedDBCache.transaction(['cache'], 'readonly');
    const store = transaction.objectStore('cache');
    
    return new Promise((resolve) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const item = request.result;
        if (!item) {
          resolve(null);
          return;
        }

        // TTL 확인
        if (Date.now() - item.timestamp > item.ttl) {
          this.deleteIndexedDBCache(key);
          resolve(null);
          return;
        }

        resolve(item.value);
      };
      request.onerror = () => resolve(null);
    });
  }

  async deleteIndexedDBCache(key) {
    if (!this.indexedDBCache) return;

    const transaction = this.indexedDBCache.transaction(['cache'], 'readwrite');
    const store = transaction.objectStore('cache');
    await store.delete(key);
  }

  // Service Worker 캐시 관리
  async setServiceWorkerCache(key, response) {
    if (!this.serviceWorkerCache) return;

    await this.serviceWorkerCache.put(key, response);
  }

  async getServiceWorkerCache(key) {
    if (!this.serviceWorkerCache) return null;

    return await this.serviceWorkerCache.match(key);
  }

  // 통합 캐시 API
  async set(key, value, options = {}) {
    const { ttl = this.defaultTTL, strategy = 'memory' } = options;

    // 메모리 캐시에 저장
    if (strategy === 'memory' || strategy === 'hybrid') {
      this.setMemoryCache(key, value, ttl);
    }

    // IndexedDB에 저장
    if (strategy === 'persistent' || strategy === 'hybrid') {
      await this.setIndexedDBCache(key, value, ttl);
    }

    // Service Worker 캐시에 저장 (Response 객체인 경우)
    if (strategy === 'network' && value instanceof Response) {
      await this.setServiceWorkerCache(key, value);
    }
  }

  async get(key, options = {}) {
    const { strategy = 'memory' } = options;

    // 메모리 캐시에서 먼저 확인
    if (strategy === 'memory' || strategy === 'hybrid') {
      const memoryValue = this.getMemoryCache(key);
      if (memoryValue !== null) {
        return memoryValue;
      }
    }

    // IndexedDB에서 확인
    if (strategy === 'persistent' || strategy === 'hybrid') {
      const persistentValue = await this.getIndexedDBCache(key);
      if (persistentValue !== null) {
        // 메모리 캐시에도 저장
        if (strategy === 'hybrid') {
          this.setMemoryCache(key, persistentValue);
        }
        return persistentValue;
      }
    }

    // Service Worker 캐시에서 확인
    if (strategy === 'network') {
      return await this.getServiceWorkerCache(key);
    }

    return null;
  }

  // HTTP 요청 캐싱
  async fetchWithCache(url, options = {}) {
    const { 
      cacheStrategy = 'hybrid',
      ttl = this.defaultTTL,
      ...fetchOptions 
    } = options;

    const cacheKey = this.generateKey(url, fetchOptions);

    // 캐시에서 확인
    const cachedResponse = await this.get(cacheKey, { strategy: cacheStrategy });
    if (cachedResponse) {
      return cachedResponse;
    }

    // 네트워크에서 요청
    try {
      const response = await fetch(url, fetchOptions);
      
      if (response.ok) {
        // 응답을 캐시에 저장
        await this.set(cacheKey, response.clone(), { 
          ttl, 
          strategy: cacheStrategy 
        });
      }
      
      return response;
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  }

  // 이미지 캐싱
  async cacheImage(url) {
    const cacheKey = `image:${url}`;
    
    // 캐시에서 확인
    const cachedImage = await this.get(cacheKey);
    if (cachedImage) {
      return cachedImage;
    }

    // 이미지 로드
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        // 캔버스에 그려서 캐시
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        this.set(cacheKey, imageData, { strategy: 'hybrid' });
        resolve(imageData);
      };
      
      img.onerror = reject;
      img.src = url;
    });
  }

  // 캐시 크기 계산
  calculateSize(value) {
    if (typeof value === 'string') {
      return value.length * 2; // UTF-16 문자당 2바이트
    }
    
    if (value instanceof ArrayBuffer) {
      return value.byteLength;
    }
    
    if (value instanceof Response) {
      return 1024; // 추정값
    }
    
    return JSON.stringify(value).length * 2;
  }

  // 오래된 캐시 정리
  cleanOldMemoryCache() {
    const now = Date.now();
    const entries = Array.from(this.memoryCache.entries());
    
    // TTL이 만료된 항목들 제거
    entries.forEach(([key, item]) => {
      if (now - item.timestamp > item.ttl) {
        this.memoryCache.delete(key);
      }
    });

    // 여전히 크기가 크면 가장 오래된 항목들 제거
    if (this.memoryCache.size >= this.maxMemorySize) {
      const sortedEntries = entries
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, Math.floor(this.maxMemorySize / 2));
      
      sortedEntries.forEach(([key]) => {
        this.memoryCache.delete(key);
      });
    }
  }

  // 캐시 통계
  getCacheStats() {
    const memoryEntries = Array.from(this.memoryCache.values());
    const memorySize = memoryEntries.reduce((total, item) => total + item.size, 0);
    
    return {
      memory: {
        entries: this.memoryCache.size,
        size: memorySize,
        maxSize: this.maxMemorySizeBytes
      },
      indexedDB: this.indexedDBCache ? 'available' : 'unavailable',
      serviceWorker: this.serviceWorkerCache ? 'available' : 'unavailable'
    };
  }

  // 전체 캐시 정리
  async clear() {
    this.memoryCache.clear();
    
    if (this.indexedDBCache) {
      const transaction = this.indexedDBCache.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      await store.clear();
    }
    
    if (this.serviceWorkerCache) {
      await this.serviceWorkerCache.keys().then(keys => {
        return Promise.all(keys.map(key => this.serviceWorkerCache.delete(key)));
      });
    }
  }
}

// 전역 캐시 매니저
window.cacheManager = new CacheManager();

export default CacheManager;

