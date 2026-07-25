/**
 * R0 안전망 — 로그가 실제 전송값과 일치해야 한다 (v3.8.376)
 *
 * 배경: blogger-publisher.js 는 실제 API 호출 시
 *     const isDraft = isDraftMode && !isScheduleMode;      // :5487 — 예약이면 false (정상)
 *   를 쓰는데, 로그는 서로 다른 식을 출력한다:
 *     :5258  `isDraft: ${isDraftMode || isScheduleMode || false}`
 *     :6249  isDraft: isDraftMode || isScheduleMode || false
 *     :3356  finalStatus = (isDraftMode || isScheduleMode) ? 'DRAFT' : 'LIVE'
 *   → 예약 발행인데 로그에는 isDraft:true / DRAFT 로 찍힌다. 기능은 정상이지만
 *     "예약이 안 되는 것 같다" 는 오진을 유발하고, 앞으로의 모든 검증을 오염시킨다.
 *
 * 견고성 원칙: 성공했다고 찍혔는데 실패한(혹은 그 반대인) 로그는 버그와 동급으로 취급한다.
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(__dirname, '..', 'src', 'core', 'blogger-publisher.js');

describe('블로거 로그 정직성 (R0 안전망)', () => {
  const src = fs.readFileSync(SRC, 'utf8');

  it('실제 전송값 계산식이 존재한다 (기준점)', () => {
    expect(src).toMatch(/isDraftMode\s*&&\s*!isScheduleMode/);
  });

  it('로그/상태 계산에 isDraftMode || isScheduleMode 형태가 남아있지 않다', () => {
    // 전송값(&&)과 다른 식(||)을 로그·상태에 쓰면 로그가 거짓이 된다.
    const misleading = src.match(/isDraftMode\s*\|\|\s*isScheduleMode/g) || [];
    expect(misleading.length).toBe(0);
  });
});
