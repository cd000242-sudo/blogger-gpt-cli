/**
 * v3.8.601 — 마침표라고 다 문장 끝은 아니다
 *
 * 사장님: "문단정리가 마침표로 문장을 마무리했다면 줄바꿈을 해줘.
 *          그리고 만약 소수점이나 따옴표라면 줄바꿈을 하면 안 되고 유연하게 대처하도록 해"
 */
import { splitSentencesSafe, endsSentenceAfterDigit, normalizeParagraphs } from '../src/core/final/paragraph-normalizer';

describe('마침표로 끝나면 줄을 바꾼다', () => {
  test('평범한 두 문장', () => {
    expect(splitSentencesSafe('신청서를 확인했습니다. 다음 단계로 넘어갑니다.'))
      .toEqual(['신청서를 확인했습니다.', '다음 단계로 넘어갑니다.']);
  });

  test('물음표·느낌표도 문장 끝이다', () => {
    expect(splitSentencesSafe('신청이 될까요? 조건부터 봅시다!')).toHaveLength(2);
  });
});

describe('소수점에서는 자르지 않는다', () => {
  test('3.5% 는 한 문장 안에 남는다', () => {
    const got = splitSentencesSafe('금리는 3.5% 수준입니다. 분기마다 달라집니다.');
    expect(got).toHaveLength(2);
    expect(got[0]).toContain('3.5%');
  });

  test('소수점이 여럿이어도 안전하다', () => {
    expect(splitSentencesSafe('1.5배에서 2.25배까지 늘어납니다.')).toHaveLength(1);
  });
});

describe('날짜와 번호도 문장 끝이 아니다', () => {
  test('2026. 8. 30. 이 세 조각으로 갈라지지 않는다', () => {
    const got = splitSentencesSafe('2026. 8. 30. 기준으로 확인했습니다.');
    expect(got).toHaveLength(1);
    expect(got[0]).toContain('2026. 8. 30.');
  });

  test('줄머리 번호가 혼자 남지 않는다', () => {
    const got = splitSentencesSafe('1. 신청서를 준비합니다. 2. 서류를 제출합니다.');
    expect(got.every((s) => !/^\d+\.$/.test(s.trim()))).toBe(true);
  });

  test('판정 함수 자체를 시험한다', () => {
    // "2026." 뒤에 숫자가 오면 날짜다
    expect(endsSentenceAfterDigit('2026.', '2026. 8. 30. 기준', 4)).toBe(false);
    // 줄머리 "1." 은 번호다
    expect(endsSentenceAfterDigit('1.', '1. 신청서', 1)).toBe(false);
    // 문장이 숫자로 끝나고 뒤에 한글이 오면 문장 끝이다
    expect(endsSentenceAfterDigit('한도는 5000만원까지 300.', '한도는 5000만원까지 300. 다음', 30)).toBe(true);
  });
});

describe('따옴표 안에서는 자르지 않는다', () => {
  test('곧은 따옴표 인용 한가운데서 줄이 바뀌지 않는다', () => {
    const got = splitSentencesSafe('담당자는 "안 됩니다. 서류를 다시 내세요" 라고 했습니다.');
    expect(got).toHaveLength(1);
  });

  test('한글 낫표도 마찬가지', () => {
    expect(splitSentencesSafe('공고문에 「접수는 마감되었습니다. 문의는 콜센터」 라고 적혀 있습니다.')).toHaveLength(1);
  });

  test('인용이 끝난 뒤에는 정상적으로 자른다', () => {
    const got = splitSentencesSafe('그는 "가능합니다" 라고 답했습니다. 그래서 신청했습니다.');
    expect(got).toHaveLength(2);
  });

  test('짝 없는 아포스트로피가 문단을 통째로 삼키지 않는다', () => {
    // ' 가 하나뿐이면 인용을 열지 않는다 — 열면 뒤 문장들이 전부 한 줄로 뭉친다
    const got = splitSentencesSafe("서류를 준비했습니다. 담당자'가 확인했습니다. 끝났습니다.");
    expect(got.length).toBeGreaterThan(1);
  });
});

describe('HTML 을 깨뜨리지 않는다', () => {
  test('링크 안의 점에서 자르지 않는다', () => {
    const html = '<a href="https://ols.semas.or.kr">신청 페이지</a> 에서 접수합니다. 다음 단계입니다.';
    const got = splitSentencesSafe(html);
    expect(got).toHaveLength(2);
    expect(got[0]).toContain('ols.semas.or.kr');
  });

  test('문단 정리가 통째로 실패하지 않는다', () => {
    const html = '<p>금리는 3.5% 입니다. 2026. 8. 30. 기준입니다. 확인이 필요합니다.</p>';
    const out = normalizeParagraphs(html);
    expect(out.html).toContain('3.5%');
    expect(out.html).toContain('2026. 8. 30.');
  });
});
