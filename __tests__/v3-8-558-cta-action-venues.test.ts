/**
 * 창구 버튼 — 같은 행동을 할 수 있는 곳이 여러 곳이면 버튼도 여러 개 (v3.8.558)
 *
 * 사장님 지시(2026-08-26):
 *   "본문 아래에 두는 게 낫지. 그리고 같은 링크를 중복으로 넣으면 안 되고,
 *    본문에서 추론해서 사람들의 행동을 유발하는 부분을 알아내고 그걸 연동시키는데,
 *    예를 들면 근로장려금 신청이라면 은행마다 신청이 가능하잖아. 그럼 가능한 은행을
 *    버튼으로 전부 박스로 감싸서 깔끔하게 연동되어야 되겠지?
 *    그리고 버튼을 누르면 농협이라면 농협 홈으로 가면 안 되고
 *    근로장려금 신청할 수 있는 페이지로 가야 돼."
 *
 * 원인: 버튼이 1개였던 건 중복 방지가 과해서가 아니다. generateCTAsFinal 의 삽입 지점
 *       8곳 중 7곳이 `safeCTAs.length === 0` 으로 잠겨 있어 후보 배열에 늘 1개만 담겼고,
 *       하단 CTA 자리는 "겹치지 않는 후보 없음"으로 스스로 생략됐다.
 *
 * 이 테스트는 그 지시를 문장 그대로 잠근다.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  collectActionVenues,
  resolveActionVenues,
  judgeVenueHost,
  venueUrlKey,
  venueButtonText,
} from '../src/cta/action-venues';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

/** 근로장려금을 신청할 수 있는 화면 — 주제어 + 행동 문구 + 창구 이름 */
const 신청화면 = (venue: string) => `
<html><head><title>${venue} 근로장려금 신청</title></head>
<body><h1>근로장려금 신청하기</h1><form action="/apply"><button>신청</button></form>
<p>${venue} 인터넷뱅킹에서 근로장려금을 신청할 수 있습니다.</p></body></html>`;

/** 은행 첫 화면 — 근로장려금 배너는 있지만 여기서 신청은 못 한다 */
const 은행홈 = `
<html><head><title>KB국민은행</title></head>
<body><p>근로장려금 신청하기 안내 배너</p></body></html>`;

const pageOf = (map: Record<string, string>) => async (url: string) => {
  const html = map[url];
  return html ? { ok: true, html, finalUrl: url } : { ok: false, html: '' };
};

const searchOf = (map: Record<string, Array<{ url: string; title: string }>>) =>
  async (query: string) => {
    const hit = Object.keys(map).find((venue) => query.includes(venue));
    return hit ? map[hit]! : [];
  };

describe('① 창구는 본문에서 읽는다 (코드에 은행 목록을 박지 않는다)', () => {
  it('⭐ 본문이 말한 은행들을 전부 뽑는다', () => {
    const article = `
      근로장려금은 국세청 홈택스에서 신청할 수 있습니다.
      은행 창구도 가능합니다. 농협은행, 국민은행, 기업은행에서 신청하세요.
      국민은행은 인터넷뱅킹으로도 됩니다.`;
    const venues = collectActionVenues(article);
    expect(venues).toEqual(expect.arrayContaining(['농협은행', '국민은행', '기업은행']));
  });

  it('⭐ 많이 나온 창구가 앞에 온다 (글이 여러 번 부른 이름이 진짜 창구다)', () => {
    const venues = collectActionVenues('국민은행 국민은행 국민은행 농협은행');
    expect(venues[0]).toBe('국민은행');
  });

  it('⭐⭐ "시중은행"은 창구가 아니다 — 갈 곳이 없는 이름을 검색하면 시간만 버린다', () => {
    const venues = collectActionVenues('시중은행에서 신청하세요. 주거래은행도 가능합니다.');
    expect(venues).not.toContain('시중은행');
    expect(venues).not.toContain('주거래은행');
  });

  it('⭐⭐ "농협"과 "농협은행"이 같이 나오면 하나로 합친다 (같은 창구에 버튼 두 개 = 중복)', () => {
    const venues = collectActionVenues('농협 창구 방문. 농협은행 인터넷뱅킹도 가능.');
    expect(venues).toContain('농협은행');
    expect(venues).not.toContain('농협');
  });

  it('대표 CTA 가 이미 가리키는 기관은 빼고 뽑는다', () => {
    const venues = collectActionVenues('홈택스에서 신청. 농협은행에서도 신청.', ['홈택스']);
    expect(venues).not.toContain('홈택스');
    expect(venues).toContain('농협은행');
  });

  it('접미어가 없는 창구도 잡는다 (우체국·새마을금고·신협)', () => {
    const venues = collectActionVenues('우체국, 새마을금고, 신협에서도 접수합니다.');
    expect(venues).toEqual(expect.arrayContaining(['우체국', '새마을금고', '신협']));
  });
});

describe('② 버튼은 홈이 아니라 그 행동을 하는 화면으로 간다', () => {
  it('⭐⭐ 사장님 예시: 농협 홈이 아니라 근로장려금 신청 화면이 버튼이 된다', async () => {
    const 신청url = 'https://www.nonghyup.com/eitc/apply';
    const found = await resolveActionVenues({
      keyword: '근로장려금 신청',
      intent: '신청',
      venues: ['농협은행'],
      search: searchOf({ 농협은행: [{ url: 신청url, title: '농협은행 근로장려금 신청' }] }),
      fetchPage: pageOf({ [신청url]: 신청화면('농협은행') }),
    });

    expect(found).toHaveLength(1);
    expect(found[0]!.url).toBe(신청url);
    expect(found[0]!.name).toBe('농협은행');
  });

  it('⭐⭐ 홈밖에 못 찾은 창구는 버튼을 아예 안 만든다 (홈으로 보내느니 빼는 게 낫다)', async () => {
    const 홈 = 'https://www.kbstar.com/';
    const found = await resolveActionVenues({
      keyword: '근로장려금 신청',
      intent: '신청',
      venues: ['국민은행'],
      search: searchOf({ 국민은행: [{ url: 홈, title: 'KB국민은행' }] }),
      fetchPage: pageOf({ [홈]: 은행홈 }),
    });

    expect(found).toHaveLength(0);
  });

  it('⭐ 안내문 PDF 는 버튼이 되지 않는다', async () => {
    const pdf = 'https://www.nts.go.kr/eitc/guide.pdf';
    let opened = 0;
    const found = await resolveActionVenues({
      keyword: '근로장려금 신청',
      intent: '신청',
      venues: ['농협은행'],
      search: searchOf({ 농협은행: [{ url: pdf, title: '농협은행 근로장려금 안내' }] }),
      fetchPage: async (url) => { opened++; return pageOf({})(url); },
    });

    expect(found).toHaveLength(0);
    expect(opened).toBe(0); // 열어 보지도 않는다 — 확장자로 안다
  });

  it('⭐ 블로그·카페 글은 창구 후보가 아니다', async () => {
    const blog = 'https://blog.naver.com/someone/123';
    const found = await resolveActionVenues({
      keyword: '근로장려금 신청',
      intent: '신청',
      venues: ['농협은행'],
      search: searchOf({ 농협은행: [{ url: blog, title: '농협은행 근로장려금 신청 후기' }] }),
      fetchPage: pageOf({ [blog]: 신청화면('농협은행') }),
    });

    expect(found).toHaveLength(0);
  });

  it('첫 후보가 홈이어도 다음 후보에서 신청 화면을 찾으면 그걸 쓴다', async () => {
    const 홈 = 'https://www.kbstar.com/';
    const 신청url = 'https://www.kbstar.com/eitc/apply';
    const found = await resolveActionVenues({
      keyword: '근로장려금 신청',
      intent: '신청',
      venues: ['국민은행'],
      search: searchOf({
        국민은행: [
          { url: 홈, title: 'KB국민은행' },
          { url: 신청url, title: 'KB국민은행 근로장려금 신청' },
        ],
      }),
      fetchPage: pageOf({ [홈]: 은행홈, [신청url]: 신청화면('국민은행') }),
    });

    expect(found).toHaveLength(1);
    expect(found[0]!.url).toBe(신청url);
  });
});

describe('③ 같은 링크를 중복으로 넣지 않는다 (사장님 지시)', () => {
  it('⭐⭐ 이미 다른 자리에 쓰인 주소는 창구 버튼으로 다시 쓰지 않는다', async () => {
    const 신청url = 'https://www.nonghyup.com/eitc/apply';
    const found = await resolveActionVenues({
      keyword: '근로장려금 신청',
      intent: '신청',
      venues: ['농협은행'],
      skipUrls: [신청url],
      search: searchOf({ 농협은행: [{ url: 신청url, title: '농협은행 근로장려금 신청' }] }),
      fetchPage: pageOf({ [신청url]: 신청화면('농협은행') }),
    });

    expect(found).toHaveLength(0);
  });

  it('⭐⭐ 두 창구가 같은 페이지로 가면 버튼은 하나만 만든다', async () => {
    const 공용url = 'https://www.hometax.go.kr/eitc/apply';
    const html = 신청화면('홈택스');
    const found = await resolveActionVenues({
      keyword: '근로장려금 신청',
      intent: '신청',
      venues: ['농협은행', '국민은행'],
      search: async () => [{ url: 공용url, title: '근로장려금 신청' }],
      fetchPage: pageOf({ [공용url]: html }),
    });

    expect(found).toHaveLength(1);
  });

  it('⭐ ?utm= 만 다른 같은 페이지도 같은 주소로 본다', () => {
    expect(venueUrlKey('https://a.kr/apply?utm=1')).toBe(venueUrlKey('https://a.kr/apply?utm=2'));
    expect(venueUrlKey('https://a.kr/apply/')).toBe(venueUrlKey('https://a.kr/apply'));
    expect(venueUrlKey('https://a.kr/apply')).not.toBe(venueUrlKey('https://a.kr/check'));
  });
});

describe('④ 버튼을 늘리려고 발행을 붙잡지 않는다', () => {
  it('⭐ 시간 상한을 넘으면 거기까지 찾은 것만 쓴다', async () => {
    const found = await resolveActionVenues({
      keyword: '근로장려금 신청',
      intent: '신청',
      venues: ['농협은행', '국민은행', '기업은행'],
      budgetMs: -1, // 이미 상한을 넘긴 상태
      search: async () => { throw new Error('불려서는 안 된다'); },
      fetchPage: pageOf({}),
    });

    expect(found).toHaveLength(0);
  });

  it('⭐ 버튼 수 상한을 지킨다', async () => {
    const html = 신청화면('은행');
    const found = await resolveActionVenues({
      keyword: '근로장려금 신청',
      intent: '신청',
      venues: ['농협은행', '국민은행', '기업은행', '신한은행'],
      limit: 2,
      search: async (q) => {
        const venue = ['농협은행', '국민은행', '기업은행', '신한은행'].find((v) => q.includes(v))!;
        return [{ url: `https://www.${encodeURIComponent(venue)}.kr/eitc/apply`, title: `${venue} 근로장려금 신청` }];
      },
      fetchPage: async (url) => ({ ok: true, html, finalUrl: url }),
    });

    expect(found.length).toBeLessThanOrEqual(2);
  });

  it('⭐ 검색이 실패해도 예외를 던지지 않는다 (발행이 멈추면 안 된다)', async () => {
    const found = await resolveActionVenues({
      keyword: '근로장려금 신청',
      intent: '신청',
      venues: ['농협은행'],
      search: async () => { throw new Error('네이버 API 오류'); },
      fetchPage: pageOf({}),
    });

    expect(found).toEqual([]);
  });

  it('창구 하나당 열어 보는 페이지 수에 상한이 있다', async () => {
    let opened = 0;
    await resolveActionVenues({
      keyword: '근로장려금 신청',
      intent: '신청',
      venues: ['농협은행'],
      probePerVenue: 2,
      search: async () => Array.from({ length: 10 }, (_, i) => ({
        url: `https://www.nonghyup.com/x/${i}`,
        title: '농협은행 근로장려금 신청',
      })),
      fetchPage: async (url) => { opened++; return { ok: false, html: '', finalUrl: url }; },
    });

    expect(opened).toBeLessThanOrEqual(2);
  });
});

describe('⑤ 창구 주소를 믿을 근거가 있어야 쓴다', () => {
  it('공공·기관 도메인은 통과한다', () => {
    expect(judgeVenueHost('https://www.hometax.go.kr/eitc', '홈택스', '', '근로장려금')).toBe(true);
  });

  it('검색 결과 제목이 그 창구를 말하면 통과한다 (은행은 .go.kr 이 아니다)', () => {
    expect(judgeVenueHost('https://www.nonghyup.com/eitc', '농협은행', '농협은행 근로장려금', '근로장려금')).toBe(true);
  });

  it('⭐ 근거가 없는 낯선 도메인은 쓰지 않는다', () => {
    expect(judgeVenueHost('https://postmate.waffle-gl.org/link/x', '농협은행', '대출 정보', '근로장려금')).toBe(false);
  });
});

describe('⑥ 버튼 문구', () => {
  it('창구 이름과 행동이 함께 보인다', () => {
    expect(venueButtonText('농협은행', '신청')).toBe('농협은행 신청하기');
    expect(venueButtonText('홈택스', '조회')).toBe('홈택스 조회하기');
  });
});

describe('⑦ 발행 경로에 실제로 걸려 있다 (만들고 안 부르면 조용히 죽는다)', () => {
  const generation = read('src/core/final/generation.ts');
  const orchestration = read('src/core/final/orchestration.ts');

  it('⭐⭐ orchestration 이 창구 버튼을 만들어 하단 박스에 넣는다', () => {
    expect(orchestration).toContain('generateVenueCtasFinal');
    expect(orchestration).toContain('await generateVenueCtasFinal({');
    expect(orchestration).toContain('extraButtons');
  });

  it('⭐⭐ 사장님 지시대로 본문 아래다 — 하단 CTA 자리에서만 부른다', () => {
    const venueIdx = orchestration.indexOf('await generateVenueCtasFinal({');
    const bottomIdx = orchestration.indexOf('💰 하단 최종 CTA 버튼');
    expect(bottomIdx).toBeGreaterThan(-1);
    expect(venueIdx).toBeGreaterThan(bottomIdx);
  });

  it('⭐⭐ 이미 렌더된 주소를 넘겨 같은 링크가 두 번 나오지 않게 한다', () => {
    expect(orchestration).toContain('skipUrls: [...renderedCtaUrls');
    // 창구 버튼도 렌더 뒤에 사용 표시를 남긴다 — 안 그러면 뒤 단계가 같은 주소를 또 쓴다
    expect(orchestration).toContain('venueButtons.forEach(b => markRenderedCta(renderedCtaUrls, b.url))');
  });

  it('⭐⭐ 애드센스 모드는 부르지 않는다 (승인이 목적이라 CTA 를 넣지 않는다)', () => {
    expect(generation).toContain("if (contentMode === 'adsense' || contentMode === 'shopping') return none;");
  });

  it('⭐ 대표 CTA 가 이미 쓰였어도 창구 버튼은 박스로 나간다', () => {
    expect(orchestration).toContain('} else if (venueButtons.length) {');
  });

  it('⭐ 창구가 한 곳뿐이면 검색을 더 돌리지 않는다 (버튼을 억지로 늘리지 않는다)', () => {
    expect(generation).toContain('if (venues.length < 2)');
  });

  it('⭐ 창구 탐색이 실패해도 발행은 계속된다', () => {
    const idx = orchestration.indexOf('await generateVenueCtasFinal({');
    const before = orchestration.slice(Math.max(0, idx - 400), idx);
    expect(before).toContain('try {');
  });

  it('창구 버튼이 없으면 예전과 같은 HTML 이 나온다 (기존 호출부 5곳 무영향)', () => {
    expect(orchestration).toContain('const extras = (input.extraButtons || []).filter');
    expect(orchestration).toContain("? `\n  <div class=\"cta-venue-grid\"");
  });
});
