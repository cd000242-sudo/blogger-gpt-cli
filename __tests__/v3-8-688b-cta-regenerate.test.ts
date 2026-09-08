/**
 * v3.8.688b — 편집기의 "🔗 CTA 다시 생성"
 *
 * 사장님: "미리보기 수정에서도 글 다시 생성이랑 이미지 다시 생성 옆에 CTA 다시 생성을 추가해"
 *
 * 계기: 하지정맥류 실손 입원 거절 글의 버튼이 "금융감독원에서 신청하기"인데 주소는
 * 민원 **조회** 인증 화면이었다. 본문은 멀쩡했으므로 글을 통째로 다시 만들 이유가 없다.
 *
 * ## 이 기능이 지켜야 할 약속 둘
 *   ① 못 찾으면 **기존 버튼을 그대로 둔다** — 틀린 버튼보다 나쁜 건 버튼이 사라지는 것이다.
 *   ② 목적지를 코드에 박지 않는다 — AI 가 이름을 정하고, 검색이 주소를 찾고, 게이트가 검산한다.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { regenerateCta } from '../src/cta/regenerate';
import { configureAgencyRegistry, learnAgency } from '../src/cta/agency-registry';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

// 기관 사전이 검색·학습을 하므로 사장님의 실제 학습 파일(~/.blogger-gpt)에 시험 값이 섞이지 않게 tmp 를 쓴다
let tmpDir = '';
beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cta-regen-'));
  configureAgencyRegistry({ storePath: path.join(tmpDir, 'registry.json') });
});
afterAll(() => {
  configureAgencyRegistry({ storePath: null });
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/** 실측한 금감원 민원조회 화면 (v3.8.688 테스트와 같은 자료) */
const 조회벽 = '<html><title>금융감독원 민원신청</title><body>'
  + '민원접수번호 주민등록번호 성명 비밀번호 가상키패드 사용 '
  + '접수하신 민원에 대한 결과를 확인할 수 있습니다. 비밀번호 생성 및 찾기'
  + '</body></html>';

const 요양급여기준화면 = '<html><title>요양급여 적용기준</title><body>'
  + '<h1>하지정맥류 요양급여 적용기준</h1>'
  + '<p>하지정맥류 수술의 입원 인정 기준을 조회하실 수 있습니다. 조회하기</p>'
  + '<form><button type="submit">조회</button></form></body></html>';

const 본문 = '하지정맥류 수술 후 실손보험 입원 거절을 당했습니다. '
  + '건강보험심사평가원의 요양급여 적용기준에서 입원 인정 여부가 갈립니다. '
  + '건강보험심사평가원 기준을 먼저 확인해야 합니다.';

const 제목 = '하지정맥류 실손 입원 거절 조회';

const fetcherFor = (map: Record<string, string>) => async (url: string) => ({
  ok: map[url] !== undefined,
  html: map[url] || '',
  finalUrl: url,
});

describe('CTA 다시 생성 — 글을 읽고 목적지를 새로 고른다', () => {
  test('⭐ 이 글에 맞는 화면을 고른다', async () => {
    const r = await regenerateCta({
      keyword: 제목,
      articleText: 본문,
      search: async () => [
        { url: 'https://www.hira.or.kr/rc/insu/basic.do', title: '요양급여 적용기준' },
      ],
      fetchPage: fetcherFor({ 'https://www.hira.or.kr/rc/insu/basic.do': 요양급여기준화면 }),
    });
    expect(r.ok).toBe(true);
    expect(r.picked?.url).toBe('https://www.hira.or.kr/rc/insu/basic.do');
  });

  test('⭐ 조회 벽은 고르지 않는다 (이번 사고의 그 화면)', async () => {
    const r = await regenerateCta({
      keyword: 제목,
      articleText: 본문,
      search: async () => [
        { url: 'https://www.fss.or.kr/fss/cvpl/ombdsmnDstrss/listCertification.do', title: '금융감독원 민원신청' },
      ],
      fetchPage: fetcherFor({ 'https://www.fss.or.kr/fss/cvpl/ombdsmnDstrss/listCertification.do': 조회벽 }),
    });
    expect(r.ok).toBe(false);
    expect(r.picked).toBeNull();
    expect(r.log.join(' ')).toContain('접수번호');
  });

  test('⭐ 조회 벽을 건너뛰고 다음 후보를 고른다', async () => {
    const r = await regenerateCta({
      keyword: 제목,
      articleText: 본문,
      search: async () => [
        { url: 'https://www.fss.or.kr/fss/cvpl/ombdsmnDstrss/listCertification.do', title: '금융감독원 민원신청' },
        { url: 'https://www.hira.or.kr/rc/insu/basic.do', title: '요양급여 적용기준' },
      ],
      fetchPage: fetcherFor({
        'https://www.fss.or.kr/fss/cvpl/ombdsmnDstrss/listCertification.do': 조회벽,
        'https://www.hira.or.kr/rc/insu/basic.do': 요양급여기준화면,
      }),
    });
    expect(r.ok).toBe(true);
    expect(r.picked?.url).toContain('hira.or.kr');
  });

  test('⭐ 지금 글에 있는 주소는 다시 고르지 않는다 — 그건 "다시 생성"이 아니다', async () => {
    const r = await regenerateCta({
      keyword: 제목,
      articleText: 본문,
      skipUrls: ['https://www.hira.or.kr/rc/insu/basic.do'],
      search: async () => [
        { url: 'https://www.hira.or.kr/rc/insu/basic.do?x=1', title: '요양급여 적용기준' },
      ],
      fetchPage: fetcherFor({ 'https://www.hira.or.kr/rc/insu/basic.do?x=1': 요양급여기준화면 }),
    });
    expect(r.ok).toBe(false);   // 쿼리스트링만 다른 같은 주소다
  });

  test('⭐ 아무것도 못 찾으면 picked 가 null 이다 — 부르는 쪽이 기존 버튼을 지우지 않게', async () => {
    const r = await regenerateCta({
      keyword: 제목,
      articleText: 본문,
      search: async () => [],
      fetchPage: fetcherFor({}),
    });
    expect(r.ok).toBe(false);
    expect(r.picked).toBeNull();
  });

  test('블로그·검색결과는 후보에서 턴다 (열어 보는 시간을 아낀다)', async () => {
    let opened = 0;
    const r = await regenerateCta({
      keyword: 제목,
      articleText: 본문,
      search: async () => [
        { url: 'https://blog.naver.com/someone/12345', title: '하지정맥류 후기' },
        { url: 'https://search.naver.com/search.naver?query=x', title: '검색' },
      ],
      fetchPage: async (u) => { opened++; return { ok: true, html: '', finalUrl: u }; },
    });
    expect(r.ok).toBe(false);
    expect(opened).toBe(0);
  });

  test('검색이 터져도 예외를 던지지 않는다 — 편집기가 멈추면 안 된다', async () => {
    const r = await regenerateCta({
      keyword: 제목,
      articleText: 본문,
      search: async () => { throw new Error('네이버 API 429'); },
      fetchPage: fetcherFor({}),
    });
    expect(r.ok).toBe(false);
    expect(r.log.join(' ')).toContain('검색 실패');
  });

  test('AI 가 정한 목적지가 있으면 그 검색어를 쓴다 — 목적지를 코드에 박지 않는다', async () => {
    const queries: string[] = [];
    await regenerateCta({
      keyword: 제목,
      articleText: 본문,
      smartTarget: {
        site: '건강보험심사평가원', action: '요양급여 기준 조회',
        buttonLabel: '심평원에서 기준 확인', searchQuery: '건강보험심사평가원 요양급여 기준 조회',
      },
      search: async (q) => { queries.push(q); return []; },
      fetchPage: fetcherFor({}),
    });
    expect(queries[0]).toBe('건강보험심사평가원 요양급여 기준 조회');
  });

  test('이 모듈에는 기관 목록도 주소도 없다 (하드코딩 금지)', () => {
    const src = read('src/cta/regenerate.ts');
    const codeOnly = src.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/https?:\/\/[a-z0-9.-]+\.(kr|com|net|org)/i);
  });
});

describe('배선 — 만들고 아무도 안 부르면 조용히 무효다', () => {
  const editor = read('electron/ui/modules/editor.js');
  const main = read('electron/main.ts');

  test('버튼이 실제로 있다 (없는 id 에 거는 실수를 막는다)', () => {
    expect(editor).toContain('id="veRegenCtaBtn"');
  });

  test('그 id 를 modalRefs 가 잡고, 핸들러가 그걸 쓴다', () => {
    expect(editor).toContain("regenCtaBtn: overlay.querySelector('#veRegenCtaBtn')");
    expect(editor).toContain("modalRefs.regenCtaBtn?.addEventListener('click'");
  });

  test('버튼이 대기열·붙여넣기 글에도 보인다 (발행글 전용 묶음이 아니다)', () => {
    const draftWrapIdx = editor.indexOf('id="veDraftWrap"');
    const regenWrapIdx = editor.indexOf('id="veRegenWrap"');
    const btnIdx = editor.indexOf('id="veRegenCtaBtn"');
    expect(btnIdx).toBeGreaterThan(draftWrapIdx);   // veDraftWrap 안에 있다
    expect(draftWrapIdx).toBeGreaterThan(regenWrapIdx);
  });

  test('작업 중에는 다른 버튼과 함께 잠긴다', () => {
    expect(editor).toContain('modalRefs.regenCtaBtn].filter(Boolean)');
  });

  test('메인에 채널이 있다 — UI 만 있고 백엔드가 없으면 조용히 죽는다', () => {
    expect(main).toContain("ipcMain.handle('cta-regenerate'");
    expect(editor).toContain("invoke('cta-regenerate'");
  });

  test('메인이 판단 모듈과 AI 목적지를 실제로 부른다', () => {
    expect(main).toContain("require('../dist/cta/regenerate')");
    expect(main).toContain('regenerateCta({');
    // v3.8.706: "없음"도 판정이라 Decision 을 부른다 (target 만 받던 resolveSmartCtaTarget 은 여기서 안 쓴다)
    expect(main).toContain('resolveSmartCtaDecision({');
  });

  test('⭐ 본문을 통째로 넘긴다 — 이번 사고의 원인이 발췌였다', () => {
    expect(main).toContain('articleText.slice(0, 12000)');
  });

  /**
   * ⭐ v3.8.688 에서 찾은 **출시된 채로 죽어 있던 버그**.
   *
   * 편집기의 🔘 버튼(수동 CTA, v3.8.570)이 이렇게 적혀 있었다:
   *     require('../src/cta/cta-copy')
   * 그런데 `src/cta/` 에는 `.ts` 만 있다 — 컴파일 결과는 `dist/cta/` 로 간다.
   * 즉 버튼을 누를 때마다 "Cannot find module" 이 났고, 화면에는 오류 문구만 떴다.
   * 빌드도 테스트도 이걸 못 잡았다 — require 문자열은 타입 검사를 받지 않는다.
   *
   * 그래서 **주소를 눈으로 보지 말고 실제로 불러 본다.**
   */
  test('⭐ CTA 채널이 부르는 모듈의 .js 가 실제로 있다 (require 문자열은 타입 검사를 안 받는다)', () => {
    /**
     * require() 로 확인하지 않는 이유: jest 리졸버는 `dist/...` 를 `src/*.ts` 원본으로
     * 되돌려 준다(moduleDirectories). 그러면 앱이 실제로 무엇을 읽는지 못 잰다.
     * 앱은 `electron/main.js` 에서 도는 평범한 node 이므로 **파일이 있는지**가 전부다.
     */
    const wanted = [...main.matchAll(/require\('\.\.\/([^']+)'\)/g)]
      .map((m) => m[1])
      .filter((p) => /cta|orchestration/.test(p));
    expect(wanted.length).toBeGreaterThan(0);
    const missing = [...new Set(wanted)].filter((rel) => !fs.existsSync(path.join(root, `${rel}.js`)));
    expect(missing).toEqual([]);
  });

  test('못 찾으면 기존 버튼을 건드리지 않는다', () => {
    const handler = editor.slice(editor.indexOf("modalRefs.regenCtaBtn?.addEventListener('click'"));
    const guard = handler.indexOf('if (!res?.ok)');
    const replace = handler.indexOf('existing[0].replaceWith');
    expect(guard).toBeGreaterThan(-1);
    expect(replace).toBeGreaterThan(guard);   // 교체는 성공 판정 뒤에만 일어난다
    expect(handler).toContain('기존 버튼은 그대로 둡니다');
  });
});
