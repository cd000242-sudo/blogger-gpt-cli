/**
 * Helper calls of the spider post that used a Gemini model: labels (tags) and meta description.
 *
 * These run ONLY when Gemini is the selected engine (API mode). In Agent mode the handler never calls
 * them: labels come from the existing title-noun extraction and the meta description is cut from the body
 * (`fallbackSpiderMetaDescription`). The prompts and parsing below are moved verbatim from main.ts.
 */

/** Minimal shape of a Gemini model — only what these helpers call. */
export interface SpiderGeminiModel {
  generateContent(request: unknown): Promise<{ response: { text(): string } | Promise<{ text(): string }> }>;
}

const plainOf = (html: string, limit: number): string =>
  (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, limit);

/** SEO labels (tags): up to 5, JSON array answer. Throws when the call itself fails. */
export async function generateSpiderGeminiLabels(model: SpiderGeminiModel, title: string, html: string): Promise<string[]> {
  const labelPrompt = `다음 한국어 블로그 글의 SEO 라벨(태그) 5개를 정확히 JSON 배열로만 출력하세요.
- 각 라벨은 2~10자 한글/영문/숫자, 검색 가능한 명사·핵심어 위주
- 띄어쓰기 포함 가능, 특수문자(#, ?, ! 등) 금지
- 글의 주제와 직결되는 표현만
- 중복 X, 너무 일반적인 단어("정보", "가이드" 단독) X

제목: ${title}
본문 일부 (앞 2000자):
${plainOf(html, 2000)}

출력 형식 — JSON 배열만 (다른 텍스트 X):
["라벨1", "라벨2", "라벨3", "라벨4", "라벨5"]`;
  const labelResult = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: labelPrompt }] }],
    generationConfig: { maxOutputTokens: 300, temperature: 0.3 },
  });
  const labelText = ((await labelResult.response).text() || '').trim();
  // Handles both ```json ... ``` and a bare [..]
  const arrayMatch = labelText.match(/\[[\s\S]*?\]/);
  if (!arrayMatch) return [];
  const parsed = JSON.parse(arrayMatch[0]);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((s: unknown) => String(s || '').trim())
    .filter((s) => s.length >= 2 && s.length <= 40)
    .slice(0, 5);
}

// Block-level tags split the body into lines; inline tags (strong, a, span) stay inside their line.
const BLOCK_TAG = /<\/?(?:p|div|h[1-6]|li|ul|ol|table|thead|tbody|tr|td|th|section|article|header|footer|blockquote|figure|figcaption|br)\b[^>]*>/gi;
const EMOJI_LEAD = /^[\p{Extended_Pictographic}️‍\s]+/u;
const UPDATED_LABEL = /^(?:last\s*updated|updated|최종\s*(?:수정|업데이트|확인)|업데이트|작성일|확인일)\b.{0,40}$/i;
const BOX_TITLES = '한눈에\\s*답변|핵심\\s*요약|한\\s*줄\\s*요약|한눈에\\s*보기|TL;?DR';
const BOX_TITLE_ONLY = new RegExp(`^(?:${BOX_TITLES}|요약|결론)$`, 'i');
// A box title glued to the first sentence: needs an emoji in front or a colon/dash after, so "핵심 요약 방법은 …" stays.
const BOX_TITLE_PREFIX = new RegExp(`^(?:[\\p{Extended_Pictographic}\\uFE0F\\u200D]+\\s*(?:${BOX_TITLES})\\s*[:：\\-–—]?|(?:${BOX_TITLES})\\s*[:：\\-–—])\\s*`, 'iu');
const MAX_LEAD_LABELS = 4;

/** Same plain-text conversion the handler has always used for the body (the "unchanged" baseline). */
const toPlain = (html: string): string => (html || '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim();

/** A short box title / date stamp line ("💡 한눈에 답변", "Last updated: …", "📌 핵심 정리") — not a sentence of the post. */
function isBoxLabel(line: string): boolean {
  const bare = line.replace(EMOJI_LEAD, '').trim();
  if (!bare) return true;
  if (UPDATED_LABEL.test(bare) || BOX_TITLE_ONLY.test(bare)) return true;
  return EMOJI_LEAD.test(line) && line.length <= 12 && !/[.!?。…]$/.test(line);
}

function stripGluedBoxTitle(text: string): string {
  const rest = text.replace(BOX_TITLE_PREFIX, '');
  return rest && rest !== text ? rest : text;
}

/**
 * Plain text for the summary (excerpt) and the fallback meta description: the body without its leading box
 * titles / labels, so the cut starts at the first real sentence. A body without such a lead gives exactly the old plain text.
 */
export function spiderSummarySource(html: string): string {
  const source = String(html || '');
  const whole = toPlain(source);
  const lines = source
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split(BLOCK_TAG)
    .map(toPlain)
    .filter(Boolean);
  let skip = 0;
  while (skip < lines.length && skip < MAX_LEAD_LABELS && isBoxLabel(lines[skip] ?? '')) skip += 1;
  // Nothing but labels: never return an empty summary — keep the old text
  if (skip > 0 && skip >= lines.length) return whole;
  if (skip === 0) return stripGluedBoxTitle(whole);
  return stripGluedBoxTitle(lines.slice(skip).join(' '));
}

/** Summary (excerpt): the first two sentences, up to 200 chars — the long-standing rule, now fed by `spiderSummarySource`. */
export function fallbackSpiderExcerpt(plainText: string): string {
  const plain = plainText || '';
  const sentences = plain.split(/(?<=[.。!?])\s+/);
  let excerpt = sentences.slice(0, 2).join(' ').substring(0, 200).trim();
  if (excerpt.length < 50 && plain.length > 50) excerpt = plain.substring(0, 200).trim();
  return excerpt;
}

/** Cut the body start as the meta description (the long-standing fallback, also the Agent-mode method). */
export function fallbackSpiderMetaDescription(plainText: string): string {
  let meta = (plainText || '').substring(0, 155).trim();
  if (meta.length > 152) meta = meta.substring(0, 152) + '…';
  return meta;
}

/**
 * Meta description by Gemini (140-160 chars target). Throws when the answer length is off,
 * and the caller falls back to `fallbackSpiderMetaDescription`.
 */
export async function generateSpiderGeminiMeta(
  getModel: () => Promise<SpiderGeminiModel>,
  input: { title: string; plainText: string; labels: string[] },
): Promise<string> {
  const metaModel = await getModel();
  const metaPrompt = `다음 블로그 글의 메타 디스크립션을 정확히 1줄로 작성하세요.

【글 제목】 ${input.title}
【본문 첫 500자】 ${input.plainText.substring(0, 500)}
【핵심 키워드】 ${(input.labels || []).slice(0, 5).join(', ') || '(없음)'}

요구사항:
- 정확히 140~160자 (한글 기준)
- 핵심 검색 키워드 1~2개 자연스럽게 포함
- 독자가 이 글을 클릭해서 얻을 수 있는 이익(혜택/방법/결과) 1줄 명시
- 끝에 행동 유도(CTA) 짧게 ("자세히 보기", "지금 확인" 등)
- 출력은 메타 디스크립션 텍스트 1줄만 (앞뒤 따옴표·마크다운 X)

예시: "2026년 청년내일저축계좌 자격조건과 신청방법을 한눈에 정리. 월 10만원 적금으로 1,440만원 목돈을 만드는 모든 방법, 지금 확인하세요."`;
  const metaResult = await metaModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: metaPrompt }] }],
    generationConfig: { maxOutputTokens: 200, temperature: 0.4 },
  });
  let aiMeta = ((await metaResult.response).text() || '').trim();
  // Strip quotes / markdown / surrounding whitespace, keep the first line only
  aiMeta = aiMeta.replace(/^["'`「『]+|["'`」』]+$/g, '').replace(/^\*+|\*+$/g, '').trim();
  aiMeta = (aiMeta.split(/\n+/)[0] || '').trim();
  if (aiMeta.length >= 100 && aiMeta.length <= 200) return aiMeta;
  throw new Error(`AI meta 길이 부적절: ${aiMeta.length}자`);
}
