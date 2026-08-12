/**
 * v3.8.491 — CTA 추론을 "기억"이 아니라 "확인된 자료"에서 하게 한다
 *
 * 사장님: "글 CTA는 추론해서 가져오게할수는없니?"
 *
 * ## 이미 추론하고 있었다 — 문제는 두 가지였다
 *
 * ① **1순위 경로에 도메인 검증이 없었다.**
 *    v3.8.490 에서 넣은 judgeCtaHost 는 CSE 폴백에만 걸려 있고,
 *    실제 1순위인 AI 추론 결과에는 안 걸렸다. 거기는 "검색엔진·블로그인가" 와
 *    "살아있는가" 만 봤다. 그래서 낯선 도메인도 살아있기만 하면 통과했다.
 *    (postmate.waffle-gl.org 사고가 이 경로로 나왔을 가능성이 크다.)
 *
 * ② **모델이 기억으로 주소를 짐작했다.**
 *    프롬프트에 실제 자료를 안 줬다. 그래서 옛 주소(letskorail.com)나 없는 주소가 나온다.
 *    그런데 글 쓸 때 이미 이 키워드의 기관 페이지를 수집한다(collectOfficialSources) —
 *    기관명·주소·실제 문장까지 있다. 그걸 주면 **확인된 주소 중에서** 고른다. 비용 0원.
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildOfficialCtaCandidates } from '../src/cta/inference-candidates';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const generation = read('src/core/final/generation.ts');
const orchestration = read('src/core/final/orchestration.ts');

const SOURCES = [
  { agency: '한국철도공사', url: 'https://www.korail.com/ticket/main', sentences: ['승차권 예매는 …'] },
  { agency: '국토교통부', url: 'https://www.molit.go.kr/notice/1', sentences: ['추석 특별교통대책 …'] },
];

describe('① 확인된 기관 주소를 추론 재료로 만든다', () => {
  it('⭐⭐ 기관명과 주소를 함께 준다 (주소만 주면 뭔지 모르고 고른다)', () => {
    const block = buildOfficialCtaCandidates(SOURCES);
    expect(block).toContain('한국철도공사');
    expect(block).toContain('https://www.korail.com/ticket/main');
  });

  it('⭐⭐ 이 목록에서 고르라고 명시한다 (안 그러면 또 기억으로 짐작한다)', () => {
    expect(buildOfficialCtaCandidates(SOURCES)).toContain('이 목록에서');
  });

  it('⭐⭐ 재료가 없으면 빈 문자열 (없는 목록을 지어내지 않는다)', () => {
    expect(buildOfficialCtaCandidates([])).toBe('');
    expect(buildOfficialCtaCandidates(null as any)).toBe('');
  });

  it('⭐ 주소가 깨진 항목은 뺀다', () => {
    const block = buildOfficialCtaCandidates([
      { agency: 'A', url: '주소아님', sentences: [] },
      { agency: 'B', url: 'https://b.go.kr', sentences: [] },
    ] as any);
    expect(block).toContain('https://b.go.kr');
    expect(block).not.toContain('주소아님');
  });

  it('⭐ 너무 많이 주지 않는다 (프롬프트가 길어지면 다른 규칙이 밀린다)', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      agency: `기관${i}`, url: `https://a${i}.go.kr`, sentences: [],
    }));
    const block = buildOfficialCtaCandidates(many as any);
    expect((block.match(/https:\/\//g) || []).length).toBeLessThanOrEqual(8);
  });
});

describe('② AI 추론 결과에도 도메인 검증을 건다', () => {
  it('⭐⭐ 1순위 경로가 judgeCtaHost 를 통과시킨다 (여기가 비어 있던 구멍이다)', () => {
    const idx = generation.indexOf('Search Grounding CTA 하이브리드 검증 통과');
    expect(idx).toBeGreaterThan(-1);
    const before = generation.slice(generation.indexOf('const ctaResponse = await callGeminiWithRetry'), idx);
    expect(before).toContain('judgeCtaHost(');
  });

  it('⭐⭐ 거절하면 사유를 남긴다 (조용히 빠지면 원인을 못 찾는다)', () => {
    const idx = generation.indexOf('const ctaResponse = await callGeminiWithRetry');
    const block = generation.slice(idx, generation.indexOf('폴백: Google CSE', idx));
    expect(block).toContain('describeHostVerdict(');
  });
});

describe('③ 낡은 예시 주소를 고쳤다', () => {
  it('⭐⭐ 프롬프트가 옛 코레일 주소를 예시로 보여주지 않는다', () => {
    // letskorail.com 은 korail.com 으로 리다이렉트된다(실측). 예시가 낡으면 모델이 그걸 쓴다.
    const promptArea = generation.slice(
      generation.indexOf('✅ 좋은 CTA 예시'),
      generation.indexOf('📋 아래 JSON 형식'),
    );
    expect(promptArea).not.toContain('letskorail.com');
    expect(promptArea).toContain('korail.com');
  });
});

describe('④ 배선', () => {
  it('⭐⭐ 수집한 기관 근거가 CTA 생성으로 넘어간다 (안 넘기면 또 기억으로 짐작한다)', () => {
    expect(orchestration).toContain('officialSources');
    const call = orchestration.slice(
      orchestration.indexOf('generateCTAsFinal('),
      orchestration.indexOf('generateCTAsFinal(') + 200,
    );
    expect(call).toContain('officialSources');
  });

  it('⭐⭐ 수집 결과를 버리지 않고 보관한다', () => {
    expect(orchestration).toContain('let officialSources');
  });
});
