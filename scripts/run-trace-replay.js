#!/usr/bin/env node
// 🔁 run 폴더 하나를 시간선으로 편다 — 네트워크·LLM 호출 0. dist 가 낡아도 되게 src 를 ts-node 로 읽는다.
// 사용: node scripts/run-trace-replay.js <run 폴더 또는 runId>   (runId 만 주면 RUN_TRACE_DIR 또는 기본 위치에서 찾는다)
const path = require('path');
const fs = require('fs');

const REPO = path.join(__dirname, '..');
require(path.join(REPO, 'node_modules/ts-node')).register({ transpileOnly: true, compilerOptions: { module: 'commonjs' } });
const { replayRun } = require(path.join(REPO, 'src/core/final/run-trace-replay.ts'));
const { traceRootDir } = require(path.join(REPO, 'src/core/final/run-trace.ts'));

const arg = process.argv[2];
if (!arg) {
  console.error('사용: node scripts/run-trace-replay.js <run 폴더 또는 runId>');
  process.exit(2);
}
const dir = fs.existsSync(arg) ? arg : path.join(traceRootDir(), arg);
if (!fs.existsSync(path.join(dir, 'manifest.json'))) {
  console.error(`manifest.json 이 없습니다: ${dir}`);
  process.exit(1);
}
console.log(replayRun(dir).text);
