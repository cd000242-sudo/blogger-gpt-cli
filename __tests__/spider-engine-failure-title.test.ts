/**
 * 거미줄 종합글 — 엔진 분기 · 실패 응답 · 제목 결정 · 본문 검사 (묶음 A + B)
 *
 * 배경: 발행된 종합글이 AI 글이 아니라 buildSpiderWebFallbackHtml 의 기계식 대체 틀이었다.
 *   선택한 엔진이 실패하면 다른 엔진·대체 틀로 몰래 바꾸지 않고, 실패를 한글로 알리고 멈춘다.
 * 이 파일은 순수 함수만 확인한다. 실제 LLM·앱·네트워크는 부르지 않는다.
 */
import {
  decideSpiderEngine,
  judgeSpiderAgentContent,
  spiderAgentNoContentMessage,
  SPIDER_AGENT_MIN_CHARS,
  buildSpiderFailure,
  redactSecrets,
  resolveSpiderTitle,
  isGenericSpiderTitle,
  checkSpiderBody,
  SPIDER_TITLE_MISSING_MESSAGE,
  SPIDER_PROMPT_TITLE_PLACEHOLDER,
} from '../src/core/spider';

const FAKE_GEMINI_KEY = 'AIzaSyD-FAKEKEYFORTESTONLY1234567890abcd';

describe('decideSpiderEngine — 고른 엔진이 곧 쓰는 엔진', () => {
  it('executionMode 가 agent 이면 Gemini 를 쓰지 않는다', () => {
    expect(decideSpiderEngine({ executionMode: 'agent' })).toEqual({ mode: 'agent', usesGemini: false });
  });
  it('agent 가 아니면(api · 비어 있음 · 모르는 값) API(Gemini)로 쓴다 — 기존 동작', () => {
    expect(decideSpiderEngine({ executionMode: 'api' })).toEqual({ mode: 'api', usesGemini: true });
    expect(decideSpiderEngine({})).toEqual({ mode: 'api', usesGemini: true });
    expect(decideSpiderEngine(null)).toEqual({ mode: 'api', usesGemini: true });
    expect(decideSpiderEngine({ executionMode: 'whatever' })).toEqual({ mode: 'api', usesGemini: true });
  });
});

describe('judgeSpiderAgentContent — 비었거나 500자 미만이면 실패', () => {
  it('500자 이상이면 통과하고 앞뒤 공백을 자른다', () => {
    const body = '가'.repeat(SPIDER_AGENT_MIN_CHARS);
    expect(judgeSpiderAgentContent(`  ${body}\n`)).toEqual({ ok: true, content: body });
  });
  it('499자는 short, 빈 값·null 은 empty 로 실패한다', () => {
    expect(judgeSpiderAgentContent('가'.repeat(SPIDER_AGENT_MIN_CHARS - 1))).toEqual({ ok: false, reason: 'short', length: SPIDER_AGENT_MIN_CHARS - 1 });
    expect(judgeSpiderAgentContent('   ')).toEqual({ ok: false, reason: 'empty', length: 0 });
    expect(judgeSpiderAgentContent(null)).toEqual({ ok: false, reason: 'empty', length: 0 });
  });
  it('실패 문구는 어느 엔진인지 밝히고 Gemini 로 넘어간다는 말을 하지 않는다', () => {
    const msg = spiderAgentNoContentMessage('Claude Code', 120, {});
    expect(msg).toContain('Claude Code');
    expect(msg).toContain('글을 돌려주지 않았습니다');
    expect(msg).toContain('120');
    expect(msg).not.toMatch(/Gemini/);
    expect(spiderAgentNoContentMessage('Codex', 0, { timedOut: true })).toContain('제한 시간');
    expect(spiderAgentNoContentMessage('Codex', 0, { canceled: true })).toContain('중지');
  });
});

describe('buildSpiderFailure — 한글 문구 + 단계 + 할 일, 비밀값 없음', () => {
  it('success:false · 한글 error · stage 를 돌려준다', () => {
    const f = buildSpiderFailure({ stage: 'generate', cause: new Error('socket hang up'), mode: 'agent', providerLabel: 'Claude Code' });
    expect(f.success).toBe(false);
    expect(f.stage).toBe('generate');
    expect(f.error).toContain('글 생성');
    expect(f.error).toContain('socket hang up');
    expect(f.error).toMatch(/다시 시도/);
    expect(f.error).toContain('Claude Code');
  });
  it('단계마다 사용자에게 보이는 이름이 다르다 (엔진 확인 · 글 생성 · 이미지 · 태그/메타)', () => {
    const label = (stage: any) => buildSpiderFailure({ stage, cause: 'x', mode: 'api' }).error;
    expect(label('engine')).toContain('엔진 확인');
    expect(label('generate')).toContain('글 생성');
    expect(label('image')).toContain('이미지');
    expect(label('meta')).toContain('태그');
  });
  it('API 모드의 Gemini 인증 오류는 키 확인을 안내하되 키 값은 싣지 않는다', () => {
    const cause = new Error(`[403] API Key not valid. key=${FAKE_GEMINI_KEY}`);
    const f = buildSpiderFailure({ stage: 'engine', cause, mode: 'api' });
    expect(f.error).toContain('Gemini API');
    expect(f.error).toMatch(/키/);
    expect(f.error).not.toContain(FAKE_GEMINI_KEY);
    expect(f.error).not.toContain('AIzaSyD');
  });
  it('Agent 모드 오류에는 Gemini 키를 확인하라는 말이 나오지 않는다', () => {
    const f = buildSpiderFailure({ stage: 'generate', cause: new Error('403 forbidden'), mode: 'agent', providerLabel: 'Codex' });
    expect(f.error).not.toMatch(/Gemini/);
    expect(f.error).toContain('Codex');
  });
  it('원인이 길어도 한 줄 요약으로 줄이고 첫 줄만 쓴다', () => {
    const f = buildSpiderFailure({ stage: 'generate', cause: `첫 줄 원인\n${'x'.repeat(2000)}`, mode: 'api' });
    expect(f.error).toContain('첫 줄 원인');
    expect(f.error.length).toBeLessThan(600);
  });
  it('원인이 비어 있어도 문구가 깨지지 않는다', () => {
    const f = buildSpiderFailure({ stage: 'generate', cause: undefined, mode: 'api' });
    expect(f.error).toContain('알 수 없는 오류');
  });
});

describe('redactSecrets — 키·토큰 값은 문구와 로그에 남기지 않는다', () => {
  it.each([
    ['Gemini 키', `request failed key=${FAKE_GEMINI_KEY}`],
    ['OpenAI 키', 'bad sk-proj-abcdefghijklmnopqrstuvwx1234567890'],
    ['Bearer 토큰', 'Authorization: Bearer ya29.a0AfH6SMBxxxxxxxxxxxxxxxxxxxxxxxx'],
    ['api_key=', 'api_key=abcd1234efgh5678'],
  ])('%s 를 가린다', (_name, raw) => {
    const out = redactSecrets(raw);
    expect(out).toContain('***');
    expect(out).not.toMatch(/AIzaSyD-FAKE|sk-proj-abcdefgh|ya29\.a0AfH6|abcd1234efgh5678/);
  });
  it('평범한 문장은 건드리지 않는다', () => {
    expect(redactSecrets('Claude Code 가 글을 돌려주지 않았습니다')).toBe('Claude Code 가 글을 돌려주지 않았습니다');
  });
});

describe('resolveSpiderTitle — 일반어가 발행 제목이 되지 않는다', () => {
  it('사용자가 넣은 제목이 최우선', () => {
    expect(resolveSpiderTitle({ userTitle: '  청년도약계좌 총정리 ', aiTitle: 'AI 제목' })).toEqual({ ok: true, title: '청년도약계좌 총정리', source: 'user' });
  });
  it('사용자 제목이 없으면 AI 가 쓴 H1', () => {
    expect(resolveSpiderTitle({ userTitle: '', aiTitle: ' 2026 청년 지원금 한 번에 정리 ' })).toEqual({ ok: true, title: '2026 청년 지원금 한 번에 정리', source: 'ai' });
  });
  it('둘 다 없으면 멈추고 지정된 문구를 돌려준다', () => {
    const r = resolveSpiderTitle({ userTitle: undefined, aiTitle: '' });
    expect(r).toEqual({ ok: false, error: SPIDER_TITLE_MISSING_MESSAGE });
    expect(SPIDER_TITLE_MISSING_MESSAGE).toBe('제목을 만들지 못했습니다. 통합글 제목 칸에 직접 입력해 주세요.');
  });
  it('AI 가 일반어 또는 임시 제목 안내문을 H1 로 돌려줘도 제목으로 쓰지 않는다', () => {
    expect(resolveSpiderTitle({ userTitle: '', aiTitle: '종합 가이드' }).ok).toBe(false);
    expect(resolveSpiderTitle({ userTitle: '', aiTitle: '거미줄치기 통합글' }).ok).toBe(false);
    expect(resolveSpiderTitle({ userTitle: '', aiTitle: SPIDER_PROMPT_TITLE_PLACEHOLDER }).ok).toBe(false);
  });
  it('일반어 판정은 통째로 같을 때만 — 주제가 붙은 제목은 통과', () => {
    expect(isGenericSpiderTitle(' 종합  가이드 ')).toBe(true);
    expect(isGenericSpiderTitle('종합가이드')).toBe(true);
    expect(isGenericSpiderTitle('청년내일저축계좌 종합 가이드')).toBe(false);
  });
});

describe('checkSpiderBody — 비어 있는 본문은 성공으로 넘기지 않는다', () => {
  it('스타일·태그를 빼고 글자가 거의 없으면 실패', () => {
    expect(checkSpiderBody('').ok).toBe(false);
    expect(checkSpiderBody('<style>.a{color:red}</style><div></div>').ok).toBe(false);
  });
  it('실제 글자가 있으면 통과하고 평문 길이를 알려 준다', () => {
    const r = checkSpiderBody(`<style>.a{}</style><div><h2>제목</h2><p>${'가'.repeat(400)}</p></div>`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plainLength).toBeGreaterThanOrEqual(400);
  });
});
