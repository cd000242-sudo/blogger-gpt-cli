/**
 * 태그 위생 테스트 (v3.8.384)
 *
 * 배경: 2026-07-28 GSC 실측 — 글 318편에 태그 2,563개, 그중 2,396개(93%)가 고아.
 * 구글이 아는 URL 2,188개의 대부분이 이 태그 아카이브였고 크롤 예산을 다 먹고 있었다.
 * 아래 입력값은 전부 실제로 사이트에 쌓여 있던 쓰레기 태그다.
 */
import {
  normalizeTagName,
  sanitizeTagNames,
  matchExistingTag,
  tagKey,
  MAX_TAGS_PER_POST,
} from '../src/core/tag-hygiene';

describe('normalizeTagName — 실제 쌓인 쓰레기 태그', () => {
  it.each([
    ['"CHATGPT', 'CHATGPT', '따옴표 파싱 잔해'],
    ['"라면 끓이기', '라면 끓이기', '따옴표 파싱 잔해'],
    ['2025 —', null, '대시만 남은 조각'],
    ['2025년', null, '연도만'],
    ['  청년월세지원  ', '청년월세지원', '공백 정리'],
    ['[실손보험]', '실손보험', '괄호 제거'],
    ['최신', null, '조각 접미어'],
    ['관련', null, '불용어'],
    ['12,345', null, '숫자만'],
    ['!!!', null, '기호만'],
    ['가', null, '2자 미만'],
    ['아주아주아주아주아주아주긴태그이름입니다요', null, '20자 초과'],
    ['SRT', 'SRT', '정상'],
    ['실손보험', '실손보험', '정상'],
  ])('"%s" → %s (%s)', (input, expected, _why) => {
    expect(normalizeTagName(input as string)).toBe(expected as string | null);
  });

  it('잘못된 타입에도 throw 하지 않는다', () => {
    expect(() => normalizeTagName(null)).not.toThrow();
    expect(() => normalizeTagName(undefined)).not.toThrow();
    expect(() => normalizeTagName({})).not.toThrow();
    expect(normalizeTagName(null)).toBeNull();
  });
});

describe('sanitizeTagNames — 고아 태그 양산 차단', () => {
  it('포함관계는 짧고 일반적인 것만 남긴다 (SRT 3분열 사고)', () => {
    // 실제 사고: "SRT" / "SRT 추석" / "SRT 추석 예매" 가 각각 태그로 만들어졌다.
    // 짧은 쪽을 남겨야 다른 글에서 재사용돼 고아가 안 된다.
    const out = sanitizeTagNames(['SRT', 'SRT 추석', 'SRT 추석 예매']);
    expect(out).toEqual(['SRT']);
  });

  it('연도 문장 분열도 축약한다 (2025년 최신 비법 사고)', () => {
    const out = sanitizeTagNames(['2025년', '2025년 최신', '2025년 최신 비법', '청년월세']);
    // "2025년"은 연도만이라 탈락, 나머지 조각도 축약돼 실질 태그만 남는다
    expect(out).not.toContain('2025년');
    expect(out).toContain('청년월세');
    expect(out.length).toBeLessThanOrEqual(2);
  });

  it('대소문자·공백만 다른 중복을 제거한다', () => {
    expect(sanitizeTagNames(['실손보험', '실손 보험', 'ChatGPT', 'chatgpt'])).toEqual(['실손보험', 'ChatGPT']);
  });

  it(`글당 ${MAX_TAGS_PER_POST}개를 넘지 않는다`, () => {
    const many = ['실손보험', '청년월세', '온누리상품권', '상조해지', '건강검진', '무주택기간', '새도약기금'];
    expect(sanitizeTagNames(many).length).toBe(MAX_TAGS_PER_POST);
  });

  it('전부 불량이면 빈 배열 — 태그 없이 발행한다', () => {
    expect(sanitizeTagNames(['2025년', '최신', '!!!', '가'])).toEqual([]);
  });

  it('입력이 배열이 아니어도 throw 하지 않는다', () => {
    expect(() => sanitizeTagNames(null as any)).not.toThrow();
    expect(sanitizeTagNames(null as any)).toEqual([]);
    expect(sanitizeTagNames(undefined as any)).toEqual([]);
  });

  it('원래 순서를 유지한다', () => {
    expect(sanitizeTagNames(['청년월세', '실손보험', '온누리상품권'])).toEqual(
      ['청년월세', '실손보험', '온누리상품권']);
  });
});

describe('matchExistingTag — 재사용 판정', () => {
  const existing = [
    { id: 1, name: '실손보험' },
    { id: 2, name: 'ChatGPT' },
    { id: 3, name: '청년 월세' },
  ];

  it('정확 일치를 찾는다', () => {
    expect(matchExistingTag('실손보험', existing)?.id).toBe(1);
  });

  it('대소문자를 무시한다', () => {
    expect(matchExistingTag('chatgpt', existing)?.id).toBe(2);
  });

  it('공백 차이를 흡수한다 (WordPress 검색이 부분일치라 필요)', () => {
    expect(matchExistingTag('청년월세', existing)?.id).toBe(3);
  });

  it('부분 일치는 매치로 치지 않는다 — 그러면 엉뚱한 태그가 붙는다', () => {
    expect(matchExistingTag('실손', existing)).toBeNull();
  });

  it('후보가 비었거나 배열이 아니어도 throw 하지 않는다', () => {
    expect(matchExistingTag('x', [])).toBeNull();
    expect(() => matchExistingTag('x', null as any)).not.toThrow();
  });
});

describe('tagKey', () => {
  it('대소문자·공백을 정규화한다', () => {
    expect(tagKey('  Chat GPT ')).toBe('chatgpt');
    expect(tagKey('청년 월세 지원')).toBe('청년월세지원');
  });
});

describe('소스 가드 — 조회 버그가 되살아나면 실패한다', () => {
  const pub = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'src', 'wordpress', 'wordpress-publisher.ts'), 'utf8');
  const api = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'src', 'wordpress', 'wordpress-api.ts'), 'utf8');

  it('resolveTags 가 getTags(첫 100개)로 재사용을 판정하지 않는다', () => {
    const start = pub.indexOf('private async resolveTags');
    const end = pub.indexOf('private extractExcerpt');
    expect(start).toBeGreaterThan(-1);
    const block = pub.slice(start, end);
    // 이 블록에서 getTags 를 쓰면 2,563개 중 100개만 보고 판정하는 원래 버그로 회귀한다
    expect(block).not.toContain('getTags(');
    expect(block).toContain('searchTags(');
  });

  it('resolveTags 가 sanitizeTagNames 로 입력을 정리한다', () => {
    expect(pub).toContain('sanitizeTagNames(tagNames)');
  });

  it('searchTags API 가 존재한다', () => {
    expect(api).toContain('async searchTags(');
    expect(api).toContain('/tags?search=');
  });
});
