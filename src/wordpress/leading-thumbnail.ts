/**
 * Leading-thumbnail removal for WordPress posts (shared by the first publish and the edit-publish path).
 *
 * WordPress themes draw the featured image above the title, so the same picture must not also sit at the very top
 * of the post body. Both removal points used to anchor on `^\s*`, which only saw a body that STARTS with the
 * thumbnail block. Posts from the agent / the editor / the spider are wrapped (`<article class="bgpt-wp-ready ...">`,
 * a leading `<style>` or JSON-LD `<script>`), so the block was never found and the picture showed twice (post 6657).
 * Tistory got the same fix in v3.8.695; this is the WordPress side.
 *
 * "First thing in the post" = nothing but whitespace, comments, `<style>`, `<script>` and OPENING container tags
 * stands in front of the block. A block that comes after text (summary box, paragraph) is a section image: untouched.
 */

/** Thumbnail blocks the apps write: the editor / Blogger-style `div.separator > img` and the agent's `figure > img`. */
const THUMB_BLOCK = /<div[^>]*class=["'][^"']*separator[^"']*["'][^>]*>\s*<img[\s\S]*?<\/div>|<figure[^>]*>\s*<img[\s\S]*?<\/figure>/iy;

/** What may stand in front of the block without being visible content. */
const NON_CONTENT = /\s+|<!--[\s\S]*?-->|<style\b[\s\S]*?<\/style\s*>|<script\b[\s\S]*?<\/script\s*>|<(?:article|section|main|div)\b[^>]*>/iy;

interface LeadingBlock {
  start: number;
  end: number;
  html: string;
}

/** The first thumbnail block of the post, when nothing visible stands in front of it. */
function findLeadingBlock(source: string): LeadingBlock | null {
  let at = 0;
  for (let guard = 0; guard < 200 && at < source.length; guard += 1) {
    THUMB_BLOCK.lastIndex = at;
    const block = THUMB_BLOCK.exec(source);
    if (block) return { start: at, end: at + block[0].length, html: block[0] };
    NON_CONTENT.lastIndex = at;
    const skipped = NON_CONTENT.exec(source);
    if (!skipped || skipped[0].length === 0) return null;
    at += skipped[0].length;
  }
  return null;
}

/** Same picture? A data: URL only equals itself; other addresses compare by file name (the image CDN wraps the host). */
function fileKey(url: string): string {
  const clean = url.replace(/[?#].*$/, '').replace(/^https?:\/\/i0\.wp\.com\//i, 'https://');
  return (clean.split('/').filter(Boolean).pop() || '').toLowerCase();
}

function samePicture(candidate: string, wanted: string): boolean {
  if (!candidate || !wanted) return false;
  if (candidate === wanted) return true;
  if (/^data:/i.test(candidate) || /^data:/i.test(wanted)) return false;
  const key = fileKey(wanted);
  return Boolean(key) && fileKey(candidate) === key;
}

function removeBlock(source: string, block: LeadingBlock): string {
  const head = source.slice(0, block.start);
  const rest = source.slice(block.end).trimStart();
  return (head.trim() === '' ? '' : head) + rest;
}

/** Removes the leading thumbnail block, whatever picture it is. */
export function stripLeadingBlock(html: string): string {
  const source = String(html || '');
  const block = findLeadingBlock(source);
  return block ? removeBlock(source, block) : source;
}

/**
 * Removes the leading thumbnail block ONLY when it is the picture used as the featured image
 * (a different picture may be a section image; deleting it would leave the post bare).
 */
export function stripLeadingImageMatching(html: string, featuredUrl: string): string {
  const source = String(html || '');
  const target = String(featuredUrl || '').trim();
  if (!source || !target) return source;

  const block = findLeadingBlock(source);
  if (!block) return source;

  const src = block.html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || '';
  const lazy = block.html.match(/data-(?:breeze|src|lazy-src)=["']([^"']+)["']/i)?.[1] || '';
  if (![src, lazy].some((found) => samePicture(found, target))) return source;

  return removeBlock(source, block);
}
