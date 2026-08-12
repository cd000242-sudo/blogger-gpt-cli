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
}

export interface GuardFactsResult {
  html: string;
  /** 근거를 못 찾아 검사한 수치 개수 */
  checked: number;
  /** 실제로 고쳐진 문단 수 */
  repaired: number;
}

/** 한 번에 고칠 문단 상한 — 이보다 많으면 글 전체가 문제라 부분 수정이 의미 없다 */
const MAX_REPAIR_PARAGRAPHS = 12;

/** 근거 문자열 상한 — 토큰마다 includes 를 도는 만큼 무한정 키우지 않는다 */
const MAX_REFERENCE_CHARS = 60000;

export interface GroundingSources {
  /** 팩트체크(퍼플렉시티/네이버) 요약 */
  factContext?: string;
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
export async function guardFacts(input: GuardFactsInput): Promise<GuardFactsResult> {
  const { html, reference, keyword, callLLM, onLog } = input;
  const fallback: GuardFactsResult = { html, checked: 0, repaired: 0 };

  try {
    const facts = findUngroundedFacts(html, reference, { keyword });
    if (facts.length === 0) {
      onLog?.('[사실검증] 근거 없는 수치 없음 — 추가 호출 없이 통과');
      return fallback;
    }

    onLog?.(`[사실검증] 자료에 없는 수치 ${facts.length}건 — 해당 문단만 다시 씁니다`);
    const raw = await callLLM(buildPrompt(facts, reference, keyword));
    const repairs = parseRepairs(raw);
    if (repairs.length === 0) {
      onLog?.('[사실검증] 고칠 내용 없음 — 원본 그대로 발행');
      return { html, checked: facts.length, repaired: 0 };
    }

    const repaired = applyFactRepairs(html, repairs);
    if (!repaired || repaired.length < Math.floor(html.length * 0.5)) {
      // 결과가 반토막 났다면 뭔가 잘못된 것이다 — 원본을 쓴다
      onLog?.('[사실검증] 결과가 비정상적으로 짧아 원본을 유지합니다');
      return { html, checked: facts.length, repaired: 0 };
    }

    onLog?.(`[사실검증] ${repairs.length}개 문단 수정 완료`);
    return { html: repaired, checked: facts.length, repaired: repairs.length };
  } catch (e: any) {
    // 검수 때문에 발행이 멈추면 안 된다 — 조용히 원본으로 돌아간다
    onLog?.(`[사실검증] 건너뜀 (${e?.message || e}) — 원본 그대로 발행합니다`);
    return fallback;
  }
}
