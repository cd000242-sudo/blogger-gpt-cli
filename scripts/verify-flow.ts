/**
 * 🌊 Flow (Google Labs Flow — Nano Banana Pro 무료) 엔진 검증 스크립트
 *
 * 전제조건:
 *   - ImageFX Google 로그인 완료 (~/.blogger-gpt/imagefx-profile/ 쿠키 유지)
 *   - Google AI Pro 구독 + labs.google/flow 접근 권한
 *
 * 사용법:
 *   ts-node scripts/verify-flow.ts
 *   ts-node scripts/verify-flow.ts --only=t3
 *   ts-node scripts/verify-flow.ts --only=t2 --keep-cache
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import {
  makeFlowImage,
  testFlowConnection,
} from '../src/core/flowGenerator';

const args = process.argv.slice(2);
const only = (args.find(a => a.startsWith('--only=')) || '').replace('--only=', '').toLowerCase();
const keepCache = args.includes('--keep-cache');

const OUTPUT_DIR = path.resolve(__dirname, '..', 'dry-run-output');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

let pass = 0;
let fail = 0;
let skip = 0;
const failures: string[] = [];

function header(id: string, name: string) {
  console.log(`\n[${id}] ${name}`);
}

function passR(reason: string) {
  console.log(`  ✅ PASS — ${reason}`);
  pass++;
}

function failR(reason: string) {
  console.log(`  ❌ FAIL: ${reason}`);
  failures.push(reason);
  fail++;
}

function skipR(reason: string) {
  console.log(`  ⏭  SKIP: ${reason}`);
  skip++;
}

function shouldRun(id: string): boolean {
  return !only || only === id.toLowerCase();
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout after ${ms / 1000}s (${label})`)), ms)),
  ]);
}

function getFlowCachePath(): string {
  // flowGenerator 내부 getCachePath와 동일 로직 (비-Electron 환경 폴백)
  try {
    const electron = require('electron');
    if (electron?.app?.getPath) {
      return path.join(electron.app.getPath('userData'), 'flow-api-metadata.json');
    }
  } catch { /* non-electron */ }
  return path.join(os.homedir(), '.blogger-gpt', 'flow-api-metadata.json');
}

// ═══════════════════════════════════════════════════
// T1: testFlowConnection
// ═══════════════════════════════════════════════════
async function t1() {
  if (!shouldRun('t1')) return;
  header('T1', 'testFlowConnection — 세션 토큰 획득 + 사용자 확인');
  try {
    const res = await withTimeout(testFlowConnection((m) => console.log(`    ${m}`)), 90000, 'T1');
    if (res.ok) {
      const who = res.userInfo?.email || res.userInfo?.name || 'unknown';
      passR(`토큰 획득, user: ${who}`);
    } else {
      failR(res.message);
    }
  } catch (err: any) {
    failR(`예외: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════
// T2: discoverAndCacheApi (간접 — 캐시 삭제 후 첫 생성)
// ═══════════════════════════════════════════════════
async function t2() {
  if (!shouldRun('t2')) return;
  header('T2', 'discoverAndCacheApi — 캐시 삭제 후 자동 학습');

  if (keepCache) {
    skipR('--keep-cache 플래그 — 캐시 삭제/학습 건너뜀');
    return;
  }

  const cachePath = getFlowCachePath();
  try {
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
      console.log(`    🗑️ 기존 캐시 삭제: ${cachePath}`);
    }
  } catch (err: any) {
    failR(`캐시 삭제 실패: ${err.message}`);
    return;
  }

  // 주의: 이 호출은 실제 생성 + 저장을 트리거함
  try {
    const res = await withTimeout(
      makeFlowImage('a simple blue circle on white background', { aspectRatio: '1:1' }, (m) => console.log(`    ${m}`)),
      90000,
      'T2',
    );
    if (!res.ok) {
      failR(`학습/생성 실패: ${res.error}`);
      return;
    }
    if (!fs.existsSync(cachePath)) {
      failR('캐시 파일이 생성되지 않음');
      return;
    }
    const meta = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    const age = Date.now() - new Date(meta.learnedAt).getTime();
    if (age > 10000) {
      failR(`learnedAt이 10초 이상 오래됨 (age=${age}ms)`);
      return;
    }
    passR(`메타 저장 완료 (${meta.modelNameType}, learnedAt=${meta.learnedAt})`);
  } catch (err: any) {
    failR(`예외: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════
// T3: 단일 이미지 생성
// ═══════════════════════════════════════════════════
async function t3() {
  if (!shouldRun('t3')) return;
  header('T3', 'generateSingleImageWithFlow — 단일 이미지 생성');
  try {
    const res = await withTimeout(
      makeFlowImage('a red apple on a wooden table, photorealistic', { aspectRatio: '1:1' }, (m) => console.log(`    ${m}`)),
      90000,
      'T3',
    );
    if (!res.ok) { failR(res.error || 'unknown'); return; }
    const b64 = res.dataUrl.replace(/^data:[^;]+;base64,/, '');
    const buf = Buffer.from(b64, 'base64');
    const outPath = path.join(OUTPUT_DIR, 'flow-test-1.png');
    fs.writeFileSync(outPath, buf);
    if (buf.length < 5 * 1024) {
      failR(`파일이 5KB 미만 (${buf.length} bytes) — 손상 의심`);
      return;
    }
    passR(`${path.basename(outPath)} 저장 (${Math.round(buf.length / 1024)}KB, 모델: ${res.modelUsed || 'unknown'})`);
  } catch (err: any) {
    failR(`예외: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════
// T4: 쿼터 프로브 (5장 연속)
// ═══════════════════════════════════════════════════
async function t4() {
  if (!shouldRun('t4')) return;
  header('T4', 'Quota probe — 5 generations sequentially');
  const prompts = [
    'a yellow lemon',
    'a green bottle',
    'a wooden chair',
    'a blue sky with clouds',
    'a gray rock on sand',
  ];
  const start = Date.now();
  let quotaHit = -1;
  try {
    for (let i = 0; i < prompts.length; i++) {
      const res = await withTimeout(
        makeFlowImage(prompts[i]!, { aspectRatio: '1:1' }),
        60000,
        `T4-${i + 1}`,
      );
      if (!res.ok) {
        if (res.error?.includes('QUOTA_EXCEEDED') || res.error?.includes('HTTP_429')) {
          console.log(`    Gen ${i + 1}: QUOTA_HIT (429)`);
          quotaHit = i + 1;
          break;
        } else {
          failR(`Gen ${i + 1} 비쿼터 에러: ${res.error}`);
          return;
        }
      } else {
        console.log(`    Gen ${i + 1}: OK (${res.modelUsed || 'unknown'})`);
      }
    }
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    if (quotaHit > 0) {
      passR(`쿼터 경계 감지 at call ${quotaHit}, 총 시간 ${elapsed}s`);
    } else {
      passR(`5장 모두 성공, 평균 ${(Number(elapsed) / 5).toFixed(1)}s/장`);
    }
  } catch (err: any) {
    failR(`예외: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════
// T5: 토큰 만료 후 재획득
// ═══════════════════════════════════════════════════
async function t5() {
  if (!shouldRun('t5')) return;
  header('T5', 'Token refresh — 만료 플래그 후 재획득');
  // flowGenerator의 cachedToken이 모듈 내부 변수라 직접 접근 불가.
  // 대신: 현재 호출 성공 → 짧은 대기 → 다시 호출 성공 여부로 간접 확인.
  // (실제 만료 시뮬레이션은 50분 경과를 기다려야 하므로 생략)
  try {
    const r1 = await withTimeout(makeFlowImage('test A', { aspectRatio: '1:1' }), 60000, 'T5-1');
    if (!r1.ok) { failR(`1차 호출 실패: ${r1.error}`); return; }
    await new Promise(r => setTimeout(r, 500));
    const r2 = await withTimeout(makeFlowImage('test B', { aspectRatio: '1:1' }), 60000, 'T5-2');
    if (!r2.ok) { failR(`2차 호출 실패 (캐시 문제?): ${r2.error}`); return; }
    passR(`연속 2회 성공 (토큰 재사용 정상)`);
  } catch (err: any) {
    failR(`예외: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════
// Runner
// ═══════════════════════════════════════════════════
(async () => {
  console.log('🌊 Flow 엔진 검증 시작\n');
  if (process.env['GEMINI_API_KEY']) {
    console.log('⚠️ GEMINI_API_KEY가 설정되어 있지만, Flow 엔진은 쿠키 인증만 사용합니다. (이 값은 무시됨)');
  }

  try {
    await t1();
    await t2();
    await t3();
    await t4();
    await t5();
  } catch (err: any) {
    console.error(`\n❌ 러너 예외: ${err.message}`);
    fail++;
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Results: ${pass} passed, ${fail} failed, ${skip} skipped`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(`  - ${f}`));
  }
  process.exit(fail > 0 ? 1 : 0);
})();
