/**
 * 키워드 수요 실측 게이트 테스트 (v3.8.383)
 *
 * 핵심 불변식:
 *   1) 어떤 실패에서도 throw 하지 않는다 — 게이트는 발행을 절대 막지 않는다.
 *   2) "가장 길면서 측정 가능한 변형"을 검색되는 표현으로 고른다 (최대 볼륨이 아니라).
 *      머리 절단형은 거의 항상 볼륨이 더 크므로, 볼륨 최대를 고르면 항상 1토큰
 *      헤드로 퇴화해 롱테일 전략 자체가 무너진다.
 */
import {
  buildVariants,
  buildDatalabBody,
  composeTitleHint,
  analyzeKeywordDemand,
} from '../src/core/keyword-demand';

// ───────────────────────── 변형 생성 ─────────────────────────

describe('buildVariants — 머리 절단형', () => {
  it('전체 → 머리 순서로 좁혀간다', () => {
    expect(buildVariants('실손보험 지급거절 이의신청')).toEqual([
      '실손보험 지급거절 이의신청',
      '실손보험 지급거절',
      '실손보험',
    ]);
  });

  it('단일 토큰은 자기 자신뿐이다', () => {
    expect(buildVariants('새도약기금')).toEqual(['새도약기금']);
  });

  it('공백 정리 후 중복은 제거된다', () => {
    expect(buildVariants('  청년월세지원  ')).toEqual(['청년월세지원']);
  });

  it('DataLab 5그룹 제한을 넘지 않는다', () => {
    const v = buildVariants('가 나 다 라 마 바 사');
    expect(v.length).toBeLessThanOrEqual(5);
    expect(v[0]).toBe('가 나 다 라 마 바 사'); // 전체가 항상 첫 번째
  });
});

// ───────────────────────── 요청 본문 ─────────────────────────

describe('buildDatalabBody', () => {
  it('13주 주간 범위와 그룹당 1키워드로 구성한다', () => {
    const body = buildDatalabBody(['a b', 'a'], new Date('2026-07-28T09:00:00Z')) as {
      startDate: string; endDate: string; timeUnit: string;
      keywordGroups: Array<{ groupName: string; keywords: string[] }>;
    };
    expect(body.timeUnit).toBe('week');
    expect(body.endDate).toBe('2026-07-27');   // 당일 데이터 없음 → 어제까지
    expect(body.startDate).toBe('2026-04-27'); // 13주 전
    expect(body.keywordGroups).toEqual([
      { groupName: 'a b', keywords: ['a b'] },
      { groupName: 'a', keywords: ['a'] },
    ]);
  });
});

// ───────────────────────── 판정 로직 ─────────────────────────

function mockFetch(results: Array<{ title: string; ratios: number[] }>, status = 200) {
  return jest.fn(async () => ({
    ok: status === 200,
    status,
    json: async () => ({
      results: results.map(r => ({ title: r.title, data: r.ratios.map(ratio => ({ ratio })) })),
    }),
  })) as unknown as typeof fetch;
}

const OPTS = { clientId: 'id', clientSecret: 'secret' };

describe('analyzeKeywordDemand — 판정', () => {
  it('입력 키워드 자체가 측정되면 ok', async () => {
    const r = await analyzeKeywordDemand('새도약기금', {
      ...OPTS,
      fetchImpl: mockFetch([{ title: '새도약기금', ratios: [10, 20] }]),
    });
    expect(r.verdict).toBe('ok');
    expect(r.searchedTerm).toBe('새도약기금');
    expect(r.titleHint).toContain('새도약기금');
    expect(r.titleHint).toContain('그대로 포함');
  });

  it('전체는 0, 중간 절단형이 측정되면 rephrase + 각도 분리', async () => {
    const r = await analyzeKeywordDemand('실손보험 지급거절 이의신청', {
      ...OPTS,
      fetchImpl: mockFetch([
        { title: '실손보험 지급거절 이의신청', ratios: [0, 0] },
        { title: '실손보험 지급거절', ratios: [0] },
        { title: '실손보험', ratios: [50, 60] },
      ]),
    });
    expect(r.verdict).toBe('rephrase');
    expect(r.searchedTerm).toBe('실손보험');
    expect(r.angle).toBe('지급거절 이의신청');
    expect(r.titleHint).toContain('"실손보험"(으)로 시작');
    expect(r.titleHint).toContain('지급거절 이의신청');
    expect(r.titleHint).toContain('H2');
  });

  it('가장 긴 측정 가능 변형을 고른다 — 볼륨 최대(헤드)로 퇴화하면 안 된다', async () => {
    const r = await analyzeKeywordDemand('실손보험 청구 거절 대응', {
      ...OPTS,
      fetchImpl: mockFetch([
        { title: '실손보험 청구 거절 대응', ratios: [0] },
        { title: '실손보험 청구 거절', ratios: [3] },   // 측정됨 (작지만)
        { title: '실손보험 청구', ratios: [40] },        // 더 큼
        { title: '실손보험', ratios: [500] },            // 최대
      ]),
    });
    expect(r.verdict).toBe('rephrase');
    expect(r.searchedTerm).toBe('실손보험 청구 거절'); // 최대 볼륨이 아니라 가장 구체적인 것
    expect(r.angle).toBe('대응');
  });

  it('전 변형이 0이면 no-demand, 제목 힌트는 없다', async () => {
    const r = await analyzeKeywordDemand('렌터카 완전면책 휴차료', {
      ...OPTS,
      fetchImpl: mockFetch([
        { title: '렌터카 완전면책 휴차료', ratios: [0] },
        { title: '렌터카 완전면책', ratios: [0] },
        { title: '렌터카', ratios: [0] },
      ]),
    });
    expect(r.verdict).toBe('no-demand');
    expect(r.searchedTerm).toBeNull();
    expect(r.titleHint).toBeNull();
    expect(r.summary).toContain('검색 유입 기대 불가');
  });
});

// ───────────────────────── 실패 격리 ─────────────────────────

describe('analyzeKeywordDemand — 절대 throw 하지 않는다', () => {
  it('HTTP 오류 → verdict=error', async () => {
    const r = await analyzeKeywordDemand('아무거나', { ...OPTS, fetchImpl: mockFetch([], 500) });
    expect(r.verdict).toBe('error');
    expect(r.summary).toContain('500');
  });

  it('fetch 자체가 던져도 → verdict=error', async () => {
    const boom = jest.fn(async () => { throw new Error('network down'); }) as unknown as typeof fetch;
    const r = await analyzeKeywordDemand('아무거나', { ...OPTS, fetchImpl: boom });
    expect(r.verdict).toBe('error');
  });

  it('응답이 JSON이 아니어도 → verdict=error', async () => {
    const bad = jest.fn(async () => ({
      ok: true, status: 200, json: async () => { throw new Error('bad json'); },
    })) as unknown as typeof fetch;
    const r = await analyzeKeywordDemand('아무거나', { ...OPTS, fetchImpl: bad });
    expect(r.verdict).toBe('error');
  });

  it('자격증명이 없으면 조용히 건너뛴다', async () => {
    const r = await analyzeKeywordDemand('아무거나', { clientId: '', clientSecret: '' });
    expect(r.verdict).toBe('error');
    expect(r.summary).toContain('건너뜀');
  });
});

// ───────────────────────── 제목 힌트 ─────────────────────────

describe('composeTitleHint', () => {
  it('no-demand 와 error 는 null — 없는 수요를 지어내지 않는다', () => {
    expect(composeTitleHint('kw', 'no-demand', null, null)).toBeNull();
    expect(composeTitleHint('kw', 'error', null, null)).toBeNull();
  });

  it('rephrase 인데 각도가 없으면 각도 문장을 생략한다', () => {
    const hint = composeTitleHint('실손보험', 'rephrase', '실손', null);
    expect(hint).toContain('"실손"(으)로 시작');
    expect(hint).not.toContain('H2');
  });
});
