/**
 * v3.8.745 — CTA 문구는 "지금 할 수 있는가" 를 근거로만 정한다. 유료 호출 0 · 네트워크 0.
 *
 * live(부산국제영화제 744): 본문·요약 "개막식 티켓 전석 매진" 인데 CTA "부산국제영화제 개막작 예매 — 공식 홈페이지에서 바로 예매할 수 있습니다."
 * → Judge CONTRADICTION. 원인은 범용 훅 템플릿 `${keyword} — ${label}에서 바로 ${doing}할 수 있습니다.`
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildCtaCopy, inferActionStatus, ASSERTIVE_AVAILABILITY_RE } from '../src/cta/cta-copy';
import { ctaCandidateVerdict, allowedHostsFrom } from '../src/core/final/generation';

process.env['NO_LIVE_LLM'] = '1';
const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');

describe('① 상태 판정 — 근거로만', () => {
  it('매진·마감·접수 종료 → UNAVAILABLE', () => {
    expect(inferActionStatus('제31회 개막식 티켓은 예매 오픈과 동시에 전석 매진됐다.')).toBe('UNAVAILABLE');
    expect(inferActionStatus('청년미래적금 1차 접수 종료. 2차는 추후 공지')).toBe('UNAVAILABLE');
  });
  it('현재 접수 중 · N월 N일부터 접수 → AVAILABLE', () => {
    expect(inferActionStatus('서울시는 9월 17일부터 11월 30일까지 ev.or.kr에서 접수한다. 현재 접수 중이다.')).toBe('AVAILABLE');
    expect(inferActionStatus('10월 7일부터 16일까지 2차 가입 신청을 받는다.')).toBe('AVAILABLE');
  });
  it('근거 없음 · 둘 다 보임 → UNKNOWN (단정하지 않는다)', () => {
    expect(inferActionStatus('')).toBe('UNKNOWN');
    expect(inferActionStatus('주택담보대출 금리 상단이 연 7.17%를 기록했다.')).toBe('UNKNOWN');
    expect(inferActionStatus('개막식 티켓은 전석 매진됐다. 일반 상영은 현재 예매 중이다.')).toBe('UNKNOWN');
  });
});

describe('② 문구 — 버튼과 훅이 같은 태도', () => {
  it('⭐⭐ UNAVAILABLE(부산국제영화제 전석 매진): "바로 예매할 수 있습니다" 금지 · 현황형', () => {
    const c = buildCtaCopy({ url: 'https://www.biff.kr/kor/artyboard/mboard.asp?intseq=75822', siteName: '부산국제영화제 공식 홈페이지', action: '예매', actionStatus: 'UNAVAILABLE' });
    expect(c.actionStatus).toBe('UNAVAILABLE');
    expect(c.buttonText).toBe('부산국제영화제 공식 홈페이지에서 예매 현황 확인');
    expect(c.hookingMessage).not.toMatch(ASSERTIVE_AVAILABILITY_RE);
    expect(c.hookingMessage).toContain('현황');
  });
  it('⭐ UNKNOWN(기본): 안내형 — "예매 안내 확인" / "신청 방법 확인"', () => {
    const a = buildCtaCopy({ url: 'https://www.biff.kr/', siteName: '부산국제영화제', action: '예매' });
    expect(a.actionStatus).toBe('UNKNOWN');
    expect(a.buttonText).toBe('부산국제영화제에서 예매 안내 확인');
    expect(a.hookingMessage).not.toMatch(ASSERTIVE_AVAILABILITY_RE);
    const b = buildCtaCopy({ url: 'https://www.gov.kr/', siteName: '정부24', action: '신청', actionStatus: 'UNKNOWN' });
    expect(b.buttonText).toBe('정부24에서 신청 방법 확인');
  });
  it('⭐ AVAILABLE: 행동형 그대로 — 예전 문구(위택스 취득세 조회)는 AVAILABLE 일 때만', () => {
    const c = buildCtaCopy({ url: 'https://www.wetax.go.kr/', siteName: '위택스', action: '취득세 조회', actionStatus: 'AVAILABLE' });
    expect(c.buttonText).toBe('위택스에서 취득세 조회');
    expect(c.hookingMessage).toBe('취득세 조회는 위택스에서 바로 하실 수 있습니다.');
  });
  it('이름 없이 행동만 있을 때도 AVAILABLE 아니면 "이어서 하실 수 있습니다" 를 쓰지 않는다', () => {
    expect(buildCtaCopy({ action: '신청' }).hookingMessage).not.toMatch(ASSERTIVE_AVAILABILITY_RE);
    expect(buildCtaCopy({ action: '신청', actionStatus: 'AVAILABLE' }).hookingMessage).toContain('이어서 하실 수 있습니다');
  });
  it('단정 표현 검출기: "바로 예매할 수 있습니다" · "지금 신청" · "현재 접수 가능" 은 잡고, "안내 확인" 은 안 잡는다', () => {
    expect(ASSERTIVE_AVAILABILITY_RE.test('공식 홈페이지에서 바로 예매할 수 있습니다.')).toBe(true);
    expect(ASSERTIVE_AVAILABILITY_RE.test('지금 신청하세요')).toBe(true);
    expect(ASSERTIVE_AVAILABILITY_RE.test('현재 접수 가능')).toBe(true);
    expect(ASSERTIVE_AVAILABILITY_RE.test('공식 홈페이지에서 예매 안내를 확인할 수 있습니다.')).toBe(false);
  });
});

describe('③ 배선 — 세 템플릿이 전부 상태를 거치고, 상태는 근거 본문으로만 · host/entity 검증은 그대로', () => {
  const gen = read('src/core/final/generation.ts');
  const orch = read('src/core/final/orchestration.ts');
  it('"바로 ${doing}할 수 있습니다" 범용 템플릿이 남아 있지 않다', () => {
    expect(gen).not.toMatch(/에서 바로 \$\{doing\}할 수 있습니다/);
  });
  it('ctaActionStatus 는 inferActionStatus(근거 본문) 로만 · orchestration 이 패킷+근거 본문을 넘긴다', () => {
    expect(gen).toMatch(/const ctaActionStatus: CtaActionStatus = inferActionStatus\(evidenceText \|\| ''\)/);
    expect(orch).toMatch(/generateCTAsFinal\([\s\S]*?`\$\{researchPacketText\}\\n\$\{evidenceRender\.text\}`\)/);
    expect((gen.match(/upgradeHomeCtas\(safeCTAs, keyword, .*allowedHosts, ctaActionStatus\);/g) || []).length).toBe(2);
  });
  it('라우터가 쓴 훅도 AVAILABLE 이 아니면 단정 표현을 못 쓴다', () => {
    expect(gen).toMatch(/const routerHook = smart\?\.hookMessage && \(ctaActionStatus === 'AVAILABLE' \|\| !ASSERTIVE_AVAILABILITY_RE\.test/);
  });
  it('회귀: biff → biky REJECT · tbn.or.kr(entity 다름) REJECT · finlife 같은 집 ALLOW', () => {
    const allowed = allowedHostsFrom(['https://www.biff.kr/kor/']);
    expect(ctaCandidateVerdict('https://www.biff.kr/', 'https://www.biky.or.kr/x', allowed).ok).toBe(false);
    expect(ctaCandidateVerdict('https://www.biff.kr/', 'https://www.tbn.or.kr/notice', allowed, 'biff.kr').ok).toBe(false);
    expect(ctaCandidateVerdict('https://www.kbstar.com', 'https://finlife.fss.or.kr/finlife/x', allowedHostsFrom(['https://finlife.fss.or.kr/']), 'finlife.fss.or.kr').ok).toBe(true);
  });
});
