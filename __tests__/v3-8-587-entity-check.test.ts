/**
 * v3.8.587 — 고유명사의 뜻을 모델이 지어내지 않게 한다
 *
 * ## 실측 사고 (발행글 5429)
 * 제목이 `2026년 청년일자리도약장려금 비즈스캔 사업소득 있으면 가능한지` 였는데
 * 글이 **"비즈스캔"을 "흩어진 정보를 한 번에 점검하려는 검색 흐름"이라고 재정의**하고
 * 그 위에 글 전체를 세웠다(본문 30회).
 *
 * 비평은 "비즈스캔의 실체가 안 잡힌다"고 봤지만, 실제로 검색하면 **실재한다**:
 *   "비즈스캔 | 1분 정책자금·정부지원사업 무료 진단" (웹문서 283,553건)
 * 즉 없는 것을 지어낸 게 아니라 **있는 것을 모르는 채로 뜻을 만들었다.**
 * 문장도 수치도 멀쩡해 보여서 읽어도 안 보이는 종류의 오류다.
 *
 * ## 실측으로 정한 신호 — 총 건수가 아니라 "제목 일치"
 *   고용24            총 24,558,287건 · 제목 8/10   실재
 *   청년일자리도약장려금  총  2,451,893건 · 제목 9/10   실재
 *   비즈스캔           총    283,553건 · 제목 3/10   실재(민간 서비스)
 *   퀀텀스캔봇          총          0건 · 제목 0/0    없는 말
 * 부분 일치로도 수십만 건이 나오므로 총 건수로는 못 가른다.
 */
import {
  properNounCandidates, checkEntities, buildEntityBlock, describeEntities,
} from '../src/core/final/entity-check';

/** 네트워크를 타지 않는다 */
const search = (byToken: Record<string, string[]>, total = 1000) =>
  (async (_type: string, params: any) => {
    const q = String(params?.query || '');
    const titles = byToken[q] || [];
    return { ok: true, total, items: titles.map((t) => ({ title: t })) };
  }) as any;

describe('① 확인할 이름만 고른다', () => {
  test('낯선 이름과 제도명을 고른다', () => {
    const got = properNounCandidates('2026년 청년일자리도약장려금 비즈스캔 사업소득 있으면 가능한지');
    expect(got).toContain('비즈스캔');
    expect(got).toContain('청년일자리도약장려금');
  });

  test('연도·어미·흔한 명사는 뺀다 (호출만 늘어난다)', () => {
    const got = properNounCandidates('2026년 청년일자리도약장려금 비즈스캔 사업소득 있으면 가능한지');
    for (const skip of ['2026년', '사업소득', '있으면', '가능한지']) {
      expect(got).not.toContain(skip);
    }
  });

  /** 세 글자까지 열었더니 "항공권이란 무엇인가"를 497자로 알려 주는 블록이 나왔다 */
  test('보통명사는 검사하지 않는다', () => {
    expect(properNounCandidates('해외 항공권 취소 수수료 면제')).toEqual([]);
  });

  test('호출 수에 상한이 있다', () => {
    const many = properNounCandidates('가나다라 마바사아 자차카타 파하가나 나다라마');
    expect(many.length).toBeLessThanOrEqual(3);
  });
});

describe('② 제목 일치로 실재를 가른다', () => {
  test('제목에 그대로 나오면 실재로 본다', async () => {
    const f = await checkEntities('비즈스캔 신청', search({
      비즈스캔: ['비즈스캔 | 1분 정책자금·정부지원사업 무료 진단'],
    }, 283553));
    expect(f[0]!.found).toBe(true);
    expect(f[0]!.titles[0]).toContain('정책자금');
  });

  /** 총 건수는 부분 일치로도 수십만이 나온다 — 그것만으로 실재라 하면 안 된다 */
  test('건수가 많아도 제목에 없으면 미확인이다', async () => {
    const f = await checkEntities('퀀텀스캔봇 신청', search({
      퀀텀스캔봇: ['전혀 다른 글', '관련 없는 문서'],
    }, 999999));
    expect(f[0]!.found).toBe(false);
  });

  test('검색이 실패하면 "없다"고 단정하지 않는다', async () => {
    const boom = (async () => { throw new Error('망함'); }) as any;
    const f = await checkEntities('비즈스캔 신청', boom);
    expect(f[0]!.found).toBe(true);      // 못 물어본 것과 없는 것은 다르다
    expect(f[0]!.titles).toEqual([]);
  });
});

describe('③ 프롬프트에 무엇을 넣나', () => {
  test('실재하면 정체를 알려 준다 (지어낼 이유를 없앤다)', () => {
    const block = buildEntityBlock([
      { token: '비즈스캔', found: true, total: 283553, titles: ['비즈스캔 | 1분 정책자금·정부지원사업 무료 진단'] },
    ]);
    expect(block).toContain('비즈스캔');
    expect(block).toContain('정책자금');
    expect(block).toContain('다른 뜻으로 재정의하지 마세요');
  });

  test('실제 사고를 예시로 박아 둔다 (막연한 당부는 안 먹힌다)', () => {
    const block = buildEntityBlock([
      { token: '비즈스캔', found: true, total: 1, titles: ['비즈스캔 | 무료 진단'] },
    ]);
    expect(block).toContain('흩어진 정보를 한 번에 점검하려는 검색 흐름');
    expect(block).toContain('30번');
  });

  test('미확인이면 쓰지 말라고 한다', () => {
    const block = buildEntityBlock([{ token: '퀀텀스캔봇', found: false, total: 0, titles: [] }]);
    expect(block).toContain('실체가 확인되지 않았습니다');
    expect(block).toContain('제목에도 넣지 마세요');
  });

  test('넣을 게 없으면 프롬프트를 늘리지 않는다', () => {
    expect(buildEntityBlock([])).toBe('');
    expect(buildEntityBlock([{ token: 'x', found: true, total: 0, titles: [] }])).toBe('');
  });

  test('로그 한 줄이 판정을 담는다', () => {
    const line = describeEntities([
      { token: '비즈스캔', found: true, total: 1, titles: ['비즈스캔 | 진단'] },
      { token: '퀀텀스캔봇', found: false, total: 0, titles: [] },
    ]);
    expect(line).toContain('비즈스캔=실재');
    expect(line).toContain('퀀텀스캔봇=미확인');
  });
});

describe('④ 발행 경로에 실제로 배선돼 있다', () => {
  const fs = require('fs');
  const path = require('path');
  const orch = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf-8',
  );

  test('import 하고 부른다', () => {
    expect(orch).toContain("from './entity-check'");
    expect(orch).toContain('await checkEntities(keyword');
  });

  /** 만들고 프롬프트에 안 넣으면 죽은 코드다 — 이 저장소의 단골 실수 */
  test('만든 블록이 실제로 프롬프트에 들어간다', () => {
    expect(orch).toContain('...(entityBlock ? [entityBlock] : [])');
  });

  test('발행을 막지 않는다', () => {
    const at = orch.indexOf('await checkEntities(keyword');
    const block = orch.slice(orch.lastIndexOf('try {', at), orch.indexOf('factEnrichedContents = [', at));
    expect(block).toContain('catch');
    expect(block).not.toContain('throw new Error');
  });
});
