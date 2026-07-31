/**
 * 모드별 섹션 표시 + Agent 사용량 한도 안내 (v3.8.393)
 *
 * ── 사고 1: 쇼핑모드 이미지 전략이 모든 모드에서 보였다 ──
 *   contentMode 변경 리스너와 복원 함수가 각각 adsense 저자 섹션만 처리했다.
 *   쇼핑 전용 선택지가 애드센스/외부유입 모드에서도 계속 떠 혼란을 줬다.
 *
 * ── 사고 2: Claude Code 주간 한도가 "Agent 산출물을 찾지 못했습니다" 로 나왔다 ──
 *   실측(2026-07-31) 사용자 화면:
 *     "Agent 산출물을 찾지 못했습니다." + 원문 JSON 노출
 *     {"is_error":true,"stop_reason":"stop_sequence",
 *      "result":"You've hit your weekly limit · resets Aug 4, 4am (Asia/Seoul)"}
 *   진짜 원인(주간 한도 소진)이 JSON 안에 묻혀 사용자가 앱 버그로 오해했다.
 *   Codex 쪽에는 전용 안내가 이미 있었는데 Claude Code 쪽만 없었다.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'index.html'), 'utf8');
const mainTs = fs.readFileSync(path.join(ROOT, 'electron', 'main.ts'), 'utf8');

describe('쇼핑모드 이미지 전략 — 쇼핑모드일 때만 보인다', () => {
  it('기본은 숨김이다', () => {
    const i = html.indexOf('id="shoppingStrategyField"');
    expect(i).toBeGreaterThan(-1);
    // 같은 태그 안에 display:none 이 있어야 한다
    const tagEnd = html.indexOf('>', i);
    expect(html.slice(i, tagEnd)).toContain('display: none');
  });

  it('모드 판정을 한 함수로 모은다 — 리스너와 복원이 갈리면 또 어긋난다', () => {
    expect(html).toContain('function syncContentModeSections(mode)');
  });

  it('쇼핑모드에서만 표시한다', () => {
    const i = html.indexOf('function syncContentModeSections');
    const block = html.slice(i, i + 600);
    expect(block).toContain("mode === 'shopping' ? 'block' : 'none'");
  });

  it('애드센스 저자 섹션 판정도 같은 함수가 한다', () => {
    const i = html.indexOf('function syncContentModeSections');
    const block = html.slice(i, i + 600);
    expect(block).toContain("mode === 'adsense' ? 'block' : 'none'");
  });

  it('모드 변경 시 호출한다', () => {
    const i = html.indexOf("getElementById('contentMode').addEventListener('change'");
    expect(i).toBeGreaterThan(-1);
    expect(html.slice(i, i + 400)).toContain('syncContentModeSections(this.value)');
  });

  it('앱 시작 시에도 호출한다 — 저장값이 없어도 맞춘다', () => {
    const i = html.indexOf('function restoreContentMode');
    const block = html.slice(i, i + 600);
    expect(block).toContain('syncContentModeSections(');
    expect(block).toContain("el?.value || 'external'");
  });

  it('셀렉트 자체는 그대로 살아있다 (payload 배선이 깨지면 안 된다)', () => {
    expect(html).toContain('id="shoppingImageStrategy"');
    expect(html).toContain('value="product-all"');
    expect(html).toContain('value="product-i2i"');
  });
});

describe('Claude Code 사용량 한도 — 원문 JSON 대신 사람이 읽는 안내', () => {
  const realMessage = `{"is_error":true,"duration_api_ms":0,"num_turns":1,"stop_reason":"stop_sequence","session_i...":"You've hit your weekly limit · resets Aug 4, 4am (Asia/Seoul)","type":"result","duration_ms":1918}`;

  /** main.ts 에서 정규식을 그대로 뽑아 실제 문자열로 검증한다 */
  function extractRegex(name: string): RegExp {
    const line = mainTs.split('\n').find(l => l.includes(`const ${name} = /`));
    expect(line).toBeTruthy();
    const body = line!.slice(line!.indexOf('/') + 1, line!.lastIndexOf('/i'));
    return new RegExp(body, 'i');
  }

  it('실제 오류 문구를 한도로 인식한다', () => {
    expect(extractRegex('CLAUDE_USAGE_LIMIT_RE').test(realMessage)).toBe(true);
  });

  it('평범한 오류를 한도로 오인하지 않는다', () => {
    const re = extractRegex('CLAUDE_USAGE_LIMIT_RE');
    expect(re.test('ENOENT: no such file or directory')).toBe(false);
    expect(re.test('Agent process exited with code 1')).toBe(false);
    expect(re.test('네트워크 연결이 끊겼습니다')).toBe(false);
  });

  it('한도 안내가 원인을 분명히 말한다 — 앱 버그가 아님을 밝힌다', () => {
    expect(mainTs).toContain('Claude Code 사용량 한도에 도달했습니다');
    expect(mainTs).toContain('앱 버그가 아니라 구독 사용량이 소진된 상태입니다');
  });

  it('발행이 진행되지 않았음을 알려준다 — 중복 발행 걱정을 없앤다', () => {
    expect(mainTs).toContain('글은 생성되지 않았고 발행도 진행되지 않았습니다');
  });

  it('별개 사용량 풀인 대안 엔진을 안내한다', () => {
    expect(mainTs).toContain('별개 사용량 풀');
  });

  it('리셋 시각을 원문에서 그대로 뽑는다 — 지어내지 않는다', () => {
    expect(mainTs).toContain('function extractLimitResetHint');
    const i = mainTs.indexOf('function extractLimitResetHint');
    expect(mainTs.slice(i, i + 300)).toContain('resets?');
  });

  it('한도 판정이 provider 를 가리지 않는다', () => {
    const i = mainTs.indexOf('CLAUDE_USAGE_LIMIT_RE.test(combined)');
    expect(i).toBeGreaterThan(-1);
    // 이 분기 앞에 provider === 'codex' 조건이 붙어 있으면 안 된다
    const line = mainTs.slice(mainTs.lastIndexOf('\n', i - 1), i);
    expect(line).not.toContain("provider === 'codex'");
  });

  it('기존 폴백 문구는 마지막에 그대로 남는다', () => {
    const limitIdx = mainTs.indexOf('CLAUDE_USAGE_LIMIT_RE.test(combined)');
    const fallbackIdx = mainTs.indexOf("return 'Agent 산출물을 찾지 못했습니다.'");
    expect(fallbackIdx).toBeGreaterThan(limitIdx);
  });
});
