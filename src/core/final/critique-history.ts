/**
 * critique-history — 비평은 **지난번에 무엇을 지적했는지 기억한다.** (v3.8.622)
 *
 * ## 사장님 요청
 * "고쳤으면 결과도 모달에 보여줘야 또 비평 개선버튼 눌러서 비평시켜서
 *  새롭게 나온 것들은 왜 나왔는지 수긍이 될 거 아냐"
 *
 * ## 무엇이 문제였나
 * 비평은 매번 **백지에서** 시작했다. 진료기록 없는 의사가 매번 새로 보는 셈이라,
 * 고친 뒤 다시 눌러도 처음 보는 지적이 또 나왔고 사장님은 그게 왜 나왔는지 알 수 없었다.
 * AI 지적의 id 는 `ai-0`, `ai-1` 같은 **순번**이라 회차가 달라지면 같은 문제도 다른 항목이 됐다.
 *
 * ## 그래서
 * ① 지적마다 **내용으로 만든 이름표**를 붙인다 — 회차가 바뀌어도 같은 문제는 같은 이름표.
 * ② 회차를 기록한다 — 무엇이 나왔고, 사장님이 무엇을 골랐고, 어느 구간이 실제로 고쳐졌는지.
 * ③ 다음 비평에서 각 지적에 **왜 지금 나왔는지**를 붙인다:
 *    처음 나온 것 · 지난번에도 나왔지만 안 고른 것 · 고쳤는데 다시 나온 것 ·
 *    **직전에 다시 쓴 구간에서 새로 생긴 것**(개선이 만든 부작용이라 가장 중요하다).
 *
 * ## 절대 원칙
 * 이 모듈은 예외를 던지지 않는다. 기록이 깨져 있으면 기록이 없는 것으로 친다.
 * 이력을 못 읽었다고 비평이 멈추면 안 된다.
 */

import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export type IssueStatus = 'new' | 'again' | 'regressed' | 'side-effect';

export interface HistoryIssueLike {
  id?: string;
  area?: string;
  title?: string;
  evidence?: string;
  origin?: string;
  sectionIndex?: number;
}

/** 한 회차에 무슨 일이 있었나 */
export interface CritiqueRound {
  /** ISO 시각 */
  at: string;
  score: number;
  /** 이번 비평에서 나온 지적들의 이름표 */
  raised: string[];
  /** 사장님이 골라서 실제로 수정발행한 지적들의 이름표 */
  applied: string[];
  /** 실제로 다시 쓴 구간 번호 */
  revisedSections: number[];
  /** 규칙에 걸려 원본을 그대로 둔 구간 ("소제목: 사유") */
  skipped: string[];
  /**
   * 이름표 → 그때의 지적 제목.
   *
   * 이름표는 사람도 AI 도 읽을 수 없는 해시다. 다음 비평 프롬프트에
   * "이건 이미 고쳤으니 다시 말하지 마세요"라고 적어주려면 **그때의 문장**이 필요한데,
   * 고쳐진 지적은 이번 화면에 없으므로 지금 남겨두지 않으면 영영 되살릴 수 없다.
   */
  titles?: Record<string, string>;
}

export interface PostHistory {
  postId: string;
  rounds: CritiqueRound[];
}

export type HistoryFile = Record<string, PostHistory>;

/** 회차를 무한정 쌓지 않는다 — 최근 12회면 "왜 나왔나"를 설명하기에 충분하다 */
const MAX_ROUNDS = 12;

/**
 * 지적의 이름표. **회차가 달라도 같은 문제면 같은 값**이 나와야 한다.
 *
 * 코드 진단은 이미 고정된 id 를 쓰므로(`substance-facts` 등) 그대로 쓴다.
 * AI 지적만 순번이라 쓸 수 없어서, 제목과 근거 문장 앞부분으로 지문을 만든다.
 * 근거 문장 전체를 쓰지 않는 이유 — 한 글자만 달라져도 다른 항목이 되어 버린다.
 */
export function stableIssueId(issue: HistoryIssueLike): string {
  const rawId = String(issue?.id || '').trim();
  if (rawId && !/^ai-\d+$/.test(rawId)) return rawId;

  const title = String(issue?.title || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const evidence = String(issue?.evidence || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 60);
  const digest = createHash('sha1').update(`${title}\n${evidence}`).digest('hex').slice(0, 10);
  return `ai:${digest}`;
}

// ─────────────────────────────────────────────────────────────
// 파일 읽고 쓰기 — 깨져 있으면 없는 것으로 친다
// ─────────────────────────────────────────────────────────────

export function loadHistoryFile(filePath: string): HistoryFile {
  try {
    if (!fs.existsSync(filePath)) return {};
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as HistoryFile;
  } catch {
    return {};
  }
}

export function saveHistoryFile(filePath: string, data: HistoryFile): boolean {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

export function historyOf(file: HistoryFile, postId: string): PostHistory {
  const key = String(postId || '').trim();
  const found = file[key];
  if (!found || !Array.isArray(found.rounds)) return { postId: key, rounds: [] };
  return { postId: key, rounds: found.rounds.filter((r) => r && typeof r === 'object') };
}

/**
 * 이번 비평에서 나온 지적을 기록한다. **아직 고친 것은 없다** — applied 는 비어 있다.
 * 같은 회차에 사장님이 수정발행하면 `recordApplied` 가 이 회차를 채운다.
 */
export function recordRaised(
  file: HistoryFile,
  postId: string,
  input: { score: number; issues: HistoryIssueLike[]; at?: string },
): HistoryFile {
  const key = String(postId || '').trim();
  if (!key) return file;
  const prev = historyOf(file, key);
  const titles: Record<string, string> = {};
  for (const issue of input.issues || []) {
    const title = String(issue?.title || '').trim();
    if (title) titles[stableIssueId(issue)] = title.slice(0, 120);
  }
  const round: CritiqueRound = {
    at: input.at || new Date().toISOString(),
    score: Number(input.score) || 0,
    raised: (input.issues || []).map(stableIssueId),
    applied: [],
    revisedSections: [],
    skipped: [],
    titles,
  };
  return {
    ...file,
    [key]: { postId: key, rounds: [...prev.rounds, round].slice(-MAX_ROUNDS) },
  };
}

/**
 * 수정발행 결과를 **가장 최근 회차에** 붙인다.
 *
 * 새 회차를 만들지 않는 이유 — 비평과 개선은 한 번의 작업이다. 따로 쌓으면
 * "지적 회차"와 "개선 회차"가 번갈아 끼어 이력을 읽기 어려워진다.
 * 최근 회차가 없으면(기록이 유실됐으면) 개선 사실만 담은 회차를 새로 만든다.
 */
export function recordApplied(
  file: HistoryFile,
  postId: string,
  input: { issues: HistoryIssueLike[]; revisedSections: number[]; skipped: string[]; at?: string },
): HistoryFile {
  const key = String(postId || '').trim();
  if (!key) return file;
  const prev = historyOf(file, key);
  const applied = (input.issues || []).map(stableIssueId);
  // 고른 지적의 제목도 남긴다 — 비평 회차가 유실됐거나 손으로 고른 항목이 섞여도 되살릴 수 있게
  const titles: Record<string, string> = {};
  for (const issue of input.issues || []) {
    const title = String(issue?.title || '').trim();
    if (title) titles[stableIssueId(issue)] = title.slice(0, 120);
  }
  const patch = {
    applied,
    revisedSections: (input.revisedSections || []).map((n) => Number(n)).filter((n) => Number.isInteger(n)),
    skipped: (input.skipped || []).map((s) => String(s)),
  };

  if (prev.rounds.length === 0) {
    const round: CritiqueRound = { at: input.at || new Date().toISOString(), score: 0, raised: applied, ...patch, titles };
    return { ...file, [key]: { postId: key, rounds: [round] } };
  }

  const rounds = prev.rounds.map((round, i) =>
    i === prev.rounds.length - 1 ? { ...round, ...patch, titles: { ...(round.titles || {}), ...titles } } : round,
  );
  return { ...file, [key]: { postId: key, rounds } };
}

// ─────────────────────────────────────────────────────────────
// "왜 지금 나왔나" 를 붙인다
// ─────────────────────────────────────────────────────────────

export interface IssueProvenance {
  /** 이름표 */
  key: string;
  status: IssueStatus;
  /** 화면에 그대로 띄우는 한 줄 */
  statusNote: string;
  /** 이 지적이 몇 번째로 나온 것인가 (이번 회차 포함) */
  seenCount: number;
}

const ymd = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

/** 어느 지적에나 나오는 말 — 겹쳐도 같은 지적이라는 근거가 못 된다 */
const FILLER_WORDS = new Set([
  '본문', '문장', '문단', '구간', '부분', '내용', '설명', '정보', '독자',
  '없습니다', '있습니다', '않습니다', '합니다', '됩니다', '보입니다', '입니다', '필요합니다',
  '없음', '있음', '부족', '필요', '누락', '빠져', '빠짐',
]);

/** 붙은 조사를 떼어 "기한이"·"기한" 이 같은 낱말로 잡히게 */
const PARTICLE = /(에서는|에서도|으로는|에서|에도|으로|이라|이나|까지|부터|처럼|보다|만|도|은|는|이|가|을|를|의|에|와|과|로)$/;
const stem = (w: string): string => {
  const cut = w.replace(PARTICLE, '');
  return cut.length >= 2 ? cut : w;
};

/** 제목을 낱말 집합으로 — 조사를 떼고, 어디에나 나오는 말은 뺀다 */
const wordsOf = (text: string): Set<string> => {
  const out = new Set<string>();
  for (const raw of String(text || '').toLowerCase().match(/[가-힣]{2,}|[a-z]{3,}|\d+/g) || []) {
    const w = stem(raw);
    if (!FILLER_WORDS.has(w) && !FILLER_WORDS.has(raw)) out.add(w);
  }
  return out;
};

/**
 * 두 지적 제목이 **같은 말을 다르게 한 것**인가.
 *
 * 이름표는 제목이 한 글자만 달라도 갈라진다. AI 는 같은 지적을 매번 조금씩 다르게 쓰므로
 * ("신청 기한이 없습니다" ↔ "신청 마감일이 본문에 빠져 있습니다") 이름표만 믿으면
 * 고친 지적이 "새 지적"으로 둔갑한다. 낱말이 절반 넘게 겹치면 같은 지적으로 본다.
 */
export function similarTitles(a: string, b: string): boolean {
  const x = wordsOf(a);
  const y = wordsOf(b);
  if (x.size === 0 || y.size === 0) return false;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared += 1;
  const smaller = Math.min(x.size, y.size);
  return shared / smaller >= 0.5 && shared >= 2;
}

/** 고쳐서 발행한 지적 중 이 제목과 같은 말을 한 것이 있으면 그 회차와 그때 제목 */
function appliedLookalike(
  title: string,
  rounds: CritiqueRound[],
): { round: CritiqueRound; title: string } | null {
  for (let i = rounds.length - 1; i >= 0; i -= 1) {
    const round = rounds[i]!;
    for (const key of round.applied || []) {
      const then = round.titles?.[key] || '';
      if (then && similarTitles(then, title)) return { round, title: then };
    }
  }
  return null;
}

/**
 * 지적 하나가 왜 지금 나왔는지 판정한다.
 *
 * 판정 순서가 곧 사장님이 궁금해하는 순서다:
 *   ① 고쳤는데 또 나왔나(regressed) — 가장 먼저 알아야 할 것
 *   ② 직전에 다시 쓴 구간에서 새로 생겼나(side-effect) — 개선이 만든 부작용
 *   ③ 지난번에도 나왔는데 안 골랐나(again)
 *   ④ 처음 나왔나(new)
 */
export function provenanceOf(issue: HistoryIssueLike, history: PostHistory): IssueProvenance {
  const key = stableIssueId(issue);
  const rounds = history?.rounds || [];
  const seenCount = rounds.filter((r) => (r.raised || []).includes(key)).length + 1;

  // 이 지적을 고쳐서 발행한 적이 있는가 — 가장 최근 것
  let appliedRound: CritiqueRound | null = null;
  for (let i = rounds.length - 1; i >= 0; i -= 1) {
    if ((rounds[i]!.applied || []).includes(key)) { appliedRound = rounds[i]!; break; }
  }
  if (appliedRound) {
    const when = ymd(appliedRound.at);
    const section = Number(issue?.sectionIndex);
    const touched = Number.isInteger(section) && section >= 0
      && (appliedRound.revisedSections || []).includes(section);
    return {
      key,
      seenCount,
      status: 'regressed',
      statusNote: touched
        ? `${when} 에 이 구간을 고쳐서 발행했는데 또 잡혔습니다. 고쳐 쓴 문장이 같은 문제를 남긴 것입니다.`
        : `${when} 에 고치기로 고르셨지만 그 구간은 규칙에 걸려 원본 그대로 뒀습니다. 그래서 그대로 남아 있습니다.`,
    };
  }

  // 이름표는 다르지만 같은 말을 한 지적을 고친 적이 있는가 — AI 가 말만 바꿔 온 경우
  const lookalike = appliedLookalike(String(issue?.title || ''), rounds);
  if (lookalike) {
    return {
      key,
      seenCount,
      status: 'regressed',
      statusNote: `${ymd(lookalike.round.at)} 에 고친 "${lookalike.title}" 과 같은 지적으로 보입니다 (말만 다릅니다). 근거 문장을 보고 정말 남아 있는지 판단하세요.`,
    };
  }

  const raisedBefore = rounds.some((r) => (r.raised || []).includes(key));
  if (raisedBefore) {
    return {
      key,
      seenCount,
      status: 'again',
      statusNote: `지난 비평에도 나왔지만 고칠 항목으로 고르지 않으셨습니다 (${seenCount}회째).`,
    };
  }

  // 직전 회차에서 다시 쓴 구간에 새로 생긴 지적인가
  const last = rounds[rounds.length - 1];
  const section = Number(issue?.sectionIndex);
  if (last && (last.revisedSections || []).length > 0
      && Number.isInteger(section) && section >= 0
      && last.revisedSections.includes(section)) {
    return {
      key,
      seenCount,
      status: 'side-effect',
      statusNote: `${ymd(last.at)} 개선에서 다시 쓴 구간입니다. 그때 고쳐 쓴 문장에서 새로 생긴 지적입니다.`,
    };
  }

  return {
    key,
    seenCount,
    status: 'new',
    statusNote: rounds.length === 0
      ? '이 글의 첫 비평입니다.'
      : '이번에 처음 나온 지적입니다. 앞선 비평에서는 걸리지 않았습니다.',
  };
}

/** 지적 목록 전체에 판정을 붙인다 */
export function annotateIssues<T extends HistoryIssueLike>(issues: T[], history: PostHistory): (T & IssueProvenance)[] {
  return (issues || []).map((issue) => ({ ...issue, ...provenanceOf(issue, history) }));
}

/**
 * 다음 비평 프롬프트에 넣을 "이미 고친 것" 목록.
 *
 * AI 에게 이걸 안 주면 **고친 문제를 말만 바꿔 다시 지적한다.**
 * 이름표는 사람이 읽을 수 없으므로 그때의 제목을 같이 남겨 둔다.
 */
export function resolvedTitles(history: PostHistory): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const round of history?.rounds || []) {
    for (const key of round.applied || []) {
      if (seen.has(key)) continue;
      seen.add(key);
      // 제목은 그 지적이 처음 나온 회차에 적혀 있다 — 최근 회차부터 거슬러 찾는다
      const rounds = history.rounds;
      for (let i = rounds.length - 1; i >= 0; i -= 1) {
        const title = rounds[i]?.titles?.[key];
        if (title) { out.push(title); break; }
      }
    }
  }
  return out.slice(0, 20);
}
