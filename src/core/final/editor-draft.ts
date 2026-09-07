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
function measureRemaining(title: string, html: string, wanted: string[]): string[] {
  if (!wanted.length) return [];
  try {
    const now = diagnosePost({ title, html, competitors: [] }).map((issue) => String(issue?.title || ''));
    return wanted.filter((t) => now.includes(t));
  } catch {
    // 재는 데 실패하면 "고쳤다"고 단정하지 않는다 — 모른다고 두는 편이 정직하다
    return wanted;
  }
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
  /**
   * 🎯 v3.8.702 — **"글 전체" 지적이 한 구간에만 딸려 들어가던 문제.**
   *
   * 사장님: "지적이 7개라서 7건 모두수정 발행버튼눌렀으면 전부 수정해야되는거아니니?
   *          1개구간만 수정했다뜨고 그대로인데?"
   *
   * 예전 규칙은 `bySection.size > 0` 이면 **구간 번호가 붙은 지적만** 대상으로 삼았다.
   * 고른 7건 중 6건이 "글 전체"(sectionIndex < 0)이고 1건만 구간 지정이면
   * 대상은 그 한 구간뿐이고, 나머지 6건은 그 구간에 딸려 들어갈 뿐 **본문 나머지에는 닿지 않았다.**
   * 화면에는 "1개 구간 수정"이라고 뜨는데 사장님은 7건을 고른 상태다 — 어긋난다.
   *
   * 글 전체 지적에도 **어디가 문제인지 단서가 있다** — 진단이 붙여 준 근거 문장(evidence)이다.
   * 그 문장이 들어 있는 구간을 찾아 함께 대상에 넣는다. 근거가 없는 지적은 어쩔 수 없이
   * 예전처럼 대표 구간에 맡긴다.
   *
   * 상한을 두는 이유는 비용이다(구간마다 모델을 부른다). 근거가 많이 걸린 구간부터 채운다.
   */
  const MAX_TARGETS = 6;
  const stripText = (v: unknown) => String(v ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const evidenceHits = new Map<number, number>();
  for (const issue of wholePost) {
    const evidence = stripText((issue as any)?.evidence).slice(0, 60);
    if (evidence.length < 12) continue;   // 너무 짧으면 아무 구간에나 걸린다
    for (const section of sections) {
      if (section.index <= 0) continue;
      if (stripText(section.html).includes(evidence)) {
        evidenceHits.set(section.index, (evidenceHits.get(section.index) || 0) + 1);
      }
    }
  }

  const fromEvidence = [...evidenceHits.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([index]) => index);

  let targets: number[] = [...new Set([...bySection.keys(), ...fromEvidence])].sort((a, b) => a - b);
  if (targets.length === 0) {
    targets = sections.filter((s) => s.index > 0)
      .sort((a, b) => String(a.html).length - String(b.html).length)
      .slice(0, 2).map((s) => s.index);
  }
  if (targets.length > MAX_TARGETS) {
    // 구간 지정 지적을 먼저 지키고, 남는 자리를 근거가 많이 걸린 구간으로 채운다
    const named = [...bySection.keys()];
    const rest = fromEvidence.filter((i) => !named.includes(i));
    targets = [...new Set([...named, ...rest])].slice(0, MAX_TARGETS).sort((a, b) => a - b);
  }
  input.log?.(`   🎯 고친 지적 ${(input.issues || []).length}건 → 손볼 구간 ${targets.length}개`
    + `${wholePost.length ? ` (글 전체 지적 ${wholePost.length}건은 근거 문장이 있는 구간으로 내려보냅니다)` : ''}`);
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
  let html = revisions.length ? applySectionRevisions(previousHtml, revisions) : previousHtml;

  /**
   * ✅ v3.8.700 — **고쳤다고 말하기 전에 다시 잰다.**
   *
   * 사장님: "지적한걸 수정하고 다시비평을했는데 또 똑같은 지적이 나오면 어쩌란거냐고
   *          이거 고치랫는데 왜안고치냐 한번고칠때 완벽히 고쳐야되는거아니니?"
   *
   * 코드 진단은 프롬프트로 입막음이 안 된다(measureRemaining 주석 참고).
   * 그러니 고친 본문을 다시 재서, 아직 남은 지적이 있으면 **그 구간만 한 번 더** 고친다.
   * 이번에는 "이 지적이 아직 남아 있다"는 사실과 진단이 준 처방을 함께 준다 —
   * 무엇이 부족한지 모른 채 다시 쓰면 같은 결과가 나온다.
   */
  const wanted = [...new Set((input.issues || []).map((it) => String(it?.title || '')).filter(Boolean))];
  let stillPresent = measureRemaining(title, html, wanted);

  if (stillPresent.length && revisions.length) {
    input.log?.(`[PROGRESS] 88% - 🔁 아직 남은 지적 ${stillPresent.length}건 — 그 구간만 한 번 더 고칩니다`);
    const stuck = (input.issues || []).filter((it) => stillPresent.includes(String(it?.title || '')));
    const retryTargets = [...new Set(stuck
      .map((it) => (Number.isInteger(it?.sectionIndex) && it.sectionIndex >= 0 ? it.sectionIndex : null))
      .filter((v): v is number => v !== null))];

    const freshSections = splitSections(html);
    const extra: { index: number; html: string }[] = [];
    for (const index of retryTargets) {
      const section = freshSections.find((s) => s.index === index);
      if (!section) continue;
      const sectionStuck = stuck.filter((it) => it.sectionIndex === index);
      const prompt = `${buildSectionRevisionPrompt({ title, section, issues: sectionStuck, wholePostIssues: [] })}

# ⚠️ 이 지적들은 방금 고쳤는데도 **그대로 남아 있습니다**
${sectionStuck.map((it) => `· ${it.title}\n  처방: ${String(it.fix || '').slice(0, 160)}`).join('\n')}
말을 바꾸는 것으로는 안 됩니다. 지적이 가리키는 **그 부분을 실제로 손보세요**
(겹치는 문장은 지우고, 근거를 못 찾으면 그 주장을 빼고, 답이 어긋나면 답을 다시 쓰세요).`;
      try {
        const raw = await input.callModel(prompt);
        const verdict = acceptRevisedSection(raw, section, { cutting: sectionStuck.some((it) => isCuttingIssue(it)) });
        if (verdict.accepted) extra.push({ index, html: verdict.html });
        else skipped.push(`${section.heading}: 재시도도 규칙 위반(${verdict.reason})`);
      } catch (error: any) {
        skipped.push(`${section.heading}: 재시도 실패(${String(error?.message || error).slice(0, 60)})`);
      }
    }
    if (extra.length) {
      html = applySectionRevisions(html, extra);
      stillPresent = measureRemaining(title, html, wanted);
    }
  }

  const actuallyFixed = wanted.filter((t) => !stillPresent.includes(t));
  if (stillPresent.length) {
    input.log?.(`   ⚠️ 두 번 고쳤는데도 남은 지적 ${stillPresent.length}건 — 화면에 그대로 알립니다`);
  }

  return {
    ok: true, html, revised: revisions.length, length: plain(html), skipped, revisedDetail,
    actuallyFixed, stillPresent,
  };
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
