#!/usr/bin/env node
/**
 * 근거 파이프라인 회귀 테스트 (v3.8.734)
 *
 * 키워드마다 실제 검색·크롤링을 돌리고 단계별 산출물을 저장한다:
 *   A. search-queries.json     실제로 나간 검색어 (창구 호출 기록)
 *   B. raw-search-results.json 검색 API 가 돌려준 RAW (제목·주소·날짜)
 *   C. cleaned-evidence.json   관련도 문을 지난 EvidenceItem (id·게시일·URL·관련도)
 *   D. rejected-evidence.json  버린 것과 이유
 *   E. research-packet.json    Research Packet
 *   F. writer-input.txt        Writer 에게 실제로 전송되는 최종 프롬프트
 *   G. final-article.html      최종 글 (--live 일 때만)
 *   metrics.json               수치 지표 · report.md 에 표로 모은다
 *
 * 사용:
 *   node scripts/evidence-regression.js --capture            # $0 — LLM 호출을 가로채 프롬프트만 저장 (패킷은 코드 추출분)
 *   node scripts/evidence-regression.js --live               # 유료 — 실제 모델로 패킷·본문까지
 *   node scripts/evidence-regression.js --live --only 2      # 두 번째 키워드만
 *   node scripts/evidence-regression.js --capture --keywords "A,B"
 *
 * 특정 키워드를 위한 예외 처리는 어디에도 없다 — 키워드 목록은 유형만 다르게 고른 것이다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const LIVE = flag('--live');
/** v3.8.736 — 비평 루프는 기본 OFF. `--loop` 를 줘야 QUALITY_LOOP=1 로 켜진다(이 프로세스에서만) */
const LOOP = flag('--loop');
if (LOOP) process.env.QUALITY_LOOP = '1';
const OUT = path.join(ROOT, 'quality-run-output', `evidence-regression-${LIVE ? 'live' : 'capture'}${LOOP ? '-loop' : ''}`);

const DEFAULT_KEYWORDS = [
  { type: '정책·지원금', keyword: '청년미래적금 2차 신청' },
  { type: '금융', keyword: '주택담보대출 금리 7% 돌파' },
  { type: '자동차', keyword: '전기차 보조금 하반기 추가 공고' },
  { type: '연예·최신이슈', keyword: '부산국제영화제 개막작 예매' },
  { type: '여행·지역', keyword: '경주 APEC 기간 숙소 예약' },
];

function pickKeywords() {
  const custom = opt('--keywords');
  let list = custom ? custom.split(',').map((k) => ({ type: '사용자 지정', keyword: k.trim() })).filter((k) => k.keyword) : DEFAULT_KEYWORDS;
  const only = Number(opt('--only') || 0);
  if (only > 0) list = list.slice(only - 1, only);
  return list;
}

const slug = (s) => String(s).replace(/[^\w가-힣]+/g, '_').slice(0, 40);

const flat = (s) => String(s || '').replace(/\s+/g, '');
const BLOCKING_TYPES = new Set(['CONTRADICTION', 'MIXED_ENTITY', 'EXPIRED_AS_CURRENT', 'UNSUPPORTED_VALUE', 'SEARCH_INTENT_MISSING', 'TITLE_PROMISE_UNMET', 'MISSING_INFORMATION', 'REDUNDANCY', 'ANSWER_TOO_LATE', 'SECTION_CONFLICT', 'INTRO_OFFTOPIC', 'HEADING_MISMATCH', 'ANSWER_NEVER_GIVEN', 'STRUCTURE_BROKEN']);
const FACT_TYPES = new Set(['CONTRADICTION', 'MISSING_INFORMATION', 'EXPIRED_AS_CURRENT', 'MIXED_ENTITY']);
const NO_SPAN_TYPES = new Set(['SEARCH_INTENT_MISSING', 'TITLE_PROMISE_UNMET', 'ANSWER_NEVER_GIVEN']);

/**
 * v3.8.736 — 모델의 CRITICAL/MAJOR 원응답이 코드 관문에서 왜 떨어졌는지 센다.
 * "Critic 이 문제를 찾았는데 exactSpan 표기가 조금 달라 전부 MINOR 로 떨어졌다" 면 가짜 수렴이다 — 그걸 보려는 표.
 * exactSpan 불일치는 원문과 비교해 공백/문장부호/조사/축약/전혀 다른 문장으로 나눈다(넓히기 전에 사례부터).
 */
function classifySpanMismatch(span, unitText, stripHtml) {
  const text = stripHtml(unitText);
  const f = flat(text);
  const s = flat(span);
  if (!s) return '빈 구절';
  if (f.includes(s)) return '일치';
  const punct = (x) => x.replace(/[.,!?'"“”‘’·()\[\]:;~\-–—…]/g, '');
  if (punct(f).includes(punct(s))) return '문장부호 차이';
  const particle = (x) => x.replace(/(은|는|이|가|을|를|에|의|로|으로|와|과|도|만|에서|까지|부터|이다|입니다|합니다)(?=[^가-힣]|$)/g, '');
  if (particle(punct(f)).includes(particle(punct(s)))) return '조사 차이';
  // 축약: 구절의 앞 8자와 뒤 8자가 원문에 이 순서로 있으면 중간을 줄여 쓴 것
  if (s.length >= 16) { const head = s.slice(0, 8); const tail = s.slice(-8); const i = f.indexOf(head); if (i >= 0 && f.indexOf(tail, i) > i) return '축약'; }
  // 부분 일치: 절반 이상의 8자 조각이 원문에 있으면 문장을 바꿔 쓴 것
  const grams = []; for (let i = 0; i + 8 <= s.length; i += 4) grams.push(s.slice(i, i + 8));
  const hit = grams.filter((g) => f.includes(g)).length;
  if (grams.length && hit / grams.length >= 0.5) return '바꿔 씀(부분 일치)';
  return '전혀 다른 문장';
}

function analyzeCritic(criticResult, draftUnits, itemIds, stripHtml) {
  if (!criticResult) return null;
  let parsed = null; try { parsed = JSON.parse(String(criticResult.raw || '').replace(/```(?:json)?/gi, '').trim()); } catch { /* 잘린 raw */ }
  const rawIssues = parsed && Array.isArray(parsed.issues) ? parsed.issues : [];
  const rawBlocking = rawIssues.filter((i) => /^(CRITICAL|MAJOR)$/i.test(String(i.severity || '')));
  const reasons = { accepted: 0, exactSpanMismatch: 0, sectionIdMismatch: 0, evidenceMissing: 0, typeNotBlocking: 0, schemaError: 0, codeAuthority: 0 };
  const mismatches = [];
  for (const x of rawBlocking) {
    const sectionId = String(x.sectionId || '').trim();
    const unit = draftUnits.find((u) => u.id === sectionId);
    const type = String(x.type || 'OTHER').toUpperCase().replace(/[^A-Z_]/g, '');
    const span = String(x.exactSpan || '').trim();
    const evidenceIds = (Array.isArray(x.evidenceIds) ? x.evidenceIds : []).map(String).filter((id) => itemIds.has(id));
    if (!unit) { reasons.sectionIdMismatch += 1; continue; }
    if (String(x.problem || '').trim().length < 10) { reasons.schemaError += 1; continue; }
    const spanFound = span.length >= 6 && flat(stripHtml(unit.text)).includes(flat(span));
    if (!spanFound && !NO_SPAN_TYPES.has(type)) {
      reasons.exactSpanMismatch += 1;
      mismatches.push({ sectionId, type, severity: x.severity, kind: classifySpanMismatch(span, unit.text, stripHtml), exactSpan: span.slice(0, 160), problem: String(x.problem || '').slice(0, 120) });
      continue;
    }
    if (FACT_TYPES.has(type) && evidenceIds.length === 0) { reasons.evidenceMissing += 1; continue; }
    if (!BLOCKING_TYPES.has(type)) { reasons.typeNotBlocking += 1; continue; }
    if (/UNSUPPORTED|근거\s*없/.test(`${type} ${x.problem || ''}`) && span) { reasons.codeAuthority += 1; continue; }
    reasons.accepted += 1;
  }
  const accepted = (criticResult.issues || []);
  return {
    parsedOk: !!parsed, status: parsed && parsed.status, model: criticResult.model || '',
    modelIssues: rawIssues.length, modelBlockingIssues: rawBlocking.length,
    acceptedBlockingIssues: accepted.filter((i) => i.severity !== 'MINOR').length,
    acceptedMinor: accepted.filter((i) => i.severity === 'MINOR').length,
    rejectedOutright: (criticResult.rejectedIssues || []).length,
    rejectedReasons: [...new Set((criticResult.rejectedIssues || []).map((r) => String(r.reason).split('(')[0].slice(0, 40)))],
    downgradeReasons: reasons,
    acceptanceRate: rawBlocking.length ? `${reasons.accepted}/${rawBlocking.length}` : 'n/a',
    exactSpanMismatches: mismatches,
    generalAdviceFlagged: rawBlocking.filter((i) => /일반|조언|상식|추천|권장|하면 좋|선택 기준/.test(String(i.problem || ''))).map((i) => ({ sectionId: i.sectionId, severity: i.severity, problem: String(i.problem).slice(0, 100) })),
  };
}

/** 단계 이름 — 프롬프트 머리로 알아본다 (llm-caller 의 __llmCallLog) */
function stageOf(head) {
  const h = String(head || '');
  if (h.startsWith('당신은 검수자입니다. 칭찬하지 않고')) return 'Critic 1';
  if (h.startsWith('당신은 검수자입니다. 이 원고는 방금')) return 'Verification';
  if (h.startsWith('당신은 편집자입니다')) return 'Editorial';
  if (h.startsWith('당신은 교정자입니다')) return 'Editor';
  if (h.startsWith('당신은 최종 심사자입니다')) return 'Final Judge';
  if (/바이럴 마케터|제목/.test(h.slice(0, 60))) return 'Title';
  if (/RESEARCH PACKET|리서치|Research Packet/i.test(h)) return 'Research Packet';
  if (/소제목|H2/.test(h)) return 'H2';
  if (/FAQ|요약표|CTA|해시태그|메타/.test(h)) return 'Aux(FAQ/요약/CTA)';
  return 'Draft/기타';
}

function costTable() {
  const { findTier } = require(path.join(ROOT, 'dist/core/llm/pricing'));
  const log = globalThis.__llmCallLog || [];
  const rows = log.map((c, i) => {
    const tier = findTier(String(c.model).split('/').pop());
    const price = tier && tier.usdPer1M;
    const usd = price ? (c.input / 1e6) * price.input + (c.output / 1e6) * price.output : null;
    return { n: i + 1, stage: stageOf(c.promptHead), model: c.model, input: c.input, output: c.output, usd: usd === null ? null : Number(usd.toFixed(5)), promptChars: c.promptChars, head: String(c.promptHead).slice(0, 50) };
  });
  const LOOP_STAGES = new Set(['Critic 1', 'Verification', 'Editorial', 'Editor', 'Final Judge']);
  const sum = (arr) => Number(arr.reduce((n, r) => n + (r.usd || 0), 0).toFixed(4));
  const byStage = {};
  for (const r of rows) { const s = byStage[r.stage] || { calls: 0, input: 0, output: 0, usd: 0 }; s.calls += 1; s.input += r.input; s.output += r.output; s.usd = Number((s.usd + (r.usd || 0)).toFixed(4)); byStage[r.stage] = s; }
  const loopRows = rows.filter((r) => LOOP_STAGES.has(r.stage)); const baseRows = rows.filter((r) => !LOOP_STAGES.has(r.stage));
  return {
    calls: rows, byStage,
    baseCalls: baseRows.length, qualityLoopCalls: loopRows.length, totalCalls: rows.length,
    baseCost: sum(baseRows), qualityLoopCost: sum(loopRows), totalCost: sum(rows),
    unpricedModels: [...new Set(rows.filter((r) => r.usd === null).map((r) => r.model))],
  };
}

/** Draft(초안) 와 Final(비평·수정 뒤) 을 같은 잣대로 잰다 — v3.8.736 보고서 형식 */
function draftVsFinal(cq, logs, result) {
  const out = {};
  const crit = cq.critique;
  if (!crit || !cq.draftArticle) return { critique: 'N/A' };
  const { sectionize, stripHtml, findCrossSectionRepeats } = require(path.join(ROOT, 'dist/core/final/critique-loop'));
  const { checkClaims, ledgerFromItems } = require(path.join(ROOT, 'dist/core/final/fact-claims'));
  const ledger = ledgerFromItems([...(cq.items || []).map((i) => ({ id: i.id, text: `${i.title} ${i.cleanedText}` })), { id: 'PACKET', text: cq.packetText || '' }]);
  const itemIds = new Set((cq.items || []).map((i) => i.id));
  const measure = (article) => {
    const units = sectionize(article);
    const text = units.map((u) => stripHtml(u.text)).join('\n');
    const claims = units.flatMap((u) => checkClaims(u.text, ledger).unsupported);
    return { chars: text.length, ungrounded: claims, repeats: findCrossSectionRepeats(units).length, units };
  };
  const d = measure(cq.draftArticle); const f = measure(cq.finalArticle);
  const ledgerIssues = crit.issueLedger || [];
  const blockingSections = new Set(ledgerIssues.filter((i) => i.severity !== 'MINOR').map((i) => i.sectionId));
  // 문제 없는 절 보존 — 정규화 본문(공백 제거)으로 Draft 와 Final 을 비교한다
  const changed = d.units.map((u, i) => ({ id: u.id, changed: flat(stripHtml(u.text)) !== flat(stripHtml(f.units[i] ? f.units[i].text : '')) }));
  const cleanSections = changed.filter((c) => !blockingSections.has(c.id));
  const cleanChanged = cleanSections.filter((c) => c.changed).map((c) => c.id);
  const cost = (logs.find((l) => /이 글 비용/.test(l)) || '').replace(/.*이 글 비용: /, '');
  out.qualityLoopEnabled = process.env.QUALITY_LOOP === '1';
  out.titleAudit = cq.titleAudit ? { status: cq.titleAudit.audit && cq.titleAudit.audit.status, attempts: cq.titleAudit.attempts, stripped: cq.titleAudit.stripped, unsupported: (cq.titleAudit.audit || {}).unsupportedClaims } : null;
  out.critic1 = analyzeCritic(crit.critic1, d.units, itemIds, stripHtml);
  out.verifications = (crit.verifications || []).map((v) => ({ ...analyzeCritic(v, f.units, itemIds, stripHtml), resolvedByModel: (() => { try { return (JSON.parse(String(v.raw || '')).resolved || []).length; } catch { return '?'; } })(), stillOpenByModel: (() => { try { return (JSON.parse(String(v.raw || '')).stillOpen || []).length; } catch { return '?'; } })() }));
  out.editorial = crit.editorial ? analyzeCritic(crit.editorial, f.units, itemIds, stripHtml) : null;
  out.issueLifecycle = {
    total: ledgerIssues.length,
    byOrigin: ledgerIssues.reduce((m, i) => ({ ...m, [i.origin]: (m[i.origin] || 0) + 1 }), {}),
    byStatus: ledgerIssues.reduce((m, i) => ({ ...m, [i.status]: (m[i.status] || 0) + 1 }), {}),
    openBlocking: ledgerIssues.filter((i) => (i.status === 'OPEN' || i.status === 'REGRESSED') && i.severity !== 'MINOR').map((i) => `${i.issueKey} [${i.severity}]`),
    resolved: ledgerIssues.filter((i) => i.status === 'RESOLVED').map((i) => `${i.issueKey} [${i.severity}]`),
  };
  out.emptySections = cq.emptySections ? { found: (cq.emptySections.findings || []).length, repaired: (cq.emptySections.repaired || []).length, removed: (cq.emptySections.removed || []).length, unresolved: cq.emptySections.unresolved || [], calls: cq.emptySections.calls } : null;
  out.titleRevision = crit.titleRevision || null;
  out.researchRecovery = crit.researchRecovery || null;   // v3.8.746 — 편집보다 검색이 먼저였는가
  out.ctas = cq.ctas || [];   // v3.8.745 — 주소·문구·actionStatus
  out.verificationSawCurrentTitle = (crit.verificationContexts || []).every((c) => c.currentTitle === (crit.titleRevision && crit.titleRevision.pass ? crit.titleRevision.to : c.originalTitle));
  out.criticCycles = crit.criticCycles; out.revisionCycles = crit.revisionCycles; out.researchRounds = crit.researchRounds; out.loopCallsReported = crit.qualityLoopCalls;
  out.revisedSections = `${crit.revisedSections}/${crit.totalSections}`; out.unchangedSections = `${crit.unchangedSections}/${crit.totalSections}`;
  out.revisionDetail = (crit.revisions || []).map((r) => ({ calls: r.calls, revised: r.revised, rejected: r.rejected, resolvedIssueKeys: r.resolvedIssueKeys, models: r.models }));
  out.sectionPreservation = { blockingSections: [...blockingSections], cleanSections: cleanSections.length, cleanChanged, preservationRate: cleanSections.length ? `${cleanSections.length - cleanChanged.length}/${cleanSections.length}` : 'n/a', changedSections: changed.filter((c) => c.changed).map((c) => c.id) };
  out.draft = { sections: d.units.length, chars: d.chars, ungrounded: d.ungrounded, repeats: d.repeats };
  out.final = { sections: f.units.length, chars: f.chars, ungrounded: f.ungrounded, repeats: f.repeats };
  out.finalJudge = cq.judge ? { decision: cq.judge.decision, blocking: cq.judge.blockingIssues, advisory: cq.judge.advisory, model: cq.judge.model } : null;
  out.finalQaNotes = cq.finalQaNotes;
  out.hardGates = cq.hardGates; out.qualityConverged = cq.qualityConverged; out.publishDecision = result && result.publishDecision; out.manualReviewReason = cq.manualReviewReason;
  out.cost = cost; out.costTable = costTable();
  out.models = crit.models; out.modelLine = logs.filter((l) => /실제 사용 모델|모델 하향|requestedModel|actualModel/.test(l)).slice(0, 4);
  out.keywordProvenance = cq.keywordProvenance ? { hashtag: cq.keywordProvenance.hashtag, dropped: cq.keywordProvenance.semanticKeyword } : null;
  return out;
}

function splitSentences(text) {
  return String(text || '').split(/(?<=[.!?。])\s+|\n+/).map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s.length >= 18);
}

async function runOne(entry, env) {
  const dir = path.join(OUT, slug(entry.keyword));
  fs.mkdirSync(dir, { recursive: true });
  const save = (name, data) => fs.writeFileSync(path.join(dir, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2), 'utf8');

  process.env.PRIMARY_TEXT_MODEL = 'openai-gpt41';
  process.env.EVIDENCE_DEBUG_RAW = '1';
  // 실행마다 비운다 — 안 비우면 실패한 실행이 앞 글의 기록을 자기 것처럼 저장한다(2026-09-22 실측: 429 로 죽은 두 글이 앞 글 지표를 복사)
  for (const k of ['__lastEvidenceDebug', '__lastCritiqueDebug', '__lastDraftArticle']) globalThis[k] = null;
  globalThis.__llmCallLog = [];
  try { require(path.join(ROOT, 'dist/core/llm/usage-cost')).resetUsage(); } catch { /* 없으면 orchestration 이 비운다 */ }
  if (!LIVE) process.env.RESEARCH_PACKET_LLM = '0';
  console.log(`qualityLoopEnabled=${process.env.QUALITY_LOOP === '1'} requestedModel=${process.env.PRIMARY_TEXT_MODEL}`);

  const engine = require(path.join(ROOT, 'dist/core/final/gemini-engine'));
  const realCall = engine.__realCall || engine.callGeminiWithRetry;
  engine.__realCall = realCall;
  const prompts = [];
  /** 호출마다 프롬프트·응답 원문을 남긴다 — Critic/Editor/Judge 의 실제 JSON 을 그대로 보려는 것 */
  const exchanges = [];
  engine.callGeminiWithRetry = async (prompt, retries, opts) => {
    const p = String(prompt || '');
    prompts.push(p);
    if (LIVE) {
      const t0 = Date.now(); const idx = exchanges.push({ n: prompts.length, stage: stageOf(p), promptChars: p.length, ms: 0, response: '', error: '' }) - 1;
      try { const r = await realCall(prompt, retries, opts); exchanges[idx].response = String(r || ''); return r; }
      catch (e) { exchanges[idx].error = String(e && e.message || e).slice(0, 200); throw e; }
      finally { exchanges[idx].ms = Date.now() - t0; }
    }
    // capture 모드: 제목·소제목만 흉내 내고, 본문 호출에서 멈춘다 — 그때까지의 입력이 곧 Writer Input 이다
    // capture 의 가짜 제목에 일부러 근거에 없을 날짜를 넣는다 — Title Fact Gate 가 잡아 걷어내는지 $0 로 본다
    if (prompts.length <= 3 && /바이럴 마케터/.test(p.slice(0, 80))) return `${new Date().getFullYear()}년 ${entry.keyword}, 13월 32일 마감 전 확인할 조건`;
    if (p.length < 9000 && /소제목|H2/.test(p.slice(0, 800))) {
      return ['1. 지금 달라진 점', '2. 대상과 조건', '3. 일정과 기간', '4. 신청·이용 방법', '5. 자주 막히는 지점'].join('\n');
    }
    throw new Error('CAPTURE_ONLY');
  };

  if (!LIVE) {
    /**
     * capture 는 $0 이어야 한다. 본문 작성은 callGeminiWithRetry 가 아니라 다른 입구(검색 근거 겸용 호출)로도 나간다 —
     * 첫 구현에서 이걸 놓쳐 capture 인데도 본문 호출 5번이 실제로 과금됐다(2026-09-22). 모든 입구를 막는다.
     */
    const fakeAll = async (prompt) => { prompts.push(String(prompt || '')); throw new Error('CAPTURE_ONLY'); };
    for (const k of Object.keys(engine)) {
      if (k !== 'callGeminiWithRetry' && /^call/i.test(k) && typeof engine[k] === 'function') engine[k] = fakeAll;
    }
    const caller = require(path.join(ROOT, 'dist/core/llm/llm-caller'));
    for (const k of ['callLLM', 'callOpenAIAPI', 'callClaudeAPI', 'callPerplexityAPI']) caller[k] = fakeAll;
    try {
      const llmIndex = require(path.join(ROOT, 'dist/core/llm'));
      for (const k of ['callLLM', 'callOpenAIAPI', 'callClaudeAPI', 'callPerplexityAPI']) if (typeof llmIndex[k] === 'function') llmIndex[k] = fakeAll;
    } catch { /* 색인 모듈이 없으면 건너뛴다 */ }
  }

  require(path.join(ROOT, 'dist/core/content-modes/register-all'));
  const { generateUltimateMaxModeArticleFinal } = require(path.join(ROOT, 'dist/core/final/orchestration'));

  const logs = [];
  let result = null; let error = '';
  const started = Date.now();
  try {
    result = await generateUltimateMaxModeArticleFinal({
      topic: entry.keyword, keywords: [entry.keyword], provider: 'openai', platform: 'wordpress',
      contentMode: 'external', toneStyle: 'professional', factCheckMode: 'auto',
      skipImages: true, thumbnailMode: 'none', h2ImageSource: 'none', previewOnly: true,
    }, env, (m) => logs.push(String(m)));
  } catch (e) { error = String(e && e.message || e).slice(0, 300); }

  const debug = globalThis.__lastEvidenceDebug || {};
  const queries = (debug.queries || []).map((q) => ({ type: q.type, query: q.query, sort: q.sort, ok: q.ok, count: q.count, error: q.error }));
  const items = debug.items || [];
  const rejected = debug.rejected || [];
  // Writer Input = 본문 작성 호출의 프롬프트. 보강·복구 프롬프트와 섞이지 않게 "오늘 날짜" 줄이 있는 것 중 가장 긴 것을 고른다
  const writerInput = prompts.filter((p) => /오늘 날짜: \d{4}-\d{2}-\d{2}/.test(p) && /RESEARCH PACKET|FACT/.test(p))
    .sort((a, b) => b.length - a.length)[0] || [...prompts].sort((a, b) => b.length - a.length)[0] || '';
  prompts.forEach((p, i) => save(`prompt-${String(i + 1).padStart(2, '0')}.txt`, p));

  // v3.8.735 산출물 A~L (비평·수정 루프 포함). 수정이 없었으면 revision 파일은 SKIPPED 로 남긴다
  const cq = globalThis.__lastCritiqueDebug || {};
  const crit = cq.critique || null;
  save('A-search.json', { queries, raw: (debug.queries || []).map((q) => ({ type: q.type, query: q.query, raw: q.raw || [] })) });
  save('B-clean-evidence.json', { items, rejected });
  save('C-research-packet.json', debug.packet || {});
  save('D-title.json', { title: cq.title || (result && result.title) || '', history: (cq.titleAudit || debug.titleAudit || {}).history || [], attempts: (cq.titleAudit || {}).attempts, stripped: (cq.titleAudit || {}).stripped });
  save('E-title-audit.json', (cq.titleAudit || debug.titleAudit || {}).audit || { status: 'N/A' });
  save('F-draft.json', cq.draftArticle || {});
  // v3.8.736 — critic1 은 배열이 아니라 객체(raw 포함). 편집기 응답 원문은 exchanges 에서 단계별로 붙인다
  const byStage = (name) => exchanges.filter((e) => e.stage === name);
  save('G-critic-1.json', crit && crit.critic1 ? { ...crit.critic1, exchange: byStage('Critic 1')[0] || null } : { status: 'N/A' });
  save('H-editor-1.json', crit && crit.revisions[0] ? { ...crit.revisions[0], exchange: byStage('Editor')[0] || null } : { status: 'SKIPPED' });
  save('I-verification-1.json', crit && crit.verifications[0] ? { ...crit.verifications[0], exchange: byStage('Verification')[0] || null } : { status: 'SKIPPED' });
  save('J-editor-2.json', crit && crit.revisions[1] ? { ...crit.revisions[1], exchange: byStage('Editor')[1] || null } : { status: 'SKIPPED' });
  save('J2-verification-2.json', crit && crit.verifications[1] ? { ...crit.verifications[1], exchange: byStage('Verification')[1] || null } : { status: 'SKIPPED' });
  save('K-editorial.json', crit && crit.editorial ? { ...crit.editorial, exchange: byStage('Editorial')[0] || null } : { status: 'SKIPPED' });
  save('K-final-judge.json', cq.judge ? { ...cq.judge, exchange: byStage('Final Judge')[0] || null } : { decision: 'N/A' });
  if (result && result.html) save('L-final-article.html', result.html);
  save('final-article.json', cq.finalArticle || {});
  save('issue-ledger.json', crit ? crit.issueLedger : []);
  // v3.8.738 — 검증 비평이 받은 입력(최신 제목·절) 과 루프 안 제목 수정 기록
  save('verification-contexts.json', { titleRevision: crit ? crit.titleRevision : null, contexts: crit ? crit.verificationContexts || [] : [] });
  save('exchanges.json', exchanges.map((e) => ({ ...e, response: e.response.slice(0, 20000) })));
  save('critique-report.json', { critique: crit, hardGates: cq.hardGates, qualityConverged: cq.qualityConverged, manualReviewReason: cq.manualReviewReason, finalQaNotes: cq.finalQaNotes, keywordProvenance: cq.keywordProvenance, publishDecision: result && result.publishDecision });
  save('writer-input.txt', writerInput);
  save('log.txt', logs.join('\n'));

  // ─── 지표 ───
  const { coreEntityOf, scoreMainRelevance } = require(path.join(ROOT, 'dist/core/final/evidence'));
  const { shellLineRatio } = require(path.join(ROOT, 'dist/core/crawlers/evidence-clean'));
  const core = coreEntityOf(entry.keyword, 2).split(/\s+/).filter(Boolean);
  const promiseQueries = logs.filter((l) => /제목 약속 근거 추가/.test(l)).map((l) => (l.match(/← 검색 "([^"]+)"/) || [])[1]).filter(Boolean);
  const withCore = promiseQueries.filter((q) => core.some((c) => q.replace(/\s+/g, '').includes(c)));
  const lonely = queries.filter((q) => !core.some((c) => String(q.query).replace(/\s+/g, '').includes(c)));

  const evStart = writerInput.indexOf('[FACT EVIDENCE — 근거 항목');
  const evEnd = evStart >= 0 ? writerInput.indexOf('[FACT EVIDENCE — 보조', evStart) : -1;
  const packetStart = writerInput.indexOf('[RESEARCH PACKET');
  const evidenceText = evStart >= 0 ? writerInput.slice(evStart, evEnd > 0 ? evEnd : evStart + 14000) : '';
  const packetText = packetStart >= 0 ? writerInput.slice(packetStart, evStart > packetStart ? evStart : packetStart + 6000) : '';
  const irrelevant = items.filter((i) => scoreMainRelevance({ title: i.title, text: i.cleanedText }, entry.keyword) < 0.5);
  const irrelevantChars = irrelevant.reduce((n, i) => n + i.cleanedText.length, 0);
  const totalChars = items.reduce((n, i) => n + i.cleanedText.length, 0) || 1;

  const article = result && result.html ? String(result.html).replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
  const sentences = splitSentences(article);
  const dup = sentences.length - new Set(sentences.map((s) => s.replace(/\s/g, ''))).size;
  const ledger = items.map((i) => `${i.title} ${i.cleanedText}`).join(' ').replace(/[,\s]/g, '');
  const claimed = [...new Set((article.match(/\d[\d,]*(?:\.\d+)?\s*(?:억|천만|백만|십만|만|천)?\s*(?:원|%)|\d{1,2}\s*월\s*\d{1,2}\s*일/g) || []).map((v) => v.replace(/[,\s]/g, '')))];
  const ungrounded = claimed.filter((v) => !ledger.includes(v));
  const stage = (name) => (logs.find((l) => l.startsWith(`[STAGE] ${name}:`)) || '').replace(`[STAGE] ${name}: `, '');
  const modelLine = logs.find((l) => /실제 사용 모델|모델 하향 발생/.test(l)) || '';

  const metrics = {
    type: entry.type, keyword: entry.keyword, mode: LIVE ? 'live' : 'capture', seconds: Math.round((Date.now() - started) / 1000), error,
    promiseQueries, promiseQueryCoreRate: promiseQueries.length ? `${withCore.length}/${promiseQueries.length}` : 'n/a',
    queriesWithoutCore: lonely.map((q) => q.query),
    evidenceItems: items.length, rejectedItems: rejected.length,
    irrelevantEvidenceRatio: `${Math.round((irrelevantChars / totalChars) * 1000) / 10}%`,
    boilerplateLineRatio: `${Math.round(shellLineRatio(evidenceText) * 1000) / 10}%`,
    pubDateRate: `${items.filter((i) => i.pubDate).length}/${items.length}`,
    urlRate: `${items.filter((i) => /^https?:/.test(i.url)).length}/${items.length}`,
    urlInWriterInput: (evidenceText.match(/URL: https?:\/\//g) || []).length,
    dateInWriterInput: (evidenceText.match(/게시일: 20\d{2}-\d{2}-\d{2}/g) || []).length,
    officialUsed: items.filter((i) => i.isOfficial).length,
    writerInputChars: writerInput.length, evidenceChars: evidenceText.length, packetChars: packetText.length,
    instructionChars: Math.max(0, writerInput.length - evidenceText.length - packetText.length),
    packetStatus: (debug.packet || {}).status || '', packetFacts: ((debug.packet || {}).facts || []).length,
    packetNumbers: ((debug.packet || {}).numbers || []).length, packetDates: ((debug.packet || {}).dates || []).length,
    stages: { search: stage('SEARCH'), clean: stage('CLEAN'), grounding: stage('GROUNDING'), research: stage('RESEARCH'), writer: stage('WRITER') },
    todayInPrompt: (writerInput.match(/오늘 날짜: (\d{4}-\d{2}-\d{2})/) || [])[1] || '',
    forcedLength: /\(최소 \d+자\)/.test(writerInput) || /반드시 600~1000자/.test(writerInput),
    modelLine, articleChars: article.length, duplicateSentences: dup,
    ungroundedValues: ungrounded.slice(0, 12), ungroundedCount: ungrounded.length, claimedValues: claimed.length,
    // ─── v3.8.735 Draft vs Final ───
    ...draftVsFinal(cq, logs, result),
  };
  save('metrics.json', metrics);
  return metrics;
}

(async () => {
  const { loadEnvFromFile } = require(path.join(ROOT, 'dist/env'));
  const env = loadEnvFromFile() || {};
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;
  fs.mkdirSync(OUT, { recursive: true });

  const all = [];
  for (const entry of pickKeywords()) {
    console.log(`\n━━ [${entry.type}] ${entry.keyword} (${LIVE ? 'live' : 'capture'}) ━━`);
    const m = await runOne(entry, env);
    all.push(m);
    console.log(JSON.stringify({ ...m, stages: undefined }, null, 1).slice(0, 1800));
  }
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(all, null, 2), 'utf8');
  const kstNow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  console.log(`\n저장: ${OUT}\n서울 기준 오늘: ${kstNow}`);
  process.exit(0);
})();
