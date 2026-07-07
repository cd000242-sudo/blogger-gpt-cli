// external-traffic.js — v3.8.0 v2.3 플랜 통합
//   외부유입 글 생성 탭. 발행한 글 1개를 선택해 각 플랫폼별로 변환 글을 생성한다.
//   v2 IPC (generate-external-traffic-text-v2) 사용 — multi-output 분리, 해시태그 분리, riskScore 노출.
//   v2 미지원 채널 (kakao/youtube-shorts/tiktok/naver-cafe)은 v1 IPC로 폴백.
//   자동 발행은 ToS 위반·정지 위험이라 미구현. 복사/바로가기 두 버튼으로 수동 게시 유도.

// ─── 플랫폼 정의 ────────────────────────────────────────────────
// 각 플랫폼: id, label, icon, openUrl(바로가기 URL), 어조·길이·CTA 위치 등 시스템 프롬프트.
// 사용자가 추가/수정하기 쉽도록 한 곳에 모아 둠.
const PLATFORMS = [
  {
    id: 'instagram',
    label: '인스타그램',
    icon: '📷',
    openUrl: 'https://www.instagram.com/',
    color: '#e1306c',
    promptSystem: `당신은 한국 인스타그램 외부유입 캡션 전문가입니다. 원문 문맥을 먼저 분석하고 A/B/C 3안(저장형·공감형·경고형)을 만드세요. 특정 주제 문장을 하드코딩하지 말고, 원문에 없는 금액·조건·기간·대상자·효과를 만들지 마세요. 각 안은 첫 줄 후보 10개와 점수, 최종 개선안을 포함합니다. 복사용 최종안은 첫 줄·본문·저장/공유/댓글/링크 유도·해시태그만 포함합니다.`,
    promptUser: (src) => `원본 블로그: "${src.title}"\n원본 URL: ${src.url}\n원본 요약: ${_extractExtTrafficSourceText(src) || '(요약 없음)'}\n\n인스타그램 A/B/C 3안을 생성하세요. 글 유형을 자동 분류하고, 첫 줄 후보 10개를 점수화한 뒤 최고 점수 첫 줄을 선택하세요. 해시태그는 8~12개, 이모지는 최대 3개, CTA는 프로필/링크 확인 문장으로만 작성하세요.`,
  },
  {
    id: 'threads',
    label: 'Threads',
    icon: '🧵',
    openUrl: 'https://www.threads.com/',
    color: '#000000',
    promptSystem: `당신은 한국 Threads 외부유입 글 에디터입니다. 블로그 요약문이나 홍보문이 아니라 댓글이 먼저 달리는 대화형 글을 씁니다. 500자 이내, 자연스러운 반말/친구 말투, 해시태그 금지, 강한 클릭 유도 금지. "자세한 내용은 링크 확인", "확인해보시기 바랍니다", "부탁드립니다" 같은 문구는 쓰지 않습니다.`,
    promptUser: (src) => `원문 제목: "${src.title}"\n원문 URL: ${src.url}\n원문 내용: ${_extractExtTrafficSourceText(src) || '(요약 없음)'}\n\nThreads 게시문 1개를 작성하세요. 첫 줄은 질문/공감/반전 중 하나로 시작하고, 댓글이 자연스럽게 달릴 만한 관점으로 씁니다. 마지막 줄에는 URL만 자연스럽게 포함하세요: ${src.url}`,
  },
  {
    id: 'naver-blog',
    label: '네이버 블로그',
    icon: '📝',
    openUrl: 'https://blog.naver.com/',
    color: '#03c75a',
    promptSystem: `당신은 한국 네이버 블로그 외부유입 글 에디터입니다. SNS 홍보문이 아니라 검색형 미니 포스트를 씁니다. 700~1200자, 존댓말 정보글, 검색 의도에 맞는 제목, 소제목 2~3개, 자연스러운 원문 유도, 해시태그 5~8개. 반말, 과장, 클릭 강요, 원문에 없는 조건 생성은 금지합니다.`,
    promptUser: (src) => `원문 제목: "${src.title}"\n원문 URL: ${src.url}\n원문 내용: ${_extractExtTrafficSourceText(src) || '(요약 없음)'}\n\n네이버 블로그 검색형 미니 포스트 1편을 작성하세요. 제목 1개, 도입부, 소제목 2~3개, 핵심 정리, 자연스러운 원문 유도 문장, 댓글 유도 문장, 해시태그 5~8개를 포함하세요. 원문 유도 문장에는 ${src.url}을 자연스럽게 넣으세요.`,
  },
  {
    id: 'naver-cafe',
    label: '네이버 카페',
    icon: '☕',
    openUrl: 'https://section.cafe.naver.com/',
    color: '#03c75a',
    promptSystem: `당신은 한국 네이버 카페 회원입니다. 정보 공유체, 자기 홍보 톤 절대 금지. 본문 끝에 자연스러운 출처 인용으로 링크를 1번만. 카페 가입 후 N주 활동 권장 경고 포함.`,
    promptUser: (src) => `원본 블로그: "${src.title}"\n원본 URL: ${src.url}\n\n네이버 카페에 정보 공유체로 글을 작성하세요 (1,500~2,500자). 본문은 정보 공유 비중 95%+, 말미에 자연스러운 출처 1줄 "더 자세히 정리해뒀어요 → ${src.url}". 광고 톤 절대 금지.`,
  },
  {
    id: 'x',
    label: 'X (트위터)',
    icon: '🐦',
    openUrl: 'https://x.com/compose/post',
    color: '#1da1f2',
    promptSystem: `당신은 한국 X 마케터입니다. 본문 280자 + 첫 댓글에 링크. 본문 트윗에는 링크 절대 X (도달 30~50% 감소). 출력은 두 트윗: mainTweet (미끼) + replyTweet (링크 + 한 줄).`,
    promptUser: (src) => `원본 블로그: "${src.title}"\n원본 URL: ${src.url}\n\nX(트위터) 2-트윗을 작성하세요.\n[Tweet 1] 280자 이내 본문 (미끼, 링크 X). 끝에 "↓ 댓글에 전체 내용".\n[Tweet 2] 280자 이내 리플라이 (${src.url} + 한 줄 안내).\n출력 형식: 명확하게 "Tweet 1:" 줄, "Tweet 2:" 줄로 구분.`,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    icon: '👥',
    openUrl: 'https://www.facebook.com/',
    color: '#1877f2',
    promptSystem: `당신은 한국 Facebook 마케터입니다. 개인 계정/그룹 기준 500~1,500자, 친근한 존댓말. Page는 2-링크 캡 있으므로 본문 끝 또는 댓글 링크. 두 변형(personalText / commentLink) 출력.`,
    promptUser: (src) => `원본 블로그: "${src.title}"\n원본 URL: ${src.url}\n\nFacebook 게시물 2변형을 작성하세요.\n[개인 계정용 본문] 500~1,500자 + 본문 끝 ${src.url}\n[그룹 댓글용] 본문은 미끼만, 댓글에 박을 한 줄 + ${src.url}\n출력 형식: "[개인 계정]" / "[그룹 댓글]" 헤더로 분리.`,
  },
  {
    id: 'kakao-openchat',
    label: '카카오톡 오픈채팅',
    icon: '💬',
    openUrl: 'https://open.kakao.com/',
    color: '#fee500',
    promptSystem: `당신은 한국 카카오톡 오픈채팅 운영자입니다. 1~2줄 (60~120자), 친근한 반말 또는 존댓말 (방 분위기에 맞춤), 이모지 1~2개. 본인 운영 방 외 사용 금지 경고.`,
    promptUser: (src) => `원본 블로그: "${src.title}"\n원본 URL: ${src.url}\n\n카카오톡 오픈채팅 방에 공유할 1~2줄을 작성하세요 (60~120자). 형식: 후킹 질문/반전 1줄 + 가치 한 줄 + 끝에 "👉 ${src.url}".`,
  },
  {
    id: 'kakao-channel',
    label: '카카오톡 채널',
    icon: '💛',
    openUrl: 'https://center-pf.kakao.com/',
    color: '#fee500',
    promptSystem: `당신은 카카오톡 비즈니스 채널 운영자입니다. 친구 추가한 구독자에게 보내는 카드 게시물(헤드라인 30~40자 + 본문 150~250자 + 더보기 버튼 5~10자) A/B/C 3안을 작성합니다. 본문에서 정보 다 풀지 말고 "나도 해당되나?" 미해결 질문을 남겨 더보기 클릭을 유도하세요.`,
    promptUser: (src) => `원본 블로그: "${src.title}"\n원본 URL: ${src.url}\n\n카카오톡 채널 소식 게시물 A/B/C를 작성하세요. 각 안마다 [헤드라인] [본문] [버튼라벨] [URL] 형식. 본문 끝엔 cliffhanger 필수.`,
  },
  {
    id: 'youtube-shorts',
    label: '유튜브 쇼츠 스크립트',
    icon: '🎬',
    openUrl: 'https://studio.youtube.com/',
    color: '#ff0000',
    promptSystem: `당신은 한국 유튜브 쇼츠 크리에이터입니다. 30~60초 음성 스크립트 + 더보기 description + 고정 댓글 카피 3가지 출력.`,
    promptUser: (src) => `원본 블로그: "${src.title}"\n원본 URL: ${src.url}\n\n쇼츠 3가지를 출력하세요:\n[Script 30~60초] Hook 3초 + Body 20~40초 + CTA 3초\n[Description] ≤500자, 끝에 🔗 전체 글: ${src.url}\n[Pinned Comment] ≤280자, 끝에 ${src.url}`,
  },
  {
    id: 'tiktok',
    label: '틱톡 스크립트',
    icon: '🎵',
    openUrl: 'https://www.tiktok.com/upload',
    color: '#ff0050',
    promptSystem: `당신은 한국 틱톡 크리에이터입니다. 15~30초 음성 스크립트 + 캡션 50~150자 + 해시태그 5~10개. CTA는 "프로필 링크 클릭" 자막 카피.`,
    promptUser: (src) => `원본 블로그: "${src.title}"\n원본 URL: ${src.url}\n\n틱톡 3가지를 출력하세요:\n[Script 15~30초] Hook 2초 + Body 10~20초 + "프로필 링크 클릭"\n[Caption] 50~150자\n[Hashtags] 메인1+중간3~5+트렌딩1~2`,
  },
  {
    id: 'local-board',
    label: '지역 자유게시판',
    icon: '🏘️',
    openUrl: '',
    color: '#f59e0b',
    promptSystem: `당신은 한국 동네 주민입니다 (네이버 카페 지역방·맘카페·부동산 카페·아파트 입주민 카페 자유게시판). 광고 티 절대 금지. 진짜 주민이 묻거나 공유하는 자연스러운 존댓말 + 동네 어조 ("저희 동네", "여기 사시는 분들"). 첫 줄부터 광고 같으면 즉시 삭제될 수 있음. 본문 200~400자, 끝에 "혹시 도움 되실까 해서" 같은 자연스러운 표현으로 링크 1개만.`,
    promptUser: (src) => `원본 블로그: "${src.title}"\n원본 URL: ${src.url}\n\n지역 자유게시판에 올릴 글을 작성하세요 (200~400자). 형식: 동네 질문형/경험 공유형/정보 공유형 중 하나로 자연스럽게. 본문 끝에 "혹시 도움 되실까 해서 정리한 글 공유해요 → ${src.url}".`,
  },
  {
    id: 'pinterest',
    label: '핀터레스트',
    icon: '📌',
    openUrl: 'https://www.pinterest.com/pin-builder/',
    color: '#e60023',
    promptSystem: `당신은 한국 핀터레스트 크리에이터입니다. 핀 제목 ≤100자(검색 친화 키워드 풍부), description ≤500자, 인포그래픽 이미지 설명까지 출력. 핀 자체가 외부 링크라 직접 ${'${URL}'} 매핑.`,
    promptUser: (src) => `원본 블로그: "${src.title}"\n원본 URL: ${src.url}\n\n핀터레스트 4가지를 출력하세요:\n[Pin Title] 검색 키워드 풍부 (≤100자)\n[Description] ≤500자, 키워드 자연 분포, 끝에 ${src.url}\n[Board Suggestion] 어떤 보드에 핀할지 추천\n${_getPinterestImageInstruction()}`,
  },
];

// ─── 상태 ────────────────────────────────────────────────
const PLATFORM_LOGOS = {
  instagram: { slug: 'instagram', color: 'E4405F', fallback: 'IG' },
  threads: { slug: 'threads', color: 'FFFFFF', fallback: 'Th' },
  'naver-blog': { slug: 'naver', color: '03C75A', fallback: 'N' },
  'naver-cafe': { slug: 'naver', color: '03C75A', fallback: 'N' },
  x: { slug: 'x', color: 'FFFFFF', fallback: 'X' },
  facebook: { slug: 'facebook', color: '1877F2', fallback: 'f' },
  'kakao-openchat': { slug: 'kakaotalk', color: '000000', fallback: 'K' },
  'kakao-channel': { slug: 'kakaotalk', color: 'FEE500', fallback: '💛' },
  'youtube-shorts': { slug: 'youtubeshorts', color: 'FF0000', fallback: '▶' },
  tiktok: { slug: 'tiktok', color: 'FFFFFF', fallback: '♪' },
  pinterest: { slug: 'pinterest', color: 'E60023', fallback: 'P' },
  'local-board': { slug: 'naver', color: 'F59E0B', fallback: '🏘' },
};

function _getPlatformLogoMeta(platform) {
  return PLATFORM_LOGOS[platform.id] || {
    slug: String(platform.id || '').replace(/[^a-z0-9-]/gi, '').toLowerCase(),
    color: String(platform.color || '#94a3b8').replace('#', '') || '94A3B8',
    fallback: platform.icon || '?',
  };
}

function _renderPlatformLogo(platform, size = 'list') {
  const meta = _getPlatformLogoMeta(platform);
  const isHeader = size === 'header';
  const boxSize = isHeader ? 48 : 24;
  const imgSize = isHeader ? 26 : 16;
  const bg = platform.id === 'instagram'
    ? 'linear-gradient(135deg, rgba(245,133,41,0.22), rgba(221,42,123,0.24), rgba(81,91,212,0.20))'
    : platform.id === 'kakao-openchat'
      ? 'rgba(254,229,0,0.95)'
      : `${platform.color || '#64748b'}22`;
  const border = platform.id === 'kakao-openchat'
    ? 'rgba(254,229,0,0.45)'
    : `${platform.color || '#64748b'}55`;
  const iconUrl = `https://cdn.simpleicons.org/${meta.slug}/${meta.color}`;
  return `
    <span class="ext-platform-logo ext-platform-logo-${escapeHtml(platform.id)}"
      title="${escapeHtml(platform.label)} 공식 로고"
      style="width:${boxSize}px;height:${boxSize}px;border-radius:${isHeader ? 12 : 7}px;background:${bg};border:1px solid ${border};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;">
      <img src="${iconUrl}" alt="${escapeHtml(platform.label)} logo" loading="lazy"
        style="width:${imgSize}px;height:${imgSize}px;display:block;object-fit:contain;"
        onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex';">
      <span style="display:none;align-items:center;justify-content:center;width:100%;height:100%;font-size:${isHeader ? 15 : 10}px;font-weight:900;color:${platform.id === 'kakao-openchat' ? '#000' : '#f8fafc'};">${escapeHtml(meta.fallback)}</span>
    </span>`;
}

function _readExtTrafficJsonStorage(key, fallback = '') {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return localStorage.getItem(key) || fallback;
  }
}

function _getExtTrafficAgentImageMode() {
  if (typeof window !== 'undefined' && typeof window.getAgentImageSettingsMode === 'function') {
    return window.getAgentImageSettingsMode();
  }
  const executionMode = _readExtTrafficJsonStorage('leadernamExecutionMode', 'api') === 'agent' ? 'agent' : 'api';
  const provider = _readExtTrafficJsonStorage('leadernamActiveAgentProvider', 'codex') === 'claude' ? 'claude' : 'codex';
  return {
    executionMode,
    provider,
    isAgentMode: executionMode === 'agent',
    codexImageManaged: false,
    agentUsesImageApi: executionMode === 'agent',
    claudeNeedsImageEngine: executionMode === 'agent',
  };
}

function _getExtTrafficImageModePayload() {
  const mode = _getExtTrafficAgentImageMode();
  return {
    executionMode: mode.executionMode,
    agentProvider: mode.provider,
    imagePolicy: mode.imagePolicy || mode.policy || 'all',
    h2ImageMode: mode.h2ImageMode || mode.imagePolicy || mode.policy || 'all',
    thumbnailTextIncluded: mode.thumbnailTextIncluded !== false,
    thumbnailIncludeText: mode.thumbnailTextIncluded !== false,
    h2TextIncluded: false,
  };
}

function _getPinterestImageInstruction() {
  const mode = _getExtTrafficAgentImageMode();
  if (mode.isAgentMode) {
    return '[Image Prompt]는 Agent가 직접 이미지를 생성하지 않으므로 Orbit 이미지 엔진/API에 넣을 수 있는 영어 프롬프트로 작성하세요.';
  }
  return '[Image Prompt]는 사용자가 별도 이미지 생성 도구로 만들 수 있는 영어 프롬프트로 작성하세요.';
}

let _selectedSource = null; // { title, url, html, thumbnail, ... }
let _activePlatformId = null;
const _generatedCache = new Map(); // platformId → { text, generatedAt }
const _selectedBatchPlatformIds = new Set();

// ─── 발행글 목록 모달 (single-select 모드) ────────────────────────────────────────────────
function _deriveExtTrafficProviderFromModel(modelValue) {
  const value = String(modelValue || '').trim();
  if (!value) return '';
  if (value.startsWith('gemini-')) return 'gemini';
  if (value.startsWith('openai-')) return 'openai';
  if (value.startsWith('claude-')) return 'claude';
  if (value === 'perplexity-sonar' || value.startsWith('perplexity-')) return 'perplexity';
  return '';
}

function _getExtTrafficAiPreference() {
  const selectedModel = document.querySelector('input[name="primaryGeminiTextModel"]:checked')?.value || '';
  const savedEngine = document.getElementById('generationEngine')?.value || '';
  const provider = _deriveExtTrafficProviderFromModel(selectedModel) || savedEngine || 'gemini';
  const defaultModelByProvider = {
    gemini: 'gemini-2.5-flash',
    openai: 'openai-gpt41',
    claude: 'claude-sonnet',
    perplexity: 'perplexity-sonar',
  };
  const modelProvider = _deriveExtTrafficProviderFromModel(selectedModel);
  return {
    provider,
    generationEngine: provider,
    primaryGeminiTextModel: modelProvider === provider
      ? selectedModel
      : (defaultModelByProvider[provider] || 'gemini-2.5-flash'),
  };
}

function openExtTrafficSourceModal() {
  // v3.8.2: 모달 mode 정식 통합 — internal-links.js가 mode 인자로 분기.
  if (typeof window.openPublishedPostsModal !== 'function') {
    alert('발행글 목록 기능을 사용할 수 없습니다.');
    return;
  }
  window.openPublishedPostsModal({ mode: 'external-traffic' });
}

// 거미줄 모달에서 글 선택 시 호출됨 (모달 측 윈도우 함수에서 분기 호출 가능)
function extTrafficSetSource(source) {
  _selectedSource = source;
  const badge = document.getElementById('extTrafficSourceBadge');
  const titleEl = document.getElementById('extTrafficSourceTitle');
  const urlEl = document.getElementById('extTrafficSourceUrl');
  if (!source) {
    if (badge) badge.style.display = 'none';
    return;
  }
  if (badge) badge.style.display = 'block';
  if (titleEl) titleEl.textContent = source.title || '제목 없음';
  if (urlEl) urlEl.textContent = source.url || '';
  console.log('[EXT-TRAFFIC] 원본 글 선택:', source.title);
}

function extTrafficClearSource() {
  _selectedSource = null;
  _generatedCache.clear();
  extTrafficSetSource(null);
  _renderResultPlaceholder();
  _renderPlatformList(); // 사이드바 다시 그려 active 상태 초기화
}

// ─── 좌측 세로 서브탭 렌더 ────────────────────────────────────────────────
function _updateBatchSelectionCount() {
  const el = document.getElementById('extTrafficBatchSelectedCount');
  if (el) el.textContent = `${_selectedBatchPlatformIds.size}개 선택`;
}

function extTrafficToggleBatchPlatform(platformId, checked) {
  if (checked) _selectedBatchPlatformIds.add(platformId);
  else _selectedBatchPlatformIds.delete(platformId);
  _updateBatchSelectionCount();
}

function extTrafficSelectBatchPlatforms(mode = 'all') {
  _selectedBatchPlatformIds.clear();
  if (mode === 'all') {
    PLATFORMS.forEach((p) => _selectedBatchPlatformIds.add(p.id));
  }
  _renderPlatformList();
}

function _getBatchSelectedPlatforms() {
  return PLATFORMS.filter((p) => _selectedBatchPlatformIds.has(p.id));
}

function _renderPlatformList() {
  const wrap = document.getElementById('extTrafficPlatformList');
  if (!wrap) return;
  wrap.innerHTML = PLATFORMS.map((p) => {
    const isActive = _activePlatformId === p.id;
    const hasCache = _generatedCache.has(p.id);
    const isChecked = _selectedBatchPlatformIds.has(p.id);
    return `
      <button type="button" data-platform="${p.id}" onclick="extTrafficSelectPlatform('${p.id}')"
        style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: ${isActive ? 'linear-gradient(135deg, rgba(99,102,241,0.22), rgba(168,85,247,0.18))' : 'rgba(255,255,255,0.04)'}; border: 1px solid ${isActive ? 'rgba(99,102,241,0.4)' : 'rgba(148,163,184,0.1)'}; border-radius: 10px; color: #e2e8f0; font-size: 13px; font-weight: 600; cursor: pointer; width: 100%; text-align: left; transition: all 0.15s ease;"
        onmouseover="if(!this.classList.contains('is-active')) { this.style.background='rgba(255,255,255,0.08)'; }"
        onmouseout="if(!this.classList.contains('is-active')) { this.style.background='rgba(255,255,255,0.04)'; }">
        ${_renderPlatformLogo(p, 'list')}
        <span style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.label}</span>
        ${hasCache ? '<span style="font-size: 10px; color: #34d399;" title="생성됨">✓</span>' : ''}
      </button>`;
  }).join('');
  wrap.querySelectorAll('button[data-platform]').forEach((btn) => {
    const platformId = btn.getAttribute('data-platform') || '';
    const row = document.createElement('div');
    const checked = _selectedBatchPlatformIds.has(platformId);
    row.setAttribute('data-platform-row', platformId);
    row.style.cssText = `display:flex;align-items:center;gap:8px;padding:6px;background:${checked ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.025)'};border:1px solid ${checked ? 'rgba(34,197,94,0.25)' : 'rgba(148,163,184,0.08)'};border-radius:12px;`;
    const label = document.createElement('label');
    label.title = '생성 대상 선택';
    label.style.cssText = 'width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;background:rgba(15,23,42,0.65);border:1px solid rgba(148,163,184,0.14);cursor:pointer;flex-shrink:0;';
    label.innerHTML = `<input type="checkbox" ${checked ? 'checked' : ''} style="width:15px;height:15px;accent-color:#22c55e;cursor:pointer;">`;
    const checkbox = label.querySelector('input');
    checkbox?.addEventListener('change', () => extTrafficToggleBatchPlatform(platformId, checkbox.checked));
    btn.parentNode.insertBefore(row, btn);
    row.appendChild(label);
    row.appendChild(btn);
    btn.style.minWidth = '0';
  });
  _updateBatchSelectionCount();
}

// ─── 결과 placeholder ────────────────────────────────────────────────
function _renderResultPlaceholder() {
  const wrap = document.getElementById('extTrafficResult');
  if (!wrap) return;
  wrap.innerHTML = `
    <div style="text-align: center; padding: 80px 20px; color: #64748b;">
      <div style="font-size: 56px; margin-bottom: 14px;">📝</div>
      <div style="font-size: 16px; font-weight: 700; color: #cbd5e1; margin-bottom: 8px;">좌측에서 플랫폼을 선택하세요</div>
      <div style="font-size: 13px;">원본 글이 선택되어 있어야 생성할 수 있어요.</div>
    </div>`;
}

// ─── 플랫폼 선택 → 결과 영역 렌더 ────────────────────────────────────────────────
function extTrafficSelectPlatform(platformId) {
  _activePlatformId = platformId;
  const platform = PLATFORMS.find((p) => p.id === platformId);
  if (!platform) return;
  _renderPlatformList();
  _renderResultPanel(platform);
}

function _renderResultPanel(platform) {
  const wrap = document.getElementById('extTrafficResult');
  if (!wrap) return;
  const cached = _generatedCache.get(platform.id);
  const safeLabel = escapeHtml(platform.label);

  wrap.innerHTML = `
    <header style="display: flex; align-items: center; gap: 14px; margin-bottom: 18px; padding-bottom: 16px; border-bottom: 1px solid rgba(148,163,184,0.1);">
      ${_renderPlatformLogo(platform, 'header')}
      <div style="flex: 1; min-width: 0;">
        <h2 style="margin: 0; color: #f1f5f9; font-size: 20px; font-weight: 800;">${safeLabel} ${_renderConfidenceBadge(platform.id)}</h2>
        <p style="margin: 4px 0 0; color: #94a3b8; font-size: 12px;">선택 글을 ${safeLabel} 맞춤 글로 변환합니다.</p>
      </div>
      <button type="button" onclick="extTrafficGenerateOne('${platform.id}')"
        style="padding: 10px 18px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; border-radius: 10px; font-size: 13px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 14px rgba(99,102,241,0.35); white-space: nowrap;">
        ${cached ? '🔄 다시 생성' : '✨ 생성하기'}
      </button>
    </header>

    <div id="extTrafficResultBody" style="min-height: 280px;">
      ${cached ? _renderResultCard(platform, cached) : _renderEmptyState()}
    </div>
  `;
}

function _renderEmptyState() {
  return `
    <div style="text-align: center; padding: 60px 20px; color: #64748b;">
      <div style="font-size: 48px; margin-bottom: 12px;">✨</div>
      <div style="font-size: 14px; font-weight: 600; color: #cbd5e1;">생성하기 버튼을 눌러주세요</div>
    </div>`;
}

// v2 cached: { isV2: true, rawText, formatted, risk, lengthViolations, attempt }
// v1 cached: { isV2: false, rawText }
function _renderResultCard(platform, cached) {
  if (cached && cached.isV2) {
    return _renderV2ResultCard(platform, cached);
  }
  return _renderV1ResultCard(platform, (cached && cached.rawText) || cached.text || '');
}

function _renderV1ResultCard(platform, text) {
  const safeText = escapeHtml(text);
  const safeLabel = escapeHtml(platform.label);
  return `
    <div style="position: relative;">
      <textarea id="extTrafficResultText" readonly
        style="width: 100%; min-height: 320px; padding: 18px 20px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(148,163,184,0.15); border-radius: 12px; color: #e2e8f0; font-size: 14px; line-height: 1.7; font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; resize: vertical; box-sizing: border-box; white-space: pre-wrap;">${safeText}</textarea>
    </div>
    <div style="display: flex; gap: 10px; margin-top: 14px;">
      <button type="button" onclick="extTrafficCopyResult()"
        style="flex: 1; padding: 13px 18px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 14px rgba(16,185,129,0.35); display: flex; align-items: center; justify-content: center; gap: 8px;">
        📋 복사
      </button>
      <button type="button" onclick="extTrafficOpenPlatform('${platform.id}')"
        style="flex: 1; padding: 13px 18px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 14px rgba(99,102,241,0.35); display: flex; align-items: center; justify-content: center; gap: 8px;">
        🔗 ${safeLabel} 바로가기
      </button>
    </div>
    <p style="margin: 14px 0 0; font-size: 11px; color: #64748b; line-height: 1.6;">
      💡 복사 → 바로가기로 ${safeLabel} 열어 붙여넣기. 자동 발행은 ToS·정지 위험으로 제공하지 않습니다.
    </p>`;
}

function _renderV2ResultCard(platform, cached) {
  if (platform.id === 'instagram') {
    const normalized = _normalizeInstagramCachedForDisplay(cached);
    if (normalized !== cached) {
      cached = normalized;
      _generatedCache.set(platform.id, normalized);
    }
  }
  if (platform.id === 'threads') {
    const normalized = _normalizeThreadsCachedForDisplay(cached);
    if (normalized !== cached) {
      cached = normalized;
      _generatedCache.set(platform.id, normalized);
    }
  }
  if (platform.id === 'naver-blog') {
    const normalized = _normalizeNaverBlogCachedForDisplay(cached);
    if (normalized !== cached) {
      cached = normalized;
      _generatedCache.set(platform.id, normalized);
    }
  }

  if (platform.id === 'instagram' && cached.instagram && Array.isArray(cached.instagram.variants) && cached.instagram.variants.length > 0) {
    return _renderInstagramResultCard(platform, cached);
  }
  if (platform.id === 'threads' && cached.threads && Array.isArray(cached.threads.variants) && cached.threads.variants.length > 0) {
    return _renderThreadsResultCard(platform, cached);
  }
  if (platform.id === 'naver-blog' && cached.naverBlog && Array.isArray(cached.naverBlog.variants) && cached.naverBlog.variants.length > 0) {
    return _renderNaverBlogResultCard(platform, cached);
  }
  const structuredCard = _renderStructuredPlatformResultCard(platform, cached);
  if (structuredCard) {
    return structuredCard;
  }

  const formatted = cached.formatted || {};
  const risk = cached.risk;
  const violations = cached.lengthViolations || [];
  const safeLabel = escapeHtml(platform.label);

  const riskBadge = risk ? _renderRiskBadge(risk) : '';
  const lengthWarn = violations.length > 0
    ? `<div style="margin-bottom: 12px; padding: 10px 14px; background: rgba(251, 191, 36, 0.12); border: 1px solid rgba(251, 191, 36, 0.35); border-radius: 10px; color: #fbbf24; font-size: 12px;">⚠️ 길이 검증: ${escapeHtml(violations.join(' · '))}</div>`
    : '';

  // multi-output 또는 단일 body
  let bodyHtml = '';
  if (formatted.parts && typeof formatted.parts === 'object') {
    bodyHtml = _renderMultiOutput(platform, formatted.parts);
  } else if (formatted.body !== undefined) {
    bodyHtml = _renderSingleBody(platform, formatted);
  } else if (cached.rawText) {
    bodyHtml = _renderSingleBody(platform, { body: cached.rawText });
  }

  const tipText = formatted.parts
    ? '💡 각 영역마다 개별 복사 가능. 영역별 길이 한도 자동 검증.'
    : '💡 복사 → 바로가기로 ' + safeLabel + ' 열어 붙여넣기. 자동 발행은 미제공 (ToS).';

  const isCritical = risk && risk.band === 'critical';
  const goButton = isCritical
    ? `<button type="button" disabled
        style="flex: 1; padding: 13px 18px; background: rgba(239,68,68,0.18); color: #fca5a5; border: 1px solid rgba(239,68,68,0.4); border-radius: 10px; font-size: 13px; font-weight: 800; cursor: not-allowed;">
        ⛔ 바로가기 비활성 (critical) — 직접 편집 후 진행
      </button>`
    : `<button type="button" onclick="extTrafficOpenPlatform('${platform.id}')"
        style="flex: 1; padding: 13px 18px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 14px rgba(99,102,241,0.35); display: flex; align-items: center; justify-content: center; gap: 8px;">
        🔗 ${safeLabel} 바로가기
      </button>`;

  const riskScore = risk ? (risk.score || 0) : 0;
  const riskBand = risk ? (risk.band || 'low') : 'low';

  return `
    ${riskBadge}
    ${lengthWarn}
    ${bodyHtml}
    ${_renderPreviewSimulation(platform.id, formatted)}
    ${_renderFeedbackRow(platform.id, riskScore, riskBand)}
    <div style="display: flex; gap: 10px; margin-top: 14px;">
      ${goButton}
    </div>
    <p style="margin: 14px 0 0; font-size: 11px; color: #64748b; line-height: 1.6;">${tipText}</p>
  `;
}

function _renderInstagramResultCard(platform, cached) {
  const instagram = cached.instagram || {};
  const context = instagram.context || {};
  const variants = _orderUniqueInstagramVariants(Array.isArray(instagram.variants) ? instagram.variants : []);
  const safeLabel = escapeHtml(platform.label);
  const contextRows = [
    ['자동 분류', context.articleType],
    ['핵심 주제', context.coreTopic],
    ['예상 독자', context.targetReader],
    ['독자 상황', context.readerSituation],
  ].filter((row) => row[1]);

  const tabs = variants.map((variant, idx) => {
    const score = Number(variant?.critique?.score || 0);
    const recommended = variant.recommended || score >= 95;
    const activeStyle = idx === 0
      ? 'background: linear-gradient(135deg, #e1306c, #f97316); color: white; border-color: rgba(255,255,255,0.2);'
      : 'background: rgba(255,255,255,0.05); color: #cbd5e1; border-color: rgba(148,163,184,0.14);';
    return `
      <button type="button" id="igVariantTab_${idx}" onclick="extTrafficShowInstagramVariant(${idx})"
        style="flex: 1; min-width: 120px; padding: 10px 12px; border: 1px solid; border-radius: 10px; font-size: 12px; font-weight: 800; cursor: pointer; ${activeStyle}">
        ${escapeHtml(variant.key || String.fromCharCode(65 + idx))}안 · ${escapeHtml(variant.label || '')}
        <span style="margin-left: 6px; font-size: 11px;">${score}점</span>
        ${recommended ? '<span style="margin-left: 6px;">추천</span>' : ''}
      </button>`;
  }).join('');

  return `
    <div style="margin-bottom: 14px; padding: 14px 16px; background: linear-gradient(135deg, rgba(225,48,108,0.16), rgba(249,115,22,0.10)); border: 1px solid rgba(225,48,108,0.38); border-radius: 12px;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: ${contextRows.length ? '12px' : '0'};">
        <div>
          <div style="color: #fdf2f8; font-size: 14px; font-weight: 900;">문맥 추론형 인스타그램 A/B/C 결과</div>
          <div style="color: #fbcfe8; font-size: 12px; margin-top: 3px;">최종 개선안만 복사되며, 후보/점수/비평은 게시문에 포함되지 않습니다.</div>
        </div>
        <button type="button" onclick="extTrafficGenerateOne('instagram')"
          style="padding: 9px 13px; background: rgba(255,255,255,0.12); color: #fff7ed; border: 1px solid rgba(255,255,255,0.22); border-radius: 9px; font-size: 12px; font-weight: 800; cursor: pointer;">
          인스타그램만 다시 생성
        </button>
      </div>
      ${contextRows.length ? `
        <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px;">
          ${contextRows.map(([label, value]) => `
            <div style="min-width:0;padding: 8px 10px; background: rgba(15,23,42,0.38); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;">
              <div style="color: #f9a8d4; font-size: 10px; font-weight: 900; margin-bottom: 4px; white-space: nowrap;">${escapeHtml(label)}</div>
              <div title="${escapeHtml(value)}" style="color: #f8fafc; font-size: 12px; line-height: 1.35; max-height: 32px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${escapeHtml(value)}</div>
            </div>`).join('')}
        </div>` : ''}
    </div>

    <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px;">
      ${tabs}
    </div>

    <div id="instagramVariantPanels">
      ${variants.map((variant, idx) => _renderInstagramVariantPanel(variant, idx, cached.sourceUrl || _getExtTrafficSourceUrl())).join('')}
    </div>

    ${_renderPreviewSimulation(platform.id, cached.formatted || {})}
    ${_renderFeedbackRow(platform.id, cached.risk?.score || 0, cached.risk?.band || 'low')}
    <div style="display: flex; gap: 10px; margin-top: 14px;">
      <button type="button" onclick="extTrafficOpenPlatform('instagram')"
        style="flex: 1; padding: 13px 18px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 14px rgba(99,102,241,0.35);">
        🔗 ${safeLabel} 바로가기
      </button>
    </div>
  `;
}

function _renderInstagramVariantPanel(variant, idx, sourceUrl = '') {
  const score = Number(variant?.critique?.score || 0);
  const firstLineScore = Number(variant?.firstLineScore || 0);
  const recommended = variant.recommended || score >= 95;
  const passed = variant.passed || score >= 90;
  const display = idx === 0 ? 'block' : 'none';
  const finalCopy = _getInstagramVariantCopy(variant, sourceUrl);
  const copyId = `instagramFinalCopy_${idx}`;
  const badgeBg = recommended
    ? 'linear-gradient(135deg, rgba(16,185,129,0.24), rgba(34,197,94,0.16))'
    : passed
      ? 'linear-gradient(135deg, rgba(59,130,246,0.22), rgba(99,102,241,0.14))'
      : 'linear-gradient(135deg, rgba(251,191,36,0.18), rgba(245,158,11,0.12))';
  const badgeColor = recommended ? '#86efac' : passed ? '#93c5fd' : '#fbbf24';

  return `
    <section id="igVariantPanel_${idx}" style="display: ${display}; padding: 16px; background: rgba(15,23,42,0.55); border: 1px solid rgba(148,163,184,0.12); border-radius: 12px;">
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <h3 style="margin: 0; color: #f8fafc; font-size: 17px; font-weight: 900;">${escapeHtml(variant.key || '')}안 · ${escapeHtml(variant.label || '')}</h3>
            <span style="padding: 4px 9px; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid rgba(255,255,255,0.12); border-radius: 999px; font-size: 11px; font-weight: 900;">
              ${score}점${recommended ? ' · 추천' : passed ? ' · 최종 개선안' : ' · 개선 필요'}
            </span>
          </div>
          <div style="color: #94a3b8; font-size: 12px; margin-top: 5px;">
            ${escapeHtml(variant.articleType || '')} · ${escapeHtml(variant.tone || '')} · ${escapeHtml(variant.hookEngine || '')}
          </div>
        </div>
        <button type="button" onclick="extTrafficCopyInstagramFinal(${idx})"
          style="padding: 10px 14px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 9px; font-size: 12px; font-weight: 900; cursor: pointer;">
          📋 최종 개선안 복사
        </button>
      </div>

      ${_renderInstagramInfoGrid(variant)}

      <details style="margin: 12px 0; background: rgba(2,6,23,0.32); border: 1px solid rgba(148,163,184,0.1); border-radius: 10px; padding: 10px 12px;">
        <summary style="cursor: pointer; color: #cbd5e1; font-size: 12px; font-weight: 800;">첫 줄 후보 10개 보기 · 선택 점수 ${firstLineScore}점</summary>
        ${_renderInstagramCandidates(variant.firstLineCandidates || [], variant.selectedFirstLine)}
      </details>

      <div style="margin-top: 12px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px;">
          <label style="color: #cbd5e1; font-size: 12px; font-weight: 900;">최종 개선안</label>
          <span style="color: #64748b; font-size: 11px;">복사본 글자수: ${finalCopy.length}</span>
        </div>
        <textarea id="${copyId}" readonly
          style="width: 100%; min-height: 260px; padding: 15px 16px; background: rgba(2,6,23,0.62); border: 1px solid rgba(148,163,184,0.16); border-radius: 11px; color: #e2e8f0; font-size: 14px; line-height: 1.7; font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; resize: vertical; box-sizing: border-box; white-space: pre-wrap;">${escapeHtml(finalCopy)}</textarea>
      </div>

      ${_renderInstagramCritique(variant)}
    </section>`;
}

function _renderInstagramInfoGrid(variant) {
  const rows = [
    ['예상 독자', variant.targetReader],
    ['주요 목표', variant.goal],
    ['선택된 첫 줄', variant.selectedFirstLine],
    ['선택 이유', variant.selectedReason],
    ['예상 클릭 강도', variant.expectedClickStrength],
  ].filter((row) => row[1]);
  if (!rows.length) return '';
  return `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin-bottom: 12px;">
      ${rows.map(([label, value]) => `
        <div style="padding: 10px 11px; background: rgba(30,41,59,0.55); border: 1px solid rgba(148,163,184,0.1); border-radius: 9px;">
          <div style="color: #94a3b8; font-size: 10px; font-weight: 900; margin-bottom: 4px;">${escapeHtml(label)}</div>
          <div style="color: #e2e8f0; font-size: 12px; line-height: 1.45;">${escapeHtml(value)}</div>
        </div>`).join('')}
    </div>`;
}

function _renderInstagramCandidates(candidates, selectedFirstLine) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return `<div style="color: #64748b; font-size: 12px; margin-top: 8px;">후보 데이터가 없습니다.</div>`;
  }
  return `
    <ol style="margin: 10px 0 0; padding-left: 20px; color: #cbd5e1; font-size: 12px; line-height: 1.65;">
      ${candidates.map((candidate) => {
        const isSelected = candidate.text === selectedFirstLine;
        return `<li style="margin-bottom: 5px; ${isSelected ? 'color: #86efac; font-weight: 900;' : ''}">
          ${escapeHtml(candidate.text || '')}
          <span style="color: ${isSelected ? '#86efac' : '#94a3b8'}; font-size: 11px;"> · ${Number(candidate.score || 0)}점${isSelected ? ' · 선택' : ''}</span>
        </li>`;
      }).join('')}
    </ol>`;
}

function _renderInstagramCritique(variant) {
  const critique = variant.critique || {};
  const breakdown = critique.breakdown || {};
  const common = variant.commonReview || {};
  const commonViolations = common.violations || critique.commonViolations || [];
  const commonRows = Object.entries(common.breakdown || critique.commonBreakdown || {}).map(([key, value]) => `
    <span style="display: inline-block; margin: 3px 4px 0 0; padding: 4px 7px; background: rgba(16,185,129,0.10); border: 1px solid rgba(16,185,129,0.16); border-radius: 7px; color: #bbf7d0; font-size: 11px;">
      ${escapeHtml(key)} ${escapeHtml(value)}
    </span>`).join('');
  const violationRows = commonViolations.length
    ? `<div style="margin-top: 8px; color: #fbbf24; font-size: 12px; line-height: 1.6;">${commonViolations.map((item) => `- ${escapeHtml(item)}`).join('<br>')}</div>`
    : '';
  const breakdownRows = Object.entries(breakdown).map(([key, value]) => `
    <span style="display: inline-block; margin: 3px 4px 0 0; padding: 4px 7px; background: rgba(148,163,184,0.10); border: 1px solid rgba(148,163,184,0.12); border-radius: 7px; color: #cbd5e1; font-size: 11px;">
      ${escapeHtml(key)} ${escapeHtml(value)}
    </span>`).join('');
  return `
    <details style="margin-top: 12px; background: rgba(2,6,23,0.32); border: 1px solid rgba(148,163,184,0.1); border-radius: 10px; padding: 10px 12px;">
      <summary style="cursor: pointer; color: #cbd5e1; font-size: 12px; font-weight: 800;">자체 비평 접기/펼치기 · ${Number(critique.score || 0)}점${common.score ? ` · 공통 ${Number(common.score)}점` : ''}</summary>
      <div style="margin-top: 9px; color: #94a3b8; font-size: 12px; line-height: 1.6;">${escapeHtml(critique.notes || '비평 메모 없음')}</div>
      ${breakdownRows ? `<div style="margin-top: 8px;">${breakdownRows}</div>` : ''}
      ${commonRows ? `<div style="margin-top: 8px;">${commonRows}</div>` : ''}
      ${violationRows}
    </details>`;
}

function _getInstagramVariantCopy(variant, sourceUrl = _getExtTrafficSourceUrl()) {
  if (!variant) return '';
  const finalRevision = variant.finalRevision || {};
  const hashtags = Array.isArray(finalRevision.hashtags)
    ? finalRevision.hashtags
    : (Array.isArray(variant.hashtags) ? variant.hashtags : []);
  const copy = [
    finalRevision.firstLine || variant.selectedFirstLine,
    finalRevision.body || variant.body,
    finalRevision.savePrompt || variant.savePrompt,
    finalRevision.sharePrompt || variant.sharePrompt,
    finalRevision.commentPrompt || variant.commentPrompt,
    finalRevision.linkPrompt || variant.linkPrompt,
    hashtags.join(' '),
  ].filter(Boolean).join('\n\n').trim();
  return _appendExtTrafficSourceUrl(copy, sourceUrl);
}

function _renderThreadsResultCard(platform, cached) {
  const threads = cached.threads || {};
  const context = threads.context || {};
  const variants = _orderUniqueThreadsVariants(Array.isArray(threads.variants) ? threads.variants : []);
  const safeLabel = escapeHtml(platform.label);
  const contextRows = [
    ['자동분류', context.articleType],
    ['핵심주제', context.coreTopic],
    ['예상 독자', context.targetReader],
    ['독자 상황', context.readerSituation],
  ].filter((row) => row[1]);

  const tabs = variants.map((variant, idx) => {
    const score = Number(variant?.critique?.score || 0);
    const activeStyle = idx === 0
      ? 'background: #f8fafc; color: #020617; border-color: rgba(255,255,255,0.35);'
      : 'background: rgba(255,255,255,0.05); color: #cbd5e1; border-color: rgba(148,163,184,0.16);';
    return `
      <button type="button" id="threadsVariantTab_${idx}" onclick="extTrafficShowThreadsVariant(${idx})"
        style="flex: 1; min-width: 120px; padding: 10px 12px; border: 1px solid; border-radius: 10px; font-size: 12px; font-weight: 900; cursor: pointer; ${activeStyle}">
        ${escapeHtml(variant.key || String.fromCharCode(65 + idx))}안 · ${escapeHtml(variant.label || '')}
        ${score ? `<span style="margin-left: 6px; font-size: 11px;">${score}점</span>` : ''}
      </button>`;
  }).join('');

  return `
    <div style="margin-bottom: 14px; padding: 14px 16px; background: linear-gradient(135deg, rgba(15,23,42,0.94), rgba(30,41,59,0.84)); border: 1px solid rgba(248,250,252,0.18); border-radius: 12px;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: ${contextRows.length ? '12px' : '0'};">
        <div>
          <div style="color: #f8fafc; font-size: 14px; font-weight: 900;">Threads A/B/C 결과</div>
          <div style="color: #94a3b8; font-size: 12px; margin-top: 3px;">최종 글만 복사됩니다. 후보, 점수, JSON은 게시문에 포함되지 않습니다.</div>
        </div>
        <button type="button" onclick="extTrafficGenerateOne('threads')"
          style="padding: 9px 13px; background: rgba(255,255,255,0.10); color: #f8fafc; border: 1px solid rgba(255,255,255,0.22); border-radius: 9px; font-size: 12px; font-weight: 800; cursor: pointer;">
          Threads만 다시 생성
        </button>
      </div>
      ${contextRows.length ? `
        <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px;">
          ${contextRows.map(([label, value]) => `
            <div style="min-width:0;padding: 8px 10px; background: rgba(2,6,23,0.42); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;">
              <div style="color: #cbd5e1; font-size: 10px; font-weight: 900; margin-bottom: 4px; white-space: nowrap;">${escapeHtml(label)}</div>
              <div title="${escapeHtml(value)}" style="color: #f8fafc; font-size: 12px; line-height: 1.35; max-height: 32px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${escapeHtml(value)}</div>
            </div>`).join('')}
        </div>` : ''}
    </div>

    <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px;">
      ${tabs}
    </div>

    <div id="threadsVariantPanels">
      ${variants.map((variant, idx) => _renderThreadsVariantPanel(variant, idx, cached.sourceUrl || _getExtTrafficSourceUrl())).join('')}
    </div>

    ${_renderPreviewSimulation(platform.id, cached.formatted || {})}
    ${_renderFeedbackRow(platform.id, cached.risk?.score || 0, cached.risk?.band || 'low')}
    <div style="display: flex; gap: 10px; margin-top: 14px;">
      <button type="button" onclick="extTrafficOpenPlatform('threads')"
        style="flex: 1; padding: 13px 18px; background: linear-gradient(135deg, #111827, #334155); color: white; border: 1px solid rgba(255,255,255,0.14); border-radius: 10px; font-size: 14px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 14px rgba(15,23,42,0.45);">
        ${safeLabel} 바로가기
      </button>
    </div>
  `;
}

function _renderThreadsVariantPanel(variant, idx, sourceUrl = '') {
  const score = Number(variant?.critique?.score || 0);
  const display = idx === 0 ? 'block' : 'none';
  const finalCopy = _getThreadsVariantCopy(variant, sourceUrl);
  const copyId = `threadsFinalCopy_${idx}`;
  const metaRows = [
    ['선택 첫 줄', variant.selectedFirstLine],
    ['목표', variant.goal],
    ['훅', variant.hookEngine],
  ].filter((row) => row[1]);
  return `
    <section id="threadsVariantPanel_${idx}" style="display: ${display}; padding: 16px; background: rgba(15,23,42,0.55); border: 1px solid rgba(148,163,184,0.12); border-radius: 12px;">
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <h3 style="margin: 0; color: #f8fafc; font-size: 17px; font-weight: 900;">${escapeHtml(variant.key || '')}안 · ${escapeHtml(variant.label || '')}</h3>
            ${score ? `<span style="padding: 4px 9px; background: rgba(248,250,252,0.10); color: #e2e8f0; border: 1px solid rgba(255,255,255,0.12); border-radius: 999px; font-size: 11px; font-weight: 900;">${score}점</span>` : ''}
          </div>
          <div style="color: #94a3b8; font-size: 12px; margin-top: 5px;">${escapeHtml(variant.tone || 'Threads 대화체')}</div>
        </div>
        <button type="button" onclick="extTrafficCopyThreadsFinal(${idx})"
          style="padding: 10px 14px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 9px; font-size: 12px; font-weight: 900; cursor: pointer;">
          최종 글 복사
        </button>
      </div>

      ${metaRows.length ? `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin-bottom: 12px;">
          ${metaRows.map(([label, value]) => `
            <div style="padding: 10px 11px; background: rgba(30,41,59,0.55); border: 1px solid rgba(148,163,184,0.1); border-radius: 9px;">
              <div style="color: #94a3b8; font-size: 10px; font-weight: 900; margin-bottom: 4px;">${escapeHtml(label)}</div>
              <div style="color: #e2e8f0; font-size: 12px; line-height: 1.45;">${escapeHtml(value)}</div>
            </div>`).join('')}
        </div>` : ''}

      <div style="margin-top: 12px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px;">
          <label style="color: #cbd5e1; font-size: 12px; font-weight: 900;">최종 게시문</label>
          <span style="color: #64748b; font-size: 11px;">글자수: ${finalCopy.length}</span>
        </div>
        <textarea id="${copyId}" readonly
          style="width: 100%; min-height: 220px; padding: 15px 16px; background: rgba(2,6,23,0.62); border: 1px solid rgba(148,163,184,0.16); border-radius: 11px; color: #e2e8f0; font-size: 14px; line-height: 1.7; font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; resize: vertical; box-sizing: border-box; white-space: pre-wrap;">${escapeHtml(finalCopy)}</textarea>
      </div>
      ${_renderStructuredCritique(variant)}
    </section>`;
}

function _getThreadsVariantCopy(variant, sourceUrl = _getExtTrafficSourceUrl()) {
  if (!variant) return '';
  const finalRevision = variant.finalRevision || {};
  const copy = [
    finalRevision.firstLine || variant.selectedFirstLine,
    finalRevision.body || variant.body,
    finalRevision.commentPrompt || variant.commentPrompt,
    finalRevision.sharePrompt || variant.sharePrompt,
    finalRevision.linkPrompt || variant.linkPrompt,
  ]
    .filter(Boolean)
    .join('\n\n')
    .replace(/<THREADS_RESULT_JSON>|<\/THREADS_RESULT_JSON>/g, '')
    .replace(/```(?:json)?|```/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return _appendExtTrafficSourceUrl(copy, sourceUrl);
}

function _renderNaverBlogResultCard(platform, cached) {
  const naverBlog = cached.naverBlog || {};
  const context = naverBlog.context || {};
  const variants = _orderUniqueNaverBlogVariants(Array.isArray(naverBlog.variants) ? naverBlog.variants : []);
  const safeLabel = escapeHtml(platform.label);
  const contextRows = [
    ['자동 분류', context.articleType],
    ['핵심 키워드', context.primaryKeyword],
    ['보조 키워드', Array.isArray(context.secondaryKeywords) ? context.secondaryKeywords.join(', ') : context.secondaryKeywords],
    ['검색 의도', Array.isArray(context.searchTerms) ? context.searchTerms.slice(0, 3).join(', ') : context.readerQuestion],
  ].filter((row) => row[1]);

  const tabs = variants.map((variant, idx) => {
    const score = Number(variant?.critique?.score || 0);
    const titleScore = Number(variant?.titleScore || 0);
    const recommended = variant.recommended || score >= 95;
    const activeStyle = idx === 0
      ? 'background: linear-gradient(135deg, #03c75a, #14b8a6); color: white; border-color: rgba(255,255,255,0.24);'
      : 'background: rgba(255,255,255,0.05); color: #cbd5e1; border-color: rgba(148,163,184,0.16);';
    return `
      <button type="button" id="naverBlogVariantTab_${idx}" onclick="extTrafficShowNaverBlogVariant(${idx})"
        style="flex: 1; min-width: 130px; padding: 10px 12px; border: 1px solid; border-radius: 10px; font-size: 12px; font-weight: 900; cursor: pointer; ${activeStyle}">
        ${escapeHtml(variant.key || String.fromCharCode(65 + idx))}안 · ${escapeHtml(variant.label || '')}
        <span style="margin-left: 6px; font-size: 11px;">제목 ${titleScore}점</span>
        ${recommended ? '<span style="margin-left: 6px;">추천</span>' : score ? `<span style="margin-left: 6px;">${score}점</span>` : ''}
      </button>`;
  }).join('');

  return `
    <div style="margin-bottom: 14px; padding: 14px 16px; background: linear-gradient(135deg, rgba(3,199,90,0.15), rgba(20,184,166,0.09)); border: 1px solid rgba(3,199,90,0.36); border-radius: 12px;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: ${contextRows.length ? '12px' : '0'};">
        <div>
          <div style="color: #ecfdf5; font-size: 14px; font-weight: 900;">네이버 블로그 A/B/C 검색형 미니 포스트</div>
          <div style="color: #a7f3d0; font-size: 12px; margin-top: 3px;">제목 후보와 점수는 검토용입니다. 복사 버튼은 최종 개선안만 복사합니다.</div>
        </div>
        <button type="button" onclick="extTrafficGenerateOne('naver-blog')"
          style="padding: 9px 13px; background: rgba(255,255,255,0.12); color: #f0fdf4; border: 1px solid rgba(255,255,255,0.22); border-radius: 9px; font-size: 12px; font-weight: 800; cursor: pointer;">
          네이버 블로그만 다시 생성
        </button>
      </div>
      ${contextRows.length ? `
        <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px;">
          ${contextRows.map(([label, value]) => `
            <div style="min-width:0;padding: 8px 10px; background: rgba(15,23,42,0.36); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;">
              <div style="color: #86efac; font-size: 10px; font-weight: 900; margin-bottom: 4px; white-space: nowrap;">${escapeHtml(label)}</div>
              <div title="${escapeHtml(value)}" style="color: #f8fafc; font-size: 12px; line-height: 1.35; max-height: 32px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${escapeHtml(value)}</div>
            </div>`).join('')}
        </div>` : ''}
    </div>

    <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px;">
      ${tabs}
    </div>

    <div id="naverBlogVariantPanels">
      ${variants.map((variant, idx) => _renderNaverBlogVariantPanel(variant, idx, cached.sourceUrl || _getExtTrafficSourceUrl())).join('')}
    </div>

    ${_renderPreviewSimulation(platform.id, cached.formatted || {})}
    ${_renderFeedbackRow(platform.id, cached.risk?.score || 0, cached.risk?.band || 'low')}
    <div style="display: flex; gap: 10px; margin-top: 14px;">
      <button type="button" onclick="extTrafficOpenPlatform('naver-blog')"
        style="flex: 1; padding: 13px 18px; background: linear-gradient(135deg, #03c75a, #059669); color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 14px rgba(3,199,90,0.28);">
        ${safeLabel} 바로가기
      </button>
    </div>
  `;
}

function _renderNaverBlogVariantPanel(variant, idx, sourceUrl = '') {
  const score = Number(variant?.critique?.score || 0);
  const titleScore = Number(variant?.titleScore || 0);
  const display = idx === 0 ? 'block' : 'none';
  const finalCopy = _getNaverBlogVariantCopy(variant, sourceUrl);
  const copyId = `naverBlogFinalCopy_${idx}`;
  const metaRows = [
    ['선택 제목', variant.selectedTitle || variant.finalRevision?.title],
    ['제목 점수', titleScore ? `${titleScore}점` : ''],
    ['선택 이유', variant.selectedReason],
    ['예상 클릭 강도', variant.expectedClickStrength],
  ].filter((row) => row[1]);
  const badgeBg = variant.recommended || score >= 95
    ? 'linear-gradient(135deg, rgba(16,185,129,0.24), rgba(34,197,94,0.16))'
    : score >= 90
      ? 'linear-gradient(135deg, rgba(59,130,246,0.22), rgba(99,102,241,0.14))'
      : 'linear-gradient(135deg, rgba(251,191,36,0.18), rgba(245,158,11,0.12))';
  const badgeColor = variant.recommended || score >= 95 ? '#86efac' : score >= 90 ? '#93c5fd' : '#fbbf24';

  return `
    <section id="naverBlogVariantPanel_${idx}" style="display: ${display}; padding: 16px; background: rgba(15,23,42,0.55); border: 1px solid rgba(148,163,184,0.12); border-radius: 12px;">
      <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <h3 style="margin: 0; color: #f8fafc; font-size: 17px; font-weight: 900;">${escapeHtml(variant.key || '')}안 · ${escapeHtml(variant.label || '')}</h3>
            ${score ? `<span style="padding: 4px 9px; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid rgba(255,255,255,0.12); border-radius: 999px; font-size: 11px; font-weight: 900;">${score}점${variant.recommended || score >= 95 ? ' · 추천' : ''}</span>` : ''}
          </div>
          <div style="color: #94a3b8; font-size: 12px; margin-top: 5px;">
            ${escapeHtml(variant.articleType || '')} · ${escapeHtml(variant.primaryKeyword || '')}
          </div>
        </div>
        <button type="button" onclick="extTrafficCopyNaverBlogFinal(${idx})"
          style="padding: 10px 14px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 9px; font-size: 12px; font-weight: 900; cursor: pointer;">
          최종 개선안 복사
        </button>
      </div>

      ${metaRows.length ? `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin-bottom: 12px;">
          ${metaRows.map(([label, value]) => `
            <div style="padding: 10px 11px; background: rgba(30,41,59,0.55); border: 1px solid rgba(148,163,184,0.1); border-radius: 9px;">
              <div style="color: #94a3b8; font-size: 10px; font-weight: 900; margin-bottom: 4px;">${escapeHtml(label)}</div>
              <div style="color: #e2e8f0; font-size: 12px; line-height: 1.45;">${escapeHtml(value)}</div>
            </div>`).join('')}
        </div>` : ''}

      <details style="margin: 12px 0; background: rgba(2,6,23,0.32); border: 1px solid rgba(148,163,184,0.1); border-radius: 10px; padding: 10px 12px;">
        <summary style="cursor: pointer; color: #cbd5e1; font-size: 12px; font-weight: 800;">제목 후보 10개 보기 · 선택 제목 ${titleScore}점</summary>
        ${_renderNaverBlogTitleCandidates(variant.titleCandidates || [], variant.selectedTitle || variant.finalRevision?.title)}
      </details>

      <div style="margin-top: 12px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px;">
          <label style="color: #cbd5e1; font-size: 12px; font-weight: 900;">최종 개선안</label>
          <span style="color: #64748b; font-size: 11px;">복사본 글자수: ${finalCopy.length}</span>
        </div>
        <textarea id="${copyId}" readonly
          style="width: 100%; min-height: 360px; padding: 15px 16px; background: rgba(2,6,23,0.62); border: 1px solid rgba(148,163,184,0.16); border-radius: 11px; color: #e2e8f0; font-size: 14px; line-height: 1.75; font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; resize: vertical; box-sizing: border-box; white-space: pre-wrap;">${escapeHtml(finalCopy)}</textarea>
      </div>

      ${_renderNaverBlogCritique(variant)}
    </section>`;
}

function _renderNaverBlogTitleCandidates(candidates, selectedTitle) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return `<div style="color: #64748b; font-size: 12px; margin-top: 8px;">제목 후보 데이터가 없습니다.</div>`;
  }
  return `
    <ol style="margin: 10px 0 0; padding-left: 20px; color: #cbd5e1; font-size: 12px; line-height: 1.65;">
      ${candidates.map((candidate) => {
        const isSelected = candidate.text === selectedTitle;
        return `<li style="margin-bottom: 5px; ${isSelected ? 'color: #86efac; font-weight: 900;' : ''}">
          ${escapeHtml(candidate.text || '')}
          <span style="color: ${isSelected ? '#86efac' : '#94a3b8'}; font-size: 11px;"> · ${Number(candidate.score || 0)}점${isSelected ? ' · 선택' : ''}</span>
        </li>`;
      }).join('')}
    </ol>`;
}

function _renderNaverBlogCritique(variant) {
  const critique = variant.critique || {};
  const breakdown = critique.breakdown || {};
  const common = variant.commonReview || {};
  const commonViolations = common.violations || critique.commonViolations || [];
  const commonRows = Object.entries(common.breakdown || critique.commonBreakdown || {}).map(([key, value]) => `
    <span style="display: inline-block; margin: 3px 4px 0 0; padding: 4px 7px; background: rgba(16,185,129,0.10); border: 1px solid rgba(16,185,129,0.16); border-radius: 7px; color: #bbf7d0; font-size: 11px;">
      ${escapeHtml(key)} ${escapeHtml(value)}
    </span>`).join('');
  const violationRows = commonViolations.length
    ? `<div style="margin-top: 8px; color: #fbbf24; font-size: 12px; line-height: 1.6;">${commonViolations.map((item) => `- ${escapeHtml(item)}`).join('<br>')}</div>`
    : '';
  const breakdownRows = Object.entries(breakdown).map(([key, value]) => `
    <span style="display: inline-block; margin: 3px 4px 0 0; padding: 4px 7px; background: rgba(148,163,184,0.10); border: 1px solid rgba(148,163,184,0.12); border-radius: 7px; color: #cbd5e1; font-size: 11px;">
      ${escapeHtml(key)} ${escapeHtml(value)}
    </span>`).join('');
  return `
    <details style="margin-top: 12px; background: rgba(2,6,23,0.32); border: 1px solid rgba(148,163,184,0.1); border-radius: 10px; padding: 10px 12px;">
      <summary style="cursor: pointer; color: #cbd5e1; font-size: 12px; font-weight: 800;">자체 비평 접기/펼치기 · ${Number(critique.score || 0)}점${common.score ? ` · 공통 ${Number(common.score)}점` : ''}</summary>
      <div style="margin-top: 9px; color: #94a3b8; font-size: 12px; line-height: 1.6;">${escapeHtml(critique.notes || '비평 메모 없음')}</div>
      ${breakdownRows ? `<div style="margin-top: 8px;">${breakdownRows}</div>` : ''}
      ${commonRows ? `<div style="margin-top: 8px;">${commonRows}</div>` : ''}
      ${violationRows}
    </details>`;
}

function _getNaverBlogVariantCopy(variant, sourceUrl = _getExtTrafficSourceUrl()) {
  if (!variant) return '';
  const finalRevision = variant.finalRevision || {};
  const sections = Array.isArray(finalRevision.sections) && finalRevision.sections.length
    ? finalRevision.sections
    : (Array.isArray(variant.sections) ? variant.sections : []);
  const hashtags = Array.isArray(finalRevision.hashtags)
    ? finalRevision.hashtags
    : (Array.isArray(variant.hashtags) ? variant.hashtags : []);
  const copy = [
    finalRevision.title || variant.selectedTitle,
    finalRevision.intro || variant.intro,
    ...sections.flatMap((section) => [section.heading, section.body]),
    finalRevision.sourceLead || variant.sourceLead,
    finalRevision.commentPrompt || variant.commentPrompt,
    hashtags.join(' '),
  ]
    .filter(Boolean)
    .join('\n\n')
    .replace(/<NAVER_BLOG_RESULT_JSON>|<\/NAVER_BLOG_RESULT_JSON>/g, '')
    .replace(/```(?:json)?|```/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return _appendExtTrafficSourceUrl(copy, sourceUrl);
}

function _getExtTrafficSourceUrl() {
  return String(_selectedSource?.url || '').trim();
}

function _appendExtTrafficSourceUrl(text, sourceUrl = _getExtTrafficSourceUrl()) {
  const body = String(text || '').trim();
  const url = String(sourceUrl || '').trim();
  if (!body || !url) return body;
  if (body.includes(url)) return body;
  return `${body}\n\n${url}`;
}

const EXT_STRUCTURED_PLATFORM_UI = {
  'naver-cafe': {
    extraKey: 'naverCafe',
    title: '네이버 카페 A/B/C 결과',
    accent: '#03c75a',
    candidateKey: 'titleCandidates',
    selectedKey: 'selectedTitle',
    scoreKey: 'titleScore',
    candidateLabel: '제목 후보',
    copyLabel: '최종 카페 글',
    copyFields: ['title', 'body', 'commentPrompt', { key: 'linkPrompt', appendSourceUrl: true }, { key: 'hashtags', style: 'inline' }],
    appendSourceUrl: false,
  },
  x: {
    extraKey: 'x',
    title: 'X A/B/C 결과',
    accent: '#1da1f2',
    candidateKey: 'firstLineCandidates',
    selectedKey: 'selectedFirstLine',
    scoreKey: 'firstLineScore',
    candidateLabel: '첫 문장 후보',
    copyLabel: '최종 X 글',
    copyFields: ['firstLine', 'body', 'quotePrompt', 'repostPrompt', { key: 'linkPrompt', appendSourceUrl: true }, { key: 'hashtags', style: 'inline' }],
    appendSourceUrl: false,
  },
  facebook: {
    extraKey: 'facebook',
    title: 'Facebook A/B/C 결과',
    accent: '#1877f2',
    candidateKey: 'firstLineCandidates',
    selectedKey: 'selectedFirstLine',
    scoreKey: 'firstLineScore',
    candidateLabel: '첫 문장 후보',
    copyLabel: '최종 Facebook 글',
    copyFields: ['firstLine', 'body', 'sharePrompt', 'commentPrompt', { key: 'linkPrompt', appendSourceUrl: true }, { key: 'hashtags', style: 'inline' }],
    appendSourceUrl: false,
  },
  'kakao-openchat': {
    extraKey: 'kakaoOpenChat',
    title: '카카오 오픈채팅 A/B/C 결과',
    accent: '#fee500',
    candidateKey: 'firstLineCandidates',
    selectedKey: 'selectedFirstLine',
    scoreKey: 'firstLineScore',
    candidateLabel: '첫 줄 후보',
    copyLabel: '최종 오픈채팅 글',
    copyFields: ['firstLine', 'body', 'entryPrompt', { key: 'linkPrompt', appendSourceUrl: true }],
    appendSourceUrl: false,
  },
  'youtube-shorts': {
    extraKey: 'youtubeShorts',
    title: '유튜브 쇼츠 A/B/C 결과',
    accent: '#ff0000',
    candidateKey: 'first3SecCandidates',
    selectedKey: 'first3SecHook',
    scoreKey: 'hookScore',
    candidateLabel: '첫 3초 훅 후보',
    copyLabel: '최종 쇼츠 스크립트',
    copyFields: ['videoTitle', 'first3SecHook', 'bodyScript', { key: 'onScreenCaptions', numbered: true }, 'commentPrompt', { key: 'pinnedComment', appendSourceUrl: true }, { key: 'description', appendSourceUrl: true }, { key: 'hashtags', style: 'inline' }],
    appendSourceUrl: false,
  },
  tiktok: {
    extraKey: 'tiktok',
    title: '틱톡 A/B/C 결과',
    accent: '#ff0050',
    candidateKey: 'first2SecCandidates',
    selectedKey: 'first2SecHook',
    scoreKey: 'hookScore',
    candidateLabel: '첫 2초 훅 후보',
    copyLabel: '최종 틱톡 스크립트',
    copyFields: ['videoTitle', 'first2SecHook', 'bodyScript', { key: 'cutCaptions', numbered: true }, 'commentPrompt', 'savePrompt', { key: 'profileLinkPrompt', appendSourceUrl: true }, { key: 'hashtags', style: 'inline' }],
    appendSourceUrl: false,
  },
  pinterest: {
    extraKey: 'pinterest',
    title: 'Pinterest A/B/C 결과',
    accent: '#e60023',
    candidateKey: 'titleCandidates',
    selectedKey: 'pinTitle',
    scoreKey: 'titleScore',
    candidateLabel: '핀 제목 후보',
    copyLabel: '최종 Pinterest 핀',
    copyFields: ['pinTitle', { key: 'pinDescription', appendSourceUrl: true }, { key: 'imageTextLines', numbered: true }, 'imageDesignDirection', { key: 'blogLead', appendSourceUrl: true }, { key: 'keywordTags', style: 'inline' }],
    appendSourceUrl: false,
  },
};

function _structuredDomKey(platformId) {
  return String(platformId || '').replace(/[^a-z0-9]/gi, '_');
}

function _getStructuredPlatformConfig(platformId) {
  return EXT_STRUCTURED_PLATFORM_UI[platformId] || null;
}

function _getStructuredPlatformPayload(platform, cached) {
  const cfg = _getStructuredPlatformConfig(platform.id);
  if (!cfg || !cached) return null;
  const payload = cached[cfg.extraKey];
  if (!payload || !Array.isArray(payload.variants) || payload.variants.length === 0) return null;
  return payload;
}

function _getStructuredField(variant, key) {
  if (!variant || !key) return '';
  const finalRevision = variant.finalRevision || {};
  if (finalRevision[key] != null && finalRevision[key] !== '') return finalRevision[key];
  if (variant[key] != null && variant[key] !== '') return variant[key];
  if (key === 'title') return finalRevision.title || variant.selectedTitle || variant.pinTitle || variant.videoTitle || '';
  if (key === 'firstLine') return finalRevision.firstLine || variant.selectedFirstLine || '';
  return '';
}

function _formatStructuredField(field, variant, sourceUrl) {
  const spec = typeof field === 'string' ? { key: field } : field;
  const key = spec.key;
  let value = _getStructuredField(variant, key);
  if (Array.isArray(value)) {
    if (key === 'hashtags' || key === 'keywordTags' || spec.style === 'inline') {
      return value.filter(Boolean).join(' ');
    }
    if (spec.numbered) {
      return value.filter(Boolean).map((item, idx) => `${idx + 1}. ${item}`).join('\n');
    }
    return value.filter(Boolean).join('\n');
  }
  if (key === 'sections' && Array.isArray(value)) {
    return value.flatMap((section) => [section.heading, section.body].filter(Boolean)).join('\n\n');
  }
  let text = String(value || '').trim();
  if (spec.appendSourceUrl) text = _appendExtTrafficSourceUrl(text, sourceUrl);
  return text;
}

function _getStructuredVariantCopy(platformId, variant, sourceUrl = _getExtTrafficSourceUrl()) {
  const cfg = _getStructuredPlatformConfig(platformId);
  if (!cfg || !variant) return '';
  let copy = (cfg.copyFields || [])
    .map((field) => _formatStructuredField(field, variant, sourceUrl))
    .filter(Boolean)
    .join('\n\n')
    .replace(/<[^>]+_RESULT_JSON>|<\/[^>]+_RESULT_JSON>/g, '')
    .replace(/```(?:json)?|```/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (cfg.appendSourceUrl) copy = _appendExtTrafficSourceUrl(copy, sourceUrl);
  return copy;
}

function _renderStructuredPlatformResultCard(platform, cached) {
  const cfg = _getStructuredPlatformConfig(platform.id);
  const payload = _getStructuredPlatformPayload(platform, cached);
  if (!cfg || !payload) return '';
  const context = payload.context || {};
  const variants = _orderStructuredVariants(payload.variants);
  if (!variants.length) return '';
  const safeLabel = escapeHtml(platform.label);
  const domKey = _structuredDomKey(platform.id);
  const contextRows = [
    ['자동분류', context.autoCategory || context.articleType],
    ['핵심주제', context.coreTopic || context.primaryKeyword],
    ['예상 독자', context.targetReader],
    ['독자 상황', context.readerSituation || context.readerQuestion],
  ].filter((row) => row[1]);
  const tabs = variants.map((variant, idx) => {
    const score = Number(variant?.critique?.score || variant?.score || 0);
    const activeStyle = idx === 0
      ? `background: linear-gradient(135deg, ${cfg.accent}, #8b5cf6); color: white; border-color: rgba(255,255,255,0.24);`
      : 'background: rgba(255,255,255,0.05); color: #cbd5e1; border-color: rgba(148,163,184,0.16);';
    return `
      <button type="button" id="${domKey}VariantTab_${idx}" onclick="extTrafficShowStructuredVariant('${platform.id}', ${idx})"
        style="flex:1;min-width:130px;padding:10px 12px;border:1px solid;border-radius:10px;font-size:12px;font-weight:900;cursor:pointer;${activeStyle}">
        ${escapeHtml(variant.key || String.fromCharCode(65 + idx))}안 · ${escapeHtml(variant.label || '')}
        ${score ? `<span style="margin-left:6px;font-size:11px;">${score}점</span>` : ''}
        ${variant.recommended ? '<span style="margin-left:6px;">추천</span>' : ''}
      </button>`;
  }).join('');

  return `
    <div style="margin-bottom:14px;padding:14px 16px;background:linear-gradient(135deg, ${cfg.accent}28, rgba(139,92,246,0.10));border:1px solid ${cfg.accent}66;border-radius:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:${contextRows.length ? '12px' : '0'};">
        <div>
          <div style="color:#f8fafc;font-size:14px;font-weight:900;">${escapeHtml(cfg.title)}</div>
          <div style="color:#cbd5e1;font-size:12px;margin-top:3px;">최종 개선안만 복사되며, 후보/점수/비평은 게시문에 포함되지 않습니다.</div>
        </div>
        <button type="button" onclick="extTrafficGenerateOne('${platform.id}')"
          style="padding:9px 13px;background:rgba(255,255,255,0.12);color:#f8fafc;border:1px solid rgba(255,255,255,0.22);border-radius:9px;font-size:12px;font-weight:800;cursor:pointer;">
          ${safeLabel}만 다시 생성
        </button>
      </div>
      ${contextRows.length ? `
        <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;">
          ${contextRows.map(([label, value]) => `
            <div style="min-width:0;padding:8px 10px;background:rgba(15,23,42,0.38);border:1px solid rgba(255,255,255,0.08);border-radius:8px;">
              <div style="color:${cfg.accent};font-size:10px;font-weight:900;margin-bottom:4px;white-space:nowrap;">${escapeHtml(label)}</div>
              <div title="${escapeHtml(value)}" style="color:#f8fafc;font-size:12px;line-height:1.35;max-height:34px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(value)}</div>
            </div>`).join('')}
        </div>` : ''}
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">${tabs}</div>
    <div id="${domKey}VariantPanels">
      ${variants.map((variant, idx) => _renderStructuredVariantPanel(platform, cfg, variant, idx, cached.sourceUrl || _getExtTrafficSourceUrl())).join('')}
    </div>
    ${_renderPreviewSimulation(platform.id, cached.formatted || {})}
    ${_renderFeedbackRow(platform.id, cached.risk?.score || 0, cached.risk?.band || 'low')}
    <div style="display:flex;gap:10px;margin-top:14px;">
      <button type="button" onclick="extTrafficOpenPlatform('${platform.id}')"
        style="flex:1;padding:13px 18px;background:linear-gradient(135deg, ${cfg.accent}, #6366f1);color:white;border:none;border-radius:10px;font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 4px 14px rgba(99,102,241,0.28);">
        ${safeLabel} 바로가기
      </button>
    </div>`;
}

function _renderStructuredVariantPanel(platform, cfg, variant, idx, sourceUrl = '') {
  const display = idx === 0 ? 'block' : 'none';
  const domKey = _structuredDomKey(platform.id);
  const finalCopy = _getStructuredVariantCopy(platform.id, variant, sourceUrl);
  const candidateScore = Number(variant?.[cfg.scoreKey] || 0);
  const selected = _getStructuredField(variant, cfg.selectedKey);
  const score = Number(variant?.critique?.score || variant?.score || 0);
  const metaRows = [
    [cfg.selectedKey && cfg.selectedKey.includes('Title') || cfg.selectedKey === 'pinTitle' ? '선택 제목' : '선택 문구', selected],
    ['후보 점수', candidateScore ? `${candidateScore}점` : ''],
    ['선택 이유', variant.selectedReason],
    ['목표', variant.goal],
    ['광고 위험', variant.adRiskLevel],
  ].filter((row) => row[1]);
  return `
    <section id="${domKey}VariantPanel_${idx}" style="display:${display};padding:16px;background:rgba(15,23,42,0.55);border:1px solid rgba(148,163,184,0.12);border-radius:12px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
        <div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <h3 style="margin:0;color:#f8fafc;font-size:17px;font-weight:900;">${escapeHtml(variant.key || '')}안 · ${escapeHtml(variant.label || '')}</h3>
            ${score ? `<span style="padding:4px 9px;background:rgba(16,185,129,0.16);color:#86efac;border:1px solid rgba(16,185,129,0.28);border-radius:999px;font-size:11px;font-weight:900;">${score}점${variant.recommended ? ' · 추천' : ''}</span>` : ''}
          </div>
          <div style="color:#94a3b8;font-size:12px;margin-top:5px;">${escapeHtml(variant.tone || variant.videoAngle || variant.searchIntent || '')}</div>
        </div>
        <button type="button" onclick="extTrafficCopyStructuredFinal('${platform.id}', ${idx})"
          style="padding:10px 14px;background:linear-gradient(135deg,#10b981,#059669);color:white;border:none;border-radius:9px;font-size:12px;font-weight:900;cursor:pointer;">
          최종 글 복사
        </button>
      </div>

      ${metaRows.length ? `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-bottom:12px;">
          ${metaRows.map(([label, value]) => `
            <div style="padding:10px 11px;background:rgba(30,41,59,0.55);border:1px solid rgba(148,163,184,0.1);border-radius:9px;">
              <div style="color:#94a3b8;font-size:10px;font-weight:900;margin-bottom:4px;">${escapeHtml(label)}</div>
              <div style="color:#e2e8f0;font-size:12px;line-height:1.45;">${escapeHtml(value)}</div>
            </div>`).join('')}
        </div>` : ''}

      <details style="margin:12px 0;background:rgba(2,6,23,0.32);border:1px solid rgba(148,163,184,0.1);border-radius:10px;padding:10px 12px;">
        <summary style="cursor:pointer;color:#cbd5e1;font-size:12px;font-weight:800;">${escapeHtml(cfg.candidateLabel)} 10개 보기${candidateScore ? ` · 선택 ${candidateScore}점` : ''}</summary>
        ${_renderStructuredCandidates(variant[cfg.candidateKey] || [], selected)}
      </details>

      <div style="margin-top:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;">
          <label style="color:#cbd5e1;font-size:12px;font-weight:900;">${escapeHtml(cfg.copyLabel)}</label>
          <span style="color:#64748b;font-size:11px;">글자수: ${finalCopy.length}</span>
        </div>
        <textarea id="${domKey}FinalCopy_${idx}" readonly
          style="width:100%;min-height:280px;padding:15px 16px;background:rgba(2,6,23,0.62);border:1px solid rgba(148,163,184,0.16);border-radius:11px;color:#e2e8f0;font-size:14px;line-height:1.7;font-family:'Noto Sans KR','Malgun Gothic',sans-serif;resize:vertical;box-sizing:border-box;white-space:pre-wrap;">${escapeHtml(finalCopy)}</textarea>
      </div>
      ${_renderStructuredCritique(variant)}
    </section>`;
}

function _renderStructuredCandidates(candidates, selected) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return `<div style="color:#64748b;font-size:12px;margin-top:8px;">후보 데이터가 없습니다.</div>`;
  }
  return `
    <ol style="margin:10px 0 0;padding-left:20px;color:#cbd5e1;font-size:12px;line-height:1.65;">
      ${candidates.slice(0, 10).map((candidate) => {
        const isSelected = candidate.text === selected || candidate.selected;
        return `<li style="margin-bottom:5px;${isSelected ? 'color:#86efac;font-weight:900;' : ''}">
          ${escapeHtml(candidate.text || '')}
          <span style="color:${isSelected ? '#86efac' : '#94a3b8'};font-size:11px;"> · ${Number(candidate.score || 0)}점${isSelected ? ' · 선택' : ''}</span>
        </li>`;
      }).join('')}
    </ol>`;
}

function _renderStructuredCritique(variant) {
  const critique = variant.critique || {};
  const breakdown = critique.breakdown || {};
  const common = variant.commonReview || {};
  const commonBreakdown = common.breakdown || critique.commonBreakdown || {};
  const commonViolations = common.violations || critique.commonViolations || [];
  const rows = Object.entries(breakdown).map(([key, value]) => `
    <span style="display:inline-block;margin:3px 4px 0 0;padding:4px 7px;background:rgba(148,163,184,0.10);border:1px solid rgba(148,163,184,0.12);border-radius:7px;color:#cbd5e1;font-size:11px;">
      ${escapeHtml(key)} ${escapeHtml(value)}
    </span>`).join('');
  const commonRows = Object.entries(commonBreakdown).map(([key, value]) => `
    <span style="display:inline-block;margin:3px 4px 0 0;padding:4px 7px;background:rgba(16,185,129,0.10);border:1px solid rgba(16,185,129,0.16);border-radius:7px;color:#bbf7d0;font-size:11px;">
      ${escapeHtml(key)} ${escapeHtml(value)}
    </span>`).join('');
  const violationRows = commonViolations.length
    ? `<div style="margin-top:8px;color:#fbbf24;font-size:12px;line-height:1.6;">${commonViolations.map((item) => `- ${escapeHtml(item)}`).join('<br>')}</div>`
    : '';
  return `
    <details style="margin-top:12px;background:rgba(2,6,23,0.32);border:1px solid rgba(148,163,184,0.1);border-radius:10px;padding:10px 12px;">
      <summary style="cursor:pointer;color:#cbd5e1;font-size:12px;font-weight:800;">비평/검수 · ${Number(critique.score || 0)}점${common.score ? ` · 공통 ${Number(common.score)}점` : ''}</summary>
      <div style="margin-top:9px;color:#94a3b8;font-size:12px;line-height:1.6;">${escapeHtml(critique.notes || '검수 메모 없음')}</div>
      ${rows ? `<div style="margin-top:8px;">${rows}</div>` : ''}
      ${commonRows ? `<div style="margin-top:8px;">${commonRows}</div>` : ''}
      ${violationRows}
    </details>`;
}

function _orderStructuredVariants(variants) {
  const order = { A: 0, B: 1, C: 2 };
  const seen = new Set();
  return (Array.isArray(variants) ? variants : [])
    .filter(Boolean)
    .sort((a, b) => (order[a.key] ?? 99) - (order[b.key] ?? 99))
    .filter((variant) => {
      const key = variant.key || '';
      if (key && seen.has(key)) return false;
      if (key) seen.add(key);
      return true;
    });
}

function extTrafficShowStructuredVariant(platformId, idx) {
  const domKey = _structuredDomKey(platformId);
  const cfg = _getStructuredPlatformConfig(platformId) || {};
  const panels = document.querySelectorAll(`[id^="${domKey}VariantPanel_"]`);
  const tabs = document.querySelectorAll(`[id^="${domKey}VariantTab_"]`);
  panels.forEach((panel, index) => {
    panel.style.display = index === idx ? 'block' : 'none';
  });
  tabs.forEach((tab, index) => {
    if (index === idx) {
      tab.style.background = `linear-gradient(135deg, ${cfg.accent || '#6366f1'}, #8b5cf6)`;
      tab.style.color = 'white';
      tab.style.borderColor = 'rgba(255,255,255,0.24)';
    } else {
      tab.style.background = 'rgba(255,255,255,0.05)';
      tab.style.color = '#cbd5e1';
      tab.style.borderColor = 'rgba(148,163,184,0.16)';
    }
  });
}

function extTrafficCopyStructuredFinal(platformId, idx) {
  const cfg = _getStructuredPlatformConfig(platformId);
  const cached = _generatedCache.get(platformId);
  const variant = cfg && cached && cached[cfg.extraKey] && cached[cfg.extraKey].variants && cached[cfg.extraKey].variants[idx];
  const value = _getStructuredVariantCopy(platformId, variant, cached?.sourceUrl || _getExtTrafficSourceUrl());
  if (!value) {
    _flashToast('복사할 최종 글이 없습니다');
    return;
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(() => {
        _flashToast('최종 글만 복사됐어요');
      }).catch(() => _flashToast('복사 실패'));
    } else {
      const ta = document.getElementById(`${_structuredDomKey(platformId)}FinalCopy_${idx}`);
      if (ta) {
        ta.select();
        document.execCommand && document.execCommand('copy');
        _flashToast('최종 글만 복사됐어요');
      }
    }
  } catch {
    _flashToast('복사 실패. 직접 선택해서 Ctrl+C 해주세요');
  }
}

function _decodeExtTrafficLooseJsonText(value) {
  return String(value || '')
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function _extractExtTrafficLooseStringField(block, field) {
  const re = new RegExp(`"${field}"\\s*:\\s*"([\\s\\S]*?)"\\s*(?:,\\s*(?="[_A-Za-z][_A-Za-z0-9]*"\\s*:)|(?=\\s*[}\\]]))`);
  const match = re.exec(String(block || ''));
  return match ? _decodeExtTrafficLooseJsonText(match[1]) : '';
}

function _extractExtTrafficLooseArrayField(block, field) {
  const re = new RegExp(`"${field}"\\s*:\\s*\\[([\\s\\S]*?)\\]`);
  const match = re.exec(String(block || ''));
  if (!match) return [];
  const inner = match[1];
  const quoted = Array.from(inner.matchAll(/"([\s\S]*?)"/g))
    .map((item) => _decodeExtTrafficLooseJsonText(item[1]))
    .filter(Boolean);
  const inlineTags = inner.match(/#[\p{L}\p{N}_-]+/gu) || [];
  return quoted.length ? quoted : inlineTags;
}

function _normalizeExtTrafficHashtags(tags) {
  const list = Array.isArray(tags) ? tags : String(tags || '').split(/\s+/);
  return list
    .flatMap((tag) => String(tag || '').split(/\s+/))
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.startsWith('#') ? tag : `#${tag.replace(/^#+/, '')}`)
    .filter((tag, idx, arr) => arr.indexOf(tag) === idx)
    .slice(0, 12);
}

const EXT_TRAFFIC_FALLBACK_HASHTAGS = [
  '#정보공유',
  '#생활정보',
  '#꿀팁',
  '#체크리스트',
  '#저장필수',
  '#오늘의정보',
  '#정리글',
  '#블로그정보',
];

function _buildExtTrafficFallbackHashtags(context, text) {
  const stop = new Set(['있는', '없는', '그리고', '하지만', '입니다', '합니다', '대한', '위해', '확인', '정보', '정리', '본문', '최종', '기준', '방법']);
  const source = [
    context?.sourceTitle,
    context?.coreTopic,
    context?.articleType,
    context?.targetReader,
    text,
  ].filter(Boolean).join(' ');
  const keywords = source
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2 && word.length <= 14 && !stop.has(word))
    .filter((word, idx, arr) => arr.indexOf(word) === idx)
    .slice(0, 6)
    .map((word) => `#${word}`);
  return _normalizeExtTrafficHashtags([...keywords, ...EXT_TRAFFIC_FALLBACK_HASHTAGS]).slice(0, 12);
}

function _findExtTrafficLooseObjectBlocks(rawText, key) {
  const text = String(rawText || '');
  const blocks = [];
  let searchFrom = 0;
  const needle = `"${key}"`;
  while (searchFrom < text.length) {
    const keyIndex = text.indexOf(needle, searchFrom);
    if (keyIndex < 0) break;
    const openIndex = text.indexOf('{', keyIndex);
    if (openIndex < 0) break;
    let depth = 0;
    let endIndex = -1;
    for (let i = openIndex; i < text.length; i++) {
      const ch = text[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }
    if (endIndex < 0) break;
    blocks.push({
      start: keyIndex,
      end: endIndex,
      block: text.slice(openIndex, endIndex),
    });
    searchFrom = endIndex;
  }
  return blocks;
}

function _findExtTrafficLooseVariantSections(rawText) {
  const text = String(rawText || '');
  const markers = Array.from(text.matchAll(/"key"\s*:\s*"([ABC])"/g))
    .map((match) => ({ key: match[1], start: match.index || 0 }));
  return markers.map((marker, idx) => {
    const end = idx + 1 < markers.length ? markers[idx + 1].start : text.length;
    return {
      key: marker.key,
      block: text.slice(marker.start, end),
    };
  });
}

function _recoverInstagramDisplayFromJsonText(rawText, fallbackHashtags = []) {
  const text = String(rawText || '');
  if (!text.includes('<INSTAGRAM_RESULT_JSON>') && !text.includes('"finalRevision"')) return null;
  const contextBlock = _findExtTrafficLooseObjectBlocks(text, 'context')[0]?.block || '';
  const context = {
    sourceTitle: _extractExtTrafficLooseStringField(contextBlock, 'sourceTitle'),
    coreTopic: _extractExtTrafficLooseStringField(contextBlock, 'coreTopic'),
    articleType: _extractExtTrafficLooseStringField(contextBlock, 'articleType'),
    targetReader: _extractExtTrafficLooseStringField(contextBlock, 'targetReader'),
    readerSituation: _extractExtTrafficLooseStringField(contextBlock, 'readerSituation'),
    clickReason: _extractExtTrafficLooseStringField(contextBlock, 'clickReason'),
  };
  const variantSections = _findExtTrafficLooseVariantSections(text);
  const finalBlocks = _findExtTrafficLooseObjectBlocks(text, 'finalRevision');
  if (!variantSections.length && !finalBlocks.length) return null;

  const recoverEntries = variantSections.length
    ? variantSections
    : finalBlocks.map((entry, idx) => ({ key: ['A', 'B', 'C'][idx], block: text.slice(Math.max(0, entry.start - 2500), entry.end) }));

  const variants = recoverEntries.map((entry, idx) => {
    const finalBlock = _findExtTrafficLooseObjectBlocks(entry.block, 'finalRevision')[0]?.block || '';
    const finalSource = finalBlock || entry.block;
    const recoveredTags = _normalizeExtTrafficHashtags(_extractExtTrafficLooseArrayField(finalSource, 'hashtags'));
    const finalRevision = {
      firstLine: _extractExtTrafficLooseStringField(finalSource, 'firstLine') || _extractExtTrafficLooseStringField(entry.block, 'selectedFirstLine'),
      body: _extractExtTrafficLooseStringField(finalSource, 'body'),
      savePrompt: _extractExtTrafficLooseStringField(finalSource, 'savePrompt'),
      sharePrompt: _extractExtTrafficLooseStringField(finalSource, 'sharePrompt'),
      commentPrompt: _extractExtTrafficLooseStringField(finalSource, 'commentPrompt'),
      linkPrompt: _extractExtTrafficLooseStringField(finalSource, 'linkPrompt'),
      hashtags: recoveredTags.length ? recoveredTags : fallbackHashtags,
    };
    return {
      key: _extractExtTrafficLooseStringField(entry.block, 'key') || entry.key || ['A', 'B', 'C'][idx] || 'A',
      label: _extractExtTrafficLooseStringField(entry.block, 'label') || ['저장형', '공감형', '경고형'][idx] || '',
      tone: _extractExtTrafficLooseStringField(entry.block, 'tone'),
      articleType: _extractExtTrafficLooseStringField(entry.block, 'articleType') || context.articleType,
      targetReader: _extractExtTrafficLooseStringField(entry.block, 'targetReader') || context.targetReader,
      goal: _extractExtTrafficLooseStringField(entry.block, 'goal'),
      hookEngine: _extractExtTrafficLooseStringField(entry.block, 'hookEngine'),
      selectedFirstLine: _extractExtTrafficLooseStringField(entry.block, 'selectedFirstLine') || finalRevision.firstLine,
      selectedReason: _extractExtTrafficLooseStringField(entry.block, 'selectedReason'),
      firstLineCandidates: [],
      firstLineScore: 0,
      body: _extractExtTrafficLooseStringField(entry.block, 'body'),
      savePrompt: _extractExtTrafficLooseStringField(entry.block, 'savePrompt'),
      sharePrompt: _extractExtTrafficLooseStringField(entry.block, 'sharePrompt'),
      commentPrompt: _extractExtTrafficLooseStringField(entry.block, 'commentPrompt'),
      linkPrompt: _extractExtTrafficLooseStringField(entry.block, 'linkPrompt'),
      hashtags: finalRevision.hashtags,
      expectedClickStrength: _extractExtTrafficLooseStringField(entry.block, 'expectedClickStrength'),
      critique: { score: 0, notes: 'JSON 원문에서 최종 게시문만 자동 복구했습니다.' },
      finalRevision,
      passed: true,
      recommended: idx === 0,
    };
  }).filter((variant) => _getInstagramVariantCopy(variant));
  const orderedVariants = _orderUniqueInstagramVariants(variants);

  if (!orderedVariants.length) return null;
  const firstCopy = _getInstagramVariantCopy(orderedVariants[0]);
  const hashtags = _normalizeExtTrafficHashtags(orderedVariants[0].finalRevision?.hashtags || orderedVariants[0].hashtags);
  const safeHashtags = hashtags.length ? hashtags : _buildExtTrafficFallbackHashtags(context, firstCopy);
  if (!hashtags.length && orderedVariants[0]) {
    orderedVariants[0].hashtags = safeHashtags;
    orderedVariants[0].finalRevision = {
      ...(orderedVariants[0].finalRevision || {}),
      hashtags: safeHashtags,
    };
  }
  return {
    context,
    variants: orderedVariants.slice(0, 3),
    formatted: {
      body: firstCopy.replace(/\n\n(#[\p{L}\p{N}_-]+.*)$/u, '').trim(),
      hashtags: safeHashtags,
    },
  };
}

function _orderUniqueInstagramVariants(variants) {
  const order = { A: 0, B: 1, C: 2 };
  const seen = new Set();
  return (Array.isArray(variants) ? variants : [])
    .filter(Boolean)
    .sort((a, b) => (order[a.key] ?? 99) - (order[b.key] ?? 99))
    .filter((variant) => {
      const key = variant.key || '';
      if (key && seen.has(key)) return false;
      if (key) seen.add(key);
      return true;
    });
}

function _normalizeInstagramCachedForDisplay(cached) {
  if (!cached || (cached.instagram && Array.isArray(cached.instagram.variants) && cached.instagram.variants.length > 0)) {
    return cached;
  }
  const formatted = cached.formatted || {};
  const fallbackHashtags = _normalizeExtTrafficHashtags(formatted.hashtags || []);
  const raw = [cached.rawText, formatted.body].filter(Boolean).join('\n\n');
  const recovered = _recoverInstagramDisplayFromJsonText(raw, fallbackHashtags);
  if (!recovered) return cached;
  return {
    ...cached,
    instagram: {
      context: recovered.context,
      variants: recovered.variants,
    },
    formatted: {
      ...formatted,
      ...recovered.formatted,
    },
  };
}

function _recoverThreadsDisplayFromJsonText(rawText) {
  const text = String(rawText || '');
  if (!text.includes('<THREADS_RESULT_JSON>') && !text.includes('"finalRevision"')) return null;

  const contextBlock = _findExtTrafficLooseObjectBlocks(text, 'context')[0]?.block || '';
  const context = {
    sourceTitle: _extractExtTrafficLooseStringField(contextBlock, 'sourceTitle'),
    coreTopic: _extractExtTrafficLooseStringField(contextBlock, 'coreTopic'),
    articleType: _extractExtTrafficLooseStringField(contextBlock, 'articleType'),
    targetReader: _extractExtTrafficLooseStringField(contextBlock, 'targetReader'),
    readerSituation: _extractExtTrafficLooseStringField(contextBlock, 'readerSituation'),
    mainQuestion: _extractExtTrafficLooseStringField(contextBlock, 'mainQuestion'),
    commentAngle: _extractExtTrafficLooseStringField(contextBlock, 'commentAngle'),
    shareReason: _extractExtTrafficLooseStringField(contextBlock, 'shareReason'),
    linkReason: _extractExtTrafficLooseStringField(contextBlock, 'linkReason'),
  };

  const variantSections = _findExtTrafficLooseVariantSections(text);
  const finalBlocks = _findExtTrafficLooseObjectBlocks(text, 'finalRevision');
  if (!variantSections.length && !finalBlocks.length) return null;

  const recoverEntries = variantSections.length
    ? variantSections
    : finalBlocks.map((entry, idx) => ({ key: ['A', 'B', 'C'][idx], block: text.slice(Math.max(0, entry.start - 2200), entry.end) }));

  const variants = recoverEntries.map((entry, idx) => {
    const finalBlock = _findExtTrafficLooseObjectBlocks(entry.block, 'finalRevision')[0]?.block || '';
    const finalSource = finalBlock || entry.block;
    const finalRevision = {
      firstLine: _extractExtTrafficLooseStringField(finalSource, 'firstLine') || _extractExtTrafficLooseStringField(entry.block, 'selectedFirstLine'),
      body: _extractExtTrafficLooseStringField(finalSource, 'body'),
      commentPrompt: _extractExtTrafficLooseStringField(finalSource, 'commentPrompt'),
      sharePrompt: _extractExtTrafficLooseStringField(finalSource, 'sharePrompt'),
      linkPrompt: _extractExtTrafficLooseStringField(finalSource, 'linkPrompt'),
    };
    return {
      key: _extractExtTrafficLooseStringField(entry.block, 'key') || entry.key || ['A', 'B', 'C'][idx] || 'A',
      label: _extractExtTrafficLooseStringField(entry.block, 'label') || ['댓글형', '공감형', '공유형'][idx] || '',
      tone: _extractExtTrafficLooseStringField(entry.block, 'tone'),
      goal: _extractExtTrafficLooseStringField(entry.block, 'goal'),
      hookEngine: _extractExtTrafficLooseStringField(entry.block, 'hookEngine'),
      selectedFirstLine: _extractExtTrafficLooseStringField(entry.block, 'selectedFirstLine') || finalRevision.firstLine,
      selectedReason: _extractExtTrafficLooseStringField(entry.block, 'selectedReason'),
      firstLineCandidates: [],
      firstLineScore: Number(_extractExtTrafficLooseStringField(entry.block, 'firstLineScore')) || 0,
      body: _extractExtTrafficLooseStringField(entry.block, 'body'),
      commentPrompt: _extractExtTrafficLooseStringField(entry.block, 'commentPrompt'),
      sharePrompt: _extractExtTrafficLooseStringField(entry.block, 'sharePrompt'),
      linkPrompt: _extractExtTrafficLooseStringField(entry.block, 'linkPrompt'),
      critique: { score: Number(_extractExtTrafficLooseStringField(entry.block, 'score')) || 0 },
      finalRevision,
      passed: true,
      recommended: idx === 0,
    };
  }).filter((variant) => _getThreadsVariantCopy(variant));
  const orderedVariants = _orderUniqueThreadsVariants(variants);

  if (!orderedVariants.length) return null;
  return {
    context,
    variants: orderedVariants.slice(0, 3),
    formatted: {
      body: _getThreadsVariantCopy(orderedVariants[0]),
    },
  };
}

function _orderUniqueThreadsVariants(variants) {
  const order = { A: 0, B: 1, C: 2 };
  const seen = new Set();
  return (Array.isArray(variants) ? variants : [])
    .filter(Boolean)
    .sort((a, b) => (order[a.key] ?? 99) - (order[b.key] ?? 99))
    .filter((variant) => {
      const key = variant.key || '';
      if (key && seen.has(key)) return false;
      if (key) seen.add(key);
      return true;
    });
}

function _normalizeThreadsCachedForDisplay(cached) {
  if (!cached || (cached.threads && Array.isArray(cached.threads.variants) && cached.threads.variants.length > 0)) {
    return cached;
  }
  const formatted = cached.formatted || {};
  const raw = [cached.rawText, formatted.body].filter(Boolean).join('\n\n');
  const recovered = _recoverThreadsDisplayFromJsonText(raw);
  if (!recovered) return cached;
  return {
    ...cached,
    threads: {
      context: recovered.context,
      variants: recovered.variants,
    },
    formatted: {
      ...formatted,
      ...recovered.formatted,
    },
  };
}

function extTrafficShowThreadsVariant(idx) {
  const panels = document.querySelectorAll('[id^="threadsVariantPanel_"]');
  const tabs = document.querySelectorAll('[id^="threadsVariantTab_"]');
  panels.forEach((panel, index) => {
    panel.style.display = index === idx ? 'block' : 'none';
  });
  tabs.forEach((tab, index) => {
    if (index === idx) {
      tab.style.background = '#f8fafc';
      tab.style.color = '#020617';
      tab.style.borderColor = 'rgba(255,255,255,0.35)';
    } else {
      tab.style.background = 'rgba(255,255,255,0.05)';
      tab.style.color = '#cbd5e1';
      tab.style.borderColor = 'rgba(148,163,184,0.16)';
    }
  });
}

function extTrafficCopyThreadsFinal(idx) {
  const cached = _generatedCache.get('threads');
  const variant = cached?.threads?.variants?.[idx];
  const value = _getThreadsVariantCopy(variant, cached?.sourceUrl || _getExtTrafficSourceUrl());
  if (!value) {
    _flashToast('복사할 Threads 최종 글이 없습니다');
    return;
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(() => {
        _flashToast('Threads 최종 글만 복사됐어요');
      }).catch(() => {
        _flashToast('복사 실패');
      });
    } else {
      const ta = document.getElementById(`threadsFinalCopy_${idx}`);
      if (ta) {
        ta.select();
        document.execCommand && document.execCommand('copy');
        _flashToast('Threads 최종 글만 복사됐어요');
      }
    }
  } catch {
    _flashToast('복사 실패. 직접 선택해서 Ctrl+C 해주세요');
  }
}

function _recoverNaverBlogDisplayFromJsonText(rawText) {
  const text = String(rawText || '');
  if (!text.includes('<NAVER_BLOG_RESULT_JSON>') && !text.includes('"finalRevision"')) return null;
  const parsed = _parseNaverBlogJsonForDisplay(text);
  if (parsed && Array.isArray(parsed.variants)) {
    const context = parsed.context || {};
    const variants = parsed.variants
      .slice(0, 3)
      .map((variant, idx) => _normalizeNaverBlogVariantForDisplay(variant, idx, context))
      .filter((variant) => _getNaverBlogVariantCopy(variant));
    if (variants.length) {
      return {
        context,
        variants: _orderUniqueNaverBlogVariants(variants),
        formatted: {
          body: _getNaverBlogVariantCopy(variants[0]).replace(/\n\n(#[\p{L}\p{N}_-]+.*)$/u, '').trim(),
          hashtags: variants[0].finalRevision?.hashtags || variants[0].hashtags || [],
        },
      };
    }
  }

  const contextBlock = _findExtTrafficLooseObjectBlocks(text, 'context')[0]?.block || '';
  const context = {
    sourceTitle: _extractExtTrafficLooseStringField(contextBlock, 'sourceTitle'),
    coreTopic: _extractExtTrafficLooseStringField(contextBlock, 'coreTopic'),
    articleType: _extractExtTrafficLooseStringField(contextBlock, 'articleType'),
    primaryKeyword: _extractExtTrafficLooseStringField(contextBlock, 'primaryKeyword'),
    secondaryKeywords: _extractExtTrafficLooseArrayField(contextBlock, 'secondaryKeywords'),
    searchTerms: _extractExtTrafficLooseArrayField(contextBlock, 'searchTerms'),
    targetReader: _extractExtTrafficLooseStringField(contextBlock, 'targetReader'),
    readerQuestion: _extractExtTrafficLooseStringField(contextBlock, 'readerQuestion'),
  };
  const variantSections = _findExtTrafficLooseVariantSections(text);
  const finalBlocks = _findExtTrafficLooseObjectBlocks(text, 'finalRevision');
  if (!variantSections.length && !finalBlocks.length) return null;
  const recoverEntries = variantSections.length
    ? variantSections
    : finalBlocks.map((entry, idx) => ({ key: ['A', 'B', 'C'][idx], block: text.slice(Math.max(0, entry.start - 4000), entry.end) }));
  const variants = recoverEntries.map((entry, idx) => {
    const finalBlock = _findExtTrafficLooseObjectBlocks(entry.block, 'finalRevision')[0]?.block || '';
    const finalSource = finalBlock || entry.block;
    return _normalizeNaverBlogVariantForDisplay({
      key: _extractExtTrafficLooseStringField(entry.block, 'key') || entry.key,
      label: _extractExtTrafficLooseStringField(entry.block, 'label'),
      articleType: _extractExtTrafficLooseStringField(entry.block, 'articleType'),
      primaryKeyword: _extractExtTrafficLooseStringField(entry.block, 'primaryKeyword'),
      selectedTitle: _extractExtTrafficLooseStringField(entry.block, 'selectedTitle'),
      titleScore: Number(_extractExtTrafficLooseStringField(entry.block, 'titleScore')) || 0,
      selectedReason: _extractExtTrafficLooseStringField(entry.block, 'selectedReason'),
      intro: _extractExtTrafficLooseStringField(entry.block, 'intro'),
      sourceLead: _extractExtTrafficLooseStringField(entry.block, 'sourceLead'),
      commentPrompt: _extractExtTrafficLooseStringField(entry.block, 'commentPrompt'),
      hashtags: _extractExtTrafficLooseArrayField(entry.block, 'hashtags'),
      finalRevision: {
        title: _extractExtTrafficLooseStringField(finalSource, 'title'),
        intro: _extractExtTrafficLooseStringField(finalSource, 'intro'),
        sourceLead: _extractExtTrafficLooseStringField(finalSource, 'sourceLead'),
        commentPrompt: _extractExtTrafficLooseStringField(finalSource, 'commentPrompt'),
        hashtags: _extractExtTrafficLooseArrayField(finalSource, 'hashtags'),
      },
    }, idx, context);
  }).filter((variant) => _getNaverBlogVariantCopy(variant));
  const orderedVariants = _orderUniqueNaverBlogVariants(variants);
  if (!orderedVariants.length) return null;
  return {
    context,
    variants: orderedVariants.slice(0, 3),
    formatted: {
      body: _getNaverBlogVariantCopy(orderedVariants[0]).replace(/\n\n(#[\p{L}\p{N}_-]+.*)$/u, '').trim(),
      hashtags: orderedVariants[0].finalRevision?.hashtags || orderedVariants[0].hashtags || [],
    },
  };
}

function _parseNaverBlogJsonForDisplay(rawText) {
  const text = String(rawText || '');
  const start = text.indexOf('<NAVER_BLOG_RESULT_JSON>');
  const end = text.indexOf('</NAVER_BLOG_RESULT_JSON>');
  let jsonText = '';
  if (start >= 0 && end > start) {
    jsonText = text.slice(start + '<NAVER_BLOG_RESULT_JSON>'.length, end).trim();
  } else {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonText = text.slice(firstBrace, lastBrace + 1).trim();
    }
  }
  if (!jsonText) return null;
  jsonText = jsonText.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

function _normalizeNaverBlogVariantForDisplay(raw, idx, context = {}) {
  const key = String(raw?.key || ['A', 'B', 'C'][idx] || 'A').slice(0, 1).toUpperCase();
  const labels = { A: '검색 정리형', B: '경험 공감형', C: '체크리스트형' };
  const finalRevision = raw?.finalRevision && typeof raw.finalRevision === 'object' ? raw.finalRevision : {};
  const sections = Array.isArray(finalRevision.sections) && finalRevision.sections.length
    ? finalRevision.sections
    : (Array.isArray(raw?.sections) ? raw.sections : []);
  const titleCandidates = Array.isArray(raw?.titleCandidates) ? raw.titleCandidates : [];
  const selectedTitle = raw?.selectedTitle || finalRevision.title || titleCandidates[0]?.text || context.sourceTitle || '';
  return {
    key,
    label: raw?.label || labels[key] || '',
    articleType: raw?.articleType || context.articleType || '',
    primaryKeyword: raw?.primaryKeyword || context.primaryKeyword || '',
    secondaryKeywords: Array.isArray(raw?.secondaryKeywords) ? raw.secondaryKeywords : [],
    titleCandidates,
    selectedTitle,
    titleScore: Number(raw?.titleScore || titleCandidates.find((item) => item.text === selectedTitle)?.score || 0),
    selectedReason: raw?.selectedReason || '',
    intro: raw?.intro || '',
    sections,
    sourceLead: raw?.sourceLead || '',
    commentPrompt: raw?.commentPrompt || '',
    hashtags: Array.isArray(raw?.hashtags) ? raw.hashtags : [],
    expectedClickStrength: raw?.expectedClickStrength || '',
    critique: raw?.critique && typeof raw.critique === 'object' ? raw.critique : {},
    finalRevision: {
      title: finalRevision.title || selectedTitle,
      intro: finalRevision.intro || raw?.intro || '',
      sections,
      sourceLead: finalRevision.sourceLead || raw?.sourceLead || '',
      commentPrompt: finalRevision.commentPrompt || raw?.commentPrompt || '',
      hashtags: Array.isArray(finalRevision.hashtags) ? finalRevision.hashtags : (Array.isArray(raw?.hashtags) ? raw.hashtags : []),
    },
    recommended: raw?.recommended || Number(raw?.critique?.score || 0) >= 95,
    passed: raw?.passed || Number(raw?.critique?.score || 0) >= 90,
  };
}

function _orderUniqueNaverBlogVariants(variants) {
  const order = { A: 0, B: 1, C: 2 };
  const seen = new Set();
  return (Array.isArray(variants) ? variants : [])
    .filter(Boolean)
    .sort((a, b) => (order[a.key] ?? 99) - (order[b.key] ?? 99))
    .filter((variant) => {
      const key = variant.key || '';
      if (key && seen.has(key)) return false;
      if (key) seen.add(key);
      return true;
    });
}

function _normalizeNaverBlogCachedForDisplay(cached) {
  if (!cached || (cached.naverBlog && Array.isArray(cached.naverBlog.variants) && cached.naverBlog.variants.length > 0)) {
    return cached;
  }
  const formatted = cached.formatted || {};
  const raw = [cached.rawText, formatted.body].filter(Boolean).join('\n\n');
  const recovered = _recoverNaverBlogDisplayFromJsonText(raw);
  if (!recovered) return cached;
  return {
    ...cached,
    naverBlog: {
      context: recovered.context,
      variants: recovered.variants,
    },
    formatted: {
      ...formatted,
      ...recovered.formatted,
    },
  };
}

function extTrafficShowNaverBlogVariant(idx) {
  const panels = document.querySelectorAll('[id^="naverBlogVariantPanel_"]');
  const tabs = document.querySelectorAll('[id^="naverBlogVariantTab_"]');
  panels.forEach((panel, index) => {
    panel.style.display = index === idx ? 'block' : 'none';
  });
  tabs.forEach((tab, index) => {
    if (index === idx) {
      tab.style.background = 'linear-gradient(135deg, #03c75a, #14b8a6)';
      tab.style.color = 'white';
      tab.style.borderColor = 'rgba(255,255,255,0.24)';
    } else {
      tab.style.background = 'rgba(255,255,255,0.05)';
      tab.style.color = '#cbd5e1';
      tab.style.borderColor = 'rgba(148,163,184,0.16)';
    }
  });
}

function extTrafficCopyNaverBlogFinal(idx) {
  const cached = _generatedCache.get('naver-blog');
  const variant = cached?.naverBlog?.variants?.[idx];
  const value = _getNaverBlogVariantCopy(variant, cached?.sourceUrl || _getExtTrafficSourceUrl());
  if (!value) {
    _flashToast('복사할 네이버 블로그 최종 개선안이 없습니다');
    return;
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(() => {
        _flashToast('네이버 블로그 최종 개선안만 복사됐어요');
      }).catch(() => {
        _flashToast('복사 실패');
      });
    } else {
      const ta = document.getElementById(`naverBlogFinalCopy_${idx}`);
      if (ta) {
        ta.select();
        document.execCommand && document.execCommand('copy');
        _flashToast('네이버 블로그 최종 개선안만 복사됐어요');
      }
    }
  } catch {
    _flashToast('복사 실패. 직접 선택해서 Ctrl+C 해주세요');
  }
}

function extTrafficShowInstagramVariant(idx) {
  const panels = document.querySelectorAll('[id^="igVariantPanel_"]');
  const tabs = document.querySelectorAll('[id^="igVariantTab_"]');
  panels.forEach((panel, index) => {
    panel.style.display = index === idx ? 'block' : 'none';
  });
  tabs.forEach((tab, index) => {
    if (index === idx) {
      tab.style.background = 'linear-gradient(135deg, #e1306c, #f97316)';
      tab.style.color = 'white';
      tab.style.borderColor = 'rgba(255,255,255,0.2)';
    } else {
      tab.style.background = 'rgba(255,255,255,0.05)';
      tab.style.color = '#cbd5e1';
      tab.style.borderColor = 'rgba(148,163,184,0.14)';
    }
  });
}

function extTrafficCopyInstagramFinal(idx) {
  const cached = _generatedCache.get('instagram');
  const variant = cached?.instagram?.variants?.[idx];
  const value = _getInstagramVariantCopy(variant, cached?.sourceUrl || _getExtTrafficSourceUrl());
  if (!value) {
    _flashToast('⚠️ 복사할 최종 개선안이 없습니다');
    return;
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(() => {
        _flashToast('✅ 최종 개선안만 복사됐어요');
      }).catch(() => {
        _flashToast('⚠️ 복사 실패');
      });
    } else {
      const ta = document.getElementById(`instagramFinalCopy_${idx}`);
      if (ta) {
        ta.select();
        document.execCommand && document.execCommand('copy');
        _flashToast('✅ 최종 개선안만 복사됐어요');
      }
    }
  } catch {
    _flashToast('⚠️ 복사 실패 — 직접 선택 후 Ctrl+C 해주세요');
  }
}

function _renderFeedbackRow(platformId, riskScore, band) {
  return `
    <div style="margin-top: 14px; padding: 12px 14px; background: rgba(15,23,42,0.5); border: 1px solid rgba(148,163,184,0.1); border-radius: 10px; display: flex; align-items: center; gap: 10px;">
      <span style="color: #94a3b8; font-size: 12px; font-weight: 700; flex-shrink: 0;">결과 어땠나요?</span>
      <button type="button" onclick="extTrafficSendFeedback('${platformId}', 'good', ${riskScore}, '${band}')"
        style="padding: 6px 10px; background: rgba(16,185,129,0.18); color: #34d399; border: 1px solid rgba(16,185,129,0.35); border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">👍 잘 됨</button>
      <button type="button" onclick="extTrafficSendFeedback('${platformId}', 'meh', ${riskScore}, '${band}')"
        style="padding: 6px 10px; background: rgba(148,163,184,0.18); color: #cbd5e1; border: 1px solid rgba(148,163,184,0.25); border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">😐 보통</button>
      <button type="button" onclick="extTrafficSendFeedback('${platformId}', 'bad', ${riskScore}, '${band}')"
        style="padding: 6px 10px; background: rgba(251,191,36,0.18); color: #fbbf24; border: 1px solid rgba(251,191,36,0.35); border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">👎 별로</button>
      <button type="button" onclick="extTrafficSendFeedback('${platformId}', 'banned', ${riskScore}, '${band}')"
        style="padding: 6px 10px; background: rgba(239,68,68,0.22); color: #f87171; border: 1px solid rgba(239,68,68,0.4); border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">🚫 정지당함</button>
    </div>`;
}

async function extTrafficSendFeedback(platformId, verdict, riskScore, band) {
  try {
    if (!window.electronAPI || !window.electronAPI.invoke) return;
    const result = await window.electronAPI.invoke('external-traffic-feedback-record', {
      channel: platformId,
      verdict,
      riskScore: typeof riskScore === 'number' ? riskScore : null,
      band: band || null,
    });
    if (result && result.success) {
      _flashToast(verdict === 'banned' ? '🚫 정지 기록 저장 — 캘리브레이션 입력' : '✅ 피드백 저장됨');
    } else {
      _flashToast('⚠️ 피드백 저장 실패');
    }
  } catch (e) {
    _flashToast('⚠️ 피드백 저장 실패');
  }
}

function _renderConfidenceBadge(platformId) {
  if (!_isV2Channel(platformId)) return '';
  const meta = _getV2Meta(platformId);
  const conf = (meta && meta.confidence) || 'inferred';
  const palette = {
    verified: { bg: 'linear-gradient(135deg, rgba(16,185,129,0.22), rgba(34,197,94,0.18))', border: 'rgba(16,185,129,0.5)', color: '#34d399', label: '🟢 검증됨' },
    'community-validated': { bg: 'linear-gradient(135deg, rgba(59,130,246,0.22), rgba(99,102,241,0.18))', border: 'rgba(59,130,246,0.5)', color: '#60a5fa', label: '🔵 협력 풀' },
    inferred: { bg: 'linear-gradient(135deg, rgba(251,191,36,0.18), rgba(234,179,8,0.14))', border: 'rgba(251,191,36,0.45)', color: '#fbbf24', label: '🟡 추론' },
    'user-curated': { bg: 'linear-gradient(135deg, rgba(249,115,22,0.18), rgba(234,88,12,0.14))', border: 'rgba(249,115,22,0.45)', color: '#fb923c', label: '🟠 사용자' },
  };
  const p = palette[conf] || palette.inferred;
  return `<span title="채널 패턴 신뢰도: ${conf}" style="font-size: 11px; padding: 2px 8px; background: ${p.bg}; border: 1px solid ${p.border}; border-radius: 6px; color: ${p.color}; margin-left: 6px; vertical-align: middle; font-weight: 700;">${p.label}</span>`;
}

function _renderRiskBadge(risk) {
  const band = risk.band || 'low';
  const score = typeof risk.score === 'number' ? risk.score : 0;
  const palette = {
    low: { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.4)', color: '#34d399', label: '🟢 안전 추정', help: '패턴상 비교적 안전. 운영 노하우는 사용자 책임.' },
    medium: { bg: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.4)', color: '#fbbf24', label: '🟡 주의', help: '약한 위험 시그널 — 본문 확인 후 게시.' },
    high: { bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.4)', color: '#fb923c', label: '🔴 위험', help: '검증된 ban 트리거 다수 — 수동 편집 권장.' },
    critical: { bg: 'rgba(239, 68, 68, 0.18)', border: 'rgba(239, 68, 68, 0.5)', color: '#f87171', label: '⛔ 매우 위험', help: '복사·발행 권장하지 않습니다. 직접 재작성.' },
  };
  const p = palette[band] || palette.low;
  const violations = (risk.violations || []).slice(0, 3).map(escapeHtml).join(' · ');
  return `
    <div style="margin-bottom: 14px; padding: 12px 14px; background: ${p.bg}; border: 1px solid ${p.border}; border-radius: 10px; display: flex; align-items: center; gap: 12px;">
      <div style="flex-shrink: 0; padding: 6px 10px; border-radius: 8px; background: rgba(15,23,42,0.4); color: ${p.color}; font-weight: 800; font-size: 13px;">${p.label} ${score}/100</div>
      <div style="flex: 1; min-width: 0;">
        <div style="color: ${p.color}; font-size: 12px; font-weight: 700;">${escapeHtml(p.help)}</div>
        ${violations ? `<div style="color: #94a3b8; font-size: 11px; margin-top: 4px;">감지: ${violations}</div>` : ''}
      </div>
    </div>`;
}

function _renderSingleBody(platform, formatted) {
  const body = formatted.body || '';
  const hashtags = Array.isArray(formatted.hashtags) ? formatted.hashtags : null;
  const safeBody = escapeHtml(body);
  let html = `
    <div style="margin-bottom: 12px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
        <label style="color: #cbd5e1; font-size: 12px; font-weight: 700;">본문</label>
        <span style="color: #64748b; font-size: 11px;">글자수: ${body.length}</span>
      </div>
      <textarea id="extTrafficResultText" readonly
        style="width: 100%; min-height: 240px; padding: 16px 18px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(148,163,184,0.15); border-radius: 12px; color: #e2e8f0; font-size: 14px; line-height: 1.7; font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; resize: vertical; box-sizing: border-box; white-space: pre-wrap;">${safeBody}</textarea>
      <button type="button" onclick="extTrafficCopyFromTextarea('extTrafficResultText')"
        style="margin-top: 8px; padding: 8px 14px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">📋 본문 복사</button>
    </div>`;
  if (hashtags && hashtags.length > 0) {
    const tagText = hashtags.join(' ');
    const safeTags = escapeHtml(tagText);
    html += `
      <div style="margin-bottom: 12px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <label style="color: #cbd5e1; font-size: 12px; font-weight: 700;">해시태그</label>
          <span style="color: #64748b; font-size: 11px;">개수: ${hashtags.length}</span>
        </div>
        <textarea id="extTrafficResultHashtags" readonly
          style="width: 100%; min-height: 60px; padding: 12px 14px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(148,163,184,0.15); border-radius: 10px; color: #e2e8f0; font-size: 13px; line-height: 1.6; font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; resize: vertical; box-sizing: border-box; white-space: pre-wrap;">${safeTags}</textarea>
        <button type="button" onclick="extTrafficCopyFromTextarea('extTrafficResultHashtags')"
          style="margin-top: 8px; padding: 8px 14px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">📋 해시태그 복사</button>
        <button type="button" onclick="extTrafficCopyCombined('extTrafficResultText', 'extTrafficResultHashtags')"
          style="margin-top: 8px; margin-left: 6px; padding: 8px 14px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">📋 전체 복사 (본문 + 해시태그)</button>
      </div>`;
  }
  return html;
}

// ─── 채널별 미리보기 시뮬레이션 ────────────────────────────────────────
//   실제 게시 시 보이는 형태를 흉내 — 사용자가 게시 전 모양 확인.
function _renderPreviewSimulation(platformId, formatted) {
  const tpl = _PREVIEW_TEMPLATES[platformId];
  if (!tpl) return '';
  try {
    return tpl(formatted);
  } catch (e) {
    return '';
  }
}

const _PREVIEW_USERNAME = '@yourblog';

const _PREVIEW_TEMPLATES = {
  instagram: (f) => {
    const body = escapeHtml(f.body || '').replace(/\n/g, '<br>');
    const tags = (f.hashtags || []).map(escapeHtml).join(' ');
    return `
      <details style="margin-top: 14px;" open>
        <summary style="cursor: pointer; color: #cbd5e1; font-size: 12px; font-weight: 700; padding: 8px 0;">🔎 인스타그램 미리보기 (게시 모양 시뮬)</summary>
        <div style="max-width: 420px; margin: 12px 0; background: white; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.4); color: #262626; font-family: 'Helvetica', sans-serif;">
          <div style="padding: 12px 14px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid rgba(0,0,0,0.08);">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);"></div>
            <div style="font-weight: 700; font-size: 13px;">${_PREVIEW_USERNAME}</div>
          </div>
          <div style="width: 100%; aspect-ratio: 1 / 1; background: linear-gradient(135deg, #6366f1, #ec4899); display: flex; align-items: center; justify-content: center; font-size: 48px; color: white;">📷</div>
          <div style="padding: 8px 14px; font-size: 18px;">♡  💬  ✈️</div>
          <div style="padding: 0 14px 14px; font-size: 13px; line-height: 1.5;">
            <strong>${_PREVIEW_USERNAME}</strong> ${body}
            ${tags ? `<div style="color: #00376b; margin-top: 8px; font-weight: 500;">${tags}</div>` : ''}
          </div>
        </div>
      </details>`;
  },

  threads: (f) => {
    const body = escapeHtml(f.body || '').replace(/\n/g, '<br>');
    return `
      <details style="margin-top: 14px;" open>
        <summary style="cursor: pointer; color: #cbd5e1; font-size: 12px; font-weight: 700; padding: 8px 0;">🔎 Threads 미리보기</summary>
        <div style="max-width: 480px; margin: 12px 0; background: white; border-radius: 12px; padding: 14px 16px; box-shadow: 0 6px 24px rgba(0,0,0,0.4); color: #000;">
          <div style="display: flex; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: #000; flex-shrink: 0;"></div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 14px; font-weight: 700;">${_PREVIEW_USERNAME}</div>
              <div style="font-size: 14px; line-height: 1.45; margin-top: 4px; word-wrap: break-word;">${body}</div>
              <div style="margin-top: 12px; color: #999; font-size: 13px;">♡  💬  🔁  ✈️</div>
            </div>
          </div>
        </div>
      </details>`;
  },

  x: (f) => {
    const parts = f.parts || {};
    const t1 = escapeHtml(parts.tweet1 || '').replace(/\n/g, '<br>');
    const t2 = escapeHtml(parts.tweet2 || '').replace(/\n/g, '<br>');
    return `
      <details style="margin-top: 14px;" open>
        <summary style="cursor: pointer; color: #cbd5e1; font-size: 12px; font-weight: 700; padding: 8px 0;">🔎 X 미리보기 (2-tweet)</summary>
        <div style="max-width: 540px; margin: 12px 0; background: white; border-radius: 14px; padding: 14px 16px; box-shadow: 0 6px 24px rgba(0,0,0,0.4); color: #0f1419;">
          <div style="display: flex; gap: 10px; padding-bottom: 12px; border-bottom: 1px solid rgba(0,0,0,0.08);">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: #1da1f2; flex-shrink: 0;"></div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 15px; font-weight: 700;">Your Blog <span style="font-weight: 400; color: #536471;">${_PREVIEW_USERNAME} · 방금</span></div>
              <div style="font-size: 15px; line-height: 1.5; margin-top: 4px;">${t1}</div>
              <div style="margin-top: 10px; color: #536471; font-size: 13px;">${(parts.tweet1 || '').length}/280 · 💬  🔁  ♡</div>
            </div>
          </div>
          <div style="padding-top: 12px; display: flex; gap: 10px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: #1da1f2; flex-shrink: 0; margin-left: 4px;"></div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 14px; font-weight: 700;">Your Blog · 답글</div>
              <div style="font-size: 14px; line-height: 1.5; margin-top: 4px;">${t2}</div>
              <div style="margin-top: 8px; color: #536471; font-size: 12px;">${(parts.tweet2 || '').length}/280</div>
            </div>
          </div>
        </div>
      </details>`;
  },

  facebook: (f) => {
    const parts = f.parts || {};
    const personal = escapeHtml(parts.personal || '').replace(/\n/g, '<br>');
    const gc = escapeHtml(parts['group-comment'] || '').replace(/\n/g, '<br>');
    return `
      <details style="margin-top: 14px;" open>
        <summary style="cursor: pointer; color: #cbd5e1; font-size: 12px; font-weight: 700; padding: 8px 0;">🔎 Facebook 미리보기</summary>
        <div style="max-width: 540px; margin: 12px 0; background: white; border-radius: 12px; padding: 16px; box-shadow: 0 6px 24px rgba(0,0,0,0.4); color: #050505;">
          <div style="font-size: 11px; color: #65676b; margin-bottom: 6px;">[개인 계정용]</div>
          <div style="display: flex; gap: 10px; margin-bottom: 14px;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: #1877f2; flex-shrink: 0;"></div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 14px; font-weight: 700;">Your Blog</div>
              <div style="font-size: 14px; line-height: 1.5; margin-top: 6px;">${personal}</div>
            </div>
          </div>
          <hr style="border: none; border-top: 1px solid #e4e6eb; margin: 12px 0;">
          <div style="font-size: 11px; color: #65676b; margin-bottom: 6px;">[그룹 댓글용 — 미끼 본문]</div>
          <div style="background: #f0f2f5; border-radius: 8px; padding: 10px 12px; font-size: 13px; line-height: 1.5;">${gc}</div>
        </div>
      </details>`;
  },

  'kakao-openchat': (f) => {
    const body = escapeHtml(f.body || '').replace(/\n/g, '<br>');
    return `
      <details style="margin-top: 14px;" open>
        <summary style="cursor: pointer; color: #cbd5e1; font-size: 12px; font-weight: 700; padding: 8px 0;">🔎 카카오톡 오픈채팅 미리보기</summary>
        <div style="max-width: 380px; margin: 12px 0; background: #b2c7d9; border-radius: 14px; padding: 18px 14px; box-shadow: 0 6px 24px rgba(0,0,0,0.4);">
          <div style="display: flex; gap: 8px; align-items: flex-end;">
            <div style="width: 36px; height: 36px; border-radius: 12px; background: #fee500; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 18px;">📺</div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 12px; color: #333; margin-bottom: 3px;">방장</div>
              <div style="background: white; border-radius: 12px; padding: 10px 12px; font-size: 13px; line-height: 1.5; color: #000; word-wrap: break-word;">${body}</div>
            </div>
          </div>
        </div>
      </details>`;
  },

  'naver-blog': (f) => {
    const body = escapeHtml(f.body || '').replace(/\n/g, '<br>');
    return `
      <details style="margin-top: 14px;" open>
        <summary style="cursor: pointer; color: #cbd5e1; font-size: 12px; font-weight: 700; padding: 8px 0;">🔎 네이버 블로그 미리보기</summary>
        <div style="max-width: 640px; margin: 12px 0; background: white; border-radius: 12px; padding: 24px 28px; box-shadow: 0 6px 24px rgba(0,0,0,0.4); color: #1f2937; font-family: '나눔고딕', 'Noto Sans KR', sans-serif;">
          <div style="font-size: 12px; color: #03c75a; font-weight: 800; margin-bottom: 4px;">📝 NAVER 블로그</div>
          <div style="font-size: 14px; line-height: 1.7; word-wrap: break-word;">${body}</div>
        </div>
      </details>`;
  },

  pinterest: (f) => {
    const parts = f.parts || {};
    const title = escapeHtml(parts.pinTitle || '');
    const desc = escapeHtml(parts.description || '').replace(/\n/g, '<br>');
    return `
      <details style="margin-top: 14px;" open>
        <summary style="cursor: pointer; color: #cbd5e1; font-size: 12px; font-weight: 700; padding: 8px 0;">🔎 핀터레스트 미리보기</summary>
        <div style="max-width: 280px; margin: 12px 0; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 6px 24px rgba(0,0,0,0.4); color: #111;">
          <div style="aspect-ratio: 2 / 3; background: linear-gradient(135deg, #e60023, #ec4899); display: flex; align-items: center; justify-content: center; font-size: 48px;">📌</div>
          <div style="padding: 14px;">
            <div style="font-size: 14px; font-weight: 800; line-height: 1.3; margin-bottom: 6px;">${title}</div>
            <div style="font-size: 12px; color: #555; line-height: 1.4;">${desc}</div>
          </div>
        </div>
      </details>`;
  },
};

function _renderMultiOutput(platform, parts) {
  const labels = {
    tweet1: 'Tweet 1 (본문 미끼)',
    tweet2: 'Tweet 2 (첫 댓글)',
    personal: '개인 계정용',
    'group-comment': '그룹 댓글용',
    pinTitle: 'Pin Title',
    description: 'Description',
    boardSuggestion: 'Board Suggestion',
    imagePrompt: 'Image Prompt',
    script: 'Script',
    pinnedComment: 'Pinned Comment',
    caption: 'Caption',
    hashtags: '해시태그',
  };
  let html = '';
  let idx = 0;
  for (const [key, value] of Object.entries(parts)) {
    const safeKey = `extTrafficPart_${idx}`;
    const safeValue = escapeHtml(value || '');
    const label = key === 'imagePrompt' && _getExtTrafficAgentImageMode().isAgentMode
      ? 'Image Prompt (API 이미지 프롬프트)'
      : (labels[key] || key);
    const charCount = (value || '').length;
    html += `
      <div style="margin-bottom: 14px; padding: 12px 14px; background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(148,163,184,0.12); border-radius: 10px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <label style="color: #cbd5e1; font-size: 12px; font-weight: 800;">${escapeHtml(label)}</label>
          <span style="color: #64748b; font-size: 11px;">글자수: ${charCount}</span>
        </div>
        <textarea id="${safeKey}" readonly
          style="width: 100%; min-height: 100px; padding: 12px 14px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(148,163,184,0.15); border-radius: 8px; color: #e2e8f0; font-size: 13px; line-height: 1.6; font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; resize: vertical; box-sizing: border-box; white-space: pre-wrap;">${safeValue}</textarea>
        <button type="button" onclick="extTrafficCopyFromTextarea('${safeKey}')"
          style="margin-top: 8px; padding: 7px 12px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 7px; font-size: 12px; font-weight: 700; cursor: pointer;">📋 복사</button>
      </div>`;
    idx++;
  }
  return html;
}

// ─── 복사 / 바로가기 ────────────────────────────────────────────────
function extTrafficCopyResult() {
  extTrafficCopyFromTextarea('extTrafficResultText');
}

function extTrafficCopyFromTextarea(elementId) {
  const ta = document.getElementById(elementId);
  if (!ta) return;
  const value = ta.value || '';
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(() => {
        _flashToast('✅ 클립보드에 복사됐어요');
      }).catch(() => {
        ta.select();
        document.execCommand && document.execCommand('copy');
        _flashToast('✅ 클립보드에 복사됐어요');
      });
    } else {
      ta.select();
      document.execCommand && document.execCommand('copy');
      _flashToast('✅ 클립보드에 복사됐어요');
    }
  } catch {
    _flashToast('⚠️ 복사 실패 — 직접 선택 후 Ctrl+C 해주세요');
  }
}

function extTrafficCopyCombined(bodyId, hashtagsId) {
  const body = document.getElementById(bodyId);
  const tags = document.getElementById(hashtagsId);
  const combined = ((body && body.value) || '') + '\n\n' + ((tags && tags.value) || '');
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(combined).then(() => {
        _flashToast('✅ 본문 + 해시태그 복사됐어요');
      }).catch(() => {
        _flashToast('⚠️ 복사 실패');
      });
    } else {
      _flashToast('⚠️ 복사 불가 환경');
    }
  } catch {
    _flashToast('⚠️ 복사 실패');
  }
}

function extTrafficOpenPlatform(platformId) {
  const platform = PLATFORMS.find((p) => p.id === platformId);
  if (!platform || !platform.openUrl) return;
  // Electron preload의 openExternal 우선
  if (window.blogger && window.blogger.openExternal) {
    window.blogger.openExternal(platform.openUrl);
  } else if (window.electronAPI && window.electronAPI.openExternal) {
    window.electronAPI.openExternal(platform.openUrl);
  } else {
    window.open(platform.openUrl, '_blank');
  }
}

function _flashToast(message) {
  const t = document.createElement('div');
  t.textContent = message;
  t.style.cssText = `position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%); padding: 12px 22px; background: linear-gradient(135deg, #0f172a, #1e293b); border: 1px solid rgba(99,102,241,0.4); border-radius: 12px; color: #e2e8f0; font-size: 14px; font-weight: 700; box-shadow: 0 12px 32px rgba(0,0,0,0.4); z-index: 100050; opacity: 0; transition: opacity 0.25s ease, transform 0.25s ease;`;
  document.body.appendChild(t);
  requestAnimationFrame(() => {
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(-4px)';
  });
  setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 280);
  }, 2200);
}

// ─── v2 채널 등록 (백엔드와 동기화) ────────────────────────────────────
//   v2 IPC에서 동적으로 로드. 실패 시 fallback set 사용.
let _V2_CHANNELS = new Set([
  'instagram', 'threads', 'x', 'facebook', 'pinterest', 'naver-blog',
  'naver-cafe', 'kakao-openchat', 'youtube-shorts', 'tiktok',
]);
let _v2ChannelsLoaded = false;
let _v2ChannelMeta = {};  // id → {confidence, riskTier, category, ...}

async function _loadV2Channels() {
  if (_v2ChannelsLoaded) return;
  if (!window.electronAPI || !window.electronAPI.invoke) return;
  try {
    const result = await window.electronAPI.invoke('external-traffic-list-channels');
    if (result && result.success && Array.isArray(result.channels)) {
      _V2_CHANNELS = new Set(result.channels.map((c) => c.id));
      _v2ChannelMeta = Object.fromEntries(result.channels.map((c) => [c.id, c]));
      _v2ChannelsLoaded = true;
      console.log(`[EXT-TRAFFIC] v2 채널 ${result.channels.length}개 로드 완료`);
    }
  } catch (e) {
    console.warn('[EXT-TRAFFIC] v2 채널 목록 로드 실패 — fallback 사용:', e && e.message);
  }
}

function _isV2Channel(platformId) {
  return _V2_CHANNELS.has(platformId);
}

function _getV2Meta(platformId) {
  return _v2ChannelMeta[platformId] || null;
}

function _stripExtTrafficHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function _extractExtTrafficSourceText(source) {
  if (!source || typeof source !== 'object') return '';
  const raw = [
    source.summary,
    source.excerpt,
    source.metaDescription,
    source.description,
    source.content,
    source.html,
  ].filter(Boolean).join('\n\n');
  return _stripExtTrafficHtml(raw).slice(0, 8000);
}

function _extractExtTrafficSourceKeywords(source) {
  if (!source || typeof source !== 'object') return [];
  const direct = source.keywords || source.labels || source.tags || source.generatedLabels;
  if (Array.isArray(direct)) {
    return direct.map((kw) => String(kw || '').trim()).filter(Boolean).slice(0, 30);
  }
  if (typeof direct === 'string') {
    return direct.split(/[,#\s]+/).map((kw) => kw.trim()).filter(Boolean).slice(0, 30);
  }
  const text = `${source.title || ''} ${source.summary || ''}`;
  const stop = new Set(['그리고', '하지만', '입니다', '합니다', '있는', '없는', '방법', '정리', '확인']);
  return text
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((kw) => kw.trim())
    .filter((kw) => kw.length >= 2 && kw.length <= 20 && !stop.has(kw))
    .filter((kw, idx, arr) => arr.indexOf(kw) === idx)
    .slice(0, 12);
}

const EXT_TRAFFIC_ALL_PROGRESS_PLATFORM = {
  id: 'all-platforms',
  label: '전체 플랫폼',
  icon: '⚡',
  color: '#8b5cf6',
};

let _extTrafficProgressTimer = null;
let _extTrafficProgressState = null;

function _clearExtTrafficProgressTimer() {
  if (_extTrafficProgressTimer) {
    clearInterval(_extTrafficProgressTimer);
    _extTrafficProgressTimer = null;
  }
}

function _ensureExtTrafficProgressHost(platform) {
  let body = document.getElementById('extTrafficResultBody');
  if (!body && platform && platform.id !== 'all-platforms') {
    _activePlatformId = platform.id;
    _renderResultPanel(platform);
    body = document.getElementById('extTrafficResultBody');
  }
  if (!body && PLATFORMS[0]) {
    _activePlatformId = PLATFORMS[0].id;
    _renderResultPanel(PLATFORMS[0]);
    body = document.getElementById('extTrafficResultBody');
  }
  return body;
}

function _startExtTrafficProgress({ platform, total = 1, phase = '준비 중' }) {
  _clearExtTrafficProgressTimer();
  _extTrafficProgressState = {
    platform,
    total,
    current: 0,
    percent: 6,
    softCap: 86,
    phase,
    startedAt: Date.now(),
    logs: [],
  };
  _addExtTrafficProgressLog(`${platform.label} 생성 준비`, 'info', false);
  _renderExtTrafficProgress();
  _extTrafficProgressTimer = setInterval(() => {
    if (document.hidden) return;
    if (!_extTrafficProgressState) return;
    const cap = _extTrafficProgressState.softCap || 86;
    if (_extTrafficProgressState.percent < cap) {
      const inc = _extTrafficProgressState.total > 1 ? 1 : 2;
      _extTrafficProgressState.percent = Math.min(cap, _extTrafficProgressState.percent + inc);
      _renderExtTrafficProgress();
    }
  }, 850);
}

function _updateExtTrafficProgress(patch = {}) {
  if (!_extTrafficProgressState) return;
  _extTrafficProgressState = { ..._extTrafficProgressState, ...patch };
  if (typeof _extTrafficProgressState.percent === 'number') {
    _extTrafficProgressState.percent = Math.max(0, Math.min(100, Math.round(_extTrafficProgressState.percent)));
  }
  _renderExtTrafficProgress();
}

function _addExtTrafficProgressLog(message, type = 'info', rerender = true) {
  if (!_extTrafficProgressState) return;
  const time = new Date().toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  _extTrafficProgressState.logs.push({ time, message, type });
  if (_extTrafficProgressState.logs.length > 18) {
    _extTrafficProgressState.logs = _extTrafficProgressState.logs.slice(-18);
  }
  if (rerender) _renderExtTrafficProgress();
}

function _finishExtTrafficProgress() {
  _clearExtTrafficProgressTimer();
  if (_extTrafficProgressState) {
    _extTrafficProgressState.percent = 100;
    _extTrafficProgressState.phase = '완료';
    _renderExtTrafficProgress();
  }
}

function _getExtTrafficProgressLogsHtml(logs) {
  const color = {
    info: '#93c5fd',
    success: '#86efac',
    warning: '#fbbf24',
    error: '#fca5a5',
  };
  const rows = (logs || []).map((log) => `
    <div style="display:flex;gap:8px;align-items:flex-start;padding:5px 0;border-bottom:1px solid rgba(148,163,184,0.06);">
      <span style="width:66px;flex-shrink:0;color:#64748b;font-size:11px;font-variant-numeric:tabular-nums;">${escapeHtml(log.time)}</span>
      <span style="color:${color[log.type] || color.info};font-size:12px;line-height:1.45;">${escapeHtml(log.message)}</span>
    </div>`).join('');
  return rows || '<div style="color:#64748b;font-size:12px;">아직 로그가 없습니다.</div>';
}

function _renderExtTrafficProgress() {
  const state = _extTrafficProgressState;
  if (!state) return;
  const body = _ensureExtTrafficProgressHost(state.platform);
  if (!body) return;
  const platform = state.platform || EXT_TRAFFIC_ALL_PROGRESS_PLATFORM;
  const elapsed = Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000));
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const percent = Math.max(0, Math.min(100, Math.round(state.percent || 0)));
  const currentLabel = state.total > 1
    ? `${Math.min(state.current || 0, state.total)} / ${state.total}`
    : '1 / 1';
  body.innerHTML = `
    <div style="max-width: 760px; margin: 22px auto; padding: 22px; background: rgba(15,23,42,0.72); border: 1px solid rgba(148,163,184,0.14); border-radius: 16px; box-shadow: 0 18px 45px rgba(2,6,23,0.24);">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">
        ${_renderPlatformLogo(platform, 'header')}
        <div style="min-width:0;flex:1;">
          <div style="color:#f8fafc;font-size:17px;font-weight:900;">${escapeHtml(platform.label)} 글 생성 중</div>
          <div style="color:#94a3b8;font-size:12px;margin-top:4px;">${escapeHtml(state.phase || '진행 중')} · 경과 ${mm}:${ss}</div>
        </div>
        <div style="color:#e2e8f0;font-size:22px;font-weight:900;font-variant-numeric:tabular-nums;">${percent}%</div>
      </div>

      <div style="height:12px;background:rgba(148,163,184,0.14);border-radius:999px;overflow:hidden;margin-bottom:14px;">
        <div style="height:100%;width:${percent}%;background:linear-gradient(90deg,#10b981,#6366f1,#a855f7);border-radius:999px;transition:width 0.35s ease;"></div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:16px;">
        <div style="padding:10px 12px;background:rgba(30,41,59,0.55);border:1px solid rgba(148,163,184,0.10);border-radius:10px;">
          <div style="color:#64748b;font-size:10px;font-weight:900;margin-bottom:3px;">진행</div>
          <div style="color:#e2e8f0;font-size:13px;font-weight:800;">${currentLabel}</div>
        </div>
        <div style="padding:10px 12px;background:rgba(30,41,59,0.55);border:1px solid rgba(148,163,184,0.10);border-radius:10px;">
          <div style="color:#64748b;font-size:10px;font-weight:900;margin-bottom:3px;">상태</div>
          <div style="color:#e2e8f0;font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(state.phase || '진행 중')}</div>
        </div>
        <div style="padding:10px 12px;background:rgba(30,41,59,0.55);border:1px solid rgba(148,163,184,0.10);border-radius:10px;">
          <div style="color:#64748b;font-size:10px;font-weight:900;margin-bottom:3px;">대기</div>
          <div style="color:#e2e8f0;font-size:13px;font-weight:800;">응답 수신 중</div>
        </div>
      </div>

      <div style="padding:13px 14px;background:rgba(2,6,23,0.42);border:1px solid rgba(148,163,184,0.10);border-radius:12px;max-height:210px;overflow:auto;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;">
          <div style="color:#cbd5e1;font-size:12px;font-weight:900;">실시간 로그</div>
          <div style="color:#64748b;font-size:11px;">생성 흐름 확인용</div>
        </div>
        ${_getExtTrafficProgressLogsHtml(state.logs)}
      </div>
    </div>`;
}

// ─── LLM 호출 ────────────────────────────────────────────────
//   v2 채널 → 새 IPC (multi-output 분리·해시태그·riskScore 포함)
//   v1 채널 → 기존 IPC (단일 텍스트 반환)
async function _callLLM(platform, source) {
  const systemPrompt = platform.promptSystem;
  const userPrompt = platform.promptUser(source);
  const sourceText = _extractExtTrafficSourceText(source);
  const sourceKeywords = _extractExtTrafficSourceKeywords(source);
  const sourceType = source && (source.type || source.category || source.contentType || '');

  // v2 IPC 시도
  if (_isV2Channel(platform.id) && window.electronAPI && window.electronAPI.invoke) {
    try {
      const aiPreference = _getExtTrafficAiPreference();
      const imageModePayload = _getExtTrafficImageModePayload();
      const result = await window.electronAPI.invoke('generate-external-traffic-text-v2', {
        sourceUrl: source.url,
        sourceTitle: source.title,
        sourceText,
        sourceKeywords,
        sourceType,
        channels: [{ id: platform.id }],
        ...aiPreference,
        ...imageModePayload,
      });
      if (result && result.success && result.results && result.results[platform.id]) {
        const r = result.results[platform.id];
        if (r.error) throw new Error(r.error);
        return {
          isV2: true,
          rawText: r.rawText || '',
          formatted: r.formatted || {},
          risk: r.risk || null,
          lengthViolations: r.lengthViolations || [],
          instagram: r.instagram || null,
          threads: r.threads || null,
          naverBlog: r.naverBlog || null,
          naverCafe: r.naverCafe || null,
          x: r.x || null,
          facebook: r.facebook || null,
          kakaoOpenChat: r.kakaoOpenChat || null,
          youtubeShorts: r.youtubeShorts || null,
          tiktok: r.tiktok || null,
          pinterest: r.pinterest || null,
          attempt: r.attempt || 1,
        };
      }
      if (result && result.error) throw new Error(result.error);
    } catch (e) {
      console.warn(`[EXT-TRAFFIC] v2 IPC 실패 (${platform.id}), v1 폴백:`, e && e.message);
    }
  }

  // v1 IPC (백워드)
  if (window.electronAPI && window.electronAPI.invoke) {
    try {
      const aiPreference = _getExtTrafficAiPreference();
      const imageModePayload = _getExtTrafficImageModePayload();
      const result = await window.electronAPI.invoke('generate-external-traffic-text', {
        system: systemPrompt,
        user: userPrompt,
        ...aiPreference,
        ...imageModePayload,
      });
      if (result && result.success && result.text) {
        return { isV2: false, rawText: result.text };
      }
      if (result && result.error) throw new Error(result.error);
    } catch (e) {
      console.warn('[EXT-TRAFFIC] v1 IPC 실패:', e && e.message);
    }
  }
  return { isV2: false, rawText: `[${platform.label} 미리보기]\n\nLLM IPC 미구현. Gemini API 키 확인 또는 핸들러 설치 필요.` };
}

// ─── 생성 ────────────────────────────────────────────────
async function extTrafficGenerateOne(platformId) {
  if (!_selectedSource) {
    _flashToast('⚠️ 원본 글을 먼저 선택해주세요');
    return;
  }
  const platform = PLATFORMS.find((p) => p.id === platformId);
  if (!platform) return;

  // 일반 동의 확인
  await _ensureGeneralConsent();
  // 위험 채널 추가 동의
  const okChannel = await _ensureChannelConsent(platformId);
  if (!okChannel) {
    _flashToast('⏸️ 사용자가 취소했습니다');
    return;
  }

  // 로딩 표시
  const body = document.getElementById('extTrafficResultBody');
  if (body) {
    body.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: #cbd5e1;">
        <div style="font-size: 48px; margin-bottom: 12px;">✨</div>
        <div style="font-size: 14px; font-weight: 700; margin-bottom: 6px;">${platform.label}용 글 생성 중…</div>
        <div style="font-size: 12px; color: #64748b;">잠시만 기다려주세요 (보통 5~15초)</div>
      </div>`;
  }

  try {
    _startExtTrafficProgress({
      platform,
      total: 1,
      phase: '원본 글 분석 준비',
    });
    _updateExtTrafficProgress({ percent: 14, phase: '원본 글 분석 중', softCap: 88 });
    _addExtTrafficProgressLog('원본 제목, URL, 본문 요약을 정리합니다.', 'info');
    if (_getExtTrafficAgentImageMode().isAgentMode) {
      _addExtTrafficProgressLog('Agent 모드 — 이미지 프롬프트는 Orbit 이미지 엔진/API용으로 생성합니다.', 'info');
    }
    _addExtTrafficProgressLog(`${platform.label} 문체와 길이 규칙을 적용합니다.`, 'info');
    _updateExtTrafficProgress({ percent: 42, phase: 'AI 응답 대기 중', softCap: 88 });
    _addExtTrafficProgressLog('AI 생성 요청을 보냈습니다. 응답을 기다리는 중입니다.', 'info');
    const result = await _callLLM(platform, _selectedSource);
    _updateExtTrafficProgress({ percent: 90, phase: 'JSON 자동 복구 및 검증 중', softCap: 94 });
    _addExtTrafficProgressLog('응답을 받았습니다. JSON 구조와 최종 복사본을 검증합니다.', 'success');
    if (result && result.isV2) {
      const violations = Array.isArray(result.lengthViolations) ? result.lengthViolations.length : 0;
      _addExtTrafficProgressLog(`A/B/C 구조 파싱 완료 · 시도 ${result.attempt || 1}회 · 길이 검증 ${violations}건`, violations ? 'warning' : 'success');
    }
    _updateExtTrafficProgress({ percent: 96, phase: 'UI 결과 렌더링 중', softCap: 98 });
    _generatedCache.set(platformId, { ...result, sourceUrl: _getExtTrafficSourceUrl(), generatedAt: new Date().toISOString() });
    _finishExtTrafficProgress();
    _renderPlatformList(); // ✓ 마커 갱신
    _renderResultPanel(platform);
  } catch (e) {
    _clearExtTrafficProgressTimer();
    _addExtTrafficProgressLog(`생성 실패: ${e?.message || '알 수 없는 오류'}`, 'error');
    console.error('[EXT-TRAFFIC] 생성 실패:', e);
    if (body) {
      body.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: #fca5a5;">
          <div style="font-size: 48px; margin-bottom: 12px;">❌</div>
          <div style="font-size: 14px; font-weight: 700; margin-bottom: 6px;">${escapeHtml(platform.label)} 생성 실패</div>
          <div style="font-size: 12px;">${escapeHtml(e?.message || '알 수 없는 오류')}</div>
        </div>`;
    }
  }
}

async function extTrafficGenerateAll() {
  if (!_selectedSource) {
    _flashToast('⚠️ 원본 글을 먼저 선택해주세요');
    return;
  }
  await _ensureGeneralConsent();
  _startExtTrafficProgress({
    platform: EXT_TRAFFIC_ALL_PROGRESS_PLATFORM,
    total: PLATFORMS.length,
    phase: '전체 플랫폼 생성 준비',
  });
  _addExtTrafficProgressLog(`총 ${PLATFORMS.length}개 플랫폼을 순서대로 생성합니다.`, 'info');
  if (_getExtTrafficAgentImageMode().isAgentMode) {
    _addExtTrafficProgressLog('Agent 모드 — 이미지 관련 출력은 Orbit 이미지 엔진/API용으로 생성합니다.', 'info');
  }

  for (const [index, platform] of PLATFORMS.entries()) {
    try {
      const current = index + 1;
      const basePercent = Math.round((index / PLATFORMS.length) * 100);
      const softCap = Math.min(96, Math.round(((index + 0.82) / PLATFORMS.length) * 100));
      _updateExtTrafficProgress({
        platform,
        current: index,
        total: PLATFORMS.length,
        percent: Math.max(basePercent, 8),
        phase: `${current}/${PLATFORMS.length} ${platform.label} 생성 중`,
        softCap,
      });
      _addExtTrafficProgressLog(`${current}/${PLATFORMS.length} ${platform.label} 생성 요청`, 'info');
      const result = await _callLLM(platform, _selectedSource);
      _generatedCache.set(platform.id, { ...result, sourceUrl: _getExtTrafficSourceUrl(), generatedAt: new Date().toISOString() });
      _updateExtTrafficProgress({
        current,
        percent: Math.round((current / PLATFORMS.length) * 100),
        phase: `${platform.label} 완료`,
        softCap: Math.min(99, Math.round(((current + 0.15) / PLATFORMS.length) * 100)),
      });
      _addExtTrafficProgressLog(`${platform.label} 생성 완료`, 'success');
      _renderPlatformList(); // ✓ 진행 실시간 표시
    } catch (e) {
      _addExtTrafficProgressLog(`${platform.label} 생성 실패: ${e?.message || '알 수 없는 오류'}`, 'error');
      console.warn(`[EXT-TRAFFIC] ${platform.label} 생성 실패:`, e?.message);
    }
  }
  _finishExtTrafficProgress();
  _renderPlatformList();
  const active = PLATFORMS.find((p) => p.id === _activePlatformId && _generatedCache.has(p.id))
    || PLATFORMS.find((p) => _generatedCache.has(p.id))
    || PLATFORMS[0];
  if (active) {
    _activePlatformId = active.id;
    _renderResultPanel(active);
  }
  _flashToast(`✅ ${_generatedCache.size}개 플랫폼 생성 완료`);
}

// ─── 헬퍼 ────────────────────────────────────────────────
async function extTrafficGenerateSelected() {
  if (!_selectedSource) {
    _flashToast('원본 글을 먼저 선택해주세요');
    return;
  }
  const platforms = _getBatchSelectedPlatforms();
  if (platforms.length === 0) {
    _flashToast('생성할 플랫폼을 체크해주세요');
    return;
  }
  await _ensureGeneralConsent();
  _startExtTrafficProgress({
    platform: EXT_TRAFFIC_ALL_PROGRESS_PLATFORM,
    total: platforms.length,
    phase: '선택 플랫폼 생성 준비',
  });
  _addExtTrafficProgressLog(`선택한 ${platforms.length}개 플랫폼을 순서대로 생성합니다.`, 'info');

  let successCount = 0;
  for (const [index, platform] of platforms.entries()) {
    try {
      const current = index + 1;
      const basePercent = Math.round((index / platforms.length) * 100);
      const softCap = Math.min(96, Math.round(((index + 0.82) / platforms.length) * 100));
      _updateExtTrafficProgress({
        platform,
        current: index,
        total: platforms.length,
        percent: Math.max(basePercent, 8),
        phase: `${current}/${platforms.length} ${platform.label} 생성 중`,
        softCap,
      });
      _addExtTrafficProgressLog(`${current}/${platforms.length} ${platform.label} 생성 요청`, 'info');
      const result = await _callLLM(platform, _selectedSource);
      _generatedCache.set(platform.id, { ...result, sourceUrl: _getExtTrafficSourceUrl(), generatedAt: new Date().toISOString() });
      successCount++;
      _updateExtTrafficProgress({
        current,
        percent: Math.round((current / platforms.length) * 100),
        phase: `${platform.label} 완료`,
        softCap: Math.min(99, Math.round(((current + 0.15) / platforms.length) * 100)),
      });
      _addExtTrafficProgressLog(`${platform.label} 생성 완료`, 'success');
      _renderPlatformList();
    } catch (e) {
      _addExtTrafficProgressLog(`${platform.label} 생성 실패: ${e?.message || '알 수 없는 오류'}`, 'error');
      console.warn(`[EXT-TRAFFIC] ${platform.label} 선택 생성 실패:`, e?.message);
    }
  }
  _finishExtTrafficProgress();
  _renderPlatformList();
  const active = platforms.find((p) => _generatedCache.has(p.id))
    || PLATFORMS.find((p) => p.id === _activePlatformId && _generatedCache.has(p.id))
    || PLATFORMS.find((p) => _generatedCache.has(p.id));
  if (active) {
    _activePlatformId = active.id;
    _renderResultPanel(active);
  }
  _flashToast(`선택 플랫폼 ${successCount}/${platforms.length}개 생성 완료`);
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─── 탭 진입 시 초기화 ────────────────────────────────────────────────
let _activeSubtab = 'generate';

window.initExternalTrafficTab = async function () {
  console.log('[EXT-TRAFFIC] 탭 초기화');
  try { window.applyAgentImageSettingsVisibility?.(document.getElementById('external-traffic-tab') || document); } catch {}
  // v2 채널 백엔드 동기화 (비동기) — 실패 시 fallback set 유지
  _loadV2Channels().then(() => _renderPlatformList()).catch(() => {});
  _renderPlatformList();
  if (!_activePlatformId) _renderResultPlaceholder();
  // 첫 사용 시 일반 동의 확인
  _ensureGeneralConsent().catch((e) => console.warn('[EXT-TRAFFIC] 동의 확인 실패:', e && e.message));
  // 활성 서브탭 복원
  extTrafficShowSubtab(_activeSubtab);
};

// ─── 서브탭 전환 ────────────────────────────────────────────────
function extTrafficShowSubtab(subtab) {
  _activeSubtab = subtab;
  const all = ['generate', 'sites', 'usage', 'patterns'];
  for (const k of all) {
    const el = document.getElementById(`extTrafficSubtab-${k}`);
    if (el) el.style.display = k === subtab ? '' : 'none';
  }
  // 버튼 활성 상태
  document.querySelectorAll('.ext-subtab-btn').forEach((btn) => {
    const active = btn.getAttribute('data-subtab') === subtab;
    btn.style.background = active
      ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
      : 'rgba(255,255,255,0.04)';
    btn.style.color = active ? 'white' : '#cbd5e1';
  });
  // 콘텐츠 lazy-render
  if (subtab === 'sites') _renderInlineSites();
  else if (subtab === 'usage') _renderUsagePanel();
  else if (subtab === 'patterns') _renderPatternsPanel();
  try { window.applyAgentImageSettingsVisibility?.(document.getElementById('external-traffic-tab') || document); } catch {}
}
window.extTrafficShowSubtab = extTrafficShowSubtab;

function _renderInlineSites() {
  const wrap = document.getElementById('extTrafficInlineExtLinks');
  if (!wrap) return;
  const data = window._externalLinksData || (typeof getExternalLinksData === 'function' ? getExternalLinksData() : null);
  if (!data) {
    // 폴백 — 기존 모달 데이터를 못 가져온 경우 그냥 모달 열기 안내
    wrap.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: #cbd5e1;">
        <div style="font-size: 40px; margin-bottom: 12px;">🔗</div>
        <div style="font-size: 14px; margin-bottom: 16px;">사이트 모음 데이터를 로드할 수 없습니다.</div>
        <button type="button" onclick="window.openExternalLinksModal && window.openExternalLinksModal()" style="padding: 11px 18px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer;">📋 모달로 열기</button>
      </div>`;
    return;
  }
  let html = '';
  for (const category of Object.keys(data)) {
    const links = data[category];
    html += `
      <div style="margin-bottom: 28px;">
        <h3 style="font-size: 16px; font-weight: 800; color: #fbbf24; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(251, 191, 36, 0.25);">${escapeHtml(category)} <span style="color: #94a3b8; font-size: 12px; font-weight: 600;">(${links.length}개)</span></h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px;">
          ${links.map((link) => `
            <button type="button" onclick="window.blogger && window.blogger.openExternal && window.blogger.openExternal('${link.url}')"
              style="background: rgba(251, 191, 36, 0.08); border: 1px solid rgba(251, 191, 36, 0.25); border-radius: 10px; padding: 12px 14px; color: #fde68a; font-size: 13px; font-weight: 700; cursor: pointer; text-align: left; display: flex; flex-direction: column; gap: 4px;">
              <span>🔗 ${escapeHtml(link.name)}</span>
              ${link.note ? `<span style="font-size: 11px; color: rgba(253, 230, 138, 0.7); font-weight: 500;">${escapeHtml(link.note)}</span>` : ''}
            </button>
          `).join('')}
        </div>
      </div>`;
  }
  wrap.innerHTML = html;
}

async function _renderUsagePanel() {
  const wrap = document.getElementById('extTrafficUsagePanel');
  if (!wrap) return;
  wrap.innerHTML = `<div style="text-align: center; padding: 40px 20px; color: #cbd5e1;">사용량 조회 중…</div>`;
  try {
    if (!window.electronAPI || !window.electronAPI.invoke) throw new Error('NO_IPC');
    const res = await window.electronAPI.invoke('external-traffic-cost-summary');
    if (!res || !res.success) throw new Error(res && res.error || 'FAIL');
    const cm = res.currentMonth || {};
    const limits = res.limits || {};
    const block = res.blockState || {};
    const used = cm.totalTokens || 0;
    const limit = limits.monthlyTokens || 500000;
    const pct = Math.min(100, Math.round((used / limit) * 100));
    const costKRW = Math.round((cm.costUSD || 0) * 1350); // 환율 추정
    const byChannel = cm.byChannel || {};
    const channelRows = Object.entries(byChannel)
      .sort((a, b) => (b[1].tokens || 0) - (a[1].tokens || 0))
      .slice(0, 10)
      .map(([id, info]) => `
        <tr style="border-bottom: 1px solid rgba(148,163,184,0.08);">
          <td style="padding: 8px 12px; color: #e2e8f0; font-size: 12px;">${escapeHtml(id)}</td>
          <td style="padding: 8px 12px; text-align: right; color: #cbd5e1; font-size: 12px;">${(info.generations || 0).toLocaleString()}</td>
          <td style="padding: 8px 12px; text-align: right; color: #cbd5e1; font-size: 12px;">${(info.tokens || 0).toLocaleString()}</td>
          <td style="padding: 8px 12px; text-align: right; color: #cbd5e1; font-size: 12px;">$${(info.costUSD || 0).toFixed(4)}</td>
        </tr>`).join('');
    wrap.innerHTML = `
      <h3 style="margin: 0 0 14px; font-size: 18px; font-weight: 800; color: #f1f5f9;">📊 이번 달 사용량</h3>
      <div style="margin-bottom: 18px; padding: 16px 18px; background: rgba(15,23,42,0.7); border: 1px solid rgba(148,163,184,0.12); border-radius: 12px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
          <span style="color: #cbd5e1; font-size: 13px; font-weight: 700;">토큰</span>
          <span style="color: #e2e8f0; font-size: 13px;">${used.toLocaleString()} / ${limit.toLocaleString()} (${pct}%)</span>
        </div>
        <div style="height: 10px; background: rgba(148,163,184,0.12); border-radius: 99px; overflow: hidden;">
          <div style="height: 100%; width: ${pct}%; background: linear-gradient(90deg, #10b981, #6366f1); transition: width 0.3s;"></div>
        </div>
        <div style="display: flex; gap: 16px; margin-top: 12px; font-size: 12px; color: #94a3b8;">
          <span>💰 비용 추정: $${(cm.costUSD || 0).toFixed(4)} (~₩${costKRW.toLocaleString()})</span>
          ${block.exceeded ? `<span style="color: #f87171;">⛔ 상한 도달</span>` : `<span style="color: #34d399;">✅ 사용 가능</span>`}
        </div>
      </div>
      <div style="margin-bottom: 14px; display: flex; gap: 8px; align-items: center;">
        <label style="color: #cbd5e1; font-size: 12px; font-weight: 700;">월간 상한:</label>
        <input id="extTrafficLimitInput" type="number" min="10000" max="50000000" value="${limit}" style="padding: 8px 12px; background: rgba(15,23,42,0.7); border: 1px solid rgba(148,163,184,0.15); border-radius: 8px; color: #e2e8f0; font-size: 12px; width: 140px;">
        <button type="button" onclick="extTrafficSetLimit()" style="padding: 8px 14px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">상한 변경</button>
      </div>
      <h4 style="margin: 18px 0 10px; font-size: 14px; font-weight: 800; color: #cbd5e1;">채널별 (상위 10개)</h4>
      <div style="overflow: auto; max-height: 320px; background: rgba(15,23,42,0.5); border: 1px solid rgba(148,163,184,0.1); border-radius: 10px;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead style="background: rgba(15,23,42,0.7);">
            <tr>
              <th style="padding: 10px 12px; text-align: left; color: #94a3b8; font-size: 11px; font-weight: 800;">채널</th>
              <th style="padding: 10px 12px; text-align: right; color: #94a3b8; font-size: 11px; font-weight: 800;">생성수</th>
              <th style="padding: 10px 12px; text-align: right; color: #94a3b8; font-size: 11px; font-weight: 800;">토큰</th>
              <th style="padding: 10px 12px; text-align: right; color: #94a3b8; font-size: 11px; font-weight: 800;">비용</th>
            </tr>
          </thead>
          <tbody>${channelRows || `<tr><td colspan="4" style="padding: 14px; text-align: center; color: #64748b; font-size: 12px;">아직 사용 내역이 없습니다.</td></tr>`}</tbody>
        </table>
      </div>`;
  } catch (e) {
    wrap.innerHTML = `<div style="text-align: center; padding: 40px 20px; color: #f87171;">사용량 조회 실패: ${escapeHtml(e && e.message || 'unknown')}</div>`;
  }
}

async function extTrafficSetLimit() {
  const input = document.getElementById('extTrafficLimitInput');
  if (!input) return;
  const value = parseInt(input.value, 10);
  if (!Number.isFinite(value) || value < 10000) {
    _flashToast('⚠️ 10,000 이상의 숫자를 입력하세요');
    return;
  }
  try {
    const res = await window.electronAPI.invoke('external-traffic-cost-set-limit', { monthlyTokens: value });
    if (res && res.success) {
      _flashToast(`✅ 월간 상한 ${value.toLocaleString()} 토큰으로 변경됨`);
      _renderUsagePanel();
    } else throw new Error(res && res.error || 'FAIL');
  } catch (e) {
    _flashToast('⚠️ 상한 변경 실패');
  }
}
window.extTrafficSetLimit = extTrafficSetLimit;

async function _renderPatternsPanel() {
  const wrap = document.getElementById('extTrafficPatternsPanel');
  if (!wrap) return;
  wrap.innerHTML = `<div style="text-align: center; padding: 40px 20px; color: #cbd5e1;">설정 조회 중…</div>`;
  try {
    if (!window.electronAPI || !window.electronAPI.invoke) throw new Error('NO_IPC');
    const [consentList, pool, sched] = await Promise.all([
      window.electronAPI.invoke('external-traffic-consent-list'),
      window.electronAPI.invoke('external-traffic-pool-state'),
      window.electronAPI.invoke('external-traffic-scheduler-state'),
    ]);
    const consents = (consentList && consentList.records) || [];
    const optedIn = !!(pool && pool.optedIn);
    const schedState = (sched && sched.state) || {};
    const consentRows = consents.map((r) => `
      <tr style="border-bottom: 1px solid rgba(148,163,184,0.08);">
        <td style="padding: 8px 12px; color: #e2e8f0; font-size: 12px;">${escapeHtml(r.key || '')}</td>
        <td style="padding: 8px 12px; color: #cbd5e1; font-size: 12px;">${new Date(r.consentedAt).toLocaleString()}</td>
        <td style="padding: 8px 12px; color: #cbd5e1; font-size: 12px;">${new Date(r.expiresAt).toLocaleDateString()}</td>
        <td style="padding: 8px 12px; text-align: right;">
          <button type="button" onclick="extTrafficRevokeConsent('${escapeHtml(r.key || '')}')" style="padding: 4px 10px; background: rgba(239,68,68,0.18); color: #fca5a5; border: 1px solid rgba(239,68,68,0.35); border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">철회</button>
        </td>
      </tr>`).join('');
    wrap.innerHTML = `
      <h3 style="margin: 0 0 14px; font-size: 18px; font-weight: 800; color: #f1f5f9;">⚙️ 패턴·동의 관리</h3>
      <div style="margin-bottom: 18px; padding: 16px 18px; background: rgba(15,23,42,0.7); border: 1px solid rgba(148,163,184,0.12); border-radius: 12px;">
        <h4 style="margin: 0 0 10px; font-size: 14px; font-weight: 800; color: #cbd5e1;">🌐 익명 협력 풀</h4>
        <p style="margin: 0 0 12px; color: #94a3b8; font-size: 12px; line-height: 1.6;">
          참여 시: 익명 피드백 통계(사용자 ID 해시 + 채널 + verdict + score)만 공유 — 원문·URL·블로그 정보 전송 X.<br>
          미참여 시: 'inferred' 패턴만 사용 — 시간 갈수록 stale.
        </p>
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; color: #e2e8f0; font-size: 13px;">
          <input type="checkbox" id="extPoolCheckbox" ${optedIn ? 'checked' : ''} onchange="extTrafficTogglePool()" style="transform: scale(1.2);">
          <span>협력 풀 참여 (옵트인) — ${optedIn ? '<strong style="color: #34d399;">참여 중</strong>' : '<strong style="color: #94a3b8;">미참여</strong>'}</span>
        </label>
      </div>
      <div style="margin-bottom: 18px; padding: 16px 18px; background: rgba(15,23,42,0.7); border: 1px solid rgba(148,163,184,0.12); border-radius: 12px;">
        <h4 style="margin: 0 0 10px; font-size: 14px; font-weight: 800; color: #cbd5e1;">📋 동의 이력</h4>
        ${consents.length === 0 ? '<p style="color: #64748b; font-size: 12px;">아직 동의 기록이 없습니다.</p>' : `
        <table style="width: 100%; border-collapse: collapse;">
          <thead style="background: rgba(15,23,42,0.5);">
            <tr>
              <th style="padding: 10px 12px; text-align: left; color: #94a3b8; font-size: 11px; font-weight: 800;">키</th>
              <th style="padding: 10px 12px; text-align: left; color: #94a3b8; font-size: 11px; font-weight: 800;">동의 시점</th>
              <th style="padding: 10px 12px; text-align: left; color: #94a3b8; font-size: 11px; font-weight: 800;">만료</th>
              <th style="padding: 10px 12px; text-align: right; color: #94a3b8; font-size: 11px; font-weight: 800;"></th>
            </tr>
          </thead>
          <tbody>${consentRows}</tbody>
        </table>`}
      </div>
      <div style="padding: 16px 18px; background: rgba(15,23,42,0.7); border: 1px solid rgba(148,163,184,0.12); border-radius: 12px;">
        <h4 style="margin: 0 0 10px; font-size: 14px; font-weight: 800; color: #cbd5e1;">⏱️ 스케줄러 상태</h4>
        <div style="font-size: 12px; color: #94a3b8; line-height: 1.8;">
          마지막 캘리브레이션: ${schedState.lastCalibration ? new Date(schedState.lastCalibration).toLocaleString() : '<em>미실행</em>'}<br>
          마지막 재검증 체크: ${schedState.lastRevalidationCheck ? new Date(schedState.lastRevalidationCheck).toLocaleString() : '<em>미실행</em>'}<br>
          마지막 prune: ${schedState.lastPrune ? new Date(schedState.lastPrune).toLocaleString() : '<em>미실행</em>'}<br>
          stale 채널: ${(schedState.revalidationAlerts || []).length > 0 ? `<strong style="color: #fbbf24;">${(schedState.revalidationAlerts || []).join(', ')}</strong>` : '없음'}
        </div>
        <button type="button" onclick="extTrafficRunSchedulerNow()" style="margin-top: 12px; padding: 8px 14px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">🔄 지금 실행</button>
      </div>`;
  } catch (e) {
    wrap.innerHTML = `<div style="text-align: center; padding: 40px 20px; color: #f87171;">설정 조회 실패: ${escapeHtml(e && e.message || 'unknown')}</div>`;
  }
}

async function extTrafficTogglePool() {
  const cb = document.getElementById('extPoolCheckbox');
  if (!cb) return;
  try {
    const res = await window.electronAPI.invoke('external-traffic-pool-opt-in', { value: cb.checked });
    if (res && res.success) {
      _flashToast(cb.checked ? '✅ 협력 풀 참여 시작' : '⏸️ 협력 풀 참여 종료');
      _renderPatternsPanel();
    }
  } catch {
    _flashToast('⚠️ 변경 실패');
  }
}
window.extTrafficTogglePool = extTrafficTogglePool;

async function extTrafficRevokeConsent(key) {
  if (!confirm(`동의를 철회하시겠습니까?\n키: ${key}\n\n다음 사용 시 재동의를 요청합니다.`)) return;
  try {
    await window.electronAPI.invoke('external-traffic-consent-revoke', { key });
    _flashToast('✅ 동의 철회됨');
    _renderPatternsPanel();
  } catch {
    _flashToast('⚠️ 철회 실패');
  }
}
window.extTrafficRevokeConsent = extTrafficRevokeConsent;

async function extTrafficRunSchedulerNow() {
  try {
    const res = await window.electronAPI.invoke('external-traffic-scheduler-run-now');
    if (res && res.success) {
      _flashToast('✅ 스케줄러 1회 실행 완료');
      _renderPatternsPanel();
    }
  } catch {
    _flashToast('⚠️ 스케줄러 실행 실패');
  }
}
window.extTrafficRunSchedulerNow = extTrafficRunSchedulerNow;

// ─── 동의 / 약관 모달 ────────────────────────────────────────────────
async function _ensureGeneralConsent() {
  if (!window.electronAPI || !window.electronAPI.invoke) return;
  try {
    const result = await window.electronAPI.invoke('external-traffic-consent-check', { key: 'general' });
    if (result && result.success && result.needed === 'none') return;
    _showGeneralConsentModal(result && result.needed === 'renew');
  } catch (e) {
    console.warn('[EXT-TRAFFIC] consent check 실패:', e && e.message);
  }
}

function _showGeneralConsentModal(isRenewal) {
  if (document.getElementById('extTrafficConsentModal')) return;
  const modal = document.createElement('div');
  modal.id = 'extTrafficConsentModal';
  modal.style.cssText = 'position: fixed; inset: 0; z-index: 2147483000; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; padding: 20px;';
  modal.innerHTML = `
    <div style="background: linear-gradient(135deg, #0f172a, #1e293b); border: 1px solid rgba(99,102,241,0.4); border-radius: 16px; max-width: 720px; width: 100%; max-height: 90vh; overflow: auto; padding: 32px; color: #e2e8f0;">
      <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 900; color: #f1f5f9;">
        ${isRenewal ? '🔄 약관 재동의 (90일 갱신)' : '📋 외부유입 글 생성 — 약관 동의'}
      </h2>
      <p style="margin: 0 0 18px; color: #cbd5e1; font-size: 14px; line-height: 1.7;">
        본 도구는 <strong style="color: #fbbf24;">ban 위험을 줄이는 보조 장치</strong>이지 제거하지 않습니다.
        일부 채널(디시·더쿠 등)은 자기 홍보를 명시적으로 금지합니다.
        사용자는 자기 책임으로 도구를 사용함에 동의합니다.
      </p>
      <div style="background: rgba(15,23,42,0.5); border: 1px solid rgba(148,163,184,0.15); border-radius: 12px; padding: 18px; margin-bottom: 18px;">
        <label style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px; cursor: pointer; font-size: 14px; color: #e2e8f0;">
          <input type="checkbox" id="extConsent1" style="margin-top: 3px; transform: scale(1.2);">
          <span><strong>약관 전문 확인 (3분 소요)</strong> — 본 도구의 한계·위험·면책 조항을 인지함</span>
        </label>
        <label style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px; cursor: pointer; font-size: 14px; color: #e2e8f0;">
          <input type="checkbox" id="extConsent2" style="margin-top: 3px; transform: scale(1.2);">
          <span><strong>일부 채널의 자기 홍보 금지를 인지</strong> — 디시·더쿠·루리웹 등 자기 책임 게시</span>
        </label>
        <label style="display: flex; align-items: flex-start; gap: 10px; cursor: pointer; font-size: 14px; color: #e2e8f0;">
          <input type="checkbox" id="extConsent3" style="margin-top: 3px; transform: scale(1.2);">
          <span><strong>결과 게시 책임은 본인에게 있음</strong> — 정지·차단·법적 책임 사용자 부담</span>
        </label>
      </div>
      <p style="margin: 0 0 18px; color: #94a3b8; font-size: 12px; line-height: 1.6;">
        ⚠️ 본 도구는 <strong>베타</strong>이며, 외부 법무 자문이 미완료된 상태로 제공됩니다.<br>
        ✏️ 동의 시점·항목·약관 버전이 로컬에 영구 보존됩니다. 90일 후 갱신 동의 요청.
      </p>
      <div style="display: flex; gap: 10px;">
        <button id="extConsentAccept" type="button" disabled
          style="flex: 2; padding: 14px 22px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 800; cursor: pointer; opacity: 0.5;">
          ✅ 동의 + 시작
        </button>
        <button id="extConsentCancel" type="button"
          style="flex: 1; padding: 14px 22px; background: rgba(148,163,184,0.15); color: #cbd5e1; border: 1px solid rgba(148,163,184,0.25); border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer;">
          취소
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const checkboxes = ['extConsent1', 'extConsent2', 'extConsent3'].map((id) => document.getElementById(id));
  const acceptBtn = document.getElementById('extConsentAccept');
  function updateAccept() {
    const all = checkboxes.every((c) => c && c.checked);
    if (acceptBtn) {
      acceptBtn.disabled = !all;
      acceptBtn.style.opacity = all ? '1' : '0.5';
      acceptBtn.style.cursor = all ? 'pointer' : 'not-allowed';
    }
  }
  for (const c of checkboxes) if (c) c.addEventListener('change', updateAccept);

  if (acceptBtn) {
    acceptBtn.addEventListener('click', async () => {
      try {
        await window.electronAPI.invoke('external-traffic-consent-record', {
          key: 'general',
          consents: {
            readTerms: !!checkboxes[0].checked,
            understandBanRisk: !!checkboxes[1].checked,
            acceptResponsibility: !!checkboxes[2].checked,
          },
        });
        _flashToast('✅ 약관 동의 저장됨 (90일 유효)');
      } catch (e) {
        _flashToast('⚠️ 동의 저장 실패: ' + (e && e.message));
      }
      modal.remove();
    });
  }
  const cancelBtn = document.getElementById('extConsentCancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => modal.remove());
  }
}

async function _ensureChannelConsent(platformId) {
  if (!window.electronAPI || !window.electronAPI.invoke) return true;
  const meta = _getV2Meta(platformId);
  const riskTier = meta && meta.riskTier;
  if (riskTier !== 'critical' && riskTier !== 'high') return true;
  const key = `channel:${platformId}`;
  try {
    const result = await window.electronAPI.invoke('external-traffic-consent-check', { key });
    if (result && result.success && result.needed === 'none') return true;
  } catch (e) {
    return true; // 확인 실패 시 진행 (사용자 차단보다 안전)
  }
  return _showCriticalConsentModal(platformId, meta);
}

function _showCriticalConsentModal(platformId, meta) {
  return new Promise((resolve) => {
    if (document.getElementById('extTrafficCriticalModal')) return resolve(false);
    const modal = document.createElement('div');
    modal.id = 'extTrafficCriticalModal';
    const name = (meta && meta.name) || platformId;
    modal.style.cssText = 'position: fixed; inset: 0; z-index: 2147483000; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; padding: 20px;';
    modal.innerHTML = `
      <div style="background: linear-gradient(135deg, #0f172a, #1e293b); border: 1px solid rgba(239,68,68,0.5); border-radius: 16px; max-width: 680px; width: 100%; padding: 32px; color: #e2e8f0;">
        <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 900; color: #f87171;">
          ⚠️ ${name} — 위험 채널 추가 동의 (3단)
        </h2>
        <p style="margin: 0 0 18px; color: #fca5a5; font-size: 14px; line-height: 1.7;">
          본 채널은 <strong>자기 홍보 정지·차단 정책</strong>이 검증된 채널입니다.<br>
          본 도구의 결과를 그대로 게시하면 거의 100% 정지될 수 있습니다.
        </p>
        <div style="background: rgba(15,23,42,0.5); border: 1px solid rgba(239,68,68,0.3); border-radius: 12px; padding: 18px; margin-bottom: 18px;">
          <label style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px; cursor: pointer; font-size: 14px;">
            <input type="checkbox" id="extCritConsent1" style="margin-top: 3px; transform: scale(1.2);">
            <span><strong>1단: 운영 노하우 보유</strong> — 본 채널에서 5년+ 활동 또는 평판 기반</span>
          </label>
          <label style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px; cursor: pointer; font-size: 14px;">
            <input type="checkbox" id="extCritConsent2" style="margin-top: 3px; transform: scale(1.2);">
            <span><strong>2단: 직접 검토·수정</strong> — 결과를 그대로 사용하지 않고 직접 편집</span>
          </label>
          <label style="display: flex; align-items: flex-start; gap: 10px; cursor: pointer; font-size: 14px;">
            <input type="checkbox" id="extCritConsent3" style="margin-top: 3px; transform: scale(1.2);">
            <span><strong>3단: 모든 책임 부담</strong> — 정지·차단·IP 차단·법적 책임 본인 부담</span>
          </label>
        </div>
        <div style="display: flex; gap: 10px;">
          <button id="extCritAccept" type="button" disabled
            style="flex: 2; padding: 14px 22px; background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 800; cursor: pointer; opacity: 0.5;">
            모두 동의 — 변환 진행
          </button>
          <button id="extCritCancel" type="button"
            style="flex: 1; padding: 14px 22px; background: rgba(148,163,184,0.15); color: #cbd5e1; border: 1px solid rgba(148,163,184,0.25); border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer;">
            취소
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const cbs = ['extCritConsent1', 'extCritConsent2', 'extCritConsent3'].map((id) => document.getElementById(id));
    const ok = document.getElementById('extCritAccept');
    function update() {
      const all = cbs.every((c) => c && c.checked);
      if (ok) {
        ok.disabled = !all;
        ok.style.opacity = all ? '1' : '0.5';
        ok.style.cursor = all ? 'pointer' : 'not-allowed';
      }
    }
    for (const c of cbs) if (c) c.addEventListener('change', update);

    if (ok) ok.addEventListener('click', async () => {
      try {
        await window.electronAPI.invoke('external-traffic-consent-record', {
          key: `channel:${platformId}`,
          consents: {
            hasExperience: !!cbs[0].checked,
            willReview: !!cbs[1].checked,
            acceptResponsibility: !!cbs[2].checked,
          },
        });
      } catch (e) { /* 무시 */ }
      modal.remove();
      resolve(true);
    });
    const cancel = document.getElementById('extCritCancel');
    if (cancel) cancel.addEventListener('click', () => {
      modal.remove();
      resolve(false);
    });
  });
}

// ─── 전역 노출 ────────────────────────────────────────────────
window.openExtTrafficSourceModal = openExtTrafficSourceModal;
window.extTrafficSetSource = extTrafficSetSource;
window.extTrafficClearSource = extTrafficClearSource;
window.extTrafficSelectPlatform = extTrafficSelectPlatform;
window.extTrafficGenerateOne = extTrafficGenerateOne;
window.extTrafficGenerateAll = extTrafficGenerateAll;
window.extTrafficGenerateSelected = extTrafficGenerateSelected;
window.extTrafficToggleBatchPlatform = extTrafficToggleBatchPlatform;
window.extTrafficSelectBatchPlatforms = extTrafficSelectBatchPlatforms;
window.extTrafficCopyResult = extTrafficCopyResult;
window.extTrafficCopyFromTextarea = extTrafficCopyFromTextarea;
window.extTrafficCopyCombined = extTrafficCopyCombined;
window.extTrafficOpenPlatform = extTrafficOpenPlatform;
window.extTrafficSendFeedback = extTrafficSendFeedback;
window.extTrafficShowInstagramVariant = extTrafficShowInstagramVariant;
window.extTrafficCopyInstagramFinal = extTrafficCopyInstagramFinal;
window.extTrafficShowThreadsVariant = extTrafficShowThreadsVariant;
window.extTrafficCopyThreadsFinal = extTrafficCopyThreadsFinal;
window.extTrafficShowNaverBlogVariant = extTrafficShowNaverBlogVariant;
window.extTrafficCopyNaverBlogFinal = extTrafficCopyNaverBlogFinal;
window.extTrafficShowStructuredVariant = extTrafficShowStructuredVariant;
window.extTrafficCopyStructuredFinal = extTrafficCopyStructuredFinal;

console.log('[EXT-TRAFFIC] v3.8.0 모듈 로드 완료 (v2 IPC + multi-output + risk badge)');
