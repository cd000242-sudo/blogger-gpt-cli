// adsense-tools.js — 애드센스 도구 탭 렌더러
// sidebar.js → showTab('adsense-tools') → 이 모듈이 렌더링

export function initAdsenseToolsTab() {
  const container = document.getElementById('adsense-tools-tab');
  if (!container) {
    console.error('[ADSENSE-TOOLS] ❌ #adsense-tools-tab 컨테이너 없음');
    return;
  }

  container.innerHTML = buildAdsenseToolsHTML();
  bindAdsenseToolsEvents(container);
  console.log('[ADSENSE-TOOLS] ✅ 애드센스 도구 탭 초기화 완료');
}

function buildAdsenseToolsHTML() {
  return `
<div style="padding: 40px; max-width: 1200px; margin: 0 auto;">
  <!-- 헤더 -->
  <div style="text-align: center; margin-bottom: 48px;">
    <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 48px; font-weight: 900; margin-bottom: 16px;">
      🏆 애드센스 도구
    </div>
    <p style="color: #64748b; font-size: 18px; font-weight: 500;">블로그 진단 · 필수 페이지 · 콘텐츠 다양성 · 거절 대응 · 기술 SEO</p>
  </div>

  <!-- 스코어 서머리 카드 -->
  <div id="adsenseScoreCard" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 24px; padding: 32px; margin-bottom: 32px; border: 1px solid rgba(245, 158, 11, 0.3); display: none;">
    <div style="display: flex; align-items: center; justify-content: space-between;">
      <div>
        <div style="font-size: 14px; color: rgba(255,255,255,0.6); margin-bottom: 8px;">승인 준비 점수</div>
        <div id="adsenseTotalScore" style="font-size: 64px; font-weight: 900; background: linear-gradient(135deg, #f59e0b, #fbbf24); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent;">--</div>
      </div>
      <div id="adsenseScoreGauge" style="width: 120px; height: 120px; position: relative;">
        <svg viewBox="0 0 120 120" style="transform: rotate(-90deg);">
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="8"/>
          <circle id="adsenseGaugeCircle" cx="60" cy="60" r="52" fill="none" stroke="#f59e0b" stroke-width="8" stroke-dasharray="327" stroke-dashoffset="327" stroke-linecap="round" style="transition: stroke-dashoffset 1s ease;"/>
        </svg>
        <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; color: white;" id="adsenseGaugeText">--%</div>
      </div>
    </div>
    <div id="adsenseTopFixes" style="margin-top: 20px; display: grid; gap: 8px;"></div>
  </div>

  <!-- 도구 그리드 -->
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 24px;">
    
    <!-- 1. 블로그 진단 -->
    <div style="background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(248,250,252,0.95)); border-radius: 20px; padding: 32px; box-shadow: 0 10px 40px rgba(0,0,0,0.08); border: 1px solid rgba(0,0,0,0.06);">
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
        <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 24px;">🔍</div>
        <div>
          <h3 style="font-size: 20px; font-weight: 700; color: #1e293b; margin: 0;">블로그 진단</h3>
          <p style="font-size: 13px; color: #64748b; margin: 4px 0 0;">25개 항목 자동 체크</p>
        </div>
      </div>
      <div style="margin-bottom: 20px;">
        <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 8px;">블로그 URL</label>
        <input type="text" id="adsenseBlogUrl" placeholder="https://yourblog.blogspot.com"
          style="width: 100%; padding: 14px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 14px; background: #f9fafb; color: #1e293b; box-sizing: border-box; transition: border-color 0.2s;"
          onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e5e7eb'">
      </div>
      <button id="btnRunDiagnosis" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 15px rgba(59,130,246,0.3);"
        onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
        🔍 진단 시작
      </button>
      <div id="diagnosisResult" style="margin-top: 16px; display: none;"></div>
    </div>

    <!-- 2. 필수 페이지 생성 -->
    <div style="background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(248,250,252,0.95)); border-radius: 20px; padding: 32px; box-shadow: 0 10px 40px rgba(0,0,0,0.08); border: 1px solid rgba(0,0,0,0.06);">
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
        <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 24px;">📄</div>
        <div>
          <h3 style="font-size: 20px; font-weight: 700; color: #1e293b; margin: 0;">필수 페이지</h3>
          <p style="font-size: 13px; color: #64748b; margin: 4px 0 0;">Privacy / Disclaimer / About / Contact</p>
        </div>
      </div>
      <div style="margin-bottom: 12px;">
        <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">블로그 이름</label>
        <input type="text" id="adsenseBlogName" placeholder="My Tech Blog"
          style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: #f9fafb; color: #1e293b; box-sizing: border-box;">
      </div>
      <div style="margin-bottom: 12px;">
        <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">이메일</label>
        <input type="text" id="adsenseContactEmail" placeholder="contact@example.com"
          style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: #f9fafb; color: #1e293b; box-sizing: border-box;">
      </div>
      <button id="btnGeneratePages" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 15px rgba(16,185,129,0.3);"
        onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
        📄 4개 페이지 자동 생성
      </button>
      <div id="pagesResult" style="margin-top: 16px; display: none;"></div>
    </div>

    <!-- 3. 콘텐츠 다양성 분석 -->
    <div style="background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(248,250,252,0.95)); border-radius: 20px; padding: 32px; box-shadow: 0 10px 40px rgba(0,0,0,0.08); border: 1px solid rgba(0,0,0,0.06);">
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
        <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #8b5cf6, #7c3aed); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 24px;">📊</div>
        <div>
          <h3 style="font-size: 20px; font-weight: 700; color: #1e293b; margin: 0;">콘텐츠 다양성</h3>
          <p style="font-size: 13px; color: #64748b; margin: 4px 0 0;">포트폴리오 균형 분석</p>
        </div>
      </div>
      <button id="btnAnalyzeDiversity" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 15px rgba(139,92,246,0.3);"
        onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
        📊 다양성 분석
      </button>
      <div id="diversityResult" style="margin-top: 16px; display: none;"></div>
    </div>

    <!-- 4. 거절 사유 분석 -->
    <div style="background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(248,250,252,0.95)); border-radius: 20px; padding: 32px; box-shadow: 0 10px 40px rgba(0,0,0,0.08); border: 1px solid rgba(0,0,0,0.06);">
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
        <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #ef4444, #dc2626); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 24px;">🚨</div>
        <div>
          <h3 style="font-size: 20px; font-weight: 700; color: #1e293b; margin: 0;">거절 대응</h3>
          <p style="font-size: 13px; color: #64748b; margin: 4px 0 0;">거절 사유별 복구 플랜</p>
        </div>
      </div>
      <div style="margin-bottom: 16px;">
        <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">거절 사유 선택</label>
        <select id="adsenseRejectionReason"
          style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: #f9fafb; color: #1e293b; box-sizing: border-box;">
          <option value="low_value_content">저가치 콘텐츠</option>
          <option value="copied_content">복제/도용 콘텐츠</option>
          <option value="site_navigation">사이트 탐색 어려움</option>
          <option value="policy_violation">정책 위반</option>
          <option value="missing_pages">필수 페이지 누락</option>
          <option value="insufficient_content">불충분한 콘텐츠</option>
          <option value="traffic_manipulation">트래픽 조작</option>
          <option value="existing_ads">기존 광고 코드</option>
          <option value="not_responsive">반응형 미지원</option>
          <option value="unclear_author">작성자 불명확</option>
          <option value="under_review">검토 중</option>
          <option value="other">기타</option>
        </select>
      </div>
      <button id="btnAnalyzeRejection" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 15px rgba(239,68,68,0.3);"
        onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
        🚨 복구 플랜 생성
      </button>
      <div id="rejectionResult" style="margin-top: 16px; display: none;"></div>
    </div>

    <!-- 5. 기술 SEO 가이드 -->
    <div style="background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(248,250,252,0.95)); border-radius: 20px; padding: 32px; box-shadow: 0 10px 40px rgba(0,0,0,0.08); border: 1px solid rgba(0,0,0,0.06);">
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
        <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 24px;">⚙️</div>
        <div>
          <h3 style="font-size: 20px; font-weight: 700; color: #1e293b; margin: 0;">기술 SEO</h3>
          <p style="font-size: 13px; color: #64748b; margin: 4px 0 0;">Search Console · sitemap · robots.txt</p>
        </div>
      </div>
      <button id="btnShowSEOGuide" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #f59e0b, #d97706); color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 15px rgba(245,158,11,0.3);"
        onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
        ⚙️ SEO 가이드 보기
      </button>
      <div id="seoGuideResult" style="margin-top: 16px; display: none;"></div>
    </div>

    <!-- 6. AI 후처리 리포트 -->
    <div style="background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(248,250,252,0.95)); border-radius: 20px; padding: 32px; box-shadow: 0 10px 40px rgba(0,0,0,0.08); border: 1px solid rgba(0,0,0,0.06);">
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
        <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #06b6d4, #0891b2); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 24px;">🤖</div>
        <div>
          <h3 style="font-size: 20px; font-weight: 700; color: #1e293b; margin: 0;">AI 탐지 방지</h3>
          <p style="font-size: 13px; color: #64748b; margin: 4px 0 0;">Burstiness · 종결어미 · 패턴 분석</p>
        </div>
      </div>
      <div style="margin-bottom: 16px;">
        <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">HTML 콘텐츠 붙여넣기</label>
        <textarea id="adsenseHtmlInput" placeholder="생성된 HTML을 붙여넣으세요..."
          style="width: 100%; height: 120px; padding: 12px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 13px; font-family: monospace; background: #f9fafb; color: #1e293b; box-sizing: border-box; resize: vertical;"></textarea>
      </div>
      <button id="btnAnalyzeAI" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #06b6d4, #0891b2); color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 15px rgba(6,182,212,0.3);"
        onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
        🤖 AI 탐지 분석
      </button>
      <div id="aiAnalysisResult" style="margin-top: 16px; display: none;"></div>
    </div>
  </div>
</div>`;
}

/**
 * 이벤트 바인딩 — IPC를 통해 메인 프로세스와 통신
 */
function bindAdsenseToolsEvents(container) {
  // 1. 블로그 진단
  container.querySelector('#btnRunDiagnosis')?.addEventListener('click', async () => {
    const url = container.querySelector('#adsenseBlogUrl')?.value?.trim();
    if (!url) return alert('블로그 URL을 입력하세요.');

    const btn = container.querySelector('#btnRunDiagnosis');
    const resultDiv = container.querySelector('#diagnosisResult');
    btn.disabled = true;
    btn.textContent = '⏳ 진단 중...';
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<div style="text-align:center; padding:20px; color:#64748b;">분석 중...</div>';

    try {
      const res = await window.electronAPI?.invoke?.('adsense:check-blog', url);
      if (res?.ok && res.result) {
        renderDiagnosisResult(resultDiv, res.result);
        showScoreCard(res.result);
      } else {
        resultDiv.innerHTML = `<div style="color:#ef4444; padding:12px;">❌ ${res?.error || '진단 실패 — IPC 핸들러가 등록되지 않았습니다.'}</div>`;
      }
    } catch (err) {
      resultDiv.innerHTML = `<div style="color:#ef4444; padding:12px;">❌ ${err.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = '🔍 진단 시작';
    }
  });

  // 2. 필수 페이지 생성
  container.querySelector('#btnGeneratePages')?.addEventListener('click', async () => {
    const blogName = container.querySelector('#adsenseBlogName')?.value?.trim();
    const email = container.querySelector('#adsenseContactEmail')?.value?.trim();
    const url = container.querySelector('#adsenseBlogUrl')?.value?.trim() || '';
    if (!blogName || !email) return alert('블로그 이름과 이메일을 입력하세요.');

    const btn = container.querySelector('#btnGeneratePages');
    const resultDiv = container.querySelector('#pagesResult');
    btn.disabled = true;
    btn.textContent = '⏳ 생성 중...';
    resultDiv.style.display = 'block';

    try {
      const res = await window.electronAPI?.invoke?.('adsense:generate-essential-pages', { blogName, blogUrl: url, ownerName: blogName, email });
      if (res?.ok && res.pages) {
        resultDiv.innerHTML = `
          <div style="padding:16px; background:#ecfdf5; border-radius:12px; border:1px solid #a7f3d0;">
            <div style="font-weight:700; color:#065f46; margin-bottom:8px;">✅ ${res.pages.length}개 페이지 생성 완료</div>
            ${res.pages.map(p => `<div style="font-size:13px; color:#047857; padding:4px 0;">📄 ${p.title} (/${p.slug})</div>`).join('')}
            <div style="margin-top:12px; font-size:12px; color:#6b7280;">Blogger 설정 → 페이지에서 HTML로 추가하세요</div>
          </div>`;
      } else {
        resultDiv.innerHTML = `<div style="color:#ef4444;">❌ ${res?.error || 'IPC 핸들러 미등록'}</div>`;
      }
    } catch (err) {
      resultDiv.innerHTML = `<div style="color:#ef4444;">❌ ${err.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = '📄 4개 페이지 자동 생성';
    }
  });

  // 3. 콘텐츠 다양성 분석
  container.querySelector('#btnAnalyzeDiversity')?.addEventListener('click', async () => {
    const btn = container.querySelector('#btnAnalyzeDiversity');
    const resultDiv = container.querySelector('#diversityResult');
    btn.disabled = true;
    btn.textContent = '⏳ 분석 중...';
    resultDiv.style.display = 'block';

    try {
      // 현재 발행된 글 제목 목록 (로컬 저장소에서 가져오기)
      const titles = JSON.parse(localStorage.getItem('publishedPostTitles') || '[]');
      const res = await window.electronAPI?.invoke?.('adsense:get-content-diversity', titles);
      if (res?.ok && res.result) {
        renderDiversityResult(resultDiv, res.result);
      } else {
        resultDiv.innerHTML = `<div style="color:#ef4444;">❌ ${res?.error || 'IPC 핸들러 미등록'}</div>`;
      }
    } catch (err) {
      resultDiv.innerHTML = `<div style="color:#ef4444;">❌ ${err.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = '📊 다양성 분석';
    }
  });

  // 4. 거절 사유 분석
  container.querySelector('#btnAnalyzeRejection')?.addEventListener('click', () => {
    const reason = container.querySelector('#adsenseRejectionReason')?.value;
    const resultDiv = container.querySelector('#rejectionResult');
    if (!reason) return;

    resultDiv.style.display = 'block';
    window.electronAPI?.invoke?.('adsense:analyze-rejection', [reason]).then(res => {
      if (res?.ok && res.plan) renderRejectionResult(resultDiv, res.plan);
      else resultDiv.innerHTML = `<div style="color:#ef4444;">❌ ${res?.error || '분석 실패'}</div>`;
    }).catch(() => {
      resultDiv.innerHTML = '<div style="color:#ef4444;">❌ 분석 실패</div>';
    });
  });

  // 5. 기술 SEO 가이드
  container.querySelector('#btnShowSEOGuide')?.addEventListener('click', () => {
    const resultDiv = container.querySelector('#seoGuideResult');
    resultDiv.style.display = resultDiv.style.display === 'none' ? 'block' : 'none';

    window.electronAPI?.invoke?.('adsense:get-tech-seo').then(res => {
      if (res?.ok && res.guides) renderSEOGuide(resultDiv, res.guides);
      else resultDiv.innerHTML = `<div style="color:#ef4444;">❌ ${res?.error || '가이드 로드 실패'}</div>`;
    }).catch(() => {
      resultDiv.innerHTML = '<div style="color:#ef4444;">❌ 가이드 로드 실패</div>';
    });
  });

  // 6. AI 탐지 분석
  container.querySelector('#btnAnalyzeAI')?.addEventListener('click', async () => {
    const html = container.querySelector('#adsenseHtmlInput')?.value?.trim();
    if (!html) return alert('HTML 콘텐츠를 입력하세요.');

    const btn = container.querySelector('#btnAnalyzeAI');
    const resultDiv = container.querySelector('#aiAnalysisResult');
    btn.disabled = true;
    btn.textContent = '⏳ 분석 중...';
    resultDiv.style.display = 'block';

    try {
      const res = await window.electronAPI?.invoke?.('adsense:check-ai-detection', html);
      if (res?.ok && res.result) renderAIAnalysisResult(resultDiv, res.result);
      else resultDiv.innerHTML = `<div style="color:#ef4444;">❌ ${res?.error || 'IPC 핸들러 미등록'}</div>`;
    } catch (err) {
      resultDiv.innerHTML = `<div style="color:#ef4444;">❌ ${err.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = '🤖 AI 탐지 분석';
    }
  });
}

// ── 렌더 헬퍼 ──

function showScoreCard(result) {
  const card = document.getElementById('adsenseScoreCard');
  const scoreEl = document.getElementById('adsenseTotalScore');
  const gaugeCircle = document.getElementById('adsenseGaugeCircle');
  const gaugeText = document.getElementById('adsenseGaugeText');
  const fixesEl = document.getElementById('adsenseTopFixes');

  if (!card) return;
  card.style.display = 'block';
  scoreEl.textContent = result.totalScore;
  gaugeText.textContent = result.totalScore + '%';

  // Animate gauge (circumference = 2πr = 327)
  const offset = 327 - (327 * result.totalScore / 100);
  gaugeCircle.style.strokeDashoffset = offset;

  // Color
  const color = result.totalScore >= 80 ? '#10b981' : result.totalScore >= 60 ? '#f59e0b' : '#ef4444';
  gaugeCircle.style.stroke = color;

  // Top fixes
  if (result.topFixes && result.topFixes.length > 0) {
    fixesEl.innerHTML = result.topFixes.map(fix =>
      `<div style="padding:10px 14px; background:rgba(239,68,68,0.1); border-radius:10px; border-left:3px solid #ef4444; font-size:13px; color:rgba(255,255,255,0.85);">⚠️ ${fix}</div>`
    ).join('');
  }
}

function renderDiagnosisResult(el, result) {
  const cats = result.categories || [];
  el.innerHTML = `
    <div style="padding:16px; background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0;">
      <div style="font-weight:700; color:#1e293b; margin-bottom:12px;">✅ ${result.passCount} PASS · ⚠️ ${result.warnCount} WARN · ❌ ${result.failCount} FAIL</div>
      ${cats.map(cat => `
        <div style="margin-bottom:12px;">
          <div style="font-weight:600; font-size:14px; color:#374151; margin-bottom:6px;">${cat.categoryLabel} (${cat.score}/${cat.maxScore})</div>
          ${cat.items.map(item => `
            <div style="display:flex; align-items:center; gap:8px; padding:4px 0; font-size:13px;">
              <span>${item.status === 'pass' ? '✅' : item.status === 'warn' ? '⚠️' : '❌'}</span>
              <span style="color:${item.status === 'pass' ? '#059669' : item.status === 'warn' ? '#d97706' : '#dc2626'};">${item.name}</span>
              <span style="color:#9ca3af; font-size:12px;">${item.detail}</span>
            </div>
          `).join('')}
        </div>
      `).join('')}
    </div>`;
}

function renderDiversityResult(el, result) {
  el.innerHTML = `
    <div style="padding:16px; background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0;">
      <div style="font-weight:700; color:#1e293b; margin-bottom:12px;">총 ${result.totalPosts}개 글 · 다양성 점수: ${result.diversityScore}/100</div>
      ${(result.distribution || []).map(d => `
        <div style="display:flex; align-items:center; gap:8px; padding:6px 0; font-size:13px;">
          <span style="min-width:140px;">${d.label}</span>
          <div style="flex:1; background:#e5e7eb; border-radius:4px; height:8px; overflow:hidden;">
            <div style="background:${d.status === 'good' ? '#10b981' : d.status === 'low' ? '#f59e0b' : '#ef4444'}; height:100%; width:${d.percentage}%; transition:width 0.5s;"></div>
          </div>
          <span style="min-width:60px; text-align:right; color:#6b7280;">${d.count}개 (${d.percentage}%)</span>
        </div>
      `).join('')}
      ${(result.recommendations || []).map(r => `<div style="margin-top:8px; padding:8px 12px; background:#fef3c7; border-radius:8px; font-size:12px; color:#92400e;">💡 ${r}</div>`).join('')}
    </div>`;
}

function renderRejectionResult(el, result) {
  el.innerHTML = `
    <div style="padding:16px; background:#fef2f2; border-radius:12px; border:1px solid #fecaca;">
      <div style="font-weight:700; color:#991b1b; margin-bottom:8px;">🚨 ${result.reasonLabel} (${result.severity})</div>
      <p style="font-size:13px; color:#7f1d1d; margin-bottom:12px;">${result.description}</p>
      ${(result.actions || []).map(a => `
        <div style="padding:10px 12px; background:white; border-radius:8px; margin-bottom:8px; border-left:3px solid ${a.priority <= 2 ? '#ef4444' : '#f59e0b'};">
          <div style="font-weight:600; font-size:13px; color:#1e293b;">P${a.priority}: ${a.action}</div>
          <div style="font-size:12px; color:#6b7280; margin-top:2px;">${a.detail} (약 ${a.estimatedDays}일)</div>
        </div>
      `).join('')}
    </div>`;
}

function renderSEOGuide(el, guides) {
  el.innerHTML = `
    <div style="padding:16px; background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0;">
      ${(guides || []).map(g => `
        <details style="margin-bottom:12px;">
          <summary style="cursor:pointer; font-weight:600; font-size:14px; color:#1e293b; padding:8px 0;">
            ${g.priority === 'required' ? '🔴' : g.priority === 'recommended' ? '🟡' : '🟢'} ${g.title}
          </summary>
          <div style="padding:12px 0 0 16px; font-size:13px; color:#374151; line-height:1.8;">
            <p style="color:#6b7280; margin-bottom:8px;">${g.description}</p>
            ${g.steps.map(s => `<div>${s}</div>`).join('')}
            ${g.code ? `<pre style="margin-top:8px; padding:12px; background:#1e293b; color:#e2e8f0; border-radius:8px; font-size:12px; overflow-x:auto;">${g.code.replace(/</g, '&lt;')}</pre>` : ''}
          </div>
        </details>
      `).join('')}
    </div>`;
}

function renderAIAnalysisResult(el, result) {
  const passColor = result.pass ? '#10b981' : '#ef4444';
  el.innerHTML = `
    <div style="padding:16px; background:#f8fafc; border-radius:12px; border:2px solid ${passColor};">
      <div style="font-weight:700; font-size:16px; color:${passColor}; margin-bottom:12px;">${result.pass ? '✅ AI 탐지 방지 통과' : '❌ AI 탐지 위험'}</div>
      ${(result.details || []).map(d => `<div style="font-size:13px; color:#374151; padding:3px 0;">${d}</div>`).join('')}
    </div>`;
}

// 탭 최초 표시 시 초기화
window.__initAdsenseTools = initAdsenseToolsTab;
