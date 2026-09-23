/**
 * voice-softener — 「~합니다」만 이어지는 글에 **사람 말투의 어미**를 섞는다. (v3.8.720)
 *
 * ## 왜
 * 사장님: "말투를 좀 더 자연스럽게 사람처럼 나오게 해줘. ~합니다 ~입니다 ~습니다만 쓰는 게 아니라
 *          ~하죠 ~하는 이유죠 등등 있잖아"
 *
 * 실측(블로그스팟 이혼 글): "구분합니다/구분해야" 17회, "변호사 상담" 9회, "~편이 낫습니다" 6회.
 * 문장 끝이 전부 같으면 내용이 좋아도 기계가 읽어주는 소리가 난다.
 *
 * ## 해요체로 바꾸는 것이 아니다
 * 이미 있는 `haeyo.ts` 는 합니다체를 **전부** 해요체로 바꾼다. 그건 다른 물건이다.
 * 여기서는 **합니다체를 바탕으로 두고** 설명·공감 문장에만 `~죠 · ~거든요 · ~고요` 를 섞는다.
 * 사장님 대본의 말투가 그 모양이다.
 *
 * ## 무엇을 건드리지 않는가 (법률 글에서 특히 중요하다)
 *   · 기한·절차·권리처럼 **틀리면 안 되는 문장** — 단정 어미를 흔들면 뜻이 달라진다
 *   · 면책·고지 문장
 *   · 소제목·표 안·링크 글자
 *   · 한 문단의 **첫 문장과 끝 문장** — 여기가 흔들리면 글의 뼈대가 물러진다
 *
 * 즉 "바꿔도 안전한 설명 문장"에만, 그것도 **문단마다 한두 개씩만** 섞는다.
 * 전부 바꾸면 그건 또 다른 단조로움이고, 법률 글에서는 경솔해 보인다.
 */

/** 이 낱말이 들어간 문장은 건드리지 않는다 — 뜻이 흔들리면 안 되는 문장들 */
import { hasFinal } from './haeyo';

/** 이 낱말이 들어간 문장은 건드리지 않는다 */
const PROTECTED_WORDS = [
  '법원', '신고', '기한', '이내', '청구권', '소멸', '숙려기간', '면제', '단축',
  '권고', '상담을', '변호사', '본 글', '정보 제공', '법률 자문', '대체하지',
  '금지', '처벌', '위반', '효력', '요건',
];

/**
 * ⚠️ **행동 지시 문장에는 「죠」를 붙이지 않는다.**
 *
 * 실측(첫 판): "서명을 보류하죠", "자산 목록을 정리하죠", "상담 자료를 준비하죠" 가 나왔다.
 * 한국어에서 행동 동사 + 죠 는 **청유**로 읽힌다 — "같이 그렇게 하죠". 독자에게 시키는 문장이
 * 제안처럼 물러지고, 법률 안내에서는 뜻 자체가 달라진다.
 *
 * 그래서 `~합니다 → ~하죠` 를 통째로 여는 대신, **서술·설명 동사만** 목록으로 연다.
 * 목록에 없는 어미는 그대로 둔다 — 어색한 말투보다 남은 합니다체 한 문장이 낫다.
 */
const SOFTEN_RULES: Array<{ from: RegExp; to: string }> = [
  // 이유를 말하는 문장 → 거든요
  { from: /때문입니다\.$/, to: '때문이거든요.' },

  // 서술·설명 동사만 (행동 지시가 아니다)
  { from: /설명합니다\.$/, to: '설명하죠.' },
  { from: /의미합니다\.$/, to: '의미하죠.' },
  { from: /해당합니다\.$/, to: '해당하죠.' },
  { from: /필요합니다\.$/, to: '필요하죠.' },
  { from: /가능합니다\.$/, to: '가능하죠.' },
  { from: /중요합니다\.$/, to: '중요하죠.' },
  { from: /충분합니다\.$/, to: '충분하죠.' },
  { from: /비슷합니다\.$/, to: '비슷하죠.' },
  { from: /분명합니다\.$/, to: '분명하죠.' },

  // 상태·판단 서술
  { from: /하는 것입니다\.$/, to: '하는 겁니다.' },
  { from: /([가-힣])됩니다\.$/, to: '$1되죠.' },
  { from: /있습니다\.$/, to: '있죠.' },
  { from: /없습니다\.$/, to: '없죠.' },
  { from: /낫습니다\.$/, to: '낫죠.' },
  { from: /같습니다\.$/, to: '같죠.' },
  { from: /다릅니다\.$/, to: '다르죠.' },
  { from: /아닙니다\.$/, to: '아니죠.' },
  { from: /않습니다\.$/, to: '않죠.' },
  { from: /어렵습니다\.$/, to: '어렵죠.' },
  { from: /많습니다\.$/, to: '많죠.' },
];

/**
 * 「…입니다」를 못 바꾸는 자리.
 * 실측: "…있는지입니다" → "있는지죠"(없는 말), "…할 수입니다" 류도 마찬가지다.
 * 앞말이 의존명사·연결어미면 그대로 둔다.
 */
const IMNIDA_BLOCK = new RegExp(
  [
    '(는지|은지|을지|ㄹ지|수|바|뿐|줄|리)입니다\\.$',
    // 동작명사는 「죠」를 붙이면 뚝 끊긴다 — "검토죠", "확인죠"
    '(검토|확인|준비|정리|비교|대조|상담|요청|기록|표시|작성|점검|협의)입니다\\.$',
  ].join('|'),
);

/**
 * 「…입니다」는 받침을 봐야 한다.
 *   받침 있음: 사람입니다 → 사람이죠     받침 없음: 문제입니다 → 문제죠
 * 이걸 안 보면 "문제이죠" 같은 없는 말이 나온다(실측에서 나왔다).
 */
function softenImnida(sentence: string): string | null {
  if (IMNIDA_BLOCK.test(sentence)) return null;
  const m = sentence.match(/([가-힣])입니다\.$/);
  if (!m) return null;
  const last = m[1]!;
  return sentence.replace(/입니다\.$/, hasFinal(last) ? '이죠.' : '죠.');
}

function isProtected(sentence: string): boolean {
  return PROTECTED_WORDS.some((w) => sentence.includes(w));
}

/** 한 문장을 부드럽게 — 바꿀 수 없으면 원문 그대로 */
export function softenSentence(sentence: string): string {
  const trimmed = sentence.trim();
  if (!trimmed || isProtected(trimmed)) return sentence;
  /**
   * 규칙 표를 **먼저** 본다. 「…때문입니다」는 「…때문이거든요」가 되어야 하는데,
   * 「입니다」 처리가 앞서면 「때문이죠」로 끝나 거든요가 한 번도 안 나온다(실측).
   */
  for (const rule of SOFTEN_RULES) {
    if (rule.from.test(trimmed)) {
      return sentence.replace(trimmed, trimmed.replace(rule.from, rule.to));
    }
  }
  const imnida = softenImnida(trimmed);
  if (imnida) return sentence.replace(trimmed, imnida);
  return sentence;
}

/**
 * 한 문단의 말투를 섞는다.
 *
 * 첫 문장과 끝 문장은 그대로 두고, 가운데에서 **최대 두 문장**만 바꾼다.
 * 문단이 두 문장 이하면 아무것도 하지 않는다 — 바꿀 여유가 없다.
 */
export function softenParagraph(text: string, maxPerParagraph = 2): { text: string; changed: number } {
  const sentences = String(text || '').split(/(?<=[.!?])\s+/);
  if (sentences.length < 2) return { text, changed: 0 };

  let changed = 0;
  const out = sentences.map((sentence, index) => {
    if (index === 0) return sentence;                 // 문단 첫 문장은 그대로 — 여기가 흔들리면 뼈대가 물러진다
    if (changed >= maxPerParagraph) return sentence;
    const softened = softenSentence(sentence);
    if (softened !== sentence) changed += 1;
    return softened;
  });

  return { text: out.join(' '), changed };
}

/** 건드리면 안 되는 태그 — 이 안의 글자는 말투를 바꾸지 않는다 */
const SKIP_TAGS = /^(h[1-6]|th|td|a|script|style|summary|code|pre)$/i;

/**
 * HTML 안의 **글자만** 골라 말투를 섞는다. 태그·속성은 한 글자도 건드리지 않는다.
 *
 * 소제목·표·링크는 건너뛴다. 본문 문단(p, li)만 대상이다.
 */
export function softenHtmlVoice(html: string, maxPerParagraph = 2): { html: string; changed: number } {
  const source = String(html || '');
  let changed = 0;

  const out = source.replace(
    /<(p|li)(\b[^>]*)>([\s\S]*?)<\/\1>/gi,
    (whole, tag: string, attrs: string, inner: string) => {
      if (SKIP_TAGS.test(tag)) return whole;
      // 안쪽에 다른 블록이 들어 있으면 손대지 않는다 (구조가 흔들린다)
      if (/<(p|div|table|ul|ol|blockquote)\b/i.test(inner)) return whole;

      /**
       * 태그 조각은 그대로 두고 글자 부분만 본다.
       *
       * ⚠️ 조각마다 따로 세면 안 된다 — 이 글의 문단은 `<strong>첫 문장</strong> 둘째 문장` 꼴이라
       *    조각 하나에 문장이 한 개씩만 잡히고, "첫 문장은 건너뛴다" 규칙에 전부 걸려
       *    **한 문단도 안 바뀌었다**(실측: 134KB 글에서 1문장). 문단 전체를 한 묶음으로 센다.
       */
      const segments = inner.split(/(<[^>]+>)/);
      const textIdx = segments
        .map((seg, i) => ({ seg, i }))
        .filter(({ seg }) => !seg.startsWith('<') && seg.trim());

      let localChanged = 0;
      let globalSentence = 0;
      for (const { seg, i } of textIdx) {
        const sentences = seg.split(/(?<=[.!?])\s+/);
        const next = sentences.map((sentence) => {
          const isParagraphHead = globalSentence === 0;
          globalSentence += 1;
          if (isParagraphHead || localChanged >= maxPerParagraph) return sentence;
          const softened = softenSentence(sentence);
          if (softened !== sentence) localChanged += 1;
          return softened;
        });
        segments[i] = next.join(' ');
      }
      const rebuilt = segments.join('');

      changed += localChanged;
      return `<${tag}${attrs}>${rebuilt}</${tag}>`;
    },
  );

  return { html: out, changed };
}
