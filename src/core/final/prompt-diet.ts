/**
 * 🥗 Writer 프롬프트 다이어트 (v3.8.734)
 *
 * 감사 실측: 본문 프롬프트 44,870자 중 근거는 24%(쓸 만한 것은 6,500자). 나머지는 규칙이었다.
 * 재 보니 그 규칙의 상당수가 **같은 줄의 되풀이**였다 — 모드 플러그인이 절마다 같은 머리말
 * (YMYL 안내 · E-E-A-T 강제 규칙 · SEO 4원칙 · 고지 문구)을 통째로 다시 붙인다. 절이 5개면 5번이다.
 * 되풀이한다고 더 잘 지키지 않는다. 읽을 것만 늘어 정작 근거에 쓸 주의가 줄어든다.
 *
 * 규칙을 새로 쓰지 않는다(수백 편이 나가는 문장이다). **같은 줄이 세 번 넘게 나오면 첫 번째만 남긴다.**
 *   · 근거 구간(Research Packet ~ 근거 항목)은 건드리지 않는다 — 자료는 한 글자도 빼지 않는다.
 *   · JSON 출력 예시·HTML 조각은 건드리지 않는다 — 형식 예시는 되풀이가 뜻이다.
 *   · 절마다 다른 줄(역할·핵심·필수 요소)은 그대로 남는다.
 */

export interface DietResult { text: string; removedChars: number; removedLines: number }

const SEPARATOR = /^[━─=\-]{10,}$/;

export function dietPrompt(prompt: string): DietResult {
  const source = String(prompt || '');
  // 근거 구간 보호: 패킷 머리 ~ 근거 정책 머리(## FACT INTEGRITY) 또는 컨텍스트 닫는 줄
  const from = source.indexOf('[RESEARCH PACKET');
  let to = -1;
  if (from >= 0) {
    const policy = source.indexOf('## FACT INTEGRITY', from);
    const close = source.indexOf('\n=====\n', from);
    to = [policy, close].filter((n) => n > from).sort((a, b) => a - b)[0] ?? -1;
  }
  const head = from >= 0 && to > from ? source.slice(0, from) : '';
  const protectedPart = from >= 0 && to > from ? source.slice(from, to) : '';
  const tail = from >= 0 && to > from ? source.slice(to) : source;

  const counts = new Map<string, number>();
  const eligible = (t: string) => t.length >= 24 && !/^[{["<\]}]/.test(t) && !SEPARATOR.test(t);
  for (const part of [head, tail]) for (const line of part.split('\n')) { const t = line.trim(); if (eligible(t)) counts.set(t, (counts.get(t) || 0) + 1); }

  const seen = new Set<string>();
  let removedLines = 0;
  const slim = (part: string): string => part.split('\n').map((line) => {
    const t = line.trim();
    if (SEPARATOR.test(t)) return '━━━━━━━━';
    if (!eligible(t) || (counts.get(t) || 0) < 3) return line;
    if (seen.has(t)) { removedLines += 1; return null; }
    seen.add(t);
    return line;
  }).filter((l): l is string => l !== null).join('\n').replace(/\n{3,}/g, '\n\n');

  const text = `${slim(head)}${protectedPart}${slim(tail)}`;
  return { text, removedChars: Math.max(0, source.length - text.length), removedLines };
}
