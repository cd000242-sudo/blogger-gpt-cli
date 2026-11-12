/**
 * WordPress auto-tag helpers - pure functions, no I/O (field report 2026-11-12).
 *
 * Posts published on 11/9 carried the tag "object Object" plus raw title words ("방법과", "예약하는", "직접").
 *   - Collection used to pad the list with title words, so the publisher always saw "pre-generated tags"
 *     and never asked the AI for real ones.
 *   - The only title fallback kept particles and verb forms.
 * Now: collect only real tags, let the publisher top the list up with AI tags, and keep a tidied title
 * fallback for the case where the AI call fails.
 */
import { sanitizeTagNames, tagTextsFromBucket } from '../core/tag-hygiene';

/** Below this many usable tags the publisher asks the AI for more. */
export const TAGS_WANTED_MIN = 5;
/** Candidate list size handed to resolveTags (which still applies its own per-post cap, MAX_TAGS_PER_POST). */
export const TAGS_MERGE_MAX = 8;
const COLLECT_MAX = 10;
const TAG_MIN_LEN = 2;
const TAG_MAX_LEN = 20;

/** Text produced when an object / missing value was stringified upstream. */
const JUNK_TAG_PATTERN = /^(\[\s*object\s+object\s*\]|object\s+object|undefined|null|nan)$/i;

/** True when the text is a stringified-object / missing-value leftover, never a real tag. */
export function isJunkTagText(value: unknown): boolean {
  if (typeof value !== 'string') return true;
  return JUNK_TAG_PATTERN.test(value.replace(/^#/, '').trim());
}

/**
 * Real tags found in the payload "buckets" (generatedLabels, metadata.tags, payload.keywords ...), in order.
 * Objects give their name field, junk text is dropped, and nothing is invented: fewer than wanted stays fewer.
 */
export function collectTagCandidates(buckets: readonly unknown[], max: number = COLLECT_MAX): string[] {
  const collected: string[] = [];
  for (const bucket of buckets) {
    if (!bucket) continue;
    for (const text of tagTextsFromBucket(bucket)) {
      const tag = text.replace(/^#/, '').trim();
      if (!tag || tag.length < TAG_MIN_LEN || tag.length > TAG_MAX_LEN) continue;
      if (isJunkTagText(tag) || collected.includes(tag)) continue;
      collected.push(tag);
      if (collected.length >= max) return collected;
    }
  }
  return collected;
}

/** `primary` first, then `extra`: junk removed, normalized, de-duplicated, at most `max`. */
export function mergeTagLists(primary: readonly string[], extra: readonly string[], max: number = TAGS_MERGE_MAX): string[] {
  const all = [...primary, ...extra].filter((tag) => !isJunkTagText(tag));
  return sanitizeTagNames(all, max);
}

/**
 * Tags to publish: the usable pre-generated tags, topped up with AI tags when fewer than TAGS_WANTED_MIN.
 * `generate` is the publisher's own AI call (the selected engine, no engine swap). A failing or junk-returning
 * AI never blocks publishing - the usable tags that already exist are used as they are.
 */
export async function completeTagsWithAi(
  provided: readonly string[] | undefined,
  generate: () => Promise<string[]>,
  warn: (message: string, error?: unknown) => void = console.warn,
): Promise<string[]> {
  const usable = mergeTagLists(Array.isArray(provided) ? provided : [], []);
  if (usable.length >= TAGS_WANTED_MIN) return usable;

  let generated: string[] = [];
  try {
    const result = await generate();
    if (Array.isArray(result)) generated = result;
  } catch (error) {
    warn('[WP-TAGS] AI tag generation failed; publishing with the tags that are already usable', error);
  }
  return mergeTagLists(usable, generated);
}

/** Particles stripped from the end of a title word, longest first. */
const TRAILING_PARTICLES = ['으로', '에서', '과', '와', '은', '는', '이', '가', '을', '를', '의', '에', '로', '도', '만'];

/** Verb / adnominal endings: the word is a phrase piece, not a keyword ("예약하는", "위한"). */
const VERB_ENDING = /(하는법|하는|되는|하기|되기|위한|위해|하면|하려면|하고|하며|하여|해서|하세요|받는|받기|있는|없는|보는|보기)$/;

/** Nouns that merely end in a particle-looking syllable; cutting them would leave a broken word ("신용평" ...). */
const NOUN_WITH_PARTICLE_LOOK = /(제도|한도|평가|도로|지도|정도|속도|온도|강도|합의|협의|회의|동의|논의)$/;

/** Words that say nothing as a tag. */
const NOISE_WORDS = new Set([
  '직접', '방법', '총정리', '정리', '확인', '안내', '가이드', '추천', '최신', '비법', '꿀팁', '모음', '소개',
  '완벽', '쉽게', '한눈에', '바로', '모든', '그리고', '하지만', '이번', '오늘', '최근', '관련', '대한', '대해',
  '이런', '저런', '어떤', '통해', '경우',
]);

function stripTrailingParticle(word: string): string {
  if (!/[가-힣]$/.test(word) || NOUN_WITH_PARTICLE_LOOK.test(word)) return word;
  const particle = TRAILING_PARTICLES.find((p) => word.endsWith(p));
  return particle ? word.slice(0, word.length - particle.length) : word;
}

function tidyTitleWord(raw: string): string {
  if (VERB_ENDING.test(raw) || NOISE_WORDS.has(raw)) return '';
  const stem = stripTrailingParticle(raw);
  if (stem.length < TAG_MIN_LEN || NOISE_WORDS.has(stem) || VERB_ENDING.test(stem)) return '';
  return stem;
}

/**
 * Last-resort tags from the title (used only when the AI call fails): split on spaces, cut a trailing particle,
 * drop verb forms and meaningless words, drop what is shorter than 2 characters afterwards. No morphological analysis.
 */
export function extractTitleTagsFallback(title: string, max: number = TAGS_MERGE_MAX): string[] {
  if (!title) return [];
  const words = String(title).replace(/[^가-힣a-zA-Z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const tags: string[] = [];
  for (const raw of words) {
    const word = tidyTitleWord(raw);
    if (!word || tags.includes(word)) continue;
    tags.push(word);
    if (tags.length >= max) break;
  }
  return tags;
}
