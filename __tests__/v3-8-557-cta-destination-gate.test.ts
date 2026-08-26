/**
 * CTA 목적지 게이트 (v3.8.557)
 *
 * 사장님 실물 검수(2026-08-26):
 *   "PDF 파일을 연동시키거나 보험 관련 글인데 국세청 홈으로 연동한다거나…
 *    실제 사람들이 글에 나온 정보대로 행동할 수 있는 결과를 볼 수 있는 곳을 연동해야 된다.
 *    글을 읽고 나가서 다시 검색할 필요 없게."
 *
 * 원인: 행동 화면 판정(action-link-harness)이 2단계(검색 폴백)에만 붙어 있었고,
 *       실제로 대부분의 CTA 를 정하는 1단계(AI 추론)는 "살아있는가"만 봤다.
 *       그래서 살아있는 기관 홈도, 살아있는 안내문 PDF 도 그대로 버튼이 됐다.
 *
 * 이 테스트는 그 두 사고를 키워드 그대로 잠근다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { gateCtaDestination, isDocumentUrl } from '../src/cta/destination-gate';
import { detectActionIntent } from '../src/cta/action-intent';

const page = (html: string, finalUrl?: string) => async (url: string) => ({
  ok: true,
  html,
  finalUrl: finalUrl || url,
});
const deadPage = async () => ({ ok: false, html: '' });

describe('① 문서 파일은 목적지가 아니다', () => {
  it('PDF 주소는 행동 화면으로 채택되지 않는다 (미루기 = demote)', async () => {
    const v = await gateCtaDestination({
      url: 'https://www.nts.go.kr/data/2026_근로장려금_안내.pdf',
      keyword: '근로장려금 신청 방법',
      intent: '신청',
      agencies: ['국세청'],
      fetchPage: page('<html>근로장려금 안내</html>'),
    });
    expect(v.ok).toBe(false);
    expect((v as any).severity).toBe('demote');
  });

  it('한글파일·엑셀·압축파일도 같다', () => {
    for (const u of [
      'https://www.moel.go.kr/notice/서식.hwp',
      'https://www.bokjiro.go.kr/f/list.xlsx?id=3',
      'https://example.go.kr/pack.zip',
      'https://example.go.kr/report.docx#page=2',
    ]) {
      expect(isDocumentUrl(u)).toBe(true);
    }
    expect(isDocumentUrl('https://www.hometax.go.kr/websquare/websquare.wq?w2xPath=/ui/pp/index.xml')).toBe(false);
  });
});

describe('② 엉뚱한 기관의 홈은 오배송 — 아예 쓰지 않는다', () => {
  it('⭐ 실사고: 건강보험 글의 CTA 가 국세청 홈 → reject', async () => {
    const v = await gateCtaDestination({
      url: 'https://www.nts.go.kr/',
      keyword: '본인부담상한제 환급 조회',
      intent: '조회',
      agencies: ['국민건강보험공단'],
      fetchPage: page('<html><body>국세청 홈페이지입니다. 세금 신고 안내</body></html>'),
    });
    expect(v.ok).toBe(false);
    expect((v as any).severity).toBe('reject');
  });

  it('기관이 맞으면 홈이어도 오배송은 아니다 — 미루기까지만 (demote)', async () => {
    const v = await gateCtaDestination({
      url: 'https://www.nhis.or.kr/',
      keyword: '본인부담상한제 환급 조회',
      intent: '조회',
      agencies: ['국민건강보험공단'],
      fetchPage: page('<html><body>국민건강보험공단 본인부담상한제 조회하기</body></html>'),
    });
    expect(v.ok).toBe(false);
    expect((v as any).severity).toBe('demote');
  });
});

describe('③ 기관 홈은 "다시 찾아라"는 말이다 — 행동이 있으면 미룬다', () => {
  it('홈 화면에 조회 배너가 있어도 홈이면 채택하지 않는다', async () => {
    const v = await gateCtaDestination({
      url: 'https://www.hometax.go.kr/',
      keyword: '근로장려금 신청 방법',
      intent: '신청',
      agencies: ['국세청'],
      fetchPage: page('<html><body>국세청 홈택스 근로장려금 신청하기 <form><button>신청</button></form></body></html>'),
    });
    expect(v.ok).toBe(false);
    expect((v as any).severity).toBe('demote');
  });

  it('⭐ 그 행동을 하는 화면이면 통과한다 (사장님 예시: 근로장려금 신청)', async () => {
    const v = await gateCtaDestination({
      url: 'https://www.hometax.go.kr/websquare/websquare.wq?w2xPath=/ui/pp/index_pp.xml',
      keyword: '근로장려금 신청 방법',
      intent: '신청',
      agencies: ['국세청'],
      fetchPage: page(
        '<html><body>국세청 홈택스 근로장려금 신청하기 <form><button type="submit">신청</button></form></body></html>',
      ),
    });
    expect(v.ok).toBe(true);
    expect((v as any).stage).toBe('action');
  });
});

describe('④ 물러설 때도 발행을 막지 않는다', () => {
  it('페이지를 못 읽으면 주소 모양만 본다 — 깊은 주소는 통과', async () => {
    const v = await gateCtaDestination({
      url: 'https://www.work24.go.kr/cm/l/a/1000/retrieveDtl.do?id=7',
      keyword: '실업급여 신청',
      intent: '신청',
      agencies: [],
      fetchPage: deadPage,
    });
    expect(v.ok).toBe(true);
  });

  it('기관 기준이 없으면 기관 검사로 떨어뜨리지 않는다', async () => {
    const v = await gateCtaDestination({
      url: 'https://www.gov.kr/portal/service/serviceInfo/1234',
      keyword: '주민등록등본 인터넷 발급',
      intent: '발급',
      agencies: [],
      fetchPage: page('<html><body>주민등록등본 발급하기 <form></form></body></html>'),
    });
    expect(v.ok).toBe(true);
  });

  it('행동을 못 읽은 글은 기존처럼 통과한다 (억지로 막지 않는다)', async () => {
    const v = await gateCtaDestination({
      url: 'https://www.kma.go.kr/w/weather/forecast/short-term.do',
      keyword: '장마 기간 정리',
      intent: null,
      agencies: [],
      fetchPage: page('<html><body>장마 예보</body></html>'),
    });
    expect(v.ok).toBe(true);
  });
});

describe('⑤ 행동은 키워드 밖에서도 읽힌다 (스마트 라우터의 action 문장)', () => {
  it('키워드에 행동어가 없어도 라우터 문장에서 읽는다', () => {
    expect(detectActionIntent('근로장려금')).toBe('신청');       // 주제 추론
    expect(detectActionIntent('본인부담상한제')).toBeNull();      // 키워드만으로는 못 읽는다
    expect(detectActionIntent('본인부담상한제 환급금 조회')).toBe('조회'); // 라우터가 정한 행동 문장
  });
});

/**
 * ⑥ 배선 — 만들어 놓고 아무도 안 부르면 조용히 죽는다.
 *
 * 이 프로젝트에서 같은 실수가 여러 번 났다(v3.8.372/373 은 두 릴리스 동안 무동작).
 * 게이트는 에러를 내지 않고 그냥 안 불리므로, 안 불려도 아무도 못 알아챈다.
 * 그래서 "발행 경로에 실제로 걸려 있는가"를 소스 문자열로 잠근다.
 */
describe('⑥ 발행 경로에 실제로 걸려 있다', () => {
  const generation = fs.readFileSync(path.join(__dirname, '..', 'src/core/final/generation.ts'), 'utf-8');

  it('⭐⭐ 1단계(AI 추론) 경로가 목적지 게이트를 부른다 (여기가 비어 있던 구멍이다)', () => {
    expect(generation).toContain("from '../../cta/destination-gate'");
    expect(generation).toContain('await gateCtaDestination({');
    // 하이브리드 검증을 통과한 뒤여야 한다 — 죽은 주소를 게이트에 태울 이유가 없다
    const vIdx = generation.indexOf('const isValid = await hybridValidateCta');
    const gIdx = generation.indexOf('await gateCtaDestination({');
    expect(vIdx).toBeGreaterThan(-1);
    expect(gIdx).toBeGreaterThan(vIdx);
  });

  it('⭐⭐ 게이트가 떨어뜨리면 그 주소로 CTA 를 달지 않는다', () => {
    // 채택 지점이 gate.ok 를 조건으로 갖는다. 이게 빠지면 게이트는 로그만 찍는 장식이 된다.
    expect(generation).toContain('if (isValid && (!gate || gate.ok))');
  });

  it('⭐ 기관 기준을 글에서 뽑아 게이트에 넘긴다 (기준이 없으면 오배송을 못 잡는다)', () => {
    expect(generation).toContain('ctaArticleAgencies');
    expect(generation).toMatch(/agencies:\s*gateAgencies/);
  });

  it('⭐⭐ demote 는 버리는 게 아니라 미루는 것이다 — 못 찾으면 되살아난다', () => {
    // 사장님: "버튼을 눌러야 광고 수익이 난다". reject 만 있으면 CTA 가 사라진다.
    expect(generation).toContain("if (gate.severity === 'demote')");
    expect(generation).toContain('weakCta = {');
    // 2단계까지 실패했을 때만 쓴다
    expect(generation).toContain('if (safeCTAs.length === 0 && weakCta)');
    const weakIdx = generation.indexOf('if (safeCTAs.length === 0 && weakCta)');
    const stage3Idx = generation.indexOf('3단계: 크롤링 데이터에서 공식 링크 탐색');
    expect(weakIdx).toBeGreaterThan(-1);
    // 범용 매핑(3~5단계)보다는 앞이다 — 이 글을 읽고 고른 주소가 더 가깝다
    expect(stage3Idx).toBeGreaterThan(weakIdx);
  });

  it('⭐ 2단계 하네스가 "넣지 말라"(none)고 하면 alive[0] 로 되살리지 않는다', () => {
    // 옛 코드는 picked.url || chosen.url 이라 오배송 차단이 여기서 조용히 무효가 됐다.
    expect(generation).toContain("if (picked.stage === 'none')");
    const noneIdx = generation.indexOf("if (picked.stage === 'none')");
    const chosenIdx = generation.indexOf('const chosen = alive.find((a) => a.url === picked.url)');
    expect(chosenIdx).toBeGreaterThan(noneIdx);
  });

  it('⭐ 행동이 있는 글에서는 문서 파일을 후보에서 뺀다', () => {
    expect(generation).toContain('if (actionIntent && isDocumentUrl(link))');
  });
});
