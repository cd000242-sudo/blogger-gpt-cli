/**
 * v3.8.688 — CTA 가 "글을 읽고" 목적지를 고르게 한다 (사장님 실물 검수)
 *
 * ## 실측 사고 (2026-09-07, leadernam.com)
 * 하지정맥류 실손 입원 거절 글의 CTA 가 이렇게 나갔다:
 *   훅   "금융감독원에 원문 안내가 있습니다."
 *   버튼 "🔗 금융감독원에서 신청하기"
 *   주소 https://www.fss.or.kr/fss/cvpl/ombdsmnDstrss/listCertification.do?menuNo=201100&viewType=MINWONBODY
 *
 * 그 주소를 열어보면 HTTP 200, 제목은 "금융감독원 민원신청" 인데 실물은
 * **이미 접수한 민원의 결과를 여는 인증 화면**이다 — 민원접수번호·주민등록번호·가상키패드.
 * 글을 읽고 온 독자에게는 넣을 접수번호가 없다.
 *
 * 사장님: "하지정맥류 글 써놓고 왜 금융감독원으로 유도하는거니"
 *         "CTA 추가하기 전에 글을 한번 정독시키면 안 되?"
 *         "하드코딩시키지말고 그때그때 추론해서 판단해서 넣게해야지 범용적이지 못하잖아"
 *
 * ## 새는 곳이 셋이었다 — 셋 다 규칙으로 막는다 (목적지 목록을 늘리지 않는다)
 *   ① 검색이 물어온 "조회 벽"을 게이트가 못 알아봤다
 *   ② 주제어가 0개인데 행동 화면으로 통과했다 (행동 3 + 기관 2 = 5 ≥ 문턱 4)
 *   ③ AI 목적지 판정이 본문 앞부분만 읽었다 (문단당 400자·총 3000자)
 */
import * as fs from 'fs';
import * as path from 'path';
import { looksLikeLookupWall, gateCtaDestination } from '../src/cta/destination-gate';
import { resolveActionLink } from '../src/cta/action-link-harness';
import { buildCtaArticleContext } from '../src/core/final/generation';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

/**
 * 실측한 금감원 민원조회 화면의 본문 그대로 (2026-09-07 수집).
 * 태그를 벗긴 텍스트다 — 판별기는 태그가 있든 없든 같은 답을 내야 한다.
 */
const FSS_LOOKUP_WALL = '금융감독원 민원신청 국민신문고 최초 접수하신 민원은 국민신문고에서 확인 하시기 '
  + '바랍니다. 신문고 민원 조회하기 서면(팩스, 우편 등) 접수 또는 타기관에서 이첩된 민원은 비밀번호를 '
  + '생성 하셔야 합니다. 비밀번호 생성 접수하신 민원에 대한 결과를 확인할 수 있습니다. 민원접수번호 '
  + '주민번호 민원접수번호 주민등록번호 - 성명 비밀번호 가상키패드 사용 가상키패드를 사용하면 '
  + '비밀번호가 보다 안전하게 보호됩니다. 접수번호확인 비밀번호 생성 및 찾기 조회 창 닫기';

const page = (html: string) => async (url: string) => ({ ok: true, html, finalUrl: url });

describe('① 접수번호를 요구하는 조회 벽을 알아본다', () => {
  test('⭐ 실측한 금감원 민원조회 화면을 잡는다', () => {
    expect(looksLikeLookupWall(FSS_LOOKUP_WALL)).toBe(true);
  });

  test('태그가 붙어 있어도 같은 답을 낸다', () => {
    expect(looksLikeLookupWall(`<div><p>${FSS_LOOKUP_WALL}</p></div>`)).toBe(true);
  });

  /** 진짜 신청 화면을 버리면 CTA 가 사라진다 — 그게 이 판별기의 가장 큰 위험이다 */
  test('진짜 신청 화면은 안 잡는다 (신청하기가 있으면 조회 벽이 아니다)', () => {
    const apply = '민원 신청하기 신청서 작성 화면입니다. 접수번호는 신청 완료 후 발급됩니다. '
      + '비밀번호 생성 후 조회할 수 있습니다.';
    expect(looksLikeLookupWall(apply)).toBe(false);
  });

  /** 마커 하나로 단정하면 멀쩡한 조회 서비스가 죽는다 */
  test('마커 하나뿐이면 잡지 않는다', () => {
    expect(looksLikeLookupWall('건강보험 자격득실확인서를 조회하려면 가상 키패드로 입력하세요.')).toBe(false);
  });

  test('평범한 안내 페이지는 잡지 않는다', () => {
    expect(looksLikeLookupWall('실손보험 입원 인정 기준을 안내합니다. 요양급여 적용 기준을 확인하세요.')).toBe(false);
  });

  test('⭐ 게이트가 조회 벽을 demote 한다 — reject 가 아닌 이유는 기관은 맞기 때문', async () => {
    const v = await gateCtaDestination({
      url: 'https://www.fss.or.kr/fss/cvpl/ombdsmnDstrss/listCertification.do?menuNo=201100',
      keyword: '하지정맥류 실손 입원 거절',
      intent: '신청',
      agencies: ['금융감독원'],
      fetchPage: page(`<html><title>금융감독원 민원신청</title><body>${FSS_LOOKUP_WALL}</body></html>`),
    });
    expect(v.ok).toBe(false);
    expect((v as any).severity).toBe('demote');
    expect((v as any).reasons.join(' ')).toContain('접수번호');
  });
});

describe('② 이 글의 주제어가 하나도 없으면 행동 화면으로 단정하지 않는다', () => {
  /**
   * 조회 벽 판별을 통과하더라도(다른 무관 페이지) 주제어 0 이면 막혀야 한다.
   * 이게 없으면 "그 기관의 신청 화면"이기만 하면 무슨 글에든 붙는다.
   */
  const 무관한신청화면 = '<html><title>금융감독원 민원신청</title><body>'
    + '<h1>금융감독원</h1><p>민원을 온라인 신청 하실 수 있습니다.</p>'
    + '<form><button type="submit">신청</button></form></body></html>';

  test('⭐ 게이트: 주제어 0 이면 action 이 아니라 guide 로 내려간다', async () => {
    const v = await gateCtaDestination({
      url: 'https://www.fss.or.kr/fss/cvpl/minwon/write.do',
      keyword: '하지정맥류 실손 입원 거절',
      intent: '신청',
      agencies: ['금융감독원'],
      fetchPage: page(무관한신청화면),
    });
    expect(v.ok).toBe(true);
    expect((v as any).stage).toBe('guide');   // 예전에는 'action' 이었다
    expect((v as any).reasons.join(' ')).toContain('주제어');
  });

  test('주제어가 있으면 예전처럼 action 이다 (멀쩡한 것을 막지 않는다)', async () => {
    const v = await gateCtaDestination({
      url: 'https://www.hometax.go.kr/ui/pp/index_pp.xml',
      keyword: '근로장려금 신청 방법',
      intent: '신청',
      agencies: ['국세청'],
      fetchPage: page('<html><body>국세청 홈택스 근로장려금 신청하기'
        + '<form><button type="submit">신청</button></form></body></html>'),
    });
    expect(v.ok).toBe(true);
    expect((v as any).stage).toBe('action');
  });

  test('⭐ 하네스도 같은 눈금을 쓴다 — 두 경로가 다르게 재면 안 된다', async () => {
    const r = await resolveActionLink({
      keyword: '하지정맥류 실손 입원 거절',
      intent: '신청',
      agencies: ['금융감독원'],
      candidates: [{ url: 'https://www.fss.or.kr/fss/cvpl/minwon/write.do' }],
      fetchPage: page(무관한신청화면),
      fallbackUrl: 'https://www.fss.or.kr',
    });
    expect(r.stage).toBe('guide');
    expect(r.reasons.join(' ')).toContain('주제어');
  });
});

describe('③ CTA 도 글을 정독한다', () => {
  /** 이 블로그 글은 소제목당 1,000자 안팎이다 — 400자로 자르면 절반 넘게 못 본다 */
  const 소제목 = (head: string, len: number) => ({
    h3: head,
    content: `${head} 관련 설명. ` + '가'.repeat(len),
  });

  test('⭐ 소제목 뒷부분이 잘리지 않는다 (400자 → 1200자)', () => {
    const ctx = buildCtaArticleContext([
      { h2: '실손보험 입원 거절', h3Sections: [소제목('하지정맥류 수술 입원기간 확인', 900)] },
    ]);
    // 900자짜리 문단이 통째로 들어와야 한다 — 400자 상한이면 여기서 잘렸다
    expect(ctx.excerpt.length).toBeGreaterThan(800);
  });

  test('⭐ 글 전체 상한이 12,000자다 (7,000~10,000자 글이 통째로 들어간다)', () => {
    const sections = Array.from({ length: 10 }, (_, i) => ({
      h2: `섹션${i}`,
      h3Sections: [소제목(`소제목${i}`, 900)],
    }));
    const ctx = buildCtaArticleContext(sections);
    expect(ctx.excerpt.length).toBeGreaterThan(8000);
    expect(ctx.excerpt.length).toBeLessThanOrEqual(12000);
  });

  test('마지막 소제목의 내용도 재료에 들어간다 — 핵심이 뒤에 있는 글이 있다', () => {
    const ctx = buildCtaArticleContext([
      { h2: '1', h3Sections: [소제목('실손보험 거절 사유', 900)] },
      { h2: '2', h3Sections: [소제목('요양급여 적용기준', 900)] },
      { h2: '3', h3Sections: [{ h3: '입원 인정 기준', content: '입원으로 인정되는 기준은 6시간 이상 관찰이다.' }] },
    ]);
    expect(ctx.excerpt).toContain('입원으로 인정되는 기준');
  });
});

describe('배선 — 만들고 아무도 안 부르면 조용히 무효다', () => {
  const gate = read('src/cta/destination-gate.ts');
  const harness = read('src/cta/action-link-harness.ts');

  test('게이트가 조회 벽 판별을 실제로 부른다', () => {
    expect(gate).toContain('if (looksLikeLookupWall(text))');
  });

  test('조회 벽 검사가 기관 검사보다 먼저다 — 에러 페이지와 같은 이유', () => {
    expect(gate.indexOf('looksLikeLookupWall(text)')).toBeLessThan(gate.indexOf('const hitAgency'));
  });

  test('하네스도 주제어 0 규칙을 갖고 있다', () => {
    expect(harness).toContain('!best.s.hasKeyword');
  });
});
