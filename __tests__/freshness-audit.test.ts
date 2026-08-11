/**
 * v3.8.479 (3·4번) — 최신 자료 확보 + 시점 정합성 측정.
 *
 * 1·2번(날짜 라벨)은 모델에 대한 **부탁**이다. 안 지키거나 최신 자료가 애초에
 * 재료에 없으면 그대로 나간다. 실측 사고가 정확히 그 모양이었다 —
 * 본문은 2026년 기준이라는데 근거는 전부 2024년 자료였다.
 *
 * 3번: 유사도순 단독이면 글이 가장 많이 쓰인 연도가 상위를 독점한다 → 최신순을 섞는다
 * 4번: 나간 결과를 측정한다 — 부탁이 아니라 확인이다
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { auditFreshness, extractSourceDates, claimsYear } from '../src/core/crawlers/freshness-audit';
import { withFreshnessLabel } from '../src/core/crawlers/source-freshness';

const NOW = new Date('2026-08-11T00:00:00Z');
const ledgerWith = (...dates: string[]) =>
  dates.map((d, i) => withFreshnessLabel(`자료 ${i + 1} 본문입니다.`, d, NOW)).join('\n\n');

describe('extractSourceDates — 크롤러가 박은 라벨을 다시 읽는다', () => {
  it('장부에서 작성일을 모두 뽑는다', () => {
    expect(extractSourceDates(ledgerWith('2024-03-15', '2026-07-01'))).toEqual(['2024-03-15', '2026-07-01']);
  });

  it('라벨이 없으면 빈 배열', () => {
    expect(extractSourceDates('날짜 없는 자료입니다')).toEqual([]);
    expect(extractSourceDates('')).toEqual([]);
  });
});

describe('claimsYear', () => {
  it('본문이 특정 연도 기준이라고 말하는지 본다', () => {
    expect(claimsYear('2026년 기준 지원금은 월 25만원입니다.', 2026)).toBe(true);
    expect(claimsYear('2026 년 기준', 2026)).toBe(true);
    expect(claimsYear('지원금은 월 25만원입니다.', 2026)).toBe(false);
  });
});

describe('auditFreshness — 실측 사고를 잡아내는가', () => {
  it('🔴 본문은 올해라는데 근거가 전부 작년 이전이면 강하게 경고한다 (사고 재현)', () => {
    const audit = auditFreshness(
      ledgerWith('2024-03-15', '2024-05-02', '2023-11-20'),
      '2026년 기준 임차보증금 이자와 월세의 최대 50%를 지원합니다.',
      NOW,
    );

    expect(audit.datedSources).toBe(3);
    expect(audit.staleSources).toBe(3);
    expect(audit.hasRecentSource).toBe(false);
    expect(audit.warnings).toHaveLength(1);
    expect(audit.warnings[0]).toContain('2026년 기준이라고 말하는데');
    expect(audit.warnings[0]).toContain('최신 공고를 확인');
  });

  it('근거가 전부 오래됐지만 본문이 연도를 주장하지 않으면 톤을 낮춘다', () => {
    const audit = auditFreshness(ledgerWith('2024-03-15', '2024-05-02'), '지원금은 월 25만원입니다.', NOW);
    expect(audit.warnings).toHaveLength(1);
    expect(audit.warnings[0]).toContain('제도·금액이 바뀌었을 수 있습니다');
  });

  it('오래된 자료가 70% 이상이면 섞임을 경고한다', () => {
    const audit = auditFreshness(
      ledgerWith('2024-01-10', '2024-02-10', '2024-03-10', '2026-07-01'),
      '지원 조건을 정리했습니다.',
      NOW,
    );
    expect(audit.staleSources).toBe(3);
    expect(audit.hasRecentSource).toBe(true);
    expect(audit.warnings[0]).toContain('섞이지 않았는지');
  });

  it('최신 자료가 충분하면 잔소리하지 않는다', () => {
    const audit = auditFreshness(
      ledgerWith('2026-07-01', '2026-06-15', '2024-03-15'),
      '2026년 기준 월 25만원입니다.',
      NOW,
    );
    expect(audit.warnings).toEqual([]);
  });

  it('날짜를 아는 자료가 없으면 아무 판단도 하지 않는다', () => {
    expect(auditFreshness('날짜 없는 자료', '2026년 기준입니다.', NOW).warnings).toEqual([]);
    expect(auditFreshness('', '', NOW).datedSources).toBe(0);
  });

  it('잘못된 입력에도 던지지 않는다 — 발행을 막으면 안 된다', () => {
    expect(() => auditFreshness(null as any, undefined as any, NOW)).not.toThrow();
  });
});

describe('배선', () => {
  const crawler = readFileSync(join(__dirname, '..', 'src/core/content-crawler.ts'), 'utf8');
  const orchestration = readFileSync(join(__dirname, '..', 'src/core/final/orchestration.ts'), 'utf8');

  it('블로그 검색이 최신순을 섞는다 (유사도 단독 금지)', () => {
    expect(crawler).toContain('mergeRecentBlogItems');
    expect(crawler).toContain('sort=date');
  });

  it('최신순 호출이 실패해도 유사도 결과로 계속한다', () => {
    const fn = crawler.slice(
      crawler.indexOf('private async mergeRecentBlogItems'),
      crawler.indexOf('private async mergeRecentBlogItems') + 2200,
    );
    expect(fn).toContain('if (recent.length === 0) return sim.slice(0, maxResults)');
    expect(fn).toContain('AbortSignal.timeout(8000)');
  });

  it('최신을 앞에 둔다 — 프롬프트가 잘려도 살아남아야 한다', () => {
    const fn = crawler.slice(
      crawler.indexOf('private async mergeRecentBlogItems'),
      crawler.indexOf('private async mergeRecentBlogItems') + 2200,
    );
    expect(fn).toMatch(/take\(recent, recentQuota\);[\s\S]{0,120}take\(sim, maxResults\)/);
  });

  it('시점 감사가 실속 게이트 옆에서 돌고 발행을 막지 않는다', () => {
    expect(orchestration).toContain('auditFreshness');
    expect(orchestration).toContain('[FRESHNESS]');
  });
});
