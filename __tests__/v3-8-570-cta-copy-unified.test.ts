/**
 * v3.8.570 — CTA 버튼과 후킹을 한 몸으로 (사장님 지적)
 *
 * 보고: "CTA 후킹이 여전히 제목이 붙는데 연동시킬 사이트를 wetax면 위택스 바로가기
 *        이런식으로 해야되지 않니?? 지금 버튼생성이랑 후킹생성이랑 몇가지 따로노는것같은데
 *        하나로 통합시켜"
 *
 * 발행된 글에서 실제로 확인한 것(2026-08-28 leadernam.com 실측):
 *
 *   5310  훅  "오피스텔 이미 샀다면, 8·26 취득세 감면안 소급되나요? 관련 공식 사이트에서…"
 *         버튼 "🔗 위택스 바로가기"          ← 훅은 제목, 버튼은 목적지
 *   5307  훅  "절차 관련 공식 정보를 확인하세요👇"   ← 긴 제목이 잘려 남은 조각
 *   5295  훅  "2026년 12대 중과실 교통사고 형사합의금 적정 기준 (…) 관련 공식 정보를…"
 *
 * 원인은 generation.ts 의 **바로 옆줄**이었다:
 *     btnText  = `🔗 ${catalogLink.name} 바로가기`      // 목적지
 *     hookText = `${keyword} 관련 공식 정보를 확인하세요.`  // 제목
 *
 * 그리고 OFFICIAL_FALLBACK_SITES 표에는 주소만 있고 **사이트 이름이 없어서**
 * 훅도 버튼도 제목을 갖다 쓸 수밖에 없었다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildCtaCopy, siteNameFromUrl, hookEchoesTitle } from '../src/cta/cta-copy';
import { blockBetween, braceBlock } from './helpers/source-block';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

describe('① 주소에서 사이트 이름을 찾는다', () => {
  test.each([
    ['https://www.wetax.go.kr/', '위택스'],
    ['https://www.hometax.go.kr/', '국세청 홈택스'],
    ['https://www.fss.or.kr', '금융감독원'],
    ['https://www.work24.go.kr/', '고용24'],
    ['https://www.gov.kr', '정부24'],
    ['https://www.bokjiro.go.kr', '복지로'],
  ])('%s → %s', (url, name) => {
    expect(siteNameFromUrl(url)).toBe(name);
  });

  test('하위 도메인은 상위 기관으로 올라가 찾는다', () => {
    // fine.fss.or.kr 은 파인(금감원 서비스) — 따로 등록돼 있다
    expect(siteNameFromUrl('https://fine.fss.or.kr/fine/main/main.do')).toBe('금융감독원 파인');
    // 등록 안 된 하위 도메인은 상위 기관 이름으로 떨어진다
    expect(siteNameFromUrl('https://cyber.fss.or.kr/anything')).toBe('금융감독원');
  });

  test('모르는 곳은 지어내지 않고 빈 문자열', () => {
    expect(siteNameFromUrl('https://example.com/foo')).toBe('');
    expect(siteNameFromUrl('not-a-url')).toBe('');
    expect(siteNameFromUrl('')).toBe('');
  });
});

describe('② 버튼과 훅이 같은 목적지를 말한다', () => {
  test('사장님이 말한 그 형태 — wetax 면 "위택스 바로가기"', () => {
    const copy = buildCtaCopy({ url: 'https://www.wetax.go.kr/' });
    expect(copy.buttonText).toBe('🔗 위택스 바로가기');
    expect(copy.hookingMessage).toContain('위택스');
  });

  test('할 일까지 알면 둘 다 그 행동을 말한다', () => {
    const copy = buildCtaCopy({ url: 'https://www.wetax.go.kr/', action: '취득세 조회' });
    expect(copy.buttonText).toBe('위택스에서 취득세 조회');
    expect(copy.hookingMessage).toBe('취득세 조회는 위택스에서 바로 하실 수 있습니다.');
  });

  /** 조사가 틀리면 읽는 사람이 바로 알아챈다 — 받침 유무로 은/는을 고른다 */
  test.each([
    ['취득세 조회', '취득세 조회는'],   // 받침 없음
    ['신청', '신청은'],                // 받침 ㅇ
    ['환급 신청', '환급 신청은'],
    ['예약', '예약은'],
  ])('조사: %s → %s', (action, expected) => {
    const copy = buildCtaCopy({ url: 'https://www.wetax.go.kr/', action });
    expect(copy.hookingMessage.startsWith(expected)).toBe(true);
  });

  test('버튼에 나온 사이트 이름이 훅에도 반드시 나온다', () => {
    for (const url of ['https://www.hometax.go.kr/', 'https://www.fss.or.kr', 'https://www.bokjiro.go.kr']) {
      const copy = buildCtaCopy({ url });
      const site = siteNameFromUrl(url);
      expect(copy.buttonText).toContain(site);
      expect(copy.hookingMessage).toContain(site);
    }
  });

  test('문서(PDF·HWP)는 성격이 달라 문서 문구를 그대로 쓴다', () => {
    const copy = buildCtaCopy({
      url: 'https://www.gov.kr/a.pdf',
      doc: { buttonText: '📥 PDF 다운받기', hookingMessage: 'PDF 를 받아 확인하세요.' },
    });
    expect(copy.buttonText).toBe('📥 PDF 다운받기');
    expect(copy.hookingMessage).toBe('PDF 를 받아 확인하세요.');
  });

  /**
   * v3.8.586 정정 — 훅이 "확인하세요"로 끝나면 안 된다.
   *
   * 그 문구가 실속 게이트의 **회피(deferral)** 로 잡힌다. 실제 발행글에서
   * "워크넷 공식 사이트에서 바로 확인하세요."가 섹션 한복판에 박혀 있었고,
   * 독자에겐 문맥 없는 명령문이었다. 지금은 **거기 무엇이 있는지**를 말한다.
   */
  test('아무것도 모르면 무난한 문구 — 빈 값이나 깨진 문장은 안 나온다', () => {
    const copy = buildCtaCopy({ url: 'https://unknown-site.example/x' });
    expect(copy.buttonText).toBe('🔗 공식 사이트 바로가기');
    expect(copy.hookingMessage).toBe('운영 기관의 원문 안내로 이어집니다.');
    expect(copy.hookingMessage).not.toContain('확인하세요');
  });

  /** 이게 핵심 불변식이다 — 어떤 입력이든 훅에 글 제목이 안 들어간다 */
  test('훅에 글 제목이 섞일 자리가 없다 (제목을 아예 안 받는다)', () => {
    const cases = [
      { url: 'https://www.wetax.go.kr/' },
      { url: 'https://www.fss.or.kr', action: '분쟁조정 신청' },
      { url: 'https://nowhere.example/' },
    ];
    const title = '오피스텔 이미 샀다면, 8·26 취득세 감면안 소급되나요?';
    for (const input of cases) {
      const copy = buildCtaCopy(input);
      expect(hookEchoesTitle(copy.hookingMessage, title)).toBe(false);
    }
  });
});

describe('③ 제목을 되풀이하는 훅을 잡아낸다', () => {
  const title = '오피스텔 이미 샀다면, 8·26 취득세 감면안 소급되나요?';

  test('실제로 나갔던 나쁜 훅을 잡는다', () => {
    expect(hookEchoesTitle(`${title} 관련 공식 사이트에서 정확한 정보를 확인하세요`, title)).toBe(true);
  });

  test('제목 앞부분만 옮겨 적은 것도 잡는다 (잘려 나온 조각)', () => {
    expect(hookEchoesTitle('오피스텔 이미 샀다면 관련 공식 정보를 확인하세요.', title)).toBe(true);
  });

  test('보험 글의 실제 사례', () => {
    const t = '보험금 청구가 서류 미비로 반려됐을 때 재청구 방법과 소멸시효 3년이 새로 시작되는지';
    expect(hookEchoesTitle(`${t} 관련 공식 정보를 확인하세요.`, t)).toBe(true);
  });

  test('멀쩡한 훅은 건드리지 않는다', () => {
    expect(hookEchoesTitle('위택스 공식 사이트에서 바로 확인하세요.', title)).toBe(false);
    // 본문에서 뽑은 훅 (5313 실물 — 이건 좋은 것이라 살려야 한다)
    expect(hookEchoesTitle(
      '행정처분 통지서를 받으셨다면 고용24에서 온라인 심사청구서를 제출해 소명할 수 있습니다.',
      '실업급여 부정수급이 아닌데 반환 통보를 받았다면',
    )).toBe(false);
  });

  test('빈 값에 걸려 넘어지지 않는다', () => {
    expect(hookEchoesTitle('', title)).toBe(false);
    expect(hookEchoesTitle('아무 문장', '')).toBe(false);
  });
});

describe('④ 문구를 만드는 자리가 전부 한 창구를 지난다', () => {
  const gen = read('src/core/final/generation.ts');
  const orch = read('src/core/final/orchestration.ts');

  test('제목을 훅에 박던 템플릿이 사라졌다', () => {
    expect(gen).not.toContain('${keyword} 관련 공식 정보를 확인하세요');
    expect(gen).not.toContain('${keyword} 관련 공식 사이트에서 정확한 정보를 확인하세요');
    expect(gen).not.toContain('🔗 ${keyword} 공식 사이트');
    expect(gen).not.toContain('${shortKeyword2}에 대해 더 알아보세요');
    expect(orch).not.toContain('${keyword} 핵심 정보 바로가기');
  });

  test('폴백 경로들이 buildCtaCopy 를 쓴다', () => {
    expect(gen).toContain("import { buildCtaCopy } from '../../cta/cta-copy'");
    // 카탈로그 · 매핑 폴백 · 크롤 공식 · CSE 폴백
    expect((gen.match(/buildCtaCopy\(/g) || []).length).toBeGreaterThanOrEqual(5);
  });

  test('마지막 문에 그물이 있다 — 새 경로가 생겨도 제목 훅은 못 나간다', () => {
    expect(orch).toContain("import { buildCtaCopy, hookEchoesTitle } from '../../cta/cta-copy'");
    expect(orch).toContain('hookEchoesTitle(hookingMessage, articleTitle)');
    // 버튼도 같이 맞춘다 — 둘이 따로 놀면 안 된다
    expect(orch).toContain('if (hookEchoesTitle(buttonText, articleTitle)) buttonText = repaired.buttonText;');
  });

  test('그물에 글 제목이 실제로 전달된다 (배선 확인)', () => {
    // 인자를 만들어 놓고 안 넘기면 그물이 늘 비활성이다 — 이 저장소의 단골 실수
    const calls = orch.match(/toRenderableCtaCandidate\(c, fb\.hookingMessage, fb\.buttonText, [^)]*keyword\)/g) || [];
    expect(calls.length).toBe(2);
  });
});

describe('⑤ 편집기에서 손으로 버튼 넣기', () => {
  const main = read('electron/main.ts');
  const editor = read('electron/ui/modules/editor.js');
  const orch = read('src/core/final/orchestration.ts');

  test('발행 때 쓰는 렌더러를 열어 둔다 (HTML 을 두 벌 적지 않는다)', () => {
    expect(orch).toContain('export function renderFinalCtaBlock(');
  });

  test('IPC 두 개가 실제로 등록돼 있다', () => {
    expect(main).toContain("ipcMain.handle('cta-render-block'");
    expect(main).toContain("ipcMain.handle('cta-suggest-copy'");
  });

  test('IPC 가 같은 렌더러·같은 문구 창구를 쓴다', () => {
    const handler = blockBetween(main, "ipcMain.handle('cta-render-block'", "ipcMain.handle('cta-suggest-copy'");
    /**
     * v3.8.689 — `src/` → `dist/`. 이 테스트는 **깨진 주소를 정답으로 굳히고 있었다.**
     * 실측: `src/cta/` 에는 `.ts` 만 있어서 이 핸들러는 출시 이후 줄곧
     * "Cannot find module" 로 죽어 있었다(🔘 버튼이 눌러도 안 되던 이유).
     * 문자열만 맞춰 보면 죽은 기능도 통과한다 — 그래서 v3.8.688b 에
     * "그 .js 가 실제로 있는가"를 파일로 확인하는 테스트를 따로 뒀다.
     */
    expect(handler).toContain("require('../dist/core/final/orchestration')");
    expect(handler).toContain("require('../dist/cta/cta-copy')");
    expect(handler).toContain('renderFinalCtaBlock({');
    // 손으로 적은 문구가 자동 문구를 이긴다
    expect(handler).toContain("String(payload?.buttonText || '').trim() || auto.buttonText");
    expect(handler).toContain("String(payload?.hook || '').trim() || auto.hookingMessage");
  });

  test('주소 검증을 통과 못 하면 버튼을 만들지 않는다', () => {
    const handler = blockBetween(main, "ipcMain.handle('cta-render-block'", "ipcMain.handle('cta-suggest-copy'");
    expect(handler).toContain('/^https?:\\/\\//i.test(url)');
  });

  test('툴바 버튼이 있고 배선돼 있다', () => {
    expect(editor).toContain('id="veInsertCtaBtn"');
    expect(editor).toContain("querySelector('#veInsertCtaBtn')");
    expect(editor).toContain("invoke('cta-render-block'");
  });

  /**
   * 삽입 계열 버튼은 mousedown 을 막아야 한다 — 안 막으면 누르는 순간 iframe 안
   * 선택이 풀려 글 끝에 붙는다(v3.8.482 에서 이미 겪은 문제).
   */
  test('커서 위치를 잃지 않게 mousedown 가드에 들어 있다', () => {
    expect(editor).toContain("'#veInsertImageBtn, #veInsertAdBtn, #veInsertCtaBtn'");
  });

  test('입력 모달이 주소·버튼문구·훅 세 가지를 돌려준다', () => {
    const fn = braceBlock(editor, 'function askCtaDetails()');
    expect(fn).toContain('id="veCtaUrl"');
    expect(fn).toContain('id="veCtaBtnText"');
    expect(fn).toContain('id="veCtaHook"');
    // 주소를 넣는 순간 어디로 가는지 알려준다
    expect(fn).toContain("invoke('cta-suggest-copy'");
    expect(fn).toContain('siteHint.textContent');
  });

  test('편집기가 CTA HTML 을 자기 손으로 조립하지 않는다', () => {
    // class="cta-box" 를 UI 에서 만들기 시작하면 생성된 버튼과 갈라진다
    expect(editor).not.toContain('class="cta-box"');
    expect(editor).not.toContain('class="cta-btn"');
  });

  test('표시용 껍데기는 발행 HTML 에 안 남는다', () => {
    const handlerBlock = blockBetween(editor, "querySelector('#veInsertCtaBtn')", 'setStatus(atCaret');
    expect(handlerBlock).toContain('bgpt-cta-new');
    expect(handlerBlock).toContain('el.replaceWith(...el.childNodes)');
  });
});
