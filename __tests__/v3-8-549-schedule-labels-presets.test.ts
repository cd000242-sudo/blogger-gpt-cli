/**
 * v3.8.549 — 사장님 실보고 4건
 *
 *  ① 블로그스팟은 카테고리 선택이 안 뜬다
 *  ② 예약시간 칸의 달력 표시가 검은색이라 안 보인다 → [달력 열기] 버튼으로 (연속발행도)
 *  ③ 시간을 드롭다운으로도 고르게
 *  ④ 프리셋은 우측 '적용' 체크박스로 적용
 *
 * "배선 확실하게" 지시에 맞춰, 화면에 칸이 생겼는지가 아니라
 * **그 값이 발행까지 실제로 흘러가는지**를 본다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween, braceBlock } from './helpers/source-block';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const queue    = read('electron/ui/modules/publish-queue.js');
const picker   = read('electron/ui/modules/schedule-picker.js');
const presets  = read('electron/ui/modules/posting-presets.js');
const mainJs   = read('electron/ui/modules/main.js');
const coreIdx  = read('src/core/index.ts');
const publisher = read('src/core/blogger-publisher.js');

// ══════════════════════════════════════════════════════════
describe('① 블로그스팟 라벨 — 칸이 생기고, 발행까지 간다', () => {
  it('블로그스팟 항목에만 라벨 칸이 나온다', () => {
    const row = braceBlock(queue, 'function buildItemRow');
    expect(row).toContain("platform === 'blogspot' ?");
    expect(row).toContain('class="pq-item-labels"');
  });

  it('입력하면 항목에 저장된다', () => {
    const block = braceBlock(queue, "row.querySelector('.pq-item-labels')");
    expect(block).toContain('item.blogspotLabels = e.target.value');
    expect(block).toContain('saveItem()');
  });

  it('payload 에 labels 로 실린다 — 비우면 아예 안 실어서 자동 생성이 그대로 돈다', () => {
    const block = braceBlock(queue, 'function buildQueuePayloadOverrides');
    expect(block).toContain('labels: String(item.blogspotLabels');
    expect(block).toContain('undefined');
  });

  it('⭐ 근거: 퍼블리셔는 generatedLabels 를 payload.labels 보다 먼저 본다', () => {
    // 이 순서 때문에 화면 칸만 만들면 조용히 무시된다 — 그래서 아래 테스트가 필요하다
    const labelSource = blockBetween(publisher, 'const labelSource = (() => {', 'const labelSet = new Set()');
    const genIdx = labelSource.indexOf('payload.generatedLabels');
    const userIdx = labelSource.indexOf('Array.isArray(payload.labels)');
    expect(genIdx).toBeGreaterThan(-1);
    expect(userIdx).toBeGreaterThan(genIdx);   // generatedLabels 가 먼저다
  });

  it('⭐ 그래서 사용자가 라벨을 주면 generatedLabels 를 채우지 않는다', () => {
    expect(coreIdx).toContain('const hasUserLabels');
    expect(coreIdx).toContain('if (generatedLabels.length > 0 && !hasUserLabels)');
  });
});

// ══════════════════════════════════════════════════════════
describe('② · ③ 예약 시간 — 달력 열기 버튼과 시/분 드롭다운', () => {
  it('도구는 한 파일에서만 만든다 (세 자리가 갈라지지 않게)', () => {
    expect(picker).toContain('export function enhanceScheduleInput');
    expect(picker).toContain('export function enhanceAllScheduleInputs');
  });

  it('검은 달력 아이콘을 밝게 뒤집는다 — 버튼과 별개로 아이콘 자체도 보여야 한다', () => {
    expect(picker).toContain('::-webkit-calendar-picker-indicator');
    expect(picker).toContain('filter: invert(1)');
  });

  it('[📅 달력 열기] 버튼이 실제로 달력을 연다', () => {
    expect(picker).toContain('📅 달력 열기');
    const open = braceBlock(picker, 'export function openCalendar');
    expect(open).toContain('input.showPicker()');
    expect(open).toContain('input.focus()');   // 막혔을 때 손입력 경로
  });

  it('시·분 드롭다운이 input 값을 바꾸고 change 를 bubbles 로 쏜다 (기존 배선 재사용)', () => {
    const write = braceBlock(picker, 'function writeInputFromSelects');
    expect(write).toContain('input.value = `${date}T${hh}:${mm}`');
    expect(write).toContain("new Event('change', { bubbles: true })");
  });

  it('5분 단위가 아닌 값(간격 분산 09:07 등)도 그대로 보여준다 — 화면이 거짓말하면 안 된다', () => {
    const sync = braceBlock(picker, 'function syncSelectsFromInput');
    expect(sync).toContain('minSel.appendChild(opt)');
  });

  it('세 자리 전부에 붙는다 — 단일 발행 · 연속발행 일괄 · 연속발행 항목', () => {
    expect(mainJs).toContain("await import('./schedule-picker.js')");
    expect(mainJs).toContain('enhanceAllScheduleInputs(document)');
    expect(queue).toContain("import { enhanceAllScheduleInputs } from './schedule-picker.js'");
    expect(queue).toContain('enhanceAllScheduleInputs(listEl)');            // 항목 카드
    expect(queue).toContain('enhanceAllScheduleInputs(bulkScheduleInput.parentElement');  // 일괄
  });

  it('⭐ 하네스 안 꼬이게 — 기존 id·class 는 그대로 둔다', () => {
    // v3-8-545 가 이 class 를, schedule-prefill-guard 가 이 id 를 붙잡고 있다
    expect(queue).toContain('class="pq-item-schedule"');
    expect(queue).toContain('id="pq-bulk-schedule"');
    expect(read('electron/ui/index.html')).toContain('id="scheduleDateTime"');
    // input 을 다른 부모로 옮기지 않는다 (폭 규칙·선택자가 어긋난다)
    expect(picker).toContain("input.insertAdjacentElement('afterend', tools)");
  });

  it('다시 그려도 도구가 중복으로 붙지 않는다', () => {
    expect(picker).toContain("input.dataset.spReady === '1'");
  });
});

// ══════════════════════════════════════════════════════════
describe('④ 프리셋 적용 체크박스', () => {
  it('프리셋 줄 우측에 적용 체크박스가 있고, 지금 적용된 것만 체크된다', () => {
    expect(presets).toContain('data-pp-check=');
    expect(presets).toContain("p.name === store.active ? 'checked' : ''");
  });

  it('체크하면 적용된다', () => {
    const block = braceBlock(presets, "pop.querySelectorAll('[data-pp-check]')");
    expect(block).toContain('applyByName(name)');
  });

  it('체크를 풀어도 설정값을 되돌리지 않는다 — 손으로 고친 값이 날아가면 안 된다', () => {
    const block = braceBlock(presets, "pop.querySelectorAll('[data-pp-check]')");
    expect(block).toContain('store2.active = null');
    expect(block).not.toContain('applyPreset(');
  });

  it('적용 로직은 한 곳뿐이다 (줄 클릭과 체크박스가 같은 함수를 쓴다)', () => {
    expect(presets).toContain('const applyByName = (name) => {');
    const rowClick = braceBlock(presets, "pop.querySelectorAll('[data-pp-apply]')");
    expect(rowClick).toContain('applyByName(row.dataset.ppApply)');
    expect(rowClick).toContain(".closest('.pp-apply')");   // 체크박스 클릭과 겹치지 않게
  });
});
