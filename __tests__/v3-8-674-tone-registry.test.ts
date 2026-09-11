const fs = require('fs');
const path = require('path');

import { getToneInstruction, toneEndings, toneForbidden, tonePrefersHaeyo, toneMixAllowance, normalizeTone, TONE_LABELS } from '../src/core/final/tone-registry';
import { getToneInstruction as fromBuilder } from '../src/core/content-modes/base-prompt-builder';
import { getToneInstruction as fromMaxMode } from '../src/core/max-mode/tone-text-utils';
import { setActiveToneStyle, shouldApplyCasualTransform, toneEndingRule, applyCasualTransform } from '../src/core/final/generation';
import { findToneMix } from '../src/core/final/article-audit';
import { LEADERNAM_VOICE_RULES } from '../src/core/final/voice-profile';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.674 — 사장님: "각 이름에 걸맞게 확실한 차이가 있어야지."
 * 드롭다운 다섯 말투가 이름대로 다르게 나오고, 정의는 tone-registry 한 곳이며, 모든 소비처가 거기서 읽는다.
 */
const TONES = ['professional', 'formal', 'friendly', 'conversational', 'casual'] as const;

describe('v3.8.674 말투 등록부 — 다섯 말투가 이름대로 다르다', () => {
  test('드롭다운 다섯 값이 전부 있고 서로 다른 지시를 받는다', () => {
    const html = read('electron/ui/index.html');
    for (const t of TONES) expect(html).toContain(`<option value="${t}"`);
    const texts = TONES.map((t) => getToneInstruction(t));
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) expect(texts[i]).not.toBe(texts[j]);
    expect(Object.keys(TONE_LABELS)).toEqual([...TONES]);
  });

  test('이름에 맞는 표지 — 전문적은 되묻기 금지, 격식은 대상 명칭, 친근은 선생님, 대화체는 리더남 대본, 캐주얼은 편한 말버릇', () => {
    // v3.8.721 — 막는 것은 **되묻기**로 좁혔다. 서술형 "~죠." 는 쓴다(말투를 한 목소리로 만들기 위해).
    expect(getToneInstruction('professional')).toContain('되묻기("~죠?", "어떠신가요?")');
    expect(getToneInstruction('professional')).not.toContain(LEADERNAM_VOICE_RULES);
    expect(getToneInstruction('formal')).toContain('"신청인", "가입자", "보호자"');
    expect(getToneInstruction('formal')).toContain('물음표·느낌표를 쓰지 않습니다');
    expect(getToneInstruction('friendly')).toContain('선생님이 앞에 앉은 한 사람에게');
    expect(getToneInstruction('friendly')).toContain(LEADERNAM_VOICE_RULES);
    expect(getToneInstruction('conversational')).toContain('리더남이 영상에서 말하는 그 말투');
    expect(getToneInstruction('conversational')).toContain('다섯 문장 중 넷은 합니다체');
    expect(getToneInstruction('casual')).toContain('"~구요", "~더라구요"');
    expect(getToneInstruction('casual')).toContain('반말은 아닙니다');
    for (const t of TONES) expect(getToneInstruction(t)).toContain('지어낸 체험담');
    expect(normalizeTone('unknown')).toBe('professional');
    expect(normalizeTone(' Friendly ')).toBe('friendly');
  });

  test('어미 한 줄과 금지 한 줄이 말투마다 다르고, 해요체 치환은 친근·캐주얼에만 건다', () => {
    const ends = TONES.map(toneEndings);
    expect(new Set(ends).size).toBe(5);
    expect(toneEndings('conversational')).toContain('합니다체');
    expect(toneEndings('conversational')).toContain('~죠');
    expect(toneForbidden('conversational')).toContain('해요체로 통일하는 것');
    expect(toneForbidden('formal')).toContain('구어체와 감탄');
    expect(tonePrefersHaeyo('friendly')).toBe(true);
    expect(tonePrefersHaeyo('casual')).toBe(true);
    expect(tonePrefersHaeyo('conversational')).toBe(false);
    expect(tonePrefersHaeyo('professional')).toBe(false);
    expect(toneMixAllowance('conversational')).toBeGreaterThan(toneMixAllowance('friendly'));
  });

  test('소비처가 전부 등록부를 읽는다 — builder · max-mode · generation · post-critique · 본문 프롬프트 · 에이전트', () => {
    for (const t of TONES) {
      expect(fromBuilder(t)).toBe(getToneInstruction(t));
      expect(fromMaxMode(t).trim()).toBe(getToneInstruction(t).trim());
    }
    const g = read('src/core/final/generation.ts');
    expect(g).toContain("return require('./tone-registry').tonePrefersHaeyo(activeToneStyle);");
    expect(g).toContain('- 어미: ${toneEndingRule()}');
    expect(g).toContain('- ${toneForbiddenRule()}');
    expect(g).not.toContain("shouldApplyCasualTransform() ? '");   // 어미 분기가 등록부 한 줄로 바뀌었다
    expect(read('src/core/final/post-critique.ts')).toContain("require('./generation').toneEndingRule()");
    const m = read('electron/main.ts');
    // v3.8.690 — src/ → dist/. src 에는 .ts 만 있어 이 채널은 로드에 실패하고 있었다
    //   (문자열만 맞춰 보면 죽은 기능도 통과한다 — v3-8-690 테스트에 파일 존재 검사를 뒀다)
    expect(m).toContain("require('../dist/core/final/tone-registry')");
    expect((m.match(/\.\.\.registryBlock,/g) || []).length).toBe(5);
    expect(m).not.toContain('"저도 처음엔 헷갈렸어요"');   // 지어낸 체험을 시키던 줄이 사라졌다
  });

  test('대화체는 합니다체를 해요체로 바꾸지 않고, 말투 섞임 검사가 공감 어미를 허용한다', () => {
    setActiveToneStyle('conversational');
    try {
      expect(shouldApplyCasualTransform()).toBe(false);
      expect(applyCasualTransform('이 걱정은 충분히 이해합니다.')).toBe('이 걱정은 충분히 이해합니다.');
      expect(toneEndingRule()).toContain('공감 어미');
      // 합니다체 15문장 + 공감 어미 8문장(35%) — 대화체면 통과, 다른 말투면 섞임 (검사는 문장 20개부터 본다)
      const text = '이것은 설명입니다. '.repeat(15) + '정말 맞거든요. '.repeat(8);
      expect(findToneMix(text).issues).toHaveLength(0);
    } finally {
      setActiveToneStyle('professional');
    }
    const text = '이것은 설명입니다. '.repeat(15) + '정말 맞거든요. '.repeat(8);
    expect(findToneMix(text).issues.map((i) => i.kind)).toContain('tone-mix');
    setActiveToneStyle('friendly');
    try {
      expect(shouldApplyCasualTransform()).toBe(true);
      expect(applyCasualTransform('충분히 이해합니다.')).toBe('충분히 이해해요.');
    } finally {
      setActiveToneStyle('professional');
    }
  });
});
