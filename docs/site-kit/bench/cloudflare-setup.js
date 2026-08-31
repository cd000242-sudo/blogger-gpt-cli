#!/usr/bin/env node
/**
 * Cloudflare 설정 — 공식 API 로 한다. 대시보드 클릭을 흉내 내지 않는다.
 *
 * 대시보드는 자동화 브라우저를 막는다(정당한 봇 차단이다). 뚫으려 들 이유가 없다.
 * Cloudflare 는 같은 일을 하라고 API 를 열어 두었고, 그쪽이 더 정확하다.
 *
 * 하는 일:
 *   1) 토큰이 유효한지, 무슨 권한이 있는지 확인
 *   2) 영역(zone)이 없으면 만든다
 *   3) A 레코드를 지금과 똑같이 맞추고 프록시를 켠다
 *   4) SSL 을 Full(strict), Brotli·HTTP/3·TLS1.2 를 켠다  ← 네임서버 바꾸기 전에 해야 안전하다
 *   5) 가비아에 넣을 네임서버 두 개를 알려준다
 *
 * 네임서버는 이 스크립트가 바꾸지 않는다. 그건 사람이 결정할 일이다.
 *
 * 사용: CF_TOKEN=토큰 node docs/site-kit/bench/cloudflare-setup.js
 *      CF_TOKEN=토큰 node docs/site-kit/bench/cloudflare-setup.js --dry-run
 */
const API = 'https://api.cloudflare.com/client/v4';
const TOKEN = process.env.CF_TOKEN || '';
const DOMAIN = process.env.CF_DOMAIN || 'leadernam.com';
const ORIGIN_IP = process.env.CF_ORIGIN_IP || '161.35.46.236';
const DRY = process.argv.includes('--dry-run');

if (!TOKEN) {
  console.error('토큰이 없습니다:  CF_TOKEN=토큰 node docs/site-kit/bench/cloudflare-setup.js');
  process.exit(1);
}

async function cf(pathname, options = {}) {
  const res = await fetch(API + pathname, {
    ...options,
    headers: {
      Authorization: 'Bearer ' + TOKEN,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!json.success) {
    const msg = (json.errors || []).map((e) => e.code + ' ' + e.message).join(' / ') || ('HTTP ' + res.status);
    throw new Error(pathname + ' → ' + msg);
  }
  return json.result;
}

/** 설정 하나를 바꾼다. 이미 원하는 값이면 건드리지 않는다. */
async function setSetting(zoneId, key, value, label) {
  const cur = await cf('/zones/' + zoneId + '/settings/' + key).catch(() => null);
  const now = cur && cur.value;
  if (now === value) { console.log('   = ' + label + ': 이미 ' + value); return; }
  if (DRY) { console.log('   ~ ' + label + ': ' + now + ' → ' + value + ' (시늉만)'); return; }
  try {
    await cf('/zones/' + zoneId + '/settings/' + key, { method: 'PATCH', body: JSON.stringify({ value }) });
    console.log('   ▶ ' + label + ': ' + now + ' → ' + value);
  } catch (e) {
    console.log('   ⚠️ ' + label + ' 실패: ' + e.message);
  }
}

(async () => {
  if (DRY) console.log('※ 시늉 모드 — 아무것도 바꾸지 않습니다\n');

  // ── 1. 토큰 확인 ──────────────────────────────────────────
  const v = await cf('/user/tokens/verify');
  console.log('① 토큰 유효 (' + v.status + ')');

  // ── 2. 영역 확인 / 생성 ───────────────────────────────────
  const zones = await cf('/zones?name=' + encodeURIComponent(DOMAIN));
  let zone = zones[0];

  if (!zone) {
    const accounts = await cf('/accounts');
    if (!accounts.length) throw new Error('계정을 못 찾았습니다. 토큰에 계정 권한이 있는지 확인하세요.');
    const acc = accounts[0];
    console.log('② 영역이 없습니다. 새로 만듭니다 (계정: ' + acc.name + ')');
    if (DRY) { console.log('   (시늉 모드라 만들지 않음)'); return; }
    zone = await cf('/zones', {
      method: 'POST',
      body: JSON.stringify({ name: DOMAIN, account: { id: acc.id }, type: 'full' }),
    });
    console.log('   만들었습니다: ' + zone.id);
  } else {
    console.log('② 영역이 이미 있습니다: ' + zone.id + ' (상태: ' + zone.status + ')');
  }

  // ── 3. DNS 레코드 맞추기 ──────────────────────────────────
  console.log('③ DNS 레코드 확인');
  const want = [
    { type: 'A', name: DOMAIN, content: ORIGIN_IP, proxied: true },
    { type: 'A', name: 'www.' + DOMAIN, content: ORIGIN_IP, proxied: true },
  ];
  const have = await cf('/zones/' + zone.id + '/dns_records?per_page=200');

  for (const w of want) {
    const found = have.find((r) => r.type === w.type && r.name === w.name);
    if (!found) {
      if (DRY) { console.log('   ~ ' + w.name + ' ' + w.type + ' 새로 만들 예정'); continue; }
      await cf('/zones/' + zone.id + '/dns_records', { method: 'POST', body: JSON.stringify({ ...w, ttl: 1 }) });
      console.log('   ▶ ' + w.name + ' ' + w.type + ' → ' + w.content + ' (프록시 켬) 새로 만듦');
    } else if (found.content !== w.content || found.proxied !== w.proxied) {
      if (DRY) { console.log('   ~ ' + w.name + ': ' + found.content + '/프록시' + found.proxied + ' → ' + w.content + '/프록시true'); continue; }
      await cf('/zones/' + zone.id + '/dns_records/' + found.id, {
        method: 'PATCH', body: JSON.stringify({ content: w.content, proxied: w.proxied }),
      });
      console.log('   ▶ ' + w.name + ' 고침: ' + found.content + ' → ' + w.content + ', 프록시 켬');
    } else {
      console.log('   = ' + w.name + ' ' + w.type + ' → ' + found.content + ' (프록시 ' + (found.proxied ? '켜짐' : '꺼짐') + ')');
    }
  }

  const 남은것 = have.filter((r) => !want.some((w) => w.name === r.name && w.type === r.type));
  if (남은것.length) {
    console.log('   그 밖에 이미 있는 레코드 ' + 남은것.length + '건 (건드리지 않음):');
    for (const r of 남은것.slice(0, 10)) console.log('      ' + r.type + '  ' + r.name + '  ' + String(r.content).slice(0, 60));
  }

  // ── 4. 속도·보안 설정 ─────────────────────────────────────
  console.log('④ 설정 맞추기');
  await setSetting(zone.id, 'ssl', 'strict', 'SSL 모드 (Full strict)');
  await setSetting(zone.id, 'always_use_https', 'on', 'HTTPS 강제');
  await setSetting(zone.id, 'min_tls_version', '1.2', '최소 TLS');
  await setSetting(zone.id, 'brotli', 'on', 'Brotli 압축');
  await setSetting(zone.id, 'http3', 'on', 'HTTP/3');
  await setSetting(zone.id, 'zero_rtt', 'on', '0-RTT 재연결');
  await setSetting(zone.id, 'early_hints', 'on', 'Early Hints');

  // ── 5. 네임서버 알려주기 ──────────────────────────────────
  const fresh = await cf('/zones/' + zone.id);
  console.log('\n⑤ 가비아에 넣을 네임서버');
  for (const ns of fresh.name_servers || []) console.log('     ' + ns);
  console.log('\n   지금 네임서버: ' + (fresh.original_name_servers || []).join(', '));
  console.log('   영역 상태: ' + fresh.status + (fresh.status === 'pending' ? '  (네임서버를 바꾸면 active 로 바뀝니다)' : ''));
  console.log('\n네임서버는 사람이 바꿉니다. 이 스크립트는 건드리지 않습니다.');
})().catch((e) => {
  console.error('❌ 실패:', e.message);
  process.exit(1);
});
