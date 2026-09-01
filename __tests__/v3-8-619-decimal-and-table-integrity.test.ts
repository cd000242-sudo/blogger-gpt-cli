/**
 * v3.8.619 — 소수점이 잘리고 표가 무너지던 실사고 회귀 테스트
 *
 * ## 실물 증거 (leadernam.com 발행글, 2026-09-01)
 *   · "인상률은 3. 봉급표상 기존 봉급액에 1. 039를 곱하는 방식"  ← "3.9%" 가 "3." 로 잘림
 *   · "한국은행의 … 평균인 연 4."                                  ← "4.35%" 가 "4." 로 잘림
 *   · "수도권 및 규제지역이면 3."                                  ← "3.0%포인트" 가 "3." 로 잘림
 *   · 4칸짜리 표의 한 줄이 <td> 2개로 나가 열이 어긋남
 *
 * ## 원인
 *   ① 문장 분리가 마침표를 전부 문장 끝으로 봤다 — 소수점 `4.35` 가 "4" / "35" 로 쪼개지고,
 *      뒷조각 "35%" 가 근거 미확인 값으로 잡혀 통째로 삭제됐다.
 *   ② 근거 미확인 셀을 `<td>` 태그째 지워 표의 열 수가 줄었다. 구멍이 아니라 **어긋남**이라
 *      다른 열의 값이 엉뚱한 자리로 밀린다 — 표가 거짓말을 하게 된다.
 */

import {
  inspectFactIntegrity,
  sanitizeFactUnsafeHtml,
  splitSentencesForFactCheck,
  type FactEvidence,
} from '../src/core/final/fact-integrity';

const noEvidence: FactEvidence = { context: '', provider: 'none', trustLevel: 'none' };

const withEvidence = (context: string): FactEvidence => ({
  provider: 'Perplexity Sonar',
  trustLevel: 'strong',
  context,
  sourceUrls: ['https://www.example.go.kr/notice'],
});

describe('문장 분리 — 소수점은 문장 끝이 아니다', () => {
  it('소수점에서 자르지 않는다', () => {
    expect(splitSentencesForFactCheck('평균 금리는 연 4.35%였습니다.')).toEqual(['평균 금리는 연 4.35%였습니다.']);
  });

  it('배수 표기(1.039)도 한 문장으로 남는다', () => {
    const parts = splitSentencesForFactCheck('기존 봉급액에 1.039를 곱합니다.');
    expect(parts).toHaveLength(1);
    expect(parts[0]).toContain('1.039');
  });

  it('날짜 표기(2026. 8. 30.)에서 잘게 쪼개지 않는다', () => {
    const parts = splitSentencesForFactCheck('2026. 8. 30. 기준입니다.');
    expect(parts[0]).toContain('2026. 8. 30.');
  });

  it('진짜 문장 끝에서는 자른다', () => {
    expect(splitSentencesForFactCheck('금리는 4.35%입니다. 한도는 줄어듭니다.')).toEqual([
      '금리는 4.35%입니다.',
      '한도는 줄어듭니다.',
    ]);
  });

  it('물음표·느낌표도 문장 끝이다', () => {
    expect(splitSentencesForFactCheck('가능할까요? 가능합니다!')).toEqual(['가능할까요?', '가능합니다!']);
  });
});

describe('근거 있는 소수 수치는 살아남는다', () => {
  const evidence = withEvidence('2026년 공무원 보수는 3.9% 인상됩니다. 기존 봉급액에 1.039를 곱해 계산합니다.');

  it('3.9% 가 잘리지 않는다', () => {
    const html = '<p>인상률은 3.9%입니다. 봉급표상 기존 봉급액에 1.039를 곱하는 방식입니다.</p>';
    const sanitized = sanitizeFactUnsafeHtml(html, evidence);
    expect(sanitized).toContain('3.9%');
    expect(sanitized).toContain('1.039');
    expect(sanitized).not.toMatch(/인상률은 3\.\s/);
  });

  it('근거가 있으면 검사도 통과한다', () => {
    expect(inspectFactIntegrity('<p>인상률은 3.9%입니다.</p>', evidence).status).toBe('passed');
  });
});

describe('근거가 없으면 소수 수치가 든 문장을 통째로 지운다 (반쪽 삭제 금지)', () => {
  it('"4." 같은 반토막을 남기지 않는다', () => {
    const html = '<p>한국은행 평균 금리는 연 4.35%였습니다. 금리는 대출 한도에 영향을 줍니다.</p>';
    const sanitized = sanitizeFactUnsafeHtml(html, noEvidence);

    expect(sanitized).not.toContain('4.35%');
    // 반토막이 남으면 사고다 — "연 4." 로 끝나는 문장이 있으면 안 된다
    expect(sanitized).not.toMatch(/연 4\.(?!\d)/);
    expect(sanitized).not.toMatch(/\d\.\s*$/);
  });

  it('근거 없는 값이 없는 문장은 그대로 살린다', () => {
    const html = '<p>금리는 연 4.35%였습니다. 대출 한도는 소득에 따라 달라집니다.</p>';
    const sanitized = sanitizeFactUnsafeHtml(html, noEvidence);
    expect(sanitized).toContain('대출 한도는 소득에 따라 달라집니다.');
  });
});

describe('표는 열이 어긋나면 안 된다', () => {
  const html = [
    '<table><tbody>',
    '<tr><td>연 4.35%</td><td>고정형</td><td>3억 2,000만원</td><td>고정형 조건을 검토하는 사람</td></tr>',
    '</tbody></table>',
  ].join('');

  it('근거 미확인 셀을 지워도 <td> 개수는 그대로다', () => {
    const sanitized = sanitizeFactUnsafeHtml(html, noEvidence);
    const cells = sanitized.match(/<td\b[^>]*>/gi) || [];
    expect(cells).toHaveLength(4);
  });

  it('값은 지워지되 마지막 열의 설명은 제 자리에 남는다', () => {
    const sanitized = sanitizeFactUnsafeHtml(html, noEvidence);
    expect(sanitized).not.toContain('3억 2,000만원');
    expect(sanitized).toContain('고정형 조건을 검토하는 사람');
  });

  it('머리글 셀(th)도 사라지지 않는다', () => {
    const table = '<table><thead><tr><th>가정</th><th>연 4.35% 기준</th></tr></thead></table>';
    const sanitized = sanitizeFactUnsafeHtml(table, noEvidence);
    expect((sanitized.match(/<th\b[^>]*>/gi) || [])).toHaveLength(2);
  });
});

describe('CTA 링크는 사실검증에 지워지지 않는다', () => {
  it('근거 없는 수치가 든 문단이라도 링크는 남는다', () => {
    const html = '<p>최대 5,000만원까지 신청할 수 있습니다. <a href="https://www.hf.go.kr/apply">신청 바로가기</a></p>';
    const sanitized = sanitizeFactUnsafeHtml(html, noEvidence);

    expect(sanitized).toContain('href="https://www.hf.go.kr/apply"');
    expect(sanitized).toContain('신청 바로가기');
    expect(sanitized).not.toContain('5,000만원');
  });

  it('링크 주소 안의 숫자는 건드리지 않는다', () => {
    const html = '<p>2026년 기준입니다. <a href="https://www.example.go.kr/2026/notice?id=25000">공고 보기</a></p>';
    const sanitized = sanitizeFactUnsafeHtml(html, noEvidence);
    expect(sanitized).toContain('https://www.example.go.kr/2026/notice?id=25000');
  });

  it('링크가 없는 문단은 예전처럼 문장 단위로 정리한다', () => {
    const html = '<p>2026년 7월 15일까지 신청하면 25만원을 받습니다.</p>';
    const sanitized = sanitizeFactUnsafeHtml(html, noEvidence);
    expect(sanitized).not.toContain('25만원');
    expect(sanitized).not.toContain('2026년 7월 15일');
  });
});
