/**
 * v3.8.492 — PC 에서 본문이 좁게 나오던 문제
 *
 * 사장님: "워드프레스로 모바일 친화적이지만 PC로볼때는 넓고 쾌적하게 보여야정상아닌가요?"
 *         "PC에서는 PC에 최적화되서 나오고 모바일은 모바일에 최적화되서 나오면좋겠어"
 *
 * ## 원인
 * 본문 컨테이너가 `max-width: 760px !important` 로 묶여 있었다.
 * 의도한 값이긴 하다(주석: 60~70자/줄, 애드센스 권장). 문제는 **폭이 두 번 좁혀진다**는 것이다.
 *   테마 컨테이너(예: 800px) → 우리가 씌운 760px → 좌우 18px 패딩 → 실제 약 724px
 * 넓은 모니터에서 답답해 보이는 이유다.
 *
 * ## 어떻게 고쳤나
 * 화면 크기별로 나눈다. 모바일은 지금처럼 전체폭(이미 잘 돼 있다),
 * PC 는 넓히되 한 줄이 지나치게 길어지지 않게 상한을 둔다.
 * 배경·여백 강제도 푼다 — 다크 테마에서 본문만 하얀 네모로 뜨던 문제도 같이 사라진다.
 *
 * ## 왜 무한정 넓히지 않나
 * 줄이 길면 눈이 다음 줄을 못 찾는다. 한글은 한 줄 40~45자가 읽기 좋다.
 * "넓고 쾌적"과 "읽기 좋음" 사이를 잡는 값이 필요하다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';

const publisher = fs.readFileSync(
  path.join(__dirname, '..', 'src/wordpress/wordpress-publisher.ts'), 'utf-8',
);

/** themeFriendlyCSS 안의 .wp-styled-content 기본 규칙 */
const baseRule = publisher.slice(
  publisher.indexOf('.wp-styled-content {'),
  publisher.indexOf('}', publisher.indexOf('.wp-styled-content {')),
);

describe('① PC 에서 좁게 묶던 제약을 풀었다', () => {
  it('⭐⭐ 기본 규칙이 760px 로 못 박혀 있지 않다', () => {
    expect(baseRule).not.toContain('max-width: 760px');
  });

  it('⭐⭐ 큰 화면용 폭 규칙이 있다', () => {
    expect(publisher).toContain('min-width: 1200px');
  });

  it('⭐⭐ PC 폭이 예전(760px)보다 넓다', () => {
    const desktop = publisher.match(/min-width:\s*1200px[\s\S]{0,400}?max-width:\s*(\d+)px/);
    expect(desktop).not.toBeNull();
    expect(Number(desktop![1])).toBeGreaterThan(760);
  });

  it('⭐⭐ 그래도 상한은 둔다 (한 줄이 너무 길면 읽기 힘들다)', () => {
    const desktop = publisher.match(/min-width:\s*1200px[\s\S]{0,400}?max-width:\s*(\d+)px/);
    expect(Number(desktop![1])).toBeLessThanOrEqual(1100);
  });
});

describe('② 모바일은 건드리지 않았다', () => {
  it('⭐⭐ 모바일 전체폭 규칙이 그대로 있다 (이미 잘 돼 있던 것을 깨면 안 된다)', () => {
    const mobile = publisher.slice(
      publisher.indexOf('/* 모바일 (≤768px) */'),
      publisher.indexOf('/* 모바일 (≤768px) */') + 600,
    );
    expect(mobile).toContain('max-width: 100vw');
    expect(mobile).toContain('padding: 18px 10px');
  });
});

describe('③ 배경·여백 강제를 풀었다', () => {
  it('⭐⭐ 흰 배경을 강제하지 않는다 (다크 테마에서 본문만 하얀 네모가 됐다)', () => {
    expect(baseRule).not.toContain('background: #ffffff !important');
  });

  it('⭐⭐ 좌우 여백을 고정하지 않는다 (테마 여백과 겹쳐 두 번 좁아졌다)', () => {
    expect(baseRule).not.toContain('padding: 20px 18px !important');
  });

  it('⭐ 글꼴·줄간격 같은 타이포그래피는 유지한다 (이건 우리가 정해야 읽기 좋다)', () => {
    expect(baseRule).toContain('line-height');
    expect(baseRule).toContain('word-break: keep-all');
  });
});

describe('③-2 글자색도 테마를 따른다 (배경만 풀면 다크 테마에서 안 보인다)', () => {
  it('⭐⭐ 문단·목록에 검은 글자를 강제하지 않는다', () => {
    // 컨테이너 흰 배경을 풀었는데 글자만 검게 강제하면 다크 테마에서 읽을 수 없다
    expect(publisher).not.toContain('color: #1a1a1a !important; -webkit-text-fill-color: #1a1a1a !important; font-size: 16px');
  });

  it('⭐⭐ 배경을 강제하는 상자는 글자색도 자기가 책임진다', () => {
    // 흰 카드 안에서 테마 글자색(밝은색)을 상속받으면 흰 배경 위 흰 글자가 된다
    const whiteCard = publisher.match(/background:#ffffff !important;[^']*box-shadow[^']*/);
    expect(whiteCard).not.toBeNull();
    expect(whiteCard![0]).toContain('color:#1a1a1a');
  });
});

describe('④ 두 번째 컨테이너도 같이 고쳤다', () => {
  it('⭐⭐ 인라인 컨테이너 스타일도 760px 로 묶지 않는다 (한쪽만 고치면 그대로다)', () => {
    const inline = publisher.slice(
      publisher.indexOf('const containerStyle = usesFinalPreviewSkin'),
      publisher.indexOf('const containerStyle = usesFinalPreviewSkin') + 900,
    );
    expect(inline).not.toContain('max-width: 760px');
  });
});

/**
 * ⑤ 블로그스팟·티스토리 점검 + 커서 자리 삽입
 *
 * 사장님: "티스토리,블로그스팟도 한번 점검해줘 그리고 여전히 커서자리에 안들어가네
 *          이미지를 보여주면 여기에 광고를 넣고싶거든"
 */
describe('⑤ 블로그스팟도 화면 크기별로 넓힌다', () => {
  const blogger = fs.readFileSync(
    path.join(__dirname, '..', 'src/core/blogger-publisher.js'), 'utf-8',
  );

  it('⭐⭐ 720px 고정이 사라졌다', () => {
    expect(blogger).not.toContain('max-width: 720px !important');
  });

  it('⭐⭐ PC(≥1200px)에서 본문을 1000px 로 넓힌다 (테마만 넓히고 본문은 묶여 있었다)', () => {
    const block = blockBetween(blogger, '@media (min-width: 1200px)', '.post-outer');
    expect(block).toContain('.blogger-gpt-content');
    expect(block).toContain('max-width: 1000px');
  });

  it('⭐ 티스토리는 본문 폭 강제가 없다 (테마가 정한다 — 이게 정상)', () => {
    for (const f of ['tistory-publisher.ts', 'tistory-posts.ts']) {
      const src = fs.readFileSync(path.join(__dirname, '..', 'src/tistory', f), 'utf-8');
      expect(src).not.toMatch(/max-width:\s*\d+px/);
    }
  });
});

describe('⑥ 커서 자리 삽입 — 클릭 없이 스크롤만 해도 보고 있는 자리에 들어간다', () => {
  const images = fs.readFileSync(
    path.join(__dirname, '..', 'electron/ui/modules/editor-images.js'), 'utf-8',
  );

  it('⭐⭐ 마우스가 지나간 블록을 기록한다 (본문을 클릭하지 않는 사용자가 실제로 있다)', () => {
    // v3.8.493 에서 문단 수준 앵커가 우선이 됐다 - 기록 자체가 유지되는지를 본다
    expect(images).toContain('state.lastPointerBlock = findInsertAnchor(e.target, container) || block');
  });

  it('⭐⭐ 이미지 위에서도 기록한다 ("이미지를 보여주면 여기에 광고를" 이 바로 그 경우)', () => {
    // lastPointerBlock 기록이 IMG 조기 반환보다 먼저 와야 한다
    const record = images.indexOf('state.lastPointerBlock = findInsertAnchor');
    const imgSkip = images.indexOf("e.target?.tagName === 'IMG') return; // 이미지 위에서는 +이미지 마커만");
    expect(record).toBeGreaterThan(-1);
    expect(imgSkip).toBeGreaterThan(record);
  });

  it('⭐⭐ 폴백 사슬: 커서 → 커서 기억 → 마우스 자리 → 화면 중앙', () => {
    const fn = images.slice(
      images.indexOf('export function findCaretBlock'),
      images.indexOf('export function insertHtmlAtCaret'),
    );
    const caret = fn.indexOf('state.lastCaretBlock');
    const pointer = fn.indexOf('state.lastPointerBlock');
    const center = fn.indexOf('elementFromPoint');
    expect(caret).toBeGreaterThan(-1);
    expect(pointer).toBeGreaterThan(caret);
    expect(center).toBeGreaterThan(pointer);
  });

  it('⭐ 떨어져 나간 블록은 쓰지 않는다 (지워진 자리에 넣으면 유실된다)', () => {
    expect(images).toContain('state.lastPointerBlock?.isConnected');
  });
});
