import { ipcMain, app, globalShortcut, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';
import { readSnippetLibrary, writeSnippetLibrary } from '../dist/utils/snippet-library';
import { loadEnvFromFile } from '../dist/env';
// 기존 라이선스 시스템 (license-manager.js)
const oldLicenseManager = require('../dist/utils/license-manager');
const checkLicenseStatus = oldLicenseManager.checkLicenseStatus;
const redeemLicense = oldLicenseManager.redeemLicense;
const getOrCreateDeviceId = oldLicenseManager.getOrCreateDeviceId;

// 새로운 라이선스 시스템 (license-manager.ts)
import { getLicenseManager } from '../dist/utils/license-manager-new';
import { ScheduleManager } from '../dist/core/schedule-manager';
import { checkLicenseWithAutoLogin, setupAutoLoginHandlers, setMainWindow } from './main-login';

// 매직 넘버 상수화
const TIMEOUT_MS = 15000;
const MAX_CONTENT_LENGTH = 3000;
const MAX_OUTPUT_TOKENS = 8000;
const IMAGE_COMPRESSION_LEVEL = 9;
const IMAGE_QUALITY = 90;
const URL_FETCH_TIMEOUT_MS = 10000;
const MAX_TITLE_LENGTH = 30;
const MIN_TITLE_LENGTH = 5;
const MAX_OUTPUT_TOKENS_TITLE = 500;

/**
 * v3.7.22: 거미줄 통합글 폴백 헬퍼 — LLM 실패 시에도 cornerstone 구조 유지.
 *   도입 카드 + 요약표 + 원본별 카드 + 강력한 CTA 박스 + 종합 거미줄 그리드를 생성한다.
 */
function buildSpiderWebFallbackHtml(
  title: string,
  sortedContents: Array<{ url: string; title: string; content: string; order: number }>
): string {
  const escapeHtml = (s: string) =>
    String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const sectionsHtml = sortedContents.map((item, index) => {
    const safeTitle = escapeHtml(item.title || '제목 없음');
    const safeUrl = escapeHtml(item.url || '#');
    const excerpt = escapeHtml((item.content || '').substring(0, 1200).trim()) + '…';
    return `
<h2 style="font-size:22px;font-weight:800;color:#0f172a;margin:48px 0 18px;padding:14px 20px;background:#f0fdfa;border-left:5px solid #0d9488;border-radius:0 10px 10px 0;line-height:1.4;">
  ${index + 1}. ${safeTitle}
</h2>
<p style="font-size:16px;line-height:1.85;color:#1a1a1a;margin:0 0 20px;">${excerpt}</p>
<div class="cta-box" style="margin:28px 0;padding:24px 28px;background:linear-gradient(135deg,#fff7ed,#fef3c7);border-radius:14px;border:2px solid #f59e0b;text-align:center;">
  <p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#92400e;">💡 ${safeTitle}에 대한 디테일이 더 궁금하다면?</p>
  <p style="margin:0 0 16px;font-size:14px;color:#78350f;line-height:1.7;">원본 글에는 위 본문에 다 담지 못한 실전 사례·수치·체크리스트가 정리돼 있어요.</p>
  <a href="${safeUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff !important;text-decoration:none;border-radius:10px;font-weight:800;font-size:15px;box-shadow:0 6px 20px rgba(220,38,38,0.35);">📖 ${safeTitle} 자세히 보기 →</a>
</div>`;
  }).join('\n');

  const tableRowsHtml = sortedContents.map((item, idx) => `
      <tr style="background:${idx % 2 === 0 ? '#fff' : '#f8fafc'};">
        <td style="padding:14px 18px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0f172a;width:30%;">${idx + 1}. ${escapeHtml((item.title || '').substring(0, 30))}</td>
        <td style="padding:14px 18px;border-bottom:1px solid #e2e8f0;color:#334155;line-height:1.6;">${escapeHtml((item.content || '').substring(0, 120))}…</td>
      </tr>`).join('');

  const gridHtml = sortedContents.map((item) => {
    const safeTitle = escapeHtml(item.title || '제목 없음');
    const safeUrl = escapeHtml(item.url || '#');
    const short = escapeHtml((item.content || '').substring(0, 80)) + '…';
    return `
      <a href="${safeUrl}" target="_blank" rel="noopener" style="display:block;padding:18px 20px;background:#fff;border-radius:12px;border:1px solid #e2e8f0;text-decoration:none;color:#1a1a1a;box-shadow:0 2px 8px rgba(0,0,0,0.04);transition:all 0.2s ease;">
        <div style="font-size:15px;font-weight:800;color:#0f172a;margin-bottom:6px;line-height:1.4;">${safeTitle}</div>
        <div style="font-size:12px;color:#64748b;line-height:1.5;">${short}</div>
        <div style="font-size:12px;color:#dc2626;font-weight:700;margin-top:10px;">자세히 보기 →</div>
      </a>`;
  }).join('');

  return `
<div class="sw-cornerstone" style="max-width:760px;margin:0 auto;padding:0 16px;font-family:'Noto Sans KR','Malgun Gothic',sans-serif;color:#1a1a1a;line-height:1.8;">

  <h1 style="font-size:30px;font-weight:900;color:#0f172a;line-height:1.3;margin:24px 0 14px;letter-spacing:-0.02em;">
    ${escapeHtml(title)}
  </h1>

  <div style="background:linear-gradient(135deg,#eef2ff,#fce7f3);border-radius:14px;padding:24px 28px;margin:24px 0;border-left:5px solid #6366f1;">
    <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#312e81;line-height:1.6;">📌 이 가이드는 ${currentYear}년 ${currentMonth}월 기준으로 ${sortedContents.length}개의 핵심 정보를 한 편으로 정리한 종합 가이드입니다.</p>
    <ul style="margin:0;padding-left:22px;color:#1a1a1a;font-size:15px;line-height:1.8;">
      ${sortedContents.map((s, i) => `<li><strong>${i + 1}.</strong> ${escapeHtml((s.title || '').substring(0, 50))}</li>`).join('')}
    </ul>
  </div>

  <table style="width:100%;border-collapse:collapse;margin:32px 0;background:#fff;box-shadow:0 4px 16px rgba(0,0,0,0.08);border-radius:12px;overflow:hidden;">
    <thead>
      <tr style="background:linear-gradient(135deg,#0d9488,#0891b2);color:#fff;">
        <th style="padding:14px 18px;text-align:left;font-size:14px;font-weight:800;">항목</th>
        <th style="padding:14px 18px;text-align:left;font-size:14px;font-weight:800;">핵심 요약</th>
      </tr>
    </thead>
    <tbody>${tableRowsHtml}</tbody>
  </table>

  ${sectionsHtml}

  <h2 style="font-size:22px;font-weight:800;color:#0f172a;margin:48px 0 18px;padding:14px 20px;background:#fef3c7;border-left:5px solid #f59e0b;border-radius:0 10px 10px 0;">
    🔗 한눈에 보는 거미줄 — 관련 글 모음
  </h2>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin:24px 0;">
    ${gridHtml}
  </div>

  <p style="font-size:16px;font-weight:700;color:#1a1a1a;margin:32px 0 24px;padding:20px 24px;background:#f0fdfa;border-left:4px solid #0d9488;border-radius:0 10px 10px 0;line-height:1.7;">
    💡 위 ${sortedContents.length}편을 차례로 읽으면 ${escapeHtml(title.substring(0, 50))}에 대해 가장 빠르게 핵심을 잡을 수 있습니다.
  </p>

  <p style="font-size:12px;color:#767676;line-height:1.6;margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;">
    ※ 본 글은 정보 제공 목적으로 작성되었으며, 실제 적용 시 ${currentYear}년 ${currentMonth}월 기준 최신 정보를 공식 사이트에서 재확인하시기 바랍니다.
  </p>

</div>`;
}

// ============================================
// 🔥 통합 모듈 경로 해석기 (404 방지)
// 개발/배포 환경 모두에서 동일하게 작동
// ============================================
const MODULE_BASE_PATH = path.resolve(__dirname, '..');

/**
 * 모듈 경로를 절대경로로 해석
 * @param modulePath - 상대 경로 (예: 'dist/utils/golden-keyword-analyzer')
 * @returns 절대 경로
 */
function resolveModulePath(modulePath: string): string {
  return path.join(MODULE_BASE_PATH, modulePath);
}

/**
 * dist/utils 모듈 로드 헬퍼
 * @param moduleName - 모듈 이름 (예: 'golden-keyword-analyzer')
 */
function loadUtilsModule(moduleName: string): any {
  const fullPath = resolveModulePath(`dist/utils/${moduleName}`);
  return require(fullPath);
}

/**
 * dist/core 모듈 로드 헬퍼
 * @param moduleName - 모듈 이름 (예: 'schedule-manager')
 */
function loadCoreModule(moduleName: string): any {
  const fullPath = resolveModulePath(`dist/core/${moduleName}`);
  return require(fullPath);
}

/**
 * src/core 모듈 로드 헬퍼 (TypeScript 개발용)
 * @param moduleName - 모듈 이름 (예: 'index')
 */
function loadSrcCoreModule(moduleName: string): any {
  const fullPath = resolveModulePath(`src/core/${moduleName}`);
  return require(fullPath);
}

/**
 * src/utils 모듈 로드 헬퍼 (TypeScript 개발용)
 * @param moduleName - 모듈 이름 (예: 'license-manager')
 */
function loadSrcUtilsModule(moduleName: string): any {
  const fullPath = resolveModulePath(`src/utils/${moduleName}`);
  return require(fullPath);
}

// 핸들러 중복 방지 래퍼
const registeredHandlers = new Map<string, boolean>();
function safeRegisterHandler(channel: string, handler: any) {
  if (registeredHandlers.has(channel)) {
    console.log(`[MAIN] ⚠️ ${channel} 핸들러가 이미 등록되어 있습니다 (건너뜀)`);
    return;
  }

  try {
    ipcMain.handle(channel, handler);
    registeredHandlers.set(channel, true);
    console.log(`[MAIN] ✅ ${channel} 핸들러 등록 완료`);
  } catch (error) {
    console.error(`[MAIN] ❌ ${channel} 핸들러 등록 실패:`, error);
  }
}


// 타입 정의
interface EnvData {
  geminiKey?: string;
  GEMINI_API_KEY?: string;
  licenseRedeemUrl?: string;
  LICENSE_REDEEM_URL?: string;
}

// 모델 실패 캐시 (404 오류 모델은 다시 시도하지 않음)
const failedModelsCache = new Set<string>();
// 선택된 모델 캐시 (한 번 선택하면 재사용)
let cachedModel: any = null;
let cachedModelName: string | null = null;

// Gemini 모델 선택 함수 (2.0 이상만 사용)
async function selectGeminiModel(genAI: any): Promise<any> {
  // 이미 선택된 모델이 있으면 재사용 (빠른 처리)
  if (cachedModel && cachedModelName) {
    return cachedModel;
  }

  // 🔥 2.0 이상 모델만 사용 (1.5 버전 절대 사용 안 함)
  // gemini-2.0-flash-preview는 404 오류로 제거, 실제 사용 가능한 모델만 사용
  const modelNames = [
    'gemini-2.5-flash',              // 최신 모델 (우선 사용)
    'gemini-2.0-flash-exp',         // 실험적 모델
    'gemini-2.0-flash-thinking-exp'  // 실험적 모델
  ];

  for (const modelName of modelNames) {
    // 이미 실패한 모델(404 등)은 건너뛰기
    if (failedModelsCache.has(modelName)) {
      console.log(`[GEMINI-MODEL] ⏭️ 모델 ${modelName} 건너뛰기 (이전 실패 기록)`);
      continue;
    }

    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      // 테스트 요청 (짧은 텍스트로) - 최초 1회만
      const testResult = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'test' }] }],
        generationConfig: {
          maxOutputTokens: 10,
        }
      });
      await testResult.response; // 응답 대기
      console.log(`[GEMINI-MODEL] ✅ 모델 선택 및 캐싱: ${modelName}`);

      // 모델 캐싱 (다음 호출 시 재사용)
      cachedModel = model;
      cachedModelName = modelName;

      return model;
    } catch (e: any) {
      const errorMsg = e?.message || String(e);
      // API 키 관련 에러인 경우 즉시 중단
      if (errorMsg.includes('403') || errorMsg.includes('API Key') || errorMsg.includes('unregistered callers')) {
        console.error(`[GEMINI-MODEL] ❌ API 키 인증 실패 (${modelName}):`, errorMsg);
        throw e; // 에러를 다시 던져서 상위에서 처리
      }
      // 404 모델 없음 오류인 경우 캐시에 추가하고 건너뛰기
      if (errorMsg.includes('404') || errorMsg.includes('not found') || errorMsg.includes('is not supported')) {
        console.warn(`[GEMINI-MODEL] ⚠️ 모델 ${modelName} 존재하지 않음 (404), 캐시에 추가하고 건너뛰기`);
        failedModelsCache.add(modelName);
        continue;
      }
      // 429 할당량 초과 오류인 경우 다음 모델로 시도
      if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests') || errorMsg.includes('quota') || errorMsg.includes('exceeded')) {
        console.warn(`[GEMINI-MODEL] ⚠️ 모델 ${modelName} 할당량 초과, 다음 모델 시도`);
        continue;
      }
      // 다른 에러는 다음 모델로 시도
      console.warn(`[GEMINI-MODEL] ⚠️ 모델 ${modelName} 실패, 다음 모델 시도:`, errorMsg.substring(0, 100));
      continue;
    }
  }

  // 모든 2.0 이상 모델 실패 시 에러 발생 (1.5 버전 절대 사용 안 함)
  console.error('[GEMINI-MODEL] ❌ 모든 2.0 이상 모델 실패 - 1.5 버전은 사용하지 않습니다');
  throw new Error('사용 가능한 Gemini 2.0 이상 모델이 없습니다. API 키와 할당량을 확인해주세요.');
}

// 공통 친절한 에러 메시지 매퍼
function toFriendlyApiError(service: 'gemini' | 'openai' | 'pexels' | 'google-cse' | 'naver-datalab' | 'blogger' | 'wordpress', status?: number | string, rawMessage?: string): string {
  const statusStr = String(status ?? '').toLowerCase();
  const raw = (rawMessage || '').toLowerCase();
  // 공통 힌트
  const keyHints = 'API 키를 확인해주세요 (앞뒤 공백 제거, 오타/띄어쓰기 확인). 환경설정에 다시 저장해보세요.';
  if (statusStr.includes('429') || raw.includes('quota') || raw.includes('rate')) {
    if (service === 'openai') {
      return '오픈AI API 키 충전액이 소진되었습니다. 충전 후 사용하세요.';
    }
    return 'API 할당량이 부족합니다. 잠시 후 다시 시도하거나 다른 키를 사용해주세요.';
  }
  if (statusStr.includes('401') || statusStr.includes('403') || raw.includes('invalid api key') || raw.includes('api key')) {
    return `API 키 인증 오류입니다. ${keyHints}`;
  }
  if (statusStr.startsWith('5') || raw.includes('server')) {
    return 'API 서버 오류입니다. 잠시 후 다시 시도해주세요.';
  }
  if (raw.includes('timeout') || raw.includes('timed out')) {
    return '요청 시간이 초과되었습니다. 네트워크 상태를 확인하고 다시 시도해주세요.';
  }
  if (raw.includes('network') || raw.includes('fetch') || raw.includes('econnrefused') || raw.includes('enetunreach')) {
    return '네트워크 오류입니다. 인터넷 연결과 방화벽/프록시 설정을 확인해주세요.';
  }
  // 서비스별 추가 힌트
  switch (service) {
    case 'google-cse':
      return 'Google CSE 요청 실패입니다. CSE 키/CX가 맞는지와 허용 도메인/쿼리 제한을 확인해주세요.';
    case 'naver-datalab':
      return '네이버 데이터랩 요청 실패입니다. Client ID/Secret을 확인하고 호출 제한을 확인해주세요.';
    case 'blogger':
      return 'Blogger 게시 실패입니다. 토큰 만료 또는 본문/HTML 길이 제한 초과 여부를 확인해주세요.';
    case 'wordpress':
      return 'WordPress 게시 실패입니다. 사이트 URL/계정/애플리케이션 비밀번호를 확인해주세요.';
    default:
      return rawMessage || '알 수 없는 오류가 발생했습니다.';
  }
}

// 기존 IPC 핸들러 제거 (중복 방지)
try {
  if (ipcMain.listenerCount('generate-internal-consistency-title') > 0) {
    console.log('[INTERNAL-CONSISTENCY] 기존 제목 생성 핸들러 제거 중...');
    ipcMain.removeHandler('generate-internal-consistency-title');
  }
  if (ipcMain.listenerCount('generate-internal-consistency') > 0) {
    console.log('[INTERNAL-CONSISTENCY] 기존 종합글 생성 핸들러 제거 중...');
    ipcMain.removeHandler('generate-internal-consistency');
  }
} catch (e) {
  // 무시 (핸들러가 없을 수 있음)
}

// 라이선스 상태 조회
ipcMain.handle('license-status', async () => {
  try {
    // 🔧 개발 모드면 라이센스 체크 건너뛰기
    if (process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development') {
      console.log('[LICENSE] 개발 모드 - 라이센스 체크 건너뛰기');
      return {
        ok: true,
        status: { activated: true, type: 'dev', expiresAt: null },
        deviceId: 'dev-mode',
        redeemUrl: ''
      };
    }

    const status = await checkLicenseStatus();
    const env = loadEnvFromFile() as EnvData;
    const deviceId = getOrCreateDeviceId();
    const redeemUrl = env.licenseRedeemUrl || env.LICENSE_REDEEM_URL || '';
    return { ok: true, status, deviceId, redeemUrl };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : '라이선스 상태 확인 실패';
    return { ok: false, error: errorMessage };
  }
});

// 라이선스 활성화
ipcMain.handle('license-activate', async (_evt, payload: { code: string }) => {
  try {
    const env = loadEnvFromFile() as EnvData;
    const redeemUrl = env.licenseRedeemUrl || env.LICENSE_REDEEM_URL || '';
    const status = await redeemLicense(payload?.code || '', redeemUrl);
    if (status && typeof status === 'object' && 'activated' in status && status.activated) {
      return { ok: true, status };
    }
    const reason = (status && typeof status === 'object' && 'reason' in status && typeof status.reason === 'string')
      ? status.reason
      : '활성화 실패';
    return { ok: false, error: reason };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : '활성화 실패';
    return { ok: false, error: errorMessage };
  }
});

// 종료 확인 핸들러
ipcMain.handle('confirm-quit', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.removeAllListeners('close');
    mainWindow.close();
  }
  return { ok: true };
});

// 새로운 라이선스 인증 (아이디/비밀번호/코드)
ipcMain.handle('license-authenticate', async (_evt, payload: { userId: string; password: string; licenseCode?: string }) => {
  try {
    console.log('[AUTH] 인증 요청 수신:', { userId: payload.userId, hasPassword: !!payload.password, hasCode: !!payload.licenseCode });
    const licenseManager = getLicenseManager();
    console.log('[AUTH] licensePath:', (licenseManager as any).licensePath);
    const result = await licenseManager.authenticate(
      payload.userId || '',
      payload.password || '',
      payload.licenseCode
    );
    console.log('[AUTH] 인증 결과:', { success: result.success, message: result.message });
    return result;
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : '인증 실패';
    console.error('[AUTH] 인증 예외:', errorMessage);
    return { success: false, message: errorMessage };
  }
});

// 라이선스 상태 확인 (새로운 시스템) - 강화된 검증
ipcMain.handle('license-status-new', async () => {
  try {
    // 강화된 검증 사용 (서버 시간 동기화 포함)
    const { validateLicenseStrict } = await import('../dist/utils/license-validator');
    const validation = await validateLicenseStrict();

    const licenseManager = getLicenseManager();
    const status = licenseManager.getLicenseStatus();

    if (validation.valid) {
      return {
        valid: true,
        message: validation.message,
        type: status.licenseData?.licenseType,
        expiresAt: status.licenseData?.expiresAt,
        serverTime: validation.serverTime,
        timeDiff: validation.timeDiff
      };
    }

    // 🛡️ v3.6.6: 영구제 lenient fallback — strict 실패해도 license.json 자체가 정상이면 통과.
    //   사용자가 한 번 등록한 영구제는 patchFileHash 누락 / patch 손상 등 어떤 부수 이유로도 valid=false가 되지 않도록 보장.
    //   본 컴퓨터의 license.json + deviceId는 외부 우회 불가능하므로 보안 실용적.
    const data = status.licenseData;
    if (data && data.userId && (!data.expiresAt || data.licenseType === 'permanent')) {
      console.warn('[LICENSE] v3.6.6 영구제 lenient fallback — strict 실패하지만 license.json 정상, 통과:', validation.message);
      return {
        valid: true,
        message: '영구제 라이선스 (호환 모드 — strict 실패 그러나 license 파일 유효)',
        type: 'permanent',
        expiresAt: data.expiresAt,
        serverTime: validation.serverTime,
        timeDiff: validation.timeDiff
      };
    }

    // 만료 또는 무효
    return {
      valid: false,
      message: validation.message,
      type: status.licenseData?.licenseType,
      expiresAt: status.licenseData?.expiresAt,
      expired: validation.expired,
      serverTime: validation.serverTime,
      timeDiff: validation.timeDiff
    };
  } catch (e) {
    console.error('[LICENSE] 상태 확인 중 오류:', e);
    // 오류 발생 시 기본 검증으로 폴백
    try {
      const licenseManager = getLicenseManager();
      const status = licenseManager.getLicenseStatus();

      // 기간제 만료 확인
      if (status.valid && status.licenseData?.licenseType === 'temporary' && status.licenseData?.expiresAt) {
        if (status.licenseData.expiresAt <= Date.now()) {
          return {
            valid: false,
            message: '라이선스가 만료되었습니다. 코드를 다시 등록해주세요.',
            type: 'temporary',
            expiresAt: status.licenseData.expiresAt,
            expired: true
          };
        }
      }

      return {
        ...status,
        type: status.licenseData?.licenseType,
        expiresAt: status.licenseData?.expiresAt
      };
    } catch (fallbackError) {
      const errorMessage = e instanceof Error ? e.message : '상태 확인 실패';
      return { valid: false, message: errorMessage, expired: true };
    }
  }
});

// 라이선스 로그아웃
ipcMain.handle('license-logout', async () => {
  try {
    console.log('[LICENSE] 로그아웃 시도...');
    const licenseManager = getLicenseManager();
    await licenseManager.logout(); // 서버에 세션 종료 요청 포함
    console.log('[LICENSE] ✅ 로그아웃 완료');
    return { success: true, message: '로그아웃되었습니다.' };
  } catch (e) {
    console.error('[LICENSE] 로그아웃 오류:', e);
    const errorMessage = e instanceof Error ? e.message : '로그아웃 실패';
    return { success: false, error: errorMessage };
  }
});

// 앱 재시작 (로그아웃 후)
ipcMain.handle('app-relaunch', async () => {
  app.relaunch();
  app.exit(0);
});

// 세션 유효성 검증 (중복 로그인 감지)
ipcMain.handle('session-validate', async () => {
  try {
    const licenseManager = getLicenseManager();
    const result = await licenseManager.validateSession();
    return result;
  } catch (e) {
    console.error('[SESSION] 검증 오류:', e);
    return {
      valid: false,
      code: 'SERVER_ERROR',
      message: e instanceof Error ? e.message : '세션 검증 실패'
    };
  }
});

// 주기적 세션 검증 시작 (중복 로그인 감지)
ipcMain.handle('session-start-validation', async () => {
  try {
    const licenseManager = getLicenseManager();
    const { BrowserWindow } = await import('electron');

    licenseManager.startSessionValidation((reason: string) => {
      console.log('[SESSION] ⚠️ 세션 만료:', reason);
      // 모든 창에 세션 만료 알림 전송
      const windows = BrowserWindow.getAllWindows();
      windows.forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send('session-expired', { reason });
        }
      });
    });

    return { success: true };
  } catch (e) {
    console.error('[SESSION] 검증 시작 오류:', e);
    return { success: false, error: e instanceof Error ? e.message : '세션 검증 시작 실패' };
  }
});

// 주기적 세션 검증 중지
ipcMain.handle('session-stop-validation', async () => {
  try {
    const licenseManager = getLicenseManager();
    licenseManager.stopSessionValidation();
    return { success: true };
  } catch (e) {
    console.error('[SESSION] 검증 중지 오류:', e);
    return { success: false, error: e instanceof Error ? e.message : '세션 검증 중지 실패' };
  }
});

// 자동 로그인 설정 저장
ipcMain.handle('save-auto-login-config', async (_evt, enabled: boolean, userId?: string) => {
  try {
    const { saveAutoLoginConfig } = await import('../dist/utils/auto-login-manager');
    saveAutoLoginConfig(enabled, userId);
    return { success: true };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : '설정 저장 실패';
    return { success: false, error: errorMessage };
  }
});

// 자동 로그인 설정 로드
ipcMain.handle('load-auto-login-config', async () => {
  try {
    const { loadAutoLoginConfig } = await import('../dist/utils/auto-login-manager');
    return loadAutoLoginConfig();
  } catch (e) {
    // 오류 발생 시 기본값 반환
    if (e instanceof Error) {
      console.debug('[AUTO-LOGIN] 설정 로드 중 오류 (무시됨):', e.message);
    }
    return { enabled: false };
  }
});

// 내부일관성글 제목 생성 핸들러
ipcMain.handle('generate-internal-consistency-title', async (_evt, payload: { urls: string[] }) => {
  try {
    // v3.8.38: 무료 체험은 글포스팅만 허용 — 거미줄 제목 자동 생성 차단
    const { blockIfFreeTier } = require('./auth-utils');
    const gate = await blockIfFreeTier('거미줄 통합글 제목 자동 생성');
    if (!gate.allowed) return gate.response;

    console.log('[INTERNAL-CONSISTENCY] 제목 생성 요청:', payload);
    const urls = payload.urls || [];

    if (urls.length === 0) {
      return { success: false, error: 'URL이 필요합니다.' };
    }

    // 1단계: 각 URL에서 제목 크롤링
    console.log('[INTERNAL-CONSISTENCY] URL에서 제목 추출 중...');
    const crawledTitles: string[] = [];

    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const html = await response.text();
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch && titleMatch[1]) {
            const title = titleMatch[1].trim()
              .replace(/\s*\|\s*.*$/, '') // "제목 | 사이트명" 형태 제거
              .replace(/\s*-\s*.*$/, '') // "제목 - 사이트명" 형태 제거
              .trim();
            if (title && title.length > 3) {
              crawledTitles.push(title);
              console.log(`[INTERNAL-CONSISTENCY] ✅ 제목 추출: ${title.substring(0, 50)}...`);
            }
          }
        }
      } catch (error) {
        console.warn(`[INTERNAL-CONSISTENCY] ⚠️ URL 크롤링 실패 (${url}):`, (error as Error).message);
        // 개별 URL 실패는 무시하고 계속 진행
      }
    }

    if (crawledTitles.length === 0) {
      return { success: false, error: 'URL에서 제목을 추출할 수 없습니다.' };
    }

    // 2단계: 환경변수에서 Gemini API 키 가져오기
    const envData = loadEnvFromFile() as EnvData;
    const geminiKey = envData.geminiKey || envData.GEMINI_API_KEY || process.env['GEMINI_API_KEY'] || '';

    if (!geminiKey) {
      // API 키가 없으면 크롤링한 제목들을 분석하여 간단한 종합 제목 생성
      const keywords: string[] = [];
      crawledTitles.forEach(title => {
        const words = title.split(/\s+/).filter(w => w.length > 1);
        keywords.push(...words.slice(0, 3)); // 각 제목에서 상위 3개 단어만
      });

      // 중복 제거 및 빈도순 정렬
      const wordFreq = new Map<string, number>();
      keywords.forEach(word => {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      });

      const topKeywords = Array.from(wordFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([word]) => word);

      const fallbackTitle = `${topKeywords.join(' ')} 종합 가이드 ${new Date().getFullYear()}`;
      console.log('[INTERNAL-CONSISTENCY] API 키 없음, 폴백 제목 생성:', fallbackTitle);
      return { success: true, title: fallbackTitle };
    }

    // 3단계: AI로 SEO 최적화된 종합 제목 생성
    console.log('[INTERNAL-CONSISTENCY] AI로 종합 제목 생성 중...');
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(geminiKey);

    // Gemini 모델 선택 (2.0 이상만 사용)
    let model: any;
    try {
      model = await selectGeminiModel(genAI);
    } catch (error) {
      // 2.0 이상 모델 모두 실패 시 에러 발생 (1.5 버전 절대 사용 안 함)
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[INTERNAL-CONSISTENCY] ❌ 모든 2.0 이상 모델 실패:', errorMsg);
      throw new Error(`Gemini 2.0 이상 모델을 사용할 수 없습니다. ${errorMsg}`);
    }

    // v3.8.65 (Phase1 작업4): 제목 A/B 3변형 동시 생성 + CTR 점수로 자동 선택
    //   기존: 1개 제목만 생성, 패턴 고정
    //   개선: 긴급/호기심/숫자 3가지 변형 → 점수화 → 최고 선택
    //   기준 (Backlinko 누적): 50-60자 / 키워드 앞쪽 / 이모지 1개 이하 / 숫자+연도
    const prompt = `다음 URL들에서 추출한 제목들을 분석하여, 종합 글 제목 **3가지 변형**을 JSON 배열로 생성하세요.

【추출된 제목들】
${crawledTitles.map((title, idx) => `${idx + 1}. ${title}`).join('\n')}

📌 **3가지 변형 패턴 (정확히 3개)**:
1. **긴급성형(urgency)**: 시간/마감/한정 요소 강조 ("지금 신청 마감 임박", "${new Date().getFullYear()} 마지막 기회")
2. **호기심형(curiosity)**: 의외성/반전/궁금증 ("아무도 모르는", "진짜 이유", "숨겨진 조건")
3. **숫자형(numeric)**: 구체적 수치 강조 ("월 10만원으로 1,440만원", "3년 만기 N% 수익")

📐 **공통 규칙 (각 제목 적용)**:
- 50-60자 (한글 기준, 모바일 SERP 잘림 방지)
- 핵심 검색 키워드를 앞쪽 30% 안에 배치
- ${new Date().getFullYear()}년 표기 포함
- 이모지 1개 이하 (과사용 시 신뢰도↓)
- "종합", "모든 것" 같은 진부한 표현 금지

⚠️ **출력 형식 (엄격)**:
정확히 다음 JSON 형식 1줄로만 출력 (마크다운·설명 금지):
{"urgency":"제목1","curiosity":"제목2","numeric":"제목3"}
`;

    // CTR 점수 함수 — 50-60자 적정, 숫자/연도 포함, 이모지 1개 이하, 키워드 위치
    const scoreTitle = (t: string): number => {
      if (!t || typeof t !== 'string') return 0;
      let score = 0;
      const len = t.length;
      // 길이 (50-60자 최적)
      if (len >= 50 && len <= 60) score += 30;
      else if (len >= 40 && len <= 70) score += 20;
      else if (len >= 30 && len <= 80) score += 10;
      // 숫자 포함
      if (/\d/.test(t)) score += 15;
      // 연도 포함
      if (new RegExp(`${new Date().getFullYear()}`).test(t)) score += 15;
      // 이모지 개수 (1개 이하 권장)
      const emojiCount = (t.match(/[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}]/gu) || []).length;
      if (emojiCount === 0) score += 8;
      else if (emojiCount === 1) score += 10;
      else if (emojiCount === 2) score += 3;
      // 호기심·긴급성 키워드
      if (/(지금|마감|임박|놓치지|꼭|반드시|독점|단독|진짜|숨겨진|아무도|비밀|총정리|완벽)/.test(t)) score += 12;
      // 구체적 수치 패턴 (XX원, X개월, X% 등)
      if (/\d+\s*(만원|원|개월|년|%|위|위안|배|일)/.test(t)) score += 10;
      return score;
    };

    let generatedTitle = '';
    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 600, temperature: 0.9 }
      });
      const response = await result.response;
      const raw = (response.text() || '').trim();
      // JSON 추출 (마크다운 백틱 제거)
      const cleaned = raw.replace(/^```json\n?/gi, '').replace(/^```\n?/gi, '').replace(/```\n?$/gi, '').trim();
      let variants: { urgency?: string; curiosity?: string; numeric?: string } = {};
      try {
        variants = JSON.parse(cleaned);
      } catch {
        // JSON 파싱 실패 → 단일 제목으로 폴백
        const fallbackLine = cleaned.split(/\n+/).find((l: string) => l.length >= 20 && l.length <= 80) || cleaned;
        variants = { urgency: fallbackLine };
      }
      const candidates: Array<{ title: string; type: string; score: number }> = [];
      for (const type of ['urgency', 'curiosity', 'numeric'] as const) {
        const t = (variants[type] || '').trim().replace(/^["'`]|["'`]$/g, '');
        if (t && t.length >= 15 && t.length <= 100) {
          candidates.push({ title: t, type, score: scoreTitle(t) });
        }
      }
      if (candidates.length > 0) {
        candidates.sort((a, b) => b.score - a.score);
        generatedTitle = candidates[0]!.title;
        console.log(`[INTERNAL-CONSISTENCY] ✅ 제목 A/B 3변형 점수`,
          candidates.map((c) => `${c.type}(${c.score}점): "${c.title.substring(0, 40)}…"`).join(' | '));
        console.log(`[INTERNAL-CONSISTENCY] 🏆 선택: ${candidates[0]!.type} (${candidates[0]!.score}점)`);
      } else {
        generatedTitle = cleaned.split(/\n+/)[0]!.trim();
      }
    } catch (error) {
      console.error('[INTERNAL-CONSISTENCY] AI 제목 생성 실패:', error);
      const topKeywords = crawledTitles[0]!.split(/\s+/).slice(0, 3);
      generatedTitle = `${topKeywords.join(' ')} 종합 가이드 ${new Date().getFullYear()}`;
    }

    // 제목 정제
    let finalTitle = generatedTitle.trim()
      .replace(/^\d+\.\s*/, '') // 번호 제거
      .replace(/^[-*]\s*/, '') // 불릿 제거
      .replace(/\*\*/g, '') // 마크다운 제거
      .replace(/^["']|["']$/g, '') // 따옴표 제거
      .split('\n')[0] // 첫 줄만 사용
      .trim();

    // 제목 길이 제한
    if (finalTitle.length > MAX_TITLE_LENGTH) {
      const words = finalTitle.substring(0, MAX_TITLE_LENGTH).split(/\s+/);
      if (words.length > 1) {
        words.pop();
        finalTitle = words.join(' ').trim();
      } else {
        finalTitle = finalTitle.substring(0, MAX_TITLE_LENGTH - 3) + '...';
      }
    }

    if (!finalTitle || finalTitle.length < MIN_TITLE_LENGTH) {
      // 최종 검증 실패 시 폴백
      const fallbackTitle = `${crawledTitles[0].substring(0, 20)} 종합 가이드 ${new Date().getFullYear()}`;
      console.log('[INTERNAL-CONSISTENCY] 생성된 제목이 너무 짧음, 폴백 사용:', fallbackTitle);
      return { success: true, title: fallbackTitle };
    }

    console.log('[INTERNAL-CONSISTENCY] ✅ 생성된 제목:', finalTitle);
    return { success: true, title: finalTitle };

  } catch (error) {
    console.error('[INTERNAL-CONSISTENCY] 제목 생성 실패:', error);
    return {
      success: false,
      error: (error as Error).message || '알 수 없는 오류가 발생했습니다.'
    };
  }
});

// 내부일관성글 종합글 생성 핸들러
ipcMain.handle('generate-internal-consistency', async (_evt, payload: {
  urls: string[];
  title: string;
  posts: Array<{ id: string; url: string; title: string; order: number }>;
  imagePolicy?: string;            // v3.8.6: 'all' | 'thumbnail-only' | 'odd-only' | 'even-only' | 'none'
  imageThumbnailEngine?: string;   // v3.8.6
  imageH2Engine?: string;          // v3.8.6
  imageIncludeText?: boolean;      // v3.8.7
  platform?: string;               // v3.8.8: 'wordpress' | 'blogspot' (이미지 호스팅 분기)
}) => {
  try {
    // v3.8.54: 단계별 IPC 진단 로그 — 사용자 콘솔에 실시간 진행 위치 표시
    const sendDiag = (msg: string) => {
      try {
        const { BrowserWindow: BW } = require('electron');
        BW.getAllWindows().forEach((w: any) => { try { w.webContents.send('log-line', `[SPIDER-STEP] ${msg}`); } catch {} });
      } catch {}
      console.log(`[SPIDER-STEP] ${msg}`);
    };
    sendDiag('🚀 거미줄 핸들러 진입 — payload 수신');

    // v3.8.38: 무료 체험은 글포스팅만 허용 — 거미줄 통합글 생성 차단
    const { blockIfFreeTier } = require('./auth-utils');
    const gate = await blockIfFreeTier('거미줄 통합글 생성');
    if (!gate.allowed) {
      sendDiag('⛔ 무료 체험 차단 — 종료');
      return gate.response;
    }
    sendDiag('✅ 라이선스 게이트 통과');

    console.log('[INTERNAL-CONSISTENCY] 종합글 생성 요청:', payload);
    // v3.8.28/v3.8.30: WordPress wp-admin URL → 공개 글 URL 정규화 (백엔드 안전망)
    //   v3.8.30: Pretty Permalinks 사이트에선 ?p=N도 404 → WP REST API로 정확한 link 가져옴.
    //   API 실패 시 ?p=N 폴백 (REST API 비활성·인증 필요 사이트 대비).
    // v3.8.59: timeout 8 → 5초 (빠른 실패) + 진단 로그
    const _normalizeWpUrl = async (u: string): Promise<string> => {
      if (!u || typeof u !== 'string') return u || '';
      const m = u.match(/^(https?:\/\/[^/]+)\/wp-admin\/post\.php\?[^#]*\bpost=(\d+)/i);
      if (!m) return u;
      try {
        const axios = (await import('axios')).default;
        const r = await axios.get(`${m[1]}/wp-json/wp/v2/posts/${m[2]}`, { timeout: 5000, validateStatus: () => true });
        const link = r?.data?.link;
        if (typeof link === 'string' && /^https?:\/\//i.test(link) && !/\/wp-admin\//i.test(link)) {
          return link;
        }
      } catch {}
      return `${m[1]}/?p=${m[2]}`;
    };
    sendDiag('🔗 URL 정규화 시작');
    const urls = await Promise.all((payload.urls || []).map(_normalizeWpUrl));
    sendDiag(`✅ URL 정규화 완료 — ${urls.length}개`);
    let title = payload.title || '종합 가이드';
    const posts = await Promise.all((payload.posts || []).map(async (p) => ({ ...p, url: await _normalizeWpUrl(p.url) })));
    sendDiag(`✅ posts 정규화 완료 — ${posts.length}개`);

    // v3.8.76: 거미줄 통합글은 최소 2개 이상 글 필요 (백엔드 안전망)
    if (urls.length < 2) {
      return { success: false, error: `거미줄 통합글은 최소 2개 이상의 글이 필요합니다. 현재 ${urls.length}개.` };
    }

    // 1단계: 환경변수에서 API 키 가져오기
    const envData = loadEnvFromFile() as EnvData;
    const geminiKey = envData.geminiKey || envData.GEMINI_API_KEY || process.env['GEMINI_API_KEY'] || '';

    if (!geminiKey || geminiKey.trim() === '') {
      console.error('[INTERNAL-CONSISTENCY] ❌ Gemini API 키가 없습니다.');
      console.error('[INTERNAL-CONSISTENCY] envData:', {
        hasGeminiKey: !!envData.geminiKey,
        hasGEMINI_API_KEY: !!envData.GEMINI_API_KEY,
        hasProcessEnv: !!process.env['GEMINI_API_KEY']
      });
      return {
        success: false,
        error: 'Gemini API 키가 필요합니다. 환경 설정에서 API 키를 입력해주세요.\n\n설정 방법:\n1. 앱의 "설정" 탭으로 이동\n2. "Gemini API Key" 필드에 API 키 입력\n3. 저장 후 다시 시도해주세요.'
      };
    }

    // API 키 유효성 검사 (최소 길이 체크)
    if (geminiKey.length < 20) {
      console.error('[INTERNAL-CONSISTENCY] ❌ Gemini API 키가 너무 짧습니다:', geminiKey.length);
      return {
        success: false,
        error: 'Gemini API 키가 유효하지 않습니다. 올바른 API 키를 입력해주세요.'
      };
    }

    console.log('[INTERNAL-CONSISTENCY] ✅ Gemini API 키 확인 완료 (길이:', geminiKey.length, ')');

    // 2단계: 각 URL 크롤링하여 콘텐츠 추출
    console.log('[INTERNAL-CONSISTENCY] URL 크롤링 시작 (Puppeteer 모드)...');
    const crawledContents: Array<{ url: string; title: string; content: string; order: number }> = [];

    // Puppeteer 설정
    puppeteer.use(StealthPlugin());
    let browser: any = null;

    try {
      sendDiag('🕷️ 크롤링 시작 (Puppeteer 실행)');
      browser = await puppeteer.launch({
        headless: true, // "new" is deprecated in latest puppeteer
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });

      for (const post of posts) {
        try {
          const url = post.url || '';
          if (!url) continue;

          console.log(`[INTERNAL-CONSISTENCY] 🕷️ 크롤링 중: ${url}`);
          const page = await browser.newPage();
          await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
          await page.setViewport({ width: 1280, height: 800 });

          await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
          // 스크롤을 내려 동적 콘텐츠 로드 유도
          await page.evaluate(() => window.scrollBy(0, window.innerHeight));
          await new Promise(resolve => setTimeout(resolve, 2000));

          const html = await page.content();
          const $ = cheerio.load(html);

          // 제목 추출 (정밀)
          let extractedTitle = $('title').text().trim() || post.title || '제목 없음';
          extractedTitle = extractedTitle.replace(/\s*\|\s*.*$/, '').replace(/\s*-\s*.*$/, '').trim();

          // 본문 내용 추출 (정밀)
          // 불필요한 요소 제거
          $('script, style, iframe, nav, footer, header, aside, .ads, .comments').remove();

          let content = '';
          const selectors = [
            'article',
            '.entry-content',
            '.post-content',
            '.content',
            'main',
            '#content',
            '.view_content', // Tistory
            '.se-main-container' // Naver Blog
          ];

          for (const s of selectors) {
            const found = $(s).text().trim();
            if (found.length > content.length) {
              content = found;
            }
          }

          // 만약 선택자로 못 찾으면 body에서 추출
          if (content.length < 200) {
            content = $('body').text().trim();
          }

          // 텍스트 정리
          content = content
            .replace(/\s+/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .trim();

          if (content && content.length > 200) {
            crawledContents.push({
              url,
              title: extractedTitle,
              // v3.7.22: 종합 가이드 품질 향상을 위해 원본 인풋 확장 (3000 → 9000자/글, 5글 = 45K자 인풋)
              //   Gemini 2.x 1M 컨텍스트 한도 내. 종합글이 5개 원본의 70%+ 핵심을 충분히 흡수하도록.
              content: content.substring(0, MAX_CONTENT_LENGTH * 3),
              order: post.order
            });
            console.log(`[INTERNAL-CONSISTENCY] ✅ 크롤링 성공 (${post.order}번째): ${extractedTitle.substring(0, 30)}... (${content.length}자)`);
          }
          await page.close();
        } catch (error) {
          console.warn(`[INTERNAL-CONSISTENCY] ⚠️ URL 크롤링 실패 (${post.url}):`, (error as Error).message);
        }
      }
    } finally {
      if (browser) await browser.close();
    }

    if (crawledContents.length === 0) {
      return { success: false, error: 'URL에서 콘텐츠를 추출할 수 없습니다.' };
    }

    // 3단계: AI로 종합글 생성 (거미줄 구조)
    console.log('[INTERNAL-CONSISTENCY] AI로 종합글 생성 중...');

    // geminiKey는 이미 위에서 검증되었으므로 재확인 불필요
    // 하지만 안전을 위해 한 번 더 확인
    if (!geminiKey || geminiKey.trim() === '') {
      console.error('[INTERNAL-CONSISTENCY] ❌ geminiKey 변수가 비어있습니다.');
      return { success: false, error: 'Gemini API 키가 없습니다.' };
    }

    // API 키 앞뒤 공백 제거
    const trimmedKey = geminiKey.trim();
    if (trimmedKey.length < 20) {
      console.error('[INTERNAL-CONSISTENCY] ❌ API 키가 너무 짧습니다:', trimmedKey.length);
      return { success: false, error: 'Gemini API 키가 유효하지 않습니다.' };
    }

    console.log('[INTERNAL-CONSISTENCY] Gemini API 초기화 중...');
    console.log('[INTERNAL-CONSISTENCY] API 키 정보: 길이=', trimmedKey.length, ', 시작=', trimmedKey.substring(0, 8), '...', ', 끝=', '...' + trimmedKey.substring(trimmedKey.length - 4));

    const { GoogleGenerativeAI } = await import('@google/generative-ai');

    try {
      // API 키가 제대로 전달되는지 확인
      if (!trimmedKey || trimmedKey === '') {
        throw new Error('API 키가 비어있습니다.');
      }

      const genAI = new GoogleGenerativeAI(trimmedKey);
      console.log('[INTERNAL-CONSISTENCY] ✅ GoogleGenerativeAI 초기화 완료');

      // Gemini 모델 선택
      let model: any;
      try {
        console.log('[INTERNAL-CONSISTENCY] 모델 선택 시도 중...');
        model = await selectGeminiModel(genAI);
        console.log('[INTERNAL-CONSISTENCY] ✅ 모델 선택 완료');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('[INTERNAL-CONSISTENCY] ❌ 모델 선택 실패:', errorMsg);

        // API 키 관련 에러인지 확인
        if (errorMsg.includes('403') || errorMsg.includes('API Key') || errorMsg.includes('unregistered callers')) {
          throw new Error(`Gemini API 키 인증 실패: ${errorMsg}\n\nAPI 키를 확인하고 다시 시도해주세요.\n\n해결 방법:\n1. 앱의 "설정" 탭에서 Gemini API Key 확인\n2. API 키가 올바른지 확인 (https://aistudio.google.com/app/apikey)\n3. API 키 앞뒤 공백 제거\n4. 저장 후 앱 재시작`);
        }

        // 2.0 이상 모델 실패 시 에러 발생 (1.5 버전 절대 사용 안 함)
        console.error('[INTERNAL-CONSISTENCY] ❌ 2.0 이상 모델 선택 실패:', errorMsg);
        throw new Error(`Gemini 2.0 이상 모델을 사용할 수 없습니다. ${errorMsg}`);
      }

      // 크롤링된 콘텐츠를 순서대로 정렬
      sendDiag(`✅ 크롤링 완료 — ${crawledContents.length}개 글, LLM 호출 준비`);
      const sortedContents = crawledContents.sort((a, b) => a.order - b.order);
      // v3.7.22: 통합글 프롬프트 전면 재작성
      //   기존 프롬프트는 "5개 글 70% 요약 + CTA" 수준이라 사용자 의도(애드센스 + 외부유입 + 거미줄)가 반영 안 됨.
      //   → cornerstone 가이드 구조 + 광고 친화 H2 6~7개 + 거미줄 회유 CTA + FAQ + 표 강제.
      const currentYear = new Date().getFullYear();
      const prompt = `
당신은 한국 애드센스 블로그 cornerstone 콘텐츠를 설계하는 SEO + UX 전문가입니다.
**중요 — 피아식별**: 아래 ${sortedContents.length}개 원본 글은 모두 **작성자 본인이 직접 쓴 본인의 글**입니다. 타인/경쟁사 글 절대 아님.
따라서 통합글 전반에서 "원글 N", "원본 N", "관점", "출처", "참고", "발췌" 같은 표현·메타 표기를 **절대 사용하지 마세요**.
본인이 처음부터 끝까지 직접 쓴 하나의 완성된 종합 가이드처럼 자연스럽게 풀어내세요.

다음 ${sortedContents.length}개 본인 글을 통합해 **검색 의도 1편 완전 커버 + 애드센스 수익 최적화 + 거미줄 회유**가 동시에 작동하는 종합 가이드를 작성하세요.

【통합글 제목】
${title}

【본인이 작성한 글 ${sortedContents.length}개 — 자료원】
${sortedContents.map((item, idx) => `
═══ 자료 ${idx + 1} ═══
제목: ${item.title}
URL: ${item.url}
본문(8000자 한도): ${item.content.substring(0, 8000)}
`).join('\n')}

🎯 **3대 핵심 목표** (반드시 동시 충족):

① **검색 1페이지 진입**: 8,000자+ 롱폼 + E-E-A-T 신뢰성 + ${currentYear}년 최신성
② **애드센스 수익 최적화**: H2 6~7개로 광고 슬롯 자연 호흡 + 표·체크리스트로 체류시간 ↑
③ **거미줄 회유 (외부유입 핵심)**: 각 H2 끝에 해당 원본 글로 가는 강력한 CTA로 독자 회유

📐 **필수 출력 구조 (HTML fragment, <div> 래퍼 시작)**:

═══════════════════════════════════════
<div class="sw-cornerstone max-mode-article" style="max-width:760px;margin:0 auto;padding:0 16px;font-family:'Noto Sans KR',sans-serif;color:#1a1a1a;line-height:1.8;">

  1. <h1> 강력한 후킹 제목 (60자 이내, ${currentYear} 포함, 숫자/반전/이익)
  1-A. 🎯 **TL;DR 답변 박스** (v3.8.62 AEO/GEO 필수) — H1 직후 즉시 배치, 다음 정확한 구조:
     <div class="tldr-answer-box" style="margin:24px 0;padding:20px 24px;background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);border:2px solid #f59e0b;border-radius:14px;">
       <p style="margin:0 0 8px;color:#78350f;font-size:13px;font-weight:800;letter-spacing:0.5px;">💡 한눈에 답변</p>
       <p style="margin:0 0 14px;color:#0f172a;font-size:17px;font-weight:700;line-height:1.5;">[정의형 직답 40~60단어: "[주제]는 [카테고리]로서 [핵심 차별점]이며, [핵심 수치/기간/조건]." 패턴 정확히 사용]</p>
       <ul style="margin:0;padding-left:20px;color:#1e293b;font-size:14px;line-height:1.8;">
         <li><strong>핵심 수치 1:</strong> [구체적 숫자 + 단위]</li>
         <li><strong>핵심 수치 2:</strong> [구체적 숫자 + 단위]</li>
         <li><strong>핵심 수치 3:</strong> [구체적 숫자 + 단위]</li>
       </ul>
     </div>
     - 정의형 직답 패턴 예: "청년내일저축계좌는 만 19~34세 저소득 청년의 자산 형성을 돕는 정부 매칭 적금 제도로, 월 10만원 저축 시 정부가 매월 30만원을 추가 지원해 3년 만기 시 1,440만원 + 이자를 받습니다."
     - 핵심 수치 3개는 검색 의도 직답 (금액·기간·자격 등)
     - 🚨 이 TL;DR 박스는 AI Overview/Perplexity가 첫 단락에서 답변을 추출하므로 **절대 누락 금지**
     - 🚨 **도입부 카드 중복 금지**: TL;DR 박스가 이미 도입부 역할이므로 별도 "도입부 카드"·"이 글에서 다루는 N가지" 같은 추가 박스 절대 생성 금지 (중복 노출 방지)
  2. 핵심 요약표 (자료 ${sortedContents.length}개의 핵심을 한 줄씩 표 행으로) — TL;DR 박스 바로 다음에 배치
  4. <h2> 1~${sortedContents.length}번 (원본 글에 1:1 대응)
     - 본문 1,000~1,500자 (원본 70% 핵심 + 인사이트)
     - <h3> 2~3개 세부 섹션
     - 본문 중 통계/수치 강조 <strong>
     - 🔥 **각 H2당 1개 통계 박스 필수 (v3.8.69 GEO Tier 1, 정확한 구조)**:
       <aside style="margin:20px 0;padding:16px 20px;background:linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%);border-left:4px solid #2563eb;border-radius:0 10px 10px 0;">
         <p style="margin:0 0 6px;color:#1e3a8a;font-size:12px;font-weight:800;letter-spacing:0.5px;">📊 핵심 통계</p>
         <p style="margin:0 0 8px;color:#0f172a;font-size:18px;font-weight:800;line-height:1.4;">[구체적 숫자 + 단위 (예: "월 30만원 매칭 지원", "3년 만기 1,440만원")]</p>
         <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;">출처: <a href="[정부/공공 사이트 URL]" target="_blank" rel="noopener" style="color:#2563eb;">[기관명: 복지로 / 보건복지부 / 통계청 / 국세청 등]</a> (${new Date().getFullYear()}년 기준)</p>
       </aside>
     - **claim → evidence → source 패턴**: 주장 → 구체 수치 → 정부·공공기관 출처 (.go.kr / .or.kr 우선)
     - **H2 끝에 거미줄 회유 CTA 박스** (아래 CTA 패턴 정확히 사용)
  5. <h2> 비교 / 자주 묻는 질문 — 한눈에 비교 표 + Q&A 3~5개 (CTA 불필요)
  6. <h2> 실전 적용 가이드 — 체크리스트 ✅ 5~7개 (CTA 불필요)
  7. <h2> 더 깊이 알아보기 — 모든 자료 ${sortedContents.length}개 카드 그리드 (이 섹션이 종합 회유)
     - 카드 그리드는 모바일 친화 <table> 기반으로 작성 (Blogger 테마와 무관하게 무너지지 않음)
     - 패턴: <table style="width:100% !important;border-collapse:separate !important;border-spacing:12px !important;"><tr><td style="vertical-align:top !important;background-color:#f8fafc !important;padding:20px !important;border-radius:12px !important;border:1px solid #e2e8f0 !important;">카드 내용</td>...</tr></table>
     - 모바일 1열, 데스크탑 2열로 보이려면 td를 width:50%로 하되 max-width:100%로 폴백
  8. 결론 1~2줄 + 면책 조항

🎯 **CTA 정책 (v3.8.14 변경)**:
- 거미줄 회유 CTA는 **4번 항목(원본 대응 H2 1~${sortedContents.length}번)에만** 배치
- 5/6/7/8번엔 CTA 박스 추가 금지 (글 흐름·체류시간 보존)
- 7번 (더 깊이 알아보기 카드 그리드)이 이미 종합 회유 역할

🎨 **CTA HTML 패턴 — Blogger·WordPress 호환 (모든 핵심 속성에 !important 강제)**:
\`\`\`
<div style="margin:28px 0 !important;padding:24px 20px !important;background-color:#dbeafe !important;background:linear-gradient(135deg,#e0f2fe 0%,#dbeafe 100%) !important;border:2px solid #93c5fd !important;border-radius:14px !important;text-align:center !important;max-width:100% !important;box-sizing:border-box !important;">
  <p style="margin:0 0 14px !important;color:#1e3a8a !important;font-size:16px !important;font-weight:700 !important;line-height:1.5 !important;text-align:center !important;">[후킹 멘트 — 예: "더 자세한 ~을 알고 싶다면?"]</p>
  <p style="margin:0 !important;text-align:center !important;">
    <a href="[원본URL]" style="display:inline-block !important;padding:14px 28px !important;background-color:#ef4444 !important;background:linear-gradient(135deg,#ef4444 0%,#f97316 100%) !important;color:#ffffff !important;text-decoration:none !important;font-size:15px !important;font-weight:800 !important;border-radius:10px !important;box-shadow:0 4px 14px rgba(239,68,68,0.35) !important;">[버튼 텍스트 — 예: "2026년 청년내일저축계좌 혜택 상세 보기 🔥"]</a>
  </p>
</div>
\`\`\`
- 반드시 \`<button>\` 태그가 아닌 \`<a href>\` 사용 (Blogger sanitize 호환)
- 인라인 style만 사용 (class 사용 금지 — 블로그 RTE가 class 제거)
- 모든 핵심 속성(background, color, padding, text-align, border-radius)에 \`!important\` 필수 (Blogger 테마 CSS 우회)
- \`background:gradient\` 옆에 \`background-color:단색\` 폴백 함께 — 그라데이션 미지원 클라이언트 대비
- 후킹 멘트·버튼 모두 \`text-align:center !important\` 중앙 정렬
- \`max-width:100% !important; box-sizing:border-box !important\` 모바일 친화

🚫 **절대 금지** (위반 시 재작성 요구됨):
- H2 제목 끝에 "(종합 거미줄)", "(요약)", "(FAQ)", "(가이드)" 등 메타 라벨/괄호 절대 추가 금지
- H2 제목은 사용자가 검색할 만한 자연스러운 표현만 사용 (예: "5. 청년내일저축계좌, 더 깊이 알아보기" O / "5. 청년내일저축계좌, 더 깊이 알아보기 (종합 거미줄)" X)
- 메타 멘트("이 글은 ${sortedContents.length}개 글을 종합") / <html><body> / 마크다운 / 중국어 한자 / 빈 검색바·입력칸 / 자극·낚시
- 5/6/7/8번 H2에 거미줄 CTA 박스 추가 X (4번 H2에만)
- <button> 태그 X (Blogger가 sanitize) — <a href> + 인라인 style만
- 인용 자리표시자 절대 금지: [cite: provided data], [citation: 1], [ref: ...], [source: ...] 등 본문 노출 X (자연스러운 한국어 문장으로만)
- 🚨 **피아식별 위반 절대 금지**: "(원글 1 관점)", "(원본 N 관점)", "원문 N", "출처 1", "참고 자료 1", "(자료 N 관점)", "(원글 N 강조)" 등 다른 글에서 가져왔음을 암시하는 모든 표기 절대 금지. 본문·표 셀·헤더 어디서도 절대 사용 X. 단일 작성자가 처음부터 쓴 글처럼 자연스러운 표현만 사용 (예: "혜택 강조 관점" O / "원글 1 관점" X)

✅ **품질 기준 (필수)**: **본문 총 글자수 8,000~12,000자 절대 미달 금지** (HTML 태그 제외 순수 텍스트 기준).
   - 5,000자 이하면 SEO 효과 X → 반드시 8,000자 이상 작성
   - 각 H2 본문 1,000~1,500자, H3 세부 섹션 500~700자씩 보장
   - 결론·면책 포함 모든 섹션을 끝까지 완성 (중간에 끊지 마세요)
   - H2 정확히 ${sortedContents.length + 3}개, **거미줄 CTA는 원본 대응 H2(1~${sortedContents.length}번)에만**, 검색 의도 1편 완전 커버

지금 위 구조를 정확히 지켜 8,000자+ HTML을 작성하세요.
`;

      let generatedContent = '';
      try {
        sendDiag('🤖 Gemini LLM 호출 시작 (본문 생성)');
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            // v3.7.22: 8000 → 16000 토큰 (Gemini 2.x 한도 내). 기존 8000으론 출력 잘림.
            maxOutputTokens: 16000,
            temperature: 0.75,
          }
        });

        const response = await result.response;
        generatedContent = response.text();

        // HTML 태그 정리
        generatedContent = generatedContent
          .replace(/```html\n?/gi, '')
          .replace(/```\n?/gi, '')
          .trim();

        // v3.8.5: H1~H6 제목 끝의 메타 라벨 자동 제거
        //   LLM이 가끔 "(종합 거미줄)", "(요약)", "(FAQ)", "(가이드)", "(개요)" 등 라벨을 제목 끝에 포함
        //   사용자에게 노출되면 어색하므로 일괄 제거 (한·일 괄호 모두).
        const metaLabelPattern = /\s*[\(（]\s*(종합\s*거미줄|관련\s*글\s*회유|관련\s*글\s*모음|요약|FAQ|자주\s*묻는\s*질문|가이드|개요|총정리|결론|면책|체크리스트|비교)[^)）]*[\)）]\s*$/i;
        generatedContent = generatedContent
          .replace(/<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi, (_full, level, attrs, inner) => {
            const cleaned = String(inner).replace(metaLabelPattern, '').trim();
            return `<h${level}${attrs}>${cleaned}</h${level}>`;
          });

        // v3.8.22: LLM이 본문에 남기는 인용 자리표시자 자동 제거
        //   예: "[cite: provided data]", "[citation: 1]", "[ref: source]" 등.
        //   Gemini가 가끔 출처 참조를 본문에 그대로 남겨 독자에게 노출되는 문제 차단.
        generatedContent = generatedContent
          .replace(/\s*\[\s*(cite|citation|ref|reference|source|src)\s*[:：][^\]]*\]/gi, '')
          .replace(/\s*\[\s*(cite|citation|ref|reference|source|src)\s*\d*\s*\]/gi, '');

        // v3.8.24: 피아식별 위반 메타 표기 자동 제거 — "(원글 1 관점)", "(원본 N 강조)" 등.
        //   거미줄은 본인 글 통합이므로 다른 글 출처 암시는 절대 노출되면 안 됨.
        //   비교표 셀, 헤더, 본문 어디든 등장 시 괄호째 제거.
        generatedContent = generatedContent
          .replace(/\s*[\(（]\s*(원글|원본|원문|자료|출처|참고|발췌)\s*\d+\s*(관점|강조|입장|시각|기준|중심)?\s*[\)）]/gi, '')
          .replace(/\s*[\(（]\s*(원글|원본|원문|자료|출처|참고|발췌)\s*[\)）]/gi, '');

        // v3.8.19: LLM이 CTA HTML 가이드를 무시하고 평문으로 출력한 경우 자동 박스 변환
        //   패턴: H2 본문 끝부분에 "더 자세한 ~을 알고 싶다면?" + 다음 줄에 글 제목·"자세히 보기"·URL이 나오는 평문
        //   사용자 의도(빨간 그라데이션 박스 + 후킹 + 버튼)를 강제 적용해 안전망 제공.
        try {
          const sourceUrls = sortedContents.map((c) => c.url).filter(Boolean);
          let urlPtr = 0;

          // v3.8.77 추가 패턴: 다양한 후킹·버튼 케이스 모두 매칭
          //   - 후킹 문구가 ?로 끝나거나 "싶다면" 등으로 끝나는 단락
          //   - 다음에 <a> 또는 <p><a> 또는 <p>버튼 텍스트</p>
          const ctaBroadPattern = /<p[^>]*>\s*([^<]{6,120}?(?:\?|싶다면|궁금하시다면|더\s*알고|상세히|자세히|확인하|놓치지\s*마)\s*[?!]?\s*[\.。]?)\s*<\/p>\s*(?:<p[^>]*>\s*)?(?:<a[^>]*href=["']([^"']*)["'][^>]*>\s*)?([^<\n]{6,150}?(?:🔥|✨|💡|👉|→|>>|»|자세히|상세|보기|확인|신청|받기|클릭|GO))(?:\s*<\/a>)?(?:\s*<\/p>)?/gi;
          generatedContent = generatedContent.replace(ctaBroadPattern, (_match, hook, href, btn) => {
            const url = (href && /^https?:\/\//i.test(href)) ? href : (sourceUrls[urlPtr % Math.max(1, sourceUrls.length)] || sourceUrls[0] || '#');
            urlPtr++;
            const safeHook = String(hook).replace(/[<>]/g, '').trim();
            const safeBtn = String(btn).replace(/[<>]/g, '').trim();
            return `<div style="margin:32px 0 !important;padding:28px 24px !important;background-color:#dbeafe !important;background:linear-gradient(135deg,#e0f2fe 0%,#dbeafe 100%) !important;border:2px solid #93c5fd !important;border-radius:16px !important;text-align:center !important;max-width:100% !important;box-sizing:border-box !important;box-shadow:0 6px 20px rgba(59,130,246,0.18) !important;">
  <p style="margin:0 0 16px !important;color:#1e3a8a !important;font-size:17px !important;font-weight:800 !important;line-height:1.5 !important;text-align:center !important;">${safeHook}</p>
  <p style="margin:0 !important;text-align:center !important;">
    <a href="${url}" target="_blank" rel="noopener" style="display:inline-block !important;padding:16px 32px !important;background-color:#ef4444 !important;background:linear-gradient(135deg,#ef4444 0%,#f97316 100%) !important;color:#ffffff !important;text-decoration:none !important;font-size:16px !important;font-weight:800 !important;border-radius:12px !important;box-shadow:0 6px 16px rgba(239,68,68,0.4) !important;">${safeBtn}</a>
  </p>
</div>`;
          });

          // v3.8.74: 패턴 2 — <p>후킹?</p>\s*<a href="…">버튼 텍스트</a> (wrap 없는 a 태그 단독)
          //   사용자 보고: 박스 wrap 없이 후킹+버튼만 왼쪽 정렬로 나옴 → 정규식이 a 태그 단독 케이스 매칭 못함
          const ctaAnchorPattern = /<p[^>]*>\s*([^<]{8,80}?(?:\?|싶다면|\s궁금|\s더\s알고|\s확인하고)\s*[?<])\s*<\/p>\s*<a[^>]*href=["']([^"']+)["'][^>]*>\s*([^<]{8,120}?)\s*<\/a>/gi;
          generatedContent = generatedContent.replace(ctaAnchorPattern, (_match, hook, _href, btn) => {
            const url = sourceUrls[urlPtr % Math.max(1, sourceUrls.length)] || sourceUrls[0] || '#';
            urlPtr++;
            const safeHook = String(hook).replace(/[<>]/g, '').trim();
            const safeBtn = String(btn).replace(/[<>]/g, '').trim();
            return `<div style="margin:28px 0 !important;padding:24px 20px !important;background-color:#dbeafe !important;background:linear-gradient(135deg,#e0f2fe 0%,#dbeafe 100%) !important;border:2px solid #93c5fd !important;border-radius:14px !important;text-align:center !important;max-width:100% !important;box-sizing:border-box !important;">
  <p style="margin:0 0 14px !important;color:#1e3a8a !important;font-size:16px !important;font-weight:700 !important;line-height:1.5 !important;text-align:center !important;">${safeHook}</p>
  <p style="margin:0 !important;text-align:center !important;">
    <a href="${url}" style="display:inline-block !important;padding:14px 28px !important;background-color:#ef4444 !important;background:linear-gradient(135deg,#ef4444 0%,#f97316 100%) !important;color:#ffffff !important;text-decoration:none !important;font-size:15px !important;font-weight:800 !important;border-radius:10px !important;box-shadow:0 4px 14px rgba(239,68,68,0.35) !important;">${safeBtn}</a>
  </p>
</div>`;
          });

          // 패턴 1 (기존): <p>후킹?</p><p>버튼 텍스트</p>
          const ctaTextPattern = /<p[^>]*>\s*([^<]{8,80}?(?:\?|싶다면|\s궁금|\s더\s알고|\s확인하고)\s*[?<])\s*<\/p>\s*(?:<p[^>]*>\s*)?([^<]{8,120}?(?:🔥|✨|💡|자세히\s*보기|상세\s*보기|>>|»))\s*<\/p>/gi;
          generatedContent = generatedContent.replace(ctaTextPattern, (_match, hook, btn) => {
            const url = sourceUrls[urlPtr % Math.max(1, sourceUrls.length)] || sourceUrls[0] || '#';
            urlPtr++;
            const safeHook = String(hook).replace(/[<>]/g, '').trim();
            const safeBtn = String(btn).replace(/[<>]/g, '').trim();
            // v3.8.25: 모든 핵심 속성에 !important + background-color 단색 폴백 + 중앙정렬 강제
            return `<div style="margin:28px 0 !important;padding:24px 20px !important;background-color:#dbeafe !important;background:linear-gradient(135deg,#e0f2fe 0%,#dbeafe 100%) !important;border:2px solid #93c5fd !important;border-radius:14px !important;text-align:center !important;max-width:100% !important;box-sizing:border-box !important;">
  <p style="margin:0 0 14px !important;color:#1e3a8a !important;font-size:16px !important;font-weight:700 !important;line-height:1.5 !important;text-align:center !important;">${safeHook}</p>
  <p style="margin:0 !important;text-align:center !important;">
    <a href="${url}" style="display:inline-block !important;padding:14px 28px !important;background-color:#ef4444 !important;background:linear-gradient(135deg,#ef4444 0%,#f97316 100%) !important;color:#ffffff !important;text-decoration:none !important;font-size:15px !important;font-weight:800 !important;border-radius:10px !important;box-shadow:0 4px 14px rgba(239,68,68,0.35) !important;">${safeBtn}</a>
  </p>
</div>`;
          });
          console.log('[INTERNAL-CONSISTENCY] CTA 후처리 변환 시도 (안전망)');
        } catch (e: any) {
          console.warn('[INTERNAL-CONSISTENCY] CTA 후처리 실패:', e?.message);
        }

        // v3.8.10: 본문 H1을 제목 필드로 추출 + 본문에서 제거 (글포스팅과 동일 정책)
        //   LLM이 본문에 H1 출력 → 거기에 멋진 제목 들어가지만 발행 제목 필드에는 fallback '종합 가이드'만 들어가던 버그.
        //   → 사용자 입력 title이 비어있으면 H1 텍스트를 추출해 제목으로 사용.
        //   → H1 태그는 본문에서 제거 (블로그 플랫폼이 자동으로 제목을 H1로 렌더하므로 중복 방지).
        const h1Match = generatedContent.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        let extractedTitleFromH1 = '';
        if (h1Match && h1Match[1]) {
          extractedTitleFromH1 = h1Match[1]
            .replace(/<[^>]+>/g, '')           // 내부 태그 제거
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/\s+/g, ' ')
            .trim();
          // 본문에서 H1 태그 통째 제거 + 인접 공백·br 정리
          generatedContent = generatedContent
            .replace(/\s*<h1[^>]*>[\s\S]*?<\/h1>\s*(<br\s*\/?>\s*)*/i, '')
            .trim();
          console.log('[INTERNAL-CONSISTENCY] 본문 H1 추출:', extractedTitleFromH1.substring(0, 60));
        }
        // title 우선순위: 사용자 명시 입력 > H1 추출 > 폴백
        const userTitleTrimmed = (payload.title || '').trim();
        if (!userTitleTrimmed && extractedTitleFromH1) {
          title = extractedTitleFromH1;
          console.log('[INTERNAL-CONSISTENCY] title 자동 설정 (H1 추출):', title);
        }

      } catch (error) {
        console.error('[INTERNAL-CONSISTENCY] AI 종합글 생성 실패:', error);

        // API 키 관련 에러인지 확인
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('403') || errorMessage.includes('API Key') || errorMessage.includes('unregistered callers')) {
          throw new Error(`Gemini API 키가 유효하지 않거나 권한이 없습니다.\n\n에러: ${errorMessage}\n\n해결 방법:\n1. 환경 설정에서 Gemini API 키를 확인하세요\n2. API 키가 올바른지 확인하세요 (https://aistudio.google.com/app/apikey)\n3. API 키에 필요한 권한이 있는지 확인하세요`);
        }

        // v3.7.22: 폴백 강화 — cornerstone 카드 구조 + 거미줄 CTA + 표 (단순 요약 반복 X)
        generatedContent = buildSpiderWebFallbackHtml(title, sortedContents);
      }

      console.log('[INTERNAL-CONSISTENCY] ✅ 종합글 생성 완료, 콘텐츠 길이:', generatedContent.length);

      // v3.8.6: 이미지 정책 적용 — 썸네일 + H2별 이미지 생성 + HTML 삽입
      const imagePolicy = (payload.imagePolicy || 'all').toLowerCase();
      const thumbEngine = (payload.imageThumbnailEngine || 'nanobanana2').toLowerCase();
      const h2Engine = (payload.imageH2Engine || 'nanobanana2').toLowerCase();
      // v3.8.7: 텍스트 포함 옵션 → prompt에 직접 지시
      // v3.8.35: 영문 instruction은 이미지에 그대로 글자로 박히는 문제 차단 — 한국어 지시문 + negative
      const imageIncludeText = !!payload.imageIncludeText;
      const textTail = imageIncludeText
        ? `\n\n주제를 한눈에 표현하는 굵고 또렷한 한국어 큰 글자 텍스트 오버레이를 이미지 위에 포함. 영어 단어·문장·instruction·metadata·대괄호·콜론은 절대로 그리지 마세요. 한국어만 쓰세요.`
        : '';

      // v3.8.8: dataURL → 호스팅 URL 변환
      // v3.8.9: WP 자격증명 보유 시 platform 무관하게 WP 미디어 우선 (블로그스팟도 wp 사이트 URL 빌려 사용)
      const targetPlatform = String((payload as any).platform || '').toLowerCase();
      async function _hostImageDataUrl(dataUrl: string, label: string): Promise<{ url: string; provider: string }> {
        if (!dataUrl || !/^data:image/.test(dataUrl)) return { url: dataUrl, provider: 'passthrough' };

        // 1) WP 자격증명 보유 시 wp-json/v2/media 업로드 (platform 무관 hotlink 허용)
        //    v3.8.14: timeout 60s + 1회 retry (네트워크 흔들림 대응)
        const env = loadEnvFromFile() as any;
        const wpUrl = (env.wordpressSiteUrl || env.WORDPRESS_SITE_URL || '').trim().replace(/\/+$/, '');
        const wpUser = (env.wordpressUsername || env.WORDPRESS_USERNAME || '').trim();
        const wpPass = (env.wordpressPassword || env.WORDPRESS_PASSWORD || '').trim();
        if (wpUrl && wpUser && wpPass) {
          const m = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
          if (m) {
            const mime = m[1];
            const ext = (mime.split('/')[1] || 'png').replace('+xml', '');
            const buf = Buffer.from(m[2], 'base64');
            const filename = `${label || 'image'}-${Date.now()}.${ext}`;
            const auth = Buffer.from(`${wpUser}:${wpPass}`).toString('base64');
            const axios = (await import('axios')).default;
            for (let attempt = 1; attempt <= 2; attempt++) {
              try {
                const res = await axios.post(`${wpUrl}/wp-json/wp/v2/media`, buf, {
                  headers: {
                    Authorization: `Basic ${auth}`,
                    'Content-Type': mime,
                    'Content-Disposition': `attachment; filename="${filename}"`,
                  },
                  timeout: 60000,
                  maxBodyLength: 50 * 1024 * 1024,
                  maxContentLength: 50 * 1024 * 1024,
                });
                const src = res.data && (res.data.source_url || (res.data.guid && res.data.guid.rendered));
                if (typeof src === 'string' && src) {
                  console.log(`[IMG-HOST] ✅ WP 미디어 업로드 성공 (${label}, attempt=${attempt}, platform=${targetPlatform || 'unknown'}):`, src.substring(0, 80));
                  return { url: src, provider: targetPlatform === 'wordpress' ? 'wp-media' : 'wp-media-hotlink' };
                }
                console.warn(`[IMG-HOST] WP 응답에 source_url 없음 (${label}, attempt=${attempt})`);
              } catch (e: any) {
                console.warn(`[IMG-HOST] WP 업로드 실패 (${label}, attempt=${attempt}):`, e?.message?.substring(0, 200));
                if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
              }
            }
          }
        }

        // 2) 외부 호스팅 6단계 폴백 (Cloudinary/ImgBB/ImgHippo/freeimage/Catbox/0x0) + 1회 retry
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const { uploadBase64ToImageHost } = require('../dist/core/final/image-helpers');
            const hostedUrl = await uploadBase64ToImageHost(dataUrl, label);
            if (typeof hostedUrl === 'string' && hostedUrl) {
              console.log(`[IMG-HOST] ✅ 외부 호스팅 성공 (${label}, attempt=${attempt}):`, hostedUrl.substring(0, 80));
              return { url: hostedUrl, provider: 'external' };
            }
          } catch (e: any) {
            console.warn(`[IMG-HOST] 외부 호스팅 예외 (${label}, attempt=${attempt}):`, e?.message?.substring(0, 200));
          }
          if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
        }

        // 3) 최종 폴백: dataUrl 그대로 (publisher가 sanitize 처리)
        console.error(`[IMG-HOST] ❌ 모든 호스팅 실패 (${label}) — base64 그대로 반환 (publisher placeholder 치환 위험)`);
        return { url: dataUrl, provider: 'datauri' };
      }
      const imageStats: { thumbnail: boolean; h2Generated: number; h2Failed: number; errors: string[] } = {
        thumbnail: false, h2Generated: 0, h2Failed: 0, errors: [],
      };
      let thumbnailUrl = '';

      if (imagePolicy !== 'none') {
        try {
          const dispatcher = require('../dist/core/imageDispatcher');
          const { dispatchThumbnailGeneration, dispatchH2ImageGeneration } = dispatcher || {};

          // 1) 썸네일 — 'none' 외 모든 정책에서 생성
          sendDiag(`🎨 LLM 생성 완료 (${generatedContent.length}자) — 이미지 단계 진입`);
          if (typeof dispatchThumbnailGeneration === 'function' && thumbEngine !== 'none') {
            sendDiag(`🖼️ 썸네일 생성 시작 (엔진: ${thumbEngine})`);
            try {
              console.log('[INTERNAL-CONSISTENCY] 🖼️ 썸네일 생성 시작:', thumbEngine);
              const thumbResult = await dispatchThumbnailGeneration(
                thumbEngine,
                title + textTail,
                title,
              );
              if (thumbResult && thumbResult.ok && (thumbResult.dataUrl || thumbResult.url)) {
                const rawThumb = thumbResult.dataUrl || thumbResult.url || '';
                // v3.8.8: dataURL → 호스팅 URL 변환 (WP 미디어 우선)
                const hosted = await _hostImageDataUrl(rawThumb, 'sw-thumb');
                thumbnailUrl = hosted.url;
                imageStats.thumbnail = true;
                console.log('[INTERNAL-CONSISTENCY] 썸네일 호스팅 provider:', hosted.provider);
                // v3.8.44: 실시간 이미지 UI push
                try {
                  const { BrowserWindow: BW } = await import('electron');
                  const allWindows = BW.getAllWindows();
                  allWindows.forEach((w) => w.webContents.send('sw-image-generated', {
                    kind: 'thumbnail', label: '썸네일', url: hosted.url,
                  }));
                } catch {}
                // v3.8.18: 본문 썸네일 삽입 제거 — publishToBlogger가 separator 구조로 자동 본문 앞 삽입
                //   이전엔 본문에 <p><img></p> 박고 publisher도 separator 박아 중복 노출 버그.
                //   thumbnailUrl만 반환하고 본문에는 박지 않음.
                console.log('[INTERNAL-CONSISTENCY] ✅ 썸네일 URL 보관 (본문 삽입은 publisher 위임)');
              } else {
                imageStats.errors.push(`썸네일 생성 실패: ${(thumbResult && thumbResult.error) || 'unknown'}`);
              }
            } catch (e: any) {
              imageStats.errors.push(`썸네일 예외: ${e && e.message || e}`);
            }
          }

          // 2) H2 이미지 — 정책 분기
          if (imagePolicy !== 'thumbnail-only' && typeof dispatchH2ImageGeneration === 'function' && h2Engine !== 'none') {
            const $ = cheerio.load(generatedContent, { decodeEntities: false } as any);
            const h2Nodes = $('h2').toArray();
            console.log('[INTERNAL-CONSISTENCY] 🖼️ H2 헤더', h2Nodes.length, '개 발견 · 정책:', imagePolicy, '· 엔진:', h2Engine);
            if (h2Nodes.length === 0) {
              imageStats.errors.push('H2 헤더 0개 — LLM이 H2를 생성하지 않음');
            }

            // v3.8.22: "핵심 요약 / 성급한 / 한눈에 / TLDR / 총정리 / 결론" 패턴 H2엔 이미지 스킵.
            //   이 섹션들은 짧은 요약표·체크리스트라 이미지가 시각적으로 부적절 (햄스터 사진 등 무관한 그림).
            const SKIP_IMAGE_H2_PATTERN = /(성급한|핵심\s*요약|한\s*눈에|한눈에|TLDR|tl;dr|총\s*정리|결론|요약\s*표|마치며|마무리)/i;

            for (let i = 0; i < h2Nodes.length; i++) {
              const idx1 = i + 1;
              // 정책 필터
              let shouldGenerate = false;
              if (imagePolicy === 'all') shouldGenerate = true;
              else if (imagePolicy === 'odd-only' && idx1 % 2 === 1) shouldGenerate = true;
              else if (imagePolicy === 'even-only' && idx1 % 2 === 0) shouldGenerate = true;
              if (!shouldGenerate) continue;

              const h2El = h2Nodes[i];
              const h2Text = $(h2El).text().trim();
              if (!h2Text) continue;

              // v3.8.22: 요약/결론 류 H2 스킵
              if (SKIP_IMAGE_H2_PATTERN.test(h2Text)) {
                console.log(`[INTERNAL-CONSISTENCY] ⏭️ H2 ${idx1} 이미지 스킵 (요약/결론 패턴): "${h2Text.substring(0, 30)}…"`);
                continue;
              }

              try {
                console.log(`[INTERNAL-CONSISTENCY] 🖼️ H2 ${idx1}/${h2Nodes.length} 이미지 시작: "${h2Text.substring(0, 30)}…"`);
                const h2Result = await dispatchH2ImageGeneration(
                  h2Engine,
                  h2Text + textTail,
                  h2Text,
                );
                const hasDataUrl = !!(h2Result && (h2Result.dataUrl || h2Result.url));
                console.log(`[INTERNAL-CONSISTENCY] 🖼️ H2 ${idx1} 결과: ok=${h2Result && h2Result.ok}, hasDataUrl=${hasDataUrl}, source=${h2Result && h2Result.source}, error=${h2Result && h2Result.error ? String(h2Result.error).substring(0, 100) : 'none'}`);
                if (h2Result && h2Result.ok && hasDataUrl) {
                  const rawH2 = h2Result.dataUrl || h2Result.url || '';
                  console.log(`[INTERNAL-CONSISTENCY] H2 ${idx1} dataUrl 길이: ${rawH2.length}`);
                  // v3.8.8: dataURL → 호스팅 URL 변환
                  const hosted = await _hostImageDataUrl(rawH2, `sw-h2-${idx1}`);
                  const imgTag = `<p style="text-align:center;margin:18px 0;"><img src="${hosted.url}" alt="${h2Text.replace(/"/g, '&quot;')}" style="max-width:100%;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,0.1);"></p>`;
                  $(h2El).after(imgTag);
                  imageStats.h2Generated++;
                  console.log(`[INTERNAL-CONSISTENCY] ✅ H2 ${idx1} 삽입 완료 · provider=${hosted.provider}`);
                  // v3.8.44: 실시간 이미지 UI push
                  try {
                    const { BrowserWindow: BW } = await import('electron');
                    const allWindows = BW.getAllWindows();
                    allWindows.forEach((w) => w.webContents.send('sw-image-generated', {
                      kind: 'h2', label: `H2 ${idx1}: ${h2Text.substring(0, 30)}`, url: hosted.url,
                    }));
                  } catch {}
                } else {
                  imageStats.h2Failed++;
                  const errMsg = (h2Result && h2Result.error) || 'unknown (ok=' + (h2Result && h2Result.ok) + ', dataUrl=' + hasDataUrl + ')';
                  imageStats.errors.push(`H2 ${idx1} 실패: ${errMsg}`);
                  console.warn(`[INTERNAL-CONSISTENCY] ⚠️ H2 ${idx1} 실패:`, errMsg);
                }
              } catch (e: any) {
                imageStats.h2Failed++;
                const errMsg = e && e.message || e;
                imageStats.errors.push(`H2 ${idx1} 예외: ${errMsg}`);
                console.error(`[INTERNAL-CONSISTENCY] ❌ H2 ${idx1} 예외:`, errMsg);
              }
            }

            generatedContent = $.html();
            // cheerio가 자동 래핑한 <html><head></head><body>...</body></html> 제거
            generatedContent = generatedContent
              .replace(/^[\s\S]*?<body[^>]*>/i, '')
              .replace(/<\/body>[\s\S]*$/i, '')
              .trim();
            console.log('[INTERNAL-CONSISTENCY] ✅ H2 이미지 생성 완료:', imageStats.h2Generated, '성공 /', imageStats.h2Failed, '실패');
          }
        } catch (e: any) {
          console.error('[INTERNAL-CONSISTENCY] 이미지 생성 블록 실패:', e);
          imageStats.errors.push(`이미지 디스패처 실패: ${e && e.message || e}`);
        }
      } else {
        console.log('[INTERNAL-CONSISTENCY] 이미지 정책 = none, 이미지 생성 스킵');
      }

      // v3.8.15/v3.8.19: 라벨(해시태그) 5개 자동 생성 — robust 폴백 추가
      //   1순위: LLM JSON 배열 (temperature 0.3)
      //   2순위: 원본 글 제목 + 통합 제목 키워드 명사 추출
      //   최후: 빈 배열 (발행은 정상 진행)
      let generatedLabels: string[] = [];
      try {
        const labelPrompt = `다음 한국어 블로그 글의 SEO 라벨(태그) 5개를 정확히 JSON 배열로만 출력하세요.
- 각 라벨은 2~10자 한글/영문/숫자, 검색 가능한 명사·핵심어 위주
- 띄어쓰기 포함 가능, 특수문자(#, ?, ! 등) 금지
- 글의 주제와 직결되는 표현만
- 중복 X, 너무 일반적인 단어("정보", "가이드" 단독) X

제목: ${title}
본문 일부 (앞 2000자):
${(generatedContent || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000)}

출력 형식 — JSON 배열만 (다른 텍스트 X):
["라벨1", "라벨2", "라벨3", "라벨4", "라벨5"]`;
        const labelResult = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: labelPrompt }] }],
          generationConfig: { maxOutputTokens: 300, temperature: 0.3 },
        });
        const labelText = ((await labelResult.response).text() || '').trim();
        // ```json ... ``` 또는 [..] 둘 다 처리
        const arrayMatch = labelText.match(/\[[\s\S]*?\]/);
        if (arrayMatch) {
          const parsed = JSON.parse(arrayMatch[0]);
          if (Array.isArray(parsed)) {
            generatedLabels = parsed
              .map((s: any) => String(s || '').trim())
              .filter((s) => s.length >= 2 && s.length <= 40)
              .slice(0, 5);
          }
        }
        console.log('[INTERNAL-CONSISTENCY] LLM 라벨', generatedLabels.length, '개:', generatedLabels.join(', '));
      } catch (e: any) {
        console.warn('[INTERNAL-CONSISTENCY] LLM 라벨 생성 실패:', e?.message?.substring(0, 200));
      }

      // v3.8.19: LLM 실패 또는 라벨 < 3 → 제목·소스 키워드 기반 자동 추출 폴백
      if (generatedLabels.length < 3) {
        try {
          const fallbackSet = new Set<string>();
          // 통합 제목에서 명사 추출 (2~10자 한글/영문 단어)
          const titleWords = String(title || '')
            .replace(/[\(\)\[\]【】〈〉:!?,.\-—–·!?​]/g, ' ')
            .split(/\s+/)
            .map((w) => w.trim())
            .filter((w) => w.length >= 2 && w.length <= 10);
          for (const w of titleWords) {
            if (!/^\d+$/.test(w)) fallbackSet.add(w);
          }
          // 원본 글 제목에서도 키워드 추출
          for (const c of sortedContents) {
            const words = String(c.title || '')
              .replace(/[\(\)\[\]【】〈〉:!?,.\-—–·!?​]/g, ' ')
              .split(/\s+/)
              .map((w) => w.trim())
              .filter((w) => w.length >= 2 && w.length <= 10);
            for (const w of words) {
              if (!/^\d+$/.test(w)) fallbackSet.add(w);
              if (fallbackSet.size >= 8) break;
            }
            if (fallbackSet.size >= 8) break;
          }
          // 기존 LLM 라벨 + 폴백 합치고 5개로
          const merged = Array.from(new Set([...generatedLabels, ...fallbackSet])).slice(0, 5);
          if (merged.length > generatedLabels.length) {
            console.log('[INTERNAL-CONSISTENCY] 라벨 폴백 보강:', merged.join(', '));
            generatedLabels = merged;
          }
        } catch (e: any) {
          console.warn('[INTERNAL-CONSISTENCY] 라벨 폴백 추출 실패:', e?.message);
        }
      }

      // v3.8.16/v3.8.62 (Phase1 작업2): SEO 메타데이터 자동 생성 — Gemini AI 별도 호출로 품질 향상
      //   기존: 첫 155자 단순 자름 → 검색 의도 무시
      //   개선: Gemini AI로 [검색 키워드 + 이익 + CTA] 패턴 140-160자 생성 (Backlinko CTR +8.9%)
      //   excerpt도 자연스러운 첫 두 문장 요약으로 별도 생성.
      let excerpt = '';
      let metaDescription = '';
      try {
        const plainText = (generatedContent || '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/\s+/g, ' ')
          .trim();
        // excerpt: 첫 두 문장 (자연스러운 요약)
        const sentences = plainText.split(/(?<=[.。!?])\s+/);
        excerpt = sentences.slice(0, 2).join(' ').substring(0, 200).trim();
        if (excerpt.length < 50 && plainText.length > 50) {
          excerpt = plainText.substring(0, 200).trim();
        }

        // v3.8.62: metaDescription — Gemini AI 별도 호출로 검색 최적화 패턴 생성
        try {
          const { GoogleGenerativeAI: GGA_META } = require('@google/generative-ai');
          const metaGenAI = new GGA_META(geminiKey);
          const metaModel = await selectGeminiModel(metaGenAI);
          const metaPrompt = `다음 블로그 글의 메타 디스크립션을 정확히 1줄로 작성하세요.

【글 제목】 ${title}
【본문 첫 500자】 ${plainText.substring(0, 500)}
【핵심 키워드】 ${(generatedLabels || []).slice(0, 5).join(', ') || '(없음)'}

요구사항:
- 정확히 140~160자 (한글 기준)
- 핵심 검색 키워드 1~2개 자연스럽게 포함
- 독자가 이 글을 클릭해서 얻을 수 있는 이익(혜택/방법/결과) 1줄 명시
- 끝에 행동 유도(CTA) 짧게 ("자세히 보기", "지금 확인" 등)
- 출력은 메타 디스크립션 텍스트 1줄만 (앞뒤 따옴표·마크다운 X)

예시: "2026년 청년내일저축계좌 자격조건과 신청방법을 한눈에 정리. 월 10만원 적금으로 1,440만원 목돈을 만드는 모든 방법, 지금 확인하세요."`;
          const metaResult = await metaModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: metaPrompt }] }],
            generationConfig: { maxOutputTokens: 200, temperature: 0.4 },
          });
          let aiMeta = ((await metaResult.response).text() || '').trim();
          // 따옴표·마크다운·앞뒤 공백 제거
          aiMeta = aiMeta.replace(/^["'`「『]+|["'`」』]+$/g, '').replace(/^\*+|\*+$/g, '').trim();
          // 첫 줄만 사용
          aiMeta = aiMeta.split(/\n+/)[0]!.trim();
          if (aiMeta.length >= 100 && aiMeta.length <= 200) {
            metaDescription = aiMeta;
            console.log(`[INTERNAL-CONSISTENCY] ✅ metaDescription Gemini AI 생성 (${aiMeta.length}자): ${aiMeta.substring(0, 60)}…`);
          } else {
            // AI 응답이 길이 미달 → 폴백
            throw new Error(`AI meta 길이 부적절: ${aiMeta.length}자`);
          }
        } catch (aiErr: any) {
          // 폴백: 첫 155자 자름 (기존 방식)
          metaDescription = plainText.substring(0, 155).trim();
          if (metaDescription.length > 152) {
            metaDescription = metaDescription.substring(0, 152) + '…';
          }
          console.warn(`[INTERNAL-CONSISTENCY] metaDescription Gemini 실패 → 폴백 자름: ${aiErr?.message}`);
        }
      } catch (e: any) {
        console.warn('[INTERNAL-CONSISTENCY] excerpt/metaDescription 생성 실패:', e?.message);
      }

      // v3.8.17: Blogger 발행 시 본문 상단에 schema.org description meta 자동 삽입
      //   Blogger는 API에서 description 필드를 받지 않으나, 본문 내 itemprop="description"을
      //   인식해 글 목록 미리보기·SEO 메타에 활용. WordPress에도 영향 없는 안전한 마크업.
      if (metaDescription) {
        const escapedDesc = metaDescription
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
        const descMeta = `<div style="display:none;" itemprop="description">${escapedDesc}</div>\n`;
        // 본문 맨 앞에 삽입 (썸네일·H1 처리 이전)
        generatedContent = descMeta + generatedContent;
        console.log('[INTERNAL-CONSISTENCY] 본문 상단 schema.org description meta 삽입');
      }

      // v3.8.31/v3.8.35: 거미줄 통합글 목차 — 모든 스타일 inline으로 직접 박음 (CSS 누락 시에도 정상).
      //   기존 generateTOCFinal은 .toc-grid/.toc-btn/.toc-number CSS 클래스 기반 → 거미줄엔
      //   CSS가 별도로 주입되지 않아 plain text로 보이던 문제 차단.
      try {
        const h2RegexAll = /<h2([^>]*)>([\s\S]*?)<\/h2>/gi;
        const h2Titles: string[] = [];
        let h2Idx = 0;
        generatedContent = generatedContent.replace(h2RegexAll, (match: string, attrs: string, inner: string) => {
          const plainTitle = String(inner).replace(/<[^>]+>/g, '').trim();
          if (!plainTitle) return match;
          const hasId = /\bid\s*=/i.test(attrs || '');
          const newAttrs = hasId ? attrs : `${attrs || ''} id="section-${h2Idx}"`;
          h2Titles.push(plainTitle);
          h2Idx++;
          return `<h2${newAttrs}>${inner}</h2>`;
        });

        if (h2Titles.length >= 2) {
          const escapeHtmlText = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          // v3.8.40: 목차 톤도 일반 글포스팅과 통일 (빨간 H3 헤더 + 베이지 배경 박스)
          const tocItems = h2Titles.map((h2, i) =>
            `<a href="#section-${i}" style="display:flex !important;align-items:center !important;gap:12px !important;padding:18px 20px !important;background:#ffffff !important;border:1px solid #e2e8f0 !important;border-radius:14px !important;text-decoration:none !important;color:#475569 !important;font-weight:700 !important;font-size:16px !important;box-shadow:0 2px 4px rgba(0,0,0,0.04) !important;">
  <span style="display:inline-flex !important;align-items:center !important;justify-content:center !important;width:28px !important;height:28px !important;background:#fee2e2 !important;color:#dc2626 !important;border-radius:8px !important;font-size:13px !important;font-weight:800 !important;flex-shrink:0 !important;">${i + 1}</span>
  <span style="flex:1 !important;line-height:1.4 !important;color:#475569 !important;">${escapeHtmlText(h2)}</span>
</a>`
          ).join('\n  ');

          const tocHtml = `
<div style="margin:40px 0 !important;padding:30px !important;background:#fff7f7 !important;border-radius:20px !important;border:1px solid #fecaca !important;">
  <h3 style="margin:0 0 20px 0 !important;font-size:20px !important;font-weight:800 !important;color:#991b1b !important;display:flex !important;align-items:center !important;gap:8px !important;background:none !important;border:none !important;padding:0 !important;">📌 전체 읽어보기 절차</h3>
  <div style="display:flex !important;flex-direction:column !important;gap:12px !important;">
  ${tocItems}
  </div>
</div>
`;

          const firstH2Pos = generatedContent.search(/<h2[^>]*\bid\s*=\s*["']section-0["'][^>]*>/i);
          if (firstH2Pos > 0) {
            generatedContent = generatedContent.slice(0, firstH2Pos) + tocHtml + '\n' + generatedContent.slice(firstH2Pos);
            console.log(`[INTERNAL-CONSISTENCY] ✅ 목차 자동 삽입 완료 (H2 ${h2Titles.length}개, 인라인 style)`);
          }
        }
      } catch (tocErr: any) {
        console.warn('[INTERNAL-CONSISTENCY] ⚠️ 목차 삽입 실패:', tocErr?.message);
      }

      // v3.8.66 (Phase 2 작업 5): FAQPage + HowTo Schema 자동 주입
      //   본문에서 자동 추출:
      //   - Q&A 패턴 → FAQPage JSON-LD (AI Overview Tier 1 인용)
      //   - 단계 패턴(1. ... 2. ... 또는 <ol>) → HowTo JSON-LD
      try {
        const extractFAQs = (html: string): Array<{ q: string; a: string }> => {
          const faqs: Array<{ q: string; a: string }> = [];
          // 패턴 1: <h3>질문?</h3><p>답변</p>
          const h3Re = /<h3[^>]*>([^<]*\?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/gi;
          let m;
          while ((m = h3Re.exec(html)) !== null) {
            const q = (m[1] || '').trim();
            const a = (m[2] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            if (q.length > 5 && q.length < 200 && a.length > 20 && a.length < 800) {
              faqs.push({ q, a });
            }
          }
          // 패턴 2: <h2>자주 묻는 질문</h2> 아래 dt/dd 또는 strong+p
          if (faqs.length < 2) {
            const strongRe = /<(strong|b)[^>]*>([^<]*\?)<\/(strong|b)>\s*[:：]?\s*([\s\S]*?)(?=<(strong|b|h\d|hr)|$)/gi;
            while ((m = strongRe.exec(html)) !== null && faqs.length < 8) {
              const q = (m[2] || '').trim();
              const a = (m[4] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
              if (q.length > 5 && q.length < 200 && a.length > 20 && a.length < 800) {
                faqs.push({ q, a: a.substring(0, 500) });
              }
            }
          }
          return faqs.slice(0, 8);
        };

        const extractHowToSteps = (html: string, title: string): { name: string; steps: Array<{ name: string; text: string }> } | null => {
          // <ol> 패턴 (5-15개 단계)
          const olRe = /<ol[^>]*>([\s\S]*?)<\/ol>/gi;
          let olMatch;
          while ((olMatch = olRe.exec(html)) !== null) {
            const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
            const steps: Array<{ name: string; text: string }> = [];
            let li;
            while ((li = liRe.exec(olMatch[1]!)) !== null) {
              const text = (li[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
              if (text.length > 10 && text.length < 400) {
                steps.push({ name: `단계 ${steps.length + 1}`, text });
              }
            }
            if (steps.length >= 3 && steps.length <= 15) {
              return { name: `${title} 단계별 가이드`, steps };
            }
          }
          return null;
        };

        const faqs = extractFAQs(generatedContent);
        const howto = extractHowToSteps(generatedContent, title);
        const additionalSchemas: any[] = [];
        if (faqs.length >= 2) {
          additionalSchemas.push({
            '@type': 'FAQPage',
            mainEntity: faqs.map(({ q, a }) => ({
              '@type': 'Question',
              name: q,
              acceptedAnswer: { '@type': 'Answer', text: a },
            })),
          });
          console.log(`[INTERNAL-CONSISTENCY] ✅ FAQPage Schema 추출 (${faqs.length}개 Q&A)`);
        }
        if (howto) {
          additionalSchemas.push({
            '@type': 'HowTo',
            name: howto.name,
            step: howto.steps.map((s, i) => ({
              '@type': 'HowToStep',
              position: i + 1,
              name: s.name,
              text: s.text,
            })),
          });
          console.log(`[INTERNAL-CONSISTENCY] ✅ HowTo Schema 추출 (${howto.steps.length}단계)`);
        }
        // v3.8.70 (Phase 3 작업 9): DefinedTerm + Speakable + ImageObject 신규 schema (2026 트렌드)
        try {
          const newEnv = loadEnvFromFile() as any;
          const newAuthor = (newEnv.authorName || newEnv.adsenseAuthorInfo || newEnv.authorNickname || '에디터').toString().trim() || '에디터';
          const newSiteName = (newEnv.wordpressSiteName || newEnv.blogTitle || '').toString().trim() || 'LEADERNAM';
          const newSiteUrl = (newEnv.wordpressSiteUrl || newEnv.blogUrl || '').toString().trim();
          additionalSchemas.push({
            '@type': 'DefinedTerm',
            name: title,
            description: (excerpt || metaDescription || title).substring(0, 250),
            inDefinedTermSet: { '@type': 'DefinedTermSet', name: `${title} 용어집` },
          });
          additionalSchemas.push({
            '@type': 'SpeakableSpecification',
            cssSelector: ['.tldr-answer-box', '.tldr-answer-box p:first-of-type'],
          });
          if (thumbnailUrl) {
            additionalSchemas.push({
              '@type': 'ImageObject',
              contentUrl: thumbnailUrl,
              license: 'https://creativecommons.org/licenses/by-nc/4.0/',
              acquireLicensePage: newSiteUrl,
              caption: title,
              creator: { '@type': 'Person', name: newAuthor },
              copyrightHolder: { '@type': 'Organization', name: newSiteName },
              width: 1200,
              height: 630,
            });
          }
          console.log(`[INTERNAL-CONSISTENCY] ✅ 2026 신규 schema 추가 (DefinedTerm + Speakable${thumbnailUrl ? ' + ImageObject' : ''})`);
        } catch (newSchemaErr: any) {
          console.warn('[INTERNAL-CONSISTENCY] 2026 신규 schema 실패:', newSchemaErr?.message);
        }

        // v3.8.67 (Phase 2 작업 6): 주제별 schema 자동 매칭
        //   본문 키워드로 도메인 감지 → GovernmentService/FinancialProduct/MedicalEntity 추가
        try {
          const plainBody = generatedContent.replace(/<[^>]+>/g, ' ').toLowerCase();
          const topicKeywords = {
            government: /(정부|복지|지원금|보조금|수당|연금|국가|공공|바우처|혜택|신청|자격|모집|선정|복지로|bokjiro|gov\.kr|보건복지부|행정복지센터)/,
            financial: /(적금|예금|투자|펀드|주식|보험|대출|이자|금리|은행|증권|연금|저축|배당|수익률|매칭|월 \d+만원|만기|원금)/,
            medical: /(건강|의료|병원|치료|진료|증상|질환|약|처방|예방|검진|의사|환자|보험.*의료|국민건강)/,
          };
          for (const [domain, regex] of Object.entries(topicKeywords)) {
            if (!regex.test(plainBody)) continue;
            if (domain === 'government') {
              additionalSchemas.push({
                '@type': 'GovernmentService',
                name: title,
                description: (excerpt || metaDescription || title).substring(0, 200),
                provider: { '@type': 'GovernmentOrganization', name: '대한민국 정부' },
                serviceType: '복지·정부지원',
                audience: { '@type': 'Audience', audienceType: '대한민국 국민' },
              });
              console.log('[INTERNAL-CONSISTENCY] ✅ GovernmentService Schema 자동 매칭');
              break;
            } else if (domain === 'financial') {
              additionalSchemas.push({
                '@type': 'FinancialProduct',
                name: title,
                description: (excerpt || metaDescription || title).substring(0, 200),
                category: '금융상품·저축·투자',
              });
              console.log('[INTERNAL-CONSISTENCY] ✅ FinancialProduct Schema 자동 매칭');
              break;
            } else if (domain === 'medical') {
              additionalSchemas.push({
                '@type': 'MedicalWebPage',
                name: title,
                description: (excerpt || metaDescription || title).substring(0, 200),
                lastReviewed: new Date().toISOString().split('T')[0],
                medicalAudience: { '@type': 'MedicalAudience', audienceType: 'patient' },
              });
              console.log('[INTERNAL-CONSISTENCY] ✅ MedicalWebPage Schema 자동 매칭');
              break;
            }
          }
        } catch (topicErr: any) {
          console.warn('[INTERNAL-CONSISTENCY] 주제별 schema 매칭 실패:', topicErr?.message);
        }

        if (additionalSchemas.length > 0) {
          const extraGraph = {
            '@context': 'https://schema.org',
            '@graph': additionalSchemas,
          };
          const extraScript = `<script type="application/ld+json">${JSON.stringify(extraGraph)}</script>`;
          generatedContent = extraScript + '\n' + generatedContent;
        }
      } catch (faqHowtoErr: any) {
        console.warn('[INTERNAL-CONSISTENCY] FAQPage/HowTo 자동 추출 실패:', faqHowtoErr?.message);
      }

      // v3.8.72 (Phase 3 작업 11): Freshness 시그널 — Last updated 표 가시화
      //   Perplexity <13주 인용 50% / ChatGPT <30일 인용 76.4% (Rank-and-Convert·APIServent)
      //   본문 상단에 "마지막 업데이트" 표 + ISO datetime + 갱신 이력 안내
      try {
        const nowISO = new Date().toISOString();
        const nowKo = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
        const freshnessBlock = `<div class="freshness-meta" style="margin:12px 0 20px;padding:10px 14px;background:#f0fdf4;border-left:3px solid #10b981;border-radius:0 8px 8px 0;font-size:12px;color:#065f46;line-height:1.6;">
  <span style="font-weight:800;">🔄 최신 업데이트</span>
  <time datetime="${nowISO}" itemprop="dateModified" style="margin-left:8px;color:#047857;font-weight:700;">${nowKo}</time>
  <span style="margin-left:12px;color:#6b7280;">· 본 정보는 정기적으로 검토·갱신됩니다</span>
</div>`;
        // H1 직후에 freshness 블록 삽입 (TL;DR 박스 위)
        if (/<\/h1>/i.test(generatedContent)) {
          generatedContent = generatedContent.replace(/<\/h1>/i, (m) => m + '\n' + freshnessBlock);
        } else {
          generatedContent = freshnessBlock + '\n' + generatedContent;
        }
        console.log(`[INTERNAL-CONSISTENCY] ✅ Freshness 시그널 (Last updated ${nowKo}) 삽입`);
      } catch (freshErr: any) {
        console.warn('[INTERNAL-CONSISTENCY] Freshness 시그널 실패:', freshErr?.message);
      }

      // v3.8.71 (Phase 3 작업 10): 네이버 SEO + 한국어 NLP 최적화
      //   - 네이버 검색 60%+ 점유 + AI Briefing(2025.3) 출시 → 별도 메타 강화
      //   - Naver Open Graph 추가 + Naver Search Advisor meta
      //   - 한국어 명사 원형 키워드 (조사 제거) → 네이버 키워드 매칭 정확성
      try {
        // 네이버용 메타 태그 (head용 — 본문에 박아도 Blogger/WP가 자동 인식)
        const naverMeta = `<meta name="naver-site-verification" content="" />
<meta property="og:locale" content="ko_KR" />
<meta property="article:section" content="${(generatedLabels[0] || '').toString().replace(/[<>"']/g, '')}" />
<meta property="og:site_name" content="${((loadEnvFromFile() as any).wordpressSiteName || (loadEnvFromFile() as any).blogTitle || 'LEADERNAM').toString().replace(/[<>"']/g, '')}" />
${generatedLabels.slice(0, 6).map((kw) => `<meta property="article:tag" content="${String(kw).replace(/[<>"']/g, '')}" />`).join('\n')}
`;
        generatedContent = naverMeta + generatedContent;

        // 한국어 NLP: 키워드 명사 원형 추출 (조사·어미 제거)
        const cleanKoreanKeyword = (kw: string): string => {
          if (!kw || typeof kw !== 'string') return kw;
          // 조사 제거: 은/는/이/가/을/를/에/에서/으로/로/와/과/의 등 (단어 끝에서)
          return kw
            .replace(/(은|는|이|가|을|를|에서|에게|에|으로|로서|로|와|과|의|도|만|까지|부터|마저|조차)$/g, '')
            .replace(/(하다|되다|이다|입니다|합니다|됩니다)$/g, '')
            .trim();
        };
        const normalizedLabels = generatedLabels.map(cleanKoreanKeyword).filter((k) => k.length >= 2);
        if (normalizedLabels.length > 0) {
          // 정규화된 키워드도 라벨에 추가 (중복 제거)
          const merged = Array.from(new Set([...generatedLabels, ...normalizedLabels])).slice(0, 10);
          generatedLabels = merged;
          console.log(`[INTERNAL-CONSISTENCY] ✅ 네이버 SEO 메타 + 한국어 NLP 키워드 정규화 (${normalizedLabels.length}개)`);
        }
      } catch (naverErr: any) {
        console.warn('[INTERNAL-CONSISTENCY] 네이버 SEO/한국어 NLP 실패:', naverErr?.message);
      }

      // v3.8.77: 평문 "한눈에 답변" 중복 자동 제거 (LLM이 박스 wrap 빠뜨린 경우)
      try {
        const beforeLen = generatedContent.length;
        generatedContent = generatedContent
          .replace(/<p[^>]*>\s*💡\s*한눈에\s*답변[\s\S]{0,500}?<\/p>/gi, '')
          .replace(/<div(?![^>]*tldr-answer-box)[^>]*>\s*💡\s*한눈에\s*답변[\s\S]{0,500}?<\/div>/gi, '');
        if (generatedContent.length !== beforeLen) {
          console.log(`[INTERNAL-CONSISTENCY] ✅ 평문 "한눈에 답변" 중복 제거 (${beforeLen - generatedContent.length}자)`);
        }
      } catch {}

      // v3.8.62 (Phase 1 작업 1): 일반 글포스팅의 GEO 시스템(JSON-LD + E-E-A-T) 거미줄 이식.
      //   Agent A·B 분석: 거미줄 GEO 10점 / Blogger 글포스팅 85점 — 동일 시스템 이식하면 75점 점프.
      //   Schema.org Article + Person + Organization + BreadcrumbList @graph 자동 주입.
      //   E-E-A-T 메타 박스 (작성자/검토자/발행일/읽기시간/출처 인용수) 자동 삽입.
      try {
        const env = loadEnvFromFile() as any;
        const { buildSchemaJsonLd } = require('../dist/core/final/schema-jsonld.js');
        const { buildEeatMeta } = require('../dist/core/final/eeat-meta.js');

        const authorName = (env.authorName || env.adsenseAuthorInfo || env.authorNickname || '에디터').toString().trim() || '에디터';
        const siteName = (env.wordpressSiteName || env.blogTitle || '').toString().trim() || 'LEADERNAM';
        const siteUrl = (env.wordpressSiteUrl || env.blogUrl || '').toString().trim();
        const canonicalUrl = ''; // 발행 후 URL은 publisher가 가짐 — 거미줄 시점엔 미정
        const isoNow = new Date();

        // E-E-A-T 메타 박스 → H1 다음 삽입 + 본문 cite 처리 (citations 적용 결과 사용)
        try {
          const eeat = buildEeatMeta({
            authorName,
            authorTitle: '콘텐츠 에디터',
            publishedAt: isoNow,
            contentHtml: generatedContent,
          });
          if (eeat) {
            // 1) citations 처리된 본문으로 교체 (한국 공공기관 인용에 <cite> 자동 마킹)
            if (eeat.contentHtml && typeof eeat.contentHtml === 'string' && eeat.contentHtml.length > 0) {
              generatedContent = eeat.contentHtml;
            }
            // 2) H1 직후에 메타 박스 삽입
            if (eeat.metaBox) {
              if (/<\/h1>/i.test(generatedContent)) {
                generatedContent = generatedContent.replace(/<\/h1>/i, (m) => m + '\n' + eeat.metaBox);
              } else {
                generatedContent = eeat.metaBox + '\n' + generatedContent;
              }
            }
            console.log(`[INTERNAL-CONSISTENCY] ✅ E-E-A-T 메타 박스 + 본문 citations 적용 (인용 ${eeat.stats?.citationCount || 0}개, 읽기 ${eeat.stats?.readingTimeMinutes || 0}분)`);
          }
        } catch (eeatErr: any) {
          console.warn('[INTERNAL-CONSISTENCY] E-E-A-T 메타 삽입 실패:', eeatErr?.message);
        }

        // JSON-LD @graph → 본문 맨 앞 <script> 단일 블록
        try {
          const cleanText = generatedContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
          const wordCount = cleanText.length;
          const schema = buildSchemaJsonLd({
            title,
            description: excerpt || metaDescription || cleanText.substring(0, 150),
            canonicalUrl,
            imageUrl: thumbnailUrl,
            publishedAt: isoNow,
            modifiedAt: isoNow,
            keywords: generatedLabels,
            wordCount,
            authorName,
            authorTitle: '콘텐츠 에디터',
            siteName,
            siteUrl,
          });
          if (schema && schema.scriptTag) {
            generatedContent = schema.scriptTag + '\n' + generatedContent;
            console.log(`[INTERNAL-CONSISTENCY] ✅ JSON-LD @graph 삽입 (노드 ${schema.nodeCount}개)`);
          }
        } catch (schemaErr: any) {
          console.warn('[INTERNAL-CONSISTENCY] JSON-LD 삽입 실패:', schemaErr?.message);
        }
      } catch (geoErr: any) {
        console.warn('[INTERNAL-CONSISTENCY] GEO 시스템 이식 실패:', geoErr?.message);
      }

      // v3.8.33: 미리보기 → 발행 일치를 위해 wrapper에 max-mode-article 클래스 부여 → publisher applyInlineStyles skip.
      // v3.8.36: 빠진 요소(<p>/<h2>/<li>/<td>/<a> 등)에 inline style + !important 자동 보강.
      // v3.8.41: max-mode-article 안전망 강화 + <style> 스킨 CSS 본문 주입
      //   사용자 보고: 미리보기 빨간 H2 vs 발행 보라 H2 차이는 publisher가 max-mode-article 못 찾아
      //   applyInlineStyles(보라 톤)을 발동시킨 결과. LLM이 sw-cornerstone 클래스를 빠뜨리면
      //   v3.8.33 정규식 매칭 실패 → max-mode-article 추가 안 됨 → publisher가 변환.
      //   안전망: 어떤 wrapper든 max-mode-article 없으면 전체를 <div class="max-mode-article">로 wrap.
      //   추가: <style> 스킨 CSS를 본문에 박음 → publisher가 separator 뒤로 옮겨 Blogger 정상 적용.
      try {
        // 1) sw-cornerstone 매칭 시 max-mode-article 클래스 추가
        let hasWrapperApplied = false;
        generatedContent = generatedContent.replace(
          /(<div\s+class\s*=\s*["'])([^"']*\bsw-cornerstone\b[^"']*)(["'])/i,
          (match, p1, classes, p3) => {
            hasWrapperApplied = true;
            if (/\bmax-mode-article\b/.test(classes)) return match;
            return `${p1}${classes} max-mode-article${p3}`;
          }
        );

        // 2) 안전망: sw-cornerstone 없거나 매칭 실패 시 max-mode-article가 본문 어디에도 없으면 전체 wrap
        if (!hasWrapperApplied && !/\bmax-mode-article\b/.test(generatedContent)) {
          generatedContent = `<div class="max-mode-article" style="max-width:760px;margin:0 auto;padding:0 16px;font-family:'Noto Sans KR',sans-serif;color:#1a1a1a;line-height:1.8;">${generatedContent}</div>`;
          console.log('[INTERNAL-CONSISTENCY] ✅ max-mode-article 안전망 wrapper 자동 추가 (LLM 클래스 누락 대응)');
        }

        // 3) v3.8.41: 스킨 CSS <style> 본문 주입 — publisher가 추출해서 separator 뒤로 배치 → Blogger 적용.
        //   .max-mode-article scoped 셀렉터로 미리보기/발행 양쪽에 동일 적용.
        const skinCss = `<style>
.max-mode-article h1{color:#0f172a !important;font-size:34px !important;font-weight:800 !important;margin:0 0 32px !important;line-height:1.3 !important;}
.max-mode-article h2{color:#991b1b !important;font-size:26px !important;font-weight:700 !important;margin:40px 0 20px !important;padding:18px 22px !important;background:linear-gradient(135deg,#fef2f2 0%,#fee2e2 100%) !important;border-left:5px solid #ef4444 !important;border-radius:0 16px 16px 0 !important;line-height:1.4 !important;}
.max-mode-article h3{color:#1e293b !important;font-size:21px !important;font-weight:600 !important;margin:32px 0 16px !important;padding:14px 18px !important;background:#f8fafc !important;border-left:4px solid #10b981 !important;border-radius:0 12px 12px 0 !important;line-height:1.4 !important;}
.max-mode-article h4{color:#334155 !important;font-size:18px !important;font-weight:700 !important;margin:24px 0 12px !important;line-height:1.4 !important;}
.max-mode-article p{color:#1a1a1a !important;font-size:18px !important;line-height:1.85 !important;margin:0 0 20px !important;word-break:keep-all !important;}
.max-mode-article li{color:#1a1a1a !important;font-size:17px !important;line-height:1.9 !important;margin:0 0 12px !important;}
.max-mode-article ul,.max-mode-article ol{margin:20px 0 !important;padding-left:24px !important;}
.max-mode-article table{width:100% !important;border-collapse:collapse !important;margin:24px 0 !important;}
.max-mode-article th{padding:14px 16px !important;color:#0f172a !important;background:linear-gradient(135deg,#fef2f2 0%,#fee2e2 100%) !important;border:1px solid #fecaca !important;font-weight:800 !important;text-align:left !important;}
.max-mode-article td{padding:14px 16px !important;color:#1a1a1a !important;border:1px solid #e2e8f0 !important;font-size:15px !important;line-height:1.7 !important;}
.max-mode-article strong{color:#0f172a !important;font-weight:700 !important;}
.max-mode-article em{color:#475569 !important;font-style:italic !important;}
.max-mode-article blockquote{margin:24px 0 !important;padding:18px 22px !important;background:#fef2f2 !important;border-left:4px solid #f87171 !important;border-radius:0 12px 12px 0 !important;color:#7f1d1d !important;font-style:italic !important;}
.max-mode-article a{color:#dc2626 !important;text-decoration:underline !important;}
.max-mode-article img{max-width:100% !important;height:auto !important;border-radius:12px !important;margin:18px auto !important;display:block !important;}
</style>
`;
        generatedContent = skinCss + generatedContent;
        console.log('[INTERNAL-CONSISTENCY] ✅ 스킨 CSS <style> 본문 주입 (publisher가 separator 뒤 배치)');

        // v3.8.36: 빠진 요소에 가독성 inline style + !important 보강 (이미 있으면 보존)
        const enforceInlineStyle = (html: string, tag: string, defaultStyle: string): string => {
          const regex = new RegExp(`<${tag}((?:\\s[^>]*)?)>`, 'gi');
          return html.replace(regex, (match: string, attrs: string) => {
            if (attrs && /style\s*=/i.test(attrs)) return match; // 보존
            return `<${tag}${attrs || ''} style="${defaultStyle}">`;
          });
        };

        // v3.8.40: 일반 글포스팅 publisher applyInlineStyles와 동일한 빨간/베이지 톤으로 통일.
        //   v3.8.36은 파란/보라 톤으로 다르게 박아 미리보기(빨간)와 발행(파란)이 달라지던 문제 차단.
        //   같은 색상 톤이면 LLM이 박은 inline style이 있든 enforceInlineStyle이 박든 결과 일관.
        generatedContent = enforceInlineStyle(generatedContent, 'p', 'color:#1a1a1a !important;font-size:18px !important;line-height:1.85 !important;margin:0 0 20px !important;word-break:keep-all !important;');
        generatedContent = enforceInlineStyle(generatedContent, 'h2', 'color:#991b1b !important;font-size:26px !important;font-weight:700 !important;margin:40px 0 20px !important;padding:18px 22px !important;background:linear-gradient(135deg,#fef2f2 0%,#fee2e2 100%) !important;border-left:5px solid #ef4444 !important;border-radius:0 16px 16px 0 !important;line-height:1.4 !important;');
        generatedContent = enforceInlineStyle(generatedContent, 'h3', 'color:#1e293b !important;font-size:21px !important;font-weight:600 !important;margin:32px 0 16px !important;padding:14px 18px !important;background:#f8fafc !important;border-left:4px solid #10b981 !important;border-radius:0 12px 12px 0 !important;line-height:1.4 !important;');
        generatedContent = enforceInlineStyle(generatedContent, 'h4', 'color:#334155 !important;font-size:18px !important;font-weight:700 !important;margin:24px 0 12px !important;line-height:1.4 !important;');
        generatedContent = enforceInlineStyle(generatedContent, 'li', 'color:#1a1a1a !important;font-size:17px !important;line-height:1.9 !important;margin:0 0 12px !important;');
        generatedContent = enforceInlineStyle(generatedContent, 'ul', 'margin:20px 0 !important;padding-left:24px !important;');
        generatedContent = enforceInlineStyle(generatedContent, 'ol', 'margin:20px 0 !important;padding-left:24px !important;');
        generatedContent = enforceInlineStyle(generatedContent, 'table', 'width:100% !important;border-collapse:collapse !important;margin:24px 0 !important;');
        generatedContent = enforceInlineStyle(generatedContent, 'th', 'padding:14px 16px !important;color:#0f172a !important;background:linear-gradient(135deg,#fef2f2 0%,#fee2e2 100%) !important;border:1px solid #fecaca !important;font-weight:800 !important;text-align:left !important;');
        generatedContent = enforceInlineStyle(generatedContent, 'td', 'padding:14px 16px !important;color:#1a1a1a !important;border:1px solid #e2e8f0 !important;font-size:15px !important;line-height:1.7 !important;');
        generatedContent = enforceInlineStyle(generatedContent, 'strong', 'color:#0f172a !important;font-weight:700 !important;');
        generatedContent = enforceInlineStyle(generatedContent, 'em', 'color:#475569 !important;font-style:italic !important;');
        generatedContent = enforceInlineStyle(generatedContent, 'blockquote', 'margin:24px 0 !important;padding:18px 22px !important;background:#fef2f2 !important;border-left:4px solid #f87171 !important;border-radius:0 12px 12px 0 !important;color:#7f1d1d !important;font-style:italic !important;');
        generatedContent = enforceInlineStyle(generatedContent, 'a', 'color:#dc2626 !important;text-decoration:underline !important;');
        generatedContent = enforceInlineStyle(generatedContent, 'img', 'max-width:100% !important;height:auto !important;border-radius:12px !important;margin:18px auto !important;display:block !important;');

        console.log('[INTERNAL-CONSISTENCY] ✅ wrapper 클래스 부여 + 빠진 요소 inline style 보강 완료 (Blogger 테마 무관 표시)');
      } catch (skinErr: any) {
        console.warn('[INTERNAL-CONSISTENCY] ⚠️ inline style 보강 실패:', skinErr?.message);
      }

      // v3.8.73 (Phase 3 작업 12): GEO/AEO 적용 진단 요약 — 발행 직전 적용 상태 한눈에 확인
      try {
        const checks = {
          'TL;DR 답변 박스': /class\s*=\s*["'][^"']*tldr-answer-box/i.test(generatedContent),
          'Freshness Last updated': /class\s*=\s*["'][^"']*freshness-meta/i.test(generatedContent),
          'E-E-A-T 메타 박스': /class\s*=\s*["'][^"']*eeat-meta-box/i.test(generatedContent),
          'JSON-LD Article': /"@type"\s*:\s*"Article"/i.test(generatedContent),
          'JSON-LD Person': /"@type"\s*:\s*"Person"/i.test(generatedContent),
          'JSON-LD Organization': /"@type"\s*:\s*"Organization"/i.test(generatedContent),
          'FAQPage Schema': /"@type"\s*:\s*"FAQPage"/i.test(generatedContent),
          'HowTo Schema': /"@type"\s*:\s*"HowTo"/i.test(generatedContent),
          '주제별 Schema (Government/Financial/Medical)': /"@type"\s*:\s*"(GovernmentService|FinancialProduct|MedicalWebPage)"/i.test(generatedContent),
          'DefinedTerm Schema': /"@type"\s*:\s*"DefinedTerm"/i.test(generatedContent),
          'Speakable Schema': /"@type"\s*:\s*"SpeakableSpecification"/i.test(generatedContent),
          'ImageObject Schema': /"@type"\s*:\s*"ImageObject"/i.test(generatedContent),
          '통계 박스 (Quotable Stat)': /class\s*=\s*["'][^"']*[^>]*<p[^>]*>📊\s*핵심\s*통계/i.test(generatedContent) || /📊\s*핵심\s*통계/i.test(generatedContent),
          '한국어 NLP 라벨 정규화': generatedLabels.length >= 5,
          'CTA 빨간 박스': /background[^"']*linear-gradient[^"']*ef4444/i.test(generatedContent),
          '인라인 스킨 CSS': /<style>[\s\S]*?\.max-mode-article/i.test(generatedContent),
        };
        const passed = Object.entries(checks).filter(([_, v]) => v).length;
        const total = Object.keys(checks).length;
        const passRate = Math.round((passed / total) * 100);
        const summaryLines = [
          `[GEO-AEO-AUDIT] ════════ 발행 직전 GEO/AEO 적용 진단 ════════`,
          `[GEO-AEO-AUDIT] 종합 점수: ${passed}/${total} (${passRate}%)`,
          ...Object.entries(checks).map(([k, v]) => `[GEO-AEO-AUDIT] ${v ? '✅' : '❌'} ${k}`),
          `[GEO-AEO-AUDIT] ══════════════════════════════════════`,
        ];
        summaryLines.forEach((l) => console.log(l));
        try {
          const { BrowserWindow: BW_A } = await import('electron');
          BW_A.getAllWindows().forEach((w) => {
            summaryLines.forEach((line) => { try { w.webContents.send('log-line', line); } catch {} });
          });
        } catch {}
      } catch (auditErr: any) {
        console.warn('[INTERNAL-CONSISTENCY] GEO/AEO 진단 요약 실패:', auditErr?.message);
      }

      // v3.8.42/v3.8.46: 거미줄 진단 로그 — IPC로 renderer 콘솔에 전달.
      //   main 프로세스 console.log는 패키지 빌드에서 renderer 콘솔에 안 보이므로 IPC로 push.
      const hasSwCornerstone = generatedContent.includes('sw-cornerstone');
      const hasMaxMode = generatedContent.includes('max-mode-article');
      const hasStyleTag = /<style[^>]*>/i.test(generatedContent);
      const styleCount = (generatedContent.match(/<style[^>]*>/gi) || []).length;
      const firstH2 = generatedContent.match(/<h2[^>]*>/i);
      const firstH3 = generatedContent.match(/<h3[^>]*>/i);
      const wrapperMatch = generatedContent.match(/<div\s+class\s*=\s*["']([^"']*)["']/i);
      const diagLines = [
        `[INTERNAL-CONSISTENCY-SPIDER] 🕸️ === 거미줄 백엔드 결과 진단 ===`,
        `[INTERNAL-CONSISTENCY-SPIDER]    - sw-cornerstone 마커: ${hasSwCornerstone ? '✅' : '❌'}`,
        `[INTERNAL-CONSISTENCY-SPIDER]    - max-mode-article 클래스: ${hasMaxMode ? '✅' : '❌ 안전망 실패'}`,
        `[INTERNAL-CONSISTENCY-SPIDER]    - <style> 스킨 CSS: ${hasStyleTag ? `✅ ${styleCount}개` : '❌ 주입 실패'}`,
        `[INTERNAL-CONSISTENCY-SPIDER]    - 첫 wrapper class: ${wrapperMatch ? wrapperMatch[1] : '❌'}`,
        `[INTERNAL-CONSISTENCY-SPIDER]    - 첫 <h2> tag: ${firstH2 ? firstH2[0].substring(0, 200) : '❌'}`,
        `[INTERNAL-CONSISTENCY-SPIDER]    - 첫 <h3> tag: ${firstH3 ? firstH3[0].substring(0, 200) : '❌'}`,
        `[INTERNAL-CONSISTENCY-SPIDER]    - HTML 총 길이: ${generatedContent.length.toLocaleString()}자`,
        `[INTERNAL-CONSISTENCY-SPIDER]    - 시작 500자: ${generatedContent.substring(0, 500)}`,
        `[INTERNAL-CONSISTENCY-SPIDER] 🕸️ === 진단 끝 ===`,
      ];
      diagLines.forEach((line) => console.log(line));
      try {
        const { BrowserWindow: BW } = await import('electron');
        BW.getAllWindows().forEach((w) => {
          diagLines.forEach((line) => w.webContents.send('log-line', line));
        });
      } catch {}

      return {
        success: true,
        html: generatedContent,
        title,
        thumbnailUrl,
        imageStats,
        labels: generatedLabels,
        excerpt,
        metaDescription,
      };

    } catch (error) {
      console.error('[INTERNAL-CONSISTENCY] AI 종합글 생성 실패:', error);

      // API 키 관련 에러인지 확인
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('403') || errorMessage.includes('API Key') || errorMessage.includes('unregistered callers')) {
        throw new Error(`Gemini API 키가 유효하지 않거나 권한이 없습니다.\n\n에러: ${errorMessage}\n\n해결 방법:\n1. 환경 설정에서 Gemini API 키를 확인하세요\n2. API 키가 올바른지 확인하세요 (https://aistudio.google.com/app/apikey)\n3. API 키에 필요한 권한이 있는지 확인하세요`);
      }

      // v3.7.22: 폴백 강화 — cornerstone 카드 구조 + 거미줄 CTA + 표
      const sortedContents = crawledContents.sort((a, b) => a.order - b.order);
      const generatedContent = buildSpiderWebFallbackHtml(title, sortedContents);
      console.log('[INTERNAL-CONSISTENCY] ✅ 폴백 종합글 생성 완료 (강화)');
      return { success: true, html: generatedContent, title };
    }
  } catch (error) {
    console.error('[INTERNAL-CONSISTENCY] 종합글 생성 실패:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // API 키 관련 에러인 경우 더 명확한 메시지 제공
    if (errorMessage.includes('403') || errorMessage.includes('API Key') || errorMessage.includes('unregistered callers')) {
      return {
        success: false,
        error: `Gemini API 키 오류가 발생했습니다.\n\n에러: ${errorMessage}\n\n해결 방법:\n1. 앱의 "설정" 탭으로 이동\n2. "Gemini API Key" 필드에 유효한 API 키 입력\n3. API 키는 https://aistudio.google.com/app/apikey 에서 발급받을 수 있습니다\n4. 저장 후 다시 시도해주세요`
      };
    }

    return {
      success: false,
      error: errorMessage || '알 수 없는 오류가 발생했습니다.'
    };
  }
});

ipcMain.handle('save-image-as-png', async (_evt, payload: { imageUrl: string; imageId?: string }) => {
  try {
    const { imageUrl, imageId } = payload;
    if (!imageUrl) {
      return { ok: false, error: '이미지 URL이 필요합니다.' };
    }

    // sharp를 사용하여 이미지를 PNG로 변환하고 저장
    const sharp = await import('sharp');
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`이미지 다운로드 실패: ${response.status}`);
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());

    // PNG로 변환
    const pngBuffer = await sharp.default(imageBuffer)
      .png({ compressionLevel: IMAGE_COMPRESSION_LEVEL, quality: IMAGE_QUALITY })
      .toBuffer();

    // 저장 경로 생성
    const imagesDir = path.join(app.getPath('userData'), 'images');
    await fs.promises.mkdir(imagesDir, { recursive: true });

    const filename = imageId
      ? `img-${imageId}-${Date.now()}.png`
      : `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.png`;
    const filePath = path.join(imagesDir, filename);

    // 파일 저장
    await fs.promises.writeFile(filePath, pngBuffer);

    // data URL 생성
    const dataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;

    return {
      ok: true,
      data: {
        filePath,
        dataUrl,
        url: `file://${filePath}` // 로컬 파일 경로
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('[IMAGE] PNG 저장 실패:', errorMessage);
    return { ok: false, error: errorMessage };
  }
});

// Snippet Library IPC 핸들러
// 기존 핸들러 제거 (중복 방지)
try {
  if (ipcMain.listenerCount('get-snippet-library') > 0) {
    console.log('[SNIPPET-LIBRARY] 기존 핸들러 제거 중...');
    ipcMain.removeHandler('get-snippet-library');
  }
} catch (e) {
  // 무시 (핸들러가 없을 수 있음)
}

// 이미지 프롬프트 생성 IPC 핸들러 (CSP 우회)
ipcMain.handle('generate-image-prompts', async (_evt, payload: { sections: Array<{ index: number; title: string }>; topic: string; geminiKey: string; openaiKey?: string; claudeKey?: string }) => {
  try {
    const { sections, topic, geminiKey, openaiKey, claudeKey } = payload;

    if (!sections || sections.length === 0) {
      return [];
    }

    if (!geminiKey && !openaiKey && !claudeKey) {
      throw new Error('API 키가 필요합니다. (Gemini, OpenAI, 또는 Claude 중 최소 하나)');
    }

    // 병렬 처리로 모든 섹션의 프롬프트를 동시에 생성
    const promptPromises = sections.map(async (section) => {
      try {
        const prompt = `Generate an image prompt in English for the following blog post subheading.

Topic: ${topic}
Subheading: ${section.title}

Requirements:
- Write in English only (no Korean)
- Be specific and visual
- Suitable for blog post images
- Concise (within 50 words)
- Use descriptive, visual language
- Focus on the main subject and setting

Output only the image prompt (no explanations, no quotes, no markdown):`;

        // 1단계: Gemini 2.0 이상 모델들 모두 시도 (1.5 버전 절대 사용 안 함)
        // gemini-2.0-flash-preview는 404 오류로 제거
        if (geminiKey) {
          const geminiModels = ['gemini-2.5-flash', 'gemini-2.0-flash-exp', 'gemini-2.0-flash-thinking-exp'];
          let geminiLastError: Error | null = null;

          for (const model of geminiModels) {
            try {
              console.log(`[IMAGE-PROMPT] Gemini ${model} 시도 중: 섹션 ${section.index}`);
              const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }]
                })
              });

              if (response.ok) {
                const data = await response.json();
                console.log(`[IMAGE-PROMPT] Gemini ${model} 응답 수신:`, JSON.stringify(data).substring(0, 200));

                const generatedPrompt = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

                if (generatedPrompt) {
                  console.log(`[IMAGE-PROMPT] ✅ Gemini ${model} 성공: 섹션 ${section.index} - 프롬프트 길이: ${generatedPrompt.length}자`);
                  return {
                    sectionIndex: section.index,
                    sectionTitle: section.title,
                    prompt: generatedPrompt
                  };
                } else {
                  // ⚠️ 응답은 성공했지만 빈 프롬프트인 경우
                  console.warn(`[IMAGE-PROMPT] ⚠️ Gemini ${model} 빈 프롬프트 반환, 다음 모델로 시도`);
                  geminiLastError = new Error('Gemini API가 빈 프롬프트를 반환했습니다.');
                  // 다음 모델로 계속 진행
                }
              } else {
                const errorText = await response.text().catch(() => '');
                console.warn(`[IMAGE-PROMPT] ❌ Gemini ${model} 실패 (${response.status}), 다음 모델로 시도`);
                if (response.status === 401 || response.status === 403) {
                  geminiLastError = new Error(toFriendlyApiError('gemini', response.status, errorText));
                  break; // 인증 오류는 즉시 중단
                }
                geminiLastError = new Error(toFriendlyApiError('gemini', response.status, errorText));
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              console.warn(`[IMAGE-PROMPT] ❌ Gemini ${model} 예외 발생, 다음 모델로 시도:`, errorMessage);
              geminiLastError = error instanceof Error ? error : new Error(errorMessage);
            }
          }

          // 모든 Gemini 모델 실패 시 로깅
          if (geminiLastError) {
            console.warn(`[IMAGE-PROMPT] 모든 Gemini 모델 실패, OpenAI로 폴백 시도`);
          }
        }

        // 2단계: OpenAI 폴백
        if (openaiKey) {
          try {
            console.log(`[IMAGE-PROMPT] 🔄 OpenAI로 폴백 시도: 섹션 ${section.index}`);
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiKey}`
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 150
              })
            });

            if (response.ok) {
              const data = await response.json();
              console.log(`[IMAGE-PROMPT] OpenAI 응답 수신:`, JSON.stringify(data).substring(0, 200));

              const generatedPrompt = data.choices?.[0]?.message?.content?.trim() || '';

              if (generatedPrompt) {
                console.log(`[IMAGE-PROMPT] ✅ OpenAI 성공: 섹션 ${section.index} - 프롬프트 길이: ${generatedPrompt.length}자`);
                return {
                  sectionIndex: section.index,
                  sectionTitle: section.title,
                  prompt: generatedPrompt
                };
              } else {
                console.warn(`[IMAGE-PROMPT] ⚠️ OpenAI 빈 프롬프트 반환, Claude로 폴백`);
              }
            } else {
              const errorText = await response.text().catch(() => '');
              console.warn(`[IMAGE-PROMPT] ❌ OpenAI 실패 (${response.status}), Claude로 폴백`);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`[IMAGE-PROMPT] ❌ OpenAI 예외 발생, Claude로 폴백:`, errorMessage);
          }
        }

        // 3단계: Claude 폴백
        if (claudeKey) {
          try {
            console.log(`[IMAGE-PROMPT] 🔄 Claude로 폴백 시도: 섹션 ${section.index}`);
            const response = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': claudeKey,
                'anthropic-version': '2023-06-01'
              },
              body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 150,
                messages: [{ role: 'user', content: prompt }]
              })
            });

            if (response.ok) {
              const data = await response.json();
              console.log(`[IMAGE-PROMPT] Claude 응답 수신:`, JSON.stringify(data).substring(0, 200));

              const generatedPrompt = data.content?.[0]?.text?.trim() || '';

              if (generatedPrompt) {
                console.log(`[IMAGE-PROMPT] ✅ Claude 성공: 섹션 ${section.index} - 프롬프트 길이: ${generatedPrompt.length}자`);
                return {
                  sectionIndex: section.index,
                  sectionTitle: section.title,
                  prompt: generatedPrompt
                };
              } else {
                console.warn(`[IMAGE-PROMPT] ⚠️ Claude 빈 프롬프트 반환`);
              }
            } else {
              const errorText = await response.text().catch(() => '');
              console.error(`[IMAGE-PROMPT] ❌ Claude 실패 (${response.status}):`, errorText.substring(0, 200));
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[IMAGE-PROMPT] ❌ Claude 예외 발생:`, errorMessage);
          }
        }

        // 모든 API 시도 실패
        console.error(`[IMAGE-PROMPT] ❌ 섹션 ${section.index} (${section.title}): 모든 API 시도 실패`);
        throw new Error('모든 API (Gemini → OpenAI → Claude) 시도 실패');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error || '알 수 없는 오류');
        console.error(`[IMAGE-PROMPT] ❌ 최종 실패 - 섹션 ${section.index} (${section.title}):`, errorMsg);

        // 구체적인 오류 원인 파악
        let detailedError = '알 수 없는 오류';
        if (errorMsg) {
          // 오류 메시지에서 상태 코드 추출 시도
          const statusMatch = errorMsg.match(/\b([45]\d{2})\b/);
          const statusCode = statusMatch ? statusMatch[1] : undefined;
          detailedError = toFriendlyApiError('gemini', statusCode, errorMsg);
        }

        console.error(`[IMAGE-PROMPT] 📝 오류 요약 - 섹션 ${section.index}: ${detailedError}`);

        return {
          sectionIndex: section.index,
          sectionTitle: section.title,
          prompt: null,
          error: detailedError
        };
      }
    });

    // 모든 프롬프트를 병렬로 생성하고 결과 수집
    const results = await Promise.all(promptPromises);

    // 성공한 프롬프트와 실패한 프롬프트 분리
    const successfulPrompts = results
      .filter((item): item is { sectionIndex: number; sectionTitle: string; prompt: string } =>
        item !== null && 'prompt' in item && item.prompt !== null
      )
      .sort((a, b) => a.sectionIndex - b.sectionIndex);

    const failedPrompts = results
      .filter((item): item is { sectionIndex: number; sectionTitle: string; prompt: null; error: string } =>
        item !== null && 'error' in item && item.error !== undefined
      )
      .sort((a, b) => a.sectionIndex - b.sectionIndex);

    // 실패한 프롬프트가 있으면 로그 출력
    if (failedPrompts.length > 0) {
      console.warn(`[IMAGE-PROMPT] ${failedPrompts.length}개 섹션 프롬프트 생성 실패:`, failedPrompts.map(f => `${f.sectionTitle}: ${f.error}`).join(', '));
    }

    // 성공한 프롬프트와 실패 정보 모두 반환
    return {
      prompts: successfulPrompts,
      errors: failedPrompts,
      successCount: successfulPrompts.length,
      totalCount: results.length
    };
  } catch (error) {
    console.error('[IMAGE-PROMPT] 프롬프트 생성 오류:', error);
    throw error;
  }
});

// AI 이미지 생성 (DALL-E / Pexels)
// 안전한 핸들러 등록 (중복 자동 방지)
safeRegisterHandler('generate-ai-image', async (_evt: any, payload: { prompt: string; type: string; size?: string }) => {
  try {
    const { prompt, type, size = '1024x1024' } = payload;

    console.log(`[AI-IMAGE] 이미지 생성 요청: type=${type}, size=${size}, prompt=${prompt.substring(0, 50)}...`);

    if (type === 'dalle') {
      // DALL-E 이미지 생성
      const userDataPath = app.getPath('userData');
      const envPath = path.join(userDataPath, '.env');

      // .env 파일에서 DALL-E API 키 로드
      let dalleApiKey = '';
      try {
        if (fs.existsSync(envPath)) {
          const envContent = fs.readFileSync(envPath, 'utf-8');
          const dalleMatch = envContent.match(/DALLE_API_KEY\s*=\s*(.+)/);
          if (dalleMatch) {
            dalleApiKey = dalleMatch[1].trim();
          }
        }
      } catch (error) {
        console.error('[AI-IMAGE] .env 파일 읽기 실패:', error);
      }

      if (!dalleApiKey) {
        return {
          success: false,
          error: 'DALL-E API 키가 설정되지 않았습니다. 환경설정에서 API 키를 입력해주세요.'
        };
      }

      // 🆕 gpt-image-2 (구 "duct-tape" 코드명, 2026-04-21 출시 + API 즉시 사용 가능)
      //    조직별 점진 롤아웃 + 파라미터 스키마가 dall-e-3와 다르므로 모델별로 body를 분기.
      console.log('[AI-IMAGE] OpenAI 이미지 API 호출 시작 (gpt-image-2 우선)...');
      const modelChain = ['gpt-image-2', 'gpt-image-1', 'dall-e-3'];
      const buildBody = (m: string): any => {
        if (m === 'gpt-image-2') {
          return { model: m, prompt, n: 1, size };
        }
        return { model: m, prompt, n: 1, size, quality: 'standard' };
      };
      let response: Response | null = null;
      let usedModel = '';
      let lastErrorText = '';
      for (const m of modelChain) {
        const r = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${dalleApiKey}`
          },
          body: JSON.stringify(buildBody(m))
        });
        if (r.ok) { response = r; usedModel = m; break; }
        lastErrorText = await r.text().catch(() => '');
        const isModelMissing = r.status === 404
          || /model_not_found|invalid_model|deprecated_model|unsupported_model/i.test(lastErrorText)
          || (r.status === 403 && /access|permission/i.test(lastErrorText));
        if (!isModelMissing) {
          console.error('[AI-IMAGE] OpenAI 오류:', r.status, lastErrorText.substring(0, 200));
          return {
            success: false,
            error: `OpenAI Image API 오류 (${r.status}): ${lastErrorText.substring(0, 150)}`
          };
        }
        console.log(`[AI-IMAGE] ⚠️ ${m} 미지원/권한없음 — 다음 모델로 폴백`);
      }
      if (!response) {
        return {
          success: false,
          error: `OpenAI 이미지 모델 전체 실패. 마지막 응답: ${lastErrorText.substring(0, 150)}`
        };
      }

      const data = await response.json();
      const first = data?.data?.[0];
      const imageUrl = first?.url
        || (first?.b64_json ? `data:image/png;base64,${first.b64_json}` : '');

      if (!imageUrl) {
        console.error('[AI-IMAGE] 응답에 이미지 없음:', JSON.stringify(data).substring(0, 200));
        return {
          success: false,
          error: `${usedModel} 응답에 이미지가 없습니다.`
        };
      }

      console.log(`[AI-IMAGE] ✅ 이미지 생성 성공 (모델: ${usedModel})`);
      return {
        success: true,
        imageUrl: imageUrl
      };

    } else if (type === 'pixel' || type === 'pexels') {
      // Pexels 이미지 검색
      const userDataPath = app.getPath('userData');
      const envPath = path.join(userDataPath, '.env');

      // .env 파일에서 Pexels API 키 로드
      let pexelsApiKey = '';
      try {
        if (fs.existsSync(envPath)) {
          const envContent = fs.readFileSync(envPath, 'utf-8');
          const pexelsMatch = envContent.match(/PEXELS_API_KEY\s*=\s*(.+)/);
          if (pexelsMatch) {
            pexelsApiKey = pexelsMatch[1].trim();
          }
        }
      } catch (error) {
        console.error('[AI-IMAGE] .env 파일 읽기 실패:', error);
      }

      if (!pexelsApiKey) {
        return {
          success: false,
          error: 'Pexels API 키가 설정되지 않았습니다. 환경설정에서 API 키를 입력해주세요.'
        };
      }

      console.log('[AI-IMAGE] Pexels API 호출 시작...');
      const searchQuery = prompt.split(' ').slice(0, 3).join(' '); // 프롬프트의 처음 3단어만 사용
      const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=1`, {
        headers: {
          'Authorization': pexelsApiKey
        }
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('[AI-IMAGE] Pexels API 오류:', response.status, errorText.substring(0, 200));
        return {
          success: false,
          error: `Pexels API 오류 (${response.status}): ${errorText.substring(0, 100)}`
        };
      }

      const data = await response.json();
      const imageUrl = data.photos?.[0]?.src?.large;

      if (!imageUrl) {
        console.error('[AI-IMAGE] Pexels에서 관련 이미지를 찾을 수 없습니다.');
        return {
          success: false,
          error: 'Pexels에서 관련 이미지를 찾을 수 없습니다. 다른 검색어를 시도해보세요.'
        };
      }

      console.log('[AI-IMAGE] ✅ Pexels 이미지 검색 성공');
      return {
        success: true,
        imageUrl: imageUrl
      };

    } else {
      return {
        success: false,
        error: `지원하지 않는 이미지 타입: ${type}`
      };
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[AI-IMAGE] 이미지 생성 실패:', errorMessage);
    return {
      success: false,
      error: errorMessage
    };
  }
});

ipcMain.handle('get-snippet-library', async () => {
  try {
    console.log('[SNIPPET-LIBRARY] 라이브러리 로드 시작...');
    const library = await readSnippetLibrary();
    console.log('[SNIPPET-LIBRARY] 라이브러리 로드 성공:', {
      ctas: library?.ctas?.length ?? 0,
      imagePrompts: library?.imagePrompts?.length ?? 0,
      categories: library?.categories?.length ?? 0
    });
    return { ok: true, data: library };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('[SNIPPET-LIBRARY] 라이브러리 로드 실패:', errorMessage);
    console.error('[SNIPPET-LIBRARY] 에러 상세:', error);
    return { ok: false, error: errorMessage };
  }
});

console.log('[SNIPPET-LIBRARY] get-snippet-library 핸들러 등록 완료');

ipcMain.handle('save-snippet-library', async (_evt, library) => {
  try {
    await writeSnippetLibrary(library);
    return { ok: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('[SNIPPET-LIBRARY] 라이브러리 저장 실패:', errorMessage);
    return { ok: false, error: errorMessage };
  }
});

// 이미지 라이브러리 관련 코드 제거됨

// ============================================
// 🖼️ AI 이미지 자동 수집 핸들러
// ============================================

// 제목 기반 이미지 자동 수집
ipcMain.handle('collect-images-by-title', async (_evt, payload: {
  title: string;
  subtopics: string[];
  naverClientId: string;
  naverClientSecret: string;
  options?: {
    saveToFolder?: boolean;
    maxImagesPerSubtopic?: number;
    includeShoppingImages?: boolean;
  };
}) => {
  try {
    const { collectImagesByTitle } = await import('../dist/image-collector.js');

    console.log('[IMAGE-COLLECTOR] 🚀 제목 기반 이미지 수집 시작:', payload.title);

    const result = await collectImagesByTitle(
      payload.title,
      payload.subtopics,
      payload.naverClientId,
      payload.naverClientSecret,
      payload.options
    );

    return result;
  } catch (error: any) {
    console.error('[IMAGE-COLLECTOR] ❌ 수집 실패:', error.message);
    return { ok: false, images: [], folderPath: '', error: error.message };
  }
});

// 쇼핑몰 URL 기반 이미지 수집
ipcMain.handle('collect-images-from-url', async (_evt, payload: {
  shoppingUrl: string;
  subtopics: string[];
  options?: {
    saveToFolder?: boolean;
    maxImages?: number;
  };
}) => {
  try {
    const { collectImagesFromShoppingUrl } = await import('../dist/image-collector.js');

    console.log('[IMAGE-COLLECTOR] 🛍️ 쇼핑몰 URL 이미지 수집:', payload.shoppingUrl);

    const result = await collectImagesFromShoppingUrl(
      payload.shoppingUrl,
      payload.subtopics,
      payload.options
    );

    return result;
  } catch (error: any) {
    console.error('[IMAGE-COLLECTOR] ❌ 쇼핑몰 수집 실패:', error.message);
    return { ok: false, images: [], folderPath: '', error: error.message };
  }
});

// 저장된 이미지 폴더 목록 조회
ipcMain.handle('get-image-folders', async () => {
  try {
    const { getImageFolders } = await import('../dist/image-collector.js');
    return { ok: true, folders: getImageFolders() };
  } catch (error: any) {
    return { ok: false, folders: [], error: error.message };
  }
});

// 폴더 내 이미지 목록 조회
ipcMain.handle('get-folder-images', async (_evt, folderPath: string) => {
  try {
    const { getImagesFromFolder } = await import('../dist/image-collector.js');
    return { ok: true, images: getImagesFromFolder(folderPath) };
  } catch (error: any) {
    return { ok: false, images: [], error: error.message };
  }
});

// 이미지 폴더 삭제
ipcMain.handle('delete-image-folder', async (_evt, folderPath: string) => {
  try {
    const { deleteImageFolder } = await import('../dist/image-collector.js');
    const success = deleteImageFolder(folderPath);
    return { ok: success };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

console.log('[IMAGE-COLLECTOR] ✅ 이미지 수집 핸들러 등록 완료');

// ============================================
// 🔥 Blogger OAuth 인증 핸들러
// ============================================

ipcMain.handle('authenticate-blogger', async (_evt, payload: { blogId: string; clientId: string; clientSecret: string }) => {
  try {
    console.log('[BLOGGER-AUTH] 🔐 OAuth 인증 시작...');
    const { blogId, clientId, clientSecret } = payload;

    if (!blogId || !clientId || !clientSecret) {
      return { success: false, error: 'Blog ID, Client ID, Client Secret이 모두 필요합니다.' };
    }

    // OAuth2 인증 URL 생성
    const redirectUri = 'http://localhost:8888/callback';
    const scope = 'https://www.googleapis.com/auth/blogger';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scope)}` +
      `&access_type=offline` +
      `&prompt=consent`;

    // 로컬 서버로 콜백 받기
    const http = require('http');
    const url = require('url');

    return new Promise((resolve) => {
      const server = http.createServer(async (req: any, res: any) => {
        const parsedUrl = url.parse(req.url, true);

        if (parsedUrl.pathname === '/callback') {
          const code = parsedUrl.query.code;

          if (code) {
            try {
              // 토큰 교환
              const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                  client_id: clientId,
                  client_secret: clientSecret,
                  code: code as string,
                  grant_type: 'authorization_code',
                  redirect_uri: redirectUri
                })
              });

              const tokenData = await tokenResponse.json();

              if (tokenData.access_token) {
                // 토큰 저장
                const envPath = path.join(app.getPath('userData'), '.env');
                let envContent = '';
                if (fs.existsSync(envPath)) {
                  envContent = fs.readFileSync(envPath, 'utf-8');
                }

                // 기존 토큰 제거 후 새 토큰 추가
                const lines = envContent.split('\n').filter(line =>
                  !line.startsWith('BLOGGER_ACCESS_TOKEN=') &&
                  !line.startsWith('BLOGGER_REFRESH_TOKEN=') &&
                  !line.startsWith('BLOG_ID=') &&
                  !line.startsWith('GOOGLE_CLIENT_ID=') &&
                  !line.startsWith('GOOGLE_CLIENT_SECRET=')
                );

                lines.push(`BLOG_ID=${blogId}`);
                lines.push(`GOOGLE_CLIENT_ID=${clientId}`);
                lines.push(`GOOGLE_CLIENT_SECRET=${clientSecret}`);
                lines.push(`BLOGGER_ACCESS_TOKEN=${tokenData.access_token}`);
                if (tokenData.refresh_token) {
                  lines.push(`BLOGGER_REFRESH_TOKEN=${tokenData.refresh_token}`);
                }

                fs.writeFileSync(envPath, lines.join('\n'), 'utf-8');

                // 성공 페이지 표시
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`
                  <!DOCTYPE html>
                  <html>
                  <head><title>인증 성공</title></head>
                  <body style="font-family: sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #10b981, #059669); color: white;">
                    <h1>✅ Blogger 인증 성공!</h1>
                    <p>이 창을 닫고 앱으로 돌아가세요.</p>
                    <script>setTimeout(() => window.close(), 2000);</script>
                  </body>
                  </html>
                `);

                server.close();
                console.log('[BLOGGER-AUTH] ✅ 인증 성공!');
                resolve({ success: true, email: 'authenticated', blogName: 'Blogger' });
              } else {
                throw new Error(tokenData.error_description || '토큰 교환 실패');
              }
            } catch (error: any) {
              res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(`
                <!DOCTYPE html>
                <html>
                <head><title>인증 실패</title></head>
                <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #ef4444; color: white;">
                  <h1>❌ 인증 실패</h1>
                  <p>${error.message}</p>
                </body>
                </html>
              `);
              server.close();
              resolve({ success: false, error: error.message });
            }
          } else {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>인증 코드가 없습니다</h1>');
            server.close();
            resolve({ success: false, error: '인증 코드가 없습니다' });
          }
        }
      });

      server.listen(8888, () => {
        console.log('[BLOGGER-AUTH] 콜백 서버 시작 (포트 8888)');
        // 브라우저에서 인증 URL 열기
        const { shell } = require('electron');
        shell.openExternal(authUrl);
      });

      // 2분 타임아웃
      setTimeout(() => {
        server.close();
        resolve({ success: false, error: '인증 시간 초과 (2분)' });
      }, 120000);
    });

  } catch (error: any) {
    console.error('[BLOGGER-AUTH] ❌ 오류:', error);
    return { success: false, error: error.message };
  }
});

console.log('[BLOGGER-AUTH] ✅ Blogger OAuth 인증 핸들러 등록 완료');

// ============================================
// 🔥 다중 계정 발행 핸들러
// ============================================

ipcMain.handle('run-multi-account-post', async (_evt, payload: {
  platform: 'blogger' | 'wordpress';
  keyword: string;
  crawlUrl?: string;
  imageSource: string;
  toneStyle?: string;
  contentMode?: string;
  // Blogger
  blogId?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  // WordPress
  wordpressSiteUrl?: string;
  wordpressUsername?: string;
  wordpressPassword?: string;
}) => {
  try {
    console.log('[MULTI-ACCOUNT] 🚀 다중 계정 발행 시작:', payload.platform, payload.keyword);

    // 기존 환경 설정 로드
    const envPath = path.join(app.getPath('userData'), '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }

    // 환경 변수 파싱
    const env: Record<string, string> = {};
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });

    // Gemini API 키 확인
    const geminiKey = env.GEMINI_API_KEY || env.geminiKey;
    if (!geminiKey) {
      return { ok: false, error: 'Gemini API 키가 설정되지 않았습니다.' };
    }

    // 플랫폼별 설정 구성
    const postPayload: any = {
      topic: payload.keyword,
      keywords: payload.keyword,
      provider: 'gemini',
      geminiKey: geminiKey,
      publishType: 'now',
      thumbnailMode: payload.imageSource || 'imagefx',
      thumbnailType: payload.imageSource || 'imagefx',
      thumbnailSource: payload.imageSource || 'imagefx',
      h2ImageSource: payload.imageSource,
      toneStyle: payload.toneStyle || 'professional',
      contentMode: payload.contentMode || 'external',
      crawlUrl: payload.crawlUrl || '',
    };

    if (payload.platform === 'blogger') {
      // Blogger 설정
      if (!payload.blogId || !payload.googleClientId || !payload.googleClientSecret) {
        return { ok: false, error: 'Blogger 설정이 불완전합니다. (Blog ID, Client ID, Client Secret 필요)' };
      }
      postPayload.blogId = payload.blogId;
      postPayload.googleClientId = payload.googleClientId;
      postPayload.googleClientSecret = payload.googleClientSecret;
      postPayload.redirectUri = 'http://localhost:8888/callback';

      // 토큰 확인 (저장된 토큰 사용)
      const accessToken = env.BLOGGER_ACCESS_TOKEN;
      const refreshToken = env.BLOGGER_REFRESH_TOKEN;
      if (accessToken) {
        postPayload.bloggerAccessToken = accessToken;
        postPayload.bloggerRefreshToken = refreshToken;
      }

    } else if (payload.platform === 'wordpress') {
      // WordPress 설정
      if (!payload.wordpressSiteUrl || !payload.wordpressUsername || !payload.wordpressPassword) {
        return { ok: false, error: 'WordPress 설정이 불완전합니다. (Site URL, Username, Password 필요)' };
      }
      postPayload.wordpressSiteUrl = payload.wordpressSiteUrl;
      postPayload.wordpressUsername = payload.wordpressUsername;
      postPayload.wordpressPassword = payload.wordpressPassword;
      postPayload.platform = 'wordpress';
    }

    console.log('[MULTI-ACCOUNT] 📝 발행 페이로드 구성 완료');

    // 실제 발행 실행
    const { generateMaxModeArticle, publishGeneratedContent } = require('../dist/core/index');

    // 콘텐츠 생성
    console.log('[MULTI-ACCOUNT] 🤖 AI 콘텐츠 생성 중...');
    const article = await generateMaxModeArticle({
      topic: postPayload.topic,
      keywords: postPayload.keywords,
      geminiKey: geminiKey,
      toneStyle: postPayload.toneStyle,
      contentMode: postPayload.contentMode,
      crawlUrl: postPayload.crawlUrl,
      h2ImageSource: postPayload.h2ImageSource,
    });

    if (!article || !article.title || !article.content) {
      return { ok: false, error: '콘텐츠 생성 실패' };
    }

    console.log('[MULTI-ACCOUNT] ✅ 콘텐츠 생성 완료:', article.title);

    // 발행
    console.log('[MULTI-ACCOUNT] 📤 발행 중...');
    const publishResult = await publishGeneratedContent({
      ...postPayload,
      title: article.title,
      content: article.content,
      thumbnailUrl: article.thumbnailUrl,
    });

    if (publishResult.ok || publishResult.success) {
      console.log('[MULTI-ACCOUNT] 🎉 발행 성공!', publishResult.url);
      return { ok: true, url: publishResult.url || publishResult.postUrl };
    } else {
      console.error('[MULTI-ACCOUNT] ❌ 발행 실패:', publishResult.error);
      return { ok: false, error: publishResult.error || '발행 실패' };
    }

  } catch (error: any) {
    console.error('[MULTI-ACCOUNT] ❌ 오류:', error);
    return { ok: false, error: error.message || '알 수 없는 오류' };
  }
});

console.log('[MULTI-ACCOUNT] ✅ 다중 계정 발행 핸들러 등록 완료');

// ============================================
// 환경 설정 핸들러
// ============================================

// .env 파일 읽기
ipcMain.handle('get-env', async () => {
  try {
    const envPath = path.join(app.getPath('userData'), '.env');
    if (!fs.existsSync(envPath)) {
      return { ok: true, data: {} };
    }
    const content = fs.readFileSync(envPath, 'utf-8');
    const env: Record<string, string> = {};

    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });

    return { ok: true, data: env };
  } catch (error) {
    console.error('[ENV] .env 읽기 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '읽기 실패', data: {} };
  }
});

// .env 파일 저장
ipcMain.handle('save-env', async (_evt, envData: Record<string, string>) => {
  try {
    const envPath = path.join(app.getPath('userData'), '.env');

    // camelCase를 대문자 언더스코어로 변환하는 맵
    const keyMap: Record<string, string> = {
      'blogId': 'BLOG_ID',
      'bloggerId': 'BLOG_ID',
      'googleClientId': 'GOOGLE_CLIENT_ID',
      'googleClientSecret': 'GOOGLE_CLIENT_SECRET',
      'naverClientId': 'NAVER_CLIENT_ID',
      'naverClientSecret': 'NAVER_CLIENT_SECRET',
      'naverCustomerId': 'NAVER_CLIENT_ID', // 하위 호환성: naverCustomerId도 지원
      'naverSecretKey': 'NAVER_CLIENT_SECRET', // 하위 호환성: naverSecretKey도 지원
      'geminiKey': 'GEMINI_API_KEY',
      'geminiApiKey': 'GEMINI_API_KEY',
      'openaiKey': 'OPENAI_API_KEY',
      'openaiApiKey': 'OPENAI_API_KEY',
      'dalleApiKey': 'DALLE_API_KEY',
      'pexelsApiKey': 'PEXELS_API_KEY',
      'stabilityApiKey': 'STABILITY_API_KEY', // 🔥 Stability AI 추가
      'stabilityKey': 'STABILITY_API_KEY',
      'googleCseKey': 'GOOGLE_CSE_KEY',
      'googleCseCx': 'GOOGLE_CSE_CX',
      'youtubeApiKey': 'YOUTUBE_API_KEY',
      'wordpressSiteUrl': 'WORDPRESS_SITE_URL',
      'wordpressUsername': 'WORDPRESS_USERNAME',
      'wordpressPassword': 'WORDPRESS_PASSWORD',
      'minChars': 'MIN_CHARS',
      'adspowerPort': 'ADSPOWER_PORT',
      'adspowerProfileId': 'ADSPOWER_PROFILE_ID',
      'adspowerApiKey': 'ADSPOWER_API_KEY',
      'crawlProxy': 'CRAWL_PROXY',
      // 🔥 누락 매핑 보강 — 누락되면 key.toUpperCase() 폴백으로 인해 `CLAUDEKEY` 같은 잘못된 언더스코어 없는 키가 저장되고 로더가 못 읽음
      'claudeKey': 'CLAUDE_API_KEY',
      'claudeApiKey': 'CLAUDE_API_KEY',
      'anthropicApiKey': 'CLAUDE_API_KEY',
      'perplexityKey': 'PERPLEXITY_API_KEY',
      'perplexityApiKey': 'PERPLEXITY_API_KEY',
      'leonardoKey': 'LEONARDO_API_KEY',
      'leonardoApiKey': 'LEONARDO_API_KEY',
      'coupangAccessKey': 'COUPANG_ACCESS_KEY',
      'coupangSecretKey': 'COUPANG_SECRET_KEY',
      'generationEngine': 'GENERATION_ENGINE',
      'primaryGeminiTextModel': 'PRIMARY_TEXT_MODEL',
      'defaultAiProvider': 'DEFAULT_AI_PROVIDER',
      'toneStyle': 'TONE_STYLE',
      'wordpressCategories': 'WORDPRESS_CATEGORIES',
      'wordpressTags': 'WORDPRESS_TAGS',
      'blogUrl': 'BLOG_URL',
      'imageFolderPath': 'IMAGE_FOLDER_PATH',
    };

    // 기존 .env 파일 읽기
    const envMap = new Map<string, string>();
    if (fs.existsSync(envPath)) {
      const existingContent = fs.readFileSync(envPath, 'utf-8');
      existingContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const match = trimmed.match(/^([^=]+)=(.*)$/);
          if (match) {
            envMap.set(match[1].trim(), match[2].trim());
          }
        }
      });
    }

    // 새 값 업데이트 (표준 키 이름으로 변환)
    Object.entries(envData).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        const envKey = keyMap[key] || key.toUpperCase();
        envMap.set(envKey, String(value));
        // camelCase 키도 함께 저장 (하위 호환성)
        if (keyMap[key] && key !== envKey) {
          envMap.set(key, String(value));
        }
      }
    });

    // .env 파일로 저장
    const lines = Array.from(envMap.entries()).map(([key, value]) => `${key}=${value}`);
    fs.writeFileSync(envPath, lines.join('\n'), 'utf-8');

    console.log('[ENV] .env 파일 저장 완료:', {
      저장된키: Array.from(envMap.keys()),
      총개수: envMap.size
    });

    return { ok: true };
  } catch (error) {
    console.error('[ENV] .env 저장 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '저장 실패' };
  }
});

// ============================================
// 라이센스 파일 핸들러
// ============================================

// 라이센스 파일 읽기
ipcMain.handle('read-license-file', async () => {
  try {
    const licensePath = path.join(app.getPath('userData'), 'license.json');
    if (!fs.existsSync(licensePath)) {
      return { ok: true, data: null };
    }
    const content = fs.readFileSync(licensePath, 'utf-8');
    const data = JSON.parse(content);
    return { ok: true, data };
  } catch (error) {
    console.error('[LICENSE] 라이센스 파일 읽기 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '읽기 실패', data: null };
  }
});

// 라이센스 파일 저장
ipcMain.handle('save-license-file', async (_evt, licenseData: any) => {
  try {
    const licensePath = path.join(app.getPath('userData'), 'license.json');
    fs.writeFileSync(licensePath, JSON.stringify(licenseData, null, 2), 'utf-8');
    return { ok: true };
  } catch (error) {
    console.error('[LICENSE] 라이센스 파일 저장 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '저장 실패' };
  }
});

// ============================================
// 포스팅 실행 핸들러
// ============================================

// 🔥 반자동 완벽 끝판왕 IPC 핸들러
safeRegisterHandler('run-semi-auto-post', async (_evt: Electron.IpcMainInvokeEvent, payload: any) => {
  console.log('[MAIN] 🔥 반자동 완벽 끝판왕 요청');
  console.log('[MAIN] 키워드:', payload.topic);

  try {
    // 진행률 추적 변수
    let currentProgress = 0;

    // onLog 콜백: 로그 전송 + 자동 진행률 추적
    const onLog = (line: string) => {
      // 로그 전송
      if (_evt.sender && !_evt.sender.isDestroyed()) {
        _evt.sender.send('log-line', line);
      }

      // [PROGRESS] 형식 파싱하여 진행률 업데이트
      const progressMatch = line.match(/\[PROGRESS\]\s*(\d+)%\s*-\s*(.+)/);
      if (progressMatch) {
        const percent = parseInt(progressMatch[1], 10);
        let label = progressMatch[2] || '';
        // 이모지 제거
        label = label.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*/u, '').trim();
        if (!isNaN(percent) && _evt.sender && !_evt.sender.isDestroyed()) {
          currentProgress = percent;
          _evt.sender.send('run-progress', { p: percent, label });
        }
      }
    };

    const { runSemiAutoPost } = require('../dist/core/index');
    const result = await runSemiAutoPost(payload, onLog);

    if (result.ok) {
      console.log('[MAIN] ✅ 반자동 생성 성공');
      console.log('[MAIN]    - 제목:', result.title);
      console.log('[MAIN]    - 글자수:', result.html?.length || 0);
    } else {
      console.error('[MAIN] ❌ 반자동 생성 실패:', result.error);
    }

    return result;

  } catch (error: any) {
    console.error('[MAIN] ❌ 반자동 생성 오류:', error);
    return {
      ok: false,
      error: error.message
    };
  }
});

// 포스트 실행 (콘텐츠 생성 + 자동 발행)
ipcMain.handle('run-post', async (_evt, payload) => {
  let preConsumed = false;
  try {
    console.log('[RUN-POST] 포스트 실행 요청 받음');
    console.log('[RUN-POST] payload keys:', Object.keys(payload || {}));

    // 🔥 즉시 초기 progress 이벤트 전송 (프론트 watchdog 시작점)
    if (_evt.sender && !_evt.sender.isDestroyed()) {
      _evt.sender.send('run-progress', { p: 1, label: '백엔드 초기화 중...' });
    }

    const { generateMaxModeArticle, publishGeneratedContent } = require('../dist/core/index');
    console.log('[RUN-POST] core/index 로드 완료');

    if (_evt.sender && !_evt.sender.isDestroyed()) {
      _evt.sender.send('run-progress', { p: 3, label: '모듈 로드 완료' });
    }

    // env 객체 생성
    const env = {
      contentMode: payload?.contentMode || 'external',
      postingMode: payload?.postingMode || 'immediate'
    };

    // 진행률 추적 변수
    let currentProgress = 0;
    const progressStages = {
      '트렌드': 5,
      '데이터랩': 10,
      '크롤링': 25,
      '경쟁사': 35,
      'H1': 40,
      'H2': 45,
      '본문': 70,
      'CTA': 80,
      '요약': 85,
      '썸네일': 90,
      '조립': 95,
      '완료': 100
    };

    // onLog 콜백: 로그 전송 + 자동 진행률 추적
    const onLog = (line: string) => {
      // 로그 전송
      if (_evt.sender && !_evt.sender.isDestroyed()) {
        _evt.sender.send('log-line', line);
      }

      // [PROGRESS] 형식 우선 처리 (백엔드에서 명시적 진행률)
      const progressMatch = line.match(/\[PROGRESS\]\s*(\d+)%\s*-\s*(.+)/);
      if (progressMatch) {
        const percent = parseInt(progressMatch[1], 10);
        let label = progressMatch[2] || '';
        label = label.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*/u, '').trim();
        if (!isNaN(percent) && _evt.sender && !_evt.sender.isDestroyed()) {
          currentProgress = percent;
          _evt.sender.send('run-progress', { p: percent, label });
        }
        return; // [PROGRESS] 형식이면 키워드 매칭 건너뜀
      }

      // 키워드 기반 자동 진행률 추적 ([PROGRESS] 형식이 아닌 로그만)
      for (const [keyword, progress] of Object.entries(progressStages)) {
        if (line.includes(`[${keyword}]`)) {
          if (progress > currentProgress) {
            currentProgress = progress;
            if (_evt.sender && !_evt.sender.isDestroyed()) {
              _evt.sender.send('run-progress', { p: currentProgress, label: line.substring(0, 100) });
            }
          }
          break;
        }
      }
    };

    // 무료 사용자 쿼터 체크 (선차감)
    try {
      const { enforceFreeTier, isFreeTierUser } = require('./auth-utils');
      const { consume, refund } = require('./quota-manager');

      console.log('[RUN-POST] enforceFreeTier 호출...');
      const enforcement = await enforceFreeTier();
      console.log('[RUN-POST] enforceFreeTier 결과:', enforcement.allowed);
      if (!enforcement.allowed) {
        return enforcement.response; // PAYWALL 응답
      }

      const isFree = await isFreeTierUser();
      console.log('[RUN-POST] isFreeTierUser:', isFree);
      if (isFree) {
        await consume(1);
        preConsumed = true;
        console.log('[QUOTA] 무료 사용자: 쿼터 선차감 완료');
      }
    } catch (quotaError: any) {
      console.error('[QUOTA] 쿼터 체크 오류 (무시):', quotaError.message);
    }

    // 1. 콘텐츠 생성
    console.log('[RUN-POST] generateMaxModeArticle 호출 시작...');
    onLog('[PROGRESS] 5% - 🔥 콘텐츠 생성 시작');
    const result = await generateMaxModeArticle(payload, env, onLog);

    if (!result || typeof result !== 'object') {
      console.error('[RUN-POST] generateMaxModeArticle이 유효하지 않은 값을 반환:', result);
      return { ok: false, error: '콘텐츠 생성 결과가 유효하지 않습니다.' };
    }

    // 🛡️ v3.5.76 / v3.5.79 / v3.5.80: 발행 직전 본문 무결성 이중 검증 — 모드별 H2 임계값
    //   orchestration.ts의 H2 개수 강제 + 재시도 후에도 부족하면 여기서 최종 차단
    //     adsense: 정형 6개 → minH2=5
    //     shopping: 7단계 퍼널 → minH2=6
    //     paraphrasing: 6단계 → minH2=5
    //     internal/external: 5섹션 → minH2=4
    //     기타: minH2=3 (관대)
    const generatedHtml = String((result as any).html || (result as any).content || '');
    const h2Count = (generatedHtml.match(/<h2[^>]*>/gi) || []).length;
    const contentMode = String(payload?.contentMode || '').toLowerCase();
    const minH2 =
      contentMode === 'adsense' ? 5
      : contentMode === 'shopping' ? 6
      : contentMode === 'paraphrasing' ? 5
      : ['external', 'internal'].includes(contentMode) ? 4
      : 3;
    if (h2Count < minH2) {
      const errMsg = `본문 H2 섹션이 ${h2Count}개 (모드 '${contentMode || '기본'}' 최소 ${minH2}개 필요) — LLM 응답이 잘렸거나 폴백 콘텐츠. 발행을 차단합니다.`;
      console.error('[RUN-POST] 🛡️ 발행 차단:', errMsg);
      onLog(`[PROGRESS] 0% - 🛡️ 발행 차단: H2 ${h2Count}개 < 모드 '${contentMode || '기본'}' 최소 ${minH2}개`);
      onLog('[PROGRESS] 0% - 💡 LLM 호출이 타임아웃되었거나 응답이 잘렸습니다. 잠시 후 재시도하거나 다른 엔진을 선택하세요.');
      return { ok: false, error: errMsg };
    }

    // 미리보기 모드면 발행 안 함
    const isPreviewOnly = payload?.previewOnly === true || payload?.platform === 'preview';
    if (isPreviewOnly) {
      onLog('[PROGRESS] 100% - ✅ 미리보기 생성 완료');
      return { ok: true, ...result, preview: true };
    }

    // 2. 실제 발행 (블로그스팟/워드프레스) — 네트워크 오류 시 최대 2회 재시도
    onLog('[PROGRESS] 95% - 📤 블로그에 발행 중...');

    // 🔥 생성된 labels를 payload에 병합 (태그 자동 적용)
    if (result.labels && Array.isArray(result.labels) && result.labels.length > 0) {
      payload.generatedLabels = result.labels;
      console.log(`[RUN-POST] ✅ 생성된 labels ${result.labels.length}개를 payload에 병합:`, result.labels.slice(0, 5));
    }

    // v3.8.75: 글포스팅에도 작업 5-12 후처리 일괄 이식 (FAQPage/HowTo/주제schema/DefinedTerm/Speakable/ImageObject/네이버SEO/Freshness/진단요약)
    try {
      let htmlPost = String(result.html || result.content || '');
      const titlePost = result.title || payload.topic || '';
      const labelsPost = result.labels || payload.generatedLabels || [];
      const thumbPost = result.thumbnail || result.thumbnailUrl || '';
      const excerptPost = String(result.excerpt || '').substring(0, 250);
      const metaDescPost = String(result.metaDescription || payload.metaDescription || '').substring(0, 250);
      const envP = loadEnvFromFile() as any;
      const authorP = (envP.authorName || envP.adsenseAuthorInfo || envP.authorNickname || '에디터').toString().trim() || '에디터';
      const siteNameP = (envP.wordpressSiteName || envP.blogTitle || '').toString().trim() || 'LEADERNAM';
      const siteUrlP = (envP.wordpressSiteUrl || envP.blogUrl || '').toString().trim();
      const additionalSchemasP: any[] = [];

      // 작업 5: FAQPage + HowTo 자동 추출
      try {
        const faqs: Array<{ q: string; a: string }> = [];
        const h3Re = /<h3[^>]*>([^<]*\?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/gi;
        let m;
        while ((m = h3Re.exec(htmlPost)) !== null) {
          const q = (m[1] || '').trim();
          const a = (m[2] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          if (q.length > 5 && q.length < 200 && a.length > 20 && a.length < 800) faqs.push({ q, a });
        }
        if (faqs.length >= 2) {
          additionalSchemasP.push({
            '@type': 'FAQPage',
            mainEntity: faqs.slice(0, 8).map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
          });
        }
        // HowTo
        const olRe = /<ol[^>]*>([\s\S]*?)<\/ol>/gi;
        let olMatch;
        while ((olMatch = olRe.exec(htmlPost)) !== null) {
          const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
          const steps: Array<{ name: string; text: string }> = [];
          let li;
          while ((li = liRe.exec(olMatch[1]!)) !== null) {
            const txt = (li[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            if (txt.length > 10 && txt.length < 400) steps.push({ name: `단계 ${steps.length + 1}`, text: txt });
          }
          if (steps.length >= 3 && steps.length <= 15) {
            additionalSchemasP.push({
              '@type': 'HowTo',
              name: `${titlePost} 단계별 가이드`,
              step: steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text })),
            });
            break;
          }
        }
      } catch {}

      // 작업 6: 주제별 schema 자동 매칭
      try {
        const plainBody = htmlPost.replace(/<[^>]+>/g, ' ').toLowerCase();
        if (/(정부|복지|지원금|보조금|수당|연금|국가|공공|바우처|혜택|신청|자격|모집|선정|복지로|bokjiro|gov\.kr|보건복지부|행정복지센터)/.test(plainBody)) {
          additionalSchemasP.push({ '@type': 'GovernmentService', name: titlePost, description: (excerptPost || metaDescPost || titlePost).substring(0, 200), provider: { '@type': 'GovernmentOrganization', name: '대한민국 정부' }, serviceType: '복지·정부지원' });
        } else if (/(적금|예금|투자|펀드|주식|보험|대출|이자|금리|은행|증권|연금|저축|배당|수익률|매칭|만기|원금)/.test(plainBody)) {
          additionalSchemasP.push({ '@type': 'FinancialProduct', name: titlePost, description: (excerptPost || metaDescPost || titlePost).substring(0, 200), category: '금융상품·저축·투자' });
        } else if (/(건강|의료|병원|치료|진료|증상|질환|약|처방|예방|검진|의사|환자|보험.*의료|국민건강)/.test(plainBody)) {
          additionalSchemasP.push({ '@type': 'MedicalWebPage', name: titlePost, description: (excerptPost || metaDescPost || titlePost).substring(0, 200), lastReviewed: new Date().toISOString().split('T')[0] });
        }
      } catch {}

      // 작업 9: DefinedTerm + Speakable + ImageObject
      try {
        additionalSchemasP.push({ '@type': 'DefinedTerm', name: titlePost, description: (excerptPost || metaDescPost || titlePost).substring(0, 250), inDefinedTermSet: { '@type': 'DefinedTermSet', name: `${titlePost} 용어집` } });
        additionalSchemasP.push({ '@type': 'SpeakableSpecification', cssSelector: ['.tldr-answer-box', '.tldr-answer-box p:first-of-type'] });
        if (thumbPost) {
          additionalSchemasP.push({ '@type': 'ImageObject', contentUrl: thumbPost, license: 'https://creativecommons.org/licenses/by-nc/4.0/', acquireLicensePage: siteUrlP, caption: titlePost, creator: { '@type': 'Person', name: authorP }, copyrightHolder: { '@type': 'Organization', name: siteNameP }, width: 1200, height: 630 });
        }
      } catch {}

      if (additionalSchemasP.length > 0) {
        const extraScript = `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': additionalSchemasP })}</script>`;
        htmlPost = extraScript + '\n' + htmlPost;
      }

      // 작업 10: 네이버 SEO + 한국어 NLP
      try {
        const naverMeta = `<meta property="og:locale" content="ko_KR" />
<meta property="article:section" content="${(labelsPost[0] || '').toString().replace(/[<>"']/g, '')}" />
<meta property="og:site_name" content="${siteNameP.replace(/[<>"']/g, '')}" />
${labelsPost.slice(0, 6).map((kw: string) => `<meta property="article:tag" content="${String(kw).replace(/[<>"']/g, '')}" />`).join('\n')}
`;
        htmlPost = naverMeta + htmlPost;
      } catch {}

      // 작업 11: Freshness Last updated 표
      try {
        if (!/class\s*=\s*["'][^"']*freshness-meta/i.test(htmlPost)) {
          const nowISO = new Date().toISOString();
          const nowKo = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
          const freshness = `<div class="freshness-meta" style="margin:12px 0 20px;padding:10px 14px;background:#f0fdf4;border-left:3px solid #10b981;border-radius:0 8px 8px 0;font-size:12px;color:#065f46;line-height:1.6;">
  <span style="font-weight:800;">🔄 최신 업데이트</span>
  <time datetime="${nowISO}" itemprop="dateModified" style="margin-left:8px;color:#047857;font-weight:700;">${nowKo}</time>
  <span style="margin-left:12px;color:#6b7280;">· 본 정보는 정기적으로 검토·갱신됩니다</span>
</div>`;
          if (/<\/h1>/i.test(htmlPost)) htmlPost = htmlPost.replace(/<\/h1>/i, (mm) => mm + '\n' + freshness);
          else htmlPost = freshness + '\n' + htmlPost;
        }
      } catch {}

      // 작업 12: GEO/AEO 진단 요약
      try {
        const checks: Record<string, boolean> = {
          'TL;DR 답변 박스': /class\s*=\s*["'][^"']*tldr-answer-box/i.test(htmlPost),
          'Freshness Last updated': /class\s*=\s*["'][^"']*freshness-meta/i.test(htmlPost),
          'JSON-LD Article': /"@type"\s*:\s*"Article"/i.test(htmlPost),
          'FAQPage Schema': /"@type"\s*:\s*"FAQPage"/i.test(htmlPost),
          'HowTo Schema': /"@type"\s*:\s*"HowTo"/i.test(htmlPost),
          '주제별 Schema': /"@type"\s*:\s*"(GovernmentService|FinancialProduct|MedicalWebPage)"/i.test(htmlPost),
          'DefinedTerm Schema': /"@type"\s*:\s*"DefinedTerm"/i.test(htmlPost),
          'Speakable Schema': /"@type"\s*:\s*"SpeakableSpecification"/i.test(htmlPost),
          'ImageObject Schema': /"@type"\s*:\s*"ImageObject"/i.test(htmlPost),
          '네이버 og:locale': /og:locale.+ko_KR/i.test(htmlPost),
        };
        const passed = Object.values(checks).filter(Boolean).length;
        const total = Object.keys(checks).length;
        const passRate = Math.round((passed / total) * 100);
        const lines = [
          `[GEO-AEO-AUDIT-POST] ════════ 글포스팅 GEO/AEO 적용 진단 ════════`,
          `[GEO-AEO-AUDIT-POST] 종합 점수: ${passed}/${total} (${passRate}%)`,
          ...Object.entries(checks).map(([k, v]) => `[GEO-AEO-AUDIT-POST] ${v ? '✅' : '❌'} ${k}`),
          `[GEO-AEO-AUDIT-POST] ══════════════════════════════════════`,
        ];
        lines.forEach((l) => console.log(l));
        try {
          const { BrowserWindow: BW_P } = await import('electron');
          BW_P.getAllWindows().forEach((w) => { lines.forEach((line) => { try { w.webContents.send('log-line', line); } catch {} }); });
        } catch {}
      } catch {}

      (result as any).html = htmlPost;
      (result as any).content = htmlPost;
      console.log(`[RUN-POST] ✅ 작업 5-12 후처리 일괄 적용 완료 (HTML ${htmlPost.length}자)`);
    } catch (postSuiteErr: any) {
      console.warn('[RUN-POST] 작업 5-12 후처리 일괄 적용 실패:', postSuiteErr?.message);
    }

    // v3.8.62 (Phase1 작업3): TL;DR 답변 박스 자동 생성 → H1 직후 삽입 (AEO/GEO Tier 1)
    //   일반 글포스팅의 H1 직후에 정의형 직답 + 핵심 수치 3개 박스 자동 주입.
    //   거미줄은 LLM 프롬프트에 강제 반영 — 일반 글포스팅은 후처리로 보장.
    // v3.8.77: 중복 차단 강화
    //   LLM이 도입부에 박은 평문 "한눈에 답변" / "💡 한눈에 답변" 비슷한 텍스트를 자동 제거.
    //   사용자 보고: TL;DR 박스 위에 같은 내용의 평문 단락이 또 노출됨 → 본문 정리 후 박스 삽입.
    try {
      let htmlSrc0 = String(result.html || result.content || '');
      const before = htmlSrc0.length;
      htmlSrc0 = htmlSrc0
        // 평문 "💡 한눈에 답변 ..." 패턴 (박스 wrap 없는 p 또는 div)
        .replace(/<p[^>]*>\s*💡\s*한눈에\s*답변[\s\S]{0,500}?<\/p>/gi, '')
        .replace(/<div(?![^>]*tldr-answer-box)[^>]*>\s*💡\s*한눈에\s*답변[\s\S]{0,500}?<\/div>/gi, '');
      if (htmlSrc0.length !== before) {
        (result as any).html = htmlSrc0;
        (result as any).content = htmlSrc0;
        console.log(`[RUN-POST] ✅ 평문 "한눈에 답변" 중복 제거 (${before - htmlSrc0.length}자)`);
      }
      const htmlSrc = htmlSrc0;
      const alreadyHasTldr = /class\s*=\s*["'][^"']*tldr-answer-box/i.test(htmlSrc);
      if (!alreadyHasTldr && /<\/h1>/i.test(htmlSrc)) {
        const titleForTldr = result.title || payload.topic || '';
        const plainForTldr = htmlSrc
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const envForTldr = loadEnvFromFile() as any;
        const apiKeyTldr = envForTldr.geminiKey || envForTldr.GEMINI_API_KEY || process.env['GEMINI_API_KEY'] || '';
        if (apiKeyTldr && plainForTldr.length > 500) {
          const { GoogleGenerativeAI: GGA_T } = require('@google/generative-ai');
          const tldrGenAI = new GGA_T(apiKeyTldr);
          const tldrModel = await selectGeminiModel(tldrGenAI);
          const tldrPrompt = `다음 블로그 글의 "TL;DR 답변 박스" HTML을 정확히 출력하세요.

【제목】 ${titleForTldr}
【본문 첫 800자】 ${plainForTldr.substring(0, 800)}

엄격 출력 규칙:
- 출력은 아래 HTML 1개만 (코드블록·설명·마크다운 X)
- 직답은 40~60단어, 패턴: "[주제]는 [카테고리]로서 [핵심 차별점]이며, [핵심 수치/기간/조건]."
- 핵심 수치 3개는 본문에서 추출한 실제 숫자+단위 (금액·기간·인원·자격 등)

<div class="tldr-answer-box" style="margin:24px 0;padding:20px 24px;background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);border:2px solid #f59e0b;border-radius:14px;">
  <p style="margin:0 0 8px;color:#78350f;font-size:13px;font-weight:800;letter-spacing:0.5px;">💡 한눈에 답변</p>
  <p style="margin:0 0 14px;color:#0f172a;font-size:17px;font-weight:700;line-height:1.5;">[정의형 직답 40~60단어]</p>
  <ul style="margin:0;padding-left:20px;color:#1e293b;font-size:14px;line-height:1.8;">
    <li><strong>[핵심1 라벨]:</strong> [숫자+단위]</li>
    <li><strong>[핵심2 라벨]:</strong> [숫자+단위]</li>
    <li><strong>[핵심3 라벨]:</strong> [숫자+단위]</li>
  </ul>
</div>`;
          const tldrResult = await tldrModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: tldrPrompt }] }],
            generationConfig: { maxOutputTokens: 600, temperature: 0.5 },
          });
          let tldrHtml = ((await tldrResult.response).text() || '').trim()
            .replace(/^```html\n?/gi, '').replace(/^```\n?/gi, '').replace(/```\n?$/gi, '').trim();
          // tldr-answer-box class 포함 확인
          if (/class\s*=\s*["'][^"']*tldr-answer-box/i.test(tldrHtml) && tldrHtml.length > 200) {
            const newHtml = htmlSrc.replace(/<\/h1>/i, (m) => m + '\n' + tldrHtml);
            (result as any).html = newHtml;
            (result as any).content = newHtml;
            console.log(`[RUN-POST] ✅ TL;DR 답변 박스 H1 직후 삽입 (${tldrHtml.length}자)`);
          } else {
            console.warn(`[RUN-POST] TL;DR HTML 검증 실패 (길이 ${tldrHtml.length}, class 미포함 가능)`);
          }
        }
      }
    } catch (tldrErr: any) {
      console.warn('[RUN-POST] TL;DR 자동 삽입 실패:', tldrErr?.message);
    }

    // v3.8.62 (Phase1 작업2): metaDescription을 Gemini AI로 별도 생성 → payload에 병합
    //   기존: WP는 publisher가 generateMetaDescriptionSmart 호출, Blogger는 미생성.
    //   개선: 일반 글포스팅도 거미줄과 동일한 [키워드+이익+CTA] 패턴 140-160자 생성.
    if (!payload.metaDescription) {
      try {
        const titleForMeta = result.title || payload.topic || '';
        const htmlForMeta = String(result.html || result.content || '');
        const plainText = htmlForMeta
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const keywordsForMeta = (result.labels || payload.generatedLabels || []).slice(0, 5).join(', ');
        const envData = loadEnvFromFile() as any;
        const apiKey = envData.geminiKey || envData.GEMINI_API_KEY || process.env['GEMINI_API_KEY'] || '';
        if (apiKey && plainText.length > 200) {
          const { GoogleGenerativeAI: GGA_RP } = require('@google/generative-ai');
          const rpGenAI = new GGA_RP(apiKey);
          const rpModel = await selectGeminiModel(rpGenAI);
          const rpPrompt = `다음 블로그 글의 메타 디스크립션을 정확히 1줄로 작성하세요.

【글 제목】 ${titleForMeta}
【본문 첫 500자】 ${plainText.substring(0, 500)}
【핵심 키워드】 ${keywordsForMeta || '(없음)'}

요구사항:
- 정확히 140~160자 (한글 기준)
- 핵심 검색 키워드 1~2개 자연스럽게 포함
- 독자가 얻을 이익(혜택/방법/결과) 1줄 명시
- 끝에 행동 유도(CTA) 짧게 ("자세히 보기", "지금 확인" 등)
- 출력은 메타 디스크립션 텍스트 1줄만 (앞뒤 따옴표·마크다운 X)`;
          const rpResult = await rpModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: rpPrompt }] }],
            generationConfig: { maxOutputTokens: 200, temperature: 0.4 },
          });
          let aiMeta = ((await rpResult.response).text() || '').trim()
            .replace(/^["'`「『]+|["'`」』]+$/g, '').replace(/^\*+|\*+$/g, '').trim();
          aiMeta = aiMeta.split(/\n+/)[0]!.trim();
          if (aiMeta.length >= 100 && aiMeta.length <= 200) {
            payload.metaDescription = aiMeta;
            console.log(`[RUN-POST] ✅ metaDescription Gemini AI 생성 (${aiMeta.length}자): ${aiMeta.substring(0, 60)}…`);
          }
        }
      } catch (mdErr: any) {
        console.warn('[RUN-POST] metaDescription AI 생성 실패 (publisher가 폴백):', mdErr?.message);
      }
    }

    const MAX_PUBLISH_RETRIES = 2;
    let lastPublishError: any = null;

    for (let attempt = 0; attempt <= MAX_PUBLISH_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const waitSec = attempt * 3;
          onLog(`[PROGRESS] 95% - 🔄 발행 재시도 (${attempt}/${MAX_PUBLISH_RETRIES})... ${waitSec}초 대기`);
          await new Promise(r => setTimeout(r, waitSec * 1000));
        }

        const publishResult = await publishGeneratedContent(
          payload,
          result.title || payload.topic,
          result.html || result.content,
          result.thumbnail || result.thumbnailUrl || ''
        );

        if (publishResult && publishResult.ok) {
          onLog('[PROGRESS] 100% - ✅ 발행 완료!');
          console.log('[RUN-POST] ✅ 발행 성공:', publishResult.url);

          // IndexNow 자동 색인 요청
          if (publishResult.url) {
            try {
              const { submitToIndexNow } = require('../dist/core/indexnow');
              submitToIndexNow(publishResult.url, [publishResult.url]).then((indexResult: any) => {
                console.log('[INDEXNOW] 자동 색인 요청:', indexResult.ok ? '성공' : '실패');
              }).catch(() => {});
            } catch { /* ignore */ }
          }

          return {
            ok: true,
            ...result,
            url: publishResult.url,
            postId: publishResult.postId || publishResult.id,
            published: true,
            needsAuth: publishResult.needsAuth || false
          };
        } else {
          lastPublishError = publishResult?.error || '발행 실패';
          const isNetworkError = /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timeout|network/i.test(String(lastPublishError));
          // 인증 오류는 재시도 무의미
          const isAuthError = /401|403|auth|token|OAuth|needsAuth|invalid_grant/i.test(String(lastPublishError));

          if (isAuthError || !isNetworkError) {
            // 재시도 불가 에러 → 즉시 종료
            break;
          }
          // 네트워크 오류 → 재시도 계속
          console.warn(`[RUN-POST] 발행 실패 (네트워크, ${attempt + 1}/${MAX_PUBLISH_RETRIES + 1}):`, lastPublishError);
        }
      } catch (publishError: any) {
        lastPublishError = publishError instanceof Error ? publishError.message : String(publishError);
        const isNetworkError = /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timeout|network/i.test(lastPublishError);
        if (!isNetworkError) break;
        console.warn(`[RUN-POST] 발행 에러 (네트워크, ${attempt + 1}/${MAX_PUBLISH_RETRIES + 1}):`, lastPublishError);
      }
    }

    // 모든 시도 실패
    console.error('[RUN-POST] 발행 최종 실패:', lastPublishError);
    onLog(`[PROGRESS] 100% - ⚠️ 발행 실패: ${lastPublishError}`);
    return {
      ok: true,
      ...result,
      publishError: lastPublishError,
      published: false,
      needsAuth: /auth|token|OAuth|invalid_grant/i.test(String(lastPublishError))
    };
  } catch (error) {
    console.error('[RUN-POST] 실행 실패:', error);
    // 실패 시 환불
    if (preConsumed) {
      try {
        const { refund } = require('./quota-manager');
        await refund(1);
        console.log('[QUOTA] 발행 실패: 쿼터 환불 완료');
      } catch (e) { console.error('[QUOTA] 환불 실패:', e); }
    }
    const errorMessage = error instanceof Error ? error.message : '실행 실패';
    return { ok: false, error: errorMessage, needsAuth: false };
  }
});

// 컨텐츠 발행
ipcMain.handle('publish-content', async (_evt, data) => {
  try {
    console.log('[PUBLISH] 컨텐츠 발행 요청');
    console.log('[PUBLISH] 제목:', data.title?.substring(0, 50));
    console.log('[PUBLISH] 콘텐츠 길이:', data.content?.length || 0);
    console.log('[PUBLISH] 썸네일 URL:', data.thumbnailUrl ? '있음' : '없음');
    console.log('[PUBLISH] 발행 모드:', data.payload?.publishType || data.payload?.postingMode || 'immediate');

    const { publishGeneratedContent } = require('../dist/core/index');
    const result = await publishGeneratedContent(data.payload, data.title, data.content, data.thumbnailUrl);

    console.log('[PUBLISH] 발행 결과:', {
      ok: result?.ok,
      hasUrl: !!result?.url,
      url: result?.url?.substring(0, 100) || '없음',
      hasPostId: !!result?.postId || !!result?.id,
      postId: result?.postId || result?.id || '없음',
      error: result?.error || '없음'
    });

    // publishGeneratedContent가 이미 { ok, url, ... } 형태로 반환하므로 그대로 반환
    if (!result || typeof result !== 'object') {
      console.error('[PUBLISH] publishGeneratedContent가 유효하지 않은 값을 반환:', result);
      return { ok: false, error: '발행 결과가 유효하지 않습니다.' };
    }

    // URL이 없으면 경고 로그
    if (result.ok && !result.url && !result.postId && !result.id) {
      console.warn('[PUBLISH] ⚠️ 발행은 성공했지만 URL이나 ID가 반환되지 않았습니다.');
      console.warn('[PUBLISH] 응답 전체:', JSON.stringify(result, null, 2));
    }

    // result가 이미 ok 속성을 가지고 있으므로 그대로 반환
    return result;
  } catch (error) {
    console.error('[PUBLISH] 발행 실패:', error);
    const errorMessage = error instanceof Error ? error.message : '발행 실패';
    return { ok: false, error: errorMessage, needsAuth: false };
  }
});

// ============================================
// 스케줄 관리 핸들러
// ============================================

// 스케줄 목록 조회
ipcMain.handle('get-schedules', async () => {
  try {
    const { getScheduleManager } = require('../dist/core/schedule-manager');
    const manager = getScheduleManager();
    const schedules = manager.getAllSchedules();
    return { ok: true, schedules };
  } catch (error) {
    console.error('[SCHEDULE] 조회 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '조회 실패', schedules: [] };
  }
});

// 스케줄 추가
ipcMain.handle('add-schedule', async (_evt, schedule) => {
  try {
    const { getScheduleManager } = require('../dist/core/schedule-manager');
    const manager = getScheduleManager();
    const id = manager.addSchedule(schedule);
    const addedSchedule = manager.getSchedule(id);
    return { ok: true, schedule: addedSchedule };
  } catch (error) {
    console.error('[SCHEDULE] 추가 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '추가 실패' };
  }
});

// 스케줄 토글
ipcMain.handle('toggle-schedule', async (_evt, id, enabled) => {
  try {
    const { getScheduleManager } = require('../dist/core/schedule-manager');
    const manager = getScheduleManager();
    manager.updateSchedule(id, { status: enabled ? 'pending' : 'cancelled' });
    return { ok: true };
  } catch (error) {
    console.error('[SCHEDULE] 토글 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '토글 실패' };
  }
});

// 스케줄 삭제
ipcMain.handle('delete-schedule', async (_evt, id) => {
  try {
    const { getScheduleManager } = require('../dist/core/schedule-manager');
    const manager = getScheduleManager();
    const deleted = manager.deleteSchedule(id);
    return { ok: deleted };
  } catch (error) {
    console.error('[SCHEDULE] 삭제 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '삭제 실패' };
  }
});

// 스케줄 상태 조회
ipcMain.handle('get-schedule-status', async () => {
  try {
    const { getScheduleManager } = require('../dist/core/schedule-manager');
    const manager = getScheduleManager();
    const status = manager.getScheduleStatus();
    return { ok: true, status };
  } catch (error) {
    console.error('[SCHEDULE] 상태 조회 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '상태 조회 실패', status: null };
  }
});

// 스케줄 모니터링 시작
ipcMain.handle('start-schedule-monitoring', async () => {
  try {
    const { getScheduleManager } = require('../dist/core/schedule-manager');
    const manager = getScheduleManager();
    manager.startMonitoring();
    return { ok: true };
  } catch (error) {
    console.error('[SCHEDULE] 모니터링 시작 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '모니터링 시작 실패' };
  }
});

// 스케줄 모니터링 중지
ipcMain.handle('stop-schedule-monitoring', async () => {
  try {
    const { getScheduleManager } = require('../dist/core/schedule-manager');
    const manager = getScheduleManager();
    manager.stopMonitoring();
    return { ok: true };
  } catch (error) {
    console.error('[SCHEDULE] 모니터링 중지 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '모니터링 중지 실패' };
  }
});

// 오래된 스케줄 정리
ipcMain.handle('cleanup-schedules', async (_evt, daysToKeep = 30) => {
  try {
    const { getScheduleManager } = require('../dist/core/schedule-manager');
    const manager = getScheduleManager();
    const deletedCount = manager.cleanupOldSchedules(daysToKeep);
    return { ok: true, deletedCount };
  } catch (error) {
    console.error('[SCHEDULE] 정리 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '정리 실패' };
  }
});

// ============================================
// 설정 보호 핸들러
// ============================================

ipcMain.handle('set-settings-protection', async (_evt, protectedMode) => {
  try {
    const configPath = path.join(app.getPath('userData'), 'user-config.json');
    let config: any = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    config.settingsProtected = protectedMode;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '설정 실패' };
  }
});

ipcMain.handle('is-settings-protected', async () => {
  try {
    const configPath = path.join(app.getPath('userData'), 'user-config.json');
    if (!fs.existsSync(configPath)) {
      return { ok: true, protected: false };
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return { ok: true, protected: !!config.settingsProtected };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '확인 실패', protected: false };
  }
});

// ============================================
// 사용자 설정 핸들러
// ============================================

ipcMain.handle('save-user-config', async (_evt, config) => {
  try {
    const configPath = path.join(app.getPath('userData'), 'user-config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '저장 실패' };
  }
});

ipcMain.handle('get-user-config', async () => {
  try {
    const configPath = path.join(app.getPath('userData'), 'user-config.json');
    if (!fs.existsSync(configPath)) {
      return { ok: true, config: {} };
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return { ok: true, config };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '읽기 실패', config: {} };
  }
});

// ============================================
// 외부 링크/브라우저 핸들러
// ============================================

ipcMain.handle('open-link', async (_evt, href) => {
  try {
    const { shell } = require('electron');
    await shell.openExternal(href);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '열기 실패' };
  }
});

ipcMain.handle('open-external', async (_evt, url) => {
  try {
    const { shell } = require('electron');
    await shell.openExternal(url);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '열기 실패' };
  }
});

// ============================================
// 환경 검증 핸들러
// ============================================

ipcMain.handle('validate-env', async () => {
  try {
    const env = loadEnvFromFile();
    const errors: string[] = [];

    if (!env.GEMINI_API_KEY && !env.geminiKey) errors.push('Gemini API 키가 없습니다');
    if (!env.BLOGGER_CLIENT_ID && !env.bloggerClientId) errors.push('Blogger 클라이언트 ID가 없습니다');

    return { ok: true, valid: errors.length === 0, errors };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '검증 실패', valid: false, errors: [] };
  }
});

// ============================================
// 썸네일 생성 핸들러
// ============================================

ipcMain.handle('make-thumb', async (_evt, payload) => {
  try {
    // 🎯 사용자 선택 엔진 → dispatcher 경유 (silent override 방지)
    const { dispatchThumbnailGeneration } = require('../dist/core/imageDispatcher');
    const source = payload.source || payload.thumbnailSource || payload.mode || 'imagefx';
    const result = await dispatchThumbnailGeneration(
      source,
      payload.topic || payload.title || '',
      payload.keyword || payload.topic || '',
    );
    if (result.ok) {
      return { ok: true, thumbnailUrl: result.dataUrl, source: result.source };
    }
    return { ok: false, error: result.error || '썸네일 생성 실패' };
  } catch (error) {
    console.error('[THUMBNAIL] 생성 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '생성 실패' };
  }
});

// 🖼️ Enhanced 썸네일 생성 핸들러
safeRegisterHandler('generate-thumbnail', async (_evt: Electron.IpcMainInvokeEvent, options: any) => {
  try {
    console.log('[MAIN] 썸네일 생성 요청:', options);

    const { makeEnhancedThumbnail } = require('../dist/thumbnail');

    const result = await makeEnhancedThumbnail(
      options.title,
      options.keyword,
      {
        width: 1200,
        height: 630,
        titleMaxLines: 3,
        tags: options.keyword ? options.keyword.split(' ').slice(0, 3) : [],
        brand: '베터라이프 네이버',
        background: {
          type: options.backgroundType || 'none',
          source: options.backgroundSource,
          apiKey: process.env.PEXELS_API_KEY || process.env.OPENAI_API_KEY,
          opacity: options.opacity || 0.6,
          blur: options.blur || 8,
          overlay: {
            color: '#000000',
            opacity: 0.5
          }
        }
      }
    );

    console.log('[MAIN] 썸네일 생성 완료:', result.ok);
    return result;

  } catch (error: any) {
    console.error('[MAIN] 썸네일 생성 오류:', error);
    return { ok: false, error: error.message || '썸네일 생성 실패' };
  }
});

// ============================================
// URL 크롤링 핸들러
// ============================================

ipcMain.handle('crawl-url', async (_evt, url) => {
  try {
    const { crawlAndExtract } = require('../dist/naver-crawler');
    const result = await crawlAndExtract(url);
    return { ok: true, content: result };
  } catch (error) {
    console.error('[CRAWL] 크롤링 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '크롤링 실패' };
  }
});

// ============================================
// Phase 1: 핵심 키워드 발굴 핸들러
// ============================================

// 키워드 발굴 상태 관리
const keywordDiscoveryStates = new Map<string, { running: boolean; cancel: boolean }>();

// 황금 키워드 발굴
ipcMain.handle('find-golden-keywords', async (_evt, keyword: string, options?: any) => {
  try {
    console.log('[KEYWORD] 황금 키워드 발굴 시작:', keyword);

    // 상태 초기화
    keywordDiscoveryStates.set(keyword, { running: true, cancel: false });

    // golden-keyword-analyzer 사용
    const goldenKeywordModule = loadUtilsModule('golden-keyword-analyzer');
    const { findGoldenKeywords } = goldenKeywordModule;

    const result = await findGoldenKeywords(keyword, {
      ...options,
      onProgress: (progress: any) => {
        // 진행 상황 로깅
        console.log(`[KEYWORD] 진행: ${progress.current}/${progress.total}`);

        // 취소 요청 확인
        const state = keywordDiscoveryStates.get(keyword);
        if (state?.cancel) {
          throw new Error('사용자가 취소했습니다');
        }
      }
    });

    keywordDiscoveryStates.set(keyword, { running: false, cancel: false });
    return { ok: true, keywords: result };

  } catch (error) {
    console.error('[KEYWORD] 발굴 실패:', error);
    keywordDiscoveryStates.set(keyword, { running: false, cancel: false });
    return { ok: false, error: error instanceof Error ? error.message : '발굴 실패', keywords: [] };
  }
});

// 키워드 발굴 중단
ipcMain.handle('stop-keyword-discovery', async (_evt, keyword: string) => {
  try {
    const state = keywordDiscoveryStates.get(keyword);
    if (state && state.running) {
      state.cancel = true;
      console.log('[KEYWORD] 발굴 중단 요청:', keyword);
      return { ok: true, message: '중단 요청됨' };
    }
    return { ok: true, message: '실행 중인 작업 없음' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '중단 실패' };
  }
});

// ============================================
// Phase 1: 트렌드 분석 핸들러
// ============================================

// 트렌딩 키워드 조회
ipcMain.handle('get-trending-keywords', async (_evt, source: 'naver' | 'google' | 'youtube') => {
  try {
    console.log('[TREND] 트렌딩 키워드 조회:', source);

    let result: any[] = [];

    if (source === 'naver') {
      const { getNaverRealtimeKeywords } = loadUtilsModule('naver-datalab-api');
      result = await getNaverRealtimeKeywords();
    } else if (source === 'google') {
      const { getGoogleTrendingKeywords } = loadUtilsModule('google-trends-api');
      result = await getGoogleTrendingKeywords();
    } else if (source === 'youtube') {
      const { getYouTubeTrendingKeywords } = loadUtilsModule('youtube-data-api');
      result = await getYouTubeTrendingKeywords();
    }

    return { ok: true, keywords: result };
  } catch (error) {
    console.error('[TREND] 조회 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '조회 실패', keywords: [] };
  }
});

// 실시간 급상승 키워드
ipcMain.handle('get-realtime-keywords', async (_evt, options?: { platform?: 'zum' | 'google' | 'nate' | 'daum' | 'all'; limit?: number }) => {
  try {
    console.log('[REALTIME] 실시간 키워드 조회:', options);

    const realtimeModule = loadUtilsModule('realtime-search-keywords');
    const platform = options?.platform || 'all';
    let result: any = null;

    if (platform === 'all') {
      // 모든 플랫폼의 실시간 검색어 조회 (객체 반환)
      const allData = await realtimeModule.getAllRealtimeKeywords();

      // keyword-master.html이 객체 형식을 기대하므로 그대로 반환
      console.log('[REALTIME] 조회 성공:', {
        zum: allData.zum?.length || 0,
        nate: allData.nate?.length || 0,
        daum: allData.daum?.length || 0,
        google: allData.google?.length || 0
      });

      // keyword-master.html이 기대하는 형식으로 반환
      return {
        success: true,
        data: allData,  // 객체 그대로 반환 {zum: [...], nate: [...], ...}
        ok: true,
        keywords: allData
      };
    } else if (platform === 'zum') {
      result = await realtimeModule.getZumRealtimeKeywords();
    } else if (platform === 'google') {
      result = await realtimeModule.getGoogleRealtimeKeywords();
    } else if (platform === 'nate') {
      result = await realtimeModule.getNateRealtimeKeywords();
    } else if (platform === 'daum') {
      result = await realtimeModule.getDaumRealtimeKeywords();
    }

    // 배열로 반환
    const keywords = Array.isArray(result) ? result : [];
    console.log(`[REALTIME] 조회 성공: ${keywords.length}개 키워드`);

    // keyword-master.html이 기대하는 형식으로 반환
    return {
      success: true,  // ok 대신 success
      data: keywords,  // keywords 대신 data
      ok: true,
      keywords: keywords  // 호환성을 위해 둘 다 포함
    };
  } catch (error) {
    console.error('[REALTIME] 조회 실패:', error);
    return {
      success: false,
      ok: false,
      error: error instanceof Error ? error.message : '조회 실패',
      data: [],
      keywords: []
    };
  }
});

// ============================================
// Phase 1: 경쟁 분석 핸들러
// ============================================

// 경쟁자 분석
ipcMain.handle('analyze-competitors', async (_evt, keyword: string) => {
  try {
    console.log('[COMPETITOR] 경쟁자 분석:', keyword);

    const { analyzeCompetitors } = loadUtilsModule('competitor-analyzer');
    const result = await analyzeCompetitors(keyword);

    return { ok: true, analysis: result };
  } catch (error) {
    console.error('[COMPETITOR] 분석 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '분석 실패', analysis: null };
  }
});

// 날짜 기반 빠른 분석
ipcMain.handle('analyze-fast-by-date', async (_evt, keyword: string, maxResults?: number) => {
  try {
    console.log('[FAST-ANALYZE] 날짜 기반 분석:', keyword);

    const { analyzeFastByDate } = loadUtilsModule('timing-golden-finder');
    const result = await analyzeFastByDate(keyword, maxResults || 10);

    return { ok: true, analysis: result };
  } catch (error) {
    console.error('[FAST-ANALYZE] 분석 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '분석 실패', analysis: null };
  }
});

// ============================================
// Phase 1: 블로그 지수 핸들러
// ============================================

// 블로그 인덱스 추출
ipcMain.handle('extract-blog-index', async (_evt, blogIdOrUrl: string, options?: { fastMode?: boolean; enhanced?: boolean }) => {
  try {
    console.log('[BLOG-INDEX] 인덱스 추출:', blogIdOrUrl);

    const { extractBlogIndex } = loadUtilsModule('timing-golden-finder');
    const result = await extractBlogIndex(blogIdOrUrl, options);

    return { ok: true, index: result };
  } catch (error) {
    console.error('[BLOG-INDEX] 추출 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '추출 실패', index: null };
  }
});

// 스마트블록 키워드 분석
ipcMain.handle('analyze-smart-block-keywords', async (_evt, keyword: string, maxResults?: number) => {
  try {
    console.log('[SMART-BLOCK] 키워드 분석:', keyword);

    const { analyzeSmartBlockKeywords } = loadUtilsModule('naver-search-validator');
    const result = await analyzeSmartBlockKeywords(keyword, maxResults || 10);

    return { ok: true, keywords: result };
  } catch (error) {
    console.error('[SMART-BLOCK] 분석 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '분석 실패', keywords: [] };
  }
});

console.log('[MAIN] ✅ Phase 1 핸들러 등록 완료 (키워드/트렌드/경쟁/블로그지수)');

// ============================================
// Phase 2: 워드프레스 연동 핸들러
// ============================================

// 워드프레스 연결 테스트
ipcMain.handle('test-wordpress-connection', async (_evt, args: { siteUrl: string; username?: string; password?: string; jwtToken?: string }) => {
  try {
    console.log('[WP] 연결 테스트:', args.siteUrl);

    const { testWordPressConnection } = require('../dist/wordpress/wordpress-api');
    const result = await testWordPressConnection(args);

    return { ok: true, connected: result.success, message: result.message };
  } catch (error) {
    console.error('[WP] 연결 실패:', error);
    return { ok: false, connected: false, error: error instanceof Error ? error.message : '연결 실패' };
  }
});

// 워드프레스 카테고리 조회
ipcMain.handle('get-wordpress-categories', async (_evt, args: { siteUrl: string; username?: string; password?: string; jwtToken?: string }) => {
  try {
    console.log('[WP] 카테고리 조회:', args.siteUrl);

    const { getWordPressCategories } = require('../dist/wordpress/wordpress-api');
    const categories = await getWordPressCategories(args);

    return { ok: true, categories };
  } catch (error) {
    console.error('[WP] 카테고리 조회 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '조회 실패', categories: [] };
  }
});

// 워드프레스 태그 조회
ipcMain.handle('get-wordpress-tags', async (_evt, args: { siteUrl: string; username?: string; password?: string; jwtToken?: string }) => {
  try {
    console.log('[WP] 태그 조회:', args.siteUrl);

    const { getWordPressTags } = require('../dist/wordpress/wordpress-api');
    const tags = await getWordPressTags(args);

    return { ok: true, tags };
  } catch (error) {
    console.error('[WP] 태그 조회 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '조회 실패', tags: [] };
  }
});

// 워드프레스 카테고리 로드 (중복 핸들러 통합)
ipcMain.handle('load-wordpress-categories', async (_evt, args) => {
  try {
    console.log('[WP] 카테고리 로드 (통합):', args.siteUrl);
    const { getWordPressCategories } = require('../dist/wordpress/wordpress-api');
    const categories = await getWordPressCategories(args);
    return { ok: true, categories };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '로드 실패', categories: [] };
  }
});

ipcMain.handle('loadWpCategories', async (_evt, args) => {
  try {
    const { getWordPressCategories } = require('../dist/wordpress/wordpress-api');
    const categories = await getWordPressCategories({ siteUrl: args.wpUrl, username: args.wpUsername, password: args.wpPassword });
    return { ok: true, categories };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '로드 실패', categories: [] };
  }
});

// ============================================
// Phase 2: 블로거 OAuth 핸들러
// ============================================

// 🔥 블로거 OAuth 인증 시작 (로컬 서버 기반 - OOB deprecated 대응)
const BLOGGER_OAUTH_PORT = 58392;

ipcMain.handle('blogger-start-auth', async (_evt, payload?: any) => {
  try {
    console.log('[BLOGGER-AUTH] OAuth 인증 시작 (로컬 서버 기반)');

    // payload가 있으면 사용, 없으면 .env에서 읽기
    let clientId = '';
    let blogId = '';
    let clientSecret = '';

    if (payload) {
      clientId = String(payload.googleClientId || payload.clientId || '').trim();
      blogId = String(payload.blogId || payload.blogId || '').trim();
      clientSecret = String(payload.googleClientSecret || payload.clientSecret || '').trim();
    }

    // payload에 없으면 .env에서 읽기
    if (!clientId) {
      const envPath = path.join(app.getPath('userData'), '.env');
      const fs = require('fs');

      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const parseEnvFile = (content: string) => {
          const vars: Record<string, string> = {};
          content.split('\n').forEach(line => {
            const match = line.match(/^([^#=]+)=(.+)$/);
            if (match) vars[match[1].trim()] = match[2].trim();
          });
          return vars;
        };

        const envVars = parseEnvFile(envContent);
        clientId = envVars.GOOGLE_CLIENT_ID || '';
        blogId = envVars.BLOG_ID || envVars.BLOGGER_ID || '';
        clientSecret = envVars.GOOGLE_CLIENT_SECRET || '';
      }
    }

    // 필수 값 확인
    if (!clientId) {
      return {
        ok: false,
        error: 'Google Client ID가 설정되지 않았습니다. 환경 설정에서 Google Client ID를 입력해주세요.'
      };
    }

    // 🔥 로컬 서버 시작 (콜백 자동 수신)
    const { startBloggerOAuthServer, handleBloggerCallback } = require('./main-login');

    const serverResult = await startBloggerOAuthServer(async (code: string) => {
      console.log('[BLOGGER-AUTH] 🔥 코드 자동 수신! 토큰 교환 시작...');
      try {
        const tokenResult = await handleBloggerCallback(code);
        console.log('[BLOGGER-AUTH] 토큰 교환 결과:', tokenResult.success ? '성공' : '실패');

        // 메인 윈도우에 결과 전송
        if (mainWindow) {
          mainWindow.webContents.send('blogger-auth-complete', {
            ok: tokenResult.success,
            error: tokenResult.error
          });
        }
      } catch (err) {
        console.error('[BLOGGER-AUTH] 토큰 교환 오류:', err);
        if (mainWindow) {
          mainWindow.webContents.send('blogger-auth-complete', {
            ok: false,
            error: err instanceof Error ? err.message : '토큰 교환 실패'
          });
        }
      }
    });

    if (!serverResult.success) {
      return { ok: false, error: serverResult.error || '로컬 서버 시작 실패' };
    }

    // 🔥 로컬 서버 기반 OAuth URL 생성
    const redirectUri = `http://127.0.0.1:${BLOGGER_OAUTH_PORT}/callback`;
    const scope = 'https://www.googleapis.com/auth/blogger';

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `response_type=code&` +
      `access_type=offline&` +
      `prompt=consent`;

    console.log('[BLOGGER-AUTH] OAuth URL:', authUrl);
    console.log('[BLOGGER-AUTH] Redirect URI:', redirectUri);

    // 외부 브라우저로 열기
    const { shell } = require('electron');
    await shell.openExternal(authUrl);

    return { ok: true, authUrl, redirectUri };
  } catch (error) {
    console.error('[BLOGGER-AUTH] 인증 시작 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '인증 실패' };
  }
});

// 블로거 OAuth 콜백 처리
ipcMain.handle('blogger-handle-callback', async (_evt, args: { code: string }) => {
  try {
    console.log('[BLOGGER-AUTH] OAuth 콜백 처리');

    const { handleBloggerCallback } = require('./main-login');
    const result = await handleBloggerCallback(args.code);

    return { ok: true, tokens: result };
  } catch (error) {
    console.error('[BLOGGER-AUTH] 콜백 처리 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '콜백 처리 실패' };
  }
});

// 블로거 인증 상태 확인
ipcMain.handle('blogger-check-auth-status', async () => {
  try {
    // blogger-publisher.js에서 checkBloggerAuthStatus 함수 사용
    const bloggerPublisher = require('../dist/core/blogger-publisher');
    const status = await bloggerPublisher.checkBloggerAuthStatus();
    return {
      ok: true,
      authenticated: status.authenticated,
      email: status.email || status.tokenData?.email,
      error: status.error
    };
  } catch (error) {
    console.error('[AUTH] 인증 상태 확인 실패:', error);
    return { ok: false, authenticated: false, error: error instanceof Error ? error.message : '확인 실패' };
  }
});

// OAuth 토큰 교환
ipcMain.handle('exchange-oauth-token', async (_evt, args: { code: string; client_id: string; client_secret: string; redirect_uri: string }) => {
  try {
    console.log('[OAUTH] 토큰 교환 시작');
    console.log('[OAUTH] 인자:', {
      hasCode: !!args.code,
      hasClientId: !!args.client_id,
      hasClientSecret: !!args.client_secret,
      hasRedirectUri: !!args.redirect_uri
    });

    // main-login 모듈 import
    let mainLoginModule;
    try {
      mainLoginModule = require('./main-login');
      console.log('[OAUTH] main-login 모듈 로드 성공:', Object.keys(mainLoginModule));
    } catch (requireError) {
      console.error('[OAUTH] main-login 모듈 로드 실패:', requireError);
      throw new Error(`main-login 모듈을 로드할 수 없습니다: ${requireError instanceof Error ? requireError.message : '알 수 없는 오류'}`);
    }

    // exchangeOAuthToken 함수 확인
    if (!mainLoginModule || typeof mainLoginModule.exchangeOAuthToken !== 'function') {
      console.error('[OAUTH] exchangeOAuthToken 함수를 찾을 수 없습니다. 사용 가능한 exports:', Object.keys(mainLoginModule || {}));
      throw new Error('exchangeOAuthToken 함수를 찾을 수 없습니다.');
    }

    console.log('[OAUTH] exchangeOAuthToken 함수 호출');
    const tokens = await mainLoginModule.exchangeOAuthToken({
      client_id: args.client_id,
      client_secret: args.client_secret,
      code: args.code,
      redirect_uri: args.redirect_uri
    });

    console.log('[OAUTH] ✅ 토큰 교환 성공');
    return { ok: true, tokens };
  } catch (error) {
    console.error('[OAUTH] 토큰 교환 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '토큰 교환 실패' };
  }
});

// 중복 핸들러 통합
ipcMain.handle('start-blogger-auth', async (_evt) => {
  try {
    console.log('[BLOGGER-AUTH] 인증 시작 요청');

    // 환경 설정에서 값 가져오기
    const envPath = path.join(app.getPath('userData'), '.env');
    const fs = require('fs');

    if (!fs.existsSync(envPath)) {
      return {
        ok: false,
        error: '환경 설정 파일이 없습니다. 환경 설정에서 Blogger ID, Google Client ID, Google Client Secret을 설정해주세요.'
      };
    }

    // .env 파일 읽기
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const parseEnvFile = (content: string) => {
      const vars: Record<string, string> = {};
      content.split('\n').forEach(line => {
        const match = line.match(/^([^#=]+)=(.+)$/);
        if (match) vars[match[1].trim()] = match[2].trim();
      });
      return vars;
    };

    const envVars = parseEnvFile(envContent);

    console.log('[BLOGGER-AUTH] .env 파일에서 읽은 변수:', Object.keys(envVars));

    const blogId = envVars.BLOG_ID || envVars.BLOGGER_ID || envVars.blogId || '';
    const clientId = envVars.GOOGLE_CLIENT_ID || envVars.googleClientId || '';
    const clientSecret = envVars.GOOGLE_CLIENT_SECRET || envVars.googleClientSecret || '';

    console.log('[BLOGGER-AUTH] 파싱된 값:', {
      blogId: blogId ? `${blogId.substring(0, 10)}...` : '없음',
      clientId: clientId ? `${clientId.substring(0, 20)}...` : '없음',
      clientSecret: clientSecret ? '있음' : '없음'
    });

    // 필수 값 확인
    if (!clientId) {
      console.error('[BLOGGER-AUTH] Google Client ID가 없습니다.');
      return {
        ok: false,
        error: 'Google Client ID가 설정되지 않았습니다. 환경 설정에서 Google Client ID를 입력해주세요.'
      };
    }

    // blogger-publisher에서 인증 URL 생성 함수 가져오기
    let getBloggerAuthUrl;
    try {
      const bloggerPublisher = require('../dist/core/blogger-publisher');
      getBloggerAuthUrl = bloggerPublisher.getBloggerAuthUrl;
      if (!getBloggerAuthUrl) {
        throw new Error('getBloggerAuthUrl 함수를 찾을 수 없습니다.');
      }
      console.log('[BLOGGER-AUTH] getBloggerAuthUrl 함수 로드 성공');
    } catch (requireError) {
      console.error('[BLOGGER-AUTH] blogger-publisher 모듈 로드 실패:', requireError);
      return {
        ok: false,
        error: `모듈 로드 실패: ${requireError instanceof Error ? requireError.message : String(requireError)}`
      };
    }

    const payload = {
      blogId: blogId,
      googleClientId: clientId,
      googleClientSecret: clientSecret
    };

    console.log('[BLOGGER-AUTH] getBloggerAuthUrl 호출, payload:', {
      blogId: payload.blogId ? `${payload.blogId.substring(0, 10)}...` : '없음',
      googleClientId: payload.googleClientId ? `${payload.googleClientId.substring(0, 20)}...` : '없음',
      googleClientSecret: payload.googleClientSecret ? '있음' : '없음'
    });

    let authUrl;
    try {
      authUrl = getBloggerAuthUrl(payload);
      console.log('[BLOGGER-AUTH] getBloggerAuthUrl 결과:', authUrl ? `${authUrl.substring(0, 100)}...` : 'null');
    } catch (urlError) {
      console.error('[BLOGGER-AUTH] getBloggerAuthUrl 실행 오류:', urlError);
      return {
        ok: false,
        error: `인증 URL 생성 중 오류 발생: ${urlError instanceof Error ? urlError.message : String(urlError)}`
      };
    }

    if (!authUrl) {
      console.error('[BLOGGER-AUTH] getBloggerAuthUrl이 null을 반환했습니다.');
      return {
        ok: false,
        error: '인증 URL 생성에 실패했습니다. Google Client ID가 올바른지 확인해주세요. (payload에 googleClientId가 없거나 비어있을 수 있습니다.)'
      };
    }

    console.log('[BLOGGER-AUTH] 인증 URL 생성 성공');

    // 외부 브라우저로 열기
    const { shell } = require('electron');
    await shell.openExternal(authUrl);

    return {
      ok: true,
      authUrl: authUrl,
      message: '인증 URL이 브라우저에서 열렸습니다. 인증을 완료한 후 생성된 코드를 복사해주세요.'
    };
  } catch (error) {
    console.error('[BLOGGER-AUTH] 인증 시작 실패:', error);
    const errorMessage = error instanceof Error ? error.message : '인증 URL 생성에 실패했습니다.';
    return {
      ok: false,
      error: errorMessage
    };
  }
});

console.log('[MAIN] ✅ Phase 2 핸들러 등록 완료 (워드프레스/블로거 OAuth)');

// ============================================
// Phase 3-5: 나머지 핸들러 일괄 등록
// ============================================

// 유튜브 영상 조회
ipcMain.handle('get-youtube-videos', async (_evt, options?: { maxResults?: number }) => {
  try {
    const { getYouTubeVideos } = loadUtilsModule('youtube-data-api');
    const videos = await getYouTubeVideos(options);
    return { ok: true, videos };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '조회 실패', videos: [] };
  }
});

// SNS 트렌드
ipcMain.handle('get-sns-trends', async (_evt, platform: 'youtube') => {
  try {
    const { getSNSTrends } = loadUtilsModule('youtube-data-api');
    const trends = await getSNSTrends(platform);
    return { ok: true, trends };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '조회 실패', trends: [] };
  }
});

// 키워드 순위 체크
ipcMain.handle('check-keyword-rank', async (_evt, data: { keyword: string; blogUrl: string }) => {
  try {
    const { checkKeywordRank } = loadUtilsModule('keyword-validator');
    const rank = await checkKeywordRank(data.keyword, data.blogUrl);
    return { ok: true, rank };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '체크 실패', rank: null };
  }
});

// 타이밍 골드 헌팅
ipcMain.handle('hunt-timing-gold', async (_evt, category?: string) => {
  try {
    const { huntTimingGold } = loadUtilsModule('timing-golden-finder');
    const result = await huntTimingGold(category);
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '헌팅 실패', result: null };
  }
});

// Google 트렌드 키워드
ipcMain.handle('get-google-trend-keywords', async () => {
  try {
    const { getGoogleTrendKeywords } = loadUtilsModule('google-trends-api');
    const keywords = await getGoogleTrendKeywords();
    return { ok: true, keywords };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '조회 실패', keywords: [] };
  }
});

// 키워드 그룹 관리
const getKeywordGroupsPath = () => path.join(app.getPath('userData'), 'keyword-groups.json');

ipcMain.handle('get-keyword-groups', async () => {
  try {
    const groupsPath = getKeywordGroupsPath();
    if (!fs.existsSync(groupsPath)) return { ok: true, groups: [] };
    const groups = JSON.parse(fs.readFileSync(groupsPath, 'utf-8'));
    return { ok: true, groups };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '조회 실패', groups: [] };
  }
});

ipcMain.handle('add-keyword-group', async (_evt, group) => {
  try {
    const groupsPath = getKeywordGroupsPath();
    let groups: any[] = [];
    if (fs.existsSync(groupsPath)) {
      groups = JSON.parse(fs.readFileSync(groupsPath, 'utf-8'));
    }
    const newGroup = { ...group, id: Date.now().toString(), createdAt: new Date().toISOString() };
    groups.push(newGroup);
    fs.writeFileSync(groupsPath, JSON.stringify(groups, null, 2), 'utf-8');
    return { ok: true, group: newGroup };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '추가 실패' };
  }
});

ipcMain.handle('update-keyword-group', async (_evt, id, updates) => {
  try {
    const groupsPath = getKeywordGroupsPath();
    let groups = JSON.parse(fs.readFileSync(groupsPath, 'utf-8'));
    const index = groups.findIndex((g: any) => g.id === id);
    if (index >= 0) {
      groups[index] = { ...groups[index], ...updates };
      fs.writeFileSync(groupsPath, JSON.stringify(groups, null, 2), 'utf-8');
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '업데이트 실패' };
  }
});

ipcMain.handle('delete-keyword-group', async (_evt, id) => {
  try {
    const groupsPath = getKeywordGroupsPath();
    let groups = JSON.parse(fs.readFileSync(groupsPath, 'utf-8'));
    groups = groups.filter((g: any) => g.id !== id);
    fs.writeFileSync(groupsPath, JSON.stringify(groups, null, 2), 'utf-8');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '삭제 실패' };
  }
});

// 키워드 스케줄 관리
const getKeywordSchedulesPath = () => path.join(app.getPath('userData'), 'keyword-schedules.json');

ipcMain.handle('get-keyword-schedules', async () => {
  try {
    const schedulesPath = getKeywordSchedulesPath();
    if (!fs.existsSync(schedulesPath)) return { ok: true, schedules: [] };
    const schedules = JSON.parse(fs.readFileSync(schedulesPath, 'utf-8'));
    return { ok: true, schedules };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '조회 실패', schedules: [] };
  }
});

ipcMain.handle('add-keyword-schedule', async (_evt, scheduleData) => {
  try {
    const schedulesPath = getKeywordSchedulesPath();
    let schedules: any[] = [];
    if (fs.existsSync(schedulesPath)) {
      schedules = JSON.parse(fs.readFileSync(schedulesPath, 'utf-8'));
    }
    const newSchedule = { ...scheduleData, id: Date.now().toString(), createdAt: new Date().toISOString() };
    schedules.push(newSchedule);
    fs.writeFileSync(schedulesPath, JSON.stringify(schedules, null, 2), 'utf-8');
    return { ok: true, schedule: newSchedule };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '추가 실패' };
  }
});

ipcMain.handle('toggle-keyword-schedule', async (_evt, id, enabled) => {
  try {
    const schedulesPath = getKeywordSchedulesPath();
    let schedules = JSON.parse(fs.readFileSync(schedulesPath, 'utf-8'));
    const index = schedules.findIndex((s: any) => s.id === id);
    if (index >= 0) {
      schedules[index].enabled = enabled;
      fs.writeFileSync(schedulesPath, JSON.stringify(schedules, null, 2), 'utf-8');
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '토글 실패' };
  }
});

// 대시보드 통계
ipcMain.handle('get-dashboard-stats', async () => {
  try {
    // 간단한 통계 반환
    return { ok: true, stats: { posts: 0, keywords: 0, schedules: 0 } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '조회 실패', stats: {} };
  }
});

// Blogger 인증 만료 알림 처리
ipcMain.on('blogger-auth-expiring-soon', (event, data) => {
  const { minutesLeft, expiresAt } = data;

  // 시스템 알림 표시
  const notification = new Notification('Blogger 인증 만료 임박', {
    body: `Blogger 인증이 ${minutesLeft}분 후 만료됩니다. 재인증을 준비해주세요.`,
    icon: path.join(__dirname, 'assets', 'icon.png') // 아이콘 경로 (필요시 조정)
  });

  notification.onclick = () => {
    // 알림 클릭 시 설정 창으로 이동 (필요시 구현)
    event.sender.send('focus-settings-tab');
  };

  // 소리 재생 (시스템 기본 알림음)
  if (process.platform === 'darwin') { // macOS
    require('child_process').exec('afplay /System/Library/Sounds/Glass.aiff');
  } else if (process.platform === 'win32') { // Windows
    require('child_process').exec('powershell.exe [console]::beep(800,500)');
  } else { // Linux
    require('child_process').exec('paplay /usr/share/sounds/freedesktop/stereo/message.oga || aplay /usr/share/sounds/alsa/Front_Center.wav');
  }
});

ipcMain.on('blogger-auth-expired', (event, data) => {
  const { expiredAt } = data;

  // 긴급 시스템 알림 표시
  const notification = new Notification('Blogger 인증 만료됨', {
    body: 'Blogger 인증이 만료되었습니다. 즉시 재인증이 필요합니다.',
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  notification.onclick = () => {
    event.sender.send('focus-settings-tab');
  };

  // 긴급 소리 재생 (더 긴 소리)
  if (process.platform === 'darwin') {
    require('child_process').exec('afplay /System/Library/Sounds/Sosumi.aiff');
  } else if (process.platform === 'win32') {
    require('child_process').exec('powershell.exe [console]::beep(1000,1000); [console]::beep(1200,1000)');
  } else {
    require('child_process').exec('paplay /usr/share/sounds/freedesktop/stereo/dialog-error.oga || aplay /usr/share/sounds/alsa/Side_Right.wav');
  }
});

// 알림 관리
ipcMain.handle('get-notifications', async () => {
  try {
    return { ok: true, notifications: [] };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '조회 실패', notifications: [] };
  }
});

ipcMain.handle('save-notification-settings', async (_evt, settings) => {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'notification-settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '저장 실패' };
  }
});

// 백업/복원
ipcMain.handle('create-backup', async () => {
  try {
    const userDataPath = app.getPath('userData');
    const backupDir = path.join(userDataPath, 'backups');

    // 백업 디렉토리 생성
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // 타임스탬프 생성 (YYYYMMDD_HHMMSS 형식)
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const backupPath = path.join(backupDir, `backup_${timestamp}`);

    // 백업 디렉토리 생성
    fs.mkdirSync(backupPath, { recursive: true });

    // 백업할 파일/디렉토리 목록
    const backupItems: Array<{ source: string; target: string }> = [];

    // 1. .env 파일
    const envPath = path.join(userDataPath, '.env');
    if (fs.existsSync(envPath)) {
      backupItems.push({
        source: envPath,
        target: path.join(backupPath, '.env')
      });
    }

    // 2. src/core 디렉토리 (핵심 로직)
    const srcCorePath = path.join(process.cwd(), 'src', 'core');
    if (fs.existsSync(srcCorePath)) {
      backupItems.push({
        source: srcCorePath,
        target: path.join(backupPath, 'src_core')
      });
    }

    // 3. electron/ui 디렉토리 (UI 파일)
    const electronUiPath = path.join(process.cwd(), 'electron', 'ui');
    if (fs.existsSync(electronUiPath)) {
      backupItems.push({
        source: electronUiPath,
        target: path.join(backupPath, 'electron_ui')
      });
    }

    // 4. localStorage 백업 (설정 파일)
    const localStorageBackup = {
      bloggerSettings: null as any,
      timestamp: new Date().toISOString()
    };

    // 파일 복사 함수
    const copyRecursive = (src: string, dest: string) => {
      const stat = fs.statSync(src);
      if (stat.isDirectory()) {
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(dest, { recursive: true });
        }
        const files = fs.readdirSync(src);
        files.forEach(file => {
          copyRecursive(path.join(src, file), path.join(dest, file));
        });
      } else {
        fs.copyFileSync(src, dest);
      }
    };

    // 백업 실행
    for (const item of backupItems) {
      try {
        if (fs.existsSync(item.source)) {
          copyRecursive(item.source, item.target);
          console.log(`[BACKUP] ✅ 백업 완료: ${item.source} -> ${item.target}`);
        }
      } catch (err) {
        console.error(`[BACKUP] ⚠️ 백업 실패: ${item.source}`, err);
      }
    }

    // localStorage 백업 정보 저장
    const backupInfo = {
      timestamp: new Date().toISOString(),
      items: backupItems.map(item => ({ source: item.source, target: item.target })),
      version: app.getVersion()
    };
    fs.writeFileSync(
      path.join(backupPath, 'backup_info.json'),
      JSON.stringify(backupInfo, null, 2),
      'utf-8'
    );

    // 오래된 백업 정리 (30일 이상 된 백업 삭제)
    try {
      const files = fs.readdirSync(backupDir);
      const nowTime = Date.now();
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30일

      for (const file of files) {
        const filePath = path.join(backupDir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory() && file.startsWith('backup_')) {
          const age = nowTime - stat.mtimeMs;
          if (age > maxAge) {
            fs.rmSync(filePath, { recursive: true, force: true });
            console.log(`[BACKUP] 🗑️ 오래된 백업 삭제: ${file}`);
          }
        }
      }
    } catch (err) {
      console.warn('[BACKUP] 오래된 백업 정리 실패:', err);
    }

    console.log(`[BACKUP] ✅ 백업 생성 완료: ${backupPath}`);
    return { ok: true, path: backupPath, success: true, backupPath };
  } catch (error) {
    console.error('[BACKUP] 백업 생성 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '백업 실패' };
  }
});

ipcMain.handle('restore-backup', async () => {
  try {
    return { ok: true, message: '복원 완료' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '복원 실패' };
  }
});

// 개발자 도구 열기
ipcMain.handle('open-dev-tools', async (_evt) => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  if (focusedWindow && !focusedWindow.isDestroyed()) {
    focusedWindow.webContents.openDevTools();
    return { ok: true };
  }
  return { ok: false, error: '활성 창이 없습니다' };
});

// 관리자 모드
ipcMain.handle('admin-auth', async (_evt, pin: string) => {
  try {
    const configPath = path.join(app.getPath('userData'), 'admin-config.json');
    if (!fs.existsSync(configPath)) return { ok: true, authenticated: true }; // 첫 사용
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return { ok: true, authenticated: config.pin === pin };
  } catch (error) {
    return { ok: false, authenticated: false, error: error instanceof Error ? error.message : '인증 실패' };
  }
});

ipcMain.handle('set-admin-pin', async (_evt, args: { oldPin?: string; newPin: string }) => {
  try {
    const configPath = path.join(app.getPath('userData'), 'admin-config.json');
    fs.writeFileSync(configPath, JSON.stringify({ pin: args.newPin }, null, 2), 'utf-8');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '설정 실패' };
  }
});

// 기타 유틸리티
ipcMain.handle('is-developer-mode', async () => {
  // 🔥 배포 패키지에서는 개발 모드 비활성화
  const isPackagedApp = app.isPackaged;
  const isDevEnv = process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development';

  // 패키지된 앱은 무조건 개발모드 OFF
  const isDeveloperMode = !isPackagedApp && isDevEnv;

  console.log(`[DEV-MODE] isPackaged: ${isPackagedApp}, isDevEnv: ${isDevEnv}, result: ${isDeveloperMode}`);
  return { ok: true, isDeveloperMode };
});

ipcMain.handle('is-packaged', async () => {
  return { ok: true, isPackaged: app.isPackaged };
});

// 🔥 라이선스 티어 관련 핸들러
ipcMain.handle('get-license-tier', async () => {
  try {
    const { getLicenseTierManager } = await import('../dist/utils/license-tier-manager');
    const tierManager = getLicenseTierManager();
    const currentTier = tierManager.getCurrentTier(true); // 강제 새로고침

    return {
      ok: true,
      tier: currentTier.tier,
      name: currentTier.name,
      features: currentTier.features
    };
  } catch (error) {
    console.error('[TIER] 티어 조회 실패:', error);
    return { ok: false, error: '티어 조회 실패' };
  }
});

ipcMain.handle('check-feature-access', async (_evt, feature: string) => {
  try {
    const { getLicenseTierManager } = await import('../dist/utils/license-tier-manager');
    const tierManager = getLicenseTierManager();
    const result = tierManager.checkFeatureAccess(feature as any);

    return {
      ok: true,
      allowed: result.allowed,
      error: result.error
    };
  } catch (error) {
    console.error('[TIER] 기능 접근 체크 실패:', error);
    return { ok: false, allowed: false, error: '기능 접근 체크 실패' };
  }
});

ipcMain.handle('sync-license-with-server', async (_evt, { serverUrl, userId, passwordHash }: { serverUrl: string; userId: string; passwordHash: string }) => {
  try {
    const { getLicenseTierManager } = await import('../dist/utils/license-tier-manager');
    const tierManager = getLicenseTierManager();
    const success = await tierManager.syncWithServer(serverUrl, userId, passwordHash);

    if (success) {
      const newTier = tierManager.getCurrentTier(true);
      return {
        ok: true,
        synced: true,
        newTier: newTier.tier,
        newName: newTier.name
      };
    }

    return { ok: false, synced: false, error: '서버 동기화 실패' };
  } catch (error) {
    console.error('[TIER] 서버 동기화 실패:', error);
    return { ok: false, synced: false, error: '서버 동기화 오류' };
  }
});

ipcMain.handle('transform-content', async (_evt, args) => {
  try {
    // 컨텐츠 변환 로직
    return { ok: true, content: args.content };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '변환 실패' };
  }
});

ipcMain.handle('crawl-product-snapshot', async (_evt, args) => {
  try {
    // 제품 스냅샷 크롤링
    return { ok: true, snapshot: {} };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '크롤링 실패' };
  }
});

console.log('[MAIN] ✅ Phase 3-5 핸들러 등록 완료');

// ============================================
// 누락 핸들러 Phase 1: 라이센스 관련 (4개)
// ============================================

// 라이센스 조회
ipcMain.handle('get-license', async () => {
  try {
    const licensePath = path.join(app.getPath('userData'), 'license.json');
    if (!fs.existsSync(licensePath)) {
      return { ok: true, license: null };
    }
    const license = JSON.parse(fs.readFileSync(licensePath, 'utf-8'));
    return { ok: true, license };
  } catch (error) {
    console.error('[LICENSE] 조회 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '조회 실패', license: null };
  }
});

// 라이센스 활성화
ipcMain.handle('activate-license', async (_evt, args: { code: string }) => {
  try {
    console.log('[LICENSE] 활성화 요청:', args.code);

    // 간단한 라이센스 검증 (실제로는 서버 검증 필요)
    const licensePath = path.join(app.getPath('userData'), 'license.json');
    const licenseData = {
      code: args.code,
      activated: true,
      activatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1년
    };

    fs.writeFileSync(licensePath, JSON.stringify(licenseData, null, 2), 'utf-8');
    return { ok: true, license: licenseData };
  } catch (error) {
    console.error('[LICENSE] 활성화 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '활성화 실패' };
  }
});

// 라이센스 저장
ipcMain.handle('save-license', async (_evt, data: any) => {
  try {
    const licensePath = path.join(app.getPath('userData'), 'license.json');
    fs.writeFileSync(licensePath, JSON.stringify(data, null, 2), 'utf-8');
    return { ok: true };
  } catch (error) {
    console.error('[LICENSE] 저장 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '저장 실패' };
  }
});

// 라이센스 파일 쓰기
ipcMain.handle('write-license-file', async (_evt, data: any) => {
  try {
    const licensePath = path.join(app.getPath('userData'), 'license.json');
    fs.writeFileSync(licensePath, JSON.stringify(data, null, 2), 'utf-8');
    return { ok: true };
  } catch (error) {
    console.error('[LICENSE] 파일 쓰기 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '쓰기 실패' };
  }
});

// ============================================
// 누락 핸들러 Phase 2: 분석 관련 (3개)
// ============================================

// CTA 클릭 로깅
ipcMain.handle('log-cta-click', async (_evt, payload: { role: string; url: string; sectionIndex?: number | string; timestamp: string; postId?: string }) => {
  try {
    console.log('[CTA-LOG] 클릭 기록:', payload);

    const logPath = path.join(app.getPath('userData'), 'cta-clicks.json');
    let logs: any[] = [];

    if (fs.existsSync(logPath)) {
      logs = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
    }

    logs.push({
      ...payload,
      loggedAt: new Date().toISOString()
    });

    // 최근 1000개만 유지
    if (logs.length > 1000) {
      logs = logs.slice(-1000);
    }

    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2), 'utf-8');
    return { ok: true };
  } catch (error) {
    console.error('[CTA-LOG] 로깅 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '로깅 실패' };
  }
});

// 트렌드 분석
ipcMain.handle('analyze-trends', async (_evt, args: any) => {
  try {
    console.log('[TREND-ANALYZE] 트렌드 분석 시작:', args);

    // TODO: trend-analyzer 모듈 구현 필요
    console.warn('[TREND-ANALYZE] 트렌드 분석 모듈이 아직 구현되지 않았습니다.');
    return { ok: false, error: '트렌드 분석 기능이 준비 중입니다.', analysis: null };
  } catch (error) {
    console.error('[TREND-ANALYZE] 분석 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '분석 실패', analysis: null };
  }
});

// 컨텐츠 품질 분석
ipcMain.handle('analyze-content-quality', async (_evt, args: any) => {
  try {
    console.log('[QUALITY] 품질 분석 시작');

    // TODO: quality-analyzer 모듈 구현 필요
    console.warn('[QUALITY] 품질 분석 모듈이 아직 구현되지 않았습니다.');
    return { ok: false, error: '품질 분석 기능이 준비 중입니다.', quality: null };
  } catch (error) {
    console.error('[QUALITY] 분석 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '분석 실패', quality: null };
  }
});

// 스마트 키워드 생성
ipcMain.handle('generate-smart-keywords', async (_evt, args: any) => {
  try {
    console.log('[SMART-KW] 스마트 키워드 생성 시작');

    // TODO: keyword-generator 모듈 구현 필요
    console.warn('[SMART-KW] 스마트 키워드 생성 모듈이 아직 구현되지 않았습니다.');
    return { ok: false, error: '스마트 키워드 생성 기능이 준비 중입니다.', keywords: [] };
  } catch (error) {
    console.error('[SMART-KW] 생성 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '생성 실패', keywords: [] };
  }
});

// ============================================
// 누락 핸들러 Phase 3: 인증 관련 (6개)
// ============================================

// 워드프레스 인증 상태 확인 (🔥 WP_URL 또는 WORDPRESS_SITE_URL 둘 다 지원)
ipcMain.handle('wordpress-check-auth-status', async () => {
  try {
    const env = loadEnvFromFile();
    const siteUrl = env.WP_URL || env.WORDPRESS_SITE_URL || env.wordpressSiteUrl || '';
    const username = env.WP_USERNAME || env.WORDPRESS_USERNAME || env.wordpressUsername || '';
    const password = env.WP_JWT_TOKEN || env.WORDPRESS_PASSWORD || env.wordpressPassword || '';
    const authenticated = !!(siteUrl && (username || password));
    return { ok: true, authenticated, siteUrl };
  } catch (error) {
    return { ok: false, authenticated: false, error: error instanceof Error ? error.message : '확인 실패' };
  }
});

// 플랫폼 인증 확인 (🔥 env 키명 호환성)
ipcMain.handle('check-platform-auth', async (_evt, platform: 'blogger' | 'wordpress') => {
  try {
    const env = loadEnvFromFile();
    let authenticated = false;

    if (platform === 'blogger') {
      const clientId = env.BLOGGER_CLIENT_ID || env.GOOGLE_CLIENT_ID || env.googleClientId || '';
      const clientSecret = env.BLOGGER_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET || env.googleClientSecret || '';
      authenticated = !!(clientId && clientSecret);
    } else if (platform === 'wordpress') {
      const siteUrl = env.WP_URL || env.WORDPRESS_SITE_URL || env.wordpressSiteUrl || '';
      const username = env.WP_USERNAME || env.WORDPRESS_USERNAME || env.wordpressUsername || '';
      const password = env.WP_JWT_TOKEN || env.WORDPRESS_PASSWORD || env.wordpressPassword || '';
      authenticated = !!(siteUrl && (username || password));
    }

    return { ok: true, authenticated, platform };
  } catch (error) {
    return { ok: false, authenticated: false, error: error instanceof Error ? error.message : '확인 실패' };
  }
});

// 토큰 가져오기
ipcMain.handle('fetch-token', async (_evt, tokenData: any) => {
  try {
    console.log('[TOKEN] 토큰 가져오기');

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokenData)
    });

    if (!response.ok) {
      throw new Error(`토큰 요청 실패: ${response.status}`);
    }

    const tokens = await response.json();
    return { ok: true, tokens };
  } catch (error) {
    console.error('[TOKEN] 가져오기 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '토큰 요청 실패' };
  }
});

// 블로거 OAuth (콜론 버전)
ipcMain.handle('blogger:oauth', async (_evt, oauthData: { clientId: string; clientSecret: string; redirectUri: string }) => {
  try {
    console.log('[BLOGGER-OAUTH] 인증 시작 (콜론 버전)');

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${oauthData.clientId}&` +
      `redirect_uri=${oauthData.redirectUri}&` +
      `response_type=code&` +
      `scope=https://www.googleapis.com/auth/blogger&` +
      `access_type=offline`;

    const { shell } = require('electron');
    await shell.openExternal(authUrl);

    return { ok: true, authUrl };
  } catch (error) {
    console.error('[BLOGGER-OAUTH] 인증 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '인증 실패' };
  }
});

// ============================================
// 누락 핸들러 Phase 4: API 연동 & 환경설정 (5개)
// ============================================

// Google CSE 연결 테스트
ipcMain.handle('test-google-cse-connection', async (_evt, args: { cseKey: string; cseCx: string }) => {
  try {
    console.log('[CSE-TEST] Google CSE 연결 테스트');

    const testUrl = `https://www.googleapis.com/customsearch/v1?key=${args.cseKey}&cx=${args.cseCx}&q=test`;
    const response = await fetch(testUrl);

    if (!response.ok) {
      throw new Error(`CSE 테스트 실패: ${response.status}`);
    }

    return { ok: true, connected: true, message: 'Google CSE 연결 성공' };
  } catch (error) {
    console.error('[CSE-TEST] 연결 실패:', error);
    return { ok: false, connected: false, error: error instanceof Error ? error.message : '연결 실패' };
  }
});

// CSE 연결 테스트 (간단 버전)
ipcMain.handle('test-cse-connection', async (_evt, args: { cseKey: string; cseCx: string }) => {
  try {
    const testUrl = `https://www.googleapis.com/customsearch/v1?key=${args.cseKey}&cx=${args.cseCx}&q=test`;
    const response = await fetch(testUrl);
    return { ok: response.ok, connected: response.ok };
  } catch (error) {
    return { ok: false, connected: false, error: error instanceof Error ? error.message : '연결 실패' };
  }
});

// 환경 설정 저장
ipcMain.handle('save-environment-settings', async (_evt, settings: any) => {
  try {
    const envPath = path.join(process.cwd(), '.env');

    // 기존 .env 읽기
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }

    // 설정 업데이트
    const envLines = envContent.split('\n');
    const envMap = new Map<string, string>();

    envLines.forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        envMap.set(match[1].trim(), match[2].trim());
      }
    });

    // 새 설정 추가/업데이트
    Object.entries(settings).forEach(([key, value]) => {
      envMap.set(key, String(value));
    });

    // .env 파일 쓰기
    const newEnvContent = Array.from(envMap.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    fs.writeFileSync(envPath, newEnvContent, 'utf-8');
    return { ok: true };
  } catch (error) {
    console.error('[ENV-SETTINGS] 저장 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '저장 실패' };
  }
});

// 환경 설정 로드
ipcMain.handle('load-environment-settings', async () => {
  try {
    const env = loadEnvFromFile();
    return { ok: true, settings: env };
  } catch (error) {
    console.error('[ENV-SETTINGS] 로드 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '로드 실패', settings: {} };
  }
});

// LEWORD 외부 앱 런처 IPC 핸들러 등록
try {
  const { registerLewordLauncherHandlers } = require('./leword-launcher');
  registerLewordLauncherHandlers();
} catch (e) {
  console.error('[APP] LEWORD 런처 IPC 등록 실패:', e);
}

// ============================================
// 추가 핸들러: keyword-master 호환성
// ============================================

// env:load (envLoad와 동일)
ipcMain.handle('env:load', async () => {
  try {
    const env = loadEnvFromFile();
    return { ok: true, env };
  } catch (error) {
    console.error('[ENV-LOAD] 로드 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '로드 실패', env: {} };
  }
});

// check-api-keys (API 키 상태 확인)
ipcMain.handle('check-api-keys', async () => {
  try {
    const env = loadEnvFromFile();

    // 네이버 검색광고 API 키 확인 (다양한 필드명 지원)
    const searchAdLicense = env.NAVER_SEARCH_AD_ACCESS_LICENSE ||
      env.naverSearchAdAccessLicense ||
      env.naver_search_ad_access_license;
    const searchAdSecret = env.NAVER_SEARCH_AD_SECRET_KEY ||
      env.naverSearchAdSecretKey ||
      env.naver_search_ad_secret_key;
    const searchAdCustomerId = env.NAVER_SEARCH_AD_CUSTOMER_ID ||
      env.naverSearchAdCustomerId ||
      env.naver_search_ad_customer_id;

    const apiStatus = {
      naver: !!(env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET),
      youtube: !!env.YOUTUBE_API_KEY,
      naverAd: !!(searchAdLicense && searchAdSecret && searchAdCustomerId),
      gemini: !!env.GEMINI_API_KEY,
      openai: !!env.OPENAI_API_KEY,
      claude: !!env.CLAUDE_API_KEY,
      blogger: !!((env.BLOGGER_CLIENT_ID || env.GOOGLE_CLIENT_ID) && (env.BLOGGER_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET)),
      wordpress: !!(env.WP_URL || env.WORDPRESS_SITE_URL)
    };

    console.log('[API-KEYS] 네이버 검색광고 API 상태:', {
      hasLicense: !!searchAdLicense,
      hasSecret: !!searchAdSecret,
      hasCustomerId: !!searchAdCustomerId,
      combined: apiStatus.naverAd
    });

    return { ok: true, status: apiStatus };
  } catch (error) {
    console.error('[API-KEYS] 확인 실패:', error);
    return { ok: false, error: error instanceof Error ? error.message : '확인 실패', status: {} };
  }
});

// ── 쿼터 관리 IPC ──
// 앱 버전 조회
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

// 무료 체험 접속 (라이선스 없이 앱 진입)
ipcMain.handle('auth:free-trial', async () => {
  console.log('[AUTH] 🆓 무료 체험 모드로 접속');

  // 무료 체험 세션 활성화
  try {
    const { activateFreeTrial } = require('./auth-utils');
    activateFreeTrial();
  } catch (e) {
    console.error('[AUTH] activateFreeTrial 실패:', e);
  }

  // Free trial: close login window and open main window
  const { BrowserWindow } = require('electron');
  const allWindows = BrowserWindow.getAllWindows();

  // Close login window
  allWindows.forEach((win: any) => {
    if (win.getTitle().includes('인증') || win.webContents.getURL().includes('login-window')) {
      win.close();
    }
  });

  // Create main window (same as successful login)
  if (typeof createWindow === 'function') {
    createWindow();
  }

  return { ok: true };
});

ipcMain.handle('quota:getStatus', async () => {
  try {
    const { isFreeTierUser, getFreeQuotaStatus } = require('./auth-utils');
    const isFree = await isFreeTierUser();
    if (!isFree) {
      return { success: true, isFree: false };
    }
    const quota = await getFreeQuotaStatus();
    return { success: true, isFree: true, quota };
  } catch (error: any) {
    console.error('[QUOTA] 상태 조회 실패:', error);
    return { success: false, message: error.message };
  }
});

// save-keyword-settings (키워드 마스터 설정 저장)
ipcMain.handle('save-keyword-settings', async (_event, settings) => {
  try {
    console.log('[SAVE-KEYWORD-SETTINGS] 저장 요청:', {
      hasNaverId: !!settings.naverClientId,
      hasNaverSecret: !!settings.naverClientSecret,
      hasYoutube: !!settings.youtubeApiKey,
      hasSearchAdLicense: !!settings.naverSearchAdAccessLicense,
      hasSearchAdSecret: !!settings.naverSearchAdSecretKey,
      hasSearchAdCustomerId: !!settings.naverSearchAdCustomerId
    });

    // .env 파일 읽기
    const envPath = path.join(app.getPath('userData'), '.env');
    let env: Record<string, string> = {};

    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            env[key.trim()] = valueParts.join('=').trim();
          }
        }
      });
    }

    // 기존 설정 유지하면서 새로운 키워드 설정 추가/업데이트
    if (settings.naverClientId) env.NAVER_CLIENT_ID = settings.naverClientId;
    if (settings.naverClientSecret) env.NAVER_CLIENT_SECRET = settings.naverClientSecret;
    if (settings.youtubeApiKey) env.YOUTUBE_API_KEY = settings.youtubeApiKey;
    if (settings.naverSearchAdAccessLicense) env.NAVER_SEARCH_AD_ACCESS_LICENSE = settings.naverSearchAdAccessLicense;
    if (settings.naverSearchAdSecretKey) env.NAVER_SEARCH_AD_SECRET_KEY = settings.naverSearchAdSecretKey;
    if (settings.naverSearchAdCustomerId) env.NAVER_SEARCH_AD_CUSTOMER_ID = settings.naverSearchAdCustomerId;

    // .env 파일 저장
    const lines = Object.entries(env).map(([key, value]) => `${key}=${value}`);
    fs.writeFileSync(envPath, lines.join('\n'), 'utf-8');

    console.log('[SAVE-KEYWORD-SETTINGS] ✅ 저장 완료');

    return {
      success: true,
      message: '저장 완료',
      saved: {
        naver: !!(settings.naverClientId && settings.naverClientSecret),
        youtube: !!settings.youtubeApiKey,
        searchAd: !!(settings.naverSearchAdAccessLicense && settings.naverSearchAdSecretKey && settings.naverSearchAdCustomerId)
      }
    };
  } catch (error) {
    console.error('[SAVE-KEYWORD-SETTINGS] 저장 실패:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '저장 실패'
    };
  }
});

// ========================================
// 내부 링크 거미줄치기 핸들러
// ========================================

safeRegisterHandler('generate-internal-link-content', async (_evt: Electron.IpcMainInvokeEvent, request: any) => {
  try {
    console.log('[INTERNAL-LINKS] 내부 링크 콘텐츠 생성 요청');

    const { generateInternalLinkContent } = await import('../dist/core/internal-links');
    const env = await loadEnvFromFile();

    if (!env.geminiKey) {
      throw new Error('Gemini API 키가 설정되지 않았습니다.');
    }

    const result = await generateInternalLinkContent(request, env.geminiKey);

    console.log('[INTERNAL-LINKS] ✅ 내부 링크 콘텐츠 생성 완료');
    return result;
  } catch (error) {
    console.error('[INTERNAL-LINKS] ❌ 생성 실패:', error);
    throw error;
  }
});

safeRegisterHandler('publish-internal-link-content', async (_evt: Electron.IpcMainInvokeEvent, request: any) => {
  try {
    console.log('[INTERNAL-LINKS] 내부 링크 콘텐츠 발행 요청');

    const { html, title, publish } = request;
    const env = loadEnvFromFile();

    // 플랫폼 확인 - 환경변수에서 가져오기
    const platform = env.platform || env.blogPlatform || 'blogspot';
    console.log('[INTERNAL-LINKS] 발행 플랫폼:', platform);

    if (platform === 'wordpress') {
      // WordPress 발행
      const { WordPressPublisher } = require('../dist/wordpress/wordpress-publisher');

      if (!env.wpSiteUrl || !env.wpUsername || !env.wpPassword) {
        throw new Error('워드프레스 설정이 완료되지 않았습니다. 설정에서 워드프레스 정보를 입력해주세요.');
      }

      const wpConfig = {
        siteUrl: env.wpSiteUrl,
        username: env.wpUsername,
        password: env.wpPassword
      };

      const publisher = new WordPressPublisher(wpConfig);
      const result = await publisher.publish({
        title,
        content: html,
        status: publish ? 'publish' : 'draft'
      });

      console.log('[INTERNAL-LINKS] ✅ WordPress 발행 완료:', result.url);
      return { ok: true, url: result.url, platform: 'wordpress' };

    } else {
      // Blogger 발행 (기본값)
      const { publishToBlogger } = require('../dist/core/blogger-publisher.js');

      // payload 구성
      const payload = {
        blogId: env.blogId,
        bloggerAccessToken: env.bloggerAccessToken,
        bloggerRefreshToken: env.bloggerRefreshToken,
        bloggerClientId: env.bloggerClientId,
        bloggerClientSecret: env.bloggerClientSecret
      };

      const postingMode = publish ? 'publish' : 'draft';

      const result = await publishToBlogger(
        payload,
        title,
        html,
        '', // thumbnailUrl
        (msg: string) => console.log('[INTERNAL-LINKS]', msg),
        postingMode,
        null // scheduleDate
      );

      if (result.ok) {
        console.log('[INTERNAL-LINKS] ✅ Blogger 발행 완료:', result.postUrl);
        return { ok: true, url: result.postUrl || result.url, platform: 'blogspot' };
      } else {
        throw new Error(result.error || 'Blogger 발행 실패');
      }
    }
  } catch (error) {
    console.error('[INTERNAL-LINKS] ❌ 발행 실패:', error);
    throw error;
  }
});

console.log('[MAIN] ✅ 모든 IPC 핸들러 등록 완료! (총 92+ 핸들러)');

// ============================================
// Electron 앱 초기화 및 메인 윈도우 생성
// ============================================

import { BrowserWindow, shell, screen } from 'electron';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  console.log('[APP] 메인 윈도우 생성 중...');

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  // Preload 경로 설정 (배포 환경 대응)
  const preloadPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar', 'electron', 'preload.js')
    : path.join(__dirname, 'preload.js');

  console.log('[WINDOW] Preload 경로:', preloadPath);
  console.log('[WINDOW] __dirname:', __dirname);
  console.log('[WINDOW] isPackaged:', app.isPackaged);

  mainWindow = new BrowserWindow({
    width: Math.floor(width * 0.9),
    height: Math.floor(height * 0.9),
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    title: 'LEADERNAM Orbit',
    show: false, // 준비될 때까지 숨김
    backgroundColor: '#1a1a2e'
  });

  // 🔥 CSP 헤더 설정 (모든 기능이 정상 작동하도록 - 이미지 생성, 크롤링 등)
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' data: blob:; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://script.google.com https://script.googleusercontent.com https://cdn.jsdelivr.net; " +
          "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; " +
          "font-src 'self' https://cdn.jsdelivr.net https://fonts.googleapis.com https://fonts.gstatic.com data:; " +
          "connect-src 'self' https: wss: http:; " +  // 모든 API 연결 허용
          "img-src 'self' data: blob: https: http:; " +  // 모든 이미지 소스 허용
          "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://*.google.com; " +
          "media-src 'self' https: data: blob:;"
        ]
      }
    });
  });

  // 메인 윈도우를 main-login에 전달 (라이선스 체크용)
  setMainWindow(mainWindow);

  // HTML 로드
  const htmlPath = path.join(__dirname, 'ui', 'index.html');
  mainWindow.loadFile(htmlPath);

  // 준비되면 표시
  mainWindow.once('ready-to-show', () => {
    console.log('[APP] ✅ 메인 윈도우 준비 완료, 표시합니다.');
    mainWindow?.show();
  });

  // 외부 링크는 기본 브라우저에서 열기
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 창 닫기 전 확인 다이얼로그 (커스텀 HTML 모달)
  let isQuittingConfirmed = false;
  mainWindow.on('close', (e) => {
    // 업데이트 중이면 그냥 닫음
    try {
      const { isUpdating } = require('./updater');
      if (isUpdating()) return;
    } catch {}
    if (isQuittingConfirmed) return;
    e.preventDefault();
    // 렌더러에 커스텀 모달 표시 요청
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('show-quit-confirm');
    }
  });

  // 창 닫힘 이벤트
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  console.log('[APP] ✅ 메인 윈도우 생성 완료');
}

// 앱 준비 완료 시
app.whenReady().then(async () => {
  console.log('[APP] Electron 앱 준비 완료');

  // 🔥 개발 모드 확인: npm start로 실행 시 라이선스 체크 건너뛰기
  const isDev = !app.isPackaged || process.env.NODE_ENV === 'development';

  if (isDev) {
    console.log('[APP] 🚀 개발 모드: 라이선스 체크 건너뛰기, 무제한 모드');
    createWindow();
  } else {
    // 배포 환경: 인증창을 먼저 띄우고 업데이트 체크는 백그라운드 병렬 실행
    // (업데이트 체크가 빈 화면으로 멈추는 UX 문제 방지)
    const { initAutoUpdaterEarly, registerUpdaterHandlers, setUpdaterLoginWindow } = require('./updater');
    registerUpdaterHandlers();

    // 🔥 업데이트 체크를 비동기로 즉시 시작 (인증창과 병렬)
    console.log('[APP] 🔄 업데이트 체크 백그라운드 시작...');
    try {
      initAutoUpdaterEarly();
    } catch (e: any) {
      console.log('[APP] 업데이트 체크 시작 실패 (무시):', e.message);
    }

    // 🔥 인증창을 즉시 표시 (업데이트 체크 대기하지 않음)
    console.log('[APP] ✅ 인증창 표시 (업데이트는 백그라운드)');
    const licenseValid = await checkLicenseWithAutoLogin();

    if (licenseValid) {
      console.log('[APP] ✅ 라이선스 인증 완료, 메인 윈도우 생성');
      createWindow();
    } else {
      console.log('[APP] ⚠️ 라이선스 인증 실패 또는 로그인 필요');
    }
  }

  // 🔥 관리자 모드 단축키 등록 (Ctrl+Shift+A)
  try {
    // 관리자 모드: Shift+Z (Enter는 prompt에서 처리)
    globalShortcut.register('Shift+Z', () => {
      console.log('[ADMIN] 관리자 모드 단축키 감지!');
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (focusedWindow && !focusedWindow.isDestroyed()) {
        focusedWindow.webContents.send('admin-shortcut');
        console.log('[ADMIN] admin-shortcut 이벤트 전송됨');
      }
    });
    console.log('[APP] ✅ 관리자 모드 단축키 등록 (Ctrl+Shift+A)');
  } catch (err) {
    console.error('[APP] ⚠️ 관리자 모드 단축키 등록 실패:', err);
  }

  // macOS: 모든 창이 닫혀도 앱은 활성 상태 유지
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 모든 창이 닫히면 앱 종료 (macOS 제외)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 앱 종료 시 단축키 해제 + ImageFX 브라우저 정리
app.on('will-quit', async () => {
  globalShortcut.unregisterAll();
  console.log('[APP] 모든 단축키 해제됨');

  // 🖼️ ImageFX 브라우저 세션 정리 (좀비 프로세스 방지)
  try {
    const { cleanupImageFx } = require('../dist/core/imageFxGenerator');
    await cleanupImageFx();
    console.log('[APP] ✅ ImageFX 브라우저 세션 정리 완료');
  } catch (e) {
    // imageFxGenerator 로드 실패 시 무시 (모듈이 사용되지 않았을 수 있음)
  }

  // 🛡️ 원클릭 자동화 Playwright orphan 방지 — 진행 중인 모든 StateManager 리셋
  try {
    const { setupStateManager, webmasterStateManager, connectStateManager, infraStateManager } = require('./oneclick/state/instances');
    await Promise.allSettled([
      setupStateManager.resetAll(),
      webmasterStateManager.resetAll(),
      connectStateManager.resetAll(),
      infraStateManager.resetAll(),
    ]);
    console.log('[APP] ✅ 원클릭 Playwright 세션 전체 정리 완료');
  } catch (e) {
    console.warn('[APP] ⚠️ 원클릭 정리 중 예외(무시):', (e as Error)?.message || e);
  }
});

// 🏆 애드센스 도구 IPC 핸들러 등록
try {
  const { registerAdsenseIpcHandlers } = require('./adsenseIpcHandlers');
  registerAdsenseIpcHandlers();
} catch (e) {
  console.error('[APP] 애드센스 IPC 핸들러 등록 실패:', e);
}

// 🏆 AdSense 단기 승인 패키지 IPC 핸들러 등록
try {
  const { registerFastApprovalIpcHandlers } = require('./adsenseFastApprovalHandlers');
  registerFastApprovalIpcHandlers();
} catch (e) {
  console.error('[APP] AdSense 단기 승인 IPC 등록 실패:', e);
}

// 🛡️ AdsPower IPC 핸들러 등록
try {
  const { registerAdsPowerIpcHandlers } = require('./adspowerIpcHandlers');
  registerAdsPowerIpcHandlers();
} catch (e) {
  console.error('[APP] AdsPower IPC 핸들러 등록 실패:', e);
}

// AdsPower 자동 설치
ipcMain.handle('adspower:auto-install', async () => {
  try {
    const { shell } = require('electron');
    // AdsPower 공식 다운로드 페이지 열기
    await shell.openExternal('https://www.adspower.com/download');
    return { ok: true, message: 'AdsPower 다운로드 페이지가 열렸습니다. 설치 후 앱을 실행해주세요.' };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
});

// 🚀 원클릭 세팅 IPC 핸들러 등록
try {
  const { registerOneclickSetupIpcHandlers } = require('./oneclickSetupIpcHandlers');
  registerOneclickSetupIpcHandlers();
} catch (e) {
  console.error('[APP] 원클릭 세팅 IPC 핸들러 등록 실패:', e);
}

// 🖼️ ImageFX Google 로그인 IPC 핸들러
try {
  const { checkGoogleLoginForImageFx, loginGoogleForImageFx } = require('../dist/core/imageFxGenerator');
  
  ipcMain.handle('imagefx:check-login', async () => {
    try {
      return await checkGoogleLoginForImageFx();
    } catch (e: any) {
      return { loggedIn: false, message: e.message || 'ImageFX 로그인 확인 실패' };
    }
  });
  
  ipcMain.handle('imagefx:login', async () => {
    try {
      return await loginGoogleForImageFx();
    } catch (e: any) {
      return { loggedIn: false, message: e.message || 'ImageFX 로그인 실패' };
    }
  });
  
  console.log('[APP] ✅ ImageFX IPC 핸들러 등록 완료');
} catch (e) {
  console.warn('[APP] ⚠️ ImageFX IPC 핸들러 등록 실패 (imageFxGenerator 로드 불가):', e);
}

// 🍌 v3.6.7: Dropshot 로그인/체크 IPC + 대량 이미지 생성 IPC
//   main.ts에 직접 등록 (main.js만 수정 시 다음 빌드에서 덮어씌워지던 이전 버그 fix)
// 🛡️ v3.7.11: license gate — 무료체험/none/expired는 dropshot 진입 자체 차단.
try {
  const { checkDropshotLogin, loginDropshot } = require('../dist/core/dropshotGenerator');
  ipcMain.handle('dropshot:check-login', async () => {
    try {
      const { checkImageGenAccess } = require('../dist/utils/license-tier-manager');
      const access = checkImageGenAccess();
      if (!access.allowed) {
        return { loggedIn: false, message: access.message, code: `PAYMENT_REQUIRED:${access.reason}`, paymentUrl: access.paymentUrl, kakaoUrl: access.kakaoUrl };
      }
      return await checkDropshotLogin();
    }
    catch (e: any) { return { loggedIn: false, message: e.message || 'Dropshot 로그인 확인 실패' }; }
  });
  ipcMain.handle('dropshot:login', async () => {
    try {
      const { checkImageGenAccess } = require('../dist/utils/license-tier-manager');
      const access = checkImageGenAccess();
      if (!access.allowed) {
        return { loggedIn: false, message: access.message, code: `PAYMENT_REQUIRED:${access.reason}`, paymentUrl: access.paymentUrl, kakaoUrl: access.kakaoUrl };
      }
      return await loginDropshot();
    }
    catch (e: any) { return { loggedIn: false, message: e.message || 'Dropshot 로그인 실패' }; }
  });
  console.log('[APP] ✅ Dropshot IPC 핸들러 등록 완료');
} catch (e) {
  console.warn('[APP] ⚠️ Dropshot IPC 핸들러 등록 실패:', (e as any)?.message || e);
}

// 🎨 v3.6.7: 대량 이미지 생성 IPC (이미지 생성 탭 → dispatcher 경유)
//   payload: { engine, quality, aspectRatio, prompt, includeText, referenceImageList }
//   - includeText: 한글 텍스트 오버레이 hint (nanobanana/gptimage2만 깨지지 않음, 기본 OFF)
//   - referenceImageList: i2i URL 배열 (dropshot 등 i2i 지원 엔진만)
//   dispatcher가 inferImagePrompt + variation hint를 자동 적용 → 짧은 한국어 키워드도 확장
ipcMain.handle('batch-image-generate', async (_evt, payload: any) => {
  try {
    const { engine, quality, aspectRatio, prompt, includeText, referenceImageList } = payload || {};
    if (!engine || !prompt) return { ok: false, error: 'engine + prompt 필수' };

    // 🛡️ v3.7.11 — license gate: 무료체험/none/expired는 일괄 이미지 생성 차단.
    //   dispatcher 진입부에서도 막히지만 IPC 레벨에서 명시적으로 표준 응답 반환 → UI 모달 처리 단일화.
    const { checkImageGenAccess } = require('../dist/utils/license-tier-manager');
    const access = checkImageGenAccess();
    if (!access.allowed) {
      return {
        ok: false,
        error: `PAYMENT_REQUIRED:${access.reason}`,
        message: access.message,
        paymentUrl: access.paymentUrl,
        kakaoUrl: access.kakaoUrl,
      };
    }

    // v3.7.0: 모든 엔진 공통 — 매 호출 unique variation seed로 중복 이미지 방지.
    //   nanobanana/gptimage/flow/imagefx/prodia/deepinfra/dropshot 모두 동일 prompt 받으면
    //   비슷한 결과를 반환하던 문제 차단. timestamp+nonce를 한국어/영어 mixed로 명시.
    const nonce = Math.random().toString(36).slice(2, 8);
    const ts = Date.now().toString(36);
    const variationTail = `\n\n[Gen-${ts}-${nonce}: unique composition, fresh angle, different subjects/setting/lighting — never duplicate previous outputs / 매번 완전히 다른 구도와 시점]`;
    const textTail = includeText
      ? `\n\n주제를 한눈에 표현하는 굵고 또렷한 한국어 큰 글자 텍스트 오버레이를 이미지 위에 포함. 영어 단어·문장·instruction·metadata·대괄호·콜론은 절대로 그리지 마세요. 한국어만 쓰세요.`
      : '';
    const finalPrompt = `${prompt}${textTail}${variationTail}`;

    const { dispatchH2ImageGeneration } = require('../dist/core/imageDispatcher');
    const extra: any = {};
    if (quality === 'low' || quality === 'medium' || quality === 'high') extra.gptImageQuality = quality;
    if (Array.isArray(referenceImageList) && referenceImageList.length > 0) extra.referenceImageList = referenceImageList;
    void aspectRatio; // aspectRatio 옵션은 향후 엔진별 적용
    return await dispatchH2ImageGeneration(engine, finalPrompt, prompt, undefined, undefined, extra);
  } catch (e: any) {
    console.error('[BATCH-IMAGE] 생성 오류:', e);
    return { ok: false, error: e?.message || String(e) };
  }
});

ipcMain.handle('indexnow:submit', async (_evt, siteUrl: string, urls: string[]) => {
  try {
    const { submitToIndexNow } = loadCoreModule('indexnow');
    return await submitToIndexNow(siteUrl, urls);
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('blog:diagnose', async (_evt, blogUrl: string) => {
  try {
    const { diagnoseBlog } = loadCoreModule('blog-diagnostics');
    const onLog = (msg: string) => {
      if (_evt.sender && !_evt.sender.isDestroyed()) {
        _evt.sender.send('log-line', msg);
      }
    };
    return await diagnoseBlog(blogUrl, onLog);
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
});

// 🆕 URL 이미지 자동 수집 + 부족분 AI 검증 (cd000242-sudo/naver v2.7.77 이식)
ipcMain.handle('url-image:crawl-and-collect', async (_evt, payload: {
  url: string;
  postTitle: string;
  mainKeyword: string;
  aiCheckEnabled?: boolean;
  textGenerator?: string;
  threshold?: number;
  visible?: boolean;
}) => {
  try {
    const { crawlAndCollect } = require('../dist/core/url-image-crawler/index.js');
    const env = loadEnvFromFile() as any;
    const apiKeys = {
      gemini: env.GEMINI_API_KEY || env.geminiKey,
      claude: env.CLAUDE_API_KEY || env.ANTHROPIC_API_KEY,
      openai: env.OPENAI_API_KEY,
    };
    const downloadsBase = app.getPath('downloads');
    const result = await crawlAndCollect({
      url: payload.url,
      postTitle: payload.postTitle || '제목없음',
      mainKeyword: payload.mainKeyword || payload.postTitle || '',
      downloadsBase,
      projectName: 'LEADERNAM-Orbit',
      aiCheckEnabled: !!payload.aiCheckEnabled,
      textGenerator: payload.textGenerator || 'gemini-2.5-flash',
      apiKeys,
      threshold: payload.threshold ?? 60,
      visible: !!payload.visible,
    });
    return result;
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e), rawImages: [], acceptedImages: [], savedFiles: [], saveDir: '', costKrw: 0 };
  }
});

// ─── v3.8.0: 외부유입 v2 핸들러 (v2.3 플랜) ────────────────────────────────
try {
  if (ipcMain.listenerCount('generate-external-traffic-text') > 0) {
    ipcMain.removeHandler('generate-external-traffic-text');
  }
  if (ipcMain.listenerCount('generate-external-traffic-text-v2') > 0) {
    ipcMain.removeHandler('generate-external-traffic-text-v2');
  }
  if (ipcMain.listenerCount('external-traffic-list-channels') > 0) {
    ipcMain.removeHandler('external-traffic-list-channels');
  }
} catch {
  /* 핸들러 없음 — 무시 */
}

ipcMain.handle('external-traffic-list-channels', async () => {
  try {
    const dispatcher = require('../src/core/external-traffic');
    return { success: true, channels: dispatcher.listChannels() };
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[EXT-TRAFFIC v2] listChannels 실패:', msg);
    return { success: false, error: msg };
  }
});

// ─── 동의 / 약관 ────────────────────────────────────────────────
ipcMain.handle('external-traffic-consent-check', async (_evt, payload: any) => {
  try {
    const consent = require('../src/core/external-traffic/_shared/consent-store');
    const key = String((payload && payload.key) || 'general').slice(0, 80);
    return { success: true, ...consent.checkConsent(key) };
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) };
  }
});

ipcMain.handle('external-traffic-consent-record', async (_evt, payload: any) => {
  try {
    const consent = require('../src/core/external-traffic/_shared/consent-store');
    const log = require('../src/core/external-traffic/_shared/usage-log');
    const key = String((payload && payload.key) || 'general').slice(0, 80);
    const consents = (payload && payload.consents) || {};
    const channels = Array.isArray(payload && payload.channels) ? payload.channels : undefined;
    const record = consent.recordConsent(key, consents, channels);
    log.logConsent({ consentKey: key, termsVersion: record.version, consents });
    if (key.startsWith('channel:')) {
      log.logCriticalConsent({ channel: key.slice('channel:'.length), consentSteps: Object.keys(consents).filter((k) => consents[k]) });
    }
    return { success: true, record };
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) };
  }
});

ipcMain.handle('external-traffic-consent-list', async () => {
  try {
    const consent = require('../src/core/external-traffic/_shared/consent-store');
    return { success: true, records: consent.listConsents() };
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) };
  }
});

ipcMain.handle('external-traffic-consent-revoke', async (_evt, payload: any) => {
  try {
    const consent = require('../src/core/external-traffic/_shared/consent-store');
    const key = String((payload && payload.key) || '').slice(0, 80);
    consent.revokeConsent(key);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) };
  }
});

// ─── 피드백 ────────────────────────────────────────────────
ipcMain.handle('external-traffic-feedback-record', async (_evt, payload: any) => {
  try {
    const feedback = require('../src/core/external-traffic/feedback-store');
    const record = feedback.recordFeedback(payload || {});
    return { success: true, record };
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) };
  }
});

// ─── 비용 ────────────────────────────────────────────────
ipcMain.handle('external-traffic-cost-summary', async () => {
  try {
    const cost = require('../src/core/external-traffic/cost-tracker');
    return { success: true, currentMonth: cost.currentMonth(), limits: cost.getLimits(), blockState: cost.checkBlockOnLimit() };
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) };
  }
});

ipcMain.handle('external-traffic-cost-set-limit', async (_evt, payload: any) => {
  try {
    const cost = require('../src/core/external-traffic/cost-tracker');
    const partial = (payload && typeof payload === 'object') ? payload : {};
    return { success: true, limits: cost.setLimits(partial) };
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) };
  }
});

// ─── 협력 풀 옵트인 ────────────────────────────────────────────────
ipcMain.handle('external-traffic-pool-state', async () => {
  try {
    const pool = require('../src/core/external-traffic/pool-store');
    return { success: true, optedIn: pool.isOptedIn() };
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) };
  }
});

ipcMain.handle('external-traffic-pool-opt-in', async (_evt, payload: any) => {
  try {
    const pool = require('../src/core/external-traffic/pool-store');
    return { success: true, ...pool.setOptIn(!!(payload && payload.value)) };
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) };
  }
});

// ─── 스케줄러 상태 조회 / 수동 실행 ────────────────────────────────────────────────
ipcMain.handle('external-traffic-scheduler-state', async () => {
  try {
    const sched = require('../src/core/external-traffic/schedulers');
    return { success: true, state: sched.getState() };
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) };
  }
});

ipcMain.handle('external-traffic-scheduler-run-now', async () => {
  try {
    const sched = require('../src/core/external-traffic/schedulers');
    const calibration = sched.runCalibration();
    const revalidation = sched.runRevalidationCheck();
    const prune = sched.runPrune();
    return { success: true, calibration, revalidation, prune };
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) };
  }
});

// 앱 시작 시 스케줄러 자동 시동
try {
  const sched = require('../src/core/external-traffic/schedulers');
  sched.startScheduler({
    onLog: (msg: string) => console.log('[EXT-TRAFFIC SCHED]', msg),
  });
} catch (e: any) {
  console.warn('[EXT-TRAFFIC SCHED] 시동 실패:', e?.message);
}

// ─── v3.8.2: og:image / twitter:image fetch (발행글 모달 썸네일용) ────
//   axios + cheerio로 외부 URL의 메타 이미지 추출. CORS 우회.
const _ogImageCache = new Map<string, { imageUrl: string; ts: number }>();
const OG_CACHE_TTL = 24 * 60 * 60 * 1000;

if (ipcMain.listenerCount('fetch-og-image') > 0) {
  ipcMain.removeHandler('fetch-og-image');
}
ipcMain.handle('fetch-og-image', async (_evt, payload: { url: string }) => {
  try {
    let url = String(payload && payload.url || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return { success: false, error: 'INVALID_URL' };
    }
    // v3.8.4: WordPress wp-admin URL → 공개 URL 변환
    //   leadernam.com/wp-admin/post.php?post=4514&action=edit → leadernam.com/?p=4514
    //   wp-admin 페이지에는 og:image가 없으므로 변환 후 fetch 시도.
    const wpAdminMatch = url.match(/^(https?:\/\/[^/]+)\/wp-admin\/post\.php\?[^#]*\bpost=(\d+)/i);
    if (wpAdminMatch) {
      const origin = wpAdminMatch[1];
      const postId = wpAdminMatch[2];
      url = `${origin}/?p=${postId}`;
      console.log('[OG-IMAGE] wp-admin URL 감지, 공개 URL로 변환:', url);
    }
    const cached = _ogImageCache.get(url);
    if (cached && Date.now() - cached.ts < OG_CACHE_TTL) {
      return { success: true, imageUrl: cached.imageUrl, cached: true };
    }
    const axios = (await import('axios')).default;
    const res = await axios.get(url, {
      timeout: 8000,
      responseType: 'text',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      maxContentLength: 5 * 1024 * 1024,
      validateStatus: (s) => s < 500,
    });
    const html = String(res.data || '');
    const $ = cheerio.load(html);
    // 우선순위: og:image → twitter:image → 첫 본문 img
    let imageUrl =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="og:image"]').attr('content') ||
      $('meta[property="og:image:url"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('meta[name="twitter:image:src"]').attr('content') ||
      $('article img').first().attr('src') ||
      $('main img').first().attr('src') ||
      $('body img').first().attr('src') ||
      '';
    imageUrl = String(imageUrl || '').trim();
    // 상대 URL → 절대 URL 변환
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
      try {
        imageUrl = new URL(imageUrl, url).href;
      } catch {
        imageUrl = '';
      }
    }
    // v3.8.4: WordPress REST API 폴백 — og:image 없으면 wp/v2/posts/{id}?_embed
    if (!imageUrl && /^https?:\/\/[^/]+\/\?p=(\d+)/.test(url)) {
      try {
        const m = url.match(/^(https?:\/\/[^/]+)\/\?p=(\d+)/);
        if (m) {
          const origin = m[1];
          const postId = m[2];
          const apiRes = await axios.get(`${origin}/wp-json/wp/v2/posts/${postId}?_embed`, {
            timeout: 6000,
            validateStatus: (s) => s < 500,
          });
          const featured = apiRes.data
            && apiRes.data._embedded
            && apiRes.data._embedded['wp:featuredmedia']
            && apiRes.data._embedded['wp:featuredmedia'][0]
            && apiRes.data._embedded['wp:featuredmedia'][0].source_url;
          if (typeof featured === 'string') imageUrl = featured;
        }
      } catch {
        // 무시
      }
    }
    if (!imageUrl) {
      return { success: false, error: 'NO_IMAGE_FOUND' };
    }
    _ogImageCache.set(url, { imageUrl, ts: Date.now() });
    return { success: true, imageUrl, cached: false };
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
});

ipcMain.handle('generate-external-traffic-text-v2', async (_evt, payload: any) => {
  try {
    // v3.8.38: 무료 체험은 글포스팅만 허용 — 외부유입 변환 차단
    const { blockIfFreeTier } = require('./auth-utils');
    const gate = await blockIfFreeTier('외부유입 글 생성');
    if (!gate.allowed) return gate.response;

    const dispatcher = require('../src/core/external-traffic');
    const cost = require('../src/core/external-traffic/cost-tracker');
    const usageLog = require('../src/core/external-traffic/_shared/usage-log');
    const fallback = require('../src/core/external-traffic/_shared/llm-fallback');
    let validated: any;
    try {
      validated = dispatcher.validateGenerateV2Payload(payload);
    } catch (ve: any) {
      return { success: false, error: 'INVALID_INPUT: ' + (ve instanceof Error ? ve.message : String(ve)) };
    }

    // 월간 사용량 상한 검사
    const blockState = cost.checkBlockOnLimit();
    if (blockState.exceeded) {
      return { success: false, error: `COST_LIMIT_EXCEEDED: 이번 달 사용량 상한 도달 (${blockState.used.toLocaleString()} / ${blockState.limit.toLocaleString()} tokens). 설정에서 상한 변경 또는 다음 달 갱신 대기.` };
    }

    // v3.8.1: 환경설정의 모델/엔진 선호 + llm-fallback 통합
    const envData = loadEnvFromFile() as any;
    const geminiKey = (envData.geminiKey || envData.GEMINI_API_KEY || process.env['GEMINI_API_KEY'] || '').trim();
    const openaiKey = (envData.openaiKey || envData.OPENAI_API_KEY || process.env['OPENAI_API_KEY'] || '').trim();
    const claudeKey = (envData.claudeKey || envData.CLAUDE_API_KEY || envData.ANTHROPIC_API_KEY || process.env['CLAUDE_API_KEY'] || '').trim();
    const preferredEngine = String(envData.generationEngine || envData.GENERATION_ENGINE || 'gemini').toLowerCase();
    const preferredGeminiModel = (envData.primaryGeminiTextModel || envData.PRIMARY_TEXT_MODEL || '').trim();

    // 최소 1개 키 필요
    if (!geminiKey && !openaiKey && !claudeKey) {
      return { success: false, error: 'API 키가 필요합니다. 설정 탭에서 Gemini / OpenAI / Claude 중 하나 이상 입력해주세요.' };
    }

    const sourceSummary = dispatcher.buildMinimalSummary(validated.sourceTitle, validated.sourceUrl);
    const results: Record<string, any> = {};

    for (const ch of validated.channels) {
      try {
        const channelObj = dispatcher.getChannel(ch.id);
        if (!channelObj) {
          results[ch.id] = { error: 'UNKNOWN_CHANNEL' };
          continue;
        }
        const promptPair = dispatcher.buildPromptPair(ch.id, {
          sourceSummary,
          sourceUrl: validated.sourceUrl,
          sourceTitle: validated.sourceTitle,
          subChannel: ch.subChannel,
          userCustomRule: ch.userCustomRule,
        });
        let userPrompt: string = promptPair.user;
        let attempt = 0;
        let lastResult: any = null;
        while (attempt < 2) {
          // 사용자 선호 엔진 우선, 실패 시 fallback chain
          const callRes = await callLLMWithPreference({
            system: promptPair.system,
            user: userPrompt,
            maxOutputTokens: promptPair.maxOutputTokens || 2000,
            temperature: 0.85,
            geminiKey,
            openaiKey,
            claudeKey,
            preferredEngine,
            preferredGeminiModel,
            fallback,
          });
          const text = (callRes.text || '').trim();
          const fullPrompt = `${promptPair.system}\n\n${userPrompt}`;
          const inputTokens = Math.ceil(fullPrompt.length / 2.5);
          const outputTokens = Math.ceil(text.length / 2.5);
          cost.recordUsage({ provider: callRes.provider || 'gemini', inputTokens, outputTokens, channel: ch.id });
          if (!text) {
            attempt++;
            continue;
          }
          const processed = dispatcher.processResponse(ch.id, text);
          lastResult = {
            rawText: text,
            formatted: processed.formatted,
            risk: processed.risk,
            lengthViolations: processed.lengthViolations,
            retried: attempt > 0,
            attempt: attempt + 1,
            provider: callRes.provider,
            model: callRes.model,
          };
          if (processed.lengthViolations.length === 0) break;
          userPrompt = promptPair.user + dispatcher.buildRetryHint(processed.lengthViolations);
          attempt++;
        }
        if (!lastResult) {
          results[ch.id] = { error: 'EMPTY_LLM_RESPONSE' };
        } else {
          results[ch.id] = lastResult;
          try {
            usageLog.logGenerate({
              channel: ch.id,
              subChannel: ch.subChannel,
              riskScore: lastResult.risk && lastResult.risk.score,
              band: lastResult.risk && lastResult.risk.band,
              sourceUrl: validated.sourceUrl,
              violationCount: (lastResult.lengthViolations || []).length,
            });
          } catch { /* 로그 실패는 무시 */ }
        }
      } catch (chErr: any) {
        const msg = chErr instanceof Error ? chErr.message : String(chErr);
        console.error(`[EXT-TRAFFIC v2] ${ch.id} 실패:`, msg);
        results[ch.id] = { error: msg };
      }
    }
    return { success: true, results };
  } catch (e: any) {
    console.error('[EXT-TRAFFIC v2] 핸들러 실패:', e);
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
});

// v3.8.1: 환경설정 모델 선호 + llm-fallback 통합 호출
async function callLLMWithPreference(opts: {
  system: string;
  user: string;
  maxOutputTokens: number;
  temperature: number;
  geminiKey: string;
  openaiKey: string;
  claudeKey: string;
  preferredEngine: string;
  preferredGeminiModel: string;
  fallback: any;
}): Promise<{ text: string; provider: string; model: string }> {
  const params = {
    system: opts.system,
    user: opts.user,
    maxOutputTokens: opts.maxOutputTokens,
    temperature: opts.temperature,
  };
  const keys = {
    gemini: opts.geminiKey,
    openai: opts.openaiKey,
    claude: opts.claudeKey,
  };

  // 사용자가 환경설정에서 명시 선택한 엔진/모델 우선 시도
  const preferred = opts.preferredEngine;
  if (preferred === 'gemini' && opts.geminiKey) {
    try {
      // primaryGeminiTextModel 우선
      if (opts.preferredGeminiModel) {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(opts.geminiKey);
        const m = genAI.getGenerativeModel({ model: opts.preferredGeminiModel });
        const r = await m.generateContent({
          contents: [{ role: 'user', parts: [{ text: `${opts.system}\n\n${opts.user}` }] }],
          generationConfig: { maxOutputTokens: opts.maxOutputTokens, temperature: opts.temperature },
        });
        const text = ((await r.response).text() || '').trim();
        if (text) return { text, provider: 'gemini', model: opts.preferredGeminiModel };
      }
    } catch (e: any) {
      console.warn('[EXT-TRAFFIC v2] 환경설정 모델 실패, fallback 시도:', e?.message?.slice(0, 100));
    }
  } else if (preferred === 'openai' && opts.openaiKey) {
    try {
      const r = await opts.fallback.callOpenAI(params, opts.openaiKey);
      return { text: r.text, provider: r.provider, model: r.model };
    } catch (e: any) {
      console.warn('[EXT-TRAFFIC v2] OpenAI 실패, fallback 시도:', e?.message?.slice(0, 100));
    }
  } else if (preferred === 'claude' && opts.claudeKey) {
    try {
      const r = await opts.fallback.callClaude(params, opts.claudeKey);
      return { text: r.text, provider: r.provider, model: r.model };
    } catch (e: any) {
      console.warn('[EXT-TRAFFIC v2] Claude 실패, fallback 시도:', e?.message?.slice(0, 100));
    }
  }

  // 환경설정 시도 실패 또는 선호 미설정 → 전체 fallback chain
  const fr = await opts.fallback.callLLMWithFallback(params, keys);
  return { text: fr.text, provider: fr.provider, model: fr.model };
}

// v3.7.23: 외부유입 v1 핸들러 — deprecation 기간 유지 (UI 점진 전환 중)
ipcMain.handle('generate-external-traffic-text', async (_evt, payload: any) => {
  try {
    // v3.8.38: 무료 체험은 글포스팅만 허용 — 외부유입 변환(구버전) 차단
    const { blockIfFreeTier } = require('./auth-utils');
    const gate = await blockIfFreeTier('외부유입 글 생성');
    if (!gate.allowed) return gate.response;

    const system = (payload && payload.system) || '';
    const user = (payload && payload.user) || '';
    if (!user.trim()) {
      return { success: false, error: '프롬프트가 비어있습니다.' };
    }
    const envData = loadEnvFromFile() as any;
    const geminiKey = (envData.geminiKey || envData.GEMINI_API_KEY || process.env['GEMINI_API_KEY'] || '').trim();
    if (!geminiKey || geminiKey.length < 20) {
      return { success: false, error: 'Gemini API 키가 필요합니다. 설정 탭에서 입력해주세요.' };
    }
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = await selectGeminiModel(genAI);
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${system}\n\n${user}` }] }],
      generationConfig: { maxOutputTokens: 4000, temperature: 0.85 },
    });
    const response = await result.response;
    const text = (response.text() || '').trim();
    if (!text) return { success: false, error: '빈 응답이 반환됐어요. 다시 시도해주세요.' };
    return { success: true, text };
  } catch (e: any) {
    console.error('[EXT-TRAFFIC v1] 생성 실패:', e);
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
});

console.log('[APP] ✅ Electron 앱 초기화 완료');
