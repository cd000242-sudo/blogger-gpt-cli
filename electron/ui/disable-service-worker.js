// Service Worker 비활성화 (file:// 프로토콜에서는 작동하지 않음)
// 이 스크립트는 다른 스크립트보다 먼저 실행되어야 함
(function() {
  if (window.location.protocol === 'file:' && 'serviceWorker' in navigator) {
    // 기존 Service Worker 등록 해제 (조용히 처리)
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      for (var i = 0; i < registrations.length; i++) {
        registrations[i].unregister().catch(function(err) {
          // 오류는 조용히 무시
        });
      }
    }).catch(function(err) {
      // 오류는 조용히 무시
    });
    
    // Service Worker 등록 방지
    var originalRegister = navigator.serviceWorker.register;
    navigator.serviceWorker.register = function() {
      // file:// 프로토콜에서는 등록하지 않음 (조용히 실패)
      return Promise.reject(new Error('Service Worker는 file:// 프로토콜에서 사용할 수 없습니다.'));
    };
    
    // Service Worker 컨트롤러도 제거 시도
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'TERMINATE' });
    }
  }
})();

