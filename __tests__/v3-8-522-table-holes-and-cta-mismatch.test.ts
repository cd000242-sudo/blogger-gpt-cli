/**
 * v3.8.522 — 실물 검수 2건 (사장님 발행글: 본인부담상한제 환급금 실손보험 환수)
 *
 * ① 표에 구멍이 뚫렸다.
 *    "구분 | 가입 시점 | 약관 내 상한제 명시 | 환수 통보 시 대응 여지" 표에서
 *    앞 두 칸이 **네 줄 모두 빈칸**으로 나갔다.
 *    원인: 사실 가드가 셀마다 걸리는데, "2009년 10월 이전" 같은 셀은 통째로
 *    근거 미확인 수치라 문장 필터에서 전부 지워져 빈 칸이 남았다.
 *    → 구멍 난 표는 없는 표보다 나쁘다. 무엇에 대한 값인지 알 수 없어 독자를 오도한다.
 *
 * ② CTA 가 엉뚱한 회사 홈으로 갔다.
 *    본인부담상한제(국민건강보험공단) 글인데 버튼이 samsungfire.com 홈으로 나갔다.
 *    원인: 후보가 기준 미달이면 "기관 홈으로 물러섬" 폴백이 그대로 나간다.
 *    글이 지목한 기관과 다른 회사 홈이면 그건 물러섬이 아니라 오배송이다.
 */
import { sanitizeArticleFactClaims } from '../src/core/final/fact-integrity';
import { resolveActionLink } from '../src/cta/action-link-harness';
import type { FactEvidence } from '../src/core/final/fact-integrity';

// 근거 장부가 비어 있는 상태 — 실제 사고와 같은 조건 (수집 실패·무근거)
const noEvidence: FactEvidence = { context: '', provider: '', trustLevel: 'none' };
// 근거 장부가 있는 상태 (sourceUrls 까지 있어야 대조 가능한 근거로 친다)
const strongEvidence = (context: string): FactEvidence => ({
  context, provider: 'test', trustLevel: 'strong', sourceUrls: ['https://www.nhis.or.kr/'],
});

const makeArticle = (rows: string[][]) => ({
  introduction: '도입부입니다.',
  conclusion: '마무리입니다.',
  sections: [{
    h2: '환수 통보 대응',
    h3Sections: [{
      h3: '가입 시점별 결론',
      content: '<p>가입 시점에 따라 결론이 갈립니다.</p>',
      tables: [{
        headers: ['구분', '가입 시점', '약관 내 상한제 명시', '환수 통보 시 대응 여지'],
        rows,
      }],
    }],
  }],
});

describe('① 구멍 난 표는 내보내지 않는다', () => {
  it('사실 가드가 셀을 비우면 그 줄을 통째로 버린다 — 빈칸 표는 독자를 오도한다', () => {
    const article = makeArticle([
      ['1세대', '2009년 10월 이전', '미기재 또는 불명확', '약관 미기재 근거로 환수 거부 다툼 가능'],
      ['2세대', '2009년 10월 ~ 2017년 3월', '보상하지 않는 사항에 명시', '원칙적 환수 대상'],
    ]);
    const out: any = sanitizeArticleFactClaims(article as any, noEvidence);
    const table = out.sections[0].h3Sections[0].tables[0];
    const rows: string[][] = table?.rows || [];
    // 살아남은 줄이 있다면 어느 칸도 비어 있으면 안 된다
    for (const row of rows) {
      for (const cell of row) {
        expect(String(cell).trim()).not.toBe('');
      }
    }
  });

  it('줄이 전부 사라지면 표 자체를 버린다 — 머리글만 남은 표는 의미가 없다', () => {
    const article = makeArticle([
      ['1세대', '2009년 10월 이전', '미기재 또는 불명확', '약관 미기재 근거로 환수 거부 다툼 가능'],
    ]);
    const out: any = sanitizeArticleFactClaims(article as any, noEvidence);
    const tables = out.sections[0].h3Sections[0].tables || [];
    if (tables.length) {
      expect((tables[0].rows || []).length).toBeGreaterThan(0);
    }
  });

  it('근거가 있으면 표는 그대로 살아남는다 — 과잉 삭제 금지', () => {
    const evidence = strongEvidence(
      '실손보험은 1세대(2009년 10월 이전), 2세대(2009년 10월 ~ 2017년 3월)로 나뉜다. 약관에 미기재 또는 불명확한 경우가 있다.',
    );
    const article = makeArticle([
      ['1세대', '2009년 10월 이전', '미기재 또는 불명확', '다툼 가능'],
    ]);
    const out: any = sanitizeArticleFactClaims(article as any, evidence);
    const rows = out.sections[0].h3Sections[0].tables[0].rows;
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe('1세대');
    expect(rows[0][1]).toBe('2009년 10월 이전');
  });

  it('근거 장부가 비면 표가 통째로 빠진다 — 구멍 난 표를 내보내느니 없는 게 낫다', () => {
    // "정리 후에는 근거 없는 값이 남지 않는다"는 기존 계약을 지키면서 구멍도 안 남기는 유일한 답
    const rows = [['1세대', '2009년 10월 이전', '미기재 또는 불명확', '다툼 가능']];
    const out: any = sanitizeArticleFactClaims(makeArticle(rows) as any, noEvidence);
    expect(out.sections[0].h3Sections[0].tables).toHaveLength(0);
  });
});

describe('② 글이 지목한 기관과 다른 회사 홈은 내보내지 않는다', () => {
  const lowScorePage = async () => ({ ok: true, html: '<html><body>회사 소개</body></html>' });

  it('건강보험공단 글인데 삼성화재 홈으로 물러서지 않는다 — 오배송이다', async () => {
    const picked = await resolveActionLink({
      keyword: '본인부담상한제 환급금 실손보험 환수',
      intent: '신청',
      agencies: ['국민건강보험공단'],
      candidates: [{ url: 'https://www.samsungfire.com/', title: '삼성화재' }],
      fetchPage: lowScorePage as any,
      fallbackUrl: 'https://www.samsungfire.com/',
    });
    expect(picked.url).toBe('');            // CTA 를 넣지 않는다
    expect(picked.stage).toBe('none');
  });

  it('글이 지목한 기관의 홈이면 물러서도 된다 — 같은 곳이니 오배송이 아니다', async () => {
    const picked = await resolveActionLink({
      keyword: '본인부담상한제 환급금 신청',
      intent: '신청',
      agencies: ['국민건강보험공단'],
      candidates: [{ url: 'https://www.nhis.or.kr/', title: '국민건강보험공단' }],
      fetchPage: lowScorePage as any,
      fallbackUrl: 'https://www.nhis.or.kr/',
    });
    expect(picked.url).toBe('https://www.nhis.or.kr/');
    expect(picked.stage).toBe('home');
  });

  it('글이 기관을 지목하지 않았으면 예전처럼 홈으로 물러선다 — 과잉 차단 금지', async () => {
    const picked = await resolveActionLink({
      keyword: '어떤 서비스 신청',
      intent: '신청',
      agencies: [],
      candidates: [{ url: 'https://example.go.kr/', title: '기관' }],
      fetchPage: lowScorePage as any,
      fallbackUrl: 'https://example.go.kr/',
    });
    expect(picked.url).toBe('https://example.go.kr/');
    expect(picked.stage).toBe('home');
  });
});
