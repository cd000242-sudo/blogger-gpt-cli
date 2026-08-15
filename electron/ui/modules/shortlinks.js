// 🔗 단축링크 — 긴 워드프레스 주소를 내 도메인으로 줄인다 (v3.8.500)
//
// 왜 필요한가: 퍼머링크가 /%category%/%postname%/ 인데 슬러그가 한글이라
// 주소가 평균 233자다. 한글 한 글자가 %eb%b6%80 처럼 9자로 부푼다.
// 카카오톡·인스타에 붙이면 깨져 보이고 무슨 글인지도 알 수 없다.
//
// 왜 남의 단축 서비스를 안 쓰나: bit.ly 를 쓰면 링크 주인이 그 회사가 된다.
// 서비스가 닫히면 그동안 뿌린 링크가 전부 죽는다.
import { addLog } from './core.js';

let state = { links: [], posts: [], busy: false, editing: null };

export function initShortlinks() {
  const panel = document.getElementById('shortlinks-tab');
  if (!panel || panel.dataset.ready) return;
  panel.dataset.ready = '1';

  panel.innerHTML = `
    <div style="padding: 20px; max-width: 1100px;">
      <div style="font-size: 20px; font-weight: 900; color: #f1f5f9; margin-bottom: 4px;">🔗 단축링크</div>
      <div style="font-size: 12.5px; color: #94a3b8; margin-bottom: 18px; line-height: 1.6;">
        긴 워드프레스 주소를 내 도메인으로 줄입니다. 목적지는 나중에 바꿀 수 있어
        프로필 링크 하나로 이번 달 A글, 다음 달 B글을 보낼 수 있습니다.
      </div>

      <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(148,163,184,0.15); border-radius: 14px; padding: 18px; margin-bottom: 16px;">
        <div style="font-size: 14px; font-weight: 800; color: #e2e8f0; margin-bottom: 12px;">새 단축링크</div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;">
          <button id="slLoadPosts" style="padding: 9px 14px; background: #334155; color: #e2e8f0; border: none; border-radius: 8px; font-size: 12.5px; font-weight: 800; cursor: pointer;">📋 발행 글에서 고르기</button>
          <span id="slPickedTitle" style="font-size: 12.5px; color: #64748b; align-self: center;"></span>
        </div>
        <div id="slPostList" style="display: none; max-height: 220px; overflow-y: auto; border: 1px solid rgba(148,163,184,0.15); border-radius: 10px; margin-bottom: 12px;"></div>

        <label style="display:block; font-size:12px; font-weight:800; color:#cbd5e1; margin-bottom:5px;">목적지 주소</label>
        <input id="slUrl" placeholder="https://leadernam.com/..." spellcheck="false"
          style="width:100%; padding:10px 12px; background:#0f172a; color:#e2e8f0; border:1px solid #334155; border-radius:8px; font-size:12.5px; margin-bottom:12px;" />

        <label style="display:block; font-size:12px; font-weight:800; color:#cbd5e1; margin-bottom:5px;">단축 주소</label>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <input id="slSlug" placeholder="claim-denial" spellcheck="false"
            style="flex:1; min-width:220px; padding:10px 12px; background:#0f172a; color:#e2e8f0; border:1px solid #334155; border-radius:8px; font-size:13px; font-weight:700;" />
          <button id="slSuggest" style="padding:10px 14px; background:#334155; color:#e2e8f0; border:none; border-radius:8px; font-size:12.5px; font-weight:800; cursor:pointer;">✨ 자동 제안</button>
        </div>
        <div id="slPreview" style="font-size:12.5px; color:#64748b; margin:7px 0 12px;"></div>

        <label style="display:block; font-size:12px; font-weight:800; color:#cbd5e1; margin-bottom:5px;">이름 (나중에 찾기 쉽게)</label>
        <input id="slName" placeholder="부모님 집 누수 — 일배책"
          style="width:100%; padding:10px 12px; background:#0f172a; color:#e2e8f0; border:1px solid #334155; border-radius:8px; font-size:12.5px; margin-bottom:12px;" />

        <div style="display:flex; gap:14px; flex-wrap:wrap; align-items:center; margin-bottom:14px;">
          <label style="font-size:12.5px; color:#cbd5e1; display:flex; align-items:center; gap:6px;">
            <input type="radio" name="slRedirect" value="307" checked> 307 임시 <span style="color:#64748b;">(목적지 변경 가능 · 권장)</span>
          </label>
          <label style="font-size:12.5px; color:#cbd5e1; display:flex; align-items:center; gap:6px;">
            <input type="radio" name="slRedirect" value="301"> 301 영구 <span style="color:#64748b;">(바꿔도 안 바뀜)</span>
          </label>
          <label style="font-size:12.5px; color:#cbd5e1; display:flex; align-items:center; gap:6px;">
            <input type="checkbox" id="slSponsored"> 제휴링크 <span style="color:#64748b;">(nofollow + sponsored)</span>
          </label>
        </div>

        <button id="slCreate" style="padding:11px 20px; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; border:none; border-radius:9px; font-size:13px; font-weight:900; cursor:pointer;">🔗 단축링크 만들기</button>
        <span id="slMsg" style="font-size:12.5px; color:#94a3b8; margin-left:10px;"></span>
      </div>

      <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
        <div style="font-size:14px; font-weight:800; color:#e2e8f0;">내 단축링크</div>
        <button id="slRefresh" style="padding:6px 12px; background:#334155; color:#e2e8f0; border:none; border-radius:7px; font-size:12px; font-weight:800; cursor:pointer;">🔄 새로고침</button>
        <span id="slListMsg" style="font-size:12px; color:#64748b;"></span>
      </div>
      <div id="slList" style="display:grid; gap:8px;"></div>
    </div>`;

  panel.querySelector('#slLoadPosts').addEventListener('click', loadPosts);
  panel.querySelector('#slSuggest').addEventListener('click', suggest);
  panel.querySelector('#slCreate').addEventListener('click', create);
  panel.querySelector('#slRefresh').addEventListener('click', refresh);
  panel.querySelector('#slSlug').addEventListener('input', syncPreview);
  syncPreview();
  ensurePlugin().then(() => refresh());
}

/**
 * 단축링크는 Pretty Links 가 있어야 동작한다.
 * "깔려 있겠지" 로 두면 처음 쓰는 사람은 이유도 모르고 실패한다 — 없으면 깔아 준다.
 */
async function ensurePlugin() {
  msg('단축링크 준비 확인 중…', 'slListMsg');
  try {
    const payload = (await window.__buildPublishedPlatformPayload?.('wordpress')) || {};
    const res = await window.blogger?.shortlinkEnsurePlugin?.({ payload });
    if (res?.ok) return true;
    // 자동 설치가 막힌 곳(호스팅 설정)도 있다 — 무엇을 하면 되는지 그대로 보여준다
    const box = $('slList');
    if (box) {
      box.innerHTML = `<div style="padding:16px; background:rgba(251,191,36,0.08); border:1px solid rgba(251,191,36,0.3); border-radius:11px; font-size:12.5px; color:#fcd34d; line-height:1.7;">
        ⚠️ ${esc(res?.error || 'Pretty Links 플러그인을 준비하지 못했습니다.')}
        <div style="color:#94a3b8; margin-top:6px;">플러그인이 준비되면 새로고침을 눌러주세요.</div>
      </div>`;
    }
    msg('플러그인 준비 필요', 'slListMsg');
    return false;
  } catch (err) {
    msg(`❌ ${err?.message || err}`, 'slListMsg');
    return false;
  }
}

function esc(t) {
  return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** 생성된글목록과 같은 규칙 — imageUrl 이 없으면 본문 첫 이미지를 쓴다 */
function extractThumb(post) {
  const direct = String(post?.imageUrl || '').trim();
  if (direct) return direct;
  const m = String(post?.content || '').match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : '';
}

/** 목록과 같은 배지 (v3.8.499 에서 임시·예약이 목록에 뜨게 됐다) */
const STATUS_BADGE = {
  draft: { label: '임시', bg: '#78350f', fg: '#fcd34d' },
  scheduled: { label: '예약', bg: '#1e3a8a', fg: '#93c5fd' },
  future: { label: '예약', bg: '#1e3a8a', fg: '#93c5fd' },
  pending: { label: '검토중', bg: '#3f3f46', fg: '#d4d4d8' },
  private: { label: '비공개', bg: '#4c1d95', fg: '#ddd6fe' },
};
const $ = (id) => document.getElementById(id);
function msg(t, id = 'slMsg') { const el = $(id); if (el) el.textContent = t || ''; }

/** 사이트 주소는 이미 만든 링크에서 얻는다 — 설정을 또 읽지 않는다 */
function siteBase() {
  const withUrl = state.links.find((l) => l.prettyUrl);
  if (withUrl) return withUrl.prettyUrl.replace(/\/[^/]*$/, '');
  return '(사이트 주소)';
}

function syncPreview() {
  const raw = $('slSlug')?.value || '';
  // 서버와 같은 규칙으로 미리 보여준다 — 한글을 넣으면 왜 사라지는지 그 자리에서 알게
  const norm = raw.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 48);
  const el = $('slPreview');
  if (!el) return;
  if (!norm) {
    el.innerHTML = raw.trim()
      ? '<span style="color:#fbbf24;">⚠️ 한글은 주소에서 %EC%B2%AD 처럼 부풀어 단축한 뜻이 없어집니다 — 영문·숫자로 지어주세요</span>'
      : '영문·숫자·하이픈으로 지어주세요';
    return;
  }
  const dup = state.links.some((l) => l.slug === norm);
  el.innerHTML = `${esc(siteBase())}/<b style="color:#a5b4fc;">${esc(norm)}</b>`
    + (dup ? '  <span style="color:#fbbf24;">⚠️ 이미 쓰는 주소입니다 (뒤에 숫자가 붙습니다)</span>'
           : '  <span style="color:#6ee7b7;">✅ 사용 가능</span>');
}

async function loadPosts() {
  if (state.busy) return;
  state.busy = true;
  msg('발행 글을 불러오는 중…');
  try {
    const payload = (await window.__buildPublishedPlatformPayload?.('wordpress')) || {};
    const res = await window.electronAPI.invoke('wordpress-list-posts', { maxResults: 30, payload });
    if (!res?.ok) throw new Error(res?.error || '목록 조회 실패');
    state.posts = (res.items || []).filter((p) => p && p.title);
    const list = $('slPostList');
    list.style.display = state.posts.length ? '' : 'none';
    // 생성된글목록과 같은 결로 — 썸네일이 있어야 어떤 글인지 한눈에 알아본다
    list.innerHTML = state.posts.map((p, i) => {
      const thumb = extractThumb(p);
      const st = STATUS_BADGE[String(p.status || '').toLowerCase()];
      return `
      <div class="sl-post" data-idx="${i}" style="display:flex; align-items:center; gap:11px; padding:10px 13px; border-bottom:1px solid rgba(148,163,184,0.08); cursor:pointer;">
        <div style="width:64px; height:42px; flex-shrink:0; border-radius:7px; overflow:hidden; background:#0f172a; display:flex; align-items:center; justify-content:center;">
          ${thumb
            ? `<img src="${esc(thumb)}" alt="" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'">`
            : '<span style="font-size:17px;">📝</span>'}
        </div>
        <div style="flex:1; min-width:0;">
          <div style="font-size:12.5px; font-weight:700; color:#e2e8f0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${st ? `<span style="display:inline-block; margin-right:6px; padding:1px 7px; border-radius:999px; background:${st.bg}; color:${st.fg}; font-size:10px; font-weight:800;">${st.label}</span>` : ''}${esc(p.title)}
          </div>
          <div style="font-size:11px; color:#64748b; margin-top:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            지금 주소 ${esc(String(p.url || '').length)}자 · ${esc(String(p.published || '').slice(0, 10))}
          </div>
        </div>
      </div>`;
    }).join('');
    list.querySelectorAll('.sl-post').forEach((el) => {
      el.addEventListener('click', () => pickPost(state.posts[Number(el.dataset.idx)]));
    });
    msg(`${state.posts.length}개 — 하나 고르세요`);
  } catch (err) {
    msg(`❌ ${err?.message || err}`);
  } finally {
    state.busy = false;
  }
}

async function pickPost(post) {
  if (!post) return;
  $('slUrl').value = post.url || '';
  $('slName').value = String(post.title || '').slice(0, 60);
  $('slPickedTitle').textContent = `선택: ${String(post.title || '').slice(0, 40)}`;
  $('slPostList').style.display = 'none';
  await suggest();
}

async function suggest() {
  const title = $('slName')?.value || $('slPickedTitle')?.textContent || '';
  const url = $('slUrl')?.value || '';
  const idMatch = url.match(/[?&]p=(\d+)/);
  const res = await window.blogger?.shortlinkSuggest?.({ title, postId: idMatch ? idMatch[1] : '' });
  if (res?.ok && res.slug) {
    $('slSlug').value = res.slug;
    syncPreview();
  } else {
    msg('제목에서 뽑을 말을 못 찾았습니다 — 직접 지어주세요');
  }
}

async function create() {
  if (state.busy) return;
  const slug = ($('slSlug')?.value || '').trim();
  const url = ($('slUrl')?.value || '').trim();
  if (!url) return msg('❌ 목적지 주소를 넣어주세요');
  if (!slug) return msg('❌ 단축 주소를 지어주세요');

  state.busy = true;
  msg('만드는 중…');
  try {
    const payload = (await window.__buildPublishedPlatformPayload?.('wordpress')) || {};
    const redirect = document.querySelector('input[name="slRedirect"]:checked')?.value || '307';
    const sponsored = !!$('slSponsored')?.checked;
    const res = await window.blogger.shortlinkCreate({
      slug, url, name: ($('slName')?.value || '').trim(),
      redirectType: redirect, sponsored, nofollow: sponsored, payload,
    });
    if (!res?.ok) throw new Error(res?.error || '생성 실패');
    const made = res.item || {};
    msg(`✅ ${made.prettyUrl || made.slug} 만들었습니다`);
    addLog(`🔗 단축링크 생성: ${made.prettyUrl || made.slug}`, 'success');
    try { await navigator.clipboard.writeText(made.prettyUrl || ''); msg(`✅ ${made.prettyUrl} — 복사했습니다`); } catch { /* 클립보드 거부는 넘어간다 */ }
    $('slSlug').value = '';
    await refresh();
  } catch (err) {
    msg(`❌ ${err?.message || err}`);
    addLog('❌ 단축링크 생성 실패: ' + (err?.message || err), 'error');
  } finally {
    state.busy = false;
  }
}

async function refresh() {
  msg('불러오는 중…', 'slListMsg');
  try {
    const payload = (await window.__buildPublishedPlatformPayload?.('wordpress')) || {};
    const res = await window.blogger.shortlinkList({ payload });
    if (!res?.ok) throw new Error(res?.error || '조회 실패');
    state.links = res.items || [];
    renderList();
    const clicks = state.links.reduce((a, l) => a + (l.clicks || 0), 0);
    msg(`${state.links.length}개 · 총 클릭 ${clicks}`, 'slListMsg');
    syncPreview();
  } catch (err) {
    msg(`❌ ${err?.message || err}`, 'slListMsg');
  }
}

function renderList() {
  const box = $('slList');
  if (!box) return;
  if (!state.links.length) {
    box.innerHTML = '<div style="font-size:12.5px; color:#64748b; padding:14px;">아직 만든 단축링크가 없습니다.</div>';
    return;
  }
  box.innerHTML = state.links.map((l, i) => `
    <div data-row="${i}" style="display:grid; grid-template-columns:1fr auto; gap:12px; align-items:center; padding:12px 14px; background:rgba(15,23,42,0.6); border:1px solid rgba(148,163,184,0.15); border-radius:11px;">
      <div style="min-width:0;">
        <div style="font-size:13.5px; font-weight:800; color:#a5b4fc; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(l.prettyUrl || l.slug)}</div>
        <div style="font-size:11.5px; color:#94a3b8; margin-top:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          ${esc(l.name || '(이름 없음)')} · <span style="color:#64748b;">${esc(l.redirectType)}</span> · 클릭 <b style="color:#cbd5e1;">${l.clicks}</b> (순 ${l.uniques})
        </div>
        <div style="font-size:11px; color:#475569; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">→ ${esc(decodeURIComponent(l.url || ''))}</div>
      </div>
      <div style="display:flex; gap:6px;">
        <button data-copy="${i}" style="padding:7px 11px; background:#334155; color:#e2e8f0; border:none; border-radius:7px; font-size:12px; font-weight:800; cursor:pointer;">복사</button>
        <button data-retarget="${i}" title="목적지만 바꿉니다 (주소는 그대로)" style="padding:7px 11px; background:#334155; color:#93c5fd; border:none; border-radius:7px; font-size:12px; font-weight:800; cursor:pointer;">목적지 변경</button>
      </div>
    </div>`).join('');

  box.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    const l = state.links[Number(b.dataset.copy)];
    try { await navigator.clipboard.writeText(l.prettyUrl || ''); b.textContent = '복사됨'; setTimeout(() => { b.textContent = '복사'; }, 1200); } catch { /* noop */ }
  }));
  box.querySelectorAll('[data-retarget]').forEach((b) => b.addEventListener('click', () => retarget(Number(b.dataset.retarget))));
}

/**
 * 목적지 바꾸기 — 프로필 링크 하나로 이번 달 A글, 다음 달 B글.
 *
 * 처음엔 window.prompt 를 썼는데 눌러도 아무 반응이 없었다.
 * 일렉트론 렌더러는 prompt 를 막아 둔다(호출해도 조용히 null). 그 자리에서
 * 고치는 입력칸을 그리는 방식으로 바꾼다 — 브라우저 기능에 기대지 않는다.
 */
function retarget(index) {
  const link = state.links[index];
  const row = document.querySelector(`[data-row="${index}"]`);
  if (!link || !row || row.querySelector('[data-edit]')) return;

  const box = document.createElement('div');
  box.style.cssText = 'grid-column:1/-1; display:flex; gap:6px; margin-top:10px; flex-wrap:wrap;';
  box.innerHTML = `
    <input data-edit="${index}" value="${esc(link.url || '')}" spellcheck="false"
      style="flex:1; min-width:260px; padding:9px 11px; background:#0f172a; color:#e2e8f0; border:1px solid #6366f1; border-radius:8px; font-size:12.5px;" />
    <button data-save="${index}" style="padding:9px 14px; background:#6366f1; color:#fff; border:none; border-radius:8px; font-size:12px; font-weight:800; cursor:pointer;">저장</button>
    <button data-cancel="${index}" style="padding:9px 12px; background:#334155; color:#cbd5e1; border:none; border-radius:8px; font-size:12px; font-weight:800; cursor:pointer;">취소</button>
    <span data-editmsg="${index}" style="font-size:11.5px; color:#64748b; align-self:center;">새 목적지 주소를 넣고 저장하세요</span>`;
  row.appendChild(box);

  const input = box.querySelector(`[data-edit="${index}"]`);
  input.focus();
  input.select();

  const close = () => box.remove();
  box.querySelector(`[data-cancel="${index}"]`).addEventListener('click', close);
  box.querySelector(`[data-save="${index}"]`).addEventListener('click', () => save());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') close();
  });

  async function save() {
    const next = String(input.value || '').trim();
    const note = box.querySelector(`[data-editmsg="${index}"]`);
    if (!/^https?:\/\//i.test(next)) { note.textContent = '❌ https:// 로 시작하는 주소를 넣어주세요'; return; }
    if (next === link.url) { close(); return; }
    note.textContent = '바꾸는 중…';
    try {
      const payload = (await window.__buildPublishedPlatformPayload?.('wordpress')) || {};
      const res = await window.blogger.shortlinkUpdate({ id: link.id, url: next, payload });
      if (!res?.ok) throw new Error(res?.error || '변경 실패');
      addLog(`🔗 목적지 변경: ${link.prettyUrl}`, 'success');
      close();
      await refresh();
    } catch (err) {
      note.textContent = `❌ ${err?.message || err}`;
    }
  }
}
