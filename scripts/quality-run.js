/**
 * 📏 글을 실제로 뽑아서 잰다 — 발행은 하지 않는다.
 *
 * 사장님: "글을 색인해도 될정도로 2차수정을 할필요없을정도의 글이나와야되는데
 *          10편테스트한거맞아? 진전이없어보이는데"
 *
 * 맞는 지적이다. 그동안 배관만 고치고 **결과를 잰 적이 없었다.**
 * 이 스크립트는 리포트가 정해 준 키워드로 실제 생성을 돌리고,
 * 사장님이 받은 평가에서 문제였던 항목을 그대로 잰다.
 *
 * 사용:
 *   node scripts/quality-run.js 3          ← 3편만 (먼저 이걸로 하네스를 확인한다)
 *   node scripts/quality-run.js 10
 *
 * 재는 것 (전부 발행글 평가에서 실제로 걸렸던 항목):
 *   · 하네스 점수 / 지적 종류
 *   · 구체 팩트 밀도 — "구체적인 사실이 부족합니다" 의 근거
 *   · 말투 섞임 — 해요체/합니다체
 *   · 작성 과정 노출 — "제공된 근거에는…"
 *   · 제목 약속 이행 — 리포트가 준 롱테일이 본문에 들어갔나 (v3.8.638 이 노린 바로 그것)
 */
const fs = require('fs');
const path = require('path');

const COUNT = Math.max(1, Math.min(10, Number(process.argv[2] || 3)));
const OUT_DIR = path.resolve(__dirname, '..', 'quality-run-output');

/** 앱이 쓰는 것과 같은 자리에서 키를 읽는다 */
function loadEnv() {
  const p = path.join(process.env.APPDATA || '', 'lba', '.env');
  const raw = fs.readFileSync(p, 'utf-8');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const at = line.indexOf('=');
    if (at > 0) env[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return env;
}

/** 확인 가능한 사실이 얼마나 촘촘한가 — 금액·기간·연월·기관명 */
function factDensity(text) {
  const nums = (text.match(/\d{1,3}(?:,\d{3})*\s*(?:원|만원|억|%|일|개월|년|주|시간|건|명|회)/g) || []).length;
  const dates = (text.match(/20\d\d[.\-년]\s?\d{1,2}|\d{1,2}월\s?\d{1,2}일/g) || []).length;
  const orgs = (text.match(/[가-힣]{2,10}(?:부|청|처|위원회|공단|공사|진흥원|은행|협회)\b/g) || []).length;
  const per1000 = ((nums + dates + orgs) / Math.max(1, text.length)) * 1000;
  return { nums, dates, orgs, per1000: Number(per1000.toFixed(2)) };
}

/** 리포트가 준 롱테일이 실제로 본문에 들어갔나 */
function longtailCoverage(text, longtails) {
  const norm = (s) => String(s || '').toLowerCase().replace(/[\s·,()「」"']/g, '');
  const body = norm(text);
  const hit = (longtails || []).filter((t) => {
    const words = String(t).split(/\s+/).filter((w) => w.length >= 2).slice(0, 6).map(norm);
    if (!words.length) return false;
    const found = words.filter((w) => body.includes(w)).length;
    return found / words.length >= 0.6;   // 낱말 대부분이 들어갔으면 다뤘다고 본다
  }).length;
  return { hit, total: (longtails || []).length };
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const env = loadEnv();
  for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;

  const { fetchLatestDriveReport } = require('../dist/core/keywords/drive-report');
  const { parseCpcReport, usableSlots } = require('../dist/core/keywords/cpc-report');
  const { auditArticle, toPlainText, findProcessLeak } = require('../dist/core/final/article-audit');
  const { generateUltimateMaxModeArticleFinal } = require('../dist/core/final/orchestration');
  require('../dist/core/content-modes/register-all');

  console.log('① 리포트를 가져온다');
  const found = await fetchLatestDriveReport({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    refreshToken: env.GOOGLE_DRIVE_REFRESH_TOKEN,
  });
  if (!found) { console.log('   리포트를 못 찾았습니다'); process.exit(1); }
  const report = parseCpcReport(found.markdown);
  let slots = usableSlots(report);
  console.log(`   ${found.name} — 항목 ${slots.length}개`);

  /**
   * v3.8.658 — 셋째 인자 'all': 최근 리포트 여러 장의 항목을 합쳐 **서로 다른 키워드**로 잰다.
   * 리포트 한 장은 항목이 2~3개뿐이라 5편을 돌리면 같은 키워드가 되풀이됐다(실측).
   * 같은 키워드만 반복하면 그 키워드 경로만 검증된다.
   */
  if (String(process.argv[4] || '') === 'all') {
    const { getAccessToken, listReportFiles, downloadReport } = require('../dist/core/keywords/drive-report');
    const token = await getAccessToken({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, refreshToken: env.GOOGLE_DRIVE_REFRESH_TOKEN });
    const files = (await listReportFiles(token)).filter((f) => !/백업/.test(f.name || '')).slice(0, 8);
    const seen = new Set(slots.map((s) => s.keyword));
    for (const f of files) {
      if (f.id === found.id) continue;
      try {
        for (const s of usableSlots(parseCpcReport(await downloadReport(token, f)))) {
          if (seen.has(s.keyword)) continue;
          seen.add(s.keyword);
          slots.push(s);
        }
      } catch { /* 형식이 다른 옛 리포트는 건너뛴다 */ }
    }
    console.log(`   리포트 ${files.length + 1}장 합침 — 서로 다른 키워드 ${slots.length}개`);
  }

  // 리포트 항목이 모자라면 그 항목들을 돌려 쓴다 (같은 설계도로 여러 편을 재는 셈)
  const jobs = [];
  // v3.8.658 — 둘째 인자로 시작 슬롯을 고른다: `node scripts/quality-run.js 5 3` → 4~8번째 항목
  const OFFSET = Math.max(0, Number(process.argv[3] || 0));
  /**
   * v3.8.670 — 사장님 설정대로 잰다. 지금까지는 애드센스 모드·전문적 말투로만 돌려서
   * 사장님이 실제로 쓰는 모드(CTA 있음)·말투(친근한)를 한 편도 안 읽었다.
   *   node scripts/quality-run.js 1 12 all --mode external --tone friendly
   */
  const flag = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback; };
  const MODE = flag('--mode', 'adsense');
  const TONE = flag('--tone', 'professional');
  console.log(`   모드 ${MODE} · 말투 ${TONE}`);
  for (let i = 0; i < COUNT; i++) jobs.push(slots[(i + OFFSET) % slots.length]);

  const rows = [];
  for (let i = 0; i < jobs.length; i++) {
    const slot = jobs[i];
    const keyword = slot.keyword || slot.title;
    console.log(`\n② [${i + 1}/${jobs.length}] 생성: ${keyword}`);
    const started = Date.now();
    globalThis.__llmUsage = { calls: 0, input: 0, output: 0, byModel: {} };
    try {
      /**
       * 엔진을 글마다 다시 못박는다.
       * payload.provider 만으로는 두 번째 글에서 기본값(Gemini)으로 샜다 —
       * 그 키는 유출 차단이라 그대로 실패한다. 앞 글이 남긴 상태에 기대지 않는다.
       */
      process.env.PRIMARY_TEXT_MODEL = 'openai-gpt41';
      const payload = {
        // orchestration 은 payload.topic 을 읽는다 — keyword 로 넣으면 빈 검색어가 나간다
        topic: keyword,
        keyword,
        // 앱과 같은 엔진. 안 정하면 기본값 Gemini 로 가는데 그 키는 차단돼 있다
        provider: 'openai',
        // 화면(posting.js getTitleOptions)과 같은 이름으로 — customTitle 은 아무도 안 읽는다
        titleMode: slot.title ? 'custom' : 'auto',
        title: slot.title || null,
        contentMode: MODE,
        toneStyle: TONE,
        platform: 'wordpress',
        cpcReportSlot: slot,
        cpcReportUrls: report.urls || [],
        skipImages: true,
      };
      const res = await generateUltimateMaxModeArticleFinal(payload, env, (m) => {
        // 🎯 는 v3.8.655/656 의 제목 약속 로그 — [PROGRESS] 로 나가지만 봐야 한다
        // 🎯 는 제목 약속 로그, ⚠️ 는 빈 소제목·보강 폐기·자가 수정 같은 고장 로그 — [PROGRESS] 로 나가지만 봐야 한다
        // 🧵 는 v3.8.672 의 실 로그(질문·의문 배정·위반) — 안 보이면 "실이 안 돌았다" 고 오판한다 (v3.8.673 실측)
        // 🧭 는 v3.8.678 답 상자 조립 로그
        if (/🎯|⚠️|🧵|🧭|빈 소제목|보강|폐기|자가 수정|자가 검수|제외했습니다/.test(m)) { console.log('     ' + m.replace(/^\[PROGRESS\]\s*\d+%\s*-\s*/, '').slice(0, 200)); return; }
        if (/PROGRESS/.test(m)) return;
        if (/리포트 설계도|속보|자가 수정|장부|소제목 교체|정해 둔 제목/.test(m)) console.log('     ' + m.slice(0, 140));
      });

      /**
       * 자가 수정이 돌았는지는 로그가 아니라 orchestration 이 남긴 값에서 읽는다.
       * (예전엔 onLog 에서 [PROGRESS] 를 전부 버려서 "안 돌았다" 고 오판했다 —
       *  자가 수정 메시지가 하필 [PROGRESS] 97% 로 나간다.)
       */
      const pf = globalThis.__lastPreflight || {};
      const u = globalThis.__llmUsage || { calls: 0, input: 0, output: 0 };
      // gpt-5.6-terra 공식 단가: 입력 $2 / 출력 $12 per 1M (pricing.ts)
      const usd = (u.input / 1e6) * 2 + (u.output / 1e6) * 12;
      const html = res.html || '';
      const text = toPlainText(html);
      // v3.8.655 — 제목을 넘겨야 「제목 약속 불이행」을 본다 (본문에 h1 이 없다)
      const finalTitle = String(res.title || slot.title || '');
      const audit = auditArticle(html, [], { title: finalTitle });
      const kinds = {};
      audit.issues.forEach((x) => { kinds[x.kind] = (kinds[x.kind] || 0) + 1; });

      rows.push({
        키워드: keyword.slice(0, 22),
        title: finalTitle,
        점수: audit.score,
        제목약속: kinds['title-promise-unkept'] || 0,
        FAQ딴답: kinds['faq-answer-mismatch'] || 0,
        빈약절: kinds['thin-section'] || 0,
        답노출: audit.stats.answerExposure,
        // v3.8.660 — 흐름·관점: 1인칭 판단 문장 수, 회피 표현 1,000자당 횟수
        관점: audit.stats.firstPersonStance,
        // v3.8.662 — 조건·행동을 갖춘 판단 / 전체 판단
        판단조건: `${audit.stats.sharpStances}/${audit.stats.totalStances}`,
        회피: audit.stats.deferralPer1000,
        글자: text.length,
        팩트밀도: factDensity(text).per1000,
        말투: `${audit.stats.politeEndings}:${audit.stats.formalEndings}`,
        중복: kinds['cross-section-echo'] || 0,
        과정노출: findProcessLeak(text).length,
        롱테일: (() => { const c = longtailCoverage(text, slot.longtails); return `${c.hit}/${c.total}`; })(),
        호출: u.calls,
        비용: '$' + usd.toFixed(3),
        초: Math.round((Date.now() - started) / 1000),
      });
      fs.writeFileSync(path.join(OUT_DIR, `${i + 1}-${keyword.slice(0, 20).replace(/[^가-힣a-zA-Z0-9]/g, '_')}.html`), html, 'utf-8');
      console.log('     →', JSON.stringify(rows[rows.length - 1]));
    } catch (e) {
      console.log('     ❌ 실패:', String(e && e.message || e).slice(0, 160));
      rows.push({ 키워드: keyword.slice(0, 22), 점수: null, 실패: String(e && e.message || e).slice(0, 60) });
    }
  }

  console.log('\n③ 결과');
  console.table(rows);
  const ok = rows.filter((r) => typeof r.점수 === 'number');
  if (ok.length) {
    const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    console.log('중간값 — 점수', med(ok.map((r) => r.점수)),
      '| 팩트밀도', med(ok.map((r) => r.팩트밀도)),
      '| 중복', med(ok.map((r) => r.중복)),
      '| 과정노출 합계', ok.reduce((s, r) => s + r.과정노출, 0));
  }
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(rows, null, 2), 'utf-8');
  console.log('산출물:', OUT_DIR);
})().catch((e) => { console.error('하네스 실패:', e); process.exit(1); });
