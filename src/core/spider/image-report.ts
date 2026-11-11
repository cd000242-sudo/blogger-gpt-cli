/**
 * Spider post — turn the image stage numbers into screen warnings (never a failure: the article itself is valid).
 * Asked for images but got none / only some -> one short Korean line that the finished screen shows.
 * No key or token value is ever put into a message.
 */
import { redactSecrets } from './failure';

export interface SpiderImageStatsInput {
  thumbnail: boolean;
  h2Generated: number;
  h2Failed: number;
  errors: string[];
}

const ERROR_MAX_CHARS = 200;

/** One line, secrets masked, capped. Safe to put in imageStats.errors and in a message. */
export function sanitizeSpiderImageErrors(errors: unknown[]): string[] {
  return (Array.isArray(errors) ? errors : []).map((entry) => {
    const line = redactSecrets(entry).replace(/\s+/g, ' ').trim();
    return line.length > ERROR_MAX_CHARS ? `${line.slice(0, ERROR_MAX_CHARS)}…` : line;
  });
}

/** Host-fallback notes mean the image exists ("the publisher uploads it again") — not a cause of a missing image. */
function engineErrors(errors: string[]): string[] {
  return sanitizeSpiderImageErrors(errors).filter((line) => line && !/호스팅 폴백/.test(line));
}

export function buildSpiderImageWarnings(input: {
  imagePolicy: string;
  thumbEngine: string;
  h2Engine: string;
  /** The user supplied the thumbnail from a folder (no engine involved). */
  hasFolderThumbnail?: boolean;
  stats: SpiderImageStatsInput;
}): string[] {
  const policy = String(input.imagePolicy || 'all').toLowerCase();
  if (policy === 'none') return [];
  const { stats } = input;
  const thumbEngine = String(input.thumbEngine || '').toLowerCase();
  const h2Engine = String(input.h2Engine || '').toLowerCase();
  const wantThumb = !!input.hasFolderThumbnail || thumbEngine !== 'none';
  const wantH2 = policy !== 'thumbnail-only' && h2Engine !== 'none';
  if (!wantThumb && !wantH2) return [];

  const causes = engineErrors(stats.errors);
  const cause = causes.slice(0, 2).join(' / ');
  const attempts = (stats.h2Generated || 0) + (stats.h2Failed || 0);
  const warnings: string[] = [];

  if (!stats.thumbnail && !(stats.h2Generated > 0)) {
    const engines = [wantThumb ? `썸네일 ${thumbEngine}` : '', wantH2 ? `본문 ${h2Engine}` : ''].filter(Boolean).join(' · ');
    warnings.push(`이미지가 0장입니다 — 엔진 오류: ${cause || '원인을 알 수 없습니다. 이미지 엔진 로그인·키를 확인해 주세요'} (${engines})`);
    return warnings;
  }
  if (wantThumb && !stats.thumbnail) {
    warnings.push(`썸네일이 들어가지 않았습니다 (${thumbEngine})${cause ? ` — ${cause}` : ''}`);
  }
  if (wantH2 && stats.h2Failed > 0 && stats.h2Generated > 0) {
    warnings.push(`본문 이미지 ${attempts}장 중 ${stats.h2Generated}장만 들어갔습니다 (${h2Engine})${cause ? ` — ${cause}` : ''}`);
  }
  // The thumbnail made it but not one body image did. (Zero everything is handled above, "some" is handled just before.)
  if (wantH2 && !(stats.h2Generated > 0)) {
    const reason = cause
      || (stats.h2Failed > 0 ? `시도한 ${stats.h2Failed}장이 모두 만들어지지 않았습니다` : '원인을 알 수 없습니다. 이미지 엔진 로그인·키를 확인해 주세요');
    warnings.push(`본문 이미지가 0장입니다 — ${reason} (본문 ${h2Engine})`);
  }
  return warnings;
}
