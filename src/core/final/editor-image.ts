import { buildDraftImagePrompt, imageBlockHtml } from './editor-draft';
import { randomUUID } from 'node:crypto';
import {
  dispatchH2ImageGeneration, dispatchThumbnailGeneration, normalizeImageEngine,
  engineAllowsImageText, type DispatchExtraOptions,
} from '../imageDispatcher';

export interface EditorImageRequest {
  title?: string;
  sectionTitle?: string;
  kind?: 'thumbnail' | 'section';
  /** Defaults to true for thumbnails. Section images never contain generated text. */
  thumbnailText?: boolean;
  /** Resume only local composition/upload of an already generated image. */
  retryToken?: string;
  payload?: Record<string, unknown>;
}

interface EditorImageDependencies {
  thumbnail: typeof dispatchThumbnailGeneration;
  section: typeof dispatchH2ImageGeneration;
  upload: (data: string, prefix: string) => Promise<string>;
  overlay: (data: string, title: string, width: number, height: number) => Promise<string>;
}

interface PendingImage {
  signature: string;
  raw: string;
  source: string;
  overlayDone: boolean;
  expiresAt: number;
  busy: boolean;
}
const pendingImages = new Map<string, PendingImage>();
const RETRY_TTL_MS = 60 * 60 * 1000;
const MAX_PENDING_IMAGES = 4;
function prunePendingImages() {
  for (const [token, image] of pendingImages) if (image.expiresAt <= Date.now()) pendingImages.delete(token);
}

/** Shared by individual and sequential bulk UI requests; one selected engine per invocation. */
export async function generateEditorImage(
  args: EditorImageRequest,
  env: Record<string, string>,
  log: (line: string) => void,
  overrides: Partial<EditorImageDependencies> = {},
) {
  const title = String(args?.title || '').trim();
  const kind = args?.kind || 'thumbnail';
  const sectionTitle = kind === 'section' ? String(args?.sectionTitle || '').trim() : '';
  if (!title) return { ok: false, error: '제목 칸을 채워 주세요.' };
  if (title.length > 1000 || sectionTitle.length > 1000) return { ok: false, error: '이미지 제목과 소제목은 각각 1,000자 이내로 입력해 주세요.' };
  if (kind !== 'thumbnail' && kind !== 'section') return { ok: false, error: '지원하지 않는 이미지 종류입니다.' };
  if (kind === 'section' && !sectionTitle) return { ok: false, error: '본문 이미지에 사용할 소제목이 없습니다.' };
  if (args.thumbnailText !== undefined && typeof args.thumbnailText !== 'boolean') return { ok: false, error: '썸네일 텍스트 설정이 올바르지 않습니다.' };
  const payload = args.payload || {};
  // The editor's own engine picker takes precedence over the publishing screen's thumbnail setting.
  const engine = String(payload['h2ImageSource'] || payload['imageSource'] || (kind === 'thumbnail' ? payload['thumbnailSource'] : '') || env['IMAGE_SOURCE'] || 'nanobanana2').trim();
  const normalized = normalizeImageEngine(engine);
  const thumbnailText = kind === 'thumbnail' && args.thumbnailText !== false;
  // Auto selection may resolve to a text-incapable engine after inspecting installed credentials.
  const localText = thumbnailText && (/^(auto|default)$/i.test(engine) || !engineAllowsImageText(normalized));
  const extra: DispatchExtraOptions = {
    allowFreeTrialPublishing: true,
    allowFallback: false,
    thumbnailNoText: !thumbnailText || localText,
  };
  if (['low', 'medium', 'high'].includes(String(payload['gptImageQuality'] || ''))) extra.gptImageQuality = payload['gptImageQuality'] as 'low' | 'medium' | 'high';
  if (typeof payload['leonardoModel'] === 'string') extra.leonardoModel = payload['leonardoModel'];
  const prompt = kind === 'thumbnail' ? title : buildDraftImagePrompt(title, sectionTitle);
  const signature = JSON.stringify([title, kind, sectionTitle, engine, thumbnailText, extra.gptImageQuality, extra.leonardoModel]);
  prunePendingImages();
  let token = args.retryToken;
  let pending: PendingImage;
  if (token !== undefined) {
    const saved = typeof token === 'string' ? pendingImages.get(token) : undefined;
    if (!saved) return { ok: false, error: '이어서 처리할 이미지가 만료되었거나 앱이 다시 시작되어 없습니다. 새 이미지 생성은 실행하지 않았습니다.' };
    if (saved.signature !== signature) return { ok: false, error: '저장된 이미지와 제목·소제목·엔진·텍스트 설정이 다릅니다. 원래 설정으로 다시 시도해 주세요.', retryToken: token };
    if (saved.busy) return { ok: false, error: '이 이미지의 후처리가 이미 진행 중입니다.', retryToken: token };
    pending = saved;
    log('   ↪️ 만들어 둔 이미지의 합성·업로드만 이어 처리합니다 (이미지 생성 API 호출 없음)');
  } else {
    log(`[PROGRESS] 10% - 🖼️ ${kind === 'thumbnail' ? `썸네일 (텍스트 ${thumbnailText ? '포함' : '미포함'})` : `"${sectionTitle.slice(0, 30)}" 영역`} 이미지 생성 (${engine})`);
    const made = kind === 'thumbnail'
      ? await (overrides.thumbnail || dispatchThumbnailGeneration)(engine, prompt, title, log, extra)
      : await (overrides.section || dispatchH2ImageGeneration)(engine, prompt, title, log, undefined, extra);
    const raw = String(made?.dataUrl || (made as any)?.url || '');
    if (!made?.ok || !raw) return { ok: false, error: made?.error || '이미지를 만들지 못했습니다. 선택한 엔진의 설정을 확인해 주세요.' };
    pending = { signature, raw, source: made.source, overlayDone: !localText, expiresAt: Date.now() + RETRY_TTL_MS, busy: false };
    token = randomUUID();
    while (pendingImages.size >= MAX_PENDING_IMAGES) pendingImages.delete(pendingImages.keys().next().value!);
    pendingImages.set(token, pending);
  }
  pending.busy = true;
  try {
    if (!pending.overlayDone) {
      log('   ✍️ 생성한 이미지에 제목을 합성합니다 (추가 AI 호출 없음)');
      const overlay = overrides.overlay || require('../../thumbnail').applyBottomTextOverlay;
      const composed = await overlay(pending.raw, title, 1280, 720);
      if (!composed) throw new Error('제목 합성에 실패했습니다.');
      pending.raw = composed;
      pending.overlayDone = true;
    }
    const upload = overrides.upload || require('./image-helpers').uploadBase64ToImageHost;
    const hosted = pending.raw.startsWith('data:') ? await upload(pending.raw, 'editor') : pending.raw;
    if (!hosted || !/^https?:\/\//i.test(hosted)) throw new Error('이미지 업로드에 실패했습니다.');
    pendingImages.delete(token!);
    log('[PROGRESS] 100% - ✅ 이미지 준비 완료');
    return { ok: true, url: hosted, html: imageBlockHtml(hosted, sectionTitle || title), prompt, source: pending.source, thumbnailText };
  } catch (error: any) {
    return { ok: false, error: `${error?.message || String(error)} 생성한 이미지는 최대 1시간 보관됩니다. 이어서 생성하면 후처리만 다시 시도합니다.`, retryToken: token };
  } finally {
    pending.busy = false;
  }
}
