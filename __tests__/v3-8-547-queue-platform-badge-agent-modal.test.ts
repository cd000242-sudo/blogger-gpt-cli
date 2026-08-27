/**
 * v3.8.547 — 사장님 실보고 3건
 *
 *  ① 연속발행(대기열)에서 플랫폼을 못 고친다 → 큐를 다 지우고 다시 담아야 했다
 *  ② 헤더 배지(플랫폼·AI 모델)를 눌러도 드롭다운이 안 뜬다 (v3.8.534/535/544 가 세 번 실패)
 *  ③ 에이전트 모드 글 생성 모달만 스킨이 다르다 → 같은 경로·같은 모달로 통일
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween, braceBlock } from './helpers/source-block';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const queue = read('electron/ui/modules/publish-queue.js');
const badges = read('electron/ui/modules/header-badges.js');
const posting = read('electron/ui/modules/posting.js');

// ══════════════════════════════════════════════════════════
describe('① 대기열에서 플랫폼을 바꿀 수 있다', () => {
  it('항목 카드의 플랫폼 칸이 읽기 전용 span 이 아니라 select 다', () => {
    expect(queue).toContain('class="pq-item-platform"');
    // 이전 구현의 안내 문구가 남아 있으면 아직 span 이라는 뜻
    expect(queue).not.toContain('상단 플랫폼 설정 기준');
  });

  it('세 플랫폼이 모두 선택지에 있다', () => {
    const block = braceBlock(queue, 'function buildItemRow');
    ['blogspot', 'wordpress', 'tistory'].forEach((v) => {
      expect(block).toContain(`<option value="${v}"`);
    });
  });

  it('바꾸면 item.platform 에 저장되고 카드를 다시 그린다 (카테고리 칸이 플랫폼별이라)', () => {
    const block = braceBlock(queue, "row.querySelector('.pq-item-platform')");
    expect(block).toContain('item.platform = normalizeQueuePlatform');
    expect(block).toContain('saveItem()');
    expect(block).toContain('refreshList()');
  });

  it('발행 payload 가 항목별 플랫폼을 쓴다 (배지만 바뀌고 발행은 그대로면 무의미)', () => {
    const block = braceBlock(queue, 'function buildQueuePayloadOverrides');
    expect(block).toContain('platform: normalizeQueuePlatform(item.platform');
    expect(block).toContain('targetPlatform: normalizeQueuePlatform(item.platform');
  });

  it('일괄 적용 칸에도 플랫폼이 살아났고, 같은 id 의 숨은 더미가 남아 있지 않다', () => {
    // 더미가 남으면 getElementById 가 빈 칸을 집어 "일괄 적용해도 무동작" 이 된다 (조용한 미배선)
    const ids = queue.match(/id="pq-bulk-platform"/g) || [];
    expect(ids).toHaveLength(1);
    expect(queue).not.toMatch(/<select id="pq-bulk-platform" style="display:none;">/);
    // ⚠️ v3.8.563: 'pq-bulk-apply' 만으로는 표식이 흔들린다 —
    //    마크업(버튼 정의)과 blockOnUnappliedBulkSchedule 의 scrollIntoView 도 같은 문자열을 갖는다.
    //    실제로 그 함수가 추가되자 이 테스트가 엉뚱한 블록을 잡아 깨졌다.
    //    리스너 등록 지점으로 표식을 좁힌다.
    const applyBlock = braceBlock(queue, "document.getElementById('pq-bulk-apply')?.addEventListener");
    expect(applyBlock).toContain('item.platform = normalizeQueuePlatform(p)');
  });
});

// ══════════════════════════════════════════════════════════
describe('② 배지 드롭다운이 최상위 레이어로 뜬다', () => {
  it('popover 로 띄운다 — 조상의 overflow·filter·stacking context 를 전부 무효화한다', () => {
    expect(badges).toContain("pop.setAttribute('popover', 'manual')");
    expect(badges).toContain('pop.showPopover()');
    expect(badges).toContain('hidePopover()');
  });

  it('UA 가 [popover] 에 거는 기본 스타일을 되돌린다 (안 그러면 좌표가 안 먹는다)', () => {
    expect(badges).toContain('inset:auto');
    expect(badges).toContain('.hb-pop:popover-open { display:block; }');
  });

  it('body 부착과 좌표 계산은 그대로 유지된다 (v3.8.544 의 절반은 맞았다)', () => {
    expect(badges).toContain('document.body.appendChild(pop)');
    expect(badges).toContain('getBoundingClientRect()');
  });

  it('스크롤이 나면 닫지 않고 따라간다 — 배경 로그 한 줄에 팝오버가 닫히던 경로를 막는다', () => {
    expect(badges).toContain("document.addEventListener('scroll', repositionOpenPops, true)");
    expect(badges).not.toContain("document.addEventListener('scroll', closeAllPops, true)");
  });
});

// ══════════════════════════════════════════════════════════
describe('③ 에이전트 모드가 API 모드와 같은 진행 모달을 쓴다', () => {
  const ensure = braceBlock(posting, 'function ensureAgentProgressModal');

  it('표준 모달 DOM 을 갈아끼우지 않는다', () => {
    expect(ensure).not.toContain('overlay.innerHTML');
    expect(ensure).not.toContain('agentProgressPanel');
    expect(posting).not.toContain('agent-progress-mode');
  });

  it('전용 패널의 잔재(전용 진행바·미니바·전용 로그)가 소스에 남아 있지 않다', () => {
    ['agentProgressFill', 'agentProgressInlineLog', 'agentMiniBar', 'agentGeneratedImageGrid']
      .forEach((id) => expect(posting).not.toContain(id));
  });

  it('진행률은 API 모드와 같은 ProgressManager 로 흐른다', () => {
    const update = braceBlock(posting, 'function updateAgentProgressModal');
    expect(update).toContain('getProgressManager()');
    expect(update).toContain('progressManager.updateProgress(');
  });

  it('생성 이미지 미리보기는 표준 모달의 발행 로그 안에 붙고, 클릭하면 lightbox 가 열린다', () => {
    // 기본값 `image = {}` 때문에 braceBlock 의 첫 중괄호가 인자 자리에 걸린다 — 경계로 자른다
    const append = blockBetween(
      posting,
      'function appendAgentGeneratedImagePreview',
      'function scrollProgressLogToBottom',
    );
    expect(append).toContain("document.getElementById('progressLogContent')");
    expect(append).toContain('window.openImageLightbox?.(url, labelText)');
  });

  it('발행 후 모달을 붙잡아 두던 전용 플래그를 더 이상 켜지 않는다 (API 모드와 같은 닫힘)', () => {
    expect(posting).not.toContain('window.__agentProgressActive = true');
  });
});
