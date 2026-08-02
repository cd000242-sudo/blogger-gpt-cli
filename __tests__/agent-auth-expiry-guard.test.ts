/**
 * 안전망 — Agent 인증 만료(리프레시 토큰 무효화) 처리 (v3.8.382)
 *
 * 배경 (사용자 실측 2026-07-26 연속발행):
 *   OpenAI가 리프레시 토큰을 서버측에서 무효화하자 큐 항목이 실패했는데,
 *   ① 재로그인 안내가 나가지 않았고 ② 큐가 남은 항목을 계속 실행했다.
 *
 * 원인: 사전 점검은 `codex login status`(로컬 auth 파일 판독)라 서버측 무효화를 감지할 수 없다.
 *   실제 실행에서만 드러나는데, 그때 나오는 문구
 *   ("Your access token could not be refreshed. Please log out and sign in again.")가
 *   인증 실패 정규식에 걸리지 않았다 — "please log **out**"이라 "please log in" 패턴 밖.
 *
 * 설계 제약: 사전 점검을 `codex exec`로 바꾸면 모델 턴이 과금된다.
 *   agent-login-session-regression.test.ts가 그 방향을 명시적으로 금지하므로,
 *   명령은 그대로 두고 **분류·전파·중단**만 고친다.
 */

import * as fs from 'fs';
import * as path from 'path';
import { braceBlock } from './helpers/source-block';

const REPO = path.resolve(__dirname, '..');
const mainSource = fs.readFileSync(path.join(REPO, 'electron', 'main.ts'), 'utf8');
const queueSource = fs.readFileSync(path.join(REPO, 'electron', 'ui', 'modules', 'publish-queue.js'), 'utf8');
const workshopSource = fs.readFileSync(path.join(REPO, 'electron', 'ui', 'modules', 'codex-workshop.js'), 'utf8');

/** 사용자가 실제로 본 문구들 — 전부 인증 실패로 분류되어야 한다 */
const REAL_EXPIRY_MESSAGES = [
  'Your access token could not be refreshed. Please log out and sign in again.',
  'Could not validate your refresh token. Please try signing in again.',
  'invalid_refresh_token',
  'token_expired',
  'Provided authentication token is expired. Please try signing in again.',
];

/** main.ts에서 정규식 리터럴을 추출해 실제로 평가한다 (문자열 포함 검사가 아니라 동작 검증) */
function extractRegex(name: string): RegExp {
  const line = mainSource.split('\n').find(l => l.includes(`const ${name} =`));
  if (!line) throw new Error(`${name} 정규식을 찾지 못했습니다`);
  const body = line.slice(line.indexOf('=') + 1).trim().replace(/;$/, '');
  // eslint-disable-next-line no-eval
  return eval(body) as RegExp;
}

describe('인증 만료 문구 분류 (v3.8.382)', () => {
  it.each(REAL_EXPIRY_MESSAGES)('CODEX_AUTH_REQUIRED_RE가 "%s" 를 인증 실패로 분류한다', (msg) => {
    expect(extractRegex('CODEX_AUTH_REQUIRED_RE').test(msg)).toBe(true);
  });

  it.each(REAL_EXPIRY_MESSAGES)('AGENT_AUTH_REQUIRED_RE가 "%s" 를 인증 실패로 분류한다', (msg) => {
    expect(extractRegex('AGENT_AUTH_REQUIRED_RE').test(msg)).toBe(true);
  });

  it('정상 실행 로그를 인증 실패로 오분류하지 않는다', () => {
    const benign = [
      'Generated 8000 characters successfully',
      'thread.started',
      '본문 생성 완료',
    ];
    const codex = extractRegex('CODEX_AUTH_REQUIRED_RE');
    benign.forEach(s => expect(codex.test(s)).toBe(false));
  });
});

describe('인증 실패 전파 (v3.8.382)', () => {
  it('run-job 실패 응답이 authRequired를 실어 보낸다', () => {
    const idx = mainSource.indexOf('if (!hasContent) {');
    expect(idx).toBeGreaterThan(-1);
    const block = braceBlock(mainSource, 'if (!hasContent) {');
    expect(block).toContain('authRequired');
    expect(block).toContain("updateAgentProfileStatus(profile.id, 'needs-login')");
  });

  it('runAgentJob이 authRequired를 전역 신호로 남긴다', () => {
    expect(workshopSource).toContain('__agentAuthRevoked');
  });
});

describe('큐 중단 동작 (v3.8.382)', () => {
  it('큐 루프가 인증 만료 시 남은 항목을 중단한다', () => {
    expect(queueSource).toMatch(/if \(window\.__agentAuthRevoked\)/);
    const idx = queueSource.indexOf('if (window.__agentAuthRevoked)');
    const block = braceBlock(queueSource, 'if (window.__agentAuthRevoked)');
    expect(block).toContain('break');
    expect(block).toMatch(/재로그인/);
  });

  it('큐 시작 시 이전 실행의 플래그를 초기화한다 (재로그인 후 재시작 가능)', () => {
    expect(queueSource).toMatch(/window\.__agentAuthRevoked\s*=\s*false/);
  });
});

describe('기존 정책 보존 — 무과금 status 명령 유지 (v3.8.382)', () => {
  it('사전 점검은 여전히 login/auth status를 쓴다 (모델 턴 과금 금지)', () => {
    expect(mainSource).toContain("args: ['login', 'status']");
    expect(mainSource).toContain("args: ['auth', 'status']");
    expect(mainSource).not.toContain("args: ['exec', '--json', '--sandbox', 'read-only', '--skip-git-repo-check', prompt]");
  });
});
