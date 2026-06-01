// test/external-traffic/unit/validate-input.test.js
// IPC v2 입력 검증 — payload schema.

'use strict';

const { validateGenerateV2Payload } = require('../../../src/core/external-traffic/_shared/validate-input');

describe('validateGenerateV2Payload', () => {
  const valid = {
    sourceUrl: 'https://example.com/post/1',
    sourceTitle: '예시 글 제목',
    channels: [
      { id: 'instagram' },
      { id: 'naver-blog', userCustomRule: '친근한 어조 유지' },
    ],
    options: { safeMode: true, addUtm: false },
  };

  test('정상 payload 통과 + 기본값 보강', () => {
    const out = validateGenerateV2Payload(valid);
    expect(out.sourceUrl).toBe(valid.sourceUrl);
    expect(out.channels.length).toBe(2);
    expect(out.options.safeMode).toBe(true);
    expect(out.options.englishMode).toBe(false);
  });

  test('null payload 차단', () => {
    expect(() => validateGenerateV2Payload(null)).toThrow('INVALID_PAYLOAD');
  });

  test('http(s) 외 scheme 차단', () => {
    const bad = { ...valid, sourceUrl: 'javascript:alert(1)' };
    expect(() => validateGenerateV2Payload(bad)).toThrow();
  });

  test('빈 URL 차단', () => {
    const bad = { ...valid, sourceUrl: '' };
    expect(() => validateGenerateV2Payload(bad)).toThrow('INVALID_SOURCE_URL');
  });

  test('너무 긴 제목 차단', () => {
    const bad = { ...valid, sourceTitle: 'a'.repeat(301) };
    expect(() => validateGenerateV2Payload(bad)).toThrow('INVALID_SOURCE_TITLE');
  });

  test('채널 0개 차단', () => {
    const bad = { ...valid, channels: [] };
    expect(() => validateGenerateV2Payload(bad)).toThrow('INVALID_CHANNELS_COUNT');
  });

  test('채널 16개 초과 차단', () => {
    const bad = { ...valid, channels: Array(16).fill({ id: 'instagram' }) };
    expect(() => validateGenerateV2Payload(bad)).toThrow('INVALID_CHANNELS_COUNT');
  });

  test('잘못된 채널 ID 차단', () => {
    const bad = { ...valid, channels: [{ id: '../etc/passwd' }] };
    expect(() => validateGenerateV2Payload(bad)).toThrow('INVALID_CHANNEL_ID');
  });

  test('userCustomRule 길이 초과 차단', () => {
    const bad = { ...valid, channels: [{ id: 'instagram', userCustomRule: 'a'.repeat(201) }] };
    expect(() => validateGenerateV2Payload(bad)).toThrow('INVALID_USER_CUSTOM_RULE');
  });
});
