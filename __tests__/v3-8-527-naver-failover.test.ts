/**
 * v3.8.527 — 네이버 키 자동 토스 (둘 다 배선, 죽으면 자연스럽게 넘어간다)
 *
 * 사장님 지시: "둘 다 배선 연결하고, 기간이 다 돼서 자연스럽게 죽으면
 * 자연스럽게 토스되게끔".
 *
 * v3.8.526 은 **고를 때 한 번** 정하고 끝이었다(HUB 있으면 HUB, 없으면 기존).
 * 그래서 기존 키가 2027-06-30 에 죽는 순간 앱도 같이 멈춘다 — 옆에 멀쩡한 HUB 키가
 * 있어도 쳐다보지 않는다. 이제 **쓰다가 죽으면 그 자리에서 다른 키로 넘어간다.**
 *
 * 넘어가는 조건은 "인증이 막혔을 때"뿐이다. 타임아웃·네트워크 끊김에 키를 바꾸면
 * 멀쩡한 키를 의심하게 되고, 요청마다 두 번씩 때리는 낭비가 된다.
 */
import {
  naverSearch,
  naverDatalabSearch,
  resetNaverModeMemo,
  getNaverModeMemo,
} from '../src/core/naver-search-client';

const BOTH = {
  naverApiHubKeyId: 'hubid', naverApiHubKey: 'hubsecret',
  naverClientId: 'oldid', naverClientSecret: 'oldsecret',
};
const LEGACY_ONLY = { naverClientId: 'oldid', naverClientSecret: 'oldsecret' };

/** 호출 URL 을 기록하면서 정해진 응답을 돌려주는 가짜 fetch */
function fakeFetch(plan: Array<{ status: number; body?: any }>) {
  const calls: string[] = [];
  let i = 0;
  const impl = (async (url: any) => {
    calls.push(String(url));
    const step = plan[Math.min(i, plan.length - 1)]!;
    i += 1;
    return {
      ok: step.status >= 200 && step.status < 300,
      status: step.status,
      json: async () => step.body ?? { items: [], total: 0 },
    } as any;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

beforeEach(() => resetNaverModeMemo());

describe('① 쓰다가 죽으면 다른 키로 넘어간다', () => {
  it('HUB 가 401 이면 기존 키로 토스해서 결과를 살린다', async () => {
    const f = fakeFetch([{ status: 401 }, { status: 200, body: { items: [{ title: 'x' }], total: 1 } }]);
    const res = await naverSearch('blog', { query: 'a' }, { payload: BOTH, fetchImpl: f.impl });
    expect(res.ok).toBe(true);
    expect(res.mode).toBe('legacy');           // 살아남은 쪽으로 답이 왔다
    expect(f.calls[0]).toContain('naverapihub.apigw.ntruss.com');
    expect(f.calls[1]).toContain('openapi.naver.com');
  });

  it('기존 키가 만료(401)되면 HUB 로 토스한다 — 2027-06-30 이 와도 앱은 안 멈춘다', async () => {
    const f = fakeFetch([{ status: 401 }, { status: 200, body: { items: [], total: 0 } }]);
    // 기존 키를 먼저 쓰던 상태를 만들고 (memo) 그게 죽는 상황
    const res = await naverSearch('news', { query: 'a' }, {
      payload: BOTH, fetchImpl: f.impl, preferMode: 'legacy',
    });
    expect(res.ok).toBe(true);
    expect(res.mode).toBe('hub');
    expect(f.calls[0]).toContain('openapi.naver.com');
    expect(f.calls[1]).toContain('naverapihub.apigw.ntruss.com');
  });

  it('데이터랩도 같은 규칙으로 토스된다', async () => {
    const f = fakeFetch([{ status: 403 }, { status: 200, body: { results: [] } }]);
    const res = await naverDatalabSearch({ startDate: '2026-08-01' }, { payload: BOTH, fetchImpl: f.impl });
    expect(res.ok).toBe(true);
    expect(res.mode).toBe('legacy');
    expect(f.calls[1]).toContain('/v1/datalab/search');
  });
});

describe('② 낭비 없이 토스한다', () => {
  it('한 번 넘어가면 그 다음부터는 곧바로 살아있는 키로 간다 (매번 두 번 때리지 않는다)', async () => {
    const f1 = fakeFetch([{ status: 401 }, { status: 200 }]);
    await naverSearch('blog', { query: 'a' }, { payload: BOTH, fetchImpl: f1.impl });
    expect(f1.calls).toHaveLength(2);
    expect(getNaverModeMemo()).toBe('legacy');

    const f2 = fakeFetch([{ status: 200 }]);
    const res = await naverSearch('blog', { query: 'b' }, { payload: BOTH, fetchImpl: f2.impl });
    expect(res.ok).toBe(true);
    expect(f2.calls).toHaveLength(1);                       // 죽은 쪽을 다시 두드리지 않는다
    expect(f2.calls[0]).toContain('openapi.naver.com');
  });

  it('타임아웃·네트워크 오류에는 키를 바꾸지 않는다 — 키 문제가 아니다', async () => {
    const calls: string[] = [];
    const impl = async (url: string) => { calls.push(String(url)); throw new Error('network down'); };
    const res = await naverSearch('blog', { query: 'a' }, { payload: BOTH, fetchImpl: impl as any });
    expect(res.ok).toBe(false);
    expect(calls).toHaveLength(1);            // 두 번째 키를 괜히 태우지 않는다
    expect(getNaverModeMemo()).toBeNull();    // 멀쩡한 키를 죽었다고 기록하지 않는다
  });

  it('키가 한 벌뿐이면 토스할 곳이 없으니 한 번만 시도한다', async () => {
    const f = fakeFetch([{ status: 401 }]);
    const res = await naverSearch('blog', { query: 'a' }, { payload: LEGACY_ONLY, fetchImpl: f.impl });
    expect(res.ok).toBe(false);
    expect(f.calls).toHaveLength(1);
    expect(res.error).toContain('네이버클라우드');   // 대신 무엇을 하라고 알려준다
  });
});

describe('③ 성공하면 그 키를 기억한다', () => {
  it('HUB 가 잘 되면 HUB 를 기억한다', async () => {
    const f = fakeFetch([{ status: 200 }]);
    const res = await naverSearch('blog', { query: 'a' }, { payload: BOTH, fetchImpl: f.impl });
    expect(res.mode).toBe('hub');
    expect(getNaverModeMemo()).toBe('hub');
  });
});
