const fs = require('fs');
const path = require('path');

import { DEFERRAL, FIRST_PERSON_STANCE, findFlowGaps, NARRATIVE_FLOW_RULES } from '../src/core/final/narrative-flow';
import { measureStances } from '../src/core/final/depth-voice';
import { toPlainText, auditArticle, findInlineFaq } from '../src/core/final/article-audit';
import { getToneInstruction } from '../src/core/content-modes/base-prompt-builder';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.670 — 사장님이 앱에서 직접 발행한 글(환경개선부담금, 말투 "친근한")을 비평과 대조하고.
 *  · 검사기가 해요체를 못 셌다: "대조하세요·대조해요·문의하는 것이 우선이에요" 40번인데 회피 0, "맞다고 봐요" 는 판단 0
 *  · 제목이 약속한 "자동 적용 여부" 절이 답 대신 확인만 시켰는데 소제목 검사는 통과했다 → promise-deferred
 *  · "고지서와 등록원부 대조", "차량번호와 부과 기간" 이 절마다 나왔는데 되풀이 검사(문장 유사도)는 못 봤다 → procedure-repeat
 *  · 답변 상자·요약·강조 문장·다시 쓴 구간이 말투 설정을 안 받아 한 글에 두 말투가 섞였다
 *  · 테스트 스크립트가 애드센스·전문적으로만 돌아 사장님 설정(모드·말투)을 한 편도 안 읽었다 → --mode --tone
 */
describe('v3.8.670 사장님 설정으로 읽기', () => {
  test('회피와 판단을 해요체로도 센다', () => {
    const text = '고지서와 자동차등록원부를 먼저 대조하세요. 등록 이력을 대조해요. 시군구 환경 부서에 문의하는 것이 우선이에요. 저감장치 이력을 검토해요. 날짜를 봐야 해요.';
    expect((text.match(new RegExp(DEFERRAL.source, 'g')) || []).length).toBeGreaterThanOrEqual(5);
    const stances = '납부를 미루는 선택은 맞지 않다고 봐요. 이 경우에는 고지서가 맞는지 먼저 판정하는 쪽이 맞아요. 연납을 기다리기보다 면제 반영 여부를 먼저 끝내는 편이 현실적이에요. 여기서는 판정하는 쪽을 권해요.';
    expect((stances.match(new RegExp(FIRST_PERSON_STANCE.source, 'g')) || []).length).toBeGreaterThanOrEqual(4);
    expect(measureStances(stances).total).toBeGreaterThanOrEqual(4);
  });

  const TITLE = '환경개선부담금 면제 대상 자동 적용 여부와 신청 방법, 9월 30일 납부기한';
  const section = (h2: string, body: string) => `<h2>${h2}</h2><p>${body}</p>`;
  // 절마다 다른 낱말로 채운다 — 같은 채움 문장을 되풀이하면 그 자체가 "절마다 같은 구절" 이다
  let fillSeed = 0;
  const filler = (n: number) => { fillSeed += 1; return Array.from({ length: n }, (_, i) => `${fillSeed}절${i + 1}호 낱말${fillSeed}${i + 1} 설명문장${fillSeed}${i + 1}입니다. `).join(''); };

  test('promise-deferred — 약속 절이 확인만 시키면 잡고, 조건 있는 판단이 있으면 안 잡는다', () => {
    const deferred = '면제 대상인지 확인할 때는 고지서와 등록 정보를 먼저 대조하세요. 자동 반영 여부는 시군구 환경 부서에 문의하는 것이 우선이에요. 저감장치 이력은 따로 검토해요. ' + filler(20);
    const html = '<h1>' + TITLE + '</h1>'
      + section('1. 환경개선부담금 부과 원리와 시기', '후납 구조입니다. ' + filler(20))
      + section('2. 면제 대상 차량과 자동 적용 여부', deferred)
      + section('3. 면제 신청 방법과 확인 서류', '서류 설명. ' + filler(20))
      + section('4. 9월 30일 납부기한과 납부기간', '기한 설명. ' + filler(20));
    const r = findFlowGaps(html, toPlainText, { title: TITLE });
    const hit = r.issues.find((i) => i.kind === 'promise-deferred');
    expect(hit).toBeTruthy();
    expect(hit!.title).toContain('자동 적용 여부');

    const answered = '유로5·유로6 경유차와 저공해자동차라면 별도 신청 없이 등록 정보로 반영됩니다. 저감장치 부착 차량이라면 부착 뒤 3년까지만 면제이므로 3년이 지났다면 부과 대상입니다. 면제인데 고지서가 왔다면 고지일부터 30일 안에 조정신청을 넣으세요. ' + filler(20);
    const html2 = html.replace(deferred, answered);
    expect(findFlowGaps(html2, toPlainText, { title: TITLE }).issues.find((i) => i.kind === 'promise-deferred')).toBeUndefined();
  });

  test('procedure-repeat — 같은 확인 구절이 절마다 나오면 잡고, 절마다 다르면 안 잡는다', () => {
    const same = '고지서와 등록원부 대조가 먼저입니다. 차량번호와 부과 기간을 확인합니다. ';
    const html = '<h1>' + TITLE + '</h1>' + [1, 2, 3, 4, 5].map((n) => section(`${n}. 절 ${n} 제목`, same + filler(15))).join('');
    const r = findFlowGaps(html, toPlainText, { title: TITLE });
    const hit = r.issues.find((i) => i.kind === 'procedure-repeat');
    expect(hit).toBeTruthy();
    expect(hit!.title).toContain('등록원부');
    const varied = '<h1>' + TITLE + '</h1>' + [1, 2, 3, 4, 5].map((n) => section(`${n}. 절 ${n} 제목`, `${n}번째 절은 ${['저공해 차량', '저감장치 기간', '조정신청 기한', '환급 절차', '문의처 정리'][n - 1]}을 다룹니다. ` + filler(15))).join('');
    expect(findFlowGaps(varied, toPlainText, { title: TITLE }).issues.find((i) => i.kind === 'procedure-repeat')).toBeUndefined();
    // 하네스에 실려 있다
    const a = auditArticle(html, [], { title: TITLE });
    expect(a.issues.map((i) => i.kind)).toContain('procedure-repeat');
  });

  test('말투 한 벌 — FAQ·답변 상자·다시 쓴 구간·글 전체 치환이 말투 설정을 따른다', () => {
    const g = read('src/core/final/generation.ts');
    expect(g).toContain('export function shouldApplyCasualTransform');
    expect(g).toContain("shouldApplyCasualTransform() ? '\"~해요\", \"~거든요\" 친근한 말투' : '본문과 같은 합니다체");
    expect(g).toContain("shouldApplyCasualTransform() ? '해요체(\"~해요\", \"~이에요\")' : '합니다체(\"~합니다\", \"~입니다\")'}로 쓰고 문장마다 마침표");
    expect(read('src/core/final/post-critique.ts')).toContain('말투는 원본 구간과 같게');
    const o = read('src/core/final/orchestration.ts');
    expect(o).toContain('말투를 글 전체에 맞췄습니다');
    expect(o.indexOf('말투를 글 전체에 맞췄습니다')).toBeLessThan(o.indexOf('const repaired = autoRepairBeforePublish(html);'));
    expect(NARRATIVE_FLOW_RULES).toContain('제목이 약속한 절은 대상별 답으로 씁니다');
    const q = read('scripts/quality-run.js');
    expect(q).toContain("flag('--mode', 'adsense')");
    expect(q).toContain("flag('--tone', 'professional')");
    expect(q).toContain('toneStyle: TONE,');
    const p = read('src/core/final/pre-publish-fix.ts');
    expect(p).toContain("'promise-deferred',");
    expect(p).toContain("'procedure-repeat',");
  });

  test('말투 지시 — 친근·대화 말투는 "선생님이 사람에게 존댓말로 설명" 이고 물음표·느낌표를 허용한다', () => {
    for (const t of ['friendly', 'casual', 'conversational']) {
      const s = getToneInstruction(t);
      expect(s).toContain('선생님이 앞에 앉은 한 사람에게');
      expect(s).toContain('물음표와 느낌표를 써도 됩니다');
      expect(s).toContain('"~합니다" 로 끝나는 문장이 글 어디에도 없어야');
      expect(s).not.toContain('저도 처음엔 그랬는데요".');   // 지어낸 경험담 예시는 더 이상 권하지 않는다
    }
    expect(getToneInstruction('formal')).toContain('격식체');
    expect(getToneInstruction('friendly')).toContain('많이들 헷갈리세요');
    expect(getToneInstruction('casual')).toContain('반말은 쓰지 않습니다');
  });

  test('되묻고 바로 설명하는 문단은 FAQ 흉내가 아니다 — 짧은 질문·답 줄은 여전히 잡는다', () => {
    const talk = (q: string) => `<p>${q} 아니에요. 등록 정보로 자동 반영되는 차량이 따로 있거든요. 유로5·유로6 경유차와 저공해자동차가 그래요. 그 밖의 차량은 시군구에 면제 신청을 직접 내야 해요. 신청 서류는 다음 절에서 하나씩 짚을게요!</p>`;
    const conversational = '<h2>1. 자동 적용 여부</h2>' + talk('그럼 면제는 자동으로 빠지냐고요?') + talk('신청을 안 했는데 고지서가 안 왔다고요?') + talk('저감장치를 달았으면 끝인가요?')
      + '<h2>자주 묻는 질문 (FAQ)</h2><details><summary>Q</summary><p>A</p></details>';
    expect(findInlineFaq(conversational)).toHaveLength(0);
    const mimic = '<h2>1.</h2><p>왜 거절되나요? 자체 심사 때문이에요.</p><p>다른 지점은 되나요? 단정할 수 없어요.</p><p>자동 전환되나요? 아니에요.</p>'
      + '<h2>자주 묻는 질문 (FAQ)</h2><details><summary>Q</summary><p>A</p></details>';
    expect(findInlineFaq(mimic)).toHaveLength(1);
  });
});
