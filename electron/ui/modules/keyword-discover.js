/**
 * 🔍 황금키워드 탐색기 UI 모듈 v2
 * 
 * 사이드바 "황금키워드" 탭의 전체 UI와 IPC 연동을 담당합니다.
 * v2: 골든 스코어 표시, 검증 상세 패널, 경쟁자 분석 카드
 */

let currentKeywords = [];
let isScanning = false;
let isVerifying = false;
let currentFilter = 'all';
let expandedKeyword = null; // 현재 열린 상세 패널의 키워드

const DIFFICULTY_BADGES = {
  anyone: { label: '🟢 누구나', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  beginner: { label: '🔵 초보OK', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  normal: { label: '🟡 보통', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  hard: { label: '🔴 고수급', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

const URGENCY_BADGES = {
  now: { label: '🔥 지금!', color: '#ef4444' },
  today: { label: '⚡ 오늘', color: '#f59e0b' },
  thisWeek: { label: '📅 이번주', color: '#60a5fa' },
  anytime: { label: '♻️ 상시', color: '#94a3b8' },
};

const SOURCE_INFO = {
  'naver': { label: '네이버', icon: '🟢', color: '#10b981' },
  'naver-kin': { label: '지식인', icon: '❓', color: '#60a5fa' },
  'naver-news': { label: '뉴스', icon: '📰', color: '#14b8a6' },
  'naver-shopping': { label: '쇼핑', icon: '🛒', color: '#f59e0b' },
  'google': { label: '구글', icon: '🌐', color: '#a78bfa' },
};

const CATEGORY_INFO = {
  adpost: { label: '애드포스트', icon: '💰', color: '#10b981' },
  adsense: { label: '애드센스', icon: '💎', color: '#60a5fa' },
  shopping: { label: '쇼핑', icon: '🛒', color: '#f59e0b' },
  'google-seo': { label: 'SEO', icon: '🌐', color: '#a78bfa' },
  'ali-express': { label: '직구', icon: '📦', color: '#fb923c' },
};

const CATEGORY_FILTERS = [
  { value: 'all', label: '🔍 전체', color: '#e2e8f0' },
  { value: 'adpost', label: '💰 애드포스트', color: '#10b981' },
  { value: 'adsense', label: '💎 애드센스', color: '#60a5fa' },
  { value: 'shopping', label: '🛒 쇼핑', color: '#f59e0b' },
];

const GRADE_STYLES = {
  S: { bg: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: '#000', glow: 'rgba(245,158,11,0.5)', label: 'S', border: '#fbbf24' },
  A: { bg: 'linear-gradient(135deg, #34d399, #10b981)', color: '#000', glow: 'rgba(16,185,129,0.4)', label: 'A', border: '#34d399' },
  B: { bg: 'linear-gradient(135deg, #60a5fa, #3b82f6)', color: '#fff', glow: 'rgba(59,130,246,0.3)', label: 'B', border: '#60a5fa' },
  C: { bg: 'linear-gradient(135deg, #94a3b8, #64748b)', color: '#fff', glow: 'rgba(148,163,184,0.2)', label: 'C', border: '#94a3b8' },
  D: { bg: 'linear-gradient(135deg, #475569, #334155)', color: '#94a3b8', glow: 'none', label: 'D', border: '#475569' },
};

const INTENT_LABELS = {
  purchase: { label: '💰 구매의도', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  info: { label: '📖 정보탐색', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  navigation: { label: '🧭 네비게이션', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
};

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────

export function initKeywordDiscover() {
  createTabHTML();
  bindEvents();
  loadCachedKeywords();
  console.log('[KEYWORD-DISCOVER] ✅ 황금키워드 탐색기 v2 초기화 완료');
}

// ─────────────────────────────────────────────
// Tab HTML
// ─────────────────────────────────────────────

function createTabHTML() {
  const mainTab = document.getElementById('main-tab');
  if (!mainTab || !mainTab.parentElement) {
    console.error('[KEYWORD-DISCOVER] ❌ main-tab을 찾을 수 없습니다');
    return;
  }

  const tabContainer = mainTab.parentElement;
  const tab = document.createElement('div');
  tab.id = 'keyword-discover-tab';
  tab.className = 'tab-content';
  tab.style.display = 'none';

  tab.innerHTML = `
    <style>
      @keyframes kd-shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      @keyframes kd-pulse-glow {
        0%, 100% { box-shadow: 0 0 8px var(--glow-color, transparent); }
        50% { box-shadow: 0 0 18px var(--glow-color, transparent); }
      }
      .kd-grade-badge {
        display: inline-flex; align-items: center; justify-content: center;
        width: 36px; height: 36px; border-radius: 10px;
        font-size: 18px; font-weight: 900; letter-spacing: -0.5px;
        flex-shrink: 0;
      }
      .kd-grade-badge.animated {
        animation: kd-pulse-glow 2s ease-in-out infinite;
      }
      .kd-card-detail { overflow: hidden; transition: max-height 0.35s ease, opacity 0.3s ease; max-height: 0; opacity: 0; }
      .kd-card-detail.open { max-height: 1200px; opacity: 1; }
      .kd-keyword-card:hover { background: rgba(30, 41, 59, 0.85) !important; border-color: rgba(245, 158, 11, 0.2) !important; transform: translateX(4px); }
      .kd-unverified {
        background: linear-gradient(90deg, rgba(30,41,59,0.6), rgba(30,41,59,0.3), rgba(30,41,59,0.6));
        background-size: 200% 100%;
        animation: kd-shimmer 2s ease-in-out infinite;
      }
      .kd-competitor-row { background: rgba(15,23,42,0.4); border-radius: 8px; padding: 10px 14px; border: 1px solid rgba(148,163,184,0.06); }
      .kd-competitor-row.weak { border-left: 3px solid #10b981; }
      .kd-competitor-row.strong { border-left: 3px solid #ef4444; }
      .kd-score-bar { position: relative; height: 6px; background: rgba(15,23,42,0.6); border-radius: 3px; overflow: hidden; }
      .kd-score-bar-fill { height: 100%; border-radius: 3px; transition: width 0.8s ease; }
    </style>

    <div style="padding: 24px 28px; height: 100%; display: flex; flex-direction: column; gap: 18px; overflow-y: auto;">
      <!-- Header -->
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div>
          <h2 style="margin: 0; font-size: 24px; font-weight: 800; background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
            🏆 황금키워드 탐색기
          </h2>
          <p style="margin: 6px 0 0; font-size: 13px; color: rgba(255,255,255,0.5);">
            SERP 실전 분석 → 경쟁자 약점 파악 → 골든 스코어 산출
          </p>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button id="kd-scan-btn"
            style="padding: 10px 20px; background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); color: white; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 14px; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);">
            🔍 탐색 + 검증
          </button>
          <button id="kd-web-dashboard-btn"
            style="padding: 10px 16px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 13px; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);"
            title="브라우저에서 프리미엄 대시보드를 엽니다">
            🌐 웹 대시보드
          </button>
          <button id="kd-export-btn"
            style="padding: 10px 16px; background: rgba(30, 41, 59, 0.8); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 13px; transition: all 0.3s ease;">
            📥 CSV
          </button>
        </div>
      </div>

      <!-- Progress Bar -->
      <div id="kd-progress" style="display: none;">
        <div style="background: rgba(30, 41, 59, 0.6); border-radius: 12px; padding: 16px; border: 1px solid rgba(148, 163, 184, 0.1);">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span id="kd-progress-text" style="font-size: 13px; color: #94a3b8;">🔍 분석 중...</span>
            <span id="kd-progress-pct" style="font-size: 13px; color: #f59e0b; font-weight: 700;">0%</span>
          </div>
          <div style="background: rgba(15, 23, 42, 0.6); height: 6px; border-radius: 3px; overflow: hidden;">
            <div id="kd-progress-bar" style="background: linear-gradient(90deg, #f59e0b, #ef4444); height: 100%; width: 0%; border-radius: 3px; transition: width 0.5s ease;"></div>
          </div>
        </div>
      </div>

      <!-- Category Filters -->
      <div style="display: flex; gap: 8px; flex-wrap: wrap;" id="kd-filters">
        ${CATEGORY_FILTERS.map(f => `
          <button class="kd-filter-btn${f.value === 'all' ? ' active' : ''}" data-filter="${f.value}"
            style="padding: 8px 14px; background: ${f.value === 'all' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(30, 41, 59, 0.6)'}; color: ${f.value === 'all' ? '#f59e0b' : '#94a3b8'}; border: 1px solid ${f.value === 'all' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(148, 163, 184, 0.1)'}; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; white-space: nowrap;">
            ${f.label}
          </button>
        `).join('')}
      </div>

      <!-- Stats Bar -->
      <div id="kd-stats" style="display: none; gap: 12px; flex-wrap: wrap;">
        <div style="background: rgba(30, 41, 59, 0.6); border-radius: 10px; padding: 12px 16px; flex: 1; min-width: 100px; border: 1px solid rgba(148, 163, 184, 0.08);">
          <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">총 키워드</div>
          <div id="kd-stat-total" style="font-size: 20px; font-weight: 800; color: #e2e8f0;">0</div>
        </div>
        <div style="background: rgba(30, 41, 59, 0.6); border-radius: 10px; padding: 12px 16px; flex: 1; min-width: 100px; border: 1px solid rgba(148, 163, 184, 0.08);">
          <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">🏆 S/A등급</div>
          <div id="kd-stat-golden" style="font-size: 20px; font-weight: 800; color: #f59e0b;">0</div>
        </div>
        <div style="background: rgba(30, 41, 59, 0.6); border-radius: 10px; padding: 12px 16px; flex: 1; min-width: 100px; border: 1px solid rgba(148, 163, 184, 0.08);">
          <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">🟢 누구나</div>
          <div id="kd-stat-anyone" style="font-size: 20px; font-weight: 800; color: #10b981;">0</div>
        </div>
        <div style="background: rgba(30, 41, 59, 0.6); border-radius: 10px; padding: 12px 16px; flex: 1; min-width: 100px; border: 1px solid rgba(148, 163, 184, 0.08);">
          <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">💰 구매의도</div>
          <div id="kd-stat-purchase" style="font-size: 20px; font-weight: 800; color: #10b981;">0</div>
        </div>
      </div>

      <!-- Keywords List -->
      <div id="kd-results" style="flex: 1; overflow-y: auto;">
        <div id="kd-empty" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 300px; gap: 16px;">
          <div style="font-size: 64px; opacity: 0.3;">🏆</div>
          <div style="font-size: 16px; color: rgba(255,255,255,0.4); font-weight: 600;">아직 탐색하지 않았습니다</div>
          <div style="font-size: 13px; color: rgba(255,255,255,0.25);">위의 "탐색 + 검증" 버튼을 눌러 황금키워드를 찾아보세요</div>
        </div>
        <div id="kd-list" style="display: none; flex-direction: column; gap: 8px;"></div>
      </div>

      <!-- Footer -->
      <div id="kd-footer" style="display: none; padding: 8px 0; border-top: 1px solid rgba(148, 163, 184, 0.08); font-size: 11px; color: #475569; text-align: center;"></div>
    </div>
  `;

  tabContainer.appendChild(tab);
  console.log('[KEYWORD-DISCOVER] ✅ 탭 HTML v2 생성 완료');
}

// ─────────────────────────────────────────────
// Event Binding
// ─────────────────────────────────────────────

function bindEvents() {
  const scanBtn = document.getElementById('kd-scan-btn');
  if (scanBtn) scanBtn.addEventListener('click', () => startScan());

  const exportBtn = document.getElementById('kd-export-btn');
  if (exportBtn) exportBtn.addEventListener('click', () => exportCSV());

  const webDashBtn = document.getElementById('kd-web-dashboard-btn');
  if (webDashBtn) webDashBtn.addEventListener('click', async () => {
    webDashBtn.disabled = true;
    webDashBtn.textContent = '⏳ 서버 시작 중...';
    try {
      const result = await window.electronAPI.invoke('keyword-explorer:open');
      if (!result.success) {
        console.error('[KEYWORD-DISCOVER] ❌ 웹 대시보드 열기 실패:', result.error);
        alert('웹 대시보드 열기에 실패했습니다: ' + (result.error || '알 수 없는 오류'));
      }
    } catch (err) {
      console.error('[KEYWORD-DISCOVER] ❌ 웹 대시보드 오류:', err);
    } finally {
      webDashBtn.disabled = false;
      webDashBtn.textContent = '🌐 웹 대시보드';
    }
  });

  // Category filter buttons
  const filterContainer = document.getElementById('kd-filters');
  if (filterContainer) {
    filterContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.kd-filter-btn');
      if (!btn) return;
      const filter = btn.dataset.filter;
      if (filter === currentFilter) return;
      currentFilter = filter;
      filterContainer.querySelectorAll('.kd-filter-btn').forEach(b => {
        b.classList.remove('active');
        b.style.background = 'rgba(30, 41, 59, 0.6)';
        b.style.color = '#94a3b8';
        b.style.borderColor = 'rgba(148, 163, 184, 0.1)';
      });
      btn.classList.add('active');
      btn.style.background = 'rgba(245, 158, 11, 0.15)';
      btn.style.color = '#f59e0b';
      btn.style.borderColor = 'rgba(245, 158, 11, 0.3)';
      renderKeywords();
    });
  }
}

// ─────────────────────────────────────────────
// Scan + Verify Flow
// ─────────────────────────────────────────────

async function startScan() {
  if (isScanning || isVerifying) return;
  isScanning = true;

  const scanBtn = document.getElementById('kd-scan-btn');
  const progressEl = document.getElementById('kd-progress');

  if (scanBtn) {
    scanBtn.textContent = '⏳ 탐색 중...';
    scanBtn.style.opacity = '0.7';
    scanBtn.style.pointerEvents = 'none';
  }
  if (progressEl) progressEl.style.display = 'block';

  // Step 1: 키워드 수집
  let simPct = 0;
  const simInterval = setInterval(() => {
    simPct = Math.min(simPct + Math.random() * 8 + 2, 45);
    const msgs = ['🔍 트렌드 수집 중...', '📊 문서수 분석 중...', '🧮 갭 스코어 계산 중...', '📈 키워드 분류 중...'];
    updateProgress(msgs[Math.floor(simPct / 12)] || msgs[0], simPct);
  }, 800);

  try {
    const result = await window.electronAPI.invoke('keyword-discover:scan', {
      maxKeywords: 30,
      categoryFilter: 'all',
    });

    clearInterval(simInterval);

    if (result.success) {
      currentKeywords = result.keywords || [];
      renderKeywords();
      updateStats();
      showFooter(result.scannedAt, result.totalScanned);

      // Step 2: 자동 검증 (상위 20개)
      if (currentKeywords.length > 0) {
        await startVerification();
      }
    } else {
      console.error('[KEYWORD-DISCOVER] 스캔 실패:', result.error);
      showError(result.error || '탐색에 실패했습니다');
    }
  } catch (err) {
    clearInterval(simInterval);
    console.error('[KEYWORD-DISCOVER] IPC 에러:', err);
    showError(err.message || '서버 연결에 실패했습니다');
  } finally {
    isScanning = false;
    if (scanBtn) {
      scanBtn.textContent = '🔍 탐색 + 검증';
      scanBtn.style.opacity = '1';
      scanBtn.style.pointerEvents = 'auto';
    }
    if (progressEl && !isVerifying) {
      setTimeout(() => { progressEl.style.display = 'none'; }, 1500);
    }
  }
}

async function startVerification() {
  isVerifying = true;
  const scanBtn = document.getElementById('kd-scan-btn');
  if (scanBtn) {
    scanBtn.textContent = '🔬 검증 중...';
    scanBtn.style.opacity = '0.7';
    scanBtn.style.pointerEvents = 'none';
  }

  updateProgress('🔬 SERP 실전 검증 시작...', 50);

  try {
    const batchInput = currentKeywords.slice(0, 20).map(kw => ({
      keyword: kw.keyword,
      estimatedVolume: kw.estimatedVolume,
      trendGrowth: kw.trendGrowth || 0,
      competition: kw.competition || '',
    }));

    const result = await window.electronAPI.invoke('keyword-discover:verify-batch', batchInput, 20);

    if (result.success && result.results) {
      // 검증 결과를 키워드에 병합
      const verifyMap = {};
      for (const vr of result.results) {
        verifyMap[vr.keyword] = vr;
      }

      currentKeywords = currentKeywords.map(kw => {
        const v = verifyMap[kw.keyword];
        if (v) {
          return {
            ...kw,
            goldenScore: v.goldenScore,
            goldenGrade: v.goldenGrade,
            verifiedAt: v.verifiedAt,
            revenueIntent: v.revenueIntent,
            viewTabPresent: v.viewTabPresent,
            weakCount: v.weakCount,
            estimatedCpc: v.estimatedCpc,
            verificationMethod: v.verificationMethod,
            _competitors: v.competitors,
            _scores: {
              searchVolumeScore: v.searchVolumeScore,
              competitorScore: v.competitorScore,
              revenueScore: v.revenueScore,
              viewTabScore: v.viewTabScore,
              trendScore: v.trendScore,
            },
          };
        }
        return kw;
      });

      // 골든 스코어로 재정렬 (검증된 것 우선, 미검증은 갭 스코어 기준)
      currentKeywords.sort((a, b) => {
        const sa = a.goldenScore ?? (a.gapScore * 0.8);
        const sb = b.goldenScore ?? (b.gapScore * 0.8);
        return sb - sa;
      });

      updateProgress('✅ 검증 완료!', 100);
      renderKeywords();
      updateStats();
    }
  } catch (err) {
    console.error('[KEYWORD-DISCOVER] 검증 실패:', err);
    updateProgress('⚠️ 검증 일부 실패', 100);
  } finally {
    isVerifying = false;
    const progressEl = document.getElementById('kd-progress');
    const scanBtn2 = document.getElementById('kd-scan-btn');
    if (scanBtn2) {
      scanBtn2.textContent = '🔍 탐색 + 검증';
      scanBtn2.style.opacity = '1';
      scanBtn2.style.pointerEvents = 'auto';
    }
    if (progressEl) {
      setTimeout(() => { progressEl.style.display = 'none'; }, 2000);
    }
  }
}

// ─────────────────────────────────────────────
// Export CSV
// ─────────────────────────────────────────────

async function exportCSV() {
  if (currentKeywords.length === 0) {
    alert('내보낼 키워드가 없습니다. 먼저 탐색을 실행해주세요.');
    return;
  }
  try {
    const result = await window.electronAPI.invoke('keyword-discover:export-csv', currentKeywords);
    if (result.success) {
      alert(`✅ CSV 저장 완료!\n${result.filePath}`);
    } else {
      alert(`❌ CSV 저장 실패: ${result.error}`);
    }
  } catch (err) {
    alert(`CSV 저장 중 오류: ${err.message}`);
  }
}

// ─────────────────────────────────────────────
// Load Cache
// ─────────────────────────────────────────────

async function loadCachedKeywords() {
  try {
    const result = await window.electronAPI.invoke('keyword-discover:cached');
    if (result.success && result.byCategory) {
      const all = [];
      for (const cat of Object.values(result.byCategory)) {
        if (Array.isArray(cat)) all.push(...cat);
      }
      if (all.length > 0) {
        all.sort((a, b) => {
          const sa = a.goldenScore ?? (a.gapScore * 0.8);
          const sb = b.goldenScore ?? (b.gapScore * 0.8);
          return sb - sa;
        });
        currentKeywords = all;
        renderKeywords();
        updateStats();
        console.log(`[KEYWORD-DISCOVER] 캐시 로드: ${all.length}개 키워드`);
      }
    }
  } catch (err) {
    console.log('[KEYWORD-DISCOVER] 캐시 없음 (첫 실행)');
  }
}

// ─────────────────────────────────────────────
// Rendering — Keyword Cards
// ─────────────────────────────────────────────

function renderKeywords() {
  const listEl = document.getElementById('kd-list');
  const emptyEl = document.getElementById('kd-empty');
  if (!listEl || !emptyEl) return;

  let filtered = currentKeywords;
  if (currentFilter !== 'all') {
    filtered = currentKeywords.filter(k => k.category === currentFilter);
  }

  if (filtered.length === 0) {
    listEl.style.display = 'none';
    emptyEl.style.display = 'flex';
    return;
  }

  emptyEl.style.display = 'none';
  listEl.style.display = 'flex';

  listEl.innerHTML = filtered.map((kw, idx) => {
    const diff = DIFFICULTY_BADGES[kw.difficulty] || DIFFICULTY_BADGES.normal;
    const cat = CATEGORY_INFO[kw.category] || CATEGORY_INFO.adpost;
    const isVerified = kw.goldenScore != null;
    const grade = isVerified ? (GRADE_STYLES[kw.goldenGrade] || GRADE_STYLES.D) : null;
    const intent = kw.revenueIntent ? (INTENT_LABELS[kw.revenueIntent] || INTENT_LABELS.info) : null;
    const rankColor = idx < 3 ? '#f59e0b' : idx < 10 ? '#94a3b8' : '#475569';
    const isExpanded = expandedKeyword === kw.keyword;

    return `
      <div class="kd-keyword-card" data-keyword="${kw.keyword}" data-idx="${idx}"
        style="background: rgba(30, 41, 59, 0.6); border-radius: 12px; border: 1px solid ${isExpanded ? 'rgba(245,158,11,0.3)' : 'rgba(148, 163, 184, 0.08)'}; cursor: pointer; transition: all 0.2s ease; ${isExpanded ? 'box-shadow: 0 4px 24px rgba(0,0,0,0.3);' : ''}">
        
        <!-- Card Header Row -->
        <div style="display: flex; align-items: center; gap: 12px; padding: 14px 18px;" class="kd-card-header">
          <!-- Rank -->
          <div style="font-size: 15px; font-weight: 800; color: ${rankColor}; min-width: 24px; text-align: center;">
            ${idx + 1}
          </div>

          <!-- Grade Badge -->
          ${isVerified ? `
            <div class="kd-grade-badge ${kw.goldenGrade === 'S' ? 'animated' : ''}"
              style="background: ${grade.bg}; color: ${grade.color}; --glow-color: ${grade.glow}; box-shadow: 0 0 10px ${grade.glow};">
              ${grade.label}
            </div>
          ` : `
            <div class="kd-grade-badge kd-unverified"
              style="background: rgba(30,41,59,0.4); color: #475569; border: 1px dashed rgba(148,163,184,0.2);">
              ?
            </div>
          `}

          <!-- Main content -->
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="font-size: 14px; font-weight: 700; color: #e2e8f0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${kw.keyword}
              </span>
              ${kw.isNew ? '<span style="font-size: 10px; background: rgba(245, 158, 11, 0.2); color: #f59e0b; padding: 2px 6px; border-radius: 4px; font-weight: 700;">🆕 NEW</span>' : ''}
              ${kw.isEvergreen ? '<span style="font-size: 10px; background: rgba(16, 185, 129, 0.2); color: #10b981; padding: 2px 6px; border-radius: 4px; font-weight: 700;">♻️</span>' : ''}
            </div>
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
              <span style="font-size: 10px; color: ${cat.color}; background: ${cat.color}15; padding: 2px 8px; border-radius: 4px;">${cat.icon} ${cat.label}</span>
              <span style="font-size: 10px; color: ${diff.color}; background: ${diff.bg}; padding: 2px 8px; border-radius: 4px;">${diff.label}</span>
              ${intent ? `<span style="font-size: 10px; color: ${intent.color}; background: ${intent.bg}; padding: 2px 8px; border-radius: 4px;">${intent.label}</span>` : ''}
              ${kw.viewTabPresent === true ? '<span style="font-size: 10px; color: #10b981; background: rgba(16,185,129,0.12); padding: 2px 8px; border-radius: 4px;">📖 VIEW탭</span>' : ''}
              ${kw.viewTabPresent === false ? '<span style="font-size: 10px; color: #ef4444; background: rgba(239,68,68,0.12); padding: 2px 8px; border-radius: 4px;">❌ VIEW없음</span>' : ''}
            </div>
          </div>

          <!-- Score area -->
          <div style="text-align: right; min-width: 85px;">
            ${isVerified ? `
              <div style="font-size: 20px; font-weight: 900; color: ${grade.border};">${kw.goldenScore}</div>
              <div style="font-size: 10px; color: #475569;">골든 스코어</div>
            ` : `
              <div style="font-size: 16px; font-weight: 800; color: ${kw.gapScore >= 100 ? '#ef4444' : kw.gapScore >= 50 ? '#f59e0b' : '#94a3b8'};">${kw.gapScore?.toFixed(1) ?? '-'}</div>
              <div style="font-size: 10px; color: #475569;">갭 스코어</div>
            `}
          </div>

          <!-- Volume -->
          <div style="text-align: right; min-width: 65px;">
            <div style="font-size: 13px; font-weight: 700; color: #94a3b8;">${formatNumber(kw.estimatedVolume)}</div>
            <div style="font-size: 10px; color: #475569;">검색량</div>
          </div>

          <!-- Expand Arrow -->
          <div style="font-size: 12px; color: #475569; transform: rotate(${isExpanded ? '180deg' : '0deg'}); transition: transform 0.3s ease;">▼</div>
        </div>

        <!-- Detail Panel -->
        <div class="kd-card-detail ${isExpanded ? 'open' : ''}" id="kd-detail-${idx}">
          ${isExpanded ? renderDetailPanel(kw) : ''}
        </div>
      </div>
    `;
  }).join('');

  // Click handlers
  listEl.querySelectorAll('.kd-card-header').forEach(header => {
    header.addEventListener('click', (e) => {
      const card = header.closest('.kd-keyword-card');
      if (!card) return;
      const keyword = card.dataset.keyword;
      const idx = parseInt(card.dataset.idx);

      if (expandedKeyword === keyword) {
        expandedKeyword = null;
      } else {
        expandedKeyword = keyword;
      }
      renderKeywords();
    });
  });
}

// ─────────────────────────────────────────────
// Detail Panel
// ─────────────────────────────────────────────

function renderDetailPanel(kw) {
  const isVerified = kw.goldenScore != null;
  const competitors = kw._competitors || [];
  const scores = kw._scores || {};

  if (!isVerified) {
    return `
      <div style="padding: 16px 18px; border-top: 1px solid rgba(148,163,184,0.08);">
        <div style="text-align: center; padding: 24px; color: #475569;">
          <div style="font-size: 32px; margin-bottom: 8px;">🔬</div>
          <div style="font-size: 13px; margin-bottom: 12px;">아직 검증되지 않은 키워드입니다</div>
          <button class="kd-verify-single-btn" data-keyword="${kw.keyword}" data-volume="${kw.estimatedVolume || 0}" data-trend="${kw.trendGrowth || 0}"
            style="padding: 8px 20px; background: linear-gradient(135deg, #f59e0b, #ef4444); color: white; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 13px;">
            🔬 이 키워드 검증하기
          </button>
        </div>
      </div>
    `;
  }

  const grade = GRADE_STYLES[kw.goldenGrade] || GRADE_STYLES.D;
  const methodLabel = kw.verificationMethod === 'full' ? '🟢 실제 방문' : kw.verificationMethod === 'quick' ? '🟡 빠른 분석' : '⚪ 추정';

  return `
    <div style="padding: 16px 18px; border-top: 1px solid rgba(148,163,184,0.08);">
      <!-- Score Breakdown -->
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 16px;">
        ${renderScoreItem('검색량', scores.searchVolumeScore || 0, 20, '#60a5fa')}
        ${renderScoreItem('경쟁약체', scores.competitorScore || 0, 30, '#10b981')}
        ${renderScoreItem('수익의도', scores.revenueScore || 0, 20, '#f59e0b')}
        ${renderScoreItem('VIEW탭', scores.viewTabScore || 0, 15, '#a78bfa')}
        ${renderScoreItem('트렌드', scores.trendScore || 0, 15, '#ec4899')}
      </div>

      <!-- Meta Info -->
      <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; font-size: 11px; color: #64748b;">
        <span>${methodLabel}</span>
        <span>약체 ${kw.weakCount || 0}/5</span>
        <span>추정CPC ${formatNumber(kw.estimatedCpc || 0)}원</span>
        <span>갭스코어 ${kw.gapScore?.toFixed(1) ?? '-'}</span>
        <span>문서 ${formatNumber(kw.documentCount)}건</span>
      </div>

      <!-- Competitor Cards -->
      ${competitors.length > 0 ? `
        <div style="margin-bottom: 8px; font-size: 12px; font-weight: 700; color: #94a3b8;">📋 상위 경쟁자 분석</div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${competitors.map((c, i) => `
            <div class="kd-competitor-row ${c.isWeak ? 'weak' : 'strong'}">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 11px; font-weight: 800; color: ${c.isWeak ? '#10b981' : '#ef4444'};">${i + 1}위</span>
                  <span style="font-size: 12px; font-weight: 600; color: #e2e8f0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 300px;" title="${c.title}">${c.title}</span>
                </div>
                <span style="font-size: 10px; padding: 2px 8px; border-radius: 4px; font-weight: 700; background: ${c.isWeak ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color: ${c.isWeak ? '#10b981' : '#ef4444'};">
                  ${c.isWeak ? '✅ 약체' : '💪 강체'}
                </span>
              </div>
              <div style="display: flex; gap: 12px; font-size: 10px; color: #64748b; flex-wrap: wrap;">
                <span>📝 ${c.blogName}</span>
                ${c.contentLength > 0 ? `<span>📏 ${formatNumber(c.contentLength)}자</span>` : ''}
                ${c.imageCount > 0 ? `<span>🖼️ ${c.imageCount}장</span>` : ''}
                <span>📅 ${c.daysAgo}일 전</span>
                ${c.hasKeywordInTitle ? '<span style="color: #f59e0b;">🏷️ 제목포함</span>' : '<span style="color: #ef4444;">❌ 제목미포함</span>'}
              </div>
              ${c.weakReasons?.length > 0 ? `
                <div style="margin-top: 4px; display: flex; gap: 6px; flex-wrap: wrap;">
                  ${c.weakReasons.map(r => `<span style="font-size: 9px; color: #10b981; background: rgba(16,185,129,0.08); padding: 1px 6px; border-radius: 3px;">🎯 ${r}</span>`).join('')}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      ` : `
        <div style="text-align: center; padding: 16px; color: #475569; font-size: 12px;">
          경쟁자 데이터가 없습니다 (${methodLabel} 분석)
        </div>
      `}

      <!-- Copy Button -->
      <div style="margin-top: 12px; display: flex; gap: 8px;">
        <button class="kd-copy-btn" data-keyword="${kw.keyword}"
          style="flex: 1; padding: 8px; background: rgba(30,41,59,0.8); color: #94a3b8; border: 1px solid rgba(148,163,184,0.15); border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s ease;">
          📋 키워드 복사
        </button>
        <button class="kd-use-btn" data-keyword="${kw.keyword}"
          style="flex: 1; padding: 8px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s ease;">
          ✍️ 글쓰기에 사용
        </button>
      </div>
    </div>
  `;
}

function renderScoreItem(label, score, max, color) {
  const pct = Math.round((score / max) * 100);
  return `
    <div style="text-align: center;">
      <div style="font-size: 14px; font-weight: 800; color: ${color};">${score}</div>
      <div class="kd-score-bar" style="margin: 4px 0;">
        <div class="kd-score-bar-fill" style="width: ${pct}%; background: ${color};"></div>
      </div>
      <div style="font-size: 9px; color: #475569;">${label} (/${max})</div>
    </div>
  `;
}

// ─────────────────────────────────────────────
// Stats
// ─────────────────────────────────────────────

function updateStats() {
  const statsEl = document.getElementById('kd-stats');
  if (statsEl) statsEl.style.display = 'flex';

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setVal('kd-stat-total', currentKeywords.length);
  setVal('kd-stat-golden', currentKeywords.filter(k => k.goldenGrade === 'S' || k.goldenGrade === 'A').length);
  setVal('kd-stat-anyone', currentKeywords.filter(k => k.difficulty === 'anyone').length);
  setVal('kd-stat-purchase', currentKeywords.filter(k => k.revenueIntent === 'purchase').length);
}

// ─────────────────────────────────────────────
// Progress / Footer / Error
// ─────────────────────────────────────────────

function updateProgress(message, percent) {
  const textEl = document.getElementById('kd-progress-text');
  const pctEl = document.getElementById('kd-progress-pct');
  const barEl = document.getElementById('kd-progress-bar');
  if (textEl) textEl.textContent = message;
  if (pctEl) pctEl.textContent = `${Math.round(percent)}%`;
  if (barEl) barEl.style.width = `${percent}%`;
}

function showFooter(scannedAt, totalScanned) {
  const footerEl = document.getElementById('kd-footer');
  if (!footerEl) return;
  footerEl.style.display = 'block';
  const time = new Date(scannedAt).toLocaleString('ko-KR');
  const sourceCount = {};
  for (const kw of currentKeywords) {
    const src = kw.source || 'naver';
    sourceCount[src] = (sourceCount[src] || 0) + 1;
  }
  const srcParts = Object.entries(sourceCount).map(([key, count]) => {
    const info = SOURCE_INFO[key] || { icon: '📌', label: key };
    return `${info.icon}${info.label} ${count}개`;
  }).join(' · ');
  footerEl.textContent = `마지막 탐색: ${time} · 총 ${totalScanned}개 분석 → ${currentKeywords.length}개 결과 | ${srcParts}`;
}

function showError(message) {
  const emptyEl = document.getElementById('kd-empty');
  if (emptyEl) {
    emptyEl.innerHTML = `
      <div style="font-size: 48px; opacity: 0.3;">⚠️</div>
      <div style="font-size: 14px; color: #ef4444; font-weight: 600;">${message}</div>
      <div style="font-size: 12px; color: rgba(255,255,255,0.3);">다시 시도해주세요</div>
    `;
    emptyEl.style.display = 'flex';
  }
  const listEl = document.getElementById('kd-list');
  if (listEl) listEl.style.display = 'none';
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatNumber(n) {
  if (n == null) return '-';
  if (n >= 10000) return (n / 10000).toFixed(1) + '만';
  if (n >= 1000) return (n / 1000).toFixed(1) + '천';
  return n.toLocaleString();
}
