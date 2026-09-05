/**
 * 🧭 흐름 — 도입에서 던진 질문을 끝까지 붙잡는다 (v3.8.660)
 *
 * ## 왜
 * 사장님(2026-09-06):
 *   "글의 흐름이 완벽해야 돼. 제목과 본문의 연결이 좋아야 된다는 거지. 독자가 궁금해할 정보를 가져와서
 *    풀고 필자의 반응까지 이어가는 거지. 도입에서 던진 문제를 끝까지 붙잡는 구성과 분명한 관점이 정말 중요해."
 *   "제목의 공감을 본문이 끝까지 이어받아야 해."
 *
 * 다섯 회차 24편을 읽으며 본 것: 절이 섬처럼 떠 있고, 절마다 "확인하세요·문의하세요" 로 닫히며,
 * 글 전체에 필자의 판단이 한 문장도 없다. 사실은 많은데 척추가 없다. 읽히지만 남지 않는다.
 *
 * ## 두 겹
 *   ① 프롬프트 — 첫 생성에서 척추를 세운다 (호출 0)
 *   ② 검사 — 회피 밀도 · 필자 판단 유무 · 도입 약속↔마무리 · 제목 낱말이 끊긴 절 (호출 0)
 *
 * storyscope-rules 의 "교훈 떠먹이기 금지 / H3 를 정리·당부로 닫지 말기" 와 함께 산다:
 * 금지된 건 근거 없는 훈계("~이 중요합니다")와 말끔한 당부("~하시면 됩니다")다.
 * 여기서 요구하는 건 **근거 붙은 판단**("저는 이 경우 A로 봅니다. 이유는 …")이다. 둘은 다르다.
 */

import type { AuditIssue } from './article-audit';

export const NARRATIVE_FLOW_RULES = `

🧭 [흐름 — 도입에서 던진 질문을 끝까지 붙잡는다] (v3.8.660)
1. **서론은 독자가 검색창에 친 질문 하나로 끝납니다.** "결국 자동인가, 신청해야 하는가." 처럼 한 문장으로 적으세요.
   그 질문이 이 글의 척추입니다. 제목이 독자에게 한 약속(그 사람이 처한 상황)을 서론이 받고, 모든 절이 그 상황의 그 사람에게 말합니다.
   제목을 보고 들어온 사람은 **문제를 안고 온 사람**입니다. 본문은 그 문제의 해결책을 그 사람의 상황 안에서 마련해 줍니다 —
   제도를 일반적으로 설명하는 글이 아니라, 그 상황에서 무엇을 하면 되는지 답하는 글입니다.
2. **각 H2 절의 첫 문장은 앞 절의 결론을 받아서 시작합니다.** "앞에서 대상은 갈렸습니다. 그럼 신청은 누가 해야 할까요." 처럼.
   절이 섬처럼 떠 있으면 안 됩니다. 절 다섯 개가 각자 처음부터 설명을 시작하면 독자는 같은 글을 다섯 번 읽습니다.
3. **각 H2 절은 필자의 판단 한 문장으로 닫습니다.** "저는 이 경우 A 쪽으로 봅니다. 이유는 …" / "제 판단은 신청하는 쪽입니다."
   같은 말머리를 절마다 되풀이하지 마세요 — "제 판단은 / 저라면 / 저는 …쪽입니다 / 여기서는 …가 맞다고 봅니다 / 제가 보기엔" 을 절마다 바꿔 씁니다.
   "확인하세요·문의하세요·상황에 따라 다릅니다" 로 절을 끝내지 마세요. 조건이 갈리면 "A 면 X, B 면 Y" 라고 판단을 적습니다.
   근거가 약하면 "근거가 이것뿐이라 저는 …까지만 말하겠습니다" 라고 한계를 밝히되, 판단을 비우지는 않습니다.
4. **관점은 하나입니다.** 글 전체가 같은 입장을 유지합니다. 1절에서 "신청해야 한다" 고 했으면 4절에서 "자동일 수도" 라고 흔들리지 않습니다.
5. **결론은 요약이 아니라 서론 질문의 답입니다.** 첫 문장에서 그 질문에 답하고, 필자의 마지막 반응(그래서 이 독자가 오늘 할 일 하나)으로 닫습니다.
   핵심 요약을 붙이더라도 첫 문장은 답이어야 합니다.
6. 금지: 절마다 같은 확인 절차를 되풀이하는 것 · "…에 따라 다릅니다" 로 끝나는 절 · 판단 없이 자료 이름만 나열하는 절.
   (근거 없는 훈계 "~이 중요합니다" 와 근거 붙은 판단 "저는 …로 봅니다. 이유는 …" 은 다릅니다. 앞은 금지, 뒤는 필수.)
7. **경험은 두 가지뿐입니다.** ① 아래에 [작성자가 직접 겪은 일] 또는 [필자의 실제 경험] 메모가 있으면 그것을 서론이나 가장 맞는 절에 1인칭 체험으로 녹입니다 —
   메모에 없는 일을 겪은 것처럼 보태지 않습니다. ② 메모가 없으면 [검색자가 실제로 올린 질문]을 인용해 "이런 상황이 실제로 있습니다" 로
   곤란한 상황을 세우고, 필자는 그 상황에 **판단으로** 반응합니다. 겪지 않은 체험을 지어내는 것은 어느 경우에도 안 됩니다.
`;

/**
 * 필자의 실제 경험 메모 → 프롬프트 블록 (v3.8.660)
 *
 * 사장님: "이런 공감 속에서 나만의 경험이 나오는 거지. AI 가 만들지 못하는 경험. 이런 곤란한 상황 속에서
 *          경험을 넣는 걸 원한다고. 다른 툴은 AI 가 그걸 만들지 못하지만 우리는 그걸 만들 수 있게."
 *
 * AI 는 경험을 만들 수 없다. 그래서 **사람이 적은 경험을 받아** 글에 녹인다. 이 메모가 없으면 체험을 쓰지 않는다.
 * 지어낸 체험은 검색에서도 역신호다(2026-08 조사: 실사용 사진이 랭킹 요소, AI 생성컷은 역신호).
 */
export function buildAuthorExperienceBlock(memo: unknown): string {
  const text = String(memo || '').replace(/\s+/g, ' ').trim();
  if (text.length < 10) return '';
  return [
    '',
    '🙋 [필자의 실제 경험 — 글쓴이가 직접 적은 메모]',
    `"${text.slice(0, 1200)}"`,
    '이 경험을 서론(제목이 부른 상황을 받는 자리)이나 가장 관련 있는 절에 **1인칭으로** 녹이세요. 두세 문장이면 됩니다.',
    '메모에 적힌 것만 경험입니다. 날짜·금액·기관명을 메모에 없는 것으로 채우지 마세요. 메모가 짧으면 짧게 씁니다.',
    '',
  ].join('\n');
}

/** 검색자가 실제로 올린 질문 → 상황 인용 블록. 경험 메모가 없을 때 곤란한 상황을 세우는 재료 (v3.8.660) */
export function buildRealSituationBlock(questions: unknown): string {
  const list = (Array.isArray(questions) ? questions : [])
    .map((q) => String(q || '').replace(/^Q\.\s*/i, '').replace(/\s+/g, ' ').trim())
    .filter((q) => q.length >= 8 && q.length <= 160)
    .slice(0, 3);
  if (list.length === 0) return '';
  return [
    '',
    '📥 [검색자가 실제로 올린 질문 — 곤란한 상황의 재료]',
    ...list.map((q) => `   · "${q}"`),
    '서론은 이 가운데 하나를 인용해 상황을 세워도 됩니다("이런 질문이 실제로 올라옵니다"). 이것은 독자의 상황이지 필자의 체험이 아닙니다 — 체험으로 꾸미지 마세요.',
    '',
  ].join('\n');
}

/** 절을 닫는 데 쓰이는 회피 표현 — 많을수록 판단이 없다 */
export const DEFERRAL = /확인하세요|문의하세요|확인해\s*보세요|확인할\s*수\s*있(?:어요|습니다)|문의할\s*수\s*있(?:어요|습니다)|확인해야\s*(?:합니다|해요)|살펴야\s*(?:합니다|해요)|확인하는\s*편이|따라\s*다릅니다|달라질\s*수\s*있(?:습니다|어요)|단정하기\s*어렵|판단하기\s*어렵|단정할\s*수\s*없/g;

/**
 * 필자의 판단 — 1인칭으로 입장을 밝혔거나, 판단 어미로 닫은 문장.
 * v3.8.662 실측: 말머리를 바꾸라고 하자 모델이 "…쪽입니다 / …편이 맞습니다 / …맞다고 봅니다 / 권하지 않습니다" 로
 * 판단을 적었는데 1인칭만 세던 검사가 다섯 편 전부 "판단 0" 이라 했다. 판단 어미도 판단이다.
 */
export const FIRST_PERSON_STANCE = /제\s*(?:판단|생각|의견|결론)(?:은|으로는?|엔|에는|이|을)|저는\s[^.\n]{0,60}?(?:봅니다|판단합니다|권합니다|생각합니다|말하겠습니다|보고\s*있습니다|권하지\s*않습니다|쪽입니다|편입니다)|제가\s*보기(?:엔|에는)|저라면|맞다고\s*봅니다|(?:으로|로)\s*봅니다|쪽입니다|쪽으로\s*봅니다|(?:쪽|편|것|판단|순서|방식|기록)(?:이|은)\s*(?:더\s*)?(?:맞습니다|낫습니다|타당합니다|합리적입니다|자연스럽습니다|현실적입니다|직접적입니다|안전합니다|정확합니다)|권합니다|권하지\s*않습니다|먼저라는\s*쪽|여기서는\s[^.\n]{0,80}?(?:맞습니다|낫습니다|타당합니다|봅니다)/g;

/**
 * 회피 밀도 상한 (1,000자당). 실측 보정(2026-09-06, 흐름 규칙 이전 5편): 0.37 · 0.77 · 0.86 · 1.01 · 1.88.
 * 1.88(대출 갈아타기, 12건)은 읽어 보면 "확인해야 합니다" 가 절마다 나와 숙제 같았다. 그 위를 자른다.
 * 흐름 규칙 이전의 환경개선부담금 글은 3.0(30건)이었다.
 */
export const DEFERRAL_MAX_PER_1000 = 2.5;
export const DEFERRAL_MIN_HITS = 10;

const STOP = new Set(['여부', '방법', '기준', '절차', '조건', '대상', '정리', '총정리', '안내', '확인', '가이드', '경우', '지점', '차이', '그리고', '위한', '대한', '관련', '내용', '정보', '이번', '오늘', '지금', '이후', '이전']);

function words(text: string): string[] {
  return String(text || '')
    .replace(/[^가-힣0-9\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/(은|는|이|가|을|를|의|에|로|와|과|도|에서|까지|부터)$/, ''))
    .filter((w) => w.length >= 2 && !STOP.has(w));
}

export interface FlowStats {
  deferralPer1000: number;
  firstPersonStance: number;
  /** 제목 낱말이 하나도 안 나오는 h2 절 수 */
  sectionsOffTitle: number;
}

/**
 * 흐름 검사 — 전부 무료.
 *   deferral-flood      회피 표현이 1,000자당 상한을 넘음
 *   no-stance           1인칭 판단 문장이 0
 *   title-thread-lost   제목 낱말이 하나도 안 나오는 h2 절이 둘 이상 (제목의 공감이 끊긴 절)
 *   intro-promise-unkept 서론이 "이 글은 …를 정리합니다" 로 약속한 것이 마무리에 없음
 */
export function findFlowGaps(
  html: string,
  toPlain: (h: string) => string,
  opts: { title?: string } = {},
): { issues: AuditIssue[]; stats: FlowStats } {
  const src = String(html || '');
  const plain = toPlain(src);
  const bodyOnly = plain.replace(/\s+/g, ' ');
  const len = Math.max(1, bodyOnly.replace(/\s+/g, '').length);
  const issues: AuditIssue[] = [];

  const deferrals = (bodyOnly.match(DEFERRAL) || []).length;
  const deferralPer1000 = Number(((deferrals / len) * 1000).toFixed(2));
  if (deferralPer1000 > DEFERRAL_MAX_PER_1000 && deferrals >= DEFERRAL_MIN_HITS) {
    issues.push({
      kind: 'deferral-flood',
      title: `"확인하세요·문의하세요·따라 다릅니다" 가 ${deferrals}번입니다 (1,000자당 ${deferralPer1000}회)`,
      evidence: '절을 판단 대신 회피로 닫고 있습니다. 독자는 답을 들으러 왔는데 숙제만 받아 갑니다. 조건이 갈리면 "A면 X, B면 Y" 로 판단을 적어야 합니다.',
      penalty: 8,
    });
  }

  // 문장 단위로 센다 — "제 판단은 … 쪽입니다" 는 표현이 둘이어도 판단은 하나다 (v3.8.662)
  const stanceRe = new RegExp(FIRST_PERSON_STANCE.source);
  const firstPersonStance = bodyOnly.split(/(?<=[.!?])\s+/).filter((s) => stanceRe.test(s)).length;
  if (firstPersonStance === 0 && len >= 2000) {
    issues.push({
      kind: 'no-stance',
      title: '필자의 판단이 한 문장도 없습니다',
      evidence: '"저는 이 경우 A 쪽으로 봅니다" 같은 1인칭 판단이 0건입니다. 사실만 나열한 글은 관점이 없어 독자에게 남지 않습니다.',
      penalty: 6,
    });
  }

  // 제목의 공감이 끊긴 절 — h2 절 본문에 제목 낱말이 하나도 없으면 그 절은 딴 글이다
  let sectionsOffTitle = 0;
  const title = String(opts.title || (src.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '');
  const titleWords = title ? [...new Set(words(toPlain(title)))] : [];
  if (titleWords.length >= 2) {
    const parts = src.split(/(?=<h2\b)/i).slice(1);
    const offNames: string[] = [];
    for (const part of parts) {
      const heading = toPlain((part.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) || [])[1] || '').trim();
      if (!heading || /자주\s*묻는|FAQ|요약|목차|읽어보기/i.test(heading)) continue;
      const text = toPlain(part).replace(/\s+/g, '');
      const hit = titleWords.some((w) => text.includes(w));
      if (!hit) { sectionsOffTitle += 1; offNames.push(heading.slice(0, 24)); }
    }
    if (sectionsOffTitle >= 2) {
      issues.push({
        kind: 'title-thread-lost',
        title: `제목의 낱말이 한 번도 안 나오는 절이 ${sectionsOffTitle}개입니다: ${offNames.join(' / ')}`,
        evidence: `제목: "${title}". 제목이 약속한 상황의 독자에게 말하지 않는 절입니다. 제목의 공감을 본문이 끝까지 이어받아야 합니다.`,
        penalty: 6,
      });
    }
  }

  // 서론의 약속 ↔ 마무리
  const firstH2 = src.search(/<h2\b/i);
  const intro = firstH2 > 0 ? toPlain(src.slice(0, firstH2)) : '';
  const promise = intro.split(/(?<=[.!?])\s+/).find((s) => /이\s*글(?:은|에서는)|정리합니다|살펴봅니다|다룹니다|설명합니다|짚어\s*봅니다/.test(s)) || '';
  // v3.8.662 — 약속 낱말은 **본문에 두 번 이상 나오는 주제어**만 센다. "대신·초점·특정" 같은 서술 낱말은 마무리에 안 나와도 약속 불이행이 아니다
  const bodyFlat = plain.replace(/\s+/g, '');
  const promiseWords = [...new Set(words(promise))]
    .filter((w) => !/^(글|이번|정리|살펴|설명|대신|초점|특정|상황|구분|경우|여부|가능성|따지|어디|무엇|어떻게|먼저|함께)/.test(w))
    .filter((w) => bodyFlat.split(w).length - 1 >= 2);
  if (promiseWords.length >= 3) {
    const tail = plain.replace(/※[\s\S]*$/, '');
    // 마무리 = FAQ 이후. FAQ 가 없으면 끝에서 1,500자
    const faqAt = tail.search(/자주\s*묻는\s*질문|FAQ/i);
    const ending = tail.slice(faqAt >= 0 ? faqAt : Math.max(0, tail.length - 1500)).replace(/\s+/g, '');
    const kept = promiseWords.filter((w) => ending.includes(w)).length;
    if (kept / promiseWords.length < 0.4) {
      issues.push({
        kind: 'intro-promise-unkept',
        title: '서론이 약속한 것이 마무리에 없습니다',
        evidence: `서론: "${promise.slice(0, 80)}" — 이 낱말 ${promiseWords.length}개 중 ${kept}개만 마무리에 있습니다. 도입에서 던진 문제를 끝까지 붙잡지 못했습니다.`,
        penalty: 6,
      });
    }
  }

  return { issues, stats: { deferralPer1000, firstPersonStance, sectionsOffTitle } };
}
