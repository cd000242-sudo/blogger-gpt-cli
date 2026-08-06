/**
 * v3.8.463 — 라이선스 배지가 "영구제"로 박혀 있던 문제
 *
 * 사용자 지적: "최상단 라이선스 영구제로 하드코딩되어있어 코드기간별로 뜨게해줘
 * 얼마나남았는지 날짜계산도되어야해".
 *
 * 원인은 두 겹이었다.
 *   ① index.html 헤더 배지의 초기값이 '영구제' 문자열이었다.
 *   ② 갱신 함수(settings.js loadLicenseInfo)가 IPC 응답을 잘못 읽었다 —
 *      read-license-file 은 `{ ok, data }` 를 주는데 `result.license` 를 봤다.
 *      항상 undefined → "라이선스 없음" 분기 → 거기서도 '영구제'로 되돌렸다.
 *      실패·에러 분기 세 곳이 전부 '영구제' 기본값이라 무슨 일이 있어도 영구제였다.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'electron/ui/index.html'), 'utf-8');
const settings = fs.readFileSync(path.join(root, 'electron/ui/modules/settings.js'), 'utf-8');
const mainMod = fs.readFileSync(path.join(root, 'electron/ui/modules/main.js'), 'utf-8');
const script = fs.readFileSync(path.join(root, 'electron/ui/script.js'), 'utf-8');

describe('① 하드코딩 제거', () => {
  it('⭐⭐ 헤더 배지가 열릴 때부터 영구제라고 적혀 있지 않다', () => {
    const badge = html.match(/<span id="licenseStatus"[^>]*>([^<]*)<\/span>/);
    expect(badge).not.toBeNull();
    expect(badge![1]).not.toContain('영구제');
  });

  it('⭐⭐ licenseStatus 엘리먼트는 실제로 존재한다 (없는 id 를 쓰면 조용히 죽는다)', () => {
    expect(html).toContain('id="licenseStatus"');
  });

  it('⭐⭐ 실패·에러 분기가 더 이상 영구제로 되돌리지 않는다', () => {
    const fn = settings.slice(
      settings.indexOf('export async function loadLicenseInfo()'),
      settings.indexOf('export function daysUntil('),
    );
    expect(fn.length).toBeGreaterThan(100);
    expect(fn).not.toContain("'영구제'");
  });
});

describe('② IPC 응답을 올바른 키로 읽는다', () => {
  it('⭐⭐ read-license-file 은 data 로 읽는다 (없는 키를 보면 항상 빈 값이 된다)', () => {
    // 주석에는 사고 경위로 남아 있으므로 코드 형태로 검사한다
    const code = settings.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(code).not.toMatch(/result\.ok\s*&&\s*result\.license/);
    expect(code).not.toMatch(/const\s+license\s*=\s*result\.license/);
    expect(code).toContain('result.ok ? result.data : null');
  });

  it('⭐ 서버 시간 검증을 거친 license-status-new 가 1순위다', () => {
    const primary = settings.indexOf("invoke('license-status-new')");
    const fallback = settings.indexOf('readLicenseFile()');
    expect(primary).toBeGreaterThan(-1);
    expect(fallback).toBeGreaterThan(-1);
    expect(primary).toBeLessThan(fallback);
  });

  it('⭐ 남은 날짜는 서버 시간 기준으로 센다 (로컬 시계 조작·오차 무관)', () => {
    expect(settings).toContain('Number(status.serverTime) || Date.now()');
  });
});

describe('③ 두 갱신 경로가 같은 계산식을 쓴다', () => {
  it('⭐⭐ script.js 헤더 갱신이 buildLicenseLabel 로 위임한다', () => {
    expect(script).toContain("typeof window.buildLicenseLabel === 'function'");
  });

  it('⭐⭐ main.js 가 buildLicenseLabel 을 window 에 노출한다 (안 하면 위임이 조용히 무시된다)', () => {
    expect(mainMod).toContain('window.buildLicenseLabel = buildLicenseLabel;');
    expect(mainMod).toMatch(/import \{[^}]*buildLicenseLabel[^}]*\} from '\.\/settings\.js'/);
  });
});

describe('④ 날짜 계산 — 실제 소스에서 함수를 떼어내 돌린다', () => {
  const src = settings.slice(
    settings.indexOf('export function daysUntil('),
    settings.indexOf('async function readLicenseForDisplay('),
  );
  // eslint-disable-next-line no-eval
  const { daysUntil, buildLicenseLabel } = eval(
    `(() => { ${src.replace(/export function/g, 'function')} return { daysUntil, buildLicenseLabel }; })()`,
  ) as {
    daysUntil: (e: unknown, n?: number) => number | null;
    buildLicenseLabel: (s: unknown, n?: number) => { label: string; color: string };
  };

  const NOW = new Date(2026, 7, 6, 9, 0, 0).getTime(); // 2026-08-06 09:00 (로컬)

  it('⭐⭐ 날짜 경계로 센다 — 같은 날 밤 만료는 0일', () => {
    expect(daysUntil(new Date(2026, 7, 6, 23, 0, 0).getTime(), NOW)).toBe(0);
    expect(daysUntil(new Date(2026, 7, 7, 1, 0, 0).getTime(), NOW)).toBe(1);
    expect(daysUntil(new Date(2026, 8, 5).getTime(), NOW)).toBe(30);
    expect(daysUntil(new Date(2026, 7, 5, 23, 59).getTime(), NOW)).toBe(-1);
  });

  it('⭐ 값이 없거나 이상하면 null (0일로 오해하면 멀쩡한 사용자가 만료로 보인다)', () => {
    expect(daysUntil(null, NOW)).toBeNull();
    expect(daysUntil(undefined, NOW)).toBeNull();
    expect(daysUntil('', NOW)).toBeNull();
    expect(daysUntil('아무말', NOW)).toBeNull();
  });

  it('⭐ ISO 문자열도 epoch 밀리초도 받는다', () => {
    expect(daysUntil('2026-08-16T00:00:00', NOW)).toBe(10);
    expect(daysUntil(new Date(2026, 7, 16).getTime(), NOW)).toBe(10);
  });

  it('⭐⭐ 코드 종류별 문구', () => {
    const at = (y: number, m: number, d: number) => new Date(y, m, d).getTime();
    expect(buildLicenseLabel({ valid: true, type: 'permanent' }, NOW).label).toBe('영구제');
    expect(buildLicenseLabel({ valid: true, type: 'dev' }, NOW).label).toBe('개발자 모드');
    expect(buildLicenseLabel({ valid: true, type: 'temporary', expiresAt: at(2026, 8, 5) }, NOW).label)
      .toBe('기간제 (30일 남음)');
    expect(buildLicenseLabel({ valid: true, type: 'temporary', expiresAt: at(2026, 7, 6) }, NOW).label)
      .toBe('기간제 (오늘 만료)');
    expect(buildLicenseLabel({ valid: false, type: 'temporary', expiresAt: at(2026, 7, 1) }, NOW).label)
      .toBe('만료됨');
    expect(buildLicenseLabel({ valid: false }, NOW).label).toBe('미등록');
  });

  it('⭐ 만료가 다가오면 색이 바뀐다 (7일 이하 빨강, 30일 이하 주황)', () => {
    const at = (d: number) => new Date(2026, 7, d).getTime();
    expect(buildLicenseLabel({ valid: true, type: 'temporary', expiresAt: at(11) }, NOW).color).toBe('#ef4444');
    expect(buildLicenseLabel({ valid: true, type: 'temporary', expiresAt: at(26) }, NOW).color).toBe('#f59e0b');
    expect(buildLicenseLabel({ valid: true, type: 'temporary', expiresAt: new Date(2026, 9, 6).getTime() }, NOW).color).toBe('#10b981');
  });

  it('⭐⭐ 만료일이 없는 유효 라이선스만 영구제로 본다 (모르면 영구제 아니다)', () => {
    expect(buildLicenseLabel({ valid: true, expiresAt: null }, NOW).label).toBe('영구제');
    expect(buildLicenseLabel({ valid: false, expiresAt: null }, NOW).label).toBe('미등록');
  });

  /**
   * v3.8.464 — 무료체험 사용자는 라이선스가 없는 게 정상이다.
   * 그걸 "미등록" 으로 읽으면, 앱을 켤 때는 무료체험으로 뜨다가 환경설정을
   * 한 번 열면 미등록으로 덮이는 일이 생긴다(실제로 그랬다).
   */
  it('⭐⭐ 무료체험이면 라이선스보다 먼저 무료체험으로 표시한다', () => {
    const free = buildLicenseLabel({ isFreeTrial: true, valid: true, quota: { usage: 1, limit: 3 } }, NOW);
    expect(free.label).toBe('🆓 무료체험 (1/3)');
    expect(free.color).toBe('#10b981');
  });

  it('⭐⭐ 3회를 다 쓰면 소진으로 보인다', () => {
    const done = buildLicenseLabel({ isFreeTrial: true, valid: true, quota: { usage: 3, limit: 3 } }, NOW);
    expect(done.label).toBe('🆓 무료체험 (3/3 소진)');
    expect(done.color).toBe('#f59e0b');
  });

  it('⭐ 쿼터 정보가 없어도 무료체험 문구는 나온다', () => {
    expect(buildLicenseLabel({ isFreeTrial: true }, NOW).label).toBe('🆓 무료체험 (0/3)');
  });
});

describe('⑤ 무료체험 배지가 다른 경로에서 덮이지 않는다', () => {
  it('⭐⭐ refreshLicenseStatus 는 쿼터를 먼저 읽고 배지를 만든다', () => {
    const fn = script.slice(
      script.indexOf('async function refreshLicenseStatus()'),
      script.indexOf('async function refreshLicenseStatus()') + 2400,
    );
    const quotaIdx = fn.indexOf('getQuotaStatus()');
    const badgeIdx = fn.indexOf('updateHeaderLicenseStatus(');
    expect(quotaIdx).toBeGreaterThan(-1);
    expect(badgeIdx).toBeGreaterThan(-1);
    // 쿼터를 나중에 읽으면 그 사이에 "미등록" 이 이미 찍혀 버린다
    expect(quotaIdx).toBeLessThan(badgeIdx);
    expect(fn).toContain('isFreeTrial: true, valid: true, quota:');
  });

  it('⭐⭐ 설정 로드 경로도 같은 계산식을 쓴다 (문구가 갈리면 안 된다)', () => {
    const fn = settings.slice(
      settings.indexOf('export async function loadLicenseInfo()'),
      settings.indexOf('export function daysUntil('),
    );
    expect(fn).toContain('buildLicenseLabel({ isFreeTrial: true, quota: quotaStatus.quota })');
    // 호출부에서 문자열을 직접 조립하면 두 경로의 문구가 어긋난다
    expect(fn).not.toContain('🆓 무료체험 (');
  });
});
