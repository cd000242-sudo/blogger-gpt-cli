/**
 * v3.8.760 — 젠스파크 딥 리서치 결과를 근거 후보로 바꾼다
 *
 * 사장님 결정(2026-10-10): 결과는 **근거로만** 쓴다 · 처음부터 고객 기능.
 * 실측(청년미래적금 2차 조건·서류, 약 2분 10초): 결과 전체가 GET /api/project?id=<작업번호> 한 번에 온다.
 *   messages[].session_state.batch_result_dict[검색어].organic_results  — 검색 15개
 *   messages[].session_state.url_analysis_list[] {url,title,page_content} — 실제로 읽은 페이지 원문(30건/25주소)
 *   article_content(최종 보고서) · answer_content(페이지별 AI 답) — AI 가 쓴 글이라 근거로 쓰지 않는다
 * 자료는 그 응답에서 계정 필드를 빼고 줄인 것이다(__tests__/fixtures/genspark-project-2026-10-10.json).
 */
import * as fs from 'fs';
import * as path from 'path';
import { parseGensparkProject, gensparkDrafts } from '../src/core/genspark/genspark-evidence';
import { judgeEvidence } from '../src/core/final/evidence';

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'genspark-project-2026-10-10.json'), 'utf8'));
const KEYWORD = '청년미래적금 2차 신청 조건';

describe('parseGensparkProject — 실측 응답 읽기', () => {
  const r = parseGensparkProject(fixture);

  test('완료 상태를 읽는다', () => {
    expect(r.finished).toBe(true);
    expect(r.status).toBe('FINISHED');
  });

  test('실제로 읽은 페이지를 주소 기준으로 한 번씩 모은다 (30건 → 25주소)', () => {
    expect(r.pages.length).toBe(25);
    expect(new Set(r.pages.map((p) => p.url)).size).toBe(25);
    expect(r.pages.some((p) => /fsc\.go\.kr/.test(p.url))).toBe(true);
  });

  test('검색어를 모은다', () => {
    expect(r.queries.length).toBeGreaterThanOrEqual(10);
    expect(r.queries).toContain('청년미래적금 2차 신청 서류');
  });

  /**
   * 실측(2026-10-10 두 번째 실행): 시작 15초에 status 는 이미 'FINISHED' 였고 페이지 0곳·보고서 없음.
   * 그걸 완료로 보고 창을 닫자 조사가 6곳에서 끊겼다(역할 user,assistant,tool,tool,assistant,tool,tool · stop_reason 없음).
   */
  test('⭐ status 가 FINISHED 여도 조사가 안 끝났으면(멈춘 이유·보고서 없음) 완료가 아니다', () => {
    const midRun = {
      status: 0,
      data: { status: 'FINISHED', session_state: { messages: [
        { role: 'user' }, { role: 'assistant' },
        { role: 'tool', session_state: { url_analysis_list: [{ url: 'https://www.fsc.go.kr/x', title: 't', page_content: '본문'.repeat(60) }] } },
      ] } },
    };
    const r = parseGensparkProject(midRun);
    expect(r.finished).toBe(false);
    expect(r.pages.length).toBe(1);
  });

  test('최종 보고서가 생기면 완료다', () => {
    const done = { data: { status: 'FINISHED', session_state: { messages: [{ role: 'assistant', session_state: { article_content: '보고서' } }] } } };
    expect(parseGensparkProject(done).finished).toBe(true);
  });

  test('이상한 입력이면 빈 결과(던지지 않는다)', () => {
    expect(parseGensparkProject(null)).toEqual({ status: '', finished: false, pages: [], queries: [] });
    expect(parseGensparkProject({ data: { status: 'RUNNING' } }).finished).toBe(false);
  });
});

describe('gensparkDrafts — 근거 후보로 바꾸기', () => {
  const drafts = gensparkDrafts(parseGensparkProject(fixture));

  test('본문이 있는 후보다(hasBody) · 출처 꼬리표가 젠스파크다', () => {
    expect(drafts.length).toBeGreaterThan(15);
    for (const d of drafts) {
      expect(d.hasBody).toBe(true);
      expect(d.query.startsWith('genspark:')).toBe(true);
    }
  });

  test('마크다운 그림·링크 기호와 HTML 태그를 걷어낸다', () => {
    for (const d of drafts) {
      expect(d.text).not.toMatch(/!\[[^\]]*\]\(/);
      expect(d.text).not.toMatch(/<\/?(table|tbody|tr|td|span|p)\b/i);
    }
  });

  test('본문은 앱의 보존 상한(6,000자)까지 — 잘렸으면 잘린 위치를 남긴다', () => {
    for (const d of drafts) expect(d.text.length).toBeLessThanOrEqual(6000);
    const cut = drafts.filter((d) => typeof d.truncatedAt === 'number');
    expect(cut.length).toBeGreaterThan(0);
  });

  test('⭐ AI 가 쓴 보고서·페이지별 답은 근거 글에 들어가지 않는다', () => {
    const report = String(fixture.data.session_state.messages.map((m: any) => m.session_state?.article_content).find(Boolean)).slice(0, 80);
    const answers = fixture.data.session_state.messages.flatMap((m: any) => (m.session_state?.url_analysis_list || []).map((p: any) => String(p.answer_content || '').slice(0, 60))).filter((s: string) => s.length > 40);
    for (const d of drafts) {
      expect(d.text.includes(report)).toBe(false);
      for (const a of answers) expect(d.text.includes(a)).toBe(false);
    }
  });

  /** 실측: 읽은 페이지 30건 모두 title 칸이 주소였다. 검색 결과 제목(21건) → 본문 첫 줄 순서로 채운다 */
  test('⭐ 제목이 주소면 검색 결과의 실제 제목, 없으면 본문 첫 줄로 채운다', () => {
    for (const d of drafts) expect(d.title).not.toMatch(/^https?:\/\//);
    const organic = new Map<string, string>();
    for (const m of fixture.data.session_state.messages) {
      for (const r of Object.values((m.session_state || {}).batch_result_dict || {}) as any[]) {
        for (const o of r.organic_results || []) organic.set(o.link, o.title);
      }
    }
    const withOrganic = drafts.filter((d) => organic.has(d.url));
    expect(withOrganic.length).toBeGreaterThan(10);
    for (const d of withOrganic) expect(d.title).toBe(organic.get(d.url));
  });

  test('주소로 출처 종류 꼬리표를 단다 — 언론은 news', () => {
    const mk = drafts.find((d) => /mk\.co\.kr/.test(d.url));
    expect(mk?.tag).toBe('news');
  });
});

describe('기존 관련도 심사를 그대로 통과시킨다', () => {
  const drafts = gensparkDrafts(parseGensparkProject(fixture));
  const judged = drafts.map((d) => judgeEvidence(d, KEYWORD));

  test('⭐ 금융위원회 보도자료는 공식(정부) 근거로 들어간다', () => {
    const fsc = judged.map((j) => j.item).filter((i) => i && /fsc\.go\.kr/.test(i.url));
    expect(fsc.length).toBeGreaterThanOrEqual(1);
    expect(fsc[0]!.isOfficial).toBe(true);
    expect(fsc[0]!.sourceType).toBe('government');
    expect(fsc[0]!.hasBody).toBe(true);
  });

  test('관련도가 낮은 페이지는 심사에서 떨어질 수 있다(통과 + 탈락 = 전체)', () => {
    const passed = judged.filter((j) => j.item).length;
    const rejected = judged.filter((j) => j.rejected).length;
    expect(passed + rejected).toBe(drafts.length);
    expect(passed).toBeGreaterThan(10);
  });
});
