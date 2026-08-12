/**
 * v3.8.485 — 에이전트 모드가 API 경로와 같은 규칙을 쓰게 한다
 *
 * 사장님 지적:
 *   "에이전트모드는 지금까지 수정한거 하나도 적용이 안되어있네?? 하네스 밀도높게 확인해서 전부 하나하나 배선해줘"
 *   "제목도 자동생성으로 선택했는데 자동생성안하고 키워드 그대로 나오는 버그가있네요"
 *   "본문내용과 소제목도 그냥 내가 이 글을 읽을 이유가 없어요 … 검색한 누구나 아는 내용만 나열한 느낌"
 *
 * ## 원인은 경로가 둘이라는 것이었다
 * 에이전트 모드는 orchestration 을 타지 않는다. electron/main.ts 안에 손으로 쓴
 * 별도 프롬프트가 있고 외부 CLI 에게 그것만 준다. 그래서 제목 아키타입·문체 규칙·
 * 알맹이 규칙·값 약속 금지·경험 가드가 **하나도** 들어가지 않았다.
 * 제목 지시는 "50~60자, 검색 친화" 한 줄이 전부였다 — 그러니 키워드를 그대로 쓴다.
 *
 * ## 규칙을 복사하지 않는다
 * 원본 모듈에서 가져와 붙인다. 복사해두면 한쪽만 고쳐지고, 엔진을 바꿨을 때
 * 품질이 조용히 갈린다. 그게 이 사고의 본질이었다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildAgentHarnessRules, normalizeAgentTitle, postProcessAgentArticle } from '../src/core/final/agent-harness';
import { getTitleArchetypes, buildArchetypeGuide } from '../src/core/final/title-archetypes';
import { HUMAN_VOICE_RULES } from '../src/core/final/lived-voice';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const mainTs = read('electron/main.ts');
const generation = read('src/core/final/generation.ts');

const RULES = buildAgentHarnessRules({ keyword: '실업급여', currentYear: 2026 });

describe('① 두 경로가 같은 제목 아키타입을 쓴다', () => {
  it('⭐⭐ 아키타입 목록이 공유 모듈 한 곳에 있다', () => {
    expect(getTitleArchetypes(2026).length).toBeGreaterThanOrEqual(10);
    expect(getTitleArchetypes(2026).map((a) => a.name)).toContain('결론 선공개');
  });

  it('⭐⭐ API 경로가 그 공유 목록을 쓴다 (복사본이 남아 있으면 또 갈린다)', () => {
    const code = generation.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
    expect(code).toContain('buildArchetypeGuide(');
    expect(code).not.toContain('const titleArchetypes = [');
  });

  it('⭐⭐ 에이전트 규칙에도 같은 목록이 들어간다', () => {
    const guide = buildArchetypeGuide(2026, 10);
    const names = getTitleArchetypes(2026).map((a) => a.name);
    expect(names.some((n) => guide.includes(n))).toBe(true);
    expect(names.some((n) => RULES.includes(n))).toBe(true);
  });

  it('⭐ 매번 같은 형태만 나오지 않는다 (한 곳으로 수렴하면 제목이 다 비슷해진다)', () => {
    const runs = new Set(Array.from({ length: 30 }, () => buildArchetypeGuide(2026)));
    expect(runs.size).toBeGreaterThan(1);
  });
});

describe('② 제목을 키워드로 복창하지 말라고 못 박는다', () => {
  it('⭐⭐ 키워드 그대로 쓰는 것을 금지한다 (사장님이 겪은 그 버그)', () => {
    expect(RULES).toContain('키워드 "실업급여" 와 똑같이 쓰지 마세요');
  });

  it('⭐⭐ 검색자가 처한 상황을 넣으라고 한다', () => {
    expect(RULES).toContain('검색한 사람이 처한 상황이나 겪는 문제');
  });

  it('⭐⭐ 상투어 제목을 금지 예시로 보여준다', () => {
    expect(RULES).toContain('총정리');
    expect(RULES).toContain('완벽 가이드');
  });

  it('⭐ 길이·연도·키워드 위치 규칙이 들어 있다', () => {
    expect(RULES).toContain('40자 이내');
    expect(RULES).toContain('2026년 기준');
  });

  it('⭐⭐ 검색자 질문이 있으면 1순위 재료로 넘긴다 (없으면 일반론이 나온다)', () => {
    const withQ = buildAgentHarnessRules({
      keyword: '실업급여',
      currentYear: 2026,
      demandQuestions: ['실업급여 받다가 취업하면 어떻게 되나요', '자진퇴사도 받을 수 있나요'],
    });
    expect(withQ).toContain('실업급여 받다가 취업하면');
    expect(withQ).toContain('1순위 재료');
  });
});

describe('③ 문체·알맹이 규칙이 통째로 들어간다', () => {
  it('⭐⭐ 사람 말투 규칙(순서·조건·한계)이 들어 있다', () => {
    expect(RULES).toContain('순서를 매기세요');
    expect(RULES).toContain('조건을 나누세요');
    expect(RULES).toContain('모르는 건 모른다고 하세요');
  });

  it('⭐⭐ 값을 약속하고 안 주는 문장 금지가 들어 있다', () => {
    expect(RULES).toContain('값을 약속했으면 값을 적으세요');
  });

  it('⭐⭐ 겪은 척 금지 가드가 들어 있다', () => {
    expect(RULES).toContain('제가');
  });

  it('⭐⭐ 규칙을 베껴 쓰지 않고 원본을 가져다 쓴다', () => {
    // HUMAN_VOICE_RULES 를 통째로 포함해야 한다 — 일부만 베끼면 나중에 갈린다
    expect(RULES).toContain(HUMAN_VOICE_RULES.trim().slice(0, 80));
  });
});

describe('④ 에이전트가 돌려준 결과도 같은 후처리를 거친다', () => {
  it('⭐⭐ 제목에서 상투어를 걷어낸다', () => {
    const out = normalizeAgentTitle('실업급여 자진퇴사 인정되는 경우 총정리', '실업급여');
    expect(out).not.toContain('총정리');
    expect(out).toContain('자진퇴사');
  });

  it('⭐ 상투어를 떼면 제목 구실을 못 할 만큼 짧아지면 그냥 둔다', () => {
    // "실업급여 신청조건"(9자)만 남는다 - 그럴 바엔 상투어가 붙은 게 낫다
    expect(normalizeAgentTitle('실업급여 신청조건 총정리', '실업급여')).toContain('총정리');
  });

  it('⭐⭐ 키워드를 두 번 쓴 제목을 정리한다', () => {
    const out = normalizeAgentTitle('실업급여, 실업급여 신청 조건 확인', '실업급여');
    expect(out.match(/실업급여/g)).toHaveLength(1);
  });

  it('⭐⭐ 40자를 넘기지 않는다', () => {
    expect(normalizeAgentTitle('가'.repeat(80), '가').length).toBeLessThanOrEqual(40);
  });

  it('⭐ 빈 제목이면 빈 문자열 (없는 제목을 지어내지 않는다)', () => {
    expect(normalizeAgentTitle('', '실업급여')).toBe('');
  });

  it('⭐⭐ 소제목을 되풀이하는 캡션을 걷어낸다', () => {
    const r = postProcessAgentArticle('<h2>신청 방법</h2><figure><figcaption>신청 방법</figcaption></figure>');
    expect(r.html).not.toContain('figcaption');
    expect(r.warnings.join(' ')).toContain('캡션');
  });

  it('⭐⭐ 값 약속 문장을 세어 경고로 올린다', () => {
    const r = postProcessAgentArticle('<p>지원 금액은 소득 구간에 따라 다릅니다.</p>');
    expect(r.valuePromises).toBe(1);
    expect(r.warnings.join(' ')).toContain('값을 약속');
  });

  it('⭐⭐ 빈 블록을 세어 경고로 올린다', () => {
    const r = postProcessAgentArticle('<h2></h2><p>본문</p>');
    expect(r.emptyBlocks).toBeGreaterThan(0);
  });

  it('⭐⭐ 멀쩡한 글은 손대지 않는다', () => {
    const html = '<h2>신청 방법</h2><p>복지로에서 접수합니다. 지원금은 월 30만원입니다.</p>';
    const r = postProcessAgentArticle(html);
    expect(r.html).toBe(html);
    expect(r.warnings).toHaveLength(0);
  });

  it('⭐⭐ 후처리가 발행을 막지 않는다 (에이전트 실행에 이미 몇 분을 썼다)', () => {
    expect(() => postProcessAgentArticle(null as any)).not.toThrow();
    expect(postProcessAgentArticle('').html).toBe('');
  });
});

describe('⑤ 실제로 배선돼 있다 (모듈만 만들고 안 부르면 무효)', () => {
  it('⭐⭐ 지시서가 공용 규칙을 주입한다', () => {
    expect(mainTs).toContain('buildAgentHarnessRules(');
    const idx = mainTs.indexOf('buildAgentHarnessRules(');
    const block = mainTs.slice(idx - 400, idx + 400);
    expect(block).toContain('keyword: topic');
    expect(block).toContain('demandQuestions');
  });

  it('⭐⭐ 결과에 제목 정규화와 본문 후처리를 건다', () => {
    expect(mainTs).toContain('normalizeAgentTitle(');
    expect(mainTs).toContain('postProcessAgentArticle(');
  });

  it('⭐⭐ 주입이 실패해도 에이전트 실행은 계속된다', () => {
    const idx = mainTs.indexOf('buildAgentHarnessRules(');
    const block = mainTs.slice(idx - 400, idx + 600);
    expect(block).toContain('catch');
  });

  it('⭐⭐ 검색자 질문 헬퍼가 있다', () => {
    expect(mainTs).toContain('function getAgentDemandQuestions(');
  });
});
