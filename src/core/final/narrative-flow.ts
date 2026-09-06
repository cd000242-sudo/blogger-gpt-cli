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
   **제목이 약속한 절은 대상별 답으로 씁니다** (v3.8.670 실측: "자동 적용 여부" 절이 "대조하세요·문의하세요" 로만 끝났습니다).
   "별도 신청 없이 반영되는 사람은 …, 직접 신청해야 하는 사람은 …, 면제인데 고지서가 왔으면 …" 처럼 갈라 적고,
   자료에 없는 조건은 "자료에서 확인되지 않는다" 한 문장으로 밝힌 뒤 공식 확인처를 하나만 적습니다.
   확인 절차("고지서와 등록원부 대조")는 한 절에만 둡니다 — 다른 절은 그 절만의 조건·대상·서류를 씁니다.
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
    '⛔ 절 안에 "질문 한 줄 + 답 한 줄" 문답 목록으로 늘어놓지 마세요 (v3.8.664 실측: 두 편이 절 하나를 통째로 Q/A 로 채웠습니다). 질문은 상황 서술 속에 한 번 인용하고, 답은 필자의 판단 문장으로 씁니다. FAQ 는 글 끝에 코드가 따로 붙입니다.',
    '',
  ].join('\n');
}

/** 절을 닫는 데 쓰이는 회피 표현 — 많을수록 판단이 없다 */
// v3.8.670 실측(발행글, 해요체): "대조하세요·대조해요·문의하는 것이 우선이에요·검토해요·봐야 해요" 가 한 편에 40번인데 검사가 못 셌다 — 해요체·명령형까지 센다
export const DEFERRAL = /확인하세요|문의하세요|확인해\s*보세요|문의해\s*보세요|확인할\s*수\s*있(?:어요|습니다)|문의할\s*수\s*있(?:어요|습니다)|확인해야\s*(?:합니다|해요)|살펴야\s*(?:합니다|해요)|(?:봐야|살펴봐야|따져봐야|대조해야|검토해야)\s*(?:합니다|해요)|(?:확인|문의|대조|검토|비교)(?:해요|하세요)(?=[.\s])|(?:확인|문의)하는\s*(?:편이|것이\s*우선|방식이)|따라\s*다(?:릅니다|라요)|달라질\s*수\s*있(?:습니다|어요)|단정하기\s*어렵|판단하기\s*어렵|단정할\s*수\s*없/g;

/**
 * 필자의 판단 — 1인칭으로 입장을 밝혔거나, 판단 어미로 닫은 문장.
 * v3.8.662 실측: 말머리를 바꾸라고 하자 모델이 "…쪽입니다 / …편이 맞습니다 / …맞다고 봅니다 / 권하지 않습니다" 로
 * 판단을 적었는데 1인칭만 세던 검사가 다섯 편 전부 "판단 0" 이라 했다. 판단 어미도 판단이다.
 */
// v3.8.670: 해요체 판단("맞다고 봐요·쪽이 맞아요·현실적이에요·권해요")도 센다 — depth-voice 의 STANCE_ANY 와 같은 눈
export const FIRST_PERSON_STANCE = /제\s*(?:판단|생각|의견|결론)(?:은|으로는?|엔|에는|이|을)|저는\s[^.\n]{0,60}?(?:봅니다|봐요|판단합니다|권합니다|권해요|생각합니다|생각해요|말하겠습니다|보고\s*있습니다|권하지\s*않(?:습니다|아요)|쪽입니다|쪽이에요|편입니다|편이에요)|제가\s*보기(?:엔|에는)|저라면|(?:맞다고|않다고|맞지\s*않다고)\s*(?:봅니다|봐요)|(?:으로|로)\s*(?:봅니다|봐요)|쪽(?:입니다|이에요)|쪽으로\s*(?:봅니다|봐요)|(?:쪽|편|것|판단|순서|방식|기록)(?:이|은)\s*(?:더\s*)?(?:맞습니다|낫습니다|타당합니다|합리적입니다|자연스럽습니다|현실적입니다|직접적입니다|안전합니다|정확합니다|맞아요|나아요|낫겠어요|타당해요|합리적이에요|자연스러워요|현실적이에요|직접적이에요|안전해요|정확해요|좋아요)|권합니다|권해요|권하지\s*(?:않습니다|않아요)|먼저라는\s*쪽|여기서는\s[^.\n]{0,80}?(?:맞습니다|낫습니다|타당합니다|봅니다|맞아요|나아요|봐요)/g;

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
  opts: { title?: string; question?: string } = {},
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

  /**
   * v3.8.670 — 사장님 발행글 비평 두 가지 (환경개선부담금):
   *  ① 제목이 약속한 "자동 적용 여부" 절이 답 대신 "대조하세요·문의하세요" 로만 끝났다 (promise-deferred)
   *  ② "고지서와 등록원부 대조", "차량번호와 부과 기간 확인" 이 거의 모든 절에 나왔다 (procedure-repeat)
   * 둘 다 소제목 검사·되풀이 검사가 못 보던 것이다 — 소제목은 약속을 맡았고, 문장은 서로 달라 겹침이 아니었다.
   */
  try {
    const { titlePromises } = require('./reader-retention');
    const { measureStances } = require('./depth-voice');
    const sections = src.split(/(?=<h2\b)/i).slice(1)
      .map((part) => ({
        heading: toPlain((part.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) || [])[1] || '').trim(),
        text: toPlain(part.replace(/<h2[^>]*>[\s\S]*?<\/h2>/i, '')).replace(/\s+/g, ' '),
      }))
      .filter((s) => s.heading && !/자주\s*묻는|FAQ|요약|목차|읽어보기/i.test(s.heading));
    const flat = (t: string) => t.replace(/\s+/g, '');
    if (title && sections.length >= 3) {
      for (const p of titlePromises(title) as string[]) {
        const pw = words(p).filter((w) => w.length >= 2);
        if (pw.length === 0) continue;
        const carrier = sections.find((s) => pw.filter((w) => flat(s.heading).includes(w)).length / pw.length >= 0.6);
        if (!carrier) continue;
        const deferrals = (carrier.text.match(new RegExp(DEFERRAL.source, 'g')) || []).length;
        const sharp = measureStances(carrier.text).sharp;
        if (deferrals >= 2 && sharp === 0) {
          issues.push({
            kind: 'promise-deferred',
            title: `제목이 약속한 "${p}" 절이 답 대신 확인만 시킵니다 (확인·문의 ${deferrals}번, 조건 있는 판단 0)`,
            evidence: `절 "${carrier.heading.slice(0, 30)}": 독자는 "나는 자동인가, 신청해야 하는가" 를 들으러 왔는데 "대조하세요·문의하세요" 만 받습니다. 대상별로 답을 적어야 합니다.`,
            penalty: 8,
          });
        }
      }
    }
    if (sections.length >= 4) {
      const titleSet = new Set(titleWords);
      const bigramSections = new Map<string, Set<number>>();
      sections.forEach((s, si) => {
        // 용언(…합니다·…해요·…다)은 구절의 뼈대가 아니다 — 명사끼리 붙은 구절만 센다
        const toks = words(s.text).filter((w) => w.length >= 2 && !STOP.has(w) && !titleSet.has(w) && !/(?:니다|어요|아요|해요|예요|이에요|다|요|죠)$/.test(w));
        for (let i = 0; i + 1 < toks.length; i += 1) {
          const key = `${toks[i]} ${toks[i + 1]}`;
          if (!bigramSections.has(key)) bigramSections.set(key, new Set());
          bigramSections.get(key)!.add(si);
        }
      });
      const need = Math.max(3, Math.ceil(sections.length * 0.7));
      const repeated = [...bigramSections.entries()].filter(([, set]) => set.size >= need).map(([k]) => k);
      if (repeated.length >= 2) {
        issues.push({
          kind: 'procedure-repeat',
          title: `같은 확인 절차 구절이 절마다 나옵니다: ${repeated.slice(0, 3).map((k) => `"${k}"`).join(', ')}`,
          evidence: `절 ${sections.length}개 중 ${need}개 이상에 같은 구절이 있습니다. 확인 순서는 한 절에 두고, 나머지 절은 대상별 조건·신청 경로·서류로 채워야 합니다.`,
          penalty: 6,
        });
      }
    }
  } catch { /* 새 검사가 실패해도 점수 계산은 계속 */ }

  /**
   * v3.8.671 — 도입의 문제를 끝까지 붙잡았는가. 세 검사 모두 **알리기만 한다(감점 0)**.
   * 26편 산출물로 분포를 본 뒤(scripts/flow-calibrate.js) 673 에서 감점과 자가 수정 대상을 켠다 — 검사기부터 검증.
   * 실측(라이브 1편, 주택연금): 서론이 "확인하는 것이 출발점이에요" 로 끝나 질문이 없고, 절 5/5 가 "점검하세요" 로 닫히고,
   * 결론이 서론의 상황에 답하지 않았다. 셋 다 기존 검사(낱말 대조)는 통과시켰다.
   */
  try {
    const depth = require('./depth-voice');
    const sentencesOf = (t: string) => t.split(/(?<=[.!?。？])\s+/).map((s) => s.trim()).filter((s) => s.length >= 8);
    /**
     * 질문은 물음표로만 오지 않는다 — 26편 보정: "결국 자동인가, 신청해야 하는가." / "…대상인지, …대상인지가 가장 먼저 풀어야 할 질문입니다"
     * 같은 간접 의문이 6편이었다. 다만 "이 글은 …하는지를 정리합니다" 는 글의 범위 설명이지 독자에게 던진 질문이 아니다.
     */
    const SCOPE_STATEMENT = /^이\s*글(?:은|에서는)|정리합니다|정리해요|다룹니다|다뤄요|살펴봅니다|살펴봐요|초점을\s*맞춥니다|설명합니다|설명해요/;
    const isQuestion = (s: string) => !SCOPE_STATEMENT.test(s) && (
      /[?？]$/.test(s)
      || /(?:까요|나요|냐고요|는지요|을까|ㄹ까|가요|일까)[.!]?$/.test(s)
      || /(?:인가|는가|은가|ㄴ가|일까)(?=[,.!?\s가]|입니다|이에요|예요)/.test(s)
      || /(?:인지|는지|을지|ㄹ지)\s*(?:부터|가|를|입니다|이에요|예요)/.test(s)
      || /(?:풀어야\s*할|먼저\s*답할|답해야\s*할|남는)\s*질문/.test(s)
    );
    // 독자의 처지를 가르는 조건 — depth-voice 의 CONDITION 은 "정리하면" 의 "면" 까지 받아 여기서는 넓다
    const READER_CONDITION = /(?:라면|다면|이면|경우|때는|때에는|이상|미만|사람은|사람이|분은|분이|가구는|사업자는|사업자가|차량은|독자라면)/;
    const parts = src.split(/(?=<h2\b)/i).slice(1);

    // ① 서론 — 답 상자(class 있는 <p>)와 요약 상자를 뺀 맨 <p> 의 마지막 두 문단. 마지막 세 문장에 질문이 있어야 한다
    const firstH2At = src.search(/<h2\b/i);
    if (firstH2At > 0) {
      const paras = [...src.slice(0, firstH2At).matchAll(/<p(?![^>]*\bclass=)[^>]*>([\s\S]*?)<\/p>/gi)]
        .map((m) => toPlain(m[1] || '').replace(/\s+/g, ' ').trim())
        .filter((t) => t.length >= 30);
      if (paras.length >= 2) {
        const tail = sentencesOf(paras.slice(-2).join(' ')).slice(-3);
        if (tail.length > 0 && !tail.some(isQuestion)) {
          issues.push({
            kind: 'intro-question-missing',
            title: `서론이 질문 없이 끝납니다: "${tail[tail.length - 1]!.slice(0, 50)}"`,
            evidence: '도입에서 독자의 문제를 질문 하나로 세워야 절과 결론이 붙잡을 것이 생깁니다. "확인하는 것이 출발점이에요" 같은 지시로 끝나면 붙잡을 문제가 없습니다.',
            penalty: 0,
          });
        }
      }
    }

    // ② 절의 마지막 문장 — "점검하세요·확인한 뒤·순서대로 정리" 로 닫히고 이유가 없으면 필자의 반응이 아니라 목록이다
    const CHECKLIST_CLOSER = /(?:점검|확인|살펴|정리|대조|검토|비교|파악)(?:하는\s*(?:것이|편이)|해야|하세요|해\s*보세요|하시|한\s*뒤|하면)|먼저\s*잡으세요|순서대로\s*(?:정리|확인|점검)|함께\s*(?:점검|살펴)|한\s*번에\s*점검/;
    const reasonRe: RegExp = depth.REASON;
    const closers: string[] = [];
    let checked = 0;
    let total = 0;
    for (const part of parts) {
      const heading = toPlain((part.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) || [])[1] || '').trim();
      if (!heading || /자주\s*묻는|FAQ|요약|목차|읽어보기/i.test(heading)) continue;
      const bodyHtml = part.replace(/<h2[\s\S]*?<\/h2>/i, '').replace(/<table[\s\S]*?<\/table>/gi, ' ').replace(/<a\b[\s\S]*?<\/a>/gi, ' ');
      const ss = sentencesOf(toPlain(bodyHtml).replace(/\s+/g, ' ')).filter((s) => !/🔗|바로가기/.test(s));
      if (ss.length < 3) continue;
      total += 1;
      const last = ss[ss.length - 1]!;
      // "만기가 가까운 경우라면 새 대출 승인만 기다리지 말고 …" 는 조건부 판단이다 — 보정에서 목록으로 잘못 봤다
      if (CHECKLIST_CLOSER.test(last) && !READER_CONDITION.test(last) && !reasonRe.test(ss.slice(-2).join(' '))) {
        checked += 1;
        closers.push(`${heading.slice(0, 18)}: "${last.slice(0, 40)}"`);
      }
    }
    if (total >= 2 && checked >= Math.max(2, Math.ceil(total * 0.6))) {
      issues.push({
        kind: 'section-closer-checklist',
        title: `절 ${total}개 중 ${checked}개가 점검 목록으로 닫힙니다: ${closers.slice(0, 2).join(' / ')}`,
        evidence: '절의 마지막은 필자의 반응이어야 합니다 — 조건(누가·어떤 경우) + 행동 + 이유. "점검하세요·확인한 뒤 진행하세요" 는 반응이 아니라 목록입니다.',
        penalty: 0,
      });
    }

    // ③ 결론(FAQ 앞 1,200자) — 도입의 질문(없으면 제목)의 핵심 낱말 둘과 판단이 한 문장에 있어야 답한 것이다
    const question = String(opts.question || '').trim();
    // 제목의 날짜·숫자("8월", "31일")는 답의 낱말이 아니다 — 보정에서 이것 때문에 답한 결론을 두 편 놓쳤다
    const keyWords = [...new Set(words(toPlain(question || title)))].filter((w) => w.length >= 2 && !STOP.has(w) && !/^\d/.test(w));
    if (keyWords.length >= 2 && parts.length >= 2) {
      const tailText = plain.replace(/※[\s\S]*$/, '');
      const faqAt = tailText.search(/자주\s*묻는\s*질문|FAQ/i);
      const end = faqAt >= 0 ? faqAt : tailText.length;
      const endSentences = sentencesOf(tailText.slice(Math.max(0, end - 1200), end).replace(/\s+/g, ' '));
      const stanceRe = new RegExp(FIRST_PERSON_STANCE.source);
      const actRe: RegExp = depth.ACTION;
      // "줄일 수 있어요" 가 판단으로 잡히지 않게 "있어요·있습니다" 는 뺀다
      const VERDICT_END = /(?:돼요|됩니다|안\s*돼요|되지\s*않(?:아요|습니다)|없어요|없습니다|아니에요|아닙니다|가능해요|가능합니다|불가능(?:해요|합니다)|대상이에요|대상입니다)[.!?]?$/;
      const answered = endSentences.some((s) => keyWords.some((w) => s.includes(w))
        && (stanceRe.test(s) || (READER_CONDITION.test(s) && actRe.test(s)) || VERDICT_END.test(s)));
      if (!answered) {
        issues.push({
          kind: 'conclusion-not-answering',
          title: `결론이 도입의 문제에 답하지 않습니다 (핵심 낱말: ${keyWords.slice(0, 4).join('·')})`,
          evidence: '마무리는 서론이 세운 질문을 한 번 되받고 답을 줍니다 — "A 라면 된다 / B 라면 안 된다". "순서대로 정리하면 혼선을 줄일 수 있어요" 는 답이 아닙니다.',
          penalty: 0,
        });
      }
    }
  } catch { /* 새 검사가 실패해도 점수 계산은 계속 */ }

  return { issues, stats: { deferralPer1000, firstPersonStance, sectionsOffTitle } };
}
