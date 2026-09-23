/**
 * manual-revision — 사장님이 **직접 적은 수정 요청**을 글 전체에 반영한다. (v3.8.729)
 *
 * 사장님: "편집기에서 이렇게 고쳐줘 버튼을 누르고 고칠 사항을 입력했는데도 불구하고 인식을 못하면서 수정을 안 해주거든"
 *
 * ## 왜 구간 단위(improveDraft)로 못 보내나
 * 요청은 "도입부를 부드럽게", "마지막 표를 지워", "3번 소제목 아래 예시를 하나 더" 처럼 **위치를 말로** 가리킨다.
 * 구간 번호가 없으니 구간 엔진은 어디를 고칠지 모른다 — v3.8.725~728 은 실제로 존재하지 않는 구간을
 * 고치려다 모델을 한 번도 부르지 않고 "고친 곳이 없습니다"를 띄웠다.
 * 그래서 글 전체를 한 번에 주고 요청한 자리를 모델이 찾게 한다. 호출은 1회, 반려되면 이유를 붙여 1회 더.
 *
 * ## 지키는 것
 * · 요청과 무관한 이미지·링크·CSS·구조는 그대로 — 요청에 "이미지 빼" 같은 말이 없는데 줄어들면 반려.
 * · 원본 `<style>` 은 요청이 서식을 말하지 않는 한 한 글자도 바뀌면 안 된다(외부 HTML 의 스킨 보호).
 * · 고친 뒤 검수 1회 — "요청대로 됐는가"를 바뀐 구간만 넘겨 묻는다.
 */
import { acceptRevisedSection, type CritiqueIssue } from './post-critique';
import type { DraftImprovement } from './editor-draft';
import { verifySelectedIssues, type SectionChange } from './revision-verification';

const plainLength = (html: string): number => String(html || '').replace(/<[^>]+>/g, '').trim().length;

/** 요청이 "빼라·줄여라" 인가 — 그러면 짧아지는 것이 정상이다 */
export function isCuttingRequest(request: string): boolean {
  return /지워|지우|삭제|빼|없애|줄여|줄이|축약|짧게|간결/.test(String(request || ''));
}

/** 이미지·링크·버튼을 빼라는 요청인가 — 그때만 개수가 줄어도 받는다 */
export function allowsMediaLoss(request: string): boolean {
  const r = String(request || '');
  return /이미지|사진|그림|링크|버튼|CTA|표/i.test(r) && /지워|지우|삭제|빼|없애/.test(r);
}

/** "다음은 수정한 HTML 입니다:" 같은 앞뒤 말을 걷어내고 마크업만 남긴다 — 문서 앞뒤에 설명이 붙으면 본문에 그대로 실린다 */
export function trimToMarkup(raw: string): string {
  const text = String(raw || '').replace(/```[a-z]*\s*/gi, '').replace(/```/g, '').trim();
  const start = text.search(/<!doctype|<html|<[a-z][\s\S]*?>/i);
  const end = text.lastIndexOf('>');
  if (start < 0 || end <= start) return text;
  return text.slice(start, end + 1);
}

/** 서식을 건드리라는 요청인가 — 아니면 원본 <style> 은 그대로여야 한다 */
export function touchesStyles(request: string): boolean {
  return /CSS|스타일|서식|스킨|색상|색깔|폰트|글꼴|배경|테두리|여백/i.test(String(request || ''));
}

export function buildManualRevisionPrompt(input: { title: string; html: string; request: string; note?: string }): string {
  return [
    `당신은 "${input.title}" 글의 편집자입니다. 작성자가 적은 수정 요청을 **전체 HTML 에** 반영합니다.`,
    '',
    `# 작성자의 수정 요청\n${input.request}`,
    '',
    '# 규칙 (어기면 그 결과는 버려집니다)',
    '· 요청한 부분은 **모두** 고칩니다. "도입부", "마지막 표", "3번 소제목" 처럼 말로 가리킨 위치를 실제로 찾아 고칩니다. 소제목이 없는 글도 수정 대상입니다.',
    '· 요청과 무관한 문장·이미지(<img>)·링크(<a>)·<style>·class·id·문서 구조는 **그대로** 둡니다.',
    '· 요청이 삭제·축약·소제목 변경·답 변경을 요구하면 그대로 합니다. 요구하지 않은 것은 줄이지 않습니다.',
    '· 모르는 사실·수치·출처를 지어내지 않습니다. 근거 없는 숫자를 넣으라는 요청이면 그 부분은 문장으로만 씁니다.',
    '· 본문에 글자로 적힌 주소(https://…)는 한 글자도 바꾸지 않습니다.',
    '· 원문을 생략하거나 요약하지 않습니다. **수정한 전체 HTML 만** 출력합니다. 설명·코드블록·마크다운 금지.',
    ...(input.note ? ['', input.note] : []),
    '',
    `# 전체 원문 HTML\n${input.html}`,
  ].join('\n');
}

export async function reviseByRequest(input: {
  title: string;
  html: string;
  issues: CritiqueIssue[];
  callModel: (prompt: string) => Promise<string>;
  log?: (line: string) => void;
  verify?: boolean;
}): Promise<DraftImprovement> {
  const wanted = input.issues.map((issue) => issue.title);
  const empty: DraftImprovement = {
    ok: true, html: input.html, revised: 0, length: plainLength(input.html), skipped: [],
    revisedDetail: [], actuallyFixed: [], stillPresent: wanted,
  };
  const request = input.issues.map((issue) => String(issue.detail || issue.fix || issue.title || '').trim()).filter(Boolean).join('\n');
  if (!request) return { ...empty, skipped: ['요청 내용이 비어 있습니다.'] };

  const gate = {
    cutting: isCuttingRequest(request),
    allowMediaLoss: allowsMediaLoss(request),
    allowAnswerEdit: true,
    preserveMarkup: true,
  };
  const whole = { index: 0, heading: '(전체 문서)', html: input.html };
  const originalStyles = input.html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || [];

  const attempt = async (note: string) => {
    const raw = await input.callModel(buildManualRevisionPrompt({ title: input.title, html: input.html, request, ...(note ? { note } : {}) }));
    const verdict = acceptRevisedSection(trimToMarkup(raw), whole, gate);
    if (!verdict.accepted) return verdict;
    if (!touchesStyles(request) && originalStyles.some((style) => !verdict.html.includes(style))) {
      return { html: input.html, accepted: false, reason: '요청하지 않은 원본 CSS(<style>)가 바뀌었습니다' };
    }
    return verdict;
  };

  input.log?.('[PROGRESS] 15% - ✍️ 전체 본문에서 요청한 위치를 찾아 고치는 중…');
  let verdict = await attempt('');
  if (!verdict.accepted && verdict.reason !== '바뀐 것이 없습니다') {
    input.log?.(`   ↻ 1차 반려(${verdict.reason}) — 이유를 알려주고 한 번 더`);
    verdict = await attempt(`# ⚠️ 방금 쓴 답이 반려됐습니다 — 이유: ${verdict.reason}
다시 쓰되 이번에는 반드시 지키세요: 요청하지 않은 이미지·링크·<style>·문장을 빼지 말고, 원문을 생략하지 말고, 전체 HTML 을 그대로 다 출력하세요.`);
  }
  if (!verdict.accepted) return { ...empty, skipped: [`(전체 문서): ${verdict.reason}`] };

  // 요청은 소제목 추가·삭제·순서 변경도 포함한다. 같은 구간 번호끼리 맞추면 끝부분을 누락한다.
  // 전체 HTML로 검수해야 CSS/속성만 바뀐 요청도 실제로 검사할 수 있다.
  const changes: SectionChange[] = [{ heading: '(전체 문서)', before: input.html, after: verdict.html }];
  input.log?.('[PROGRESS] 85% - 🔎 요청한 변경이 실제로 반영됐는지 확인합니다 (1회)');
  const fixedIds = input.verify === false
    ? []
    : await verifySelectedIssues({ title: input.title, changes, issues: input.issues, callModel: input.callModel });

  return {
    ...empty,
    html: verdict.html,
    revised: 1,
    length: plainLength(verdict.html),
    revisedDetail: [{ index: 0, heading: '(전체 문서)', before: plainLength(input.html), after: plainLength(verdict.html), issues: wanted }],
    actuallyFixed: input.issues.filter((issue) => fixedIds.includes(issue.id)).map((issue) => issue.title),
    stillPresent: input.issues.filter((issue) => !fixedIds.includes(issue.id)).map((issue) => issue.title),
  };
}
