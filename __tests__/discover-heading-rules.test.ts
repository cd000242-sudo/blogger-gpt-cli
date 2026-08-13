/**
 * 디스커버 모드 소제목 규칙 (v3.8.497)
 *
 * 배경: leadernam.com 디스커버 모드 글에서 제목은 "부모님 집 누수인데 내
 * 일상생활배상책임으로 될까" 로 사람에게 말하는데, 소제목은
 * "가족 일상생활중 배상책임 II 누수 보장 한도와 특약" 처럼 검색어를 늘어놓고 있었다.
 * 2026-02 디스커버 업데이트가 제목·본문 정합성을 보므로 이 어긋남은 손해다.
 *
 * 규칙이 프롬프트에 실제로 들어가는지, 검사기가 실측 사례를 잡는지 확인한다.
 */
import { buildDiscoverBodyBlock, findDiscoverHeadingIssues } from '../src/core/final/discover-mode';
import { postProcessAgentArticle } from '../src/core/final/agent-harness';

/** 여는 태그부터 닫는 태그까지를 통째로 집는다 (고정 길이 슬라이스 금지) */
function blockBetween(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  if (from < 0) return '';
  const to = source.indexOf(end, from + start.length);
  return to < 0 ? source.slice(from) : source.slice(from, to);
}

describe('디스커버 본문 프롬프트에 소제목 규칙이 들어간다', () => {
  const block = buildDiscoverBodyBlock(2026);

  it('소제목을 사람에게 말하듯 쓰라는 지시가 있다', () => {
    expect(block).toContain('소제목도 사람에게 말하듯 쓰세요');
  });

  it('실측에서 나온 나쁜 예와 고친 예를 함께 보여준다', () => {
    const rule = blockBetween(block, '5. **소제목도', '🚫');
    expect(rule).toContain('가족 일상생활중 배상책임 II 누수 보장 한도와 특약');
    expect(rule).toContain('한도가 1억이어도 다 안 나오는 경우');
  });

  it('키워드를 소제목마다 반복하지 말라고 한다', () => {
    expect(block).toContain('같은 키워드를 소제목마다 반복하지 말고');
  });
});

describe('소제목 검사기', () => {
  const badHtml = `
    <h2>1. 가족 일상생활중 배상책임 누수 보상 기준</h2><p>본문</p>
    <h2>2. 가족 일상생활중 배상책임 누수 자기부담금 계산법</h2><p>본문</p>
    <h2>3. 가족 일상생활중 배상책임 누수 보장 한도와 특약</h2><p>본문</p>
    <h2>4. 가족 일상생활중 배상책임 누수 청구 방법</h2><p>본문</p>
  `;

  it('키워드가 소제목마다 되풀이되면 잡아낸다', () => {
    const issues = findDiscoverHeadingIssues(badHtml, '일상생활 배상책임 누수');
    expect(issues.join(' ')).toContain('키워드를 그대로 반복');
  });

  it('명사로 끝나는 소제목이 몰려 있으면 알린다', () => {
    const issues = findDiscoverHeadingIssues(badHtml, '일상생활 배상책임 누수');
    expect(issues.join(' ')).toContain('명사로 끝나는 소제목');
  });

  it('사람에게 말하는 소제목은 걸리지 않는다', () => {
    const goodHtml = `
      <h2>부모님 집이면 보상이 안 될 수도 있습니다</h2><p>본문</p>
      <h2>주민등록을 같이 두면 어떻게 갈리나</h2><p>본문</p>
      <h2>자기부담금 얼마 떼고 받나</h2><p>본문</p>
      <h2>한도가 1억이어도 다 안 나오는 경우</h2><p>본문</p>
    `;
    expect(findDiscoverHeadingIssues(goodHtml, '일상생활 배상책임 누수')).toEqual([]);
  });

  it('소제목이 없으면 조용히 넘어간다', () => {
    expect(findDiscoverHeadingIssues('<p>소제목 없는 글</p>', '누수')).toEqual([]);
  });

  it('키워드를 안 넘겨도 터지지 않는다', () => {
    expect(() => findDiscoverHeadingIssues(badHtml)).not.toThrow();
  });
});

describe('에이전트 모드에도 같은 검사가 걸린다', () => {
  const badHtml = `
    <h2>1. 청년월세지원 신청 자격 조건</h2><p>본문입니다.</p>
    <h2>2. 청년월세지원 신청 방법</h2><p>본문입니다.</p>
    <h2>3. 청년월세지원 지급일 정리</h2><p>본문입니다.</p>
    <h2>4. 청년월세지원 유의사항 총정리</h2><p>본문입니다.</p>
  `;

  it('디스커버 모드면 소제목 경고가 보고서에 담긴다', () => {
    const report = postProcessAgentArticle(badHtml, {
      contentMode: 'discover',
      title: '청년월세지원 결과가 안 나올 때',
      keyword: '청년월세지원',
    });
    expect(report.warnings.join(' ')).toMatch(/소제목/);
  });

  it('디스커버 모드가 아니면 소제목을 문제 삼지 않는다', () => {
    const report = postProcessAgentArticle(badHtml, {
      contentMode: 'adsense',
      title: '청년월세지원 결과가 안 나올 때',
      keyword: '청년월세지원',
    });
    expect(report.warnings.join(' ')).not.toMatch(/소제목 \d+개가 키워드/);
  });

  it('검사가 발행을 막지 않는다 — 본문은 그대로 나온다', () => {
    const report = postProcessAgentArticle(badHtml, {
      contentMode: 'discover',
      title: '청년월세지원 결과가 안 나올 때',
      keyword: '청년월세지원',
    });
    expect(report.html).toContain('청년월세지원 신청 자격 조건');
  });
});
