/**
 * 작업 중지 (v3.8.414)
 *
 * 사용자 보고(2026-08-02): "작업중지 버튼 눌렀는데 중지가 안 돼요"
 *
 * 원인 — 취소 기능이 **아예 없었다.**
 *   preload.js 는 cancel-task 를 보내고, 화면은 "🛑 작업 중지 요청을 보냈습니다"
 *   알림까지 띄우고 모달을 닫는다. 그런데 main 프로세스에 그 메시지를 받는
 *   ipcMain.on('cancel-task') 가 **어디에도 없었다.** 메시지가 허공으로 갔다.
 *   백엔드는 209초짜리 파이프라인을 끝까지 돌았고, 사용자는 "껐는데 왜 계속 돌지?"를 겪었다.
 *
 * ⚠️ 이 프로젝트에서 '있는 줄 알았는데 배선이 없던' 다섯 번째 사고다.
 *    (generateBtn · thumbnailMode · semiAutoContentMode · 검색자 질문 신호 · cancel-task)
 *    그래서 이 테스트는 **배선 자체**를 가장 강하게 검증한다.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  beginRun, requestCancel, isCanceled, endRun, throwIfCanceled, isCancellation, CanceledError,
} from '../src/core/cancel-token';
import { braceBlock, blockBetween } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const mainTs = read('electron', 'main.ts');
const preload = read('electron', 'preload.js');
const orch = read('src', 'core', 'final', 'orchestration.ts');

describe('중지 표시', () => {
  beforeEach(() => endRun());

  it('⭐ 중지를 누르면 진행 중인 작업이 멈춘다', () => {
    beginRun();
    expect(isCanceled()).toBe(false);
    expect(requestCancel()).toBe(true);
    expect(isCanceled()).toBe(true);
    expect(() => throwIfCanceled('본문 생성 전')).toThrow(CanceledError);
  });

  it('⭐ 어디서 멈췄는지 알려준다', () => {
    beginRun();
    requestCancel();
    expect(() => throwIfCanceled('이미지 생성 전')).toThrow(/이미지 생성 전/);
  });

  it('⭐ 도는 작업이 없으면 중지 요청을 무시한다', () => {
    // 안 그러면 "미리 눌러두면 다음 작업도 안 돈다"가 된다
    expect(requestCancel()).toBe(false);
    expect(isCanceled()).toBe(false);
  });

  it('⭐ 늦게 도착한 취소가 새 작업을 죽이지 않는다', () => {
    beginRun();
    requestCancel();
    endRun();
    beginRun();                       // 사용자가 다시 발행을 눌렀다
    expect(isCanceled()).toBe(false);
    expect(() => throwIfCanceled('제목 생성 전')).not.toThrow();
  });

  it('두 번 눌러도 한 번만 접수된다', () => {
    beginRun();
    expect(requestCancel()).toBe(true);
    expect(requestCancel()).toBe(false);
  });

  it('⭐ 일반 오류를 중지로 착각하지 않는다', () => {
    expect(isCancellation(new Error('네트워크 실패'))).toBe(false);
    expect(isCancellation(null)).toBe(false);
    expect(isCancellation(undefined)).toBe(false);
    expect(isCancellation(new CanceledError('어딘가'))).toBe(true);
  });

  it('작업이 끝나면 표시가 지워진다', () => {
    beginRun();
    requestCancel();
    endRun();
    expect(isCanceled()).toBe(false);
  });
});

describe('배선 — 보내는 쪽과 받는 쪽이 맞는가', () => {
  it('⭐ preload 가 보내는 채널을 main 이 받는다 (이번 사고의 핵심)', () => {
    expect(preload).toContain("ipcRenderer.send('cancel-task')");
    expect(mainTs).toContain("ipcMain.on('cancel-task'");
  });

  it('⭐ invoke 로 부르는 경로도 받는다 — 한쪽만 달면 또 새어나간다', () => {
    // posting.js 는 invoke('cancel-task') 를 쓴다. send 만 받으면 그 경로가 조용히 실패한다.
    expect(read('electron', 'ui', 'modules', 'posting.js')).toContain("invoke('cancel-task')");
    expect(mainTs).toContain("ipcMain.handle('cancel-task'");
  });

  it('⭐ 발행 시작 시 이전 중지 표시를 지운다', () => {
    expect(mainTs).toContain("require('../dist/core/cancel-token').beginRun()");
  });

  it('⭐ 끝나면 반드시 표시를 지운다 (finally)', () => {
    expect(mainTs).toContain("require('../dist/core/cancel-token').endRun()");
    expect(mainTs).toContain('한 번 중지하면 다음 작업도 바로 멈춘다');
  });

  it('⭐ 중지를 실패로 보고하지 않는다', () => {
    expect(mainTs).toContain('canceled: true');
    expect(mainTs).toContain('작업을 중지했습니다. 발행하지 않았습니다.');
  });
});

describe('오케스트레이션이 실제로 멈춘다', () => {
  it('⭐ 오래 걸리는 단계마다 확인한다', () => {
    ['제목 생성 전', '본문 생성 전', '이미지 생성 전', '발행 직전'].forEach((where) => {
      expect(orch).toContain(`checkCanceled('${where}')`);
    });
  });

  it('⭐ 이미지는 장마다 확인한다 — 8장에 102초가 걸린다', () => {
    expect(orch).toContain('중지 요청 — 이미지 생성을 건너뜁니다');
  });

  it('⭐ 이미지 루프 안에서는 던지지 않는다 (큐의 오류 처리와 엉킨다)', () => {
    expect(orch).toContain("return { dataUrl: '', source: '중지됨' };");
  });

  it('⭐ 발행 직전에 마지막으로 본다 — 중지했는데 글이 올라가면 안 된다', () => {
    const publishAt = orch.indexOf("checkCanceled('발행 직전')");
    const doneAt = orch.indexOf('✅ 콘텐츠 생성 완료!');
    expect(publishAt).toBeGreaterThan(-1);
    expect(publishAt).toBeLessThan(doneAt);
  });

  it('⭐ 중지 기능이 고장나도 발행은 계속된다', () => {
    // 멈추는 기능이 발행을 막으면 그게 더 큰 사고다
    expect(braceBlock(orch, 'const checkCanceled =')).toContain('if (e?.canceled) throw e');
  });
});

/**
 * 시작할 때 지난 선택이 화면에 올라온다 (v3.8.414)
 *
 * 사용자 보고: "텍스트 엔진 선택이 왜 마지막에 선택한 모델이
 *              환경설정을 클릭해서 띄워야만 자동으로 선택되나요??"
 *
 * 복원 코드가 loadSettingsContent() 안에만 있었다 — 그 함수는 **환경설정 패널을 열 때만** 돈다.
 * 앱을 켜고 바로 발행하면 라디오가 HTML 기본값(gemini-2.5-flash)인 채로 나간다.
 * 화면에는 그렇게 보이는데 사용자는 지난번에 고른 모델일 거라 믿는다.
 * v3.8.411 의 소제목 이미지 엔진과 같은 유형이다.
 */
describe('글 생성 엔진이 시작할 때 복원된다', () => {
  const settingsSrc = read('electron', 'ui', 'modules', 'settings.js');
  const mainJs = read('electron', 'ui', 'modules', 'main.js');

  /** 실제 복원 함수를 떼어 브라우저를 세우고 돌린다 */
  const run = (saved: string, options: string[]) => {
    const body = braceBlock(settingsSrc, 'export function applyTextModelRadio')
      .replace('export function', 'function');
    const radios = options.map((value) => ({ value, checked: false }));
    const doc = { querySelectorAll: () => radios };
    // eslint-disable-next-line no-new-func
    const fn = new Function('document', 'window', 'console',
      `${body}; return applyTextModelRadio;`)(doc, {}, { log() {} });
    fn({ primaryGeminiTextModel: saved });
    return radios.find((r) => r.checked)?.value;
  };

  const ALL = ['gemini-2.5-flash', 'gemini-2.5-pro', 'openai-gpt41', 'claude-sonnet'];

  it('⭐ 지난번에 고른 모델이 켜진다', () => {
    expect(run('openai-gpt41', ALL)).toBe('openai-gpt41');
    expect(run('claude-sonnet', ALL)).toBe('claude-sonnet');
  });

  it('⭐ 저장값이 목록에 없으면 기본값을 켠다 — 아무것도 안 고른 상태로 두지 않는다', () => {
    expect(run('없어진-모델', ALL)).toBe('gemini-2.5-flash');
  });

  it('저장된 적 없으면 기본값', () => {
    expect(run('', ALL)).toBe('gemini-2.5-flash');
  });

  it('⭐ 시작 시점에 실제로 불린다 — 환경설정을 열지 않아도', () => {
    expect(mainJs).toContain('applyTextModelRadio(settings)');
    // 설정 로드 뒤에 와야 한다 — 앞서면 값이 없다
    expect(mainJs.indexOf('applyTextModelRadio')).toBeGreaterThan(mainJs.indexOf('await loadSettings()'));
  });

  it('환경설정 패널도 같은 함수를 쓴다 (두 곳이 어긋나지 않게)', () => {
    expect(settingsSrc).toContain('applyTextModelRadio(mergedSettings)');
  });
});

/**
 * 발행이 끝나면 다음 글을 위해 비운다 (v3.8.414)
 *
 * 사용자 요구: "한번 발행완료 되고나면 완벽하게 초기화되어서
 *              다음글이 작성가능할 수 있는 환경이 마련되어야 합니다"
 *
 * 실측 누수: appState.generatedContent.payload 가 다음 발행 payload 에 통째로 스프레드되고
 *   (`...(appState.generatedContent.payload || {})`),
 *   __preGeneratedImagesForArticle 은 payload 를 만들 때마다 읽힌다.
 *   지금까지는 이미지 생성이 **실패**했을 때만 지웠다 — 성공하면 그대로 남았다.
 */
describe('발행 후 초기화', () => {
  const postingSrc = read('electron', 'ui', 'modules', 'posting.js');

  const runReset = () => {
    const body = braceBlock(postingSrc, 'export function resetArticleStateAfterPublish')
      .replace('export function', 'function');
    const appState: any = { generatedContent: { payload: { topic: '지난 글' } }, isCanceled: true };
    const win: any = {
      __preGeneratedImagesForArticle: [{ h2Index: 1 }],
      __preGeneratedThumbnailForArticle: { dataUrl: 'x' },
      __shoppingCollectedImageCount: 1,
      __publishForceOptions: { contentUrl: 'x' },
    };
    const logs: string[] = [];
    // eslint-disable-next-line no-new-func
    const fn = new Function('getAppState', 'window', 'debugLog', 'addLog',
      `${body}; return resetArticleStateAfterPublish;`)(
      () => appState, win, () => {}, (m: string) => logs.push(m));
    const cleared = fn('발행 완료');
    return { appState, win, cleared, logs, fn };
  };

  it('⭐ 지난 글이 다음 payload 로 새지 않는다', () => {
    const { appState } = runReset();
    expect(appState.generatedContent).toBeNull();
  });

  it('⭐ 지난 글의 이미지가 다음 글에 실리지 않는다', () => {
    const { win } = runReset();
    expect(win.__preGeneratedImagesForArticle).toEqual([]);
    expect(win.__preGeneratedThumbnailForArticle).toBeNull();
  });

  it('⭐ 이번 발행에만 쓰는 강제 옵션을 비운다', () => {
    expect(runReset().win.__publishForceOptions).toBeNull();
  });

  it('중지 표시도 지운다 (다음 작업이 바로 멈추면 안 된다)', () => {
    expect(runReset().appState.isCanceled).toBe(false);
  });

  it('무엇을 지웠는지 사용자에게 알린다', () => {
    expect(runReset().logs[0]).toContain('다음 글을 위해 초기화');
  });

  it('⭐ 두 번 불러도 안전하다', () => {
    const { fn } = runReset();
    expect(fn('재호출')).toEqual([]);
  });

  it('⭐ 성공 경로 두 곳 모두에서 불린다', () => {
    // runPosting · publishToPlatform 둘 다 발행을 끝낼 수 있다. 한쪽만 걸면 다른 경로가 샌다.
    const hits = postingSrc.split('\n').filter((l) => l.includes('resetArticleStateAfterPublish(') && !l.includes('export function'));
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it('⭐ 사용자가 입력한 값은 건드리지 않는다 (다음 글에도 쓸 설정이다)', () => {
    const block = braceBlock(postingSrc, 'export function resetArticleStateAfterPublish');
    expect(block).not.toContain('keywordInput');      // 키워드를 지우면 다시 발행할 때 또 쳐야 한다
    expect(block).not.toContain('affiliateLinks');    // 제휴 링크도 마찬가지
    expect(block).not.toContain('h2ImageSource');     // 엔진 선택은 '이 글'의 상태가 아니다
    expect(postingSrc).toContain('사용자가 입력한 값');    // 근거가 주석에 남아 있다(본문 밖 JSDoc)
  });
});

/**
 * v3.8.414 는 '취소가 작동한다'는 착각을 만들었다 — 배선이 엉뚱한 핸들러에 걸려 있었다 (v3.8.415)
 *
 * "끝까지 물고 늘어져서 완벽하게 수정해줘 다시 손 안 가게" 요청을 받고 다시 훑었다.
 *
 * 실제 발행 흐름을 끝까지 추적한 결과:
 *   run-post (main.ts) → generateMaxModeArticle (index.ts) → generateUltimateMaxModeArticle
 *   → generateUltimateMaxModeArticlePuppeteer → generateUltimateMaxModeArticleFinal (재export 3단)
 *   → orchestration.ts 의 그 함수 (checkCanceled 가 있는 곳).
 *
 * 즉 사용자가 로그에서 본 209초짜리 파이프라인(제목→본문→이미지 8장→발행)은
 * 전부 'run-post' IPC 핸들러 안에서 돈다. 그런데 v3.8.414 는 beginRun()/endRun() 을
 * 'publish-content' 핸들러(반자동·큐의 "이미 생성된 글 발행" 전용, 별개 채널)에 걸었다.
 *
 * 재현(수정 전): beginRun() 을 한 번도 안 부른 채 requestCancel() 을 호출하면 false 가 나온다
 * (currentRunId 가 0 이라서). run-post 로 생성 중일 때 중지를 눌러도
 * "진행 중인 작업이 없습니다"라고 거짓 안내가 뜨고 실제로는 안 멈췄다 —
 * 버튼도 없던 v3.8.413 이전보다 더 헷갈리는 상태였다.
 */
describe('v3.8.415 - beginRun/endRun 이 진짜 생성 핸들러(run-post)에 걸려 있다', () => {
  it('run-post 핸들러 안에 beginRun() 이 있다 (이번 사고의 핵심)', () => {
    const block = braceBlock(mainTs, "ipcMain.handle('run-post'");
    expect(block).toContain("require('../dist/core/cancel-token').beginRun()");
  });

  it('run-post 의 catch 가 취소를 실패와 구분한다', () => {
    const block = braceBlock(mainTs, "ipcMain.handle('run-post'");
    expect(block).toContain('isCancellation(error)');
    expect(block).toContain("canceled: true, error: '작업을 중지했습니다.'");
  });

  it('run-post 에도 반드시 endRun() 이 있다 (finally) - 안 지우면 다음 발행이 시작하자마자 멈춘다', () => {
    const block = braceBlock(mainTs, "ipcMain.handle('run-post'");
    expect(block).toContain("require('../dist/core/cancel-token').endRun()");
  });

  it('publish-content 핸들러도 여전히 걸려 있다 (반자동/큐 재발행 경로)', () => {
    const block = braceBlock(mainTs, "ipcMain.handle('publish-content'");
    expect(block).toContain("require('../dist/core/cancel-token').beginRun()");
    expect(block).toContain("require('../dist/core/cancel-token').endRun()");
  });

  it('beginRun() 없이 requestCancel() 을 부르면 false 다 - 이게 거짓 안내의 원인이었다', () => {
    endRun();
    expect(requestCancel()).toBe(false);
  });
});

/**
 * Agent 모드(Codex/Claude CLI 구독)는 cancel-token 을 아예 거치지 않는다 (v3.8.415)
 *
 * orchestration.ts 를 안 거치고 codex/claude CLI 를 자식 프로세스로 최대 25분 띄운다.
 * checkCanceled() 가 아무리 촘촘해도 이 프로세스 안에서는 절대 안 걸린다 -
 * 실제로 프로세스를 죽여야 진짜 중지다.
 *
 * Windows 에서 useShell:true 로 뜬 프로세스는 spawn 이 돌려주는 pid 가 cmd.exe 의 pid 라
 * child.kill() 을 해도 그 밑에서 실제로 토큰을 쓰는 codex/claude 는 안 죽는다.
 * taskkill /pid PID /t /f 로 트리 전체를 죽여야 한다.
 */
describe('v3.8.415 - Agent 모드 자식 프로세스를 실제로 죽인다', () => {
  it('실행 중인 프로세스를 추적하는 목록이 있다', () => {
    expect(mainTs).toContain('const activeAgentChildren = new Set');
  });

  it('spawn 직후 추적 목록에 넣고, close 시 뺀다 (안 빼면 죽은 프로세스가 계속 쌓인다)', () => {
    // v3.8.415 참고: braceBlock 은 마커 뒤 첫 '{' 를 본문 시작으로 본다.
    //   이 함수들의 시그니처엔 TS 타입 리터럴(예: opts: { userCanceled?: boolean })이나
    //   제네릭 반환 타입(Promise<{ ... }>)이 먼저 나와 braceBlock 이 그 중괄호를 본문으로 오인한다.
    //   그래서 여기서는 브레이스 매칭이 필요 없는 blockBetween(경계 슬라이스)을 쓴다.
    expect(mainTs).toContain('activeAgentChildren.add(child)');
    expect(mainTs).toContain('activeAgentChildren.delete(child)');
  });

  it('Windows 에서는 taskkill /t /f 로 트리 전체를 죽인다 - child.kill() 만으로는 cmd.exe 만 죽는다', () => {
    const block = blockBetween(mainTs, 'function killAgentChildTree(', 'function cancelActiveAgentProcesses(');
    expect(block).toContain("'win32'");
    expect(block).toContain("execFile('taskkill'");
    expect(block).toContain("'/t'");
    expect(block).toContain("'/f'");
  });

  it('세 킬 지점(한도초과/타임아웃/중지) 모두 트리킬을 쓴다 - raw child.kill() 이 남으면 Windows 에서 안 죽는다', () => {
    // 두 곳(한도초과·타임아웃)은 runAgentProcess 안에, 나머지 한 곳(사용자 중지)은
    // 형제 함수 cancelActiveAgentProcesses 안에 있다 — 그건 위 테스트가 따로 확인한다.
    const block = blockBetween(mainTs, 'async function runAgentProcess(', 'function readTextFileIfExists(');
    // 주석 줄은 세지 않는다 — "child.kill() 만으로는 안 된다"는 설명 자체가 그 문구를 담고 있다
    const codeLines = block.split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l));
    const rawKillCount = (codeLines.join('\n').match(/child\.kill\(\)/g) || []).length;
    expect(rawKillCount).toBe(0);
    const treeKillCount = (block.match(/killAgentChildTree\(child/g) || []).length;
    expect(treeKillCount).toBe(2);
  });

  it('사용자가 중지시킨 것과 타임아웃/한도초과를 구분한다', () => {
    const block = blockBetween(mainTs, 'function killAgentChildTree(', 'function cancelActiveAgentProcesses(');
    expect(block).toContain('userCanceled');
    expect(block).toContain('__userCanceled');
  });

  it('cancelActiveAgentProcesses() 가 실제로 도는 프로세스를 전부 죽이고 목록을 비운다', () => {
    const block = braceBlock(mainTs, 'function cancelActiveAgentProcesses(');
    expect(block).toContain('for (const child of activeAgentChildren) killAgentChildTree(child, { userCanceled: true })');
    expect(block).toContain('activeAgentChildren.clear()');
  });

  it('handleCancelTask() 가 cancel-token 과 Agent 프로세스 종료를 둘 다 부른다', () => {
    const block = blockBetween(mainTs, 'function handleCancelTask(', "ipcMain.on('cancel-task'");
    expect(block).toContain('requestCancel()');
    expect(block).toContain('cancelActiveAgentProcesses()');
    expect(block).toContain('tokenAccepted || killedAgents > 0');
  });

  it('취소당해 산출물이 비었으면 재시도로 다른 모델을 또 띄우지 않는다', () => {
    const block = blockBetween(mainTs, 'async function runAgentProcess(', 'function readTextFileIfExists(');
    expect(block).toContain('if (run.canceled) return run;');
  });

  it('agent-mode:run-job 이 취소를 실패로 보고하지 않는다', () => {
    const block = braceBlock(mainTs, "ipcMain.handle('agent-mode:run-job'");
    expect(block).toContain('!hasContent && run.canceled');
    expect(block).toContain('canceled: true');
  });
});

/**
 * 렌더러가 canceled 결과를 실패로 잘못 표시하지 않는다 (v3.8.415)
 *
 * main 프로세스가 아무리 정직하게 { ok:false, canceled:true } 를 돌려줘도
 * 화면 쪽이 result.ok 만 보고 "발행 실패"를 띄우면 사용자에게는 똑같이 고장난 걸로 보인다.
 */
describe('v3.8.415 - 렌더러가 취소와 실패를 구분해서 보여준다', () => {
  const postingSrc2 = read('electron', 'ui', 'modules', 'posting.js');
  const previewSrc = read('electron', 'ui', 'modules', 'preview.js');
  const codexSrc = read('electron', 'ui', 'modules', 'codex-workshop.js');

  it('runPosting() 의 실패 분기가 canceled 를 먼저 본다 (일반 실패 알림보다 앞서야 한다)', () => {
    const idx = postingSrc2.indexOf('} else if (result?.canceled) {');
    const genericFailIdx = postingSrc2.indexOf("const errorMessage = result?.error || '알 수 없는 오류';");
    expect(idx).toBeGreaterThan(-1);
    expect(idx).toBeLessThan(genericFailIdx);
  });

  it('runPosting() 의 catch 도 canceled 를 먼저 본다', () => {
    const block = braceBlock(postingSrc2, 'export async function runPosting()');
    expect(block).toContain('if (error?.canceled)');
  });

  it('publishToPlatform() 도 성공/실패 분기와 catch 양쪽에서 canceled 를 본다', () => {
    const block = braceBlock(postingSrc2, 'export async function publishToPlatform()');
    expect(block).toContain('} else if (result?.canceled) {');
    expect(block).toContain('if (error?.canceled)');
  });

  it('취소돼도 다음 글을 위해 상태를 초기화한다 - 완료 뿐 아니라 중지도 깨끗해야 한다', () => {
    const hits = postingSrc2.split('\n').filter((l) => l.includes("resetArticleStateAfterPublish('중지')"));
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it('반자동 미리보기 생성(preview.js)도 같은 run-post 를 쓴다 - canceled 를 본다', () => {
    const block = braceBlock(previewSrc, 'export async function generatePreview()');
    expect(block).toContain('else if (result?.canceled)');
    expect(block).toContain('error?.canceled');
  });

  it('Agent 모드가 취소를 throw 로 알릴 때 canceled 플래그를 싣는다', () => {
    // runAgentJob 의 첫 인자가 구조분해 파라미터라 시그니처 자체에 '{' 가 있다 — braceBlock 대신 경계 슬라이스
    const block = blockBetween(codexSrc, 'async function runAgentJob(', 'async function runAgentJobFromModal()');
    expect(block).toContain('result?.canceled');
    expect(block).toContain('canceledErr.canceled = true');
  });

  it('그 throw 를 posting.js 의 바깥 catch 가 error.canceled 로 받아낸다 (두 조각이 맞물린다)', () => {
    const block = braceBlock(postingSrc2, 'export async function runPosting()');
    expect(block).toContain('error?.canceled');
  });
});
