// 📋 생성된 글목록 탭 — 블로그스팟/워드프레스/티스토리에 발행된 글을 목록으로 보여주고, 비주얼 편집기로 수정발행한다.
// 목록은 항상 각 플랫폼에서 직접 가져오므로 새로고침 시 블로그에서 삭제/수동수정한 내용이 그대로 반영된다.
import { addLog } from './core.js';
import { loadSettings } from './settings.js';

const PAGE_SIZE = 20;

// 플랫폼별 차이(IPC 채널·본문 확보 방식·안내 문구)를 한곳에 모아 렌더 코드는 분기 없이 동작하게 한다.
const PLATFORMS = [
  {
    key: 'blogspot',
    label: '블로그스팟',
    icon: '🅑',
    listChannel: 'blogger-list-posts',
    editorKind: 'blogger',
    // 목록 응답에 본문(content)이 포함되는가 — false면 편집 직전에 따로 읽어온다
    listHasContent: true,
    detailChannel: null,
    loadingText: '⏳ 블로그스팟에서 글 목록을 불러오는 중…',
    authHint: '🔒 Blogger 인증이 필요합니다. <b>환경설정 → Blogger OAuth2 인증</b>을 진행한 뒤 새로고침해주세요.',
    notice: '',
  },
  {
    key: 'wordpress',
    label: '워드프레스',
    icon: 'Ⓦ',
    listChannel: 'wordpress-list-posts',
    editorKind: 'wordpress',
    listHasContent: true,
    detailChannel: null,
    loadingText: '⏳ 워드프레스에서 글 목록을 불러오는 중…',
    authHint: '🔒 워드프레스 인증이 필요합니다. <b>환경설정 → 워드프레스</b>에서 사이트 주소·관리자 ID·Application Password를 저장한 뒤 새로고침해주세요.',
    notice: '',
  },
  {
    key: 'tistory',
    label: '티스토리',
    icon: 'Ⓣ',
    listChannel: 'tistory-list-posts',
    editorKind: 'tistory',
    listHasContent: false,
    detailChannel: 'tistory-get-post',
    loadingText: '⏳ 티스토리 관리 화면에서 글 목록을 불러오는 중… (브라우저를 여는 첫 회는 30초 정도 걸립니다)',
    authHint: '🔒 티스토리 로그인이 필요합니다. <b>환경설정 → 티스토리</b>에서 블로그 주소를 저장하고 카카오 로그인을 완료한 뒤 새로고침해주세요.',
    notice: '티스토리는 공개 API가 없어 로그인된 브라우저로 관리 화면을 직접 다룹니다. 목록·본문 불러오기와 수정발행에 시간이 걸리고, 진행 중에는 브라우저 창이 잠깐 나타날 수 있습니다.',
  },
];

function getPlatform(key) {
  return PLATFORMS.find((item) => item.key === key) || PLATFORMS[0];
}

/**
 * 플랫폼별 접속에 필요한 설정을 발행 경로와 동일한 소스에서 모아준다.
 *
 * 티스토리는 공개 API가 없어 블로그 주소로 관리 화면 URL을 만들어야 하는데,
 * 이 값은 화면 입력칸/저장설정에 있고 .env에는 없을 수 있다.
 * (블로그스팟·워드프레스는 메인 프로세스가 토큰/자격증명을 직접 들고 있어 빈 값이어도 무방)
 */
async function buildPlatformPayload(platformKey) {
  if (platformKey !== 'tistory') return undefined;
  try {
    const settings = await loadSettings() || {};
    const blogName = (
      document.getElementById('tistoryBlogName')?.value
      || settings.tistoryBlogName
      || settings.TISTORY_BLOG_NAME
      || settings.tistoryBlogUrl
      || ''
    ).trim();
    return blogName ? { tistoryBlogName: blogName } : undefined;
  } catch (err) {
    console.warn('[POSTS-TAB] 티스토리 설정 로드 실패 — .env 값으로 시도합니다:', err);
    return undefined;
  }
}

const state = {
  active: PLATFORMS[0].key,
  rendered: false,
  byPlatform: PLATFORMS.reduce((acc, platform) => {
    acc[platform.key] = { items: [], nextPageToken: null, loading: false, loaded: false };
    return acc;
  }, {}),
};

function activeState() {
  return state.byPlatform[state.active];
}

function esc(text) {
  return String(text || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function extractThumb(item) {
  if (item.imageUrl) return item.imageUrl;
  const m = String(item.content || '').match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : '';
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function renderTabs() {
  return PLATFORMS.map((platform) => {
    const active = platform.key === state.active;
    return `
      <button class="ppTabBtn" data-platform="${platform.key}"
        style="padding:10px 18px;border:1px solid ${active ? '#6366f1' : '#334155'};border-radius:10px;font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap;
               background:${active ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : '#1e293b'};color:${active ? '#fff' : '#94a3b8'};">
        ${platform.icon} ${platform.label}
      </button>
    `;
  }).join('');
}

export function initPublishedPostsTab() {
  const tab = document.getElementById('published-posts-tab');
  if (!tab) return;

  if (!state.rendered) {
    state.rendered = true;
    tab.innerHTML = `
      <div style="max-width: 1100px; margin: 0 auto; padding: 24px 20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:8px;">
          <div>
            <h2 style="margin:0;font-size:22px;font-weight:900;color:#f1f5f9;">📋 생성된 글목록</h2>
            <p style="margin:6px 0 0;font-size:13px;color:#94a3b8;">
              블로그에 발행된 글을 최신순으로 보여줍니다. 글을 클릭하면 미리보기에서 바로 수정하고 <b style="color:#a5b4fc;">수정발행</b>할 수 있어요.
              블로그에서 직접 삭제/수정한 글은 🔄 새로고침하면 그대로 반영됩니다.
            </p>
          </div>
          <button id="ppRefreshBtn" style="padding:11px 18px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;border-radius:10px;font-weight:900;font-size:13px;cursor:pointer;box-shadow:0 4px 14px rgba(99,102,241,0.3);white-space:nowrap;">
            🔄 새로고침
          </button>
        </div>
        <div id="ppTabs" style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 10px;">${renderTabs()}</div>
        <div id="ppNotice" style="display:none;font-size:12px;color:#cbd5e1;background:#0f172a;border:1px solid #334155;border-radius:10px;padding:10px 14px;margin-bottom:10px;line-height:1.6;"></div>
        <div id="ppStatus" style="min-height:18px;font-size:12px;color:#94a3b8;margin-bottom:12px;"></div>
        <div id="ppList" style="display:flex;flex-direction:column;gap:10px;"></div>
        <div style="text-align:center;margin-top:16px;">
          <button id="ppMoreBtn" style="display:none;padding:10px 22px;background:#334155;color:#e2e8f0;border:none;border-radius:10px;font-weight:800;font-size:13px;cursor:pointer;">
            ⬇️ 더 불러오기
          </button>
        </div>
      </div>
    `;
    tab.querySelector('#ppRefreshBtn').addEventListener('click', () => refreshPosts());
    tab.querySelector('#ppMoreBtn').addEventListener('click', () => loadPosts({ append: true }));
    tab.querySelector('#ppTabs').addEventListener('click', (e) => {
      const btn = e.target.closest('.ppTabBtn');
      if (btn) switchPlatform(btn.getAttribute('data-platform'));
    });
    window.__refreshPublishedPosts = () => refreshPosts();
    // 편집기(editor.js)의 수정발행도 목록과 똑같은 플랫폼 설정을 쓰도록 노출
    window.__buildPublishedPlatformPayload = (platformKey) => buildPlatformPayload(platformKey);
  }

  syncPlatformView();

  const current = activeState();
  if (!current.loaded && !current.loading) {
    refreshPosts();
  }
}

function switchPlatform(key) {
  if (!key || key === state.active) return;
  state.active = key;

  const tabs = document.getElementById('ppTabs');
  if (tabs) tabs.innerHTML = renderTabs();
  syncPlatformView();

  const current = activeState();
  if (!current.loaded && !current.loading) {
    refreshPosts();
  }
}

/** 플랫폼 전환 시 목록/안내/상태 표시를 해당 플랫폼의 캐시된 상태로 되돌린다 */
function syncPlatformView() {
  const platform = getPlatform(state.active);
  const current = activeState();

  const notice = document.getElementById('ppNotice');
  if (notice) {
    notice.style.display = platform.notice ? 'block' : 'none';
    notice.textContent = platform.notice;
  }

  renderList();

  const statusEl = document.getElementById('ppStatus');
  if (statusEl && !current.loading) {
    if (!current.loaded) {
      statusEl.textContent = '';
    } else {
      statusEl.textContent = current.items.length
        ? `${platform.label} · 총 ${current.items.length}개 표시`
        : `${platform.label}에 발행된 글이 없습니다. 글을 발행하면 여기에 표시됩니다.`;
    }
  }

  const moreBtn = document.getElementById('ppMoreBtn');
  if (moreBtn) moreBtn.style.display = current.nextPageToken ? 'inline-block' : 'none';
}

async function refreshPosts() {
  const current = activeState();
  current.items = [];
  current.nextPageToken = null;
  const list = document.getElementById('ppList');
  if (list) list.innerHTML = '';
  await loadPosts({ append: false });
}

async function loadPosts({ append }) {
  const platform = getPlatform(state.active);
  const current = activeState();
  if (current.loading) return;
  current.loading = true;

  const statusEl = document.getElementById('ppStatus');
  const moreBtn = document.getElementById('ppMoreBtn');
  if (statusEl) statusEl.textContent = platform.loadingText;
  if (moreBtn) moreBtn.disabled = true;

  try {
    const res = await window.electronAPI.invoke(platform.listChannel, {
      maxResults: PAGE_SIZE,
      pageToken: append ? (current.nextPageToken || undefined) : undefined,
      // 티스토리는 .env가 아니라 화면 설정(블로그 주소)이 있어야 관리 화면을 열 수 있다.
      // 발행 경로와 같은 값을 실어 보내 "발행은 되는데 목록만 안 나오는" 불일치를 없앤다.
      payload: await buildPlatformPayload(platform.key),
    });

    // 응답 대기 중 사용자가 다른 플랫폼 탭으로 옮겼다면 화면을 덮어쓰지 않는다
    const stillActive = state.active === platform.key;

    if (!res?.ok) {
      const msg = res?.error || '알 수 없는 오류';
      if (statusEl && stillActive) {
        statusEl.innerHTML = res?.needsAuth ? platform.authHint : `❌ 글 목록을 불러오지 못했습니다: ${esc(msg)}`;
      }
      addLog(`❌ ${platform.label} 글 목록 조회 실패: ${msg}`, 'error');
      return;
    }

    current.items = append ? current.items.concat(res.items || []) : (res.items || []);
    current.nextPageToken = res.nextPageToken || null;
    current.loaded = true;
    if (!stillActive) return;

    renderList();
    if (statusEl) {
      statusEl.textContent = current.items.length
        ? `${platform.label} · 총 ${current.items.length}개 표시 · 마지막 새로고침 ${new Date().toLocaleTimeString('ko-KR')}`
        : `${platform.label}에 발행된 글이 없습니다. 글을 발행하면 여기에 표시됩니다.`;
    }
  } catch (err) {
    console.error('[POSTS-TAB] 목록 로드 실패:', err);
    if (statusEl) statusEl.textContent = `❌ 오류: ${err?.message || err}`;
  } finally {
    current.loading = false;
    if (moreBtn) {
      moreBtn.disabled = false;
      moreBtn.style.display = (state.active === platform.key && current.nextPageToken) ? 'inline-block' : 'none';
    }
  }
}

function renderList() {
  const list = document.getElementById('ppList');
  if (!list) return;

  const current = activeState();
  list.innerHTML = current.items.map((item, i) => {
    const thumb = extractThumb(item);
    const edited = item.updated && item.published && item.updated.slice(0, 19) !== item.published.slice(0, 19);
    return `
      <div class="ppCard" data-index="${i}" style="display:flex;align-items:center;gap:14px;background:#1e293b;border:1px solid #334155;border-radius:14px;padding:14px 16px;cursor:pointer;transition:border-color .15s;"
        onmouseover="this.style.borderColor='#6366f1'" onmouseout="this.style.borderColor='#334155'">
        <div style="width:86px;height:56px;flex-shrink:0;border-radius:9px;overflow:hidden;background:#0f172a;display:flex;align-items:center;justify-content:center;">
          ${thumb
            ? `<img src="${esc(thumb)}" alt="" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">`
            : '<span style="font-size:22px;">📝</span>'}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:800;color:#f1f5f9;font-size:14px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(item.title || '(제목 없음)')}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:5px;">
            발행 ${esc(formatDate(item.published))}
            ${edited ? ` · <span style="color:#fbbf24;">수정됨 ${esc(formatDate(item.updated))}</span>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button class="ppEditBtn" data-index="${i}" style="padding:9px 16px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;border-radius:9px;font-weight:800;font-size:12px;cursor:pointer;">✏️ 미리보기·수정</button>
          <button class="ppOpenBtn" data-index="${i}" style="padding:9px 12px;background:#334155;color:#93c5fd;border:none;border-radius:9px;font-weight:700;font-size:12px;cursor:pointer;">🔗 글 열기</button>
        </div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.ppCard').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.ppOpenBtn')) return; // 링크 버튼은 별도 처리
      openEditorFor(Number(card.getAttribute('data-index')));
    });
  });
  list.querySelectorAll('.ppOpenBtn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = activeState().items[Number(e.currentTarget.getAttribute('data-index'))];
      if (item?.url) {
        (window.blogger?.openLink ? window.blogger.openLink(item.url) : window.electronAPI.invoke('open-link', item.url));
      }
    });
  });
}

async function openEditorFor(index) {
  const platform = getPlatform(state.active);
  const item = activeState().items[index];
  if (!item) return;

  let html = String(item.content || '');
  let title = item.title;

  // 티스토리처럼 목록에 본문이 없는 플랫폼은 편집 직전에 원본 HTML을 읽어온다
  if (!platform.listHasContent && platform.detailChannel) {
    const statusEl = document.getElementById('ppStatus');
    if (statusEl) statusEl.textContent = `⏳ ${platform.label} 편집기에서 본문을 불러오는 중… (최대 1분)`;
    try {
      const res = await window.electronAPI.invoke(platform.detailChannel, {
        postId: item.id,
        payload: await buildPlatformPayload(platform.key),
      });
      if (!res?.ok) {
        const msg = res?.error || '알 수 없는 오류';
        if (statusEl) statusEl.innerHTML = res?.needsAuth ? platform.authHint : `❌ 본문을 불러오지 못했습니다: ${esc(msg)}`;
        alert(`❌ 본문을 불러오지 못했습니다\n\n${msg}`);
        return;
      }
      html = String(res.content || '');
      title = res.title || title;
      if (statusEl) statusEl.textContent = `${platform.label} · 본문을 불러왔습니다.`;
    } catch (err) {
      console.error('[POSTS-TAB] 본문 로드 실패:', err);
      alert('본문을 불러오지 못했습니다: ' + (err?.message || err));
      return;
    }
  }

  if (!html.trim()) {
    alert('이 글의 본문을 불러오지 못했습니다. 🔄 새로고침 후 다시 시도해주세요.');
    return;
  }

  window.openVisualEditor?.({
    kind: platform.editorKind,
    postId: item.id,
    postUrl: item.url,
    title,
    html,
  });
}
