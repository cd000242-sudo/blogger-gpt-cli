'use strict';

const JSON_START = '<THREADS_RESULT_JSON>';
const JSON_END = '</THREADS_RESULT_JSON>';

const VARIANT_LABELS = {
  A: '댓글형',
  B: '공감형',
  C: '공유형',
};

const BANNED_PROMO_PHRASES = [
  '자세한 내용은 링크에서 확인해보세요',
  '자세한 내용은 링크 확인',
  '확인해보시기 바랍니다',
  '확인하시기 바랍니다',
  '부탁드립니다',
  '지금 바로 클릭',
  '무조건',
  '100% 보장',
];

function buildStructuredOutputInstructions() {
  return `[출력 형식]
반드시 아래 XML 태그 사이에 JSON만 출력한다. Markdown 코드블록은 금지한다.
${JSON_START}
{
  "context": {
    "sourceTitle": "원문 제목",
    "coreTopic": "핵심 주제",
    "articleType": "자동 분류한 글 유형",
    "targetReader": "예상 독자",
    "readerSituation": "독자가 지금 놓인 상황",
    "mainQuestion": "댓글로 이어질 질문",
    "commentAngle": "댓글이 달릴 만한 관점",
    "shareReason": "공유할 이유",
    "linkReason": "링크를 남겨도 자연스러운 이유",
    "mustKeepFacts": ["원문에서 확인된 사실"],
    "doNotUse": ["원문에 없어서 쓰면 안 되는 내용"]
  },
  "variants": [
    {
      "key": "A",
      "label": "댓글형",
      "tone": "친구에게 툭 말하는 반말",
      "goal": "댓글을 먼저 끌어내는 글",
      "hookEngine": "질문/반전/공감/논쟁 중 선택한 훅",
      "firstLineCandidates": [
        { "text": "첫 줄 후보", "score": 90 }
      ],
      "selectedFirstLine": "선택한 첫 줄",
      "firstLineScore": 90,
      "selectedReason": "선택 이유",
      "body": "초안 본문",
      "commentPrompt": "댓글 유도 한 줄",
      "sharePrompt": "공유 유도 한 줄",
      "linkPrompt": "자연스러운 링크 한 줄 또는 URL",
      "critique": {
        "score": 90,
        "notes": "자체 비평",
        "breakdown": {
          "threadTone": 20,
          "hook": 20,
          "comment": 20,
          "share": 10,
          "lowAd": 15,
          "truth": 15
        }
      },
      "finalRevision": {
        "firstLine": "최종 첫 줄",
        "body": "최종 본문",
        "commentPrompt": "최종 댓글 유도",
        "sharePrompt": "최종 공유 유도",
        "linkPrompt": "최종 링크 한 줄 또는 URL"
      }
    }
  ]
}
${JSON_END}

variants는 A/B/C 3개만 만든다.
A는 댓글형, B는 공감형, C는 공유형이다.
각 variant의 firstLineCandidates는 반드시 10개다.
finalRevision에는 사용자가 복사해서 바로 올릴 최종 게시문 구성요소만 넣는다.
후보, 점수, 비평, JSON 설명은 finalRevision 안에 절대 넣지 않는다.
해시태그는 쓰지 않는다.
최종 글은 URL 포함 500자 이내로 만든다.`;
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
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^#[\p{L}\p{N}_-]+(?:\s+#[\p{L}\p{N}_-]+)*$/u.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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

function normalizeCandidates(candidates) {
  return ensureArray(candidates)
    .map((item) => {
      if (typeof item === 'string') {
        return { text: cleanText(item), score: scoreFirstLineLocally(item) };
      }
      const text = cleanText(item && item.text);
      const score = Number(item && item.score) || scoreFirstLineLocally(text);
      return {
        text,
        score: Math.max(0, Math.min(100, Math.round(score))),
      };
    })
    .filter((item) => item.text)
    .slice(0, 10);
}

function scoreFirstLineLocally(text) {
  const line = cleanText(text).split('\n')[0] || '';
  let score = 52;
  if (line.length >= 14 && line.length <= 46) score += 15;
  if (/[?？]$/.test(line)) score += 12;
  if (/(솔직히|나만|이거|근데|알고 있었|헷갈|놓치|애매|진짜)/.test(line)) score += 12;
  if (/(클릭|링크|확인|바로|자세한|부탁)/.test(line)) score -= 18;
  if (line.length > 60) score -= 14;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreVariantLocally(variant) {
  const copy = buildCopyFromVariant(variant);
  let score = 50;
  if (variant.firstLineScore >= 80) score += 12;
  if (/[?？]/.test(copy)) score += 12;
  if (/(나만|솔직히|근데|댓글|어떻게 생각|너네는|다들)/.test(copy)) score += 12;
  if (/(공유|친구|주변|저장)/.test(copy)) score += 6;
  if (/(자세한 내용|확인해보시기|부탁드립니다|지금 바로 클릭)/.test(copy)) score -= 25;
  if (copy.length > 500) score -= 14;
  if (/https?:\/\//.test(copy)) score += 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeContext(context) {
  const c = context && typeof context === 'object' ? context : {};
  return {
    sourceTitle: cleanText(c.sourceTitle),
    coreTopic: cleanText(c.coreTopic),
    articleType: cleanText(c.articleType),
    targetReader: cleanText(c.targetReader),
    readerSituation: cleanText(c.readerSituation),
    mainQuestion: cleanText(c.mainQuestion),
    commentAngle: cleanText(c.commentAngle),
    shareReason: cleanText(c.shareReason),
    linkReason: cleanText(c.linkReason),
    mustKeepFacts: ensureArray(c.mustKeepFacts).map(cleanText).filter(Boolean),
    doNotUse: ensureArray(c.doNotUse).map(cleanText).filter(Boolean),
  };
}

function normalizeVariant(raw, idx, context) {
  const keys = ['A', 'B', 'C'];
  const rawKey = cleanText(raw && raw.key).slice(0, 1).toUpperCase();
  const key = ['A', 'B', 'C'].includes(rawKey) ? rawKey : keys[idx] || 'A';
  const finalRevision = raw && raw.finalRevision && typeof raw.finalRevision === 'object' ? raw.finalRevision : {};
  const candidates = normalizeCandidates(raw && raw.firstLineCandidates);
  const selectedFirstLine = stripPromoPhrases(
    raw && raw.selectedFirstLine
      || finalRevision.firstLine
      || candidates[0]?.text
      || ''
  );
  const firstLineScore = Math.max(
    Number(raw && raw.firstLineScore) || 0,
    scoreFirstLineLocally(selectedFirstLine)
  );
  const variant = {
    key,
    label: cleanText(raw && raw.label) || VARIANT_LABELS[key] || key,
    tone: cleanText(raw && raw.tone),
    goal: cleanText(raw && raw.goal),
    hookEngine: cleanText(raw && raw.hookEngine),
    firstLineCandidates: candidates,
    selectedFirstLine,
    firstLineScore: Math.min(100, Math.round(firstLineScore)),
    selectedReason: cleanText(raw && raw.selectedReason),
    body: stripPromoPhrases(raw && raw.body),
    commentPrompt: stripPromoPhrases(raw && raw.commentPrompt),
    sharePrompt: stripPromoPhrases(raw && raw.sharePrompt),
    linkPrompt: stripPromoPhrases(raw && raw.linkPrompt),
    critique: raw && raw.critique && typeof raw.critique === 'object' ? raw.critique : {},
    finalRevision: {
      firstLine: stripPromoPhrases(finalRevision.firstLine || selectedFirstLine),
      body: stripPromoPhrases(finalRevision.body || (raw && raw.body) || ''),
      commentPrompt: stripPromoPhrases(finalRevision.commentPrompt || (raw && raw.commentPrompt) || ''),
      sharePrompt: stripPromoPhrases(finalRevision.sharePrompt || (raw && raw.sharePrompt) || ''),
      linkPrompt: stripPromoPhrases(finalRevision.linkPrompt || (raw && raw.linkPrompt) || ''),
    },
    context,
  };
  const localScore = scoreVariantLocally(variant);
  const critiqueScore = Number(variant.critique.score) || 0;
  variant.critique.score = Math.max(localScore, critiqueScore);
  variant.recommended = variant.critique.score >= 92 || idx === 0;
  variant.passed = variant.critique.score >= 85;
  return variant;
}

function orderUniqueThreadsVariants(variants) {
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

function buildCopyFromVariant(variant) {
  const finalRevision = variant && variant.finalRevision || {};
  return [
    finalRevision.firstLine || variant.selectedFirstLine,
    finalRevision.body || variant.body,
    finalRevision.commentPrompt || variant.commentPrompt,
    finalRevision.sharePrompt || variant.sharePrompt,
    finalRevision.linkPrompt || variant.linkPrompt,
  ]
    .map(stripPromoPhrases)
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function recoverLooseThreadsResult(rawText) {
  const text = String(rawText || '');
  if (!text.includes(JSON_START) && !text.includes('"finalRevision"')) return null;

  const contextBlock = findLooseObjectBlocks(text, 'context')[0]?.block || '';
  const context = normalizeContext({
    sourceTitle: extractLooseStringField(contextBlock, 'sourceTitle'),
    coreTopic: extractLooseStringField(contextBlock, 'coreTopic'),
    articleType: extractLooseStringField(contextBlock, 'articleType'),
    targetReader: extractLooseStringField(contextBlock, 'targetReader'),
    readerSituation: extractLooseStringField(contextBlock, 'readerSituation'),
    mainQuestion: extractLooseStringField(contextBlock, 'mainQuestion'),
    commentAngle: extractLooseStringField(contextBlock, 'commentAngle'),
    shareReason: extractLooseStringField(contextBlock, 'shareReason'),
    linkReason: extractLooseStringField(contextBlock, 'linkReason'),
    mustKeepFacts: extractLooseArrayField(contextBlock, 'mustKeepFacts'),
    doNotUse: extractLooseArrayField(contextBlock, 'doNotUse'),
  });

  const variantSections = findLooseVariantSections(text);
  const finalBlocks = findLooseObjectBlocks(text, 'finalRevision');
  if (!variantSections.length && !finalBlocks.length) return null;

  const recoverEntries = variantSections.length
    ? variantSections
    : finalBlocks.map((entry, idx) => ({
      key: ['A', 'B', 'C'][idx],
      block: text.slice(Math.max(0, entry.start - 2200), entry.end),
    }));

  const variants = recoverEntries.map((entry, idx) => {
    const finalBlock = findLooseObjectBlocks(entry.block, 'finalRevision')[0]?.block || '';
    const finalSource = finalBlock || entry.block;
    return normalizeVariant({
      key: extractLooseStringField(entry.block, 'key') || entry.key,
      label: extractLooseStringField(entry.block, 'label'),
      tone: extractLooseStringField(entry.block, 'tone'),
      goal: extractLooseStringField(entry.block, 'goal'),
      hookEngine: extractLooseStringField(entry.block, 'hookEngine'),
      selectedFirstLine: extractLooseStringField(entry.block, 'selectedFirstLine'),
      firstLineScore: Number(extractLooseStringField(entry.block, 'firstLineScore')) || 0,
      selectedReason: extractLooseStringField(entry.block, 'selectedReason'),
      body: extractLooseStringField(entry.block, 'body'),
      commentPrompt: extractLooseStringField(entry.block, 'commentPrompt'),
      sharePrompt: extractLooseStringField(entry.block, 'sharePrompt'),
      linkPrompt: extractLooseStringField(entry.block, 'linkPrompt'),
      finalRevision: {
        firstLine: extractLooseStringField(finalSource, 'firstLine'),
        body: extractLooseStringField(finalSource, 'body'),
        commentPrompt: extractLooseStringField(finalSource, 'commentPrompt'),
        sharePrompt: extractLooseStringField(finalSource, 'sharePrompt'),
        linkPrompt: extractLooseStringField(finalSource, 'linkPrompt'),
      },
    }, idx, context);
  }).filter((variant) => buildCopyFromVariant(variant));

  const orderedVariants = orderUniqueThreadsVariants(variants);
  return orderedVariants.length ? { context, variants: orderedVariants.slice(0, 3) } : null;
}

function parseThreadsResult(rawText) {
  const parsed = extractJsonBlock(rawText);
  if (!parsed || !Array.isArray(parsed.variants)) {
    return recoverLooseThreadsResult(rawText);
  }
  const context = normalizeContext(parsed.context);
  const variants = parsed.variants.slice(0, 3)
    .map((variant, idx) => normalizeVariant(variant, idx, context))
    .filter((variant) => buildCopyFromVariant(variant));
  if (!variants.length) return recoverLooseThreadsResult(rawText);
  return {
    context,
    variants: orderUniqueThreadsVariants(variants).slice(0, 3),
  };
}

function buildFormattedFromThreadsResult(result) {
  if (!result || !Array.isArray(result.variants) || result.variants.length === 0) return null;
  const first = result.variants[0];
  return {
    body: buildCopyFromVariant(first),
  };
}

module.exports = {
  JSON_START,
  JSON_END,
  buildStructuredOutputInstructions,
  extractJsonBlock,
  recoverLooseThreadsResult,
  parseThreadsResult,
  buildFormattedFromThreadsResult,
  buildCopyFromVariant,
};
