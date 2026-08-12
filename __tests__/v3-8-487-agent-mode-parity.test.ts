/**
 * v3.8.487 — 에이전트 모드를 API 경로와 같은 수준으로 (전 모드)
 *
 * 사장님: "api키를 안쓰려고 에이전트모드를 쓰는거니까 api랑똑같이 다되야죠"
 *
 * ## 실측한 격차
 * 에이전트 지시서(buildAgentJobInstructions) 안을 세어보니:
 *   shopping / 쇼핑        0건
 *   coupang / 쿠팡         0건
 *   adsense / 애드센스      0건
 *   paraphrasing           0건
 *   제휴 / 공정위           0건
 * 즉 **어떤 모드도 배선돼 있지 않았다.** 쇼핑 모드로 돌려도 정보성 글이 나온다.
 *
 * ## 두 갈래로 나뉜다
 * (가) 프롬프트로 되는 것 — 모드별 섹션 구성·역할·필수 요소. 여기서 다룬다.
 * (나) 코드가 해야 하는 것 — 쿠팡 상품 검색·제휴링크·위젯·공정위 배너.
 *      에이전트는 텍스트만 만들고 외부 API 를 못 쓰므로 글을 받은 뒤 앱이 붙인다.
 *
 * 쿠팡 파트너스는 사장님 제휴 계정이지 유료 LLM API 가 아니다 —
 * "API 키를 안 쓴다"는 취지(유료 생성 API 회피)에 어긋나지 않는다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildAgentHarnessRules } from '../src/core/final/agent-harness';
import { buildModeStructureBlock } from '../src/core/final/agent-mode-structure';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const mainTs = read('electron/main.ts');

const forMode = (contentMode: string) =>
  buildAgentHarnessRules({ keyword: '무선 이어폰', currentYear: 2026, contentMode });

describe('① 모드별 섹션 구성이 지시서에 들어간다', () => {
  it('⭐⭐ 쇼핑 모드는 구매 퍼널 구성을 받는다', () => {
    const block = buildModeStructureBlock('shopping', '무선 이어폰');
    expect(block).toContain('쇼핑 전환 모드');
    expect(block).toContain('단점');
  });

  it('⭐⭐ 애드센스 모드는 자기 구성을 받는다', () => {
    const block = buildModeStructureBlock('adsense', '무선 이어폰');
    expect(block.length).toBeGreaterThan(200);
    expect(block).not.toContain('쇼핑 전환 모드');
  });

  it('⭐⭐ 모드마다 내용이 실제로 다르다 (같으면 배선한 의미가 없다)', () => {
    const blocks = ['shopping', 'adsense', 'paraphrasing', 'external', 'internal']
      .map((m) => buildModeStructureBlock(m, '무선 이어폰'));
    expect(new Set(blocks).size).toBe(blocks.length);
  });

  it('⭐⭐ 섹션의 역할·필수 요소가 들어간다 (제목만 주면 일반론이 나온다)', () => {
    const block = buildModeStructureBlock('shopping', '무선 이어폰');
    expect(block).toContain('역할');
    expect(block).toContain('필수');
  });

  it('⭐ 등록되지 않은 모드는 빈 문자열 (없는 구성을 지어내지 않는다)', () => {
    expect(buildModeStructureBlock('nonexistent', '무선 이어폰')).toBe('');
    expect(buildModeStructureBlock('', '무선 이어폰')).toBe('');
  });

  it('⭐⭐ 하네스가 실제로 붙인다 (모듈만 만들고 안 쓰면 무효)', () => {
    expect(forMode('shopping')).toContain('쇼핑 전환 모드');
    expect(forMode('adsense')).not.toContain('쇼핑 전환 모드');
  });

  it('⭐⭐ 모드를 안 줘도 나머지 규칙은 그대로 나온다', () => {
    const plain = buildAgentHarnessRules({ keyword: '무선 이어폰', currentYear: 2026 });
    expect(plain).toContain('순서를 매기세요');
    expect(plain).toContain('값을 약속했으면 값을 적으세요');
  });
});

describe('② 쇼핑 모드는 가격을 지어내지 못하게 막는다', () => {
  it('⭐⭐ 쿠팡 실제 데이터가 없으면 구체 숫자 금지 규칙이 들어간다', () => {
    expect(buildModeStructureBlock('shopping', '무선 이어폰')).toContain('가격');
  });

  it('⭐⭐ 상품 링크는 에이전트가 만들지 말라고 못 박는다', () => {
    // 에이전트가 지어낸 쿠팡 링크는 100% 죽은 링크다. 앱이 실제 제휴링크를 붙인다.
    expect(forMode('shopping')).toContain('상품 링크를 직접 만들지 마세요');
  });
});

describe('③ 지시서에 배선돼 있다', () => {
  it('⭐⭐ contentMode 를 넘겨 모드 구성을 받는다', () => {
    const idx = mainTs.indexOf('buildAgentHarnessRules(');
    const block = mainTs.slice(idx, mainTs.indexOf('})', idx));
    expect(block).toContain('contentMode');
  });
});

/**
 * ④ 에이전트의 최대 강점 — 스스로 검색해서 최신 사실을 확보하는 것
 *
 * 사장님: "에이전트로하면 초반에 검색추론이 가능하지않니?? api는 크롤링을 하지만
 *          에이전트는 검색추론을해서 더욱 실시간으로 팩트체크를 강화해서"
 *
 * 맞는 말이었고, 그 능력을 아예 안 쓰고 있었다. 지시서에 검색하라는 말이 한 줄도 없었다.
 */
describe('④ 쓰기 전에 먼저 찾아보라고 시킨다', () => {
  it('⭐⭐ 검색을 먼저 하라고 명시한다', () => {
    const rules = forMode('external');
    expect(rules).toContain('먼저 찾아보고, 그다음에 쓰세요');
    expect(rules).toContain('바로 쓰기 시작하지 마세요');
  });

  it('⭐⭐ 모드마다 찾을 것이 다르다', () => {
    expect(forMode('shopping')).toContain('실제 판매 중인 제품');
    expect(forMode('adsense')).toContain('1차 출처');
    expect(forMode('discover')).toContain('시의성');
  });

  it('⭐⭐ 확인 못 한 수치는 쓰지 말라고 한다', () => {
    expect(forMode('external')).toContain('검색으로 확인하지 못한 수치');
  });

  it('⭐⭐ 검색이 막혀 있어도 글은 나오게 한다 (작업이 실패하면 안 된다)', () => {
    const rules = forMode('external');
    expect(rules).toContain('검색 도구를 쓸 수 없다면');
    expect(rules).toContain('지어내는 것보다 빼는 것이 낫습니다');
  });

  it('⭐⭐ 참고한 주소를 metadata 에 남기라고 한다 (뭘 보고 썼는지 확인 가능해야 한다)', () => {
    expect(forMode('external')).toContain('sources');
    expect(mainTs).toContain('"sources"');
  });

  it('⭐⭐ Codex 실행 시 웹 검색을 켠다', () => {
    // codex exec 에는 --search 플래그가 없다 (실측) — config 로 켜야 한다
    expect(mainTs).toContain("'tools.web_search=true'");
    // 인자 배열 자체를 본다 (주석에도 --strict-config 가 나오므로 텍스트 창으로 보면 오판한다)
    expect(mainTs).toContain("'--sandbox', 'workspace-write'");
    // --strict-config 를 인자로 넘기면 모르는 키에서 실행이 통째로 깨진다
    expect(mainTs).not.toContain("'--strict-config'");
  });
});

/**
 * ⑤ 받아 적는 작성자가 아니라 판단하는 운영자로 세운다
 *
 * 사장님: "월 10억이상 수익을 내는 블로거자체가 되서 내툴에 있는 프롬프트와 기능들을
 *          분석해서 그에맞게 글을 생성시킨다고 보면되"
 *
 * 페르소나 문구만으로는 글이 크게 달라지지 않는다. 실제 차이는 **순서를 강제**하는 데서 온다 —
 * 읽고 → 찾고 → 계획하고 → 쓴다. 지금까지는 곧장 쓰게 했다.
 */
describe('⑤ 읽고, 찾고, 계획하고, 쓴다', () => {
  const rules = forMode('shopping');

  it('⭐⭐ 곧장 쓰지 말라고 못 박는다', () => {
    expect(rules).toContain('곧장 본문부터 쓰지 마세요');
  });

  it('⭐⭐ 규칙을 외우지 말고 이유를 읽으라고 한다', () => {
    expect(rules).toContain('문구를 외우지 말고 이유를 읽으세요');
  });

  it('⭐⭐ 계획을 파일로 남기게 한다 (머릿속 계획은 지켰는지 알 수 없다)', () => {
    expect(rules).toContain('result/plan.md');
    expect(mainTs).toContain('result/plan.md');
  });

  it('⭐⭐ 다 쓴 뒤 자가 검토 항목을 준다', () => {
    expect(rules).toContain('누구나 쓸 수 있는 문장만 남은 문단은 없는가');
  });

  it('⭐⭐ 모드 이름을 사람 말로 알려준다', () => {
    expect(forMode('shopping')).toContain('쇼핑·구매 전환');
    expect(forMode('discover')).toContain('구글 디스커버');
  });

  it('⭐⭐ 운영자 브리핑이 규칙보다 먼저 온다 (읽는 방식을 먼저 정해줘야 한다)', () => {
    const briefIdx = rules.indexOf('작성자가 아니라 운영자입니다');
    const rulesIdx = rules.indexOf('순서를 매기세요');
    expect(briefIdx).toBeGreaterThan(-1);
    expect(briefIdx).toBeLessThan(rulesIdx);
  });

  it('⭐⭐ 검색+계획을 하려면 턴이 충분해야 한다 (모자라면 글이 잘린 채 회수된다)', () => {
    const m = mainTs.match(/'--max-turns',\s*'(\d+)'/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(20);
  });
});
