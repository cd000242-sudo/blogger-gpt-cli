const fs = require('fs');
const path = require('path');

import { removeEchoedSentences } from '../src/core/final/auto-repair';
import { auditArticle } from '../src/core/final/article-audit';
import { blockBetween } from './helpers/source-block';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.648 — 앞에서 한 말을 뒤에서 또 하면 그 문장을 지운다.
 *
 * 실측 2026-09-05 (10편 생성): 점수를 가르는 건 사실상 중복 하나였다.
 *   지적 41건 중 cross-section-echo 41 · 84점 글만 중복 0 · 나머지는 전부 상한 5
 *
 * AI 자가 수정이 이 종류를 맡고 있었지만 **호출 상한이 2구간**이라
 * (사장님 요구: 비용 고정) 5~6건 중 대부분이 남았다.
 * 중복 제거는 판단이 아니라 삭제다 — 기계로 하면 비용 0, 편차 0.
 *
 * 적용 결과(저장된 10편): 중복 34 → 18, 점수 중간값 51 → 74, 분량 -1.5%
 */
describe('v3.8.648 겹치는 문장 걷어내기', () => {
  /** 실제 글이 쓰는 모양 — 한 문단 안에서 <br> 로 문장을 잇는다 */
  const 실제모양 = [
    '<h2>1. 신청 안내</h2>',
    '<p class="article-p">영암군은 하반기 농촌기본수당을 안내했습니다.<br>',
    '신청 기간은 9월 7일부터 10월 30일까지입니다.</p>',
    '<h2>2. 접수 방법</h2>',
    '<p class="article-p">읍면 행정복지센터에서 접수합니다.<br>',
    '하반기 신청 기간은 9월 7일부터 10월 30일까지입니다.</p>',
  ].join('\n');

  describe('<br> 로 이어진 문장을 본다', () => {
    /**
     * 이게 핵심이었다. 태그만 지우면 "…입니다.신청 기간은…" 이 되어
     * **마침표 뒤 공백** 규칙에 안 걸리고 문단 전체가 한 문장으로 읽힌다.
     * 그래서 중복을 하나도 못 잡았다 (34 → 30 에서 멈췄다).
     */
    test('뒤 구간의 겹치는 문장을 지운다', () => {
      const r = removeEchoedSentences(실제모양);
      expect(r.count).toBeGreaterThan(0);
      expect(r.html.match(/9월 7일부터 10월 30일까지/g)).toHaveLength(1);
    });

    test('앞 구간의 원본은 남는다 — 사실이 사라지면 안 된다', () => {
      const r = removeEchoedSentences(실제모양);
      expect(r.html).toContain('영암군은 하반기 농촌기본수당을 안내했습니다');
      expect(r.html).toContain('읍면 행정복지센터에서 접수합니다');
    });

    test('하네스 지적이 실제로 줄어든다', () => {
      const before = auditArticle(실제모양).issues.filter((i) => i.kind === 'cross-section-echo').length;
      const after = auditArticle(removeEchoedSentences(실제모양).html)
        .issues.filter((i) => i.kind === 'cross-section-echo').length;
      expect(after).toBeLessThan(before);
    });

    test('<br> 구조를 망가뜨리지 않는다', () => {
      const r = removeEchoedSentences(실제모양);
      expect(r.html).toMatch(/<p class="article-p">/);
    });
  });

  describe('지나치게 지우지 않는다', () => {
    /** 근거 장부 사고 — 잘 쓴 문장이 지워져 글이 얕아진 일을 되풀이하지 않는다 */
    test('겹치지 않는 글은 한 글자도 안 건드린다', () => {
      const 멀쩡 = '<p>신청 기간은 9월 7일부터입니다.</p><p>접수는 읍면 행정복지센터에서 받습니다.</p>';
      const r = removeEchoedSentences(멀쩡);
      expect(r.count).toBe(0);
      expect(r.html).toBe(멀쩡);
    });

    test('링크·목록이 든 문단은 건드리지 않는다', () => {
      const 링크 = 실제모양.replace(
        '<p class="article-p">읍면 행정복지센터에서 접수합니다.<br>',
        '<p class="article-p"><a href="https://x">읍면 행정복지센터</a>에서 접수합니다.<br>',
      );
      expect(removeEchoedSentences(링크).html).toContain('<a href="https://x">');
    });

    test('짧은 문장은 재지 않는다 — 우연히 겹친다', () => {
      const 짧음 = '<p>네, 맞습니다.</p><p>네, 맞습니다.</p>';
      expect(removeEchoedSentences(짧음).count).toBe(0);
    });

    test('빈 입력에도 터지지 않는다', () => {
      expect(removeEchoedSentences('').count).toBe(0);
      expect(removeEchoedSentences(null as any).html).toBe('');
    });
  });

  describe('발행 경로에 배선돼 있다', () => {
    const orch = read('src/core/final/orchestration.ts');

    test('자동 수정 뒤, AI 자가 수정 앞에서 돈다', () => {
      const at = orch.indexOf('removeEchoedSentences');
      expect(at).toBeGreaterThan(orch.indexOf('autoRepairBeforePublish(html)'));
      expect(at).toBeLessThan(orch.indexOf('fixBeforePublish'));
    });

    /** 조용히 지우면 나중에 "내용이 왜 줄었지" 를 알 수 없다 */
    test('몇 개를 지웠는지 알린다', () => {
      const block = blockBetween(orch, 'const { removeEchoedSentences }', 'catch (echoError');
      expect(block).toContain('앞과 겹치는 문장');
    });

    /** 실패해도 발행은 나가야 한다 */
    test('실패가 발행을 막지 않는다', () => {
      const block = blockBetween(orch, 'const { removeEchoedSentences }', '/**');
      expect(block).toContain('catch');
    });
  });
});
