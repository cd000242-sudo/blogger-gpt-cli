/**
 * post-critique — 이미 발행된 글을 **비평하고, 문제 구간만 고쳐서** 같은 주소에 다시 올린다. (v3.8.619)
 *
 * ## 사장님 요청
 * "그냥 다시 발행하는 게 아니라 글을 비평해보고 개선점을 확인해서 다시 발행하도록 해줘.
 *  사람이 수동으로 고칠 수 있다면 그걸 수정발행할 수 있다면,
 *  에이전트로 비평하고 개선점을 분석하고 수정해서 발행이 가능할 거 아냐"
 *
 * ## 기존 '다시 생성'과 무엇이 다른가
 * `post-regenerate` 는 본문을 **통째로** 새로 만든다. 본문이 `and` 한 단어로 나온
 * 사고 글을 되살리는 용도다. 반면 이 모듈은 **멀쩡한 글을 더 낫게** 만든다.
 * 그래서 통째로 갈아엎지 않는다 — 문제가 있는 H2 구간만 다시 쓴다.
 * 이미지·내부링크·CTA·표가 그대로 살아남아야 하기 때문이다.
 *
 * ## 비용 구조 (fact-guard 와 같은 원칙)
 * "어디가 문제냐"를 먼저 **코드가** 찾는다 — scanSubstance · scanContentQuality ·
 * auditTitleAnswer · 경쟁글 낱말 대조. 코드가 찾은 것을 근거로 붙여 AI 에게
 * **한 번** 비평을 시키고, 사장님이 고른 항목의 **구간만** 다시 쓴다.
 * 코드 진단이 깨끗하면 AI 비평 호출도 의미가 없으므로 그대로 "고칠 것 없음"이다.
 *
 * ## 절대 원칙
 * 이 모듈은 예외를 던지지 않는다. 판단이 안 서면 원본을 그대로 돌려준다.
 * 개선하려다 글을 망가뜨리는 것이 개선 안 하는 것보다 나쁘다.
 */

import { scanSubstance, stripToPlainText, SUBSTANCE_THRESHOLDS } from './substance-gate';
import { scanContentQuality } from './quality-gate';
import { auditTitleAnswer } from './title-answer-gate';
import { findRepeatedClaims } from './redundancy-guard';
import { auditArticle, type AuditKind } from './article-audit';

/** v3.8.714: 'style' — 문장 중간 줄바꿈·표 서술형·훈계조처럼 **읽는 맛**을 깎는 것들 */
export type CritiqueArea = 'substance' | 'answer' | 'quality' | 'cta' | 'competitor' | 'structure' | 'style';
export type CritiqueSeverity = 'high' | 'medium' | 'low';

export interface CritiqueIssue {
  /** 화면 체크박스가 이 값으로 항목을 고른다 */
  id: string;
  area: CritiqueArea;
  severity: CritiqueSeverity;
  /** 무엇이 문제인가 — 한 줄 */
  title: string;
  /** 왜 문제인가 */
  detail: string;
  /** 본문에서 뽑은 근거 (없으면 빈 문자열) */
  evidence: string;
  /** 어떻게 고칠 것인가 */
  fix: string;
  /** 몇 번째 구간의 문제인가. -1 이면 글 전체 */
  sectionIndex: number;
  /** 코드가 찾았는가(code) AI 가 찾았는가(ai) */
  origin: 'code' | 'ai';
  /**
   * v3.8.750 — AI 가 "발행을 막아야 하는 결함"이라고 답했는가 (버튼 비평만 묻는다).
   * 심각도(high/medium/low)와 별개다. 최종 분류는 critique-convergence.classifyIssue 가 근거 문장까지 보고 정한다.
   */
  blocking?: boolean;
  /** v3.8.750 — AI 가 붙인 결함 종류 (fact-error · unsupported-claim · needs-evidence · style …) */
  aiType?: string;
}

export interface PostSection {
  /** 0 = 도입부(첫 H2 앞), 1부터가 H2 구간 */
  index: number;
  heading: string;
  html: string;
}

export interface PostCritique {
  /** 0~100. 낮을수록 고칠 게 많다 */
  score: number;
  issues: CritiqueIssue[];
  sections: { index: number; heading: string; chars: number }[];
  summary: string;
}

// ─────────────────────────────────────────────────────────────
// 구간 나누기
// ─────────────────────────────────────────────────────────────

const H2_TAG = /<h2\b[^>]*>[\s\S]*?<\/h2>/gi;

/** 태그를 지우고 평문만 남긴다 */
const textOf = (html: string): string => stripToPlainText(String(html || ''));

/**
 * H2 를 경계로 글을 구간으로 나눈다.
 *
 * 구간들은 원본을 **빈틈없이** 덮는다 — 이어 붙이면 원본과 정확히 같아야 한다.
 * 고정 길이 slice 로 자르면 구간이 어긋나 본문이 잘린다(과거 실수).
 * 그래서 H2 의 실제 위치만 경계로 쓴다.
 */
export function splitSections(html: string): PostSection[] {
  const source = String(html || '');
  const starts: { at: number; heading: string }[] = [];
  H2_TAG.lastIndex = 0;
  for (let m = H2_TAG.exec(source); m; m = H2_TAG.exec(source)) {
    starts.push({ at: m.index, heading: textOf(m[0]) });
  }

  if (starts.length === 0) {
    return source ? [{ index: 0, heading: '(도입부)', html: source }] : [];
  }

  const sections: PostSection[] = [];
  const intro = source.slice(0, starts[0]!.at);
  sections.push({ index: 0, heading: '(도입부)', html: intro });

  for (let i = 0; i < starts.length; i += 1) {
    const from = starts[i]!.at;
    const to = i + 1 < starts.length ? starts[i + 1]!.at : source.length;
    sections.push({ index: i + 1, heading: starts[i]!.heading, html: source.slice(from, to) });
  }
  return sections;
}

/** 구간을 이어 붙여 본문을 되돌린다 — 교체본이 있는 구간만 갈아끼운다 */
export function applySectionRevisions(html: string, revisions: { index: number; html: string }[]): string {
  const sections = splitSections(html);
  if (sections.length === 0) return String(html || '');
  const byIndex = new Map(revisions.map((r) => [Number(r.index), String(r.html || '')]));
  return sections
    .map((section) => {
      const next = byIndex.get(section.index);
      return next && next.trim() ? next : section.html;
    })
    .join('');
}

/**
 * v3.8.731 — 근거에서 **찾을 문장**을 뽑는다.
 *
 * 구간 반복 근거는 `앞: …\n뒤: …` 꼴이다. 첫 줄을 그대로 찾으면 "앞: " 접두어 때문에 어느 구간에도 없어
 * 모든 구간 반복이 "글 전체(-1)" 가 됐고, 자가 수정은 그걸 도입부에 보냈다 — 도입부를 고쳐서는 뒤 절의 반복이 안 풀린다.
 * 고칠 곳은 **뒤(나중) 구간**이다. 뒤 줄이 있으면 그것을, 없으면 첫 줄을 접두어 없이 돌려준다.
 */
export function evidenceProbe(evidence: unknown): string {
  const lines = String(evidence || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const back = lines.find((l) => /^뒤\s*[:：]/.test(l));
  return (back || lines[0] || '').replace(/^(?:앞|뒤)\s*[:：]\s*/, '');
}

/** 이 문장이 몇 번째 구간에 있는가 — 못 찾으면 -1(글 전체) */
export function locateSection(sections: PostSection[], needle: string, opts: { last?: boolean } = {}): number {
  const probe = String(needle || '').trim().slice(0, 40);
  if (!probe) return -1;
  const pool = opts.last ? [...sections].reverse() : sections;
  const hit = pool.find((s) => textOf(s.html).includes(probe));
  return hit ? hit.index : -1;
}

/**
 * 근거가 가리키는 구간. 구간 반복(`앞: …\n뒤: …`)이면 **뒤 문장이 있는 마지막 구간** — 같은 문장이 앞 절에도 있으니
 * 앞에서부터 찾으면 앞 절이 잡혀 엉뚱한 절을 고친다. 그 밖에는 첫 구간.
 */
export function locateEvidenceSection(sections: PostSection[], evidence: unknown): number {
  const isEcho = /(^|\n)\s*뒤\s*[:：]/.test(String(evidence || ''));
  return locateSection(sections, evidenceProbe(evidence), { last: isEcho });
}

// ─────────────────────────────────────────────────────────────
// 코드 진단 — AI 를 부르기 전에 여기서 먼저 찾는다
// ─────────────────────────────────────────────────────────────

const countTag = (html: string, re: RegExp): number => (String(html || '').match(re) || []).length;
const IMG_RE = /<img\b[^>]*>/gi;
const LINK_RE = /<a\b[^>]*href\s*=/gi;
/** 본문에 글자로 적힌 주소 (v3.8.658) — 고쳐 쓴 뒤에도 그대로 있어야 한다 */
const BARE_URL_RE = /(?:https?:\/\/|www\.)[^\s<"'）)]+/g;

/** 한국어 낱말 후보 — 경쟁글 대조에 쓴다 */
function keywordsOf(text: string): Set<string> {
  const out = new Set<string>();
  const words = String(text || '').match(/[가-힣]{2,10}|[A-Za-z]{3,20}/g) || [];
  for (const w of words) out.add(w.toLowerCase());
  return out;
}

/** 흔해서 대조에 의미 없는 말 */
const STOP_WORDS = new Set([
  '그리고', '하지만', '그래서', '있습니다', '합니다', '입니다', '때문에', '경우', '방법', '정리',
  '어떻게', '무엇', '이것', '저것', '가지', '위해', '통해', '대해', '관련', '가장', '정말', '진짜',
  '블로그', '포스팅', '리뷰', '후기', '추천', '총정리', '알아보기', '네이버', '티스토리',
]);

export interface CompetitorPost {
  title: string;
  /** 검색 API 가 주는 요약(description). 없으면 빈 문자열 */
  summary?: string;
}

/**
 * 경쟁글에는 있는데 내 글에는 없는 낱말.
 *
 * "경쟁글을 통째로 읽고 비교" 는 느리고 크롤링이 붙는다. 제목·요약만으로도
 * **빠진 하위 주제**는 드러난다 — 예: 상위 5편 중 4편이 "환급"을 말하는데
 * 내 글에 그 말이 없으면 그건 놓친 구간이다.
 */
export function findCompetitorGaps(myText: string, competitors: CompetitorPost[], minShare = 2): string[] {
  const mine = keywordsOf(myText);
  const tally = new Map<string, number>();
  for (const post of competitors) {
    const seen = keywordsOf(`${post.title || ''} ${post.summary || ''}`);
    for (const word of seen) {
      if (mine.has(word) || STOP_WORDS.has(word) || word.length < 2) continue;
      tally.set(word, (tally.get(word) || 0) + 1);
    }
  }
  return [...tally.entries()]
    .filter(([, n]) => n >= minShare)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
}

export interface DiagnoseInput {
  title: string;
  html: string;
  /** 검색 상위 경쟁글 (없으면 그 항목은 건너뛴다) */
  competitors?: CompetitorPost[];
}

/**
 * 코드만으로 찾을 수 있는 문제를 모은다. **AI 호출 0회.**
 * 여기서 아무것도 안 나오면 AI 비평도 부르지 않는다 — 비용을 안 쓴다.
 */
export function diagnosePost(input: DiagnoseInput): CritiqueIssue[] {
  const html = String(input.html || '');
  const title = String(input.title || '').trim();
  const sections = splitSections(html);
  const bodyText = textOf(html);
  const issues: CritiqueIssue[] = [];
  const push = (issue: Omit<CritiqueIssue, 'origin'>) => issues.push({ ...issue, origin: 'code' });

  // ① 알맹이 — 구체 팩트가 부족하거나 얼버무림이 많은가
  const substance = scanSubstance({ contentHtml: html });
  if (substance.metrics.factsPer1000 < SUBSTANCE_THRESHOLDS.minFactsPer1000) {
    push({
      id: 'substance-facts',
      area: 'substance',
      severity: 'high',
      title: '구체적인 사실이 부족합니다',
      detail: `1,000자당 구체 팩트 ${substance.metrics.factsPer1000}개 (기준 ${SUBSTANCE_THRESHOLDS.minFactsPer1000}개). 금액·날짜·기간·기관명 같은 확인 가능한 정보가 적습니다.`,
      evidence: substance.worstSentences[0] || '',
      fix: '두루뭉실한 문장을 금액·기간·조건·기관명이 들어간 문장으로 바꿉니다. 모르는 수치는 지어내지 말고 그 문장을 삭제합니다.',
      sectionIndex: locateSection(sections, substance.worstSentences[0] || ''),
    });
  }
  if (substance.metrics.vaguePer1000 > SUBSTANCE_THRESHOLDS.maxVaguePer1000) {
    push({
      id: 'substance-vague',
      area: 'substance',
      severity: 'medium',
      title: '책임 회피·얼버무림 표현이 많습니다',
      detail: `1,000자당 ${substance.metrics.vaguePer1000}개 (기준 ${SUBSTANCE_THRESHOLDS.maxVaguePer1000}개). "공식 사이트에서 확인하세요", "상황에 따라 다릅니다" 류가 답을 대신하고 있습니다.`,
      evidence: substance.worstSentences[1] || substance.worstSentences[0] || '',
      fix: '회피 문장을 판정 문장으로 바꿉니다. 정말 갈리는 문제라면 "무엇에 따라 갈리는지" 기준을 적습니다.',
      sectionIndex: locateSection(sections, substance.worstSentences[1] || substance.worstSentences[0] || ''),
    });
  }
  if (substance.metrics.clichesPer1000 > SUBSTANCE_THRESHOLDS.maxClichesPer1000) {
    push({
      id: 'substance-cliche',
      area: 'substance',
      severity: 'low',
      title: '뻔한 상투구가 많습니다',
      detail: `1,000자당 ${substance.metrics.clichesPer1000}개. 누구나 쓰는 문장은 읽는 사람에게 아무것도 남기지 않습니다.`,
      evidence: substance.worstSentences[2] || '',
      fix: '상투구 문장을 실제 사례·수치가 들어간 문장으로 교체합니다.',
      sectionIndex: locateSection(sections, substance.worstSentences[2] || ''),
    });
  }

  // ② 제목이 물은 질문에 앞부분에서 답했는가
  const answer = auditTitleAnswer({ title, bodyText });
  if (answer.asked && !answer.answered) {
    push({
      id: 'answer-missing',
      area: 'answer',
      severity: 'high',
      title: '제목이 물었는데 앞부분에 답이 없습니다',
      detail: answer.evasion
        ? `답이 있어야 할 자리에 회피 문장이 있습니다: "${answer.evasion}"`
        : '글 앞 1,200자 안에 "된다/안 된다/이런 조건이면 갈린다" 판정 문장이 없습니다.',
      evidence: answer.evasion,
      fix: '도입부 끝나기 전에 한 문장으로 판정을 내립니다. 조건부라면 갈리는 기준을 같이 적습니다.',
      sectionIndex: 0,
    });
  }

  // ③ 애드센스 품질 게이트 (분량·출처·alt·내부링크 등)
  const quality = scanContentQuality(html);
  for (const warning of quality.warnings) {
    /**
     * v3.8.619 — 메타 description 은 본문 밖(플랫폼 SEO 설정)에 산다.
     * 발행글 비평은 본문 HTML 만 보므로 이 항목은 **언제나** "누락"으로 잡힌다.
     * 늘 뜨는 지적은 읽는 사람이 곧 무시하게 되고, 진짜 지적까지 같이 묻힌다.
     */
    if (warning.metric === 'metaDescription') continue;
    push({
      id: `quality-${warning.metric}`,
      area: 'quality',
      severity: warning.metric === 'length' ? 'high' : 'medium',
      title: `품질 기준 미달: ${warning.metric}`,
      detail: warning.message,
      evidence: '',
      fix: warning.metric === 'length'
        ? '가장 얇은 구간을 골라 실제 정보를 채웁니다. 같은 말 반복으로 늘리지 않습니다.'
        : '해당 항목을 기준치까지 채웁니다.',
      sectionIndex: -1,
    });
  }

  // ④ 전환 — 읽고 나서 무엇을 하라는 말이 있는가
  const linkCount = countTag(html, LINK_RE);
  if (linkCount === 0) {
    push({
      id: 'cta-none',
      area: 'cta',
      severity: 'medium',
      title: '다음 행동으로 보내는 링크가 하나도 없습니다',
      detail: '읽고 나서 무엇을 해야 하는지 알려주지 않으면 그 유입은 그대로 끝납니다.',
      evidence: '',
      fix: '글 끝에 이 주제의 다음 단계(신청·조회·관련 글)로 가는 링크를 답과 함께 붙입니다.',
      sectionIndex: -1,
    });
  }
  if (countTag(html, IMG_RE) === 0) {
    push({
      id: 'structure-noimage',
      area: 'structure',
      severity: 'low',
      title: '이미지가 한 장도 없습니다',
      detail: '글이 글자벽이면 체류 시간이 떨어집니다.',
      evidence: '',
      fix: '핵심 구간마다 그 내용을 설명하는 이미지를 넣습니다.',
      sectionIndex: -1,
    });
  }

  // ⑤ 되풀이 — 같은 주장을 몇 번이나 다시 말했는가
  const repeats = findRepeatedClaims(html).filter((r) => r.occurrence > 2);
  if (repeats.length > 0) {
    const worst = repeats.reduce((a, b) => (b.occurrence > a.occurrence ? b : a));
    push({
      id: 'redundancy-repeat',
      area: 'structure',
      severity: 'medium',
      title: '같은 말을 너무 여러 번 합니다',
      detail: `같은 주장이 최대 ${worst.occurrence}회 되풀이됩니다(3회 이상 ${repeats.length}건). 훑어 읽는 독자를 위해 두 번까지는 괜찮지만, 그 이상은 읽는 사람이 "아까 봤는데"라고 느낍니다.`,
      evidence: worst.repeat,
      fix: '세 번째부터의 되풀이를 빼거나, 같은 사실을 다른 각도(예시·수치·절차)로 바꿔 말합니다.',
      sectionIndex: locateSection(sections, worst.repeat),
    });
  }

  // ⑥ 경쟁글 대조 — 상위 글들이 다루는데 내 글엔 없는 것
  const gaps = findCompetitorGaps(bodyText, input.competitors || []);
  if (gaps.length >= 3) {
    push({
      id: 'competitor-gap',
      area: 'competitor',
      severity: 'medium',
      title: '상위 글들이 다루는 내용이 빠졌습니다',
      detail: `검색 상위 글 여러 편이 함께 다루는 말인데 이 글에는 없습니다: ${gaps.join(', ')}`,
      evidence: gaps.join(', '),
      fix: '빠진 주제 중 이 글의 검색 의도에 맞는 것만 골라 구간을 보태거나 기존 구간에 녹입니다. 억지로 다 넣지 않습니다.',
      sectionIndex: -1,
    });
  }

  /**
   * ⑨ v3.8.628 — 글 품질 하네스가 잡는 것들.
   *
   * 사장님이 발행글 하나를 짚으며 "글이 개판이면 이탈률이 어마어마해서 안 된다" 고 했다.
   * 손으로 읽어 결함 여섯을 찾았는데 위 ①~⑧ 이 **하나도 못 잡았다**:
   *   붙은 문장 6건 · 구간끼리 같은 말 · 낱말 도배 · 법 조문 0건 · 말투 섞임 · 제목 손상
   * 그래서 비평이 "두루뭉실" 했다. 재는 눈이 없으면 할 말도 없다.
   *
   * 하네스는 AI 를 부르지 않는다 — 비용 0, 매번 같은 답.
   */
  const audit = auditArticle(html);
  const AUDIT_META: Record<AuditKind, { area: CritiqueArea; severity: CritiqueSeverity; fix: string }> = {
    'glued-sentence': {
      area: 'quality', severity: 'medium',
      fix: '마침표 뒤에 공백이나 문단 나눔을 넣습니다. 목록을 문단으로 합칠 때 생기는 자국입니다.',
    },
    /**
     * v3.8.641 — 독자가 읽을 글에 "내가 받은 자료에는 없더라" 가 들어갔다.
     * 반드시 고쳐야 한다: 쓸모가 없고, AI 가 쓴 티가 가장 크게 나는 자리다.
     */
    'writing-process-leak': {
      area: 'substance', severity: 'high',
      fix: '그 문장을 지웁니다. 자료가 없으면 그 항목 자체를 빼세요 — 소제목을 두고 "근거가 없다"고 적으면 글이 비어 보입니다. 필요하면 그 자리에 확인된 내용을 채웁니다.',
    },
    'cross-section-echo': {
      area: 'structure', severity: 'high',
      fix: '뒤 구간에서 앞과 겹치는 문장을 지우고, 그 자리에 그 구간에서만 할 수 있는 이야기를 넣습니다. 같은 말을 두 번 읽으면 독자는 나갑니다.',
    },
    'term-flood': {
      area: 'quality', severity: 'medium',
      fix: '같은 낱말을 반복하는 대신 구체 사례·수치·다른 표현으로 바꿉니다. 낱말이 아니라 내용을 늘려야 합니다.',
    },
    'unfulfilled-heading': {
      area: 'structure', severity: 'high',
      fix: '소제목이 약속한 것을 본문에 넣거나, 본문에 있는 것으로 소제목을 바꿉니다.',
    },
    'no-legal-basis': {
      area: 'substance', severity: 'high',
      fix: '근거 조항·고시 번호·판례 번호를 찾아 넣습니다. 못 찾으면 그 주장을 빼는 편이 낫습니다 — 확인할 수 없는 글은 인용도 안 됩니다.',
    },
    'tone-mix': {
      area: 'quality', severity: 'low',
      fix: '해요체와 합니다체 중 하나로 통일합니다.',
    },
    'broken-title': {
      area: 'structure', severity: 'medium',
      fix: '잘려 나간 앞부분을 되살립니다. 제목을 만드는 쪽에서 잘린 것이라면 그쪽을 고쳐야 합니다.',
    },

    /**
     * v3.8.629 — 사건·분쟁 글의 법적 위험 (사장님 지시 10개 항목).
     * 이건 품질이 아니라 **위험**이다. 확정형으로 쓴 문장 하나가 명예훼손이 된다.
     * 그래서 severity 를 높게 잡는다 — 다른 지적보다 먼저 고쳐야 한다.
     */
    'asserted-crime': {
      area: 'substance', severity: 'high',
      fix: '"횡령했다" 를 "횡령 혐의를 주장했다" 로 바꿉니다. 수사·판결 전 사건은 반드시 "주장했다·밝혔다·언급했다" 형태로 씁니다.',
    },
    'legal-overreach': {
      area: 'substance', severity: 'high',
      fix: '"사기죄가 적용됐다" 를 "사기죄를 거론했다" 로 낮춥니다. 당사자가 죄명을 말한 것과 그 혐의가 적용된 것은 다릅니다.',
    },
    'unsourced-reading': {
      area: 'substance', severity: 'medium',
      fix: '누가 그렇게 말했는지 밝히거나, 출처가 없으면 그 문장을 지웁니다. "~로 보인다" 는 글쓴이 추측입니다.',
    },
    'money-confusion': {
      area: 'substance', severity: 'high',
      fix: '전체 피해 주장액과 증거 자료 속 금액을 각각 무엇인지 밝혀 적습니다. 관계가 확인되지 않았다면 한 문장에서 잇지 않습니다.',
    },
    'settlement-stretch': {
      area: 'substance', severity: 'medium',
      fix: '사과·인정 요구를 "합의 가능성" 으로 넓히지 않습니다. "대화 또는 관계 회복의 여지를 남겼다" 정도로 씁니다.',
    },
    'unverified-first': {
      area: 'substance', severity: 'medium',
      fix: '과거 기록을 확인하지 않았다면 "이번에 공개한 내용", "이번 SNS 글에서 밝힌 내용" 으로 바꿉니다.',
    },
    'personal-voice': {
      area: 'quality', severity: 'low',
      fix: '"제 기준으로는", "아무튼" 같은 표현을 지웁니다. 정보성 글의 문체를 유지합니다.',
    },
    'hedge-repeat': {
      area: 'quality', severity: 'medium',
      fix: '같은 단서를 문단마다 붙이지 않습니다. 한 번 분명히 밝히고, 그 뒤로는 서술을 주장형으로 유지하면 됩니다.',
    },
    'bloated-conclusion': {
      area: 'structure', severity: 'medium',
      fix: '마지막 문단은 핵심 숫자와 현재 상태만 2~4문장으로 줄입니다. 본문을 다시 말하지 않습니다.',
    },
    /**
     * v3.8.654 — 독자가 나가는 자리. 100점 글을 읽고 만든 검사 셋.
     * 사장님: "글내용이 중요해 사람들이 읽고 이탈하면 절대안된다고"
     */
    'title-promise-unkept': {
      area: 'answer', severity: 'high',
      fix: '제목이 약속한 조각마다 그것에 답하는 소제목을 하나씩 둡니다. 답을 모르면 제목에서 그 약속을 뺍니다 — 약속하고 안 지키는 것이 가장 나쁩니다.',
    },
    'faq-answer-mismatch': {
      area: 'answer', severity: 'medium',
      fix: '질문이 묻는 것에 첫 문장에서 바로 답합니다. 질문의 핵심 낱말이 답에 있어야 합니다. 답을 모르면 그 질문을 뺍니다.',
    },
    'thin-section': {
      area: 'structure', severity: 'medium',
      fix: '그 절에서만 할 수 있는 이야기를 채우거나, 이웃 절과 합칩니다. 소제목만 있고 내용이 없는 절은 독자가 나가는 자리이고 광고가 붙을 자리도 안 됩니다.',
    },
    'replacement-artifact': {
      area: 'structure', severity: 'high',
      fix: '"$1"·"undefined" 같은 찌꺼기를 지우고 문장을 잇습니다. 글이 아니라 프로그램 오류이므로 원인 코드도 고쳐야 합니다.',
    },
    'empty-section': {
      area: 'structure', severity: 'high',
      fix: '소제목이 약속한 내용을 근거에서 찾아 채웁니다. 근거에 없으면 그 절과 목차 항목을 함께 뺍니다. 빈 절을 두고 발행하지 않습니다.',
    },
    'inline-faq': {
      area: 'structure', severity: 'medium',
      fix: '절 안의 질문·답 목록을 뺍니다. 그 절에서만 할 수 있는 설명으로 채우고, 질문은 글 끝 FAQ 에만 둡니다.',
    },
    // v3.8.660 — 흐름·관점
    'deferral-flood': {
      area: 'substance', severity: 'high',
      fix: '"확인하세요·문의하세요·따라 다릅니다" 로 닫은 절마다 필자의 판단 한 문장으로 바꿉니다. 조건이 갈리면 "A면 X, B면 Y" 로 적습니다.',
    },
    'no-stance': {
      area: 'substance', severity: 'high',
      fix: '절마다 "저는 이 경우 A 쪽으로 봅니다. 이유는 …" 같은 근거 붙은 판단 문장을 넣습니다. 결론 첫 문장은 서론의 질문에 답합니다.',
    },
    'title-thread-lost': {
      area: 'answer', severity: 'medium',
      fix: '제목이 약속한 상황의 독자에게 그 절이 무엇을 주는지 첫 문장에서 잇습니다. 잇지 못하는 절은 제목과 관계없는 절이니 뺍니다.',
    },
    'intro-promise-unkept': {
      area: 'answer', severity: 'medium',
      fix: '결론 첫 문장에서 서론이 던진 질문에 답합니다. 서론이 약속한 항목을 마무리에서 하나씩 받아 닫습니다.',
    },
    // v3.8.662 — 깊이와 목소리
    'stance-shallow': {
      area: 'substance', severity: 'high',
      fix: '판단 문장을 조건 + 행동 + 이유로 다시 씁니다. "경남 사업자라면 10월 안내를 기다리지 말고 지금 손해보험 공고부터 읽으세요. 신용생명보험은 대출이 있을 때만 의미가 있기 때문입니다." 처럼.',
    },
    'promise-deferred': {
      area: 'substance', severity: 'high',
      fix: '제목이 약속한 절은 대상별 답으로 씁니다 — "별도 신청 없이 반영되는 사람 / 직접 신청해야 하는 사람 / 면제인데 고지서가 온 사람". "확인하세요" 로 끝내지 않습니다.',
    },
    'procedure-repeat': {
      area: 'substance', severity: 'medium',
      fix: '같은 확인 절차는 한 절에만 두고, 다른 절에서는 그 절만의 조건·대상·서류를 씁니다.',
    },
    // v3.8.671 — 흐름 검사 3종. 아직 알리기만 한다(감점 0, 자가 수정 대상 아님). 673 에서 보정 뒤 켠다.
    'intro-question-missing': {
      area: 'structure', severity: 'medium',
      fix: '서론의 마지막 문장을 독자의 문제를 세우는 질문 하나로 바꿉니다. 지시("확인하는 것이 출발점")로 끝내지 않습니다.',
    },
    'section-closer-checklist': {
      area: 'substance', severity: 'medium',
      fix: '절의 마지막 문단을 필자의 반응으로 바꿉니다 — 조건(누가·어떤 경우) + 행동 + 이유. 점검 목록으로 닫지 않습니다.',
    },
    'answer-box-hedged': {
      area: 'substance', severity: 'high',
      fix: '답 상자의 답을 판정문으로 바꿉니다 — "A 라면 됩니다 / B 라면 안 됩니다". 본문 절의 마지막 판단 문장을 그대로 가져와도 됩니다.',
    },
    'conclusion-not-answering': {
      area: 'structure', severity: 'medium',
      fix: '마무리에서 서론의 질문을 한 번 되받고 답을 줍니다 — "A 라면 된다 / B 라면 안 된다".',
    },
    'table-template': {
      area: 'structure', severity: 'low',
      fix: '수치·조건 비교가 없는 절의 표를 문단으로 풀고, 표는 글 전체 3개 이하로 둡니다. "누구에게 맞는지" 열을 습관처럼 붙이지 않습니다.',
    },
  };

  for (const found of audit.issues) {
    const meta = AUDIT_META[found.kind];
    push({
      id: `audit-${found.kind}-${issues.length}`,
      area: meta.area,
      severity: meta.severity,
      title: found.title,
      detail: found.evidence,
      evidence: found.evidence,
      fix: meta.fix,
      // v3.8.731: 구간 반복은 뒤 절을 가리켜야 한다 — 첫 줄("앞: …")로 찾으면 늘 -1 이었다
      sectionIndex: locateEvidenceSection(sections, found.evidence),
    });
  }

  /* ────────────────────────────────────────────────────────────
   * v3.8.714 — 사람이 30초면 보는 결함을 기계도 보게 한다.
   *
   * 사장님이 발행글을 읽고 잡아낸 것들인데, 비평은 "출처 0회"·"반복 구절"만 말하고
   * 정작 눈에 걸리는 이 셋은 한 번도 짚지 않았다. AI 에 맡기지 않고 여기서 센다 —
   * 세는 일은 코드가 확실하고 공짜다.
   * ──────────────────────────────────────────────────────────── */

  // ① 문장 한가운데서 갈린 줄 (실측: 한 편에 18곳)
  const midBreaks: string[] = [];
  for (const m of html.matchAll(/([^<>]{6,60}?)<br\s*\/?>/gi)) {
    const tail = String(m[1] || '').trim();
    if (/(?:,|이며|하며|하고|이고|지만|이지|것이지|면서|않고|없이|이나|거나|는데|은데|아서|어서|라서)\s*$/.test(tail)) {
      midBreaks.push(tail.slice(-40));
    }
  }
  if (midBreaks.length >= 3) {
    push({
      id: 'style-mid-sentence-break',
      area: 'style',
      severity: midBreaks.length >= 10 ? 'high' : 'medium',
      title: '문장 한가운데서 줄이 갈립니다',
      detail: `${midBreaks.length}곳에서 쉼표·연결어미 뒤에 줄바꿈이 들어갔습니다. 읽는 사람은 "왜 여기서 끊기지?" 하며 호흡이 끊깁니다.`,
      evidence: midBreaks.slice(0, 3).map((s) => `…${s} ⏎`).join('\n'),
      fix: '한 문장은 한 줄로 둡니다. 줄바꿈은 문장이 끝난 자리에만 넣습니다.',
      sectionIndex: locateSection(sections, midBreaks[0] || ''),
    });
  }

  // ② 표 셀이 문장으로 끝남 — 표는 명사로 끊어야 눈이 훑는다
  const verbCells: string[] = [];
  for (const m of html.matchAll(/<t[dh][^>]*>([\s\S]{2,80}?)<\/t[dh]>/gi)) {
    const cell = String(m[1] || '').replace(/<[^>]+>/g, '').trim();
    if (/(입니다|합니다|됩니다|합니다만)\.?$/.test(cell)) verbCells.push(cell);
  }
  if (verbCells.length >= 2) {
    push({
      id: 'style-table-sentence',
      area: 'style',
      severity: 'medium',
      title: '표 안이 문장으로 끝납니다',
      detail: `표 셀 ${verbCells.length}칸이 "~입니다/~합니다"로 끝납니다. 표는 명사로 끊어야 눈이 훑고, 서술형이 들어가면 표가 아니라 문단이 됩니다.`,
      evidence: verbCells.slice(0, 3).join(' · '),
      fix: '표 셀은 명사구로 적습니다. "경기민원24입니다." → "경기민원24", "본인이 신청합니다." → "본인 신청".',
      sectionIndex: locateSection(sections, verbCells[0] || ''),
    });
  }

  // ③ 훈계조 — "~해서는 안 됩니다" 가 반복되면 독자를 가르치는 글이 된다
  const scolding = bodyText.match(/[^.!?\n]{5,60}?(?:해서는 안 됩니다|하면 안 됩니다|해서는 안 된다)/g) || [];
  if (scolding.length >= 3) {
    push({
      id: 'style-scolding',
      area: 'style',
      severity: 'medium',
      title: '독자를 가르치는 말투가 반복됩니다',
      detail: `"~해서는 안 됩니다" 류가 ${scolding.length}번 나옵니다. 사장님 말투(합니다체 + 공감)와 반대로 읽힙니다.`,
      evidence: scolding.slice(0, 3).map((s) => s.trim()).join('\n'),
      fix: '금지문 대신 사실로 적습니다. "…생각해서는 안 됩니다" → "9월 30일이 지나면 접수가 안 됩니다".',
      sectionIndex: locateSection(sections, scolding[0]?.trim() || ''),
    });
  }

  // ④ 글이 자기 구조를 설명하는 문장 — 독자가 궁금한 건 목차가 아니다
  const meta = bodyText.match(/[^.!?\n]{5,60}?(?:나누어 살펴봅니다|살펴보겠습니다|구분할 필요가 있습니다|정리해 보겠습니다|알아보겠습니다|순서입니다)/g) || [];
  if (meta.length >= 2) {
    push({
      id: 'style-meta-sentence',
      area: 'style',
      severity: 'low',
      title: '글이 자기 구조를 설명합니다',
      detail: `"나누어 살펴봅니다" 같은 안내 문장이 ${meta.length}번 나옵니다. 독자가 궁금한 것은 목차가 아니라 답입니다.`,
      evidence: meta.slice(0, 3).map((s) => s.trim()).join('\n'),
      fix: '구조를 설명하는 문장을 지우고 그 자리에 답이나 숫자를 넣습니다.',
      sectionIndex: locateSection(sections, meta[0]?.trim() || ''),
    });
  }

  return issues;
}

/** 진단 결과로 점수를 낸다 — 낮을수록 고칠 게 많다 */
export function scoreIssues(issues: CritiqueIssue[]): number {
  const weight = { high: 18, medium: 9, low: 4 };
  const penalty = issues.reduce((sum, issue) => sum + (weight[issue.severity] || 4), 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

export function summarizeCritique(issues: CritiqueIssue[], opts: { aiSkipped?: boolean } = {}): string {
  if (issues.length === 0) {
    return opts.aiSkipped
      ? '✅ 코드 진단 0건 — 게이트를 전부 통과해 AI 비평은 부르지 않았습니다 (API 호출 0회).'
      : '✅ 코드 진단·비평 모두 고칠 점을 찾지 못했습니다.';
  }
  // v3.8.750 — 버튼 비평은 지적마다 blocking 이 붙어 온다. 「반드시」는 심각도 high 가 아니라 blocking 만 센다.
  const graded = issues.some((i) => typeof i.blocking === 'boolean');
  const high = graded
    ? issues.filter((i) => i.blocking === true).length
    : issues.filter((i) => i.severity === 'high').length;
  // 점수도 같다 — 버튼 비평의 점수는 발행을 막는 결함만으로 잰다 (critique-convergence 와 같은 값)
  return `총 ${issues.length}건 (반드시 고칠 것 ${high}건) · 점수 ${scoreIssues(graded ? issues.filter((i) => i.blocking === true) : issues)}점`;
}

/**
 * v3.8.624 — AI 비평을 부를 것인가.
 *
 * 머리말에 "코드 진단이 깨끗하면 AI 비평 호출도 의미가 없다"고 적어 두고도 늘 한 번 불렀다.
 * 찾을 게 없는 글에 "더 찾아라"를 시키면 지어낸 지적이 나오고, 사장님 키 비용만 든다.
 * 진단 0건이면 호출 0회로 끝낸다.
 */
export function shouldCallAiCritique(codeIssues: CritiqueIssue[]): { call: boolean; reason: string } {
  const count = Array.isArray(codeIssues) ? codeIssues.length : 0;
  if (count === 0) {
    return { call: false, reason: '코드 진단 0건 — 게이트를 전부 통과한 글이라 AI 비평을 부르지 않습니다 (API 호출 0회)' };
  }
  return { call: true, reason: '' };
}

// ─────────────────────────────────────────────────────────────
// AI 비평
// ─────────────────────────────────────────────────────────────

const clip = (text: string, n: number): string => (text.length > n ? `${text.slice(0, n)}…` : text);

/** 비평 요청 프롬프트. 코드가 찾은 것을 근거로 붙여 "또 찾아라"가 아니라 "더 찾아라"로 만든다 */
export function buildCritiquePrompt(input: {
  title: string;
  html: string;
  codeIssues: CritiqueIssue[];
  competitors?: CompetitorPost[];
  /**
   * v3.8.622 — 지난 비평에서 지적하고 **이미 고쳐서 발행한** 문제들.
   *
   * 이걸 안 주면 AI 는 매번 백지에서 본다. 고친 문제를 말만 바꿔 다시 지적하고,
   * 사장님은 "분명 고쳤는데 왜 또 나오냐"를 겪는다. 코드 진단은 다시 재면 사라지지만
   * AI 지적은 재는 잣대가 없어서 **알려주지 않으면 사라지지 않는다.**
   */
  resolved?: string[];
}): string {
  const sections = splitSections(input.html);
  const map = sections
    .map((s) => `[구간 ${s.index}] ${s.heading} (${textOf(s.html).length}자)`)
    .join('\n');
  const found = input.codeIssues.length
    ? input.codeIssues.map((i) => `· (${i.severity}) ${i.title} — ${i.detail}`).join('\n')
    : '· (코드 진단에서는 걸린 것이 없습니다)';
  const rivals = (input.competitors || []).length
    ? (input.competitors || []).slice(0, 5).map((c, i) => `${i + 1}. ${c.title}${c.summary ? ` — ${clip(c.summary, 100)}` : ''}`).join('\n')
    : '(경쟁글 자료 없음)';

  return [
    '당신은 검색 유입으로 먹고사는 블로그의 편집장입니다.',
    '아래는 **이미 발행된 글**입니다. 칭찬은 필요 없습니다. 고쳐야 할 곳만 짚으세요.',
    '',
    `# 글 제목\n${input.title}`,
    '',
    `# 구간 목록\n${map}`,
    '',
    `# 코드가 이미 찾은 문제\n${found}`,
    '',
    ...(( input.resolved || []).length
      ? [`# 지난 비평에서 지적하고 이미 고친 것 (다시 말하지 마세요)\n${(input.resolved || []).slice(0, 20).map((t) => `· ${t}`).join('\n')}`, '']
      : []),
    `# 같은 키워드 검색 상위 글\n${rivals}`,
    '',
    `# 본문\n${clip(input.html, 24000)}`,
    '',
    '# 지시',
    '1. 위에 **없는** 문제만 새로 찾으세요. 코드가 이미 찾은 것, 이미 고친 것을 되풀이하지 마세요.',
    '1-1. **찾을 게 없으면 [] 를 내세요.** 억지로 채우지 마세요 — 이 글은 이미 여러 번 고쳤을 수 있습니다.',
    '2. 다음 관점으로만 보세요:',
    '   · 검색 의도 — 이 제목으로 들어온 사람이 원한 답이 실제로 있는가',
    '   · 구간 순서 — 궁금한 순서대로 놓였는가, 뒤에 묻힌 답은 없는가',
    '   · 경쟁글 대비 — 상위 글에는 있고 이 글에는 없는 실질 정보',
    '   · 전환 — 읽고 나서 할 행동이 분명한가',
    '3. 문장이 예쁜지 미운지는 보지 마세요. **정보가 있는가**만 보세요.',
    '4. 각 문제는 반드시 **한 구간**에 붙이세요(글 전체 문제면 -1).',
    // v3.8.750 — 심각도와 별개로 "발행을 막는가"를 묻는다. 선택 개선이 「반드시」로 떠서 끝없이 고치던 것을 끊는다.
    '5. 각 문제에 blocking 과 type 을 붙이세요. **발행을 막아야 하는 결함만** blocking:true 입니다:',
    '   fact-error(사실 오류) · unsupported-claim(근거 없는 숫자·날짜·직접 인용) · title-contradiction(제목과 본문이 정면으로 부딪힘) ·',
    '   entity-mixup(다른 인물·지역·상품이 섞임) · answer-missing(핵심 답이 없음) · misleading-action(독자를 잘못된 행동으로 이끎) ·',
    '   title-promise(제목이 약속한 것을 안 다룸) · empty-section(핵심 절이 비어 있음) · artifact(치환 찌꺼기) · process-leak(작성 과정·프롬프트가 새어 나옴) · broken-title(잘린 제목)',
    '   표현·리듬·약한 반복·어미 취향·도입부 세기·"사실은 맞지만 더 구체적이면 좋겠다"·스타일은 blocking:false, type:"style" 입니다.',
    '   새 자료·근거·수치를 더 찾아 넣어야만 풀리는 지적은 blocking:false, type:"needs-evidence" 입니다.',
    '6. blocking:true 인 항목은 evidence 에 본문 문장을 **글자 그대로** 옮기세요. 그대로 옮길 수 없으면 blocking:false 로 두세요.',
    '',
    '# 출력 형식 — JSON 배열만. 설명·코드블록 금지.',
    '[{"severity":"high|medium|low","blocking":false,"type":"style","title":"한 줄 문제","detail":"왜 문제인지","evidence":"본문에서 그대로 인용한 문장","fix":"어떻게 고칠지","sectionIndex":0}]',
    '문제를 못 찾으면 [] 만 출력하세요. 없는 문제를 지어내지 마세요.',
  ].join('\n');
}

/** 모델 응답에서 JSON 배열만 건져낸다. 실패하면 빈 배열 — 비평 실패로 발행을 막지 않는다 */
export function parseCritiqueIssues(raw: string, sectionCount: number): CritiqueIssue[] {
  const text = String(raw || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) return [];

  let parsed: any;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const allowed: CritiqueSeverity[] = ['high', 'medium', 'low'];
  return parsed
    .filter((item: any) => item && typeof item.title === 'string' && item.title.trim())
    .slice(0, 10)
    .map((item: any, i: number): CritiqueIssue => {
      const index = Number(item.sectionIndex);
      return {
        id: `ai-${i}`,
        area: 'structure',
        severity: allowed.includes(item.severity) ? item.severity : 'medium',
        title: String(item.title).trim().slice(0, 120),
        detail: String(item.detail || '').trim().slice(0, 500),
        evidence: String(item.evidence || '').trim().slice(0, 300),
        fix: String(item.fix || '').trim().slice(0, 500),
        sectionIndex: Number.isInteger(index) && index >= 0 && index < sectionCount ? index : -1,
        origin: 'ai',
        // v3.8.750 — 버튼 비평의 발행 차단 여부. 근거 문장 확인은 critique-convergence 가 한다.
        blocking: item.blocking === true,
        aiType: String(item.type || '').trim().toLowerCase().slice(0, 40),
      };
    });
}

// ─────────────────────────────────────────────────────────────
// 구간 다시 쓰기
// ─────────────────────────────────────────────────────────────

/**
 * v3.8.623 — **빼는 수정**인가.
 *
 * 되풀이·얼버무림·상투구는 빼는 게 답인데, 그 위에 "분량을 줄이지 마세요"를 얹어 두면
 * 모델은 뺀 자리를 새 문장으로 메운다. 그 문장이 다음 비평에서 또 잡혔다.
 * 빼는 수정은 짧아지는 게 정상이므로 분량 바닥을 따로 둔다.
 */
const CUTTING_IDS = new Set(['redundancy-repeat', 'substance-vague', 'substance-cliche']);
// "삭제"는 넣지 않는다 — "모르는 수치는 그 문장을 삭제합니다"(substance-facts)는 채우는 수정이다(v3.8.623 그물).
// 사장님이 직접 적은 "지워 줘" 는 manual-revision.isCuttingRequest 가 따로 본다.
const CUTTING_WORDS = /되풀이|반복|중복|군더더기|장황|늘어지|얼버무|상투|회피/;

/**
 * v3.8.731 — 하네스 결함 중 **빼는 게 답인 종류**. id 에 접두어(audit-·pre-)와 순번이 붙어 오므로 조각으로 본다.
 * 발행 전 자가 수정이 33편 중 2편만 고친 원인: 구간 반복(59건)에 "겹치는 문장을 지우라"고 시키고
 * 관문은 "분량 90% 미만이면 반려" 였다 — 지우면 반려됐다.
 */
const CUTTING_KINDS = /cross-section-echo|procedure-repeat|inline-faq|hedge-repeat|bloated-conclusion|redundancy-repeat/;

export function isCuttingIssue(issue: Pick<CritiqueIssue, 'id' | 'title' | 'fix'>): boolean {
  const id = String(issue?.id || '');
  if (CUTTING_IDS.has(id) || CUTTING_KINDS.test(id)) return true;
  return CUTTING_WORDS.test(`${issue?.title || ''} ${issue?.fix || ''}`);
}

/** 구간 분량 바닥 — 채우는 수정 90%, 빼는 수정 60%(그 아래는 통째 삭제다) */
const SECTION_FLOOR = { keep: 0.9, cut: 0.6 } as const;
/** 글 전체 바닥 — 빼는 구간이 몇 개여도 전체가 25% 넘게 빠지면 뭔가 잘못됐다 */
const POST_FLOOR = { keep: 0.9, cut: 0.75 } as const;

/** 이 구간을 어떻게 고칠지 — 고를 항목이 붙은 구간에 대해서만 부른다 */
export function buildSectionRevisionPrompt(input: {
  title: string;
  section: PostSection;
  issues: CritiqueIssue[];
  wholePostIssues: CritiqueIssue[];
  /**
   * v3.8.729 — "앞 절과 같은 말을 합니다" 같은 지적은 **상대 절을 봐야** 고칠 수 있다.
   * 글 전체 HTML 을 매번 실으면 구간 수만큼 비용이 곱해지므로, 부르는 쪽이 필요한 절의 평문만 추려 준다.
   */
  contextText?: string;
}): string {
  const all = [...input.issues, ...input.wholePostIssues];
  const list = all
    .map((issue, i) => `${i + 1}. [${issue.severity}] ${issue.title}\n   왜: ${issue.detail}\n   ${issue.evidence ? `근거: "${clip(issue.evidence, 160)}"\n   ` : ''}고칠 방향: ${issue.fix}`)
    .join('\n');
  const lengthRule = all.some(isCuttingIssue)
    ? '· 이번 수정은 **빼는 것**이 목적입니다. 되풀이·얼버무림·군더더기를 빼서 짧아지는 것은 좋습니다. 빈자리를 새 문장으로 메우지 마세요 — 메우면 같은 지적이 또 나옵니다. 단, 지금 분량의 60% 아래로는 줄이지 마세요.'
    : '· 분량을 줄이지 마세요. 지금보다 짧아지면 안 됩니다.';

  return [
    `당신은 "${input.title}" 글을 고치는 편집자입니다.`,
    '아래 **한 구간만** 다시 씁니다. 다른 구간은 건드리지 않습니다.',
    '',
    `# 이 구간의 소제목\n${input.section.heading}`,
    '',
    `# 지적된 문제\n${list}`,
    '',
    `# 지금 이 구간의 HTML\n${clip(input.section.html, 12000)}`,
    ...(input.contextText ? ['', `# 지적이 가리키는 다른 구간의 내용 (비교용 — 이 부분은 출력하지 마세요)\n${clip(input.contextText, 3000)}`] : []),
    '',
    '# 규칙 (어기면 그 결과는 버려집니다)',
    '· 원본에 있는 <img> 태그는 **속성까지 그대로** 유지하세요. 지우거나 주소를 바꾸지 마세요.',
    '· 원본에 있는 <a href> 링크도 그대로 유지하세요.',
    '· 본문에 글자로 적힌 주소(https://… , www.…)는 **한 글자도 바꾸지 마세요.** 마침표·물음표 뒤에 공백을 넣지 마세요 — 주소가 깨집니다.',
    '· 소제목과 답변 블록은 유지하되, 선택한 지적이 그 내용을 고치라고 요구하면 해당 내용도 수정하세요.',
    lengthRule,
    // v3.8.670 실측: 다시 쓴 구간이 합니다체로 돌아와 해요체 본문 한가운데 섬이 됐다
    `· 말투는 원본 구간과 같게 — ${require('./generation').toneEndingRule()}. 강조 문장(<strong>, <blockquote>)도 같은 말투로 씁니다.`,
    '· **모르는 수치는 지어내지 마세요.** 근거가 없으면 그 문장을 삭제하고, 대신 확실한 것을 씁니다.',
    '· 새 이미지를 넣지 마세요.',
    '',
    '# 출력',
    '고쳐 쓴 이 구간의 HTML 만 출력하세요. 설명·코드블록·마크다운 금지.',
  ].join('\n');
}

/**
 * 모델이 돌려준 구간을 받아들일지 판단한다.
 *
 * 하나라도 어긋나면 **원본을 그대로 쓴다.** 고치려다 이미지와 링크를 날리는 것이
 * 안 고치는 것보다 나쁘다.
 */
/**
 * v3.8.664 — 답변 블록(answer-first)의 질문·답 본문. 도입부 구간을 다시 쓸 때 이것이 바뀌면 원본을 지킨다.
 * 실측(햇살론15 글): 발행본에서 <p class="answer-first-q"> 가 사라지고 그 자리에 결론의 댓글 문장이 <p> 로 들어와 있었다.
 */
const ANSWER_PART_RE = /<p[^>]*class="answer-first-(?:q|a)"[^>]*>([\s\S]*?)<\/p>/gi;
export function answerBlockText(html: string): string {
  return [...String(html || '').matchAll(ANSWER_PART_RE)].map((m) => textOf(m[1] || '')).join(' | ');
}

export function acceptRevisedSection(
  raw: string,
  original: PostSection,
  /**
   * v3.8.729 —
   *   allowAnswerEdit: 답변 블록의 **글은** 바꿔도 된다(답 관련 지적을 고칠 때). 블록 자체가 사라지면 여전히 반려.
   *   allowMediaLoss: 이미지·링크가 줄어도 받는다 — 사장님이 "이 이미지 빼 줘"라고 직접 적었을 때만.
   *   preserveMarkup: 줄바꿈·표 정리를 걸지 않는다 — 외부 HTML 의 서식을 그대로 둘 때.
   */
  opts: { cutting?: boolean; allowAnswerEdit?: boolean; allowMediaLoss?: boolean; preserveMarkup?: boolean } = {},
): { html: string; accepted: boolean; reason: string } {
  /**
   * v3.8.714 — 고쳐 온 구간에도 **같은 정리**를 건다.
   *
   * 사장님: "수정하고 또 비평하면 또 지적이 나오면 수정발행하는 의미가없자나"
   *
   * 맞는 말이다. 문장 중간 줄바꿈·표 서술형은 모델이 고쳐 오면서 다시 넣기 쉬운 것들이라,
   * 생성 경로에서만 정리하면 수정발행 뒤에 또 지적이 뜬다. 여기서도 같은 손질을 한다.
   */
  const { joinMidSentenceBreaks, tidyTableCells } = require('./br-joiner');
  const stripped = String(raw || '')
    .replace(/```[a-z]*\s*/gi, '')
    .replace(/```/g, '')
    .trim();
  const cleaned = opts.preserveMarkup ? stripped : tidyTableCells(joinMidSentenceBreaks(stripped).html).html.trim();

  if (!cleaned) return { html: original.html, accepted: false, reason: '빈 응답' };
  /**
   * v3.8.731 — 본문이 아닌 답("음… 잘 모르겠습니다", 설명문)을 걸러낸다.
   * 원본 구간이 비어 있으면(도입부 없는 글) 분량 하한이 0 이라 무엇이든 통과했다 — 발행 전 자가 수정 실측.
   */
  if (!/<(?:p|h[1-6]|ul|ol|li|table|div|blockquote|figure|section|article)\b/i.test(cleaned)) {
    return { html: original.html, accepted: false, reason: '본문 HTML 이 아닙니다' };
  }
  if (cleaned.replace(/>\s+</g, '><') === original.html.trim().replace(/>\s+</g, '><')) {
    return { html: original.html, accepted: false, reason: '바뀐 것이 없습니다' };
  }

  const beforeText = textOf(original.html);
  const afterText = textOf(cleaned);
  const floor = opts.cutting ? SECTION_FLOOR.cut : SECTION_FLOOR.keep;
  if (afterText.length < beforeText.length * floor) {
    const reason = opts.cutting
      ? `너무 많이 줄었습니다 (${beforeText.length}자 → ${afterText.length}자, 바닥 60%)`
      : `분량이 줄었습니다 (${beforeText.length}자 → ${afterText.length}자)`;
    return { html: original.html, accepted: false, reason };
  }
  if (!opts.allowMediaLoss && countTag(cleaned, IMG_RE) < countTag(original.html, IMG_RE)) {
    return { html: original.html, accepted: false, reason: '이미지가 사라졌습니다' };
  }
  if (!opts.allowMediaLoss && countTag(cleaned, LINK_RE) < countTag(original.html, LINK_RE)) {
    return { html: original.html, accepted: false, reason: '링크가 사라졌습니다' };
  }
  /**
   * v3.8.664 — 답변 블록(질문·답)은 다시 쓰는 대상이 아니다.
   *
   * v3.8.729 — 단, **답을 고치라는 지적**일 때는 글을 바꿔도 된다.
   * 사장님: "지적을 하면 그 지적한 걸 말끔히 해결해야 되는데 수정을 시켰는데도 똑같은 지적이 또 나와"
   * "답 상자가 판정문이 아닙니다"·"제목이 물었는데 답이 없습니다" 는 답 블록을 고쳐야 풀리는데,
   * 이 관문이 답 블록의 글자 하나라도 바뀌면 통째로 반려해 **고쳐질 수 없는 지적**이었다.
   * 그래서 두 가지로 나눈다 — 블록이 **사라지면** 언제나 반려, 글만 바뀌는 것은 허락받았을 때만 통과.
   */
  const answerBefore = answerBlockText(original.html);
  if (answerBefore) {
    const partsBefore = (original.html.match(ANSWER_PART_RE) || []).length;
    const partsAfter = (cleaned.match(ANSWER_PART_RE) || []).length;
    if (partsAfter < partsBefore) {
      return { html: original.html, accepted: false, reason: '답변 블록이 사라졌습니다' };
    }
    if (!opts.allowAnswerEdit && answerBlockText(cleaned) !== answerBefore) {
      return { html: original.html, accepted: false, reason: '답변 블록이 바뀌었습니다' };
    }
  }
  /**
   * v3.8.665 — 숫자 앞 띄어쓰기가 뭉개지면 원본 유지.
   * 실측(v3.8.664 상장유지 글 FAQ): "200억원과300억원 또는300억원과500억원" — 663 에는 공백이 있었고, 다시 쓴 뒤 사라졌다.
   * 발행 직전 auto-repair 는 이 단계보다 앞에 돌아서 여기서 생긴 것은 못 고친다.
   */
  const gluedBefore = (beforeText.match(/[가-힣]\d/g) || []).length;
  const gluedAfter = (afterText.match(/[가-힣]\d/g) || []).length;
  if (gluedAfter - gluedBefore >= 3) {
    return { html: original.html, accepted: false, reason: `숫자 앞 띄어쓰기가 뭉개졌습니다 (${gluedBefore}→${gluedAfter}곳)` };
  }
  /**
   * v3.8.658 — 글자로 적힌 주소가 그대로 남았는가.
   * 실측 5편 중 4편: "https://www. seoul. co. kr", "kdi. re. kr/…do?\n\nnum=" — 모델이 고쳐 쓰면서
   * 마침표·물음표 뒤에 공백을 넣어 주소를 깨뜨렸다. <a href> 만 세던 검사는 이걸 못 봤다.
   */
  const urlsBefore = String(original.html || '').match(BARE_URL_RE) || [];
  if (urlsBefore.length > 0) {
    const flat = cleaned.replace(/\s+/g, '');
    const lost = urlsBefore.filter((u) => !flat.includes(u.replace(/\s+/g, '')));
    if (lost.length > 0) {
      return { html: original.html, accepted: false, reason: `주소가 바뀌었습니다 (${lost[0]!.slice(0, 40)}…)` };
    }
    if (/(?:https?:\/\/|www)\.?\s+[a-z0-9-]+\.\s+[a-z]/i.test(cleaned)) {
      return { html: original.html, accepted: false, reason: '주소 안에 공백이 들어갔습니다' };
    }
  }
  if (original.index > 0 && !/<h2\b/i.test(cleaned)) {
    return { html: original.html, accepted: false, reason: '소제목(H2)이 사라졌습니다' };
  }
  return { html: cleaned, accepted: true, reason: '' };
}

/**
 * 완성된 새 본문을 발행해도 되는가 — 마지막 관문.
 * `post-regenerate.judgeRegenerated` 가 "되살릴 값어치"를 본다면, 이쪽은 "퇴보하지 않았는가"를 본다.
 */
export function judgeImproved(
  nextHtml: string,
  previousHtml: string,
  opts: { cutting?: boolean } = {},
): { ok: boolean; reason: string; length: number } {
  const before = textOf(previousHtml);
  const after = textOf(nextHtml);
  const length = after.length;

  if (length < 200) return { ok: false, reason: `새 본문이 ${length}자뿐입니다`, length };
  const floor = opts.cutting ? POST_FLOOR.cut : POST_FLOOR.keep;
  if (length < before.length * floor) {
    const pct = Math.round((1 - floor) * 100);
    return { ok: false, reason: `새 본문(${length}자)이 기존(${before.length}자)보다 ${pct}% 넘게 짧습니다`, length };
  }
  if (countTag(nextHtml, IMG_RE) < countTag(previousHtml, IMG_RE)) {
    return { ok: false, reason: '이미지가 줄었습니다', length };
  }
  if (countTag(nextHtml, LINK_RE) < countTag(previousHtml, LINK_RE)) {
    return { ok: false, reason: '링크가 줄었습니다', length };
  }
  if (nextHtml === previousHtml) {
    return { ok: false, reason: '바뀐 것이 없습니다', length };
  }
  return { ok: true, reason: '', length };
}

/** 고른 항목을 구간별로 묶는다. sectionIndex -1 은 모든 구간에 함께 붙는다 */
export function groupIssuesBySection(issues: CritiqueIssue[]): {
  bySection: Map<number, CritiqueIssue[]>;
  wholePost: CritiqueIssue[];
} {
  const bySection = new Map<number, CritiqueIssue[]>();
  const wholePost: CritiqueIssue[] = [];
  for (const issue of issues) {
    if (!Number.isInteger(issue.sectionIndex) || issue.sectionIndex < 0) { wholePost.push(issue); continue; }
    const list = bySection.get(issue.sectionIndex) || [];
    list.push(issue);
    bySection.set(issue.sectionIndex, list);
  }
  return { bySection, wholePost };
}

// ─────────────────────────────────────────────────────────────
// v3.8.729 — 같은 지적이 또 나오는 것을 막는 부품 셋
//
// 사장님: "지적을 하면 그 지적한 걸 말끔히 해결해야 되는데 수정을 시켰는데도 똑같은 지적이
//          또 나와. 수정하는데도 API 비용이 들기 때문에 이러면 절대 안 되는데"
//
// 되풀이의 원인은 셋이었고 하나씩 부품을 둔다:
//   ① 고친 뒤 "남았는지" 재는 기준이 **제목 문자열**이라 `"환급"가 12번 → 9번` 처럼 숫자만 바뀌면
//      고쳐졌다고 잘못 판정했다 → issueKey (숫자·순번을 뺀 안정된 이름표)
//   ② 구간을 다시 써서는 **절대 풀 수 없는** 지적(이미지 0장 — 규칙이 "새 이미지 넣지 마세요")에도
//      모델을 불렀고, 당연히 다음 비평에 또 나왔다 → rewriteAbility (수정 대상에서 빼고 이유를 보여준다)
//   ③ AI 비평은 "이미 고쳤으니 말하지 마세요"를 줘도 **말만 바꿔** 다시 지적한다
//      → dropResolvedLookalikes (고친 지적과 낱말이 절반 넘게 겹치면 코드가 걸러낸다, 호출 0회)
// ─────────────────────────────────────────────────────────────

/**
 * 회차가 바뀌어도 같은 지적이면 같은 값이 나오는 이름표.
 *
 * audit 지적의 id 는 `audit-<kind>-<순번>` 이라 앞 지적 하나가 사라지면 순번이 밀리고,
 * 제목에는 `12번`·`해요체 3건` 같은 개수가 들어 있어 고치다 만 것도 "다른 지적"이 된다.
 * 순번과 숫자를 빼면 둘 다 안정된다. 같은 종류가 여러 절에서 나면 인용된 근거의 앞부분으로 가른다.
 */
export function issueKey(issue: Pick<CritiqueIssue, 'id' | 'title' | 'evidence'>): string {
  const id = String(issue?.id || '').replace(/^(audit-[a-z-]+?)-\d+$/, '$1');
  const title = String(issue?.title || '').replace(/[\d,.]+/g, '#').replace(/\s+/g, ' ').trim();
  if (id.startsWith('audit-')) {
    // 근거 문장은 고쳐 쓰면 바뀌므로 짧게만 — 어느 절인지 가를 정도면 된다
    const evidence = String(issue?.evidence || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 24);
    return `${id}|${title}|${evidence}`;
  }
  return `${id}|${title}`;
}

export interface RewriteAbility {
  /** 구간 다시 쓰기로 고칠 수 있는가 */
  fixable: boolean;
  /** 못 고치면 **무엇으로** 고치는지 — 화면이 그대로 보여준다 */
  hint: string;
  /** v3.8.750 — 못 고치는 까닭이 "새 근거가 있어야 함"이면 NEEDS_NEW_EVIDENCE (버튼 수정 모드에서만 붙는다) */
  reason?: 'NEEDS_NEW_EVIDENCE';
}

/**
 * v3.8.750 — **새 근거가 있어야 풀리는** 지적. 문장만 고쳐서는 지어내게 된다.
 *
 * 감사(2026-09-23): 5543 글은 사실 밀도·출처·근거 조항 지적을 매번 「반드시」로 받아 고쳤고,
 * 편집기는 근거 없이 채우다 "이 구간의 자료만으로 확인할 수 없습니다" 같은 문장을 새로 만들었다.
 * 이 지적들은 편집기로 보내지 않고 "근거를 추가해 다시 생성해야 하는 항목"으로 안내한다.
 */
const NEEDS_EVIDENCE_ID = /^(?:substance-facts|quality-(?:sources|sourceSuspicion|length)|competitor-gap|audit-no-legal-basis(?:-\d+)?|audit-thin-section(?:-\d+)?)$/;
const NEEDS_EVIDENCE_WORDS = /(?:근거|출처|자료|사례|통계|수치|데이터|조항|판례)[^.\n]{0,14}(?:추가|보강|보충|제시|채워|찾아)|경쟁\s*글|상위\s*글/;
export const NEEDS_NEW_EVIDENCE_HINT = '근거를 추가해 다시 생성해야 하는 항목입니다 — 문장만 고쳐서는 풀리지 않고 지어내게 됩니다. [글 다시 생성]으로 근거를 모아 다시 쓰세요.';

export function needsNewEvidence(issue: Pick<CritiqueIssue, 'id' | 'title' | 'fix'> & Partial<Pick<CritiqueIssue, 'origin' | 'blocking' | 'aiType'>>): boolean {
  if (NEEDS_EVIDENCE_ID.test(String(issue?.id || ''))) return true;
  if (issue?.origin !== 'ai') return false;
  if (String(issue?.aiType || '').toLowerCase() === 'needs-evidence') return true;
  if (issue?.blocking === true) return false;
  return NEEDS_EVIDENCE_WORDS.test(`${issue?.title || ''} ${issue?.fix || ''}`);
}

/**
 * 이 지적을 "수정" 버튼(구간 다시 쓰기)으로 고칠 수 있는가.
 *
 * 다시 쓰기 규칙이 "새 이미지를 넣지 마세요 · 링크를 지키세요" 인데 지적은 "이미지가 0장"·"링크가 0개" 다.
 * 이런 것은 아무리 시켜도 안 풀리고 API 비용만 나간다. 도구가 따로 있으니 그쪽을 가리킨다.
 */
export function rewriteAbility(
  issue: Pick<CritiqueIssue, 'id' | 'title'> & Partial<Pick<CritiqueIssue, 'fix' | 'origin' | 'blocking' | 'aiType'>>,
  /**
   * v3.8.750 — targeted: 「비평 개선」 버튼의 수정(지적된 문단만 고침). 기본값(false)은 예전 판정 그대로다 —
   * 발행 전 자가 수정·자동 품질 루프는 이 옵션을 넘기지 않는다.
   */
  opts: { targeted?: boolean } = {},
): RewriteAbility {
  const id = String(issue?.id || '');
  if (id === 'structure-noimage') return { fixable: false, hint: '글을 다시 써서는 그림이 생기지 않습니다 — [🖼️ 이미지] 또는 [🖼️ 썸네일 넣기] 버튼으로 넣으세요.' };
  if (id === 'cta-none') return { fixable: false, hint: '링크는 지어 넣지 않습니다 — [🔗 CTA 다시 생성] 버튼으로 목적지를 찾아 넣으세요.' };
  if (id === 'quality-internalLinks') return { fixable: false, hint: '내부 링크는 발행할 때 자동으로 붙습니다 — 본문 수정으로는 채워지지 않습니다.' };
  if (id === 'quality-imageAlt') return { fixable: false, hint: '이미지 설명(alt)은 본문이 아니라 이미지 속성입니다 — 발행 시 소제목으로 자동 채워집니다.' };
  if (/^audit-broken-title/.test(id)) return { fixable: false, hint: '제목의 문제입니다 — 위 제목 칸에서 직접 고치세요.' };
  if (opts.targeted) {
    if (needsNewEvidence({ fix: '', ...issue })) return { fixable: false, hint: NEEDS_NEW_EVIDENCE_HINT, reason: 'NEEDS_NEW_EVIDENCE' };
    if (/^audit-title-promise-unkept/.test(id)) {
      return { fixable: false, hint: '제목이 약속한 조각을 맡은 소제목이 없습니다 — 문단을 고쳐서는 절이 생기지 않습니다. 제목 칸에서 그 약속을 빼거나, 근거를 모아 글을 다시 생성하세요.' };
    }
  }
  return { fixable: true, hint: '' };
}

/** 지적 목록에 fixable·fixHint 를 붙인다 — 화면은 이 값으로 체크박스를 잠근다 */
export function annotateFixability<T extends Pick<CritiqueIssue, 'id' | 'title'>>(
  issues: T[],
  opts: { targeted?: boolean } = {},
): (T & { fixable: boolean; fixHint: string })[] {
  return (issues || []).map((issue) => {
    const ability = rewriteAbility(issue, opts);
    return { ...issue, fixable: ability.fixable, fixHint: ability.hint };
  });
}

/**
 * 두 글자 조각(바이그램) 집합 — 낱말 경계가 없는 한국어에서 겹침을 재는 가장 싼 방법.
 * "~습니다"·"~없습니다" 같은 어미는 모든 지적에 붙어 있어 겹침을 부풀린다 — 먼저 뗀다.
 */
function bigrams(text: string): Set<string> {
  const s = String(text || '')
    .replace(/(습니다|입니다|합니다|됩니다|없습니다|있습니다|니다|이다|하다)(?=[\s.,]|$)/g, '')
    .replace(/[\s\d"'“”‘’()\[\]·.,:;!?~\-]/g, '');
  const out = new Set<string>();
  for (let i = 0; i + 1 < s.length; i += 1) out.add(s.slice(i, i + 2));
  return out;
}

/** 0~1 (Dice) — 1 이면 같은 말 */
export function issueSimilarity(a: string, b: string): number {
  const x = bigrams(a);
  const y = bigrams(b);
  if (x.size === 0 || y.size === 0) return 0;
  let both = 0;
  for (const g of x) if (y.has(g)) both += 1;
  return (2 * both) / (x.size + y.size);
}

/**
 * 이미 고친 지적과 **말만 다른** AI 지적을 걸러낸다. 호출 0회.
 *
 * 프롬프트의 "다시 말하지 마세요"는 지켜질 때도, 안 지켜질 때도 있다 — 모델은 같은 문제를
 * "결론이 약합니다" → "마무리에 판정이 없습니다" 로 바꿔 말한다. 제목(과 제목+처방)을 재서
 * 낱말 조각이 55% 넘게 겹치면 같은 지적으로 본다. 걸러낸 것은 로그로 남긴다.
 */
export function dropResolvedLookalikes<T extends Pick<CritiqueIssue, 'title' | 'fix' | 'origin'>>(
  issues: T[],
  resolved: string[],
  threshold = 0.55,
): { kept: T[]; dropped: T[] } {
  const done = (resolved || []).map((t) => String(t || '').trim()).filter(Boolean);
  if (done.length === 0) return { kept: [...(issues || [])], dropped: [] };
  const kept: T[] = [];
  const dropped: T[] = [];
  for (const issue of issues || []) {
    if (issue.origin !== 'ai') { kept.push(issue); continue; }
    const mine = `${issue.title || ''} ${issue.fix || ''}`;
    const twin = done.some((t) => issueSimilarity(issue.title || '', t) >= threshold || issueSimilarity(mine, t) >= threshold);
    (twin ? dropped : kept).push(issue);
  }
  return { kept, dropped };
}
