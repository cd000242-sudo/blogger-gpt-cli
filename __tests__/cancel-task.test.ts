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
import { braceBlock } from './helpers/source-block';

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
