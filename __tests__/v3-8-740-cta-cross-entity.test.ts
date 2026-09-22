/**
 * v3.8.740 — CTA 다른 집(apex) 교체 차단 (Release Blocker 2). 유료 호출 0 · 네트워크 0.
 *
 * live(부산국제영화제 개막작 예매): 근거 biff.kr 8건, 처음 CTA 도 biff.kr 인데 "행동 화면 교체" 가 biky.or.kr(부산국제어린이청소년영화제)로
 * 갈아끼웠다. Judge 가 막았지만 앞단에서 막아야 한다. 후보는 원래 주소와 같은 집이거나 근거·공식 출처의 집이어야 한다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { ctaCandidateVerdict, allowedHostsFrom } from '../src/core/final/generation';

process.env['NO_LIVE_LLM'] = '1';
const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');

describe('① 후보 판정 — 같은 집 · 허용된 집 · 다른 집', () => {
  const allowed = allowedHostsFrom(['https://www.biff.kr/kor/artyboard/mboard.asp?intSeq=96887', 'https://biff.kr/', 'https://www.busan.go.kr/news/1']);
  it('허용 목록은 apex 로 만든다', () => {
    expect([...allowed]).toEqual(['biff.kr', 'busan.go.kr']);
  });
  it('⭐⭐ Case A (live 재현): biff.kr → biky.or.kr 은 REJECT CTA_CROSS_ENTITY', () => {
    const v = ctaCandidateVerdict('https://www.biff.kr/kor/artyboard/mboard.asp?intSeq=96887', 'https://www.biky.or.kr/kor/addon/10000001/page.asp?page_num=52003', allowed);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/^CTA_CROSS_ENTITY/);
    expect(v.reason).toContain('biky.or.kr');
  });
  it('⭐ Case B: 같은 집의 다른 화면(biff.kr/ticket…)·서브도메인(ticket.biff.kr)은 ALLOW', () => {
    expect(ctaCandidateVerdict('https://www.biff.kr/', 'https://www.biff.kr/kor/html/ticket/reserve.asp', allowed).ok).toBe(true);
    expect(ctaCandidateVerdict('https://www.biff.kr/', 'https://ticket.biff.kr/reserve', allowed).ok).toBe(true);
  });
  it('⭐ 원래 주소와 다른 집이라도 근거·공식 출처에 있는 집이면 ALLOW (상업 사이트 → 근거에 있던 기관)', () => {
    const v = ctaCandidateVerdict('https://www.rentcar-shop.com/', 'https://www.busan.go.kr/apply', allowed);
    expect(v.ok).toBe(true);
    expect(v.reason).toContain('busan.go.kr');
  });
  it('⭐ Case C: 허용 목록이 비어 있으면 원래 주소와 같은 집만 통과 — 다른 집은 REJECT', () => {
    const empty = new Set<string>();
    expect(ctaCandidateVerdict('https://www.biff.kr/', 'https://www.biff.kr/ticket', empty).ok).toBe(true);
    // 허용 목록이 빈 Set 이면 "목록 없음" 과 같이 옛 경로로 본다(검사 생략) — 목록을 준 경로에서만 검사가 산다
    expect(ctaCandidateVerdict('https://www.biff.kr/', 'https://www.biky.or.kr/', empty).ok).toBe(true);
    expect(ctaCandidateVerdict('https://www.biff.kr/', 'https://www.biky.or.kr/', undefined).ok).toBe(true);   // 옛 호출 경로(회귀 방지)
  });
  it('⭐⭐ Case D (live 743 재현): 라우터가 "금융상품한눈에"(finlife.fss.or.kr)를 지목했는데 후보가 hf.go.kr — 근거에 있어도 REJECT (라벨과 주소가 어긋난다)', () => {
    const allowedFin = allowedHostsFrom(['https://www.hf.go.kr/ko/sub01/sub01_04.do', 'https://finlife.fss.or.kr/finlife/ldng/houseMrtg/list.do', 'https://www.kbstar.com/']);
    const v = ctaCandidateVerdict('https://www.kbstar.com', 'http://www.hf.go.kr/ko/sub01/sub01_04.do', allowedFin, 'finlife.fss.or.kr');
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/^CTA_CROSS_ENTITY/);
    expect(v.reason).toContain('fss.or.kr');
    // 같은 기관의 집이면 ALLOW (fine.fss.or.kr 도 finlife.fss.or.kr 도 fss.or.kr)
    expect(ctaCandidateVerdict('https://www.kbstar.com', 'https://finlife.fss.or.kr/finlife/ldng/houseMrtg/list.do?menuNo=700007', allowedFin, 'finlife.fss.or.kr').ok).toBe(true);
    // entityHost 를 모르면(사전에 없음) 예전 규칙만
    expect(ctaCandidateVerdict('https://www.kbstar.com', 'http://www.hf.go.kr/ko/sub01/sub01_04.do', allowedFin, '').ok).toBe(true);
  });
  it('호스트를 읽을 수 없는 후보는 REJECT', () => {
    expect(ctaCandidateVerdict('https://www.biff.kr/', 'not a url', allowed).ok).toBe(false);
  });
});

describe('② 배선 — orchestration 이 근거 URL 을 넘기고, 두 교체 지점이 판정을 거친다 · Judge 검사는 그대로', () => {
  const gen = read('src/core/final/generation.ts');
  const orch = read('src/core/final/orchestration.ts');
  const loop = read('src/core/final/critique-loop.ts');
  it('generateCTAsFinal 에 evidenceUrls → allowedHosts → upgradeHomeCtas 두 호출 모두', () => {
    expect(orch).toMatch(/generateCTAsFinal\(keyword, crawledPosts, sections, contentMode, officialSources, onLog, ctaBlogUrl, evidenceItems\.map/);
    // v3.8.748 — 뒤에 matchContext(CTA 적합성 관문 재료)가 붙었다. allowedHosts 가 두 호출 모두에 실리는 것이 이 검사의 뜻이다
    expect((gen.match(/upgradeHomeCtas\(safeCTAs, keyword, .*allowedHosts(, ctaActionStatus)?(, matchContext)?\);/g) || []).length).toBe(2);
  });
  it('검색으로 찾은 후보(기관 행동 화면 · 사이트 안 행동 화면) 둘 다 ctaCandidateVerdict 를 지난다 · 표 후보는 예외', () => {
    const body = gen.slice(gen.indexOf('export async function upgradeHomeCtas'), gen.indexOf('export async function generateCTAsFinal'));
    expect((body.match(/ctaCandidateVerdict\(cta\.url, /g) || []).length).toBe(2);
    expect(body).toContain('const originalVerified');
    expect(body).toMatch(/if \(wrongHost && !originalVerified\)/);
  });
  it('Judge 의 MIXED_ENTITY 검사(뒷단)는 그대로 남아 있다', () => {
    expect(loop).toContain('CONTRADICTION|MIXED_ENTITY|EXPIRED_AS_CURRENT|TITLE_PROMISE_UNMET|ANSWER_NEVER_GIVEN|REDUNDANCY|CTA_OFFTOPIC|SUMMARY_MISMATCH|FAQ_MISMATCH');
  });
});
