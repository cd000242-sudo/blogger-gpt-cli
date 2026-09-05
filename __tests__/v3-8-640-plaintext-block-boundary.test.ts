import { toPlainText, auditArticle } from '../src/core/final/article-audit';

/*
 * v3.8.640 — 없는 결함을 만들어 내던 검사기.
 *
 * 사장님이 발행글에 비평을 돌리고 물었다: "이러는데 맞니..? 수정발행하기전에 물어보는거야"
 *
 * 잘 물어보셨다. 17개 지적 중 "마침표 뒤에 공백 없이 다음 문장이 붙었습니다" 4건은
 * **전부 없는 결함이었다.** 실측 2026-09-05:
 *
 *   원문:            ...구분해 보세요.</blockquote><p>이미 제외 대상인...
 *   toPlainText:     ...구분해 보세요.이미 제외 대상인...      ← 붙어 보인다
 *   브라우저 innerText: 붙음 0건                                ← 독자는 본 적 없다
 *
 * 원인은 글이 아니라 검사기였다. 블록 태그 목록에 blockquote 가 없어서
 * 두 문단이 한 줄로 이어졌다. 그대로 "수정발행" 을 눌렀다면 멀쩡한 문단을
 * AI 가 다시 썼을 것이다 — 고칠 것이 없는데 고치는 쪽이 더 위험하다.
 */
describe('v3.8.640 문단 경계를 빠뜨리지 않는다', () => {
  describe('블록 태그마다 줄을 나눈다', () => {
    /** 실제로 오탐을 낸 그 조각 */
    test('blockquote 다음 문단이 붙지 않는다', () => {
      const html = '<blockquote>운전자금인지 시설자금인지부터 구분해 보세요.</blockquote>'
        + '<p>이미 제외 대상인 대출이라면 반복할 필요가 없어요.</p>';
      expect(toPlainText(html)).not.toMatch(/[.!?][가-힣]/);
    });

    test.each([
      ['section', '<section><p>앞 문장입니다.</p></section><p>뒤 문장입니다.</p>'],
      ['ul', '<ul><li>앞 문장입니다.</li></ul><p>뒤 문장입니다.</p>'],
      ['ol', '<ol><li>앞 문장입니다.</li></ol><p>뒤 문장입니다.</p>'],
      ['aside', '<aside>앞 문장입니다.</aside><p>뒤 문장입니다.</p>'],
      ['table', '<table><tr><td>앞 문장입니다.</td></tr></table><p>뒤 문장입니다.</p>'],
      ['details', '<details><summary>앞 문장입니다.</summary></details><p>뒤 문장입니다.</p>'],
      ['figure', '<figure><figcaption>앞 문장입니다.</figcaption></figure><p>뒤 문장입니다.</p>'],
      ['div', '<div>앞 문장입니다.</div><p>뒤 문장입니다.</p>'],
    ])('%s 경계에서도 안 붙는다', (_name, html) => {
      expect(toPlainText(html)).not.toMatch(/[.!?][가-힣]/);
    });

    /** 여는 태그만 있고 닫는 태그가 없는 경우도 있다 */
    test('여는 태그도 경계로 본다', () => {
      expect(toPlainText('앞 문장입니다.<p>뒤 문장입니다.')).not.toMatch(/[.!?][가-힣]/);
    });

    /** 인라인 태그는 경계가 아니다 — 여기서 줄을 나누면 한 문장이 토막 난다 */
    test('강조 태그로는 줄을 나누지 않는다', () => {
      const out = toPlainText('<p>이것은 <strong>중요한</strong> 한 문장입니다.</p>');
      expect(out.trim()).toBe('이것은 중요한 한 문장입니다.');
    });
  });

  describe('진짜 붙은 문장은 여전히 잡는다', () => {
    /** 오탐을 없애려다 진짜를 놓치면 아무 의미가 없다 */
    test('한 문단 안에서 붙은 것은 잡는다', () => {
      const html = '<p>앞 문장입니다.뒤 문장이 바로 붙었습니다.</p>';
      expect(toPlainText(html)).toMatch(/[.!?][가-힣]/);
    });

    test('하네스가 그걸 지적한다', () => {
      const html = '<h2>소제목</h2>'
        + '<p>대출 갈아타기는 조건을 먼저 봅니다.운전자금인지 시설자금인지부터 구분해야 합니다.</p>'.repeat(6);
      const kinds = auditArticle(html).issues.map((i) => i.kind);
      expect(kinds).toContain('glued-sentence');
    });
  });

  describe('멀쩡한 글에는 지적을 만들지 않는다', () => {
    test('블록이 섞인 정상 글에서 붙음 0건', () => {
      const html = [
        '<section><p>대출 갈아타기 부결은 신용점수 하나로 결정되지 않아요.</p></section>',
        '<blockquote>대출 명칭보다 실제 자금 용도가 더 먼저입니다.</blockquote>',
        '<ul><li>운전자금인지 시설자금인지 확인합니다.</li></ul>',
        '<p>이미 제외 대상이라면 반복할 필요가 없어요.</p>',
      ].join('');
      const kinds = auditArticle(html).issues.map((i) => i.kind);
      expect(kinds).not.toContain('glued-sentence');
    });
  });
});
