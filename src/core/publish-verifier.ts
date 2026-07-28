/**
 * 발행 검수 게이트 (v3.8.384)
 *
 * 배경 — 2026-07-28 실측으로 확인된 "발행은 성공인데 검색에서 죽는 글"의 원인들:
 *   · 2026-07-26 발행 6편: 메타디스크립션이 JSON-LD 원문 그대로 저장 (총 11편)
 *     원인: 메타 생성 3함수가 태그만 벗기고 <script> 안의 JSON 본문을 남김
 *   · 본문 이미지 0개인 발행글 145편 — 이미지 실패가 발행을 막지 않고 조용히 통과
 *   · yourdomain.com/example.com 플레이스홀더 29건, "색인(노출) 신호…" 서술 노출
 *   · 빈 앵커 href="#" 41건 (장식용 onclick=return false 는 정상)
 *   · 47~598자 링크 스텁 10편이 index + 광고 유닛 부착 상태로 라이브
 *
 * 원칙:
 *   - BLOCK 은 "정상 파이프라인이 절대 만들지 않는 확실한 결함"만. 애매하면 WARN.
 *     (게이트 오탐으로 발행이 전면 정지되는 것이 최악 — 확실한 결함만 막으면 오탐이 없다)
 *   - 게이트 자체의 버그는 발행을 막지 못한다: verifyBeforePublish 는 절대 throw 하지 않는다.
 *   - 비상 스위치: 배선부에서 env VERIFY_GATE='off' 로 전체 우회 가능.
 */

export interface VerifyIssue {
  code: string;
  severity: 'block' | 'warn';
  message: string;
}

export interface VerifyResult {
  /** 이슈가 하나도 없으면 true */
  ok: boolean;
  /** block 등급 이슈가 있으면 true — 발행을 중단해야 한다 */
  blocked: boolean;
  issues: VerifyIssue[];
  summary: string;
}

export interface VerifyInput {
  platform?: string;
  title?: string;
  html?: string;
  metaDescription?: string;
  /** 내부링크 검사용. 없으면 해당 검사 생략 */
  siteUrl?: string;
}

/**
 * HTML에서 사람이 읽는 텍스트만 남긴다.
 * ⚠️ 태그만 벗기는 replace(/<[^>]*>/g)는 <script> 안의 JSON-LD 본문을 남긴다 —
 *    그것이 2026-07-26 메타디스크립션 오염 사고의 원인이다. 반드시 이 함수를 쓸 것.
 */
export function stripNonProse(html: string): string {
  return String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#\d+;|&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * SEO 텍스트(제목/메타)가 JSON 원문으로 오염됐는지 판정.
 *
 * ⚠️ 이전 구현은 `^["']?[{[]` 만 봐서 대괄호로 시작하는 **정상 한국어 메타**를 오염으로 오인했다.
 *    적대 감사 실측: "[2026 최신] 청년월세 …", "[속보] …", "{청년월세} …" 가 전부 오탐.
 *    이 사이트 제목 패턴이고, 외부 페이지 메타를 가져오는 경로(url-content-generator)에서는
 *    한국 언론의 "[단독]" 접두가 흔하다. 오탐이 나면 사람이 쓴 메타가 지워지고
 *    캡션·목차 뒤범벅으로 대체된다.
 *
 * 판정: ①파싱되는 JSON 객체/배열 ②잘린 JSON(스키마 키가 따옴표 포함으로 등장)
 *       ③`{` 로 시작하면서 "키": 형태가 있는 것. `[` 단독 시작은 오염이 아니다.
 *
 * repair 와 verifier 가 반드시 같은 판정을 써야 한다 — 갈리면 한쪽은 고치고
 * 한쪽은 결함이라고 보고하는 불일치가 생긴다.
 */
export function looksLikeJsonPollution(text: unknown): boolean {
  const t = String(text ?? '').trim();
  if (!t) return false;
  try {
    const v = JSON.parse(t);
    if (v && typeof v === 'object') return true;
  } catch { /* 잘린 JSON 일 수 있으니 아래로 */ }
  if (/"@context"|"@graph"|"@type"/.test(t)) return true;
  if (/^["']?\{/.test(t) && /"[^"]+"\s*:/.test(t)) return true;
  return false;
}

// 실측된 금지 문자열 — 각각 실제 발행 사고에서 나온 패턴이다
const BANNED: Array<[string, RegExp]> = [
  ['yourdomain.com 플레이스홀더', /yourdomain\.com/i],
  ['example.com 플레이스홀더', /example\.com/i],
  ['SEO 프로세스 서술 노출', /색인\(노출\)\s*신호/],
  ['본문 플레이스홀더 대괄호', /\[삽입|\[여기에|\[링크\]|\[이미지\]/],
];

/** 빈 앵커 검사: href="#" 인데 장식(onclick=return false)이 아닌 것만 결함 */
function countBrokenAnchors(html: string): number {
  let n = 0;
  for (const m of html.matchAll(/<a\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/href\s*=\s*["']#["']/i.test(tag)) continue;
    if (/onclick\s*=\s*["']return false/i.test(tag)) continue;
    n++;
  }
  return n;
}

const MIN_BODY_CHARS = 1000;

/**
 * 발행 직전 검수. 절대 throw 하지 않는다.
 */
export function verifyBeforePublish(input: VerifyInput): VerifyResult {
  const issues: VerifyIssue[] = [];
  try {
    const html = String(input.html || '');
    const title = String(input.title || '');

    // ── BLOCK: 확실한 결함 ──
    if (input.metaDescription && looksLikeJsonPollution(input.metaDescription)) {
      issues.push({
        code: 'META_JSON', severity: 'block',
        message: `메타디스크립션이 JSON 원문입니다: "${String(input.metaDescription).slice(0, 60)}…"`,
      });
    }
    for (const [name, re] of BANNED) {
      const hits = (html.match(new RegExp(re.source, re.flags + 'g')) || []).length;
      if (hits > 0) {
        issues.push({ code: 'BANNED_STRING', severity: 'block', message: `${name} ${hits}건` });
      }
    }
    const broken = countBrokenAnchors(html);
    if (broken > 0) {
      issues.push({ code: 'EMPTY_ANCHOR', severity: 'block', message: `빈 앵커 href="#" ${broken}건 (장식용 제외)` });
    }
    const prose = stripNonProse(html);
    if (prose.length < MIN_BODY_CHARS) {
      issues.push({
        code: 'THIN_BODY', severity: 'block',
        message: `본문 실텍스트 ${prose.length}자 < ${MIN_BODY_CHARS}자 — 링크 스텁 의심`,
      });
    }
    if (!/<img\b/i.test(html)) {
      issues.push({ code: 'NO_IMAGE', severity: 'block', message: '본문 이미지 0개 — 이미지 파이프라인 실패 의심' });
    }

    // ── WARN: 판단 여지가 있는 것 ──
    if (input.siteUrl) {
      let host = '';
      try { host = new URL(String(input.siteUrl)).host.replace(/^www\./, ''); } catch { /* 무시 */ }
      if (host && !new RegExp('href\\s*=\\s*["\'][^"\']*' + host.replace(/\./g, '\\.'), 'i').test(html)) {
        issues.push({ code: 'NO_INTERNAL_LINK', severity: 'warn', message: `내부링크 0개 (${host}) — 삽입 로직 회귀 의심` });
      }
    }
    if (title && (title.length < 10 || title.length > 60)) {
      issues.push({ code: 'TITLE_LENGTH', severity: 'warn', message: `제목 ${title.length}자 (권장 10~60자)` });
    }
  } catch (e: any) {
    // 게이트 버그가 발행을 막으면 안 된다 — 검사 실패는 경고 하나로 축소
    issues.push({ code: 'GATE_ERROR', severity: 'warn', message: `검수 실패(발행 계속): ${e?.message || e}` });
  }

  const blocked = issues.some(i => i.severity === 'block');
  const summary = issues.length === 0
    ? '전 항목 통과'
    : issues.map(i => `${i.severity === 'block' ? '⛔' : '⚠️'}${i.code}`).join(' ');
  return { ok: issues.length === 0, blocked, issues, summary };
}
