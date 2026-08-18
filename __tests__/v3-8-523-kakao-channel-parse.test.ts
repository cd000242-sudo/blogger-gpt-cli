/**
 * v3.8.523 — 카카오톡 채널 실물 검수 3건 (사장님 화면 보고)
 *
 * ① 결과창에 내부 마커가 그대로 나왔다.
 *    "===A안 (수치형)===", "[헤드라인]", "[본문]" 이 사용자 화면에 노출되고
 *    A안 본문만 중간에 끊긴 채 끝났다(191자, "덜컥"에서 절단).
 *    원인: 프롬프트는 마커 형식으로 A/B/C 3안을 받아오는데 **파서가 없었다.**
 *    인스타·스레드는 구조화 파서가 있는데 카카오 채널만 빠져 있었다.
 *
 * ② 콘솔 ERR_NAME_NOT_RESOLVED — 플랫폼 아이콘을 외부 CDN(cdn.simpleicons.org)에서
 *    받아오고 있었다. 인터넷·DNS 가 막히면 아이콘이 전부 깨지고 콘솔이 오염된다.
 *    앱 아이콘이 남의 서버에 의존할 이유가 없다.
 *
 * ③ 자동 발행이 세션 만료로 실패했는데 사용자는 이유를 몰랐다.
 *    → LOGIN_REQUIRED 면 로그인 창을 자동으로 띄우고 이어서 발행한다.
 */
import * as fs from 'fs';
import * as path from 'path';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const KAKAO = require('../src/core/external-traffic/prompts/messenger/kakao-channel');

const SAMPLE = `===A안 (충격수치형)===
[헤드라인] 실손보험금 받았는데 도로 뺏긴다? 환수 통보의 진실
[본문] 병원비 부담 줄이려 실손보험 청구 후 본인부담상한제 환급금까지 받았는데,
보험사에서 갑자기 환수를 통보한다면? 가입 시점에 따라 결론이 갈립니다.
[버튼라벨] 내 케이스 확인
[URL] https://leadernam.com/tax/abc

===B안 (자기의심형)===
[헤드라인] 나만 몰랐던 실손보험 환수 기준
[본문] 같은 통보를 받아도 어떤 사람은 돌려주고 어떤 사람은 안 돌려줍니다.
[버튼라벨] 기준 보기
[URL] https://leadernam.com/tax/abc

===C안 (손실회피형)===
[헤드라인] 이거 모르면 받은 돈 그대로 반납
[본문] 대응 기한을 놓치면 다툴 기회 자체가 사라집니다.
[버튼라벨] 지금 확인
[URL] https://leadernam.com/tax/abc`;

describe('① 카카오 채널 출력 파서', () => {
  it('구조화 파서가 존재한다 — 인스타·스레드에는 있는데 카카오만 없었다', () => {
    expect(typeof KAKAO.processStructuredResponse).toBe('function');
  });

  it('내부 마커가 사용자 화면에 새지 않는다', () => {
    const out = KAKAO.processStructuredResponse(SAMPLE);
    const shown = JSON.stringify(out.formatted);
    expect(shown).not.toContain('===A안');
    expect(shown).not.toContain('[헤드라인]');
    expect(shown).not.toContain('[본문]');
    expect(shown).not.toContain('[버튼라벨]');
  });

  it('헤드라인·본문·버튼·URL 을 칸별로 나눠 준다 — 카카오 작성 폼이 칸별로 다르다', () => {
    const parts = KAKAO.processStructuredResponse(SAMPLE).formatted.parts;
    expect(parts.headline).toBe('실손보험금 받았는데 도로 뺏긴다? 환수 통보의 진실');
    expect(parts.body).toContain('병원비 부담 줄이려');
    expect(parts.body).toContain('가입 시점에 따라');   // 여러 줄 본문이 이어붙는다
    expect(parts.buttonLabel).toBe('내 케이스 확인');
    expect(parts.url).toBe('https://leadernam.com/tax/abc');
  });

  it('A/B/C 3안을 모두 건진다 — 예전엔 A안 일부만 보였다', () => {
    const extra = KAKAO.processStructuredResponse(SAMPLE).extra;
    const variants = extra.kakaoChannel.variants;
    expect(variants).toHaveLength(3);
    expect(variants.map((v: any) => v.key)).toEqual(['A', 'B', 'C']);
    expect(variants[1].headline).toContain('나만 몰랐던');
    expect(variants[2].buttonLabel).toBe('지금 확인');
  });

  it('형식이 깨진 응답에도 죽지 않는다 — 발행을 막으면 안 된다', () => {
    expect(() => KAKAO.processStructuredResponse('그냥 평범한 텍스트')).not.toThrow();
    const out = KAKAO.processStructuredResponse('그냥 평범한 텍스트');
    expect(out === null || typeof out === 'object').toBe(true);
  });
});

describe('② 아이콘은 외부 CDN 에 의존하지 않는다', () => {
  const ui = read('electron/ui/modules/external-traffic.js');

  it('cdn.simpleicons.org 를 부르지 않는다 — DNS 실패 시 콘솔 오염·아이콘 전멸', () => {
    // 주석에 사고 기록은 남기되, 실제 호출(URL 조립·img src)은 없어야 한다
    expect(ui).not.toContain('https://cdn.simpleicons.org');
    const logo = ui.slice(ui.indexOf('function _renderPlatformLogo'), ui.indexOf('function _readExtTrafficJsonStorage'));
    expect(logo).not.toContain('<img');
    expect(logo).not.toContain('iconUrl');
  });

  it('아이콘을 앱 안에서 그린다 (내장 표식)', () => {
    expect(ui).toContain('_renderPlatformLogo');
    expect(ui).toMatch(/fallback/);
  });
});

describe('③ 자동 발행 — 세션 만료를 스스로 복구한다', () => {
  const ui = read('electron/ui/modules/external-traffic.js');

  it('LOGIN_REQUIRED 를 만나면 로그인 창을 띄우고 이어서 발행한다', () => {
    const fn = ui.slice(ui.indexOf('async function extTrafficKakaoAutoPost'));
    expect(fn).toContain('LOGIN_REQUIRED');
    // 로그인 후 재시도가 실제로 있어야 한다 (안내만 하면 사용자가 또 헤맨다)
    expect(fn).toMatch(/재시도|다시 발행|retry/i);
  });
});
