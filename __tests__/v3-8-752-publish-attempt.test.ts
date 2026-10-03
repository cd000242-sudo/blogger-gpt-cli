const fs = require('fs');
const os = require('os');
const path = require('path');

import {
  appendLedgerEntry,
  readLedger,
  recordPublishAttempt,
  unlinkedAttemptsPath,
  type LedgerEntry,
} from '../src/core/final/publish-ledger';
import { blockBetween, braceBlock } from './helpers/source-block';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.752 (감사 F13) — 발행 시도를 run ID 로 장부 줄에 잇는다.
 *
 * A 글(2026-09-28 23:52): 블로거 invalid_grant 실패 → 대기열 보관 → 워드프레스로 바꿔 재발행(publish-content) 성공.
 * 생성은 1회인데 장부 url 은 빈칸이었다 — publish-content 에 장부 배선이 없었고, attachUrlToLedger 는 제목으로 추측했다.
 */
describe('v3.8.752 발행 시도 run 연결', () => {
  let ledger: string;
  const 한줄 = (over: Partial<LedgerEntry> = {}): LedgerEntry => ({ at: new Date().toISOString(), url: '', title: '2026년 청년미래적금 VS 청년 도약계좌', keyword: '청년미래적금', ...over });

  beforeEach(() => {
    ledger = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-run-')), 'publish-ledger.json');
  });

  /** 테스트 9 — 블로거 실패 → 워드프레스 성공이 원래 run 에 이어진다 */
  test('실패 뒤 다른 플랫폼 성공이 같은 run 줄에 붙는다', () => {
    appendLedgerEntry(ledger, 한줄({ runId: '20260928-234647-a1b2c3' }));
    const fail = recordPublishAttempt(ledger, { runId: '20260928-234647-a1b2c3', platform: 'blogspot', ok: false, error: 'invalid_grant', source: 'run-post' });
    expect(fail.linked).toBe(true);
    const ok = recordPublishAttempt(ledger, { runId: '20260928-234647-a1b2c3', platform: 'wordpress', ok: true, url: 'https://leadernam.com/subsidy/a', postId: '5922', source: 'publish-content' });
    expect(ok.linked).toBe(true);
    const [e] = readLedger(ledger);
    expect(e!.url).toBe('https://leadernam.com/subsidy/a');
    expect(e!.publishAttempts).toHaveLength(2);
    expect(e!.publishAttempts![0]).toMatchObject({ platform: 'blogspot', ok: false, error: 'invalid_grant', source: 'run-post' });
    expect(e!.publishAttempts![1]).toMatchObject({ platform: 'wordpress', ok: true, url: 'https://leadernam.com/subsidy/a', postId: '5922' });
    // 뒤따르는 실패가 성공 url 을 지우지 않는다
    recordPublishAttempt(ledger, { runId: '20260928-234647-a1b2c3', platform: 'tistory', ok: false, error: 'timeout' });
    expect(readLedger(ledger)[0]!.url).toBe('https://leadernam.com/subsidy/a');
  });

  /** 테스트 10 — 같은 제목 다른 글에는 붙지 않는다 (가장 최근 줄이 아니라 그 run 의 줄) */
  test('제목이 같아도 다른 run 에는 붙지 않는다', () => {
    appendLedgerEntry(ledger, 한줄({ runId: '20260928-234647-aaaaaa' }));
    appendLedgerEntry(ledger, 한줄({ runId: '20260929-101010-bbbbbb' }));   // 같은 제목, 더 최근
    recordPublishAttempt(ledger, { runId: '20260928-234647-aaaaaa', platform: 'wordpress', ok: true, url: 'https://x/a' });
    const [older, newer] = readLedger(ledger);
    expect(older!.url).toBe('https://x/a');
    expect(newer!.url).toBe('');
    expect(newer!.publishAttempts).toBeUndefined();
  });

  /** 테스트 11 — 같은 응답 재처리·재시도로 같은 url 이 두 번 붙지 않는다 */
  test('같은 성공 url 은 한 번만', () => {
    appendLedgerEntry(ledger, 한줄({ runId: '20260928-234647-cccccc' }));
    const first = recordPublishAttempt(ledger, { runId: '20260928-234647-cccccc', platform: 'wordpress', ok: true, url: 'https://x/c' });
    const again = recordPublishAttempt(ledger, { runId: '20260928-234647-cccccc', platform: 'wordpress', ok: true, url: 'https://x/c' });
    expect(first.duplicate).toBe(false);
    expect(again).toMatchObject({ linked: true, duplicate: true });
    expect(readLedger(ledger)[0]!.publishAttempts).toHaveLength(1);
  });

  /** 테스트 12 — run ID 가 없으면 제목으로 추측하지 않고 미연결로 남긴다 */
  test('run ID 없으면 미연결 기록', () => {
    appendLedgerEntry(ledger, 한줄({ runId: '20260928-234647-dddddd' }));
    const rec = recordPublishAttempt(ledger, { platform: 'wordpress', ok: true, url: 'https://x/d' });
    expect(rec).toMatchObject({ linked: false, unlinked: true });
    expect(readLedger(ledger)[0]!.url).toBe('');            // 제목이 같아도 붙이지 않는다
    const unlinked = JSON.parse(fs.readFileSync(unlinkedAttemptsPath(ledger), 'utf8'));
    expect(unlinked).toHaveLength(1);
    expect(unlinked[0]).toMatchObject({ url: 'https://x/d', unlinkedReason: 'NO_RUN_ID' });
    // 장부에 없는 run 도 미연결
    const missing = recordPublishAttempt(ledger, { runId: '20260101-000000-ffffff', platform: 'wordpress', ok: true, url: 'https://x/e' });
    expect(missing.unlinked).toBe(true);
    expect(JSON.parse(fs.readFileSync(unlinkedAttemptsPath(ledger), 'utf8'))[1]).toMatchObject({ runId: '20260101-000000-ffffff', unlinkedReason: 'RUN_NOT_IN_LEDGER' });
  });

  describe('배선 — 생성 1건 → 발행 시도(대상·결과·URL) 가 runId 로 이어진다', () => {
    const main = read('electron/main.ts');

    test('run-post 성공·실패 모두 시도로 남긴다', () => {
      const success = blockBetween(main, '[RUN-POST] ✅ 발행 성공', 'freeTrialPublish');
      expect(success).toContain('recordPublishAttemptSafely({');
      expect(success).toContain("runId: String(result?.runId || '')");
      expect(success).toContain('publishResult.url');
      expect(success).not.toContain('attachUrlToLedger(');   // 제목으로 잇던 호출은 뺐다
      const failure = blockBetween(main, '[RUN-POST] 발행 최종 실패', 'publishError: lastPublishError');
      expect(failure).toContain('recordPublishAttemptSafely({');
      expect(failure).toContain('ok: false');
    });

    test('publish-content(편집기·대기열 재발행) 도 잇는다', () => {
      const block = blockBetween(main, /const result = await publishGeneratedContent\(\s+data\.payload, data\.title, data\.content, data\.thumbnailUrl, publishOnLog,/, "console.log('[PUBLISH] 발행 결과:'");
      expect(block).toContain('recordPublishAttemptSafely({');
      expect(block).toContain("runId: String(data?.runId || data?.payload?.runId || '')");
      expect(block).toContain("source: 'publish-content'");
    });

    /** 기록 실패가 발행을 되돌리면 안 된다 */
    test('기록 실패는 삼킨다', () => {
      // braceBlock 은 매개변수 타입의 `{` 를 먼저 잡으므로 다음 함수 선언까지로 자른다
      const helper = blockBetween(main, 'function recordPublishAttemptSafely(', 'function publishTargetOf(');
      expect(helper).toContain('catch');
      expect(helper).toContain("require('../dist/core/final/publish-ledger')");
      expect(helper).toContain('appendRunTracePublishAttempt');
    });

    test('UI 가 runId 를 실어 나른다 — 생성 결과 → 대기열 항목 → 재발행 요청', () => {
      const posting = read('electron/ui/modules/posting.js');
      expect(blockBetween(posting, 'function saveToRepublishQueue(', "localStorage.getItem('pendingRepublishQueue')")).toContain("runId: entry.runId || ''");
      expect(posting).toContain("runId: result.runId || ''");
      expect(posting).toContain("runId: appState.generatedContent.runId || ''");
      const preview = read('electron/ui/modules/preview.js');
      expect(braceBlock(preview, 'export function buildRepublishData(')).toContain("runId: item?.runId || ''");
    });

    test('orchestration 이 runId 를 만들고 장부·결과에 싣는다', () => {
      const src = read('src/core/final/orchestration.ts');
      expect(src).toContain('runId = traceMod.newRunId();');
      expect(blockBetween(src, 'appendLedgerEntry(ledgerPath(), {', "trace.snapshot('ledger.entry'")).toContain('runId,');
    });
  });
});
