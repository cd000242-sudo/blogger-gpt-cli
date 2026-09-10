/**
 * 🔒 비서에게 넘기기 전에 비밀을 지운다 (v3.8.713)
 *
 * ## 왜 이 파일이 먼저인가
 * AI 비서는 앱의 상태와 최근 로그를 읽고 답한다. 그 내용이 **에이전트 CLI 나 API 로 나간다.**
 * 로그 한 줄에 API 키가 섞여 있으면 그 순간 키가 밖으로 나가는 것이다.
 * 그래서 이 모듈은 비서 기능의 관문이고, 새는 패턴 하나가 곧 사고다 — 단위 테스트가 붙어 있다.
 *
 * ## 원칙
 *   · 지우되 **문장은 남긴다.** `sk-***` 처럼 자리는 남겨야 비서가 "키가 있긴 하다"를 안다.
 *   · 의심스러우면 지운다. 진단이 조금 흐려지는 것보다 키가 새는 게 훨씬 나쁘다.
 *   · 값이 아니라 **모양**으로 잡는다. 키 이름 목록에 의존하면 새 키가 생길 때마다 샌다.
 */

/** 지울 것들 — 순서대로 적용한다. 앞의 규칙이 이미 지운 자리는 뒤 규칙이 건드리지 않는다. */
const RULES: Array<{ re: RegExp; to: string }> = [
  // ── 제공자별 키 모양 ─────────────────────────────────────
  { re: /\bsk-[A-Za-z0-9_-]{8,}/g, to: 'sk-***' },                       // OpenAI / Anthropic 계열
  { re: /\bAIza[A-Za-z0-9_-]{10,}/g, to: 'AIza***' },                    // Google
  { re: /\bpplx-[A-Za-z0-9]{8,}/g, to: 'pplx-***' },                     // Perplexity
  { re: /\bghp_[A-Za-z0-9]{8,}/g, to: 'ghp_***' },                       // GitHub
  { re: /\bya29\.[A-Za-z0-9._-]{10,}/g, to: 'ya29.***' },                // Google 액세스 토큰
  { re: /\b1\/\/[A-Za-z0-9._-]{20,}/g, to: '1//***' },                   // Google 리프레시 토큰
  // ── 헤더·폼·JSON 에 실린 값 ──────────────────────────────
  { re: /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, to: '$1 ***' },
  {
    re: /\b([A-Za-z0-9_]*(?:key|token|secret|password|passwd|pwd|credential|auth)[A-Za-z0-9_]*)\s*[:=]\s*("?)([^\s"',}&]{4,})\2/gi,
    to: '$1=***',
  },
  // ── 주소에 붙은 값 ───────────────────────────────────────
  { re: /([?&](?:key|token|access_token|api_key|apikey|secret|password)=)[^\s&#"']+/gi, to: '$1***' },
  { re: /(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, to: '$1***:***@' },        // http://user:pass@host
  // ── 사람을 가리키는 것 ───────────────────────────────────
  { re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, to: '***@***' },
  { re: /\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b/g, to: '010-****-****' },
  // ── 길고 무의미한 덩어리 (남은 토큰) ─────────────────────
  { re: /\b[A-Za-z0-9_-]{40,}\b/g, to: '***' },
];

/** 문자열 하나에서 비밀을 지운다. */
export function redactText(input: unknown): string {
  let out = String(input ?? '');
  for (const { re, to } of RULES) out = out.replace(re, to);
  return out;
}

/**
 * 로그 꼬리를 비서에게 보낼 모양으로 만든다.
 * 줄 수와 줄 길이를 함께 자른다 — 프롬프트가 길어지면 할당량이 녹는다.
 */
export function redactLogLines(lines: unknown[], opts: { maxLines?: number; maxChars?: number } = {}): string[] {
  const maxLines = opts.maxLines ?? 120;
  const maxChars = opts.maxChars ?? 300;
  return (Array.isArray(lines) ? lines : [])
    .slice(-maxLines)
    .map((line) => redactText(line).slice(0, maxChars))
    .filter((line) => line.trim().length > 0);
}

/**
 * 진단 객체 전체를 훑어 지운다 (키 이름이 아니라 **값의 모양**으로).
 *
 * 값이 비밀처럼 생겼으면 지운다. 불리언·숫자는 그대로 둔다 —
 * "키가 있다/없다"는 비서가 알아야 하고, 그 자체로는 비밀이 아니다.
 */
export function redactDeep<T>(value: T, depth = 0): T {
  if (depth > 6) return '***' as unknown as T;
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return redactText(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, depth + 1)) as unknown as T;
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // 키 이름이 비밀을 가리키면 값의 모양과 무관하게 존재 여부만 남긴다
      if (/key|token|secret|password|credential/i.test(k) && typeof v === 'string' && v.trim()) {
        out[k] = '***';
        continue;
      }
      out[k] = redactDeep(v, depth + 1);
    }
    return out as unknown as T;
  }
  return value;
}
