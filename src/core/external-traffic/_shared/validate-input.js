// src/core/external-traffic/_shared/validate-input.js
// IPC 입력 검증 — zod 미사용 환경에서 직접 구현한 가벼운 schema validator.
// generate-external-traffic-text-v2 핸들러 보안 경계.

'use strict';

const CHANNEL_ID_RE = /^[a-z0-9-]{1,40}$/;
const SUBCHANNEL_RE = /^[\p{L}\p{N}\-_]{1,40}$/u;

/**
 * @typedef {Object} GenerateV2Payload
 * @property {string} sourceUrl
 * @property {string} sourceTitle
 * @property {Array<{ id: string, subChannel?: string, userCustomRule?: string }>} channels
 * @property {{ safeMode?: boolean, addUtm?: boolean, englishMode?: boolean }} [options]
 */

/**
 * 가벼운 validation — schema 외 키 무시, 위반 시 throw.
 *
 * @param {any} payload
 * @returns {GenerateV2Payload}
 */
function validateGenerateV2Payload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('INVALID_PAYLOAD');
  }
  const { sourceUrl, sourceTitle, channels, options } = payload;

  if (typeof sourceUrl !== 'string' || sourceUrl.length === 0 || sourceUrl.length > 2000) {
    throw new Error('INVALID_SOURCE_URL');
  }
  if (!/^https?:\/\//i.test(sourceUrl)) {
    throw new Error('INVALID_SOURCE_URL_SCHEME');
  }
  if (typeof sourceTitle !== 'string' || sourceTitle.length === 0 || sourceTitle.length > 300) {
    throw new Error('INVALID_SOURCE_TITLE');
  }
  if (!Array.isArray(channels) || channels.length === 0 || channels.length > 15) {
    throw new Error('INVALID_CHANNELS_COUNT');
  }
  /** @type {GenerateV2Payload['channels']} */
  const cleanChannels = [];
  for (const ch of channels) {
    if (!ch || typeof ch !== 'object') {
      throw new Error('INVALID_CHANNEL_ENTRY');
    }
    if (typeof ch.id !== 'string' || !CHANNEL_ID_RE.test(ch.id)) {
      throw new Error('INVALID_CHANNEL_ID');
    }
    const cleaned = { id: ch.id };
    if (ch.subChannel != null) {
      if (typeof ch.subChannel !== 'string' || !SUBCHANNEL_RE.test(ch.subChannel)) {
        throw new Error('INVALID_SUBCHANNEL');
      }
      cleaned.subChannel = ch.subChannel;
    }
    if (ch.userCustomRule != null) {
      if (typeof ch.userCustomRule !== 'string' || ch.userCustomRule.length > 200) {
        throw new Error('INVALID_USER_CUSTOM_RULE');
      }
      cleaned.userCustomRule = ch.userCustomRule;
    }
    cleanChannels.push(cleaned);
  }

  let cleanOptions = { safeMode: true, addUtm: false, englishMode: false };
  if (options && typeof options === 'object') {
    if (typeof options.safeMode === 'boolean') cleanOptions.safeMode = options.safeMode;
    if (typeof options.addUtm === 'boolean') cleanOptions.addUtm = options.addUtm;
    if (typeof options.englishMode === 'boolean') cleanOptions.englishMode = options.englishMode;
  }

  return {
    sourceUrl,
    sourceTitle,
    channels: cleanChannels,
    options: cleanOptions,
  };
}

module.exports = {
  validateGenerateV2Payload,
  CHANNEL_ID_RE,
  SUBCHANNEL_RE,
};
