const fs = require('fs');
const path = require('path');

import {
  reportDateOf,
  pickBestReport,
  getAccessToken,
  listReportFiles,
  downloadReport,
  fetchLatestDriveReport,
  type DriveFile,
} from '../src/core/keywords/drive-report';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/** 표식 사이만 자른다 — 고정 길이 slice 는 코드가 몇 줄만 밀려도 헛것을 검사한다 */
function blockBetween(source: string, startMarker: string, endMarker: string): string {
  const from = source.indexOf(startMarker);
  if (from === -1) throw new Error('시작 표시를 못 찾음: ' + startMarker);
  const to = source.indexOf(endMarker, from + startMarker.length);
  return to === -1 ? source.slice(from) : source.slice(from, to);
}

/** fetch 흉내 — 부른 주소를 남긴다 */
function fakeFetch(routes: { match: RegExp; json?: any; text?: string }[]) {
  const calls: string[] = [];
  const impl = async (url: string, init?: any) => {
    calls.push(url);
    const hit = routes.find((r) => r.match.test(url));
    if (!hit) throw new Error('예상 못 한 주소: ' + url);
    return {
      json: async () => hit.json,
      text: async () => (typeof hit.text === 'string' ? hit.text : JSON.stringify(hit.json)),
      _init: init,
    } as any;
  };
  return { impl, calls };
}

/*
 * v3.8.634 — 리포트를 드라이브에서 직접 읽는다.
 *
 * 사장님: "너가 읽고 자동으로 뜨게해줘야지 내가 수동으로 할꺼면
 *          그냥 드라이브열고 보는게낫지 인마.."
 *
 * v3.8.631 은 폴더 경로를 설정에 적고 파일을 갖다 놓아야 읽었다.
 * 그건 자동화가 아니라 심부름이다. 리포트는 매일 드라이브에 만들어진다.
 */
describe('v3.8.634 드라이브에서 리포트 가져오기', () => {
  const 문서 = 'application/vnd.google-apps.document';

  describe('어느 파일이 오늘치인가', () => {
    /** 같은 폴더에 매일 열 몇 개(장부·아카이브)가 같이 쌓인다 */
    const 폴더: DriveFile[] = [
      { id: 'a', name: '키워드 장부 2026-09-05 (13/13) 학습·카테고리', mimeType: 문서 },
      { id: 'b', name: '2026-09-04 고CPC 키워드 리포트', mimeType: 문서 },
      { id: 'c', name: '2026-09-05 고CPC 키워드 리포트', mimeType: 문서 },
      { id: 'd', name: '2026-09-05 고CPC 키워드 리포트 (원문 md 백업)', mimeType: 'text/markdown' },
    ];

    test('이름 앞 날짜를 읽는다', () => {
      expect(reportDateOf('2026-09-05 고CPC 키워드 리포트')).toBe('2026-09-05');
      expect(reportDateOf('2026-09-05 고CPC 키워드 리포트 (원문 md 백업)')).toBe('2026-09-05');
    });

    /** 장부를 리포트로 착각하면 엉뚱한 걸 읽고 슬롯 0개로 조용히 빈다 */
    test('리포트가 아닌 파일은 후보에서 뺀다', () => {
      expect(reportDateOf('키워드 장부 2026-09-05 (13/13) 학습')).toBe('');
      expect(reportDateOf('아무 문서')).toBe('');
    });

    test('가장 최근 날짜를 고른다', () => {
      expect(pickBestReport(폴더)!.name).toContain('2026-09-05');
    });

    /** 구글 문서는 내보낼 때 표 서식이 흔들릴 수 있다 — 원문이 있으면 원문을 쓴다 */
    test('같은 날짜에 두 벌이면 md 원문을 쓴다', () => {
      expect(pickBestReport(폴더)!.id).toBe('d');
    });

    test('md 원문이 없으면 구글 문서를 쓴다', () => {
      const 문서만 = 폴더.filter((f) => f.id !== 'd');
      expect(pickBestReport(문서만)!.id).toBe('c');
    });

    test('리포트가 하나도 없으면 null — 없는 걸 있다고 하지 않는다', () => {
      expect(pickBestReport([폴더[0]!])).toBeNull();
      expect(pickBestReport([])).toBeNull();
    });
  });

  describe('토큰 갱신', () => {
    test('리프레시 토큰으로 액세스 토큰을 받는다', async () => {
      const f = fakeFetch([{ match: /oauth2\.googleapis\.com/, json: { access_token: 'AT-1' } }]);
      const token = await getAccessToken(
        { clientId: 'c', clientSecret: 's', refreshToken: 'r' },
        f.impl,
      );
      expect(token).toBe('AT-1');
    });

    /** 권한을 뺐거나 토큰이 폐기되면 다시 연결해야 한다 — 조용히 빈 화면이 되면 안 된다 */
    test('갱신이 실패하면 이유를 말한다', async () => {
      const f = fakeFetch([
        { match: /oauth2/, json: { error: 'invalid_grant', error_description: '토큰이 폐기됨' } },
      ]);
      await expect(
        getAccessToken({ clientId: 'c', clientSecret: 's', refreshToken: 'r' }, f.impl),
      ).rejects.toThrow('토큰이 폐기됨');
    });

    test('연결 정보가 없으면 부르기 전에 막는다', async () => {
      await expect(getAccessToken({ clientId: '', clientSecret: '', refreshToken: '' })).rejects
        .toThrow('연결 정보가 없습니다');
    });
  });

  describe('내려받기 — 갈래마다 주소가 다르다', () => {
    test('구글 문서는 마크다운으로 내보내 받는다', async () => {
      const f = fakeFetch([{ match: /export/, text: '# 리포트' }]);
      const out = await downloadReport('AT', { id: 'x', name: 'n', mimeType: 문서 }, f.impl);
      expect(out).toBe('# 리포트');
      expect(f.calls[0]).toContain('/export?mimeType=text%2Fmarkdown');
    });

    /** md 파일에 export 를 걸면 400 이 온다 — 갈래를 봐야 한다 */
    test('md 파일은 그대로 받는다', async () => {
      const f = fakeFetch([{ match: /alt=media/, text: '# 리포트' }]);
      await downloadReport('AT', { id: 'x', name: 'n', mimeType: 'text/markdown' }, f.impl);
      expect(f.calls[0]).toContain('alt=media');
      expect(f.calls[0]).not.toContain('export');
    });

    test('본문 자리에 오류가 오면 알아챈다', async () => {
      const f = fakeFetch([{ match: /alt=media/, text: '{"error": {"message": "권한 없음"}}' }]);
      await expect(
        downloadReport('AT', { id: 'x', name: '리포트', mimeType: 'text/markdown' }, f.impl),
      ).rejects.toThrow('내려받지 못했습니다');
    });
  });

  describe('검색', () => {
    test('이름 조각으로 찾고 최신순으로 받는다', async () => {
      const f = fakeFetch([{ match: /drive\/v3\/files\?/, json: { files: [] } }]);
      await listReportFiles('AT', f.impl);
      // URLSearchParams 는 공백을 + 로 적는다 (드라이브가 받는 표준 꼴)
      const asked = decodeURIComponent(f.calls[0]!).replace(/\+/g, ' ');
      // v3.8.643: 가운데 말을 못박지 않는다 — 「고CPC」 로 두었더니
      //   「네이버 상위노출 키워드 리포트」 를 아예 못 찾았다. 고르는 건 pickBestReport 가 한다.
      expect(asked).toContain('키워드 리포트');
      expect(asked).toContain('trashed = false');
      expect(f.calls[0]).toContain('orderBy=modifiedTime+desc');
    });

    test('드라이브가 오류를 주면 던진다', async () => {
      const f = fakeFetch([{ match: /files\?/, json: { error: { message: 'Drive API 꺼짐' } } }]);
      await expect(listReportFiles('AT', f.impl)).rejects.toThrow('Drive API 꺼짐');
    });
  });

  describe('한 번에 가져오기', () => {
    test('토큰 → 검색 → 고르기 → 내려받기', async () => {
      const f = fakeFetch([
        { match: /oauth2/, json: { access_token: 'AT' } },
        {
          match: /files\?/,
          json: { files: [{ id: 'r1', name: '2026-09-05 고CPC 키워드 리포트', mimeType: 문서 }] },
        },
        { match: /export/, text: '# 2026-09-05 리포트' },
      ]);
      const got = await fetchLatestDriveReport({ clientId: 'c', clientSecret: 's', refreshToken: 'r' }, f.impl);
      expect(got!.date).toBe('2026-09-05');
      expect(got!.markdown).toContain('리포트');
    });

    /** 아직 안 만들어진 날이 있다 — 그건 오류가 아니다 */
    test('리포트가 없으면 null', async () => {
      const f = fakeFetch([
        { match: /oauth2/, json: { access_token: 'AT' } },
        { match: /files\?/, json: { files: [{ id: 'z', name: '키워드 장부 2026-09-05', mimeType: 문서 }] } },
      ]);
      expect(await fetchLatestDriveReport({ clientId: 'c', clientSecret: 's', refreshToken: 'r' }, f.impl))
        .toBeNull();
    });
  });

  /*
   * v3.8.711: 고CPC 카드·IPC 삭제 (사장님: "고단가 CPC 그자리 없애버리고 다른거넣거나 비워두자").
   * 위의 드라이브 읽기 모듈(src/core/keywords/drive-report.ts) 단위 검사는 모듈이 남아 있는 동안
   * 유지한다 — 되살릴 때 그대로 쓴다. 앱 배선 검사는 배선과 함께 내렸고, 여기서는
   * **반쯤 남은 배선(조용한 고장의 씨앗)이 없는지**와 계정이 코드에 새지 않았는지만 잰다.
   */
  describe('v3.8.711 앱 배선이 깨끗이 내려갔다', () => {
    const main = read('electron/main.ts');
    const ui = read('electron/ui/index.html');

    test('메인에 드라이브 리포트 IPC·헬퍼가 없다', () => {
      expect(main).not.toContain("ipcMain.handle('drive:connect'");
      expect(main).not.toContain("ipcMain.handle('keywords:latest-report'");
      expect(main).not.toContain('loadReportFromDrive');
      expect(main).not.toContain('GOOGLE_DRIVE_REFRESH_TOKEN');
    });

    test('화면에 카드 배선이 없다', () => {
      expect(ui).not.toContain('function connectCpcDrive(');
      expect(ui).not.toContain('function startCpcReportWatch(');
      expect(ui).not.toContain('window.__cpcDriveFileId');
    });

    test('계정·경로가 코드에 박혀 있지 않다 — asar 는 누구나 연다', () => {
      expect(main).not.toContain('cd000242@gmail.com');
      expect(main).not.toMatch(/drive\.google\.com|folders\/[A-Za-z0-9_-]{20,}/);
    });
  });
});
