/**
 * 카드뉴스 이미지 모드 — v3.8.498
 *
 * 이미지 호출 자체는 돈이 드니 테스트하지 않는다.
 * 여기서 지키는 것은 "조용히 다르게 동작하지 않는가" 세 가지다.
 *   ① 글자를 못 그리는 엔진에 full 을 주면 backdrop 으로 내려가는가
 *   ② 배경 프롬프트가 글자 자리를 비우라고 지시하는가
 *   ③ full 프롬프트에 넣어야 할 글자가 원문 그대로 들어가는가
 */
import {
  normalizeCardImageMode,
  resolveCardImageMode,
  buildBackdropPrompt,
  buildFullCardPrompt,
  buildVisualTheme,
  CARD_IMAGE_ENGINES,
  DEFAULT_CARD_ENGINE,
} from '../src/core/cardnews/card-image';
import { renderCardHtml } from '../src/core/cardnews/card-template';
import type { CardItem } from '../src/core/cardnews/card-plan';

const card: CardItem = {
  kind: 'hook',
  title: '문자 안 왔어도 세금 냅니다',
  body: '국세청 안내문 못 받았어도 대상이면 8월 31일 넘길 때 가산세 뭅니다.',
  alt: '세금 안내문',
};

describe('모드 정규화', () => {
  it('빈 값·이상한 값은 backdrop 으로', () => {
    expect(normalizeCardImageMode(undefined)).toBe('backdrop');
    expect(normalizeCardImageMode('')).toBe('backdrop');
    expect(normalizeCardImageMode('아무말')).toBe('backdrop');
  });

  it('full·none 은 그대로 읽는다', () => {
    expect(normalizeCardImageMode('full')).toBe('full');
    expect(normalizeCardImageMode('FULL')).toBe('full');
    expect(normalizeCardImageMode('none')).toBe('none');
  });
});

describe('엔진과 모드의 조합', () => {
  it('글자를 못 그리는 엔진에 full 을 주면 backdrop 으로 내린다', () => {
    expect(resolveCardImageMode('full', 'nanobanana2')).toBe('backdrop');
    expect(resolveCardImageMode('full', 'gptimage1')).toBe('backdrop');
  });

  it('글자를 그리는 엔진에서는 full 이 유지된다', () => {
    expect(resolveCardImageMode('full', 'gptimage2')).toBe('full');
    expect(resolveCardImageMode('full', 'dropshot-nanobanana-pro')).toBe('full');
  });

  it("엔진이 'none' 이면 모드와 무관하게 이미지를 안 만든다", () => {
    expect(resolveCardImageMode('full', 'none')).toBe('none');
    expect(resolveCardImageMode('backdrop', 'none')).toBe('none');
  });

  it('기본 엔진은 목록 안에 실제로 있어야 한다', () => {
    expect(CARD_IMAGE_ENGINES.some((e) => e.value === DEFAULT_CARD_ENGINE)).toBe(true);
  });
});

describe('배경 프롬프트', () => {
  it('글자 자리를 비우라고 지시한다 — 안 그러면 얼굴 위에 글자가 얹힌다', () => {
    const p = buildBackdropPrompt(card, '양도소득세');
    expect(p.toLowerCase()).toContain('text overlay');
    expect(p.toLowerCase()).toMatch(/uncluttered|calm/);
  });

  it('카드 종류마다 다른 장면을 지시한다', () => {
    const hook = buildBackdropPrompt({ ...card, kind: 'hook' }, 'k');
    const save = buildBackdropPrompt({ ...card, kind: 'save' }, 'k');
    expect(hook).not.toBe(save);
  });

  it('같은 키워드면 톤이 같아야 7장이 한 벌로 보인다', () => {
    expect(buildVisualTheme('양도소득세')).toBe(buildVisualTheme('양도소득세'));
  });
});

describe('카드 전체 AI 프롬프트', () => {
  it('넣어야 할 글자를 원문 그대로 박는다', () => {
    const p = buildFullCardPrompt(card, '양도소득세', { index: 0, total: 7, ratio: '4:5' });
    expect(p).toContain(card.title);
    expect(p).toContain(card.body);
  });

  it('숫자를 바꾸지 말라고 못 박는다 — 날짜가 틀리면 사실 오류다', () => {
    const p = buildFullCardPrompt(card, 'k', { index: 0, total: 7, ratio: '4:5' });
    expect(p.toLowerCase()).toContain('every digit');
  });
});

describe('템플릿 — 배경 유무', () => {
  const opts = { format: 'insta45' as const, index: 0, total: 7, keyword: '양도소득세' };

  it('배경이 없으면 지금까지 쓰던 그라데이션으로 그린다', () => {
    const html = renderCardHtml(card, opts);
    expect(html).toContain('linear-gradient');
    expect(html).not.toContain('url("data:');
  });

  it('배경이 있으면 이미지 위에 어둠 막을 깐다 — 흰 글씨가 사라지면 안 된다', () => {
    const html = renderCardHtml(card, { ...opts, backdrop: 'data:image/png;base64,AAAA' });
    expect(html).toContain('url("data:image/png;base64,AAAA")');
    expect(html).toContain('rgba(8,12,20,0.90)');
    expect(html).toContain('text-shadow');
  });

  it('쪽번호와 안내가 붙어 보이지 않게 사이가 벌어져 있다', () => {
    const html = renderCardHtml(card, opts);
    const footer = html.slice(html.indexOf('.footer {'), html.indexOf('.pager'));
    expect(footer).toMatch(/gap:\s*\d+px/);
  });

  it('마지막 장에는 "밀어서 계속"이 없다', () => {
    const last = renderCardHtml(card, { ...opts, index: 6, total: 7 });
    expect(last).not.toContain('밀어서 계속');
  });

  it('저장 카드는 눈에 띄게 강조한다 — 저장수가 배포를 결정한다', () => {
    const html = renderCardHtml({ ...card, kind: 'save' }, opts);
    expect(html).toContain('class="body keep"');
  });

  it('글자는 이스케이프해서 넣는다', () => {
    const html = renderCardHtml({ ...card, title: '<script>x</script>' }, opts);
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('카드 전체 AI 모드 — 글자를 두 번 그리면 안 된다', () => {
  const { renderImageOnlyHtml, CARD_FORMATS } = require('../src/core/cardnews/card-template');

  it('그림만 놓고 글자도 어둠 막도 얹지 않는다', () => {
    const html = renderImageOnlyHtml('data:image/png;base64,ZZZ', CARD_FORMATS.insta45);
    expect(html).toContain('data:image/png;base64,ZZZ');
    expect(html).not.toContain(card.title);   // AI 가 그린 글자 위에 또 얹으면 겹친다
    expect(html).not.toContain('rgba(8,12,20');
    expect(html).not.toContain('밀어서 계속');
  });

  it('규격 크기를 그대로 지킨다 — 안 맞으면 업로드에서 또 잘린다', () => {
    const insta = renderImageOnlyHtml('data:x', CARD_FORMATS.insta45);
    const kakao = renderImageOnlyHtml('data:x', CARD_FORMATS.kakao11);
    expect(insta).toContain('width:1080px; height:1350px');
    expect(kakao).toContain('width:1080px; height:1080px');
    expect(insta).toContain('object-fit:cover');
  });
});
