// Service Worker for caching and performance
const CACHE_NAME = 'blogger-gpt-cli-v1';
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/performance-optimizer.js',
  '/memory-manager.js',
  '/lazy-loader.js',
  '/cache-manager.js'
];

// Install event - 캐시 생성
self.addEventListener('install', (event) => {
  // file:// 프로토콜에서는 Service Worker가 작동하지 않음 (조용히 무시)
  if (self.location.protocol === 'file:') {
    return;
  }
  
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching static assets...');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('Service Worker installed successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker installation failed:', error);
      })
  );
});

// Activate event - 오래된 캐시 정리
self.addEventListener('activate', (event) => {
  // file:// 프로토콜에서는 Service Worker가 작동하지 않음 (조용히 무시)
  if (self.location.protocol === 'file:') {
    return;
  }
  
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker activated successfully');
        return self.clients.claim();
      })
      .catch((error) => {
        console.warn('[ServiceWorker] Activate 실패:', error);
      })
  );
});

// Fetch event - 캐시 전략 구현
self.addEventListener('fetch', (event) => {
  // file:// 프로토콜에서는 Service Worker가 작동하지 않으므로 완전히 무시
  try {
    const url = new URL(event.request.url);
    if (url.protocol === 'file:') {
      // file:// 프로토콜에서는 이벤트를 처리하지 않음 (브라우저 기본 동작 사용)
      return;
    }
  } catch (e) {
    // URL 파싱 실패 시에도 처리하지 않음
    return;
  }
  
  const { request } = event;
  const url = new URL(request.url);
  
  // 네트워크 전용 요청들은 처리하지 않음
  if (request.method !== 'GET' || 
      url.pathname.includes('/api/') ||
      url.pathname.includes('/generate') ||
      url.pathname.includes('/upload')) {
    return;
  }
  
  // HTTP/HTTPS 프로토콜에서만 캐시 전략 적용
  try {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          // 캐시에 있으면 반환
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // 네트워크에서 요청
          return fetch(request)
            .then((response) => {
              // 응답이 유효한 경우에만 캐시에 저장
              if (response.status === 200 && response.type === 'basic') {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(request, responseToCache);
                  })
                  .catch(() => {
                    // 캐시 저장 실패는 무시
                  });
              }
              return response;
            })
            .catch(() => {
              // 네트워크 실패 시 오프라인 페이지 반환
              if (request.destination === 'document') {
                return caches.match('/index.html');
              }
              // 기본 응답 반환
              return new Response('', { status: 503, statusText: 'Service Unavailable' });
            });
        })
        .catch(() => {
          // 캐시 매칭 실패 시 네트워크 요청 시도
          return fetch(request).catch(() => {
            return new Response('', { status: 503, statusText: 'Service Unavailable' });
          });
        })
    );
  } catch (error) {
    // 모든 오류는 조용히 무시 (브라우저 기본 동작 사용)
    return;
  }
});

// 백그라운드 동기화
self.addEventListener('sync', (event) => {
  console.log('Background sync:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // 백그라운드 작업 수행
      doBackgroundWork()
    );
  }
});

// 푸시 알림 처리
self.addEventListener('push', (event) => {
  console.log('Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : '새로운 알림이 있습니다.',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: '확인하기',
        icon: '/checkmark.png'
      },
      {
        action: 'close',
        title: '닫기',
        icon: '/xmark.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('LEADERNAM Orbit', options)
  );
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// 백그라운드 작업 함수
async function doBackgroundWork() {
  try {
    // 캐시 정리
    const cacheNames = await caches.keys();
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      
      // 오래된 요청들 정리 (7일 이상)
      const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
          const dateHeader = response.headers.get('date');
          if (dateHeader && new Date(dateHeader).getTime() < weekAgo) {
            await cache.delete(request);
          }
        }
      }
    }
    
    console.log('Background work completed');
  } catch (error) {
    console.error('Background work failed:', error);
  }
}

// 메시지 처리
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_URLS':
      caches.open(CACHE_NAME)
        .then((cache) => cache.addAll(data.urls));
      break;
      
    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME)
        .then(() => {
          event.ports[0].postMessage({ success: true });
        });
      break;
      
    default:
      console.log('Unknown message type:', type);
  }
});

