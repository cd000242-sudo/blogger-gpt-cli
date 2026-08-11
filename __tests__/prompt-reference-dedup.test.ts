/**
 * v3.8.474 회귀 — 같은 자료를 프롬프트에 두 번 넣고 두 번 과금하던 문제.
 *
 * buildGroundingReference 는 factContext + officialBlock + crawledPosts 전문을
 * 하나로 합친다. 그런데 orchestration 조립부가 officialBlock 과 contents 를
 * **또** 붙였다. 12,000자 상한이 중복분을 잘라내 눈에 안 띄었을 뿐이다.
 *
 * 재료가 얇을 때는 상한에 안 닿아 손해가 안 보였지만, v3.8.473 으로 본문이
 * 들어오면 중복이 상한을 먹어 정작 볼 자료가 밀려난다.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import { buildGroundingReference } from '../src/core/final/fact-guard';

describe('buildGroundingReference — 장부가 소스를 이미 품는다', () => {
  const factContext = '[네이버 블로그 최신순 검색 결과] 요약 스니펫 모음';
  const officialBlock = '===== 공공기관 확인 근거 =====\n환경부 보조금 650만원';
  const crawledPosts = [
    { title: '상위글 1', content: '국고 보조금은 최대 650만원이고 신청은 3월 31일까지입니다.' },
    { title: '상위글 2', content: '지자체 보조금은 지역마다 다르며 서울시는 180만원입니다.' },
  ];

  it('팩트체크·기관근거·크롤링 본문을 모두 담는다', () => {
    const ledger = buildGroundingReference({ factContext, officialBlock, crawledPosts });

    expect(ledger).toContain(factContext);
    expect(ledger).toContain('환경부 보조금 650만원');
    expect(ledger).toContain('국고 보조금은 최대 650만원');
    expect(ledger).toContain('지자체 보조금은 지역마다');
  });

  it('장부는 항상 factContext 단독보다 길다 — 그래서 조립부가 장부로 교체한다', () => {
    const ledger = buildGroundingReference({ factContext, officialBlock, crawledPosts });
    expect(ledger.length).toBeGreaterThan(factContext.length);
  });

  it('소스가 없으면 factContext 만 남는다 (교체 조건이 안 걸린다)', () => {
    const ledger = buildGroundingReference({ factContext, officialBlock: '', crawledPosts: [] });
    expect(ledger).toBe(factContext);
    expect(ledger.length).toBe(factContext.length);
  });
});

describe('orchestration 조립부', () => {
  const orchestration = readFileSync(
    join(__dirname, '..', 'src/core/final/orchestration.ts'),
    'utf8',
  );
  const assembly = orchestration.slice(
    orchestration.indexOf('factEnrichedContents = ['),
    orchestration.indexOf('factEnrichedContents = [') + 700,
  );

  it('장부가 소스를 품었으면 officialBlock 을 다시 붙이지 않는다', () => {
    expect(assembly).toContain('officialBlock && !ledgerCoversSources');
  });

  it('장부가 소스를 품었으면 crawledPosts 본문(contents)을 다시 붙이지 않는다', () => {
    expect(assembly).toContain('ledgerCoversSources ? [] : contents');
    // 무조건 붙이던 옛 형태가 되살아나지 않게 잠근다
    expect(assembly).not.toMatch(/\n\s*\.\.\.contents,/);
  });

  it('근거 정책 프롬프트와 장부 자체는 항상 들어간다 (수집 실패해도 무제한 생성 금지)', () => {
    expect(assembly).toContain('buildFactIntegrityPrompt(keyword, factEvidence)');
    expect(assembly).toContain('[FACT EVIDENCE - ${factEvidence.provider}]');
  });
});
