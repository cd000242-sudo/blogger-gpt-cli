/**
 * v3.8.457 — 반자동에서 유료 썸네일이 새던 구멍
 *
 * 사용자 질문: "반자동 발행으로 하면 썸네일은 대표이미지수집한걸로 배치되고
 *   나머지 이미지는 안나오는거맞지?"
 *
 * 확인 결과:
 *   · 쇼핑모드(수집 사진 있음) — 맞다. 썸네일 = 수집 사진 1번(0원), 본문 이미지 없음.
 *   · 그런데 수집 사진이 **없는** 경우(SEO·일관 모드, 쇼핑 크롤 실패)는
 *     AI 썸네일 디스패치가 skipImages 를 안 봐서 유료 생성이 나갔다.
 *     v3.8.425("반자동 = 이미지 없이 글만")의 설계 의도와 어긋나는 비용 누수.
 */
import * as fs from 'fs';
import * as path from 'path';

const orch = fs.readFileSync(path.join(__dirname, '..', 'src/core/final/orchestration.ts'), 'utf-8');

describe('반자동(skipImages) 썸네일 비용 게이트', () => {
  it('⭐⭐ 유료 썸네일 디스패치가 skipImages 를 본다', () => {
    expect(orch).toContain('if (!thumbnailUrl && !thumbnailDisabled && !skipImages) {');
    // 게이트 없는 옛 형태가 되살아나면 반자동에서 다시 과금된다
    expect(orch).not.toMatch(/if \(!thumbnailUrl && !thumbnailDisabled\) \{\s*\n\s*onLog\?\.\(`\[PROGRESS\] 90% - 🖼️ 썸네일 생성 중/);
  });

  it('⭐⭐ 수집 사진 썸네일(0원)은 skipImages 여도 그대로 산다', () => {
    // v3.8.407 정책 — 쇼핑모드 수집 사진 썸네일은 반자동에서도 배치된다
    const idx = orch.indexOf('if (!thumbnailUrl && useProductImages) {');
    expect(idx).toBeGreaterThan(-1);
    // 이 분기는 skipImages 조건이 없어야 한다 (무료라서)
    const before = orch.slice(Math.max(0, idx - 300), idx);
    expect(before).not.toContain('&& !skipImages');
  });

  it('⭐ 건너뛸 때는 이유를 로그로 알린다', () => {
    expect(orch).toContain('유료 썸네일 생성을 건너뜁니다');
  });

  it('⭐ URL 모드 썸네일 경로의 기존 게이트도 그대로다', () => {
    expect(orch).toContain('if (!thumbnailUrl && !skipImages && !urlThumbnailDisabled)');
  });
});
