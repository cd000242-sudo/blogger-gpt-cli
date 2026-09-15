/**
 * 🔎 draft-audit — 본문 초안(JSON)을 **보강 호출 전에** 코드로 감사하고, 고칠 목록을 문장째 만들어 준다. (v3.8.731)
 *
 * 사장님: "글을 한번 쓸 때 LLM 이 비평하더라도 수정할 게 없고 100점에 가깝게 글을 쓰게 못하니?"
 *
 * ## 장부 실측 (9/6~9/15, 40편)
 * 첫 생성 하네스 점수 중앙값 82. 남는 결함은 구간 반복 59건이 압도적 1위, 낱말 도배 15, 절차 반복 6, 마무리가 답 안 함 6.
 * 본문은 한 번의 호출로 나오고, 그 뒤 "품질 보강" 2차 호출이 있지만 저품질 30% 이상일 때만 돌고,
 * 프롬프트가 "중복 제거" 라고만 해서 **모델은 어디가 겹치는지 모른 채** 고쳤다.
 *
 * ## 무엇을 하나 (호출 0회)
 *   ① 초안 JSON 을 발행본과 같은 모양의 HTML 로 펴서 article-audit 하네스로 잰다 — 발행 뒤 장부와 같은 눈.
 *   ② 보강 호출이 고칠 수 있는 종류만 골라, 근거 문장을 **그대로 인용한** "반드시 고칠 목록"을 만든다.
 *   ③ 보강 결과를 다시 재서 결함이 늘었으면 부르는 쪽이 폐기한다(compareDraftAudits).
 *
 * 근거 조항 없음(no-legal-basis)은 넣지 않는다 — 모델에게 채우라고 하면 조문을 지어낸다(pre-publish-fix 와 같은 원칙).
 */
import { auditArticle, type AuditIssue } from './article-audit';

export interface DraftLike {
  introduction?: string;
  conclusion?: string;
  sections?: Array<{
    h2?: string;
    h3Sections?: Array<{ h3?: string; content?: string }>;
  }>;
}

/** 보강 호출이 문장을 고쳐서 풀 수 있는 종류. 채우려면 사실이 필요한 것(근거 조항·소제목 약속)은 뺀다 */
export const DRAFT_FIX_KINDS: ReadonlySet<string> = new Set([
  'cross-section-echo',
  'term-flood',
  'procedure-repeat',
  'inline-faq',
  'deferral-flood',
  'no-stance',
  'stance-shallow',
  'hedge-repeat',
  'bloated-conclusion',
  'section-closer-checklist',
  'intro-question-missing',
  'conclusion-not-answering',
  'tone-mix',
  'personal-voice',
  'writing-process-leak',
]);

const KIND_LABEL: Record<string, string> = {
  'cross-section-echo': '구간 반복',
  'term-flood': '낱말 도배',
  'procedure-repeat': '절차 반복',
  'inline-faq': '본문 속 FAQ',
  'deferral-flood': '회피 문장',
  'no-stance': '판단 없음',
  'stance-shallow': '얕은 판단',
  'hedge-repeat': '단서 반복',
  'bloated-conclusion': '늘어진 마무리',
  'section-closer-checklist': '점검 목록 마무리',
  'intro-question-missing': '서론 질문 없음',
  'conclusion-not-answering': '마무리가 답 안 함',
  'tone-mix': '말투 섞임',
  'personal-voice': '사적 말투',
  'writing-process-leak': '작성 과정 유출',
};

const KIND_FIX: Record<string, string> = {
  'cross-section-echo': '뒤 구간의 겹치는 문장을 지우고 그 자리에 그 구간에서만 할 수 있는 말을 넣습니다. 지울 게 없으면 짧게 둡니다.',
  'term-flood': '그 낱말을 되풀이하는 문장을 구체 사례·수치·다른 표현으로 바꿉니다. 낱말이 아니라 내용을 늘립니다.',
  'procedure-repeat': '같은 확인 절차는 한 절에만 두고, 다른 절에서는 그 절만의 조건·대상·서류를 씁니다.',
  'inline-faq': '절 안의 질문·답 목록을 빼고 그 절에서만 할 수 있는 설명으로 채웁니다. 질문은 글 끝 FAQ 에만 둡니다.',
  'deferral-flood': '"확인하세요·문의하세요·따라 다릅니다" 로 닫은 문장을 조건별 판단("A 면 X, B 면 Y")으로 바꿉니다.',
  'no-stance': '절마다 필자의 판단 한 문장을 넣습니다 — 조건(누가·어떤 경우) + 행동 + 이유.',
  'stance-shallow': '판단 문장에 조건과 행동을 넣어 다시 씁니다.',
  'hedge-repeat': '같은 단서를 문단마다 붙이지 않습니다. 한 번 밝히고 그 뒤로는 주장형으로 씁니다.',
  'bloated-conclusion': '마무리는 핵심 숫자와 현재 상태만 2~4문장으로 줄입니다. 본문을 다시 말하지 않습니다.',
  'section-closer-checklist': '절의 마지막 문단을 필자의 반응(조건 + 행동 + 이유)으로 바꿉니다. 점검 목록으로 닫지 않습니다.',
  'intro-question-missing': '서론의 마지막 문장을 독자의 문제를 세우는 질문 한 문장으로 바꿉니다.',
  'conclusion-not-answering': '마무리에서 서론의 질문을 되받고 답합니다 — "A 라면 된다 / B 라면 안 된다".',
  'tone-mix': '해요체와 합니다체 중 본문에 많은 쪽으로 통일합니다.',
  'personal-voice': '"제 기준으로는", "아무튼" 같은 표현을 지웁니다.',
  'writing-process-leak': '"자료에는 없더라" 류 문장을 지웁니다. 자료가 없으면 그 항목을 뺍니다.',
};

const escapeHtml = (s: unknown): string => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 초안 JSON → 발행본과 같은 뼈대의 HTML. 서론 <p>, <h2>/<h3> + 본문, 마무리 <p> */
export function draftToHtml(draft: DraftLike): string {
  const parts: string[] = [];
  const intro = String(draft?.introduction || '').trim();
  if (intro) parts.push(/<[a-z]/i.test(intro) ? intro : `<p>${escapeHtml(intro)}</p>`);
  for (const section of draft?.sections || []) {
    parts.push(`<h2>${escapeHtml(section?.h2 || '')}</h2>`);
    for (const h3 of section?.h3Sections || []) {
      if (h3?.h3) parts.push(`<h3>${escapeHtml(h3.h3)}</h3>`);
      parts.push(String(h3?.content || ''));
    }
  }
  // 마무리는 발행본처럼 소제목 없이 뒤에 붙는다 — narrative-flow 가 "끝에서 1,500자" 를 마무리로 본다
  const conclusion = String(draft?.conclusion || '').trim();
  if (conclusion) parts.push(`<div class="conclusion">${/<[a-z]/i.test(conclusion) ? conclusion : `<p>${escapeHtml(conclusion)}</p>`}</div>`);
  return parts.join('\n');
}

export interface DraftAudit {
  /** 보강이 고칠 수 있는 결함만 */
  findings: AuditIssue[];
  /** 하네스가 잡은 전부 (로그·비교용) */
  all: AuditIssue[];
  score: number;
  html: string;
}

/** 초안을 잰다. 실패하면 빈 결과 — 감사가 생성을 막지 않는다 */
export function auditDraft(draft: DraftLike, opts: { question?: string | undefined } = {}): DraftAudit {
  const html = draftToHtml(draft);
  try {
    const report = auditArticle(html, [], { question: opts.question });
    return {
      findings: report.issues.filter((i) => DRAFT_FIX_KINDS.has(i.kind)),
      all: report.issues,
      score: report.score,
      html,
    };
  } catch {
    return { findings: [], all: [], score: 100, html };
  }
}

/** 종류별 개수 한 줄 — 로그용 */
export function describeDraftFindings(findings: AuditIssue[]): string {
  const tally = new Map<string, number>();
  for (const f of findings) tally.set(f.kind, (tally.get(f.kind) || 0) + 1);
  return [...tally.entries()].map(([k, n]) => `${KIND_LABEL[k] || k} ${n}`).join(' · ');
}

/**
 * 보강 프롬프트에 붙일 "반드시 고칠 목록". 근거 문장을 그대로 인용한다 —
 * "중복을 없애라" 는 지시는 지켜지지 않았고, "이 두 문장이 같은 말이다" 는 지켜진다.
 * 너무 길면 프롬프트 뒤쪽이 배경이 되므로 12건까지만.
 */
export function buildDraftFixBlock(findings: AuditIssue[], limit = 12): string {
  if (!findings.length) return '';
  const lines = findings.slice(0, limit).map((f, i) => {
    const evidence = String(f.evidence || '').replace(/\s+/g, ' ').trim().slice(0, 220);
    return `${i + 1}) [${KIND_LABEL[f.kind] || f.kind}] ${f.title}${evidence ? `\n   근거: "${evidence}"` : ''}\n   고칠 방향: ${KIND_FIX[f.kind] || '문제가 된 문장을 고칩니다.'}`;
  });
  const more = findings.length > limit ? `\n(그 밖에 ${findings.length - limit}건 더 있습니다 — 같은 종류는 같은 방법으로 고치세요)` : '';
  return `
🔎 [코드 감사 — 반드시 고칠 목록] (초안을 기계로 재서 찾은 것입니다. 인용한 문장이 있는 자리를 실제로 고치세요)
${lines.join('\n')}${more}
- 위 목록에 없는 문장은 바꾸지 않습니다. 새 수치·기관·조문을 지어내지 않습니다.
- 겹치는 문장을 지운 자리는 그 구간에서만 할 수 있는 말로 채우거나 비워 둡니다 — 같은 말을 다른 표현으로 되풀이하면 다시 잡힙니다.
`;
}

/** 보강 전후 비교 — 결함이 늘었으면 받지 않는다 */
export function compareDraftAudits(before: DraftAudit, after: DraftAudit): { worse: boolean; summary: string } {
  const b = before.findings.length;
  const a = after.findings.length;
  return {
    worse: a > b,
    summary: `감사 결함 ${b}→${a}건 (점수 ${before.score}→${after.score})`,
  };
}
