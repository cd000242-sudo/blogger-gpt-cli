/**
 * v3.8.490 — 낯선 도메인이 CTA 로 나가던 사고
 *
 * 사장님 보고:
 *   "https://www.korail.com/tour/train/search 이걸로 CTA가 엮여야되는데
 *    https://postmate.waffle-gl.org/link/naver/erica2600 왜이걸로 엮이나요..?"
 *
 * ## 원인
 * 예전 규칙은 **제외 목록에만 없으면 통과**였다.
 *   제외: blog.naver.com, tistory.com, namu.wiki, youtube.com …
 * 검색 결과에 섞여 든 집계·스팸 도메인이 200 만 돌려주면 그대로 실렸다.
 * 게다가 신뢰 목록이 `.go.kr/.or.kr/...` 뿐이라 **korail.com 같은 진짜 공식 사이트가
 * 오히려 우선순위를 못 받았다.** 그래서 스팸이 먼저 뽑혔다.
 *
 * ## 바꾼 원칙
 * "막을 것을 고르는" 방식 → **"통과시킬 것을 고르는"** 방식.
 * 근거를 못 대면 CTA 를 넣지 않는다. 남의 링크를 사장님 글에 싣는 것보다 낫다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { judgeCtaHost, describeHostVerdict } from '../src/cta/host-trust';

const generation = fs.readFileSync(
  path.join(__dirname, '..', 'src/core/final/generation.ts'), 'utf-8',
);

describe('① 사장님이 겪은 그 사고', () => {
  it('⭐⭐ postmate.waffle-gl.org 를 거절한다', () => {
    const r = judgeCtaHost('https://postmate.waffle-gl.org/link/naver/erica2600', '코레일 예매');
    expect(r.ok).toBe(false);
    expect(describeHostVerdict(r)).toContain('제외');
  });

  it('⭐⭐ korail.com 은 통과한다 (카탈로그에 있는 공식 사이트)', () => {
    expect(judgeCtaHost('https://www.korail.com/tour/train/search', '코레일 예매').ok).toBe(true);
  });
});

describe('② 통과 근거가 분명한 것만 받는다', () => {
  it('⭐⭐ 등록된 공식 사이트', () => {
    const r = judgeCtaHost('https://www.gov.kr/portal/main', '등본 발급');
    expect(r.ok).toBe(true);
  });

  it('⭐⭐ 하위 도메인도 같은 기관으로 본다', () => {
    expect(judgeCtaHost('https://ticket.korail.com/a', 'KTX 예매').ok).toBe(true);
  });

  it('⭐⭐ 공공·기관 도메인은 카탈로그에 없어도 받는다', () => {
    expect(judgeCtaHost('https://www.work24.go.kr/실업급여', '실업급여').reason).toBe('institutional');
    expect(judgeCtaHost('https://example.or.kr/a', '연금').ok).toBe(true);
  });

  it('⭐⭐ 키워드에 드러난 영문 브랜드와 도메인이 맞으면 받는다', () => {
    expect(judgeCtaHost('https://etk.srail.kr/main.do', 'SRT 예매').ok).toBe(true);
  });

  it('⭐⭐ 두 글자 이하 토큰으로는 통과시키지 않는다 (우연히 맞을 수 있다)', () => {
    expect(judgeCtaHost('https://ab-random.com/x', 'AB 카드').ok).toBe(false);
  });
});

describe('③ 확실히 막아야 하는 것', () => {
  it('⭐⭐ 근거 없는 낯선 도메인은 거절한다 (이게 이번 사고의 핵심)', () => {
    expect(judgeCtaHost('https://random-blog-aggregator.xyz/post/1', '실업급여').reason).toBe('unknown-host');
  });

  it('⭐⭐ 링크 단축·중계 주소를 거절한다 (최종 목적지를 감춘다)', () => {
    expect(judgeCtaHost('https://bit.ly/abc', '코레일').reason).toBe('redirector');
    expect(judgeCtaHost('https://linktr.ee/someone', '코레일').reason).toBe('redirector');
  });

  it('⭐⭐ /link/ 경로처럼 중계 티가 나는 주소도 거절한다', () => {
    expect(judgeCtaHost('https://unknown.example/link/naver/abc', '코레일').reason).toBe('redirector');
  });

  it('⭐ 주소가 깨져도 던지지 않는다', () => {
    expect(judgeCtaHost('그냥 글자', '코레일').ok).toBe(false);
    expect(judgeCtaHost('', '').ok).toBe(false);
  });
});

describe('④ 발행 경로에 배선돼 있다', () => {
  it('⭐⭐ 검색 결과를 그대로 믿지 않는다', () => {
    expect(generation).toContain('judgeCtaHost(');
  });

  it('⭐⭐ 제외 목록만으로 통과시키던 옛 규칙이 남아 있지 않다', () => {
    const code = generation.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
    // "제외 도메인이 아니면 첫 결과 사용" 이 이번 사고의 원인이었다
    expect(code).not.toContain('대체 사이트 발견 (최상위 결과)');
  });

  it('⭐⭐ 거절 사유를 로그로 남긴다 (조용히 빠지면 원인을 못 찾는다)', () => {
    expect(generation).toContain('describeHostVerdict(');
  });
});
