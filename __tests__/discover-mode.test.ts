/**
 * v3.8.478 — 구글 디스커버 모드.
 *
 * 디스커버는 검색과 최적화 방향이 갈린다. 검색은 쿼리가 있어서 키워드를 앞에 두는 게
 * 유리하지만, 디스커버 피드에는 **쿼리가 없다**. 게다가 공식 정책이 클릭베이트·
 * 선정성·핵심 감추기를 명시적으로 감점한다.
 *
 * 근거 (Search Central — "Discover and your website"):
 *   "Avoid clickbait…by using misleading or exaggerated details in preview content
 *    (title, snippets, or images)…or by withholding crucial information"
 *   "Use page titles and headlines that capture the essence of the content"
 *   "Avoid sensationalism tactics…catering to morbid curiosity, titillation, or outrage"
 *   "Provide content that's timely…tells a story well, or provides unique insights"
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  isDiscoverMode,
  buildDiscoverTitleDirective,
  buildDiscoverBodyBlock,
  findDiscoverTitleViolations,
} from '../src/core/final/discover-mode';

describe('isDiscoverMode', () => {
  it('discover 만 디스커버 모드다', () => {
    expect(isDiscoverMode('discover')).toBe(true);
    expect(isDiscoverMode(' Discover ')).toBe(true);
    expect(isDiscoverMode('adsense')).toBe(false);
    expect(isDiscoverMode('shopping')).toBe(false);
    expect(isDiscoverMode(undefined)).toBe(false);
  });
});

describe('제목 지시문 — 공식 정책을 그대로 옮겼는가', () => {
  const directive = buildDiscoverTitleDirective(2026);

  it('제목이 글의 결론을 담으라고 지시한다 (capture the essence)', () => {
    expect(directive).toContain('결론');
    expect(directive).toContain('capture the essence');
  });

  it('핵심을 감추는 제목을 금지한다 (withholding crucial information)', () => {
    expect(directive).toContain('감추지');
    expect(directive).toMatch(/충격|자극어/);
  });

  it('키워드 앞배치를 요구하지 않는다 — 피드에는 검색어가 없다', () => {
    expect(directive).toContain('맨 앞에 두지 마세요');
  });

  it('연도를 지시문에 반영한다 (시의성)', () => {
    expect(buildDiscoverTitleDirective(2026)).toContain('2026년');
    expect(buildDiscoverTitleDirective(2027)).toContain('2027년');
  });
});

describe('본문 블록', () => {
  const block = buildDiscoverBodyBlock(2026);

  it('첫 문단에서 결론을 말하라고 한다 (피드 독자는 답이 안 보이면 나간다)', () => {
    expect(block).toContain('첫 문단');
    expect(block).toContain('결론');
  });

  it('시의성·서사·고유 통찰 세 축을 모두 담는다', () => {
    expect(block).toContain('시의성');
    expect(block).toMatch(/이야기|흐름/);
    expect(block).toMatch(/이 글에만 있는|일반론/);
  });

  it('없는 사실을 지어내라고 하지 않는다', () => {
    expect(block).toContain('지어내지 마세요');
  });
});

describe('findDiscoverTitleViolations — 발행은 막지 않고 알리기만', () => {
  it('자극어를 잡아낸다', () => {
    expect(findDiscoverTitleViolations('전기차 보조금 충격적인 진실')).toContain('충격');
    expect(findDiscoverTitleViolations('아직도 모르면 손해 보는 청년 월세 지원')).not.toHaveLength(0);
    expect(findDiscoverTitleViolations('역대급 혜택 총정리')).not.toHaveLength(0);
  });

  it('정상 제목은 통과시킨다', () => {
    expect(findDiscoverTitleViolations('청년 월세 지원 월 20만원, 24개월간 받는 조건')).toEqual([]);
    expect(findDiscoverTitleViolations('2026년 전기차 보조금 국고 최대 650만원')).toEqual([]);
  });

  it('빈 값에도 던지지 않는다', () => {
    expect(findDiscoverTitleViolations('')).toEqual([]);
    expect(findDiscoverTitleViolations(null as any)).toEqual([]);
  });
});

describe('배선', () => {
  const generation = readFileSync(join(__dirname, '..', 'src/core/final/generation.ts'), 'utf8');
  const orchestration = readFileSync(join(__dirname, '..', 'src/core/final/orchestration.ts'), 'utf8');
  const ui = readFileSync(join(__dirname, '..', 'src/ui/index.html'), 'utf8');

  it('본문 프롬프트에 디스커버 블록이 들어간다', () => {
    expect(generation).toContain('discoverModePromptBlock');
    expect(generation).toContain('${paraphrasingModePromptBlock}${discoverModePromptBlock}');
  });

  it('디스커버 모드는 기본 아키타입 대신 전용 제목 지시문을 쓴다', () => {
    expect(generation).toContain('buildDiscoverTitleDirective');
    expect(generation).toContain('discoverMode.isDiscoverMode(contentMode)');
  });

  it('제목 생성기가 contentMode 를 받는다 (예전엔 안 받았다)', () => {
    expect(orchestration).toContain('// v3.8.478: 디스커버 모드는 제목 규칙이 다르다');
  });

  it('사용자가 UI 에서 고를 수 있다 (모드 선택 2곳 모두)', () => {
    const options = ui.match(/<option value="discover"/g) || [];
    expect(options.length).toBe(2);
  });
});
