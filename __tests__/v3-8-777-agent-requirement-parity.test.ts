/**
 * v3.8.777 — AGENT MODE USER REQUIREMENT PARITY
 *
 * 에이전트 모드도 일반(반자동·풀오토)과 **같은 계약**(parseUserRequirements)·같은 판정(checkUserRequirements·requirementGate)을 쓰고,
 * 같은 발행 창구(publishGeneratedContent)에서 보류된다. 새 파서 없음 · 호출 0 · 실제 생성·검색 0.
 */
jest.mock('electron', () => ({ app: { getPath: jest.fn(() => '.tmp-tests/test-agent-777'), isPackaged: false } }));
// src/core/index 가 끌어오는 ESM 전용 패키지 — 발행 창구 앞단만 부르므로 빈 껍데기로 충분하다
jest.mock('p-queue', () => ({ __esModule: true, default: class { add(fn: () => unknown) { return fn(); } } }));
jest.mock('p-limit', () => ({ __esModule: true, default: () => (fn: () => unknown) => fn() }));
// 실제 발행이 새지 않게 — 창구를 지난 글도 없는 플랫폼에서 멈추지만, HTTP 라이브러리 자체도 막아 둔다
jest.mock('axios', () => { const blocked = () => Promise.reject(new Error('network blocked in test')); const a = Object.assign(blocked, { get: blocked, post: blocked, put: blocked, request: blocked, create: () => a, defaults: { headers: { common: {} } }, interceptors: { request: { use: () => 0 }, response: { use: () => 0 } } }); return { __esModule: true, default: a, ...a }; });

import * as fs from 'fs';
import * as path from 'path';
import { parseUserRequirements, writerRequirementBlock } from '../src/core/final/user-requirement';
import { checkUserRequirements, requirementGate } from '../src/core/final/user-requirement-coverage';
import { buildUserRequestBlock } from '../src/core/final/user-request';
import {
  captureAgentRequirements, agentInstructionsBlock, agentPlanOverrides, withRequirements, agentTableCap, agentDelivery,
  agentEvaluationView, evaluateAgentRequirements, rememberAgentEvidence, agentPublishCheck, clearAgentEvidence, countOfficialSources,
} from '../src/core/final/agent-requirement';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const MAIN = read('electron/main.ts');
const INDEX = read('src/core/index.ts');
const WORKSHOP = read('electron/ui/modules/codex-workshop.js');
const POSTING = read('electron/ui/modules/posting.js');
const PREVIEW = read('electron/ui/modules/preview.js');
const between = (src: string, start: string, end: string) => { const a = src.indexOf(start); expect(a).toBeGreaterThan(-1); const b = src.indexOf(end, a + start.length); expect(b).toBeGreaterThan(a); return src.slice(a, b); };

const KEYWORD = '인감증명서 온라인 발급 가능한 용도 대리인 발급 여부';
const REQUEST = [
  '온라인·방문·대리 발급 차이를 비교표 1개로 정리해주세요.',
  '온라인 발급 방법을 정확히 4단계로 설명해주세요.',
  'FAQ는 넣지 마세요.',
  '온라인 발급이 불가능한 용도도 반드시 설명해주세요.',
  '정부24 공식 발급 페이지로 연결되는 CTA를 넣어주세요.',
].join('\n');
const GOOD_URL = 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13100000025';

const TABLE = '<table><tr><th>구분</th><th>신청 가능자</th><th>적용 범위</th></tr><tr><td>온라인</td><td>본인</td><td>일반용</td></tr><tr><td>방문</td><td>본인</td><td>모든 용도</td></tr><tr><td>대리</td><td>위임받은 대리인</td><td>방문 발급</td></tr></table>';
const STEPS = (n: number) => `<ol>${Array.from({ length: n }, (_, i) => `<li>${i + 1}번째 절차를 진행합니다.</li>`).join('')}</ol>`;
const USES = '<h2>온라인 발급이 불가능한 용도</h2><p>온라인 발급이 불가능한 용도는 부동산 매도용, 자동차 매도용, 법원·금융기관 제출용입니다.</p>';
// 에이전트 지시서 25번 CTA 박스 그대로(클래스 없는 인라인 버튼)
const AGENT_CTA = (url: string, text: string) => `<div style="background:linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%);padding:22px 26px;"><div style="text-align:center;margin-top:4px;"><a href="${url}" rel="nofollow noopener" target="_blank" style="display:inline-block;padding:13px 30px;background:#f59e0b;color:#ffffff;border-radius:10px;">${text} →</a></div></div>`;
const API_CTA = (url: string, text: string) => `<p><a class="cta-btn" href="${url}">${text}</a></p>`;
const FAQ_BLOCK = '<h2 style="color:#111"><span>❓</span> 자주 묻는 질문</h2><div><strong>Q. 대리 발급되나요?</strong><p>방문하면 됩니다.</p></div><script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[]}</script>';
const SKIN = '<style>.bgpt-content h2{color:#222} details summary{cursor:pointer}</style>';
const article = (parts: { table?: boolean; steps?: number; faq?: boolean; cta?: string; uses?: boolean }) => [
  SKIN, '<article class="bgpt-wp-ready bgpt-codex-workshop bgpt-content">', `<h1>${KEYWORD}</h1>`,
  '<h2>온라인·방문·대리 발급 비교</h2>', parts.table === false ? '<p>세 방식은 신청 가능자가 다릅니다.</p>' : TABLE,
  '<h2>온라인 발급 방법</h2>', STEPS(parts.steps ?? 4),
  parts.uses === false ? '' : USES,
  parts.faq ? FAQ_BLOCK : '',
  parts.cta ?? AGENT_CTA(GOOD_URL, '정부24에서 인감증명서 발급하기'),
  '</article>',
].join('\n');
const agentPayload = (extra: Record<string, unknown> = {}) => ({ topic: KEYWORD, userRequest: REQUEST, codexWorkshop: true, provider: 'codex-workshop', previewOnly: false, ...extra });

beforeEach(() => clearAgentEvidence());

describe('1·2 입력 시점 — 같은 공통 함수로 같은 계약', () => {
  test('에이전트 계약 = parseUserRequirements 결과 그대로(지문·요구·원문·정규화) · 요청 없으면 null', () => {
    const api = parseUserRequirements(REQUEST);
    const agent = captureAgentRequirements(REQUEST)!;
    expect(agent.contract).toEqual(api);
    expect(agent.contract.fingerprint).toBe('ed8f9afb');
    expect(agent.contract.requirements.map((r) => `${r.id} ${r.priority} ${r.type} ${r.directive.kind}`)).toEqual([
      'UR1 MUST STRUCTURE TABLE', 'UR2 MUST STRUCTURE STEPS', 'UR3 EXCLUDE STRUCTURE FAQ', 'UR4 MUST CONTENT TOPIC', 'UR5 MUST CTA CTA',
    ]);
    expect(captureAgentRequirements('')).toBeNull();
    expect(captureAgentRequirements(undefined)).toBeNull();
    expect(captureAgentRequirements('   \n ')).toBeNull();
  });
  test('main 의 에이전트 경로가 입력 시점에 계약을 만든다(지시서 파일을 쓰기 전) · 새 파서 없음', () => {
    const job = between(MAIN, "ipcMain.handle('agent-mode:run-job'", 'const usage = parseAgentRunUsage(profile.provider, run.stdout);');
    const capture = job.indexOf("agentReqMod.captureAgentRequirements(request?.payload?.userRequest)");
    expect(capture).toBeGreaterThan(-1);
    expect(capture).toBeLessThan(job.indexOf('writeAgentJobFiles(jobDir, request || {}, profile);'));
    expect(job).toContain("user-requirement.capture");
    expect(job).toContain("user-requirement.contract");
    // 에이전트 전용 파서·정규식이 새로 생기지 않았다 — 새 모듈은 공통 함수를 import 한다
    const mod = read('src/core/final/agent-requirement.ts');
    expect(mod).toContain("from './user-requirement'");
    expect(mod).not.toMatch(/function parse\w*\(|EXCLUDE_RE|FAQ_RE|STEPS_RE/);
  });
});

describe('3·5 에이전트 계획보다 사용자 요구가 우선 — 약화 금지', () => {
  const cap = captureAgentRequirements(REQUEST)!;
  const block = agentInstructionsBlock(cap);
  test('지시서 블록 = API Writer 정본 블록(원문 1회) + 에이전트 우선순위 + 기본 규칙과 부딪히는 곳', () => {
    expect(block.startsWith(writerRequirementBlock(cap.contract))).toBe(true);
    expect(buildUserRequestBlock(REQUEST)).toBe(writerRequirementBlock(cap.contract));   // API 경로 Writer 블록과 같은 글
    expect(block.split('<<작성자 요청 시작>>').length - 1).toBe(1);                      // 원문은 한 번만
    expect(block).toContain('사실 근거·안전 > 작성자 명시 요구 > 당신(에이전트)의 계획·판단 > 검색 의도 > 이 지시서의 기본 편집 규칙');
    expect(block).toContain('EXCLUDE 는 EXCLUDE 그대로("최소화" 아님)');
    expect(block).toContain('숫자 조건은 그 숫자 그대로');
  });
  test('기본 규칙과 부딪히는 곳을 계획에서 만든다: FAQ 0개(S10·S14·"자주 묻는 질문" 뼈대까지) · 비교표 최소 1 · 정확히 4단계 · 발급 CTA · 불가 용도', () => {
    const o = agentPlanOverrides(cap).join('\n');
    expect(o).toContain('FAQ 를 만들지 않는다');
    expect(o).toContain('FAQ 박스(S10), FAQPage 스키마(S14)');
    expect(o).toContain('"FAQ 최소화" 가 아니라 0개다');
    expect(o).toContain('본문 표(<table>)를 최소 1개 — 요청한 대상들을 행·열로 나란히 비교하는 표');
    expect(o).toContain('설명만으로 충분하다고 판단해도 뺄 수 없다');
    expect(o).toContain('단계는 정확히 4개: 번호 목록 <ol> 하나에 <li> 4개');
    expect(o).toContain('5단계로 늘리지 않는다');
    expect(o).toContain('버튼 글자에 "발급" 을 넣는다');
    expect(o).toContain('홈 첫 화면·다른 서비스·블로그 X');
    expect(o).toContain('"온라인 발급이 불가능한 용도" 을 전용 소제목');
  });
  test('요청이 없거나 구조 요구가 없으면 덮어쓰기 줄 없음(예전 지시서 그대로)', () => {
    expect(agentInstructionsBlock(null)).toBe('');
    expect(agentPlanOverrides(captureAgentRequirements('초보자도 이해하기 쉽게 써주세요.')!)).toEqual([]);
  });
  test('main 지시서: 맨 끝 요청 블록이 agentInstructionsBlock(같은 계약)으로 바뀌었고 옛 buildUserRequestBlock 호출은 없다', () => {
    const fn = between(MAIN, 'function buildAgentJobInstructions(', 'function writeAgentJobFiles(');
    expect(fn).toContain('agentInstructionsBlock(captureAgentRequirements(payload?.userRequest))');
    expect(fn).not.toContain('buildUserRequestBlock(');
    expect(fn.lastIndexOf('agentInstructionsBlock(')).toBeGreaterThan(fn.lastIndexOf('buildAgentHarnessRules('));   // 맨 끝
  });
  test('전달 확인 — 지시서에 원문과 요구마다 계약 줄이 있으면 DELIVERED, 빠지면 MISSING', () => {
    const instructions = `# 지시서\n- FAQ + 결론·면책 섹션 포함\n${block}`;
    expect(agentDelivery(instructions, cap).map((d) => d.status)).toEqual(['DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED']);
    expect(agentDelivery(instructions.replace('- [EXCLUDE] FAQ 없음(본문 FAQ 절·FAQ 블록 모두)', ''), cap).find((d) => d.id === 'UR3')!.status).toBe('MISSING');
    expect(agentDelivery('# 지시서만', cap).every((d) => d.status === 'MISSING')).toBe(true);
    const job = between(MAIN, 'writeAgentJobFiles(jobDir, request || {}, profile);', 'const lastMessagePath');
    expect(job).toContain("agentReqMod.agentDelivery(fs.readFileSync(path.join(jobDir, 'instructions.md'), 'utf-8'), agentReq)");
    expect(job).toContain('user-requirement.writer');
  });
  test('약화된 계획의 결과는 최종 판정에서 잡힌다: "FAQ 최소화"(FAQ 1개) → CONTRADICTED · "단계별로"(5단계) → MISSING', () => {
    const minimised = evaluateAgentRequirements({ capture: cap, html: article({ faq: true }) });
    expect(minimised.results.find((r) => r.id === 'UR3')!.status).toBe('CONTRADICTED');
    const vague = evaluateAgentRequirements({ capture: cap, html: article({ steps: 5 }) });
    expect(vague.results.find((r) => r.id === 'UR2')!.status).toBe('MISSING');
    expect(minimised.gate.pass).toBe(false);
    expect(vague.gate.pass).toBe(false);
  });
});

describe('4·6 하위 작업·구조 — 같은 계약을 잃지 않는다', () => {
  const cap = captureAgentRequirements(REQUEST)!;
  test('하위 작업 프롬프트는 압축 계약을 앞에 붙인다 — 원문 긴 문장은 되풀이하지 않는다', () => {
    const p = withRequirements('# 지금 이 구간의 HTML\n<p>본문</p>', cap);
    expect(p.startsWith('## 📌 작성자 명시 요구(계약)')).toBe(true);
    expect(p).toContain('- [EXCLUDE] FAQ 없음(본문 FAQ 절·FAQ 블록 모두)');
    expect(p).toContain('- [MUST] 정확히 4단계');
    expect(p).not.toContain('<<작성자 요청 시작>>');
    expect(p.endsWith('<p>본문</p>')).toBe(true);
    expect(withRequirements('원래 프롬프트', null)).toBe('원래 프롬프트');
    const job = between(MAIN, "const { fixBeforePublish } = require('../dist/core/final/pre-publish-fix');", "[AGENT-PREFLIGHT] 건너뜀");
    expect(job).toContain('agentReqMod.withRequirements(prompt, agentReq)');
  });
  test('표 상한: 계약 없음 3 · "표 5개" 5 · "표 빼주세요" 0 — API 경로 MAX_TABLES 와 같은 structurePlan', () => {
    expect(agentTableCap(null)).toBe(3);
    expect(agentTableCap(cap)).toBe(3);
    expect(agentTableCap(captureAgentRequirements('표 5개로 정리해주세요.'))).toBe(5);
    expect(agentTableCap(captureAgentRequirements('표는 빼주세요.'))).toBe(0);
    expect(MAIN).toContain('capInlineTables([polished], agentReqMod ? agentReqMod.agentTableCap(agentReq) : 3)');
    expect(MAIN).not.toContain('capInlineTables([polished], 3)');
  });
  test('에이전트 CTA(클래스 없는 25번 인라인 버튼)를 판정용 보기에서만 CTA 로 본다 — 발행 본문은 그대로', () => {
    const html = article({});
    const view = agentEvaluationView(html);
    expect(view).toContain(`<a class="cta-btn" href="${GOOD_URL}"`);
    expect(html).not.toContain('cta-btn');
    // 출처 카드·본문 인라인 링크는 CTA 가 아니다
    const cards = '<a href="https://www.korea.kr/x" style="display:flex;align-items:center;background:#fafafa">기사</a><p><a href="https://www.gov.kr/">정부24</a></p>';
    expect(agentEvaluationView(cards)).not.toContain('cta-btn');
    // 소제목 안쪽 태그를 걷어 FAQ 소제목을 알아본다
    expect(agentEvaluationView(FAQ_BLOCK)).toContain('<h2 style="color:#111">❓ 자주 묻는 질문</h2>');
  });
  test('공식 출처 수는 근거 속 주소의 공식 호스트로 센다', () => {
    expect(countOfficialSources('E04 https://www.gov.kr/main?a=1 · E14 https://www.korea.kr/news/1 · 블로그 https://blog.naver.com/x · 다시 https://www.gov.kr/b')).toBe(2);
    expect(countOfficialSources('')).toBe(0);
  });
});

describe('8 최종 판정 — 같은 모듈 · 11 에이전트 회귀', () => {
  const cap = captureAgentRequirements(REQUEST)!;
  const status = (html: string, evidenceText = '') => evaluateAgentRequirements({ capture: cap, html, evidenceText }).results.map((r) => `${r.id}=${r.status}`).join(' ');
  test('계약을 지킨 에이전트 글 → 다섯 요구 COVERED · 통과', () => {
    const ev = evaluateAgentRequirements({ capture: cap, html: article({}) });
    expect(ev.results.map((r) => r.status)).toEqual(['COVERED', 'COVERED', 'COVERED', 'COVERED', 'COVERED']);
    expect(ev.gate.pass).toBe(true);
  });
  test('FAQ 임의 추가 → EXCLUDE 위반(보이는 FAQ 소제목·FAQPage JSON-LD)', () => {
    expect(status(article({ faq: true }))).toContain('UR3=CONTRADICTED');
  });
  test('표 삭제 → MUST MISSING · 에이전트 원본에는 있었으면 후처리 손실(회귀)', () => {
    const ev = evaluateAgentRequirements({ capture: cap, html: article({ table: false }), baselineHtml: article({}) });
    expect(ev.results.find((r) => r.id === 'UR1')!.status).toBe('MISSING');
    expect(ev.regressions).toEqual([{ id: 'UR1', stage: 'agent→final', before: 'COVERED', after: 'MISSING', sourceText: '온라인·방문·대리 발급 차이를 비교표 1개로 정리해주세요.' }]);
    expect(ev.gate.pass).toBe(false);
  });
  test('4단계 → 5단계 → MISSING · 3단계도 MISSING', () => {
    expect(status(article({ steps: 5 }))).toContain('UR2=MISSING');
    expect(status(article({ steps: 3 }))).toContain('UR2=MISSING');
  });
  test('잘못된 CTA(혜택 조회 포털) → CONTRADICTED · CTA 없음 → MISSING · 둘 다 blocker', () => {
    const wrong = evaluateAgentRequirements({ capture: cap, html: article({ cta: AGENT_CTA('https://plus.gov.kr/portal/benefitV2/', '정부24에서 조회 안내 확인') }) });
    expect(wrong.results.find((r) => r.id === 'UR5')!.status).toBe('CONTRADICTED');
    expect(wrong.gate.blockers.map((b) => b.id)).toEqual(['UR5']);
    const none = evaluateAgentRequirements({ capture: cap, html: article({ cta: '' }) });
    expect(none.results.find((r) => r.id === 'UR5')!.status).toBe('MISSING');
  });
  test('사실 요구가 공식 근거와 충돌 → 100만원 안 씀이면 CONFLICTS_WITH_EVIDENCE · 썼으면 CONTRADICTED · 둘 다 보류', () => {
    const c = captureAgentRequirements('지원금은 100만원이라고 써주세요.')!;
    const evidence = '공식 공고 https://www.gov.kr/notice 지원금 50만원';
    const kept = evaluateAgentRequirements({ capture: c, html: '<p>지원금은 50만원입니다.</p>', evidenceText: evidence });
    expect(kept.results[0]!.status).toBe('CONFLICTS_WITH_EVIDENCE');
    expect(kept.gate.pass).toBe(false);
    const wrote = evaluateAgentRequirements({ capture: c, html: '<p>지원금은 100만원입니다.</p>', evidenceText: evidence });
    expect(wrote.results[0]!.status).toBe('CONTRADICTED');
    expect(wrote.gate.pass).toBe(false);
  });
  test('main: 후처리(스킨)까지 끝난 뒤 판정 · 근거 기억 · 작업 폴더 기록 · 응답에 판정 — 발행 결정은 발행 창구가 한다', () => {
    const tail = between(MAIN, "const { applyOrbitSkinToAgentHtml } = require('../dist/core/final/agent-skin');", 'const usage = parseAgentRunUsage(profile.provider, run.stdout);');
    expect(tail).toContain('agentReqMod.evaluateAgentRequirements({ capture: agentReq, html: String(result.content || \'\'), baselineHtml: agentDeliveredHtml, evidenceText })');
    expect(tail).toContain('agentReqMod.rememberAgentEvidence(agentReq.contract.fingerprint, agentReqKeyword, evidenceText)');
    expect(tail).toContain("user-requirement.final");
    expect(tail).toContain("user-requirement.publish");
    expect(tail).toContain("'user-requirement.json'");
    expect(MAIN).toContain('const agentDeliveredHtml = String(result.content || \'\');');
    expect(MAIN).toContain('...(agentUserRequirement ? { userRequirement: agentUserRequirement } : {}),');
  });
});

describe('8·9 발행 창구 — 에이전트라고 우회 금지 · forcePublish 는 명시적 사용자 승인만', () => {
  test('agentPublishCheck: 에이전트 글 + 요청이 있을 때만 적용 · 실제 본문(이미지 들어간 뒤)으로 다시 잰다', () => {
    const images = article({}).replace('<h2>온라인 발급 방법</h2>', '<figure><img src="https://cdn.example/x.png"></figure><h2>온라인 발급 방법</h2>');
    expect(agentPublishCheck(agentPayload(), images)).toMatchObject({ applies: true, pass: true });
    const wrong = agentPublishCheck(agentPayload(), article({ faq: true }));
    expect(wrong).toMatchObject({ applies: true, pass: false });
    expect(wrong.reason).toContain('UR3 EXCLUDE STRUCTURE');
  });
  test('일반(API) 글은 적용 안 함(applies=false) — 776 관문·지문 장부 그대로 · 요청 없는 에이전트 글도 적용 안 함', () => {
    expect(agentPublishCheck({ topic: KEYWORD, userRequest: REQUEST }, article({ faq: true })).applies).toBe(false);
    expect(agentPublishCheck({ topic: KEYWORD, userRequest: REQUEST, codexWorkshop: 'true' }, article({ faq: true })).applies).toBe(false);
    expect(agentPublishCheck(agentPayload({ userRequest: '' }), article({ faq: true })).applies).toBe(false);
  });
  test('근거: 회수 시점에 기억한 근거로 값 단정을 잰다 · 기억이 없으면(앱 재시작·붙여넣기) 보수적으로 보류', () => {
    const req = '지원금은 50만원이라고 써주세요.';
    const payload = agentPayload({ userRequest: req });
    const html = '<p>지원금은 50만원입니다.</p>';
    expect(agentPublishCheck(payload, html)).toMatchObject({ applies: true, pass: false, evidence: 'NONE' });
    rememberAgentEvidence(captureAgentRequirements(req)!.contract.fingerprint, KEYWORD, '공식 공고 https://www.gov.kr/n 지원금 50만원');
    expect(agentPublishCheck(payload, html)).toMatchObject({ applies: true, pass: true, evidence: 'REMEMBERED' });
    // 다른 키워드의 근거는 쓰지 않는다
    expect(agentPublishCheck({ ...payload, topic: '다른 키워드' }, html)).toMatchObject({ pass: false, evidence: 'NONE' });
  });
  test('publishGeneratedContent(실제 함수): 어긴 글은 플랫폼 전에 MANUAL_REVIEW · "true" 문자열은 우회 아님 · 지킨 글·명시적 true 는 창구를 지난다', async () => {
    // 창구를 지나면 플랫폼 분기로 간다 — 없는 플랫폼 이름으로 "알 수 없는 플랫폼" 에서 멈추게 하고, 네트워크도 막는다(실제 발행 0)
    const realFetch = global.fetch;
    global.fetch = jest.fn(async () => { throw new Error('network blocked in test'); }) as unknown as typeof fetch;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { publishGeneratedContent } = require('../src/core/index');
      const logs: string[] = [];
      const run = (extra: Record<string, unknown>, html: string) => publishGeneratedContent(agentPayload({ platform: 'test-noop-777', ...extra }), KEYWORD, html, '', (m: string) => logs.push(m));
      const r1 = await run({}, article({ faq: true }));
      expect(r1).toMatchObject({ ok: false, blockedReason: 'MANUAL_REVIEW', recoverable: true });
      expect(r1.error).toContain('에이전트 글이 작성자 요구를 지키지 않아');
      const r2 = await run({ forcePublish: 'true' }, article({ steps: 5 }));
      expect(r2).toMatchObject({ ok: false, blockedReason: 'MANUAL_REVIEW' });
      const passed = await run({}, article({}));
      expect(passed.blockedReason).toBeUndefined();
      expect(passed.error).toBe('알 수 없는 플랫폼: test-noop-777');
      const forced = await run({ forcePublish: true }, article({ faq: true }));
      expect(forced.blockedReason).toBeUndefined();
      expect(logs.some((l) => l.includes('forcePublished=true — 에이전트 글의 작성자 요구 보류를 사람이 승인해 발행합니다'))).toBe(true);
      expect(logs.filter((l) => l.includes('🛑')).length).toBe(2);
      expect(global.fetch).not.toHaveBeenCalled();
    } finally {
      global.fetch = realFetch;
    }
  });
  test('창구 순서: 기존 지문 관문 다음 · 플랫폼 결정 앞 · 명시적 true 만 우회하고 우회는 기록', () => {
    const fn = between(INDEX, 'export async function publishGeneratedContent(', "let platform = payload?.platform || payload?.targetPlatform");
    const hold = fn.indexOf("checkPublishDecision(html)");
    const agent = fn.indexOf("agentPublishCheck(payload, html)");
    expect(hold).toBeGreaterThan(-1);
    expect(agent).toBeGreaterThan(hold);
    expect(fn).toContain('const agentForced = payload?.forcePublish === true;');   // 747 계약: === true 로만 판정
    expect(fn).toContain("recordPublishOverride('forcePublish', title, agentCheck.reason)");
  });
  test('에이전트 결과는 payload 에 닿지 않는다 — 결과·메타데이터가 forcePublish 를 켤 길이 없다', () => {
    for (const src of [WORKSHOP, PREVIEW]) expect(src).not.toMatch(/\bforcePublish\b/);   // _enforcePublishGap(발행 간격)은 다른 낱말
    // v3.8.778 — posting.js 의 forcePublish 는 publishToPlatform 의 사람 승인 인자 하나뿐(그 밖의 곳엔 없다). 자세한 것은 778 T6
    const postingCode = POSTING.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const outsidePublish = postingCode
      .replace(between(postingCode, 'export async function publishToPlatform(options) {', 'const titleToPublish'), '')
      .replace(between(postingCode, 'renderForcePublishOffer(document, result, {', 'return result || { ok: false, error: publishError };'), '');
    expect(outsidePublish).not.toMatch(/\bforcePublish\b/);
    const job = between(MAIN, "ipcMain.handle('agent-mode:run-job'", "ipcMain.handle('transform-content'");
    expect(job).not.toMatch(/\bforcePublish\b/);
    // 화면에 싣는 payload 는 화면 payload(state.payload) + 표시뿐이다
    const apply = between(WORKSHOP, 'export async function applyCodexResult(', 'export function initCodexWorkshop(');
    expect(apply).toContain('appState.generatedContent.payload = {\n      ...payload,\n      provider: \'codex-workshop\',\n      codexWorkshop: true,');
    expect(apply).not.toContain('metadata');
  });
});

describe('7 재시도·재사용 — 원래 계약 보존 · 같은 키워드 + 다른 요청은 재사용 금지', () => {
  test('짧은 글 재시도는 같은 payload 를 펼친다(userRequest 유지 → main 이 같은 계약을 다시 만든다)', () => {
    const retry = between(WORKSHOP, 'const retryPayload = {', 'const retryResult');
    expect(retry).toContain('...payload,');
    expect(retry).not.toMatch(/userRequest\s*:/);
  });
  test('작업실 모달: 열 때 만든 payload 가 지금 키워드·요청과 다르면 새로 만든다', () => {
    const fn = between(WORKSHOP, 'function isSavedPayloadCurrent(saved) {', 'async function runAgentJob(');
    expect(fn).toContain("sameUserRequest(saved.userRequest, document.getElementById('userRequestNote')?.value)");
    expect(fn).toContain('keyword !== savedKeyword');
    expect(WORKSHOP).toContain('const payload = inputPayload || (isSavedPayloadCurrent(state.payload) ? state.payload : null) || await createPreviewPayload();');
    expect(WORKSHOP).toContain("import { createPreviewPayload, sameUserRequest } from './posting.js';");
  });
  test('에이전트 글도 776 재사용 가드를 탄다 — 적용된 payload 에 원래 userRequest 가 실린다', () => {
    // applyCodexResult 가 payload 를 펼쳐 싣고(위 테스트), publishToPlatform 은 그 payload.userRequest 와 화면 값을 비교한다
    const pub = between(POSTING, 'export async function publishToPlatform(options)','const currentPayload = await createPayload({ previewOnly: false });');
    expect(pub).toContain("!sameUserRequest(appState.generatedContent.payload?.userRequest, document.getElementById('userRequestNote')?.value)");
    const semi = between(PREVIEW, "if (executionMode === 'agent') {", 'runAgentJobFromPosting(payload)');
    expect(semi.length).toBeGreaterThan(0);
    expect(POSTING).toContain('const agentResult = await window.runAgentJobFromPosting(payload);');
  });
});

describe('10 합성 동등성 — 반자동 · 풀오토 · 에이전트가 같은 계약·같은 판정·같은 발행 결정', () => {
  // 반자동·풀오토는 같은 orchestration 을 탄다(payload 빌더만 다르다: createPreviewPayload / createPayload). 둘 다 #userRequestNote 를 읽는다
  const apiHtml = (parts: Parameters<typeof article>[0]) => article({ ...parts, cta: parts.cta ?? API_CTA(GOOD_URL, '정부24에서 인감증명서 발급하기') });
  const apiPath = (html: string) => {
    const contract = parseUserRequirements(REQUEST);
    const results = checkUserRequirements(contract, { html });
    return { fingerprint: contract.fingerprint, writer: buildUserRequestBlock(REQUEST), statuses: results.map((r) => `${r.id}=${r.status}`), publish: requirementGate(results).pass ? 'PASS' : 'HELD' };
  };
  const agentPath = (html: string) => {
    const cap = captureAgentRequirements(REQUEST)!;
    const block = agentInstructionsBlock(cap);
    const ev = evaluateAgentRequirements({ capture: cap, html });
    const window = agentPublishCheck(agentPayload(), html);
    return { fingerprint: cap.contract.fingerprint, writer: block, delivery: agentDelivery(block, cap), statuses: ev.results.map((r) => `${r.id}=${r.status}`), publish: window.pass ? 'PASS' : 'HELD' };
  };
  test('CAPTURE — 세 경로의 payload 필드는 모두 userRequest(화면 #userRequestNote)', () => {
    expect(POSTING).toContain("userRequest: (document.getElementById('userRequestNote')?.value?.trim() || undefined),");
    expect(read('src/core/final/orchestration.ts')).toContain('const userRequestRaw: unknown = payload?.userRequest;');
    expect(MAIN).toContain('captureAgentRequirements(request?.payload?.userRequest)');
  });
  const cases: Array<[string, Parameters<typeof article>[0], string]> = [
    ['계약 준수', {}, 'PASS'],
    ['FAQ 추가', { faq: true }, 'HELD'],
    ['표 삭제', { table: false }, 'HELD'],
    ['5단계', { steps: 5 }, 'HELD'],
    ['CTA 없음', { cta: '' }, 'HELD'],
    // 제목(H1)에 "온라인·발급" 이 있어 UR4 는 PARTIAL — 776 설계상 내용 PARTIAL 은 보류 사유가 아니다. 두 경로가 같게 판정하는지만 본다
    ['불가 용도 절 누락(내용 PARTIAL)', { uses: false }, 'PASS'],
  ];
  test.each(cases)('%s — CONTRACT·WRITER/AGENT DELIVERY·FINAL COVERAGE·PUBLISH DECISION 이 같다', (_name, parts, decision) => {
    const api = apiPath(apiHtml(parts));
    const agent = agentPath(article(parts));
    expect(agent.fingerprint).toBe(api.fingerprint);
    expect(agent.writer.startsWith(api.writer)).toBe(true);
    expect(agent.delivery.every((d) => d.status === 'DELIVERED')).toBe(true);
    expect(agent.statuses).toEqual(api.statuses);
    expect(agent.publish).toBe(api.publish);
    expect(agent.publish).toBe(decision);
  });
  test('잘못된 CTA — 두 경로 모두 UR5 CONTRADICTED · 보류', () => {
    const api = apiPath(apiHtml({ cta: API_CTA('https://plus.gov.kr/portal/benefitV2/', '정부24에서 조회 안내 확인') }));
    const agent = agentPath(article({ cta: AGENT_CTA('https://plus.gov.kr/portal/benefitV2/', '정부24에서 조회 안내 확인') }));
    expect(api.statuses).toContain('UR5=CONTRADICTED');
    expect(agent.statuses).toEqual(api.statuses);
    expect([api.publish, agent.publish]).toEqual(['HELD', 'HELD']);
  });
});
