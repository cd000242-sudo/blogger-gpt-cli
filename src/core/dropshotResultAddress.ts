/**
 * Dropshot result-picture address check (v3.8.773).
 *
 * The board used to show a finished job as a direct address:
 *   https://img.aistudio.dropshot.io/.../public/jobs/prod/<job>/output/output_0.jpg?w=1920&q=75
 * Since the 2026-11 site build every <img> goes through the site's resizing endpoint instead (measured 2026-11-12):
 *   https://aistudio.dropshot.io/api/media/image?src=<encoded cdn address>&w=384
 * where the real picture address sits in the `src` query value (https://cdn.aistudio.dropshot.io/public/jobs/prod/<job>/output/output_0.png).
 * Logos, banners and sample pictures use the same endpoint, so the decision has to look at the embedded address.
 */

const DROPSHOT_HOST = /(^|\.)dropshot\.io$/i;
const MEDIA_PROXY_PATH = '/api/media/image';

function parseAddress(value: string, base?: string): URL | null {
  try {
    return base ? new URL(value, base) : new URL(value);
  } catch {
    return null;
  }
}

function isDropshotJobPath(url: URL): boolean {
  return DROPSHOT_HOST.test(url.hostname) && /\/jobs\//.test(url.pathname);
}

/** True when the address points at a generated job result (direct address or through the media proxy). */
export function isDropshotJobResultAddress(src: string): boolean {
  const url = parseAddress(String(src || '').trim());
  if (!url || !DROPSHOT_HOST.test(url.hostname)) return false;
  if (isDropshotJobPath(url)) return true;
  if (url.pathname !== MEDIA_PROXY_PATH) return false;
  const embedded = url.searchParams.get('src');
  if (!embedded) return false;
  const inner = parseAddress(embedded, url.origin);
  return !!inner && isDropshotJobPath(inner);
}
