/**
 * 🧵 실(thread) — 도입에서 던진 문제를 끝까지 붙잡는 구성. (v3.8.672, 설계 docs/thread-design-671.md P2·P3)
 *
 * ## 왜
 * 사장님: "제목과 본문의 연결이 좋아지고 독자가 궁금해할 정보를 가져와서 풀고 필자의 반응까지 이어지게끔,
 *          도입에서 던진 문제를 끝까지 붙잡는 구성과 분명한 관점."
 * 실측(v3.8.670 라이브 1편): 서론이 "확인하는 것이 출발점이에요" 로 끝나 질문이 없고, 절 5/5 가 점검 목록으로 닫히고,
 * 결론이 서론의 상황에 답하지 않았다. 그때까지 "실" 은 프롬프트 한 줄("서론은 … 질문 하나로 끝내고")이었고,
 * 질문이 무엇인지는 코드가 정하지 않았다. 답변 상자의 질문은 본문이 다 써진 **뒤에** 뽑혔다.
 *
 * ## 무엇
 * 코드가 **글 쓰기 전에** 실을 만든다 (AI 호출 0):
 *   question — 독자의 문제 한 줄. 1순위 리포트 클릭 이유(파서 v3.8.671), 2순위 리포트 실물 QnA, 3순위 앱이 긁은 지식iN,
 *              4순위 제목 약속 조각, 5순위 키워드
 *   asks     — 절마다 답할 의문. 보러 올 이유 → 클릭 이유 → 롱테일 순으로 모아 절에 하나씩 배정
 * 그 실을 본문 프롬프트 블록으로 싣고, JSON 에 answersTo·takeaway 칸을 요구해 **코드가 문자열로 검사**할 수 있게 한다.
 *
 * ## 원칙
 * 이 모듈은 예외를 던지지 않는다. 재료가 없으면 제목·키워드로 약한 실을 만든다 — 그래도 지금(한 줄)보다는 낫다.
 */
import { titlePromises } from './reader-retention';

export type ThreadSource = 'report-click' | 'report-kin' | 'kin' | 'title' | 'keyword';

export interface Thread {
  /** 독자의 문제 한 줄 (질문 형태가 아니어도 된다 — 서론이 질문으로 만든다) */
  question: string;
  source: ThreadSource;
  /** 절마다 답할 의문. h2 개수만큼, 없는 자리는 빈 문자열 */
  asks: string[];
  /** 배정에 쓰인 재료 수 (로그용) */
  materials: number;
}

export interface ThreadInput {
  title: string;
  keyword: string;
  /** CpcSlot (clickReasons·readerReasons·realQuestions·longtails) */
  slot?: any;
  /** 앱이 긁은 지식iN 질문 */
  userQuestions?: unknown;
  h2Titles?: string[];
}

const MAX_Q = 90;
const MAX_ASK = 110;

function norm(s: unknown): string {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

/** "소득기준이 없어져도 탈락하는 나머지 요건 - 집행권원 없으면 …" → 앞머리만 */
function head(s: string): string {
  return norm(s).split(/\s[-–—:]\s/)[0]!.replace(/[.。]$/, '').trim();
}

function list(v: unknown): string[] {
  return (Array.isArray(v) ? v : []).map(norm).filter((t) => t.length >= 6);
}

/** 같은 뜻의 재료를 두 번 배정하지 않는다 — 앞 10글자(공백 제거)로 본다 */
function keyOf(s: string): string {
  return s.replace(/[^가-힣0-9A-Za-z]/g, '').slice(0, 10);
}

/**
 * v3.8.678 — 앞머리가 달라도 뜻이 겹치면 같은 의문이다.
 * 실측(양육비 글): "대상에서 빠지는 경우 - 집행권원 부재, 미지급 기간 미충족" 과
 * "소득기준이 없어져도 탈락하는 나머지 요건 - 집행권원 없으면 신청 자체가 불가" 를 두 절에 따로 배정했고,
 * 그 두 절이 같은 말(집행권원·미지급 기록)을 되풀이했다(cross-section-echo -24).
 * 낱말(조사 뗀 명사) 겹침이 40% 이상이면 같은 의문으로 본다.
 */
const ASK_STOP = new Set(['경우', '지점', '방법', '절차', '기준', '요건', '여부', '대상', '이유', '내용', '문제', '상황', '다음', '이후', '이전', '관련', '대한', '위한']);
export function askNouns(s: string): Set<string> {
  return new Set(String(s || '')
    .replace(/[^가-힣0-9A-Za-z\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/(?:에서|으로|이라도|라도|은|는|이|가|을|를|의|에|로|와|과|도|만|까지|부터)$/, ''))
    .filter((w) => w.length >= 2 && !ASK_STOP.has(w)));
}
export function similarAsk(a: string, b: string, ignore: Set<string> = new Set()): boolean {
  // 키워드 낱말(양육비·선지급)은 어느 의문에나 있으니 겹침으로 세지 않는다
  const A = new Set([...askNouns(a)].filter((w) => !ignore.has(w)));
  const B = new Set([...askNouns(b)].filter((w) => !ignore.has(w)));
  if (A.size === 0 || B.size === 0) return false;
  let both = 0;
  for (const w of A) if (B.has(w)) both += 1;
  const jaccard = both / (A.size + B.size - both);
  // 실측: "집행권원·미지급·기간" 셋을 나눠 가진 두 재료가 두 절에서 같은 말을 했다 — 내용 낱말 셋이면 같은 의문
  if (both >= 3 || jaccard >= 0.4 || (both >= 2 && both >= Math.min(A.size, B.size) * 0.6)) return true;
  /**
   * 앞머리끼리 본다 — "기한·소급 제약" 과 "소급이 안 되는 구간" 은 설명 낱말이 달라도 같은 의문이다(오늘 리포트 실측).
   * 앞머리는 짧으니(낱말 넷 이하) 흔하지 않은 낱말 하나만 겹쳐도 같은 것으로 본다.
   */
  const headOf = (s: string) => new Set([...askNouns(String(s || '').split(/\s[-–—:]\s/)[0]!)].filter((w) => !ignore.has(w) && !ASK_GENERIC.has(w)));
  const HA = headOf(a); const HB = headOf(b);
  if (HA.size > 0 && HA.size <= 4 && HB.size > 0 && HB.size <= 4) {
    for (const w of HA) if (HB.has(w)) return true;
  }
  return false;
}
/** 앞머리 대조에서 셈하지 않는 흔한 낱말 — 이것만 겹치면 다른 의문일 수 있다 ("신청 방법" vs "신청 기한") */
const ASK_GENERIC = new Set(['신청', '확인', '통지', '서류', '기록', '자료', '지원', '지급', '기한', '조건', '항목', '갈리는', '빠지는', '되는', '없는', '있는', '다음', '때의', '뒤의']);

function isAuxHeading(h2: string): boolean {
  return /자주\s*묻는|FAQ|요약|목차|읽어보기|마무리|결론/i.test(h2);
}

export function buildThread(input: ThreadInput): Thread {
  const slot = input.slot || {};
  const clicks = list(slot.clickReasons);
  const kinQuotes = list(slot.realQuestions).map((q) => q.replace(/^"|"$/g, ''));
  const appKin = list(input.userQuestions).map((q) => q.replace(/^Q\.\s*/i, ''));
  const promises = titlePromises(norm(input.title));

  let question = '';
  let source: ThreadSource = 'keyword';
  if (clicks.length) { question = head(clicks[0]!); source = 'report-click'; }
  else if (kinQuotes.length) { question = kinQuotes[0]!.split(/[""]\s*[-–—]\s*/)[0]!.replace(/^"|"$/g, ''); source = 'report-kin'; }
  else if (appKin.length) { question = appKin[0]!; source = 'kin'; }
  else if (promises.length) { question = promises.join(', '); source = 'title'; }
  else { question = norm(input.keyword); source = 'keyword'; }
  question = question.slice(0, MAX_Q);

  // 절이 답할 의문 — 보러 올 이유가 절의 재료로 가장 알맞다(리포트가 그렇게 이름 붙였다). 그다음 클릭 이유, 롱테일
  const pool: string[] = [];
  const seen = new Set<string>();
  const keywordNouns = askNouns(input.keyword);
  for (const cand of [...list(slot.readerReasons), ...clicks, ...list(slot.longtails)]) {
    const k = keyOf(cand);
    if (!k || seen.has(k)) continue;
    if (pool.some((p) => similarAsk(p, cand, keywordNouns))) continue;   // v3.8.678 뜻이 겹치는 의문은 한 번만
    seen.add(k);
    pool.push(cand.slice(0, MAX_ASK));
  }
  const h2s = (input.h2Titles || []).map(norm);
  // 소제목이 없으면(에이전트 — 스스로 정한다) 의문 목록을 통째로 준다
  if (h2s.length === 0) return { question, source, asks: pool.slice(0, 8), materials: pool.length };
  const asks: string[] = [];
  let cursor = 0;
  for (const h2 of h2s) {
    if (isAuxHeading(h2)) { asks.push(''); continue; }
    asks.push(pool[cursor] || '');
    cursor += 1;
  }
  return { question, source, asks, materials: pool.length };
}

export function describeThreadSource(source: ThreadSource): string {
  return { 'report-click': '리포트 클릭 이유', 'report-kin': '리포트 실물 QnA', kin: '지식iN 질문', title: '제목 약속', keyword: '키워드' }[source];
}

/**
 * 본문 프롬프트에 싣는 실 블록. h2Titles 가 있으면 절 ↔ 의문 표를 싣고, 없으면(에이전트) 의문 목록만 싣는다.
 * 한 벌만 있어야 한다 — v3.8.660 의 📌 제목 블록을 이 블록이 **대신**한다 (같은 뜻의 지시 두 벌이면 한쪽만 고쳐진다).
 */
export function buildThreadBlock(thread: Thread, opts: { title?: string; h2Titles?: string[] } = {}): string {
  const lines: string[] = [''];
  if (norm(opts.title)) lines.push(`📌 [이 글의 제목] "${norm(opts.title)}"`);
  lines.push(
    '🧵 [이 글의 실 — 도입에서 던진 문제를 끝까지 붙잡습니다]',
    `· 독자의 문제: 「${thread.question}」 (출처: ${describeThreadSource(thread.source)})`,
    '· 서론은 이 제목이 약속한 독자의 상황을 받아, 이 문제를 독자에게 묻는 **질문 한 문장(물음표)** 으로 끝냅니다. 서론에서 답을 다 주지 않습니다 — 답은 절과 결론이 줍니다.',
  );
  const h2s = (opts.h2Titles || []).map(norm);
  const pairs = h2s.map((h, i) => [h, thread.asks[i] || ''] as const).filter(([h, a]) => h && a);
  if (pairs.length) {
    lines.push('· 절마다 답할 독자의 의문 (이 절이 이것에 답합니다 — 다른 절의 것을 되풀이하지 않습니다):');
    pairs.forEach(([h, a], i) => lines.push(`   ${i + 1}. 「${h}」 ← ${a}`));
  } else {
    const asks = thread.asks.filter(Boolean);
    if (asks.length) {
      lines.push('· 절마다 아래 의문 가운데 하나에 답합니다 (한 절에 하나, 되풀이 없이):');
      asks.forEach((a, i) => lines.push(`   ${i + 1}. ${a}`));
    }
  }
  lines.push(
    '· 절의 마지막 문단은 **필자의 반응**입니다: 조건(누가·어떤 경우) + 행동(무엇을 먼저) + 이유(자료의 어느 사실 때문인지). "확인하세요·점검하세요·순서대로 정리하세요" 목록으로 닫지 않습니다.',
    '· 핵심 기준(수치·요건·확인 순서)은 그것을 맡은 절 **한 곳**에서만 풀고, 다른 절에서는 한 구절로 가리키기만 합니다("앞서 본 3개월 기준"). 같은 문장을 두 절에 쓰지 않습니다 — 되풀이는 독자가 나가는 자리입니다.',
    '· 결론은 서론의 질문을 한 문장으로 되받고 답을 줍니다 — "A 라면 된다 / B 라면 안 된다". 제목의 공감을 본문이 끝까지 이어받습니다.',
  );
  if (pairs.length) {
    lines.push('· JSON 의 각 절에 "answersTo"(위 의문 문구 그대로)와 "takeaway"(필자의 반응 한 문장, <p> 하나)를 채웁니다. 본문(content)에 같은 문장을 또 쓰지 않습니다.');
  }
  lines.push('');
  return lines.join('\n');
}

/** JSON 형식 예시에 끼워 넣는 두 칸 */
export const THREAD_JSON_FIELDS = '"answersTo": "이 절이 답하는 독자의 의문 (실 블록의 문구 그대로. 없으면 빈 문자열)", "takeaway": "<p>필자의 반응 한 문장 — 조건 + 행동 + 이유</p>",';

export interface SectionLike {
  h2?: string | undefined;
  answersTo?: string | undefined;
  takeaway?: string | undefined;
  h3Sections: Array<{ h3?: string; content: string; [k: string]: any }>;
  [k: string]: any;
}

/**
 * takeaway 를 절의 마지막 h3 본문 끝에 <p> 로 붙인다. 이미 같은 문장이 본문에 있으면 안 붙인다(되풀이 방지).
 * 태그는 <p> 만 남긴다 — 모델이 <h3>·<strong> 을 섞어 보내도 본문 규칙(태그 금지)을 지킨다.
 */
export function attachTakeaways<T extends SectionLike>(sections: T[], transform: (text: string) => string = (t) => t): { sections: T[]; attached: number } {
  let attached = 0;
  const out = sections.map((sec) => {
    const raw = norm(sec?.takeaway).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const last = sec?.h3Sections?.[sec.h3Sections.length - 1];
    if (!raw || raw.length < 12 || !last) return sec;
    const text = transform(raw.endsWith('.') || /[!?]$/.test(raw) ? raw : `${raw}.`);
    const existing = String(last.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    if (existing.includes(text.slice(0, 24))) return sec;
    attached += 1;
    const h3Sections = sec.h3Sections.map((h, i) => (i === sec.h3Sections.length - 1 ? { ...h, content: `${String(h.content || '')}<p>${text}</p>` } : h));
    return { ...sec, h3Sections };
  });
  return { sections: out, attached };
}

/**
 * 실 위반 — 코드가 문자열로 센다 (AI 호출 0). 673 의 보강 트리거·자가 수정 재료.
 * 지금은 세기만 하고 로그에 남긴다.
 */
export function threadViolations(obj: { introduction?: string; conclusion?: string; sections?: SectionLike[] }, thread: Thread): string[] {
  const out: string[] = [];
  const plain = (h: unknown) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const intro = plain(obj.introduction);
  const introTail = intro.split(/(?<=[.!?])\s+/).slice(-2).join(' ');
  if (intro && !/[?？]/.test(introTail) && !/(?:까요|나요|인가|는가|일까)[.!]?(?:\s|$)/.test(introTail)) out.push('서론이 질문으로 끝나지 않음');
  const sections = obj.sections || [];
  const CHECKLIST = /(?:점검|확인|살펴|정리|대조|검토|비교|파악)(?:하는\s*(?:것이|편이)|해야|하세요|해\s*보세요|한\s*뒤|하면)|먼저\s*잡으세요|순서대로/;
  sections.forEach((sec, i) => {
    if (isAuxHeading(String(sec.h2 || ''))) return;
    const tk = plain(sec.takeaway);
    if (!tk) out.push(`${i + 1}절 takeaway 없음`);
    else if (CHECKLIST.test(tk) && !/(?:라면|다면|이면|경우|때문|므로|니까)/.test(tk)) out.push(`${i + 1}절 takeaway 가 점검 목록형: "${tk.slice(0, 30)}"`);
  });
  const concl = plain(obj.conclusion);
  const qWords = thread.question.replace(/[^가-힣0-9A-Za-z\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 2).slice(0, 6);
  if (concl && qWords.length && !qWords.some((w) => concl.includes(w))) out.push('결론에 도입의 문제 낱말이 없음');
  return out;
}
