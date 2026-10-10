/**
 * v3.8.759 — Dropshot 결과로 남의 이미지(선정적 사진 포함)를 가져오던 것
 *
 * 사장님 실측(2026-10-09, Codex 에이전트 · 쿠팡 보상 글): H2 이미지가 주제와 무관한 선정적 인물 사진이었다.
 *
 * 로그인된 Dropshot 보드 실측(2026-10-10):
 *   · 왼쪽 "내 작업" 목록에 이 계정의 최근 작업 썸네일이 있다. 화면엔 32×32 인데 원본은 1280×698.
 *     주소는 /public/jobs/prod/<작업번호>/output/output_0.jpg, 링크는 a[href="/ko/workspace/board/<보드>"].
 *     설명문은 여러 사람의 블로그 주제였다("트럼프 대통령이 발표문에", "이강인 사인", "스미싱 예방 보안").
 *   · 로그인 직후 홍보 팝업(role=dialog)이 /public/images/img_nano_banna_unlimited_pc_x2.png 를 띄운다.
 *   · 비로그인 보드엔 /public/home/banner/… 홍보 배너가 있다.
 * 예전 선택 규칙: "생성 뒤 새로 생긴 큰 이미지(원본 크기 기준)" 아무거나 — 내 요청 결과인지 보지 않았다.
 * 그래서 목록에 새 작업이 끼거나 팝업·배너가 뜨면 그 사진이 글에 들어갔다.
 *
 * 새 규칙: 내 결과 자리(화면에 크게 보이는 것)만, 작업 결과 주소(/jobs/)만, 목록·팝업 안은 버린다.
 */
import { isOwnDropshotResultCandidate, urlToDataUrlInPage, type DropshotRawImageCandidate } from '../src/core/dropshotGenerator';

const JOB = 'https://img.aistudio.dropshot.io/v1/aistudio-cdn/primary/public/jobs/prod/-OynFJDjs2zlJfsXDfYF/output/output_0.jpg?w=1920&q=75';
const base: DropshotRawImageCandidate = {
  src: JOB, width: 1280, height: 698, renderedWidth: 640, renderedHeight: 349, kind: 'img', inJobList: false, inDialog: false,
};

describe('v3.8.759 Dropshot 내 결과만 고른다', () => {
  test('보드 가운데에 크게 보이는 작업 결과는 받는다', () => {
    expect(isOwnDropshotResultCandidate(base)).toBe(true);
  });

  test('⭐ 실측: "내 작업" 목록 썸네일(화면 32×32 · 원본 1280×698)은 버린다', () => {
    expect(isOwnDropshotResultCandidate({ ...base, renderedWidth: 32, renderedHeight: 32, inJobList: true })).toBe(false);
  });

  test('목록 링크 안이면 크게 보여도 버린다(목록을 펼친 화면)', () => {
    expect(isOwnDropshotResultCandidate({ ...base, inJobList: true })).toBe(false);
  });

  test('⭐ 실측: 로그인 직후 홍보 팝업 이미지는 버린다', () => {
    expect(isOwnDropshotResultCandidate({
      ...base, src: 'https://img.aistudio.dropshot.io/v1/aistudio-cdn/primary/public/images/img_nano_banna_unlimited_pc_x2.png?w=1920&q=75',
      width: 977, height: 729, renderedWidth: 840, renderedHeight: 547, inDialog: true,
    })).toBe(false);
  });

  test('⭐ 실측: 홍보 배너·공개 견본처럼 작업 결과 주소가 아닌 것은 크게 보여도 버린다', () => {
    expect(isOwnDropshotResultCandidate({ ...base, src: 'https://img.aistudio.dropshot.io/v1/aistudio-cdn/primary/public/home/banner/264q_avatar2_179.png', renderedWidth: 560, renderedHeight: 315 })).toBe(false);
    expect(isOwnDropshotResultCandidate({ ...base, src: 'https://img.aistudio.dropshot.io/v1/aistudio-cdn/primary/public/images/character/model_01.png', renderedWidth: 300, renderedHeight: 400 })).toBe(false);
  });

  test('숨겨진(크기 0) 이미지는 버린다 — 닫힌 패널의 견본', () => {
    expect(isOwnDropshotResultCandidate({ ...base, renderedWidth: 0, renderedHeight: 0 })).toBe(false);
  });

  test('다른 사이트 주소는 버린다', () => {
    expect(isOwnDropshotResultCandidate({ ...base, src: 'https://example.com/jobs/prod/x/output/output_0.jpg' })).toBe(false);
  });

  test('결과 이미지가 화면 밖(아래쪽)에 있어도 크기만 맞으면 받는다 — 실측 위치 y=1084', () => {
    expect(isOwnDropshotResultCandidate({ ...base, renderedWidth: 587, renderedHeight: 600 })).toBe(true);
  });

  test('예전 보드처럼 결과가 data:·blob: 이면 크게 보일 때만 받는다', () => {
    const big = `data:image/png;base64,${'A'.repeat(30_000)}`;
    expect(isOwnDropshotResultCandidate({ ...base, src: big })).toBe(true);
    expect(isOwnDropshotResultCandidate({ ...base, src: 'data:image/png;base64,AAAA' })).toBe(false);
    expect(isOwnDropshotResultCandidate({ ...base, src: 'blob:https://aistudio.dropshot.io/1234' })).toBe(true);
    expect(isOwnDropshotResultCandidate({ ...base, src: 'blob:https://aistudio.dropshot.io/1234', inJobList: true })).toBe(false);
  });
});

/**
 * 실측(2026-10-10, 지난 작업 보드): 결과 이미지는 img.aistudio.dropshot.io 에 있어 페이지 안 fetch 가
 * "TypeError: Failed to fetch"(CORS)로 막혔다. 같은 주소를 브라우저 요청(page.context().request)으로 받으면 200 image/jpeg 55,874B.
 * 예전 코드는 페이지 안 fetch 만 해서, 내 결과가 떠도 받지 못하고 210초씩 기다렸다.
 */
describe('v3.8.759 결과 이미지 받기 — 페이지 안이 막히면 페이지 밖에서', () => {
  const jpeg = Buffer.alloc(30_000, 7);
  const fakePage = (inPage: () => Promise<string | null>, response: { ok: boolean; type: string; body: Buffer } | null) => ({
    evaluate: async () => inPage(),
    context: () => ({
      request: {
        get: async () => {
          if (!response) throw new Error('network');
          return { ok: () => response.ok, headers: () => ({ 'content-type': response.type }), body: async () => response.body };
        },
      },
    }),
  });

  test('⭐ 실측 재현: 페이지 안 fetch 가 CORS 로 실패하면 페이지 밖 요청으로 받는다', async () => {
    const page = fakePage(async () => { throw new Error('TypeError: Failed to fetch'); }, { ok: true, type: 'image/jpeg', body: jpeg });
    const url = await urlToDataUrlInPage(page, JOB);
    expect(url?.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(url!.length).toBeGreaterThan(20_000);
  });

  test('페이지 안에서 받아지면 그대로 쓴다', async () => {
    const page = fakePage(async () => 'data:image/png;base64,AAA', null);
    expect(await urlToDataUrlInPage(page, JOB)).toBe('data:image/png;base64,AAA');
  });

  test('이미지가 아닌 응답·실패 응답·blob 주소는 받지 않는다', async () => {
    const fail = async () => { throw new Error('cors'); };
    expect(await urlToDataUrlInPage(fakePage(fail, { ok: true, type: 'text/html', body: jpeg }), JOB)).toBeNull();
    expect(await urlToDataUrlInPage(fakePage(fail, { ok: false, type: 'image/jpeg', body: jpeg }), JOB)).toBeNull();
    expect(await urlToDataUrlInPage(fakePage(fail, null), JOB)).toBeNull();
    expect(await urlToDataUrlInPage(fakePage(fail, { ok: true, type: 'image/jpeg', body: jpeg }), 'blob:https://aistudio.dropshot.io/1')).toBeNull();
  });
});
