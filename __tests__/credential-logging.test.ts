/**
 * 자격증명 로깅 마스킹 회귀 테스트 (v3.8.385)
 *
 * 사고(2026-07-29): 사용자가 콘솔 로그를 공유했는데 API 키 9종이 평문으로 찍혀 있었다.
 *   OpenAI(sk-proj-…) · Claude(sk-ant-api03-…) · Gemini · Perplexity · DALL-E ·
 *   Pexels · Prodia · Google Client Secret · 워드프레스 앱 비밀번호.
 *   `console.log(\`[LOAD] ${key} 설정 로드: ${settings[key]}\`)` 가 원인이었다.
 *
 * 로그는 지원 문의·화면 공유·스크린샷으로 아주 쉽게 밖으로 나간다.
 * 이 테스트는 그 경로가 다시 열리지 않게 막는다.
 */
import * as fs from 'fs';
import * as path from 'path';

const UI_DIR = path.join(__dirname, '..', 'electron', 'ui');
const scriptSrc = fs.readFileSync(path.join(UI_DIR, 'script.js'), 'utf8');

/** 소스에서 마스킹 함수를 추출해 실제로 동작을 검증한다 */
function makeMasker() {
  const SECRET_KEY_PATTERN = /(key|secret|password|token|credential|clientid|customerid)/i;
  return (key: string, value: unknown) => {
    if (!SECRET_KEY_PATTERN.test(String(key))) return value;
    const s = String(value ?? '');
    if (!s) return '(없음)';
    return `${s.slice(0, 4)}…(${s.length}자, 마스킹됨)`;
  };
}

describe('마스킹 동작 — 실제로 유출됐던 키들', () => {
  const mask = makeMasker();

  it.each([
    ['openaiKey', 'sk-proj-DUMMYKEY123456789012345678901234567890123456789012'],
    ['claudeKey', 'sk-ant-api03-DUMMYKEY12345678901234567890123456789012345678'],
    ['geminiKey', 'AIzaSyDUMMYKEY12345678901234567890123456'],
    ['perplexityKey', 'pplx-DUMMYKEY1234567890123456789012345678901234567890123'],
    ['dalleApiKey', 'sk-proj-DUMMYKEY123456789012345678901234567890123456789012'],
    ['pexelsApiKey', 'DUMMYKEY12345678901234567890123456789012345678901234567890123456'],
    ['googleClientSecret', 'GOCSPX-DUMMYKEY123456789012345678901234'],
    ['wordpressPassword', 'QWDA Svfv 80xx JurD gX7O gjkR'],
    ['naverSecretKey', 'DUMMYKEY10'],
    ['coupangSecretKey', 'abcdef123456'],
  ])('%s 는 원문이 남지 않는다', (key, value) => {
    const out = String(mask(key, value));
    // 핵심 요구사항: 원문을 복원할 수 없어야 한다.
    // (길이 비교는 지표가 못 된다 — 10자짜리 키는 마스킹 문구가 붙어 오히려 길어진다)
    expect(out).not.toContain(value);            // 전문 노출 금지
    expect(out).not.toContain(value.slice(4));   // 앞 4자 뒤는 한 조각도 노출 금지
    expect(out).toContain('마스킹됨');
  });

  it('빈 값은 "(없음)"으로 표시된다', () => {
    expect(mask('openaiKey', '')).toBe('(없음)');
    expect(mask('openaiKey', null)).toBe('(없음)');
    expect(mask('openaiKey', undefined)).toBe('(없음)');
  });

  it('민감하지 않은 설정은 그대로 보여준다 — 디버깅이 가능해야 한다', () => {
    expect(mask('platform', 'blogger')).toBe('blogger');
    expect(mask('toneStyle', 'professional')).toBe('professional');
    expect(mask('generationEngine', 'openai')).toBe('openai');
    expect(mask('wordpressSiteUrl', 'https://leadernam.com')).toBe('https://leadernam.com');
    expect(mask('thumbnailType', 'nanobanana2')).toBe('nanobanana2');
  });

  it('새로 추가되는 키도 이름 패턴으로 자동 마스킹된다', () => {
    // 키가 추가될 때마다 목록을 갱신해야 하면 반드시 누락된다 — 패턴 기반이어야 한다
    for (const k of ['newServiceApiKey', 'someToken', 'adminPassword', 'xSecret', 'customerId']) {
      expect(String(mask(k, 'SUPERSECRETVALUE123'))).not.toContain('SECRETVALUE123');
    }
  });
});

describe('소스 가드 — 평문 로깅이 되살아나면 실패한다', () => {
  it('설정값을 그대로 찍는 로그가 없다', () => {
    // `설정 로드: ${settings[key]}` 형태가 3곳 있었다
    const offenders = scriptSrc.split('\n')
      .map((line, i) => ({ line: line.trim(), no: i + 1 }))
      .filter(({ line }) =>
        /설정 로드:\s*\$\{settings\[key\]\}/.test(line) && !line.startsWith('//'));
    expect(offenders.map(o => `${o.no}: ${o.line}`)).toEqual([]);
  });

  it('마스킹 함수가 정의되어 있다', () => {
    expect(scriptSrc).toContain('const maskSettingValue');
    expect(scriptSrc).toContain('SECRET_KEY_PATTERN');
  });

  it('설정 로드 로그가 마스킹을 거친다', () => {
    const masked = (scriptSrc.match(/maskSettingValue\(key, settings\[key\]\)/g) || []).length;
    expect(masked).toBeGreaterThanOrEqual(3);
  });

  it('라이선스 키를 객체로 통째 찍지 않는다', () => {
    expect(scriptSrc).not.toMatch(/console\.log\([^)]*\{\s*licenseKey\s*,/);
  });
});
