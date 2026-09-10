const fs = require('fs');
const path = require('path');

import { joinMidSentenceBreaks, tidyTableCells } from '../src/core/final/br-joiner';
import { diagnosePost } from '../src/core/final/post-critique';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.714 — 사장님이 발행글을 읽고: "말투가 좀 어색한게아직있는데"
 *
 * 실측(경기도 산후조리비 글, leadernam.com):
 *   · `<br>` 53개 중 **18개가 문장 한가운데** — "…기간이며,<br>사업 종료일을…"
 *   · 표 셀 19칸 중 **6칸이 서술형** — "경기민원24입니다."
 *   · "~해서는 안 됩니다" **4번** (독자를 가르치는 말투)
 *   · "나누어 살펴봅니다" 같이 글이 자기 구조를 설명하는 문장
 *
 * 그런데 비평은 이 넷을 하나도 짚지 않고 "출처 0회 · 반복 구절 · 답 상자"만 말했다.
 * 사람이 30초면 보는 것을 기계도 보게 한다 — 세는 일은 코드가 확실하고 공짜다.
 */
describe('v3.8.714 읽는 맛을 깎는 결함', () => {
  describe('문장 중간 줄바꿈을 붙인다', () => {
    test('쉼표·연결어미 뒤 줄바꿈은 조각이다 — 붙인다', () => {
      const out = joinMidSentenceBreaks('<p>신청 가능 기간이며,<br>사업 종료일을 넘길 수는 없습니다.</p>');
      expect(out.joined).toBe(1);
      expect(out.html).toContain('기간이며, 사업 종료일을');
      expect(out.html).not.toContain('<br>');
    });

    test('문장이 끝난 자리의 줄바꿈은 그대로 둔다 — 멀쩡한 것을 지우는 쪽이 더 나쁘다', () => {
      const html = '<p>첫 문장입니다.<br>둘째 문장입니다.</p>';
      expect(joinMidSentenceBreaks(html).joined).toBe(0);
      expect(joinMidSentenceBreaks(html).html).toBe(html);
    });

    test('표 안 줄바꿈은 건드리지 않는다 — 거기서는 줄바꿈이 서식이다', () => {
      const html = '<table><tr><td>가나다,<br>라마바</td></tr></table>';
      expect(joinMidSentenceBreaks(html).html).toBe(html);
    });

    test('실제 발행글에서 18곳을 잡는다', () => {
      const article = read('__tests__/fixtures/v3-8-714-article.html');
      expect(joinMidSentenceBreaks(article).joined).toBeGreaterThanOrEqual(10);
    });
  });

  describe('표 셀은 명사구로', () => {
    test('「명사 + 입니다」만 손댄다', () => {
      const out = tidyTableCells('<td>경기민원24입니다.</td>');
      expect(out.tidied).toBe(1);
      expect(out.html).toBe('<td>경기민원24</td>');
    });

    /** 한국어 어미를 기계로 자르면 뜻이 깨진다("정합니다"→"정") — 나머지는 비평이 잡아 사람이 고친다 */
    test('~합니다 로 끝나는 셀은 기계로 자르지 않는다', () => {
      const html = '<td>본인이 신청합니다.</td>';
      expect(tidyTableCells(html).html).toBe(html);
    });
  });

  describe('비평이 그 넷을 짚는다', () => {
    const article = read('__tests__/fixtures/v3-8-714-article.html');
    const issues = diagnosePost({ title: '경기도 산후조리비 지원 종료', html: article, competitors: [] });
    const ids = issues.map((i) => i.id);

    test('문장 중간 줄바꿈을 지적한다', () => {
      expect(ids).toContain('style-mid-sentence-break');
      const found = issues.find((i) => i.id === 'style-mid-sentence-break')!;
      expect(found.evidence).toContain('⏎');           // 어디서 끊겼는지 보여준다
      expect(found.fix).toContain('한 문장은 한 줄로');
    });

    test('표 서술형·훈계조·메타 문장을 지적한다', () => {
      expect(ids).toContain('style-table-sentence');
      expect(ids).toContain('style-scolding');
      expect(ids).toContain('style-meta-sentence');
    });

    test('지적마다 원문을 인용한다 — 어디를 고칠지 모르면 못 고친다', () => {
      for (const id of ['style-mid-sentence-break', 'style-table-sentence', 'style-scolding']) {
        const found = issues.find((i) => i.id === id)!;
        expect(String(found.evidence || '').length).toBeGreaterThan(5);
      }
    });
  });

  /*
   * 사장님: "수정하고 또 비평하면 또 지적이 나오면 수정발행하는 의미가없자나"
   * 모델이 고쳐 오면서 같은 줄바꿈을 다시 넣기 쉬우므로, 수정 구간에도 같은 손질을 건다.
   */
  describe('수정발행 경로에도 같은 정리가 걸린다', () => {
    test('개선 결과를 받는 자리에서 붙이고 다듬는다', () => {
      const src = read('src/core/final/post-critique.ts');
      expect(src).toContain("require('./br-joiner')");
      expect(src).toContain('tidyTableCells(joinMidSentenceBreaks(stripped).html)');
    });

    test('생성 경로에도 걸려 있다', () => {
      expect(read('src/core/final/orchestration.ts')).toContain('joinMidSentenceBreaks');
    });

    test('새 영역이 화면 라벨에 등록돼 있다 — 없으면 빈 칸으로 뜬다', () => {
      expect(read('electron/ui/modules/post-critique-modal.js')).toContain("style: '문장·표기'");
    });
  });
});
