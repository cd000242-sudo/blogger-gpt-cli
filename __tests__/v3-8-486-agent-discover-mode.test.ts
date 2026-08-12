/**
 * v3.8.486 — 에이전트 모드가 디스커버 모드를 알아보게 한다
 *
 * 사장님: "모드가 하나더 추가되었는데 디스커버모드"
 *
 * ## 왜 따로 챙겨야 하나
 * 디스커버는 검색이 아니다. 독자가 검색하지 않았고, 관심사에 맞아 피드에 카드로 뜬 것을
 * 제목만 보고 누른다. 그래서 제목 규칙이 검색용과 **정반대**다 —
 * 검색용은 키워드를 앞세우지만 디스커버는 결론을 담아야 하고 낚시를 금지한다.
 *
 * API 경로는 이미 갈아끼운다(generation.ts 가 isDiscoverMode 로 분기).
 * 그런데 에이전트 지시서는 **contentMode 를 아예 읽지 않아서**, 디스커버로 돌려도
 * 일반 검색용 규칙이 나갔다. [[에이전트 모드가 별도 경로]] 문제의 연장선이다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildAgentHarnessRules, postProcessAgentArticle } from '../src/core/final/agent-harness';
import { buildDiscoverTitleDirective, buildDiscoverBodyBlock } from '../src/core/final/discover-mode';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const mainTs = read('electron/main.ts');

const BASE = { keyword: '전기요금 인상', currentYear: 2026 };
const SEARCH_RULES = buildAgentHarnessRules({ ...BASE, contentMode: 'adsense' });
const DISCOVER_RULES = buildAgentHarnessRules({ ...BASE, contentMode: 'discover' });

describe('① 디스커버면 제목 규칙을 통째로 갈아끼운다', () => {
  it('⭐⭐ 디스커버 전용 제목 지시문이 들어간다', () => {
    expect(DISCOVER_RULES).toContain(buildDiscoverTitleDirective(2026).trim().slice(0, 60));
  });

  it('⭐⭐ 검색용 아키타입 목록은 빠진다 (둘을 같이 주면 서로 어긋난다)', () => {
    // 검색용은 "키워드를 앞쪽에" 라고 하고 디스커버는 결론을 담으라고 한다 — 함께 주면 안 된다
    expect(DISCOVER_RULES).not.toContain('결론 선공개형');
    expect(DISCOVER_RULES).not.toContain('키워드는 제목 앞쪽에');
  });

  it('⭐⭐ 검색 모드는 예전 그대로다 (디스커버 때문에 나머지가 바뀌면 안 된다)', () => {
    expect(SEARCH_RULES).toContain('키워드는 제목 앞쪽에');
    expect(SEARCH_RULES).not.toContain('디스커버 피드');
  });

  it('⭐⭐ contentMode 를 안 주면 검색 모드로 본다 (기존 동작 유지)', () => {
    expect(buildAgentHarnessRules(BASE)).toContain('키워드는 제목 앞쪽에');
  });
});

describe('② 본문 규칙도 피드 기준으로 바뀐다', () => {
  it('⭐⭐ 디스커버 본문 블록이 들어간다', () => {
    expect(DISCOVER_RULES).toContain(buildDiscoverBodyBlock(2026).trim().slice(0, 60));
  });

  it('⭐⭐ 검색 모드에는 안 들어간다', () => {
    expect(SEARCH_RULES).not.toContain(buildDiscoverBodyBlock(2026).trim().slice(0, 60));
  });

  it('⭐ 문체·알맹이 규칙은 두 모드 모두에 남는다 (이건 모드와 무관하다)', () => {
    for (const rules of [SEARCH_RULES, DISCOVER_RULES]) {
      expect(rules).toContain('순서를 매기세요');
      expect(rules).toContain('값을 약속했으면 값을 적으세요');
    }
  });
});

describe('③ 돌아온 제목이 디스커버 정책에 걸리는지 본다', () => {
  it('⭐⭐ 낚시 제목을 잡아낸다', () => {
    const r = postProcessAgentArticle('<h2>본문</h2>', {
      contentMode: 'discover',
      title: '전기요금 올렸더니 결과는 충격적',
    });
    expect(r.titleViolations.length).toBeGreaterThan(0);
    expect(r.warnings.join(' ')).toContain('디스커버');
  });

  it('⭐⭐ 멀쩡한 디스커버 제목은 통과시킨다', () => {
    const r = postProcessAgentArticle('<h2>본문</h2>', {
      contentMode: 'discover',
      title: '2026년 전기요금 누진 3단계가 4인 가구에 미치는 영향',
    });
    expect(r.titleViolations).toHaveLength(0);
  });

  it('⭐⭐ 검색 모드에서는 디스커버 규칙으로 트집 잡지 않는다', () => {
    const r = postProcessAgentArticle('<h2>본문</h2>', {
      contentMode: 'adsense',
      title: '전기요금 올렸더니 결과는 충격적',
    });
    expect(r.titleViolations).toHaveLength(0);
  });

  it('⭐⭐ 검사는 알리기만 하고 막지 않는다 (에이전트 실행에 이미 몇 분을 썼다)', () => {
    expect(() => postProcessAgentArticle('<p>x</p>', { contentMode: 'discover', title: '충격' })).not.toThrow();
  });

  it('⭐ 옵션을 안 줘도 예전처럼 돈다', () => {
    const r = postProcessAgentArticle('<p>본문입니다.</p>');
    expect(r.titleViolations).toEqual([]);
    expect(r.html).toBe('<p>본문입니다.</p>');
  });
});

describe('④ 실제로 배선돼 있다', () => {
  it('⭐⭐ 지시서가 contentMode 를 넘긴다 (안 넘기면 늘 검색 모드다)', () => {
    const idx = mainTs.indexOf('buildAgentHarnessRules(');
    const block = mainTs.slice(idx, mainTs.indexOf('})', idx));
    expect(block).toContain('contentMode');
  });

  it('⭐⭐ 모드 값이 실제로 payload 를 타고 온다 (안 오면 늘 검색 모드다)', () => {
    // posting.js 가 payload.contentMode 를 담고, codex-workshop 이 그 payload 를
    // 통째로 request 에 실어 보낸다. 한 군데라도 끊기면 조용히 무효가 된다.
    const posting = read('electron/ui/modules/posting.js');
    const workshop = read('electron/ui/modules/codex-workshop.js');
    expect(posting).toContain('contentMode: contentModeValue');
    expect(workshop).toContain('payload,');
  });

  it('⭐⭐ 모드는 metadata.json 이 아니라 payload.json 에서 읽는다', () => {
    // metadata.json 은 에이전트가 만든 파일이라 우리 설정값이 들어 있지 않다
    expect(mainTs).toContain("path.join(jobDir, 'payload.json')");
  });

  it('⭐⭐ 결과 후처리에도 모드와 제목을 넘긴다', () => {
    const idx = mainTs.indexOf('postProcessAgentArticle(');
    const block = mainTs.slice(idx, mainTs.indexOf(');', idx));
    expect(block).toContain('contentMode');
    expect(block).toContain('title');
  });
});
