/**
 * 🎨 커스텀 프롬프트로 Flow 이미지 1장 생성 — 일회성 테스트
 * 사용: ts-node scripts/gen-flow-custom.ts "프롬프트"
 *       (프롬프트 생략 시 기본값 사용)
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { makeFlowImage } from '../src/core/flowGenerator';

const PROMPT = process.argv[2] || '3차 민생지원금 신청방법';
const OUT_DIR = path.resolve(__dirname, '..', 'dry-run-output');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const TS = new Date().toISOString().replace(/[:.]/g, '-');
const SAFE = PROMPT.replace(/[^a-zA-Z0-9가-힣]+/g, '_').substring(0, 30);
const OUT = path.join(OUT_DIR, `flow-${SAFE}-${TS}.png`);

(async () => {
  console.log(`🎨 Flow 이미지 생성`);
  console.log(`   프롬프트: "${PROMPT}"`);
  console.log(`   출력:     ${OUT}\n`);

  const res = await makeFlowImage(PROMPT, { aspectRatio: '16:9', isThumbnail: true }, (m) => {
    console.log(`   ${m}`);
  });

  if (!res.ok) {
    console.error(`\n❌ 실패: ${res.error}`);
    process.exit(1);
  }
  const b64 = res.dataUrl.replace(/^data:[^;]+;base64,/, '');
  const buf = Buffer.from(b64, 'base64');
  fs.writeFileSync(OUT, buf);
  console.log(`\n✅ 저장: ${OUT} (${Math.round(buf.length / 1024)}KB, 모델: ${res.modelUsed})`);
  process.exit(0);
})();
