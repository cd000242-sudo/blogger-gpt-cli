/**
 * v3.8.571 — CTA 를 "그 일이 되는 화면"으로 보낸다 (사장님: "지금의 너라면 어디로 보낼래")
 *
 * ## 실측이 먼저다 (2026-08-28, leadernam.com 253편 · CTA 주소 366개)
 *   · 기관 **홈으로만** 가는 글        40%
 *   · CTA 가 아예 없는 글             12%
 *   · 행동 화면이 있는 글             47%
 *   · CTA 주소 366개 중 **55개가 죽음**(DNS 실패·404·500·200 에러페이지)
 *
 * ## 고친 것 둘
 *
 * ### A. 살아있는 척하는 에러 페이지를 거부한다
 * 발행된 글에 이 주소가 박혀 있었다:
 *   https://www.fss.or.kr/fss/cv/cnslt/disptMain.do?menuNo=200004
 *   → HTTP **200**, 제목 "금융감독원 통합홈페이지- 에러페이지", 본문 82자
 * 상태코드·홈 판정·기관 판정 **셋 다 통과한다** — 에러 페이지에도 기관 이름이 있으니까.
 * 게이트는 이걸 demote(미룸)로 처리해 결국 CTA 로 썼다. reject(안 씀)여야 한다.
 *
 * ### B. 행동 의도를 본문에서도 읽는다
 * 홈으로만 가는 40% 의 근본 원인. 제목에 행동어가 없으면 intent 가 null 이 되고,
 * null 이면 검색어가 `"{제목} 공식 사이트"` 가 된다 — 홈을 달라고 했으니 홈이 온다.
 * 본문에는 "고용24에서 온라인 심사청구서를 제출" 처럼 할 일이 적혀 있다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { looksLikeErrorPage, gateCtaDestination } from '../src/cta/destination-gate';
import { detectActionIntent, detectActionIntentFromArticle, buildActionQuery } from '../src/cta/action-intent';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

/** 실측한 금감원 에러 페이지 그대로 */
const FSS_ERROR_TITLE = '금융감독원 통합홈페이지- 에러페이지';
const FSS_ERROR_BODY = '금융감독원 통합홈페이지 페이지가 없거나 잘못된 경로 입니다. '
  + '경로를 다시 확인하시고 이용해 주시기 바랍니다. 이용에 불편을 드려 대단히 죄송합니다.';

describe('A. 200 을 주는 에러 페이지를 알아본다', () => {
  test('실측한 금감원 에러 페이지를 잡는다', () => {
    expect(looksLikeErrorPage(FSS_ERROR_TITLE, FSS_ERROR_BODY)).toBe(true);
  });

  /** 스캔에서 실제로 나온 제목들 */
  test('제목만으로도 잡는다 (본문을 못 읽는 화면이 있다)', () => {
    expect(looksLikeErrorPage('정책브리핑 - Error', '')).toBe(true);
    expect(looksLikeErrorPage('페이지 오류', '')).toBe(true);
    expect(looksLikeErrorPage('에러페이지', '')).toBe(true);
  });

  /** "오류"가 들어가도 내용이 있으면 멀쩡한 페이지다 — 이 구분이 없으면 정상 글을 버린다 */
  test('제목에 오류가 들어간 정상 안내 페이지는 안 잡는다', () => {
    const guide = '오류 코드별 조치 방법을 안내합니다. 신청 화면에서 자주 나오는 오류를 정리했습니다. '.repeat(15);
    expect(guide.length).toBeGreaterThan(500);
    expect(looksLikeErrorPage('오류 신고 안내', guide)).toBe(false);
  });

  test('본문이 짧고 "없는 페이지"라고 말하면 잡는다', () => {
    expect(looksLikeErrorPage('', '요청하신 페이지를 찾을 수 없습니다.')).toBe(true);
    expect(looksLikeErrorPage('', '삭제되었거나 이동된 주소입니다.')).toBe(true);
  });

  /** 문턱이 없으면 멀쩡한 긴 페이지를 버린다 — 안내문에도 "요청하신 자료"가 나온다 */
  test('긴 정상 페이지는 같은 낱말이 있어도 안 잡는다', () => {
    const long = '요청하신 자료는 아래에서 내려받으실 수 있습니다. '.repeat(30);
    expect(long.length).toBeGreaterThan(500);
    expect(looksLikeErrorPage('민원 안내', long)).toBe(false);
  });

  test('평범한 행동 화면은 통과', () => {
    expect(looksLikeErrorPage('금융민원신청 안내', '금융민원을 인터넷으로 신청하실 수 있습니다.'.repeat(20))).toBe(false);
    expect(looksLikeErrorPage('', '')).toBe(false);
  });
});

describe('A-2. 게이트가 에러 페이지를 reject 한다 (demote 아님)', () => {
  const fetchPage = (html: string) => async () => ({ ok: true, html, finalUrl: '' });

  test('에러 페이지는 기관 이름이 있어도 거부한다', async () => {
    const html = `<html><head><title>${FSS_ERROR_TITLE}</title></head><body>${FSS_ERROR_BODY}</body></html>`;
    const verdict = await gateCtaDestination({
      url: 'https://www.fss.or.kr/fss/cv/cnslt/disptMain.do?menuNo=200004',
      keyword: '실손보험 지급 거절',
      intent: '신청',
      agencies: ['금융감독원'],           // ← 에러 페이지에도 이 이름이 적혀 있다
      fetchPage: fetchPage(html) as any,
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      // demote 면 "더 나은 걸 못 찾으면 결국 쓴다" — 그러면 독자가 빈 화면을 본다
      expect(verdict.severity).toBe('reject');
      expect(verdict.reasons.join(' ')).toContain('없는 페이지');
    }
  });

  /** 에러 판정을 넣으면서 멀쩡한 화면까지 막으면 CTA 가 통째로 사라진다 */
  test('멀쩡한 행동 화면은 여전히 통과한다', async () => {
    const html = '<html><head><title>금융민원신청 안내</title></head><body>'
      + '<h1>금융민원 신청</h1>'
      + '<a href="/apply">금융민원 신청하기</a><a href="/login">로그인</a>'
      + '실손보험 지급 거절 민원을 인터넷으로 신청하실 수 있습니다. '
      + '신청서를 작성해 온라인으로 접수하고 처리 결과를 조회하실 수 있습니다. '.repeat(12)
      + '</body></html>';
    const verdict = await gateCtaDestination({
      url: 'https://www.fss.or.kr/fss/main/contents.do?menuNo=201179',
      keyword: '실손보험 지급 거절 민원',
      intent: '신청',
      agencies: ['금융감독원'],
      fetchPage: fetchPage(html) as any,
    });
    // 통과 여부만 본다 — 점수 눈금은 action-link-harness 의 몫이다
    expect(verdict.ok).toBe(true);
  });
});

describe('B. 행동 의도를 본문에서도 읽는다', () => {
  /**
   * 실제로 위택스 **홈**으로 갔던 글(5310). 제목에 행동어가 없어 intent 가 null 이었고,
   * 검색어가 "…공식 사이트" 가 되어 홈이 왔다 — 관측 결과와 정확히 맞아떨어진다.
   */
  const TITLE = '오피스텔 이미 샀다면, 8·26 취득세 감면안 소급되나요?';
  const BODY = `
    <p>이미 납부한 취득세는 위택스에서 경정청구로 환급 신청할 수 있습니다.</p>
    <p>환급 신청은 신고기한 다음 날부터 5년 안에 해야 하며, 청구 서류를 함께 냅니다.</p>
    <p>감면 요건에 맞으면 환급 청구가 받아들여집니다. 신청 뒤 처리까지는 시간이 걸립니다.</p>
    ${'<p>취득 시점에 따라 적용 기준이 갈리는 지점을 정리했습니다.</p>'.repeat(6)}
  `;

  test('제목만 보면 행동을 못 읽는다 (이게 40% 홈행의 원인)', () => {
    expect(detectActionIntent(TITLE)).toBeNull();
  });

  test('본문을 보면 읽어 낸다', () => {
    expect(detectActionIntentFromArticle(BODY)).toBe('신청');
  });

  test('의도를 읽으면 검색어가 홈이 아니라 행동 화면을 향한다', () => {
    expect(buildActionQuery(TITLE, null)).toContain('공식 사이트');   // 예전 — 홈을 달라고 했다
    const better = buildActionQuery(TITLE, detectActionIntentFromArticle(BODY));
    expect(better).not.toContain('공식 사이트');
    expect(better).toContain('신청');
  });

  /** 본문은 길어서 온갖 낱말이 섞인다 — 지나가는 말 한 번에 끌려가면 안 된다 */
  test('스치듯 한 번 나온 낱말로는 판정하지 않는다', () => {
    const passing = `<p>${'이 제도의 배경을 설명합니다. '.repeat(40)}신청은 별개 문제입니다.</p>`;
    expect(detectActionIntentFromArticle(passing)).toBeNull();
  });

  test('짧은 글·빈 값에 걸려 넘어지지 않는다', () => {
    expect(detectActionIntentFromArticle('')).toBeNull();
    expect(detectActionIntentFromArticle('짧은 글')).toBeNull();
  });

  test('상품 글에는 행동 CTA 를 붙이지 않는다', () => {
    const review = `<p>가성비 추천 후기 비교입니다.</p>${'<p>구매 신청 접수 신청 접수.</p>'.repeat(10)}`;
    expect(detectActionIntentFromArticle(review)).toBeNull();
  });
});

describe('C. 배선 — 만들고 안 부르면 조용히 죽는다', () => {
  const gen = read('src/core/final/generation.ts');
  const gate = read('src/cta/destination-gate.ts');

  test('generation 이 본문 의도 판정을 실제로 부른다', () => {
    expect(gen).toContain("import { detectActionIntent, detectActionIntentFromArticle, buildActionQuery }");
    expect(gen).toContain('detectActionIntentFromArticle(articleText || \'\')');
  });

  test('제목 → 라우터 → 본문 순서로 본다 (본문이 앞서면 지나가는 말이 이긴다)', () => {
    const i1 = gen.indexOf('detectActionIntent(keyword)');
    const i2 = gen.indexOf('detectActionIntent(smartActionText)');
    const i3 = gen.indexOf('detectActionIntentFromArticle(');
    expect(i1).toBeGreaterThan(-1);
    expect(i2).toBeGreaterThan(i1);
    expect(i3).toBeGreaterThan(i2);
  });

  test('에러 판정이 기관 검사보다 먼저 온다 (에러 페이지에도 기관 이름이 있다)', () => {
    const errAt = gate.indexOf('looksLikeErrorPage(titleOf(page.html), text)');
    const agencyAt = gate.indexOf('const hitAgency =');
    expect(errAt).toBeGreaterThan(-1);
    expect(errAt).toBeLessThan(agencyAt);
  });
});
