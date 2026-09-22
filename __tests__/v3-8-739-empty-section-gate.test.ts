/**
 * v3.8.739 — 빈 절 관문 (Release Blocker 1). 유료 호출 0.
 *
 * live 재현(주담대 금리 7%): S06 "주담대 상환부담 계산" 이 소제목만 있고 content "" → Critic 이 잡아도 구절이 없어 MINOR →
 * 조립 단계가 절을 지워 검색 의도의 답이 빠진 채 AUTO_PUBLISH. 이제 코드가 Critic 전에 잡고, 핵심 절은 그 절만 채우며, 못 채우면 관문 FAIL.
 */
import * as fs from 'fs';
import * as path from 'path';
import { isEmptyContent, isCoreSection, findEmptySections, repairEmptySections, verifyRepair, buildRepairPrompt } from '../src/core/final/empty-section-gate';
import { ledgerFromItems } from '../src/core/final/fact-claims';

process.env['NO_LIVE_LLM'] = '1';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');

const ledger = ledgerFromItems([{ id: 'E01', text: '주택담보대출 3억원을 연 8%로 빌리면 단순 이자는 연 2,400만원이다. 5대 은행 고정형 상단은 연 7.17%다.' }]);
const packetText = '[RESEARCH PACKET]\n▸ 수치\n- 3억원 연 8% 단순 이자 연 2,400만원 [E01]\n- 7.17% [E01]';
const evidenceText = '[E01][뉴스] 주담대 이자 부담\n주택담보대출 3억원을 연 8%로 빌리면 단순 이자는 연 2,400만원이다.';

const article = () => ({
  introduction: '<p>주택담보대출 금리 7% 돌파가 무엇을 뜻하는지 봅니다.</p>',
  sections: [
    { h2: '주담대 연 확인 기준', h3Sections: [{ h3: '기준', content: '<p>고정형 상단은 연 7.17%입니다. 상품마다 적용금리가 다릅니다. 확인 순서를 정리합니다.</p>', tables: [] }] },
    { h2: '주담대 상환부담 계산', answersTo: '주택 담보 대출 7억의 이자 부담은 어떻게 계산하나요?', h3Sections: [{ h3: '원금과 이자를 나누는 계산', content: '', tables: [] }] },
    { h2: '금리인하요구권 신청 전 점검', h3Sections: [{ h3: '점검', content: '<p>금리인하요구권은 대출 실행 뒤 신용상태가 개선됐을 때 검토하는 제도입니다. 약정서의 적용금리 항목을 먼저 봅니다.</p>', tables: [] }] },
  ],
  conclusion: '<p>내 금리부터 확인하는 것이 먼저입니다.</p>',
});

describe('① 빈 절 판정 — 결정적', () => {
  it('빈 문자열 · 공백 · 태그만 · 자리표시자만 = 빈 절 · 표가 있으면 비어 있지 않다', () => {
    expect(isEmptyContent('')).toBe(true);
    expect(isEmptyContent('   \n ')).toBe(true);
    expect(isEmptyContent('<p></p><div class="content"></div>')).toBe(true);
    expect(isEmptyContent('<p>내용 없음</p>')).toBe(true);
    expect(isEmptyContent('<p>TBD</p>')).toBe(true);
    expect(isEmptyContent('<p>…</p>')).toBe(true);
    expect(isEmptyContent('', [{ headers: ['a'], rows: [['1']] }])).toBe(false);
    expect(isEmptyContent('<p>고정형 상단은 연 7.17%입니다. 상품마다 적용금리가 다릅니다.</p>')).toBe(false);
  });
  it('핵심 절: 검색 질문에 답하는 절(answersTo) · 제목 낱말과 겹치는 소제목 · 실 질문과 겹치는 소제목. 아니면 선택 절', () => {
    expect(isCoreSection({ h2: '주담대 상환부담 계산', answersTo: '7억 이자 부담' }, '주택담보대출 금리 7% 돌파', []).core).toBe(true);
    expect(isCoreSection({ h2: '주담대 금리 확인 기준' }, '주택담보대출 금리 7% 돌파 기준금리도 7%인가요', []).core).toBe(true);
    expect(isCoreSection({ h2: '상환부담 계산' }, '주택담보대출 금리 7% 돌파', ['7억 상환부담은 어떻게 계산하나']).core).toBe(true);
    expect(isCoreSection({ h2: '함께 보면 좋은 여행지' }, '주택담보대출 금리 7% 돌파', []).core).toBe(false);
  });
  it('⭐⭐ live 재현: "주담대 상환부담 계산" content "" → EMPTY_SECTION detected · 핵심 절 · repair 대상', () => {
    const f = findEmptySections(article(), '주택담보대출 금리 7% 돌파 기준금리도 7%인가요');
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ sectionIndex: 1, h2: '주담대 상환부담 계산', emptyH3Indexes: [0], core: true });
    expect(f[0]!.coreReason).toContain('검색 질문');
  });
});

describe('② 수리 — 그 절만, 근거에 있는 값만, 코드가 다시 잰다', () => {
  it('⭐⭐ 수리 성공: content 채워짐 · 값 대조 PASS · 질문 답 PASS · 다른 절 바이트 그대로 · 호출 1', async () => {
    const a = article();
    const prompts: string[] = [];
    const callModel = async (p: string) => { prompts.push(p); return JSON.stringify({ h3Sections: [{ index: 0, content: '<h3>원금과 이자를 나누는 계산</h3><p>주택담보대출 7억 이자 부담은 원금에 적용금리를 곱해 계산합니다. 근거 자료의 예시로 3억원을 연 8%로 빌리면 단순 이자는 연 2,400만원입니다.</p><p>실제 월 상환액은 상환기간과 상환방식까지 넣어 계산기로 확인해야 합니다.</p>' }] }); };
    const { article: out, result } = await repairEmptySections(a, { title: '주택담보대출 금리 7% 돌파', mainKeyword: '주택담보대출 금리 7% 돌파', packetText, evidenceText, ledger, callModel });
    expect(result.findings).toHaveLength(1);
    expect(result.repaired).toHaveLength(1);
    expect(result.unresolved).toEqual([]);
    expect(result.calls).toBe(1);
    expect(out.sections[1].h3Sections[0].content).toContain('2,400만원');
    expect(out.sections[1].h3Sections[0].content).not.toMatch(/<h3/i);           // 소제목 에코는 걷어낸다
    expect(out.sections[1].h3Sections[0].h3).toBe('원금과 이자를 나누는 계산');
    expect(out.sections[0]).toEqual(a.sections[0]);                                // 다른 절 그대로
    expect(out.sections[2]).toEqual(a.sections[2]);
    expect(out.sections).toHaveLength(3);
    expect(prompts[0]).toContain('이 절이 답할 검색 질문: 주택 담보 대출 7억의 이자 부담');
    expect(prompts[0]).toContain('RESEARCH PACKET');
    expect(prompts[0]).toContain('[index 0] <h3>원금과 이자를 나누는 계산</h3>');
    expect(prompts[0]).toContain('===== 뒤 절 시작(문맥) =====\n금리인하요구권은');             // 앞뒤 절은 짧은 문맥(300자)만
    expect(a.sections[1].h3Sections[0].content).toBe('');                          // 원본 불변
  });
  it('⭐ 수리 본문에 근거 없는 값이 있으면 미해결 → 관문 FAIL 재료 · 절은 지우지 않는다', async () => {
    const callModel = async () => JSON.stringify({ h3Sections: [{ index: 0, content: '<p>주택담보대출 7억 이자 부담은 연 5,600만원입니다. 금리가 오르면 부담이 커집니다. 실제 월 상환액은 상환기간과 상환방식까지 넣어 금융감독원 계산기로 확인해야 합니다. 원금과 이자를 나누어 보면 초기 부담이 보입니다.</p>' }] });
    const { article: out, result } = await repairEmptySections(article(), { title: 't', mainKeyword: '주택담보대출', packetText, evidenceText, ledger, callModel });
    expect(result.unresolved).toHaveLength(1);
    expect(result.unresolved[0]!.reason).toContain('5,600만원');
    expect(result.repaired).toEqual([]);
    expect(out.sections).toHaveLength(3);
    expect(out.sections[1].h3Sections[0].content).toBe('');
  });
  it('⭐ 여전히 비어 있거나(짧음) 질문에 답하지 않으면 미해결', async () => {
    const short = async () => JSON.stringify({ h3Sections: [{ index: 0, content: '<p>확인해야 합니다.</p>' }] });
    expect((await repairEmptySections(article(), { title: 't', mainKeyword: 'k', packetText, evidenceText, ledger, callModel: short })).result.unresolved[0]!.reason).toContain('짧다');
    const offTopic = async () => JSON.stringify({ h3Sections: [{ index: 0, content: '<p>날씨가 좋은 날에는 산책을 권합니다. 가벼운 운동은 건강에 도움이 됩니다. 물을 자주 마시고 충분히 쉬는 것이 좋습니다. 규칙적인 생활이 중요합니다. 아침에 일어나 스트레칭을 하고 저녁에는 가볍게 걷는 습관이 몸을 가볍게 만듭니다.</p>' }] });
    expect((await repairEmptySections(article(), { title: 't', mainKeyword: 'k', packetText, evidenceText, ledger, callModel: offTopic })).result.unresolved[0]!.reason).toContain('답하는 낱말이 없다');
    expect(verifyRepair('<p>주택담보대출 이자 부담은 원금과 적용금리로 계산합니다. 상환기간과 방식도 함께 봐야 합니다. 계산기를 쓰면 됩니다. 원금 균등과 원리금 균등은 초기 부담이 다르므로 같은 조건으로 비교합니다.</p>', ledger, '이자 부담 계산', 'x')).toBeNull();
  });
  it('선택 절(핵심 아님)이 비면 지운다 · 호출 0 · 미해결 0', async () => {
    const a = article();
    a.sections[1] = { h2: '함께 보면 좋은 여행지', h3Sections: [{ h3: '추천', content: '', tables: [] }] } as any;
    let calls = 0;
    const { article: out, result } = await repairEmptySections(a, { title: '주택담보대출 금리 7% 돌파', mainKeyword: 'k', packetText, evidenceText, ledger, callModel: async () => { calls += 1; return '{}'; } });
    expect(result.removed).toHaveLength(1);
    expect(result.unresolved).toEqual([]);
    expect(calls).toBe(0);
    expect(out.sections.map((s: any) => s.h2)).toEqual(['주담대 연 확인 기준', '금리인하요구권 신청 전 점검']);
  });
  it('빈 절이 없으면 호출 0 · 글 객체 그대로', async () => {
    const a = article(); a.sections[1].h3Sections[0].content = '<p>이자 부담은 원금 곱하기 금리로 계산합니다. 상환기간과 방식까지 넣어 확인합니다.</p>';
    const { article: out, result } = await repairEmptySections(a, { title: 't', mainKeyword: 'k', packetText, evidenceText, ledger, callModel: async () => { throw new Error('호출되면 안 된다'); } });
    expect(result.findings).toEqual([]);
    expect(out).toBe(a);
  });
  it('수리 프롬프트는 값 규칙·JSON 출력·소제목 불변을 말한다', () => {
    const f = findEmptySections(article(), 't')[0]!;
    const p = buildRepairPrompt({ title: 't', mainKeyword: 'k', section: article().sections[1], finding: f, packetText, evidenceText, prevContext: '앞', nextContext: '뒤' });
    expect(p).toMatch(/근거에 글자로 있는 것만/);
    expect(p).toMatch(/소제목\(h3\)은 바꾸지 않습니다/);
    expect(p).toMatch(/"h3Sections":\[\{"index":0/);
  });
});

describe('③ orchestration 배선 — Critic 전에 · Hard Gate · 절 삭제로 "성공" 금지', () => {
  const orch = read('src/core/final/orchestration.ts');
  it('빈 절 관문이 비평 루프 앞에서 돌고, EMPTY_SECTION_PASS 가 Hard Gate 에 있다', () => {
    const gateAt = orch.indexOf("require('./empty-section-gate')");
    const loopAt = orch.indexOf("require('./critique-loop')");
    expect(gateAt).toBeGreaterThan(0);
    expect(gateAt).toBeLessThan(loopAt);
    expect(orch).toMatch(/EMPTY_SECTION_PASS: \(emptySectionResult\?\.unresolved \|\| \[\]\)\.length === 0/);
    expect(orch).toContain('emptySections: emptySectionResult');
  });
});
