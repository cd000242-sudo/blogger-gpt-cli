/**
 * v3.8.526 — 네이버 API HUB 배선 (키만 넣으면 바로 쓰이게)
 *
 * 실측으로 확정한 규격 (2026-08-18, 키 없이 직접 호출):
 *   HUB 검색   https://naverapihub.apigw.ntruss.com/search/v1/{type}   → 401 (존재)
 *   HUB 트렌드 https://naverapihub.apigw.ntruss.com/search-trend/v1/search → 401 (존재)
 *   naveropenapi.apigw.ntruss.com → 404 (다른 게이트웨이, 쓰면 안 된다)
 *   헤더: X-NCP-APIGW-API-KEY-ID / X-NCP-APIGW-API-KEY
 *
 * 설계: HUB 키가 있으면 HUB, 없으면 기존 키. 사용자는 키만 넣으면 된다.
 * 기존 키를 강제로 끊지 않는다 — 아직 HUB 키를 못 받은 사용자의 앱이 멈추기 때문.
 */
import {
  resolveNaverCredentials,
  naverAuthHeaders,
  buildNaverSearchUrl,
  buildNaverDatalabUrl,
  describeNaverFailure,
} from '../src/core/naver-search-client';

const HUB = { naverApiHubKeyId: 'hubid', naverApiHubKey: 'hubsecret' };
const LEGACY = { naverClientId: 'oldid', naverClientSecret: 'oldsecret' };

describe('① 키를 넣으면 그 키로 나간다', () => {
  it('HUB 키가 있으면 HUB 를 쓴다', () => {
    const c = resolveNaverCredentials(HUB);
    expect(c.mode).toBe('hub');
    expect(c.keyId).toBe('hubid');
  });

  it('HUB 키가 없으면 기존 키로 나간다 — 아직 못 받은 사용자를 끊지 않는다', () => {
    const c = resolveNaverCredentials(LEGACY);
    expect(c.mode).toBe('legacy');
  });

  it('둘 다 있으면 HUB 가 이긴다 (새 발급분이 정답)', () => {
    expect(resolveNaverCredentials({ ...HUB, ...LEGACY }).mode).toBe('hub');
  });
});

describe('② 실측한 엔드포인트·헤더 그대로 조립한다', () => {
  it('HUB 검색 URL 과 헤더', () => {
    const c = resolveNaverCredentials(HUB);
    const url = buildNaverSearchUrl('blog', { query: '보험', display: 10 }, c);
    expect(url).toContain('https://naverapihub.apigw.ntruss.com/search/v1/blog');
    expect(url).toContain('query=%EB%B3%B4%ED%97%98');
    // 404 나는 다른 게이트웨이로 새면 안 된다
    expect(url).not.toContain('naveropenapi');
    expect(naverAuthHeaders(c)).toEqual({ 'X-NCP-APIGW-API-KEY-ID': 'hubid', 'X-NCP-APIGW-API-KEY': 'hubsecret' });
  });

  it('기존 검색 URL 과 헤더는 그대로 유지', () => {
    const c = resolveNaverCredentials(LEGACY);
    const url = buildNaverSearchUrl('news', { query: 'x' }, c);
    expect(url).toContain('https://openapi.naver.com/v1/search/news.json');
    expect(naverAuthHeaders(c)).toEqual({ 'X-Naver-Client-Id': 'oldid', 'X-Naver-Client-Secret': 'oldsecret' });
  });

  it('데이터랩 경로가 양쪽 모두 실측값이다', () => {
    expect(buildNaverDatalabUrl(resolveNaverCredentials(HUB)))
      .toBe('https://naverapihub.apigw.ntruss.com/search-trend/v1/search');
    expect(buildNaverDatalabUrl(resolveNaverCredentials(LEGACY)))
      .toBe('https://openapi.naver.com/v1/datalab/search');
  });
});

describe('③ 실패는 처방까지 알려준다', () => {
  it('HUB 401 은 Application 서비스 선택까지 짚어준다', () => {
    const msg = describeNaverFailure(401, 'hub');
    expect(msg).toContain('API HUB');
    expect(msg).toContain('Search API');
  });

  it('기존 키 401 은 이관 안내로 이어진다', () => {
    expect(describeNaverFailure(401, 'legacy')).toContain('네이버클라우드');
  });

  it('404 는 종료된 API 를 짚는다 (쇼핑·책·전문자료)', () => {
    expect(describeNaverFailure(404, 'hub')).toContain('2026-07-31');
  });

  it('429 는 HUB 의 흔한 원인(서비스 미선택)을 알려준다', () => {
    expect(describeNaverFailure(429, 'hub')).toContain('선택');
  });
});

describe('④ 앱 배선 — 키 넣는 곳과 점검기가 HUB 를 안다', () => {
  const fs = require('fs');
  const path = require('path');
  const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');

  it('환경설정에 API HUB 키 입력칸이 있다', () => {
    const html = read('electron/ui/index.html');
    expect(html).toContain('naverApiHubKeyId');
    expect(html).toContain('naverApiHubKey');
  });

  it('입력한 HUB 키가 저장되고, 다시 열면 채워진다 (칸만 있고 안 담기면 조용히 무시된다)', () => {
    const settings = read('electron/ui/modules/settings.js');
    const save = settings.slice(settings.indexOf('export async function saveSettings'), settings.indexOf('export async function saveSettings') + 3000);
    expect(save).toContain("getElementById('naverApiHubKeyId')");
    expect(save).toContain("getElementById('naverApiHubKey')");
    // 복원 매핑에도 있어야 다시 열었을 때 빈 칸이 아니다
    expect(settings).toContain("'naverApiHubKeyId': pickSettingValue");
    expect(settings).toContain("'naverApiHubKey': pickSettingValue");
  });

  it('키 점검기가 중앙 창구를 쓴다 — 두 벌로 나뉘면 또 어긋난다', () => {
    const checker = read('src/core/api-key-checker.ts');
    expect(checker).toContain('naver-search-client');
    expect(checker).not.toContain("'https://openapi.naver.com/v1/search/news.json?query=테스트&display=1'");
  });
});
