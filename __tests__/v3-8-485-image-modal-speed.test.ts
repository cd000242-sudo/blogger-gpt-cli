/**
 * v3.8.485 — 이미지 모달이 늦게 뜨던 문제
 *
 * 사장님: "이미지관리탭에서 이미지 생성하면 이미지 생성모달이 너무늦게뜨는데 확인좀해줘"
 *
 * ## 원인
 * 생성된 이미지는 `data:image/png;base64,...` 형태다 — 수 MB 짜리 문자열이다.
 * 모달을 innerHTML 로 만들면서 그 거대한 문자열을 img src 속성 안에 통째로 넣었다.
 * 브라우저가 그 속성을 다 파싱하고 이미지를 디코드한 뒤에야 모달이 화면에 나온다.
 * 그래서 클릭하고 한참 아무 일도 안 일어나는 것처럼 보였다.
 *
 * ## 고침
 * 껍데기를 먼저 그려 붙이고, 다음 프레임에 src 를 넣는다.
 * 모달은 즉시 뜨고 이미지는 그 안에서 채워진다.
 */
import * as fs from 'fs';
import * as path from 'path';

const semiAuto = fs.readFileSync(
  path.join(__dirname, '..', 'electron/ui/modules/semi-auto.js'), 'utf-8',
);

const modalBlock = semiAuto.slice(
  semiAuto.indexOf('window.showImageModal = function'),
  semiAuto.indexOf('window.closeImageModal'),
);

describe('이미지 모달을 먼저 띄우고 이미지는 나중에 넣는다', () => {
  it('⭐⭐ 모달 HTML 안에 거대한 data URI 를 박지 않는다', () => {
    expect(modalBlock).toContain('<img id="modalImage"');
    expect(modalBlock).not.toContain('<img id="modalImage" src="${imageUrl}"');
  });

  it('⭐⭐ DOM 에 붙인 다음 프레임에 src 를 넣는다', () => {
    const appendIdx = modalBlock.indexOf('document.body.appendChild(modal)');
    const srcIdx = modalBlock.indexOf('modalImage.src = imageUrl');
    expect(appendIdx).toBeGreaterThan(-1);
    expect(srcIdx).toBeGreaterThan(appendIdx);   // 붙인 뒤에 넣어야 먼저 그려진다
    expect(modalBlock).toContain('requestAnimationFrame');
  });

  it('⭐⭐ img 요소를 못 찾아도 터지지 않는다 (모달이 안 뜨면 더 나쁘다)', () => {
    expect(modalBlock).toContain('if (modalImage)');
  });

  it('⭐ 이미지 주소는 여전히 들어간다 (안 넣으면 빈 모달이다)', () => {
    expect(modalBlock).toContain('modalImage.src = imageUrl');
  });
});
