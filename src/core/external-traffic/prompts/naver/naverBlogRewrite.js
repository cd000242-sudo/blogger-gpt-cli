'use strict';

const { scoreTitleLocally } = require('./naverBlogTitleEngine');
const { scoreVariantLocally } = require('./naverBlogCritique');

const JSON_START = '<NAVER_BLOG_RESULT_JSON>';
const JSON_END = '</NAVER_BLOG_RESULT_JSON>';

const VARIANT_LABELS = {
  A: '검색 정리형',
  B: '경험 공감형',
  C: '체크리스트형',
};

const BANNED_PROMO_PHRASES = [
  '자세한 내용은 링크 확인',
  '자세한 내용은 링크에서 확인',
  '아래 링크 클릭',
  '지금 바로 확인',
  '본문 보러가기',
  '클릭하세요',
];

function buildStructuredOutputInstructions() {
  return `[출력 형식]
반드시 아래 XML 태그 사이에 JSON만 출력한다. Markdown 코드블록은 금지한다.
${JSON_START}
{
  "context": {
    "sourceTitle": "원문 제목",
    "coreTopic": "원문 핵심 주제",
    "articleType": "자동 분류 글 유형",
    "primaryKeyword": "핵심 키워드",
    "secondaryKeywords": ["보조 키워드"],
    "searchTerms": ["검색자가 입력할 만한 검색어"],
    "targetReader": "예상 독자",
    "readerQuestion": "검색자가 궁금해할 질문",
    "confusingPoint": "검색자가 헷갈릴 부분",
    "directInfo": ["본문에서 바로 제공할 정보"],
    "gatedInfo": ["원문으로 유도할 정보"],
    "mustKeepFacts": ["원문에서 확인된 사실"],
    "doNotUse": ["원문에 없어서 쓰면 안 되는 내용"],
    "riskyExpressions": ["과장하면 위험한 표현"]
  },
  "variants": [
    {
      "key": "A",
      "label": "검색 정리형",
      "articleType": "자동 분류 글 유형",
      "primaryKeyword": "핵심 키워드",
      "secondaryKeywords": ["보조 키워드"],
      "titleCandidates": [
        { "text": "제목 후보", "score": 90 }
      ],
      "selectedTitle": "선택한 제목",
      "titleScore": 90,
      "selectedReason": "선택 이유",
      "intro": "도입부",
      "sections": [
        { "heading": "소제목 1", "body": "본문 문단" },
        { "heading": "소제목 2", "body": "본문 문단" },
        { "heading": "소제목 3", "body": "본문 문단" }
      ],
      "sourceLead": "원문 유도 문장",
      "commentPrompt": "댓글 유도 문장",
      "hashtags": ["#해시태그"],
      "expectedClickStrength": "높음/중간/낮음",
      "critique": {
        "score": 90,
        "notes": "자체 비평",
        "breakdown": {
          "titleSearch": 15,
          "titleSpecific": 15,
          "context": 15,
          "length": 10,
          "tone": 10,
          "keyword": 10,
          "sourceLead": 10,
          "lowAd": 5,
          "truth": 10
        }
      },
      "finalRevision": {
        "title": "최종 제목",
        "intro": "최종 도입부",
        "sections": [
          { "heading": "최종 소제목 1", "body": "최종 본문 1" },
          { "heading": "최종 소제목 2", "body": "최종 본문 2" },
          { "heading": "최종 소제목 3", "body": "최종 본문 3" }
        ],
        "sourceLead": "최종 원문 유도 문장",
        "commentPrompt": "최종 댓글 유도 문장",
        "hashtags": ["#해시태그"]
      }
    }
  ]
}
${JSON_END}

variants는 A/B/C 3개만 만든다.
A는 검색 정리형, B는 경험 공감형, C는 체크리스트형이다.
각 variant의 titleCandidates는 반드시 10개다.
finalRevision에는 사용자가 복사해서 네이버 블로그에 바로 붙일 최종 글 구성요소만 넣는다.
최종 글은 700~1200자 안팎의 미니 포스트로 만든다.
해시태그는 원문 주제에 맞게 5~8개만 만든다.
원문 URL은 sourceLead에 자연스럽게 포함한다.
후보, 점수, 선택 이유, 비평은 finalRevision 안에 넣지 않는다.`;
}

function extractJsonBlock(rawText) {
  const text = String(rawText || '');
  const start = text.indexOf(JSON_START);
  const end = text.indexOf(JSON_END);
  let jsonText = '';
  if (start >= 0 && end > start) {
    jsonText = text.slice(start + JSON_START.length, end).trim();
  } else {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonText = text.slice(firstBrace, lastBrace + 1).trim();
    }
  }
  if (!jsonText) return null;
  jsonText = jsonText.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return [value];
}

function cleanText(value) {
  return String(value || '')
    .replace(new RegExp(JSON_START, 'g'), '')
    .replace(new RegExp(JSON_END, 'g'), '')
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripPromoPhrases(value) {
  let text = cleanText(value);
  for (const phrase of BANNED_PROMO_PHRASES) {
    text = text.replace(new RegExp(escapeRegExp(phrase), 'gi'), '');
  }
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeLooseJsonText(value) {
  return cleanText(String(value || '')
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\'));
}

function extractLooseStringField(block, field) {
  const re = new RegExp(`"${field}"\\s*:\\s*"([\\s\\S]*?)"\\s*(?:,\\s*(?="[_A-Za-z][_A-Za-z0-9]*"\\s*:)|(?=\\s*[}\\]]))`);
  const match = re.exec(String(block || ''));
  return match ? decodeLooseJsonText(match[1]) : '';
}

function extractLooseArrayField(block, field) {
  const re = new RegExp(`"${field}"\\s*:\\s*\\[([\\s\\S]*?)\\]`);
  const match = re.exec(String(block || ''));
  if (!match) return [];
  return Array.from(match[1].matchAll(/"([\s\S]*?)"/g))
    .map((item) => decodeLooseJsonText(item[1]))
    .filter(Boolean);
}

function findLooseObjectBlocks(rawText, key) {
  const text = String(rawText || '');
  const blocks = [];
  let searchFrom = 0;
  const needle = `"${key}"`;
  while (searchFrom < text.length) {
    const keyIndex = text.indexOf(needle, searchFrom);
    if (keyIndex < 0) break;
    const openIndex = text.indexOf('{', keyIndex);
    if (openIndex < 0) break;
    let depth = 0;
    let endIndex = -1;
    for (let i = openIndex; i < text.length; i++) {
      const ch = text[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }
    if (endIndex < 0) break;
    blocks.push({
      start: keyIndex,
      end: endIndex,
      block: text.slice(openIndex, endIndex),
    });
    searchFrom = endIndex;
  }
  return blocks;
}

function findLooseVariantSections(rawText) {
  const text = String(rawText || '');
  const markers = Array.from(text.matchAll(/"key"\s*:\s*"([ABC])"/g))
    .map((match) => ({ key: match[1], start: match.index || 0 }));
  return markers.map((marker, idx) => {
    const end = idx + 1 < markers.length ? markers[idx + 1].start : text.length;
    return {
      key: marker.key,
      block: text.slice(marker.start, end),
    };
  });
}

function normalizeContext(context) {
  const c = context && typeof context === 'object' ? context : {};
  return {
    sourceTitle: cleanText(c.sourceTitle),
    coreTopic: cleanText(c.coreTopic),
    articleType: cleanText(c.articleType),
    primaryKeyword: cleanText(c.primaryKeyword),
    secondaryKeywords: ensureArray(c.secondaryKeywords).map(cleanText).filter(Boolean).slice(0, 6),
    searchTerms: ensureArray(c.searchTerms).map(cleanText).filter(Boolean).slice(0, 8),
    targetReader: cleanText(c.targetReader),
    readerQuestion: cleanText(c.readerQuestion),
    confusingPoint: cleanText(c.confusingPoint),
    directInfo: ensureArray(c.directInfo).map(cleanText).filter(Boolean),
    gatedInfo: ensureArray(c.gatedInfo).map(cleanText).filter(Boolean),
    mustKeepFacts: ensureArray(c.mustKeepFacts).map(cleanText).filter(Boolean),
    doNotUse: ensureArray(c.doNotUse).map(cleanText).filter(Boolean),
    riskyExpressions: ensureArray(c.riskyExpressions).map(cleanText).filter(Boolean),
  };
}

function normalizeTitleCandidates(candidates, context) {
  return ensureArray(candidates)
    .map((item) => {
      if (typeof item === 'string') {
        return { text: cleanText(item), score: scoreTitleLocally(item, context) };
      }
      const text = cleanText(item && item.text);
      const score = Number(item && item.score) || scoreTitleLocally(text, context);
      return {
        text,
        score: Math.max(0, Math.min(100, Math.round(score))),
      };
    })
    .filter((item) => item.text)
    .slice(0, 10);
}

function normalizeSections(sections) {
  return ensureArray(sections)
    .map((section, idx) => {
      if (typeof section === 'string') {
        return { heading: `확인할 부분 ${idx + 1}`, body: stripPromoPhrases(section) };
      }
      return {
        heading: cleanText(section && section.heading),
        body: stripPromoPhrases(section && section.body),
      };
    })
    .filter((section) => section.heading || section.body)
    .slice(0, 4);
}

function normalizeHashtags(tags, context) {
  const fallback = [
    context.primaryKeyword,
    context.articleType,
    ...context.secondaryKeywords,
    '네이버블로그',
    '정보정리',
    '체크리스트',
  ];
  return [...ensureArray(tags), ...fallback]
    .flatMap((tag) => String(tag || '').split(/\s+/))
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.startsWith('#') ? tag : `#${tag.replace(/^#+/, '').replace(/[^\p{L}\p{N}_-]/gu, '')}`)
    .filter((tag) => tag.length > 1)
    .filter((tag, idx, arr) => arr.indexOf(tag) === idx)
    .slice(0, 8);
}

function normalizeVariant(raw, idx, context) {
  const keys = ['A', 'B', 'C'];
  const rawKey = cleanText(raw && raw.key).slice(0, 1).toUpperCase();
  const key = ['A', 'B', 'C'].includes(rawKey) ? rawKey : keys[idx] || 'A';
  const finalRevision = raw && raw.finalRevision && typeof raw.finalRevision === 'object' ? raw.finalRevision : {};
  const finalSections = normalizeSections(finalRevision.sections);
  const baseSections = normalizeSections(raw && raw.sections);
  const titleCandidates = normalizeTitleCandidates(raw && raw.titleCandidates, context);
  const selectedTitle = cleanText(
    raw && raw.selectedTitle
      || finalRevision.title
      || titleCandidates[0]?.text
      || context.sourceTitle
      || context.primaryKeyword
  );
  const titleScore = Math.max(
    Number(raw && raw.titleScore) || 0,
    scoreTitleLocally(selectedTitle, context)
  );
  const hashtags = normalizeHashtags(finalRevision.hashtags || (raw && raw.hashtags), context);
  const variant = {
    key,
    label: cleanText(raw && raw.label) || VARIANT_LABELS[key] || key,
    articleType: cleanText(raw && raw.articleType) || context.articleType,
    primaryKeyword: cleanText(raw && raw.primaryKeyword) || context.primaryKeyword,
    secondaryKeywords: ensureArray(raw && raw.secondaryKeywords).map(cleanText).filter(Boolean).slice(0, 6),
    titleCandidates,
    selectedTitle,
    titleScore: Math.min(100, Math.round(titleScore)),
    selectedReason: cleanText(raw && raw.selectedReason),
    intro: stripPromoPhrases(raw && raw.intro),
    sections: baseSections,
    sourceLead: stripPromoPhrases(raw && raw.sourceLead),
    commentPrompt: stripPromoPhrases(raw && raw.commentPrompt),
    hashtags,
    expectedClickStrength: cleanText(raw && raw.expectedClickStrength),
    critique: raw && raw.critique && typeof raw.critique === 'object' ? raw.critique : {},
    finalRevision: {
      title: cleanText(finalRevision.title || selectedTitle),
      intro: stripPromoPhrases(finalRevision.intro || (raw && raw.intro)),
      sections: finalSections.length ? finalSections : baseSections,
      sourceLead: stripPromoPhrases(finalRevision.sourceLead || (raw && raw.sourceLead)),
      commentPrompt: stripPromoPhrases(finalRevision.commentPrompt || (raw && raw.commentPrompt)),
      hashtags,
    },
    context,
  };
  const localScore = scoreVariantLocally(variant, context);
  const critiqueScore = Number(variant.critique.score) || 0;
  variant.critique.score = Math.max(localScore, critiqueScore);
  variant.recommended = variant.critique.score >= 95;
  variant.passed = variant.critique.score >= 90;
  return variant;
}

function orderUniqueNaverBlogVariants(variants) {
  const order = { A: 0, B: 1, C: 2 };
  const seen = new Set();
  return ensureArray(variants)
    .filter(Boolean)
    .sort((a, b) => (order[a.key] ?? 99) - (order[b.key] ?? 99))
    .filter((variant) => {
      const key = variant.key || '';
      if (key && seen.has(key)) return false;
      if (key) seen.add(key);
      return true;
    });
}

function buildCopyFromVariant(variant, { includeHashtags = true } = {}) {
  const finalRevision = variant && variant.finalRevision || {};
  const sections = normalizeSections(finalRevision.sections || variant.sections);
  const chunks = [
    finalRevision.title || variant.selectedTitle,
    finalRevision.intro || variant.intro,
    ...sections.flatMap((section) => [section.heading, section.body]),
    finalRevision.sourceLead || variant.sourceLead,
    finalRevision.commentPrompt || variant.commentPrompt,
  ].map(stripPromoPhrases).filter(Boolean);
  if (includeHashtags) {
    const hashtags = normalizeHashtags(finalRevision.hashtags || variant.hashtags, variant.context || {});
    if (hashtags.length) chunks.push(hashtags.join(' '));
  }
  return chunks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

function recoverLooseNaverBlogResult(rawText) {
  const text = String(rawText || '');
  if (!text.includes(JSON_START) && !text.includes('"finalRevision"')) return null;
  const contextBlock = findLooseObjectBlocks(text, 'context')[0]?.block || '';
  const context = normalizeContext({
    sourceTitle: extractLooseStringField(contextBlock, 'sourceTitle'),
    coreTopic: extractLooseStringField(contextBlock, 'coreTopic'),
    articleType: extractLooseStringField(contextBlock, 'articleType'),
    primaryKeyword: extractLooseStringField(contextBlock, 'primaryKeyword'),
    secondaryKeywords: extractLooseArrayField(contextBlock, 'secondaryKeywords'),
    searchTerms: extractLooseArrayField(contextBlock, 'searchTerms'),
    targetReader: extractLooseStringField(contextBlock, 'targetReader'),
    readerQuestion: extractLooseStringField(contextBlock, 'readerQuestion'),
    confusingPoint: extractLooseStringField(contextBlock, 'confusingPoint'),
  });

  const variantSections = findLooseVariantSections(text);
  const finalBlocks = findLooseObjectBlocks(text, 'finalRevision');
  if (!variantSections.length && !finalBlocks.length) return null;
  const recoverEntries = variantSections.length
    ? variantSections
    : finalBlocks.map((entry, idx) => ({
      key: ['A', 'B', 'C'][idx],
      block: text.slice(Math.max(0, entry.start - 4000), entry.end),
    }));

  const variants = recoverEntries.map((entry, idx) => {
    const finalBlock = findLooseObjectBlocks(entry.block, 'finalRevision')[0]?.block || '';
    const finalSource = finalBlock || entry.block;
    return normalizeVariant({
      key: extractLooseStringField(entry.block, 'key') || entry.key,
      label: extractLooseStringField(entry.block, 'label'),
      articleType: extractLooseStringField(entry.block, 'articleType'),
      primaryKeyword: extractLooseStringField(entry.block, 'primaryKeyword'),
      selectedTitle: extractLooseStringField(entry.block, 'selectedTitle'),
      titleScore: Number(extractLooseStringField(entry.block, 'titleScore')) || 0,
      selectedReason: extractLooseStringField(entry.block, 'selectedReason'),
      intro: extractLooseStringField(entry.block, 'intro'),
      sourceLead: extractLooseStringField(entry.block, 'sourceLead'),
      commentPrompt: extractLooseStringField(entry.block, 'commentPrompt'),
      hashtags: extractLooseArrayField(entry.block, 'hashtags'),
      finalRevision: {
        title: extractLooseStringField(finalSource, 'title'),
        intro: extractLooseStringField(finalSource, 'intro'),
        sourceLead: extractLooseStringField(finalSource, 'sourceLead'),
        commentPrompt: extractLooseStringField(finalSource, 'commentPrompt'),
        hashtags: extractLooseArrayField(finalSource, 'hashtags'),
      },
    }, idx, context);
  }).filter((variant) => buildCopyFromVariant(variant, { includeHashtags: false }));

  const orderedVariants = orderUniqueNaverBlogVariants(variants);
  return orderedVariants.length ? { context, variants: orderedVariants.slice(0, 3) } : null;
}

function parseNaverBlogResult(rawText) {
  const parsed = extractJsonBlock(rawText);
  if (!parsed || !Array.isArray(parsed.variants)) {
    return recoverLooseNaverBlogResult(rawText);
  }
  const context = normalizeContext(parsed.context);
  const variants = parsed.variants.slice(0, 3)
    .map((variant, idx) => normalizeVariant(variant, idx, context))
    .filter((variant) => buildCopyFromVariant(variant, { includeHashtags: false }));
  if (!variants.length) return recoverLooseNaverBlogResult(rawText);
  return {
    context,
    variants: orderUniqueNaverBlogVariants(variants).slice(0, 3),
  };
}

function buildFormattedFromNaverBlogResult(result) {
  if (!result || !Array.isArray(result.variants) || result.variants.length === 0) return null;
  const first = result.variants[0];
  const hashtags = normalizeHashtags(first.finalRevision && first.finalRevision.hashtags || first.hashtags, result.context || {});
  return {
    body: buildCopyFromVariant(first, { includeHashtags: false }),
    hashtags,
  };
}

module.exports = {
  JSON_START,
  JSON_END,
  buildStructuredOutputInstructions,
  extractJsonBlock,
  recoverLooseNaverBlogResult,
  parseNaverBlogResult,
  buildFormattedFromNaverBlogResult,
  buildCopyFromVariant,
  normalizeHashtags,
};
