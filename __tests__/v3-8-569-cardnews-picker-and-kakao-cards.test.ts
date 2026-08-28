/**
 * v3.8.569 — 카드뉴스 글 선택 모달 · 미리보기 좌우 넘김 · 카카오 카드 내용 (사장님 보고 3건)
 *
 * ## ① "카드뉴스는 발행글 불러오기가 아니라 거미줄발행처럼 모달이 뜨고 글을 선택하게"
 * 카드뉴스 탭만 자기 목록을 따로 API 로 불러와 인라인 리스트로 뿌리고 있었다.
 * 거미줄·외부유입이 쓰는 발행글 모달을 그대로 쓰게 바꾼다.
 *
 * ⚠️ 이 저장소에서 **없는 함수 이름을 onclick 에 박아 조용히 죽는 실수가 5번** 있었다.
 *    그래서 "모드 표에 적힌 핸들러 이름"과 "실제로 window 에 붙는 이름"이 같은지 고정한다.
 *
 * ## ② "이미지 생성 미리보기가 뜨면서 클릭하면 크게보고 좌우 화살표로 넘겨서"
 * 라이트박스는 있었지만 한 장짜리였다 — 넘기려면 닫고 다시 눌러야 했다.
 *
 * ## ③ "카카오채널은 이미지 넣고 아래에 제목과 내용을 넣게끔 되어있어"
 * 진짜 버그. 카드 문안(plan)에 장마다 body 가 있는데 `body: ''` 로 버리고
 * 마지막 장에만 본문을 넣었다. 그래서 카카오 카드뷰의 "내용" 칸이
 * **마지막 장 빼고 전부 비어서** 나갔다.
 *
 * 카카오 자동화 흐름 자체(카드뷰→세로형→이미지→제목→내용→반복→마지막만 버튼→확인→등록)는
 * v3.8.511~516 에 이미 구현돼 있다. 여기서는 그게 **유지되는지**도 같이 고정한다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween, braceBlock } from './helpers/source-block';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

const links = read('electron/ui/modules/internal-links.js');
const cardnews = read('electron/ui/modules/cardnews.js');
const extTraffic = read('electron/ui/modules/external-traffic.js');
const poster = read('src/kakao-channel/kakao-poster.js');

describe('① 카드뉴스 글 선택 — 거미줄과 같은 발행글 모달', () => {
  const modeTable = braceBlock(links, 'const SINGLE_PICK_MODES =');

  test('모달이 cardnews 모드를 안다', () => {
    expect(modeTable).toContain('cardnews:');
    expect(modeTable).toMatch(/handler:\s*'cardnewsPickSingleFromModal'/);
  });

  test('기존 external-traffic 모드가 살아 있다 (같은 표로 옮기며 깨뜨리지 않았는가)', () => {
    expect(modeTable).toContain("'external-traffic':");
    expect(modeTable).toMatch(/handler:\s*'extTrafficPickSingleFromModal'/);
  });

  /**
   * 표에 적힌 핸들러 이름이 실제로 window 에 붙어 있어야 한다.
   * 오타가 나면 onclick 이 ReferenceError 로 조용히 죽는다 — 눌러봐야만 안다.
   */
  test('표의 핸들러 이름이 전부 실존한다', () => {
    const names = Array.from(modeTable.matchAll(/handler:\s*'([^']+)'/g)).map((m) => m[1]);
    expect(names.length).toBeGreaterThanOrEqual(2);
    for (const name of names) {
      expect(links).toContain(`function ${name}(`);
      expect(links).toContain(`window.${name} = ${name};`);
    }
  });

  test('단일 선택 카드의 onclick 이 모드별 핸들러를 쓴다 (외부유입으로 고정돼 있지 않다)', () => {
    const row = blockBetween(links, 'if (_modalSinglePick) {', 'data-pubidx');
    expect(row).not.toContain('onclick="extTrafficPickSingleFromModal(');
    expect(links).toContain('onclick="${SINGLE_PICK_MODES[_modalMode].handler}(${index})"');
  });

  test('카드뉴스 핸들러가 카드뉴스 탭으로 돌려준다', () => {
    const fn = braceBlock(links, 'function cardnewsPickSingleFromModal(index)');
    expect(fn).toContain('window.cardnewsSetSource');
    expect(fn).toContain('closePublishedPostsModal()');
  });

  test('삭제 후 모달 재열기가 현재 모드를 유지한다 (카드뉴스에서 지우면 거미줄로 튀지 않는다)', () => {
    expect(links).not.toContain("_modalMode === 'external-traffic' ? 'external-traffic' : 'spider-web'");
    expect(links).toContain('openPublishedPostsModal({ mode: _modalMode })');
  });
});

describe('② 카드뉴스 탭 배선', () => {
  test('선택 버튼이 모달을 연다 — 인라인 목록을 부르지 않는다', () => {
    expect(cardnews).toContain("panel.querySelector('#cnLoadBtn').addEventListener('click', openPostPicker)");
    const picker = braceBlock(cardnews, 'function openPostPicker()');
    expect(picker).toContain("window.openPublishedPostsModal({ mode: 'cardnews' })");
  });

  test('모달이 부를 창구를 실제로 노출한다', () => {
    expect(cardnews).toContain('window.cardnewsSetSource = cardnewsSetSource;');
    expect(cardnews).toContain('function cardnewsSetSource(post)');
  });

  /**
   * 발행글 목록은 본문을 `html` 로 들고 있고 createCards 는 `content` 를 읽는다.
   * 안 맞춰주면 고른 글마다 "본문을 불러오지 못했습니다" 로 막힌다.
   */
  test('본문 필드 이름을 맞춰준다 (html → content)', () => {
    const setter = braceBlock(cardnews, 'function cardnewsSetSource(post)');
    expect(setter).toContain('post.content || post.html');
    expect(setter).toContain('content: body');
  });

  test('고른 글이 화면에 남는다 — 모달이 닫혀도 뭘 골랐는지 보인다', () => {
    expect(cardnews).toContain('id="cnSource"');
    expect(cardnews).toContain('function renderSource()');
    expect(braceBlock(cardnews, 'function cardnewsSetSource(post)')).toContain('renderSource()');
  });

  test('걷어낸 인라인 목록의 잔해가 남아 있지 않다', () => {
    for (const dead of ['cnPostList', 'cnPlatform', 'function loadPosts', 'renderPostList', 'PLATFORMS']) {
      expect(cardnews).not.toContain(dead);
    }
  });
});

describe('③ 미리보기 라이트박스 — 좌우로 넘긴다', () => {
  const lb = braceBlock(cardnews, 'function openLightbox(src)');

  test('좌우 화살표 버튼이 있다', () => {
    expect(lb).toContain('id="cnLbPrev"');
    expect(lb).toContain('id="cnLbNext"');
    expect(cardnews).toContain('.cn-lb-nav');
  });

  test('키보드 ←/→ 로도 넘어간다', () => {
    expect(lb).toContain("e.key === 'ArrowLeft'");
    expect(lb).toContain("e.key === 'ArrowRight'");
    expect(lb).toContain("e.key === 'Escape'");
  });

  test('몇 번째 카드인지 보여준다', () => {
    expect(lb).toContain('id="cnLbCount"');
    expect(lb).toContain('${idx + 1} / ${list.length}');
  });

  test('넘길 목록을 화면의 카드에서 모은다 (결과 카드 우선, 없으면 라이브 스트립)', () => {
    const gallery = braceBlock(cardnews, 'function galleryImages()');
    expect(gallery).toContain('#cnResult [data-img]');
    expect(gallery).toContain('#cnLive .cn-live-img');
  });

  /** 화살표를 눌렀는데 닫혀버리면 넘길 수가 없다 — 예전엔 오버레이 전체가 닫기였다 */
  test('화살표를 눌러도 닫히지 않는다', () => {
    expect(lb).toContain('e.stopPropagation()');
    expect(lb).toContain('if (e.target === overlay) close()');
  });

  test('호출부를 안 고쳐도 되게 인자는 그대로 src 하나다', () => {
    expect(cardnews).toContain('function openLightbox(src)');
    expect(cardnews).toContain('window.cnOpenLightbox = openLightbox;');
    expect(cardnews).toContain('window.cnOpenLightbox(this.src)');
  });
});

describe('④ 카카오 카드 — 장마다 제목과 내용이 실린다', () => {
  const build = blockBetween(extTraffic, 'const planAt = (i) =>', '_flashToast(cards');

  test('내용을 빈 값으로 만들지 않는다 (이 버그의 정체)', () => {
    expect(build).not.toMatch(/body:\s*''/);
    expect(build).toContain('planAt(i).body');
  });

  test('제목도 장마다 자기 문안을 쓴다', () => {
    expect(build).toContain('planAt(i).title');
  });

  test('링크 버튼은 마지막 장에만 붙는다', () => {
    expect(build).toContain('const isLast = i === cardAssets.files.length - 1');
    expect(build).toContain('buttonUrl: link || cardAssets.postUrl');
    // 마지막이 아닌 카드에는 버튼 필드가 없다
    expect(build).toMatch(/:\s*\{ imagePath: file, title, body \}/);
  });

  test('만든 뒤 고쳐 쓰지 않는다 (불변 — 예전엔 lastCard 를 뒤에서 변형했다)', () => {
    expect(build).not.toContain('lastCard.body =');
    expect(build).not.toContain('lastCard.buttonUrl =');
  });

  test('카카오 한도를 넘기지 않는다 (제목 30 · 내용 600)', () => {
    expect(build).toContain('.slice(0, 30)');
    expect(build).toContain('.slice(0, 600)');
  });
});

describe('⑤ 카카오 자동 발행 흐름이 그대로 살아 있다', () => {
  const flow = blockBetween(poster, 'if (cards.length) {', 'let linkAttached = false;');

  test('카드뷰 → 세로형 → 이미지 → 제목 → 내용 순서', () => {
    const order = ['cardViewTabText', 'cardShapePortraitText', 'setInputFiles', 'cardTitleInput', 'cardBodyInput'];
    let at = -1;
    for (const marker of order) {
      const next = flow.indexOf(marker, at + 1);
      expect(next).toBeGreaterThan(at);
      at = next;
    }
  });

  test('두 번째 장부터는 [카드 추가] 를 누른다', () => {
    expect(flow).toContain('cardAddText');
  });

  test('버튼(링크) 설정은 마지막 장에만', () => {
    expect(flow).toContain('if (isLast && cardItem.buttonUrl)');
    expect(flow).toContain('cardButtonYesText');
  });

  test('장마다 [확인] 을 누르고, 모달이 안 닫히면 실패로 본다', () => {
    expect(flow).toContain('cardConfirmText');
    expect(flow).toContain('CARD_REJECTED');
  });

  test('마지막에 [등록] 을 누른다 — "등록순" 과 헷갈리지 않게 정확 일치', () => {
    expect(poster).toContain("step = '등록';");
    expect(poster).toContain('name: KAKAO_SELECTORS.submitExactText, exact: true');
  });
});
