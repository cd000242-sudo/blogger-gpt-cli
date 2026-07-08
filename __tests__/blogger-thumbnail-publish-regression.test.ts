import fs from 'fs';
import path from 'path';

const publisherPath = path.join(process.cwd(), 'src', 'core', 'blogger-publisher.js');
const source = fs.readFileSync(publisherPath, 'utf8');

describe('Blogger thumbnail publish regression', () => {
  test('does not insert broken data/svg fallback thumbnails for Blogspot posts', () => {
    expect(source).toContain('function isPublishableBloggerImageUrl');
    expect(source).toContain("!/^https?:\\/\\//i.test(url)");
    expect(source).toContain("blogger-media-insert-missing");
    expect(source).toContain("깨진 기본 SVG를 넣지 않고 썸네일 없이 진행");

    expect(source).not.toContain('유효한 썸네일 없음 - 기본 이미지 추가');
    expect(source).not.toContain('const defaultThumbnailHtml');
    expect(source).not.toContain('data:image/svg+xml;base64,${Buffer.from');
  });
});
