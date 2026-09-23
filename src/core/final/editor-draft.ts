/**
 * ✏️ 편집기 초안 — 어디서 왔든(붙여넣기·파일·발행글) 편집기 안의 HTML 을 비평하고 고치고 발행할 수 있게. (v3.8.683)
 *
 * 사장님: "수동으로 LLM 으로 생성한 글이나 HTML 을 넣고 미리보기로 보면서 수정도 가능하며 이미지도 추가해서 발행이 가능하게.
 *          파일에 저장이 아니라 플랫폼을 선택해서 발행. 비평·개선 버튼을 누르면 비평할 부분을 알려주고 수정하기를 누르면
 *          그 위치가 수정되게. 이미지 생성 버튼 — 썸네일 따로, 소제목은 영역을 선택하면 그 영역에."
 *
 * 여기 있는 것은 **판단과 문자열 처리**만이다. 화면·IPC·엔진 호출은 electron/main.ts 와 editor.js 가 한다.
 * 비평·수정은 post-critique 의 부품(diagnosePost·buildCritiquePrompt·acceptRevisedSection)을 그대로 쓴다 — 두 벌로 만들지 않는다.
 */
import {
  diagnosePost, shouldCallAiCritique, buildCritiquePrompt, parseCritiqueIssues, splitSections,
  groupIssuesBySection, buildSectionRevisionPrompt, acceptRevisedSection, isCuttingIssue, applySectionRevisions,
  summarizeCritique, issueKey, rewriteAbility, annotateFixability, dropResolvedLookalikes, evidenceProbe,
} from './post-critique';
import type { CritiqueIssue, CompetitorPost, PostSection } from './post-critique';
import { verifySelectedIssues, type SectionChange } from './revision-verification';
import { buttonDiagnose, canContinueChain, openChain, recheckChain, type CritiqueChain, type ConvergenceView, type DisplayIssue } from './critique-convergence';
import { improveTargeted } from './critique-targeted-edit';

/* ────────────────────────────────────────────────────────────────
 * ① 붙여넣은 글을 앱 서식으로
 * ──────────────────────────────────────────────────────────────── */

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 마크다운 강조·링크·코드만 — 문단 안 인라인 */
function inlineMarkdown(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

export function looksLikeHtml(input: string): boolean {
  const s = String(input || '');
  return /<\s*(p|h[1-6]|div|ul|ol|table|section|article|br|img)\b[^>]*>/i.test(s);
}

/**
 * 마크다운·일반 텍스트 → HTML. HTML 이면 그대로(제목만 뽑는다).
 * 지원: # 제목, 목록(-·*·1.), 표(| a | b |), 인용(>), 굵게·기울임·코드·링크, 구분선(---), 빈 줄로 나뉜 문단.
 */
export function normalizePastedContent(input: string): { html: string; title: string } {
  const raw = String(input || '').replace(/\r\n?/g, '\n').trim();
  if (!raw) return { html: '', title: '' };
  if (looksLikeHtml(raw)) {
    const h1 = raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const title = h1 ? h1[1]!.replace(/<[^>]+>/g, '').trim() : '';
    const html = h1 ? raw.replace(h1[0], '') : raw;
    return { html: html.trim(), title };
  }
  const lines = raw.split('\n');
  const out: string[] = [];
  let title = '';
  let para: string[] = [];
  let list: { tag: 'ul' | 'ol'; items: string[] } | null = null;
  let table: string[][] | null = null;
  const flushPara = () => { if (para.length) { out.push(`<p>${inlineMarkdown(para.join(' '))}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.tag}>${list.items.map((i) => `<li>${inlineMarkdown(i)}</li>`).join('')}</${list.tag}>`); list = null; } };
  const flushTable = () => {
    if (table && table.length) {
      const [head, ...rows] = table;
      const th = `<tr>${head!.map((c) => `<th>${inlineMarkdown(c)}</th>`).join('')}</tr>`;
      const tr = rows.map((r) => `<tr>${r.map((c) => `<td>${inlineMarkdown(c)}</td>`).join('')}</tr>`).join('');
      out.push(`<table><thead>${th}</thead><tbody>${tr}</tbody></table>`);
    }
    table = null;
  };
  const flushAll = () => { flushPara(); flushList(); flushTable(); };

  for (const line of lines) {
    const t = line.trim();
    if (!t) { flushAll(); continue; }
    const heading = t.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (heading) {
      flushAll();
      const level = heading[1]!.length;
      const text = heading[2]!.trim();
      if (level === 1 && !title) { title = text; continue; }           // 첫 # 는 제목 — 본문 h1 은 안 만든다
      const tag = level <= 2 ? 'h2' : 'h3';
      out.push(`<${tag}>${inlineMarkdown(text)}</${tag}>`);
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { flushAll(); out.push('<hr>'); continue; }
    const tableRow = t.match(/^\|(.+)\|$/);
    if (tableRow) {
      flushPara(); flushList();
      const cells = tableRow[1]!.split('|').map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;      // |---|---| 구분 줄
      (table = table || []).push(cells);
      continue;
    }
    if (table) flushTable();
    const ul = t.match(/^[-*•]\s+(.+)$/);
    const ol = t.match(/^\d+[.)]\s+(.+)$/);
    if (ul || ol) {
      flushPara();
      const tag = ul ? 'ul' : 'ol';
      if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
      list.items.push((ul || ol)![1]!);
      continue;
    }
    if (list) flushList();
    const quote = t.match(/^>\s?(.+)$/);
    if (quote) { flushPara(); out.push(`<blockquote><p>${inlineMarkdown(quote[1]!)}</p></blockquote>`); continue; }
    para.push(t);
  }
  flushAll();
  return { html: out.join('\n'), title };
}

/* ────────────────────────────────────────────────────────────────
 * ② 비평 — postId 없이 HTML 만으로
 * ──────────────────────────────────────────────────────────────── */

export interface DraftCritique {
  ok: true;
  title: string;
  score: number;
  summary: string;
  issues: CritiqueIssue[];
  sections: Array<{ index: number; heading: string; chars: number }>;
  competitorCount: number;
  aiSkipped: boolean;
  roundCount: number;
  resolvedCount: number;
  /** v3.8.750 — 수렴: 끝났는가 · 반드시 고칠 것이 몇 건 남았는가 (critique-convergence) */
  convergence?: ConvergenceView;
  /** v3.8.750 — 편집기가 들고 있다가 다음 비평·수정에 그대로 돌려준다 */
  chain?: CritiqueChain;
  resolvedIssues?: DisplayIssue[];
}

export async function critiqueDraft(input: {
  title: string;
  html: string;
  competitors?: CompetitorPost[];
  /** AI 비평 한 번. 없으면 코드 진단만 */
  callModel?: (prompt: string) => Promise<string>;
  /**
   * 🧾 v3.8.693 — **이미 고친 지적들.** 이걸 안 넘기면 같은 말이 또 나온다.
   *
   * 사장님: "고치고 다시 비평누르면 똑같은 지적이 또뜨는데 이러면 처음 수정할떄
   *          수정한이유가 없자나 이것도 비용이청구되는데"
   *
   * 발행글 비평 경로에는 critique-history 가 있었는데 **편집기 경로에는 없었다.**
   * 매번 백지에서 비평하니 방금 고친 것도 그대로 다시 지적했다.
   * buildCritiquePrompt 는 예전부터 `resolved` 를 받아 "다시 말하지 마세요" 라고
   * 프롬프트에 넣어 준다 — 그 통로를 편집기도 쓰게 한다.
   */
  resolved?: string[];
  /**
   * v3.8.750 — 같은 글의 지난 비평·수정 기록(체인). 있으면 **AI 를 부르지 않고** 이어서 잰다:
   * 지난 BLOCKING 이 풀렸는가 · 수정이 새 BLOCKING 을 만들었는가 · BLOCKING 이 남았는가.
   */
  chain?: unknown;
  /** v3.8.750 — 사람이 「전체 다시 비평」을 눌렀을 때만 true — 체인이 있어도 AI 비평을 다시 돈다 */
  fullRecritique?: boolean;
  log?: (line: string) => void;
}): Promise<DraftCritique> {
  const title = String(input.title || '').trim();
  const html = String(input.html || '');
  const competitors = input.competitors || [];
  const sectionRows = () => splitSections(html).map((s) => ({ index: s.index, heading: s.heading, chars: String(s.html || '').replace(/<[^>]+>/g, '').trim().length }));
  if (!input.fullRecritique && canContinueChain(input.chain, { title, html })) {
    const review = recheckChain({ title, html, chain: input.chain });
    input.log?.(`   🔁 지난 비평에 이어서 확인합니다 — AI 비평은 부르지 않습니다 (호출 0회): ${review.convergence.headline}`);
    return {
      ok: true, title, score: review.score, summary: review.summary, issues: review.issues, sections: sectionRows(),
      competitorCount: 0, aiSkipped: true, roundCount: review.chain.critiqueRound, resolvedCount: review.resolvedIssues.length,
      convergence: review.convergence, chain: review.chain, resolvedIssues: review.resolvedIssues,
    };
  }
  // v3.8.750 — 누출 문장은 문장마다 한 건씩 센다 (buttonDiagnose). 나머지는 diagnosePost 그대로다.
  const codeIssues = buttonDiagnose({ title, html, competitors });
  let aiIssues: CritiqueIssue[] = [];
  const decision = shouldCallAiCritique(codeIssues);
  if (decision.call && input.callModel) {
    try {
      const resolved = (input.resolved || []).map((t) => String(t || '').trim()).filter(Boolean);
      if (resolved.length) input.log?.(`   🧾 이미 고친 ${resolved.length}건은 다시 지적하지 않도록 알려줍니다`);
      const raw = await input.callModel(buildCritiquePrompt({ title, html, codeIssues, competitors, resolved }));
      aiIssues = parseCritiqueIssues(raw, splitSections(html).length);
      /**
       * v3.8.729 — "다시 말하지 마세요"를 프롬프트로만 맡기지 않는다.
       * 고친 지적과 말만 다른 AI 지적은 코드가 걸러낸다 (post-critique.dropResolvedLookalikes).
       */
      const sieve = dropResolvedLookalikes(aiIssues, resolved);
      if (sieve.dropped.length) {
        input.log?.(`   🧾 이미 고친 것과 같은 말인 AI 지적 ${sieve.dropped.length}건을 걸렀습니다: ${sieve.dropped.map((d) => d.title).join(' · ').slice(0, 120)}`);
        aiIssues = sieve.kept;
      }
    } catch (error: any) {
      input.log?.(`   ⚠️ AI 비평 실패 — 코드 진단만으로 리포트를 냅니다: ${String(error?.message || error).slice(0, 80)}`);
    }
  } else if (!decision.call) {
    input.log?.(`   ✅ ${decision.reason}`);
  }
  // v3.8.729 — 수정 버튼으로 못 고치는 지적에는 그 이유(어느 버튼으로 고치는지)를 붙여 보낸다
  // v3.8.750 — 그 위에 BLOCKING / OPTIONAL / NEEDS_NEW_EVIDENCE 를 가르고 체인을 세운다
  const opened = openChain({ title, html, issues: annotateFixability([...codeIssues, ...aiIssues]), previous: input.chain });
  const issues = opened.issues;
  return {
    ok: true,
    title,
    score: opened.score,
    summary: summarizeCritique(issues, { aiSkipped: !decision.call || !input.callModel }),
    issues,
    sections: sectionRows(),
    competitorCount: competitors.length,
    aiSkipped: !decision.call || !input.callModel,
    roundCount: opened.chain.critiqueRound,
    resolvedCount: 0,
    convergence: opened.convergence,
    chain: opened.chain,
    resolvedIssues: opened.resolvedIssues,
  };
}

/* ────────────────────────────────────────────────────────────────
 * ③ 고르 지적을 반영해 구간을 다시 쓴다 — 발행하지 않는다
 * ──────────────────────────────────────────────────────────────── */

export interface DraftImprovement {
  ok: true;
  html: string;
  revised: number;
  length: number;
  skipped: string[];
  revisedDetail: Array<{ index: number; heading: string; before: number; after: number; issues: string[] }>;
  /**
   * ✅ v3.8.700 — **고친 뒤 실제로 사라진 지적.** 이것만 "해결됐다"고 말한다.
   * 사장님: "지적한걸 수정하고 다시비평을했는데 또 똑같은 지적이 나오면 어쩌란거냐고"
   */
  actuallyFixed: string[];
  /** 고쳤는데도 **아직 남아 있는** 지적 — 숨기지 않고 그대로 돌려준다 */
  stillPresent: string[];
}

/**
 * 🔁 v3.8.700 — 고른 지적이 **정말 사라졌는지 코드 진단으로 다시 잰다.**
 *
 * ## 왜 필요한가 — v3.8.693 이 절반만 고쳤다
 * 그때 넣은 `resolved`("이미 고쳤으니 다시 말하지 마세요")는 **AI 비평 프롬프트에만** 들어간다.
 * 그런데 사장님이 되풀이해 본 지적 네 건은 전부 **코드 진단**이었다:
 *   "…과 …이 같은 말을 합니다"           (article-audit)
 *   "제도를 설명하면서 근거 조항이 한 건도 없습니다" (article-audit)
 *   "출처 인용에 연도·조사명 동반 부족"      (quality-gate)
 *   "FAQ 답이 질문과 어긋납니다"            (reader-retention)
 * 코드 진단은 **새 본문을 다시 재서** 그대로 다시 터진다 — 프롬프트로 입막음이 안 된다.
 *
 * 진짜 구멍은 따로 있었다: **고친 뒤 정말 고쳐졌는지 아무도 확인하지 않았다.**
 * 여기서 다시 재고, 아직 남은 것은 숨기지 않고 그대로 알린다.
 */
function measureRemaining(title: string, html: string, issues: CritiqueIssue[]): CritiqueIssue[] {
  if (!issues.length) return [];
  try {
    // v3.8.729 — 제목이 아니라 이름표(issueKey)로 잰다. `"환급"가 12번` → `9번` 은 같은 지적이다.
    const now = new Set(diagnosePost({ title, html, competitors: [] }).map(issueKey));
    return issues.filter((issue) => now.has(issueKey(issue)));
  } catch {
    // 재는 데 실패하면 "고쳤다"고 단정하지 않는다 — 모른다고 두는 편이 정직하다
    return issues;
  }
}

const plainLength = (html: string): number => String(html || '').replace(/<[^>]+>/g, '').trim().length;
const plainText = (html: string): string => String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * "앞 절과 같은 말을 합니다" 류는 상대 절을 봐야 고칠 수 있다. 지적 제목에 인용된 소제목으로 상대 절을 찾아
 * 그 절의 **평문만** 돌려준다 — 글 전체 HTML 을 구간마다 싣던 초안은 비용이 구간 수만큼 곱해졌다.
 */
function counterpartText(issue: CritiqueIssue, section: PostSection, sections: PostSection[]): string {
  if (!/audit-(cross-section-echo|procedure-repeat)|redundancy-repeat/.test(String(issue.id || ''))) return '';
  const quoted = [...String(issue.title || '').matchAll(/"([^"]{2,60})"/g)].map((m) => m[1]!.trim());
  const others = sections.filter((s) => s.index !== section.index && plainLength(s.html) > 0);
  const named = others.filter((s) => quoted.some((q) => s.heading.includes(q) || q.includes(s.heading)));
  const picked = named.length ? named : others.filter((s) => issue.evidence && plainText(s.html).includes(plainText(issue.evidence).slice(0, 30)));
  return picked.slice(0, 2).map((s) => `[${s.index === 0 ? '도입부' : s.heading}]\n${plainText(s.html).slice(0, 1400)}`).join('\n\n');
}

/**
 * 고른 지적을 반영해 **구간만** 다시 쓴다. 발행하지 않는다.
 *
 * ## v3.8.729 — 사장님: "지적을 하면 그 지적한 걸 말끔히 해결해야 되는데 … 똑같은 지적이 또 나와.
 *                        수정하는데도 API 비용이 들기 때문에 이러면 절대 안 되는데"
 *
 * 호출 예산은 정해져 있다: 구간마다 최대 2회(반려·미해결 시 이유를 붙여 한 번 더) + 코드로 못 재는
 * 지적이 있을 때만 검수 1회. 못 고치는 지적(이미지 0장 등)은 **부르지 않고** 이유를 돌려준다.
 *
 * 순서:
 *   ① 사장님이 직접 적은 요청(user-request-*)이면 글 전체를 한 번에 고치는 manual-revision 으로 보낸다.
 *   ② 수정으로 못 고치는 지적은 뺀다(호출 0회, skipped 에 이유).
 *   ③ 구간을 정한다 — 구간 지정 지적은 그 구간, 글 전체 지적은 근거 문장이 있는 구간, 둘 다 없으면 가장 얇은 두 구간.
 *   ④ 구간마다 고치고 관문(acceptRevisedSection)을 지나면 받는다. 반려면 이유를 붙여 한 번 더.
 *   ⑤ 코드로 재는 지적은 다시 재서 남았으면 그 구간만 한 번 더(예산 안에서).
 *   ⑥ 코드로 못 재는 지적은 바뀐 구간만 넘겨 검수 1회 — "표현만 바뀐 것"은 해결로 치지 않는다.
 */
export async function improveDraft(input: {
  title: string;
  html: string;
  issues: CritiqueIssue[];
  callModel: (prompt: string) => Promise<string>;
  log?: (line: string) => void;
  /**
   * v3.8.731 — 코드로 못 재는 지적의 검수 호출을 끌 수 있다(기본 true).
   * 발행 전 자가 수정처럼 결함이 전부 코드 진단이고 "고쳤다" 표시가 필요 없는 자리에서는 호출을 아낀다.
   * 끄면 못 재는 지적은 stillPresent 로 남긴다 — 모르는 것을 "고쳤다"고 하지 않는다.
   */
  verify?: boolean;
  /**
   * v3.8.750 — 'critiqueTargeted': 「비평 개선」 버튼의 수정. **지적된 문단만** 고치고, 새 BLOCKING 이 생기면 되돌린다
   * (critique-targeted-edit). 버튼 경로만 이 값을 넘긴다 — 발행 전 자가 수정·자동 품질 루프는 넘기지 않으므로 아래 예전 경로 그대로다.
   */
  mode?: 'critiqueTargeted';
  /** v3.8.750 — critiqueTargeted 에서 이어 쓸 비평 체인 */
  chain?: unknown;
}): Promise<DraftImprovement> {
  if (input.mode === 'critiqueTargeted' && !(input.issues || []).some((issue) => String(issue?.id || '').startsWith('user-request-'))) {
    return improveTargeted(input);
  }
  const title = String(input.title || '').trim();
  const previousHtml = String(input.html || '');
  const sections = splitSections(previousHtml);
  const issues: CritiqueIssue[] = (input.issues || []).filter(Boolean).map((issue, index) => ({
    ...issue,
    id: String(issue.id || `request-${index}`),
    title: String(issue.title || ''),
    fix: String(issue.fix || issue.detail || ''),
    // 편집기가 sectionIndex 없이 보내면 undefined < 0 이 false 라 없는 구간을 고치려다 아무것도 안 했다 (v3.8.725~728 실사고)
    sectionIndex: Number.isInteger(issue.sectionIndex) && sections.some((s) => s.index === issue.sectionIndex)
      ? issue.sectionIndex : -1,
  }));

  // ① 직접 적은 요청은 구간 단위가 아니라 글 전체다 — "도입부를", "마지막 표를" 처럼 위치를 말로 가리킨다
  if (issues.some((issue) => issue.id.startsWith('user-request-'))) {
    const { reviseByRequest } = require('./manual-revision');
    return reviseByRequest({ ...input, title, html: previousHtml, issues });
  }

  const skipped: string[] = [];
  const empty: DraftImprovement = {
    ok: true, html: previousHtml, revised: 0, length: plainLength(previousHtml), skipped, revisedDetail: [],
    actuallyFixed: [], stillPresent: issues.map((i) => i.title),
  };

  // ② 다시 써서는 못 고치는 지적 — 부르지 않는다
  const unfixable = issues.filter((issue) => !rewriteAbility(issue).fixable);
  for (const issue of unfixable) skipped.push(`${issue.title}: ${rewriteAbility(issue).hint}`);
  const workable = issues.filter((issue) => rewriteAbility(issue).fixable);
  if (unfixable.length) input.log?.(`   ⏭️ 수정 버튼으로 못 고치는 지적 ${unfixable.length}건은 부르지 않습니다 (이유를 창에 적습니다)`);
  if (!workable.length) return empty;

  // ③ 구간 정하기
  const { bySection, wholePost } = groupIssuesBySection(workable);
  const evidenceTargets = new Map<string, number[]>();
  for (const issue of wholePost) {
    // v3.8.731: "앞: …\n뒤: …" 근거는 뒤 절 문장으로 찾는다 (evidenceProbe) — 접두어째 찾으면 늘 못 찾았다
    const evidence = plainText(evidenceProbe(issue.evidence)).slice(0, 60);
    if (evidence.length < 12) continue;   // 너무 짧으면 아무 구간에나 걸린다
    const hit = sections.filter((s) => s.index > 0 && plainText(s.html).includes(evidence)).map((s) => s.index);
    // 구간 반복은 같은 문장이 앞 절에도 있다 — 고칠 곳은 뒤(마지막) 절이다
    const isEcho = /(^|\n)\s*뒤\s*[:：]/.test(String(issue.evidence || ''));
    if (hit.length) evidenceTargets.set(issue.id, isEcho ? hit.slice(-1) : hit.slice(0, 2));
  }
  const MAX_TARGETS = 6;
  let targets = [...new Set([...bySection.keys(), ...[...evidenceTargets.values()].flat()])].sort((a, b) => a - b);
  if (targets.length === 0) {
    // 근거 문장도 구간도 없는 글 전체 지적뿐이다 — 가장 얇은 두 구간부터 손본다 (v3.8.683 규칙)
    targets = sections.filter((s) => s.index > 0)
      .sort((a, b) => plainLength(a.html) - plainLength(b.html))
      .slice(0, 2).map((s) => s.index).sort((a, b) => a - b);
    if (targets.length === 0 && sections.length) targets = [sections[0]!.index];
  }
  if (targets.length > MAX_TARGETS) {
    skipped.push(`호출 상한으로 ${targets.length - MAX_TARGETS}개 구간은 이번에 손대지 않았습니다 — 다시 비평해 이어서 고치세요.`);
    targets = [...new Set([...bySection.keys(), ...targets])].slice(0, MAX_TARGETS).sort((a, b) => a - b);
  }
  /** 이 구간에 붙는 지적 — 구간 지정 + 근거가 이 구간에 있는 글 전체 지적 + 근거 없는 글 전체 지적(모든 구간에) */
  const issuesFor = (index: number): CritiqueIssue[] => [
    ...(bySection.get(index) || []),
    ...wholePost.filter((issue) => {
      const at = evidenceTargets.get(issue.id);
      return at ? at.includes(index) : true;
    }),
  ];
  input.log?.(`   🎯 고칠 지적 ${workable.length}건 → 손볼 구간 ${targets.length}개${wholePost.length ? ` (글 전체 지적 ${wholePost.length}건은 근거 문장이 있는 구간으로 내려보냅니다)` : ''}`);

  // ④ 구간마다 고친다 — 반려면 이유를 붙여 한 번 더. 구간당 예산 2회.
  const revisions = new Map<number, string>();
  const attempts = new Map<number, number>();
  const revisedIssues = new Map<number, string[]>();
  const revise = async (index: number, current: string, selected: CritiqueIssue[], note: string): Promise<boolean> => {
    const live = splitSections(current);
    const section = live.find((s) => s.index === index);
    if (!section || selected.length === 0 || (attempts.get(index) || 0) >= 2) return false;
    attempts.set(index, (attempts.get(index) || 0) + 1);
    const contextText = selected.map((issue) => counterpartText(issue, section, live)).filter(Boolean).join('\n\n');
    const basePrompt = buildSectionRevisionPrompt({
      title, section,
      issues: selected.filter((issue) => issue.sectionIndex === index),
      wholePostIssues: selected.filter((issue) => issue.sectionIndex !== index),
      ...(contextText ? { contextText } : {}),
    });
    const prompt = note ? `${basePrompt}\n\n${note}` : basePrompt;
    const gate = {
      cutting: selected.some(isCuttingIssue),
      allowAnswerEdit: selected.some((issue) => issue.area === 'answer' || /답 상자|판정문|답변|FAQ/.test(issue.title)),
    };
    try {
      const raw = await input.callModel(prompt);
      const verdict = acceptRevisedSection(raw, section, gate);
      if (verdict.accepted) {
        revisions.set(index, verdict.html);
        revisedIssues.set(index, [...new Set([...(revisedIssues.get(index) || []), ...selected.map((i) => i.title)])]);
        return true;
      }
      if (verdict.reason === '바뀐 것이 없습니다') {
        // 같은 답을 또 사지 않는다
        attempts.set(index, 2);
        skipped.push(`${section.heading}: 모델이 바꾼 것이 없습니다`);
        return false;
      }
      if ((attempts.get(index) || 0) < 2) {
        input.log?.(`   ↻ "${String(section.heading).slice(0, 20)}" 1차 반려(${verdict.reason}) — 이유를 알려주고 한 번 더`);
        return revise(index, current, selected, `# ⚠️ 방금 쓴 답이 반려됐습니다 — 이유: ${verdict.reason}
다시 쓰되 이번에는 아래를 반드시 지키세요.
· 원문의 이미지(<img>)와 링크(<a>)를 하나도 빼지 마세요. 개수가 줄면 또 반려됩니다.
· 분량을 원문보다 줄이지 마세요. 지적을 반영하되 문장을 덜어내지 말고 고쳐 쓰세요.
· 본문에 글자로 적힌 주소(https://…)는 공백 없이 그대로 두세요.
· 소제목(<h2>·<h3>)은 원문 그대로 두세요.`);
      }
      skipped.push(`${section.heading}: ${verdict.reason} (2회 시도)`);
      return false;
    } catch (error: any) {
      skipped.push(`${section.heading}: ${String(error?.message || error).slice(0, 100)}`);
      return false;
    }
  };
  const assembled = () => applySectionRevisions(previousHtml, [...revisions].map(([index, html]) => ({ index, html })));

  for (let i = 0; i < targets.length; i += 1) {
    const index = targets[i]!;
    const heading = sections.find((s) => s.index === index)?.heading || `구간 ${index}`;
    input.log?.(`[PROGRESS] ${10 + Math.floor((i / targets.length) * 70)}% - ✍️ ${i + 1}/${targets.length} "${String(heading).slice(0, 26)}" 구간을 고치는 중…`);
    await revise(index, assembled(), issuesFor(index), '');
  }
  let html = assembled();

  // ⑤ 코드로 재는 지적은 다시 잰다 — 남았으면 그 구간만 한 번 더 (구간당 예산 안에서)
  const baselineKeys = new Set(diagnosePost({ title, html: previousHtml, competitors: [] }).map(issueKey));
  const codeIssues = workable.filter((issue) => issue.origin === 'code' && baselineKeys.has(issueKey(issue)));
  const semanticIssues = workable.filter((issue) => !codeIssues.includes(issue));
  let remaining = measureRemaining(title, html, codeIssues);
  if (remaining.length && revisions.size) {
    input.log?.(`[PROGRESS] 82% - 🔁 아직 남은 지적 ${remaining.length}건 — 그 구간만 한 번 더 고칩니다`);
    for (const index of targets) {
      const stuck = issuesFor(index).filter((issue) => remaining.some((r) => issueKey(r) === issueKey(issue)));
      if (!stuck.length || (attempts.get(index) || 0) >= 2) continue;
      const changed = await revise(index, html, stuck, `# ⚠️ 이 지적들은 방금 고쳤는데도 **그대로 남아 있습니다**
${stuck.map((it) => `· ${it.title}\n  처방: ${String(it.fix || '').slice(0, 160)}`).join('\n')}
말을 바꾸는 것으로는 안 됩니다. 지적이 가리키는 **그 부분을 실제로 손보세요**
(겹치는 문장은 지우고, 근거를 못 찾으면 그 주장을 빼고, 답이 어긋나면 답을 다시 쓰세요).`);
      if (changed) {
        html = assembled();
        remaining = measureRemaining(title, html, codeIssues);
        if (!remaining.length) break;
      }
    }
  }

  // ⑥ 코드로 못 재는 지적은 검수 1회 — 바뀐 구간만 넘긴다 (표현만 바뀐 것은 해결이 아니다)
  let verified: string[] = [];
  if (revisions.size && semanticIssues.length && input.verify !== false) {
    const after = splitSections(html);
    const changes: SectionChange[] = [...revisions.keys()].map((index) => ({
      heading: sections.find((s) => s.index === index)?.heading || `구간 ${index}`,
      before: sections.find((s) => s.index === index)?.html || '',
      after: after.find((s) => s.index === index)?.html || '',
    }));
    input.log?.('[PROGRESS] 90% - 🔎 코드로 못 재는 지적은 바뀐 구간만 넘겨 검수합니다 (1회)');
    verified = await verifySelectedIssues({ title, changes, issues: semanticIssues, callModel: input.callModel });
  }

  const fixedKeys = new Set([
    ...codeIssues.filter((issue) => revisions.size > 0 && !remaining.some((r) => issueKey(r) === issueKey(issue))).map(issueKey),
    ...semanticIssues.filter((issue) => verified.includes(issue.id)).map(issueKey),
  ]);
  const actuallyFixed = workable.filter((issue) => fixedKeys.has(issueKey(issue))).map((issue) => issue.title);
  const stillPresent = issues.filter((issue) => !fixedKeys.has(issueKey(issue))).map((issue) => issue.title);
  if (stillPresent.length) input.log?.(`   ⚠️ 고친 뒤에도 남은 지적 ${stillPresent.length}건 — 화면에 그대로 알립니다`);

  const revisedDetail = [...revisions].map(([index, changed]) => ({
    index,
    heading: sections.find((s) => s.index === index)?.heading || '',
    before: plainLength(sections.find((s) => s.index === index)?.html || ''),
    after: plainLength(changed),
    issues: revisedIssues.get(index) || [],
  }));
  return { ok: true, html, revised: revisions.size, length: plainLength(html), skipped, revisedDetail, actuallyFixed, stillPresent };
}

/* ────────────────────────────────────────────────────────────────
 * ④ 이미지 — 어느 소제목 영역인지, 어떤 프롬프트인지
 * ──────────────────────────────────────────────────────────────── */

/** 이미지 프롬프트 — post-regenerate 와 같은 규칙(제목 + 소제목). 썸네일은 제목만 */
export function buildDraftImagePrompt(title: string, sectionTitle?: string | null): string {
  const { buildImagePromptFor } = require('./post-regenerate');
  return sectionTitle ? buildImagePromptFor(title, sectionTitle) : buildImagePromptFor(title, title);
}

/** 이미지 한 장의 HTML — 발행 코드가 썸네일로 집는 모양(div.separator > img)과 같다 */
export function imageBlockHtml(url: string, alt: string): string {
  const safeAlt = escapeHtml(String(alt || '')).replace(/"/g, '&quot;');
  return `<div class="separator" style="clear:both;text-align:center;margin:18px 0;"><img src="${url}" alt="${safeAlt}" loading="lazy" style="max-width:100%;height:auto;border-radius:12px;" /></div>`;
}
