const fs = require('fs');
const path = require('path');

import { restoreSentencePeriods, breakSentences, buildAnswerBlock } from '../src/core/final/answer-block';
import { blockBetween } from './helpers/source-block';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.653 — 10편을 실제로 읽고 나온 둘.
 *
 * 사장님: "그두가지는 수정하는게맞겠어"
 *
 * ① 결론 박스에 마침표가 없다 (10편 중 4편)
 *   "…경유차를 대상으로 제시했습니다 국가유공자 중증 장애인 … 면제 대상입니다 …"
 *   요약을 JSON 으로 받는데 프롬프트가 문장부호를 요구하지 않아 모델이 이어 붙인다.
 *   더 나쁜 건 v3.8.639 의 문단정리가 문장 끝을 못 찾아 **무력화**된다는 것.
 *
 * ② 리포트가 정한 확정 제목이 버려진다 (10편 전부)
 *   orchestration 의 제목 분기가 「키워드 그대로」 와 「AI 생성」 둘뿐이었다.
 *   화면은 titleMode:'custom' + title 을 보내는데 **읽는 쪽이 없었다.**
 */
describe('v3.8.653 마침표 복구 · 확정 제목', () => {
  const 실제 =
    '이천시 2026년 2기분 안내는 1월 1일부터 6월 30일까지 소유한 2012년 9월 이전 출고 경유차를 대상으로 제시했습니다 '
    + '국가유공자 중증 장애인 기초생활수급자 보유 자동차 1대와 유로5 유로6 경유차는 면제 대상입니다 '
    + '저감장치 부착 차량은 3년간 면제입니다';

  describe('① 빠진 마침표를 되살린다', () => {
    test('실제로 나갔던 그 문장을 세 문장으로 되돌린다', () => {
      const out = restoreSentencePeriods(실제);
      expect(out).toContain('제시했습니다. 국가유공자');
      expect(out).toContain('면제 대상입니다. 저감장치');
    });

    test('이미 부호가 있으면 두 번 찍지 않는다', () => {
      const 정상 = '대상은 경유차입니다. 면제는 3년입니다.';
      expect(restoreSentencePeriods(정상)).toBe(정상);
    });

    /** 어미 뒤에 한글이 안 오면 문장이 끝난 게 아닐 수 있다 — 안 건드린다 */
    test('어미 뒤가 숫자·괄호·끝이면 손대지 않는다', () => {
      expect(restoreSentencePeriods('면제입니다 (3년)')).toBe('면제입니다 (3년)');
      expect(restoreSentencePeriods('면제입니다')).toBe('면제입니다');
    });

    test('해요체도 되살린다', () => {
      expect(restoreSentencePeriods('신청은 온라인이에요 방문도 돼요 기간은 9월까지예요'))
        .toBe('신청은 온라인이에요. 방문도 돼요. 기간은 9월까지예요');
    });

    /** 이게 핵심 — 마침표가 돌아와야 v3.8.639 문단정리가 다시 작동한다 */
    test('되살린 뒤에는 문단정리가 문장마다 줄을 바꾼다', () => {
      expect(breakSentences(restoreSentencePeriods(실제)).match(/<br>/g)).toHaveLength(2);
      // 되살리기 전에는 한 덩어리였다
      expect(breakSentences(실제)).not.toContain('<br>');
    });

    test('결론 박스가 실제로 세 줄로 나간다', () => {
      const html = buildAnswerBlock({ keyword: '환경개선부담금 면제', question: '면제 대상과 확인 방법', answer: 실제 });
      const box = (html.match(/answer-first-a[^>]*>([\s\S]*?)<\/p>/) || [])[1] || '';
      expect(box.split('<br>')).toHaveLength(3);
    });
  });

  describe('② 정해 둔 제목을 그대로 쓴다', () => {
    const orch = read('src/core/final/orchestration.ts');
    const posting = read('electron/ui/modules/posting.js');

    test('orchestration 에 custom 분기가 있다 — 키워드·AI 보다 먼저', () => {
      const block = blockBetween(orch, 'let h1: string;', 'AI 자동 생성');
      expect(block).toContain("payload.titleMode === 'custom'");
      expect(block.indexOf("titleMode === 'custom'")).toBeLessThan(block.indexOf('payload.useKeywordAsTitle'));
    });

    /** 만들어 놓고 넘겨주는 쪽이 없으면 죽은 코드다 — 이 저장소의 단골 사고 */
    test('화면이 title 과 titleMode 를 실어 보낸다', () => {
      expect(posting).toContain('title: titleValue,');
      expect(posting).toContain('titleMode: titleModeValue,');
    });

    // v3.8.711: 고CPC 카드 삭제로 useCpcSlot 이 없어졌다 — 「리포트 슬롯 → custom 제목」 검사는
    // 카드를 되살릴 때 함께 되살린다. custom 분기 자체(orchestration·posting)는 위·아래 테스트가 지킨다.

    test('제목이 비면 custom 이라도 예전 길로 간다 — 빈 제목을 내보내지 않는다', () => {
      const block = blockBetween(orch, 'const fixedTitle', 'AI 자동 생성');
      expect(block).toContain("payload.titleMode === 'custom' && fixedTitle");
    });
  });
});
