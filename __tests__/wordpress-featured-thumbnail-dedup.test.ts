/**
 * 회귀 방지: 워드프레스에서 같은 썸네일이 대표 이미지 자리와 본문 상단에 중복 표시되는 문제 (v3.8.336)
 *
 * 오케스트레이션은 본문 상단에 bgpt-thumbnail-box를 넣고(orchestration.ts THUMBNAIL_PLACEHOLDER),
 * 워드프레스 발행기는 같은 이미지를 featured_media로도 올린다. 워드프레스 테마는 대표 이미지를
 * 글 상단에 직접 그리므로 본문 블록을 지우지 않으면 한 화면에 같은 이미지가 두 번 보인다.
 *
 * 본문 카드 래핑(wrapSectionsInCards)이 도입부 이미지를 지워주긴 하지만,
 * 우리 글은 gradient-frame/white-paper 클래스 때문에 래핑이 skip되므로 이 경로로는 제거되지 않는다.
 */
import { stripBodyThumbnailBox } from '../src/wordpress/wordpress-publisher';

// orchestration.ts가 실제로 만들어 넣는 마크업과 동일한 형태
const thumbnailBox = '<div class="bgpt-thumbnail-box" style="width:100% !important;aspect-ratio:16/9 !important;margin:0;padding:0;overflow:hidden !important;border-radius:10px !important;background:#f8fafc !important;">\n'
  + '  <img src="https://cdn.example.com/thumb.jpg" alt="제목" style="width:100% !important;height:100% !important;" loading="lazy" />\n'
  + '</div>';

const sectionImage = '<div class="section-image-frame"><img src="https://cdn.example.com/h2-1.jpg" alt="소제목 1" /></div>';

describe('stripBodyThumbnailBox — 대표 이미지와 본문 썸네일 중복 제거', () => {
  it('본문 상단의 썸네일 블록을 제거한다', () => {
    const html = `<h1 class="post-title">제목</h1>${thumbnailBox}<h2>소제목 1</h2>`;
    const result = stripBodyThumbnailBox(html);
    expect(result).not.toContain('bgpt-thumbnail-box');
    expect(result).not.toContain('thumb.jpg');
    expect(result).toContain('<h1 class="post-title">제목</h1>');
    expect(result).toContain('<h2>소제목 1</h2>');
  });

  it('H2 섹션 이미지는 절대 건드리지 않는다', () => {
    const html = `${thumbnailBox}<h2>소제목 1</h2>${sectionImage}`;
    const result = stripBodyThumbnailBox(html);
    expect(result).toContain('h2-1.jpg');
    expect(result).toContain('section-image-frame');
    expect(result).not.toContain('thumb.jpg');
  });

  it('썸네일 블록이 없으면 본문을 그대로 둔다', () => {
    const html = `<h1>제목</h1><h2>소제목</h2>${sectionImage}`;
    expect(stripBodyThumbnailBox(html)).toBe(html);
  });

  it('빈 입력에도 안전하다', () => {
    expect(stripBodyThumbnailBox('')).toBe('');
  });

  it('작은따옴표 class 표기도 처리한다', () => {
    const html = `<div class='bgpt-thumbnail-box'><img src="https://cdn.example.com/thumb.jpg" /></div><p>본문</p>`;
    const result = stripBodyThumbnailBox(html);
    expect(result).not.toContain('thumb.jpg');
    expect(result).toContain('<p>본문</p>');
  });
});
