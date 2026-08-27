/**
 * v3.8.563 — 즉시 순차발행의 예약 시각 배선 + 사용법 투어 (사장님 보고 2건)
 *
 * ## ① 예약발행이 두 번째 글부터 즉시발행으로 떨어졌다
 * 보고: "예약발행을 연속발행으로 하면 첫글은 예약이 되는데, 두번째글부터
 *        첫번째 글 예약발행한 시간부터 그냥 순차적으로 즉시발행이 되어버린다"
 *
 * 원인: [즉시 순차 발행] 루프가 `item.scheduleDate` 를 **한 번도 안 읽었다.**
 *   메인 폼 `#scheduleDateTime` 하나만 보고 거기에 간격을 더해 시각을 다시 만들었는데,
 *   연속발행 모드에서는 발행 탭이 숨겨져 있어(v3.8.117) 그 칸이 대개 비어 있다.
 *   비면 `지금+1시간` 으로 떨어지므로 사장님이 찍은 시각이 통째로 버려진다.
 *
 * ⚠️ 같은 버그를 v3.8.546 이 [스케줄에 추가] 경로에서만 고쳤다. 이쪽은 남아 있었다.
 *   **입력은 받는데 쓰는 곳이 없는 "조용한 미배선"** 이라 에러 없이 통과한다.
 *   그래서 값이 아니라 **배선 자체**를 고정한다.
 *
 * ## ② 사용법 투어
 * 보고: "F11 눌러서 버튼 누르니까 인식이 엄청 느려", "1번 3번 5번 이런식으로 넘어가거든",
 *       "위치도 정확하게 나와야 사람들이 마우스가 따라가지"
 *
 * 느린 것과 건너뛰는 것은 **같은 원인**이다 — 화면 이동(0.5초+) 동안 이전 카드의
 * [다음] 버튼이 살아 있어서, 반응이 없어 보이면 한 번 더 눌리고 두 칸이 넘어간다.
 *
 * 브라우저에서 실제로 눌러 본 검증은 별도다(스크래치패드 test-tour.js, 구판 red 확인).
 * 여기서는 그 수정이 **파일에 남아 있는지**만 고정한다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween, braceBlock } from './helpers/source-block';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

const queue = read('electron/ui/modules/publish-queue.js');
const tour = read('electron/ui/modules/usage-tour.js');

/**
 * [즉시 순차 발행] 루프 본문만 잘라 낸다 — 다른 경로의 코드에 속지 않기 위해서다.
 * 길이가 아니라 **경계**로 자른다 (source-block-helper 규칙).
 */
function runnerBlock(src: string): string {
  return blockBetween(
    src,
    'const scheduleBaseDate =',
    'STATE.keywords = STATE.keywords.filter(item => !completedIds.has(item.id))',
  );
}

describe('① 즉시 순차발행이 항목별 예약 시각을 쓴다', () => {
  const block = runnerBlock(queue);

  it('⭐⭐ 루프가 항목에 찍힌 예약 시각을 읽는다 (이게 없어서 통째로 버려졌다)', () => {
    expect(block).toContain('queueItemScheduleMs(it)');
    expect(block).toContain('scheduleDateManual');
  });

  it('⭐⭐ 메인 폼 하나만 보고 시각을 만들지 않는다', () => {
    // 예전 형태: scheduleBaseDate = getScheduleBaseDate() 한 줄이 전부였다.
    // 이제는 항목들이 물려받은 시각을 먼저 보고, 없을 때만 폼으로 떨어진다.
    expect(block).toContain('.filter((it) => !it.scheduleDateManual)');
    expect(block).toContain('getScheduleBaseDate()');
    // 폼 폴백이 "유일한 경로"가 아님을 확인 — 물려받은 값이 있으면 그걸 쓴다
    expect(block).toMatch(/inherited\.length\s*\?/);
  });

  it('⭐⭐ 예약 시각이 과거로 떨어지면 조용히 넘어가지 않는다', () => {
    // 퍼블리셔는 과거면 "즉시 발행합니다"로 떨어뜨린다. 그게 이 버그의 마지막 단계다.
    expect(block).toContain('MIN_SCHEDULE_LEAD_MS');
    // 로그 문자열 안에 괄호가 들어 있으므로 [^)]* 로는 못 넘어간다
    expect(block).toMatch(/runModal\.log\([\s\S]*?이미 지났습니다/);
    expect(block).toMatch(/runModal\.log\([\s\S]*?예약을 유지합니다/);
  });

  it('⭐ 직접 찍은 시각은 임의로 밀지 않는다 (자동 배치 항목만 민다)', () => {
    expect(block).toContain('manualScheduleMs !== null && scheduleMs <= Date.now()');
    expect(block).toContain('manualScheduleMs === null && scheduleMs < Date.now() + MIN_SCHEDULE_LEAD_MS');
  });

  it('⭐ 자동 배치 커서는 실제 배정된 시각에서 이어 간다', () => {
    expect(block).toContain('const assignedOffset = scheduleMs - scheduleBaseDate.getTime()');
    expect(block).toContain('Math.max(scheduleOffsetMs, assignedOffset)');
  });

  /**
   * 사장님 실측(2026-08-25 발행 이력)이 이 항목의 근거다.
   *   발행 3:30 → 3:38 → 3:46 (8분)  ·  생성 2:38 → 2:46 → 2:53
   *   입력값은 1분이었는데 결과는 8분 = max(바닥값 7분, 실제 생성 8분).
   * 바닥값 7분은 이미지 엔진 레이트리밋 때문에 **생성**에 필요한 값이지
   * 글이 뜨는 시각까지 벌릴 값이 아니다.
   */
  it('⭐⭐ 발행 간격에 생성 바닥값을 쓰지 않는다 (1분 입력이 8분이 된 자리)', () => {
    expect(block).toContain('const publishGapMs =');
    // 발행 시각 전진에 쓰는 값은 사장님 입력 원값이어야 한다
    expect(block).toContain('rawFixedIntervalMs');
    expect(block).toMatch(/scheduleOffsetMs = Math\.max\(scheduleOffsetMs, assignedOffset\) \+ publishGapMs/);
    // 예전 형태가 남아 있으면 안 된다
    expect(block).not.toMatch(/scheduleOffsetMs\s*[+]?=\s*Math\.max\(targetGapMs, elapsedMs\)/);
  });

  it('⭐ 생성 대기(바닥값)는 그대로 살아 있다 — 레이트리밋 방어는 유지', () => {
    expect(block).toContain('const targetGapMs =');
    expect(block).toContain('const waitMs = Math.max(0, targetGapMs - elapsedMs)');
  });

  it('직접 찍은 항목이 자동 배치 순서를 밀어내지 않는다 (스케줄 추가 경로와 같은 규칙)', () => {
    // 커서 전진이 manual 항목에서는 아예 실행되지 않아야 한다
    expect(block).toMatch(/if \(manualScheduleMs === null\) \{[\s\S]*?assignedOffset/);
  });

  /**
   * 사장님: "예약발행이 되었으면 언제 예약발행되었고 예약 시간을 알려줘야 되잖아"
   * 맞다. 예전엔 배정된 예약 시각을 화면에 한 번도 안 보여 줬다.
   * 그래서 시각이 사장님이 정한 것과 달라도 알 방법이 없었고, 조용히 넘어갔다.
   */
  it('⭐⭐ 각 글이 몇 시로 예약됐는지 화면에 알려 준다', () => {
    expect(block).toContain('📅 예약 시각:');
    // 어디서 온 시각인지도 같이 — 자동인데 찍은 기억이 있으면 그 자체가 신호다
    expect(block).toContain('카드에 직접 찍은 시각');
    expect(block).toContain('자동 배치');
    // 예약이 아닌 항목도 분명히 말해 준다 (침묵이 곧 오해였다)
    expect(block).toContain('즉시 발행 항목입니다');
  });

  it('⭐ 완료 줄에도 발행 예정 시각이 남는다', () => {
    expect(block).toContain('발행 예정');
    expect(block).toMatch(/runModal\.log\(`\$\{i \+ 1\}번 완료[^`]*\$\{doneSchedule\}`\)/);
  });

  /**
   * 사장님 실측(2026-08-25): "분명 다음날로 맞춰뒀는데" 워드프레스에선 즉시발행이었다.
   * 일괄 편집에서 **발행 방식을 그대로 두고 날짜만 넣으면** 적용 루프의 두 줄이
   * 모두 `pm` 조건에 걸려 건너뛰어진다 — 날짜가 아무 데도 안 들어간다.
   * 그러면 postingMode 가 '즉시'로 남아 payload 에서 예약 시각이 통째로 빠진다.
   */
  it('⭐⭐ 일괄 편집: 날짜만 넣고 발행 방식을 안 바꾸면 막는다', () => {
    // ⚠️ 'pq-bulk-apply' 는 마크업(버튼 정의)에 먼저 나온다 — 거기서 자르면 4만 자를 헛본다.
    //    리스너 등록 지점부터 **경계로** 자른다(고정 길이 금지 — source-block-helper 가 막는다).
    const head = blockBetween(
      queue,
      "document.getElementById('pq-bulk-apply')?.addEventListener",
      'persistQueue();',
    );
    expect(head).toContain("if (scheduleVal && pm !== 'schedule')");
    expect(head).toContain('바로 발행됩니다');
    // 막고 끝내야 한다 — 경고만 띄우고 진행하면 똑같이 당한다
    expect(head).toMatch(/if \(scheduleVal && pm !== 'schedule'\) \{[\s\S]*?return;\s*\n\s*\}/);
  });

  /**
   * 사장님 실측(2026-08-27, 스크린샷 2장):
   *   일괄 편집 = "예약 발행" + 2026-08-27 19:00 을 분명히 골랐는데
   *   대기열 카드 = "즉시 발행" · 예약 시간 빈칸  →  전부 즉시발행으로 나갔다.
   *
   * 일괄 편집 값은 패널 맨 아래 [⚡ 일괄 적용]을 눌러야 항목에 들어간다.
   * 그 버튼은 스크롤해야 보이고, 고르는 순간 이미 적용된 것처럼 보인다.
   * **고른 것과 실제 상태가 다른데 아무도 말해 주지 않는 것**이 이 사고의 핵심이다.
   */
  it('⭐⭐ 일괄 편집을 골라 놓고 [일괄 적용]을 안 눌렀으면 발행을 막는다', () => {
    expect(queue).toContain('function unappliedBulkSchedule(');
    expect(queue).toContain('function blockOnUnappliedBulkSchedule(');
    // 항목 중 하나라도 예약이면 적용된 것으로 본다
    expect(queue).toContain("some((it) => normalizePostingMode(it.postingMode) === 'schedule')");
    // 무엇이 어긋났는지 둘 다 보여 준다
    expect(queue).toContain('고른 예약 시각');
    expect(queue).toContain('현재 항목 상태');
    expect(queue).toContain('[⚡ 일괄 적용] 버튼을 눌러 주세요');
  });

  it('⭐⭐ 두 실행 경로 모두에 그 검사가 걸려 있다', () => {
    // 초록(즉시 순차 발행)·주황(스케줄에 추가) 어느 쪽으로 시작해도 막혀야 한다
    const hits = queue.match(/if \(blockOnUnappliedBulkSchedule\(enabled\)\) return;/g) || [];
    expect(hits.length).toBe(2);
    // 검사 뒤에 곧바로 실행으로 이어지지 않도록 return 으로 끊는다
    expect(queue).not.toMatch(/blockOnUnappliedBulkSchedule\(enabled\);\s*\n/);
  });

  /**
   * 사장님: "카드마다 따로따로 수정이 가능하잖아. 따로따로 수정하면 이대로 발행되게끔
   *          되어야 되는 거 아니니?"
   *
   * 맞다. 카드 편집은 예전부터 값을 **저장은** 하고 있었다(scheduleDateManual 까지).
   * 문제는 [즉시 순차 발행] 루프가 그 값을 **안 읽은 것**이다.
   * (v3.8.546 이 [스케줄에 추가] 경로에서만 읽도록 고쳤다)
   */
  it('⭐⭐ 카드에서 따로 고친 예약 시각이 그대로 발행에 쓰인다', () => {
    // 카드 편집이 값을 남기는 쪽
    expect(queue).toContain('item.scheduleDateManual = !!item.scheduleDate');
    expect(queue).toContain("if (item.scheduleDate && item.postingMode !== 'schedule') item.postingMode = 'schedule'");
    // 실행 루프가 그 값을 읽는 쪽 — 이게 없어서 버려졌다
    expect(block).toContain('it.scheduleDateManual ? queueItemScheduleMs(it) : null');
    expect(block).toContain('manualScheduleMs !== null\n          ? manualScheduleMs');
  });

  it('⭐ 카드에서 고친 값이 저장·복원 과정에서 살아남는다', () => {
    // applySnapshotToItem 은 scheduleDateManual 을 건드리면 안 된다 (건드리면 수동 표시가 지워진다)
    expect(braceBlock(queue, 'function applySnapshotToItem(')).not.toContain('scheduleDateManual');
    // 카드 편집 → 스냅샷 갱신 + 영속화
    expect(queue).toMatch(/const saveItem = \(\) => \{[\s\S]*?touchItemSnapshot\(item\);[\s\S]*?persistQueue\(\);/);
  });

  it('⭐ 예약 시각만 남고 발행 방식이 어긋난 항목을 실행 중에도 알린다', () => {
    expect(block).toContain('strandedScheduleMs');
    expect(block).toContain('예약이 무시되고 바로 발행됩니다');
  });

  it('발행 시각을 payload 로 넘기는 배선은 그대로다', () => {
    expect(queue).toContain('buildQueuePayloadOverrides(it, itemScheduleDate)');
    expect(queue).toContain("scheduleDate: postingMode === 'schedule' ? scheduleDateIso : undefined");
  });
});

describe('② 사용법 투어 — 건너뜀·잘림·느림', () => {
  it('⭐⭐ 이동 중 추가 입력을 막는다 (1→3→5 의 원인)', () => {
    expect(tour).toContain('let stepping = false');
    // step() 첫 줄에서 되돌려보내야 한다 — 쌓아 두면 결국 또 건너뛴다
    expect(tour).toMatch(/async function step\(delta\) \{\s*\n\s*if \(stepping\) return;/);
  });

  it('⭐⭐ 대상 없는 단계 건너뛰기가 자기 가드에 막히지 않는다', () => {
    // renderStep 은 step() 안에서 돈다. 여기서 step(+1)을 부르면 stepping 에 스스로 막힌다.
    const skip = blockBetween(tour, '단계를 건너뜁니다 (대상 없음)', 'const pop = getPop()');
    expect(skip).toContain('tourIndex += 1');
    expect(skip).not.toContain('await step(+1)');
  });

  it('⭐ 누르면 즉시 잠긴다 (반응 없어 보여서 또 누르는 걸 막는다)', () => {
    expect(tour).toContain('function markBusy()');
    expect(tour).toContain("card.classList.add('is-busy')");
    expect(tour).toContain('b.disabled = true');
  });

  it('⭐⭐ 카드가 아래에 안 들어가면 위로 뒤집는다 (화면 밖으로 잘리던 원인)', () => {
    expect(tour).toContain('function placeNear(');
    expect(tour).toContain('const roomBelow =');
    expect(tour).toContain('const roomAbove =');
    // 예전엔 카드 높이를 무시하고 innerHeight - 40 으로만 잘랐다
    expect(tour).not.toContain('window.innerHeight - 40');
    expect(tour).toContain('vh - h - EDGE');
  });

  it('⭐ 스포트라이트로 위치를 분명히 한다', () => {
    expect(tour).toContain('.ut-hole');
    expect(tour).toContain('function placeSpotlight(');
    expect(tour).toContain('box-shadow:0 0 0 9999px');
  });

  it('⭐ 스포트라이트에 레이아웃 전환을 걸지 않는다 (9999px 그림자 재도색)', () => {
    const hole = tour.slice(tour.indexOf('.ut-hole {'), tour.indexOf('.ut-ring {'));
    expect(hole).not.toContain('transition');
  });

  it('⭐ 스크롤을 부드럽게 하지 않는다 (좌표가 흔들려 대기가 필요했다)', () => {
    expect(tour).not.toContain("behavior: 'smooth'");
    expect(tour).toContain("behavior: 'auto'");
    expect(tour).toContain('function nextFrame()');
  });

  it('대상이 움직이면 계속 따라간다 (예전엔 resize 한 번뿐이었다)', () => {
    expect(tour).toContain('function trackTargets(');
    expect(tour).toContain("document.addEventListener('scroll', reposition, true)");
    // 끝날 때 반드시 뗀다 — 안 떼면 투어가 끝나도 계속 돈다
    expect(tour).toMatch(/function endTour[\s\S]*?stopTracking\(\)/);
  });
});
