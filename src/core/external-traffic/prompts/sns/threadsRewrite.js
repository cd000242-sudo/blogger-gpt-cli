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
  // v3.8.257 — 손가락 멈추는 viral 강제 + 클리셰/광고티 차단
  '한 줄기 빛',
  '구원',
  '꼭 알려줘',
  '꼭 공유',
  '꼭 알려주세요',
  '참고해봐',
  '참고하세요',
  '처음엔 나도 믿기 힘들었는데',
  '진짜면 이잖아',
  '혹시 너희 중에도',
  '다들 어떻게 생각해',
  '여기 정리해둔 글',
  '자세한 건 여기',
  '본인 케이스에 해당되는지',
  '놀라운',
  '충격',
  '대박',
  '꿀팁',
  '비법',
  '버린 셈',
  '버린거나 마찬가지',
  '손해 본 셈',
  '이거 모르고',
  '이거 모르면',
];

function buildStructuredOutputInstructions() {
  // v3.8.256: 두 마리 토끼 schema — 품질 driver 보존 + 형식 bloat 제거
  //   품질 보존:
  //     - firstLineCandidates 3개 (10개→3개, CoT 효과 95% 유지하면서 토큰 70% 절감)
  //     - approach 1줄 (tone/goal/hookEngine 통합 = 전략 사전 정리 효과 유지)
  //     - critique { score, notes, mustImprove } (breakdown 6축 → 핵심 3요소)
  //     - readerContext (독자/상황/질문 1-2문장으로 통합)
  //     - mustKeepFacts/doNotUse 유지 (사실 정확성 가드)
  //   bloat 제거:
  //     - 같은 의미 중복 필드 제거 (tone+goal+hookEngine = approach 1개로)
  //     - breakdown 6축 세분화 제거 (mustImprove로 핵심만 집중)
  //   결과 토큰: ~1500 (기존 4000+ 대비 60% 감소, v3.8.255 1000보다는 약간 증가)
  return `[출력 형식]
반드시 아래 XML 태그 사이에 JSON만 출력한다. Markdown 코드블록은 금지한다.
${JSON_START}
{
  "context": {
    "coreTopic": "핵심 주제 한 문장",
    "readerContext": "타겟 독자 + 지금 처한 상황 + 핵심 질문 (1-2문장 통합)",
    "mustKeepFacts": ["원문 확인된 사실 핵심만 3개 이내"],
    "doNotUse": ["원문에 없어 쓰면 안 되는 내용 2개 이내"]
  },
  "variants": [
    {
      "key": "A",
      "viralPattern": "구체메커니즘 | 시간압박 | 모순반전 | 공감위기감 | 댓글유발의견갈림 (정확히 1개)",
      "approach": "글 전략 한 줄 (어조 + 목표 + viral 패턴 활용 방식)",
      "firstLineCandidates": ["viral 패턴 적용된 첫 줄 후보1", "후보2", "후보3"],
      "selectedFirstLine": "위 3개 중 가장 강한 선택 (클리셰/광고티 없을 것)",
      "body": "초안 본문 — 원문에서 확인한 구체 사실(숫자·조건) 최소 1개를 실제로 알려주고, 그 위에 의심점→댓글유발 흐름 (링크 없이 400자 이내)",
      "commentPrompt": "댓글 유도 한 줄 (답 명확한 질문 NO, 의견 갈리는 질문 YES)",
      "linkPrompt": "URL 단독 한 줄 — 첫 댓글로 나간다. 본문에 URL 을 넣지 않는다",
      "critique": {
        "score": 90,
        "notes": "자체 비평 한 줄 (viral 패턴 강도/클리셰 유무/진정성)",
        "mustImprove": "초안에서 발견한 클리셰·광고티·약한 훅 1개 명시"
      },
      "finalRevision": {
        "firstLine": "mustImprove 반영한 최종 첫 줄",
        "body": "mustImprove 반영한 최종 본문 (링크 없이 400자 이내, 구체 사실 최소 1개 포함)",
        "commentPrompt": "최종 댓글 유도",
        "linkPrompt": "URL 단독 한 줄 (첫 댓글용)"
      }
    }
  ]
}
${JSON_END}

variants는 정확히 A/B/C 3개 (A=댓글형 반말, B=공감형 존댓말, C=공유형).
각 variant는 다음 순서로 사고한다:
  1) approach로 전략 선언 → 2) firstLineCandidates 3개 비교 → 3) selectedFirstLine 결정
  → 4) body 초안 → 5) critique로 자가 검토 (mustImprove 1개 식별)
  → 6) finalRevision에서 mustImprove 반영해 완성
finalRevision에는 사용자가 복사해서 바로 올릴 최종 게시문만 넣는다.
후보·점수·비평·전략 설명은 finalRevision 안에 절대 넣지 않는다.
해시태그는 쓰지 않는다.
본문(body)에는 URL 을 넣지 않는다 — 링크는 linkPrompt 에만 넣고 첫 댓글로 나간다.
본문은 400자 이내 (스레드 한도 500자에서 여유를 둔다).

[실물 검수에서 나온 절대 규칙 — v3.8.505. 다른 공용 규칙과 충돌하면 이 블록이 우선한다]
- **본문(제목 제외)에 원문에서 확인한 새 사실 1~2개를 실명으로 푼다.**
  대상·기한·금액 산정 기준 중 하나는 반드시 실제 내용으로 알려준다.
  공용 미끼 규칙의 "조건을 풀지 마라"는 스레드에선 이렇게 적용한다:
  1~2개는 풀어서 글쓴이가 원문을 읽었음을 증명하고, 나머지(전체 조건표·신청 절차·
  서류·예외)는 남겨 클릭 이유로 쓴다.
- 제목에 이미 있는 숫자를 다시 말하는 것은 "사실 공개"로 치지 않는다.
  "기준은 봐야 알 듯", "공식 안내를 같이 봐야" 처럼 아무 정보 없이 궁금해하기만 하는
  글은 실패다 — 글쓴이도 모르는 글을 누가 눌러보나.
- 재게시(공유) 유도 문장을 게시문에 넣지 않는다. 자기 글을 퍼가라고 말하는 글은 광고다.
- A/B/C 는 **원문에서 서로 다른 사실을 하나씩 골라** 그 사실을 중심으로 쓴다.
  제목 숫자만 돌려 말하는 같은 질문의 변주 3개는 셋 다 버리는 것과 같다.
- doNotUse 에는 "원문에 없는 것"만 넣는다. 원문에 있는 조건·기간을 doNotUse 로
  묶어 두고 궁금해하는 척하지 마라.`;
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

/**
 * v3.8.505 — 실물 검수(2026-08-16)에서 조립이 글을 죽이고 있었다.
 *
 * 예전 조립: 첫줄 + 본문 + 댓글유도 + 재게시유도 + 링크를 전부 한 덩어리로.
 *  ① 재게시 유도문("~에게 재게시로 남겨둘 만함")이 글 끝에 박혔다 —
 *     자기 글을 퍼가라고 말하는 글은 광고로 읽힌다. 조립에서 뺀다.
 *  ② 인코딩된 233자 URL이 본문 끝에 통째로 붙어 화면의 40%를 먹고,
 *     본문 링크는 스레드 도달을 깎는다(2026 실측 통설). 첫 댓글로 분리한다.
 *  ③ 그 결과 세 안 모두 500자를 넘겨 붙여넣다 잘렸다. 링크를 빼면 해결된다.
 */
function buildCopyFromVariant(variant) {
  const finalRevision = variant && variant.finalRevision || {};
  const body = finalRevision.body || variant.body || '';

  // 본문에 URL이 섞여 나왔으면 걷어낸다 — 링크는 첫 댓글의 몫이다
  const bodyNoLink = body.replace(/https?:\/\/[^\s]+/g, '').replace(/[ \t]+\n/g, '\n').trim();

  return [
    finalRevision.firstLine || variant.selectedFirstLine,
    bodyNoLink,
    finalRevision.commentPrompt || variant.commentPrompt,
  ]
    .map(stripPromoPhrases)
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 첫 댓글 = 링크 한 줄. 글이 아니라 댓글에 붙여넣는 용도다. */
function buildFirstCommentFromVariant(variant) {
  const finalRevision = variant && variant.finalRevision || {};
  const linkPrompt = String(finalRevision.linkPrompt || variant.linkPrompt || '').trim();
  const url = (linkPrompt.match(/https?:\/\/[^\s]+/) || [])[0] || '';
  if (!url) return '';
  // 링크 앞 문구가 있으면 한 줄만 살린다 (길면 댓글도 광고처럼 보인다)
  const lead = linkPrompt.replace(url, '').replace(/\s+/g, ' ').trim();
  return lead && lead.length <= 30 ? `${lead} ${url}`.trim() : url;
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
  /**
   * v3.8.505: 한 덩어리(body) → 두 칸(parts).
   * X 가 이미 tweet1(본문)/tweet2(첫 댓글) 두 칸을 쓰는 것과 같은 구조 —
   * UI(_renderMultiOutput)와 길이 가드가 칸별로 처리한다.
   */
  return {
    parts: {
      post: buildCopyFromVariant(first),
      firstComment: buildFirstCommentFromVariant(first),
    },
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
  buildFirstCommentFromVariant,
};
