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

      // v3.8.178: 제목 일괄 정리 — Dry-run 2단계 (미리보기 → 사용자 승인 → 실제 적용)
      const cleanBtn = document.getElementById('adsense-clean-titles-btn');
      if (cleanBtn) {
        cleanBtn.addEventListener('click', async () => {
          const blogId = document.getElementById('blogId')?.value?.trim();
          if (!blogId) { alert('Blog ID 환경설정에 저장 필요'); return; }
          cleanBtn.disabled = true; cleanBtn.textContent = '⏳ 글 목록 가져오는 중...';
          const lr = await window.electronAPI.adsenseListClickbaitPosts({ blogId });
          if (!lr.ok) { alert('❌ ' + lr.error); cleanBtn.disabled = false; cleanBtn.textContent = '🧹 제목 일괄 정리'; return; }
          if (lr.total === 0) { alert('수정할 글이 없습니다.'); cleanBtn.disabled = false; cleanBtn.textContent = '🧹 제목 일괄 정리'; return; }
          cleanBtn.textContent = `⏳ ${lr.total}개 미리보기 중...`;
          const postIds = lr.posts.map(p => p.id);
          // ===== 1단계: Dry-run (실제 patch 안 함) =====
          const cr = await window.electronAPI.adsenseCleanPostTitles({ blogId, postIds, dryRun: true });
          cleanBtn.disabled = false; cleanBtn.textContent = '🧹 제목 일괄 정리';
          if (!cr.ok) { alert('❌ 미리보기 실패: ' + cr.error); return; }
          showCleanResultModal(cr, blogId, postIds);
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

// v3.8.178: Dry-run 결과 모달 — 사용자가 확인 후 승인하면 실제 patch
function showCleanResultModal(cr, blogId, postIds) {
  const existing = document.getElementById('adsense-clean-result-modal');
  if (existing) existing.remove();
  const s = cr.stats;
  const willPatch = s.preview;
  const noChange = s.no_change;
  const tooShort = s.too_short;
  const fetchFail = s.fetch_failed;
  const previewItems = cr.results.filter(r => r.status === 'preview').slice(0, 30);
  const tooShortItems = cr.results.filter(r => r.status === 'too_short').slice(0, 10);
  const fetchFailItems = cr.results.filter(r => r.status === 'fetch_failed').slice(0, 5);

  const html = `
<div id="adsense-clean-result-modal" style="position:fixed;inset:0;z-index:100003;background:rgba(2,6,23,0.93);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;">
  <div style="width:min(960px,100%);max-height:calc(100vh - 40px);background:linear-gradient(135deg,#0f172a,#1e293b);border:1px solid rgba(251,191,36,0.4);border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,0.7);overflow:hidden;display:flex;flex-direction:column;">
    <div style="padding:24px 28px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;">
      <div>
        <h2 style="margin:0;font-size:20px;font-weight:900;color:#fff;">🔍 제목 정리 미리보기</h2>
        <p style="margin:4px 0 0 0;color:#94a3b8;font-size:12px;">⚠️ 아직 사이트에 적용되지 않았습니다. 확인 후 ${willPatch > 0 ? '아래 "실제 적용"' : '닫기'}을 누르세요.</p>
      </div>
      <button id="adsense-clean-close" style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);color:#fff;font-size:20px;cursor:pointer;">×</button>
    </div>
    <div style="padding:18px 28px;border-bottom:1px solid rgba(255,255,255,0.08);">
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;">
        <div style="padding:10px;background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.35);border-radius:8px;text-align:center;">
          <div style="color:#86efac;font-size:11px;font-weight:700;">수정 예정</div>
          <div style="color:#dcfce7;font-size:20px;font-weight:900;">${willPatch}</div>
        </div>
        <div style="padding:10px;background:rgba(148,163,184,0.15);border:1px solid rgba(148,163,184,0.3);border-radius:8px;text-align:center;">
          <div style="color:#cbd5e1;font-size:11px;font-weight:700;">변화 없음</div>
          <div style="color:#f1f5f9;font-size:20px;font-weight:900;">${noChange}</div>
        </div>
        <div style="padding:10px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.35);border-radius:8px;text-align:center;">
          <div style="color:#fde68a;font-size:11px;font-weight:700;">너무 짧음 (skip)</div>
          <div style="color:#fef3c7;font-size:20px;font-weight:900;">${tooShort}</div>
        </div>
        <div style="padding:10px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.35);border-radius:8px;text-align:center;">
          <div style="color:#fca5a5;font-size:11px;font-weight:700;">조회 실패</div>
          <div style="color:#fee2e2;font-size:20px;font-weight:900;">${fetchFail}</div>
        </div>
        <div style="padding:10px;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.35);border-radius:8px;text-align:center;">
          <div style="color:#bfdbfe;font-size:11px;font-weight:700;">총 처리</div>
          <div style="color:#dbeafe;font-size:20px;font-weight:900;">${s.total}</div>
        </div>
      </div>
      ${fetchFail > 0 ? `<div style="margin-top:10px;padding:10px 14px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:8px;color:#fca5a5;font-size:12px;">⚠️ ${fetchFail}개 글 조회 실패 — 첫 번째 원인: <strong>${escHtml(fetchFailItems[0]?.error || '?')}</strong></div>` : ''}
    </div>
    <div style="padding:20px 28px;overflow-y:auto;flex:1;">
      ${willPatch > 0 ? `
        <h3 style="margin:0 0 10px;color:#86efac;font-size:14px;font-weight:800;">✅ 수정 예정 (최대 30개 미리보기 / 총 ${willPatch}개)</h3>
        <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.2);border-radius:10px;padding:14px;margin-bottom:16px;max-height:300px;overflow-y:auto;">
          ${previewItems.map(r => `
            <div style="padding:8px 0;border-bottom:1px solid rgba(148,163,184,0.1);">
              <div style="color:#fca5a5;font-size:12px;line-height:1.4;text-decoration:line-through;">${escHtml(r.oldTitle)}</div>
              <div style="color:#86efac;font-size:13px;font-weight:700;line-height:1.4;margin-top:3px;">→ ${escHtml(r.newTitle)}</div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div style="padding:14px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);border-radius:10px;color:#fde68a;font-size:13px;text-align:center;">
          ⚠️ 정리할 글이 없습니다. 모든 글이 변화 없음(${noChange}) / 너무 짧음(${tooShort}) / 조회 실패(${fetchFail})로 분류됐습니다.
        </div>
      `}
      ${tooShort > 0 ? `
        <h3 style="margin:14px 0 10px;color:#fde68a;font-size:13px;font-weight:800;">⚠️ Skip (정리 후 너무 짧아짐)</h3>
        <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.2);border-radius:10px;padding:12px;max-height:140px;overflow-y:auto;font-size:11px;">
          ${tooShortItems.map(r => `<div style="padding:3px 0;color:#cbd5e1;">${escHtml(r.oldTitle)} → "${escHtml(r.newTitle)}" (${r.newTitle.length}자)</div>`).join('')}
        </div>
      ` : ''}
    </div>
    <div style="padding:18px 28px;border-top:1px solid rgba(255,255,255,0.08);display:flex;gap:10px;">
      <button id="adsense-clean-cancel" style="flex:1;padding:14px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);border-radius:10px;color:#cbd5e1;font-weight:800;cursor:pointer;">취소 (아무것도 안 함)</button>
      ${willPatch > 0 ? `
        <button id="adsense-clean-confirm" style="flex:2;padding:14px;background:linear-gradient(135deg,#22c55e,#16a34a);border:0;border-radius:10px;color:#fff;font-weight:900;font-size:14px;cursor:pointer;box-shadow:0 6px 20px rgba(34,197,94,0.45);">⚡ ${willPatch}개 실제 적용 (사이트 반영)</button>
      ` : ''}
    </div>
  </div>
</div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('adsense-clean-close')?.addEventListener('click', () => { document.getElementById('adsense-clean-result-modal')?.remove(); });
  document.getElementById('adsense-clean-cancel')?.addEventListener('click', () => { document.getElementById('adsense-clean-result-modal')?.remove(); });

  const confirmBtn = document.getElementById('adsense-clean-confirm');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true; confirmBtn.textContent = '⏳ 실제 적용 중...';
      // ===== 2단계: 실제 patch (dryRun: false) =====
      const realRun = await window.electronAPI.adsenseCleanPostTitles({ blogId, postIds, dryRun: false });
      confirmBtn.disabled = false;
      if (!realRun.ok) { alert('❌ ' + realRun.error); return; }
      const rs = realRun.stats;
      document.getElementById('adsense-clean-result-modal')?.remove();
      const finalMsg = [
        `✅ 사이트 반영 완료`,
        ``,
        `📊 결과:`,
        `  • 실제 수정됨: ${rs.patched}개`,
        `  • 수정 실패: ${rs.patch_failed}개`,
        `  • 변화 없음: ${rs.no_change}개`,
        `  • Skip (짧아짐): ${rs.too_short}개`,
        `  • 조회 실패: ${rs.fetch_failed}개`,
        ``,
        rs.patched > 0 ? `🎉 ${rs.patched}개 글 제목이 사이트에 반영됐습니다. Blogger 어드민에서 확인 가능.` : `⚠️ 실제로 수정된 글이 없습니다.`,
      ].join('\n');
      alert(finalMsg);
    });
  }
}

window.openAdSenseFixerModal = openAdSenseFixerModal;
console.log('[ADSENSE-FIXER] ✅ 모듈 로드 완료');
