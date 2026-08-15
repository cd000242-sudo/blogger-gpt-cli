/**
 * CTA 행동 링크 하네스 — v3.8.501
 *
 * 지키는 것: "홈으로 보내지 않는다" 와 "확신 없으면 물러선다".
 * 죽은 딥링크는 홈보다 나쁘다 — 그 균형이 깨지지 않는지 본다.
 */
import {
  scoreActionPage, resolveActionLink, looksLikeHomeUrl, keywordTokens,
  analyzeArticleContext, hostMatches,
} from '../src/cta/action-link-harness';

const 신청화면 = `
  <html><head><title>청년내일저축계좌 신청 - 복지로</title></head>
  <body><h1>청년내일저축계좌</h1>
  <form action="/apply"><button type="submit">신청하기</button></form>
  </body></html>`;

const 기관홈 = `
  <html><head><title>복지로</title></head>
  <body><h1>복지로에 오신 것을 환영합니다</h1><a href="/menu">서비스 찾기</a></body></html>`;

const 안내페이지 = `
  <html><head><title>청년내일저축계좌 안내</title></head>
  <body><h2>청년내일저축계좌 지원 대상</h2><p>가입 조건은 다음과 같습니다.</p></body></html>`;

const 로그인벽 = `
  <html><body><p>로그인 후 이용하실 수 있습니다. 공동인증서로 본인확인 후 진행하세요.</p></body></html>`;

describe('홈 주소 판별', () => {
  it('경로가 없으면 홈이다', () => {
    expect(looksLikeHomeUrl('https://www.bokjiro.go.kr')).toBe(true);
    expect(looksLikeHomeUrl('https://www.bokjiro.go.kr/')).toBe(true);
    expect(looksLikeHomeUrl('https://x.kr/index.jsp')).toBe(true);
  });

  it('깊은 경로는 홈이 아니다', () => {
    expect(looksLikeHomeUrl('https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo.do')).toBe(false);
  });

  it('한 마디짜리 진입 경로도 사실상 홈이다', () => {
    expect(looksLikeHomeUrl('https://x.kr/portal')).toBe(true);
  });
});

describe('핵심어 뽑기', () => {
  it('군더더기 말을 뺀다 — 안 빼면 아무 페이지나 통과한다', () => {
    const t = keywordTokens('청년내일저축계좌 신청 방법 총정리');
    expect(t).toContain('청년내일저축계좌');
    expect(t).not.toContain('방법');
    expect(t).not.toContain('총정리');
  });
});

describe('페이지 채점', () => {
  const base = { keyword: '청년내일저축계좌 신청', intent: '신청' as const };

  it('신청 화면은 높은 점수를 받는다', () => {
    const s = scoreActionPage({ ...base, url: 'https://bokjiro.go.kr/apply/youth.do', html: 신청화면 });
    expect(s.score).toBeGreaterThanOrEqual(4);
    expect(s.hasActionElement).toBe(true);
    expect(s.looksLikeHome).toBe(false);
  });

  it('기관 홈은 감점된다 — 이게 지금 CTA 로 나가고 있었다', () => {
    const s = scoreActionPage({ ...base, url: 'https://www.bokjiro.go.kr', html: 기관홈 });
    expect(s.score).toBeLessThan(4);
    expect(s.looksLikeHome).toBe(true);
  });

  it('안내 페이지는 중간 — 홈보다 낫고 신청 화면보다 못하다', () => {
    const s = scoreActionPage({ ...base, url: 'https://bokjiro.go.kr/info/youth.do', html: 안내페이지 });
    expect(s.score).toBeGreaterThan(0);
    expect(s.score).toBeLessThan(4);
  });

  it('키워드가 없으면 통과 못 한다 — 엉뚱한 기관으로 보내면 안 된다', () => {
    const s = scoreActionPage({ ...base, url: 'https://bank.example/apply', html: '<form><button type="submit">신청하기</button></form>' });
    expect(s.hasKeyword).toBe(false);
    expect(s.score).toBeLessThan(4);
  });

  // 사장님 지시(2026-08-15): 로그인만 하면 되는 화면이면 그게 목적지다.
  // 처음엔 감점했는데 틀린 판단이었다 — 공공 신청 화면은 원래 로그인 뒤에 있다.
  it('로그인 벽은 감점하지 않는다 — 로그인만 하면 되는 화면이면 그게 목적지다', () => {
    const 로그인신청 = 신청화면 + '<p>로그인 후 이용하실 수 있습니다</p>';
    const 벽있음 = scoreActionPage({ ...base, url: 'https://bokjiro.go.kr/apply/youth.do', html: 로그인신청 });
    const 벽없음 = scoreActionPage({ ...base, url: 'https://bokjiro.go.kr/apply/youth.do', html: 신청화면 });
    expect(벽있음.loginWalled).toBe(true);
    expect(벽있음.score).toBeGreaterThanOrEqual(벽없음.score);   // 깎이지 않는다
    expect(벽있음.score).toBeGreaterThanOrEqual(4);              // 그대로 채택된다
  });

  it('주제와 무관한 맨 로그인 페이지는 주제어 검사에서 걸러진다', () => {
    const s = scoreActionPage({ ...base, url: 'https://x.kr/a/b', html: 로그인벽 });
    expect(s.hasKeyword).toBe(false);
    expect(s.score).toBeLessThan(4);
  });
});

describe('후보 고르기', () => {
  const fetcher = (map: Record<string, string>) => async (url: string) => ({
    ok: !!map[url], html: map[url] || '', finalUrl: url,
  });

  it('신청 화면이 있으면 그걸 고른다', async () => {
    const r = await resolveActionLink({
      keyword: '청년내일저축계좌 신청', intent: '신청',
      candidates: [{ url: 'https://www.bokjiro.go.kr' }, { url: 'https://bokjiro.go.kr/apply/youth.do' }],
      fetchPage: fetcher({
        'https://www.bokjiro.go.kr': 기관홈,
        'https://bokjiro.go.kr/apply/youth.do': 신청화면,
      }),
      fallbackUrl: 'https://www.bokjiro.go.kr',
    });
    expect(r.stage).toBe('action');
    expect(r.url).toBe('https://bokjiro.go.kr/apply/youth.do');
  });

  it('신청 화면이 없으면 안내 페이지로 — 홈보다 한 걸음 가깝다', async () => {
    const r = await resolveActionLink({
      keyword: '청년내일저축계좌 신청', intent: '신청',
      candidates: [{ url: 'https://bokjiro.go.kr/info/youth.do' }],
      fetchPage: fetcher({ 'https://bokjiro.go.kr/info/youth.do': 안내페이지 }),
      fallbackUrl: 'https://www.bokjiro.go.kr',
    });
    expect(r.stage).toBe('guide');
  });

  it('아무것도 기준을 못 넘으면 기존 링크로 물러선다 — 죽은 딥링크는 홈보다 나쁘다', async () => {
    const r = await resolveActionLink({
      keyword: '청년내일저축계좌 신청', intent: '신청',
      candidates: [{ url: 'https://www.bokjiro.go.kr' }],
      fetchPage: fetcher({ 'https://www.bokjiro.go.kr': 기관홈 }),
      fallbackUrl: 'https://www.bokjiro.go.kr',
    });
    expect(r.stage).toBe('home');
    expect(r.url).toBe('https://www.bokjiro.go.kr');
  });

  it('못 열리는 후보는 건너뛰고 다음을 본다', async () => {
    const r = await resolveActionLink({
      keyword: '청년내일저축계좌 신청', intent: '신청',
      candidates: [{ url: 'https://dead.example/x' }, { url: 'https://bokjiro.go.kr/apply/youth.do' }],
      fetchPage: async (u) => {
        if (u.includes('dead')) throw new Error('ENOTFOUND');
        return { ok: true, html: 신청화면, finalUrl: u };
      },
      fallbackUrl: 'https://www.bokjiro.go.kr',
    });
    expect(r.stage).toBe('action');
  });

  it('행동을 못 읽으면 기존 동작을 그대로 둔다 — 위험을 안 만든다', async () => {
    let called = 0;
    const r = await resolveActionLink({
      keyword: '한우 선물세트 추천', intent: null,
      candidates: [{ url: 'https://x.kr/a' }],
      fetchPage: async () => { called++; return { ok: true, html: '' }; },
      fallbackUrl: 'https://x.kr',
    });
    expect(r.stage).toBe('home');
    expect(called).toBe(0);   // 열어보지도 않는다 (발행 시간 낭비 금지)
  });

  it('후보를 무한정 열지 않는다 — 발행이 느려지면 안 된다', async () => {
    let called = 0;
    await resolveActionLink({
      keyword: '청년내일저축계좌 신청', intent: '신청',
      candidates: Array.from({ length: 10 }, (_, i) => ({ url: `https://x.kr/${i}` })),
      fetchPage: async () => { called++; return { ok: true, html: 기관홈 }; },
      fallbackUrl: 'https://x.kr',
    });
    expect(called).toBeLessThanOrEqual(3);
  });

  it('리다이렉트로 홈에 떨어지면 그 사실대로 채점한다', async () => {
    const r = await resolveActionLink({
      keyword: '청년내일저축계좌 신청', intent: '신청',
      candidates: [{ url: 'https://bokjiro.go.kr/apply/old.do' }],
      fetchPage: async () => ({ ok: true, html: 기관홈, finalUrl: 'https://www.bokjiro.go.kr' }),
      fallbackUrl: 'https://www.bokjiro.go.kr',
    });
    expect(r.stage).toBe('home');
  });
});

describe('행동어는 주제가 아니다 — 안 빼면 엉뚱한 기관으로 간다', () => {
  it('키워드에서 신청·조회 같은 행동어를 뺀다', () => {
    expect(keywordTokens('청년내일저축계좌 신청')).toEqual(['청년내일저축계좌']);
    expect(keywordTokens('건강보험료 조회 방법')).toEqual(['건강보험료']);
  });

  it('"신청"만 적힌 남의 기관 페이지는 키워드 일치로 안 쳐준다', () => {
    const s = scoreActionPage({
      url: 'https://bank.example/apply', keyword: '청년내일저축계좌 신청', intent: '신청',
      html: '<form><button type="submit">신청하기</button></form>',
    });
    expect(s.hasKeyword).toBe(false);
    expect(s.score).toBeLessThan(4);
  });
});


describe('① 분석 — 키워드가 아니라 글 맥락에서 읽는다', () => {
  const 본문 = `
    청년내일저축계좌는 복지로에서 신청합니다. 복지로 홈페이지에 접속해
    본인 인증을 마친 뒤 신청서를 작성하면 됩니다. 읍면동 주민센터 방문도 가능합니다.
    보건복지부 고시에 따라 소득 기준이 정해집니다. 복지로 신청 기간은 매년 다릅니다.`;

  it('글이 지목한 기관을 많이 나온 순으로 뽑는다', () => {
    const ctx = analyzeArticleContext({ keyword: '청년내일저축계좌 신청', content: 본문, intent: '신청' });
    expect(ctx.agencies[0]).toBe('복지로');
  });

  it('주제어에는 행동어가 안 들어간다', () => {
    const ctx = analyzeArticleContext({ keyword: '청년내일저축계좌 신청', content: 본문, intent: '신청' });
    expect(ctx.subject).toContain('청년내일저축계좌');
    expect(ctx.subject).not.toContain('신청');
  });

  it('기관을 못 찾아도 죽지 않는다', () => {
    const ctx = analyzeArticleContext({ keyword: '아무 주제', content: '내용 없음' });
    expect(Array.isArray(ctx.agencies)).toBe(true);
  });
});

describe('맥락이 채점을 정확하게 만든다', () => {
  it('글이 지목한 기관과 같은 곳이면 가산된다', () => {
    const base = { keyword: '청년내일저축계좌', intent: '신청' as const, url: 'https://www.bokjiro.go.kr/apply/x.do' };
    const html = '<h1>청년내일저축계좌</h1><button type="submit">신청하기</button>';
    const 맥락있음 = scoreActionPage({ ...base, html, agencies: ['복지로'] });
    const 맥락없음 = scoreActionPage({ ...base, html });
    expect(맥락있음.score).toBeGreaterThan(맥락없음.score);
  });

  it('기관 이름과 주소가 이어지는지 안다 (복지로 → bokjiro)', () => {
    expect(hostMatches('https://www.bokjiro.go.kr/x', '복지로')).toBe(true);
    expect(hostMatches('https://www.hometax.go.kr/x', '홈택스')).toBe(true);
    expect(hostMatches('https://bank.example/x', '복지로')).toBe(false);
  });

  it('맥락을 resolveActionLink 에 넘기면 그 기관 페이지가 이긴다', async () => {
    const r = await resolveActionLink({
      keyword: '청년내일저축계좌', intent: '신청', agencies: ['복지로'],
      candidates: [
        { url: 'https://bank.example/apply/savings.do' },
        { url: 'https://www.bokjiro.go.kr/apply/youth.do' },
      ],
      fetchPage: async (u) => ({
        ok: true, finalUrl: u,
        html: u.includes('bokjiro')
          ? '<h1>청년내일저축계좌</h1><button type="submit">신청하기</button>'
          : '<h1>적금 상품</h1><button type="submit">신청하기</button>',
      }),
      fallbackUrl: 'https://www.bokjiro.go.kr',
    });
    expect(r.url).toContain('bokjiro');
    expect(r.stage).toBe('action');
  });
});

describe('발행 흐름 배선 — 만들고 아무도 안 부르면 조용히 무효다', () => {
  const gen = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'src/core/final/generation.ts'), 'utf-8');

  it('CTA 결정부가 하네스를 부른다', () => {
    expect(gen).toContain("from '../../cta/action-link-harness'");
    expect(gen).toContain('await resolveActionLink(');
    expect(gen).toContain('analyzeArticleContext(');
  });

  it('후보를 열어볼 수단(fetchPage)을 넘긴다 — 안 넘기면 채점을 못 한다', () => {
    expect(gen).toContain('fetchPage: fetchPageForCta');
    expect(gen).toContain('async function fetchPageForCta');
  });

  it('글 맥락을 실제로 전달한다 — 안 넘기면 기관 판정이 조용히 무효다', () => {
    expect(gen).toContain('const articleText = [');
    expect(gen).toMatch(/searchOfficialSite\(keyword, googleCseKey, googleCseCx, contentMode, false, articleText\)/);
    // 폴백 재귀에도 이어져야 한다
    expect(gen).toMatch(/searchOfficialSite\(keyword, googleCseKey, googleCseCx, contentMode, true, articleText\)/);
    expect(gen).toContain('agencies: ctx.agencies');
  });

  it('살아있는 첫 후보를 그대로 채택하던 옛 경로가 남아 있지 않다', () => {
    // 그게 기관 홈이 CTA 로 나가던 원인이었다
    expect(gen).not.toMatch(/if \(check\.isValid\) \{\s*console\.log\(`\[CTA\] ✅/);
  });

  it('하네스가 실패해도 발행을 막지 않는다', () => {
    expect(gen).toContain('행동 화면 판정 실패, 기존 방식으로');
  });
});
