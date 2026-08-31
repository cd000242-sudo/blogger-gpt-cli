#!/usr/bin/env node
/**
 * 네임서버 전환 감시 — 바뀌는 순간을 잡고, 바뀐 뒤 사이트가 멀쩡한지 본다.
 *
 * 전파는 몇 분에서 몇 시간까지 걸린다. 그동안 계속 들여다볼 수 없으니
 * 이 스크립트가 대신 본다. 두 가지를 동시에 감시한다:
 *   1) 공개 DNS 가 Cloudflare 네임서버를 가리키기 시작하는가
 *   2) 그 뒤로 사이트가 정상인가 — 특히 무한 리다이렉트(SSL 모드가 Flexible 일 때 난다)
 *
 * 문제를 발견하면 즉시 무엇을 해야 하는지 적고 끝낸다.
 *
 * 사용: node docs/site-kit/bench/watch-switch.js [분]
 */
const dns = require('dns').promises;

const 도메인 = 'leadernam.com';
const 제한분 = Number(process.argv[2] || 90);
const 간격ms = 60 * 1000;
const 공개DNS = { 구글: '8.8.8.8', 클플: '1.1.1.1', KT: '168.126.63.1' };

async function nsOf(server) {
  const r = new dns.Resolver();
  r.setServers([server]);
  try {
    return await r.resolve(도메인, 'NS');
  } catch {
    return [];
  }
}

async function 사이트확인() {
  const t0 = Date.now();
  try {
    const res = await fetch('https://' + 도메인 + '/?t=' + Date.now(), { redirect: 'follow' });
    return {
      코드: res.status,
      ms: Date.now() - t0,
      cf: res.headers.get('cf-ray') ? '있음' : '없음',
      서버: res.headers.get('server') || '?',
      altsvc: res.headers.get('alt-svc') || '',
    };
  } catch (e) {
    return { 코드: 0, ms: Date.now() - t0, 오류: e.message.slice(0, 80) };
  }
}

(async () => {
  const 시작 = Date.now();
  let 전환알림함 = false;
  console.log('감시 시작 — 최대 ' + 제한분 + '분, ' + (간격ms / 1000) + '초 간격\n');

  while (Date.now() - 시작 < 제한분 * 60 * 1000) {
    const 결과 = {};
    for (const [이름, ip] of Object.entries(공개DNS)) {
      const ns = await nsOf(ip);
      결과[이름] = ns.some((n) => /cloudflare/i.test(n));
    }
    const 바뀐곳 = Object.entries(결과).filter(([, v]) => v).map(([k]) => k);
    const site = await 사이트확인();
    const 분 = Math.round((Date.now() - 시작) / 60000);

    console.log(
      '[' + String(분).padStart(3) + '분] Cloudflare 가리킴: ' +
      (바뀐곳.length ? 바뀐곳.join(',') : '아직 없음').padEnd(16) +
      ' | 사이트 ' + site.코드 + ' (' + site.ms + 'ms) cf-ray:' + (site.cf || '-')
    );

    if (site.코드 === 0) {
      console.log('   ⚠️ 사이트에 접속이 안 됩니다: ' + site.오류);
    } else if (site.코드 >= 500 || site.코드 === 525 || site.코드 === 526) {
      console.log('   ❌ 원본 연결 오류(' + site.코드 + ') — Cloudflare SSL 모드를 Full(strict) 로 바꿔야 합니다');
    }

    if (바뀐곳.length && !전환알림함) {
      전환알림함 = true;
      console.log('\n🎉 전환됐습니다 (' + 바뀐곳.join(', ') + ')');
      console.log('   서버: ' + site.서버 + ' / cf-ray: ' + site.cf + ' / alt-svc: ' + (site.altsvc.slice(0, 60) || '(없음)'));
    }

    if (바뀐곳.length === Object.keys(공개DNS).length) {
      console.log('\n✅ 공개 DNS 전부 전환 완료 — 감시를 끝냅니다.');
      return;
    }

    await new Promise((r) => setTimeout(r, 간격ms));
  }
  console.log('\n제한 시간이 됐습니다. 아직 전파 중일 수 있습니다 — 다시 돌리면 이어서 봅니다.');
})();

