/**
 * 🧭 허브 헌장 (Hub Charter) — 단일 일관 모드 허브글의 "존재 이유" 게이트 (v3.8.544)
 *
 * 사장님 지시:
 *   "단일일관모드가 허브글을 만드는 역할을 하는데, 허브마다 생성 사유를 만들어.
 *    예: 이 허브는 7개의 하위 콘텐츠를 연결하지만 기존 글의 요약이 아니라
 *       '전세사기 피해주택을 낙찰받은 사람이 시간순으로 무엇을 확인해야 하는지'를 해결한다.
 *    허브 존재 이유가 한 문장으로 설명 안 되면 발행하지 않는 것."
 *
 * ## 왜 문장 전체를 AI 에게 맡기지 않는가
 * 자유 문장을 받아서 "이게 좋은 사유인가"를 판정하면 판정 기준이 흐려진다.
 * 그래서 **틀은 코드가 고정하고, AI 는 한 조각(job)만 채운다.**
 *
 *   이 허브는 {N}개의 하위 콘텐츠를 연결하지만, 기존 글의 요약이 아니라 "{job}"을(를) 해결한다.
 *
 * 판정 대상은 job 하나뿐이라 규칙이 명확해진다 —
 *   · 누구를 위한 것인지 (대상 표지)
 *   · 무엇을 결정·확인하게 되는지 (판단/순서 표지)
 * 둘 다 없으면 그건 사유가 아니라 제목의 다른 말일 뿐이다.
 *
 * ## 차단에 대하여
 * 이 저장소의 기존 원칙은 "검수 때문에 발행이 막히면 안 된다" 이고, 그래서 다른 게이트는
 * 전부 경고형이다. 이번 건은 사장님이 **차단을 명시적으로 요구**했으므로 차단형으로 만들되,
 * 사고를 줄이는 장치를 함께 둔다:
 *   · 실패했을 때만 1회 재요청한다 (평상시 추가 호출 0회, 실패 시 최대 +1회)
 *   · 막을 때는 이유를 문장으로 남긴다 — 조용히 죽지 않게
 *   · HUB_CHARTER_ENFORCE=false 로 끌 수 있다 (예약 발행이 새벽에 통째로 유실되는 상황 대비)
 *   · 단일 일관 모드(internal)에만 건다. 다른 모드는 허브가 아니다.
 */

/** 허브 헌장 판정 결과 */
export interface HubCharterVerdict {
  ok: boolean;
  /** 판정을 통과한 job 조각 (ok=false 면 빈 문자열) */
  job: string;
  /** 완성된 한 문장 (ok=false 면 빈 문자열) */
  sentence: string;
  /** 왜 사유로 인정되지 않는지 — 사람에게 그대로 보여줄 문장들 */
  violations: string[];
}

/** 허브가 연결하는 하위 콘텐츠 */
export interface HubSubContent {
  title: string;
  url?: string;
}

/** job 조각의 허용 길이 */
export const HUB_JOB_MIN_CHARS = 15;
export const HUB_JOB_MAX_CHARS = 120;

/**
 * 대상 표지 — "누구를 위한 허브인가".
 * 사람을 가리키는 말이 없으면 그 사유는 아직 주제 설명이지 존재 이유가 아니다.
 */
const AUDIENCE_MARKERS = [
  /[가-힣]{2,}\s*(?:하는|받은|당한|겪은|된|한)\s*(?:사람|분|가구|세대|사업자|근로자|임차인|임대인|보호자|환자|신청자|피해자)/,
  /(?:사람|분들|당사자|신청자|피해자|임차인|임대인|근로자|사업자|보호자|수급자|가입자|세대주|초보자|실수요자)(?:이|가|은|는|을|를|의|에게)?/,
  // "막" 은 단독 표지로 쓰지 않는다 — "차단막", "장막" 같은 말에 걸린다
  /(?:^|[\s"'(])(?:처음|이제)\s+[가-힣]{2,}/,
  /[가-힣]{2,}\s*(?:인|이던)\s*경우/,
  /[가-힣]{2,}\s*경우(?:에|의|를|는)?/,
];

/**
 * 판단·순서 표지 — "무엇이 해결되는가".
 * 허브가 요약이 아니라면, 독자는 이 글을 읽고 **무언가를 정하거나 순서를 잡아야** 한다.
 */
const RESOLUTION_MARKERS = [
  /시간순|순서|차례|단계|절차|흐름/,
  /무엇을|어느\s*것을|어디까지|언제까지|얼마나/,
  /판단|결정|선택|고르|구분|가르|비교/,
  /기준|조건|자격|해당하는지|되는지|하는지/,
  /확인|점검|대응|준비|신청해야|피해야/,
];

/** 장식어 — 이것만으로는 사유가 아니다 */
const DECORATION_ONLY = [
  '총정리', '완벽 가이드', '완벽가이드', 'a to z', 'a-z', '한눈에', '모든 것',
  '모두 정리', '핵심 정리', '종합 정리', '올인원', '총망라', '싹 정리',
];

/** 요약을 사유라고 우기는 표현 — 사장님이 명시적으로 배제한 것 */
const SUMMARY_CLAIMS = [
  '요약', '정리한 글', '모아둔', '모아 놓은', '한데 모', '묶어', '링크 모음',
];

function normalize(value: unknown): string {
  return String(value ?? '')
    .replace(/[​-‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 따옴표·머리표·마침표 같은 껍데기를 벗긴다 (AI 가 자주 붙여 보낸다) */
function stripWrapping(value: unknown): string {
  let out = normalize(value);
  out = out.replace(/^(?:job|사유|허브\s*사유|해결)\s*[:：]\s*/i, '');
  out = out.replace(/^["'“”‘’「」『』(\[]+/, '').replace(/["'“”‘’「」『』)\]]+$/, '');
  out = out.replace(/[.。]+$/, '');
  // "~를 해결한다" 를 통째로 써 보내면 틀과 겹친다 — 꼬리를 자른다
  out = out.replace(/(?:을|를)?\s*(?:해결한다|해결합니다|다룬다|다룹니다)$/, '');
  return out.trim();
}

function hits(patterns: RegExp[], text: string): boolean {
  return patterns.some((re) => re.test(text));
}

/**
 * 키워드를 빼고 남는 말이 있는지 — 키워드 + 조사/범용어뿐이면 제목의 다른 표기일 뿐이다.
 * generation.ts 의 isCtaTextEchoOfTitle 과 같은 취지다.
 */
function isKeywordEcho(job: string, keyword: string): boolean {
  const kw = normalize(keyword);
  if (!kw) return false;
  const stripped = job
    .split(/\s+/)
    .filter((token) => !kw.split(/\s+/).some((k) => k && token.includes(k)))
    .join(' ')
    .replace(/[은는이가을를의에도로와과만]/g, '')
    .trim();
  return stripped.length < 8;
}

/**
 * job 조각을 판정한다. LLM 호출 없음 — 규칙만 본다.
 */
export function validateHubJob(rawJob: unknown, params: { keyword: string; subCount: number }): HubCharterVerdict {
  const violations: string[] = [];
  const job = stripWrapping(rawJob);

  if (!job) {
    return {
      ok: false,
      job: '',
      sentence: '',
      violations: ['허브 사유가 비어 있습니다 (AI 가 한 문장을 만들지 못했습니다)'],
    };
  }

  if (job.length < HUB_JOB_MIN_CHARS) {
    violations.push(`사유가 너무 짧습니다 (${job.length}자) — 최소 ${HUB_JOB_MIN_CHARS}자는 되어야 무엇을 해결하는지가 담깁니다`);
  }
  if (job.length > HUB_JOB_MAX_CHARS) {
    violations.push(`사유가 한 문장을 넘어섭니다 (${job.length}자 > ${HUB_JOB_MAX_CHARS}자) — 한 문장으로 줄지 못하면 허브가 하나가 아닙니다`);
  }
  // 한 문장이어야 한다 — 중간에 문장이 끊기면 두 가지를 하겠다는 뜻이다
  if (/[.!?。][^\s]|[.!?。]\s+\S/.test(job)) {
    violations.push('사유가 두 문장 이상입니다 — 한 문장으로 설명되지 않으면 허브의 초점이 둘입니다');
  }

  const lower = job.toLowerCase();
  if (SUMMARY_CLAIMS.some((w) => job.includes(w))) {
    violations.push('사유가 "기존 글 요약/모음"에 머물러 있습니다 — 허브는 요약이 아니라 새로 해결하는 것이 있어야 합니다');
  }
  const decorationStripped = DECORATION_ONLY.reduce((acc, w) => acc.split(w).join(' '), lower).replace(/\s+/g, ' ').trim();
  if (decorationStripped.length < HUB_JOB_MIN_CHARS) {
    violations.push('사유가 장식어("총정리", "완벽 가이드" 등)뿐입니다 — 장식어를 빼면 남는 내용이 없습니다');
  }
  if (isKeywordEcho(job, params.keyword)) {
    violations.push(`사유가 키워드("${normalize(params.keyword)}")를 되풀이한 것뿐입니다 — 제목을 바꿔 쓴 것은 존재 이유가 아닙니다`);
  }
  if (!hits(AUDIENCE_MARKERS, job)) {
    violations.push('사유에 "누구를 위한 것인지"가 없습니다 — 대상(예: "낙찰받은 사람", "처음 신청하는 경우")을 넣어야 합니다');
  }
  if (!hits(RESOLUTION_MARKERS, job)) {
    violations.push('사유에 "무엇을 정하게 되는지"가 없습니다 — 순서·기준·판단·확인 중 하나가 담겨야 합니다');
  }

  if (violations.length > 0) {
    return { ok: false, job: '', sentence: '', violations };
  }

  return {
    ok: true,
    job,
    sentence: buildHubCharterSentence(job, params.subCount),
    violations: [],
  };
}

/** 헌장 한 문장을 조립한다 — 틀은 코드가 고정한다 */
export function buildHubCharterSentence(job: string, subCount: number): string {
  const n = Number.isFinite(subCount) && subCount > 0 ? subCount : 0;
  const link = n > 0 ? `${n}개의 하위 콘텐츠를 연결하지만` : '하위 콘텐츠를 연결하지만';
  return `이 허브는 ${link}, 기존 글의 요약이 아니라 "${job}"를 해결한다.`;
}

/**
 * job 을 만들라고 시키는 프롬프트. 출력은 한 줄뿐이라 토큰이 거의 안 든다.
 */
export function buildHubJobPrompt(params: {
  keyword: string;
  subContents: HubSubContent[];
  previousViolations?: string[];
}): string {
  const titles = (params.subContents || [])
    .map((s) => normalize(s?.title))
    .filter(Boolean)
    .slice(0, 12);

  const retryBlock = params.previousViolations?.length
    ? `\n\n[직전 시도가 반려된 이유 — 같은 실수를 반복하지 마세요]\n${params.previousViolations.map((v) => `- ${v}`).join('\n')}`
    : '';

  return `당신은 콘텐츠 허브를 설계합니다.

주제 키워드: "${normalize(params.keyword)}"
이 허브가 연결할 기존 글 ${titles.length}개:
${titles.length ? titles.map((t) => `- ${t}`).join('\n') : '- (아직 없음 — 이 허브가 첫 글입니다)'}

[할 일]
이 허브가 **왜 따로 존재해야 하는지**를 한 조각으로 적으세요.
위 글들의 요약이어서는 안 됩니다. 위 글을 다 읽어도 여전히 안 풀리는 것을 적어야 합니다.

[출력 형식 — 아래 한 줄만, 다른 말 금지]
JOB: <한 조각>

[한 조각이 반드시 갖춰야 할 것]
1. 대상 — 누구를 위한 것인가 (예: "전세사기 피해주택을 낙찰받은 사람이", "처음 신청하는 경우")
2. 결정 — 그 사람이 무엇을 정하거나 확인하게 되는가
   (순서 / 기준 / 판단 / 확인 / 절차 중 하나가 실제 단어로 들어가야 합니다)
3. 길이 ${HUB_JOB_MIN_CHARS}~${HUB_JOB_MAX_CHARS}자, 문장 하나, 마침표 없이

[좋은 예]
JOB: 전세사기 피해주택을 낙찰받은 사람이 시간순으로 무엇을 확인해야 하는지

[나쁜 예 — 전부 반려됩니다]
JOB: ${normalize(params.keyword)} 총정리        ← 장식어뿐, 대상도 결정도 없음
JOB: ${normalize(params.keyword)}에 대한 모든 정보  ← 키워드 되풀이
JOB: 위 글들을 요약해 한눈에 보여주는 것        ← 요약은 존재 이유가 아님${retryBlock}`;
}

/** LLM 응답에서 JOB 한 줄만 뽑는다 */
export function parseHubJob(raw: unknown): string {
  const text = String(raw ?? '');
  const match = text.match(/JOB\s*[:：]\s*(.+)/i);
  if (match) return stripWrapping(match[1] ?? '');
  // 형식을 안 지켰으면 첫 비어 있지 않은 줄을 쓴다 (한 줄짜리 답이 흔하다)
  const firstLine = text.split(/\r?\n/).map((l) => l.trim()).find(Boolean) || '';
  return stripWrapping(firstLine);
}

/**
 * 통과한 헌장을 본문 생성 프롬프트에 싣는다.
 * 게이트가 통과만 시키고 끝나면 글은 그대로다 — 사유가 본문을 실제로 바꾸게 해야 한다.
 */
export function buildHubCharterBlock(verdict: HubCharterVerdict, subContents: HubSubContent[]): string {
  if (!verdict.ok || !verdict.sentence) return '';
  const titles = (subContents || []).map((s) => normalize(s?.title)).filter(Boolean).slice(0, 12);

  return `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧭 **[허브 헌장 — 이 글이 존재하는 이유]**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${verdict.sentence}

이 문장이 이 글의 계약입니다. 다음을 지키세요:

1. **모든 섹션은 위 문장이 약속한 것에 기여해야 합니다.** 기여하지 않는 섹션은 쓰지 마세요.
2. **아래 기존 글의 내용을 다시 설명하지 마세요.** 필요하면 한 줄로 가리키고 넘어갑니다.
${titles.length ? titles.map((t) => `   · ${t}`).join('\n') : '   · (연결할 기존 글 없음)'}
3. **약속한 대상이 실제로 등장해야 합니다.** "일반적으로"로 뭉개면 허브가 아니라 개요글이 됩니다.
4. 결론부에서 위 문장이 약속한 것을 실제로 해결했는지 독자가 확인할 수 있어야 합니다.
`;
}

/** 차단 메시지 — 왜 막혔는지 사람이 읽고 바로 고칠 수 있게 */
export function formatHubCharterBlockMessage(keyword: string, violations: string[]): string {
  return [
    `🧭 허브 발행 중단 — "${normalize(keyword)}" 의 존재 이유를 한 문장으로 세우지 못했습니다.`,
    '',
    ...violations.map((v) => `  · ${v}`),
    '',
    '단일 일관 모드는 허브글을 만듭니다. 허브가 왜 따로 있어야 하는지 한 문장으로 설명되지 않으면',
    '그 글은 기존 글의 요약이 되고, 검색엔진은 같은 사이트의 중복으로 처리합니다.',
    '',
    '키워드를 더 좁게(대상·상황을 특정해서) 다시 시도해 보세요.',
    '이 게이트를 끄려면 .env 에 HUB_CHARTER_ENFORCE=false 를 넣으세요.',
  ].join('\n');
}

/** 게이트를 실제로 걸지 여부 — 기본 ON, env 로만 끈다 */
export function isHubCharterEnforced(env: Record<string, any> | undefined, payload?: Record<string, any>): boolean {
  const fromPayload = payload?.['hubCharterEnforce'];
  if (fromPayload === false) return false;
  const raw = String(env?.['HUB_CHARTER_ENFORCE'] ?? '').trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'off' || raw === 'no') return false;
  return true;
}
