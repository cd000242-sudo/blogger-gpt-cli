#!/usr/bin/env node
/**
 * Cloudflare 활성화 감시 — 네임서버는 바뀌었는데 아직 트래픽을 안 받는 구간을 지켜본다.
 *
 * 네임서버 전환과 영역 활성화는 다른 일이다. 전환이 끝나도 Cloudflare 가 소유를
 * 확인해 '활성'으로 바꾸기 전까지는 DNS 만 응답하고 원본 IP 를 그대로 준다
 * (실측 2026-09-04: 프록시가 켜져 있는데도 cf-ray 가 없고 TTFB 2초대 그대로였다).
 *
 * 그래서 두 가지를 함께 본다:
 *   · 권위 서버가 원본 IP 대신 Cloudflare IP 를 주기 시작하는가
 *   · 응답에 cf-ray 가 붙는가 (진짜로 엣지를 거치는 신호)
 *
 * 바뀌는 순간 전후 속도를 같이 찍는다 — 좋아졌는지 숫자로 말하려면 필요하다.
 *
 * 사용: node docs/site-kit/bench/watch-activate.js [분]
 */
const dns = require('dns').promises;

const 도메인 = 'leadernam.com';
const 원본IP = '161.35.46.236';
const 제한분 = Number(process.argv[2] || 120);
const 간격ms = 90 * 1000;

async function 권위IP() {
  try {
    const r = new dns.Resolver();
    const ns = await r.resolve(도메인, 'A');
    return ns;
  } catch {
    return [];
  }
}

async function 재기() {
  const t0 = Date.now();
  try {
    const res = await fetch('https://' + 도메인 + '/?t=' + Date.now(), { redirect: 'follow' });
    await res.arrayBuffer();
    return {
      ms: Date.now() - t0,
      코드: res.status,
      cfRay: res.headers.get('cf-ray') || '',
      서버: res.headers.get('server') || '?',
      압축: res.headers.get('content-encoding') || '',
      altSvc: res.headers.get('alt-svc') || '',
    };
  } catch (e) {
    return { ms: Date.now() - t0, 코드: 0, cfRay: '', 서버: '', 오류: e.message.slice(0, 60) };
  }
}

(async () => {
  const 시작 = Date.now();
  console.log('활성화 감시 시작 — 최대 ' + 제한분 + '분\n');

  while (Date.now() - 시작 < 제한분 * 60 * 1000) {
    const ips = await 권위IP();
    const s = await 재기();
    const 분 = Math.round((Date.now() - 시작) / 60000);
    const 엣지 = ips.length > 0 && !ips.includes(원본IP);

    console.log(
      '[' + String(분).padStart(3) + '분] IP ' + (ips.join(',') || '?').padEnd(18) +
      ' | ' + (s.코드 || 'X') + ' ' + String(s.ms).padStart(5) + 'ms' +
      ' | cf-ray ' + (s.cfRay ? '있음 ✅' : '없음')
    );

    if (s.cfRay || 엣지) {
      console.log('\n🎉 Cloudflare 를 거치기 시작했습니다');
      console.log('   서버: ' + s.서버 + ' / 압축: ' + (s.압축 || '(없음)') + ' / alt-svc: ' + (s.altSvc.slice(0, 50) || '(없음)'));
      console.log('\n다음: node docs/site-kit/bench/harness.js compare after-cls-fix');
      return;
    }

    await new Promise((r) => setTimeout(r, 간격ms));
  }
  console.log('\n제한 시간이 됐습니다. Cloudflare 는 최대 24시간까지 걸릴 수 있습니다 — 다시 돌리면 이어서 봅니다.');
})();
