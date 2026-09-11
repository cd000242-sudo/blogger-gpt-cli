/**
 * 블로그스팟 발행글 손보기 — 말투 + 손님께 보여드리기 전에 걸리는 것들. (2026-09-11)
 *
 * 사장님: "말투를 좀 더 자연스럽게 사람처럼 나오게 해줘 … 블로그스팟을 고쳐줘 이걸 보여주게"
 *
 * ## 하는 일
 *   ① 말투 — 「~합니다」만 이어지는 문장에 `~죠 · ~거든요` 를 섞는다(voice-softener).
 *      기한·절차·권리·면책 문장은 건드리지 않는다. 문단마다 최대 2문장만 바꾼다.
 *   ② 번호형 소제목 정리 — "1.", "1-1." 번호를 뗀다. 변호사님이 피해달라고 한 형태다.
 *   ③ 남의 법률정보 사이트 노출 제거 — 본문에 "www.lawnguide.co.kr" 이 글자로 박혀 있다.
 *   ④ FAQ 질문에 물음표 — "…되나요" 뒤에 ? 가 없다(5곳).
 *
 * ## 안 하는 일
 *   · 내용을 다시 쓰지 않는다. 문장 뜻은 그대로 두고 어미와 겉모습만 손본다.
 *   · 섹션을 지우거나 옮기지 않는다.
 *
 * 되돌리기: 적용 전 원본을 backups/ 에 저장한다.
 *
 *   node scripts/repair-blogspot-post.js          → 무엇이 바뀌는지 보여준다
 *   node scripts/repair-blogspot-post.js --apply  → 실제로 저장한다
 */
const fs = require('fs');
const path = require('path');

const apply = process.argv.includes('--apply');
const POST_URL = process.env.POST_URL || 'https://tjdgus24280.blogspot.com/2026/09/blog-post.html';

function loadEnv() {
  const p = path.join(process.env.APPDATA, 'lba', '.env');
  const env = {};
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = loadEnv();
const BLOG_ID = env.BLOG_ID || env.BLOGGER_ID;

async function accessToken() {
  const tokenPath = path.join(process.env.APPDATA, 'lba', 'blogger-token.json');
  const saved = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: saved.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`토큰 갱신 실패 ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).access_token;
}

async function api(pathname, token, init = {}) {
  const res = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}${pathname}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${pathname} → ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/** ② 번호형 소제목 정리 */
function deNumberHeadings(html) {
  let fixed = 0;
  const out = html.replace(/(<h[23][^>]*>)([\s\S]*?)(<\/h[23]>)/gi, (full, open, inner, close) => {
    const stripped = inner.replace(/^(\s*)(?:<[^>]+>\s*)*?(\d+(?:-\d+)?\.\s*)/, (m, sp) => { fixed += 1; return m.replace(/\d+(?:-\d+)?\.\s*/, ''); });
    return stripped === inner ? full : `${open}${stripped}${close}`;
  });
  return { html: out, fixed };
}

/** ③ 남의 법률정보 사이트 이름 제거 */
function removeForeignSiteMention(html) {
  let fixed = 0;
  const out = html
    .replace(/재판상 이혼 준비를 다룬 www\.lawnguide\.co\.kr 안내는/g, () => { fixed += 1; return '재판상 이혼 준비 안내는'; })
    .replace(/\s*www\.lawnguide\.co\.kr\s*/g, () => { fixed += 1; return ' '; });
  return { html: out, fixed };
}

/** ④ FAQ 질문에 물음표 */
function addQuestionMarks(html) {
  let fixed = 0;
  const out = html.replace(/((?:되|하|가|나|까)나요|될까요|할까요|되나요)(?=\s*(?:<|&#9660;))/g, (m) => { fixed += 1; return `${m}?`; });
  return { html: out, fixed };
}

(async () => {
  const token = await accessToken();
  const list = await api('/posts?maxResults=20&fetchBodies=true', token);
  const post = (list.items || []).find((p) => p.url === POST_URL) || (list.items || [])[0];
  if (!post) throw new Error('글을 찾지 못했습니다');

  console.log(`🔎 ${post.title}`);
  console.log(`   ${post.url}`);
  const before = post.content;
  console.log(`   원본 ${before.length}자\n`);

  const { softenHtmlVoice } = require(path.join(__dirname, '..', 'dist', 'core', 'final', 'voice-softener'));
  const voice = softenHtmlVoice(before, 2);
  const heads = deNumberHeadings(voice.html);
  const site = removeForeignSiteMention(heads.html);
  const marks = addQuestionMarks(site.html);
  const after = marks.html;

  console.log(`① 말투 섞은 문장      : ${voice.changed}개`);
  console.log(`② 번호형 소제목 정리  : ${heads.fixed}개`);
  console.log(`③ 외부 사이트 노출 제거: ${site.fixed}곳`);
  console.log(`④ FAQ 물음표 보강     : ${marks.fixed}개`);

  const plain = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  console.log(`\n평문 ${plain(before).length} → ${plain(after).length}자 (내용은 그대로여야 합니다)`);

  // 바뀐 문장 몇 개를 눈으로 확인
  const b = plain(before).split(/(?<=[.!?])\s+/);
  const a = plain(after).split(/(?<=[.!?])\s+/);
  console.log('\n바뀐 문장 예시');
  let shown = 0;
  for (let i = 0; i < Math.min(b.length, a.length) && shown < 8; i += 1) {
    if (b[i] !== a[i]) { console.log(`  - ${b[i]}\n  + ${a[i]}\n`); shown += 1; }
  }

  if (!apply) { console.log('(미리보기입니다 — 저장하려면 --apply)'); return; }

  const backupDir = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backup = path.join(backupDir, `blogspot-${post.id}-${Date.now()}.html`);
  fs.writeFileSync(backup, before, 'utf8');
  console.log(`\n💾 원본 백업: ${backup}`);

  await api(`/posts/${post.id}`, token, { method: 'PATCH', body: JSON.stringify({ content: after }) });
  const check = await api(`/posts/${post.id}`, token);
  console.log('✅ 저장 완료');
  console.log(`   번호형 소제목 남음: ${(check.content.match(/<h[23][^>]*>\s*\d+(-\d+)?\./gi) || []).length}개`);
  console.log(`   lawnguide 남음    : ${(check.content.match(/lawnguide/gi) || []).length}개`);
})().catch((e) => { console.error('실패:', e.message); process.exit(1); });
