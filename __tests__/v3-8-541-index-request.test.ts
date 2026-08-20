/**
 * 발행 즉시 색인 요청 테스트 (v3.8.541)
 *
 * 사장님 요구: "네이버/구글/다음/줌 등등 바로 색인요청" — 엔진별 실측 지형:
 *  네이버=IndexNow 공식 지원, 빙 등=IndexNow 공유, 구글=서비스 계정 옵트인,
 *  다음·줌=공식 창구 없음(정직하게 제외).
 *
 * 계약:
 *  ① WP 발행이면 키 생성→키 파일 업로드→네이버·공유 엔드포인트 제출 (스펙 페이로드)
 *  ② 키·주소는 저장돼 발행마다 재업로드하지 않는다
 *  ③ 어떤 실패도 던지지 않는다 — 색인은 편의, 발행이 우선
 *  ④ 블로그스팟은 IndexNow 스킵 (키 파일 호스팅 불가 — 정직 표기)
 *  ⑤ 구글은 GOOGLE_INDEXING_SA_JSON 있을 때만 시도
 *  ⑥ emitPublishSuccess(전 경로 단일 깔때기)에 배선
 */
import { requestIndexingForUrl, generateIndexNowKey } from '../src/core/indexing/index-request';
import * as fs from 'fs';
import * as path from 'path';

const WP_ENV = {
  WORDPRESS_SITE_URL: 'https://leadernam.com',
  WORDPRESS_USERNAME: 'user',
  WORDPRESS_PASSWORD: 'app-pass',
};

function mockFetchOk() {
  return jest.fn(async (url: any, _init?: any) => {
    if (String(url).includes('/wp-json/wp/v2/media')) {
      return { ok: true, status: 201, json: async () => ({ source_url: 'https://leadernam.com/wp-content/uploads/indexnow-abc.txt' }) } as any;
    }
    return { ok: true, status: 200, json: async () => ({}) } as any;
  });
}

describe('① WP 발행 → 키 준비 + 네이버·공유 제출', () => {
  it('⭐ 키 파일 업로드 후 두 엔드포인트에 스펙 페이로드로 제출한다', async () => {
    const fetchImpl = mockFetchOk();
    const persisted: Record<string, string>[] = [];
    const r = await requestIndexingForUrl(
      { url: 'https://leadernam.com/tax/abc', platform: 'wordpress' },
      { fetchImpl: fetchImpl as any, env: { ...WP_ENV }, persistEnv: (p) => { persisted.push(p); }, log: () => {} },
    );

    expect(r.naver).toBe('ok');
    expect(r.bing).toBe('ok');
    const calls = fetchImpl.mock.calls.map((c: any[]) => String(c[0]));
    expect(calls.some((u) => u.includes('searchadvisor.naver.com/indexnow'))).toBe(true);
    expect(calls.some((u) => u.includes('api.indexnow.org/indexnow'))).toBe(true);

    const naverBody = JSON.parse((fetchImpl.mock.calls.find((c: any[]) => String(c[0]).includes('naver')) as any[])[1].body);
    expect(naverBody.host).toBe('leadernam.com');
    expect(naverBody.keyLocation).toContain('indexnow-');
    expect(naverBody.urlList).toEqual(['https://leadernam.com/tax/abc']);
    expect(persisted[0]).toHaveProperty('INDEXNOW_KEY');
    expect(persisted[0]).toHaveProperty('INDEXNOW_KEY_LOCATION');
  });

  it('② 키 주소가 저장돼 있으면 재업로드하지 않는다', async () => {
    const fetchImpl = mockFetchOk();
    const key = generateIndexNowKey();
    await requestIndexingForUrl(
      { url: 'https://leadernam.com/tax/abc', platform: 'wordpress' },
      {
        fetchImpl: fetchImpl as any,
        env: { ...WP_ENV, INDEXNOW_KEY: key, INDEXNOW_KEY_LOCATION: `https://leadernam.com/up/indexnow-${key}.txt` },
        log: () => {},
      },
    );
    const mediaCalls = fetchImpl.mock.calls.filter((c: any[]) => String(c[0]).includes('/media'));
    expect(mediaCalls.length).toBe(0);
  });
});

describe('③ 실패 무해 + ④ 플랫폼 정직성 + ⑤ 구글 옵트인', () => {
  it('엔드포인트가 전부 죽어도 던지지 않고 결과만 표시한다', async () => {
    const fetchImpl = jest.fn(async (url: any, _init?: any) => {
      if (String(url).includes('/media')) return { ok: true, status: 201, json: async () => ({ source_url: 'https://leadernam.com/k.txt' }) } as any;
      throw new Error('network down');
    });
    const r = await requestIndexingForUrl(
      { url: 'https://leadernam.com/x', platform: 'wordpress' },
      { fetchImpl: fetchImpl as any, env: { ...WP_ENV }, log: () => {} },
    );
    expect(r.naver).toBe('failed');
    expect(r.bing).toBe('failed');
  });

  it('블로그스팟은 IndexNow 스킵 — 이유를 정직하게 남긴다', async () => {
    const fetchImpl = jest.fn();
    const r = await requestIndexingForUrl(
      { url: 'https://tjdgus24280.blogspot.com/2026/08/x.html', platform: 'blogger' },
      { fetchImpl: fetchImpl as any, env: {}, log: () => {} },
    );
    expect(r.naver).toBe('skipped');
    expect(r.bing).toBe('skipped');
    expect(String(r.detail)).toContain('워드프레스만');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('구글은 서비스 계정 JSON 미설정이면 skipped', async () => {
    const r = await requestIndexingForUrl(
      { url: 'https://leadernam.com/x', platform: 'wordpress' },
      { fetchImpl: mockFetchOk() as any, env: { ...WP_ENV }, log: () => {} },
    );
    expect(r.google).toBe('skipped');
  });

  it('INDEXNOW_DISABLED=1 이면 아무것도 안 한다 (킬스위치)', async () => {
    const fetchImpl = jest.fn();
    const r = await requestIndexingForUrl(
      { url: 'https://leadernam.com/x', platform: 'wordpress' },
      { fetchImpl: fetchImpl as any, env: { ...WP_ENV, INDEXNOW_DISABLED: '1' }, log: () => {} },
    );
    expect(r.naver).toBe('skipped');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('⑥ 배선 — 전 경로 단일 깔때기', () => {
  const mainTs = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.ts'), 'utf8');

  it('emitPublishSuccess 안에서 fire-and-forget 으로 부른다', () => {
    const fnStart = mainTs.indexOf('function emitPublishSuccess');
    const fnBody = mainTs.slice(fnStart, fnStart + 4000);
    expect(fnBody).toContain("require('../src/core/indexing/index-request')");
    expect(fnBody).toContain('void requestIndexingForUrl');
  });

  it('emitPublishSuccess 는 4개 발행 경로(단일·큐/기타·멀티계정·스케줄)가 부른다', () => {
    const count = (mainTs.match(/emitPublishSuccess\(\{/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(4);
  });

  it('키 저장은 병합 방식 — 기존 .env 를 읽어 합친다', () => {
    const fnStart = mainTs.indexOf('function emitPublishSuccess');
    const fnBody = mainTs.slice(fnStart, fnStart + 4000);
    expect(fnBody).toContain('existing.split');
    expect(fnBody).toContain('map.set');
  });
});
