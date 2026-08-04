/**
 * v3.8.445 — vision 이 **사용자가 쓰지도 않는 제공자로 새던** 문제
 *
 * 사용자 지적(2026-08-04): "제미나이 충전을 못해서 안쓴다고"
 *   실제 설정: .env 의 AI_PROVIDER=openai
 *   그런데 vision 라우팅 기본값이 'gemini' 로 하드코딩돼 있었다.
 *   payload 가 모델명을 안 실어 보내면 상세 이미지 추론만 Gemini 로 갔고,
 *   그 키는 구글이 차단한 상태라 추론이 통째로 실패했다.
 *
 * 실제 API 를 부르지 않는다 — 라우팅 결정만 검사한다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { resolveRouting } from '../src/core/affiliate/detail-image-vision';

const orch = fs.readFileSync(path.join(__dirname, '..', 'src/core/final/orchestration.ts'), 'utf-8');

const K = {
  all: { gemini: 'g', claude: 'c', openai: 'o' },
  openaiOnly: { openai: 'o' },
  claudeOnly: { claude: 'c' },
  none: {},
};

describe('① 호출부가 모델을 지정하면 그대로 따른다', () => {
  it('⭐ openai 지정 → openai', () => {
    expect(resolveRouting({ textGenerator: 'openai', apiKeys: K.all }).vendor).toBe('openai');
  });

  it('⭐ claude 지정 → claude', () => {
    expect(resolveRouting({ textGenerator: 'claude', apiKeys: K.all }).vendor).toBe('claude');
  });

  it('⭐ gemini 를 명시하면 gemini (사용자가 골랐으면 존중한다)', () => {
    expect(resolveRouting({ textGenerator: 'gemini', apiKeys: K.all }).vendor).toBe('gemini');
  });
});

describe('② 지정이 없으면 AI_PROVIDER 설정을 따른다 (gemini 하드코딩 금지)', () => {
  const prev = process.env['AI_PROVIDER'];
  afterEach(() => {
    if (prev === undefined) delete process.env['AI_PROVIDER'];
    else process.env['AI_PROVIDER'] = prev;
  });

  it('⭐⭐ AI_PROVIDER=openai 면 openai 로 간다', () => {
    process.env['AI_PROVIDER'] = 'openai';
    expect(resolveRouting({ textGenerator: '', apiKeys: K.all }).vendor).toBe('openai');
  });

  it('⭐ AI_PROVIDER=claude 면 claude 로 간다', () => {
    process.env['AI_PROVIDER'] = 'claude';
    expect(resolveRouting({ apiKeys: K.all }).vendor).toBe('claude');
  });
});

describe('③ 그 vendor 에 키가 없으면 키 있는 쪽으로 옮긴다 (조용히 죽지 않는다)', () => {
  it('⭐⭐ gemini 로 라우팅됐는데 gemini 키가 없으면 openai 로 전환', () => {
    const r = resolveRouting({ textGenerator: 'gemini', apiKeys: K.openaiOnly });
    expect(r.vendor).toBe('openai');
    expect(r.fellBack).toBe(true);
    expect(r.reason).toContain('키가 없어');
  });

  it('⭐ openai 도 없으면 claude 로', () => {
    const r = resolveRouting({ textGenerator: 'gemini', apiKeys: K.claudeOnly });
    expect(r.vendor).toBe('claude');
    expect(r.fellBack).toBe(true);
  });

  it('⭐ 아무 키도 없으면 억지로 바꾸지 않는다 (위에서 실패 로그가 남는다)', () => {
    const r = resolveRouting({ textGenerator: 'gemini', apiKeys: K.none });
    expect(r.vendor).toBe('gemini');
  });

  it('⭐ 전환 사유를 로그에 싣는다', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src/core/affiliate/detail-image-vision.ts'), 'utf-8');
    expect(src).toContain('routing.fellBack && routing.reason');
  });
});

describe('④ orchestration 이 gemini 를 박아 넘기지 않는다', () => {
  it('⭐⭐ 하드코딩된 gemini 기본값이 사라졌다', () => {
    expect(orch).not.toContain("payload.textGenerator || 'gemini'");
    expect(orch).toContain("String(payload.aiModel || payload.textGenerator || '')");
  });
});
