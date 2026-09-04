const fs = require('fs');
const path = require('path');

import {
  pubTime,
  detectBreakingEvent,
  dropPreEventSources,
  buildBreakingDirective,
} from '../src/core/final/breaking-news-guard';
import { extractPublishDate } from '../src/core/crawlers/embedded-article-body';

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
 * v3.8.633 — 속보 관문.
 *
 * 사장님 실제 사고(2026-09-04): 「티빙 개인정보 유출」이 터진 지 10분 만에
 * 그 키워드로 글을 돌렸더니 **작년 티빙 유출 사건 내용이 나왔다.**
 *
 * 원인은 모델이 아니라 재료다. 터진 직후엔 새 글이 거의 없고, 옛 사건 글은
 * 색인이 쌓여 검색 위에 있다. 기존 신선도 장치는 12개월 안이면 신선이라
 * 작년 사건이 그대로 통과했다 — "낡았는가" 는 봤지만 "다른 사건인가" 를 못 봤다.
 *
 * 이 검사는 **양쪽이 다 중요하다**:
 *   못 잡으면 → 지난 사건을 이번 일처럼 쓴다
 *   헛것을 잡으면 → 평범한 글에서 근거를 걷어내 오히려 얕아진다
 */
describe('v3.8.633 속보 관문', () => {
  const 지금 = new Date('2026-09-04T14:00:00+09:00');
  const H = 60 * 60 * 1000;
  const D = 24 * H;
  const rfc = (ms: number) => new Date(ms).toUTCString();
  const 기사 = (전ms: number) => ({ pubDate: rfc(+지금 - 전ms) });

  describe('날짜 읽기 — 갈래마다 모양이 다르다', () => {
    test('뉴스의 RFC822 를 읽는다', () => {
      expect(pubTime({ pubDate: 'Thu, 04 Sep 2026 14:01:00 +0900' })).toBeGreaterThan(0);
    });

    /** 「티빙」 사고에서 옛 사건 글이 잡힌 곳이 바로 블로그였다 */
    test('블로그의 YYYYMMDD 도 읽는다 — 이걸 빠뜨리면 원인을 안 거른다', () => {
      expect(pubTime({ postdate: '20260904' })).toBeGreaterThan(0);
    });

    test('못 읽는 모양은 0 — 0 을 옛것으로 치면 멀쩡한 주제가 속보가 된다', () => {
      expect(pubTime({})).toBe(0);
      expect(pubTime({ pubDate: '언제인지 모름' })).toBe(0);
      expect(pubTime({ postdate: '2026-09-04' })).toBe(0);
    });
  });

  describe('속보인가 — 터졌는가', () => {
    test('사장님이 겪은 그 모양을 잡는다', () => {
      const items = [
        ...[1, 2, 3, 5, 8].map((h) => 기사(h * H)),         // 방금 터진 기사 5건
        ...[295, 297, 300].map((d) => 기사(d * D)),          // 작년 같은 이름 사건
      ];
      const ev = detectBreakingEvent(items, 지금);
      expect(ev.isBreaking).toBe(true);
      expect(ev.burstCount).toBe(5);
      expect(ev.olderCount).toBe(3);
      expect(ev.note).toContain('과거 자료가 3건');
    });

    /**
     * 이걸 안 보면 국민연금·부동산·환율처럼 매일 기사가 나오는 주제가 전부
     * 속보가 된다. 48시간에 3건은 그런 주제에서 늘 참이기 때문이다.
     */
    test('꾸준히 기사가 나오는 주제는 속보가 아니다', () => {
      const 꾸준 = [...Array(12)].map((_, i) => 기사(i * 12 * H));
      const ev = detectBreakingEvent(꾸준, 지금);
      expect(ev.isBreaking).toBe(false);
      expect(ev.note).toContain('꾸준히');
    });

    test('기사가 몇 건 없으면 판정하지 않는다 — 한두 건은 우연이다', () => {
      expect(detectBreakingEvent([기사(H), 기사(2 * H)], 지금).isBreaking).toBe(false);
    });

    test('날짜를 하나도 못 읽으면 판정하지 않는다', () => {
      const ev = detectBreakingEvent([{ title: 'a' }, { title: 'b' }], 지금);
      expect(ev.isBreaking).toBe(false);
      expect(ev.note).toContain('읽지 못해');
    });

    test('전부 최근이고 앞선 기사가 없으면 새 주제로 본다', () => {
      const ev = detectBreakingEvent([1, 2, 3, 4].map((h) => 기사(h * H)), 지금);
      expect(ev.isBreaking).toBe(true);
      expect(ev.olderCount).toBe(0);
    });

    test('빈 입력에도 터지지 않는다', () => {
      expect(detectBreakingEvent([], 지금).isBreaking).toBe(false);
      expect(detectBreakingEvent(undefined as any, 지금).isBreaking).toBe(false);
    });
  });

  describe('옛 사건 자료 걷어내기', () => {
    const ev = detectBreakingEvent(
      [...[1, 2, 3, 5, 8].map((h) => 기사(h * H)), ...[295, 297, 300].map((d) => 기사(d * D))],
      지금,
    );

    test('사건보다 한참 앞선 것만 걷어낸다', () => {
      // 절반까지만 걷어낸다 (안전판) — 그래서 최근 것을 절반 이상 둔다
      const r = dropPreEventSources([기사(H), 기사(2 * H), 기사(295 * D), 기사(300 * D)], ev);
      expect(r.dropped).toBe(2);
      expect(r.kept).toHaveLength(2);
    });

    /** 상시 안내 문서가 대부분이라 낡았다고 볼 근거가 없다. 지우면 근거가 텅 빈다 */
    test('날짜를 모르는 자료는 남긴다', () => {
      const r = dropPreEventSources([{ title: '상시 안내문' }], ev);
      expect(r.dropped).toBe(0);
      expect(r.kept).toHaveLength(1);
    });

    test('블로그 postdate 로도 걸러진다', () => {
      const r = dropPreEventSources(
        [{ postdate: '20260904' }, { postdate: '20251110' }, { title: '날짜없음' }],
        ev,
      );
      expect(r.dropped).toBe(1);
      expect(r.kept).toHaveLength(2);
    });

    test('속보가 아니면 아무것도 걷어내지 않는다', () => {
      const 평범 = detectBreakingEvent([...Array(12)].map((_, i) => 기사(i * 12 * H)), 지금);
      const r = dropPreEventSources([기사(300 * D)], 평범);
      expect(r.dropped).toBe(0);
    });

    /** 취재 선행 기사가 있을 수 있으므로 여유를 둔다 */
    test('사건 직전 몇 시간은 살린다', () => {
      const r = dropPreEventSources([기사(24 * H)], ev);
      expect(r.dropped).toBe(0);
    });
  });

  describe('못박음 — "최신을 써라" 로는 안 된다', () => {
    const ev = detectBreakingEvent(
      [...[1, 2, 3, 5, 8].map((h) => 기사(h * H)), ...[295, 297, 300].map((d) => 기사(d * D))],
      지금,
    );
    const 지시 = buildBreakingDirective(ev, '티빙 개인정보 유출');

    test('사건 날짜를 못박는다', () => {
      expect(지시).toContain('2026년 9월 4일');
      expect(지시).toContain('티빙 개인정보 유출');
    });

    /** 모델은 자기가 최신을 쓰고 있다고 믿는다. 다른 사건이 있다고 알려 줘야 구분한다 */
    test('같은 이름의 과거 사건이 있다고 알려 준다', () => {
      expect(지시).toContain('같은 이름의 과거 사건 자료가 3건');
      expect(지시).toContain('옮겨 적지 마세요');
      expect(지시).toContain('연도를 밝혀 따로');
    });

    test('확실하지 않은 수치는 쓰지 말라고 한다', () => {
      expect(지시).toContain('확실하지 않으면');
    });

    test('속보 특유의 주의를 준다 — 조사 중인 것을 확정처럼 쓰지 않게', () => {
      expect(지시).toContain('발표했다');
      expect(지시).toContain('추측으로 채우지 않습니다');
    });

    test('과거 사건이 없으면 그 경고는 안 붙인다 — 없는 걱정을 만들지 않는다', () => {
      const 새주제 = detectBreakingEvent([1, 2, 3, 4].map((h) => 기사(h * H)), 지금);
      const line = buildBreakingDirective(새주제, '새 사건');
      expect(line).not.toContain('같은 이름의 과거 사건');
      expect(line).toContain('발표했다');
    });

    test('속보가 아니면 빈 문자열 — 평범한 글에 군더더기를 안 붙인다', () => {
      const 평범 = detectBreakingEvent([...Array(12)].map((_, i) => 기사(i * 12 * H)), 지금);
      expect(buildBreakingDirective(평범, '국민연금')).toBe('');
    });
  });

  describe('배선 — 세 곳 모두', () => {
    const grounding = read('src/core/final/naver-grounding.ts');
    const orch = read('src/core/final/orchestration.ts');
    const harness = read('src/core/final/agent-harness.ts');

    test('뉴스에서 옛 사건을 걷어낸다', () => {
      expect(grounding).toContain('detectBreakingEvent');
      expect(grounding).toContain('dropPreEventSources(newsItems, event)');
    });

    /** 뉴스만 걸러서는 소용없다 — 문제의 원인이 블로그였다 */
    test('블로그에서도 걷어낸다', () => {
      expect(grounding).toContain('dropPreEventSources(blogAll, event)');
    });

    test('API 경로가 못박음을 프롬프트에 싣는다', () => {
      expect(orch).toContain('buildBreakingDirective(event, keyword)');
      expect(orch).toContain('...(breakingDirective ? [breakingDirective] : [])');
    });

    /** 에이전트는 orchestration 을 안 탄다 — 따로 넣지 않으면 그쪽만 또 틀린다 */
    test('에이전트 경로에도 싣는다', () => {
      expect(harness).toContain('breakingEvent?: any;');
      expect(harness).toContain('buildBreakingDirective(input.breakingEvent');
    });

    /**
     * globalThis 에 판정을 두고 뒤에서 읽는다. 안 지우면 다음 글에 묻어간다 —
     * 속보 글 하나 쓰고 평범한 글을 쓰면 그 글에도 속보 못박음이 붙는다.
     */
    test('지난 발행의 판정을 첫머리에서 지운다', () => {
      // try 안 첫머리 — 락을 쥔 채 try 밖에서 실행하면 예외 시 영구 데드락이다
      expect(orch.indexOf('__lastBreakingEvent = null'))
        .toBeGreaterThan(orch.indexOf("acquireEngineLock('generateUltimateMaxModeArticleFinal')"));
      const head = blockBetween(orch, '__lastBreakingEvent = null', 'providerModelMap');
      expect(orch).toContain('(globalThis as any).__lastBreakingEvent = null;');
      expect(head).toContain('__lastSelfOverlap = null');
      expect(head).toContain('__lastPreflight = null');
    });
  });
  describe('⑤ 근거를 굶기지 않는다 — 안전판', () => {
    const ev = detectBreakingEvent(
      [...[1, 2, 3, 5, 8].map((h) => 기사(h * H)), ...[295, 297, 300].map((d) => 기사(d * D))],
      지금,
    );

    /**
     * 상시 주제(「개인정보 유출 대처법」)를 쓰는데 같은 분야에서 사건이 터지면
     * 속보로 판정된다. 그때 옛 자료를 다 걷어내면 근거가 텅 비어
     * **옛 사건을 막으려다 글을 더 얕게 만든다.**
     */
    test('절반 넘게 걷어내야 하면 아무것도 안 걷어낸다', () => {
      const 대부분옛것 = [기사(H), 기사(295 * D), 기사(297 * D), 기사(300 * D)];
      const r = dropPreEventSources(대부분옛것, ev);
      expect(r.dropped).toBe(0);
      expect(r.kept).toHaveLength(4);
      expect(r.skippedReason).toContain('근거가 비어');
    });

    test('절반 이하면 정상적으로 걷어낸다', () => {
      const 조금옛것 = [기사(H), 기사(2 * H), 기사(3 * H), 기사(300 * D)];
      const r = dropPreEventSources(조금옛것, ev);
      expect(r.dropped).toBe(1);
      expect(r.skippedReason).toBeUndefined();
    });

    test('안전판이 걸려도 못박음은 그대로 나간다 — 알려 주는 편이 굶기는 것보다 낫다', () => {
      expect(buildBreakingDirective(ev, '개인정보 유출 대처법')).toContain('과거 사건');
    });
  });

  describe('⑥ 전역이 아니라 반환값으로 넘긴다', () => {
    const grounding = read('src/core/final/naver-grounding.ts');
    const orch = read('src/core/final/orchestration.ts');

    test('근거 수집 결과에 판정이 실린다', () => {
      expect(grounding).toContain('breakingEvent?: any;');
      expect(grounding).toContain('breakingEvent,');
    });

    test('orchestration 이 반환값을 받아 쓴다', () => {
      expect(orch).toContain('(g as any).breakingEvent');
    });
  });

  describe('⑦ URL 모드 — 기사 날짜를 지시서에 싣는다', () => {
    const upgrade = read('src/core/final/url-upgrade.ts');

    test('원문 작성일을 알려 준다', () => {
      expect(upgrade).toContain('원문 작성일');
      expect(upgrade).toContain('publishDate');
    });

    test('같은 이름의 과거 사건을 섞지 말라고 한다', () => {
      expect(upgrade).toContain('같은 이름의 과거 사건이 떠오르더라도');
    });

    test('날짜를 못 읽으면 그 줄을 안 붙인다 — 없는 말을 지어내지 않는다', () => {
      expect(upgrade).toContain('if (when) {');
    });
  });
});
/*
 * 날짜를 못 읽으면 ⑦ 의 경고가 조용히 안 붙는다 — 고쳤다고 믿는데 무동작인 상태.
 * 사고를 낸 조선일보는 Arc Publishing 이라 날짜도 스크립트 안에 있다.
 */
describe('v3.8.633 기사 작성일 꺼내기', () => {
  test('JSON-LD 의 datePublished 를 읽는다 — 스크립트를 지우면 사라지는 갈래', () => {
    const html = '<html><head><script type="application/ld+json">' +
      '{"@type":"NewsArticle","datePublished":"2026-09-04T14:01:00+09:00"}' +
      '</script></head><body>본문</body></html>';
    expect(extractPublishDate(html)).toContain('2026-09-04');
  });

  test('meta 태그 속성 순서가 달라도 읽는다', () => {
    expect(extractPublishDate('<meta content="2026-09-04" property="article:published_time">'))
      .toBe('2026-09-04');
  });

  test('매체마다 다른 이름도 훑는다', () => {
    expect(extractPublishDate('<meta name="sailthru.date" content="2026-09-04T10:00:00Z">'))
      .toContain('2026-09-04');
  });

  test('time 태그도 본다', () => {
    expect(extractPublishDate('<time datetime="2026-09-04T09:00:00+09:00">어제</time>'))
      .toContain('2026-09-04');
  });

  /** 날짜가 아닌 값을 날짜라고 넘기면 지시서에 엉뚱한 날이 박힌다 */
  test('못 읽는 값은 빈 문자열 — 지어내지 않는다', () => {
    expect(extractPublishDate('<meta property="article:published_time" content="어제">')).toBe('');
    expect(extractPublishDate('<html></html>')).toBe('');
    expect(extractPublishDate('')).toBe('');
  });

  test('크롤러가 스크립트를 지우기 전에 뽑는다 — 순서가 전부다', () => {
    const gen = read('src/core/url-content-generator.ts');
    const at = gen.indexOf('const embeddedDate = extractPublishDate(html);');
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(gen.indexOf("$('script, style, nav"));
    expect(gen).toContain('embeddedDate || ');
  });
});
