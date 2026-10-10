/**
 * v3.8.760 — 젠스파크 근거 모으기(실행 → 근거 후보 → 관련도 심사)를 한 함수로.
 * 일반 경로(orchestration)와 에이전트 경로(main.ts)가 같은 함수를 쓴다 — 한쪽만 배선되는 "조용한 미배선" 방지.
 * 실제 젠스파크 대신 실측 응답(fixture)을 돌려주는 가짜 실행기를 넣어 시험한다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { collectGensparkEvidence, describeGensparkEvidence, renderGensparkEvidenceBlock } from '../src/core/genspark/genspark-research';
import { parseGensparkProject } from '../src/core/genspark/genspark-evidence';

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'genspark-project-2026-10-10.json'), 'utf8'));
const KEYWORD = '청년미래적금 2차 신청 조건';
const research = parseGensparkProject(fixture);
const okRun = async () => ({ ok: true, projectId: 'p1', research, elapsedMs: 130_000 });

describe('collectGensparkEvidence', () => {
  test('⭐ 읽은 페이지 → 관련도 심사를 통과한 근거만 · 메인 키워드를 단다', async () => {
    const r = await collectGensparkEvidence(KEYWORD, { run: okRun });
    expect(r.ok).toBe(true);
    expect(r.pages).toBe(25);
    expect(r.items.length).toBeGreaterThan(10);
    expect(r.items.length + r.rejected.length).toBeLessThanOrEqual(25);
    expect(r.items.every((i) => i.mainKeyword === KEYWORD)).toBe(true);
    expect(r.items.some((i) => i.isOfficial && /fsc\.go\.kr/.test(i.url))).toBe(true);
  });

  test('실패해도 그때까지 읽은 페이지는 근거로 쓴다(시간 초과)', async () => {
    const partial = { ...research, finished: false, pages: research.pages.slice(0, 5) };
    const r = await collectGensparkEvidence(KEYWORD, { run: async () => ({ ok: false, projectId: 'p2', research: partial, elapsedMs: 600_000, error: 'GENSPARK_TIMEOUT' }) });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('TIMEOUT');
    expect(r.pages).toBe(5);
    expect(r.items.length).toBeGreaterThan(0);
  });

  test('로그인 안 됨 같은 실패는 빈 근거 + 이유', async () => {
    const r = await collectGensparkEvidence(KEYWORD, { run: async () => ({ ok: false, elapsedMs: 3000, error: 'GENSPARK_LOGIN_REQUIRED: 로그인' }) });
    expect(r.items).toEqual([]);
    expect(describeGensparkEvidence(r)).toContain('로그인');
  });

  test('실행기가 던져도 발행을 막지 않는다(빈 근거)', async () => {
    const r = await collectGensparkEvidence(KEYWORD, { run: async () => { throw new Error('boom'); } });
    expect(r.ok).toBe(false);
    expect(r.items).toEqual([]);
  });
});

describe('describeGensparkEvidence — 사장님이 읽는 한 줄', () => {
  test('성공', async () => {
    const r = await collectGensparkEvidence(KEYWORD, { run: okRun });
    const line = describeGensparkEvidence(r);
    expect(line).toContain('읽은 페이지 25곳');
    expect(line).toMatch(/근거 \d+건/);
    expect(line).toContain('130초');
  });
});

describe('renderGensparkEvidenceBlock — 에이전트 지시서용 묶음', () => {
  test('⭐ 공식 자료가 먼저 · 주소와 본문 발췌 · 전체 상한을 지킨다', async () => {
    const r = await collectGensparkEvidence(KEYWORD, { run: okRun });
    const block = renderGensparkEvidenceBlock(r.items, 6000);
    expect(block.length).toBeLessThanOrEqual(6000);
    expect(block).toContain('젠스파크');
    const firstUrl = (block.match(/https?:\/\/\S+/) || [''])[0];
    expect(/\.go\.kr|\.or\.kr/.test(firstUrl)).toBe(true);
  });

  test('근거가 없으면 빈 문자열', () => {
    expect(renderGensparkEvidenceBlock([], 6000)).toBe('');
  });
});
