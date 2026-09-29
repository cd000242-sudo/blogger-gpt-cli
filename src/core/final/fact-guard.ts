/**
 * fact-guard — 발행 직전, 자료에 근거가 없는 수치를 찾아 그 문단만 고친다.
 *
 * ## 왜 수치만 보는가
 * 지어낸 금액·마감일·통계는 두 가지를 동시에 무너뜨린다.
 *   · 독자 신뢰 — "월 최대 50만원" 이 틀리면 그 글 전체가 거짓말이 된다
 *   · 애드센스 Misrepresentative content — 사실과 다른 서술은 정책 위반이다
 * 문장이 밋밋한 건 정책 위반이 아니다. 그래서 위험한 것부터 잡는다.
 *
 * ## 비용 구조
 * "어디가 문제냐" 를 AI 에게 묻지 않는다. **코드가 정규식으로 먼저 찾는다.**
 * 걸린 게 있을 때만, 그 문단만 모아서 **한 번** 부른다.
 * 수치가 전부 근거 있으면 API 호출은 0회다.
 *
 * ## 절대 막지 않는다
 * 이 모듈은 어떤 경우에도 예외를 던지지 않는다. 판단이 안 서면 원본을 돌려준다.
 * 검수 때문에 발행이 멈추는 일은 만들지 않는다.
 */

import type { FactEvidence } from './fact-integrity';

export interface UngroundedFact {
  /** 자료에서 근거를 못 찾은 표현 — 예: "50만원", "3월 31일", "62.5%" */
  token: string;
  /** 그 표현이 들어 있는 문단(태그 포함) */
  paragraph: string;
  /** 문단 순번 — 이 번호로만 갈아끼운다 */
  paragraphIndex: number;
}

export interface FactRepair {
  paragraphIndex: number;
  html: string;
}

export interface GuardFactsInput {
  html: string;
  /** 크롤링 본문·상품 데이터 등 이 글이 근거로 삼은 원자료 */
  reference: string;
  keyword: string;
  callLLM: (prompt: string) => Promise<string>;
  onLog?: (msg: string) => void;
  /**
   * v3.8.761 — 채택 근거 장부 보기(validationView). 주면 "근거 없음" 판정과 보호 대상 계산을 본문 사실 필터와 **같은 검사기**(fact-integrity:
   * 장부·범위·파생 차액·가정 예시)로 한다. 실측(run b8cdb4·a280b4): 발췌 문맥(reference)으로 다시 재서 장부가 통과시킨 값을 지웠다.
   */
  evidence?: FactEvidence;
  /** 핵심 질문에 답하는 문장인가 — 그 문장이 사라지는 교체본은 받지 않는다 */
  isCoreAnswer?: (sentence: string) => boolean;
  /** v3.8.765 — 주장 단위 지원 상태(현재 공식 답과 반대인 문장은 값 보호 대상이 아니다) */
  claimSupport?: (sentences: string[]) => Array<'SUPPORTED' | 'UNSUPPORTED' | 'CONTRADICTED' | 'UNKNOWN'>;
}

export interface RepairDecision {
  paragraphIndex: number;
  accepted: boolean;
  /** 이 문단을 고치게 한 값(근거 없음) */
  issueTokens: string[];
  /** 교체 뒤 사라진 보호 값(근거 있음·검산·가정) — 하나라도 있으면 거부 */
  lostProtected: string[];
  /** 교체본에 새로 들어온 근거 없는 값 — 있으면 거부 */
  introducedUnsupported: string[];
  /** 사라진 핵심 질문 답·판단 기준 문장 */
  lostCore: string[];
  /** v3.8.765 — 현재 공식 답과 반대라 보호하지 않은 문장(주장 단위) */
  contradictedClaims?: string[];
  reason: string;
}

export interface GuardFactsResult {
  html: string;
  /** 근거를 못 찾아 검사한 수치 개수 */
  checked: number;
  /** 실제로 고쳐진 문단 수 */
  repaired: number;
  /** v3.8.761 — 문단별 채택/거부 기록 */
  decisions?: RepairDecision[];
  /** v3.8.761 — 답 상자·FAQ 안이라 LLM 재작성에서 제외한 문단 수 */
  excluded?: number;
}

/** 한 번에 고칠 문단 상한 — 이보다 많으면 글 전체가 문제라 부분 수정이 의미 없다 */
const MAX_REPAIR_PARAGRAPHS = 12;

/** 근거 문자열 상한 — 토큰마다 includes 를 도는 만큼 무한정 키우지 않는다 */
const MAX_REFERENCE_CHARS = 60000;

export interface GroundingSources {
  /** 팩트체크(퍼플렉시티/네이버) 요약 */
  factContext?: string;
  /**
   * 오늘의 글감·리포트가 적어 준 사실 (v3.8.714).
   *
   * 사장님 실측(경기도 산후조리비 글): 본문에 **금액이 한 번도 안 나왔다.**
   * 리포트는 "출생아 1인당 50만원 지역화폐" 를 적어 줬는데, 그 글감 브리프가
   * 근거 장부에 안 실려서 근거 없는 수치로 판정돼 **문장째 지워진** 것이다.
   * 독자가 가장 먼저 찾는 숫자가 빠지면 글의 값어치가 통째로 깎인다.
   *
   * 리포트는 [확인]/[추정] 을 구분해 적는 자료이므로 근거로 인정한다.
   */
  briefFacts?: string;
  /** 실제로 글을 쓸 때 참고한 크롤링 본문 */
  crawledPosts?: Array<{ title?: string; content?: string }>;
  /** 공공기관 근거 블록 */
  officialBlock?: string;
  /** 상품 스펙·후기 등 구조화 데이터 */
  productData?: unknown;
  maxChars?: number;
}

/**
 * 글을 쓸 때 본 자료를 전부 합쳐 "근거 장부" 를 만든다.
 *
 * 이게 없으면 검증 기준과 작성 기준이 어긋난다. 크롤링 본문에서 정확히 옮긴 수치라도
 * 팩트체크 요약문(몇백 자 압축본)에 없으면 근거 없음으로 판정돼 문장째 삭제됐다.
 * 실측: 62자 문단이 24자로 잘리고 알맹이 있는 문장 둘이 사라졌다.
 */
export function buildGroundingReference(input: GroundingSources): string {
  try {
    const limit = Math.max(1000, Number(input?.maxChars) || MAX_REFERENCE_CHARS);
    const parts: string[] = [];

    if (input?.factContext) parts.push(String(input.factContext));
    // v3.8.714: 리포트가 적어 준 사실을 **맨 앞에** 둔다 — 상한(60,000자)에 밀려 잘리면
    //   금액이 또 근거 없음으로 판정돼 지워진다. 짧고 밀도가 높은 자료라 앞자리 값을 한다.
    if (input?.briefFacts) parts.unshift(String(input.briefFacts));
    if (input?.officialBlock) parts.push(String(input.officialBlock));

    for (const post of input?.crawledPosts || []) {
      const chunk = `${post?.title || ''} ${post?.content || ''}`.trim();
      if (chunk) parts.push(chunk);
    }

    if (input?.productData) {
      try {
        parts.push(typeof input.productData === 'string'
          ? input.productData
          : JSON.stringify(input.productData));
      } catch { /* 직렬화 못 하면 그 조각만 건너뛴다 */ }
    }

    return parts.join('\n').slice(0, limit);
  } catch {
    return String(input?.factContext || '');
  }
}

/**
 * 주장에 해당하는 수치 패턴.
 * 맨 숫자(예: "3")는 넣지 않는다 — 목록 번호·단계 표기와 구별할 수 없다.
 * 단위가 붙어야 비로소 "사실 주장" 이 된다.
 */
const FACT_PATTERNS: RegExp[] = [
  // 금액 — 3,000만원 / 50만원 / 12000원 / 1억
  /\d[\d,]*\s*(?:억\s*)?(?:천만|백만|십만|만|천)?\s*원/g,
  /\d[\d,]*(?:\.\d+)?\s*(?:달러|USD|엔|위안)/g,
  // 날짜·마감 — 3월 31일 / 2026년 3월 / 12월까지
  /\d{1,2}\s*월\s*\d{1,2}\s*일/g,
  /\d{4}\s*년\s*\d{1,2}\s*월/g,
  // 기간 — 3개월 / 2주 / 14일 이내
  /\d+\s*(?:개월|주일|주|영업일|일)\s*(?:이내|이상|이하|까지|간|동안)/g,
  // 비율
  /\d+(?:\.\d+)?\s*%/g,
  // 규모 — 1,240명 / 320건 / 3배
  /\d[\d,]*\s*(?:명|건|가구|세대|배|회)/g,
];

/** 태그·속성을 걷어내고 사람이 읽는 글자만 남긴다 (주소 안 숫자를 수치로 오인하지 않게) */
function stripMarkup(html: string): string {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
}

/** 비교용 정규화 — 쉼표·공백을 없애 "3,000만원" 과 "3000만원" 을 같게 본다 */
function normalizeForMatch(text: string): string {
  return String(text || '').replace(/[,\s]/g, '');
}

/**
 * 문단으로 자른다. p·li·td 처럼 글이 담기는 블록만 대상으로 삼는다.
 * 제목(h2/h3)은 건드리지 않는다 — 제목을 고치면 목차·앵커가 어긋난다.
 */
const PARAGRAPH_RE = /<(p|li|td)\b[^>]*>[\s\S]*?<\/\1>/gi;

function splitParagraphs(html: string): { html: string; start: number; end: number }[] {
  const out: { html: string; start: number; end: number }[] = [];
  const re = new RegExp(PARAGRAPH_RE.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(html || ''))) !== null) {
    out.push({ html: m[0], start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/**
 * 자료에 근거가 없는 수치를 찾는다. API 호출 없이 코드만으로 판정한다.
 *
 * 통과시키는 것:
 *   · 자료(reference)에 같은 수치가 있는 경우 — 근거가 있다
 *   · 키워드 자체에 든 숫자 — "2026년 청년내일저축계좌"
 *   · 목록 번호·단계 표기 — 단위가 없으므로 애초에 패턴에 안 걸린다
 *   · 링크/이미지 주소 안의 숫자 — 태그를 걷어내고 보므로 안 걸린다
 */
export function findUngroundedFacts(
  html: string,
  reference: string,
  options?: { keyword?: string },
): UngroundedFact[] {
  try {
    const haystack = normalizeForMatch(`${reference || ''} ${options?.keyword || ''}`);
    const paragraphs = splitParagraphs(html);
    const found: UngroundedFact[] = [];
    const seen = new Set<string>();

    paragraphs.forEach((para, paragraphIndex) => {
      const text = stripMarkup(para.html);
      for (const pattern of FACT_PATTERNS) {
        const re = new RegExp(pattern.source, 'g');
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
          const token = m[0].trim();
          const key = normalizeForMatch(token);
          if (!key || seen.has(key)) continue;
          if (haystack.includes(key)) continue;   // 자료에 있다 → 근거 있음
          seen.add(key);
          found.push({ token, paragraph: para.html, paragraphIndex });
        }
      }
    });

    return found;
  } catch {
    return [];   // 못 찾으면 그냥 통과 — 막지 않는다
  }
}

/**
 * v3.8.761 — 답 상자(answer-first)·FAQ(details) 안의 문단은 LLM 재작성 대상이 아니다.
 * 답 상자는 판정문이 근거 요약문으로(run a280b4), FAQ 답은 질문과 어긋난 문장으로(같은 run) 바뀌었다. 이 블록들은 앞 단계(값 관문·일치 검사·fidelity)가 이미 봤다.
 */
export function protectedZones(html: string): Array<{ start: number; end: number; kind: 'answer' | 'faq' }> {
  const zones: Array<{ start: number; end: number; kind: 'answer' | 'faq' }> = [];
  for (const m of String(html || '').matchAll(/<section[^>]*class="[^"]*answer-first[^"]*"[^>]*>[\s\S]*?<\/section>/gi)) zones.push({ start: m.index!, end: m.index! + m[0].length, kind: 'answer' });
  for (const m of String(html || '').matchAll(/<details\b[\s\S]*?<\/details>/gi)) zones.push({ start: m.index!, end: m.index! + m[0].length, kind: 'faq' });
  return zones;
}
const inZone = (zones: Array<{ start: number; end: number }>, at: number) => zones.some((z) => at >= z.start && at < z.end);

/**
 * 문단이 놓인 블록(앞 소제목부터 다음 소제목 전까지) — 검산 차액·가정 예시는 같은 블록의 표·가정 문장을 봐야 판정된다.
 * 실측(run b8cdb4): "월 한도 차이는 20만원" 은 같은 절의 표(50만원·70만원)로 검산되는 값인데, 문단만 보면 근거 없음이 된다.
 */
export function blockContextOf(html: string, start: number, end: number): string {
  const src = String(html || '');
  const headBefore = Math.max(src.lastIndexOf('<h2', start), src.lastIndexOf('<h3', start), src.lastIndexOf('<section', start));
  const nextH2 = src.indexOf('<h2', end); const nextH3 = src.indexOf('<h3', end);
  const candidates = [nextH2, nextH3].filter((i) => i >= 0);
  const tail = candidates.length ? Math.min(...candidates) : src.length;
  return src.slice(headBefore >= 0 ? headBefore : Math.max(0, start - 4000), Math.min(tail, end + 4000));
}

/** 장부 검사기로 문단의 값을 가른다 — 지원(직접·범위·검산·가정)과 미지원. blockHtml 은 문단이 놓인 블록(표·가정 문장 포함) */
function classifyParagraph(paraHtml: string, evidence: FactEvidence, blockHtml?: string): { supported: string[]; unsupported: string[]; sentences: string[] } {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fi = require('./fact-integrity');
  const text = stripMarkup(paraHtml);
  const all: string[] = fi.extractValueTokens(text);
  const report = fi.inspectFactIntegrity(paraHtml, { ...evidence, blockHtml: blockHtml || paraHtml });
  const unsupported = new Set<string>();
  for (const v of report.violations || []) for (const m of String(v.detail || '').matchAll(/값:\s*(.+)$|없음:\s*(.+)$/g)) for (const t of String(m[1] || m[2] || '').split(/,\s*/)) if (t.trim()) unsupported.add(t.trim());
  const supported = all.filter((t) => !unsupported.has(t));
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  return { supported, unsupported: [...unsupported], sentences };
}

/**
 * v3.8.761 — 교체본 채택 게이트. 고치라고 한 값(issue) 이외의 **보호 값**(장부가 확인한 값·검산 차액·가정 예시)이 사라지거나,
 * 근거 없는 값이 새로 들어오거나, 핵심 질문 답·판단 기준 문장이 사라지면 그 문단의 교체본을 받지 않는다(원문 유지).
 * 문체·중복·장황함은 고쳐도 된다 — 값과 판단 기준만 본다.
 */
/**
 * v3.8.765 — 보호 단위는 값 토큰이 아니라 **주장**이다. claimSupport 가 문장마다 SUPPORTED/UNSUPPORTED/CONTRADICTED/UNKNOWN 을 준다.
 * CONTRADICTED(현재 공식 답과 반대) 문장 안에만 있던 값은 사라져도 보호 값 소실이 아니고, 그 문장은 판단 기준 문장으로도 보호하지 않는다.
 * 실측(run 111bcf): 늦은 재작성이 "…2026년 6월 최초 가입자에게만 허용된 예외였기 때문" 을 지우려 했는데 "2026년" 이 보호 값이라 거부돼 틀린 문장이 남았다.
 */
export type GateClaimSupport = (sentences: string[]) => Array<'SUPPORTED' | 'UNSUPPORTED' | 'CONTRADICTED' | 'UNKNOWN'>;
export function gateRepairs(html: string, repairs: FactRepair[], evidence: FactEvidence, options: { issueByIndex?: Map<number, string[]>; isCoreAnswer?: (s: string) => boolean; claimSupport?: GateClaimSupport } = {}): { accepted: FactRepair[]; decisions: RepairDecision[] } {
  const paragraphs = splitParagraphs(html);
  const accepted: FactRepair[] = [];
  const decisions: RepairDecision[] = [];
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const retention = require('./decision-retention');
  for (const r of repairs) {
    const idx = Number(r?.paragraphIndex);
    const before = paragraphs[idx];
    if (!before) continue;
    const issue = options.issueByIndex?.get(idx) || [];
    const block = blockContextOf(html, before.start, before.end);
    const b = classifyParagraph(before.html, evidence, block);
    const a = classifyParagraph(String(r.html || ''), evidence, block.replace(before.html, String(r.html || '')));
    const afterText = stripMarkup(String(r.html || ''));
    const norm = (s: string) => s.replace(/[,\s]/g, '');
    const support = options.claimSupport ? options.claimSupport(b.sentences) : b.sentences.map(() => 'UNKNOWN' as const);
    const contradicted = b.sentences.filter((_, i) => support[i] === 'CONTRADICTED');
    // 값이 든 문장이 **전부** 현재 공식 답과 반대면 그 값은 보호하지 않는다(값이 든 문장을 못 찾으면 예전처럼 보호)
    const onlyInContradicted = (t: string) => { const holders = b.sentences.filter((s) => norm(s).includes(norm(t))); return holders.length > 0 && holders.every((s) => contradicted.includes(s)); };
    const lostProtected = b.supported.filter((t) => !issue.includes(t) && !norm(afterText).includes(norm(t)) && !onlyInContradicted(t));
    const introducedUnsupported = a.unsupported.filter((t) => !b.unsupported.includes(t));
    const lostCore = b.sentences.filter((s) => !contradicted.includes(s) && (options.isCoreAnswer?.(s) || retention.keyPhrases(s).length >= 2 && /(?:에\s*따라|별로)\s*[^.]{0,30}?(?:다르|달라)|함께\s*(?:놓고|보고|두고)/.test(s))
      && !retention.keyPhrases(s).some((p: string) => { const [x, y] = p.split(' '); return new RegExp(`${x}[^.]{0,6}${y}`).test(afterText); }));
    const ok = lostProtected.length === 0 && introducedUnsupported.length === 0 && lostCore.length === 0;
    decisions.push({ paragraphIndex: idx, accepted: ok, issueTokens: issue, lostProtected, introducedUnsupported, lostCore, ...(contradicted.length ? { contradictedClaims: contradicted.map((s) => s.slice(0, 160)) } : {}), reason: ok ? (contradicted.length ? `현재 공식 답과 반대인 문장 ${contradicted.length}개 삭제 허용 · 나머지 보호 값·판단 기준 유지` : '보호 값·판단 기준 유지') : [lostProtected.length ? `보호 값 사라짐: ${lostProtected.join(', ')}` : '', introducedUnsupported.length ? `근거 없는 값 유입: ${introducedUnsupported.join(', ')}` : '', lostCore.length ? `판단 기준 문장 사라짐: ${lostCore[0]!.slice(0, 60)}` : ''].filter(Boolean).join(' · ') });
    if (ok) accepted.push(r);
  }
  return { accepted, decisions };
}

/**
 * v3.8.762 — 늦은 LLM 재작성(pre-publish-fix 등)이 만든 **전후 HTML** 을 같은 게이트에 통과시킨다. 새 게이트가 아니다 — gateRepairs 를 재사용한다.
 * 문단 단위로 전후를 맞추고(같은 글자의 문단은 같은 문단), 바뀐 구간마다 "전 문단들 → 후 구간" 을 교체본으로 보아 보호 값·근거 없는 값 유입·핵심 답 소실을 본다.
 * 거부된 구간은 원본 문단으로 되돌린다(rollback). 바뀐 구간이 없으면 not-applicable.
 */
export interface RewriteRegion { beforeIndices: number[]; afterIndices: number[]; accepted: boolean; decisions: RepairDecision[]; beforeText: string; afterText: string }
export interface RewriteGateResult { html: string; status: 'not-applicable' | 'accepted' | 'partially-rejected' | 'rejected'; regions: RewriteRegion[]; rolledBack: number }

function alignParagraphs(a: string[], b: string[]): Array<[number, number]> {
  // LCS(같은 글자 문단) — 문단 수는 수십~수백이라 O(n·m) 으로 충분하다
  const n = a.length; const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) for (let j = m - 1; j >= 0; j -= 1) dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const pairs: Array<[number, number]> = [];
  let i = 0; let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { pairs.push([i, j]); i += 1; j += 1; }
    else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) i += 1;
    else j += 1;
  }
  return pairs;
}

export function gateRewrite(beforeHtml: string, afterHtml: string, evidence: FactEvidence, options: { isCoreAnswer?: (s: string) => boolean; claimSupport?: GateClaimSupport } = {}): RewriteGateResult {
  const before = String(beforeHtml || ''); const after = String(afterHtml || '');
  if (before === after) return { html: after, status: 'not-applicable', regions: [], rolledBack: 0 };
  const bp = splitParagraphs(before); const ap = splitParagraphs(after);
  const key = (p: { html: string }) => stripMarkup(p.html).replace(/\s+/g, ' ').trim();
  const pairs = alignParagraphs(bp.map(key), ap.map(key));
  // 매칭 사이의 빈틈이 바뀐 구간
  const regions: RewriteRegion[] = [];
  const anchors: Array<[number, number]> = [[-1, -1], ...pairs, [bp.length, ap.length]];
  for (let k = 0; k + 1 < anchors.length; k += 1) {
    const [bi, ai] = anchors[k]!; const [bj, aj] = anchors[k + 1]!;
    const beforeIdx: number[] = []; for (let x = bi + 1; x < bj; x += 1) beforeIdx.push(x);
    const afterIdx: number[] = []; for (let x = ai + 1; x < aj; x += 1) afterIdx.push(x);
    if (beforeIdx.length === 0 && afterIdx.length === 0) continue;
    const afterRegionHtml = afterIdx.map((x) => ap[x]!.html).join('\n') || '<p></p>';
    // 전 문단마다 "후 구간 전체" 를 교체본으로 본다 — 보호 값이 구간 안 어디에든 남아 있으면 된다
    const repairs = beforeIdx.map((x) => ({ paragraphIndex: x, html: afterRegionHtml }));
    const gated = beforeIdx.length ? gateRepairs(before, repairs, evidence, { ...(options.isCoreAnswer ? { isCoreAnswer: options.isCoreAnswer } : {}), ...(options.claimSupport ? { claimSupport: options.claimSupport } : {}) }) : { decisions: [] as RepairDecision[] };
    // 새로 생긴 구간(전 문단 없음)은 근거 없는 값 유입만 본다
    const introduced = beforeIdx.length === 0 ? gateRepairs(`<p></p>`, [{ paragraphIndex: 0, html: afterRegionHtml }], evidence).decisions : [];
    const decisions = [...gated.decisions, ...introduced];
    regions.push({ beforeIndices: beforeIdx, afterIndices: afterIdx, accepted: decisions.every((d) => d.accepted), decisions, beforeText: beforeIdx.map((x) => key(bp[x]!)).join(' ').slice(0, 240), afterText: afterIdx.map((x) => key(ap[x]!)).join(' ').slice(0, 240) });
  }
  if (regions.length === 0) return { html: after, status: 'not-applicable', regions, rolledBack: 0 };
  // 거부 구간을 뒤에서부터 원본으로 되돌린다(앞 위치가 밀리지 않게)
  let out = after;
  let rolledBack = 0;
  for (const r of [...regions].reverse()) {
    if (r.accepted) continue;
    rolledBack += 1;
    const beforeSlice = r.beforeIndices.length ? before.slice(bp[r.beforeIndices[0]!]!.start, bp[r.beforeIndices[r.beforeIndices.length - 1]!]!.end) : '';
    if (r.afterIndices.length) {
      const s = ap[r.afterIndices[0]!]!.start; const e = ap[r.afterIndices[r.afterIndices.length - 1]!]!.end;
      out = out.slice(0, s) + beforeSlice + out.slice(e);
    } else {
      // 문단이 통째로 지워진 구간 — 앞 매칭 문단 뒤에 원본을 다시 넣는다
      const prevAfter = r.afterIndices.length === 0 && r.beforeIndices.length ? (() => { const firstBefore = r.beforeIndices[0]!; const anchor = pairs.filter(([b]) => b < firstBefore).pop(); return anchor ? ap[anchor[1]]!.end : 0; })() : 0;
      out = out.slice(0, prevAfter) + '\n' + beforeSlice + out.slice(prevAfter);
    }
  }
  const rejected = regions.filter((r) => !r.accepted).length;
  return { html: out, status: rejected === 0 ? 'accepted' : rejected === regions.length ? 'rejected' : 'partially-rejected', regions, rolledBack };
}

/** 고친 문단만 제자리에 갈아끼운다. 지목되지 않은 문단은 글자 하나 건드리지 않는다. */
export function applyFactRepairs(html: string, repairs: FactRepair[]): string {
  try {
    if (!Array.isArray(repairs) || repairs.length === 0) return html;
    const paragraphs = splitParagraphs(html);
    if (paragraphs.length === 0) return html;

    const byIndex = new Map<number, string>();
    for (const r of repairs) {
      const idx = Number(r?.paragraphIndex);
      const body = String(r?.html || '').trim();
      if (!Number.isInteger(idx) || idx < 0 || idx >= paragraphs.length) continue;  // 엉뚱한 번호는 무시
      if (!body) continue;                                                          // 빈 교체본은 무시 — 구멍이 생긴다
      // v3.8.666 실측: 태그만 남은 교체본(<p class="answer-first-a"></p>)이 답변 블록을 비웠다 — 글자가 없으면 교체본이 아니다
      if (!body.replace(/<[^>]+>/g, '').replace(/&nbsp;|\s/g, '').trim()) continue;
      byIndex.set(idx, /^<[a-zA-Z]/.test(body) ? body : `<p>${body}</p>`);
    }
    if (byIndex.size === 0) return html;

    // 뒤에서부터 갈아끼워야 앞 문단의 위치가 안 밀린다
    let out = html;
    for (let i = paragraphs.length - 1; i >= 0; i--) {
      const replacement = byIndex.get(i);
      if (!replacement) continue;
      const p = paragraphs[i]!;
      out = out.slice(0, p.start) + replacement + out.slice(p.end);
    }
    return out;
  } catch {
    return html;
  }
}

function buildPrompt(facts: UngroundedFact[], reference: string, keyword: string): string {
  const targets = new Map<number, { paragraph: string; tokens: string[] }>();
  for (const f of facts) {
    const cur = targets.get(f.paragraphIndex);
    if (cur) cur.tokens.push(f.token);
    else targets.set(f.paragraphIndex, { paragraph: f.paragraph, tokens: [f.token] });
  }

  const list = [...targets.entries()].slice(0, MAX_REPAIR_PARAGRAPHS).map(
    ([idx, t]) => `[${idx}] 확인 필요: ${t.tokens.join(', ')}\n${t.paragraph}`,
  ).join('\n\n');

  return `아래 문단들에 자료로 뒷받침되지 않는 수치가 들어 있습니다. 키워드는 "${keyword}" 입니다.

## 자료 (이 안에 있는 값만 사실입니다)
${String(reference || '(자료 없음)').slice(0, 4000)}

## 고칠 문단
${list}

## 규칙
1. 자료에 근거가 있는 수치는 그대로 두세요.
2. 자료에 없는 수치는 **다른 숫자로 바꾸지 말고, 그 주장을 통째로 빼세요.**
   ⚠️ 얼버무리는 문장으로 대체하지 마세요. 아래는 **금지**입니다:
     ✗ "지원 금액은 공고와 소득 구간에 따라 달라집니다"
     ✗ "접수 기간은 해당 회차 공고에서 확인해야 합니다"
   값을 모르면 그 이야기를 아예 꺼내지 않습니다. 독자는 "다릅니다" 를 읽으려고
   검색한 게 아닙니다. 모르는 걸 아는 척 돌려 말하면 글만 늘어지고 신뢰를 잃습니다.
   예) "월 최대 50만원을 받고, 신청은 복지로에서 합니다"
       → "신청은 복지로에서 합니다"   (금액 이야기를 통째로 삭제)
3. 그 결과 문단이 너무 짧아지면, 자료에 **실제로 있는** 다른 내용으로 채우세요.
   자료에도 없으면 짧은 채로 두세요. 채우려고 지어내지 않습니다.
4. 문단의 말투와 HTML 태그 구조는 그대로 유지하세요.
5. 고칠 필요가 없는 문단은 결과에 넣지 마세요.
6. 새로운 수치를 만들어내지 마세요. 자료에 없으면 숫자를 쓰지 않습니다.

## 출력
JSON 배열만 출력하세요. 설명 문장을 붙이지 마세요.
[{"paragraphIndex": 0, "html": "<p>고친 문단</p>"}]`;
}

/** AI 응답에서 JSON 배열만 건져낸다. 못 건지면 빈 배열 — 원본이 유지된다. */
function parseRepairs(raw: string): FactRepair[] {
  try {
    const text = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start < 0 || end <= start) return [];
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r: any) => r && Number.isInteger(Number(r.paragraphIndex)) && typeof r.html === 'string',
    ).map((r: any) => ({ paragraphIndex: Number(r.paragraphIndex), html: String(r.html) }));
  } catch {
    return [];
  }
}

/**
 * 발행 직전 수치 검증. 어떤 경우에도 던지지 않는다 — 실패하면 원본을 그대로 돌려준다.
 *
 * 근거 없는 수치가 하나도 없으면 AI 를 부르지 않는다(비용 0).
 */
/**
 * v3.8.761 — 장부 검사기로 근거 없는 값을 찾는다(evidence 가 있을 때). 답 상자·FAQ 안 문단은 뺀다.
 * 발췌 문맥(reference) 대조는 evidence 가 없을 때의 옛 경로다.
 */
export function findUngroundedFactsByEvidence(html: string, evidence: FactEvidence, options?: { keyword?: string }): { facts: UngroundedFact[]; excluded: number } {
  const zones = protectedZones(html);
  const paragraphs = splitParagraphs(html);
  const facts: UngroundedFact[] = [];
  const keywordNorm = normalizeForMatch(String(options?.keyword || ''));
  let excluded = 0;
  paragraphs.forEach((para, paragraphIndex) => {
    const c = classifyParagraph(para.html, evidence, blockContextOf(html, para.start, para.end));
    if (c.unsupported.length === 0) return;
    if (inZone(zones, para.start)) { excluded += 1; return; }
    for (const token of c.unsupported) {
      if (keywordNorm && keywordNorm.includes(normalizeForMatch(token))) continue;
      facts.push({ token, paragraph: para.html, paragraphIndex });
    }
  });
  return { facts, excluded };
}

export async function guardFacts(input: GuardFactsInput): Promise<GuardFactsResult> {
  const { html, reference, keyword, callLLM, onLog, evidence } = input;
  const fallback: GuardFactsResult = { html, checked: 0, repaired: 0 };

  try {
    const byEvidence = evidence ? findUngroundedFactsByEvidence(html, evidence, { keyword }) : null;
    const facts = byEvidence ? byEvidence.facts : findUngroundedFacts(html, reference, { keyword });
    if (facts.length === 0) {
      onLog?.('[사실검증] 근거 없는 수치 없음 — 추가 호출 없이 통과');
      return { ...fallback, ...(byEvidence ? { excluded: byEvidence.excluded, decisions: [] } : {}) };
    }

    onLog?.(`[사실검증] 자료에 없는 수치 ${facts.length}건 — 해당 문단만 다시 씁니다${byEvidence?.excluded ? ` (답 상자·FAQ 문단 ${byEvidence.excluded}개는 제외)` : ''}`);
    const raw = await callLLM(buildPrompt(facts, reference, keyword));
    let repairs = parseRepairs(raw);
    if (repairs.length === 0) {
      onLog?.('[사실검증] 고칠 내용 없음 — 원본 그대로 발행');
      return { html, checked: facts.length, repaired: 0, ...(byEvidence ? { excluded: byEvidence.excluded, decisions: [] } : {}) };
    }

    // v3.8.761 — 채택 게이트: 고치라고 한 값 말고 보호 값·판단 기준이 사라지거나 근거 없는 값이 새로 들어온 교체본은 받지 않는다
    let decisions: RepairDecision[] | undefined;
    if (evidence) {
      const issueByIndex = new Map<number, string[]>();
      for (const f of facts) issueByIndex.set(f.paragraphIndex, [...(issueByIndex.get(f.paragraphIndex) || []), f.token]);
      const zones = protectedZones(html);
      const paragraphs = splitParagraphs(html);
      repairs = repairs.filter((r) => { const p = paragraphs[Number(r.paragraphIndex)]; return p && !inZone(zones, p.start); });   // 답 상자·FAQ 교체본은 무조건 버린다
      const gated = gateRepairs(html, repairs, evidence, { issueByIndex, ...(input.isCoreAnswer ? { isCoreAnswer: input.isCoreAnswer } : {}), ...(input.claimSupport ? { claimSupport: input.claimSupport } : {}) });
      decisions = gated.decisions;
      const rejected = gated.decisions.filter((d) => !d.accepted);
      if (rejected.length) onLog?.(`[사실검증] 교체본 ${rejected.length}개 거부 — ${rejected.map((d) => `[${d.paragraphIndex}] ${d.reason}`).join(' / ').slice(0, 300)}`);
      repairs = gated.accepted;
      if (repairs.length === 0) return { html, checked: facts.length, repaired: 0, decisions, excluded: byEvidence?.excluded ?? 0 };
    }

    const repaired = applyFactRepairs(html, repairs);
    if (!repaired || repaired.length < Math.floor(html.length * 0.5)) {
      // 결과가 반토막 났다면 뭔가 잘못된 것이다 — 원본을 쓴다
      onLog?.('[사실검증] 결과가 비정상적으로 짧아 원본을 유지합니다');
      return { html, checked: facts.length, repaired: 0, ...(decisions ? { decisions } : {}) };
    }

    onLog?.(`[사실검증] ${repairs.length}개 문단 수정 완료`);
    return { html: repaired, checked: facts.length, repaired: repairs.length, ...(decisions ? { decisions, excluded: byEvidence?.excluded ?? 0 } : {}) };
  } catch (e: any) {
    // 검수 때문에 발행이 멈추면 안 된다 — 조용히 원본으로 돌아간다
    onLog?.(`[사실검증] 건너뜀 (${e?.message || e}) — 원본 그대로 발행합니다`);
    return fallback;
  }
}
