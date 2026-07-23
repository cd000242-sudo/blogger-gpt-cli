/**
 * 유튜브 URL 글 생성 지원 (v3.8.338)
 *
 * 배경 — 일반 크롤러는 유튜브 페이지를 cheerio로 긁어 <script>를 지우므로 남는 게 푸터(약관 문구)뿐이다.
 * 실측 결과 "제목=Rick Astley(채널명), 본문=유튜브 약관 339자"가 원문으로 들어가 영상과 무관한 글이 나왔다.
 * 게다가 크롤이 '성공'으로 처리돼 경고조차 없었다 — 그래서 전용 경로가 필요하다.
 */
import fs from 'fs';
import path from 'path';
import {
  parseYouTubeVideoId,
  isYouTubeUrl,
  parseTranscriptPayload,
  pickCaptionTrack,
  toCrawlContent,
  YOUTUBE_MIN_MATERIAL_CHARS,
  type YouTubeSource,
} from '../src/core/youtube-source';

const baseSource: YouTubeSource = {
  videoId: 'dQw4w9WgXcQ',
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  title: '정부지원금 신청방법 총정리',
  channel: '생활정보채널',
  description: '지원금 신청 대상과 방법을 정리했습니다.',
  transcript: '',
  transcriptLang: '',
  durationSec: 532,
};

describe('parseYouTubeVideoId — 유튜브 주소 형태별 인식', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc123', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/live/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('%s → %s', (url, expected) => {
    expect(parseYouTubeVideoId(url)).toBe(expected);
  });

  it('유튜브가 아닌 주소는 인식하지 않는다', () => {
    expect(parseYouTubeVideoId('https://blog.naver.com/test/123')).toBeNull();
    expect(parseYouTubeVideoId('https://notyoutube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(isYouTubeUrl('https://leadernam.tistory.com/313')).toBe(false);
  });

  it('빈 값·깨진 주소에도 안전하다', () => {
    expect(parseYouTubeVideoId('')).toBeNull();
    expect(parseYouTubeVideoId('그냥 텍스트')).toBeNull();
    // 영상 ID는 11자 — 채널/재생목록 주소를 영상으로 오인하면 안 된다
    expect(parseYouTubeVideoId('https://www.youtube.com/@somechannel')).toBeNull();
    expect(parseYouTubeVideoId('https://www.youtube.com/watch?v=tooshort')).toBeNull();
  });
});

describe('parseTranscriptPayload — 자막 포맷 파싱', () => {
  it('json3 형식을 텍스트로 만든다', () => {
    const payload = { events: [{ segs: [{ utf8: '안녕하세요 ' }, { utf8: '오늘은' }] }, { segs: [{ utf8: ' 지원금입니다' }] }] };
    expect(parseTranscriptPayload(payload)).toBe('안녕하세요 오늘은 지원금입니다');
  });

  it('XML 형식과 HTML 엔티티를 처리한다', () => {
    const xml = '<transcript><text start="0">신청 방법&amp;#39;s</text><text start="3">정리했습니다</text></transcript>';
    expect(parseTranscriptPayload(xml)).toBe("신청 방법's 정리했습니다");
  });

  it('자막이 아니면 빈 문자열', () => {
    expect(parseTranscriptPayload('')).toBe('');
    expect(parseTranscriptPayload(null)).toBe('');
    expect(parseTranscriptPayload('<html>차단됨</html>')).toBe('');
  });
});

describe('pickCaptionTrack — 자막 언어 우선순위', () => {
  it('수동 한국어 자막을 최우선으로 고른다', () => {
    // kind 없음 = 사람이 단 자막, kind: 'asr' = 자동생성 (정확도가 낮다)
    const tracks = [{ languageCode: 'en' }, { languageCode: 'ko', kind: 'asr' }, { languageCode: 'ko' }];
    expect(pickCaptionTrack(tracks)).toEqual({ languageCode: 'ko' });
  });

  it('수동 한국어가 없으면 자동생성 한국어를 쓴다', () => {
    const tracks = [{ languageCode: 'en' }, { languageCode: 'ko', kind: 'asr' }];
    expect(pickCaptionTrack(tracks)).toEqual({ languageCode: 'ko', kind: 'asr' });
  });

  it('한국어가 전혀 없으면 영어로 폴백한다', () => {
    const tracks = [{ languageCode: 'ja' }, { languageCode: 'en' }];
    expect(pickCaptionTrack(tracks)).toEqual({ languageCode: 'en' });
  });

  it('트랙이 없으면 null', () => {
    expect(pickCaptionTrack([])).toBeNull();
  });
});

describe('toCrawlContent — 생성기에 넘길 재료 구성', () => {
  it('자막이 있으면 자막을 본문 재료로 넣는다', () => {
    const content = toCrawlContent({ ...baseSource, transcript: '자막 내용입니다', transcriptLang: 'ko' });
    expect(content).toContain('[영상 자막]');
    expect(content).toContain('자막 내용입니다');
    expect(content).toContain('영상 제목: 정부지원금 신청방법 총정리');
    expect(content).toContain('채널: 생활정보채널');
  });

  it('자막이 없으면 추측 금지 주의를 함께 넣는다', () => {
    // 재료가 설명뿐이면 AI가 제목만 보고 금액·날짜를 지어내는 것이 가장 큰 위험이다
    const content = toCrawlContent(baseSource);
    expect(content).not.toContain('[영상 자막]');
    expect(content).toContain('[영상 설명]');
    expect(content).toContain('[작성 주의]');
    expect(content).toContain('추측해서 쓰지 말고');
  });
});

describe('URL 모드 배선 — 유튜브는 전용 경로로 간다', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'src', 'core', 'url-content-generator.ts'), 'utf8');

  it('크롤링 진입점에서 유튜브를 먼저 분기한다', () => {
    expect(source).toContain('if (isYouTubeUrl(url)) {');
    expect(source).toContain('await fetchYouTubeSource(url)');
    // cheerio 크롤링(html 변수 초기화)보다 앞에 있어야 푸터를 긁지 않는다
    expect(source.indexOf('if (isYouTubeUrl(url)) {')).toBeLessThan(source.indexOf("let html = '';"));
  });

  it('영상 썸네일을 이미지 후보로 넘긴다', () => {
    expect(source).toContain('https://i.ytimg.com/vi/${source.videoId}/maxresdefault.jpg');
  });

  it('재료 최소 기준이 정의돼 있다', () => {
    expect(YOUTUBE_MIN_MATERIAL_CHARS).toBeGreaterThanOrEqual(100);
  });
});
