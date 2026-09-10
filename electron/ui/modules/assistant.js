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

/** 비서가 쓸 에이전트 — 글 생성용 선택과 **따로** 둔다 (v3.8.714) */
const ASSISTANT_AGENT_KEY = 'leadernamAssistantAgent';
const AGENT_CHOICES = [
  { id: 'claude', label: '🟠 Claude Code' },
  { id: 'codex', label: '🧠 Codex' },
  { id: 'gemini', label: '💎 Gemini CLI' },
];

/**
 * 비서가 쓸 에이전트를 읽는다.
 * 따로 고른 적이 없으면 글 생성용으로 고른 에이전트를 따라간다 —
 * 처음 여는 사람에게는 그게 가장 덜 놀랍다.
 */
function assistantAgent() {
  try {
    const saved = String(localStorage.getItem(ASSISTANT_AGENT_KEY) || '').replace(/"/g, '');
    if (AGENT_CHOICES.some((a) => a.id === saved)) return saved;
  } catch { /* 아래 기본값으로 */ }
  try {
    const global = String(window.getAgentExecutionState?.()?.provider || '');
    if (AGENT_CHOICES.some((a) => a.id === global)) return global;
  } catch { /* 아래 기본값으로 */ }
  return 'claude';
}

function setAssistantAgent(provider) {
  const id = AGENT_CHOICES.some((a) => a.id === provider) ? provider : 'claude';
  try { localStorage.setItem(ASSISTANT_AGENT_KEY, id); } catch { /* 저장 실패해도 이번 대화엔 쓰인다 */ }
  return id;
}

function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
}

/**
 * CLI 잡음 한 겹 더 거르기 (v3.8.714).
 * 메인(cleanAssistantAnswer)이 이미 지우지만, 다른 경로로 들어와도 화면엔 안 뜨게 둔다 —
 * 사용자에게 "Client.listTools() …" 는 아무 뜻도 없는 줄이다.
 */
function stripCliNoise(text) {
  return String(text || '')
    .replace(/^.*Client\.listTools\(\)[^\n]*$/gim, '')
    .replace(/^.*does not advertise (tools|prompts|resources) capability[^\n]*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 아주 좁은 마크다운만 — **굵게** 와 줄바꿈. 그 외는 글자 그대로 둔다 */
function renderAnswer(text) {
  return esc(stripCliNoise(text))
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/\n/g, '<br>');
}

/**
 * 🎬 v3.8.714 — 비서가 **대신 눌러 주는** 것들.
 *
 * 사장님: "이친구가 대신해서 발행을 도와주거나 개발영역외에는 전부다 되어야된다"
 *
 * 비서가 답 끝에 `[ACTION:이름:값]` 한 줄을 붙이면 화면이 그걸 **버튼**으로 바꾼다.
 * 비서가 직접 실행하지는 않는다 — 사장님이 눌러야 움직인다. 그래야 "누른 적 없는데
 * 발행돼 있는" 일이 안 생긴다. 여기 목록에 없는 이름은 무시한다(모르는 행동은 안 한다).
 */
/**
 * ⚠️ 탭 id 는 화면 이름과 다르다 (v3.8.714 실측).
 * 「글포스팅」 탭의 id 는 **'settings'** 다(사이드바도 그렇게 부른다).
 * 'posting' 은 없는 탭이라 누르면 **빈 화면**이 됐다 — 사장님이 잡아준 그 증상이다.
 */
const TAB_POSTING = 'settings';

const ACTIONS = {
  open_posting: { label: '⚡ 글포스팅 열기', run: () => window.showTab?.(TAB_POSTING) },
  open_settings: { label: '⚙️ 환경설정 열기', run: () => window.openSettingsModal?.() },
  open_published: { label: '📋 생성된글목록 열기', run: () => window.showTab?.('published-posts') },
  open_schedule: { label: '📅 예약 화면 열기', run: () => window.showTab?.('schedule') },
  refresh_briefing: { label: '📝 오늘의 글감 새로고침', run: () => window.loadKeywordBriefing?.(true) },
  fill_keyword: {
    label: (v) => `✍️ "${String(v).slice(0, 20)}" 로 발행 준비`,
    run: (v) => {
      const input = document.getElementById('keywordInput') || document.getElementById('keyword');
      if (input) {
        input.value = v;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      window.showTab?.(TAB_POSTING);
      input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
  },
};

/** 답에서 [ACTION:...] 줄을 떼어낸다 — 본문에는 안 보이고 버튼으로만 나간다 */
function splitActions(text) {
  const actions = [];
  const body = String(text || '').replace(/^\s*\[ACTION:([a-z_]+)(?::([^\]]*))?\]\s*$/gim, (_m, name, value) => {
    if (ACTIONS[name]) actions.push({ name, value: (value || '').trim() });
    return '';
  }).trim();
  return { body, actions };
}

function renderActions(container, actions) {
  if (!actions.length) return;
  const wrap = document.createElement('div');
  wrap.className = 'as-actions';
  actions.forEach((a) => {
    const spec = ACTIONS[a.name];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'as-act';
    btn.textContent = typeof spec.label === 'function' ? spec.label(a.value) : spec.label;
    btn.addEventListener('click', () => {
      try { spec.run(a.value); } catch (e) { console.warn('[ASSISTANT] 행동 실패:', e); }
    });
    wrap.appendChild(btn);
  });
  container.appendChild(wrap);
}

const CSS = [
  '#assistantOverlay, #assistantOverlay * { box-sizing:border-box; }',
  /*
   * v3.8.714 — 사장님: "모달로 보여주지말고 … 사이드로 열리게해"
   * 화면을 덮는 모달이면 비서를 보는 동안 앱을 못 쓴다. 오른쪽에 붙는 서랍으로 바꿔
   * 뒤 배경을 가리지 않는다 — 설정을 보며 물어보고, 답을 보며 바로 누를 수 있어야 한다.
   */
  '#assistantOverlay { position:fixed; top:0; right:0; bottom:0; width:min(430px,92vw); z-index:100004; display:flex; padding:0;',
  '  background:transparent; color-scheme:dark; font-family:-apple-system,"Segoe UI",Roboto,sans-serif;',
  '  animation:asSlideIn .22s ease-out; }',
  '@keyframes asSlideIn { from { transform:translateX(24px); opacity:0; } to { transform:translateX(0); opacity:1; } }',
  '#assistantOverlay .as-card { display:flex; flex-direction:column; width:100%; height:100%;',
  '  background:linear-gradient(160deg,#111c33,#0b1324); border:1px solid rgba(148,163,184,.22); border-right:0;',
  '  border-radius:16px 0 0 16px; box-shadow:-18px 0 50px rgba(0,0,0,.45); overflow:hidden; }',
  '#assistantOverlay .as-head { flex:0 0 auto; display:flex; align-items:center; gap:10px; padding:16px 18px; border-bottom:1px solid rgba(148,163,184,.14); }',
  '#assistantOverlay .as-title { flex:0 0 auto; margin:0; font-size:15px; font-weight:800; color:#f1f5f9; }',
  // 서랍은 430px 다 — 배지가 안 줄면 ✕ 를 밖으로 밀어낸다(실측). 줄이고 말줄임한다.
  '#assistantOverlay .as-badge { flex:0 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;',
  '  padding:3px 9px; border-radius:999px; font-size:10.5px; font-weight:800;',
  '  background:rgba(249,115,22,.16); border:1px solid rgba(249,115,22,.35); color:#fdba74; }',
  // 서랍이 430px 라 셋이 나란히 서려면 둘 다 줄어들 수 있어야 한다
  '#assistantOverlay .as-agent, #assistantOverlay .as-model { flex:1 1 0; min-width:0; max-width:130px; padding:4px 6px; border-radius:8px;',
  '  border:1px solid rgba(148,163,184,.28); background:rgba(15,23,42,.8); color:#cbd5e1; font-size:11px; font-weight:700; cursor:pointer; }',
  '#assistantOverlay .as-badge { margin-left:2px; }',
  '#assistantOverlay .as-x { flex:0 0 auto; width:30px; height:30px; border:1px solid rgba(148,163,184,.25); border-radius:9px;',
  '  background:transparent; color:#94a3b8; font-size:14px; cursor:pointer; }',
  '#assistantOverlay .as-actions { display:flex; flex-wrap:wrap; gap:6px; margin-top:9px; }',
  '#assistantOverlay .as-act { padding:7px 12px; border:1px solid rgba(139,92,246,.5); border-radius:9px; background:rgba(139,92,246,.16);',
  '  color:#ddd6fe; font-size:12px; font-weight:800; cursor:pointer; }',
  '#assistantOverlay .as-act:hover { background:rgba(139,92,246,.28); }',
  '#assistantOverlay .as-body { flex:1 1 auto; min-height:0; overflow-y:auto; padding:16px 18px; display:flex; flex-direction:column; gap:10px; }',
  '#assistantOverlay .as-msg { max-width:86%; padding:11px 13px; border-radius:13px; font-size:13px; line-height:1.65; white-space:normal; word-break:break-word; }',
  '#assistantOverlay .as-me { align-self:flex-end; background:linear-gradient(135deg,#4c1d95,#5b21b6); color:#ede9fe; border-bottom-right-radius:4px; }',
  '#assistantOverlay .as-bot { align-self:flex-start; background:rgba(15,23,42,.75); border:1px solid rgba(148,163,184,.16); color:#e2e8f0; border-bottom-left-radius:4px; }',
  '#assistantOverlay .as-bot b { color:#a5b4fc; }',
  '#assistantOverlay .as-note { align-self:center; font-size:11.5px; color:#64748b; text-align:center; line-height:1.6; }',
  // 접이식 안내 — 닫혀 있을 때는 한 줄, 펼치면 목록
  '#assistantOverlay .as-intro > summary { cursor:pointer; color:#cbd5e1; font-size:12.5px; font-weight:700; list-style:none; }',
  '#assistantOverlay .as-intro > summary::-webkit-details-marker { display:none; }',
  '#assistantOverlay .as-intro > summary::before { content:"ℹ️ "; }',
  '#assistantOverlay .as-intro[open] > summary { margin-bottom:7px; color:#94a3b8; }',
  '#assistantOverlay .as-intro ul { margin:0; padding-left:16px; color:#94a3b8; font-size:12px; line-height:1.7; }',
  '#assistantOverlay .as-intro li { margin:2px 0; }',
  '#assistantOverlay .as-intro b { color:#cbd5e1; }',
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
    const model = (() => {
      const sel = document.querySelector('#assistantOverlay .as-model');
      return sel ? sel.value : '';
    })();
    const res = await window.electronAPI.invoke('assistant:ask', {
      question: q,
      history,
      model,
      preferred: assistantAgent(),   // v3.8.714: 헤더에서 고른 에이전트로 답한다
    });
    if (res?.ok && res.answer) {
      // 답 끝의 [ACTION:...] 은 버튼으로 바꾼다 — 말로만 "누르세요" 하지 않고 눌러 줄 자리를 준다
      const split = splitActions(res.answer);
      thinking.innerHTML = renderAnswer(split.body);
      renderActions(thinking, split.actions);
      history.push({ role: 'user', text: q });
      history.push({ role: 'assistant', text: split.body || res.answer });
      if (history.length > 12) history = history.slice(-12);
      const badge = document.querySelector('#assistantOverlay .as-badge');
      if (badge && res.engineLabel) {
        badge.title = res.engineLabel + (res.free ? ' · 추가 비용 0' : '');
        badge.textContent = String(res.engine || res.engineLabel) + (res.free ? ' · 비용 0' : '');
        badge.style.background = res.free ? 'rgba(249,115,22,.16)' : 'rgba(139,92,246,.16)';
        badge.style.borderColor = res.free ? 'rgba(249,115,22,.35)' : 'rgba(139,92,246,.4)';
        badge.style.color = res.free ? '#fdba74' : '#c4b5fd';
      }
    } else if (res?.needsAgent) {
      // v3.8.714: 비서는 에이전트 전용이다 — API 로 몰래 넘어가 요금을 물리지 않는다
      thinking.innerHTML = '<b>AI 비서는 구독 에이전트로만 동작합니다.</b><br>'
        + 'Codex · Claude Code 중 하나에 로그인하면 <b>추가 비용 없이</b> 쓸 수 있습니다.<br>'
        + '<button type="button" class="as-open-settings" style="margin-top:9px; padding:8px 14px; border:0; border-radius:9px;'
        + ' background:linear-gradient(135deg,#f97316,#ea580c); color:#fff; font-size:12px; font-weight:800; cursor:pointer;">'
        + '환경설정 → Agent 계정 열기</button>';
      thinking.querySelector('.as-open-settings')?.addEventListener('click', () => {
        document.getElementById('assistantOverlay')?.remove();
        window.openSettingsModal?.();
      });
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
    // v3.8.714: 어느 에이전트로 답할지 + 그 안에서 어느 모델로 답할지
    + '<select class="as-agent" title="이 비서가 쓸 에이전트 (글 생성용 설정과 별개입니다)"></select>'
    + '<select class="as-model" title="이 비서가 쓸 모델"></select>'
    + '<span class="as-badge">확인 중…</span>'
    // v3.8.714: 대화는 닫아도 남는다 — 지우는 것은 사장님이 정한다
    + '<button type="button" class="as-clear" title="이 대화를 지우고 새로 시작합니다">🗑</button>'
    + '<button type="button" class="as-x" title="닫기 (대화는 그대로 남습니다)">✕</button>'
    + '</div>'
    + '<div class="as-body"></div>'
    + '<div class="as-presets">'
    + PRESETS.map((p) => '<button type="button" class="as-preset">' + esc(p) + '</button>').join('')
    + '</div>'
    + '<div class="as-foot">'
    + '<textarea class="as-input" rows="1" placeholder="예: 티스토리에 발행이 자꾸 실패해요"></textarea>'
    + '<button type="button" class="as-send">보내기</button>'
    + '</div></div>';
  document.body.appendChild(overlay);

  /**
   * 💬 v3.8.714 — 창을 닫아도 대화는 남는다.
   *
   * 사장님: "사이드탭닫으면 이전대화가 초기화되버리네 초기화는 수동으로 되게끔 해줘"
   *
   * 대화 내용(history)은 원래 모듈에 남아 있었는데, 다시 열 때 **화면에 다시 그리지 않아서**
   * 지워진 것처럼 보였다. 이제 열 때 지난 대화를 그대로 복원하고, 지우는 건 🗑 버튼으로만 한다.
   * (디스크에는 저장하지 않는다 — 진단 내용이 남으면 안 된다. 앱을 끄면 사라진다.)
   */
  /**
   * v3.8.714 — 안내문은 **접어 둔다.**
   * 사장님: "이거 문단정리 깔끔하게 해서 위에 접을수있게해주고"
   * 매번 세 줄이 펼쳐져 있으면 대화가 시작되기도 전에 화면이 반쯤 찬다.
   */
  const greet = () => {
    addMsg('bot',
      '<details class="as-intro">'
      + '<summary>무엇이든 물어보세요 — 앱 상태를 직접 보고 답합니다</summary>'
      + '<ul>'
      + '<li>발행 실패·이미지 오류 같은 <b>지금 이 앱의 문제</b>를 최근 기록까지 보고 짚어 드립니다.</li>'
      + '<li>글감·제목·구성 제안, 문장 다듬기 같은 <b>글쓰기 일</b>도 도와드립니다.</li>'
      + '<li>키·비밀번호는 <b>보지 않습니다</b> — 들어 있는지 여부만 확인합니다.</li>'
      + '<li>답은 로그인된 구독 에이전트가 만듭니다 — <b>추가 비용 0</b>.</li>'
      + '</ul></details>');
  };
  const restore = () => {
    const body = bodyEl();
    if (!body) return;
    body.innerHTML = '';
    if (!history.length) { greet(); return; }
    history.forEach((turn) => {
      const el = addMsg(turn.role === 'user' ? 'me' : 'bot',
        turn.role === 'user' ? esc(turn.text) : renderAnswer(turn.text));
      if (turn.role === 'assistant' && el) renderActions(el, splitActions(turn.text).actions);
    });
    const note = document.createElement('div');
    note.className = 'as-note';
    note.textContent = '지난 대화를 이어서 보고 있습니다 · 지우려면 🗑';
    body.insertBefore(note, body.firstChild);
  };
  restore();

  const input = overlay.querySelector('.as-input');
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);

  overlay.querySelector('.as-x').addEventListener('click', close);
  overlay.querySelector('.as-clear').addEventListener('click', () => {
    if (busy) return;
    history = [];
    const body = bodyEl();
    if (body) body.innerHTML = '';
    greet();
  });
  // 서랍이라 바깥 클릭으로 닫지 않는다 — 뒤 화면을 만지려고 누른 것이지 닫으려는 게 아니다
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

  /**
   * v3.8.714 — 이 비서가 **어느 에이전트로, 어느 모델로** 답할지 고른다.
   *
   * 사장님: "ai 비서 옆에 배찌도 코덱스로 할지 클로드코드로할지 선택가능하게해야지"
   *
   * 에이전트 선택은 **비서 전용**이다(글 생성용 에이전트를 건드리지 않는다) —
   * 비서를 코덱스로 바꿨다고 글까지 코덱스로 나가면 사장님이 모르는 사이에 바뀐다.
   * 모델은 홈 배지와 같은 저장소를 쓴다 — 같은 에이전트인데 값이 따로 놀면 안 된다.
   */
  const agentSel = overlay.querySelector('.as-agent');
  const modelSel = overlay.querySelector('.as-model');
  const badge = overlay.querySelector('.as-badge');
  let catalog = null;
  let readyAgents = [];

  const paintModels = (provider) => {
    if (!modelSel) return;
    const list = catalog?.[provider] || [];
    if (!list.length) { modelSel.style.display = 'none'; return; }
    modelSel.style.display = '';
    const current = (() => {
      try { return String(window.getAgentModel?.(provider) || ''); } catch { return ''; }
    })();
    modelSel.innerHTML = list.map((m) => (
      '<option value="' + esc(m.value) + '"' + (m.value === current ? ' selected' : '') + '>'
      + esc(m.label) + '</option>'
    )).join('');
  };

  const paintBadge = (provider) => {
    if (!badge) return;
    const ready = readyAgents.some((a) => a.provider === provider);
    if (ready) {
      badge.title = provider + ' 에이전트 · 구독 사용량 · 추가 비용 0';
      badge.textContent = '비용 0';
      badge.style.background = 'rgba(249,115,22,.16)';
      badge.style.borderColor = 'rgba(249,115,22,.35)';
      badge.style.color = '#fdba74';
    } else {
      // v3.8.714: 비서는 에이전트 전용 — 키가 있어도 API 로 답하지 않는다
      badge.title = '이 에이전트는 로그인돼 있지 않습니다';
      badge.textContent = '로그인 필요';
      badge.style.background = 'rgba(239,68,68,.14)';
      badge.style.borderColor = 'rgba(239,68,68,.4)';
      badge.style.color = '#fca5a5';
    }
  };

  const paintAgents = () => {
    if (!agentSel) return;
    const chosen = assistantAgent();
    agentSel.innerHTML = AGENT_CHOICES.map((a) => {
      const ready = readyAgents.some((x) => x.provider === a.id);
      return '<option value="' + a.id + '"' + (a.id === chosen ? ' selected' : '') + '>'
        + esc(a.label + (ready ? '' : ' (로그인 필요)')) + '</option>';
    }).join('');
    paintModels(chosen);
    paintBadge(chosen);
  };

  agentSel?.addEventListener('change', () => {
    setAssistantAgent(agentSel.value);
    paintModels(agentSel.value);
    paintBadge(agentSel.value);
  });
  modelSel?.addEventListener('change', () => {
    try { window.setAgentModel?.(assistantAgent(), modelSel.value); }
    catch { /* 저장 실패해도 이번 대화엔 쓰인다 */ }
  });

  Promise.all([
    Promise.resolve(window.electronAPI?.invoke?.('agent:models')).catch(() => null),
    Promise.resolve(window.electronAPI?.invoke?.('assistant:diagnostics')).catch(() => null),
  ]).then(([models, diag]) => {
    catalog = models?.models || null;
    readyAgents = (diag?.diagnostics?.engine?.loggedInAgents || []).filter((a) => a.status === 'ready');
    // 고른 에이전트가 로그인 안 돼 있고 다른 하나가 준비돼 있으면 그쪽으로 맞춰 준다
    if (readyAgents.length && !readyAgents.some((a) => a.provider === assistantAgent())) {
      setAssistantAgent(readyAgents[0].provider);
    }
    paintAgents();
  }).catch(() => { /* 헤더는 장식이다 — 실패해도 대화는 된다 */ });
}

export function initAssistant() {
  window.openAssistant = openAssistant;
}
