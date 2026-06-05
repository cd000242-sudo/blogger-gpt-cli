import { resolveMultipleOfficialLinks, resolveOfficialLink } from '../src/cta/resolve';
import { isContextuallySafeCtaUrl } from '../src/core/final/generation';

describe('CTA official link resolver safety', () => {
  it('직접 매칭이 없는 임의 키워드는 기본 weight만으로 추천하지 않는다', () => {
    expect(resolveOfficialLink({ query: '완전히 임의의 초록색 생각 정리법' })).toBeNull();
    expect(resolveMultipleOfficialLinks({ query: '완전히 임의의 초록색 생각 정리법' })).toEqual([]);
  });

  it('KTX 예매처럼 직접 매칭되는 여행/교통 키워드는 관련 공식 사이트를 찾는다', () => {
    const result = resolveOfficialLink({ query: 'KTX 예매' });

    expect(result?.url).toContain('letskorail.com');
  });

  it('지원금 신청 키워드는 여행 사이트가 아니라 복지/공공 성격으로 매칭된다', () => {
    const result = resolveOfficialLink({ query: '청년 지원금 신청' });

    expect(result?.url).toContain('bokjiro.go.kr');
  });
});

describe('CTA contextual URL safety', () => {
  const ktoChecklistUrl = 'https://www.kto.visitkorea.or.kr/trip/ready/checklist.do?conts_id=93211&tab=tab_ready_prep';

  it('비여행 키워드에는 KTO 여행 체크리스트 URL을 차단한다', () => {
    expect(isContextuallySafeCtaUrl(ktoChecklistUrl, '청년 지원금 신청', 'external')).toBe(false);
  });

  it('여행 키워드에는 KTO 여행 URL을 허용한다', () => {
    expect(isContextuallySafeCtaUrl(ktoChecklistUrl, '해외여행 준비 체크리스트', 'external')).toBe(true);
  });
});
