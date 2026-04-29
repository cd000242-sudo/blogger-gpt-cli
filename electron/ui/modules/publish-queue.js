// publish-queue.js — 줄바꿈 키워드 → 연속발행 대기열 UI 모듈
//
// 동작:
//   1) #keywordInput textarea에서 줄바꿈으로 2개 이상 키워드 입력 → publishQueueBadge 자동 표시
//   2) "📋 대기열 열기" → 모달 띄움
//   3) 모달에서 키워드별 개별 세팅(모드/엔진/CTA) 또는 일괄 세팅
//   4) "🚀 대기열 발행 시작" → scheduledPosts에 추가하거나 즉시 순차 발행
//
// 기존 시스템 재활용:
//   - localStorage 'scheduledPosts' (스케줄러)
//   - publishQueue 항목은 scheduledPosts와 같은 스키마로 변환

const STATE = {
  keywords: [],     // [{ id, keyword, mode, ctaMode, thumb, enabled }]
  isOpen: false,
};

function getKeywordsFromTextarea() {
  const ta = document.getElementById('keywordInput');
  if (!ta) return [];
  return String(ta.value || '')
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function getCurrentMode() {
  const btn = document.querySelector('[data-publish-mode][aria-selected="true"]');
  return btn?.dataset?.publishMode || 'single';
}

function syncBadge() {
  const badge = document.getElementById('publishQueueBadge');
  const countEl = document.getElementById('publishQueueCount');
  const currentCountEl = document.getElementById('publishQueueCurrentCount');
  const savedCountEl = document.getElementById('publishQueueSavedCount');
  const singleHint = document.getElementById('singleModeHint');
  const bulkHint = document.getElementById('bulkModeHint');
  if (!badge) return;

  const mode = getCurrentMode();
  const list = getKeywordsFromTextarea();
  const savedCount = STATE.keywords.length;

  if (currentCountEl) currentCountEl.textContent = String(list.length);
  if (savedCountEl) savedCountEl.textContent = String(savedCount);
  if (countEl) countEl.textContent = String(savedCount);

  if (mode === 'bulk') {
    // 연속 발행 서브탭 — 큐 패널 항상 표시
    badge.style.display = 'flex';
    if (singleHint) singleHint.style.display = 'none';
    if (bulkHint) bulkHint.style.display = 'inline-block';
  } else {
    // 단일 발행 서브탭 — 큐 패널 숨김
    badge.style.display = 'none';
    if (singleHint) singleHint.style.display = 'block';
    if (bulkHint) bulkHint.style.display = 'none';
  }
}

/** 서브탭 토글 — single ↔ bulk */
function bindPublishModeTabs() {
  const tabs = document.querySelectorAll('[data-publish-mode]');
  if (!tabs.length) return;
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.publishMode;
      tabs.forEach(t => {
        const isActive = t === tab;
        t.setAttribute('aria-selected', String(isActive));
        if (isActive) {
          t.style.background = 'linear-gradient(135deg,#6366f1,#8b5cf6)';
          t.style.color = 'white';
          t.style.boxShadow = '0 4px 12px rgba(99,102,241,0.3)';
        } else {
          t.style.background = 'transparent';
          t.style.color = 'rgba(255,255,255,0.6)';
          t.style.boxShadow = 'none';
        }
      });
      syncBadge();
      // 연속 발행 모드 진입 시 키워드 1개만 있으면 안내
      if (mode === 'bulk') {
        const list = getKeywordsFromTextarea();
        if (list.length < 2) {
          const ta = document.getElementById('keywordInput');
          if (ta && !ta.value.includes('\n')) {
            ta.placeholder = '예: 블로그 수익화 방법\nAI 마케팅 전략\n부수입 만들기';
            ta.focus();
          }
        }
      }
    });
  });
}

// ════════════════════════════════════════════
// 모달 빌드
// ════════════════════════════════════════════
function buildModalHtml() {
  return `
<div id="publishQueueModal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(8px);">
  <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border: 1px solid rgba(139,92,246,0.4); border-radius: 16px; max-width: 1100px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 30px 80px rgba(0,0,0,0.6);">

    <!-- 헤더 -->
    <div style="padding: 20px 28px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: space-between; gap: 14px;">
      <div>
        <h3 style="margin: 0; color: white; font-size: 20px; font-weight: 800;">🚀 연속발행 대기열</h3>
        <p style="margin: 4px 0 0; color: #c4b5fd; font-size: 12px;">키워드별 모드·엔진·CTA를 개별 또는 일괄로 설정 후 발행</p>
      </div>
      <button onclick="window.__publishQueue && window.__publishQueue.close()" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 8px; padding: 8px 14px; font-size: 13px; cursor: pointer;">✕ 닫기</button>
    </div>

    <!-- 일괄 세팅 바 -->
    <div style="padding: 14px 28px; background: rgba(99,102,241,0.08); border-bottom: 1px solid rgba(255,255,255,0.06);">
      <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center;">
        <span style="color: #a5b4fc; font-size: 12px; font-weight: 700; white-space: nowrap;">📦 일괄 적용:</span>
        <select id="pq-bulk-mode" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 6px; padding: 6px 10px; font-size: 12px;">
          <option value="">콘텐츠 모드 (변경 안 함)</option>
          <option value="external">🎯 SEO 외부링크</option>
          <option value="internal">📝 내부링크 일관</option>
          <option value="adsense">🏆 애드센스 승인</option>
          <option value="paraphrasing">🔄 페러프레이징</option>
        </select>
        <select id="pq-bulk-thumb" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 6px; padding: 6px 10px; font-size: 12px;">
          <option value="">썸네일 엔진 (변경 안 함)</option>
          <option value="imagefx">🎨 이미지 FX</option>
          <option value="flow">🌊 Flow</option>
          <option value="nanobananapro">🍌 Nano Banana Pro (Gemini 3)</option>
          <option value="deepinfra">🔥 DeepInfra</option>
          <option value="dalle">🩹 덕트테이프 (GPT-Image-2)</option>
          <option value="none">❌ 썸네일 없음</option>
        </select>
        <select id="pq-bulk-cta" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 6px; padding: 6px 10px; font-size: 12px;">
          <option value="">CTA (변경 안 함)</option>
          <option value="auto">🤖 자동</option>
          <option value="manual">✏️ 수동</option>
        </select>
        <button id="pq-bulk-apply" style="padding: 6px 14px; background: linear-gradient(135deg,#6366f1,#8b5cf6); color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer;">✓ 일괄 적용</button>
        <span style="flex: 1;"></span>
      </div>
      <!-- 발행 간격 조절 -->
      <div style="display: flex; flex-wrap: wrap; gap: 14px; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px dashed rgba(255,255,255,0.08);">
        <span style="color: #a5b4fc; font-size: 12px; font-weight: 700; white-space: nowrap;">⏰ 발행 간격:</span>
        <select id="pq-interval-mode" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 6px; padding: 6px 10px; font-size: 12px;">
          <option value="seconds">초 단위 (즉시 발행용)</option>
          <option value="minutes">분 단위</option>
          <option value="hours" selected>시간 단위 (스케줄용)</option>
          <option value="random">12-24h 무작위 분산 (adsense 권장)</option>
        </select>
        <div id="pq-interval-fixed" style="display: flex; align-items: center; gap: 8px;">
          <input type="range" id="pq-interval-value" min="1" max="24" value="12" step="1" style="width: 180px; accent-color: #8b5cf6;" oninput="document.getElementById('pq-interval-label').textContent = this.value;">
          <span id="pq-interval-label" style="color: white; font-weight: 700; font-size: 13px; min-width: 30px; text-align: right;">12</span>
          <span id="pq-interval-unit" style="color: rgba(255,255,255,0.7); font-size: 12px; min-width: 30px;">시간</span>
        </div>
        <small style="color: rgba(255,255,255,0.45); font-size: 11px; flex-basis: 100%; margin-top: 2px;">💡 즉시 순차 발행: '초/분' 권장 · 스케줄 추가: '시간/무작위 분산' 권장 (양산 패턴 회피)</small>
      </div>
    </div>

    <!-- 큐 리스트 -->
    <div id="pq-list" style="flex: 1; overflow-y: auto; padding: 16px 28px;">
      <!-- runtime 채워짐 -->
    </div>

    <!-- 푸터 (액션 버튼) -->
    <div style="padding: 16px 28px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: space-between; gap: 14px; background: rgba(0,0,0,0.2);">
      <div style="color: rgba(255,255,255,0.6); font-size: 12px;">
        💡 즉시 발행: 활성 항목을 순차로 즉시 발행 · 스케줄: 12-24h 분산 후 자동 발행 (adsense 권장)
      </div>
      <div style="display: flex; gap: 10px;">
        <button id="pq-action-clear" style="padding: 10px 16px; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #fca5a5; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer;">🗑️ 큐 비우기</button>
        <button id="pq-action-schedule" style="padding: 10px 18px; background: linear-gradient(135deg,#f59e0b,#d97706); color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer;">📅 스케줄에 추가</button>
        <button id="pq-action-publish" style="padding: 10px 18px; background: linear-gradient(135deg,#22c55e,#16a34a); color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer;">🚀 즉시 순차 발행</button>
      </div>
    </div>
  </div>
</div>
  `;
}

function buildItemRow(item, idx) {
  return `
<div data-pq-item-id="${item.id}" style="display: grid; grid-template-columns: 32px 1fr 160px 160px 110px 80px 36px; gap: 8px; align-items: center; padding: 10px 12px; background: ${item.enabled ? 'rgba(99,102,241,0.05)' : 'rgba(100,116,139,0.05)'}; border: 1px solid ${item.enabled ? 'rgba(99,102,241,0.2)' : 'rgba(100,116,139,0.15)'}; border-radius: 10px; margin-bottom: 6px;">
  <input type="checkbox" class="pq-item-enabled" ${item.enabled ? 'checked' : ''} style="accent-color: #6366f1; width: 18px; height: 18px;">
  <input type="text" class="pq-item-keyword" value="${escHtml(item.keyword)}" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); color: white; border-radius: 6px; padding: 8px 12px; font-size: 13px;">
  <select class="pq-item-mode" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); color: white; border-radius: 6px; padding: 6px 8px; font-size: 11px;">
    <option value="external" ${item.mode === 'external' ? 'selected' : ''}>SEO 외부</option>
    <option value="internal" ${item.mode === 'internal' ? 'selected' : ''}>내부링크</option>
    <option value="adsense" ${item.mode === 'adsense' ? 'selected' : ''}>애드센스</option>
    <option value="paraphrasing" ${item.mode === 'paraphrasing' ? 'selected' : ''}>페러프레이징</option>
  </select>
  <select class="pq-item-thumb" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); color: white; border-radius: 6px; padding: 6px 8px; font-size: 11px;">
    <option value="imagefx" ${item.thumb === 'imagefx' ? 'selected' : ''}>이미지 FX</option>
    <option value="flow" ${item.thumb === 'flow' ? 'selected' : ''}>Flow</option>
    <option value="nanobananapro" ${item.thumb === 'nanobananapro' ? 'selected' : ''}>Nano Banana Pro (G3)</option>
    <option value="deepinfra" ${item.thumb === 'deepinfra' ? 'selected' : ''}>DeepInfra</option>
    <option value="dalle" ${item.thumb === 'dalle' ? 'selected' : ''}>덕트테이프</option>
    <option value="none" ${item.thumb === 'none' ? 'selected' : ''}>❌ 없음</option>
  </select>
  <select class="pq-item-cta" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); color: white; border-radius: 6px; padding: 6px 8px; font-size: 11px;">
    <option value="auto" ${item.ctaMode === 'auto' ? 'selected' : ''}>자동</option>
    <option value="manual" ${item.ctaMode === 'manual' ? 'selected' : ''}>수동</option>
  </select>
  <span style="color: rgba(255,255,255,0.5); font-size: 11px; text-align: center;">#${idx + 1}</span>
  <button class="pq-item-remove" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; border-radius: 6px; width: 30px; height: 30px; cursor: pointer; font-size: 14px;">×</button>
</div>
  `;
}

function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ════════════════════════════════════════════
// 모달 동작
// ════════════════════════════════════════════
function refreshList() {
  const listEl = document.getElementById('pq-list');
  if (!listEl) return;
  if (STATE.keywords.length === 0) {
    listEl.innerHTML = '<div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.4);">대기열이 비어있습니다. 키워드 입력란에 줄바꿈으로 여러 개 입력하세요.</div>';
    return;
  }
  // 헤더
  const header = `
<div style="display: grid; grid-template-columns: 32px 1fr 160px 160px 110px 80px 36px; gap: 8px; padding: 8px 12px; color: rgba(255,255,255,0.5); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
  <span></span><span>키워드</span><span>모드</span><span>썸네일</span><span>CTA</span><span style="text-align:center;">번호</span><span></span>
</div>`;
  listEl.innerHTML = header + STATE.keywords.map((it, i) => buildItemRow(it, i)).join('');
  bindItemEvents();
}

function bindItemEvents() {
  document.querySelectorAll('[data-pq-item-id]').forEach(row => {
    const id = row.getAttribute('data-pq-item-id');
    const item = STATE.keywords.find(k => k.id === id);
    if (!item) return;
    row.querySelector('.pq-item-enabled')?.addEventListener('change', e => { item.enabled = e.target.checked; refreshList(); });
    row.querySelector('.pq-item-keyword')?.addEventListener('input', e => { item.keyword = e.target.value; });
    row.querySelector('.pq-item-mode')?.addEventListener('change', e => { item.mode = e.target.value; });
    row.querySelector('.pq-item-thumb')?.addEventListener('change', e => { item.thumb = e.target.value; });
    row.querySelector('.pq-item-cta')?.addEventListener('change', e => { item.ctaMode = e.target.value; });
    row.querySelector('.pq-item-remove')?.addEventListener('click', () => {
      STATE.keywords = STATE.keywords.filter(k => k.id !== id);
      refreshList();
    });
  });
}

/** 현재 UI 설정에서 발행 간격(ms) 계산 — 'random' 모드면 12-24h 사이 무작위 */
function getIntervalMs() {
  const mode = document.getElementById('pq-interval-mode')?.value || 'hours';
  const value = Number(document.getElementById('pq-interval-value')?.value || 12);
  if (mode === 'random') return (12 + Math.random() * 12) * 3600 * 1000;
  if (mode === 'seconds') return Math.max(5, value) * 1000;        // 최소 5초 안전장치
  if (mode === 'minutes') return Math.max(1, value) * 60 * 1000;
  return Math.max(1, value) * 3600 * 1000;
}

/** 간격 모드 변경 시 슬라이더 범위/단위 라벨 동기화 */
function syncIntervalControl() {
  const mode = document.getElementById('pq-interval-mode')?.value || 'hours';
  const slider = document.getElementById('pq-interval-value');
  const unit = document.getElementById('pq-interval-unit');
  const fixedWrap = document.getElementById('pq-interval-fixed');
  if (!slider || !unit || !fixedWrap) return;

  if (mode === 'random') {
    fixedWrap.style.display = 'none';
    return;
  }
  fixedWrap.style.display = 'flex';

  if (mode === 'seconds') {
    slider.min = '5'; slider.max = '300'; slider.step = '5';
    if (Number(slider.value) > 300 || Number(slider.value) < 5) slider.value = '30';
    unit.textContent = '초';
  } else if (mode === 'minutes') {
    slider.min = '1'; slider.max = '120'; slider.step = '1';
    if (Number(slider.value) > 120) slider.value = '10';
    unit.textContent = '분';
  } else {
    slider.min = '1'; slider.max = '24'; slider.step = '1';
    if (Number(slider.value) > 24) slider.value = '12';
    unit.textContent = '시간';
  }
  document.getElementById('pq-interval-label').textContent = slider.value;
}

function bindModalEvents() {
  // 간격 컨트롤 동기화
  document.getElementById('pq-interval-mode')?.addEventListener('change', syncIntervalControl);
  syncIntervalControl();

  // 일괄 적용
  document.getElementById('pq-bulk-apply')?.addEventListener('click', () => {
    const m = document.getElementById('pq-bulk-mode')?.value;
    const t = document.getElementById('pq-bulk-thumb')?.value;
    const c = document.getElementById('pq-bulk-cta')?.value;
    STATE.keywords.forEach(item => {
      if (m) item.mode = m;
      if (t) item.thumb = t;
      if (c) item.ctaMode = c;
    });
    refreshList();
  });

  // 큐 비우기
  document.getElementById('pq-action-clear')?.addEventListener('click', () => {
    if (!confirm('대기열을 비우시겠습니까?')) return;
    STATE.keywords = [];
    refreshList();
    syncBadge();
  });

  // 스케줄 추가 — 사용자가 선택한 발행 간격 사용
  document.getElementById('pq-action-schedule')?.addEventListener('click', async () => {
    const enabled = STATE.keywords.filter(k => k.enabled && k.keyword.trim());
    if (enabled.length === 0) return alert('활성화된 키워드가 없습니다.');

    let cursor = Date.now() + 60 * 60 * 1000; // 1시간 뒤부터 시작
    const newSchedules = enabled.map((it, i) => {
      const d = new Date(cursor);
      const item = {
        id: Date.now() + i,
        topic: it.keyword,
        keywords: it.keyword,
        date: d.toISOString().slice(0, 10),
        time: d.toTimeString().slice(0, 5),
        contentMode: it.mode,
        ctaMode: it.ctaMode,
        publishType: 'scheduled',
        thumbnailMode: it.thumb,
        platform: 'blogspot',
        primaryGeminiTextModel: 'gemini-2.5-flash',
        provider: 'gemini',
        h2Images: [2, 3, 4],
        h2ImageSource: it.thumb,
        h2ImageSections: [2, 3, 4],
        status: 'pending',
        createdAt: new Date().toISOString(),
        fromQueue: true,
      };
      // 다음 항목 시각 = 현재 + 사용자 지정 간격
      cursor += getIntervalMs();
      return item;
    });

    try {
      const existing = JSON.parse(localStorage.getItem('scheduledPosts') || '[]');
      localStorage.setItem('scheduledPosts', JSON.stringify([...existing, ...newSchedules]));
      alert(`✅ ${newSchedules.length}개 스케줄 추가됨\n첫 글: ${newSchedules[0].date} ${newSchedules[0].time}\n마지막: ${newSchedules[newSchedules.length - 1].date} ${newSchedules[newSchedules.length - 1].time}`);
      STATE.keywords = [];
      close();
      syncBadge();
    } catch (e) {
      alert('❌ 스케줄 저장 실패: ' + (e?.message || e));
    }
  });

  // 즉시 순차 발행 — 사용자가 선택한 발행 간격 사용
  document.getElementById('pq-action-publish')?.addEventListener('click', async () => {
    const enabled = STATE.keywords.filter(k => k.enabled && k.keyword.trim());
    if (enabled.length === 0) return alert('활성화된 키워드가 없습니다.');
    const intervalMs = getIntervalMs();
    const intervalLabel = intervalMs >= 3600_000
      ? `${(intervalMs / 3600_000).toFixed(1)}시간`
      : intervalMs >= 60_000
        ? `${(intervalMs / 60_000).toFixed(1)}분`
        : `${(intervalMs / 1000).toFixed(0)}초`;
    if (!confirm(`${enabled.length}개 키워드를 즉시 순차 발행합니다.\n각 글 사이 간격: ${intervalLabel}\n\n진행할까요?`)) return;
    close();

    for (let i = 0; i < enabled.length; i++) {
      const it = enabled[i];
      console.log(`[QUEUE] 🚀 ${i + 1}/${enabled.length}: ${it.keyword} (${it.mode}/${it.thumb}) — 다음까지 ${intervalLabel}`);
      const ta = document.getElementById('keywordInput');
      if (ta) ta.value = it.keyword;
      const cmSel = document.getElementById('contentMode');
      if (cmSel) cmSel.value = it.mode;
      const thumbSel = document.getElementById('thumbnailType');
      if (thumbSel) thumbSel.value = it.thumb;
      const btn = document.getElementById('publishBtn') || document.querySelector('[data-action="publish"]');
      if (btn) btn.click();
      // 마지막 항목은 대기하지 않음
      if (i < enabled.length - 1) {
        await new Promise(r => setTimeout(r, intervalMs));
      }
    }
    alert(`✅ 큐 ${enabled.length}개 발행 트리거 완료. 진행 상황은 로그/스케줄 탭에서 확인하세요.`);
  });
}

// ════════════════════════════════════════════
// 공개 API
// ════════════════════════════════════════════

/** 현재 textarea의 키워드들을 STATE에 누적 추가 (덮어쓰기 X, 중복 제거) */
function addCurrent() {
  const list = getKeywordsFromTextarea();
  if (list.length < 1) {
    alert('키워드를 1개 이상 입력해 주세요.');
    return;
  }

  const defaultMode = document.getElementById('contentMode')?.value || 'external';
  const defaultThumb = document.getElementById('thumbnailType')?.value || 'imagefx';
  const defaultCta = document.querySelector('input[name="ctaMode"]:checked')?.value || 'auto';

  // 기존 STATE에 있는 키워드 문자열 집합
  const existing = new Set(STATE.keywords.map(k => k.keyword.trim().toLowerCase()));
  let added = 0;
  let skipped = 0;

  list.forEach((kw, i) => {
    const norm = kw.trim().toLowerCase();
    if (!norm) return;
    if (existing.has(norm)) { skipped++; return; }
    existing.add(norm);
    STATE.keywords.push({
      id: `pq-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      keyword: kw.trim(),
      mode: defaultMode,
      thumb: defaultThumb,
      ctaMode: defaultCta,
      enabled: true,
    });
    added++;
  });

  // textarea 비우기 (다음 묶음 입력을 위해)
  const ta = document.getElementById('keywordInput');
  if (ta) ta.value = '';

  syncBadge();

  const msg = skipped > 0
    ? `✅ ${added}개 추가됨 (중복 ${skipped}개 제외)\n현재 대기열: 총 ${STATE.keywords.length}개`
    : `✅ ${added}개 추가됨\n현재 대기열: 총 ${STATE.keywords.length}개`;
  alert(msg);
}

function open() {
  // STATE가 비어있으면 textarea의 키워드로 초기 채움
  if (STATE.keywords.length === 0) {
    const list = getKeywordsFromTextarea();
    if (list.length < 1) {
      alert('대기열이 비어있습니다.\n키워드를 입력하고 "➕ 대기열에 추가"를 먼저 누르세요.');
      return;
    }
    const defaultMode = document.getElementById('contentMode')?.value || 'external';
    const defaultThumb = document.getElementById('thumbnailType')?.value || 'imagefx';
    const defaultCta = document.querySelector('input[name="ctaMode"]:checked')?.value || 'auto';
    STATE.keywords = list.map((kw, i) => ({
      id: `pq-${Date.now()}-${i}`,
      keyword: kw,
      mode: defaultMode,
      thumb: defaultThumb,
      ctaMode: defaultCta,
      enabled: true,
    }));
  }
  // STATE에 이미 항목이 있으면 그대로 사용 (덮어쓰기 X)

  // 모달 렌더
  let host = document.getElementById('publishQueueModal');
  if (host) host.remove();
  document.body.insertAdjacentHTML('beforeend', buildModalHtml());
  STATE.isOpen = true;
  refreshList();
  bindModalEvents();
  syncBadge();
}

function close() {
  const host = document.getElementById('publishQueueModal');
  if (host) host.remove();
  STATE.isOpen = false;
}

export function initPublishQueue() {
  // textarea 변경 감지 → 배지 표시/숨김 동기화
  const ta = document.getElementById('keywordInput');
  if (ta) {
    ta.addEventListener('input', syncBadge);
    ta.addEventListener('change', syncBadge);
    setTimeout(syncBadge, 200);
  }

  // 서브탭 (단일 / 연속) 토글 바인딩
  bindPublishModeTabs();

  // 전역 노출
  window.__publishQueue = { open, close, addCurrent, syncBadge, getCurrentMode, _state: STATE };
  console.log('[PUBLISH-QUEUE] ✅ 연속발행 대기열 모듈 + 서브탭 초기화 완료');
}
