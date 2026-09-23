/**
 * critique-targeted-edit — 「비평 개선」 버튼의 수정: **지적된 문단만** 고친다. (v3.8.750 · mode: critiqueTargeted)
 *
 * 감사(2026-09-23) 실측: 예전 수정(구간 통째 다시 쓰기)은 지적 한 건에 20~30문장짜리 구간을 새로 썼고,
 * 새로 쓴 문장이 다음 비평의 새 지적이 됐다 (5543: 수정 뒤 구간 반복 2건 + "이 구간의 자료만으로…" 같은 문장).
 * 그래서 이 모드는:
 *   · 지적의 근거 문장이 있는 **문단만** 모델에 보낸다. 나머지 문단은 바이트 하나 안 바뀐다.
 *   · 새 사실·수치를 막고, 원래 수치·인용을 지키고, 작성 과정 문장을 막는다 — 어기면 그 문단은 원문 그대로.
 *   · 고친 구간마다 코드 진단을 앞뒤로 재서 **새 BLOCKING 이 생기면 그 구간을 되돌린다** (호출 0회).
 *   · 새 근거가 있어야 풀리는 지적과 다른 도구로 고칠 지적은 모델을 부르지 않는다.
 *
 * 자동 품질 루프·발행 전 자가 수정(97%)은 이 모드를 쓰지 않는다 — improveDraft 기본 경로 그대로다.
 */

import {
  splitSections, evidenceProbe, isCuttingIssue, rewriteAbility,
  type CritiqueIssue, type PostSection,
} from './post-critique';
import {
  buttonDiagnose, classifyIssue, kindOf, stableIssueIdOf, leakSentences, evidenceInBody,
  openChain, sanitizeChain, canContinueChain, settleAfterEdit,
  type CritiqueChain, type ConvergenceView, type AiUpdate,
} from './critique-convergence';
import { leafBlocks, sentencesOf, type LeafBlock } from './leaf-blocks';
import { stripToPlainText } from './substance-gate';
import { verifySelectedIssues } from './revision-verification';
import type { DraftImprovement } from './editor-draft';

export interface TargetedImprovement extends DraftImprovement {
  mode: 'critiqueTargeted';
  /** 고치기 전 본문 글자 수 */
  before: number;
  /** 고친 결과가 새 BLOCKING 을 만들어 **되돌린** 구간 */
  regressions: Array<{ index: number; heading: string; titles: string[] }>;
  /** 정상 문장 보존 — 지적되지 않은 문단은 그대로여야 한다 */
  preservation: {
    blocksTotal: number; blocksTargeted: number; blocksChanged: number;
    untouchedTotal: number; untouchedKept: number;
    sentencesTotal: number; sentencesKept: number;
  };
  chain: CritiqueChain;
  convergence: ConvergenceView;
}

const plain = (html: string): string => stripToPlainText(String(html || ''));
const squash = (text: string): string => String(text || '').replace(/[“”"'‘’「」『』…⏎]/g, '').replace(/\s+/g, '');
const clip = (text: string, n: number): string => (text.length > n ? `${text.slice(0, n)}…` : text);

const BLOCK_TAG_IN_INNER = /<\/?(?:p|div|h[1-6]|ul|ol|li|table|thead|tbody|tr|td|th|section|article|blockquote|figure|figcaption|dl|dd|dt|pre)\b/gi;

/** 문단 안쪽만 갈아끼운다. 빈 문자열이면 문단째 지운다. 뒤에서부터 바꿔야 앞 위치가 안 밀린다 */
function applyBlockEdits(sectionHtml: string, edits: Array<{ block: LeafBlock; inner: string }>): string {
  return [...edits]
    .sort((a, b) => b.block.start - a.block.start)
    .reduce((html, { block, inner }) => (inner.trim()
      ? html.slice(0, block.openEnd) + inner + html.slice(block.closeStart)
      : html.slice(0, block.start) + html.slice(block.end).replace(/^[ \t]*\r?\n/, '')), sectionHtml);
}

/** 구간 하나만 바꾼 본문 — splitSections 는 빈틈없이 덮으므로 이어 붙이면 원본과 같다 */
function replaceSection(html: string, index: number, next: string): string {
  return splitSections(html).map((s) => (s.index === index ? next : s.html)).join('');
}

/* ────────────────────────────────────────────────────────────────
 * 위치 찾기 — 지적의 근거 문장이 있는 문단
 * ──────────────────────────────────────────────────────────────── */

function probesOf(issue: CritiqueIssue): string[] {
  const evidence = String(issue.evidence || '');
  const quotedEvidence = evidence.match(/^\s*"([^"]{6,}?)…?"/);
  const quotedTitle = String(issue.title || '').match(/"([^"]{2,})"\s*$/);
  const raw = kindOf(issue) === 'audit-replacement-artifact' && quotedTitle
    ? quotedTitle[1]!
    : quotedEvidence ? quotedEvidence[1]! : evidenceProbe(evidence);
  const probe = squash(plain(raw)).slice(0, 30);
  return probe.length >= 6 ? [probe] : [];
}

interface Spot { sectionIndex: number; block: LeafBlock }

function locate(issue: CritiqueIssue, mapped: Array<{ section: PostSection; blocks: LeafBlock[] }>): Spot[] {
  const isAnswer = kindOf(issue) === 'answer-missing' || issue.aiType === 'answer-missing';
  if (isAnswer) {
    // 답은 도입부에 — 답 상자가 있으면 그 답 문단, 없으면 도입부 첫 문단
    const firstText = (index: number) => mapped.find((m) => m.section.index === index)?.blocks.find((b) => b.tag === 'p' && b.text.length >= 20);
    const answerBox = mapped.find((m) => m.section.index === 0)?.blocks.find((b) => /answer-first-a/.test(b.open));
    const pick = answerBox ? { sectionIndex: 0, block: answerBox }
      : firstText(0) ? { sectionIndex: 0, block: firstText(0)! }
        : firstText(1) ? { sectionIndex: 1, block: firstText(1)! } : null;
    return pick ? [pick] : [];
  }
  const isEcho = /(^|\n)\s*뒤\s*[:：]/.test(String(issue.evidence || ''));
  return probesOf(issue).flatMap((probe) => {
    const hits = mapped.flatMap((m) => m.blocks.filter((b) => squash(b.text).includes(probe)).map((block) => ({ sectionIndex: m.section.index, block })));
    const inSection = hits.filter((h) => h.sectionIndex === issue.sectionIndex);
    const pool = inSection.length ? inSection : hits;
    // 구간 반복은 뒤 절을 고친다 — 같은 문장이 앞 절에도 있다
    const pick = isEcho ? pool[pool.length - 1] : pool[0];
    return pick ? [pick] : [];
  });
}

/* ────────────────────────────────────────────────────────────────
 * 모델에 보내는 것 · 받는 것
 * ──────────────────────────────────────────────────────────────── */

const DELETE_KINDS = /writing-process-leak|meta-leak|cross-section-echo|procedure-repeat|redundancy-repeat|hedge-repeat|inline-faq/;
const DELETE_TYPES = new Set(['process-leak', 'fact-error', 'unsupported-claim', 'entity-mixup', 'misleading-action', 'title-contradiction']);

function targetedFix(issue: CritiqueIssue): string {
  const kind = kindOf(issue);
  const type = String(issue.aiType || '');
  if (/writing-process-leak|meta-leak/.test(kind) || type === 'process-leak') return '작성 과정·자료 한계를 말하는 그 문장만 지웁니다. 나머지 문장은 그대로 둡니다.';
  if (kind === 'audit-replacement-artifact' || type === 'artifact') return '"$1"·"undefined" 같은 찌꺼기만 지우고 앞뒤 말을 자연스럽게 잇습니다.';
  if (/cross-section-echo|procedure-repeat|redundancy-repeat/.test(kind)) return '앞 구간과 겹치는 그 문장만 지웁니다. 빈자리를 새 문장으로 채우지 않습니다.';
  if (kind === 'answer-missing' || type === 'answer-missing') return '문단 첫머리에 제목 질문에 대한 판정 한 문장을 넣습니다 — 이 글에 이미 있는 사실만 씁니다. 나머지 문장은 그대로 둡니다.';
  if (type === 'fact-error' || type === 'unsupported-claim') return '지적된 주장을 지우거나 단정하지 않게 낮춥니다. 맞는 값을 새로 지어 넣지 않습니다.';
  if (type === 'entity-mixup') return '다른 인물·지역·상품이 섞인 문장을 지웁니다. 바로잡을 값이 이 글 안에 있을 때만 그 값으로 고칩니다.';
  if (type === 'title-contradiction') return '제목과 부딪히는 문장을 지우거나 어긋나지 않게 낮춥니다. 새 사실은 넣지 않습니다.';
  if (type === 'misleading-action') return '독자를 잘못된 행동으로 이끄는 문장을 지우거나, 이 글에 이미 있는 올바른 절차로 바꿉니다.';
  return `${String(issue.fix || issue.detail || '').slice(0, 240)} (지적된 문장만 고칩니다)`;
}

interface Target { id: string; block: LeafBlock; issues: CritiqueIssue[]; deletable: boolean; inner: string }

/** 구간 반복 근거("앞: …\n뒤: …")는 이 문단에 있는 뒤 문장만 보여 준다 — 앞 문장은 다른 구간에 있다 */
const evidenceShown = (issue: CritiqueIssue): string => {
  const evidence = String(issue.evidence || '');
  return /(^|\n)\s*뒤\s*[:：]/.test(evidence) ? evidenceProbe(evidence) : evidence;
};

function toneCount(text: string): { haeyo: number; hamnida: number } {
  const ends = sentencesOf(text);
  return {
    haeyo: ends.filter((s) => /(?:요|죠)[.?!]$/.test(s)).length,
    hamnida: ends.filter((s) => /(?:니다|니까)[.?!]$/.test(s)).length,
  };
}

function buildTargetedPrompt(input: { title: string; section: PostSection; targets: Target[]; outline: string; note: string }): string {
  const sectionText = plain(input.section.html);
  const tone = toneCount(sectionText);
  const blocks = input.targets.map((t) => [
    `[${t.id}]`,
    t.inner.trim(),
    ...t.issues.map((issue, i) => `  지적 ${i + 1}: ${issue.title}${issue.evidence ? `\n    근거: "${clip(plain(evidenceShown(issue)), 160)}"` : ''}\n    고칠 방향: ${targetedFix(issue)}`),
    t.deletable ? '  (문단 전체가 지적 대상이면 "html": "" 로 지워도 됩니다)' : '  (이 문단은 지우지 마세요)',
  ].join('\n')).join('\n\n');
  return [
    `당신은 "${input.title}" 글의 교정 편집자입니다. 글을 다시 쓰지 않습니다 — **지적된 문단의 지적된 부분만** 고칩니다.`,
    '',
    `# 구간 소제목\n${input.section.heading}`,
    '',
    `# 이 구간 전체 (읽기 전용 — 맥락·말투 참고용, 출력하지 마세요)\n${clip(sectionText, 3000)}`,
    ...(input.outline ? ['', `# 글의 다른 구간 요지 (읽기 전용)\n${clip(input.outline, 1800)}`] : []),
    '',
    `# 고칠 문단 — 아래 [B…] 만 출력 대상입니다\n${blocks}`,
    '',
    '# 규칙 (어기면 그 문단은 버려지고 원문이 남습니다)',
    '· 지적과 관계없는 문장은 글자 하나 바꾸지 말고 그대로 둡니다. 문단을 새로 쓰지 않습니다.',
    '· 새 사실·수치·날짜·기관명·인용을 넣지 않습니다. 근거 없는 문장은 지우거나 단정하지 않게 낮춥니다.',
    '· 원래 있던 수치·날짜·따옴표 인용은 지적이 가리킨 것이 아니면 그대로 둡니다.',
    '· 자료·근거·출처의 한계나 글 쓰는 과정을 말하지 않습니다. "이 구간의 자료만으로 확인할 수 없습니다", "자료에 없으므로 작성할 수 없습니다", "근거가 부족합니다", "해당 수치는 임의로 적으면 안 됩니다", "이 글에서는 확인할 수 없습니다" 같은 문장은 전부 금지입니다 — 확인 못 한 내용은 쓰지 않으면 됩니다.',
    `· 말투: 이 구간은 합니다체 ${tone.hamnida}문장 · 해요체 ${tone.haeyo}문장입니다. 고친 문장도 그 문단의 원래 어미를 따릅니다.`,
    '· 링크(<a>)·이미지(<img>)·강조(<strong> 등)는 그대로 둡니다. <p> 같은 문단 태그는 쓰지 말고 문단 **안쪽** HTML 만 씁니다.',
    '',
    '# 출력 — JSON 하나만. 설명·코드블록 금지.',
    '{"blocks":[{"id":"B1","html":"고친 문단 안쪽 HTML"}]}',
    '목록에 없는 id 는 쓰지 마세요. 고칠 게 없는 문단은 빼도 됩니다.',
    ...(input.note ? ['', input.note] : []),
  ].join('\n');
}

export function parseBlockAnswers(raw: string): Map<string, string> | null {
  const text = String(raw || '').replace(/```(?:json)?/gi, '').trim();
  const spans = [[text.indexOf('{'), text.lastIndexOf('}')], [text.indexOf('['), text.lastIndexOf(']')]]
    .filter(([a, b]) => a! >= 0 && b! > a!)
    .map(([a, b]) => text.slice(a, b! + 1));
  for (const span of spans) {
    try {
      const parsed: unknown = JSON.parse(span);
      const list: unknown = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' ? (parsed as { blocks?: unknown }).blocks : null);
      if (!Array.isArray(list)) continue;
      return new Map((list as unknown[])
        .filter((it): it is { id: string; html: string } => !!it && typeof (it as { id?: unknown }).id === 'string' && typeof (it as { html?: unknown }).html === 'string')
        .map((it) => [it.id.trim(), it.html] as [string, string]));
    } catch {
      /* 다음 후보 */
    }
  }
  return null;
}

/* ────────────────────────────────────────────────────────────────
 * 문단 관문 — 하나라도 어기면 그 문단은 원문
 * ──────────────────────────────────────────────────────────────── */

const UNCHANGED = '바뀐 것이 없습니다';
const digitsOf = (text: string): string[] => String(text || '').match(/\d+(?:[.,]\d+)*/g) || [];
const quotesOf = (text: string): string[] => [...String(text || '').matchAll(/[“"「『]([^”"」』]{2,40})[”"」』]/g)].map((m) => m[1]!.trim());

function cleanInner(raw: string, tag: string): string {
  const text = String(raw || '').replace(/```[a-z]*\s*/gi, '').replace(/```/g, '').trim();
  const wrapped = text.match(new RegExp(`^<${tag}\\b[^>]*>([\\s\\S]*)</${tag}>$`, 'i'));
  return (wrapped ? wrapped[1]! : text).trim();
}

export function checkBlock(input: {
  beforeInner: string;
  after: string;
  tag: string;
  issues: CritiqueIssue[];
  deletable: boolean;
  articleDigits: Set<string>;
}): { ok: true; inner: string } | { ok: false; reason: string } {
  const fail = (reason: string) => ({ ok: false as const, reason });
  const inner = cleanInner(input.after, input.tag);
  if (inner.replace(/\s+/g, ' ') === input.beforeInner.trim().replace(/\s+/g, ' ')) return fail(UNCHANGED);
  const beforeText = plain(input.beforeInner);
  const afterText = plain(inner);
  const flagged = input.issues.map((i) => `${i.title} ${plain(i.evidence)}`).join(' ');
  const flaggedDigits = new Set(digitsOf(flagged));
  const afterDigits = new Set(digitsOf(afterText));
  const lostDigits = digitsOf(beforeText).filter((d) => !afterDigits.has(d) && !flaggedDigits.has(d));

  if (!afterText) {
    if (!input.deletable) return fail('이 문단은 지우면 안 됩니다 (지적은 일부 문장만 가리킵니다)');
    if (/<img\b|<a\b/i.test(input.beforeInner)) return fail('이미지·링크가 든 문단을 지웠습니다');
    if (lostDigits.length) return fail(`지적과 관계없는 수치까지 지웠습니다 (${lostDigits[0]})`);
    return { ok: true, inner: '' };
  }
  if ((inner.match(BLOCK_TAG_IN_INNER) || []).length > (input.beforeInner.match(BLOCK_TAG_IN_INNER) || []).length) {
    return fail('문단 태그를 새로 넣었습니다 — 문단 안쪽만 쓰세요');
  }
  const flat = inner.replace(/\s+/g, ' ');
  if ((input.beforeInner.match(/<img\b[^>]*>/gi) || []).some((img) => !flat.includes(img.replace(/\s+/g, ' ')))) return fail('이미지가 사라지거나 바뀌었습니다');
  if ([...input.beforeInner.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].some((m) => !inner.includes(m[1]!))) return fail('링크가 사라졌습니다');
  const newDigits = digitsOf(afterText).filter((d) => !input.articleDigits.has(d));
  if (newDigits.length) return fail(`본문에 없던 수치가 들어갔습니다 (${newDigits[0]})`);
  if (lostDigits.length) return fail(`원래 있던 수치가 사라졌습니다 (${lostDigits[0]})`);
  const lostQuote = quotesOf(beforeText).find((q) => !afterText.includes(q) && !flagged.includes(q));
  if (lostQuote) return fail(`따옴표 인용이 사라졌습니다 ("${lostQuote.slice(0, 20)}")`);
  // 개수가 아니라 문장으로 본다 — 누출 한 문장을 다른 누출 문장으로 바꿔 넣어도 막아야 한다
  const leaksBefore = new Set(leakSentences(beforeText).map(squash));
  if (leakSentences(afterText).some((s) => !leaksBefore.has(squash(s)))) return fail('작성 과정·자료 한계를 말하는 문장이 들어갔습니다');
  if (!input.deletable && afterText.length < beforeText.length * 0.6) return fail(`문단이 너무 줄었습니다 (${beforeText.length}자 → ${afterText.length}자)`);
  if (afterText.length > Math.max(beforeText.length * 1.8, beforeText.length + 160)) {
    return fail(`문단이 너무 늘었습니다 (${beforeText.length}자 → ${afterText.length}자) — 다시 쓰기가 아니라 고치기입니다`);
  }
  // 지적과 관계없는 문장은 그대로 — 문단을 통째로 새로 쓰는 것을 막는다
  const flaggedFlat = squash(flagged);
  const keep = sentencesOf(beforeText).filter((s) => !flaggedFlat.includes(squash(s).slice(0, 16)));
  if (keep.length >= 2) {
    const afterFlat = squash(afterText);
    const kept = keep.filter((s) => afterFlat.includes(squash(s))).length;
    if (kept / keep.length < 0.6) return fail(`지적과 관계없는 문장까지 바꿨습니다 (${keep.length}문장 중 ${kept}문장만 그대로)`);
  }
  const tb = toneCount(beforeText);
  const ta = toneCount(afterText);
  const totalB = tb.haeyo + tb.hamnida;
  const totalA = ta.haeyo + ta.hamnida;
  if (totalB >= 2 && totalA >= 1) {
    const dominant = tb.hamnida >= tb.haeyo ? 'hamnida' : 'haeyo';
    if (tb[dominant] / totalB >= 0.7 && ta[dominant] / totalA < 0.5) return fail('문단의 말투(어미)가 바뀌었습니다');
  }
  return { ok: true, inner };
}

/* ────────────────────────────────────────────────────────────────
 * 구간 하나 — 호출 최대 2회 (반려된 문단만 이유를 붙여 한 번 더)
 * ──────────────────────────────────────────────────────────────── */

async function editSection(input: {
  title: string;
  section: PostSection;
  entries: Array<{ block: LeafBlock; issues: CritiqueIssue[] }>;
  articleDigits: Set<string>;
  outline: string;
  callModel: (prompt: string) => Promise<string>;
}): Promise<{ edits: Array<{ block: LeafBlock; inner: string; issues: CritiqueIssue[] }>; skipped: string[]; calls: number }> {
  const heading = input.section.heading;
  const targets: Target[] = input.entries.map((entry, i) => ({
    id: `B${i + 1}`,
    block: entry.block,
    issues: entry.issues,
    inner: input.section.html.slice(entry.block.openEnd, entry.block.closeStart),
    deletable: !/answer-first/.test(entry.block.open)
      && entry.issues.some((issue) => DELETE_KINDS.test(kindOf(issue)) || DELETE_TYPES.has(String(issue.aiType || '')) || isCuttingIssue(issue)),
  }));
  const edits: Array<{ block: LeafBlock; inner: string; issues: CritiqueIssue[] }> = [];
  const skipped: string[] = [];
  let pending = targets;
  let note = '';
  let calls = 0;
  for (let attempt = 1; attempt <= 2 && pending.length; attempt += 1) {
    let raw = '';
    try {
      calls += 1;
      raw = await input.callModel(buildTargetedPrompt({ title: input.title, section: input.section, targets: pending, outline: input.outline, note }));
    } catch (error: unknown) {
      skipped.push(`${heading}: ${String((error as Error)?.message || error).slice(0, 100)}`);
      break;
    }
    const answers = parseBlockAnswers(raw);
    if (!answers) {
      if (attempt === 2) skipped.push(`${heading}: 응답을 읽지 못해 원문을 지켰습니다 (2회 시도)`);
      note = '# ⚠️ 방금 답은 JSON 이 아니었습니다. {"blocks":[…]} 형식 하나만 출력하세요.';
      continue;
    }
    const retry: Array<{ target: Target; reason: string }> = [];
    for (const target of pending) {
      const answer = answers.get(target.id);
      if (answer === undefined) continue;   // 모델이 고칠 게 없다고 본 문단 — 그대로 둔다
      const verdict = checkBlock({ beforeInner: target.inner, after: answer, tag: target.block.tag, issues: target.issues, deletable: target.deletable, articleDigits: input.articleDigits });
      if (verdict.ok) edits.push({ block: target.block, inner: verdict.inner, issues: target.issues });
      else if (verdict.reason !== UNCHANGED) retry.push({ target, reason: verdict.reason });
    }
    if (!retry.length) break;
    if (attempt === 2) {
      skipped.push(...retry.map((r) => `${heading}: ${r.reason} — 두 번 시도해 원문을 지켰습니다 (2회 시도)`));
      break;
    }
    pending = retry.map((r) => r.target);
    note = [
      '# ⚠️ 방금 고친 문단 중 규칙을 어긴 것이 있어 버렸습니다',
      ...retry.map((r) => `· [${r.target.id}] ${r.reason}`),
      '위 문단만 다시 고치세요. 지적과 관계없는 문장은 그대로 두고, 새 수치·작성 과정 문장은 넣지 마세요.',
    ].join('\n');
  }
  return { edits, skipped, calls };
}

/* ────────────────────────────────────────────────────────────────
 * 빈 절 — 모델 없이 절째 뺀다 (근거 없이 채우면 지어내게 된다)
 * ──────────────────────────────────────────────────────────────── */

export function removeEmptySection(html: string, heading: string): string | null {
  const want = squash(heading).slice(0, 30);
  if (!want) return null;
  for (const m of html.matchAll(/<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    if (!squash(plain(m[2] || '')).startsWith(want)) continue;
    const from = m.index ?? 0;
    const bodyStart = from + m[0].length;
    const rest = html.slice(bodyStart);
    if (m[1] === '2' && /^\s*<h3\b/i.test(rest)) return null;   // h2 아래 h3 가 있으면 빈 절이 아니다
    const next = rest.search(m[1] === '2' ? /<h2\b/i : /<h[23]\b/i);
    const end = next < 0 ? html.length : bodyStart + next;
    const body = html.slice(bodyStart, end);
    if (squash(plain(body)).length >= 20 || /<img\b|<a\b|<table\b/i.test(body)) return null;
    const without = html.slice(0, from) + html.slice(end);
    // 목차에 같은 이름의 항목이 있으면 함께 뺀다 — 없는 절로 가는 목차는 깨진 링크다
    const tocItem = [...without.matchAll(/<li\b[^>]*>((?:(?!<\/li>)[\s\S])*?)<\/li>/gi)]
      .find((li) => squash(plain(li[1] || '')).replace(/^\d+[.)]?/, '').startsWith(want.replace(/^\d+[.)]?/, '')));
    return tocItem ? without.slice(0, tocItem.index) + without.slice((tocItem.index ?? 0) + tocItem[0].length) : without;
  }
  return null;
}

/* ────────────────────────────────────────────────────────────────
 * 새 BLOCKING — 고치기 전후 코드 진단 비교 (호출 0회)
 * ──────────────────────────────────────────────────────────────── */

function blockingOf(title: string, html: string): Map<string, string> {
  const body = plain(html);
  return new Map(buttonDiagnose({ title, html })
    .filter((issue) => classifyIssue(issue, body) === 'BLOCKING')
    .map((issue) => [stableIssueIdOf(issue), issue.title] as [string, string]));
}

export function newBlocking(title: string, beforeHtml: string, afterHtml: string): string[] {
  const before = blockingOf(title, beforeHtml);
  return [...blockingOf(title, afterHtml)].filter(([key]) => !before.has(key)).map(([, t]) => t);
}

function measurePreservation(before: string, after: string, targeted: Set<string>, changed: number): TargetedImprovement['preservation'] {
  const blocks = leafBlocks(before).map((b) => before.slice(b.start, b.end));
  const untouched = blocks.filter((outer) => !targeted.has(outer));
  const sentences = sentencesOf(plain(before));
  const afterFlat = squash(plain(after));
  return {
    blocksTotal: blocks.length,
    blocksTargeted: targeted.size,
    blocksChanged: changed,
    untouchedTotal: untouched.length,
    untouchedKept: untouched.filter((outer) => after.includes(outer)).length,
    sentencesTotal: sentences.length,
    sentencesKept: sentences.filter((s) => afterFlat.includes(squash(s))).length,
  };
}

const plainLength = (html: string): number => String(html || '').replace(/<[^>]+>/g, '').trim().length;
const MAX_BLOCKS = 8;

/**
 * 고른 지적의 **문단만** 고친다. 발행하지 않는다.
 *
 * 순서:
 *   ① 체인을 잇는다(없으면 고른 지적으로 세운다).
 *   ② 새 근거가 필요하거나 다른 도구로 고칠 지적은 부르지 않는다.
 *   ③ 지적의 근거 문장이 있는 문단을 찾는다. 못 찾으면 부르지 않는다.
 *   ④ 구간마다 그 문단들만 보내 고친다 — 문단 관문을 어기면 원문, 구간 결과가 새 BLOCKING 을 만들면 구간째 원문.
 *   ⑤ 빈 절은 모델 없이 뺀다(새 BLOCKING 이 생기면 되돌린다).
 *   ⑥ 다시 재서 해결된 것만 해결로 친다. AI 지적은 근거 문장이 사라졌을 때만 검수 1회.
 */
export async function improveTargeted(input: {
  title: string;
  html: string;
  issues: CritiqueIssue[];
  callModel: (prompt: string) => Promise<string>;
  log?: (line: string) => void;
  verify?: boolean;
  chain?: unknown;
}): Promise<TargetedImprovement> {
  const title = String(input.title || '').trim();
  const previousHtml = String(input.html || '');
  const sections0 = splitSections(previousHtml);
  const issues: CritiqueIssue[] = (input.issues || []).filter(Boolean).map((issue, index) => ({
    ...issue,
    id: String(issue.id || `request-${index}`),
    title: String(issue.title || ''),
    fix: String(issue.fix || issue.detail || ''),
    sectionIndex: Number.isInteger(issue.sectionIndex) && sections0.some((s) => s.index === issue.sectionIndex) ? issue.sectionIndex : -1,
  }));

  // ①
  const chain0: CritiqueChain = (canContinueChain(input.chain, { title, html: previousHtml }) && sanitizeChain(input.chain))
    || openChain({ title, html: previousHtml, issues }).chain;

  // ②
  const skipped: string[] = [];
  const workable = issues.filter((issue) => {
    const ability = rewriteAbility(issue, { targeted: true });
    if (!ability.fixable) skipped.push(`${issue.title}: ${ability.hint}`);
    return ability.fixable;
  });
  if (workable.length < issues.length) input.log?.(`   ⏭️ 수정 버튼으로 고치지 않는 지적 ${issues.length - workable.length}건 — 모델을 부르지 않습니다 (이유는 창에 적습니다)`);

  // ③
  const mapped = sections0.map((section) => ({ section, blocks: leafBlocks(section.html) }));
  const emptySections = workable.filter((issue) => kindOf(issue) === 'audit-empty-section');
  const bySection = new Map<number, Array<{ block: LeafBlock; issues: CritiqueIssue[] }>>();
  let blockCount = 0;
  for (const issue of workable.filter((i) => kindOf(i) !== 'audit-empty-section')) {
    const spots = locate(issue, mapped);
    if (!spots.length) {
      skipped.push(`${issue.title}: 고칠 문단을 본문에서 특정하지 못해 손대지 않았습니다 (근거 문장이 본문에 없습니다)`);
      continue;
    }
    for (const spot of spots) {
      const list = bySection.get(spot.sectionIndex) || [];
      const same = list.find((e) => e.block.start === spot.block.start);
      if (same) { bySection.set(spot.sectionIndex, list.map((e) => (e === same ? { ...e, issues: [...e.issues, issue] } : e))); continue; }
      if (blockCount >= MAX_BLOCKS) { skipped.push(`${issue.title}: 한 번에 고치는 문단 상한(${MAX_BLOCKS}개)을 넘어 이번에는 손대지 않았습니다`); continue; }
      blockCount += 1;
      bySection.set(spot.sectionIndex, [...list, { block: spot.block, issues: [issue] }]);
    }
  }
  input.log?.(`   🎯 고칠 지적 ${workable.length}건 → 지적된 문단 ${blockCount}개만 고칩니다 (나머지 문단은 그대로)`);

  // ④
  const articleDigits = new Set(digitsOf(plain(previousHtml)));
  const needsOutline = workable.some((i) => kindOf(i) === 'answer-missing' || i.aiType === 'answer-missing');
  const outline = needsOutline
    ? sections0.filter((s) => s.index > 0).map((s) => `· ${s.heading}: ${clip(plain(s.html).replace(s.heading, '').trim(), 140)}`).join('\n')
    : '';
  let html = previousHtml;
  const changed = new Map<number, { heading: string; before: string; after: string; blocks: number; issues: string[] }>();
  const regressions: TargetedImprovement['regressions'] = [];
  const editedText = new Map<string, string>();   // 지적 id → 고친 문단의 새 글
  const targetedOuter = new Set<string>();
  const order = [...bySection.keys()].sort((a, b) => a - b);
  for (const [n, index] of order.entries()) {
    const section = splitSections(html).find((s) => s.index === index);
    const entries = bySection.get(index) || [];
    if (!section) continue;
    entries.forEach((e) => targetedOuter.add(section.html.slice(e.block.start, e.block.end)));
    input.log?.(`[PROGRESS] ${10 + Math.floor((n / Math.max(1, order.length)) * 70)}% - ✍️ ${n + 1}/${order.length} "${section.heading.slice(0, 26)}" — 지적된 문단 ${entries.length}개만 고치는 중…`);
    const outcome = await editSection({ title, section, entries, articleDigits, outline, callModel: input.callModel });
    skipped.push(...outcome.skipped);
    if (!outcome.edits.length) continue;
    const nextSection = applyBlockEdits(section.html, outcome.edits);
    const candidate = replaceSection(html, index, nextSection);
    const fresh = newBlocking(title, html, candidate);
    if (fresh.length) {
      regressions.push({ index, heading: section.heading, titles: fresh });
      skipped.push(`${section.heading}: 고친 결과가 새 「반드시 고칠 것」(${fresh.join(' · ').slice(0, 100)})을 만들어 이 구간은 원문을 지켰습니다`);
      input.log?.(`   ↩️ "${section.heading.slice(0, 20)}" 수정이 새 결함을 만들어 되돌렸습니다 — ${fresh[0]}`);
      continue;
    }
    html = candidate;
    outcome.edits.forEach((e) => e.issues.forEach((issue) => editedText.set(issue.id, plain(e.inner))));
    changed.set(index, {
      heading: section.heading, before: section.html, after: nextSection, blocks: outcome.edits.length,
      issues: [...new Set(outcome.edits.flatMap((e) => e.issues.map((i) => i.title)))],
    });
  }

  // ⑤
  const removed: Array<{ index: number; heading: string; issue: string }> = [];
  for (const issue of emptySections) {
    const heading = (String(issue.title).match(/"([^"]+)"/) || [])[1] || '';
    const next = heading ? removeEmptySection(html, heading) : null;
    if (!next) { skipped.push(`${issue.title}: 뺄 수 있는 빈 절을 특정하지 못했습니다`); continue; }
    const fresh = newBlocking(title, html, next);
    if (fresh.length) {
      regressions.push({ index: issue.sectionIndex, heading, titles: fresh });
      skipped.push(`${issue.title}: 절을 빼면 새 「반드시 고칠 것」(${fresh[0]})이 생겨 그대로 뒀습니다`);
      continue;
    }
    html = next;
    removed.push({ index: issue.sectionIndex, heading, issue: issue.title });
  }

  // ⑥
  const finalText = plain(html);
  const finalKeys = new Set(buttonDiagnose({ title, html }).map(stableIssueIdOf));
  const codeFixed = workable.filter((i) => i.origin !== 'ai' && html !== previousHtml && !finalKeys.has(stableIssueIdOf(i)));
  const aiEdited = workable.filter((i) => i.origin === 'ai' && editedText.has(i.id));
  const aiCandidates = aiEdited.filter((i) => !evidenceInBody(i.evidence, finalText));
  let aiResolved: string[] = [];
  if (aiCandidates.length) {
    if (input.verify === false) {
      aiResolved = aiCandidates.map((i) => i.id);
    } else {
      input.log?.('[PROGRESS] 90% - 🔎 AI 가 짚은 결함이 풀렸는지 바뀐 문단만 넘겨 검수합니다 (1회)');
      aiResolved = await verifySelectedIssues({
        title,
        changes: [...changed.values()].map((c) => ({ heading: c.heading, before: plain(c.before), after: plain(c.after) })),
        issues: aiCandidates,
        callModel: input.callModel,
      });
    }
  }
  const aiUpdates = new Map<string, AiUpdate>(aiCandidates.map((issue) => [stableIssueIdOf(issue), aiResolved.includes(issue.id)
    ? { state: 'RESOLVED', evidence: '', anchored: false }
    // 검수가 "안 풀렸다"고 하면 고친 문단의 새 글을 근거로 다시 잡는다 — 다음 확인에서 그대로 재진다
    : { evidence: clip(editedText.get(issue.id) || '', 160), anchored: !!editedText.get(issue.id) }] as [string, AiUpdate]));
  const fixedIds = new Set([...codeFixed.map((i) => i.id), ...aiResolved]);
  const actuallyFixed = workable.filter((i) => fixedIds.has(i.id)).map((i) => i.title);
  const stillPresent = issues.filter((i) => !fixedIds.has(i.id)).map((i) => i.title);
  if (stillPresent.length) input.log?.(`   ⚠️ 고친 뒤에도 남은 지적 ${stillPresent.length}건 — 화면에 그대로 알립니다`);

  const revisedSections = [...changed.keys(), ...removed.map((r) => r.index).filter((i) => i >= 0)];
  const settled = settleAfterEdit({ title, html, chain: chain0, revisedSections, aiUpdates });
  const revisedDetail = [
    ...[...changed].map(([index, c]) => ({ index, heading: c.heading, before: plainLength(c.before), after: plainLength(c.after), issues: c.issues, blocks: c.blocks })),
    ...removed.map((r) => ({ index: r.index, heading: `${r.heading} (빈 절을 뺐습니다)`, before: 0, after: 0, issues: [r.issue], blocks: 0 })),
  ];
  return {
    ok: true,
    mode: 'critiqueTargeted',
    html,
    revised: changed.size + removed.length,
    length: plainLength(html),
    before: plainLength(previousHtml),
    skipped,
    revisedDetail,
    actuallyFixed,
    stillPresent,
    regressions,
    preservation: measurePreservation(previousHtml, html, targetedOuter, [...changed.values()].reduce((sum, c) => sum + c.blocks, 0)),
    chain: settled.chain,
    convergence: settled.convergence,
  };
}
