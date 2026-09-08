/**
 * cta-agency-bootstrap — 이름 목록을 실측해서 src/cta/agency-seed.ts 를 만든다. (v3.8.706)
 *
 *   npm run build && node scripts/cta-agency-bootstrap.js [--only-missing] [--fresh] [--limit N]
 *
 * 이름마다: 네이버 웹문서 "이름 홈페이지" → 호스트 집계 → 1등 홈을 열어 이름이 적혀 있는지 확인.
 * 앱이 발행하면서 배우는 그 함수(resolveAgencyHost)를 learn:false 로 그대로 쓴다 — 시드와 학습이 같은 눈으로 본다.
 * 사람이 적은 주소는 하나도 없다. 못 찾은 이름은 그대로 두고(시드에서 빠짐) 발행 때 다시 배운다.
 *
 * --only-missing : 지금 시드에 이미 있는 이름은 건너뛴다(빠르게 보탈 때)
 * --fresh        : 이번에 못 찾은 이름은 옛 값을 **유지하지 않는다** — 판정 규칙을 조인 뒤 틀린 옛 값을 털 때
 * --limit N      : 앞에서 N개만 (시험용)
 */
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
require(path.join(ROOT, 'node_modules', 'dotenv')).config({ path: path.join(ROOT, '.env') });

const { resolveAgencyHost, configureAgencyRegistry } = require(path.join(ROOT, 'dist', 'cta', 'agency-registry'));
const { naverSearch } = require(path.join(ROOT, 'dist', 'core', 'naver-search-client'));
const names = require('./cta-agency-names');

const argv = process.argv.slice(2);
const onlyMissing = argv.includes('--only-missing');
const dropStale = argv.includes('--fresh');
const limitIdx = argv.indexOf('--limit');
const limit = limitIdx >= 0 ? Number(argv[limitIdx + 1]) : Infinity;
const SEED_PATH = path.join(ROOT, 'src', 'cta', 'agency-seed.ts');

/** 지금 시드를 읽어 둔다 — --only-missing 과 "못 찾았을 때 옛 값 유지"에 쓴다 */
function readCurrentSeed() {
  try {
    const src = fs.readFileSync(SEED_PATH, 'utf8');
    // render() 가 적는 한 줄 꼴 그대로 읽는다 — TS 리터럴이라 JSON.parse 는 못 읽는다(키에 따옴표가 없다)
    const line = /\{ name: ("[^"]*"), host: ("[^"]*"), url: ("[^"]*"), verifiedAt: ("[^"]*") \}/g;
    return [...src.matchAll(line)].map(([, name, host, url, verifiedAt]) => ({
      name: JSON.parse(name), host: JSON.parse(host), url: JSON.parse(url), verifiedAt: JSON.parse(verifiedAt),
    }));
  } catch {
    return [];
  }
}

const search = async (query) => {
  const res = await naverSearch('webkr', { query, display: 10 });
  if (!res || !res.ok) return [];
  return (res.items || []).map((it) => ({
    url: String(it.link || ''),
    title: String(it.title || '').replace(/<[^>]*>/g, ''),
  }));
};

/**
 * 앱과 같은 열기(page-fetcher). 단 이 스크립트는 Node 라 크로미움이 없다 —
 * 중간 인증서를 안 보내는 관공서(한국소비자원·E-Gen·국가교통정보센터 실측)를 열기 위해 **이 프로세스에서만** 인증서 검증을 끈다.
 * 읽는 것은 공개 HTML 의 제목뿐이고, 결과는 시드 diff 로 사람이 본다. 앱에는 이 설정이 없다.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createCtaPageFetcher } = require(path.join(ROOT, 'dist', 'cta', 'page-fetcher'));
const fetchPage = createCtaPageFetcher({ timeoutMs: 8000 });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function render(entries) {
  const body = entries
    .map((e) => `  { name: ${JSON.stringify(e.name)}, host: ${JSON.stringify(e.host)}, url: ${JSON.stringify(e.url)}, verifiedAt: ${JSON.stringify(e.verifiedAt)} },`)
    .join('\n');
  return `/**
 * agency-seed — 기관 이름 → 공식 호스트 시드. **생성 파일이다. 손으로 고치지 않는다.**
 *
 * 만드는 법: \`npm run build && node scripts/cta-agency-bootstrap.js\`
 *   scripts/cta-agency-names.js 의 **이름 목록**을 네이버 웹문서로 검색하고, 1등 호스트의
 *   홈을 실제로 열어 이름이 적혀 있는지 확인한 것만 여기에 적는다.
 *   (주소를 사람이 치지 않는다 — v3.8.490 letskorail→korail 처럼 손으로 적은 주소는 낡는다)
 *
 * 비어 있어도 앱은 돈다 — 그때는 발행하면서 하나씩 배운다(agency-registry.learnAgency).
 * 마지막 생성: ${new Date().toISOString()} · ${entries.length}곳
 */
export interface AgencySeedEntry {
  name: string;
  host: string;
  url: string;
  verifiedAt: string;
}

export const AGENCY_SEED: AgencySeedEntry[] = [
${body}
];
`;
}

async function main() {
  // 학습 파일·시드·카탈로그를 거치지 않고 **매번 검색으로** 확인한다 — 시드가 시드를 베끼면 낡은 값이 굳는다
  configureAgencyRegistry({ storePath: null });
  const current = readCurrentSeed();
  const currentByName = new Map(current.map((e) => [e.name, e]));
  const list = names.all().filter((n, i, arr) => arr.indexOf(n) === i).slice(0, limit);

  const found = [];
  const missed = [];
  let i = 0;
  for (const name of list) {
    i += 1;
    if (onlyMissing && currentByName.has(name)) {
      found.push(currentByName.get(name));
      continue;
    }
    const logs = [];
    const entry = await resolveAgencyHost({ name, search, fetchPage, learn: false, fresh: true, onLog: (m) => logs.push(m) });
    if (entry) {
      found.push({ name: entry.name, host: entry.host, url: entry.url, verifiedAt: entry.verifiedAt });
      console.log(`[${i}/${list.length}] ✅ ${name} → ${entry.host}`);
    } else {
      const prev = currentByName.get(name);
      if (prev && !dropStale) {
        found.push(prev);   // 이번엔 못 봤지만 전에 확인한 값은 지우지 않는다(검색 흔들림 방어)
        console.log(`[${i}/${list.length}] ♻️ ${name} — 이번 검색은 실패, 지난 값 유지(${prev.host})`);
      } else {
        missed.push({ name, why: logs[logs.length - 1] || '' });
        console.log(`[${i}/${list.length}] ❌ ${name} — ${logs[logs.length - 1] || '후보 없음'}`);
      }
    }
    await sleep(300);
  }

  found.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  fs.writeFileSync(SEED_PATH, render(found), 'utf8');
  console.log(`\n시드 ${found.length}곳 기록 → ${path.relative(ROOT, SEED_PATH)}`);
  if (missed.length) {
    console.log(`못 찾은 이름 ${missed.length}곳:`);
    for (const m of missed) console.log(`  · ${m.name}${m.why ? ` — ${m.why}` : ''}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
