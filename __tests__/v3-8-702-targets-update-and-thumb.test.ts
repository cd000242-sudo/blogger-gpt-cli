/**
 * v3.8.702 — ① 7건 골랐는데 1구간만 고침 ② 업데이트 중복 설치 ③ 티스토리 목록 썸네일
 *
 * 사장님:
 *   "지적이 7개라서 7건 모두수정 발행버튼눌렀으면 전부 수정해야되는거아니니?
 *    1개구간만 수정했다뜨고 그대로인데?"
 *   "여전히 다시안뜨고 키면 버튼두개가뜨거든 재시작하기랑 계속하기 … 둘중하나만해줄래??
 *    그게 안먹히면 버튼두개를 띄우라고"
 *   "생성된 글목록에서 티스토리는 왜 글에 썸네일이미지가 안떠있고"
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const draft = read('src/core/final/editor-draft.ts');
const updater = read('electron/updater.ts');
const tistoryPosts = read('src/tistory/tistory-posts.ts');

describe('① "글 전체" 지적이 본문 전체에 닿는다', () => {
  const fn = blockBetween(draft, 'const MAX_TARGETS = 6', 'const plain = (v: string)');

  test('⭐ 구간 지정 지적만 대상으로 삼던 옛 규칙이 사라졌다', () => {
    // 옛 코드: bySection.size > 0 ? [...bySection.keys()] : (짧은 구간 2개)
    // → 7건 중 1건만 구간 지정이면 대상이 1개뿐이었다
    expect(draft).not.toContain('const targets: number[] = bySection.size > 0');
  });

  test('⭐ 근거 문장이 있는 구간을 찾아 함께 대상에 넣는다', () => {
    expect(fn).toContain('evidenceHits');
    expect(fn).toContain('stripText(section.html).includes(evidence)');
    expect(fn).toContain('[...new Set([...bySection.keys(), ...fromEvidence])]');
  });

  test('⭐ 너무 짧은 근거로는 아무 구간에나 걸지 않는다', () => {
    expect(fn).toContain('if (evidence.length < 12) continue;');
  });

  test('⭐ 비용 상한이 있다 — 구간마다 모델을 부른다', () => {
    expect(fn).toContain('const MAX_TARGETS = 6');
    expect(fn).toContain('targets.length > MAX_TARGETS');
  });

  test('⭐ 상한에 걸리면 구간 지정 지적을 먼저 지킨다', () => {
    expect(fn).toContain('const named = [...bySection.keys()]');
    expect(fn).toContain('[...new Set([...named, ...rest])].slice(0, MAX_TARGETS)');
  });

  test('아무것도 못 찾으면 예전 폴백을 쓴다 (빈손으로 끝내지 않는다)', () => {
    expect(fn).toContain('if (targets.length === 0)');
  });

  test('⭐ 몇 건을 몇 구간으로 고치는지 화면에 말한다 — 어긋나면 바로 보이게', () => {
    expect(fn).toContain('건 → 손볼 구간');
  });
});

describe('② 업데이트 — 설치는 한 번, 안 되면 묻는다', () => {
  test('⭐ 자동 설치를 끈다 — 설치가 두 번 일어나고 있었다', () => {
    // 실측: 설치본이 3.8.701 인데 lba-updater/pending 에 3.8.701 설치기가 남아 있었다
    expect(updater).toContain('updater.autoInstallOnAppQuit = false;');
    expect(updater).not.toContain('updater.autoInstallOnAppQuit = true;');
  });

  // v3.8.707: 설치는 installDownloadedUpdateNow, 묻기는 askThenInstall 로 각각 한 곳에 모였다
  const install = blockBetween(updater, 'export function installDownloadedUpdateNow(', 'async function askThenInstall(');
  const ask = blockBetween(updater, 'async function askThenInstall(', '/** 초기화 (앱 시작 시 호출) */');

  test('⭐ 기본은 조용한 설치 하나다', () => {
    const auto = blockBetween(updater, "updater.on('update-downloaded'", "updater.on('error'");
    expect(auto).toContain("installDownloadedUpdateNow('다운로드 완료 2초 뒤')");
    expect(install).toContain('quitAndInstall(true, true)');
    expect(install).toContain('scheduleRelaunchWatchdog()');
  });

  test('⭐ 안 먹히면 마법사를 몰래 띄우지 않고 버튼 두 개로 묻는다', () => {
    expect(ask).toContain("buttons: ['지금 재시작', '나중에']");
    expect(ask).toContain('dialog.showMessageBox');
  });

  test('⭐ "나중에" 를 고르면 하던 일을 계속한다', () => {
    expect(ask).toContain('if (answer.response !== 0)');
    expect(ask).toContain('isUpdateInProgress = false;');
  });

  test('조용한 설치가 성공하면 그 창은 뜨지 않는다 (그 전에 앱이 종료된다)', () => {
    const auto = blockBetween(updater, "updater.on('update-downloaded'", "updater.on('error'");
    const first = auto.indexOf("installDownloadedUpdateNow('다운로드 완료 2초 뒤')");
    expect(first).toBeGreaterThan(-1);
    expect(auto.indexOf('askThenInstall(', first)).toBeGreaterThan(first);
    expect(auto).toContain('}, 8000);');
  });
});

describe('③ 티스토리 목록 썸네일 — 배경 이미지도 본다', () => {
  const fn = blockBetween(tistoryPosts, 'const images = Array.from(row.querySelectorAll', '// 글 행의 최소 증거');

  test('⭐ <img> 로 못 찾으면 배경 이미지를 찾는다', () => {
    expect(fn).toContain('if (!thumb) {');
    expect(fn).toContain('backgroundImage');
    expect(fn).toContain('url(');
  });

  test('⭐ 자리표시자는 거른다 (1x1 data: · about:blank)', () => {
    expect(fn).toContain('/^data:/i.test(url)');
    expect(fn).toContain('about:blank');
  });

  test('프로토콜 생략 주소를 살린다', () => {
    expect(fn).toContain("url.slice(0, 2) === '//'");
  });

  test('찾은 값은 예전 경로 그대로 목록에 실린다 (v3.8.708 부터는 글 페이지 og:image 가 우선)', () => {
    expect(tistoryPosts).toContain('imageUrl: entryThumbnails[post.id] || post.thumb');
  });
});
