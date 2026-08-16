/**
 * v3.8.509 — 공개율(disclosure) 채널 분리: 미끼 일괄 적용의 해체
 *
 * 2026-08 실시간 조사 결과, "정보를 다 풀지 마라" 미끼 절대 규칙이 전 채널
 * 공통이던 것이 잘못이었다:
 *  - 네이버 블로그: 하이퍼클로바X 검색 — 체류 2분30초+ 없으면 노출 자체가 안 됨.
 *    얇은 미끼글은 검색 유입 0. (그런데 미끼 블록이 그대로 들어가고 있었다)
 *  - 네이버 카페: 2026-07 "광고 카페 퇴출" 강경 모드 — cliffhanger 미끼 패턴이
 *    곧 위장광고 신호. 즉삭+제재 대상.
 *  - 인스타: DM공유>저장>시청>프로필클릭 순위. 저장 안 되는 미끼 캡션은 도달 0.
 *    해시태그 권장 3~5개 (기존 8~12는 2026 기준 역효과).
 *  - 페이스북: 링크 포스트 도달 70~80% 하락 — 본문 무링크 + 첫 댓글 링크.
 *  - X: 본문 링크 도달 50~90% 하락 — 티저 유지가 맞음 (링크는 답글).
 * → 채널을 클러스터형(본문이 원문의 70~80%를 실제로 해결)과 티저형으로 분리.
 */
import * as fs from 'fs';
import * as path from 'path';

const guard = require('../src/core/external-traffic/prompts/_shared/common-context-guard');
const lengthGuard = require('../src/core/external-traffic/_shared/length-guard');

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');

const CLUSTER_CHANNELS = [
  'naver-blog', 'naver-cafe', 'instagram', 'facebook', 'local-board',
  'youtube-shorts', 'tiktok', 'pinterest', 'kakao-openchat',
];
const TEASER_CHANNELS = ['threads', 'x', 'kakao-channel'];

describe('① 클러스터형 채널 — 본문이 스스로 가치를 증명한다', () => {
  it.each(CLUSTER_CHANNELS)('%s: 미끼 블록이 빠지고 클러스터 블록이 들어간다', (id) => {
    const prompt = guard.buildPlatformSystemPrompt(id);
    expect(prompt).toContain('[📚 클러스터 전략');
    expect(prompt).not.toContain('[🎣 미끼·티저 전략');
  });

  it('클러스터 자가 검수가 미끼와 반대다 — 본문만 읽어도 핵심 답을 얻어야 통과', () => {
    const prompt = guard.buildPlatformSystemPrompt('naver-blog');
    expect(prompt).toContain('핵심 답 3가지를 얻는가');
    expect(prompt).toContain('실명 사실');
  });

  it('네이버 블로그: 체류시간 목표와 1,200~1,700자 분량이 명시된다', () => {
    const prompt = guard.buildPlatformSystemPrompt('naver-blog');
    expect(prompt).toContain('2분 30초');
    expect(prompt).toContain('1,200~1,700자');
  });

  it('네이버 카페: 광고 카페 퇴출(2026-07) 대응 — cliffhanger 미끼 패턴 경고가 있다', () => {
    const prompt = guard.buildPlatformSystemPrompt('naver-cafe');
    expect(prompt).toContain('광고 카페 퇴출');
  });

  it('인스타: DM 공유 1순위 반영 + 해시태그 3~5개', () => {
    const prompt = guard.buildPlatformSystemPrompt('instagram');
    expect(prompt).toContain('DM');
    expect(prompt).toContain('3~5개');
    expect(prompt).not.toContain('8~12개');
  });

  it('페이스북: 본문 무링크 + 링크는 첫 댓글', () => {
    const prompt = guard.buildPlatformSystemPrompt('facebook');
    expect(prompt).toContain('첫 댓글');
    expect(prompt).toMatch(/도달 70~80% 하락|70~80% 덜 도달/);
  });
});

describe('② 티저형 채널 — 미끼 전략이 그대로 유지된다', () => {
  it.each(TEASER_CHANNELS)('%s: 미끼 블록 유지, 클러스터 블록 없음', (id) => {
    const prompt = guard.buildPlatformSystemPrompt(id);
    expect(prompt).toContain('[🎣 미끼·티저 전략');
    expect(prompt).not.toContain('[📚 클러스터 전략');
  });

  it('X: 본문 링크 도달 하락 + 작성자 답글 가중 반영', () => {
    const prompt = guard.buildPlatformSystemPrompt('x');
    expect(prompt).toMatch(/50~90%/);
    expect(prompt).toContain('답글');
  });

  it('미끼 블록의 길이 룰에서 클러스터로 넘어간 채널 줄이 사라졌다', () => {
    const prompt = guard.buildPlatformSystemPrompt('threads');
    expect(prompt).not.toContain('네이버 카페\\오픈채팅\\지역 자유게시판: 200~500자');
    expect(prompt).not.toContain('인스타\\페북 캡션: 400~700자');
  });
});

describe('③ 채널별 차별화 — 같은 원문이라도 채널마다 독보적이어야 한다', () => {
  it('모든 프로필에 2026-08 실시간 edge 전략이 있고, 전부 서로 다르다', () => {
    const profiles = guard.PLATFORM_PROFILES;
    const ids = Object.keys(profiles);
    const edges = ids.map((id) => profiles[id].edge);
    edges.forEach((edge, i) => {
      expect(typeof edge).toBe('string');
      expect((edge as string).length).toBeGreaterThan(20);
    });
    expect(new Set(edges).size).toBe(ids.length);
  });

  it('시스템 프롬프트에 edge 가 실제로 렌더된다 (프로필에만 있고 안 들어가면 무배선)', () => {
    const prompt = guard.buildPlatformSystemPrompt('naver-blog');
    const profile = guard.PLATFORM_PROFILES['naver-blog'];
    expect(prompt).toContain(profile.edge.slice(0, 30));
  });

  it('모든 프로필에 disclosure 가 명시돼 있다 (기본값 숨김 금지)', () => {
    const profiles = guard.PLATFORM_PROFILES;
    Object.keys(profiles).forEach((id) => {
      expect(['cluster', 'teaser']).toContain(profiles[id].disclosure);
    });
  });
});

describe('④ 길이 가드 동기화 — 프롬프트가 시키는 분량을 가드가 막으면 안 된다', () => {
  it('네이버 블로그 상한이 1700자로 올라갔다 (체류 2분30초 분량)', () => {
    expect(lengthGuard.CHANNEL_LENGTH_LIMITS['naver-blog'].body.max).toBe(1700);
  });

  it('인스타 해시태그 가드가 3~5개다 (8~12는 2026 역효과)', () => {
    expect(lengthGuard.CHANNEL_LENGTH_LIMITS.instagram.hashtags).toEqual({ min: 3, max: 5 });
  });
});

describe('⑤ v1 폴백 프롬프트 동기화 — 폴백이 구철학을 말하면 안 된다', () => {
  const ui = read('electron/ui/modules/external-traffic.js');

  it('인스타 폴백도 해시태그 3~5개', () => {
    expect(ui).not.toContain('해시태그는 8~12개');
    expect(ui).not.toContain('해시태그 8~12개');
  });

  it('네이버 블로그 폴백도 1,200~1,700자', () => {
    expect(ui).not.toContain('700~1200자');
  });
});
