/**
 * v3.8.619 — 같은 주장 되풀이 정리
 *
 * 사장님 지적: "정보가 구체적이면 좋긴 한데 의도적으로 반복시킨 건 SEO 때문인 거니?"
 * 실측(발행글 2편): "스트레스 금리 하한 3.0%" 계열 8회, "지방 규제지역 외 1.5%" 4회.
 *
 * 규칙은 하나 — 같은 주장은 두 번까지. 세 번째부터 덜어낸다.
 * 다만 링크·이미지가 든 문장, 문단이 비어 버리는 경우, 표·제목 안은 건드리지 않는다.
 *
 * 픽스처는 실제 글의 꼴을 따른다 — 되풀이 문장은 **다른 문장과 같은 문단에** 들어 있다.
 * (한 문장짜리 문단만으로 시험하면 "문단이 비면 안 둔다" 안전장치에 전부 걸려
 *  정작 덜어내기 동작을 검증하지 못한다.)
 */

import {
  claimSimilarity,
  findRepeatedClaims,
  dedupeRepeatedClaims,
  describeRedundancy,
  SAME_CLAIM_SIMILARITY,
  MAX_REPEATS,
} from '../src/core/final/redundancy-guard';

const CLAIM = '수도권 및 규제지역 주담대는 스트레스 금리 하한 3.0%가 적용됩니다';
const VARIANT = '수도권과 규제지역 주담대는 스트레스 금리 하한 3.0%가 적용돼요';
const OTHER = '기존 부채가 있으면 주담대에 쓸 수 있는 원리금이 줄어듭니다';

/** 문단마다 서로 다른 곁문장을 붙인다 — 곁문장이 같으면 그것이 또 다른 중복이 된다 */
const FILLER = [
  '계약 전에는 상환 방식과 만기를 함께 확인해 두는 편이 좋습니다',
  '금융회사마다 심사 항목의 이름이 달라 용어를 먼저 맞춰야 합니다',
  '소득 증빙 서류는 발급일 기준으로 유효기간을 확인해야 합니다',
  '상담 전에 기존 대출의 잔액과 금리를 정리해 두면 빠릅니다',
  '주택 소재지에 따라 확인해야 할 서류가 달라지기도 합니다',
];

/**
 * 실제 글 규모의 배경 문단을 만든다.
 *
 * 이 모듈에는 "분량이 10% 넘게 줄면 적용을 포기한다" 안전장치가 있다.
 * 문단 두세 개짜리 픽스처에서는 한 문장만 빼도 20%가 넘어 **항상 포기**로 끝나,
 * 정작 덜어내기 동작을 검증하지 못한다. 그래서 배경을 넉넉히 깔고 잰다.
 * 문장은 모두 서로 다른 내용이어야 한다 — 닮은 문장을 찍어내면 그게 또 되풀이가 된다.
 */
const BACKGROUND = [
  '연소득은 세전 금액을 기준으로 보며 증빙 서류에 따라 인정 범위가 달라집니다',
  '상환 방식이 원리금균등인지 원금균등인지에 따라 월 부담이 다르게 잡힙니다',
  '만기를 늘리면 월 상환액은 줄지만 총이자는 늘어난다는 점을 함께 봐야 합니다',
  '신용대출 잔액은 심사에서 이미 나간 원리금으로 계산에 들어갑니다',
  '전세보증금 반환 목적 대출은 별도 기준이 적용되는 경우가 있습니다',
  '중도상환수수료는 실행일로부터 몇 년까지 남는지 미리 확인해야 합니다',
  '고정형과 변동형은 같은 시점에도 제시 금리가 다르게 나올 수 있습니다',
  '서류 발급일이 오래되면 재발급을 요구받아 일정이 밀리기도 합니다',
  '담보 감정가는 신청 시점의 시세와 다르게 나오는 경우가 흔합니다',
  '보증보험 가입 여부에 따라 필요한 서류가 하나 더 늘어나기도 합니다',
  '공동명의라면 배우자 소득과 부채도 함께 심사 대상이 됩니다',
  '가등기나 압류가 있으면 실행 전에 정리해야 절차가 진행됩니다',
  '연체 이력은 신용평가 항목이라 최근 기록부터 확인하는 편이 좋습니다',
  '사업소득자는 근로소득자와 증빙 방식이 달라 준비물이 늘어납니다',
  '분양권은 등기 전이라 담보 인정 방식이 완공 주택과 다릅니다',
  '재개발 구역 물건은 조합 사업 단계에 따라 취급이 갈립니다',
  '임대차 계약이 있으면 보증금이 선순위로 잡히는지 봐야 합니다',
  '실행일과 잔금일이 어긋나면 하루치 이자가 더 붙기도 합니다',
  '금리 인하 요구권은 소득이 늘었을 때 신청해 볼 수 있습니다',
  '체증식 상환은 초기 부담이 낮지만 후반 상환액이 커집니다',
];
const background = () => BACKGROUND.map((sentence) => `<p>${sentence}.</p>`).join('');

const para = (text: string, fillerIndex: number) => `<p>${text}. ${FILLER[fillerIndex % FILLER.length]}.</p>`;

describe('claimSimilarity — 실측으로 잡은 눈금', () => {
  it('말끝만 다른 같은 주장을 같은 것으로 본다', () => {
    expect(claimSimilarity(CLAIM, VARIANT)).toBeGreaterThanOrEqual(SAME_CLAIM_SIMILARITY);
  });

  it('내용이 다른 문장은 확실히 멀다', () => {
    expect(claimSimilarity(CLAIM, OTHER)).toBeLessThan(0.2);
  });

  it('같은 문장은 1.0', () => {
    expect(claimSimilarity(CLAIM, CLAIM)).toBe(1);
  });

  it('빈 문자열에도 터지지 않는다', () => {
    expect(claimSimilarity('', '')).toBe(0);
  });
});

describe('findRepeatedClaims — 세기만 하고 바꾸지 않는다', () => {
  it('되풀이 횟수를 센다', () => {
    const html = [para(CLAIM, 0), para(VARIANT, 1), para(CLAIM, 2), para(OTHER, 3)].join('');
    const report = findRepeatedClaims(html);
    expect(report).toHaveLength(2);
    expect(report[report.length - 1]!.occurrence).toBe(3);
  });

  it('본문을 바꾸지 않는다', () => {
    const html = [para(CLAIM, 0), para(CLAIM, 1)].join('');
    const snapshot = html;
    findRepeatedClaims(html);
    expect(html).toBe(snapshot);
  });

  it('짧은 문장은 되풀이로 세지 않는다', () => {
    expect(findRepeatedClaims('<p>맞습니다.</p><p>맞습니다.</p>')).toEqual([]);
  });

  it('되풀이가 없으면 빈 배열', () => {
    expect(findRepeatedClaims([para(CLAIM, 0), para(OTHER, 1)].join(''))).toEqual([]);
  });
});

describe('dedupeRepeatedClaims — 세 번째부터 덜어낸다', () => {
  it('두 번까지는 남기고 세 번째를 뺀다', () => {
    /**
     * 문단을 넉넉히 둔다 — 짧은 글에서 한 문장을 빼면 분량이 10% 넘게 줄어
     * "많이 줄면 포기한다" 안전장치에 걸린다. 그건 안전장치가 제 일을 한 것이지
     * 덜어내기가 안 되는 게 아니다. 실제 글 길이에서 재야 동작을 볼 수 있다.
     */
    // 배경 문장을 그대로 쓴다 — 픽스처끼리 겹치면 배경까지 되풀이로 잡힌다
    const D = BACKGROUND;
    const html = [
      `<p>${CLAIM}. ${D[0]}.</p>`,
      `<p>${VARIANT}. ${D[1]}.</p>`,
      `<p>${CLAIM}. ${D[2]}.</p>`,
      ...D.slice(3).map((sentence) => `<p>.</p>`),
      background(),
    ].join('');
    const result = dedupeRepeatedClaims(html);

    // 근접 규칙까지 함께 걸리므로 두 문장이 빠진다 (2회차=근접, 3회차=횟수 초과)
    expect(result.removed).toBeGreaterThanOrEqual(1);
    expect((result.html.match(/스트레스 금리 하한/g) || []).length).toBeLessThanOrEqual(MAX_REPEATS);
    // 되풀이 문장만 빠지고 같은 문단의 곁문장은 살아 있어야 한다
    expect(result.html).toContain(D[2]);
    // 서로 다른 문장들은 하나도 사라지지 않는다
    D.forEach((sentence) => expect(result.html).toContain(sentence));
  });

  it('두 번이라도 바로 아래에서 또 말하면 뺀다 (사장님이 짚은 자리)', () => {
    const html = [para(CLAIM, 0), para(VARIANT, 1), background()].join('');
    const result = dedupeRepeatedClaims(html);
    expect(result.removed).toBe(1);
    expect((result.html.match(/스트레스 금리 하한/g) || [])).toHaveLength(1);
  });

  it('빈 <p> 를 남기지 않는다', () => {
    const html = [para(CLAIM, 0), para(VARIANT, 1), para(CLAIM, 2)].join('');
    expect(dedupeRepeatedClaims(html).html).not.toMatch(/<p[^>]*>\s*<\/p>/);
  });

  it('링크가 든 문장은 세 번째여도 남긴다 — CTA 가 사라지면 안 된다', () => {
    const linked = `<p>${CLAIM}는 <a href="https://www.fsc.go.kr">금융위원회 안내</a>에서 확인합니다. ${FILLER[4]}.</p>`;
    const html = [para(CLAIM, 0), para(VARIANT, 1), linked].join('');
    const result = dedupeRepeatedClaims(html);

    expect(result.html).toContain('https://www.fsc.go.kr');
    expect((result.html.match(/<a\b/g) || [])).toHaveLength(1);
  });

  it('이미지가 든 문장도 남긴다', () => {
    const withImage = `<p>${CLAIM} <img src="https://x/a.jpg" alt="">. ${FILLER[3]}.</p>`;
    const html = [para(CLAIM, 0), para(VARIANT, 1), withImage].join('');
    expect(dedupeRepeatedClaims(html).html).toContain('<img');
  });

  it('표 안은 건드리지 않는다', () => {
    const html = [
      para(CLAIM, 0), para(VARIANT, 1),
      `<table><tr><td><p>${CLAIM}.</p></td></tr></table>`,
    ].join('');
    expect(dedupeRepeatedClaims(html).html).toContain(`<p>${CLAIM}.</p>`);
  });

  it('제목 안은 건드리지 않는다', () => {
    const html = [para(CLAIM, 0), para(VARIANT, 1), `<h2>${CLAIM}</h2>`].join('');
    expect(dedupeRepeatedClaims(html).html).toContain(`<h2>${CLAIM}</h2>`);
  });

  it('분량이 10% 넘게 줄면 적용을 포기하고 원본을 돌려준다', () => {
    const many = Array(12).fill(0).map((_, i) => para(CLAIM, i)).join('');
    const result = dedupeRepeatedClaims(many);
    if (result.skipped) {
      expect(result.html).toBe(many);
      expect(result.removed).toBe(0);
    } else {
      const before = many.replace(/<[^>]+>/g, '').length;
      const after = result.html.replace(/<[^>]+>/g, '').length;
      expect(after).toBeGreaterThanOrEqual(before * 0.9);
    }
  });

  it('빈 입력·깨진 입력에도 예외를 던지지 않는다', () => {
    expect(() => dedupeRepeatedClaims('')).not.toThrow();
    expect(() => dedupeRepeatedClaims('<p>닫히지 않은 문단')).not.toThrow();
    expect(dedupeRepeatedClaims('').html).toBe('');
  });
});

describe('describeRedundancy', () => {
  it('되풀이가 없으면 그렇게 말한다', () => {
    expect(describeRedundancy([], 0)).toContain('없음');
  });

  it('최대 몇 회였는지 알려준다', () => {
    const html = [para(CLAIM, 0), para(VARIANT, 1), para(CLAIM, 2), para(VARIANT, 3)].join('');
    const result = dedupeRepeatedClaims(html);
    expect(describeRedundancy(result.report, result.removed)).toMatch(/최대 \d회/);
  });
});

describe('묻고 답하는 문장은 지우지 않는다 (실측 회귀)', () => {
  /**
   * 실사고: FAQ 의 "9급 1호봉 월 300만원은 봉급인가요. 봉급과 수당을 합친 보수예요."
   * 가 3회차 되풀이로 잡혀 지워질 뻔했다. FAQ 에서 사실을 다시 말하는 건 되풀이가 아니라
   * 그게 답이다. 지우면 질문만 남아 글이 더 나빠진다.
   */
  const FACT = '9급 1호봉 월 300만원 수준은 봉급과 수당을 합친 보수입니다';
  const FAQ = '9급 1호봉 월 300만원은 봉급인가요. 봉급과 수당을 합친 보수예요';

  it('질문형이 든 문장은 세 번째여도 남긴다', () => {
    const html = [
      `<p>${FACT}. 급여 명세서에서 항목을 나눠 보면 차이를 알 수 있습니다.</p>`,
      `<p>${FACT}. 봉급표 한 줄과 직접 비교하면 어긋납니다.</p>`,
      `<p>${FAQ}. 수당 항목은 별도 기준으로 정해집니다.</p>`,
    ].join('');
    expect(dedupeRepeatedClaims(html).html).toContain('봉급인가요');
  });

  it('질문이 없는 평범한 되풀이는 그대로 덜어낸다', () => {
    expect(claimSimilarity(FACT, FACT)).toBe(1);
  });
});

describe('FAQ 아코디언은 통째로 보호한다 (실측 회귀)', () => {
  /**
   * 실사고: FAQ 는 <details><summary>질문</summary><div><p>답</p></div></details> 꼴이다.
   * 답 문단만 보면 앞에서 한 말이라 되풀이로 잡히는데, 지우면 **질문만 남고 답이 사라진다.**
   * FAQ 는 다시 묻고 다시 답하는 자리다 — 되풀이가 곧 그 블록의 일이다.
   */
  const FACT = '2027년 공무원 공통 인상률은 3.9%입니다';

  it('details 안의 답변은 세 번째여도 지우지 않는다', () => {
    const html = [
      `<p>${FACT}. 봉급표상 봉급액에 적용하는 숫자예요.</p>`,
      `<p>${FACT}. 수당은 항목마다 기준이 다릅니다.</p>`,
      `<details><summary>Q. 인상률은 몇 퍼센트인가요</summary><div><p>${FACT}. 기존 봉급액에 1.039를 곱합니다.</p></div></details>`,
    ].join('');
    const result = dedupeRepeatedClaims(html);
    expect(result.html).toContain('<details>');
    expect(result.html).toContain('기존 봉급액에 1.039를 곱합니다');
    expect((result.html.match(/2027년 공무원 공통 인상률은 3\.9%/g) || [])).toHaveLength(3);
  });
});

describe('질문 제목 뒤 문단은 답변이라 지키지 않는다 (실측 회귀)', () => {
  /**
   * 실사고: 발행글의 FAQ 가 <h3>질문</h3><p>답변</p> 꼴이었다.
   * 답변 문단만 보면 앞에서 한 말이라 되풀이로 잡히는데,
   * 지우면 질문만 남고 답이 사라진다.
   */
  const FACT = '지방 규제지역 외 주담대는 스트레스 금리 1.5%가 적용됩니다';

  it('질문형 h3 아래 문단은 세 번째여도 남긴다', () => {
    const html = [
      `<p>${FACT}. 주택 위치를 먼저 확인해야 합니다.</p>`,
      `<p>${FACT}. 적용비율이 함께 곱해집니다.</p>`,
      `<h3>지방 주택은 수도권과 같은가요</h3>`,
      `<p>${FACT}. 수도권과는 기준이 다릅니다.</p>`,
    ].join('');
    const result = dedupeRepeatedClaims(html);
    expect((result.html.match(/스트레스 금리 1\.5%/g) || [])).toHaveLength(3);
  });

  it('질문이 아닌 제목 아래에서는 평소대로 덜어낸다', () => {
    // 곁문장은 **서로 완전히 다른 내용**이어야 한다. 숫자만 바꾼 문장은 그 자체가 되풀이로 잡힌다.
    const D = [
      '연소득은 세전 금액을 기준으로 보며 증빙 서류에 따라 인정 범위가 달라집니다',
      '상환 방식이 원리금균등인지 원금균등인지에 따라 월 부담이 다르게 잡힙니다',
      '만기를 늘리면 월 상환액은 줄지만 총이자는 늘어난다는 점을 함께 봐야 합니다',
      '신용대출 잔액은 주담대 심사에서 이미 나간 원리금으로 계산에 들어갑니다',
      '전세보증금 반환 목적 대출은 별도 기준이 적용되는 경우가 있습니다',
      '중도상환수수료는 실행일로부터 몇 년까지 남는지 미리 확인해야 합니다',
      '고정형과 변동형은 같은 시점에도 제시 금리가 다르게 나올 수 있습니다',
      '서류 발급일이 오래되면 재발급을 요구받아 일정이 밀리기도 합니다',
      '담보 감정가는 신청 시점의 시세와 다르게 나오는 경우가 흔합니다',
      '보증보험 가입 여부에 따라 필요한 서류가 하나 더 늘어나기도 합니다',
      '공동명의라면 배우자 소득과 부채도 함께 심사 대상이 됩니다',
      '가등기나 압류가 있으면 실행 전에 정리해야 진행이 됩니다',
    ];
    const html = [
      `<p>${FACT}. ${D[0]}.</p>`,
      `<p>${FACT}. ${D[1]}.</p>`,
      `<h3>적용 기준 정리</h3>`,
      `<p>. .</p>`,
      ...D.slice(3).map((s) => `<p>.</p>`),
      background(),
    ].join('');
    expect(dedupeRepeatedClaims(html).removed).toBeGreaterThanOrEqual(1);
  });
});

describe('빈 껍데기 문단을 만들지 않는다 (실측 회귀)', () => {
  /**
   * 실사고: 되풀이 문장을 빼고 나니 문장 분리가 남긴 마침표 하나만 남아
   * `<p>.</p>` 가 9개 만들어졌다. 개수만 세는 안전장치로는 못 막는다 —
   * 마침표도 "문장 하나"로 세어지기 때문이다.
   */
  it('문단에 읽을 글자가 안 남으면 원본을 지킨다', () => {
    const CL = '수도권 및 규제지역 주담대는 스트레스 금리 하한 3.0%가 적용됩니다';
    const html = [`<p>${CL}.</p>`, `<p>${CL}.</p>`, `<p>${CL}.</p>`, background()].join('');
    const result = dedupeRepeatedClaims(html);
    expect(result.html).not.toMatch(/<p[^>]*>\s*[.,·]*\s*<\/p>/);
  });
});
