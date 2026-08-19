/**
 * 거미줄 돌아가기 CTA 3위치 테스트 (v3.8.539)
 *
 * 사장님 요구: "버튼이 맨아래 하나만 있던데 맨아래까지 보는 사람 거의없어.
 * 상단 1 + 중간 1 + 하단 1 총 3개, 글과 조화롭게 — 어색하면 이것도 저것도 아니다."
 *
 * 계약:
 *  ① 상단=첫 h2 직전(서론 끝), 중간=가운데 h2 직전(h2 3개 이상일 때만), 하단=끝
 *  ② 짧은 글엔 덜 넣는다 — h2 없으면 상단도 생략 (어색 방지)
 *  ③ 재실행해도 중복되지 않는다 (마커 교체)
 *  ④ 이미 발행된 구버전 하단 블록과 호환 (기존 마커·role 승계)
 *  ⑤ 제목·URL 이스케이프 (XSS)
 */
import {
  applySpiderHubBacklinks,
  SPIDER_HUB_TOP_START, SPIDER_HUB_MID_START, SPIDER_HUB_CTA_START,
} from '../src/core/spiderweb/hub-backlinks';

const THEME = {
  gradientStart: '#f0f4ff', gradientEnd: '#e8ecfb', border: '#c7d2fe', primary: '#6366f1',
  heading: '#1e293b', muted: '#475569', ctaButtonStart: '#6366f1', ctaButtonEnd: '#8b5cf6',
  ctaShadow: 'rgba(99,102,241,.25)',
};
const HUB = { url: 'https://leadernam.com/guide', title: '보험금 청구 종합 가이드' };

const h2 = (n: number) => `<h2>섹션 ${n}</h2><p>본문 ${n}</p>`;
const LONG = `<p>서론입니다.</p>${h2(1)}${h2(2)}${h2(3)}${h2(4)}<p>마무리.</p>`;

describe('① 3위치 배치', () => {
  it('⭐ h2 4개 글: 상단은 첫 h2 앞, 중간은 가운데 h2 앞, 하단은 끝', () => {
    const r = applySpiderHubBacklinks(LONG, HUB, THEME);
    expect(r.detail).toEqual({ top: 'inserted', mid: 'inserted', bottom: 'inserted' });

    const topAt = r.html.indexOf(SPIDER_HUB_TOP_START);
    const firstH2 = r.html.indexOf('<h2>섹션 1</h2>');
    expect(topAt).toBeGreaterThan(-1);
    expect(topAt).toBeLessThan(firstH2);            // 서론 끝 = 첫 h2 직전

    const midAt = r.html.indexOf(SPIDER_HUB_MID_START);
    expect(midAt).toBeGreaterThan(r.html.indexOf('<h2>섹션 2</h2>'));
    expect(midAt).toBeLessThan(r.html.indexOf('<h2>섹션 3</h2>')); // 가운데(3번째) h2 직전

    const bottomAt = r.html.indexOf(SPIDER_HUB_CTA_START);
    expect(bottomAt).toBeGreaterThan(r.html.indexOf('<h2>섹션 4</h2>')); // 끝
  });

  it('세 자리의 무게가 다르다 — 상단은 한 줄 바, 하단만 큰 박스 (조화 요구)', () => {
    const r = applySpiderHubBacklinks(LONG, HUB, THEME);
    expect(r.html).toContain('data-bgpt-role="spider-hub-top"');
    expect(r.html).toContain('data-bgpt-role="spider-hub-mid"');
    expect(r.html).toContain('data-bgpt-role="spider-hub-backlink"');
    const top = r.html.slice(r.html.indexOf('spider-hub-top'), r.html.indexOf('spider-hub-top') + 600);
    expect(top).not.toContain('box-shadow'); // 상단은 그림자 없는 얇은 바
  });
});

describe('② 짧은 글엔 덜 넣는다', () => {
  it('h2 2개: 중간 생략, 상단·하단만', () => {
    const short = `<p>서론</p>${h2(1)}${h2(2)}`;
    const r = applySpiderHubBacklinks(short, HUB, THEME);
    expect(r.detail.mid).toBe('skipped');
    expect(r.detail.top).toBe('inserted');
    expect(r.detail.bottom).toBe('inserted');
  });

  it('h2 없음: 상단·중간 생략, 하단만 (기존과 동일)', () => {
    const tiny = '<p>짧은 공지</p>';
    const r = applySpiderHubBacklinks(tiny, HUB, THEME);
    expect(r.detail).toEqual({ top: 'skipped', mid: 'skipped', bottom: 'inserted' });
  });
});

describe('③ 재실행·호환·안전', () => {
  it('⭐ 두 번 돌려도 중복 없다 — 마커당 정확히 1개', () => {
    const once = applySpiderHubBacklinks(LONG, HUB, THEME).html;
    const twice = applySpiderHubBacklinks(once, HUB, THEME);
    for (const marker of [SPIDER_HUB_TOP_START, SPIDER_HUB_MID_START, SPIDER_HUB_CTA_START]) {
      expect(twice.html.split(marker).length - 1).toBe(1);
    }
    expect(twice.action).toBe('unchanged');
  });

  it('제목이 바뀌면 3곳 모두 교체된다 (재동기화)', () => {
    const once = applySpiderHubBacklinks(LONG, HUB, THEME).html;
    const r = applySpiderHubBacklinks(once, { ...HUB, title: '새 종합 가이드' }, THEME);
    expect(r.action).toBe('replaced');
    expect((r.html.match(/새 종합 가이드/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(r.html).not.toContain('보험금 청구 종합 가이드');
  });

  it('구버전 하단 블록(마커 없는 role div)을 승계 교체하고 상단·중간을 추가한다', () => {
    const legacy = `${LONG}\n<div class="bgpt-spider-hub-cta" data-bgpt-role="spider-hub-backlink" style="x">옛 블록</div>`;
    const r = applySpiderHubBacklinks(legacy, HUB, THEME);
    expect(r.html).not.toContain('옛 블록');
    expect(r.detail.bottom).toBe('replaced');
    expect(r.detail.top).toBe('inserted');
  });

  it('제목·URL 은 이스케이프된다 (XSS)', () => {
    const r = applySpiderHubBacklinks(LONG, { url: 'https://x.kr/"onload="1', title: '<script>bad()</script>' }, THEME);
    expect(r.html).not.toContain('<script>bad()');
    expect(r.html).toContain('&lt;script&gt;');
    expect(r.html).not.toContain('"onload="');
  });
});

describe('④ 배포 구매자용 처방 — 상태코드가 아니라 다음 행동을 알려준다', () => {
  const { describeBacklinkFailure } = require('../src/core/spiderweb/hub-backlinks');

  it('WP 401/403: 앱 비밀번호 재발급 + 보안 플러그인 REST 차단 안내', () => {
    for (const s of [401, 403]) {
      const msg = describeBacklinkFailure(s, 'wordpress');
      expect(msg).toContain('앱 비밀번호');
      expect(msg).toContain('보안 플러그인');
    }
  });

  it('404 는 글 삭제/이동 안내, 5xx 는 호스팅 일시 오류 안내', () => {
    expect(describeBacklinkFailure(404, 'wordpress')).toContain('삭제');
    expect(describeBacklinkFailure(503, 'wordpress')).toContain('잠시 후');
  });

  it('블로거 401 은 OAuth 재로그인 안내', () => {
    expect(describeBacklinkFailure(401, 'blogger')).toContain('로그인');
  });
});

describe('⑤ 배선 — main.ts 양 플랫폼이 새 모듈을 쓴다', () => {
  const fs = require('fs');
  const path = require('path');
  const mainTs = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.ts'), 'utf8');

  it('WP·블로거 업데이트가 applySpiderHubBacklinks 를 부른다 (2곳)', () => {
    const count = (mainTs.match(/applySpiderHubBacklinks\(currentHtml, hub,/g) || []).length;
    expect(count).toBe(2);
  });

  it('옛 단일 삽입 함수는 main.ts 에서 사라졌다 (고아 정리)', () => {
    expect(mainTs).not.toContain('function insertOrReplaceSpiderHubCta');
    expect(mainTs).not.toContain('function buildSpiderHubCtaBlock');
  });

  it('WP 실패 두 곳이 처방 번역을 쓰고, require 가 첫 사용보다 앞선다 (TDZ 방지)', () => {
    expect(mainTs).toContain("describeBacklinkFailure(getResponse.status, 'wordpress')");
    expect(mainTs).toContain("describeBacklinkFailure(putResponse.status, 'wordpress')");
    const fnStart = mainTs.indexOf('async function updateWordPressSpiderBacklink');
    const requireAt = mainTs.indexOf("describeBacklinkFailure } = require", fnStart);
    const firstUse = mainTs.indexOf('describeBacklinkFailure(getResponse.status', fnStart);
    expect(requireAt).toBeGreaterThan(fnStart);
    expect(requireAt).toBeLessThan(firstUse); // 실제로 한 번 냈던 TDZ 사고의 회귀 잠금
  });
});
