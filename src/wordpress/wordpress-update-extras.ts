// Edit-publish extras: excerpt, tags, SEO title and meta description for an existing WordPress post.
//
// The publisher (wordpress-publisher.ts) already knows how to write these on a NEW post:
//   - excerpt            -> `excerpt` in the post body
//   - tags               -> sanitizeTagNames -> /tags?search= (exact match reuse) -> POST /tags when missing -> ids
//   - SEO title / desc.  -> `meta` keys of the installed SEO plugin (buildSeoMetaPayload, shared with updateSeoMeta)
//   - SEO title          -> the post title with emoji stripped
// The edit path used to send only title / content / featured image, so a retitled post kept its old
// <title>, description, excerpt and tags. This module reuses those same steps for an update.
// Everything here is best effort: a failed extra never fails the post update, it comes back as a warning.
import { buildSeoMetaPayload, detectSeoPluginsFromNamespaces, type SeoPluginId } from './wordpress-api';
import { matchExistingTag, sanitizeTagNames } from '../core/tag-hygiene';

/** Authenticated REST call against `/wp-json/wp/v2` (the caller owns the credentials; nothing here sees them). */
export type WpRequest = (endpoint: string, init?: RequestInit) => Promise<Response>;

export interface WordPressUpdateExtras {
  excerpt?: string;
  /** Tag NAMES (not ids). An empty array changes nothing. */
  tags?: string[];
  seoTitle?: string;
  metaDescription?: string;
}

export type UpdateExtraName = 'excerpt' | 'tags' | 'seoTitle' | 'metaDescription';

const SEO_DETECT_TIMEOUT_MS = 15_000;

/** Same emoji stripping the publisher applies before it uses the title as the SEO title. */
const EMOJI_PATTERN = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}📌✅🔥💡🚀📊🎯⚡❤️🔍📷🔗🎁💰📅]/gu;

export function toSeoTitle(title: string): string {
  const source = String(title || '');
  return source.replace(EMOJI_PATTERN, '').replace(/\s{2,}/g, ' ').trim() || source.trim();
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeUpdateExtras(raw: WordPressUpdateExtras): Required<WordPressUpdateExtras> {
  const tags = Array.isArray(raw.tags) ? raw.tags.map((tag) => String(tag ?? '')).filter((tag) => tag.trim()) : [];
  return { excerpt: text(raw.excerpt), tags, seoTitle: text(raw.seoTitle), metaDescription: text(raw.metaDescription) };
}

export function hasUpdateExtras(extras: Required<WordPressUpdateExtras>): boolean {
  return !!(extras.excerpt || extras.tags.length || extras.seoTitle || extras.metaDescription);
}

/**
 * SEO fields to write. A title passed together with any extra, without an explicit SEO title, moves the SEO title
 * to the new post title (the publisher uses the post title as the SEO title on first publish).
 * A plain call with no extras never touches SEO — it stays exactly what it was before this module existed.
 */
export function planSeoFields(title: string, extras: Required<WordPressUpdateExtras>): { seoTitle: string; metaDescription: string } {
  const derived = !extras.seoTitle && title && hasUpdateExtras(extras) ? toSeoTitle(title) : '';
  return { seoTitle: extras.seoTitle || derived, metaDescription: extras.metaDescription };
}

async function readJson(request: WpRequest, endpoint: string, init?: RequestInit): Promise<any> {
  const response = await request(endpoint, init);
  if (!response.ok) throw new Error(`WordPress API 오류 (HTTP ${response.status})`);
  return response.json();
}

/**
 * Tag names -> ids, the way WordPressPublisher.resolveTags does it (kept separate on purpose: tag-hygiene.test pins
 * that private method's source). Existing tag by exact name first, create only when missing, one re-search when
 * the creation lost a race. Never throws.
 */
export async function resolveTagIds(request: WpRequest, names: string[]): Promise<{ ids: number[]; warnings: string[] }> {
  const cleaned = sanitizeTagNames(names);
  if (cleaned.length === 0) return { ids: [], warnings: ['사용할 수 있는 태그가 없어 태그는 바꾸지 않았습니다.'] };

  const search = async (name: string) => matchExistingTag(
    name, await readJson(request, `/tags?search=${encodeURIComponent(name)}&per_page=100`),
  );
  const ids: number[] = [];
  const skipped: string[] = [];
  for (const name of cleaned) {
    let tag: { id: number; name: string } | null = null;
    try { tag = await search(name); } catch { /* fall through to creation, like the publisher */ }
    if (!tag) {
      try {
        tag = await readJson(request, '/tags', { method: 'POST', body: JSON.stringify({ name, description: '' }) });
      } catch {
        try { tag = await search(name); } catch { /* skipped below */ }
      }
    }
    if (tag && Number(tag.id) > 0) ids.push(Number(tag.id)); else skipped.push(name);
  }

  const warnings: string[] = [];
  if (ids.length === 0) warnings.push('태그를 찾거나 만들지 못해 태그는 바꾸지 않았습니다.');
  else if (skipped.length) warnings.push(`태그 ${skipped.length}개는 만들지 못해 빠졌습니다: ${skipped.join(', ')}`);
  return { ids, warnings };
}

/** Same detection as WordPressAPI.detectSeoPlugins: namespaces of the REST root. [] = unknown (send every key). */
async function detectSeoPlugins(siteUrl: string): Promise<SeoPluginId[]> {
  try {
    const response = await fetch(`${siteUrl}/wp-json/`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(SEO_DETECT_TIMEOUT_MS),
    });
    if (!response.ok) return [];
    return detectSeoPluginsFromNamespaces(((await response.json()) as any)?.namespaces);
  } catch {
    return [];
  }
}

const SEO_LABEL = { seoTitle: 'SEO 제목', metaDescription: 'SEO 메타 설명' } as const;

/**
 * Writes the SEO title / meta description with the same `meta` keys the publisher uses, only for the fields
 * given, then reads the post's answer back: a key the site does not expose over REST is silently ignored by
 * WordPress, which is exactly how the old title stayed in <title>. Never throws.
 */
export async function saveSeoFields(
  request: WpRequest,
  siteUrl: string,
  postId: string,
  seo: { seoTitle: string; metaDescription: string },
): Promise<{ saved: Array<'seoTitle' | 'metaDescription'>; warnings: string[] }> {
  const wanted = (['seoTitle', 'metaDescription'] as const).filter((field) => seo[field]);
  if (wanted.length === 0) return { saved: [], warnings: [] };
  try {
    const plugins = await detectSeoPlugins(siteUrl);
    const data = { title: seo.seoTitle, description: seo.metaDescription };
    const response = await request(`/posts/${encodeURIComponent(postId)}`, {
      method: 'PUT',
      body: JSON.stringify({ meta: buildSeoMetaPayload(plugins, data, { onlyProvided: true }) }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const echoed = ((await response.json()) as any)?.meta || {};

    const saved: Array<'seoTitle' | 'metaDescription'> = [];
    const warnings: string[] = [];
    for (const field of wanted) {
      const value = seo[field];
      const probe = field === 'seoTitle' ? { title: value } : { description: value };
      const keys = Object.keys(buildSeoMetaPayload(plugins, probe, { onlyProvided: true }));
      if (keys.some((key) => String(echoed[key] ?? '') === value)) saved.push(field);
      else warnings.push(`${SEO_LABEL[field]}이(가) 저장됐다는 확인을 받지 못했습니다. SEO 플러그인이 REST 로 메타 값을 열어 두지 않았을 수 있습니다.`);
    }
    return { saved, warnings };
  } catch (error: any) {
    const reason = String(error?.message || error).slice(0, 120);
    return { saved: [], warnings: [`${wanted.map((field) => SEO_LABEL[field]).join('·')} 저장 요청이 실패했습니다 (${reason}).`] };
  }
}
