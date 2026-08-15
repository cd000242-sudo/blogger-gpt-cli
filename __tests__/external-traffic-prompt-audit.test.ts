/**
 * 외부유입 전 채널 프롬프트 감사 — v3.8.504
 *
 * 파일에 적힌 프롬프트가 아니라 **실제로 호출되는 프롬프트**를 검사한다.
 * v3.8.258 통합 때 SNS 계열은 공용 빌더가 덮어써서, 파일 위쪽의 상세 프롬프트는
 * 죽은 코드다 — 파일만 읽으면 "좋은 프롬프트가 있네"로 속는다.
 *
 * 검사 항목:
 *   ① 살아있는 시스템 프롬프트가 채널 이름·역할을 실제로 담는가
 *   ② 길이 상한이 플랫폼 실제 제한과 맞는가 (스레드 500자, X 한글 문제)
 *   ③ 모순 — 모듈은 해시태그 금지인데 프로필은 해시태그 N개를 요구하는 식
 *   ④ 금지어 목록이 위험 평가에 실제로 배선돼 있는가
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf-8');

// 실제 모듈을 불러 살아있는 프롬프트를 뽑는다
const guard = require('../src/core/external-traffic/prompts/_shared/common-context-guard');
const lengthGuard = require('../src/core/external-traffic/_shared/length-guard');

const DUMMY = {
  sourceSummary: '전세 보증금 반환 기준 정리',
  sourceUrl: 'https://leadernam.com/x',
  sourceTitle: '전세 보증금 돌려받는 법',
  sourceText: '보증금 반환 요건과 절차를 정리한 글입니다.',
  sourceKeywords: ['전세', '보증금'],
  sourceType: 'guide',
};

/** 공용 빌더를 쓰는 채널 — 프로필이 곧 살아있는 프롬프트다 */
const UNIFIED = ['threads', 'instagram', 'x', 'facebook', 'tiktok', 'pinterest',
  'youtube-shorts', 'naver-blog', 'naver-cafe', 'kakao-openchat'];

describe('공용 프로필 채널 — 살아있는 프롬프트 검사', () => {
  for (const id of UNIFIED) {
    it(`${id}: 시스템 프롬프트가 실제로 그 채널을 말한다`, () => {
      const sys = guard.buildPlatformSystemPrompt(id);
      expect(sys.length).toBeGreaterThan(400);
      const profile = getProfile(id);
      if (!profile) throw new Error(`${id} 프로필을 소스에서 못 찾음`);
      expect(sys).toContain(profile.name);
      expect(sys).toContain(String(profile.purpose).split(',')[0]!.trim());
    });
  }

  function getProfile(id: string) {
    // PLATFORM_PROFILES 는 내보내지 않으므로 빌더 출력에서 역추출하는 대신 소스에서 읽는다
    const src = read('src/core/external-traffic/prompts/_shared/common-context-guard.js');
    const m = src.match(new RegExp(`'?${id}'?:\\s*\\{[\\s\\S]{0,700}?\\}`));
    if (!m) return null;
    const name = m[0].match(/name:\s*'([^']+)'/);
    const purpose = m[0].match(/purpose:\s*'([^']+)'/);
    return name && purpose ? { name: name[1], purpose: purpose[1], raw: m[0] } : null;
  }
});

describe('② 길이 상한 — 프롬프트가 말하고 가드가 지키는가', () => {
  it('스레드: 가드 상한 500자가 있고, 살아있는 프롬프트가 그걸 말한다', () => {
    const limits = lengthGuard.LIMITS || lengthGuard.limits
      || JSON.parse(JSON.stringify({ threads: { body: { max: 500 } } }));
    // v3.8.505: 한 덩어리(body) → 칸별(parts) 한도로 바뀌었다
    const src = read('src/core/external-traffic/_shared/length-guard.js');
    expect(src).toMatch(/threads:\s*\{\s*parts:\s*\{\s*post:\s*\{\s*max:\s*500/);
    // 생성 모델에게도 말해야 한다 — 가드는 사후 검출일 뿐, 자르면 글이 깨진다
    const user = guard.buildPlatformUserPrompt('threads', { ...DUMMY, platformId: 'threads' }, '');
    const sys = guard.buildPlatformSystemPrompt('threads');
    expect(sys + user).toMatch(/500\s*자/);
  });

  it('X: 한글은 무게 2 라서 "280자"는 한글 기준 초과다 — 프롬프트가 한글 한도를 말해야 한다', () => {
    const sys = guard.buildPlatformSystemPrompt('x');
    // 280자라고만 하면 한글 280자를 만들고, 실제 X 에선 잘린다
    const saysKoreanLimit = /140\s*자|한글\s*기준|한글.{0,10}(140|절반)/.test(sys);
    expect(saysKoreanLimit).toBe(true);
  });
});

describe('③ 모순 검사', () => {
  it('스레드: 프로필이 해시태그를 요구하지 않는다 (스레드는 주제 태그 1개 문화)', () => {
    /**
     * 처음엔 threads:\{...\} 를 게으른 정규식으로 잡았는데, 블록 안의 variants: {...}
     * 닫는 괄호에서 일찍 끊겨 output 줄을 못 보고 헛통과했다.
     * 살아있는 프롬프트 출력물 자체를 검사한다 — 소스 모양에 안 흔들린다.
     */
    // output 줄은 사용자 프롬프트에 실린다 — 시스템+사용자 합산으로 본다
    const sys = guard.buildPlatformSystemPrompt('threads');
    const user = guard.buildPlatformUserPrompt('threads', { ...DUMMY, platformId: 'threads' }, '');
    const all = sys + '\n' + user;
    expect(all).not.toMatch(/해시태그\s*최대\s*\d/);
    expect(all).toMatch(/해시태그 금지|주제 태그 1개/);
  });

  it('스레드 모듈의 금지어와 공용 프롬프트가 싸우지 않는다', () => {
    const threads = require('../src/core/external-traffic/prompts/sns/threads');
    const sys = guard.buildPlatformSystemPrompt('threads');
    // 금지어를 프롬프트가 "쓰라"고 시키는 경우를 잡는다
    for (const banned of ['좋아요 눌러주세요', '지금 바로 클릭', '100% 보장']) {
      expect(threads.bannedPhrases).toContain(banned);
      /**
       * 프롬프트 안에 인용된 금지어는 "금지" 문맥이어야 한다.
       * 창을 80자로 잡았더니 [공통 금지 표현] 목록 한가운데 항목이 헤더를 못 보고
       * 오탐났다 — 금지 목록은 수십 줄이라 앞쪽 600자까지 본다.
       */
      if (sys.includes(banned)) {
        const idx = sys.indexOf(banned);
        const before = sys.slice(Math.max(0, idx - 600), idx + banned.length + 80);
        expect(before).toMatch(/금지|쓰지 않|절대|❌/);
      }
    }
  });
});

describe('④ 배선 — 만들고 안 부르면 조용히 무효', () => {
  const CHANNEL_FILES = [
    'sns/threads', 'sns/instagram', 'sns/x', 'sns/facebook',
    'naver/blog', 'naver/cafe-generic', 'naver/band', 'naver/jisik-in',
    'messenger/kakao-channel', 'messenger/telegram-channel',
  ];
  for (const f of CHANNEL_FILES) {
    it(`${f}: 위험평가(assessRisk)가 있고 금지어가 이어져 있다`, () => {
      const mod = require(`../src/core/external-traffic/prompts/${f}`);
      expect(typeof mod.assessRisk).toBe('function');
      expect(Array.isArray(mod.bannedPhrases)).toBe(true);
      expect(mod.bannedPhrases.length).toBeGreaterThan(3);
    });
  }

  it('공용 빌더 채널들의 buildSystemPrompt 가 실제로 공용을 부른다 (죽은 코드에 안 속게)', () => {
    const threads = require('../src/core/external-traffic/prompts/sns/threads');
    const live = threads.buildSystemPrompt('', '');
    // 파일 위쪽 구식 프롬프트에만 있는 문구가 나오면 덮어쓰기가 풀린 것
    expect(live).not.toContain('v3.8.257 — 손가락이 멈추는 viral DNA 강제');
    // 공용 빌더 산출물의 표식
    expect(live).toContain('외부유입 콘텐츠를 만드는 프롬프트 엔지니어');
  });
});

describe('검색형 채널에 낚시 훅을 강요하지 않는다', () => {
  it('네이버 블로그(SEO)는 충격·낚시 첫줄 45점 블록의 예외다', () => {
    const sys = guard.buildPlatformSystemPrompt('naver-blog');
    /**
     * 네이버 블로그 프로필 스스로 "검색자에게 답하는 정보 전달자, 일기형 도입부 X"라고
     * 말하면서, 공용 viral 블록은 "경악스럽거나 신선하거나"를 45점으로 강제한다.
     * 검색 유입 글에 낚시 첫줄을 달면 체류시간이 무너지고 C-Rank 에 독이다.
     */
    const forcesShock = /경악스럽|충격 인물|스크롤 멈추는 힘.*45점|45점 ★ 최우선/.test(sys);
    expect(forcesShock).toBe(false);
  });
});

describe('v3.8.505 — 스레드 실물 검수에서 나온 규칙', () => {
  const tr = require('../src/core/external-traffic/prompts/sns/threadsRewrite');
  const th = require('../src/core/external-traffic/prompts/sns/threads');

  const variant = {
    key: 'A',
    selectedFirstLine: '첫 줄',
    finalRevision: {
      firstLine: '첫 줄',
      body: '본문 내용 https://leadernam.com/x 링크 섞임',
      commentPrompt: '어떻게 생각해?',
      sharePrompt: '주변에 알려줘',
      linkPrompt: '원문은 여기 https://leadernam.com/x',
    },
  };

  it('조립: 본문에서 URL 을 걷어낸다 — 본문 링크는 도달을 깎는다', () => {
    const copy = tr.buildCopyFromVariant(variant);
    expect(copy).not.toContain('https://');
  });

  it('조립: 재게시 유도문을 게시문에 넣지 않는다 — 퍼가라는 글은 광고다', () => {
    const copy = tr.buildCopyFromVariant(variant);
    expect(copy).not.toContain('주변에 알려줘');
  });

  it('조립: 첫 댓글 칸에 링크가 따로 나온다', () => {
    const fc = tr.buildFirstCommentFromVariant(variant);
    expect(fc).toContain('https://leadernam.com/x');
  });

  it('출력이 두 칸(parts) — X 의 tweet1/tweet2 와 같은 구조', () => {
    const f = tr.buildFormattedFromThreadsResult({ variants: [variant] });
    expect(f.parts).toBeTruthy();
    expect(typeof f.parts.post).toBe('string');
    expect(typeof f.parts.firstComment).toBe('string');
    expect(f.body).toBeUndefined();
  });

  it('스키마 이중겹 제거 — 살아있는 프롬프트에 실물 검수 규칙이 실린다', () => {
    /**
     * 출력 스키마가 두 벌이었고 실제로 나가는 건 구식이었다(세 번째 죽은 겹).
     * threads.js 의 지시 빌더가 threadsRewrite 스키마를 그대로 쓰는지 못 박는다.
     */
    const up = th.buildUserPrompt({
      sourceSummary: 's', sourceUrl: 'https://x.kr/a', sourceTitle: 't',
      sourceText: 'b', sourceKeywords: [], sourceType: 'guide',
    });
    expect(up).toContain('본문(body)에는 URL 을 넣지 않는다');
    expect(up).toContain('새 사실 1~2개를 실명으로 푼다');
    expect(up).toContain('재게시(공유) 유도 문장을 게시문에 넣지 않는다');
    // 제목 숫자 재탕을 사실 공개로 치지 않는 규칙 (세 번째 재생성에서 잡은 회피 패턴)
    expect(up).toContain('제목에 이미 있는 숫자를 다시 말하는 것은');
    expect(up).not.toContain('재게시 유도 문장');   // 구식 스키마의 필드 설명
  });

  it('길이 가드가 칸별로 잰다 — 한 덩어리 시절 세 안 모두 500자를 넘겼다', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'src/core/external-traffic/_shared/length-guard.js'), 'utf-8');
    expect(src).toMatch(/threads:\s*\{\s*parts:\s*\{\s*post:\s*\{\s*max:\s*500/);
  });

  it('v1 폴백 프롬프트도 본문 URL 을 금지한다 — v2 실패 시 조용히 구식으로 돌아가면 안 된다', () => {
    const ui = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'electron/ui/modules/external-traffic.js'), 'utf-8');
    const threadsFallback = ui.slice(ui.indexOf("id: 'threads'"), ui.indexOf("id: 'naver-blog'"));
    expect(threadsFallback).toContain('본문에 URL 을 넣지 마세요');
  });
});
