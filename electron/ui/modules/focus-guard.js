/**
 * focus-guard.js — Windows Electron 포커스 버그 가드 (렌더러 계층, v3.8.519)
 *
 * 증상: 네이티브 팝업(alert/confirm/prompt)이나 파일 선택창이 닫힌 뒤
 *       버튼·입력이 반응하지 않는다. 바탕화면을 한 번 클릭해 창 포커스를
 *       잃었다 되찾으면 정상으로 돌아온다.
 * 원인: 팝업이 닫혀도 입력 라우팅이 창으로 되돌아오지 않는다 (창은 활성처럼
 *       보이지만 키·마우스 입력을 받는 대상이 어긋난 상태).
 * 처방: 팝업이 닫힌 직후 메인에 창 포커스 리셋(blur→focus)을 요청한다.
 *       사용자가 손으로 하던 "바탕화면 클릭 후 복귀"를 앱이 대신 해주는 것이다.
 *
 * 원칙:
 *  - 원본 동작과 반환값은 절대 바꾸지 않는다 (finally 에서만 요청).
 *  - 50ms 디바운스 — 팝업이 연달아 뜨면 마지막 한 번만 리셋한다.
 *  - 실패는 조용히 넘긴다. 포커스 복구 실패가 앱을 멈추면 배보다 배꼽이 크다.
 *  - 반드시 다른 스크립트보다 먼저 로드된다 (index.html <head> 최상단).
 */
(function installFocusGuard() {
  'use strict';
  if (window.__focusGuardInstalled) return;
  window.__focusGuardInstalled = true;

  var DEBOUNCE_MS = 50;
  var timer = null;

  function requestRefocus() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      timer = null;
      try {
        // preload 브리지 우선, 없으면 범용 invoke 로 폴백 (배선 한 쪽이 늦게 붙어도 동작)
        if (window.focusGuard && typeof window.focusGuard.refocus === 'function') {
          window.focusGuard.refocus();
        } else if (window.electronAPI && typeof window.electronAPI.invoke === 'function') {
          window.electronAPI.invoke('window:refocus');
        }
      } catch (e) { /* 포커스 복구 실패가 앱을 막으면 안 된다 */ }
    }, DEBOUNCE_MS);
  }
  window.__requestWindowRefocus = requestRefocus;

  // ── 네이티브 팝업 3종 래핑 — 반환값·예외를 그대로 통과시킨다 ──
  ['alert', 'confirm', 'prompt'].forEach(function (name) {
    var original = window[name];
    if (typeof original !== 'function') return;
    var wrapped = function () {
      try {
        return original.apply(window, arguments);
      } finally {
        requestRefocus();
      }
    };
    wrapped.__focusGuarded = true;
    window[name] = wrapped;
  });

  /**
   * 파일 선택창도 같은 증상이다. 다만 열리는 시점(click)에 바로 리셋하면
   * 아직 열려 있는 창에서 포커스를 뺏는다 — 닫힌 뒤에만 요청해야 한다.
   * 닫힘 신호: change(파일 고름) 또는 창이 포커스를 되찾는 순간(취소 포함).
   */
  var filePending = false;
  function isFileInput(el) {
    return !!el && el.tagName === 'INPUT' && String(el.type || '').toLowerCase() === 'file';
  }
  document.addEventListener('click', function (evt) {
    if (isFileInput(evt.target)) filePending = true;
  }, true);
  document.addEventListener('change', function (evt) {
    if (!isFileInput(evt.target)) return;
    filePending = false;
    requestRefocus();
  }, true);
  window.addEventListener('focus', function () {
    if (!filePending) return;
    filePending = false;
    requestRefocus();
  });
})();
