/**
 * v3.8.479 — 재료에 시점이 없어 작년 조건이 올해 글에 섞이던 사고.
 *
 * 실측(사용자 팩트체크, 2026-08-11): "2026 부산 청년 게임개발자 정착지원사업" 글에
 *   · "임차보증금 이자와 월세의 최대 50%"   → 2024 조건 (2026 은 월세만)
 *   · "선정일로부터 2주 이내 임차계약"       → 2024 조건 (2026 은 협약일 1개월 내 전입)
 *   · "소득 수준·주택 소유 여부와 무관"      → 2024 보도자료 표현
 * 이 섞여 나갔다. 반대로 2026 핵심(만 18~39세·2024.1.1 이후 입사·전입신고)은 빠졌다.
 *
 * 원인은 모델이 아니라 재료였다 —
 *   블로그 검색이 sort=sim 이라 첫 시행 연도(2024) 글이 상위로 오는데,
 *   API 가 주는 postdate 를 크롤러가 **버려서** 재료에 날짜가 없었다.
 *   fact-integrity 는 "장부에 있는 수치"라 정상 통과시켰고,
 *   FRESHNESS_RULES 는 모델이 시점을 몰라 지킬 수가 없었다.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  parseNaverPostDate,
  monthsBetween,
  buildFreshnessLabel,
  withFreshnessLabel,
  isStaleSource,
  STALE_AFTER_MONTHS,
} from '../src/core/crawlers/source-freshness';

const NOW = new Date('2026-08-11T00:00:00Z');

describe('parseNaverPostDate', () => {
  it('네이버 postdate(YYYYMMDD)를 ISO 로 바꾼다', () => {
    expect(parseNaverPostDate('20240315')).toBe('2024-03-15');
    expect(parseNaverPostDate(20260801)).toBe('2026-08-01');
  });

  it('형식이 아니면 빈 문자열 — 없는 날짜를 지어내지 않는다', () => {
    expect(parseNaverPostDate('')).toBe('');
    expect(parseNaverPostDate('2024')).toBe('');
    expect(parseNaverPostDate('20241332')).toBe('');
    expect(parseNaverPostDate(undefined)).toBe('');
  });
});

describe('monthsBetween', () => {
  it('경과 개월을 센다', () => {
    expect(monthsBetween('2026-08-01', NOW)).toBe(0);
    expect(monthsBetween('2026-02-11', NOW)).toBe(6);
    expect(monthsBetween('2024-03-15', NOW)).toBe(29);
  });

  it('미래 날짜는 0 (음수 없음)', () => {
    expect(monthsBetween('2027-01-01', NOW)).toBe(0);
  });
});

describe('buildFreshnessLabel — 오래된 자료에 경고를 붙인다', () => {
  it('최근 자료는 날짜만 붙인다', () => {
    const label = buildFreshnessLabel('2026-06-11', NOW);
    expect(label).toContain('2026-06-11 작성');
    expect(label).toContain('2개월 전');
    expect(label).not.toContain('⚠️');
  });

  it('사고를 낸 2024년 자료에는 "그대로 옮기지 말라"고 붙인다', () => {
    const label = buildFreshnessLabel('2024-03-15', NOW);
    expect(label).toContain('2024-03-15 작성');
    expect(label).toContain('2년 5개월 전');
    expect(label).toContain('⚠️');
    expect(label).toContain('옮기지 마세요');
  });

  it('경계값 — 12개월부터 오래된 자료다', () => {
    expect(isStaleSource('2025-08-11', NOW)).toBe(true);   // 정확히 12개월
    expect(isStaleSource('2025-09-11', NOW)).toBe(false);  // 11개월
    expect(STALE_AFTER_MONTHS).toBe(12);
  });

  it('날짜를 모르면 라벨 없음', () => {
    expect(buildFreshnessLabel('', NOW)).toBe('');
    expect(isStaleSource('', NOW)).toBe(false);
  });
});

describe('withFreshnessLabel', () => {
  it('본문 앞에 시점을 박는다', () => {
    const out = withFreshnessLabel('임차보증금 이자와 월세의 최대 50%', '2024-03-15', NOW);
    expect(out.startsWith('[2024-03-15 작성')).toBe(true);
    expect(out).toContain('임차보증금 이자와 월세의 최대 50%');
  });

  it('날짜가 없으면 원문 그대로 — 동작이 나빠지지 않는다', () => {
    expect(withFreshnessLabel('본문입니다', '', NOW)).toBe('본문입니다');
  });
});

describe('배선', () => {
  const crawler = readFileSync(join(__dirname, '..', 'src/core/content-crawler.ts'), 'utf8');
  const rules = readFileSync(join(__dirname, '..', 'src/core/final/substance-rules.ts'), 'utf8');

  it('블로그 크롤러가 postdate 를 쓴다 (예전엔 버렸다)', () => {
    expect(crawler).toContain('parseNaverPostDate((item as any).postdate)');
    expect(crawler).toContain('withFreshnessLabel(blogContent.content, isoDate)');
  });

  it('모델에게 라벨을 어떻게 다룰지 알려준다', () => {
    // 소스에서는 백틱이 이스케이프돼 있으므로 그 부분은 빼고 본다
    expect(rules).toContain('표시를 반드시 보세요');
    expect(rules).toContain('YYYY-MM-DD 작성');
    expect(rules).toContain('가장 최근 자료를 따르세요');
    expect(rules).toContain('빼는 게 틀리는 것보다 낫습니다');
  });
});
