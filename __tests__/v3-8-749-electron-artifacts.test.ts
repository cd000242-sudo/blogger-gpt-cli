/**
 * v3.8.749 — 설치본에 옛 updater.js 가 들어가던 문제
 *
 * 사장님: "업데이트하지 못했습니다 — Error invoking remote method 'updater:restart-to-latest':
 *          Error: No handler registered for 'updater:restart-to-latest'"
 *
 * 원인: electron/*.js 는 **커밋되는 산출물**인데 electron 빌드가 증분(tsbuildinfo)이었다.
 *   기록 파일이 "이미 만들었다"고 하면 소스가 바뀌어도 .js 를 다시 쓰지 않는다. 그 사이 git 이 .js 를
 *   커밋본으로 되돌리면 옛 파일이 그대로 포장된다.
 *   · updater.js 는 9/5(v3.8.636) 이후 커밋이 없었다. 9/7~9/8 에 updater.ts 에 넣은 [최신으로 재시작] 핸들러·
 *     조용한 설치(quitAndInstall(true, true))·installDownloadedUpdateNow 가 v3.8.747·748 설치본에 없었다
 *     (748 app.asar 의 updater.js 가 커밋본과 바이트까지 같음 — 실측).
 *   · updater.ts 가 불러오는 updater-attempt.js 는 한 번도 커밋되지 않았다.
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const tsconfig = JSON.parse(read('tsconfig.electron.json'));

function isTracked(relPath: string): boolean {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', relPath], { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe('electron 빌드는 매번 전부 새로 만든다', () => {
  it('증분 빌드를 쓰지 않는다 — 커밋되는 산출물이 기록 파일 때문에 옛것으로 남는다 (전체 컴파일 12초)', () => {
    expect(tsconfig.compilerOptions.incremental).toBe(false);
    expect(tsconfig.compilerOptions.tsBuildInfoFile).toBeUndefined();
  });
});

/** electron 폴더 바로 밑에서 빌드에 들어가는 소스 (include 에 이름이 적힌 것) */
const sources: string[] = tsconfig.include.filter((p: string) => /^electron\/[\w.-]+\.ts$/.test(p));

describe.each(sources)('%s — 커밋된 실행본(.js)이 소스와 맞다', (tsPath) => {
  const ts = read(tsPath);
  const jsPath = tsPath.replace(/\.ts$/, '.js');
  const js = fs.existsSync(path.join(ROOT, jsPath)) ? read(jsPath) : '';

  it('실행본이 저장소에 있다', () => {
    expect(isTracked(jsPath)).toBe(true);
  });

  it('소스가 등록하는 IPC 채널을 실행본도 등록한다 — 없으면 화면 버튼이 "No handler registered" 로 죽는다', () => {
    const channels = [...ts.matchAll(/ipcMain\.handle\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]!);
    expect(channels.filter((c) => !js.includes(`'${c}'`) && !js.includes(`"${c}"`))).toEqual([]);
  });

  it('소스가 내보내는 함수를 실행본도 내보낸다', () => {
    const names = [...ts.matchAll(/^export (?:async )?function (\w+)/gm)].map((m) => m[1]!);
    expect(names.filter((n) => !new RegExp(`exports\\.${n}\\s*=`).test(js))).toEqual([]);
  });

  it('소스가 불러오는 같은 폴더 모듈의 실행본도 저장소에 있다', () => {
    const local = [...ts.matchAll(/from\s+['"]\.\/([\w.-]+)['"]/g)].map((m) => m[1]!);
    // 파일 모듈(./x → x.js) 또는 폴더 모듈(./x → x/index.js)
    expect(local.filter((name) => !isTracked(`electron/${name}.js`) && !isTracked(`electron/${name}/index.js`))).toEqual([]);
  });
});
