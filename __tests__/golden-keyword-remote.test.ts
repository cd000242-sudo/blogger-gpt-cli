const fs = require('fs');
const path = require('path');

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

  describe('배선', () => {
    test('공개 레포의 raw URL 을 읽고, 앱 시작 시 갱신한다', () => {
      const html = read('electron/ui/index.html');
      expect(html).toContain("var GOLDEN_KEYWORD_REMOTE_URL = 'https://raw.githubusercontent.com/cd000242-sudo/blogger-gpt-cli/master/data/golden-keyword.json';");
      // 네트워크가 죽어도 화면이 멈추지 않아야 한다
      expect(html).toContain("cache: 'no-store'");
      expect(html).toContain('GOLDEN_KEYWORD_FETCH_TIMEOUT_MS');
      expect(html).toContain('if (typeof refreshGoldenKeywordFromRemote === \'function\') refreshGoldenKeywordFromRemote();');
    });

    test('편집 저장이 updatedAt 을 남기고 배포 원본에 기록한다', () => {
      const html = read('electron/ui/index.html');
      expect(html).toContain('updatedAt: now,');
      expect(html).toContain("api.invoke('golden-keyword:save-repo-file', payload)");
    });

    test('IPC 는 레포 안의 고정 경로에만 쓰고 배포본에서는 거절한다', () => {
      const mainTs = read('electron/main.ts');
      const mainJs = read('electron/main.js');
      // 렌더러가 임의 경로를 쓰게 두면 안 된다 — 경로는 코드에 고정
      expect(mainTs).toContain("ipcMain.handle('golden-keyword:save-repo-file'");
      expect(mainTs).toContain("path.join(__dirname, '..', 'data', 'golden-keyword.json')");
      expect(mainTs).toContain('if (app.isPackaged) {');
      // .ts 만 고치고 컴파일을 안 하면 배포본은 그대로다 — 컴파일 결과까지 확인
      expect(mainJs).toContain("ipcMain.handle('golden-keyword:save-repo-file'");
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
