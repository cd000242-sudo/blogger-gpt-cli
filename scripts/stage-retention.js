#!/usr/bin/env node
/**
 * 📏 단계별 보존 지표 (748 Search Pipeline) — 저장된 실행 산출물만 읽는다(유료 호출 0).
 *
 *   node scripts/stage-retention.js <run-dir> [--core "12,800;3~6개월;850객실;소노캄"]
 *   node scripts/stage-retention.js <run-dir-1> <run-dir-2> <run-dir-3> --core "…"   # CORE_SOURCE_STABILITY x/3
 *
 * 고정 CORE 값 목록에 대해 어디까지 살아남았는지 센다:
 *   SEARCH_RETRIEVAL         검색 RAW 응답(A-search raw · 캐시 적중 포함)이 그 값을 가진 출처를 가져왔나
 *   CLEAN_RETENTION          CLEAN 장부(B-clean-evidence items) 에 남았나
 *   PACKET_LLM_SELECTION     LLM 정리 문장(facts·conditions…)이 골랐나
 *   DETERMINISTIC_RECOVERY   코드 추출(numbers·dates)에 origin=DETERMINISTIC_RECOVERY 로 남았나
 *   WRITER_PACKET_RETENTION  Writer 보기(N-writer-packet-decisions) 에 CORE/SUPPORTING 으로 남았나
 *   FINAL_USAGE              발행 직전 HTML(L-final-article) 본문에 쓰였나
 * 값 대조는 쉼표·공백을 뗀 부분 문자열이다 — "10월 7일부터 16일까지" 같은 표기 차이는 사람이 spot-check 한다.
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const coreArg = (() => { const i = args.indexOf('--core'); return i >= 0 ? String(args[i + 1] || '') : ''; })();
const dirs = args.filter((a, i) => a !== '--core' && args[i - 1] !== '--core');
const CORE = (coreArg || '12,800;3~6개월;850객실;소노캄').split(';').map((s) => s.trim()).filter(Boolean);
const flat = (s) => String(s || '').replace(/[\s,]/g, '');
const J = (dir, f) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { return null; } };
const T = (dir, f) => { try { return fs.readFileSync(path.join(dir, f), 'utf8'); } catch { return ''; } };
const has = (text, v) => flat(text).includes(flat(v));

function measure(dir) {
  const A = J(dir, 'A-search.json') || { raw: [] };
  const B = J(dir, 'B-clean-evidence.json') || { items: [] };
  const C = J(dir, 'C-research-packet.json') || {};
  const N = J(dir, 'N-writer-packet-decisions.json') || [];
  const snap = J(dir, 'A2-query-snapshot.json');
  const html = T(dir, 'L-final-article.html').replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ');
  const rawText = (A.raw || []).flatMap((q) => (q.raw || []).map((r) => `${r.title} ${r.description}`)).join('\n');
  const cleanText = (B.items || []).map((i) => `${i.title} ${i.cleanedText || i.text || ''}`).join('\n');
  const claimText = ['facts', 'eligibility', 'conditions', 'officialStatements', 'conflictingInformation'].flatMap((k) => (C[k] || []).map((c) => c.claim)).join('\n');
  const values = [...(C.numbers || []), ...(C.dates || [])];
  const rows = CORE.map((v) => {
    const codeRow = values.find((x) => has(x.value, v) || has(v, x.value));
    const writerRow = N.find((d) => has(d.value, v) || has(v, d.value));
    return {
      value: v,
      SEARCH_RETRIEVAL: has(rawText, v) || has(cleanText, v),   // RAW 는 120자 스니펫이라 본문 값은 CLEAN 에서만 보인다
      CLEAN_RETENTION: has(cleanText, v),
      PACKET_LLM_SELECTION: has(claimText, v),
      DETERMINISTIC_RECOVERY: !!codeRow && codeRow.origin === 'DETERMINISTIC_RECOVERY',
      IN_RAW_PACKET: has(JSON.stringify(C), v),
      WRITER_PACKET_RETENTION: !!writerRow && writerRow.verdict !== 'DROP_FROM_WRITER_VIEW' && writerRow.tier !== 'CONTEXT_ONLY',
      FINAL_USAGE: has(html, v),
    };
  });
  return { dir: path.basename(dir), channels: snap ? { cacheHits: snap.CACHE_HITS, rateLimited: snap.RATE_LIMITED, recovered: snap.RECOVERED_AFTER_RETRY, degraded: snap.SEARCH_DEGRADED } : null, rows };
}

const runs = dirs.map(measure);
for (const r of runs) {
  console.log(`\n== ${r.dir}${r.channels ? ` · cache ${r.channels.cacheHits} · 429 ${r.channels.rateLimited} · recovered ${r.channels.recovered} · degraded ${r.channels.degraded}` : ''}`);
  for (const row of r.rows) console.log(`  ${row.value.padEnd(10)} retrieval ${row.SEARCH_RETRIEVAL ? 'O' : '-'} · clean ${row.CLEAN_RETENTION ? 'O' : '-'} · llm ${row.PACKET_LLM_SELECTION ? 'O' : '-'} · recovery ${row.DETERMINISTIC_RECOVERY ? 'O' : '-'} · rawPacket ${row.IN_RAW_PACKET ? 'O' : '-'} · writer ${row.WRITER_PACKET_RETENTION ? 'O' : '-'} · final ${row.FINAL_USAGE ? 'O' : '-'}`);
}
if (runs.length > 1) {
  console.log('\n== CORE_SOURCE_STABILITY (RAW_PACKET 기준 · 실행 수 분모)');
  for (const v of CORE) {
    const n = runs.filter((r) => r.rows.find((x) => x.value === v).IN_RAW_PACKET).length;
    const f = runs.filter((r) => r.rows.find((x) => x.value === v).FINAL_USAGE).length;
    console.log(`  ${v.padEnd(10)} packet ${n}/${runs.length} · final ${f}/${runs.length}`);
  }
}
