'use strict';

const { scoreFirstLineLocally, scoreVariantLocally } = require('./instagramCritique');

const JSON_START = '<INSTAGRAM_RESULT_JSON>';
const JSON_END = '</INSTAGRAM_RESULT_JSON>';

function buildStructuredOutputInstructions() {
  return `[출력 형식]
반드시 아래 XML 태그 사이에 JSON만 출력하라. Markdown 코드블록은 금지.
${JSON_START}
{
  "context": {
    "sourceTitle": "원문 제목",
    "coreTopic": "원문 핵심 주제",
    "articleType": "자동 분류된 글 유형",
    "targetReader": "예상 독자",
    "readerSituation": "독자의 현재 상황",
    "mainQuestion": "독자가 가장 궁금해할 질문",
    "confusingPoint": "독자가 헷갈릴 부분",
    "lossPoint": "놓치면 손해라고 느낄 부분",
    "saveChecklist": ["저장할 체크 요소"],
    "shareTarget": "공유할 만한 대상",
    "commentQuestion": "댓글 유도 질문",
    "preClickInfo": "링크 클릭 전에 보여줄 정보",
    "clickReason": "링크를 눌러 확인할 정보",
    "mustKeepFacts": ["원문에서 지켜야 할 사실"],
    "doNotUse": ["원문에 없어서 쓰면 안 되는 내용"],
    "riskyExpressions": ["과장하면 위험한 표현"]
  },
  "variants": [
    {
      "key": "A",
      "label": "저장형",
      "tone": "저장형 정보글",
      "articleType": "자동 분류된 글 유형",
      "targetReader": "예상 독자",
      "goal": "주요 목표",
      "hookEngine": "선택한 후킹 엔진",
      "firstLineCandidates": [
        { "text": "첫 줄 후보", "score": 90 }
      ],
      "selectedFirstLine": "선택된 첫 줄",
      "firstLineScore": 90,
      "selectedReason": "선택 이유",
      "body": "본문",
      "savePrompt": "저장 유도",
      "sharePrompt": "공유 유도",
      "commentPrompt": "댓글 유도",
      "linkPrompt": "링크 유도",
      "hashtags": ["#해시태그"],
      "expectedClickStrength": "높음/중간/낮음",
      "critique": {
        "score": 90,
        "notes": "자체 비평",
        "breakdown": {
          "hook": 15,
          "context": 15,
          "save": 15,
          "share": 10,
          "reader": 15,
          "link": 10,
          "lowAd": 10,
          "truth": 10
        }
      },
      "finalRevision": {
        "firstLine": "최종 첫 줄",
        "body": "최종 본문",
        "savePrompt": "최종 저장 유도",
        "sharePrompt": "최종 공유 유도",
        "commentPrompt": "최종 댓글 유도",
        "linkPrompt": "최종 링크 유도",
        "hashtags": ["#해시태그"]
      }
    }
  ]
}
${JSON_END}

variants는 A/B/C 3개만 만든다.
A는 저장형, B는 공감형, C는 경고형이다.
각 firstLineCandidates는 반드시 10개다.
해시태그는 각 안마다 8~12개다.
본문의 한 문장은 20~35자 중심, 한 문단은 1~2줄 중심으로 짧게 줄바꿈한다.
finalRevision은 사용자가 복사할 최종 게시문만 담는다.`;
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

function decodeLooseJsonText(value) {
  return String(value || '')
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
  const inner = match[1];
  const quoted = Array.from(inner.matchAll(/"([\s\S]*?)"/g))
    .map((item) => decodeLooseJsonText(item[1]))
    .filter(Boolean);
  const inlineTags = inner.match(/#[\p{L}\p{N}_-]+/gu) || [];
  return quoted.length ? quoted : inlineTags;
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

function recoverLooseInstagramResult(rawText) {
  const text = String(rawText || '');
  if (!text.includes(JSON_START) && !text.includes('"finalRevision"')) return null;

  const contextBlock = findLooseObjectBlocks(text, 'context')[0]?.block || '';
  const context = {
    sourceTitle: extractLooseStringField(contextBlock, 'sourceTitle'),
    coreTopic: extractLooseStringField(contextBlock, 'coreTopic'),
    articleType: extractLooseStringField(contextBlock, 'articleType'),
    targetReader: extractLooseStringField(contextBlock, 'targetReader'),
    readerSituation: extractLooseStringField(contextBlock, 'readerSituation'),
    clickReason: extractLooseStringField(contextBlock, 'clickReason'),
  };

  const variantSections = findLooseVariantSections(text);
  const finalBlocks = findLooseObjectBlocks(text, 'finalRevision');
  if (!variantSections.length && !finalBlocks.length) return null;

  const recoverEntries = variantSections.length
    ? variantSections
    : finalBlocks.map((entry, idx) => ({ key: ['A', 'B', 'C'][idx], block: text.slice(Math.max(0, entry.start - 2500), entry.end) }));

  const variants = recoverEntries.map((entry, idx) => {
    const finalBlock = findLooseObjectBlocks(entry.block, 'finalRevision')[0]?.block || '';
    const finalSource = finalBlock || entry.block;
    const finalRevision = {
      firstLine: extractLooseStringField(finalSource, 'firstLine') || extractLooseStringField(entry.block, 'selectedFirstLine'),
      body: extractLooseStringField(finalSource, 'body'),
      savePrompt: extractLooseStringField(finalSource, 'savePrompt'),
      sharePrompt: extractLooseStringField(finalSource, 'sharePrompt'),
      commentPrompt: extractLooseStringField(finalSource, 'commentPrompt'),
      linkPrompt: extractLooseStringField(finalSource, 'linkPrompt'),
      hashtags: normalizeHashtags(extractLooseArrayField(finalSource, 'hashtags')),
    };
    const raw = {
      key: extractLooseStringField(entry.block, 'key') || entry.key || ['A', 'B', 'C'][idx],
      label: extractLooseStringField(entry.block, 'label'),
      tone: extractLooseStringField(entry.block, 'tone'),
      articleType: extractLooseStringField(entry.block, 'articleType'),
      targetReader: extractLooseStringField(entry.block, 'targetReader'),
      goal: extractLooseStringField(entry.block, 'goal'),
      hookEngine: extractLooseStringField(entry.block, 'hookEngine'),
      selectedFirstLine: extractLooseStringField(entry.block, 'selectedFirstLine') || finalRevision.firstLine,
      selectedReason: extractLooseStringField(entry.block, 'selectedReason'),
      body: extractLooseStringField(entry.block, 'body'),
      savePrompt: extractLooseStringField(entry.block, 'savePrompt'),
      sharePrompt: extractLooseStringField(entry.block, 'sharePrompt'),
      commentPrompt: extractLooseStringField(entry.block, 'commentPrompt'),
      linkPrompt: extractLooseStringField(entry.block, 'linkPrompt'),
      hashtags: normalizeHashtags(extractLooseArrayField(entry.block, 'hashtags')),
      expectedClickStrength: extractLooseStringField(entry.block, 'expectedClickStrength'),
      finalRevision,
    };
    return normalizeVariant(raw, idx, context);
  }).filter((variant) => buildCopyFromVariant(variant));
  const orderedVariants = orderUniqueInstagramVariants(variants);

  return orderedVariants.length ? { context, variants: orderedVariants.slice(0, 3) } : null;
}

function orderUniqueInstagramVariants(variants) {
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

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return [value];
}

function normalizeHashtags(tags) {
  return ensureArray(tags)
    .flatMap((tag) => String(tag || '').split(/\s+/))
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.startsWith('#') ? tag : `#${tag.replace(/^#+/, '')}`)
    .filter((tag, idx, arr) => arr.indexOf(tag) === idx)
    .slice(0, 12);
}

const FALLBACK_HASHTAGS = [
  '#정보공유',
  '#생활정보',
  '#꿀팁',
  '#체크리스트',
  '#저장필수',
  '#오늘의정보',
  '#정리글',
  '#블로그정보',
];

function buildFallbackInstagramHashtags(context, text) {
  const stop = new Set([
    '있는', '없는', '그리고', '하지만', '입니다', '합니다', '대한', '위해',
    '확인', '정보', '정리', '본문', '최종', '기준', '방법',
  ]);
  const source = [
    context && context.sourceTitle,
    context && context.coreTopic,
    context && context.articleType,
    context && context.targetReader,
    text,
  ].filter(Boolean).join(' ');
  const keywords = source
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2 && word.length <= 14 && !stop.has(word))
    .filter((word, idx, arr) => arr.indexOf(word) === idx)
    .slice(0, 6)
    .map((word) => `#${word}`);
  return normalizeHashtags([...keywords, ...FALLBACK_HASHTAGS]).slice(0, 12);
}

function normalizeCandidates(candidates, context) {
  const normalized = ensureArray(candidates)
    .map((item) => {
      if (typeof item === 'string') {
        return { text: item, score: scoreFirstLineLocally(item, context) };
      }
      const text = String(item && item.text || '').trim();
      const score = Number(item && item.score) || scoreFirstLineLocally(text, context);
      return { text, score: Math.max(0, Math.min(100, Math.round(score))) };
    })
    .filter((item) => item.text);
  return normalized.slice(0, 10);
}

function normalizeVariant(raw, idx, context) {
  const keys = ['A', 'B', 'C'];
  const labels = ['저장형', '공감형', '경고형'];
  const key = String(raw && raw.key || keys[idx] || 'A').slice(0, 1).toUpperCase();
  const finalRevision = raw && raw.finalRevision && typeof raw.finalRevision === 'object' ? raw.finalRevision : {};
  const candidates = normalizeCandidates(raw && raw.firstLineCandidates, context);
  const selectedFirstLine = String(raw && raw.selectedFirstLine || finalRevision.firstLine || candidates[0]?.text || '').trim();
  const firstLineScore = Math.max(
    Number(raw && raw.firstLineScore) || 0,
    scoreFirstLineLocally(selectedFirstLine, context)
  );
  const hashtags = normalizeHashtags(finalRevision.hashtags || (raw && raw.hashtags));
  const variant = {
    key,
    label: raw && raw.label || labels[idx] || key,
    tone: raw && raw.tone || '',
    articleType: raw && raw.articleType || context?.articleType || '',
    targetReader: raw && raw.targetReader || '',
    goal: raw && raw.goal || '',
    hookEngine: raw && raw.hookEngine || '',
    firstLineCandidates: candidates,
    selectedFirstLine,
    firstLineScore: Math.min(100, Math.round(firstLineScore)),
    selectedReason: raw && raw.selectedReason || '',
    body: raw && raw.body || '',
    savePrompt: raw && raw.savePrompt || '',
    sharePrompt: raw && raw.sharePrompt || '',
    commentPrompt: raw && raw.commentPrompt || '',
    linkPrompt: raw && raw.linkPrompt || '',
    hashtags,
    expectedClickStrength: raw && raw.expectedClickStrength || '',
    critique: raw && raw.critique && typeof raw.critique === 'object' ? raw.critique : {},
    finalRevision: {
      firstLine: finalRevision.firstLine || selectedFirstLine,
      body: finalRevision.body || (raw && raw.body) || '',
      savePrompt: finalRevision.savePrompt || (raw && raw.savePrompt) || '',
      sharePrompt: finalRevision.sharePrompt || (raw && raw.sharePrompt) || '',
      commentPrompt: finalRevision.commentPrompt || (raw && raw.commentPrompt) || '',
      linkPrompt: finalRevision.linkPrompt || (raw && raw.linkPrompt) || '',
      hashtags,
    },
  };
  const localScore = scoreVariantLocally(variant);
  const critiqueScore = Number(variant.critique.score) || 0;
  variant.critique.score = Math.max(localScore, critiqueScore);
  variant.recommended = variant.critique.score >= 95;
  variant.passed = variant.critique.score >= 90;
  return variant;
}

function buildCopyFromVariant(variant) {
  const finalRevision = variant && variant.finalRevision || {};
  const hashtags = normalizeHashtags(finalRevision.hashtags || variant.hashtags);
  return [
    finalRevision.firstLine || variant.selectedFirstLine,
    finalRevision.body || variant.body,
    finalRevision.savePrompt || variant.savePrompt,
    finalRevision.sharePrompt || variant.sharePrompt,
    finalRevision.commentPrompt || variant.commentPrompt,
    finalRevision.linkPrompt || variant.linkPrompt,
    hashtags.join(' '),
  ].filter(Boolean).join('\n\n').trim();
}

function parseInstagramResult(rawText) {
  const parsed = extractJsonBlock(rawText);
  if (!parsed || !Array.isArray(parsed.variants)) {
    return recoverLooseInstagramResult(rawText);
  }
  const context = parsed.context && typeof parsed.context === 'object' ? parsed.context : {};
  const variants = parsed.variants.slice(0, 3).map((variant, idx) => normalizeVariant(variant, idx, context));
  if (variants.length === 0) return recoverLooseInstagramResult(rawText);
  return { context, variants };
}

function buildFormattedFromInstagramResult(result) {
  if (!result || !Array.isArray(result.variants) || result.variants.length === 0) return null;
  const first = result.variants[0];
  const copy = buildCopyFromVariant(first);
  const hashtags = normalizeHashtags(first.finalRevision && first.finalRevision.hashtags || first.hashtags);
  const body = copy.replace(/\n\n(#[\p{L}\p{N}_-]+.*)$/u, '').trim();
  return {
    body,
    hashtags: hashtags.length
      ? hashtags
      : buildFallbackInstagramHashtags(result.context || {}, copy),
  };
}

module.exports = {
  JSON_START,
  JSON_END,
  buildStructuredOutputInstructions,
  extractJsonBlock,
  recoverLooseInstagramResult,
  parseInstagramResult,
  buildFormattedFromInstagramResult,
  buildCopyFromVariant,
  normalizeHashtags,
};
