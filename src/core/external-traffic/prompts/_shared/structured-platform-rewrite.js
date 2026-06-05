'use strict';

const {
  buildSourceInputBlock: buildCommonSourceInputBlock,
  applyCommonReviewToResult,
} = require('./common-context-guard');

const PLATFORM_BY_MARKER = {
  NAVER_CAFE: 'naver-cafe',
  X_TWITTER: 'x',
  FACEBOOK: 'facebook',
  KAKAO_OPENCHAT: 'kakao-openchat',
  YOUTUBE_SHORTS: 'youtube-shorts',
  TIKTOK: 'tiktok',
  PINTEREST: 'pinterest',
};

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return [value];
}

function clampScore(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanText(value, markers = []) {
  let text = String(value == null ? '' : value);
  for (const marker of markers) {
    text = text.replace(new RegExp(escapeRegExp(marker), 'g'), '');
  }
  return text
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

function cleanDeep(value, markers = []) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanDeep(item, markers)).filter((item) => {
      if (item == null) return false;
      if (typeof item === 'string') return item.trim().length > 0;
      return true;
    });
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [key, cleanDeep(val, markers)])
    );
  }
  if (typeof value === 'string' || value == null) return cleanText(value, markers);
  return value;
}

function normalizeTags(tags, max = 12) {
  return ensureArray(tags)
    .flatMap((tag) => String(tag || '').split(/\s+/))
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.startsWith('#') ? tag : `#${tag.replace(/^#+/, '').replace(/[^\p{L}\p{N}_-]/gu, '')}`)
    .filter((tag) => tag.length > 1)
    .filter((tag, idx, arr) => arr.indexOf(tag) === idx)
    .slice(0, max);
}

function decodeLooseJsonText(value, markers = []) {
  return cleanText(String(value || '')
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\'), markers);
}

function extractLooseStringField(block, field, markers = []) {
  const re = new RegExp(`"${field}"\\s*:\\s*"([\\s\\S]*?)"\\s*(?:,\\s*(?="[_A-Za-z][_A-Za-z0-9]*"\\s*:)|(?=\\s*[}\\]]))`);
  const match = re.exec(String(block || ''));
  return match ? decodeLooseJsonText(match[1], markers) : '';
}

function extractLooseNumberField(block, field) {
  const re = new RegExp(`"${field}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`);
  const match = re.exec(String(block || ''));
  return match ? Number(match[1]) : 0;
}

function extractLooseArrayField(block, field, markers = []) {
  const re = new RegExp(`"${field}"\\s*:\\s*\\[([\\s\\S]*?)\\]`);
  const match = re.exec(String(block || ''));
  if (!match) return [];
  const inner = match[1];
  const quoted = Array.from(inner.matchAll(/"([\s\S]*?)"/g))
    .map((item) => decodeLooseJsonText(item[1], markers))
    .filter(Boolean);
  if (quoted.length) return quoted;
  return inner
    .split(',')
    .map((item) => cleanText(item.replace(/^['"]|['"]$/g, ''), markers))
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
    blocks.push({ start: keyIndex, end: endIndex, block: text.slice(openIndex, endIndex) });
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
    return { key: marker.key, block: text.slice(marker.start, end) };
  });
}

function extractJsonBlock(rawText, startMarker, endMarker) {
  const text = String(rawText || '');
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  let jsonText = '';
  if (start >= 0 && end > start) {
    jsonText = text.slice(start + startMarker.length, end).trim();
  } else {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonText = text.slice(firstBrace, lastBrace + 1).trim();
    }
  }
  if (!jsonText) return null;
  jsonText = jsonText
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .replace(/,\s*([}\]])/g, '$1')
    .trim();
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  return String(path).split('.').reduce((acc, key) => acc && acc[key], obj);
}

function getVariantValue(variant, key) {
  if (!variant || !key) return '';
  const finalRevision = variant.finalRevision || {};
  const fromFinal = getByPath(finalRevision, key);
  if (fromFinal != null && fromFinal !== '') return fromFinal;
  return getByPath(variant, key);
}

function flattenSections(sections) {
  return ensureArray(sections).flatMap((section) => {
    if (typeof section === 'string') return [section];
    return [section && section.heading, section && section.body].filter(Boolean);
  });
}

function stripUrls(text) {
  return String(text || '').replace(/https?:\/\/\S+/gi, '').replace(/\n{3,}/g, '\n\n').trim();
}

function appendSourceUrl(text, sourceUrl) {
  const body = String(text || '').trim();
  const url = String(sourceUrl || '').trim();
  if (!body || !url) return body;
  if (body.includes(url)) return body;
  return `${body}\n\n${url}`;
}

function stripHtml(input) {
  return String(input || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSourceInputBlock(params = {}) {
  return buildCommonSourceInputBlock(params, params.platformId || params.channelId || params.platform || '');
}

function renderField(field, variant, sourceUrl) {
  const spec = typeof field === 'string' ? { key: field } : field;
  const key = spec.key;
  let value = getVariantValue(variant, key);
  if (key === 'sections') value = flattenSections(value);
  if (key === 'hashtags' || key === 'keywordTags') {
    value = normalizeTags(value, spec.max || 12);
  }
  if (Array.isArray(value)) {
    if (spec.style === 'inline') return value.join(' ');
    if (spec.numbered) return value.map((item, idx) => `${idx + 1}. ${item}`).join('\n');
    return value.join('\n');
  }
  let text = cleanText(value);
  if (spec.stripUrls) text = stripUrls(text);
  if (spec.appendSourceUrl) text = appendSourceUrl(text, sourceUrl);
  if (spec.prefix && text) text = `${spec.prefix}${text}`;
  return text;
}

function buildCopyFromVariant(variant, config, sourceUrl = '') {
  if (!variant) return '';
  const resolvedUrl = sourceUrl || variant.context?.sourceUrl || '';
  const copy = ensureArray(config.copyFields)
    .map((field) => renderField(field, variant, resolvedUrl))
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return config.appendSourceUrl ? appendSourceUrl(copy, resolvedUrl) : copy;
}

function buildPartFromVariant(variant, partSpec, config, sourceUrl) {
  if (partSpec.builder) return partSpec.builder(variant, sourceUrl);
  const text = ensureArray(partSpec.fields)
    .map((field) => renderField(field, variant, sourceUrl))
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  let result = partSpec.stripUrls ? stripUrls(text) : text;
  if (partSpec.appendSourceUrl) result = appendSourceUrl(result, sourceUrl);
  return cleanText(result);
}

function normalizeCandidates(value, selectedText = '') {
  return ensureArray(value)
    .map((candidate, idx) => {
      if (typeof candidate === 'string') {
        return { text: cleanText(candidate), score: Math.max(60, 90 - idx * 2) };
      }
      return {
        text: cleanText(candidate && candidate.text),
        score: clampScore(candidate && candidate.score, Math.max(60, 90 - idx * 2)),
      };
    })
    .filter((candidate) => candidate.text)
    .map((candidate) => ({
      ...candidate,
      selected: selectedText && candidate.text === selectedText,
    }))
    .slice(0, 10);
}

function normalizeContext(context, config, markers) {
  const c = cleanDeep(context && typeof context === 'object' ? context : {}, markers);
  const output = {};
  for (const field of ensureArray(config.contextFields)) {
    output[field] = c[field] || '';
  }
  output.sourceTitle = output.sourceTitle || c.sourceTitle || '';
  output.sourceUrl = output.sourceUrl || c.sourceUrl || '';
  output.autoCategory = output.autoCategory || c.autoCategory || c.articleType || '';
  output.coreTopic = output.coreTopic || c.coreTopic || c.primaryKeyword || '';
  output.targetReader = output.targetReader || c.targetReader || '';
  output.readerSituation = output.readerSituation || c.readerSituation || c.readerQuestion || '';
  output.mustKeepFacts = ensureArray(c.mustKeepFacts).map((item) => cleanText(item, markers)).filter(Boolean);
  output.doNotUse = ensureArray(c.doNotUse).map((item) => cleanText(item, markers)).filter(Boolean);
  return output;
}

function normalizeVariant(raw, idx, context, config, markers) {
  const cleaned = cleanDeep(raw && typeof raw === 'object' ? raw : {}, markers);
  const keys = ['A', 'B', 'C'];
  const rawKey = cleanText(cleaned.key).slice(0, 1).toUpperCase();
  const key = keys.includes(rawKey) ? rawKey : keys[idx] || 'A';
  const labels = config.variantLabels || {};
  const finalRevision = cleaned.finalRevision && typeof cleaned.finalRevision === 'object'
    ? cleaned.finalRevision
    : {};
  const variant = {
    ...cleaned,
    key,
    label: cleaned.label || labels[key] || key,
    context,
    finalRevision,
  };

  for (const candidateSpec of ensureArray(config.candidateFields)) {
    const selected = getVariantValue(variant, candidateSpec.selectedKey) || '';
    const candidates = normalizeCandidates(variant[candidateSpec.key], selected);
    variant[candidateSpec.key] = candidates;
    if (!getVariantValue(variant, candidateSpec.selectedKey) && candidates[0]) {
      variant[candidateSpec.selectedKey] = candidates[0].text;
    }
    variant[candidateSpec.scoreKey] = Math.max(
      clampScore(variant[candidateSpec.scoreKey], 0),
      clampScore(candidates.find((item) => item.text === variant[candidateSpec.selectedKey])?.score, 0),
      candidates[0]?.score || 0
    );
  }

  if (Array.isArray(variant.hashtags)) variant.hashtags = normalizeTags(variant.hashtags, config.hashtagMax || 12);
  if (Array.isArray(variant.finalRevision?.hashtags)) {
    variant.finalRevision.hashtags = normalizeTags(variant.finalRevision.hashtags, config.hashtagMax || 12);
  }
  if (Array.isArray(variant.keywordTags)) variant.keywordTags = normalizeTags(variant.keywordTags, config.keywordTagMax || 12);
  if (Array.isArray(variant.finalRevision?.keywordTags)) {
    variant.finalRevision.keywordTags = normalizeTags(variant.finalRevision.keywordTags, config.keywordTagMax || 12);
  }

  const candidateScore = ensureArray(config.candidateFields)
    .map((spec) => Number(variant[spec.scoreKey]) || 0)
    .reduce((max, score) => Math.max(max, score), 0);
  const copy = buildCopyFromVariant(variant, config, context.sourceUrl);
  let localScore = 55;
  if (candidateScore >= 85) localScore += 15;
  if (copy.length >= (config.copyMin || 80)) localScore += 10;
  if (!/(JSON|```|RESULT_JSON)/i.test(copy)) localScore += 8;
  if (context.sourceUrl && copy.includes(context.sourceUrl)) localScore += 7;
  if (copy.length <= (config.copyMax || 1500)) localScore += 5;

  const critique = variant.critique && typeof variant.critique === 'object' ? variant.critique : {};
  const score = Math.max(clampScore(critique.score, 0), clampScore(variant.score, 0), clampScore(localScore, 0));
  variant.critique = {
    ...critique,
    score,
    notes: critique.notes || '최종 복사본 기준으로 자동 점검했습니다.',
  };
  variant.recommended = !!variant.recommended || idx === 0 || score >= (config.recommendScore || 92);
  variant.passed = !!variant.passed || score >= (config.passScore || 85);
  return variant;
}

function orderUniqueVariants(variants) {
  const order = { A: 0, B: 1, C: 2 };
  const seen = new Set();
  return ensureArray(variants)
    .filter(Boolean)
    .sort((a, b) => (order[a.key] ?? 99) - (order[b.key] ?? 99))
    .filter((variant) => {
      if (!variant.key) return true;
      if (seen.has(variant.key)) return false;
      seen.add(variant.key);
      return true;
    });
}

function recoverLooseResult(rawText, config, markers) {
  const text = String(rawText || '');
  if (!text.includes('finalRevision') && !text.includes(config.jsonStart)) return null;
  const contextBlock = findLooseObjectBlocks(text, 'context')[0]?.block || '';
  const contextSource = {};
  for (const field of ensureArray(config.contextFields)) {
    contextSource[field] = extractLooseStringField(contextBlock, field, markers);
  }
  contextSource.mustKeepFacts = extractLooseArrayField(contextBlock, 'mustKeepFacts', markers);
  contextSource.doNotUse = extractLooseArrayField(contextBlock, 'doNotUse', markers);
  const context = normalizeContext(contextSource, config, markers);

  const variantSections = findLooseVariantSections(text);
  const finalBlocks = findLooseObjectBlocks(text, 'finalRevision');
  if (!variantSections.length && !finalBlocks.length) return null;
  const entries = variantSections.length
    ? variantSections
    : finalBlocks.map((entry, idx) => ({
      key: ['A', 'B', 'C'][idx],
      block: text.slice(Math.max(0, entry.start - (config.looseWindow || 3000)), entry.end),
    }));

  const scalarFields = new Set([
    'key', 'label', 'tone', 'goal', 'selectedReason', 'body', 'firstLine', 'selectedFirstLine',
    'title', 'selectedTitle', 'pinTitle', 'videoTitle', 'first3SecHook', 'first2SecHook',
    'selectedHook', 'bodyScript', 'commentPrompt', 'sharePrompt', 'savePrompt', 'repostPrompt',
    'quotePrompt', 'entryPrompt', 'linkPrompt', 'profileLinkPrompt', 'pinnedComment',
    'description', 'pinDescription', 'imageDesignDirection', 'blogLead', 'caption',
    'adRiskLevel', 'expectedClickStrength', 'readerSituation',
  ]);
  for (const field of ensureArray(config.copyFields)) {
    if (typeof field === 'string') scalarFields.add(field);
    else if (field && field.key) scalarFields.add(field.key);
  }
  const arrayFields = new Set(['hashtags', 'keywordTags', 'onScreenCaptions', 'cutCaptions', 'imageTextLines', 'sections']);
  for (const field of ensureArray(config.arrayFields)) arrayFields.add(field);

  const variants = entries.map((entry, idx) => {
    const finalBlock = findLooseObjectBlocks(entry.block, 'finalRevision')[0]?.block || '';
    const finalSource = finalBlock || entry.block;
    const raw = { key: extractLooseStringField(entry.block, 'key', markers) || entry.key };
    for (const field of scalarFields) {
      raw[field] = extractLooseStringField(entry.block, field, markers);
    }
    for (const candidateSpec of ensureArray(config.candidateFields)) {
      raw[candidateSpec.key] = extractLooseArrayField(entry.block, candidateSpec.key, markers);
      raw[candidateSpec.scoreKey] = extractLooseNumberField(entry.block, candidateSpec.scoreKey);
    }
    for (const field of arrayFields) {
      raw[field] = extractLooseArrayField(entry.block, field, markers);
    }
    raw.finalRevision = {};
    for (const field of scalarFields) {
      raw.finalRevision[field] = extractLooseStringField(finalSource, field, markers);
    }
    for (const field of arrayFields) {
      raw.finalRevision[field] = extractLooseArrayField(finalSource, field, markers);
    }
    raw.critique = {
      score: extractLooseNumberField(entry.block, 'score'),
      notes: '깨진 JSON에서 최종 글 요소만 자동 복구했습니다.',
    };
    return normalizeVariant(raw, idx, context, config, markers);
  }).filter((variant) => buildCopyFromVariant(variant, config, context.sourceUrl));

  const ordered = orderUniqueVariants(variants).slice(0, 3);
  return ordered.length ? { context, variants: ordered } : null;
}

function buildSchemaValueForField(field) {
  const key = typeof field === 'string' ? field : field.key;
  if (key === 'hashtags' || key === 'keywordTags') return ['#키워드'];
  if (key === 'onScreenCaptions' || key === 'cutCaptions' || key === 'imageTextLines') return ['짧은 화면 문구'];
  if (key === 'sections') return [{ heading: '소제목', body: '본문 문단' }];
  return `${key} 최종 문구`;
}

function buildStructuredOutputInstructions(config) {
  const candidateField = ensureArray(config.candidateFields)[0] || {
    key: 'firstLineCandidates',
    selectedKey: 'selectedFirstLine',
    scoreKey: 'firstLineScore',
  };
  const finalRevision = {};
  for (const field of ensureArray(config.copyFields)) {
    const key = typeof field === 'string' ? field : field.key;
    finalRevision[key] = buildSchemaValueForField(field);
  }
  const context = {};
  for (const field of ensureArray(config.contextFields)) {
    context[field] = `${field} 값`;
  }
  const exampleVariant = {
    key: 'A',
    label: (config.variantLabels && config.variantLabels.A) || 'A안',
    goal: '이 안의 목적',
    [candidateField.key]: Array.from({ length: 10 }, (_, idx) => ({
      text: `${idx + 1}번 후보 문구`,
      score: 90 - idx,
    })),
    [candidateField.selectedKey]: '선택된 문구',
    [candidateField.scoreKey]: 90,
    selectedReason: '선택 이유',
    critique: {
      score: 90,
      notes: '개선/검토 메모',
      breakdown: {
        platformFit: 20,
        hook: 20,
        truth: 20,
        lowAd: 20,
        action: 20,
      },
    },
    finalRevision,
  };
  const variantNotes = Object.entries(config.variantLabels || {})
    .map(([key, label]) => `- ${key}: ${label}`)
    .join('\n');
  const candidateLabel = candidateField.label || candidateField.key;
  return `[출력 형식]
반드시 아래 XML 태그 사이에 JSON만 출력합니다. Markdown 코드블록, 설명문, 후보 밖 잡담은 금지합니다.
${config.jsonStart}
${JSON.stringify({ context, variants: [exampleVariant] }, null, 2)}
${config.jsonEnd}

[필수 규칙]
- variants는 A/B/C 3개를 모두 만듭니다.
${variantNotes}
- 각 variant의 ${candidateLabel}는 반드시 10개이며 text와 score를 포함합니다.
- finalRevision에는 사용자가 복사해서 바로 게시할 최종 글 구성요소만 넣습니다.
- 후보, 점수, 분석, critique는 UI 검토용이며 finalRevision 문구 안에는 넣지 않습니다.
- 원문에 없는 금액, 날짜, 조건, 효과, 대상자는 만들지 않습니다.
- JSON이 깨지지 않도록 큰따옴표 안 줄바꿈은 \\n으로 이스케이프합니다.`;
}

function buildCleanStructuredOutputInstructions(config) {
  const candidateField = ensureArray(config.candidateFields)[0] || {
    key: 'firstLineCandidates',
    selectedKey: 'selectedFirstLine',
    scoreKey: 'firstLineScore',
    label: '후보',
  };
  const finalRevision = {};
  for (const field of ensureArray(config.copyFields)) {
    const key = typeof field === 'string' ? field : field.key;
    finalRevision[key] = buildSchemaValueForField(field);
  }
  const context = {};
  for (const field of ensureArray(config.contextFields)) {
    context[field] = `${field} 값`;
  }
  context.mustKeepFacts = ['원문에서 확인된 사실'];
  context.doNotUse = ['원문에 없어서 쓰면 안 되는 내용'];
  context.riskyExpressions = ['과장하면 위험한 표현'];

  const exampleVariant = {
    key: 'A',
    label: (config.variantLabels && config.variantLabels.A) || 'A안',
    goal: '이 안의 플랫폼 목적',
    [candidateField.key]: Array.from({ length: 10 }, (_, idx) => ({
      text: `${idx + 1}번 후보 문구`,
      score: 90 - idx,
    })),
    [candidateField.selectedKey]: '선택한 최종 후보',
    [candidateField.scoreKey]: 90,
    selectedReason: '선택 이유',
    critique: {
      score: 90,
      notes: '자체 비평과 개선 메모',
      breakdown: {
        platformFit: 20,
        hook: 20,
        truth: 20,
        lowAd: 20,
        action: 20,
      },
    },
    commonReview: {
      score: 90,
      notes: '공통 최종 검수 결과',
    },
    finalRevision,
  };
  const variantNotes = Object.entries(config.variantLabels || {})
    .map(([key, label]) => `- ${key}: ${label}`)
    .join('\n');
  const candidateLabel = candidateField.label || candidateField.key;
  return `[출력 형식]
반드시 아래 XML 태그 사이에 JSON만 출력합니다.
Markdown 코드블록, 설명문, 후보 해설, 사과문은 출력하지 않습니다.

${config.jsonStart}
${JSON.stringify({ context, variants: [exampleVariant] }, null, 2)}
${config.jsonEnd}

[필수 규칙]
- variants는 A/B/C 3개를 모두 만듭니다.
${variantNotes}
- 각 variant의 ${candidateLabel}는 반드시 10개이며 text와 score를 포함합니다.
- finalRevision에는 사용자가 복사해서 바로 게시할 최종 콘텐츠 구성요소만 넣습니다.
- 점수, 후보, 선택 이유, 자체 비평, 자동 분류 메모, 개발자용 정보는 finalRevision 안에 넣지 않습니다.
- 원문에 없는 금액, 기간, 조건, 대상자, 효과를 만들지 않습니다.
- 특정 테스트 예시나 청년내일저축계좌 문맥을 기본값처럼 반복하지 않습니다.
- 플랫폼 말투가 섞이면 finalRevision에서 다시 작성합니다.
- 공통 금지 표현이나 클릭 강요 표현이 있으면 finalRevision에서 제거합니다.
- JSON 문자열 안의 줄바꿈은 \\n으로 이스케이프합니다.`;
}

function resolvePlatformId(config) {
  return config.platformId || PLATFORM_BY_MARKER[config.marker] || String(config.marker || '').toLowerCase();
}

function createStructuredPlatformProcessor(userConfig) {
  const marker = userConfig.marker;
  const config = {
    ...userConfig,
    jsonStart: userConfig.jsonStart || `<${marker}_RESULT_JSON>`,
    jsonEnd: userConfig.jsonEnd || `</${marker}_RESULT_JSON>`,
  };
  const markers = [config.jsonStart, config.jsonEnd];

  function parseResult(rawText) {
    const withCommonReview = (result) => applyCommonReviewToResult(resolvePlatformId(config), result);
    const parsed = extractJsonBlock(rawText, config.jsonStart, config.jsonEnd);
    if (!parsed || !Array.isArray(parsed.variants)) {
      return withCommonReview(recoverLooseResult(rawText, config, markers));
    }
    const context = normalizeContext(parsed.context, config, markers);
    const variants = parsed.variants
      .slice(0, 3)
      .map((variant, idx) => normalizeVariant(variant, idx, context, config, markers))
      .filter((variant) => buildCopyFromVariant(variant, config, context.sourceUrl));
    const ordered = orderUniqueVariants(variants).slice(0, 3);
    return ordered.length
      ? withCommonReview({ context, variants: ordered })
      : withCommonReview(recoverLooseResult(rawText, config, markers));
  }

  function buildFormattedFromResult(result) {
    if (!result || !Array.isArray(result.variants) || !result.variants.length) return null;
    const first = result.variants[0];
    const sourceUrl = result.context?.sourceUrl || first.context?.sourceUrl || '';
    if (Array.isArray(config.formattedParts) && config.formattedParts.length) {
      const parts = {};
      for (const partSpec of config.formattedParts) {
        parts[partSpec.key] = buildPartFromVariant(first, partSpec, config, sourceUrl);
      }
      return { parts };
    }
    return {
      body: buildCopyFromVariant(first, config, sourceUrl),
    };
  }

  return {
    config,
    JSON_START: config.jsonStart,
    JSON_END: config.jsonEnd,
    buildStructuredOutputInstructions: () => buildCleanStructuredOutputInstructions(config),
    parseResult,
    buildFormattedFromResult,
    buildCopyFromVariant: (variant, sourceUrl) => buildCopyFromVariant(variant, config, sourceUrl),
  };
}

module.exports = {
  createStructuredPlatformProcessor,
  ensureArray,
  cleanText,
  normalizeTags,
  buildCopyFromVariant,
  appendSourceUrl,
  stripHtml,
  buildSourceInputBlock,
};
