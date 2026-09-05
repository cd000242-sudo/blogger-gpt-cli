const fs = require('fs');
const path = require('path');

import { buildAnswerBlock, breakSentences } from '../src/core/final/answer-block';
import { braceBlock, linesAfter } from './helpers/source-block';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.639 — 결론 박스 문단정리 · 박스 테두리.
 *
 * 사장님: "이건 이런식으로 문단정리를 해줘 그리고 박스는 테두리가 뚜렷하게
 *          보여야 더 깔끔하게 보일듯한데 소제목이던지 표던지 이런박스말이야"
 *
 * 두 번째 스크린샷은 **사장님이 편집기에서 손으로 고쳐 놓은 것**이었다.
 * 앱은 문장을 한 줄로 붙여 내보내고 있었다 — 손이 하던 일을 앱이 하게 한다.
 *
 * 테두리는 실측(글 페이지 1280px)에서 이렇게 나왔다:
 *   blockquote 0px · 결론 박스 1px #cfe3de(배경과 거의 같은 색) · 독자 박스 1px #e2e8f0
 */
describe('v3.8.639 문단정리와 박스 테두리', () => {
  describe('문장마다 줄바꿈', () => {
    const 세문장 =
      '개인사업자 신용대출 갈아타기 서비스는 은행권 사업자명의 운전자금 신용대출을 대상으로 합니다. '
      + '부동산임대업 대출과 담보 대출은 대상에서 제외됩니다. '
      + '대상이어도 한도와 DSR, 재직과 소득 증빙 등을 심사합니다.';

    test('문장 사이에 줄바꿈을 넣는다', () => {
      const out = breakSentences(세문장);
      expect(out.match(/<br>/g)).toHaveLength(2);
      expect(out).toContain('대상으로 합니다.<br>부동산임대업');
    });

    test('한 문장이면 손대지 않는다 — 없는 줄바꿈을 만들지 않는다', () => {
      const 한문장 = '개인사업자 신용대출 갈아타기는 은행권 운전자금 대출만 대상입니다.';
      expect(breakSentences(한문장)).toBe(한문장);
    });

    /** 3.5% 같은 숫자를 문장 끝으로 보면 엉뚱한 데서 줄이 끊긴다 */
    test('숫자 사이의 점에서는 안 끊는다', () => {
      const 숫자 = '금리는 3.5% 수준이고 한도는 최대 1억 원까지 가능합니다. 심사는 영업일 기준 3일이 걸립니다.';
      expect(breakSentences(숫자)).not.toContain('3.<br>5');
    });

    /** 한두 단어짜리 줄이 생기면 더 지저분하다 */
    test('토막이 너무 짧으면 그냥 둔다', () => {
      const 짧음 = '네. 대상입니다.';
      expect(breakSentences(짧음)).toBe(짧음);
    });

    test('빈 값에도 터지지 않는다', () => {
      expect(breakSentences('')).toBe('');
      expect(breakSentences(null as any)).toBe(null);
    });

    /** 이스케이프 뒤에 넣어야 한다 — 먼저 넣으면 &lt;br&gt; 이 글자로 보인다 */
    test('결론 박스가 실제로 줄바꿈을 담는다', () => {
      const html = buildAnswerBlock({
        keyword: '대출 갈아타기 부결',
        question: '개인사업자 대출 갈아타기 부결 이유',
        answer: 세문장,
      });
      expect(html).toContain('<br>');
      expect(html).not.toContain('&lt;br&gt;');
    });

    test('꺾쇠는 여전히 이스케이프된다 — 줄바꿈 때문에 태그가 새면 안 된다', () => {
      const html = buildAnswerBlock({
        keyword: 'x',
        question: '질문입니다 무엇인가요',
        answer: '<script>alert(1)</script> 이런 것은 글자로만 보여야 합니다. 그리고 두 번째 문장도 충분히 깁니다.',
      });
      expect(html).not.toContain('<script>');
    });
  });

  describe('박스 테두리 — 발행본 기준', () => {
    const pub = read('src/wordpress/wordpress-publisher.ts');

    /** 미리보기에는 테두리가 있는데 발행본에는 없던 것이 문제였다 */
    test('결론 박스 테두리를 배경과 구분되게', () => {
      expect(pub).toContain('border: 2px solid #0d9488 !important');
    });

    test('인용 박스는 네 변을 두른다 — 왼쪽 줄 하나로는 박스로 안 보인다', () => {
      const line = linesAfter(pub, '<blockquote${cleanAttrs', 1);
      expect(line).toContain('border: 3px solid #1a1a1a');
      expect(line).not.toContain('border-left: 4px solid #94a3b8');
    });

    /** .table-wrapper 규칙은 여러 벌이다(미디어쿼리용 포함) — 고친 그 블록을 집어야 한다 */
    test('표도 바깥을 두른다', () => {
      expect(linesAfter(pub, '/* v3.8.639: 표도 박스다', 3))
        .toContain('border: 2px solid #1a1a1a');
    });

    test('독자 박스도 같이', () => {
      expect(braceBlock(pub, '.wp-styled-content .audience-block {'))
        .toContain('border: 2px solid #1a1a1a');
    });

    /** 이 파일에는 NUL 바이트 8개가 원래 들어 있다 — 편집하다 깨뜨리면 발행이 통째로 죽는다 */
    test('파일이 상하지 않았다', () => {
      const raw = fs.readFileSync(path.join(__dirname, '..', 'src/wordpress/wordpress-publisher.ts'));
      let nul = 0;
      for (const c of raw) if (c === 0) nul++;
      expect(nul).toBe(8);
    });
  });
});
