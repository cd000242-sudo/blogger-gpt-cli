/**
 * claude-seo review pass — safety checks, reply parsing and the runner.
 * No real Claude Code call: the model is a fake function. The runner must NEVER throw and must always hand back
 * a usable article (the draft as it was, unless every safety check passed).
 */
import * as path from 'path';
import { checkReviewSafety, parsePatchReply, applyPatches, type ReviewPatch } from '../src/core/final/seo-skill-safety';
import { runSeoSkillReview, buildSeoReviewPrompt } from '../src/core/final/seo-skill-review';

const BUNDLE = path.join(__dirname, '..', 'electron', 'assets', 'claude-seo');

const FILLER = '이 문단은 신청 전에 알아 둘 내용을 차분하게 풀어 쓴 설명입니다. 서류를 미리 챙기면 창구에서 기다리는 시간이 줄어듭니다.';
const ARTICLE = [
  '<h2>2026년 지원금 신청 방법</h2>',
  '<p>신청 금액은 최대 1,200,000원이고 지급률은 35%입니다. 신청은 2026년 3월 31일까지 가능합니다.</p>',
  '<img src="https://example.com/a1.jpg" alt="신청 화면">',
  '<h3>필요 서류</h3>',
  `<p>${FILLER}</p>`,
  '<table><tr><td>구분</td><td>금액</td></tr><tr><td>기본</td><td>1,200</td></tr></table>',
  `<p>${FILLER} 자세한 내용은 <a href="https://www.gov.kr/">정부24</a>에서 확인하세요.</p>`,
  `<p>${FILLER}</p>`,
  '<script type="application/ld+json">{"@type":"Article"}</script>',
].join('\n');

const revise = (html: string): string => html.replace('차분하게 풀어 쓴', '쉽게 풀어 쓴');
/** The answer format the review asks for: an edit list between markers, then up to three "changed" lines. */
const reply = (patches: unknown, tail = '바꾼 곳:\n- 마감일 문장을 답 먼저로 고침'): string =>
  `ARTICLE_PATCH_BEGIN\n${typeof patches === 'string' ? patches : JSON.stringify(patches)}\nARTICLE_PATCH_END\n${tail}`;
const EDIT: ReviewPatch = { find: '신청은 2026년 3월 31일까지 가능합니다.', replace: '신청 마감은 2026년 3월 31일입니다.' };
const EDITED = ARTICLE.replace(EDIT.find, EDIT.replace);

describe('checkReviewSafety', () => {
  test('a small prose edit passes', () => {
    expect(checkReviewSafety(ARTICLE, revise(ARTICLE))).toEqual({ ok: true, reason: '' });
  });

  test('empty reply is rejected', () => {
    expect(checkReviewSafety(ARTICLE, '   ').ok).toBe(false);
  });

  test('visible text outside 80%~125% is rejected, inside is accepted', () => {
    const shortened = ARTICLE.replace(new RegExp(FILLER, 'g'), '');
    expect(checkReviewSafety(ARTICLE, shortened).reason).toMatch(/글자 수/);
    const grown = ARTICLE.replace(`<p>${FILLER}</p>`, `<p>${FILLER}</p><p>${FILLER}${FILLER}${FILLER}</p>`);
    expect(checkReviewSafety(ARTICLE, grown).reason).toMatch(/글자 수/);
    const slightlyLonger = ARTICLE.replace('설명입니다.', '설명입니다. 천천히 읽어 보세요.');
    expect(checkReviewSafety(ARTICLE, slightlyLonger).ok).toBe(true);
  });

  test.each([
    ['1,200 -> 1,300', (s: string) => s.replace(/1,200(?!,)/g, '1,300')],
    ['35% -> 36%', (s: string) => s.replace('35%', '36%')],
    ['2026 -> 2025', (s: string) => s.replace(/2026/g, '2025')],
  ])('a changed number is rejected (%s)', (_name, mutate) => {
    const r = checkReviewSafety(ARTICLE, mutate(ARTICLE));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/숫자/);
  });

  test('numbers may move around freely as long as every one is still there', () => {
    const moved = ARTICLE.replace('<p>신청 금액은 최대 1,200,000원이고 지급률은 35%입니다. 신청은 2026년 3월 31일까지 가능합니다.</p>',
      '<p>신청은 2026년 3월 31일까지 가능합니다. 지급률은 35%이고 신청 금액은 최대 1,200,000원입니다.</p>');
    expect(checkReviewSafety(ARTICLE, moved).ok).toBe(true);
  });

  test.each([
    ['<img', (s: string) => s.replace(/<img[^>]*>/, '')],
    ['<a ', (s: string) => s.replace(/<a href="[^"]*">정부24<\/a>/, '정부24')],
    ['<table', (s: string) => s.replace(/<table>[\s\S]*?<\/table>/, '<p>표 대신 문장</p>')],
    ['<h2', (s: string) => s.replace('<h2>', '<h4>').replace('</h2>', '</h4>')],
    ['<h3', (s: string) => s.replace('<h3>필요 서류</h3>', '<p>필요 서류</p>')],
    ['<script', (s: string) => s.replace(/<script[\s\S]*?<\/script>/, '')],
    ['<iframe', (s: string) => `${s}\n<iframe src="https://example.com/x"></iframe>`],
  ])('a changed %s count is rejected', (tag, mutate) => {
    const r = checkReviewSafety(ARTICLE, mutate(ARTICLE));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain(tag.trim());
  });

  test('a draft that already has an iframe keeps it', () => {
    const withFrame = `${ARTICLE}\n<iframe src="https://example.com/x"></iframe>`;
    expect(checkReviewSafety(withFrame, revise(withFrame)).ok).toBe(true);
    expect(checkReviewSafety(withFrame, revise(withFrame).replace(/<iframe[\s\S]*?<\/iframe>/, '')).ok).toBe(false);
  });
});

describe('parsePatchReply', () => {
  test('takes the edit list between the markers and up to three "changed" lines after it', () => {
    const r = parsePatchReply(reply([EDIT], '바꾼 곳:\n- 하나\n- 둘\n- 셋\n- 넷'));
    expect(r?.patches).toEqual([EDIT]);
    expect(r?.dropped).toBe(0);
    expect(r?.notes).toEqual(['하나', '둘', '셋']);
  });

  test('an empty list is a valid answer ("nothing to fix")', () => {
    expect(parsePatchReply(reply([], '바꾼 곳: 없음'))?.patches).toEqual([]);
  });

  test('a quoted mention of the markers before the real block is ignored', () => {
    const r = parsePatchReply(`출력은 ARTICLE_PATCH_BEGIN 와 ARTICLE_PATCH_END 사이에 둡니다.\n${reply([EDIT])}`);
    expect(r?.patches).toEqual([EDIT]);
  });

  test('a code fence inside the markers is stripped', () => {
    expect(parsePatchReply(reply('```json\n' + JSON.stringify([EDIT]) + '\n```'))?.patches).toEqual([EDIT]);
  });

  test('entries without string find/replace are dropped and counted', () => {
    const r = parsePatchReply(reply([EDIT, { find: 1, replace: 'x' }, 'text', null]));
    expect(r?.patches).toEqual([EDIT]);
    expect(r?.dropped).toBe(3);
  });

  test('no markers, broken JSON or a non-list means no result (no loose fallback)', () => {
    expect(parsePatchReply(`<p>마커 없이 그냥 HTML</p>`)).toBeNull();
    expect(parsePatchReply('죄송합니다. 도와드릴 수 없습니다.')).toBeNull();
    expect(parsePatchReply(reply('[{"find": "깨진 JSON'))).toBeNull();
    expect(parsePatchReply(reply({ find: EDIT.find, replace: EDIT.replace }))).toBeNull();
    expect(parsePatchReply('')).toBeNull();
  });
});

describe('applyPatches', () => {
  test('a valid edit replaces exactly that phrase and nothing else', () => {
    expect(applyPatches(ARTICLE, [EDIT])).toEqual({ html: EDITED, applied: 1, skipped: [] });
  });

  test.each([
    ['태그 포함', { find: '<p>신청 금액은 최대 1,200,000원이고', replace: '<p>신청 금액은 최대 1,200,000원으로' }],
    ['태그 포함', { find: '신청 금액은 최대 1,200,000원이고', replace: '<b>신청 금액</b>은 최대 1,200,000원이고' }],
    ['찾을 구절이 짧음', { find: '필요 서류', replace: '챙길 서류' }],
    ['바꿀 내용 없음', { find: EDIT.find, replace: EDIT.find }],
    ['바꿀 내용 없음', { find: EDIT.find, replace: '   ' }],
    ['찾을 구절 3곳', { find: '차분하게 풀어 쓴 설명입니다.', replace: '쉽게 풀어 쓴 설명입니다.' }],
    ['찾을 구절 0곳', { find: '초안에 전혀 없는 아주 긴 구절입니다.', replace: '아무거나' }],
    ['태그·스크립트 안', { find: '{"@type":"Article"}', replace: '{"@type":"BlogPosting"}' }],
    ['태그·스크립트 안', { find: 'https://example.com/a1.jpg', replace: 'https://example.com/b2.jpg' }],
  ])('an edit that breaks a rule is skipped on its own (%s)', (reason, patch) => {
    const r = applyPatches(ARTICLE, [patch, EDIT]);
    expect(r.skipped).toEqual([`1번 ${reason}`]);
    expect(r.applied).toBe(1);
    expect(r.html).toBe(EDITED);
  });

  test('no more than the first 12 edits are applied', () => {
    const many = Array.from({ length: 13 }, (_, i) => ({ find: `없는 구절 번호 ${i} 입니다 정말로`, replace: 'x' }));
    const r = applyPatches(ARTICLE, many);
    expect(r.skipped[12]).toBe('13번 개수 초과');
  });
});

describe('buildSeoReviewPrompt', () => {
  const prompt = buildSeoReviewPrompt({ criteria: '## Criteria A\n- item', title: '지원금 신청', html: ARTICLE });
  test('carries the role, the criteria, the app limits, the draft and the output format', () => {
    expect(prompt).toContain('claude-seo 스킬(seo-content, seo-geo)의 기준으로 초안을 점검하고, 분명히 미달인 곳만 고친다');
    expect(prompt).toContain('## Criteria A\n- item');
    for (const limit of ['숫자·금액·날짜·정책명·기관명·제품명·인물명·고유명사·직접 인용', '지어내지', '크게 늘리거나 줄이지', '이미지, 표, 링크, 버튼, 광고 자리, 스키마', '작성자 소개 페이지', '최소 단어 수']) {
      expect(prompt).toContain(limit);
    }
    expect(prompt).toContain(ARTICLE);
    expect(prompt).toContain('ARTICLE_PATCH_BEGIN');
    expect(prompt).toContain('ARTICLE_PATCH_END');
    expect(prompt).toContain('3줄 이내');
    expect(prompt).toContain('글 전체를 다시 쓰지 않는다');
    expect(prompt).toContain('< 와 > 를 쓰지 않는다');
  });
  test('the skill text is declared to be material, not instructions', () => {
    expect(prompt).toMatch(/스크립트 실행|URL/);
    expect(prompt).toMatch(/지시가 아니/);
  });
});

describe('runSeoSkillReview', () => {
  const base = { provider: 'claude', title: '지원금 신청', html: ARTICLE, skillDir: BUNDLE };
  const never = jest.fn(async () => { throw new Error('model must not be called'); });

  test('success: accepted edit, "완료 — 바꾼 곳 N", prompt holds the extracted criteria', async () => {
    const seen: string[] = [];
    const lines: Array<[string, boolean]> = [];
    const r = await runSeoSkillReview({ ...base, callModel: async (p) => { seen.push(p); return reply([EDIT]); }, onLog: (l, s) => lines.push([l, s]) });
    expect(r.status).toBe('done');
    expect(r.html).toBe(EDITED);
    expect(r.changed).toBe(1);
    expect(r.line).toBe('[SEO 스킬 점검] 완료 — 바꾼 곳 1');
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('### 1. Citability Score (25%)');
    expect(seen[0]).toContain('## AI Citation Readiness (GEO signals)');
    expect(r.criteriaChars).toBeGreaterThan(3000);
    expect(r.promptChars).toBe(seen[0]!.length);
    // the result line is shown on screen; the running line too
    expect(lines.filter(([, screen]) => screen).map(([l]) => l)).toContain(r.line);
  });

  test('an empty edit list is a success with 0 changes', async () => {
    const r = await runSeoSkillReview({ ...base, callModel: async () => reply([], '바꾼 곳: 없음') });
    expect(r.status).toBe('done');
    expect(r.line).toBe('[SEO 스킬 점검] 완료 — 바꾼 곳 0');
    expect(r.html).toBe(ARTICLE);
  });

  test('edits that all break a rule leave the draft as it is, with the reasons in the details', async () => {
    const r = await runSeoSkillReview({ ...base, callModel: async () => reply([{ find: '{"@type":"Article"}', replace: '{"@type":"BlogPosting"}' }]) });
    expect(r.status).toBe('done');
    expect(r.changed).toBe(0);
    expect(r.html).toBe(ARTICLE);
    expect(r.details.join('\n')).toContain('1번 태그·스크립트 안');
  });

  test('other engines: skipped as "해당 없음(엔진: codex)" without a model call', async () => {
    const r = await runSeoSkillReview({ ...base, provider: 'codex', callModel: never });
    expect(r.status).toBe('skipped');
    expect(r.line).toBe('[SEO 스킬 점검] 해당 없음(엔진: codex)');
    expect(r.html).toBe(ARTICLE);
    expect(never).not.toHaveBeenCalled();
  });

  test('ORBIT_SEO_SKILL_REVIEW=0 skips the whole step', async () => {
    const r = await runSeoSkillReview({ ...base, callModel: never, env: { ORBIT_SEO_SKILL_REVIEW: '0' } });
    expect(r.status).toBe('skipped');
    expect(r.line).toContain('해당 없음(ORBIT_SEO_SKILL_REVIEW=0)');
    expect(never).not.toHaveBeenCalled();
    const on = await runSeoSkillReview({ ...base, callModel: async () => reply([]), env: { ORBIT_SEO_SKILL_REVIEW: '1' } });
    expect(on.status).toBe('done');
  });

  test('a body with no real text is skipped, not sent', async () => {
    const r = await runSeoSkillReview({ ...base, html: '<p>and</p>', callModel: never });
    expect(r.status).toBe('skipped');
    expect(r.line).toContain('해당 없음(본문 없음)');
  });

  describe('every failure keeps the draft and says so', () => {
    const failed = (r: Awaited<ReturnType<typeof runSeoSkillReview>>, reason: RegExp) => {
      expect(r.status).toBe('failed');
      expect(r.html).toBe(ARTICLE);
      expect(r.line).toMatch(/^\[SEO 스킬 점검\] 실패\(.+\) — 점검 전 글로 계속 진행$/);
      expect(r.line).toMatch(reason);
    };

    test('model error (including a synchronous throw)', async () => {
      failed(await runSeoSkillReview({ ...base, callModel: async () => { throw new Error('에이전트가 답을 주지 않았습니다'); } }), /답을 주지/);
      failed(await runSeoSkillReview({ ...base, callModel: () => { throw new Error('boom'); } }), /boom/);
    });
    test('no markers in the reply', async () => {
      failed(await runSeoSkillReview({ ...base, callModel: async () => '죄송합니다.' }), /형식/);
    });
    test('changed number', async () => {
      const patch = { find: '신청 금액은 최대 1,200,000원이고 지급률은 35%입니다.', replace: '신청 금액은 최대 1,200,000원이고 지급률은 40%입니다.' };
      failed(await runSeoSkillReview({ ...base, callModel: async () => reply([patch]) }), /숫자/);
    });
    test('an edit that removes a large part of the text', async () => {
      const patch = { find: `${FILLER} 자세한 내용은`, replace: '자세한 내용은' };
      failed(await runSeoSkillReview({ ...base, callModel: async () => reply([patch]) }), /글자 수/);
    });
    test('extra check (author requirement) can veto', async () => {
      failed(await runSeoSkillReview({ ...base, callModel: async () => reply([EDIT]), extraCheck: () => '작성자 요구 R1 손상' }), /R1/);
    });
    test('time limit', async () => {
      failed(await runSeoSkillReview({ ...base, timeoutMs: 40, callModel: () => new Promise<string>(() => undefined) }), /시간 초과/);
    });
    test('criteria cannot be read', async () => {
      failed(await runSeoSkillReview({ ...base, skillDir: path.join(BUNDLE, 'nope'), callModel: never }), /점검 기준/);
    });
  });
});
