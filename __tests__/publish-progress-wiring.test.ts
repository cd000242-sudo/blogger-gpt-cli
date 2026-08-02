/**
 * 발행 진행률 배선 + 쇼핑모드 활성 회귀 테스트 (v3.8.385)
 *
 * 사고 1 — 진행률이 화면에 안 나옴 (2026-07-29 실측):
 *   발행 18분간 0% 고정 → 사용자가 멈춘 줄 알고 취소 후 3회 재클릭 →
 *   결국 finally 폴백이 성공 모달을 띄웠다.
 *   원인: run-progress 채널을 쏘는 건 run-post 핸들러 하나뿐인데,
 *        사용자가 쓴 경로는 publish-content 였고 그 핸들러는
 *        publishGeneratedContent 에 onLog 콜백 자체를 안 넘겼다.
 *        orchestration 이 [PROGRESS] N% 를 아무리 찍어도 갈 곳이 없었다.
 *
 * 사고 2 — 쇼핑모드가 잠겨 있음:
 *   electron/ui/index.html(소스)에서는 disabled 를 뺐는데 커밋되지 않아
 *   릴리스에 반영되지 않았다. 설치된 앱은 "(준비 중 — 점검 후 재오픈)" 상태였다.
 *   빌드 산출물(dist/ui)과 소스가 갈라져도 아무도 몰랐다는 것이 진짜 문제다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { braceBlock } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const coreSrc = fs.readFileSync(path.join(ROOT, 'src', 'core', 'index.ts'), 'utf8');
const mainSrc = fs.readFileSync(path.join(ROOT, 'electron', 'main.ts'), 'utf8');
const uiHtml = fs.readFileSync(path.join(ROOT, 'electron', 'ui', 'index.html'), 'utf8');

describe('진행률 배선 — publish-content 경로', () => {
  it('publishGeneratedContent 가 onLog 를 인자로 받는다', () => {
    const sig = coreSrc.slice(
      coreSrc.indexOf('export async function publishGeneratedContent'),
      coreSrc.indexOf('): Promise<PublishGeneratedContentResult>'),
    );
    expect(sig).toContain('onLog');
  });

  it('main.ts 가 onLog 를 실제로 넘긴다', () => {
    expect(mainSrc).toContain('publishOnLog');
    expect(mainSrc).toMatch(/publishGeneratedContent\([\s\S]{0,200}publishOnLog/);
  });

  it('main.ts 가 [PROGRESS] 를 파싱해 run-progress 로 보낸다', () => {
    const start = mainSrc.indexOf('const publishOnLog');
    const block = braceBlock(mainSrc, 'const publishOnLog');
    expect(block).toContain("'run-progress'");
    expect(block).toContain('\\[PROGRESS\\]');
    expect(block).toContain("'log-line'");
  });

  it('발행 단계마다 진행률을 쏜다 — 플랫폼 3종 모두', () => {
    expect(coreSrc).toContain('[PROGRESS] 92%');
    for (const label of ['Blogger 발행 중', '티스토리 발행 중', '워드프레스 발행 중']) {
      expect(coreSrc).toContain(label);
    }
  });

  it('onLog 실패가 발행을 막지 않는다', () => {
    // emit 은 try/catch 로 감싸야 한다 — 렌더러가 죽어도 발행은 계속돼야 한다
    const start = coreSrc.indexOf('const emit = (msg: string)');
    const block = braceBlock(coreSrc, 'const emit = (msg: string)');
    expect(block).toContain('try {');
    expect(block).toContain('catch');
  });

  it('onLog 를 안 넘겨도 동작한다 (선택 인자)', () => {
    const sig = coreSrc.slice(
      coreSrc.indexOf('export async function publishGeneratedContent'),
      coreSrc.indexOf('): Promise<PublishGeneratedContentResult>'),
    );
    expect(sig).toMatch(/onLog\?\s*:/);
  });
});

describe('쇼핑모드 — 소스에서 잠겨 있지 않다', () => {
  it('shopping 옵션에 disabled 가 없다', () => {
    const opts = uiHtml.match(/<option[^>]*value=["']shopping["'][^>]*>/g) || [];
    expect(opts.length).toBeGreaterThan(0);
    opts.forEach(o => expect(o).not.toContain('disabled'));
  });

  it('"준비 중" 문구가 남아 있지 않다', () => {
    const opts = uiHtml.match(/<option[^>]*value=["']shopping["'][^>]*>[^<]*/g) || [];
    opts.forEach(o => {
      expect(o).not.toContain('준비 중');
      expect(o).not.toContain('재오픈');
    });
  });
});

describe('소스 ↔ 배포본 정합 — 이번 사고의 진짜 원인', () => {
  const distHtmlPath = path.join(ROOT, 'dist', 'ui', 'index.html');

  it('dist/ui/index.html 이 있다면 shopping 옵션 상태가 소스와 같아야 한다', () => {
    if (!fs.existsSync(distHtmlPath)) return; // 빌드 전이면 검사 대상 아님
    const distHtml = fs.readFileSync(distHtmlPath, 'utf8');
    const pick = (h: string) => (h.match(/<option[^>]*value=["']shopping["'][^>]*>/g) || [])
      .map(s => s.includes('disabled'));
    // 소스가 활성이면 배포본도 활성이어야 한다
    const srcDisabled = pick(uiHtml);
    const distDisabled = pick(distHtml);
    if (distDisabled.length > 0) {
      expect(distDisabled).toEqual(srcDisabled.slice(0, distDisabled.length));
    }
  });
});
