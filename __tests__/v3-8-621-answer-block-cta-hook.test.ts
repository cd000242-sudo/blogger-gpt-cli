/**
 * v3.8.621 — 사장님 실물 검수 3건
 *
 *   ① 답변블록(요약 박스) 안 문장들이 한 문단으로 뭉쳐 나갔다
 *   ② CTA 훅에 글 제목이 그대로 들어갔다 (차단기는 있는데 안 걸림)
 *   ③ 진한 배경 CTA 에서 훅 글씨가 묻혔다
 */

import fs from 'fs';
import path from 'path';
import { normalizeParagraphs } from '../src/core/final/paragraph-normalizer';
import { hookEchoesTitle } from '../src/cta/cta-copy';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

describe('① 답변블록은 합치지 않는다', () => {
  /** buildAnswerBlock 이 실제로 내는 꼴 — 답변은 한 문단에 세 문장이다 */
  const block = [
    '<section class="answer-first">',
    '<p class="answer-first-q bgpt-s2">소상공인 무료 보험 대상과 조건</p>',
    '<p class="answer-first-a bgpt-s2">대상은 경남 경북 광주 전남 전북 제주 충북의 지역 소상공인입니다. 지역별 운영 상품과 대상 조건이 다릅니다. 사업장이 대상 지역 밖이면 대상 범위에 들어가지 않습니다.</p>',
    '<p class="answer-first-basis bgpt-s2">근거: 금융위원회 2026년 9월 1일 기준</p>',
    '</section>',
  ].join('');

  it('문단을 하나도 합치지 않는다', () => {
    expect(normalizeParagraphs(block).merged).toBe(0);
  });

  it('질문 라벨이 답변에 붙지 않는다 — 이게 실사고였다', () => {
    const html = normalizeParagraphs(block).html;
    expect(html).toMatch(/class="answer-first-q[^"]*">소상공인 무료 보험 대상과 조건<\/p>/);
    expect(html).not.toMatch(/대상과 조건[^<]*대상은 경남/);
  });

  it('답변 세 문장은 줄이 나뉜다 — 훑어보는 자리다', () => {
    const html = normalizeParagraphs(block).html;
    const answer = (html.match(/<p class="answer-first-a[\s\S]*?<\/p>/) || [])[0] || '';
    expect((answer.match(/<br>/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it('근거 줄도 제 문단으로 남는다', () => {
    expect(normalizeParagraphs(block).html).toMatch(/class="answer-first-basis[^"]*">근거:/);
  });

  it('답변블록이 아닌 짧은 문단은 예전처럼 합친다', () => {
    const plain = '<p>짧은 문단입니다.</p><p>주담대 한도는 연소득에 DSR 비율을 적용한 뒤 기존 대출 원리금을 빼고 계산합니다.</p>';
    expect(normalizeParagraphs(plain).merged).toBeGreaterThan(0);
  });
});

describe('② CTA 훅에 제목이 들어가면 갈아끼운다', () => {
  const TITLE = '9월 1일 시작된 무료 상생보험, 7개 지역 아니면 대상이 아닙니다';
  const HOOK = `${TITLE} — 금융위원회에서 바로 신청할 수 있습니다.`;

  it('차단기는 이 훅을 잡는다', () => {
    expect(hookEchoesTitle(HOOK, TITLE)).toBe(true);
  });

  it('섹션 CTA 도 관문을 통과한다 — 이 경로가 비켜 가고 있었다', () => {
    const src = read('src/core/final/orchestration.ts');
    expect(src).toContain('const sectionCandidate = toRenderableCtaCandidate(');
    expect(src).toContain('hook: sectionCandidate.hookingMessage');
    expect(src).not.toContain('hook: sectionCta.hookingMessage,');
  });

  it('키워드가 아니라 글 제목으로 대조한다', () => {
    const src = read('src/core/final/orchestration.ts');
    // 훅은 h1 을 되풀이한다. 키워드로만 대조하면 못 잡는다
    expect((src.match(/h1 \|\| keyword,?\)?/g) || []).length).toBeGreaterThanOrEqual(3);
  });
});

describe('③ 훅은 배경이 무엇이든 읽힌다', () => {
  const src = read('src/core/final/orchestration.ts');

  it('훅에 자기 바탕이 있다 — 형광펜처럼', () => {
    expect(src).toMatch(/FINAL_CTA_HOOK_STYLE[\s\S]{0,400}background:var\(--rv-cta-hook-bg/);
  });

  it('색을 박아 두지 않고 스킨이 바꿀 수 있게 둔다', () => {
    expect(src).toMatch(/FINAL_CTA_HOOK_STYLE[\s\S]{0,400}color:var\(--rv-cta-hook,/);
    expect(src).not.toMatch(/FINAL_CTA_HOOK_STYLE = '[^']*color:#0f172a !important/);
  });

  it('여러 줄로 넘어가도 바탕이 이어진다', () => {
    expect(src).toMatch(/FINAL_CTA_HOOK_STYLE[\s\S]{0,500}box-decoration-break:clone/);
  });
});

describe('④ 에이전트 모드에도 문단 정리가 붙어 있다', () => {
  /**
   * 사장님: "에이전트 모드로 했을 때도 마찬가지야"
   *
   * normalizeParagraphs 는 orchestration 한 곳에서만 돌고 있었다.
   * 에이전트는 그 경로를 안 타므로(스킨도 같은 이유로 따로 붙였다) 문단이 정리되지 않았다.
   */
  const main = read('electron/main.ts');

  it('에이전트 경로가 문단 정리를 부른다', () => {
    expect(main).toContain('[AGENT-PARA]');
    expect(main).toMatch(/require\('\.\.\/dist\/core\/final\/paragraph-normalizer'\)/);
  });

  it('스킨보다 먼저 돌린다 — 감싼 뒤에 손대면 구조가 흔들린다', () => {
    const paraAt = main.indexOf('[AGENT-PARA]');
    const skinAt = main.indexOf('applyOrbitSkinToAgentHtml');
    expect(paraAt).toBeGreaterThan(0);
    expect(paraAt).toBeLessThan(skinAt);
  });

  it('실패해도 발행을 막지 않는다', () => {
    const block = main.slice(main.indexOf('[AGENT-PARA]') - 900, main.indexOf('[AGENT-PARA]') + 900);
    expect(block).toContain('catch');
  });
});
