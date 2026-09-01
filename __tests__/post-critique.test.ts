/**
 * post-critique — 발행된 글 비평·부분 수정 (v3.8.619)
 *
 * 가장 중요한 성질은 "고치려다 망가뜨리지 않는다" 이다.
 * 구간을 이어 붙이면 원본과 **정확히 같아야** 하고,
 * 이미지·링크가 줄어든 결과는 어떤 이유로도 통과하면 안 된다.
 */

import {
  splitSections,
  applySectionRevisions,
  locateSection,
  findCompetitorGaps,
  diagnosePost,
  scoreIssues,
  parseCritiqueIssues,
  acceptRevisedSection,
  judgeImproved,
  groupIssuesBySection,
  buildCritiquePrompt,
  buildSectionRevisionPrompt,
} from '../src/core/final/post-critique';

const POST = [
  '<p>보험금 청구는 3년 안에 해야 합니다.</p>',
  '<h2>청구 기한</h2>',
  '<p>상법 제662조에 따라 3년입니다. <img src="https://x/a.jpg" alt="기한"></p>',
  '<h2>필요 서류</h2>',
  '<p>진단서와 영수증이 필요합니다. <a href="https://www.fss.or.kr">금융감독원</a></p>',
].join('');

describe('splitSections', () => {
  it('구간을 이어 붙이면 원본과 정확히 같다', () => {
    const sections = splitSections(POST);
    expect(sections.map((s) => s.html).join('')).toBe(POST);
  });

  it('도입부는 0번, H2 구간은 1번부터다', () => {
    const sections = splitSections(POST);
    expect(sections[0]).toMatchObject({ index: 0, heading: '(도입부)' });
    expect(sections[1]!.heading).toBe('청구 기한');
    expect(sections[2]!.heading).toBe('필요 서류');
  });

  it('H2 가 없으면 통째로 한 구간이다', () => {
    const sections = splitSections('<p>본문만 있습니다.</p>');
    expect(sections).toHaveLength(1);
    expect(sections[0]!.html).toBe('<p>본문만 있습니다.</p>');
  });

  it('빈 본문은 구간이 없다', () => {
    expect(splitSections('')).toEqual([]);
  });
});

describe('applySectionRevisions', () => {
  it('고른 구간만 갈아끼우고 나머지는 그대로 둔다', () => {
    const next = applySectionRevisions(POST, [{ index: 1, html: '<h2>청구 기한</h2><p>새 내용</p>' }]);
    expect(next).toContain('<p>새 내용</p>');
    expect(next).toContain('진단서와 영수증이 필요합니다');
    expect(next).toContain('보험금 청구는 3년 안에');
    expect(next).not.toContain('상법 제662조');
  });

  it('교체본이 비어 있으면 원본 구간을 지킨다', () => {
    expect(applySectionRevisions(POST, [{ index: 1, html: '   ' }])).toBe(POST);
  });

  it('없는 구간 번호는 무시한다', () => {
    expect(applySectionRevisions(POST, [{ index: 99, html: '<p>엉뚱</p>' }])).toBe(POST);
  });
});

describe('locateSection', () => {
  it('문장이 있는 구간 번호를 찾는다', () => {
    const sections = splitSections(POST);
    expect(locateSection(sections, '진단서와 영수증')).toBe(2);
  });

  it('못 찾으면 -1 (글 전체)', () => {
    expect(locateSection(splitSections(POST), '없는 문장입니다')).toBe(-1);
  });
});

describe('findCompetitorGaps', () => {
  it('상위 글 여러 편이 함께 쓰는데 내 글에 없는 말을 찾는다', () => {
    const gaps = findCompetitorGaps('보험금 청구 기한 안내', [
      { title: '보험금 청구 환급 방법' },
      { title: '실손보험 환급 총정리', summary: '환급 신청 절차' },
    ]);
    expect(gaps).toContain('환급');
  });

  it('내 글에 이미 있는 말은 빠진 것이 아니다', () => {
    const gaps = findCompetitorGaps('환급 절차를 설명합니다', [
      { title: '환급 방법' },
      { title: '환급 신청' },
    ]);
    expect(gaps).not.toContain('환급');
  });

  it('한 편에만 나온 말은 신호가 약해 제외한다', () => {
    const gaps = findCompetitorGaps('보험금 청구', [{ title: '희귀단어 이야기' }]);
    expect(gaps).not.toContain('희귀단어');
  });

  it('경쟁글이 없으면 빈 배열', () => {
    expect(findCompetitorGaps('아무 글', [])).toEqual([]);
  });
});

describe('diagnosePost', () => {
  it('알맹이 없는 짧은 글에서 문제를 찾는다', () => {
    const issues = diagnosePost({
      title: '보험금 청구 방법',
      html: '<p>상황에 따라 다를 수 있습니다. 자세한 내용은 공식 사이트에서 확인하세요.</p>',
    });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.origin === 'code')).toBe(true);
  });

  it('링크가 하나도 없으면 전환 문제를 짚는다', () => {
    const issues = diagnosePost({ title: '제목', html: '<p>링크 없는 글입니다.</p>' });
    expect(issues.some((i) => i.id === 'cta-none')).toBe(true);
  });

  it('질문형 제목인데 답이 없으면 짚는다', () => {
    const issues = diagnosePost({
      title: '보험금 청구 3년 지나도 되나요?',
      html: '<p>보험금은 여러 사정이 있습니다. 상황에 따라 다를 수 있습니다.</p>',
    });
    expect(issues.some((i) => i.id === 'answer-missing')).toBe(true);
  });

  it('절대 예외를 던지지 않는다 — 빈 입력에도', () => {
    expect(() => diagnosePost({ title: '', html: '' })).not.toThrow();
  });
});

describe('scoreIssues', () => {
  it('문제가 없으면 100점', () => {
    expect(scoreIssues([])).toBe(100);
  });

  it('심각한 문제일수록 많이 깎는다', () => {
    const base = { id: 'x', area: 'substance' as const, title: 't', detail: 'd', evidence: '', fix: 'f', sectionIndex: -1, origin: 'code' as const };
    expect(scoreIssues([{ ...base, severity: 'high' }])).toBeLessThan(scoreIssues([{ ...base, severity: 'low' }]));
  });

  it('0 아래로는 안 내려간다', () => {
    const base = { id: 'x', area: 'substance' as const, severity: 'high' as const, title: 't', detail: 'd', evidence: '', fix: 'f', sectionIndex: -1, origin: 'code' as const };
    expect(scoreIssues(Array(20).fill(base))).toBe(0);
  });
});

describe('parseCritiqueIssues', () => {
  it('코드블록에 싸여 와도 건져낸다', () => {
    const raw = '```json\n[{"severity":"high","title":"답이 없다","detail":"d","evidence":"e","fix":"f","sectionIndex":1}]\n```';
    const issues = parseCritiqueIssues(raw, 3);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'high', sectionIndex: 1, origin: 'ai' });
  });

  it('범위 밖 구간 번호는 글 전체(-1)로 돌린다', () => {
    const issues = parseCritiqueIssues('[{"title":"t","sectionIndex":99}]', 3);
    expect(issues[0]!.sectionIndex).toBe(-1);
  });

  it('깨진 JSON 이면 빈 배열 — 비평 실패로 멈추지 않는다', () => {
    expect(parseCritiqueIssues('설명만 하고 끝났습니다', 3)).toEqual([]);
    expect(parseCritiqueIssues('[{깨짐', 3)).toEqual([]);
  });

  it('제목 없는 항목은 버린다', () => {
    expect(parseCritiqueIssues('[{"detail":"제목이 없다"}]', 3)).toEqual([]);
  });
});

describe('acceptRevisedSection', () => {
  const original = { index: 1, heading: '청구 기한', html: '<h2>청구 기한</h2><p>상법 제662조에 따라 3년입니다. 청구 기한을 넘기면 받을 수 없습니다.</p><img src="https://x/a.jpg"><a href="https://fss.or.kr">금감원</a>' };

  it('이미지가 사라지면 원본을 지킨다', () => {
    const result = acceptRevisedSection('<h2>청구 기한</h2><p>상법 제662조에 따라 3년입니다. 청구 기한을 넘기면 받을 수 없습니다. 더 길게 씁니다.</p><a href="https://fss.or.kr">금감원</a>', original);
    expect(result.accepted).toBe(false);
    expect(result.html).toBe(original.html);
    expect(result.reason).toContain('이미지');
  });

  it('링크가 사라지면 원본을 지킨다', () => {
    const result = acceptRevisedSection('<h2>청구 기한</h2><p>상법 제662조에 따라 3년입니다. 청구 기한을 넘기면 받을 수 없습니다. 더 길게 씁니다.</p><img src="https://x/a.jpg">', original);
    expect(result.accepted).toBe(false);
    expect(result.reason).toContain('링크');
  });

  it('분량이 줄면 원본을 지킨다', () => {
    const result = acceptRevisedSection('<h2>청구 기한</h2><p>3년.</p><img src="https://x/a.jpg"><a href="https://fss.or.kr">금감원</a>', original);
    expect(result.accepted).toBe(false);
    expect(result.reason).toContain('분량');
  });

  it('H2 가 사라지면 원본을 지킨다', () => {
    const result = acceptRevisedSection('<p>상법 제662조에 따라 3년입니다. 청구 기한을 넘기면 받을 수 없습니다. 더 길게 씁니다.</p><img src="https://x/a.jpg"><a href="https://fss.or.kr">금감원</a>', original);
    expect(result.accepted).toBe(false);
    expect(result.reason).toContain('H2');
  });

  it('빈 응답이면 원본을 지킨다', () => {
    expect(acceptRevisedSection('   ', original).accepted).toBe(false);
  });

  it('규칙을 다 지키면 받아들이고 코드블록 껍데기는 벗긴다', () => {
    const raw = '```html\n<h2>청구 기한</h2><p>상법 제662조에 따라 3년입니다. 청구 기한을 넘기면 받을 수 없습니다. 2026년 기준 그렇습니다.</p><img src="https://x/a.jpg"><a href="https://fss.or.kr">금감원</a>\n```';
    const result = acceptRevisedSection(raw, original);
    expect(result.accepted).toBe(true);
    expect(result.html).not.toContain('```');
    expect(result.html).toContain('2026년 기준');
  });
});

describe('judgeImproved', () => {
  const before = `<p>${'가'.repeat(500)}</p><img src="a.jpg"><a href="https://x">링크</a>`;

  it('이미지가 줄면 발행하지 않는다', () => {
    const next = `<p>${'가'.repeat(600)}</p><a href="https://x">링크</a>`;
    expect(judgeImproved(next, before)).toMatchObject({ ok: false });
  });

  it('링크가 줄면 발행하지 않는다', () => {
    const next = `<p>${'가'.repeat(600)}</p><img src="a.jpg">`;
    expect(judgeImproved(next, before).ok).toBe(false);
  });

  it('10% 넘게 짧아지면 발행하지 않는다', () => {
    const next = `<p>${'가'.repeat(400)}</p><img src="a.jpg"><a href="https://x">링크</a>`;
    expect(judgeImproved(next, before).ok).toBe(false);
  });

  it('바뀐 것이 없으면 발행하지 않는다', () => {
    expect(judgeImproved(before, before)).toMatchObject({ ok: false, reason: '바뀐 것이 없습니다' });
  });

  it('길어지고 이미지·링크가 살아 있으면 통과한다', () => {
    const next = `<p>${'가'.repeat(700)}</p><img src="a.jpg"><a href="https://x">링크</a>`;
    const verdict = judgeImproved(next, before);
    expect(verdict.ok).toBe(true);
    expect(verdict.length).toBeGreaterThan(500);
  });

  it('너무 짧은 본문은 통과하지 못한다', () => {
    expect(judgeImproved('<p>짧다</p>', before).ok).toBe(false);
  });
});

describe('groupIssuesBySection', () => {
  it('구간별로 묶고 글 전체 문제는 따로 뺀다', () => {
    const base = { area: 'substance' as const, severity: 'medium' as const, detail: 'd', evidence: '', fix: 'f', origin: 'code' as const };
    const { bySection, wholePost } = groupIssuesBySection([
      { ...base, id: 'a', title: 'A', sectionIndex: 1 },
      { ...base, id: 'b', title: 'B', sectionIndex: 1 },
      { ...base, id: 'c', title: 'C', sectionIndex: -1 },
    ]);
    expect(bySection.get(1)).toHaveLength(2);
    expect(wholePost).toHaveLength(1);
  });
});

describe('프롬프트', () => {
  it('비평 프롬프트에 구간 목록과 코드 진단이 함께 들어간다', () => {
    const codeIssues = diagnosePost({ title: '보험금 청구 방법', html: POST });
    const prompt = buildCritiquePrompt({ title: '보험금 청구 방법', html: POST, codeIssues, competitors: [{ title: '경쟁글' }] });
    expect(prompt).toContain('[구간 1] 청구 기한');
    expect(prompt).toContain('경쟁글');
    expect(prompt).toContain('JSON 배열만');
  });

  it('수정 프롬프트는 이미지·링크·H2 유지를 명시한다', () => {
    const section = splitSections(POST)[1]!;
    const prompt = buildSectionRevisionPrompt({
      title: '보험금 청구 방법',
      section,
      issues: [{ id: 'x', area: 'substance', severity: 'high', title: '얇다', detail: 'd', evidence: 'e', fix: 'f', sectionIndex: 1, origin: 'code' }],
      wholePostIssues: [],
    });
    expect(prompt).toContain('<img>');
    expect(prompt).toContain('<a href>');
    expect(prompt).toContain('<h2>');
    expect(prompt).toContain('지어내지 마세요');
  });
});

describe('발행글 비평의 오탐 차단 (v3.8.619)', () => {
  it('메타 description 은 본문 밖에 있으므로 지적하지 않는다', () => {
    const issues = diagnosePost({ title: '제목', html: '<p>본문입니다.</p>' });
    expect(issues.some((i) => i.id === 'quality-metaDescription')).toBe(false);
  });
});
