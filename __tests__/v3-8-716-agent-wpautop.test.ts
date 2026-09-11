/**
 * 에이전트 글이 워드프레스에서 깨지던 문제 (v3.8.716)
 *
 * 사장님: "에이전트로 발행하면 어떤 글이든지 이렇게 빈 공간이 생기거든?"
 *
 * 실측(발행글 5707)에서 세 증상이 한 뿌리였다:
 *   · 제목 아래 빈 공간      ← 본문에 실린 <meta> 11개를 wpautop 이 <p>+<br> 로 쌓음
 *   · CTA 카드 3조각 분해    ← <a> flex 안에 wpautop 이 </p> 를 끼워 넣음
 *   · 박스 아래 과잉 여백    ← 짝 없는 </p> 14개가 만든 유령 빈 문단
 *
 * 막는 코드(v3.8.605 neutralizeWpAutop · v3.8.609 stripHeadOnlyTags)는 이미 있었지만
 * **앱이 부르지 않는 함수**(publishToWordPress)에만 붙어 있었다. 실제 경로는
 * WordPressPublisher.publish() 다(dist/core/index.js 가 이 클래스만 쓴다).
 *
 * 그래서 이 테스트는 두 가지를 잠근다:
 *   ① 두 함수가 깨진 본문을 실제로 고치는가 (동작)
 *   ② 그 두 함수가 **실제로 쓰이는 경로**에 배선돼 있는가 (조용한 미배선 차단)
 */
import * as fs from 'fs';
import * as path from 'path';
import { neutralizeWpAutop } from '../src/wordpress/wordpress-publisher';
import { stripHeadOnlyTags } from '../src/core/final/head-tag-strip';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

/** 발행글 5707 이 깨지기 **전** 모양 — 에이전트가 내보낸 그대로(줄바꿈이 태그 안쪽에 있다) */
const AGENT_HTML = [
  '<meta name="description" content="근로장려금 상반기분 신청 안내">',
  '<meta property="og:title" content="2026 근로장려금 330만원">',
  '<meta name="twitter:card" content="summary_large_image">',
  '<article class="bgpt-wp-ready bgpt-codex-workshop">',
  '<div style="display:flex;flex-direction:column;gap:10px;">',
  '    <a href="https://www.nts.go.kr" target="_blank" style="display:flex;align-items:center;">',
  '      <div style="flex:1;min-width:0;">',
  '        <div style="font-weight:700;">근로·자녀장려금 제도 안내와 신청자격 기준</div>',
  '        <div style="font-size:12px;">국세청 · 공식 누리집</div>',
  '      </div>',
  '      <span style="flex-shrink:0;">→</span>',
  '    </a>',
  '  </div>',
  '</article>',
].join('\n');

describe('① 본문에 섞인 head 태그를 걷는다', () => {
  it('⭐⭐ meta 3개를 지우고 본문은 남긴다', () => {
    const result = stripHeadOnlyTags(AGENT_HTML);
    expect(result.removed).toBe(3);
    expect(result.html).not.toMatch(/<meta\b/i);
    expect(result.html).toContain('근로·자녀장려금 제도 안내와 신청자격 기준');
  });
});

describe('② wpautop 이 파고들 줄바꿈을 없앤다', () => {
  it('⭐⭐ 태그 안쪽 줄바꿈이 사라진다 (워드프레스가 <p>·<br> 를 못 넣는다)', () => {
    const cleaned = neutralizeWpAutop(stripHeadOnlyTags(AGENT_HTML).html);
    expect(cleaned).not.toMatch(/\r?\n/);
    // flex 카드 한 장이 통째로 남아 있어야 한다 — 쪼개지면 CTA 가 죽는다
    expect(cleaned).toMatch(/<a href="https:\/\/www\.nts\.go\.kr"[^>]*>\s*<div style="flex:1/);
    expect(cleaned).toContain('국세청 · 공식 누리집');
  });

  it('⭐ <pre> 안의 줄바꿈은 지키지 않으면 코드가 깨진다', () => {
    const withPre = 'a\n<pre>1\n2</pre>\nb';
    expect(neutralizeWpAutop(withPre)).toContain('<pre>1\n2</pre>');
  });
});

describe('③ 실제로 쓰이는 발행 경로에 배선돼 있다', () => {
  const source = read('src/wordpress/wordpress-publisher.ts');
  /** WordPressPublisher.publish() 본문 — 클래스 선언부터 postData 조립까지 */
  const publishBody = source.slice(
    source.indexOf('export class WordPressPublisher'),
    source.indexOf('content: optimizedContent,'),
  );

  it('⭐⭐ 앱이 부르는 publish() 안에서 두 그물을 다 친다', () => {
    expect(publishBody.length).toBeGreaterThan(0);
    expect(publishBody).toContain('stripHeadOnlyTags');
    expect(publishBody).toContain('neutralizeWpAutop');
  });

  it('⭐⭐ 발행에 실리는 본문(optimizedContent)에 결과를 되돌려 담는다', () => {
    // 호출만 하고 반환값을 버리면 코드는 있는데 아무 일도 안 일어난다 (6회 재발한 실수)
    expect(publishBody).toMatch(/optimizedContent\s*=\s*neutralizeWpAutop\(/);
    expect(publishBody).toMatch(/optimizedContent\s*=\s*cleaned\.html/);
  });

  it('⭐ 워드프레스 발행에는 본문 메타를 다시 넣지 않는다', () => {
    const main = read('electron/main.ts');
    expect(main).toContain('const metaBelongsInHead = publishPlatform.includes(\'wordpress\');');
    expect(main).toMatch(/if \(metaParts\.length > 0 && metaBelongsInHead\)/);
  });
});
