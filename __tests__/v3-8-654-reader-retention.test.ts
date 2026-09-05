const fs = require('fs');
const path = require('path');

import {
  titlePromises,
  findUnkeptTitlePromises,
  extractFaqPairs,
  findFaqMismatches,
  findThinSections,
  answerExposureRatio,
} from '../src/core/final/reader-retention';
import { auditArticle, toPlainText, splitAuditSections } from '../src/core/final/article-audit';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.654 — 독자가 나가는 자리.
 *
 * 사장님: "글내용이 중요해 사람들이 읽고 이탈하면 절대안된다고"
 *
 * 하네스 100점 글을 실제로 읽어 보니(2026-09-05):
 *   제목 「환경개선부담금 면제 대상 자동 적용 여부와 신청 방법, 9월 30일 납부기한」
 *   본문 — 자동인지 신청인지 결론 없음, 신청 절차 없음. 어느 소제목도 그걸 맡지 않았다.
 * 하네스는 이걸 잴 항목이 없어 100점을 줬다. 사람은 30초면 본다.
 */
describe('v3.8.654 독자가 나가는 자리', () => {
  describe('① 제목 약속어', () => {
    const 제목 = '환경개선부담금 면제 대상 자동 적용 여부와 신청 방법, 9월 30일 납부기한';

    test('제목을 약속 조각으로 나눈다', () => {
      const p = titlePromises(제목);
      expect(p).toContain('환경개선부담금 면제 대상 자동 적용 여부');
      expect(p).toContain('신청 방법');
      expect(p).toContain('9월 30일 납부기한');
    });

    /** 실측 그대로 — 어느 소제목도 "자동 적용" 이나 "신청 방법" 을 맡지 않았다 */
    test('약속을 맡은 소제목이 없으면 잡는다', () => {
      const 실제소제목 = [
        '1. 환경개선부담금 면제 대상과 부과 기준', '2. 차량 소유 변경 전후 확인 절차',
        '3. 면제 사유에 해당하는 차량과 조건', '4. 경유차 교체와 매각 뒤 달라지는 고지',
        '5. 상품용 차량과 소액 부과금 확인법',
      ];
      // 결론 박스가 납부기한만 맡았다 — 실제 글도 그랬다
      const issues = findUnkeptTitlePromises(제목, 실제소제목, '납부기한은 9월 30일입니다.');
      expect(issues).toHaveLength(1);
      expect(issues[0]!.kind).toBe('title-promise-unkept');
      expect(issues[0]!.title).toContain('자동 적용 여부');
      expect(issues[0]!.title).toContain('신청 방법');
      expect(issues[0]!.title).not.toContain('납부기한');
      expect(issues[0]!.penalty).toBe(12);
    });

    test('소제목이 약속을 맡으면 지적하지 않는다', () => {
      const 좋은소제목 = ['1. 면제는 자동 적용인가 신청인가', '2. 면제 신청 방법과 서식', '3. 9월 30일 납부기한과 가산금'];
      expect(findUnkeptTitlePromises(제목, 좋은소제목, '')).toHaveLength(0);
    });

    test('결론 박스가 맡아도 된다', () => {
      const 박스 = '면제는 자동 적용되지 않고 신청해야 합니다. 신청 방법은 위택스에서 서식을 내려받아 제출합니다.';
      expect(findUnkeptTitlePromises(제목, ['1. 납부기한 9월 30일'], 박스)).toHaveLength(0);
    });

    /** 조각이 하나뿐인 제목은 제목 전체가 주제다 — 재지 않는다 (오탐 방지) */
    test('조각이 하나뿐이면 재지 않는다', () => {
      expect(findUnkeptTitlePromises('환경개선부담금 면제 대상 총정리', ['1. 다른 소제목'], '')).toHaveLength(0);
    });

    test('전부 못 지키면 더 크게 깎는다 — 제목이 딴 글을 가리키는 것이다', () => {
      const issues = findUnkeptTitlePromises(제목, ['1. 전혀 다른 이야기', '2. 또 다른 이야기'], '');
      expect(issues[0]!.penalty).toBeGreaterThanOrEqual(12);
      expect(issues[0]!.title).toContain('어느 소제목도');
    });
  });

  describe('② FAQ 질문–답 대응', () => {
    const 평문 = [
      '자주 묻는 질문 (FAQ)', '', 'Q.', '배출가스저감장치를 달았는데 면제 기간은 언제부터 계산하나요?', '▼',
      '저감장치 부착 차량은 3년 면제 조건으로 안내돼 있어요. 면제 기간은 장치 부착일부터 계산합니다.', '',
      'Q.', '중고차 매매상에 넘긴 상품용 차량도 제가 부담해야 하나요?', '▼',
      '날씨가 좋으면 산책을 가세요.', '',
      '이 글은 2026년 9월에 작성했습니다.',
    ].join('\n');

    test('Q/▼/답 꼴에서 짝을 꺼낸다', () => {
      const pairs = extractFaqPairs(평문);
      expect(pairs).toHaveLength(2);
      expect(pairs[0]!.question).toContain('면제 기간');
      expect(pairs[1]!.answer).toContain('산책');
    });

    test('딴 답을 잡는다', () => {
      const issues = findFaqMismatches(extractFaqPairs(평문));
      expect(issues).toHaveLength(1);
      expect(issues[0]!.title).toContain('상품용 차량');
    });

    test('마무리 문단은 답으로 세지 않는다', () => {
      const pairs = extractFaqPairs(평문);
      expect(pairs[1]!.answer).not.toContain('2026년 9월에 작성');
    });

    test('FAQ 가 없으면 빈 배열', () => {
      expect(extractFaqPairs('본문만 있는 글입니다.')).toEqual([]);
    });
  });

  describe('③ 절별 분량', () => {
    test('중간값의 1/3 아래인 절을 잡는다', () => {
      const html = '<h2>1. 첫 절</h2><p>' + '충분한 내용입니다. '.repeat(40) + '</p>'
        + '<h2>2. 둘째 절</h2><p>' + '충분한 내용입니다. '.repeat(40) + '</p>'
        + '<h2>3. 셋째 절</h2><p>' + '충분한 내용입니다. '.repeat(40) + '</p>'
        + '<h2>4. 빈약한 절</h2><p>한 줄뿐입니다.</p>';
      const r = findThinSections(splitAuditSections(html));
      expect(r.issues).toHaveLength(1);
      expect(r.issues[0]!.title).toContain('빈약한 절');
      expect(r.minRatio).toBeLessThan(0.34);
    });

    test('절이 셋 미만이면 재지 않는다', () => {
      expect(findThinSections(splitAuditSections('<h2>하나</h2><p>내용</p>')).issues).toHaveLength(0);
    });

    test('FAQ 절은 분량 비교에서 뺀다', () => {
      const html = '<h2>1. 절</h2><p>' + '내용. '.repeat(60) + '</p><h2>2. 절</h2><p>' + '내용. '.repeat(60) + '</p>'
        + '<h2>3. 절</h2><p>' + '내용. '.repeat(60) + '</p><h2>자주 묻는 질문 (FAQ)</h2><p>짧음.</p>';
      expect(findThinSections(splitAuditSections(html)).issues).toHaveLength(0);
    });
  });

  describe('④ 답 노출 비율 — 수치만, 감점 없음', () => {
    test('첫 화면에 본문 수치가 다 나오면 1.0', () => {
      const html = '<p>납부 기한은 9월 30일이고 부과는 1월 1일부터입니다.</p><h2>본문</h2><p>기한 9월 30일. 시작 1월 1일.</p>';
      expect(answerExposureRatio(html, toPlainText)).toBe(1);
    });

    test('첫 화면에 없으면 0', () => {
      const html = '<p>개요만 씁니다.</p><h2>본문</h2><p>납부 기한은 9월 30일입니다.</p>';
      expect(answerExposureRatio(html, toPlainText)).toBe(0);
    });

    test('h2 가 없으면 null — 없는 수치를 지어내지 않는다', () => {
      expect(answerExposureRatio('<p>9월 30일</p>', toPlainText)).toBeNull();
    });

    /** 감점하지 않는다 — SEO 와 광고 수익이 반대 방향이라 사장님이 실측으로 정한다 */
    test('점수에는 안 들어간다', () => {
      const html = '<h1>a 여부와 b 방법</h1><p>9월 30일</p><h2>1. a 여부</h2><p>9월 30일</p><h2>2. b 방법</h2><p>내용</p><h2>3. c</h2><p>내용</p>';
      const r = auditArticle(html);
      expect(r.stats.answerExposure).toBe(1);
      expect(r.issues.map((i) => i.kind)).not.toContain('answer-exposure');
    });
  });

  describe('하네스에 실제로 배선돼 있다', () => {
    /** 100점이던 그 글이 이제는 제목 약속 불이행으로 걸려야 한다 */
    test('제목 약속 불이행이 점수를 깎는다', () => {
      const html = '<h1>환경개선부담금 면제 대상 자동 적용 여부와 신청 방법, 9월 30일 납부기한</h1>'
        + '<h2>1. 면제 대상과 부과 기준</h2><p>' + '경유차 기준입니다. '.repeat(30) + '</p>'
        + '<h2>2. 소유 변경 확인 절차</h2><p>' + '소유 기간을 봅니다. '.repeat(30) + '</p>'
        + '<h2>3. 납부기한 9월 30일</h2><p>' + '기한을 지킵니다. '.repeat(30) + '</p>';
      const r = auditArticle(html);
      expect(r.issues.map((i) => i.kind)).toContain('title-promise-unkept');
      expect(r.score).toBeLessThan(100);
    });

    test('제목이 없으면 제목 검사를 건너뛴다 — 없는 제목을 지어내지 않는다', () => {
      const r = auditArticle('<h2>1. 절</h2><p>내용입니다.</p>');
      expect(r.issues.map((i) => i.kind)).not.toContain('title-promise-unkept');
    });

    test('부르는 쪽이 준 제목이 h1 보다 우선한다', () => {
      const html = '<h1>a</h1><h2>1. 자동 적용 여부</h2><p>' + '내용. '.repeat(30) + '</p><h2>2. 신청 방법</h2><p>' + '내용. '.repeat(30) + '</p><h2>3. 납부기한</h2><p>' + '내용. '.repeat(30) + '</p>';
      const r = auditArticle(html, [], { title: '자동 적용 여부와 신청 방법, 납부기한' });
      expect(r.issues.map((i) => i.kind)).not.toContain('title-promise-unkept');
    });

    test('세 종류가 비평 등급표와 이름표에 등록돼 있다', () => {
      const pc = read('src/core/final/post-critique.ts');
      const aa = read('src/core/final/article-audit.ts');
      for (const k of ['title-promise-unkept', 'faq-answer-mismatch', 'thin-section']) {
        expect(pc).toContain(`'${k}': {`);
        expect(aa).toContain(`'${k}': '`);
      }
    });
  });
});
