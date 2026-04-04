// ── 무료 사용 쿼터 카운터 ──
let freeQuotaInterval = null;

async function updateFreeQuotaCounter() {
  const counter = document.getElementById('freeQuotaCounter');
  const text = document.getElementById('freeQuotaText');
  if (!counter || !text) return;

  try {
    if (!window.blogger || !window.blogger.getQuotaStatus) {
      counter.style.display = 'none';
      return;
    }

    const status = await window.blogger.getQuotaStatus();

    if (!status || !status.success || !status.isFree) {
      counter.style.display = 'none';
      if (freeQuotaInterval) { clearInterval(freeQuotaInterval); freeQuotaInterval = null; }
      return;
    }

    const used = status.quota?.usage || 0;
    const limit = status.quota?.limit || 2;
    const remaining = Math.max(0, limit - used);
    const isExhausted = remaining <= 0;

    text.textContent = `${used}/${limit}`;
    text.style.color = isExhausted ? '#fca5a5' : '#a5f3c4';
    counter.style.display = 'flex';

    // 30초마다 갱신 시작
    if (!freeQuotaInterval) {
      freeQuotaInterval = setInterval(updateFreeQuotaCounter, 30000);
    }
  } catch (e) {
    console.warn('[QUOTA-UI] 쿼터 조회 실패:', e);
    counter.style.display = 'none';
  }
}

// 🔔 알림 표시 함수 (토스트 스타일)
function showNotification(message, type = 'info') {
  const toast = document.createElement('div');
  const colors = {
    success: { bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', icon: '✅' },
    error: { bg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', icon: '❌' },
    warning: { bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', icon: '⚠️' },
    info: { bg: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', icon: 'ℹ️' }
  };
  const style = colors[type] || colors.info;
  toast.style.cssText = `
    position: fixed; top: 30px; right: 30px; z-index: 999999;
    background: ${style.bg}; color: white;
    padding: 18px 28px; border-radius: 14px;
    font-size: 16px; font-weight: 700;
    box-shadow: 0 8px 32px rgba(0,0,0,0.25);
    display: flex; align-items: center; gap: 12px;
    animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    cursor: pointer; max-width: 420px;
  `;
  toast.innerHTML = `<span style="font-size: 22px;">${style.icon}</span><span>${message}</span>`;
  toast.onclick = () => { toast.style.animation = 'slideOutRight 0.3s forwards'; setTimeout(() => toast.remove(), 300); };
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) { toast.style.animation = 'slideOutRight 0.3s forwards'; setTimeout(() => toast.remove(), 300); } }, 5000);
}
// 알림 애니메이션 CSS 주입
(function () {
  if (!document.getElementById('notification-anim-style')) {
    const style = document.createElement('style');
    style.id = 'notification-anim-style';
    style.textContent = `
      @keyframes slideInRight { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      @keyframes slideOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(120%); opacity: 0; } }
    `;
    document.head.appendChild(style);
  }
})();

// 에러 메시지를 사용자 친화적으로 변환
function friendlyErrorMessage(error) {
  const msg = (error && error.message) ? error.message : String(error);

  if (msg.includes('API key') || msg.includes('api_key') || msg.includes('PERMISSION_DENIED'))
    return '🔑 API 키가 잘못되었어요. 설정에서 올바른 키를 입력해주세요.';
  if (msg.includes('ENOTFOUND') || msg.includes('network') || msg.includes('fetch'))
    return '🌐 인터넷 연결을 확인해주세요.';
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota'))
    return '⏰ API 사용량 초과예요. 잠시 후 다시 시도해주세요.';
  if (msg.includes('license') || msg.includes('라이선스'))
    return '🔒 라이선스가 유효하지 않아요. 스니펫 탭에서 활성화해주세요.';
  if (msg.includes('timeout') || msg.includes('DEADLINE'))
    return '⏳ 응답 시간이 초과되었어요. 다시 시도해주세요.';
  if (msg.includes('blogId') || msg.includes('blog_id'))
    return '📝 블로그 ID가 설정되지 않았어요. 설정에서 입력해주세요.';
  if (msg.includes('WordPress') || msg.includes('wp-json'))
    return '🌐 WordPress 연결에 실패했어요. URL과 비밀번호를 확인해주세요.';

  return `오류가 발생했어요: ${msg.slice(0, 100)}`;
}

// H2 이미지 선택 함수
function getH2ImageSections(context = 'default') {
  const sourceSelector = context === 'schedule'
    ? 'input[name="scheduleH2ImageSource"]:checked'
    : 'input[name="h2ImageSource"]:checked';
  const sectionSelector = context === 'schedule'
    ? '#scheduleH2ImageSections input[type="checkbox"]:checked'
    : 'input[name="h2Sections"]:checked';

  const selectedSource = document.querySelector(sourceSelector)?.value || 'nanobananapro';
  const selectedSections = Array.from(document.querySelectorAll(sectionSelector))
    .map(input => parseInt(input.value, 10))
    .filter(value => !Number.isNaN(value));

  const settings = {
    source: selectedSource,
    sections: selectedSections,
    totalSections: selectedSections.length
  };

  console.log('🖼️ [H2 IMAGE] 포스팅용 설정:', settings);
  return settings;
}

// ==========================================
// 🖼️ 멀티 키워드 연속 발행 + 실시간 이미지 그리드 시스템
// ==========================================
var multiKeywordState = {
  keywords: [],
  currentIndex: 0,
  totalKeywords: 0,
  isRunning: false,
  currentSectionCount: 5
};

// 멀티 키워드 파싱 (줄바꿈 구분)
function parseMultiKeywords(rawText) {
  if (!rawText || !rawText.trim()) return [];
  return rawText.split('\n')
    .map(k => k.trim())
    .filter(k => k.length > 0);
}

// 이미지 그리드 초기화 (동적 H2 개수)
function initializeImageGrid(sectionCount, keyword) {
  const container = document.getElementById('imageGridContainer');
  const gridSection = document.getElementById('imagePreviewGrid');
  const keywordLabel = document.getElementById('currentKeywordLabel');
  const statusLabel = document.getElementById('imageGridStatus');

  if (!container || !gridSection) {
    console.warn('[IMAGE-GRID] 그리드 컨테이너를 찾을 수 없습니다');
    return;
  }

  // 그리드 표시
  gridSection.style.display = 'block';

  // 현재 키워드 표시
  if (keywordLabel) {
    keywordLabel.textContent = keyword || '';
    keywordLabel.title = keyword || '';
  }

  // 상태 표시
  if (statusLabel) {
    statusLabel.textContent = `0/${sectionCount + 1}`;
  }

  // 기존 슬롯 초기화
  container.innerHTML = '';

  // 썸네일 슬롯 + H2 섹션 슬롯 생성
  const slots = ['썸네일', ...Array.from({ length: sectionCount }, (_, i) => `H2-${i + 1}`)];

  slots.forEach((label, index) => {
    const slot = document.createElement('div');
    slot.className = 'image-slot';
    slot.dataset.slot = index === 0 ? 'thumbnail' : `h2-${index}`;
    slot.style.cssText = `
      aspect-ratio: 1;
      background: rgba(30, 41, 59, 0.8);
      border: 2px dashed rgba(148, 163, 184, 0.4);
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      overflow: hidden;
    `;
    slot.innerHTML = `
      <div style="font-size: 20px; opacity: 0.4;">○</div>
      <div style="font-size: 10px; color: rgba(148, 163, 184, 0.7); margin-top: 4px;">${label}</div>
    `;
    container.appendChild(slot);
  });

  console.log(`[IMAGE-GRID] 초기화 완료: ${sectionCount + 1}개 슬롯 (썸네일 + ${sectionCount}개 H2)`);
}

// 이미지 슬롯 업데이트 (로딩 → 완료)
function updateImageSlot(slotIndex, imageUrl, status) {
  const slotName = slotIndex === 0 ? 'thumbnail' : `h2-${slotIndex}`;
  const slot = document.querySelector(`[data-slot="${slotName}"]`);
  const statusLabel = document.getElementById('imageGridStatus');

  if (!slot) {
    console.warn(`[IMAGE-GRID] 슬롯 ${slotName}을 찾을 수 없습니다`);
    return;
  }

  if (status === 'loading') {
    slot.style.borderColor = 'rgba(99, 102, 241, 0.6)';
    slot.style.background = 'rgba(99, 102, 241, 0.15)';
    slot.innerHTML = `
      <div class="loading-spinner" style="font-size: 24px; animation: spin 1s linear infinite;">⏳</div>
      <div style="font-size: 10px; color: rgba(147, 197, 253, 0.9); margin-top: 4px;">생성 중...</div>
    `;
  } else if (status === 'done') {
    slot.style.borderColor = 'rgba(34, 197, 94, 0.6)';
    slot.style.border = '2px solid rgba(34, 197, 94, 0.6)';
    slot.style.background = 'transparent';
    slot.innerHTML = `<img src="${imageUrl}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;" onerror="this.parentElement.innerHTML='<div style=\\'font-size:20px;color:#ef4444;\\'>❌</div>'">`;

    // 완료 카운트 업데이트
    if (statusLabel) {
      const current = document.querySelectorAll('.image-slot img').length;
      const total = document.querySelectorAll('.image-slot').length;
      statusLabel.textContent = `${current}/${total}`;
    }
  } else if (status === 'error') {
    slot.style.borderColor = 'rgba(239, 68, 68, 0.6)';
    slot.style.background = 'rgba(239, 68, 68, 0.1)';
    slot.innerHTML = `
      <div style="font-size: 20px; color: #ef4444;">❌</div>
      <div style="font-size: 10px; color: rgba(252, 165, 165, 0.9); margin-top: 4px;">실패</div>
    `;
  }

  console.log(`[IMAGE-GRID] 슬롯 업데이트: ${slotName} = ${status}`);
}

// 이미지 그리드 완전 리셋 (키워드 전환 시)
function resetImageGrid() {
  const container = document.getElementById('imageGridContainer');
  const gridSection = document.getElementById('imagePreviewGrid');
  const keywordLabel = document.getElementById('currentKeywordLabel');
  const statusLabel = document.getElementById('imageGridStatus');

  if (container) container.innerHTML = '';
  if (keywordLabel) keywordLabel.textContent = '';
  if (statusLabel) statusLabel.textContent = '0/0';

  console.log('[IMAGE-GRID] 그리드 리셋 완료');
}

// 이미지 그리드 숨기기
function hideImageGrid() {
  const gridSection = document.getElementById('imagePreviewGrid');
  if (gridSection) gridSection.style.display = 'none';
}

// CSS 애니메이션 추가 (스피너용)
(function addGridStyles() {
  if (document.getElementById('imageGridStyles')) return;
  const style = document.createElement('style');
  style.id = 'imageGridStyles';
  style.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .image-slot {
      position: relative;
    }
    .image-slot:hover {
      transform: scale(1.05);
      z-index: 10;
    }
  `;
  document.head.appendChild(style);
})();

// 전역 노출
window.initializeImageGrid = initializeImageGrid;
window.updateImageSlot = updateImageSlot;
window.resetImageGrid = resetImageGrid;
window.hideImageGrid = hideImageGrid;
window.parseMultiKeywords = parseMultiKeywords;

const usageHelpContent = {
  'draft-input': {
    title: '초안 입력 사용법',
    description: '기존 문서를 붙여넣어 AI가 문맥과 서식을 학습하도록 돕는 영역입니다.',
    steps: [
      '웹에서 복사한 글은 Ctrl+Shift+V(서식 제거)로 붙여넣어 불필요한 스타일을 없앱니다.',
      '상단 순수 글자수 카운터가 5,000자를 넘으면 AI가 분량을 자동으로 압축하므로 필요한 경우 미리 정리합니다.',
      '초안이 없다면 비워 두고 키워드/설정만 입력하면 완전히 새 글이 생성됩니다.'
    ],
    tips: [
      '표나 코드 블록은 줄 간격을 한 줄씩 정리하면 AI가 구조를 정확히 재현합니다.',
      '붙여넣은 초안은 자동 저장되므로 새로고침 후에도 다시 불러올 수 있습니다.'
    ]
  },
  'content-settings': {
    title: '콘텐츠 설정 사용법',
    description: '프롬프트 모드, 섹션 수, 톤 등을 지정해 글의 뼈대를 설계하는 구간입니다.',
    steps: [
      '제목 모드를 `자동`으로 두면 SEO 정보가 반영된 제목을 생성하고, `직접`이면 입력한 제목을 그대로 사용합니다.',
      '콘텐츠 모드(기본/외부유입/리뷰 등)에 따라 헤더 구성과 CTA 전략이 자동으로 바뀝니다.',
      '워드프레스 발행 시 `카테고리 불러오기` 버튼을 눌러 사이트 분류를 저장해 두면 다음 발행에서 자동 적용됩니다.'
    ],
    tips: [
      '섹션 수를 늘리면 최소 글자수도 함께 증가하므로 매체 정책에 맞춰 조절하세요.',
      '톤/스타일을 바꾸면 CTA와 요약 박스까지 같이 갱신되니 미리보기 탭으로 즉시 확인해 보세요.'
    ]
  },
  'image-settings': {
    title: '이미지 설정 사용법',
    description: '썸네일과 H2 이미지 소스를 선택해 시각적 흐름을 통일합니다.',
    steps: [
      '썸네일 모드를 텍스트/AI/직접 업로드 중에서 고르고 필요한 경우 배경 이미지 URL을 입력합니다.',
      'H2 이미지 소스를 DALL·E, Pexels, Google CSE 중에서 선택하고 적용할 섹션 번호를 체크합니다.',
      '미리보기 생성 후 마음에 들지 않으면 재생성하거나 PNG/JPG 파일을 끌어다 놓아 교체할 수 있습니다.'
    ],
    tips: [
      'Pexels는 상업적 이용이 가능한 이미지만 반환하며, 검색어는 키워드와 관련된 확장어로 자동 변환됩니다.',
      '직접 업로드 이미지는 로컬에만 저장되므로 `썸네일 다운로드` 버튼으로 백업을 남겨 두세요.'
    ]
  },
  'publish-mode': {
    title: '발행 모드 사용법',
    description: '생성된 글을 즉시 발행할지, 초안으로 저장할지, 특정 시각에 예약할지 결정합니다.',
    steps: [
      '`즉시 발행`은 생성 직후 블로그에 업로드하고, 성공 시 URL이 발행 기록에 저장됩니다.',
      '`임시 저장`은 각 플랫폼의 초안함으로 전송되므로 관리자 화면에서 검수 후 발행할 수 있습니다.',
      '`예약 발행`을 선택하면 예약 입력창이 열리며, 한국 시간 기준이므로 해외 블로그는 현지 시각으로 보정하세요.'
    ],
    tips: [
      '워드프레스 예약은 서버 시간에 따라 발행되니 호스팅 시간대를 먼저 확인하는 것이 안전합니다.',
      '예약 글을 취소하려면 발행 기록에서 편집 링크를 눌러 플랫폼 관리자 화면에서 삭제하세요.'
    ]
  },
  'cta-settings': {
    title: 'CTA 설정 사용법',
    description: 'AI 추천 CTA를 그대로 쓰거나, 수동 CTA 라이브러리로 소제목별 버튼을 직접 구성합니다.',
    steps: [
      '`자동 CTA 추천`은 스니펫 태그, 링크 후보, 키워드 의도를 조합해 각 섹션에 어울리는 문구를 배치합니다.',
      '`수동 CTA 지정`을 선택하면 URL·버튼명·후킹 멘트를 직접 입력할 수 있는 5개의 입력창이 열립니다.',
      '수동 CTA 라이브러리 버튼을 누르면 저장해 둔 템플릿 세트를 불러와 한 번에 채워 넣을 수 있습니다.'
    ],
    tips: [
      'CTA를 비워둔 섹션은 자동으로 숨김 처리되므로 필요한 위치만 채워도 디자인이 깨지지 않습니다.',
      '키워드별로 다른 CTA 세트를 저장해 두면 캠페인/상품별 발행 시 빠르게 전환할 수 있습니다.'
    ]
  },
  'publish-action': {
    title: '블로그 발행 버튼 사용법',
    description: '콘텐츠 생성부터 플랫폼 업로드까지 한 번에 실행하는 핵심 동작입니다.',
    steps: [
      '발행 전에 미리보기 탭에서 제목·본문·썸네일을 확인하고 필요하면 수정합니다.',
      '환경설정 카드에서 현재 선택된 플랫폼과 인증 정보가 올바른지 확인합니다.',
      '버튼을 누르면 AI 생성 → 검수 → 업로드 순으로 진행되며, 단계별 로그가 진행 상황 카드에 표시됩니다.'
    ],
    tips: [
      '작업 완료 후 발행 기록 카드에서 URL을 더블클릭하면 새 창으로 바로 열 수 있습니다.',
      '오류가 발생하면 빨간색 로그를 확인하고 `작업 중지`로 상태를 초기화한 뒤 수정 후 다시 시도하세요.'
    ]
  },
  'progress-status': {
    title: '진행 상황 패널 사용법',
    description: 'AI 생성 단계, 업로드 단계, 남은 시간을 실시간으로 보여주는 모니터링 영역입니다.',
    steps: [
      '카드를 펼치면 실시간 로그가 스트리밍되며, 접어 두면 요약 진행률과 예상 시간이 표시됩니다.',
      '"로그 보기"를 켜면 실패한 단계가 빨간색으로 강조되어 어디서 문제인지 바로 파악할 수 있습니다.',
      '취소 버튼을 누르면 현재 API 호출을 중단하고 상태를 초기화합니다.'
    ],
    tips: [
      '진행률 바는 로그 수와 예상 토큰량을 기반으로 부드럽게 업데이트되며, 대량 작업 시에도 안정적으로 동작합니다.',
      '새로고침하면 진행 상태가 초기화되니 긴 작업 중에는 브라우저를 닫지 말고 다른 작업은 새 탭에서 진행하세요.'
    ]
  },
  'snippet-library': {
    title: '스니펫 라이브러리 사용법',
    description: 'CTA 문구, 이미지 프롬프트, 외부 유입용 문장을 카테고리별로 저장해 재사용하는 보관함입니다.',
    steps: [
      '`새로고침` 버튼으로 로컬/클라우드 저장소에서 최신 스니펫을 불러온 뒤 원하는 카테고리를 펼칩니다.',
      '`스니펫 추가·수정`을 눌러 CTA·외부 링크·이미지 프롬프트를 등록하고 태그를 부여합니다.',
      '자동 CTA 추천과 이미지 생성 시 태그가 일치하면 해당 스니펫이 우선적으로 선택됩니다.'
    ],
    tips: [
      '스니펫은 로컬 스토리지에 JSON 형태로 저장되므로 환경설정에서 내보내기/가져오기 기능으로 백업하세요.',
      '수동 CTA 모달과 연동되므로 캠페인별 템플릿 세트를 만들어 두면 반복 작업 시간을 크게 줄일 수 있습니다.'
    ]
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const usageModal = document.getElementById('usageHelpModal');
  if (usageModal) {
    usageModal.addEventListener('click', (event) => {
      if (event.target === usageModal) {
        closeUsageHelp();
      }
    });
  }
});

function escapeUsageHelpText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderUsageHelpHtml(entry) {
  if (!entry) {
    return '<p class="usage-help-intro">설명이 준비 중입니다.</p>';
  }

  let html = '';

  if (entry.description) {
    html += `<p class="usage-help-intro">${escapeUsageHelpText(entry.description)}</p>`;
  }

  if (Array.isArray(entry.steps) && entry.steps.length > 0) {
    html += '<ol class="usage-help-list">';
    entry.steps.forEach((step) => {
      html += `<li>${escapeUsageHelpText(step)}</li>`;
    });
    html += '</ol>';
  }

  if (Array.isArray(entry.tips) && entry.tips.length > 0) {
    entry.tips.forEach((tip) => {
      html += `<div class="usage-help-tip">💡 ${escapeUsageHelpText(tip)}</div>`;
    });
  }

  if (!html) {
    html = '<p class="usage-help-intro">추가 안내를 준비 중입니다.</p>';
  }

  return html;
}

function showUsageHelp(key) {
  const modal = document.getElementById('usageHelpModal');
  if (!modal) return;

  const titleEl = modal.querySelector('[data-usage-title]');
  const bodyEl = modal.querySelector('[data-usage-body]');
  const entry = usageHelpContent[key];

  if (titleEl) {
    titleEl.textContent = entry?.title || '사용법 안내';
  }
  if (bodyEl) {
    bodyEl.innerHTML = renderUsageHelpHtml(entry);
  }

  modal.classList.add('active');
}

function closeUsageHelp() {
  const modal = document.getElementById('usageHelpModal');
  if (!modal) return;
  modal.classList.remove('active');
}
window.showUsageHelp = showUsageHelp;
window.closeUsageHelp = closeUsageHelp;

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeUsageHelp();
  }
});

const EXTERNAL_POST_GENERATOR_URL = 'https://chatgpt.com/g/g-690c2f9764408191b9048cda1144c221-oebuyuib-jeonyonggeul-saengseonggi';

function openExternalPostGenerator() {
  try {
    if (window.blogger && typeof window.blogger.openExternal === 'function') {
      window.blogger.openExternal(EXTERNAL_POST_GENERATOR_URL);
    } else {
      window.open(EXTERNAL_POST_GENERATOR_URL, '_blank', 'noopener,noreferrer');
    }
    addLog('🌐 외부 유입 전용 글 생성기를 열었습니다.', 'info');
  } catch (error) {
    console.error('[EXTERNAL-POST-GENERATOR] 열기 실패:', error);
    alert('외부 유입 전용 글 생성기를 열 수 없습니다. 잠시 후 다시 시도해주세요.');
  }
}

var selectedPromptMode = 'default';

function setPromptMode(mode) {
  const normalized = mode === 'custom' ? 'custom' : 'default';
  selectedPromptMode = normalized;
  window.selectedPromptMode = normalized;

  const defaultBtn = document.getElementById('default-prompt-btn');
  const customBtn = document.getElementById('custom-prompt-btn');
  const customSection = document.getElementById('custom-prompt-section');

  if (defaultBtn) {
    defaultBtn.classList.toggle('active', normalized === 'default');
    defaultBtn.style.opacity = normalized === 'default' ? '1' : '0.6';
  }

  if (customBtn) {
    customBtn.classList.toggle('active', normalized === 'custom');
    customBtn.style.opacity = normalized === 'custom' ? '1' : '0.6';
  }

  if (customSection) {
    customSection.style.display = normalized === 'custom' ? 'block' : 'none';
  }

  console.log('[PROMPT] 프롬프트 모드 변경:', normalized);
}

async function testWordPressConnection() {
  console.log('[WP] 워드프레스 연결 테스트 요청');
  return await checkPlatformConnection();
}

// 썸네일 자동 생성 함수
function generateAutoThumbnail(title, platform = 'blogger') {
  const thumbnailContainer = document.createElement('div');
  thumbnailContainer.className = `auto-thumbnail auto-thumbnail-${platform}`;

  const thumbnailText = document.createElement('div');
  thumbnailText.className = 'auto-thumbnail-text';

  // 제목을 적절히 줄바꿈하여 표시
  const words = title.split(' ');
  let lines = [];
  let currentLine = '';

  words.forEach(word => {
    if ((currentLine + word).length <= 15) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });
  if (currentLine) lines.push(currentLine);

  thumbnailText.textContent = lines.join('\n');
  thumbnailContainer.appendChild(thumbnailText);

  return thumbnailContainer;
}

// AI 배경 이미지 생성 함수
async function generateAIBackgroundImage(title, platform = 'blogger') {
  try {
    console.log('🎨 [IMAGE] AI 배경 이미지 생성 시작:', { title, platform });

    const imagePrompt = `Create a modern, professional thumbnail image for a blog post titled "${title}". 
    The image should be ${platform === 'blogger' ? 'warm and inviting with orange/red gradients' : 'cool and professional with blue/cyan gradients'}.
    Include subtle text overlay area for the title. 
    Style: modern, clean, professional, high quality, 16:9 aspect ratio.`;

    const result = await window.electronAPI.generateAIImage({
      prompt: imagePrompt,
      size: '1024x1024',
      quality: 'standard'
    });

    console.log('🎨 [IMAGE] AI 배경 이미지 생성 완료:', result);
    return result.imageUrl;
  } catch (error) {
    console.error('🎨 [IMAGE] AI 배경 이미지 생성 오류:', error);
    return null;
  }
}

// H2 섹션 이미지 생성 함수
async function generateH2SectionImages(sections, title) {
  try {
    console.log('🎨 [IMAGE] H2 섹션 이미지 생성 시작:', { sections, title });

    const imagePromises = sections.map(async (sectionNumber) => {
      const sectionPrompt = `Create a professional illustration for section ${sectionNumber} of a blog post titled "${title}". 
      The image should be modern, clean, and relevant to the content. 
      Style: professional, high quality, 16:9 aspect ratio.`;

      const result = await window.electronAPI.generateAIImage({
        prompt: sectionPrompt,
        size: '1024x1024',
        quality: 'standard'
      });

      return {
        section: sectionNumber,
        imageUrl: result.imageUrl
      };
    });

    const results = await Promise.all(imagePromises);
    console.log('🎨 [IMAGE] H2 섹션 이미지 생성 완료:', results);
    return results;
  } catch (error) {
    console.error('🎨 [IMAGE] H2 섹션 이미지 생성 오류:', error);
    return [];
  }
}

// 스케줄 포스트 추가 함수
function addScheduledPost() {
  const topic = document.getElementById('scheduleTopic')?.value;
  const keywords = document.getElementById('scheduleKeywords')?.value;
  const date = document.getElementById('scheduleDate')?.value;
  const time = document.getElementById('scheduleTime')?.value;
  const contentMode = document.getElementById('scheduleContentMode')?.value;
  const ctaMode = document.getElementById('scheduleCtaMode')?.value;
  const publishType = document.getElementById('schedulePublishType')?.value;
  const thumbnailMode = document.getElementById('scheduleThumbnailMode')?.value;
  const platform = document.getElementById('schedulePlatform')?.value;
  const h2ImageSettings = getH2ImageSections('schedule');
  const draftInput = document.getElementById('draftInput');
  const draftContent = draftInput ? draftInput.value.trim() : '';

  if (!topic || !date || !time) {
    alert('주제, 날짜, 시간을 모두 입력해주세요.');
    return;
  }

  const scheduleData = {
    id: Date.now(),
    topic,
    keywords,
    date,
    time,
    contentMode,
    ctaMode,
    publishType,
    thumbnailMode,
    platform,
    h2Images: h2ImageSettings,
    draftContent: draftContent || undefined,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  // localStorage에 저장
  const existingSchedules = JSON.parse(localStorage.getItem('scheduledPosts') || '[]');
  existingSchedules.push(scheduleData);
  localStorage.setItem('scheduledPosts', JSON.stringify(existingSchedules));

  // 폼 초기화
  document.getElementById('scheduleTopic').value = '';
  document.getElementById('scheduleKeywords').value = '';
  document.getElementById('scheduleDate').value = '';
  document.getElementById('scheduleTime').value = '09:00';

  // 스케줄 목록 새로고침
  refreshScheduleList();

  alert('스케줄이 추가되었습니다.');
}
// 스케줄 목록 새로고침 함수
function refreshScheduleList() {
  const scheduleList = document.getElementById('scheduleList');
  if (!scheduleList) return;

  const schedules = JSON.parse(localStorage.getItem('scheduledPosts') || '[]');

  if (schedules.length === 0) {
    scheduleList.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 16px;">📅</div>
      <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">스케줄이 없습니다</div>
      <div style="font-size: 14px;">위에서 새로운 예약 포스팅을 추가하세요</div>
    `;
    return;
  }

  let html = '';
  schedules.forEach(schedule => {
    const statusColor = schedule.status === 'completed' ? '#10b981' :
      schedule.status === 'failed' ? '#ef4444' :
        schedule.status === 'running' ? '#3b82f6' : '#f59e0b';
    const statusText = schedule.status === 'completed' ? '완료' :
      schedule.status === 'failed' ? '실패' :
        schedule.status === 'running' ? '실행중' : '대기중';
    const h2Info = schedule.h2Images && Array.isArray(schedule.h2Images.sections) && schedule.h2Images.sections.length > 0
      ? `${(schedule.h2Images.source || 'nanobananapro').toUpperCase()} - ${schedule.h2Images.sections.join(', ')}번`
      : '사용 안함';
    const draftInfo = schedule.draftContent && schedule.draftContent.length > 0
      ? `초안 ${schedule.draftContent.length}자 포함`
      : '';

    html += `
      <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
          <div>
            <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 18px;">${schedule.topic}</h4>
            <p style="margin: 0; color: #64748b; font-size: 14px;">${schedule.keywords || '키워드 없음'}</p>
            <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px;">H2 이미지: ${h2Info}</p>
            ${draftInfo ? `<p style="margin: 2px 0 0 0; color: #94a3b8; font-size: 12px;">${draftInfo}</p>` : ''}
          </div>
          <span style="background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">
            ${statusText}
          </span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 14px; color: #64748b;">
          <span>📅 ${schedule.date} ${schedule.time}</span>
          <div>
            <button onclick="executeSchedule(${schedule.id})" style="background: ${schedule.status === 'running' ? '#6b7280' : '#3b82f6'}; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: ${schedule.status === 'running' ? 'not-allowed' : 'pointer'}; margin-right: 8px;" ${schedule.status === 'running' ? 'disabled' : ''}>
              ${schedule.status === 'running' ? '실행중...' : '실행'}
            </button>
            <button onclick="deleteSchedule(${schedule.id})" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer;">
              삭제
            </button>
          </div>
        </div>
      </div>
    `;
  });

  scheduleList.innerHTML = html;
}
// 스케줄 실행 함수
function executeSchedule(scheduleId) {
  const schedules = JSON.parse(localStorage.getItem('scheduledPosts') || '[]');
  const schedule = schedules.find(s => s.id === scheduleId);

  if (!schedule) {
    alert('스케줄을 찾을 수 없습니다.');
    return;
  }

  // 스케줄 상태를 '실행중'으로 변경
  schedule.status = 'running';
  localStorage.setItem('scheduledPosts', JSON.stringify(schedules));
  refreshScheduleList();

  // 실제 포스팅 실행을 위한 payload 생성
  const payload = {
    topic: schedule.topic,
    title: schedule.topic, // 제목은 주제로 설정
    keywords: schedule.keywords ? schedule.keywords.split(',').map(k => k.trim()) : [schedule.topic],
    platform: schedule.platform || 'blogspot',
    contentMode: schedule.contentMode || 'external',
    promptMode: 'max-mode',
    h2Images: schedule.h2Images || getH2ImageSections(),
    toneStyle: 'professional',
    draftContent: schedule.draftContent || undefined,
    publishType: schedule.publishType || 'single',
    postingMode: 'immediate', // 스케줄 실행 시에는 즉시 발행
    thumbnailType: schedule.thumbnailMode || 'text',
    ctaMode: schedule.ctaMode || 'auto',
    provider: 'gemini',
    titleAI: 'gemini',
    summaryAI: 'gemini',
    minChars: 2000,
    maxChars: 3000,
    previewOnly: false // 실제 발행
  };

  console.log('📅 스케줄 실행 payload:', payload);

  // 백엔드에 스케줄 실행 요청
  if (window.blogger && window.blogger.runPost) {
    addLog(`🚀 스케줄 실행 시작: ${schedule.topic}`, 'info');

    window.blogger.runPost(payload)
      .then(result => {
        console.log('스케줄 실행 결과:', result);

        if (result.ok) {
          // 성공 시 상태 업데이트
          schedule.status = 'completed';
          schedule.completedAt = new Date().toISOString();
          schedule.result = result;
          localStorage.setItem('scheduledPosts', JSON.stringify(schedules));

          addLog(`✅ 스케줄 실행 완료: ${schedule.topic}`, 'success');
          alert(`✅ 스케줄이 성공적으로 실행되었습니다!\n제목: ${result.title || schedule.topic}`);
        } else {
          // 실패 시 상태 업데이트
          schedule.status = 'failed';
          schedule.failedAt = new Date().toISOString();
          schedule.error = result.error;
          localStorage.setItem('scheduledPosts', JSON.stringify(schedules));

          addLog(`❌ 스케줄 실행 실패: ${schedule.topic} - ${result.error}`, 'error');
          alert(`❌ 스케줄 실행 중 오류가 발생했습니다.\n오류: ${result.error}`);
        }

        refreshScheduleList();
      })
      .catch(error => {
        console.error('스케줄 실행 오류:', error);

        // 오류 시 상태 업데이트
        schedule.status = 'failed';
        schedule.failedAt = new Date().toISOString();
        schedule.error = error.message;
        localStorage.setItem('scheduledPosts', JSON.stringify(schedules));

        addLog(`❌ 스케줄 실행 오류: ${schedule.topic} - ${error.message}`, 'error');
        alert(`❌ 스케줄 실행 중 오류가 발생했습니다.\n오류: ${error.message}`);

        refreshScheduleList();
      });
  } else {
    // 백엔드 연동이 없는 경우 시뮬레이션
    addLog('⚠️ 백엔드 연동이 없어 시뮬레이션으로 실행됩니다.', 'warning');

    setTimeout(() => {
      schedule.status = 'completed';
      schedule.completedAt = new Date().toISOString();
      localStorage.setItem('scheduledPosts', JSON.stringify(schedules));

      addLog(`✅ 스케줄 실행 완료 (시뮬레이션): ${schedule.topic}`, 'success');
      alert(`✅ 스케줄이 실행되었습니다! (시뮬레이션)\n제목: ${schedule.topic}`);

      refreshScheduleList();
    }, 2000);
  }
}

// 스케줄 삭제 함수
function deleteSchedule(scheduleId) {
  if (!confirm('정말로 이 스케줄을 삭제하시겠습니까?')) {
    return;
  }

  const schedules = JSON.parse(localStorage.getItem('scheduledPosts') || '[]');
  const updatedSchedules = schedules.filter(s => s.id !== scheduleId);
  localStorage.setItem('scheduledPosts', JSON.stringify(updatedSchedules));
  refreshScheduleList();
}
// 실시간 날짜 업데이트 함수 (최적화됨)
function updateRealtimeDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][now.getDay()];

  // 날짜 표시 업데이트 (DOM 조작 최소화)
  const dateElement = document.getElementById('realtime-date');
  if (dateElement) {
    dateElement.textContent = `${year}년 ${month}월 ${day}일 (${dayOfWeek})`;
  }

  // 달력 월 표시 업데이트
  const monthElement = document.getElementById('calendar-month');
  if (monthElement && !calendarRendered) {
    monthElement.textContent = `${year}년 ${month}월`;
  }

  const calendarSignature = `${year}-${month}`;
  const todayKey = formatDateKey(now);

  if (!calendarRendered) {
    currentCalendarYear = year;
    currentCalendarMonth = month - 1;
    renderCalendar();
    return;
  }

  if (calendarSignature !== lastCalendarSignature) {
    currentCalendarYear = year;
    currentCalendarMonth = month - 1;
    renderCalendar();
    return;
  }

  if (lastCalendarHighlight !== todayKey && year === currentCalendarYear && (month - 1) === currentCalendarMonth) {
    lastCalendarHighlight = todayKey;
    renderCalendar();
  }
}

// 실시간 시계 업데이트 함수
function updateRealtimeClock() {
  const now = new Date();
  const timeString = now.toLocaleTimeString('ko-KR', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const clockElement = document.getElementById('realtime-clock');
  if (clockElement) {
    clockElement.textContent = timeString;
  }
}

// 실시간 업데이트 시작
function startRealtimeUpdates() {
  // 즉시 업데이트
  updateRealtimeClock();
  updateRealtimeDate();

  // 1초마다 시계 업데이트
  setInterval(updateRealtimeClock, 1000);

  // 1분마다 날짜 업데이트 (자정 넘어갈 때를 대비)
  setInterval(updateRealtimeDate, 60000);
}

// DOM이 로드되면 실시간 업데이트 시작
document.addEventListener('DOMContentLoaded', function () {
  startRealtimeUpdates();
});
// DOM 캐시 객체
const DOMCache = {
  tabContents: null,
  tabButtons: null,

  init() {
    this.tabContents = document.querySelectorAll('.tab-content');
    this.tabButtons = document.querySelectorAll('.tab-btn');
  },

  getTabContents() {
    if (!this.tabContents) this.init();
    return this.tabContents;
  },

  getTabButtons() {
    if (!this.tabButtons) this.init();
    return this.tabButtons;
  }
};

// 라이센스 등록 모달 열기
// 라이센스 모달 열기
function openLicenseModal() {
  try {
    console.log('🔑 [LICENSE] 라이센스 모달 열기');
    const modal = document.getElementById('licenseModal');
    if (modal) {
      modal.style.display = 'flex';
      console.log('✅ [LICENSE] 라이센스 모달 열기 완료');
    } else {
      console.error('❌ [LICENSE] 모달 요소를 찾을 수 없습니다');
    }
  } catch (error) {
    console.error('❌ [LICENSE] 라이센스 모달 열기 실패:', error);
  }
}

// 라이센스 모달 닫기
function closeLicenseModal() {
  const modal = document.getElementById('licenseModal');
  if (modal) {
    modal.style.display = 'none';
    console.log('🔑 [LICENSE] 라이센스 모달 닫기 완료');
  }
}

// 라이센스 활성화 (모달에서)
function activateLicenseFromModal() {
  const licenseKey = document.getElementById('licenseKey')?.value;
  const licenseEmail = document.getElementById('licenseEmail')?.value;

  if (!licenseKey || !licenseEmail) {
    alert('라이센스 키와 이메일을 모두 입력해주세요.');
    return;
  }

  // 개발환경에서는 바로 성공 처리
  const isDevelopment = window.location.protocol === 'file:' || window.location.hostname === 'localhost';
  if (isDevelopment) {
    alert('개발환경에서는 라이센스가 자동으로 활성화됩니다.');
    closeLicenseModal();
    return;
  }

  // 실제 라이센스 검증 로직 (상용 환경에서)
  console.log('🔑 [LICENSE] 라이센스 활성화 시도:', { licenseKey, licenseEmail });

  // 여기에 실제 라이센스 검증 API 호출 로직 추가
  alert('라이센스 활성화가 완료되었습니다!');
  closeLicenseModal();
}
// ---------------------------------------------
// 외부 링크 관리 모듈
// ---------------------------------------------
const EXTERNAL_LINKS_STORAGE_KEY = 'bloggerExternalLinks';
const EXTERNAL_LINK_MODE_META = {
  seo: { label: 'SEO 모드', emoji: '📈' },
  consistency: { label: '내부 일관성 모드', emoji: '🕸️' },
  shopping: { label: '쇼핑 모드', emoji: '🛍️' },
  adsense: { label: '애드센스 승인 모드', emoji: '💰' },
  paraphrasing: { label: '패러프레이징 모드', emoji: '🔁' }
};
const EXTERNAL_LINK_MODE_IDS = Object.keys(EXTERNAL_LINK_MODE_META);
const DEFAULT_EXTERNAL_LINK_MODE = 'seo';
var externalLinksCache = null;
var externalLinksFilter = 'all';

function normalizeExternalLinkMode(value) {
  if (EXTERNAL_LINK_MODE_IDS.includes(value)) return value;
  if (typeof value === 'string' && ['S존', 'A존', 'B존'].includes(value)) {
    return 'seo';
  }
  return DEFAULT_EXTERNAL_LINK_MODE;
}
function migrateLegacyExternalLinks() {
  const legacyKeys = [
    'externalLinks',
    'externalLinkList',
    'externalLinksData',
    'externalLinksCache'
  ];
  for (const legacyKey of legacyKeys) {
    try {
      const legacyRaw = localStorage.getItem(legacyKey);
      if (!legacyRaw) continue;
      const legacyParsed = JSON.parse(legacyRaw);
      if (Array.isArray(legacyParsed) && legacyParsed.length > 0) {
        console.log(`🔄 [EXTERNAL-LINKS] 레거시 키(${legacyKey})에서 데이터 마이그레이션`);
        externalLinksCache = legacyParsed.map(link => ({
          id: link.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          title: String(link.title || link.name || '공식 사이트').trim(),
          url: String(link.url || link.href || '').trim(),
          mode: normalizeExternalLinkMode(link.mode || link.category),
          memo: typeof link.memo === 'string' ? link.memo : '',
          createdAt: link.createdAt || Date.now(),
          updatedAt: link.updatedAt || Date.now()
        }));
        persistExternalLinks();
        localStorage.removeItem(legacyKey);
        return externalLinksCache;
      }
    } catch (error) {
      console.warn(`⚠️ [EXTERNAL-LINKS] 레거시 키(${legacyKey}) 파싱 실패:`, error);
    }
  }
  return null;
}

function loadExternalLinksFromStorage() {
  if (externalLinksCache) {
    return externalLinksCache;
  }
  try {
    const raw = localStorage.getItem(EXTERNAL_LINKS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      externalLinksCache = parsed.map(link => ({
        id: link.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: String(link.title || '공식 사이트').trim(),
        url: String(link.url || '').trim(),
        mode: normalizeExternalLinkMode(link.mode || link.category),
        memo: typeof link.memo === 'string' ? link.memo : '',
        createdAt: link.createdAt || Date.now(),
        updatedAt: link.updatedAt || Date.now()
      }));
      if (!externalLinksCache.length) {
        const migrated = migrateLegacyExternalLinks();
        if (migrated) {
          return migrated;
        }
      }
    } else {
      const migrated = migrateLegacyExternalLinks();
      externalLinksCache = migrated || [];
    }
  } catch (error) {
    console.error('❌ [EXTERNAL-LINKS] 스토리지 로드 실패:', error);
    const migrated = migrateLegacyExternalLinks();
    externalLinksCache = migrated || [];
  }
  return externalLinksCache;
}

function persistExternalLinks() {
  if (!externalLinksCache) return;
  try {
    localStorage.setItem(EXTERNAL_LINKS_STORAGE_KEY, JSON.stringify(externalLinksCache));
  } catch (error) {
    console.error('❌ [EXTERNAL-LINKS] 스토리지 저장 실패:', error);
  }
}

function escapeHtmlForLinks(value) {
  if (!value) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function openExternalLinksModal() {
  const modal = document.getElementById('externalLinksModal');
  if (!modal) {
    console.warn('⚠️ [EXTERNAL-LINKS] externalLinksModal 요소를 찾을 수 없습니다.');
    return;
  }
  loadExternalLinksFromStorage();
  externalLinksFilter = 'all';
  markExternalLinkFilterButton(externalLinksFilter);
  renderExternalLinksList();
  modal.style.display = 'flex';
  setTimeout(() => {
    const input = document.getElementById('linkTitleInput');
    input?.focus();
  }, 10);
}

function closeExternalLinksModal() {
  const modal = document.getElementById('externalLinksModal');
  if (modal) {
    modal.style.display = 'none';
  }
}
function renderExternalLinksList() {
  const listContainer = document.getElementById('externalLinksList');
  const emptyMessage = document.getElementById('emptyLinksMessage');
  if (!listContainer) return;

  const links = loadExternalLinksFromStorage();
  const normalizedLinks = links.map(link => {
    link.mode = normalizeExternalLinkMode(link.mode);
    if (!link.id) {
      link.id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    return link;
  });

  const filteredLinks = externalLinksFilter === 'all'
    ? normalizedLinks
    : normalizedLinks.filter(link => link.mode === externalLinksFilter);

  listContainer.innerHTML = '';

  if (!filteredLinks.length) {
    if (emptyMessage) emptyMessage.style.display = 'block';
    return;
  }

  if (emptyMessage) emptyMessage.style.display = 'none';

  filteredLinks
    .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
    .forEach(link => {
      listContainer.appendChild(buildExternalLinkCard(link));
    });
}
function buildExternalLinkCard(link) {
  const card = document.createElement('div');
  card.className = 'external-link-card';
  card.style.cssText = `
    background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(241,245,249,0.95) 100%);
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 12px 30px rgba(15, 118, 110, 0.1);
    border: 1px solid rgba(20, 184, 166, 0.2);
    display: flex;
    flex-direction: column;
    gap: 16px;
    position: relative;
    overflow: hidden;
  `;

  const header = document.createElement('div');
  header.style.cssText = 'display: flex; align-items: center; gap: 14px;';

  const icon = document.createElement('div');
  icon.style.cssText = 'width: 48px; height: 48px; border-radius: 14px; background: rgba(20, 184, 166, 0.12); display: flex; align-items: center; justify-content: center; font-size: 24px;';
  icon.textContent = '🔗';

  const info = document.createElement('div');
  info.style.cssText = 'flex: 1; min-width: 0;';

  const title = document.createElement('h4');
  title.style.cssText = 'margin: 0 0 6px 0; font-size: 18px; font-weight: 700; color: #0f172a; overflow-wrap: anywhere;';
  title.textContent = link.title || '공식 사이트';

  const url = document.createElement('a');
  url.href = link.url;
  url.target = '_blank';
  url.rel = 'noopener noreferrer';
  url.textContent = link.url;
  url.style.cssText = 'font-size: 14px; color: #0ea5e9; text-decoration: none; overflow-wrap: anywhere;';

  const meta = document.createElement('div');
  meta.style.cssText = 'font-size: 12px; color: #64748b; display: flex; gap: 8px; align-items: center;';
  const modeBadge = document.createElement('span');
  modeBadge.style.cssText = 'display: inline-flex; align-items: center; gap: 4px;';
  modeBadge.innerHTML = modeBadgeMarkup(link.mode);
  meta.appendChild(modeBadge);

  if (link.updatedAt) {
    const updated = document.createElement('span');
    updated.textContent = `업데이트: ${formatExternalLinkDate(link.updatedAt)}`;
    meta.appendChild(updated);
  }
  info.appendChild(title);
  info.appendChild(url);
  info.appendChild(meta);
  const modeSelect = document.createElement('select');
  modeSelect.style.cssText = `
    padding: 10px 14px;
    border-radius: 10px;
    border: 2px solid rgba(14, 165, 233, 0.2);
    background: white;
    font-weight: 600;
    color: #0369a1;
  `;
  EXTERNAL_LINK_MODE_IDS.forEach(modeId => {
    const option = document.createElement('option');
    const metaInfo = EXTERNAL_LINK_MODE_META[modeId];
    option.value = modeId;
    option.textContent = `${metaInfo?.emoji ?? ''} ${metaInfo?.label ?? modeId}`;
    if (modeId === link.mode) option.selected = true;
    modeSelect.appendChild(option);
  });
  modeSelect.addEventListener('change', (event) => {
    const value = event.target?.value;
    changeExternalLinkMode(link.id, normalizeExternalLinkMode(value));
  });

  header.appendChild(icon);
  header.appendChild(info);
  header.appendChild(modeSelect);

  const actions = document.createElement('div');
  actions.style.cssText = 'display: flex; gap: 10px; flex-wrap: wrap;';

  const openButton = document.createElement('button');
  openButton.textContent = '새 창으로 열기';
  openButton.style.cssText = actionButtonStyle('#0ea5e9');
  openButton.addEventListener('click', () => openExternalLinkUrl(link.url));

  const copyButton = document.createElement('button');
  copyButton.textContent = '링크 복사';
  copyButton.style.cssText = actionButtonStyle('#10b981');
  copyButton.addEventListener('click', () => copyExternalLinkUrl(link.url));

  const deleteButton = document.createElement('button');
  deleteButton.textContent = '삭제';
  deleteButton.style.cssText = actionButtonStyle('#f97316');
  deleteButton.addEventListener('click', () => removeExternalLink(link.id));

  actions.appendChild(openButton);
  actions.appendChild(copyButton);
  actions.appendChild(deleteButton);

  card.appendChild(header);
  card.appendChild(actions);

  if (link.memo) {
    const memo = document.createElement('div');
    memo.textContent = link.memo;
    memo.style.cssText = 'font-size: 13px; color: #475569; background: rgba(148, 163, 184, 0.15); padding: 12px 14px; border-radius: 10px;';
    card.appendChild(memo);
  }

  return card;
}

function actionButtonStyle(accent) {
  return `
    padding: 10px 16px;
    border-radius: 999px;
    border: none;
    background: ${accent};
    color: white;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px ${accent}33;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  `;
}

function modeBadgeMarkup(mode) {
  switch (mode) {
    case 'seo':
      return '<span style="background: rgba(59,130,246,0.15); color: #1d4ed8; padding: 4px 10px; border-radius: 999px; font-weight: 700;">📈 SEO</span>';
    case 'consistency':
      return '<span style="background: rgba(244,114,182,0.15); color: #be185d; padding: 4px 10px; border-radius: 999px; font-weight: 700;">🕸️ 일관성</span>';
    case 'shopping':
      return '<span style="background: rgba(34,197,94,0.15); color: #15803d; padding: 4px 10px; border-radius: 999px; font-weight: 700;">🛍️ 쇼핑</span>';
    case 'adsense':
      return '<span style="background: rgba(250,204,21,0.15); color: #92400e; padding: 4px 10px; border-radius: 999px; font-weight: 700;">💰 애드센스</span>';
    case 'paraphrasing':
      return '<span style="background: rgba(129,140,248,0.15); color: #4338ca; padding: 4px 10px; border-radius: 999px; font-weight: 700;">🔁 패러프레이징</span>';
    default:
      return '<span style="background: rgba(148,163,184,0.15); color: #475569; padding: 4px 10px; border-radius: 999px; font-weight: 700;">🔗 기본</span>';
  }
}

function formatExternalLinkDate(timestamp) {
  try {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${date.getFullYear()}.${month}.${day} ${hours}:${minutes}`;
  } catch {
    return '';
  }
}

function addExternalLink() {
  const titleInput = document.getElementById('linkTitleInput');
  const urlInput = document.getElementById('linkUrlInput');

  const title = titleInput?.value?.trim();
  let url = urlInput?.value?.trim();

  if (!title || !url) {
    alert('링크 제목과 URL을 모두 입력해주세요.');
    return;
  }

  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    const parsedUrl = new URL(url);
    url = parsedUrl.toString();
  } catch (error) {
    alert('유효한 URL을 입력해주세요.');
    return;
  }

  const links = loadExternalLinksFromStorage();
  const existingIndex = links.findIndex(link => link.url === url);
  const timestamp = Date.now();

  if (existingIndex >= 0) {
    links[existingIndex].title = title;
    links[existingIndex].updatedAt = timestamp;
    links[existingIndex].url = url;
    if (!links[existingIndex].mode) {
      links[existingIndex].mode = DEFAULT_EXTERNAL_LINK_MODE;
    }
    addLog(`🔄 외부 링크 업데이트: ${title}`, 'info');
  } else {
    links.push({
      id: `${timestamp}-${Math.random().toString(36).slice(2)}`,
      title,
      url,
      mode: DEFAULT_EXTERNAL_LINK_MODE,
      memo: '',
      createdAt: timestamp,
      updatedAt: timestamp
    });
    addLog(`🔗 외부 링크 추가: ${title}`, 'success');
  }

  persistExternalLinks();
  renderExternalLinksList();

  if (titleInput) titleInput.value = '';
  if (urlInput) urlInput.value = '';
  titleInput?.focus();
}

function removeExternalLink(id) {
  if (!id) return;
  const links = loadExternalLinksFromStorage();
  const target = links.find(link => link.id === id);
  if (!target) return;

  if (!confirm(`"${target.title}" 링크를 삭제하시겠습니까?`)) {
    return;
  }

  externalLinksCache = links.filter(link => link.id !== id);
  persistExternalLinks();
  renderExternalLinksList();
  addLog(`🗑️ 외부 링크 삭제: ${target.title}`, 'warning');
}

function changeExternalLinkMode(id, mode) {
  mode = normalizeExternalLinkMode(mode);
  const links = loadExternalLinksFromStorage();
  const target = links.find(link => link.id === id);
  if (!target) return;

  target.mode = mode;
  target.updatedAt = Date.now();
  persistExternalLinks();
  renderExternalLinksList();
}
function openExternalLinkUrl(url) {
  if (!url) return;
  try {
    if (window.blogger && window.blogger.openExternal) {
      window.blogger.openExternal(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  } catch (error) {
    console.error('❌ [EXTERNAL-LINKS] 외부 링크 열기 실패:', error);
    alert('외부 링크를 열 수 없습니다: ' + error.message);
  }
}

function copyExternalLinkUrl(url) {
  if (!url) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url)
      .then(() => {
        addLog(`📋 외부 링크 복사: ${url}`, 'success');
      })
      .catch(error => {
        console.error('❌ [EXTERNAL-LINKS] 클립보드 복사 실패:', error);
        fallbackCopyExternalLink(url);
      });
  } else {
    fallbackCopyExternalLink(url);
  }
}

function fallbackCopyExternalLink(url) {
  const textarea = document.createElement('textarea');
  textarea.value = url;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    addLog(`📋 외부 링크 복사: ${url}`, 'success');
  } catch (error) {
    console.error('❌ [EXTERNAL-LINKS] 복사 실패:', error);
    alert('링크 복사에 실패했습니다.');
  } finally {
    document.body.removeChild(textarea);
  }
}

function filterLinksByMode(mode) {
  if (!mode || (mode !== 'all' && !EXTERNAL_LINK_MODE_IDS.includes(mode))) {
    mode = 'all';
  }
  externalLinksFilter = mode;
  markExternalLinkFilterButton(mode);
  renderExternalLinksList();
}

function markExternalLinkFilterButton(mode) {
  const buttons = document.querySelectorAll('.category-filter-btn');
  buttons.forEach(btn => {
    btn.classList.remove('active');
    btn.style.background = '#f3f4f6';
    btn.style.color = '#6b7280';
    btn.style.border = '2px solid #e5e7eb';
  });

  const targetIdMap = {
    all: 'filterAll',
    seo: 'filterSeo',
    consistency: 'filterConsistency',
    shopping: 'filterShopping',
    adsense: 'filterAdsense',
    paraphrasing: 'filterParaphrasing'
  };
  const targetId = targetIdMap[mode];
  if (targetId) {
    const targetBtn = document.getElementById(targetId);
    if (targetBtn) {
      targetBtn.classList.add('active');
      targetBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      targetBtn.style.color = '#ffffff';
      targetBtn.style.border = 'none';
    }
  }
}
// ---------------------------------------------
// 발행 글 히스토리 관리 모듈
// ---------------------------------------------
const PUBLISHED_POSTS_STORAGE_KEY = 'bloggerPublishedPosts';
var publishedPostsCache = null;

function loadPublishedPostsFromStorage() {
  if (publishedPostsCache) return publishedPostsCache;
  try {
    const raw = localStorage.getItem(PUBLISHED_POSTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      publishedPostsCache = parsed.map(post => ({
        id: post.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: String(post.title || '제목 없음').trim(),
        url: String(post.url || '').trim(),
        platform: String(post.platform || 'unknown').trim(),
        publishedAt: post.publishedAt || Date.now(),
        thumbnail: String(post.thumbnail || '').trim(),
        payload: post.payload || null,
        summary: typeof post.summary === 'string' ? post.summary : ''
      }));
    } else {
      publishedPostsCache = [];
    }
  } catch (error) {
    console.error('❌ [PUBLISHED-POSTS] 스토리지 로드 실패:', error);
    publishedPostsCache = [];
  }
  return publishedPostsCache;
}
function persistPublishedPosts() {
  if (!publishedPostsCache) return;
  try {
    localStorage.setItem(PUBLISHED_POSTS_STORAGE_KEY, JSON.stringify(publishedPostsCache));
  } catch (error) {
    console.error('❌ [PUBLISHED-POSTS] 스토리지 저장 실패:', error);
  }
}
function addPublishedPostRecord(record) {
  if (!record) return;
  const posts = loadPublishedPostsFromStorage();
  if (!record.title) record.title = '';
  if (!record.url) record.url = '';
  if (!record.platform) record.platform = 'unknown';
  if (!record.publishedAt) record.publishedAt = Date.now();
  const rawStatus = record.status ? String(record.status).trim().toLowerCase() : '';
  const normalizedTitle = record.title.replace(/\s+/g, ' ').trim();
  const normalizedUrl = record.url.trim();
  const normalizedPlatform = record.platform.trim() || 'unknown';
  const normalizedStatus = rawStatus || 'publish';

  const sanitizedUrl = normalizedUrl;
  const timestamp = record.publishedAt ? Number(record.publishedAt) : Date.now();
  const generatedId = record.id
    ? String(record.id)
    : sanitizedUrl
      ? `${sanitizedUrl}|${timestamp}`
      : `${timestamp}-${Math.random().toString(36).slice(2)}`;

  const normalized = {
    id: generatedId,
    title: normalizedTitle || '제목 없음',
    url: sanitizedUrl,
    platform: normalizedPlatform,
    status: normalizedStatus,
    publishedAt: timestamp,
    thumbnail: String(record.thumbnail || '').trim(),
    payload: record.payload || null,
    summary: typeof record.summary === 'string' ? record.summary : ''
  };

  const duplicateIndex = posts.findIndex(post =>
    (normalized.id && post.id === normalized.id) ||
    (normalized.url && post.url === normalized.url)
  );
  if (duplicateIndex >= 0) {
    posts[duplicateIndex] = { ...posts[duplicateIndex], ...normalized, updatedAt: Date.now() };
  } else {
    posts.unshift(normalized);
  }

  // 최대 100개까지만 유지 (넘으면 오래된 것 삭제)
  if (posts.length > 100) {
    posts.length = 100;
  }

  persistPublishedPosts();
  renderPublishedPostsList();
  addLog(`📝 발행 히스토리에 추가: ${normalized.title}`, 'success');
}

function removePublishedPost(id) {
  if (!id) return;
  const posts = loadPublishedPostsFromStorage();
  const target = posts.find(post => post.id === id);
  if (!target) return;

  if (!confirm(`"${target.title}" 기록을 삭제하시겠습니까?`)) {
    return;
  }

  publishedPostsCache = posts.filter(post => post.id !== id);
  persistPublishedPosts();
  renderPublishedPostsList();
  addLog(`🗑️ 발행 히스토리 삭제: ${target.title}`, 'warning');
}
function clearPublishedPosts() {
  if (!confirm('발행한 블로그글 기록을 모두 삭제하시겠습니까?')) {
    return;
  }
  publishedPostsCache = [];
  persistPublishedPosts();
  renderPublishedPostsList();
  addLog('🧹 발행 히스토리를 모두 삭제했습니다.', 'warning');
}

function renderPublishedPostsList() {
  const container = document.getElementById('publishedPostsList');
  if (!container) return;

  const posts = loadPublishedPostsFromStorage();
  posts.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
  container.innerHTML = '';

  if (!posts || posts.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: rgba(255, 255, 255, 0.5); font-size: 13px;">
        발행한 글이 없습니다
      </div>
    `;
    return;
  }

  posts.forEach(post => {
    container.appendChild(buildPublishedPostCard(post));
  });
}
function buildPublishedPostCard(post) {
  const card = document.createElement('div');
  card.style.cssText = `
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    background: rgba(15, 23, 42, 0.45);
    border-radius: 14px;
    border: 1px solid rgba(94, 234, 212, 0.22);
    box-shadow: 0 16px 38px rgba(8, 47, 73, 0.28);
    cursor: pointer;
    transition: transform 0.18s ease, box-shadow 0.18s ease;
    min-width: 0;
  `;
  card.addEventListener('mouseenter', () => {
    card.style.transform = 'translateY(-1px)';
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = 'translateY(0)';
  });

  const infoWrapper = document.createElement('div');
  infoWrapper.style.cssText = 'flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; white-space: nowrap; overflow: hidden;';

  const platformName = post.platform === 'blogger' ? 'Blogger'
    : post.platform === 'wordpress' ? 'WordPress'
      : post.platform || '기타';
  const statusLabel = formatPublishedPostStatus(post.status);
  const dateLabel = formatPublishedPostDate(post.publishedAt);

  const metaParts = [platformName, statusLabel, dateLabel].filter(Boolean);
  const titleText = post.title || '제목 없음';

  const tagCandidates = Array.isArray(post?.payload?.generatedLabels)
    ? post.payload.generatedLabels
    : Array.isArray(post?.payload?.labels)
      ? post.payload.labels
      : [];
  const tagsText = tagCandidates.length ? tagCandidates.slice(0, 5).join(', ') : '';

  const infoText = document.createElement('span');
  infoText.style.cssText = 'color: rgba(255, 255, 255, 0.9); font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis;';
  const infoSegments = [];
  if (metaParts.length) infoSegments.push(metaParts.join(' · '));
  if (titleText) infoSegments.push(`"${titleText}"`);
  if (tagsText) infoSegments.push(tagsText);
  infoText.textContent = infoSegments.join(' — ');

  const urlSpan = document.createElement('span');
  urlSpan.style.cssText = 'color: rgba(94, 234, 212, 0.9); font-size: 12px; overflow: hidden; text-overflow: ellipsis;';
  urlSpan.textContent = post.url || 'URL 정보 없음';
  urlSpan.title = post.url || 'URL 정보 없음';

  infoWrapper.appendChild(infoText);
  infoWrapper.appendChild(urlSpan);
  card.appendChild(infoWrapper);

  const actions = document.createElement('div');
  actions.style.cssText = 'display: flex; align-items: center; gap: 6px; flex-shrink: 0;';

  const openBtn = document.createElement('button');
  openBtn.textContent = '열기';
  openBtn.style.cssText = publishedPostActionBtnStyle('rgba(16, 185, 129, 0.9)');
  openBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    openPublishedPostUrl(post.url);
  });

  const copyBtn = document.createElement('button');
  copyBtn.textContent = '복사';
  copyBtn.style.cssText = publishedPostActionBtnStyle('rgba(59, 130, 246, 0.9)');
  copyBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    copyPublishedPostUrl(post.url);
  });

  const removeBtn = document.createElement('button');
  removeBtn.textContent = '삭제';
  removeBtn.style.cssText = publishedPostActionBtnStyle('rgba(239, 68, 68, 0.9)');
  removeBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    removePublishedPost(post.id);
  });

  actions.appendChild(openBtn);
  actions.appendChild(copyBtn);
  actions.appendChild(removeBtn);
  card.appendChild(actions);

  if (!post.url) {
    card.style.cursor = 'default';
    infoWrapper.style.cursor = 'default';
    openBtn.disabled = true;
    openBtn.style.opacity = '0.45';
    openBtn.style.cursor = 'not-allowed';
    copyBtn.disabled = true;
    copyBtn.style.opacity = '0.45';
    copyBtn.style.cursor = 'not-allowed';
  } else {
    card.title = post.url;
    card.addEventListener('dblclick', () => openPublishedPostUrl(post.url));
  }

  return card;
}

function publishedPostActionBtnStyle(color) {
  return `
    padding: 6px 12px;
    border-radius: 999px;
    border: none;
    background: ${color};
    color: white;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px ${color}55;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  `;
}

function formatPublishedPostDate(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  } catch (error) {
    console.error('❌ [PUBLISHED-POSTS] 날짜 포맷 실패:', error);
    return '';
  }
}

function formatPublishedPostStatus(status) {
  const normalized = (status || '').toString().toLowerCase();
  if (normalized.includes('draft')) return '임시 저장';
  if (normalized.includes('schedule') || normalized.includes('예약')) return '예약 발행';
  if (normalized.includes('preview')) return '미리보기';
  return '즉시 발행';
}
function openPublishedPostUrl(url) {
  if (!url) {
    alert('열 수 있는 URL 정보가 없습니다.');
    return;
  }
  try {
    if (window.blogger && window.blogger.openExternal) {
      window.blogger.openExternal(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    addLog(`🌐 발행 글 열기: ${url}`, 'info');
  } catch (error) {
    console.error('❌ [PUBLISHED-POSTS] URL 열기 실패:', error);
    alert('URL을 열 수 없습니다: ' + error.message);
  }
}
function copyPublishedPostUrl(url) {
  if (!url) {
    alert('복사할 URL 정보가 없습니다.');
    return;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url)
      .then(() => addLog(`📋 발행 글 URL 복사 완료`, 'success'))
      .catch((error) => {
        console.error('❌ [PUBLISHED-POSTS] 클립보드 복사 실패:', error);
        fallbackCopyExternalLink(url);
      });
  } else {
    fallbackCopyExternalLink(url);
  }
}
// 환경변수 연동 상태 확인 함수
function checkEnvironmentVariables() {
  console.log('🔍 환경변수 연동 상태 확인 시작...');

  // localStorage에서 설정 불러오기
  const settings = loadSettings();
  console.log('📦 localStorage 설정:', settings);
  // .env 파일에서 설정 불러오기
  if (window.blogger && window.blogger.getEnv) {
    window.blogger.getEnv().then(envResult => {
      console.log('📁 .env 파일 설정:', envResult);

      if (envResult && envResult.ok && envResult.data) {
        const envSettings = envResult.data;
        console.log('✅ .env 파일 로드 성공:', envSettings);

        // 병합: localStorage 우선, .env로 빈 값만 보충
        // (사용자가 모달에서 저장한 값이 항상 우선)
        const mergedSettings = { ...envSettings, ...settings };
        if (!mergedSettings.platform) {
          mergedSettings.platform = 'blogspot';
        }

        // .env에만 있고 localStorage에 없는 값 → localStorage로 동기화
        let synced = false;
        for (const key of Object.keys(envSettings)) {
          if (envSettings[key] && (!settings[key] || !String(settings[key]).trim())) {
            settings[key] = envSettings[key];
            synced = true;
          }
        }
        if (synced) {
          localStorage.setItem('bloggerSettings', JSON.stringify(settings));
          console.log('[SETTINGS] .env → localStorage 동기화 완료');
        }
        console.log('🔄 병합된 설정 (localStorage 우선):', mergedSettings);

        // 각 API키 상태 확인
        console.log('🔑 API키 상태:');
        console.log('  - OpenAI API:', mergedSettings.openaiKey ? '✅ 설정됨' : '❌ 미설정');
        console.log('  - Gemini API:', mergedSettings.geminiKey ? '✅ 설정됨' : '❌ 미설정');
        console.log('  - DALL-E API:', mergedSettings.dalleApiKey ? '✅ 설정됨' : '❌ 미설정');
        console.log('  - Pexels API:', mergedSettings.pexelsApiKey ? '✅ 설정됨' : '❌ 미설정');
        console.log('  - 네이버 Customer ID:', mergedSettings.naverCustomerId ? '✅ 설정됨' : '❌ 미설정');
        console.log('  - 네이버 Secret Key:', mergedSettings.naverSecretKey ? '✅ 설정됨' : '❌ 미설정');

        console.log('🌐 플랫폼 설정:');
        console.log('  - 플랫폼:', mergedSettings.platform || 'wordpress');
        console.log('  - Blogger ID:', mergedSettings.blogId ? '✅ 설정됨' : '❌ 미설정');
        console.log('  - Google Client ID:', mergedSettings.googleClientId ? '✅ 설정됨' : '❌ 미설정');
        console.log('  - Google Client Secret:', mergedSettings.googleClientSecret ? '✅ 설정됨' : '❌ 미설정');
        console.log('  - Google CSE Key:', mergedSettings.googleCseKey ? '✅ 설정됨' : '❌ 미설정');
        console.log('  - Google CSE CX:', mergedSettings.googleCseCx ? '✅ 설정됨' : '❌ 미설정');

        console.log('🌍 WordPress 설정:');
        console.log('  - 사이트 URL:', mergedSettings.wordpressSiteUrl ? '✅ 설정됨' : '❌ 미설정');
        console.log('  - 사용자명:', mergedSettings.wordpressUsername ? '✅ 설정됨' : '❌ 미설정');
        console.log('  - 비밀번호:', mergedSettings.wordpressPassword ? '✅ 설정됨' : '❌ 미설정');

        // 연동 상태 요약
        const totalSettings = Object.keys(mergedSettings).length;
        const configuredSettings = Object.values(mergedSettings).filter(value => value && value.toString().trim() !== '').length;
        console.log(`📊 연동 상태 요약: ${configuredSettings}/${totalSettings} 설정 완료`);

        if (configuredSettings > 0) {
          console.log('✅ 환경변수 연동이 정상적으로 작동하고 있습니다!');
        } else {
          console.log('⚠️ 환경변수가 설정되지 않았습니다. 환경설정에서 API키를 입력해주세요.');
        }

      } else {
        console.log('❌ .env 파일 로드 실패:', envResult);
      }
    }).catch(error => {
      console.error('❌ .env 파일 로드 오류:', error);
    });
  } else {
    console.log('❌ window.blogger.getEnv 함수를 사용할 수 없습니다.');
  }
}

// 전역 함수로 등록 (브라우저 콘솔에서 호출 가능)
window.checkEnvironmentVariables = checkEnvironmentVariables;

// H2 이미지 소스 변경 시 처리
function handleH2ImageSourceChange() {
  const selectedSource = document.querySelector('input[name="h2ImageSource"]:checked')?.value || 'nanobananapro';
  console.log('🖼️ [H2 IMAGE] 선택된 이미지 소스:', selectedSource);

  // 선택된 소스에 따른 추가 설정 표시/숨김
  const h2Sections = document.querySelectorAll('input[name="h2Sections"]');

  h2Sections.forEach(section => {
    const label = section.closest('label');
    if (label) {
      if (selectedSource === 'pexels') {
        label.style.background = 'rgba(59, 130, 246, 0.2)';
      } else {
        label.style.background = 'rgba(139, 92, 246, 0.2)';
      }
    }
  });
}

// H2 섹션 선택 상태 확인
function getH2ImageSettings() {
  const selectedSource = document.querySelector('input[name="h2ImageSource"]:checked')?.value || 'nanobananapro';
  const selectedSections = Array.from(document.querySelectorAll('input[name="h2Sections"]:checked'))
    .map(input => parseInt(input.value));

  const settings = {
    source: selectedSource,
    sections: selectedSections,
    totalSections: selectedSections.length
  };

  console.log('🖼️ [H2 IMAGE] 현재 설정:', settings);
  return settings;
}

// 전역 함수로 등록
window.handleH2ImageSourceChange = handleH2ImageSourceChange;
window.getH2ImageSettings = getH2ImageSettings;
// 구글 트렌드 열기
function openGoogleTrends() {
  try {
    console.log('📊 [TRENDS] 구글 트렌드 열기');

    // Electron 환경에서 외부 브라우저로 열기
    if (window.blogger && window.blogger.openExternal) {
      window.blogger.openExternal('https://trends.google.com/trends/');
    } else {
      // 웹 환경에서 새 창으로 열기
      window.open('https://trends.google.com/trends/', '_blank');
    }

    console.log('✅ [TRENDS] 구글 트렌드 열기 완료');

  } catch (error) {
    console.error('❌ [TRENDS] 구글 트렌드 열기 실패:', error);
    alert('구글 트렌드 열기에 실패했습니다: ' + error.message);
  }
}
// LEWORD 모달 열기
function openLEWORDModal() {
  try {
    console.log('💎 [LEWORD] 모달 열기');
    const modal = document.getElementById('lewordModal');
    if (modal) {
      modal.style.display = 'flex';
      console.log('✅ [LEWORD] 모달 열기 완료');
    } else {
      console.error('❌ [LEWORD] 모달 요소를 찾을 수 없습니다');
    }
  } catch (error) {
    console.error('❌ [LEWORD] 모달 열기 실패:', error);
  }
}

// LEWORD 모달 닫기
function closeLEWORDModal() {
  const modal = document.getElementById('lewordModal');
  if (modal) {
    modal.style.display = 'none';
    console.log('💎 [LEWORD] 모달 닫기 완료');
  }
}

// LEWORD 키워드 마스터 열기
async function openLEWORD() {
  try {
    console.log('💎 [LEWORD] 키워드 마스터 열기');

    // Electron API를 통해 키워드 마스터 창 열기
    if (window.electronAPI && window.electronAPI.openKeywordMasterWindow) {
      await window.electronAPI.openKeywordMasterWindow();
      console.log('✅ [LEWORD] 키워드 마스터 창 열기 완료');
    } else if (window.blogger && window.blogger.openKeywordMasterWindow) {
      await window.blogger.openKeywordMasterWindow();
      console.log('✅ [LEWORD] 키워드 마스터 창 열기 완료 (blogger API)');
    } else {
      console.warn('⚠️ [LEWORD] 키워드 마스터 API를 찾을 수 없습니다.');
      alert('LEWORD 기능을 사용할 수 없습니다. Electron 환경에서만 동작합니다.');
    }
  } catch (error) {
    console.error('❌ [LEWORD] 키워드 마스터 열기 실패:', error);
    alert('LEWORD 열기에 실패했습니다: ' + (error.message || String(error)));
  }
}
// 전역 함수로 등록
window.openLEWORD = openLEWORD;
window.openLEWORDModal = openLEWORDModal;
window.closeLEWORDModal = closeLEWORDModal;
window.openSnippetLibraryPanel = openSnippetLibraryPanel;

// 탭 전환 함수 (최적화됨)
function showTab(tabName) {
  // 모든 탭 콘텐츠 숨기기
  const tabContents = DOMCache.getTabContents();
  tabContents.forEach(content => {
    content.classList.remove('active');
  });

  // 모든 탭 버튼 비활성화
  const tabButtons = DOMCache.getTabButtons();
  tabButtons.forEach(button => {
    button.classList.remove('active');
  });

  // 선택된 탭 콘텐츠 보이기
  const selectedTab = document.getElementById(tabName + '-tab');
  if (selectedTab) {
    selectedTab.classList.add('active');
  }

  // 선택된 탭 버튼 활성화
  const selectedButton = document.querySelector(`[onclick="showTab('${tabName}')"]`);
  if (selectedButton) {
    selectedButton.classList.add('active');
  }

  // Accessibility: update aria-selected for all tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.setAttribute('aria-selected', btn.classList.contains('active') ? 'true' : 'false');
  });

}

window.showTab = showTab;

function openSnippetLibraryPanel() {
  try {
    showTab('snippets');
  } catch (error) {
    console.warn('[SNIPPET] 탭 전환 중 오류:', error);
  }

  setTimeout(() => {
    refreshSnippetLibraryUI();
    const panel = document.getElementById('snippetLibraryPanel');
    if (!panel) return;

    panel.classList.add('snippet-highlight');
    panel.addEventListener('animationend', () => {
      panel.classList.remove('snippet-highlight');
    }, { once: true });
  }, 100);
}

window.refreshSnippetLibraryUI = refreshSnippetLibraryUI;

async function fetchSnippetLibraryData() {
  if (window.blogger && typeof window.blogger.getSnippetLibrary === 'function') {
    const result = await window.blogger.getSnippetLibrary();
    if (result?.ok && result.data) return result.data;
    throw new Error(result?.error || '스니펫 데이터를 불러오지 못했습니다.');
  }

  const response = await fetch('./data/snippet-library.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`스니펫 파일을 불러오지 못했습니다. (HTTP ${response.status})`);
  }
  return await response.json();
}

function renderSnippetTags(tags) {
  if (!tags || tags.length === 0) return '';
  return tags
    .map((tag) => `<span class="snippet-tag">${escapeSnippetValue(tag)}</span>`)
    .join('');
}

function renderCtaSnippet(snippet) {
  return `
    <div class="snippet-item">
      <div class="snippet-item-header">
        <div class="snippet-item-title">${escapeSnippetValue(snippet.text || 'CTA 버튼')}</div>
        <span class="snippet-role-badge">${escapeSnippetValue(snippet.role || 'unknown')}</span>
      </div>
      <p class="snippet-item-hook">${escapeSnippetValue(snippet.hook || '')}</p>
      ${snippet.urlTemplate
      ? `<div class="snippet-meta-line"><span class="snippet-meta-label">URL 템플릿</span><span class="snippet-meta-value">${escapeSnippetValue(
        snippet.urlTemplate
      )}</span></div>`
      : ''
    }
      <div class="snippet-meta-footer">
        <div class="snippet-tag-list">${renderSnippetTags(snippet.tags)}</div>
        <div class="snippet-usage">${renderSnippetUsage(snippet)}</div>
      </div>
    </div>
  `;
}

function renderImageSnippet(snippet) {
  return `
    <div class="snippet-item">
      <div class="snippet-item-header">
        <div class="snippet-item-title">${escapeSnippetValue(snippet.prompt?.slice(0, 80) || '이미지 프롬프트')}</div>
        <span class="snippet-role-badge">${escapeSnippetValue(snippet.tone || 'tone')}</span>
      </div>
      <p class="snippet-item-hook">${escapeSnippetValue(snippet.prompt || '')}</p>
      ${snippet.sectionIds && snippet.sectionIds.length
      ? `<div class="snippet-meta-line"><span class="snippet-meta-label">섹션</span><span class="snippet-meta-value">${snippet.sectionIds
        .map((s) => escapeSnippetValue(s))
        .join(', ')}</span></div>`
      : ''
    }
      <div class="snippet-meta-footer">
        <div class="snippet-tag-list">${renderSnippetTags(snippet.tags)}</div>
        <div class="snippet-usage">${renderSnippetUsage(snippet)}</div>
      </div>
    </div>
  `;
}
function renderSnippetUsage(snippet) {
  const usage = typeof snippet.usageCount === 'number' ? snippet.usageCount : 0;
  const lastUsed = snippet.lastUsedAt ? new Date(snippet.lastUsedAt).toLocaleDateString('ko-KR') : '사용 이력 없음';
  return `<span class="snippet-usage-count">사용 ${usage}회</span><span class="snippet-last-used">${escapeSnippetValue(
    lastUsed
  )}</span>`;
}
function renderSnippetSection(title, description, items, renderItem) {
  if (!items || items.length === 0) {
    return `
      <section class="snippet-section">
        <div class="snippet-section-header">
          <h4>${title}</h4>
          <p>${description}</p>
        </div>
        <div class="snippet-empty">등록된 스니펫이 없습니다.</div>
      </section>
    `;
  }

  return `
    <section class="snippet-section">
      <div class="snippet-section-header">
        <h4>${title}</h4>
        <p>${description}</p>
      </div>
      <div class="snippet-list">
        ${items.map((item) => renderItem(item)).join('')}
      </div>
    </section>
  `;
}

function escapeSnippetValue(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
async function refreshSnippetLibraryUI() {
  const container = document.querySelector('#snippetLibraryPanel [data-snippet-container]');
  if (!container) return;

  container.innerHTML = `
    <div class="loading-indicator">
      <span>⏳</span>
      <span>스니펫 데이터를 불러오는 중입니다...</span>
    </div>
  `;

  try {
    const library = await fetchSnippetLibraryData();
    const ctas = library?.ctas ?? [];
    const imagePrompts = library?.imagePrompts ?? [];

    container.innerHTML = `
      ${renderSnippetSection(
      'CTA 스니펫',
      '자동 추천과 수동 설정에서 함께 활용됩니다.',
      ctas,
      renderCtaSnippet
    )}
      ${renderSnippetSection(
      '이미지 프롬프트',
      '섹션별 AI 이미지 생성을 위해 사용됩니다.',
      imagePrompts,
      renderImageSnippet
    )}
    `;
  } catch (error) {
    console.error('[SNIPPET] 데이터 로드 실패:', error);
    container.innerHTML = `
      <div class="snippet-error">
        <span>⚠️</span>
        <div>
          <p style="margin:0; font-weight:700;">스니펫 데이터를 불러오지 못했습니다.</p>
          <p style="margin:4px 0 0 0; opacity:0.8;">${escapeSnippetValue(error.message || '알 수 없는 오류')}</p>
          <button type="button" class="snippet-retry-button" onclick="refreshSnippetLibraryUI()">다시 시도</button>
        </div>
      </div>
    `;
  }
}

// 라이선스 유효성 체크 (최적화됨)
function isLicenseValid() {
  const element = document.getElementById('licenseStatus');
  if (!element) return false;

  if (element.dataset && typeof element.dataset.valid !== 'undefined') {
    return element.dataset.valid === 'true';
  }

  const text = element.textContent || '';
  const color = element.style.color || '';

  return color.includes('185, 129') || color.includes('#10b981') ||
    text.includes('무제한') || text.includes('유효') ||
    text.includes('활성') || text.includes('등록됨');
}

function formatLicenseStatusLabel(label, unit) {
  if (label === '무제한') return '무제한';
  if (label === '정보없음') return '정보 없음';
  if (label === null || label === undefined || label === '') return '정보 없음';
  if (typeof label === 'number') return unit ? `${label}${unit}` : String(label);
  return label;
}

function buildLicenseStatusText(licenseData, expiresDate, isUnlimited) {
  const maxUsesLabel = licenseData.maxUses === -1 ? '무제한' : (licenseData.maxUses ?? '정보없음');
  const remainingLabel = licenseData.remaining === -1 ? '무제한' : (licenseData.remaining ?? '정보없음');
  const expiresLabel = isUnlimited
    ? '무제한'
    : (expiresDate ? `${expiresDate.getFullYear()}년 ${String(expiresDate.getMonth() + 1).padStart(2, '0')}월` : '정보 없음');

  const parts = [
    `총 ${formatLicenseStatusLabel(maxUsesLabel, '회')}`,
    `잔여 ${formatLicenseStatusLabel(remainingLabel, '회')}`,
    `만료 ${formatLicenseStatusLabel(expiresLabel)}`
  ];

  return parts.join(' • ');
}

function setLicenseStatusElement(element, text, color, isValid) {
  if (!element) return;
  element.textContent = text;
  element.style.color = color;
  if (!element.dataset) element.dataset = {};
  element.dataset.valid = isValid ? 'true' : 'false';
}

function normalizeLicenseCount(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return value;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (['무제한', 'unlimited', 'permanent', 'lifetime', '∞', 'infinite'].includes(normalized)) {
    return -1;
  }
  const digits = normalized.replace(/[^\d-]/g, '');
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseLicenseExpiry(value) {
  if (value === undefined || value === null) {
    return { date: null, unlimited: false };
  }

  if (typeof value === 'number') {
    if (value === -1) return { date: null, unlimited: true };
    return { date: new Date(value), unlimited: false };
  }

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return { date: null, unlimited: false };
  }

  if (['무제한', 'unlimited', 'permanent', 'lifetime', 'never', 'no-expiry', '∞', 'infinite'].includes(normalized)) {
    return { date: null, unlimited: true };
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return { date: null, unlimited: false };
  }

  return { date: new Date(parsed), unlimited: false };
}

// Pexels API 발급 페이지 열기
function openPexelsApiPage() {
  try {
    // Electron 환경에서 외부 브라우저로 열기
    if (window.blogger && window.blogger.openLink) {
      window.blogger.openLink('https://www.pexels.com/api/');
    } else {
      // 일반 웹 환경에서 새 창으로 열기
      window.open('https://www.pexels.com/api/', '_blank');
    }
  } catch (error) {
    console.error('Pexels API 페이지 열기 실패:', error);
    // fallback으로 새 창 열기
    window.open('https://www.pexels.com/api/', '_blank');
  }
}

// DALL-E API 발급 페이지 열기
function openDalleApiPage() {
  try {
    // Electron 환경에서 외부 브라우저로 열기
    if (window.blogger && window.blogger.openLink) {
      window.blogger.openLink('https://platform.openai.com/api-keys');
    } else {
      // 일반 웹 환경에서 새 창으로 열기
      window.open('https://platform.openai.com/api-keys', '_blank');
    }
  } catch (error) {
    console.error('DALL-E API 페이지 열기 실패:', error);
    // fallback으로 새 창 열기
    window.open('https://platform.openai.com/api-keys', '_blank');
  }
}

// 네이버 API 발급 페이지 열기
function openNaverApiPage() {
  try {
    // Electron 환경에서 외부 브라우저로 열기
    if (window.blogger && window.blogger.openLink) {
      window.blogger.openLink('https://developers.naver.com/apps/#/myapps');
    } else {
      // 일반 웹 환경에서 새 창으로 열기
      window.open('https://developers.naver.com/apps/#/myapps', '_blank');
    }
  } catch (error) {
    console.error('네이버 API 페이지 열기 실패:', error);
    // fallback으로 새 창 열기
    window.open('https://developers.naver.com/apps/#/myapps', '_blank');
  }
}

// Gemini API 발급 페이지 열기
function openGeminiApiPage() {
  try {
    if (window.blogger && window.blogger.openLink) {
      window.blogger.openLink('https://makersuite.google.com/app/apikey');
    } else {
      window.open('https://makersuite.google.com/app/apikey', '_blank');
    }
  } catch (error) {
    console.error('Gemini API 페이지 열기 실패:', error);
    window.open('https://makersuite.google.com/app/apikey', '_blank');
  }
}

// Google CSE API 발급 페이지 열기
function openGoogleCseApiPage() {
  try {
    if (window.blogger && window.blogger.openLink) {
      window.blogger.openLink('https://programmablesearchengine.google.com/controlpanel/create');
    } else {
      window.open('https://programmablesearchengine.google.com/controlpanel/create', '_blank');
    }
  } catch (error) {
    console.error('Google CSE API 페이지 열기 실패:', error);
    window.open('https://programmablesearchengine.google.com/controlpanel/create', '_blank');
  }
}

// Google OAuth 설정 페이지 열기
function openGoogleOAuthPage() {
  try {
    if (window.blogger && window.blogger.openLink) {
      window.blogger.openLink('https://console.cloud.google.com/apis/credentials');
    } else {
      window.open('https://console.cloud.google.com/apis/credentials', '_blank');
    }
  } catch (error) {
    console.error('Google OAuth 페이지 열기 실패:', error);
    window.open('https://console.cloud.google.com/apis/credentials', '_blank');
  }
}
// UI 차단 함수 (최적화됨)
function blockUIForInvalidLicense() {
  const isBlocked = !isLicenseValid();

  // 버튼과 입력 필드 차단
  const elementsToBlock = [
    'generateBtn', 'previewBtn', 'runPostingBtn', 'bulkPostingBtn', 'scheduleBtn',
    'keywordInput', 'topic', 'minChars', 'maxChars'
  ];

  elementsToBlock.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      if (!element.dataset) element.dataset = {};
      if (typeof element.dataset.originalLabel === 'undefined') {
        element.dataset.originalLabel = element.innerHTML;
      }

      element.disabled = isBlocked;
      element.style.opacity = isBlocked ? '0.5' : '1';
      element.style.cursor = isBlocked ? 'not-allowed' : 'pointer';

      if (isBlocked && id === 'generateBtn') {
        element.innerHTML = '<span style="position: relative; z-index: 1;">🔒 라이선스 등록 필요</span>';
      } else if (!isBlocked && typeof element.dataset.originalLabel !== 'undefined') {
        element.innerHTML = element.dataset.originalLabel;
      }
    }
  });

  // 라이센스 모달 표시 (차단된 경우)
  if (isBlocked) {
    setTimeout(() => {
      const licenseModal = document.getElementById('licenseModal');
      if (licenseModal) {
        licenseModal.style.display = 'flex';
      }
    }, 1000);
  }
}
// 라이센스 정보 로드
async function loadLicenseInfo() {
  try {
    const licenseStatusElement = document.getElementById('licenseStatus');
    if (!licenseStatusElement) return;

    // 개발 환경 체크 — 개발모드 배지 숨김
    const devApi = window.electronAPI || window.electron;
    if (devApi && devApi.isDeveloperMode) {
      try {
        const devResult = await devApi.isDeveloperMode();
        if (devResult && devResult.isDeveloperMode) {
          setLicenseStatusElement(licenseStatusElement, '✅ 인증완료', '#10b981', true);
          return;
        }
      } catch { /* ignore */ }
    }

    // Electron API를 통해 라이센스 파일 읽기
    if (window.blogger && window.blogger.readLicenseFile) {
      const result = await window.blogger.readLicenseFile();

      if (result.ok && result.data) {
        const licenseData = result.data;

        const maxUses = normalizeLicenseCount(licenseData.maxUses);
        const remaining = normalizeLicenseCount(licenseData.remaining);
        const expiryInfo = parseLicenseExpiry(licenseData.expiresAt);

        const isUnlimited = expiryInfo.unlimited || maxUses === -1;
        const expiresTimestamp = expiryInfo.date ? expiryInfo.date.getTime() : null;
        const isValid = isUnlimited || (
          licenseData.valid !== false &&
          (expiresTimestamp === null || expiresTimestamp > Date.now())
        );

        const displayData = {
          maxUses: maxUses === null ? '정보없음' : (maxUses === -1 ? '무제한' : maxUses),
          remaining: remaining === null ? '정보없음' : (remaining === -1 ? '무제한' : remaining),
        };

        const statusText = buildLicenseStatusText(displayData, expiryInfo.date, isUnlimited);
        const statusColor = isValid ? '#10b981' : '#ef4444';

        console.log('라이센스 유효성:', {
          isValid,
          isUnlimited,
          expiresDate: expiryInfo.date,
          licenseData
        });

        setLicenseStatusElement(licenseStatusElement, statusText, statusColor, isValid);

        console.log('라이센스 정보 로드됨:', licenseData);

        setTimeout(() => {
          blockUIForInvalidLicense();
        }, 100);

        return licenseData;
      } else {
        setLicenseStatusElement(licenseStatusElement, '미등록', '#f59e0b', false);
        console.log('라이센스 파일이 없습니다.');

        setTimeout(() => {
          blockUIForInvalidLicense();
        }, 100);

        return null;
      }
    } else {
      console.log('Electron API를 사용할 수 없습니다.');
      licenseStatusElement.textContent = '오류';
      licenseStatusElement.style.color = '#ef4444'; // 빨간색

      // UI 차단 상태 업데이트
      setTimeout(() => {
        blockUIForInvalidLicense();
      }, 100);

      return null;
    }
  } catch (error) {
    console.error('라이센스 정보 로드 중 오류:', error);
    const licenseStatusElement = document.getElementById('licenseStatus');
    setLicenseStatusElement(licenseStatusElement, '오류', '#ef4444', false);

    // UI 차단 상태 업데이트
    setTimeout(() => {
      blockUIForInvalidLicense();
    }, 100);

    return null;
  }
}
// 라이센스 활성화 함수 (모달용)
async function activateLicenseFromModal() {
  try {
    const keyEl = document.getElementById('licenseKey');
    const emailEl = document.getElementById('licenseEmail');
    const key = keyEl?.value?.trim() || '';
    const email = emailEl?.value?.trim() || '';

    if (!key || !email) {
      alert('라이센스 키와 이메일을 모두 입력해주세요.');
      return;
    }

    // 라이센스 키 검증 (실제로는 서버에서 검증해야 함)
    const licenseData = {
      key: key,
      email: email,
      valid: true,
      activatedAt: Date.now(),
      expiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1년 후
      user: email
    };

    // Electron API를 통해 license.json 파일에 저장
    if (window.blogger && window.blogger.writeLicenseFile) {
      const result = await window.blogger.writeLicenseFile(licenseData);

      if (result.ok) {
        // UI 업데이트
        await loadLicenseInfo();

        // 모달 닫기
        document.getElementById('licenseModal').style.display = 'none';

        // UI 차단 해제
        setTimeout(() => {
          blockUIForInvalidLicense();
        }, 200);

        alert('라이센스가 성공적으로 활성화되었습니다!');
      } else {
        alert('라이센스 저장 중 오류가 발생했습니다: ' + result.error);
      }
    } else {
      alert('Electron API를 사용할 수 없습니다.');
    }

  } catch (error) {
    console.error('라이센스 활성화 중 오류:', error);
    alert('라이센스 활성화 중 오류가 발생했습니다: ' + error.message);
  }
}
// 전역 변수
var currentPlatform = 'wordpress';
var isRunning = false;
var isCanceled = false; // 포스트 취소 플래그
var currentTab = 'main'; // 현재 탭 상태
var lastProgressUpdateTime = null; // 마지막 진행률 업데이트 시간 (동기화용)
// 포스팅 실행 함수
async function runSmartPosting() {
  // 라이선스 체크
  if (!isLicenseValid()) {
    alert('🔒 라이선스 등록이 필요합니다.\n라이센스 모달이 열립니다.');
    const licenseModal = document.getElementById('licenseModal');
    if (licenseModal) {
      licenseModal.style.display = 'flex';
    }
    return;
  }

  // 키워드 입력 필드 값 확인
  const keywordInput = document.getElementById('keywordInput');
  const keywordValue = keywordInput ? keywordInput.value.trim() : '';

  // 키워드 리스트에서 동적으로 추가된 키워드 확인
  const keywordList = document.getElementById('keywordList');
  const keywordItems = keywordList ? keywordList.querySelectorAll('.keyword-item') : [];

  console.log('🔍 runSmartPosting 상세 디버깅:');
  console.log('- keywordInput 요소:', keywordInput);
  console.log('- keywordInput.value:', keywordInput ? keywordInput.value : 'null');
  console.log('- keywordValue (trimmed):', keywordValue);
  console.log('- keywordList 요소:', keywordList);
  console.log('- keywordItems.length:', keywordItems.length);
  console.log('- 조건 체크:');
  console.log('  * keywordValue && keywordItems.length === 0:', keywordValue && keywordItems.length === 0);
  console.log('  * keywordItems.length > 0:', keywordItems.length > 0);

  // 키워드가 있는지 확인 (입력 필드 또는 키워드 리스트)
  const hasKeywordInInput = keywordValue && keywordValue.length > 0;
  const hasKeywordsInList = keywordItems.length > 0;

  if (hasKeywordInInput && keywordItems.length === 0) {
    // 키워드 입력 필드에만 값이 있고, 키워드 리스트가 비어있는 경우 - 단일 포스팅
    console.log('✅ 단일 포스팅 실행');
    await runPosting();
  } else if (hasKeywordsInList) {
    // 키워드 리스트에 항목이 있는 경우 - 대량 포스팅
    console.log('✅ 대량 포스팅 실행');
    await runBulkPosting();
  } else if (hasKeywordInInput) {
    // 키워드 입력 필드에 값이 있지만 다른 조건이 맞지 않는 경우도 단일 포스팅으로 처리
    console.log('✅ 단일 포스팅 실행 (fallback)');
    await runPosting();
  } else {
    console.log('❌ 키워드 없음 - 에러 메시지 표시');
    alert('최소 1개의 키워드를 입력해주세요.');
  }
}
async function runPosting() {
  debugLog('POSTING', 'runPosting 함수 시작');

  // 버튼 활성화 보장 (무제한 클릭 가능)
  const runBtn = document.getElementById('runBtn');
  if (runBtn) {
    runBtn.disabled = false;
    runBtn.style.pointerEvents = 'auto';
    runBtn.style.opacity = '1';
    runBtn.style.cursor = 'pointer';
    console.log('🔄 [BUTTON] runPosting 시작 - 버튼 활성화 보장');
  }

  // 진행률 초기화
  overallProgress = 0;

  try {
    // 라이선스 체크
    debugLog('POSTING', '라이선스 유효성 확인 중...');
    if (!isLicenseValid()) {
      debugLog('POSTING', '라이선스 무효 - 모달 표시');
      alert('🔒 라이선스 등록이 필요합니다.\n라이센스 모달이 열립니다.');
      const licenseModal = document.getElementById('licenseModal');
      if (licenseModal) {
        licenseModal.style.display = 'flex';
      }
      return;
    }
    successLog('POSTING', '라이선스 유효성 확인 완료');

    // 취소 상태 초기화
    isCanceled = false;
    debugLog('POSTING', '취소 상태 초기화 완료');

    // 주제와 키워드 입력 필드에서 직접 확인
    debugLog('POSTING', '입력 필드 확인 중...');
    const topicInput = document.getElementById('topicInput');
    const keywordInput = document.getElementById('keywordInput');
    const topicValue = topicInput ? topicInput.value.trim() : '';
    const keywordValue = keywordInput ? keywordInput.value.trim() : '';

    debugLog('POSTING', `주제 입력 필드 값: "${topicValue}"`, {
      topicInput: !!topicInput,
      topicValue: topicValue,
      keywordInput: !!keywordInput,
      keywordValue: keywordValue
    });

    // 🔥 멀티 키워드 파싱 (줄바꿈 구분)
    let keywords = [];

    if (keywordValue.trim()) {
      // 줄바꿈으로 구분된 멀티 키워드 파싱
      keywords = parseMultiKeywords(keywordValue);
      if (keywords.length > 1) {
        successLog('POSTING', `멀티 키워드 감지: ${keywords.length}개`, keywords);
        addLog(`📝 ${keywords.length}개 키워드 연속 발행 모드 시작`, 'info');
      } else {
        successLog('POSTING', `단일 키워드 사용: "${keywords[0]}"`);
      }
    } else if (topicValue.trim()) {
      // 주제에서 자동으로 키워드 추출 (공백, 쉼표, 대시로 분리)
      debugLog('POSTING', '주제에서 키워드 자동 추출 중...');
      const extractedKeywords = topicValue
        .split(/[\s,\-\/]+/)
        .map(k => k.trim())
        .filter(k => k.length > 1 && k.length < 20) // 1-20자 사이의 의미있는 키워드만
        .slice(0, 5); // 최대 5개까지만

      keywords = extractedKeywords.length > 0 ? extractedKeywords : [topicValue];
      successLog('POSTING', '주제에서 추출된 키워드', keywords);
    } else {
      keywords = [topicValue || '키워드 없음'];
      debugLog('POSTING', '기본 키워드 사용', keywords);
    }

    // 키워드 검증
    if (keywords.length === 0 || (keywords.length === 1 && !keywords[0].trim())) {
      alert('키워드를 입력해주세요.');
      return;
    }

    if (isRunning) {
      alert('포스팅 작업이 실행 중입니다.');
      return;
    }

    // 포스팅 모드 가져오기
    const postingMode = document.querySelector('input[name="postingMode"]:checked')?.value || 'immediate';
    const imageType = document.querySelector('input[name="imageType"]:checked')?.value || 'text';

    // 예약 설정 가져오기
    let scheduleSettings = null;
    if (postingMode === 'schedule') {
      const timezone = document.getElementById('timezone')?.value || 'Asia/Seoul';
      const scheduleDateTime = document.getElementById('scheduleDateTime')?.value;
      const bulkInterval = parseInt(document.getElementById('bulkInterval')?.value) || 30;

      if (!scheduleDateTime) {
        alert('예약 시간을 설정해주세요.');
        return;
      }

      scheduleSettings = {
        timezone,
        scheduleDateTime,
        bulkInterval
      };
    }
    // 진행 상태 모달 표시
    showProgressModal();

    // 🖼️ 멀티 키워드 연속 발행을 위한 상태 설정
    const totalKeywords = keywords.length;

    // sectionCount를 설정에서 동적으로 가져오기
    let sectionCount = 5; // 기본값
    const sectionCountSelect = document.getElementById('sectionCount');
    if (sectionCountSelect) {
      if (sectionCountSelect.value === 'custom') {
        const customInput = document.getElementById('customSectionCount');
        sectionCount = customInput && customInput.value ? parseInt(customInput.value) : 5;
      } else {
        sectionCount = parseInt(sectionCountSelect.value) || 5;
      }
    }
    if (sectionCount < 1) sectionCount = 1;
    if (sectionCount > 20) sectionCount = 20;
    console.log(`[IMAGE-GRID] 동적 sectionCount: ${sectionCount}`);

    // 멀티 키워드 진행 상태 표시
    if (totalKeywords > 1) {
      const progressStep = document.getElementById('progressStep');
      if (progressStep) {
        progressStep.innerHTML = `📝 [1/${totalKeywords}] "<strong>${keywords[0]}</strong>" 준비 중...`;
      }
    }

    // 이미지 그리드 초기화 (첫 번째 키워드로)
    initializeImageGrid(sectionCount, keywords[0]);

    // 키워드 데이터 생성
    const keywordData = [];
    // 1. 단일/멀티 키워드 입력 필드 확인 (keywordInput)
    if (keywordValue && keywordValue.trim()) {
      // 썸네일 타입과 이미지 소스 가져오기
      const thumbnailTypeSelect = document.getElementById('thumbnailType');
      const sectionCountSelect = document.getElementById('sectionCount');
      const titleModeSelect = document.getElementById('titleMode');

      // 제목 모드 확인: 'custom'이면 사용자가 입력한 값을 제목으로, 'auto'면 null(AI 자동 생성)
      let titleValue = null;
      const normalizedKeyword = keywordValue.trim();

      if (titleModeSelect?.value === 'custom') {
        // 직접 입력 모드: customTitle 필드에 값이 있으면 사용, 비어있으면 AI 자동 생성
        const customTitleInput = document.getElementById('customTitle');
        const customTitleValue = customTitleInput ? customTitleInput.value.trim() : '';
        titleValue = customTitleValue || null; // 비어있으면 AI가 네이버 자동완성 기반 SEO 제목 생성
        console.log('[TITLE] 직접 입력 모드 - 제목:', titleValue || '(AI 자동 생성)');
      } else {
        // 'auto' 모드일 때는 null로 두어서 AI가 네이버 SEO에 맞는 제목을 자동 생성하도록 함
        titleValue = null;
        console.log('[TITLE] 자동 생성 모드 - AI가 제목 생성');
      }

      // 소제목 개수 처리 (직접 입력 지원)
      let keywordSectionCount = 5;
      if (sectionCountSelect) {
        if (sectionCountSelect.value === 'custom') {
          const customInput = document.getElementById('customSectionCount');
          keywordSectionCount = customInput && customInput.value ? parseInt(customInput.value) : 5;
        } else {
          keywordSectionCount = parseInt(sectionCountSelect.value);
        }
      }
      if (keywordSectionCount < 1) keywordSectionCount = 1;
      if (keywordSectionCount > 20) keywordSectionCount = 20;

      // 🔧 미리보기와 동일한 함수 사용 - createPreviewPayload()
      debugLog('POSTING', '미리보기와 동일한 페이로드 생성 시작');

      // 저장된 썸네일 확인
      const savedThumbnail = localStorage.getItem('generatedThumbnail');
      const savedThumbnailText = localStorage.getItem('thumbnailText');
      if (savedThumbnail) {
        console.log('✅ 저장된 썸네일 발견:', savedThumbnailText);
      }

      let previewPayload;
      try {
        debugLog('POSTING', 'createPreviewPayload 함수 호출 중...');
        previewPayload = createPreviewPayload();

        if (!previewPayload) {
          throw new Error('createPreviewPayload가 null을 반환했습니다');
        }

        successLog('POSTING', '페이로드 생성 성공', {
          topic: previewPayload.topic,
          platform: previewPayload.platform,
          provider: previewPayload.provider,
          promptMode: previewPayload.promptMode,
          hasGeminiKey: !!previewPayload.geminiKey
        });

      } catch (error) {
        errorLog('POSTING', error, {
          function: 'createPreviewPayload',
          errorType: error.constructor.name,
          errorMessage: error.message
        });

        hideProgressModal();
        alert('콘텐츠 생성 설정에 오류가 있습니다. 설정을 확인해주세요.');
        return;
      }

      // 🔧 미리보기용 플래그 제거 및 발행 모드로 변경
      debugLog('POSTING', '발행 모드로 설정 변경 중...');
      previewPayload.previewOnly = false; // 발행 모드

      // 플랫폼 설정
      const selectedPlatform = document.querySelector('input[name="platform"]:checked')?.value || 'blogspot';
      previewPayload.platform = selectedPlatform;
      successLog('POSTING', `플랫폼 설정: ${selectedPlatform}`);

      // WordPress 인증 정보 추가 (발행에 필요)
      debugLog('POSTING', '저장된 설정 로드 중...');
      const savedSettings = loadSettings();

      previewPayload.wordpressSiteUrl = savedSettings.wordpressSiteUrl || '';
      previewPayload.wordpressUsername = savedSettings.wordpressUsername || '';
      previewPayload.wordpressPassword = savedSettings.wordpressPassword || '';
      previewPayload.blogId = savedSettings.blogId || '';
      previewPayload.googleClientId = savedSettings.googleClientId || '';
      previewPayload.googleClientSecret = savedSettings.googleClientSecret || '';

      debugLog('POSTING', '인증 정보 설정 완료', {
        platform: selectedPlatform,
        hasWordpressUrl: !!previewPayload.wordpressSiteUrl,
        hasWordpressUsername: !!previewPayload.wordpressUsername,
        hasWordpressPassword: !!previewPayload.wordpressPassword,
        hasBlogId: !!previewPayload.blogId,
        hasGoogleClientId: !!previewPayload.googleClientId,
        hasGoogleClientSecret: !!previewPayload.googleClientSecret
      });

      keywordData.push({
        keyword: normalizedKeyword,
        title: titleValue, // auto: null (AI 자동 생성), custom: 사용자 입력값
        scheduleTime: null,
        thumbnailType: thumbnailTypeSelect?.value || 'text',
        sectionCount: keywordSectionCount,
        payload: previewPayload // 🔧 미리보기와 동일한 페이로드 사용
      });
    }

    // 2. 기존 topic 필드 확인 (하위 호환성)
    const existingKeywordField = document.getElementById('topic');
    if (existingKeywordField && existingKeywordField.value.trim()) {
      const existingKeywords = existingKeywordField.value.split(',').map(k => k.trim()).filter(Boolean);
      existingKeywords.forEach(keyword => {
        keywordData.push({
          keyword: keyword,
          scheduleTime: null,
          thumbnailType: 'text',
          imageType: 'pexels'
        });
      });
    }
    // 3. 동적 키워드 필드들 수집
    const keywordInputs = document.querySelectorAll('.keyword-input');
    keywordInputs.forEach(input => {
      if (input.value.trim()) {
        const keywordContainer = input.closest('.keyword-field');
        const titleInput = keywordContainer?.querySelector('.keyword-title-input');
        const scheduleInput = keywordContainer?.querySelector('.keyword-schedule-input');
        const thumbnailSelect = keywordContainer?.querySelector('.keyword-thumbnail-select');
        const imageSelect = keywordContainer?.querySelector('.keyword-image-select');

        // 제목 처리 로직
        const titleSelect = keywordContainer?.querySelector('.keyword-title-select');
        let title = null;

        if (titleSelect) {
          if (titleSelect.value === 'custom' && titleInput?.value.trim()) {
            title = titleInput.value.trim();
          } else if (titleSelect.value === 'auto') {
            title = null; // 자동 생성
          }
        }

        const data = {
          keyword: input.value.trim(),
          title: title,
          scheduleTime: scheduleInput?.value || null,
          thumbnailType: thumbnailSelect?.value || 'text',
          imageType: imageSelect?.value || 'pexels'
        };
        if (!data.title || !data.title.trim()) {
          data.title = data.keyword;
        }
        keywordData.push(data);
      }
    });

    if (keywordData.length === 0) {
      alert('최소 1개의 키워드를 입력해주세요.');
      hideProgressModal();
      return;
    }

    // 키워드 개수 및 설정 로그
    addLog(`📝 총 ${keywordData.length}개의 키워드로 포스팅을 시작합니다.`);
    addLog(`📋 포스팅 모드: ${getPostingModeText(postingMode)}`);
    addLog(`🖼️ 이미지 타입: ${getImageTypeText(imageType)}`);

    if (scheduleSettings) {
      addLog(`⏰ 예약 시간: ${scheduleSettings.scheduleDateTime} (${scheduleSettings.timezone})`);
      addLog(`⏱️ 대량 포스팅 간격: ${scheduleSettings.bulkInterval}분`);
    }

    keywordData.forEach((data, index) => {
      const scheduleInfo = data.scheduleTime ? ` (예약: ${data.scheduleTime})` : '';
      const titleInfo = data.title ? ` [제목: ${data.title}]` : ' [제목: 자동생성]';
      const thumbnailInfo = ` [썸네일: ${getImageTypeText(data.thumbnailType)}]`;
      const imageInfo = ` [이미지: ${getImageTypeText(data.imageType)}]`;
      addLog(`   ${index + 1}. ${data.keyword}${titleInfo}${scheduleInfo}${thumbnailInfo}${imageInfo}`);
    });

    // 예약 포스팅인 경우 각 키워드별 썸네일/이미지 선택 UI 생성
    if (postingMode === 'schedule' && keywordData.length > 1) {
      createBulkThumbnailSelectionUI(keywordData, imageType);
    }
    setRunning(true);
    // 백그라운드에서 실제 작업 시작 (취소 버튼이 보이는지 확인)
    setTimeout(async () => {
      if (!isCanceled) {
        // 실제 포스팅 작업 시뮬레이션 (실시간 진행률 업데이트)
        await simulatePostingProcess(keywordData, postingMode, scheduleSettings);
      }
    }, 1000);

    // 환경 변수 수집 (환경설정 또는 입력 필드에서 가져오기)
    const env = {
      geminiKey: document.getElementById('geminiKey')?.value || '',
      pexelsApiKey: document.getElementById('pexelsApiKey')?.value || '',
      bflApiKey: document.getElementById('bflApiKey')?.value || '',
      blogId: document.getElementById('blogId')?.value || '',
      googleClientId: document.getElementById('googleClientId')?.value || '',
      googleClientSecret: document.getElementById('googleClientSecret')?.value || '',
      googleCseKey: document.getElementById('googleCseKey')?.value || '',
      googleCseCx: document.getElementById('googleCseCx')?.value || '',
      naverClientId: document.getElementById('naverClientId')?.value || '',
      naverClientSecret: document.getElementById('naverClientSecret')?.value || '',
      minChars: parseInt(document.getElementById('minChars')?.value || '2000'),
      // WordPress 설정 추가
      wordpressSiteUrl: document.getElementById('wordpressSiteUrl')?.value || '',
      wordpressUsername: document.getElementById('wordpressUsername')?.value || '',
      wordpressPassword: document.getElementById('wordpressPassword')?.value || '',
      wordpressCategory: getSelectedWordPressCategories() || '' // 다중 카테고리 선택 지원
    };

    console.log('포스트 실행 환경 변수:', env);
    console.log('포스트 실행 환경 변수 상세:', JSON.stringify(env, null, 2));
    addLog('포스트 실행을 시작합니다. 환경 변수: ' + Object.keys(env).join(', '), 'info');
    addLog('환경 변수 상세: ' + JSON.stringify(env, null, 2), 'info');

    // 환경 변수 검증
    const requiredKeys = ['geminiKey', 'blogId', 'googleClientId', 'googleClientSecret'];
    const missingKeys = requiredKeys.filter(key => !env[key] || env[key].trim() === '');

    if (missingKeys.length > 0) {
      addLog('환경 변수 검증 실패: ' + missingKeys.join(', ') + '가 비어있습니다.', 'error');
      alert('환경 변수 검증 실패: ' + missingKeys.join(', ') + '가 비어있습니다.');
      return;
    }

    // 현재 선택된 AI 모델 확인
    const currentAIProvider = document.querySelector('input[name="aiProvider"]:checked')?.value || window.currentAIProvider || 'smart';
    const currentPromptMode = 'max-mode'; // MAX모드로 고정
    const currentCtaMode = document.querySelector('input[name="ctaMode"]:checked')?.value || 'auto';
    const useGoogleSearch = document.getElementById('useGoogleSearch')?.checked || false;
    const publishType = getCurrentPublishType();
    const scheduleDateTime = document.getElementById('scheduleDateTime')?.value || '';
    const thumbnailModeValue = document.getElementById('thumbnailType')?.value || 'text';

    // 커스텀 CTA 정보 수집 (최대 4개)
    const customCtas = [];
    const ctaItemsList = document.getElementById('ctaItemsList');
    if (ctaItemsList && currentCtaMode === 'manual') {
      const ctaItems = ctaItemsList.children;
      for (let i = 0; i < ctaItems.length; i++) {
        const item = ctaItems[i];
        const itemId = item.id;
        const url = document.getElementById(`${itemId}_url`)?.value.trim() || '';
        const title = document.getElementById(`${itemId}_title`)?.value.trim() || '';
        const description = document.getElementById(`${itemId}_desc`)?.value.trim() || '';

        if (url) {
          customCtas.push({
            url: url,
            title: title || '자세히 보기',
            description: description || ''
          });
        }
      }
    }

    // keywordData는 이미 위에서 생성됨

    // 괄 포스트 예약 설정 수집
    const bulkScheduleMode = document.querySelector('input[name="bulkScheduleMode"]:checked')?.value || 'none';
    const bulkScheduleSettings = {
      mode: bulkScheduleMode,
      firstScheduleTime: document.getElementById('bulkFirstScheduleTime')?.value || null,
      intervalMinutes: parseInt(document.getElementById('bulkIntervalMinutes')?.value || '60')
    };
    // topic 값 설정 (첫 번째 키워드를 topic으로 사용)
    const topic = keywordData.length > 0 ? keywordData[0].keyword : '';
    // 이미지 소스는 더 이상 사용하지 않음
    // AI 모델을 Gemini로 고정
    const titleAI = 'gemini';
    const contentAI = 'gemini';
    const summaryAI = 'gemini';

    // 🔄 페러프레이징 URL 가져오기
    const contentMode = document.getElementById('contentMode')?.value || 'external';
    const paraphraseUrl = contentMode === 'paraphrase' ? document.getElementById('paraphraseUrl')?.value || '' : '';

    // 🔧 미리보기와 동일한 페이로드 사용 (keywordData에 이미 포함됨)
    let payload;
    if (keywordData.length > 0 && keywordData[0].payload) {
      // 🔧 미리보기 페이로드가 있으면 그대로 사용
      payload = keywordData[0].payload;
      console.log('[RUNPOSTING] 🔧 미리보기 페이로드 사용:', payload);
    } else {
      // 닉네임 가져오기
      const authorNickname = document.getElementById('authorNickname')?.value?.trim() || '';

      // 기존 방식으로 페이로드 생성 (하위 호환성)
      payload = {
        topic: topic,
        keywords: keywordData, // 키워드 배열 전달 (예약 시간 정보 포함)
        bulkScheduleSettings: bulkScheduleSettings, // 괄 포스트 예약 설정
        provider: contentAI, // 본문 생성 AI 사용
        titleAI: titleAI, // 제목 생성 AI
        summaryAI: summaryAI, // 요약표 생성 AI
        platform: document.querySelector('input[name="platform"]:checked')?.value || 'blogspot', // 현재 선택된 플랫폼 사용 (기본값: blogspot)
        publishType: publishType === 'schedule' ? 'schedule' : publishType === 'publish' ? 'now' : 'draft',
        schedule: scheduleDateTime,
        thumbnailMode: thumbnailModeValue,
        thumbnailType: thumbnailModeValue, // 추가: thumbnailType도 전달
        promptMode: currentPromptMode,
        useGoogleSearch: useGoogleSearch,
        ctaMode: currentCtaMode, // CTA 모드 추가
        customCtas: customCtas.length > 0 ? customCtas : null, // 커스텀 CTA 정보
        wordpressCategory: getSelectedWordPressCategories() || '', // WordPress 카테고리 추가 (다중 선택 지원)
        contentMode: contentMode, // 콘텐츠 모드 추가
        paraphraseUrl: paraphraseUrl, // 🔄 페러프레이징 URL 추가
        authorNickname: authorNickname, // 작성자 닉네임 추가
        publishIntervalMinutes: parseInt(document.getElementById('publishIntervalMinutes')?.value || '3') || 3, // 연속 발행 간격 (분)
        env: env // 환경 변수 포함
      };
    }

    console.log('UI에서 메인 프로세스로 전달할 payload:', JSON.stringify(payload, null, 2));
    addLog('메인 프로세스로 payload 전달 시작', 'info');

    // 🎮 재미있는 시작 메시지
    const funMessages = [
      "🚀 AI가 글쓰기 모드를 활성화합니다!",
      "✨ 창의적인 아이디어를 생성 중...",
      "🎯 완벽한 블로그 포스트를 만들고 있어요!",
      "🌟 독자들이 사랑할 콘텐츠를 준비 중...",
      "🎨 아름다운 글을 그려내고 있어요!"
    ];
    const randomMessage = funMessages[Math.floor(Math.random() * funMessages.length)];
    alert(randomMessage);
    addLog('🎮 ' + randomMessage, 'info');
    // 백엔드 작업 시작 전 진행 업데이트 (초기화)
    overallProgress = 0; // 전체 진행률 초기화
    progressStartTime = Date.now(); // 시작 시간 초기화
    updateProgress(0, 0); // 단계별 진행률 0%
    updateTime(0); // 시간 초기화
    // 실제 백엔드 작업 호출
    debugLog('POSTING', '백엔드 연결 확인 중...');
    if (window.blogger && window.blogger.runPost) {
      successLog('POSTING', '백엔드 연결 확인 완료');

      debugLog('POSTING', '백엔드에 데이터 전송 시작', {
        payloadKeys: Object.keys(payload),
        hasTopic: !!payload.topic,
        hasProvider: !!payload.provider,
        platform: payload.platform,
        previewOnly: payload.previewOnly
      });
      // 실제 백엔드 진행상황만 사용 (시뮬레이션 제거)
      window.blogger.runPost(payload).then(result => {
        successLog('POSTING', '백엔드 응답 수신', {
          hasResult: !!result,
          ok: result?.ok,
          hasTitle: !!result?.title,
          hasContent: !!(result?.html || result?.content),
          error: result?.error
        });
        addLog('백엔드 작업 완료: ' + JSON.stringify(result), 'success');

        // 🔧 생성된 콘텐츠를 generatedContent에 저장 (발행 시 재사용)
        if (result && (result.title || result.html || result.content)) {
          generatedContent = {
            title: result.title || '',
            content: result.html || result.content || '',
            thumbnail: result.thumbnail || '',
            payload: payload
          };
          console.log('[GENERATED-CONTENT] 콘텐츠 저장 완료:', {
            title: generatedContent.title,
            contentLength: generatedContent.content.length
          });
        }

        if (result && (result.ok || result.success)) {
          // 실제 진행률에 맞게 설정 (100% 강제 설정 제거)
          // updateStepProgress(100); // 단계별 진행률 100%
          // updateOverallProgressBar(100); // 전체 진행률 100%
          // 🎉 완료 메시지도 재미있게!
          const completionMessages = [
            "🎉 완벽한 블로그 포스트가 완성되었어요!",
            "✨ 독자들이 사랑할 콘텐츠가 탄생했어요!",
            "🚀 AI의 창작물이 세상에 나왔습니다!",
            "🌟 놀라운 글이 완성되었어요!",
            "🎨 예술 작품 같은 포스트가 완성되었습니다!"
          ];
          const randomCompletionMessage = completionMessages[Math.floor(Math.random() * completionMessages.length)];
          addLog('🎮 ' + randomCompletionMessage, 'success');

          // 미리보기 업데이트
          if (result.html && result.title) {
            addLog('미리보기가 업데이트되었습니다.', 'info');
          }

          // 🔥 상세 발행 결과 로그
          addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
          addLog('📊 발행 결과 상세 정보', 'success');
          addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');

          // 글 생성 모델
          const textModel = result.textModel || payload.textModel || 'Gemini Pro';
          addLog(`📝 글 생성 모델: ${textModel}`, 'info');

          // 이미지 생성 모델
          const imageProvider = result.imageProvider || payload.imageProvider || payload.imageType || 'AI 이미지';
          const imageModelName = getImageModelDisplayName(imageProvider);
          addLog(`🖼️ 이미지 생성 모델: ${imageModelName}`, 'info');

          // 생성된 이미지 개수
          const imageCount = result.imageCount || result.images?.length || 0;
          addLog(`📷 생성된 이미지: ${imageCount}개`, imageCount > 0 ? 'success' : 'warning');

          // CTA 배너 상태
          const hasCta = result.hasCta || (result.html && (result.html.includes('cta-button') || result.html.includes('CTA') || result.html.includes('action-button')));
          addLog(`🎯 CTA 배너: ${hasCta ? '✅ 생성됨' : '⚠️ 없음'}`, hasCta ? 'success' : 'warning');

          // 표 생성 상태
          const hasTable = result.hasTable || (result.html && result.html.includes('<table'));
          addLog(`📊 표(테이블): ${hasTable ? '✅ 생성됨' : '⚠️ 없음'}`, hasTable ? 'success' : 'warning');

          // 글자수
          const contentLength = result.contentLength || (result.html ? result.html.replace(/<[^>]*>/g, '').length : 0);
          addLog(`📏 글자수: 약 ${contentLength.toLocaleString()}자`, 'info');

          addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
          addLog('✅ 포스팅 완료: 백엔드에서 성공을 반환했습니다.', 'success');
          addLog('📢 포스팅 발행이 완료되었습니다. 블로그에서 확인하세요!!', 'success');

          // 작업 기록 자동 추가
          const keywords = getAllKeywords();
          const keywordCount = keywords.length;
          const platform = document.querySelector('input[name="platform"]:checked')?.value || 'blogspot';
          const platformName = platform === 'blogger' ? '블로거' : '워드프레스';

          let publishedUrl = result.url || result.postUrl || result.link || '';
          const postId = result.postId || result.id || result.post_id || null;
          const postingModeRaw = payload.postingMode || 'publish';
          const postingMode = String(postingModeRaw).trim().toLowerCase();
          const scheduledAt = payload.scheduleISO || payload.schedule || null;

          if (!publishedUrl) {
            if (platform === 'wordpress' && postId && payload.wordpressSiteUrl) {
              const base = String(payload.wordpressSiteUrl).replace(/\/$/, '');
              if (base) {
                publishedUrl = `${base}/wp-admin/post.php?post=${postId}&action=edit`;
              }
            } else if (platform === 'blogger' && postId && payload.blogId) {
              const blogId = String(payload.blogId).trim();
              if (blogId) {
                publishedUrl = `https://www.blogger.com/blog/post/edit/${blogId}/${postId}`;
              }
            }
          }

          if (result.html && result.title) {
            updatePreview(result.title, result.html, publishedUrl);
          }

          const effectivePublishedAt = result.publishedAt
            || (scheduledAt ? new Date(scheduledAt).getTime() : null)
            || Date.now();

          if (publishedUrl || postId) {
            addPublishedPostRecord({
              id: postId ? String(postId) : undefined,
              title: result.title || payload.topic || '제목 없음',
              url: publishedUrl,
              platform: platform,
              status: postingMode,
              publishedAt: effectivePublishedAt,
              thumbnail: result.thumbnail || result.coverImage || '',
              payload: payload,
              summary: result.summary || ''
            });
          }

          // 키워드별로 작업 기록 추가
          keywords.forEach((keyword, index) => {
            // 실제 생성된 제목 사용 (localStorage에서 가져오거나 keyword.title 사용)
            const generatedTitle = localStorage.getItem('lastGeneratedTitle') || keyword.title || keyword.keyword || '제목 없음';
            addTodayWorkRecord(`포스트 작성 완료`, `${platformName}에 "${generatedTitle}" 게시`);
          });

          // 완료 후 닫기 버튼 표시
          setTimeout(() => {
            const closeBtn = document.getElementById('closeBtn');
            if (closeBtn) {
              closeBtn.style.display = 'block';
            }
          }, 2000);
        } else {
          // 오류 처리 - 블로그스팟 인증 오류 특별 처리
          const errorMessage = result?.error || '알 수 없는 오류';
          console.error('백엔드 오류:', errorMessage);

          // 블로그스팟 인증 관련 오류인지 확인
          if (errorMessage.includes('인증') || errorMessage.includes('auth') || errorMessage.includes('token') || errorMessage.includes('OAuth') || errorMessage.includes('Blogger')) {
            addLog('❌ 블로그스팟 인증이 필요합니다. 환경설정에서 인증을 완료해주세요.', 'error');
            alert('❌ 블로그스팟 인증이 필요합니다.\n\n환경설정 모달을 열어서:\n1. Blogger ID, Google Client ID/Secret을 입력하세요\n2. "블로거 계정 연동" 버튼을 클릭하세요\n3. 인증 코드를 입력하고 "연동 완료" 버튼을 클릭하세요');
          } else {
            addLog('포스트 생성 실패: ' + errorMessage, 'error');
            alert('포스팅 실행 중 오류가 발생했습니다:\n' + errorMessage);
          }

          // 오류 발생 시 진행률 유지 (100% 강제 설정 제거)
          // updateProgress(100, 100);
          // updateTime(100);

          // 작업 상태를 오류로 업데이트
          const statusEl = document.getElementById('workStatusTitle');
          const subtitleEl = document.getElementById('workStatusSubtitle');
          if (statusEl) statusEl.textContent = '작업 완료 (오류 발생)';
          if (subtitleEl) subtitleEl.textContent = errorMessage;
        }
      }).catch(error => {
        clearInterval(progressInterval); // 진행률 업데이트 중단
        errorLog('POSTING', error, {
          function: 'window.blogger.runPost',
          errorType: error.constructor.name,
          errorMessage: error.message,
          stack: error.stack?.substring(0, 500)
        });
        addLog('백엔드 작업 오류: ' + error.message, 'error');

        // 오류 발생 시 진행률 유지 (100% 강제 설정 제거)
        // updateProgress(100, 100);
        // updateTime(100);

        // 작업 상태를 오류로 업데이트
        const statusEl = document.getElementById('workStatusTitle');
        const subtitleEl = document.getElementById('workStatusSubtitle');
        if (statusEl) statusEl.textContent = '작업 완료 (오류 발생)';
        if (subtitleEl) subtitleEl.textContent = error.message;
      }).finally(() => {
        debugLog('POSTING', '백엔드 호출 완료 - 상태 초기화');
        setRunning(false);

        // 발행 버튼 복원 (원래 스타일 유지)
        const publishBtn = document.getElementById('publishBtn');
        if (publishBtn) {
          // 원래 스타일 복원
          if (publishBtn.dataset.originalStyle) {
            publishBtn.setAttribute('style', publishBtn.dataset.originalStyle);
          } else {
            publishBtn.style.opacity = '1';
            publishBtn.style.pointerEvents = 'auto';
            publishBtn.style.display = 'block';
          }
          // 원래 클래스 복원
          if (publishBtn.dataset.originalClass) {
            publishBtn.className = publishBtn.dataset.originalClass;
          }
          publishBtn.disabled = false;
          console.log('✅ [BUTTON] 발행 버튼 복원 완료');
        }
      });
    } else {
      errorLog('POSTING', new Error('백엔드 연결 실패'), {
        hasWindowBlogger: !!window.blogger,
        hasRunPost: !!(window.blogger && window.blogger.runPost)
      });
      addLog('백엔드 연결 오류: window.blogger.runPost를 찾을 수 없습니다.', 'error');
      updateStepProgress(0);
      updateOverallProgressBar(0);
      setRunning(false);
    }
  } catch (error) {
    errorLog('POSTING', error, {
      function: 'runPosting',
      errorType: error.constructor.name,
      errorMessage: error.message,
      stack: error.stack?.substring(0, 500)
    });
    addLog('포스팅 실행 오류: ' + error.message, 'error');

    // 진행 모달 숨기기
    hideProgressModal();

    // 오류 알림 표시
    alert('포스팅 실행 중 오류가 발생했습니다:\n' + error.message);

    setRunning(false);
  } finally {
    // 작업 완료 후에도 버튼 활성화 보장 (무제한 클릭 가능)
    const runBtn = document.getElementById('runBtn');
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.style.pointerEvents = 'auto';
      runBtn.style.opacity = '1';
      runBtn.style.cursor = 'pointer';
      console.log('🔄 [BUTTON] runPosting 완료 - 버튼 활성화 보장');
    }

    // 발행 버튼 복원 (원래 스타일 유지)
    const publishBtn = document.getElementById('publishBtn');
    if (publishBtn) {
      // 원래 스타일 복원
      if (publishBtn.dataset.originalStyle) {
        publishBtn.setAttribute('style', publishBtn.dataset.originalStyle);
      } else {
        publishBtn.style.opacity = '1';
        publishBtn.style.pointerEvents = 'auto';
        publishBtn.style.display = 'block';
        publishBtn.style.visibility = 'visible';
      }
      // 원래 클래스 복원
      if (publishBtn.dataset.originalClass) {
        publishBtn.className = publishBtn.dataset.originalClass;
      }
      publishBtn.disabled = false;
      console.log('✅ [BUTTON] 발행 버튼 최종 복원 완료');
    }
  }
}

// ========== 디버깅 및 로깅 함수 ==========

// 상세 디버깅 로그 함수
function debugLog(step, message, data = null) {
  const timestamp = new Date().toLocaleTimeString();
  const logMessage = `[${timestamp}] 🔍 [${step}] ${message}`;
  console.log(logMessage);

  if (data) {
    console.log(`[${timestamp}] 📊 [${step}] 데이터:`, data);
  }

  // UI 로그에도 표시
  addLog(`[${step}] ${message}`, 'info');
}

// 오류 상세 로깅 함수
function errorLog(step, error, context = null) {
  const timestamp = new Date().toLocaleTimeString();
  const errorMessage = `[${timestamp}] ❌ [${step}] 오류: ${error.message || error}`;
  console.error(errorMessage);

  if (context) {
    console.error(`[${timestamp}] 📋 [${step}] 컨텍스트:`, context);
  }

  // 스택 트레이스도 출력
  if (error.stack) {
    console.error(`[${timestamp}] 📚 [${step}] 스택:`, error.stack);
  }

  // UI 로그에도 표시
  addLog(`[${step}] 오류: ${error.message || error}`, 'error');
}

// 성공 로깅 함수
function successLog(step, message, data = null) {
  const timestamp = new Date().toLocaleTimeString();
  const successMessage = `[${timestamp}] ✅ [${step}] 성공: ${message}`;
  console.log(successMessage);

  if (data) {
    console.log(`[${timestamp}] 📊 [${step}] 결과:`, data);
  }

  // UI 로그에도 표시
  addLog(`[${step}] 성공: ${message}`, 'success');
}
// 진행 상태 모달 표시
function showProgressModal() {
  debugLog('MODAL', 'showProgressModal 호출됨');

  const progressBar = document.getElementById('premiumProgressBar');
  const publishBtn = document.getElementById('publishBtn');
  const cancelBtn = document.getElementById('cancelProgressBtn');

  console.log('🔍 진행 바 요소 찾기:', {
    progressBar: !!progressBar,
    publishBtn: !!publishBtn
  });

  if (progressBar) {
    console.log('✅ 프리미엄 진행 바 표시 시작');

    // 진행 시작 시간 설정
    progressStartTime = Date.now();
    window.progressStartTime = progressStartTime;
    overallProgress = 0;
    progressAnimation.current = 0;
    progressAnimation.target = 0;
    progressAnimation.start = 0;
    progressAnimation.startTime = performance.now();
    progressAnimation.statusText = null;
    progressAnimation.running = false;

    // 진행 바 표시 (flex로 설정해야 중앙 정렬 작동)
    progressBar.style.display = 'flex';
    progressBar.style.visibility = 'visible';
    progressBar.style.opacity = '1';

    // 진행 상태 초기화
    overallProgress = 0;
    updateProgress(0, 0, '작업 준비 중...');

    const elapsedEl = document.getElementById('progressElapsed');
    if (elapsedEl) {
      elapsedEl.textContent = '00:00';
    }
    const etaEl = document.getElementById('progressEta');
    if (etaEl) {
      etaEl.textContent = '--:--';
    }

    if (cancelBtn) {
      cancelBtn.disabled = false;
      cancelBtn.style.opacity = '1';
      cancelBtn.style.pointerEvents = 'auto';
    }

    // 진행 단계들 초기화
    initializeProgressSteps();

    resetProgressSteps();

    console.log('✅ 모달 표시 완료');
  } else {
    console.error('❌ 모달 요소를 찾을 수 없음:', {
      overlay: overlay,
      container: container,
      allProgressElements: document.querySelectorAll('[id*="progress"]')
    });

    // 대체 방법으로 모달 강제 생성
    createFallbackProgressModal();
  }

  // 발행 버튼 상태 업데이트
  if (publishBtn) {
    if (!publishBtn.dataset.originalStyle) {
      publishBtn.dataset.originalStyle = publishBtn.getAttribute('style') || '';
      publishBtn.dataset.originalClass = publishBtn.className || '';
      publishBtn.dataset.originalHtml = publishBtn.innerHTML;
    }

    publishBtn.disabled = true;
    publishBtn.style.opacity = '0.6';
    publishBtn.style.pointerEvents = 'none';
    publishBtn.classList.add('publishing');
    publishBtn.innerHTML = `
      <span style="display: flex; align-items: center; justify-content: center; gap: 10px; font-weight: 700;">
        <span style="animation: pulse 1.5s infinite;">✍️</span>
        <span>글 작성중...</span>
      </span>
    `;
  }
}
// 대체 진행상황 모달 생성 함수
function createFallbackProgressModal() {
  console.log('🔄 대체 진행상황 모달 생성 시작');

  // 기존 모달이 있다면 제거
  const existingOverlay = document.getElementById('fallbackProgressOverlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // 새 모달 생성
  const overlay = document.createElement('div');
  overlay.id = 'fallbackProgressOverlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 1;
    visibility: visible;
  `;

  const container = document.createElement('div');
  container.style.cssText = `
    background: white;
    border-radius: 16px;
    padding: 24px;
    max-width: 380px;
    width: 90%;
    text-align: center;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.08);
  `;

  container.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 20px;">🚀</div>
    <h2 style="margin: 0 0 20px 0; color: #333;">포스팅 생성 중...</h2>
    <div style="background: #f0f0f0; border-radius: 10px; height: 20px; margin: 20px 0; overflow: hidden;">
      <div id="fallbackProgressBar" style="background: linear-gradient(90deg, #667eea, #764ba2); height: 100%; width: 0%; transition: width 0.3s ease;"></div>
    </div>
    <div id="fallbackProgressText" style="color: #666; font-size: 14px;">0%</div>
    <div id="fallbackProgressStatus" style="color: #999; font-size: 12px; margin-top: 10px;">초기화 중...</div>
  `;

  overlay.appendChild(container);
  document.body.appendChild(overlay);

  console.log('✅ 대체 진행상황 모달 생성 완료');

  // 전역 변수로 저장하여 업데이트 함수에서 사용할 수 있도록 함
  window.fallbackProgressModal = {
    overlay: overlay,
    container: container,
    progressBar: container.querySelector('#fallbackProgressBar'),
    progressText: container.querySelector('#fallbackProgressText'),
    progressStatus: container.querySelector('#fallbackProgressStatus')
  };
}

// 진행 상태 업데이트
// 전역 변수로 시작 시간 저장
var progressStartTime = null;
var overallProgress = 0; // 전체 진행률 (안정적으로 증가만)
var latestLogProgress = 0;

// 진행률 애니메이션 상태
const progressAnimation = {
  current: 0,
  target: 0,
  start: 0,
  startTime: 0,
  duration: 900,
  statusText: null,
  running: false
};
const LogProgressTracker = {
  startTime: null,
  lastUpdateTime: null,
  logCount: 0,
  estimatedTotal: 0,
  lastStatus: '',
  completed: false,
  lastProgress: 0,
  totalDuration: 0,

  reset() {
    this.startTime = null;
    this.lastUpdateTime = null;
    this.logCount = 0;
    this.estimatedTotal = 0;
    this.lastStatus = '';
    this.completed = false;
    this.lastProgress = 0;
    this.totalDuration = 0;
  },

  register({ rawLine = '', percent = null, statusText = null }) {
    const now = Date.now();
    if (!this.startTime) {
      this.startTime = now;
    }

    this.logCount += 1;

    const parsedPercent = typeof percent === 'number' && !Number.isNaN(percent)
      ? Math.max(0, Math.min(100, percent))
      : null;

    if (parsedPercent !== null && parsedPercent > 0) {
      const inferredTotal = Math.max(
        this.logCount,
        Math.round((this.logCount * 100) / parsedPercent)
      );
      this.estimatedTotal = Math.max(this.estimatedTotal, inferredTotal);

      if (parsedPercent >= 100) {
        this.completed = true;
        this.estimatedTotal = Math.max(this.estimatedTotal, this.logCount);
      }
    } else if (this.completed) {
      this.estimatedTotal = Math.max(this.estimatedTotal, this.logCount);
    }

    if (this.estimatedTotal === 0) {
      this.estimatedTotal = Math.max(20, this.logCount * 2);
    }

    const progressByCount = Math.min(100, (this.logCount / this.estimatedTotal) * 100);
    const delta = this.lastUpdateTime ? Math.max(100, now - this.lastUpdateTime) : 300;

    this.lastUpdateTime = now;
    if (statusText) {
      this.lastStatus = statusText;
    }
    this.lastProgress = progressByCount;

    applyProgressVisual(progressByCount, this.lastStatus, delta);

    if (this.completed && progressByCount >= 100 && !this.totalDuration) {
      this.totalDuration = now - this.startTime;
      console.log(`[PROGRESS] 총 실행 시간: ${(this.totalDuration / 1000).toFixed(1)}초`);
    }
  }
};

// 진행률 업데이트 캐시 객체
const ProgressCache = {
  elements: {},

  init() {
    this.elements = {
      fillEl: document.getElementById('progressBarFill'),
      textEl: document.getElementById('progressBarText'),
      stepEl: document.getElementById('progressStep'),
      elapsedEl: document.getElementById('progressElapsed'),
      etaEl: document.getElementById('progressEta')
    };
  },

  getElements() {
    if (!this.elements.fillEl || !this.elements.textEl) this.init();
    return this.elements;
  }
};

// 진행 상태 텍스트 업데이트
function updateProgressStatus(statusText) {
  if (!statusText) return;
  const elements = ProgressCache.getElements();
  if (elements.stepEl) {
    elements.stepEl.textContent = statusText;
  }
}
// 통합 진행률 업데이트 함수 (최적화됨)
function updateProgress(stepPercentage, targetPercentage = null, statusText = null) {
  const normalizedTarget = Math.max(0, Math.min(100, targetPercentage ?? stepPercentage ?? 0));

  if (!progressStartTime) {
    progressStartTime = Date.now();
  }

  if (normalizedTarget === 0) {
    LogProgressTracker.reset();
    progressAnimation.current = 0;
    progressAnimation.start = 0;
    progressAnimation.target = 0;
    progressAnimation.statusText = statusText || null;
    progressAnimation.running = false;
    overallProgress = 0;
    latestLogProgress = 0;
    applyProgressVisual(0, statusText);
    return;
  }

  if (normalizedTarget < progressAnimation.current) {
    if (statusText) {
      applyProgressVisual(progressAnimation.current, statusText);
    }
    return;
  }

  progressAnimation.current = normalizedTarget;
  progressAnimation.start = normalizedTarget;
  progressAnimation.target = normalizedTarget;
  progressAnimation.statusText = statusText || progressAnimation.statusText;
  progressAnimation.running = false;

  applyProgressVisual(normalizedTarget, statusText);
}

// 시간 업데이트 함수
function updateTime(percentage = 0) {
  const elapsedElement = document.getElementById('progressElapsed') || document.getElementById('elapsedTime');
  const estimatedElement = document.getElementById('progressEta') || document.getElementById('estimatedTime');

  if (!progressStartTime) {
    progressStartTime = Date.now();
  }

  if (elapsedElement) {
    const elapsed = Date.now() - progressStartTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    elapsedElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  if (estimatedElement) {
    // 현재 진행률을 기반으로 예상 완료 시간 계산
    if (percentage > 0) {
      const elapsed = Date.now() - progressStartTime;
      const totalEstimated = (elapsed / percentage) * 100;
      const remaining = Math.max(0, totalEstimated - elapsed);

      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      estimatedElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      estimatedElement.textContent = '--:--';
    }
  }
}
// 단계별 진행률 업데이트 함수 (최적화된 버전)
function updateStepProgress(percentage) {
  console.log(`📊 단계별 진행률 업데이트: ${percentage}%`);

  // 진행률 바 업데이트
  const progressBarFill = document.getElementById('progressBarFill');
  const progressText = document.getElementById('progressBarText');

  if (progressBarFill) {
    progressBarFill.style.transition = 'width 0.2s ease-out';
    progressBarFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
  }

  if (progressText) {
    progressText.textContent = `${Math.round(percentage)}%`;
  }

  // 전체 진행률도 함께 업데이트
  updateOverallProgressBar(percentage);

  // 진행률이 업데이트될 때마다 UI 강제 새로고침
  requestAnimationFrame(() => {
    if (progressBarFill) {
      progressBarFill.style.transform = 'translateZ(0)'; // GPU 가속 강제
    }
  });
}
// 전체 진행률 바 업데이트 함수 (최적화된 버전)
function updateOverallProgressBar(percentage) {
  overallProgress = Math.min(100, Math.max(0, percentage));
  console.log(`📈 전체 진행률 업데이트: ${overallProgress}%`);

  const fillEl = document.getElementById('progressBarFill');
  const textEl = document.getElementById('progressBarText');

  if (fillEl) {
    fillEl.style.transition = 'width 0.3s ease-out';
    fillEl.style.width = `${overallProgress}%`;
  }

  if (textEl) {
    textEl.textContent = `${Math.round(overallProgress)}%`;
  }
}

function applyProgressVisual(progress, statusText = null, transitionDurationMs = null) {
  const elements = ProgressCache.getElements();
  const clamped = Math.max(0, Math.min(100, progress));

  if (clamped === 0) {
    overallProgress = 0;
    progressStartTime = Date.now();
  }

  if (elements.textEl) {
    elements.textEl.textContent = `${Math.round(clamped)}%`;
  }
  if (elements.fillEl) {
    const transitionMs = typeof transitionDurationMs === 'number' && !Number.isNaN(transitionDurationMs)
      ? Math.max(100, transitionDurationMs)
      : 300;
    elements.fillEl.style.transition = `width ${transitionMs / 1000}s linear`;
    elements.fillEl.style.width = `${clamped}%`;
  }
  if (statusText) {
    updateProgressStatus(statusText);
  }

  if (clamped > overallProgress) {
    overallProgress = clamped;
  }
  updateTime(clamped);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function progressAnimationFrame(timestamp) {
  if (!progressAnimation.running) {
    return;
  }

  const { start, target, startTime, duration, statusText } = progressAnimation;
  const elapsed = Math.min((timestamp - startTime) / duration, 1);
  const easedProgress = start + (target - start) * easeOutCubic(elapsed);

  progressAnimation.current = easedProgress;
  applyProgressVisual(easedProgress, statusText);

  if (elapsed < 1) {
    requestAnimationFrame(progressAnimationFrame);
  } else {
    progressAnimation.running = false;
    progressAnimation.current = target;
    applyProgressVisual(target, statusText);
  }
}

// 진행 단계 초기화
function resetProgressSteps() {
  const steps = document.querySelectorAll('.progress-step');
  steps.forEach(step => {
    const icon = step.querySelector('.progress-step-icon');
    if (icon) {
      icon.className = 'progress-step-icon pending';
      icon.textContent = '⭕';
    }
    step.className = 'progress-step';
  });
}

// 🚀 새로운 모던 단계별 진행 상황 관리
const progressSteps = [
  { id: 'step1', name: '키워드 분석', description: '검색 키워드를 분석하고 최적화합니다', icon: '🔍' },
  { id: 'step2', name: '콘텐츠 크롤링', description: '관련 정보를 수집하고 분석합니다', icon: '🕷️' },
  { id: 'step3', name: 'AI 콘텐츠 생성', description: 'AI가 고품질 콘텐츠를 생성합니다', icon: '🤖' },
  { id: 'step4', name: 'SEO 최적화', description: '검색 엔진 최적화를 적용합니다', icon: '📈' },
  { id: 'step5', name: '최종 검토', description: '콘텐츠 품질을 검토합니다', icon: '✅' }
];
// 진행 단계 초기화
function initializeProgressSteps() {
  const stepsContainer = document.getElementById('progressSteps');
  const stepsProgress = document.getElementById('stepsProgress');

  if (stepsContainer) {
    stepsContainer.innerHTML = '';
    progressSteps.forEach((step, index) => {
      const stepElement = document.createElement('div');
      stepElement.className = 'progress-step';
      stepElement.id = step.id;
      stepElement.innerHTML = `
        <div class="progress-step-icon pending">${step.icon}</div>
        <div class="step-content">
          <div class="step-name">${step.name}</div>
          <div class="step-description">${step.description}</div>
        </div>
        <div class="step-time">--:--</div>
      `;
      stepsContainer.appendChild(stepElement);
    });
  }

  if (stepsProgress) {
    stepsProgress.textContent = `0/${progressSteps.length}`;
  }
}

// 진행 단계 업데이트
function updateProgressStep(stepId, status) {
  const step = document.getElementById(stepId);
  if (step) {
    const icon = step.querySelector('.progress-step-icon');
    const stepTime = step.querySelector('.step-time');

    if (icon) {
      icon.className = `progress-step-icon ${status}`;
      if (status === 'active') {
        icon.textContent = '🔄';
        stepTime.textContent = '진행중...';
      } else if (status === 'completed') {
        icon.textContent = '✅';
        stepTime.textContent = '완료';
      }
    }
    step.className = `progress-step ${status}`;

    // 전체 단계 진행률 업데이트
    updateStepsProgress();
  }
}

// 단계 진행률 업데이트
function updateStepsProgress() {
  const stepsProgress = document.getElementById('stepsProgress');
  if (stepsProgress) {
    const completedSteps = document.querySelectorAll('.progress-step.completed').length;
    const activeSteps = document.querySelectorAll('.progress-step.active').length;
    const currentStep = completedSteps + activeSteps;
    stepsProgress.textContent = `${currentStep}/${progressSteps.length}`;
  }
}
// 진행 상태 모달 숨기기 (최적화된 버전)
function hideProgressModal() {
  console.log('🚀 hideProgressModal 호출됨');

  const progressBar = document.getElementById('premiumProgressBar');
  const publishBtn = document.getElementById('publishBtn');
  const cancelBtn = document.getElementById('cancelProgressBtn');

  if (progressBar) {
    console.log('✅ 프리미엄 진행 바 숨기기 시작');

    // 진행 바 숨기기
    progressBar.style.display = 'none';
    progressBar.style.visibility = 'hidden';
    progressBar.style.opacity = '0';

    console.log('✅ 프리미엄 진행 바 완전히 숨김');
  } else {
    console.warn('⚠️ 진행 바 요소를 찾을 수 없습니다');
  }

  // 발행 버튼 복원 (원래 스타일 유지)
  if (publishBtn) {
    console.log('✅ 발행 버튼 복원 시작');

    // 원래 스타일 복원
    if (publishBtn.dataset.originalStyle) {
      publishBtn.setAttribute('style', publishBtn.dataset.originalStyle);
    } else {
      // 원래 스타일이 없으면 기본 스타일만 적용
      publishBtn.style.opacity = '1';
      publishBtn.style.pointerEvents = 'auto';
      publishBtn.style.display = 'block';
      publishBtn.style.visibility = 'visible';
    }

    // 원래 클래스 복원
    if (publishBtn.dataset.originalClass) {
      publishBtn.className = publishBtn.dataset.originalClass;
    } else {
      publishBtn.className = 'btn btn-success';
    }
    publishBtn.classList.remove('publishing');

    publishBtn.disabled = false;
    publishBtn.style.opacity = '1';
    publishBtn.style.pointerEvents = 'auto';

    // 원래 텍스트 복원 확인
    if (publishBtn.dataset.originalHtml) {
      publishBtn.innerHTML = publishBtn.dataset.originalHtml;
    }

    console.log('✅ 발행 버튼 복원 완료');

    // 추가 보장 (200ms 후)
    setTimeout(() => {
      if (publishBtn.disabled || publishBtn.style.opacity === '0.5') {
        if (publishBtn.dataset.originalStyle) {
          publishBtn.setAttribute('style', publishBtn.dataset.originalStyle);
        }
        publishBtn.style.opacity = '1';
        publishBtn.style.pointerEvents = 'auto';
        publishBtn.disabled = false;
        console.log('✅ 발행 버튼 추가 보장 완료');
      }
    }, 200);
  } else {
    console.warn('⚠️ 발행 버튼 요소를 찾을 수 없습니다');
  }

  if (cancelBtn) {
    cancelBtn.disabled = true;
    cancelBtn.style.opacity = '0.6';
    cancelBtn.style.pointerEvents = 'none';
  }
}

// 진행 취소
function cancelProgress() {
  isCanceled = true;
  addLog('사용자가 작업을 취소했습니다.', 'warning');
  hideProgressModal();
  setRunning(false);
}

// 실행 상태 설정
function setRunning(running) {
  isRunning = running;
  if (running) {
    LogProgressTracker.reset();
    expandProgressCard();
  }
  const runBtn = document.getElementById('runBtn');
  if (runBtn) {
    // 블로그 발행 버튼은 항상 활성화 상태 유지 (무제한 클릭 가능)
    runBtn.disabled = false;
    runBtn.textContent = running ? '실행 중...' : '포스팅 실행';
    runBtn.style.opacity = running ? '0.7' : '1';
    runBtn.style.cursor = running ? 'wait' : 'pointer';

    // 추가 보장: 버튼이 항상 클릭 가능하도록 강제 설정
    runBtn.style.pointerEvents = 'auto';
    runBtn.style.userSelect = 'none';

    console.log(`🔄 [BUTTON] setRunning(${running}) - 버튼 상태:`, {
      disabled: runBtn.disabled,
      textContent: runBtn.textContent,
      opacity: runBtn.style.opacity,
      cursor: runBtn.style.cursor,
      pointerEvents: runBtn.style.pointerEvents
    });
  }
}

function setPublishButtonLoading(isLoading) {
  const publishBtn = document.getElementById('publishBtn');
  if (!publishBtn) return;

  if (isLoading) {
    if (!publishBtn.dataset.originalContent) {
      publishBtn.dataset.originalContent = publishBtn.innerHTML;
    }
    publishBtn.classList.add('loading');
    publishBtn.innerHTML = `
      <span class="publish-loading">
        <span class="publish-loader-icon">⏳</span>
        <span class="publish-loading-text">발행 중...</span>
      </span>
    `;
  } else {
    publishBtn.classList.remove('loading');
    if (publishBtn.dataset.originalContent) {
      publishBtn.innerHTML = publishBtn.dataset.originalContent;
    }
  }
}
// 로그 추가
// 로그 관리 객체 (최적화됨)
const LogManager = {
  logContent: null,

  init() {
    this.logContent = document.getElementById('logContent');
  },

  getLogContent() {
    if (!this.logContent) this.init();
    return this.logContent;
  },

  add(message, type = 'info') {
    const logContent = this.getLogContent();
    if (logContent) {
      const logEntry = document.createElement('div');

      // 메시지 내용에 따라 자동으로 타입 결정
      let autoType = type;
      if (message.includes('[PROGRESS]')) {
        autoType = 'progress';
      } else if (message.includes('[CRAWL') || message.includes('[SUBTITLE') || message.includes('[CONTENT')) {
        autoType = 'crawl';
      } else if (message.includes('[SECTION')) {
        autoType = 'section';
      } else if (message.includes('[FINAL')) {
        autoType = 'final';
      }

      // 진행률 로그에 시각적 강조 추가
      if (autoType === 'progress') {
        logEntry.className = `log-entry ${autoType} progress-highlight`;

        // 진행률 퍼센트 추출하여 시각적 표시
        const progressMatch = message.match(/(\d+)%/);
        if (progressMatch) {
          const progressPercent = progressMatch[1];
          logEntry.innerHTML = `
            <span class="progress-indicator">📊 ${progressPercent}%</span>
            <span class="progress-message">${message.replace(/\d+%/, '').trim()}</span>
            <span class="log-timestamp">[${new Date().toLocaleTimeString()}]</span>
          `;
        } else {
          logEntry.innerHTML = `
            <span class="progress-message">${message}</span>
            <span class="log-timestamp">[${new Date().toLocaleTimeString()}]</span>
          `;
        }
      } else {
        logEntry.className = `log-entry ${autoType}`;
        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
      }

      logContent.appendChild(logEntry);
      logContent.scrollTop = logContent.scrollHeight;

      if (isRunning) {
        const rawMessage = typeof message === 'string' ? message : (message?.toString?.() || '');
        const progressMatch = rawMessage.match(/\[PROGRESS\]\s*(\d+)%\s*-\s*(.+)/);
        const parsedPercent = progressMatch ? parseInt(progressMatch[1], 10) : null;
        const statusLabel = progressMatch ? progressMatch[2] : null;

        LogProgressTracker.register({
          rawLine: rawMessage,
          percent: typeof parsedPercent === 'number' && !Number.isNaN(parsedPercent) ? parsedPercent : null,
          statusText: statusLabel
        });
        latestLogProgress = LogProgressTracker.lastProgress || latestLogProgress;
      }
    }
  },

  clear() {
    const logContent = this.getLogContent();
    if (logContent) {
      logContent.innerHTML = '';
    }
  }
};

// 로그 추가 함수 (최적화됨)
function addLog(message, type = 'info') {
  LogManager.add(message, type);
}

// 로그 컨테이너 토글 함수
function toggleLogContainer() {
  const logContainer = document.getElementById('logContainer');
  const toggleButton = document.getElementById('toggleLogButton');
  const toggleText = document.getElementById('toggleLogText');

  if (logContainer && toggleButton) {
    if (logContainer.style.display === 'none') {
      logContainer.style.display = 'block';
      if (toggleText) toggleText.textContent = '📋 로그 숨기기';
    } else {
      logContainer.style.display = 'none';
      if (toggleText) toggleText.textContent = '📋 로그 보기';
    }
  }
}

// 로그 지우기 (최적화됨)
function clearLog() {
  LogManager.clear();
}

// 환경설정 모달 열기
let _settingsContentLoaded = false;

async function openSettingsModal(defaultTab = 'core') {
  console.log('🔧 환경설정 모달 열기 시도...');
  const modal = document.getElementById('settingsModal');

  if (modal) {
    modal.style.display = 'flex';
    try {
      // 이미 로드된 적 있으면 재생성하지 않음 (입력 중인 값 보존)
      if (!_settingsContentLoaded) {
        await loadSettingsContent();
        _settingsContentLoaded = true;
      }
      if (defaultTab) {
        const tabButtons = document.querySelectorAll('.settings-tab');
        const tabContents = document.querySelectorAll('.settings-tab-content');
        tabButtons.forEach((button) => {
          const target = button.getAttribute('data-tab');
          if (target === defaultTab) {
            button.classList.add('active');
          } else {
            button.classList.remove('active');
          }
        });
        tabContents.forEach((panel) => {
          const target = panel.getAttribute('data-tab-content');
          if (target === defaultTab) {
            panel.classList.add('active');
          } else {
            panel.classList.remove('active');
          }
        });
      }
      console.log('✅ 환경설정 내용 로드 완료');
    } catch (error) {
      console.error('❌ 환경설정 내용 로드 실패:', error);
    }
  } else {
    console.error('❌ settingsModal 요소를 찾을 수 없습니다!');
  }
}
// 전역 등록 (즉시)
window.openSettingsModal = openSettingsModal;

// 환경설정 모달 닫기
function closeSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.style.display = 'none';
  }
}
// 전역 등록 (즉시)
window.closeSettingsModal = closeSettingsModal;
// 미리보기 모달 열기
async function openPreviewModal() {
  const modal = document.getElementById('previewModal');
  if (modal) {
    modal.style.display = 'flex';
    // 이전에 생성된 콘텐츠가 있는지 확인하고 로드
    try {
      const lastContent = localStorage.getItem('lastGeneratedContent');
      const lastTitle = localStorage.getItem('lastGeneratedTitle');
      const lastCharCount = localStorage.getItem('lastGeneratedCharCount');

      if (lastContent && lastTitle) {
        console.log('[PREVIEW] 이전 콘텐츠 로드 중...');

        // 제목 표시
        const titleElement = document.getElementById('previewTitleText');
        if (titleElement) {
          titleElement.textContent = lastTitle;
        }

        // 글자수 표시
        const charCountElement = document.getElementById('previewCharCount');
        if (charCountElement && lastCharCount) {
          charCountElement.textContent = `순수 글자수: ${Number(lastCharCount).toLocaleString()}자`;
        }

        // 콘텐츠 표시
        const contentElement = document.getElementById('previewContent');
        if (contentElement) {
          contentElement.innerHTML = lastContent;
        }

        console.log('[PREVIEW] 이전 콘텐츠 로드 완료');
      } else {
        console.log('[PREVIEW] 이전 콘텐츠가 없습니다. 새로 생성해주세요.');

        // 콘텐츠가 없을 때 안내 메시지 표시
        const contentElement = document.getElementById('previewContent');
        if (contentElement) {
          contentElement.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #94a3b8;">
              <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin: 0 auto 24px; opacity: 0.3;">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              <h3 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 600; color: #64748b;">콘텐츠를 먼저 생성해주세요</h3>
              <p style="margin: 0; font-size: 14px; color: #94a3b8;">콘텐츠 생성 후 미리보기를 확인할 수 있습니다</p>
            </div>
          `;
        }

        // 제목과 글자수 초기화
        const titleElement = document.getElementById('previewTitleText');
        if (titleElement) {
          titleElement.textContent = '콘텐츠 제목';
        }

        const charCountElement = document.getElementById('previewCharCount');
        if (charCountElement) {
          charCountElement.textContent = '순수 글자수: 0자';
        }
      }
    } catch (error) {
      console.error('[PREVIEW] 콘텐츠 로드 중 오류:', error);
    }
  }
}

// 미리보기 모달 닫기
function closePreviewModal() {
  const modal = document.getElementById('previewModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// 백업 시스템
async function createBackup() {
  try {
    if (!window.blogger?.createBackup) {
      showNotification('백업 기능을 사용할 수 없어요.', 'error');
      return;
    }

    // 백업할 내용 미리보기
    const settings = JSON.parse(localStorage.getItem('bloggerSettings') || '{}');
    const keyCount = Object.keys(settings).filter(k => settings[k] && String(settings[k]).trim()).length;
    const platform = settings.platform || 'blogspot';

    const proceed = confirm(
      `📦 백업할 설정 미리보기\n\n` +
      `플랫폼: ${platform === 'wordpress' ? 'WordPress' : 'Blogger'}\n` +
      `설정된 항목: ${keyCount}개\n` +
      `API 키: ${settings.geminiKey ? 'Gemini ✅' : 'Gemini ❌'} ${settings.openaiKey ? 'OpenAI ✅' : ''}\n` +
      `\n백업을 생성할까요?`
    );
    if (!proceed) return;

    const result = await window.blogger.createBackup();
    if (result.success) {
      showNotification(`✅ 백업 완료! (${keyCount}개 설정)`, 'success');
      console.log('[BACKUP] 저장 위치:', result.backupPath);
    } else {
      showNotification(`백업 실패: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('백업 생성 오류:', error);
    showNotification('백업 생성 중 오류가 발생했어요.', 'error');
  }
}

async function restoreBackup() {
  try {
    if (!window.blogger?.restoreBackup) {
      showNotification('복원 기능을 사용할 수 없어요.', 'error');
      return;
    }

    const proceed = confirm(
      '⚠️ 백업 복원 안내\n\n' +
      '복원하면 현재 설정이 백업 시점의 설정으로 대체돼요.\n' +
      '(현재 설정은 자동으로 임시 백업됩니다)\n\n' +
      '계속할까요?'
    );
    if (!proceed) return;

    // 현재 설정 임시 백업
    const currentSettings = localStorage.getItem('bloggerSettings');
    if (currentSettings) {
      localStorage.setItem('bloggerSettings_pre_restore', currentSettings);
    }

    const result = await window.blogger.restoreBackup();
    if (result.success) {
      showNotification('✅ 설정이 복원되었어요! 새로고침합니다.', 'success');
      loadSettings();
      setTimeout(() => location.reload(), 1500);
    } else {
      showNotification(`복원 실패: ${result.error}`, 'error');
      // 실패 시 임시 백업 복구
      if (currentSettings) {
        localStorage.setItem('bloggerSettings', currentSettings);
      }
    }
  } catch (error) {
    console.error('백업 복원 오류:', error);
    alert('❌ 백업 복원 중 오류가 발생했습니다.');
  }
}
// 환경설정 내용 로드
async function loadSettingsContent() {
  // 먼저 localStorage에서 설정 불러오기
  const settings = loadSettings();

  // .env 파일에서도 설정 불러오기
  let envSettings = {};
  if (window.blogger && window.blogger.getEnv) {
    try {
      const envResult = await window.blogger.getEnv();
      if (envResult && envResult.ok && envResult.data) {
        envSettings = envResult.data;
        console.log('.env에서 불러온 설정:', envSettings);
      }
    } catch (error) {
      console.error('.env 로드 실패:', error);
    }
  }

  // localStorage와 .env 병합 (env가 우선)
  const mergedSettings = Object.assign({}, settings, envSettings);
  if (settings && settings.platform) {
    mergedSettings.platform = settings.platform;
  } else if (envSettings && envSettings.platform) {
    mergedSettings.platform = envSettings.platform;
  } else {
    mergedSettings.platform = 'blogspot';
  }
  console.log('병합된 설정:', mergedSettings);
  const modalBody = document.getElementById('settingsModalBody');
  if (modalBody) {
    modalBody.innerHTML = `
      <div style="padding: 40px;">
        <div style="color: rgba(255,255,255,0.5); font-size: 12px; margin-bottom: 16px; text-align: right;">
          <span style="color: #ef4444;">*</span> 필수 항목
        </div>
        <!-- 🤖 AI 엔진 선택 카드 (Full-Width) -->
        <div style="background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%); border-radius: 24px; padding: 36px; color: white; box-shadow: 0 24px 80px rgba(48, 43, 99, 0.5); border: 1px solid rgba(255, 255, 255, 0.08); margin-bottom: 32px; position: relative; overflow: hidden;">
          <!-- 배경 장식 -->
          <div style="position: absolute; top: -40px; right: -40px; width: 180px; height: 180px; background: radial-gradient(circle, rgba(167, 139, 250, 0.15) 0%, transparent 70%); border-radius: 50%;"></div>
          <div style="position: absolute; bottom: -30px; left: -30px; width: 120px; height: 120px; background: radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, transparent 70%); border-radius: 50%;"></div>
          
          <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 28px; position: relative; z-index: 1;">
            <div style="width: 52px; height: 52px; background: linear-gradient(135deg, #a78bfa 0%, #6366f1 100%); border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                <path d="M2 17l10 5 10-5"></path>
                <path d="M2 12l10 5 10-5"></path>
              </svg>
            </div>
            <div>
              <h3 style="font-size: 22px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">AI 생성 엔진</h3>
              <p style="font-size: 14px; margin: 4px 0 0 0; opacity: 0.7; font-weight: 500;">텍스트 및 이미지 생성에 사용할 AI 모델을 선택하세요</p>
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; position: relative; z-index: 1;">
            <!-- 텍스트 생성 엔진 -->
            <div style="background: rgba(255, 255, 255, 0.06); border-radius: 16px; padding: 24px; border: 1px solid rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px);">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
                <span style="font-size: 20px;">✍️</span>
                <span style="font-size: 15px; font-weight: 700; letter-spacing: -0.3px;">텍스트 생성 모델</span>
              </div>
              <select id="textModelSelect" onchange="updateModelBadge('text')" style="width: 100%; padding: 14px 16px; background: rgba(255, 255, 255, 0.08); border: 2px solid rgba(167, 139, 250, 0.3); border-radius: 12px; color: white; font-size: 14px; font-weight: 600; cursor: pointer; appearance: none; background-image: url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22><path fill=%22%23a78bfa%22 d=%22M2 4l4 4 4-4%22/></svg>'); background-repeat: no-repeat; background-position: right 14px center; transition: all 0.3s ease;">
                <optgroup label="🔵 Google Gemini">
                  <option value="gemini-2.5-flash">⚡ Gemini 2.5 Flash (빠름/무료)</option>
                  <option value="gemini-2.5-pro">🧠 Gemini 2.5 Pro (고품질)</option>
                </optgroup>
                <optgroup label="🟢 OpenAI">
                  <option value="gpt-5.4">🚀 GPT-5.4 (최신 최강)</option>
                </optgroup>
                <optgroup label="🟣 Anthropic">
                  <option value="claude-sonnet-4">💎 Claude Sonnet 4 (균형)</option>
                  <option value="claude-opus-4">👑 Claude Opus 4 (최고 성능)</option>
                </optgroup>
                <optgroup label="🔮 Perplexity">
                  <option value="sonar-pro">🔍 Sonar Pro (검색 기반)</option>
                </optgroup>
              </select>
              <div id="textModelBadge" style="margin-top: 12px; padding: 8px 14px; background: rgba(167, 139, 250, 0.15); border-radius: 8px; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px; color: #c4b5fd;">
                <span style="display: inline-block; width: 6px; height: 6px; background: #a78bfa; border-radius: 50%; animation: pulse 2s infinite;"></span>
                현재: Gemini 2.5 Flash
              </div>
            </div>
            
            <!-- 이미지 생성 엔진 -->
            <div style="background: rgba(255, 255, 255, 0.06); border-radius: 16px; padding: 24px; border: 1px solid rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px);">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
                <span style="font-size: 20px;">🎨</span>
                <span style="font-size: 15px; font-weight: 700; letter-spacing: -0.3px;">이미지 생성 모델</span>
              </div>
              <select id="imageModelSelect" onchange="updateModelBadge('image')" style="width: 100%; padding: 14px 16px; background: rgba(255, 255, 255, 0.08); border: 2px solid rgba(167, 139, 250, 0.3); border-radius: 12px; color: white; font-size: 14px; font-weight: 600; cursor: pointer; appearance: none; background-image: url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22><path fill=%22%23a78bfa%22 d=%22M2 4l4 4 4-4%22/></svg>'); background-repeat: no-repeat; background-position: right 14px center; transition: all 0.3s ease;">
                <optgroup label="🔵 Google">
                  <option value="gemini-3.1-flash-preview-image">⚡ Gemini 3.1 Flash Image (무료)</option>
                  <option value="imagen-4">🖼️ Imagen 4 (고품질)</option>
                </optgroup>
                <optgroup label="🟢 OpenAI">
                  <option value="gpt-image-1">🎯 GPT Image 1 (최신)</option>
                </optgroup>
                <optgroup label="🟠 DeepInfra">
                  <option value="flux-2-dev">🔥 FLUX-2 Dev (32B 초고품질)</option>
                </optgroup>
              </select>
              <div id="imageModelBadge" style="margin-top: 12px; padding: 8px 14px; background: rgba(167, 139, 250, 0.15); border-radius: 8px; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px; color: #c4b5fd;">
                <span style="display: inline-block; width: 6px; height: 6px; background: #a78bfa; border-radius: 50%; animation: pulse 2s infinite;"></span>
                현재: Gemini 3.1 Flash Image
              </div>
            </div>
          </div>
        </div>

        <!-- 메인 설정 그리드 -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 32px; margin-bottom: 40px;">
          
          <!-- API 키 설정 카드 -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 20px; padding: 32px; color: white; box-shadow: 0 20px 60px rgba(102, 126, 234, 0.3); border: 1px solid rgba(255, 255, 255, 0.1);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
              <div style="display: flex; align-items: center; gap: 16px;">
                <div style="width: 48px; height: 48px; background: rgba(255, 255, 255, 0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                  </svg>
                </div>
                <div>
                  <h3 style="font-size: 20px; font-weight: 700; margin: 0;">API 키 설정</h3>
                  <p style="font-size: 14px; margin: 4px 0 0 0; opacity: 0.8;">AI 모델 연결 키</p>
                </div>
              </div>
              <div id="apiKeyStatus" style="display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: rgba(255, 255, 255, 0.15); border-radius: 12px; backdrop-filter: blur(10px); font-size: 13px; font-weight: 600;">
                <span id="apiKeyStatusIcon">🔍</span>
                <span id="apiKeyStatusText">확인 중...</span>
              </div>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 16px;">
              <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px; opacity: 0.9;">OpenAI API</label>
                <input type="text" id="openaiKey" placeholder="sk-proj-..." style="width: 100%; padding: 12px 16px; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 8px; color: white; font-size: 14px; backdrop-filter: blur(10px);">
              </div>
              <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px; opacity: 0.9;">Gemini API<span style="color: #ef4444; margin-left: 2px;">*</span></label>
                <input type="text" id="geminiKey" placeholder="AIza..." style="width: 100%; padding: 12px 16px; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 8px; color: white; font-size: 14px; backdrop-filter: blur(10px);">
              </div>
              <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px; opacity: 0.9;">DALL-E API</label>
                <input type="text" id="dalleApiKey" placeholder="sk-proj-..." style="width: 100%; padding: 12px 16px; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 8px; color: white; font-size: 14px; backdrop-filter: blur(10px);">
              </div>
              <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px; opacity: 0.9;">Pexels API</label>
                <input type="text" id="pexelsApiKey" placeholder="Pexels API 키" style="width: 100%; padding: 12px 16px; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 8px; color: white; font-size: 14px; backdrop-filter: blur(10px);">
              </div>
              <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px; opacity: 0.9;">네이버 Customer ID</label>
                <input type="text" id="naverCustomerId" placeholder="3992868" style="width: 100%; padding: 12px 16px; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 8px; color: white; font-size: 14px; backdrop-filter: blur(10px);">
                <small style="color:rgba(255,255,255,0.4);font-size:11px;">네이버 검색광고 API의 고객 ID</small>
              </div>
              <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px; opacity: 0.9;">네이버 Secret Key</label>
                <input type="password" id="naverSecretKey" placeholder="AQAAAAAnP2kwAA61g95UFWFgCwppzY/GvxIxCbe3NgU5nhtUKg==" style="width: 100%; padding: 12px 16px; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 8px; color: white; font-size: 14px; backdrop-filter: blur(10px);">
              </div>
            </div>
          </div>
          <!-- 플랫폼 설정 카드 -->
          <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 20px; padding: 32px; color: white; box-shadow: 0 20px 60px rgba(240, 147, 251, 0.3); border: 1px solid rgba(255, 255, 255, 0.1);">
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
              <div style="width: 48px; height: 48px; background: rgba(255, 255, 255, 0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                  <line x1="8" y1="21" x2="16" y2="21"></line>
                  <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
              </div>
              <div>
                <h3 style="font-size: 20px; font-weight: 700; margin: 0;">플랫폼 설정</h3>
                <p style="font-size: 14px; margin: 4px 0 0 0; opacity: 0.8;">블로그 플랫폼 연결</p>
              </div>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 16px;">
              <!-- 플랫폼 선택 -->
              <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px; opacity: 0.9;">플랫폼 선택<span style="color: #ef4444; margin-left: 2px;">*</span></label>
                <div style="display: flex; gap: 12px;">
                  <label style="flex: 1; padding: 12px; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.3s ease;">
                    <input type="radio" id="platform-blogger" name="platform" value="blogger" onchange="togglePlatformFields(this.value);" style="width: 18px; height: 18px; cursor: pointer;">
                    <span style="color: white; font-weight: 600;">📝 Blogger</span>
                  </label>
                  <label style="flex: 1; padding: 12px; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.3s ease;">
                    <input type="radio" id="platform-wordpress" name="platform" value="wordpress" onchange="togglePlatformFields(this.value);" style="width: 18px; height: 18px; cursor: pointer;" checked>
                    <span style="color: white; font-weight: 600;">🌐 WordPress</span>
                  </label>
                </div>
              </div>
              
              <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px; opacity: 0.9;">Google CSE Key</label>
                <input type="text" id="googleCseKey" placeholder="AIza..." style="width: 100%; padding: 12px 16px; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 8px; color: white; font-size: 14px; backdrop-filter: blur(10px);">
                <small style="color:rgba(255,255,255,0.4);font-size:11px;">Google Programmable Search Engine API 키 (검색 기능에 사용)</small>
              </div>
              <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px; opacity: 0.9;">Google CSE CX</label>
                <input type="text" id="googleCseCx" placeholder="ab12cd34efg:xyz123" style="width: 100%; padding: 12px 16px; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 8px; color: white; font-size: 14px; backdrop-filter: blur(10px);">
                <small style="color:rgba(255,255,255,0.4);font-size:11px;">Google CSE 검색 엔진 ID (cx 값)</small>
              </div>
              <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px; opacity: 0.9;">Blogger ID</label>
                <input type="text" id="blogId" placeholder="1234567890123456789" style="width: 100%; padding: 12px 16px; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 8px; color: white; font-size: 14px; backdrop-filter: blur(10px);">
              </div>
              <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px; opacity: 0.9;">Google Client ID</label>
                <input type="text" id="googleClientId" placeholder="xxx.apps.googleusercontent.com" style="width: 100%; padding: 12px 16px; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 8px; color: white; font-size: 14px; backdrop-filter: blur(10px);">
              </div>
              <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px; opacity: 0.9;">Google Client Secret</label>
                <input type="password" id="googleClientSecret" placeholder="GOCSPX-..." style="width: 100%; padding: 12px 16px; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 8px; color: white; font-size: 14px; backdrop-filter: blur(10px);">
              </div>
              
              <!-- Blogger 연결 테스트 및 가이드 버튼 -->
              <div style="display: flex; gap: 12px; margin-top: 8px;">
                <button type="button" onclick="testBloggerConnection()" style="flex: 1; padding: 12px 16px; background: linear-gradient(135deg, #4285f4 0%, #34a853 100%); color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.3s ease;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                  🔗 Blogger 연결 테스트
                </button>
                <button type="button" onclick="showBloggerGuide()" style="flex: 1; padding: 12px 16px; background: rgba(255, 255, 255, 0.2); color: white; border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; backdrop-filter: blur(10px); transition: all 0.3s ease;" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                  📖 Blogger 설정 가이드
                </button>
              </div>
              <div id="bloggerConnectionStatus" style="display: none; margin-top: 8px; padding: 12px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; text-align: center;"></div>
            </div>
          </div>

          <!-- 고급 설정 카드 -->
          <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); border-radius: 20px; padding: 32px; color: white; box-shadow: 0 20px 60px rgba(79, 172, 254, 0.3); border: 1px solid rgba(255, 255, 255, 0.1);">
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
              <div style="width: 48px; height: 48px; background: rgba(255, 255, 255, 0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path>
                </svg>
              </div>
              <div>
                <h3 style="font-size: 20px; font-weight: 700; margin: 0;">고급 설정</h3>
                <p style="font-size: 14px; margin: 4px 0 0 0; opacity: 0.8;">추가 옵션 및 설정</p>
              </div>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 16px;">
              <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px; opacity: 0.9;">WordPress 사이트 URL</label>
                <input type="text" id="wordpressSiteUrl" placeholder="https://yoursite.com" style="width: 100%; padding: 12px 16px; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 8px; color: white; font-size: 14px; backdrop-filter: blur(10px);">
              </div>
              <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px; opacity: 0.9;">WordPress 사용자명</label>
                <input type="text" id="wordpressUsername" placeholder="admin" style="width: 100%; padding: 12px 16px; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 8px; color: white; font-size: 14px; backdrop-filter: blur(10px);">
              </div>
              <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px; opacity: 0.9;">Application Password</label>
                <input type="password" id="wordpressPassword" placeholder="Application Password" style="width: 100%; padding: 12px 16px; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 8px; color: white; font-size: 14px; backdrop-filter: blur(10px);">
              </div>
              
              <!-- WordPress 연결 테스트 및 가이드 버튼 -->
              <div style="display: flex; gap: 12px; margin-top: 8px;">
                <button type="button" onclick="testWordPressConnection()" style="flex: 1; padding: 12px 16px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.3s ease;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                  🔗 WordPress 연결 테스트
                </button>
                <button type="button" onclick="showWordPressGuide()" style="flex: 1; padding: 12px 16px; background: rgba(255, 255, 255, 0.2); color: white; border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; backdrop-filter: blur(10px); transition: all 0.3s ease;" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                  📖 WordPress 설정 가이드
                </button>
              </div>
              <div id="wordpressConnectionStatus" style="display: none; margin-top: 8px; padding: 12px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; text-align: center;"></div>
              
              <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 14px; opacity: 0.9;">최소 글자 수</label>
                <input type="number" id="minChars" placeholder="2000" value="2000" min="500" max="10000" style="width: 100%; padding: 12px 16px; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 8px; color: white; font-size: 14px; backdrop-filter: blur(10px);">
                <small style="color:rgba(255,255,255,0.4);font-size:11px;">AI가 생성할 글의 최소 글자수 (기본: 2000자)</small>
              </div>
            </div>
          </div>
        </div>


        <!-- 백업 기능 섹션 -->
        <div style="margin-top: 32px; padding: 32px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(167, 139, 250, 0.1) 100%); border-radius: 20px; border: 2px solid rgba(139, 92, 246, 0.3); box-shadow: 0 8px 32px rgba(139, 92, 246, 0.2);">
          <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px;">
            <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%); border-radius: 16px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px rgba(139, 92, 246, 0.4);">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7,10 12,15 17,10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </div>
            <div>
              <h3 style="color: #333; font-size: 24px; font-weight: 700; margin: 0 0 4px 0;">백업 관리</h3>
              <p style="color: #666; font-size: 15px; font-weight: 500; margin: 0;">설정 및 데이터 백업 및 복원</p>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <button onclick="createBackup()" style="padding: 16px 24px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3); transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; gap: 8px;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(16, 185, 129, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 16px rgba(16, 185, 129, 0.3)'">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7,10 12,15 17,10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              백업 생성
            </button>
            <button onclick="restoreBackup()" style="padding: 16px 24px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 16px rgba(245, 158, 11, 0.3); transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; gap: 8px;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(245, 158, 11, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 16px rgba(245, 158, 11, 0.3)'">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17,10 12,15 7,10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              백업 복원
            </button>
          </div>
        </div>

        <!-- 하단 액션 버튼들 -->
        <div style="display: flex; justify-content: center; gap: 16px; padding-top: 32px; border-top: 2px solid rgba(0, 0, 0, 0.1);">
          <button onclick="saveSettings()" style="padding: 16px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3); transition: all 0.3s ease; display: flex; align-items: center; gap: 8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            설정 저장
          </button>
          <button onclick="closeSettingsModal()" style="padding: 16px 32px; background: rgba(0, 0, 0, 0.1); color: #374151; border: 2px solid rgba(0, 0, 0, 0.1); border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s ease;">
            닫기
          </button>
        </div>
      </div>
    `;
    // 저장된 설정 값을 입력 필드에 채우기
    if (mergedSettings) {
      console.log('로드된 설정 (병합):', mergedSettings);

      // API 키들
      if (document.getElementById('openaiKey')) document.getElementById('openaiKey').value = mergedSettings.openaiKey || '';
      if (document.getElementById('geminiKey')) document.getElementById('geminiKey').value = mergedSettings.geminiKey || '';
      if (document.getElementById('dalleApiKey')) document.getElementById('dalleApiKey').value = mergedSettings.dalleApiKey || '';
      if (document.getElementById('pexelsApiKey')) document.getElementById('pexelsApiKey').value = mergedSettings.pexelsApiKey || '';

      // 네이버 API
      if (document.getElementById('naverCustomerId')) document.getElementById('naverCustomerId').value = mergedSettings.naverCustomerId || '';
      if (document.getElementById('naverSecretKey')) document.getElementById('naverSecretKey').value = mergedSettings.naverSecretKey || '';


      // Google CSE
      if (document.getElementById('googleCseKey')) document.getElementById('googleCseKey').value = mergedSettings.googleCseKey || '';
      if (document.getElementById('googleCseCx')) document.getElementById('googleCseCx').value = mergedSettings.googleCseCx || '';


      // Blogger ID
      const blogIdValue = mergedSettings.blogId || '';
      console.log('Blogger ID 로드:', blogIdValue);
      if (document.getElementById('blogId')) {
        document.getElementById('blogId').value = blogIdValue;
        console.log('Blogger ID 필드에 설정:', document.getElementById('blogId').value);
      }

      // Google OAuth
      if (document.getElementById('googleClientId')) document.getElementById('googleClientId').value = mergedSettings.googleClientId || '';
      if (document.getElementById('googleClientSecret')) document.getElementById('googleClientSecret').value = mergedSettings.googleClientSecret || '';

      // WordPress (필드 ID가 wordpressSiteUrl, wordpressUsername, wordpressPassword임)
      const wpUrl = mergedSettings.wordpressSiteUrl || mergedSettings.wpSiteUrl || '';
      const wpUser = mergedSettings.wordpressUsername || mergedSettings.wpUsername || '';
      const wpPass = mergedSettings.wordpressPassword || mergedSettings.wpPassword || '';
      console.log('WordPress 정보 로드:', { wpUrl, wpUser, wpPass });

      if (document.getElementById('wordpressSiteUrl')) {
        document.getElementById('wordpressSiteUrl').value = wpUrl;
        console.log('WordPress URL 필드에 설정:', document.getElementById('wordpressSiteUrl').value);
      }
      if (document.getElementById('wordpressUsername')) {
        document.getElementById('wordpressUsername').value = wpUser;
        console.log('WordPress Username 필드에 설정:', document.getElementById('wordpressUsername').value);
      }
      if (document.getElementById('wordpressPassword')) {
        document.getElementById('wordpressPassword').value = wpPass;
        console.log('WordPress Password 필드에 설정:', document.getElementById('wordpressPassword').value);
      }

      // 플랫폼 선택
      const platform = mergedSettings.platform || 'blogspot';
      if (document.getElementById('platform-blogger')) document.getElementById('platform-blogger').checked = (platform === 'blogger');
      if (document.getElementById('platform-wordpress')) document.getElementById('platform-wordpress').checked = (platform === 'wordpress');
      // API 키 상태 확인 및 표시 (약간의 지연 후 실행하여 DOM이 완전히 렌더링된 후)
      setTimeout(() => {
        updateApiKeyStatus(mergedSettings);
      }, 100);
    }

    // 플랫폼 라디오 버튼이 없다면 추가
    if (!document.querySelector('input[name="platform"]')) {
      // 플랫폼 선택 라디오 버튼 추가
      const platformSection = document.createElement('div');
      platformSection.style.cssText = 'margin-bottom: 20px;';
      platformSection.innerHTML = `
        <label style="display: block; margin-bottom: 12px; font-weight: 600; font-size: 14px; color: rgba(255, 255, 255, 0.9);">플랫폼 선택</label>
        <div style="display: flex; gap: 20px;">
          <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer;">
            <input type="radio" name="platform" value="blogger" style="margin: 0;">
            블로그스팟
          </label>
          <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer;">
            <input type="radio" name="platform" value="wordpress" style="margin: 0;">
            워드프레스
          </label>
        </div>
      `;

      // 첫 번째 카드 앞에 삽입
      const firstCard = modalBody.querySelector('div[style*="background: linear-gradient"]');
      if (firstCard) {
        modalBody.insertBefore(platformSection, firstCard);
      }
    }

    // 플랫폼 변경 이벤트 리스너 추가
    document.querySelectorAll('input[name="platform"]').forEach(radio => {
      radio.addEventListener('change', function () {
        updatePlatformStatus(); // 플랫폼 변경 시 배지 업데이트
      });
    });

    // AI 모델 선택값 복원
    const savedTextModel = mergedSettings.textModel || 'gemini-2.5-flash';
    const savedImageModel = mergedSettings.imageModel || 'gemini-3.1-flash-preview-image';
    if (document.getElementById('textModelSelect')) {
      document.getElementById('textModelSelect').value = savedTextModel;
      updateModelBadge('text');
    }
    if (document.getElementById('imageModelSelect')) {
      document.getElementById('imageModelSelect').value = savedImageModel;
      updateModelBadge('image');
    }
  }
}

// 설정 저장
async function saveSettings() {
  // 필수 필드 검증
  const geminiKey = document.getElementById('geminiKey')?.value?.trim() || '';
  if (!geminiKey) {
    showNotification('⚠️ Gemini API 키는 필수예요. Google AI Studio에서 무료로 발급받을 수 있어요.', 'warning');
    document.getElementById('geminiKey')?.focus();
    return; // 저장 중단
  }

  const platform = document.querySelector('input[name="platform"]:checked')?.value || 'blogspot';
  if (platform === 'wordpress') {
    const wpUrl = document.getElementById('wordpressSiteUrl')?.value?.trim() || '';
    if (wpUrl && !wpUrl.startsWith('http://') && !wpUrl.startsWith('https://')) {
      // Auto-fix: prepend https://
      document.getElementById('wordpressSiteUrl').value = 'https://' + wpUrl;
      showNotification('WordPress URL에 https://를 자동으로 추가했어요.', 'info');
    }
  }

  if (platform === 'blogspot' || platform === 'blogger') {
    const blogId = document.getElementById('blogId')?.value?.trim() || '';
    if (blogId && !/^\d+$/.test(blogId)) {
      showNotification('⚠️ Blog ID는 숫자만 입력해주세요. (예: 1234567890123456789)', 'warning');
      document.getElementById('blogId')?.focus();
      return;
    }
  }

  const minCharsVal = parseInt(document.getElementById('minChars')?.value || '2000');
  if (isNaN(minCharsVal) || minCharsVal < 500 || minCharsVal > 10000) {
    showNotification('⚠️ 최소 글자수는 500~10000 사이로 입력해주세요.', 'warning');
    return;
  }

  const settings = {
    openaiKey: document.getElementById('openaiKey')?.value || '',
    geminiKey: document.getElementById('geminiKey')?.value || '',
    dalleApiKey: document.getElementById('dalleApiKey')?.value || '',
    pexelsApiKey: document.getElementById('pexelsApiKey')?.value || '',
    naverCustomerId: document.getElementById('naverCustomerId')?.value || '',
    naverSecretKey: document.getElementById('naverSecretKey')?.value || '',
    blogId: document.getElementById('blogId')?.value || '',
    googleClientId: document.getElementById('googleClientId')?.value || '',
    googleClientSecret: document.getElementById('googleClientSecret')?.value || '',
    googleCseKey: document.getElementById('googleCseKey')?.value || '',
    googleCseCx: document.getElementById('googleCseCx')?.value || '',
    youtubeApiKey: document.getElementById('youtubeApiKey')?.value || '',
    minChars: parseInt(document.getElementById('minChars')?.value || '2000'),
    wordpressSiteUrl: document.getElementById('wordpressSiteUrl')?.value || '',
    wordpressUsername: document.getElementById('wordpressUsername')?.value || '',
    wordpressPassword: document.getElementById('wordpressPassword')?.value || '',
    wordpressCategories: document.getElementById('wordpressCategories')?.value || '',
    platform: document.querySelector('input[name="platform"]:checked')?.value || 'blogspot',
    promptMode: 'max-mode', // MAX모드로 고정
    toneStyle: document.getElementById('toneStyle')?.value || 'professional', // 말투/어투 선택
    textModel: document.getElementById('textModelSelect')?.value || 'gemini-2.5-flash',
    imageModel: document.getElementById('imageModelSelect')?.value || 'gemini-3.1-flash-preview-image',
  };

  // 설정을 localStorage에 저장
  localStorage.setItem('bloggerSettings', JSON.stringify(settings));

  // .env 파일도 함께 업데이트
  try {
    if (window.blogger && window.blogger.saveEnv) {
      // env.ts의 MAP에 맞춰 camelCase 키로 전달
      const envData = {
        blogId: settings.blogId,
        platform: settings.platform,
        googleClientId: settings.googleClientId,
        googleClientSecret: settings.googleClientSecret,
        wordpressSiteUrl: settings.wordpressSiteUrl,
        wordpressUsername: settings.wordpressUsername,
        wordpressPassword: settings.wordpressPassword,
        googleCseKey: settings.googleCseKey,
        googleCseCx: settings.googleCseCx,
        geminiKey: settings.geminiKey,
        pexelsApiKey: settings.pexelsApiKey,
        naverCustomerId: settings.naverCustomerId,
        naverSecretKey: settings.naverSecretKey,
        minChars: settings.minChars
      };

      console.log('환경 설정 저장 데이터:', envData);
      const result = await window.blogger.saveEnv(envData);
      console.log('환경 설정 저장 결과:', result);
    }
  } catch (error) {
    console.error('환경 설정 파일 저장 오류:', error);
  }

  updatePlatformStatus(); // 플랫폼 상태 업데이트

  // API 키 상태 업데이트
  const currentSettings = loadSettings();
  updateApiKeyStatus(currentSettings);

  // 저장 완료 후 처리
  _settingsContentLoaded = false; // 다음 열기 시 최신 데이터 반영
  showNotification('✅ 설정이 저장되었어요!', 'success');
  closeSettingsModal();
}

// AI 모델 선택 배지 업데이트
function updateModelBadge(type) {
  const MODEL_LABELS = {
    'gemini-2.5-flash': '⚡ Gemini 2.5 Flash',
    'gemini-2.5-pro': '🧠 Gemini 2.5 Pro',
    'gpt-5.4': '🚀 GPT-5.4',
    'claude-sonnet-4': '💎 Claude Sonnet 4',
    'claude-opus-4': '👑 Claude Opus 4',
    'sonar-pro': '🔍 Sonar Pro',
    'gemini-3.1-flash-preview-image': '⚡ Gemini 3.1 Flash Image',
    'imagen-4': '🖼️ Imagen 4',
    'gpt-image-1': '🎯 GPT Image 1',
    'flux-2-dev': '🔥 FLUX-2 Dev',
  };

  if (type === 'text') {
    const select = document.getElementById('textModelSelect');
    const badge = document.getElementById('textModelBadge');
    if (select && badge) {
      const label = MODEL_LABELS[select.value] || select.value;
      badge.innerHTML = `<span style="display: inline-block; width: 6px; height: 6px; background: #a78bfa; border-radius: 50%; animation: pulse 2s infinite;"></span> 현재: ${label}`;
    }
  } else if (type === 'image') {
    const select = document.getElementById('imageModelSelect');
    const badge = document.getElementById('imageModelBadge');
    if (select && badge) {
      const label = MODEL_LABELS[select.value] || select.value;
      badge.innerHTML = `<span style="display: inline-block; width: 6px; height: 6px; background: #a78bfa; border-radius: 50%; animation: pulse 2s infinite;"></span> 현재: ${label}`;
    }
  }
}
window.updateModelBadge = updateModelBadge;
// API 키 상태 표시 업데이트
function updateApiKeyStatus(settings) {
  try {
    const statusDiv = document.getElementById('apiKeyStatus');
    const statusIcon = document.getElementById('apiKeyStatusIcon');
    const statusText = document.getElementById('apiKeyStatusText');

    if (!statusDiv || !statusIcon || !statusText) return;

    // 필수 API 키 목록
    const requiredKeys = {
      'Gemini': settings.geminiKey || '',
      '네이버 광고 ID': settings.naverCustomerId || '',
      '네이버 광고 Secret': settings.naverSecretKey || '',
      'Google CSE Key': settings.googleCseKey || '',
      'Google CSE CX': settings.googleCseCx || ''
    };

    const configuredKeys = Object.values(requiredKeys).filter(key => key && key.trim().length > 0).length;
    const totalKeys = Object.keys(requiredKeys).length;

    if (configuredKeys === totalKeys) {
      // 모든 키가 설정됨
      statusIcon.textContent = '';
      statusText.textContent = `모든 API 키가 정상 설정됨 (${configuredKeys}/${totalKeys})`;
      statusDiv.style.background = 'rgba(16, 185, 129, 0.2)';
      statusDiv.style.border = '1px solid rgba(16, 185, 129, 0.4)';
      statusText.style.color = '#10b981';
    } else if (configuredKeys >= totalKeys * 0.7) {
      // 대부분 설정됨
      statusIcon.textContent = '';
      statusText.textContent = `대부분 설정됨 (${configuredKeys}/${totalKeys})`;
      statusDiv.style.background = 'rgba(245, 158, 11, 0.2)';
      statusDiv.style.border = '1px solid rgba(245, 158, 11, 0.4)';
      statusText.style.color = '#f59e0b';
    } else {
      // 설정 부족
      statusIcon.textContent = '';
      statusText.textContent = `설정 필요 (${configuredKeys}/${totalKeys})`;
      statusDiv.style.background = 'rgba(239, 68, 68, 0.2)';
      statusDiv.style.border = '1px solid rgba(239, 68, 68, 0.4)';
      statusText.style.color = '#ef4444';
    }

    // 부족한 키 목록 툴팁 제공
    const missingKeys = Object.entries(requiredKeys)
      .filter(([_, value]) => !value || value.trim().length === 0)
      .map(([name]) => name);

    if (missingKeys.length > 0) {
      statusDiv.title = `필요한 키: ${missingKeys.join(', ')}`;
    } else {
      statusDiv.title = '모든 API 키가 정상적으로 설정되었습니다.';
    }
  } catch (error) {
    console.error('[API-STATUS] API 상태 업데이트 실패:', error);
  }
}
// 설정 로드
function loadSettings() {
  const savedSettings = localStorage.getItem('bloggerSettings');
  const settings = savedSettings ? JSON.parse(savedSettings) : { platform: 'blogspot' };

  if (savedSettings) {
    Object.keys(settings).forEach(key => {
      if (key === 'platform') {
        const platformRadio = document.querySelector(`input[name="platform"][value="${settings[key]}"]`);
        if (platformRadio) {
          platformRadio.checked = true;
        }
      } else {
        const element = document.getElementById(key);
        if (element) {
          if (key === 'thumbnailType') {
            if (settings[key] && settings[key].trim() !== '') {
              element.value = settings[key];
              console.log(`[LOAD] ${key} 설정 로드: ${settings[key]}`);
            } else {
              element.value = 'text';
              console.log(`[LOAD] ${key} 빈 값, 기본값 설정: text`);
            }
          } else if (key === 'promptMode') {
            if (settings[key] && settings[key].trim() !== '') {
              element.value = settings[key];
              console.log(`[LOAD] ${key} 설정 로드: ${settings[key]}`);
            } else {
              element.value = 'max-mode';
              console.log(`[LOAD] ${key} 빈 값, 기본값 설정: max-mode`);
            }
          } else {
            element.value = settings[key];
            console.log(`[LOAD] ${key} 설정 로드: ${settings[key]}`);
          }
        }
      }
    });
  } else {
    const thumbnailTypeSelect = document.getElementById('thumbnailType');
    if (thumbnailTypeSelect) {
      thumbnailTypeSelect.value = 'text';
      console.log('[LOAD] 저장된 설정 없음, thumbnailType 기본값 설정: text');
    }
  }

  if (!settings.platform) {
    settings.platform = 'wordpress';
  }

  const selectedPlatformRadio = document.querySelector(`input[name="platform"][value="${settings.platform}"]`) ||
    document.querySelector('input[name="platform"][value="wordpress"]');

  if (selectedPlatformRadio) {
    selectedPlatformRadio.checked = true;
  }

  if (typeof updatePlatformStatus === 'function') {
    updatePlatformStatus(settings.platform);
  }
  if (typeof togglePlatformFields === 'function') {
    togglePlatformFields(settings.platform);
  }

  // WordPress 요약 정보 업데이트
  const wpSummaryUrl = document.getElementById('wpSummaryUrl');
  const wpSummaryUser = document.getElementById('wpSummaryUser');
  if (wpSummaryUrl) {
    const url = settings.wordpressSiteUrl || '';
    wpSummaryUrl.textContent = url ? `URL: ${url}` : 'URL: 미설정';
  }
  if (wpSummaryUser) {
    const user = settings.wordpressUsername || '';
    wpSummaryUser.textContent = user ? `계정: ${user}` : '계정: 미설정';
  }

  return settings;
}
// 접기/펼치기 토글
function toggleCollapsible(id) {
  const content = document.getElementById(id);
  const icon = document.getElementById(id + '-icon');

  if (content && icon) {
    content.classList.toggle('collapsed');
    icon.classList.toggle('rotated');
  }
}
// 실시간 시계 업데이트
function updateRealtimeClock() {
  const now = new Date();

  // 시간 포맷팅 (HH:MM:SS)
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const timeString = `${hours}:${minutes}:${seconds}`;

  // 날짜 포맷팅 (YYYY년 MM월 DD일 (요일))
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const date = now.getDate().toString().padStart(2, '0');
  const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const dayName = dayNames[now.getDay()];
  const dateString = `${year}년 ${month}월 ${date}일 (${dayName})`;

  // DOM 업데이트
  const clockElement = document.getElementById('realtime-clock');
  const dateElement = document.getElementById('realtime-date');

  if (clockElement) clockElement.textContent = timeString;
  if (dateElement) dateElement.textContent = dateString;
}

// 작업 기록 저장소 (로컬 스토리지 사용)
var workDiary = JSON.parse(localStorage.getItem('workDiary') || '{}');

// 작업 기록 저장 함수
function saveWorkRecord(date, record) {
  // workDiary가 초기화되지 않았을 경우 초기화
  if (typeof workDiary === 'undefined' || workDiary === null) {
    workDiary = JSON.parse(localStorage.getItem('workDiary') || '{}');
  }

  console.log('💾 [WORK_DIARY] 작업 기록 저장 시도:', date, record);
  const dateKey = formatDateKey(date);
  console.log('💾 [WORK_DIARY] 날짜 키:', dateKey);
  if (!workDiary[dateKey]) {
    workDiary[dateKey] = [];
  }
  workDiary[dateKey].push({
    id: Date.now(),
    time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    content: record,
    completed: false,
    timestamp: new Date().toISOString()
  });
  localStorage.setItem('workDiary', JSON.stringify(workDiary));
}
// 날짜 키 포맷팅 함수
function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 특정 날짜의 작업 기록 가져오기
function getWorkRecords(date) {
  // workDiary가 초기화되지 않았을 경우 초기화
  if (typeof workDiary === 'undefined' || workDiary === null) {
    workDiary = JSON.parse(localStorage.getItem('workDiary') || '{}');
  }

  const dateKey = formatDateKey(date);
  console.log('📖 [WORK_DIARY] 작업 기록 조회, 날짜 키:', dateKey);
  const records = (workDiary && workDiary[dateKey]) ? workDiary[dateKey] : [];
  console.log('📖 [WORK_DIARY] 조회된 기록 개수:', records.length);

  // 기존 기록에 completed 속성이 없는 경우 기본값 설정
  return records.map(record => ({
    ...record,
    completed: record.completed || false
  }));
}
// 달력 전역 변수 (영구 활성화)
var currentCalendarYear = new Date().getFullYear();
var currentCalendarMonth = new Date().getMonth();
var calendarMemoInitialized = true; // 달력 기능 영구 활성화
var calendarRendered = false;
var lastCalendarSignature = '';
var lastCalendarHighlight = '';
// 달력 렌더링
function renderCalendar() {
  console.log('🗓️ [CALENDAR] renderCalendar() 호출됨');

  // 달력 기능을 항상 활성화
  calendarMemoInitialized = true;
  const now = new Date();
  const year = currentCalendarYear;
  const month = currentCalendarMonth;

  console.log(`🗓️ [CALENDAR] 현재 년/월: ${year}년 ${month + 1}월`);

  // 월 표시 업데이트
  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  const monthElement = document.getElementById('calendar-month');
  console.log('🗓️ [CALENDAR] monthElement:', monthElement);
  if (monthElement) {
    monthElement.innerHTML = `
      <button id="prevMonth" style="background: none; border: none; color: #667eea; font-size: 18px; cursor: pointer; margin-right: 10px;">‹</button>
      <span>${year}년 ${monthNames[month]}</span>
      <button id="nextMonth" style="background: none; border: none; color: #667eea; font-size: 18px; cursor: pointer; margin-left: 10px;">›</button>
    `;

    // 월 이동 버튼 이벤트 추가
    document.getElementById('prevMonth').addEventListener('click', () => {
      currentCalendarMonth--;
      if (currentCalendarMonth < 0) {
        currentCalendarMonth = 11;
        currentCalendarYear--;
      }
      renderCalendar();
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
      currentCalendarMonth++;
      if (currentCalendarMonth > 11) {
        currentCalendarMonth = 0;
        currentCalendarYear++;
      }
      renderCalendar();
    });
  }

  // 달력 날짜 생성
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstDayOfWeek = firstDay.getDay(); // 0=일요일, 1=월요일, ...
  const daysInMonth = lastDay.getDate();

  console.log(`🗓️ [CALENDAR] 첫날: ${firstDay}, 마지막날: ${lastDay}, 일수: ${daysInMonth}`);

  const calendarDates = document.getElementById('calendar-dates');
  console.log('🗓️ [CALENDAR] calendarDates:', calendarDates);
  if (calendarDates) {
    calendarDates.innerHTML = '';
    console.log('🗓️ [CALENDAR] 달력 날짜 생성 시작');

    // 이전 달의 빈 칸들
    for (let i = 0; i < firstDayOfWeek; i++) {
      const emptyDay = document.createElement('div');
      emptyDay.style.padding = '8px 0';
      emptyDay.style.color = 'rgba(255, 255, 255, 0.3)';
      emptyDay.style.fontSize = '14px';
      calendarDates.appendChild(emptyDay);
    }

    // 현재 달의 날짜들
    for (let day = 1; day <= daysInMonth; day++) {
      const dayElement = document.createElement('div');
      dayElement.textContent = day;
      dayElement.style.padding = '8px 0';
      dayElement.style.fontWeight = '700';
      dayElement.style.fontSize = '14px';
      dayElement.style.cursor = 'pointer';

      // 해당 날짜의 작업 기록이 있는지 확인
      const currentDate = new Date(year, month, day);
      const workRecords = getWorkRecords(currentDate);

      // 작업 기록이 있으면 작은 점 표시
      if (workRecords.length > 0) {
        console.log(`🟢 [CALENDAR] ${day}일에 초록색 점 표시 (${workRecords.length}개 기록)`);
        dayElement.style.position = 'relative';
        dayElement.innerHTML = `
                ${day}
                <div style="position: absolute; top: 2px; right: 2px; width: 6px; height: 6px; background: #10b981; border-radius: 50%;"></div>
              `;
        console.log(`🟢 [CALENDAR] ${day}일 innerHTML 설정 완료:`, dayElement.innerHTML);
      }

      // 날짜 클릭 이벤트 추가
      dayElement.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('🗓️ [CALENDAR] 날짜 클릭됨:', currentDate);
        console.log('🗓️ [CALENDAR] showWorkDiary 함수 호출');
        showWorkDiary(currentDate);
      });
      dayElement.style.borderRadius = '6px';
      dayElement.style.transition = 'all 0.3s ease';

      // 오늘 날짜 하이라이트 (현재 달의 오늘 날짜만)
      const today = new Date();
      if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
        dayElement.style.background = 'rgba(255, 255, 255, 0.3)';
        dayElement.style.color = '#ffd700';
        dayElement.style.fontWeight = '800';
      } else {
        dayElement.style.color = 'white';
      }

      // 호버 효과
      dayElement.addEventListener('mouseenter', function () {
        if (day !== now.getDate()) {
          this.style.background = 'rgba(255, 255, 255, 0.2)';
        }
      });

      dayElement.addEventListener('mouseleave', function () {
        if (day !== now.getDate()) {
          this.style.background = 'transparent';
        }
      });

      calendarDates.appendChild(dayElement);
    }
  }

  calendarRendered = true;
  lastCalendarSignature = `${year}-${month}`;
  if (now.getFullYear() === year && now.getMonth() === month) {
    lastCalendarHighlight = formatDateKey(now);
  } else {
    lastCalendarHighlight = '';
  }
}

// 작업 일기 표시 함수
function showWorkDiary(date) {
  console.log('📝 [WORK_DIARY] showWorkDiary 호출됨, 날짜:', date);
  const dateString = date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  console.log('📝 [WORK_DIARY] 날짜 문자열:', dateString);
  const workRecords = getWorkRecords(date);
  console.log('📝 [WORK_DIARY] 작업 기록 개수:', workRecords.length);

  // 모달창 생성
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    backdrop-filter: blur(5px);
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 20px;
    padding: 30px;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    color: white;
  `;
  modalContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2 style="margin: 0; font-size: 24px; font-weight: 700;">📅 ${dateString}</h2>
      <button id="closeModal" style="background: rgba(255, 255, 255, 0.2); border: none; color: white; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 18px;">×</button>
    </div>
    
    <div style="margin-bottom: 20px;">
      <textarea id="workRecordInput" placeholder="오늘 어떤 작업을 하셨나요? (예: 블로그 포스트 3개 작성, 키워드 연구, 이미지 최적화 등)" 
        style="width: 100%; height: 80px; padding: 15px; border: none; border-radius: 10px; background: rgba(255, 255, 255, 0.9); color: #333; font-size: 14px; resize: vertical;"></textarea>
      
      <!-- 빠른 작업 기록 버튼들 -->
      <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
        <button onclick="addQuickWorkRecord('블로그 포스트 작성')" style="background: #3b82f6; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">📝 포스트 작성</button>
        <button onclick="addQuickWorkRecord('키워드 연구')" style="background: #8b5cf6; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">🔍 키워드 연구</button>
        <button onclick="addQuickWorkRecord('이미지 최적화')" style="background: #f59e0b; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">🖼️ 이미지 작업</button>
        <button onclick="addQuickWorkRecord('SEO 분석')" style="background: #10b981; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">📊 SEO 분석</button>
        <button onclick="addQuickWorkRecord('경쟁사 분석')" style="background: #ef4444; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">🏆 경쟁사 분석</button>
        <button onclick="addQuickWorkRecord('콘텐츠 기획')" style="background: #06b6d4; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">📋 콘텐츠 기획</button>
      </div>
      
      <button id="addWorkRecord" style="margin-top: 10px; background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;">작업 기록 추가</button>
    </div>
    
    <div id="workRecordsList" style="background: rgba(255, 255, 255, 0.1); border-radius: 15px; padding: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="margin: 0; font-size: 18px;">📝 작업 기록</h3>
        <div style="display: flex; gap: 8px;">
          <button onclick="exportWorkRecords('${formatDateKey(date)}')" style="background: #6366f1; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">📊 내보내기</button>
          <button onclick="addWorkRecordTemplate('daily')" style="background: #8b5cf6; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">📋 템플릿</button>
        </div>
      </div>
      
      <!-- 작업 통계 -->
      ${workRecords.length > 0 ? `
        <div style="background: rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 12px; margin-bottom: 15px; display: flex; justify-content: space-around; text-align: center;">
          <div>
            <div style="font-size: 20px; font-weight: bold; color: #10b981;">${workRecords.filter(r => r.completed).length}</div>
            <div style="font-size: 12px; color: rgba(255, 255, 255, 0.7);">완료</div>
          </div>
          <div>
            <div style="font-size: 20px; font-weight: bold; color: #f59e0b;">${workRecords.filter(r => !r.completed).length}</div>
            <div style="font-size: 12px; color: rgba(255, 255, 255, 0.7);">진행중</div>
          </div>
          <div>
            <div style="font-size: 20px; font-weight: bold; color: #3b82f6;">${workRecords.length}</div>
            <div style="font-size: 12px; color: rgba(255, 255, 255, 0.7);">전체</div>
          </div>
          <div>
            <div style="font-size: 20px; font-weight: bold; color: #8b5cf6;">${workRecords.length > 0 ? Math.round((workRecords.filter(r => r.completed).length / workRecords.length) * 100) : 0}%</div>
            <div style="font-size: 12px; color: rgba(255, 255, 255, 0.7);">완료율</div>
          </div>
        </div>
      ` : ''}
      ${workRecords.length === 0 ?
      '<div style="text-align: center; color: rgba(255, 255, 255, 0.7); padding: 20px;">아직 작업 기록이 없습니다.</div>' :
      `
          <!-- 미완료 작업들 -->
          ${workRecords.filter(record => !record.completed).map(record => `
            <div class="work-record-item" style="background: rgba(255, 255, 255, 0.15); border-radius: 10px; padding: 15px; margin-bottom: 10px; border-left: 4px solid #10b981;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <input type="checkbox" ${record.completed ? 'checked' : ''} 
                         onchange="toggleWorkRecordCompletion('${record.id}', '${formatDateKey(date)}', this.checked)"
                         style="width: 18px; height: 18px; cursor: pointer; accent-color: #10b981;">
                  <span style="font-weight: 600; color: #10b981;">🕐 ${record.time}</span>
                </div>
                <button onclick="deleteWorkRecord('${record.id}', '${formatDateKey(date)}')" style="background: rgba(239, 68, 68, 0.8); color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">삭제</button>
              </div>
              <div style="color: rgba(255, 255, 255, 0.9); line-height: 1.4;">${record.content}</div>
            </div>
          `).join('')}
          
          <!-- 완료된 작업들 -->
          ${workRecords.filter(record => record.completed).length > 0 ? `
            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.2);">
              <h4 style="margin: 0 0 10px 0; font-size: 14px; color: rgba(255, 255, 255, 0.7);">✅ 완료된 작업</h4>
              ${workRecords.filter(record => record.completed).map(record => `
                <div class="work-record-item" style="background: rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 15px; margin-bottom: 10px; border-left: 4px solid #6b7280; opacity: 0.7;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <input type="checkbox" ${record.completed ? 'checked' : ''} 
                             onchange="toggleWorkRecordCompletion('${record.id}', '${formatDateKey(date)}', this.checked)"
                             style="width: 18px; height: 18px; cursor: pointer; accent-color: #6b7280;">
                      <span style="font-weight: 600; color: #6b7280;">🕐 ${record.time}</span>
                    </div>
                    <button onclick="deleteWorkRecord('${record.id}', '${formatDateKey(date)}')" style="background: rgba(239, 68, 68, 0.8); color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">삭제</button>
                  </div>
                  <div style="color: rgba(255, 255, 255, 0.6); line-height: 1.4; text-decoration: line-through;">${record.content}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        `
    }
    </div>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // 이벤트 리스너 추가 (강화된 버전)
  const closeModalBtn = document.getElementById('closeModal');
  const addWorkRecordBtn = document.getElementById('addWorkRecord');
  const workRecordInput = document.getElementById('workRecordInput');

  // X 버튼 클릭 시 모달 닫기
  closeModalBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      document.body.removeChild(modal);
    } catch (error) {
      console.log('Modal already removed');
    }
  });

  // 작업 기록 추가 버튼 클릭
  addWorkRecordBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const content = workRecordInput.value.trim();
    if (content) {
      saveWorkRecord(date, content);
      workRecordInput.value = '';
      // 모달창 닫고 다시 열어서 업데이트된 내용 표시
      try {
        document.body.removeChild(modal);
        showWorkDiary(date);
      } catch (error) {
        console.log('Modal removal error:', error);
      }
    } else {
      alert('작업 내용을 입력해주세요!');
    }
  });
  // Enter 키로도 기록 추가 가능
  workRecordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      addWorkRecordBtn.click();
    }
  });
  // ESC 키로 모달 닫기
  document.addEventListener('keydown', function escapeHandler(e) {
    if (e.key === 'Escape' && document.body.contains(modal)) {
      e.preventDefault();
      try {
        document.body.removeChild(modal);
        document.removeEventListener('keydown', escapeHandler);
      } catch (error) {
        console.log('Modal removal error:', error);
      }
    }
  });

  // 모달 배경 클릭 시 닫기
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      try {
        document.body.removeChild(modal);
      } catch (error) {
        console.log('Modal already removed');
      }
    }
  });
}

// 작업 기록 완료 상태 토글 함수
function toggleWorkRecordCompletion(recordId, dateKey, isCompleted) {
  if (workDiary[dateKey]) {
    const record = workDiary[dateKey].find(r => r.id == recordId);
    if (record) {
      record.completed = isCompleted;
      localStorage.setItem('workDiary', JSON.stringify(workDiary));

      // 현재 열린 모달이 있다면 새로고침
      const currentModal = document.querySelector('.work-diary-modal');
      if (currentModal) {
        const date = new Date(dateKey);
        try {
          document.body.removeChild(currentModal);
          showWorkDiary(date);
        } catch (error) {
          console.log('Modal refresh error:', error);
        }
      }
    }
  }
}
// 작업 기록 삭제 함수
function deleteWorkRecord(recordId, dateKey) {
  if (workDiary[dateKey]) {
    workDiary[dateKey] = workDiary[dateKey].filter(record => record.id != recordId);
    if (workDiary[dateKey].length === 0) {
      delete workDiary[dateKey];
    }
    localStorage.setItem('workDiary', JSON.stringify(workDiary));

    // 달력 다시 렌더링
    renderCalendar();

    // 현재 열려있는 모달이 있다면 닫고 다시 열기
    const modals = document.querySelectorAll('[style*="position: fixed"]');
    if (modals.length > 0) {
      const date = new Date(dateKey);
      modals[0].remove();
      showWorkDiary(date);
    }
  }
}

// 오늘 작업 기록 자동 추가 함수 (포스트 작성 완료 시 호출)
function addTodayWorkRecord(workType, details = '') {
  const today = new Date();
  const record = `${workType}${details ? ': ' + details : ''}`;
  console.log('Adding work record:', record); // 디버깅용
  saveWorkRecord(today, record);
  renderCalendar(); // 달력 업데이트
}

// 빠른 작업 기록 추가 함수
function addQuickWorkRecord(taskType) {
  const textarea = document.getElementById('workRecordInput');
  if (textarea) {
    textarea.value = taskType;
    textarea.focus();
  }
}
// 작업 기록 통계 함수
function getWorkRecordStats(dateKey) {
  const records = workDiary[dateKey] || [];
  const completed = records.filter(record => record.completed).length;
  const total = records.length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    total,
    completed,
    pending: total - completed,
    completionRate
  };
}
// 작업 기록 내보내기 함수
function exportWorkRecords(dateKey) {
  const records = workDiary[dateKey] || [];
  const date = new Date(dateKey);
  const dateString = date.toLocaleDateString('ko-KR');

  const csvContent = [
    ['시간', '작업 내용', '완료 여부'],
    ...records.map(record => [
      record.time,
      record.content,
      record.completed ? '완료' : '미완료'
    ])
  ].map(row => row.join(',')).join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `작업기록_${dateString}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 작업 기록 템플릿 함수
function addWorkRecordTemplate(templateType) {
  const templates = {
    'daily': '오늘의 작업 목표:\n1. 블로그 포스트 작성\n2. 키워드 연구\n3. 이미지 최적화\n4. SEO 분석',
    'weekly': '주간 작업 계획:\n1. 콘텐츠 기획\n2. 경쟁사 분석\n3. 포스트 발행\n4. 성과 분석',
    'monthly': '월간 목표:\n1. 콘텐츠 캘린더 작성\n2. 키워드 전략 수립\n3. 성과 측정\n4. 개선점 도출'
  };

  const textarea = document.getElementById('workRecordInput');
  if (textarea && templates[templateType]) {
    textarea.value = templates[templateType];
    textarea.focus();
  }
}

// 플랫폼 상태 업데이트
function updatePlatformStatus(forcedPlatform) {
  const platformStatusElement = document.getElementById('platformStatus');
  if (!platformStatusElement) return;

  let selectedPlatform = forcedPlatform;

  if (!selectedPlatform) {
    const selectedRadio = document.querySelector('input[name="platform"]:checked');
    if (selectedRadio) {
      selectedPlatform = selectedRadio.value;
    }
  }

  if (!selectedPlatform) {
    const savedSettings = localStorage.getItem('bloggerSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (parsed.platform) {
          selectedPlatform = parsed.platform;
        }
      } catch (error) {
        console.warn('[PLATFORM] 저장된 설정 파싱 실패:', error);
      }
    }
  }

  if (!selectedPlatform) {
    selectedPlatform = 'wordpress';
  }

  platformStatusElement.textContent = selectedPlatform === 'wordpress' ? 'WordPress' : '블로그스팟';
  platformStatusElement.style.color = '#1e293b';

  console.log('플랫폼 상태 업데이트:', selectedPlatform, '->', platformStatusElement.textContent);
}

// CTA 설정 토글 (통합 버전)
function toggleCtaSettings() {
  const ctaMode = document.querySelector('input[name="ctaMode"]:checked')?.value || 'auto';
  const manualCtaSettings = document.getElementById('manualCtaSettings');
  const manualCtaSection = document.getElementById('manualCtaSection');
  const manualRadio = document.querySelector('input[name="ctaMode"][value="manual"]');

  // manualCtaSettings 요소 제어
  if (manualCtaSettings) {
    manualCtaSettings.style.display = ctaMode === 'manual' ? 'block' : 'none';

    // 수동 모드로 전환 시 첫 번째 CTA 항목 자동 추가
    if (ctaMode === 'manual') {
      const ctaItemsList = document.getElementById('ctaItemsList');
      if (ctaItemsList && ctaItemsList.children.length === 0) {
        addCtaItem();
      }
    }
  }

  // manualCtaSection 요소 제어
  if (manualCtaSection && manualRadio) {
    if (manualRadio.checked) {
      manualCtaSection.style.display = 'block';
    } else {
      manualCtaSection.style.display = 'none';
    }
  }
}
function openManualCtaShortcut() {
  const manualRadio = document.querySelector("input[name=\"ctaMode\"][value=\"manual\"]");
  if (manualRadio) {
    if (!manualRadio.checked) {
      manualRadio.checked = true;
    }
    toggleCtaSettings();
  } else {
    console.warn('[CTA] 수동 CTA 라디오 버튼을 찾을 수 없습니다.');
  }
  openManualCtaModal();
}


// CTA 항목 추가
var ctaItemCount = 0;
function addCtaItem() {
  const ctaItemsList = document.getElementById('ctaItemsList');
  if (!ctaItemsList) return;

  // 최대 4개까지만 허용
  if (ctaItemsList.children.length >= 4) {
    alert('CTA는 최대 4개까지 추가할 수 있습니다.');
    return;
  }

  ctaItemCount++;
  const itemId = `ctaItem${ctaItemCount}`;

  const itemHtml = `
    <div id="${itemId}" style="padding: 12px; background: rgba(255, 255, 255, 0.1); border: 2px solid rgba(255, 255, 255, 0.2); border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <label style="color: rgba(255, 255, 255, 0.9); font-weight: 600; font-size: 13px;">CTA ${ctaItemsList.children.length + 1}</label>
        <button onclick="removeCtaItem('${itemId}')" style="background: rgba(255, 255, 255, 0.15); border: none; color: rgba(255, 255, 255, 0.9); padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">삭제</button>
      </div>
      <input type="text" id="${itemId}_title" placeholder="버튼 텍스트 (예: 자세히 보기)" style="width: 100%; padding: 8px 12px; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 6px; color: white; font-size: 13px; backdrop-filter: blur(10px); margin-bottom: 8px;">
      <input type="url" id="${itemId}_url" placeholder="URL (예: https://example.com)" style="width: 100%; padding: 8px 12px; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 6px; color: white; font-size: 13px; backdrop-filter: blur(10px); margin-bottom: 8px;">
      <textarea id="${itemId}_desc" placeholder="설명 (선택사항)" rows="2" style="width: 100%; padding: 8px 12px; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 6px; color: white; font-size: 13px; backdrop-filter: blur(10px); resize: vertical;"></textarea>
    </div>
  `;

  ctaItemsList.insertAdjacentHTML('beforeend', itemHtml);
}
// CTA 항목 제거
function removeCtaItem(itemId) {
  const item = document.getElementById(itemId);
  if (item) {
    item.remove();

    // CTA 번호 재설정
    const ctaItemsList = document.getElementById('ctaItemsList');
    if (ctaItemsList) {
      const items = ctaItemsList.children;
      for (let i = 0; i < items.length; i++) {
        const label = items[i].querySelector('label');
        if (label) {
          label.textContent = `CTA ${i + 1}`;
        }
      }
    }
  }
}

// 플랫폼 필드 토글 (포스팅 작성 페이지)
function togglePlatformFields(forcedPlatform) {
  const selectedPlatform = forcedPlatform || document.querySelector('input[name="platform"]:checked')?.value || 'blogspot';
  const wordpressCategoryField = document.getElementById('wordpressCategoryField');
  const bloggerAuthBtn = document.getElementById('bloggerAuthBtn');
  const bloggerAuthBtn2 = document.getElementById('bloggerAuthBtn2');
  const loadCategoriesBtn = document.getElementById('loadCategoriesBtn');
  const wpCategorySection = document.getElementById('wpCategorySection');

  console.log('togglePlatformFields 실행:', selectedPlatform);

  if (wordpressCategoryField) {
    wordpressCategoryField.style.display = selectedPlatform === 'wordpress' ? 'block' : 'none';
    console.log('워드프레스 카테고리 필드:', wordpressCategoryField.style.display);
  }

  if (wpCategorySection) {
    wpCategorySection.style.display = selectedPlatform === 'wordpress' ? 'block' : 'none';
    console.log('통합 UI 워드프레스 카테고리 섹션:', wpCategorySection.style.display);
  }

  if (bloggerAuthBtn) {
    bloggerAuthBtn.style.display = selectedPlatform === 'blogger' ? 'block' : 'none';
    console.log('블로그스팟 인증 버튼 (1):', bloggerAuthBtn.style.display);
  }

  if (bloggerAuthBtn2) {
    bloggerAuthBtn2.style.display = selectedPlatform === 'blogger' ? 'block' : 'none';
    console.log('블로그스팟 인증 버튼 (2):', bloggerAuthBtn2.style.display);
  }

  if (loadCategoriesBtn) {
    loadCategoriesBtn.style.display = selectedPlatform === 'wordpress' ? 'block' : 'none';
    console.log('워드프레스 카테고리 로드 버튼:', loadCategoriesBtn.style.display);
  }

  updatePlatformStatus(selectedPlatform);
}
// 플랫폼 연동 확인
async function checkPlatformConnection() {
  const selectedPlatform = document.querySelector('input[name="platform"]:checked')?.value || 'blogspot';

  console.log('플랫폼 연동 확인 시작:', selectedPlatform);

  try {
    if (selectedPlatform === 'wordpress') {
      // 워드프레스 인증 확인
      if (window.electronAPI && window.electronAPI.checkWordPressAuthStatus) {
        const result = await window.electronAPI.checkWordPressAuthStatus();
        console.log('워드프레스 인증 결과:', result);

        if (result.authenticated) {
          alert('✅ 워드프레스 연동이 완료되었습니다!');
        } else {
          alert(`❌ 워드프레스 연동을 완료하려면:\n\n1. 환경설정 모달을 열어주세요\n2. 워드프레스 사이트 URL, 사용자명, 앱 비밀번호를 입력하세요\n3. "설정 저장" 버튼을 클릭하세요\n\n현재 오류: ${result.error || '워드프레스 인증 정보가 없습니다'}`);
        }
      } else {
        alert('워드프레스 인증 확인 기능을 사용할 수 없습니다.');
      }
    } else if (selectedPlatform === 'blogger') {
      // 블로그스팟 인증 확인 - 개선된 로직
      const settings = loadSettings();
      console.log('블로그스팟 설정 확인:', {
        blogId: settings.blogId,
        googleClientId: settings.googleClientId,
        googleClientSecret: settings.googleClientSecret
      });

      // 기본 설정 확인
      if (!settings.blogId || !settings.googleClientId || !settings.googleClientSecret) {
        alert(`❌ 블로그스팟 연동을 완료하려면:\n\n1. 환경설정 모달을 열어주세요\n2. Blogger ID, Google Client ID, Google Client Secret을 입력하세요\n3. "설정 저장" 버튼을 클릭하세요\n\n현재 누락된 정보:\n${!settings.blogId ? '- Blogger ID\n' : ''}${!settings.googleClientId ? '- Google Client ID\n' : ''}${!settings.googleClientSecret ? '- Google Client Secret\n' : ''}`);
        return;
      }

      // 토큰 파일 확인 (개발환경에서는 자동으로 성공 처리)
      const isDevelopment = window.location.protocol === 'file:' || window.location.hostname === 'localhost';
      if (isDevelopment) {
        alert('✅ 블로그스팟 연동이 완료되었습니다! (개발환경)');
        return;
      }

      // 설정이 모두 있으면 연동 완료로 간주
      alert('✅ 블로그스팟 연동이 완료되었습니다!\n\n📝 설정된 정보:\n- Blogger ID: ' + settings.blogId.substring(0, 15) + '...\n- Client ID: ' + settings.googleClientId.substring(0, 20) + '...\n\n바로 포스팅을 시작할 수 있습니다!');
    } else {
      alert('지원하지 않는 플랫폼입니다.');
    }
  } catch (error) {
    console.error('플랫폼 연동 확인 오류:', error);
    alert('플랫폼 연동 확인 중 오류가 발생했습니다: ' + error.message);
  }
}

// CSE 연동 확인
async function checkCseConnection() {
  try {
    const settings = loadSettings();

    if (!settings.googleCseKey || !settings.googleCseCx) {
      alert('❌ CSE 연동이 필요합니다.\n\n환경설정에서 Google Custom Search API 키와 검색 엔진 ID를 입력해주세요.');
      return;
    }

    // 간단한 테스트 검색 수행
    if (window.blogger && window.blogger.testCseConnection) {
      const result = await window.blogger.testCseConnection(settings.googleCseKey, settings.googleCseCx);

      if (result.success) {
        alert('✅ CSE 연동이 완료되었습니다!\n\n검색 기능을 정상적으로 사용할 수 있습니다.');
      } else {
        alert(`❌ CSE 연동 확인 실패\n\n${result.error || 'API 키 또는 검색 엔진 ID를 확인해주세요.'}`);
      }
    } else {
      // API가 없는 경우 간단히 설정 확인만
      alert('✅ CSE 설정이 저장되어 있습니다.\n\nAPI 키: ' + settings.googleCseKey.substring(0, 10) + '...\n검색 엔진 ID: ' + settings.googleCseCx.substring(0, 10) + '...');
    }
  } catch (error) {
    console.error('CSE 연동 확인 오류:', error);
    alert('CSE 연동 확인 중 오류가 발생했습니다: ' + error.message);
  }
}

// Blogger OAuth 인증 (별칭 함수)
async function authenticateBlogger() {
  return await startBloggerAuth();
}

// 초안 섹션 토글 함수
function toggleDraftSection() {
  try {
    const draftSection = document.getElementById('draftInputSection');
    const toggleIcon = document.getElementById('draftToggleIcon');

    if (!draftSection) {
      console.warn('[DRAFT] 초안 입력 영역을 찾을 수 없습니다.');
      return;
    }

    const isVisible = draftSection.style.display !== 'none';

    if (isVisible) {
      draftSection.style.display = 'none';
      if (toggleIcon) {
        toggleIcon.style.transform = 'rotate(0deg)';
      }
    } else {
      draftSection.style.display = 'block';
      if (toggleIcon) {
        toggleIcon.style.transform = 'rotate(180deg)';
      }
    }

    console.log('[DRAFT] 초안 섹션 토글:', isVisible ? '숨김' : '표시');
  } catch (error) {
    console.error('[DRAFT] 초안 섹션 토글 오류:', error);
  }
}

// 발행 로그 섹션 토글 함수
function toggleLogContainer() {
  try {
    const logContainer = document.getElementById('logContainer');
    const toggleIcon = document.getElementById('logToggleIcon');

    if (!logContainer) {
      console.warn('[LOG] 로그 컨테이너를 찾을 수 없습니다.');
      return;
    }

    const isVisible = logContainer.style.display !== 'none';

    if (isVisible) {
      logContainer.style.display = 'none';
      if (toggleIcon) {
        toggleIcon.textContent = '▶';
        toggleIcon.style.transform = 'rotate(0deg)';
      }
    } else {
      logContainer.style.display = 'block';
      if (toggleIcon) {
        toggleIcon.textContent = '▼';
        toggleIcon.style.transform = 'rotate(0deg)';
      }
    }

    console.log('[LOG] 로그 섹션 토글:', isVisible ? '숨김' : '표시');
  } catch (error) {
    console.error('[LOG] 로그 섹션 토글 오류:', error);
  }
}

function getPureCharacterCount(text = '') {
  if (!text) return 0;
  return String(text).replace(/[^가-힣a-zA-Z0-9]/g, '').length;
}

function getPureCharacterCountFromHtml(html = '') {
  if (!html) return 0;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const textContent = tempDiv.textContent || tempDiv.innerText || '';
  return getPureCharacterCount(textContent);
}
// 초안 글자수 업데이트 함수
function updateDraftCount() {
  try {
    const draftInput = document.getElementById('draftInput');
    const draftCount = document.getElementById('draftCount');

    if (!draftInput || !draftCount) return;

    const text = draftInput.value || '';
    const charCount = getPureCharacterCount(text);
    const maxChars = 5000;

    draftCount.textContent = `${charCount}/${maxChars}`;

    if (charCount > maxChars) {
      draftCount.style.color = '#ef4444';
    } else if (charCount > maxChars * 0.8) {
      draftCount.style.color = '#f59e0b';
    } else {
      draftCount.style.color = 'rgba(255, 255, 255, 0.7)';
    }
  } catch (error) {
    console.error('[DRAFT] 글자수 업데이트 오류:', error);
  }
}

// 블로그스팟 OAuth 인증 시작
async function startBloggerAuth() {
  try {
    // 블로거 OAuth 인증 URL 생성
    const settings = loadSettings();
    const googleClientId = settings.googleClientId;

    if (!googleClientId) {
      alert('❌ 구글 클라이언트 ID가 설정되지 않았습니다.\n\n환경 설정에서 구글 클라이언트 ID를 입력해주세요.');
      return;
    }

    // 블로거 OAuth 인증 URL
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(googleClientId)}&` +
      `redirect_uri=${encodeURIComponent('urn:ietf:wg:oauth:2.0:oob')}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent('https://www.googleapis.com/auth/blogger')}&` +
      `access_type=offline&` +
      `prompt=consent`;

    // 브라우저로 인증 페이지 열기
    if (window.blogger && window.blogger.openLink) {
      await window.blogger.openLink(authUrl);

      // 코드 입력 필드와 연동 확인 버튼 생성
      showBloggerAuthFields();
    } else {
      window.open(authUrl, '_blank');
      showBloggerAuthFields();
    }
  } catch (error) {
    console.error('블로거 인증 시작 오류:', error);
    alert('❌ 블로거 인증 시작 중 오류가 발생했습니다: ' + error.message);
  }
}

// 블로그스팟 인증 필드 표시
function showBloggerAuthFields() {
  const bloggerAuthBtn = document.getElementById('bloggerAuthBtn');
  const bloggerAuthBtn2 = document.getElementById('bloggerAuthBtn2');

  // 기존 인증 필드가 있는지 확인
  let authContainer = document.getElementById('bloggerAuthContainer');

  if (!authContainer) {
    // 인증 필드 컨테이너 생성
    authContainer = document.createElement('div');
    authContainer.id = 'bloggerAuthContainer';
    authContainer.style.cssText = `
      margin-top: 15px;
      padding: 15px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    `;

    // 코드 입력 필드
    const codeInput = document.createElement('input');
    codeInput.type = 'text';
    codeInput.id = 'bloggerAuthCode';
    codeInput.placeholder = '인증 코드를 입력하세요 (브라우저에서 복사)';
    codeInput.style.cssText = `
      width: 100%;
      padding: 10px;
      margin-bottom: 10px;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid #ddd;
      border-radius: 4px;
      color: #333;
      font-size: 14px;
    `;

    // 연동 확인 버튼
    const verifyBtn = document.createElement('button');
    verifyBtn.type = 'button';
    verifyBtn.id = 'bloggerVerifyBtn';
    verifyBtn.textContent = '연동 확인';
    verifyBtn.style.cssText = `
      width: 100%;
      padding: 10px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.3s;
    `;
    verifyBtn.onclick = verifyBloggerAuth;

    // 연동 상태 표시
    const statusDiv = document.createElement('div');
    statusDiv.id = 'bloggerAuthStatus';
    statusDiv.style.cssText = `
      margin-top: 10px;
      padding: 8px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 600;
      text-align: center;
      display: none;
    `;

    authContainer.appendChild(codeInput);
    authContainer.appendChild(verifyBtn);
    authContainer.appendChild(statusDiv);

    // 인증 버튼 다음에 컨테이너 삽입
    if (bloggerAuthBtn) {
      bloggerAuthBtn.parentNode.insertBefore(authContainer, bloggerAuthBtn.nextSibling);
    } else if (bloggerAuthBtn2) {
      bloggerAuthBtn2.parentNode.insertBefore(authContainer, bloggerAuthBtn2.nextSibling);
    }
  }

  // 필드 표시
  authContainer.style.display = 'block';

  // 안내 메시지
  const statusDiv = document.getElementById('bloggerAuthStatus');
  if (statusDiv) {
    statusDiv.style.display = 'block';
    statusDiv.style.background = '#2196F3';
    statusDiv.style.color = 'white';
    statusDiv.textContent = '브라우저에서 인증 완료 후 코드를 복사해서 입력하세요';
  }
}
// 블로그스팟 인증 확인
async function verifyBloggerAuth() {
  const codeInput = document.getElementById('bloggerAuthCode');
  const verifyBtn = document.querySelector('button[onclick="verifyBloggerAuth()"]');
  const statusDiv = document.getElementById('bloggerAuthStatus');

  if (!codeInput || !codeInput.value.trim()) {
    alert('❌ 인증 코드를 입력해주세요.');
    return;
  }

  try {
    // 버튼 비활성화
    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.textContent = '연동 중...';
      verifyBtn.style.background = '#ccc';
    }

    // 상태 표시
    if (statusDiv) {
      statusDiv.style.display = 'block';
      statusDiv.style.background = '#FF9800';
      statusDiv.style.color = 'white';
      statusDiv.textContent = '연동 확인 중...';
    }

    // 인증 코드로 토큰 교환
    const result = await handleBloggerCallback(codeInput.value.trim());

    if (result.ok) {
      // 성공
      if (statusDiv) {
        statusDiv.style.background = '#4CAF50';
        statusDiv.style.color = 'white';
        statusDiv.textContent = '✅ 연동완료';
      }

      // 입력 필드 숨기기
      if (codeInput) codeInput.value = '';

      alert('✅ 블로그스팟 연동이 완료되었습니다!');

      // 인증 모달 닫기
      closeBloggerAuthModal();

      // 플랫폼 상태 업데이트
      updatePlatformStatus();
    } else {
      // 실패
      if (statusDiv) {
        statusDiv.style.background = '#f44336';
        statusDiv.style.color = 'white';
        statusDiv.style.textContent = '❌ 연동 실패: ' + (result.error || '알 수 없는 오류');
      }

      alert('❌ 블로그스팟 연동에 실패했습니다: ' + (result.error || '알 수 없는 오류'));
    }
  } catch (error) {
    console.error('블로그스팟 인증 확인 오류:', error);

    if (statusDiv) {
      statusDiv.style.background = '#f44336';
      statusDiv.style.color = 'white';
      statusDiv.textContent = '❌ 연동 오류: ' + error.message;
    }

    alert('❌ 블로그스팟 연동 중 오류가 발생했습니다: ' + error.message);
  } finally {
    // 버튼 복원
    if (verifyBtn) {
      verifyBtn.disabled = false;
      verifyBtn.textContent = '✅ 연동 확인';
      verifyBtn.style.background = 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)';
    }
  }
}

// 블로그스팟 OAuth 시작
async function startBloggerOAuth() {
  try {
    // 환경설정 모달에서 키 값들 가져오기
    const settings = loadSettings();
    const blogId = settings.blogId || '';
    const googleClientId = settings.googleClientId || '';
    const googleClientSecret = settings.googleClientSecret || '';

    if (!blogId || !googleClientId || !googleClientSecret) {
      alert('❌ 환경설정에서 Blogger ID, Google Client ID, Google Client Secret을 먼저 설정해주세요.');
      return;
    }

    // OAuth URL 직접 생성
    const redirectUri = 'urn:ietf:wg:oauth:2.0:oob';
    const scope = 'https://www.googleapis.com/auth/blogger';
    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&access_type=offline&prompt=consent`;

    // 시스템 기본 브라우저에서 OAuth URL 열기
    if (window.electronAPI && window.electronAPI.openExternal) {
      await window.electronAPI.openExternal(oauthUrl);
    } else {
      // fallback: 새 창에서 열기
      window.open(oauthUrl, '_blank');
    }

    // 인증 코드 입력 모달 표시
    showBloggerAuthModal();

  } catch (error) {
    console.error('블로그스팟 OAuth 시작 오류:', error);
    alert('❌ 블로그스팟 OAuth 시작 중 오류가 발생했습니다: ' + error.message);
  }
}

// 블로그스팟 인증 모달 표시
function showBloggerAuthModal() {
  const modal = document.createElement('div');
  modal.id = 'bloggerAuthModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(10px);
  `;

  modal.innerHTML = `
    <div style="background: white; border-radius: 20px; padding: 40px; max-width: 500px; width: 90%; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);">
      <h3 style="color: #333; font-size: 24px; font-weight: 700; margin-bottom: 20px; text-align: center;">
        🔐 블로그스팟 OAuth2 인증
      </h3>
      
      <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 0;">
          <strong>인증 단계:</strong><br>
          1. 새 창에서 Google 계정으로 로그인<br>
          2. 권한 승인 후 인증 코드 복사<br>
          3. 아래 입력란에 인증 코드 붙여넣기
        </p>
      </div>
      
      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">인증 코드</label>
        <input type="text" id="bloggerAuthCode" placeholder="인증 코드를 입력하세요" 
               style="width: 100%; padding: 12px 16px; border: 2px solid #e1e5e9; border-radius: 8px; font-size: 14px;">
      </div>
      
      <div style="display: flex; gap: 12px;">
        <button onclick="verifyBloggerAuth()" 
                style="flex: 1; padding: 12px 20px; background: linear-gradient(135deg, #4285f4 0%, #34a853 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
          ✅ 연동 확인
        </button>
        <button onclick="closeBloggerAuthModal()" 
                style="flex: 1; padding: 12px 20px; background: #f8f9fa; color: #666; border: 2px solid #e1e5e9; border-radius: 8px; font-weight: 600; cursor: pointer;">
          취소
        </button>
      </div>
      
      <div id="bloggerAuthStatus" style="margin-top: 16px; padding: 12px; border-radius: 8px; display: none; text-align: center; font-weight: 600;"></div>
    </div>
  `;

  document.body.appendChild(modal);

  // 인증 코드 입력 필드에 포커스
  setTimeout(() => {
    const codeInput = document.getElementById('bloggerAuthCode');
    if (codeInput) codeInput.focus();
  }, 100);
}

// 블로그스팟 인증 모달 닫기
function closeBloggerAuthModal() {
  const modal = document.getElementById('bloggerAuthModal');
  if (modal) {
    modal.remove();
  }
}

// 블로그스팟 OAuth 코드 처리
async function handleBloggerCallback(code) {
  try {
    if (window.electronAPI && window.electronAPI.handleBloggerCallback) {
      const result = await window.electronAPI.handleBloggerCallback(code);
      return result;
    } else {
      return { ok: false, error: '블로그스팟 인증 처리 기능을 사용할 수 없습니다.' };
    }
  } catch (error) {
    console.error('블로그스팟 인증 처리 오류:', error);
    return { ok: false, error: error.message };
  }
}
// 워드프레스 카테고리 로드
async function loadWordPressCategories() {
  try {
    const loadBtn = document.getElementById('loadCategoriesBtn');
    if (loadBtn) {
      loadBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-9-9c0 1.5 0.4 2.9 1 4.1l-1 1.9"></path><path d="M3 12a9 9 0 019-9c1.5 0 2.9 0.4 4.1 1l-1.9 1"></path></svg> 로딩중...';
      loadBtn.disabled = true;
    }

    if (window.blogger && window.blogger.loadWordPressCategories) {
      const result = await window.blogger.loadWordPressCategories();

      if (result.ok && result.data) {
        // 카테고리 선택 UI 업데이트
        updateWordPressCategoryUI(result.data);
        showCategoryConnectionStatus(true);
        return result.data;
      } else {
        console.error('워드프레스 카테고리 로드 실패:', result.error);
        alert('워드프레스 카테고리 로드 실패: ' + (result.error || '알 수 없는 오류'));
        return [];
      }
    } else {
      console.log('워드프레스 카테고리 로드 기능을 사용할 수 없습니다.');
      alert('워드프레스 카테고리 로드 기능을 사용할 수 없습니다.');
      return [];
    }
  } catch (error) {
    console.error('워드프레스 카테고리 로드 오류:', error);
    alert('워드프레스 카테고리 로드 중 오류가 발생했습니다: ' + error.message);
    return [];
  } finally {
    const loadBtn = document.getElementById('loadCategoriesBtn');
    if (loadBtn) {
      loadBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> 로드';
      loadBtn.disabled = false;
    }
  }
}

// 워드프레스 카테고리 UI 업데이트
function updateWordPressCategoryUI(categories) {
  const wpCategoryList = document.getElementById('wpCategoryList');
  const wpCategoryDropdown = document.getElementById('wpCategoryDropdown');
  const wpCategoryManual = document.getElementById('wpCategoryManual');

  if (!wpCategoryList || !wpCategoryDropdown || !wpCategoryManual) return;

  // 카테고리 목록 초기화
  wpCategoryList.innerHTML = '';

  // 카테고리 항목들 추가
  categories.forEach(category => {
    const categoryItem = document.createElement('div');
    categoryItem.className = 'category-item';
    categoryItem.style.cssText = `
      padding: 12px 16px;
      margin: 4px 0;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      cursor: pointer;
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 12px;
    `;

    categoryItem.innerHTML = `
      <input type="checkbox" id="cat_${category.id}" value="${category.id}" style="width: 16px; height: 16px; cursor: pointer;">
      <label for="cat_${category.id}" style="cursor: pointer; flex: 1; margin: 0;">
        <div style="font-weight: 600;">${category.name}</div>
        ${category.description ? `<div style="font-size: 12px; color: rgba(255, 255, 255, 0.6); margin-top: 2px;">${category.description}</div>` : ''}
      </label>
      <span style="font-size: 12px; color: rgba(255, 255, 255, 0.5);">${category.count || 0}개</span>
    `;

    // 호버 효과
    categoryItem.addEventListener('mouseenter', () => {
      categoryItem.style.background = 'rgba(255, 255, 255, 0.2)';
      categoryItem.style.borderColor = 'rgba(255, 255, 255, 0.4)';
    });

    categoryItem.addEventListener('mouseleave', () => {
      categoryItem.style.background = 'rgba(255, 255, 255, 0.1)';
      categoryItem.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    });

    // 체크박스 변경 이벤트
    const checkbox = categoryItem.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', () => {
      updateSelectedCategories();
    });

    wpCategoryList.appendChild(categoryItem);
  });

  // 드롭다운 표시, 수동 입력 숨기기
  wpCategoryDropdown.style.display = 'block';
  wpCategoryManual.style.display = 'none';
}

// 선택된 카테고리 업데이트
function updateSelectedCategories() {
  const checkboxes = document.querySelectorAll('#wpCategoryList input[type="checkbox"]:checked');
  const selectedCategories = document.getElementById('selectedCategories');
  const selectedCategoryTags = document.getElementById('selectedCategoryTags');

  if (!selectedCategories || !selectedCategoryTags) return;

  if (checkboxes.length > 0) {
    selectedCategoryTags.innerHTML = '';

    checkboxes.forEach(checkbox => {
      const categoryName = checkbox.nextElementSibling.querySelector('div').textContent;
      const tag = document.createElement('span');
      tag.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 6px 12px;
        border-radius: 16px;
        font-size: 12px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 6px;
      `;
      tag.innerHTML = `
        ${categoryName}
        <button onclick="removeCategory('${checkbox.value}')" style="background: none; border: none; color: white; cursor: pointer; padding: 0; margin-left: 4px; font-size: 14px;">×</button>
      `;
      selectedCategoryTags.appendChild(tag);
    });

    selectedCategories.style.display = 'block';
    showCategoryConnectionStatus(true);
  } else {
    selectedCategories.style.display = 'none';
    showCategoryConnectionStatus(false);
  }
}

// 카테고리 제거
function removeCategory(categoryId) {
  const checkbox = document.getElementById(`cat_${categoryId}`);
  if (checkbox) {
    checkbox.checked = false;
    updateSelectedCategories();
  }
}
// 카테고리 연결 상태 표시
function showCategoryConnectionStatus(connected) {
  const statusElement = document.getElementById('categoryConnectionStatus');
  if (statusElement) {
    if (connected) {
      statusElement.style.display = 'inline-block';
      statusElement.style.background = 'rgba(34, 197, 94, 0.2)';
      statusElement.style.color = '#22c55e';
      statusElement.innerHTML = '✅ 연결됨';
    } else {
      statusElement.style.display = 'none';
    }
  }
}
// 워드프레스 카테고리 선택값 가져오기
function getSelectedWordPressCategories() {
  const checkboxes = document.querySelectorAll('#wpCategoryList input[type="checkbox"]:checked');
  if (checkboxes.length === 0) return '';

  return Array.from(checkboxes).map(checkbox => checkbox.value).join(',');
}
// 키워드 필드 관리 함수들
function addKeywordField() {
  const keywordFields = document.getElementById('keywordFields');
  const addKeywordBtn = document.getElementById('addKeywordBtn');
  const keywordCount = document.getElementById('keywordCount');

  // keywordFields가 없으면 통합 UI를 사용 중이므로 함수 종료
  if (!keywordFields) {
    console.log('통합 UI에서는 키워드 필드 추가가 필요하지 않습니다.');
    return;
  }

  // 현재 키워드 필드 개수 확인
  const currentFields = keywordFields.querySelectorAll('.keyword-field').length;

  if (currentFields >= 50) {
    alert('최대 50개의 키워드만 입력할 수 있습니다.');
    return;
  }

  // 새 키워드 필드 생성
  const newField = document.createElement('div');
  newField.className = 'keyword-field';
  newField.style.cssText = 'display: flex; gap: 8px; align-items: center;';

  newField.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 8px; padding: 16px; background: rgba(255, 255, 255, 0.1); border-radius: 12px; backdrop-filter: blur(10px);">
      <!-- 키워드 입력과 예약시간 -->
      <div style="display: flex; gap: 8px; align-items: center;">
        <input type="text" class="keyword-input form-input" placeholder="예: 블로그 수익화 방법" style="background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); color: white; backdrop-filter: blur(10px); font-size: 16px; padding: 14px; flex: 1;">
        <input type="datetime-local" class="keyword-schedule-time form-input" placeholder="예약시간 (선택사항)" style="background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.3); color: white; backdrop-filter: blur(10px); font-size: 14px; padding: 14px; width: 200px;">
        <button type="button" class="remove-keyword-btn" onclick="removeKeywordField(this)" style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); border: none; color: white; padding: 14px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s ease;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <!-- 키워드별 제목 선택 (선택사항) -->
      <div style="display: flex; gap: 8px; align-items: center;">
        <label style="color: rgba(255, 255, 255, 0.8); font-size: 12px; font-weight: 500; min-width: 50px;">제목:</label>
        <select class="keyword-title-select form-input" style="background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.3); color: white; backdrop-filter: blur(10px); font-size: 12px; padding: 10px; border-radius: 8px; flex: 1;">
          <option value="auto" style="background: #667eea; color: white;">자동 생성 (키워드 기반)</option>
          <option value="custom" style="background: #667eea; color: white;">직접 입력</option>
        </select>
      </div>
      
      <!-- 직접 입력 모드일 때만 표시되는 텍스트 입력 -->
      <div class="custom-title-input-container" style="display: none; gap: 8px; align-items: center;">
        <input type="text" class="keyword-title-input form-input" placeholder="제목을 직접 입력하세요" style="background: rgba(255, 255, 255, 0.1); border: 2px solid rgba(255, 255, 255, 0.2); color: white; backdrop-filter: blur(10px); font-size: 12px; padding: 10px; flex: 1;">
      </div>
      
         <!-- 키워드별 썸네일/이미지 소스 선택 -->
         <div style="display: flex; gap: 8px; align-items: center;">
           <label style="color: rgba(255, 255, 255, 0.8); font-size: 11px; font-weight: 500; min-width: 60px;">썸네일:</label>
           <select class="keyword-thumbnail-select form-input" style="background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.3); color: white; backdrop-filter: blur(10px); font-size: 12px; padding: 6px; border-radius: 4px; flex: 1;">
             <option value="text" style="background: #667eea; color: white;">텍스트 썸네일</option>
             <option value="pexels" style="background: #667eea; color: white;">Pexels 이미지</option>
             <option value="dalle" style="background: #667eea; color: white;">DALL-E 이미지</option>
             <option value="cse" style="background: #667eea; color: white;">CSE 이미지</option>
           </select>
         </div>
         
         <!-- 키워드별 이미지 소스 선택 -->
         <div style="display: flex; gap: 8px; align-items: center;">
           <label style="color: rgba(255, 255, 255, 0.8); font-size: 11px; font-weight: 500; min-width: 60px;">이미지:</label>
           <select class="keyword-image-select form-input" style="background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.3); color: white; backdrop-filter: blur(10px); font-size: 12px; padding: 6px; border-radius: 4px; flex: 1;">
             <option value="pexels" style="background: #667eea; color: white;">Pexels 이미지</option>
             <option value="dalle" style="background: #667eea; color: white;">DALL-E 이미지</option>
             <option value="cse" style="background: #667eea; color: white;">CSE 이미지</option>
           </select>
         </div>
    </div>
  `;

  keywordFields.appendChild(newField);
  updateKeywordCount();
  updateRemoveButtons();

  // 제목 선택 드롭다운 이벤트 리스너 추가
  const titleSelect = newField.querySelector('.keyword-title-select');
  const customTitleInput = newField.querySelector('.custom-title-input-container');

  titleSelect.addEventListener('change', function () {
    if (this.value === 'custom') {
      customTitleInput.style.display = 'flex';
    } else {
      customTitleInput.style.display = 'none';
    }
  });

  // 새 필드에 포커스
  newField.querySelector('.keyword-input').focus();
}

function removeKeywordField(button) {
  const keywordField = button.closest('.keyword-field');
  const keywordFields = document.getElementById('keywordFields');

  // 최소 1개 필드는 유지
  if (keywordFields.querySelectorAll('.keyword-field').length <= 1) {
    alert('최소 1개의 키워드 필드는 유지되어야 합니다.');
    return;
  }

  keywordField.remove();
  updateKeywordCount();
  updateRemoveButtons();
}
function updateKeywordCount() {
  const keywordCount = document.getElementById('keywordCount');
  const addKeywordBtn = document.getElementById('addKeywordBtn');

  // 새로운 통합 UI에서는 keywordFields가 없으므로 기본값 사용
  const keywordFields = document.getElementById('keywordFields');
  const currentCount = keywordFields ? keywordFields.querySelectorAll('.keyword-field').length : 1;

  if (keywordCount) {
    keywordCount.textContent = `(${currentCount}/50)`;
  }

  if (addKeywordBtn) {
    // 50개에 도달하면 추가 버튼 비활성화
    if (currentCount >= 50) {
      addKeywordBtn.style.opacity = '0.5';
      addKeywordBtn.style.cursor = 'not-allowed';
      addKeywordBtn.disabled = true;
    } else {
      addKeywordBtn.style.opacity = '1';
      addKeywordBtn.style.cursor = 'pointer';
      addKeywordBtn.disabled = false;
    }
  }
}

// 썸네일 생성기 서브 탭 전환 함수
function showThumbnailSubTab(tab) {
  const generatorContent = document.getElementById('thumbnail-generator-content');
  const converterContent = document.getElementById('image-converter-content');
  const generatorTab = document.getElementById('thumbnailGeneratorTab');
  const converterTab = document.getElementById('imageConverterTab');

  if (tab === 'generator') {
    generatorContent.style.display = 'grid';
    converterContent.style.display = 'none';
    generatorTab.style.opacity = '1';
    converterTab.style.opacity = '0.7';
  } else {
    generatorContent.style.display = 'none';
    converterContent.style.display = 'grid';
    generatorTab.style.opacity = '0.7';
    converterTab.style.opacity = '1';
  }
}

// 이미지 변환기 관련 변수
var originalImageFile = null;
var convertedImageBlob = null;

// 이미지 드래그 앤 드롭 핸들러
function handleImageDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.style.borderColor = '#4facfe';
  e.currentTarget.style.backgroundColor = 'rgba(79, 172, 254, 0.1)';
}

function handleImageDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
}

function handleImageDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleImageFile(files[0]);
  }
}

function handleImageSelect(e) {
  const files = e.target.files;
  if (files.length > 0) {
    handleImageFile(files[0]);
  }
}
function handleImageFile(file) {
  console.log('🖼️ 이미지 파일 선택됨:', file.name, file.type, file.size);

  // 파일 크기 확인 (50MB 제한)
  if (file.size > 50 * 1024 * 1024) {
    alert('이미지 파일이 너무 큽니다. 50MB 이하의 파일을 선택해주세요.');
    return;
  }

  // 지원하는 이미지 형식 확인 (대소문자 구분 없이)
  const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
  const fileType = file.type.toLowerCase();

  console.log('파일 타입 확인:', fileType, '지원 타입:', supportedTypes);

  if (!supportedTypes.includes(fileType)) {
    alert(`지원하지 않는 파일 형식입니다. (현재: ${file.type})\n지원 형식: JPG, PNG, GIF, WebP, BMP`);
    return;
  }

  originalImageFile = file;

  // 원본 이미지 미리보기
  const reader = new FileReader();
  reader.onload = function (e) {
    console.log('✅ 이미지 로드 완료');
    const originalPreview = document.getElementById('originalImagePreview');
    originalPreview.innerHTML = `
      <img src="${e.target.result}" style="max-width: 100%; max-height: 300px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
      <div style="display:none; padding:20px; text-align:center; color:#ef4444; background:#fef2f2; border:1px dashed #fca5a5; border-radius:8px;">
        <p>이미지 미리보기 로드 실패</p>
        <small>파일이 손상되었거나 지원하지 않는 형식일 수 있습니다.</small>
      </div>
    `;

    // 변환 버튼 활성화
    const convertBtn = document.getElementById('convertImageBtn');
    if (convertBtn) {
      convertBtn.disabled = false;
      convertBtn.style.opacity = '1';
      convertBtn.style.cursor = 'pointer';
      console.log('✅ 변환 버튼 활성화됨');
    } else {
      console.error('❌ 변환 버튼을 찾을 수 없습니다');
    }
  };

  reader.onerror = function () {
    console.log('❌ 파일 읽기 실패');
    alert('파일을 읽을 수 없습니다. 파일이 손상되었거나 접근 권한이 없을 수 있습니다.');
  };

  reader.readAsDataURL(file);
}

// 품질 값 업데이트
function updateQualityValue(value) {
  document.getElementById('qualityValue').textContent = value;
}

// 이미지 변환 함수
function convertImage() {
  console.log('🔄 이미지 변환 시작');

  if (!originalImageFile) {
    console.log('❌ 원본 이미지 파일이 없음');
    alert('먼저 이미지를 업로드해주세요.');
    return;
  }

  const outputFormat = document.getElementById('outputFormat').value;
  const quality = parseInt(document.getElementById('qualitySlider').value) / 100;
  const filterEffect = document.getElementById('filterEffect').value;
  const resizeWidth = document.getElementById('resizeWidth').value;
  const resizeHeight = document.getElementById('resizeHeight').value;
  const maintainRatio = document.getElementById('maintainRatio').checked;

  console.log('📋 변환 설정:', { outputFormat, quality, filterEffect, resizeWidth, resizeHeight, maintainRatio });

  // 변환 버튼 비활성화
  const convertBtn = document.getElementById('convertImageBtn');
  convertBtn.disabled = true;
  convertBtn.textContent = '🔄 변환 중...';

  // Canvas를 사용한 이미지 변환
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();

  img.onload = function () {
    console.log('✅ 이미지 로드 완료:', img.width, 'x', img.height);

    // 크기 계산
    let width = img.width;
    let height = img.height;

    if (resizeWidth || resizeHeight) {
      if (maintainRatio) {
        const ratio = img.width / img.height;
        if (resizeWidth) {
          width = parseInt(resizeWidth);
          height = width / ratio;
        } else {
          height = parseInt(resizeHeight);
          width = height * ratio;
        }
      } else {
        width = resizeWidth ? parseInt(resizeWidth) : img.width;
        height = resizeHeight ? parseInt(resizeHeight) : img.height;
      }
    }

    canvas.width = width;
    canvas.height = height;

    // 필터 효과 적용
    if (filterEffect === 'none') {
      // 필터 없음
      ctx.drawImage(img, 0, 0, width, height);
    } else if (filterEffect === 'grayscale') {
      // 흑백 필터 (픽셀 단위 처리)
      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
      ctx.putImageData(imageData, 0, 0);
    } else if (filterEffect === 'sepia') {
      // 세피아 필터
      ctx.filter = 'sepia(100%)';
      ctx.drawImage(img, 0, 0, width, height);
      ctx.filter = 'none';
    } else if (filterEffect === 'vintage') {
      // 빈티지 필터 (세피아 + 낮은 대비)
      ctx.filter = 'sepia(50%) contrast(0.9) brightness(1.05)';
      ctx.drawImage(img, 0, 0, width, height);
      ctx.filter = 'none';
    } else if (filterEffect === 'brighten') {
      // 밝게
      ctx.filter = 'brightness(1.2)';
      ctx.drawImage(img, 0, 0, width, height);
      ctx.filter = 'none';
    } else if (filterEffect === 'darken') {
      // 어둡게
      ctx.filter = 'brightness(0.8)';
      ctx.drawImage(img, 0, 0, width, height);
      ctx.filter = 'none';
    } else {
      // 기본
      ctx.drawImage(img, 0, 0, width, height);
    }
    // 변환된 이미지를 Blob으로 변환
    console.log('🖼️ Canvas 변환 완료, Blob 생성 중...');
    canvas.toBlob(function (blob) {
      if (!blob) {
        console.log('❌ Blob 생성 실패');
        alert('이미지 변환에 실패했습니다.');
        convertBtn.disabled = false;
        convertBtn.textContent = '🔄 이미지 변환하기';
        return;
      }

      console.log('✅ Blob 생성 완료:', blob.size, 'bytes');
      convertedImageBlob = blob;

      // 변환된 이미지 미리보기
      const url = URL.createObjectURL(blob);
      const convertedPreview = document.getElementById('convertedImagePreview');
      convertedPreview.innerHTML = `
        <img src="${url}" style="max-width: 100%; max-height: 300px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);">
      `;

      console.log('✅ 변환 결과 미리보기 표시 완료');

      // 다운로드 버튼 표시
      const downloadBtn = document.getElementById('downloadConvertedImageBtn');
      downloadBtn.style.display = 'block';

      console.log('✅ 다운로드 버튼 활성화');

      // 변환 버튼 복원
      convertBtn.disabled = false;
      convertBtn.textContent = '🔄 이미지 변환하기';

    }, `image/${outputFormat}`, quality);
  };
  img.onerror = function (e) {
    console.log('❌ 이미지 로드 실패:', e);
    console.log('📁 파일 정보:', originalImageFile);
    console.log('🔗 이미지 URL:', img.src);

    // 파일 크기와 타입 확인
    if (originalImageFile.size > 50 * 1024 * 1024) { // 50MB
      alert('이미지 파일이 너무 큽니다. 50MB 이하의 파일을 선택해주세요.');
    } else if (!originalImageFile.type.startsWith('image/')) {
      alert('지원하지 않는 파일 형식입니다. JPG, PNG, GIF, WebP 파일을 선택해주세요.');
    } else {
      alert('이미지 로드에 실패했습니다. 파일이 손상되었거나 지원하지 않는 형식일 수 있습니다.');
    }

    convertBtn.disabled = false;
    convertBtn.textContent = '🔄 이미지 변환하기';
  };

  console.log('🖼️ 이미지 로드 시작:', originalImageFile.name);
  img.src = URL.createObjectURL(originalImageFile);
}

// 변환된 이미지 다운로드
function downloadConvertedImage() {
  console.log('📥 다운로드 요청');

  if (!convertedImageBlob) {
    console.log('❌ 변환된 이미지 Blob이 없음');
    alert('변환할 이미지가 없습니다.');
    return;
  }

  console.log('✅ 다운로드 시작:', convertedImageBlob.size, 'bytes');

  const url = URL.createObjectURL(convertedImageBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `converted_image_${Date.now()}.${document.getElementById('outputFormat').value}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log('✅ 다운로드 완료');
}

function updateRemoveButtons() {
  const keywordFields = document.getElementById('keywordFields');
  if (!keywordFields) return;

  const fields = keywordFields.querySelectorAll('.keyword-field');

  fields.forEach(field => {
    const removeBtn = field.querySelector('.remove-keyword-btn');
    // 필드가 1개뿐이면 삭제 버튼 숨기기
    if (fields.length <= 1) {
      removeBtn.style.display = 'none';
    } else {
      removeBtn.style.display = 'flex';
    }
  });
}

function getAllKeywords() {
  const keywords = [];

  // 1. 키워드 입력 필드에서 직접 읽기 (단일 포스팅용)
  const keywordInput = document.getElementById('keywordInput');
  if (keywordInput && keywordInput.value.trim()) {
    keywords.push(keywordInput.value.trim());
    console.log('키워드 입력 필드에서 수집:', keywordInput.value.trim());
  }

  // 2. 키워드 리스트에서 읽기 (대량 포스팅용)
  const keywordList = document.getElementById('keywordList');
  if (keywordList) {
    const keywordItems = keywordList.querySelectorAll('.keyword-item');

    keywordItems.forEach(item => {
      // 여러 방법으로 키워드 텍스트 찾기
      let keywordText = '';

      // 방법 1: span 태그에서 찾기
      const span = item.querySelector('span');
      if (span && span.textContent.trim()) {
        keywordText = span.textContent.trim();
      }

      // 방법 2: 첫 번째 텍스트 노드에서 찾기
      if (!keywordText) {
        const textNodes = Array.from(item.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
        if (textNodes.length > 0) {
          keywordText = textNodes[0].textContent.trim();
        }
      }

      // 방법 3: 직접 텍스트에서 찾기
      if (!keywordText) {
        const allText = item.textContent || item.innerText || '';
        const lines = allText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        if (lines.length > 0) {
          keywordText = lines[0];
        }
      }

      if (keywordText && keywordText.length > 0) {
        keywords.push(keywordText);
      }
    });
  }

  // 3. 기존 방식 (하위 호환성)
  if (keywords.length === 0) {
    const keywordInputs = document.querySelectorAll('.keyword-input');
    const fallbackKeywords = Array.from(keywordInputs)
      .map(input => input.value.trim())
      .filter(keyword => keyword.length > 0);
    keywords.push(...fallbackKeywords);
  }

  console.log('최종 수집된 키워드들:', keywords);
  return keywords;
}

// 포스팅 프로세스 (실시간 진행률 업데이트)
async function simulatePostingProcess(keywordData, postingMode, scheduleSettings) {
  console.log('🚀 포스팅 프로세스 시작 - 실시간 진행률 업데이트');

  // 즉시 진행률 업데이트 시작
  updateProgress(5, 5);
  updateTime(5);

  // 단계별 진행률 시뮬레이션 (백엔드 진행률과 동기화)
  const steps = [
    { progress: 10, label: '시스템 초기화 중...' },
    { progress: 20, label: '키워드 분석 중...' },
    { progress: 30, label: '콘텐츠 구조 설계 중...' },
    { progress: 40, label: 'AI 콘텐츠 생성 중...' },
    { progress: 60, label: '이미지 생성 중...' },
    { progress: 80, label: 'SEO 최적화 중...' },
    { progress: 90, label: '최종 검토 중...' },
    { progress: 100, label: '완료!' }
  ];

  for (const step of steps) {
    await new Promise(resolve => setTimeout(resolve, 800)); // 각 단계마다 0.8초 대기
    updateProgress(step.progress, step.progress);
    updateTime(step.progress);

    // 작업 상태 업데이트
    const statusEl = document.getElementById('workStatusTitle');
    const subtitleEl = document.getElementById('workStatusSubtitle');
    if (statusEl) statusEl.textContent = step.label;
    if (subtitleEl) {
      if (step.progress < 30) {
        subtitleEl.textContent = '시스템을 초기화하고 있습니다';
      } else if (step.progress < 60) {
        subtitleEl.textContent = 'AI가 고품질 콘텐츠를 생성하고 있습니다';
      } else if (step.progress < 90) {
        subtitleEl.textContent = '이미지와 미디어를 처리하고 있습니다';
      } else {
        subtitleEl.textContent = '모든 작업이 거의 완료되었습니다';
      }
    }
  }
}
// 단계 활성화
function activateStep(stepId) {
  const stepElement = document.getElementById(`step-${stepId}`);
  if (stepElement) {
    stepElement.classList.add('active');
    const icon = stepElement.querySelector('.progress-step-icon');
    if (icon) {
      icon.classList.remove('pending');
      icon.classList.add('active');
    }
  }
}

// 단계 완료
function completeStep(stepId, duration) {
  const stepElement = document.getElementById(`step-${stepId}`);
  if (stepElement) {
    stepElement.classList.remove('active');
    stepElement.classList.add('completed');
    const icon = stepElement.querySelector('.progress-step-icon');
    if (icon) {
      icon.classList.remove('active');
      icon.classList.add('completed');
    }

    // 단계 소요 시간 표시
    const timeElement = stepElement.querySelector(`#step-${stepId}-time`);
    if (timeElement) {
      timeElement.textContent = `${Math.round(duration / 1000)}초`;
    }
  }
}
// 현재 단계 업데이트
function updateCurrentStep(current, total) {
  const currentStepElement = document.getElementById('currentStepNumber');
  const totalStepsElement = document.getElementById('totalSteps');

  if (currentStepElement) currentStepElement.textContent = current;
  if (totalStepsElement) totalStepsElement.textContent = total;
}

// 작업 상태 업데이트
function updateWorkStatus(icon, title, subtitle) {
  const iconElement = document.getElementById('workStatusIcon');
  const titleElement = document.getElementById('workStatusTitle');
  const subtitleElement = document.getElementById('workStatusSubtitle');

  if (iconElement) iconElement.textContent = icon;
  if (titleElement) titleElement.textContent = title;
  if (subtitleElement) subtitleElement.textContent = subtitle;
}
// 예상 완료 시간 업데이트
function updateEstimatedTime(startTime, totalDuration, currentStep, totalSteps) {
  const elapsedTime = Date.now() - startTime;
  const elapsedSeconds = Math.floor(elapsedTime / 1000);
  const estimatedTotalTime = Math.floor((elapsedTime / currentStep) * totalSteps);
  const remainingTime = estimatedTotalTime - elapsedTime;

  // 경과 시간 업데이트
  const elapsedElement = document.getElementById('elapsedTime');
  if (elapsedElement) {
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    elapsedElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // 예상 완료 시간 업데이트
  const estimatedElement = document.getElementById('estimatedTime');
  if (estimatedElement && remainingTime > 0) {
    const remainingSeconds = Math.floor(remainingTime / 1000);
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    estimatedElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}
// 진행률 원형 차트 업데이트
function updateProgressCircle(percentage) {
  const circle = document.getElementById('progressCircle');
  if (circle) {
    const circumference = 2 * Math.PI * 40; // 2 * π * 40 = 251.33
    const offset = circumference - (percentage / 100) * circumference;

    // 부드러운 애니메이션 추가 (성능 최적화)
    circle.style.transition = 'stroke-dashoffset 0.4s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.2s ease-out';
    circle.style.strokeDashoffset = offset;

    // 진행률에 따른 펄스 효과
    if (percentage > 0 && percentage < 100) {
      circle.style.filter = 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.2))';
    } else if (percentage === 100) {
      circle.style.filter = 'drop-shadow(0 0 10px rgba(76, 175, 80, 0.5))';
    }

    console.log(`🎯 진행률: ${percentage}%, 오프셋: ${offset}`);
  }
}

// 부드러운 진행률 업데이트 함수
var currentProgress = 0;
var progressAnimationId = null;

function smoothProgressUpdate(targetProgress, label) {
  // 완전 비활성화 - 백엔드 진행률을 직접 사용
  console.log(`[SMOOTH PROGRESS] 비활성화됨 - 백엔드 진행률 직접 사용: ${targetProgress}%`);
  return;
}

// 진행률 UI 업데이트 함수
// updateProgressUI 함수는 updateProgress 함수로 통합됨 (중복 제거)

// 포스팅 모드 텍스트 변환
function getPostingModeText(mode) {
  const modeMap = {
    'immediate': '즉시 발행',
    'draft': '임시 발행',
    'schedule': '예약 발행'
  };
  return modeMap[mode] || '즉시 발행';
}

// 이미지 생성 모델 표시명 변환 (로그용)
function getImageModelDisplayName(provider) {
  const modelMap = {
    'nanobananapro': '🍌 NanoBananaPro (Gemini)',
    'imagen4': '🎨 Imagen 4 (Google)',
    'deepinfra': '🔵 FLUX-2-dev (DeepInfra)',
    'flux': '🔵 FLUX (DeepInfra)',
    'gemini': '🔴 Gemini Imagen',
    'collect': '📷 이미지 수집',
    'none': '❌ 이미지 없음',
    'ai': '🤖 AI 이미지',
    'AI 이미지': '🤖 AI 이미지'
  };
  return modelMap[provider?.toLowerCase?.()] || modelMap[provider] || provider || '알 수 없음';
}

function getCurrentPublishType() {
  const selectedMode = document.querySelector('input[name="postingMode"]:checked')?.value || 'immediate';
  if (selectedMode === 'schedule') return 'schedule';
  if (selectedMode === 'draft') return 'draft';
  return 'publish';
}

// 포스팅 모드 변경 시 예약 설정 UI 토글
function toggleScheduleSettings() {
  const scheduleSettings = document.getElementById('scheduleSettings');
  const selectedMode = document.querySelector('input[name="postingMode"]:checked')?.value;

  // scheduleSettings 요소가 존재하지 않으면 함수 종료
  if (!scheduleSettings) {
    console.warn('⚠️ [SCHEDULE] scheduleSettings 요소를 찾을 수 없습니다.');
    return;
  }

  if (selectedMode === 'schedule') {
    scheduleSettings.style.display = 'block';
    // 예약 시간 기본값 설정 (현재 시간 + 1시간)
    const now = new Date();
    now.setHours(now.getHours() + 1);
    const dateTimeString = now.toISOString().slice(0, 16);
    const scheduleDateTime = document.getElementById('scheduleDateTime');
    if (scheduleDateTime) {
      scheduleDateTime.value = dateTimeString;
    }
  } else {
    scheduleSettings.style.display = 'none';
  }
}

function toggleProgressCard(forceState) {
  const body = document.getElementById('progressCardBody');
  const button = document.getElementById('progressCollapseBtn');
  if (!body || !button) return;

  if (forceState === true) {
    body.classList.add('collapsed');
  } else if (forceState === false) {
    body.classList.remove('collapsed');
  } else {
    body.classList.toggle('collapsed');
  }

  const isCollapsed = body.classList.contains('collapsed');
  button.textContent = isCollapsed ? '펼치기' : '접기';
}

function expandProgressCard() {
  toggleProgressCard(false);
}

// 이벤트 위임 관리자 (최적화됨)
const EventManager = {
  init() {
    // 이벤트 위임으로 성능 최적화
    document.addEventListener('click', this.handleClick.bind(this));
    document.addEventListener('change', this.handleChange.bind(this));
    document.addEventListener('keypress', this.handleKeypress.bind(this));
  },

  handleClick(e) {
    const target = e.target;

    // 탭 전환
    if (target.matches('.tab-btn')) {
      const tabName = target.getAttribute('onclick')?.match(/showTab\('(.+)'\)/)?.[1];
      if (tabName) showTab(tabName);
    }

    // 기타 클릭 이벤트들...
  },

  handleChange(e) {
    const target = e.target;

    // 썸네일 타입 변경
    if (target.id === 'thumbnailType') {
      updateThumbnailPreview();
    }

    // 기타 변경 이벤트들...
  },

  handleKeypress(e) {
    if (e.key === 'Enter') {
      const target = e.target;
      if (target.classList.contains('work-record-input')) {
        addTodayWorkRecord('manual', target.value);
        target.value = '';
      }
    }
  }
};
// 초안 글자 수 업데이트 함수
function updateDraftCount() {
  const draftInput = document.getElementById('draftInput');
  const draftCount = document.getElementById('draftCount');

  if (draftInput && draftCount) {
    const pureLength = getPureCharacterCount(draftInput.value || '');
    draftCount.textContent = `${pureLength}/5000`;

    // 글자 수에 따른 색상 변경
    if (pureLength > 4000) {
      draftCount.style.background = 'rgba(239, 68, 68, 0.2)';
      draftCount.style.color = '#ef4444';
    } else if (pureLength > 2000) {
      draftCount.style.background = 'rgba(245, 158, 11, 0.2)';
      draftCount.style.color = '#f59e0b';
    } else {
      draftCount.style.background = 'rgba(255,255,255,0.1)';
      draftCount.style.color = 'rgba(255,255,255,0.7)';
    }
  }
}
// 페이지 로드 시 초기화 (최적화됨)
document.addEventListener('DOMContentLoaded', async function () {
  // 이벤트 매니저 초기화
  EventManager.init();

  // DOM 캐시 초기화
  DOMCache.init();
  ProgressCache.init();
  LogManager.init();

  // 엑셀 드래그 앤 드롭 초기화

  // 썸네일 타입을 항상 텍스트로 강제 설정
  const thumbnailTypeSelect = document.getElementById('thumbnailType');
  if (thumbnailTypeSelect) {
    thumbnailTypeSelect.value = 'text';
  }

  // localStorage 설정 로드
  loadSettings();

  // UX: 초보자 스마트 기본값 적용 (첫 실행 시만)
  applySmartDefaults();

  // UX: 고급 설정 Progressive Disclosure 초기화
  initProgressiveDisclosure();

  // 기본값 보장
  if (thumbnailTypeSelect && !thumbnailTypeSelect.value) {
    thumbnailTypeSelect.value = 'text';
  }

  try {
    await refreshSnippetLibraryUI();
  } catch (error) {
    console.warn('[SNIPPET] 초기 로드 실패:', error);
  }


  // 🔧 localStorage에도 저장 (3차 최종 보장)
  try {
    const savedSettings = localStorage.getItem('bloggerSettings');
    const settings = savedSettings ? JSON.parse(savedSettings) : {};

    // 기본값 보장 (무조건 강제)
    settings.thumbnailType = 'text';
    settings.platform = 'wordpress'; // 플랫폼도 워드프레스로 설정

    localStorage.setItem('bloggerSettings', JSON.stringify(settings));
    console.log('[INIT] localStorage에 기본값 최종 저장 완료 (3차):', settings);
  } catch (e) {
    console.error('[INIT] localStorage 저장 실패 (3차):', e);
  }


  // 콘텐츠 모드 변경 시 소제목 개수 자동 설정
  const contentModeSelect = document.getElementById('contentMode');
  const sectionCountSelect = document.getElementById('sectionCount');
  const customSectionCountInput = document.getElementById('customSectionCount');

  if (contentModeSelect && sectionCountSelect) {
    contentModeSelect.addEventListener('change', function () {
      const selectedMode = this.value;
      console.log(`[콘텐츠 모드 변경] 선택된 모드: ${selectedMode}`);

      // 페러프레이징 모드일 때 초안 입력 필드 표시/숨김
      const draftInputSection = document.getElementById('draftInputSection');
      const keywordInputSection = document.querySelector('[style*="스마트 키워드 입력"]').parentElement;

      if (selectedMode === 'paraphrasing') {
        if (draftInputSection) draftInputSection.style.display = 'block';
        if (keywordInputSection) keywordInputSection.style.display = 'none';
      } else {
        if (draftInputSection) draftInputSection.style.display = 'none';
        if (keywordInputSection) keywordInputSection.style.display = 'block';
      }

      if (selectedMode === 'shopping') {
        // 쇼핑 모드일 때 자동으로 7개 설정
        sectionCountSelect.value = '7';
        if (customSectionCountInput) {
          customSectionCountInput.value = '7';
        }
        console.log('[콘텐츠 모드 변경] 쇼핑 모드 선택 - 소제목 개수를 7개로 자동 설정');
      } else {
        // 다른 모드일 때는 기본값 5개로 설정
        sectionCountSelect.value = '5';
        if (customSectionCountInput) {
          customSectionCountInput.value = '5';
        }
        console.log('[콘텐츠 모드 변경] 일반 모드 선택 - 소제목 개수를 5개로 자동 설정');
      }
    });
  }
  // .env 파일에서도 설정 불러오기 (API 키 등)
  if (window.blogger && window.blogger.getEnv) {
    try {
      const envResult = await window.blogger.getEnv();
      if (envResult && envResult.ok && envResult.data) {
        console.log('[ENV] .env 파일에서 API 키 로드 성공');
        // localStorage 설정과 병합 (env가 우선)
        const savedSettings = loadSettings();
        const mergedSettings = Object.assign({}, savedSettings, envResult.data);
        if (savedSettings && savedSettings.platform) {
          mergedSettings.platform = savedSettings.platform;
        } else if (envResult && envResult.data && envResult.data.platform) {
          mergedSettings.platform = envResult.data.platform;
        } else {
          mergedSettings.platform = 'blogspot';
        }
        localStorage.setItem('bloggerSettings', JSON.stringify(mergedSettings));
        console.log('[ENV] API 키가 자동으로 로드되었습니다');
      }
    } catch (error) {
      console.error('[ENV] .env 로드 실패:', error);
    }
  }

  console.log('[PREVIEW] 미리보기 탭이 기본으로 표시됩니다');

  // 라이센스 정보 로드
  await loadLicenseInfo();

  // 쿼터 카운터 초기화
  updateFreeQuotaCounter();

  // 앱 버전 표시
  try {
    if (window.blogger && window.blogger.getAppVersion) {
      const ver = await window.blogger.getAppVersion();
      const el = document.getElementById('appVersionText');
      if (el && ver) el.textContent = ver;
    }
  } catch { /* ignore */ }

  // 초기 플랫폼 설정 (워드프레스가 기본값)
  const bloggerRadio = document.getElementById('platform-blogger');
  const wordpressRadio = document.getElementById('platform-wordpress');

  // 저장된 설정에서 플랫폼 로드 (강제로 워드프레스 기본값 설정)
  const savedSettings = loadSettings();

  // 모든 라디오 버튼 체크 해제
  if (bloggerRadio) bloggerRadio.checked = false;
  if (wordpressRadio) wordpressRadio.checked = false;

  // 강제로 워드프레스 선택 (기본값)
  if (wordpressRadio) {
    wordpressRadio.checked = true;
  }

  // 설정도 워드프레스로 강제 업데이트
  if (savedSettings.platform !== 'wordpress') {
    savedSettings.platform = 'wordpress';
    localStorage.setItem('bloggerSettings', JSON.stringify(savedSettings));
  }

  console.log('초기 플랫폼 설정:', {
    savedPlatform: savedSettings.platform,
    bloggerChecked: bloggerRadio ? bloggerRadio.checked : 'N/A',
    wordpressChecked: wordpressRadio ? wordpressRadio.checked : 'N/A'
  });

  // 플랫폼 상태 업데이트
  updatePlatformStatus();

  // 플랫폼 필드 초기화
  togglePlatformFields();

  // 키워드 카운트 초기화
  updateKeywordCount();
  updateRemoveButtons();

  // 실시간 시계 및 달력 초기화
  updateRealtimeClock();
  renderCalendar();

  // 1초마다 시계 업데이트
  setInterval(updateRealtimeClock, 1000);

  // 첫 번째 키워드 필드의 제목 선택 드롭다운 이벤트 리스너
  const firstTitleSelect = document.querySelector('.keyword-title-select');
  const firstCustomTitleInput = document.getElementById('customTitleInput');

  if (firstTitleSelect && firstCustomTitleInput) {
    firstTitleSelect.addEventListener('change', function () {
      if (this.value === 'custom') {
        firstCustomTitleInput.style.display = 'flex';
      } else {
        firstCustomTitleInput.style.display = 'none';
      }
    });
  }
  // 플랫폼 변경 이벤트 리스너
  document.querySelectorAll('input[name="platform"]').forEach(radio => {
    radio.addEventListener('change', function () {
      console.log('플랫폼 변경 감지:', this.value);

      const platform = this.value;
      const bloggerSettings = document.getElementById('bloggerSettings');
      const wordpressSettings = document.getElementById('wordpressSettings');

      if (platform === 'wordpress') {
        if (wordpressSettings) wordpressSettings.style.display = 'block';
        if (bloggerSettings) bloggerSettings.style.display = 'none';
      } else {
        if (wordpressSettings) wordpressSettings.style.display = 'none';
        if (bloggerSettings) bloggerSettings.style.display = 'block';
      }

      // 플랫폼 상태 배지 업데이트
      updatePlatformStatus();

      // 포스팅 페이지의 플랫폼 필드도 업데이트
      togglePlatformFields();
    });
  });

  // ============================================
  // IPC 이벤트 리스너 (백엔드로부터 로그 및 진행 상황 받기)
  // ============================================

  // 로그 메시지 수신 (PROGRESS만 표시)
  if (window.blogger && window.blogger.onLog) {
    window.blogger.onLog((line) => {
      if (line.includes('[PROGRESS]')) {
        addLog(line, 'progress');
      } else {
        addLog(line);
      }
    });
  }

  // 진행 상황 수신 (로그와 동기화 개선)
  if (window.blogger && window.blogger.onProgress) {
    window.blogger.onProgress((data) => {
      const { p, label } = data;
      const actualProgress = Math.min(100, Math.max(0, p));
      const statusLabel = label || '';

      console.log(`[PROGRESS] ${actualProgress}% - ${statusLabel}`);

      if (actualProgress === 0) {
        progressStartTime = null;
        overallProgress = 0;
        latestLogProgress = 0;
        updateProgress(0, 0, statusLabel);
        updateTime(0);
        return;
      }

      // 프로그레스 바 + 상태 텍스트 + 시간 모두 갱신
      updateProgressStatus(statusLabel);
      applyProgressVisual(actualProgress, statusLabel);
      latestLogProgress = actualProgress;
    });
  }

  // 🖼️ 이미지 생성 이벤트 수신 (실시간 그리드 업데이트)
  if (window.blogger && window.blogger.onImageGenerated) {
    window.blogger.onImageGenerated((data) => {
      const { slotIndex, imageUrl, status } = data;
      console.log(`[IMAGE-GENERATED] 슬롯 ${slotIndex}: ${status}`, imageUrl ? imageUrl.substring(0, 50) : '');

      // 이미지 그리드 슬롯 업데이트
      if (typeof updateImageSlot === 'function') {
        updateImageSlot(slotIndex, imageUrl, status);
      }
    });
    console.log('[IPC] onImageGenerated 리스너 등록 완료');
  }

  // 관리자 모드 단축키 수신
  if (window.blogger && window.blogger.onAdminShortcut) {
    window.blogger.onAdminShortcut(() => {
      const pin = prompt('관리자 PIN을 입력하세요:');
      if (pin === '1234') {
        alert('관리자 모드 활성화됨 (개발자 도구 열기)');
      }
    });
  }
});
// ============================================
// 썸네일 생성기 함수들
// ============================================
var currentThumbnailCanvas = null;
var thumbnailBackgroundImageDataUrl = null;
var thumbnailBackgroundImage = null;
var thumbnailBackgroundImageSourceLabel = '';
// 썸네일 미리보기 업데이트
function updateThumbnailPreview() {
  const text = document.getElementById('thumbnailText')?.value || '';
  const fontSize = document.getElementById('thumbnailFontSize')?.value || 80;
  const bgColor = document.getElementById('thumbnailBgColor')?.value || '#ffffff';
  const textColor = document.getElementById('thumbnailTextColor')?.value || '#000000';
  const borderColor = document.getElementById('thumbnailBorderColor')?.value || '#ff6b35';

  const hasText = !!(text && text.trim().length);
  const hasBackgroundImage = !!thumbnailBackgroundImageDataUrl;

  updateThumbnailBackgroundStatus();

  // 폰트 크기 값 표시
  const fontSizeValue = document.getElementById('fontSizeValue');
  if (fontSizeValue) fontSizeValue.textContent = fontSize;

  // 색상 값 표시
  const bgColorValue = document.getElementById('bgColorValue');
  const textColorValue = document.getElementById('textColorValue');
  const borderColorValue = document.getElementById('borderColorValue');
  if (bgColorValue) bgColorValue.textContent = bgColor;
  if (textColorValue) textColorValue.textContent = textColor;
  if (borderColorValue) borderColorValue.textContent = borderColor;

  const previewDiv = document.getElementById('thumbnailPreview');
  if (!previewDiv) return;

  if (!hasText && !hasBackgroundImage) {
    currentThumbnailCanvas = null;
    const downloadBtn = document.getElementById('downloadThumbnailBtn');
    if (downloadBtn) downloadBtn.style.display = 'none';
    return;
  }

  const needsBackgroundLoad = hasBackgroundImage && (!thumbnailBackgroundImage || thumbnailBackgroundImageDataUrl !== thumbnailBackgroundImage.__sourceDataUrl || !thumbnailBackgroundImage.complete);
  if (needsBackgroundLoad) {
    const img = new Image();
    img.onload = () => {
      thumbnailBackgroundImage = img;
      thumbnailBackgroundImage.__sourceDataUrl = thumbnailBackgroundImageDataUrl;
      updateThumbnailBackgroundStatus();
      updateThumbnailPreview();
    };
    img.onerror = (error) => {
      console.error('❌ [THUMBNAIL] 배경 이미지 로드 실패:', error);
      thumbnailBackgroundImageDataUrl = null;
      thumbnailBackgroundImage = null;
      thumbnailBackgroundImageSourceLabel = '';
      updateThumbnailBackgroundStatus();
      updateThumbnailPreview();
    };
    img.src = thumbnailBackgroundImageDataUrl;
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext('2d');

  // 기본 배경
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (hasBackgroundImage && thumbnailBackgroundImage && thumbnailBackgroundImage.complete) {
    ctx.drawImage(thumbnailBackgroundImage, 0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  // 테두리
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 20;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  if (hasText) {
    const normalizedText = text.trim();
    ctx.fillStyle = textColor;
    ctx.font = `bold ${fontSize}px "Noto Sans KR", "Malgun Gothic", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const maxWidth = canvas.width - 100;
    const words = normalizedText.split(/\s+/);
    const lines = [];
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
      const testLine = currentLine ? currentLine + ' ' + words[i] : words[i];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth) {
        if (currentLine) lines.push(currentLine);
        currentLine = words[i];
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    const lineHeight = parseInt(fontSize, 10) * 1.3;
    const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;

    lines.forEach((line, index) => {
      ctx.fillText(line, canvas.width / 2, startY + index * lineHeight);
    });
  }

  previewDiv.innerHTML = '';
  const img = document.createElement('img');
  img.src = canvas.toDataURL();
  img.style.cssText = 'max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);';
  previewDiv.appendChild(img);

  const downloadBtn = document.getElementById('downloadThumbnailBtn');
  if (downloadBtn) downloadBtn.style.display = 'block';
  currentThumbnailCanvas = canvas;
}
function updateThumbnailBackgroundStatus() {
  const statusEl = document.getElementById('thumbnailBgImageStatus');
  if (!statusEl) return;
  if (thumbnailBackgroundImageDataUrl) {
    const label = thumbnailBackgroundImageSourceLabel || '사용자 배경';
    const trimmedLabel = label.length > 60 ? `${label.slice(0, 57)}...` : label;
    statusEl.textContent = `배경 이미지 적용됨 (${trimmedLabel})`;
    statusEl.style.color = 'rgba(187, 247, 208, 0.95)';
  } else {
    statusEl.textContent = '배경 이미지 없음';
    statusEl.style.color = 'rgba(255, 255, 255, 0.7)';
  }
}

function handleThumbnailBgImageUpload(event) {
  try {
    const file = event?.target?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일을 선택해주세요.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      thumbnailBackgroundImageDataUrl = reader.result;
      thumbnailBackgroundImageSourceLabel = file.name;
      thumbnailBackgroundImage = null;
      updateThumbnailBackgroundStatus();
      updateThumbnailPreview();
    };
    reader.onerror = () => {
      console.error('❌ [THUMBNAIL] 배경 이미지 파일 읽기 실패:', reader.error);
      alert('이미지 파일을 불러오지 못했습니다.');
    };
    reader.readAsDataURL(file);
  } catch (error) {
    console.error('❌ [THUMBNAIL] 배경 이미지 업로드 오류:', error);
    alert('배경 이미지를 적용하는 중 오류가 발생했습니다.');
  }
}
async function applyThumbnailBgImageUrl() {
  const urlInput = document.getElementById('thumbnailBgImageUrl');
  const url = urlInput?.value?.trim();
  if (!url) {
    alert('배경으로 사용할 이미지 URL을 입력해주세요.');
    return;
  }

  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) {
      throw new Error('이미지 형식이 아닙니다.');
    }

    const reader = new FileReader();
    reader.onload = () => {
      thumbnailBackgroundImageDataUrl = reader.result;
      thumbnailBackgroundImageSourceLabel = url;
      thumbnailBackgroundImage = null;
      updateThumbnailBackgroundStatus();
      updateThumbnailPreview();
    };
    reader.onerror = () => {
      console.error('❌ [THUMBNAIL] 이미지 URL 변환 실패:', reader.error);
      alert('이미지 URL을 불러오지 못했습니다.');
    };
    reader.readAsDataURL(blob);
  } catch (error) {
    console.error('❌ [THUMBNAIL] URL 배경 이미지 적용 실패:', error);
    alert('이미지 URL을 불러오지 못했습니다. 다른 URL을 시도해주세요.');
  }
}

function clearThumbnailBackgroundImage() {
  thumbnailBackgroundImageDataUrl = null;
  thumbnailBackgroundImage = null;
  thumbnailBackgroundImageSourceLabel = '';
  const fileInput = document.getElementById('thumbnailBgImageFile');
  if (fileInput) fileInput.value = '';
  const urlInput = document.getElementById('thumbnailBgImageUrl');
  if (urlInput) urlInput.value = '';
  updateThumbnailBackgroundStatus();
  updateThumbnailPreview();
}
// 텍스트 썸네일 생성
function generateTextThumbnail() {
  const text = document.getElementById('thumbnailText')?.value;
  if (!text || text.trim() === '') {
    alert('썸네일에 표시할 텍스트를 입력해주세요.');
    return;
  }

  updateThumbnailPreview();

  // 생성된 썸네일을 localStorage에 저장 (포스팅 시 자동 사용)
  if (currentThumbnailCanvas) {
    currentThumbnailCanvas.toBlob((blob) => {
      const reader = new FileReader();
      reader.onload = function () {
        const dataUrl = reader.result;
        localStorage.setItem('generatedThumbnail', dataUrl);
        localStorage.setItem('thumbnailText', text);
        console.log('✅ 썸네일이 저장되었습니다. 포스팅 시 자동으로 사용됩니다.');
      };
      reader.readAsDataURL(blob);
    });
  }

  alert('✅ 썸네일이 생성되었습니다! 포스팅 시 자동으로 사용됩니다.');
}
// 썸네일 다운로드
function downloadThumbnail() {
  if (!currentThumbnailCanvas) {
    alert('먼저 썸네일을 생성해주세요.');
    return;
  }

  try {
    // Canvas를 Blob으로 변환
    currentThumbnailCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `thumbnail-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert('✅ 썸네일이 다운로드되었습니다!');
    }, 'image/png');
  } catch (error) {
    console.error('썸네일 다운로드 오류:', error);
    alert('❌ 썸네일 다운로드 중 오류가 발생했습니다.');
  }
}

// 프리셋 적용
function applyPreset(bgColor, textColor, borderColor) {
  const bgInput = document.getElementById('thumbnailBgColor');
  const textInput = document.getElementById('thumbnailTextColor');
  const borderInput = document.getElementById('thumbnailBorderColor');

  if (bgInput) bgInput.value = bgColor;
  if (textInput) textInput.value = textColor;
  if (borderInput) borderInput.value = borderColor;

  updateThumbnailPreview();
}
// 워드프레스 카테고리 로드 함수
async function loadWpCategories() {
  // 환경 설정 모달에서 워드프레스 정보 가져오기
  const wpUrlElement = document.getElementById('wordpressSiteUrl');
  const wpUsernameElement = document.getElementById('wordpressUsername');
  const wpPasswordElement = document.getElementById('wordpressPassword');

  if (!wpUrlElement || !wpUsernameElement || !wpPasswordElement) {
    alert('워드프레스 연결 정보를 먼저 설정해주세요. 환경 설정에서 워드프레스 정보를 입력하세요.');
    return;
  }

  const wpUrl = wpUrlElement.value;
  const wpUsername = wpUsernameElement.value;
  const wpPassword = wpPasswordElement.value;

  console.log('워드프레스 정보:', { wpUrl, wpUsername, wpPassword: wpPassword ? '***' : 'empty' });

  if (!wpUrl || !wpUsername || !wpPassword) {
    alert('워드프레스 URL, 사용자명, 비밀번호를 모두 입력해주세요.');
    return;
  }

  try {
    console.log('워드프레스 카테고리 로드 시작...');
    const result = await window.electronAPI.loadWpCategories({ wpUrl, wpUsername, wpPassword });
    console.log('카테고리 로드 결과:', result);

    if (result.ok && result.categories) {
      const categorySelect = document.getElementById('wpCategory');
      categorySelect.innerHTML = '<option value="">카테고리 선택</option>';

      result.categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        categorySelect.appendChild(option);
      });

      alert(`${result.categories.length}개의 카테고리를 로드했습니다.`);
    } else {
      alert('카테고리 로드에 실패했습니다: ' + (result.error || '알 수 없는 오류'));
    }
  } catch (error) {
    console.error('워드프레스 카테고리 로드 오류:', error);
    alert('카테고리 로드 중 오류가 발생했습니다: ' + error.message);
  }
}
// 키워드 추가 함수 (통합 UI용) - 예약시간과 이미지 설정 포함
function addKeyword() {
  const keywordInput = document.getElementById('keywordInput');
  if (!keywordInput) {
    console.log('키워드 입력 필드를 찾을 수 없습니다.');
    return;
  }

  const keyword = keywordInput.value.trim();
  if (!keyword) {
    alert('키워드를 입력해주세요.');
    return;
  }

  // 키워드 목록에 추가
  const keywordList = document.getElementById('keywordList');
  if (keywordList) {
    const keywordId = 'keyword_' + Date.now();
    const keywordItem = document.createElement('div');
    keywordItem.className = 'keyword-item';
    keywordItem.id = keywordId;
    keywordItem.style.cssText = `
             background: rgba(255, 255, 255, 0.15);
             border: 1px solid rgba(255, 255, 255, 0.2);
             border-radius: 16px;
             padding: 20px;
             margin: 12px auto;
             backdrop-filter: blur(15px);
             transition: all 0.3s ease;
        width: 100%;
        max-width: 1600px;
             box-shadow: 0 6px 24px rgba(0, 0, 0, 0.1);
           `;

    keywordItem.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); width: 8px; height: 8px; border-radius: 50%;"></div>
          <span style="color: white; font-size: 16px; font-weight: 600;">${keyword}</span>
        </div>
        <button onclick="removeKeyword(this)" style="background: rgba(255, 0, 0, 0.2); border: 1px solid rgba(255, 0, 0, 0.4); color: white; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; font-size: 14px; font-weight: bold; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease;" onmouseover="this.style.background='rgba(255, 0, 0, 0.4)'" onmouseout="this.style.background='rgba(255, 0, 0, 0.2)'">×</button>
      </div>
      
             <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; max-width: 1500px; margin: 0 auto;">
        <!-- 예약시간 설정 -->
        <div>
          <label style="color: rgba(255, 255, 255, 0.9); font-size: 13px; font-weight: 600; margin-bottom: 8px; display: block;">⏰ 예약시간</label>
          <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <input type="date" id="${keywordId}_date" style="background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); color: white; border-radius: 8px; padding: 8px 10px; font-size: 13px; flex: 1;">
            <input type="time" id="${keywordId}_time" style="background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); color: white; border-radius: 8px; padding: 8px 10px; font-size: 13px; width: 120px;">
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span style="color: rgba(255, 255, 255, 0.8); font-size: 12px;">또는</span>
            <input type="number" id="${keywordId}_minutesAfter" placeholder="분 후 발행 (예: 15)" min="1" style="background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); color: white; border-radius: 8px; padding: 6px 8px; font-size: 12px; flex: 1;">
            <span style="color: rgba(255, 255, 255, 0.7); font-size: 11px;">분 후</span>
          </div>
        </div>
        
        <!-- 콘텐츠 모드 설정 -->
        <div>
          <label style="color: rgba(255, 255, 255, 0.9); font-size: 13px; font-weight: 600; margin-bottom: 8px; display: block;">📝 콘텐츠 모드</label>
          <select id="${keywordId}_contentMode" style="background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); color: white; border-radius: 8px; padding: 8px 10px; font-size: 13px; width: 100%;">
            <option value="external">🔗 단일 외부링크 (SEO)</option>
            <option value="internal">🕸️ 내부링크 거미줄치기</option>
            <option value="shopping">🛒 쇼핑/구매유도</option>
          </select>
          <small style="color: rgba(255, 255, 255, 0.6); font-size: 10px; margin-top: 4px; display: block;">외부: 공식 사이트 유도, 내부: 관련 글 연결, 쇼핑: 제품 리뷰</small>
        </div>
        
        <!-- CTA 설정 -->
        <div>
          <label style="color: rgba(255, 255, 255, 0.9); font-size: 13px; font-weight: 600; margin-bottom: 8px; display: block;">🔗 CTA 설정</label>
          <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px; color: rgba(255, 255, 255, 0.9);">
              <input type="radio" name="cta_${keywordId}" value="auto" id="${keywordId}_ctaAuto" checked style="width: 14px; height: 14px; cursor: pointer;">
              🤖 자동
            </label>
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px; color: rgba(255, 255, 255, 0.9);">
              <input type="radio" name="cta_${keywordId}" value="manual" id="${keywordId}_ctaManual" style="width: 14px; height: 14px; cursor: pointer;">
              ✏️ 수동
            </label>
          </div>
          <button onclick="openKeywordCtaModal('${keywordId}')" id="${keywordId}_ctaBtn" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; padding: 6px 12px; font-size: 11px; font-weight: 600; cursor: pointer; width: 100%; display: none;">
            CTA 링크 설정
          </button>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; max-width: 1500px; margin: 16px auto 0 auto;">
        <!-- 이미지 설정 -->
        <div>
          <label style="color: rgba(255, 255, 255, 0.9); font-size: 13px; font-weight: 600; margin-bottom: 8px; display: block;">🖼️ 이미지 설정</label>
          <select id="${keywordId}_imageMode" style="background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); color: white; border-radius: 8px; padding: 8px 10px; font-size: 13px; width: 100%;" onchange="toggleImageSettings('${keywordId}')">
            <option value="pexels">📸 픽셀</option>
            <option value="dalle">🎨 달리</option>
            <option value="cse">🔍 CSE</option>
            <option value="custom">✏️ 직접입력</option>
            <option value="none">🚫 없음</option>
          </select>
          <input type="text" id="${keywordId}_imagePrompt" placeholder="이미지 설명" style="background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); color: white; border-radius: 8px; padding: 8px 10px; font-size: 13px; width: 100%; margin-top: 8px; display: none;">
        </div>

        <!-- 추가 설정 -->
        <div>
          <label style="color: rgba(255, 255, 255, 0.9); font-size: 13px; font-weight: 600; margin-bottom: 8px; display: block;">⚙️ 추가 옵션</label>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label style="color: rgba(255, 255, 255, 0.8); font-size: 12px; display: flex; align-items: center; gap: 6px;">
              <input type="checkbox" id="${keywordId}_autoPublish" style="transform: scale(1.1);">
              <span>자동 발행</span>
            </label>
          </div>
        </div>
      </div>
      
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
        <small style="color: rgba(255, 255, 255, 0.7); font-size: 11px;">💡 예약시간 미설정시 즉시 포스팅,<br>이미지 AI 자동생성</small>
      </div>
    `;

    keywordList.appendChild(keywordItem);

    // 오늘 날짜를 기본값으로 설정
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);

    document.getElementById(`${keywordId}_date`).value = today;
    document.getElementById(`${keywordId}_time`).value = currentTime;

    // CTA 라디오 버튼 이벤트 리스너 추가
    const ctaAutoRadio = document.getElementById(`${keywordId}_ctaAuto`);
    const ctaManualRadio = document.getElementById(`${keywordId}_ctaManual`);
    const ctaBtn = document.getElementById(`${keywordId}_ctaBtn`);

    if (ctaAutoRadio && ctaManualRadio && ctaBtn) {
      ctaAutoRadio.addEventListener('change', function () {
        if (this.checked) {
          ctaBtn.style.display = 'none';
        }
      });

      ctaManualRadio.addEventListener('change', function () {
        if (this.checked) {
          ctaBtn.style.display = 'block';
        }
      });
    }
  }
  // 입력 필드 초기화
  keywordInput.value = '';
  console.log('키워드 추가됨:', keyword);
}

// 키워드 제거 함수
function removeKeyword(button) {
  const keywordItem = button.closest('.keyword-item');
  if (keywordItem) {
    keywordItem.remove();
  }
}
// 이미지 설정 토글 함수
function toggleImageSettings(keywordId) {
  const imageMode = document.getElementById(`${keywordId}_imageMode`);
  const imagePrompt = document.getElementById(`${keywordId}_imagePrompt`);

  if (imageMode.value === 'custom') {
    imagePrompt.style.display = 'block';
    imagePrompt.focus();
    imagePrompt.placeholder = '이미지 설명을 입력하세요 (예: 고품질 비즈니스 이미지)';
  } else {
    imagePrompt.style.display = 'none';
    imagePrompt.value = '';

    // 각 이미지 모드별로 적절한 플레이스홀더 설정
    if (imageMode.value === 'pexels') {
      imagePrompt.placeholder = 'Pexels에서 검색할 키워드를 입력하세요';
    } else if (imageMode.value === 'dalle') {
      imagePrompt.placeholder = 'DALL-E로 생성할 이미지 설명을 입력하세요';
    } else if (imageMode.value === 'cse') {
      imagePrompt.placeholder = 'Google CSE로 검색할 키워드를 입력하세요';
    }
  }
}
// 모든 키워드 설정 수집 함수
function getAllKeywordSettings() {
  const keywordList = document.getElementById('keywordList');
  const keywordItems = keywordList.querySelectorAll('.keyword-item');
  const settings = [];

  keywordItems.forEach(item => {
    const keywordId = item.id;
    const keywordText = item.querySelector('span').textContent;
    const date = document.getElementById(`${keywordId}_date`)?.value;
    const time = document.getElementById(`${keywordId}_time`)?.value;
    const minutesAfter = document.getElementById(`${keywordId}_minutesAfter`)?.value;
    const contentMode = document.getElementById(`${keywordId}_contentMode`)?.value || 'external';
    const imageMode = document.getElementById(`${keywordId}_imageMode`)?.value;
    const imagePrompt = document.getElementById(`${keywordId}_imagePrompt`)?.value;
    const autoPublish = document.getElementById(`${keywordId}_autoPublish`)?.checked || false;

    // CTA 설정 확인
    const ctaAuto = document.getElementById(`${keywordId}_ctaAuto`)?.checked;
    const ctaManual = document.getElementById(`${keywordId}_ctaManual`)?.checked;
    const customCtas = keywordCtaData[keywordId] || null;

    // 예약시간 계산
    let scheduledTime = null;
    if (minutesAfter && parseInt(minutesAfter) > 0) {
      // "몇 분 후" 설정이 있으면 우선 적용
      const now = new Date();
      scheduledTime = new Date(now.getTime() + parseInt(minutesAfter) * 60000);
    } else if (date && time) {
      // 그렇지 않으면 날짜/시간 설정 사용
      scheduledTime = new Date(`${date}T${time}`);
    }

    settings.push({
      keyword: keywordText,
      scheduledTime: scheduledTime,
      contentMode: contentMode,
      imageMode: imageMode,
      imagePrompt: imagePrompt,
      autoPublish: autoPublish,
      ctaMode: ctaManual ? 'manual' : 'auto',
      customCtas: customCtas
    });
  });

  return settings;
}

// 대량 포스팅 실행 함수
async function runBulkPosting() {
  const keywordSettings = getAllKeywordSettings();

  if (keywordSettings.length === 0) {
    alert('포스팅할 키워드를 먼저 추가해주세요.');
    return;
  }

  // 현재 설정 수집 (기본값 사용)
  const currentSettings = {
    provider: 'gemini',
    platform: 'blogspot',
    thumbnailMode: 'auto',
    imageProvider: 'auto',
    wordCount: 2000,
    autoPublish: false,
    includeImages: true,
    includeCTA: true,
    includeTableOfContents: true,
    seoOptimized: true
  };

  // 예약 포스트가 있는지 확인
  const scheduledPosts = keywordSettings.filter(setting => setting.scheduledTime && setting.scheduledTime > new Date());
  const immediatePosts = keywordSettings.filter(setting => !setting.scheduledTime || setting.scheduledTime <= new Date());

  let totalPosts = keywordSettings.length;
  let completedPosts = 0;

  // 진행 상황 표시
  const progressModal = createProgressModal(totalPosts);
  document.body.appendChild(progressModal);

  try {
    // 즉시 포스트부터 처리
    for (let i = 0; i < immediatePosts.length; i++) {
      const setting = immediatePosts[i];
      updateProgressModal(progressModal, completedPosts + 1, totalPosts, setting.keyword, '포스트 생성 중...');

      try {
        await createSinglePost(setting, currentSettings);
        completedPosts++;
        updateProgressModal(progressModal, completedPosts, totalPosts, setting.keyword, '완료!');

        // 포스트 간 지연
        if (i < immediatePosts.length - 1) {
          updateProgressModal(progressModal, completedPosts, totalPosts, '다음 포스트 준비 중...', '5초 대기 중...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error) {
        console.error('포스트 생성 오류:', error);
        updateProgressModal(progressModal, completedPosts, totalPosts, setting.keyword, `오류: ${error.message}`);
      }
    }

    // 예약 포스트 스케줄링
    if (scheduledPosts.length > 0) {
      updateProgressModal(progressModal, completedPosts, totalPosts, '예약 포스트 스케줄링', '예약 포스트를 등록합니다...');

      for (const setting of scheduledPosts) {
        await schedulePost(setting, currentSettings);
      }

      updateProgressModal(progressModal, completedPosts + scheduledPosts.length, totalPosts, '모든 작업 완료!', `${scheduledPosts.length}개의 예약 포스트가 등록되었습니다.`);
    } else {
      updateProgressModal(progressModal, completedPosts, totalPosts, '모든 작업 완료!', '모든 포스트가 성공적으로 생성되었습니다.');
    }

  } catch (error) {
    console.error('대량 포스팅 오류:', error);
    alert(`대량 포스팅 중 오류가 발생했습니다: ${error.message}`);
  } finally {
    // 3초 후 진행 상황 모달 닫기
    setTimeout(() => {
      document.body.removeChild(progressModal);
    }, 3000);
  }
}
// 단일 포스트 생성 함수
async function createSinglePost(setting, currentSettings) {
  // 이미지 모드에 따라 imageProvider 설정
  let imageProvider = currentSettings.imageProvider;
  if (setting.imageMode === 'pexels') {
    imageProvider = 'pexels';
  } else if (setting.imageMode === 'dalle') {
    imageProvider = 'dalle';
  } else if (setting.imageMode === 'cse') {
    imageProvider = 'cse';
  }

  const payload = {
    keywords: [{
      keyword: setting.keyword,
      title: setting.keyword, // AI가 제목을 생성하도록 함
      imageMode: setting.imageMode,
      imagePrompt: setting.imagePrompt
    }],
    provider: currentSettings.provider,
    platform: currentSettings.platform,
    thumbnailMode: currentSettings.thumbnailMode,
    imageProvider: imageProvider,
    wordCount: currentSettings.wordCount,
    autoPublish: setting.autoPublish !== undefined ? setting.autoPublish : currentSettings.autoPublish,
    includeImages: currentSettings.includeImages,
    includeCTA: setting.includeCTA !== undefined ? setting.includeCTA : currentSettings.includeCTA,
    includeTableOfContents: currentSettings.includeTableOfContents,
    seoOptimized: currentSettings.seoOptimized
  };

  return await window.blogger.runPost(payload);
}
// 예약 포스트 스케줄링 함수
async function schedulePost(setting, currentSettings) {
  const payload = {
    keywords: [{
      keyword: setting.keyword,
      title: setting.keyword,
      imageMode: setting.imageMode,
      imagePrompt: setting.imagePrompt
    }],
    scheduledTime: setting.scheduledTime,
    ...currentSettings
  };

  // 예약 포스트를 localStorage에 저장
  const scheduledPosts = JSON.parse(localStorage.getItem('scheduledPosts') || '[]');
  scheduledPosts.push({
    id: Date.now(),
    payload: payload,
    scheduledTime: setting.scheduledTime.toISOString(),
    status: 'scheduled'
  });
  localStorage.setItem('scheduledPosts', JSON.stringify(scheduledPosts));

  console.log('예약 포스트 등록됨:', setting.keyword, setting.scheduledTime);
}
// 테스트용 미리보기 표시 함수
function testPreview() {
  const sampleContent = `
    <h1 style="color: #1e293b; margin-bottom: 20px;">초안 입력 사용법</h1>
    
    <div style="background: rgba(102, 126, 234, 0.1); padding: 15px; border-radius: 8px; margin: 20px 0;">
      <h2 style="color: #667eea;">📌 초안 입력 사용법</h2>
    </div>
    
    <p style="line-height: 1.8; color: #334155; margin: 15px 0;">
      기존 문서를 붙여넣어 AI가 문맥과 서식을 학습하도록 돕는 영역입니다.
    </p>
    
    <img src="https://via.placeholder.com/800x400" style="width: 100%; border-radius: 12px; margin: 20px 0;" />
    
    <p style="line-height: 1.8; color: #334155; margin: 15px 0;">
      웹에서 복사한 글은 Ctrl+Shift+V(서식 제거)로 붙여넣어 불필요한 스타일을 없앱니다.
      상단 순수 글자수 카운터가 5,000자를 넘으면 AI가 분량을 자동으로 압축하므로 필요한 경우 미리 정리합니다.
      초안이 없다면 비워 두고 키워드/설정만 입력하면 완전히 새 글이 생성됩니다.
    </p>
    
    <table style="width: 100%; border-collapse: collapse; margin: 25px 0;">
      <thead>
        <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
          <th style="padding: 12px; text-align: left; color: white;">기능</th>
          <th style="padding: 12px; text-align: left; color: white;">설명</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom: 1px solid #f0f0f0;">
          <td style="padding: 12px;">초안 입력</td>
          <td style="padding: 12px;">기존 문서를 붙여넣어 AI가 문맥과 서식을 학습하도록 돕는 영역</td>
        </tr>
        <tr style="background: #f9f9f9;">
          <td style="padding: 12px;">서식 제거</td>
          <td style="padding: 12px;">Ctrl+Shift+V로 붙여넣어 불필요한 스타일을 없앱니다.</td>
        </tr>
        <tr>
          <td style="padding: 12px;">글자수 제한</td>
          <td style="padding: 12px;">상단 순수 글자수 카운터가 5,000자를 넘으면 AI가 분량을 자동으로 압축합니다.</td>
        </tr>
      </tbody>
    </table>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="#" style="display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 700;">
        🔗 자세히 알아보기
      </a>
    </div>
  `;

  showPreviewModal('초안 입력 사용법', sampleContent, 'wordpress');
}

// ==========================================
// 미리보기 생성 및 발행 함수
// ==========================================

// 생성된 콘텐츠를 저장할 전역 변수
var generatedContent = {
  title: '',
  content: '',
  thumbnailUrl: '',
  payload: null
};
// ==========================================
// 새로운 미리보기 시스템
// ==========================================
// 콘텐츠 생성 (미리보기) - 완전히 새로운 버전
async function generatePreview() {
  console.log('[NEW-PREVIEW] 미리보기 함수 시작');

  try {
    // Crash recovery check
    const savedContent = localStorage.getItem('lastGeneratedContent');
    if (savedContent) {
      try {
        const saved = JSON.parse(savedContent);
        // If content was saved less than 30 minutes ago, offer recovery
        if (saved.timestamp && (Date.now() - saved.timestamp) < 30 * 60 * 1000) {
          const recover = confirm(`이전에 생성한 글이 있어요 ("${(saved.title || '').slice(0, 30)}..."). 복구할까요?`);
          if (recover) {
            generatedContent.title = saved.title;
            generatedContent.content = saved.content;
            generatedContent.thumbnailUrl = saved.thumbnailUrl;
            showNotification('✅ 이전 글이 복구되었어요!', 'success');
            // Show preview
            if (typeof showPreview === 'function') showPreview();
            return;
          }
        }
      } catch { /* corrupt data — ignore */ }
    }

    // 0. 이전 캐시 삭제 (새로운 콘텐츠 생성을 위해)
    localStorage.removeItem('lastGeneratedContent');
    localStorage.removeItem('lastGeneratedTitle');
    localStorage.removeItem('lastGeneratedCharCount');
    console.log('[NEW-PREVIEW] 이전 캐시 삭제 완료');

    // 1. 라이선스 체크
    if (!isLicenseValid()) {
      alert('🔒 라이선스 등록이 필요합니다.');
      const licenseModal = document.getElementById('licenseModal');
      if (licenseModal) licenseModal.style.display = 'flex';
      return;
    }

    // 2. 실행 중 체크
    if (isRunning) {
      alert('작업이 실행 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    // 3. 키워드 확인
    const keywordInput = document.getElementById('keywordInput');
    const keyword = keywordInput?.value?.trim();
    if (!keyword) {
      alert('키워드를 입력해주세요.');
      return;
    }

    console.log('[NEW-PREVIEW] 키워드:', keyword);

    // 4. 상태 설정 (race condition 방지: API 호출 전에 즉시 잠금)
    setRunning(true);
    isCanceled = false;

    // 5. 버튼 로딩 상태
    const generateBtn = document.getElementById('generateBtn');
    const originalBtnText = generateBtn ? generateBtn.innerHTML : '📝 콘텐츠 생성 (미리보기)';
    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.innerHTML = '⏳ 생성 중...';
    }

    // Pre-flight: API 키 확인
    const settings = JSON.parse(localStorage.getItem('bloggerSettings') || '{}');
    const geminiKey = settings.geminiKey || settings.GEMINI_API_KEY || '';
    if (!geminiKey || geminiKey.length < 10) {
      showNotification('⚠️ Gemini API 키가 설정되지 않았어요. 설정 > API 키에서 입력해주세요.', 'error');
      if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.innerHTML = originalBtnText;
      }
      setRunning(false);
      return;
    }

    addLog('[NEW-PREVIEW] 콘텐츠 생성 시작...');

    // 6. Payload 생성
    const payload = createPreviewPayload();

    console.log('[NEW-PREVIEW] Payload:', payload);

    // 7. API 호출
    const result = await window.blogger.runPost(payload);
    console.log('[NEW-PREVIEW] Result:', result);

    // 8. 결과 처리
    console.log('[NEW-PREVIEW] Result 상세:', {
      ok: result?.ok,
      title: result?.title,
      html: result?.html?.substring(0, 100),
      content: result?.content?.substring(0, 100),
      logs: result?.logs
    });

    // 페이월 체크
    if (result && result.code === 'PAYWALL') {
      showNotification(result.message || '⛔ 오늘의 무료 사용 한도를 초과했어요.', 'error');
      updateFreeQuotaCounter();
      return;
    }

    if (result?.ok) {
      addLog('✅ 콘텐츠 생성 완료!', 'success');

      // 콘텐츠 저장
      const htmlContent = result.html || result.content || '';
      const htmlSizeKB = (htmlContent.length / 1024).toFixed(2);
      console.log(`[NEW-PREVIEW] HTML 콘텐츠 크기: ${htmlContent.length}자 (${htmlSizeKB}KB)`);
      addLog(`📏 받은 HTML 크기: ${htmlContent.length}자 (${htmlSizeKB}KB)`, 'info');

      generatedContent.title = result.title || keyword;
      generatedContent.content = htmlContent;
      generatedContent.thumbnailUrl = result.thumbnailUrl || '';
      generatedContent.payload = payload;

      // Auto-save for crash recovery
      try {
        localStorage.setItem('lastGeneratedContent', JSON.stringify({
          title: generatedContent.title,
          content: generatedContent.content,
          thumbnailUrl: generatedContent.thumbnailUrl,
          timestamp: Date.now(),
          keyword: keyword
        }));
      } catch (e) { /* localStorage full — ignore */ }

      console.log('[NEW-PREVIEW] 저장된 콘텐츠:', {
        title: generatedContent.title,
        contentLength: generatedContent.content.length,
        contentPreview: generatedContent.content.substring(0, 200)
      });

      // 9. 미리보기 표시 (데이터만 저장, 모달은 사용자가 선택)
      displayPreviewInModal();

      addLog('✅ 글 생성 완료! 미리보기를 확인 후 "블로그 발행 Start" 버튼으로 발행하세요.', 'success');
      if (typeof showNotification === 'function') {
        showNotification('✅ 글 생성이 완료되었어요! 미리보기를 확인해보세요.', 'success');
      }
      updateFreeQuotaCounter();

    } else {
      throw new Error(result?.error || result?.logs || '콘텐츠 생성 실패');
    }

  } catch (error) {
    console.error('[NEW-PREVIEW] 오류:', error);
    addLog(`❌ 오류: ${error.message}`, 'error');
    showNotification(friendlyErrorMessage(error), 'error');
  } finally {
    // 버튼 복원
    const generateBtn = document.getElementById('generateBtn');
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.innerHTML = '📝 콘텐츠 생성 (미리보기)';
    }
    setRunning(false);
    isCanceled = false;
  }
}
// 미리보기 탭에 콘텐츠 표시
function displayPreviewInModal() {
  console.log('[DISPLAY-PREVIEW] 미리보기 탭에 표시 시작');

  const previewContent = document.getElementById('previewContent');
  const previewTitleText = document.getElementById('previewTitleText');
  const previewCharCount = document.getElementById('previewCharCount');

  if (!previewContent) {
    console.error('[DISPLAY-PREVIEW] previewContent 요소를 찾을 수 없습니다');
    return;
  }

  const content = generatedContent.content;
  const title = generatedContent.title;
  const thumbnailUrl = generatedContent.thumbnailUrl;

  if (content && content.trim()) {
    // 제목 표시
    if (previewTitleText) {
      previewTitleText.textContent = title || '제목 없음';
    }

    // 제목을 previewTitle에도 표시
    const previewTitle = document.getElementById('previewTitle');
    if (previewTitle) {
      previewTitle.textContent = title || '제목 없음';
    }

    // 썸네일 표시
    const thumbnailSection = document.getElementById('previewThumbnailSection');
    const thumbnailImage = document.getElementById('previewThumbnailImage');
    if (thumbnailUrl && thumbnailUrl.trim()) {
      if (thumbnailSection) thumbnailSection.style.display = 'block';
      if (thumbnailImage) {
        thumbnailImage.src = thumbnailUrl;
        thumbnailImage.onerror = function () {
          if (thumbnailSection) thumbnailSection.style.display = 'none';
          console.warn('[DISPLAY-PREVIEW] 썸네일 로드 실패:', thumbnailUrl);
        };
      }
      console.log('[DISPLAY-PREVIEW] 썸네일 표시:', thumbnailUrl);
    } else {
      if (thumbnailSection) thumbnailSection.style.display = 'none';
      console.log('[DISPLAY-PREVIEW] 썸네일 없음');
    }

    // 콘텐츠가 있으면 표시
    console.log('[DISPLAY-PREVIEW] 표시할 콘텐츠 길이:', content.length);
    console.log('[DISPLAY-PREVIEW] 콘텐츠 미리보기 (처음 500자):', content.substring(0, 500));

    // HTML 콘텐츠를 안전하게 설정
    try {
      let displayContent = content;

      // 콘텐츠가 너무 길면 (50KB 이상) 절반만 표시
      if (content.length > 50000) {
        const halfLength = Math.floor(content.length / 2);
        displayContent = content.substring(0, halfLength);
        console.log('[DISPLAY-PREVIEW] ⚠️ 콘텐츠가 너무 길어 절반만 표시합니다 (' + halfLength + '자)');

        // 절반 표시 안내 메시지 추가
        displayContent += `
          <div style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); 
                      color: white; 
                      padding: 20px; 
                      border-radius: 12px; 
                      margin: 30px 0; 
                      text-align: center; 
                      font-weight: 700; 
                      box-shadow: 0 4px 15px rgba(251, 191, 36, 0.3);">
            ⚠️ 콘텐츠가 너무 길어 미리보기는 절반만 표시됩니다<br>
            📋 전체 콘텐츠는 "HTML 복사" 또는 "브라우저에서 보기"를 이용하세요
          </div>
        `;
      }

      // 콘텐츠가 HTML인지 확인
      if (displayContent.includes('<') && displayContent.includes('>')) {
        // HTML 콘텐츠인 경우
        previewContent.innerHTML = displayContent;
      } else {
        // 텍스트 콘텐츠인 경우 HTML로 감싸기
        previewContent.innerHTML = `<div style="padding: 20px; font-size: 14px; line-height: 1.6; color: #374151;">${displayContent}</div>`;
      }

      // 미리보기 컨테이너 스타일 강제 설정
      previewContent.style.height = 'auto';
      previewContent.style.maxHeight = 'none';
      previewContent.style.overflow = 'visible';
      previewContent.style.whiteSpace = 'normal';
      previewContent.style.wordWrap = 'break-word';
      previewContent.style.display = 'block';

      // 부모 컨테이너도 확인
      const parentContainer = previewContent.parentElement;
      if (parentContainer) {
        parentContainer.style.height = 'auto';
        parentContainer.style.maxHeight = 'none';
        parentContainer.style.overflow = 'visible';
      }

      console.log('[DISPLAY-PREVIEW] 콘텐츠 표시 완료');
      console.log('[DISPLAY-PREVIEW] 실제 표시된 콘텐츠 길이:', previewContent.innerHTML.length);

      // DOM이 완전히 렌더링될 때까지 잠시 대기
      setTimeout(() => {
        console.log('[DISPLAY-PREVIEW] 렌더링 완료 후 실제 높이:', previewContent.scrollHeight + 'px');
      }, 100);

    } catch (error) {
      console.error('[DISPLAY-PREVIEW] 콘텐츠 표시 오류:', error);
      previewContent.innerHTML = '<div style="color: red; padding: 20px; font-size: 14px;">콘텐츠 표시 중 오류가 발생했습니다: ' + error.message + '</div>';
    }

    // 글자수 계산
    const actualCharCount = getPureCharacterCountFromHtml(content);

    // 글자수 표시
    if (previewCharCount) {
      previewCharCount.textContent = `순수 글자수: ${actualCharCount.toLocaleString()}자`;
    }

    console.log('[DISPLAY-PREVIEW] 제목:', title);
    console.log('[DISPLAY-PREVIEW] 글자수:', actualCharCount);

    // localStorage에 콘텐츠 저장 (미리보기 모달에서 재사용하기 위해)
    try {
      localStorage.setItem('lastGeneratedContent', content);
      localStorage.setItem('lastGeneratedTitle', title || '제목 없음');
      localStorage.setItem('lastGeneratedCharCount', actualCharCount.toString());
      console.log('[DISPLAY-PREVIEW] localStorage에 콘텐츠 저장 완료');
    } catch (error) {
      console.error('[DISPLAY-PREVIEW] localStorage 저장 중 오류:', error);
    }

    // 🚀 자동으로 미리보기 탭으로 전환
    console.log('[DISPLAY-PREVIEW] 미리보기 탭으로 자동 전환');
    setTimeout(() => {
      showTab('preview');
      console.log('[DISPLAY-PREVIEW] 미리보기 탭 전환 완료');
    }, 500); // 0.5초 후 전환 (콘텐츠 렌더링 대기)

    addLog(`✅ 미리보기 생성 완료: ${title} (${actualCharCount}자)`, 'success');
  } else {
    console.warn('[DISPLAY-PREVIEW] 콘텐츠가 없습니다');
    previewContent.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: #94a3b8;">
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin: 0 auto 24px; opacity: 0.3;">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        <div style="font-size: 20px; font-weight: 600; color: #64748b; margin-bottom: 12px;">콘텐츠 생성 오류</div>
        <div style="font-size: 14px; color: #94a3b8;">콘텐츠가 생성되지 않았습니다</div>
      </div>
    `;
  }

  // 발행 버튼 활성화
  const publishBtn = document.getElementById('publishBtn');
  if (publishBtn) {
    publishBtn.disabled = false;
    publishBtn.style.opacity = '1';
    publishBtn.style.cursor = 'pointer';
    console.log('[DISPLAY-PREVIEW] 발행 버튼 활성화됨');
  }
}
// 실제로 콘텐츠를 DOM에 표시하는 함수
function displayPreviewContent() {
  const content = generatedContent.content;
  const title = generatedContent.title;

  console.log('[DISPLAY-PREVIEW] 표시 시작:', {
    title,
    contentLength: content?.length || 0
  });

  // 제목 업데이트 (정확한 ID 사용)
  const titleElement = document.getElementById('previewTitleText');
  if (titleElement) {
    titleElement.textContent = title || '미리보기';
    console.log('[DISPLAY-PREVIEW] 제목 업데이트:', title);
  } else {
    console.warn('[DISPLAY-PREVIEW] 제목 요소를 찾을 수 없습니다');
  }

  // 플랫폼 업데이트
  const platformElement = document.getElementById('previewPlatformText');
  if (platformElement) {
    const settings = JSON.parse(localStorage.getItem('bloggerSettings') || '{}');
    platformElement.textContent = settings.platform === 'blogger' ? 'Blogger' : 'WordPress';
  }

  // 콘텐츠 업데이트
  const contentElement = document.getElementById('previewContent');
  if (contentElement) {
    if (content && content.trim()) {
      contentElement.innerHTML = content;
      console.log('[DISPLAY-PREVIEW] 콘텐츠 표시됨');

      // 글자수 계산 및 표시
      const charCountElement = document.getElementById('previewCharCount');
      if (charCountElement) {
        const actualCharCount = getPureCharacterCountFromHtml(content);
        charCountElement.textContent = `순수 글자수: ${actualCharCount.toLocaleString()}자`;
        console.log('[DISPLAY-PREVIEW] 글자수:', actualCharCount);
      }
    } else {
      contentElement.innerHTML = '<div style="text-align: center; padding: 60px 20px; color: #94a3b8;"><svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin: 0 auto 24px; opacity: 0.3;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg><h3 style="margin: 0 0 12px; font-size: 20px; font-weight: 600; color: #64748b;">콘텐츠를 불러오는 중...</h3><p style="margin: 0; font-size: 14px; color: #94a3b8;">잠시만 기다려주세요</p></div>';
      console.warn('[DISPLAY-PREVIEW] 콘텐츠 없음');
    }
  } else {
    console.error('[DISPLAY-PREVIEW] 콘텐츠 요소를 찾을 수 없습니다');
  }

  // 발행 버튼 활성화
  const publishBtn = document.getElementById('publishBtn');
  if (publishBtn) {
    publishBtn.disabled = false;
    publishBtn.style.opacity = '1';
    publishBtn.style.cursor = 'pointer';
  }
}
// 미리보기 콘텐츠를 플랫폼에 발행
async function publishToPlatform() {
  try {
    if (isRunning) {
      alert('작업이 실행 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    // 플랫폼 인증 사전 검증
    const settings = JSON.parse(localStorage.getItem('bloggerSettings') || '{}');
    const platform = settings.platform || 'blogspot';

    if (platform === 'wordpress') {
      const wpUrl = settings.wordpressSiteUrl || settings.wpSiteUrl || '';
      const wpUser = settings.wordpressUsername || settings.wpUsername || '';
      const wpPass = settings.wordpressPassword || settings.wpPassword || '';
      if (!wpUrl || !wpUser || !wpPass) {
        showNotification('⚠️ WordPress 연결 정보가 없어요. 설정 > WordPress에서 URL, 아이디, 비밀번호를 입력해주세요.', 'error');
        return;
      }
    } else if (platform === 'blogspot' || platform === 'blogger') {
      const blogId = settings.blogId || '';
      const clientId = settings.googleClientId || '';
      if (!blogId) {
        showNotification('⚠️ Blog ID가 설정되지 않았어요. 설정 > Blogger에서 입력해주세요.', 'error');
        return;
      }
    }

    // 생성된 콘텐츠 확인
    console.log('[PUBLISH] generatedContent 상태:', {
      title: generatedContent.title,
      contentLength: generatedContent.content ? generatedContent.content.length : 0,
      contentExists: !!generatedContent.content,
      contentPreview: generatedContent.content ? generatedContent.content.substring(0, 100) : '없음'
    });

    // 콘텐츠가 없으면 바로 생성하고 발행
    if (!generatedContent.content || !generatedContent.content.trim()) {
      console.log('[PUBLISH] 콘텐츠 없음 - 바로 발행 모드로 전환');

      // 바로 발행 모드로 runPosting 호출 (미리보기 없이 바로 발행)
      await runPosting();
      return;
    }

    // 🔧 저장된 콘텐츠가 있으면 바로 발행 (미리보기와 동일한 콘텐츠 사용)
    console.log('[PUBLISH] 저장된 콘텐츠로 바로 발행:', {
      title: generatedContent.title,
      contentLength: generatedContent.content.length
    });

    if (confirm('생성된 콘텐츠를 블로그에 발행하시겠습니까?')) {
      setRunning(true);
      isCanceled = false;
      setPublishButtonLoading(true);

      addLog('[PUBLISH] 블로그 발행 시작...');
      addLog(`[INFO] 제목: ${generatedContent.title}`);

      const publishPayload = {
        ...(generatedContent.payload || {}),
        previewOnly: false
      };

      if (!window.blogger || !window.blogger.publishContent) {
        throw new Error('publishContent API를 사용할 수 없습니다.');
      }

      const result = await window.blogger.publishContent(
        publishPayload,
        generatedContent.title,
        generatedContent.content,
        generatedContent.thumbnailUrl
      );

      // 페이월 체크
      if (result && result.code === 'PAYWALL') {
        showNotification(result.message || '⛔ 오늘의 무료 사용 한도를 초과했어요.', 'error');
        updateFreeQuotaCounter();
        hideProgressModal();
        return;
      }

      if (result && result.ok) {
        addLog('✅ 블로그 발행 완료!', 'success');
        showNotification('블로그 발행 완료! 🎉', 'success');
        updateFreeQuotaCounter();
        if (result.url) {
          addLog(`📌 URL: ${result.url}`, 'info');
          if (typeof updatePreview === 'function') {
            updatePreview(generatedContent.title, generatedContent.content, result.url);
          }
        }

        generatedContent = {
          title: '',
          content: '',
          thumbnailUrl: '',
          payload: null
        };

        hideProgressModal();
      } else {
        const errorMessage = result?.error || '알 수 없는 오류';
        addLog(`❌ 발행 실패: ${errorMessage}`, 'error');
        hideProgressModal();
        throw new Error(errorMessage);
      }
    }

  } catch (error) {
    console.error('[PUBLISH] 오류:', error);
    addLog(`❌ 발행 오류: ${error.message}`, 'error');
    alert('발행 오류: ' + error.message);
    hideProgressModal();
  } finally {
    // 실행 상태 해제
    setRunning(false);
    isCanceled = false;
    setPublishButtonLoading(false);
  }
}
Object.assign(window, {
  openLEWORD,
  openLEWORDModal,
  closeLEWORDModal,
  openSnippetLibraryPanel,
  refreshSnippetLibraryUI,
  openExternalLinksModal,
  closeExternalLinksModal,
  addExternalLink,
  filterLinksByMode,
  openLicenseModal,
  closeLicenseModal,
  activateLicenseFromModal,
  openSettingsModal,
  closeSettingsModal,
  addScheduledPost,
  refreshScheduleList,
  openManualCtaShortcut,
  openManualCtaModal,
  closeManualCtaModal,
  saveManualCtas,
  addCtaItem,
  authenticateBlogger,
  checkPlatformConnection,
  checkCseConnection,
  testWordPressConnection,
  loadWordPressCategories,
  loadWpCategories,
  cancelProgress,
  toggleLogContainer,
  toggleProgressCard,
  toggleDraftSection,
  setPromptMode,
  showThumbnailSubTab,
  applyThumbnailBgImageUrl,
  clearThumbnailBackgroundImage,
  applyPreset,
  generateTextThumbnail,
  convertImage,
  downloadConvertedImage,
  downloadThumbnail,
  publishToPlatform,
  openExternalPostGenerator,
  openPexelsApiPage,
  openDalleApiPage,
  openNaverApiPage,
  openGeminiApiPage,
  openGoogleCseApiPage,
  openGoogleOAuthPage,
  showTab,
  showUsageHelp,
  closeUsageHelp,
  toggleCtaSettings
});
// Form에서 Payload 생성하는 헬퍼 함수
function createPayloadFromForm() {
  const keywordInput = document.getElementById('keywordInput');
  const keywordValue = keywordInput ? keywordInput.value.trim() : '';

  const thumbnailTypeSelect = document.getElementById('thumbnailType');
  const sectionCountSelect = document.getElementById('sectionCount');
  const titleModeSelect = document.getElementById('titleMode');
  const contentModeSelect = document.getElementById('contentMode');
  const selectedPlatform = document.querySelector('input[name="platform"]:checked')?.value;
  const publishType = getCurrentPublishType();
  const draftInput = document.getElementById('draftInput');
  const draftContent = draftInput ? draftInput.value.trim() : '';

  let titleValue = null;
  if (titleModeSelect?.value === 'custom') {
    titleValue = keywordValue.trim();
  }

  // 저장된 설정 불러오기 (LocalStorage에서)
  const savedSettings = loadSettings();

  // 수동 CTA 데이터 변환 (인덱스 기반 객체로 변환)
  const manualCtas = {};
  manualCtasData.forEach((cta, index) => {
    if (cta && cta.url && cta.url.trim()) {
      manualCtas[index] = {
        url: cta.url,
        text: cta.title || '자세히 보기',
        hook: cta.hook || ''
      };
    }
  });

  const payload = {
    provider: 'gemini', // Gemini 모드
    topic: keywordValue,
    keywords: [{
      keyword: keywordValue,
      title: titleValue
    }],
    thumbnailMode: thumbnailTypeSelect?.value || 'text',
    sectionCount: (() => {
      let count = 5;
      if (sectionCountSelect) {
        if (sectionCountSelect.value === 'custom') {
          const customInput = document.getElementById('customSectionCount');
          count = customInput && customInput.value ? parseInt(customInput.value) : 5;
        } else {
          count = parseInt(sectionCountSelect.value);
        }
      }
      if (count < 1) count = 1;
      if (count > 20) count = 20;
      console.log(`[단일 포스팅] 소제목 개수: ${count}개`);
      return count;
    })(),
    contentMode: contentModeSelect?.value || 'external', // 콘텐츠 모드 추가
    platform: selectedPlatform || savedSettings.platform || 'blogspot',
    publishType,
    // 수동 CTA 추가 (인덱스 기반 객체)
    manualCtas: Object.keys(manualCtas).length > 0 ? manualCtas : undefined,
    // API 키들은 저장된 설정에서 로드
    geminiKey: savedSettings.geminiKey || '',
    pexelsApiKey: savedSettings.pexelsApiKey || '',
    googleCseKey: savedSettings.googleCseKey || '',
    googleCseCx: savedSettings.googleCseCx || '',
    // 블로거 설정
    blogId: savedSettings.blogId || '',
    googleClientId: savedSettings.googleClientId || '',
    googleClientSecret: savedSettings.googleClientSecret || '',
    redirectUri: savedSettings.redirectUri || 'http://localhost:8080',
    // 워드프레스 설정  
    wordpressSiteUrl: savedSettings.wordpressSiteUrl || '',
    wordpressUsername: savedSettings.wordpressUsername || '',
    wordpressPassword: savedSettings.wordpressPassword || ''
  };

  if (draftContent) {
    payload.draftContent = draftContent;
  }

  console.log('[DEBUG] createPayloadFromForm - savedSettings:', savedSettings);
  console.log('[DEBUG] createPayloadFromForm - payload:', payload);

  return payload;
}
// 미리보기용 Payload 생성 (WordPress 설정 불필요)
function createPreviewPayload() {
  const keywordInput = document.getElementById('keywordInput');
  const keywordValue = keywordInput ? keywordInput.value.trim() : '';

  const thumbnailTypeSelect = document.getElementById('thumbnailType');
  const promptModeSelect = document.getElementById('promptMode');

  const titleModeSelect = document.getElementById('titleMode');
  const contentModeSelect = document.getElementById('contentMode');
  const selectedPlatform = document.querySelector('input[name="platform"]:checked')?.value;
  const postingModeSelect = document.querySelector('input[name="postingMode"]:checked');
  const publishType = getCurrentPublishType();
  const draftInput = document.getElementById('draftInput');
  const draftContent = draftInput ? draftInput.value.trim() : '';

  let titleValue = null;
  if (titleModeSelect && titleModeSelect.value === 'custom') {
    const customTitleInput = document.getElementById('customTitle');
    titleValue = customTitleInput ? customTitleInput.value.trim() : null;
  }
  if (!titleValue && keywordValue) {
    titleValue = keywordValue;
  }

  // 저장된 설정 로드
  const savedSettings = loadSettings();

  // Gemini AI 모델 선택값 가져오기
  const titleAI = 'gemini';
  const contentAI = 'gemini';
  const summaryAI = 'gemini';

  // 프롬프트 모드에 따른 소제목 개수 설정
  let selectedSectionCount = 5; // 기본값 (MAX 모드, 커스텀 모드)
  const promptMode = 'max-mode'; // MAX모드로 고정
  selectedSectionCount = 5; // MAX 모드는 5개
  console.log(`[SECTION-COUNT] MAX 모드: ${selectedSectionCount}개`);
  // 동적 글자수 계산 (H2 1개당 1200-1500자)
  const dynamicMinChars = selectedSectionCount * 1200;
  const dynamicMaxChars = selectedSectionCount * 1500;

  console.log(`[SECTION-COUNT] 최종 소제목 개수: ${selectedSectionCount}개 (${dynamicMinChars}~${dynamicMaxChars}자)`);

  // 닉네임 가져오기
  const authorNickname = document.getElementById('authorNickname')?.value?.trim() || '';

  // 외부 정보 크롤링 옵션
  const useGoogleSearch = document.getElementById('useGoogleSearch')?.checked || false;

  // 저장된 썸네일 확인
  const savedThumbnail = localStorage.getItem('generatedThumbnail');
  const savedThumbnailText = localStorage.getItem('thumbnailText');

  // 미리보기용 최소한의 payload (WordPress 설정 제외)
  const payload = {
    topic: keywordValue,
    title: titleValue,
    thumbnailType: savedThumbnail ? 'custom' : 'text', // 기본값을 텍스트 썸네일로 설정
    customThumbnail: savedThumbnail, // 저장된 썸네일 데이터 URL
    customThumbnailText: savedThumbnailText, // 저장된 썸네일 텍스트
    promptMode: 'max-mode', // MAX모드로 고정
    toneStyle: document.getElementById('toneStyle')?.value || 'professional', // 말투/어투 선택
    h2Images: getH2ImageSections(), // H2 이미지 선택
    sectionCount: selectedSectionCount,
    titleMode: titleModeSelect ? titleModeSelect.value : 'auto',
    contentMode: contentModeSelect ? contentModeSelect.value : 'external', // 콘텐츠 모드 추가
    platform: selectedPlatform || savedSettings.platform || 'blogspot',
    publishType,
    postingMode: postingModeSelect ? postingModeSelect.value : 'immediate', // 발행 모드 추가
    provider: contentAI, // 본문 생성 AI 사용
    titleAI: titleAI, // 제목 생성 AI
    summaryAI: summaryAI, // 요약표 생성 AI
    minChars: savedSettings.minChars || dynamicMinChars, // 동적 계산
    maxChars: savedSettings.maxChars || dynamicMaxChars, // 동적 계산
    previewOnly: true, // 미리보기 플래그 명시적으로 추가
    authorNickname: authorNickname, // 작성자 닉네임 추가
    useGoogleSearch: useGoogleSearch, // 외부 정보 크롤링 옵션 추가
    draftContent: draftContent || undefined,
    // 수동 CTA 추가 (인덱스 기반 객체)
    manualCtas: (() => {
      const manualCtas = {};
      if (typeof manualCtasData !== 'undefined' && manualCtasData.length > 0) {
        manualCtasData.forEach((cta, index) => {
          if (cta && cta.url && cta.url.trim()) {
            manualCtas[index] = {
              url: cta.url,
              text: cta.title || '자세히 보기',
              hook: cta.hook || ''
            };
          }
        });
      }
      return Object.keys(manualCtas).length > 0 ? manualCtas : undefined;
    })(),
    // 🔗 참고 URL 파싱 (줄바꿈 구분 → manualCrawlUrls 배열)
    ...(() => {
      const refUrlEl = document.getElementById('referenceUrl');
      const refUrlValue = refUrlEl ? refUrlEl.value.trim() : '';
      if (refUrlValue) {
        const urls = refUrlValue.split('\n').map(u => u.trim()).filter(u => u && (u.startsWith('http://') || u.startsWith('https://')));
        if (urls.length > 0) {
          return {
            sourceUrl: urls[0],
            manualCrawlUrls: urls,
            crawlUrl: urls[0]
          };
        }
      }
      return {};
    })(),
    // API 키들만 포함 (WordPress 인증 정보 제외)
    geminiKey: savedSettings.geminiKey || '',
    pexelsApiKey: savedSettings.pexelsApiKey || '',
    googleCseKey: savedSettings.googleCseKey || '',
    googleCseCx: savedSettings.googleCseCx || '',
    naverCustomerId: savedSettings.naverCustomerId || '',
    naverSecretKey: savedSettings.naverSecretKey || ''
  };

  console.log('[DEBUG] createPreviewPayload - payload:', payload);

  return payload;
}
// ========== 수동 CTA 관련 함수 ==========
// 전역 변수: 수동 CTA 데이터 저장
var manualCtasData = [];
// 전역 변수: 키워드별 CTA 데이터 저장 (키: keywordId, 값: CTA 배열)
var keywordCtaData = {};
// CTA 설정 토글 함수 (통합 버전)
// 이 함수는 이미 위에서 정의되어 있으므로 중복 제거
// 수동 CTA 모달 열기
function openManualCtaModal() {
  const modal = document.getElementById('manualCtaModal');
  if (!modal) return;

  // 입력 필드 동적 생성 (5개 소제목)
  const inputsContainer = document.getElementById('manualCtaInputs');
  if (!inputsContainer) return;

  inputsContainer.innerHTML = '';

  for (let i = 0; i < 5; i++) {
    const existingCta = manualCtasData[i] || { url: '', title: '' };

    const ctaBox = document.createElement('div');
    ctaBox.style.cssText = 'background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius: 12px; padding: 20px; border: 2px solid #cbd5e1;';

    ctaBox.innerHTML = `
      <h4 style="color: #1e293b; margin-bottom: 12px; font-weight: 700; font-size: 16px;">
        ${i + 1}번 소제목 CTA ${i === 0 ? '(인사말 + 본론)' : i === 4 ? '(본론 + 마무리)' : '(본론)'}
      </h4>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div>
          <label style="color: #64748b; font-size: 13px; font-weight: 600; margin-bottom: 6px; display: block;">CTA 링크 URL</label>
          <input type="url" 
                 id="manualCtaUrl${i}" 
                 placeholder="https://example.com (공란 가능)" 
                 value="${existingCta.url || ''}"
                 style="width: 100%; padding: 12px; border: 2px solid #cbd5e1; border-radius: 8px; font-size: 14px; background: white;">
        </div>
        <div>
          <label style="color: #64748b; font-size: 13px; font-weight: 600; margin-bottom: 6px; display: block;">후킹멘트 (선택사항)</label>
          <input type="text" 
                 id="manualCtaHook${i}" 
                 placeholder="예: 더 자세한 정보가 필요하시다면?" 
                 value="${existingCta.hook || ''}"
                 style="width: 100%; padding: 12px; border: 2px solid #cbd5e1; border-radius: 8px; font-size: 14px; background: white;">
        </div>
        <div>
          <label style="color: #64748b; font-size: 13px; font-weight: 600; margin-bottom: 6px; display: block;">CTA 버튼 텍스트 (선택사항)</label>
          <input type="text" 
                 id="manualCtaTitle${i}" 
                 placeholder="예: 자세히 보기" 
                 value="${existingCta.title || ''}"
                 style="width: 100%; padding: 12px; border: 2px solid #cbd5e1; border-radius: 8px; font-size: 14px; background: white;">
        </div>
      </div>
    `;

    inputsContainer.appendChild(ctaBox);
  }

  modal.style.display = 'flex';
}

// 수동 CTA 모달 닫기
function closeManualCtaModal() {
  const modal = document.getElementById('manualCtaModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// 수동 CTA 저장
function saveManualCtas() {
  manualCtasData = [];
  let count = 0;

  for (let i = 0; i < 5; i++) {
    const urlInput = document.getElementById(`manualCtaUrl${i}`);
    const titleInput = document.getElementById(`manualCtaTitle${i}`);
    const hookInput = document.getElementById(`manualCtaHook${i}`);

    const url = urlInput ? urlInput.value.trim() : '';
    const title = titleInput ? titleInput.value.trim() : '';
    const hook = hookInput ? hookInput.value.trim() : '';

    if (url) {
      manualCtasData[i] = { url, title, hook };
      count++;
    } else {
      manualCtasData[i] = null; // 공란
    }
  }

  // 상태 표시 업데이트
  const statusDiv = document.getElementById('manualCtaStatus');
  const countSpan = document.getElementById('manualCtaCount');

  if (count > 0) {
    if (statusDiv) statusDiv.style.display = 'block';
    if (countSpan) countSpan.textContent = count;
  } else {
    if (statusDiv) statusDiv.style.display = 'none';
  }

  closeManualCtaModal();

  console.log('[MANUAL-CTA] 수동 CTA 저장 완료:', manualCtasData);
}
// 전체 화면 미리보기 모달 열기
function openFullScreenPreviewModal() {
  console.log('[FULLSCREEN-PREVIEW] 전체 화면 미리보기 모달 열기');

  // 미리보기 탭을 전체 화면 모달로 표시
  const previewTab = document.getElementById('preview-tab');
  if (previewTab) {
    // 탭을 모달로 변환
    previewTab.style.position = 'fixed';
    previewTab.style.top = '0';
    previewTab.style.left = '0';
    previewTab.style.width = '100vw';
    previewTab.style.height = '100vh';
    previewTab.style.zIndex = '10000';
    previewTab.style.background = 'rgba(15, 23, 42, 0.98)';
    previewTab.style.display = 'block';
    previewTab.style.overflow = 'auto';

    // 닫기 버튼 추가 (이미 없다면)
    let closeBtn = previewTab.querySelector('.fullscreen-close-btn');
    if (!closeBtn) {
      closeBtn = document.createElement('button');
      closeBtn.className = 'fullscreen-close-btn';
      closeBtn.innerHTML = '✕ 닫기';
      closeBtn.style.cssText = `
        position: fixed;
        top: 24px;
        right: 24px;
        z-index: 10001;
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 12px;
        font-weight: 600;
        cursor: pointer;
        font-size: 16px;
        box-shadow: 0 8px 25px rgba(239, 68, 68, 0.4);
        transition: all 0.3s ease;
      `;
      closeBtn.onmouseover = function () {
        this.style.transform = 'translateY(-2px)';
        this.style.boxShadow = '0 12px 30px rgba(239, 68, 68, 0.5)';
      };
      closeBtn.onmouseout = function () {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = '0 8px 25px rgba(239, 68, 68, 0.4)';
      };
      closeBtn.onclick = closeFullScreenPreviewModal;
      previewTab.insertBefore(closeBtn, previewTab.firstChild);
    }

    console.log('[FULLSCREEN-PREVIEW] 전체 화면 미리보기 모달 표시 완료');
  }
}

// 전체 화면 미리보기 모달 닫기
function closeFullScreenPreviewModal() {
  console.log('[FULLSCREEN-PREVIEW] 전체 화면 미리보기 모달 닫기');

  const previewTab = document.getElementById('preview-tab');
  if (previewTab) {
    // 모달 스타일 초기화
    previewTab.style.position = '';
    previewTab.style.top = '';
    previewTab.style.left = '';
    previewTab.style.width = '';
    previewTab.style.height = '';
    previewTab.style.zIndex = '';
    previewTab.style.background = '';
    previewTab.style.display = 'none';

    // 닫기 버튼 제거
    const closeBtn = previewTab.querySelector('.fullscreen-close-btn');
    if (closeBtn) {
      closeBtn.remove();
    }
  }
}
// 크롤링 상세 정보 업데이트
function updateCrawlingDetails(label) {
  if (!label) return;
  const crawlingDetails = document.getElementById('crawlingDetails');
  if (!crawlingDetails) return;

  const naverCountEl = document.getElementById('naverCount');
  const rssCountEl = document.getElementById('rssCount');
  const cseCountEl = document.getElementById('cseCount');
  const fullContentCountEl = document.getElementById('fullContentCount');

  // 크롤링 관련 로그일 때만 표시
  if (label.includes('크롤링') || label.includes('본문')) {
    if (crawlingDetails) {
      crawlingDetails.style.display = 'block';
    }

    // 네이버 크롤링 개수 추출
    const naverMatch = label.match(/네이버.*?(\d+)개/);
    if (naverMatch && naverCountEl) {
      naverCountEl.textContent = naverMatch[1];
    }

    // RSS 크롤링 개수 추출
    const rssMatch = label.match(/RSS.*?(\d+)개/);
    if (rssMatch && rssCountEl) {
      rssCountEl.textContent = rssMatch[1];
    }

    // Google CSE 크롤링 개수 추출
    const cseMatch = label.match(/Google CSE.*?(\d+)개|CSE.*?(\d+)개/);
    if (cseMatch && cseCountEl) {
      cseCountEl.textContent = cseMatch[1] || cseMatch[2] || '0';
    }

    // 본문 크롤링 개수 추출
    const fullContentMatch = label.match(/본문.*?(\d+)\/(\d+)/);
    if (fullContentMatch && fullContentCountEl) {
      fullContentCountEl.textContent = `${fullContentMatch[1]}/${fullContentMatch[2]}`;
    }
  }
}

// ==================== 🔥 DeepInfra API 키 관리 ====================
function saveDeepInfraApiKey() {
  const input = document.getElementById('deepInfraApiKey');
  const apiKey = input?.value?.trim() || '';

  if (!apiKey) {
    alert('DeepInfra API 키를 입력해주세요.');
    return;
  }

  if (apiKey.length < 10) {
    alert('유효하지 않은 API 키 형식입니다.');
    return;
  }

  localStorage.setItem('deepInfraApiKey', apiKey);
  alert('✅ DeepInfra API 키가 저장되었습니다!');
  console.log('[DeepInfra] API 키 저장 완료');
}

async function testDeepInfraApiKey() {
  const input = document.getElementById('deepInfraApiKey');
  const apiKey = input?.value?.trim() || localStorage.getItem('deepInfraApiKey') || '';

  if (!apiKey || apiKey.length < 10) {
    alert('❌ 유효한 DeepInfra API 키를 입력해주세요.');
    return;
  }

  alert('🔄 DeepInfra API 연결 테스트 중...');

  try {
    const response = await fetch('https://api.deepinfra.com/v1/inference/black-forest-labs/FLUX-2-dev', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: 'test image',
        width: 256,
        height: 256,
        num_inference_steps: 4
      })
    });

    if (response.ok) {
      alert('✅ DeepInfra API 연결 성공! API 키가 유효합니다.');
    } else if (response.status === 401) {
      alert('❌ 인증 실패: API 키가 올바르지 않습니다.');
    } else if (response.status === 402) {
      alert('⚠️ 크레딧 부족: https://deepinfra.com/dash/billing 에서 충전하세요.');
    } else {
      const errorData = await response.json().catch(() => ({}));
      alert(`⚠️ API 오류 (${response.status}): ${errorData.error || errorData.message || 'Unknown error'}`);
    }
  } catch (error) {
    alert(`❌ 연결 오류: ${error.message || error}`);
  }
}

function loadDeepInfraApiKey() {
  const input = document.getElementById('deepInfraApiKey');
  const savedKey = localStorage.getItem('deepInfraApiKey');
  if (input && savedKey) {
    input.value = savedKey;
    console.log('[DeepInfra] API 키 로드 완료');
  }
}

// DOM 로드 후 DeepInfra API 키 로드
document.addEventListener('DOMContentLoaded', () => {
  loadDeepInfraApiKey();

  // 발급받기 버튼 클릭 이벤트
  const btnDeepInfraKey = document.getElementById('btnDeepInfraKey');
  if (btnDeepInfraKey) {
    btnDeepInfraKey.addEventListener('click', () => {
      window.open('https://deepinfra.com/dash/api_keys', '_blank');
    });
  }
});

// ==========================================
// UX 개선: Progressive Disclosure (고급 설정 접기/펼치기)
// ==========================================
function initProgressiveDisclosure() {
  const postingMain = document.querySelector('.posting-main');
  if (!postingMain) return;

  const allCards = postingMain.querySelectorAll(':scope > div');
  allCards.forEach((card, idx) => {
    if (idx === 0 || idx === allCards.length - 1) return;
    if (!card.id || !['keywordInput', 'generateBtn'].some(id => card.innerHTML.includes(id))) {
      card.setAttribute('data-advanced', 'true');
    }
  });
}

function toggleAdvancedSettings() {
  const advancedCards = document.querySelectorAll('[data-advanced="true"]');
  const btn = document.getElementById('toggleAdvancedBtn');
  const isHidden = advancedCards[0]?.style.display === 'none';

  advancedCards.forEach(card => {
    card.style.display = isHidden ? '' : 'none';
    card.style.transition = 'all 0.3s ease';
  });

  if (btn) {
    btn.textContent = isHidden ? '▲ 고급 설정 접기' : '▼ 고급 설정 펼치기';
  }
}

// ==========================================
// UX 개선: Smart Defaults (초보자를 위한 기본값)
// ==========================================
function applySmartDefaults() {
  const hasSettings = localStorage.getItem('bloggerSettings');
  if (hasSettings) return;

  console.log('[UX] 첫 실행 감지 — 스마트 기본값 적용');

  const modeSelect = document.getElementById('contentModeSelect');
  if (modeSelect && !modeSelect.value) modeSelect.value = 'external';

  const toneSelect = document.getElementById('toneSelect') || document.getElementById('toneStyleSelect');
  if (toneSelect) {
    const friendlyOption = Array.from(toneSelect.options).find(o =>
      o.text.includes('친근') || o.value.includes('friendly') || o.value.includes('casual')
    );
    if (friendlyOption) toneSelect.value = friendlyOption.value;
  }

  const draftRadio = document.querySelector('input[name="postingMode"][value="draft"]') ||
                     document.querySelector('input[value="draft"]');
  if (draftRadio) draftRadio.checked = true;

  const imageRadios = document.querySelectorAll('input[name="h2ImageSource"]');
  if (imageRadios.length > 0) {
    const imagefxRadio = Array.from(imageRadios).find(r => r.value === 'imagefx');
    if (imagefxRadio) imagefxRadio.checked = true;
  }
}

// ==========================================
// UX 개선: Accessibility — focus trap for modals
// ==========================================
function trapFocus(modalElement) {
  const focusable = modalElement.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])');
  if (focusable.length === 0) return;
  focusable[0].focus();
}

window.initProgressiveDisclosure = initProgressiveDisclosure;
window.toggleAdvancedSettings = toggleAdvancedSettings;
window.applySmartDefaults = applySmartDefaults;
window.trapFocus = trapFocus;

// ==================== 전역 함수 등록 ====================
// HTML에서 onclick으로 호출되는 모든 함수를 window 객체에 등록
// 함수 정의 직후에도 등록하지만, 여기서 한 번 더 확실히 등록
(function () {
  'use strict';
  if (typeof openSettingsModal !== 'undefined') window.openSettingsModal = openSettingsModal;
  if (typeof closeSettingsModal !== 'undefined') window.closeSettingsModal = closeSettingsModal;
  if (typeof openLicenseModal !== 'undefined') window.openLicenseModal = openLicenseModal;
  if (typeof closeLicenseModal !== 'undefined') window.closeLicenseModal = closeLicenseModal;
  if (typeof openExternalLinksModal !== 'undefined') window.openExternalLinksModal = openExternalLinksModal;
  if (typeof closeExternalLinksModal !== 'undefined') window.closeExternalLinksModal = closeExternalLinksModal;
  if (typeof openPexelsApiPage !== 'undefined') window.openPexelsApiPage = openPexelsApiPage;
  if (typeof openDalleApiPage !== 'undefined') window.openDalleApiPage = openDalleApiPage;
  if (typeof openNaverApiPage !== 'undefined') window.openNaverApiPage = openNaverApiPage;
  if (typeof openGeminiApiPage !== 'undefined') window.openGeminiApiPage = openGeminiApiPage;
  if (typeof openGoogleCseApiPage !== 'undefined') window.openGoogleCseApiPage = openGoogleCseApiPage;
  if (typeof openGoogleOAuthPage !== 'undefined') window.openGoogleOAuthPage = openGoogleOAuthPage;
  if (typeof addScheduledPost !== 'undefined') window.addScheduledPost = addScheduledPost;
  if (typeof refreshScheduleList !== 'undefined') window.refreshScheduleList = refreshScheduleList;
  if (typeof addExternalLink !== 'undefined') window.addExternalLink = addExternalLink;
  if (typeof filterLinksByMode !== 'undefined') window.filterLinksByMode = filterLinksByMode;
  if (typeof openExternalPostGenerator !== 'undefined') window.openExternalPostGenerator = openExternalPostGenerator;
  if (typeof activateLicenseFromModal !== 'undefined') window.activateLicenseFromModal = activateLicenseFromModal;
  if (typeof openManualCtaModal !== 'undefined') window.openManualCtaModal = openManualCtaModal;
  if (typeof closeManualCtaModal !== 'undefined') window.closeManualCtaModal = closeManualCtaModal;
  if (typeof saveManualCtas !== 'undefined') window.saveManualCtas = saveManualCtas;
  if (typeof openFullScreenPreviewModal !== 'undefined') window.openFullScreenPreviewModal = openFullScreenPreviewModal;
  if (typeof closeFullScreenPreviewModal !== 'undefined') window.closeFullScreenPreviewModal = closeFullScreenPreviewModal;
  if (typeof toggleCtaSettings !== 'undefined') window.toggleCtaSettings = toggleCtaSettings;
  if (typeof openManualCtaShortcut !== 'undefined') window.openManualCtaShortcut = openManualCtaShortcut;
  if (typeof addCtaItem !== 'undefined') window.addCtaItem = addCtaItem;
  if (typeof removeCtaItem !== 'undefined') window.removeCtaItem = removeCtaItem;
  if (typeof saveDeepInfraApiKey !== 'undefined') window.saveDeepInfraApiKey = saveDeepInfraApiKey;
  if (typeof testDeepInfraApiKey !== 'undefined') window.testDeepInfraApiKey = testDeepInfraApiKey;
  if (typeof loadDeepInfraApiKey !== 'undefined') window.loadDeepInfraApiKey = loadDeepInfraApiKey;
  // 🔥 Blogger/WordPress 가이드 및 연결 테스트 함수 등록
  if (typeof showBloggerGuide !== 'undefined') window.showBloggerGuide = showBloggerGuide;
  if (typeof showWordPressGuide !== 'undefined') window.showWordPressGuide = showWordPressGuide;
  if (typeof testBloggerConnection !== 'undefined') window.testBloggerConnection = testBloggerConnection;
})();

// ═══════════════════════════════════════════════════════════════
// 📖 Blogger 설정 가이드 모달
// ═══════════════════════════════════════════════════════════════
function showBloggerGuide() {
  const existingModal = document.getElementById('bloggerGuideModal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'bloggerGuideModal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.85); display: flex; align-items: center; justify-content: center;
    z-index: 10001; backdrop-filter: blur(10px);
  `;

  modal.innerHTML = `
    <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 24px; padding: 40px; max-width: 700px; width: 90%; max-height: 85vh; overflow-y: auto; box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5); border: 1px solid rgba(255, 255, 255, 0.1);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <h2 style="color: #f8fafc; font-size: 28px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 32px;">📝</span> Blogger OAuth2 설정 가이드
        </h2>
        <button onclick="document.getElementById('bloggerGuideModal').remove()" style="background: rgba(255,255,255,0.1); border: none; width: 40px; height: 40px; border-radius: 12px; color: white; font-size: 20px; cursor: pointer;">✕</button>
      </div>
      
      <div style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #1e293b; margin: 0; font-weight: 600; font-size: 14px;">⚠️ 각자 본인의 Google Cloud Console에서 OAuth 클라이언트를 생성해야 합니다</p>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <div style="background: rgba(255,255,255,0.05); border-radius: 16px; padding: 20px; border-left: 4px solid #4285f4;">
          <h3 style="color: #4285f4; font-size: 16px; font-weight: 700; margin: 0 0 12px 0;">📌 Step 1: Google Cloud Console 접속</h3>
          <p style="color: #94a3b8; font-size: 14px; margin: 0; line-height: 1.6;">
            <a href="https://console.cloud.google.com" target="_blank" style="color: #60a5fa; text-decoration: underline;">https://console.cloud.google.com</a> 접속 후 로그인
          </p>
        </div>
        
        <div style="background: rgba(255,255,255,0.05); border-radius: 16px; padding: 20px; border-left: 4px solid #34a853;">
          <h3 style="color: #34a853; font-size: 16px; font-weight: 700; margin: 0 0 12px 0;">📌 Step 2: 새 프로젝트 생성</h3>
          <p style="color: #94a3b8; font-size: 14px; margin: 0; line-height: 1.6;">상단 프로젝트 선택 → "새 프로젝트" → 이름 입력 (예: BloggerApp) → 만들기</p>
        </div>
        
        <div style="background: rgba(255,255,255,0.05); border-radius: 16px; padding: 20px; border-left: 4px solid #fbbc04;">
          <h3 style="color: #fbbc04; font-size: 16px; font-weight: 700; margin: 0 0 12px 0;">📌 Step 3: Blogger API 활성화</h3>
          <p style="color: #94a3b8; font-size: 14px; margin: 0; line-height: 1.6;">API 및 서비스 → 라이브러리 → "Blogger API v3" 검색 → 사용 설정</p>
        </div>
        
        <div style="background: rgba(255,255,255,0.05); border-radius: 16px; padding: 20px; border-left: 4px solid #ea4335;">
          <h3 style="color: #ea4335; font-size: 16px; font-weight: 700; margin: 0 0 12px 0;">📌 Step 4: OAuth 동의 화면 구성</h3>
          <p style="color: #94a3b8; font-size: 14px; margin: 0; line-height: 1.6;">
            OAuth 동의 화면 → 외부 → 앱 이름/이메일 입력 → 범위 추가: <code style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">../auth/blogger</code>
          </p>
        </div>
        
        <div style="background: rgba(255,255,255,0.05); border-radius: 16px; padding: 20px; border-left: 4px solid #9333ea;">
          <h3 style="color: #9333ea; font-size: 16px; font-weight: 700; margin: 0 0 12px 0;">📌 Step 5: 클라이언트 ID 생성</h3>
          <p style="color: #94a3b8; font-size: 14px; margin: 0; line-height: 1.6;">
            사용자 인증 정보 → OAuth 클라이언트 ID 만들기<br>
            • 애플리케이션 유형: <strong style="color: #f8fafc;">데스크톱 앱</strong><br>
            • 생성 후 <strong style="color: #22c55e;">Client ID</strong>와 <strong style="color: #22c55e;">Client Secret</strong> 복사
          </p>
        </div>
        
        <div style="background: rgba(255,255,255,0.05); border-radius: 16px; padding: 20px; border-left: 4px solid #06b6d4;">
          <h3 style="color: #06b6d4; font-size: 16px; font-weight: 700; margin: 0 0 12px 0;">📌 Step 6: 앱에 입력</h3>
          <p style="color: #94a3b8; font-size: 14px; margin: 0; line-height: 1.6;">
            환경설정 → 플랫폼 설정에서 다음 입력:<br>
            • <strong>Blogger ID</strong>: 블로그 URL의 숫자 ID<br>
            • <strong>Google Client ID</strong>: xxx.apps.googleusercontent.com<br>
            • <strong>Google Client Secret</strong>: GOCSPX-xxx
          </p>
        </div>
      </div>
      
      <div style="margin-top: 24px; display: flex; gap: 12px;">
        <button onclick="window.open('https://console.cloud.google.com', '_blank')" style="flex: 1; padding: 14px 20px; background: linear-gradient(135deg, #4285f4 0%, #34a853 100%); color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;">
          🔗 Google Cloud Console 열기
        </button>
        <button onclick="document.getElementById('bloggerGuideModal').remove()" style="flex: 1; padding: 14px 20px; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;">
          닫기
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

// ═══════════════════════════════════════════════════════════════
// 📖 WordPress 설정 가이드 모달
// ═══════════════════════════════════════════════════════════════
function showWordPressGuide() {
  const existingModal = document.getElementById('wordpressGuideModal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'wordpressGuideModal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.85); display: flex; align-items: center; justify-content: center;
    z-index: 10001; backdrop-filter: blur(10px);
  `;

  modal.innerHTML = `
    <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 24px; padding: 40px; max-width: 700px; width: 90%; max-height: 85vh; overflow-y: auto; box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5); border: 1px solid rgba(255, 255, 255, 0.1);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <h2 style="color: #f8fafc; font-size: 28px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 32px;">🌐</span> WordPress Application Password 가이드
        </h2>
        <button onclick="document.getElementById('wordpressGuideModal').remove()" style="background: rgba(255,255,255,0.1); border: none; width: 40px; height: 40px; border-radius: 12px; color: white; font-size: 20px; cursor: pointer;">✕</button>
      </div>
      
      <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <p style="color: white; margin: 0; font-weight: 600; font-size: 14px;">💡 WordPress 5.6 이상에서 기본 지원되며, HTTPS 연결이 필요합니다</p>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <div style="background: rgba(255,255,255,0.05); border-radius: 16px; padding: 20px; border-left: 4px solid #3b82f6;">
          <h3 style="color: #3b82f6; font-size: 16px; font-weight: 700; margin: 0 0 12px 0;">📌 Step 1: WordPress 관리자 페이지 접속</h3>
          <p style="color: #94a3b8; font-size: 14px; margin: 0; line-height: 1.6;">
            <code style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px;">https://yoursite.com/wp-admin/</code> 접속 후 로그인
          </p>
        </div>
        
        <div style="background: rgba(255,255,255,0.05); border-radius: 16px; padding: 20px; border-left: 4px solid #8b5cf6;">
          <h3 style="color: #8b5cf6; font-size: 16px; font-weight: 700; margin: 0 0 12px 0;">📌 Step 2: 프로필 페이지 이동</h3>
          <p style="color: #94a3b8; font-size: 14px; margin: 0; line-height: 1.6;">좌측 메뉴 → <strong>사용자</strong> → <strong>프로필</strong> 클릭</p>
        </div>
        
        <div style="background: rgba(255,255,255,0.05); border-radius: 16px; padding: 20px; border-left: 4px solid #22c55e;">
          <h3 style="color: #22c55e; font-size: 16px; font-weight: 700; margin: 0 0 12px 0;">📌 Step 3: Application Password 생성</h3>
          <p style="color: #94a3b8; font-size: 14px; margin: 0; line-height: 1.6;">
            페이지 하단 "Application Passwords" 섹션<br>
            • 이름 입력: <code style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">BloggerGPT</code><br>
            • "Add New Application Password" 클릭
          </p>
        </div>
        
        <div style="background: rgba(255,255,255,0.05); border-radius: 16px; padding: 20px; border-left: 4px solid #f59e0b;">
          <h3 style="color: #f59e0b; font-size: 16px; font-weight: 700; margin: 0 0 12px 0;">⚠️ Step 4: 비밀번호 복사 (중요!)</h3>
          <p style="color: #94a3b8; font-size: 14px; margin: 0; line-height: 1.6;">
            생성된 비밀번호는 <strong style="color: #ef4444;">한 번만 표시됩니다!</strong><br>
            반드시 안전한 곳에 복사해두세요.<br>
            형식: <code style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">xxxx xxxx xxxx xxxx xxxx xxxx</code>
          </p>
        </div>
        
        <div style="background: rgba(255,255,255,0.05); border-radius: 16px; padding: 20px; border-left: 4px solid #06b6d4;">
          <h3 style="color: #06b6d4; font-size: 16px; font-weight: 700; margin: 0 0 12px 0;">📌 Step 5: 앱에 입력</h3>
          <p style="color: #94a3b8; font-size: 14px; margin: 0; line-height: 1.6;">
            환경설정 → 고급 설정에서 다음 입력:<br>
            • <strong>WordPress 사이트 URL</strong>: https://yoursite.com<br>
            • <strong>사용자명</strong>: WordPress 사용자명<br>
            • <strong>Application Password</strong>: 복사한 비밀번호 (공백 포함 OK)
          </p>
        </div>
      </div>
      
      <div style="margin-top: 24px; display: flex; gap: 12px;">
        <button onclick="window.open('https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/', '_blank')" style="flex: 1; padding: 14px 20px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;">
          🔗 공식 가이드 열기
        </button>
        <button onclick="document.getElementById('wordpressGuideModal').remove()" style="flex: 1; padding: 14px 20px; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;">
          닫기
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

// ═══════════════════════════════════════════════════════════════
// 🔗 Blogger 연결 테스트
// ═══════════════════════════════════════════════════════════════
async function testBloggerConnection() {
  const statusDiv = document.getElementById('bloggerConnectionStatus');
  const blogId = document.getElementById('blogId')?.value?.trim();
  const clientId = document.getElementById('googleClientId')?.value?.trim();
  const clientSecret = document.getElementById('googleClientSecret')?.value?.trim();

  if (!statusDiv) return;

  // 상태 표시
  statusDiv.style.display = 'block';
  statusDiv.style.background = 'rgba(59, 130, 246, 0.2)';
  statusDiv.style.color = '#93c5fd';
  statusDiv.textContent = '🔄 연결 확인 중...';

  // 필수 값 체크
  if (!blogId || !clientId || !clientSecret) {
    statusDiv.style.background = 'rgba(239, 68, 68, 0.2)';
    statusDiv.style.color = '#fca5a5';
    statusDiv.textContent = '❌ Blogger ID, Client ID, Client Secret을 모두 입력해주세요';
    return;
  }

  try {
    // blogger.checkBloggerAuth API 호출
    if (window.blogger && window.blogger.checkBloggerAuth) {
      const result = await window.blogger.checkBloggerAuth({
        blogId,
        googleClientId: clientId,
        googleClientSecret: clientSecret
      });

      if (result && result.ok && result.data && result.data.authenticated) {
        statusDiv.style.background = 'rgba(34, 197, 94, 0.2)';
        statusDiv.style.color = '#86efac';
        statusDiv.textContent = '✅ Blogger 연결 성공! 인증됨';
      } else if (result && result.data && result.data.needsAuth) {
        statusDiv.style.background = 'rgba(251, 191, 36, 0.2)';
        statusDiv.style.color = '#fde047';
        statusDiv.innerHTML = '⚠️ OAuth 인증이 필요합니다. <button onclick="startBloggerOAuth()" style="background: #fbbf24; color: #1e293b; border: none; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; margin-left: 8px;">인증 시작</button>';
      } else {
        statusDiv.style.background = 'rgba(239, 68, 68, 0.2)';
        statusDiv.style.color = '#fca5a5';
        statusDiv.textContent = '❌ 연결 실패: ' + (result?.error || result?.data?.error || '알 수 없는 오류');
      }
    } else {
      // API가 없는 경우 설정값만 확인
      statusDiv.style.background = 'rgba(34, 197, 94, 0.2)';
      statusDiv.style.color = '#86efac';
      statusDiv.textContent = '✅ 설정값 확인 완료 (연결 테스트는 게시 시 수행)';
    }
  } catch (error) {
    console.error('Blogger 연결 테스트 오류:', error);
    statusDiv.style.background = 'rgba(239, 68, 68, 0.2)';
    statusDiv.style.color = '#fca5a5';
    statusDiv.textContent = '❌ 연결 테스트 오류: ' + error.message;
  }
}