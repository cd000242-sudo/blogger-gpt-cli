/**
 * v3.8.582 — 유료 팩트체크를 **최후의 보루**로 내린다
 *
 * 사장님: "내가원하는건 최후의보루로퍼플렉인데 네이버api랑 크롤링만해도충분할까?"
 *
 * ## 충분한가 — 실측으로 답했다
 * 같은 키워드(해외 항공권 취소 수수료 면제)를 같은 코드로 두 번 뽑아 앱 게이트로 쟀다.
 * 차이는 퍼플렉시티 생사뿐이었다:
 *
 *   퍼플렉시티 없이  근거 13,747자 · 실속 63 · 회피 3건 · 빈 단락 26/39
 *   퍼플렉시티 함께  근거 21,169자 · 실속 82 · 회피 1건 · 빈 단락 18/39
 *
 * 무료만으로도 **모든 관문을 통과했다**(실속 게이트·근거 일치·구조 검사 전부).
 * 즉 유료는 "되게 하는" 게 아니라 "더 낫게 하는" 것이다.
 * 그러면 매 글마다 ₩35~45 를 낼 이유가 없다 — 모자랄 때만 낸다.
 *
 * ## 예전엔 왜 매번 냈나
 * 순서가 거꾸로였다. `fetchFactContext`(퍼플렉시티)를 먼저 부르고 네이버 근거를
 * 그 뒤에 보탰다. 무료 근거가 아무리 두꺼워도 이미 돈은 나간 뒤였다.
 *
 * ## 모자람의 기준
 * **권위 있는 출처가 하나도 없을 때**다. 뉴스도 기관 문서도 0건이면 남은 건
 * 블로그·일반 웹뿐이고, 그게 사장님이 처음 걱정한 상황이다("잘못된 정보면 그대로 통과").
 * 실측에서 어린이집 건은 뉴스 0건이었지만 기관 원문이 10건이라 올라가지 않는다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';

const orch = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf-8',
);

describe('① 무료 근거를 먼저 모은다 (순서가 뒤집혔다)', () => {
  test('fetchGrounding 이 fetchFactContext 보다 앞이다', () => {
    const free = orch.indexOf('await fetchGrounding(keyword');
    const paid = orch.indexOf('await fetchFactContext(keyword');
    expect(free).toBeGreaterThan(-1);
    expect(paid).toBeGreaterThan(-1);
    expect(free).toBeLessThan(paid);
  });

  test('무료 근거 건수를 판단에 쓸 수 있게 들고 있는다', () => {
    expect(orch).toContain('groundingStats');
    expect(orch).toContain('newsCount');
    expect(orch).toContain('officialCount');
  });
});

describe('② 충분하면 돈을 쓰지 않는다', () => {
  const decision = blockBetween(orch, 'const FREE_EVIDENCE_MIN_CHARS', '// v3.8.265');

  test('권위 있는 출처(뉴스·기관)가 있는지로 판단한다', () => {
    expect(decision).toContain('newsCount');
    expect(decision).toContain('officialCount');
    expect(decision).toContain('authoritative === 0');
  });

  test('건너뛸 때 왜 건너뛰는지 남긴다 (조용히 넘어가면 진단이 안 된다)', () => {
    expect(decision).toContain('무료 근거로 충분합니다');
    expect(decision).toContain('유료 팩트체크 건너뜀');
  });

  test('올라갈 때도 왜 올라가는지 남긴다', () => {
    expect(orch).toContain('무료 근거가 얇습니다');
  });

  test('건너뛰어도 근거 출처는 기록한다 (provider 가 none 으로 남으면 안 된다)', () => {
    expect(decision).toContain("provider: 'Naver Grounding'");
  });
});

describe('③ 사용자가 직접 고르면 그대로 부른다 (돈은 사장님 것이다)', () => {
  const decision = blockBetween(orch, 'const FREE_EVIDENCE_MIN_CHARS', '// v3.8.265');

  test('드롭다운에서 퍼플렉시티·그라운딩을 고르면 조건을 따지지 않는다', () => {
    expect(decision).toContain("rawFactMode === 'perplexity'");
    expect(decision).toContain("rawFactMode === 'grounding'");
    expect(decision).toContain('userChosePaid || freeEvidenceThin');
  });

  test('사용자 선택이면 "얇다" 안내를 띄우지 않는다 (스스로 고른 것이다)', () => {
    // 안내는 유료 호출 블록 안에 있다 — 판단 블록이 아니라 거기서 찾는다
    const paidBlock = blockBetween(orch, 'if (shouldPayForFacts) {', 'await fetchFactContext(keyword');
    expect(paidBlock).toContain('freeEvidenceThin && !userChosePaid');
  });
});

describe('④ 판단 기준이 실측값에 묶여 있다', () => {
  test('왜 그 기준인지 근거가 코드에 적혀 있다', () => {
    const why = blockBetween(orch, '② 유료 팩트체크는', 'const FREE_EVIDENCE_MIN_CHARS');
    expect(why).toContain('13,747');   // 무료만
    expect(why).toContain('21,169');   // 유료 함께
    expect(why).toContain('실속 63');
    expect(why).toContain('실속 82');
  });

  /**
   * v3.8.585 정정 — 예전엔 크롤 건수(5건 미만)도 조건이었다. 뺐다.
   * URL 입력 모드는 사용자가 준 주소 하나만 크롤하는 게 정상인데, 그걸 "재료가 얇다"로
   * 읽어 근거가 넉넉한데도(밀도 16.07 · 권위 10건) ₩40 을 썼다.
   * 크롤 건수는 근거의 양이 아니라 **경로**다 — 양은 밀도와 길이로 이미 재고 있다.
   */
  test('근거의 양으로 판단하지 경로 수로 판단하지 않는다', () => {
    const decision = blockBetween(orch, 'const thinReasons', '// v3.8.265');
    expect(decision).toContain('ledgerDensity');
    expect(decision).toContain('naverGrounding.length');
    expect(decision).not.toContain('crawledPosts.length < 5');
  });
});

/**
 * ⑤ 판단 기준은 "돌아가느냐"가 아니라 "좋게 나오느냐" (v3.8.583)
 *
 * 사장님: "점수가높아야되 간당간당하면 자동으로내툴을쓸이유가없지 글도이탈률이높을테고"
 *
 * 맞는 말이다. 그래서 기준을 실속 점수의 **주된 동력**에 묶었다 —
 * 100점 중 50점이 팩트 밀도이고, 기사 밀도는 장부 밀도의 절반쯤이다(실측).
 *
 * 실측 장부 밀도(같은 자로 잰 것):
 *   해외 항공권 7.56 · 헬스장 6.71 · 전세보증금 6.44 · 실손보험 13.93
 *   퍼플렉시티  10.14 ·      15.42 ·          12.05 ·          25.23
 * 무료만으로 넉넉한 건 실손보험 하나뿐이었다 — 그때는 돈을 안 쓴다.
 */
describe('⑤ 팩트 밀도로 판단한다', () => {
  const decision = blockBetween(orch, 'const FREE_EVIDENCE_MIN_CHARS', '// v3.8.265');

  test('게이트가 기사에 쓰는 것과 같은 자를 쓴다', () => {
    expect(decision).toContain("require('./substance-gate')");
    expect(decision).toContain('factsPer1000');
  });

  test('밀도가 낮으면 유료로 보강한다', () => {
    expect(decision).toContain('ledgerDensity < LEDGER_FACT_DENSITY_MIN');
  });

  test('기준이 왜 그 값인지 실측이 적혀 있다', () => {
    const why = blockBetween(orch, '장부의 **팩트 밀도** 하한', 'const LEDGER_FACT_DENSITY_MIN');
    expect(why).toContain('7.56');    // 무료 장부
    expect(why).toContain('실속 63');
    expect(why).toContain('실속 82');
    expect(why).toContain('13.93');   // 무료로 충분했던 경우
  });

  test('못 재도 발행을 막지 않는다 (다른 조건으로 넘어간다)', () => {
    expect(decision).toContain('catch');
    expect(decision).toContain('let ledgerDensity = 0');
  });

  test('로그에 밀도를 남긴다 (왜 그렇게 정했는지 보여야 한다)', () => {
    expect(orch).toContain('팩트 밀도 ${ledgerDensity}');
  });
});

/**
 * ⑥ 에이전트 모드에도 근거 장부를 넘긴다 (v3.8.583)
 *
 * 에이전트 모드는 orchestration 을 타지 않아 크롤링·네이버 근거·팩트체크가
 * 하나도 넘어가지 않았다. 넘어가던 건 키워드·연도·수요질문·모드뿐이다.
 * 네이버 근거는 공짜이고 구독 CLI 도 공짜라, 합치면 ₩0 에 검증까지 된다.
 */
describe('⑥ 에이전트도 같은 근거를 받는다', () => {
  const harness = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'core', 'final', 'agent-harness.ts'), 'utf-8',
  );
  const main = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.ts'), 'utf-8');

  test('지시서에 근거 자리가 있다', () => {
    expect(harness).toContain('evidence?: string');
    expect(harness).toContain('buildEvidenceBlock(input.evidence)');
  });

  test('"참고하라"가 아니라 "숫자를 옮기라"고 시킨다 (밀도가 점수다)', () => {
    const block = blockBetween(harness, 'function buildEvidenceBlock', 'export function buildAgentHarnessRules');
    expect(block).toContain('그대로 옮겨 쓴다');
    expect(block).toContain('숫자를 빼지 않는다');
  });

  test('출처 우선순위를 알려준다 (뉴스·공식이 블로그보다 앞)', () => {
    const block = blockBetween(harness, 'function buildEvidenceBlock', 'export function buildAgentHarnessRules');
    expect(block).toContain('[블로그]');
    expect(block).toContain('우선한다');
  });

  test('근거가 없으면 예전과 똑같이 동작한다', () => {
    const block = blockBetween(harness, 'function buildEvidenceBlock', 'export function buildAgentHarnessRules');
    expect(block).toContain("if (!text) return ''");
  });

  test('main.ts 가 실제로 모아서 실어 보낸다', () => {
    expect(main).toContain('agentEvidenceBlock');
    expect(main).toContain("require('../dist/core/final/naver-grounding')");
    expect(main).toContain('evidence: String((payload as any)?.agentEvidenceBlock');
  });

  test('근거 수집이 실패해도 에이전트 실행을 막지 않는다', () => {
    const block = blockBetween(main, '[AGENT-GROUNDING]', 'writeAgentJobFiles(jobDir');
    expect(block).toContain('catch');
    expect(block).not.toContain('throw');
  });
});

/**
 * ⑦ 빈 단락을 만드는 통로를 막았다 (v3.8.583)
 *
 * ## 실측 진단
 * 실속 점수 100점 중 15점이 "팩트 없는 단락 비율"인데, 실제 글은 63~73% 가 비어 있어
 * **그 15점을 통째로 잃고 있었다**(상한 55%).
 *
 * 빈 단락의 정체는 두 가지였다:
 *   · 짧은 목록 항목 20개 — "이미 사용한 구간이 있는지" (볼 거리만 있고 값이 없다)
 *   · 서술 문단 24개 — "항공사, 운임, 출발일이 함께 적용됩니다" (설명만 하고 숫자가 없다)
 *
 * ## 원인은 규칙과 게이트의 불일치였다
 * 규칙 6이 "숫자를 못 찾으면 판단 기준·절차를 쓰라"고 **면제 통로**를 열어 뒀는데,
 * 게이트는 그렇게 쓴 문단을 빈 단락으로 센다. 규칙을 지켰는데 점수가 깎이는 구조다.
 *
 * ## 게이트를 넓히는 건 눈속임이라 안 했다
 * 서류명·메뉴경로·법령명 패턴을 게이트에 추가해 재봤더니 53→53, 51→51 로
 * **하나도 안 변했다** — 그런 것조차 안 쓰고 있었다. 측정을 후하게 바꿔서
 * 점수만 올리는 건 글을 좋게 만드는 게 아니다. 그래서 프롬프트를 고쳤다.
 */
describe('⑦ 실속 규칙이 빈 단락을 겨냥한다', () => {
  const rules = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'core', 'final', 'substance-rules.ts'), 'utf-8',
  );
  const firstPass = blockBetween(rules, 'SUBSTANCE_FIRST_PASS_RULES = `', 'export const FRESHNESS_RULES');

  test('규칙 1이 실측 실패율을 그대로 알려준다 (막연한 당부는 안 먹힌다)', () => {
    expect(firstPass).toContain('63~73%');
    expect(firstPass).toContain('자동으로 검사됩니다');
  });

  test('깨지는 자리를 짚어 준다', () => {
    expect(firstPass).toContain('전환 문단');
    expect(firstPass).toContain('목록 항목');
  });

  test('규칙 6이 규칙 1의 면제로 쓰이지 않게 막는다', () => {
    const rule6 = blockBetween(firstPass, '**6. 숫자를 확인할 수 없으면', '**7.');
    expect(rule6).toContain('면제로 쓰지 마세요');
    expect(rule6).toContain('기관 이름이나 조항 번호');
  });

  test('목록 항목 규칙(8)이 판정까지 요구한다', () => {
    const rule8 = blockBetween(firstPass, '**8. 목록 항목은', '항목 하나가');
    expect(rule8).toContain('출발일 기준 91일 이전인지');        // 실제로 나온 나쁜 예
    expect(rule8).toContain('환불 수수료 면제');                  // 고친 예
  });

  test('규칙 번호가 순서대로다 (프롬프트가 뒤죽박죽이면 읽히지 않는다)', () => {
    const order = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => firstPass.indexOf(`**${n}.`));
    for (const at of order) expect(at).toBeGreaterThan(-1);
    for (let i = 1; i < order.length; i += 1) expect(order[i]).toBeGreaterThan(order[i - 1]!);
  });

  test('추가 LLM 호출을 만들지 않는다 (첫 생성 프롬프트에만 얹는다)', () => {
    // 재생성은 여전히 opt-in 이어야 한다 — 매 편 본문급 호출이 붙으면 비용이 두 배가 된다
    expect(rules).toContain('재생성은 opt-in');
  });
});

/**
 * ⑧ 앱이 스스로 감점당하던 문구 (v3.8.584)
 *
 * CTA 마다 고정으로 붙던 "정확한 내용은 공식 사이트에서 확인해주세요."는
 * **실속 게이트가 잡으려고 만들어진 바로 그 문장**이었다.
 * substance-gate.ts 머리말에 나쁜 예로 적혀 있고, 실속 규칙 3도
 * "공식 사이트에서 확인하세요로 문단을 끝내지 마세요"라고 우리가 써 놨는데,
 * 정작 앱이 그 문장을 글마다 넣고 있었다.
 *
 * 실측(2026-08-29): 회피 4건 중 1건이 이 고정 문구. 회피는 20점 항목이다.
 * 무엇보다 독자에게 아무것도 알려주지 않는다.
 */
describe('⑧ CTA 문구가 회피로 잡히지 않는다', () => {
  const { scanSubstance } = require('../src/core/final/substance-gate');
  const filler = '환불 수수료는 출발 91일 이전이면 면제됩니다. '.repeat(20);
  const vague = (line: string) => {
    const m = scanSubstance({ contentHtml: `<p>${filler}${line}</p>` }).metrics;
    return m.deferrals + m.hedges;
  };

  test('예전 문구는 회피로 잡혔다 (게이트가 옳았다)', () => {
    expect(vague('정확한 내용은 공식 사이트에서 확인해주세요.')).toBeGreaterThan(0);
  });

  test('지금 쓰는 문구 셋은 모두 회피가 아니다', () => {
    for (const line of [
      '검색 결과 페이지입니다. 주소가 기관 도메인(go.kr·or.kr)인지 보고 들어가세요.',
      '기관이 직접 운영하는 안내 페이지입니다.',
      '운영 주체가 직접 안내하는 페이지입니다.',
    ]) expect(vague(line)).toBe(0);
  });

  test('그 문구들이 실제로 orchestration 에 박혀 있다', () => {
    // 주석에는 나쁜 예로 남겨 뒀으므로 파일 전체가 아니라 **코드 블록**만 본다
    const block = blockBetween(orch, 'microcopy: sectionCta.searchFallback', 'markRenderedCta');
    expect(block).toContain('기관이 직접 운영하는 안내 페이지입니다.');
    expect(block).toContain('운영 주체가 직접 안내하는 페이지입니다.');
    expect(block).not.toContain('정확한 내용은 공식 사이트에서 확인해주세요.');
  });

  test('공공기관일 때만 "기관"이라고 부른다 (민간에 붙이면 독자를 속인다)', () => {
    const block = blockBetween(orch, 'microcopy: sectionCta.searchFallback', 'markRenderedCta');
    expect(block).toContain('isOfficialDestination(sectionCta.url)');
  });
});

/**
 * ⑨ 로그가 진짜 이유를 말한다 (v3.8.585)
 *
 * ## 실측 사고 — 사장님이 준 URL 로 글을 뽑다가 나왔다
 *   `🛟 무료 근거가 얇습니다 (팩트 밀도 16.07 < 12 · 권위 출처 10건)`
 * **16.07 은 12 보다 크다.** 밀도는 충분했는데 다른 조건에 걸린 것을 밀도 탓으로 찍었다.
 * 조건을 OR 로 묶고 메시지에 밀도를 무조건 끼워 넣은 탓이다.
 * 이런 로그는 진단을 불가능하게 만든다 — 이 저장소가 v3.8.578 에서 이미 데인 병이다.
 *
 * ## 그리고 조건 자체도 틀렸다
 * 걸린 건 `crawledPosts.length < 5` 였는데, **URL 입력 모드는 URL 하나만 크롤하는 게 정상**이다.
 * 근거가 넉넉한데도(밀도 16.07 · 권위 10건) ₩40 을 썼다.
 * 크롤 건수는 근거의 양이 아니라 경로다 — 양은 밀도와 길이로 이미 재고 있다.
 */
describe('⑨ 유료로 올라간 이유를 정확히 남긴다', () => {
  const decision = blockBetween(orch, 'const thinReasons', '// v3.8.265');

  test('이유를 모아서 그대로 찍는다 (밀도를 무조건 끼워 넣지 않는다)', () => {
    expect(decision).toContain('thinReasons.push');
    expect(orch).toContain('thinReasons.join(" · ")');
  });

  test('세 가지 이유를 각각 구분해 담는다', () => {
    expect(decision).toContain('권위 있는 출처 0건');
    expect(decision).toContain('팩트 밀도');
    expect(decision).toContain('FREE_EVIDENCE_MIN_CHARS');   // 근거 길이 하한
  });

  test('크롤 건수는 더 이상 단독 조건이 아니다 (URL 모드는 1건이 정상)', () => {
    expect(decision).not.toContain('crawledPosts.length < 5');
  });

  test('이유가 하나도 없으면 무료로 간다', () => {
    expect(decision).toContain('thinReasons.length > 0');
  });

  test('왜 크롤 건수를 뺐는지 근거가 적혀 있다', () => {
    const why = blockBetween(orch, '왜 유료로 올라가는지', 'const thinReasons');
    expect(why).toContain('16.07');
    expect(why).toContain('URL 입력 모드');
  });
});
