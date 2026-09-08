/**
 * v3.8.568 — CTA 가 하나도 안 붙던 문제
 *
 * ## 사장님 실물 검수 (2026-08-28)
 * leadernam.com "9·30부터 바뀌는 펀드 설명서" 글에 **CTA 가 0개**였다.
 * 사장님: "이 글에 어떤 부분이 독자가 원하고, 그걸 굳이 또 검색해서 갈 필요 없이
 *          우리가 링크를 주면 된다 — 그게 왜 안 되어 있냐."
 *
 * ## 원인은 세 변경이 서로를 몰라서 겹친 것
 * 1) judgeCtaHost 가 카탈로그·관공서·키워드브랜드 셋만 인정
 *    → 독자가 실제로 가야 할 판매사·증권사가 전부 unknown-host 로 탈락
 * 2) v3.8.557 게이트가 남은 후보 중 행동 화면이 없어 정직하게 'none'
 * 3) v3.8.418 이 보충 CTA 검색을 껐다 — "sectionCta 는 살아 있다"를 전제로
 * → 뒤를 받을 것이 없어 CTA 0개
 *
 * 실측 근거 (네이버 웹문서 "펀드 투자설명서 확인 신청" 10건):
 *   탈락: miraeasset.com · imfnsec.com · citibank.co.kr · shinhansec.com
 *   통과: kofia.or.kr(교육) · itp.or.kr(무관한 hwp) · fsc.go.kr(보도자료)
 *
 * ## 고친 방식
 * "막을 것을 고르는" 방식으로 되돌아가지 **않는다**(코레일 글이 스팸 도메인으로 나간 사고).
 * 근거를 대는 원칙은 유지하고 **근거의 종류를 하나 늘린다** — 본문이 지목한 기관.
 * 그리고 사장님 조건: 블로그·SNS 는 기관명이 맞아도 막는다.
 *   "허브글을 따로 넣은 게 아니기 때문에" — 나간 트래픽이 돌아오지 않는다.
 */
import { judgeCtaHost, describeHostVerdict } from '../src/cta/host-trust';

describe('① 실제로 잘렸던 도메인들이 이제 통과한다', () => {
  /** 그 글이 본문에서 지목했을 기관들 */
  const agencies = ['금융투자협회', '미래에셋증권', '신한투자증권', '씨티은행'];

  /**
   * ⚠️ 한글 기관명은 도메인과 안 맞는다("미래에셋증권" vs miraeasset.com).
   *    그래서 **검색 결과 제목**으로 맞춘다 — 네이버 웹문서 제목은 한글이라 그대로 들어 있다.
   *    아래 제목은 2026-08-28 실제 검색 결과에서 가져온 것이다.
   */
  it('⭐⭐ 판매사·증권사가 후보로 들어온다 (예전엔 전부 unknown-host)', () => {
    const cases: Array<[string, string]> = [
      ['https://securities.miraeasset.com/hki/hki3032/n09.do',
        '연금저축계좌 설명서 | 설명서 및 위험고지서 | 미래에셋증권'],
      ['https://www.shinhansec.com/siw/wealth-management/fund/587201/view.do',
        '국민성장펀드 투자하기 - 신한투자증권'],
    ];
    for (const [url, title] of cases) {
      const v = judgeCtaHost(url, '펀드 설명서', agencies, title);
      expect(v.ok).toBe(true);
      expect(v.reason).toBe('agency-match');
    }
  });

  it('⭐ 영문 기관명은 제목 없이 도메인만으로도 맞는다', () => {
    const v = judgeCtaHost('https://securities.miraeasset.com/x', '펀드', ['miraeasset']);
    expect(v.reason).toBe('agency-match');
  });

  it('⭐⭐ 기관을 안 넘기면 예전 그대로 막힌다 (기존 동작 보존)', () => {
    const v = judgeCtaHost('https://securities.miraeasset.com/hki/hki3032/n09.do', '펀드 설명서');
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('unknown-host');
  });

  it('⭐⭐ 제목에 기관이 없으면 통과 못 한다 (아무 페이지나 열리지 않게)', () => {
    const v = judgeCtaHost(
      'https://securities.miraeasset.com/x', '펀드 설명서', ['금융투자협회'],
      '전혀 다른 회사 안내 페이지',
    );
    expect(v.ok).toBe(false);
  });

  it('⭐⭐ 본문에 없는 회사는 여전히 못 들어온다 (코레일 스팸 사고 원칙)', () => {
    const v = judgeCtaHost('https://www.some-random-broker.com/fund', '펀드 설명서', agencies);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('unknown-host');
  });

  it('관공서·카탈로그는 기관 목록과 무관하게 통과한다', () => {
    expect(judgeCtaHost('https://fund.kofia.or.kr/fs/fund/html/pop_edu3.html', '펀드').ok).toBe(true);
    expect(judgeCtaHost('https://www.fsc.go.kr/edu/news/86900', '펀드').ok).toBe(true);
  });
});

describe('② 트래픽이 새는 곳은 기관명이 맞아도 막는다', () => {
  /**
   * 사장님: "타 블로그나 SNS 에 트래픽을 유발하거나 광고 클릭을 유발시킬 수 있는
   *          요소로 연동되면 안 돼."
   * 기업 공식 블로그가 blog.naver.com 에 있는 경우가 실제로 많다 —
   * 기관명은 맞지만 보내면 독자가 돌아오지 않는다.
   */
  const agencies = ['삼성', '네이버', '카카오'];

  it.each([
    ['네이버 블로그', 'https://blog.naver.com/samsung/223456789'],
    ['티스토리', 'https://samsung.tistory.com/12'],
    ['브런치', 'https://brunch.co.kr/@samsung/1'],
    ['네이버 카페', 'https://cafe.naver.com/samsungfan/1'],
    ['지식iN', 'https://kin.naver.com/qna/detail.naver?d1id=4'],
    ['나무위키', 'https://namu.wiki/w/삼성'],
    ['유튜브', 'https://www.youtube.com/watch?v=abc'],
    ['인스타그램', 'https://www.instagram.com/samsung/'],
    ['X(트위터)', 'https://x.com/samsung'],
    ['스레드', 'https://www.threads.net/@samsung'],
    ['틱톡', 'https://www.tiktok.com/@samsung'],
    ['레딧', 'https://www.reddit.com/r/samsung/'],
    ['미디엄', 'https://medium.com/@samsung/post'],
    ['블로그스팟', 'https://samsung.blogspot.com/2026/08/post.html'],
  ])('⭐⭐ %s 은 기관명이 맞아도 막힌다', (_label, url) => {
    // 제목까지 기관명이 있어도 막혀야 한다
    const v = judgeCtaHost(url, '삼성', agencies, '삼성 공식 블로그 - 신제품 안내');
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('user-generated');
  });

  it('⭐ 왜 막았는지 사람이 읽을 수 있게 남긴다', () => {
    const v = judgeCtaHost('https://blog.naver.com/samsung/1', '삼성', agencies, '삼성');
    expect(describeHostVerdict(v)).toContain('트래픽이 새고');
  });

  it('⭐ 차단이 통과 판정보다 먼저 돈다 (관공서 도메인 위 블로그도 막힌다)', () => {
    // 순서가 뒤바뀌면 institutional 로 먼저 통과해 버린다
    const v = judgeCtaHost('https://blog.naver.com/mohw', '복지', ['보건복지부'], '보건복지부');
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('user-generated');
  });
});

describe('③ 기관 이름을 도메인과 맞추는 규칙', () => {
  it('영문 기관명이 도메인에 들어 있으면 맞는 것으로 본다', () => {
    expect(judgeCtaHost('https://securities.miraeasset.com/x', 'x', ['miraeasset']).ok).toBe(true);
  });

  it('기관을 주소로 넘겨도 호스트끼리 비교한다', () => {
    expect(judgeCtaHost('https://www.citibank.co.kr/a', 'x', ['https://www.citibank.co.kr/']).ok).toBe(true);
    expect(judgeCtaHost('https://sub.citibank.co.kr/a', 'x', ['citibank.co.kr']).ok).toBe(true);
  });

  it('⭐ 너무 짧은 토큰으로 우연히 맞지 않게 한다', () => {
    // 3자 이하 토큰이면 아무 도메인에나 걸린다
    expect(judgeCtaHost('https://www.kbsec.com/x', 'x', ['kb']).ok).toBe(false);
    expect(judgeCtaHost('https://www.example.com/x', 'x', ['']).ok).toBe(false);
  });

  it('중계·단축 주소는 기관명과 무관하게 막힌다', () => {
    expect(judgeCtaHost('https://bit.ly/abc', 'x', ['미래에셋']).reason).toBe('redirector');
  });
});

describe('④ 호출부 배선', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const generation = fs.readFileSync(
    path.join(__dirname, '..', 'src/core/final/generation.ts'), 'utf-8',
  );

  it('⭐⭐ 후보 판정에 기관 목록을 넘긴다 (안 넘기면 이 수정이 무동작이다)', () => {
    expect(generation).toContain('judgeCtaHost(link, keyword, namedAgencies, item.title, { trustedHosts })');
  });

  it('⭐⭐ 기관 목록을 후보 루프보다 먼저 만든다', () => {
    const decl = generation.indexOf('const namedAgencies');
    const use = generation.indexOf('judgeCtaHost(link, keyword, namedAgencies, item.title, { trustedHosts })');
    expect(decl).toBeGreaterThan(-1);
    expect(decl).toBeLessThan(use);
  });

  it('⭐ 행동화면 판정도 같은 목록을 쓴다 (두 기준이 갈라지면 안 된다)', () => {
    expect(generation).toContain('const gateAgencies = namedAgencies');
  });

  it('기관 추출이 실패해도 발행을 막지 않는다', () => {
    expect(generation).toContain('기관 추출 실패 — 기존 기준으로만 판정');
  });

  /**
   * 후보 범위를 넓혀도 0개인 경우는 남는다. 그때 **조용히 넘어가지 않는 것**이 핵심이다.
   * 로그가 없으면 다음에도 사장님이 발행글을 눈으로 봐야만 안다 — 이번이 그랬다.
   */
  it('⭐⭐ CTA 가 0개면 크게 알린다 (조용히 나가지 않게)', () => {
    const fs2 = require('fs') as typeof import('fs');
    const orchestration = fs2.readFileSync(
      path.join(__dirname, '..', 'src/core/final/orchestration.ts'), 'utf-8',
    );
    expect(orchestration).toContain('CTA 후보가 하나도 없습니다');
    // 콘솔만이 아니라 사용자에게 보이는 로그로도 남겨야 한다
    expect(orchestration).toMatch(/onLog\?\.\(`⚠️ \$\{warning\}`\)/);
    // 애드센스 모드는 CTA 를 일부러 안 넣으므로 경고 대상이 아니다
    expect(orchestration).toContain("contentMode !== 'adsense' && renderedCtaUrls.size === 0");
  });
});
