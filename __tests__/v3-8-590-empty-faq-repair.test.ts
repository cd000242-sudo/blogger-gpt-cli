/**
 * v3.8.590 — 고칠 수 있으면 고치고, 못 고칠 때만 막는다
 *
 * ## 실제 발행 실패 (2026-08-29, 사장님 화면)
 *   "발행 실패: 빈 블록이 남아 발행을 중단했습니다 (FAQ 답변 1개).
 *    깨진 글을 올리는 것보다 안 올리는 편이 낫습니다."
 *
 * FAQ 답변 **하나**가 비었다고 글 전체가 버려졌다. 100초 걸려 만들고
 * 본문 생성비까지 치른 글이고, 나머지는 멀쩡했다.
 * 안전망이 글을 지키는 게 아니라 글을 죽이고 있었다.
 *
 * ## 왜 이 안전망이 있나 (없애면 안 되는 이유)
 * 사장님이 직접 요청한 것이다 — "발행 전 검증 단계 추가, 빈 필드 감지되면 발행 중단"(v3.8.484).
 * 빈 소제목이 남은 글은 뼈대가 무너진 글이라 올리면 안 된다. 그건 그대로 막는다.
 *
 * ## 무엇이 달라졌나
 * 빈 FAQ 는 **고칠 수 있는 결함**이다. 그 항목만 지우면 글이 성립한다.
 * 이미 `dropEmptyFaqItems` 로 에이전트 경로에서 하던 일인데
 * **API 경로에만 안 붙어 있었다.** 같은 병이 경로만 바꿔 남아 있던 것이다.
 */
import {
  findEmptyBlocks, removeEmptyFaqBlocks, describeEmptyBlocks,
} from '../src/core/final/empty-block-guard';

const 정상FAQ = '<details><summary>질문1</summary><p>답변이 충분히 들어 있습니다.</p></details>';
const 빈FAQ = '<details><summary>질문2</summary><p> </p></details>';
const 빈소제목 = '<h2></h2>';

describe('① 빈 FAQ 는 지우고 발행을 계속한다', () => {
  test('⭐ 실제로 발행을 막았던 그 상황 — FAQ 답변 1개', () => {
    const html = 정상FAQ + 빈FAQ;
    expect(describeEmptyBlocks(findEmptyBlocks(html))).toContain('FAQ 답변 1개');

    const r = removeEmptyFaqBlocks(html);
    expect(r.removed).toBe(1);
    expect(findEmptyBlocks(r.html)).toHaveLength(0);   // 이제 발행된다
  });

  test('멀쩡한 FAQ 는 건드리지 않는다', () => {
    const r = removeEmptyFaqBlocks(정상FAQ);
    expect(r.removed).toBe(0);
    expect(r.html).toBe(정상FAQ);
  });

  test('여러 개도 지운다', () => {
    expect(removeEmptyFaqBlocks(빈FAQ + 정상FAQ + 빈FAQ).removed).toBe(2);
  });

  /** 반쪽 FAQ 를 그냥 두면 구조화 데이터로 나가 검색엔진이 빈 답변을 읽는다 */
  test('지운 뒤 그 자리에 빈 껍데기를 남기지 않는다', () => {
    expect(removeEmptyFaqBlocks(빈FAQ).html).not.toContain('<details');
  });
});

describe('② 못 고치는 것은 그대로 막는다 (사장님이 넣은 안전망)', () => {
  test('빈 소제목은 FAQ 를 고쳐도 남는다 — 섹션이 통째로 빈 글이다', () => {
    const r = removeEmptyFaqBlocks(빈소제목 + 빈FAQ);
    expect(r.removed).toBe(1);
    const left = findEmptyBlocks(r.html);
    expect(left.length).toBeGreaterThan(0);
    expect(describeEmptyBlocks(left)).toContain('소제목');
  });
});

describe('③ 고치다 글을 깨뜨리지 않는다', () => {
  test('빈 값·깨진 HTML 에 던지지 않는다', () => {
    for (const bad of ['', null, undefined, '<details>', '<<>>']) {
      expect(() => removeEmptyFaqBlocks(bad as any)).not.toThrow();
    }
  });

  test('지울 게 없으면 원본을 그대로 돌려준다', () => {
    const html = '<p>본문입니다. 91일 이전이면 면제됩니다.</p>';
    expect(removeEmptyFaqBlocks(html).html).toBe(html);
  });
});

describe('④ 발행 경로가 실제로 고친 뒤에 판정한다', () => {
  const fs = require('fs');
  const path = require('path');
  const orch = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf-8',
  );

  test('import 하고 부른다', () => {
    expect(orch).toContain('removeEmptyFaqBlocks');
  });

  /** 고치기 전에 판정하면 아무것도 안 달라진다 — 순서가 전부다 */
  test('고치는 것이 최종 판정보다 앞이다', () => {
    const repair = orch.indexOf('removeEmptyFaqBlocks(html)');
    const decide = orch.indexOf('const emptyBlocks = findEmptyBlocks(html);');
    expect(repair).toBeGreaterThan(-1);
    expect(decide).toBeGreaterThan(-1);
    expect(repair).toBeLessThan(decide);
  });

  test('고쳤으면 사용자에게 알린다 (조용히 지우면 안 된다)', () => {
    expect(orch).toContain('답변이 빈 FAQ');
    expect(orch).toContain('발행은 계속합니다');
  });

  test('그래도 못 고치면 막는 길은 남아 있다', () => {
    expect(orch).toContain('빈 블록이 남아 발행을 중단했습니다');
  });
});
