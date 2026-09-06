const fs = require('fs');
const path = require('path');

import { inspectBeforePublish, pickSections } from '../src/core/final/pre-publish-fix';
import { splitSections } from '../src/core/final/post-critique';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.673 — 실 설계 3차(P4 + P5 감점). 이미 있는 품질 보강 1회 호출이 실 위반도 고치고,
 * 서론 질문·절 닫음 검사가 감점과 자가 수정 대상이 된다. 편당 호출 상한은 그대로.
 */
describe('v3.8.673 보강 호출이 실 위반을 고친다 · 흐름 검사 감점', () => {
  test('P4 generateAllSectionsFinal 이 실을 받고, 트리거·프롬프트·수용 판정에 실 위반이 들어간다', () => {
    const g = read('src/core/final/generation.ts');
    expect(g).toContain("thread?: import('./thread').Thread | undefined,");
    expect(g).toContain('const threadBefore: string[] = thread ? threadViolations(allSectionsObj, thread) : [];');
    expect(g).toContain('if (!skipBoost && (lowQuality || threadBefore.length > 0)) {');
    expect(g).toContain('🧵 [실 위반 — 반드시 고칠 것]');
    // 실 위반만으로 돌 때는 분량을 늘리라고 하지 않는다
    expect(g).toContain("'2) 분량은 지금 그대로(±10%). 늘리려고 같은 말을 되풀이하지 않습니다");
    // 수용 판정: 위반이 늘면 폐기, 실 위반만으로 불렀는데 안 줄었으면 폐기
    expect(g).toContain('reasons.push(`실 위반 증가(${threadBefore.length}→${threadAfter.length})`)');
    expect(g).toContain('else if (!lowQuality && threadAfter.length >= threadBefore.length) reasons.push(`실 위반 그대로(${threadBefore.length})`)');
    // 보강 프롬프트의 말투가 설정을 따른다 — "~해요" 고정이 합니다체 글에 해요체를 섞고 있었다
    expect(g).toContain('- ${toneEndingRule()} — 본문과 같은 말투 (v3.8.673: 보강이 말투를 바꾸지 않는다)');   // v3.8.674 등록부
    expect(g).not.toContain('📝 톤 규칙:\n- "~해요", "~거든요" 친근한 말투\n');
  });

  test('P4 orchestration 이 다섯 호출 자리 모두에 실을 넘긴다 (조용한 미배선 방지)', () => {
    const o = read('src/core/final/orchestration.ts');
    const calls = [...o.matchAll(/await generateAllSectionsFinal\(([\s\S]*?)\);/g)].map((m) => m[1]!);
    expect(calls).toHaveLength(5);
    for (const args of calls) expect(args).toContain('articleThread');
  });

  test('말투 — 본문 생성이 읽는 말투 지시가 사장님 대본 본보기를 담고, 본문 프롬프트에 말투 블록이 실린다 (조용한 미배선 7번째)', () => {
    const { getToneInstruction: maxMode } = require('../src/core/max-mode/tone-text-utils');
    const { getToneInstruction: builder } = require('../src/core/content-modes/base-prompt-builder');
    const { LEADERNAM_VOICE_RULES, VOICE_HABITS } = require('../src/core/final/voice-profile');
    // v3.8.674: "선생님이 한 사람에게" 는 친근한의 표지다. 대본 본보기는 친근·캐주얼·대화체 셋에 실린다
    expect(maxMode('friendly')).toContain('선생님이 앞에 앉은 한 사람에게');
    for (const t of ['friendly', 'casual', 'conversational']) {
      expect(maxMode(t)).toContain('리더남 대본에서 뽑은 본보기');
      expect(builder(t)).toContain(LEADERNAM_VOICE_RULES);
    }
    expect(maxMode('professional')).not.toContain('리더남 대본');   // 전문적 말투는 대본 어미를 강요하지 않는다
    expect(VOICE_HABITS.length).toBeGreaterThanOrEqual(8);
    expect(LEADERNAM_VOICE_RULES).toContain('예문을 베끼지는 않습니다');
    const g = read('src/core/final/generation.ts');
    // 본문 생성 프롬프트(generateAllSectionsFinal)에 말투 블록이 있다 — 그동안 절 생성·H3 생성에만 있었다
    const bodyStart = g.indexOf('export async function generateAllSectionsFinal(');
    const bodyEnd = g.indexOf('export async function generateH2SectionFinal(');
    expect(g.slice(bodyStart, bodyEnd)).toContain('${toneInstructionBlock()}');
    // 하드코딩된 해요체 지시가 말투 설정을 따른다
    expect(g.slice(bodyStart, bodyEnd)).not.toContain('- "~해요", "~거든요" 친근하면서도 전문적인 말투\n');
    expect(g.slice(bodyStart, bodyEnd)).not.toContain('- "~입니다", "~합니다" 딱딱한 말투 (→ "~해요", "~거든요"로)\n');
  });

  test('P5 서론 질문·절 닫음이 자가 수정 대상이고, 절은 그 문장으로 찾아진다', () => {
    const closer = (n: number) => `따라서 ${n}번 항목을 한 번에 점검하는 것이 안전해요.`;
    const html = '<h1>주택연금 승계</h1><p>주택연금 가입자가 사망한 뒤 남은 배우자가 연금을 계속 받을 수 있다고 생각했는데 승계가 안 된다는 말을 들으면 걱정되기 마련이에요.</p>'
      + '<p>이 글은 배우자 지정 여부와 채무인수 기한을 나눠 정리해요. 먼저 가입 방식과 배우자 등록 내용을 확인하는 것이 출발점이에요.</p>'
      + [1, 2, 3].map((n) => `<h2>${n}. 절 ${n}</h2><p>${`${n}절 설명 문장이에요. `.repeat(12)}${closer(n)}</p>`).join('')
      + '<h2>자주 묻는 질문 (FAQ)</h2><p>Q</p>';
    const r = inspectBeforePublish({ title: '주택연금 승계', html, question: '배우자 승계가 안 되는 경우' });
    const fixable = r.fixable.filter((f) => /intro-question|section-closer/.test(f.kind));
    expect(fixable.map((f) => f.kind)).toContain('intro-question-missing');
    expect(fixable.filter((f) => f.kind === 'section-closer-checklist')).toHaveLength(3);
    const sections = splitSections(html);
    const idx = fixable.filter((f) => f.kind === 'section-closer-checklist').map((f) => f.sectionIndex);
    expect(new Set(idx).size).toBe(3);                 // 절마다 다른 구간을 가리킨다
    expect(idx.every((i) => i >= 0 && i < sections.length)).toBe(true);
    // 결함이 가장 많은 구간부터 — 상한 1, 절끼리 되풀이가 둘 이상이면 2 (v3.8.678; 이 본보기는 절 본문이 번호만 달라 되풀이로 잡힌다)
    expect(pickSections(r.fixable, sections.length).length).toBeLessThanOrEqual(2);
  });
});
