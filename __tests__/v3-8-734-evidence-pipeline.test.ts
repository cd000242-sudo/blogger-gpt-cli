/**
 * v3.8.734 — 근거 파이프라인 재설계
 *
 * 감사 실측(2026-09-22, "청년미래적금 2차 신청"):
 *   · 제목 약속 검색어가 "2026년", "가구원 막히면 어떻게" 로 나가 탁구·금 제련·부동산 기사가 근거 맨 앞 4,065자(39%)
 *   · 근거 190줄 중 59줄이 광고·공유 버튼 · 날짜 0/19 · URL 0
 *   · 한국 06:38 인데 프롬프트의 오늘이 하루 전(UTC) · 절마다 "(최소 700~1000자)" × 9
 *   · terra 90초 초과 → luna 하향이 console 에만 찍힘
 *
 * 이 테스트는 "개선 완료라고 말하면 안 되는 조건"을 하나씩 잠근다. 특정 키워드 예외는 없다 — 여러 유형의 키워드로 같은 규칙을 본다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildPromiseSearchQuery, promiseTargets, queryHasCore, fetchPromiseGrounding } from '../src/core/final/promise-grounding';
import { judgeEvidence, scoreMainRelevance, scorePromiseRelevance, coreEntityOf, assembleEvidence, renderEvidence, evidenceHeader } from '../src/core/final/evidence';
import { fetchGrounding } from '../src/core/final/naver-grounding';
import { cleanEvidenceText, shellLineRatio } from '../src/core/crawlers/evidence-clean';
import { kstToday, toKstDate, kstShift } from '../src/core/final/kst-date';
import { buildResearchPacket, buildCodePacket, groundClaims, validatePacketShape, renderPacket } from '../src/core/final/research-packet';
import { evaluateEvidence, topicNeeds, PipelineStatus } from '../src/core/final/evidence-gate';
import { resolveLengthPlan, lengthRuleText, countPacketFacts } from '../src/core/final/length-plan';
import { summarizeNaverCalls } from '../src/core/naver-search-client';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');

const KEYWORDS = [
  '청년미래적금 2차 신청', '주택담보대출 금리 7% 돌파', '전기차 보조금 하반기 추가 공고',
  '부산국제영화제 개막작 예매', '경주 APEC 기간 숙소 예약', '추석 고속도로 주유소 100원 할인',
];

// ══════════════════════════════════════════════════════════
describe('① 약속 검색어 — 메인 키워드 핵심어 없이 나가지 않는다', () => {
  it('⭐⭐ 실측 사고 그대로: "2026년" 단독·"가구원 막히면 어떻게" 가 다시 나오지 않는다', () => {
    const kw = '청년미래적금 2차 신청';
    expect(buildPromiseSearchQuery('2026년 청년미래적금 2차 신청', kw)).toBe('청년미래적금 2차 2026년');
    const q = buildPromiseSearchQuery('가구원 동의가 막히면 어떻게 하나', kw);
    expect(q.startsWith('청년미래적금')).toBe(true);
    expect(q).toContain('가구원');
    expect(q).toContain('동의');
    expect(q).not.toMatch(/막히면|어떻게|하나$/);
  });

  it('⭐ 혼자서는 검색어가 못 되는 말은 핵심어와 함께만 나간다 (모든 유형의 키워드)', () => {
    const loners = ['2026년', '중복 가능한가요', '언제 어떻게', '소득 기준', '신청 조건', '금액 차이', '왜 대상에서 빠지나'];
    for (const kw of KEYWORDS) {
      for (const chunk of loners) {
        const q = buildPromiseSearchQuery(chunk, kw);
        if (!q) continue;                      // 확인 대상이 없으면 아예 검색하지 않는다 — 그것도 통과다
        expect(`${kw} | ${q} | ${queryHasCore(q, kw)}`).toBe(`${kw} | ${q} | true`);
      }
    }
  });

  it('명사 꼬리를 조사로 잘못 떼지 않는다 ("고속도로" → "고속도" 금지)', () => {
    expect(coreEntityOf('추석 고속도로 주유소 100원 할인', 2)).toContain('고속도로');
    expect(promiseTargets('수도 요금이 오르면', '전기 요금 감면')).toContain('수도');
  });

  it('확인 대상이 하나도 없으면 빈 문자열 — 메인 검색을 되풀이하지 않는다', () => {
    expect(buildPromiseSearchQuery('어떻게 하나요', '청년미래적금 2차 신청')).toBe('');
  });

  it('⭐ fetchPromiseGrounding 이 메인 키워드와 약속 조각을 관련도 판정용으로 넘긴다', async () => {
    const seen: Array<{ query: string; options: any }> = [];
    await fetchPromiseGrounding(
      '2026년 청년미래적금 2차 신청, 가구원 동의가 막히면 어떻게 하나', '청년미래적금 2차 신청',
      (async () => ({ ok: true, items: [] })) as any,
      async (query, _s, options) => { seen.push({ query, options }); return { text: '', newsCount: 0, webCount: 0, officialCount: 0, blogCount: 0, skippedBlogs: 0 }; },
    );
    expect(seen.length).toBeGreaterThan(0);
    for (const s of seen) {
      expect(queryHasCore(s.query, '청년미래적금 2차 신청')).toBe(true);
      expect(s.options.mainKeyword).toBe('청년미래적금 2차 신청');
      expect(typeof s.options.promise).toBe('string');
    }
  });
});

// ══════════════════════════════════════════════════════════
describe('② 이중 관련도 — 검색어에 걸렸다고 근거가 되지 않는다', () => {
  const kw = '청년미래적금 2차 신청';
  const tabletennis = { title: "충격 진단, 中 탁구 대회 시작 하루 만에 '긴급 경보'", text: '2026년 세계선수권에서 왕만위가 패했다. 중국 탁구 대표팀에게는 대형 악재다.' };
  const onTopic = { title: "'청년미래적금' 2차 출시… 신청 일정·방법은?", text: '금융위원회는 10월 7~16일 청년미래적금 2차 가입 신청을 받는다. 청년미래적금은 3년 만기 상품이다.' };

  it('⭐⭐ "2026년" 하나로 걸려 든 기사는 메인 키워드 관련도 0 으로 버려진다', () => {
    expect(scoreMainRelevance(tabletennis, kw)).toBe(0);
    const verdict = judgeEvidence({ ...tabletennis, url: 'https://sports.example.com/1', tag: '뉴스', query: '청년미래적금 2차 2026년' }, kw);
    expect(verdict.item).toBeUndefined();
    expect(verdict.rejected?.reason).toContain('메인 키워드 관련도');
  });

  it('주제 글은 통과하고 출처·날짜·검색어·관련도를 들고 다닌다', () => {
    const verdict = judgeEvidence({ ...onTopic, url: 'https://www.yna.co.kr/view/1', tag: '뉴스', query: kw, pubDate: 'Fri, 18 Sep 2026 09:00:00 +0900', hasBody: true }, kw);
    expect(verdict.item).toBeDefined();
    expect(verdict.item!.pubDate).toBe('2026-09-18');
    expect(verdict.item!.domain).toBe('yna.co.kr');
    expect(verdict.item!.query).toBe(kw);
    expect(verdict.item!.relevanceScore).toBeGreaterThanOrEqual(0.5);
    expect(verdict.item!.sourceType).toBe('news');
  });

  it('이름만 스치는 긴 글은 깎인다 — 다른 얘기 하다 한 번 언급한 글', () => {
    const passing = { title: '정책 재테크 다시 뜬다', text: `${'주식과 채권 이야기가 이어진다. '.repeat(40)} 청년미래적금도 있다.` };
    expect(scoreMainRelevance(passing, kw)).toBeLessThan(0.5);
  });

  it('약속 조각 관련도: 조각의 주제어가 하나도 없으면 약속 근거로 안 쓴다', () => {
    const promise = '가구원 동의가 막히면 어떻게 하나';
    expect(scorePromiseRelevance(onTopic, promise, kw)).toBe(0);
    const withPromise = { title: '청년미래적금 가구원 소득 동의 안 하면 탈락', text: '청년미래적금 2차 신청에서 가구원 동의 절차가 필요하다.' };
    expect(scorePromiseRelevance(withPromise, promise, kw)).toBeGreaterThan(0.3);
    const verdict = judgeEvidence({ ...onTopic, url: 'https://a.example/1', tag: '뉴스', query: 'q', promise }, kw);
    expect(verdict.rejected?.reason).toContain('약속 조각 관련도');
  });

  it('⭐ fetchGrounding: 무관한 뉴스는 장부(text·items)에 안 들어가고 rejected 로 남는다', async () => {
    const search = async (type: string) => ({
      ok: true,
      items: type === 'news'
        ? [
          { title: tabletennis.title, description: tabletennis.text, originallink: 'https://sports.example.com/1', pubDate: 'Mon, 21 Sep 2026 10:00:00 +0900' },
          { title: onTopic.title, description: onTopic.text, originallink: 'https://www.yna.co.kr/view/1', pubDate: 'Fri, 18 Sep 2026 09:00:00 +0900' },
        ]
        : [],
    });
    const g = await fetchGrounding('청년미래적금 2차 2026년', search as any, { mainKeyword: kw, fetchBody: async () => null });
    expect(g.text).not.toContain('탁구');
    expect(g.text).toContain('청년미래적금');
    expect(g.items!.length).toBe(1);
    expect(g.rejected!.length).toBe(1);
    expect(g.newsCount).toBe(1);
  });

  it('⭐ 날짜와 URL 이 근거 글자에 그대로 남는다 (Writer 에게 갈 때 떼지 않는다)', async () => {
    const search = async (type: string) => ({ ok: true, items: type === 'news' ? [{ title: onTopic.title, description: onTopic.text, originallink: 'https://www.yna.co.kr/view/1', pubDate: 'Fri, 18 Sep 2026 09:00:00 +0900' }] : [] });
    const g = await fetchGrounding(kw, search as any, { fetchBody: async () => null });
    expect(g.text).toContain('게시일 2026-09-18');
    expect(g.text).toContain('https://www.yna.co.kr/view/1');
    const items = assembleEvidence(g.items!, '2026-09-22');
    const head = evidenceHeader(items[0]!);
    expect(head).toContain('[E01]');
    expect(head).toContain('게시일: 2026-09-18');
    expect(head).toContain('URL: https://www.yna.co.kr/view/1');
  });

  it('날짜를 모르면 null — 오늘로 메우지 않는다', () => {
    const verdict = judgeEvidence({ ...onTopic, url: 'https://www.bokjiro.go.kr/x', tag: '웹', query: kw }, kw);
    expect(verdict.item!.pubDate).toBeNull();
    expect(evidenceHeader({ ...verdict.item!, id: 'E01' })).toContain('게시일: 미상(null)');
    expect(toKstDate('')).toBeNull();
    expect(toKstDate('날짜 아님')).toBeNull();
  });

  it('공식 자료가 앞자리를 받는다 — 뉴스 뒤에서 잘려 나가지 않는다', () => {
    const mk = (n: number, url: string, tag: string) => judgeEvidence({ title: `청년미래적금 2차 신청 안내 ${n}`, text: `청년미래적금 2차 신청 ${'내용 '.repeat(500)}`, url, tag, query: kw, hasBody: true, pubDate: '2026-09-18' }, kw).item!;
    const items = assembleEvidence([mk(1, 'https://n1.example.com/a', '뉴스'), mk(2, 'https://n2.example.com/b', '뉴스'), mk(3, 'https://www.fsc.go.kr/no/1', '웹')], '2026-09-22');
    const rendered = renderEvidence(items, 3500);
    expect(rendered.used[0]!.isOfficial).toBe(true);
    expect(rendered.text.indexOf('fsc.go.kr')).toBeLessThan(rendered.text.indexOf('n1.example.com') < 0 ? Infinity : rendered.text.indexOf('n1.example.com'));
  });

  it('같은 기사(전재·같은 주소)는 한 번만 — 본문 있는 쪽을 남긴다', () => {
    const a = judgeEvidence({ title: onTopic.title, text: onTopic.text, url: 'https://www.yna.co.kr/view/1?x=1', tag: '뉴스', query: kw }, kw).item!;
    const b = judgeEvidence({ title: onTopic.title, text: `${onTopic.text} 본문 전체.`, url: 'https://m.yna.co.kr/view/1', tag: '뉴스', query: kw, hasBody: true }, kw).item!;
    const items = assembleEvidence([a, b], '2026-09-22');
    expect(items.length).toBe(1);
    expect(items[0]!.hasBody).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════
describe('③ CLEAN — 낱말이 아니라 껍데기 줄을 걷는다', () => {
  const raw = [
    'Advertisement', 'Advertisement', '[스포츠조선 이현석 기자]', '페이스북 0', '카카오스토리', '카카오톡', '입력 : 2025.12.20 06:00',
    '금융위원회는 다음 달 7∼16일 청년미래적금 2차 가입 신청을 받는다고 밝혔다.',
    '정부는 광고 규제를 강화하면서도 공유 경제 지원은 이어 가겠다고 설명했다.',
    '100자평 0', '댓글', 'jhkoo@donga.com', '구자홍 기자',
    '1차 최종 가입자는 138만5000명이다.', '사진=연합뉴스',
    '관련기사', '삼성전자 주가 전망', '오늘의 운세', '저작권자 ⓒ 무단전재 및 재배포 금지',
  ].join('\n');

  it('⭐ 광고·공유 버튼·기자 메일·댓글·저작권·관련기사 꼬리를 걷는다', () => {
    const r = cleanEvidenceText(raw);
    for (const gone of ['Advertisement', '카카오톡', '페이스북', '100자평', 'jhkoo@', '무단전재', '삼성전자 주가 전망', '오늘의 운세', '사진=연합뉴스']) {
      expect(r.text).not.toContain(gone);
    }
    expect(shellLineRatio(r.text)).toBe(0);
  });

  it('⭐ 본문 문장은 "광고"·"공유" 낱말이 있어도 살아남는다', () => {
    const r = cleanEvidenceText(raw);
    expect(r.text).toContain('광고 규제를 강화하면서도 공유 경제 지원은');
    expect(r.text).toContain('138만5000명');
    expect(r.text).toContain('7∼16일');
  });

  it('RAW / CLEAN / removed 길이를 돌려준다 (디버그 로그용)', () => {
    const r = cleanEvidenceText(raw);
    expect(r.rawLength).toBe(raw.length);
    expect(r.cleanLength).toBe(r.text.length);
    expect(r.removedLength).toBe(r.rawLength - r.cleanLength);
    expect(r.removedLines).toBeGreaterThanOrEqual(12);
  });

  it('추출기 두 곳이 자르기 **전에** 정제한다 (상한을 껍데기가 먹지 않게)', () => {
    for (const file of ['src/core/crawlers/article-body.ts', 'src/core/crawlers/official-page-body.ts']) {
      const src = read(file);
      const clean = src.indexOf('cleanEvidenceText(');
      expect(clean).toBeGreaterThan(-1);
      expect(src.indexOf('.text.slice(0, Math.max(1, maxChars))', clean)).toBeGreaterThan(clean);
    }
  });
});

// ══════════════════════════════════════════════════════════
describe('④ 날짜 — 서울 기준', () => {
  it('⭐⭐ 한국 00~09시에 UTC 날짜가 나오지 않는다 (실측: 06:38 KST 에 하루 전이 나왔다)', () => {
    const at0638Kst = new Date('2026-09-21T21:38:00Z');
    expect(at0638Kst.toISOString().slice(0, 10)).toBe('2026-09-21');   // 예전 방식 — 틀린 값
    expect(kstToday(at0638Kst)).toBe('2026-09-22');
    expect(kstShift(-1, at0638Kst)).toBe('2026-09-21');
    expect(kstToday(new Date('2026-12-31T15:30:00Z'))).toBe('2027-01-01');
  });

  it('⭐ generation.ts 에 UTC 날짜 조립이 남아 있지 않다', () => {
    const gen = read('src/core/final/generation.ts');
    expect(gen).not.toContain('new Date().toISOString().slice(0, 10)');
    expect((gen.match(/= kstToday\(\)/g) || []).length).toBeGreaterThanOrEqual(5);
  });

  it('검색 API 의 날짜 표기들을 서울 날짜로 읽는다', () => {
    expect(toKstDate('Fri, 18 Sep 2026 23:30:00 +0900')).toBe('2026-09-18');
    expect(toKstDate('20260918')).toBe('2026-09-18');
    expect(toKstDate('2026.9.8')).toBe('2026-09-08');
    expect(toKstDate('2026-09-18T16:00:00Z')).toBe('2026-09-19');
  });
});

// ══════════════════════════════════════════════════════════
describe('⑤ Research Packet — 근거와 맞지 않는 문장은 들어오지 못한다', () => {
  const kw = '청년미래적금 2차 신청';
  const item = (id: string, text: string, official = false) => ({
    id, mainKeyword: kw, title: '청년미래적금 2차', sourceName: 'x', domain: official ? 'fsc.go.kr' : 'news.example.com',
    url: `https://example.com/${id}`, pubDate: '2026-09-18', retrievedAt: '', sourceType: (official ? 'government' : 'news') as any,
    isOfficial: official, query: kw, relevanceScore: 1, promiseRelevanceScore: null, hasBody: true, cleanedText: text,
  });
  const items = [
    item('E01', '금융위원회는 10월 7일부터 16일까지 청년미래적금 2차 가입 신청을 받는다. 월 납입 한도는 50만원이다.', true),
    item('E02', '1차 최종 가입자는 138만5000명이다. 월 납입 한도는 50만원이다.'),
  ];

  it('코드 추출: 수치·날짜를 원문에서 뽑고 출처 id 를 붙인다 (되풀이되는 값이 먼저)', () => {
    const p = buildCodePacket({ mainKeyword: kw, title: 't', items, now: new Date('2026-09-21T21:38:00Z') });
    expect(p.currentAsOf).toBe('2026-09-22');
    expect(p.numbers[0]!.value).toContain('50만원');
    expect(p.numbers[0]!.sourceIds.sort()).toEqual(['E01', 'E02']);
    expect(p.dates.some((d) => /10월 7일/.test(d.value) && d.sourceIds.includes('E01'))).toBe(true);
    expect(p.sourceMap.length).toBe(2);
    expect(p.status).toBe('CODE_ONLY');
  });

  it('⭐⭐ 없는 출처 id · 근거에 없는 수치가 든 문장은 버린다', () => {
    const g = groundClaims([
      { claim: '2차 신청 기간은 10월 7일부터 16일까지다', sourceIds: ['E01'] },
      { claim: '월 납입 한도는 70만원이다', sourceIds: ['E01'] },            // 근거엔 50만원
      { claim: '정부 기여금은 최대 12%다', sourceIds: ['E09'] },              // 없는 id
      { claim: '가입 대상은 청년이다', sourceIds: [] },                        // 출처 없음
    ], items as any);
    expect(g.kept.map((k) => k.claim)).toEqual(['2차 신청 기간은 10월 7일부터 16일까지다']);
    expect(g.dropped).toBe(3);
  });

  it('스키마 검사가 모양 틀린 출력을 잡는다', () => {
    expect(validatePacketShape({ searchIntent: 'x', facts: [], eligibility: [], conditions: [], officialStatements: [], conflictingInformation: [] })).toEqual([]);
    expect(validatePacketShape({ facts: 'no' }).length).toBeGreaterThan(0);
    expect(validatePacketShape([]).length).toBeGreaterThan(0);
  });

  it('⭐ 파싱 실패 → 고치기 1회 → 성공 (JSON 모드를 요청한다)', async () => {
    const calls: Array<{ prompt: string; json: boolean | undefined }> = [];
    const good = JSON.stringify({ searchIntent: '2차 신청 기간과 조건', facts: [{ claim: '10월 7일부터 16일까지 신청을 받는다', sourceIds: ['E01'] }], eligibility: [], conditions: [], officialStatements: [], conflictingInformation: [] });
    const p = await buildResearchPacket({
      mainKeyword: kw, title: 't', items: items as any, evidenceText: 'ev',
      callModel: async (prompt, o) => { calls.push({ prompt, json: o?.json }); return calls.length === 1 ? '죄송하지만 { 깨진' : good; },
    });
    expect(calls.length).toBe(2);
    expect(calls[0]!.json).toBe(true);
    expect(calls[1]!.prompt).toContain('규격에 맞지 않습니다');
    expect(p.status).toBe('OK');
    expect(p.facts.length).toBe(1);
  });

  it('⭐⭐ 끝까지 실패해도 빈 객체로 넘어가지 않는다 — 코드 추출분으로 남고 이유를 적는다', async () => {
    let n = 0;
    const p = await buildResearchPacket({ mainKeyword: kw, title: 't', items: items as any, evidenceText: 'ev', callModel: async () => { n += 1; return 'not json'; } });
    expect(n).toBe(3);                          // 생성 → 고치기 → 다시 생성
    expect(p.status).toBe('CODE_ONLY');
    expect(p.numbers.length).toBeGreaterThan(0);
    expect(p.notes.join(' ')).toContain('LLM 정리 실패');
  });

  it('근거 0건이면 EMPTY — 모델을 부르지 않고, Writer 에게 구체 수치를 쓰지 말라고 말한다', async () => {
    let called = false;
    const p = await buildResearchPacket({ mainKeyword: kw, title: 't', items: [], evidenceText: '', callModel: async () => { called = true; return '{}'; } });
    expect(called).toBe(false);
    expect(p.status).toBe('EMPTY');
    expect(renderPacket(p)).toContain('확인된 근거가 없습니다');
  });

  it('패킷 글자에 출처 id 가 붙어 나간다', async () => {
    const p = buildCodePacket({ mainKeyword: kw, title: 't', items: items as any, readerQuestions: ['2차 언제 하나요'], searchSuggestions: ['청년미래적금 2차 신청기간'] });
    const text = renderPacket(p);
    expect(text).toContain('[RESEARCH PACKET');
    expect(text).toMatch(/50만원 — .*\[E01,E02\]/);
    expect(text).toContain('검색자가 실제로 물은 것');
    expect(text).toContain('실제 자동완성');
  });
});

// ══════════════════════════════════════════════════════════
describe('⑥ Quality Gate · 단계 상태 · 검색 소스 가시화', () => {
  it('제도·행정 주제는 공식 자료를, 회차·일정 주제는 날짜를 요구한다', () => {
    expect(topicNeeds('청년미래적금 2차 신청')).toEqual({ needsOfficial: true, needsDates: true });
    expect(topicNeeds('부산 돼지국밥 맛집').needsOfficial).toBe(false);
  });

  it('⭐ 근거가 모자라면 WEAK 와 사유를 돌려준다 (조용히 통과시키지 않는다)', () => {
    const v = evaluateEvidence([], '청년미래적금 2차 신청');
    expect(v.status).toBe('GROUNDING_WEAK');
    expect(v.reasons.join(' ')).toContain('공식기관 자료 0건');
    expect(v.reasons.join(' ')).toContain('관련 근거 0건');
  });

  it('단계 상태가 쌓이고 WEAK 를 안다', () => {
    const logs: string[] = [];
    const s = new PipelineStatus((m) => logs.push(m));
    s.mark('SEARCH', 'SEARCH_OK', 'NAVER_NEWS: OK 5');
    s.mark('GROUNDING', 'GROUNDING_WEAK', '공식 0');
    expect(s.weak).toBe(true);
    expect(s.summary()).toBe('SEARCH=SEARCH_OK · GROUNDING=GROUNDING_WEAK');
    expect(logs[1]).toBe('[STAGE] GROUNDING: GROUNDING_WEAK — 공식 0');
  });

  it('⭐ 소스별 OK/FAIL 을 구분한다 — "0건"과 "검색 실패"는 다르다', () => {
    const s = summarizeNaverCalls([
      { type: 'news', query: 'k', sort: 'date', ok: true, count: 5, mode: 'legacy', at: 1 },
      { type: 'webkr', query: 'k', sort: 'sim', ok: false, count: 0, mode: 'legacy', error: '429 한도 초과', at: 2 },
      { type: 'blog', query: 'k', sort: 'sim', ok: true, count: 0, mode: 'legacy', at: 3 },
    ]);
    expect(s.line).toContain('NAVER_NEWS: OK 5');
    expect(s.line).toContain('NAVER_WEB: FAIL(429 한도 초과)');
    expect(s.line).toContain('NAVER_BLOG: OK 0');
    expect(s.failed).toEqual(['NAVER_WEB']);
  });

  it('⭐ 검색광고 고객 ID 를 검색 API 키 자리에 넣지 않는다 · HUB 키만 있어도 검색이 켜진다', () => {
    const orch = read('src/core/final/orchestration.ts');
    const crawl = orch.slice(orch.indexOf("const envKw = loadEnvFromFile();"), orch.indexOf('const crawlerConfig = {'));
    expect(crawl).not.toContain("(payload as any).naverCustomerId ||");
    expect(crawl).not.toContain("envKw['naverCustomerId']");
    expect(crawl).toContain('resolveAllNaverCredentials(payload)');
    expect(orch).toContain('if (hasSearchCredentials) {');
    expect(orch).toContain("'SEARCH_FAIL', 'NO_NAVER_CREDENTIALS");
    const crawler = read('src/core/content-crawler.ts');
    expect(crawler).not.toContain('if (!naverClientId || !naverClientSecret)');
    expect((crawler.match(/hasNaverSearchKeys\(naverClientId, naverClientSecret\)/g) || []).length).toBe(4);
  });
});

// ══════════════════════════════════════════════════════════
describe('⑦ 분량은 근거가 정한다 — 절 개수·최소 글자수 강제 제거', () => {
  const packet = (facts: number) => `[RESEARCH PACKET — 2026-09-22]\n▸ 확인된 사실\n${'- 사실 [E01]\n'.repeat(facts)}▸ 검색자가 실제로 물은 것\n- 질문1\n- 질문2\n[FACT EVIDENCE — 근거 항목 3건]\n- 이건 근거 본문`;

  it('패킷의 사실 줄만 센다 (질문·자동완성·근거 본문은 세지 않는다)', () => {
    expect(countPacketFacts(packet(7))).toBe(7);
    expect(countPacketFacts('패킷 없음')).toBe(-1);
  });

  it('⭐ 근거가 적으면 짧게, 많으면 자세히 — 하한도 같이 움직인다', () => {
    const thin = resolveLengthPlan(packet(5), 'external');
    const rich = resolveLengthPlan(packet(30), 'external');
    expect(thin.tier).toBe('thin');
    expect(rich.tier).toBe('rich');
    expect(thin.minChars).toBeLessThan(rich.minChars);
    expect(thin.perSectionFloor).toBeLessThan(rich.perSectionFloor);
    expect(lengthRuleText(thin)).toContain('같은 말을 바꿔 되풀이하지 마세요');
    expect(lengthRuleText(thin)).not.toContain('반드시');
  });

  it('패킷이 없는 경로(쇼핑 등)는 예전 기준 그대로 — 기존 발행 포맷을 깨지 않는다', () => {
    expect(resolveLengthPlan('상품 데이터', 'shopping').rangeText).toBe('800~1500자');
    expect(resolveLengthPlan('', 'external').rangeText).toBe('600~1000자');
  });

  it('⭐⭐ "(최소 N자)" 절 강제와 "총 8,000자 이상" 무조건 강제가 남아 있지 않다', () => {
    const orch = read('src/core/final/orchestration.ts');
    expect(orch).not.toMatch(/\(최소 \$\{[^}]*minChars[^}]*\}자\)/);
    const gate = orch.slice(orch.indexOf('const lengthPlanForGate'), orch.indexOf('const retried = await generateAllSectionsFinal(', orch.indexOf('const lengthPlanForGate')));
    expect(gate).toContain("lengthPlanForGate.tier === 'legacy'");
    expect(gate).toContain('perSectionFloor');
    const gen = read('src/core/final/generation.ts');
    expect(gen).toContain('lengthPlanMod.lengthRuleText(lengthPlan)');
    expect(gen).toContain('textLength(c) < lengthPlan.minChars');
  });

  it('소제목 상한 8 · 일부러 적게 잡은 절 수에 "정확히 N개"를 강제하지 않는다', () => {
    const gen = read('src/core/final/generation.ts');
    expect(gen).not.toContain('else targetCount = 10;');
    expect(read('src/core/final/orchestration.ts')).toContain('currentH2Count < Math.min(modeTargets.min, plannedH2Count)');
  });
});

// ══════════════════════════════════════════════════════════
describe('⑦-2 프롬프트 다이어트 — 되풀이 규칙만 걷고 근거는 건드리지 않는다', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { dietPrompt } = require('../src/core/final/prompt-diet');
  const rule = '🛡️ **E-E-A-T 강제 규칙** (이 글을 보고 구글이 신뢰할 수 있다고 판단하게 만드는 요소):';
  const evidenceLine = '금융위원회는 10월 7일부터 16일까지 청년미래적금 2차 가입 신청을 받는다고 밝혔다.';
  const prompt = [
    '🎯 키워드: 테스트',
    '[RESEARCH PACKET — 2026-09-22]', evidenceLine, evidenceLine, evidenceLine, evidenceLine,
    '## FACT INTEGRITY: NON-NEGOTIABLE',
    ...[1, 2, 3, 4, 5].flatMap((n) => [`[섹션 ${n}: 제목 ${n}]`, rule, `역할: 섹션 ${n} 만의 역할 설명이 여기에 길게 들어갑니다`, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━']),
    '{"h3": "예시", "content": "<p>형식 예시는 되풀이가 뜻이다 — 지우면 안 된다</p>"}',
    '{"h3": "예시", "content": "<p>형식 예시는 되풀이가 뜻이다 — 지우면 안 된다</p>"}',
    '{"h3": "예시", "content": "<p>형식 예시는 되풀이가 뜻이다 — 지우면 안 된다</p>"}',
  ].join('\n');

  it('⭐ 절마다 되풀이되는 같은 규칙은 첫 번째만 남는다', () => {
    const r = dietPrompt(prompt);
    expect(r.text.split(rule).length - 1).toBe(1);
    expect(r.removedLines).toBe(4);
    expect(r.removedChars).toBeGreaterThan(200);
  });

  it('⭐⭐ 근거 구간은 같은 줄이 되풀이돼도 한 글자도 빼지 않는다', () => {
    expect(dietPrompt(prompt).text.split(evidenceLine).length - 1).toBe(4);
  });

  it('절마다 다른 줄·JSON 형식 예시는 그대로다', () => {
    const r = dietPrompt(prompt);
    for (const n of [1, 2, 3, 4, 5]) expect(r.text).toContain(`역할: 섹션 ${n} 만의 역할`);
    expect(r.text.split('{"h3": "예시"').length - 1).toBe(3);
  });

  it('본문 호출 직전에 적용된다 (한국어 경로)', () => {
    const gen = read('src/core/final/generation.ts');
    expect(gen).toContain("require('./prompt-diet').dietPrompt(prompt)");
    expect(gen).toContain('callGeminiWithGrounding(diet.text,');
  });

  it('모드 플러그인의 절 안내에도 "(최소 N자)" 강제가 없다 (상품 기반인 쇼핑만 예외)', () => {
    for (const f of ['external/external-mode.ts', 'internal/internal-mode.ts', 'paraphrasing/paraphrasing-mode.ts']) {
      expect(read(`src/core/content-modes/${f}`)).not.toMatch(/\(최소 \$\{/);
    }
  });
});

// ══════════════════════════════════════════════════════════
describe('⑧ Writer 입력 순서와 사실 규칙', () => {
  const orch = read('src/core/final/orchestration.ts');
  const gen = read('src/core/final/generation.ts');

  it('⭐ Research Packet → 근거 항목 → 지시 순서다 (앞에서부터 잘리므로 순서가 곧 우선순위)', () => {
    const block = orch.slice(orch.indexOf('factEnrichedContents = ['), orch.indexOf('];', orch.indexOf('factEnrichedContents = [')));
    expect(block.indexOf('...writerEvidenceBlocks')).toBeLessThan(block.indexOf('buildFactIntegrityPrompt('));
    const blocks = orch.slice(orch.indexOf('const writerEvidenceBlocks'), orch.indexOf('];', orch.indexOf('const writerEvidenceBlocks')));
    expect(blocks.indexOf('researchPacketText')).toBeLessThan(blocks.indexOf('evidenceRender.text'));
  });

  it('크롤링 원문 통짜·장부 통짜를 Writer 에게 보내지 않는다', () => {
    const block = orch.slice(orch.indexOf('factEnrichedContents = ['), orch.indexOf('];', orch.indexOf('factEnrichedContents = [')));
    expect(block).not.toContain('...(ledgerCoversSources ? [] : contents)');
    expect(block).not.toContain('factEvidence.context ? [`[FACT EVIDENCE');
  });

  it('관련도 문을 지난 크롤링 글만 검증 장부에 들어간다', () => {
    expect(orch).toContain('crawledPosts: (sourceScope ? relevantPosts.filter(');
  });

  it('⭐ 근거 밖의 금액·날짜·자격조건·발언·통계를 만들지 말라는 규칙이 있다', () => {
    for (const word of ['금액', '날짜', '신청기간', '자격조건', '인물 발언', '통계', '정책 내용', '기관 발표']) expect(gen).toContain(word);
    expect(gen).toContain('거기 없는 것을 사실처럼 새로 만들지 마세요');
    expect(gen).toContain('게시일이 다른 근거끼리 내용이 다르면 더 최근 것을 따르고');
  });
});

// ══════════════════════════════════════════════════════════
describe('⑨ 모델 하향 — 사용자가 모르게 저가 모델이 쓰지 않는다', () => {
  const caller = read('src/core/llm/llm-caller.ts');

  it('⭐ terra 도 240초를 받는다 (제한시간이 모델을 바꾸던 원인)', () => {
    const m = caller.match(/const SLOW_REASONING_MODEL = (\/.*\/i);/);
    expect(m).not.toBeNull();
    // eslint-disable-next-line no-eval
    const re: RegExp = eval(m![1]!);
    expect(re.test('gpt-5.6-terra')).toBe(true);
    expect(re.test('gpt-6-astra')).toBe(true);
    expect(re.test('gpt-5.6-luna')).toBe(false);
    expect(re.test('sonar')).toBe(false);
  });

  it('⭐⭐ 하향이 일어나면 화면 로그 창구로 알린다 (console 만으로 끝내지 않는다)', () => {
    expect(caller).toContain('(globalThis as any).__llmNotice?.(message)');
    const down = caller.slice(caller.indexOf("if (lastKind === 'timeout' && !downgraded)"), caller.indexOf('queue.push(faster)'));
    expect(down).toContain('notifyUser(');
    expect(down).toContain("recordDowngrade(provider as string, model, faster, 'timeout')");
    const orch = read('src/core/final/orchestration.ts');
    expect(orch).toContain('(globalThis as any).__llmNotice = (message: string) => onLog?.(message);');
    expect(orch).toContain('(globalThis as any).__llmNotice = null;');
  });

  it('⭐ 발행 장부에 requestedModel / actualModel / downgraded / downgradeReason 이 남는다', () => {
    const ledger = read('src/core/final/publish-ledger.ts');
    for (const f of ['requestedModel?: string', 'actualModel?: string', 'downgraded?: boolean', 'downgradeReason?: string']) expect(ledger).toContain(f);
    const orch = read('src/core/final/orchestration.ts');
    const entry = orch.slice(orch.indexOf('appendLedgerEntry(ledgerPath(), {'), orch.indexOf('});', orch.indexOf('appendLedgerEntry(ledgerPath(), {')));
    expect(entry).toContain('...describeModelUse()');
    expect(entry).toContain('pipelineStatus: pipelineStatus.summary()');
  });

  it('describeModelUse 가 하향 기록을 읽어 돌려준다', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { describeModelUse } = require('../src/core/final/model-use');
    const g: any = globalThis as any;
    const prev = process.env['PRIMARY_TEXT_MODEL'];
    process.env['PRIMARY_TEXT_MODEL'] = 'openai-gpt41';
    g.__llmActualModels = { 'openai/gpt-5.6-terra': 6, 'openai/gpt-5.6-luna': 1 };
    g.__llmDowngrades = [{ provider: 'openai', from: 'gpt-5.6-terra', to: 'gpt-5.6-luna', reason: 'timeout' }];
    const use = describeModelUse();
    expect(use.requestedModel).toBe('openai/gpt-5.6-terra');
    expect(use.actualModel).toContain('openai/gpt-5.6-luna×1');
    expect(use.downgraded).toBe(true);
    expect(use.downgradeReason).toBe('gpt-5.6-terra→gpt-5.6-luna(timeout)');
    g.__llmActualModels = { 'openai/gpt-5.6-terra': 7 }; g.__llmDowngrades = [];
    expect(describeModelUse().downgraded).toBe(false);
    if (prev === undefined) delete process.env['PRIMARY_TEXT_MODEL']; else process.env['PRIMARY_TEXT_MODEL'] = prev;
  });

  it('JSON 모드: OpenAI 에만 싣고, 거절당하면 그 옵션만 빼고 다시 부른다', () => {
    expect(caller).toContain("let useJsonMode = options.json === true && provider === 'openai';");
    expect(caller).toContain("requestBody['response_format'] = { type: 'json_object' }");
    expect(caller).toMatch(/if \(useJsonMode && \/response_format\|json_object\|json mode\/i\.test\(errorMsg\)\)/);
  });
});
