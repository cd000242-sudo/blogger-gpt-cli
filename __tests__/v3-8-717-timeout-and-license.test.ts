/**
 * 제한시간 때문에 글도 못 쓰고 앱에도 못 들어가던 문제 (v3.8.717)
 *
 * 같은 날 두 가지가 터졌는데 원인이 같았다 — **기다리는 시간이 너무 짧았다.**
 *   · 발행: `timeout of 90000ms exceeded` (model=gpt-6-astra) 2회 → 글 생성 실패
 *   · 로그인: "서버 인증에 실패했습니다" → 실측 결과 라이선스 서버가 145초까지 늘어졌고
 *             앱은 15초에서 끊고 있었다 (서버는 살아 있었다)
 *
 * 사장님: "제한시간에 맞춰 늘려주고 2번도 같이해"
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

describe('① 느린 추론 모델만 오래 기다린다', () => {
  const src = read('src/core/llm/llm-caller.ts');

  it('⭐⭐ 제한시간을 모델이 정한다 (박아 둔 90초 하나로 끝내지 않는다)', () => {
    expect(src).toMatch(/function resolveCallTimeout\(config: LLMProviderConfig, model: string\): number/);
    expect(src).toMatch(/timeout: callTimeout/);
  });

  it('⭐⭐ 느린 모델은 240초, 빠른 모델은 그대로 — 실제로 갈라지는지 값으로 확인', () => {
    const SLOW = /astra|sol\b|^o\d|fable|opus/i;
    const slowTimeout = 240_000;
    const pick = (model: string, base: number) => (SLOW.test(model) ? Math.max(base, slowTimeout) : base);

    expect(pick('gpt-6-astra', 90_000)).toBe(240_000);
    expect(pick('gpt-5.6-sol', 90_000)).toBe(240_000);
    expect(pick('claude-fable-5', 90_000)).toBe(240_000);
    // 빠른 모델은 건드리지 않는다 — 진짜 장애일 때 4분을 기다리게 하면 안 된다
    expect(pick('gpt-5.6-luna', 90_000)).toBe(90_000);
    expect(pick('gpt-5.6-terra', 90_000)).toBe(90_000);
    expect(pick('sonar', 60_000)).toBe(60_000);
  });

  it('⭐ 환경변수로 덮을 수 있다 (10초 미만은 무시)', () => {
    expect(src).toContain("Number(process.env['LLM_TIMEOUT_MS']");
    expect(src).toMatch(/override >= 10_000/);
  });
});

describe('② 시간초과일 때만 같은 회사의 빠른 모델로 한 번 내려간다', () => {
  const src = read('src/core/llm/llm-caller.ts');

  it('⭐⭐ 대체는 시간초과 한 가지에만 열린다', () => {
    expect(src).toMatch(/if \(lastKind === 'timeout' && !downgraded\)/);
  });

  it('⭐⭐ 인증·결제·쿼터·레이트리밋은 예전 그대로 즉시 실패 (키가 죽은 걸 감추지 않는다)', () => {
    const stop = src.slice(src.indexOf('function shouldStopModelChain'), src.indexOf('function buildProviderError'));
    for (const kind of ['auth', 'billing', 'quota', 'rate_limit']) {
      expect(stop).toContain(kind);
    }
    expect(src).toMatch(/if \(shouldStopModelChain\(kind\)\) \{\s*throw lastError;/);
  });

  it('⭐⭐ 다른 회사로는 절대 안 넘어간다 — 표의 모든 대체가 같은 회사 안에 있다', () => {
    const table = src.slice(src.indexOf('const FASTER_SIBLING'), src.indexOf('function fasterSiblingOf'));
    expect(table).toContain("'gpt-6-astra': 'gpt-5.6-luna'");
    // openai 칸에 claude/sonar 가, claude 칸에 gpt 가 섞여 있으면 회사를 넘는 것이다
    const block = (name: string) => {
      const start = table.indexOf(`${name}: {`);
      return table.slice(start, table.indexOf('}', start));
    };
    expect(block('openai')).not.toMatch(/claude|sonar/);
    expect(block('claude')).not.toMatch(/gpt|sonar/);
    expect(block('perplexity')).not.toMatch(/gpt|claude/);
  });

  it('⭐ 한 번만 내려가고, 같은 모델을 두 번 돌리지 않는다', () => {
    expect(src).toMatch(/downgraded = true/);
    expect(src).toMatch(/faster && !tried\.has\(faster\)/);
  });

  it('⭐ 조용히 바꾸지 않는다 — 로그와 장부에 남긴다', () => {
    expect(src).toContain('recordDowngrade');
    expect(src).toMatch(/__llmDowngrades/);
  });
});

describe('③ 서버가 느리다고 영구제 사용자를 잠그지 않는다', () => {
  const src = read('src/utils/license-manager-new.ts');

  it('⭐⭐ 서버 응답이 없으면 이 기기의 등록 정보로 통과시킨다', () => {
    const block = src.slice(src.indexOf('} catch { /* 서버 실패 → 아래 폴백 */ }'), src.indexOf('서버 인증에 실패했습니다. 인터넷'));
    expect(block).toContain('fs.existsSync(this.patchFilePath)');
    expect(block).toMatch(/success: true/);
  });

  it('⭐⭐ 그 폴백은 아이디·비밀번호·deviceId 를 모두 통과한 뒤에만 닿는다', () => {
    const gate = src.slice(src.indexOf('if (existingLicense) {'), src.indexOf('SHA256 → bcrypt 자동 마이그레이션'));
    expect(gate).toContain('existingLicense.userId === userId');
    expect(gate).toContain('this.verifyPassword(password, existingLicense.passwordHash)');
    expect(gate).toContain('existingLicense.deviceId === deviceId');
  });

  it('⭐ patch 파일이 없으면 통과시키지 않는다 (열어 두는 게 아니다)', () => {
    expect(src).toContain('서버 인증에 실패했습니다. 인터넷 연결을 확인하거나 라이선스 코드를 다시 입력해주세요.');
  });

  it('⭐ 라이선스 서버 제한시간을 45초로 늘렸다', () => {
    expect(src).toMatch(/timeout: 45000/);
    expect(src).not.toMatch(/timeout: 15000, headers/);
  });
});
