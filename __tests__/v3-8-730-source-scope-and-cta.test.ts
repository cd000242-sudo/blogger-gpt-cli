/**
 * v3.8.730 — 공고형 글의 출처 범위(주관기관 고정) + 기관이 다른 CTA 차단
 *
 * 사장님 실측(leadernam 「인천·부천 든든전세 4차 모집」, 2026-09-14):
 *   · LH 공고를 써야 하는데 본문에 LH 0번 — HUG 안심전세포털·매물 시세·거주 후기로 채워졌다
 *   · CTA: 훅 "보건복지부에 원문 안내" · 버튼 "인터넷등기소에서 신청하기" · 주소 mohw.go.kr 2020년 PDF
 *   · 요청사항에는 "LH 공고 기준"이라 적었지만(URL 없음) 수집 단계는 그 글을 보지 않았다
 *
 * 사장님이 받은 진단: "크롤링 20% + 소스 선별/팩트체크 로직 80%" — 맞았다.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  deriveSourceScope, sourceMatchesScope, selectScopedSources, hasOfficialSource, buildSourceScopeDirective, isScopedOfficialSource,
} from '../src/core/final/source-scope';
import { fetchGrounding as fetchGroundingReal } from '../src/core/final/naver-grounding';
import { ctaSiteNames, siteNameFromUrl } from '../src/cta/cta-copy';
import { blockBetween } from './helpers/source-block';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const KEYWORD = '인천·부천 든든전세 4차 모집, 전세사기 걱정되면 볼 만할까';

describe('① 출처 범위 — 주관기관은 키워드·요청사항·직접 넣은 URL 로만 정한다', () => {
  test('⭐ 요청사항에 "LH 공고 기준"이라 적으면 LH 로 고정된다 (URL 없이 — 사장님 입력 방식)', () => {
    const scope = deriveSourceScope(KEYWORD, [], 'LH 인천 든든전세 4차 공고 기준으로 써 주세요. 자격·일정·공급호수를 넣어 주세요.');
    expect(scope).toBeTruthy();
    expect(scope!.agency).toBe('LH');
    expect(scope!.domain).toBe('lh.or.kr');
    expect(scope!.round).toBe('4');
    expect(scope!.regions).toEqual(['인천', '부천']);
    expect(scope!.topic).toBe(KEYWORD);              // 요청사항 전문은 이름표에 넣지 않는다
  });

  test('⭐ 아무 단서가 없으면 범위를 정하지 않는다 — 검색 순위로는 절대 정하지 않는다', () => {
    expect(deriveSourceScope(KEYWORD)).toBeUndefined();
    expect(deriveSourceScope(KEYWORD, [{ url: 'https://www.khug.or.kr/x', title: 'HUG 든든전세' }, { url: 'https://apply.lh.or.kr/y', title: 'LH' }])).toBeUndefined();
  });

  test('직접 넣은 공고 URL 이 기관 도메인이면 그 기관이다', () => {
    const scope = deriveSourceScope(KEYWORD, [{ url: 'https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?id=1', title: '인천·부천 든든전세주택 4차 입주자 모집공고' }]);
    expect(scope?.agency).toBe('LH');
    expect(scope?.topic).toContain('입주자 모집공고');
  });

  test('두 제도를 견주는 글·두 기관이 다 적힌 요청은 좁히지 않는다', () => {
    expect(deriveSourceScope('LH 든든전세 vs HUG 든든전세 비교', [], '')).toBeUndefined();
    expect(deriveSourceScope(KEYWORD, [], 'LH 와 HUG 둘 다 설명해')).toBeUndefined();
    // 주택·공고 낱말이 없으면 기관 이름이 있어도 범위를 만들지 않는다
    expect(deriveSourceScope('LH 채용 면접 후기', [], '')).toBeUndefined();
  });

  test('⭐ 범위 밖 자료를 가른다 — 다른 기관·다른 회차·다른 지역·같은 기관의 딴 사업', () => {
    const scope = deriveSourceScope(KEYWORD, [], 'LH 공고 기준')!;
    const hug = { url: 'https://www.khug.or.kr/dndn/', title: 'HUG 든든전세주택 안내', content: '주택도시보증공사가 매입한 주택을 임대합니다' };
    const listing = { url: 'https://new.land.naver.com/x', title: '부천 심곡본동 이테크 에비뉴스타 전세', content: '14평 전세 1억 770만 원 거래' };
    const news = { url: 'https://news.example.com/a', title: '인천·부천 든든전세 4차 모집', content: 'LH 인천지역본부가 든든전세주택 4차 입주자 모집공고를 냈다' };
    const third = { url: 'https://apply.lh.or.kr/z', title: '인천 든든전세주택 3차 입주자 모집공고', content: '든든전세 3차' };
    const seoul = { url: 'https://apply.lh.or.kr/w', title: '서울 든든전세주택 4차 입주자 모집공고', content: '든든전세' };
    const otherProgram = { url: 'https://apply.lh.or.kr/v', title: '인천 청년 매입임대 4차 모집', content: '청년 매입임대주택' };
    const mixed = { url: 'https://blog.example.com/b', title: '든든전세 총정리', content: 'LH 든든전세와 HUG 든든전세는 다르다' };
    expect(sourceMatchesScope(hug, scope)).toBe(false);
    expect(sourceMatchesScope(listing, scope)).toBe(false);
    expect(sourceMatchesScope(news, scope)).toBe(true);
    expect(sourceMatchesScope(third, scope)).toBe(false);
    expect(sourceMatchesScope(seoul, scope)).toBe(false);
    expect(sourceMatchesScope(otherProgram, scope)).toBe(false);
    expect(sourceMatchesScope(mixed, scope)).toBe(false);
    expect(sourceMatchesScope(hug, undefined)).toBe(true);   // 범위가 없으면 예전 그대로

    const picked = selectScopedSources([news, hug, third, { url: 'https://apply.lh.or.kr/4', title: '인천·부천 든든전세주택 4차 입주자 모집공고', content: '든든전세' }], scope);
    expect(picked.map((p) => p.url)).toEqual(['https://apply.lh.or.kr/4', 'https://news.example.com/a']);
    expect(hasOfficialSource(picked, scope)).toBe(true);
    expect(hasOfficialSource([news], scope)).toBe(false);
    expect(isScopedOfficialSource('https://www.lh.or.kr/a', scope)).toBe(true);
  });

  test('지시문은 출처 계층과 "확인 안 된 수치는 쓰지 않는다"를 말한다', () => {
    const d = buildSourceScopeDirective(deriveSourceScope(KEYWORD, [], 'LH 공고 기준'));
    expect(d).toContain('주관기관: LH');
    expect(d).toContain('회차: 4');
    expect(d).toContain('입력 공식 공고 → 동일 기관 공식 설명 → 동일 공고 언론 보도');
    expect(d).toContain('다른 기관 자료로 보충하지 않는다');
    expect(buildSourceScopeDirective(undefined)).toBe('');
  });
});

describe('② 근거 검색 — 범위가 있으면 기관 이름으로 한 번 더 찾고, 범위 밖은 싣지 않는다', () => {
  test('⭐ LH 페이지·LH 를 말하는 뉴스만 남고 HUG 뉴스·블로그는 빠진다', async () => {
    const queries: string[] = [];
    const naverSearch = async (kind: string, params: any) => {
      queries.push(`${kind}:${params.query}`);
      if (kind === 'webkr' && /^LH /.test(params.query)) {
        return { ok: true, items: [{ title: '인천·부천 든든전세주택 4차 입주자 모집공고', link: 'https://apply.lh.or.kr/4', description: '든든전세 4차 접수 9월 20일' }] };
      }
      if (kind === 'webkr') return { ok: true, items: [{ title: 'HUG 든든전세주택', link: 'https://www.khug.or.kr/dndn', description: '주택도시보증공사 든든전세' }] };
      if (kind === 'news') {
        return { ok: true, items: [
          { title: 'LH 인천본부, 든든전세 4차 모집', originallink: 'https://news.example.com/lh', link: 'x', description: 'LH 인천지역본부가 든든전세주택 4차 모집공고' },
          { title: 'HUG 든든전세 인기', originallink: 'https://news.example.com/hug', link: 'y', description: '주택도시보증공사 든든전세 경쟁률' },
        ] };
      }
      return { ok: true, items: [{ title: '든든전세 후기 블로그', link: 'https://blog.naver.com/a', description: '후기' }] };
    };
    const scope = deriveSourceScope(KEYWORD, [], 'LH 공고 기준')!;
    const g = await fetchGroundingReal(KEYWORD, naverSearch as any, { fetchBody: async () => null, sourceScope: scope });
    expect(queries).toContain(`webkr:LH ${KEYWORD}`);
    expect(queries.some((q) => q.includes('site:'))).toBe(false);
    expect(g.text).toContain('apply.lh.or.kr/4');
    expect(g.text).toContain('news.example.com/lh');
    expect(g.text).not.toContain('khug.or.kr');
    expect(g.text).not.toContain('news.example.com/hug');
    expect(g.text).toContain('[공고 출처 범위');
    expect(g.officialCount).toBe(1);
    expect(g.newsCount).toBe(1);
    expect(g.skippedBlogs).toBe(1);
  });

  test('범위가 없으면 기관 검색을 더 하지 않는다 (비용·동작 그대로)', async () => {
    const queries: string[] = [];
    const naverSearch = async (kind: string, params: any) => { queries.push(`${kind}:${params.query}`); return { ok: true, items: [] }; };
    await fetchGroundingReal('김치찌개 끓이는 법', naverSearch as any, { fetchBody: async () => null });
    expect(queries.some((q) => /^webkr:(LH|HUG|SH|GH|iH) /.test(q))).toBe(false);
    expect(queries.some((q) => q.includes('site:'))).toBe(false);
  });
});

describe('③ 배선 — 수집·근거·팩트체크·CTA 가 같은 범위를 쓴다', () => {
  const orchestration = read('src/core/final/orchestration.ts');
  const generation = read('src/core/final/generation.ts');

  test('⭐ 요청사항이 범위 판정에 들어가고, 공식 페이지가 없으면 크게 알린다', () => {
    const block = blockBetween(orchestration, 'const sourceScope = deriveSourceScope(keyword, [', 'const titles = crawledPosts.map');
    expect(block).toContain("String((payload as any)?.userRequest || ''))");
    expect(block).toContain('crawledPosts = selectScopedSources(crawledPosts, sourceScope)');
    expect(block).toContain('if (!hasOfficialSource(crawledPosts, sourceScope))');
    expect(block).toContain('원본 URL 칸에 공고 주소를 넣어 주세요');
  });

  test('⭐ 근거 검색·제목 약속·리포트 출처·공공 근거·유료 요약 전부 범위를 받는다', () => {
    // v3.8.734: 메인 키워드 관련도 판정용으로 mainKeyword 를 함께 넘긴다 — 범위(sourceScope)는 그대로 받는다
    expect(orchestration).toContain('fetchGrounding(keyword, naverSearch as any, { mainKeyword: keyword, ...(sourceScope ? { sourceScope } : {}) })');
    expect(orchestration).toContain('display: 5, ...(sourceScope ? { sourceScope } : {}) })');
    expect(orchestration).toContain("fetchPageBody(u, 2600), { ...(sourceScope ? { sourceScope } : {}) })");
    expect(orchestration).toContain('buildOfficialSourcesFromWeb(crawledPosts as any, 4, sourceScope)');
    expect(orchestration).toContain('!factResult.sourceUrls.some((url) => isScopedOfficialSource(url, sourceScope))');
    expect(orchestration).toContain('const shouldPayForFacts = userChosePaid || (freeEvidenceThin && !sourceScope)');
    expect(orchestration).toContain('...(sourceScope ? [buildSourceScopeDirective(sourceScope)] : [])');
  });

  test('⭐ 기관이 다른 CTA 주소는 약한 후보로도 남기지 않는다', () => {
    const block = blockBetween(generation, "if (gate && !gate.ok) {", "if (isValid && (!gate || gate.ok)) {");
    expect(block).toContain("if (gate.severity === 'demote' && offAgencyHost) {");
    expect(block).toContain('기관 불일치 주소는 약한 후보로도 쓰지 않는다');
    expect(block.indexOf('offAgencyHost)')).toBeLessThan(block.indexOf('weakCta = {'));
  });

  test('⭐ 버튼이 다른 기관을 말하면 주소 기준으로 버튼·훅을 다시 짓는다', () => {
    const fn = blockBetween(orchestration, 'function toRenderableCtaCandidate(', 'function escapeHtmlText');
    expect(fn).toContain("const siteOfUrl = siteNameFromUrl(cta.url || '')");
    expect(fn).toContain('ctaSiteNames().find((name) => name !== siteOfUrl && buttonText.includes(name)');
    expect(fn).toContain('buttonText = repaired.buttonText');
    // 이름 사전이 실재한다 — 사고의 두 이름이 모두 있어야 어긋남을 잡는다
    const names = ctaSiteNames();
    expect(names).toContain('인터넷등기소');
    expect(siteNameFromUrl('https://www.iros.go.kr/')).toBe('인터넷등기소');
    expect(names.every((n) => n.length >= 3)).toBe(true);
  });
});
