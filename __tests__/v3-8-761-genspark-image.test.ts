/**
 * v3.8.761 — 젠스파크 AI 이미지 엔진 (사장님 요청: "젠스파크로 이미지 생성이 가능하게")
 *
 * 실측(2026-10-10, Plus 계정, Nano Banana 2 Flash Lite — 화면 표시 "이 이미지 모델 크레딧 무료 사용"):
 *   /ai_image → 전송 → 주소 agents?id=<uuid>(내 작업 번호) → 약 20초 → GET /api/project?id=<uuid>
 *   messages[].session_state.media_task_results[taskId] = { url, url_nowatermark, status: 'SUCCESS' }
 * 결과는 작업 번호로 서버 기록에서 꺼낸다 — Dropshot 759 처럼 화면에서 "새로 뜬 이미지"를 고르지 않는다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { parseGensparkImageProject, pickGensparkImageUrl, judgeImageProgress, AI_IMAGE_URL } from '../src/core/genspark/genspark-image';
import { runGensparkExclusive } from '../src/core/genspark/genspark-client';
import { normalizeImageEngine, SUPPORTED_IMAGE_ENGINES, engineAllowsImageText } from '../src/core/imageDispatcher';

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'genspark-image-project-2026-10-10.json'), 'utf8'));
const dispatcherSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'imageDispatcher.ts'), 'utf8');

describe('젠스파크 이미지 결과 읽기', () => {
  test('진입 주소(실측)', () => {
    expect(AI_IMAGE_URL).toBe('https://www.genspark.ai/ai_image');
  });

  test('⭐ 완료 + 결과 이미지(워터마크 없는 주소 우선)', () => {
    const r = parseGensparkImageProject(fixture);
    expect(r.finished).toBe(true);
    expect(r.images).toHaveLength(1);
    expect(pickGensparkImageUrl(r)).toBe('https://www.genspark.ai/api/files/s/kFTOHw2Z?cache_control=3600');
  });

  test('워터마크 없는 주소가 없으면 일반 주소', () => {
    const noClean = JSON.parse(JSON.stringify(fixture));
    const results = noClean.data.session_state.messages[4].session_state.media_task_results;
    for (const k of Object.keys(results)) delete results[k].url_nowatermark;
    expect(pickGensparkImageUrl(parseGensparkImageProject(noClean))).toBe('https://www.genspark.ai/api/files/s/hmRbtJ2M?cache_control=3600');
  });

  test('아직 진행 중(멈춘 이유 없음·결과 없음)이면 미완료 · 고를 이미지 없음', () => {
    const midRun = { data: { status: 'FINISHED', session_state: { messages: [{ role: 'user' }, { role: 'assistant' }] } } };
    const r = parseGensparkImageProject(midRun);
    expect(r.finished).toBe(false);
    expect(pickGensparkImageUrl(r)).toBe('');
  });

  test('실패한 결과는 고르지 않는다', () => {
    const failed = JSON.parse(JSON.stringify(fixture));
    const results = failed.data.session_state.messages[4].session_state.media_task_results;
    for (const k of Object.keys(results)) results[k].status = 'FAILED';
    expect(pickGensparkImageUrl(parseGensparkImageProject(failed))).toBe('');
  });

  test('이상한 입력이면 빈 결과', () => {
    expect(parseGensparkImageProject(null)).toEqual({ finished: false, images: [] });
  });
});

/**
 * 실측(2026-10-10 두 번째 · 소제목형 프롬프트): 젠스파크는 "이미지 생성을 백그라운드로 접수했습니다" 라고 답하며
 * +9초에 stop_reason 'finished' 가 되고, 이미지는 +13초에 붙었다. 예전 판정은 +9초에 "끝났는데 이미지 없음" 으로 실패시켰다.
 */
describe('기다릴지·받을지·실패할지 판정', () => {
  const finishedNoImage = { finished: true, images: [] };

  test('⭐ 대화가 끝났어도 이미지가 아직이면 기다린다(실측 +9초)', () => {
    expect(judgeImageProgress(finishedNoImage, 4_000).state).toBe('wait');
  });

  test('이미지가 붙으면 받는다(실측 +13초)', () => {
    const r = judgeImageProgress(parseGensparkImageProject(fixture), 4_000);
    expect(r.state).toBe('ready');
    expect(r.url).toContain('kFTOHw2Z');
  });

  test('결과가 실패 상태면 바로 실패', () => {
    const r = judgeImageProgress({ finished: true, images: [{ id: 'x', url: 'https://www.genspark.ai/api/files/s/a', status: 'FAILED' }] }, 1_000);
    expect(r.state).toBe('failed');
    expect(r.reason).toContain('FAILED');
  });

  test('끝난 뒤 90초가 지나도 이미지가 없으면 실패', () => {
    expect(judgeImageProgress(finishedNoImage, 91_000).state).toBe('failed');
  });

  test('아직 진행 중이면 기다린다', () => {
    expect(judgeImageProgress({ finished: false, images: [] }, 0).state).toBe('wait');
  });
});

describe('리서치와 이미지가 같은 로그인 폴더를 쓴다 — 한 번에 하나씩', () => {
  test('⭐ 순번 장치: 먼저 들어온 일이 끝나야 다음 일이 시작한다', async () => {
    const order: string[] = [];
    const slow = runGensparkExclusive(async () => { order.push('A 시작'); await new Promise((r) => setTimeout(r, 30)); order.push('A 끝'); return 'A'; });
    const fast = runGensparkExclusive(async () => { order.push('B 시작'); order.push('B 끝'); return 'B'; });
    expect(await Promise.all([slow, fast])).toEqual(['A', 'B']);
    expect(order).toEqual(['A 시작', 'A 끝', 'B 시작', 'B 끝']);
  });

  test('앞의 일이 실패해도 다음 일은 돈다', async () => {
    const bad = runGensparkExclusive(async () => { throw new Error('x'); });
    const good = runGensparkExclusive(async () => 'ok');
    await expect(bad).rejects.toThrow('x');
    expect(await good).toBe('ok');
  });
});

describe('엔진 분배기 등록', () => {
  test('⭐ 엔진 이름과 별칭', () => {
    expect((SUPPORTED_IMAGE_ENGINES as readonly string[]).includes('genspark-image')).toBe(true);
    expect(normalizeImageEngine('genspark-image')).toBe('genspark-image');
    expect(normalizeImageEngine('genspark')).toBe('genspark-image');
  });

  test('썸네일 제목 글자를 넣을 수 있는 엔진으로 본다(Dropshot 과 같은 나노바나나 계열)', () => {
    expect(engineAllowsImageText('genspark-image')).toBe(true);
  });

  test('⭐ 실패해도 유료 API 로 넘어가지 않는다(본인 계정 엔진 — Dropshot 과 같은 규칙)', () => {
    expect(dispatcherSrc).toMatch(/chosen === 'genspark-image'[^\n]*return \[\]/);
  });

  test('실행은 작업 번호로 결과를 받는 makeGensparkImage 로 간다', () => {
    expect(dispatcherSrc).toContain("case 'genspark-image':");
    expect(dispatcherSrc).toContain("import('./genspark/genspark-image')");
  });
});
