/**
 * 차단된 키(유출 신고) 분류 — v3.8.502
 *
 * 실사용 보고: 발행 실패가 "응답 시간이 너무 길어(60s×2)"로 표시됐는데
 * 실제 원인은 403 "Your API key was reported as leaked" 였다.
 * 미분류 → 재시도 소진 → 타임아웃 보고. 사용자는 엉뚱한 곳(할당량·키워드)을 뒤졌다.
 */
import * as fs from 'fs';
import * as path from 'path';

const src = fs.readFileSync(
  path.join(__dirname, '..', 'src/core/final/gemini-engine.ts'), 'utf-8');

describe('유출 차단 키를 auth 로 분류한다', () => {
  it('403·PERMISSION_DENIED·leaked 문구가 auth 가지에 걸린다', () => {
    expect(src).toMatch(/if \(status === 403/);
    expect(src).toMatch(/permission\[[^\]]*\]\?denied/);   // 이스케이프 표기 차이에 안 흔들리게
    expect(src).toContain('reported as leaked');
    expect(src).toContain('use another api key');
  });

  it('auth 는 재시도하지 않는다 — 차단 키는 몇 번을 불러도 403 이다', () => {
    // 비재시도 목록과 모델 루프 탈출 둘 다에 auth 가 있어야 한다
    const nonRetry = src.indexOf("kind === 'auth' ||");
    expect(nonRetry).toBeGreaterThan(-1);
    expect(src).toMatch(/info\.kind === 'auth' \|\| info\.kind === 'billing'/);
  });

  it('안내문이 "충전으로는 안 풀린다 — 새 키 발급"을 말한다', () => {
    expect(src).toContain('유출 신고로 차단');
    expect(src).toContain('결제를 충전해도');
    expect(src).toContain('aistudio.google.com/apikey');
    // 충전한 돈이 날아간 게 아니라는 것도 말해 준다 — 사용자가 제일 걱정할 부분
    expect(src).toContain('새 키로 그대로 쓰입니다');
  });
});
