// v3.8.176: AdSense 정책 위반 자동 해결 모달
'use strict';

function openAdSenseFixerModal() {
  const existing = document.getElementById('adsense-fixer-modal');
  if (existing) existing.remove();

  const html = `
<div id="adsense-fixer-modal" style="position:fixed;inset:0;z-index:100002;background:rgba(2,6,23,0.92);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;">
  <div style="width:min(900px,100%);max-height:calc(100vh - 40px);background:linear-gradient(135deg,#0f172a,#1e293b);border:1px solid rgba(251,191,36,0.4);border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,0.7);overflow:hidden;display:flex;flex-direction:column;">
    <div style="padding:24px 28px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:14px;">
        <div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#f59e0b,#d97706);display:flex;align-items:center;justify-content:center;font-size:24px;">🚨</div>
        <div>
          <h2 style="margin:0;font-size:22px;font-weight:900;color:#fff;">AdSense 정책 위반 자동 해결</h2>
          <p style="margin:4px 0 0 0;color:#94a3b8;font-size:12px;">진단 → 자동 수정 → 재검토 요청</p>
        </div>
      </div>
      <button id="adsense-fixer-close" style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);color:#fff;font-size:20px;cursor:pointer;">×</button>
    </div>
    <div style="padding:24px 28px;overflow-y:auto;flex:1;">
      <div style="margin-bottom:18px;">
        <label style="display:block;color:#cbd5e1;font-size:12px;font-weight:800;margin-bottom:6px;">사이트 URL</label>
        <input type="text" id="adsense-fixer-url" placeholder="https://tjdgus24280.blogspot.com" value="" style="width:100%;padding:12px 14px;background:rgba(15,23,42,0.7);border:1px solid rgba(148,163,184,0.25);border-radius:10px;color:#f1f5f9;font-size:14px;font-weight:600;">
        <p style="margin:6px 0 0 0;color:#64748b;font-size:11px;">Blogger 사이트만 지원. Blog ID는 환경설정에서 자동 로드.</p>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;">
        <button id="adsense-fix-open-console" style="padding:14px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:white;border:0;border-radius:10px;font-weight:800;font-size:13px;cursor:pointer;">🌐 AdSense 콘솔 + Blogger 어드민 + 사이트 자동 열기</button>
        <button id="adsense-fix-diagnose" style="padding:14px;background:linear-gradient(135deg,#0ea5e9,#0369a1);color:white;border:0;border-radius:10px;font-weight:800;font-size:13px;cursor:pointer;">🔍 사이트 자동 진단 시작</button>
      </div>
      <div id="adsense-fixer-result" style="margin-top:14px;"></div>
    </div>
  </div>
</div>`;
  document.body.insertAdjacentHTML('beforeend', html);

  // URL 자동 채움 (Blogger 환경설정에서)
  try {
    const blogId = document.getElementById('blogId')?.value?.trim();
    if (blogId) {
      // blogId만으로는 URL 못 구함 — 사용자가 직접 입력
    }
    const lastUrl = localStorage.getItem('lastAdSenseFixerUrl') || '';
    if (lastUrl) document.getElementById('adsense-fixer-url').value = lastUrl;
  } catch {}

  document.getElementById('adsense-fixer-close').addEventListener('click', () => {
    document.getElementById('adsense-fixer-modal')?.remove();
  });

  const resultEl = document.getElementById('adsense-fixer-result');
  const getSiteUrl = () => {
    const u = (document.getElementById('adsense-fixer-url')?.value || '').trim();
    if (u) localStorage.setItem('lastAdSenseFixerUrl', u);
    return u;
  };

  document.getElementById('adsense-fix-open-console').addEventListener('click', async () => {
    const url = getSiteUrl();
    resultEl.innerHTML = `<div style="padding:12px;background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.3);border-radius:8px;color:#bfdbfe;font-size:13px;">⏳ AdSense 콘솔 + Blogger 어드민 자동 열기 중...</div>`;
    try {
      const r = await window.electronAPI.adsenseOpenConsole({ siteUrl: url });
      if (r.ok) {
        resultEl.innerHTML = `<div style="padding:12px;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);border-radius:8px;color:#86efac;font-size:13px;">✅ ${r.message}</div>`;
      } else {
        resultEl.innerHTML = `<div style="padding:12px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:8px;color:#fca5a5;font-size:13px;">❌ ${r.error}</div>`;
      }
    } catch (e) {
      resultEl.innerHTML = `<div style="padding:12px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:8px;color:#fca5a5;font-size:13px;">❌ ${e?.message || e}</div>`;
    }
  });

  document.getElementById('adsense-fix-diagnose').addEventListener('click', async () => {
    const url = getSiteUrl();
    if (!url) { resultEl.innerHTML = `<div style="padding:12px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:8px;color:#fca5a5;font-size:13px;">⚠️ 사이트 URL 입력 필요</div>`; return; }
    resultEl.innerHTML = `<div style="padding:12px;background:rgba(14,165,233,0.12);border:1px solid rgba(14,165,233,0.3);border-radius:8px;color:#a5f3fc;font-size:13px;">⏳ 사이트 진단 중... (RSS 피드 + 패턴 검사)</div>`;
    try {
      const r = await window.electronAPI.adsenseDiagnose({ siteUrl: url });
      if (!r.ok) {
        resultEl.innerHTML = `<div style="padding:12px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:8px;color:#fca5a5;font-size:13px;">❌ ${r.error}</div>`;
        return;
      }
      const s = r.summary;
      const violationList = r.titleViolations.slice(0, 10).map(v => `<li><strong>${escHtml(v.title)}</strong><br><span style="color:#94a3b8;font-size:11px;">위반 패턴: ${v.matches.join(', ')}</span></li>`).join('');
      const dupList = r.duplicateTopics.slice(0, 5).map(d => `<li><strong>${escHtml(d.topic)}</strong>: ${d.count}편</li>`).join('');
      const missing = r.missingPages.join(', ') || '(없음)';
      resultEl.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;">
          <div style="padding:10px;background:rgba(15,23,42,0.6);border-radius:8px;text-align:center;">
            <div style="color:#94a3b8;font-size:11px;">총 글</div>
            <div style="color:#f1f5f9;font-size:20px;font-weight:900;">${s.totalPosts}</div>
          </div>
          <div style="padding:10px;background:rgba(239,68,68,0.12);border-radius:8px;text-align:center;">
            <div style="color:#fca5a5;font-size:11px;">Clickbait</div>
            <div style="color:#fee2e2;font-size:20px;font-weight:900;">${s.clickbaitCount}</div>
            <div style="color:#fca5a5;font-size:10px;">${s.clickbaitPercent}%</div>
          </div>
          <div style="padding:10px;background:rgba(245,158,11,0.12);border-radius:8px;text-align:center;">
            <div style="color:#fde68a;font-size:11px;">중복 주제</div>
            <div style="color:#fef3c7;font-size:20px;font-weight:900;">${s.duplicateTopicCount}</div>
          </div>
          <div style="padding:10px;background:rgba(239,68,68,0.12);border-radius:8px;text-align:center;">
            <div style="color:#fca5a5;font-size:11px;">누락 페이지</div>
            <div style="color:#fee2e2;font-size:20px;font-weight:900;">${s.missingPageCount}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
          <div style="padding:12px;background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.2);border-radius:10px;">
            <div style="color:#fbbf24;font-size:13px;font-weight:800;margin-bottom:8px;">📌 누락된 페이지</div>
            <div style="color:#cbd5e1;font-size:12px;">${missing}</div>
            ${r.missingPages.length > 0 ? `<button id="adsense-create-pages-btn" style="margin-top:10px;padding:8px 12px;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;border:0;border-radius:8px;font-weight:800;font-size:12px;cursor:pointer;width:100%;">📄 누락된 페이지 자동 생성</button>` : ''}
          </div>
          <div style="padding:12px;background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.2);border-radius:10px;">
            <div style="color:#fbbf24;font-size:13px;font-weight:800;margin-bottom:8px;">🔁 중복 주제 Top 5</div>
            <ul style="margin:0;padding-left:18px;color:#cbd5e1;font-size:12px;line-height:1.7;">${dupList || '<li>없음</li>'}</ul>
          </div>
        </div>
        <div style="padding:12px;background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.2);border-radius:10px;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div style="color:#fbbf24;font-size:13px;font-weight:800;">⚠️ Clickbait/HCU 위반 제목 (최대 10개)</div>
            ${s.clickbaitCount > 0 ? `<button id="adsense-clean-titles-btn" style="padding:6px 12px;background:linear-gradient(135deg,#ef4444,#dc2626);color:white;border:0;border-radius:8px;font-weight:800;font-size:11px;cursor:pointer;">🧹 제목 일괄 정리</button>` : ''}
          </div>
          <ul style="margin:0;padding-left:18px;color:#cbd5e1;font-size:12px;line-height:1.7;">${violationList || '<li>없음 ✅</li>'}</ul>
        </div>
      `;

      // 페이지 자동 생성 버튼
      const createBtn = document.getElementById('adsense-create-pages-btn');
      if (createBtn) {
        createBtn.addEventListener('click', async () => {
          const blogId = document.getElementById('blogId')?.value?.trim();
          if (!blogId) { alert('Blog ID 환경설정에 저장 필요'); return; }
          createBtn.disabled = true; createBtn.textContent = '⏳ 생성 중...';
          const cr = await window.electronAPI.adsenseCreatePages({ blogId, pages: r.missingPages });
          if (cr.ok) {
            const success = cr.results.filter(r => r.ok).length;
            const fail = cr.results.length - success;
            alert(`✅ 페이지 ${success}개 생성 완료${fail > 0 ? ` (${fail}개 실패)` : ''}\n\n` + cr.results.map(r => `${r.ok ? '✅' : '❌'} ${r.name}: ${r.ok ? r.url : r.error}`).join('\n'));
          } else {
            alert('❌ ' + cr.error);
          }
          createBtn.disabled = false; createBtn.textContent = '📄 누락된 페이지 자동 생성';
        });
      }

      // 제목 일괄 정리 버튼
      const cleanBtn = document.getElementById('adsense-clean-titles-btn');
      if (cleanBtn) {
        cleanBtn.addEventListener('click', async () => {
          if (!confirm(`Clickbait 제목 ${s.clickbaitCount}개를 일괄 정리합니다.\n\n금지어 자동 제거 + 이모지 정리.\n\n진행할까요?`)) return;
          const blogId = document.getElementById('blogId')?.value?.trim();
          if (!blogId) { alert('Blog ID 환경설정에 저장 필요'); return; }
          cleanBtn.disabled = true; cleanBtn.textContent = '⏳ 글 목록 가져오는 중...';
          const lr = await window.electronAPI.adsenseListClickbaitPosts({ blogId });
          if (!lr.ok) { alert('❌ ' + lr.error); cleanBtn.disabled = false; cleanBtn.textContent = '🧹 제목 일괄 정리'; return; }
          cleanBtn.textContent = `⏳ ${lr.total}개 제목 수정 중...`;
          const postIds = lr.posts.map(p => p.id);
          const cr = await window.electronAPI.adsenseCleanPostTitles({ blogId, postIds });
          if (cr.ok) {
            const updated = cr.results.filter(r => r.ok && r.newTitle !== r.oldTitle).length;
            alert(`✅ ${updated}개 제목 자동 수정 완료\n\n${cr.results.filter(r => r.ok && r.newTitle !== r.oldTitle).slice(0, 10).map(r => `· ${r.oldTitle.substring(0, 30)} → ${r.newTitle.substring(0, 30)}`).join('\n')}`);
          } else {
            alert('❌ ' + cr.error);
          }
          cleanBtn.disabled = false; cleanBtn.textContent = '🧹 제목 일괄 정리';
        });
      }
    } catch (e) {
      resultEl.innerHTML = `<div style="padding:12px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:8px;color:#fca5a5;font-size:13px;">❌ ${e?.message || e}</div>`;
    }
  });
}

function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

window.openAdSenseFixerModal = openAdSenseFixerModal;
console.log('[ADSENSE-FIXER] ✅ 모듈 로드 완료');
