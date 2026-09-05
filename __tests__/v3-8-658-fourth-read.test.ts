import { titlePromises } from '../src/core/final/reader-retention';
import { auditArticle, findEmptySections, findCrossSectionEchoes, splitAuditSections } from '../src/core/final/article-audit';
import { acceptRevisedSection, splitSections } from '../src/core/final/post-critique';
import { parseCpcReport, usableSlots, splitKeywordAngle } from '../src/core/keywords/cpc-report';
import { buildAnswerBlock } from '../src/core/final/answer-block';

/*
 * v3.8.658 — 네 번째 읽기: 서로 다른 키워드 5편(56 · 72 · 70 · 100 · 50).
 *
 *  ① 옛 형식(고CPC) 리포트: `**키워드: … 경우** **등급: 통과 (…)**` 한 줄에서 등급 문장까지 키워드가 됐다.
 *     그 키워드로 글이 나갔고 제목은 "시사 정치 공부를 시작한 학생…" 이 됐다.
 *  ② "9·3 노동부 지침" 이 "3 노동부 지침" 조각으로 갈려 소제목이 "2. 3 노동부 지침으로…" 가 됐다.
 *  ③ 5편 중 2편의 마지막 절이 `<div class="content"></div>` — 소제목만 있고 비었는데 어느 검사도 안 봤다.
 *  ④ "https://www. seoul. co. kr" — 고쳐 쓰기(AI 1회)가 주소에 공백을 넣었다. <a href> 만 세던 검사는 통과시켰다.
 *  ⑤ 「경영성과급 등 노동쟁의 대상 시행지침」·노동관계조정법을 인용한 글이 "근거 조항 없음" -10.
 *  ⑥ 도입부↔목차, 본문↔FAQ 뒤 마무리가 "같은 말" 로 -8 씩 — 되풀이가 설계인 구간이다.
 *  ⑦ 답 박스 질문 자리에 "[2] 확인 필요: 관리종목 지정 시점" 이 그대로 찍혔다.
 */
describe('v3.8.658 네 번째 읽기', () => {
  test('① 옛 리포트 한 줄에서 키워드만 꺼내고, "키워드 - 각도" 는 검색어와 제목으로 나눈다', () => {
    const md = [
      '# 2026-09-05 고CPC 키워드 리포트', '',
      '## 슬롯 A — 시의성·디스커버형 / 워드프레스', '',
      '**키워드: 상장유지 시가총액 기준 6개월 유예 \\- 내 종목이 코넥스 이전 대상인지와 정리매매로 가는 경우** **등급: 통과 (슬롯 A 게이트 \\- 선점 신호 2개 이상)**', '',
      '### 롱테일 파생', '- 코넥스로 이전상장된 뒤 내 계좌의 주식은 어떻게 바뀌나', '',
    ].join('\n');
    const slots = usableSlots(parseCpcReport(md));
    expect(slots).toHaveLength(1);
    expect(slots[0]!.keyword).toBe('상장유지 시가총액 기준 6개월 유예');
    expect(slots[0]!.title).toBe('상장유지 시가총액 기준 6개월 유예 - 내 종목이 코넥스 이전 대상인지와 정리매매로 가는 경우');
    expect(slots[0]!.keyword).not.toContain('등급');
  });

  test('① 등급 문장이 섞인 키워드는 아예 쓰지 않는다', () => {
    expect(splitKeywordAngle('환경개선부담금 면제', '확정 제목')).toEqual({ keyword: '환경개선부담금 면제', title: '확정 제목' });
    const md = '# r\n\n## 슬롯 B - x\n\n키워드: 아주 긴 키워드 등급: 통과 (슬롯 B 게이트)\n';
    expect(usableSlots(parseCpcReport(md))).toHaveLength(0);
  });

  test('② 숫자 사이의 ·, -, : 는 약속 조각의 경계가 아니다', () => {
    expect(titlePromises('성과급 요구 파업이 불법으로 갈리는 선, 9·3 노동부 지침')).toEqual(['성과급 요구 파업이 불법으로 갈리는 선', '9·3 노동부 지침']);
    expect(titlePromises('햇살론15가 거절되는 지점 - 2026-09-04 서민금융 센터')).toEqual(['햇살론15가 거절되는 지점', '2026-09-04 서민금융 센터']);
  });

  test('③ 소제목만 있고 본문이 없는 절을 잡는다 — h2 바로 뒤 h3 는 정상', () => {
    const html = '<h2>1. 첫 절</h2><h3>1-1. 내용</h3><div class="content"><p>' + '충분한 내용입니다. '.repeat(20) + '</p></div>'
      + '<h2>5. 공식 안내 경로</h2><h3>5-1. 공식 경로로 되짚기</h3><div class="content">\n\n</div>'
      + '<h2>자주 묻는 질문 (FAQ)</h2><details><summary>Q</summary><p>답</p></details>';
    const issues = findEmptySections(html);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.title).toContain('5-1. 공식 경로로 되짚기');
    expect(auditArticle(html).issues.map((i) => i.kind)).toContain('empty-section');
  });

  test('④ 고쳐 쓴 구간에서 주소가 깨지면 원본을 쓴다', () => {
    // splitSections 의 0번은 도입부다 — h2 구간은 1번부터
    const original = splitSections('<h2>5. 자료</h2><p>보도는 https://www.seoul.co.kr/news/economy/2026/09/04/1 에서 봅니다.</p>')[1]!;
    expect(original.html).toContain('seoul.co.kr');
    const broken = '<h2>5. 자료</h2><p>보도는 https://www. seoul. co. kr/news/economy/2026/09/04/1 에서 봅니다. 자세한 내용은 기사에 있습니다.</p>';
    const r = acceptRevisedSection(broken, original);
    expect(r.accepted).toBe(false);
    expect(r.reason).toContain('주소');
    const fine = '<h2>5. 자료</h2><p>보도는 https://www.seoul.co.kr/news/economy/2026/09/04/1 에서 봅니다. 자세한 내용은 기사에 있습니다.</p>';
    expect(acceptRevisedSection(fine, original).accepted).toBe(true);
  });

  test('⑤ 이름 붙은 법·지침을 인용하면 근거 없음이 아니다', () => {
    const html = '<h2>1. 기준</h2><p>' + '고용노동부는 「경영성과급 등 노동쟁의 대상 시행지침」을 냈습니다. 노동조합 및 노동관계조정법상 쟁의행위의 정당성은 요구 내용만으로 끝나지 않습니다. 파업 여부를 다투는 노사는 이 지침을 먼저 봅니다. '.repeat(6) + '</p>';
    expect(auditArticle(html).issues.map((i) => i.kind)).not.toContain('no-legal-basis');
  });

  test('⑤ 맨 "법" 한 글자는 여전히 근거가 아니다', () => {
    const html = '<h2>1. 신청 방법</h2><p>' + '신청 방법은 간단합니다. 불법 주정차는 과태료 대상입니다. 노동조합이 파업을 하면 회사가 대응합니다. '.repeat(8) + '</p>';
    const r = auditArticle(html);
    // 제도 글로 판정되면 근거 없음이 걸려야 하고, 아니면 안 걸린다 — 어느 쪽이든 "법" 낱글자로 통과시키지는 않는다
    const text = html.replace(/<[^>]+>/g, ' ');
    expect(/[가-힣]{2,20}법(?=\s*(?:상|에\s*따|에\s*의|이\s*정|[을를은는의과와]\s))/.test(text)).toBe(false);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  test('⑥ 목차·요약·FAQ 구간은 되풀이 검사에서 뺀다', () => {
    const 문장 = '온라인 신청은 9월 7일부터 시작하고 방문 신청은 9월 14일부터 시작합니다.';
    const html = '<p>' + 문장 + ' 이 글은 기준일과 신청 방법을 정리합니다.</p>'
      + '<h2>📌 전체 읽어보기 절차</h2><p>' + 문장 + '</p>'
      + '<h2>1. 신청</h2><p>' + 문장 + ' 그리고 다른 내용입니다.</p>'
      + '<h2>자주 묻는 질문 (FAQ)</h2><p>' + 문장 + '</p>';
    const issues = findCrossSectionEchoes(splitAuditSections(html));
    for (const i of issues) {
      expect(i.title).not.toContain('읽어보기');
      expect(i.title).not.toContain('FAQ');
    }
  });

  test('③ 조립 직전에 빈 절을 목차와 본문에서 함께 뺀다', () => {
    const fs = require('fs');
    const path = require('path');
    const { blockBetween } = require('./helpers/source-block');
    const o = fs.readFileSync(path.join(__dirname, '..', 'src/core/final/orchestration.ts'), 'utf8');
    const block = blockBetween(o, 'v3.8.658 — 빈 절은 목차에도', 'html += generateTOCFinal(h2Titles);');
    expect(block).toContain('sections.splice(0, sections.length, ...keptSections)');
    expect(block).toContain('if (aligned) h2Titles = keptTitles;');
    expect(block).toContain('본문이 빈 절을 뺐습니다');
  });

  test('⑦ 답 박스 질문 자리에 온 점검 메모는 버리고 키워드 질문으로 대신한다', () => {
    const html = buildAnswerBlock({
      keyword: '상장유지 시가총액 기준',
      question: '[2] 확인 필요: 관리종목 지정 시점',
      answer: '코스닥 300억원과 코스피 500억원 기준은 2027년 7월 적용됩니다. 재무요건 충족과 이전 희망 시 코넥스로 이전할 수 있습니다.',
    });
    expect(html).not.toContain('확인 필요');
    expect(html).not.toContain('[2]');
    expect(html).toContain('상장유지 시가총액 기준');
  });
});
