/**
 * 🧬 글 뼈대 변형 (v3.8.467) — 같은 키워드로 써도 다른 글이 나오게
 *
 * 사용자 지적: "내 툴로 같은 키워드로 작성하는 사람들은 전부 중복문서에 걸릴수도
 * 있다는거자나" · "뼈대자체를 … 여러가지 구조를 추가해서 랜덤으로 생성되게 하면
 * 되지않나".
 *
 * ## 왜 필요한가 — 실측 근거
 * 발행글 322편 전체 쌍 51,681개 측정(2026-07-30, self-overlap.ts 주석)에서
 * 유사도 0.35 를 넘은 11쌍은 **전부 같은 주제를 여러 번 쓴 경우**였다.
 *   · 청년내일저축계좌 4편 → 0.40~0.55
 *   · 추석 연휴 진료 지역 시리즈 → 0.38~0.45
 * 나머지(중간값 0.069)는 서로 안 닮았다. 즉 "같은 키워드로 쓰면 닮는다" 는
 * 추측이 아니라 이 툴에서 이미 관측된 사실이다.
 *
 * ## 왜 "순서 섞기"로는 안 되는가 (중요)
 * 구글의 근접중복 판정은 셰인글링(겹치는 단어 묶음)으로 지문을 만들어 비교한다.
 * 이 지문은 **집합 기반이라 순서와 무관**하다 — 문단을 아무리 섞어도 같은 단어
 * 묶음이 나오면 유사도는 그대로다.
 * (mode-dispatcher 의 애드센스 셔플이 정확히 그 한계를 갖고 있었다.)
 *
 * → 그래서 이 모듈은 순서가 아니라 **다루는 각도 자체**를 바꾼다.
 *   같은 키워드라도 A 사이트는 "비용·함정" 축으로, B 사이트는 "실수사례·체크리스트"
 *   축으로 쓰게 만든다. 쓰는 내용이 달라야 단어 묶음이 달라진다.
 *
 * ## 무엇을 지키는가
 *   · 추가 LLM 호출 0 — 섹션 정의만 갈아끼운다. 비용이 늘지 않는다.
 *   · 발행을 막지 않는다 — 변형 후보가 없으면 원래 뼈대 그대로 간다.
 *   · 첫 섹션(도입)과 마지막 섹션(마무리)은 건드리지 않는다. 글의 뼈대는 유지된다.
 *   · 시드가 결정적이다 — 같은 키워드·같은 사이트면 늘 같은 구조가 나온다.
 *     (같은 글을 다시 뽑을 때마다 구조가 바뀌면 사용자가 혼란스럽다)
 */
import type { MaxModeSection } from './types-interfaces';

/**
 * 모드별 **대체 각도** 후보.
 *
 * 기존 중간 섹션 하나를 이 중 하나로 바꾼다. 각 항목은 원래 섹션과 겹치지 않는
 * 축을 다뤄야 의미가 있다 — 표현만 바꾼 항목은 넣지 않는다.
 */
export const SECTION_ANGLE_VARIANTS: Record<string, MaxModeSection[]> = {
  internal: [
    {
      id: 'variant_cost_traps',
      title: '[주제] 비용과 놓치기 쉬운 함정',
      description: '돈이 드는 지점과 사람들이 실제로 손해 보는 구간',
      minChars: 1200,
      role: '실무 상담자',
      contentFocus: '비용 구조, 숨은 비용, 손해가 발생하는 구체적 상황',
      requiredElements: [
        '금액·비율 등 구체적 수치를 제시',
        '"이 경우에는 오히려 손해" 같은 조건부 판단 1개 이상',
        '일반론이 아니라 이 주제에서만 생기는 함정',
      ],
    },
    {
      id: 'variant_mistakes',
      title: '[주제]에서 자주 하는 실수',
      description: '흔한 오해와 그로 인한 결과',
      minChars: 1200,
      role: '경험 많은 조언자',
      contentFocus: '자주 하는 잘못된 판단, 그 결과, 바로잡는 방법',
      requiredElements: [
        '실수 3개 이상을 각각 원인·결과·해결로 구분',
        '"~라고 생각하기 쉽지만" 형태의 오해 교정 포함',
        '겁주기가 아니라 해결 방법까지 제시',
      ],
    },
    {
      id: 'variant_timeline',
      title: '[주제] 시점별로 달라지는 것',
      description: '시기·순서에 따라 결과가 갈리는 지점',
      minChars: 1100,
      role: '일정 관리자',
      contentFocus: '언제 하느냐에 따라 달라지는 조건·금액·자격',
      requiredElements: [
        '시점을 기준으로 최소 3구간으로 나눠 설명',
        '늦으면 무엇을 잃는지 구체적으로',
        '날짜·기간을 임의로 지어내지 말 것',
      ],
    },
    {
      id: 'variant_compare_alt',
      title: '[주제] 대신 고려할 수 있는 선택지',
      description: '대안과의 비교로 판단 기준 제공',
      minChars: 1200,
      role: '비교 분석가',
      contentFocus: '비슷한 목적의 다른 선택지, 각각이 유리한 상황',
      requiredElements: [
        '대안 2~3개를 같은 기준으로 비교',
        '"이런 사람은 이쪽" 식의 상황별 추천',
        '한쪽을 무조건 옹호하지 말 것',
      ],
    },
    {
      id: 'variant_checklist',
      title: '[주제] 시작 전 확인할 것',
      description: '행동 직전에 점검할 항목',
      minChars: 1000,
      role: '실행 가이드',
      contentFocus: '준비물, 자격 확인, 미리 알아둘 조건',
      requiredElements: [
        '점검 항목을 5개 이상 목록으로',
        '각 항목마다 "왜 필요한지" 한 줄',
        '준비가 안 됐을 때의 대안도 한 줄',
      ],
    },
  ],

  seo: [
    {
      id: 'variant_real_cases',
      title: '[주제] 실제 적용 사례',
      description: '구체적 상황에 대입한 결과',
      minChars: 1100,
      role: '사례 분석가',
      contentFocus: '조건이 다른 상황 2~3개에 각각 적용했을 때의 결과 차이',
      requiredElements: [
        '상황을 조건까지 구체적으로 설정',
        '같은 규칙이 상황에 따라 다르게 작동하는 지점',
        '실존 인물·기업을 지어내지 말 것',
      ],
    },
    {
      id: 'variant_pitfalls',
      title: '[주제] 하기 전에 알아야 할 제약',
      description: '적용되지 않는 경우와 예외',
      minChars: 1000,
      role: '검증자',
      contentFocus: '예외 조건, 제외 대상, 흔히 놓치는 단서 조항',
      requiredElements: [
        '예외·제외 조건 3개 이상',
        '"이 경우에는 해당되지 않는다" 를 명확히',
        '불확실하면 확인처를 안내',
      ],
    },
    {
      id: 'variant_cost_view',
      title: '[주제] 비용 대비 효과',
      description: '들이는 것과 얻는 것의 균형',
      minChars: 1100,
      role: '비용 분석가',
      contentFocus: '드는 비용·시간과 그에 대한 효과, 손익 분기',
      requiredElements: [
        '비용과 효과를 같은 단위로 비교',
        '어느 지점부터 이득인지 기준 제시',
        '수치를 지어내지 말고 범위로 표현',
      ],
    },
    {
      id: 'variant_beginner_path',
      title: '[주제] 처음 접하는 사람을 위한 순서',
      description: '아무것도 모를 때 무엇부터 봐야 하는지',
      minChars: 1000,
      role: '입문 안내자',
      contentFocus: '용어 정리, 최소한으로 알아야 할 것, 다음 단계',
      requiredElements: [
        '전제 지식 없이 읽히도록 용어를 먼저 풀 것',
        '단계를 3~4개로 끊어 제시',
        '전문 용어를 쓰면 바로 옆에 쉬운 말로 병기',
      ],
    },
    {
      id: 'variant_faq_specific',
      title: '[주제] 헷갈리는 지점 정리',
      description: '비슷해 보여 자주 혼동되는 개념 구분',
      minChars: 1000,
      role: '개념 정리자',
      contentFocus: '혼동하기 쉬운 항목들의 차이',
      requiredElements: [
        '혼동되는 쌍을 2~3개 골라 차이를 명확히',
        '차이를 표나 대비 문장으로',
        '억지 구분을 만들지 말 것',
      ],
    },
  ],

  adsense: [
    {
      id: 'variant_before_after',
      title: '[주제] 하기 전과 후에 달라지는 것',
      description: '변화의 구체적 모습',
      minChars: 1200,
      role: '변화 관찰자',
      contentFocus: '적용 전후로 실제 달라지는 지점',
      requiredElements: [
        '전/후를 같은 항목 기준으로 비교',
        '체감되는 변화와 그렇지 않은 부분을 구분',
        '과장하지 말 것',
      ],
    },
    {
      id: 'variant_who_should',
      title: '[주제]가 맞는 사람 · 아닌 사람',
      description: '대상 적합성 판단',
      minChars: 1100,
      role: '상담자',
      contentFocus: '어떤 조건의 사람에게 맞고 어떤 경우엔 권하지 않는지',
      requiredElements: [
        '맞는 조건 3개, 안 맞는 조건 3개',
        '"모두에게 좋다" 식 서술 금지',
        '판단 기준을 조건으로 제시',
      ],
    },
    {
      id: 'variant_faq_deep',
      title: '[주제] 실제로 많이 묻는 것',
      description: '검색자가 던지는 구체적 질문',
      minChars: 1000,
      role: '질문 정리자',
      contentFocus: '검색 의도에서 드러나는 실제 궁금증',
      requiredElements: [
        '질문 4개 이상을 각각 짧게 답',
        '뻔한 질문 대신 구체적 상황을 담은 질문',
        '모르는 것은 모른다고 쓸 것',
      ],
    },
    {
      id: 'variant_cost_time',
      title: '[주제]에 드는 시간과 비용',
      description: '실제로 얼마나 들이는지',
      minChars: 1100,
      role: '비용 안내자',
      contentFocus: '소요 시간, 금전적 비용, 대안 대비 부담',
      requiredElements: [
        '시간과 비용을 각각 범위로 제시',
        '사람마다 달라지는 요인을 명시',
        '수치를 지어내지 말 것',
      ],
    },
    {
      id: 'variant_common_myths',
      title: '[주제]에 대한 흔한 오해',
      description: '잘못 알려진 내용 바로잡기',
      minChars: 1100,
      role: '사실 확인자',
      contentFocus: '널리 퍼진 오해와 실제',
      requiredElements: [
        '오해 3개를 각각 "알려진 것 / 실제" 로 대비',
        '왜 그런 오해가 생겼는지 한 줄',
        '근거 없는 단정 금지',
      ],
    },
  ],

  shopping: [
    {
      id: 'variant_use_scenarios',
      title: '이 제품, 이런 상황에서 씁니다',
      description: '실사용 상황별 적합도',
      minChars: 1000,
      role: '사용 시나리오 안내자',
      contentFocus: '상황별로 이 제품이 맞는지 갈리는 지점',
      requiredElements: [
        '사용 상황 3개 이상을 구체적으로',
        '각 상황에서 만족/불만족 요인',
        '없는 기능을 있다고 쓰지 말 것',
      ],
    },
    {
      id: 'variant_maintenance',
      title: '사고 나서 관리·유지에 드는 것',
      description: '구매 이후의 비용과 수고',
      minChars: 1000,
      role: '유지관리 안내자',
      contentFocus: '소모품, 청소, 보관, A/S 등 구매 후 부담',
      requiredElements: [
        '유지에 드는 항목을 구체적으로',
        '주기와 대략적 비용',
        '수집한 정보에 없으면 추측하지 말 것',
      ],
    },
    {
      id: 'variant_size_fit',
      title: '크기·설치·호환 확인',
      description: '사기 전에 재봐야 할 것',
      minChars: 900,
      role: '설치 안내자',
      contentFocus: '치수, 설치 조건, 다른 제품과의 호환',
      requiredElements: [
        '확인할 치수·조건을 목록으로',
        '안 맞으면 어떻게 되는지',
        '상세정보에 있는 값만 사용',
      ],
    },
    {
      id: 'variant_who_fits',
      title: '이 제품이 맞는 사람 · 아닌 사람',
      description: '구매 적합성 판단',
      minChars: 1000,
      role: '구매 상담자',
      contentFocus: '어떤 사용자에게 맞고 어떤 경우 권하지 않는지',
      requiredElements: [
        '맞는 조건과 안 맞는 조건을 각각 3개',
        '"모두에게 좋다" 식 서술 금지',
        '수집한 정보 범위 안에서만 판단',
      ],
    },
    {
      id: 'variant_first_impression',
      title: '받아보면 이런 점이 먼저 보입니다',
      description: '첫 사용에서 체감되는 부분',
      minChars: 900,
      role: '첫인상 전달자',
      contentFocus: '개봉·구성품·첫 사용에서 눈에 띄는 지점',
      requiredElements: [
        '구성품과 첫 사용 흐름',
        '기대와 다를 수 있는 부분 1개 이상',
        '직접 써본 척하지 말고 수집 정보 기준으로',
      ],
    },
  ],
};

/**
 * 절대 바꾸지 않는 섹션 — 글의 알맹이다.
 *
 * 각도를 벌리려다 핵심 정보 섹션까지 빼면 글이 얄팍해진다.
 * 사용자 원칙: "정보를 주려면 확실하게 줘야 되니까".
 */
const ESSENTIAL_SECTION_IDS: Record<string, string[]> = {
  internal: ['core_knowledge'],
  seo: ['concept_definition', 'core_features'],
  adsense: ['complete_understanding', 'understanding_topic', 'step_by_step_guide'],
  shopping: ['product_intro_spec', 'product_introduction', 'real_reviews'],
};

/** 문자열을 32비트 정수 해시로 (결정적) */
export function seedFrom(...parts: Array<string | undefined | null>): number {
  const text = parts.map((p) => String(p || '')).join('|');
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 시드 기반 결정적 난수 (mulberry32) */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SectionPlanResult {
  sections: MaxModeSection[];
  /** 바뀐 내용 설명 (로그용) */
  changes: string[];
}

/**
 * 뼈대를 시드에 따라 변형한다.
 *
 * @param modeId       모드 id (internal · seo · adsense · shopping …)
 * @param base         원래 섹션 목록
 * @param seed         키워드+사이트로 만든 시드 — 같으면 늘 같은 결과
 * @param swapCount    바꿀 중간 섹션 수 (기본 1)
 */
export function planVariedSections(
  modeId: string,
  base: MaxModeSection[],
  seed: number,
  swapCount = 1,
): SectionPlanResult {
  const changes: string[] = [];
  const pool = SECTION_ANGLE_VARIANTS[modeId] || [];

  // 변형 후보가 없거나 뼈대가 너무 짧으면 그대로 둔다 — 발행을 방해하지 않는다
  if (pool.length === 0 || base.length < 4) {
    return { sections: base, changes };
  }

  const rng = makeRng(seed);
  const out = base.slice();

  /**
   * 첫·마지막은 고정(도입·마무리), 핵심 정보 섹션도 고정.
   * 나머지 중에서 바꾼다.
   */
  const essential = new Set(ESSENTIAL_SECTION_IDS[modeId] || []);
  const swappableIdx: number[] = [];
  for (let i = 1; i < out.length - 1; i += 1) {
    if (!essential.has(out[i]!.id)) swappableIdx.push(i);
  }

  const usedVariants = new Set<string>();
  /**
   * 하나만 바꾸면 5섹션 중 4섹션이 그대로라 유사도가 충분히 안 떨어진다.
   * 바꿀 수 있는 자리는 최대한 바꾸되(최대 2개) 핵심 섹션은 건드리지 않는다.
   */
  const desired = Math.max(swapCount, Math.min(2, swappableIdx.length));
  const limit = Math.min(desired, swappableIdx.length, pool.length);

  for (let n = 0; n < limit; n += 1) {
    const pickPos = swappableIdx.splice(Math.floor(rng() * swappableIdx.length), 1)[0];
    if (pickPos === undefined) break;

    // 아직 안 쓴 변형 중에서 고른다
    const candidates = pool.filter((v) => !usedVariants.has(v.id));
    if (candidates.length === 0) break;
    const variant = candidates[Math.floor(rng() * candidates.length)]!;
    usedVariants.add(variant.id);

    const replaced = out[pickPos]!;
    out[pickPos] = variant;
    changes.push(`${replaced.id} → ${variant.id}`);
  }

  /**
   * 분량도 조금 흔든다 (±15%).
   * 길이가 같으면 문단 구조가 비슷해지기 쉽다. 최소 분량 보장은 유지한다.
   */
  const jittered = out.map((sec) => {
    const original = Number(sec.minChars) || 800;
    const factor = 0.85 + rng() * 0.3;
    return { ...sec, minChars: Math.max(500, Math.round(original * factor)) };
  });

  return { sections: jittered, changes };
}
