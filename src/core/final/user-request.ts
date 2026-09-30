/**
 * user-request — 이 글에만 적용할 **사용자 요청사항**을 프롬프트에 안전하게 싣는다. (v3.8.718)
 *
 * ## 왜 만들었나
 * 사장님: "실제 발행할 때도 API 한테 요청사항을 적어주는 기능도 추가하면 어떠니?
 *          경험도 넣을 수 있는데 이거라고 못 넣을까?"
 *
 * 맞는 지적이었다. 손님(변호사)이 보낸 요청이 이런 모양이다 —
 * "이혼 사유 나열 말고, 갑자기 통보받은 사람이 끝까지 읽게. 재산 처분·계좌 이동 확인법 포함.
 *  뻔한 소제목 반복 금지." 지금은 이걸 넣을 자리가 없어서 사람이 매번 손으로 반영해야 했다.
 *
 * 경험 메모(v3.8.392)가 **무엇을 겪었나**라면, 이건 **어떻게 써달라**다. 둘은 다른 칸이다.
 *
 * ## 왜 기존 sanitize.js 를 그대로 안 쓰나
 * 외부유입의 `sanitizeUserPattern` 은 200자를 넘으면 **throw** 하고,
 * `appendUserNoteSafely` 는 그걸 잡아서 **원본 프롬프트를 그대로 돌려준다** — 즉 조용히 사라진다.
 * 짧은 패턴 한 줄에는 맞지만, 요청사항은 보통 그보다 길다.
 * 여기서는 **버리지 않고 다듬는다.** 자른 길이·지운 토큰을 전부 돌려줘서 로그가 말할 수 있게 한다.
 *
 * ## 우선순위 (v3.8.776 개정)
 * 사실 근거·안전 > **작성자 명시 요구** > 핵심 검색 의도 > 기본 편집 규칙(FAQ 5개·표 3개·자동 CTA) > 말투 취향.
 * 요청은 사실을 덮어쓰지 못하지만(요청 속 수치는 근거가 아니다) 기본 편집 규칙은 덮어쓴다 — user-requirement.ts.
 * 부딪힐 만한 요청은 `detectRequestConflicts` 가 미리 짚어 화면에 띄운다 — 막지는 않는다.
 */

/** 요청사항 최대 길이 — 넘으면 버리지 않고 자른다 */
export const USER_REQUEST_MAX_LEN = 1500;

/**
 * 지시 탈취에 쓰이는 토큰 — 통째로 막지 않고 **무해하게 바꾼다.**
 * 요청사항에 "```" 이 들어갔다고 요청 전체를 버리면 사용자는 이유도 모른 채 무시당한다.
 */
/**
 * ⚠️ 각 규칙은 **그 표현만** 지운다. 줄 끝까지(`[^\n]*`) 먹으면 같은 줄에 있던
 * 멀쩡한 요청까지 사라진다 — 실측(2026-09-11)에서 요청 전체가 빈 문자열이 됐다.
 * 지우는 건 '지시를 덮어쓰려는 문구' 하나지 문장 전체가 아니다.
 */
const NEUTRALIZE: Array<{ pattern: RegExp; replacement: string; label: string }> = [
  { pattern: /```+/g, replacement: '', label: '코드펜스' },
  { pattern: /<\|[^|>]*\|>/g, replacement: '', label: '특수토큰' },
  // 줄 처음뿐 아니라 문장 중간에 박힌 것도 지운다 — 코드펜스를 걷어내면 중간으로 내려온다
  { pattern: /(^|[\s>”"'(\[])(system|assistant|developer|사용자|시스템)\s*:/gi, replacement: '$1', label: '역할지정' },
  {
    // "이전 지시 무시하고" / "위 규칙 다 잊어" — 그 어구만 지운다
    pattern: /(이전|위의?|앞의?)\s*(지시|프롬프트|규칙|명령)\w*\s*(사항)?\s*(은|는|를|을)?\s*(전부|모두|다)?\s*(무시하고|무시해|무시|잊어버리고|잊어|잊고)/g,
    replacement: '',
    label: '지시무시',
  },
  { pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/gi, replacement: '', label: '지시무시' },
  { pattern: /disregard\s+(all\s+)?(previous|prior|above)\s+\w+/gi, replacement: '', label: '지시무시' },
  { pattern: /<\s*\/?\s*script[^>]*>/gi, replacement: '', label: '스크립트태그' },
  { pattern: /\b(javascript|data)\s*:/gi, replacement: '', label: '위험스킴' },
];

export interface NormalizedUserRequest {
  /** 프롬프트에 실을 본문 — 비었으면 요청사항 없음 */
  text: string;
  /** 원본 길이 */
  originalLength: number;
  /** 길이 때문에 잘렸나 */
  truncated: boolean;
  /** 무해화로 지워진 것들 (로그용) */
  removed: string[];
}

/** 요청사항을 프롬프트에 실을 수 있는 모양으로 다듬는다 */
export function normalizeUserRequest(raw: unknown): NormalizedUserRequest {
  const source = typeof raw === 'string' ? raw : '';
  const originalLength = source.length;
  if (!source.trim()) {
    return { text: '', originalLength, truncated: false, removed: [] };
  }

  const removed: string[] = [];
  let text = source;
  for (const rule of NEUTRALIZE) {
    if (rule.pattern.test(text)) {
      removed.push(rule.label);
      text = text.replace(rule.pattern, rule.replacement);
    }
    rule.pattern.lastIndex = 0;
  }

  // 제어문자 제거 + 줄바꿈 정리 (빈 줄 3개 이상은 2개로)
  text = text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const truncated = text.length > USER_REQUEST_MAX_LEN;
  if (truncated) text = text.slice(0, USER_REQUEST_MAX_LEN).trim();

  return { text, originalLength, truncated, removed: [...new Set(removed)] };
}

export interface RequestConflict {
  /** 부딪히는 지점 */
  kind: 'structure' | 'length' | 'fact' | 'language';
  /** 사용자에게 보일 한 줄 */
  message: string;
}

/**
 * 시스템 규칙과 부딪힐 요청을 미리 짚는다. **막지 않는다** — 알려만 준다.
 * 여기 걸린 요청이라고 무시되는 것도 아니다. 규칙과 충돌하는 부분만 규칙이 이긴다.
 */
export function detectRequestConflicts(text: string): RequestConflict[] {
  const t = String(text || '');
  if (!t.trim()) return [];
  const found: RequestConflict[] = [];

  if (/소제목\s*(없이|빼|제거|쓰지\s*말)|h2\s*(없이|빼)/i.test(t)) {
    found.push({
      kind: 'structure',
      message: '소제목을 빼달라는 요청이 있습니다 — 소제목은 검색 노출과 이미지 배치에 쓰여 유지됩니다. 대신 "뻔한 소제목 반복 금지"처럼 적으면 반영됩니다.',
    });
  }
  if (/(\d{3,4})\s*자\s*(내외|이내|정도|로)|짧게\s*(써|작성)/.test(t) && !/\d{4,}\s*자/.test(t)) {
    found.push({
      kind: 'length',
      message: '짧은 분량 요청이 있습니다 — 분량은 발행 설정이 정합니다. 크게 줄이시려면 설정의 분량 값을 함께 바꿔 주세요.',
    });
  }
  // v3.8.776 — "가상 사례로 계산" 은 가정 예시(허용 — 가정이라고 밝히고 쓴다)다. 지어낸 통계·판례·출처만 사실 위반으로 본다
  if (/(지어내|만들어\s*내|가상의?\s*(통계|판례)|없는\s*(사실|출처)|출처\s*없이)/.test(t)) {
    found.push({
      kind: 'fact',
      message: '확인되지 않은 내용을 쓰라는 요청으로 보입니다 — 사실 확인 규칙이 우선이라 따르지 않습니다.',
    });
  }
  // v3.8.776 — 값을 단정해 달라는 요청("지원금은 100만원이라고 써 주세요")은 근거와 맞을 때만 쓴다
  if (/\d[\d,]*(?:\.\d+)?\s*(?:억\s*원|만\s*원|원|%|퍼센트|개월|년|명)\s*(?:이?라고|으?로|이?라)\s*(?:써|적|작성|표기|명시)/.test(t) && !/가상|가정|예시|사례/.test(t)) {
    found.push({
      kind: 'fact',
      message: '값을 정해서 써 달라는 요청이 있습니다 — 근거와 같을 때만 그 값을 씁니다. 근거와 다르면 근거 값을 쓰고 보류(사람 확인)로 넘깁니다.',
    });
  }
  if (/(영어로|english\s*로|일본어로|중국어로)\s*(써|작성|번역)/i.test(t)) {
    found.push({
      kind: 'language',
      message: '출력 언어 변경 요청이 있습니다 — 언어는 발행 설정이 정합니다. 설정에서 바꿔 주세요.',
    });
  }

  return found;
}

/**
 * 프롬프트에 붙일 블록 — 정본은 user-requirement.writerRequirementBlock(v3.8.776) 하나다.
 * 예전(v3.8.718)에는 "참고 — 구조 규칙과 부딪히면 규칙을 따른다" 자격이라 FAQ 빼기·표 넣기 같은 명시 요구가 기본 규칙에 졌다(감사 775).
 * 이제 우선순위는 사실 근거 > 작성자 명시 요구 > 기본 편집 규칙. 제목·소제목·본문·에이전트 지시서가 같은 문구를 쓴다.
 * 비어 있으면 빈 문자열 — 호출부가 조건 없이 붙여도 예전과 똑같이 동작한다.
 */
export function buildUserRequestBlock(raw: unknown): string {
  const { text } = normalizeUserRequest(raw);
  if (!text) return '';
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { parseUserRequirements, writerRequirementBlock } = require('./user-requirement');
  return writerRequirementBlock(parseUserRequirements(raw));
}

/** 로그 한 줄 — 무엇이 실렸는지 사람이 읽게 */
export function describeUserRequest(raw: unknown): string {
  const n = normalizeUserRequest(raw);
  if (!n.text) return '';
  const parts = [`작성자 요청 ${n.text.length}자 반영`];
  if (n.truncated) parts.push(`(${n.originalLength}자에서 잘림)`);
  if (n.removed.length) parts.push(`· 안전을 위해 제거: ${n.removed.join(', ')}`);
  return parts.join(' ');
}
