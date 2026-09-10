/**
 * 🤖 AI 비서 패널 (v3.8.713)
 *
 * 사장님: "사용자들이 문제가있거나 궁금증이있다면 나한테 묻는거나 다름이없어지지
 *          왜냐 어차피 난 너한테 또물어보거든"
 *
 * 앱을 만든 사람을 대신해 답하는 비서. 엔진은 로그인된 에이전트 CLI 를 먼저 쓰므로
 * 구독자에게는 **추가 비용이 0**이다(메인이 고르고, 여기서는 배지로 알려만 준다).
 *
 * 대화는 이 창을 닫으면 사라진다 — 진단 내용(로그·설정 상태)이 디스크에 남지 않게 한다.
 */

const PRESETS = [
  '발행이 실패했어요',
  '이미지가 안 나와요',
  '지금 설정 좀 점검해줘',
  '이 앱 어떻게 쓰는 거예요?',
];

/** 세션 대화 — 새로고침·재시작하면 사라진다 */
let history = [];
let busy = false;

function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
}

/** 아주 좁은 마크다운만 — **굵게** 와 줄바꿈. 그 외는 글자 그대로 둔다 */
function renderAnswer(text) {
  return esc(text)
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/\n/g, '<br>');
}

const CSS = [
  '#assistantOverlay, #assistantOverlay * { box-sizing:border-box; }',
  '#assistantOverlay { position:fixed; inset:0; z-index:100004; display:flex; align-items:center; justify-content:center; padding:24px; color-scheme:dark;',
  '  background:rgba(2,6,23,.72); backdrop-filter:blur(3px); font-family:-apple-system,"Segoe UI",Roboto,sans-serif; }',
  '#assistantOverlay .as-card { display:flex; flex-direction:column; width:min(640px,94vw); height:min(720px,86vh);',
  '  background:linear-gradient(160deg,#111c33,#0b1324); border:1px solid rgba(148,163,184,.22); border-radius:18px; box-shadow:0 28px 80px rgba(0,0,0,.55); overflow:hidden; }',
  '#assistantOverlay .as-head { flex:0 0 auto; display:flex; align-items:center; gap:10px; padding:16px 18px; border-bottom:1px solid rgba(148,163,184,.14); }',
  '#assistantOverlay .as-title { margin:0; font-size:15px; font-weight:800; color:#f1f5f9; }',
  '#assistantOverlay .as-badge { padding:3px 9px; border-radius:999px; font-size:10.5px; font-weight:800; white-space:nowrap;',
  '  background:rgba(249,115,22,.16); border:1px solid rgba(249,115,22,.35); color:#fdba74; }',
  '#assistantOverlay .as-x { margin-left:auto; flex:0 0 auto; width:30px; height:30px; border:1px solid rgba(148,163,184,.25); border-radius:9px;',
  '  background:transparent; color:#94a3b8; font-size:14px; cursor:pointer; }',
  '#assistantOverlay .as-body { flex:1 1 auto; min-height:0; overflow-y:auto; padding:16px 18px; display:flex; flex-direction:column; gap:10px; }',
  '#assistantOverlay .as-msg { max-width:86%; padding:11px 13px; border-radius:13px; font-size:13px; line-height:1.65; white-space:normal; word-break:break-word; }',
  '#assistantOverlay .as-me { align-self:flex-end; background:linear-gradient(135deg,#4c1d95,#5b21b6); color:#ede9fe; border-bottom-right-radius:4px; }',
  '#assistantOverlay .as-bot { align-self:flex-start; background:rgba(15,23,42,.75); border:1px solid rgba(148,163,184,.16); color:#e2e8f0; border-bottom-left-radius:4px; }',
  '#assistantOverlay .as-bot b { color:#a5b4fc; }',
  '#assistantOverlay .as-note { align-self:center; font-size:11.5px; color:#64748b; text-align:center; line-height:1.6; }',
  '#assistantOverlay .as-presets { flex:0 0 auto; display:flex; flex-wrap:wrap; gap:6px; padding:0 18px 12px; }',
  '#assistantOverlay .as-preset { padding:7px 12px; border:1px solid rgba(148,163,184,.25); border-radius:999px; background:rgba(15,23,42,.6);',
  '  color:#cbd5e1; font-size:11.5px; font-weight:700; cursor:pointer; white-space:nowrap; }',
  '#assistantOverlay .as-preset:hover { border-color:rgba(139,92,246,.6); color:#e9d5ff; }',
  '#assistantOverlay .as-foot { flex:0 0 auto; display:flex; align-items:flex-end; gap:8px; padding:12px 18px 16px; border-top:1px solid rgba(148,163,184,.14); }',
  '#assistantOverlay .as-input { flex:1 1 auto; min-width:0; min-height:42px; max-height:120px; padding:11px 13px; resize:none;',
  '  border:1px solid rgba(148,163,184,.28); border-radius:11px; background:rgba(15,23,42,.75); color:#e2e8f0; font-size:13px; line-height:1.5;',
  '  font-family:inherit; outline:none; }',
  '#assistantOverlay .as-input:focus { border-color:rgba(139,92,246,.7); }',
  '#assistantOverlay .as-send { flex:0 0 auto; height:42px; padding:0 18px; border:0; border-radius:11px; cursor:pointer;',
  '  background:linear-gradient(135deg,#8b5cf6,#6d28d9); color:#fff; font-size:13px; font-weight:800; }',
  '#assistantOverlay .as-send:disabled { opacity:.45; cursor:default; }',
  '#assistantOverlay .as-dots { display:inline-block; }',
  '#assistantOverlay .as-dots i { display:inline-block; width:5px; height:5px; margin-right:3px; border-radius:50%; background:#94a3b8; animation:asBlink 1.1s infinite; }',
  '#assistantOverlay .as-dots i:nth-child(2) { animation-delay:.18s; } #assistantOverlay .as-dots i:nth-child(3) { animation-delay:.36s; }',
  '@keyframes asBlink { 0%,80%,100% { opacity:.25; } 40% { opacity:1; } }',
].join('\n');

function ensureStyle() {
  if (document.getElementById('assistantStyle')) return;
  const st = document.createElement('style');
  st.id = 'assistantStyle';
  st.textContent = CSS;
  document.head.appendChild(st);
}

function bodyEl() { return document.querySelector('#assistantOverlay .as-body'); }

function addMsg(kind, html) {
  const body = bodyEl();
  if (!body) return null;
  const el = document.createElement('div');
  el.className = 'as-msg ' + (kind === 'me' ? 'as-me' : 'as-bot');
  el.innerHTML = html;
  body.appendChild(el);
  body.scrollTop = body.scrollHeight;
  return el;
}

async function ask(question) {
  const q = String(question || '').trim();
  if (!q || busy) return;
  busy = true;

  const sendBtn = document.querySelector('#assistantOverlay .as-send');
  const input = document.querySelector('#assistantOverlay .as-input');
  if (sendBtn) sendBtn.disabled = true;
  if (input) input.value = '';

  addMsg('me', esc(q));
  const thinking = addMsg('bot', '<span class="as-dots"><i></i><i></i><i></i></span> 앱 상태를 확인하는 중…');

  try {
    const res = await window.electronAPI.invoke('assistant:ask', { question: q, history });
    if (res?.ok && res.answer) {
      thinking.innerHTML = renderAnswer(res.answer);
      history.push({ role: 'user', text: q });
      history.push({ role: 'assistant', text: res.answer });
      if (history.length > 12) history = history.slice(-12);
      const badge = document.querySelector('#assistantOverlay .as-badge');
      if (badge && res.engineLabel) {
        badge.textContent = res.engineLabel + (res.free ? ' · 추가비용 0' : '');
        badge.style.background = res.free ? 'rgba(249,115,22,.16)' : 'rgba(139,92,246,.16)';
        badge.style.borderColor = res.free ? 'rgba(249,115,22,.35)' : 'rgba(139,92,246,.4)';
        badge.style.color = res.free ? '#fdba74' : '#c4b5fd';
      }
    } else if (res?.needsEngine) {
      thinking.innerHTML = '답하려면 글 생성 엔진이 필요합니다.<br>'
        + '<b>설정 → Agent 계정</b>에서 Codex·Claude Code 에 로그인하면 <b>추가 비용 없이</b> 쓸 수 있고,<br>'
        + '<b>설정 → API 키</b>에 키를 넣어도 됩니다.';
    } else {
      thinking.innerHTML = '답을 가져오지 못했습니다.<br><span style="color:#94a3b8;">' + esc(res?.error || '알 수 없는 이유') + '</span>';
    }
  } catch (err) {
    thinking.innerHTML = '답을 가져오지 못했습니다.<br><span style="color:#94a3b8;">' + esc(err?.message || err) + '</span>';
  } finally {
    busy = false;
    if (sendBtn) sendBtn.disabled = false;
    const body = bodyEl();
    if (body) body.scrollTop = body.scrollHeight;
  }
}

export function openAssistant() {
  ensureStyle();
  if (document.getElementById('assistantOverlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'assistantOverlay';
  overlay.innerHTML =
    '<div class="as-card" role="dialog" aria-modal="true" aria-label="AI 비서">'
    + '<div class="as-head">'
    + '<h2 class="as-title">🤖 AI 비서</h2>'
    + '<span class="as-badge">엔진 확인 중…</span>'
    + '<button type="button" class="as-x" title="닫기">✕</button>'
    + '</div>'
    + '<div class="as-body">'
    + '<div class="as-msg as-bot">앱을 쓰다 막힌 것을 물어보세요. <b>지금 앱의 상태와 최근 기록을 직접 보고</b> 답합니다.<br>'
    + '키나 비밀번호는 절대 보지 않습니다 — 들어 있는지 여부만 봅니다.</div>'
    + '<div class="as-note">대화는 이 창을 닫으면 사라집니다.</div>'
    + '</div>'
    + '<div class="as-presets">'
    + PRESETS.map((p) => '<button type="button" class="as-preset">' + esc(p) + '</button>').join('')
    + '</div>'
    + '<div class="as-foot">'
    + '<textarea class="as-input" rows="1" placeholder="예: 티스토리에 발행이 자꾸 실패해요"></textarea>'
    + '<button type="button" class="as-send">보내기</button>'
    + '</div></div>';
  document.body.appendChild(overlay);

  const input = overlay.querySelector('.as-input');
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);

  overlay.querySelector('.as-x').addEventListener('click', close);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('.as-send').addEventListener('click', () => ask(input.value));
  overlay.querySelectorAll('.as-preset').forEach((btn) => {
    btn.addEventListener('click', () => ask(btn.textContent));
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input.value); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(120, input.scrollHeight) + 'px';
  });
  setTimeout(() => input.focus(), 30);

  // 어떤 엔진으로 답하게 될지 미리 알려 준다 — 비용이 드는지 아닌지가 사용자에겐 중요하다
  // (Promise.resolve 로 감싼다 — preload 가 아직 안 붙었으면 invoke 가 undefined 다)
  Promise.resolve(window.electronAPI?.invoke?.('assistant:diagnostics')).then((res) => {
    const badge = overlay.querySelector('.as-badge');
    if (!badge) return;
    const agents = (res?.diagnostics?.engine?.loggedInAgents || []).filter((a) => a.status === 'ready');
    if (agents.length) {
      badge.textContent = agents[0].provider + ' 에이전트 · 추가비용 0';
    } else {
      const keys = res?.diagnostics?.apiKeys || {};
      badge.textContent = Object.values(keys).some(Boolean) ? 'API 모델 · 호출당 과금' : '엔진 없음 — 설정 필요';
      badge.style.background = 'rgba(139,92,246,.16)';
      badge.style.borderColor = 'rgba(139,92,246,.4)';
      badge.style.color = '#c4b5fd';
    }
  }).catch(() => { /* 배지는 장식이다 — 실패해도 대화는 된다 */ });
}

export function initAssistant() {
  window.openAssistant = openAssistant;
}
