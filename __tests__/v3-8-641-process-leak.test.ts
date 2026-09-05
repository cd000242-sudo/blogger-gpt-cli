import { sanitizePromptLeaks } from '../src/core/final/generation';
import { findProcessLeak, toPlainText, auditArticle } from '../src/core/final/article-audit';

/*
 * v3.8.641 — 글 쓰는 과정이 독자에게 새어 나갔다.
 *
 * 발행글 평가(2026-09-05): "본문에 있는 '제공된 근거에는' 이라는 표현이 대표적이에요.
 *   독자에게 설명하는 글에서 갑자기 AI 가 자료의 한계를 보고하는 느낌을 줍니다."
 *
 * 실측으로 확인했다 — 그 글에 2회 있었다:
 *   "제공된 근거에는 각 상품의 전산심사 기준과 부결 사유가 제시돼 있지 않으므로, …"
 *
 * 막는 장치(sanitizePromptLeaks)는 v3.8.361 부터 있었는데 두 군데서 빗나갔다:
 *   ① 명사 목록이 `자료|데이터` 뿐 — 실제 문장은 **근거**
 *   ② 문장 끝(`않습니다`)만 봄 — 실제는 **"않으므로,"** 라는 연결 어미
 */
describe('v3.8.641 작성 과정 노출', () => {
  const 실제문장 =
    '<p>이 경우에는, 개인사업자 신용대출 갈아타기 기준만으로 원인을 단정하기 어렵습니다. '
    + '제공된 근거에는 각 상품의 전산심사 기준과 부결 사유가 제시돼 있지 않으므로, '
    + '신청 화면의 안내와 해당 상품의 공식 안내를 확인하세요.</p>';

  describe('발행 전에 지운다', () => {
    test('실제로 새어 나갔던 그 문장을 걷어낸다', () => {
      expect(toPlainText(sanitizePromptLeaks(실제문장))).not.toContain('제공된 근거에는');
    });

    /** 절만 지우고 나머지 문장은 살려야 한다 — 통째로 지우면 내용이 준다 */
    test('앞뒤 문장은 그대로 남는다', () => {
      const out = toPlainText(sanitizePromptLeaks(실제문장));
      expect(out).toContain('원인을 단정하기 어렵습니다');
      expect(out).toContain('공식 안내를 확인하세요');
    });

    test.each([
      '제공된 자료에는 해당 수치가 나와 있지 않아서',
      '주어진 근거에는 관련 기준이 언급되지 않았습니다',
      '제공된 정보에는 그 항목이 포함되지 않으므로',
      '위 출처에는 세부 조건이 확인되지 않기 때문에',
    ])('변형도 걷어낸다: %s', (조각) => {
      expect(sanitizePromptLeaks(`<p>${조각} 확인이 필요합니다.</p>`)).not.toContain('에는');
    });

    /** 멀쩡한 문장을 지우면 글이 얕아진다 — 근거 장부 사고와 같은 종류다 */
    test('비슷해 보이는 정상 문장은 안 건드린다', () => {
      const 정상 = '<p>금융위원회가 제공한 안내에는 신청 가능 시간이 명시돼 있습니다.</p>';
      expect(sanitizePromptLeaks(정상)).toBe(정상);
    });
  });

  describe('그래도 살아남으면 비평이 잡는다', () => {
    test('지적으로 올라온다', () => {
      const issues = findProcessLeak(toPlainText(실제문장));
      expect(issues).toHaveLength(1);
      expect(issues[0]!.kind).toBe('writing-process-leak');
    });

    test('무엇을 하라는지 말해 준다 — 알리지 말고 빼라', () => {
      expect(findProcessLeak(toPlainText(실제문장))[0]!.evidence).toContain('빼야지');
    });

    test('하네스 점수에 반영된다', () => {
      const 깨끗 = auditArticle('<h2>소제목</h2><p>대출 갈아타기는 자금 용도로 대상이 갈립니다.</p>');
      const 유출 = auditArticle('<h2>소제목</h2>' + 실제문장);
      expect(유출.score).toBeLessThan(깨끗.score);
      expect(유출.issues.map((i) => i.kind)).toContain('writing-process-leak');
    });

    test('멀쩡한 글에는 안 붙는다', () => {
      const 멀쩡 = '대출 갈아타기는 자금 용도에 따라 대상이 갈립니다. 운전자금인지 시설자금인지 먼저 확인하세요.';
      expect(findProcessLeak(멀쩡)).toHaveLength(0);
    });
  });

  describe('프롬프트가 미리 막는다', () => {
    const fact = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'src/core/final/fact-integrity.ts'), 'utf8');

    /** 검사·수정만 있으면 매번 뒤늦게 고친다. 애초에 안 쓰게 시키는 편이 싸다 */
    test('자료 부족을 독자에게 알리지 말라고 못박는다', () => {
      expect(fact).toContain('자료가 부족하다는 사실을 독자에게 알리지 마세요');
      expect(fact).toContain('그 항목을 통째로 빼세요');
    });
  });
});
