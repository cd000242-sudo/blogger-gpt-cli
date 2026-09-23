/**
 * 제목 연도 중복 정상화 (v3.8.750 · POST-PUBLISH AUDIT, leadernam 5865)
 *
 * 실측: 키워드 "2026 신규사업자 카드수수료 환급 조회" → 발행 제목 "2026년 2026 신규사업자 카드수수료 환급 조회 평균 38만7천원"
 *   (WordPress 제목·Yoast 제목·주소 slug 모두 같은 중복 — slug 는 WordPress 가 제목으로 만든다).
 * 원인(재현으로 확정): 제목 프롬프트(generation.ts)의 연도 틀 「"2026년 {키워드} …"」 이 연도를 품은 키워드를 만나
 *   "2026년 2026 신규사업자 …" 를 그대로 지시한다. 같은 프롬프트로 gpt-5.6-terra 5회 → 모델 원본 5/5 가 이 꼴.
 *   후처리(repairTitleYear·frontTitleYear·생성기 정리)는 넣지도 빼지도 않았다.
 * 프롬프트는 두고(결정적으로 풀린다) 후처리에서 **바로 옆에 붙은 같은 연도만** 한 번으로 줄인다.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { collapseRepeatedYear } from '../src/core/final/generation';
import { blockBetween } from './helpers/source-block';

describe('collapseRepeatedYear — 바로 옆에 붙은 같은 연도만 한 번으로', () => {
  it.each([
    ['2026년 2026 신규사업자 카드수수료 환급 조회 평균 38만7천원', '2026년 신규사업자 카드수수료 환급 조회 평균 38만7천원'],
    ['2026 2026년 신규사업자 카드수수료 환급', '2026년 신규사업자 카드수수료 환급'],
    ['2026년 2026년 신규사업자', '2026년 신규사업자'],
    ['2026 2026 신규사업자', '2026 신규사업자'],
    ['2026년 2026년 2026 신규사업자', '2026년 신규사업자'],
    ['신규사업자 2026년 2026 환급', '신규사업자 2026년 환급'],
  ])('⭐ 정상화: %s', (input, expected) => {
    expect(collapseRepeatedYear(input)).toBe(expected);
  });

  it.each([
    '2025년 대비 2026년 달라진 카드수수료',
    '2026년 9월 신규사업자 카드수수료 환급',
    '2025년 2026년 카드수수료 비교',
    '2025 2026 연봉 비교',
    '2026년 2026년형 쏘렌토 보조금',
    '2026년 20260명 지원',
    '청년도약계좌 2026년 해지',
    '2026년 하반기 2026 개정 요율',
  ])('⭐ 보존: %s', (input) => {
    expect(collapseRepeatedYear(input)).toBe(input);
  });

  it('⭐ 주소(slug)에도 중복이 남지 않는다 — WordPress 는 발행 제목으로 slug 를 만든다(Orbit 은 slug 를 보내지 않음)', () => {
    const wpSlug = (t: string) => t.trim().replace(/\s+/g, '-');
    const slug = wpSlug(collapseRepeatedYear('2026년 2026 신규사업자 카드수수료 환급 조회 평균 38만7천원'));
    expect(slug).toBe('2026년-신규사업자-카드수수료-환급-조회-평균-38만7천원');
    expect(slug).not.toMatch(/2026년-2026/);
  });

  it('⭐ 재현된 모델 원본 5개(gpt-5.6-terra, 5865 프롬프트) → 모두 정상화', () => {
    const raw = [
      '2026년 2026 신규사업자 카드수수료 환급 조회 얼마나 받을까',
      '2026년 2026 신규사업자 카드수수료 환급 조회 환급액 확인',
      '2026년 2026 신규사업자 카드수수료 환급 조회 미납도 환급?',
      '2026년 2026 신규사업자 카드수수료 환급 조회 미납 확인',
      '2026년 2026 신규사업자 카드수수료 환급 조회 미납이면',
    ];
    for (const t of raw) expect(collapseRepeatedYear(t)).toMatch(/^2026년 신규사업자 카드수수료 환급 조회 /);
  });

  it('빈 값·비문자도 안전하다', () => {
    expect(collapseRepeatedYear('')).toBe('');
    expect(collapseRepeatedYear(undefined as unknown as string)).toBe('');
  });
});

describe('orchestration 배선 — AI 제목이 나가기 전에 반드시 지난다', () => {
  const orch = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf8');

  it('⭐ makeTitle: 연도를 맨 앞으로 옮긴 **뒤에** 줄인다 (옮기면서 붙을 수 있다)', () => {
    expect(orch).toMatch(/if \(!payload\.keywordFront\) t = frontTitleYear\(t\);[\s\S]{0,300}?t = collapseRepeatedYear\(t\);\s*return t;/);
  });

  // 비평 루프가 끝난 자리 ~ 다음 단계(값을 못 지킨 소제목 정리) 사이
  const afterLoop = blockBetween(orch, 'void titleRevisedByCritic;', 'const sections = allSectionsObj.sections;');

  it('⭐ 제목이 더 바뀌지 않는 자리(비평 루프 뒤)에서 한 번 더 — 값 걷어냄·도려냄·키워드 재조립으로 붙은 것까지', () => {
    expect(afterLoop).toMatch(/h1 = collapseRepeatedYear\(String\(h1 \|\| ''\)\)/);
    // 그 뒤로는 제목을 바꾸는 자리가 없어야 한다 (주석 줄은 빼고 본다)
    const rest = orch.split('const sections = allSectionsObj.sections;')[1] || '';
    const codeAfter = rest.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    expect(rest.length).toBeGreaterThan(0);
    expect(codeAfter).not.toMatch(/\bh1 = /);
  });

  it('사람이 정한 제목(custom)은 건드리지 않는다', () => {
    expect(afterLoop).toMatch(/payload\.titleMode === 'custom' && fixedTitle/);
  });

  it('제목 프롬프트는 이번에 바꾸지 않았다 (결정적으로 풀리므로)', () => {
    const gen = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'final', 'generation.ts'), 'utf8');
    expect(gen).toContain('연도를 쓴다면 "${currentYear}년 ${keyword} …" 처럼 연도 바로 뒤에 키워드가 오게 하세요.');
  });
});
