// 🎬 유튜브 URL 전용 소스 수집기
//
// 일반 크롤러(url-content-generator.deepCrawlUrl)는 HTML을 cheerio로 긁는다.
// 유튜브는 영상 내용이 HTML에 없고 JS로 그려지는 데다, 추출 전 <script>를 지우기 때문에
// 남는 것이 페이지 푸터(약관·저작권 안내)뿐이다. 그 상태로 글을 쓰면 영상과 무관한 글이 나온다.
//
// 그래서 유튜브는 별도 경로로 처리한다:
//   1) innertube player API(WEB 클라이언트, API 키 불필요) → 정확한 제목·채널·설명·재생시간
//   2) watch 페이지의 captionTracks → timedtext 자막 (있으면 최고의 재료)
//   3) 둘 다 빈약하면 조용히 넘어가지 않고 명시적으로 실패시킨다
//      (푸터로 엉뚱한 글을 쓰느니 못 만든다고 알리는 편이 낫다)
import axios from 'axios';

const YOUTUBE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const YOUTUBE_TIMEOUT_MS = 20_000;

/** 글을 쓰기에 최소한으로 필요한 재료 길이 (자막 또는 설명) */
export const YOUTUBE_MIN_MATERIAL_CHARS = 200;

export interface YouTubeSource {
  videoId: string;
  url: string;
  title: string;
  channel: string;
  description: string;
  transcript: string;
  transcriptLang: string;
  durationSec: number;
}

/**
 * 유튜브 영상 ID 추출. 지원 형태:
 *   youtube.com/watch?v=ID · youtu.be/ID · /shorts/ID · /embed/ID · /live/ID · /v/ID
 * 유튜브가 아니거나 ID를 찾지 못하면 null.
 */
export function parseYouTubeVideoId(rawUrl: string): string | null {
  const url = String(rawUrl || '').trim();
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  const isShortHost = host === 'youtu.be';
  const isYouTubeHost = host === 'youtube.com' || host === 'm.youtube.com' || host.endsWith('.youtube.com');
  if (!isShortHost && !isYouTubeHost) return null;

  const idPattern = /^[A-Za-z0-9_-]{11}$/;

  if (isShortHost) {
    const candidate = parsed.pathname.split('/').filter(Boolean)[0] || '';
    return idPattern.test(candidate) ? candidate : null;
  }

  const fromQuery = parsed.searchParams.get('v') || '';
  if (idPattern.test(fromQuery)) return fromQuery;

  const segments = parsed.pathname.split('/').filter(Boolean);
  const keyed = ['shorts', 'embed', 'live', 'v'];
  for (let i = 0; i < segments.length; i++) {
    if (keyed.includes((segments[i] || '').toLowerCase())) {
      const candidate = segments[i + 1] || '';
      if (idPattern.test(candidate)) return candidate;
    }
  }
  return null;
}

/** 이 URL을 유튜브 전용 경로로 처리해야 하는가 */
export function isYouTubeUrl(rawUrl: string): boolean {
  return parseYouTubeVideoId(rawUrl) !== null;
}

/** timedtext XML/JSON3 → 순수 텍스트 */
export function parseTranscriptPayload(payload: unknown): string {
  if (payload == null) return '';

  // json3 형식 { events: [{ segs: [{ utf8 }] }] }
  if (typeof payload === 'object') {
    const events = (payload as any)?.events;
    if (Array.isArray(events)) {
      return events
        .flatMap((event: any) => Array.isArray(event?.segs) ? event.segs : [])
        .map((seg: any) => String(seg?.utf8 || ''))
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  // 기본 XML 형식 <text start="..">내용</text>
  const xml = String(payload);
  if (!xml.includes('<text')) return '';
  const matches = xml.match(/<text[^>]*>([\s\S]*?)<\/text>/g) || [];
  return matches
    .map((chunk) => chunk
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;#39;/g, "'")
      .replace(/&amp;quot;/g, '"')
      .replace(/&amp;amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>'))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 한국어 → 한국어 자동생성 → 영어 → 나머지 순으로 자막 트랙을 고른다 */
export function pickCaptionTrack<T extends { languageCode?: string; kind?: string }>(tracks: T[]): T | null {
  if (!Array.isArray(tracks) || tracks.length === 0) return null;
  const byLang = (lang: string, manualOnly: boolean) => tracks.find((track) => {
    const code = String(track.languageCode || '').toLowerCase();
    const isManual = !track.kind || track.kind !== 'asr';
    return code.startsWith(lang) && (manualOnly ? isManual : true);
  });
  return byLang('ko', true)
    || byLang('ko', false)
    || byLang('en', true)
    || byLang('en', false)
    || tracks[0]
    || null;
}

/** innertube player API — API 키 없이 제목·채널·설명·재생시간을 정확히 가져온다 */
async function fetchVideoDetails(videoId: string): Promise<{ title: string; channel: string; description: string; durationSec: number }> {
  const response = await axios.post(
    'https://www.youtube.com/youtubei/v1/player',
    {
      videoId,
      context: { client: { clientName: 'WEB', clientVersion: '2.20240101.00.00', hl: 'ko', gl: 'KR' } },
    },
    {
      headers: {
        'User-Agent': YOUTUBE_UA,
        'Content-Type': 'application/json',
        'X-Youtube-Client-Name': '1',
        'X-Youtube-Client-Version': '2.20240101.00.00',
      },
      timeout: YOUTUBE_TIMEOUT_MS,
    },
  );
  const details = (response.data as any)?.videoDetails || {};
  return {
    title: String(details.title || '').trim(),
    channel: String(details.author || '').trim(),
    description: String(details.shortDescription || '').trim(),
    durationSec: Number(details.lengthSeconds || 0) || 0,
  };
}

/**
 * 자막 확보 시도. 유튜브가 timedtext 접근을 막는 경우가 있어 실패해도 예외를 던지지 않는다.
 * (자막은 "있으면 좋은" 재료이고, 없으면 설명으로 글을 쓴다)
 */
async function fetchTranscript(videoId: string): Promise<{ text: string; lang: string }> {
  try {
    const watch = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'User-Agent': YOUTUBE_UA, 'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8' },
      timeout: YOUTUBE_TIMEOUT_MS,
    });
    const matched = String(watch.data).match(/"captionTracks":(\[.*?\])/);
    if (!matched || !matched[1]) return { text: '', lang: '' };

    const tracks = JSON.parse(matched[1].replace(/\\u0026/g, '&')) as Array<{ baseUrl?: string; languageCode?: string; kind?: string }>;
    const picked = pickCaptionTrack(tracks);
    if (!picked?.baseUrl) return { text: '', lang: '' };

    const baseUrl = picked.baseUrl.replace(/\\u0026/g, '&');
    for (const suffix of ['&fmt=json3', '']) {
      try {
        const caption = await axios.get(baseUrl + suffix, {
          headers: { 'User-Agent': YOUTUBE_UA, Referer: 'https://www.youtube.com/' },
          timeout: YOUTUBE_TIMEOUT_MS,
        });
        const text = parseTranscriptPayload(caption.data);
        if (text.length >= 50) return { text, lang: String(picked.languageCode || '') };
      } catch {
        // 다음 포맷으로 재시도
      }
    }
    return { text: '', lang: '' };
  } catch {
    return { text: '', lang: '' };
  }
}

/**
 * 유튜브 영상에서 글 작성 재료를 수집한다.
 * 재료(자막 또는 설명)가 너무 빈약하면 던진다 — 조용히 엉뚱한 글을 쓰지 않기 위해서다.
 */
export async function fetchYouTubeSource(rawUrl: string, onLog?: (msg: string) => void): Promise<YouTubeSource> {
  const videoId = parseYouTubeVideoId(rawUrl);
  if (!videoId) throw new Error(`유튜브 영상 주소가 아닙니다: ${rawUrl}`);

  const log = onLog || (() => undefined);
  log(`   🎬 유튜브 영상 분석 중 (${videoId})...`);

  const details = await fetchVideoDetails(videoId).catch(() => ({ title: '', channel: '', description: '', durationSec: 0 }));
  const transcript = await fetchTranscript(videoId);

  if (transcript.text) {
    log(`   ✅ 자막 확보 (${transcript.lang || '언어 미상'}, ${transcript.text.length}자)`);
  } else {
    log('   ℹ️ 자막을 가져오지 못했습니다 — 제목·설명으로 작성합니다');
  }

  const material = transcript.text.length >= details.description.length ? transcript.text : details.description;
  if (material.length < YOUTUBE_MIN_MATERIAL_CHARS) {
    throw new Error(
      `유튜브 영상에서 글을 쓸 재료를 확보하지 못했습니다. `
      + `(자막 ${transcript.text.length}자, 설명 ${details.description.length}자 — 최소 ${YOUTUBE_MIN_MATERIAL_CHARS}자 필요) `
      + `자막이 꺼져 있고 설명도 짧은 영상은 내용을 알 수 없어 글을 생성하지 않습니다.`,
    );
  }

  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: details.title || `유튜브 영상 ${videoId}`,
    channel: details.channel,
    description: details.description,
    transcript: transcript.text,
    transcriptLang: transcript.lang,
    durationSec: details.durationSec,
  };
}

/** 수집한 유튜브 재료를 일반 크롤링 결과와 같은 모양으로 변환 (본문 생성기가 그대로 사용) */
export function toCrawlContent(source: YouTubeSource): string {
  // 자막이 없으면 재료가 설명뿐이라 영상의 세부 내용을 알 수 없다.
  // 이 사실을 알려주지 않으면 AI가 제목만 보고 수치·일정 같은 구체 정보를 지어낸다.
  const noTranscriptNotice = source.transcript
    ? ''
    : '[작성 주의] 이 영상은 자막을 가져오지 못해 위 제목·설명만으로 작성합니다. '
      + '설명에 없는 금액·날짜·조건·수치를 추측해서 쓰지 말고, 확인이 필요한 부분은 영상과 공식 안내를 확인하도록 안내하세요.';

  const parts = [
    `영상 제목: ${source.title}`,
    source.channel ? `채널: ${source.channel}` : '',
    source.durationSec ? `재생시간: ${Math.floor(source.durationSec / 60)}분 ${source.durationSec % 60}초` : '',
    '',
    source.transcript
      ? `[영상 자막]\n${source.transcript}`
      : '',
    source.description
      ? `[영상 설명]\n${source.description}`
      : '',
    noTranscriptNotice,
  ];
  return parts.filter(Boolean).join('\n').trim();
}
