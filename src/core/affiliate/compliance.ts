/**
 * 제휴 컴플라이언스 강제 (v3.8.395)
 *
 * 각 프로그램 운영정책을 **발행 직전에 자동으로 지키게** 만든다.
 * 원문 근거는 policies.ts 주석 참조 (2026-08-01 크롤 확인).
 *
 * ⚠️ 절대 발행을 막지 않는다. 사용자 원칙: "검수 때문에 발행이 안 되면 절대 안 된다."
 *   위반을 발견하면 **차단이 아니라 수리**한다. 수리 못 하는 것만 경고로 남긴다.
 *
 * 강제하는 것
 *   1. 대가성 문구를 본문 최상단에 삽입 (없으면 자동 추가)
 *      — 토스: "제목이나 첫 부분에 표기 권장", 네이버: "필수로 기재"
 *   2. 문구를 접기(details/summary) 안에 두지 않는다
 *      — 토스: "'자세히 보기'와 같이 추가적인 행동으로만 확인되지 않도록"
 *   3. 제휴 링크 전부에 rel="sponsored nofollow" (구글 요구사항)
 *   4. 조건부 표현 → 각 제휴사 확정형 문구로 교정 (제휴사별 규칙, 서로 침범 금지)
 *   5. 링크 URL 을 절대 변조하지 않는다 — 토스: "링크를 임의로 수정하면 계약 해지"
 *      → 이 모듈은 href 값을 읽기만 하고 rel 속성만 건드린다.
 *   6. 금지 광고 형태 제거: 플로팅 배너(position:fixed/sticky), 자동 실행, 본문 가림
 *      — 토스: "무효 클릭, 자동 실행, 과도하게 클릭을 유도하는 방식은 모두 금지"
 */
import { AffiliatePolicy, AffiliateProviderId, getPolicy, detectProvidersFromHtml } from './policies';

export interface ComplianceResult {
  html: string;
  /** 실제로 고친 것 */
  fixes: string[];
  /** 고치지 못해 사람이 봐야 하는 것 */
  warnings: string[];
  /** 적용된 제휴사 */
  provider: AffiliateProviderId | null;
}

/** 고지문 블록 — 본문과 시각적으로 구분되고, 접기 안에 들어가지 않는다 */
export function renderDisclosure(policy: AffiliatePolicy): string {
  const text = `${policy.disclosurePrefix}${policy.disclosure}`;
  return `<p class="affiliate-disclosure" data-affiliate-provider="${policy.id}" `
    + `style="font-size:16px;line-height:1.6;font-weight:700;color:#b3261e;background:#fff5f5;`
    + `border-left:5px solid #b3261e;border-radius:0 8px 8px 0;padding:14px 18px;margin:0 0 24px;">`
    + `${text}</p>`;
}

/** 본문에 이 제휴사의 고지문이 이미 있는가 (문구 일부로 판정 — 스타일이 달라도 인정) */
function hasDisclosure(html: string, policy: AffiliatePolicy): boolean {
  const core = policy.disclosure.replace(/\s+/g, '');
  const flat = String(html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, '');
  return flat.includes(core);
}

/** 고지문이 details/summary(접기) 안에 있으면 위반 — 토스 정책 명시 */
function disclosureInsideCollapsible(html: string, policy: AffiliatePolicy): boolean {
  const blocks = String(html || '').match(/<details[\s\S]*?<\/details>/gi) || [];
  const core = policy.disclosure.replace(/\s+/g, '');
  return blocks.some(b => b.replace(/<[^>]+>/g, '').replace(/\s+/g, '').includes(core));
}

/**
 * 제휴 링크에 rel="sponsored nofollow" 를 보장한다.
 * href 값은 절대 건드리지 않는다 (링크 변조 = 계약 해지 사유).
 */
function enforceRel(html: string, policy: AffiliatePolicy): { html: string; count: number } {
  let count = 0;
  const out = String(html || '').replace(
    /<a\b([^>]*?)href\s*=\s*(["'])([^"']*)\2([^>]*)>/gi,
    (full, pre = '', quote = '"', href = '', post = '') => {
      if (!policy.linkHosts.test(href)) return full;
      const attrs = `${pre} ${post}`;
      const relMatch = attrs.match(/\brel\s*=\s*(["'])([^"']*)\1/i);
      const tokens = new Set(
        (relMatch?.[2] || '').split(/\s+/).filter(Boolean).map(t => t.toLowerCase()),
      );
      const before = tokens.size;
      tokens.add('sponsored');
      tokens.add('nofollow');
      if (tokens.size === before && relMatch) return full;   // 이미 충족
      count += 1;
      const rel = [...tokens].join(' ');
      const cleaned = attrs.replace(/\s*\brel\s*=\s*(["'])[^"']*\1/i, '').replace(/\s{2,}/g, ' ').trim();
      return `<a ${cleaned ? cleaned + ' ' : ''}href=${quote}${href}${quote} rel="${rel}">`;
    },
  );
  return { html: out, count };
}

/**
 * 여는 태그 위치에서 그 요소의 내부 HTML 을 얻는다 (같은 이름 태그의 중첩을 센다).
 * 닫는 태그를 못 찾으면 빈 문자열 — 감싼 것으로 보지 않는다(오탐보다 미탐이 안전하다).
 */
function innerHtmlOf(source: string, tagName: string, openTagStart: number): string {
  const openEnd = source.indexOf('>', openTagStart);
  if (openEnd < 0) return '';
  const re = new RegExp(`<(/?)${tagName}\\b[^>]*>`, 'gi');
  re.lastIndex = openEnd + 1;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return source.slice(openEnd + 1, m.index);
  }
  return '';
}

/**
 * 요소가 제휴 링크를 **실제로 감싸고 있는가.**
 *
 * 여는 태그만 봐서는 알 수 없고(링크는 자식에 있다),
 * 뒤쪽 N자를 보는 휴리스틱은 오탐이 난다
 * (실측: 링크 없는 배너 뒤에 본문 링크가 있으면 잘못 걸렸다).
 * 그래서 닫는 태그까지 깊이를 세어 내부만 검사한다.
 * <a> 처럼 여는 태그 자체에 href 가 있는 경우도 함께 본다.
 */
function wrapsAffiliateLink(
  source: string, offset: number, openTag: string, tagName: string, policy: AffiliatePolicy,
): boolean {
  if (policy.linkHosts.test(openTag)) return true;              // <a href="..."> 자기 자신
  return policy.linkHosts.test(innerHtmlOf(source, tagName, offset));
}

/** 금지된 광고 형태를 제거한다 (토스 정책: 플로팅·가림·자동실행) */
function stripProhibitedAdPatterns(html: string, policy: AffiliatePolicy): { html: string; fixes: string[] } {
  let out = String(html || '');
  const fixes: string[] = [];

  // ① 제휴 링크를 감싼 요소의 position:fixed / sticky → 플로팅 배너 금지
  out = out.replace(
    /<(div|a|span|section)\b([^>]*style\s*=\s*["'][^"']*)position\s*:\s*(fixed|sticky)([^"']*["'][^>]*)>/gi,
    (full: string, tag: string, pre: string, pos: string, post: string, offset: number, source: string) => {
      if (!wrapsAffiliateLink(source, offset, full, tag, policy)) return full;
      fixes.push(`플로팅 배너(position:${pos}) 제거 — 운영정책상 금지`);
      return `<${tag}${pre}position:static${post}>`;
    },
  );

  // ② 자동 실행/자동 클릭 스크립트
  const autoRe = /<script\b[^>]*>[\s\S]*?(?:window\.location|location\.href|\.click\(\)|setTimeout[\s\S]{0,40}location)[\s\S]*?<\/script>/gi;
  (out.match(autoRe) || [])
    .filter(s => policy.linkHosts.test(s))   // 스크립트는 본문에 링크가 직접 들어있다
    .forEach((s) => {
      out = out.replace(s, '');
      fixes.push('자동 이동/자동 클릭 스크립트 제거 — 무효 클릭 유발로 금지');
    });

  // ③ 본문을 가리는 오버레이
  out = out.replace(
    /<div\b([^>]*style\s*=\s*["'][^"']*)z-index\s*:\s*(\d{4,})([^"']*["'][^>]*)>/gi,
    (full: string, pre: string, z: string, post: string, offset: number, source: string) => {
      if (!wrapsAffiliateLink(source, offset, full, 'div', policy)) return full;
      fixes.push(`본문 가림 오버레이(z-index:${z}) 완화 — 클릭 유도 금지`);
      return `<div${pre}z-index:1${post}>`;
    },
  );

  return { html: out, fixes };
}

/**
 * 제휴 컴플라이언스를 강제한다.
 *
 * @param providerId 사용자가 고른 제휴사. 없으면 본문 링크로 추정한다.
 */
export function enforceAffiliateCompliance(
  html: string,
  providerId?: string | null,
): ComplianceResult {
  const source = String(html || '');
  const fixes: string[] = [];
  const warnings: string[] = [];

  if (!source) return { html: source, fixes, warnings, provider: null };

  // 제휴사 결정 — 명시값 우선, 없으면 본문 링크로 추정
  let policy = getPolicy(providerId);
  if (!policy) {
    const detected = detectProvidersFromHtml(source);
    if (detected.length === 0) {
      return { html: source, fixes, warnings, provider: null };   // 제휴 글이 아니다
    }
    if (detected.length > 1) {
      warnings.push(
        `제휴 링크가 ${detected.length}종 섞여 있습니다(${detected.join(', ')}). `
        + '한 글에 한 제휴사만 쓰는 것이 정책상 안전합니다. 첫 번째 기준으로 고지문을 넣었습니다.',
      );
    }
    policy = getPolicy(detected[0])!;
  }

  let out = source;

  // 1) rel 강제 (href 는 절대 건드리지 않는다)
  const rel = enforceRel(out, policy);
  out = rel.html;
  if (rel.count > 0) fixes.push(`제휴 링크 ${rel.count}개에 rel="sponsored nofollow" 부여`);

  // 2) 금지 광고 형태 제거
  const stripped = stripProhibitedAdPatterns(out, policy);
  out = stripped.html;
  fixes.push(...stripped.fixes);

  // 3) 조건부 표현 → 확정형 (이 제휴사 규칙만 적용 — 다른 제휴사 문구를 훼손하지 않는다)
  policy.conditionalFixes.forEach(([re, replacement]) => {
    if (re.test(out)) {
      out = out.replace(re, replacement);
      fixes.push('조건부 대가성 표현을 공식 확정형 문구로 교정');
    }
  });

  // 4) 접기 안에 든 고지문 — 정책 위반이므로 밖으로 꺼낸다
  if (disclosureInsideCollapsible(out, policy)) {
    warnings.push(
      '대가성 문구가 접기(details) 안에 있었습니다. '
      + '"자세히 보기" 같은 추가 행동으로만 보이면 정책 위반이라 본문 최상단에 다시 넣었습니다.',
    );
    // 접기 안의 문구는 그대로 두고 최상단에 하나 더 넣는다(삭제하다 본문이 깨지는 것보다 안전)
    out = renderDisclosure(policy) + out;
    fixes.push('대가성 문구를 본문 최상단에 추가');
    return { html: out, fixes, warnings, provider: policy.id };
  }

  /**
   * 5) 고지문이 없으면 최상단에 삽입 — 차단이 아니라 자동 수리.
   *
   * 🚨 v3.8.465 — **그 제휴사 링크가 본문에 실제로 있을 때만 넣는다.**
   *
   * 사용자 지적: "왜 어떤모드이든 쿠팡 공정위 문구가 하드코딩되어있나요??"
   * 호출부가 제휴사를 잘못 넘기면(예: 판정 기본값이 쿠팡) 링크가 하나도 없는
   * 정보성 글에도 "쿠팡 파트너스 활동의 일환으로 수수료를 제공받습니다" 가 박혔다.
   * 받지도 않는 수수료를 받는다고 적는 것은 사실과 다른 표시라 고지문 자체가
   * 위반이 된다. 링크가 없으면 고지할 대상도 없다.
   *
   * 진짜 제휴 글은 이 시점에 이미 링크가 들어 있다 — 상품 카드·CTA 버튼이
   * 먼저 삽입되고 그 뒤에 이 함수가 돈다.
   */
  if (!hasDisclosure(out, policy)) {
    if (detectProvidersFromHtml(out).includes(policy.id)) {
      out = renderDisclosure(policy) + out;
      fixes.push(`대가성 문구 자동 삽입 (${policy.label})`);
    } else {
      warnings.push(
        `${policy.label} 링크가 본문에 없어 대가성 문구를 넣지 않았습니다. `
        + '제휴 링크를 넣으셨다면 고지문도 함께 들어가야 합니다.',
      );
    }
  }

  // 6) 이미지 안에 고지문을 넣은 경우 — 네이버 #7 가이드가 명시적으로 금지
  //    "이미지에 삽입되어 있거나, 태그 사이에 작성하는 등 식별이 어려운 경우" 위반
  const inAltAttr = new RegExp(
    `alt\\s*=\\s*["'][^"']*${policy.disclosure.slice(0, 12).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
    'i',
  );
  if (inAltAttr.test(out)) {
    warnings.push('대가성 문구가 이미지 alt 에 들어 있습니다. 이미지 안 표기는 식별 불가로 위반이라 본문 문구를 별도로 유지하세요.');
  }

  // 7) 함께 쓰면 안 되는 태그 (네이버: #내돈내산)
  policy.forbiddenTogether.forEach((token) => {
    if (out.includes(token)) {
      warnings.push(`"${token}" 은 ${policy.label} 링크와 함께 쓸 수 없습니다. 본문에서 빼주세요.`);
    }
  });

  // 8) 링크 과다 — "내용과 무관한 링크 대량 삽입" 어뷰징 경고
  const linkCount = (out.match(/<a\b[^>]*href\s*=\s*["'][^"']*["']/gi) || [])
    .filter(a => policy.linkHosts.test(a)).length;
  if (linkCount > policy.maxLinksPerPost) {
    warnings.push(
      `제휴 링크가 ${linkCount}개입니다(권장 ${policy.maxLinksPerPost}개 이하). `
      + '내용과 무관한 링크를 대량 삽입하면 어뷰징으로 불이익을 받을 수 있습니다.',
    );
  }

  return { html: out, fixes, warnings, provider: policy.id };
}

/**
 * v3.8.398: 본문 이미지를 전부 구매 링크로 감싼다.
 *
 * 사용자 요구(2026-08-01): "썸네일은 대표사진이고 배너는 당연히 클릭하면 구매링크로
 *   전환되어야하고 이미지도 전부 클릭하면 구매링크로 가지게 해주세요."
 *
 * 쇼핑 글에서 이미지는 가장 큰 클릭 유발 요소인데, 지금은 그냥 그림이라 수익 누수가 난다.
 *
 * ⚠️ 정책 준수
 *   · 링크는 사용자가 준 원본만 쓴다(변조 금지).
 *   · rel="sponsored nofollow" 를 붙인다.
 *   · 이미 <a> 안에 있는 이미지는 건드리지 않는다(중첩 <a> 는 잘못된 HTML 이다).
 *   · 대가성 문구 블록 안의 이미지는 감싸지 않는다(고지문을 링크로 만들면 안 된다).
 *   · 토스 "과도하게 클릭을 유도" 금지에 걸리지 않도록 **자동 실행·오버레이는 쓰지 않는다.**
 *     이미지 자체를 링크로 만드는 것은 일반적인 상품 소개 형식이다.
 */
export function linkImagesToProduct(
  html: string,
  productUrl: string,
  providerId?: string | null,
): { html: string; linked: number } {
  const source = String(html || '');
  const url = String(productUrl || '').trim();
  if (!source || !/^https?:\/\//i.test(url)) return { html: source, linked: 0 };
  const policy = getPolicy(providerId);

  // 이미 링크 안에 있는 <img> 의 위치를 미리 구해 둔다
  const wrapped = new Set<number>();
  for (const m of source.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)) {
    const start = m.index ?? 0;
    for (const img of m[0].matchAll(/<img\b/gi)) wrapped.add(start + (img.index ?? 0));
  }
  // 고지문 블록 안의 이미지도 제외
  for (const m of source.matchAll(/<p class="affiliate-disclosure"[\s\S]*?<\/p>/gi)) {
    const start = m.index ?? 0;
    for (const img of m[0].matchAll(/<img\b/gi)) wrapped.add(start + (img.index ?? 0));
  }

  let linked = 0;
  const esc = url.replace(/"/g, '&quot;');
  const out = source.replace(/<img\b[^>]*>/gi, (tag, offset: number) => {
    if (wrapped.has(offset)) return tag;
    linked += 1;
    const label = policy ? ` aria-label="${policy.label} 상품 보러가기"` : '';
    return `<a href="${esc}" target="_blank" rel="sponsored nofollow noopener"${label}>${tag}</a>`;
  });

  return { html: out, linked };
}

/**
 * 제목에 제휴 표시를 붙인다 (네이버 #7 가이드: "각 게시글 제목 앞").
 *
 * ⚠️ 전체 고지 문장을 제목에 넣으면 제목이 35자 이상 잡아먹혀 검색 노출이 망가진다.
 *   그래서 짧은 표시(titleMark)만 붙이고, 정확한 전체 문구는 본문 최상단에 둔다.
 *   두 곳 모두 요구하는 제휴사(네이버)에서만 동작하며, 이미 붙어 있으면 중복하지 않는다.
 */
export function applyTitleMark(title: string, providerId?: string | null): string {
  const t = String(title || '').trim();
  const policy = getPolicy(providerId);
  if (!t || !policy || !policy.requiresTitleMark || !policy.titleMark) return t;
  if (t.startsWith(policy.titleMark)) return t;
  return `${policy.titleMark} ${t}`;
}
