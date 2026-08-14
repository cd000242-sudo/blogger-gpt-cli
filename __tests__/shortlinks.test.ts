/**
 * 단축링크 — v3.8.500
 *
 * 실제 생성은 사장님 사이트를 건드리므로 테스트하지 않는다.
 * 여기서 지키는 것은 "조용히 틀리지 않는가" 다.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  normalizeSlug, isMeaningfulSlug, suggestSlug, dedupeSlug, toCreateBody, toShortLink,
} from '../src/wordpress/pretty-links';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');

describe('단축 주소 다듬기', () => {
  it('한글은 주소에서 부풀기만 하므로 남기지 않는다', () => {
    expect(normalizeSlug('청년적금')).toBe('');
    expect(normalizeSlug('보험금-claim')).toBe('claim');
  });

  it('영문·숫자·하이픈만 남기고 정리한다', () => {
    expect(normalizeSlug('  Claim__Denial!! ')).toBe('claim-denial');
    expect(normalizeSlug('--a--b--')).toBe('a-b');
  });

  it('너무 길면 자른다 — 단축인데 길면 뜻이 없다', () => {
    expect(normalizeSlug('a'.repeat(80)).length).toBe(48);
  });

  it('무작위 4글자와 뜻있는 말을 가른다', () => {
    expect(isMeaningfulSlug('refund-2026')).toBe(true);
    expect(isMeaningfulSlug('ab')).toBe(false);
    expect(isMeaningfulSlug('1234')).toBe(false);   // 플러그인 자동생성 같은 것
  });
});

describe('제목에서 주소 제안', () => {
  it('사이트가 다루는 말을 영문으로 바꾼다', () => {
    expect(suggestSlug('실손보험 지급 거절 통지받았다면')).toContain('silson');
    expect(suggestSlug('실손보험 지급 거절 통지받았다면')).toContain('denied');
  });

  it('연도를 살린다 — 해가 바뀌면 다른 글이다', () => {
    expect(suggestSlug('연말정산 환급 2026년 기준')).toContain('2026');
  });

  it('같은 제목이면 항상 같은 주소가 나온다 (AI 를 안 쓰는 이유)', () => {
    const a = suggestSlug('양도소득세 예정신고 기한');
    const b = suggestSlug('양도소득세 예정신고 기한');
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('사전에 하나도 안 걸리면 글 번호로 대신한다', () => {
    expect(suggestSlug('ㅁㄴㅇㄹ', 5026)).toBe('post-5026');
    expect(suggestSlug('ㅁㄴㅇㄹ')).toBe('');
  });
});

describe('중복 비켜가기', () => {
  it('이미 쓰는 주소면 숫자를 붙인다', () => {
    expect(dedupeSlug('refund', ['refund'])).toBe('refund-2');
    expect(dedupeSlug('refund', ['refund', 'refund-2'])).toBe('refund-3');
  });

  it('안 겹치면 그대로 둔다', () => {
    expect(dedupeSlug('refund', ['other'])).toBe('refund');
  });
});

describe('플러그인에 보내는 본문', () => {
  const body = toCreateBody({ slug: 'Claim Denial', url: 'https://x.test/a', name: '테스트' });

  it('실측으로 확인한 필드 이름만 쓴다', () => {
    expect(Object.keys(body).sort()).toEqual(
      ['name', 'new_window', 'nofollow', 'param_forwarding', 'redirect_type', 'slug', 'sponsored', 'track_me', 'url'].sort(),
    );
  });

  it('기본은 307 — 301 로 만들면 나중에 목적지를 못 바꾼다', () => {
    expect(body['redirect_type']).toBe('307');
  });

  it('클릭 추적을 켠다 — 꺼두면 어느 글이 유입을 만드는지 못 본다', () => {
    expect(body['track_me']).toBe(1);
  });

  it('제휴링크면 nofollow·sponsored 를 같이 켠다 — 구글이 요구한다', () => {
    const aff = toCreateBody({ slug: 'x', url: 'u', nofollow: true, sponsored: true });
    expect(aff['nofollow']).toBe(1);
    expect(aff['sponsored']).toBe(1);
  });

  it('보내기 전에 주소를 다듬는다', () => {
    expect(body['slug']).toBe('claim-denial');
  });
});

describe('응답 읽기', () => {
  it('플러그인 필드를 우리 모양으로 옮긴다', () => {
    const l = toShortLink({
      id: 39, slug: '67gu', url: 'https://x/a', name: '일상생활배상책임',
      redirect_type: '307', clicks: 12, uniques: 9, pretty_url: 'https://x/67gu',
    });
    expect(l).toMatchObject({ id: 39, slug: '67gu', clicks: 12, uniques: 9, prettyUrl: 'https://x/67gu' });
  });

  it('pretty_url 이 없으면 사이트 주소로 만들어 준다', () => {
    expect(toShortLink({ slug: 'abc' }, 'https://leadernam.com/').prettyUrl)
      .toBe('https://leadernam.com/abc');
  });
});

describe('배선 — 만들고 아무도 안 부르면 조용히 죽는다', () => {
  it('IPC 5개가 main 에 등록돼 있다', () => {
    const m = read('electron/main.ts');
    ['shortlink:list', 'shortlink:create', 'shortlink:update', 'shortlink:suggest', 'shortlink:top']
      .forEach((ch) => expect(m).toContain(`ipcMain.handle('${ch}'`));
  });

  it('preload 가 렌더러에 노출한다', () => {
    const p = read('electron/preload.ts');
    ['shortlinkList', 'shortlinkCreate', 'shortlinkUpdate', 'shortlinkSuggest', 'shortlinkTop']
      .forEach((fn) => expect(p).toContain(`${fn}: (args) => ipcRenderer.invoke(`));
  });

  it('사이드탭에 단축링크와 카드뉴스가 있다', () => {
    const s = read('electron/ui/modules/sidebar.js');
    expect(s).toContain("label: '단축링크'");
    expect(s).toContain("label: '카드뉴스'");
  });

  it('showTab 이 두 탭을 알고, 최상위 탭 목록에도 들어 있다', () => {
    const u = read('electron/ui/modules/ui.js');
    expect(u).toContain("case 'shortlinks':");
    expect(u).toContain("case 'cardnews':");
    expect(u).toContain("'shortlinks-tab',");
    expect(u).toContain("'cardnews-tab',");
  });

  it('탭 컨테이너가 실제로 존재한다 — 없는 id 를 읽으면 조용히 무효다', () => {
    const h = read('electron/ui/index.html');
    expect(h).toContain('id="shortlinks-tab"');
    expect(h).toContain('id="cardnews-tab"');
  });

  it('카드뉴스는 더 이상 외부유입 서브탭이 아니다', () => {
    const h = read('electron/ui/index.html');
    expect(h).not.toContain('extTrafficSubtab-cardnews');
    expect(h).not.toContain(`data-subtab="cardnews"`);
    const et = read('electron/ui/modules/external-traffic.js');
    // 서브탭 목록과 컨테이너 배선이 없어야 한다 (주석에 이름이 남는 건 상관없다)
    expect(et).not.toMatch(/const all = \[[^\]]*cardnews/);
    expect(et).not.toContain('extTrafficSubtab-cardnews');
    expect(read('electron/ui/modules/cardnews.js')).toContain("getElementById('cardnews-tab')");
  });
});
