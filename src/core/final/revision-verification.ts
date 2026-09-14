/**
 * revision-verification — 고친 뒤 **정말 고쳐졌는지** 코드로 못 재는 지적만 검수한다. (v3.8.729)
 *
 * 사장님: "지적을 하면 그 지적한 걸 말끔히 해결해야 되는데 수정을 시켰는데도 똑같은 지적이 또 나와"
 *
 * 코드 진단(문장 중복·출처·판정문…)은 다시 재면 되지만, AI 비평("검색 의도에 답이 없다")은 잣대가 없다.
 * 그래서 고친 구간의 **전후 평문**만 넘겨 "이 지적이 풀렸는가"를 묻는다 — 새 비평을 시키는 것이 아니다.
 *
 * 비용 규칙: 호출은 정확히 1회. 글 전체가 아니라 **바뀐 구간만** 싣는다(구간당 2,500자 상한).
 * 답이 없거나 JSON 이 아니면 해결로 치지 않는다 — 모르는 것을 "고쳤다"고 하는 편이 더 나쁘다.
 */
import type { CritiqueIssue } from './post-critique';

export interface SectionChange {
  heading: string;
  /** 고치기 전 평문 */
  before: string;
  /** 고친 뒤 평문 */
  after: string;
}

const CHARS_PER_SIDE = 2500;

export function buildVerificationPrompt(input: {
  title: string;
  changes: SectionChange[];
  issues: Pick<CritiqueIssue, 'id' | 'title' | 'detail' | 'fix' | 'evidence'>[];
}): string {
  const changes = input.changes.map((c, i) => [
    `## 구간 ${i + 1}: ${c.heading}`,
    `[고치기 전]\n${String(c.before || '').slice(0, CHARS_PER_SIDE)}`,
    `[고친 뒤]\n${String(c.after || '').slice(0, CHARS_PER_SIDE)}`,
  ].join('\n')).join('\n\n');
  const list = input.issues.map((issue) => JSON.stringify({
    id: issue.id, title: issue.title, detail: String(issue.detail || '').slice(0, 200),
    fix: String(issue.fix || '').slice(0, 200), evidence: String(issue.evidence || '').slice(0, 160),
  })).join('\n');
  return [
    `당신은 "${input.title}" 글의 수정 결과 검수자입니다.`,
    '아래 지적들이 고친 뒤 구간에서 **실제로 해결됐는지만** 판정하세요. 새 지적을 만들지 마세요.',
    '표현만 바뀌었거나 지적이 가리킨 문제가 그대로면 resolved 는 false 입니다.',
    '확인할 수 없는 사실·수치·출처를 새로 넣은 것은 해결이 아닙니다.',
    '',
    `# 검수할 지적 (id 를 그대로 돌려주세요)\n${list}`,
    '',
    `# 고친 구간\n${changes}`,
    '',
    '# 출력 — JSON 배열만. 설명·코드블록 금지.',
    '[{"id":"…","resolved":true,"evidence":"고친 뒤 구간에서 그 근거가 되는 문장"}]',
    '해결되지 않은 항목도 빠뜨리지 말고 resolved:false 로 적으세요.',
  ].join('\n');
}

/** 모델 답에서 JSON 배열만 건진다 — 앞뒤 설명이 붙어도 살린다 */
export function parseVerification(raw: string): Array<{ id: string; resolved: boolean; evidence: string }> {
  const text = String(raw || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item: any) => item && typeof item.id === 'string')
      .map((item: any) => ({ id: item.id, resolved: item.resolved === true, evidence: String(item.evidence || '').trim() }));
  } catch {
    return [];
  }
}

/**
 * 해결된 지적의 id 만 돌려준다. resolved:true 이고 근거 문장이 있어야 해결이다.
 * 바뀐 구간이 없거나 지적이 없으면 호출하지 않는다(0회).
 */
export async function verifySelectedIssues(input: {
  title: string;
  changes: SectionChange[];
  issues: CritiqueIssue[];
  callModel: (prompt: string) => Promise<string>;
}): Promise<string[]> {
  const changes = (input.changes || []).filter((c) => c && c.before !== c.after);
  if (!input.issues.length || !changes.length) return [];
  try {
    const raw = await input.callModel(buildVerificationPrompt({ title: input.title, changes, issues: input.issues }));
    const verdicts = parseVerification(raw);
    return input.issues
      .filter((issue) => {
        const mine = verdicts.filter((v) => v.id === issue.id);
        return mine.length === 1 && mine[0]!.resolved && mine[0]!.evidence.length > 0;
      })
      .map((issue) => issue.id);
  } catch {
    return [];
  }
}
