/**
 * 경험 메모 → 프롬프트 블록 (v3.8.392)
 *
 * 왜 만들었나:
 *   "요즘은 그냥 정보 나열한다고 상위노출되지 않는다"는 지적에서 출발했다.
 *   근거로 받은 영상의 핵심은 **AI가 만들 수 없는 디테일**이다.
 *     "4월 8일 수요일, 어른 2명 9세 1명 8세 1명 다녀왔습니다"
 *     "주말 오후 2시에 갔더니 40분 대기, 1인당 얼마, 다음에 또 갈지 모르겠다"
 *   AI 요약(구글 AI Overviews)이 1초에 답해주는 단순 정보성 글은 클릭이 안 되고,
 *   위와 같은 1차 경험만 AI 요약으로 대체되지 않는다.
 *
 * ⚠️ 그래서 이 모듈은 경험을 **생성하지 않는다.**
 *   가보지도 않고 "40분 대기했다"고 쓰면 그건 허위 정보이고,
 *   영상이 경고한 양산형 AI 글보다 더 나쁘다.
 *   도구가 할 수 있는 정직한 역할은 **사용자가 적어준 경험을 본문에 잘 녹이는 것**뿐이다.
 *
 * 입력이 비어 있으면 빈 문자열을 돌려준다 → 프롬프트가 이전과 완전히 동일하다.
 * 비용: LLM 호출 0. 프롬프트 블록 생성만 한다.
 */

export type ExperienceInput = {
  /** 자유 서술 (형식 없이 아무렇게나) */
  note?: string;
  /** 육하원칙 — 접이식으로 따로 받는다 */
  who?: string;
  when?: string;
  where?: string;
  what?: string;
  how?: string;
  why?: string;
  /** 결과는 어땠는지 */
  result?: string;
  /** 처음 하는 사람에게 줄 팁 */
  tip?: string;
};

const FIELD_LABELS: Array<[keyof ExperienceInput, string]> = [
  ['who', '누가'],
  ['when', '언제'],
  ['where', '어디서'],
  ['what', '무엇을'],
  ['how', '어떻게'],
  ['why', '왜'],
  ['result', '결과'],
  ['tip', '처음 하는 사람에게 줄 팁'],
];

const clean = (value: unknown, max = 600): string =>
  String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** payload 에서 온 값을 안전한 모양으로 정리한다. */
export function normalizeExperience(raw: unknown): ExperienceInput {
  const source = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
  const out: ExperienceInput = {};
  const note = clean(source['note'], 2000);
  if (note) out.note = note;
  FIELD_LABELS.forEach(([key]) => {
    const v = clean(source[key as string]);
    if (v) (out as Record<string, string>)[key as string] = v;
  });
  return out;
}

/** 쓸 만한 경험이 실제로 들어왔는가. 너무 짧은 건 없는 것으로 본다. */
export function hasExperience(input: ExperienceInput): boolean {
  if (!input) return false;
  const filled = FIELD_LABELS.filter(([key]) => clean(input[key])).length;
  const noteLen = clean(input.note, 2000).length;
  // 자유칸에 10자 이상 썼거나, 육하원칙 칸이 2개 이상 채워졌으면 쓸 수 있다
  return noteLen >= 10 || filled >= 2;
}

/**
 * 프롬프트 블록을 만든다. 경험이 없으면 빈 문자열.
 *
 * 설계 의도:
 *   - 1차 경험은 이 글의 **차별점**이므로 앞쪽에 배치되고 여러 섹션에 걸쳐 녹아야 한다.
 *     영상 6:09 지적처럼 "한 문장 넣고 끝"이면 효과가 없다.
 *   - 별도 "후기" 섹션으로 격리하지 말 것 — 정보와 섞여야 읽는 이유가 된다.
 *   - 숫자·시각·인원은 그대로 보존. 요약하면 AI가 만들 수 있는 문장으로 되돌아간다.
 *   - **덧붙이기 금지**가 가장 중요하다. 모델이 그럴듯한 디테일을 창작하면 허위가 된다.
 */
export function buildExperienceBlock(input: ExperienceInput): string {
  const exp = normalizeExperience(input);
  if (!hasExperience(exp)) return '';

  const lines: string[] = [
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '🧑 **[작성자가 직접 겪은 일 — 이 글의 유일한 차별점]**',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '아래는 작성자가 **실제로 겪은 일**입니다. AI 요약이 절대 대체할 수 없는 부분이고,',
    '이 글이 검색 결과에서 살아남는 이유가 바로 이것입니다.',
    '',
  ];

  if (exp.note) {
    lines.push('▣ 작성자 메모');
    lines.push(`   ${exp.note}`);
  }
  const filled = FIELD_LABELS.filter(([key]) => clean(exp[key]));
  if (filled.length > 0) {
    lines.push('▣ 정리');
    filled.forEach(([key, label]) => lines.push(`   · ${label}: ${clean(exp[key])}`));
  }

  lines.push('');
  lines.push('**이 경험을 이렇게 쓰세요:**');
  lines.push('1. 도입부에서 바로 꺼내세요. "제가 ~해봤는데"로 시작하면 독자가 남습니다.');
  lines.push('2. 한 문장만 넣고 끝내지 마세요. 관련된 소제목마다 이 경험을 이어서 풀어야 합니다.');
  lines.push('3. 숫자·시각·인원·금액은 **위에 적힌 그대로** 쓰세요. 반올림하거나 두루뭉술하게');
  lines.push('   바꾸면 AI가 만들 수 있는 문장으로 되돌아갑니다.');
  lines.push('4. 별도 "후기" 섹션으로 몰아넣지 마세요. 정보 설명 사이사이에 섞어야 합니다.');
  lines.push('5. 잘된 것만 쓰지 말고 헤맨 것·실패한 것도 그대로 쓰세요. 그게 더 신뢰를 줍니다.');
  lines.push('6. 1인칭을 유지하세요. "~라고 합니다"로 남의 말처럼 바꾸지 마세요.');
  lines.push('');
  lines.push('🚫 **위에 없는 경험을 만들어내지 마세요.**');
  lines.push('   대기 시간, 방문 날짜, 동행 인원, 가격처럼 확인할 수 없는 값을 상상해서 쓰면');
  lines.push('   그것은 허위입니다. 위에 적힌 것만 쓰고, 부족하면 경험 이야기를 짧게 끝내세요.');

  return lines.join('\n');
}

/**
 * 경험 입력이 없을 때 항상 들어가는 안전장치.
 *
 * 경험 메모를 안 넣은 글에서 모델이 "제가 직접 신청해보니" 같은 1인칭 체험을
 * 창작하면 허위가 된다. 그건 이번 변경이 만들 수 있는 최악의 부작용이므로 막는다.
 */
export const NO_EXPERIENCE_GUARD = `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 **[겪지 않은 일을 겪은 것처럼 쓰지 마세요]**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

이 글에는 작성자의 직접 경험 정보가 제공되지 않았습니다. 따라서:

- ❌ "제가 직접 신청해보니", "방문해봤더니", "써보니까" — 쓰지 마세요.
- ❌ "40분 기다렸습니다", "3일 만에 나왔습니다" 처럼 확인할 수 없는 체험 수치 — 쓰지 마세요.
- ✅ 대신 절차·판단 기준·필요 서류·흔한 실수처럼 **확인 가능한 사실**로 채우세요.
- ✅ 일반적인 사실은 그냥 단정해서 쓰세요. 경험한 척만 하지 않으면 됩니다.

거짓 경험은 정보가 부족한 글보다 훨씬 나쁩니다.
`;
