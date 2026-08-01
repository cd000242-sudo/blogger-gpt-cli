#!/usr/bin/env node
/**
 * 릴리스 후 leaderspro.kr 다운로드 링크를 새 버전으로 자동 갱신 (v3.8.399)
 *
 * 왜: 사이트가 v3.8.221 을 가리키고 있었다(실측 2026-08-01). 실제 최신은 v3.8.398 —
 *   177 버전 뒤처졌다. 매 릴리스마다 사람이 관리자 페이지에 들어가 고쳐야 했기 때문이다.
 *
 * 왜 파일 업로드가 아니라 URL 갱신인가:
 *   사용자 확인 — "무료체험이 가능해서 상관없어요. 비밀번호는 무료체험 버튼 클릭하면 노출됩니다."
 *   즉 다운로드 비밀번호는 실질적 접근 제어가 아니다. GitHub 릴리스(공개)를 그대로 가리키면
 *   120MB 업로드 없이 1초에 끝난다.
 *
 * 동작
 *   1) GAS 에서 현재 사이트 콘텐츠를 통째로 받는다
 *   2) downloads.orbit 의 version / windows.detail / windows.url 만 바꾼다
 *   3) 전체 객체를 되돌려 저장한다 (다른 설정을 건드리지 않기 위해 merge 가 아니라 원본 수정)
 *   4) 다시 읽어 실제로 반영됐는지 확인한다
 *
 * 안전
 *   · 실패해도 릴리스를 되돌리지 않는다 (GitHub 릴리스는 이미 성공한 뒤에 도는 단계다)
 *   · 토큰을 로그에 찍지 않는다
 *   · --dry 로 무엇이 바뀔지만 볼 수 있다
 *
 * 사용
 *   node scripts/sync-site-download.js         실제 갱신
 *   node scripts/sync-site-download.js --dry   미리보기
 */
const pkg = require('../package.json');

const DRY = process.argv.includes('--dry');
const version = pkg.version;
const tag = `v${version}`;
const publishCfg = Array.isArray(pkg.build?.publish) ? pkg.build.publish[0] : pkg.build?.publish;
const owner = publishCfg?.owner || 'cd000242-sudo';
const repo = publishCfg?.repo || 'blogger-gpt-cli';

const GAS_URL = process.env.LEADERSPRO_GAS_URL
  || 'https://script.google.com/macros/s/AKfycbxBOGkjVj4p-6XZ4SEFYKhW3FBmo5gt7Fv6djWhB1TljnDDmx_qlfZ4YdlJNohzIZ8NJw/exec';

/** 제품 키 — 관리자 EDITOR_PRODUCT_DEFS 기준 (naver / leword / orbit) */
const PRODUCT_ID = 'orbit';
const CHOICE = 'windows';
const EXE_NAME = `LEADERNAM-Orbit-${version}.exe`;
const DOWNLOAD_URL = `https://github.com/${owner}/${repo}/releases/download/${tag}/${EXE_NAME}`;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0';

/**
 * 관리자 토큰을 얻는다 — **환경변수에서만** 읽는다.
 *
 * ⚠️ 관리자 페이지(leaderspro.kr/admin)에 ADMIN_TOKEN 이 평문으로 박혀 있지만
 *   실측(2026-08-01) 결과 그 값은 GAS 가 거부한다:
 *     site-content-save  → {"ok":false,"error":"Unauthorized"}
 *     get-reviews-admin  → {"ok":false,"error":"Unauthorized"}   (같은 토큰, 다른 액션)
 *   즉 옛 값이거나 미끼다. 자동으로 긁어 쓰면 매번 조용히 실패하므로 쓰지 않는다.
 *
 * .env 에 넣어주세요:
 *   LEADERSPRO_ADMIN_TOKEN=<GAS 가 인정하는 실제 토큰>
 */
function resolveAdminToken() {
  const fromEnv = process.env.LEADERSPRO_ADMIN_TOKEN
    || readEnvFile('LEADERSPRO_ADMIN_TOKEN');
  return fromEnv ? { token: fromEnv, source: 'env' } : { token: '', source: 'none' };
}

/** 앱이 쓰는 사용자 데이터 .env 에서 키를 읽는다 (앱과 같은 위치를 본다) */
function readEnvFile(key) {
  try {
    const fs = require('fs');
    const path = require('path');
    const base = process.env.APPDATA || process.env.HOME || '';
    const file = path.join(base, 'blogger-gpt-cli', '.env');
    if (!fs.existsSync(file)) return '';
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
      if (m && m[1] === key) return m[2].replace(/^["']|["']$/g, '').trim();
    }
  } catch { /* noop */ }
  return '';
}

/**
 * Apps Script 는 콜드 스타트 때 수십 초가 걸린다(실측: 30초 타임아웃으로 실패).
 * 넉넉히 잡고 몇 번 재시도한다.
 */
async function withRetry(label, fn, attempts = 3) {
  let lastErr;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts) {
        console.log(`   ↻ ${label} 재시도 ${i}/${attempts - 1} (${String(e?.message || e).slice(0, 50)})`);
        await new Promise(r => setTimeout(r, 2000 * i));
      }
    }
  }
  throw lastErr;
}

async function gasGet() {
  return withRetry('조회', async () => {
    const res = await fetch(`${GAS_URL}?action=site-content&ts=${Date.now()}`, {
      headers: { 'User-Agent': UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) throw new Error(`콘텐츠 조회 실패 HTTP ${res.status}`);
    const json = await res.json();
    if (!(json.ok || json.success) || !json.content) throw new Error('콘텐츠 응답 형식이 예상과 다릅니다');
    return json.content;
  });
}

async function gasSave(content, adminToken) {
  return withRetry('저장', async () => {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8', 'User-Agent': UA },
      body: JSON.stringify({ action: 'site-content-save', adminToken, content }),
      redirect: 'follow',
      signal: AbortSignal.timeout(120000),
    });
    const json = await res.json().catch(() => ({}));
    if (!(json.ok || json.success)) {
      // 인증 실패는 재시도해도 소용없다 — 바로 알린다
      const msg = json.error || json.message || `저장 실패 HTTP ${res.status}`;
      if (/unauthorized/i.test(msg)) throw new Error(`${msg} (LEADERSPRO_ADMIN_TOKEN 확인 필요)`);
      throw new Error(msg);
    }
    return json;
  });
}

async function main() {
  console.log(`\n🔗 [sync-site] leaderspro.kr 다운로드 링크 → ${tag}${DRY ? ' (dry-run)' : ''}`);

  const content = await gasGet();
  const product = content?.downloads?.[PRODUCT_ID];
  if (!product) throw new Error(`downloads.${PRODUCT_ID} 를 찾지 못했습니다`);

  const before = {
    version: product.version || '',
    detail: product.downloads?.[CHOICE]?.detail || '',
    url: product.downloads?.[CHOICE]?.url || '',
  };

  if (before.url === DOWNLOAD_URL) {
    console.log(`   ✅ 이미 최신입니다 (${version}) — 변경 없음`);
    return;
  }

  // 기존 표기 형식을 유지하며 버전만 교체한다
  //   version 예: "블로그스팟·워드프레스 자동화 · v3.8.221"
  //   detail  예: "3.8.221 · exe"
  const nextVersionLabel = before.version.includes('v')
    ? before.version.replace(/v\d+\.\d+\.\d+/, tag)
    : `${before.version} · ${tag}`.trim();
  const nextDetail = before.detail.includes('·')
    ? before.detail.replace(/\d+\.\d+\.\d+/, version)
    : `${version} · exe`;

  console.log(`   version : ${before.version}`);
  console.log(`           → ${nextVersionLabel}`);
  console.log(`   detail  : ${before.detail}  →  ${nextDetail}`);
  console.log(`   url     : ${before.url.slice(0, 78)}`);
  console.log(`           → ${DOWNLOAD_URL.slice(0, 78)}`);

  if (DRY) {
    console.log('   (dry-run — 저장하지 않음)');
    return;
  }

  const { token } = resolveAdminToken();
  if (!token) {
    console.warn('   ⏭️ LEADERSPRO_ADMIN_TOKEN 미설정 — 링크 갱신을 건너뜁니다.');
    console.warn('      %APPDATA%\\blogger-gpt-cli\\.env 에 한 줄 추가하면 자동으로 동작합니다:');
    console.warn('      LEADERSPRO_ADMIN_TOKEN=<GAS 관리자 토큰>');
    return;
  }

  // 원본 객체를 그대로 두고 필요한 필드만 교체 — 다른 사이트 설정을 건드리지 않는다
  product.version = nextVersionLabel;
  product.downloads = product.downloads || {};
  product.downloads[CHOICE] = {
    ...(product.downloads[CHOICE] || {}),
    label: product.downloads[CHOICE]?.label || 'Windows',
    detail: nextDetail,
    url: DOWNLOAD_URL,
  };
  content.updatedAt = new Date().toISOString();

  await gasSave(content, token);
  console.log('   💾 저장 완료 — 반영 확인 중...');

  // 실제로 반영됐는지 다시 읽어 확인한다 (저장 성공 응답만 믿지 않는다)
  const verify = await gasGet();
  const savedUrl = verify?.downloads?.[PRODUCT_ID]?.downloads?.[CHOICE]?.url || '';
  if (savedUrl === DOWNLOAD_URL) {
    console.log(`   ✅ 반영 확인 — 사이트가 ${tag} 를 가리킵니다`);
  } else {
    console.warn(`   ⚠️ 저장은 됐는데 조회 결과가 다릅니다: ${savedUrl.slice(0, 70)}`);
  }
}

main().catch((e) => {
  // 릴리스는 이미 성공한 뒤다 — 이 단계 실패가 릴리스를 되돌리면 안 된다
  console.warn(`🔗 [sync-site] 갱신 실패(릴리스는 정상): ${e?.message || e}`);
  console.warn('   관리자 페이지에서 수동으로 링크를 바꾸시면 됩니다.');
});
