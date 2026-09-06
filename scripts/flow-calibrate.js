#!/usr/bin/env node
/**
 * 흐름 검사 보정 — 새 검사를 감점에 올리기 전에 이미 있는 산출물로 분포를 본다. (v3.8.671)
 *
 * 사장님 규칙: 검사기부터 검증한다. "0건" 은 검사기 고장 신호일 수 있고, 정상 글이 걸리면 검사기를 의심한다.
 *
 * 쓰는 법:
 *   npx tsc -p tsconfig.json   (dist 를 새로 만든 뒤 — npm run build 의 첫 단계)
 *   node scripts/flow-calibrate.js [폴더…]      기본: quality-run-output
 *
 * 출력: 편마다 세 검사(서론 질문 없음 · 절 점검형 닫음 · 결론 답 없음)의 발동 여부와 요약 분포.
 * AI 호출 0회, 비용 0.
 */
const fs = require('fs');
const path = require('path');

const { findFlowGaps } = require('../dist/core/final/narrative-flow');
const { toPlainText } = require('../dist/core/final/article-audit');

const KINDS = ['intro-question-missing', 'section-closer-checklist', 'conclusion-not-answering'];

function htmlFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.html?$/i.test(name)) out.push(p);
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out;
}

function titleOf(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? toPlainText(m[1]).trim() : '';
}

function main() {
  const dirs = process.argv.slice(2);
  const roots = dirs.length ? dirs : ['quality-run-output'];
  const files = roots.flatMap((r) => htmlFiles(path.resolve(r)));
  if (files.length === 0) {
    console.log('HTML 산출물이 없습니다:', roots.join(', '));
    process.exit(1);
  }
  const rows = [];
  const tally = Object.fromEntries(KINDS.map((k) => [k, 0]));
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const title = titleOf(html);
    const r = findFlowGaps(html, toPlainText, { title });
    const hit = {};
    for (const k of KINDS) {
      const issue = r.issues.find((i) => i.kind === k);
      hit[k] = issue ? issue.title.slice(0, 70) : '';
      if (issue) tally[k] += 1;
    }
    rows.push({ file: path.relative(process.cwd(), file).slice(0, 48), ...Object.fromEntries(KINDS.map((k) => [k.replace(/-.*$/, ''), hit[k] ? '●' : '·'])) });
    for (const k of KINDS) if (hit[k]) console.log(`  ${path.basename(file).slice(0, 40)}  [${k}] ${hit[k]}`);
  }
  console.table(rows);
  console.log(`편 ${files.length} —` + KINDS.map((k) => ` ${k} ${tally[k]}/${files.length}`).join(' ·'));
}

main();
