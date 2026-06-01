'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const TMP = path.join(os.tmpdir(), 'orbit-cost-test-' + process.pid);
process.env.ORBIT_DATA_DIR = TMP;

jest.resetModules();
const cost = require('../../../src/core/external-traffic/cost-tracker');

beforeEach(() => {
  if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true, force: true });
});

afterAll(() => {
  if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true, force: true });
});

describe('cost-tracker', () => {
  test('초기 사용량 0', () => {
    const cm = cost.currentMonth();
    expect(cm.totalTokens).toBe(0);
  });

  test('Gemini 사용량 기록 + 비용 누적', () => {
    cost.recordUsage({ provider: 'gemini', inputTokens: 1000, outputTokens: 500, channel: 'instagram' });
    const cm = cost.currentMonth();
    expect(cm.totalTokens).toBe(1500);
    expect(cm.costUSD).toBeGreaterThan(0);
    expect(cm.byProvider.gemini).toBeDefined();
    expect(cm.byChannel.instagram).toBeDefined();
    expect(cm.byChannel.instagram.generations).toBe(1);
  });

  test('OpenAI 비용 = Gemini의 ~2x (rate 차이)', () => {
    cost.recordUsage({ provider: 'gemini', inputTokens: 1_000_000, outputTokens: 0 });
    const g = cost.currentMonth().costUSD;
    jest.resetModules();
    if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true, force: true });
    const cost2 = require('../../../src/core/external-traffic/cost-tracker');
    cost2.recordUsage({ provider: 'openai', inputTokens: 1_000_000, outputTokens: 0 });
    const o = cost2.currentMonth().costUSD;
    expect(o).toBeGreaterThan(g);
  });

  test('상한 도달 시 exceeded true', () => {
    cost.setLimits({ monthlyTokens: 100 });
    cost.recordUsage({ provider: 'gemini', inputTokens: 80, outputTokens: 30 });
    const block = cost.checkBlockOnLimit();
    expect(block.exceeded).toBe(true);
    expect(block.used).toBe(110);
  });

  test('PROVIDER_RATES 정의', () => {
    expect(cost.PROVIDER_RATES.gemini).toBeDefined();
    expect(cost.PROVIDER_RATES.openai).toBeDefined();
    expect(cost.PROVIDER_RATES.claude).toBeDefined();
  });
});
