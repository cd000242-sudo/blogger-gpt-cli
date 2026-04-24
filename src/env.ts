// src/env.ts
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';

const APP_DIR_NAME = 'blogger-gpt-cli';

/* ───────────────── userData path ───────────────── */
function getUserDataDir(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron');
    if (app && typeof app.getPath === 'function') {
      const p = app.getPath('userData');
      fs.mkdirSync(p, { recursive: true });
      return p;
    }
  } catch { /* no electron */ }
  const base = process.env['APPDATA'] || process.env['LOCALAPPDATA'] || process.env['HOME'] || process.cwd();
  const p = path.join(base, APP_DIR_NAME);
  fs.mkdirSync(p, { recursive: true });
  return p;
}
function envPath() { return path.join(getUserDataDir(), '.env'); }

/* ───────────────── .env parse/stringify ───────────────── */
function parseDotEnv(str: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!str) return out;

  // JSON 형식인지 확인
  if (str.trim().startsWith('{')) {
    try {
      const jsonData = JSON.parse(str);
      // JSON에서 apiKeys 섹션 추출
      if (jsonData.apiKeys) {
        const apiKeys = jsonData.apiKeys;
        // 환경 변수 이름으로 매핑 (양쪽 형식 모두 지원)
        if (apiKeys['gemini'] || apiKeys['geminiKey']) {
          out['GEMINI_API_KEY'] = apiKeys['gemini'] || apiKeys['geminiKey'];
          out['geminiKey'] = apiKeys['gemini'] || apiKeys['geminiKey'];
        }
        if (apiKeys['naverClientId'] || apiKeys['naver_client_id']) {
          out['NAVER_CLIENT_ID'] = apiKeys['naverClientId'] || apiKeys['naver_client_id'];
          out['naverClientId'] = apiKeys['naverClientId'] || apiKeys['naver_client_id'];
        }
        if (apiKeys['naverClientSecret'] || apiKeys['naver_client_secret']) {
          out['NAVER_CLIENT_SECRET'] = apiKeys['naverClientSecret'] || apiKeys['naver_client_secret'];
          out['naverClientSecret'] = apiKeys['naverClientSecret'] || apiKeys['naver_client_secret'];
        }
        if (apiKeys['googleClientId'] || apiKeys['google_client_id']) {
          out['GOOGLE_CLIENT_ID'] = apiKeys['googleClientId'] || apiKeys['google_client_id'];
          out['googleClientId'] = apiKeys['googleClientId'] || apiKeys['google_client_id'];
        }
        if (apiKeys['googleClientSecret'] || apiKeys['google_client_secret']) {
          out['GOOGLE_CLIENT_SECRET'] = apiKeys['googleClientSecret'] || apiKeys['google_client_secret'];
          out['googleClientSecret'] = apiKeys['googleClientSecret'] || apiKeys['google_client_secret'];
        }
        if (apiKeys['youtubeApiKey'] || apiKeys['youtube_api_key']) {
          out['YOUTUBE_API_KEY'] = apiKeys['youtubeApiKey'] || apiKeys['youtube_api_key'];
          out['youtubeApiKey'] = apiKeys['youtubeApiKey'] || apiKeys['youtube_api_key'];
        }
        if (apiKeys['naverSearchAdAccessLicense'] || apiKeys['naver_search_ad_access_license']) {
          out['NAVER_SEARCH_AD_ACCESS_LICENSE'] = apiKeys['naverSearchAdAccessLicense'] || apiKeys['naver_search_ad_access_license'];
          out['naverSearchAdAccessLicense'] = apiKeys['naverSearchAdAccessLicense'] || apiKeys['naver_search_ad_access_license'];
        }
        if (apiKeys['naverSearchAdSecretKey'] || apiKeys['naver_search_ad_secret_key']) {
          out['NAVER_SEARCH_AD_SECRET_KEY'] = apiKeys['naverSearchAdSecretKey'] || apiKeys['naver_search_ad_secret_key'];
          out['naverSearchAdSecretKey'] = apiKeys['naverSearchAdSecretKey'] || apiKeys['naver_search_ad_secret_key'];
        }
        // Stability AI API Key
        if (apiKeys['stabilityApiKey'] || apiKeys['stability_api_key'] || apiKeys['STABILITY_API_KEY']) {
          out['STABILITY_API_KEY'] = apiKeys['stabilityApiKey'] || apiKeys['stability_api_key'] || apiKeys['STABILITY_API_KEY'];
          out['stabilityApiKey'] = apiKeys['stabilityApiKey'] || apiKeys['stability_api_key'] || apiKeys['STABILITY_API_KEY'];
        }
        // OpenAI API Key (DALL-E용)
        if (apiKeys['openaiKey'] || apiKeys['openai_api_key'] || apiKeys['OPENAI_API_KEY']) {
          out['OPENAI_API_KEY'] = apiKeys['openaiKey'] || apiKeys['openai_api_key'] || apiKeys['OPENAI_API_KEY'];
          out['openaiKey'] = apiKeys['openaiKey'] || apiKeys['openai_api_key'] || apiKeys['OPENAI_API_KEY'];
        }
        // Pexels API Key
        if (apiKeys['pexelsApiKey'] || apiKeys['pexels_api_key'] || apiKeys['PEXELS_API_KEY']) {
          out['PEXELS_API_KEY'] = apiKeys['pexelsApiKey'] || apiKeys['pexels_api_key'] || apiKeys['PEXELS_API_KEY'];
          out['pexelsApiKey'] = apiKeys['pexelsApiKey'] || apiKeys['pexels_api_key'] || apiKeys['PEXELS_API_KEY'];
        }
        // 모든 apiKeys 항목을 그대로도 저장
        for (const [key, value] of Object.entries(apiKeys)) {
          if (typeof value === 'string' && value.trim()) {
            out[key] = value;
            // 대문자 키도 추가
            const upperKey = key.toUpperCase().replace(/([A-Z])/g, '_$1').replace(/^_/, '');
            if (!out[upperKey]) {
              out[upperKey] = value;
            }
          }
        }
      }
      // JSON 전체를 환경 변수로도 매핑 (직접 저장된 경우)
      for (const [key, value] of Object.entries(jsonData)) {
        if (key === 'apiKeys') continue; // apiKeys는 이미 처리됨
        if (typeof value === 'string' && value.trim()) {
          // 원래 키 그대로 저장
          out[key] = value;
          // 대문자 키도 추가
          const upperKey = key.toUpperCase().replace(/([A-Z])/g, '_$1').replace(/^_/, '');
          if (!out[upperKey]) {
            out[upperKey] = value;
          }
        }
      }
      return out;
    } catch (e) {
      console.warn('[ENV] JSON 파싱 실패, 일반 형식으로 시도:', e);
    }
  }

  // 일반 KEY=VALUE 형식 파싱
  for (const raw of str.split(/\r?\n/)) {
    const line = (raw || '').trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || !m[1]) continue;
    const k = m[1];
    let v = (m[2] || '').trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    v = v.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');
    out[k] = v;
  }
  return out;
}
function stringifyDotEnv(obj: Record<string, any>) {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue; // 빈값은 저장 생략
    const s = String(v);
    const needsQuote = /[\s#"'=]/.test(s);
    lines.push(`${k}=${needsQuote ? JSON.stringify(s) : s}`);
  }
  return (lines.join('\n') + '\n');
}

/* ───────────────── 키 매핑(ENV <-> UI) ─────────────────
   왼쪽은 .env의 대문자 키, 오른쪽은 UI/코어에서 쓰는 camelCase 키
----------------------------------------------------------------- */
const MAP: Record<string, string> = {
  AI_PROVIDER: 'provider',

  OPENAI_API_KEY: 'openaiKey',
  DALLE_API_KEY: 'dalleApiKey',
  GEMINI_API_KEY: 'geminiKey',
  CLAUDE_API_KEY: 'claudeKey',
  ANTHROPIC_API_KEY: 'claudeKey',     // Anthropic 키도 claudeKey로 매핑
  PERPLEXITY_API_KEY: 'perplexityKey', // Perplexity 키 추가
  LEONARDO_API_KEY: 'leonardoKey',      // Leonardo.ai 키 추가
  PEXELS_API_KEY: 'pexelsApiKey',
  STABILITY_API_KEY: 'stabilityApiKey', // 🔥 Stability AI 추가
  PRODIA_API_KEY: 'prodiaApiKey',    // 🚀 Prodia AI 추가

  // 🛒 쿠팡 파트너스 오픈 API (쇼핑 모드 실제 상품 데이터 + 제휴 딥링크)
  COUPANG_ACCESS_KEY: 'coupangAccessKey',
  COUPANG_SECRET_KEY: 'coupangSecretKey',

  // ✅ Google CSE (자동 링크/이미지용)
  GOOGLE_CSE_KEY: 'googleCseKey',
  GOOGLE_CSE_CX: 'googleCseCx',
  GOOGLE_CSE_ID: 'googleCseCx',  // CSE ID와 CX는 같은 값
  GOOGLE_CSE_API_KEY: 'googleCseKey', // CSE API Key와 Key는 같은 값


  // Blogger/Google OAuth
  GOOGLE_BLOG_ID: 'blogId',
  BLOGGER_BLOG_ID: 'blogId',  // 두 가지 키명 모두 지원
  GOOGLE_CLIENT_ID: 'googleClientId',
  GOOGLE_CLIENT_SECRET: 'googleClientSecret',
  GOOGLE_REDIRECT_URI: 'redirectUri',

  // WordPress 설정
  WORDPRESS_SITE_URL: 'wordpressSiteUrl',
  WORDPRESS_USERNAME: 'wordpressUsername',
  WORDPRESS_PASSWORD: 'wordpressPassword',
  WORDPRESS_STATUS: 'wordpressStatus',
  WORDPRESS_CATEGORIES: 'wordpressCategories',
  WORDPRESS_TAGS: 'wordpressTags',

  // 기타 옵션
  MIN_CHARS: 'minChars',

  // (선택) 신선도 옵션 등 기존 것 유지
  NAVER_CUSTOMER_ID: 'naverCustomerId',
  NAVER_SECRET_KEY: 'naverSecretKey',
  NAVER_CLIENT_ID: 'naverClientId',
  NAVER_CLIENT_SECRET: 'naverClientSecret',
  NAVER_SEARCH_AD_ACCESS_LICENSE: 'naverSearchAdAccessLicense',
  NAVER_SEARCH_AD_SECRET_KEY: 'naverSearchAdSecretKey',
  YOUTUBE_API_KEY: 'youtubeApiKey',
  REQUIRE_FRESH: 'requireFresh',
  STRICT_FRESH: 'strictFresh',
  FRESH_MAX_AGE_DAYS: 'freshMaxAgeDays',
  HTTPS_PROXY: 'httpsProxy',
  HTTP_PROXY: 'httpProxy',

  // ✅ 썸네일/이미지 자동 생성 옵션
  AUTO_THUMB: 'autoThumb',          // 'true' | 'false'
  THUMB_WIDTH: 'thumbWidth',         // number
  THUMB_HEIGHT: 'thumbHeight',        // number
  THUMB_INSERT_MODE: 'thumbInsertMode',    // 'dataurl' | 'none'
  BRAND_TEXT: 'brandText',          // string

  // ── 새로 추가: 사진형 썸네일 제어
  THUMB_MODE: 'thumbMode',          // 'text' | 'photo'
  THUMB_TEXT_ALIGN: 'thumbTextAlign',     // 'left' | 'center'
  THUMB_TEXT_FIT: 'thumbTextFit',       // 'none' | 'shrink'
  THUMB_MAX_LINES: 'thumbMaxLines',      // number
  THUMB_OVERLAY: 'thumbOverlay',       // 0.0 ~ 0.9
  THUMB_PAD: 'thumbPad',           // number(px)
  THUMB_SUBTITLE: 'thumbSubtitle',      // string (선택)

  // ── 새로 추가: 이미지 검색 제어
  IMAGE_SOURCE: 'imageSource',        // 'cse' | 'unsplash' | 'none'
  IMAGE_SAFESEARCH: 'imageSafeSearch',    // boolean

  // 라이선스 서버 URL
  LICENSE_REDEEM_URL: 'licenseRedeemUrl',
};

// .env에 저장/읽을 키 목록
const KNOWN_KEYS = Object.keys(MAP) as (keyof typeof MAP)[];

/* ───────────────── 로드: .env -> UI형 객체 ───────────────── */
export function loadEnvFromFile(): Record<string, any> {
  // 1) 파일 읽기 - 프로젝트 루트 .env 파일도 확인
  let fileEnv: Record<string, string> = {};

  // 프로젝트 루트 .env 파일 먼저 확인
  try {
    const projectRootEnv = path.join(process.cwd(), '.env');
    if (fs.existsSync(projectRootEnv)) {
      const raw = fs.readFileSync(projectRootEnv, 'utf-8');
      const parsed = parseDotEnv(raw);
      fileEnv = { ...fileEnv, ...parsed };
      console.log('[ENV] 프로젝트 루트 .env 파일 로드:', projectRootEnv, '키 개수:', Object.keys(parsed).length);
    }
  } catch (e) {
    console.warn('[ENV] 프로젝트 루트 .env 파일 읽기 실패:', e);
  }

  // 사용자 데이터 디렉토리 .env 파일 확인 (우선순위 높음)
  try {
    const userDataEnv = envPath();
    if (fs.existsSync(userDataEnv)) {
      const raw = fs.readFileSync(userDataEnv, 'utf-8');
      const parsed = parseDotEnv(raw);
      // 사용자 데이터 디렉토리가 우선순위 높으므로 나중에 병합 (덮어쓰기)
      fileEnv = { ...fileEnv, ...parsed };
      console.log('[ENV] 사용자 데이터 디렉토리 .env 파일 로드:', userDataEnv, '키 개수:', Object.keys(parsed).length);
    }
  } catch (e) {
    console.warn('[ENV] 사용자 데이터 디렉토리 .env 파일 읽기 실패:', e);
  }

  // 2) 파일에 없으면 process.env 보강 (대문자 키 우선, camelCase도 시도)
  const mergedUpper: Record<string, string> = {};

  // 먼저 fileEnv에 있는 모든 키를 mergedUpper에 저장 (원래 키 + 변환된 키 모두)
  for (const [fileKey, fileValue] of Object.entries(fileEnv)) {
    if (fileValue && typeof fileValue === 'string' && fileValue.trim()) {
      // 원래 키 그대로 저장
      mergedUpper[fileKey] = fileValue;

      // camelCase를 대문자 언더스코어로 변환 (naverClientId -> NAVER_CLIENT_ID)
      const upperKey = fileKey.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
      if (upperKey && !mergedUpper[upperKey]) {
        mergedUpper[upperKey] = fileValue;
      }

      // 대문자 키도 추가
      const directUpperKey = fileKey.toUpperCase();
      if (directUpperKey !== fileKey && !mergedUpper[directUpperKey]) {
        mergedUpper[directUpperKey] = fileValue;
      }
    }
  }

  // KNOWN_KEYS에 대해 매핑된 값 찾기 (fileEnv에 없으면 process.env에서)
  for (const k of KNOWN_KEYS) {
    if (!mergedUpper[k]) {
      const camelKey = MAP[k];
      if (camelKey) {
        // fileEnv에서 대문자 키, camelCase 키 모두 시도
        mergedUpper[k] = fileEnv[k] ?? fileEnv[camelKey] ?? (process.env[k] ?? process.env[camelKey] ?? '');
      } else {
        mergedUpper[k] = fileEnv[k] ?? process.env[k] ?? '';
      }
    }
  }

  // 3) camelCase로 변환
  const out: Record<string, any> = {};
  for (const [UP, camel] of Object.entries(MAP)) {
    // mergedUpper에서 대문자 키로 찾고, 없으면 camelCase 키로 직접 찾기
    const value = mergedUpper[UP] ?? mergedUpper[camel] ?? '';
    out[camel] = value;
    // 대문자 키도 함께 저장 (호환성을 위해)
    if (value && typeof value === 'string' && value.trim()) {
      out[UP] = value;
    }
  }

  // 추가: mergedUpper에 있지만 MAP에 없는 camelCase 키들도 그대로 추가 (원래 키 유지)
  for (const [key, value] of Object.entries(mergedUpper)) {
    if (value && typeof value === 'string' && value.trim()) {
      // camelCase 형식의 키인 경우 (소문자로 시작)
      if (/^[a-z]/.test(key)) {
        // 이미 MAP에 매핑된 키가 아닌 경우에만 추가
        if (!Object.values(MAP).includes(key)) {
          out[key] = value;
        }
      }
      // 대문자 키도 추가 (호환성을 위해)
      if (/^[A-Z_]/.test(key) && !out[key]) {
        out[key] = value;
      }
    }
  }

  // 4) 기본값 보정
  if (!out['provider']) out['provider'] = 'openai';
  if (!out['redirectUri']) out['redirectUri'] = 'http://localhost:8765/';

  // 숫자형 보정 도우미
  const toNum = (v: any) => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = Number(v); return Number.isFinite(n) ? n : undefined;
  };
  const toFloat = (v: any) => {
    const n = Number(v); return Number.isFinite(n) ? n : undefined;
  };
  const toBool = (v: any) => (String(v).toLowerCase() === 'true');

  // 숫자/불리언 기본값
  out['minChars'] = toNum(out['minChars']) ?? 3000;
  out['thumbWidth'] = toNum(out['thumbWidth']) ?? 1200;
  out['thumbHeight'] = toNum(out['thumbHeight']) ?? 630;
  out['thumbMaxLines'] = toNum(out['thumbMaxLines']) ?? 3;
  out['thumbOverlay'] = toFloat(out['thumbOverlay']) ?? 0.6;
  out['thumbPad'] = toNum(out['thumbPad']) ?? 80;

  out['autoThumb'] = out['autoThumb'] === '' ? true : toBool(out['autoThumb']);
  out['imageSafeSearch'] = out['imageSafeSearch'] === '' ? true : toBool(out['imageSafeSearch']);

  // 문자열 기본값
  if (!out['thumbInsertMode']) out['thumbInsertMode'] = 'dataurl';
  if (!out['thumbMode']) out['thumbMode'] = 'text';             // 'text' | 'photo'
  if (!out['thumbTextAlign']) out['thumbTextAlign'] = 'center'; // 가운데 정렬 기본
  if (!out['thumbTextFit']) out['thumbTextFit'] = 'shrink';     // 공간 맞춰 자동 축소
  if (!out['imageSource']) out['imageSource'] = 'cse';          // 이미지 검색 기본: CSE
  if (!out['thumbSubtitle']) out['thumbSubtitle'] = '';         // 선택
  // 라이선스 서버 기본값(사용자가 미설정 시) - 관리 패널과 동일한 서버 사용
  if (!out['licenseRedeemUrl']) {
    out['licenseRedeemUrl'] = 'https://script.google.com/macros/s/AKfycbxBOGkjVj4p-6XZ4SEFYKhW3FBmo5gt7Fv6djWhB1TljnDDmx_qlfZ4YdlJNohzIZ8NJw/exec';
  }

  // WordPress 배열 필드 처리
  if (out['wordpressCategories'] && typeof out['wordpressCategories'] === 'string') {
    out['wordpressCategories'] = out['wordpressCategories'].split(',').map(s => s.trim()).filter(Boolean);
  }
  if (out['wordpressTags'] && typeof out['wordpressTags'] === 'string') {
    out['wordpressTags'] = out['wordpressTags'].split(',').map(s => s.trim()).filter(Boolean);
  }

  // WordPress 기본값
  if (!out['wordpressStatus']) out['wordpressStatus'] = 'draft';

  return out;
}

/* ───────────────── 저장: UI형 -> .env ───────────────── */
export async function saveEnv(data: Partial<Record<string, any>>): Promise<{ ok: boolean; logs?: string; error?: string; exitCode?: number }> {
  try {
    // 현재 ENV(대문자) 로드
    const curUpperRaw = parseDotEnv(fs.existsSync(envPath()) ? fs.readFileSync(envPath(), 'utf-8') : '');
    const nextUpper: Record<string, string> = { ...curUpperRaw };

    // camelCase -> UPPER 변환해서 반영
    for (const [UP, camel] of Object.entries(MAP)) {
      if (camel in (data || {})) {
        const v = (data as any)[camel];

        if (v === undefined || v === null || v === '') {
          // 비우면 .env에서 제거
          delete nextUpper[UP];
        } else {
          // 타입 보정(숫자/불리언)
          const numericKeys = new Set([
            'MIN_CHARS',
            'THUMB_WIDTH',
            'THUMB_HEIGHT',
            'FRESH_MAX_AGE_DAYS',
            'THUMB_MAX_LINES',
            'THUMB_PAD',
          ]);
          const floatKeys = new Set([
            'THUMB_OVERLAY',
          ]);
          const booleanKeys = new Set([
            'AUTO_THUMB',
            'REQUIRE_FRESH',
            'STRICT_FRESH',
            'IMAGE_SAFESEARCH',
          ]);

          if (numericKeys.has(UP)) {
            const n = Number(v);
            if (Number.isFinite(n)) nextUpper[UP] = String(n);
          } else if (floatKeys.has(UP)) {
            const n = Number(v);
            if (Number.isFinite(n)) nextUpper[UP] = String(n);
          } else if (booleanKeys.has(UP)) {
            nextUpper[UP] = String(!!(v === true || String(v).toLowerCase() === 'true'));
          } else {
            // WordPress 배열 필드는 콤마로 구분된 문자열로 저장
            if (UP === 'WORDPRESS_CATEGORIES' || UP === 'WORDPRESS_TAGS') {
              if (Array.isArray(v)) {
                nextUpper[UP] = v.join(', ');
              } else {
                nextUpper[UP] = String(v);
              }
            } else {
              nextUpper[UP] = String(v);
            }
          }
        }
      }
    }

    // 기본값이 필요한 필드 보정(없으면 추가)
    if (!nextUpper['AI_PROVIDER']) nextUpper['AI_PROVIDER'] = 'openai';
    if (!nextUpper['GOOGLE_REDIRECT_URI']) nextUpper['GOOGLE_REDIRECT_URI'] = 'http://localhost:8765/';
    if (!nextUpper['MIN_CHARS']) nextUpper['MIN_CHARS'] = '3000';

    // 썸네일/이미지 기본
    if (!nextUpper['AUTO_THUMB']) nextUpper['AUTO_THUMB'] = 'true';
    if (!nextUpper['THUMB_WIDTH']) nextUpper['THUMB_WIDTH'] = '1200';
    if (!nextUpper['THUMB_HEIGHT']) nextUpper['THUMB_HEIGHT'] = '630';
    if (!nextUpper['THUMB_INSERT_MODE']) nextUpper['THUMB_INSERT_MODE'] = 'dataurl';
    if (!nextUpper['THUMB_MODE']) nextUpper['THUMB_MODE'] = 'text';
    if (!nextUpper['THUMB_TEXT_ALIGN']) nextUpper['THUMB_TEXT_ALIGN'] = 'center';
    if (!nextUpper['THUMB_TEXT_FIT']) nextUpper['THUMB_TEXT_FIT'] = 'shrink';
    if (!nextUpper['THUMB_MAX_LINES']) nextUpper['THUMB_MAX_LINES'] = '3';
    if (!nextUpper['THUMB_OVERLAY']) nextUpper['THUMB_OVERLAY'] = '0.6';
    if (!nextUpper['THUMB_PAD']) nextUpper['THUMB_PAD'] = '80';
    if (!nextUpper['IMAGE_SOURCE']) nextUpper['IMAGE_SOURCE'] = 'cse';
    if (!nextUpper['IMAGE_SAFESEARCH']) nextUpper['IMAGE_SAFESEARCH'] = 'true';

    // 쓰기
    const text = stringifyDotEnv(nextUpper);
    const p = envPath();
    await fsp.mkdir(path.dirname(p), { recursive: true });
    await fsp.writeFile(p, text, 'utf-8');

    return { ok: true as const, logs: `.env saved at ${p}` };
  } catch (e: any) {
    return { ok: false as const, exitCode: 1, error: e?.message || String(e) };
  }
}
