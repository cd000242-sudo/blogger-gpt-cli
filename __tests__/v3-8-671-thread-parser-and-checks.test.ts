const fs = require('fs');
const path = require('path');

import { parseCpcReport, usableSlots, buildReportDirective } from '../src/core/keywords/cpc-report';
import { repairParticles } from '../src/core/final/auto-repair';
import { applyCasualTransform, setActiveToneStyle } from '../src/core/final/generation';
import { findFlowGaps } from '../src/core/final/narrative-flow';
import { toPlainText, auditArticle } from '../src/core/final/article-audit';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.671 — 실 설계(docs/thread-design-671.md)의 첫 릴리스.
 *  P7 기계 수리: "기준는"(668 의 조사 목록 실수) · "좋어요"(무조건 치환)
 *  P1 파서: 리포트의 "클릭 이유 · 보러 올 이유 · 실물 QnA · 고유명사" 네 블록을 읽어 설계도에 싣는다
 *  P5 흐름 검사 3종: 서론 질문 없음 · 절 점검형 닫음 · 결론 답 없음 — 알리기만(감점 0)
 */
const REPORT = [
  '# 2026-09-06 네이버 상위노출 키워드 리포트',
  '',
  '## 채택 1건',
  '',
  '### \\[1\\] 양육비 선지급 탈락 사유 \\- 10·29 소득기준 폐지 후에도 남는 요건',
  '',
  '- 등급: 통과 (3박자 전건 충족)',
  '',
  '**출처 기사**',
  '',
  '- URL: [https://www.mt.co.kr/policy/2026/09/06/2026090412572496705](https://www.mt.co.kr/policy/2026/09/06/2026090412572496705)',
  '',
  '**기사 본문에서 뽑은 고유명사**',
  '',
  '- **양육비 선지급금** (제목에 있음)',
  '- **소득기준 폐지** \\- 본문에만',
  '- **양육비이행관리원** (childsupport.or.kr) \\- 집행 기관 정식 명칭',
  '',
  '**기사가 알려주지 않은 것 \\- 이것이 클릭 이유다**',
  '',
  '기사와 정부 보도자료는 "소득기준이 폐지된다"까지만 말한다. 실제로 사람들이 막히는 지점은 그 다음이다.',
  '',
  '1. **소득기준이 없어져도 탈락하는 나머지 요건** \\- 집행권원 없으면 신청 자체가 불가',
  '2. **소급이 안 되는 구간** \\- 신청한 달 이전 미지급분 소급 불가',
  '3. **만 18세 판정 기준** \\- 학년 무관, 출생연도와 생일 기준',
  '4. **탈락·감액 통지 후 절차** \\- 이의신청과 서류 보강',
  '5. **기초생활수급자의 소득 산입 문제** \\- 선지급금이 수급 판정 소득에 잡히는지',
  '',
  '이는 장부가 오늘 회차에 지정한 방향과 정확히 일치한다: **"권장: 통지·처분을 받은 사람의 어휘."**',
  '',
  '### 3박자 채점 근거',
  '',
  '**① 잠재트래픽 \\- 통과**',
  '',
  '**③ 내 글을 보러 올 이유 \\- 통과 (4개 충족, 기준 2개)**',
  '',
  '- **대상에서 빠지는 경우** \\- 집행권원 부재, 미지급 기간 미충족, 만 18세 초과',
  '- **신청 방법이 갈리는 지점** \\- childsupport.or.kr 온라인 신청과 지자체 접수',
  '- **기한·소급 제약** \\- 신청한 달 이전 미지급분 소급 불가',
  '- **거절·반려됐을 때의 다음 절차** \\- 탈락·감액 통지 후 이의신청과 서류 보강',
  '',
  '**실물 QnA \\[확인\\]** \\- search\\_kin "양육비 선지급금 신청 탈락" total 9건, 정면 5/9',
  '',
  '- **493576559** "양육비 선지급, 이제 모든 가정에서 신청 가능할까요?" \\- "무참히 탈락당했습니다."',
  '- **491806328** "탈락·감액 통지를 받으면 사유별로 서류를 보강해 이의신청을 하되"',
  '- **492549522** "소득 기준 또는 미지급 기간 요건을 넘지 못하면 탈락할 수 있습니다"',
  '- **486726025** "기초수급자, 양육비선지급 \\- 신청하게 되면 소득에 포함되서"',
  '',
  'kin total이 9건으로 매우 적다.',
  '',
  '### 확정 제목',
  '',
  '**「양육비 선지급 탈락 사유 소득기준 폐지 후에도 남는 신청 요건과 이의신청 기한」 (42자)**',
  '',
  '**롱테일 파생 3개**',
  '',
  '1. 양육비 선지급 소급 지급 안 되는 기간 \\- 신청한 달 이전 미지급분 처리',
  '2. 양육비 선지급 만 18세 이하 자녀 기준 \\- 학년 아닌 출생연도와 생일 판정',
  '3. 기초생활수급자 양육비 선지급금 소득 산입 여부와 수급 탈락 가능성',
  '',
  '### 발행 전 확인이 필요한 수치 \\- 전건 원문 대조 필수',
  '',
  '1. **소득기준 폐지 시행일 2026년 10월 29일** \\- 법률 개정 부칙 원문으로 확인',
  '',
  '---',
  '',
  '## 오늘 탈락시킨 후보',
].join('\n');

describe('v3.8.671 실 설계 1차 — 파서 · 기계 수리 · 흐름 검사(알리기만)', () => {
  const slot = usableSlots(parseCpcReport(REPORT))[0]!;

  test('P1 파서가 네 블록을 읽는다 — 09-06 리포트 실측 5·4·4·3', () => {
    expect(slot.keyword).toBe('양육비 선지급 탈락 사유');
    expect(slot.clickReasons).toHaveLength(5);
    expect(slot.clickReasons![0]).toContain('소득기준이 없어져도 탈락하는 나머지 요건');
    expect(slot.readerReasons).toHaveLength(4);          // 굵은 줄("**실물 QnA**")에서 멈춘다 — 안 멈추면 QnA 를 먹어 8이 된다
    expect(slot.readerReasons![3]).toContain('거절·반려됐을 때의 다음 절차');
    expect(slot.realQuestions).toHaveLength(4);
    expect(slot.realQuestions![0]).not.toMatch(/^\d/);   // 지식iN 번호는 뗀다
    expect(slot.realQuestions![0]).toContain('신청 가능할까요?');
    expect(slot.properNouns).toHaveLength(3);
    // 기존 필드는 그대로
    expect(slot.longtails).toHaveLength(3);
    expect(slot.mustCheck).toHaveLength(1);
    expect(slot.title).toContain('양육비 선지급 탈락 사유');
  });

  test('P1 설계도 지시문에 독자의 의문이 실린다 — 롱테일 앞, 확인 수치 앞', () => {
    const d = buildReportDirective(slot, []);
    expect(d).toContain('이 글이 답할 독자의 의문');
    expect(d).toContain('1. 소득기준이 없어져도 탈락하는 나머지 요건');
    expect(d).toContain('독자가 내 글을 보러 올 이유');
    expect(d).toContain('검색창에 실제로 올라온 말');
    expect(d).toContain('"양육비 선지급, 이제 모든 가정에서 신청 가능할까요?');
    expect(d.indexOf('이 글이 답할 독자의 의문')).toBeLessThan(d.indexOf('발행 전 반드시 확인'));
    // 블록이 없는 옛 리포트는 지시문이 그대로다
    const bare = buildReportDirective({ ...slot, clickReasons: [], readerReasons: [], realQuestions: [] }, []);
    expect(bare).not.toContain('독자의 의문');
  });

  test('P7 "기준은·기관은·신청은·제출은" 을 건드리지 않는다 — 받침 없는 명사만 고친다', () => {
    const r = repairParticles('<p>이 단계에서도 기준은 공사 안내입니다. 기관은 하나입니다. 신청은 온라인입니다. 제출은 우편입니다. 9월 4일 발표은 큰 틀입니다.</p>');
    expect(r.count).toBe(1);
    expect(r.html).toContain('기준은 공사');
    expect(r.html).toContain('신청은 온라인');
    expect(r.html).toContain('발표는 큰 틀');
  });

  test('P7 "좋습니다" 는 "좋아요" 다 — 무조건 "어요" 치환 줄이 사라졌다', () => {
    setActiveToneStyle('friendly');
    try {
      expect(applyCasualTransform('확인하는 편이 좋습니다. 자료가 있습니다. 문제가 없습니다. 이것이 기준입니다.'))
        .toBe('확인하는 편이 좋아요. 자료가 있어요. 문제가 없어요. 이것이 기준이에요.');
    } finally {
      setActiveToneStyle('professional');
    }
    const g = read('src/core/final/generation.ts');
    expect(g).not.toContain("shouldApplyCasualTransform() ? '어요.' : '습니다.'");
    expect(g).toContain('applyCasualTransform(whole)');
  });

  const TITLE = '주택연금 가입자 사망 후 배우자 승계가 안 되는 경우 - 배우자 사전 등록과 저당권·신탁방식 차이';
  const sec = (h2: string, body: string) => `<h2>${h2}</h2><p>${body}</p>`;
  // 실제 절 길이(800~1,500자)에 맞춘다 — 결론 검사는 FAQ 앞 1,200자만 보므로 절이 짧으면 앞 절의 판단 문장이 결론으로 잡힌다
  const fill = (seed: number) => Array.from({ length: 14 }, (_, i) => `${seed}절${i + 1}호 설명문장${seed}${i + 1}은 이 절에서만 다루는 내용이에요. `).join('');
  const answerBox = '<p class="answer-first-q">승계가 되나요</p><p class="answer-first-a">지정된 배우자만 돼요.</p>';

  test('P5 라이브 1편 모양 — 서론 지시로 끝 · 절 5/5 점검형 · 결론 정리하세요 → 셋 다 알린다(감점 0)', () => {
    const intro = answerBox
      + '<p>주택연금 가입자가 사망한 뒤 남은 배우자가 연금을 계속 받을 수 있다고 생각했는데, 막상 승계가 안 된다는 말을 들으면 걱정되기 마련이에요.</p>'
      + '<p>이 글은 배우자 지정 여부, 6개월 안의 채무인수, 소유권이전등기를 나눠 정리해요. 먼저 가입 방식과 배우자 등록 내용을 확인하는 것이 출발점이에요.</p>';
    const html = '<h1>' + TITLE + '</h1>' + intro
      + sec('1. 배우자 승계가 막히는 핵심 조건', fill(1) + '따라서 배우자 지정, 혼인관계, 6개월 절차, 거주요건을 한 번에 점검하는 것이 안전해요.')
      + sec('2. 배우자 사전 등록 확인 절차', fill(2) + '저당권방식에서는 배우자 지위, 거주 상태, 채무인수, 등기 완료를 함께 점검해야 해요.')
      + sec('3. 저당권 방식의 승계 구조', fill(3) + '따라서 가입 방식과 배우자 지정 내용을 먼저 확인한 뒤 알맞은 절차를 진행해야 해요.')
      + sec('4. 신탁방식 상속과 승계 차이', fill(4) + '이후에는 가입 방식, 배우자 지정 내용, 등기 진행 여부를 순서대로 정리하면 판단의 혼선을 줄일 수 있어요.')
      + '<h2>자주 묻는 질문 (FAQ)</h2><p>Q. 되나요? A. 돼요.</p>';
    const r = findFlowGaps(html, toPlainText, { title: TITLE });
    const kinds = r.issues.map((i) => i.kind);
    expect(kinds).toContain('intro-question-missing');
    expect(kinds).toContain('section-closer-checklist');
    expect(kinds).toContain('conclusion-not-answering');
    // v3.8.673: 26편 보정 뒤 감점을 켰다 — 서론 6, 절 닫음은 절마다 2, 결론은 낱말 대조라 아직 0
    expect(r.issues.find((i) => i.kind === 'intro-question-missing')!.penalty).toBe(6);
    const closers = r.issues.filter((i) => i.kind === 'section-closer-checklist');
    expect(closers).toHaveLength(4);
    for (const c of closers) { expect(c.penalty).toBe(2); expect(c.title).toMatch(/\(4\/4절\)/); }
    expect(closers[0]!.evidence.split('\n')[0]).toContain('한 번에 점검하는 것이 안전해요');   // 자가 수정이 이 문장으로 절을 찾는다
    expect(r.issues.find((i) => i.kind === 'conclusion-not-answering')!.penalty).toBe(0);
    // 하네스에 실려 있고, 서론을 질문으로 고치면 그만큼(6) 점수가 오른다 (v3.8.673)
    const a = auditArticle(html, [], { title: TITLE });
    expect(a.issues.map((i) => i.kind)).toContain('intro-question-missing');
    expect(auditArticle(html.replace('먼저 가입 방식과 배우자 등록 내용을 확인하는 것이 출발점이에요.', '그렇다면 배우자는 언제 승계를 잃고, 무엇을 먼저 해야 할까요?'), [], { title: TITLE }).score)
      .toBe(a.score + 6);
  });

  test('P5 붙잡은 글 — 서론이 질문으로 끝나고, 절이 필자의 반응으로 닫히고, 결론이 답하면 셋 다 안 잡는다', () => {
    const intro = answerBox
      + '<p>주택연금 가입자가 사망한 뒤 남은 배우자가 연금을 계속 받을 수 있다고 생각했는데, 막상 승계가 안 된다는 말을 들으면 걱정되기 마련이에요.</p>'
      + '<p>그렇다면 배우자는 어떤 경우에 승계를 잃고, 무엇을 먼저 해야 할까요?</p>';
    const html = '<h1>' + TITLE + '</h1>' + intro
      + sec('1. 배우자 승계가 막히는 핵심 조건', fill(1) + '가입 당시 지정되지 않은 배우자라면 승계는 안 돼요. 계약이 그렇게 돼 있기 때문이에요.')
      + sec('2. 배우자 사전 등록 확인 절차', fill(2) + '재혼 배우자라면 6개월 안에 채무인수를 먼저 내세요. 기한을 넘기면 계약이 종료되니까요.')
      + sec('3. 저당권 방식의 승계 구조', fill(3) + '상속인 협의가 늦어질 것 같다면 등기보다 채무인수 신청을 먼저 하세요. 등기는 뒤에 해도 되기 때문이에요.')
      + sec('4. 신탁방식 상속과 승계 차이', fill(4) + '정리하면 배우자 승계는 가입 당시 지정된 배우자라면 되고, 지정이 없었다면 안 돼요. 신탁방식이라면 등기 없이도 승계가 돼요.')
      + '<h2>자주 묻는 질문 (FAQ)</h2><p>Q. 되나요? A. 돼요.</p>';
    const kinds = findFlowGaps(html, toPlainText, { title: TITLE }).issues.map((i) => i.kind);
    expect(kinds).not.toContain('intro-question-missing');
    expect(kinds).not.toContain('section-closer-checklist');
    expect(kinds).not.toContain('conclusion-not-answering');
  });

  test('P5 — 673 에서 보정 뒤 서론·절 닫음은 자가 수정 대상, 결론 검사는 낱말 대조라 아직 알리기만', () => {
    const p = read('src/core/final/pre-publish-fix.ts');
    for (const k of ['intro-question-missing', 'section-closer-checklist']) expect(p).toContain(`'${k}',`);
    expect(p).not.toContain("'conclusion-not-answering',");
    expect(fs.existsSync(path.join(__dirname, '..', 'scripts', 'flow-calibrate.js'))).toBe(true);
  });
});
