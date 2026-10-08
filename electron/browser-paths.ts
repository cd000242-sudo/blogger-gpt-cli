import * as fs from 'fs';
import * as path from 'path';

/**
 * 🧭 v3.8.756 — 퍼피티어(Puppeteer)가 쓸 브라우저를 **PC 에 이미 있는 Chrome·Edge** 로 정한다.
 *
 * 실측(2026-10-08): src 의 크롤러들(URL 이미지 자동 수집 · URL 모드 상품 수집 · 검색 결과 본문 읽기)은
 *   `puppeteer.launch()` 를 경로 없이 부른다. 퍼피티어는 그러면 자기 전용 크롬(~/.cache/puppeteer)을 찾는데,
 *   그건 개발 PC 에서 패키지를 깔 때만 생기고 고객 PC 엔 없다. 개발 PC 에서도 버전이 안 맞아
 *   "Could not find Chrome" 으로 실패했다. 같은 호출에 Edge 경로를 주면 정상 실행됨을 확인했다.
 *
 * 퍼피티어는 처음 불러올 때 PUPPETEER_EXECUTABLE_PATH 를 읽는다. 그래서 main.ts **맨 위**에서 부른다.
 * 사용자가 이미 정해 둔 값이 있고 그 파일이 있으면 건드리지 않는다.
 */

type Env = Record<string, string | undefined>;

export function systemBrowserCandidates(env: Env, platform: string): string[] {
  if (platform === 'win32') {
    const programFiles = env['PROGRAMFILES'] || 'C:\\Program Files';
    const programFilesX86 = env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    const localAppData = env['LOCALAPPDATA'] || '';
    return [
      path.win32.join(programFiles, 'Google\\Chrome\\Application\\chrome.exe'),
      path.win32.join(programFilesX86, 'Google\\Chrome\\Application\\chrome.exe'),
      localAppData ? path.win32.join(localAppData, 'Google\\Chrome\\Application\\chrome.exe') : '',
      path.win32.join(programFiles, 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.win32.join(programFilesX86, 'Microsoft\\Edge\\Application\\msedge.exe'),
    ].filter(Boolean);
  }
  if (platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ];
  }
  return [];
}

export function installPuppeteerBrowserPath(
  env: Env = process.env,
  platform: string = process.platform,
  exists: (p: string) => boolean = (p) => { try { return fs.existsSync(p); } catch { return false; } },
): string | undefined {
  const current = env['PUPPETEER_EXECUTABLE_PATH'];
  if (current && exists(current)) return current;
  const found = systemBrowserCandidates(env, platform).find(exists);
  if (found) env['PUPPETEER_EXECUTABLE_PATH'] = found;
  return found;
}
