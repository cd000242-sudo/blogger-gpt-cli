#!/usr/bin/env node
/**
 * 비평 루프 오프라인 재현 (v3.8.736) — **유료 호출 0.**
 *
 * 735 live 에서 저장한 Draft / Research Packet / Evidence / Critic 1 응답(raw)을 fixture 로 쓴다.
 *   · Critic 1  = 저장된 모델 응답을 그대로 되돌려준다(있으면). 새 규칙(지문·심각도·구절 검증)이 그것을 어떻게 거르는지 본다.
 *   · Editor    = 흉내: 지적된 절에서 근거 없는 값이 든 **문장만** 지운다(최소 변경). 실제 편집기의 문장 품질은 재지 않는다.
 *   · 검증 비평 = 흉내: 코드가 다시 잰다(모델 판단 없음).
 *   · 편집 비평 / Judge = PASS (모델이 어떻게 답할지는 live 에서만 안다 — 미검증)
 * 그래서 이 스크립트가 재는 것은 **루프의 기계적 동작**(수정 대상 선정·보존·호출 수·지문·수렴)이지 모델 품질이 아니다.
 *
 * 사용: node scripts/critique-replay.js   (NO_LIVE_LLM=1 을 스스로 건다)
 */
process.env.NO_LIVE_LLM = '1';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { runCritiqueLoop, sectionize, stripHtml, codeGate } = require(path.join(ROOT, 'dist/core/final/critique-loop'));
const { checkClaims, ledgerFromItems } = require(path.join(ROOT, 'dist/core/final/fact-claims'));

const LIVE = path.join(ROOT, 'quality-run-output', 'evidence-regression-live');
const dirs = ['청년미래적금_2차_신청', '주택담보대출_금리_7_돌파', '전기차_보조금_하반기_추가_공고'];
const KEYWORDS = { '청년미래적금_2차_신청': '청년미래적금 2차 신청', '주택담보대출_금리_7_돌파': '주택담보대출 금리 7% 돌파', '전기차_보조금_하반기_추가_공고': '전기차 보조금 하반기 추가 공고' };

const j = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const isEditor = (p) => p.startsWith('당신은 교정자입니다');
const isVerify = (p) => p.includes('OPEN 지적 각각이 해결됐는가');
const isCritic1 = (p) => p.startsWith('당신은 검수자입니다. 칭찬하지 않고');

/** 흉내 편집기 — 지적된 절에서 근거 없는 값이 든 문장만 지운다. 문장이 다 사라지면 짧은 안내 문장 하나 */
function simulateEditor(prompt, article, ledger) {
  const ids = [...prompt.matchAll(/===== \[(S\d\d)\]/g)].map((m) => m[1]);
  const units = sectionize(article);
  const revisions = [];
  for (const id of ids) {
    const u = units.find((x) => x.id === id);
    const bad = checkClaims(u.text, ledger).unsupported;
    if (!bad.length) continue;   // 모델 지적만 있는 절은 흉내 편집기가 판단하지 못한다 → 손대지 않는다
    const drop = (html) => {
      let out = html;
      for (const v of bad) {
        const esc = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
        out = out.replace(new RegExp(`[^.<>!?]*${esc}[^.<>!?]*[.!?]?\\s*`, 'g'), '');
      }
      return stripHtml(out).trim().length >= 12 ? out : '<p>세부 조건은 공식 공고를 기준으로 확인하면 됩니다.</p>';
    };
    if (u.kind === 'section') revisions.push({ sectionId: id, h3Sections: u.h3Sections.map((h, i) => ({ index: i, content: drop(h.content) })), resolvedIssueKeys: [] });
    else revisions.push({ sectionId: id, content: drop(u.text), resolvedIssueKeys: [] });
  }
  return JSON.stringify({ revisions });
}

(async () => {
  const rows = [];
  for (const d of dirs) {
    const dir = path.join(LIVE, d);
    if (!fs.existsSync(path.join(dir, 'F-draft.json'))) { console.log('skip (no fixture)', d); continue; }
    const draft = j(path.join(dir, 'F-draft.json'));
    const packet = j(path.join(dir, 'C-research-packet.json'));
    const evidence = j(path.join(dir, 'B-clean-evidence.json'));
    const report735 = j(path.join(dir, 'critique-report.json'));
    const items = (evidence.items || []).map((i) => ({ id: i.id, title: i.title, cleanedText: i.cleanedText }));
    const { renderPacket } = require(path.join(ROOT, 'dist/core/final/research-packet'));
    const packetText = renderPacket(packet);
    const evidenceText = items.map((i) => `[${i.id}] ${i.title}\n${i.cleanedText.slice(0, 1200)}`).join('\n\n');
    const ledger = ledgerFromItems([...items.map((i) => ({ id: i.id, text: `${i.title} ${i.cleanedText}` })), { id: 'PACKET', text: packetText }]);
    /**
     * 735 가 저장한 Critic 1 응답(raw)은 4,000자에서 잘려 JSON 으로 못 읽는다. 대신 그때 파싱돼 저장된 지적 목록
     * (criticalIssues/majorIssues/minorIssues — 절 id·종류·문제·근거 id)을 v2 스키마로 옮겨 되돌려준다.
     * 735 지적에는 exactSpan 이 없다(그때 스키마에 없었다). v2 는 구절 없는 CRITICAL/MAJOR 를 blocking 으로 안 보므로
     * 이 재현은 "735 의 모델 지적이 v2 규칙에서 얼마나 걸러지는가"를 잰다 — 실제 v2 Critic 의 응답은 live 에서만 안다.
     */
    const c735 = report735.critique && report735.critique.critic1 && report735.critique.critic1[0];
    const TYPE_MAP = { unsupported_claim: 'UNSUPPORTED_CLAIM', missing_information: 'MISSING_INFORMATION', intent_gap: 'SEARCH_INTENT_MISSING', answer_too_late: 'ANSWER_TOO_LATE', redundancy: 'REDUNDANCY', mixed_timeline: 'EXPIRED_AS_CURRENT', low_density: 'OTHER', focus_mismatch: 'TITLE_PROMISE_UNMET', other: 'OTHER' };
    const savedIssues = c735 ? [...c735.criticalIssues, ...c735.majorIssues, ...c735.minorIssues].filter((i) => i.origin !== 'code').map((i) => ({
      severity: String(i.severity).toUpperCase(), sectionId: i.sectionId, exactSpan: '', type: TYPE_MAP[i.type] || 'OTHER', problem: i.problem, evidenceIds: i.evidenceIds || [], requiredChange: i.requiredChange || '',
    })) : [];
    const savedCritic1 = JSON.stringify({ status: savedIssues.length ? 'REVISION_REQUIRED' : 'PASS', issues: savedIssues, missingIntentAnswers: c735 ? c735.missingIntentAnswers || [] : [], titleIssues: [], researchQueries: [] });
    const title = j(path.join(dir, 'D-title.json')).title || KEYWORDS[d];

    let article = draft; let calls = 0; const kinds = [];
    const r = await runCritiqueLoop({
      title, mainKeyword: KEYWORDS[d], article: draft, packetText, evidenceText, items,
      onLog: (m) => console.log('   ', m.slice(0, 160)),
      callModel: async (p) => {
        calls += 1;
        if (isCritic1(p)) { kinds.push('critic1'); return savedCritic1 || JSON.stringify({ status: 'PASS', issues: [] }); }
        if (isEditor(p)) { kinds.push('editor'); return simulateEditor(p, article, ledger); }
        if (isVerify(p)) { kinds.push('verify'); return JSON.stringify({ resolved: [], stillOpen: [], issues: [] }); }
        kinds.push('editorial'); return JSON.stringify({ status: 'PASS', issues: [] });
      },
    });
    const before = sectionize(draft); const after = sectionize(r.article);
    const unchanged = before.filter((u, i) => u.text === after[i].text).length;
    const ung = (a) => sectionize(a).flatMap((u) => checkClaims(u.text, ledger).unsupported);
    const row = {
      keyword: KEYWORDS[d],
      before735: { revised: report735.critique ? report735.critique.revisedSections : '?', total: report735.critique ? report735.critique.totalSections : '?', cycles: report735.critique ? report735.critique.revisionCycles : '?', decision: report735.publishDecision },
      savedCritic1Issues: savedIssues.length,
      savedCritic1Blocking: savedIssues.filter((i) => i.severity !== 'MINOR').length,
      acceptedBlocking: r.report.issueLedger.filter((i) => i.severity !== 'MINOR').length,
      downgradedToMinor: r.report.issueLedger.filter((i) => i.origin === 'critic1' && i.severity === 'MINOR').length,
      rejectedCriticIssues: r.report.critic1 ? r.report.critic1.rejectedIssues.length : 0,
      rejectReasons: r.report.critic1 ? [...new Set(r.report.critic1.rejectedIssues.map((x) => x.reason.split('(')[0].slice(0, 30)))] : [],
      codeIssues: r.report.issueLedger.filter((i) => i.origin === 'code').length,
      revisionCycles: r.report.revisionCycles,
      revisedSections: `${r.report.revisedSections}/${r.report.totalSections}`,
      unchangedSections: `${unchanged}/${before.length}`,
      openAfter: r.report.open,
      qualityLoopCalls: r.report.qualityLoopCalls + 1,   // + Final Judge 1
      callKinds: kinds.join(','),
      ungroundedDraft: ung(draft).length, ungroundedFinal: ung(r.article).length,
      converged: r.report.converged, manualReviewReason: r.report.manualReviewReason,
    };
    rows.push(row);
    fs.writeFileSync(path.join(dir, 'replay-736.json'), JSON.stringify({ row, issueLedger: r.report.issueLedger, revisions: r.report.revisions, rejected: r.report.critic1 && r.report.critic1.rejectedIssues }, null, 2), 'utf8');
    console.log('\n══', row.keyword); console.log(JSON.stringify(row, null, 1));
  }
  fs.writeFileSync(path.join(LIVE, 'replay-736-summary.json'), JSON.stringify(rows, null, 2), 'utf8');
})();
