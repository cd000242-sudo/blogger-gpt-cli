/**
 * 📉 독자가 나가는 자리를 잰다 (v3.8.654)
 *
 * ## 왜 만들었나
 * 사장님: "글내용이 중요해 사람들이 읽고 이탈하면 절대안된다고"
 *         "광고를 클릭하는 돈되는 글이어야된다고"
 *
 * 하네스 100점짜리 글을 실제로 읽어 보니(2026-09-05) 이랬다:
 *   제목 「환경개선부담금 면제 대상 **자동 적용 여부**와 **신청 방법**, 9월 30일 납부기한」
 *   본문 — 자동인지 신청인지 결론 없음. 신청 절차 없음. FAQ 도 "먼저 확인해 봐야" 로 피함.
 * 제목이 약속한 것을 어느 소제목도 맡지 않았다. 제목 보고 들어온 독자가 나가는 자리다.
 * 기존 검사(title-claim-check)는 제목의 **수치**("9월 30일")만 봤다.
 *
 * ## 네 가지
 *   ① 제목 약속어 이행   — 제목의 약속 조각을 어느 소제목·결론 박스가 맡는가  (감점)
 *   ② FAQ 질문–답 대응   — 질문의 핵심 낱말이 답에 있는가                     (감점)
 *   ③ 절별 분량 균형     — 유난히 빈약한 절이 있는가 (광고가 붙을 자리)        (감점)
 *   ④ 답 노출 비율       — 본문의 수치 사실 중 첫 화면(결론 박스·요약표)에 이미 나온 비율 (**수치만**)
 *      ④는 감점하지 않는다. SEO(답을 위에)와 광고 수익(스크롤)이 반대 방향이라
 *      어느 쪽을 택할지는 사장님이 9/21 이후 RPM 으로 정한다. 여기서는 재서 보여만 준다.
 *
 * ## 원칙
 * AI 를 부르지 않는다. 정상 글이 걸리면 검사기를 의심한다 — 오늘 여섯 번 그랬다.
 */

import type { AuditIssue, AuditSection } from './article-audit';

/** 제목을 약속 조각으로 나눌 때 쓰는 구분자 */
// v3.8.658 — "9·3 지침"·"2026-09-04"·"9:30" 처럼 숫자 사이의 구분자는 조각 경계가 아니다 (실측: "3 노동부 지침" 조각)
const PROMISE_SPLIT = /\s*(?:,|(?<!\d)[·・](?!\d)|와\s|과\s|및\s|—|(?<!\d)-(?!\d)|(?<!\d):(?!\d)|\|)\s*/;

/** 약속 조각에서 뜻 없는 낱말 — 이것만 남으면 조각이 아니다 */
const PROMISE_STOP = new Set([
  '여부', '방법', '기준', '절차', '조건', '대상', '정리', '총정리', '안내', '확인', '가이드',
  '완벽', '최신', '년', '월', '일', '및', '그리고', '때', '경우', '것', '수', '등', '더',
]);

/** 약속 조각 하나를 낱말 집합으로 (2자 이상 한글·숫자, 정지어 제외) */
function promiseWords(chunk: string): string[] {
  return chunk
    .replace(/[^가-힣0-9\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/(은|는|이|가|을|를|의|에|로|와|과|도)$/, ''))
    .filter((w) => w.length >= 2 && !PROMISE_STOP.has(w));
}

/**
 * 제목에서 "독자에게 약속한 조각" 을 뽑는다.
 * 「A 여부와 B 방법, C 기한」 → ["A 여부", "B 방법", "C 기한"]
 * 낱말이 하나도 안 남는 조각(예: "완벽 정리")은 약속이 아니다.
 */
export function titlePromises(title: string): string[] {
  return String(title || '')
    .split(PROMISE_SPLIT)
    .map((s) => s.trim())
    // v3.8.664: 문턱 4자 → 2자. "신용대출·주담대·전세대출" 의 "주담대"(3자)가 조각에서 빠져 소제목도 안 생기고 검사도 안 봤다
    .filter((s) => s.length >= 2 && promiseWords(s).length > 0);
}

/**
 * 약속 조각을 **검색어**로 (v3.8.665).
 * 실측: "9·4 서민금융 복합지원센터로 가도 보증심사는 따로다" 를 통째로 검색하니 뉴스 0건.
 * 긴 낱말 셋(복합지원센터·서민금융·보증심사)과 날짜("9월 4일")로 찾으면 그날 기사가 잡힌다.
 * 키워드에 이미 있는 낱말은 뺀다 — 조각은 키워드가 못 찾은 것을 찾는 자리다.
 */
const QUERY_SUFFIX = /(인지|일까|까지|부터|처럼|에서|에게|으로|이면|라면|여도|이라도)$/;
export function promiseQuery(chunk: string, keyword: string): string {
  const kw = new Set(promiseWords(keyword));
  const words = promiseWords(chunk)
    .map((w) => w.replace(QUERY_SUFFIX, ''))
    .filter((w) => w.length >= 2 && !kw.has(w) && !PROMISE_STOP.has(w));
  const picked = new Set([...words].sort((a, b) => b.length - a.length).slice(0, 3));
  const ordered = words.filter((w) => picked.has(w));
  const date = String(chunk || '').match(/(?<!\d)(\d{1,2})[·・.](\d{1,2})(?!\d)/);
  const dateText = date ? `${date[1]}월 ${date[2]}일` : '';
  return [...ordered, dateText].filter(Boolean).join(' ').trim();
}

function normalize(text: string): string {
  return String(text || '').replace(/[\s ]+/g, '');
}

/**
 * ① 제목 약속어 이행.
 *
 * 각 조각의 낱말 대부분(60% 이상)이 **소제목 하나**나 **결론 박스**에 있으면 맡은 것으로 본다.
 * 본문 어딘가에 흩어져 있는 것으로는 안 친다 — 실측에서 "자동"·"적용" 이 본문에
 * 따로따로는 있었지만 그 질문에 답한 절은 없었다.
 */
export function findUnkeptTitlePromises(
  title: string,
  headings: string[],
  answerBoxText: string,
): AuditIssue[] {
  const promises = titlePromises(title);
  if (promises.length < 2) return [];   // 조각이 하나뿐이면 제목 전체가 주제다 — 재지 않는다

  const carriers = [...headings, answerBoxText].map(normalize).filter(Boolean);
  const unkept = promises.filter((p) => {
    const words = promiseWords(p);
    if (words.length === 0) return false;
    return !carriers.some((c) => {
      const hit = words.filter((w) => c.includes(normalize(w))).length;
      return hit / words.length >= 0.6;
    });
  });

  if (unkept.length === 0) return [];
  // 전부 못 지켰으면 제목이 딴 글을 가리키는 것이다 — 더 크게 본다
  const all = unkept.length === promises.length;
  return [{
    kind: 'title-promise-unkept',
    title: all
      ? `제목이 약속한 것을 어느 소제목도 맡지 않았습니다 (${unkept.length}개)`
      : `제목이 약속한 ${unkept.join(' / ')} 을(를) 맡은 소제목이 없습니다`,
    evidence: `제목: "${title}". 독자는 이 조각을 보고 들어옵니다. 본문에 낱말이 흩어져 있어도 그 질문에 답하는 절이 없으면 못 찾고 나갑니다.`,
    penalty: all ? 12 : 6 * Math.min(unkept.length, 2),
  }];
}

export interface FaqPair { question: string; answer: string }

/**
 * 평문에서 FAQ 짝을 꺼낸다. 발행 HTML 의 모양은 매체마다 다르지만
 * 평문으로 풀면 늘 「Q. 질문 / ▼ / 답」 꼴이다 (toPlainText 실측).
 */
export function extractFaqPairs(plainText: string): FaqPair[] {
  const lines = String(plainText || '').split('\n').map((l) => l.trim());
  const start = lines.findIndex((l) => /자주\s*묻는\s*질문|FAQ/i.test(l));
  if (start === -1) return [];
  const pairs: FaqPair[] = [];
  let q = '';
  let a: string[] = [];
  const flush = () => { if (q && a.join(' ').trim()) pairs.push({ question: q, answer: a.join(' ').trim() }); q = ''; a = []; };
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line) continue;
    if (/^Q\.?$/.test(line)) { flush(); q = lines[i + 1]?.trim() || ''; i += 1; continue; }
    if (/^Q\.\s*/.test(line)) { flush(); q = line.replace(/^Q\.\s*/, ''); continue; }
    if (/^▼$/.test(line)) continue;
    if (!q) continue;
    // FAQ 가 끝나고 마무리 문단이 오면 그만 — 마무리는 질문이 없다
    if (/^(?:※|📢|이 글은 \d{4}년)/.test(line)) break;
    a.push(line);
  }
  flush();
  return pairs;
}

const FAQ_Q_STOP = new Set([
  '하나요', '되나요', '있나요', '인가요', '할까요', '될까요', '어떻게', '무엇', '언제', '어디', '왜',
  '제가', '저는', '경우', '것', '수', '등', '때', '요', '해야', '하면', '되면', '같으면',
  '따로', '그냥', '바로', '먼저', '다시', '아직', '지금', '이미', '정말', '혹시',
  '이후', '이전', '전에', '후에', '함께', '모두', '전부', '한번', '여러', '어떤',
]);

/** 질문 낱말 끝의 서술 어미 — "계산하나요" 는 "계산" 이고 "달았는데" 는 낱말이 아니다 */
const FAQ_VERB_END = /(하나요|되나요|인가요|일까요|할까요|될까요|있나요|없나요|다른가요|같은가요|하는데|되는데|했는데|됐는데|았는데|었는데|였는데|인데|합니까|됩니까|해야|하면|되면|우면|으면|했어요|됐어요|었어요|았어요|어요|아요|해요|했고|하고)$/;

function questionWords(q: string): string[] {
  return q
    .replace(/[^가-힣0-9\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(FAQ_VERB_END, ''))
    .map((w) => w.replace(/(은|는|이|가|을|를|의|에|로|도|만|까지|부터)$/, ''))
    .filter((w) => w.length >= 2 && !FAQ_Q_STOP.has(w));
}

/**
 * 답에 낱말이 있는가. 긴 합성어("배출가스저감장치")는 답에서 줄여 부르기("저감장치")가
 * 보통이라 4자 조각이 하나라도 있으면 있는 것으로 본다.
 */
function answerHas(answer: string, word: string): boolean {
  const w = normalize(word);
  if (answer.includes(w)) return true;
  if (w.length < 5) return false;
  for (let i = 0; i + 4 <= w.length; i++) if (answer.includes(w.slice(i, i + 4))) return true;
  return false;
}

/**
 * ② FAQ 질문–답 대응.
 *
 * 질문의 핵심 낱말 절반 이상이 답에 없으면 딴 답이다.
 * 실측(어제 평가): "연체 이력" 을 물었는데 "현재 연체 중" 기준으로 답했다 —
 * 낱말로는 잡히지 않는 어긋남도 있으니 이 검사는 **거친 그물**이다. 거친 것부터 잡는다.
 */
/**
 * 답을 피하는 말. (v3.8.656)
 * 낱말이 안 겹치는 것만으로 잡으면 **바꿔 말한 정답**("어떤 자료를 준비하나요" → "고지서·차량등록증·납부 기록")
 * 을 딴 답이라 한다 — 실측 4건 중 2건이 그랬다. 낱말도 안 겹치고 **피하는 말까지 있을 때만** 딴 답이다.
 */
const FAQ_DODGE = /확인할\s*수\s*있어요|문의할\s*수\s*있어요|문의하세요|확인하세요|확인해\s*봐야|달라질\s*수\s*있|단정하기\s*어려|판단하기(?:는)?\s*어려|안내되지\s*않았|일률적으로|살펴봐야\s*해요|확인하는\s*편이/;

export function findFaqMismatches(pairs: FaqPair[]): AuditIssue[] {
  const out: AuditIssue[] = [];
  for (const { question, answer } of pairs) {
    const words = questionWords(question);
    if (words.length < 2) continue;
    const a = normalize(answer);
    const hit = words.filter((w) => answerHas(a, w)).length;
    // v3.8.659 — 피하는 말은 **첫 문장**에서만 본다. 답을 한 뒤 "…에서 확인할 수 있어요" 로 맺는 건 피하는 게 아니다
    // (실측 오탐: "경남은 10월부터 가입이 열리는 지역이에요. … 함께 확인할 수 있어요.")
    const firstSentence = String(answer || '').split(/(?<=[.!?])\s+|(?<=요)\s+(?=[가-힣])/)[0] || answer;
    if (hit / words.length < 0.5 && FAQ_DODGE.test(firstSentence)) {
      out.push({
        kind: 'faq-answer-mismatch',
        title: `FAQ 답이 질문과 어긋납니다: "${question.slice(0, 40)}"`,
        evidence: `질문의 핵심 낱말 ${words.length}개 중 ${hit}개만 답에 있습니다. 답: "${answer.slice(0, 70)}…"`,
        penalty: 4,
      });
      if (out.length >= 3) break;
    }
  }
  return out;
}

/**
 * ③ 절별 분량 균형 — h2 절 기준.
 *
 * 어느 절이 중간값의 1/3 도 안 되면 그 절은 소제목만 있고 내용이 없는 것이다.
 * 자동광고는 긴 본문 사이에 붙으므로 빈약한 절은 광고 자리도 못 된다.
 */
/** 본문 절이 아닌 h2 — 요약 박스·목차·FAQ 는 짧은 게 정상이다 (실측 오탐 7번째) */
const NON_BODY_HEADING = /자주\s*묻는|FAQ|핵심\s*요약|요약|목차|읽어보기|한눈에|정리$/i;

export function findThinSections(sections: AuditSection[]): { issues: AuditIssue[]; minRatio: number | null } {
  const h2 = sections.filter((s) => s.heading && !NON_BODY_HEADING.test(s.heading));
  if (h2.length < 3) return { issues: [], minRatio: null };
  const lens = h2.map((s) => s.text.length).sort((a, b) => a - b);
  const median = lens[Math.floor(lens.length / 2)]!;
  if (median === 0) return { issues: [], minRatio: null };
  const thin = h2.filter((s) => s.text.length < median / 3);
  const minRatio = Number((lens[0]! / median).toFixed(2));
  const issues: AuditIssue[] = thin.slice(0, 2).map((s) => ({
    kind: 'thin-section',
    title: `절이 빈약합니다: "${s.heading.slice(0, 30)}" (${s.text.length}자, 중간값 ${median}자)`,
    evidence: '소제목이 약속한 만큼 내용이 없으면 독자는 여기서 나갑니다. 광고가 붙을 자리도 안 됩니다.',
    penalty: 4,
  }));
  return { issues, minRatio };
}

const FACT_TOKEN = /\d{1,3}(?:,\d{3})*\s*(?:원|만원|억|%|일|개월|년|주|시간|건|명|회|대|kg|km)|\d{1,2}월\s?\d{1,2}일|20\d\d년/g;

/**
 * ④ 답 노출 비율 — **수치만 낸다, 감점 없음.**
 *
 * 본문(첫 h2 이후)에 나오는 수치 사실 가운데 첫 화면(결론 박스 + 요약표, 첫 h2 이전)에
 * 이미 나온 비율. 1.0 이면 첫 화면에서 답을 다 준 것이다.
 * 높으면 SEO·AI 인용엔 좋고 스크롤 유인은 없다. 어느 쪽이 돈이 되는지는 실측으로 정한다.
 */
export function answerExposureRatio(html: string, toPlain: (h: string) => string): number | null {
  const src = String(html || '');
  const firstH2 = src.search(/<h2\b/i);
  if (firstH2 === -1) return null;
  const top = toPlain(src.slice(0, firstH2));
  const body = toPlain(src.slice(firstH2));
  const bodyFacts = new Set((body.match(FACT_TOKEN) || []).map(normalize));
  if (bodyFacts.size === 0) return null;
  const topFacts = new Set((top.match(FACT_TOKEN) || []).map(normalize));
  let shown = 0;
  for (const f of bodyFacts) if (topFacts.has(f)) shown++;
  return Number((shown / bodyFacts.size).toFixed(2));
}
