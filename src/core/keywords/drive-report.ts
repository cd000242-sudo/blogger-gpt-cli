/**
 * ☁️ 고단가 키워드 리포트를 구글 드라이브에서 직접 읽어 온다 (v3.8.634)
 *
 * ## 왜 만들었나
 * 사장님: "너가 읽고 자동으로 뜨게해줘야지 내가 수동으로 할꺼면
 *          그냥 드라이브열고 보는게낫지"
 *
 * 맞는 말이다. 앞 판(v3.8.631)은 **폴더 경로를 설정에 적고 파일을 거기 갖다 놓으면**
 * 읽어 주는 물건이었다. 그건 자동화가 아니라 심부름 시키기다.
 * 리포트는 클로드 코드가 매일 드라이브에 만든다 — 앱이 거기서 바로 가져와야 한다.
 *
 * ## 드라이브에 무엇이 있나 (2026-09-05 실측)
 * 폴더 하나에 매일 두 벌이 쌓인다:
 *   · `2026-09-04 고CPC 키워드 리포트`               (구글 문서)
 *   · `2026-09-04 고CPC 키워드 리포트 (원문 md 백업)` (text/markdown)
 *
 * md 백업이 있으면 **그쪽을 쓴다.** 우리 파서가 마크다운 표를 읽는데,
 * 구글 문서는 내보낼 때 표·제목 서식이 흔들릴 수 있기 때문이다.
 * 없는 날에는 구글 문서를 `text/markdown` 으로 내보내 받는다.
 *
 * ## 원칙
 * 조용히 실패하지 않는다. 못 찾으면 못 찾았다고, 찾았는데 못 읽으면
 * 못 읽었다고 이유를 돌려준다 — 화면이 그냥 비어 있으면 사장님은
 * 앱이 고장 났는지 리포트가 아직 안 나왔는지 알 수가 없다.
 */

/**
 * 리포트 이름 규칙 — 앞에 날짜, 뒤에 「키워드 리포트」.
 *
 * v3.8.643: 가운데 말은 못박지 않는다. 사장님이 생성기를 올리면서 이름이 바뀌었다.
 *   「2026-09-04 **고CPC** 키워드 리포트」
 *   「2026-09-05 **네이버 상위노출** 키워드 리포트 (v5 시범)」
 * 「고CPC」로 못박아 뒀더니 새 리포트를 아예 못 찾았다.
 */
const REPORT_NAME_RE = /^(\d{4}-\d{2}-\d{2})\s*[^\n]*키워드\s*리포트/;

/** 드라이브 검색에 쓸 이름 조각 — 넓게 찾고, 고르는 건 아래에서 한다 */
export const REPORT_NAME_HINT = '키워드 리포트';

/** 같은 날 여러 개면 이걸 먼저 쓴다 (v3.8.644 — 사장님이 쓰기로 한 리포트) */
export const PREFERRED_NAME = /네이버\s*상위노출/;

const DOC_MIME = 'application/vnd.google-apps.document';
const MD_MIME = 'text/markdown';

export interface DriveCreds {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}

export interface DriveReport {
  id: string;
  name: string;
  /** 이름에서 읽은 날짜 (YYYY-MM-DD) */
  date: string;
  markdown: string;
}

type FetchLike = (url: string, init?: any) => Promise<any>;

function theFetch(custom?: FetchLike): FetchLike {
  const f = custom || (globalThis as any).fetch;
  if (typeof f !== 'function') throw new Error('이 환경에는 fetch 가 없습니다');
  return f;
}

/**
 * 리프레시 토큰으로 액세스 토큰을 받아 온다.
 *
 * 액세스 토큰은 한 시간이면 죽으므로 저장하지 않고 쓸 때마다 받는다 —
 * 만료된 토큰을 캐시했다가 조용히 401 을 맞는 쪽이 더 나쁘다.
 */
export async function getAccessToken(creds: DriveCreds, customFetch?: FetchLike): Promise<string> {
  const { clientId, clientSecret, refreshToken } = creds || ({} as DriveCreds);
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('구글 드라이브 연결 정보가 없습니다 (클라이언트 ID·시크릿·리프레시 토큰)');
  }

  const res = await theFetch(customFetch)('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });

  const data = await res.json();
  if (!data?.access_token) {
    // invalid_grant = 사용자가 권한을 뺐거나 토큰이 폐기됐다. 다시 연결해야 한다
    const why = data?.error_description || data?.error || '알 수 없는 이유';
    throw new Error(`드라이브 인증 갱신 실패: ${why}`);
  }
  return String(data.access_token);
}

/** 파일 이름에서 리포트 날짜를 읽는다. 리포트가 아니면 빈 문자열 */
export function reportDateOf(name: string): string {
  const m = REPORT_NAME_RE.exec(String(name || '').trim());
  return m?.[1] || '';
}

/** 원문 md 백업인가 — 이쪽이 우리 파서에 더 잘 맞는다 */
function isMarkdownBackup(file: DriveFile): boolean {
  return file.mimeType === MD_MIME || /원문\s*md\s*백업/.test(file.name || '');
}

/**
 * 여러 파일 중 **오늘치 한 벌**을 고른다.
 *
 * 날짜가 가장 늦은 것을 고르고, 같은 날짜에 두 벌이 있으면 md 백업을 쓴다.
 * 이름에 날짜가 없는 파일(장부·아카이브 등)은 아예 후보에서 뺀다 —
 * 같은 폴더에 매일 열 몇 개가 같이 쌓이기 때문이다.
 */
/** 「… (원문 md 백업)」에서 앞의 본 이름만 */
function baseName(name: string): string {
  return String(name || '').replace(/\s*\(원문\s*md\s*백업\)\s*$/, '').trim();
}

export function pickBestReport(files: DriveFile[]): DriveFile | null {
  const dated = (files || [])
    .map((f) => ({ file: f, date: reportDateOf(f.name) }))
    .filter((x) => x.date);
  if (dated.length === 0) return null;

  const newest = dated.reduce((a, b) => (b.date > a.date ? b : a)).date;
  const allSameDay = dated.filter((x) => x.date === newest).map((x) => x.file);

  /**
   * v3.8.644 — 「네이버 상위노출」 리포트를 먼저 본다.
   *
   * 사장님: "이제 네이버 상위노출 키워드 리포트를 찾으면되"
   *
   * 이름으로 고른다. 시각으로만 고르면 어느 날 옛 리포트가 더 늦게 올라오는
   * 순간 조용히 그쪽으로 넘어간다 — 사장님은 왜 옛 키워드가 뜨는지 모른다.
   * 다만 못박지는 않는다. 그날 새 리포트가 없으면 있는 것이라도 보여 주는 편이
   * 화면이 텅 비는 것보다 낫다.
   */
  const preferred = allSameDay.filter((f) => PREFERRED_NAME.test(f.name || ''));
  const sameDay = preferred.length ? preferred : allSameDay;

  /**
   * v3.8.643 — 같은 날 리포트가 둘 이상일 수 있다.
   *
   * 실측 2026-09-05: 01:03 「고CPC 키워드 리포트」, 05:30 「네이버 상위노출 키워드 리포트 (v5 시범)」.
   * 사장님이 생성기를 올린 날은 옛 리포트와 새 리포트가 같은 날에 나란히 있는다.
   * **가장 최근에 올라온 것**이 사장님이 쓰려는 것이다.
   *
   * 그리고 그 리포트의 md 원문이 따로 있으면 그쪽을 쓴다 — 다른 리포트의
   * md 원문을 집으면 더 오래된 것으로 되돌아간다(예전 규칙의 구멍이었다).
   */
  const newestFirst = [...sameDay].sort(
    (a, b) => String(b.modifiedTime || '').localeCompare(String(a.modifiedTime || '')),
  );
  const head = newestFirst[0];
  if (!head) return null;

  const twin = newestFirst.find(
    (f) => f !== head && isMarkdownBackup(f) && baseName(f.name) === baseName(head.name),
  );
  return twin || (isMarkdownBackup(head) ? head : newestFirst.find(
    (f) => isMarkdownBackup(f) && baseName(f.name) === baseName(head.name),
  ) || head);
}

/** 드라이브에서 리포트 후보를 찾는다 */
export async function listReportFiles(
  accessToken: string,
  customFetch?: FetchLike,
): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    q: `name contains '${REPORT_NAME_HINT}' and trashed = false`,
    orderBy: 'modifiedTime desc',
    pageSize: '20',
    fields: 'files(id,name,mimeType,modifiedTime)',
  });

  const res = await theFetch(customFetch)(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  const data = await res.json();
  if (data?.error) {
    throw new Error(`드라이브 검색 실패: ${data.error.message || '알 수 없는 오류'}`);
  }
  return Array.isArray(data?.files) ? data.files : [];
}

/** 고른 파일의 내용을 마크다운으로 받아 온다 */
export async function downloadReport(
  accessToken: string,
  file: DriveFile,
  customFetch?: FetchLike,
): Promise<string> {
  const url =
    file.mimeType === DOC_MIME
      ? `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=${encodeURIComponent(MD_MIME)}`
      : `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;

  const res = await theFetch(customFetch)(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();

  // 실패해도 200 이 아닌 본문이 JSON 으로 오는 경우가 있다
  if (text.trim().startsWith('{') && /"error"\s*:/.test(text)) {
    throw new Error(`리포트를 내려받지 못했습니다: ${file.name}`);
  }
  return text;
}

/**
 * 한 번에: 토큰 갱신 → 검색 → 고르기 → 내려받기.
 *
 * 못 찾으면 null 을 준다(아직 안 만들어진 날). 그 외의 실패는 던진다 —
 * 화면이 이유를 말해 줘야 사장님이 앱 탓인지 리포트 탓인지 안다.
 */
export async function fetchLatestDriveReport(
  creds: DriveCreds,
  customFetch?: FetchLike,
): Promise<DriveReport | null> {
  const token = await getAccessToken(creds, customFetch);
  const files = await listReportFiles(token, customFetch);
  const best = pickBestReport(files);
  if (!best) return null;

  const markdown = await downloadReport(token, best, customFetch);
  return { id: best.id, name: best.name, date: reportDateOf(best.name), markdown };
}
