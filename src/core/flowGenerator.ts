/**
 * 🌊 Flow 이미지 생성 엔진 (Google Labs Flow — labs.google/fx/tools/flow)
 *
 * 아키텍처 (실측 기반):
 *   probe-flow-driver.ts 로 "UI 버튼 자동 클릭 + 네트워크 응답 intercept" 방식이 성공 확인됨.
 *   page.evaluate 로 직접 API 호출은 reCAPTCHA Enterprise 의 PUBLIC_ERROR_UNUSUAL_ACTIVITY 로 거부됨.
 *   Flow React 앱이 내부적으로 grecaptcha 토큰 + fetch 를 처리하므로, 우리는 UI 만 조작.
 *
 * 흐름:
 *   1. ensurePage()로 labs.google persistent context 확보 (ImageFX 세션 공유)
 *   2. Flow 프로젝트 확보 (캐시 or 새로 생성: /fx/api/trpc/project.createProject)
 *   3. 프로젝트 페이지 이동 → contenteditable textbox 에 프롬프트 입력
 *   4. "arrow_forward" 아이콘 버튼(생성) 클릭
 *   5. page.waitForResponse 로 flowMedia:batchGenerateImages 응답 대기
 *   6. 응답의 fifeUrl 을 page.evaluate fetch 로 다운로드 → Buffer → base64
 *
 * 모델: NARWHAL (= Nano Banana 2, Pro 구독의 기본)
 *       Precise Mode ON 시 Nano Banana Pro 로 변경 (추후 별도 probe 필요)
 *
 * 요구사항: Google AI Pro 이상 + labs.google/fx 에 로그인 (ImageFX 로그인과 공유)
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { ensurePage } from './imageFxGenerator';

// ═══════════════════════════════════════════════════
// 모듈 상태
// ═══════════════════════════════════════════════════

let cachedProjectId: string | null = null;
let _flowDisabledThisSession = false;

const PROJECT_CACHE_FILE = 'flow-project-id.json';

function getProjectCachePath(): string {
  try {
    const electron = require('electron');
    if (electron?.app?.getPath) {
      return path.join(electron.app.getPath('userData'), PROJECT_CACHE_FILE);
    }
  } catch { /* non-electron */ }
  const dir = path.join(os.homedir(), '.blogger-gpt');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, PROJECT_CACHE_FILE);
}

function loadProjectId(): string | null {
  try {
    const p = getProjectCachePath();
    if (!fs.existsSync(p)) return null;
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return data?.projectId || null;
  } catch { return null; }
}

function saveProjectId(id: string): void {
  try {
    fs.writeFileSync(getProjectCachePath(), JSON.stringify({ projectId: id, savedAt: new Date().toISOString() }, null, 2), 'utf-8');
  } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════
// 상수
// ═══════════════════════════════════════════════════

const FLOW_PROJECT_URL_PREFIX = 'https://labs.google/fx/tools/flow/project/';
const FLOW_HOME_URL = 'https://labs.google/fx/tools/flow';
const BATCH_GENERATE_URL_MARKER = 'flowMedia:batchGenerateImages';
const GENERATION_TIMEOUT_MS = 90000; // 90초 — 이미지 생성 대기 최대치
const MAX_RETRIES = 2;

// Flow UI 가 현재 지원하는 비율 선택지 (Nano Banana 2 기준)
// 드라이버에서 확인: 기본이 LANDSCAPE(16:9). 다른 비율은 UI 토글 필요 (추후 확장).
const ASPECT_RATIO_LABEL: Record<string, string> = {
  '1:1':       'IMAGE_ASPECT_RATIO_SQUARE',
  '9:16':      'IMAGE_ASPECT_RATIO_PORTRAIT',
  '16:9':      'IMAGE_ASPECT_RATIO_LANDSCAPE',
  '4:3':       'IMAGE_ASPECT_RATIO_LANDSCAPE_FOUR_THREE',
};

// ═══════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════

export interface FlowResult {
  ok: boolean;
  dataUrl: string;
  error?: string;
  modelUsed?: string;
}

export async function makeFlowImage(
  prompt: string,
  options: {
    aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
    isThumbnail?: boolean;
  } = {},
  onLog?: (msg: string) => void,
): Promise<FlowResult> {
  if (_flowDisabledThisSession) {
    return { ok: false, dataUrl: '', error: 'FLOW_DISABLED_SESSION: 이번 세션에서 Flow 접근 불가 판정' };
  }

  const sanitized = sanitizeFlowPrompt(prompt);
  const currentPrompt = enhanceFlowPrompt(sanitized, !!options.isThumbnail);
  console.log(`[FLOW] 📝 최종 프롬프트(${currentPrompt.length}자): ${currentPrompt.substring(0, 200)}${currentPrompt.length > 200 ? '...' : ''}`);
  let lastError: Error | null = null;

  try {
    const page = await ensurePage(onLog);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const projectId = await ensureFlowProject(page, onLog);

        // Flow 프로젝트 페이지로 이동 (React 앱 초기화 필요)
        const currentUrl = page.url();
        if (!currentUrl.startsWith(FLOW_PROJECT_URL_PREFIX + projectId)) {
          console.log(`[FLOW] 🌐 프로젝트 페이지 이동: ${projectId}`);
          onLog?.(`🌐 [FLOW] 프로젝트 페이지 로딩 중...`);
          await page.goto(`${FLOW_PROJECT_URL_PREFIX}${projectId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
          // React 앱 + grecaptcha Enterprise 초기화 대기
          await page.waitForTimeout(5000);
        }

        console.log(`[FLOW] 🌊 이미지 생성 시도 ${attempt}/${MAX_RETRIES} (UI 자동 조작)`);
        onLog?.(`🌊 [FLOW] 이미지 생성 중... (${attempt}/${MAX_RETRIES})`);

        // Step A: 프롬프트 textarea 찾기 + 입력
        const textbox = page.locator('div[role="textbox"][contenteditable="true"], [data-slate-editor="true"]').first();
        await textbox.waitFor({ state: 'visible', timeout: 15000 });

        // 기존 내용 지우기 (선택 후 삭제)
        await textbox.click({ timeout: 5000 });
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Delete');
        await page.keyboard.type(currentPrompt, { delay: 15 });
        await page.waitForTimeout(800);

        // Step B: batchGenerateImages 응답을 미리 대기 등록
        const responsePromise: Promise<any> = page.waitForResponse(
          (res: any) => res.url().includes(BATCH_GENERATE_URL_MARKER) && res.status() === 200,
          { timeout: GENERATION_TIMEOUT_MS },
        );

        // Step C: arrow_forward 아이콘이 있는 버튼(생성) 클릭
        const generateBtn = page.locator('button').filter({
          has: page.locator('i', { hasText: 'arrow_forward' }),
        }).first();
        await generateBtn.waitFor({ state: 'visible', timeout: 10000 });
        console.log(`[FLOW] 🖱️  생성 버튼 클릭`);
        await generateBtn.click({ timeout: 5000 });

        // Step D: 응답 대기
        console.log(`[FLOW] ⏳ 응답 대기 중 (최대 ${GENERATION_TIMEOUT_MS / 1000}s)...`);
        onLog?.(`⏳ [FLOW] 이미지 생성 응답 대기 중...`);
        const response = await responsePromise;

        // Step E: 응답 파싱
        let data: any;
        try {
          data = await response.json();
        } catch (parseErr) {
          const text = await response.text().catch(() => '');
          throw new Error(`FLOW_RESPONSE_PARSE: ${text.substring(0, 300)}`);
        }

        const gen = data?.media?.[0]?.image?.generatedImage;
        const fifeUrl: string | undefined = gen?.fifeUrl;
        const modelUsed: string | undefined = gen?.modelNameType;
        if (!fifeUrl) {
          throw new Error(`FLOW_NO_FIFEURL: ${JSON.stringify(data).substring(0, 300)}`);
        }

        // Step F: fifeUrl 에서 이미지 다운로드
        console.log(`[FLOW] 📥 이미지 다운로드: ${fifeUrl.substring(0, 80)}...`);
        const downloadResult = await page.evaluate(async (url: string) => {
          try {
            const r = await fetch(url);
            if (!r.ok) return { error: `HTTP_${r.status}` };
            const buf = await r.arrayBuffer();
            const bytes = new Uint8Array(buf);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] as number);
            return {
              success: true,
              base64: btoa(binary),
              contentType: r.headers.get('content-type') || 'image/png',
            };
          } catch (e: any) {
            return { error: 'EXCEPTION', detail: e.message };
          }
        }, fifeUrl);

        if (!(downloadResult as any).success) {
          throw new Error(`FLOW_DOWNLOAD_FAIL: ${(downloadResult as any).error || 'unknown'}`);
        }

        const base64 = (downloadResult as any).base64 as string;
        const contentType = (downloadResult as any).contentType as string;
        const bytes = Buffer.from(base64, 'base64').length;
        const model = modelUsed || 'NARWHAL';
        console.log(`[FLOW] ✅ 이미지 생성 성공 (${Math.round(bytes / 1024)}KB, ${model})`);
        onLog?.(`✅ [FLOW] 이미지 생성 완료 (${Math.round(bytes / 1024)}KB, ${model})`);

        return {
          ok: true,
          dataUrl: `data:${contentType};base64,${base64}`,
          modelUsed: model,
        };
      } catch (err: any) {
        console.warn(`[FLOW] ⚠️ 시도 ${attempt}/${MAX_RETRIES} 실패: ${err.message?.substring(0, 200)}`);
        lastError = err;

        // 특정 에러는 즉시 종료 (재시도 무의미)
        const msg = err.message || '';
        if (msg.includes('FLOW_RECAPTCHA') || msg.includes('PERMISSION_DENIED') || msg.includes('PUBLIC_ERROR_UNUSUAL_ACTIVITY')) {
          _flowDisabledThisSession = true;
          return { ok: false, dataUrl: '', error: `FLOW_BLOCKED: ${msg.substring(0, 250)}` };
        }
        if (msg.includes('QUOTA') || msg.includes('429')) {
          return { ok: false, dataUrl: '', error: 'FLOW_QUOTA_EXCEEDED: Google AI Pro 일일 할당량 초과' };
        }

        // UI 못 찾음 — 프로젝트 페이지 재로딩
        if (msg.includes('waiting for') || msg.includes('Timeout') || msg.includes('locator')) {
          if (attempt < MAX_RETRIES) {
            console.warn('[FLOW] UI 못 찾음 → 프로젝트 새로 만들기');
            cachedProjectId = null;
            try { fs.unlinkSync(getProjectCachePath()); } catch { /* ignore */ }
            continue;
          }
        }

        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 3000 * attempt));
        }
      }
    }

    return {
      ok: false,
      dataUrl: '',
      error: lastError?.message?.substring(0, 300) || 'FLOW_UNKNOWN_ERROR: 이미지 생성 실패',
    };
  } catch (err: any) {
    console.error('[FLOW] ❌ 초기화 실패:', err.message);
    return { ok: false, dataUrl: '', error: err.message || 'Flow 초기화 실패' };
  }
}

export async function testFlowConnection(onLog?: (msg: string) => void): Promise<{
  ok: boolean;
  message: string;
  userInfo?: { name?: string; email?: string };
}> {
  try {
    const page = await ensurePage(onLog);
    // Flow API 세션 토큰 체크 (labs.google 도메인)
    const info = await page.evaluate(async () => {
      const candidates = ['/fx/api/auth/session', '/flow/api/auth/session', '/api/auth/session'];
      for (const p of candidates) {
        try {
          const res = await fetch(p, { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            if (data.access_token) return data;
          }
        } catch { /* next */ }
      }
      return null;
    });
    return {
      ok: !!info?.access_token,
      message: info?.access_token
        ? `✅ Flow 연결 성공 — ${info.user?.email || info.user?.name || 'user'}`
        : '❌ 세션 확보 실패',
      userInfo: info?.user,
    };
  } catch (err: any) {
    return { ok: false, message: `❌ ${err.message}` };
  }
}

export async function generateFlowImage(
  prompt: string,
  options: { aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4'; isThumbnail?: boolean } = {},
  onLog?: (msg: string) => void,
): Promise<FlowResult> {
  return makeFlowImage(prompt, options, onLog);
}

// ═══════════════════════════════════════════════════
// 내부 헬퍼
// ═══════════════════════════════════════════════════

async function ensureFlowProject(page: any, onLog?: (msg: string) => void): Promise<string> {
  if (cachedProjectId) return cachedProjectId;
  const loaded = loadProjectId();
  if (loaded) {
    cachedProjectId = loaded;
    return loaded;
  }

  console.log('[FLOW] 📁 새 Flow 프로젝트 생성 중...');
  onLog?.('📁 [FLOW] 새 프로젝트 생성 중...');

  // labs.google 도메인에 있어야 tRPC 호출 가능
  const url = page.url();
  if (!url.includes('labs.google')) {
    await page.goto(FLOW_HOME_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2000);
  }

  const projectId = await page.evaluate(async () => {
    try {
      const now = new Date();
      const title = `BGPT ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const res = await fetch('/fx/api/trpc/project.createProject', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: { projectTitle: title, toolName: 'PINHOLE' } }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.result?.data?.json?.result?.projectId
        || data?.result?.data?.json?.projectId
        || data?.result?.data?.json?.name
        || null;
    } catch { return null; }
  });

  if (!projectId) throw new Error('FLOW_PROJECT_CREATE_FAIL: 프로젝트 생성 실패');
  cachedProjectId = projectId;
  saveProjectId(projectId);
  console.log(`[FLOW] ✅ 프로젝트 생성: ${projectId}`);
  onLog?.(`✅ [FLOW] 프로젝트 준비 완료`);
  return projectId;
}

function sanitizeFlowPrompt(prompt: string): string {
  let cleaned = prompt.trim();
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '').replace(/\*\*/g, '').replace(/^#+\s*/gm, '');
  // 최종 길이 캡은 enhance 이후에 적용 (여기선 raw 1000자까지 허용)
  if (cleaned.length > 1000) cleaned = cleaned.substring(0, 1000);
  return cleaned;
}

/**
 * Flow 전용 프롬프트 강화기 — 블로그 썸네일/소제목 이미지에 맞는 "한국 맥락 + 포토리얼리스틱" 스타일 강제
 *
 * 입력 패턴 분류:
 *   (A) 짧고 주제만 있는 입력 (예: "3차 민생지원금 신청방법", "황사 마스크 추천")
 *       → 한국적 장면 + 인물 + 자연광 실사 템플릿으로 확장
 *   (B) 이미 장면 묘사가 있는 긴 프롬프트 (예: "한 어르신이 주민센터에서...")
 *       → 스타일 꼬리표만 추가
 *
 * 공통: 항상 "포토리얼리스틱 실사 사진, DSLR, 자연광, 초고화질 8K, 인포그래픽 금지, 텍스트 오버레이 금지" 꼬리표.
 *       인포그래픽 기본값으로 떨어지는 것을 명시적으로 차단.
 */
function enhanceFlowPrompt(raw: string, isThumbnail: boolean): string {
  const trimmed = raw.trim();
  // 이미 충분히 묘사된 프롬프트면 스타일만 추가
  const hasSceneDescription =
    trimmed.length > 80 &&
    /(사람|어르신|직원|가족|아이|여성|남성|청년|scene|photo|사진|모습|장면|실사)/i.test(trimmed);

  const styleSuffix =
    ', 포토리얼리스틱 실사 사진, 자연광, 친근하고 따뜻한 분위기, 직관적으로 이해하기 쉬운 구도, DSLR 촬영, 초고화질 8K. ' +
    '반드시 사진처럼 현실적이어야 함. 인포그래픽 금지, 도식/아이콘/만화 스타일 금지, 텍스트 오버레이 금지, 화살표/번호/단계 표시 금지. ' +
    '한국인 외모, 한국 실내/거리 배경, 자연스러운 표정과 동작.';

  if (hasSceneDescription) {
    let out = `${trimmed}${styleSuffix}`;
    if (out.length > 500) out = out.substring(0, 500);
    return out;
  }

  // 짧은 주제/소제목 → 한국적 실사 장면 템플릿으로 확장
  //   - isThumbnail: 인물 중심의 와이드 샷 (시선 끌림)
  //   - H2 inline: 상황을 설명하는 실제 생활 장면
  const subject = trimmed;
  const template = isThumbnail
    ? `한국의 일반 시민이 "${subject}"를 실제로 경험/활용하고 있는 친근하고 현실적인 순간. 배경은 한국 주민센터·집·거리·사무실 등 실제 공간. 초보자와 어르신도 한눈에 상황을 이해할 수 있도록 인물의 표정·동작·주변 소품이 명확함`
    : `"${subject}"와 관련된 한국의 일상 장면을 자연스럽게 담은 실사 사진. 인물과 장소, 소품이 사실적으로 배치되어 있음`;

  let out = `${template}${styleSuffix}`;
  if (out.length > 500) out = out.substring(0, 500);
  return out;
}
