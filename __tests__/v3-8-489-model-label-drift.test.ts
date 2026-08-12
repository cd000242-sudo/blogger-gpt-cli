/**
 * v3.8.489 — 화면에 뜨는 모델명이 실제와 달랐다
 *
 * 사장님: "지금 3.6을 선택했는데 3.5라고떠요 로그에는 2.5플래쉬라뜹니다"
 *
 * ## 실제 호출은 맞았다
 * buildGeminiChain 은 tier.modelId(= gemini-3.6-flash)로 부른다. 표시만 틀렸다.
 *
 * ## 원인 두 가지
 * ① script.js 의 MODEL_DISPLAY 가 **백엔드 표를 손으로 베낀 복사본**이었다.
 *    v3.8.483 에서 백엔드만 3.6 으로 고쳐지고 이쪽은 3.5 로 남았다.
 * ② 로그가 `finalModel`(= 사용자 설정 키 'gemini-2.5-flash')을 그대로 찍었다.
 *    설정 키는 옛 이름을 유지해야 기존 사용자 선택이 안 깨지므로 바꿀 수 없다 —
 *    대신 **사람이 읽을 이름과 실제 모델 id** 를 찍어야 한다.
 *
 * ## 이 테스트가 하는 일
 * 복사본이 다시 어긋나면 게이트가 잡는다. 라벨은 한 곳(pricing.ts)에서만 정한다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { TIER_MODELS } from '../src/core/llm/pricing';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const scriptJs = read('electron/ui/script.js');
const indexHtml = read('electron/ui/index.html');
const orchestration = read('src/core/final/orchestration.ts');

/** script.js 의 MODEL_DISPLAY 를 읽어 { value: label } 로 만든다 */
function readUiLabels(): Record<string, string> {
  const start = scriptJs.indexOf('const MODEL_DISPLAY = {');
  const end = scriptJs.indexOf('};', start);
  expect(start).toBeGreaterThan(-1);
  const block = scriptJs.slice(start, end);
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/'([^']+)':\s*\{\s*label:\s*'([^']+)'/g)) {
    out[m[1]!] = m[2]!;
  }
  return out;
}

describe('① 화면 라벨이 백엔드 표와 일치한다', () => {
  const uiLabels = readUiLabels();

  it('⭐⭐ 백엔드에 있는 모델은 UI 라벨도 같아야 한다 (여기서 갈리면 사장님이 딴 모델로 안다)', () => {
    const mismatches: string[] = [];
    for (const tier of TIER_MODELS) {
      const ui = uiLabels[tier.value];
      if (!ui) continue;                       // UI 에 없는 건 다른 테스트가 본다
      if (!ui.includes(tier.title)) mismatches.push(`${tier.value}: UI "${ui}" ≠ 백엔드 "${tier.title}"`);
    }
    expect(mismatches).toEqual([]);
  });

  it('⭐⭐ 사장님이 겪은 그 항목 — 3.6 을 골랐는데 3.5 로 뜨던 것', () => {
    expect(uiLabels['gemini-2.5-flash']).toContain('3.6');
    expect(uiLabels['gemini-2.5-flash']).not.toContain('3.5');
  });

  it('⭐⭐ 없어진 모델을 계속 보여주지 않는다 (3.1 Pro Preview 는 v3.8.483 에서 제거됐다)', () => {
    expect(Object.values(uiLabels).join(' ')).not.toContain('3.1 Pro Preview');
  });

  it('⭐⭐ 화면에 처음 뜨는 기본 라벨도 실제 기본 모델과 같다', () => {
    const defaultTier = TIER_MODELS.find((t) => (t as any).default);
    expect(defaultTier).toBeTruthy();
    const span = indexHtml.slice(
      indexHtml.indexOf('<span id="currentEngineLabel">'),
      indexHtml.indexOf('</span>', indexHtml.indexOf('<span id="currentEngineLabel">')),
    );
    expect(span).toContain(defaultTier!.title);
  });
});

describe('② 로그가 실제 모델을 보여준다', () => {
  it('⭐⭐ 설정 키만 찍지 않는다 (gemini-2.5-flash 로 보이면 2.5 를 쓰는 줄 안다)', () => {
    const line = orchestration.slice(
      orchestration.indexOf('🎯 AI 엔진:') - 200,
      orchestration.indexOf('🎯 AI 엔진:') + 300,
    );
    expect(line).toContain('describeModelForLog');
  });

  it('⭐⭐ 사람이 읽는 이름과 실제 모델 id 를 함께 찍는다', () => {
    const { describeModelForLog } = require('../src/core/llm/pricing');
    const text = describeModelForLog('gemini-2.5-flash');
    expect(text).toContain('Gemini 3.6 Flash');
    expect(text).toContain('gemini-3.6-flash');
  });

  it('⭐ 모르는 값이면 받은 값을 그대로 보여준다 (빈 로그보다 낫다)', () => {
    const { describeModelForLog } = require('../src/core/llm/pricing');
    expect(describeModelForLog('알-수-없는-모델')).toContain('알-수-없는-모델');
    expect(describeModelForLog('')).toBe('');
  });
});
