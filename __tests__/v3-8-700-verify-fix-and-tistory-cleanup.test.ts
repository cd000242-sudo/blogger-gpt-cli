/**
 * v3.8.700 — ① 비평 무한루프의 진짜 원인 ② 티스토리 SCRIPT·썸네일 (실측 재확인)
 *
 * 사장님:
 *   "지적한걸 수정하고 다시비평을했는데 또 똑같은 지적이 나오면 어쩌란거냐고
 *    이거 고치랫는데 왜안고치냐 한번고칠때 완벽히 고쳐야되는거아니니?"
 *   "보통 티스토리 썸네일은 이렇게나와야 정상아니니?? 이렇게나오는데?"
 *   "생성된 글목록에서 미리보기 수정 누르고 들어가면 스크립트 여전히 그대로 보이고"
 *
 * ## ① v3.8.693 은 엉뚱한 절반을 고쳤다
 * 그때 넣은 `resolved`("이미 고쳤으니 다시 말하지 마세요")는 **AI 비평 프롬프트에만** 들어간다.
 * 그런데 되풀이된 지적 네 건은 전부 **코드 진단**이었다 —
 * article-audit(같은 말 반복 · 근거 조항 없음) · quality-gate(출처 구체성) · reader-retention(FAQ 어긋남).
 * 코드 진단은 새 본문을 다시 재므로 프롬프트로 입막음이 안 된다.
 *
 * 진짜 구멍: **고친 뒤 정말 고쳐졌는지 아무도 확인하지 않았다.**
 *
 * ## ② 티스토리 — v3.8.695 도 절반이었다 (실측 leadernam.tistory.com/316)
 *   JSON-LD 가 본문에 **2개** 남아 있었다 — 발행처가 orchestration 말고 generation 에도 있었다.
 *   썸네일 박스가 **43,022자** 지점에 있었다 — 내가 정한 탐색창 4,000자를 한참 넘는다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const draft = read('src/core/final/editor-draft.ts');
const publisher = read('src/tistory/tistory-publisher.ts');
const editor = read('electron/ui/modules/editor.js');
const modal = read('electron/ui/modules/post-critique-modal.js');

describe('① 고쳤다고 말하기 전에 다시 잰다', () => {
  test('⭐ 코드 진단으로 남은 지적을 다시 잰다', () => {
    expect(draft).toContain('function measureRemaining');
    expect(draft).toContain('diagnosePost({ title, html, competitors: [] })');
  });

  test('⭐ 재는 데 실패하면 "고쳤다"고 단정하지 않는다', () => {
    const fn = blockBetween(draft, 'function measureRemaining', 'export async function improveDraft');
    expect(fn).toContain('return wanted;');   // 모르면 남은 것으로 둔다
  });

  test('⭐ 남아 있으면 그 구간만 한 번 더 고친다 — 처방을 함께 준다', () => {
    const fn = blockBetween(draft, 'let stillPresent = measureRemaining', 'const actuallyFixed');
    expect(fn).toContain('그대로 남아 있습니다');
    expect(fn).toContain('처방:');
    expect(fn).toContain('acceptRevisedSection');
  });

  test('⭐ 재시도 뒤 다시 재서 결과를 갱신한다', () => {
    const fn = blockBetween(draft, 'let stillPresent = measureRemaining', 'const actuallyFixed');
    expect(fn).toContain('stillPresent = measureRemaining(title, html, wanted)');
  });

  test('⭐ 실제로 사라진 것과 남은 것을 나눠 돌려준다', () => {
    expect(draft).toContain('actuallyFixed: string[];');
    expect(draft).toContain('stillPresent: string[];');
    expect(draft).toContain('const actuallyFixed = wanted.filter((t) => !stillPresent.includes(t))');
  });
});

describe('② 실제로 사라진 것만 "해결"로 기억한다', () => {
  test('⭐ 편집기가 actuallyFixed 를 쓴다 — 안 그러면 눈만 가린다', () => {
    const fn = editor.slice(editor.indexOf("modalRefs.critiqueBtn?.addEventListener"));
    const body = blockBetween(fn, 'const fixed = Array.isArray(res.actuallyFixed)', 'return { ...res');
    expect(body).toContain('res.actuallyFixed');
    expect(body).toContain('session.resolvedIssues = [...new Set([...session.resolvedIssues, ...fixed])]');
  });

  test('⭐ 남은 게 있으면 상태줄에 숫자로 말한다', () => {
    expect(editor).toContain('건은 두 번 고쳐도 남아 있습니다');
  });

  test('⭐ 결과 창이 남은 지적을 그대로 보여준다', () => {
    expect(modal).toContain('두 번 고쳤는데도 남은 지적');
    expect(modal).toContain('${stillRows}');
    expect(modal).toContain('다음 비평에도 그대로 나옵니다');
  });

  test('왜 안 고쳐지는지 이유를 적어 준다 — 지어낼 수 없는 것이 있다', () => {
    expect(modal).toContain('없는 사실을 지어낼 수 없거나');
  });
});

describe('③ 티스토리 — JSON-LD 를 나가기 직전에 전부 걷어낸다', () => {
  test('⭐ 걷어내는 함수가 있고 최종 조립에서 부른다', () => {
    expect(publisher).toContain('function stripBodyJsonLd');
    const fn = blockBetween(publisher, 'export function buildTistoryFinalHtml', 'const uploadedSource');
    expect(fn).toContain('html = stripBodyJsonLd(html)');
  });

  test('⭐ 만드는 쪽이 여럿이라 마지막 관문에서 막는다 (실측 2개 남아 있었다)', () => {
    // orchestration(Article 그래프) + generation(FAQ 스키마) — 하나씩 막으면 새는 곳이 남는다
    expect(read('src/core/final/orchestration.ts')).toContain('skipBodyJsonLd');
    expect(read('src/core/final/generation.ts')).toContain('application/ld+json');
  });
});

describe('④ 티스토리 — 썸네일 박스를 문서 어디에 있든 지운다', () => {
  test('⭐ 앞부분 창이 아니라 전체에서 찾는다 (실측 43,022자 지점)', () => {
    const fn = blockBetween(publisher, 'function stripGeneratedThumbnailHero', 'export function buildTistoryImageFallback');
    expect(fn).toContain('dropFirst(');
    expect(fn).toContain('bgpt-thumbnail-box');
  });

  test('⭐ 맨몸 <img> 는 여전히 앞부분만 본다 — 글 중간의 같은 이미지를 지우면 안 된다', () => {
    const fn = blockBetween(publisher, 'function stripGeneratedThumbnailHero', 'export function buildTistoryImageFallback');
    expect(fn).toContain('dropFirstInHead(');
  });

  test('두 함수가 따로 있다 (전체 탐색 · 앞부분 탐색)', () => {
    expect(publisher).toContain('function dropFirst(html: string, pattern: RegExp)');
    expect(publisher).toContain('function dropFirstInHead(html: string, pattern: RegExp)');
  });
});
