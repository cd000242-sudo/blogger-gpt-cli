// 📋 생성된 글목록 탭 — Blogger에 발행된 글을 목록으로 보여주고, 비주얼 편집기로 수정발행한다.
// 목록은 항상 Blogger API에서 직접 가져오므로 새로고침 시 블로그에서 삭제/수동수정한 내용이 그대로 반영된다.
import { addLog } from './core.js';

const PAGE_SIZE = 20;

const state = {
  items: [],
  nextPageToken: null,
  loading: false,
  rendered: false,
};

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
  try {
    return iso ? new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  } catch {
    return iso || '';
  }
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
    window.__refreshPublishedPosts = () => refreshPosts();
  }

  if (!state.items.length && !state.loading) {
    refreshPosts();
  }
}

async function refreshPosts() {
  state.items = [];
  state.nextPageToken = null;
  const list = document.getElementById('ppList');
  if (list) list.innerHTML = '';
  await loadPosts({ append: false });
}

async function loadPosts({ append }) {
  if (state.loading) return;
  state.loading = true;
  const statusEl = document.getElementById('ppStatus');
  const moreBtn = document.getElementById('ppMoreBtn');
  if (statusEl) statusEl.textContent = '⏳ 블로그에서 글 목록을 불러오는 중…';
  if (moreBtn) moreBtn.disabled = true;

  try {
    const res = await window.electronAPI.invoke('blogger-list-posts', {
      maxResults: PAGE_SIZE,
      pageToken: append ? (state.nextPageToken || undefined) : undefined,
    });

    if (!res?.ok) {
      const msg = res?.error || '알 수 없는 오류';
      if (statusEl) {
        statusEl.innerHTML = res?.needsAuth
          ? '🔒 Blogger 인증이 필요합니다. <b>환경설정 → Blogger OAuth2 인증</b>을 진행한 뒤 새로고침해주세요.'
          : `❌ 글 목록을 불러오지 못했습니다: ${esc(msg)}`;
      }
      addLog(`❌ 글 목록 조회 실패: ${msg}`, 'error');
      return;
    }

    state.items = append ? state.items.concat(res.items || []) : (res.items || []);
    state.nextPageToken = res.nextPageToken || null;
    renderList();

    if (statusEl) {
      statusEl.textContent = state.items.length
        ? `총 ${state.items.length}개 표시 · 마지막 새로고침 ${new Date().toLocaleTimeString('ko-KR')}`
        : '발행된 글이 없습니다. 글을 발행하면 여기에 표시됩니다.';
    }
  } catch (err) {
    console.error('[POSTS-TAB] 목록 로드 실패:', err);
    if (statusEl) statusEl.textContent = `❌ 오류: ${err?.message || err}`;
  } finally {
    state.loading = false;
    if (moreBtn) {
      moreBtn.disabled = false;
      moreBtn.style.display = state.nextPageToken ? 'inline-block' : 'none';
    }
  }
}

function renderList() {
  const list = document.getElementById('ppList');
  if (!list) return;

  list.innerHTML = state.items.map((item, i) => {
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
      const item = state.items[Number(e.currentTarget.getAttribute('data-index'))];
      if (item?.url) {
        (window.blogger?.openLink ? window.blogger.openLink(item.url) : window.electronAPI.invoke('open-link', item.url));
      }
    });
  });
}

function openEditorFor(index) {
  const item = state.items[index];
  if (!item) return;
  if (!String(item.content || '').trim()) {
    alert('이 글의 본문을 불러오지 못했습니다. 🔄 새로고침 후 다시 시도해주세요.');
    return;
  }
  window.openVisualEditor?.({
    kind: 'blogger',
    postId: item.id,
    postUrl: item.url,
    title: item.title,
    html: item.content,
  });
}
