/**
 * bulk-repair — 이미 발행된 글의 CTA 를 **골라서** 고친다. (v3.8.696)
 *
 * ## 왜 필요한가
 * 사장님: "일괄 점검 교체 도구 만들고"
 *
 * v3.8.688~695 에서 고친 것은 전부 **앞으로 만들어질 CTA** 다. 이미 나가 있는 글은
 * 그대로다. 실측(2026-09-07, leadernam.com 183편 · CTA 113개):
 *   죽은 링크 14개 · 기관 홈·문서파일 48개 · 단축링크 1개
 * 글마다 편집기를 열어 고치면 100편이 넘는다. 한 번에 훑고, **고칠 것만 골라** 바꾼다.
 *
 * ## 규칙 셋 — 여기가 이 모듈의 전부다
 * ① **주소만 바꾼다.** 버튼 문구·훅·박스 모양은 건드리지 않는다.
 *    본문을 다시 쓰지 않으므로 잘 쓴 문장이 지워질 일이 없다(과거 사고).
 * ② **못 찾으면 그 글은 건너뛴다.** 나쁜 주소를 다른 나쁜 주소로 바꾸지 않는다.
 *    버튼이 사라지는 것도 안 된다 — 원본을 그대로 둔다.
 * ③ **한 글에서 바뀐 게 없으면 발행하지 않는다.** 의미 없는 수정 이력을 남기지 않는다.
 *
 * AI 를 부르지 않는다 — 주소를 갈아끼우는 일이다. 목적지를 새로 찾는 것은
 * 부르는 쪽(cta/regenerate)이 하고, 이 모듈은 그 결과를 본문에 심는다.
 */

/** 한 글에서 바꿀 주소 한 쌍 */
export interface CtaUrlSwap {
  from: string;
  to: string;
}

export interface ApplySwapResult {
  html: string;
  /** 실제로 바뀐 횟수 (0 이면 발행하지 않는다) */
  changed: number;
  /** 본문에서 못 찾은 주소 — 조용히 넘기지 않고 돌려준다 */
  missing: string[];
}

function escapeRegExp(value: string): string {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 같은 주소를 가리키는 여러 표기를 만든다.
 *
 * 발행된 HTML 안에서 `&` 는 `&amp;` 로 적혀 있다. 이걸 모르고 원본 주소로만 찾으면
 * **한 건도 못 바꾼다** — 이 저장소가 감사 스크립트에서 실제로 겪은 함정이다
 * (금융감독원 민원신청 주소가 안 잡혀 엉뚱한 페이지를 열었다).
 */
function urlVariants(url: string): string[] {
  const raw = String(url || '').trim();
  if (!raw) return [];
  const set = new Set<string>([raw, raw.replace(/&/g, '&amp;'), raw.replace(/&amp;/g, '&')]);
  return [...set];
}

/**
 * 본문의 CTA 주소를 갈아끼운다. **href 안에 있는 것만** 바꾼다 —
 * 본문에 글자로 적힌 주소까지 바꾸면 문장이 어긋난다.
 */
export function applyCtaUrlSwaps(html: string, swaps: CtaUrlSwap[]): ApplySwapResult {
  let out = String(html || '');
  let changed = 0;
  const missing: string[] = [];

  for (const swap of swaps || []) {
    const from = String(swap?.from || '').trim();
    const to = String(swap?.to || '').trim();
    if (!from || !to || from === to) continue;

    let hitThisSwap = 0;
    for (const variant of urlVariants(from)) {
      // href="…" / href='…' 안에 있을 때만 바꾼다
      const pattern = new RegExp(`(href\\s*=\\s*["'])${escapeRegExp(variant)}(["'])`, 'gi');
      out = out.replace(pattern, (_m, head, tail) => {
        hitThisSwap += 1;
        return `${head}${to}${tail}`;
      });
    }
    if (hitThisSwap === 0) missing.push(from);
    changed += hitThisSwap;
  }

  return { html: out, changed, missing };
}

/** 급한 순서 — 화면에서 이 차례로 보여 준다 */
const REPAIR_PRIORITY: Record<string, number> = {
  dead: 0, document: 1, home: 2, unknown: 3, action: 4,
};

export interface RepairCandidate {
  postId: number | string;
  title: string;
  link: string;
  url: string;
  verdict: string;
  reason: string;
}

/**
 * 점검 결과에서 **고칠 값어치가 있는 것만** 추린다.
 *
 * `action` 은 이미 제 일을 하고 있으므로 건드리지 않는다 — 멀쩡한 것을 바꾸면
 * 좋아질 여지보다 나빠질 위험이 크다. `unknown` 도 뺀다: 페이지를 못 읽었을 뿐
 * 죽었다는 뜻이 아니다(기관 사이트는 인증서 문제로 node 에서만 실패하는 곳이 많다).
 */
export function pickRepairTargets(reports: any[]): RepairCandidate[] {
  const out: RepairCandidate[] = [];
  for (const report of reports || []) {
    for (const check of report?.checks || []) {
      const verdict = String(check?.verdict || '');
      if (verdict !== 'dead' && verdict !== 'document' && verdict !== 'home') continue;
      out.push({
        postId: report.postId,
        title: String(report.title || ''),
        link: String(report.link || ''),
        url: String(check.url || ''),
        verdict,
        reason: String(check.reason || ''),
      });
    }
  }
  return out.sort((a, b) => (REPAIR_PRIORITY[a.verdict] ?? 9) - (REPAIR_PRIORITY[b.verdict] ?? 9));
}

/** 사람이 읽는 한 줄 — 화면과 로그에 같은 말을 쓴다 */
export function describeRepairPlan(targets: RepairCandidate[]): string {
  if (!targets.length) return '고칠 CTA 가 없습니다 — 전부 제 일을 하고 있습니다.';
  const by = targets.reduce<Record<string, number>>((acc, t) => {
    acc[t.verdict] = (acc[t.verdict] || 0) + 1;
    return acc;
  }, {});
  const label: Record<string, string> = { dead: '죽은 링크', document: '문서 파일', home: '기관 홈' };
  const parts = Object.entries(by).map(([k, n]) => `${label[k] || k} ${n}개`);
  const posts = new Set(targets.map((t) => String(t.postId))).size;
  return `${posts}편에서 ${targets.length}개 — ${parts.join(' · ')}`;
}
