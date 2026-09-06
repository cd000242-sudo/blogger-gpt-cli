const fs = require('fs');
const path = require('path');

import { buildAnswerBlock } from '../src/core/final/answer-block';
import { usableSlots } from '../src/core/keywords/cpc-report';
import { repairParticles, autoRepairBeforePublish } from '../src/core/final/auto-repair';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.668 — 새 키워드 5편(92 · 82 · 94 · 82 · 96)을 읽고. 마지막 유료 회차.
 *  ① 답변 상자의 답이 마침표 없는 해라체 덩어리로 왔다
 *  ② 키워드 앞 꼬리표 "[업데이트]" 가 FAQ 질문에 박혔다
 *  ③ "발표은" 조사 오류(두 편)
 */
describe('v3.8.668 덩어리 답 · 키워드 꼬리표 · 조사 오류', () => {
  test('① 문장 표시가 없는 답은 상자를 만들지 않고, 정상 답은 만든다', () => {
    const blob = '음식점 개인사업자가 새 영업신고와 사업자등록을 함께 시작하면 영업 소재지 관할 시 군 구청에 두 신청서를 함께 낸다 법인과 유흥주점업은 구청 원스톱 대상이 아니며 영업신고 대상이 아닌 업종은 사업자등록 경로를 따로 따른다';
    expect(buildAnswerBlock({ keyword: '영업신고와 사업자등록을 한 번에', question: '어디서 하나', answer: blob, basis: '' })).toBe('');
    const good = '음식점 개인사업자는 관할 시 군 구청에 두 신청서를 함께 냅니다. 법인과 유흥주점업은 구청 원스톱 대상이 아닙니다.';
    expect(buildAnswerBlock({ keyword: '영업신고와 사업자등록을 한 번에', question: '어디서 하나', answer: good, basis: '' })).toContain('answer-first-a');
    // 마침표 없이 합니다체로만 끝나도 문장이다 (restoreSentencePeriods 가 마침표를 되살린다)
    const polite = '음식점 개인사업자는 관할 시 군 구청에 두 신청서를 함께 냅니다 법인과 유흥주점업은 구청 원스톱 대상이 아닙니다';
    expect(buildAnswerBlock({ keyword: 'k', question: 'q', answer: polite, basis: '' })).toContain('냅니다.<br>');
    // v3.8.670: 말투 설정을 따르되, 마침표 규칙은 그대로
    expect(read('src/core/final/generation.ts')).toContain('로 쓰고 문장마다 마침표를 찍는다. 본문과 같은 말투다');
  });

  test('② 키워드 앞 꼬리표를 뗀다', () => {
    const report = {
      date: '2026-09-06',
      urls: [],
      slots: [
        { slot: 'A', label: '', keyword: '[업데이트] 2025년 진료분 본인부담상한액 초과금', title: '안내문이 안 왔다면', grade: '', longtails: [], mustCheck: [], track: '', empty: false },
        { slot: 'B', label: '', keyword: '주택연금 가입자가 사망했는데', title: '', grade: '', longtails: [], mustCheck: [], track: '', empty: false },
        { slot: 'C', label: '', keyword: '[속보]', title: '제목만', grade: '', longtails: [], mustCheck: [], track: '', empty: false },
      ],
    } as any;
    const slots = usableSlots(report);
    expect(slots[0]!.keyword).toBe('2025년 진료분 본인부담상한액 초과금');
    expect(slots[1]!.keyword).toBe('주택연금 가입자가 사망했는데');
    expect(slots[2]!.keyword).toBe('[속보]');   // 꼬리표뿐이면 원래 값을 둔다 — 빈 키워드를 만들지 않는다
  });

  test('③ 받침 없는 명사 뒤의 "은" 을 고친다 — 좁게', () => {
    const r = repairParticles('<p>국세청 2026년 9월 4일 발표은 음식점업을 설명했습니다. 금융위원회 9월 1일 발표은 큰 틀을 보여줍니다. 지침은 법률이 아닙니다.</p>');
    expect(r.count).toBe(2);
    expect(r.html).toContain('발표는 음식점업');
    expect(r.html).toContain('발표는 큰 틀');
    expect(r.html).toContain('지침은 법률');
    expect(repairParticles('<p>발표은행이 아니라</p>').count).toBe(0);
    const all = autoRepairBeforePublish('<h1>t</h1><p>' + '금융위원회 9월 1일 발표은 큰 틀을 보여줍니다. '.repeat(15) + '</p>');
    expect(all.repairs.map((x) => x.kind)).toContain('particle');
  });
});
