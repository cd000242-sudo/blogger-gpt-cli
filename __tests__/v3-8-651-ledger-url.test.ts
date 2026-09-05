const fs = require('fs');
const os = require('os');
const path = require('path');

import {
  appendLedgerEntry,
  attachUrlToLedger,
  readLedger,
  defaultLedgerPath,
  type LedgerEntry,
} from '../src/core/final/publish-ledger';
import { blockBetween } from './helpers/source-block';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.651 — 발행 주소를 장부에 채운다.
 *
 * 사장님: "생성된 글목록에 글 rpm 값도 보이게 가능하겠네?"
 *        "어차피 생성된 글목록에 url이보이자나"
 *
 * 맞는 지적이었다. RPM 표시 자체는 글목록의 url 만으로 된다 — 장부가 필요 없다.
 * 다만 **편당 비용**(costUsd, v3.8.650)은 장부에 있다. "250원 써서 얼마 벌었나" 를
 * 보려면 둘을 이어야 하고, 그 열쇠가 주소다. 제목으로 이으면 제목을 고치는 순간 끊긴다
 * (실제로 오늘 발행글 제목을 하나 고쳤다).
 *
 * 장부는 생성이 끝날 때 쓰이므로 그때는 주소를 모른다. 발행 성공 자리에서 채운다.
 * 9/21 에 애드센스가 풀렸을 때 **오늘 쌓은 줄들도 이어지려면** 지금부터 채워야 한다.
 */
describe('v3.8.651 발행 주소 잇기', () => {
  let ledger: string;

  beforeEach(() => {
    ledger = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-url-')), 'publish-ledger.json');
  });

  const 한줄 = (over: Partial<LedgerEntry> = {}): LedgerEntry => ({
    at: new Date().toISOString(), url: '', title: '환경개선부담금 면제 안내', keyword: '환경개선부담금', ...over,
  });

  describe('채우기', () => {
    test('제목이 같은 줄에 주소를 넣는다', () => {
      appendLedgerEntry(ledger, 한줄());
      expect(attachUrlToLedger(ledger, '환경개선부담금 면제 안내', 'https://leadernam.com/a')).toBe(true);
      expect(readLedger(ledger)[0]!.url).toBe('https://leadernam.com/a');
    });

    /** 같은 제목으로 여러 번 발행해도 방금 것이 잡혀야 한다 */
    test('가장 최근의 빈 줄을 채운다', () => {
      appendLedgerEntry(ledger, 한줄({ url: 'https://leadernam.com/old' }));
      appendLedgerEntry(ledger, 한줄());
      attachUrlToLedger(ledger, '환경개선부담금 면제 안내', 'https://leadernam.com/new');
      const all = readLedger(ledger);
      expect(all[0]!.url).toBe('https://leadernam.com/old');
      expect(all[1]!.url).toBe('https://leadernam.com/new');
    });

    test('이미 채워진 줄은 안 건드린다', () => {
      appendLedgerEntry(ledger, 한줄({ url: 'https://leadernam.com/keep' }));
      expect(attachUrlToLedger(ledger, '환경개선부담금 면제 안내', 'https://leadernam.com/other')).toBe(false);
      expect(readLedger(ledger)[0]!.url).toBe('https://leadernam.com/keep');
    });

    test('맞는 제목이 없으면 아무것도 안 한다', () => {
      appendLedgerEntry(ledger, 한줄());
      expect(attachUrlToLedger(ledger, '다른 글', 'https://leadernam.com/x')).toBe(false);
      expect(readLedger(ledger)[0]!.url).toBe('');
    });

    /** 기록 하나 때문에 발행이 막히면 안 된다 */
    test('빈 값·없는 파일에도 터지지 않는다', () => {
      expect(attachUrlToLedger(ledger, '', 'https://x')).toBe(false);
      expect(attachUrlToLedger(ledger, '제목', '')).toBe(false);
      expect(attachUrlToLedger(path.join(os.tmpdir(), '없는폴더', 'x.json'), '제목', 'https://x')).toBe(false);
    });
  });

  describe('경로는 한 곳에서만 정한다', () => {
    /** 두 벌로 두면 한쪽만 바뀌었을 때 서로 다른 파일을 본다 */
    test('orchestration 이 같은 함수를 쓴다', () => {
      expect(read('src/core/final/orchestration.ts'))
        .toContain("require('./publish-ledger').defaultLedgerPath()");
    });

    test('앱도 같은 함수를 쓴다', () => {
      expect(read('electron/main.ts')).toContain('defaultLedgerPath()');
    });

    test('환경변수로 바꿀 수 있다', () => {
      const before = process.env['PUBLISH_LEDGER_PATH'];
      process.env['PUBLISH_LEDGER_PATH'] = 'C:/tmp/x.json';
      expect(defaultLedgerPath()).toBe('C:/tmp/x.json');
      if (before === undefined) delete process.env['PUBLISH_LEDGER_PATH'];
      else process.env['PUBLISH_LEDGER_PATH'] = before;
    });
  });

  describe('발행 경로에 배선돼 있다', () => {
    const main = read('electron/main.ts');

    test('발행 성공 자리에서 채운다', () => {
      const block = blockBetween(main, '[RUN-POST] ✅ 발행 성공', 'freeTrialPublish');
      expect(block).toContain('attachUrlToLedger');
      expect(block).toContain('publishResult.url');
    });

    /** 장부 기록 실패가 발행을 되돌리면 안 된다 */
    test('실패해도 발행은 그대로 간다', () => {
      const block = blockBetween(main, 'attachUrlToLedger', 'freeTrialPublish');
      expect(block).toContain('catch');
    });
  });
});
