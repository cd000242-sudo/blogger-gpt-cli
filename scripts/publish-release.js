#!/usr/bin/env node
/**
 * electron-builder가 생성한 Draft 릴리즈를 자동으로 Published(Latest)로 변환
 *
 * electron-builder는 기본적으로 GitHub Release를 Draft로 생성함.
 * Draft 상태는 electron-updater가 감지 못하므로, 이 스크립트가 빌드 후
 * 자동으로 draft=false + latest=true로 변경한다.
 *
 * 사용: npm run release 가 이 스크립트를 빌드 후 자동 실행
 * 필수: gh CLI 로그인 + GH_TOKEN 환경변수
 */

const { execSync } = require('child_process');
const pkg = require('../package.json');

const version = pkg.version;
const tag = `v${version}`;
const publishCfg = Array.isArray(pkg.build?.publish) ? pkg.build.publish[0] : pkg.build?.publish;
const owner = publishCfg?.owner || 'cd000242-sudo';
const repo = publishCfg?.repo || 'blogger-gpt-cli';

console.log(`\n🚀 [publish-release] ${tag} 릴리즈 공개 처리 중...`);

/**
 * v3.8.685 — 릴리스 태그를 **이 커밋**에 찍는다. (2026-09-06 자동 업데이트 사고)
 * 푸시하지 않은 채 릴리스를 만들면 깃허브가 태그를 원격 master(옛 커밋, package.json 3.8.620)에 찍는다.
 * 그 태그를 체크아웃하는 맥 빌드 워크플로(.github/workflows/mac-release.yml)가 3.8.620 을 읽어
 * 5분 뒤 "v3.8.620" 릴리스를 새로 만들었고, 깃허브의 latest 는 마지막에 published 된 것이라 620 이 최신이 됐다.
 * → 설치된 앱(668)이 "내가 더 새 버전" 이라 판단해 자동 업데이트를 멈췄다.
 * 그래서 릴리스를 만지기 전에 master 를 밀어 올리고, gh 로 태그를 만들 땐 HEAD 커밋을 명시한다.
 */
let headSha = '';
try {
  headSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  execSync('git push origin HEAD:master', { stdio: ['ignore', 'pipe', 'pipe'] });
  console.log(`⬆️ [publish-release] master 푸시 완료 (${headSha.slice(0, 7)})`);
} catch (pushErr) {
  console.warn(`⚠️ [publish-release] master 푸시 실패 — 태그가 원격 master 에 찍히면 맥 워크플로가 옛 버전을 낼 수 있습니다: ${String(pushErr?.message || pushErr).slice(0, 120)}`);
}

try {
  // 릴리즈 존재 여부 + draft 상태 확인
  let releaseExists = true;
  let isDraft = false;
  try {
    const info = execSync(
      `gh release view ${tag} --repo ${owner}/${repo} --json isDraft`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    isDraft = JSON.parse(info).isDraft;
  } catch (viewErr) {
    // v3.8.364: release가 존재하지 않는 경우 (GH_TOKEN 없이 electron-builder --publish 실패)
    //   → gh CLI로 직접 release 생성 (gh는 별도 auth 필요 없음, 이미 로그인된 상태 사용)
    releaseExists = false;
    console.log(`⚠️ [publish-release] ${tag} release가 존재하지 않음. gh CLI로 직접 생성 시도...`);
    const path = require('path');
    const fs = require('fs');
    const releaseDir = path.join(__dirname, '..', 'release');
    const requiredFiles = [
      `LEADERNAM-Orbit-${version}.exe`,
      `LEADERNAM-Orbit-${version}.exe.blockmap`,
      'latest.yml',
    ];
    const uploadFiles = requiredFiles
      .map(f => path.join(releaseDir, f))
      .filter(p => fs.existsSync(p));
    if (uploadFiles.length < 3) {
      throw new Error(`release 파일 부족: ${uploadFiles.length}/3 (재빌드 필요: npm run build && electron-builder --win)`);
    }
    const filesArg = uploadFiles.map(p => `"${p}"`).join(' ');
    const targetArg = headSha ? ` --target ${headSha}` : '';
    execSync(
      `gh release create ${tag} ${filesArg} --repo ${owner}/${repo}${targetArg} --title "${version}" --notes "v${version} 자동 업로드 (GH_TOKEN 없이 gh CLI fallback)"`,
      { stdio: 'inherit' }
    );
    console.log(`✅ [publish-release] ${tag} gh CLI로 릴리스 생성 완료 (3개 파일 업로드)`);
  }

  // 항상 draft=false + latest=true로 설정 (멱등)
  execSync(
    `gh release edit ${tag} --repo ${owner}/${repo} --draft=false --latest`,
    { stdio: 'inherit' }
  );
  console.log(`✅ [publish-release] ${tag} → Latest로 공개 완료! ${!releaseExists ? '(gh CLI 신규 생성)' : isDraft ? '(Draft에서 Published로 전환)' : '(이미 Published, Latest 재확인)'}`);

  // 🔧 자동 수정 런처(FIX-AUTO-UPDATE.bat) 동봉 — 단일 파일에 PowerShell 스크립트 포함
  const path = require('path');
  const fs = require('fs');
  const fixFiles = ['FIX-AUTO-UPDATE.bat'];
  const releaseDir = path.join(__dirname, '..', 'release');
  const existingFiles = fixFiles
    .map(f => path.join(releaseDir, f))
    .filter(p => fs.existsSync(p));
  if (existingFiles.length > 0) {
    try {
      const quoted = existingFiles.map(p => `"${p}"`).join(' ');
      execSync(
        `gh release upload ${tag} ${quoted} --repo ${owner}/${repo} --clobber`,
        { stdio: 'inherit' }
      );
      console.log(`✅ [publish-release] 자동 수정 런처 ${existingFiles.length}개 동봉 완료`);
    } catch (fixErr) {
      console.warn(`⚠️ [publish-release] 자동 수정 런처 업로드 실패 (무시): ${fixErr.message}`);
    }
  }

  console.log(`🔗 https://github.com/${owner}/${repo}/releases/tag/${tag}`);
} catch (err) {
  console.error(`❌ [publish-release] 실패: ${err.message}`);
  console.error(`   수동 해결: gh release edit ${tag} --repo ${owner}/${repo} --draft=false --latest`);
  process.exit(1);
}
