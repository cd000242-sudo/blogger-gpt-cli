// electron/ui/modules/url-image-collect.js
// "🔗 지금 수집" 단독 버튼 — 발행 흐름과 별개로 URL 이미지를 즉시 수집해 폴더에 저장
//   - 입력란: #urlImageSource
//   - 체크박스: #urlImageAiFill / #urlImageAiCheck / #urlImageVisible
//   - 결과 패널: #urlImageCollectResult
//   - IPC: window.electronAPI.crawlUrlImages(payload)

(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function getKeywordForFolder() {
    const kwInput = $('keywordInput');
    const firstLine = (kwInput?.value || '').split('\n').map(s => s.trim()).filter(Boolean)[0];
    return firstLine || '제목없음';
  }

  function showResult(html, isError, thumbnails) {
    const panel = $('urlImageCollectResult');
    if (!panel) return;
    panel.style.display = 'block';
    panel.style.borderColor = isError ? 'rgba(239,68,68,0.5)' : 'rgba(34,197,94,0.4)';
    panel.style.color = isError ? '#fecaca' : '#d1fae5';
    let inner = html;
    if (thumbnails && thumbnails.length > 0) {
      const grid = thumbnails.map((dataUrl, idx) =>
        `<img src="${dataUrl}" title="image-${String(idx + 1).padStart(3, '0')}"
              style="width:78px;height:78px;object-fit:cover;border-radius:6px;border:1px solid rgba(34,197,94,0.45);background:rgba(0,0,0,0.3);" />`
      ).join('');
      inner += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">${grid}</div>`;
    }
    panel.innerHTML = inner;
  }

  function setBusy(busy) {
    const btn = $('urlImageCollectBtn');
    if (!btn) return;
    btn.disabled = busy;
    btn.style.opacity = busy ? '0.6' : '1';
    btn.style.cursor = busy ? 'wait' : 'pointer';
    btn.innerHTML = busy ? '⏳ 수집 중…' : '🔗 지금 수집';
  }

  async function runNow() {
    const url = ($('urlImageSource')?.value || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      showResult('❌ http(s)로 시작하는 URL을 입력해주세요.', true);
      return;
    }
    if (!window.electronAPI?.crawlUrlImages) {
      showResult('❌ IPC가 준비되지 않았습니다. 앱을 재시작해주세요.', true);
      return;
    }

    const aiCheckEnabled = !!$('urlImageAiCheck')?.checked;
    const visible = !!$('urlImageVisible')?.checked;
    const postTitle = getKeywordForFolder();

    setBusy(true);
    showResult(`🌐 ${visible ? '브라우저 창이 뜹니다' : '헤드리스 수집 중'}… (URL: ${url.slice(0, 60)}…)`);

    try {
      const result = await window.electronAPI.crawlUrlImages({
        url,
        postTitle,
        mainKeyword: postTitle,
        aiCheckEnabled,
        textGenerator: 'gemini-2.5-flash',
        threshold: 60,
        visible,
      });

      if (!result?.ok) {
        showResult(`❌ 실패: ${result?.error || '알 수 없는 오류'}`, true);
        return;
      }

      const raw = (result.rawImages || []).length;
      const accepted = (result.acceptedImages || []).length;
      const saved = (result.savedFiles || []).length;
      const deduped = result.deduped || 0;
      const dir = result.saveDir || '';
      const cost = result.costKrw || 0;
      const thumbnails = result.thumbnails || [];

      const lines = [];
      const dedupeNote = deduped > 0 ? ` / 중복차단 ${deduped}개` : '';
      lines.push(`✅ <b>수집 완료</b> — 추출 ${raw}개 / AI 통과 ${accepted}개 / 저장 ${saved}개${dedupeNote}`);
      if (dir) lines.push(`📁 저장 위치: <code style="background:rgba(0,0,0,0.4);padding:2px 6px;border-radius:4px;font-size:11px;">${dir}</code>`);
      if (cost > 0) lines.push(`💰 vision 비용: ₩${cost.toFixed(1)}`);
      if (result.routing?.fellBack) lines.push(`⚠️ vision 라우팅 폴백: ${result.routing.reason || '미상'}`);
      if (saved > thumbnails.length) lines.push(`<span style="color:rgba(255,255,255,0.55);font-size:11px;">미리보기는 첫 ${thumbnails.length}개만 표시 (전체 ${saved}개는 폴더에서 확인)</span>`);
      showResult(lines.join('<br>'), false, thumbnails);
    } catch (e) {
      showResult(`❌ 예외: ${e?.message || String(e)}`, true);
    } finally {
      setBusy(false);
    }
  }

  window.__urlImageCollect = { runNow };
})();
