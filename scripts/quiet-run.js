/**
 * 낮은 우선순위로 명령을 실행한다 (v3.8.454)
 *
 * 사용자 보고: "게이트 백그라운드 돌려서 릴리스까지할때 보니까 평균 20분~30분
 * 정도 소요되는것같은데 그시간동안 노트북이 엄청느려져서 아무것도 못하네"
 *
 * 원리: 이 프로세스의 우선순위를 BELOW_NORMAL 로 낮추면 Windows 가 자식
 * 프로세스(npm → tsc → electron-builder → jest 워커 전부)에 그대로 물려준다.
 * 낮은 우선순위 작업은 **다른 프로그램이 CPU 를 쓰지 않을 때만** 코어를 받으므로,
 * 사용자가 브라우저·문서작업을 하는 동안 게이트/빌드가 양보한다.
 * 머신이 놀고 있으면 전체 소요 시간은 거의 그대로다 — 손해가 없는 트레이드다.
 *
 * 사용: node scripts/quiet-run.js <명령> [인자...]
 *   예: node scripts/quiet-run.js npm run release:work
 */
const os = require('os');
const { spawn } = require('child_process');

try {
  os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL);
  console.log('[quiet-run] 우선순위 BELOW_NORMAL — 다른 작업에 CPU를 양보하며 실행합니다');
} catch (e) {
  console.warn(`[quiet-run] 우선순위 조정 실패(그냥 진행): ${e && e.message}`);
}

const argv = process.argv.slice(2);
if (argv.length === 0) {
  console.error('사용법: node scripts/quiet-run.js <명령> [인자...]');
  process.exit(2);
}

// shell:true — npm/npx 같은 .cmd 셔틀과 인자를 Windows 에서 그대로 실행하기 위해
const child = spawn(argv.join(' '), { stdio: 'inherit', shell: true });
child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`[quiet-run] 신호로 종료: ${signal}`);
    process.exit(1);
  }
  process.exit(code == null ? 1 : code);
});
child.on('error', (err) => {
  console.error(`[quiet-run] 실행 실패: ${err.message}`);
  process.exit(1);
});
