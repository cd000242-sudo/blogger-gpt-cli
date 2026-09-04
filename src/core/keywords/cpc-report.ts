/**
 * 📥 고CPC 키워드 리포트 읽기 (v3.8.631)
 *
 * ## 왜 만들었나
 * 사장님은 매일 별도 파이프라인으로 「YYYY-MM-DD 고CPC 키워드 리포트」를 만든다.
 * 슬롯별 키워드·확정 제목·롱테일 파생·발행 전 확인 필요·참고 URL 이 다 들어 있는
 * 아주 좋은 재료다. 그런데 **앱이 그걸 안 읽고 있었다.**
 *
 * 실측 2026-09-04: 그날 리포트가 슬롯 A 로 뽑은 것이 그날 발행된 글과 같은 제목인데,
 * 리포트가 "발행 전 확인 필요" 로 적어 둔 5개와 "롱테일 파생" 3개 중
 * **글에 반영된 것은 2개뿐이었다.**
 *   · 지침 정식 명칭 확인 → ❌ (그래서 근거 조항 0건)
 *   · 'N%' 가 원문 문구인지 확인 → ❌ (확인 없이 31회 사용)
 *   · "시행령이 아니라 해석지침 보완" 형식 설명 → ❌
 *   · 롱테일 3개 중 2개 누락 → 그래서 같은 원칙을 다섯 번 돌려 말했다
 *
 * 재료가 없어서 글이 얕았던 게 아니다. **최고급 재료를 만들어 놓고 안 썼다.**
 *
 * ## 이 파일이 하는 일
 * 리포트 마크다운을 읽어 발행에 쓸 것만 뽑는다. 판단은 하지 않는다 —
 * 뽑아서 넘기면 프롬프트와 검사기가 쓴다.
 *
 * ## 사생활
 * 리포트가 어디 있는지는 **이 코드가 모른다.** 폴더 경로는 사장님 로컬 설정에만
 * 있고, 설정이 없으면 기능 자체가 켜지지 않는다. 실행파일 안에 경로도 계정도
 * 남기지 않기 위해서다(asar 은 누구나 열 수 있다).
 */

export interface CpcSlot {
  /** 'A' | 'B' | 'C' — 슬롯 이름 그대로 */
  slot: string;
  /** 슬롯 성격 (시의성·디스커버형 등) */
  label: string;
  /** 이 슬롯의 키워드 한 줄 */
  keyword: string;
  /** 확정 제목. 없으면 빈 문자열 */
  title: string;
  /** 등급 줄 (예: "A (종합 10)") */
  grade: string;
  /** 소제목 재료가 되는 롱테일 파생 */
  longtails: string[];
  /** 발행 전에 반드시 확인·반영할 것 */
  mustCheck: string[];
  /** 어느 플랫폼에 낼 것인가 (워드프레스·티스토리) */
  track: string;
  /** 미확보 슬롯이면 true — 오늘은 이 슬롯을 안 쓴다 */
  empty: boolean;
}

export interface CpcReport {
  /** 리포트 날짜 (YYYY-MM-DD) */
  date: string;
  slots: CpcSlot[];
  /** 본문 재료로 쓸 참고 URL */
  urls: string[];
}

/** "# 슬롯 A - ..." 로 시작하는 덩어리로 자른다 */
const SLOT_HEAD = /^#\s*슬롯\s*([A-Z])\s*[-–—]?\s*(.*)$/gm;

/** 마크다운 강조·목록 기호를 걷어 사람이 읽는 한 줄로 */
function clean(line: string): string {
  return String(line || '')
    .replace(/\*\*/g, '')
    .replace(/^\s*[-*•]\s*/, '')
    .replace(/^\s*\d+[.)]\s*/, '')
    .replace(/^\s*★\s*/, '')
    .replace(/\\\[|\\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * `##### 제목` 같은 소제목 아래의 목록 항목을 모은다.
 * 다음 소제목(#)이 나오면 멈춘다 — 고정 길이로 자르면 다음 절을 먹는다.
 */
function itemsUnder(block: string, headingPattern: RegExp): string[] {
  const lines = block.split('\n');
  const start = lines.findIndex((l) => headingPattern.test(l));
  if (start === -1) return [];
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^#{1,6}\s/.test(line)) break;                  // 다음 절
    if (!/^\s*(?:[-*•]|\d+[.)])\s+/.test(line)) continue; // 목록 항목만
    const text = clean(line);
    if (text) out.push(text);
  }
  return out;
}

/** 한 줄짜리 값 — "**등급: A (종합 10)**" 같은 것 */
function valueOf(block: string, label: string): string {
  const re = new RegExp('^\\s*\\*{0,2}' + label + '\\*{0,2}\\s*[:：]\\s*(.+)$', 'm');
  const m = block.match(re);
  return m ? clean(m[1]!) : '';
}

/** 확정 제목 — "**확정 (46자):** 「...」" 꼴에서 낫표 안을 꺼낸다 */
function confirmedTitle(block: string): string {
  const m = block.match(/확정[^:：\n]*[:：][^「」\n]*「([^」]+)」/);
  if (m) return clean(m[1]!);
  // 낫표가 없는 경우 — 콜론 뒤 전부
  const alt = block.match(/^\s*[-*•]?\s*\*{0,2}확정\b[^:：\n]*[:：]\s*(.+)$/m);
  return alt ? clean(alt[1]!).replace(/^「|」$/g, '') : '';
}

/**
 * 역이스케이프 — 구글 문서에서 내보낸 백업은 마크다운 기호가 전부 탈출돼 있다.
 * 실측: `\# 슬롯 A`, `\*\*등급:\*\*`, `1\.` 꼴이라 그대로 두면 제목을 하나도 못 찾는다.
 */
export function unescapeMarkdown(text: string): string {
  return String(text || '').replace(/\\([#*_[\]()~`>+\-.!|\\])/g, '$1');
}

export function parseCpcReport(markdown: string): CpcReport {
  const src = unescapeMarkdown(String(markdown || ''));
  const date = (src.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || '';

  // 슬롯 경계를 실제 위치로 잡는다 — 이어 붙이면 원본을 빈틈없이 덮는다
  const heads: { at: number; slot: string; label: string }[] = [];
  SLOT_HEAD.lastIndex = 0;
  for (let m = SLOT_HEAD.exec(src); m; m = SLOT_HEAD.exec(src)) {
    heads.push({ at: m.index, slot: m[1]!, label: clean(m[2] || '') });
  }

  const slots: CpcSlot[] = heads.map((head, i) => {
    const to = i + 1 < heads.length ? heads[i + 1]!.at : src.length;
    const block = src.slice(head.at, to);
    const 미확보 = /미확보|배정 불가|슬롯 [A-Z][^\n]*미확보/.test(block.split('\n').slice(0, 3).join(' '));

    return {
      slot: head.slot,
      label: head.label.replace(/[:：].*$/, '').trim(),
      keyword: valueOf(block, '키워드') || clean((block.match(/^##\s*키워드\s*[:：]\s*(.+)$/m) || [])[1] || ''),
      title: confirmedTitle(block),
      grade: valueOf(block, '등급'),
      longtails: itemsUnder(block, /^#{2,6}\s*롱테일\s*파생/),
      mustCheck: itemsUnder(block, /^#{2,6}\s*발행\s*전\s*확인\s*필요/),
      track: (block.match(/배정\s*트랙\s*[:：]\s*([^\n*]+)/) || [])[1]?.trim() || '',
      empty: 미확보,
    };
  });

  const urls = [...new Set(
    (src.match(/https?:\/\/[^\s<>()「」\]]+/g) || []).map((u) => u.replace(/[.,]+$/, '')),
  )];

  return { date, slots, urls };
}

/** 오늘 쓸 슬롯만 — 미확보는 뺀다 */
export function usableSlots(report: CpcReport): CpcSlot[] {
  return report.slots.filter((s) => !s.empty && (s.keyword || s.title));
}

/**
 * 리포트를 프롬프트에 실을 지시문으로 만든다.
 *
 * "참고하라" 고만 하면 모델은 요약하고 버린다(근거 장부에서 겪은 것과 같다).
 * 그래서 **무엇을 반드시 넣어야 하는지**를 항목으로 못박는다.
 */
export function buildReportDirective(slot: CpcSlot, urls: string[] = []): string {
  if (!slot) return '';
  const lines: string[] = [
    '',
    '## 📥 오늘의 키워드 리포트 — 이 글의 설계도입니다',
    '',
    `**키워드**: ${slot.keyword || '(없음)'}`,
  ];

  if (slot.title) {
    lines.push(`**확정 제목**: ${slot.title}`);
    lines.push('   이 제목은 이미 검색 경쟁을 재고 고른 것입니다. 그대로 쓰세요.');
  }

  if (slot.longtails.length) {
    lines.push('', '**이 세 가지를 반드시 각각의 구간으로 다룹니다.** 소제목 재료입니다.');
    lines.push('   빠뜨리면 같은 원칙을 여러 번 돌려 말하게 되고, 그게 독자가 나가는 이유입니다.');
    for (const t of slot.longtails) lines.push(`   · ${t}`);
  }

  if (slot.mustCheck.length) {
    lines.push('', '**발행 전 반드시 확인하고 본문에 반영할 것**');
    lines.push('   확인 못 한 것은 쓰지 않습니다. 지어내면 안 됩니다.');
    for (const c of slot.mustCheck) lines.push(`   · ${c}`);
  }

  if (urls.length) {
    lines.push('', '**출처 — 여기부터 읽고 씁니다.** 숫자와 명칭은 여기서 그대로 옮깁니다.');
    for (const u of urls.slice(0, 12)) lines.push(`   · ${u}`);
  }

  lines.push('');
  return lines.join('\n');
}

/* ────────────────────────────────────────────────────────────────
 * 리포트가 시킨 것을 글이 지켰는가
 *
 * 실측 2026-09-04: 리포트가 롱테일 3개와 확인 항목 5개를 적어 줬는데
 * 발행된 글에는 **2개만** 들어갔다. 지시를 주는 것만으로는 부족하다 —
 * 지켰는지 재야 한다.
 * ──────────────────────────────────────────────────────────────── */

export interface ReportCompliance {
  /** 본문에서 확인된 롱테일 */
  coveredLongtails: string[];
  /** 빠진 롱테일 */
  missingLongtails: string[];
  /** 확인하라고 했는데 흔적이 없는 항목 */
  missingChecks: string[];
}

/** 지시문에서 실제로 찾아볼 낱말을 뽑는다 — 조사·수식어를 걷어낸 명사 위주 */
function keyTerms(instruction: string): string[] {
  return String(instruction || '')
    .replace(/[「」'"(),.·\-—…★]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/(?:을|를|이|가|은|는|의|에|로|으로|와|과|도|만|까지|부터)$/, ''))
    .filter((w) => w.length >= 2 && !/^(확인할|확인|반드시|본문에|넣을|것|경우|여부|지점|위해|대한|따른|그리고|하는|되는|있는)$/.test(w))
    .slice(0, 6);
}

/**
 * 지시 하나가 본문에 반영됐는지 — 핵심 낱말의 과반이 보이면 다뤘다고 본다.
 *
 * 완전 일치를 요구하면 표현만 바꿔 써도 "빠뜨렸다"가 된다.
 * 반대로 한 낱말만 봐도 되면 스치듯 언급한 것을 다뤘다고 오인한다.
 * 과반이 절충점이다.
 */
export function instructionCovered(instruction: string, bodyText: string): boolean {
  const terms = keyTerms(instruction);
  if (terms.length === 0) return true;   // 판정할 근거가 없으면 통과시킨다
  const body = String(bodyText || '');
  const hits = terms.filter((t) => body.includes(t)).length;
  return hits * 2 >= terms.length;
}

export function checkReportCompliance(slot: CpcSlot, bodyText: string): ReportCompliance {
  const covered: string[] = [];
  const missing: string[] = [];
  for (const t of slot?.longtails || []) {
    (instructionCovered(t, bodyText) ? covered : missing).push(t);
  }
  const missingChecks = (slot?.mustCheck || []).filter((c) => !instructionCovered(c, bodyText));
  return { coveredLongtails: covered, missingLongtails: missing, missingChecks };
}
