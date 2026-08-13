// 🃏 카드뉴스 — 발행 글을 인스타(4:5)·카카오채널(1:1) 카드로 (v3.8.495)
//
// 리서치(2026-08-13) 반영: 웹스토리는 뺐다(구글이 디스커버 캐러셀에서 제거).
// 인스타 캐러셀이 저장·공유 1위 형식 — 훅 첫 장·저장 유도 마지막 장·Alt 텍스트에 집중.
// 인스타·카카오는 자동 업로드 API 가 승인제라 v1 은 "업로드 직전 상태"(PNG+캡션+Alt)까지 만든다.
import { addLog } from './core.js';

const PLATFORMS = [
  { key: 'blogger', label: '블로그스팟', channel: 'blogger-list-posts' },
  { key: 'wordpress', label: '워드프레스', channel: 'wordpress-list-posts' },
  { key: 'tistory', label: '티스토리', channel: 'tistory-list-posts' },
];

let state = { posts: [], selected: null, busy: false, lastDir: '' };

export function initCardnews() {
  const panel = document.getElementById('extTrafficSubtab-cardnews');
  if (!panel || panel.dataset.ready) return;
  panel.dataset.ready = '1';

  panel.innerHTML = `
    <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(148,163,184,0.15); border-radius: 14px; padding: 18px;">
      <div style="font-size: 15px; font-weight: 800; color: #e2e8f0; margin-bottom: 4px;">🃏 발행 글 → 카드뉴스</div>
      <div style="font-size: 12px; color: #94a3b8; margin-bottom: 14px;">
        인스타 4:5 + 카카오채널 1:1 카드와 캡션·Alt 텍스트를 만들어 폴더로 저장합니다.
        훅 첫 장·저장 유도 마지막 장·Alt 는 2026 인스타 알고리즘(리서브·저장·Alt 분석) 대응입니다.
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
        <select id="cnPlatform" style="padding: 10px 12px; background: #0f172a; color: #e2e8f0; border: 1px solid #334155; border-radius: 8px; font-size: 13px; font-weight: 700;">
          ${PLATFORMS.map((p) => `<option value="${p.key}">${p.label}</option>`).join('')}
        </select>
        <button id="cnLoadBtn" style="padding: 10px 16px; background: #334155; color: #e2e8f0; border: none; border-radius: 8px; font-size: 13px; font-weight: 800; cursor: pointer;">📋 발행 글 불러오기</button>
        <button id="cnMakeBtn" disabled style="padding: 10px 16px; background: linear-gradient(135deg,#6366f1,#8b5cf6); color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 800; cursor: pointer; opacity: 0.5;">🃏 카드뉴스 만들기</button>
        <button id="cnOpenBtn" style="display:none; padding: 10px 16px; background: #10b981; color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 800; cursor: pointer;">📁 폴더 열기</button>
      </div>
      <div id="cnStatus" style="font-size: 12px; color: #94a3b8; margin-bottom: 10px;"></div>
      <div id="cnPostList" style="display: none; max-height: 260px; overflow-y: auto; border: 1px solid rgba(148,163,184,0.15); border-radius: 10px; margin-bottom: 12px;"></div>
      <div id="cnResult" style="display: none;"></div>
    </div>`;

  panel.querySelector('#cnLoadBtn').addEventListener('click', loadPosts);
  panel.querySelector('#cnMakeBtn').addEventListener('click', createCards);
  panel.querySelector('#cnOpenBtn').addEventListener('click', () => {
    if (state.lastDir) window.blogger?.cardnewsOpenDir?.({ dir: state.lastDir });
  });
}

function setStatus(msg) {
  const el = document.getElementById('cnStatus');
  if (el) el.textContent = msg || '';
}

async function loadPosts() {
  if (state.busy) return;
  state.busy = true;
  setStatus('발행 글을 불러오는 중…');
  try {
    const key = document.getElementById('cnPlatform')?.value || 'blogger';
    const platform = PLATFORMS.find((p) => p.key === key) || PLATFORMS[0];
    // 글목록 탭과 같은 소스 — 플랫폼 연결 정보(payload)도 같은 헬퍼를 쓴다
    const payload = (await window.__buildPublishedPlatformPayload?.(key)) || {};
    const res = await window.electronAPI.invoke(platform.channel, { maxResults: 20, payload });
    if (!res?.ok) throw new Error(res?.error || '목록 조회 실패');

    state.posts = (res.items || []).filter((p) => p && p.title);
    state.selected = null;
    renderPostList();
    setStatus(state.posts.length ? `${platform.label} 최근 글 ${state.posts.length}개 — 카드로 만들 글을 고르세요` : '발행된 글이 없습니다');
  } catch (err) {
    setStatus(`❌ ${err?.message || err}`);
  } finally {
    state.busy = false;
  }
}

function renderPostList() {
  const list = document.getElementById('cnPostList');
  const makeBtn = document.getElementById('cnMakeBtn');
  if (!list) return;
  list.style.display = state.posts.length ? '' : 'none';
  list.innerHTML = state.posts.map((p, i) => `
    <div class="cn-post" data-idx="${i}" style="padding: 10px 14px; border-bottom: 1px solid rgba(148,163,184,0.08); cursor: pointer; font-size: 13px; color: #cbd5e1;">
      ${escapeText(p.title)}
      <span style="color:#64748b; font-size:11px; margin-left:8px;">${escapeText((p.published || '').slice(0, 10))}</span>
    </div>`).join('');
  list.querySelectorAll('.cn-post').forEach((el) => {
    el.addEventListener('click', () => {
      state.selected = state.posts[Number(el.dataset.idx)] || null;
      list.querySelectorAll('.cn-post').forEach((n) => { n.style.background = ''; });
      el.style.background = 'rgba(99,102,241,0.18)';
      if (makeBtn) { makeBtn.disabled = !state.selected; makeBtn.style.opacity = state.selected ? '1' : '0.5'; }
      setStatus(state.selected ? `선택됨: ${state.selected.title}` : '');
    });
  });
}

async function createCards() {
  if (state.busy || !state.selected) return;
  const post = state.selected;
  if (!String(post.content || '').trim()) {
    setStatus('❌ 이 글은 본문을 함께 불러오지 못했습니다 — 다른 글을 선택하거나 다시 불러와 주세요.');
    return;
  }
  state.busy = true;
  setStatus('🃏 카드 문안을 설계하고 이미지를 만드는 중… (30초 안팎)');
  addLog('🃏 카드뉴스 생성 시작: ' + post.title, 'info');
  try {
    const res = await window.blogger.cardnewsCreate({ title: post.title, html: post.content, keyword: post.title, url: post.url || '' });
    if (!res?.ok) throw new Error(res?.error || '생성 실패');
    state.lastDir = res.dir || '';
    document.getElementById('cnOpenBtn').style.display = '';
    renderResult(res);
    setStatus(`✅ 카드 ${res.cards}장 × 인스타/카카오 저장 완료`);
    addLog(`✅ 카드뉴스 저장: ${res.dir}`, 'success');
  } catch (err) {
    setStatus(`❌ ${err?.message || err}`);
    addLog('❌ 카드뉴스 생성 실패: ' + (err?.message || err), 'error');
  } finally {
    state.busy = false;
  }
}

function renderResult(res) {
  const box = document.getElementById('cnResult');
  if (!box) return;
  const instaFiles = (res.files || []).filter((f) => f.format === 'instagram');
  box.style.display = '';
  box.innerHTML = `
    <div style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">미리보기 (인스타 4:5) — 파일과 캡션·Alt 는 폴더에 저장됐습니다</div>
    <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px;">
      ${instaFiles.map((f) => `<img src="file:///${String(f.file).replace(/\\/g, '/')}" style="height: 220px; border-radius: 10px; border: 1px solid rgba(148,163,184,0.2);" />`).join('')}
    </div>
    <div style="margin-top: 10px; font-size: 12px; color: #cbd5e1;">
      <div style="font-weight: 800; margin-bottom: 4px;">캡션 (복사해서 업로드 시 붙여넣기)</div>
      <textarea readonly style="width: 100%; min-height: 70px; background: #0f172a; color: #e2e8f0; border: 1px solid #334155; border-radius: 8px; padding: 10px; font-size: 12px;">${escapeText(res.caption || '')}</textarea>
    </div>`;
}

function escapeText(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
