#!/usr/bin/env node
/**
 * DNS 레코드 전수 조사 — 네임서버를 바꾸기 전에 반드시 남긴다.
 *
 * 네임서버를 옮기면 새 쪽에 없는 레코드는 그 순간 사라진다.
 * 메일(MX)·소유확인(TXT)·서브도메인이 조용히 죽는 사고가 여기서 난다.
 * 그래서 옮기기 전 목록을 파일로 떠 두고, 옮긴 뒤 같은 스크립트로 대조한다.
 *
 * 사용: node docs/site-kit/bench/dns-inventory.js [도메인] [저장이름]
 */
const dns = require('dns').promises;
const fs = require('fs');
const path = require('path');

const DOMAIN = process.argv[2] || 'leadernam.com';
const SAVE_AS = process.argv[3] || null;
const OUT_DIR = path.join(__dirname, 'dns');

// 실제로 쓰이는 이름만 고른다. 없는 것은 조용히 넘어간다.
const SUBDOMAINS = [
  '', 'www', 'mail', 'smtp', 'imap', 'pop', 'webmail', 'ftp', 'cpanel',
  'blog', 'shop', 'api', 'cdn', 'static', 'img', 'admin', 'dev', 'test',
  'm', 'news', 'mx', 'autodiscover', '_dmarc',
];

const TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'SRV', 'CAA'];

const resolver = new dns.Resolver();
resolver.setServers(['8.8.8.8', '1.1.1.1']);

async function lookup(name, type) {
  try {
    const r = await resolver.resolve(name, type);
    return Array.isArray(r) && r.length ? r : null;
  } catch {
    return null; // 없는 레코드는 정상이다
  }
}

(async () => {
  const found = {};
  console.log('조사 대상: ' + DOMAIN + '\n');

  for (const sub of SUBDOMAINS) {
    const name = sub ? sub + '.' + DOMAIN : DOMAIN;
    const rec = {};
    for (const type of TYPES) {
      // 최상위에만 있는 것은 서브도메인에서 굳이 묻지 않는다
      if (sub && (type === 'SOA' || type === 'NS' || type === 'CAA')) continue;
      const v = await lookup(name, type);
      if (v) rec[type] = v;
    }
    if (Object.keys(rec).length) found[name] = rec;
  }

  let 총개수 = 0;
  for (const [name, rec] of Object.entries(found)) {
    console.log('■ ' + name);
    for (const [type, vals] of Object.entries(rec)) {
      for (const v of vals) {
        총개수++;
        const s = typeof v === 'string' ? v
          : Array.isArray(v) ? v.join('')
          : v.exchange ? v.priority + ' ' + v.exchange
          : JSON.stringify(v);
        console.log('   ' + type.padEnd(6) + s.slice(0, 150));
      }
    }
  }

  console.log('\n총 ' + 총개수 + '건 / 이름 ' + Object.keys(found).length + '개');

  const 메일있음 = Object.values(found).some((r) => r.MX);
  const 소유확인 = [];
  for (const rec of Object.values(found)) {
    for (const t of rec.TXT || []) {
      const s = Array.isArray(t) ? t.join('') : String(t);
      if (/verification|verify|site-verification|naver|google|facebook|_domainkey|v=spf|v=DMARC/i.test(s)) {
        소유확인.push(s.slice(0, 90));
      }
    }
  }

  console.log('\n── 옮길 때 특히 조심할 것 ──');
  console.log('  메일(MX): ' + (메일있음 ? '있음 — 빠뜨리면 메일이 죽는다 ⚠️' : '없음 (이 도메인으로 메일을 안 받는다)'));
  console.log('  소유확인·메일인증 TXT: ' + (소유확인.length ? 소유확인.length + '건 ⚠️' : '없음'));
  for (const s of 소유확인) console.log('     · ' + s);

  if (SAVE_AS) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const p = path.join(OUT_DIR, SAVE_AS + '.json');
    fs.writeFileSync(p, JSON.stringify({ domain: DOMAIN, takenAt: new Date().toISOString(), records: found }, null, 2));
    console.log('\n저장: ' + path.relative(process.cwd(), p));
    console.log('옮긴 뒤 대조:  node docs/site-kit/bench/dns-compare.js ' + SAVE_AS);
  }
})().catch((e) => {
  console.error('❌ 실패:', e.message);
  process.exit(1);
});
