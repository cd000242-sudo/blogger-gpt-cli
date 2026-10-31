// 이미지 엔진이 있는 모든 화면(설정·대기열·편집기)에 같은 젠스파크 계정 연결을 제공한다.
(function () {
  'use strict';
  const panels = new Map();
  let refreshScheduled = false;

  function renderStatus(panel) {
    const state = window.__gensparkAuthState || {};
    const status = panel.querySelector('[data-genspark-status]');
    const text = state.text || '리서치와 같은 젠스파크 계정을 사용합니다. [상태 확인]으로 연결을 확인하세요.';
    if (status.textContent !== text) status.textContent = text;
    status.style.color = state.color || '#cbd5e1';
    panel.querySelectorAll('button').forEach(btn => { btn.disabled = !!state.busy; });
  }

  function refresh() {
    refreshScheduled = false;
    for (const [select, panel] of panels) {
      if (!select.isConnected || !select.querySelector('option[value="genspark-image"]')) { panel.remove(); panels.delete(select); }
    }
    document.querySelectorAll('select').forEach(select => {
      if (!select.querySelector('option[value="genspark-image"]')) return;
      let panel = panels.get(select);
      if (!panel) {
        panel = document.createElement('div');
        panel.className = 'genspark-image-auth';
        panel.style.cssText = 'flex:1 1 100%;grid-column:1 / -1;min-width:0;padding:8px 10px;margin-top:6px;border:1px solid #475569;border-radius:8px;background:#1e293b;color:#e2e8f0;font-size:12px;line-height:1.5;';
        panel.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center"><strong>✨ 젠스파크 연결</strong><button type="button" data-genspark-action="login">🔑 젠스파크 로그인</button><button type="button" data-genspark-action="check">상태 확인</button></div><div data-genspark-status role="status" aria-live="polite" style="margin-top:5px;overflow-wrap:anywhere"></div>';
        panel.querySelectorAll('button').forEach(btn => {
          btn.style.cssText = 'padding:5px 9px;border:1px solid #64748b;border-radius:6px;background:#334155;color:#f8fafc;cursor:pointer;font:inherit;';
          btn.addEventListener('click', () => {
            if (btn.dataset.gensparkAction === 'login') window.handleGensparkLogin?.();
            else window.handleGensparkCheck?.();
          });
        });
        panels.set(select, panel);
      }
      if (select.nextElementSibling !== panel) select.insertAdjacentElement('afterend', panel);
      panel.hidden = select.value !== 'genspark-image';
      renderStatus(panel);
    });
  }

  function scheduleRefresh() {
    if (refreshScheduled) return;
    refreshScheduled = true;
    setTimeout(refresh, 0);
  }

  function init() {
    refresh();
    document.addEventListener('change', event => {
      scheduleRefresh();
      if (event.target.matches?.('select') && event.target.value === 'genspark-image') window.handleGensparkCheck?.();
    });
    // 설정 불러오기에서 value를 대입하거나 편집기/대기열을 나중에 여는 경우도 반영한다.
    document.addEventListener('click', scheduleRefresh);
    document.addEventListener('focusin', scheduleRefresh);
    new MutationObserver(records => {
      if (records.some(record => [...record.addedNodes].some(node => node.nodeType === 1 &&
        (node.matches('select,option,optgroup') || node.querySelector('select,option,optgroup'))))) scheduleRefresh();
    }).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('genspark-auth-state', () => panels.forEach(renderStatus));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
