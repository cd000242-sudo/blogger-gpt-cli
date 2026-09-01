/**
 * v3.8.619 — 사장님 실물 검수 2건
 *   ① "공식 사이트 바로가기라 되어 있으면서 PDF 파일이 다운로드되는데?"
 *   ② "핵심 요약에 곱하기를 한글 그대로 적지 말고 X로 표기해야 되고"
 */

import { isDocumentUrl } from '../src/cta/destination-gate';
import { normalizeTableNotation } from '../src/core/final/table-notation';

describe('내려받기 주소는 CTA 목적지가 아니다', () => {
  it('확장자가 없어도 내려받기 주소를 잡는다 (실사고 URL)', () => {
    expect(isDocumentUrl('https://eiec.kdi.re.kr/policy/callDownload.do?num=264303&filenum=3')).toBe(true);
  });

  it('공공기관 CMS 의 흔한 파일 주소들', () => {
    expect(isDocumentUrl('https://www.example.go.kr/cmm/fms/FileDown.do?atchFileId=abc&fileSn=1')).toBe(true);
    expect(isDocumentUrl('https://www.example.go.kr/board/download?id=12')).toBe(true);
    expect(isDocumentUrl('https://www.example.go.kr/getFile.do?id=9')).toBe(true);
  });

  it('확장자로 드러나는 문서는 예전처럼 잡는다', () => {
    expect(isDocumentUrl('https://www.example.go.kr/notice/2026.pdf')).toBe(true);
    expect(isDocumentUrl('https://www.example.go.kr/form.hwp?v=2')).toBe(true);
  });

  it('멀쩡한 안내 페이지는 문서로 보지 않는다', () => {
    expect(isDocumentUrl('https://www.fsc.go.kr/no010101/84617')).toBe(false);
    expect(isDocumentUrl('https://eiec.kdi.re.kr/policy/materialView.do?num=264303')).toBe(false);
    expect(isDocumentUrl('https://www.mpm.go.kr')).toBe(false);
  });
});

describe('표에서는 곱셈을 기호로 적는다', () => {
  it('"곱하기" 를 곱셈 기호로 바꾼다', () => {
    expect(normalizeTableNotation('기존 봉급액 곱하기 1.039')).toBe('기존 봉급액 × 1.039');
  });

  it('알파벳 X 가 아니라 곱셈표(U+00D7)를 쓴다', () => {
    expect(normalizeTableNotation('A 곱하기 B')).toContain('×');
    expect(normalizeTableNotation('A 곱하기 B')).not.toContain('X');
  });

  it('곱하기가 없으면 그대로 둔다', () => {
    expect(normalizeTableNotation('봉급과 수당 합산 300만원 수준')).toBe('봉급과 수당 합산 300만원 수준');
  });

  it('빈 값·null 에도 터지지 않는다', () => {
    expect(normalizeTableNotation('')).toBe('');
    expect(normalizeTableNotation(undefined as any)).toBe('');
  });
});

describe('공공기관 출처 인식 (v3.8.619)', () => {
  it('인사혁신처·기획예산처를 출처로 센다', () => {
    const { scanContentQuality } = require('../src/core/final/quality-gate');
    const html = '<p>인사혁신처 공무원보수규정 봉급표를 확인하세요.</p><p>기획예산처가 2027년 예산안을 발표했습니다.</p>';
    expect(scanContentQuality(html).metrics.sourceMentions).toBeGreaterThanOrEqual(2);
  });

  it('기존 기관도 그대로 센다', () => {
    const { scanContentQuality } = require('../src/core/final/quality-gate');
    const html = '<p>한국은행 발표</p><p>통계청 조사</p>';
    expect(scanContentQuality(html).metrics.sourceMentions).toBeGreaterThanOrEqual(2);
  });
});
