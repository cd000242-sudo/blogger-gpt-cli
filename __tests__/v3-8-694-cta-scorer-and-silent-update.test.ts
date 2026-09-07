/**
 * v3.8.694 — CTA 채점기 · 조용한 자동 설치 · 로그인 화면 디자인
 *
 * 사장님: "고쳐주고 자동으로 업데이트가 되면 마법사가 뜰필요없고 안되는상황이면
 *          자동으로 마법사가뜨도록해 디자인4건 수정해 CTA채점기도 작업하고"
 *
 * ## 채점기가 왜 틀렸나 — 실측(2026-09-07)이 셋을 나란히 잡았다
 * 안내문 · 게시판 목록 · 보도자료가 모두 "행동 화면(action)" 으로 뽑혔다.
 * 세 페이지 다 **신청 문구가 하나도 없는데** `<form>` 하나로 +2점을 받았고,
 * 그 form 은 전부 **사이트 검색창**이었다.
 * 게다가 글에서 행동을 못 읽으면 홈만 아니면 무엇이든 action 이었다(보도자료 = action 0점).
 */
import * as fs from 'fs';
import * as path from 'path';
import { scoreActionPage, looksLikeListingPage } from '../src/cta/action-link-harness';
import { gateCtaDestination } from '../src/cta/destination-gate';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const page = (html: string) => async (url: string) => ({ ok: true, html, finalUrl: url });

describe('① 검색창은 "행동 화면" 증거가 아니다', () => {
  const base = { url: 'https://x.go.kr/deep/page.do', keyword: '근로장려금 신청', intent: '신청' as const };

  test('⭐ 검색창만 있는 페이지는 양식 점수를 못 받는다', () => {
    const html = '<html><body><h1>제도 안내</h1>'
      + '<form action="/search"><input type="text" name="searchKeyword"><button type="submit">검색</button></form>'
      + '</body></html>';
    const s = scoreActionPage({ ...base, html });
    expect(s.reasons.join(' ')).toContain('행동 요소 없음');
  });

  test('⭐ 진짜 신청 양식은 예전처럼 점수를 받는다', () => {
    const html = '<html><body><form action="/apply"><input name="applicantName"><button type="submit">제출</button></form></body></html>';
    const s = scoreActionPage({ ...base, html });
    expect(s.reasons.join(' ')).toContain('입력 양식 있음');
  });

  test('검색창과 신청 양식이 함께 있으면 인정한다', () => {
    const html = '<html><body>'
      + '<form action="/search"><input name="query"></form>'
      + '<form action="/apply"><input name="birth"><button type="submit">제출</button></form>'
      + '</body></html>';
    expect(scoreActionPage({ ...base, html }).reasons.join(' ')).toContain('입력 양식 있음');
  });
});

describe('② 목록·보도자료는 읽을 거리이지 할 거리가 아니다', () => {
  test('⭐ 제목이 말해 주면 잡는다', () => {
    expect(looksLikeListingPage('https://www.imsil.go.kr/board/list.imsil?boardId=BBS_1', '소통·참여 > 임실소식 목록 페이지')).toBe(true);
  });

  test('⭐ 제목이 기관명뿐이면 본문으로 잡는다 (실측: 고용노동부 보도자료)', () => {
    const body = '보도자료 상세 보도자료 목록 보도자료 배포 담당부서';
    expect(looksLikeListingPage('https://www.moel.go.kr/news/enews/report/enewsView.do?news_seq=1', '고용노동부', body)).toBe(true);
  });

  test('⭐⭐ 주소만으로 단정하지 않는다 — 금감원 민원신청이 bbs/list.do 다', () => {
    // 이 저장소가 직접 고른 올바른 목적지. 주소만 봤으면 버렸을 것이다.
    expect(looksLikeListingPage(
      'https://www.fss.or.kr/fss/bbs/B0000313/list.do?menuNo=201099&viewType=MINWONBODY',
      '금융감독원 민원신청',
      '민원신청 유사사례 검토 자주하는 질문',
    )).toBe(false);
  });

  test('본문에 한두 번 나오는 "보도자료"(메뉴)로는 잡지 않는다', () => {
    expect(looksLikeListingPage('https://x.go.kr/board/list.do', '신청 화면', '메뉴: 보도자료 공지사항')).toBe(false);
  });

  test('⭐ 게이트가 목록을 demote 한다', async () => {
    const v = await gateCtaDestination({
      url: 'https://www.imsil.go.kr/board/list.imsil?boardId=BBS_1',
      keyword: '임실형 농어촌 기본소득 신청',
      intent: '신청',
      agencies: [],
      fetchPage: page('<html><title>군정소식 목록 페이지</title><body>임실 기본소득 신청 목록</body></html>'),
    });
    expect(v.ok).toBe(false);
    expect((v as any).reasons[0]).toContain('게시판 목록');
  });
});

describe('③ 행동을 못 읽었으면 "행동 화면" 이라 말하지 않는다', () => {
  test('⭐ 주제어가 없으면 action 이 아니라 guide 다 (보도자료가 action 0점이던 구멍)', async () => {
    const v = await gateCtaDestination({
      url: 'https://www.moel.go.kr/deep/page.do',
      keyword: '성과급 요구 파업 불법 기준',
      intent: null,
      agencies: [],
      fetchPage: page('<html><title>고용노동부</title><body>전혀 다른 내용</body></html>'),
    });
    expect(v.ok).toBe(true);
    expect((v as any).stage).toBe('guide');
    expect((v as any).reasons[0]).toContain('근거가 없다');
  });

  test('주제어가 있으면 예전처럼 action 이다', async () => {
    const v = await gateCtaDestination({
      url: 'https://www.kma.go.kr/deep/forecast.do',
      keyword: '장마 기간 예보',
      intent: null,
      agencies: [],
      fetchPage: page('<html><title>기상청</title><body>장마 기간 예보를 안내합니다</body></html>'),
    });
    expect(v.ok).toBe(true);
    expect((v as any).stage).toBe('action');
  });
});

describe('④ 자동 업데이트 — 조용히 깔고, 안 되면 마법사', () => {
  const updater = read('electron/updater.ts');
  const auto = updater.slice(updater.indexOf("updater.on('update-downloaded'"));

  test('⭐ 먼저 조용한 설치를 건다', () => {
    expect(auto.slice(0, 3500)).toContain('quitAndInstall(true, true)');
  });

  test('⭐ 안 되면 마법사로 물러선다', () => {
    const head = auto.slice(0, 3500);
    expect(head).toContain('quitAndInstall(false, true)');
    expect(head.indexOf('quitAndInstall(true, true)')).toBeLessThan(head.indexOf('quitAndInstall(false, true)'));
  });

  test('⭐ 성공하면 폴백이 뜨지 않는다 — 시간이 지난 뒤에만', () => {
    /**
     * 조용한 설치가 되면 그 전에 앱이 종료되므로 뒤 타이머는 실행되지 않는다.
     * v3.8.702 에서 대기 시간이 6초 → 8초로 늘고, 폴백이 마법사에서
     * **[지금 재시작]/[나중에] 대화상자**로 바뀌었다(사장님: "그게 안먹히면 버튼두개를 띄우라고").
     * 그래서 여기서는 초 단위를 박아 두지 않고 **폴백이 나중에 온다는 것**만 본다.
     */
    const head = auto.slice(0, 4000);
    expect(head.indexOf('quitAndInstall(true, true)')).toBeLessThan(head.indexOf('setTimeout(async () =>'));
    expect(head).toMatch(/\}, \d{4}\);/);
  });

  test('둘 다 실패하면 앱을 계속 쓸 수 있게 둔다', () => {
    expect(auto.slice(0, 3500)).toContain('isUpdateInProgress = false');
  });
});

describe('⑤ 로그인 화면 디자인', () => {
  const login = read('electron/ui/login-window.html');

  test('⭐ 보라색 후광이 없다', () => {
    expect(login).not.toContain('0 0 100px rgba(99, 102, 241');
    expect(login).not.toContain('0 10px 40px rgba(99, 102, 241, 0.4)');
    expect(login).not.toContain('0 8px 24px rgba(16, 185, 129, 0.3)');
  });

  test('초점 링은 남긴다 — 접근성 장치이지 장식이 아니다', () => {
    expect(login).toContain('box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15)');
  });

  test('⭐ 바운스·일래스틱 이징이 없다', () => {
    expect(login).not.toContain('cubic-bezier(0.68, -0.55, 0.265, 1.55)');
    expect(login).not.toContain('welcomeBounce');
  });

  test('⭐ 장식용 격자 배경이 없다 (고아 keyframes 도 남기지 않았다)', () => {
    expect(login).not.toContain('background-size: 50px 50px');
    expect(login).not.toContain('gridMove');
  });

  test('⭐ 진행바가 레이아웃(width) 대신 transform 을 움직인다', () => {
    expect(login).toContain('transition:transform 0.3s ease');
    expect(login).toContain("upBar.style.transform = 'scaleX(");
    expect(read('electron/updater.ts')).toContain("style.transform='scaleX(");
  });
});

describe('⑥ 리다이렉트에 흔들리지 않는다 (실측 사례)', () => {
  test('⭐ 정책브리핑 보도자료 — /news/ 가 /briefing/ 으로 옮겨가도 잡는다', () => {
    // 실측: korea.kr/news/pressReleaseView.do → korea.kr/briefing/pressReleaseView.do
    const title = '변화하는 전장 속 윤리·법률 이슈 대응책 모색 - 보도자료 | 브리핑룸 | 대한민국 정책브리핑';
    expect(looksLikeListingPage('https://www.korea.kr/briefing/pressReleaseView.do?newsId=1', title)).toBe(true);
  });

  test('화면 이름(…View.do)만으로는 잡지 않는다 — 제목이나 본문이 함께 말해야 한다', () => {
    expect(looksLikeListingPage('https://www.korea.kr/briefing/pressReleaseView.do?newsId=1', '근로장려금 신청')).toBe(false);
  });
});
