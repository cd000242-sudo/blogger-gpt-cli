/**
 * 🕳️ 빈 절 관문 (v3.8.739) — 결정적 구조 검사. Critic 보다 먼저, 코드가 잡는다.
 *
 * ## 왜
 * live 실측(2026-09-22, 주담대 금리 7%): 초안 S06 "주담대 상환부담 계산" 이 소제목만 있고 content 가 "" 였다.
 * Critic 1 은 MISSING_INFORMATION 으로 정확히 봤지만 인용할 본문 구절이 없어(제목뿐) 규칙대로 MINOR 로 내려갔고,
 * 조립 단계의 옛 정리("본문이 빈 절을 뺐습니다")가 그 절을 지워 검색 의도("7억 이자 부담 계산")의 답이 빠진 채 AUTO_PUBLISH 됐다.
 *
 * ## 규칙
 *   · 빈 절 = 소제목은 있는데 본문이 사실상 없음(빈 문자열 · 공백 · 태그만 · 자리표시자만). 표가 있으면 비어 있지 않다.
 *   · **핵심 절**(검색 질문에 답하는 절 · 제목 약속과 겹치는 절 · 실 질문과 겹치는 절)은 지우지 않는다 → 그 절만 다시 채운다(REPAIR).
 *   · 선택 절(위 어디에도 안 걸리는 빈 절)은 지워도 잃는 정보가 없다 → 지운다(REMOVE). 조건은 이 둘뿐.
 *   · 수리는 글 전체를 다시 쓰지 않는다 — 그 절의 content 만. 값은 Research Packet·근거에 있는 것만.
 *   · 수리 뒤 코드가 다시 잰다: 본문 길이 · 값 대조(fact-claims) · 검색 질문 답 여부. 하나라도 못 지나면 **미해결 → 관문 FAIL → MANUAL_REVIEW**.
 *   · exactSpan 을 요구하지 않는다. 결정적 지적이다.
 */

import { checkClaims, type LedgerItem } from './fact-claims';
import { distinctiveTokens } from './evidence';
import { readJson } from './critique-loop';

export interface EmptyFinding {
  sectionIndex: number;
  h2: string;
  emptyH3Indexes: number[];
  h3Titles: string[];
  core: boolean;
  /** 왜 핵심 절로 봤는가 (없으면 선택 절) */
  coreReason: string;
  answersTo: string;
}

export interface EmptySectionResult {
  findings: EmptyFinding[];
  repaired: Array<{ sectionIndex: number; h2: string; chars: number }>;
  removed: Array<{ sectionIndex: number; h2: string }>;
  /** 수리에 실패한 핵심 절 — 하나라도 있으면 EMPTY_SECTION_PASS = false */
  unresolved: Array<{ sectionIndex: number; h2: string; reason: string }>;
  calls: number;
}

const MIN_BODY_CHARS = 30;
const MIN_REPAIRED_CHARS = 80;

const bodyText = (html: string): string => String(html || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/** 자리표시자만 있는 본문 — "내용 없음", "TBD", "…", "-" 같은 것 */
const PLACEHOLDER_RE = /^(?:\(?\s*(?:내용\s*없음|작성\s*예정|추후\s*작성|준비\s*중|TBD|TODO|N\/A|없음)\s*\)?|[.…\-–—_ ]+)$/i;

export function isEmptyContent(html: string, tables?: any[]): boolean {
  if (Array.isArray(tables) && tables.length > 0) return false;
  const text = bodyText(html);
  if (text.replace(/\s/g, '').length < MIN_BODY_CHARS) return true;
  return PLACEHOLDER_RE.test(text);
}

const tokens = (s: string): string[] => distinctiveTokens(String(s || ''));
const overlaps = (a: string, b: string): boolean => {
  const tb = new Set(tokens(b));
  return tokens(a).some((t) => tb.has(t));
};

/**
 * 핵심 절 판정 — 셋 중 하나면 핵심. 어디에도 안 걸리면 선택 절.
 *   ① 검색 질문에 답하는 절(answersTo) ② 제목의 낱말과 겹치는 소제목 ③ 실 질문(intentQuestions)과 겹치는 소제목
 */
export function isCoreSection(section: any, title: string, intentQuestions: string[]): { core: boolean; reason: string } {
  const answersTo = String(section?.answersTo || '').trim();
  if (answersTo) return { core: true, reason: `검색 질문에 답하는 절: "${answersTo.slice(0, 40)}"` };
  const h2 = String(section?.h2 || '');
  if (overlaps(h2, title)) return { core: true, reason: '제목 약속과 겹치는 소제목' };
  const q = intentQuestions.find((x) => x && overlaps(h2, x));
  if (q) return { core: true, reason: `검색 의도와 겹치는 소제목: "${q.slice(0, 40)}"` };
  return { core: false, reason: '' };
}

export function findEmptySections(article: any, title: string, intentQuestions: string[] = []): EmptyFinding[] {
  const out: EmptyFinding[] = [];
  (article?.sections || []).forEach((section: any, sectionIndex: number) => {
    const h3s: any[] = Array.isArray(section?.h3Sections) ? section.h3Sections : [];
    const emptyH3Indexes = h3s.map((h, i) => (isEmptyContent(h?.content, h?.tables) ? i : -1)).filter((i) => i >= 0);
    if (h3s.length === 0 || emptyH3Indexes.length === 0) return;
    const { core, reason } = isCoreSection(section, title, intentQuestions);
    out.push({ sectionIndex, h2: String(section?.h2 || ''), emptyH3Indexes, h3Titles: h3s.map((h) => String(h?.h3 || '')), core, coreReason: reason, answersTo: String(section?.answersTo || '').trim() });
  });
  return out;
}

const REPAIR_RULES = `당신은 빈 절 하나만 채우는 작성자입니다. 아래 절의 소제목 밑에 본문이 비어 있습니다. **그 절의 본문만** 씁니다. 다른 절은 건드리지 않습니다.
- 이 절이 답해야 할 검색 질문에 직접 답합니다. 답을 첫 문장에 둡니다.
- 값(숫자·금액·날짜·기간·비율·인원)은 Research Packet·근거에 글자로 있는 것만 씁니다. 근거에 없으면 값을 만들지 말고 "공식 자료에서 확인해야 합니다" 로 씁니다.
- 앞뒤 절과 같은 문장을 되풀이하지 않습니다. 소제목(h3)은 바꾸지 않습니다.
- HTML: <p> 문단 2~4개. 표·목록은 필요할 때만.
출력(JSON 객체 하나만): {"h3Sections":[{"index":0,"content":"<p>…</p>"}]}`;

export function buildRepairPrompt(input: {
  title: string; mainKeyword: string; section: any; finding: EmptyFinding; packetText: string; evidenceText: string; prevContext: string; nextContext: string;
}): string {
  const { section, finding } = input;
  const targets = finding.emptyH3Indexes.map((i) => `[index ${i}] <h3>${finding.h3Titles[i]}</h3>`).join('\n');
  return [
    REPAIR_RULES, '',
    `제목: ${input.title}`, `메인 키워드: ${input.mainKeyword}`,
    `절 소제목(h2): ${section.h2}`,
    finding.answersTo ? `이 절이 답할 검색 질문: ${finding.answersTo}` : '',
    '', input.packetText.slice(0, 4500), '',
    `===== FACT EVIDENCE(요약) =====\n${input.evidenceText.slice(0, 6000)}`, '',
    input.prevContext ? `===== 앞 절 끝(문맥) =====\n${input.prevContext}` : '',
    input.nextContext ? `===== 뒤 절 시작(문맥) =====\n${input.nextContext}` : '',
    '', `===== 채울 소제목 =====\n${targets}`,
  ].filter((l) => l !== null && l !== undefined).join('\n');
}

/** 수리 결과를 코드가 다시 잰다 — 길이 · 값 대조 · 검색 질문 답 여부 */
export function verifyRepair(content: string, ledger: LedgerItem[], answersTo: string, h2: string): string | null {
  const text = bodyText(content);
  if (text.replace(/\s/g, '').length < MIN_REPAIRED_CHARS) return `수리한 본문이 여전히 짧다 (${text.length}자)`;
  const claims = checkClaims(content, ledger);
  if (claims.unsupported.length) return `수리 본문에 근거 없는 값: ${claims.unsupported.slice(0, 3).join(', ')}`;
  const question = answersTo || h2;
  if (question && !overlaps(text, question)) return `검색 질문("${question.slice(0, 30)}")에 답하는 낱말이 없다`;
  return null;
}

export interface RepairDeps {
  title: string;
  mainKeyword: string;
  intentQuestions?: string[];
  packetText: string;
  evidenceText: string;
  ledger: LedgerItem[];
  callModel: (prompt: string, opts?: { json?: boolean }) => Promise<string>;
  onLog?: (m: string) => void;
}

/**
 * 빈 절을 찾아 핵심 절은 수리하고 선택 절은 지운다. 새 글 객체를 돌려준다(원본 불변).
 * 호출 수 = 수리가 필요한 핵심 절 수(빈 절이 없으면 0).
 */
export async function repairEmptySections(article: any, deps: RepairDeps): Promise<{ article: any; result: EmptySectionResult }> {
  const findings = findEmptySections(article, deps.title, deps.intentQuestions || []);
  const result: EmptySectionResult = { findings, repaired: [], removed: [], unresolved: [], calls: 0 };
  if (findings.length === 0) return { article, result };

  const sections: any[] = (article.sections || []).map((s: any) => ({ ...s, h3Sections: (s.h3Sections || []).map((h: any) => ({ ...h })) }));
  const removeIdx = new Set<number>();
  const strip = (html: string) => bodyText(html);

  for (const f of findings) {
    const section = sections[f.sectionIndex];
    if (!f.core) {
      removeIdx.add(f.sectionIndex);
      result.removed.push({ sectionIndex: f.sectionIndex, h2: f.h2 });
      deps.onLog?.(`🕳️ 빈 절 제거(선택 절, 잃는 정보 없음): "${f.h2}"`);
      continue;
    }
    deps.onLog?.(`🕳️ 빈 절 발견(핵심 절 — ${f.coreReason}): "${f.h2}" → 그 절만 다시 채웁니다`);
    const prev = sections[f.sectionIndex - 1];
    const next = sections[f.sectionIndex + 1];
    const prevContext = prev ? strip((prev.h3Sections || []).map((h: any) => h.content).join(' ')).slice(-300) : strip(article.introduction || '').slice(-300);
    const nextContext = next ? strip((next.h3Sections || []).map((h: any) => h.content).join(' ')).slice(0, 300) : '';
    const prompt = buildRepairPrompt({ title: deps.title, mainKeyword: deps.mainKeyword, section, finding: f, packetText: deps.packetText, evidenceText: deps.evidenceText, prevContext, nextContext });
    let parsed: any = null;
    try { parsed = readJson(await deps.callModel(prompt, { json: true })); result.calls += 1; }
    catch (err: any) { if ((err as any)?.canceled) throw err; result.unresolved.push({ sectionIndex: f.sectionIndex, h2: f.h2, reason: `수리 호출 실패: ${String(err?.message || err).slice(0, 80)}` }); continue; }
    const rows: any[] = Array.isArray(parsed?.h3Sections) ? parsed.h3Sections : [];
    const failures: string[] = [];
    for (const i of f.emptyH3Indexes) {
      const row = rows.find((r) => Number(r?.index) === i);
      const content = String(row?.content || '').replace(/<h3\b[^>]*>[\s\S]*?<\/h3>\s*/gi, '').trim();
      const why = verifyRepair(content, deps.ledger, f.answersTo, f.h2);
      if (why) { failures.push(`[${f.h3Titles[i]}] ${why}`); continue; }
      section.h3Sections[i] = { ...section.h3Sections[i], content };
    }
    if (failures.length) {
      result.unresolved.push({ sectionIndex: f.sectionIndex, h2: f.h2, reason: failures.join(' · ') });
      deps.onLog?.(`🕳️ 빈 절 수리 실패 — 자동 발행하지 않습니다: "${f.h2}" — ${failures.join(' · ').slice(0, 160)}`);
    } else {
      const chars = strip(section.h3Sections.map((h: any) => h.content).join(' ')).length;
      result.repaired.push({ sectionIndex: f.sectionIndex, h2: f.h2, chars });
      deps.onLog?.(`🕳️ 빈 절 수리 완료: "${f.h2}" (${chars}자 · 값 대조 통과)`);
    }
  }
  const kept = sections.filter((_, i) => !removeIdx.has(i));
  return { article: { ...article, sections: kept.length ? kept : sections }, result };
}
