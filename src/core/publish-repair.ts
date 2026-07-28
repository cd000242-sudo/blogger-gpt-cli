/**
 * 발행 자동 수리 (v3.8.384)
 *
 * 설계 원칙 — 사용자 지시(2026-07-28): **검수 때문에 발행이 막히는 일은 절대 없어야 한다.**
 *   따라서 이 모듈은 결함을 "차단"하지 않고 "고쳐서 통과"시킨다.
 *   특히 스케줄 발행(schedule-manager.ts:329)이 이 경로를 타므로, 새벽에 차단이 걸리면
 *   아무도 모르는 사이 예약 글이 유실된다. 차단은 선택지가 아니다.
 *
 * 고칠 수 있는 것은 고치고(repairs), 고칠 수 없는 것은 알리기만 한다(warnings).
 * 어떤 경우에도 발행 흐름을 중단시키지 않는다.
 *
 * 수리 대상 — 전부 2026-07-28 실측으로 확인된 실제 사고 패턴:
 *   META_JSON       메타디스크립션에 JSON-LD 원문 (11편) → 본문에서 재생성
 *   DEAD_CTA        yourdomain.com CTA 버튼 (29건)      → 죽은 링크 블록 제거
 *   FAKE_SCHEMA_URL JSON-LD @id 가 example.com (5편)    → 실제 사이트 URL로 교체
 *   SEO_NARRATION   "색인(노출) 신호를 강화했습니다"      → 문단 통째 제거
 *   EMPTY_ANCHOR    빈 앵커 href="#" (41건)             → 링크만 벗기고 텍스트 보존
 *
 * 수리 불가(경고만): 본문 이미지 0개, 본문 과소 — 내용을 지어낼 수는 없다.
 */
import { stripNonProse, looksLikeJsonPollution } from './publish-verifier';

export interface RepairAction {
  code: string;
  detail: string;
  /** 이 수리로 줄어든(또는 늘어난) 글자 수 */
  delta: number;
}

export interface RepairWarning {
  code: string;
  detail: string;
}

export interface RepairOutcome {
  html: string;
  /** 재생성된 경우에만 값이 바뀐다. 입력이 없었으면 undefined 그대로 */
  metaDescription: string | undefined;
  repairs: RepairAction[];
  warnings: RepairWarning[];
  /** 로그 한 줄 요약 */
  summary: string;
}

export interface RepairInput {
  html?: string;
  metaDescription?: string;
  /** JSON-LD 가짜 URL 교체 및 내부링크 검사에 쓴다 */
  siteUrl?: string;
}

/** 한 번의 수리가 본문에서 지울 수 있는 최대 비율 — 넘으면 그 수리를 포기한다 */
const MAX_DELETION_RATIO = 0.3;
const MIN_BODY_CHARS = 1000;

// ───────────────────────── 공통 안전망: 태그 균형 ─────────────────────────
//
// 적대 감사(2026-07-28)에서 확인: 경계를 추측하는 수리기가 정상 글의 섹션을 통째로
// 지우고 닫히지 않은 <div> 를 남겼다(H2·이미지·표 소실, 2,896자 삭제, 경고 0건).
// 개별 수리기를 고치는 것과 별개로, "균형이 바뀌면 무조건 되돌린다"는 최종 방어선을 둔다.

const BALANCE_TAGS = ['div', 'table', 'tr', 'td', 'th', 'ul', 'ol', 'li',
  'section', 'center', 'p', 'a', 'figure', 'span'];

/** 태그별 (여는 수 - 닫는 수). 0이 아닌 것만 담는다 */
export function tagBalance(html: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of BALANCE_TAGS) {
    const open = (html.match(new RegExp('<' + t + '(?=[\\s>/])', 'gi')) || []).length;
    const close = (html.match(new RegExp('</' + t + '\\s*>', 'gi')) || []).length;
    if (open !== close) out[t] = open - close;
  }
  return out;
}

/** 수리 전후로 태그 균형이 달라졌는가 */
export function balanceChanged(before: string, after: string): boolean {
  const b = tagBalance(before), a = tagBalance(after);
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  for (const k of keys) if ((b[k] ?? 0) !== (a[k] ?? 0)) return true;
  return false;
}

/** 짝이 맞는 닫는 태그를 찾는다 (대소문자 무시 + 중첩 고려). 없으면 -1 */
function findMatchingClose(html: string, openEnd: number, tag: string): number {
  const re = new RegExp(`<(/?)${tag}(?=[\\s>/])[^>]*>`, 'gi');
  re.lastIndex = openEnd;
  let depth = 1, m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[1] === '/') { depth--; if (depth === 0) return m.index + m[0].length; }
    else depth++;
    if (depth > 50) return -1; // 비정상 중첩
  }
  return -1;
}

// ───────────────────────── 메타디스크립션 재생성 ─────────────────────────

/**
 * 본문 앞의 메타 배지 바를 걷어낸다.
 * 예: "🔄 최신 업데이트 … 📅 발행 … ⏱ 약 32분 소요 📊 출처 2개 인용"
 * 이걸 두면 모든 글의 설명이 같은 문구로 시작해 검색결과에서 구분되지 않는다.
 */
export function stripBadgeBar(text: string): string {
  const src = String(text || '');
  // ⚠️ 이전 구현의 `[^·|]*` 는 · 나 | 를 만날 때까지, 없으면 **문서 끝까지** 먹었다.
  //    적대 감사 실측: <h2>📅 발행일정 안내</h2> 같은 평범한 소제목 하나로
  //    산문 20,800자 → 1자가 되어 메타 재생성이 조용히 포기됐다(= JSON 오염이 그대로 발행).
  //    이 사이트 주제(지원금·상품권)에서 "발행일/발행 규모"는 최빈 어휘다.
  //    → 수량자에 상한을 두고, 문장 종결자와 줄바꿈에서 멈추게 한다.
  //    u 플래그: 없으면 이모지가 코드유닛으로 분해돼 고아 서로게이트가 남는다.
  const out = src
    .replace(/🔄[\s\S]{0,60}?📅[\s\S]{0,60}?⏱[\s\S]{0,60}?📊\s*출처\s*\d+개\s*인용/gu, ' ')
    .replace(/[🔄📅⏱📊]\s*(?:최신 업데이트|발행|약\s*\d+분\s*소요|출처\s*\d+개\s*인용)[^·|\n.!?。]{0,40}/gu, ' ')
    .replace(/본 정보는 정기적으로 검토·갱신됩니다/gu, ' ')
    // 고아 서로게이트 제거 — 남으면 isWellFormed()=false, encodeURIComponent 가 throw 한다
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
    .replace(/\s+/g, ' ').trim();

  // 방어선: 배지 제거가 본문의 절반 이상을 먹었으면 오작동이다 — 원본을 쓴다
  const plain = src.replace(/\s+/g, ' ').trim();
  if (plain.length > 200 && out.length < plain.length * 0.5) return plain;
  return out;
}

// 앞 문장을 받는 접속으로 시작하면 설명 첫 문장으로 부적합하다.
// ⚠️ \b 는 한글 뒤에서 경계로 작동하지 않는다 — 공백/쉼표를 명시적으로 요구해야 한다.
const CONNECTIVE = /^(여기에|그리고|또한|하지만|그러나|반면|이때|이처럼|이런|그런|즉|따라서|다만|또|게다가|한편)(\s|,)/;

/** 본문 산문에서 120~155자 메타디스크립션을 만든다 */
export function buildMetaDescription(prose: string): string {
  const clean = stripBadgeBar(prose);
  let sentences = clean.split(/(?<=[.!?。])\s+/).map(s => s.trim()).filter(s => s.length > 12);
  while (sentences.length > 1 && CONNECTIVE.test(sentences[0] as string)) sentences = sentences.slice(1);

  let out = '', used = 0;
  for (const s of sentences) {
    const next = out ? out + ' ' + s : s;
    if (next.length > 155) break;
    out = next; used++;
    if (out.length >= 120) break;
  }
  // 너무 짧으면(구글 표시폭 대비 손해) 다음 문장을 붙여 155자에서 자른다
  if (out.length < 100 && sentences[used]) {
    out = (out + ' ' + sentences[used]).slice(0, 155).replace(/\s+\S*$/, '') + '…';
  }
  if (!out) out = clean.slice(0, 150);
  if (out.length > 155) out = out.slice(0, 152).replace(/\s+\S*$/, '') + '…';
  return out.trim();
}

// ───────────────────────── 개별 수리기 ─────────────────────────

/** ld+json 블록 안의 가짜 도메인 URL을 실제 사이트 URL로 교체 */
function repairFakeSchemaUrl(html: string, siteUrl: string): { html: string; n: number } {
  let n = 0;
  const out = html.replace(/<script\b[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi, block =>
    block.replace(/https?:\/\/(?:example|yourdomain)\.com[^"'\s]*/gi, () => { n++; return siteUrl; }));
  return { html: out, n };
}

/**
 * 죽은 도메인을 가리키는 <a>…</a> 를 제거하고,
 * 그 앵커만 감싸던 래퍼 <div> 도 함께 걷어낸다.
 * ⚠️ ld+json 블록 안의 URL은 repairFakeSchemaUrl 이 먼저 처리하므로 여기 도달하지 않는다.
 */
function repairDeadCta(html: string): { html: string; n: number; skipped: number } {
  let n = 0, skipped = 0, out = html;
  let from = 0;
  for (let guard = 0; guard < 50; guard++) {
    const re = /<a(?=[\s>])[^>]*href\s*=\s*["']https?:\/\/(?:yourdomain|example)\.com[^"']*["'][^>]*>/gi;
    re.lastIndex = from;
    const m = re.exec(out);
    if (!m) break;

    // ⚠️ 이전 구현은 indexOf('</a>') 로 닫는 태그를 찾았다 — 대소문자 구분이라
    //    <A ...>…</A> 나 </a> 누락 시 한참 뒤의 다른 </a> 까지 통째로 지웠다
    //    (적대 감사 실측: 고아 </p>, 닫히지 않은 <div>, 정상 내부링크 소실).
    const close = findMatchingClose(out, re.lastIndex, 'a');
    if (close < 0) { skipped++; from = re.lastIndex; continue; }

    let s = m.index, e = close;
    // 이 앵커만 감싸던 래퍼 <div> 도 함께 걷어낸다
    const before = out.slice(Math.max(0, s - 260), s);
    const dm = /<div(?=[\s>])[^>]*>\s*$/i.exec(before);
    if (dm) {
      const after = out.slice(e, e + 140);
      const am = /^\s*<\/div\s*>/i.exec(after);
      if (am) { s = Math.max(0, s - 260) + dm.index; e = e + am[0].length; }
    }

    const next = out.slice(0, s) + out.slice(e);
    if (balanceChanged(out, next)) { skipped++; from = re.lastIndex; continue; }
    out = next;
    n++;
    from = s;
  }
  return { html: out, n, skipped };
}

/**
 * idx 를 **실제로 감싸는** <p>…</p> 구간을 찾는다. 감싸지 않으면 null.
 *
 * ⚠️ 이전 구현은 lastIndexOf('<p', idx) / indexOf('</p>', idx) 로 경계를 추측했다.
 *    그래서 문구가 <li>·<td>·<h3>·<div> 안이나 맨몸 텍스트에 있으면
 *    훨씬 앞의 이미 닫힌 <p> 부터 훨씬 뒤의 </p> 까지를 지웠다.
 *    적대 감사 실측: H2 1개 + figure/img 1개 + table 1개 + 산문 419~487자 소실,
 *    닫히지 않은 <div> 발생, 그런데 경고는 0건이고 "수리 N건 성공" 로그만 남았다.
 *    또 lastIndexOf('<p') 는 <pre>·<picture> 에도 접두 매치된다.
 */
function findEnclosingParagraph(html: string, idx: number): { s: number; e: number } | null {
  // idx 이전의 마지막 <p ...> (단어 경계 — <pre>/<picture> 배제)
  const openRe = /<p(?=[\s>/])[^>]*>/gi;
  let openStart = -1, openEnd = -1, m: RegExpExecArray | null;
  while ((m = openRe.exec(html)) !== null) {
    if (m.index >= idx) break;
    openStart = m.index; openEnd = openRe.lastIndex;
  }
  if (openStart < 0) return null;

  // 그 <p> 와 idx 사이에 </p> 가 있으면 문구는 이 문단 밖이다
  const closeRe = /<\/p\s*>/gi;
  closeRe.lastIndex = openEnd;
  const between = closeRe.exec(html);
  if (between && between.index < idx) return null;

  // idx 이후 첫 </p>
  closeRe.lastIndex = idx;
  const closing = closeRe.exec(html);
  if (!closing) return null;

  return { s: openStart, e: closing.index + closing[0].length };
}

/**
 * "색인(노출) 신호" 가 든 <p> 블록을 통째로 제거.
 * 문장만 지우면 "…자연 배치해 를 강화했습니다" 라는 깨진 문장이 남는다.
 * 문구가 <p> 밖에 있으면 **손대지 않고 건너뛴다** — 조용한 섹션 삭제보다 문구 잔존이 낫다.
 */
function repairSeoNarration(html: string): { html: string; n: number; skipped: number } {
  let n = 0, skipped = 0, out = html;
  let from = 0;
  for (let guard = 0; guard < 10; guard++) {
    const i = out.indexOf('색인(노출)', from);
    if (i < 0) break;
    const range = findEnclosingParagraph(out, i);
    if (!range) { skipped++; from = i + 6; continue; }
    const next = out.slice(0, range.s) + out.slice(range.e);
    if (balanceChanged(out, next)) { skipped++; from = i + 6; continue; }
    out = next;
    n++;
    from = range.s;
  }
  return { html: out, n, skipped };
}

/**
 * 빈 앵커(href="#")에서 링크만 벗기고 안의 텍스트는 보존한다.
 * ⚠️ onclick="return false" 가 붙은 것은 장식용 배지다 — 건드리면 멀쩡한 디자인이 깨진다
 *    (온누리상품권 3편의 실제 사례).
 */
function repairEmptyAnchor(html: string): { html: string; n: number } {
  let n = 0, out = html;
  for (let guard = 0; guard < 100; guard++) {
    let found = -1, tagEnd = -1;
    for (const m of out.matchAll(/<a\b[^>]*>/gi)) {
      const tag = m[0];
      if (!/href\s*=\s*["']#["']/i.test(tag)) continue;
      if (/onclick\s*=\s*["']return false/i.test(tag)) continue;
      found = m.index!; tagEnd = m.index! + tag.length; break;
    }
    if (found < 0) break;
    const close = out.indexOf('</a>', tagEnd);
    if (close < 0) break;
    const inner = out.slice(tagEnd, close);
    out = out.slice(0, found) + inner + out.slice(close + 4);
    n++;
  }
  return { html: out, n };
}

// ───────────────────────── 본체 ─────────────────────────

/**
 * 발행 직전 자동 수리. **절대 throw 하지 않고, 절대 발행을 막지 않는다.**
 * 반환된 html/metaDescription 으로 발행을 계속 진행하면 된다.
 */
export function repairBeforePublish(input: RepairInput): RepairOutcome {
  const repairs: RepairAction[] = [];
  const warnings: RepairWarning[] = [];
  let html = String(input.html || '');
  let metaDescription = input.metaDescription;

  try {
    const originalProseLen = stripNonProse(html).length || 1;
    const cap = originalProseLen * MAX_DELETION_RATIO;

    /** 수리 적용 — 삭제량이 상한을 넘으면 되돌리고 경고로 강등 */
    const apply = (
      code: string,
      fn: () => { html: string; n: number; skipped?: number },
      label: (n: number) => string,
    ) => {
      const before = html;
      const r = fn();
      // 수리기가 스스로 보류한 건(경계 불명 등)도 조용히 넘기지 않고 알린다
      if (r.skipped && r.skipped > 0) {
        warnings.push({
          code: code + '_SKIPPED',
          detail: `${r.skipped}건은 경계를 확정할 수 없어 손대지 않았습니다 (원문 보존)`,
        });
      }
      if (r.n === 0) return;
      const removed = before.length - r.html.length;
      if (removed > cap) {
        warnings.push({ code: code + '_SKIPPED', detail: `${label(r.n)} — 삭제량 ${removed}자가 상한(${Math.round(cap)}자) 초과라 수리를 보류했습니다` });
        return;
      }
      // 최종 방어선: 어떤 수리든 태그 균형을 바꾸면 되돌린다.
      // 개별 수리기를 고치는 것과 별개로 두는 안전망이다.
      if (balanceChanged(before, r.html)) {
        warnings.push({ code: code + '_SKIPPED', detail: `${label(r.n)} — 수리 후 태그 균형이 깨져 되돌렸습니다` });
        return;
      }
      html = r.html;
      repairs.push({ code, detail: label(r.n), delta: -removed });
    };

    // 순서 주의: 스키마 URL 교체가 먼저다. 그래야 CTA 수리기가 ld+json 안을 건드리지 않는다.
    let siteUrl = '';
    try { siteUrl = input.siteUrl ? new URL(String(input.siteUrl)).origin : ''; } catch { /* 무시 */ }
    if (siteUrl) {
      apply('FAKE_SCHEMA_URL', () => repairFakeSchemaUrl(html, siteUrl), n => `JSON-LD 가짜 도메인 ${n}건을 ${siteUrl} 로 교체`);
    } else {
      // siteUrl 이 없으면 FAKE_SCHEMA_URL·NO_INTERNAL_LINK 가 통째로 꺼진다.
      // 그 상태에서 "결함 없음" 이라고 요약하면 거짓 보고가 된다.
      warnings.push({ code: 'SITEURL_UNKNOWN', detail: '사이트 URL을 알 수 없어 스키마 URL 교체와 내부링크 검사를 건너뜁니다' });
    }
    apply('DEAD_CTA', () => repairDeadCta(html), n => `죽은 링크 CTA ${n}건 제거`);
    apply('SEO_NARRATION', () => repairSeoNarration(html), n => `SEO 프로세스 서술 문단 ${n}개 제거`);
    apply('EMPTY_ANCHOR', () => repairEmptyAnchor(html), n => `빈 앵커 ${n}건 → 텍스트만 보존 (장식용 배지는 유지)`);

    // 메타디스크립션 오염은 본문에서 재생성한다.
    // 판정은 publish-verifier 와 공유한다 — 갈리면 한쪽은 고치고 한쪽은 결함이라 보고한다.
    if (looksLikeJsonPollution(metaDescription)) {
      const rebuilt = buildMetaDescription(stripNonProse(html));
      if (rebuilt.length >= 40) {
        repairs.push({ code: 'META_JSON', detail: `메타디스크립션 JSON 오염 → 본문에서 재생성 (${rebuilt.length}자)`, delta: 0 });
        metaDescription = rebuilt;
      } else {
        warnings.push({ code: 'META_JSON', detail: '메타디스크립션이 JSON 오염 상태인데 본문이 짧아 재생성하지 못했습니다' });
      }
    }

    // ── 수리 불가: 알리기만 한다 ──
    const prose = stripNonProse(html);
    if (!/<img\b/i.test(html)) {
      warnings.push({ code: 'NO_IMAGE', detail: '본문 이미지 0개 — 이미지 생성이 실패했을 수 있습니다 (발행은 계속)' });
    }
    if (prose.length < MIN_BODY_CHARS) {
      warnings.push({ code: 'THIN_BODY', detail: `본문 실텍스트 ${prose.length}자 < ${MIN_BODY_CHARS}자 — 색인에서 떨어질 수 있습니다 (발행은 계속)` });
    }
    if (siteUrl) {
      const host = siteUrl.replace(/^https?:\/\//, '').replace(/^www\./, '');
      if (!new RegExp('href\\s*=\\s*["\'][^"\']*' + host.replace(/\./g, '\\.'), 'i').test(html)) {
        warnings.push({ code: 'NO_INTERNAL_LINK', detail: `내부링크 0개 (${host}) — 삽입 로직 회귀 의심 (발행은 계속)` });
      }
    }
  } catch (e: any) {
    // 수리기 자체가 죽어도 원본 그대로 발행한다
    warnings.push({ code: 'REPAIR_ERROR', detail: `자동 수리 실패, 원본으로 발행합니다: ${e?.message || e}` });
    html = String(input.html || '');
    metaDescription = input.metaDescription;
  }

  const summary = repairs.length === 0 && warnings.length === 0
    ? '결함 없음'
    : [
      repairs.length ? `수리 ${repairs.length}건(${repairs.map(r => r.code).join(',')})` : '',
      warnings.length ? `경고 ${warnings.length}건(${warnings.map(w => w.code).join(',')})` : '',
    ].filter(Boolean).join(' · ');

  return { html, metaDescription, repairs, warnings, summary };
}
