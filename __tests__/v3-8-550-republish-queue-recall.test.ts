/**
 * v3.8.550 — "발행 도중에 실패한 거 자동으로 기억하던데 이걸 불러오지는 못하네..?"
 *
 * ## 실측한 원인
 *   저장은 정상이었다(localStorage 'pendingRepublishQueue').
 *   그런데 **저장 직후 배너를 다시 그리는 호출이 없었다.**
 *   renderRepublishQueueBanner() 를 부르는 곳은 앱 시작(main.js, 2초 뒤)과 미리보기 표시뿐이라,
 *   실패한 그 자리에서는 화면에 아무것도 안 나타났다 — 앱을 껐다 켜야만 보였다.
 *
 * ## 같이 드러난 구멍
 *   Agent 모드 발행 실패는 위쪽 API 경로보다 먼저 return 해서 **저장 자체를 안 탔다.**
 *   Agent 가 글을 다 써놓고 발행만 실패하면 그 글이 그냥 사라졌다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween, braceBlock } from './helpers/source-block';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const posting = read('electron/ui/modules/posting.js');
const preview = read('electron/ui/modules/preview.js');
const html    = read('electron/ui/index.html');
const preload = read('electron/preload.js');
const mainTs  = read('electron/main.ts');

// ══════════════════════════════════════════════════════════
describe('① 실패하면 그 자리에서 바로 보인다', () => {
  // 기본값 `entry = {}` 때문에 braceBlock 의 첫 중괄호가 인자 자리에 걸린다 — 경계로 자른다
  const saver = blockBetween(posting, 'function saveToRepublishQueue', 'function restoreKeywordInputInteractivity');

  it('저장 직후 배너를 다시 그린다 — 이 한 줄이 빠져서 못 불러왔다', () => {
    expect(saver).toContain("localStorage.setItem('pendingRepublishQueue'");
    expect(saver).toContain('window.renderRepublishQueueBanner?.()');
    // 저장 → 렌더 순서여야 한다 (렌더가 먼저면 방금 담은 항목이 안 보인다)
    expect(saver.indexOf("localStorage.setItem('pendingRepublishQueue'"))
      .toBeLessThan(saver.indexOf('window.renderRepublishQueueBanner?.()'));
  });

  it('본문이 없으면 담지 않는다 — 재발행할 수 없는 빈 항목이 쌓이면 안 된다', () => {
    expect(saver).toContain('if (!entry.html)');
  });

  it('안내 문구가 실제 배너 위치를 가리킨다 (예전엔 "미리보기 탭"이라 엉뚱한 곳을 찾게 했다)', () => {
    expect(saver).toContain('글포스팅 화면 발행 버튼 아래');
    expect(posting).not.toContain('미리보기 탭에서 [🚀 재발행] 클릭');
  });

  it('최대 20개만 보관한다 (기존 정책 유지)', () => {
    expect(saver).toContain('queue.length > 20');
  });
});

// ══════════════════════════════════════════════════════════
describe('② 저장 자리는 한 함수를 쓴다', () => {
  it('API 경로가 saveToRepublishQueue 를 쓴다', () => {
    expect(posting).toContain('saveToRepublishQueue({');
    // 예전처럼 자리마다 직접 localStorage 를 만지지 않는다 (한쪽만 고쳐지면 또 갈라진다)
    const writes = posting.match(/localStorage\.setItem\('pendingRepublishQueue'/g) || [];
    expect(writes).toHaveLength(1);
  });

  it('⭐ Agent 모드 발행 실패도 글을 보관한다 (예전엔 이 경로가 저장을 아예 안 탔다)', () => {
    const agentBlock = blockBetween(
      posting,
      'const publishResult = await publishToPlatform()',
      'return finalResult;',
    );
    expect(agentBlock).toContain('if (!publishedOk)');
    expect(agentBlock).toContain('saveToRepublishQueue({');
    expect(agentBlock).toContain("lastError: publishResult?.error || 'agent_publish_failed'");
  });

  it('성공했을 때는 담지 않는다', () => {
    const agentBlock = blockBetween(
      posting,
      'const publishResult = await publishToPlatform()',
      'return finalResult;',
    );
    const guardIdx = agentBlock.indexOf('if (!publishedOk)');
    const saveIdx = agentBlock.indexOf('saveToRepublishQueue({');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(saveIdx).toBeGreaterThan(guardIdx);   // 저장이 실패 가드 안에 있다
  });
});

// ══════════════════════════════════════════════════════════
describe('③ 불러오는 쪽 배선 — 끝까지 이어져 있는가', () => {
  it('배너가 붙을 자리가 화면에 실제로 있다', () => {
    expect(html).toContain('id="republishQueueContainer"');
    expect(preview).toContain("document.getElementById('republishQueueContainer')");
  });

  it('배너 렌더 함수가 전역으로 등록된다 (posting.js 가 이름으로 부른다)', () => {
    expect(preview).toContain('window.renderRepublishQueueBanner = renderRepublishQueueBanner');
  });

  it('⭐ [🚀 재발행] 이 실제 IPC 까지 닿는다 — 보내는 쪽과 받는 쪽이 둘 다 있어야 한다', () => {
    expect(preview).toContain("window.electronAPI.invoke('publish-content'");
    expect(preload).toContain('invoke: (channel, ...args) =>');
    expect(mainTs).toContain("ipcMain.handle('publish-content'");
  });

  it('재발행에 성공하면 대기열에서 빠진다', () => {
    const btn = braceBlock(preview, "banner.querySelectorAll('.republishBtn')");
    expect(btn).toContain('currentQueue.filter(x => x.id !== id)');
    expect(btn).toContain('renderRepublishQueueBanner()');
  });
});
