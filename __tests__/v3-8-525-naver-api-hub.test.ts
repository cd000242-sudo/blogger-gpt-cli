/**
 * v3.8.525 — 네이버 API 개편 대응 (2026-06-25 NAVER API HUB 출시)
 *
 * 실측(2026-08-18, 우리 키):
 *   블로그·뉴스·웹문서·지식iN·카페글·데이터랩 → 200 OK (살아 있음)
 *   쇼핑 검색(shop.json)                    → 404 SE05 "존재하지 않는 검색 api"
 *
 * 확정 사실:
 *   · 쇼핑·책·전문자료 검색 API 는 2026-07-31 완전 종료, 공식 대체 없음
 *   · 나머지 검색 API·Search Trend 는 네이버클라우드 NAVER API HUB 로 이관
 *   · **신규 발급은 API HUB** — 기존 개발자센터 키를 그대로 옮겨 쓰는 방식이 아니다
 *   · 이관 신청자는 기존 방식 2027-06-30 까지 유예
 *
 * 그래서 앱이 고쳐야 할 것:
 *   ① 새 사용자에게 죽은 발급처(개발자센터)를 안내하면 키를 못 받는다 → API HUB 안내
 *   ② 키가 막혔을 때 "네이버 API 오류 (401)" 만 띄우면 사용자는 뭘 할지 모른다 → 처방 제시
 *   ③ 종료된 쇼핑 검색 API 호출 코드가 남아 있으면 누군가 다시 배선한다 → 제거
 */
import * as fs from 'fs';
import * as path from 'path';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const API_HUB = 'ncloud.com/product/applicationService/naverApiHub';

describe('① 키 발급 안내는 새 발급처(API HUB)를 가리킨다', () => {
  it('환경설정의 네이버 키 발급 링크가 API HUB 다', () => {
    const html = read('electron/ui/index.html');
    const line = html.split('\n').find((l) => l.includes("'naver':") && l.includes('http'));
    expect(line).toBeTruthy();
    expect(line).toContain(API_HUB);
    expect(line).not.toContain('developers.naver.com/apps/#/register');
  });

  it('"네이버 API 페이지 열기" 도 API HUB 로 간다', () => {
    const ui = read('electron/ui/modules/ui.js');
    const fn = ui.slice(ui.indexOf('export function openNaverApiPage'), ui.indexOf('export function openNaverApiPage') + 700);
    expect(fn).toContain(API_HUB);
    expect(fn).not.toContain('developers.naver.com');
  });

  it('가이드가 개편 사실과 유예 시한을 알려준다 — 모르면 갑자기 끊긴다', () => {
    const guide = read('electron/ui/modules/guide.js');
    const naver = guide.slice(guide.indexOf("'naver-api': {"), guide.indexOf("'naver-api': {") + 9000);
    expect(naver).toContain('API HUB');
    expect(naver).toContain('2027');          // 기존 키 유예 시한
    expect(naver).toMatch(/쇼핑.*종료|종료.*쇼핑/); // 쇼핑 검색은 부활 없음
  });
});

describe('② 키가 막히면 무엇을 해야 하는지 알려준다', () => {
  // v3.8.526: 문구 생성은 중앙 창구로 옮겼다 — 두 벌이면 어긋나므로 한 곳만 본다
  const client = read('src/core/naver-search-client.ts');
  const checker = read('src/core/api-key-checker.ts');

  it('401·403 은 "키 문제"로, 404 는 "종료된 API"로 구분해 안내한다', () => {
    expect(client).toContain('describeNaverFailure');
    expect(client).toMatch(/401/);
    expect(client).toMatch(/404/);
  });

  it('안내에 새 발급처가 들어 있다 — 처방 없는 진단은 사용자를 헤매게 한다', () => {
    expect(client).toContain('네이버클라우드');
    expect(client).toContain('API HUB');
  });

  it('점검기가 상태코드만 던지지 않는다 (중앙 창구 문구를 쓴다)', () => {
    expect(checker).toContain('describeNaverFailure');
    // 옛 코드: 상태코드만 담아 던졌다 — 사용자가 할 수 있는 게 없었다
    expect(checker).not.toContain('네이버 API 오류 (${response.status})');
    // 점검도 중앙 창구로 나가야 HUB 키를 넣었을 때 옛 주소로 헛다리 짚지 않는다
    expect(checker).toContain("naverSearch('news'");
  });
});

describe('③ 종료된 쇼핑 검색 API 는 코드에서 사라졌다', () => {
  it('shop.json 을 호출하는 코드가 없다 — 실측 404, 대체 API 없음', () => {
    const roots = ['src', 'electron'];
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(path.join(__dirname, '..', dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          if (/node_modules|\.git/.test(entry.name)) continue;
          walk(rel);
        } else if (/\.(ts|js)$/.test(entry.name)) {
          // 주석에 사고 기록은 남기되, 실제 호출 URL 은 없어야 한다
          if (read(rel).includes("'https://openapi.naver.com/v1/search/shop.json'")) hits.push(rel);
        }
      }
    };
    roots.forEach(walk);
    expect(hits).toEqual([]);
  });

  it('쇼핑 모드는 브라우저 크롤링이라 개편과 무관하다 (회귀 방지)', () => {
    const crawler = read('src/utils/shopping-crawler.js');
    expect(crawler).not.toContain('openapi.naver.com');
    expect(crawler).toContain('search.shopping.naver.com');
  });
});
