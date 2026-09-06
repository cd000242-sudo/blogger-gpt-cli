const fs = require('fs');
const path = require('path');

import { isVerdictSentence, isVerdictAnswer, buildVerdictAnswer, ensureVerdictAnswer } from '../src/core/final/answer-verdict';
import { findHedgedAnswerBox, auditArticle } from '../src/core/final/article-audit';
import { buildThread, similarAsk, buildThreadBlock } from '../src/core/final/thread';
import { pickSections } from '../src/core/final/pre-publish-fix';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.678 — 사장님: "제목을 보고 온 거라면 시원하게 긁어주는 확실한 답변이 있어야."
 *  · 답 상자가 "…봐요·확인해요·중요해요" 볼 것 목록이었다(라이브 세 편 전부) → 판정문 강제, 아니면 절의 판단 문장으로 조립
 *  · 절마다 배정한 의문이 뜻이 겹쳐 두 절이 같은 말을 했다(-24) → 낱말 겹침으로 거른다
 *  · 되풀이가 둘 이상이면 자가 수정이 구간 둘까지 고친다
 */
describe('v3.8.678 확실한 답 — 답 상자 판정문 · 의문 겹침 · 되풀이 두 구간', () => {
  test('판정문 판별 — 라이브 세 편의 답은 전부 아니고, 절의 판단 문장은 맞다', () => {
    expect(isVerdictAnswer('대상 자녀는 18세 이하예요. 신청월 직전 3개월 평균 수령액이 자녀 1명당 월 20만원보다 적은지 봐요. 양육비이행관리원 이행확보 절차도 함께 확인해요.')).toBe(false);
    expect(isVerdictAnswer('소득 기준이 없어져도 집행권원과 양육비 미지급 상태가 필요해요. 2026년 10월 29일 이후 소득 때문에만 막혔다면 다시 신청을 검토할 수 있어요.')).toBe(false);
    expect(isVerdictAnswer('소득기준이 없어져도 집행권원 미지급 기록 자녀 연령 등 요건을 따로 봐요. 직전 3개월 또는 연속 3회 이상 미지급과 이행확보 절차 기록이 중요해요.')).toBe(false);
    expect(isVerdictAnswer('집행권원이 없으면 소득기준이 없어져도 탈락이에요. 있으면 직전 3개월 미지급 기록만 있으면 돼요. 이의신청은 통지서에 적힌 기한 안이에요.')).toBe(true);
    expect(isVerdictSentence('집행권원 없이 신청한 경우라면 이의신청부터 하지 말고 판결문이나 조정문을 먼저 마련하는 쪽이 맞아요.')).toBe(true);
    expect(isVerdictSentence('가입 당시 지정되지 않은 배우자라면 승계는 안 돼요.')).toBe(true);
    expect(isVerdictSentence('통지서의 사유를 먼저 확인하세요.')).toBe(false);
    expect(isVerdictSentence('이 기준을 못 채운 분은 미지급 기록을 더 쌓아야 하기 때문이에요.')).toBe(false);   // 이유 문장은 판정이 아니다
  });

  test('절의 판단 문장으로 답을 조립한다 — 조건 있는 것부터, 이유 문장은 빼고, 셋까지', () => {
    const sections = [
      { h2: '1', takeaway: '소득 때문에만 망설였던 분이라면 소득 자료보다 판결문부터 챙기는 편이 맞아요. 양육비이행관리원은 미지급과 이행확보 절차를 함께 보기 때문이에요.' },
      { h2: '2', takeaway: '이 기준을 못 채운 분은 접수보다 미지급 기록을 더 쌓아야 하기 때문이에요.' },
      { h2: '3', takeaway: '신청하려는 달보다 앞선 미지급분을 메우려는 경우라면 기다리지 말고 지금 신청하는 쪽이 맞아요. 소급 지급되지 않기 때문이에요.' },
      { h2: '4', takeaway: '기초생활수급 중인 분이라면 선지급 결정문을 받는 즉시 수급 창구에 내는 쪽이 맞아요.' },
      { h2: '5', takeaway: '판결문이 있고 3개월 미지급 기록도 있는 분이라면 자가진단부터 시작하는 쪽이 맞아요.' },
    ];
    const a = buildVerdictAnswer(sections);
    expect(a.split(/(?<=[.!?])\s+/)).toHaveLength(3);
    expect(a).toContain('판결문부터 챙기는 편이 맞아요');
    expect(a).not.toContain('때문이에요');
    expect(a).toContain('수급 창구');        // 2절은 이유 문장뿐이라 건너뛰고 1·3·4절이 들어간다
    expect(a).not.toContain('자가진단');     // 넷째 판정문은 상한 밖
    expect(isVerdictAnswer(a)).toBe(true);
    expect(buildVerdictAnswer([{ takeaway: '통지서를 확인하세요.' }, { takeaway: '' }])).toBe('');
    const r = ensureVerdictAnswer('요건을 따로 봐요. 기록이 중요해요.', sections);
    expect(r.rebuilt).toBe(true);
    expect(r.answer).toBe(a);
    expect(ensureVerdictAnswer('집행권원이 없으면 탈락이에요. 있으면 3개월 기록만 있으면 돼요.', sections).rebuilt).toBe(false);
    expect(ensureVerdictAnswer('요건을 따로 봐요.', [{ takeaway: '' }]).reason).toContain('원래 답 유지');
  });

  test('감사 — 답 상자가 볼 것 목록이면 잡는다(-4), 판정문이면 안 잡는다', () => {
    expect(findHedgedAnswerBox('대상 자녀는 18세 이하예요. 월 20만원보다 적은지 봐요. 절차도 함께 확인해요.')).toHaveLength(1);
    expect(findHedgedAnswerBox('집행권원이 없으면 탈락이에요. 있으면 3개월 기록만 있으면 돼요.')).toHaveLength(0);
    expect(findHedgedAnswerBox('')).toHaveLength(0);
    const html = '<h1>t</h1><p class="answer-first-q">q</p><p class="answer-first-a">대상 자녀는 18세 이하예요. 월 20만원보다 적은지 봐요. 절차도 함께 확인해요.</p><h2>1. 절</h2><p>' + '설명이에요. '.repeat(30) + '</p>';
    expect(auditArticle(html, [], { title: 't' }).issues.map((i) => i.kind)).toContain('answer-box-hedged');
  });

  test('배선 — orchestration 이 답을 조립하고, 요약 프롬프트가 판정문을 요구한다', () => {
    const o = read('src/core/final/orchestration.ts');
    expect(o).toContain("require('./answer-verdict')");
    expect(o).toContain('answer: verdictAnswer,');
    expect(o.indexOf('ensureVerdictAnswer(verdictAnswer')).toBeLessThan(o.indexOf('const answerBlockHtml = buildAnswerBlock({'));
    const g = read('src/core/final/generation.ts');
    expect(g).toContain('**판정문으로 쓴다** (v3.8.678)');
    expect(read('src/core/final/post-critique.ts')).toContain("'answer-box-hedged': {");
  });

  test('뜻이 겹치는 의문은 한 절에만 — 라이브 실측 두 재료', () => {
    const ignore = new Set(['양육비', '선지급', '탈락', '사유']);
    expect(similarAsk('대상에서 빠지는 경우 - 집행권원 부재, 미지급 기간 미충족, 만 18세 초과', '소득기준이 없어져도 탈락하는 나머지 요건 - 집행권원 없으면 신청 자체가 불가, 미지급 기간 요건, 만 18세 이하 자녀 연령 판정', ignore)).toBe(true);
    expect(similarAsk('신청 방법이 갈리는 지점 - 온라인 신청과 지자체 접수', '기한·소급 제약 - 신청한 달 이전 미지급분 소급 불가')).toBe(false);
    // 앞머리가 흔하지 않은 낱말("소급")을 나눠 가지면 같은 의문 — 오늘 리포트 실측
    expect(similarAsk('기한·소급 제약 - 신청한 달 이전 미지급분 소급 불가', '소급이 안 되는 구간 - 춘천시 배포 「양육비 선지급 QA」 원문: "7월에 신청하였다면 6월까지 미지급된 양육비를 소급하여 지급하지 않음"', ignore)).toBe(true);
    // 흔한 낱말("신청")만 겹치면 다른 의문
    expect(similarAsk('신청 방법이 갈리는 지점 - 온라인과 지자체', '신청 기한 - 언제까지 내야 하나', ignore)).toBe(false);
    const slot = {
      keyword: '양육비 선지급 탈락 사유', title: '', longtails: ['양육비 선지급 소급 지급 안 되는 기간 - 신청한 달 이전 미지급분 처리'],
      readerReasons: ['대상에서 빠지는 경우 - 집행권원 부재, 미지급 기간 미충족, 만 18세 초과', '신청 방법이 갈리는 지점 - 온라인 신청과 지자체 접수', '기한·소급 제약 - 신청한 달 이전 미지급분 소급 불가', '거절·반려됐을 때의 다음 절차 - 이의신청과 서류 보강'],
      clickReasons: ['소득기준이 없어져도 탈락하는 나머지 요건 - 집행권원 없으면 신청 자체가 불가, 미지급 기간 요건, 만 18세 이하 자녀 연령 판정', '탈락·감액 통지 후 절차 - 이의신청과 서류 보강', '기초생활수급자의 소득 산입 문제 - 선지급금이 수급 판정 소득에 잡히는지'],
    };
    const t = buildThread({ title: '', keyword: slot.keyword, slot, h2Titles: ['1', '2', '3', '4', '5', '자주 묻는 질문 (FAQ)'] });
    const asks = t.asks.filter(Boolean);
    expect(asks.some((a) => a.startsWith('소득기준이 없어져도 탈락하는'))).toBe(false);   // 1번 재료와 겹쳐 걸러짐
    expect(asks.some((a) => a.startsWith('탈락·감액 통지 후'))).toBe(false);              // 4번 재료와 겹쳐 걸러짐
    expect(asks.some((a) => a.startsWith('기초생활수급자'))).toBe(true);
    expect(asks.some((a) => a.startsWith('양육비 선지급 소급'))).toBe(false);             // 3번 재료와 겹쳐 걸러짐
    expect(buildThreadBlock(t, { h2Titles: ['1', '2'] })).toContain('한 곳**에서만 풀고');
  });

  test('되풀이가 둘 이상이면 자가 수정이 구간 둘까지', () => {
    const f = (kind: string, sectionIndex: number) => ({ kind, title: '', evidence: '', sectionIndex });
    expect(pickSections([f('cross-section-echo', 2), f('cross-section-echo', 4), f('no-stance', 1)], 6)).toHaveLength(2);
    expect(pickSections([f('cross-section-echo', 2), f('no-stance', 1), f('no-stance', 3)], 6)).toHaveLength(1);
  });
});
