const fs = require('fs');
const path = require('path');

// 배포 모듈은 electron 의 app 만 쓴다 — userData 를 임시 폴더로 돌려 실제 앱 없이 실행한다
jest.mock('electron', () => ({ app: { getPath: () => require('os').tmpdir() } }));

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/**
 * 황금키워드 배포 경로 회귀 가드.
 *
 * 원래 이 데이터는 저장도 읽기도 관리자 PC 의 localStorage 뿐이라
 * 배포된 앱에 전달될 수단이 아예 없었다("나는 보이는데 배포환경에서는 안 보임").
 * 이제 레포의 data/golden-keyword.json 을 raw URL 로 읽어간다.
 */

/**
 * index.html 안의 순수 로직 블록만 떼어내 실제로 실행한다.
 * 소스 문자열 비교만으로는 "더 최신인 쪽" 규칙이 정말 맞게 도는지 알 수 없다.
 */
function loadGoldenModule(store: Record<string, string>) {
  const html = read('electron/ui/index.html');
  const start = html.indexOf('var GOLDEN_KEYWORD_STORAGE_KEY');
  const end = html.indexOf('async function refreshGoldenKeywordFromRemote');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);

  const block = html.slice(start, end);
  const factory = new Function('localStorage', `${block}
    return { getGoldenData, getGoldenLocalData, goldenUpdatedAt,
             GOLDEN_KEYWORD_STORAGE_KEY, GOLDEN_KEYWORD_REMOTE_CACHE_KEY };`);
  return factory({
    getItem: (key: string) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
  });
}

describe('황금키워드 원격 배포 회귀 가드', () => {
  describe('최신 판정 (실행 검증)', () => {
    test('updatedAt 이 정본이고, 구 데이터의 savedAt 도 인정한다', () => {
      const gk = loadGoldenModule({});
      expect(gk.goldenUpdatedAt({ updatedAt: 1738000000000 })).toBe(1738000000000);
      expect(gk.goldenUpdatedAt({ savedAt: '2026-08-05T00:00:00.000Z' })).toBe(Date.parse('2026-08-05T00:00:00.000Z'));
      expect(gk.goldenUpdatedAt({ savedAt: '깨진값' })).toBe(0);
      expect(gk.goldenUpdatedAt({})).toBe(0);
      expect(gk.goldenUpdatedAt(null)).toBe(0);
    });

    test('일반 사용자(로컬 편집본 없음)는 원격 배포본을 본다', () => {
      const remote = { reportDate: '2026-08-05', updatedAt: 2000, items: [{ keyword: '원격 키워드' }] };
      const gk = loadGoldenModule({ goldenKeywordReportRemoteCache: JSON.stringify(remote) });
      expect(gk.getGoldenData().items).toHaveLength(1);
      expect(gk.getGoldenData().items[0].keyword).toBe('원격 키워드');
    });

    test('관리자가 방금 저장한 편집본은 GitHub 반영 전에도 즉시 보인다', () => {
      const gk = loadGoldenModule({
        goldenKeywordReport: JSON.stringify({ updatedAt: 9000, items: [{ keyword: '방금 편집' }] }),
        goldenKeywordReportRemoteCache: JSON.stringify({ updatedAt: 2000, items: [{ keyword: '옛 원격' }] }),
      });
      expect(gk.getGoldenData().items[0].keyword).toBe('방금 편집');
    });

    test('원격이 더 최신이면 관리자 PC 도 원격을 따른다', () => {
      const gk = loadGoldenModule({
        goldenKeywordReport: JSON.stringify({ updatedAt: 1000, items: [{ keyword: '옛 로컬' }] }),
        goldenKeywordReportRemoteCache: JSON.stringify({ updatedAt: 5000, items: [{ keyword: '새 원격' }] }),
      });
      expect(gk.getGoldenData().items[0].keyword).toBe('새 원격');
    });

    test('둘 다 없거나 깨져 있어도 빈 목록으로 안전하게 떨어진다', () => {
      expect(loadGoldenModule({}).getGoldenData().items).toEqual([]);
      expect(loadGoldenModule({
        goldenKeywordReport: '{{깨진 JSON',
        goldenKeywordReportRemoteCache: '[]',
      }).getGoldenData().items).toEqual([]);
    });
  });

  describe('배포 가드 (실행 검증)', () => {
    // 컴파일된 결과를 부른다 — .ts 만 고치고 컴파일을 빠뜨리면 여기서 걸린다
    const publisher = require('../electron/golden-keyword-publisher');

    test('빈 목록은 git/API 를 건드리기 전에 막는다', async () => {
      const res = await publisher.publishGoldenKeyword({ reportDate: '2026-08-05', items: [] });
      expect(res.ok).toBe(false);
      expect(res.error).toContain('0건');
      // 여기서 안 막히면 실제로 커밋이 나가 모든 사용자 화면이 비어버린다
      expect(res.method).toBeUndefined();
    });

    test('형식이 틀린 데이터도 배포하지 않는다', async () => {
      expect((await publisher.publishGoldenKeyword(null)).ok).toBe(false);
      expect((await publisher.publishGoldenKeyword({ items: 'x' })).ok).toBe(false);
      expect((await publisher.publishGoldenKeyword({})).ok).toBe(false);
    });

    test('토큰 존재 여부만 boolean 으로 알려준다', () => {
      expect(typeof publisher.hasGoldenToken()).toBe('boolean');
      expect(publisher.readGoldenToken).toBeUndefined();
    });
  });

  describe('배선', () => {
    test('공개 레포의 raw URL 을 읽고, 앱 시작 시 갱신한다', () => {
      const html = read('electron/ui/index.html');
      expect(html).toContain("var GOLDEN_KEYWORD_REMOTE_URL = 'https://raw.githubusercontent.com/cd000242-sudo/blogger-gpt-cli/master/data/golden-keyword.json';");
      // 네트워크가 죽어도 화면이 멈추지 않아야 한다
      expect(html).toContain("cache: 'no-store'");
      expect(html).toContain('GOLDEN_KEYWORD_FETCH_TIMEOUT_MS');
      expect(html).toContain('if (typeof refreshGoldenKeywordFromRemote === \'function\') refreshGoldenKeywordFromRemote();');
    });

    test('편집 저장이 updatedAt 을 남기고 그 자리에서 배포까지 한다', () => {
      const html = read('electron/ui/index.html');
      expect(html).toContain('updatedAt: now,');
      // 관리자가 터미널을 열어야 하면 배포자들에게 전달이 늦는다 — 저장 = 배포
      expect(html).toContain("api.invoke('golden-keyword:publish', payload)");
      expect(html).toContain('var publishNote = await publishGoldenKeywordToGitHub(payload);');
      // 토큰이 필요하면 그 자리에서 받아 저장하고 한 번 더 시도한다
      expect(html).toContain('if (res && res.needsToken)');
      expect(html).toContain("api.invoke('golden-keyword:save-token', { token: token })");
    });

    test('IPC 3개가 등록돼 있고 컴파일 결과에도 들어가 있다', () => {
      const mainTs = read('electron/main.ts');
      const mainJs = read('electron/main.js');
      for (const channel of ['golden-keyword:publish', 'golden-keyword:token-status', 'golden-keyword:save-token']) {
        expect(mainTs).toContain(`ipcMain.handle('${channel}'`);
        // .ts 만 고치고 컴파일을 안 하면 배포본은 그대로다 — 컴파일 결과까지 확인
        expect(mainJs).toContain(`ipcMain.handle('${channel}'`);
      }
      expect(mainTs).toContain("from './golden-keyword-publisher'");
    });

    test('배포 경로를 환경에 따라 자동으로 고르고, 대상은 코드에 고정한다', () => {
      const pub = read('electron/golden-keyword-publisher.ts');
      // 렌더러가 경로/브랜치를 정하게 두면 안 된다
      expect(pub).toContain("const REPO_BRANCH = 'master';");
      expect(pub).toContain("const REPO_REL_PATH = 'data/golden-keyword.json';");
      // 레포가 있으면 git, 없으면 토큰으로 API — 관리자가 어디서 열든 동작해야 한다
      expect(pub).toContain('const root = findRepoRoot();');
      expect(pub).toContain('if (root) return publishViaGit(root, payload);');
      expect(pub).toContain('return publishViaApi(payload, token);');
      // 작업 중인 다른 변경이 딸려 올라가면 안 된다
      expect(pub).toContain("await git(['commit', '-m', buildMessage(payload), '--', REPO_REL_PATH]);");
      // 빈 목록 배포는 모든 사용자 화면을 비운다
      expect(pub).toContain('if (payload.items.length === 0)');
      // 내용이 같아 커밋할 게 없는 경우는 실패가 아니다
      expect(pub).toContain('nothing to commit|no changes added');
    });

    test('토큰 값은 렌더러로 돌려주지 않는다', () => {
      const pub = read('electron/golden-keyword-publisher.ts');
      const mainTs = read('electron/main.ts');
      // 상태 조회는 존재 여부(boolean)만 준다
      expect(pub).toContain('export function hasGoldenToken(): boolean');
      expect(mainTs).toContain('return { ok: true, hasToken: hasGoldenToken() };');
      // readGoldenToken 은 외부로 노출하지 않는다
      expect(pub).not.toContain('export function readGoldenToken');
      // 토큰은 userData 에만 둔다 — 레포/빌드에 들어가면 안 된다
      expect(pub).toContain("path.join(app.getPath('userData'), 'golden-keyword-token.json')");
    });

    test('renderer 가 부르는 window.electronAPI.invoke 가 실제로 노출돼 있다', () => {
      // 없는 API 를 부르면 에러 없이 조용히 실패한다 — 이름이 맞는지 직접 확인
      const preload = read('electron/preload.js');
      expect(preload).toContain("exposeInMainWorld('electronAPI', electronApiForWindow)");
      expect(preload).toContain('invoke: (channel, ...args) => electron_1.ipcRenderer.invoke(channel, ...args)');
      // electronAPI 는 electronApi 를 펼쳐 담기 때문에 invoke 가 따라온다
      expect(preload).toMatch(/const electronApiForWindow = \{[\s\S]*?\.\.\.electronApi,/);
    });

    test('배포 원본 파일과 발행 스크립트가 존재한다', () => {
      const data = JSON.parse(read('data/golden-keyword.json'));
      expect(Array.isArray(data.items)).toBe(true);
      expect(data).toHaveProperty('reportDate');
      expect(data).toHaveProperty('updatedAt');

      const pkg = JSON.parse(read('package.json'));
      expect(pkg.scripts['golden:publish']).toBe('node scripts/publish-golden-keyword.js');

      const script = read('scripts/publish-golden-keyword.js');
      // 작업 중인 다른 변경이 딸려 올라가면 안 된다 — 경로를 명시해 커밋
      expect(script).toContain('git commit -m "${message}" -- ${REL_PATH}');
      // 빈 목록 배포는 사용자 화면을 비운다
      expect(script).toContain('if (data.items.length === 0)');
    });
  });
});
