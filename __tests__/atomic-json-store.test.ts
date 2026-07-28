/**
 * R3 안전망 — 원자적 JSON 저장 유틸 (v3.8.378)
 *
 * 배경: schedule-manager.ts 의 saveScheduleData() 가 fs.writeFileSync 직접 호출이라
 *   쓰기 도중 크래시/정전 시 scheduled-posts.json 이 반토막 나서 **예약 전체가 소실**된다.
 *   (loadScheduleData의 JSON.parse가 실패 → 빈 배열로 시작)
 *
 * 해법: temp 파일에 완전히 쓴 뒤 rename — rename은 같은 볼륨에서 원자적이다.
 * 이 테스트는 유틸(src/core/utils/atomic-json.ts)의 계약을 고정한다. 수정 전엔 모듈이 없어 red.
 */

import * as fs from 'fs';
import * as path from 'path';

const DIR = path.resolve('.tmp-tests/atomic-json');

describe('writeJsonAtomic — 원자적 JSON 저장 (R3 안전망)', () => {
  beforeEach(() => {
    try { fs.rmSync(DIR, { recursive: true, force: true }); } catch { /* noop */ }
    fs.mkdirSync(DIR, { recursive: true });
  });

  afterAll(() => {
    try { fs.rmSync(DIR, { recursive: true, force: true }); } catch { /* noop */ }
  });

  const load = () => require('../src/core/utils/atomic-json');

  it('모듈이 존재하고 writeJsonAtomic을 export한다', () => {
    const mod = load();
    expect(typeof mod.writeJsonAtomic).toBe('function');
  });

  it('쓴 데이터를 그대로 되읽을 수 있다 (한국어/유니코드 보존)', () => {
    const { writeJsonAtomic } = load();
    const file = path.join(DIR, 'schedule.json');
    const data = [{ id: 's1', keyword: '전기차 보조금 신청 🚗', status: 'pending' }];
    writeJsonAtomic(file, data);
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(data);
  });

  it('기존 파일을 완전히 교체한다 (부분 병합 없음)', () => {
    const { writeJsonAtomic } = load();
    const file = path.join(DIR, 'schedule.json');
    writeJsonAtomic(file, { old: '길고 긴 기존 내용'.repeat(50) });
    writeJsonAtomic(file, { fresh: 1 });
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ fresh: 1 });
  });

  it('성공 후 임시 파일을 남기지 않는다', () => {
    const { writeJsonAtomic } = load();
    writeJsonAtomic(path.join(DIR, 'a.json'), { a: 1 });
    const leftovers = fs.readdirSync(DIR).filter(f => f.includes('.tmp'));
    expect(leftovers).toEqual([]);
  });

  it('없는 디렉토리는 만들어서 쓴다', () => {
    const { writeJsonAtomic } = load();
    const file = path.join(DIR, 'nested', 'deep', 'x.json');
    writeJsonAtomic(file, { ok: true });
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ ok: true });
  });
});

describe('schedule-manager가 원자적 저장을 사용한다 (R3 배선)', () => {
  it('saveScheduleData에 fs.writeFileSync 직접 호출이 남아있지 않다', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'core', 'schedule-manager.ts'), 'utf8');
    const saveFn = src.slice(src.indexOf('private saveScheduleData'), src.indexOf('private saveScheduleData') + 500);
    expect(saveFn).not.toContain('fs.writeFileSync');
    expect(saveFn).toContain('writeJsonAtomic');
  });
});
