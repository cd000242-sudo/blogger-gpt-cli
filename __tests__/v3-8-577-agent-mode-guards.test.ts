/**
 * v3.8.577 — 에이전트 모드에도 같은 검사를 건다
 *
 * 사장님: "에이전트들은 제대로 연동되어있냐?"
 *
 * ## 왜 따로 확인해야 하나
 * 에이전트 모드는 `orchestration.ts` 를 **타지 않는다.** electron/main.ts 가 손으로 쓴
 * 지시서를 외부 CLI 에 넘기고 결과 HTML 만 회수한다. 그래서 API 경로에 규칙을 넣어도
 * 에이전트 쪽엔 하나도 안 걸린다 — 이 저장소에서 실제로 한 번 크게 데인 지점이다.
 *
 * 이번에 만든 검사가 딱 그 함정에 빠져 있었다:
 *   · structure-guard (열거 구멍·앞 잘린 문단·과한 단정) → 미배선
 *   · 광고 랜딩·타 블로그 링크 검사                    → 미배선 (judgeCtaHost 를 안 탄다)
 *   · 경고가 console.warn 으로만 나가 화면에 안 보임
 *
 * ## 지켜야 할 제약
 * 에이전트 모드는 **구독 CLI 를 쓰려고 고른 모드**다. 후처리에서 유료 API 를 부르면
 * 그 선택을 뒤집는 셈이다. 그래서 붙인 검사는 전부 **무료 로컬 연산**이어야 한다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { postProcessAgentArticle } from '../src/core/final/agent-harness';
import { braceBlock } from './helpers/source-block';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

describe('① 구조 검사가 에이전트 결과에도 걸린다', () => {
  test('열거 구멍을 잡는다 (2·3·4세대는 있고 1세대가 없다)', () => {
    const html = '<p>2세대 실손은 연 180회입니다.</p><p>3세대는 다릅니다.</p><p>4세대는 비급여를 나눴습니다.</p>';
    const r = postProcessAgentArticle(html);
    expect(r.structureIssues).toBeGreaterThan(0);
    expect(r.warnings.join(' ')).toContain('1세대');
  });

  test('소제목 첫 문단이 "반면"으로 시작하면 잡는다', () => {
    const html = '<h2>세대별 비교</h2><p>반면 2세대는 연 180회 한도입니다.</p>';
    expect(postProcessAgentArticle(html).warnings.join(' ')).toContain('반면');
  });

  test('멀쩡한 글에는 구조 경고가 없다', () => {
    const html = '<h2>안내</h2><p>신청 절차를 순서대로 정리했습니다.</p><p>서류는 두 가지입니다.</p>';
    expect(postProcessAgentArticle(html).structureIssues).toBe(0);
  });
});

describe('② 링크 검사 — 에이전트는 judgeCtaHost 관문을 안 탄다', () => {
  test('광고 랜딩을 잡는다', () => {
    const html = '<p>참고: <a href="https://www.lawthedream.com/insurance?utm_source=naver&n_rank=1">상담</a></p>';
    const r = postProcessAgentArticle(html);
    expect(r.badLinks).toBe(1);
    expect(r.warnings.join(' ')).toContain('광고 랜딩');
  });

  /** 사장님 규칙: 허브글이 없어 나간 트래픽이 돌아오지 않는다 */
  test('타 블로그·카페를 잡는다', () => {
    const html = '<p><a href="https://blog.naver.com/x/1">글</a> <a href="https://y.tistory.com/2">글</a></p>';
    expect(postProcessAgentArticle(html).badLinks).toBe(2);
  });

  test('기관 링크는 통과시킨다 (과잉 차단 금지)', () => {
    const html = '<p><a href="https://www.fss.or.kr/fss/main/contents.do?menuNo=200520">금감원</a></p>';
    expect(postProcessAgentArticle(html).badLinks).toBe(0);
  });

  test('자기 사이트 링크는 세지 않는다', () => {
    const html = '<p><a href="https://leadernam.com/tax/foo/">내 글</a></p>';
    expect(postProcessAgentArticle(html).badLinks).toBe(0);
  });

  test('같은 주소가 여러 번 나와도 한 번만 센다', () => {
    const u = 'https://blog.naver.com/x/1';
    expect(postProcessAgentArticle(`<p><a href="${u}">a</a><a href="${u}">b</a></p>`).badLinks).toBe(1);
  });
});

describe('③ 발행을 막지 않는다 · 던지지 않는다', () => {
  test('빈 값·깨진 HTML 에도 던지지 않는다', () => {
    for (const bad of ['', null, undefined, '<p>안 닫힘', '<<>>']) {
      expect(() => postProcessAgentArticle(bad as any)).not.toThrow();
    }
  });

  test('경고가 있어도 본문은 그대로 돌려준다', () => {
    const html = '<p><a href="https://blog.naver.com/x/1">글</a></p>';
    const r = postProcessAgentArticle(html);
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.html).toContain('blog.naver.com');   // 고쳐 주는 게 아니라 알리는 것이다
  });
});

describe('④ 배선 — 두 경로가 같은 모듈을 쓴다', () => {
  const harness = read('src/core/final/agent-harness.ts');
  const main = read('electron/main.ts');

  test('규칙을 복사하지 않고 원본을 import 한다', () => {
    expect(harness).toContain("import { findStructureIssues } from './structure-guard'");
    expect(harness).toContain("import { hasAdTracking, isUserGeneratedUrl } from '../../cta/host-trust'");
  });

  test('후처리에서 실제로 부른다 (만들고 안 부르면 죽은 코드다)', () => {
    expect(harness).toContain('findStructureIssues(out)');
    expect(harness).toContain('findBadOutboundLinks(out)');
  });

  /** 에이전트 모드는 구독 CLI 를 쓰려고 고른 모드다 — 후처리에서 과금하면 안 된다 */
  test('후처리가 유료 API 를 부르지 않는다', () => {
    const at = harness.indexOf('export function postProcessAgentArticle');
    const body = harness.slice(at);
    expect(body).not.toMatch(/callGemini|callLLM|openai|anthropic|fetch\(/i);
  });

  test('경고가 화면에도 올라간다 (콘솔만이면 아무도 못 본다)', () => {
    expect(main).toContain("w.webContents.send('log-line', `⚠️ [에이전트 품질] ${line}`)");
    expect(main).toContain('for (const w of report.warnings) shout(w)');
  });

  test('창 하나가 실패해도 나머지에 계속 보낸다', () => {
    // 길이(+700)로 자르면 위아래 코드가 조금만 바뀌어도 검사 범위가 어긋난다 — 경계로 자른다
    const block = braceBlock(main, 'const shout = (line: string)');
    expect(block).toContain('isDestroyed()');
    expect(block).toContain('catch');
  });
});
