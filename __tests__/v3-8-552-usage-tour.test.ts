/**
 * v3.8.552 — 사용법 안내
 *
 *   ① 첫 실행 화살표 (A안 확정): "먼저 플랫폼과 엔진을 선택하세요" — 딱 한 번
 *   ② [📖 사용법] 버튼 하나로 시작하는 18단계 따라하기
 *   ③ 오늘의 리더남 황금키워드 배너 삭제
 *   ④ 쿠팡 안내 모달 경고 테두리 은은하게 (빨간색 유지)
 *
 * ## 이 테스트가 지키는 것
 * 투어는 화면 곳곳의 id 를 가리킨다. id 하나가 바뀌면 **그 단계만 조용히 사라진다.**
 * 그래서 문구가 아니라 **대상 셀렉터가 실제로 존재하는지**를 전수로 검사한다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween, braceBlock } from './helpers/source-block';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const tour    = read('electron/ui/modules/usage-tour.js');
const html    = read('electron/ui/index.html');
const sidebar = read('electron/ui/modules/sidebar.js');
const mainJs  = read('electron/ui/modules/main.js');
const posting = read('electron/ui/modules/posting.js');
const ui      = read('electron/ui/modules/ui.js');

/** STEPS 배열에서 sel: [...] 안의 셀렉터를 전부 뽑는다 */
function tourSelectors(): string[] {
  const steps = blockBetween(tour, 'const STEPS = [', 'let tourIndex = 0');
  const out: string[] = [];
  /**
   * ⚠️ `[^\]]*` 로 자르면 `input[name="..."]` 의 첫 `]` 에서 끊긴다.
   *    그래서 sel: 이 있는 줄에서 **작은따옴표 문자열만** 뽑는다.
   */
  steps.split('\n').filter((line) => line.includes('sel: [')).forEach((line) => {
    const tail = line.slice(line.indexOf('sel: ['));
    const quoted = tail.match(/'([^']+)'/g) || [];
    quoted.forEach((q) => out.push(q.slice(1, -1)));
  });
  return out;
}

// ══════════════════════════════════════════════════════════
describe('① 첫 실행 안내 화살표 (A안)', () => {
  it('헤더의 두 배지를 가리킨다', () => {
    const fn = braceBlock(tour, 'export function showPlatformCoach');
    expect(fn).toContain("getElementById('platformStatus')");
    expect(fn).toContain("getElementById('aiModelStatus')");
    expect(fn).toContain('먼저 플랫폼과 엔진을 선택하세요');
  });

  it('딱 한 번만 뜬다 — 닫을 때 "봤음"으로 기록한다', () => {
    expect(tour).toContain("const COACH_SEEN_KEY = 'leadernam_platform_coach_seen'");
    const gate = braceBlock(tour, 'export function maybeShowPlatformCoach');
    expect(gate).toContain("localStorage.getItem(COACH_SEEN_KEY) === '1'");
    expect(braceBlock(tour, 'export function showPlatformCoach')).toContain('localStorage.setItem(COACH_SEEN_KEY');
  });

  it('안 닫고 껐으면 다음 실행에 한 번 더 뜬다 (표시할 때가 아니라 닫을 때 기록)', () => {
    const fn = braceBlock(tour, 'export function showPlatformCoach');
    const setIdx = fn.indexOf('localStorage.setItem(COACH_SEEN_KEY');
    const finishIdx = fn.indexOf('const finish = () =>');
    expect(finishIdx).toBeGreaterThan(-1);
    expect(setIdx).toBeGreaterThan(finishIdx);   // 기록이 finish 안에 있다
  });

  it('⭐ 환경설정이 자동으로 열려 있으면 띄우지 않는다 — display:flex 를 정확히 본다', () => {
    const gate = braceBlock(tour, 'export function maybeShowPlatformCoach');
    // 'block' 으로 비교하면 못 잡는다 (ui.js 는 flex 로 연다)
    expect(gate).not.toContain("=== 'block'");
    expect(gate).toContain("modalDisplay !== 'none'");
    expect(ui).toContain("modal.style.display = 'flex'");
  });
});

// ══════════════════════════════════════════════════════════
describe('② 18단계 따라하기', () => {
  it('버튼 하나로 시작한다 — 헤더에 [📖 사용법]', () => {
    const init = braceBlock(tour, 'export function initUsageTour');
    expect(init).toContain("id = 'usageTourBtn'");
    expect(init).toContain('📖 사용법');
    expect(init).toContain("querySelector('.header-actions')");
    expect(mainJs).toContain("await import('./usage-tour.js')");
    expect(mainJs).toContain('initUsageTour()');
  });

  it('⭐ 모든 단계의 대상이 실제로 존재한다 (없으면 그 단계가 조용히 사라진다)', () => {
    const runtimeIds = ['#nav-settings', '#nav-auto'];              // sidebar.js 가 그린다
    const lateIds = ['#executionModeApiBtn', '#executionModeAgentBtn']; // codex-workshop 이 그린다
    const missing: string[] = [];

    tourSelectors().forEach((sel) => {
      if (runtimeIds.includes(sel)) {
        if (!sidebar.includes(`id: '${sel.slice(1)}'`)) missing.push(`${sel} (sidebar)`);
        return;
      }
      if (lateIds.includes(sel)) {
        if (!read('electron/ui/modules/codex-workshop.js').includes(`id="${sel.slice(1)}"`)) {
          missing.push(`${sel} (codex-workshop)`);
        }
        return;
      }
      if (sel.startsWith('input[name=')) {
        const name = sel.match(/name="([^"]+)"/)?.[1] || '';
        if (!html.includes(`name="${name}"`)) missing.push(sel);
        return;
      }
      if (!html.includes(`id="${sel.slice(1)}"`)) missing.push(sel);
    });

    expect(missing).toEqual([]);
  });

  it('런타임으로 그려지는 [API/Agent] 버튼을 먼저 준비시킨다', () => {
    const go = braceBlock(tour, 'async function goSettingsModal');
    expect(go).toContain('await window.openSettingsModal()');   // async 라 기다려야 한다
    expect(go).toContain('window.ensureAgentModeSettingsReady');
    expect(mainJs).toContain('window.ensureAgentModeSettingsReady');
  });

  /**
   * ⚠️ v3.8.563 에서 이 항목의 기대값을 바꿨다.
   *
   * 지키려는 것은 그대로다 — **대상을 못 찾아도 조용히 빈 화면을 보이지 않는다.**
   * 바뀐 건 "어떻게 다음 단계로 가느냐"다.
   *
   * v3.8.563 이 step() 에 재진입 가드(stepping)를 넣었다. 사장님 보고
   * "1번 3번 5번 이런식으로 넘어가거든" 의 원인이 화면 이동 중 중복 클릭이었기 때문이다.
   * 그런데 renderStep 은 **step() 안에서** 돈다. 여기서 다시 step(+1) 을 부르면
   * 자기가 세운 가드에 스스로 막혀 **대상 없는 단계에서 투어가 멎는다.**
   * 그래서 커서만 직접 옮기고 다시 그린다.
   */
  it('대상을 못 찾으면 경고를 남기고 그 단계만 건너뛴다 (조용히 빈 화면 금지)', () => {
    const render = braceBlock(tour, 'async function renderStep');
    expect(render).toContain('[USAGE-TOUR] ⚠️');
    // 커서를 직접 옮긴다 — step() 재호출은 자기 가드에 막힌다
    expect(render).toContain('tourIndex += 1');
    expect(render).toContain('await renderStep()');
    expect(render).not.toContain('await step(+1)');
    // 마지막 단계에서 넘어가려 하면 투어를 끝낸다 (범위 밖 접근 금지)
    expect(render).toContain('if (tourIndex + 1 >= STEPS.length)');
  });

  it('헤더에 잘리지 않게 top layer(popover)로 띄운다', () => {
    expect(tour).toContain("popEl.setAttribute('popover', 'manual')");
    expect(tour).toContain('.ut-pop:popover-open');
  });

  it('사장님이 주신 순서의 핵심 문구가 그대로 들어 있다', () => {
    ['제미나이 3.6 플래시', '장당 90원', '프로디아', '서비스 선택', '단일 일관 모드',
      '키워드를 제목으로', '엔진 고정 모드', '팩트체크', '반자동 발행', '돈 많이 버시길']
      .forEach((phrase) => expect(tour).toContain(phrase));
  });

  it('건너뛰기·이전·다음이 모두 있다', () => {
    expect(tour).toContain('data-ut-skip');
    expect(tour).toContain('data-ut-prev');
    expect(tour).toContain('data-ut-next');
  });
});

// ══════════════════════════════════════════════════════════
describe('③④ 같이 처리한 두 건', () => {
  it('오늘의 리더남 황금키워드 대형 배너가 삭제됐다', () => {
    expect(html).not.toContain('id="golden-keyword-items"');
    expect(html).not.toContain('id="golden-report-date"');
    // 헤더의 [황금키워드 보러가기] 버튼은 남는다
    expect(html).toContain('id="goldenKeywordShortcut"');
  });

  it('남은 렌더 함수가 대상 없이도 죽지 않는다', () => {
    const fn = braceBlock(html, 'function renderGoldenKeyword()');
    expect(fn).toContain('if (!itemsEl) return;');
  });

  it('쿠팡 안내 경고 테두리 — 빨간색은 유지하고 굵기·채도만 낮췄다', () => {
    expect(posting).toContain('border-left:2px solid rgba(239,68,68,0.5)');
    expect(posting).not.toContain('border-left:3px solid #ef4444');
  });
});

/**
 * v3.8.617 — 어두워졌다 밝아지고, 누르면 알아서 넘어간다
 *
 * ## 사장님 지적 (실사용)
 *   "설정 유도하고 들어갔으면 밝아지면서 다음으로 자동으로 넘어가야죠"
 *   "다음 누르면 너무 느리고"
 *   "어두워졌다가 자연스럽게 다시 밝아져야 됩니다"
 *   "API 키 넣을 때는 필드로 가서 필드로 위치좌표해서 애니메이션으로"
 *
 * ## 왜 느렸나 (원인)
 * 설정 안의 단계가 다섯인데 [다음]마다 `goSettingsModal` 이 모달을 다시 열고
 * `220 + 140 + 160 = 520ms` 를 **고정으로 기다렸다.** 이미 열려 있고 탭도 맞는데도.
 */
describe('v3.8.617 — 연출과 자동 진행', () => {
  const src = read('electron/ui/modules/usage-tour.js');

  describe('① 어두워졌다가 다시 밝아진다', () => {
    it('구멍과 대상이 각각 밝아지는 연출을 갖는다', () => {
      expect(src).toContain('@keyframes ut-reveal');
      expect(src).toContain('@keyframes ut-lit-reveal');
    });

    /** 클래스가 이미 붙어 있으면 CSS 애니메이션은 다시 재생되지 않는다 */
    it('단계마다 다시 재생되게 리플로를 강제한다', () => {
      expect(src).toContain('void el.offsetWidth');
    });

    /** 먼저 돌리면 구멍이 옛 자리에서 밝아졌다가 툭 옮겨 간다 */
    it('좌표를 확정한 뒤에 연출을 돌린다', () => {
      expect(src.indexOf('placeNear(targets);')).toBeLessThan(src.indexOf('replayReveal(['));
    });

    /** 9999px 그림자는 매 프레임 화면 전체를 다시 칠한다 — 무한 반복이면 앱이 무거워진다 */
    it('한 번만 돈다 (무한 반복이 아니다)', () => {
      const m = /\.ut-hole\.ut-reveal\s*\{\s*animation:[^;]*;/.exec(src);
      expect(m).not.toBeNull();
      expect(m![0]).not.toContain('infinite');
      expect(m![0]).toMatch(/\s1\s*;/);
    });

    it('모션을 줄인 환경에서는 끈다', () => {
      // 길이로 자르지 않는다 — 위아래가 바뀌면 검사 범위가 어긋난다
      expect(braceBlock(src, 'prefers-reduced-motion')).toContain('ut-reveal');
    });
  });

  describe('② 누르면 알아서 다음으로', () => {
    it('대상 클릭으로 진행하는 배선이 있다', () => {
      expect(src).toContain('if (s.autoNext)');
      expect(src).toContain("addEventListener('click', onHit, { once: true })");
    });

    /** 시킨 대로 눌렀는데 가만히 있으면 [다음]을 또 눌러야 한다 */
    it('설정·모드·글포스팅 탭처럼 "누르는" 단계에 붙어 있다', () => {
      expect(src).toContain("sel: ['#nav-settings'], autoNext: true");
      expect(src).toContain("'#executionModeAgentBtn'], autoNext: true");
      expect(src).toContain("sel: ['#nav-auto'], autoNext: true");
    });

    /**
     * ⭐ API 키 칸은 **눌러서 타이핑하는 자리**다.
     * 누르자마자 넘어가면 키를 넣을 새가 없다 — 여긴 [다음]으로 넘어간다.
     */
    it('입력칸 단계에는 붙이지 않는다', () => {
      const keyStep = blockBetween(src, "sel: ['#geminiKey']", '},');
      expect(keyStep).not.toContain('autoNext');
      const hubStep = blockBetween(src, "sel: ['#naverApiHubKeyId', '#naverApiHubKey']", '},');
      expect(hubStep).not.toContain('autoNext');
    });

    it('단계가 바뀌면 리스너를 뗀다 (쌓이면 두 칸씩 건너뛴다)', () => {
      expect(src).toContain('runAutoNextCleanups');
      const clear = blockBetween(src, 'function clearHighlights()', '}');
      expect(clear).toContain('runAutoNextCleanups()');
    });

    it('투어가 끝날 때도 뗀다', () => {
      const end = blockBetween(src, "function endTour(reason = 'done')", 'stopTracking');
      expect(end).toContain('runAutoNextCleanups()');
    });
  });

  describe('③ 같은 자리면 기다리지 않는다', () => {
    it('모달이 이미 열려 있으면 다시 열지 않는다', () => {
      const go = blockBetween(src, 'async function goSettingsModal()', 'async function closeSettingsModal');
      expect(go).toContain('const modalOpen =');
      expect(go).toContain('if (!modalOpen');
    });

    it('탭이 이미 맞으면 전환하지 않는다', () => {
      const go = blockBetween(src, 'async function goSettingsModal()', 'async function closeSettingsModal');
      expect(go).toContain('apiTabShown');
      expect(go).toContain('if (!apiTabShown');
    });

    /** 이미 그려져 있는데 다시 부르면 160ms 를 또 기다린다 */
    it('실행 방식 섹션이 이미 있으면 다시 준비하지 않는다', () => {
      const go = blockBetween(src, 'async function goSettingsModal()', 'async function closeSettingsModal');
      expect(go).toContain("!document.getElementById('executionModeApiBtn')");
    });
  });
});
