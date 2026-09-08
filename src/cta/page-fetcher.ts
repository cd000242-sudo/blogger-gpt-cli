/**
 * page-fetcher — CTA 판정이 기관 페이지를 여는 **한 가지** 방법. (v3.8.706)
 *
 * ## 왜 (2026-09-08 실측, 시드 231곳의 홈)
 * 같은 `fetch(url, { redirect: 'follow' })` 가 네 군데(main.ts 셋 · generation.ts · 시드 스크립트)에 복사돼 있었고,
 * 관공서 홈 13곳을 못 열었다. 브라우저에서는 전부 열린다.
 *   · 7곳 "redirect count exceeded" — 국토교통부·법무부·경찰청·외교부·이파인·세움터: 쿠키를 심고 **같은 주소로 307**.
 *     Node fetch 는 리다이렉트 사이에 쿠키를 들고 가지 않아 무한히 돈다.
 *   · 4곳 "unable to verify the first certificate" — 한국소비자원·E-Gen·국가교통정보센터: 중간 인증서를 안 보내는 서버.
 *     브라우저(크로미움·윈도 저장소)는 스스로 받아 오고, Node 는 못 한다.
 * 못 여는 홈은 레지스트리가 "열리지 않음"으로 버리고, 게이트는 행동 화면을 확인하지 못해 guide 로 내려간다.
 * 살아 있는 기관을 죽었다고 보는 것이다.
 *
 * ## 어떻게
 *   1. Electron 안이면 `net.fetch` — 크로미움 네트워크 스택. 쿠키·인증서 체인을 브라우저처럼 다룬다.
 *   2. 밖(테스트·스크립트)이면 Node fetch 를 **직접 따라간다**: 응답의 Set-Cookie 를 다음 요청에 실어 최대 10번.
 *      인증서 체인은 여기서 못 고친다 — 스크립트가 알아서 정한다(시드 생성은 공개 HTML 제목만 읽으므로 검증을 끈다).
 */
import type { PageFetcher } from './action-link-harness';

export interface FetchedPage { ok: boolean; html: string; finalUrl: string; status: number; errorCode?: string }

export interface FetchPageOptions {
  timeoutMs?: number;
  maxChars?: number;
  /** true 면 4xx/5xx 도 html 과 함께 ok:false 로 돌려준다(링크 검사기가 상태를 직접 본다) */
  keepErrorBody?: boolean;
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const MAX_HOPS = 10;

function electronNetFetch(): typeof fetch | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require('electron');
    if (typeof electron?.net?.fetch !== 'function' || !electron?.app?.isReady?.()) return null;
    return electron.net.fetch.bind(electron.net);
  } catch {
    return null;
  }
}

/** Set-Cookie 여러 줄에서 "이름=값" 만 모은다 — 같은 집(origin)에만 다시 보낸다 */
function mergeCookies(jar: Map<string, string>, headers: Headers): Map<string, string> {
  const next = new Map(jar);
  const lines: string[] = typeof (headers as any).getSetCookie === 'function'
    ? (headers as any).getSetCookie()
    : String(headers.get('set-cookie') || '').split(/,(?=\s*[^;,=\s]+=)/);
  for (const line of lines) {
    const pair = String(line || '').split(';')[0] || '';
    const eq = pair.indexOf('=');
    if (eq > 0) next.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  return next;
}

function cookieHeader(jar: Map<string, string>): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

/** Node fetch 로 리다이렉트를 손수 따라간다 — 쿠키를 들고 */
async function nodeFetchFollowing(url: string, signal: AbortSignal): Promise<Response> {
  let current = url;
  let jar = new Map<string, string>();
  let origin = '';
  for (let hop = 0; hop <= MAX_HOPS; hop += 1) {
    const u = new URL(current);
    if (u.origin !== origin) { jar = new Map(); origin = u.origin; }
    const headers: Record<string, string> = { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' };
    const cookie = cookieHeader(jar);
    if (cookie) headers['Cookie'] = cookie;
    const res = await fetch(current, { redirect: 'manual', signal, headers });
    jar = mergeCookies(jar, res.headers);
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel().catch(() => undefined);
      current = new URL(location, current).toString();
      continue;
    }
    // 마지막 주소를 기억시킨다 — Response.url 은 읽기 전용이라 새로 싼다
    Object.defineProperty(res, 'url', { value: current });
    return res;
  }
  throw new Error('redirect count exceeded');
}

/** 페이지를 연다. 실패는 던지지 않고 ok:false + errorCode 로 돌려준다 */
export async function fetchCtaPage(url: string, options: FetchPageOptions = {}): Promise<FetchedPage> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxChars = options.maxChars ?? 200_000;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const viaElectron = electronNetFetch();
    const res = viaElectron
      ? await viaElectron(url, { redirect: 'follow', signal: ctl.signal, headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' } })
      : await nodeFetchFollowing(url, ctl.signal);
    const finalUrl = res.url || url;
    if (!res.ok && !options.keepErrorBody) return { ok: false, html: '', finalUrl, status: res.status };
    const html = (await res.text().catch(() => '')).slice(0, maxChars);
    return { ok: res.ok, html, finalUrl, status: res.status };
  } catch (e: any) {
    const errorCode = String(e?.cause?.code || e?.code || e?.cause?.message || e?.message || '').slice(0, 60);
    return { ok: false, html: '', finalUrl: url, status: 0, errorCode };
  } finally {
    clearTimeout(timer);
  }
}

/** 레지스트리·게이트·재생성이 넣어 쓰는 꼴 */
export function createCtaPageFetcher(options: FetchPageOptions = {}): PageFetcher {
  return (url: string) => fetchCtaPage(url, options);
}
