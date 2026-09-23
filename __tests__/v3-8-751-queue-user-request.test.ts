/**
 * 연속발행에도 요청사항 (v3.8.751)
 *
 * ## 왜
 * 사장님(2026-09-23):
 *   1) "연속발행모드에는 요청사항을 입력못하네요 추가해주세요 배선도 완벽하게 해주시구요"
 *   2) "요청사항도 발행되고나면 필드 초기화 시켜주세요"
 *   3) "요청사항 제대로 반영되는거맞는지 한번더 확인해주세요"
 *
 * v3.8.718 이 만든 「이 글 요청사항」은 단일 발행 화면에만 있었다. 대기열 항목은 그 값을
 * 복사해 가지 않았고(payload 에도 안 실렸고), 카드에 적을 칸도 없었다.
 *
 * ## 이 테스트가 하는 일
 * 소스 문자열 대조로 끝내지 않는다. publish-queue.js 를 **실제로 실행해서**
 * 화면값 → 대기열 항목 → payload 까지 값이 살아서 도착하는지 본다.
 * (조용한 미배선 — 입력은 받는데 쓰는 곳이 없는 사고가 이 저장소에서 여섯 번 났다)
 */
import * as fs from 'fs';
import * as path from 'path';
import { braceBlock } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const QUEUE_SRC = read('electron/ui/modules/publish-queue.js');
const POSTING_SRC = read('electron/ui/modules/posting.js');
const HTML_SRC = read('electron/ui/index.html');
const ORCH_SRC = read('src/core/final/orchestration.ts');
const GEN_SRC = read('src/core/final/generation.ts');

const LAWYER_REQUEST = [
  '단순 나열 말고, 갑자기 이혼 통보받은 사람이 끝까지 읽게 써주세요.',
  '재산 처분·계좌 이동 확인법을 꼭 포함.',
].join('\n');

// ────────────────────────────────────────────────────────────
// 모듈을 진짜로 돌린다 (jsdom 없이 — 필요한 것만 세워 준다)
// ────────────────────────────────────────────────────────────

type Fields = Record<string, string>;

function loadQueueModule(fields: Fields) {
  const els: Record<string, { value: string; textContent?: string; style: any; options: any[] }> = {};
  Object.entries(fields).forEach(([id, value]) => {
    els[id] = { value, textContent: '', style: {}, options: [] };
  });

  const document = {
    getElementById: (id: string) => els[id] || null,
    querySelector: () => null,
    querySelectorAll: () => [] as any[],
  };
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
  };
  const alerts: string[] = [];
  const win: any = {};

  const src = QUEUE_SRC
    .replace(/^import[^\n]*\n/m, '')   // ESM import 는 Function 안에서 못 쓴다
    .replace(/^export /gm, '');        // export 키워드도 마찬가지

  const expose = `
    ; return {
      STATE,
      getCurrentQueueSnapshot,
      cloneQueueSnapshot,
      snapshotFromItem,
      applySnapshotToItem,
      buildQueuePayloadOverrides,
      buildItemRow,
      addCurrent,
      restoreQueue,
      persistQueue,
    };`;

  // eslint-disable-next-line no-new-func
  const api = new Function(
    'window', 'document', 'localStorage', 'alert', 'confirm', 'console',
    src + expose,
  )(win, document, localStorage, (m: string) => alerts.push(String(m)), () => true, console);

  return { api, els, store, alerts, window: win };
}

describe('① 화면의 요청사항이 대기열 항목으로 복사된다', () => {
  it('⭐⭐ 대기열에 담으면 각 항목이 요청사항을 들고 간다', () => {
    const { api } = loadQueueModule({
      keywordInput: '이혼 재산분할\n양육권 소송',
      userRequestNote: LAWYER_REQUEST,
    });

    api.addCurrent();

    expect(api.STATE.keywords).toHaveLength(2);
    api.STATE.keywords.forEach((item: any) => {
      expect(item.userRequest).toBe(LAWYER_REQUEST);
    });
  });

  it('⭐⭐ 요청사항을 안 적었으면 빈 값이다 (예전과 같은 동작)', () => {
    const { api } = loadQueueModule({ keywordInput: '이혼 재산분할', userRequestNote: '' });
    api.addCurrent();
    expect(api.STATE.keywords[0].userRequest).toBe('');
  });

  it('스냅샷이 화면값을 읽는다 — 이 한 줄이 없으면 복사 자체가 안 일어난다', () => {
    const { api } = loadQueueModule({ userRequestNote: `  ${LAWYER_REQUEST}  ` });
    expect(api.getCurrentQueueSnapshot().userRequest).toBe(LAWYER_REQUEST);
  });
});

describe('② 항목별로 다르게 적을 수 있고, payload 에 그대로 실린다', () => {
  it('⭐⭐ 항목마다 다른 요청이 각자의 payload 로 간다', () => {
    const { api } = loadQueueModule({ keywordInput: '키워드A\n키워드B', userRequestNote: '공통 요청' });
    api.addCurrent();

    // 카드에서 두 번째 글만 고쳐 쓴 상황
    api.STATE.keywords[1].userRequest = '이 글은 신청 절차만 다뤄주세요';

    const p0 = api.buildQueuePayloadOverrides(api.STATE.keywords[0], new Date().toISOString());
    const p1 = api.buildQueuePayloadOverrides(api.STATE.keywords[1], new Date().toISOString());

    expect(p0.userRequest).toBe('공통 요청');
    expect(p1.userRequest).toBe('이 글은 신청 절차만 다뤄주세요');
  });

  it('⭐⭐ 비어 있으면 undefined — 요청사항 없는 예전 payload 와 같다', () => {
    const { api } = loadQueueModule({ keywordInput: '키워드A', userRequestNote: '' });
    api.addCurrent();
    const p = api.buildQueuePayloadOverrides(api.STATE.keywords[0], new Date().toISOString());
    expect(p.userRequest).toBeUndefined();
    expect('userRequest' in p).toBe(true);   // 키는 있어야 오버라이드가 낡은 값을 덮는다
  });

  it('⭐ 공백만 적은 것은 요청이 아니다', () => {
    const { api } = loadQueueModule({ keywordInput: '키워드A', userRequestNote: '' });
    api.addCurrent();
    api.STATE.keywords[0].userRequest = '   \n  ';
    const p = api.buildQueuePayloadOverrides(api.STATE.keywords[0], new Date().toISOString());
    expect(p.userRequest).toBeUndefined();
  });

  it('⭐ 단일 발행과 같은 필드명이다 (백엔드가 두 경로를 구분할 필요가 없다)', () => {
    expect(POSTING_SRC).toMatch(/userRequest: \(document\.getElementById\('userRequestNote'\)/);
    const overrides = braceBlock(QUEUE_SRC, 'function buildQueuePayloadOverrides(item, scheduleDateIso)');
    expect(overrides).toContain('userRequest:');
  });
});

describe('③ 저장·복원과 스냅샷이 요청사항을 잃지 않는다', () => {
  it('⭐⭐ 앱을 껐다 켜도(localStorage 왕복) 요청사항이 남는다', () => {
    const first = loadQueueModule({ keywordInput: '키워드A', userRequestNote: LAWYER_REQUEST });
    first.api.addCurrent();
    const saved = first.store.get('publishQueueItems.v1')!;
    expect(saved).toContain('재산 처분');

    // 새 세션: 화면 요청사항은 비어 있는데 저장된 항목은 제 값을 지켜야 한다
    const second = loadQueueModule({ keywordInput: '', userRequestNote: '' });
    second.store.set('publishQueueItems.v1', saved);
    second.api.restoreQueue();
    expect(second.api.STATE.keywords[0].userRequest).toBe(LAWYER_REQUEST);
  });

  it('⭐⭐ 항목에서 요청사항을 지우면 지워진 채로 남는다 (지운 것도 뜻이다)', () => {
    const { api } = loadQueueModule({ keywordInput: '키워드A', userRequestNote: LAWYER_REQUEST });
    api.addCurrent();
    api.STATE.keywords[0].userRequest = '';
    // 카드를 다시 그릴 때마다 applySnapshotToItem 이 돈다 — 여기서 되살아나면 안 된다
    api.applySnapshotToItem(api.STATE.keywords[0]);
    expect(api.STATE.keywords[0].userRequest).toBe('');
    expect(api.buildQueuePayloadOverrides(api.STATE.keywords[0], '').userRequest).toBeUndefined();
  });

  it('⭐ 구버전 저장 항목(요청사항 필드 자체가 없음)도 깨지지 않는다', () => {
    const { api, store } = loadQueueModule({ keywordInput: '', userRequestNote: '' });
    store.set('publishQueueItems.v1', JSON.stringify([{ id: 'old-1', keyword: '옛 항목', enabled: true }]));
    api.restoreQueue();
    expect(api.STATE.keywords[0].userRequest).toBe('');
  });
});

describe('④ 대기열 카드에 실제로 입력칸이 있다 (id 실존)', () => {
  it('⭐⭐ 항목 카드가 요청사항 칸을 그리고, 적어 둔 값을 보여준다', () => {
    const { api } = loadQueueModule({ keywordInput: '키워드A', userRequestNote: '재산 처분 확인법 포함' });
    api.addCurrent();
    const html = api.buildItemRow(api.STATE.keywords[0], 0);
    expect(html).toContain('pq-item-request');
    expect(html).toContain('재산 처분 확인법 포함');
  });

  it('⭐⭐ 그 칸을 읽는 이벤트가 실제로 붙어 있다 (칸만 있고 안 읽으면 조용히 죽는다)', () => {
    const bind = braceBlock(QUEUE_SRC, 'function bindItemEvents()');
    expect(bind).toContain(".pq-item-request");
    expect(bind).toMatch(/item\.userRequest = e\.target\.value/);
  });

  it('⭐ HTML 이 escape 된다 (요청사항에 <, " 를 써도 카드가 깨지지 않는다)', () => {
    const { api } = loadQueueModule({ keywordInput: '키워드A', userRequestNote: '<b>강조</b> "따옴표"' });
    api.addCurrent();
    const html = api.buildItemRow(api.STATE.keywords[0], 0);
    expect(html).toContain('&lt;b&gt;');
    expect(html).not.toContain('<b>강조</b>');
  });

  it('⭐ 일괄 적용 칸도 실재하고, 일괄 적용이 그 값을 읽는다', () => {
    expect(QUEUE_SRC).toContain('id="pq-bulk-request"');
    expect(QUEUE_SRC).toContain("getElementById('pq-bulk-request')");
    expect(QUEUE_SRC).toMatch(/if \(bulkRequest\) item\.userRequest = bulkRequest;/);
    // 비어 있으면 손대지 않는다 = 항목별 요청을 지우지 않는다 → 지우는 길이 따로 있어야 한다
    expect(QUEUE_SRC).toContain("getElementById('pq-bulk-request-clear')");
  });

  it('⭐ 발행 중인 글의 요청사항이 화면 칸에도 세워진다 (createPayload 가 DOM 을 읽으므로)', () => {
    const apply = braceBlock(QUEUE_SRC, 'function applyItemToMainForm(item, scheduleDateIso)');
    expect(apply).toContain("setValue('userRequestNote', item.userRequest || '')");
  });
});

describe('⑤ 발행이 끝나면 칸을 비운다', () => {
  it('⭐⭐ 단일 발행 — 완료 시 요청사항 칸을 비운다 (다음 글에 남의 요청이 실리지 않게)', () => {
    const reset = braceBlock(POSTING_SRC, 'export function resetArticleStateAfterPublish');
    expect(reset).toContain("getElementById('userRequestNote')");
    expect(reset).toContain('요청사항 칸');
    // 키워드·직접제목과 **같은** 완료 분기 안에 있어야 한다 (중지에는 안 지운다)
    const completedOnly = reset.slice(reset.indexOf('if (/완료/.test(String(reason)))'));
    expect(completedOnly).toContain("getElementById('userRequestNote')");
  });

  it('⭐⭐ 연속발행 — 큐가 끝나면 남은 요청사항 텍스트를 지운다', () => {
    const finallyBlock = QUEUE_SRC.slice(QUEUE_SRC.indexOf('window.__queueRunning = false;'));
    expect(finallyBlock).toContain("getElementById('userRequestNote')");
    expect(finallyBlock).toContain("getElementById('pq-bulk-request')");
  });

  it('⭐ 스케줄에 추가한 뒤에도 비운다 (요청은 예약 payload 에 이미 저장됐다)', () => {
    const schedule = QUEUE_SRC.slice(QUEUE_SRC.indexOf("document.getElementById('pq-action-schedule')"));
    const cleanup = schedule.slice(0, schedule.indexOf('스케줄 저장 실패'));
    expect(cleanup).toContain("getElementById('userRequestNote')");
  });

  it('⭐ 중지(취소)에는 안 지운다 — 같은 요청으로 다시 시도할 테니', () => {
    const reset = braceBlock(POSTING_SRC, 'export function resetArticleStateAfterPublish');
    const beforeCompleted = reset.slice(0, reset.indexOf('if (/완료/.test(String(reason)))'));
    expect(beforeCompleted).not.toContain("getElementById('userRequestNote')");
  });
});

describe('⑥ 요청사항이 실제 생성 단계까지 간다 (반영 확인)', () => {
  it('⭐⭐ 본문 — orchestration 이 본문 지시에 싣는다 (v3.8.718 배선 유지)', () => {
    expect(ORCH_SRC).toMatch(/buildUserRequestBlock\(\(payload as any\)\.userRequest\)/);
    expect(ORCH_SRC).toMatch(/scopedSectionBlock \+= requestBlock/);
  });

  it('⭐⭐ 소제목 — 소제목 생성 세 경로가 모두 요청을 본다 (v3.8.751)', () => {
    expect(ORCH_SRC).toContain('const userRequestHeadingBlock');
    const calls = ORCH_SRC.match(/generateH2TitlesFinal\([^;]*\)/g) || [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
    calls.forEach((call) => expect(call).toContain('userRequestHeadingBlock'));
    const roleCall = ORCH_SRC.match(/generateSectionTitlesFromRoles\([^;]*\)/g) || [];
    expect(roleCall).toHaveLength(1);
    expect(roleCall[0]).toContain('userRequestHeadingBlock');
  });

  it('⭐⭐ 제목 — 제목 생성도 요청을 보되 Research Packet 과 섞지 않는다', () => {
    expect(ORCH_SRC).toContain('const userRequestTitleBlock');
    const titleCall = braceBlock(ORCH_SRC, 'const makeTitle = async (directive: string)');
    expect(titleCall).toContain('userRequestTitleBlock');
    // 근거 장부(researchBlock)에 섞으면 요청에 적힌 숫자가 근거로 읽힌다
    expect(titleCall).not.toMatch(/researchPacketText[^\n]*userRequestTitleBlock/);
    expect(GEN_SRC).toContain('userRequestBlock?: string');
    expect(GEN_SRC).toMatch(/\$\{userRequestBlock && userRequestBlock\.trim\(\)/);
  });

  it('⭐⭐ 에이전트 모드도 같은 요청을 받는다 (orchestration 을 안 타는 경로)', () => {
    const main = read('electron/main.ts');
    expect(main).toMatch(/buildUserRequestBlock\(\(payload as any\)\?\.userRequest\)/);
  });

  it('⭐ 예약(스케줄러)은 payload 를 통째로 넘긴다 — 요청사항만 빠질 자리가 없다', () => {
    const sched = read('src/core/schedule-manager.ts');
    expect(sched).toContain('...schedule.payload');
  });
});

describe('⑦ 다중계정 발행도 같은 요청을 싣는다', () => {
  const MULTI_SRC = read('electron/ui/modules/multi-account.js');
  const MAIN_SRC = read('electron/main.ts');

  it('⭐⭐ 화면이 요청사항을 읽어 계정 payload 에 넣는다', () => {
    const collect = braceBlock(MULTI_SRC, 'function collectCurrentDetailSettings()');
    expect(collect).toContain("valueFromDom('userRequestNote')");
    // collectAdvancedSettings → publishToAccount 가 그대로 펼쳐 실어 보낸다
    expect(braceBlock(MULTI_SRC, 'function collectAdvancedSettings()')).toContain('...defaults');
    expect(braceBlock(MULTI_SRC, 'async function publishToAccount(account)')).toContain('...advanced');
  });

  it('⭐⭐ 메인이 그 필드를 받아 생성 payload 로 넘긴다 (필드를 골라 담는 핸들러라 필수)', () => {
    const handler = MAIN_SRC.slice(MAIN_SRC.indexOf("ipcMain.handle('run-multi-account-post'"));
    const body = handler.slice(0, handler.indexOf('const publishResult'));
    expect(body).toContain('userRequest?: string;');          // 타입에 이름이 있어야 읽을 수 있다
    expect(body).toMatch(/userRequest: String\(payload\.userRequest \|\| ''\)\.trim\(\) \|\| undefined/);
  });

  it('⭐ 끝까지 발행했을 때만 요청사항 칸을 비운다 (중단·오류면 남긴다)', () => {
    const start = braceBlock(MULTI_SRC, 'async function startMultiPublish()');
    expect(start).toContain('publishedWithoutStop = !publishAbort');
    expect(start).toMatch(/if \(publishedWithoutStop\)/);
    expect(start).toContain("getElementById('userRequestNote')");
  });
});

describe('⑧ 화면 안내', () => {
  it('⭐ 연속발행에서 어떻게 쓰이는지 요청사항 칸 아래에 적혀 있다', () => {
    expect(HTML_SRC).toContain('id="userRequestNote"');
    const hint = HTML_SRC.slice(HTML_SRC.indexOf('id="userRequestNote"'));
    expect(hint.slice(0, 2000)).toContain('연속 발행');
  });
});
