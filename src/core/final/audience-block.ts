/**
 * audience-block — 한 번 온 독자를 다시 오게 만드는 두 줄.
 *
 * ## 왜 만드는가 (v3.8.560 — 하네스 A2·A4)
 * 검색 트래픽은 1년간 33% 줄었고(미국 -38%) AI 답변이 클릭을 가로챈다.
 * 그 흐름에서 살아남는 건 **이 사이트를 지목해 둔 독자**다. 구글이 그 지목 장치를 열어 줬다.
 *
 *   ① Preferred Sources — 독자가 "즐겨 보는 곳"으로 지정하면 그 사람의 검색·디스커버·뉴스에
 *      우리가 더 자주 뜬다. 구글 조사로 **지정된 출처는 클릭 확률 2배**.
 *      한국어 포함 전 언어가 2026-04-30 에 열렸고, 사이트에 심는 버튼은 2026-08-20 에 나왔다.
 *   ② 디스커버 팔로우 — 크롬 팔로잉 탭에 새 글이 꽂힌다. 디스커버가 복권이라면 이건 적립식이다.
 *
 * ## 스크립트를 쓰지 않는다
 * 구글 공식 버튼은 `news.google.com/swg/js/v1/publisher.js` 를 불러오는 스크립트다.
 * 그런데 워드프레스는 본문의 `<script>` 를 저장할 때 지운다. 게다가 우리는 같은 HTML 을
 * 블로그스팟·티스토리로도 보낸다. 그래서 구글이 **공식 대안으로 문서화한 딥링크**를 쓴다 —
 * 평범한 `<a>` 한 줄이라 세 플랫폼 어디서든 똑같이 동작한다.
 *
 * ## 도메인을 모르면 아무것도 넣지 않는다
 * 딥링크에는 우리 도메인이 들어간다. 티스토리 글에 워드프레스 도메인을 넣으면
 * 독자가 엉뚱한 사이트를 지정하게 된다. 확실할 때만 넣는다.
 */

import { blockStrings, normalizeBlockLanguage } from './block-strings';

/** 플랫폼별로 사이트 주소가 담기는 환경변수 키 */
const SITE_URL_KEYS: Record<string, string[]> = {
  wordpress: ['WORDPRESS_SITE_URL'],
  blogspot: ['BLOGGER_URL'],
  blogger: ['BLOGGER_URL'],
  tistory: ['TISTORY_BLOG_URL'],
};

/**
 * 이 글이 실릴 곳의 도메인. 못 정하면 빈 문자열 —
 * 추측한 도메인으로 링크를 만들면 독자가 남의 사이트를 지정하게 된다.
 */
export function resolveSiteDomain(platform: string, env: Record<string, any> | null | undefined): string {
  const keys = SITE_URL_KEYS[String(platform || '').toLowerCase()];
  if (!keys) return '';

  const source = env || {};
  for (const key of keys) {
    const raw = String(source[key] || '').trim();
    if (!raw) continue;
    try {
      const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
      return url.hostname.replace(/^www\./, '');
    } catch {
      /* 주소가 깨졌으면 다음 키를 본다 */
    }
  }

  // 티스토리는 주소 대신 블로그 이름만 저장돼 있을 수 있다
  if (String(platform || '').toLowerCase() === 'tistory') {
    const name = String(source['TISTORY_BLOG_NAME'] || '').trim();
    if (/^[a-z0-9-]{2,}$/i.test(name)) return `${name}.tistory.com`;
  }
  return '';
}

/** 구글이 문서화한 딥링크 — 로그인한 독자를 지정 화면으로 바로 보낸다 */
export function preferredSourceLink(domain: string): string {
  return `https://google.com/preferences/source?q=${encodeURIComponent(domain)}`;
}

export interface AudienceBlockInput {
  platform: string;
  env: Record<string, any> | null | undefined;
  contentMode?: string;
  /** 사이트 이름 — 문구에 쓴다. 없으면 도메인을 쓴다 */
  siteName?: string;
  /** v3.8.562 — 'ko' | 'en'. 없으면 한국어(기존 동작) */
  language?: unknown;
}

/**
 * 글 맨 아래에 붙는 독자 확보 블록. 넣을 수 없으면 빈 문자열.
 *
 * 애드센스 모드는 넣지 않는다 — 그 모드의 목적은 승인이고, 승인 심사에서
 * 본문 외 링크는 얻는 것 없이 위험만 는다(사장님: "목적은 에드센스 승인이 목적").
 */
export function buildAudienceBlock(input: AudienceBlockInput): string {
  if (input.contentMode === 'adsense') return '';

  const domain = resolveSiteDomain(input.platform, input.env);
  if (!domain) return '';

  const name = String(input.siteName || '').trim() || domain;
  const escape = (v: string) =>
    String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const safeName = escape(name);
  const href = escape(preferredSourceLink(domain));
  // v3.8.562: 문구를 언어별 표에서 가져온다. language 를 안 주면 예전처럼 한국어다
  const s = blockStrings(normalizeBlockLanguage(input.language));

  return `
<aside class="audience-block" style="margin:28px 0 8px;padding:18px 20px;background:var(--rv-audience-bg,#f8fafc);border:1px solid var(--rv-audience-border,#e2e8f0);border-radius:10px;box-sizing:border-box;max-width:100%;">
  <p class="audience-block-title" style="margin:0 0 8px;font-size:15px;font-weight:800;color:#334155;-webkit-text-fill-color:#334155;line-height:1.5;">${s.audienceTitle}</p>
  <p class="audience-block-line" style="margin:0 0 6px;font-size:14px;color:#475569;-webkit-text-fill-color:#475569;line-height:1.65;word-break:keep-all;">${s.audienceLine(safeName)}</p>
  <p class="audience-block-action" style="margin:0 0 10px;font-size:14px;line-height:1.65;">
    <a class="audience-block-link" href="${href}" target="_blank" rel="nofollow noopener noreferrer" style="color:#0f766e;-webkit-text-fill-color:#0f766e;font-weight:700;text-decoration:underline;">${s.audienceCta}</a>
  </p>
  <p class="audience-block-follow" style="margin:0;font-size:13px;color:#64748b;-webkit-text-fill-color:#64748b;line-height:1.6;word-break:keep-all;">${s.audienceFollow}</p>
</aside>
`;
}
