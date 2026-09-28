#!/usr/bin/env node
// 빌드 직후 dist/build-info.json 에 커밋·시각·버전을 남긴다 — run-trace manifest 가 "어느 산출물로 돌았나" 를 적을 수 있게.
// 사용: node scripts/write-build-info.js   (npm run build 뒤에)
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repo = path.join(__dirname, '..');
const git = (args) => { try { return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim(); } catch { return ''; } };
const info = {
  commit: git(['rev-parse', 'HEAD']),
  commitShort: git(['rev-parse', '--short', 'HEAD']),
  dirty: git(['status', '--porcelain', '--', 'src', 'electron/main.ts', 'electron/ui']) !== '',
  version: JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8')).version,
  builtAt: new Date().toISOString(),
};
fs.mkdirSync(path.join(repo, 'dist'), { recursive: true });
fs.writeFileSync(path.join(repo, 'dist', 'build-info.json'), JSON.stringify(info, null, 2), 'utf8');
console.log('dist/build-info.json:', JSON.stringify(info));
