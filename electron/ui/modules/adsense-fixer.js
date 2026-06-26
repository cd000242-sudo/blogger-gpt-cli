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
          <div style="padding:10px;background:rgba(59,130,246,0.12);border-radius:8px;text-align:center;" title="거미줄(cornerstone) 전략은 위반 아님 — 정보용">
            <div style="color:#bfdbfe;font-size:11px;">토픽 클러스터 ⓘ</div>
            <div style="color:#dbeafe;font-size:20px;font-weight:900;">${s.duplicateTopicCount}</div>
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
          <div style="padding:12px;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.3);border-radius:10px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <div style="color:#93c5fd;font-size:13px;font-weight:800;">🕸️ 토픽 클러스터 Top 5 <span style="color:#64748b;font-size:10px;font-weight:600;">(정보용)</span></div>
            </div>
            <ul style="margin:0 0 8px 0;padding-left:18px;color:#cbd5e1;font-size:12px;line-height:1.7;">${dupList || '<li>없음</li>'}</ul>
            <div style="padding:8px 10px;background:rgba(15,23,42,0.6);border-left:3px solid #3b82f6;border-radius:4px;color:#94a3b8;font-size:11px;line-height:1.5;">
              💡 <strong style="color:#bfdbfe;">위반 아님:</strong> 거미줄(cornerstone+spokes) 전략으로 의도된 반복은 정상입니다. AdSense의 "중복 콘텐츠"는 본문이 거의 동일한 페이지를 의미하며, 같은 토픽의 다각도 글은 오히려 SEO에 유리합니다.
            </div>
          </div>
        </div>
        <div style="padding:12px;background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.2);border-radius:10px;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div style="color:#fbbf24;font-size:13px;font-weight:800;">⚠️ Clickbait/HCU 위반 제목 (최대 10개)</div>
            ${s.clickbaitCount > 0 ? `<button id="adsense-clean-titles-btn" style="padding:6px 12px;background:linear-gradient(135deg,#ef4444,#dc2626);color:white;border:0;border-radius:8px;font-weight:800;font-size:11px;cursor:pointer;">🧹 제목 일괄 정리</button>` : ''}
          </div>
          <ul style="margin:0;padding-left:18px;color:#cbd5e1;font-size:12px;line-height:1.7;">${violationList || '<li>없음 ✅</li>'}</ul>
        </div>
        <!-- v3.8.244: "가치가 별로 없는 콘텐츠" 사유 대응 — 본문 가치 분석 -->
        <div style="padding:14px;background:linear-gradient(135deg,rgba(239,68,68,0.08),rgba(245,158,11,0.08));border:2px solid rgba(239,68,68,0.35);border-radius:12px;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div>
              <div style="color:#fca5a5;font-size:14px;font-weight:900;">💎 "가치가 별로 없는 콘텐츠" 사유 진단</div>
              <div style="color:#94a3b8;font-size:11px;margin-top:3px;">본문 가치 다축 분석 (깊이/1인칭/구체데이터/E-E-A-T/양산패턴)</div>
            </div>
            <button id="adsense-analyze-value-btn" style="padding:8px 14px;background:linear-gradient(135deg,#ef4444,#dc2626);color:white;border:0;border-radius:8px;font-weight:900;font-size:12px;cursor:pointer;white-space:nowrap;">🔬 본문 가치 분석</button>
          </div>
          <div id="adsense-value-result"></div>
        </div>

        <!-- v3.8.246: 사이트 일괄 정리 (AdSense 승인 전 테스트 데이터 청소) -->
        <div style="padding:14px;background:linear-gradient(135deg,rgba(239,68,68,0.1),rgba(220,38,38,0.05));border:2px solid rgba(239,68,68,0.45);border-radius:12px;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div>
              <div style="color:#fca5a5;font-size:14px;font-weight:900;">🧹 사이트 일괄 정리 (AdSense 승인 전 권장)</div>
              <div style="color:#94a3b8;font-size:11px;margin-top:3px;">AdSense 모드 아닌 글(저점수 글) 전체 스캔 → 삭제 또는 보강</div>
            </div>
            <button id="adsense-bulk-scan-btn" style="padding:8px 14px;background:linear-gradient(135deg,#ef4444,#b91c1c);color:white;border:0;border-radius:8px;font-weight:900;font-size:12px;cursor:pointer;white-space:nowrap;">🔍 전체 글 스캔</button>
          </div>
          <div id="adsense-bulk-result"></div>
        </div>

        <!-- v3.8.246: 연도 의존 글 자동 갱신 -->
        <div style="padding:14px;background:linear-gradient(135deg,rgba(59,130,246,0.1),rgba(37,99,235,0.05));border:2px solid rgba(59,130,246,0.4);border-radius:12px;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div>
              <div style="color:#93c5fd;font-size:14px;font-weight:900;">🔄 연도 의존 글 자동 갱신</div>
              <div style="color:#94a3b8;font-size:11px;margin-top:3px;">설날·연말정산·종합소득세·청년도약계좌 등 매년 갱신 필요 글 LLM으로 ${new Date().getFullYear()}년 정보 업데이트</div>
            </div>
            <button id="adsense-yearly-scan-btn" style="padding:8px 14px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:white;border:0;border-radius:8px;font-weight:900;font-size:12px;cursor:pointer;white-space:nowrap;">🔄 연도 갱신 필요 글 검색</button>
          </div>
          <div id="adsense-yearly-result"></div>
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

      // v3.8.244: 본문 가치 분석 — "가치가 별로 없는 콘텐츠" 사유 대응
      const analyzeBtn = document.getElementById('adsense-analyze-value-btn');
      if (analyzeBtn) {
        analyzeBtn.addEventListener('click', async () => {
          const blogId = document.getElementById('blogId')?.value?.trim();
          if (!blogId) { alert('Blog ID 환경설정에 저장 필요'); return; }
          const valueEl = document.getElementById('adsense-value-result');
          analyzeBtn.disabled = true; analyzeBtn.textContent = '⏳ 본문 20개 분석 중...';
          valueEl.innerHTML = `<div style="padding:10px;background:rgba(15,23,42,0.6);border-radius:8px;color:#cbd5e1;font-size:12px;">⏳ Blogger API로 본문을 가져와서 다축 점수를 계산하는 중... (30~60초)</div>`;
          try {
            const ar = await window.electronAPI.adsenseAnalyzeContentValue({ blogId, sampleSize: 20 });
            if (!ar.ok) { valueEl.innerHTML = `<div style="padding:10px;background:rgba(239,68,68,0.12);border-radius:8px;color:#fca5a5;font-size:12px;">❌ ${ar.error}</div>`; return; }
            renderValueResult(valueEl, ar);
          } catch (e) {
            valueEl.innerHTML = `<div style="padding:10px;background:rgba(239,68,68,0.12);border-radius:8px;color:#fca5a5;font-size:12px;">❌ ${e?.message || e}</div>`;
          } finally {
            analyzeBtn.disabled = false; analyzeBtn.textContent = '🔬 본문 가치 재분석';
          }
        });
      }

      // v3.8.246: 사이트 일괄 정리 스캔
      const bulkScanBtn = document.getElementById('adsense-bulk-scan-btn');
      if (bulkScanBtn) {
        bulkScanBtn.addEventListener('click', async () => {
          const blogId = document.getElementById('blogId')?.value?.trim();
          if (!blogId) { alert('Blog ID 환경설정에 저장 필요'); return; }
          const bulkEl = document.getElementById('adsense-bulk-result');
          bulkScanBtn.disabled = true; bulkScanBtn.textContent = '⏳ 전체 글 스캔 중...';
          bulkEl.innerHTML = `<div style="padding:10px;background:rgba(15,23,42,0.6);border-radius:8px;color:#cbd5e1;font-size:12px;">⏳ 전체 글을 페치하고 채점 중... (사이트 글 수에 따라 30~120초)</div>`;
          try {
            const r = await window.electronAPI.adsenseBulkCleanupPosts({ blogId, action: 'list-only', threshold: 40, dryRun: true });
            if (!r.ok) { bulkEl.innerHTML = `<div style="padding:10px;background:rgba(239,68,68,0.12);border-radius:8px;color:#fca5a5;font-size:12px;">❌ ${r.error}</div>`; return; }
            renderBulkResult(bulkEl, r, blogId);
          } catch (e) {
            bulkEl.innerHTML = `<div style="padding:10px;background:rgba(239,68,68,0.12);border-radius:8px;color:#fca5a5;font-size:12px;">❌ ${e?.message || e}</div>`;
          } finally {
            bulkScanBtn.disabled = false; bulkScanBtn.textContent = '🔍 전체 글 스캔';
          }
        });
      }

      // v3.8.246: 연도 의존 글 자동 갱신
      const yearlyBtn = document.getElementById('adsense-yearly-scan-btn');
      if (yearlyBtn) {
        yearlyBtn.addEventListener('click', async () => {
          const blogId = document.getElementById('blogId')?.value?.trim();
          if (!blogId) { alert('Blog ID 환경설정에 저장 필요'); return; }
          const yearlyEl = document.getElementById('adsense-yearly-result');
          yearlyBtn.disabled = true; yearlyBtn.textContent = '⏳ 연도 글 검색 중...';
          yearlyEl.innerHTML = `<div style="padding:10px;background:rgba(15,23,42,0.6);border-radius:8px;color:#cbd5e1;font-size:12px;">⏳ 연도 의존 토픽(설날/세금/장려금 등) 검색 중...</div>`;
          try {
            const r = await window.electronAPI.adsenseListYearlyPosts({ blogId, currentYear: new Date().getFullYear() });
            if (!r.ok) { yearlyEl.innerHTML = `<div style="padding:10px;background:rgba(239,68,68,0.12);border-radius:8px;color:#fca5a5;font-size:12px;">❌ ${r.error}</div>`; return; }
            renderYearlyResult(yearlyEl, r, blogId);
          } catch (e) {
            yearlyEl.innerHTML = `<div style="padding:10px;background:rgba(239,68,68,0.12);border-radius:8px;color:#fca5a5;font-size:12px;">❌ ${e?.message || e}</div>`;
          } finally {
            yearlyBtn.disabled = false; yearlyBtn.textContent = '🔄 연도 갱신 필요 글 검색';
          }
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

// v3.8.244: 본문 가치 분석 결과 렌더 — AdSense "가치 없는 콘텐츠" 사유 진단
function renderValueResult(el, ar) {
  const verdictColor = ar.avgScore >= 65 ? '#22c55e' : ar.avgScore >= 50 ? '#f59e0b' : '#ef4444';
  const verdictBg = ar.avgScore >= 65 ? 'rgba(34,197,94,0.12)' : ar.avgScore >= 50 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)';
  const highRiskPosts = ar.scores.filter((s) => s.risk === 'high').slice(0, 10);
  const html = `
    <div style="padding:12px;background:${verdictBg};border:1px solid ${verdictColor};border-radius:10px;margin-bottom:12px;">
      <div style="color:${verdictColor};font-size:14px;font-weight:900;margin-bottom:4px;">${ar.verdict}</div>
      <div style="color:#cbd5e1;font-size:12px;line-height:1.5;">📌 권장: ${ar.action}</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;">
      <div style="padding:10px;background:rgba(15,23,42,0.6);border-radius:8px;text-align:center;">
        <div style="color:#94a3b8;font-size:11px;">분석 글</div>
        <div style="color:#f1f5f9;font-size:20px;font-weight:900;">${ar.sampleSize}</div>
      </div>
      <div style="padding:10px;background:rgba(15,23,42,0.6);border-radius:8px;text-align:center;">
        <div style="color:#94a3b8;font-size:11px;">평균 점수</div>
        <div style="color:${verdictColor};font-size:20px;font-weight:900;">${ar.avgScore}/100</div>
      </div>
      <div style="padding:10px;background:rgba(239,68,68,0.12);border-radius:8px;text-align:center;">
        <div style="color:#fca5a5;font-size:11px;">위험 글</div>
        <div style="color:#fee2e2;font-size:20px;font-weight:900;">${ar.highRisk}</div>
      </div>
      <div style="padding:10px;background:rgba(34,197,94,0.12);border-radius:8px;text-align:center;">
        <div style="color:#86efac;font-size:11px;">양호 글</div>
        <div style="color:#dcfce7;font-size:20px;font-weight:900;">${ar.lowRisk}</div>
      </div>
    </div>
    ${highRiskPosts.length > 0 ? `
      <div style="padding:12px;background:rgba(15,23,42,0.6);border:1px solid rgba(239,68,68,0.3);border-radius:10px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="color:#fca5a5;font-size:13px;font-weight:800;">🚨 우선 보강 필요 (점수 낮은 순 ${highRiskPosts.length}개)</div>
          <button id="adsense-boost-all-btn" data-post-ids="${highRiskPosts.map((p) => p.id).join(',')}" style="padding:6px 12px;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;border:0;border-radius:8px;font-weight:800;font-size:11px;cursor:pointer;">⚡ 전체 자동 보강</button>
        </div>
        <div style="max-height:280px;overflow-y:auto;">
          ${highRiskPosts.map((p) => `
            <div style="padding:8px 10px;background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.15);border-radius:6px;margin-bottom:6px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px;">
                <a href="${escHtml(p.url)}" target="_blank" rel="noopener" style="color:#fbbf24;font-size:12px;font-weight:700;text-decoration:none;line-height:1.4;flex:1;">${escHtml(p.title)}</a>
                <span style="color:#fca5a5;font-size:14px;font-weight:900;white-space:nowrap;">${p.totalScore}점</span>
                <button class="adsense-boost-one-btn" data-post-id="${p.id}" data-title="${escHtml(p.title)}" style="padding:3px 8px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;border:0;border-radius:5px;font-weight:700;font-size:10px;cursor:pointer;white-space:nowrap;">🚀 보강</button>
              </div>
              <div style="color:#94a3b8;font-size:10px;line-height:1.5;">${p.wordCount}자 · H2 ${p.h2Count} · 이미지 ${p.imageCount} · 1인칭 ${p.personalScore} · 구체 ${p.specificScore} · 출처 ${p.eeatScore}${p.scaledScore > 0 ? ` · 양산 ${p.scaledScore}` : ''}</div>
              ${p.reasons.length > 0 ? `<div style="color:#fca5a5;font-size:10px;margin-top:4px;">⚠️ ${p.reasons.join(' · ')}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    ` : `<div style="padding:10px;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);border-radius:8px;color:#86efac;font-size:12px;text-align:center;">✅ 위험 글 0개 — 재신청 권장</div>`}
    <div style="padding:10px;background:rgba(59,130,246,0.08);border-left:3px solid #3b82f6;border-radius:4px;color:#bfdbfe;font-size:11px;line-height:1.6;">
      <div style="font-weight:700;color:#dbeafe;margin-bottom:4px;">💡 가치 보강 핵심 5가지</div>
      ${ar.tips.map((t) => `<div>• ${escHtml(t)}</div>`).join('')}
    </div>
  `;
  el.innerHTML = html;

  // v3.8.245: 개별 보강 버튼 핸들러
  el.querySelectorAll('.adsense-boost-one-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const postId = btn.getAttribute('data-post-id');
      const title = btn.getAttribute('data-title') || '';
      const blogId = document.getElementById('blogId')?.value?.trim();
      if (!blogId || !postId) { alert('Blog ID 또는 글 ID 누락'); return; }
      await runBoostFlow(blogId, postId, title);
    });
  });

  // 전체 보강 버튼 핸들러 — 순차 처리 (rate limit 보호)
  const boostAllBtn = document.getElementById('adsense-boost-all-btn');
  if (boostAllBtn) {
    boostAllBtn.addEventListener('click', async () => {
      const blogId = document.getElementById('blogId')?.value?.trim();
      if (!blogId) { alert('Blog ID 누락'); return; }
      const ids = (boostAllBtn.getAttribute('data-post-ids') || '').split(',').filter(Boolean);
      if (ids.length === 0) { alert('보강할 글 없음'); return; }
      if (!confirm(`⚠️ 위험 글 ${ids.length}개를 순차로 LLM으로 보강하고 사이트에 반영합니다.\n\n각 글마다 미리보기 없이 자동 적용되며 약 ${ids.length * 30}초 소요됩니다.\n\n진행할까요?`)) return;
      boostAllBtn.disabled = true;
      let successCnt = 0;
      let failCnt = 0;
      const logs = [];
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        boostAllBtn.textContent = `⏳ ${i + 1}/${ids.length} 보강 중...`;
        try {
          const r = await window.electronAPI.adsenseBoostPostValue({ blogId, postId: id, dryRun: false });
          if (r.ok) {
            successCnt++;
            logs.push(`✅ ${r.title} (${r.before.length}자 → ${r.after.length}자, +${r.delta})`);
          } else {
            failCnt++;
            logs.push(`❌ ${id}: ${r.error}`);
          }
        } catch (e) {
          failCnt++;
          logs.push(`❌ ${id}: ${e?.message || e}`);
        }
        await new Promise((res) => setTimeout(res, 800)); // rate limit 보호
      }
      boostAllBtn.disabled = false;
      boostAllBtn.textContent = '⚡ 전체 자동 보강';
      alert(`✅ 보강 완료: ${successCnt}개 성공 · ${failCnt}개 실패\n\n${logs.slice(0, 15).join('\n')}${logs.length > 15 ? `\n... 외 ${logs.length - 15}개` : ''}`);
    });
  }
}

// v3.8.245: 개별 글 보강 흐름 (Dry-run 미리보기 → 사용자 승인 → 실제 적용)
async function runBoostFlow(blogId, postId, title) {
  // 1단계: Dry-run
  const loading = document.createElement('div');
  loading.id = 'adsense-boost-loading';
  loading.style.cssText = 'position:fixed;inset:0;z-index:100004;background:rgba(2,6,23,0.93);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;';
  loading.innerHTML = `<div style="text-align:center;"><div style="font-size:48px;margin-bottom:14px;">🚀</div><div style="font-weight:800;margin-bottom:8px;">LLM으로 본문 가치 보강 중...</div><div style="color:#94a3b8;font-size:13px;">${escHtml(title)}</div><div style="color:#64748b;font-size:11px;margin-top:8px;">약 20~40초 소요</div></div>`;
  document.body.appendChild(loading);
  try {
    const r = await window.electronAPI.adsenseBoostPostValue({ blogId, postId, dryRun: true });
    loading.remove();
    if (!r.ok) { alert('❌ 보강 실패: ' + r.error); return; }
    showBoostResultModal(r, blogId, postId);
  } catch (e) {
    loading.remove();
    alert('❌ ' + (e?.message || e));
  }
}

// 보강 결과 미리보기 모달
function showBoostResultModal(r, blogId, postId) {
  const existing = document.getElementById('adsense-boost-result-modal');
  if (existing) existing.remove();
  const delta = r.delta;
  const html = `
<div id="adsense-boost-result-modal" style="position:fixed;inset:0;z-index:100003;background:rgba(2,6,23,0.93);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;">
  <div style="width:min(1100px,100%);max-height:calc(100vh - 40px);background:linear-gradient(135deg,#0f172a,#1e293b);border:1px solid rgba(59,130,246,0.4);border-radius:18px;display:flex;flex-direction:column;">
    <div style="padding:22px 26px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;">
      <div>
        <h2 style="margin:0;color:#fff;font-size:18px;font-weight:900;">🚀 본문 가치 보강 미리보기</h2>
        <p style="margin:4px 0 0 0;color:#94a3b8;font-size:12px;">${escHtml(r.title)} · ${r.before.length}자 → ${r.after.length}자 (${delta >= 0 ? '+' : ''}${delta}) · ${r.provider} 사용</p>
      </div>
      <button id="adsense-boost-close" style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);color:#fff;font-size:18px;cursor:pointer;">×</button>
    </div>
    <div style="padding:18px 26px;flex:1;overflow-y:auto;display:grid;grid-template-columns:1fr 1fr;gap:14px;">
      <div>
        <div style="color:#94a3b8;font-size:12px;font-weight:800;margin-bottom:8px;">📜 변경 전 (요약)</div>
        <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.2);border-radius:8px;padding:12px;font-size:11px;color:#cbd5e1;max-height:480px;overflow-y:auto;line-height:1.5;">${escHtml(r.before.htmlPreview)}...</div>
      </div>
      <div>
        <div style="color:#86efac;font-size:12px;font-weight:800;margin-bottom:8px;">✨ 변경 후 (요약)</div>
        <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.25);border-radius:8px;padding:12px;font-size:11px;color:#cbd5e1;max-height:480px;overflow-y:auto;line-height:1.5;">${escHtml(r.after.htmlPreview)}...</div>
      </div>
    </div>
    <div style="padding:16px 26px;border-top:1px solid rgba(255,255,255,0.08);display:flex;gap:10px;">
      <button id="adsense-boost-cancel" style="flex:1;padding:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);border-radius:8px;color:#cbd5e1;font-weight:800;cursor:pointer;">취소 (변경 안 함)</button>
      <button id="adsense-boost-confirm" style="flex:2;padding:12px;background:linear-gradient(135deg,#22c55e,#16a34a);border:0;border-radius:8px;color:#fff;font-weight:900;font-size:13px;cursor:pointer;">✅ 보강된 본문 실제 적용 (사이트 반영)</button>
    </div>
  </div>
</div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('adsense-boost-close')?.addEventListener('click', () => document.getElementById('adsense-boost-result-modal')?.remove());
  document.getElementById('adsense-boost-cancel')?.addEventListener('click', () => document.getElementById('adsense-boost-result-modal')?.remove());
  document.getElementById('adsense-boost-confirm')?.addEventListener('click', async () => {
    const btn = document.getElementById('adsense-boost-confirm');
    btn.disabled = true; btn.textContent = '⏳ 사이트 반영 중...';
    const real = await window.electronAPI.adsenseBoostPostValue({ blogId, postId, dryRun: false });
    document.getElementById('adsense-boost-result-modal')?.remove();
    if (real.ok) alert(`✅ 사이트 반영 완료\n${real.title}\n${real.before.length}자 → ${real.after.length}자 (+${real.delta})`);
    else alert('❌ 실제 적용 실패: ' + real.error);
  });
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

// v3.8.246: 사이트 일괄 정리 결과 렌더
function renderBulkResult(el, r, blogId) {
  const targets = r.targets || [];
  if (targets.length === 0) {
    el.innerHTML = `<div style="padding:10px;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);border-radius:8px;color:#86efac;font-size:12px;text-align:center;">✅ 전체 ${r.totalPosts}개 글 모두 양호 — 정리 불필요</div>`;
    return;
  }
  const previewIds = targets.slice(0, 20).map((t) => t.id);
  el.innerHTML = `
    <div style="padding:10px;background:rgba(15,23,42,0.6);border-radius:8px;margin-bottom:10px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
      <div style="text-align:center;"><div style="color:#94a3b8;font-size:11px;">전체 글</div><div style="color:#f1f5f9;font-size:18px;font-weight:900;">${r.totalPosts}</div></div>
      <div style="text-align:center;"><div style="color:#fca5a5;font-size:11px;">위험 글 (점수 < ${r.threshold})</div><div style="color:#fee2e2;font-size:18px;font-weight:900;">${targets.length}</div></div>
      <div style="text-align:center;"><div style="color:#86efac;font-size:11px;">양호 글</div><div style="color:#dcfce7;font-size:18px;font-weight:900;">${r.totalPosts - targets.length}</div></div>
    </div>
    <div style="padding:10px;background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.2);border-radius:8px;margin-bottom:10px;max-height:240px;overflow-y:auto;">
      ${targets.slice(0, 20).map((t) => `
        <div style="padding:5px 0;border-bottom:1px solid rgba(148,163,184,0.1);font-size:11px;display:flex;justify-content:space-between;gap:8px;align-items:center;">
          <a href="${escHtml(t.url)}" target="_blank" rel="noopener" style="color:#fbbf24;text-decoration:none;flex:1;">${escHtml(t.title)}</a>
          <span style="color:#fca5a5;font-weight:900;white-space:nowrap;">${t.score}점</span>
          <span style="color:#94a3b8;white-space:nowrap;">${t.wordCount}자</span>
        </div>
      `).join('')}
      ${targets.length > 20 ? `<div style="color:#64748b;font-size:11px;text-align:center;padding:6px;">... 외 ${targets.length - 20}개 더</div>` : ''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <button id="adsense-bulk-delete-btn" style="padding:12px;background:linear-gradient(135deg,#ef4444,#b91c1c);color:white;border:0;border-radius:8px;font-weight:900;font-size:12px;cursor:pointer;">🗑️ ${targets.length}개 일괄 삭제</button>
      <button id="adsense-bulk-boost-btn" style="padding:12px;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;border:0;border-radius:8px;font-weight:900;font-size:12px;cursor:pointer;">⚡ ${targets.length}개 일괄 보강</button>
    </div>
    <div style="padding:8px 10px;background:rgba(239,68,68,0.06);border-left:3px solid #ef4444;border-radius:4px;color:#fca5a5;font-size:11px;line-height:1.5;margin-top:8px;">
      💡 <strong>삭제 권장</strong>: AdSense 승인 전 테스트 데이터 청소 / <strong>보강 권장</strong>: 이미 콘텐츠가 있고 살리고 싶을 때
    </div>
  `;
  document.getElementById('adsense-bulk-delete-btn')?.addEventListener('click', async () => {
    if (!confirm(`⚠️ 정말 ${targets.length}개 글을 삭제할까요?\n\n사이트에서 영구 삭제됩니다 (복구 불가).\n점수 ${r.threshold}점 미만 글이 대상입니다.\n\n진행할까요?`)) return;
    const btn = document.getElementById('adsense-bulk-delete-btn');
    btn.disabled = true; btn.textContent = '⏳ 삭제 중...';
    const real = await window.electronAPI.adsenseBulkCleanupPosts({ blogId, action: 'delete', threshold: r.threshold, dryRun: false });
    btn.disabled = false; btn.textContent = `🗑️ ${targets.length}개 일괄 삭제`;
    if (real.ok) alert(`✅ 삭제 완료: ${real.deleted}개 성공 · ${real.failed}개 실패`);
    else alert('❌ 삭제 실패: ' + real.error);
  });
  document.getElementById('adsense-bulk-boost-btn')?.addEventListener('click', async () => {
    if (!confirm(`⚡ ${targets.length}개 글을 LLM으로 일괄 보강합니다.\n\n예상 소요: 약 ${targets.length * 30}초\n글마다 1인칭/출처/구체데이터 자동 주입.\n\n진행할까요?`)) return;
    const btn = document.getElementById('adsense-bulk-boost-btn');
    btn.disabled = true;
    let successCnt = 0, failCnt = 0;
    for (let i = 0; i < targets.length; i++) {
      btn.textContent = `⏳ ${i + 1}/${targets.length} 보강 중...`;
      try {
        const r2 = await window.electronAPI.adsenseBoostPostValue({ blogId, postId: targets[i].id, dryRun: false });
        if (r2.ok) successCnt++; else failCnt++;
      } catch { failCnt++; }
      await new Promise((res) => setTimeout(res, 800));
    }
    btn.disabled = false; btn.textContent = `⚡ ${targets.length}개 일괄 보강`;
    alert(`✅ 보강 완료: ${successCnt}개 성공 · ${failCnt}개 실패`);
  });
}

// v3.8.246: 연도 갱신 결과 렌더
function renderYearlyResult(el, r, blogId) {
  const candidates = r.candidates || [];
  if (candidates.length === 0) {
    el.innerHTML = `<div style="padding:10px;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);border-radius:8px;color:#86efac;font-size:12px;text-align:center;">✅ 연도 갱신 필요 글 없음 — 모두 ${r.currentYear}년 기준</div>`;
    return;
  }
  el.innerHTML = `
    <div style="padding:10px;background:rgba(15,23,42,0.6);border-radius:8px;margin-bottom:10px;">
      <div style="color:#93c5fd;font-size:12px;font-weight:800;">🔄 ${r.currentYear}년 기준 갱신 필요 ${candidates.length}개</div>
    </div>
    <div style="padding:10px;background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.2);border-radius:8px;margin-bottom:10px;max-height:260px;overflow-y:auto;">
      ${candidates.slice(0, 20).map((c) => `
        <div style="padding:6px 0;border-bottom:1px solid rgba(148,163,184,0.1);">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <a href="${escHtml(c.url)}" target="_blank" rel="noopener" style="color:#fbbf24;font-size:12px;font-weight:700;text-decoration:none;line-height:1.4;flex:1;">${escHtml(c.title)}</a>
            <button class="adsense-yearly-refresh-one-btn" data-post-id="${c.id}" data-title="${escHtml(c.title)}" style="padding:3px 8px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:white;border:0;border-radius:5px;font-weight:700;font-size:10px;cursor:pointer;white-space:nowrap;">🔄 갱신</button>
          </div>
          <div style="color:#94a3b8;font-size:10px;margin-top:3px;">언급 연도: ${c.mentionedYears.join(', ') || '없음'} · 토픽: ${c.topics.slice(0, 4).join(', ')}</div>
        </div>
      `).join('')}
      ${candidates.length > 20 ? `<div style="color:#64748b;font-size:11px;text-align:center;padding:6px;">... 외 ${candidates.length - 20}개 더</div>` : ''}
    </div>
    <button id="adsense-yearly-refresh-all-btn" style="width:100%;padding:12px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:white;border:0;border-radius:8px;font-weight:900;font-size:12px;cursor:pointer;">🔄 전체 ${candidates.length}개 ${r.currentYear}년으로 일괄 갱신</button>
  `;
  el.querySelectorAll('.adsense-yearly-refresh-one-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const postId = btn.getAttribute('data-post-id');
      const title = btn.getAttribute('data-title') || '';
      await runYearlyRefreshFlow(blogId, postId, title, r.currentYear);
    });
  });
  document.getElementById('adsense-yearly-refresh-all-btn')?.addEventListener('click', async () => {
    if (!confirm(`🔄 ${candidates.length}개 글을 ${r.currentYear}년 기준으로 일괄 갱신합니다.\n\n예상 소요: 약 ${candidates.length * 35}초\n제목 + 본문 모두 LLM이 갱신.\n\n진행할까요?`)) return;
    const btn = document.getElementById('adsense-yearly-refresh-all-btn');
    btn.disabled = true;
    let successCnt = 0, failCnt = 0;
    for (let i = 0; i < candidates.length; i++) {
      btn.textContent = `⏳ ${i + 1}/${candidates.length} 갱신 중...`;
      try {
        const r2 = await window.electronAPI.adsenseRefreshYearlyPost({ blogId, postId: candidates[i].id, currentYear: r.currentYear, dryRun: false });
        if (r2.ok) successCnt++; else failCnt++;
      } catch { failCnt++; }
      await new Promise((res) => setTimeout(res, 1000));
    }
    btn.disabled = false; btn.textContent = `🔄 전체 ${candidates.length}개 ${r.currentYear}년으로 일괄 갱신`;
    alert(`✅ 갱신 완료: ${successCnt}개 성공 · ${failCnt}개 실패`);
  });
}

// v3.8.246: 단일 연도 갱신 흐름
async function runYearlyRefreshFlow(blogId, postId, title, currentYear) {
  const loading = document.createElement('div');
  loading.style.cssText = 'position:fixed;inset:0;z-index:100004;background:rgba(2,6,23,0.93);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;';
  loading.innerHTML = `<div style="text-align:center;"><div style="font-size:48px;margin-bottom:14px;">🔄</div><div style="font-weight:800;margin-bottom:8px;">${currentYear}년 기준 갱신 중...</div><div style="color:#94a3b8;font-size:13px;">${escHtml(title)}</div></div>`;
  document.body.appendChild(loading);
  try {
    const r = await window.electronAPI.adsenseRefreshYearlyPost({ blogId, postId, currentYear, dryRun: true });
    loading.remove();
    if (!r.ok) { alert('❌ 갱신 실패: ' + r.error); return; }
    showYearlyResultModal(r, blogId, postId, currentYear);
  } catch (e) { loading.remove(); alert('❌ ' + (e?.message || e)); }
}

function showYearlyResultModal(r, blogId, postId, currentYear) {
  const existing = document.getElementById('adsense-yearly-result-modal');
  if (existing) existing.remove();
  const titleChanged = r.before.title !== r.after.title;
  const html = `
<div id="adsense-yearly-result-modal" style="position:fixed;inset:0;z-index:100003;background:rgba(2,6,23,0.93);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;">
  <div style="width:min(1100px,100%);max-height:calc(100vh - 40px);background:linear-gradient(135deg,#0f172a,#1e293b);border:1px solid rgba(59,130,246,0.4);border-radius:18px;display:flex;flex-direction:column;">
    <div style="padding:22px 26px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;">
      <div>
        <h2 style="margin:0;color:#fff;font-size:18px;font-weight:900;">🔄 ${currentYear}년 갱신 미리보기</h2>
        <p style="margin:4px 0 0 0;color:#94a3b8;font-size:12px;">${r.provider} 사용 · ${titleChanged ? '제목 변경 있음' : '제목 동일'}</p>
      </div>
      <button id="adsense-yearly-close" style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);color:#fff;font-size:18px;cursor:pointer;">×</button>
    </div>
    <div style="padding:18px 26px;flex:1;overflow-y:auto;">
      ${titleChanged ? `
        <div style="margin-bottom:14px;padding:10px 14px;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.25);border-radius:8px;">
          <div style="color:#94a3b8;font-size:11px;margin-bottom:4px;">📝 제목 변경</div>
          <div style="color:#fca5a5;font-size:12px;text-decoration:line-through;line-height:1.5;">${escHtml(r.before.title)}</div>
          <div style="color:#86efac;font-size:13px;font-weight:700;line-height:1.5;margin-top:4px;">→ ${escHtml(r.after.fullTitle)}</div>
        </div>
      ` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
        <div>
          <div style="color:#94a3b8;font-size:12px;font-weight:800;margin-bottom:8px;">📜 변경 전 (요약)</div>
          <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.2);border-radius:8px;padding:12px;font-size:11px;color:#cbd5e1;max-height:380px;overflow-y:auto;line-height:1.5;">${escHtml(r.before.htmlPreview)}...</div>
        </div>
        <div>
          <div style="color:#86efac;font-size:12px;font-weight:800;margin-bottom:8px;">✨ ${currentYear}년 갱신 후 (요약)</div>
          <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.25);border-radius:8px;padding:12px;font-size:11px;color:#cbd5e1;max-height:380px;overflow-y:auto;line-height:1.5;">${escHtml(r.after.htmlPreview)}...</div>
        </div>
      </div>
    </div>
    <div style="padding:16px 26px;border-top:1px solid rgba(255,255,255,0.08);display:flex;gap:10px;">
      <button id="adsense-yearly-cancel" style="flex:1;padding:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);border-radius:8px;color:#cbd5e1;font-weight:800;cursor:pointer;">취소</button>
      <button id="adsense-yearly-confirm" style="flex:2;padding:12px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);border:0;border-radius:8px;color:#fff;font-weight:900;font-size:13px;cursor:pointer;">✅ ${currentYear}년 갱신 실제 적용</button>
    </div>
  </div>
</div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('adsense-yearly-close')?.addEventListener('click', () => document.getElementById('adsense-yearly-result-modal')?.remove());
  document.getElementById('adsense-yearly-cancel')?.addEventListener('click', () => document.getElementById('adsense-yearly-result-modal')?.remove());
  document.getElementById('adsense-yearly-confirm')?.addEventListener('click', async () => {
    const btn = document.getElementById('adsense-yearly-confirm');
    btn.disabled = true; btn.textContent = '⏳ 사이트 반영 중...';
    const real = await window.electronAPI.adsenseRefreshYearlyPost({ blogId, postId, currentYear, dryRun: false });
    document.getElementById('adsense-yearly-result-modal')?.remove();
    if (real.ok) alert(`✅ ${currentYear}년 갱신 완료\n${real.titleChanged ? '제목 + 본문 갱신' : '본문 갱신'}`);
    else alert('❌ 갱신 실패: ' + real.error);
  });
}

window.openAdSenseFixerModal = openAdSenseFixerModal;
console.log('[ADSENSE-FIXER] ✅ 모듈 로드 완료');
