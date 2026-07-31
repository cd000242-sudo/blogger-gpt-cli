/**
 * 경험 메모 · 결정 지원 · 초점 좁히기 테스트 (v3.8.392)
 *
 * 출발점 — 사용자가 준 영상의 요지:
 *   "요즘은 그냥 정보 나열한다고 상위노출되지 않는다."
 *   AI 요약(구글 AI Overviews)이 1초에 답해주는 단순 정보성 글은 클릭이 안 되고,
 *   AI 가 만들 수 없는 1차 경험 디테일만 살아남는다.
 *     "4월 8일 수요일, 어른 2명 9세 1명 8세 1명"
 *     "주말 오후 2시에 갔더니 40분 대기, 1인당 얼마, 다음에 또 갈지 모르겠다"
 *
 * ⚠️ 이 테스트가 지키는 가장 중요한 것:
 *   **도구는 경험을 생성하지 않는다.** 가보지도 않고 "40분 대기했다"고 쓰면 허위이고,
 *   영상이 경고한 양산형 AI 글보다 나쁘다. 경험이 없으면 "겪은 척 하지 말라"를 넣는다.
 */
import {
  normalizeExperience, hasExperience, buildExperienceBlock, NO_EXPERIENCE_GUARD,
} from '../src/core/final/experience-block';
import { DECISION_SUPPORT_RULES, hasDecisionSupportRules } from '../src/core/final/decision-support';
import {
  pickSuffixes, buildNarrowTerms, suggestNarrowerKeywords, buildNarrowFocusBlock,
} from '../src/core/keyword-narrowing';

describe('경험 메모 — 입력 정리', () => {
  it('공백만 있는 값은 버린다', () => {
    expect(normalizeExperience({ note: '   ', who: '' })).toEqual({});
  });

  it('줄바꿈·연속 공백을 한 칸으로 정리한다', () => {
    expect(normalizeExperience({ who: '어른2\n\n  9세' }).who).toBe('어른2 9세');
  });

  it('알 수 없는 키는 무시한다', () => {
    expect(normalizeExperience({ evil: 'x', who: '나' })).toEqual({ who: '나' });
  });

  it('객체가 아니어도 안전하다', () => {
    expect(normalizeExperience(null)).toEqual({});
    expect(normalizeExperience('문자열')).toEqual({});
  });

  it('과도하게 긴 입력을 자른다', () => {
    expect(normalizeExperience({ note: 'ㄱ'.repeat(5000) }).note!.length).toBeLessThanOrEqual(2000);
  });
});

describe('경험 메모 — 있음/없음 판정', () => {
  it('자유칸에 10자 이상이면 경험으로 본다', () => {
    expect(hasExperience({ note: '4월 8일에 다녀왔습니다' })).toBe(true);
  });

  it('너무 짧은 자유칸만으로는 인정하지 않는다', () => {
    expect(hasExperience({ note: '갔음' })).toBe(false);
  });

  it('육하원칙 칸이 2개 이상 채워지면 인정한다', () => {
    expect(hasExperience({ who: '어른2', when: '4월 8일' })).toBe(true);
  });

  it('육하원칙 1칸만으로는 인정하지 않는다', () => {
    expect(hasExperience({ who: '어른2' })).toBe(false);
  });

  it('빈 입력은 false', () => {
    expect(hasExperience({})).toBe(false);
  });
});

describe('경험 메모 — 프롬프트 블록', () => {
  const exp = {
    note: '4/8 수요일 오후 2시에 애들 데리고 갔는데 40분 대기했고 1인 18000원',
    who: '어른2 + 9세 + 8세',
    when: '4월 8일 수요일 오후 2시',
  };

  it('경험이 없으면 빈 문자열 — 프롬프트가 이전과 동일해진다', () => {
    expect(buildExperienceBlock({})).toBe('');
    expect(buildExperienceBlock({ note: '짧음' })).toBe('');
  });

  it('작성자 메모와 육하원칙을 모두 담는다', () => {
    const block = buildExperienceBlock(exp);
    expect(block).toContain('40분 대기');
    expect(block).toContain('어른2 + 9세 + 8세');
    expect(block).toContain('4월 8일 수요일');
  });

  it('숫자를 그대로 쓰라고 지시한다 — 반올림하면 AI가 만들 수 있는 문장이 된다', () => {
    expect(buildExperienceBlock(exp)).toContain('위에 적힌 그대로');
  });

  it('한 문장만 넣고 끝내지 말라고 한다 (영상 6:09 지적)', () => {
    expect(buildExperienceBlock(exp)).toContain('한 문장만 넣고 끝내지 마세요');
  });

  it('별도 후기 섹션으로 격리하지 말라고 한다', () => {
    expect(buildExperienceBlock(exp)).toContain('별도 "후기" 섹션으로 몰아넣지 마세요');
  });

  it('실패담도 쓰라고 한다', () => {
    expect(buildExperienceBlock(exp)).toContain('헤맨 것·실패한 것도');
  });

  it('⭐ 없는 경험을 만들어내지 말라고 못박는다 — 이게 가장 중요하다', () => {
    const block = buildExperienceBlock(exp);
    expect(block).toContain('위에 없는 경험을 만들어내지 마세요');
    expect(block).toContain('허위');
  });
});

describe('경험이 없을 때의 안전장치 — 거짓 경험 방지', () => {
  it('1인칭 체험 표현을 금지한다', () => {
    expect(NO_EXPERIENCE_GUARD).toContain('제가 직접 신청해보니');
    expect(NO_EXPERIENCE_GUARD).toContain('쓰지 마세요');
  });

  it('확인할 수 없는 체험 수치를 금지한다', () => {
    expect(NO_EXPERIENCE_GUARD).toContain('40분 기다렸습니다');
  });

  it('대신 무엇을 쓸지 알려준다 — 금지만 하면 글이 빈다', () => {
    expect(NO_EXPERIENCE_GUARD).toContain('절차·판단 기준·필요 서류·흔한 실수');
  });

  it('거짓 경험이 정보 부족보다 나쁘다고 명시한다', () => {
    expect(NO_EXPERIENCE_GUARD).toContain('거짓 경험은 정보가 부족한 글보다 훨씬 나쁩니다');
  });
});

describe('결정 지원 규칙 (영상 6:51~7:47)', () => {
  it('나열이 아니라 판단을 요구한다', () => {
    expect(DECISION_SUPPORT_RULES).toContain('결정을 대신 내려주지 말고');
    expect(hasDecisionSupportRules(DECISION_SUPPORT_RULES)).toBe(true);
  });

  it('추천과 비추천을 둘 다 쓰라고 한다', () => {
    expect(DECISION_SUPPORT_RULES).toContain('추천과 비추천을 둘 다');
    expect(DECISION_SUPPORT_RULES).toContain('이런 사람은 하지 마세요');
  });

  it('비율을 독자 상황의 금액으로 번역하라고 한다', () => {
    expect(DECISION_SUPPORT_RULES).toContain('보증금 2억이면 1천만 원까지만');
  });

  it('표의 마지막 열은 "누구에게 맞는지"여야 한다', () => {
    expect(DECISION_SUPPORT_RULES).toContain('누구에게 맞는지');
  });

  it('"상황에 따라 다르다"로 끝내지 말라고 한다', () => {
    expect(DECISION_SUPPORT_RULES).toContain('상황에 따라 다르니 잘 판단하세요');
  });

  it('첫 생성 프롬프트에 실제로 들어간다', () => {
    const gen = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'src', 'core', 'final', 'generation.ts'), 'utf8');
    expect(gen).toContain('${SUBSTANCE_FIRST_PASS_RULES}${FRESHNESS_RULES}${DECISION_SUPPORT_RULES}');
  });
});

describe('초점 좁히기 — 어순이 핵심이다', () => {
  it('접미어를 뒤에 붙인다 — 앞에 붙이면 실측상 전부 0이었다', () => {
    const terms = buildNarrowTerms('제주도 렌트카', ['추천', '가격']);
    expect(terms.map(t => t.term)).toEqual(['제주도 렌트카 추천', '제주도 렌트카 가격']);
  });

  it('이미 들어있는 말은 중복해서 붙이지 않는다', () => {
    expect(buildNarrowTerms('대출 조건', ['조건', '금리']).map(t => t.suffix)).toEqual(['금리']);
  });

  it('최대 4개까지만 (DataLab 그룹 5개 상한 - 원본 1개)', () => {
    expect(buildNarrowTerms('키워드', ['가', '나', '다', '라', '마'])).toHaveLength(4);
  });

  it('주제에 맞는 접미어를 고른다', () => {
    expect(pickSuffixes('제주도 렌트카')).toContain('추천');
    expect(pickSuffixes('청년월세 지원금')).toContain('신청방법');
    expect(pickSuffixes('실손보험 청구')).toContain('청구방법');
  });

  it('어느 풀에도 안 걸리면 일반 접미어를 쓴다', () => {
    expect(pickSuffixes('완전히 생소한 주제')).toEqual(['방법', '조건', '기준', '비용']);
  });

  it('빈 키워드에 안전하다', () => {
    expect(buildNarrowTerms('', ['추천'])).toEqual([]);
  });
});

describe('초점 좁히기 — 측정과 노이즈 제거', () => {
  const mockDataLab = (payload: Record<string, number>) => (async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      results: Object.entries(payload).map(([title, sum]) => ({
        title, data: [{ ratio: sum }],
      })),
    }),
  })) as any;

  it('원본 대비 1% 미만은 노이즈로 버린다', async () => {
    // 실측 근거: "제주도 렌트카 후기" 합 0.3 = 원본의 0.03% — 사실상 검색되지 않는다
    const r = await suggestNarrowerKeywords('제주도 렌트카', {
      clientId: 'k', clientSecret: 's',
      fetchImpl: mockDataLab({
        '제주도 렌트카': 1000,
        '제주도 렌트카 추천': 33,   // 3.3% → 통과
        '제주도 렌트카 가격': 13,   // 1.3% → 통과
        '제주도 렌트카 예약': 3.6,  // 0.36% → 탈락
        '제주도 렌트카 코스': 0,    // 탈락
      }),
    });
    expect(r.measured.map(m => m.suffix)).toEqual(['추천', '가격']);
    expect(r.best?.suffix).toBe('추천');
  });

  it('전부 하한 미만이면 아무것도 제안하지 않는다', async () => {
    const r = await suggestNarrowerKeywords('누수 배상', {
      clientId: 'k', clientSecret: 's',
      fetchImpl: mockDataLab({ '누수 배상': 200 }),
    });
    expect(r.best).toBeNull();
    expect(buildNarrowFocusBlock(r)).toBe('');
    expect(r.summary).toContain('원 키워드 유지');
  });

  it('키가 없으면 조용히 건너뛴다', async () => {
    const r = await suggestNarrowerKeywords('키워드', { clientId: '', clientSecret: '' });
    expect(r.best).toBeNull();
    expect(r.measured).toEqual([]);
  });

  it('네트워크가 죽어도 throw 하지 않는다', async () => {
    const r = await suggestNarrowerKeywords('키워드', {
      clientId: 'k', clientSecret: 's',
      fetchImpl: (() => Promise.reject(new Error('끊김'))) as any,
    });
    expect(r.best).toBeNull();
    expect(r.summary).toContain('실패');
  });

  it('HTTP 오류도 조용히 넘긴다', async () => {
    const r = await suggestNarrowerKeywords('키워드', {
      clientId: 'k', clientSecret: 's',
      fetchImpl: (async () => ({ ok: false, status: 429 })) as any,
    });
    expect(r.summary).toContain('429');
  });
});

describe('초점 블록 — 키워드를 바꾸지 않는다', () => {
  const result = {
    keyword: '청년월세 지원금',
    baseRatioSum: 693,
    measured: [
      { term: '청년월세 지원금 서류', suffix: '서류', ratioSum: 59.9, share: 0.086 },
      { term: '청년월세 지원금 조건', suffix: '조건', ratioSum: 56.4, share: 0.081 },
    ],
    best: { term: '청년월세 지원금 서류', suffix: '서류', ratioSum: 59.9, share: 0.086 },
    summary: '',
  };

  it('제목·키워드는 유지하고 초점만 좁히라고 명시한다', () => {
    const block = buildNarrowFocusBlock(result);
    expect(block).toContain('제목과 키워드는 그대로 유지하세요');
    expect(block).toContain('초점만 좁히는 것입니다');
  });

  it('1순위 접미어를 중심에 두라고 한다', () => {
    expect(buildNarrowFocusBlock(result)).toContain('**"서류"**');
  });

  it('나머지는 짧게 넘기라고 한다', () => {
    expect(buildNarrowFocusBlock(result)).toContain('짧게 언급하고 넘어가세요');
  });
});

describe('orchestration·UI 배선', () => {
  const read = (...p: string[]) =>
    require('fs').readFileSync(require('path').join(__dirname, '..', ...p), 'utf8');
  const orch = read('src', 'core', 'final', 'orchestration.ts');
  const posting = read('electron', 'ui', 'modules', 'posting.js');
  const html = read('electron', 'ui', 'index.html');

  it('경험이 있으면 블록을, 없으면 안전장치를 넣는다', () => {
    expect(orch).toContain('buildExperienceBlock(expInput)');
    expect(orch).toContain('NO_EXPERIENCE_GUARD');
  });

  it('경험·좁히기 실패가 발행을 막지 않는다', () => {
    const i = orch.indexOf('v3.8.392: 작성자 경험 메모 주입');
    const block = orch.slice(i, i + 2600);
    expect(block).toContain('try {');
    expect(block).toContain('catch');
    expect(block).not.toContain('throw');
  });

  it('UI 에 자유칸과 육하원칙 6칸이 있다', () => {
    expect(html).toContain('id="experienceNote"');
    ['expWho', 'expWhen', 'expWhere', 'expWhat', 'expHow', 'expWhy', 'expResult', 'expTip']
      .forEach(id => expect(html).toContain(`id="${id}"`));
  });

  it('육하원칙은 접이식이라 기본 화면을 어지럽히지 않는다', () => {
    const i = html.indexOf('id="experienceNote"');
    expect(html.slice(i, i + 1800)).toContain('<details');
  });

  it('payload 가 경험을 실어 보낸다', () => {
    expect(posting).toContain('experience: collectExperienceInput()');
    expect(posting).toContain("val('experienceNote')");
  });

  it('아무것도 안 채우면 undefined 를 보낸다 — 이전과 동일 동작', () => {
    expect(posting).toContain('Object.values(exp).some(Boolean) ? exp : undefined');
  });
});
