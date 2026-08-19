/**
 * 유휴 성능 테스트 — 백그라운드 일시정지 미배선 수리 + 장식 절제 (v3.8.540)
 *
 * 사장님: "컴퓨터가 느려도 렌더링 빠르고 동시작업해도 무리없게 가능하니?"
 *
 * 실측 발견 (6번째 조용한 미배선):
 *   performance-optimizer 가 app-background-paused 클래스를 토글하지만,
 *   소비 CSS 가 **로드되지 않는 style.css**(쌍둥이)에만 있었다 —
 *   index.html 은 styles.css 를 로드한다. 기능은 있었는데 작동한 적이 없다.
 *
 * 계약:
 *  ① 소비 CSS 는 로드되는 styles.css 에 실존한다 (쌍둥이 함정 회귀 잠금)
 *  ② blur/focus 까지 본다 — 다른 창 뒤에 "보이는 채로" 있는 시간이 제일 길다
 *  ③ 장식(타이틀·펄스·발행버튼)은 인사 후 휴식 — 상시 무한 금지
 *  ④ 활동 표시기(진행바 shimmer)는 무한 유지 — 멈추면 죽은 걸로 보인다
 */
import * as fs from 'fs';
import * as path from 'path';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const html = read('electron/ui/index.html');
const loadedCss = read('electron/ui/styles.css');
const perf = read('electron/ui/performance-optimizer.js');

describe('① 백그라운드 일시정지 — 로드되는 파일에 배선', () => {
  it('⭐ 소비 CSS 가 styles.css(로드됨)에 있다 — style.css 쌍둥이만으로는 무동작', () => {
    expect(loadedCss).toContain('html.app-background-paused *');
    expect(loadedCss).toContain('animation-play-state: paused !important');
  });

  it('index.html 은 styles.css 를 로드하고, style.css 는 로드하지 않는다 (함정 명시)', () => {
    expect(html).toContain('href="styles.css"');
    expect(html).not.toMatch(/href="style\.css"/);
  });

  it('클래스를 거는 쪽이 실존하고 blur/focus/visibility 세 신호를 다 본다', () => {
    expect(perf).toContain("classList.toggle('app-background-paused'");
    expect(perf).toContain("window.addEventListener('blur', sync");
    expect(perf).toContain("window.addEventListener('focus', sync");
    expect(perf).toContain("document.addEventListener('visibilitychange', sync");
    expect(perf).toContain('!document.hasFocus()');
  });
});

describe('② 장식 애니메이션 — 인사 후 휴식', () => {
  it('타이틀 골드쉬머는 4회만 돌고 쉰다 (상시 무한 금지)', () => {
    expect(html).toContain('animation: goldShimmer 3s ease-in-out 4;');
    expect(html).not.toContain('goldShimmer 3s ease-in-out infinite');
  });

  it('펄스 ⚡ 는 6회만 (2곳 모두)', () => {
    expect((html.match(/animation: pulse 2s 6;/g) || []).length).toBe(2);
    expect(html).not.toContain('animation: pulse 2s infinite;');
  });

  it('발행 버튼 반짝임은 호버 시에만 — 인라인 무한이 사라지고 클래스로 갔다', () => {
    expect(html).toContain('class="bgpt-btn-shimmer"');
    expect(html).not.toContain('animation: shimmer 3s infinite');
    expect(loadedCss).toContain('.bgpt-btn-shimmer { animation: none; }');
    expect(loadedCss).toContain('#publishBtn:hover .bgpt-btn-shimmer');
  });

  it('④ 활동 표시기(진행바)는 무한 유지 — 멈추면 죽은 걸로 보인다', () => {
    // progressFill 의 shimmer 2s infinite 는 의도적으로 남긴다 (백그라운드 정지가 유휴 비용은 커버)
    expect(html).toContain('animation: shimmer 2s infinite');
  });
});
