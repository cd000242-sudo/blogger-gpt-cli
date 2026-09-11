/**
 * 말투를 한 목소리로 — 프롬프트와 후처리가 같은 말을 하게 한다 (v3.8.721)
 *
 * 사장님: "전체적으로 말투가 하나가 되어야 되"
 *
 * ## 무엇이 잘못돼 있었나 (v3.8.720 에서 제가 낸 사고)
 * 「전문적」 프롬프트는 `"~죠" 를 쓰지 않습니다` 라고 **금지**하는데,
 * v3.8.720 의 후처리는 말투와 무관하게 `~죠` 를 **넣었다.**
 * 규칙이 둘로 갈려 싸우니 글이 34%만 섞인 채 들쭉날쭉해졌다.
 * (실측: 블로그스팟 74문단 중 25개만 섞임 / 워드프레스 61문단 전부 합니다체)
 *
 * ## 고친 방향
 *   · 막을 것은 **되묻기**("~죠?")이지 서술형 어미("~죠.")가 아니다 → 프롬프트가 먼저 쓰게 한다
 *   · 후처리는 **말투가 허락한 경우에만** 돈다 → 보조일 뿐 규칙을 거스르지 않는다
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  getToneInstruction,
  toneEndings,
  toneForbidden,
  toneAllowsVoiceSoftening,
} from '../src/core/final/tone-registry';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

describe('① 전문적 말투가 서술형 어미를 쓰게 한다', () => {
  const instruction = getToneInstruction('professional');

  it('⭐⭐ 프롬프트가 "~죠." "~거든요." 를 허용한다', () => {
    expect(instruction).toContain('"~죠."');
    expect(instruction).toContain('"~거든요."');
    expect(instruction).toContain('절마다 한두 번');
  });

  it('⭐⭐ 되묻기는 계속 막는다 (법률·금융 글에서 "간단하죠?" 가 나오면 신뢰가 깎인다)', () => {
    expect(instruction).toContain('되묻기("~죠?", "어떠신가요?")');
    expect(instruction).toMatch(/물음표·느낌표는 소제목이 아니면 쓰지 않습니다/);
  });

  it('⭐⭐ 시키는 문장에는 붙이지 말라고 못박는다 (붙이면 청유가 된다)', () => {
    expect(instruction).toContain('같이 하자는 말이 되어 뜻이 달라집니다');
  });

  it('⭐⭐ 어미 한 줄·금지 한 줄도 같이 바뀌었다 (FAQ·요약이 이걸 읽는다)', () => {
    expect(toneEndings('professional')).toContain('~죠.');
    expect(toneForbidden('professional')).not.toMatch(/"~거든요" 반말투/);
    expect(toneForbidden('professional')).toContain('되묻기');
  });
});

describe('② 다른 말투는 건드리지 않았다', () => {
  it('⭐⭐ 격식체는 여전히 구어체를 전부 막는다', () => {
    expect(toneForbidden('formal')).toContain('"~죠"');
    expect(getToneInstruction('formal')).toContain('격식');
  });

  it('⭐ 해요체 말투는 그대로', () => {
    expect(toneEndings('friendly')).toContain('해요체');
    expect(toneEndings('casual')).toContain('해요체');
  });

  it('⭐ 대화체는 원래 설계 그대로', () => {
    expect(toneEndings('conversational')).toContain('공감 어미');
  });
});

describe('③ 후처리는 말투에 복종한다', () => {
  it('⭐⭐ 합니다체 계열에서만 돈다', () => {
    expect(toneAllowsVoiceSoftening('professional')).toBe(true);
    expect(toneAllowsVoiceSoftening('conversational')).toBe(true);
  });

  it('⭐⭐ 격식체·해요체에서는 안 돈다', () => {
    expect(toneAllowsVoiceSoftening('formal')).toBe(false);
    expect(toneAllowsVoiceSoftening('friendly')).toBe(false);
    expect(toneAllowsVoiceSoftening('casual')).toBe(false);
  });

  it('⭐ 값이 없으면 기본값(전문적)을 따른다', () => {
    expect(toneAllowsVoiceSoftening(undefined)).toBe(true);
    expect(toneAllowsVoiceSoftening('')).toBe(true);
  });

  it('⭐⭐ 발행 경로 두 곳이 그 판단을 실제로 부른다', () => {
    const orch = read('src/core/final/orchestration.ts');
    expect(orch).toContain('toneAllowsVoiceSoftening(toneStyle)');
    expect(orch).not.toMatch(/toneStyle !== 'formal' && !isEnglish/);   // 옛 판단이 남아 있으면 안 된다

    const main = read('electron/main.ts');
    expect(main).toContain('toneAllowsVoiceSoftening(toneStyle)');
    expect(main).not.toMatch(/toneStyle !== 'formal' && !isEnglish/);
  });
});

describe('④ 말투는 플랫폼과 무관하다 (워드프레스·티스토리·블로그스팟이 같이 바뀐다)', () => {
  it('⭐⭐ 말투 판단에 플랫폼 분기가 없다', () => {
    const registry = read('src/core/final/tone-registry.ts');
    expect(registry).not.toMatch(/wordpress|tistory|blogspot/i);
  });

  it('⭐ 화면은 말투를 한 곳에서만 읽는다', () => {
    const posting = read('electron/ui/modules/posting.js');
    const reads = posting.match(/getElementById\('toneStyle'\)/g) || [];
    expect(reads.length).toBe(1);
  });
});
