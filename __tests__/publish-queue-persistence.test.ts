/**
 * R3 안전망 — 큐 항목 단위 즉시 영속화 (v3.8.378)
 *
 * 배경: publish-queue.js 의 연속발행 루프는 항목 완료 시 completedIds.add(it.id) 로 표시만 하고,
 *   STATE.keywords 필터링 + persistQueue() 는 루프가 전부 끝난 뒤 1회만 실행한다.
 *   → 10개 중 8개 발행 후 앱이 죽으면 완료된 8개가 대기열에 그대로 남아
 *     재시작 시 8편이 중복 발행된다 (같은 글이 블로그에 2번 올라감).
 *
 * 이 테스트는 소스 문자열 거리 휴리스틱으로 "완료 즉시 저장"을 강제한다:
 *   completedIds.add(...) 지점에서 400자 이내에 persistQueue() 가 있어야 한다.
 *   (실측: 수정 전 거리 약 1,500자 → red)
 */

import * as fs from 'fs';
import * as path from 'path';

const QUEUE_SRC = path.resolve(__dirname, '..', 'electron', 'ui', 'modules', 'publish-queue.js');
const MAX_DISTANCE = 400;

describe('연속발행 큐 — 항목 단위 즉시 영속화 (R3 안전망)', () => {
  const src = fs.readFileSync(QUEUE_SRC, 'utf8');

  it('완료 표시(completedIds.add) 직후 400자 이내에 persistQueue()가 있다', () => {
    const marker = 'completedIds.add(it.id)';
    const markerPos = src.indexOf(marker);
    expect(markerPos).toBeGreaterThan(-1); // 마커 자체가 사라지면 구조가 바뀐 것 — 테스트 재검토 필요

    const after = src.slice(markerPos, markerPos + MAX_DISTANCE);
    expect(after).toContain('persistQueue()');
  });

  it('완료 항목이 즉시 대기열에서 제거된다 (STATE.keywords 필터)', () => {
    const marker = 'completedIds.add(it.id)';
    const markerPos = src.indexOf(marker);
    const after = src.slice(markerPos, markerPos + MAX_DISTANCE);
    expect(after).toMatch(/STATE\.keywords\s*=\s*STATE\.keywords\.filter/);
  });

  it('루프 종료 후 최종 필터+저장도 유지된다 (멱등 이중 안전망)', () => {
    // publish-queue-stop-regression.test.ts 가 고정하는 기존 동작 — 깨지면 안 된다
    expect(src).toContain('STATE.keywords = STATE.keywords.filter(item => !completedIds.has(item.id))');
  });
});
