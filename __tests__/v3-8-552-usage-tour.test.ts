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

  it('대상을 못 찾으면 경고를 남기고 그 단계만 건너뛴다 (조용히 빈 화면 금지)', () => {
    const render = braceBlock(tour, 'async function renderStep');
    expect(render).toContain('[USAGE-TOUR] ⚠️');
    expect(render).toContain('await step(+1)');
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
