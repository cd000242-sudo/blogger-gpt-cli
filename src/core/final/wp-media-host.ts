// WordPress media-library hosting for generated images.
//
// Moved out of the spider handler's `_hostGeneratedImage` (electron/main.ts) so the editor's "regenerate image"
// path uploads to the SAME place: a WordPress post should keep its pictures in its own media library, not in an
// external image host. Behaviour is unchanged: POST /wp-json/wp/v2/media, 60 s timeout, one retry after 1.5 s,
// `source_url` (or `guid.rendered`) of the answer is the hosted address. On failure the caller falls back to the
// external hosts exactly as before. Credentials are only used for the Authorization header and never logged.

export interface WpMediaCreds {
  siteUrl: string;
  username: string;
  password: string;
}

/** Minimal axios-like POST, injectable so the upload can be tested without a network. */
export type WpMediaPost = (
  url: string,
  data: Buffer,
  config: { headers: Record<string, string>; timeout: number; maxBodyLength: number; maxContentLength: number },
) => Promise<{ data?: any }>;

export interface WpMediaUploadOptions {
  /** File name prefix, also used in log lines. */
  label?: string;
  /** Target platform of the post, for the log line only. */
  platform?: string;
  post?: WpMediaPost;
  attempts?: number;
  retryDelayMs?: number;
}

const MEDIA_TIMEOUT_MS = 60_000;
const MAX_BODY_BYTES = 50 * 1024 * 1024;

function firstText(sources: Array<Record<string, any> | undefined>, keys: string[]): string {
  for (const source of sources) {
    if (!source) continue;
    for (const key of keys) {
      const value = String(source[key] ?? '').trim();
      if (value) return value;
    }
  }
  return '';
}

/**
 * Site address + account from the screen payload (`wordpress*`) or the saved settings (`WORDPRESS_*`).
 * Earlier sources win. Returns null unless all three are present.
 */
export function pickWpMediaCreds(...sources: Array<Record<string, any> | undefined>): WpMediaCreds | null {
  const siteUrl = firstText(sources, ['wordpressSiteUrl', 'WORDPRESS_SITE_URL']).replace(/\/+$/, '');
  const username = firstText(sources, ['wordpressUsername', 'WORDPRESS_USERNAME']);
  const password = firstText(sources, ['wordpressPassword', 'WORDPRESS_PASSWORD']);
  return siteUrl && username && password ? { siteUrl, username, password } : null;
}

/** 'wp-media' for a WordPress post; 'wp-media-hotlink' when another platform borrows the WordPress library. */
export function wpMediaProvider(targetPlatform: string): string {
  return String(targetPlatform || '').toLowerCase() === 'wordpress' ? 'wp-media' : 'wp-media-hotlink';
}

async function defaultPost(url: string, data: Buffer, config: Parameters<WpMediaPost>[2]) {
  const axios = (await import('axios')).default;
  return axios.post(url, data, config);
}

/** Uploads an image data URL to the media library. Returns the hosted address, or null when every attempt failed. */
export async function uploadDataUrlToWpMedia(
  dataUrl: string,
  creds: WpMediaCreds,
  options: WpMediaUploadOptions = {},
): Promise<string | null> {
  const match = String(dataUrl || '').match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (!match) return null;
  const label = options.label || 'image';
  const mime = match[1]!;
  const ext = (mime.split('/')[1] || 'png').replace('+xml', '');
  const body = Buffer.from(match[2]!, 'base64');
  const filename = `${label}-${Date.now()}.${ext}`;
  const authorization = `Basic ${Buffer.from(`${creds.username}:${creds.password}`).toString('base64')}`;
  const post = options.post || defaultPost;
  const attempts = options.attempts ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 1500;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await post(`${creds.siteUrl.replace(/\/+$/, '')}/wp-json/wp/v2/media`, body, {
        headers: {
          Authorization: authorization,
          'Content-Type': mime,
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
        timeout: MEDIA_TIMEOUT_MS,
        maxBodyLength: MAX_BODY_BYTES,
        maxContentLength: MAX_BODY_BYTES,
      });
      const src = res?.data && (res.data.source_url || (res.data.guid && res.data.guid.rendered));
      if (typeof src === 'string' && src) {
        console.log(`[IMG-HOST] ✅ WP 미디어 업로드 성공 (${label}, attempt=${attempt}, platform=${options.platform || 'unknown'}):`, src.substring(0, 80));
        return src;
      }
      console.warn(`[IMG-HOST] WP 응답에 source_url 없음 (${label}, attempt=${attempt})`);
    } catch (e: any) {
      console.warn(`[IMG-HOST] WP 업로드 실패 (${label}, attempt=${attempt}):`, String(e?.message || e).substring(0, 200));
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  return null;
}
