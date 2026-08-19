/**
 * 🕸️ 거미줄 돌아가기 CTA — 상단·중간·하단 3위치 (v3.8.539)
 *
 * 사장님 요구: "버튼이 맨아래 마지막에 하나만 있던데... 맨아래까지 보는 사람
 * 거의없어. 제일 상단에 종합글로 바로가는 버튼, 중간 1개, 하단 1개 이렇게
 * 총 3개로 해주고 **글과 조화롭게** — 어색하면 이것도 저것도 아니니까."
 *
 * ## 조화의 규칙 — 세 자리가 같은 무게면 광고처럼 보인다
 *   · 상단: 한 줄 안내 바 (가볍게) — "이 글은 시리즈의 한 편" + 텍스트 링크
 *   · 중간: 브리지 문장 + 작은 버튼 (중간 무게) — 스크롤 중간 이탈 지점 대응
 *   · 하단: 기존 큰 CTA 박스 그대로 (기존 발행글과의 연속성)
 *
 * ## 배치 규칙 — 글 구조를 읽고 앉힌다
 *   · 상단: 첫 <h2> 직전 (= 서론 끝). h2 가 없으면 넣지 않는다 (어색 방지).
 *   · 중간: h2 가 3개 이상일 때만, 가운데 h2 직전. 짧은 글에 3개는 과하다.
 *   · 하단: 본문 끝 (기존 semantics 그대로 — 마커/구버전 블록 교체 포함).
 *
 * ## 재실행 안전
 *   각 위치는 자기 마커로 감싼다 — 거미줄을 다시 돌려도 교체될 뿐 중복되지 않는다.
 *   하단은 기존 마커(BGPT_SPIDER_HUB_CTA_*)를 그대로 써서 이미 발행된 글과 호환된다.
 */

export interface SpiderHubInfo {
  url?: string;
  title?: string;
}

/** main.ts 의 pickSpiderEyeComfortPalette 결과와 구조 호환 */
export interface SpiderHubTheme {
  gradientStart: string;
  gradientEnd: string;
  border: string;
  primary: string;
  heading: string;
  muted: string;
  ctaButtonStart: string;
  ctaButtonEnd: string;
  ctaShadow: string;
}

// 하단은 기존 마커 그대로 — 이미 발행된 글의 블록을 이 코드가 이어받아 교체한다
export const SPIDER_HUB_CTA_START = '<!-- BGPT_SPIDER_HUB_CTA_START -->';
export const SPIDER_HUB_CTA_END = '<!-- BGPT_SPIDER_HUB_CTA_END -->';
export const SPIDER_HUB_TOP_START = '<!-- BGPT_SPIDER_HUB_TOP_START -->';
export const SPIDER_HUB_TOP_END = '<!-- BGPT_SPIDER_HUB_TOP_END -->';
export const SPIDER_HUB_MID_START = '<!-- BGPT_SPIDER_HUB_MID_START -->';
export const SPIDER_HUB_MID_END = '<!-- BGPT_SPIDER_HUB_MID_END -->';

function escapeHtmlInline(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeRegExpInline(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 상단 — 한 줄 안내 바. 무겁게 만들지 않는다 (첫 화면에서 광고처럼 보이면 이탈). */
export function buildSpiderHubTopBar(hub: SpiderHubInfo, theme: SpiderHubTheme): string {
  const safeUrl = escapeHtmlInline(hub.url || '#');
  const safeTitle = escapeHtmlInline(hub.title || '종합 가이드');
  return `${SPIDER_HUB_TOP_START}
<p data-bgpt-role="spider-hub-top" style="margin:0 0 26px;padding:12px 16px;background:${theme.gradientStart};border:1px solid ${theme.border};border-radius:10px;font-family:'Noto Sans KR','Malgun Gothic',sans-serif;font-size:14px;line-height:1.65;color:${theme.muted};">📚 이 글은 <strong style="color:${theme.heading};">${safeTitle}</strong> 시리즈의 한 편입니다 · <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:${theme.primary};font-weight:800;text-decoration:none;">전체 가이드 보기 →</a></p>
${SPIDER_HUB_TOP_END}`;
}

/** 중간 — 브리지 한 문장 + 작은 버튼. 읽던 흐름을 끊지 않고 갈림길만 보여준다. */
export function buildSpiderHubMidCta(hub: SpiderHubInfo, theme: SpiderHubTheme): string {
  const safeUrl = escapeHtmlInline(hub.url || '#');
  const safeTitle = escapeHtmlInline(hub.title || '종합 가이드');
  return `${SPIDER_HUB_MID_START}
<div data-bgpt-role="spider-hub-mid" style="margin:34px 0;padding:16px 20px;background:${theme.gradientEnd};border:1px solid ${theme.border};border-radius:12px;font-family:'Noto Sans KR','Malgun Gothic',sans-serif;">
  <p style="margin:0 0 12px;color:${theme.muted};font-size:14px;line-height:1.7;">여기까지 읽으셨다면 다른 갈래도 궁금하실 겁니다. 관련 주제의 전체 순서와 비교는 <strong style="color:${theme.heading};">${safeTitle}</strong>에 정리돼 있습니다.</p>
  <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:10px 16px;background:linear-gradient(135deg,${theme.ctaButtonStart} 0%,${theme.ctaButtonEnd} 100%);color:#fff !important;text-decoration:none;border-radius:9px;font-size:13px;font-weight:800;line-height:1.3;">종합 가이드에서 전체 흐름 보기</a>
</div>
${SPIDER_HUB_MID_END}`;
}

/** 하단 — 기존 큰 CTA 박스 (마커·role 승계 = 발행글 호환.
 *  v3.8.539: 5px 색 띠(border-left)만 걷어냈다 — 새 상단·중간 블록이 얇은 1px
 *  테두리라 하단만 두꺼운 띠면 형제끼리 안 어울리고, 그 띠 자체가 대표적 AI 티다.) */
export function buildSpiderHubBottomCta(hub: SpiderHubInfo, theme: SpiderHubTheme): string {
  const safeUrl = escapeHtmlInline(hub.url || '#');
  const safeTitle = escapeHtmlInline(hub.title || '종합 가이드');
  return `${SPIDER_HUB_CTA_START}
<div class="bgpt-spider-hub-cta" data-bgpt-role="spider-hub-backlink" style="margin:42px 0 34px;padding:24px 26px;background:linear-gradient(135deg,${theme.gradientStart} 0%,${theme.gradientEnd} 100%);border:1px solid ${theme.border};border-radius:14px;box-shadow:0 8px 22px ${theme.ctaShadow};font-family:'Noto Sans KR','Malgun Gothic',sans-serif;">
  <p style="margin:0 0 8px;color:${theme.heading};font-size:14px;font-weight:800;line-height:1.55;">이 글은 종합 가이드의 일부입니다</p>
  <p style="margin:0 0 16px;color:${theme.muted};font-size:14px;line-height:1.75;">관련 글 전체 흐름과 핵심 비교표는 종합글에서 한 번에 확인할 수 있습니다.</p>
  <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:13px 22px;background:linear-gradient(135deg,${theme.ctaButtonStart} 0%,${theme.ctaButtonEnd} 100%);color:#fff !important;text-decoration:none;border-radius:10px;font-size:14px;font-weight:900;line-height:1.3;box-shadow:0 6px 16px ${theme.ctaShadow};">종합글로 돌아가기: ${safeTitle}</a>
</div>
${SPIDER_HUB_CTA_END}`;
}

/**
 * 배포 구매자용 처방 번역 (v3.8.539).
 *
 * 사장님 요구: "배포 구매자 입장에서 전부 잘 되어야 돼. 안 되면 프리티 링크처럼
 * 안내를 해줘야 돼." 상태코드만 던지면 개발자용이다 — 구매자는 다음에 뭘
 * 하면 되는지를 알아야 한다. (naver describeNaverFailure 와 같은 무늬)
 */
export function describeBacklinkFailure(status: number, platform: 'wordpress' | 'blogger'): string {
  if (platform === 'wordpress') {
    if (status === 401 || status === 403) {
      return '워드프레스가 수정 요청을 거부했습니다. ① 환경설정의 앱 비밀번호가 만료되지 않았는지 재발급해 보세요 ② Wordfence 같은 보안 플러그인이 REST API 를 차단 중이면 화이트리스트에 추가해 주세요.';
    }
    if (status === 404) {
      return '해당 글을 사이트에서 찾지 못했습니다. 글이 삭제되었거나 주소가 바뀐 경우입니다 — 글 목록을 새로 불러온 뒤 다시 시도해 주세요.';
    }
    if (status >= 500) {
      return '워드프레스 서버(호스팅) 쪽 일시 오류입니다. 잠시 후 다시 시도해 주세요.';
    }
    return '워드프레스 연동을 확인해 주세요 — 사이트 주소·아이디·앱 비밀번호가 맞는지 환경설정에서 저장 후 재시도.';
  }
  if (status === 401 || status === 403) {
    return '구글 인증이 만료되었습니다. 환경설정에서 블로그스팟 로그인(OAuth)을 다시 진행해 주세요.';
  }
  if (status === 404) {
    return '해당 글을 블로그에서 찾지 못했습니다 — 글 목록을 새로 불러온 뒤 다시 시도해 주세요.';
  }
  return '블로그스팟 연동을 확인해 주세요 — 환경설정에서 구글 로그인 후 재시도.';
}

function replaceSection(html: string, start: string, end: string, block: string): { html: string; hit: boolean } {
  const regex = new RegExp(`${escapeRegExpInline(start)}[\\s\\S]*?${escapeRegExpInline(end)}`, 'i');
  if (regex.test(html)) return { html: html.replace(regex, block), hit: true };
  return { html, hit: false };
}

function findH2Offsets(html: string): number[] {
  const offsets: number[] = [];
  const regex = /<h2[\s>]/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) offsets.push(m.index);
  return offsets;
}

export interface SpiderBacklinkPatch {
  html: string;
  /** 기존 호출부 계약 유지 — 전부 그대로면 'unchanged' */
  action: 'inserted' | 'replaced' | 'unchanged';
  detail: { top: string; mid: string; bottom: string };
}

/**
 * 상단·중간·하단 3위치를 한 번에 반영한다. 몇 번을 다시 돌려도 결과가 같다.
 */
export function applySpiderHubBacklinks(html: string, hub: SpiderHubInfo, theme: SpiderHubTheme): SpiderBacklinkPatch {
  const original = String(html || '');
  let next = original;
  const detail = { top: 'skipped', mid: 'skipped', bottom: 'unchanged' };

  // ── 하단 (기존 semantics: 마커 교체 → 구버전 role 블록 교체 → 끝에 추가) ──
  const bottomBlock = buildSpiderHubBottomCta(hub, theme);
  const bottomByMarker = replaceSection(next, SPIDER_HUB_CTA_START, SPIDER_HUB_CTA_END, bottomBlock);
  if (bottomByMarker.hit) {
    detail.bottom = bottomByMarker.html === next ? 'unchanged' : 'replaced';
    next = bottomByMarker.html;
  } else {
    const oldBlockRegex = /<div[^>]+data-bgpt-role=["']spider-hub-backlink["'][\s\S]*?<\/div>/i;
    if (oldBlockRegex.test(next)) {
      next = next.replace(oldBlockRegex, bottomBlock);
      detail.bottom = 'replaced';
    } else {
      next = `${next.trim()}\n\n${bottomBlock}`;
      detail.bottom = 'inserted';
    }
  }

  // ── 상단 (첫 h2 직전 — 서론 끝. h2 없으면 어색하니 넣지 않는다) ──
  const topBlock = buildSpiderHubTopBar(hub, theme);
  const topByMarker = replaceSection(next, SPIDER_HUB_TOP_START, SPIDER_HUB_TOP_END, topBlock);
  if (topByMarker.hit) {
    detail.top = topByMarker.html === next ? 'unchanged' : 'replaced';
    next = topByMarker.html;
  } else {
    const h2s = findH2Offsets(next);
    if (h2s.length >= 1) {
      next = `${next.slice(0, h2s[0])}${topBlock}\n${next.slice(h2s[0])}`;
      detail.top = 'inserted';
    }
  }

  // ── 중간 (h2 3개 이상일 때만, 가운데 h2 직전) ──
  const midBlock = buildSpiderHubMidCta(hub, theme);
  const midByMarker = replaceSection(next, SPIDER_HUB_MID_START, SPIDER_HUB_MID_END, midBlock);
  if (midByMarker.hit) {
    detail.mid = midByMarker.html === next ? 'unchanged' : 'replaced';
    next = midByMarker.html;
  } else {
    const h2s = findH2Offsets(next); // 상단 삽입 후 좌표로 다시 잰다
    if (h2s.length >= 3) {
      const midIdx = h2s[Math.floor(h2s.length / 2)]!;
      next = `${next.slice(0, midIdx)}${midBlock}\n${next.slice(midIdx)}`;
      detail.mid = 'inserted';
    }
  }

  const changed = next !== original;
  const anyInserted = Object.values(detail).includes('inserted');
  return {
    html: next,
    action: !changed ? 'unchanged' : anyInserted ? 'inserted' : 'replaced',
    detail,
  };
}
