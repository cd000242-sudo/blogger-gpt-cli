/**
 * ✨ 젠스파크 AI 이미지 엔진 (v3.8.761) — 사장님 요청: "젠스파크로 이미지 생성이 가능하게"
 *
 * 실측(2026-10-10, Plus 계정, Nano Banana 2 Flash Lite — 화면 표시 "이 이미지 모델 크레딧 무료 사용"):
 *   /ai_image → textarea → [aria-label="메시지 전송"] → 주소 agents?id=<uuid>(내 작업 번호) → 약 20초
 *   GET /api/project?id=<uuid> → messages[].session_state.media_task_results[taskId] = { url, url_nowatermark, status }
 *
 * 결과는 **작업 번호로 서버 기록에서** 꺼낸다. Dropshot 759 사고(화면에 새로 뜬 남의 이미지를 집음)가 생길 자리가 없다.
 * 같은 로그인 폴더를 리서치와 함께 쓰므로 runGensparkExclusive 줄을 선다.
 */
import { fetchJsonInPage, openGensparkHeadless, projectIdFromUrl, runGensparkExclusive, GENSPARK_ORIGIN } from './genspark-client';

export const AI_IMAGE_URL = `${GENSPARK_ORIGIN}/ai_image`;

export interface GensparkImageEntry { id: string; url: string; status: string }
export interface GensparkImageProject { finished: boolean; images: GensparkImageEntry[] }

/** /api/project 응답에서 생성 결과를 읽는다. 워터마크 없는 주소를 우선한다 */
export function parseGensparkImageProject(json: unknown): GensparkImageProject {
  const state = (json as any)?.data?.session_state;
  if (!state || typeof state !== 'object') return { finished: false, images: [] };
  const messages: any[] = Array.isArray(state.messages) ? state.messages : [];
  const images: GensparkImageEntry[] = [];
  for (const message of messages) {
    for (const [id, result] of Object.entries(message?.session_state?.media_task_results || {})) {
      const r = result as any;
      const url = String(r?.url_nowatermark || r?.url || '');
      if (/^https?:\/\//i.test(url)) images.push({ id, url, status: String(r?.status || '') });
    }
  }
  // 리서치와 같은 규칙: data.status 가 아니라 멈춘 이유로 완료를 본다
  return { finished: state.stop_reason === 'finished', images };
}

export function pickGensparkImageUrl(project: GensparkImageProject): string {
  return project.images.find((i) => /^success$/i.test(i.status))?.url || '';
}

/**
 * 기다릴지·받을지·실패할지. 젠스파크는 "백그라운드로 접수했습니다" 라고 대화를 먼저 끝내고(실측 +9초)
 * 이미지는 그 뒤에 붙는다(+13초). 그래서 "끝남 + 이미지 없음" 은 실패가 아니라 기다릴 일이다 — 끝난 뒤 90초까지.
 */
export function judgeImageProgress(project: GensparkImageProject, msSinceFinished: number): { state: 'ready' | 'wait' | 'failed'; url?: string; reason?: string } {
  const url = pickGensparkImageUrl(project);
  if (url) return { state: 'ready', url };
  const failed = project.images.find((i) => /fail|error|cancel/i.test(i.status));
  if (failed && project.images.every((i) => /fail|error|cancel/i.test(i.status))) return { state: 'failed', reason: `젠스파크 이미지 생성 실패(${failed.status})` };
  if (project.finished && msSinceFinished > 90_000) return { state: 'failed', reason: '젠스파크가 이미지를 만들지 않았습니다(작업은 끝남)' };
  return { state: 'wait' };
}

async function imageToDataUrl(context: any, page: any, url: string): Promise<string> {
  const inPage = await page.evaluate(async (u: string) => {
    const response = await fetch(u, { credentials: 'include' });
    if (!response.ok) return '';
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return '';
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  }, url).catch(() => '');
  if (inPage) return inPage;
  try {
    const res = await context.request.get(url, { timeout: 30_000 });
    const type = String(res.headers()['content-type'] || '').split(';')[0]!.trim();
    if (!res.ok() || !type.startsWith('image/')) return '';
    return `data:${type};base64,${(await res.body()).toString('base64')}`;
  } catch {
    return '';
  }
}

export interface GensparkImageResult { ok: boolean; dataUrl: string; projectId?: string; elapsedMs: number; error?: string }

/** 이미지 1장 — 한 번에 하나씩. 실패하면 이유와 함께 빈 결과(던지지 않는다) */
export function makeGensparkImage(prompt: string, options: { onLog?: (m: string) => void; timeoutMs?: number } = {}): Promise<GensparkImageResult> {
  return runGensparkExclusive(() => makeOnce(prompt, options));
}

async function makeOnce(prompt: string, options: { onLog?: (m: string) => void; timeoutMs?: number }): Promise<GensparkImageResult> {
  const startedAt = Date.now();
  const text = String(prompt || '').trim();
  if (!text) return { ok: false, dataUrl: '', elapsedMs: 0, error: '프롬프트가 비었습니다' };
  let context: any = null;
  try {
    const opened = await openGensparkHeadless(options.onLog);
    context = opened.context;
    const page = opened.page;
    await page.goto(AI_IMAGE_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.locator('textarea').first().fill(text, { timeout: 20_000 });
    await page.locator('[aria-label="메시지 전송"]').first().click({ timeout: 10_000 });
    options.onLog?.('✨ 젠스파크 이미지 생성 중 — 보통 20초 안팎');

    let projectId = '';
    for (let i = 0; i < 60 && !projectId; i += 1) {
      await page.waitForTimeout(1000);
      projectId = projectIdFromUrl(page.url());
    }
    if (!projectId) {
      const login = await fetchJsonInPage(page, '/api/is_login').catch(() => ({ json: null }));
      const loggedIn = !!(login?.json?.data?.cogen_id || login?.json?.cogen_id);
      return { ok: false, dataUrl: '', elapsedMs: Date.now() - startedAt, error: loggedIn ? '젠스파크가 작업 번호를 주지 않았습니다(전송 실패)' : 'GENSPARK_LOGIN_REQUIRED: 설정에서 젠스파크 로그인을 먼저 해 주세요.' };
    }

    const deadline = startedAt + (options.timeoutMs ?? 3 * 60_000);
    let finishedAt = 0;
    while (Date.now() < deadline) {
      await page.waitForTimeout(3000);
      const { status, json } = await fetchJsonInPage(page, `/api/project?id=${projectId}`);
      if (status !== 200 || !json) continue;
      const project = parseGensparkImageProject(json);
      if (project.finished && !finishedAt) finishedAt = Date.now();
      const verdict = judgeImageProgress(project, finishedAt ? Date.now() - finishedAt : 0);
      if (verdict.state === 'ready' && verdict.url) {
        const dataUrl = await imageToDataUrl(context, page, verdict.url);
        if (dataUrl.length > 10_000) return { ok: true, dataUrl, projectId, elapsedMs: Date.now() - startedAt };
        return { ok: false, dataUrl: '', projectId, elapsedMs: Date.now() - startedAt, error: '결과 이미지를 받지 못했습니다' };
      }
      if (verdict.state === 'failed') return { ok: false, dataUrl: '', projectId, elapsedMs: Date.now() - startedAt, error: verdict.reason || '젠스파크 이미지 실패' };
    }
    return { ok: false, dataUrl: '', projectId, elapsedMs: Date.now() - startedAt, error: 'GENSPARK_TIMEOUT: 시간 안에 이미지가 나오지 않았습니다' };
  } catch (error: any) {
    return { ok: false, dataUrl: '', elapsedMs: Date.now() - startedAt, error: String(error?.message || error).slice(0, 200) };
  } finally {
    await context?.close().catch(() => {});
  }
}
