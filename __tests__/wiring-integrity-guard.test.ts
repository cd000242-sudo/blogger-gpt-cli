/**
 * 배선 무결성 가드 (v3.8.433)
 *
 * ## 왜 만드나
 * 이 저장소에서 **같은 종류의 사고가 반복해서** 났다. 공통점은 하나다 —
 * "고쳤는데 그 값이 실제 출력까지 도달하지 않는다."
 *
 *   · v3.8.422  쇼핑모드 섹션 지시가 플러그인에 가려 **실행조차** 안 됨
 *   · v3.8.424  가독성 지시를 복사본이 아닌 원본에 붙여 **한 번도 안 실림**
 *   · v3.8.432  H3 박스 CSS 는 있었는데 인라인 !important 가 **죽이고 있었음**
 *   · v3.8.433  출력 토큰 상한을 올렸는데 **정작 쓰는 경로**엔 안 걸려 있었음
 *
 * 전부 "동작은 조용히 실패하고, 테스트는 초록"인 상태였다. 사용자가 실제 발행글을
 * 보고 알려주기 전까지 아무도 몰랐다.
 *
 * 그래서 개별 기능이 아니라 **패턴 자체**를 잠근다. 아래 테스트들은 특정 기능이
 * 아니라 "이 구조가 다시 생기면 실패"하도록 짜여 있다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

const orch = read('src', 'core', 'final', 'orchestration.ts');
const gemini = read('src', 'core', 'final', 'gemini-engine.ts');

describe('① 프롬프트 블록은 복사본이 만들어진 뒤에 수정되면 안 된다 (v3.8.424 재발 방지)', () => {
  /**
   * scopedSectionBlock 은 modeResult.sectionPromptBlock 을 **문자열로 복사**한다.
   * 원시값이라 참조가 아니다 — 복사 이후에 원본을 고치면 그 내용은 버려진다.
   * 실제로 v3.8.424 에서 가독성 지시가 이렇게 통째로 사라졌다.
   */
  it('⭐ 복사 이후에 modeResult.sectionPromptBlock 에 대입하는 코드가 없다', () => {
    const copyIdx = orch.indexOf("let scopedSectionBlock = modeResult.sectionPromptBlock || '';");
    expect(copyIdx).toBeGreaterThan(-1);
    const after = orch.slice(copyIdx);
    // 복사 뒤에는 원본을 건드리면 안 된다 (읽기는 허용, 쓰기는 금지)
    const writes = after.match(/modeResult\.sectionPromptBlock\s*(=|\+=)(?!=)/g) || [];
    expect(writes).toEqual([]);
  });

  it('⭐ 본문 생성 호출은 원본이 아니라 복사본을 넘긴다', () => {
    const copyIdx = orch.indexOf("let scopedSectionBlock = modeResult.sectionPromptBlock || '';");
    const after = orch.slice(copyIdx);
    const callIdx = after.indexOf('generateAllSectionsFinal(');
    expect(callIdx).toBeGreaterThan(-1);
    // 첫 생성 호출 주변에 scopedSectionBlock 이 인자로 들어가야 한다
    expect(blockBetween(after.slice(callIdx), 'generateAllSectionsFinal(', ');')).toContain('scopedSectionBlock');
  });
});

describe('② 인라인 스타일이 자기 CSS 를 죽이면 안 된다 (v3.8.432 재발 방지)', () => {
  /**
   * html.ts 가 H3 박스를 그리도록 CSS 를 넣어도, orchestration 이 인라인으로
   * background:none / border:none 을 !important 로 박으면 CSS 는 절대 못 이긴다.
   * 그 상태로 "CSS 를 고쳤으니 됐다"고 판단하면 영원히 안 고쳐진다.
   */
  it('⭐ 본문 H3 인라인 스타일이 배경·테두리를 none 으로 죽이지 않는다', () => {
    // ⚠️ H3 **태그 한 줄만** 본다. 범위를 넓게 잡으면 바로 아래 본문 <div> 의
    //   정당한 background:none 까지 걸려 헛되이 깨진다(실제로 처음에 그랬다).
    const line = (orch.split('\n').find((l) => l.includes('<h3 data-orbit-h3box')) || '');
    expect(line).toContain('<h3');
    expect(line).not.toMatch(/background:\s*none\s*!important/);
    expect(line).not.toMatch(/border:\s*none\s*!important/);
    // 실제로 박스를 그리는지도 같이 본다
    expect(line).toMatch(/background:\$\{tone\.bg\}\s*!important/);
    expect(line).toMatch(/border:3px solid \$\{tone\.bd\}\s*!important/);
  });

  it('⭐ 스스로 박스를 두른 H3 는 발행 단계에서 또 감싸지 않는다 (액자 속 액자 방지)', () => {
    expect(orch).toContain('data-orbit-h3box="1"');
    const card = read('src', 'core', 'final', 'section-card.ts');
    expect(card).toContain('data-orbit-h3box');
  });
});

describe('③ 모든 Gemini 호출 경로가 같은 출력 토큰 상한을 쓴다 (v3.8.433 재발 방지)', () => {
  /**
   * v3.8.432 에서 상한을 올렸지만 callGeminiWithRetry 한쪽에만 넣었다.
   * 본문 생성이 실제로 타는 grounding 경로는 generationConfig 자체가 없어
   * Gemini 기본값으로 잘리고 있었다 — "고쳤는데 안 고쳐진" 전형이다.
   */
  it('⭐ 상한을 함수 하나로 관리한다 (숫자를 여기저기 흩뿌리지 않는다)', () => {
    expect(gemini).toContain('export function resolveMaxOutputTokens()');
  });

  it('⭐ generateContent 를 부르는 곳은 전부 maxOutputTokens 를 건다', () => {
    // 호출부터 그 인자가 끝나는 지점(withTimeout 의 다음 인자)까지를 본다.
    const calls = [...gemini.matchAll(/model\.generateContent\(/g)].map((m) => m.index || 0);
    expect(calls.length).toBeGreaterThanOrEqual(2);   // 일반 + grounding
    for (const idx of calls) {
      const args = blockBetween(gemini.slice(idx), 'model.generateContent(', 'envInt(');
      expect(args).toContain('maxOutputTokens');
    }
  });

  it('⭐ 고정 숫자를 직접 박지 않는다 — 한쪽만 올리는 실수를 막는다', () => {
    expect(gemini).not.toContain('maxOutputTokens: 16384');
    expect(gemini).not.toMatch(/maxOutputTokens:\s*\d+/);
  });
});

describe('④ 제휴사 판정을 추측에 맡기지 않는다 (v3.8.433 재발 방지)', () => {
  /**
   * compliance 는 두 번째 인자가 비면 본문 링크를 훑어 제휴사를 자동 판별한다.
   * 본문에 참고용 쿠팡 링크가 섞이면 토스 글에 쿠팡 고지문이 붙는다.
   * 아는 값이 있으면 반드시 넘겨야 한다.
   */
  it('⭐ enforceAffiliateCompliance 에 null 을 그냥 넘기지 않는다', () => {
    expect(orch).toContain('const knownProvider =');
    expect(orch).toContain('enforceAffiliateCompliance(html, knownProvider || null)');
    // 예전처럼 payload 값만 보고 바로 넘기면 안 된다
    expect(orch).not.toContain("enforceAffiliateCompliance(html, (payload as any).affiliateProvider || null)");
  });

  it('⭐ 고른 제휴사 → 크롤된 제휴사 → 쿠팡판정 순으로 좁힌다', () => {
    const idx = orch.indexOf('const knownProvider =');
    const block = blockBetween(orch.slice(idx), 'const knownProvider =', 'enforceAffiliateCompliance');
    expect(block).toContain('affiliateProvider');
    expect(block).toContain('affiliateProducts');
    expect(block).toContain('isCoupangArticle');
  });
});

describe('⑤ 대기열이 단일 발행과 같은 필드를 보낸다 (조용한 누락 방지)', () => {
  /**
   * 대기열 payload 는 단일 발행과 **다른 코드**가 만든다. 그래서 단일 발행에만
   * 새 필드를 추가하면 대기열 글은 그 기능 없이 조용히 나간다.
   * 실제로 쇼핑모드 연속발행이 제휴 링크 없이 돌고 있었다.
   */
  const queue = read('electron', 'ui', 'modules', 'publish-queue.js');
  const posting = read('electron', 'ui', 'modules', 'posting.js');

  it('⭐ 쇼핑모드 핵심 필드가 양쪽 payload 에 모두 있다', () => {
    for (const field of ['affiliateLinks', 'affiliateProvider', 'contentMode']) {
      expect(posting).toContain(`${field}:`);
      expect(queue).toContain(`${field}:`);
    }
  });

  it('⭐ 대기열 항목이 자기 제휴 링크를 들고 다닌다', () => {
    expect(queue).toContain('affiliateLink: entry.affiliateLink');
    expect(queue).toContain('affiliateLinks: item.affiliateLink ? [item.affiliateLink] : undefined');
  });
});

describe('⑦ 특정 제공자만 고치는 실수를 막는다 (v3.8.434)', () => {
  /**
   * 사용자 지적: "왜자꾸 기준을 제미나이로 잡는지 모르겠네 다른 API도 많은데"
   *
   * v3.8.432~433 에서 본문 잘림을 고치며 Gemini 만 32,768 로 올렸다.
   * 사용자가 OpenAI(6,000)·Claude(8,192)·Perplexity(8,192) 를 고르면 같은 버그가
   * 그대로였다. "한 제공자만 고치고 끝났다"를 구조적으로 막는다.
   */
  const caller = read('src', 'core', 'llm', 'llm-caller.ts');
  const openaiMod = read('src', 'core', 'llm', 'openai.ts');

  it('⭐ 공용 상한 함수가 있고 export 된다', () => {
    expect(caller).toContain('export function resolveLlmMaxTokens()');
  });

  it('⭐ 본문 생성 제공자들이 상한 숫자를 직접 박지 않는다', () => {
    // 8192 / 6000 같은 값이 다시 들어오면 한쪽만 고치는 사고가 재발한다
    for (const src of [caller, openaiMod]) {
      expect(src).not.toMatch(/max_tokens:\s*\d+/);
      expect(src).not.toMatch(/max_completion_tokens'?\]?\s*[:=]\s*\d+/);
    }
  });

  it('⭐ 세 제공자 모두 공용 함수를 실제로 쓴다', () => {
    // perplexity · openai · claude 각 buildBody 안에 들어 있어야 한다
    const uses = (caller.match(/resolveLlmMaxTokens\(\)/g) || []).length;
    expect(uses).toBeGreaterThanOrEqual(4);   // openai(2분기) + perplexity + claude
    expect(openaiMod).toContain('resolveLlmMaxTokens()');
  });

  it('⭐ Gemini 쪽 상한도 같은 취지의 함수로 관리된다', () => {
    expect(gemini).toContain('export function resolveMaxOutputTokens()');
  });
});

describe('⑧ API 키는 정식 로더로만 가져온다 (v3.8.434)', () => {
  /**
   * 이 앱은 같은 키를 여러 이름으로 저장한다(geminiKey / GEMINI_API_KEY,
   * claudeKey / claudeApiKey / CLAUDE_API_KEY / ANTHROPIC_API_KEY …).
   * 새 코드가 env 를 직접 읽으면 UI 로 저장한 키를 못 찾아 **조용히** 기능이 꺼진다.
   * 실제로 detail-image-vision 배선이 Claude 키를 못 찾고 있었다.
   */
  const orchSrc = orch;

  it('⭐ vision 배선이 getApiKey 를 쓴다 (env 직접 읽기 금지)', () => {
    expect(orchSrc).toContain("await import('../llm/api-keys')");
    expect(orchSrc).toContain("pick('gemini')");
    expect(orchSrc).toContain("pick('claude')");
    expect(orchSrc).toContain("pick('openai')");
    // 예전처럼 env 이름을 직접 읽으면 안 된다
    expect(orchSrc).not.toContain("envForVision['ANTHROPIC_API_KEY']");
  });

  it('⭐ Claude 키는 이 앱이 저장하는 이름을 모두 본다', () => {
    const keys = read('src', 'core', 'llm', 'api-keys.ts');
    expect(keys).toContain("'claudeKey'");
    expect(keys).toContain("'CLAUDE_API_KEY'");
    expect(keys).toContain("'ANTHROPIC_API_KEY'");
    // process.env 폴백도 저장 이름을 봐야 한다
    expect(keys).toContain("processEnvKeys: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY']");
  });
});

describe('⑨ 에이전트 모드가 같은 payload 를 쓴다 (v3.8.434)', () => {
  /**
   * 에이전트 경로가 payload 를 따로 조립하면, 단일 발행에만 추가한 필드가
   * 에이전트 글에서는 조용히 빠진다(쇼핑 링크·제휴사 등).
   * 지금은 createPayload 결과를 그대로 넘기고 있다 — 그 구조를 잠근다.
   */
  const posting = read('electron', 'ui', 'modules', 'posting.js');

  it('⭐ 에이전트 실행이 createPayload 로 만든 payload 를 그대로 넘긴다', () => {
    expect(posting).toContain('window.runAgentJobFromPosting(payload)');
  });

  it('⭐ 에이전트 전용으로 payload 를 다시 만들지 않는다', () => {
    const idx = posting.indexOf('window.runAgentJobFromPosting(payload)');
    expect(idx).toBeGreaterThan(-1);
    // 호출 직전에 payload 를 새로 조립하는 코드가 있으면 필드 누락이 생긴다
    const before = posting.slice(Math.max(0, idx - 1500), idx);
    expect(before).not.toMatch(/const\s+payload\s*=\s*\{/);
  });
});

describe('⑥ 연속발행 설정 잠금은 실행 중에만 (v3.8.433)', () => {
  const queue = read('electron', 'ui', 'modules', 'publish-queue.js');

  it('⭐ 탭을 고른 것만으로는 설정을 잠그지 않는다', () => {
    const idx = queue.indexOf('function togglePostingSettingsForQueue()');
    const block = blockBetween(queue.slice(idx), 'function togglePostingSettingsForQueue()', 'function syncBadge');
    expect(block).toContain('window.__queueRunning === true');
    // 탭 선택(getCurrentMode() === 'bulk')으로 잠그면 대기열에 담기 전 설정이 불가능해진다
    expect(block).not.toContain("getCurrentMode() === 'bulk'");
  });
});
