/**
 * v3.8.508 — 스레드 실물 검수 2차 (2026-08-16 사장님 붙여넣기)
 *
 * 실물 3안 전부 실명 사실 0건("기간도 종류마다 다르대"), 본문 끝 URL, 공유형은 본문 없음.
 * 뿌리 3개:
 *  ① 발행 글 목록 source 에 본문이 없어 sourceText 가 빈 채로 갔다 — 프롬프트의
 *     7000자 본문 슬롯은 "(본문 없음)", 요약 폴백엔 인코딩된 URL 이 본문 행세.
 *     실명할 사실이 물리적으로 공급되지 않았다 (조용한 미배선 6번째 사례).
 *  ② 변형 패널의 "최종 글 복사"(_getThreadsVariantCopy)가 v3.8.505 이전 조립
 *     (sharePrompt 포함 + 본문 끝 URL)을 그대로 썼다 — parts 계약은 스레드 전용
 *     카드(_renderThreadsResultCard)에 도달하지 않았다.
 *  ③ 하네스가 배선 문자열만 봤다 — "본문이 비어도 조용히 통과"를 못 잡았다.
 */
import * as fs from 'fs';
import * as path from 'path';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');

describe('① 원문 공급선 — sourceText 가 얇으면 원문을 직접 가져온다', () => {
  const sourceText = require('../src/core/external-traffic/_shared/source-text');

  it('본문이 이미 충분하면 그대로 쓴다 (네트워크 안 탄다)', async () => {
    const long = '가'.repeat(400);
    await expect(sourceText.ensureSourceText({ sourceText: long, sourceUrl: 'https://x.com' }))
      .resolves.toBe(long);
  });

  it('본문도 URL도 없으면 조용히 빈 값 — 생성을 막지 않는다', async () => {
    await expect(sourceText.ensureSourceText({ sourceText: '', sourceUrl: '' }))
      .resolves.toBe('');
  });

  it('stripHtmlToText: style/script 내용물이 본문으로 새지 않는다 (CSS 본문 사고 재발 방지)', () => {
    const html = '<style>.x{color:red}</style><script>var a=1;</script><p>양도세 본문 내용</p>';
    const text = sourceText.stripHtmlToText(html);
    expect(text).toContain('양도세 본문 내용');
    expect(text).not.toContain('color:red');
    expect(text).not.toContain('var a=1');
  });

  it('stripHtmlToText: <article> 이 있으면 그 안만 — 메뉴·푸터가 사실 후보를 오염시키지 않는다', () => {
    const html = '<nav>메뉴 항목</nav><article><p>부과제척기간은 10년이다</p></article><footer>푸터 링크</footer>';
    const text = sourceText.stripHtmlToText(html);
    expect(text).toContain('부과제척기간은 10년이다');
    expect(text).not.toContain('메뉴 항목');
    expect(text).not.toContain('푸터 링크');
  });

  it('디스패처가 ensureSourceText 를 내보낸다 (main 핸들러가 쓴다)', () => {
    const dispatcher = require('../src/core/external-traffic');
    expect(typeof dispatcher.ensureSourceText).toBe('function');
  });

  it('main v2 핸들러가 요약 조립 전에 원문을 복원한다', () => {
    const main = read('electron/main.ts');
    const handler = main.slice(
      main.indexOf("ipcMain.handle('generate-external-traffic-text-v2'"),
    );
    const ensureIdx = handler.indexOf('dispatcher.ensureSourceText');
    const summaryIdx = handler.indexOf('dispatcher.buildMinimalSummary');
    expect(ensureIdx).toBeGreaterThan(-1);
    expect(summaryIdx).toBeGreaterThan(-1);
    expect(ensureIdx).toBeLessThan(summaryIdx);
  });
});

describe('② 요약 폴백 — URL 은 본문이 아니다', () => {
  const dispatcher = require('../src/core/external-traffic');

  it('contentHint 가 URL 이면 무시하고 제목을 쓴다 (인코딩 URL 이 coreValue 행세하던 사고)', () => {
    const summary = dispatcher.buildMinimalSummary('양도세 비과세 추징', 'https://leadernam.com/tax/%ec%96%91%eb%8f%84');
    expect(summary.coreValue).toBe('양도세 비과세 추징');
    expect(summary.keyPoints).toEqual(['양도세 비과세 추징']);
  });

  it('contentHint 가 진짜 본문이면 그대로 쓴다', () => {
    const summary = dispatcher.buildMinimalSummary('제목', '부과제척기간은 무신고 7년, 부정행위 10년이다.');
    expect(summary.coreValue).toContain('부과제척기간');
  });
});

describe('③ 변형 패널 parts 조립 — 본문 무링크·첫 댓글 링크', () => {
  const ui = read('electron/ui/modules/external-traffic.js');

  it('parts 빌더가 존재하고 패널이 그걸 쓴다', () => {
    expect(ui).toContain('function _getThreadsVariantParts');
    const panel = ui.slice(
      ui.indexOf('function _renderThreadsVariantPanel'),
      ui.indexOf('function _renderNaverBlogResultCard'),
    );
    expect(panel).toContain('_getThreadsVariantParts');
  });

  it('parts 조립에 sharePrompt(재게시 유도문)와 본문 URL 붙이기가 없다', () => {
    const builder = ui.slice(
      ui.indexOf('function _getThreadsVariantParts'),
      ui.indexOf('function _renderNaverBlogResultCard'),
    );
    expect(builder).not.toContain('sharePrompt');
    expect(builder).not.toContain('_appendExtTrafficSourceUrl');
  });

  it('본문에서 URL 을 걷어내고, 링크는 첫 댓글 몫이다', () => {
    const builder = ui.slice(
      ui.indexOf('function _getThreadsVariantParts'),
      ui.indexOf('function _getThreadsVariantCopy'),
    );
    expect(builder).toMatch(/replace\(\/https\?:\\\/\\\/\[\^\\s\]\+\/g, ''\)/);
    expect(builder).toContain('firstComment');
  });

  it('패널에 본문·첫 댓글 복사 버튼이 따로 있다 (한 덩어리 복사 제거)', () => {
    const panel = ui.slice(
      ui.indexOf('function _renderThreadsVariantPanel'),
      ui.indexOf('function _renderNaverBlogResultCard'),
    );
    expect(panel).toContain('본문 복사');
    expect(panel).toContain('첫 댓글 복사');
    expect(panel).toContain('threadsPartPost_');
    expect(panel).toContain('threadsPartComment_');
  });

  it('복사 핸들러가 part 별로 동작한다', () => {
    expect(ui).toContain('function extTrafficCopyThreadsPart');
  });
});

describe('④ 실명 사실 배지 — 두루뭉실을 화면에서 바로 보이게', () => {
  const ui = read('electron/ui/modules/external-traffic.js');

  it('숫자+단위 토큰 카운터가 있고, 제목 재탕은 안 쳐준다', () => {
    expect(ui).toContain('function _countThreadsNamedFacts');
    const counter = ui.slice(
      ui.indexOf('function _countThreadsNamedFacts'),
      ui.indexOf('function _renderThreadsVariantPanel'),
    );
    expect(counter).toContain('title');
  });

  it('패널이 실명 사실 개수를 배지로 보여준다', () => {
    const panel = ui.slice(
      ui.indexOf('function _renderThreadsVariantPanel'),
      ui.indexOf('function _renderNaverBlogResultCard'),
    );
    expect(panel).toContain('실명 사실');
    expect(panel).toContain('다시 생성 권장');
  });
});
