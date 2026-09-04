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

export type CritiqueArea = 'substance' | 'answer' | 'quality' | 'cta' | 'competitor' | 'structure';
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

/** 이 문장이 몇 번째 구간에 있는가 — 못 찾으면 -1(글 전체) */
export function locateSection(sections: PostSection[], needle: string): number {
  const probe = String(needle || '').trim().slice(0, 40);
  if (!probe) return -1;
  const hit = sections.find((s) => textOf(s.html).includes(probe));
  return hit ? hit.index : -1;
}

// ─────────────────────────────────────────────────────────────
// 코드 진단 — AI 를 부르기 전에 여기서 먼저 찾는다
// ─────────────────────────────────────────────────────────────

const countTag = (html: string, re: RegExp): number => (String(html || '').match(re) || []).length;
const IMG_RE = /<img\b[^>]*>/gi;
const LINK_RE = /<a\b[^>]*href\s*=/gi;

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
      sectionIndex: locateSection(sections, found.evidence.split('\n')[0] || ''),
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
  const high = issues.filter((i) => i.severity === 'high').length;
  return `총 ${issues.length}건 (반드시 고칠 것 ${high}건) · 점수 ${scoreIssues(issues)}점`;
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
    '',
    '# 출력 형식 — JSON 배열만. 설명·코드블록 금지.',
    '[{"severity":"high|medium|low","title":"한 줄 문제","detail":"왜 문제인지","evidence":"본문에서 그대로 인용한 문장","fix":"어떻게 고칠지","sectionIndex":0}]',
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
const CUTTING_WORDS = /되풀이|반복|중복|군더더기|장황|늘어지|얼버무|상투|회피/;

export function isCuttingIssue(issue: Pick<CritiqueIssue, 'id' | 'title' | 'fix'>): boolean {
  if (CUTTING_IDS.has(String(issue?.id || ''))) return true;
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
    '',
    '# 규칙 (어기면 그 결과는 버려집니다)',
    '· 원본에 있는 <img> 태그는 **속성까지 그대로** 유지하세요. 지우거나 주소를 바꾸지 마세요.',
    '· 원본에 있는 <a href> 링크도 그대로 유지하세요.',
    `· 첫 줄의 <h2> 소제목은 그대로 두세요. 검색 색인이 걸려 있습니다.`,
    lengthRule,
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
export function acceptRevisedSection(
  raw: string,
  original: PostSection,
  opts: { cutting?: boolean } = {},
): { html: string; accepted: boolean; reason: string } {
  const cleaned = String(raw || '')
    .replace(/```[a-z]*\s*/gi, '')
    .replace(/```/g, '')
    .trim();

  if (!cleaned) return { html: original.html, accepted: false, reason: '빈 응답' };

  const beforeText = textOf(original.html);
  const afterText = textOf(cleaned);
  const floor = opts.cutting ? SECTION_FLOOR.cut : SECTION_FLOOR.keep;
  if (afterText.length < beforeText.length * floor) {
    const reason = opts.cutting
      ? `너무 많이 줄었습니다 (${beforeText.length}자 → ${afterText.length}자, 바닥 60%)`
      : `분량이 줄었습니다 (${beforeText.length}자 → ${afterText.length}자)`;
    return { html: original.html, accepted: false, reason };
  }
  if (countTag(cleaned, IMG_RE) < countTag(original.html, IMG_RE)) {
    return { html: original.html, accepted: false, reason: '이미지가 사라졌습니다' };
  }
  if (countTag(cleaned, LINK_RE) < countTag(original.html, LINK_RE)) {
    return { html: original.html, accepted: false, reason: '링크가 사라졌습니다' };
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
    if (issue.sectionIndex < 0) { wholePost.push(issue); continue; }
    const list = bySection.get(issue.sectionIndex) || [];
    list.push(issue);
    bySection.set(issue.sectionIndex, list);
  }
  return { bySection, wholePost };
}
