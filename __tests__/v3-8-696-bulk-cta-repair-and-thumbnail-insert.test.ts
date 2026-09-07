/**
 * v3.8.696 — CTA 일괄 점검·교체 도구 + 썸네일 넣기
 *
 * 사장님: "일괄 점검 교체 도구 만들고 이미지를 삽입은 있는데 썸네일 삽입은없네..??"
 *
 * ## 왜 필요했나
 * v3.8.688~695 에서 고친 것은 전부 **앞으로 만들어질 CTA** 다. 이미 나가 있는 글은 그대로다.
 * 실측(2026-09-07, 183편 · CTA 113개): 죽은 링크 14개 · 기관 홈/문서파일 48개.
 * 글마다 편집기를 열면 100편이 넘는다.
 *
 * 점검 채널(cta-audit-run)은 v3.8.572 에 **이미 있었는데 버튼이 없어 아무도 못 썼다** —
 * 이 저장소가 반복해 온 "만들고 안 부르면 죽은 코드" 다.
 *
 * ## 썸네일 넣기가 따로 필요한 이유
 * [🖼️ 이미지] 는 커서 자리에 `<p>` 로 넣는다. 그런데 썸네일 판정은 `div.separator img`
 * (computeThumbnailUrl) 라서 `<p>` 로 넣으면 **대표 이미지가 되지 않는다.**
 */
import * as fs from 'fs';
import * as path from 'path';
import { applyCtaUrlSwaps, pickRepairTargets, describeRepairPlan } from '../src/cta/bulk-repair';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const main = read('electron/main.ts');
const posts = read('electron/ui/modules/published-posts.js');
const modal = read('electron/ui/modules/cta-audit-modal.js');
const editor = read('electron/ui/modules/editor.js');

describe('① 주소만 갈아끼운다', () => {
  const OLD = 'https://old.go.kr/dead.do?a=1&b=2';
  const NEW = 'https://new.go.kr/apply.do';

  test('⭐ href 안의 주소를 바꾼다', () => {
    const html = `<p>본문</p><a class="cta-btn" href="${OLD}">신청</a>`;
    const r = applyCtaUrlSwaps(html, [{ from: OLD, to: NEW }]);
    expect(r.changed).toBe(1);
    expect(r.html).toContain(NEW);
    expect(r.html).not.toContain('dead.do');
  });

  test('⭐⭐ &amp; 로 적힌 주소도 찾는다 — 이걸 놓치면 한 건도 못 바꾼다', () => {
    // 발행된 HTML 안에서 & 는 &amp; 로 저장된다. 이 저장소가 감사 스크립트에서 실제로 겪은 함정.
    const html = `<a href="https://old.go.kr/dead.do?a=1&amp;b=2">신청</a>`;
    const r = applyCtaUrlSwaps(html, [{ from: OLD, to: NEW }]);
    expect(r.changed).toBe(1);
    expect(r.html).toContain(NEW);
  });

  test('⭐ 버튼 문구·본문은 건드리지 않는다', () => {
    const html = `<p>자세한 내용은 old.go.kr 에서</p><a href="${OLD}">🔗 신청하기</a>`;
    const r = applyCtaUrlSwaps(html, [{ from: OLD, to: NEW }]);
    expect(r.html).toContain('🔗 신청하기');
    expect(r.html).toContain('old.go.kr 에서');   // 글자로 적힌 주소는 그대로
  });

  test('⭐ 본문에 없으면 조용히 넘기지 않고 알려 준다', () => {
    const r = applyCtaUrlSwaps('<p>본문뿐</p>', [{ from: OLD, to: NEW }]);
    expect(r.changed).toBe(0);
    expect(r.missing).toEqual([OLD]);
  });

  test('같은 주소면 아무것도 하지 않는다', () => {
    expect(applyCtaUrlSwaps(`<a href="${OLD}">x</a>`, [{ from: OLD, to: OLD }]).changed).toBe(0);
  });
});

describe('② 고칠 값어치가 있는 것만 고른다', () => {
  const reports = [
    { postId: 1, title: 'A', link: '', checks: [{ url: 'u1', verdict: 'action', reason: '' }] },
    { postId: 2, title: 'B', link: '', checks: [{ url: 'u2', verdict: 'home', reason: '홈' }] },
    { postId: 3, title: 'C', link: '', checks: [{ url: 'u3', verdict: 'dead', reason: '죽음' }] },
    { postId: 4, title: 'D', link: '', checks: [{ url: 'u4', verdict: 'unknown', reason: '못 읽음' }] },
    { postId: 5, title: 'E', link: '', checks: [{ url: 'u5', verdict: 'document', reason: 'PDF' }] },
  ];

  test('⭐ action 은 건드리지 않는다 — 멀쩡한 것을 바꾸면 나빠질 위험만 있다', () => {
    expect(pickRepairTargets(reports).some((t) => t.verdict === 'action')).toBe(false);
  });

  test('⭐ unknown 도 뺀다 — 못 읽은 것이지 죽은 것이 아니다', () => {
    // 기관 사이트는 인증서 문제로 node 에서만 실패하는 곳이 많다(실측: efine.go.kr)
    expect(pickRepairTargets(reports).some((t) => t.verdict === 'unknown')).toBe(false);
  });

  test('⭐ 급한 순서로 준다 — 죽은 링크가 먼저다', () => {
    expect(pickRepairTargets(reports).map((t) => t.verdict)).toEqual(['dead', 'document', 'home']);
  });

  test('사람이 읽는 한 줄을 만든다', () => {
    expect(describeRepairPlan(pickRepairTargets(reports))).toContain('죽은 링크 1개');
    expect(describeRepairPlan([])).toContain('고칠 CTA 가 없습니다');
  });
});

describe('③ 배선 — 만들고 아무도 안 부르면 조용히 무효다', () => {
  test('⭐ 교체 채널이 메인에 있다', () => {
    expect(main).toContain("ipcMain.handle('cta-bulk-repair'");
  });

  test('⭐ 버튼이 실제로 있고 그 id 를 배선한다', () => {
    expect(posts).toContain('id="ppCtaAuditBtn"');
    expect(posts).toContain("tab.querySelector('#ppCtaAuditBtn').addEventListener");
  });

  test('⭐ 점검 채널을 부른다 — v3.8.572 에 만들고 버튼이 없던 그 채널', () => {
    expect(posts).toContain("invoke('cta-audit-run'");
    expect(modal).toContain("invoke('cta-bulk-repair'");
  });

  test('⭐ 목적지는 게이트를 거친다 — 나쁜 주소를 다른 나쁜 주소로 바꾸지 않는다', () => {
    expect(main).toContain("require('../dist/cta/regenerate')");
    expect(main).toContain('regenerateCta({');
  });

  test('⭐ 못 찾으면 건너뛴다 (기존 버튼 유지)', () => {
    expect(main).toContain('대체 목적지를 못 찾아 그대로 뒀습니다');
  });

  test('⭐ 바뀐 게 없으면 발행하지 않는다', () => {
    expect(main).toContain('if (applied.changed === 0)');
    expect(main).toContain('if (!dryRun) await adapter.updatePost(');
  });

  test('⭐ 시험 실행이 있다 — 발행 전에 무엇이 바뀔지 본다', () => {
    expect(main).toContain('const dryRun = Boolean(payload?.dryRun)');
    expect(modal).toContain('id="ppCtaDry"');
  });

  test('본문 없는 플랫폼(티스토리)은 못 한다고 말한다 — 조용히 빈 결과를 주지 않는다', () => {
    expect(posts).toContain('if (!platform.listHasContent)');
  });

  test('죽은 링크만 미리 켜 둔다 — 전부 켜면 하나씩 끄게 된다', () => {
    expect(modal).toContain("target.verdict === 'dead' ? 'checked' : ''");
  });
});

describe('④ 썸네일 넣기 — 내 PC 이미지를 대표 이미지로', () => {
  test('⭐ 버튼이 있고 배선돼 있다', () => {
    expect(editor).toContain('id="veThumbInsertBtn"');
    expect(editor).toContain("thumbInsertBtn: overlay.querySelector('#veThumbInsertBtn')");
    expect(editor).toContain("modalRefs.thumbInsertBtn?.addEventListener('click'");
  });

  test('⭐ 썸네일로 잡히는 모양(div.separator > img)으로 넣는다', () => {
    const fn = editor.slice(editor.indexOf("modalRefs.thumbInsertBtn?.addEventListener"));
    const body = fn.slice(0, fn.indexOf('modalRefs.thumbBtn?.addEventListener'));
    expect(body).toContain('class="separator"');
    // 썸네일 판정이 실제로 그 선택자를 쓴다
    expect(editor).toContain("doc.querySelector('div.separator img')");
  });

  test('⭐ 이미 썸네일이 있으면 바꿔 끼운다 — 두 장이 되면 위에 나란히 보인다', () => {
    const fn = editor.slice(editor.indexOf("modalRefs.thumbInsertBtn?.addEventListener"));
    const body = fn.slice(0, fn.indexOf('modalRefs.thumbBtn?.addEventListener'));
    expect(body).toContain('existingBox.replaceWith(node)');
    expect(body).toContain('container.insertBefore(node, container.firstChild)');
  });

  test('저장 시 업로드되도록 표시를 단다', () => {
    const fn = editor.slice(editor.indexOf("modalRefs.thumbInsertBtn?.addEventListener"));
    expect(fn.slice(0, fn.indexOf('modalRefs.thumbBtn?.addEventListener'))).toContain('data-bgpt-user-image="1"');
  });

  test('AI 썸네일 생성 버튼은 그대로 있다 — 둘은 다른 일이다', () => {
    expect(editor).toContain('id="veThumbBtn"');
    expect(editor).toContain('🖼️ 썸네일 생성');
    expect(editor).toContain('🖼️ 썸네일 넣기');
  });
});
