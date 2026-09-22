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
const OUT = path.join(ROOT, 'quality-run-output', `evidence-regression-${LIVE ? 'live' : 'capture'}`);

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

/** Draft(초안) 와 Final(비평·수정 뒤) 을 같은 잣대로 잰다 — 근거 없는 값 · 되풀이 문장 · 의도 누락 · 글자수 · 비용 */
function draftVsFinal(cq, logs, result) {
  const out = {};
  const crit = cq.critique;
  if (!crit || !cq.draftArticle) return { critique: 'N/A' };
  const { sectionize, stripHtml, findCrossSectionRepeats } = require(path.join(ROOT, 'dist/core/final/critique-loop'));
  const { checkClaims, ledgerFromItems } = require(path.join(ROOT, 'dist/core/final/fact-claims'));
  const ledger = ledgerFromItems([...(cq.items || []).map((i) => ({ id: i.id, text: `${i.title} ${i.cleanedText}` })), { id: 'PACKET', text: cq.packetText || '' }]);
  const measure = (article) => {
    const units = sectionize(article);
    const text = units.map((u) => stripHtml(u.text)).join('\n');
    const claims = units.flatMap((u) => checkClaims(u.text, ledger).unsupported);
    return { chars: text.length, ungrounded: claims, repeats: findCrossSectionRepeats(units).length };
  };
  const d = measure(cq.draftArticle); const f = measure(cq.finalArticle);
  const c1 = crit.critic1 || [];
  const first = c1[0] || { criticalIssues: [], majorIssues: [], minorIssues: [], missingIntentAnswers: [] };
  const last = c1[c1.length - 1] || first;
  const cost = (logs.find((l) => /이 글 비용/.test(l)) || '').replace(/.*이 글 비용: /, '');
  out.titleAudit = cq.titleAudit ? { status: cq.titleAudit.audit && cq.titleAudit.audit.status, attempts: cq.titleAudit.attempts, stripped: cq.titleAudit.stripped, unsupported: (cq.titleAudit.audit || {}).unsupportedClaims } : null;
  out.critic1First = { critical: first.criticalIssues.length, major: first.majorIssues.length, minor: first.minorIssues.length, intentGaps: (first.missingIntentAnswers || []).length, status: first.status };
  out.critic1Last = { critical: last.criticalIssues.length, major: last.majorIssues.length, minor: last.minorIssues.length, intentGaps: (last.missingIntentAnswers || []).length };
  out.critic2 = crit.critic2 ? { major: crit.critic2.majorIssues.length, minor: crit.critic2.minorIssues.length, status: crit.critic2.status } : null;
  out.criticCycles = crit.criticCycles; out.revisionCycles = crit.revisionCycles; out.researchRounds = crit.researchRounds;
  out.revisedSections = `${crit.revisedSections}/${crit.totalSections}`; out.unchangedSections = `${crit.unchangedSections}/${crit.totalSections}`;
  out.revisionDetail = (crit.revisions || []).map((r) => ({ revised: r.revised, rejected: r.rejected }));
  out.draft = { chars: d.chars, ungrounded: d.ungrounded, repeats: d.repeats };
  out.final = { chars: f.chars, ungrounded: f.ungrounded, repeats: f.repeats };
  out.finalJudge = cq.judge ? { decision: cq.judge.decision, blocking: cq.judge.blockingIssues, anotherRevision: cq.judge.anotherRevisionWouldMateriallyImprove } : null;
  out.hardGates = cq.hardGates; out.qualityConverged = cq.qualityConverged; out.publishDecision = result && result.publishDecision; out.manualReviewReason = cq.manualReviewReason;
  out.cost = cost; out.keywordProvenance = cq.keywordProvenance ? { hashtag: cq.keywordProvenance.hashtag, dropped: cq.keywordProvenance.semanticKeyword } : null;
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
  if (!LIVE) process.env.RESEARCH_PACKET_LLM = '0';

  const engine = require(path.join(ROOT, 'dist/core/final/gemini-engine'));
  const realCall = engine.__realCall || engine.callGeminiWithRetry;
  engine.__realCall = realCall;
  const prompts = [];
  engine.callGeminiWithRetry = async (prompt, retries, opts) => {
    const p = String(prompt || '');
    prompts.push(p);
    if (LIVE) return realCall(prompt, retries, opts);
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
  save('G-critic-1.json', crit ? crit.critic1[0] || {} : { status: 'N/A' });
  save('H-revision-1.json', crit && crit.revisions[0] ? crit.revisions[0] : { status: 'SKIPPED' });
  save('I-critic-2.json', crit ? (crit.critic1[1] || crit.critic2 || { status: 'N/A' }) : { status: 'N/A' });
  save('J-revision-2.json', crit && crit.revisions[1] ? crit.revisions[1] : { status: 'SKIPPED' });
  save('K-final-judge.json', cq.judge || { decision: 'N/A' });
  if (result && result.html) save('L-final-article.html', result.html);
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
