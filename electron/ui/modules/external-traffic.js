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
    promptSystem: `당신은 한국 인스타그램 마케터입니다. 캡션 ≤2,200자, 친근한 존댓말, 이모지 3~5개, 줄바꿈 자주. 본문 링크 클릭 불가 → "프로필 링크 클릭 ✨" CTA로 유도. 끝에 해시태그 메인1+중간5~10+롱테일5~10.`,
    promptUser: (src) => `원본 블로그: "${src.title}"\n원본 URL: ${src.url}\n\n인스타 캡션 본문(2,200자 이내) + 마지막에 "프로필 링크 클릭" CTA + 해시태그를 만드세요. 자극·낚시 금지, 정보 70% + 호기심 30%.`,
  },
  {
    id: 'threads',
    label: 'Threads',
    icon: '🧵',
    openUrl: 'https://www.threads.com/',
    color: '#000000',
    promptSystem: `당신은 한국 Threads 마케터입니다. 500자 이내, 첫 줄은 강한 후킹 질문/반전, inline 링크는 1~2개만 (게시물당 5개 cap). 어조는 친근한 존댓말 또는 반말 (페르소나에 맞게).`,
    promptUser: (src) => `원본 블로그: "${src.title}"\n원본 URL: ${src.url}\n\nThreads 게시물 1개를 작성하세요 (500자 이내). 첫 줄은 도발적 질문 또는 반전 정보. 끝에 "전체 글: ${src.url}".`,
  },
  {
    id: 'naver-blog',
    label: '네이버 블로그',
    icon: '📝',
    openUrl: 'https://blog.naver.com/',
    color: '#03c75a',
    promptSystem: `당신은 한국 네이버 블로그 운영자입니다. 정보 공유체 + 친근한 존댓말, 이모지 적당. 본문 1,200~2,500자. 사진 자리 표시는 [사진 자리] 로. 키워드 자연 분포, SEO 친화.`,
    promptUser: (src) => `원본 블로그: "${src.title}"\n원본 URL: ${src.url}\n\n네이버 블로그 글 1편을 작성하세요. 본문 1,200~2,500자 + 자연스러운 [사진 자리] 표시 2~3곳 + 말미 "더 자세한 내용: ${src.url}". 검색 친화적 어조.`,
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
    id: 'pinterest',
    label: '핀터레스트',
    icon: '📌',
    openUrl: 'https://www.pinterest.com/pin-builder/',
    color: '#e60023',
    promptSystem: `당신은 한국 핀터레스트 크리에이터입니다. 핀 제목 ≤100자(검색 친화 키워드 풍부), description ≤500자, 인포그래픽 이미지 설명까지 출력. 핀 자체가 외부 링크라 직접 ${'${URL}'} 매핑.`,
    promptUser: (src) => `원본 블로그: "${src.title}"\n원본 URL: ${src.url}\n\n핀터레스트 4가지를 출력하세요:\n[Pin Title] 검색 키워드 풍부 (≤100자)\n[Description] ≤500자, 키워드 자연 분포, 끝에 ${src.url}\n[Board Suggestion] 어떤 보드에 핀할지 추천\n[Image Prompt] 인포그래픽 이미지 생성용 영문 프롬프트 (사용자가 별도 도구로 생성)`,
  },
];

// ─── 상태 ────────────────────────────────────────────────
let _selectedSource = null; // { title, url, html, thumbnail, ... }
let _activePlatformId = null;
const _generatedCache = new Map(); // platformId → { text, generatedAt }

// ─── 발행글 목록 모달 (single-select 모드) ────────────────────────────────────────────────
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
function _renderPlatformList() {
  const wrap = document.getElementById('extTrafficPlatformList');
  if (!wrap) return;
  wrap.innerHTML = PLATFORMS.map((p) => {
    const isActive = _activePlatformId === p.id;
    const hasCache = _generatedCache.has(p.id);
    return `
      <button type="button" data-platform="${p.id}" onclick="extTrafficSelectPlatform('${p.id}')"
        style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: ${isActive ? 'linear-gradient(135deg, rgba(99,102,241,0.22), rgba(168,85,247,0.18))' : 'rgba(255,255,255,0.04)'}; border: 1px solid ${isActive ? 'rgba(99,102,241,0.4)' : 'rgba(148,163,184,0.1)'}; border-radius: 10px; color: #e2e8f0; font-size: 13px; font-weight: 600; cursor: pointer; width: 100%; text-align: left; transition: all 0.15s ease;"
        onmouseover="if(!this.classList.contains('is-active')) { this.style.background='rgba(255,255,255,0.08)'; }"
        onmouseout="if(!this.classList.contains('is-active')) { this.style.background='rgba(255,255,255,0.04)'; }">
        <span style="font-size: 18px; flex-shrink: 0;">${p.icon}</span>
        <span style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.label}</span>
        ${hasCache ? '<span style="font-size: 10px; color: #34d399;" title="생성됨">✓</span>' : ''}
      </button>`;
  }).join('');
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
  const safeIcon = platform.icon;
  const safeLabel = escapeHtml(platform.label);

  wrap.innerHTML = `
    <header style="display: flex; align-items: center; gap: 14px; margin-bottom: 18px; padding-bottom: 16px; border-bottom: 1px solid rgba(148,163,184,0.1);">
      <div style="width: 48px; height: 48px; border-radius: 12px; background: ${platform.color}22; border: 1px solid ${platform.color}44; display: flex; align-items: center; justify-content: center; font-size: 26px;">${safeIcon}</div>
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
    const label = labels[key] || key;
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

// ─── LLM 호출 ────────────────────────────────────────────────
//   v2 채널 → 새 IPC (multi-output 분리·해시태그·riskScore 포함)
//   v1 채널 → 기존 IPC (단일 텍스트 반환)
async function _callLLM(platform, source) {
  const systemPrompt = platform.promptSystem;
  const userPrompt = platform.promptUser(source);

  // v2 IPC 시도
  if (_isV2Channel(platform.id) && window.electronAPI && window.electronAPI.invoke) {
    try {
      const result = await window.electronAPI.invoke('generate-external-traffic-text-v2', {
        sourceUrl: source.url,
        sourceTitle: source.title,
        channels: [{ id: platform.id }],
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
      const result = await window.electronAPI.invoke('generate-external-traffic-text', {
        system: systemPrompt,
        user: userPrompt,
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
    const result = await _callLLM(platform, _selectedSource);
    _generatedCache.set(platformId, { ...result, generatedAt: new Date().toISOString() });
    _renderPlatformList(); // ✓ 마커 갱신
    _renderResultPanel(platform);
  } catch (e) {
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
  for (const platform of PLATFORMS) {
    try {
      const result = await _callLLM(platform, _selectedSource);
      _generatedCache.set(platform.id, { ...result, generatedAt: new Date().toISOString() });
      _renderPlatformList(); // ✓ 진행 실시간 표시
    } catch (e) {
      console.warn(`[EXT-TRAFFIC] ${platform.label} 생성 실패:`, e?.message);
    }
  }
  _flashToast(`✅ ${_generatedCache.size}개 플랫폼 생성 완료`);
}

// ─── 헬퍼 ────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─── 탭 진입 시 초기화 ────────────────────────────────────────────────
let _activeSubtab = 'generate';

window.initExternalTrafficTab = async function () {
  console.log('[EXT-TRAFFIC] 탭 초기화');
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
window.extTrafficCopyResult = extTrafficCopyResult;
window.extTrafficCopyFromTextarea = extTrafficCopyFromTextarea;
window.extTrafficCopyCombined = extTrafficCopyCombined;
window.extTrafficOpenPlatform = extTrafficOpenPlatform;
window.extTrafficSendFeedback = extTrafficSendFeedback;

console.log('[EXT-TRAFFIC] v3.8.0 모듈 로드 완료 (v2 IPC + multi-output + risk badge)');
