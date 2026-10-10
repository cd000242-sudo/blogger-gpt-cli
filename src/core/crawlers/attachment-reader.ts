/**
 * 📎 attachment-reader — 공식기관 **첨부 PDF** 를 받아 글자를 꺼낸다. (브라우저 정독 리서치 2단계)
 *
 * ## 왜 필요한가
 * 기관 검색 결과의 대부분이 첨부파일이다(과거 실측 18건 중 15건). 공고의 표·조건·일정이 본문 페이지가 아니라
 * 첨부 PDF 에만 있는 경우가 많은데, 지금까지는 주소만 보고 건너뛰었다(`looksLikeFileUrl`).
 *
 * ## 지키는 것
 * - **10MB 상한.** 크기 표시(Content-Length)로 먼저 거르고, 표시가 없으면 받는 도중 넘는 순간 멈춘다.
 *   실측: 청년 월세 글 CTA 가 37MB 가이드북이었다 — 이런 것은 받지도 해석하지도 않는다.
 * - PDF 만 읽는다(파일 머리 `%PDF-` 확인). HWP·엑셀·워드는 1차 제외 — 읽을 부품이 마땅치 않다.
 * - 스캔 이미지 PDF(글자가 거의 없음)는 본문으로 치지 않는다.
 * - 자기 사이트 첨부는 받지 않는다.
 * - **어떤 경우에도 던지지 않는다.** 실패는 사유를 단 결과로 돌려주고, 호출부는 예전처럼 스니펫을 남긴다.
 *
 * 글자 정리·보존은 웹 본문과 같은 문(`cleanEvidenceText` · `retainText`)을 지난다.
 */

import type { PageFetchOutcome, FetchFailureReason } from './official-page-body';
import { looksLikeFileUrl } from './official-page-body';
import { collectOwnSources, isOwnSource } from './own-source-filter';

/** 첨부 상한 — 계획서 결정 B */
export const DEFAULT_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
/** 받기·해석을 합친 시간 제한 */
export const DEFAULT_ATTACHMENT_TIMEOUT_MS = 20_000;
/** 앞에서부터 이 쪽수까지만 읽는다(장부 보존 상한이 어차피 6,000자다) */
const MAX_PDF_PAGES = 30;
/** 이 정도는 나와야 본문으로 본다(웹 본문 추출기와 같은 기준) */
const MIN_TEXT_CHARS = 250;
const ALWAYS_OWN = ['leadernam.com'];

/** 1차에서 읽지 않는 파일 종류 — 주소에 확장자가 보이면 받지도 않는다 */
const NOT_PDF_EXT = /\.(hwp|hwpx|hwt|xlsx?|docx?|pptx?|zip|jpe?g|png|gif)(\?|$)/i;

/** 읽어 볼 첨부인가 — `.pdf` 이거나, 확장자 없는 내려받기 주소(받아서 PDF 인지 확인한다) */
export function isReadableAttachmentUrl(url: string): boolean {
  const u = String(url || '');
  if (!/^https?:\/\//i.test(u)) return false;
  if (/\.pdf(\?|$)/i.test(u)) return true;
  return looksLikeFileUrl(u) && !NOT_PDF_EXT.test(u);
}

export type PdfTextFn = (data: Uint8Array) => Promise<{ text: string; pages: number }>;

export interface AttachmentReadOptions {
  maxBytes?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /** PDF → 글자. 비우면 pdfjs-dist */
  pdfText?: PdfTextFn;
  ownSources?: string[];
}

const mb = (n: number): string => `${Math.round(n / (1024 * 1024))}MB`;

/**
 * pdfjs-dist 는 ESM 전용이다. 이 저장소는 CommonJS 로 컴파일되므로 `import()` 가 `require()` 로 바뀌지 않게
 * 진짜 동적 import 를 쓴다. 설치본(asar)에서는 풀어 둔 자리(app.asar.unpacked)를 가리킨다(package.json asarUnpack).
 */
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const nativeImport = new Function('specifier', 'return import(specifier)') as (s: string) => Promise<any>;
const moduleUrl = (request: string): string => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { pathToFileURL } = require('url');
  let file: string = require.resolve(request);
  const unpacked = file.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
  if (unpacked !== file && fs.existsSync(unpacked)) file = unpacked;
  return pathToFileURL(file).href;
};
let pdfjsPromise: Promise<any> | null = null;
const loadPdfjs = (): Promise<any> => {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      // 작업 모듈을 먼저 올려 두면 pdfjs 가 따로 작업 스레드를 찾지 않고 같은 스레드에서 처리한다
      const g = globalThis as { pdfjsWorker?: unknown };
      if (!g.pdfjsWorker) g.pdfjsWorker = await nativeImport(moduleUrl('pdfjs-dist/legacy/build/pdf.worker.mjs'));
      return nativeImport(moduleUrl('pdfjs-dist/legacy/build/pdf.mjs'));
    })();
    pdfjsPromise.catch(() => { pdfjsPromise = null; });
  }
  return pdfjsPromise;
};

/** 기본 PDF → 글자 (pdfjs-dist). 줄바꿈은 띄어쓰기로 잇는다 — 한글 낱말 가운데서 줄이 바뀌어도 숫자·날짜는 그대로 남는다 */
export const pdfjsText: PdfTextFn = async (data) => {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data, disableFontFace: true, isEvalSupported: false, useSystemFonts: false, verbosity: 0 });
  try {
    const doc = await task.promise;
    const parts: string[] = [];
    for (let i = 1; i <= Math.min(doc.numPages, MAX_PDF_PAGES); i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      parts.push(content.items.map((it: { str?: string; hasEOL?: boolean }) => `${it.str || ''}${it.hasEOL ? ' ' : ''}`).join(''));
    }
    return { text: parts.join('\n'), pages: doc.numPages };
  } finally {
    await task.destroy().catch(() => undefined);
  }
};

const fail = (reason: FetchFailureReason, attemptedAt: string, detail?: string, status?: number): PageFetchOutcome => ({
  doc: null, failure: { reason, ...(detail ? { detail } : {}), ...(status ? { status } : {}) }, attemptedAt,
});

/** 응답 본문을 상한까지만 받는다. 넘으면 null(받기를 멈춘다) */
async function readCapped(response: Response, maxBytes: number): Promise<Uint8Array | null> {
  const body = response.body;
  if (!body) return new Uint8Array(await response.arrayBuffer());
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel().catch(() => undefined); return null; }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.byteLength; }
  return out;
}

const isPdf = (data: Uint8Array): boolean => {
  // 앞쪽 1KB 안에 %PDF- 가 있으면 PDF 다(앞에 쓰레기 바이트가 붙은 파일도 있다)
  const head = new TextDecoder('latin1').decode(data.subarray(0, 1024));
  return head.includes('%PDF-');
};

export async function fetchAttachmentDocument(url: string, maxChars: number, options: AttachmentReadOptions = {}): Promise<PageFetchOutcome> {
  const attemptedAt = new Date().toISOString();
  const target = String(url || '').trim();
  if (!/^https?:\/\//i.test(target)) return fail('INVALID_URL', attemptedAt);
  const own = options.ownSources ?? [...collectOwnSources(process.env as Record<string, string>), ...ALWAYS_OWN];
  if (isOwnSource(target, own)) return fail('BLOCKED', attemptedAt, '자기 사이트 첨부 — 받지 않음');
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_ATTACHMENT_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_ATTACHMENT_TIMEOUT_MS;
  const doFetch = options.fetchImpl ?? fetch;
  const pdfText = options.pdfText ?? pdfjsText;

  let data: Uint8Array;
  try {
    const response = await doFetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return fail(response.status === 403 || response.status === 429 ? 'BLOCKED' : 'HTTP_STATUS', attemptedAt, `HTTP ${response.status}`, response.status);
    }
    const type = String(response.headers.get('content-type') || '');
    if (/text\/html/i.test(type)) {
      // 내려받기 주소가 오류·안내 페이지를 준 경우 — 첨부가 아니다
      await response.body?.cancel().catch(() => undefined);
      return fail('UNSUPPORTED_CONTENT', attemptedAt, type.slice(0, 60));
    }
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > maxBytes) {
      await response.body?.cancel().catch(() => undefined);
      return fail('UNSUPPORTED_CONTENT', attemptedAt, `첨부 ${mb(declared)} — 상한 ${mb(maxBytes)} 초과`);
    }
    const got = await readCapped(response, maxBytes);
    if (!got) return fail('UNSUPPORTED_CONTENT', attemptedAt, `첨부가 상한 ${mb(maxBytes)} 초과 — 받다가 멈춤`);
    data = got;
  } catch (e: unknown) {
    const err = e as { name?: string; code?: string; message?: string; cause?: { code?: string } };
    const name = String(err?.name || ''); const code = String(err?.code || err?.cause?.code || ''); const msg = String(err?.message || '').slice(0, 80);
    if (/TimeoutError|AbortError/.test(name) || /timeout/i.test(msg)) return fail('TIMEOUT', attemptedAt, `${timeoutMs}ms`);
    if (/ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|CERT|TLS|ssl/i.test(`${code} ${msg}`)) return fail('NETWORK', attemptedAt, `${code || name} ${msg}`.trim());
    return fail('UNKNOWN', attemptedAt, `${code || name} ${msg}`.trim());
  }

  if (!isPdf(data)) return fail('UNSUPPORTED_CONTENT', attemptedAt, 'PDF 가 아님(HWP 등은 1차 제외)');

  let text = '';
  try {
    text = (await pdfText(data)).text;
  } catch (e: unknown) {
    return fail('EXTRACT_FAIL', attemptedAt, `PDF 해석 실패: ${String((e as { message?: string })?.message || e).slice(0, 80)}`);
  }
  const plain = String(text || '').replace(/[ \t ]+/g, ' ').trim();
  if (plain.replace(/\s+/g, '').length < MIN_TEXT_CHARS) return fail('EXTRACT_FAIL', attemptedAt, `PDF 글자 ${plain.length}자 — 스캔 이미지로 보임`);

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { cleanEvidenceText, retainText } = require('./evidence-clean');
  const tidy = cleanEvidenceText(plain);
  const clean = tidy.cleanLength >= MIN_TEXT_CHARS ? tidy.text : plain;
  const kept = retainText(clean);
  return {
    doc: { text: clean.slice(0, Math.max(1, maxChars)), publishedAt: null, rawLength: plain.length, fullText: kept.fullText, truncatedAt: kept.truncatedAt },
    attemptedAt,
  };
}
