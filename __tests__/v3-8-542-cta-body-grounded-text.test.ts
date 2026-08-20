/**
 * CTA 문구를 본문에서 뽑는다 (v3.8.542)
 *
 * 사장님 지시: "공식 CTA 후킹 문구랑 버튼 문구도 제목 그대로 하지말고
 *               본문에서 추론한 내용을 토대로 생성해야되"
 *
 * 진짜 원인은 프롬프트가 아니라 **없는 키를 읽던 재료 수집기**였다.
 *   섹션의 실제 모양 : { h2, h3Sections: [{ h3, content }] }
 *   v3.8.501 이 읽던 것: sec.title / sec.content / sec.body → 전부 undefined
 * 그래서 "글 맥락"이라며 넘긴 문자열이 공백뿐이었고, AI 는 키워드만 보고 문구를 지었다.
 *
 * 계약:
 *  ① buildCtaArticleContext 는 실제 키로 목차와 본문을 뽑는다 (유령 키 회귀 방지)
 *  ② 제목을 되뇐 문구는 기각된다 — 본문 근거 문구만 버튼에 오른다
 *  ③ 라우터는 후킹 문구도 본문 근거로 만들고, 못 만들면 빈 값으로 둔다 (날조 금지)
 *  ④ 비용: 라우터는 "필요할 때만" — 늘 부르지 않는다
 */

const callGeminiWithRetry = jest.fn();
jest.mock('../src/core/final/gemini-engine', () => ({
  callGeminiWithRetry: (...args: unknown[]) => callGeminiWithRetry(...args),
}));

import { buildCtaArticleContext, isCtaTextEchoOfTitle } from '../src/core/final/generation';
import { resolveSmartCtaTarget, clearSmartCtaCache } from '../src/cta/smart-cta';
import * as fs from 'fs';
import * as path from 'path';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const genSrc = read('src/core/final/generation.ts');

/** 실제 파이프가 만드는 섹션 모양 그대로 */
const REAL_SECTIONS = [
  {
    h2: '전세임대 주택이 경매로 넘어가면',
    h3Sections: [
      { h3: '낙찰 후 퇴거 기준일', content: '<p>낙찰자가 잔금을 낸 날부터 <b>인도명령</b> 신청이 가능합니다.</p>', tables: [] },
      { h3: '계약 잔여기간 확인', content: '<p>LH 계약은 2년 단위로 갱신되며 잔여기간이 남아 있으면 대항력을 따집니다.</p>', tables: [] },
    ],
  },
  {
    h2: '보증금은 어디까지 돌려받나',
    h3Sections: [{ h3: '최우선변제', content: '<p>소액임차인 기준을 넘으면 배당 순위로 밀립니다.</p>', tables: [] }],
  },
];

beforeEach(() => {
  callGeminiWithRetry.mockReset();
  clearSmartCtaCache();
});

describe('① 재료 수집 — 실제 키를 읽는다 (유령 키 회귀 방지)', () => {
  it('⭐ h2 / h3Sections[].content 에서 목차와 본문을 뽑는다', () => {
    const ctx = buildCtaArticleContext(REAL_SECTIONS, [{ agency: 'LH 한국토지주택공사' }]);

    expect(ctx.outline).toContain('## 전세임대 주택이 경매로 넘어가면');
    expect(ctx.outline).toContain('- 낙찰 후 퇴거 기준일');
    expect(ctx.excerpt).toContain('인도명령');
    expect(ctx.outline).toContain('- 최우선변제');
    expect(ctx.excerpt).toContain('소액임차인'); // 마지막 섹션 본문까지 걷는다 — 첫 섹션만 읽지 않는다
    expect(ctx.agencies).toBe('LH 한국토지주택공사');
    expect(ctx.combined).toContain('확인된 기관: LH 한국토지주택공사');
  });

  it('예전 방식(sec.title/sec.content)으로 읽으면 비어버린다 — 이게 그 버그였다', () => {
    const oldWay = REAL_SECTIONS.map((sec: any) => `${sec?.title || ''} ${sec?.content || sec?.body || ''}`)
      .join(' ')
      .trim();
    expect(oldWay).toBe(''); // 공백뿐 → AI 는 키워드만 보고 문구를 지었다

    const nowWay = buildCtaArticleContext(REAL_SECTIONS).excerpt;
    expect(nowWay.length).toBeGreaterThan(50);
  });

  it('HTML 태그는 벗기고 넘긴다 — 프롬프트에 태그가 섞이면 문구에도 섞인다', () => {
    const ctx = buildCtaArticleContext(REAL_SECTIONS);
    expect(ctx.excerpt).not.toMatch(/<\/?[a-z]/i);
  });

  it('다른 모양(title/content)으로 들어와도 버리지 않는다', () => {
    const ctx = buildCtaArticleContext([{ title: '다른 조립 경로', content: '<p>큐·스케줄이 따로 조립한다</p>' }]);
    expect(ctx.outline).toContain('## 다른 조립 경로');
    expect(ctx.excerpt).toContain('큐·스케줄이 따로 조립한다');
  });

  it('섹션이 없어도 터지지 않는다 — CTA 는 있으면 좋고 없어도 되는 보충 기능이다', () => {
    expect(buildCtaArticleContext(undefined, undefined)).toEqual({
      outline: '',
      excerpt: '',
      agencies: '',
      combined: '',
    });
  });
});

describe('② 제목 복제 문구 판정 — 사장님이 지적한 바로 그 문구', () => {
  const KEYWORD = 'LH신혼부부전세임대 거주 경매 낙찰 퇴거기준은?';

  it('⭐ 키워드 + 범용어뿐인 문구는 복제로 본다', () => {
    expect(isCtaTextEchoOfTitle('🔗 LH신혼부부전세임대 공식 사이트', KEYWORD)).toBe(true);
    expect(isCtaTextEchoOfTitle('🔗 LH신혼부부전세임대 바로가기', KEYWORD)).toBe(true);
    expect(isCtaTextEchoOfTitle('LH신혼부부전세임대에 대해 더 알아보세요!', KEYWORD)).toBe(true);
  });

  it('본문에서 뽑은 구체 문구는 통과한다', () => {
    expect(isCtaTextEchoOfTitle('LH 청약센터에서 계약 잔여기간 조회', KEYWORD)).toBe(false);
    expect(isCtaTextEchoOfTitle('낙찰 후 인도명령 시점부터 확인하세요', KEYWORD)).toBe(false);
  });

  it('키워드를 아예 안 쓴 문구는 검사 대상이 아니다', () => {
    expect(isCtaTextEchoOfTitle('법원경매정보에서 사건번호 조회', KEYWORD)).toBe(false);
    expect(isCtaTextEchoOfTitle('', KEYWORD)).toBe(false);
  });
});

describe('③ 라우터 후킹 문구 — 본문 근거만, 없으면 빈 값', () => {
  it('⭐ hookMessage 를 받아 넘긴다', async () => {
    callGeminiWithRetry.mockResolvedValue(
      '{"site":"LH 청약플러스","action":"계약 조회","buttonLabel":"LH 청약플러스에서 계약 조회",' +
        '"hookMessage":"계약 잔여기간부터 확인해야 퇴거 시점을 계산할 수 있습니다","confidence":0.9}',
    );
    const r = await resolveSmartCtaTarget({ keyword: 'LH 전세임대 경매', articleHint: '낙찰 후 인도명령' });
    expect(r?.hookMessage).toBe('계약 잔여기간부터 확인해야 퇴거 시점을 계산할 수 있습니다');
  });

  it('후킹 문구에 URL 이 섞이면 목적지 전체를 기각한다 — 날조 방어선', async () => {
    callGeminiWithRetry.mockResolvedValue(
      '{"site":"복지로","action":"신청","buttonLabel":"복지로에서 신청","hookMessage":"www.bokjiro.go.kr 에서 신청","confidence":0.9}',
    );
    expect(await resolveSmartCtaTarget({ keyword: '기초연금 신청' })).toBeNull();
  });

  it('본문 근거 문장을 못 만들면 빈 값으로 둔다 (지어내지 않는다)', async () => {
    callGeminiWithRetry.mockResolvedValue('{"site":"홈택스","action":"조회","buttonLabel":"홈택스에서 조회","confidence":0.8}');
    const r = await resolveSmartCtaTarget({ keyword: '취득세 조회' });
    expect(r?.hookMessage).toBe('');
  });

  it('본문 요약을 프롬프트에 실제로 싣는다', async () => {
    callGeminiWithRetry.mockResolvedValue('{"site":"홈택스","action":"조회","buttonLabel":"홈택스에서 조회","confidence":0.8}');
    await resolveSmartCtaTarget({ keyword: '취득세', articleHint: '미등기 상속토지 2차 상속' });
    expect(String(callGeminiWithRetry.mock.calls[0]?.[0])).toContain('미등기 상속토지 2차 상속');
  });
});

describe('④ 배선과 비용 — 본문은 늘 싣고, 라우터는 필요할 때만 부른다', () => {
  it('⭐ 1단계 프롬프트에 본문 발췌와 목차가 들어간다', () => {
    expect(genSrc).toContain('📑 이 글의 목차');
    expect(genSrc).toContain('📖 이 글이 실제로 다룬 내용(발췌)');
    expect(genSrc).toContain('문구는 제목이 아니라 본문에서 뽑는다');
  });

  it('라우터는 지연 호출 — 문구가 제목 복제이거나 1단계가 실패했을 때만', () => {
    expect(genSrc).toContain('const ensureSmartTarget = async ()');
    expect(genSrc).toContain('if (smartTargetResolved) return smartTarget;');
    // 문구가 쓸 만하면 라우터를 부르지 않는다
    expect(genSrc).toContain('const needFallbackText = !doc.isDoc && (!aiButtonUsable || !aiHookUsable);');
  });

  it('그라운딩은 켜지 않는다 — 자동 구간 유료 검색 금지 규칙 유지', () => {
    const ctaBlock = genSrc.slice(genSrc.indexOf('export async function generateCTAsFinal'));
    expect(ctaBlock).not.toMatch(/googleSearchRetrieval|google_search|tools\s*:\s*\[/);
  });

  it('CTA 단계가 화면에 말한다 — 조용한 미배선과 구분되게', () => {
    expect(genSrc).toContain('onLog?: (message: string) => void');
    expect(genSrc).toContain('🧭 CTA 목적지 판정');
    expect(genSrc).toContain('💰 CTA 문구:');
    expect(read('src/core/final/orchestration.ts')).toContain(
      'generateCTAsFinal(keyword, crawledPosts, sections, contentMode, officialSources, onLog)',
    );
  });
});
