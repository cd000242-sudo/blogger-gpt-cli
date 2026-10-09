/**
 * v3.8.758 — 문서 CTA 는 파일 이름이 곧 제목이다
 *
 * 실측(leadernam 2026-10-02 발행, run 20261002-191752-1780cb):
 *   글 「고속도로 출구 잘못 나가서 통행료 두 번 냈던 분들, 10월부터 달라졌습니다」의 CTA 가
 *   "📥 PDF 자료 다운받기" → 국립국어원 「2009_신어(공개).pdf」 였다. 주제와 아무 관계가 없다.
 *   748 적합성 관문은 근거 장부에 그 문서의 제목·본문이 없으면 "모르면 막지 않는다" 로 통과시킨다.
 *   그런데 파일 이름은 주소 안에 있었다 — %EC%8B%A0%EC%96%B4 처럼 인코딩돼 있어 읽지 못했을 뿐이다.
 *
 * 고치는 범위: **문서 주소(파일 확장자)에서 한글 파일 이름을 읽어 제목으로 쓴다.** 그 밖은 그대로.
 *   일반 화면 주소(경로가 영문·숫자)는 예전처럼 "모르면 막지 않는다" — 경로를 제목으로 쓰면 멀쩡한 링크가 대량으로 빠진다.
 */
import { checkCtaMatch, documentNameOf } from '../src/cta/cta-match';

const TOLL = {
  keyword: '고속도로 출구 잘못 나가서 통행료 두 번 냈던 분들, 10월부터 달라졌습니다',
  title: '고속도로 출구 잘못 나가서 통행료 두 번 냈던 분들, 10월부터 달라졌습니다',
  action: '📥 PDF 자료 다운받기 PDF 자료를 다운받아 자세히 확인하세요!',
};
const SINEO_PDF = 'https://www.korean.go.kr/common/download.do?file_path=reportData&c_file_name=285d356d-7e10-4039-b38f-6a2e47120527.pdf&o_file_name=2009_%EC%8B%A0%EC%96%B4(%EA%B3%B5%EA%B0%9C).pdf';

describe('documentNameOf — 문서 주소에서 사람이 붙인 파일 이름을 읽는다', () => {
  it('쿼리 값의 인코딩된 한글 파일 이름 (UUID 저장 이름은 건너뛴다)', () => {
    expect(documentNameOf(SINEO_PDF)).toBe('2009_신어(공개).pdf');
  });

  it('경로 끝의 한글 파일 이름', () => {
    expect(documentNameOf('https://www.ex.co.kr/upload/%ED%86%B5%ED%96%89%EB%A3%8C%20%ED%99%98%EB%B6%88%20%EC%95%88%EB%82%B4.hwp')).toBe('통행료 환불 안내.hwp');
  });

  it('파일 이름이 없거나(번호만) 문서가 아니면 빈 문자열', () => {
    expect(documentNameOf('https://www.easylaw.go.kr/CSP/FlDownload.laf?flSeq=1720078652934')).toBe('');
    expect(documentNameOf('https://www.fsc.go.kr/no010101/86767')).toBe('');
    expect(documentNameOf('https://www.ex.go.kr/files/285d356d-7e10-4039-b38f-6a2e47120527.pdf')).toBe('');
    expect(documentNameOf('not a url')).toBe('');
  });
});

describe('checkCtaMatch — 파일 이름으로 주제를 대조한다', () => {
  it('⭐ 실측 재현: 통행료 글에 국립국어원 「2009 신어」 PDF 는 링크를 뺀다', () => {
    const v = checkCtaMatch({ ...TOLL, destination: { url: SINEO_PDF } });
    expect(v.ok).toBe(false);
    expect(v.failed).toBe('CTA_ENTITY_MATCH');
    expect(v.reason).toContain('2009_신어');
  });

  it('주제 낱말이 파일 이름에 있으면 통과한다', () => {
    const v = checkCtaMatch({
      ...TOLL,
      destination: { url: 'https://www.ex.co.kr/upload/%ED%86%B5%ED%96%89%EB%A3%8C%20%ED%99%98%EB%B6%88%20%EC%95%88%EB%82%B4.hwp' },
    });
    expect(v.ok).toBe(true);
  });

  it('근거 장부 제목이 있으면 그것이 먼저다 (파일 이름으로 덮지 않는다)', () => {
    const v = checkCtaMatch({ ...TOLL, destination: { url: SINEO_PDF, title: '고속도로 통행료 감면 제도 개선 보도자료' } });
    expect(v.ok).toBe(true);
  });

  it('파일 이름을 못 읽는 문서(번호만)는 예전처럼 막지 않는다', () => {
    const v = checkCtaMatch({
      keyword: '청년 월세지원 소득 기준',
      action: '📥 자료 내려받기',
      destination: { url: 'https://www.easylaw.go.kr/CSP/FlDownload.laf?flSeq=1720078652934' },
    });
    expect(v.ok).toBe(true);
    expect(v.reason).toMatch(/목적지 정보 없음/);
  });

  it('일반 화면 주소는 그대로 — 경로를 제목으로 쓰지 않는다', () => {
    const v = checkCtaMatch({ ...TOLL, action: '🔗 금융위원회에서 요건 확인', destination: { url: 'https://www.fsc.go.kr/no010101/86767' } });
    expect(v.ok).toBe(true);
    expect(v.reason).toMatch(/목적지 정보 없음/);
  });
});
