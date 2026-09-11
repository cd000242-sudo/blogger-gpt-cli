/**
 * 이미 발행된 글에서 wpautop 피해를 걷어낸다 (v3.8.716)
 *
 * ## 왜 필요한가
 * 에이전트로 발행된 글은 본문 줄바꿈이 태그 안쪽에 남아 있어서, 워드프레스가 화면을 그릴 때
 * `wpautop` 이 그 자리에 `<p>` 와 `<br>` 를 끼워 넣는다. 결과는 셋이다:
 *   · 제목 아래 빈 공간      ← 본문에 실린 <meta> 가 <p>+<br> 로 쌓인다
 *   · CTA 카드 3조각 분해    ← <a> flex 안에 </p> 가 끼어든다 (링크가 죽는다)
 *   · 박스 아래 과잉 여백    ← 짝 없는 </p> 가 유령 빈 문단을 만든다
 *
 * 저장된 원본은 멀쩡하다 — 깨지는 건 렌더 시점이다. 그래서 원본을 **줄바꿈 없는 형태로
 * 다시 저장**하면 wpautop 이 파고들 자리가 사라진다. 본문 내용은 한 글자도 바뀌지 않는다.
 *
 * 새로 발행되는 글은 v3.8.716 에서 발행 직전에 같은 처리를 하므로 이 스크립트가 필요 없다.
 * 이건 그 수정 **이전에 나간 글**을 위한 일회성 복구다.
 *
 * ## 쓰는 법
 *   set WP_SITE_URL=https://leadernam.com
 *   set WP_USER=아이디
 *   set WP_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx   (워드프레스 애플리케이션 비밀번호)
 *
 *   node scripts/repair-wpautop-posts.js            → 최근 글을 훑어 피해 글 목록만 보여준다
 *   node scripts/repair-wpautop-posts.js 5707       → 그 글이 어떻게 바뀌는지 미리 보여준다
 *   node scripts/repair-wpautop-posts.js 5707 --apply   → 실제로 고친다
 *   node scripts/repair-wpautop-posts.js --all --apply  → 찾은 글을 전부 고친다
 *
 * 되돌리기: 워드프레스가 수정 전 판(리비전)을 남기므로 글 편집 화면에서 복원할 수 있다.
 */
const path = require('path');

const { stripHeadOnlyTags } = require(path.join(__dirname, '..', 'dist', 'core', 'final', 'head-tag-strip'));
const { neutralizeWpAutop } = require(path.join(__dirname, '..', 'dist', 'wordpress', 'wordpress-publisher'));

const SITE = String(process.env.WP_SITE_URL || 'https://leadernam.com').replace(/\/+$/, '');
const USER = process.env.WP_USER || '';
const PASS = process.env.WP_APP_PASSWORD || '';
const SCAN_COUNT = Number(process.env.WP_SCAN_COUNT || 50);

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const all = args.includes('--all');
const ids = args.filter((a) => /^\d+$/.test(a)).map(Number);

const authHeader = () => 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');

async function wpGet(pathname, authed) {
  const headers = authed ? { Authorization: authHeader() } : {};
  const res = await fetch(`${SITE}/wp-json/wp/v2/${pathname}`, { headers });
  if (!res.ok) throw new Error(`GET ${pathname} → ${res.status} ${await res.text().catch(() => '')}`.slice(0, 300));
  return res.json();
}

async function wpUpdateContent(id, content) {
  const res = await fetch(`${SITE}/wp-json/wp/v2/posts/${id}`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`UPDATE ${id} → ${res.status} ${await res.text().catch(() => '')}`.slice(0, 300));
  return res.json();
}

/**
 * 깨진 CSS 속성 복구 — 실측(발행글 5707): `line攻height:1.85`.
 * 글자 하나가 섞여 들어가 그 문단만 줄간격이 죽는다. 아는 속성 이름만 좁게 고친다.
 */
function repairBrokenCssProps(html) {
  let fixed = 0;
  const out = String(html).replace(
    /\b(line|font|letter|word)[^\x00-\x7F](height|size|weight|family|spacing|break)\b/g,
    (_m, head, tail) => { fixed += 1; return `${head}-${tail}`; },
  );
  return { html: out, fixed };
}

/** 저장된 원본 하나를 고친 모양으로 만든다 (내용은 그대로, 줄바꿈·head 태그만 정리) */
function repairContent(raw) {
  const stripped = stripHeadOnlyTags(raw);
  const css = repairBrokenCssProps(stripped.html);
  const flattened = neutralizeWpAutop(css.html);
  return {
    html: flattened,
    metaRemoved: stripped.removed,
    cssFixed: css.fixed,
    newlinesRemoved: (String(raw).match(/\r?\n/g) || []).length - (flattened.match(/\r?\n/g) || []).length,
    changed: flattened !== raw,
  };
}

/** 렌더된 본문에서 피해 정도를 센다 (인증 없이도 볼 수 있다) */
function damageOf(rendered) {
  const c = String(rendered || '');
  const open = (c.match(/<p\b/gi) || []).length;
  const close = (c.match(/<\/p>/gi) || []).length;
  return {
    meta: (c.match(/<meta\b/gi) || []).length,
    strayClose: Math.max(0, close - open),
    br: (c.match(/<br\s*\/?>/gi) || []).length,
  };
}

async function scan() {
  const posts = await wpGet(`posts?per_page=${SCAN_COUNT}&_fields=id,date,title,content,link`);
  const hits = [];
  for (const p of posts) {
    const d = damageOf(p.content?.rendered);
    if (d.meta > 0 || d.strayClose > 0) {
      hits.push({ id: p.id, date: String(p.date).slice(0, 10), ...d, title: p.title?.rendered || '' });
    }
  }
  return hits;
}

async function main() {
  if (!USER || !PASS) {
    console.log('ℹ️ WP_USER / WP_APP_PASSWORD 가 없어 **조사만** 합니다 (고치려면 두 값이 필요합니다).\n');
  }
  console.log(`🔎 사이트: ${SITE}`);

  let targets = ids;
  if (targets.length === 0) {
    const hits = await scan();
    console.log(`\n최근 ${SCAN_COUNT}편 중 깨진 글 ${hits.length}편`);
    for (const h of hits) {
      console.log(`  · ${h.id} (${h.date}) meta ${h.meta} · 짝없는 </p> ${h.strayClose} · <br> ${h.br} — ${h.title.slice(0, 40)}`);
    }
    if (!all) {
      console.log('\n글 번호를 주거나 --all 을 붙이면 고칠 내용을 보여줍니다. 실제 수정은 --apply.');
      return;
    }
    targets = hits.map((h) => h.id);
  }

  if (targets.length === 0) return console.log('고칠 글이 없습니다.');
  if (!USER || !PASS) return console.log('\n⚠️ 인증 정보가 없어 원본을 읽을 수 없습니다.');

  let done = 0;
  for (const id of targets) {
    try {
      const post = await wpGet(`posts/${id}?context=edit&_fields=id,title,content,link`, true);
      const raw = post.content?.raw || '';
      const r = repairContent(raw);
      const label = `${id} — ${String(post.title?.raw || post.title?.rendered || '').slice(0, 34)}`;

      if (!r.changed) {
        console.log(`\n✅ ${label}: 이미 깨끗합니다 (건드리지 않음)`);
        continue;
      }
      console.log(`\n${apply ? '🛠️' : '👀'} ${label}`);
      console.log(`   head 태그 ${r.metaRemoved}개 제거 · 줄바꿈 ${r.newlinesRemoved}개 정리 · 깨진 CSS ${r.cssFixed}건 복구`);
      console.log(`   본문 ${raw.length} → ${r.html.length}자 (평문 길이 변화 없음: ${
        raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length} → ${
        r.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length})`);

      if (!apply) { console.log('   (미리보기입니다 — 고치려면 --apply)'); continue; }

      await wpUpdateContent(id, r.html);
      const after = await wpGet(`posts/${id}?_fields=content`);
      const d = damageOf(after.content?.rendered);
      console.log(`   ✅ 저장 완료 → 지금 화면: meta ${d.meta} · 짝없는 </p> ${d.strayClose} · <br> ${d.br}`);
      if (d.meta === 0 && d.strayClose === 0) done += 1;
      else console.log('   ⚠️ 아직 남아 있습니다 — 이 글은 눈으로 확인이 필요합니다.');
    } catch (error) {
      console.error(`   ❌ ${id} 실패: ${error.message}`);
    }
  }
  if (apply) console.log(`\n총 ${done}/${targets.length}편 복구 확인`);
}

main().catch((e) => { console.error('실패:', e.message); process.exit(1); });
