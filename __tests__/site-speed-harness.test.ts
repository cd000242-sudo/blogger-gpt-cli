/**
 * 속도 하네스 계산부 검증.
 *
 * 왜 필요한가: 하네스가 틀리면 "고쳤다"는 판정 자체가 거짓이 된다.
 * 브라우저를 띄우는 부분은 테스트하지 않고, 숫자를 해석하는 부분만 못박는다.
 */
const metrics = require('../docs/site-kit/bench/lib/metrics.js');
const { median, summarize, compare, verdict, classifyHosts, THRESHOLDS } = metrics;

describe('median — 한 번의 딸꾹질에 흔들리지 않는다', () => {
  it('홀수 표본은 가운데 값', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('짝수 표본은 가운데 둘의 평균', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('튀는 값 하나가 결과를 끌고 가지 못한다 — 평균과 달라야 한다', () => {
    const runs = [1000, 1010, 9000];
    expect(median(runs)).toBe(1010);
    const mean = runs.reduce((a, b) => a + b, 0) / runs.length;
    expect(Math.round(mean)).toBe(3670);
  });

  it('빈 표본과 숫자 아닌 값은 null / 무시', () => {
    expect(median([])).toBeNull();
    expect(median([undefined as any, null as any, NaN, 5])).toBe(5);
  });
});

describe('verdict — 구글 기준으로 합격/보통/불합격', () => {
  it('경계값은 합격 쪽에 포함된다', () => {
    expect(verdict('lcp', THRESHOLDS.lcp.good)).toBe('good');
    expect(verdict('lcp', THRESHOLDS.lcp.good + 1)).toBe('ok');
    expect(verdict('lcp', THRESHOLDS.lcp.ok)).toBe('ok');
    expect(verdict('lcp', THRESHOLDS.lcp.ok + 1)).toBe('bad');
  });

  it('실측된 leadernam 값이 실제 등급대로 나온다', () => {
    expect(verdict('ttfb', 982)).toBe('ok');
    expect(verdict('lcp', 1908)).toBe('good');
    expect(verdict('cls', 0.5102)).toBe('bad');
    expect(verdict('cls', 0.0022)).toBe('good');
  });

  it('모르는 지표나 숫자 아닌 값은 판정하지 않는다', () => {
    expect(verdict('nope' as any, 1)).toBeNull();
    expect(verdict('lcp', undefined as any)).toBeNull();
  });
});

describe('summarize — 여러 번 잰 것을 하나로 접는다', () => {
  it('지표별 중앙값을 내고 표본 수를 남긴다', () => {
    const s = summarize([
      { ttfb: 900, lcp: 1900, cls: 0.5 },
      { ttfb: 1000, lcp: 2000, cls: 0.51 },
      { ttfb: 1100, lcp: 2100, cls: 0.52 },
    ]);
    expect(s.ttfb).toBe(1000);
    expect(s.lcp).toBe(2000);
    expect(s.samples).toBe(3);
  });

  it('CLS 는 반올림으로 뭉개지 않는다 — 0.1 경계가 걸려 있다', () => {
    const s = summarize([{ cls: 0.0022 }, { cls: 0.0022 }, { cls: 0.0022 }]);
    expect(s.cls).toBe(0.0022);
    expect(s.cls).not.toBe(0);
  });

  it('한 번도 못 잰 지표는 아예 넣지 않는다 — 0 으로 채우면 거짓말이 된다', () => {
    const s = summarize([{ ttfb: 900 }]);
    expect(s).not.toHaveProperty('lcp');
    expect(Object.keys(s)).toContain('ttfb');
  });
});

describe('compare — 고치기 전후를 같은 기준으로 본다', () => {
  it('줄면 improved, 늘면 아니다', () => {
    const rows = compare({ ttfb: 1000 }, { ttfb: 100 });
    expect(rows).toHaveLength(1);
    expect(rows[0].improved).toBe(true);
    expect(rows[0].delta).toBe(-900);
    expect(rows[0].pct).toBe(-90);
  });

  it('나빠진 것을 좋아졌다고 하지 않는다', () => {
    const [row] = compare({ lcp: 1900 }, { lcp: 2400 });
    expect(row.improved).toBe(false);
    expect(row.pct).toBe(26.3);
  });

  it('등급이 바뀌면 전후가 모두 남는다 — 숫자만으로는 합격 여부를 모른다', () => {
    const [row] = compare({ cls: 0.51 }, { cls: 0.05 });
    expect(row.verdictBefore).toBe('bad');
    expect(row.verdictAfter).toBe('good');
  });

  it('한쪽에만 있는 지표는 비교하지 않는다', () => {
    expect(compare({ ttfb: 900 }, { lcp: 1900 })).toHaveLength(0);
  });

  it('기준선이 0 이면 퍼센트를 지어내지 않는다', () => {
    const [row] = compare({ cls: 0 }, { cls: 0.3 });
    expect(row.pct).toBeNull();
    expect(row.delta).toBe(0.3);
  });

  it('변화 없음을 개선으로 세지 않는다', () => {
    const [row] = compare({ ttfb: 900 }, { ttfb: 900 });
    expect(row.improved).toBe(false);
    expect(row.unchanged).toBe(true);
  });
});

describe('classifyHosts — 무엇을 줄여야 하는지는 총량이 아니라 구성이 알려준다', () => {
  const byHost = {
    'cdn.jsdelivr.net': { count: 19, KB: 477 },
    'pagead2.googlesyndication.com': { count: 4, KB: 271 },
    'www.googletagmanager.com': { count: 1, KB: 187 },
    'leadernam.com': { count: 8, KB: 59 },
    'i0.wp.com': { count: 1, KB: 39 },
    '': { count: 1, KB: 1 },
  };

  it('실측 구성을 그대로 갈라낸다', () => {
    const b = classifyHosts(byHost, 'leadernam.com');
    expect(b.font).toEqual({ KB: 477, count: 19 });
    expect(b.ads).toEqual({ KB: 458, count: 5 });
    expect(b.own).toEqual({ KB: 59, count: 8 });
  });

  it('우리 것보다 남의 것이 훨씬 많다는 사실이 드러난다', () => {
    const b = classifyHosts(byHost, 'leadernam.com');
    const foreign = b.font.KB + b.ads.KB + b.other.KB;
    expect(foreign).toBeGreaterThan(b.own.KB * 10);
  });

  it('호스트 이름이 빈 요청도 버리지 않는다', () => {
    const b = classifyHosts(byHost, 'leadernam.com');
    expect(b.other.count).toBeGreaterThan(0);
  });

  it('빈 입력에도 터지지 않는다', () => {
    expect(classifyHosts(undefined as any, 'leadernam.com').own.KB).toBe(0);
  });
});
