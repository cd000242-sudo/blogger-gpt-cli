/**
 * v3.8.588 — 제도가 올해 바뀌었는지 **쓰기 전에** 물어본다
 *
 * ## 실측 사고 (발행글 5429)
 * 2026년 글인데 내용이 2025년 체계였다.
 *   글:      기업 720만원 + 청년 480만원 (2025년 유형Ⅰ·Ⅱ)
 *   실제 2026: 수도권형 / 비수도권형으로 개편, 신청은 고용24
 * 본문에 수도권형·비수도권형이 **0회**. 2026년 독자의 첫 질문("나는 어느 쪽인가")이
 * 통째로 빠졌다.
 *
 * ## 왜 잡기 어려운가
 * 숫자를 지어낸 게 아니라 **작년 숫자에 올해 라벨을 달았다.** 그 숫자는 자료에 실제로
 * 있으므로 fact-guard 도 통과한다. 게이트가 못 보는 종류의 오류다.
 *
 * ## 왜 기존 최신성 검사로는 못 막았나
 * `checkFreshness` 는 글을 **다 쓴 뒤** 도는 사후 경고다. 게다가 근거 수집은 키워드
 * 전체로 검색하는데, 그 키워드가
 *   `2026년 청년일자리도약장려금 비즈스캔 사업소득 있으면 가능한지`
 * 처럼 길어 개편 정보가 상위에 오지 않았다.
 *
 * 제도명만 떼어 `{제도명} {올해} 개편` 으로 물으면 1차 소스가 바로 나온다(실측):
 *   "2026년 청년일자리도약장려금 사업운영 지침('26.1월) | 고용노동부"
 *   "'26년 청년일자리도약장려금 지방 기업·청년의 성장을 지원합니다 | 고용노동부"
 */
import {
  looksLikeInstitution, checkReform, buildReformBlock, describeReform,
} from '../src/core/final/reform-check';

const search = (lines: string[]) => (async () => ({ ok: true, items: lines.map((l) => ({ title: l, description: '' })) })) as any;

describe('① 제도처럼 보이는 이름만 물어본다', () => {
  test('제도·지원금 꼬리를 가진 이름을 고른다', () => {
    for (const t of ['청년일자리도약장려금', '두루누리지원금', '국민취업지원제도', '노란우산공제']) {
      expect(looksLikeInstitution(t)).toBe(true);
    }
  });

  test('제도가 아닌 이름은 묻지 않는다 (호출만 는다)', () => {
    for (const t of ['비즈스캔', '항공권', '워크넷']) {
      expect(looksLikeInstitution(t)).toBe(false);
    }
  });

  test('제도 이름이 없으면 검색조차 하지 않는다', async () => {
    let called = 0;
    const spy = (async () => { called += 1; return { ok: true, items: [] }; }) as any;
    expect(await checkReform(['비즈스캔', '항공권'], 2026, spy)).toBeNull();
    expect(called).toBe(0);
  });
});

describe('② 올해 + 바뀜의 신호가 함께 있어야 받는다', () => {
  test('올해 자료이면서 개편을 말하면 받는다', async () => {
    const f = await checkReform(['청년일자리도약장려금'], 2026,
      search(["2026년 청년일자리도약장려금 개편 — 수도권형과 비수도권형으로 나뉩니다"]));
    expect(f).not.toBeNull();
    expect(f!.snippets[0]).toContain('비수도권형');
  });

  test('올해 이야기가 아니면 안 받는다 (작년 개편을 올해 것처럼 쓰면 안 된다)', async () => {
    const f = await checkReform(['청년일자리도약장려금'], 2026,
      search(['2024년 청년일자리도약장려금 개편 안내']));
    expect(f).toBeNull();
  });

  test('올해 자료여도 바뀐 얘기가 없으면 안 받는다', async () => {
    const f = await checkReform(['청년일자리도약장려금'], 2026,
      search(['2026년 청년일자리도약장려금 신청 서류 목록']));
    expect(f).toBeNull();
  });

  /** 연도 표기가 '26 처럼 짧은 자료가 실제로 많다 */
  test("'26 같은 짧은 연도 표기도 읽는다", async () => {
    const f = await checkReform(['청년일자리도약장려금'], 2026,
      search(["'26년 청년일자리도약장려금 지방 기업·청년 지원으로 개편"]));
    expect(f).not.toBeNull();
  });

  test('검색이 실패해도 던지지 않는다', async () => {
    const boom = (async () => { throw new Error('망함'); }) as any;
    await expect(checkReform(['청년일자리도약장려금'], 2026, boom)).resolves.toBeNull();
  });
});

describe('③ 프롬프트가 진짜 위험을 짚는다', () => {
  const finding = {
    institution: '청년일자리도약장려금',
    snippets: ['2026년 청년일자리도약장려금 개편 — 지방 기업·청년 지원'],
    newTerms: ['지원규모', '채용하면', '모두에게'],
  };

  test('작년 숫자에 올해 라벨 붙이지 말라고 못 박는다', () => {
    const b = buildReformBlock(finding, 2026);
    expect(b).toContain('작년 숫자에 올해 라벨');
    expect(b).toContain('팩트 검사도 통과합니다');
  });

  test('실제 사고를 예시로 박아 둔다', () => {
    const b = buildReformBlock(finding, 2026);
    expect(b).toContain('720만원');
    expect(b).toContain('480만원');
  });

  test('새 구분을 앞쪽에 두라고 한다 (독자의 첫 질문이다)', () => {
    expect(buildReformBlock(finding, 2026)).toContain('나는 어느 쪽인가');
  });

  /**
   * 뽑아낸 "새 개념"은 프롬프트에 넣지 않는다.
   * 실측에서 나온 게 정책뉴스·달라진·청년을·채용하면·모두에게 였다.
   * 못 미더운 지시를 넣으면 엉뚱한 낱말을 본문에 심게 된다.
   */
  test('못 미더운 낱말 목록은 프롬프트에 넣지 않는다', () => {
    const b = buildReformBlock(finding, 2026);
    for (const noisy of finding.newTerms) expect(b).not.toContain(noisy);
  });

  test('진단용으로 로그에는 남긴다', () => {
    expect(describeReform(finding)).toContain('지원규모');
  });

  test('개편 흔적이 없으면 프롬프트를 늘리지 않는다', () => {
    expect(buildReformBlock(null, 2026)).toBe('');
    expect(describeReform(null)).toContain('없음');
  });
});

describe('④ 발행 경로에 배선돼 있다', () => {
  const fs = require('fs');
  const path = require('path');
  const orch = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf-8',
  );

  test('import 하고 부른다', () => {
    expect(orch).toContain("from './reform-check'");
    expect(orch).toContain('await checkReform(');
  });

  /** 만들고 안 넣으면 죽은 코드다 */
  test('만든 블록이 프롬프트에 실제로 들어간다', () => {
    expect(orch).toContain('...(reformBlock ? [reformBlock] : [])');
  });

  test('고유명사 확인 결과를 그대로 넘겨 쓴다 (검색을 두 번 하지 않는다)', () => {
    expect(orch).toContain('checkReform(findings.map((f) => f.token)');
  });
});
