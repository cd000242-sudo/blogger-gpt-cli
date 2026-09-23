/**
 * revision-verification — 고친 뒤 **정말 고쳐졌는지** 코드로 못 재는 지적만 검수한다. (v3.8.729)
 *
 * 사장님: "지적을 하면 그 지적한 걸 말끔히 해결해야 되는데 수정을 시켰는데도 똑같은 지적이 또 나와"
 *
 * 코드 진단(문장 중복·출처·판정문…)은 다시 재면 되지만, AI 비평("검색 의도에 답이 없다")은 잣대가 없다.
 * 그래서 고친 구간의 전후 원문을 넘겨 "이 지적이 풀렸는가"를 묻는다 — HTML 속성 수정도 검수한다.
 *
 * 비용 규칙: 호출은 최대 1회. 요청이나 구간의 뒷부분을 잘라 검수하지 않는다.
 * 답이 없거나 JSON 이 아니면 해결로 치지 않는다 — 모르는 것을 "고쳤다"고 하는 편이 더 나쁘다.
 */
import type { CritiqueIssue } from './post-critique';

export interface SectionChange {
  heading: string;
  /** 고치기 전 원문 (HTML 가능) */
  before: string;
  /** 고친 뒤 원문 (HTML 가능) */
  after: string;
}

export function buildVerificationPrompt(input: {
  title: string;
  changes: SectionChange[];
  issues: Pick<CritiqueIssue, 'id' | 'title' | 'detail' | 'fix' | 'evidence'>[];
}): string {
  const changes = input.changes.map((c, i) => [
    `## 구간 ${i + 1}: ${c.heading}`,
    `[고치기 전]\n${String(c.before || '')}`,
    `[고친 뒤]\n${String(c.after || '')}`,
  ].join('\n')).join('\n\n');
  const list = input.issues.map((issue) => JSON.stringify({
    id: issue.id, title: issue.title, detail: String(issue.detail || ''),
    fix: String(issue.fix || ''), evidence: String(issue.evidence || ''),
  })).join('\n');
  return [
    `당신은 "${input.title}" 글의 수정 결과 검수자입니다.`,
    '아래 지적들이 고친 뒤 구간에서 **실제로 해결됐는지만** 판정하세요. 새 지적을 만들지 마세요.',
    '표현만 바뀌었거나 지적이 가리킨 문제가 그대로면 resolved 는 false 입니다.',
    '확인할 수 없는 사실·수치·출처를 새로 넣은 것은 해결이 아닙니다.',
    '요청에 여러 조건이 있으면 전부 충족해야 resolved:true 입니다. 일부만 확인되거나 판단할 수 없으면 false 입니다.',
    'HTML·CSS 변경은 태그와 속성을 비교하세요. 평문이 같아도 변경될 수 있으며, CSS가 조금 바뀌었다는 이유만으로 요청 전체를 해결 처리하지 마세요.',
    '',
    `# 검수할 지적 (id 를 그대로 돌려주세요)\n${list}`,
    '',
    `# 고친 구간\n${changes}`,
    '',
    '# 출력 — JSON 배열만. 설명·코드블록 금지.',
    '[{"id":"…","resolved":true,"evidence":"고친 뒤 원문에서 그대로 인용한 문장 또는 HTML","beforeEvidence":"삭제·교체된 고치기 전 원문 인용 (필요할 때만)"}]',
    'evidence는 변경을 입증하는 8자 이상의 정확한 원문 인용이어야 합니다. 설명·요약·평가를 쓰지 마세요.',
    '삭제 때문에 수정 후 인용할 내용이 없다면 evidence는 빈 문자열로 두고 beforeEvidence에 실제로 사라진 원문을 인용하세요.',
    '해결되지 않은 항목도 빠뜨리지 말고 resolved:false 로 적으세요.',
  ].join('\n');
}

/** 모델 답에서 JSON 배열만 건진다 — 앞뒤 설명이 붙어도 살린다 */
export function parseVerification(raw: string): Array<{ id: string; resolved: boolean; evidence: string; beforeEvidence?: string }> {
  const text = String(raw || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item: any) => item && typeof item.id === 'string')
      .map((item: any) => ({
        id: item.id, resolved: item.resolved === true,
        evidence: typeof item.evidence === 'string' ? item.evidence.trim() : '',
        ...(typeof item.beforeEvidence === 'string' ? { beforeEvidence: item.beforeEvidence.trim() } : {}),
      }));
  } catch {
    return [];
  }
}

/**
 * 해결된 지적의 id 만 돌려준다. resolved:true 와 실제 변경 원문의 근거가 모두 필요하다.
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
    const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
    const contains = (source: string, quote: string) => normalize(source).includes(normalize(quote))
      || (!/<[a-z!/][^>]*>/i.test(quote) && normalize(source.replace(/<[^>]*>/g, ' ')).includes(normalize(quote)));
    return input.issues
      .filter((issue) => {
        const mine = verdicts.filter((v) => v.id === issue.id);
        if (mine.length !== 1 || !mine[0]!.resolved) return false;
        const { evidence, beforeEvidence = '' } = mine[0]!;
        // A model's assurance ("수정했습니다") and an unchanged sentence are not evidence of a repair.
        return changes.some((change) => {
          const added = evidence.length >= 8 && contains(change.after, evidence) && !contains(change.before, evidence);
          const removed = beforeEvidence.length >= 8 && contains(change.before, beforeEvidence) && !contains(change.after, beforeEvidence);
          if (!evidence) return removed;
          return evidence.length >= 8 && contains(change.after, evidence) && (added || removed);
        });
      })
      .map((issue) => issue.id);
  } catch {
    return [];
  }
}
