const fs = require('fs');
const path = require('path');

import {
  normalizeKeyword,
  buildPublishedIndex,
  isSlotPublished,
  splitSlotsByPublished,
  dayKeywords,
  MIN_CONTAINS_CHARS,
  type PublishedStore,
} from '../src/core/keywords/published-match';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/** 표식 사이만 자른다 — 고정 길이 slice 는 코드가 몇 줄만 밀려도 헛것을 검사한다 */
function blockBetween(source: string, startMarker: string, endMarker: string): string {
  const from = source.indexOf(startMarker);
  if (from === -1) throw new Error('시작 표시를 못 찾음: ' + startMarker);
  const to = source.indexOf(endMarker, from + startMarker.length);
  return to === -1 ? source.slice(from) : source.slice(from, to);
}

/*
 * v3.8.635 — 이미 쓴 키워드는 접고, 달력은 키워드로 말한다.
 *
 * 사장님: "발행된건 자연스럽게 이전으로 해주고 달력이있으니까 달력별로
 *          어떤키워드를 올려놧는지보여주고 발행됫으면 자연스럽게
 *          발행된키워드는 숨겨지게 가능하니?"
 *
 * 이 검사는 **양쪽이 다 중요하다**:
 *   못 숨기면 → 같은 키워드로 또 쓴다 (자기중복)
 *   헛것을 숨기면 → 아직 안 쓴 키워드가 조용히 사라진다 (더 나쁘다)
 */
describe('v3.8.635 이미 쓴 키워드', () => {
  const 기록 = (over: any = {}): PublishedStore => ({
    '2026-09-04': [{ title: '실업급여 조건 총정리', keyword: '실업급여 조건', ...over }],
  });

  describe('같은 말로 보는 범위', () => {
    test('띄어쓰기가 달라도 같은 말이다', () => {
      expect(normalizeKeyword('실업 급여 조건')).toBe(normalizeKeyword('실업급여조건'));
    });

    test('기호·대소문자도 무시한다', () => {
      expect(normalizeKeyword('[속보] 실업급여!')).toBe(normalizeKeyword('속보 실업급여'));
      expect(normalizeKeyword('AI 요약')).toBe(normalizeKeyword('ai요약'));
    });

    test('빈 값은 빈 문자열 — 빈 것끼리 같다고 하면 전부 발행된 것이 된다', () => {
      expect(normalizeKeyword(null)).toBe('');
      expect(normalizeKeyword(undefined)).toBe('');
    });
  });

  describe('이미 썼는가', () => {
    test('기록된 키워드가 같으면 썼다', () => {
      const idx = buildPublishedIndex(기록());
      expect(isSlotPublished({ keyword: '실업급여 조건' }, idx)).toBe(true);
    });

    /** 재발행 경로·손으로 쓴 글은 키워드가 안 남는다. 제목으로도 알아봐야 한다 */
    test('키워드가 안 적힌 기록도 제목으로 알아본다', () => {
      const idx = buildPublishedIndex({ '2026-09-04': [{ title: '실업급여 조건 총정리' }] });
      expect(isSlotPublished({ keyword: '실업급여 조건' }, idx)).toBe(true);
    });

    test('리포트가 준 확정 제목으로도 알아본다', () => {
      const idx = buildPublishedIndex(기록());
      expect(isSlotPublished({ title: '실업급여 조건 총정리' }, idx)).toBe(true);
    });

    /**
     * 이게 핵심이다. "환불" 같은 두 글자를 제목 안에서 찾으면 아무 글에나 걸려서
     * **아직 안 쓴 키워드가 조용히 사라진다.** 사장님은 그게 있었는지도 모른다.
     */
    test('짧은 말은 제목 안에서 찾지 않는다 — 헛것을 숨기면 영영 못 본다', () => {
      const idx = buildPublishedIndex({ '2026-09-04': [{ title: '보험료 환불 절차 정리' }] });
      expect(isSlotPublished({ keyword: '환불' }, idx)).toBe(false);
      expect(MIN_CONTAINS_CHARS).toBeGreaterThanOrEqual(5);
    });

    test('충분히 긴 말은 제목 안에서 찾는다', () => {
      const idx = buildPublishedIndex({ '2026-09-04': [{ title: '보험료 환불 절차 정리' }] });
      expect(isSlotPublished({ keyword: '보험료 환불 절차' }, idx)).toBe(true);
    });

    test('안 쓴 키워드는 안 썼다고 한다', () => {
      expect(isSlotPublished({ keyword: '국민연금 수령 나이' }, buildPublishedIndex(기록()))).toBe(false);
    });

    test('빈 슬롯·빈 기록에도 터지지 않는다', () => {
      expect(isSlotPublished({}, buildPublishedIndex({}))).toBe(false);
      expect(isSlotPublished({ keyword: 'x' }, buildPublishedIndex(null))).toBe(false);
    });

    /** 기록 모양이 깨져 있어도 발행 화면이 죽으면 안 된다 */
    test('배열이 아닌 값이 섞여 있어도 견딘다', () => {
      const idx = buildPublishedIndex({ '2026-09-04': null as any, '2026-09-05': [{ keyword: 'a' }] });
      expect(idx.keywords.has('a')).toBe(true);
    });
  });

  describe('가르기 — 지우지 않고 나눈다', () => {
    const 슬롯 = [
      { slot: 'A', keyword: '실업급여 조건' },
      { slot: 'B', keyword: '국민연금 수령 나이' },
    ];

    test('쓴 것과 안 쓴 것으로 나눈다', () => {
      const { todo, done } = splitSlotsByPublished(슬롯, 기록());
      expect(todo.map((s) => s.slot)).toEqual(['B']);
      expect(done.map((s) => s.slot)).toEqual(['A']);
    });

    /** 지워 버리면 "그거 언제 썼더라" 를 물을 수 없다 */
    test('쓴 것도 버리지 않는다', () => {
      const { todo, done } = splitSlotsByPublished(슬롯, 기록());
      expect(todo.length + done.length).toBe(슬롯.length);
    });

    test('기록이 없으면 전부 할 일이다', () => {
      expect(splitSlotsByPublished(슬롯, {}).todo).toHaveLength(2);
    });
  });

  describe('달력에 쓸 이름표', () => {
    test('제목이 아니라 키워드를 앞세운다', () => {
      expect(dayKeywords([{ title: '실업급여 조건 총정리', keyword: '실업급여 조건' }]))
        .toEqual(['실업급여 조건']);
    });

    /** 옛 기록에는 키워드가 없다 — 그래도 뭔가는 보여야 한다 */
    test('키워드가 없으면 제목으로 대신한다', () => {
      expect(dayKeywords([{ title: '옛날 글' }])).toEqual(['옛날 글']);
    });

    test('같은 키워드를 두 번 올렸으면 한 번만 센다', () => {
      expect(dayKeywords([{ keyword: '실업급여 조건' }, { keyword: '실업급여조건' }])).toHaveLength(1);
    });

    test('빈 기록에도 터지지 않는다', () => {
      expect(dayKeywords([])).toEqual([]);
      expect(dayKeywords(undefined)).toEqual([]);
    });
  });

  describe('세 화면에 배선돼 있다', () => {
    const main = read('electron/main.ts');
    const ui = read('electron/ui/index.html');
    const cal = read('electron/ui/modules/calendar.js');
    const posting = read('electron/ui/modules/posting.js');

    /** 판단이 화면마다 따로 있으면 "카드엔 숨겨졌는데 달력엔 없는" 상태가 된다 */
    test('판단은 한 곳(published-match)에서만 한다', () => {
      expect(main).toContain("require('../dist/core/keywords/published-match')");
      expect(ui).not.toContain('splitSlotsByPublished');
    });

    test('발행 기록을 화면이 넘겨준다 — 메인은 localStorage 를 못 본다', () => {
      expect(ui).toContain('function cpcPublishedDigest()');
      expect(ui).toContain("api.invoke('keywords:latest-report', { published: cpcPublishedDigest() })");
      expect(main).toContain('args?.published');
    });

    /** 썸네일이 data URL 로 들어 있어 통째로 넘기면 IPC 가 무거워진다 */
    test('넘길 때 판단에 필요한 것만 추린다', () => {
      const digest = blockBetween(ui, 'function cpcPublishedDigest()', 'function renderCpcDoneSlots');
      expect(digest).toContain('keyword:');
      expect(digest).toContain('title:');
      expect(digest).not.toContain('thumbnail');
    });

    test('드라이브 경로·폴더 경로 둘 다 거른다', () => {
      expect(main).toContain('splitByPublished(slots, published)');
      expect(main).toContain('splitByPublished(usableSlots(result.report), published)');
    });

    test('쓴 키워드는 접어서 보여 준다 — 지우지 않는다', () => {
      expect(ui).toContain('function renderCpcDoneSlots');
      expect(ui).toContain('이미 쓴 키워드 ');
      expect(ui).toContain('<details');
    });

    /** 다 썼는데 "슬롯이 없습니다" 라고 하면 리포트가 안 온 줄 안다 */
    test('다 써서 빈 것과 리포트가 없어서 빈 것을 구분해 말한다', () => {
      expect(ui).toContain('모두 발행했습니다');
    });

    test('발행 직후 카드가 다시 그려진다 — 방금 쓴 키워드가 남아 있으면 안 된다', () => {
      const hits = posting.split('window.loadCpcReport(false)').length - 1;
      expect(hits).toBe(2);   // 일반 발행 · 재발행 두 경로 모두
    });

    /** 이 경로에 키워드를 안 남기면 판단에서 빠져 리포트에 다시 뜬다 */
    test('재발행 경로도 키워드를 남긴다', () => {
      const 재발행 = blockBetween(posting, 'title: result.title || titleToPublish', 'localStorage.setItem');
      expect(재발행).toContain('keyword:');
    });

    test('달력이 키워드로 말한다', () => {
      expect(cal).toContain('export function publishedDayLabels');
      expect(cal).toContain('publishedDayLabels(dayPublished)');
      expect(cal).toContain('이 날 올린 키워드');
    });

    /** 이름표 고르는 순서가 어긋나면 카드와 달력이 다른 말을 한다 */
    test('달력의 이름표 순서가 published-match 와 같다', () => {
      expect(cal).toContain('rec.keyword || rec.reportKeyword || rec.title');
      expect(read('src/core/keywords/published-match.ts'))
        .toContain('rec?.keyword || rec?.reportKeyword || rec?.title');
    });
  });
});
