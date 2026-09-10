#!/usr/bin/env node
/**
 * 📖 발행된 글의 «읽는 맛» 을 잰다 (v3.8.714)
 *
 * 사장님: "글어떠니 말투가 좀 어색한게아직있는데" → 읽어 보니 네 가지가 나왔다.
 *   문장 한가운데 줄바꿈 · 표 셀 서술형 · 훈계조 반복 · 글이 자기 구조를 설명
 * 그런데 그때까지 **아무도 이걸 세지 않았다.** 세지 않으면 고쳐도 나아졌는지 모른다.
 *
 * 이 하네스는 발행된 글(URL)이나 저장된 HTML 을 받아 그 항목들을 세고 표로 찍는다.
 * 프롬프트를 손보기 **전에 한 번, 뒤에 한 번** 돌려 숫자로 비교하는 것이 쓰는 법이다.
 *
 * 사용:
 *   node scripts/style-harness.js <url|파일> [...]        재고 표로 출력
 *   node scripts/style-harness.js --save before.json <url> 결과를 파일로 (비교용)
 *   node scripts/style-harness.js --diff before.json after.json   두 번의 차이
 *
 * 생성까지 해서 재려면 scripts/quality-run.js 를 쓴다(비용 발생). 이 스크립트는 **읽기만** 한다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function loadDiagnose() {
  try {
    return require(path.join(ROOT, 'dist/core/final/post-critique.js')).diagnosePost;
  } catch (error) {
    console.error('먼저 빌드가 필요합니다: npm run build');
    process.exit(1);
  }
}

/** 글 본문만 남긴다 — 머리글·댓글·사이드바를 세면 숫자가 거짓말이 된다 */
function extractArticle(html) {
  const cleaned = String(html || '').replace(
    /<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>|<header[\s\S]*?<\/header>|<footer[\s\S]*?<\/footer>/gi,
    '',
  );
  const start = cleaned.indexOf('<article');
  const end = cleaned.lastIndexOf('</article>');
  return (start >= 0 && end > start) ? cleaned.slice(start, end) : cleaned;
}

function textOf(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * 항목별로 센다. **여기서 세는 것이 곧 고칠 목록**이다 —
 * 새로 눈에 걸리는 게 생기면 한 줄 더 넣는다.
 */
function measure(html) {
  const body = extractArticle(html);
  const text = textOf(body);

  const midBreaks = [...body.matchAll(/([^<>]{6,60}?)<br\s*\/?>/gi)]
    .map((m) => String(m[1] || '').trim())
    .filter((t) => /(?:,|이며|하며|하고|이고|지만|이지|것이지|면서|않고|없이|이나|거나|는데|은데|아서|어서|라서)\s*$/.test(t));

  const cells = [...body.matchAll(/<t[dh][^>]*>([\s\S]{2,80}?)<\/t[dh]>/gi)]
    .map((m) => textOf(m[1]));
  const verbCells = cells.filter((c) => /(입니다|합니다|됩니다)\.?$/.test(c));

  const scolding = text.match(/[^.!?]{5,60}?(?:해서는 안 됩니다|하면 안 됩니다|해서는 안 된다)/g) || [];
  const meta = text.match(/[^.!?]{5,60}?(?:나누어 살펴봅니다|살펴보겠습니다|구분할 필요가 있습니다|정리해 보겠습니다|알아보겠습니다|순서입니다)/g) || [];
  const hedge = text.match(/(?:편이 좋습니다|편이 낫습니다|필요가 있습니다|수 있습니다)/g) || [];

  // 독자가 가장 먼저 찾는 숫자가 있는가 (금액·기간·날짜)
  const money = text.match(/\d[\d,]*\s*(?:만원|억원|원)/g) || [];
  const dates = text.match(/\d{4}년\s*\d{1,2}월(?:\s*\d{1,2}일)?/g) || [];

  return {
    글자수: text.length,
    문장중간줄바꿈: midBreaks.length,
    표셀서술형: verbCells.length,
    표셀총: cells.length,
    훈계조: scolding.length,
    메타문장: meta.length,
    애매한마무리: hedge.length,
    금액: money.length,
    날짜: dates.length,
    보기: {
      문장중간줄바꿈: midBreaks.slice(0, 2).map((s) => `…${s.slice(-30)} ⏎`),
      표셀서술형: verbCells.slice(0, 2),
      훈계조: scolding.slice(0, 2).map((s) => s.trim()),
    },
  };
}

async function fetchHtml(target) {
  if (fs.existsSync(target)) return fs.readFileSync(target, 'utf8');
  const res = await fetch(target, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    redirect: 'follow',
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function printRow(name, m) {
  const per1000 = (n) => (m.글자수 ? (n / m.글자수 * 1000).toFixed(1) : '0');
  console.log(`\n── ${name}  (${m.글자수.toLocaleString()}자)`);
  console.log(`   문장중간 줄바꿈 ${String(m.문장중간줄바꿈).padStart(3)}  ·  표 서술형 ${m.표셀서술형}/${m.표셀총}`);
  console.log(`   훈계조 ${String(m.훈계조).padStart(3)}  ·  메타문장 ${m.메타문장}  ·  애매한 마무리 ${m.애매한마무리} (1,000자당 ${per1000(m.애매한마무리)})`);
  console.log(`   금액 ${m.금액}개  ·  날짜 ${m.날짜}개`);
  for (const [k, list] of Object.entries(m.보기)) {
    for (const line of list) console.log(`     · ${k}: ${line}`);
  }
}

function diff(beforeFile, afterFile) {
  const before = JSON.parse(fs.readFileSync(beforeFile, 'utf8'));
  const after = JSON.parse(fs.readFileSync(afterFile, 'utf8'));
  const keys = ['문장중간줄바꿈', '표셀서술형', '훈계조', '메타문장', '애매한마무리', '금액', '날짜'];
  console.log('\n항목            이전   이후   변화');
  for (const key of keys) {
    const b = (before.items || []).reduce((s, x) => s + (x.measure[key] || 0), 0);
    const a = (after.items || []).reduce((s, x) => s + (x.measure[key] || 0), 0);
    const mark = a === b ? '=' : (a < b ? '▼ 좋아짐' : '▲ 나빠짐');
    // 금액·날짜는 많을수록 좋다 — 방향이 반대다
    const good = ['금액', '날짜'].includes(key) ? (a > b ? '▲ 좋아짐' : (a < b ? '▼ 나빠짐' : '=')) : mark;
    console.log(`${key.padEnd(14)} ${String(b).padStart(4)} ${String(a).padStart(6)}   ${good}`);
  }
}

(async () => {
  const args = process.argv.slice(2);
  if (args[0] === '--diff') { diff(args[1], args[2]); return; }

  let saveTo = '';
  const targets = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--save') { saveTo = args[++i]; continue; }
    targets.push(args[i]);
  }
  if (!targets.length) {
    console.log('사용: node scripts/style-harness.js <url|파일> [...]  (또는 --diff a.json b.json)');
    return;
  }

  const diagnosePost = loadDiagnose();
  const items = [];
  for (const target of targets) {
    try {
      const html = await fetchHtml(target);
      const body = extractArticle(html);
      const m = measure(html);
      const issues = diagnosePost({ title: '', html: body, competitors: [] })
        .filter((x) => x.area === 'style')
        .map((x) => `${x.severity} ${x.title}`);
      items.push({ target, measure: m, styleIssues: issues });
      printRow(path.basename(target).slice(0, 60), m);
      if (issues.length) console.log(`   비평(style): ${issues.join(' · ')}`);
    } catch (error) {
      console.log(`\n── ${target}\n   읽지 못했습니다: ${error.message}`);
    }
  }

  if (saveTo) {
    fs.writeFileSync(saveTo, JSON.stringify({ at: new Date().toISOString(), items }, null, 1), 'utf8');
    console.log(`\n저장: ${saveTo} (나중에 --diff 로 비교)`);
  }
})();
