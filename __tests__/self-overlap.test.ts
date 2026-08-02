/**
 * 자기중복 관측 테스트 (v3.8.390)
 *
 * ⚠️ 이 테스트의 제1 목적은 "정확히 측정한다"가 아니라
 *    **어떤 경우에도 발행을 막지 않는다** 를 고정하는 것이다.
 *    사용자 원칙: "검수 때문에 글이 통과가 안 되서 발행이 안 되면 절대 안 된다."
 *
 * 왜 만들었나:
 *   v3.8.385 의 buildUniquenessBlock(기존 글 제목을 모델에 보여주는 예방책)이 실제로
 *   먹혔는지 재는 계기판이 없었다. 기존 유사도 검증은 페러프레이징(원문 대비)뿐이고
 *   "내 사이트 기존 글 대비"는 측정하지 않았다.
 *
 * 실측 근거(2026-07-28): 본문 유사도 0.35+ 가 4클러스터 11편.
 *   그중 3개는 지역 시리즈(정당한 분화)였고 실질 중복은 4편. 지금은 작지만
 *   하루 5~10편을 같은 주제군에서 뽑으면 반드시 커진다.
 */
import { measureSelfOverlap, formatSelfOverlapLog, SelfOverlapReport } from '../src/core/self-overlap';
import { braceBlock } from './helpers/source-block';

/** 같은 문장을 반복하는 본문 — 같은 seed 끼리는 사실상 동일 문서가 된다 */
const longBody = (seed: string) =>
  `<p>${seed} 이 문단은 유사도 계산에 충분한 길이를 확보하기 위한 본문입니다. `.repeat(20) + '</p>';

/**
 * 서로 겹치는 문구가 없는 본문 — "다른 주제" 케이스용.
 * ⚠️ longBody 로 두 글을 만들면 보일러플레이트가 공유돼 61% 가 나온다(실측).
 *   trigram Jaccard 는 공통 상용구에 민감하므로 픽스처에서 공유 문구를 없애야 한다.
 */
const distinctBody = (kind: 'a' | 'b') => kind === 'a'
  ? '<p>' + '전세 보증금 증액 청구는 계약 후 1년 이내에 할 수 없으며 한도는 20분의 1입니다. 확정일자는 임대차 신고 접수로 갈음됩니다. '.repeat(12) + '</p>'
  : '<p>' + '장기요양 등급 판정에 불복하면 통지받은 날부터 90일 안에 심사청구를 넣습니다. 의사소견서와 인정조사표가 판단 근거로 쓰입니다. '.repeat(12) + '</p>';

const wpPost = (id: number, title: string, body: string) => ({
  id, title: { rendered: title }, link: `https://x.test/${id}`, content: { rendered: body },
});

function mockFetchOnce(payload: any, ok = true, status = 200) {
  const original = global.fetch;
  global.fetch = (async () => ({
    ok, status,
    json: async () => payload,
  })) as any;
  return () => { global.fetch = original; };
}

describe('절대 차단하지 않는다 — 최우선 원칙', () => {
  it('네트워크가 죽어도 throw 하지 않고 skipped 로 돌려준다', async () => {
    const original = global.fetch;
    global.fetch = (() => Promise.reject(new Error('ECONNRESET'))) as any;
    try {
      const r = await measureSelfOverlap('https://x.test', '키워드', longBody('가'));
      expect(r.skipped).toContain('예외');
      expect(r.flagged).toEqual([]);
    } finally { global.fetch = original; }
  });

  it('HTTP 오류도 조용히 넘긴다', async () => {
    const restore = mockFetchOnce(null, false, 503);
    try {
      const r = await measureSelfOverlap('https://x.test', '키워드', longBody('가'));
      expect(r.skipped).toContain('503');
    } finally { restore(); }
  });

  it('응답이 배열이 아니어도 안전하다', async () => {
    const restore = mockFetchOnce({ code: 'rest_no_route' });
    try {
      const r = await measureSelfOverlap('https://x.test', '키워드', longBody('가'));
      expect(r.skipped).toBeTruthy();
    } finally { restore(); }
  });

  it('사이트 URL·키워드가 없으면 조용히 건너뛴다', async () => {
    expect((await measureSelfOverlap('', 'k', longBody('가'))).skipped).toBe('사이트 URL 없음');
    expect((await measureSelfOverlap('https://x.test', '', longBody('가'))).skipped).toBe('키워드 없음');
  });

  it('임계값을 넘겨도 반환값에 차단 신호가 없다 — flagged 는 경고일 뿐이다', async () => {
    const same = longBody('동일한내용');
    const restore = mockFetchOnce([wpPost(1, '거의 같은 글', same)]);
    try {
      const r = await measureSelfOverlap('https://x.test', '키워드', same);
      expect(r.flagged.length).toBeGreaterThan(0);
      expect(Object.keys(r)).not.toContain('block');
      expect(Object.keys(r)).not.toContain('pass');
      // 로그 문구도 발행 계속을 명시해야 한다
      expect(formatSelfOverlapLog(r)).toContain('발행은 그대로 진행');
    } finally { restore(); }
  });
});

describe('측정', () => {
  it('같은 본문은 높은 유사도로 잡는다', async () => {
    const same = longBody('완전동일');
    const restore = mockFetchOnce([wpPost(1, '동일 글', same)]);
    try {
      const r = await measureSelfOverlap('https://x.test', '키워드', same);
      expect(r.worst?.similarity).toBeGreaterThan(0.9);
      expect(r.checked).toBe(1);
    } finally { restore(); }
  });

  it('다른 주제는 낮은 유사도로 잡는다', async () => {
    const restore = mockFetchOnce([wpPost(1, '무관한 글', distinctBody('b'))]);
    try {
      const r = await measureSelfOverlap('https://x.test', '키워드', distinctBody('a'));
      expect(r.worst?.similarity).toBeLessThan(0.2);
      expect(r.flagged).toEqual([]);
    } finally { restore(); }
  });

  it('픽스처 함정 기록 — 문장을 공유하면 주제가 달라도 0.5 를 넘는다', async () => {
    // 처음 이 테스트를 longBody 두 개로 짰다가 0.61 이 나와 실패했다.
    // 원인은 코드가 아니라 픽스처였다(같은 문장을 20번 반복해 공유).
    //
    // ⚠️ 이게 실제 발행글에도 해당될 거라 추측했으나, 실측으로 틀렸음이 확인됐다.
    //   발행글 322편 51,681쌍 실측(2026-07-30):
    //     중간값 0.069 · 99% 0.168 · 99.9% 0.284 · 최대 0.549
    //   템플릿은 대부분 마크업이고 텍스트 비중이 작아 stripToText 후 영향이 미미하다.
    //   임계 0.35 는 11쌍(0.02%)만 잡고, 그 11쌍이 정확히 실제 중복이다
    //   (청년내일저축계좌 4편 0.40~0.55, 추석 지역 시리즈 0.38~0.45).
    //   → 임계값 0.35 는 추측이 아니라 이 분포에서 나온 값이다.
    const restore = mockFetchOnce([wpPost(1, '주제만 다른 글', longBody('전혀다른주제'))]);
    try {
      const r = await measureSelfOverlap('https://x.test', '키워드', longBody('완전히별개'));
      expect(r.worst!.similarity).toBeGreaterThan(0.5);
    } finally { restore(); }
  });

  it('기본 임계값은 실측 분포에서 나온 0.35 다', async () => {
    const restore = mockFetchOnce([wpPost(1, '어떤 글', distinctBody('b'))]);
    try {
      const r = await measureSelfOverlap('https://x.test', '키워드', distinctBody('a'));
      expect(r.threshold).toBe(0.35);
    } finally { restore(); }
  });

  it('가장 비슷한 글을 worst 로 올린다', async () => {
    const target = longBody('공통내용많음');
    const restore = mockFetchOnce([
      wpPost(1, '무관', longBody('아주다른이야기')),
      wpPost(2, '판박이', target),
    ]);
    try {
      const r = await measureSelfOverlap('https://x.test', '키워드', target);
      expect(r.worst?.id).toBe(2);
      expect(r.worst?.title).toBe('판박이');
    } finally { restore(); }
  });

  it('본문이 짧은 기존 글(태그 피드 등)은 비교에서 뺀다', async () => {
    const restore = mockFetchOnce([wpPost(1, '빈 글', '<p>짧음</p>')]);
    try {
      const r = await measureSelfOverlap('https://x.test', '키워드', longBody('가'));
      expect(r.skipped).toContain('본문이 충분한 기존 글 없음');
    } finally { restore(); }
  });

  it('새 본문이 너무 짧으면 측정하지 않는다 — 의미 없는 수치를 만들지 않는다', async () => {
    const r = await measureSelfOverlap('https://x.test', '키워드', '<p>짧은 초안</p>');
    expect(r.skipped).toContain('너무 짧음');
  });

  it('비교 대상이 없으면 그렇게 알려준다', async () => {
    const restore = mockFetchOnce([]);
    try {
      const r = await measureSelfOverlap('https://x.test', '키워드', longBody('가'));
      expect(r.skipped).toBe('비교할 기존 글 없음');
    } finally { restore(); }
  });

  it('제목의 HTML 엔티티·태그를 걷어낸다', async () => {
    const same = longBody('동일');
    const restore = mockFetchOnce([wpPost(1, '<b>굵은</b> 제목', same)]);
    try {
      const r = await measureSelfOverlap('https://x.test', '키워드', same);
      expect(r.worst?.title).toBe('굵은 제목');
    } finally { restore(); }
  });
});

describe('로그 문구', () => {
  const base: SelfOverlapReport = {
    checked: 5, worst: null, flagged: [], threshold: 0.35, skipped: '',
  };

  it('양호할 때는 경고를 붙이지 않는다', () => {
    const line = formatSelfOverlapLog({
      ...base,
      worst: { id: 1, title: '어떤 글', url: 'u', similarity: 0.12 },
    });
    expect(line).toContain('양호');
    expect(line).not.toContain('⚠️');
  });

  it('초과 시 몇 편·어느 글인지 보여준다', () => {
    const line = formatSelfOverlapLog({
      ...base,
      worst: { id: 2, title: '겹치는 글 제목', url: 'u', similarity: 0.61 },
      flagged: [{ id: 2, title: '겹치는 글 제목', url: 'u', similarity: 0.61 }],
    });
    expect(line).toContain('⚠️');
    expect(line).toContain('61%');
    expect(line).toContain('겹치는 글 제목');
    expect(line).toContain('발행은 그대로 진행');
  });

  it('건너뜀 이유를 그대로 보여준다', () => {
    expect(formatSelfOverlapLog({ ...base, skipped: '비교할 기존 글 없음' }))
      .toContain('비교할 기존 글 없음');
  });

  it('빈 리포트에 안전하다', () => {
    expect(formatSelfOverlapLog(undefined as any)).toBe('');
  });
});

describe('orchestration 배선', () => {
  const orch = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf8');

  it('생성 직후에 관측한다', () => {
    const gen = orch.indexOf('let allSectionsObj = await generateAllSectionsFinal');
    const obs = orch.indexOf('measureSelfOverlap');
    expect(gen).toBeGreaterThan(-1);
    expect(obs).toBeGreaterThan(gen);
  });

  it('관측 실패가 발행을 막지 않는다', () => {
    const i = orch.indexOf('🧬 v3.8.390');
    expect(i).toBeGreaterThan(-1);
    const block = braceBlock(orch, '🧬 v3.8.390');
    expect(block).toContain('try {');
    expect(block).toContain('catch');
    expect(block).toContain('발행에 어떤 영향도 주지 않는다');
  });

  it('차단 분기가 없다 — 관측 결과로 흐름을 바꾸지 않는다', () => {
    const i = orch.indexOf('🧬 v3.8.390');
    const block = braceBlock(orch, '🧬 v3.8.390');
    expect(block).not.toContain('throw');
    expect(block).not.toContain('return;');
  });

  it('유사도 계산을 따로 구현하지 않고 재사용한다 — 수치가 갈라지면 판단이 어긋난다', () => {
    const mod = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'src', 'core', 'self-overlap.ts'), 'utf8');
    expect(mod).toContain("from './paraphrasing-validator'");
    expect(mod).toContain('jaccard');
    expect(mod).toContain('trigramSet');
  });
});
