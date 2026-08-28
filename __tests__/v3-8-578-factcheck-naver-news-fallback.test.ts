/**
 * v3.8.578 — 퍼플렉시티가 죽어도 팩트체크가 살아 있어야 한다
 *
 * ## 실측으로 잡은 사고
 * 사장님 요청("팩트체크는 자동으로")대로 factCheckMode='auto' 로 실제 글을 뽑아 보니
 * 퍼플렉시티 쿼터가 떨어져 있었고(401 exceeded quota), 로그가 이렇게 찍혔다:
 *
 *   [FACT-CHECK] Perplexity 실패 → Naver 폴백
 *   [FACT-CHECK] 📝 팩트체크 건너뜀 (API 연결 불가)     ← 거짓말
 *
 * API 는 멀쩡했다. 폴백이 **블로그**를, 그것도
 *   "해외 항공권 취소 수수료 면제 2026 최신 변경사항 공식"
 * 이라는 말 붙인 쿼리로 찾아 0건이 나왔고, 0건이 "연결 불가"로 뭉뚱그려졌다.
 * 같은 키워드로 뉴스·웹문서를 찾으면 그 순간에도 20건이 있었다.
 *
 * 즉 **있는 근거를 못 쓰고 조용히 넘어갔다.** 무료 팩트체크가 차별점인데
 * 유료 창구가 막히는 순간 통째로 사라지고 있었던 것이다.
 *
 * ## 이 파일이 지키는 것
 *   ① 퍼플렉시티가 죽으면 뉴스·기관 문서로 넘어간다
 *   ② 블로그는 뉴스·기관이 0건일 때만 본다 (틀린 블로그는 틀린 수치를 보증한다)
 *   ③ 진짜로 자료가 없으면 "없다"고 말한다 — "연결 불가"라고 하지 않는다
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.join(__dirname, '..', 'src', 'core', 'perplexityFactCheck.ts');
const src = fs.readFileSync(SRC, 'utf-8');

/** auto 폴백 블록만 잘라 본다 — 파일 전체에서 문자열을 찾으면 주석에도 걸린다 */
function autoFallbackBlock(): string {
  const start = src.indexOf("if (requestedMode === 'auto' && hasNaverKey)");
  expect(start).toBeGreaterThan(-1);
  const end = src.indexOf('팩트체크 건너뜀', start);
  expect(end).toBeGreaterThan(start);
  return src.slice(start, end);
}

describe('① 퍼플렉시티가 막히면 무료 네이버 근거로 넘어간다', () => {
  const block = autoFallbackBlock();

  test('뉴스·기관 문서 수집기를 부른다', () => {
    expect(block).toContain('fetchGrounding');
  });

  test('자격증명을 실어 보낸다 (안 실으면 401 로 조용히 0건이 된다)', () => {
    expect(block).toContain('naverClientId');
    expect(block).toContain('naverClientSecret');
  });

  test('근거를 찾으면 success=true 로 돌려준다', () => {
    expect(block).toMatch(/provider:\s*'Naver News\+Web'/);
    expect(block).toContain('success: true');
  });
});

describe('② 블로그는 마지막 수단이다', () => {
  const block = autoFallbackBlock();

  test('뉴스·기관 수집이 블로그 검색보다 앞에 있다', () => {
    const grounding = block.indexOf('fetchGrounding');
    const blog = block.indexOf('callNaverFactCheck');
    expect(grounding).toBeGreaterThan(-1);
    expect(blog).toBeGreaterThan(-1);
    expect(grounding).toBeLessThan(blog);
  });

  test('블로그 근거는 weak 로 표시한다', () => {
    expect(block).toMatch(/'Naver Blog Search',\s*success:\s*true,\s*trustLevel:\s*'weak'/);
  });
});

describe('③ 없으면 없다고 말한다', () => {
  const block = autoFallbackBlock();

  test('셋 다 0건이면 "자료가 없다"고 찍는다', () => {
    expect(block).toContain('네이버에 이 주제의 자료가 없습니다');
  });

  test('그 경로가 "API 연결 불가" 로 새지 않는다 (블록 안에서 끝낸다)', () => {
    expect(block).toMatch(/return \{ context: '', provider: 'none', success: false/);
  });
});

describe('④ 타입이 실제로 맞는다 (컴파일이 조용히 깨지면 dist 가 낡는다)', () => {
  test("trustLevel 은 union 에 있는 값만 쓴다", () => {
    const declared = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'core', 'final', 'fact-integrity.ts'), 'utf-8',
    );
    const union = /export type FactTrustLevel = ([^;]+);/.exec(declared)?.[1] || '';
    const allowed = [...union.matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    expect(allowed.length).toBeGreaterThan(0);

    const used = [...autoFallbackBlock().matchAll(/trustLevel:\s*'([a-z]+)'/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const level of used) expect(allowed).toContain(level);
  });
});

/**
 * ⑤ CTA 검색어에 업종 낱말을 박지 않는다 (같은 실측에서 나온 두 번째 결함)
 *
 * "해외 항공권 취소 수수료 면제" 글의 검색어가
 *   "… 예매 바로가기 승차권 예약"
 * 로 만들어졌다. 접미어에 '승차권' 이 하드코딩돼 있었기 때문이다.
 * 후보로 코레일 앱·tmoneyGo·부산시 소식이 올라왔다.
 */
describe('⑤ 행동 접미어는 행동만 말한다', () => {
  const { buildActionQuery } = require('../src/cta/action-intent');

  test('항공권 글에 승차권을 붙이지 않는다', () => {
    const q = buildActionQuery('해외 항공권 취소 수수료 면제', '예매');
    expect(q).not.toContain('승차권');
    expect(q).toContain('예매');
  });

  test('철도 글은 키워드가 업종을 들고 있어 그대로 통한다', () => {
    expect(buildActionQuery('코레일 승차권', '예매')).toContain('예매');
  });

  test('어떤 접미어에도 특정 업종 낱말이 없다', () => {
    const 업종어 = ['승차권', '항공권', '기차', '항공', '버스', '영화'];
    for (const intent of ['신청', '예매', '예약', '조회', '발급', '접수', '가입', '납부']) {
      const q = buildActionQuery('테스트주제', intent);
      for (const word of 업종어) expect(q).not.toContain(word);
    }
  });

  test('행동을 못 읽으면 예전 그대로 공식 사이트를 찾는다', () => {
    expect(buildActionQuery('아무 주제', null)).toBe('아무 주제 공식 사이트');
  });
});
