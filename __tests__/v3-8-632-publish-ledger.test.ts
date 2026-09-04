const fs = require('fs');
const os = require('os');
const path = require('path');

import {
  appendLedgerEntry,
  readLedger,
  summarizeLedger,
  describeLedger,
  OVERLAP_THRESHOLD,
  type LedgerEntry,
} from '../src/core/final/publish-ledger';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.632 — 발행 장부.
 *
 * 사장님: "어떤 키워드가 RPM이 높은지는 글을 써봐야할수있으니까"
 *
 * 맞는 말이라서 문제가 된다. RPM 은 애드센스가 나중에 주는데(9/21 복구),
 * 그때 받은 수치를 어느 글의 것인지 이어붙이려면 **지금** 기록이 있어야 한다.
 * 하네스 점수도 자기중복도 지금은 로그로 흘려보내고 끝이라,
 * 17일 뒤에 "품질이 올랐나 · 중복이 늘었나" 를 물으면 답할 수 없었다.
 */
describe('v3.8.632 발행 장부', () => {
  let dir: string;
  let ledger: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-'));
    ledger = path.join(dir, 'publish-ledger.json');
  });

  const 한줄 = (over: Partial<LedgerEntry> = {}): LedgerEntry => ({
    at: new Date().toISOString(),
    url: '',
    title: '제목',
    keyword: '키워드',
    ...over,
  });

  describe('쌓기', () => {
    test('한 줄씩 이어 붙인다', () => {
      appendLedgerEntry(ledger, 한줄({ auditScore: 70 }));
      appendLedgerEntry(ledger, 한줄({ auditScore: 80 }));
      expect(readLedger(ledger)).toHaveLength(2);
    });

    test('폴더가 없어도 만들어 쓴다', () => {
      const deep = path.join(dir, '없던', '폴더', 'ledger.json');
      expect(appendLedgerEntry(deep, 한줄())).toBe(true);
      expect(readLedger(deep)).toHaveLength(1);
    });

    /** 기록 하나 때문에 발행이 막히면 안 된다 */
    test('장부가 깨져 있으면 버리고 새로 시작한다', () => {
      fs.writeFileSync(ledger, '{망가짐', 'utf-8');
      expect(appendLedgerEntry(ledger, 한줄())).toBe(true);
      expect(readLedger(ledger)).toHaveLength(1);
    });

    test('못 쓰는 경로여도 예외를 던지지 않는다', () => {
      // 파일을 폴더 자리에 두어 쓰기가 실패하게 만든다
      const blocked = path.join(dir, '파일');
      fs.writeFileSync(blocked, 'x', 'utf-8');
      expect(appendLedgerEntry(path.join(blocked, 'ledger.json'), 한줄())).toBe(false);
    });

    test('없는 장부를 읽어도 빈 배열', () => {
      expect(readLedger(path.join(dir, '없음.json'))).toEqual([]);
    });

    test('무한정 커지지 않는다', () => {
      for (let i = 0; i < 1005; i++) appendLedgerEntry(ledger, 한줄({ title: '글' + i }));
      const all = readLedger(ledger);
      expect(all.length).toBeLessThanOrEqual(1000);
      // 오래된 것부터 버린다 — 최근 것이 남아야 추세를 본다
      expect(all[all.length - 1]!.title).toBe('글1004');
    });
  });

  describe('요약 — 17일 뒤에 답해야 할 것들', () => {
    /** 한 편은 못 믿는다. 여러 편을 모아야 뜻이 생긴다 */
    test('중간값을 쓴다 — 한 편이 튀어도 안 흔들린다', () => {
      for (const s of [70, 72, 71, 5, 73]) appendLedgerEntry(ledger, 한줄({ auditScore: s }));
      const sum = summarizeLedger(readLedger(ledger));
      expect(sum.medianScore).toBe(71);   // 평균이면 58 로 끌려간다
    });

    test('최근 흐름을 따로 본다 — 좋아지고 있는지가 핵심이다', () => {
      for (let i = 0; i < 20; i++) appendLedgerEntry(ledger, 한줄({ auditScore: 50 }));
      for (let i = 0; i < 10; i++) appendLedgerEntry(ledger, 한줄({ auditScore: 90 }));
      const sum = summarizeLedger(readLedger(ledger));
      expect(sum.recentMedianScore).toBe(90);
      expect(sum.recentMedianScore!).toBeGreaterThan(sum.medianScore!);
    });

    test('중복 경고 편수를 센다 — 하루 편수를 올려도 되는지의 근거', () => {
      appendLedgerEntry(ledger, 한줄({ selfOverlapMax: 0.42 }));
      appendLedgerEntry(ledger, 한줄({ selfOverlapMax: 0.08 }));
      expect(summarizeLedger(readLedger(ledger)).overlapFlagged).toBe(1);
    });

    test('임계값은 실측에서 나온 0.35 를 쓴다', () => {
      expect(OVERLAP_THRESHOLD).toBe(0.35);
      // self-overlap.ts 가 322편 51,681쌍으로 잰 값이다
      expect(read('src/core/self-overlap.ts')).toContain('51,681');
    });

    test('자가수정 비율을 낸다 — 낮아질수록 첫 생성이 좋아진 것이다', () => {
      appendLedgerEntry(ledger, 한줄({ preflightRevised: 1 }));
      appendLedgerEntry(ledger, 한줄({ preflightRevised: 0 }));
      expect(summarizeLedger(readLedger(ledger)).revisedRate).toBe(0.5);
    });

    test('자주 잡힌 결함을 알려준다 — 다음에 뭘 고칠지', () => {
      appendLedgerEntry(ledger, 한줄({ auditKinds: { 'glued-sentence': 3, 'tone-mix': 1 } }));
      appendLedgerEntry(ledger, 한줄({ auditKinds: { 'glued-sentence': 2 } }));
      const top = summarizeLedger(readLedger(ledger)).topIssues;
      expect(top[0]).toEqual({ kind: 'glued-sentence', count: 5 });
    });

    test('빈 장부에도 터지지 않는다', () => {
      const sum = summarizeLedger([]);
      expect(sum.count).toBe(0);
      expect(sum.medianScore).toBeNull();
      expect(sum.revisedRate).toBeNull();
      expect(describeLedger(sum)).toContain('비어 있습니다');
    });

    test('한 줄 요약이 수치를 그대로 말한다', () => {
      for (let i = 0; i < 12; i++) appendLedgerEntry(ledger, 한줄({ auditScore: 80, preflightRevised: 0 }));
      const line = describeLedger(summarizeLedger(readLedger(ledger)));
      expect(line).toContain('12편');
      expect(line).toContain('80점');
      expect(line).toContain('자가수정');
    });
  });

  describe('RPM 을 나중에 채울 자리', () => {
    test('rpm·pageviews 칸이 비어 있어도 기록된다', () => {
      appendLedgerEntry(ledger, 한줄({ auditScore: 70 }));
      const e = readLedger(ledger)[0]!;
      expect(e.rpm).toBeUndefined();
      expect(e.pageviews).toBeUndefined();
    });

    test('나중에 채운 값이 그대로 남는다', () => {
      appendLedgerEntry(ledger, 한줄({ rpm: 5200, pageviews: 340 }));
      expect(readLedger(ledger)[0]!.rpm).toBe(5200);
    });

    /** RPM 이 오면 줄기별로 묶어야 한다 — 한 편의 RPM 은 표본이 하나라 못 믿는다 */
    test('리포트 슬롯·등급을 남겨 줄기별로 묶을 수 있게 한다', () => {
      appendLedgerEntry(ledger, 한줄({ reportSlot: 'C', reportGrade: 'A (종합 10)' }));
      const e = readLedger(ledger)[0]!;
      expect(e.reportSlot).toBe('C');
      expect(e.reportGrade).toContain('종합 10');
    });
  });

  describe('발행 경로에 배선돼 있다', () => {
    const orch = read('src/core/final/orchestration.ts');

    test('발행 직전에 장부를 쓴다', () => {
      expect(orch).toContain('appendLedgerEntry(ledgerPath()');
    });

    test('자기중복 측정값을 붙잡아 넘긴다 — 로그로 흘려보내지 않는다', () => {
      expect(orch).toContain('__lastSelfOverlap');
      expect(orch).toContain('selfOverlapMax:');
    });

    test('자가 수정 결과도 넘긴다', () => {
      expect(orch).toContain('__lastPreflight');
      expect(orch).toContain('preflightRevised:');
    });

    test('기록 실패가 발행을 막지 않는다', () => {
      const at = orch.indexOf('appendLedgerEntry(ledgerPath()');
      const tail = orch.slice(at, orch.indexOf('const beforeRepair = findEmptyBlocks(html);', at));
      expect(tail).toContain('catch');
      expect(tail).toContain('발행 조건이 아니다');
    });

    test('경로를 앱이 넣어 줄 수 있다 — orchestration 은 Electron 을 모른다', () => {
      expect(orch).toContain("process.env['PUBLISH_LEDGER_PATH']");
    });
  });
});
