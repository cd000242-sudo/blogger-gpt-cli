#!/usr/bin/env node
/**
 * CTA 목적지 실측 — docs/cta-eval/seed.json 의 주제를 앱과 **같은 배선**으로 돌려 채점한다.
 *
 *   ① smart-cta(AI 가 목적지 이름·행동·필수 낱말·"없음" 판정)
 *   ② 네이버 webkr 검색
 *   ③ regenerateCta(레지스트리 호스트 우선 → 게이트 검산 → 기관 홈 폴백)
 *
 * 발행하지 않는다. 채점은 등록 도메인(apex) 일치로 한다 — 경로까지 맞추라는 게 아니라 "그 기관에 갔는가"다.
 *
 *   node scripts/cta-eval.js                 전부
 *   node scripts/cta-eval.js --tag probe     태그로 고름(첫 실측 15주제)
 *   node scripts/cta-eval.js --limit 10
 *   node scripts/cta-eval.js --out F:/작업폴더/cta-eval.json
 *
 * 사전 조건: npm run build (dist 를 읽는다), .env 에 네이버 API 키와 텍스트 모델 키.
 */
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env') });

const { regenerateCta } = require(path.join(ROOT, 'dist/cta/regenerate'));
const { resolveSmartCtaDecision } = require(path.join(ROOT, 'dist/cta/smart-cta'));
const { apexHost } = require(path.join(ROOT, 'dist/cta/host-trust'));
const { naverSearch } = require(path.join(ROOT, 'dist/core/naver-search-client'));

const args = process.argv.slice(2);
const argOf = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : ''; };
const tag = argOf('--tag');
const limit = Number(argOf('--limit') || 0);
const outPath = argOf('--out') || path.join(ROOT, 'docs/cta-eval/last-run.json');

const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/cta-eval/seed.json'), 'utf-8'));
const topics = seed.topics
  .filter((t) => !tag || (t.tags || []).includes(tag))
  .slice(0, limit > 0 ? limit : undefined);

async function search(query) {
  const res = await naverSearch('webkr', { query, display: 10 });
  if (!res || !res.ok) return [];
  return (res.items || []).map((it) => ({
    url: String(it.link || ''),
    title: String(it.title || '').replace(/<[^>]*>/g, ''),
  }));
}

/**
 * 앱과 같은 열기(page-fetcher) — 앱은 크로미움(net.fetch)으로 열어 인증서 체인이 불완전한 관공서도 열린다.
 * 이 측정기는 Node 라 그 차이를 메우려고 **이 프로세스에서만** 인증서 검증을 끈다(공개 HTML 만 읽는다).
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { createCtaPageFetcher } = require(path.join(ROOT, 'dist/cta/page-fetcher'));
const fetchPage = createCtaPageFetcher({ timeoutMs: 8000 });

/** 채점 — 기대 호스트 중 하나와 apex 가 같으면 ✅, none 기대에 버튼 없음이면 ✅ */
function grade(topic, row) {
  const expects = topic.expectHosts || [];
  const wantsNone = expects.includes('none');
  if (!row.picked) return wantsNone ? 'ok' : 'miss';
  const got = apexHost(row.picked.url);
  const hostOk = expects.some((h) => h !== 'none' && apexHost(h) === got);
  if (!hostOk) return 'wrong';
  const words = topic.mustHaveAny || [];
  if (words.length && !words.some((w) => String(row.picked.title || '').includes(w))) return 'weak';
  return 'ok';
}

(async () => {
  const rows = [];
  for (const topic of topics) {
    const { keyword, hint } = topic;
    const t0 = Date.now();
    let decision = null;
    try { decision = await resolveSmartCtaDecision({ keyword, articleHint: hint }); } catch (e) { decision = { error: String(e && e.message || e).slice(0, 80) }; }
    const target = decision && decision.target || null;
    const none = !!(decision && decision.none);
    let result;
    try {
      result = await regenerateCta({ keyword, articleText: hint, smartTarget: target, noDestination: none, search, fetchPage, maxProbe: 6 });
    } catch (e) { result = { ok: false, picked: null, log: ['예외: ' + String(e && e.message || e)], intent: null, agencies: [], query: '' }; }
    const row = {
      keyword,
      tags: topic.tags,
      expect: topic.expectHosts,
      aiSite: none ? '(없음 판정)' : (target && target.site) || (decision && decision.error ? 'AI오류:' + decision.error : '(미정)'),
      aiLabel: target && target.buttonLabel || '',
      mustHave: target && target.mustHave || [],
      intent: result.intent,
      agencies: result.agencies,
      query: result.query,
      picked: result.picked ? { url: result.picked.url, stage: result.picked.stage, score: result.picked.score, title: result.picked.title, reasons: result.picked.reasons } : null,
      log: result.log,
      ms: Date.now() - t0,
    };
    row.grade = grade(topic, row);
    rows.push(row);
    const mark = { ok: '✅', weak: '🟡', wrong: '❌', miss: '⚪' }[row.grade];
    console.log(`\n${mark} ${keyword}`);
    console.log(`   AI 목적지: ${row.aiSite} (${row.aiLabel}) 필수 낱말: ${row.mustHave.join(',') || '-'}`);
    console.log(`   행동: ${row.intent || '-'} · 기관: ${(row.agencies || []).join(',') || '-'} · 검색어: ${row.query || '-'}`);
    if (row.picked) console.log(`   → ${row.picked.stage} ${row.picked.score}점 ${row.picked.url}\n      "${row.picked.title}"`);
    else console.log(`   → 버튼 없음`);
    console.log('   ' + (row.log || []).slice(-3).join('\n   '));
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ ranAt: new Date().toISOString(), tag: tag || null, rows }, null, 2));
  const count = (g) => rows.filter((r) => r.grade === g).length;
  console.log(`\n=== ${rows.length}주제 · ✅정답 ${count('ok')} · 🟡약함 ${count('weak')} · ❌오답 ${count('wrong')} · ⚪미선택 ${count('miss')}`);
  console.log(`결과 파일: ${outPath}`);
})();
