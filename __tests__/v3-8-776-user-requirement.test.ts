const fs = require('fs');
const path = require('path');

const prompts: string[] = [];
jest.mock('../src/core/final/gemini-engine', () => ({
  ...jest.requireActual('../src/core/final/gemini-engine'),
  callGeminiWithRetry: async (p: string) => {
    prompts.push(p);
    return JSON.stringify(Array.from({ length: 6 }, (_, i) => ({ question: `인감증명서 질문 ${i + 1}번은 무엇인가요?`, answer: `답변 ${i + 1}: 온라인 발급 가능한 용도를 확인하세요.` })));
  },
}));

import { parseUserRequirements, structurePlan, compactRequirementBlock, writerRequirementBlock, hypotheticalInputs, resolveRegenerateRequest, findStoredRequest, requestKey, compactFromGuide } from '../src/core/final/user-requirement';
import { checkUserRequirements, requirementGate, requirementRegressions, draftHtml, bodyTables, stepStructures } from '../src/core/final/user-requirement-coverage';
import { buildUserRequestBlock, detectRequestConflicts } from '../src/core/final/user-request';
import { checkClaims, ledgerFromItems } from '../src/core/final/fact-claims';
import { inspectFactIntegrity } from '../src/core/final/fact-integrity';
import { generateFAQFinal } from '../src/core/final/generation';

/*
 * v3.8.776 — USER REQUIREMENT CONTRACT. 작성자 요청을 참고문구가 아니라 최종 글까지 지키는 명시 계약으로. 새 AI 호출 없음.
 */
const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const ORCH = read('src/core/final/orchestration.ts');
const status = (req: string, html: string, extra: Record<string, unknown> = {}) => checkUserRequirements(parseUserRequirements(req), { html, ...extra });
const gov = (text: string) => `<div class="cta-box"><a class="cta-btn" href="https://www.gov.kr/mw/AA020InfoCappView.do">${text}</a></div>`;

describe('계약 파싱·우선순위', () => {
  test('명령형은 MUST · "가능하면" 은 PREFER · "빼·넣지 마" 는 EXCLUDE — 대표·발표 같은 낱말은 표가 아니다', () => {
    const c = parseUserRequirements('비교표를 넣어주세요. 가능하면 표로 정리해주세요. FAQ는 빼주세요. 대표 번호와 발표 일정을 설명해주세요.');
    expect(c.requirements.map((r) => `${r.type}:${r.priority}:${r.directive.kind}`)).toEqual(['STRUCTURE:MUST:TABLE', 'STRUCTURE:PREFER:TABLE', 'STRUCTURE:EXCLUDE:FAQ', 'CONTENT:MUST:TOPIC']);
    expect(c.rawText).toBe('비교표를 넣어주세요. 가능하면 표로 정리해주세요. FAQ는 빼주세요. 대표 번호와 발표 일정을 설명해주세요.');
  });
  test('권장 live 요청 — 표·4단계·FAQ 제외·내용·발급 CTA 다섯 요구', () => {
    const c = parseUserRequirements('온라인·방문·대리 발급 차이를 비교표 1개로 정리해주세요.\n온라인 발급 방법을 정확히 4단계로 설명해주세요.\nFAQ는 넣지 마세요.\n온라인 발급이 불가능한 용도도 반드시 설명해주세요.\n정부24 공식 발급 페이지로 연결되는 CTA를 넣어주세요.');
    expect(c.requirements.map((r) => r.directive)).toEqual([
      { kind: 'TABLE', enabled: true, min: 1, comparison: true }, { kind: 'STEPS', count: 4 }, { kind: 'FAQ', enabled: false },
      { kind: 'TOPIC', topic: '온라인 발급이 불가능한 용도' }, { kind: 'CTA', enabled: true, action: '발급', official: true },
    ]);
    expect(structurePlan(c)).toMatchObject({ faq: { enabled: false }, minTables: 1, cta: { enabled: true, action: '발급' }, steps: 4 });
  });
  test('Writer 정본 블록: 사실 > 작성자 명시 요구 > 기본 편집 규칙 · 원문 그대로 · 계약 요약', () => {
    const b = buildUserRequestBlock('비교표를 반드시 넣어주세요. FAQ는 넣지 마세요.');
    expect(b).toContain('사실 근거 다음으로 우선');
    expect(b).toMatch(/기본 편집 규칙과 다르면 \*\*이 요구가 이긴다\.\*\*/);
    expect(b).toContain('<<작성자 요청 시작>>\n비교표를 반드시 넣어주세요. FAQ는 넣지 마세요.\n<<작성자 요청 끝>>');
    expect(b).toContain('[EXCLUDE] FAQ 없음');
    expect(b).toBe(writerRequirementBlock(parseUserRequirements('비교표를 반드시 넣어주세요. FAQ는 넣지 마세요.')));
  });
  test('충돌 감지: "가상 사례 계산" 은 사실 위반이 아니다 · "100만원이라고 써" 는 사실 확인 경고', () => {
    expect(detectRequestConflicts('1,000만원 가상 사례를 하나 넣고 계산해주세요.')).toEqual([]);
    expect(detectRequestConflicts('지원금은 100만원이라고 써주세요.').map((c) => c.kind)).toEqual(['fact']);
  });
});

describe('구조 (R1~R5)', () => {
  test('R1 비교표 필수 → 본문 <table> 있어야 COVERED · "아래 표" 문장·요약표만으로는 MISSING', () => {
    const table = '<table><tr><th>구분</th><th>온라인</th><th>방문</th></tr><tr><td>대리</td><td>불가</td><td>가능</td></tr></table>';
    expect(status('비교표를 반드시 넣어주세요.', `<p>차이는 다음과 같습니다.</p>${table}`)[0]).toMatchObject({ priority: 'MUST', status: 'COVERED' });
    expect(status('비교표를 반드시 넣어주세요.', '<p>아래 비교표를 보세요.</p>')[0]!.status).toBe('MISSING');
    const summaryOnly = '<div class="summary-container"><table class="responsive-table summary-table"><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table></div>';
    expect(bodyTables(summaryOnly)).toBe(0);
  });
  test('R2 FAQ 넣지 마 → 생성기 호출 안 함 · 렌더 전 비움 · 보이는 FAQ 0 · FAQPage JSON-LD 0', () => {
    const plan = structurePlan(parseUserRequirements('FAQ는 넣지 마세요.'));
    expect(plan.faq).toEqual({ enabled: false, count: 0, explicit: true });
    expect(ORCH).toMatch(/let faqs: Awaited<ReturnType<typeof generateFAQFinal>> = userPlan\.faq\.enabled\s*\? await generateFAQFinal\(/);
    expect(ORCH).toContain('if (!userPlan.faq.enabled) faqs = [];');
    expect(status('FAQ는 넣지 마세요.', '<p>본문</p>')[0]!.status).toBe('COVERED');
    expect(status('FAQ는 넣지 마세요.', '<details><summary>Q</summary>A</details>')[0]!.status).toBe('CONTRADICTED');
    expect(status('FAQ는 넣지 마세요.', '<script type="application/ld+json">{"@type": "FAQPage"}</script>')[0]!.status).toBe('CONTRADICTED');
  });
  test('R3 FAQ 3개 → 생성기 프롬프트가 3개를 요구하고 압축 계약을 싣는다 · 최종 FAQ 3개면 COVERED', async () => {
    prompts.length = 0;
    const c = parseUserRequirements('FAQ 3개 넣어주세요. 가격 전망은 쓰지 마세요.');
    await generateFAQFinal('인감증명서 온라인 발급', ['온라인 발급'], undefined, '', { count: structurePlan(c).faq.count, requirementsBlock: compactRequirementBlock(c) });
    expect(prompts[0]).toContain('자주 묻는 질문(FAQ) 3개를');
    expect(prompts[0]).toContain('...총 3개');
    expect(prompts[0]).toContain('[EXCLUDE] 다루지 말 것: 가격 전망');
    const faq3 = '<details><summary>1</summary>a</details>'.repeat(3);
    expect(status('FAQ 3개 넣어주세요.', faq3)[0]!.status).toBe('COVERED');
    expect(status('FAQ 3개 넣어주세요.', faq3 + '<details><summary>4</summary>b</details>')[0]!.status).toBe('PARTIAL');
    expect(ORCH).toContain('else if (userPlan.faq.explicit && faqs.length > userPlan.faq.count) faqs = faqs.slice(0, userPlan.faq.count);');
  });
  test('R4 4단계 → 실제 단계 구조(<ol> 4항목 · 1~4단계 표지 · 번호 h3) — 낱말 "4단계" 만으로는 MISSING', () => {
    const req = '4단계로 설명해주세요.';
    expect(status(req, '<ol><li>로그인</li><li>검색</li><li>신청</li><li>출력</li></ol>')[0]!.status).toBe('COVERED');
    expect(status(req, '<h3>1단계 로그인</h3><h3>2단계 검색</h3><h3>3단계 신청</h3><h3>4단계 출력</h3>')[0]!.status).toBe('COVERED');
    expect(status(req, '<p>4단계로 나눠 보면 쉽습니다.</p>')[0]!.status).toBe('MISSING');
    expect(stepStructures('<ol><li>a</li><li>b</li><li>c</li></ol>')).toEqual([3]);
  });
  test('R5 공식 신청(발급) CTA → 실제 CTA · 행동 낱말 · 공식 주소. 없으면 MISSING(주소를 만들지 않음) · 다른 곳이면 CONTRADICTED', () => {
    const req = '정부24 공식 발급 페이지로 연결되는 CTA를 넣어주세요.';
    expect(status(req, gov('인감증명서 온라인 발급하기'))[0]!.status).toBe('COVERED');
    expect(status(req, '<p>CTA 없음</p>')[0]!.status).toBe('MISSING');
    expect(status(req, '<a class="cta-btn" href="https://blog.naver.com/x">발급 후기 보기</a>')[0]!.status).toBe('CONTRADICTED');
    expect(ORCH).toMatch(/if \(ctas\.length === 0 && userPlan\.cta\.enabled\)/);
  });
});

describe('내용·계산 (R6~R9)', () => {
  test('R6 "기존 가입자의 남은 기간" → 기존 핵심 질문 coverage(CQ-REMAINING-TERM)로 판정', () => {
    const r = status('기존 가입자의 남은 기간을 꼭 설명해주세요.', '<p>기존 가입자는 가입 시점부터 남은 기간 동안 기존 조건을 유지합니다.</p>')[0]!;
    expect(r).toMatchObject({ type: 'CONTENT', priority: 'MUST', status: 'COVERED' });
    expect(r.reason).toContain('CQ-REMAINING-TERM');
    expect(status('기존 가입자의 남은 기간을 꼭 설명해주세요.', '<p>신규 가입 방법만 다룹니다.</p>')[0]!.status).toBe('MISSING');
    // 일반 주제는 주제 낱말이 한 문단에 모였는가
    expect(status('온라인 발급이 불가능한 용도도 반드시 설명해주세요.', '<p>부동산 매도용은 온라인 발급이 불가능한 용도입니다.</p>')[0]!.status).toBe('COVERED');
  });
  test('R7 1,000만원 가상 사례 → 가정 입력: 사실 필터·본문 관문이 근거 없는 사실로 지우지 않는다(가정 표지 문장만)', () => {
    const c = parseUserRequirements('1,000만원 가상 사례를 하나 넣어 계산해주세요.');
    expect(hypotheticalInputs(c)).toEqual(['1,000만원']);
    const ev = { context: '실손보험 청구는 영수증과 진단서가 필요합니다. '.repeat(20), provider: 't', trustLevel: 'strong' as const, sourceUrls: ['https://example.com'] };
    const hypoSentence = '<p>보험금이 1,000만원인 가상 사례로 계산해 보겠습니다.</p>';
    expect(inspectFactIntegrity(hypoSentence, ev).status).toBe('blocked');   // BEFORE: 가정 입력도 근거 없는 값
    expect(inspectFactIntegrity(hypoSentence, { ...ev, userHypothetical: hypotheticalInputs(c) }).status).toBe('passed');
    expect(inspectFactIntegrity('<p>보험금 1,000만원을 받을 수 있습니다.</p>', { ...ev, userHypothetical: hypotheticalInputs(c) }).status).toBe('blocked');   // 사실처럼 쓰면 여전히 근거 필요
    const ledger = ledgerFromItems([{ id: 'E01', text: '실손보험 청구 서류 안내' }]);
    expect(checkClaims('보험금이 1,000만원인 가상 사례', ledger).unsupported).toContain('1,000만원');
    expect(checkClaims('보험금이 1,000만원인 가상 사례', ledger, new Date(), hypotheticalInputs(c).map((v) => ({ claim: v, operation: 'USER_HYPOTHETICAL_INPUT', sourceIds: ['USER_REQUEST'] }))).unsupported).toEqual([]);
    expect(status('1,000만원 가상 사례를 하나 넣어 계산해주세요.', '<p>예를 들어 보험금이 1,000만원이라면 900만원을 받습니다.</p>')[0]!.status).toBe('COVERED');
  });
  test('R8 가격 전망 제외 → Writer·FAQ·보강·수리·비평·심사가 같은 압축 계약을 받고, 최종 글에 나오면 위반', () => {
    const c = parseUserRequirements('가격 전망은 쓰지 마세요.');
    expect(compactRequirementBlock(c)).toContain('[EXCLUDE] 다루지 말 것: 가격 전망');
    expect(status('가격 전망은 쓰지 마세요.', '<p>내년 가격 전망은 밝습니다.</p>')[0]!.status).toBe('CONTRADICTED');
    expect(status('가격 전망은 쓰지 마세요.', '<p>가격은 공식 표를 봅니다.</p>')[0]!.status).toBe('COVERED');
    expect(ORCH).toMatch(/repairEmptySections\(allSectionsObj, \{[\s\S]{0,200}requirements: userCompact/);
    expect(ORCH).toMatch(/runCritiqueLoop\(\{[\s\S]{0,600}requirements: userCompact/);
    expect(ORCH).toMatch(/runFinalJudge\(\{[\s\S]{0,300}requirements: userCompact/);
    expect(read('src/core/final/generation.ts')).toContain("compactFromGuide(sectionGuideBlock || '')");
    expect(compactFromGuide(buildUserRequestBlock('가격 전망은 쓰지 마세요.'))).toBe(compactRequirementBlock(c));
    expect(read('src/core/final/critique-loop.ts')).toContain("...(input.requirements ? [input.requirements, ''] : [])");
  });
  test('R9 "가능하면 표로" → PREFER · 미충족이어도 관문 통과', () => {
    const r = status('가능하면 표로 정리해주세요.', '<p>표 없음</p>');
    expect(r[0]).toMatchObject({ priority: 'PREFER', status: 'MISSING' });
    expect(requirementGate(r).pass).toBe(true);
  });
});

describe('동일성·재생성 (R10~R13)', () => {
  test('R10 같은 키워드 + "FAQ 넣기" vs "FAQ 빼기" → 지문이 다르다 · UI 재사용 판정도 다르다', () => {
    const a = parseUserRequirements('FAQ 넣어주세요.'); const b = parseUserRequirements('FAQ 빼주세요.');
    expect(a.fingerprint).not.toBe(b.fingerprint);
    expect(parseUserRequirements('표 넣어주세요.').fingerprint).not.toBe(parseUserRequirements('표 빼주세요.').fingerprint);
    const posting = read('electron/ui/modules/posting.js');
    expect(posting).toContain("return String(value || '').replace(/\\s+/g, ' ').trim();");
    expect(posting).toMatch(/else if \(!sameUserRequest\(appState\.generatedContent\.payload\?\.userRequest, document\.getElementById\('userRequestNote'\)\?\.value\)\)/);
    expect(read('electron/ui/modules/preview.js')).toMatch(/if \(sameKeyword && sameRequest\)/);
  });
  test('R11 공백·줄바꿈만 다르면 같은 지문', () => {
    expect(parseUserRequirements('FAQ는  넣지 마세요.\n\n비교표 넣어주세요.').fingerprint).toBe(parseUserRequirements('FAQ는 넣지 마세요. 비교표 넣어주세요.').fingerprint);
    expect(requestKey(' a \n b ')).toBe('a b');
    expect(parseUserRequirements('').fingerprint).toBe('');
  });
  test('R12 재생성 → 장부의 원래 요청을 되살림 · 새로 적은 요청이 이긴다 · 장부에 요청 저장', () => {
    const entries = [{ at: '1', url: 'https://leadernam.com/a/', title: '인감증명서', keyword: 'k', userRequest: 'FAQ는 넣지 마세요.' }];
    const stored = findStoredRequest(entries, { url: 'https://leadernam.com/a', title: 'x' });
    expect(resolveRegenerateRequest({ stored })).toEqual({ userRequest: 'FAQ는 넣지 마세요.', origin: 'STORED' });
    expect(resolveRegenerateRequest({ explicit: '비교표 넣어주세요.', stored })).toEqual({ userRequest: '비교표 넣어주세요.', origin: 'EXPLICIT' });
    expect(resolveRegenerateRequest({ stored: findStoredRequest([{ at: '1', url: 'u', title: 't', keyword: 'k', userRequest: '' }], { title: 't' }) }).origin).toBe('STORED_EMPTY');
    expect(ORCH).toContain("userRequest: userContract?.rawText || '',");
    expect(read('electron/main.ts')).toMatch(/resolveRegenerateRequest\(\{[\s\S]{0,200}findStoredRequest\(ledger\.readLedger\(ledger\.defaultLedgerPath\(\)\), \{ url: current\.url, title \}\)/);
  });
  test('R13 요청 칸이 없는 옛 장부 줄 → UNKNOWN(빈 요청이라 단정하지 않음)', () => {
    const legacy = [{ at: '1', url: 'https://leadernam.com/a/', title: '인감증명서', keyword: 'k' }];
    expect(findStoredRequest(legacy, { url: 'https://leadernam.com/a/' })).toEqual({ found: true, hasField: false });
    expect(resolveRegenerateRequest({ stored: findStoredRequest(legacy, { url: 'https://leadernam.com/a/' }) })).toEqual({ origin: 'UNKNOWN' });
    expect(resolveRegenerateRequest({ stored: null }).origin).toBe('UNKNOWN');
  });
});

describe('뒤 단계 유지 (R14~R16)', () => {
  const draft = (withTable: boolean, steps: number) => ({
    introduction: '<p>도입</p>', conclusion: '<p>마무리</p>',
    sections: [{ h2: '발급', h3Sections: [{ h3: '방법', content: `<ol>${Array.from({ length: steps }, (_, i) => `<li>${i + 1}</li>`).join('')}</ol>`, tables: withTable ? [{ headers: ['구분', '온라인', '방문'], rows: [['대리', '불가', '가능']] }] : [] }] }],
  });
  test('R14 Writer 비교표 → 뒤에서 삭제 → 회귀 감지', () => {
    const c = parseUserRequirements('비교표를 반드시 넣어주세요.');
    const writer = checkUserRequirements(c, { html: draftHtml(draft(true, 4)) });
    const final = checkUserRequirements(c, { html: draftHtml(draft(false, 4)) });
    expect(writer[0]!.status).toBe('COVERED');
    expect(requirementRegressions(writer, final, 'writer→final')).toEqual([{ id: 'UR1', stage: 'writer→final', before: 'COVERED', after: 'MISSING', sourceText: '비교표를 반드시 넣어주세요.' }]);
    expect(ORCH).toContain("const regressed = requirementRegressions(writerRequirementResults, results, 'writer→final');");
  });
  test('R15 FAQ 제외 → 뒤 단계가 FAQ 를 만들려 해도 렌더 전에 비운다(생성기도 안 부름)', () => {
    expect(ORCH).toMatch(/if \(!userPlan\.faq\.enabled\) faqs = \[\];\s*else if/);
    expect(ORCH.indexOf('if (!userPlan.faq.enabled) faqs = [];')).toBeLessThan(ORCH.indexOf('html += buildFAQHtml(faqs);'));
  });
  test('R16 Writer 4단계 → 수리 뒤 3단계 → 최종 MISSING + 회귀', () => {
    const c = parseUserRequirements('4단계로 설명해주세요.');
    const writer = checkUserRequirements(c, { html: draftHtml(draft(false, 4)) });
    const final = checkUserRequirements(c, { html: draftHtml(draft(false, 3)) });
    expect(writer[0]!.status).toBe('COVERED');
    expect(final[0]!.status).toBe('MISSING');
    expect(requirementRegressions(writer, final, 'writer→final')).toHaveLength(1);
  });
});

describe('발행 판단 (R17~R20)', () => {
  test('R17 MUST 누락 → 보류 · 품질 루프 OFF 여도 enforced', () => {
    const g = requirementGate(status('비교표를 반드시 넣어주세요.', '<p>없음</p>'));
    expect(g.pass).toBe(false);
    expect(ORCH).toContain('USER_REQUIREMENT_PASS: userGate.pass,');
    expect(ORCH).toContain('const publishEnforced = qualityLoopOn || !criticalGate.pass || !surfaceGate.pass || !userGate.pass;');
  });
  test('R18 EXCLUDE 위반 → 보류', () => {
    expect(requirementGate(status('FAQ는 넣지 마세요.', '<details><summary>Q</summary>A</details>')).pass).toBe(false);
  });
  test('R19 PREFER 미충족 → 기존 발행 판단 유지(관문 통과)', () => {
    expect(requirementGate(status('되도록 쉽게 설명해주세요. 가능하면 표로 정리해주세요.', '<p>본문</p>')).pass).toBe(true);
  });
  test('R20 "지원금은 100만원이라고 써주세요" · 공식 50만원 → 100만원 쓰지 않음 · CONFLICTS_WITH_EVIDENCE · 보류', () => {
    const req = '지원금은 100만원이라고 써주세요.';
    const c = parseUserRequirements(req);
    expect(c.requirements[0]!.directive).toEqual({ kind: 'ASSERT_VALUE', values: ['100만원'] });
    expect(hypotheticalInputs(c)).toEqual([]);   // 가정 입력이 아니다 — 사실 필터가 그대로 대조한다
    const evidenceText = '지원금은 1인당 50만원입니다.';
    const safe = status(req, '<p>지원금은 1인당 50만원입니다.</p>', { evidenceText });
    expect(safe[0]!.status).toBe('CONFLICTS_WITH_EVIDENCE');
    expect(requirementGate(safe).pass).toBe(false);
    expect(status(req, '<p>지원금은 100만원입니다.</p>', { evidenceText })[0]!.status).toBe('CONTRADICTED');
    // 요청 속 값은 근거가 아니다 — 본문 관문은 100만원을 근거 없음으로 본다
    expect(checkClaims('지원금은 100만원입니다.', ledgerFromItems([{ id: 'E01', text: evidenceText }])).unsupported).toContain('100만원');
    // 근거와 같은 값이면 COVERED
    expect(status('지원금은 50만원이라고 써주세요.', '<p>지원금은 50만원입니다.</p>', { evidenceText })[0]!.status).toBe('COVERED');
  });
});

describe('캡처·전달 배선', () => {
  test('옛 반자동 탭 · 요청 주입은 경험 try 밖 맨 끝 · trace 다섯 종', () => {
    expect(read('electron/ui/modules/semi-auto.js')).toMatch(/userRequest: \(document\.getElementById\('userRequestNote'\)\?\.value \|\| ''\)\.trim\(\) \|\| undefined,/);
    const injection = ORCH.indexOf("const requestBlock = buildUserRequestBlock(userRequestRaw);");
    expect(injection).toBeGreaterThan(ORCH.indexOf('📖 **읽기 편하게 쓰는 법'));
    expect(injection).toBeLessThan(ORCH.indexOf("const draftModelSnap = require('./model-use').snapshotModels();"));
    // 본문 주입은 한 곳(제목·소제목은 각자 같은 정본 블록을 쓴다 — 중복 주입 아님)
    expect(ORCH.split('scopedSectionBlock += requestBlock;').length - 1).toBe(1);
    for (const ev of ['user-requirement.capture', 'user-requirement.contract', 'user-requirement.writer', 'user-requirement.final', 'user-requirement.publish']) expect(ORCH).toContain(`trace.event('${ev}'`);
  });
  test('표 상한은 기본값 3 · 명시 요청이 이긴다(표 5개 → 5 · 표 빼기 → 0)', () => {
    expect(structurePlan(null).maxTables).toBe(3);
    expect(structurePlan(parseUserRequirements('표 5개 넣어주세요.')).maxTables).toBe(5);
    expect(structurePlan(parseUserRequirements('표는 빼주세요.')).maxTables).toBe(0);
    expect(ORCH).toContain('const MAX_TABLES = userPlan.maxTables;');
  });
  test('요청이 없으면 예전 동작 — 계약 빈 결과 · 관문 통과 · FAQ 기본 5개', () => {
    const c = parseUserRequirements('');
    expect(c.requirements).toEqual([]);
    expect(checkUserRequirements(c, { html: '<p>x</p>' })).toEqual([]);
    expect(structurePlan(c)).toMatchObject({ faq: { enabled: true, count: 5, explicit: false }, maxTables: 3, cta: { enabled: true, explicit: false } });
    expect(buildUserRequestBlock('')).toBe('');
  });
});
