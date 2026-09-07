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
  scoreIssues, summarizeCritique,
} from './post-critique';
import type { CritiqueIssue, CompetitorPost } from './post-critique';

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
  log?: (line: string) => void;
}): Promise<DraftCritique> {
  const title = String(input.title || '').trim();
  const html = String(input.html || '');
  const competitors = input.competitors || [];
  const codeIssues = diagnosePost({ title, html, competitors });
  let aiIssues: CritiqueIssue[] = [];
  const decision = shouldCallAiCritique(codeIssues);
  if (decision.call && input.callModel) {
    try {
      const resolved = (input.resolved || []).map((t) => String(t || '').trim()).filter(Boolean);
      if (resolved.length) input.log?.(`   🧾 이미 고친 ${resolved.length}건은 다시 지적하지 않도록 알려줍니다`);
      const raw = await input.callModel(buildCritiquePrompt({ title, html, codeIssues, competitors, resolved }));
      aiIssues = parseCritiqueIssues(raw, splitSections(html).length);
    } catch (error: any) {
      input.log?.(`   ⚠️ AI 비평 실패 — 코드 진단만으로 리포트를 냅니다: ${String(error?.message || error).slice(0, 80)}`);
    }
  } else if (!decision.call) {
    input.log?.(`   ✅ ${decision.reason}`);
  }
  const issues = [...codeIssues, ...aiIssues];
  return {
    ok: true,
    title,
    score: scoreIssues(issues),
    summary: summarizeCritique(issues, { aiSkipped: !decision.call || !input.callModel }),
    issues,
    sections: splitSections(html).map((s) => ({ index: s.index, heading: s.heading, chars: String(s.html || '').replace(/<[^>]+>/g, '').trim().length })),
    competitorCount: competitors.length,
    aiSkipped: !decision.call || !input.callModel,
    roundCount: 1,
    resolvedCount: 0,
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
}

export async function improveDraft(input: {
  title: string;
  html: string;
  issues: CritiqueIssue[];
  callModel: (prompt: string) => Promise<string>;
  log?: (line: string) => void;
}): Promise<DraftImprovement> {
  const title = String(input.title || '').trim();
  const previousHtml = String(input.html || '');
  const sections = splitSections(previousHtml);
  const { bySection, wholePost } = groupIssuesBySection(input.issues || []);
  const targets: number[] = bySection.size > 0
    ? [...bySection.keys()].sort((a, b) => a - b)
    : sections.filter((s) => s.index > 0).sort((a, b) => String(a.html).length - String(b.html).length).slice(0, 2).map((s) => s.index);
  const plain = (v: string) => String(v || '').replace(/<[^>]+>/g, '').trim().length;
  const revisions: { index: number; html: string }[] = [];
  const skipped: string[] = [];
  const revisedDetail: DraftImprovement['revisedDetail'] = [];
  for (let i = 0; i < targets.length; i += 1) {
    const index = targets[i]!;
    const section = sections.find((s) => s.index === index);
    if (!section) continue;
    input.log?.(`[PROGRESS] ${10 + Math.floor((i / targets.length) * 75)}% - ✍️ ${i + 1}/${targets.length} "${String(section.heading).slice(0, 26)}" 구간을 고치는 중…`);
    const sectionIssues = [...(bySection.get(index) || []), ...wholePost];
    const cutting = sectionIssues.some((it) => isCuttingIssue(it));
    try {
      const basePrompt = buildSectionRevisionPrompt({ title, section, issues: bySection.get(index) || [], wholePostIssues: wholePost });
      let raw = await input.callModel(basePrompt);
      let verdict = acceptRevisedSection(raw, section, { cutting });

      /**
       * 🔁 v3.8.693 — 규칙을 어겼으면 **한 번 더 시킨다. 어긴 이유를 알려주고.**
       *
       * 사장님: "비평개선해서 고치고 다시 비평누르면 똑같은 지적이 또뜨는데 …
       *          한번 수정할떄 확실하게 수정되게하라고"
       *
       * 예전에는 한 번 시켜 보고 규칙(분량·이미지·링크·주소 유지)을 어기면 **그냥 포기**하고
       * 원본을 그대로 뒀다. 그러면 그 구간의 지적은 다음 비평에 **반드시 또 나온다** —
       * 고쳐진 게 없으니까. 사장님이 겪은 무한루프가 이것이다.
       *
       * 모델은 무엇을 어겼는지 모른 채 한 번에 끝내야 했다. 어긴 이유를 붙여 다시 시키면
       * 대개 두 번째에 통과한다. 추가 호출은 **실패했을 때만** 1회다(성공하면 0회).
       */
      if (!verdict.accepted) {
        input.log?.(`   ↻ "${String(section.heading).slice(0, 20)}" 1차 거절(${verdict.reason}) — 이유를 알려주고 한 번 더`);
        const retryPrompt = `${basePrompt}

# ⚠️ 방금 쓴 답이 반려됐습니다 — 이유: ${verdict.reason}
다시 쓰되 이번에는 아래를 반드시 지키세요.
· 원문의 이미지(<img>)와 링크(<a>)를 하나도 빼지 마세요. 개수가 줄면 또 반려됩니다.
· 분량을 원문보다 줄이지 마세요. 지적을 반영하되 문장을 덜어내지 말고 고쳐 쓰세요.
· 본문에 글자로 적힌 주소(https://…)는 공백 없이 그대로 두세요.
· 소제목(<h2>·<h3>)과 답변 블록은 원문 그대로 두세요.`;
        raw = await input.callModel(retryPrompt);
        verdict = acceptRevisedSection(raw, section, { cutting });
      }

      if (verdict.accepted) {
        revisions.push({ index, html: verdict.html });
        revisedDetail.push({ index, heading: String(section.heading || ''), before: plain(section.html), after: plain(verdict.html), issues: sectionIssues.map((it) => String(it?.title || '')).filter(Boolean) });
      } else {
        // 두 번 다 어겼다 — 여기서 멈춘다. 세 번째는 값어치보다 비용이 크다.
        skipped.push(`${section.heading}: ${verdict.reason} (2회 시도)`);
      }
    } catch (error: any) {
      skipped.push(`${section.heading}: ${String(error?.message || error).slice(0, 80)}`);
    }
  }
  const html = revisions.length ? applySectionRevisions(previousHtml, revisions) : previousHtml;
  return { ok: true, html, revised: revisions.length, length: plain(html), skipped, revisedDetail };
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
