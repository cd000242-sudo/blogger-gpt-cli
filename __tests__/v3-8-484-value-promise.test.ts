/**
 * v3.8.484 ⑥ — "값이 있다"고 해놓고 값을 안 적는 문장을 금지한다
 *
 * 사장님: "수치 없으면 그 소제목을 쓰지 않는 하드룰.
 *          '값이 있다'고 서술하면서 값을 안 적는 문장 자체를 금지하세요"
 *
 * ## 이게 왜 승부처인가
 * "지원 금액은 소득 구간에 따라 다릅니다" 는 한 글자도 틀리지 않았지만
 * 독자가 알고 싶었던 걸 하나도 안 알려준다. 검색해서 들어온 사람은
 * 얼마인지 알려고 왔는데 "다릅니다" 를 읽고 나간다.
 * 이런 문장이 쌓인 글이 "두루뭉실한 글" 이다.
 *
 * ## v3.8.471 과의 충돌을 여기서 정리한다
 * fact-guard 는 근거 없는 수치를 만나면 문단을 다시 쓰게 하는데, 그 지시가
 * 하필 "숫자를 빼고 서술로 바꾸세요 → '공고에 따라 달라집니다'" 였다.
 * 바로 이 금지 대상을 만들어내고 있었다. 지시를 바꾼다 —
 * 얼버무리지 말고 **그 주장을 통째로 들어내라**고 시킨다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { findValuePromises, hasConcreteValue, dropValuelessSections } from '../src/core/final/value-promise';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const factGuard = read('src/core/final/fact-guard.ts');
const orchestration = read('src/core/final/orchestration.ts');

describe('① 값을 약속하고 안 주는 문장을 잡는다', () => {
  it('⭐⭐ "다릅니다 / 달라집니다" 로 얼버무리는 문장', () => {
    const found = findValuePromises('<p>지원 금액은 소득 구간에 따라 다릅니다.</p>');
    expect(found).toHaveLength(1);
    expect(found[0]?.sentence).toContain('지원 금액');
  });

  it('⭐⭐ "확인해야 합니다 / 공고를 참고" 로 떠넘기는 문장', () => {
    expect(findValuePromises('<p>접수 기간은 해당 회차 공고에서 확인해야 합니다.</p>').length).toBe(1);
    expect(findValuePromises('<p>정확한 한도는 공고를 참고하시기 바랍니다.</p>').length).toBe(1);
  });

  it('⭐⭐ 값을 실제로 적었으면 잡지 않는다 (이게 우리가 원하는 문장이다)', () => {
    expect(findValuePromises('<p>지원 금액은 월 30만원입니다.</p>')).toHaveLength(0);
    expect(findValuePromises('<p>접수 기간은 3월 2일부터 3월 31일까지입니다.</p>')).toHaveLength(0);
  });

  it('⭐⭐ 같은 문장에 값이 함께 있으면 통과 (조건 설명은 정상이다)', () => {
    // 값을 주면서 조건을 나누는 건 좋은 글이다 — 이건 막으면 안 된다
    expect(findValuePromises('<p>지원금은 소득 구간에 따라 달라지며, 1구간은 월 30만원 2구간은 월 20만원입니다.</p>'))
      .toHaveLength(0);
  });

  it('⭐ 값 이야기가 아닌 문장은 건드리지 않는다', () => {
    expect(findValuePromises('<p>신청 방법은 사람마다 다릅니다.</p>')).toHaveLength(0);
    expect(findValuePromises('<p>자세한 내용은 아래에서 설명합니다.</p>')).toHaveLength(0);
  });
});

describe('② 소제목이 값을 약속했는지 본다', () => {
  it('⭐⭐ 금액·기간·조건 수치를 약속하는 제목을 알아본다', () => {
    expect(hasConcreteValue('지원 금액은 얼마인가', '<p>월 30만원입니다.</p>')).toBe(true);
    expect(hasConcreteValue('지원 금액은 얼마인가', '<p>소득에 따라 다릅니다.</p>')).toBe(false);
  });

  it('⭐⭐ 값을 약속하지 않는 제목은 수치가 없어도 통과 (방법·절차 설명은 정상)', () => {
    expect(hasConcreteValue('신청하는 방법', '<p>복지로에서 온라인으로 접수합니다.</p>')).toBe(true);
    expect(hasConcreteValue('자주 하는 실수', '<p>등본 유효기간을 놓치는 경우가 많습니다.</p>')).toBe(true);
  });

  it('⭐⭐ 값 약속 제목인데 본문에 수치가 하나도 없으면 탈락', () => {
    expect(hasConcreteValue('신청 기간과 마감일', '<p>회차마다 다르니 공고를 확인하세요.</p>')).toBe(false);
  });
});

describe('③ 값 없는 소제목은 통째로 들어낸다', () => {
  const sections = [
    { h3: '지원 금액은 얼마인가', content: '<p>지원 금액은 소득 구간에 따라 다릅니다.</p>' },
    { h3: '신청하는 방법', content: '<p>복지로에서 온라인으로 접수합니다. 등본이 필요합니다.</p>' },
    { h3: '지원 한도', content: '<p>연 최대 360만원까지 받을 수 있습니다.</p>' },
  ];

  it('⭐⭐ 값을 약속하고 못 지킨 소제목만 빠진다', () => {
    const kept = dropValuelessSections(sections);
    expect(kept.map((s) => s.h3)).toEqual(['신청하는 방법', '지원 한도']);
  });

  it('⭐⭐ 전부 탈락해도 최소 하나는 남긴다 (글이 통째로 비면 그게 더 나쁘다)', () => {
    const allBad = [
      { h3: '지원 금액', content: '<p>금액은 다릅니다.</p>' },
      { h3: '지원 한도', content: '<p>한도는 공고를 확인하세요.</p>' },
    ];
    expect(dropValuelessSections(allBad).length).toBeGreaterThanOrEqual(1);
  });

  it('⭐ 입력이 이상해도 터지지 않는다', () => {
    expect(dropValuelessSections([])).toEqual([]);
    expect(dropValuelessSections(null as any)).toEqual([]);
  });
});

describe('④ v3.8.471 과의 충돌을 정리했다', () => {
  it('⭐⭐ 얼버무리는 문장을 "예시" 가 아니라 "금지" 로 적어놨다', () => {
    // 문자열 자체는 남아 있어도 된다 — 중요한 건 어느 쪽으로 적혔느냐다.
    // 예전엔 "→ 이렇게 바꾸세요" 였고, 지금은 "✗ 금지" 다.
    const idx = factGuard.indexOf('지원 금액은 공고와 소득 구간에 따라 달라집니다');
    expect(idx).toBeGreaterThan(-1);
    const around = factGuard.slice(idx - 200, idx + 200);
    expect(around).toContain('금지');
    expect(around).toContain('✗');
    expect(around).not.toContain('→ "지원 금액은 공고와 소득 구간에 따라 달라집니다"');
  });

  it('⭐⭐ 얼버무리지 말고 그 주장을 들어내라고 시킨다', () => {
    expect(factGuard).toContain('통째로 빼세요');
  });
});

describe('⑤ 프롬프트와 발행 경로에 배선돼 있다', () => {
  it('⭐⭐ 생성 프롬프트에 하드룰이 들어 있다', () => {
    const rules = read('src/core/final/lived-voice.ts');
    expect(rules).toContain('값을 약속했으면 값을 적으세요');
  });

  it('⭐⭐ 발행 경로가 값 없는 소제목을 실제로 걸러낸다', () => {
    expect(orchestration).toContain('dropValuelessSections(');
  });
});
