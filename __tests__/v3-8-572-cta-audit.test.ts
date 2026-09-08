/**
 * v3.8.572 — 발행된 글의 CTA 를 다시 보는 눈 (사장님: "남은 두가지 진행해주고")
 *
 * ## 왜 필요한가 — 실측 근거 (2026-08-28 leadernam.com)
 *   · CTA 주소 366개 중 **31개가 죽어 있었다** (404·500·DNS 실패·200 에러페이지)
 *   · 워크넷(work.go.kr)이 고용24 로 통합되며 통째로 404 — 발행 당시엔 멀쩡했다
 *   · `example.com/section1` 자리표시자가 그대로 나간 글도 있었다
 *   · 발행 글의 61% 가 기관 홈으로만 간다
 *
 * 발행 직전 게이트(destination-gate)는 **그때 한 번만** 본다. 링크는 그 뒤에 썩는다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';
import {
  isCtaCandidate, extractCtaUrls, classifyCtaLink, summarizePost, summarizeAudit, describeAudit,
} from '../src/cta/cta-audit';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

const page = (over: Partial<{ ok: boolean; status: number; html: string; finalUrl: string; errorCode: string }> = {}) => ({
  ok: true, status: 200, html: '', finalUrl: '', ...over,
});
const body = (text: string) => `<html><head><title>안내</title></head><body>${text.repeat(20)}</body></html>`;

describe('① CTA 로 셀 것과 안 셀 것', () => {
  test('SNS 공유 버튼은 CTA 가 아니다 (세면 숫자가 거짓말이 된다)', () => {
    for (const u of [
      'https://story.kakao.com/share?url=https://leadernam.com',
      'https://twitter.com/intent/tweet?url=x',
      'https://www.facebook.com/sharer/sharer.php?u=x',
      'https://share.naver.com/web/shareView?url=x',
    ]) expect(isCtaCandidate(u, 'leadernam.com')).toBe(false);
  });

  test('우리 글끼리의 링크도 CTA 가 아니다', () => {
    expect(isCtaCandidate('https://leadernam.com/tax/foo/', 'leadernam.com')).toBe(false);
    expect(isCtaCandidate('https://www.leadernam.com/tax/foo/', 'leadernam.com')).toBe(false);
  });

  test('바깥 기관 링크만 센다', () => {
    expect(isCtaCandidate('https://www.wetax.go.kr/', 'leadernam.com')).toBe(true);
  });

  test('본문에서 중복 없이 뽑는다', () => {
    const html = `
      <a href="https://www.gov.kr/a">가</a>
      <a href="https://www.gov.kr/a">가(중복)</a>
      <a href="https://leadernam.com/x/">내 글</a>
      <a href="https://story.kakao.com/share?url=x">공유</a>
      <a href="https://www.nps.or.kr/b">나</a>`;
    expect(extractCtaUrls(html, 'leadernam.com')).toEqual(['https://www.gov.kr/a', 'https://www.nps.or.kr/b']);
  });
});

describe('② 주소 한 개를 분류한다', () => {
  test('도메인이 사라졌으면(DNS 실패) 죽음', () => {
    const v = classifyCtaLink('https://www.lovevill.kr/', page({ ok: false, status: 0, errorCode: 'ENOTFOUND' }));
    expect(v.verdict).toBe('dead');
    expect(v.reason).toContain('DNS');
  });

  /**
   * 이 구분이 도구의 정확도를 가른다 — 실측(2026-08-28):
   *   efine.go.kr(경찰청교통민원24) 브라우저 200 / node "fetch failed"
   *   fill4young.kinfa.or.kr       브라우저 200 / node UNABLE_TO_VERIFY_LEAF_SIGNATURE
   * 한국 관공서는 인증서 체인이 불완전한 곳이 많다. 죽었다고 하면 멀쩡한 CTA 를 고치라고 시킨다.
   */
  test('인증서·TLS 실패는 죽음이 아니라 미확인 (브라우저에서는 열린다)', () => {
    for (const code of ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'fetch failed', 'ECONNRESET', 'ERR_TLS_CERT_ALTNAME_INVALID']) {
      const v = classifyCtaLink('https://www.efine.go.kr/', page({ ok: false, status: 0, errorCode: code }));
      expect(v.verdict).toBe('unknown');
    }
  });

  test('원인을 모르면 죽음으로 단정하지 않는다', () => {
    expect(classifyCtaLink('https://x.kr/a', page({ ok: false, status: 0 })).verdict).toBe('unknown');
  });

  test('4xx·5xx 는 죽음', () => {
    expect(classifyCtaLink('https://www.work.go.kr/empSpt/main/main.do', page({ status: 404, html: body('없음') })).verdict).toBe('dead');
    expect(classifyCtaLink('https://x.kr/a/b', page({ status: 500, html: body('오류') })).verdict).toBe('dead');
  });

  /** 이게 이 도구의 존재 이유다 — 상태코드만 보면 통과한다 */
  test('HTTP 200 인데 에러 페이지면 죽음 (실측 사례)', () => {
    const html = '<html><head><title>금융감독원 통합홈페이지- 에러페이지</title></head><body>'
      + '금융감독원 통합홈페이지 페이지가 없거나 잘못된 경로 입니다.</body></html>';
    const v = classifyCtaLink('https://www.fss.or.kr/fss/main.do', page({ status: 200, html }));
    expect(v.verdict).toBe('dead');
    expect(v.reason).toContain('없는 페이지');
  });

  test('문서 파일은 그 자리에서 할 수 없다', () => {
    expect(classifyCtaLink('https://www.gov.kr/guide.pdf', page({ status: 200, html: body('안내') })).verdict).toBe('document');
    expect(classifyCtaLink('https://x.kr/a.hwp', null).verdict).toBe('document');   // 못 받아도 문서는 문서다
  });

  test('기관 홈은 "다시 찾아라"가 된다', () => {
    const p = page({ status: 200, html: body('민원 신청 조회 안내 '), finalUrl: 'https://www.gov.kr/' });
    expect(classifyCtaLink('https://www.gov.kr/', p).verdict).toBe('home');
  });

  test('경로가 있는 행동 화면은 통과', () => {
    const p = page({
      status: 200,
      html: body('금융민원 신청서를 작성해 온라인으로 접수하실 수 있습니다 '),
      finalUrl: 'https://www.fss.or.kr/fss/main/contents.do?menuNo=201179',
    });
    expect(classifyCtaLink(p.finalUrl, p).verdict).toBe('action');
  });

  /** 스크립트로 그리는 화면은 본문이 비어 온다 — 죽었다고 단정하면 멀쩡한 걸 버린다 */
  test('본문을 못 읽으면 죽음이 아니라 미확인', () => {
    const v = classifyCtaLink('https://www.hometax.go.kr/x/y', page({ status: 200, html: '<html><body></body></html>' }));
    expect(v.verdict).toBe('unknown');
  });
});

describe('③ 글 단위 · 전체 요약', () => {
  const check = (verdict: any) => ({ url: 'https://x.kr/a', verdict, reason: '' });

  test('한 글에서 가장 급한 것이 대표가 된다 (죽음 > 홈 > 행동)', () => {
    expect(summarizePost({ postId: 1, title: '', link: '', checks: [check('action'), check('dead'), check('home')] }).worst).toBe('dead');
    expect(summarizePost({ postId: 2, title: '', link: '', checks: [check('action'), check('home')] }).worst).toBe('home');
    expect(summarizePost({ postId: 3, title: '', link: '', checks: [] }).worst).toBe('none');
  });

  test('전체 집계가 맞는다', () => {
    const reports = [
      summarizePost({ postId: 1, title: '', link: '', checks: [check('dead'), check('home')] }),
      summarizePost({ postId: 2, title: '', link: '', checks: [check('action')] }),
      summarizePost({ postId: 3, title: '', link: '', checks: [] }),
    ];
    const s = summarizeAudit(reports);
    expect(s).toMatchObject({ posts: 3, links: 3, dead: 1, home: 1, action: 1, noCta: 1 });
    expect(describeAudit(s)).toContain('죽음 1');
    expect(describeAudit(s)).toContain('CTA 없는 글 1편');
  });

  test('CTA 가 0개인 글이 링크 수를 부풀리지 않는다', () => {
    const s = summarizeAudit([summarizePost({ postId: 1, title: '', link: '', checks: [] })]);
    expect(s.links).toBe(0);
    expect(s.noCta).toBe(1);
  });
});

describe('④ 배선 — 앱에서 부를 수 있어야 도구다', () => {
  const main = read('electron/main.ts');

  test('IPC 가 등록돼 있다', () => {
    expect(main).toContain("ipcMain.handle('cta-audit-run'");
  });

  test('모듈을 실제로 쓴다 (만들고 안 부르면 죽은 코드다)', () => {
    // v3.8.689 — `src/` → `dist/`. src 에는 .ts 만 있어 이 채널도 로드에 실패하고 있었다
    //   (자세한 경위는 v3-8-570-cta-copy-unified.test.ts 의 같은 자리 주석).
    expect(main).toContain("require('../dist/cta/cta-audit')");
    expect(main).toContain('extractCtaUrls');
    expect(main).toContain('classifyCtaLink');
    expect(main).toContain('summarizeAudit');
  });

  test('같은 주소를 여러 번 받지 않는다 (366개 중 절반이 중복이었다)', () => {
    expect(main).toContain('const cache = new Map<string, any>()');
  });

  /** v3.8.706 — 여는 일은 page-fetcher 한 곳으로 모였다(크로미움·쿠키 리다이렉트). 검사기는 그것을 keepErrorBody 로 부른다 */
  test('리다이렉트를 따라가고 시간 제한을 둔다 — page-fetcher 를 쓴다', () => {
    const fetcher = read('src/cta/page-fetcher.ts');
    expect(main).toContain("require('../dist/cta/page-fetcher')");
    expect(main).toContain('fetchCtaPage(url, { timeoutMs: 15000, maxChars: Number.MAX_SAFE_INTEGER, keepErrorBody: true })');
    expect(fetcher).toContain("redirect: 'manual'");
    expect(fetcher).toContain('AbortController');
  });

  /** 원인을 안 넘기면 분류기가 TLS 실패와 DNS 실패를 구분할 수 없다 */
  test('실패 원인을 분류기에 넘긴다', () => {
    const fetcher = read('src/cta/page-fetcher.ts');
    expect(main).toContain('errorCode: r.errorCode');
    expect(fetcher).toContain('e?.cause?.code');
  });

  test('급한 것부터 보여준다', () => {
    expect(main).toContain("const order = ['dead', 'document', 'none', 'home', 'unknown', 'action']");
  });

  test('진행 상황을 알려준다 (수백 개를 훑으므로 멈춘 걸로 보인다)', () => {
    expect(main).toContain("send('cta-audit-progress'");
  });
});

/**
 * ⑤ 정밀 검사 — HTTP 로 못 읽는 것을 브라우저로 다시 본다.
 *
 * 실측: 미확인 54개 중 **35개가 갈렸다**(행동화면 22 · 홈 13).
 * 이게 없으면 절반 넘는 CTA 가 영영 "미확인"으로 남아 도구가 반쪽이 된다.
 */
describe('⑤ 정밀 검사 (deep)', () => {
  const main = read('electron/main.ts');
  const block = blockBetween(main, 'if (payload?.deep) {', 'const summary = summarizeAudit(reports)');

  test('미확인만 다시 본다 (전부 다시 열면 몇 시간 걸린다)', () => {
    expect(block).toContain("c.verdict === 'unknown'");
    expect(block).toContain('new Set(');
  });

  test('인증서가 불완전한 관공서 사이트를 위해 HTTPS 오류를 넘긴다', () => {
    expect(block).toContain('ignoreHTTPSErrors: true');
  });

  /** alert 를 띄우는 관공서 페이지에서 스크립트가 통째로 멈춘 적이 있다 */
  test('다이얼로그를 받아 넘긴다', () => {
    expect(block).toContain("pg.on('dialog'");
    expect(block).toContain('d.dismiss()');
  });

  /** 리다이렉트가 오류로 오는데 페이지는 떠 있다 — 이걸 죽음으로 보면 gov.kr 도 죽는다 */
  test('리다이렉트 경합을 죽음으로 보지 않는다', () => {
    expect(block).toContain('interrupted|Navigation');
  });

  test('브라우저에서도 DNS 실패만 죽음으로 넘긴다', () => {
    expect(block).toContain('ERR_NAME_NOT_RESOLVED');
    expect(block).toContain("'ENOTFOUND'");
  });

  test('다시 분류한 결과로 글 판정을 새로 만든다 (안 하면 화면이 안 바뀐다)', () => {
    expect(block).toContain('reports[i] = summarizePost(');
  });

  test('브라우저는 반드시 닫는다', () => {
    expect(block).toContain('finally { await browser.close()');
  });
});
