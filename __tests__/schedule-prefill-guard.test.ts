/**
 * R0 안전망 — 예약 시각 기본값이 로컬 시각이어야 한다 (v3.8.376)
 *
 * 배경: electron/ui/script.js 의 예약 UI가 기본값을 이렇게 만든다.
 *     now.setHours(now.getHours() + 1);
 *     const dateTimeString = now.toISOString().slice(0, 16);   // ← UTC 벽시계
 *     scheduleDateTime.value = dateTimeString;
 *   그런데 #scheduleDateTime 은 <input type="datetime-local"> 이라 값이 **로컬 시각**으로 해석된다.
 *   KST(UTC+9)에서는 기본값이 8시간 과거가 되고, 그러면:
 *     wordpress-publisher.ts 의 `sDate.getTime() > Date.now()` 가 false
 *     → finalStatus 가 'future' 가 아니라 'publish' 로 강등 = 예약이 조용히 즉시발행된다.
 *   게다가 publish() 는 createdPost.status 를 읽지 않고, main.js 는 상태와 무관하게
 *   "발행 완료" 모달을 띄우므로 사용자는 실패를 알 수 없다.
 *
 * 같은 앱 안에 정답이 이미 있다: publish-queue.js 의 toLocalDateTimeInputValue().
 * 이 테스트는 소스에서 잘못된 패턴이 사라졌는지를 지킨다.
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..');
const SHIPPED_UI = path.join(REPO, 'electron', 'ui', 'script.js');

/** datetime-local 입력에 UTC 문자열을 넣는 안티패턴 */
const UTC_PREFILL = /toISOString\(\)\s*\.\s*(?:slice|substring)\(\s*0\s*,\s*16\s*\)/g;

describe('예약 시각 기본값 — 로컬 시각 사용 (R0 안전망)', () => {
  it('배포되는 UI 소스에 UTC 프리필 안티패턴이 없다', () => {
    const src = fs.readFileSync(SHIPPED_UI, 'utf8');
    const hits = src.match(UTC_PREFILL) || [];
    expect(hits.length).toBe(0);
  });

  it('정답 헬퍼(로컬 시각 변환)가 대기열 모듈에 존재한다 — 이걸 재사용해야 한다', () => {
    const queue = fs.readFileSync(path.join(REPO, 'electron', 'ui', 'modules', 'publish-queue.js'), 'utf8');
    expect(queue).toContain('function toLocalDateTimeInputValue');
    expect(queue).toMatch(/getFullYear\(\)/);
    expect(queue).toMatch(/getHours\(\)/);
  });
});

describe('로컬 시각 변환 로직 자체 검증 (R0 안전망)', () => {
  // publish-queue.js 의 toLocalDateTimeInputValue 와 동일한 구현
  const toLocalDateTimeInputValue = (date: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  it('datetime-local 값으로 되읽었을 때 원래 시각과 일치한다', () => {
    const target = new Date();
    target.setHours(target.getHours() + 1, 30, 0, 0);

    const value = toLocalDateTimeInputValue(target);
    const parsed = new Date(value); // 브라우저/Node 모두 로컬로 해석

    expect(parsed.getFullYear()).toBe(target.getFullYear());
    expect(parsed.getHours()).toBe(target.getHours());
    expect(parsed.getMinutes()).toBe(target.getMinutes());
  });

  it('결과가 반드시 미래여야 한다 (즉시발행 강등 방지)', () => {
    const target = new Date(Date.now() + 60 * 60 * 1000);
    const parsed = new Date(toLocalDateTimeInputValue(target));
    expect(parsed.getTime()).toBeGreaterThan(Date.now());
  });

  it('UTC 방식은 KST에서 과거가 된다 (안티패턴이 왜 위험한지 고정)', () => {
    const target = new Date(Date.now() + 60 * 60 * 1000);
    const utcValue = target.toISOString().slice(0, 16);
    const parsedUtc = new Date(utcValue);
    const offsetMin = target.getTimezoneOffset(); // KST = -540

    if (offsetMin < 0) {
      // UTC보다 앞선 시간대(한국 포함)에서는 UTC 프리필이 반드시 과거가 된다
      expect(parsedUtc.getTime()).toBeLessThan(Date.now());
    }
  });
});
