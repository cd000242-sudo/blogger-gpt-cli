/**
 * "썸네일에 텍스트 없이 생성" 옵션 (v3.8.336)
 *
 * 기본 동작(체크 해제)은 기존과 100% 동일해야 하고, 체크 시에만 제목 오버레이 지시가
 * 텍스트 금지로 바뀌어야 한다. 썸네일 구도(hero 16:9)는 두 경우 모두 유지된다.
 */
import fs from 'fs';
import path from 'path';

const read = (...segments: string[]) =>
  fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');

describe('썸네일 텍스트 미포함 — 프롬프트 계층', () => {
  let thumbnailSource = '';
  let dispatcherSource = '';

  beforeAll(() => {
    thumbnailSource = read('src', 'thumbnail.ts');
    dispatcherSource = read('src', 'core', 'imageDispatcher.ts');
  });

  it('텍스트 금지 규칙이 썸네일에도 적용될 수 있어야 한다', () => {
    // 기존: isThumbnail이면 무조건 텍스트 규칙 없음 → 옵션이 있으면 금지 규칙을 건다
    expect(thumbnailSource).toContain('const noTextRule = (isThumbnail && !noTextOverlay)');
    expect(thumbnailSource).not.toContain('const noTextRule = isThumbnail\n    ?');
  });

  it('한국어 썸네일 프롬프트에도 텍스트 금지 규칙이 붙는다', () => {
    // 이 분기는 원래 noTextRule을 아예 붙이지 않아 옵션이 무시되던 자리
    expect(thumbnailSource).toContain('wide blog hero image, fill the horizontal frame without empty margins.${noTextRule}`');
  });

  it('제목 오버레이 지시를 텍스트 금지로 교체한다', () => {
    expect(thumbnailSource).toContain('const thumbnailTextRule = noTextOverlay');
    expect(thumbnailSource).toContain('5. NO TEXT: ABSOLUTELY NO text, letters, words, numbers, or symbols anywhere in the image');
    // 체크 해제 시의 기존 문구는 그대로 남아 있어야 한다
    expect(thumbnailSource).toContain('5. TEXT OVERLAY: Include the title as stylish KOREAN text overlay');
  });

  it('디스패처가 텍스트 허용 여부를 단일 게이트로 판단한다', () => {
    expect(dispatcherSource).toContain('const userWantsNoText = extra?.thumbnailNoText === true;');
    expect(dispatcherSource).toContain('const allowImageText = promptModeAllowsImageText(engine, isThumbnail) && !userWantsNoText;');
  });

  it('텍스트를 강제 주입하던 엔진들이 옵션을 존중한다', () => {
    // 나노바나나 계열 — 썸네일 구도는 유지하고 오버레이만 끔
    expect(dispatcherSource).toContain('noTextOverlay: userWantsNoText,');
    // dropshot(리더스 무제한) — MANDATORY 오버레이 대신 텍스트 금지
    expect(dispatcherSource).toContain('dropshotPrompt = enforceNoTextPrompt(inferredPrompt);');
    expect(dispatcherSource).toContain('} else if (isThumbnail && prompt) {');
    // flow — 지시가 없으면 임의로 글자를 넣으므로 명시 금지
    expect(dispatcherSource).toContain('userWantsNoText ? enforceNoTextPrompt(inferredPrompt) : inferredPrompt,');
  });
});

describe('썸네일 텍스트 미포함 — 발행 3경로 배선', () => {
  it('단일 발행: 체크박스 값을 payload에 싣는다', () => {
    expect(read('electron', 'ui', 'index.html')).toContain('id="thumbnailNoText"');
    expect(read('electron', 'ui', 'modules', 'posting.js'))
      .toContain("thumbnailNoText: !!document.getElementById('thumbnailNoText')?.checked,");
  });

  it('연속발행: 대기열 추가 시점 값을 항목에 고정해 전달한다', () => {
    const source = read('electron', 'ui', 'modules', 'publish-queue.js');
    expect(source).toContain("thumbnailNoText: !!document.getElementById('thumbnailNoText')?.checked,");
    expect(source).toContain('thumbnailNoText: !!snap.thumbnailNoText,');
    expect(source).toContain('thumbnailNoText: item.thumbnailNoText,');
    expect(source).toContain('if (force || item.thumbnailNoText == null) item.thumbnailNoText = snap.thumbnailNoText;');
    expect(source).toContain('thumbnailNoText: !!item.thumbnailNoText,');
  });

  it('스케줄 실행: 저장값이 있으면 그 값을, 없으면 화면 설정을 쓴다', () => {
    const source = read('electron', 'ui', 'script.js');
    expect(source).toContain('const storedThumbnailNoText = schedule.thumbnailNoText ?? storedPayload.thumbnailNoText;');
    // 구버전 예약은 키 자체를 넘기지 않아야 createPayload의 DOM 값이 살아남는다
    expect(source).toContain('const scheduleThumbnailNoTextOverride = storedThumbnailNoText == null');
    expect(source).toContain('...scheduleThumbnailNoTextOverride,');
  });

  it('백엔드 오케스트레이션이 두 썸네일 생성 경로 모두에 옵션을 넘긴다', () => {
    const source = read('src', 'core', 'final', 'orchestration.ts');
    const occurrences = source.split('thumbnailNoText: payload.thumbnailNoText === true,').length - 1;
    expect(occurrences).toBe(2); // 일반 발행 + URL 기반 생성
  });

  it('거미줄 포스팅: 텍스트 포함 해제 시 텍스트 금지를 명시한다', () => {
    const source = read('electron', 'main.ts');
    expect(source).toContain('Generate pure visual imagery only. Absolutely NO Korean text');
    expect(source).not.toContain("        : '';\n\n      // v3.8.8: dataURL");
  });
});
