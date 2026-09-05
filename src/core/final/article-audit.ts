/**
 * 📐 글 품질 하네스 — 발행된 글이든 방금 만든 글이든 같은 자를 댄다 (v3.8.628)
 *
 * ## 왜 만들었나
 * 사장님이 발행글 하나를 짚어 "글이 개판이면 이탈률이 어마어마해서 안 된다" 고 했다.
 * 실제로 재 보니(2026-09-04, 성과급 파업 지침 글) 눈에 보이는 결함이 여섯이었다:
 *
 *   ① 마침표 뒤에 공백 없이 다음 문장이 붙음        6건
 *   ② 같은 말 반복 — 96문장 안에 '기업이익' 31회,
 *      '근로조건' 26회. 섹션 1~5 가 한 원칙을 돌려 말함
 *   ③ 소제목이 약속한 것을 안 지킴 —
 *      "판례에서 보는 판단기준" 인데 판례 0건,
 *      "파업 제한 직종" 인데 직종명 0건
 *   ④ 법 조문 0건 — '고용노동부 지침' 을 18번 말하며 근거 조항이 없음
 *   ⑤ 말투 섞임 — 해요체 41 / 합니다체 43 이 한 문단 안에서 오감
 *   ⑥ 목차 손상 — "9·3 노동부 지침" 이 "3 노동부 지침" 으로 잘림
 *
 * 기존 diagnosePost 는 이 여섯 중 어느 것도 못 본다. 그래서 비평이 "두루뭉실하다".
 *
 * ## 설계는 빌려 왔다
 * 리더 네이버 자동화(사장님 다른 제품)가 20편을 돌려가며 다듬은 구조를 따른다:
 *   · 검사기는 **지우지 않는다.** 어디가 문제인지 알려주기만 한다.
 *   · 정상 글이 걸리지 않게 임계값을 넉넉히 잡는다(반복 0.7 등).
 *   · 점수는 감점식 — 무엇 때문에 깎였는지 되짚을 수 있어야 한다.
 *
 * ## 이 파일의 원칙
 * AI 를 부르지 않는다. 전부 코드로 잰다 — 비용 0, 매번 같은 답.
 */

import { auditClaimSafety } from './claim-safety';

export type AuditKind =
  | 'glued-sentence'      // ① 마침표 뒤 공백 없음
  | 'cross-section-echo'  // ② 섹션끼리 같은 말
  | 'term-flood'          // ② 한 낱말이 과하게 반복
  | 'unfulfilled-heading' // ③ 소제목이 약속을 안 지킴
  | 'no-legal-basis'      // ④ 근거 조항 없음
  | 'writing-process-leak' // ④-2 글 쓰는 과정이 독자에게 새어 나감 (v3.8.641)
  | 'tone-mix'            // ⑤ 말투 섞임
  | 'broken-title'        // ⑥ 제목·목차 손상
  // ── v3.8.629 주장·사실 구분 (claim-safety.ts) — 사장님 지시 10개 항목 ──
  | 'asserted-crime'      // 판결 전인데 확정형으로 씀
  | 'legal-overreach'     // 거론한 혐의를 적용된 것처럼
  | 'unsourced-reading'   // 출처 없는 해석
  | 'money-confusion'     // 성격이 다른 금액을 뒤섞음
  | 'settlement-stretch'  // 사과 요구를 합의로 확대
  | 'unverified-first'    // 확인 안 된 '최초' 표현
  | 'personal-voice'      // 작성자 개인 의견
  | 'hedge-repeat'        // 같은 단서를 문단마다
  | 'bloated-conclusion'; // 결론이 본문 재탕

export interface AuditIssue {
  kind: AuditKind;
  /** 사람이 읽을 한 줄 */
  title: string;
  /** 문제가 보이는 실제 대목 — 지어내지 않는다 */
  evidence: string;
  /** 감점 */
  penalty: number;
}

export interface AuditReport {
  score: number;
  issues: AuditIssue[];
  stats: {
    chars: number;
    sentences: number;
    sections: number;
    legalRefs: number;
    politeEndings: number;
    formalEndings: number;
  };
}

/**
 * 태그를 걷어 평문으로. 문단 경계는 줄바꿈으로 남긴다.
 *
 * ⚠️ 블록 태그를 하나라도 빠뜨리면 **없는 결함이 보인다** (v3.8.640).
 *
 * 실측 2026-09-05: 발행글 비평이 "마침표 뒤에 공백 없이 다음 문장이 붙었다" 를
 * 4건 지적했다. 원문을 열어 보니 `...보세요.</blockquote><p>이미...` 였다 —
 * 목록에 blockquote 가 없어서 두 문단이 한 줄로 이어졌고, 그걸 붙은 문장으로 읽었다.
 * 브라우저가 그린 글자(innerText)로 재니 **0건**이었다. 독자는 본 적이 없는 결함이다.
 *
 * 사장님이 이 지적을 믿고 "수정발행" 을 눌렀다면 멀쩡한 문단을 AI 가 다시 썼을 것이다.
 * 그래서 여는 태그·닫는 태그 양쪽 모두를 경계로 본다.
 */
const BLOCK_TAGS =
  'p|li|ul|ol|dl|dt|dd|h[1-6]|td|th|tr|thead|tbody|tfoot|table|div|section|article|aside|'
  + 'blockquote|figure|figcaption|header|footer|main|nav|pre|details|summary|form|fieldset';

export function toPlainText(html: string): string {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(new RegExp(`</(?:${BLOCK_TAGS})>`, 'gi'), '\n')
    .replace(new RegExp(`<(?:${BLOCK_TAGS})(?:\\s[^>]*)?>`, 'gi'), '\n')
    .replace(/<hr\s*\/?>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?。])\s+|\n+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/* ────────────────────────────────────────────────────────────────
 * ① 마침표 뒤에 공백 없이 붙은 문장
 *
 * 목록 항목이 문단에 병합될 때 생긴다. 읽는 사람은 한 문장인 줄 알고 읽다가
 * 걸린다. 소수점(3.5)·날짜(2026.09.04)·영문 약어는 걸리면 안 된다.
 * ──────────────────────────────────────────────────────────────── */
const GLUED = /(?<![\d])[.!?](?=[가-힣])/g;

export function findGluedSentences(text: string): AuditIssue[] {
  const out: AuditIssue[] = [];
  for (const m of text.matchAll(GLUED)) {
    const at = m.index ?? 0;
    out.push({
      kind: 'glued-sentence',
      title: '마침표 뒤에 공백 없이 다음 문장이 붙었습니다',
      evidence: text.slice(Math.max(0, at - 24), at + 26).replace(/\n/g, ' '),
      penalty: 3,
    });
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────
 * ② 섹션끼리 같은 말 — 이탈의 주범
 *
 * 리더 네이버 자동화의 crossSectionRepetition 을 따른다. 지우지 않고 알려만 준다.
 * 결론이 앞을 다시 짚는 것은 정상이므로 임계값을 높게(0.7) 잡는다.
 * ──────────────────────────────────────────────────────────────── */
const MIN_SENTENCE_CHARS = 18;
/** 자카드 기준. min 기준의 0.7 과 같은 엄격함이 되도록 실측으로 맞춘다. */
const SAME_MEANING_RATIO = 0.55;
const MAX_ECHO_REPORTED = 5;

/**
 * 짧은 쪽 기준(min)으로 재면 짧은 문장이 아무 데나 걸린다.
 * 실측 오탐: "근거: 고용노동부 2026년 9월 3일"(5낱말)이 날짜를 언급한 모든 문장과
 * 겹쳤다. 겹친 낱말이 다섯 중 넷이면 min 기준으로 0.8 이 나오기 때문이다.
 * 그래서 합집합 기준(자카드)으로 재고, 양쪽 모두 일정 낱말 수를 넘을 때만 본다.
 */
const MIN_WORDS = 6;

function wordSet(sentence: string): Set<string> {
  return new Set(sentence.replace(/[^가-힣a-zA-Z0-9%\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1));
}

function similarity(a: string, b: string): number {
  const A = wordSet(a);
  const B = wordSet(b);
  if (A.size < MIN_WORDS || B.size < MIN_WORDS) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  const union = A.size + B.size - shared;
  return union === 0 ? 0 : shared / union;
}

export interface AuditSection {
  heading: string;
  text: string;
}

/** <h2>/<h3> 를 경계로 잘라 섹션을 만든다. */
export function splitAuditSections(html: string): AuditSection[] {
  const parts = String(html || '').split(/(?=<h[23]\b)/i);
  const out: AuditSection[] = [];
  for (const part of parts) {
    const headMatch = part.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i);
    const heading = headMatch ? toPlainText(headMatch[1] || '') : '';
    const text = toPlainText(part.replace(/<h[23][^>]*>[\s\S]*?<\/h[23]>/i, ''));
    if (text.length > 0) out.push({ heading, text });
  }
  return out;
}

export function findCrossSectionEchoes(sections: AuditSection[]): AuditIssue[] {
  const out: AuditIssue[] = [];
  for (let i = 0; i < sections.length && out.length < MAX_ECHO_REPORTED; i++) {
    for (let j = i + 1; j < sections.length && out.length < MAX_ECHO_REPORTED; j++) {
      const earlier = sentencesOf(sections[i]!.text).filter((s) => s.length >= MIN_SENTENCE_CHARS);
      const later = sentencesOf(sections[j]!.text).filter((s) => s.length >= MIN_SENTENCE_CHARS);
      for (const a of earlier) {
        const hit = later.find((b) => similarity(a, b) >= SAME_MEANING_RATIO);
        if (hit) {
          out.push({
            kind: 'cross-section-echo',
            title: `"${sections[i]!.heading || `${i + 1}번째 구간`}" 과 "${sections[j]!.heading || `${j + 1}번째 구간`}" 이 같은 말을 합니다`,
            evidence: `앞: ${a.slice(0, 60)}\n뒤: ${hit.slice(0, 60)}`,
            penalty: 8,
          });
          break;
        }
      }
    }
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────
 * ② 한 낱말이 과하게 반복 — 읽는 사람이 "아까 읽었는데" 라고 느끼는 지점
 *
 * 주제어는 당연히 자주 나온다. 문장 수 대비로 본다.
 * 실측: 96문장 글에서 '기업이익' 31회 = 0.32 — 세 문장에 한 번씩 같은 낱말.
 * ──────────────────────────────────────────────────────────────── */
/**
 * 1,000자당 몇 번 나오는지로 본다. 문장 쪼개는 방식이 바뀌어도 안 흔들린다.
 * 실측: 성과급 글 10,321자에 '기업이익' 31회 = 1,000자당 3.0회.
 */
const FLOOD_PER_1000 = 2.4;
const FLOOD_MIN_HITS = 12;

export function findTermFloods(text: string, sentenceCount: number): AuditIssue[] {
  if (text.length < 1500) return [];
  const counts = new Map<string, number>();
  for (const w of text.replace(/[^가-힣\s]/g, ' ').split(/\s+/)) {
    if (w.length < 3) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  const out: AuditIssue[] = [];
  for (const [word, n] of [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
    const per1000 = (n / text.length) * 1000;
    if (n >= FLOOD_MIN_HITS && per1000 >= FLOOD_PER_1000) {
      out.push({
        kind: 'term-flood',
        title: `"${word}" 가 ${n}번 나옵니다 (1,000자당 ${per1000.toFixed(1)}회)`,
        evidence: `본문 ${text.length}자에 같은 낱말이 ${n}번입니다. 읽는 사람은 앞에서 읽은 내용으로 느낍니다.`,
        penalty: 6,
      });
    }
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────
 * ④ 근거 조항 — 제도를 말하면서 조문·문서번호가 하나도 없으면 인용도 신뢰도 못 얻는다
 * ──────────────────────────────────────────────────────────────── */
const LEGAL_REF = /제\s?\d+\s?조(?:의\s?\d+)?|법률\s?제\s?\d+\s?호|[가-힣]{2,10}령\s?제\s?\d+\s?조|고시\s?제?\s?\d{4}-\d+|\d{4}[가-힣]{1,3}\d{3,}/g;
const INSTITUTIONAL = /(?:법|지침|고시|시행령|시행규칙|판례|대법원|헌법재판소)/;

export function findMissingLegalBasis(text: string): AuditIssue[] {
  const refs = text.match(LEGAL_REF) || [];
  if (refs.length > 0) return [];
  if (!INSTITUTIONAL.test(text)) return []; // 제도 글이 아니면 요구하지 않는다
  return [{
    kind: 'no-legal-basis',
    title: '제도를 설명하면서 근거 조항이 한 건도 없습니다',
    evidence: '법·지침·판례를 말하는데 "제○조", 고시 번호, 판례 번호가 없습니다. 읽는 사람이 확인할 방법이 없고 AI 인용에도 안 걸립니다.',
    penalty: 10,
  }];
}

/* ────────────────────────────────────────────────────────────────
 * ④-2 작성 과정이 새어 나왔다 (v3.8.641)
 *
 * 발행글에 이게 그대로 나갔다(2026-09-05 실측):
 *   "제공된 근거에는 각 상품의 전산심사 기준과 부결 사유가 제시돼 있지 않으므로…"
 *
 * 평가: "독자에게 설명하는 글에서 갑자기 AI 가 자료의 한계를 보고하는 느낌"
 *
 * 읽는 사람에게는 아무 쓸모가 없는 문장이고, AI 가 쓴 티가 가장 크게 나는 자리다.
 * 자료가 없으면 **그 항목을 빼야지**, 없다고 알리면 안 된다.
 *
 * 오탐이 나기 어려운 표현만 넣는다 — 사람이 쓴 글에는 이런 말이 안 나온다.
 * ──────────────────────────────────────────────────────────────── */
const PROCESS_LEAK = [
  /(?:제공된|주어진)\s*(?:참고\s*)?(?:근거|자료|데이터|정보|출처)/,
  /(?:근거|자료)\s*장부에는?/,
  /본문\s*근거만으로는/,
  /검색\s*결과에는?\s*[^.。<]{0,60}없/,
  /확인할\s*(?:수\s*있는\s*)?근거가\s*(?:없|부족)/,
];

export function findProcessLeak(text: string): AuditIssue[] {
  const issues: AuditIssue[] = [];
  for (const re of PROCESS_LEAK) {
    const m = re.exec(text);
    if (!m) continue;
    const at = m.index;
    issues.push({
      kind: 'writing-process-leak',
      title: '글 쓰는 과정이 독자에게 새어 나왔습니다',
      evidence: `"${text.slice(at, at + 60).trim()}…" — 자료가 부족하면 그 항목을 빼야지, 부족하다고 독자에게 알리면 안 됩니다. 소제목을 만들어 놓고 "확인할 근거가 없다"고 적으면 내용이 비어 보입니다.`,
      penalty: 12,
    });
  }
  return issues;
}

/* ────────────────────────────────────────────────────────────────
 * ⑤ 말투 섞임 — 해요체와 합니다체가 한 글 안에서 오간다
 *
 * 둘 중 하나로 정해야 한다. 어느 쪽이 옳다는 게 아니라 섞이면 번역투로 읽힌다.
 * 한쪽이 압도적이면(9:1) 굳어진 문체로 보고 넘어간다.
 * ──────────────────────────────────────────────────────────────── */
const TONE_MIX_MIN = 0.25;

export function findToneMix(text: string): { issues: AuditIssue[]; polite: number; formal: number } {
  const polite = (text.match(/[요예]\.\s|[요예]\.$/gm) || []).length;
  const formal = (text.match(/(?:니다|습니다)\.\s|(?:니다|습니다)\.$/gm) || []).length;
  const total = polite + formal;
  if (total < 20) return { issues: [], polite, formal };
  const minorityShare = Math.min(polite, formal) / total;
  if (minorityShare < TONE_MIX_MIN) return { issues: [], polite, formal };
  return {
    issues: [{
      kind: 'tone-mix',
      title: `말투가 섞였습니다 — 해요체 ${polite}건 / 합니다체 ${formal}건`,
      evidence: '한 글 안에서 두 말투가 오가면 사람이 쓴 글로 안 읽힙니다. 하나로 통일해야 합니다.',
      penalty: 5,
    }],
    polite,
    formal,
  };
}

/* ────────────────────────────────────────────────────────────────
 * ⑥ 제목·목차 손상 — 앞이 잘려 나간 항목
 *
 * 실측: "9·3 노동부 지침" 이 목차에서 "3 노동부 지침" 이 됐다.
 * 숫자·가운뎃점으로 시작하는 조각은 앞이 떨어져 나간 흔적이다.
 * ──────────────────────────────────────────────────────────────── */
export function findBrokenTitles(headings: string[]): AuditIssue[] {
  const out: AuditIssue[] = [];
  for (const raw of headings) {
    const h = raw.replace(/^\s*\d+[.)]\s*/, '').trim();   // "1. " 같은 정상 번호는 벗긴다
    if (/^[·・~\-–—]/.test(h) || /^\d+\s+[가-힣]/.test(h)) {
      out.push({
        kind: 'broken-title',
        title: `소제목 앞이 잘린 것으로 보입니다: "${raw.slice(0, 40)}"`,
        evidence: '숫자나 가운뎃점으로 시작합니다. 원래 제목의 앞부분이 떨어져 나갔을 때 나타나는 모양입니다.',
        penalty: 4,
      });
    }
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────── */

/** 100점에서 깎는다 — 무엇 때문에 깎였는지 되짚을 수 있어야 한다. */
export function auditArticle(html: string, headings: string[] = []): AuditReport {
  const text = toPlainText(html);
  const sections = splitAuditSections(html);
  const sentences = sentencesOf(text);
  const heads = headings.length
    ? headings
    : [...String(html || '').matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)].map((m) => toPlainText(m[1] || ''));

  const tone = findToneMix(text);
  const paragraphs = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const issues: AuditIssue[] = [
    ...findGluedSentences(text),
    ...findCrossSectionEchoes(sections),
    ...findTermFloods(text, sentences.length),
    ...findMissingLegalBasis(text),
    ...findProcessLeak(text),
    ...tone.issues,
    ...findBrokenTitles(heads),
    // v3.8.629 — 사건·분쟁 글의 법적 위험. 확정형 한 문장이 명예훼손이 된다.
    ...auditClaimSafety(text, paragraphs),
  ];

  const score = Math.max(0, 100 - issues.reduce((sum, i) => sum + i.penalty, 0));
  return {
    score,
    issues,
    stats: {
      chars: text.length,
      sentences: sentences.length,
      sections: sections.length,
      legalRefs: (text.match(LEGAL_REF) || []).length,
      politeEndings: tone.polite,
      formalEndings: tone.formal,
    },
  };
}

/** 사람이 읽을 한 줄 요약 */
export function summarizeAudit(report: AuditReport): string {
  if (report.issues.length === 0) return `${report.score}점 — 검사기가 잡은 것이 없습니다`;
  const byKind = new Map<AuditKind, number>();
  for (const i of report.issues) byKind.set(i.kind, (byKind.get(i.kind) || 0) + 1);
  const 이름: Record<AuditKind, string> = {
    'glued-sentence': '붙은 문장',
    'cross-section-echo': '구간 반복',
    'term-flood': '낱말 도배',
    'unfulfilled-heading': '빈 소제목',
    'no-legal-basis': '근거 없음',
    'writing-process-leak': '작성 과정 노출',
    'tone-mix': '말투 섞임',
    'broken-title': '제목 손상',
    'asserted-crime': '확정형 범죄표현',
    'legal-overreach': '혐의 확대',
    'unsourced-reading': '출처 없는 해석',
    'money-confusion': '금액 혼동',
    'settlement-stretch': '합의 확대',
    'unverified-first': '미확인 최초표현',
    'personal-voice': '개인 의견',
    'hedge-repeat': '단서 되풀이',
    'bloated-conclusion': '결론 재탕',
  };
  const parts = [...byKind.entries()].map(([k, n]) => `${이름[k]} ${n}`);
  return `${report.score}점 — ${parts.join(' · ')}`;
}
