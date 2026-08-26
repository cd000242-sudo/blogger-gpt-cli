/**
 * 결론부터 블록 — 인용해 갈 덩어리를 글 맨 위에 (v3.8.559)
 *
 * 근거(해외 실측):
 *   · AI 답변이 인용한 대목의 55%가 페이지 상단 30%에서 나온다(중간 24%, 하단 21%).
 *   · 인용된 페이지의 53.4%가 1,000단어 미만. 글자수와 인용의 상관은 0.04 — 사실상 없다.
 *
 * 고친 것: 조립 순서가 `상단CTA → 서론 → 요약표` 라서, 인용 가치가 가장 낮은
 *   서론("오늘은 …에 대해 알아보겠습니다")이 가장 좋은 자리를 차지하고 있었다.
 *
 * 비용: AI 호출을 새로 만들지 않는다 — 요약표를 만드는 호출에서 필드 세 개를 더 받는다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildAnswerBlock, sanitizeAnswerText, trimToSentence } from '../src/core/final/answer-block';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

const 좋은답 = '근로장려금은 5월 정기신청 기간에 홈택스나 손택스에서 신청합니다. 가구 유형에 따라 총소득 기준이 다르며 단독가구는 2,200만원 미만입니다. 재산 합계액은 2억 4천만원 미만이어야 합니다.';

describe('① 쓸 만한 답이 있을 때만 만든다', () => {
  it('⭐⭐ 답이 있으면 질문 → 답 → 근거 순서로 나온다', () => {
    const html = buildAnswerBlock({
      keyword: '근로장려금 신청',
      question: '근로장려금 누가 얼마나 받나',
      answer: 좋은답,
      basis: '국세청 · 2026-08 기준',
    });
    expect(html).toContain('answer-first');
    const qIdx = html.indexOf('근로장려금 누가 얼마나 받나');
    const aIdx = html.indexOf('5월 정기신청');
    const bIdx = html.indexOf('국세청');
    expect(qIdx).toBeGreaterThan(-1);
    expect(aIdx).toBeGreaterThan(qIdx);
    expect(bIdx).toBeGreaterThan(aIdx);
  });

  it('⭐⭐ 답이 짧으면 아예 안 만든다 (빈 말이 맨 위에 박히면 안 된다)', () => {
    expect(buildAnswerBlock({ keyword: '근로장려금', answer: '네, 가능합니다.' })).toBe('');
    expect(buildAnswerBlock({ keyword: '근로장려금', answer: '' })).toBe('');
    expect(buildAnswerBlock({ keyword: '근로장려금' })).toBe('');
  });

  it('⭐ 본문에 답이 없어 AI 가 빈 값을 주면 예전 순서 그대로 간다', () => {
    expect(buildAnswerBlock({ keyword: '근로장려금', answer: undefined, question: '질문은 있음' })).toBe('');
  });

  it('질문이 없으면 키워드로 만든다', () => {
    const html = buildAnswerBlock({ keyword: '근로장려금 신청', answer: 좋은답 });
    expect(html).toContain('근로장려금 신청, 결론부터');
  });

  it('근거가 없으면 근거 줄을 넣지 않는다 (빈 "근거:" 금지)', () => {
    const html = buildAnswerBlock({ keyword: '근로장려금', answer: 좋은답 });
    expect(html).not.toContain('근거:');
    expect(html).not.toContain('answer-first-basis');
  });
});

describe('② 넣기 전에 씻는다', () => {
  it('⭐ HTML 태그를 벗긴다 (AI 가 태그를 넣어 오는 일이 있다)', () => {
    const html = buildAnswerBlock({
      keyword: '근로장려금',
      answer: `<div class="x">${좋은답}</div>`,
    });
    expect(html).not.toContain('<div class="x">');
    expect(html).toContain('5월 정기신청');
  });

  it('⭐⭐ script 는 내용까지 지운다', () => {
    const html = buildAnswerBlock({
      keyword: '근로장려금',
      answer: `<script>alert(1)</script>${좋은답}`,
    });
    expect(html).not.toContain('alert(1)');
    expect(html).not.toContain('<script');
  });

  it('⭐ 꺾쇠와 따옴표를 이스케이프한다', () => {
    const html = buildAnswerBlock({
      keyword: '근로장려금',
      answer: `${좋은답} 조건은 "소득 < 2200만원" 입니다.`,
    });
    expect(html).toContain('&quot;');
    expect(html).toContain('&lt;');
  });

  it('한자를 제거한다 (프로젝트 공통 규칙)', () => {
    expect(sanitizeAnswerText('근로장려금 申請 방법', 100)).toBe('근로장려금 방법');
  });

  it('⭐ 길면 문장 경계에서 자른다 (글자 수로만 자르면 말이 끊긴다)', () => {
    const long = '가나다라마바사아자차카타파하 신청할 수 있습니다. 두 번째 문장이 여기서 이어집니다. 세 번째 문장입니다.';
    const cut = trimToSentence(long, 40);
    expect(cut.length).toBeLessThanOrEqual(42);
    expect(cut.endsWith('.')).toBe(true);
  });

  it('자를 곳이 마땅치 않으면 그냥 자른다 (무한정 늘어나지 않게)', () => {
    const noStop = '가'.repeat(200);
    expect(trimToSentence(noStop, 50).length).toBeLessThanOrEqual(50);
  });
});

describe('③ 발행 경로에 실제로 걸려 있다', () => {
  const orchestration = read('src/core/final/orchestration.ts');
  const generation = read('src/core/final/generation.ts');
  const wpPublisher = read('src/wordpress/wordpress-publisher.ts');

  it('⭐⭐ orchestration 이 결론 블록을 만든다', () => {
    expect(orchestration).toContain("from './answer-block'");
    expect(orchestration).toContain('const answerBlockHtml = buildAnswerBlock({');
  });

  it('⭐⭐ 결론 블록이 서론보다 앞이다 (이 순서가 이 릴리스의 전부다)', () => {
    expect(orchestration).toContain('topCtaHtml + answerBlockHtml + formattedIntro + topSummaryHtml');
    // 같은 플레이스홀더를 쓰는 replace 가 두 곳이라(이미지 안내문 주입) 조립하는 줄만 고른다
    const line = orchestration.split('\n').find((l) => l.includes('answerBlockHtml + formattedIntro'))!;
    expect(line).toBeDefined();
    expect(line.indexOf('answerBlockHtml')).toBeLessThan(line.indexOf('formattedIntro'));
    expect(line.indexOf('answerBlockHtml')).toBeLessThan(line.indexOf('topSummaryHtml'));
  });

  it('⭐⭐ 요약표 호출에서 재료를 함께 받아 온다 (AI 호출을 늘리지 않는다)', () => {
    const start = generation.indexOf('export async function generateSummaryTableFinal');
    const end = generation.indexOf('export async function generateHashtagsFinal');
    const block = generation.slice(start, end);
    expect(block).toContain('"question"');
    expect(block).toContain('"answer"');
    expect(block).toContain('"basis"');
    // 호출은 한 번뿐이어야 한다
    expect((block.match(/await callGeminiWithRetry\(/g) || []).length).toBe(1);
  });

  it('⭐ 받아온 세 필드도 태그·한자를 벗긴다', () => {
    expect(generation).toContain("for (const field of ['question', 'answer', 'basis'] as const)");
  });

  it('⭐⭐ 워드프레스는 style 속성을 지우므로 클래스 CSS 가 있어야 한다', () => {
    // 이걸 빼먹으면 WP 에서만 색·여백 없는 맨 문단으로 나간다 (v3.8.437·448 에서 두 번 겪은 함정)
    expect(wpPublisher).toContain('.wp-styled-content .answer-first {');
    expect(wpPublisher).toContain('.wp-styled-content .answer-first-a {');
  });

  it('⭐ 답이 없으면 예전 순서 그대로 나간다 (빈 문자열이 껴도 HTML 이 안 깨진다)', () => {
    expect(buildAnswerBlock({ keyword: 'x', answer: '' })).toBe('');
  });
});
