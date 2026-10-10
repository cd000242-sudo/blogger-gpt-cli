/**
 * v3.8.760 — 젠스파크 정밀 리서치 배선 검사.
 * 이 저장소의 단골 사고: 없는 id 를 읽거나 백엔드에 안 이어진 값은 오류 없이 조용히 무시된다(7회 재발).
 * 그래서 화면 id 실존 → 단일·대기열·예약 payload → 일반 경로·에이전트 경로 → 설치본 require 경로까지 한 줄씩 본다.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
const html = read('electron/ui/index.html');
const script = read('electron/ui/script.js');
const posting = read('electron/ui/modules/posting.js');
const queue = read('electron/ui/modules/publish-queue.js');
const orchestration = read('src/core/final/orchestration.ts');
const mainTs = read('electron/main.ts');

describe('화면', () => {
  test('⭐ 켜기 체크박스 · 로그인 버튼 · 상태 칸이 실제로 있다', () => {
    expect(html).toContain('id="gensparkResearch"');
    expect(html).toContain('id="gensparkLoginBtn"');
    expect(html).toContain('id="gensparkCheckBtn"');
    expect(html).toContain('id="gensparkStatus"');
  });

  test('버튼이 메인 프로그램 통로를 부르고, 켜기 값은 다시 켜도 유지된다', () => {
    expect(script).toContain("invoke?.('genspark:login'");
    expect(script).toContain("invoke?.('genspark:check-login'");
    expect(script).toContain('leadernamGensparkResearch');
  });
});

describe('발행 데이터(payload) 3경로', () => {
  test('⭐ 단일 발행이 체크박스 값을 싣는다', () => {
    expect(posting).toContain("gensparkResearch: !!document.getElementById('gensparkResearch')?.checked");
  });

  test('⭐ 대기열·예약: 화면 → 항목 → 백엔드 payload 까지 이어진다', () => {
    expect(queue).toContain("gensparkResearch: !!document.getElementById('gensparkResearch')?.checked");
    expect(queue).toContain('gensparkResearch: !!snap.gensparkResearch');
    expect(queue).toContain('item.gensparkResearch = snap.gensparkResearch');
    expect(queue).toContain('gensparkResearch: !!item.gensparkResearch');
    expect((queue.match(/gensparkResearch: snapshot\.gensparkResearch/g) || []).length).toBe(2);
  });
});

describe('백엔드', () => {
  test('⭐ 일반 경로: payload 가 켜졌을 때만 젠스파크 근거를 후보에 넣는다', () => {
    expect(orchestration).toContain('(payload as any).gensparkResearch === true');
    expect(orchestration).toContain("require('../genspark/genspark-research')");
    expect(orchestration).toContain('evidenceCandidates.push(...gs.items)');
  });

  test('⭐ 에이전트 경로도 같은 함수로 근거를 붙인다(일반 경로를 안 거치므로 따로)', () => {
    expect(mainTs).toContain("require('../dist/core/genspark/genspark-research')");
    expect(mainTs).toContain('renderGensparkEvidenceBlock(');
    expect(mainTs).toContain('(request?.payload as any)?.gensparkResearch === true');
  });

  test('로그인 통로 2개 · 설치본에서 살아 있는 dist 경로', () => {
    expect(mainTs).toContain("ipcMain.handle('genspark:login'");
    expect(mainTs).toContain("ipcMain.handle('genspark:check-login'");
    expect(mainTs).toContain("require('../dist/core/genspark/genspark-client')");
    expect(mainTs).not.toContain("require('../src/core/genspark/");
  });
});
