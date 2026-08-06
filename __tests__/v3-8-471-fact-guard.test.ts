/**
 * v3.8.471 — 발행 전에 AI가 자기 글의 수치를 검증하고 고친다
 *
 * 사장님: "한번읽고 손볼꺼면 자동화툴을 왜쓰는거니 ai로 돌리고 수정해서 올리는게낫지"
 *
 * ## 왜 수치인가
 * 지어낸 금액·마감일·통계는 두 가지를 동시에 무너뜨린다.
 *   · 독자 신뢰 — "월 최대 50만원" 이 틀리면 그 글 전체가 거짓말이 된다
 *   · 애드센스 Misrepresentative content — 사실과 다른 서술은 정책 위반이다
 * 반대로 문장이 조금 밋밋한 건 정책 위반이 아니다. 그래서 수치부터 잡는다.
 *
 * ## 비용을 아끼는 구조
 * 1차 "어디가 문제냐" 를 AI 에게 묻지 않는다 — **코드가 먼저 찾는다.**
 * 자료에 없는 수치를 정규식으로 뽑아내고, 걸린 게 있을 때만 AI 를 부른다.
 * 수치가 전부 근거 있으면 **API 호출이 0회**다.
 *
 * ## 절대 막지 않는다
 * 사장님이 못 박은 규칙: "검수 때문에 글이 통과가 안 되서 발행이 안 되면 절대 안 된다"
 * 그래서 이 모듈은 실패하면 조용히 원본을 돌려준다. 던지지 않는다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { findUngroundedFacts, applyFactRepairs, guardFacts, buildGroundingReference } from '../src/core/final/fact-guard';
import { sanitizeFactUnsafeHtml } from '../src/core/final/fact-integrity';

const orchestration = fs.readFileSync(
  path.join(__dirname, '..', 'src/core/final/orchestration.ts'), 'utf-8',
);

/**
 * ⓪ 진짜 사고 — 검증 기준이 작성 기준보다 좁아서 본문이 삭제되고 있었다
 *
 * 기존 fact-integrity 는 근거 없는 문장을 **지운다**(고치지 않는다).
 * 그런데 근거 장부가 팩트체크 요약문뿐이라, 크롤링 본문에서 정확히 옮긴 수치도
 * 요약문에 없으면 삭제됐다. 실측으로 62자 문단이 24자가 됐다.
 * 이게 "글이 두루뭉실하다" 의 원인이었다 — 모델이 아니라 후처리 탓이다.
 */
describe('⓪ 근거 장부를 작성 기준과 맞춘다', () => {
  const NONE = { context: '', provider: 'none' as any, trustLevel: 'none' as any, topic: '청년내일저축계좌' };
  const PARA = '<p>지원금은 월 최대 30만원입니다. 신청은 온라인으로 하면 됩니다. 소득 기준은 100% 이하입니다.</p>';

  it('⭐⭐ 근거가 좁으면 알맹이 있는 문장이 삭제된다 (고치기 전 상태 고정)', () => {
    const after = sanitizeFactUnsafeHtml(PARA, NONE);
    expect(after).not.toContain('30만원');
    expect(after.length).toBeLessThan(PARA.length * 0.6);
  });

  /** 실제 크롤링 본문은 수천 자다. 근거 장부가 짧으면(200자 미만) 값을 인정하지 않는 규칙이 있다 */
  const CRAWLED_BODY = '신청은 복지로 홈페이지에서 온라인으로 접수합니다. 방문 접수는 주민센터에서도 가능합니다. '
    + '제출 서류는 신분증과 소득 증빙 서류이며, 등본은 발급일 기준 유효기간을 확인해야 반려되지 않습니다. '
    + '심사 기간은 회차와 지자체에 따라 차이가 있으므로 접수 후 안내를 기다려야 합니다. '
    + '적립 방식과 만기 조건은 회차별 공고문에 명시되어 있으니 신청 전에 반드시 확인하시기 바랍니다. '
    + '중도 해지 시 지원금 지급 조건이 달라질 수 있다는 점도 함께 알아두는 것이 좋습니다.';

  it('⭐⭐ 크롤링 본문을 근거로 넣으면 그 수치가 살아남는다', () => {
    const reference = buildGroundingReference({
      factContext: '',
      crawledPosts: [{
        title: '청년내일저축계좌 안내',
        content: `지원금은 월 최대 30만원이며 소득 기준은 기준 중위소득 100% 이하입니다. ${CRAWLED_BODY}`,
      }],
    });
    const widened = { ...NONE, context: reference, sourceUrls: ['https://www.bokjiro.go.kr'] };
    const after = sanitizeFactUnsafeHtml(PARA, widened);
    expect(after).toContain('30만원');
    expect(after).toContain('100%');
  });

  it('⭐⭐ 근거에 없는 수치는 여전히 걸러진다 (그냥 다 통과시키면 검증이 아니다)', () => {
    // 위와 길이는 같고 수치만 빠진 자료 — 길이가 아니라 수치 유무로 갈린다는 뜻이다
    const reference = buildGroundingReference({ crawledPosts: [{ content: CRAWLED_BODY }] });
    const widened = { ...NONE, context: reference, sourceUrls: ['https://www.bokjiro.go.kr'] };
    expect(reference.length).toBeGreaterThan(200);
    expect(sanitizeFactUnsafeHtml(PARA, widened)).not.toContain('30만원');
  });

  it('⭐ 자료가 하나도 없으면 빈 문자열 (없는 근거를 지어내지 않는다)', () => {
    expect(buildGroundingReference({})).toBe('');
  });

  it('⭐ 상한을 넘겨도 잘라서 돌려준다 (토큰마다 훑으므로 무한정 키우지 않는다)', () => {
    const huge = buildGroundingReference({
      crawledPosts: [{ content: 'ㄱ'.repeat(200000) }],
      maxChars: 5000,
    });
    expect(huge.length).toBe(5000);
  });
});

describe('① 자료에 없는 수치를 코드가 먼저 찾는다 (API 호출 전)', () => {
  it('⭐⭐ 자료에 없는 금액을 잡아낸다', () => {
    const html = '<p>지원금은 월 최대 50만원까지 받을 수 있습니다.</p>';
    const found = findUngroundedFacts(html, '지원금 신청은 온라인으로 가능합니다.');
    expect(found.map((f) => f.token)).toContain('50만원');
  });

  it('⭐⭐ 자료에 있는 금액은 통과시킨다 (멀쩡한 글을 건드리면 손해다)', () => {
    const html = '<p>지원금은 월 최대 50만원까지 받을 수 있습니다.</p>';
    expect(findUngroundedFacts(html, '월 최대 50만원 지원')).toHaveLength(0);
  });

  it('⭐⭐ 쉼표·띄어쓰기가 달라도 같은 수치로 본다', () => {
    const html = '<p>연 소득 3,000만원 이하만 신청됩니다.</p>';
    expect(findUngroundedFacts(html, '연소득 3000만원 이하 대상')).toHaveLength(0);
  });

  it('⭐⭐ 날짜·마감일을 잡아낸다 (마감 지난 정보가 제일 위험하다)', () => {
    const html = '<p>접수는 3월 31일까지입니다.</p>';
    expect(findUngroundedFacts(html, '접수 일정은 공고를 확인하세요.').length).toBeGreaterThan(0);
  });

  it('⭐⭐ 비율·인원 같은 통계도 잡는다', () => {
    const html = '<p>합격률은 62.5%이고 작년에는 1,240명이 지원했습니다.</p>';
    const tokens = findUngroundedFacts(html, '시험 안내입니다.').map((f) => f.token);
    expect(tokens).toContain('62.5%');
    expect(tokens).toContain('1,240명');
  });

  it('⭐⭐ 목록 번호는 수치가 아니다', () => {
    const html = '<ol><li>서류를 준비합니다</li><li>온라인으로 접수합니다</li></ol><h2>2단계 준비물</h2>';
    expect(findUngroundedFacts(html, '')).toHaveLength(0);
  });

  it('⭐⭐ 링크·이미지 주소 안의 숫자는 무시한다', () => {
    const html = '<p>자세히 보기</p><img src="https://x.test/2024/09/12345.jpg"><a href="https://x.test/a?id=8900">안내</a>';
    expect(findUngroundedFacts(html, '')).toHaveLength(0);
  });

  it('⭐ 키워드 자체에 든 숫자는 통과시킨다', () => {
    const html = '<p>2026년 청년내일저축계좌 안내입니다.</p>';
    expect(findUngroundedFacts(html, '', { keyword: '2026년 청년내일저축계좌' })).toHaveLength(0);
  });

  it('⭐ 같은 수치가 여러 번 나와도 한 번만 센다', () => {
    const html = '<p>50만원입니다.</p><p>50만원을 받습니다.</p><p>총 50만원.</p>';
    const found = findUngroundedFacts(html, '');
    expect(found.filter((f) => f.token === '50만원')).toHaveLength(1);
  });

  it('⭐⭐ 문단 단위로 묶어준다 (문단만 다시 쓰면 되니까 싸다)', () => {
    const html = '<p>첫 문단은 멀쩡합니다.</p><p>지원금 50만원과 마감 3월 31일.</p>';
    const found = findUngroundedFacts(html, '');
    // 한 문단에 수치 2개 → 문단 인덱스가 같아야 한다
    const idx = new Set(found.map((f) => f.paragraphIndex));
    expect(idx.size).toBe(1);
    expect(found[0]?.paragraph).toContain('지원금');
  });
});

describe('② 고친 문단만 갈아끼운다', () => {
  it('⭐⭐ 지목된 문단만 교체하고 나머지는 글자 하나 안 바꾼다', () => {
    const html = '<p>그대로 둡니다.</p><p>지원금은 50만원입니다.</p><p>여기도 그대로.</p>';
    const out = applyFactRepairs(html, [{ paragraphIndex: 1, html: '<p>지원금 액수는 공고마다 다릅니다.</p>' }]);
    expect(out).toContain('그대로 둡니다.');
    expect(out).toContain('여기도 그대로.');
    expect(out).toContain('공고마다 다릅니다');
    expect(out).not.toContain('50만원');
  });

  it('⭐⭐ 엉뚱한 인덱스는 무시한다 (AI 가 헛소리해도 글이 깨지면 안 된다)', () => {
    const html = '<p>원본입니다.</p>';
    expect(applyFactRepairs(html, [{ paragraphIndex: 99, html: '<p>이상한 것</p>' }])).toBe(html);
  });

  it('⭐⭐ 빈 교체본은 무시한다 (문단이 사라지면 글에 구멍이 난다)', () => {
    const html = '<p>원본입니다.</p>';
    expect(applyFactRepairs(html, [{ paragraphIndex: 0, html: '   ' }])).toBe(html);
  });

  it('⭐ 교체본에 태그가 없으면 p 로 감싼다', () => {
    const html = '<p>원본입니다.</p>';
    expect(applyFactRepairs(html, [{ paragraphIndex: 0, html: '맨 텍스트' }])).toBe('<p>맨 텍스트</p>');
  });
});

describe('③ 절대 막지 않는다 — 실패하면 원본 그대로 발행', () => {
  const html = '<p>지원금은 50만원입니다.</p>';

  it('⭐⭐ 수치가 전부 근거 있으면 AI 를 아예 안 부른다 (비용 0)', async () => {
    const llm = jest.fn();
    const r = await guardFacts({ html, reference: '지원금 50만원 지급', keyword: '지원금', callLLM: llm });
    expect(llm).not.toHaveBeenCalled();
    expect(r.html).toBe(html);
    expect(r.checked).toBe(0);
  });

  it('⭐⭐ AI 가 터져도 원본을 그대로 돌려준다', async () => {
    const llm = jest.fn().mockRejectedValue(new Error('520'));
    const r = await guardFacts({ html, reference: '', keyword: '지원금', callLLM: llm });
    expect(r.html).toBe(html);
    expect(r.repaired).toBe(0);
  });

  it('⭐⭐ AI 가 쓰레기를 뱉어도 원본을 그대로 돌려준다', async () => {
    const llm = jest.fn().mockResolvedValue('죄송합니다 도와드릴 수 없습니다');
    const r = await guardFacts({ html, reference: '', keyword: '지원금', callLLM: llm });
    expect(r.html).toBe(html);
  });

  it('⭐⭐ 정상 응답이면 그 문단만 고쳐서 돌려준다', async () => {
    const llm = jest.fn().mockResolvedValue(
      JSON.stringify([{ paragraphIndex: 0, html: '<p>지원금 액수는 공고마다 다릅니다.</p>' }]),
    );
    const r = await guardFacts({ html, reference: '', keyword: '지원금', callLLM: llm });
    expect(r.html).toContain('공고마다 다릅니다');
    expect(r.repaired).toBe(1);
  });

  it('⭐ ```json 펜스가 붙어 와도 읽는다', async () => {
    const llm = jest.fn().mockResolvedValue(
      '```json\n[{"paragraphIndex":0,"html":"<p>공고를 확인하세요.</p>"}]\n```',
    );
    const r = await guardFacts({ html, reference: '', keyword: '지원금', callLLM: llm });
    expect(r.html).toContain('공고를 확인하세요');
  });

  it('⭐⭐ 검사할 문단이 많아도 한 번만 부른다 (호출 수가 비용이다)', async () => {
    const many = Array.from({ length: 8 }, (_, i) => `<p>${i}번 문단 ${i + 10}만원 지급.</p>`).join('');
    const llm = jest.fn().mockResolvedValue('[]');
    await guardFacts({ html: many, reference: '', keyword: '지원금', callLLM: llm });
    expect(llm).toHaveBeenCalledTimes(1);
  });
});

describe('④ 발행 경로에 실제로 배선돼 있다', () => {
  it('⭐⭐ orchestration 이 발행 직전에 부른다 (안 부르면 조용히 무효)', () => {
    expect(orchestration).toContain('guardFacts');
    const call = orchestration.indexOf('await guardFacts(');
    const ret = orchestration.lastIndexOf('return {\n      html,');
    expect(call).toBeGreaterThan(-1);
    expect(call).toBeLessThan(ret);
  });

  it('⭐⭐ 실패해도 발행이 계속되게 감싸져 있다', () => {
    const block = orchestration.slice(
      orchestration.indexOf('await guardFacts(') - 600,
      orchestration.indexOf('await guardFacts(') + 600,
    );
    expect(block).toContain('try {');
    expect(block).toContain('catch');
  });
});
