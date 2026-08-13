/**
 * v3.8.495 — 발행 글 → 카드뉴스 (인스타·카카오)
 *
 * 사장님: "발행된 글을 보고 카드뉴스를 만들어주는기능" +
 *         "심층리서치를통해서 요즘먹히는 방법과 ... 연구해서 플랜을세워"
 *
 * ## 리서치로 확정한 설계 (2026-08-13)
 * · 웹스토리는 뺐다 — 구글이 디스커버 캐러셀·이미지검색에서 웹스토리를 제거했다(2024-09).
 *   디스커버 노출은 기존 디스커버 모드(일반 글)가 정공법이다.
 * · 인스타 캐러셀이 2026 저장·공유 1위 형식. 설계에 반영한 근거:
 *   - 리서브: 끝까지 안 넘긴 사람에게 2~3일 뒤 **첫 장이 재노출** → 훅 카드에 품질 집중
 *   - 저장수가 배포를 결정 → 마지막 장은 저장 유도
 *   - 해시태그 영향력 미미, 캡션·이미지 속 글자·**Alt 텍스트**를 검색이 분석 → Alt 까지 생성
 * · 이미지는 AI 생성이 아니라 HTML 캡처 — 비용 0, 한글 선명. 카드뉴스는 글자 중심이다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildCardPlanPrompt, parseCardPlan, extractArticleText } from '../src/core/cardnews/card-plan';
import { renderCardHtml, CARD_FORMATS } from '../src/core/cardnews/card-template';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

const PLAN_JSON = JSON.stringify({
  cards: [
    { kind: 'hook', title: '기차표, 작년처럼 하면 못 삽니다', body: '올해부터 예매 방식이 통째로 바뀌었습니다', alt: '추석 기차표 예매 변경 안내 카드' },
    { kind: 'body', title: '통합 앱 하나로', body: 'KTX와 SRT를 한 앱에서 조회하고 예매합니다', alt: '통합 앱 설명 카드' },
    { kind: 'body', title: '사전 예매 일정', body: '8월 19일부터 22일까지, 오전 7시 시작', alt: '사전 예매 일정 카드' },
    { kind: 'save', title: '예매 전 이 글을 저장하세요', body: '예매 당일 순서대로 따라 하면 됩니다', alt: '저장 유도 카드' },
    { kind: 'cta', title: '역별 매진 시간표는 본문에', body: '프로필 링크에서 확인하세요', alt: '전체 글 안내 카드' },
  ],
  caption: '추석 기차표 예매, 올해 달라진 것만 정리했습니다. #추석기차표 #KTX예매',
});

describe('① 카드 문안 프롬프트 — 리서치 근거가 지시로 들어간다', () => {
  const prompt = buildCardPlanPrompt('추석 기차표 예매', '제목', '본문 내용입니다.');

  it('⭐⭐ 첫 장 훅 · 저장 유도 · 마지막 클릭 유도를 요구한다', () => {
    expect(prompt).toContain('첫');
    expect(prompt).toContain('저장');
    expect(prompt).toContain('프로필 링크');
  });

  /**
   * 사장님: "카드뉴스를 보고 내 링크를 클릭하고싶게 만들어야한다"
   * 카드가 전부를 알려주면 클릭할 이유가 없다 — 본문에만 있는 것 하나를 남기되,
   * 실제로 본문에 있어야 한다(없는 걸 미끼로 쓰면 신뢰가 무너진다).
   */
  it('⭐⭐ 클릭할 이유를 남기라고 지시한다 (전부 주면 아무도 안 누른다)', () => {
    expect(prompt).toContain('본문에만 있는 것');
    expect(prompt).toContain('실제로 본문에 있어야');
  });

  it('⭐⭐ 캡션이 프로필 링크로 끝나게 한다 (인스타는 캡션 링크가 안 눌린다)', () => {
    expect(prompt).toContain('전체 글은 프로필 링크에서');
  });

  it('⭐⭐ 슬라이드당 메시지 하나를 요구한다', () => {
    expect(prompt).toContain('하나');
  });

  it('⭐⭐ 카드마다 Alt 텍스트를 요구한다 (인스타 검색이 Alt 를 분석한다)', () => {
    expect(prompt).toContain('alt');
  });

  it('⭐⭐ 본문에 없는 수치를 지어내지 말라고 못 박는다', () => {
    expect(prompt).toContain('지어내');
  });

  it('⭐ 캡션에 검색 키워드를 넣으라고 한다 (해시태그 의존 금지)', () => {
    expect(prompt).toContain('캡션');
  });
});

describe('② 응답 파싱 — AI 가 어떤 모양으로 답해도 안전하다', () => {
  it('⭐⭐ 정상 JSON 을 읽는다', () => {
    const plan = parseCardPlan(PLAN_JSON);
    expect(plan).not.toBeNull();
    expect(plan!.cards).toHaveLength(5);
    expect(plan!.cards[0]!.kind).toBe('hook');
  });

  it('⭐⭐ ```json 펜스·설명문이 붙어 와도 읽는다', () => {
    expect(parseCardPlan('설명입니다\n```json\n' + PLAN_JSON + '\n```\n끝')).not.toBeNull();
  });

  it('⭐⭐ 카드가 너무 적으면 거절한다 (2장짜리는 카드뉴스가 아니다)', () => {
    const tiny = JSON.stringify({ cards: [{ kind: 'hook', title: 't', body: 'b', alt: 'a' }], caption: 'c' });
    expect(parseCardPlan(tiny)).toBeNull();
  });

  it('⭐⭐ 깨진 JSON·빈 입력에 던지지 않는다', () => {
    expect(parseCardPlan('{"cards": [')).toBeNull();
    expect(parseCardPlan('')).toBeNull();
    expect(parseCardPlan('그냥 텍스트')).toBeNull();
  });

  it('⭐⭐ 마지막 장은 클릭 유도, 그 앞은 저장 유도로 바로잡는다', () => {
    const plan = parseCardPlan(PLAN_JSON)!;
    expect(plan.cards[plan.cards.length - 1]!.kind).toBe('cta');
    expect(plan.cards[plan.cards.length - 2]!.kind).toBe('save');
  });

  it('⭐ alt 가 빠진 카드는 제목으로 채운다 (빈 Alt 로 나가면 노출 요소를 버린다)', () => {
    const noAlt = JSON.stringify({
      cards: [
        { kind: 'hook', title: '훅 제목', body: 'b' },
        { kind: 'body', title: 't2', body: 'b2' },
        { kind: 'body', title: 't3', body: 'b3' },
        { kind: 'save', title: 't4', body: 'b4' },
      ],
      caption: 'c',
    });
    const plan = parseCardPlan(noAlt);
    expect(plan!.cards[0]!.alt).toContain('훅 제목');
  });
});

describe('③ 본문 추출', () => {
  it('⭐⭐ 태그를 걷어내고 글자만 남긴다', () => {
    const text = extractArticleText('<h2>제목</h2><p>본문 <strong>강조</strong>입니다.</p><script>bad()</script>');
    expect(text).toContain('본문 강조입니다');
    expect(text).not.toContain('<');
    expect(text).not.toContain('bad()');
  });

  it('⭐ 길이 상한이 있다 (긴 글을 통째로 보내면 토큰 낭비다)', () => {
    expect(extractArticleText('<p>' + '가'.repeat(50000) + '</p>').length).toBeLessThanOrEqual(9000);
  });
});

describe('④ 카드 렌더링 — 규격·안전', () => {
  const card = { kind: 'hook' as const, title: '기차표 <스크립트>', body: '본문 & 내용', alt: 'a' };

  it('⭐⭐ 인스타 4:5, 카카오 1:1 규격이 맞는다', () => {
    expect(CARD_FORMATS.insta45).toMatchObject({ width: 1080, height: 1350 });
    expect(CARD_FORMATS.kakao11).toMatchObject({ width: 1080, height: 1080 });
  });

  it('⭐⭐ 글자를 이스케이프한다 (제목의 <> 가 태그로 실행되면 안 된다)', () => {
    const html = renderCardHtml(card, { format: 'insta45', index: 0, total: 4, keyword: 'k' });
    expect(html).not.toContain('<스크립트>');
    expect(html).toContain('&lt;스크립트&gt;');
  });

  it('⭐⭐ 외부 리소스를 부르지 않는다 (오프라인에서도 캡처가 같아야 한다)', () => {
    const html = renderCardHtml(card, { format: 'insta45', index: 0, total: 4, keyword: 'k' });
    expect(html).not.toMatch(/https?:\/\//);
  });

  it('⭐⭐ 페이지 표시가 있다 (넘길 게 있다는 신호가 완주율을 올린다)', () => {
    const html = renderCardHtml(card, { format: 'insta45', index: 1, total: 5, keyword: 'k' });
    expect(html).toContain('2');
    expect(html).toContain('5');
  });

  it('⭐ 한글 줄바꿈 규칙이 들어 있다', () => {
    expect(renderCardHtml(card, { format: 'kakao11', index: 0, total: 4, keyword: 'k' })).toContain('keep-all');
  });
});

describe('④-2 클릭 유도 카드', () => {
  it('⭐⭐ CTA 카드에 프로필 링크 안내가 박힌다', () => {
    const html = renderCardHtml(
      { kind: 'cta', title: '전체 표는 본문에', body: '프로필 링크에서 확인', alt: 'a' },
      { format: 'insta45', index: 3, total: 4, keyword: 'k' },
    );
    expect(html).toContain('프로필 링크');
  });
});

describe('⑤ 배선', () => {
  it('⭐⭐ main 에 IPC 가 등록돼 있다', () => {
    const main = read('electron/main.ts');
    expect(main).toContain("ipcMain.handle('cardnews:create'");
    expect(main).toContain("ipcMain.handle('cardnews:open-dir'");
  });

  it('⭐⭐ 글 주소가 흘러간다 (카카오는 링크가 눌리므로 캡션에 직접 넣는다)', () => {
    const main = read('electron/main.ts');
    expect(main).toContain('url?: string');
    expect(main).toContain('[카카오채널 캡션]');
    expect(main).toContain('프로필 링크에 이 주소를');
    const ui = read('electron/ui/modules/cardnews.js');
    expect(ui).toContain('url: post.url');
  });

  /**
   * 사장님: "댓글에 링크달수도있고 본문자체에도 달수있을텐데"
   * 리서치(2026-08-13): 인스타 댓글·캡션 링크는 눌리지 않는다(일반 텍스트).
   * 실전 동선은 ① 프로필 링크 ② 고정 댓글(복사 가능) ③ 댓글 트리거→DM 자동화.
   * 세 가지를 전부 준비물로 만들어 준다.
   */
  it('⭐⭐ 클릭 동선 3종을 전부 준비한다 (프로필 링크·고정 댓글·DM 자동화)', () => {
    const main = read('electron/main.ts');
    expect(main).toContain('고정댓글.txt');
    expect(main).toContain('댓글 유도형');
    expect(main).toContain('DM');
  });

  it('⭐⭐ 안 눌린다는 사실을 사용자에게 정직하게 알린다 (모르고 쓰면 왜 클릭이 없는지 모른다)', () => {
    const main = read('electron/main.ts');
    expect(main).toContain('눌리지 않고 복사만');
  });

  it('⭐⭐ preload 가 노출한다', () => {
    const preload = read('electron/preload.ts');
    expect(preload).toContain("cardnewsCreate");
    expect(preload).toContain("'cardnews:create'");
  });

  it('⭐⭐ 서브탭 버튼·패널이 있고 전환 목록에 들어 있다', () => {
    const html = read('electron/ui/index.html');
    expect(html).toContain('extTrafficSubtab-cardnews');
    expect(html).toContain("extTrafficShowSubtab('cardnews')");
    const ext = read('electron/ui/modules/external-traffic.js');
    expect(ext).toContain("'cardnews'");
  });

  it('⭐⭐ 서브탭을 열면 모듈이 로드된다 (버튼만 있고 모듈이 안 뜨면 조용히 무효)', () => {
    const ext = read('electron/ui/modules/external-traffic.js');
    expect(ext).toContain("import('./cardnews.js')");
  });
});
