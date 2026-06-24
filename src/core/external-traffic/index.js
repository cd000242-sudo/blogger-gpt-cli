// src/core/external-traffic/index.js
// v2.3 dispatcher — 채널 ID → 프롬프트 파일 매핑 + buildPrompt + postFormat + assessRisk 통합.

'use strict';

// SNS (5)
const INSTAGRAM = require('./prompts/sns/instagram');
const THREADS = require('./prompts/sns/threads');
const X = require('./prompts/sns/x');
const FACEBOOK = require('./prompts/sns/facebook');
const PINTEREST = require('./prompts/sns/pinterest');

// Naver (4)
const NAVER_BLOG = require('./prompts/naver/blog');
const NAVER_CAFE = require('./prompts/naver/cafe-generic');
const NAVER_BAND = require('./prompts/naver/band');
const NAVER_JISIK_IN = require('./prompts/naver/jisik-in');

// Korean communities (10)
const DCINSIDE = require('./prompts/communities/dcinside');
const FMKOREA = require('./prompts/communities/fmkorea');
const THEQOO = require('./prompts/communities/theqoo');
const PPOMPPU = require('./prompts/communities/ppomppu');
const RULIWEB = require('./prompts/communities/ruliweb');
const ARCALIVE = require('./prompts/communities/arcalive');
const DOGDRIP = require('./prompts/communities/dogdrip');
const ETOLAND = require('./prompts/communities/etoland');
const DOTAX = require('./prompts/communities/dotax');
const YGOSU = require('./prompts/communities/ygosu');

// Specialized (8)
const MLBPARK = require('./prompts/specialized/mlbpark');
const NBAMANIA = require('./prompts/specialized/nbamania');
const BOBAEDREAM = require('./prompts/specialized/bobaedream');
const QUASARZONE = require('./prompts/specialized/quasarzone');
const ORBI = require('./prompts/specialized/orbi');
const DDANZI = require('./prompts/specialized/ddanzi');
const COOK82 = require('./prompts/specialized/82cook');
const LOCAL_BOARD = require('./prompts/specialized/local-board');

// Video (2)
const YOUTUBE_SHORTS = require('./prompts/video/youtube-shorts');
const TIKTOK = require('./prompts/video/tiktok');

// Messenger (3)
const KAKAO_OPENCHAT = require('./prompts/messenger/kakao-openchat');
const KAKAO_CHANNEL = require('./prompts/messenger/kakao-channel');
const TELEGRAM_CHANNEL = require('./prompts/messenger/telegram-channel');

// International (4)
const REDDIT_KOREA = require('./prompts/international/reddit-korea');
const REDDIT_GENERIC = require('./prompts/international/reddit-generic');
const GITHUB_DISCUSSIONS = require('./prompts/international/github-discussions');
const MEDIUM = require('./prompts/international/medium');

const { postFormat } = require('./_shared/post-format');
const { validateLength, buildRetryHint } = require('./_shared/length-guard');
const { validateGenerateV2Payload } = require('./_shared/validate-input');
const { applyCommonResponseGuard } = require('./prompts/_shared/common-context-guard');

/** @type {Record<string, import('./_shared/types').ChannelPrompt>} */
const CHANNEL_REGISTRY = {
  // SNS 5
  [INSTAGRAM.id]: INSTAGRAM,
  [THREADS.id]: THREADS,
  [X.id]: X,
  [FACEBOOK.id]: FACEBOOK,
  [PINTEREST.id]: PINTEREST,
  // Naver 4
  [NAVER_BLOG.id]: NAVER_BLOG,
  [NAVER_CAFE.id]: NAVER_CAFE,
  [NAVER_BAND.id]: NAVER_BAND,
  [NAVER_JISIK_IN.id]: NAVER_JISIK_IN,
  // Community 10
  [DCINSIDE.id]: DCINSIDE,
  [FMKOREA.id]: FMKOREA,
  [THEQOO.id]: THEQOO,
  [PPOMPPU.id]: PPOMPPU,
  [RULIWEB.id]: RULIWEB,
  [ARCALIVE.id]: ARCALIVE,
  [DOGDRIP.id]: DOGDRIP,
  [ETOLAND.id]: ETOLAND,
  [DOTAX.id]: DOTAX,
  [YGOSU.id]: YGOSU,
  // Specialized 7
  [MLBPARK.id]: MLBPARK,
  [NBAMANIA.id]: NBAMANIA,
  [BOBAEDREAM.id]: BOBAEDREAM,
  [QUASARZONE.id]: QUASARZONE,
  [ORBI.id]: ORBI,
  [DDANZI.id]: DDANZI,
  [COOK82.id]: COOK82,
  [LOCAL_BOARD.id]: LOCAL_BOARD,
  // Video 2
  [YOUTUBE_SHORTS.id]: YOUTUBE_SHORTS,
  [TIKTOK.id]: TIKTOK,
  // Messenger 3
  [KAKAO_OPENCHAT.id]: KAKAO_OPENCHAT,
  [KAKAO_CHANNEL.id]: KAKAO_CHANNEL,
  [TELEGRAM_CHANNEL.id]: TELEGRAM_CHANNEL,
  // International 4
  [REDDIT_KOREA.id]: REDDIT_KOREA,
  [REDDIT_GENERIC.id]: REDDIT_GENERIC,
  [GITHUB_DISCUSSIONS.id]: GITHUB_DISCUSSIONS,
  [MEDIUM.id]: MEDIUM,
};

/**
 * 등록된 채널 메타 목록 — UI에 노출.
 * @returns {Array<{id:string,name:string,category:string,riskTier:string,confidence:string,icon?:string,color?:string,openUrl?:string}>}
 */
function listChannels() {
  return Object.values(CHANNEL_REGISTRY).map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    riskTier: c.riskTier,
    confidence: c.confidence,
    icon: c.icon,
    color: c.color,
    openUrl: c.openUrl,
  }));
}

/**
 * 채널 ID로 프롬프트 객체 조회.
 * @param {string} channelId
 * @returns {import('./_shared/types').ChannelPrompt|null}
 */
function getChannel(channelId) {
  return CHANNEL_REGISTRY[channelId] || null;
}

/**
 * Stage 1 요약이 없는 단순 케이스용 — 원본 제목/URL만으로 fallback 요약 합성.
 * @param {string} title
 * @param {string} [contentHint]
 * @returns {import('./_shared/types').Stage1Summary}
 */
function buildMinimalSummary(title, contentHint) {
  return {
    coreValue: contentHint ? contentHint.slice(0, 200) : title,
    hooks: [title, `${title} — 한 줄 정리`, `${title} 핵심`],
    keyPoints: contentHint ? [contentHint.slice(0, 100)] : [title],
    keywords: title.split(/\s+/).filter((w) => w.length >= 2).slice(0, 10),
    dataPoints: [],
    sentiment: 'neutral',
  };
}

/**
 * 채널 + 입력 → LLM 호출용 system/user prompt 생성.
 *
 * @param {string} channelId
 * @param {{ sourceSummary: import('./_shared/types').Stage1Summary, sourceUrl: string, sourceTitle: string, subChannel?: string, userCustomRule?: string }} params
 * @returns {{ system: string, user: string, channel: import('./_shared/types').ChannelPrompt, maxOutputTokens: number }}
 */
function buildPromptPair(channelId, params) {
  const channel = getChannel(channelId);
  if (!channel) throw new Error('UNKNOWN_CHANNEL');
  return {
    system: channel.buildSystemPrompt(params.subChannel, params.userCustomRule),
    user: channel.buildUserPrompt(params),
    channel,
    maxOutputTokens: channel.maxOutputTokens,
  };
}

/**
 * LLM 결과 → 채널 규칙으로 포맷팅 + 길이 검증 + 위험 평가.
 *
 * @param {string} channelId
 * @param {string} rawText
 * @returns {{ formatted: import('./_shared/types').FormattedOutput, lengthViolations: string[], risk: import('./_shared/types').RiskAssessment, channel: import('./_shared/types').ChannelPrompt }}
 */
function processResponse(channelId, rawText) {
  const channel = getChannel(channelId);
  if (!channel) throw new Error('UNKNOWN_CHANNEL');
  let formatted = postFormat(rawText, channel);
  let extra = {};
  if (typeof channel.processStructuredResponse === 'function') {
    const structured = channel.processStructuredResponse(rawText);
    if (structured && structured.formatted) {
      formatted = structured.formatted;
    }
    if (structured && structured.extra && typeof structured.extra === 'object') {
      extra = structured.extra;
    }
  }
  const commonGuard = applyCommonResponseGuard(channelId, formatted, extra);
  formatted = commonGuard.formatted || formatted;
  extra = commonGuard.extra || extra;
  const lengthViolations = validateLength(formatted, channel);
  if (commonGuard.review && commonGuard.review.violations && commonGuard.review.violations.length) {
    lengthViolations.push(...commonGuard.review.violations.map((item) => `공통 안전검수: ${item}`));
  }
  if (channelId === 'instagram') {
    const variants = Array.isArray(extra.instagram && extra.instagram.variants)
      ? extra.instagram.variants
      : [];
    if (variants.length > 0 && variants.length < 3) {
      lengthViolations.push(`인스타그램 A/B/C ${variants.length}/3안 생성됨 (3안 모두 필요)`);
    }
  }
  // 위험 평가는 평탄화된 단일 문자열에 대해 (multi-output은 모든 parts 합쳐서)
  if (channelId === 'threads') {
    const variants = Array.isArray(extra.threads && extra.threads.variants)
      ? extra.threads.variants
      : [];
    if (variants.length > 0 && variants.length < 3) {
      lengthViolations.push(`Threads A/B/C ${variants.length}/3 generated (all 3 variants required)`);
    }
  }
  if (channelId === 'naver-blog') {
    const variants = Array.isArray(extra.naverBlog && extra.naverBlog.variants)
      ? extra.naverBlog.variants
      : [];
    if (variants.length > 0 && variants.length < 3) {
      lengthViolations.push(`Naver Blog A/B/C ${variants.length}/3 generated (all 3 variants required)`);
    }
  }
  const structuredVariantKeys = {
    'naver-cafe': ['naverCafe', 'Naver Cafe'],
    x: ['x', 'X'],
    facebook: ['facebook', 'Facebook'],
    'kakao-openchat': ['kakaoOpenChat', 'Kakao OpenChat'],
    'youtube-shorts': ['youtubeShorts', 'YouTube Shorts'],
    tiktok: ['tiktok', 'TikTok'],
    pinterest: ['pinterest', 'Pinterest'],
  };
  if (structuredVariantKeys[channelId]) {
    const [extraKey, label] = structuredVariantKeys[channelId];
    const variants = Array.isArray(extra[extraKey] && extra[extraKey].variants)
      ? extra[extraKey].variants
      : [];
    if (variants.length > 0 && variants.length < 3) {
      lengthViolations.push(`${label} A/B/C ${variants.length}/3 generated (all 3 variants required)`);
    }
  }
  const flat = flatten(formatted);
  const risk = channel.assessRisk(flat);
  return { formatted, lengthViolations, risk, channel, ...extra };
}

/**
 * FormattedOutput → 단일 문자열로 평탄화 (위험 평가 입력용).
 * @param {import('./_shared/types').FormattedOutput} f
 * @returns {string}
 */
function flatten(f) {
  if (!f) return '';
  const segs = [];
  if (typeof f.body === 'string') segs.push(f.body);
  if (Array.isArray(f.hashtags)) segs.push(f.hashtags.join(' '));
  if (f.parts && typeof f.parts === 'object') {
    for (const k of Object.keys(f.parts)) {
      if (typeof f.parts[k] === 'string') segs.push(f.parts[k]);
    }
  }
  return segs.join('\n\n');
}

module.exports = {
  CHANNEL_REGISTRY,
  listChannels,
  getChannel,
  buildPromptPair,
  processResponse,
  buildMinimalSummary,
  validateGenerateV2Payload,
  buildRetryHint,
  flatten,
};
