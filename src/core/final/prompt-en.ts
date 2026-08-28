/**
 * prompt-en — 본문 생성 프롬프트의 **영어판 껍데기**. (v3.8.566 · 하네스 E2)
 *
 * ## 왜 파일을 따로 쓰는가
 * v3.8.565 에서 언어 규칙 한 줄만 영어로 바꿔 실제로 돌려 봤더니 **본문에 한글이 6,752자**
 * 남았다. 원인은 배선이 아니라 **껍데기 프롬프트 자체가 한국어**라는 것이었다
 * (135줄 중 한글 2,249자 / 영문 1,099자 = 67%). 한국어 지시문 한가운데 영어 한 줄은
 * 이길 수 있는 신호가 아니다.
 *
 * 그렇다고 한국어 템플릿 안에 `${lang==='en' ? ... : ...}` 를 오십 군데 끼우면
 * **한국어 경로가 같이 위험해진다.** 수백 편이 그 문장 그대로 나가고 있다.
 * 그래서 영어판은 **완전히 별도 함수**로 두고, `generateAllSectionsFinal` 이 둘 중 하나를 고른다.
 * 한국어 템플릿은 한 글자도 바뀌지 않는다.
 *
 * ## 번역이 아니라 다시 쓴 것이다
 * 원본에는 **한국어·한국 시장 전용 규칙**이 섞여 있다. 그대로 옮기면 영어로는 해롭다.
 *
 *   · "한 문장 2~3줄 넘기지 말 것"  — 한국어 기준 길이다. 영어는 단어 수로 재야 한다
 *   · "~해요/~거든요 로 쓸 것"      — 한국어 문체 지시. 영어엔 대응물이 없다
 *   · "말할 필요도 없이" 상투구 목록 — 한국어 상투구다. 영어 상투구는 완전히 다르다
 *   · "8월 3일 기준" 날짜 꼬리표 예시 — 표현이 한국어다
 *
 * 반대로 **언어와 무관한 규칙**은 그대로 살린다. 이쪽이 이 프롬프트의 핵심 자산이다.
 *   · 표가 본문을 대신하지 못한다 (실제 사고에서 나온 규칙)
 *   · 허용 태그 화이트리스트, 이모지·라벨 금지
 *   · H3 아키타입 다양화, 두괄식, JSON 출력 형식
 *
 * ⚠️ JSON 출력 형식은 **한국어판과 완전히 동일해야 한다.** 파서가 같은 코드다.
 */

/* ═══════════════════════════════════════════════════════════════════════
   제목 (v3.8.567)

   한국어판의 **논리는 그대로 가져온다** — 검색자가 실제로 친 말을 쓰고,
   두루뭉실한 제목은 큰 사이트에 밀리므로 좁고 구체적으로 간다.
   바꾸는 건 언어에 매인 것뿐이다:
     · 길이 25~35자  → 영어는 **60자**가 기준이다(검색 결과에서 잘리는 폭)
     · "완벽 가이드·총정리·꿀팁" 금지 목록 → 영어 상투구는 완전히 다르다
     · "2026년"을 맨 앞에 → 영어는 연도를 뒤에 두는 게 자연스럽다
   ═══════════════════════════════════════════════════════════════════════ */

export interface EnglishTitlePromptParams {
  keyword: string;
  currentYear: number;
  /** 검색자가 실제로 물어본 것 — 있으면 스타일보다 우선한다 */
  // exactOptionalPropertyTypes 가 켜져 있어 undefined 를 명시해야 호출부에서 그냥 넘길 수 있다
  userQuestions?: string[] | undefined;
  searchQueries?: string[] | undefined;
  /** 참고할 상위 노출 제목들 */
  titleReference?: string | undefined;
}

export function buildEnglishTitlePrompt(p: EnglishTitlePromptParams): string {
  const clean = (list?: string[]) => [...new Set((list || [])
    .map((s) => String(s || '').replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 4 && s.length <= 80))].slice(0, 8);
  const qs = clean(p.userQuestions);
  const kw = clean(p.searchQueries);

  const demandBlock = (qs.length || kw.length) ? `
🔎🔎 **What people actually searched — this outranks every style rule below**
${qs.length ? `Real questions:\n${qs.map((q) => `  · ${q}`).join('\n')}\n` : ''}${kw.length ? `Searched alongside:\n${kw.map((k) => `  · ${k}`).join('\n')}\n` : ''}
- Put **what they were stuck on** into the title. That is why someone clicks.
- Do not copy a question verbatim. Turn it into the situation or condition they are in.
  e.g. question "is it still good after the sale ends?" → title carries "after the sale ends"
- **Be narrow.** Broad titles are already owned by big sites. The specific phrase someone
  actually typed is where a small site wins.
  ❌ "A Guide to Choosing"   ✅ "Which One Survives a 4-Minute Boil"
- Do not invent a concern that is not in the list above.
` : '';

  return `You write headlines for an English-language site.

Now: ${p.currentYear}
Keyword: ${p.keyword}
${p.titleReference || ''}${demandBlock}

**Rules**

📏 **Length — 60 characters or fewer.**
· Google rewrites 60–76% of titles, and length is the biggest reason.
· Search results cut off at a fixed width. A truncated title does not get clicked.

🎯 **Front-load the keyword.** Both Google and readers weight the opening words.
· Do not bury the keyword at the end of the sentence.

🚫 **Do not use these** — too many pages use them, so titles blur together:
Ultimate Guide · Complete Guide · Everything You Need to Know · The Definitive ·
A to Z · All You Need · Must-Know · Explained: · You Won't Believe · Game-Changer
→ Instead, put the one **specific thing** only this article has: a number, a condition, a verdict.

- Use the keyword **once**. Twice reads badly and does not help ranking.
- Add the year only if the answer genuinely changes year to year (policy, pricing, models).
  In English the year goes at the **end**, not the front: "… in ${p.currentYear}", never "${p.currentYear} …".
- Never mention something that has already ended.
- English only. No Korean, Chinese characters, or Japanese.
- No colon-stacking ("Guide: What to Know: 2026 Edition"). One clause, or two at most.
- No emoji.
- Sentence case or title case — pick one and stay consistent within the title.

🔎 **A reader must be able to tell, from the title alone, that this page answers their question.**
  ❌ "Instant Noodle Information"      ✅ "Which Korean Ramen Is Actually Spicy"
  ❌ "Cooking Tips Roundup"            ✅ "Why the Packet Says 550ml and Not 500"

Output exactly one title. No quotes, no numbering, no explanation.`;
}

/* ═══════════════════════════════════════════════════════════════════════
   결론 요약표 + "결론부터" 블록 (v3.8.567)

   ⚠️ `basis` 지시가 v3.8.564 사고의 발원지다.
   한국어판은 "근거가 되는 기관 이름과 기준 시점"을 **무조건 요구**해서, 레시피처럼
   인용할 기관이 없는 주제에서 모델이 "기관명과 기준 시점 본문 미기재" 라고
   지시문을 되돌려 줬고 그게 그대로 발행됐다.
   영어판은 처음부터 **"없으면 빈 문자열"** 을 분명히 못박는다.
   ═══════════════════════════════════════════════════════════════════════ */

export function buildEnglishSummaryTablePrompt(cleanedContent: string, todayStr: string): string {
  return `
📅 Today: ${todayStr}
Article text (plain):

${cleanedContent.slice(0, 2000)}

Build a short summary grid from the text above.

🚫 **Absolute rules**
1. Summarize only what the text actually says. Never add information that is not there.
2. **Cell values are plain text only.** No HTML, no <div>, <img>, <a>, buttons.
3. No price lists or product names — those live elsewhere. This is the summary.
4. Keep each cell under 40 characters. Avoid comma-strung lists.
5. Quote numbers exactly as they appear in the text.
6. English only. No Korean, Chinese characters, or Japanese.

✅ Good:
["Who it suits", "First-time buyers"]
["Cook time", "4 minutes 30 seconds"]

❌ Never output:
["Product", "<div class='...'>Jacket $289 <button>Buy</button></div>"]

🎯 **Also write the three "answer first" lines.**
These go at the very top of the article, so a reader who reads nothing else still has the answer.
- question: the one thing the reader came to find out. Under 70 characters. A question mark is optional.
- answer: the actual answer in 2–4 sentences, using the numbers and conditions from the text.
  Never write "we will look at this below" — the answer finishes here.
- basis: **only if the text names a real source** (an organisation, a manufacturer, a study)
  along with when it applies. Format: "FDA · Aug 2026" or "Nongshim official · 2026".
  ⚠️ If the text names no such source, set basis to **an empty string ""**.
  Do **not** write "not specified", "unknown", "n/a", or any sentence explaining that it is missing —
  that text would be printed to the reader as if it were the source. Empty string only.
  Most food, hobby, and how-to topics have no institutional source. That is normal.
If the text does not contain the answer, leave answer as an empty string. Do not invent one.

JSON:
{
  "type": "summary",
  "question": "the question the reader searched",
  "answer": "2-4 sentence answer grounded in the text",
  "basis": "source · date, or empty string",
  "headers": ["Item", "Detail"],
  "rows": [
    ["Main point", "from the text"],
    ["Who it suits", "from the text"]
  ]
}

JSON only (plain-text cells):
`;
}

/* ═══════════════════════════════════════════════════════════════════════
   H2 소제목 (v3.8.567)

   한국어판의 핵심(중복 금지 · 아키타입 섞기 · 보일러플레이트 금지)은 언어 무관이라 유지한다.
   바꾸는 건 길이 기준(15~20자 → 영어는 단어 수)과 아키타입 예시뿐이다.
   ═══════════════════════════════════════════════════════════════════════ */

export function buildEnglishH2Prompt(params: {
  keyword: string;
  targetCount: number;
  currentYear: number;
  /** 언어 무관 블록들 — 그대로 얹는다 */
  scopeBlock?: string;
  intentBlock?: string;
  subheadingReference?: string;
}): string {
  return `
Keyword: ${params.keyword}
${params.scopeBlock || ''}${params.intentBlock || ''}
${params.subheadingReference || ''}

🔴 **Core rule — no two headings may overlap**
1. Every H2 covers a genuinely different question or angle.
2. Do not restate one idea two ways ("How to cook it" and "The cooking method" are one heading).
3. **Break the pattern.** Do not end every heading the same way.
4. Mix shapes deliberately:
   - Direct answer — "How Long It Actually Takes"
   - Comparison — "Packet Instructions vs Everything You Have Heard"
   - Checklist — "What to Check Before You Start"
   - Ranked — "Five Ways, Ordered by How Much They Change the Result"
   - Correction — "What Most Guides Get Wrong Here"

**Requirements**
1. Each heading must promise information the others do not.
2. 3–8 words. Written the way a reader would search, not as a textbook chapter.
3. 🔴 No numbering or prefixes. Heading text only.
4. Specific enough that a reader can tell what they will learn.
5. Year: only ${params.currentYear} if a year is needed at all. Never a past year.
6. Nothing that has already ended.
7. **English only.** No Korean, Chinese characters, or Japanese.
8. Banned boilerplate — these say nothing:
   "What It Is and Why It Matters" · "Key Information" · "Practical Examples and Steps"
   "Summary of Key Points" · "Related Information You May Like"
9. No colons. No "Introduction" or "Conclusion".

Output JSON only — an array of ${params.targetCount} strings:
`;
}

/* ═══════════════════════════════════════════════════════════════════════
   FAQ (v3.8.567)

   한국어판의 규칙 8번이 특히 좋다 — "모르면 '공식 사이트에서 확인하세요'로 때우지 말고
   판단 기준과 확인 절차를 구체적으로 답하라". 그건 언어와 무관해서 그대로 옮긴다.
   말투 지시("~해요/~거든요")만 영어에 맞게 바꾼다.
   ═══════════════════════════════════════════════════════════════════════ */

export function buildEnglishFaqPrompt(params: {
  keyword: string;
  h2Titles: string[];
  todayStr: string;
  scopeBlock?: string;
  groundingBlock?: string;
}): string {
  return `
Keyword: ${params.keyword}
${params.scopeBlock || ''}📅 Today: ${params.todayStr}

Section headings:
${params.h2Titles.map((h, i) => `${i + 1}. ${h}`).join('\n')}
${params.groundingBlock || ''}

Write 5 questions a reader would actually ask after reading this article.

Rules:
1. Phrase each question the way someone would type it into Google
   (e.g. "how much does ${params.keyword} cost?").
2. Answer in 3–4 sentences. Lead with the answer.
3. Any number, duration, or price must come from the article text above. Never invent one.
4. Do not add facts the article does not contain. Ask what a reader would wonder **next**.
5. Plain, direct English. Contractions are fine. No corporate register, no hedging.
6. Nothing that has already ended — current or upcoming only.
7. **English only.** No Korean, Chinese characters, or Japanese.
8. 🔴 Never guess. **But do not dodge either** — "check the official website" is not an answer.
   If you do not have the value, give the decision rule instead: what changes the outcome,
   and exactly where to look (named organisation, the specific page or menu).
   At least 3 of the 5 answers must carry a real number, duration, price, or named source
   from the text above.
9. Do not end an answer with a command ("so make sure you check", "be sure to prepare").
   End on the fact.

JSON format:
[
  {"question": "question 1", "answer": "answer 1"},
  {"question": "question 2", "answer": "answer 2"}
]
`;
}

export interface EnglishBodyPromptParams {
  keyword: string;
  todayStr: string;
  /** "1. xxx\n2. yyy" 형태의 H2 목록 (한국어판과 같은 값) */
  h2List: string;
  h2Count: number;
  /** 크롤링/초안 참고 블록 — 언어와 무관하게 그대로 넘어온다 */
  contentReference: string;
  draftReference: string;
  /** 모드 플러그인이 만든 섹션 지시 */
  modePromptBlock: string;
  sectionGuideBlock: string;
  /** H3 한 개당 최소 글자수 (영어는 단어 수로 환산해 함께 제시한다) */
  minCharsPerH3: number;
}

/** 영어는 글자보다 단어로 재는 게 자연스럽다 — 대략 5.5자/단어로 환산 */
function toWords(chars: number): number {
  return Math.max(80, Math.round(chars / 5.5));
}

export function buildEnglishBodyPrompt(p: EnglishBodyPromptParams): string {
  const words = toWords(p.minCharsPerH3);

  return `
🎯 Topic keyword: ${p.keyword}

📅 Today: ${p.todayStr}
⚠️ Date rule: Do not mention programs, events, or deadlines that already ended before ${p.todayStr}.
   Cover only what is currently running or still ahead.
🚫 Do not stamp dates onto sentences.
   "As of August 3", "Currently in August 2026", "At the time of writing" do not build trust —
   they are the clearest tell that a machine wrote the sentence. People writing from experience
   do not talk that way. Fold timing into the sentence only when it genuinely matters
   (a limited offer, a rule that changes on a known date).
   ❌ "As of August 3, the price is $29.90."
   ✅ "It is $29.90 right now, and that goes up when the sale ends."

⚠️ Language rule: Write everything in natural English — headings, body, tables, FAQ, captions.
   Do not use Korean, Chinese characters, or Japanese anywhere.
   Write for a reader who does not know Korean. When a Korean term is unavoidable,
   romanize it and explain it in one short clause the first time it appears.
   ✅ "gochugaru (Korean chili flakes)" · "ramyeon (Korean instant noodles)"
   Never leave a Korean word standing alone without that gloss.

📌 What to produce:
1. An introduction for the whole article
2. Body sections following the H2 list below
${p.h2List}
3. A conclusion for the whole article

${p.contentReference}
${p.draftReference}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 **[MODE INSTRUCTIONS — these override every general rule below]**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${p.modePromptBlock}${p.sectionGuideBlock}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1. Readability — earn the scroll]
- **Short sentences.** Most sentences under 20 words. Break anything longer.
- **Breathing space.** A paragraph is 2–4 sentences, then a new <p>. Never a wall of text.
- **Lists.** Use <ul>/<ol> at least once per section where it genuinely helps.
- **Answer first.** Open every H3 with the conclusion, then explain. Never build up to it.

[2. 🚨 HIGHEST PRIORITY — this must not read like a translation]
A native reader spots translated-from-Korean English in one paragraph, the same way a Korean
reader instantly spots English translated word-for-word. If it reads translated, the page is dead
no matter how accurate it is. Write as someone who thinks in English, not someone converting.

The tells, and what to do instead:

- **Connector padding.** Korean writing links clauses; English writing cuts them.
  ❌ "In addition, moreover, furthermore, it is also worth noting that…"
  ✅ Start the next sentence with the fact. No connector at all.

- **Softening and hedging.** Korean politeness turns into limp English.
  ❌ "It is recommended that you may want to consider checking…"
  ✅ "Check the seasoning packet first."
  Give the instruction. Do not apologise for giving it.

- **Passive voice and empty subjects.**
  ❌ "It can be said that the noodles are known to be firm."
  ✅ "The noodles stay firm."

- **Over-explaining.** Korean posts restate the point in three ways. English readers leave.
  Say it once, with the specific detail. Then move on.

- **Weight-bearing filler.** "Various", "numerous", "a wide range of", "plays an important role",
  "when it comes to", "in terms of" — cut every one. Replace with the actual number or noun.

- **Sentence rhythm.** Vary length deliberately. A long sentence, then a short one.
  Uniform 25-word sentences are the clearest sign of machine translation.

- **Korean context assumed.** Never assume the reader knows Korean brands, stores, portions,
  or customs. "You can get it at any GS25" means nothing abroad — say what GS25 is,
  or say where a reader outside Korea actually buys it.

- **Units and money.** Convert or give both. "550ml (about 2.3 cups)". Never leave won alone.

Read your own paragraph back and ask: *would an English-speaking food writer have written this
sentence?* If it only makes sense as a rendering of a Korean sentence, rewrite it.

[3. Sound like a person who actually knows this]
- Write plainly. Cut hedging ("it is important to note", "there are many benefits",
  "in today's fast-paced world"). These are the sentences readers skim past.
- Address the reader directly when it helps ("If you only remember one thing, make it this").
  Do **not** claim first-hand experience you were not given.
- Intro: 2–4 short paragraphs that say what the reader will get and why this page is different.
  Conclusion: 2–3 paragraphs that leave a decision, not a farewell.
  Never end with "I hope this helped" or "In conclusion".

[4. Density and trust]
- Replace vague statements with specific ones: numbers, ranges, named products, prices, timings.
- Use a number only if it appears in the supplied evidence. **Never invent a figure or a source.**
- 🔴 Never claim credentials ("20 years of experience", "certified expert"). Authority comes
  from how specific the writing is, not from a title.

[5. Section length]
- Each H3 body must be at least **${words} words** (~${p.minCharsPerH3} characters).
- No repetition across H3 sections. Each one carries information the others do not.
- Do not use mechanical connectors ("In conclusion", "To summarize", "Moving on").

🔥 [Tables and checklists]
- Put specs, prices, steps, and trade-offs into a <table> or checklist instead of prose.
- At most one table per H3, only where it earns its place.
- The goal is to make the reader stop and read again.

🚨 [ABSOLUTE RULE — a table never replaces the body]
- **"content" must never be empty**, including H3 sections that carry a table.
- If a section instruction says "comparison table required", that means **in addition to** the body.
  A table with an empty content field leaves the reader staring at a heading. This has actually happened.
- An H3 that has a table must still contain:
  ① one paragraph on why the table matters (what is being compared, on what basis)
  ② one paragraph stating **what the table shows** — not a restatement of the numbers,
     but which option wins and for whom
  ③ one paragraph on exceptions and caveats
  → The article must still make sense with the table removed. Tables assist; they do not carry.

🔥 [Vary the shape of each H3]
Do not repeat one rigid structure. Pick whichever fits the section:
  1. Step-by-step procedure
  2. Comparison — A vs B, trade-offs, who each suits
  3. Checklist — what to verify, in order
  4. Narrative — start from a situation the reader recognises, move to facts
  5. Data-led — numbers first, interpretation second

🚫🚫 [Remove every machine tell — highest priority]
⛔ No emoji anywhere in content (🔥💡📋✅💎👉 …)
⛔ No labels or prefixes on paragraphs ("Key point:", "Tip:", "In practice:")
⛔ No numbered emoji (1️⃣, 2️⃣ …)
⛔ No markers that interrupt the reading flow
⛔ Inside h3Sections[].content, never emit <h1>, <h2>, <div>, <img>, <button>,
   <a href="buy">, <iframe>, <script>, <form>
   - H2 headings are inserted by the system
   - Never generate product cards, price widgets, or buy buttons (the system renders those separately)
   - content may use only: <p>, <ul>, <ol>, <li>, <blockquote>, <table>, <thead>, <tbody>,
     <tr>, <th>, <td>, <strong>, <em>
⛔ If a link is needed, plain <a href="...">text</a> only — no styling, buttons, or images
⛔ Never start content with "1. ", "2. " — the system numbers headings
✅ Plain prose only

🚫 [Banned — these cost you the reader]
- Thin paragraphs under 40 words
- Unsupported superlatives ("the best", "perfect", "guaranteed")
- 🔴 Cross-references between sections ("as we saw above", "in the next section",
  "let us move on"). Every block must stand alone.
- 🚫 Opening a sentence with an empty formula. These carry zero information for someone
  who searched their way to this page:
  "It goes without saying", "Needless to say", "As we all know",
  "More people than you think", "In today's fast-paced world",
  "Whether you are a beginner or an expert", "This is no longer optional but essential"
  Do not write them in the first place — do not rely on a later pass to strip them.
  ❌ "Needless to say, air conditioning is essential in summer."
  ✅ "Only units rated under 42 dB are quiet enough to run overnight."

JSON format (follow this structure exactly):
{
  "introduction": "<p>intro paragraph 1</p><p>intro paragraph 2…</p>",
  "conclusion": "<p>conclusion paragraph 1</p><p>what to do next…</p>",
  "sections": [
    {
      "h2": "first H2 heading",
      "h3Sections": [
        {"h3": "short H3 heading (3-6 words)", "content": "<p>…</p>", "tables": []}
      ]
    },
    …${p.h2Count} H2 sections in total
  ]
}

🚨 Final check
□ Are sentences short and paragraphs broken up for phone reading?
□ Does it read like someone who knows the subject, with no filler openers?
□ Is every H3 body at least ${words} words?
□ Is there a <blockquote> or <ul> where the reader would want to pause?
□ Do the intro and conclusion do real work instead of greeting and thanking?
□ Is there any Korean text left anywhere? There must be none.

🔴 **The [MODE INSTRUCTIONS] block above overrides these general rules.** If a section
carries its own requirements (required elements, role, minimum length), apply them to that H2.

Output JSON only (no commentary, no markdown fences):`;
}
