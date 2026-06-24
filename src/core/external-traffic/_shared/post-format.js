// src/core/external-traffic/_shared/post-format.js
// v2.3 핵심: LLM 출력 (뭉텅이 가능) → 채널 규칙에 맞춰 자동 정리.
// 줄당 글자수 wrap, 연속 빈 줄 압축, 이모지 분리, multi-output 분리, 해시태그 추출, 사진 자리 삽입.

'use strict';

/** @typedef {import('./types').ParagraphRule} ParagraphRule */
/** @typedef {import('./types').FormattedOutput} FormattedOutput */
/** @typedef {import('./types').ChannelPrompt} ChannelPrompt */

const HASHTAG_RE = /#[\p{L}\p{N}_]+/gu;
const SEPARATOR_EMOJI = '✨';

/**
 * 채널 규칙에 맞춰 raw 텍스트를 정리.
 * 우선순위: 빈 줄 압축 → multi-output 분리 → 줄 wrap → 이모지/사진 자리 → 해시태그 분리 → 줄 수 상한.
 *
 * @param {string} rawText
 * @param {ChannelPrompt} channel
 * @returns {FormattedOutput}
 */
function postFormat(rawText, channel) {
  if (rawText == null) return { body: '' };
  const rule = channel.paragraphRule || /** @type {ParagraphRule} */ ({});
  let t = String(rawText).replace(/\r\n/g, '\n').trim();
  t = stripStructuredArtifacts(t);

  // 1. 과도한 빈 줄 제거 (LLM이 \n\n\n+ 출력 시)
  //    paragraphBreak='none' → 모든 줄바꿈을 단일 공백으로
  //    paragraphBreak='single' → 빈 줄 0개 (단순 \n만)
  //    paragraphBreak='double' → 빈 줄 1개 (즉 \n\n)
  //    emptyLineMaxConsecutive 별도 명시 시 그 값 우선.
  const maxEmpty = computeMaxEmptyLines(rule);
  if (maxEmpty === 0) {
    t = t.replace(/\n{2,}/g, '\n');
  } else {
    const re = new RegExp(`\\n{${maxEmpty + 2},}`, 'g');
    t = t.replace(re, '\n'.repeat(maxEmpty + 1));
  }

  // 2. multi-output 분리 (X, 페북, 쇼츠, 핀터레스트 등)
  if (Array.isArray(rule.splitOutput) && rule.splitOutput.length > 0) {
    const parts = splitMultiOutput(t, rule.splitOutput);
    // 각 영역에 줄 wrap만 적용 (다른 후처리는 multi-output 채널에서 비활성)
    if (typeof rule.maxLineChars === 'number') {
      for (const k of Object.keys(parts)) {
        parts[k] = wrapLines(parts[k], rule.maxLineChars);
      }
    }
    return { parts };
  }

  // 3. 줄 wrap
  if (typeof rule.maxLineChars === 'number' && rule.maxLineChars > 0) {
    t = wrapLines(t, rule.maxLineChars);
  }

  // 4. 이모지 분리 토큰
  if (rule.emojiBetweenParagraphs) {
    t = t.replace(/\n{2,}/g, `\n\n${SEPARATOR_EMOJI}\n\n`);
  }

  // 5. 사진 자리 자동 삽입 (네이버 블로그)
  if (rule.photoPlaceholder && rule.photoBetweenParagraphs && rule.photoBetweenParagraphs > 0) {
    t = insertPhotoPlaceholders(t, rule.photoPlaceholder, rule.photoBetweenParagraphs);
  }

  // 6. 전체 줄 수 상한 (카톡 등)
  if (typeof rule.maxLines === 'number' && rule.maxLines > 0) {
    const lines = t.split('\n').filter((line) => line.trim().length > 0);
    if (lines.length > rule.maxLines) {
      t = lines.slice(0, rule.maxLines).join('\n');
    }
  }

  // 7. 해시태그 분리
  if (rule.hashtagSeparated) {
    return extractHashtags(t);
  }

  return { body: t.trim() };
}

/**
 * paragraphBreak / emptyLineMaxConsecutive에서 최대 연속 빈 줄 계산.
 * @param {ParagraphRule} rule
 * @returns {number}
 */
function computeMaxEmptyLines(rule) {
  if (typeof rule.emptyLineMaxConsecutive === 'number') {
    return Math.max(0, rule.emptyLineMaxConsecutive);
  }
  switch (rule.paragraphBreak) {
    case 'none':
      return 0;
    case 'single':
      return 0;
    case 'double':
    default:
      return 1;
  }
}

/**
 * 한국어/영어 혼합 텍스트의 줄을 maxChars로 wrap.
 * 단어 경계(공백) 우선, 단어가 maxChars보다 길면 강제 분할.
 *
 * @param {string} text
 * @param {number} maxChars
 * @returns {string}
 */
function wrapLines(text, maxChars) {
  if (maxChars <= 0) return text;
  return text
    .split('\n')
    .map((line) => {
      if (line.length <= maxChars) return line;
      const out = [];
      let cur = '';
      // 공백 + 한국어 어절 경계로 토큰화
      const tokens = line.split(/(\s+)/);
      for (const tok of tokens) {
        if ((cur + tok).length <= maxChars) {
          cur += tok;
          continue;
        }
        if (cur.trim().length > 0) {
          out.push(cur.trim());
          cur = '';
        }
        // 토큰 자체가 maxChars 초과 → 강제 분할
        if (tok.length > maxChars) {
          let rest = tok;
          while (rest.length > maxChars) {
            out.push(rest.slice(0, maxChars));
            rest = rest.slice(maxChars);
          }
          cur = rest;
        } else {
          cur = tok.replace(/^\s+/, '');
        }
      }
      if (cur.trim().length > 0) out.push(cur.trim());
      return out.join('\n');
    })
    .join('\n');
}

/**
 * X의 "Tweet 1: ... Tweet 2: ...", 페북의 "[개인 계정] ... [그룹 댓글] ..." 등을 분리.
 * 영역명 별 별칭 + 다양한 헤더 패턴을 인식.
 *
 * @param {string} text
 * @param {string[]} sections
 * @returns {Object<string,string>}
 */
function splitMultiOutput(text, sections) {
  const ALIASES = {
    tweet1: ['Tweet 1', 'tweet1', '본문 트윗', '본문', 'mainTweet'],
    tweet2: ['Tweet 2', 'tweet2', 'Reply', 'replyTweet', '첫 댓글', '댓글'],
    personal: ['개인 계정', 'personal', '개인'],
    'group-comment': ['그룹 댓글', 'group-comment', 'Group Comment', '그룹', 'comment'],
    script: ['Script', '스크립트', 'script'],
    description: ['Description', '더보기', 'description'],
    pinnedComment: ['Pinned Comment', '고정 댓글', 'pinnedComment'],
    pinTitle: ['Pin Title', '핀 제목', 'title'],
    boardSuggestion: ['Board Suggestion', '보드 추천', 'board'],
    imagePrompt: ['Image Prompt', '이미지 프롬프트', 'image'],
    caption: ['Caption', '캡션', 'caption'],
    hashtags: ['Hashtags', '해시태그', 'hashtag', 'tags'],
  };

  // 모든 헤더 후보 → 위치 찾기
  const markers = [];
  for (const sec of sections) {
    const names = ALIASES[sec] || [sec];
    for (const name of names) {
      // [name], (name), name:, name —  3가지 정규식
      const patterns = [
        new RegExp(`\\[\\s*${escapeRe(name)}\\s*\\]`, 'i'),
        new RegExp(`(?:^|\\n)\\s*${escapeRe(name)}\\s*[:：]`, 'i'),
        new RegExp(`(?:^|\\n)\\s*##?\\s*${escapeRe(name)}\\b`, 'i'),
      ];
      for (const re of patterns) {
        const m = re.exec(text);
        if (m && m.index >= 0) {
          markers.push({ sec, idx: m.index, len: m[0].length });
          break;
        }
      }
    }
  }
  markers.sort((a, b) => a.idx - b.idx);

  /** @type {Object<string,string>} */
  const result = {};
  for (const sec of sections) result[sec] = '';

  if (markers.length === 0) {
    // 헤더 없음 — 첫 영역에 전체 텍스트 할당
    if (sections.length > 0) result[sections[0]] = text.trim();
    return result;
  }

  for (let i = 0; i < markers.length; i++) {
    const m = markers[i];
    const start = m.idx + m.len;
    const end = i + 1 < markers.length ? markers[i + 1].idx : text.length;
    const chunk = text.slice(start, end).trim();
    if (!result[m.sec]) result[m.sec] = chunk;
  }

  // 첫 마커 이전 텍스트가 있으면 첫 sections 영역에 prepend (헤더 없는 도입부)
  if (markers[0].idx > 0) {
    const prelude = text.slice(0, markers[0].idx).trim();
    if (prelude && sections[0] && !result[sections[0]]) {
      result[sections[0]] = prelude;
    }
  }
  return result;
}

/**
 * 본문에서 해시태그 영역을 분리.
 * 패턴 1: 마지막 빈 줄 이후 # 토큰 묶음
 * 패턴 2: 텍스트 끝 N자에 # 토큰이 몰려 있는 경우
 *
 * @param {string} text
 * @returns {FormattedOutput}
 */
function extractHashtags(text) {
  const lines = text.split('\n');
  let splitIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed === '') continue;
    if (/^(#[\p{L}\p{N}_]+\s*)+$/u.test(trimmed)) {
      splitIdx = i;
      continue;
    }
    break;
  }

  if (splitIdx >= 0) {
    const body = lines.slice(0, splitIdx).join('\n').trim();
    const tagText = lines.slice(splitIdx).join(' ');
    const hashtags = (tagText.match(HASHTAG_RE) || []).filter(Boolean);
    return { body, hashtags };
  }

  // 본문에 섞여 있는 경우 — 마지막 200자에 # 5개 이상 몰려 있으면 추출
  const tail = text.slice(-200);
  const tailTags = tail.match(HASHTAG_RE) || [];
  if (tailTags.length >= 5) {
    const lastIdx = text.lastIndexOf(tailTags[0]);
    if (lastIdx >= 0) {
      const body = text.slice(0, lastIdx).replace(HASHTAG_RE, '').replace(/\s+$/g, '').trim();
      const hashtags = (text.slice(lastIdx).match(HASHTAG_RE) || []);
      return { body, hashtags };
    }
  }

  // 그 외 — 본문 전체에서 # 토큰만 추출.
  const allTags = text.match(HASHTAG_RE) || [];
  if (allTags.length > 0) {
    const body = text.replace(HASHTAG_RE, '').replace(/[ \t]{2,}/g, ' ').trim();
    return { body, hashtags: allTags };
  }
  return { body: text.trim(), hashtags: [] };
}

/**
 * 네이버 블로그 등에서 N문단마다 사진 자리 삽입.
 *
 * @param {string} text
 * @param {string} placeholder
 * @param {number} every
 * @returns {string}
 */
function insertPhotoPlaceholders(text, placeholder, every) {
  if (every <= 0) return text;
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  if (paragraphs.length <= every) return text;
  const out = [];
  paragraphs.forEach((p, i) => {
    out.push(p);
    if ((i + 1) % every === 0 && i < paragraphs.length - 1 && !p.includes(placeholder)) {
      out.push(placeholder);
    }
  });
  return out.join('\n\n');
}

/**
 * 정규식 escape.
 * @param {string} s
 * @returns {string}
 */
function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * v3.8.124: Structured 채널 (naver-cafe, facebook, kakao-openchat, tiktok, x, pinterest, youtube-shorts)
 * 의 JSON 파싱이 실패해도 raw JSON/XML 태그가 사용자에게 노출되지 않도록 정리.
 *
 * 처리 대상:
 *  - <*_RESULT_JSON>...</*_RESULT_JSON> 태그
 *  - ```json ... ``` 코드블록
 *  - "finalRevision", "variants", "context", "critique" 등 JSON 키
 *  - JSON 형식 잔재 → finalRevision.body, finalRevision.commentPrompt 등 텍스트 필드만 추출
 *
 * @param {string} text
 * @returns {string}
 */
function stripStructuredArtifacts(text) {
  let s = String(text || '');

  // 1) <*_RESULT_JSON>...</*_RESULT_JSON> 마커 제거 (내용은 일단 보존 — 아래에서 추출)
  s = s.replace(/<\/?[A-Z_]+_RESULT_JSON>/gi, '\n');

  // 2) ```json / ``` 코드펜스 제거
  s = s.replace(/```(?:json)?/gi, '').replace(/```/g, '');

  // 3) JSON처럼 보이면 단계적으로 텍스트 필드만 뽑아내기
  const looksLikeJson = /"(finalRevision|variants|context|critique|selectedReason)"\s*:/.test(s);
  if (looksLikeJson) {
    // 3-1) 1순위: finalRevision의 텍스트 필드 (정상 케이스)
    const fromFinal = extractFinalRevisionTexts(s);
    if (fromFinal) return fromFinal;

    // 3-2) 2순위: variants[].body / firstLine / commentPrompt (LLM이 finalRevision 못 만든 경우)
    const fromVariants = extractDraftTexts(s);
    if (fromVariants) return fromVariants;

    // 3-3) 둘 다 실패 — context만 있는 깨진 출력. 사용자에게 친절한 안내.
    return GENERATION_TRUNCATED_NOTICE;
  }

  return s.replace(/\n{3,}/g, '\n\n').trim();
}

const GENERATION_TRUNCATED_NOTICE = [
  '⚠️ 생성이 중간에 끊겼어요.',
  '',
  '모델이 분석(context)까지만 만들고 본문(finalRevision)을 마무리하지 못했습니다.',
  '아래 중 하나를 시도해주세요:',
  '• 「재생성」 버튼을 다시 눌러주세요 (대부분 한 번에 해결됨)',
  '• 원본 글이 너무 길면 짧게 줄여서 다시 시도',
  '• 같은 채널을 한 번 더 선택해 새로 생성',
].join('\n');

/**
 * raw JSON 텍스트에서 finalRevision의 body/commentPrompt/linkPrompt/title 등
 * 사람이 읽을 텍스트만 순서대로 이어붙여 반환. 실패 시 빈 문자열.
 */
const TEXT_KEYS = [
  'title', 'firstLine', 'selectedFirstLine', 'selectedHook', 'first3SecHook', 'first2SecHook',
  'body', 'bodyScript', 'caption', 'description', 'pinDescription', 'pinnedComment',
  'commentPrompt', 'linkPrompt', 'profileLinkPrompt', 'sharePrompt', 'savePrompt', 'entryPrompt',
];

function decodeJsonString(value) {
  return String(value || '')
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .trim();
}

function extractFinalRevisionTexts(text) {
  const out = [];
  const finalIdx = text.indexOf('"finalRevision"');
  if (finalIdx < 0) return '';
  const slice = text.slice(finalIdx);
  for (const key of TEXT_KEYS) {
    const re = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`);
    const m = re.exec(slice);
    if (m && m[1]) {
      const decoded = decodeJsonString(m[1]);
      if (decoded && !out.includes(decoded)) out.push(decoded);
    }
  }
  return out.length ? out.join('\n\n') : '';
}

/**
 * finalRevision이 없을 때 차선책: variants[].body / firstLine 등 draft 필드에서 추출.
 * LLM이 본문 초안은 만들었지만 finalRevision 단계에서 잘린 경우 사용자가 최소한
 * "글의 형태"를 받아볼 수 있게 함.
 */
function extractDraftTexts(text) {
  const out = [];
  for (const key of TEXT_KEYS) {
    const re = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      const decoded = decodeJsonString(m[1]);
      if (decoded && decoded.length >= 20 && !out.includes(decoded)) {
        out.push(decoded);
        break;
      }
    }
    if (out.length >= 5) break;
  }
  return out.length ? out.join('\n\n') : '';
}

module.exports = {
  postFormat,
  wrapLines,
  splitMultiOutput,
  extractHashtags,
  insertPhotoPlaceholders,
  computeMaxEmptyLines,
  stripStructuredArtifacts,
  SEPARATOR_EMOJI,
};
