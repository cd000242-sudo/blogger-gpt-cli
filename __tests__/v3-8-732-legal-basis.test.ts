/**
 * v3.8.732 — 근거 조항을 실제로 받아다 장부에 넣는다 (법제처 무료 API, LLM 호출 0회)
 *
 * 장부 실측(2026-09-15): 발행 147편 중 **36편**이 `no-legal-basis` 로 -10 점.
 * 제도를 설명하면서 「○○법 제○조」가 한 건도 없다는 뜻인데, 글쓰기로는 못 고친다 —
 * 조문을 모르면 안 쓰는 게 맞고, 그래서 pre-publish-fix 도 이 결함을 AI 에게 안 맡긴다.
 * 재료가 없는 것이 원인이므로 재료를 구해다 준다.
 *
 * ## 실측으로 버린 설계 (라이브 확인 2026-09-15)
 * 키워드 주제어로도 법령을 찾게 했더니 5건 중 2건이 오답이었다:
 *   · "2026 독감 무료접종 임신부" → 「코로나바이러스감염증-19 예방접종 피해보상 특별법」
 *   · "인천·부천 든든전세 4차 모집" → 「국립대학법인 **인천대학교** 설립ㆍ운영에 관한 법률」
 * 두 번째는 "인천" 이 키워드에 있어서 고유명사 검사도 통과했다. 그래서 **자료가 부른 이름만** 쓴다.
 * 그 설계로 다시 재니 자료가 법령을 부른 4건 전부 정확했고(양육비·감염병·공공주택·노인일자리),
 * 자료가 안 부른 3건은 아무것도 하지 않았다.
 *
 * 이 파일은 **네트워크를 타지 않는다** — fetchJson 을 주입해 응답 모양만 고정한다.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  fetchLegalBasis, buildLegalBasisBlock, extractStatuteNames, trimStatuteLead, isSameStatute,
  parseSearchResponse, parseArticleResponse, pickArticles, topicTerms, formatArticle, statuteUrl,
} from '../src/core/final/legal-basis';
import { blockBetween } from './helpers/source-block';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

/** 법제처 DRF 가 주는 모양 (실측 응답에서 필요한 필드만) */
const SEARCH = (rows: Array<[string, string, string, string]>) => ({
  LawSearch: { law: rows.map(([법령명한글, 법령일련번호, 소관부처명, 법령구분명]) => ({ 법령명한글, 법령일련번호, 소관부처명, 법령구분명 })) },
});
const ARTICLES = (rows: Array<[string, string, string]>) => ({
  법령: { 조문: { 조문단위: rows.map(([조문번호, 조문제목, 조문내용]) => ({ 조문여부: '조문', 조문번호, 조문제목, 조문내용 })) } },
});

const 감염병법 = SEARCH([['감염병의 예방 및 관리에 관한 법률', '285000', '보건복지부,질병관리청', '법률']]);
const 감염병조문 = ARTICLES([
  ['24', '필수예방접종', '제24조(필수예방접종) 특별자치시장·특별자치도지사 또는 시장·군수·구청장은 인플루엔자에 대하여 관할 보건소를 통하여 필수예방접종을 실시하여야 한다.'],
  ['1', '목적', '제1조(목적) 이 법은 국민 건강에 위해가 되는 감염병의 발생과 유행을 방지하고'],
]);

describe('① 자료가 부른 법령 이름만 뽑는다', () => {
  test('⭐ 앞 문장의 주어를 삼키지 않는다 (실측: "질병관리청은 …" 이 통째로 잡혔다)', () => {
    expect(extractStatuteNames('질병관리청은 감염병의 예방 및 관리에 관한 법률에 따라 정한다'))
      .toEqual(['감염병의 예방 및 관리에 관한 법률']);
    expect(extractStatuteNames('여성가족부는 양육비 이행확보 및 지원에 관한 법률에 따라 선지급 대상을 정한다'))
      .toEqual(['양육비 이행확보 및 지원에 관한 법률']);
    // 이름 안의 「의」·「에」 는 떼지 않는다 — 실제 법령명에 쓰인다
    expect(trimStatuteLead('질병관리청은 감염병의 예방 및 관리에 관한 법률')).toBe('감염병의 예방 및 관리에 관한 법률');
    expect(trimStatuteLead('감염병의 예방 및 관리에 관한 법률')).toBe('감염병의 예방 및 관리에 관한 법률');
  });

  test('⭐ 「」 인용도, 맨몸 이름도 잡는다. 법이 아닌 꼬리는 버린다', () => {
    expect(extractStatuteNames('LH 는 「공공주택 특별법」 제48조에 근거해 모집한다')).toContain('공공주택 특별법');
    expect(extractStatuteNames('확인하는 방법을 정리했습니다')).toEqual([]);
    expect(extractStatuteNames('불법 주정차 단속 기준')).toEqual([]);
    expect(extractStatuteNames('신청 방법과 준비물')).toEqual([]);
  });

  test('주제어에서 연도·서수·상투어를 뺀다 (조문 고를 때 쓴다)', () => {
    const terms = topicTerms('2026 독감 무료접종 임신부 신청 방법');
    expect(terms).not.toContain('2026');
    expect(terms).not.toContain('신청');
    expect(terms).toContain('독감');
  });
});

describe('② 같은 법인지 확인한다 — 이것이 오답을 막는 장치다', () => {
  test('⭐ 이름이 서로를 품을 때만 같은 법이다', () => {
    expect(isSameStatute('공공주택 특별법', '공공주택 특별법')).toBe(true);
    expect(isSameStatute('공공주택 특별법', '공공주택 특별법 시행령')).toBe(true);   // 시행령은 본법 이름을 품는다
    expect(isSameStatute('감염병의 예방 및 관리에 관한 법률', '코로나바이러스감염증-19 예방접종 피해보상 등에 관한 특별법')).toBe(false);
    // 실측 오답: 지명 한 조각으로 조직법이 걸렸다
    expect(isSameStatute('인천', '국립대학법인 인천대학교 설립ㆍ운영에 관한 법률')).toBe(false);
  });
});

describe('③ 법제처 응답을 읽는다', () => {
  test('검색 결과와 조문을 파싱하고, 겹쳐 오는 머리말을 한 번만 남긴다', () => {
    expect(parseSearchResponse(감염병법)[0]).toEqual({
      name: '감염병의 예방 및 관리에 관한 법률', mst: '285000', department: '보건복지부,질병관리청', kind: '법률',
    });
    const arts = parseArticleResponse(감염병조문);
    expect(arts[0]!.no).toBe('24');
    expect(arts[0]!.title).toBe('필수예방접종');
    expect(arts[0]!.text.startsWith('제24조')).toBe(false);   // "제24조(필수예방접종)" 이 본문에 또 붙지 않는다
    expect(arts[0]!.text).toContain('인플루엔자');
    // 형식이 달라도 터지지 않는다
    expect(parseSearchResponse({})).toEqual([]);
    expect(parseArticleResponse(null)).toEqual([]);
  });

  test('주제어가 든 조문을 앞세우고, 하나도 없으면 첫 조문만', () => {
    const arts = parseArticleResponse(감염병조문);
    expect(pickArticles(arts, ['인플루엔자'], 3)[0]!.no).toBe('24');
    expect(pickArticles(arts, ['전혀없는말'], 3)).toHaveLength(1);
  });
});

describe('④ 받아오기 — 자료가 부른 법만, 이름이 맞을 때만', () => {
  const run = (evidence: string, responses: Record<string, any>) => {
    const calls: string[] = [];
    const fetchJson = async (url: string) => {
      calls.push(url);
      const hit = Object.keys(responses).find((k) => url.includes(encodeURIComponent(k)) || url.includes(k));
      if (!hit) throw new Error('no stub for ' + url);
      return responses[hit];
    };
    return { calls, run: () => fetchLegalBasis('2026 독감 무료접종 임신부', evidence, { fetchJson }) };
  };

  test('⭐ 자료가 법령을 부르면 확인해서 조문을 가져온다', async () => {
    const { run: go, calls } = run('질병관리청은 감염병의 예방 및 관리에 관한 법률에 따라 임신부를 대상으로 한다', {
      lawSearch: 감염병법, lawService: 감염병조문,
    });
    const basis = await go();
    expect(basis).toBeTruthy();
    expect(basis!.name).toBe('감염병의 예방 및 관리에 관한 법률');
    expect(basis!.department).toBe('보건복지부,질병관리청');
    expect(basis!.url).toBe(statuteUrl('감염병의 예방 및 관리에 관한 법률'));
    expect(basis!.articles.length).toBeGreaterThan(0);
    expect(calls).toHaveLength(2);   // 검색 1 + 조문 1. LLM 호출 0
  });

  test('⭐ 자료가 법령을 안 불렀으면 아무것도 하지 않는다 — 키워드로 추측 금지', async () => {
    let called = 0;
    const basis = await fetchLegalBasis('인천·부천 든든전세 4차 모집', '전세사기 걱정을 줄이는 방법을 정리했습니다', {
      fetchJson: async () => { called += 1; return {}; },
    });
    expect(basis).toBeNull();
    expect(called).toBe(0);   // 검색조차 하지 않는다
  });

  test('⭐ 검색이 다른 법을 주면 버린다 (실측 오답 모양)', async () => {
    const basis = await fetchLegalBasis('2026 독감 무료접종', '보건소는 감염병의 예방 및 관리에 관한 법률에 따라 접종한다', {
      fetchJson: async (url: string) => (url.includes('lawSearch')
        ? SEARCH([['코로나바이러스감염증-19 예방접종 피해보상 등에 관한 특별법', '1', '질병관리청', '법률']])
        : 감염병조문),
    });
    expect(basis).toBeNull();
  });

  test('네트워크가 죽어도 null — 생성을 막지 않는다', async () => {
    const basis = await fetchLegalBasis('독감 접종', '감염병의 예방 및 관리에 관한 법률에 따라', {
      fetchJson: async () => { throw new Error('ETIMEDOUT'); },
    });
    expect(basis).toBeNull();
  });
});

describe('⑤ 장부에 넣는 블록 — 받아온 글자만', () => {
  test('⭐ 법령명·소관부처·원문 주소·조문을 싣고, 없는 조문을 쓰지 말라고 못 박는다', () => {
    const block = buildLegalBasisBlock({
      name: '감염병의 예방 및 관리에 관한 법률', department: '질병관리청', kind: '법률',
      url: statuteUrl('감염병의 예방 및 관리에 관한 법률'),
      articles: parseArticleResponse(감염병조문).slice(0, 1),
    });
    expect(block).toContain('[근거 법령 — 법제처 국가법령정보센터에서 확인한 원문]');
    expect(block).toContain('「감염병의 예방 및 관리에 관한 법률」');
    expect(block).toContain('질병관리청');
    expect(block).toContain('제24조(필수예방접종)');
    expect(block).toContain('위에 없는 조문 번호·항·호를 쓰지 않습니다');
    expect(block).toContain('맞는 자리가 없으면 법령명만 부르고 조문은 생략합니다');
    expect(buildLegalBasisBlock(null)).toBe('');
    expect(formatArticle({ no: '3', title: '', text: '' })).toBe('제3조');
  });
});

describe('⑥ 배선 — 근거를 모은 뒤에 부르고, 프롬프트에 싣는다', () => {
  const orch = read('src/core/final/orchestration.ts');

  test('⭐ groundingReference 를 재료로 부르고, 쇼핑 글은 건너뛴다', () => {
    const block = blockBetween(orch, '⚖️ v3.8.732 — 근거 조항을 실제로 받아다', 'v3.8.474 — 장부가 소스를 이미 품었는지');
    expect(block).toContain("if (contentMode !== 'shopping') {");
    expect(block).toContain("require('./legal-basis')");
    expect(block).toContain('fetchLegalBasis(keyword, `${groundingReference}');
    expect(block).toContain('근거 법령 확인');
    // 실패해도 발행은 간다
    expect(block).toContain("console.warn('[LEGAL] 건너뜀:'");
  });

  test('⭐ 프롬프트에 실린다 — 블록만 만들고 안 싣는 조용한 미배선 방지', () => {
    expect(orch).toContain('...(legalBasisBlock ? [legalBasisBlock] : []),');
    const assembly = blockBetween(orch, 'factEnrichedContents = [', 'if (ledgerCoversSources) {');
    expect(assembly).toContain('legalBasisBlock');
  });
});
