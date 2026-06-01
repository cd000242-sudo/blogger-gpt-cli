// external-traffic.js — v3.7.23 신규
//   외부유입 글 생성 탭. 발행한 글 1개를 선택해 각 플랫폼별로 변환 글을 생성한다.
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
  // 거미줄 모달 재사용 — single 모드로 동작하도록 임시 플래그 설정
  if (typeof window.openPublishedPostsModal !== 'function') {
    alert('발행글 목록 기능을 사용할 수 없습니다.');
    return;
  }
  // single-select 모드 마커 — 이후 선택 시 extTrafficOnSourcePicked로 콜백
  window._extTrafficSinglePickMode = true;
  window.openPublishedPostsModal();
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
        <h2 style="margin: 0; color: #f1f5f9; font-size: 20px; font-weight: 800;">${safeLabel}</h2>
        <p style="margin: 4px 0 0; color: #94a3b8; font-size: 12px;">선택 글을 ${safeLabel} 맞춤 글로 변환합니다.</p>
      </div>
      <button type="button" onclick="extTrafficGenerateOne('${platform.id}')"
        style="padding: 10px 18px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; border-radius: 10px; font-size: 13px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 14px rgba(99,102,241,0.35); white-space: nowrap;">
        ${cached ? '🔄 다시 생성' : '✨ 생성하기'}
      </button>
    </header>

    <div id="extTrafficResultBody" style="min-height: 280px;">
      ${cached ? _renderResultCard(platform, cached.text) : _renderEmptyState()}
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

function _renderResultCard(platform, text) {
  const safeText = escapeHtml(text);
  const safeOpenUrl = escapeHtml(platform.openUrl || '#');
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

// ─── 복사 / 바로가기 ────────────────────────────────────────────────
function extTrafficCopyResult() {
  const ta = document.getElementById('extTrafficResultText');
  if (!ta) return;
  ta.select();
  try {
    navigator.clipboard.writeText(ta.value).then(() => {
      _flashToast('✅ 클립보드에 복사됐어요');
    }).catch(() => {
      document.execCommand && document.execCommand('copy');
      _flashToast('✅ 클립보드에 복사됐어요');
    });
  } catch {
    _flashToast('⚠️ 복사 실패 — 직접 선택 후 Ctrl+C 해주세요');
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

// ─── LLM 호출 ────────────────────────────────────────────────
async function _callLLM(systemPrompt, userPrompt) {
  // electronAPI.invoke('generate-text', {...}) 또는 blogger.invokeGemini 사용
  const messages = `${systemPrompt}\n\n${userPrompt}`;
  if (window.electronAPI && window.electronAPI.invoke) {
    try {
      const result = await window.electronAPI.invoke('generate-external-traffic-text', {
        system: systemPrompt,
        user: userPrompt,
      });
      if (result && result.success && result.text) return result.text;
      if (result && result.error) throw new Error(result.error);
    } catch (e) {
      // 폴백 — Gemini 직접 호출 IPC가 있을 경우 시도
      console.warn('[EXT-TRAFFIC] generate-external-traffic-text 미구현 또는 실패:', e?.message);
    }
  }
  // 최종 폴백: 간단한 임시 결과 (개발용)
  return `[${systemPrompt.split(' ')[0] || '플랫폼'} 미리보기]\n\n${userPrompt}\n\n⚠️ LLM IPC가 아직 구현되지 않았습니다. Gemini API 키 확인 또는 generate-external-traffic-text IPC 핸들러 추가 필요.`;
}

// ─── 생성 ────────────────────────────────────────────────
async function extTrafficGenerateOne(platformId) {
  if (!_selectedSource) {
    _flashToast('⚠️ 원본 글을 먼저 선택해주세요');
    return;
  }
  const platform = PLATFORMS.find((p) => p.id === platformId);
  if (!platform) return;

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
    const text = await _callLLM(platform.promptSystem, platform.promptUser(_selectedSource));
    _generatedCache.set(platformId, { text, generatedAt: new Date().toISOString() });
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
      const text = await _callLLM(platform.promptSystem, platform.promptUser(_selectedSource));
      _generatedCache.set(platform.id, { text, generatedAt: new Date().toISOString() });
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
window.initExternalTrafficTab = function () {
  console.log('[EXT-TRAFFIC] 탭 초기화');
  _renderPlatformList();
  if (!_activePlatformId) _renderResultPlaceholder();
};

// ─── 전역 노출 ────────────────────────────────────────────────
window.openExtTrafficSourceModal = openExtTrafficSourceModal;
window.extTrafficSetSource = extTrafficSetSource;
window.extTrafficClearSource = extTrafficClearSource;
window.extTrafficSelectPlatform = extTrafficSelectPlatform;
window.extTrafficGenerateOne = extTrafficGenerateOne;
window.extTrafficGenerateAll = extTrafficGenerateAll;
window.extTrafficCopyResult = extTrafficCopyResult;
window.extTrafficOpenPlatform = extTrafficOpenPlatform;

console.log('[EXT-TRAFFIC] v3.7.23 모듈 로드 완료');
