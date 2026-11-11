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
import { fetchJsonInPage, openGensparkHeadless, projectIdFromUrl, readLoginResponse, runGensparkExclusive, GENSPARK_ORIGIN } from './genspark-client';

export const AI_IMAGE_URL = `${GENSPARK_ORIGIN}/ai_image`;

export interface GensparkImageEntry { id: string; url: string; status: string }
/** `refusal` = Genspark's own words when it turned the request down (set only then). */
export interface GensparkImageProject { finished: boolean; images: GensparkImageEntry[]; refusal?: string }

// v3.8.771 — seen 2026-11-11: "서버가 과부하 상태입니다. 나중에 다시 시도해 주세요." as the only answer, 4 s after sending
const GENSPARK_REFUSAL = /과부하|나중에 다시 시도|overloaded|try again later/i;

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
      const status = String(r?.status || '');
      // 실패한 작업은 이미지 URL이 없어도 남겨야 즉시 실패 이유를 알릴 수 있다.
      if (/^https?:\/\//i.test(url) || /fail|error|cancel/i.test(status)) images.push({ id, url, status });
    }
  }
  // 리서치와 같은 규칙: data.status 가 아니라 멈춘 이유로 완료를 본다 (data.status 는 성공하는 작업도 처음부터 FINISHED)
  const project: GensparkImageProject = { finished: state.stop_reason === 'finished', images };
  const last = messages[messages.length - 1];
  const said = last?.role === 'assistant' ? String(last.content || '').replace(/\s+/g, ' ').trim() : '';
  if (images.length === 0 && said && GENSPARK_REFUSAL.test(said)) project.refusal = said.slice(0, 160);
  return project;
}

export function pickGensparkImageUrl(project: GensparkImageProject): string {
  return project.images.find((i) => /^success$/i.test(i.status))?.url || '';
}

/**
 * 기다릴지·받을지·실패할지. 젠스파크는 "백그라운드로 접수했습니다" 라고 대화를 먼저 끝내고(실측 +9초)
 * 이미지는 그 뒤에 붙는다(+13초). 그래서 "끝남 + 이미지 없음" 은 실패가 아니라 기다릴 일이다 — 끝난 뒤 90초까지.
 */
export function judgeImageProgress(project: GensparkImageProject, msSinceFinished: number, msSinceRefusal = 0): { state: 'ready' | 'wait' | 'failed'; url?: string; reason?: string } {
  const url = pickGensparkImageUrl(project);
  if (url) return { state: 'ready', url };
  const failed = project.images.find((i) => /fail|error|cancel/i.test(i.status));
  if (failed && project.images.every((i) => /fail|error|cancel/i.test(i.status))) return { state: 'failed', reason: `젠스파크 이미지 생성 실패(${failed.status})` };
  // a refusal is final: one more poll (8 s) to be sure, then stop with Genspark's own words instead of a 3-minute timeout
  if (project.refusal && msSinceRefusal > 8_000) return { state: 'failed', reason: `GENSPARK_REFUSED: 젠스파크가 요청을 받지 않았습니다 — "${project.refusal}"` };
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

/**
 * v3.8.771 — Genspark puts a "try Media Studio" notice over /ai_image (seen 2026-11-11). Its backdrop (`.mar-backdrop`)
 * covers the page, so the click on the send button timed out and every image failed although the account was logged in.
 * Closes the notice with its own "later" button (Escape when that button is missing). Returns true when a notice was closed.
 */
export async function dismissGensparkNotice(page: any, onLog?: (m: string) => void): Promise<boolean> {
  try {
    const backdrop = page.locator('.mar-backdrop').first();
    if (!(await backdrop.isVisible().catch(() => false))) return false;
    const later = backdrop.locator('button', { hasText: /나중에|Later|Not now/i }).first();
    if (await later.isVisible().catch(() => false)) await later.click({ timeout: 5_000 });
    else await page.keyboard.press('Escape');
    await backdrop.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => undefined);
    const closed = !(await backdrop.isVisible().catch(() => false));
    onLog?.(closed ? 'ℹ️ 젠스파크 안내 창을 닫고 이어서 진행합니다.' : '⚠️ 젠스파크 안내 창을 닫지 못했습니다.');
    return closed;
  } catch {
    return false;
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
    // an ordinary window parked off-screen: a headless browser is turned down with "server overloaded" (measured 2026-11-11)
    const opened = await openGensparkHeadless(options.onLog, { visibleOffscreen: true });
    context = opened.context;
    const page = opened.page;
    await page.goto(AI_IMAGE_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    options.onLog?.('🔐 젠스파크 이미지 생성 전 로그인 상태를 확인합니다.');
    const session = await fetchJsonInPage(page, '/api/is_login');
    if (session.status !== 200 || !session.json) {
      return { ok: false, dataUrl: '', elapsedMs: Date.now() - startedAt, error: `GENSPARK_SESSION_CHECK_FAILED: 로그인 상태를 확인하지 못했습니다(HTTP ${session.status}). 이미지 엔진 옆 [상태 확인]을 눌러 주세요.` };
    }
    if (!readLoginResponse(session.json).loggedIn) {
      return { ok: false, dataUrl: '', elapsedMs: Date.now() - startedAt, error: 'GENSPARK_LOGIN_REQUIRED: 이미지 엔진 옆 [젠스파크 로그인]을 먼저 눌러 주세요. 리서치와 같은 계정을 사용합니다.' };
    }
    options.onLog?.('✅ 젠스파크 로그인 확인 완료 — 이미지 생성을 시작합니다.');
    await page.locator('textarea').first().fill(text, { timeout: 20_000 });
    const send = page.locator('[aria-label="메시지 전송"]').first();
    try {
      await send.click({ timeout: 4_000 });
    } catch (clickError) {
      // a notice over the page swallows the click: close it and press send once more; without a notice the first error stands
      if (!(await dismissGensparkNotice(page, options.onLog))) throw clickError;
      await send.click({ timeout: 10_000 });
    }
    options.onLog?.('✨ 젠스파크 이미지 생성 중 — 보통 20초 안팎');

    let projectId = '';
    for (let i = 0; i < 60 && !projectId; i += 1) {
      await page.waitForTimeout(1000);
      projectId = projectIdFromUrl(page.url());
    }
    if (!projectId) {
      const login = await fetchJsonInPage(page, '/api/is_login').catch(() => ({ json: null }));
      const loggedIn = readLoginResponse(login?.json).loggedIn;
      return { ok: false, dataUrl: '', elapsedMs: Date.now() - startedAt, error: loggedIn ? '젠스파크가 작업 번호를 주지 않았습니다(전송 실패)' : 'GENSPARK_LOGIN_REQUIRED: 설정에서 젠스파크 로그인을 먼저 해 주세요.' };
    }

    const deadline = startedAt + (options.timeoutMs ?? 3 * 60_000);
    let finishedAt = 0;
    let refusedAt = 0;
    while (Date.now() < deadline) {
      await page.waitForTimeout(3000);
      const { status, json } = await fetchJsonInPage(page, `/api/project?id=${projectId}`);
      if (status === 401 || status === 403) {
        return { ok: false, dataUrl: '', projectId, elapsedMs: Date.now() - startedAt, error: 'GENSPARK_SESSION_EXPIRED: 이미지 작업에 접근할 수 없습니다. 이미지 엔진 옆 [젠스파크 로그인]으로 다시 연결해 주세요.' };
      }
      if (status !== 200 || !json) continue;
      const project = parseGensparkImageProject(json);
      if (project.finished && !finishedAt) finishedAt = Date.now();
      if (project.refusal && !refusedAt) refusedAt = Date.now();
      const verdict = judgeImageProgress(project, finishedAt ? Date.now() - finishedAt : 0, refusedAt ? Date.now() - refusedAt : 0);
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
