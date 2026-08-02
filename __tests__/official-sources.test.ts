/**
 * 공공기관 출처 수집 테스트 (v3.8.389)
 *
 * 배경 (실측 2026-07-30): 실속 규칙(v3.8.385) 적용 전후 발행글 비교
 *   두루뭉실 표현  0.60 → 0.28 /1000자   -52.8%  ✅
 *   구체 수치      0.59 → 0.75           +26.2%
 *   기관 출처      1.36 → 1.41           +3.5%   ← 사실상 변화 없음
 *
 * 기관 출처만 안 늘었다. 원인은 프롬프트가 약해서가 아니라 크롤링 소스가
 * 티스토리·워드프레스·뉴스·카페·RSS 뿐이어서 자료에 기관 근거가 아예 없었기 때문이다.
 * 같은 규칙 파일의 규칙 6이 "확인 못한 숫자는 지어내지 말라"고 하므로
 * 모델이 안 쓴 것은 규칙을 지킨 결과다. 그래서 압박 대신 근거를 찾아서 준다.
 *
 * 이 테스트가 지키는 것:
 *   1) 오염 차단 — 1차 실측에서 PDF 본문이 깨진 문자로 들어왔다.
 *      그런 걸 프롬프트에 넣으면 이전 "중국어" 사고와 같은 오염이 된다.
 *   2) 없으면 아무것도 추가하지 않는다 — 악화 없음, 발행도 막지 않는다.
 *   3) 출처 표기가 부정확해지지 않게, 매핑에 없는 도메인은 채택하지 않는다.
 */
import {
  resolveAgency,
  extractNumericSentences,
  mergeByAgency,
  buildOfficialSourceBlock,
  collectOfficialSources,
} from '../src/core/final/official-sources';
import { braceBlock } from './helpers/source-block';

describe('기관명 판정 — 매핑에 없으면 채택하지 않는다', () => {
  it('공공 도메인을 기관명으로 바꾼다', () => {
    expect(resolveAgency('https://www.easylaw.go.kr/CSP/x.laf')).toBe('찾기쉬운 생활법령정보');
    expect(resolveAgency('https://www.nhis.or.kr/a.do')).toBe('국민건강보험공단');
    expect(resolveAgency('https://www.bokjiro.go.kr/x')).toBe('복지로');
  });

  it('모바일(m.)·www 접두어를 모두 처리한다', () => {
    expect(resolveAgency('https://m.easylaw.go.kr/MOB/y.laf')).toBe('찾기쉬운 생활법령정보');
  });

  it('서브도메인도 같은 기관으로 본다', () => {
    expect(resolveAgency('https://minwon.nhis.or.kr/a')).toBe('국민건강보험공단');
  });

  it('블로그·상용 도메인은 빈 문자열 — 기관 출처로 쓰면 거짓이 된다', () => {
    expect(resolveAgency('https://blog.naver.com/x')).toBe('');
    expect(resolveAgency('https://tistory.com/x')).toBe('');
    expect(resolveAgency('https://example.com')).toBe('');
  });

  it('깨진 URL 에 안전하다', () => {
    expect(resolveAgency('not a url')).toBe('');
    expect(resolveAgency('')).toBe('');
  });
});

describe('문장 추출 — 오염을 프롬프트에 넣지 않는다', () => {
  it('바이너리 쓰레기는 전부 버린다 (PDF 본문 실측 사례)', () => {
    const binary = '���3��O�g�W 100원 ����'.repeat(20);
    expect(extractNumericSentences(binary)).toEqual([]);
  });

  it('한글 비율이 낮은 영문 문서는 버린다', () => {
    const english = 'The applicant must submit within 90 days of the notice. '.repeat(10);
    expect(extractNumericSentences(english)).toEqual([]);
  });

  it('네비게이션·UI 텍스트는 버린다', () => {
    const nav = '인쇄 체크 보증금의 증액 1년 이내에는 증액청구를 할 수 없습니다 메뉴 바로가기';
    expect(extractNumericSentences(nav)).toEqual([]);
  });

  it('"제목 | 사이트명" 형태의 껍데기는 버린다', () => {
    const shell = '부동산/임대차 보증금 증액 청구 | 찾기쉬운 생활법령정보 보증금 1억원 월세 100만원입니다.';
    expect(extractNumericSentences(shell)).toEqual([]);
  });

  it('HTML 속성 잔재를 잘라내고 내용은 살린다 (실측 사례)', () => {
    const dirty = '어떻게 해야 하나요?"> 보증금 1억원, 월세 100만원에 상가건물을 임차하던 중 8개월째에 건물주가 올려달라 합니다.';
    const got = extractNumericSentences(dirty);
    expect(got).toHaveLength(1);
    expect(got[0]).toMatch(/^보증금 1억원/);
    expect(got[0]).not.toContain('">');
  });

  it('수치가 없는 문장은 제외한다', () => {
    const mixed = '증액이 있은 후 1년 이내에는 증액청구를 할 수 없습니다. 이것은 수치가 전혀 없는 설명 문장입니다.';
    const got = extractNumericSentences(mixed);
    expect(got).toHaveLength(1);
    expect(got[0]).toContain('1년');
  });

  it('법조문 인용을 수치로 인정한다 — GEO 근거의 핵심이다', () => {
    const law = '증액청구를 할 수 없습니다( 「주택임대차보호법」 제7조 제1항 후단).';
    expect(extractNumericSentences(law)).toHaveLength(1);
  });

  it('중복 문장을 한 번만 담는다', () => {
    const dup = '증액이 있은 후 1년 이내에는 증액청구를 할 수 없습니다. 증액이 있은 후 1년 이내에는 증액청구를 할 수 없습니다.';
    expect(extractNumericSentences(dup)).toHaveLength(1);
  });

  it('너무 짧거나 너무 긴 조각은 버린다', () => {
    expect(extractNumericSentences('1년 이내.')).toEqual([]);
    expect(extractNumericSentences('가'.repeat(300) + ' 100원입니다.')).toEqual([]);
  });

  it('빈 입력에 안전하다', () => {
    expect(extractNumericSentences('')).toEqual([]);
    expect(extractNumericSentences(undefined as any)).toEqual([]);
  });
});

describe('기관 병합 — 같은 기관이 여러 번 표기되지 않는다', () => {
  const mk = (agency: string, sentences: string[]) => ({ agency, url: 'https://x.go.kr', sentences });

  it('같은 기관을 하나로 합친다 (실측: 같은 기관이 3번 표기됐다)', () => {
    const merged = mergeByAgency([
      mk('찾기쉬운 생활법령정보', ['가 100원입니다.']),
      mk('찾기쉬운 생활법령정보', ['나 200원입니다.']),
      mk('국민건강보험공단', ['다 90일입니다.']),
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.find(m => m.agency === '찾기쉬운 생활법령정보')?.sentences).toHaveLength(2);
  });

  it('병합 과정에서 중복 문장을 제거한다', () => {
    const merged = mergeByAgency([
      mk('복지로', ['같은 문장 100원입니다.']),
      mk('복지로', ['같은  문장 100원입니다.']),
    ]);
    expect(merged[0]?.sentences).toHaveLength(1);
  });

  it('기관당 문장 수에 상한이 있다 — 프롬프트를 잠식하면 안 된다', () => {
    const many = Array.from({ length: 20 }, (_, i) => `문장 ${i} 는 ${i}00원입니다.`);
    const merged = mergeByAgency([mk('복지로', many)], 6);
    expect(merged[0]?.sentences).toHaveLength(6);
  });

  it('문장이 없는 항목은 버린다', () => {
    expect(mergeByAgency([mk('복지로', [])])).toEqual([]);
  });
});

describe('프롬프트 블록', () => {
  const sources = [{ agency: '찾기쉬운 생활법령정보', url: 'https://easylaw.go.kr/x', sentences: ['증액은 1년 이내 청구할 수 없습니다( 「주택임대차보호법」 제7조).'] }];

  it('기관명과 근거 문장을 담는다', () => {
    const block = buildOfficialSourceBlock(sources);
    expect(block).toContain('찾기쉬운 생활법령정보');
    expect(block).toContain('주택임대차보호법');
    expect(block).toContain('공공기관 확인 근거');
  });

  // v3.8.391: 사용자 결정 — "출처가 굳이 본문에 들어갈 필요가 없다".
  //   수집은 유지하고(정확한 숫자를 주는 게 목적) 본문 출처 표기만 금지한다.
  it('수집한 숫자를 본문에 그대로 쓰라고 지시한다', () => {
    expect(buildOfficialSourceBlock(sources)).toContain('본문에 그대로');
  });

  it('괄호 출처 표기를 금지한다 — 독자는 이 블록을 모른다', () => {
    const block = buildOfficialSourceBlock(sources);
    expect(block).toContain('출처 표기는 본문에 넣지 마세요');
    expect(block).toContain('공식 자료에 따르면');   // 금지 예시로 등장
  });

  it('법령 이름은 문장에 녹이도록 허용한다 — 그건 출처가 아니라 정보다', () => {
    expect(buildOfficialSourceBlock(sources)).toContain('법령·제도의 이름 자체는 정보');
  });

  it('근거에 없는 숫자를 지어내지 말라고 못박는다 — 규칙 6과 충돌하면 안 된다', () => {
    expect(buildOfficialSourceBlock(sources)).toContain('근거에 없는 숫자는');
  });

  it('길이 상한을 지킨다 — 블로그 크롤 자료를 밀어내면 안 된다', () => {
    const huge = [{
      agency: '복지로',
      url: 'https://bokjiro.go.kr',
      sentences: Array.from({ length: 60 }, (_, i) => `문장 ${i} 는 ${i}00원이고 90일 이내입니다.`),
    }];
    expect(buildOfficialSourceBlock(huge, 800).length).toBeLessThanOrEqual(810);
  });

  it('확보한 게 없으면 빈 문자열 — 아무것도 추가하지 않는다', () => {
    expect(buildOfficialSourceBlock([])).toBe('');
    expect(buildOfficialSourceBlock(undefined as any)).toBe('');
  });
});

describe('수집 — 실패가 발행을 막지 않는다', () => {
  it('CSE 키가 없으면 조용히 건너뛴다', async () => {
    await expect(collectOfficialSources('테스트', '', '')).resolves.toEqual([]);
  });

  it('키워드가 비면 조용히 건너뛴다', async () => {
    await expect(collectOfficialSources('', 'k', 'c')).resolves.toEqual([]);
  });

  it('검색이 실패해도 예외를 던지지 않는다', async () => {
    const original = global.fetch;
    global.fetch = (() => Promise.reject(new Error('네트워크 끊김'))) as any;
    try {
      await expect(collectOfficialSources('키워드', 'k', 'c')).resolves.toEqual([]);
    } finally {
      global.fetch = original;
    }
  });
});

describe('orchestration 배선', () => {
  const orch = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf8');

  it('공공출처 블록을 fact 근거보다 앞에 넣는다 — 12,000자 컷에서 살아남아야 한다', () => {
    const i = orch.indexOf('factEnrichedContents = [');
    expect(i).toBeGreaterThan(-1);
    const block = braceBlock(orch, 'factEnrichedContents = [');
    expect(block).toContain('officialBlock');
    // buildFactIntegrityPrompt 다음, FACT EVIDENCE 앞
    expect(block.indexOf('officialBlock')).toBeLessThan(block.indexOf('FACT EVIDENCE'));
  });

  it('수집 실패가 발행을 막지 않는다', () => {
    // v3.8.403: 고정 길이(900자) 슬라이스는 주석 몇 줄만 늘어도 깨진다 — catch 위치로 경계를 잡는다
    const i = orch.indexOf("let officialBlock = ''");
    expect(i).toBeGreaterThan(-1);
    const end = orch.indexOf('catch (officialErr', i);
    expect(end).toBeGreaterThan(i);
    expect(orch.slice(i, end)).toContain('try {');
  });

  it('CSE 키가 있을 때만 호출한다 — 없는 키로 헛호출하지 않는다', () => {
    expect(orch).toContain('cseKey && cseCx');
  });

  /**
   * v3.8.403 — 사용자 지적(2026-08-02):
   *   "네이버 크롤링이랑 공공기관 수집은 쇼핑모드에서 왜 하는 건데?"
   *   맞는 지적이다. 상품 글의 근거는 상품 스펙과 구매자 후기지 통계청이 아니다.
   *   "통계청 자료에 따르면 물놀이 튜브는…" 은 어색하고 신뢰를 깎는다. CSE 호출도 아낀다.
   */
  it('⭐ 쇼핑모드에서는 공공기관 근거를 모으지 않는다', () => {
    expect(orch).toContain("cseKey && cseCx && contentMode !== 'shopping'");
  });

  it('쇼핑 외 모드는 그대로 수집한다 (할루시네이션 차단 유지)', () => {
    expect(orch).toContain('collectOfficialSources(keyword, cseKey, cseCx, onLog)');
  });
});
