/**
 * 🩺 발행 전 자가 수정 — 코드가 찾고, AI 가 문제 구간만 다시 쓴다 (v3.8.630)
 *
 * ## 왜 만들었나
 * 사장님: "애초에 비평이나 개선을 하려고 버튼을 누르면 개선할게없을정도로
 *         글이 발행되어야한다고" / "api와 에이전트 둘다 LLM보다 훨씬 양질의 글을
 *         줘야되 왜냐하면 LLM이 더 좋은글을 써준다면 자동화는 의미가없어지거든"
 *
 * 지금까지 게이트는 전부 **알리기만** 했다. auto-repair 가 기계적으로 되돌릴 수
 * 있는 것(붙은 문장·군더더기)은 고치게 됐지만, 판단이 필요한 것은 그대로 나갔다:
 *   · "횡령했다" 를 뭐로 바꿀지 — 사실관계를 알아야 한다
 *   · 소제목이 "판례" 라고 약속했는데 판례가 0건 — 채우거나 제목을 바꿔야 한다
 *   · 제목이 물었는데 본문이 답을 안 함 — 답을 앞으로 끌어와야 한다
 *   · 두 구간이 같은 말 — 어느 쪽을 지울지 흐름을 봐야 한다
 *
 * ## 설계 — fact-guard 와 같은 뼈대
 * 코드가 먼저 찾는다 → **찾은 게 없으면 AI 를 안 부른다(호출 0회)** →
 * 있으면 문제 구간만 다시 쓴다 → 다시 재서 나빠졌으면 원본을 쓴다.
 *
 * 통째로 새로 쓰지 않는 이유는 이미지·내부링크·CTA·표를 살리기 위해서다.
 * post-critique 가 발행 후 개선에 쓰던 부품(구간 나누기·수용 판정·개선 판정)을
 * 그대로 재사용한다 — 같은 일을 두 벌 만들면 한쪽만 고쳐진다.
 *
 * ## 비용
 * 고칠 구간 수에 상한을 둔다. 결함이 열 개여도 호출은 최대 MAX_SECTIONS 번이다.
 * 사장님 요구가 "비용은 고정" 이므로 결함 수에 비례해 늘어나면 안 된다.
 *
 * ## 절대 원칙
 * 발행을 막지 않는다. 고치다 실패하면 원본 그대로 나간다.
 * 개선하려다 글을 망가뜨리는 것이 개선 안 하는 것보다 나쁘다.
 */

import { auditArticle, type AuditIssue } from './article-audit';
import {
  splitSections,
  applySectionRevisions,
  buildSectionRevisionPrompt,
  acceptRevisedSection,
  judgeImproved,
  locateSection,
  type CritiqueIssue,
  type PostSection,
} from './post-critique';
import { findUnfulfilledHeadings } from './structure-guard';
import { auditTitleAnswer, isQuestionTitle } from './title-answer-gate';

/** 한 번 발행에 다시 쓸 구간의 최대 개수 — 비용 상한 */
export const MAX_SECTIONS = 2;

/**
 * 이 종류만 AI 에게 맡긴다.
 * 코드가 이미 고친 것(붙은 문장)이나 사람이 확인해야 하는 것(금액 성격)은 뺀다 —
 * 후자를 AI 에게 맡기면 모르는 것을 지어내 채운다.
 */
const AI_FIXABLE = new Set([
  'asserted-crime',
  'legal-overreach',
  'unsourced-reading',
  'settlement-stretch',
  'unverified-first',
  'cross-section-echo',
  'unfulfilled-heading',
  'title-unanswered',
  'report-longtail-missing',
]);

export interface PreflightFinding {
  kind: string;
  title: string;
  evidence: string;
  sectionIndex: number;
}

export interface PreflightReport {
  /** AI 에게 맡길 것 */
  fixable: PreflightFinding[];
  /** 찾긴 했지만 사람 몫인 것 — 로그로만 알린다 */
  advisory: PreflightFinding[];
}

/**
 * 발행 직전에 무엇이 문제인지 코드로만 찾는다. **AI 호출 0회.**
 */
export function inspectBeforePublish(input: { title: string; html: string; reportSlot?: any }): PreflightReport {
  const html = String(input.html || '');
  const title = String(input.title || '').trim();
  const sections = splitSections(html);
  const fixable: PreflightFinding[] = [];
  const advisory: PreflightFinding[] = [];

  const push = (f: PreflightFinding) => (AI_FIXABLE.has(f.kind) ? fixable : advisory).push(f);

  // ① 글 품질 하네스 + 주장·사실 구분
  let audited: AuditIssue[] = [];
  try {
    audited = auditArticle(html).issues;
  } catch { /* 검사 실패가 발행을 막지 않는다 */ }
  for (const issue of audited) {
    push({
      kind: issue.kind,
      title: issue.title,
      evidence: issue.evidence,
      sectionIndex: locateSection(sections, issue.evidence.split('\n')[0] || ''),
    });
  }

  // ② 소제목이 약속한 것을 지켰는가
  try {
    for (const issue of findUnfulfilledHeadings(html)) {
      // StructureIssue 는 detail 한 줄로 말한다 — 그 안에 소제목이 들어 있다
      const detail = String(issue.detail || '');
      const heading = (detail.match(/["“']([^"”']{2,40})["”']/) || [])[1] || '';
      push({
        kind: 'unfulfilled-heading',
        title: detail || '소제목이 약속한 내용이 본문에 없습니다',
        evidence: detail,
        sectionIndex: heading ? locateSection(sections, heading) : -1,
      });
    }
  } catch { /* 구조 검사 실패는 넘어간다 */ }

  /**
   * ③ v3.8.631 — 키워드 리포트가 시킨 것을 지켰는가.
   *
   * 실측 2026-09-04: 리포트가 롱테일 3개·확인 항목 5개를 적어 줬는데
   * 발행글에는 2개만 들어갔다. 빠진 롱테일 자리를 같은 원칙의 되풀이로 메웠고,
   * 그게 "같은 말 다섯 번" 과 "근거 조항 0건" 의 원인이었다.
   * 지시를 주는 것만으로는 부족하다 — 지켰는지 재고, 안 지켰으면 채워야 한다.
   */
  if (input.reportSlot) {
    try {
      const { checkReportCompliance } = require('../keywords/cpc-report');
      const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      const c = checkReportCompliance(input.reportSlot, plain);
      for (const missing of c.missingLongtails) {
        push({
          kind: 'report-longtail-missing',
          title: `리포트가 지정한 구간이 빠졌습니다: ${missing}`,
          evidence: '이 내용을 다루지 않으면 남은 구간이 같은 원칙을 되풀이하게 됩니다. 그게 독자가 나가는 이유입니다.',
          sectionIndex: -1,
        });
      }
      for (const missing of c.missingChecks) {
        // 확인 항목은 사람이 원문을 봐야 하는 것이 많다 — 알리기만 한다
        advisory.push({
          kind: 'report-check-missing',
          title: `리포트의 확인 항목이 본문에 안 보입니다: ${missing}`,
          evidence: '확인하지 못했으면 그 내용을 쓰지 않는 편이 낫습니다. 지어내면 안 됩니다.',
          sectionIndex: -1,
        });
      }
    } catch { /* 리포트가 없거나 형식이 다르면 넘어간다 */ }
  }

  // ④ 제목이 물었는데 본문이 답했는가
  try {
    if (isQuestionTitle(title)) {
      const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      const audit = auditTitleAnswer({ title, bodyText: plain });
      if (audit.asked && !audit.answered) {
        push({
          kind: 'title-unanswered',
          // 도입부(0번 구간)를 고쳐야 한다 — 답은 첫 화면에 있어야 한다
          sectionIndex: 0,
          title: `제목이 물었는데 앞부분에 답이 없습니다: "${title}"`,
          evidence: '제목이 던진 질문에 "된다/안 된다" 로 답하는 문장이 첫 화면에 없습니다. 독자는 답을 찾으러 왔습니다.',
        });
      }
    }
  } catch { /* 판정이 안 서면 통과시킨다 */ }

  return { fixable, advisory };
}

/** PreflightFinding 을 post-critique 부품이 이해하는 모양으로 */
function toCritiqueIssue(f: PreflightFinding): CritiqueIssue {
  return {
    id: `pre-${f.kind}`,
    area: 'substance',
    severity: 'high',
    title: f.title,
    detail: f.evidence,
    evidence: f.evidence,
    fix: FIX_HINTS[f.kind] || '문제가 된 문장을 근거에 맞게 다시 씁니다.',
    sectionIndex: f.sectionIndex,
    origin: 'code',
  };
}

const FIX_HINTS: Record<string, string> = {
  'asserted-crime': '"횡령했다" 같은 확정형을 "횡령 혐의를 주장했다" 로 바꿉니다. 수사·판결 전 사건은 반드시 주장형으로 씁니다.',
  'legal-overreach': '"○○죄가 적용됐다" 를 "○○죄를 거론했다" 로 낮춥니다.',
  'unsourced-reading': '누가 그렇게 말했는지 밝히거나, 출처가 없으면 그 문장을 지웁니다. 지어내서 출처를 붙이지 않습니다.',
  'settlement-stretch': '사과·인정 요구를 "합의 가능성" 으로 넓히지 않습니다.',
  'unverified-first': '"최초 폭로" 를 "이번에 공개한 내용" 으로 바꿉니다.',
  'cross-section-echo': '앞 구간과 겹치는 문장을 지우고, 이 구간에서만 할 수 있는 이야기로 채웁니다. 없으면 짧게 두세요 — 늘리려고 같은 말을 반복하지 않습니다.',
  'unfulfilled-heading': '소제목이 약속한 내용을 근거에서 찾아 넣습니다. 근거에 없으면 소제목을 본문에 맞게 바꿉니다. 없는 사실을 지어내지 않습니다.',
  'report-longtail-missing': '이 내용을 다루는 구간을 만듭니다. 근거에서 확인된 것만 씁니다 — 채우려고 지어내지 않습니다. 대신 같은 말을 되풀이하던 문장은 지웁니다.',
  'title-unanswered': '첫 문단에서 제목의 질문에 곧바로 답합니다. 조건이 갈리면 "A면 된다 / B면 안 된다" 로 나눠 적습니다. 근거에 답이 없으면 "확인되지 않았다" 고 밝힙니다.',
};

/** 어느 구간을 고칠지 — 결함이 많은 구간부터, 상한까지만 */
export function pickSections(findings: PreflightFinding[], sectionCount: number): number[] {
  const tally = new Map<number, number>();
  for (const f of findings) {
    const idx = f.sectionIndex >= 0 && f.sectionIndex < sectionCount ? f.sectionIndex : 0;
    tally.set(idx, (tally.get(idx) || 0) + 1);
  }
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, MAX_SECTIONS)
    .map(([idx]) => idx);
}

export interface FixOutcome {
  html: string;
  /** 실제로 고친 구간 수 */
  revised: number;
  /** AI 를 몇 번 불렀는가 — 비용 확인용 */
  calls: number;
  notes: string[];
}

/**
 * 문제 구간만 다시 쓴다.
 *
 * `callModel` 은 부르는 쪽이 넘긴다 — 이 모듈은 어떤 엔진인지 모른다.
 * API 경로는 callGeminiWithRetry 를, 에이전트 경로는 CLI 를 넘기면 된다.
 * 그래야 사장님이 고른 엔진이 그대로 쓰인다.
 */
export async function fixBeforePublish(
  input: { title: string; html: string; reportSlot?: any },
  callModel: (prompt: string) => Promise<string>,
  onLog?: (line: string) => void,
): Promise<FixOutcome> {
  const html = String(input.html || '');
  const report = inspectBeforePublish({ title: input.title, html, reportSlot: input.reportSlot });

  for (const a of report.advisory) onLog?.(`   ℹ️ ${a.title}`);

  if (report.fixable.length === 0) {
    onLog?.('   ✅ 발행 전 자가 검수 — 고칠 것이 없습니다 (AI 호출 0회)');
    return { html, revised: 0, calls: 0, notes: [] };
  }

  const sections = splitSections(html);
  const targets = pickSections(report.fixable, sections.length);
  const wholePost = report.fixable.filter((f) => f.sectionIndex < 0).map(toCritiqueIssue);
  const notes: string[] = [];
  const revisions: { index: number; html: string }[] = [];
  let calls = 0;

  onLog?.(`   🩺 발행 전 자가 검수 — ${report.fixable.length}건 발견, 구간 ${targets.length}개를 다시 씁니다`);

  for (const index of targets) {
    const section = sections.find((s) => s.index === index);
    if (!section) continue;
    const mine = report.fixable.filter((f) => f.sectionIndex === index).map(toCritiqueIssue);
    if (mine.length === 0 && wholePost.length === 0) continue;

    try {
      const prompt = buildSectionRevisionPrompt({
        title: input.title,
        section,
        issues: mine,
        wholePostIssues: wholePost,
      });
      calls += 1;
      const raw = await callModel(prompt);
      const accepted = acceptRevisedSection(raw, section);
      if (!accepted.accepted) {
        notes.push(`구간 ${index}: 원본 유지 (${accepted.reason})`);
        continue;
      }
      const verdict = judgeImproved(accepted.html, section.html);
      if (!verdict.ok) {
        notes.push(`구간 ${index}: 원본 유지 (${verdict.reason})`);
        continue;
      }
      revisions.push({ index, html: accepted.html });
      notes.push(`구간 ${index}: 다시 썼습니다`);
    } catch (error: any) {
      // 한 구간이 실패해도 나머지는 계속한다. 발행은 막지 않는다.
      notes.push(`구간 ${index}: 건너뜀 (${String(error?.message || error).slice(0, 60)})`);
    }
  }

  for (const n of notes) onLog?.(`      ${n}`);

  if (revisions.length === 0) {
    return { html, revised: 0, calls, notes };
  }
  return { html: applySectionRevisions(html, revisions), revised: revisions.length, calls, notes };
}
